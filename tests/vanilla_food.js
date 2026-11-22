/* 原版食物库存 / 鱼获直写（07p-vanilla-food.js）测试 — 2026-11-22 社区需求轮
 *
 * 覆盖六组：
 *   1. 数据识别（键集 / 12 鱼 / 统计口径）
 *   2. 单键写入（对象不存在时补 {amount:0} / dish 补 knows_recipe:false / 留痕 before）
 *   3. 参数拒收（非数 / 越界 / 未知键）
 *   4. 批量写入（12 鱼 / 全食材，各只留一条留痕）
 *   5. 回退（vcore → ExtUndo → EconUndo → MB_CE_ECON_UNDO["food"] 全链）
 *   6. UI 渲染 + 宿主缺失拒绝
 *
 * 原版事实来源：DoL 0.5.12.13 单文件 HTML 实证（setup.foodstuff / V.foodstuff[*].amount）。
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
window.matchMedia = function (q) {
  return {
    matches: false, media: q, onchange: null,
    addListener: function () {}, removeListener: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () { return false; }
  };
};

/* ---------- 原版数据集（照 HTML 实测结构裁剪：12 鱼 category=seafood + 代表食材 + 1 道料理） ---------- */
const FISH_KEYS = ["haddock", "salmon", "trout", "herring", "whiting", "mackerel", "flounder", "bass", "roach", "perch", "chub", "grayling"];
const FOODSTUFF = {};
FISH_KEYS.forEach(function (k, i) {
  FOODSTUFF[k] = { index: 73 + i, name: k, singular: k, plural: k, icon: k + ".png", category: "seafood", shop: { sell_price: 600 } };
});
FOODSTUFF.truffle = { index: 25, name: "truffle", singular: "truffle", plural: "truffles", icon: "truffle.png", category: "mushroom", shop: { sell_price: 800 } };
FOODSTUFF.bottle_of_milk = { index: 26, name: "bottle of milk", singular: "bottle of milk", plural: "bottles of milk", category: "produce", shop: { sell_price: 100 } };
FOODSTUFF.chicken_egg = { index: 27, name: "chicken egg", category: "produce", shop: { sell_price: 40 } };
FOODSTUFF.red_rose = { index: 0, name: "red rose", category: "flower", shop: { sell_price: 350 } };
FOODSTUFF.honeyed_pork = { index: 74, name: "honeyed pork", category: "dish", recipe: { recipe_name: "honeyed pork", difficulty: 2 } };

const V = { player: {}, passage: "Room", mbCE_wrote: {}, mbCE_queue: [], foodstuff: {}, fishing: { record: {} } };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {
  foodstuff: FOODSTUFF,
  fishing: { lootTables: { fish: FISH_KEYS.reduce(function (o, k) { o[k] = { maxSize: 50 }; return o; }, {}) } }
};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
const SOURCE = fs.readFileSync(jsPath, "utf8");
try {
  eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
} catch (e) {
  console.error("FAIL: 产物 eval 抛错 " + e.message);
  process.exit(1);
}
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

function guard(name, fn) {
  if (typeof api[name] !== "function") { assert(false, "缺少导出 " + name + "（实现未接线）"); return null; }
  return fn();
}

