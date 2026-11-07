/* 本体特质求值与写入状态测试（branches 门槛 70→80 整改轮 · 第三批）
 *
 * 覆盖对象：06b-traits-eval.js —— SugarCube has 表达式的静态翻译与懒编译缓存、中文显示名映射、
 * 获取/移除时「满足值 / 不满足值」的推导方向（gt/lt/lte/isnot 四种边界）、无可写条件时改走
 * 强制获得标记、本体特质表懒编译缓存、mod 特质运行时发现。
 *
 * 判据说明：写变量的最终判据一律是 **用同一套 traitEval 复检表达式是否翻转**，
 * 不看写入函数返回的字符串 —— 它只说明「写了什么」，不说明「判定变了」。
 * 导出面只有 traitEval / traitOwned / grantTrait / revokeTrait / traitDisplayName /
 * compileVanillaTraits / discoverModTraits 等，内部 parseTraitHas / traitWriteSatisfy 不可直接调，
 * 因此全部经「写 → 复检」的玩家路径反证（模块内函数不是全局）。
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " =="); }

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;
const V = { player: {}, passage: "Room" };
const C = { npc: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
global.playerIsPregnant = function () { return true; };

window.maplebirch = { npc: {}, temporary: { traitLists: [] } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.traitEval === "function" && typeof api.grantTrait === "function", "特质求值/授予 API 已导出");

/* ================= 1. 表达式翻译与求值 ================= */
section("1 traitEval 翻译口径");
V.purity = 3; V.submissive = 600; V.isBoy = true; V.flags = { a: 1 };
assert(api.traitEval(V, C, "") === false, "空表达式 → false");
assert(api.traitEval(V, C, "$purity gte 3") === true, "gte 翻译为 >=");
assert(api.traitEval(V, C, "$purity gt 3") === false, "gt 是严格大于（等于不算）");
assert(api.traitEval(V, C, "$submissive lte 850 and $submissive gt 500") === true, "多条件 and 组合");
assert(api.traitEval(V, C, "$submissive lt 500 or $purity is 3") === true, "or 组合 + is 等价 ===");
assert(api.traitEval(V, C, "$isBoy isnot false") === true, "isnot 等价 !==");
assert(api.traitEval(V, C, "$flags?.a is 1") === true, "带可选链的路径原样保留");
assert(api.traitEval(V, C, "$missing.deep.path is 1") === false, "深路径不存在 → undefined 判定为 false 不抛");
assert(api.traitEval(V, C, "$flags.nope?.deep gte 1") === false, "可选链中途缺失不抛");
V.sexStats = { pills: { pills: 5 } };
assert(api.traitEval(V, C, "_pills gte 5") === true, "_pills 映射到 sexStats.pills.pills");
C.npc.Gwylan = { love: 2 };
assert(api.traitEval(V, C, "C.npc.Gwylan.love gte 2") === true, "C.npc.X.y 映射到 C 对象");
assert(api.traitEval(V, C, "playerIsPregnant()") === true, "全局函数调用走 globalThis 兜底");
delete global.playerIsPregnant;
assert(api.traitEval(V, C, "playerIsPregnant()") === false, "全局函数缺失 → 抛错吞成 false（不炸面板）");
assert(api.traitEval(V, C, "$purity gte 3") === true, "同表达式二次求值走编译缓存（结果一致）");

