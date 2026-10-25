/*
 * 模组升级自动核对脚本（v1.9.0 工程化第 3 项）：
 * 第三方模组升级后，扫描其源码，把「源码中实际写入的 V 路径」与
 * CHEAT_ADAPTERS（04a-modcheat-adapters.js）里声明的 varPath 比对，
 * 输出：声明缺失（模组改名/删除）/ 新增候选（模组新增、适配器未覆盖）/ 疑似改名建议。
 * 用法：node tools/audit_adapters.js <适配器id> <模组源码目录>
 * 适配器 id：revelation-the-book-of-return / dom_robin / deadwood-reblooms / SmartPhone / MLI
 */
const fs = require("fs"), path = require("path");

/* ---------- 参数 ---------- */
const args = process.argv.slice(2);
const MOD_ID = args[0];
const MOD_SRC = args[1] ? path.resolve(args[1]) : null;
if (!MOD_ID || !MOD_SRC || !fs.existsSync(MOD_SRC)) {
  console.error("用法: node tools/audit_adapters.js <适配器id> <模组源码目录>");
  process.exit(2);
}

/* ---------- 1. 从 04a-modcheat-adapters.js 提取适配器声明 ---------- */
const SRC_MOD = path.join(__dirname, "..", "javascript", "src", "04a-modcheat-adapters.js");
const raw = fs.readFileSync(SRC_MOD, "utf8");
const segRe = new RegExp('CHEAT_ADAPTERS\\["' + MOD_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"\\] = \\{([\\s\\S]*?)\\n\\t\\};', "m");
const segM = segRe.exec(raw);
if (!segM) { console.error("未在 04a-modcheat-adapters.js 找到适配器: " + MOD_ID); process.exit(2); }
const seg = segM[1];
const declared = [];
const vpRe = /varPath:\s*"([^"]+)"/g;
let vm;
while ((vm = vpRe.exec(seg)) !== null) { declared.push(vm[1]); }
console.log("适配器 " + MOD_ID + "：声明 varPath " + declared.length + " 条");

/* ---------- 2. 扫描模组源码的 V 访问路径 ---------- */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".vscode", ".github", "types", "audio-pack", "tools", "public", "scripts"]);
const EXTS = new Set([".js", ".ts", ".jsx", ".tsx", ".twee", ".yaml", ".json"]);
/* 末段为常见方法名/非状态属性的路径：剔除该末段（保留其字段前缀） */
const NON_FIELD_TAILS = new Set(["includes", "pushUnique", "filter", "map", "forEach", "push", "pop", "splice", "slice", "join", "sort", "reverse", "reduce", "reduceRight", "keys", "values", "entries", "hasOwnProperty", "indexOf", "lastIndexOf", "find", "findIndex", "some", "every", "replace", "split", "trim", "toLowerCase", "toUpperCase", "toString", "valueOf", "concat", "flat", "flatMap", "at", "shift", "unshift", "length", "delete"]);
const actualByRoot = {}; // root -> Set(路径)
const allPaths = new Set();
function addPath(full) {
  const segs = full.split(".");
  while (segs.length > 1 && NON_FIELD_TAILS.has(segs[segs.length - 1])) { segs.pop(); }
  if (!segs.length) { return; }
  const p = segs.join(".");
  const root = segs[0];
  allPaths.add(p);
  if (!actualByRoot[root]) { actualByRoot[root] = new Set(); }
  actualByRoot[root].add(p);
}
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const en of entries) {
    if (en.name.startsWith(".")) { continue; }
    const p = path.join(dir, en.name);
    if (en.isDirectory()) {
      if (SKIP_DIRS.has(en.name)) { continue; }
      walk(p);
    } else if (en.isFile() && EXTS.has(path.extname(en.name).toLowerCase())) {
      try {
        const txt = fs.readFileSync(p, "utf8");
        /* 多段：V.Root.field（TS/JS 直访）与 $Root.field（SugarCube twee 宏）；
           单段：V.key / $key（DomRobin 等顶层单键模组），仅赋值为显著形态也收录 */
        const re = /(?:\bV\.|\$)([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
        let m;
        while ((m = re.exec(txt)) !== null) { addPath(m[1]); }
      } catch (e) { /* 跳过不可读文件 */ }
    }
  }
}
walk(MOD_SRC);

/* ---------- 3. 比对 ---------- */
const declaredRoots = new Set(declared.map(p => p.split(".")[0]));
const missing = [];   // 声明了但源码没出现
const extra = [];     // 声明 root 下源码有、声明没有
const renamedHints = [];

for (const d of declared) {
  const root = d.split(".")[0];
  const hit = allPaths.has(d);
  if (!hit) {
    missing.push(d);
    /* 疑似改名：声明 root 下存在其他字段，或同尾段在其他 root 出现 */
    const sameRootFields = actualByRoot[root] ? Array.from(actualByRoot[root]) : [];
    const tail = d.split(".").slice(1).join(".");
    const renamed = Array.from(allPaths).filter(p => p.endsWith("." + tail) && p !== d);
    renamedHints.push({ d, sameRootFields, renamed });
  }
}
for (const root of declaredRoots) {
  if (!actualByRoot[root]) { continue; }
  for (const p of actualByRoot[root]) {
    if (!declared.includes(p)) { extra.push(p); }
  }
}

/* ---------- 4. 报告 ---------- */
console.log("\n===== 核对报告：适配器 " + MOD_ID + " vs " + MOD_SRC + " =====");
console.log("源码扫描：V 访问路径 " + allPaths.size + " 条，涉及根 " + Object.keys(actualByRoot).length + " 个");
console.log("\n[1] 声明缺失（源码未出现 —— 模组改名/删除/路径变动，需人工确认）");
if (!missing.length) { console.log("  无 ✓"); }
missing.forEach(d => {
  console.log("  ✗ " + d);
  const hint = renamedHints.find(h => h.d === d);
  if (hint && hint.renamed.length) {
    console.log("     疑似改名 → " + hint.renamed.join(" / "));
  }
});
console.log("\n[2] 新增候选（源码有、适配器未声明 —— 模组新增字段，考虑补声明）");
if (!extra.length) { console.log("  无 ✓"); }
else {
  extra.forEach(p => console.log("  + " + p));
  console.log("  共 " + extra.length + " 条（部分可能是非状态瞬态变量，需人工甄别）");
}
console.log("\n[3] 声明覆盖统计");
console.log("  已覆盖 " + (declared.length - missing.length) + "/" + declared.length);
const pct = declared.length ? Math.round((declared.length - missing.length) / declared.length * 100) : 100;
console.log("  覆盖率 " + pct + "%");
console.log("\n[注] 源码经对象别名/解构访问（如 const s = V.RobinExpansion; s.balloon）的路径无法被静态正则捕获，");
console.log("     缺失条目可能因此误报；模组源码版本与适配器目标版本不一致时，缺失/新增也需结合升级方向判断。");
console.log("\n[4] 源码中声明根之外的其它根（模组新增命名空间，仅提示）");
const otherRoots = Object.keys(actualByRoot).filter(r => !declaredRoots.has(r)).slice(0, 30);
console.log("  " + (otherRoots.length ? otherRoots.join(", ") : "无"));
