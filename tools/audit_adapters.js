/*
 * 模组升级自动核对脚本（v1.9.0 工程化第 3 项；v1.9.31 证据分级增强）：
 * 第三方模组升级后，扫描其源码，把「源码中实际写入的 V 路径」与
 * CHEAT_ADAPTERS（04a-modcheat-adapters.js）里声明的 varPath 比对，
 * 输出：声明缺失 / 新增候选 / 疑似改名 / 动态键闭合 / 核错源。
 *
 * 用法：node tools/audit_adapters.js <适配器id> <模组源码目录> [--json]
 * 适配器 id：revelation-the-book-of-return / dom_robin / deadwood-reblooms / SmartPhone / MLI
 *
 * v1.9.31 改动（对齐 XERJ "0 命中不等于不存在，必须能区分错源" 的思路）：
 *   1. 每条"声明缺失"给出分级判定（SYNC=强证据 / DYNAMIC=两侧闭合 / SOURCE_MISMATCH=核错源 /
 *      RENAME?=有近似候选 / MISSING=零证据），不再一律"需人工确认"。
 *   2. 近似候选带分数与理由（same-tail / normalized-equal / leaf-near / same-parent）。
 *   3. 动态键改为"代码前缀 + 数据枚举值"两侧校验，取代原先只比前缀的假阳性。
 *   4. --json 输出，供 resolve_missing / CI 直接消费。
 */
const fs = require("fs"), path = require("path");
const kk = require("./lib/keycheck.js");

/* ---------- 参数 ---------- */
const rawArgs = process.argv.slice(2);
const JSON_MODE = rawArgs.indexOf("--json") !== -1;
const args = rawArgs.filter((a) => a !== "--json");
const MOD_ID = args[0];
const MOD_SRC = args[1] ? path.resolve(args[1]) : null;
if (!MOD_ID || !MOD_SRC || !fs.existsSync(MOD_SRC)) {
  console.error("用法: node tools/audit_adapters.js <适配器id> <模组源码目录> [--json]");
  process.exit(2);
}
const log = JSON_MODE ? () => {} : (s) => console.log(s);

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
log("适配器 " + MOD_ID + "：声明 varPath " + declared.length + " 条");