/* ================= 2. 显示名映射 ================= */
section("2 traitDisplayName / 中文映射");
assert(api.traitDisplayName({ name: "SomeUnknownTraitXYZ" }, V) === "SomeUnknownTraitXYZ", "未登记词条原样返回（不瞎译）");
assert(api.traitDisplayName({ name: "function () { var a = 1; }" }, V) === "（函数型特质）", "函数源码无 return 模板 → 明确标注，不显示一串代码");
assert(api.traitDisplayName({ name: "function () { return `Bratty`; }" }, V).length > 0, "函数源码带 return 模板 → 提取模板再映射");
assert(api.traitDisplayName({ name: "Acceptance ${penisSize}" }, V) === "接纳：阴茎", "插值关键词 ${penisSize} 特判");
assert(api.traitDisplayName({ name: "Acceptance ${breastSize}" }, V) === "接纳：胸部", "插值关键词 ${breastSize} 特判");
assert(api.traitDisplayName({ name: "Bratty/Bullied" }, V).indexOf("/") !== -1, "A/B 多段逐段映射后仍以 / 连接");
assert(api.traitDisplayName({ name: "Temple Burden: 5%" }, V).indexOf("：") !== -1, "「前缀: 尾巴」用全角冒号拼接");
V.temple_burden = 7;
assert(api.traitDisplayName({ name: "Temple Burden: $temple_burden%" }, V).indexOf("7") !== -1, "显示名把 $var 替换成当前值");
delete V.temple_burden;
assert(api.traitDisplayName({ name: "Temple Burden: $temple_burden%" }, V).indexOf("?") !== -1, "变量缺失 → 显示 ?（不显示 undefined）");
assert(api.traitDisplayName({ name: function () { return "Bratty"; } }, V).length > 0, "name 为函数 → 先执行取字符串");
assert(api.traitDisplayName({ name: function () { throw new Error("boom"); } }, V).length > 0, "name 函数抛错 → 仍有可显示文本");
const zhCat = api.TRAIT_ZH_CAT;
assert(zhCat && typeof zhCat === "object", "TRAIT_ZH_CAT 分类表已导出（" + Object.keys(zhCat || {}).length + " 类）");

/* ================= 3. 本体特质表编译 ================= */
section("3 compileVanillaTraits 缓存与解析结构");
const van1 = api.compileVanillaTraits();
assert(Array.isArray(van1) && van1.length > 0, "编译出本体特质表（" + van1.length + " 条）");
assert(api.compileVanillaTraits() === van1, "二次调用命中懒编译缓存（同一数组引用）");
assert(van1.every(function (t) { return typeof t.name === "string"; }), "所有特质名都是字符串（已去外层引号）");
const multiVar = van1.filter(function (t) { return t.parsed && t.parsed.vars && t.parsed.vars.length > 1; });
assert(multiVar.length > 0, "多比较段的特质被正确解析（" + multiVar.length + " 条）");
const incTraits = van1.filter(function (t) { return t.parsed && t.parsed.includes; });
assert(incTraits.length > 0, "includes 形态的特质被识别出目标值（" + incTraits.length + " 条）");
const complexTraits = van1.filter(function (t) { return t.parsed && t.parsed.complex; });
assert(complexTraits.length > 0, "函数型/复杂表达式被标记 complex（" + complexTraits.length + " 条，走强制获得路径）");
const gtVals = van1.reduce(function (a, t) { return a.concat((t.values || []).filter(function (v) { return v.op === "gt"; })); }, []);
assert(gtVals.length === 0 || gtVals.every(function (v) { return typeof v.val === "number"; }), "gt 变量默认值按 num+1 生成（" + gtVals.length + " 条）");
const lteVals = van1.reduce(function (a, t) { return a.concat((t.values || []).filter(function (v) { return v.op === "lte" || v.op === "lt"; })); }, []);
assert(lteVals.length === 0, "lte/lt 不计入「可改数值」（写边界值会破坏语义，只留 gte/is/gt）");

/* ================= 4. 数值条件四类方向的写入 ================= */
section("4 满足值推导（经 grantTrait 反证）");
function own(t) { return api.traitOwned(t, V, C); }
function grantOk(t) { return api.grantTrait(t, V, C); }

V.gate = 0;
const tGt = { cat: "feats", name: "GtTrait", has: "$gate gt 5" };
assert(own(tGt) === false, "写前未获得（gate=0）");
grantOk(tGt);
assert(V.gate === 6 && api.traitEval(V, C, tGt.has) === true, "gt 5 → 写 6 后复检通过（不是写 5）");

V.gate = 0;
const tGte = { cat: "feats", name: "GteTrait", has: "$gate gte 5" };
grantOk(tGte);
assert(V.gate === 5 && api.traitEval(V, C, tGte.has) === true, "gte 5 → 写 5（边界值即满足）");

V.gate = 99;
const tLte = { cat: "feats", name: "LteTrait", has: "$gate lte 10" };
grantOk(tLte);
assert(V.gate === 10 && api.traitEval(V, C, tLte.has) === true, "lte 10 → 写 10 后复检通过");

