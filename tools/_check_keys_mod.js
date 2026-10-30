/* 键存活校验：提取 04a-modcheat-adapters.js 中指定适配器的全部 varPath，在新版模组源码目录里逐一验证。
 * 用法：node tools/_check_keys_mod.js <modId> <源码根目录> [--list]
 *   --list：只列 varPath 清单不校验（用于甄别）
 * 说明：分段键（$A.B.C）在源码里可能以任意分段出现；主键存活 = 首段存在，
 * 精确匹配优先，找不到首段报 MISS（引用形态差异由人复查二次短键）。
 */
"use strict";
const fs = require("fs");
const path = require("path");

const modId = process.argv[2];
const root = process.argv[3];
if (!modId || !root || !fs.existsSync(root)) {
  console.error("用法：node _check_keys_mod.js <modId> <源码根目录> [--list]");
  process.exit(1);
}
const listOnly = process.argv[4] === "--list";

/* 适配器源码按模组拆分（04a-00..11-*.js，v1.9.13）：目录扫描拼接，顺序与 build_js.js sort 一致 */
const ADAPTER_DIR = path.join(__dirname, "..", "javascript", "src");
const js = fs.readdirSync(ADAPTER_DIR).filter(f => /^04a-.*\.js$/.test(f)).sort()
  .map(f => fs.readFileSync(path.join(ADAPTER_DIR, f), "utf8")).join("\n");
const i = js.indexOf('CHEAT_ADAPTERS["' + modId + '"]');
if (i === -1) { console.error("适配器不存在: " + modId); process.exit(1); }
let start = js.indexOf("{", i), depth = 0, end = -1;
for (let j = start; j < js.length && end === -1; j++) {
  if (js[j] === "{") depth++;
  else if (js[j] === "}") { depth--; if (depth === 0) end = j; }
}
const seg = js.slice(i, end + 1);

/* 提取全部 varPath（stages/abilities/scenes/values） */
const varPaths = [...seg.matchAll(/varPath:\s*"([^"]+)"/g)].map(m => m[1]);
const modNameMatch = seg.match(/modName:\s*"([^"]+)"/);
console.log("===== 键存活校验 " + modId + "（" + (modNameMatch ? modNameMatch[1] : "?") + "） =====");
console.log("varPath 总数: " + varPaths.length);

if (listOnly) {
  varPaths.forEach((p, idx) => console.log(String(idx + 1).padStart(3) + ". " + p));
  process.exit(0);
}

/* 读全部源码文件（合并小写，分段短键匹配） */
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|js|twee|json)$/.test(e.name)) files.push(p);
  }
})(root);
const corpus = files.map(f => fs.readFileSync(f, "utf8").toLowerCase()).join("\n");
console.log("源码文件: " + files.length);

let miss = 0;
const missList = [];
for (const p of varPaths) {
  const first = p.split(".")[0].toLowerCase();
  if (corpus.indexOf(first) !== -1) {
    console.log("[OK ] " + p);
  } else {
    miss++; missList.push(p);
    console.log("[MISS] " + p + "  ← 首段 '" + first + "' 未在源码出现");
  }
}
console.log("结果: " + (miss === 0 ? "全部存活" : miss + " 条 MISS——需二次短键复核引用形态") );
if (missList.length) console.log("MISS 清单: " + missList.join(" ; "));