try {
  assert(true, "0.1 产物已加载，setup.mbStageCE 可用");

  section("1. 数据识别");
  const keys = guard("vanillaFoodKeys", function () { return api.vanillaFoodKeys(); });
  assert(keys && keys.length === 17, "1.1 键集与 setup.foodstuff 一致（12 鱼 + 5 项其他 = 17）");
  const fishKeys = guard("vanillaFoodFishKeys", function () { return api.vanillaFoodFishKeys(); });
  assert(fishKeys && fishKeys.length === 12, "1.2 鱼键识别恰 12 项（category=seafood）");
  const st0 = guard("vanillaFoodStats", function () { return api.vanillaFoodStats(); });
  assert(st0 && st0.fishAll === 12 && st0.keys === 17, "1.3 统计：fishAll=12 / keys=17");
  assert(st0 && st0.fishTotal === 0 && st0.otherTotal === 0 && st0.fishKeys === 0, "1.4 空库存统计全 0");

  section("2. 单键写入");
  V.foodstuff.haddock = { amount: 3 };
  const r1 = guard("vanillaFoodSet", function () { return api.vanillaFoodSet("haddock", "10"); });
  assert(r1 && r1.ok, "2.1 写入 haddock=10 成功");
  assert(V.foodstuff.haddock.amount === 10, "2.2 值落到 V.foodstuff.haddock.amount");
  const tr1 = V.mbCE_wrote["vcore:food-haddock"];
  assert(!!tr1 && tr1.type === "vcore" && tr1.before.kind === "food", "2.3 留痕 type=vcore / kind=food");
  assert(tr1 && tr1.before.amounts.haddock === 3 && tr1.before.exists.haddock === true, "2.4 before 记首次写入前值（3，且对象原本存在）");
  /* 第二次写不覆盖 before（首次快照语义） */
  api.vanillaFoodSet("haddock", "99");
  assert(V.mbCE_wrote["vcore:food-haddock"].before.amounts.haddock === 3, "2.5 二次写入保留首次 before=3");

  /* 对象不存在 → 补 {amount:0}；dish 补 knows_recipe:false */
  const r2 = api.vanillaFoodSet("salmon", "7");
  assert(r2 && r2.ok && V.foodstuff.salmon.amount === 7, "2.6 缺对象自动补 amount=7");
  assert(V.mbCE_wrote["vcore:food-salmon"].before.exists.salmon === false, "2.7 补对象的 before.exists=false");
  const r3 = api.vanillaFoodSet("honeyed_pork", "2");
  assert(r3 && r3.ok && V.foodstuff.honeyed_pork.knows_recipe === false, "2.8 料理类补 knows_recipe=false");
  assert(V.foodstuff.truffle === undefined, "2.9 未写入的键不被顺手创建");

  section("3. 参数拒收");
  const r4 = api.vanillaFoodSet("trout", "abc");
  assert(!r4.ok && V.foodstuff.trout === undefined, "3.1 非数拒收（trout 未创建）");
  const r5 = api.vanillaFoodSet("trout", "-5");
  assert(!r5.ok, "3.2 负数拒收");
  const r6 = api.vanillaFoodSet("trout", "1000000");
  assert(!r6.ok, "3.3 超 999999 拒收");
  const r7 = api.vanillaFoodSet("grape", "5");
  assert(!r7.ok, "3.4 未知键拒收（不在 setup.foodstuff）");

  section("4. 批量写入");
  const before = { haddock: V.foodstuff.haddock.amount, salmon: V.foodstuff.salmon.amount };
  const r8 = guard("vanillaFoodAddFish", function () { return api.vanillaFoodAddFish(10); });
  assert(r8 && r8.ok, "4.1 鱼获 +10 成功");
  assert(V.foodstuff.haddock.amount === before.haddock + 10, "4.2 haddock 基于现值累加");
  assert(V.foodstuff.salmon.amount === before.salmon + 10, "4.3 salmon 基于现值累加");
  assert(FISH_KEYS.every(function (k) { return V.foodstuff[k].amount >= 10; }), "4.4 12 鱼全部有值");
  assert(!!V.mbCE_wrote["vcore:food-fish"], "4.5 批量只留一条 food-fish 留痕");
  const r9 = api.vanillaFoodAddAll(50);
  assert(r9 && r9.ok && !!V.mbCE_wrote["vcore:food-all"], "4.6 全食材 +50 且一条 food-all 留痕");
  assert(V.foodstuff.truffle.amount === 50 && V.foodstuff.red_rose.amount === 50, "4.7 非鱼食材同样写到位");

  section("5. 回退（vcore → ExtUndo → EconUndo → food）");
  const fishBefore = V.mbCE_wrote["vcore:food-fish"].before;
  const ru = guard("vanillaFoodUndo", function () { return api.vanillaFoodUndo("food-fish"); });
  assert(ru && ru.ok, "5.1 回退 food-fish 成功");
  assert(FISH_KEYS.every(function (k) {
    if (fishBefore.exists && fishBefore.exists[k]) { return V.foodstuff[k] && V.foodstuff[k].amount === fishBefore.amounts[k]; }
    return V.foodstuff[k] === undefined || V.foodstuff[k].amount === 0;
  }), "5.2 12 鱼逐键还原到首次写入前");
  assert(!V.mbCE_wrote["vcore:food-fish"], "5.3 回退后留痕删除");
  const ru2 = api.vanillaFoodUndo("food-haddock");
  assert(ru2 && ru2.ok && V.foodstuff.haddock.amount === 3, "5.4 单键回退还原为 3（首次 before）");

  section("6. UI 与宿主缺失");
  const pane = document.createElement("div");
  document.body.appendChild(pane);
  const rr = guard("renderVanillaFood", function () { api.renderVanillaFood(pane); return true; });
  if (rr) {
    const txt = pane.textContent;
    assert(txt.indexOf("食物与鱼获") !== -1, "6.1 区块标题渲染");
    assert(pane.querySelectorAll("button").length >= 3, "6.2 至少 3 个动作按钮");
    assert(txt.indexOf("1000000") === -1 && txt.indexOf("上限") !== -1, "6.3 说明里点明原版无数量上限");
  }
  const savedSetup = global.setup;
  global.setup = {};
  try {
    const emptyKeys = api.vanillaFoodKeys();
    assert(Array.isArray(emptyKeys) && emptyKeys.length === 0, "6.4 宿主缺失时键集为空（不凭空造数据）");
    const rEmpty = api.vanillaFoodSet("haddock", "5");
    assert(!rEmpty.ok, "6.5 宿主缺失时写入拒绝");
    const pane2 = document.createElement("div");
    api.renderVanillaFood(pane2);
    assert(pane2.textContent.indexOf("未检测到") !== -1, "6.6 宿主缺失时渲染出拒绝提示");
  } finally {
    global.setup = savedSetup;
  }
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
}

console.log("\n" + (failures ? "FAILED " : "OK ") + passes + " passed, " + failures + " failed");
process.exit(failures ? 1 : 0);