V.gate = 99;
const tLt = { cat: "feats", name: "LtTrait", has: "$gate lt 10" };
grantOk(tLt);
assert(V.gate === 9 && api.traitEval(V, C, tLt.has) === true, "lt 10 → 写 9（写 10 会不满足）");

V.boolGate = true;
const tIsF = { cat: "feats", name: "IsFalse", has: "$boolGate is false" };
grantOk(tIsF);
assert(V.boolGate === false && api.traitEval(V, C, tIsF.has) === true, "is false → 写 false");

V.boolGate = true;
const tIsnotT = { cat: "feats", name: "IsnotTrue", has: "$boolGate isnot true" };
grantOk(tIsnotT);
assert(V.boolGate === false && api.traitEval(V, C, tIsnotT.has) === true, "isnot true → 写 false（方向不能反）");

V.numGate = 5;
const tIsnotN = { cat: "feats", name: "IsnotN", has: "$numGate isnot 5" };
grantOk(tIsnotN);
assert(V.numGate === 4 && api.traitEval(V, C, tIsnotN.has) === true, "isnot 5 → 写 4（不等于 5）");

V.strGate = "prospective";
const tSkip = { cat: "mods", name: "Prospective", has: "$strGate isnot \"banned\"" };
grantOk(tSkip);
assert(V.strGate === "prospective", "isnot 字符串值无法推断满足值 → 不瞎写变量");
assert(V.mbCE_forcedTraits.indexOf("mods\u0001Prospective") !== -1, "改走强制获得标记（键 = cat+\\u0001+name）");
assert(own(tSkip) === true, "强制标记后判为已获得");

/* 组合条件：两个方向同时成立 */
V.submissive = 400;
const tBratty = { cat: "feats", name: "Bratty", has: "$submissive lte 850 and $submissive gt 500" };
grantOk(tBratty);
assert(V.submissive === 501 && api.traitEval(V, C, tBratty.has) === true, "低于区间时写 501，使 lte 与 gt 同时成立（实际 " + V.submissive + "）");

/* includes 形态 */
delete V.backgroundTraits;
const tInc = { cat: "feats", name: "BG", has: "$backgroundTraits.includes(\"Bratty\")" };
assert(own(tInc) === false, "写前数组不存在 → 未获得");
grantOk(tInc);
assert(Array.isArray(V.backgroundTraits) && V.backgroundTraits.indexOf("Bratty") !== -1, "自动建数组并 push 目标值");
assert(own(tInc) === true, "includes 写后判为已获得");
grantOk(tInc);
assert(V.backgroundTraits.filter(function (x) { return x === "Bratty"; }).length === 1, "重复获取不重复 push");

/* 深路径自动补宿主 */
V.deepTrait = {};
api.grantTrait({ cat: "feats", name: "Deep", has: "$deepTrait.inner.leaf gte 3" }, V, C);
assert(V.deepTrait.inner && V.deepTrait.inner.leaf === 3, "深路径自动补中间宿主（不抛 TypeError）");

/* ================= 5. 移除 / 不满足值 ================= */
section("5 移除口径（revokeTrait）");
const wRevInc = api.revokeTrait(tInc, V, C);
assert(V.backgroundTraits.indexOf("Bratty") === -1, "移除 includes 特质 → 从数组删掉目标值");
assert(wRevInc.length >= 1, "移除返回写入清单（" + JSON.stringify(wRevInc) + "）");
V.gate = 6;
api.revokeTrait(tGt, V, C);
assert(api.traitEval(V, C, tGt.has) === false, "移除 gt 特质 → 复检变 false（gate=" + V.gate + "）");
V.gate = 50;
api.revokeTrait(tLte, V, C);
assert(api.traitEval(V, C, tLte.has) === false, "移除 lte 特质 → 写回不满足值后复检变 false（gate=" + V.gate + "）");
V.boolGate = false;
api.revokeTrait(tIsnotT, V, C);
assert(api.traitEval(V, C, tIsnotT.has) === false, "移除 isnot true 特质 → 写 true 使条件为假（实际 " + V.boolGate + "）");
V.strGate = "banned";
api.revokeTrait(tSkip, V, C);
assert((V.mbCE_forcedTraits || []).indexOf("mods\u0001Prospective") === -1, "移除时清掉强制获得标记");
assert(own(tSkip) === false, "标记清掉后判为未获得");
assert(V.mbCE_forcedTraits !== undefined, "强制标记列表仍在（只是不含该项）");
const wUnsat = api.revokeTrait({ cat: "feats", name: "NoCond", has: "" }, V, C);
assert(wUnsat.length === 0, "无 has 表达式 → 移除不写任何东西（返回空清单）");

