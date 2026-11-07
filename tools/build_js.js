/*
 * 构建脚本：按 javascript/src/manifest.json 的显式段序拼接 → javascript/maplebirchce.js
 * 用法：node tools/build_js.js [--sync-pkg <打包源目录>] [--write-manifest] [--check]
 *  - 无参：只生成单文件（git 源码真相源）
 *  - --sync-pkg：生成后同时复制到打包源（boot.json/README/twee 需另行同步）
 *  - --write-manifest：按当前目录内容重写 manifest（段序仍取文件名字典序，仅用于新增段后的登记）
 *  - --check：只校验 manifest 与目录是否一致（不写产物，CI/评审用）
 *
 * 为什么改成 manifest（2026-11-07 架构治理 P0）：
 *   原先段序 = readdirSync().sort() 的字典序，插入一段代码只能靠「改文件名把新段挤到正确位置」，
 *   于是出现 07a-shell2 / 07d-places2 / 07h-render2… 这类续号文件；依赖关系是隐式的、评审看不见，
 *   改顺序/改名会静默改变执行次序。改为 manifest 后段序是显式数据，改顺序必须改同一个文件。
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
/* 允许用环境变量指向另一份源码/产物：仅供负控回归（改名后重建产物 SHA 必须不变）使用，
   正常构建不设这两个变量。 */
const SRC_DIR = process.env.MCE_SRC_DIR || path.join(ROOT, "javascript", "src");
const OUT = process.env.MCE_OUT || path.join(ROOT, "javascript", "maplebirchce.js");
const MANIFEST = path.join(SRC_DIR, "manifest.json");

/* 层序：必须严格自前向后出现（同一层可连续多段），用来拦「拖错位置」这类改动 */
const LAYER_ORDER = ["preamble", "core", "adapter", "write", "ui", "export"];

function layerOf(file) {
  if (/^00-preamble\.js$/.test(file)) return "preamble";
  if (/^04a-/.test(file)) return "adapter";
  if (/^04[bc]-/.test(file)) return "write";
  if (/^0[5678]/.test(file)) return "ui";
  if (/^09-/.test(file)) return "export";
  return "core";
}

function listSourceFiles() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error("FATAL: " + SRC_DIR + " 不存在（请检查 javascript/src 开发源目录）");
    process.exit(1);
  }
  return fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".js")).sort();
}

