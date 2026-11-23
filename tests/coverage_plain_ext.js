/* 原版档案（07l）plain 拒绝侧补测 — 覆盖率提升轮
 *
 * plain_branches.js 已覆盖古董收集正常路径与跨文件零散分支，本测试专打剩余拒绝侧：
 *   CrimeClear 无 $crime / AntiqueCollect 无博物馆结构 / RemyScar 无 Remy /
 *   ExtUndo 留痕不存在 / 回退时 $crime、博物馆、Remy 结构已不在。
 * 判据：断言返回体 ok/message，不 mock 执行器内部。
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
window.matchMedia = function (q) { return { matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }; };

const CRIME_NAMES = ["assault", "coercion", "destruction", "exposure", "obstruction", "prostitution", "resisting", "thievery", "petty", "trespassing"];
const setupObj = {
  crimeNames: CRIME_NAMES.reduce(function (o, k) { o[k] = k; return o; }, {}),
  NPCNameList: ["Remy", "Harper", "Avery"]
};
global.setup = setupObj;
global.getSetup = function () { return setupObj; };

const V = {
  player: {}, passage: "Room", mbCE_wrote: {},
  crime: { assault: { current: 3, count: 3, daily: 3, history: 3, countHistory: 3 }, events: { e1: 1 } },
  NPCNameList: ["Remy", "Harper", "Avery"],
  NPCName: [
    { state: "active", title: "high elk" },
    { state: "active", title: "silver fox" },
    { state: "active", title: "crimson hound" }
  ]
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
try { eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

try {
  section("1 犯罪无结构");
  delete V.crime;
  let r = api.mbCEVanillaCrimeClear();
  assert(r.ok === false && /未找到 \$crime/.test(r.message), "无 $crime → CrimeClear 拒绝");

  section("2 古董无结构");
  delete V.museumAntiques;
  r = api.mbCEVanillaAntiqueCollect();
  assert(r.ok === false && /进入博物馆线/.test(r.message), "无博物馆结构 → Collect 拒绝");

  section("3 Remy 不在");
  const savedNpcList = setupObj.NPCNameList;
  setupObj.NPCNameList = ["Harper", "Avery"];
  V.NPCNameList = ["Harper", "Avery"];
  V.NPCName = [{ state: "active", title: "silver fox" }, { state: "active", title: "crimson hound" }];
  r = api.mbCEVanillaRemyScar();
  assert(r.ok === false && /未找到 Remy/.test(r.message), "无 Remy → RemyScar 拒绝");
  setupObj.NPCNameList = savedNpcList;
  V.NPCNameList = ["Remy", "Harper", "Avery"];
  V.NPCName = [
    { state: "active", title: "high elk" },
    { state: "active", title: "silver fox" },
    { state: "active", title: "crimson hound" }
  ];

  section("4 留痕不存在");
  V.mbCE_wrote = {};
  r = api.mbCEVanillaExtUndo("crime");
  assert(r.ok === false && /留痕已不存在/.test(r.message), "无留痕 → Undo 拒绝");

  section("5 回退时犯罪结构不在");
  V.crime = { assault: { current: 5, count: 5, daily: 5, history: 5, countHistory: 5 }, events: {} };
  V.mbCE_wrote = {};
  api.mbCEVanillaCrimeClear();
  delete V.crime;
  r = api.mbCEVanillaExtUndo("crime");
  assert(r.ok === false && /犯罪结构已不在/.test(r.message), "回退时 $crime 已删 → 拒绝");

  section("6 回退时博物馆结构不在");
  V.museumAntiques = { antiques: { a: "notFound" }, paintings: {}, maxCount: 1, museumCount: 0, stolenCount: 0, recoveredCount: 0 };
  V.mbCE_wrote = {};
  api.mbCEVanillaAntiqueCollect();
  delete V.museumAntiques;
  r = api.mbCEVanillaExtUndo("antique");
  assert(r.ok === false && /博物馆结构已不在/.test(r.message), "回退时博物馆已删 → 拒绝");

  section("7 回退时 Remy 不在");
  V.NPCNameList = ["Remy", "Harper", "Avery"];
  V.NPCName = [
    { state: "active", title: "high elk" },
    { state: "active", title: "silver fox" },
    { state: "active", title: "crimson hound" }
  ];
  V.mbCE_wrote = {};
  api.mbCEVanillaRemyScar();
  V.NPCNameList = [];
  V.NPCName = [];
  r = api.mbCEVanillaExtUndo("title");
  assert(r.ok === false && /Remy 已不在/.test(r.message), "回退时 Remy 已删 → 拒绝");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
