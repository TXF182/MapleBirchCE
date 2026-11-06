#!/usr/bin/env node
/* 键名核对启发式单测：node tests/test_keycheck.js
 * 覆盖：归一化 / 编辑距离 / 近似候选 / 动态键两侧闭合 / 证据分级 / 覆盖率口径。
 * 全部为纯函数断言，不读磁盘，CI 秒级完成。
 */
"use strict";
const k = require("../tools/lib/keycheck.js");

let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (info ? "  → " + info : "")); }
}

console.log("[1] 归一化与编辑距离");
ok("camel vs snake 归一化相等", k.normKey("museumCoins") === k.normKey("museum_coins"),
  k.normKey("museumCoins") + " vs " + k.normKey("museum_coins"));
ok("kebab 归一化相等", k.normKey("deadwood-willpower") === k.normKey("deadwood_willpower"));
ok("不同词不相等", k.normKey("motor") !== k.normKey("rotor"));
ok("相同串距离 0", k.levenshtein("motor", "motor") === 0);
ok("单字符替换距离 1", k.levenshtein("motor", "rotor") === 1);
ok("早停上限生效（超限返回 >max）", k.levenshtein("abcdefgh", "zyxwvuts", 2) > 2);
ok("相似度对称", Math.abs(k.similarity("motor", "rotor") - k.similarity("rotor", "motor")) < 1e-9);

console.log("[2] 近似候选");
const paths = [
  "SydneyExpansion.repair_tools.motor",
  "Transport.repair_parts.motor",
  "Transport.repair_tools.bicycle",
  "Transport.repair_tools.motors",
  "Unrelated.foo"
];
const cand = k.findCandidates("Transport.repair_tools.motor", paths);
ok("首位候选是共父段的换 root 同尾段", cand.length > 0 && cand[0].path === "SydneyExpansion.repair_tools.motor",
  cand.length ? cand[0].path : "无候选");
ok("共父段同尾段标 same-parent-tail", cand[0] && cand[0].reason === "same-parent-tail", cand[0] && cand[0].reason);
ok("不把自身列为候选", !cand.some((c) => c.path === "Transport.repair_tools.motor"));
ok("无关路径不入候选", !cand.some((c) => c.path === "Unrelated.foo"));
ok("候选分数降序", cand.every((c, i) => i === 0 || c.score <= cand[i - 1].score));

/* 噪声抑制：短词、无共同父段一律不给候选 */
const noise = k.findCandidates("VanillaPlus.deviancy.mirrors.home",
  ["Transport.commute.home", "_estate.household.home", "Orchard.farm", "timer"]);
ok("短词无共享父段 → 零候选", noise.length === 0, JSON.stringify(noise));

/* 长且唯一：允许跨命名空间的改名搬家线索 */
const uniq = k.findCandidates("VanillaPlus.divineTransformations.expungeUsed", ["SydneyExpansion.expungeUsed"]);
ok("长且唯一 → leaf-unique", uniq.length === 1 && uniq[0].reason === "leaf-unique", JSON.stringify(uniq));

const snake = k.findCandidates("Transport.repair_tools.motor", ["Transport.repairTools.motor"]);
ok("归一化变体给最高档", snake.length && snake[0].reason === "normalized-equal", snake.length ? snake[0].reason : "无");

console.log("[3] 动态键两侧闭合");
const d1 = k.dynamicClosure("featsBoosts.upgrades.deadwood-willpower", ["deadwood-"], ["willpower", "physique", "beauty"]);
ok("前缀+枚举值齐 → 闭合", d1 && d1.closed === true, JSON.stringify(d1));
ok("拆出前缀与余部", d1 && d1.prefix === "deadwood-" && d1.rest === "willpower", JSON.stringify(d1));
const d2 = k.dynamicClosure("featsBoosts.upgrades.deadwood-willpower", ["deadwood-"], ["physique"]);
ok("枚举缺该值 → 不闭合（降级 REVIEW）", d2 && d2.closed === false, JSON.stringify(d2));
const d3 = k.dynamicClosure("featsBoosts.upgrades.deadwood-willpower", ["temple_"], ["willpower"]);
ok("前缀对不上 → 无动态解释", d3 === null, JSON.stringify(d3));

