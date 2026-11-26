/* v2.2.8 回退中心「其余键」覆盖测试（TDD 先行）：
   用户报「回退中心又变成键名、变成英文了」，上一轮只补了 vcore 12 条 + yanling 47 条；
   本测试锁定三处新发现的裸键来源，全部来自源码一手实参：
     · maint:<path>：03b-global-maint.js L127-130 farm.beasts.*、L132 farm.aggro、
       L226-229 avery_mansion.<10 房间> + days_absent —— 词表原先只有 10 条，这些全落裸点号路径
     · vcore:<id>：07t know-npc / 07r gwylan-wait / 07s sam-away 四个常量与函数实参
     · vcore:food-<key>（07p L? mbCEVanillaTrace("food-" + key)）、
       vcore:antique-<key>（07l-special mbCEVanillaTrace("antique-" + key)）
     · cheat:global:unlockClothes / unlockRecipes（03a-global-batch.js L148/L173）
       与 cheat:fertility-expansion:fert_child_{loc,adult,skills,innate}_<id>（04a-15 / 04a-15b）
   原版语义取证：farm.beasts.* = Steeds/Pigs/Cattle/Dogs' Respect（HTML 305720-305723，范围 -30..30）；
     farm.aggro = Remy's Encroachment（HTML 305735）。
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

const setupObj = {
  clothes: {}, clothes_all_slots: [], wardrobeSkip: [],
  foodstuff: { apple: { name: "apple" }, salmon: { name: "salmon" } },
  museumAntiques: { antiques: {} }
};
global.setup = setupObj;
global.getSetup = function () { return setupObj; };

const V = { player: {}, passage: "Global", location: "bedroom", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Global" };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Global"; };
global.localStorage = window.localStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api === "object" && api, "API 已挂载 setup.mbStageCE");
assert(typeof api.mbCEUndoItemName === "function", "mbCEUndoItemName 已导出");

function nm(k, rec) { try { return String(api.mbCEUndoItemName(k, rec || {})); } catch (e) { return "<ERR:" + e.message + ">"; } }
/* 「不是裸英文键」判据：结果里不得出现与 key 尾段完全相同的 ASCII 段 */
function noRawAsciiTail(name, key) {
  const tail = key.split(":").slice(-1)[0];
  return name.indexOf(tail) === -1 || /[\u4e00-\u9fa5]/.test(name);
}

/* ================= A 庄园维护写入（maint） ================= */
section("A maint 农场与庄园维护路径");
const maintCases = [
  ["maint:farm.beasts.horses", "马"],
  ["maint:farm.beasts.pigs", "猪"],
  ["maint:farm.beasts.cattle", "牛"],
  ["maint:farm.beasts.dogs", "狗"],
  ["maint:farm.aggro", "雷米"],
  ["maint:avery_mansion.pool", "泳池"],
  ["maint:avery_mansion.kitchen", "厨房"],
  ["maint:avery_mansion.lounge", "起居"],
  ["maint:avery_mansion.display", "陈列"],
  ["maint:avery_mansion.bedroom", "卧室"],
  ["maint:avery_mansion.bathroom", "浴室"],
  ["maint:avery_mansion.dining", "餐厅"],
  ["maint:avery_mansion.garden", "花园"],
  ["maint:avery_mansion.study", "书房"],
  ["maint:avery_mansion.garage", "车库"],
  ["maint:avery_mansion.days_absent", "天数"]
];
maintCases.forEach(function (c) {
  const n = nm(c[0]);
  assert(noRawAsciiTail(n, c[0]) && n.indexOf(c[1]) > -1, c[0] + " → " + n);
});
/* 既有 10 条不得被覆盖 */
assert(nm("maint:temple_quarters").indexOf("神殿") > -1, "既有 maint:temple_quarters 仍为中文");
assert(nm("maint:edengarden").indexOf("伊甸") > -1, "既有 maint:edengarden 仍为中文");
/* 未知路径仍要有中文前缀，不能回裸英文 */
const unkM = nm("maint:some.unknown.path");
assert(/[\u4e00-\u9fa5]/.test(unkM), "未知 maint 路径有中文兜底 → " + unkM);

/* ================= B 原版档案新增条目（vcore） ================= */
section("B vcore 认识/格威岚等待/Sam 驱逐");
const vcoreCases = [
  ["vcore:know-npc", "认识"],
  ["vcore:gwylan-wait", "格威岚"],
  ["vcore:sam-away", "Sam"]
];
vcoreCases.forEach(function (c) {
  const n = nm(c[0]);
  assert(noRawAsciiTail(n, c[0]) && n.indexOf(c[1]) > -1, c[0] + " → " + n);
});

/* ================= C 食物 / 单件古董（vcore 前缀） ================= */
section("C vcore 前缀条目");
const food = nm("vcore:food-salmon");
assert(food.indexOf("食物") > -1 && food.indexOf("鲑鱼") > -1, "vcore:food-salmon → " + food);
const food2 = nm("vcore:food-apple");
assert(food2.indexOf("食物") > -1, "vcore:food-apple（无译名回落原名）→ " + food2);
const ant = nm("vcore:antique-antiquegoldchastitybelt");
assert(ant.indexOf("古董") > -1 && ant.indexOf("黄金贞操带") > -1, "vcore:antique-<特殊件> → " + ant);

/* ================= D 作弊留痕（cheat） ================= */
section("D cheat 全局批次与孩子留痕");
const cg1 = nm("cheat:global:unlockClothes");
assert(cg1.indexOf("服装") > -1, "cheat:global:unlockClothes → " + cg1);
const cg2 = nm("cheat:global:unlockRecipes");
assert(cg2.indexOf("食谱") > -1, "cheat:global:unlockRecipes → " + cg2);
const fc = nm("cheat:fertility-expansion:fert_child_loc_12");
assert(/[\u4e00-\u9fa5]/.test(fc) && fc.indexOf("eden.children") === -1, "fert_child_loc_12 → " + fc);
const fa = nm("cheat:fertility-expansion:fert_child_skills_9");
assert(/[\u4e00-\u9fa5]/.test(fa) && fa.indexOf("eden.children") === -1, "fert_child_skills_9 → " + fa);

/* ================= E 回归：既有词表仍命中 ================= */
section("E 既有键回归");
assert(nm("vcore:crime").indexOf("犯罪") > -1, "vcore:crime 仍为中文");
assert(nm("vcore:rent-money").indexOf("租金") > -1, "vcore:rent-money 仍为中文");
assert(nm("yanling:leaf_suit").indexOf("枝叶") > -1, "yanling:leaf_suit 仍为中文");
assert(nm("yanling:toggle_noCross").indexOf("异装") > -1, "yanling:toggle_noCross 仍为中文");
assert(nm("yanling:toggle_something").indexOf("言灵开关") > -1, "未登记 toggle_* 有中文前缀");
const unkV = nm("vcore:brand-new-key");
assert(unkV.indexOf("原版档案") > -1, "未知 vcore 落「原版档案 · 键名」");

console.log("\n==== 结果：" + passes + " PASS / " + failures + " FAIL ====");
process.exit(failures ? 1 : 0);
