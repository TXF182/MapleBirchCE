/*
 * 构建脚本：把 javascript/src/*.js 按文件名顺序拼接 → javascript/maplebirchce.js。
 * 用法：node tools/build_js.js [--sync-pkg <打包源目录>]
 *  - 无参：只生成单文件（git 源码真相源）
 *  - --sync-pkg：生成后同时复制到打包源（boot.json/README/twee 需另行同步）
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "javascript", "src");
const OUT = path.join(ROOT, "javascript", "maplebirchce.js");

if (!fs.existsSync(SRC_DIR)) {
  console.error("FATAL: " + SRC_DIR + " 不存在（请检查 javascript/src 开发源目录）");
  process.exit(1);
}
/* 拼接是纯字符串相加（不插分隔符），所以每个片段的末尾必须带换行：
 *   段末缺换行 → 下一段首行被接到本段末行；末行若是 // 行注释，下一段代码被整行注释掉（静默丢功能，
 *   而且静态检查看不出来，只有跑起来少了一块 UI 才会发现）；末行若是未闭合块注释，则下一段整体被吞。
 * 这里加 fail-closed 守卫：缺换行自动补齐并让构建失败（产物已修好，把补齐后的源一并提交再跑即绿）。
 * 同时拦 U+FFFD（编码损坏的产物看着"有内容"，实际是乱码）。 */
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".js")).sort();
let out = "";
const fixed = [];
for (const f of files) {
  let text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
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
/* 顺序指纹：文件名列表的短哈希。改名/新增片段会改变拼接顺序，指纹随之变，便于事后对账。 */
const orderSig = crypto.createHash("sha256").update(files.join("|")).digest("hex").slice(0, 12);
console.log("built " + OUT + "  (" + files.length + " 段, " + Buffer.byteLength(out, "utf8") + " B)");
console.log("order " + orderSig + "  (按文件名 sort 拼接)");
console.log("SHA256 " + sha);
if (fixed.length) {
  console.error("FAIL: 以下片段缺末尾换行（已自动补齐，请提交补齐后的源文件再跑）:");
  fixed.forEach(f => console.error("  - " + f));
  process.exit(1);
}

const idx = process.argv.indexOf("--sync-pkg");
if (idx !== -1 && process.argv[idx + 1]) {
  const pkg = process.argv[idx + 1];
  const dst = path.join(pkg, "javascript", "maplebirchce.js");
  fs.copyFileSync(OUT, dst);
  console.log("synced → " + dst);
}