console.log("[4] 证据分级");
ok("字面命中 → KEEP", k.classifyEvidence({ vp: "A.b", hasLiteral: true, rootInSource: true }).verdict === k.KEEP);
ok("属主归位 → KEEP", k.classifyEvidence({ vp: "RobinExpansion.investment.agreed", ownerRelocated: true, rootInSource: true }).verdict === k.KEEP);
ok("动态闭合 → KEEP_DYNAMIC",
  k.classifyEvidence({ vp: "featsBoosts.upgrades.deadwood-willpower", dyn: d1, rootInSource: true }).verdict === k.KEEP_DYNAMIC);
ok("根零出现 → SOURCE_MISMATCH",
  k.classifyEvidence({ vp: "featsBoosts.upgrades.deadwood-willpower", rootInSource: false }).verdict === k.SOURCE_MISMATCH);
ok("仅远处字符串 → WEAK 而非 KEEP",
  k.classifyEvidence({ vp: "MoreTransformations.raven.met", stringFar: true, rootInSource: true }).verdict === k.WEAK);
ok("邻近字符串 → REVIEW",
  k.classifyEvidence({ vp: "MoreTransformations.treasure.coins", stringNear: true, rootInSource: true }).verdict === k.REVIEW);
ok("零证据 → MISSING",
  k.classifyEvidence({ vp: "X.y", rootInSource: true }).verdict === k.MISSING);
ok("强证据优先于 SOURCE_MISMATCH",
  k.classifyEvidence({ vp: "X.y", hasLiteral: true, rootInSource: false }).verdict === k.KEEP);

console.log("[5] 覆盖率口径");
const cov = k.coverage([
  { verdict: k.KEEP }, { verdict: k.KEEP_DYNAMIC }, { verdict: k.WEAK }, { verdict: k.MISSING }
]);
ok("只算 KEEP + KEEP_DYNAMIC", cov.alive === 2 && cov.total === 4, JSON.stringify(cov));
ok("百分比取整", cov.pct === 50, String(cov.pct));

console.log("[6] 数字下标形态（farm108 温室误判 REMOVE 的回归）");
ok("bracketize 把点号数字段改写成方括号", k.bracketize("plots.farm.0.greenhouse") === "plots.farm[0].greenhouse");
ok("bracketize 覆盖多个数字段", k.bracketize("a.0.b.12") === "a[0].b[12]");
ok("bracketize 对无数字路径原样返回", k.bracketize("A.b.c") === "A.b.c");
ok("indexSegments 取出中间下标段", k.indexSegments("plots.farm.2.greenhouse").join(",") === "2");
ok("indexSegments 不把叶子数字当下标", k.indexSegments("A.b.5").length === 0);
ok("indexSegments 不把首段当下标", k.indexSegments("0.b.c").length === 0);

console.log("[7] check_key_types 判据形态回归（fixture，不依赖 _modcache）");
/* 回归对象：v2.0.0.002 扩展的三类证据判据
   ① TS 字段类型声明 ② 初始化对象字面量 ③ ?? 惰性初始化，
   以及两条已实证的误判防线：父键块隔离（repair_tools vs repair_parts）、跨父键上下文校验（Finance.bank.opened）。 */
const os = require("os"), fsm = require("fs"), pathm = require("path");
const ckt = require("../tools/check_key_types.js");
const tmpDir = fsm.mkdtempSync(pathm.join(os.tmpdir(), "mce-kt-"));
function fixture(name, body) {
  const p = pathm.join(tmpDir, name);
  fsm.writeFileSync(p, body, "utf8");
  return p;
}
const fTransport = fixture("Transport.ts",
  "class Transport {\n  public static readonly defaults = {\n    repair_tools: { bicycle: false, motor: false },\n    repair_parts: { bicycle: 0, motor: 7 }\n  };\n}\n");
ok("父键块内 number 命中（repair_parts.bicycle 不串到相邻 repair_tools）",
  ckt.collectEvidence([fTransport], "Transport.repair_parts.bicycle").got === "number",
  JSON.stringify(ckt.collectEvidence([fTransport], "Transport.repair_parts.bicycle")));
ok("父键块内 boolean 命中（repair_tools.bicycle 不串到相邻 repair_parts）",
  ckt.collectEvidence([fTransport], "Transport.repair_tools.bicycle").got === "boolean");
ok("块内非首字段也能命中（repair_parts.motor）",
  ckt.collectEvidence([fTransport], "Transport.repair_parts.motor").got === "number");
