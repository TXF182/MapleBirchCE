/* 原版食物库存 / 鱼获（07p）plain 拒绝侧与钳制补测 — 覆盖率提升轮
 *
 * vanilla_food.js 已覆盖键识别 / 单键写入 / 参数拒收（非数·负数·超限·未知键）/ 批量 / 回退 / UI / 宿主缺失，
 * 本测试专打剩余 plain + 三元钳制：空串数量、无鱼种 AddFish 拒绝、负增量钳 0、超限钳 999999、
 * 回退时 $foodstuff 已不在。
 * 判据：断言「返回体 ok/message + 存档实际值」，不 mock 执行器内部。
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
  return { matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
};

const FISH_KEYS = ["haddock", "salmon", "trout", "herring", "whiting", "mackerel", "flounder", "bass", "roach", "perch", "chub", "grayling"];
const FOODSTUFF = {};
FISH_KEYS.forEach(function (k, i) {
  FOODSTUFF[k] = { index: 73 + i, name: k, singular: k, plural: k, icon: k + ".png", category: "seafood", shop: { sell_price: 600 } };
});
FOODSTUFF.truffle = { index: 25, name: "truffle", category: "mushroom", shop: { sell_price: 800 } };
FOODSTUFF.bottle_of_milk = { index: 26, name: "bottle of milk", category: "produce", shop: { sell_price: 100 } };
FOODSTUFF.chicken_egg = { index: 27, name: "chicken egg", category: "produce", shop: { sell_price: 40 } };
FOODSTUFF.red_rose = { index: 0, name: "red rose", category: "flower", shop: { sell_price: 350 } };
FOODSTUFF.honeyed_pork = { index: 74, name: "honeyed pork", category: "dish", recipe: { recipe_name: "honeyed pork", difficulty: 2 } };

const V = { player: {}, passage: "Room", mbCE_wrote: {}, mbCE_queue: [], foodstuff: {}, fishing: { record: {} } };
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = {
  foodstuff: FOODSTUFF,
  fishing: { lootTables: { fish: FISH_KEYS.reduce(function (o, k) { o[k] = { maxSize: 50 }; return o; }, {}) } }
};
global.setup = setupObj;
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
try { eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

try {
  /* ================= 1. 空串数量拒绝 ================= */
  section("1 空串数量");
  V.foodstuff = { haddock: { amount: 3 } };
  V.mbCE_wrote = {};
  let r = api.vanillaFoodSet("haddock", "");
  assert(r.ok === false && V.foodstuff.haddock.amount === 3, "空串数量 → 拒绝且不写档");

  /* ================= 2. 无鱼种 AddFish 拒绝（空 list） ================= */
  section("2 无鱼种批量拒绝");
  const savedSetup = global.setup;
  global.setup = { foodstuff: { truffle: { index: 25, name: "truffle", category: "mushroom" } } };
  r = api.vanillaFoodAddFish(10);
  assert(r.ok === false && /没有可写入/.test(r.message), "setup.foodstuff 无 seafood → AddFish 拒绝");
  global.setup = savedSetup;

  /* ================= 3. 负增量 / 超限钳制（相对写法） ================= */
  section("3 批量钳制");
  V.foodstuff = { haddock: { amount: 5 } };
  V.mbCE_wrote = {};
  r = api.vanillaFoodAddFish(-10);
  assert(r.ok === true && V.foodstuff.haddock.amount === 0, "5 + (-10) → 钳到 0 不为负");
  V.foodstuff = { haddock: { amount: 999999 } };
  V.mbCE_wrote = {};
  r = api.vanillaFoodAddFish(10);
  assert(r.ok === true && V.foodstuff.haddock.amount === 999999, "999999 + 10 → 钳到 999999 不越界");

  /* ================= 4. 回退时 $foodstuff 已不在 ================= */
  section("4 回退数据不在");
  V.foodstuff = { haddock: { amount: 3 } };
  V.mbCE_wrote = {};
  api.vanillaFoodSet("haddock", "7");
  delete V.foodstuff;
  r = api.vanillaFoodUndo("food-haddock");
  assert(r.ok === false && /不在/.test(r.message), "回退时 $foodstuff 已删 → 拒绝");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