/* ---------- 2. 扫描模组源码的 V 访问路径 ---------- */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".vscode", ".github", "types", "audio-pack", "tools", "public", "scripts"]);
const EXTS = new Set([".js", ".ts", ".jsx", ".tsx", ".twee", ".yaml", ".json"]);
/* 末段为常见方法名/非状态属性的路径：剔除该末段（保留其字段前缀） */
const NON_FIELD_TAILS = new Set(["includes", "pushUnique", "filter", "map", "forEach", "push", "pop", "splice", "slice", "join", "sort", "reverse", "reduce", "reduceRight", "keys", "values", "entries", "hasOwnProperty", "indexOf", "lastIndexOf", "find", "findIndex", "some", "every", "replace", "split", "trim", "toLowerCase", "toUpperCase", "toString", "valueOf", "concat", "flat", "flatMap", "at", "shift", "unshift", "length", "delete"]);
const actualByRoot = {}; // root -> Set(路径)
const allPaths = new Set();
const dynamicPrefixes = new Set(); // ['<prefix>' + ...] 拼接访问的前缀（键名 = 前缀 + 运行时变量）
const enumValues = new Set();      // 数据文件里的字符串取值（用于动态键"数据侧"闭合校验）
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
/* JSON 数据文件：收集全部短字符串取值，作为动态键"数据侧枚举" */
function harvestEnum(jsonText) {
  const re = /"\s*:\s*"([A-Za-z0-9_-]{2,40})"/g;
  let m;
  while ((m = re.exec(jsonText)) !== null) { enumValues.add(m[1]); }
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
        if (path.extname(en.name).toLowerCase() === ".json") { harvestEnum(txt); }
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
        /* 模板字符串拼接：`${x}-suffix` 形式的后缀常量同样构成动态键 */
        const tplRe = /\$\{[^}]+\}([A-Za-z0-9_-]{2,})`/g;
        while ((m = tplRe.exec(txt)) !== null) { enumValues.add(m[1]); }
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

/* ---------- 3. 比对（带证据分级） ---------- */
const declaredRoots = new Set(declared.map(p => p.split(".")[0]));
const missing = [];   // 声明了但源码没出现（已附判定）
const extra = [];     // 声明 root 下源码有、声明没有
const verdictCount = {};
const prefixList = Array.from(dynamicPrefixes);

for (const d of declared) {
  if (allPaths.has(d)) { continue; }
  const root = d.split(".")[0];
  const dyn = kk.dynamicClosure(d, prefixList, enumValues);
  const cands = kk.findCandidates(d, Array.from(allPaths));
  const verdict = kk.classifyEvidence({
    vp: d,
    hasLiteral: false,        // 已确认未字面命中
    hasConcat: false,         // 连写命中会进 allPaths，故此处为 false
    ownerRelocated: false,    // 属主归位由 resolve_missing 深扫负责
    leafDefined: false,       // 结构定义由 resolve_missing 深扫负责
    dyn,
    stringNear: false,        // 字符串邻近证据由 resolve_missing 深扫负责
    stringFar: false,
    rootInSource: !!actualByRoot[root]
  });
  verdictCount[verdict.verdict] = (verdictCount[verdict.verdict] || 0) + 1;
  missing.push({ vp: d, verdict: verdict.verdict, confidence: verdict.confidence, why: verdict.why, dyn, candidates: cands });
}
for (const root of declaredRoots) {
  if (!actualByRoot[root]) { continue; }
  for (const p of actualByRoot[root]) {
    if (!declared.includes(p)) { extra.push(p); }
  }
}

/* 覆盖率：字面命中即为"字面覆盖"；加上分级判定后的"可判定存活"另算 */
const literalAlive = declared.length - missing.length;
const aliveEntries = declared.map((d) => {
  const m = missing.find((x) => x.vp === d);
  return { verdict: m ? (m.verdict === kk.KEEP_DYNAMIC ? kk.KEEP_DYNAMIC : kk.WEAK) : kk.KEEP };
});
const cov = kk.coverage(aliveEntries);

/* ---------- 4. JSON 输出 ---------- */
if (JSON_MODE) {
  console.log(JSON.stringify({
    adapter: MOD_ID,
    srcDir: MOD_SRC,
    declared: declared.length,
    scannedPaths: allPaths.size,
    roots: Object.keys(actualByRoot).length,
    literalAlive,
    aliveAfterGrade: cov.alive,
    coveragePct: cov.pct,
    dynamicPrefixes: prefixList,
    enumValues: enumValues.size,
    missing,
    extra
  }, null, 2));
  process.exit(0);
}

/* ---------- 5. 报告 ---------- */
console.log("\n===== 核对报告：适配器 " + MOD_ID + " vs " + MOD_SRC + " =====");
console.log("源码扫描：V 访问路径 " + allPaths.size + " 条，涉及根 " + Object.keys(actualByRoot).length + " 个，数据枚举值 " + enumValues.size + " 个");
console.log("\n[1] 声明缺失（源码未字面出现 —— 已按证据分级，不再一律「需人工确认」）");
if (!missing.length) { console.log("  无 ✓"); }
missing.forEach((x) => {
  console.log("  ✗ " + x.vp + "   [" + x.verdict + "]");
  console.log("     " + x.why);
  if (x.candidates.length) {
    console.log("     候选：" + x.candidates.map((c) => c.path + " (" + c.reason + " " + c.score + ")").join(" / "));
  }
});
console.log("\n[2] 新增候选（源码有、适配器未声明 —— 模组新增字段，考虑补声明）");
if (!extra.length) { console.log("  无 ✓"); }
else {
  extra.forEach(p => console.log("  + " + p));
  console.log("  共 " + extra.length + " 条（部分可能是非状态瞬态变量，需人工甄别）");
}
console.log("\n[3] 覆盖统计");
console.log("  字面覆盖 " + literalAlive + "/" + declared.length + "（" + (declared.length ? Math.round(literalAlive / declared.length * 100) : 100) + "%）");
console.log("  分级后存活 " + cov.alive + "/" + declared.length + "（" + cov.pct + "%，含动态键闭合）");
console.log("  分级分布：" + Object.keys(verdictCount).map((v) => v + "=" + verdictCount[v]).join("  "));
console.log("\n[注] 属主归位（this.state 别名）、结构定义、字符串邻近这三类深证据由 resolve_missing.js 负责；");
console.log("     SOURCE_MISMATCH 表示该键的根在本源零出现——大概率该键由框架/其它模组维护，换源核对而不是删声明。");
console.log("\n[4] 源码中声明根之外的其它根（模组新增命名空间，仅提示）");
const otherRoots = Object.keys(actualByRoot).filter(r => !declaredRoots.has(r)).slice(0, 30);
console.log("  " + (otherRoots.length ? otherRoots.join(", ") : "无"));
console.log("\n[5] 动态键拼接前缀（['<prefix>' + var] 形态；键名=前缀+运行时变量，需数据侧枚举值闭合才算存活）");
console.log("  " + (prefixList.length ? prefixList.join(", ") : "无"));