const fChoir = fixture("temple-choir.ts", "export interface TempleChoir {\n  joined: boolean;\n  singing: number;\n}\n");
ok("interface 形态 → boolean", ckt.collectEvidence([fChoir], "TempleChoir.joined").got === "boolean");
ok("interface 形态 → number", ckt.collectEvidence([fChoir], "TempleChoir.singing").got === "number");
const fFacility = fixture("facility.ts", "type Facility = {\n  capacity: number;\n  owned: boolean;\n};\n");
ok("type 形态 → number", ckt.collectEvidence([fFacility], "eden.Facility.capacity").got === "number");
ok("type 形态 → boolean", ckt.collectEvidence([fFacility], "eden.Facility.owned").got === "boolean");
const fMargin = fixture("MarginTrading.ts", "export class MarginTrading {\n  opened: number;\n}\n");
ok("跨父键不误判（Finance.bank.opened 取不到 MarginTrading 的 opened）",
  ckt.collectEvidence([fMargin], "Finance.bank.opened").got === null);
const fWraith = fixture("Wraith.twee",
  "<<set $RBR.necklace.retaken to ($RBR.necklace.retaken ?? 0) + 1>>\n");
ok("?? 惰性初始化 → number", ckt.collectEvidence([fWraith], "RBR.necklace.retaken").got === "number");
const fAssign = fixture("misc.js", "V.MoreTransformations.raven.met = true;\n");
ok("V. 前缀赋值 → boolean", ckt.collectEvidence([fAssign], "MoreTransformations.raven.met").got === "boolean");
const fNote = fixture("Note.ts", "export interface Note {\n  text: string;\n}\n");
ok("string 字段声明", ckt.collectEvidence([fNote], "x.Note.text").got === "string");
ok("含数字段路径跳过（skip-dynamic）",
  String(ckt.collectEvidence([fTransport], "plots.farm.0.greenhouse").why).indexOf("skip-dynamic") >= 0);
ok("零证据 → no-evidence", ckt.collectEvidence([fTransport], "Unknown.thing").why === "no-evidence");
ok("classifyLiteral 空数组 → array", ckt.classifyLiteral("[]") === "array");
ok("classifyLiteral 空对象 → object", ckt.classifyLiteral("{}") === "object");
ok("classifyLiteral 表达式 → null", ckt.classifyLiteral("someVar + 1") === null);
ok("classifyLiteral 带分号数字 → number", ckt.classifyLiteral("12;") === "number");
try { fsm.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* 临时目录清理失败不影响断言 */ }

console.log("[8] 全量声明类型核查（需 tools/_modcache 对照源码）");
/* 门禁语义：CONFLICT / STRICT 必须为 0；凡取证成功的键，其取证类型必须与声明类型一致。
   _modcache 缺失时 SKIP（CI 干净克隆无对照源码，不计入断言）。 */
const modcacheDir = pathm.join(__dirname, "..", "tools", "_modcache");
if (!fsm.existsSync(modcacheDir)) {
  console.log("  SKIP：缺少 tools/_modcache 对照源码，跳过全量声明类型核查");
} else {
  const { execFileSync } = require("child_process");
  const toolPath = pathm.join(__dirname, "..", "tools", "check_key_types.js");
  let raw = "";
  try {
    raw = execFileSync(process.execPath, [toolPath, "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    raw = String(e.stdout || ""); /* exit 1 时 stdout 仍有完整 JSON */
  }
  raw = raw.slice(raw.indexOf("{"));
  const rep = JSON.parse(raw);
  ok("CONFLICT 为 0（无声明类型与源码形态直接冲突）", rep.conflict === 0, String(rep.conflict));
  ok("STRICT_NUM 为 0", rep.strictNum === 0, String(rep.strictNum));
  ok("STRICT_BOOL 为 0", rep.strictBool === 0, String(rep.strictBool));
  const okItems = rep.results.filter((r) => r.verdict === "OK");
  /* 口径归一：声明侧用 SugarCube 的 `list`，取证侧 classifyLiteral 返回 `array`，二者同义 */
  const normType = (t) => (t === "array" ? "list" : t);
  for (const r of okItems) {
    ok("取证类型与声明一致 " + r.adapter + " | " + r.varPath,
      normType(r.actual) === normType(r.declared) && !!r.evidence,
      r.declared + " vs " + r.actual + " @" + r.evidence);
  }
  ok("取证条数不为 0（判据确实在工作）", okItems.length > 0, String(okItems.length));
  ok("NO_EVIDENCE 不等于全量（仍有大量键取证）",
    rep.results.filter((r) => r.verdict === "NO_EVIDENCE").length < rep.total, rep.total + " 条");
}

console.log("\n结果：通过 " + pass + "，失败 " + fail);
process.exit(fail ? 1 : 0);