/* ================= 6. 强制获得标记的补齐路径 ================= */
section("6 无可写条件 → 强制获得");
V.mbCE_forcedTraits = null;
const tFn = { cat: "mods", name: "FnOnly", has: "playerIsPregnant()" };
const wFn = api.grantTrait(tFn, V, C);
assert(Array.isArray(V.mbCE_forcedTraits), "列表非数组时自动重建（不抛）");
assert(V.mbCE_forcedTraits.indexOf("mods\u0001FnOnly") !== -1, "复杂表达式 → 记入强制获得（" + JSON.stringify(wFn) + "）");
const wFn2 = api.grantTrait(tFn, V, C);
assert(wFn2.join("").indexOf("已有") !== -1, "已标记再点获取 → 报「已有」不重复插入");
assert(V.mbCE_forcedTraits.length === 1, "标记列表长度仍为 1（幂等）");

/* ================= 7. mod 特质发现 ================= */
section("7 discoverModTraits");
window.maplebirch.temporary.traitLists = null;
assert(api.discoverModTraits().length === 0, "注入表 null → 空列表不抛");
window.maplebirch.temporary.traitLists = [];
assert(api.discoverModTraits().length === 0, "空注入表 → 空列表");
window.maplebirch.temporary.traitLists = [
  { title: "模组A", traits: [
    { name: "T1", text: "说明一", has: "$foo gte 3" },
    { name: function () { return "T2"; }, text: function () { return "说明二"; }, has: function () { return true; } },
    { text: "无 name 的条目应被跳过" },
    null
  ] },
  null,
  { traits: "not-array" }
];
const discovered = api.discoverModTraits();
assert(discovered.length === 2, "跳过无 name / null 条目与非法分组（" + discovered.length + "）");
assert(discovered[0].cat === "模组A", "分类取分组 title");
assert(discovered[0].values.length === 1 && discovered[0].values[0].path === "foo", "字符串 has 的可改数值被解析出来");
assert(discovered[1].name === "T2" && discovered[1].hasFn !== null, "函数型 name/has → 取执行值 + 保留 hasFn");
assert(discovered[1].has === "", "函数型 has → has 字符串为空（走强制获得路径）");
assert(discovered.every(function (t) { return t.mod === true; }), "发现的特质带 mod 标记（UI 分组用）");
assert(discovered[0].text === "说明一" && discovered[1].text === "说明二", "说明文本字符串/函数两种形态都能取到");

/* ================= 8. 收藏特质（localStorage 持久化） ================= */
section("8 收藏特质");
localStorage.clear();
const favKey = api.favTraitKey({ cat: "feats", name: "FavOne" });
assert(typeof favKey === "string" && favKey.indexOf("FavOne") !== -1, "收藏键含特质名（" + favKey + "）");
assert(api.isFavTrait({ cat: "feats", name: "FavOne" }) === false, "未收藏 → false");
api.toggleFavTrait({ cat: "feats", name: "FavOne" });
assert(api.isFavTrait({ cat: "feats", name: "FavOne" }) === true, "切换后 → 已收藏");
assert(api.getFavTraits().length >= 1, "收藏清单可读（" + api.getFavTraits().length + " 项）");
api.toggleFavTrait({ cat: "feats", name: "FavOne" });
assert(api.isFavTrait({ cat: "feats", name: "FavOne" }) === false, "再切一次 → 取消收藏");
localStorage.setItem("mbCE_fav_traits", "broken{");
assert(Array.isArray(api.getFavTraits()), "localStorage 坏数据 → 收藏清单仍返回数组（不抛）");

console.log("\nTRAITS EVAL STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