function writeManifest(files) {
  const segs = files.map(f => ({ file: f, layer: layerOf(f) }));
  const data = {
    version: 1,
    note: "构建顺序的唯一真源：段序即依赖序。新增/调整段必须改这里（node tools/build_js.js --write-manifest 可登记新段），不再靠文件名字典序。",
    layers: LAYER_ORDER,
    segments: segs
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("manifest written: " + MANIFEST + "  (" + segs.length + " 段)");
}

function readManifest() {
  if (!fs.existsSync(MANIFEST)) {
    console.error("FATAL: " + MANIFEST + " 缺失。段序不允许回退到文件名字典序，先运行 node tools/build_js.js --write-manifest 生成并提交。");
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch (e) {
    console.error("FATAL: manifest.json 不是合法 JSON：" + e.message);
    process.exit(1);
  }
  if (!Array.isArray(data.segments) || !data.segments.length) {
    console.error("FATAL: manifest.segments 必须是非空数组");
    process.exit(1);
  }
  return data;
}

/* fail-closed 校验：集合一致 / 无重复 / 层序单调 / 层名合法 */
function validateManifest(data, files) {
  const errs = [];
  const listed = [];
  let lastLayer = -1;
  data.segments.forEach((seg, i) => {
    const at = "segments[" + i + "]";
    if (!seg || typeof seg.file !== "string" || !seg.file) { errs.push(at + " 缺 file"); return; }
    if (listed.indexOf(seg.file) !== -1) { errs.push(at + " 重复登记：" + seg.file); return; }
    listed.push(seg.file);
    if (files.indexOf(seg.file) === -1) { errs.push(at + " 指向不存在的段：" + seg.file); return; }
    const li = LAYER_ORDER.indexOf(seg.layer);
    if (li === -1) { errs.push(at + " 未知层 " + JSON.stringify(seg.layer) + "（合法值：" + LAYER_ORDER.join(" / ") + "）"); return; }
    if (li < lastLayer) {
      errs.push(at + " 层序回退：" + seg.file + " 标为 " + seg.layer + "，但前一层的序号更大（层序必须 " + LAYER_ORDER.join(" → ") + "）");
    }
    lastLayer = Math.max(lastLayer, li);
  });
  files.forEach(f => { if (listed.indexOf(f) === -1) errs.push("目录里有、manifest 未登记：" + f + "（新增段后跑 node tools/build_js.js --write-manifest）"); });

  if (errs.length) {
    console.error("FATAL: manifest 与 javascript/src 不一致（" + errs.length + " 项）：");
    errs.forEach(e => console.error("  - " + e));
    console.error("提示：登记新段用 node tools/build_js.js --write-manifest（会按文件名序写回，请复核层标签后提交）");
    process.exit(1);
  }
}

function build() {
  const files = listSourceFiles();
  const data = readManifest();
  validateManifest(data, files);

  const segs = data.segments.map(s => s.file);
  let out = "";
  const fixed = [];
  for (const f of segs) {
    let text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
    /* 拼接是纯字符串相加（不插分隔符），所以每个片段的末尾必须带换行：
     *   段末缺换行 → 下一段首行被接到本段末行；末行若是 // 行注释，下一段代码被整行注释掉（静默丢功能，
     *   而且静态检查看不出来，只有跑起来少了一块 UI 才会发现）；末行若是未闭合块注释，则下一段整体被吞。
     * 这里加 fail-closed 守卫：缺换行自动补齐并让构建失败（产物已修好，把补齐后的源一并提交再跑即绿）。
     * 同时拦 U+FFFD（编码损坏的产物看着"有内容"，实际是乱码）。 */
    const bad = (text.match(/\uFFFD/g) || []).length;
    if (bad > 0) {
      console.error("FATAL: " + f + " 含 " + bad + " 个 U+FFFD（编码损坏），拒绝构建");
      process.exit(1);
    }
    if (!text.endsWith("\n")) {
      text += "\n";
      fixed.push(f);
    }
    out += text;
  }
  if (!out.endsWith("\n")) out += "\n";
  fs.writeFileSync(OUT, out);

  const sha = crypto.createHash("sha256").update(out).digest("hex");
  /* 顺序指纹：manifest 段序的短哈希。改段序/manifest 会变，便于事后对账（与段内容无关）。 */
  const orderSig = crypto.createHash("sha256").update(segs.join("|")).digest("hex").slice(0, 12);
  console.log("built " + OUT + "  (" + segs.length + " 段, " + Buffer.byteLength(out, "utf8") + " B)");
  console.log("order " + orderSig + "  (manifest 段序，层 " + data.segments.filter((s, i, a) => i === 0 || a[i - 1].layer !== s.layer).map(s => s.layer).join("→") + ")");
  console.log("SHA256 " + sha);
  if (fixed.length) {
    console.error("FAIL: 以下片段缺末尾换行（已自动补齐，请提交补齐后的源文件再跑）:");
    fixed.forEach(f => console.error("  - " + f));
    process.exit(1);
  }
  return segs;
}

const args = process.argv.slice(2);
if (args.includes("--write-manifest")) {
  writeManifest(listSourceFiles());
  /* 写 manifest 不等于放过校验：立刻回读校验一遍，避免手改后带病提交 */
  validateManifest(readManifest(), listSourceFiles());
  console.log("manifest 校验通过");
  process.exit(0);
}
if (args.includes("--check")) {
  validateManifest(readManifest(), listSourceFiles());
  console.log("manifest 校验通过（未写产物）");
  process.exit(0);
}

const segs = build();

const idx = process.argv.indexOf("--sync-pkg");
if (idx !== -1 && process.argv[idx + 1]) {
  const pkg = process.argv[idx + 1];
  const dst = path.join(pkg, "javascript", "maplebirchce.js");
  fs.copyFileSync(OUT, dst);
  console.log("synced → " + dst);
}
void segs;
