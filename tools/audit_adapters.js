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

/* ---------- 1. 从 src/04a-*.js（按模组拆分）提取适配器声明 ---------- */
const ADAPTER_DIR = path.join(__dirname, "..", "javascript", "src");
const raw = fs.readdirSync(ADAPTER_DIR).filter(f => /^04a-.*\.js$/.test(f)).sort()
  .map(f => fs.readFileSync(path.join(ADAPTER_DIR, f), "utf8")).join("\n");
const segRe = new RegExp('CHEAT_ADAPTERS\\["' + MOD_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"\\] = \\{([\\s\\S]*?)\\n\\t\\};', "m");
const segM = segRe.exec(raw);
if (!segM) { console.error("未在 src/04a-*.js 找到适配器: " + MOD_ID); process.exit(2); }
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
const dynamicPrefixes = new Set(); // ['<prefix>' + ...] 拼接访问的前缀（键名 = 前缀 + 运行时变量）
const aliases = {}; // 别名绑定：const state = V.RobinTemple → { state: "RobinTemple" }（消除别名/解构盲区）
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
           单段：V.key / $key（DomRobin 等顶层单键模组），仅赋值为显著形态也收录；
           增强：引号键段（['x']/["x"]，含连字符/数字键）与可选链段（?.field）并入路径，
           消除动态/可选链盲区；纯拼接前缀（['deadwood-' + ...]）另经 dynamicPrefixes 收集提示 */
        const re = /(?:\bV\.|\$)([A-Za-z_$][\w$]*(?:(?:\.[A-Za-z_$][\w$]*)|(?:\?\.[A-Za-z_$][\w$]*)|(?:\[['"][A-Za-z0-9_$-]+['"]\]))*)/g;
        let m;
        while ((m = re.exec(txt)) !== null) {
          const norm = m[1].replace(/\?\./g, ".").replace(/\[['"]([^'"]+)['"]\]/g, ".$1");
          addPath(norm);
        }
        const dynRe = /\[['"]([A-Za-z0-9_$-]+)['"]\s*\+/g;
        while ((m = dynRe.exec(txt)) !== null) { dynamicPrefixes.add(m[1]); }
        /* 别名绑定：const state = V.RobinTemple → state.faith_band 归位为 RobinTemple.faith_band */
        const aliasRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:(?:V\.|\$))([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
        let am;
        while ((am = aliasRe.exec(txt)) !== null) { aliases[am[1]] = am[2]; }
        const aliasAccRe = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/g;
        while ((am = aliasAccRe.exec(txt)) !== null) {
          if (aliases[am[1]]) { addPath(aliases[am[1]] + "." + am[2]); }
        }
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
  const tail = d.split(".").slice(-1)[0];
  const dyn = Array.from(dynamicPrefixes).find(p => tail.startsWith(p));
  console.log("  ✗ " + d + (dyn ? "   [动态键前缀 '" + dyn + "' 拼接命中，非删除信号，KEEP]" : ""));
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
console.log("\n[5] 动态键拼接前缀（['<prefix>' + var] 形态，键名=前缀+运行时变量，静态无法确认完整键名，非删除信号）");
console.log("  " + (dynamicPrefixes.size ? Array.from(dynamicPrefixes).join(", ") : "无"));
