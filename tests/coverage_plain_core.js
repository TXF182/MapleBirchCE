/* 01-core 纯函数 falsy fallback（shortcircuit `x || ""` 的 "" 侧）+ 空串守卫 — 覆盖率提升轮
 *
 * unit_core.js 是纯函数隔离单测（不 eval 拼接产物），c8 的产物覆盖率不认它，
 * 所以这些 name||"" / t||"" 的 fallback 侧在产物统计里仍是 miss。
 * 本测试通过 eval 产物 + api 调用，把 01-core 的短路 fallback 补进产物覆盖率，
 * 并顺手补 01-core L252（EdenChildIdOf 空串）与 07f-pins3-queue2 L292（srcHasEndSignal 空串）。
 * 判据：断言返回值（null 透传 / 空串 / false），不只判断「不抛错」。
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
const V = { player: {}, passage: "Room", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = { clothes: {}, clothes_all_slots: [], bodyparts: [], bodywriting: {} };
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
try { eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }
const api = setupObj.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

try {
  section("1 displayName falsy fallback（name || \"\"）");
  assert(api.displayName(null) === null, "displayName(null) → null 透传");
  assert(api.displayName("") === "", "displayName('') → '' 透传");
  assert(api.displayName(undefined) === undefined, "displayName(undefined) → undefined 透传");
  assert(api.displayName(0) === 0, "displayName(0) → 0（falsy 非字符串原样透传）");

  section("2 isVanillaNPC / isVanillaLoveInterest / isPerNpcRole falsy");
  assert(api.isVanillaNPC(null) === false, "isVanillaNPC(null) → false");
  assert(api.isVanillaNPC("") === false, "isVanillaNPC('') → false");
  assert(api.isVanillaNPC(0) === false, "isVanillaNPC(0) → false");
  assert(api.isVanillaLoveInterest(null) === false, "isVanillaLoveInterest(null) → false");
  assert(api.isVanillaLoveInterest("") === false, "isVanillaLoveInterest('') → false");
  assert(api.isPerNpcRole(null) === false, "isPerNpcRole(null) → false");
  assert(api.isPerNpcRole("") === false, "isPerNpcRole('') → false");

  section("3 空串守卫");
  V.NPCList = [];
  assert(api.mbCEEdenChildIdOf("") === null, "EdenChildIdOf('') → null（空串 key）");
  assert(api.mbCEEdenChildIdOf(null) === null, "EdenChildIdOf(null) → null（name===null 短路）");
  assert(api.mbCEEdenChildIdOf(undefined) === null, "EdenChildIdOf(undefined) → null（name===undefined 侧）");
  assert(api.srcHasEndSignal("") === false, "srcHasEndSignal('') → false（空源）");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
