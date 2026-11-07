/* check_structure.js —— 源码片段结构门禁（架构治理 P0）
 *
 * 三条规则（全部 fail-closed，带基线棘轮）：
 *   S1 单段行数上限（默认 400）：超限且不在基线白名单 → 失败；基线项已回落到阈值内 → 提示「可下调基线」
 *   S2 续号命名禁令：X2.js / X3.js 这类「剥掉末位数字后正好是另一个已存在段」的命名 → 失败
 *      （白名单 = 历史遗留，只减不增；根因是「靠文件名挤进排序」的隐式依赖，已由 manifest 取代）
 *   S3 重复顶层 var 声明（WARN，不阻断）：同一变量名在多段以 `var NAME =` 声明 → 后者会把前者重置，
 *      目前已知 CHEAT_ADAPTERS 在 03d 与 04a-00 各声明一次（顺序正确时无害，顺序一错就清空注册表）
 *
 * 用法：node tools/check_structure.js [--json]
 * 退出码：S1/S2 命中则 1
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = process.env.MCE_SRC_DIR || path.join(ROOT, "javascript", "src");
const MANIFEST = path.join(SRC_DIR, "manifest.json");
const BASELINE = path.join(__dirname, "structure-baseline.json");

function readJson(p, label) {
  if (!fs.existsSync(p)) {
    console.error("FATAL: " + label + " 缺失：" + p);
    process.exit(1);
  }
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) {
    console.error("FATAL: " + label + " 不是合法 JSON：" + e.message);
    process.exit(1);
  }
}

const manifest = readJson(MANIFEST, "manifest.json");
const baseline = readJson(BASELINE, "structure-baseline.json");
const MAX_LINES = baseline.maxLines || 400;
const lineAllow = baseline.lineAllowlist || {};
const contAllow = new Set(baseline.continuationAllowlist || []);

const segments = (manifest.segments || []).map(s => s.file);
const filesOnDisk = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".js"));
const fails = [];
const warns = [];
const stats = [];

/* S1 段长 */
for (const f of segments) {
  const p = path.join(SRC_DIR, f);
  if (!fs.existsSync(p)) continue;
  const lines = fs.readFileSync(p, "utf8").split("\n").length - (fs.readFileSync(p, "utf8").endsWith("\n") ? 1 : 0);
  stats.push({ file: f, lines });
  const budget = Object.prototype.hasOwnProperty.call(lineAllow, f) ? lineAllow[f] : MAX_LINES;
  if (lines > MAX_LINES && !Object.prototype.hasOwnProperty.call(lineAllow, f)) {
    fails.push("S1 " + f + " 有 " + lines + " 行，超过单段上限 " + MAX_LINES + "（请拆分；确需豁免必须写进 tools/structure-baseline.json 并说明原因）");
  } else if (lines > budget) {
    fails.push("S1 " + f + " 有 " + lines + " 行，超过基线额度 " + budget + "（基线只减不增）");
  }
}
for (const f of Object.keys(lineAllow)) {
  const s = stats.find(x => x.file === f);
  if (!s) { warns.push("S1 基线项 " + f + " 已不存在于源码目录，请从 structure-baseline.json 移除"); continue; }
  if (s.lines <= MAX_LINES) warns.push("S1 基线项 " + f + " 已回落到 " + s.lines + " 行（阈值 " + MAX_LINES + "），可下调/移除基线");
}

/* S2 续号命名 */
const diskSet = new Set(filesOnDisk);
for (const f of filesOnDisk) {
  const m = /^(.*?)(\d+)\.js$/.exec(f);
  if (!m) continue;
  if (!diskSet.has(m[1] + ".js")) continue; /* 只有「剥掉末位数字 == 另一个真实存在的段」才算续号 */
  if (contAllow.has(f)) continue;
  fails.push("S2 " + f + " 是续号命名（" + m[1] + ".js 已存在）：插入位置由 manifest 决定，不再用 X2/X3 挤排序；请改成语义化文件名（如 -data / -view / -hook）");
}
for (const f of contAllow) {
  if (!diskSet.has(f)) warns.push("S2 续号白名单项 " + f + " 已不存在，请从 baseline 移除");
}

/* S3 注册表容器重复声明（WARN，不阻断）：已知 CHEAT_ADAPTERS 在 03d 与 04a-00 各声明一次。
   两次声明都排在所有适配器赋值之前，所以当前顺序下无害；但顺序一错（04a 早于 03d）就会把已注册表清空。
   只查注册表类容器，不做全量「同名 var」扫描——局部变量同名是海量噪声，会淹没真问题。 */
const registryNames = ["CHEAT_ADAPTERS", "CHEAT_VANILLA_ROOTS", "CHEAT_PASSIVE_PROBES"];
const registryDecls = [];
for (const f of segments) {
  const p = path.join(SRC_DIR, f);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, "utf8");
  for (const name of registryNames) {
    const re = new RegExp("var\\s+" + name + "\\s*=", "g");
    if (re.test(text)) registryDecls.push(name + " ← " + f);
  }
}
for (const name of registryNames) {
  const list = registryDecls.filter(x => x.startsWith(name + " ← ")).map(x => x.split(" ← ")[1]);
  if (list.length > 1) warns.push("S3 注册表容器 " + name + " 在 " + list.length + " 段重复声明：" + list.join(" / ") + "（后声明会重置前者，顺序错误时注册表会被清空）");
}

const asJson = process.argv.includes("--json");
if (asJson) {
  console.log(JSON.stringify({ maxLines: MAX_LINES, segments: stats.length, fails, warns }, null, 1));
} else {
  console.log("结构门禁：检查 " + stats.length + " 段（上限 " + MAX_LINES + " 行，基线豁免 " + Object.keys(lineAllow).length + " 项，续号白名单 " + contAllow.size + " 项）");
  if (fails.length) {
    console.log("\n[FAIL] " + fails.length + " 项");
    fails.forEach(x => console.log("  " + x));
  }
  if (warns.length) {
    console.log("\n[WARN] " + warns.length + " 项");
    warns.forEach(x => console.log("  " + x));
  }
  if (!fails.length && !warns.length) console.log("结构门禁：全部通过");
}
process.exit(fails.length ? 1 : 0);
