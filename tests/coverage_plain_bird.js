/* 原版鹰塔（07n）plain 拒绝侧补测 — 覆盖率提升轮
 *
 * vanilla_bird_state.js 已覆盖正常写入 + 无 bird / materials 缺失 / 非数字 / 负数拒绝，
 * 本测试专打剩余 plain：无 state 读空串、UpgradesMax 无 bird 拒绝、Undo 时 bird / materials /
 * upgrades 结构已不在的三种拒绝、渲染时有 bird 无 materials 的提示分支。
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
global.HTMLSelectElement = window.HTMLSelectElement;
const V = { player: {}, passage: "Room", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = { bodyparts: ["chest", "face", "feet", "leftarm", "rightarm", "neck", "thigh", "tummy"] };
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
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

try {
  /* ================= 1. 空壳 bird 读空 state ================= */
  section("1 空壳读空串");
  V.bird = {};
  V.mbCE_wrote = {};
  const st = api.vanillaBirdStats();
  assert(st.ok === true && st.state === "" && st.hasMaterials === false, "无 $bird.state → 状态读空串且材料未初始化");

  /* ================= 2. UpgradesMax 无 bird 拒绝 ================= */
  section("2 满级无 bird 拒绝");
  delete V.bird;
  V.mbCE_wrote = {};
  let r = api.vanillaBirdUpgrades();
  assert(r.ok === false && /还没遇到大鹰/.test(r.message), "无 $bird → 设施满级拒绝");

  /* ================= 3. Undo 时结构已不在（bird / materials / upgrades） ================= */
  section("3 撤销结构变化");
  V.bird = { state: "home", clean: 12, materials: { wood: 5, junk: 7 }, upgrades: { shelter: 1 } };
  V.mbCE_wrote = {};
  api.vanillaBirdClean(100);
  delete V.bird;
  r = api.vanillaBirdUndo("bird-clean");
  assert(r.ok === false && /数据已不在/.test(r.message), "写清洁度后删 $bird → 回退拒绝");

  V.bird = { state: "home", materials: { wood: 5, junk: 7 } };
  V.mbCE_wrote = {};
  api.vanillaBirdMaterials(100);
  delete V.bird;
  r = api.vanillaBirdUndo("bird-materials");
  assert(r.ok === false && /数据已不在/.test(r.message), "写材料后删 $bird → 回退拒绝");

  V.bird = { state: "home", materials: { wood: 5, junk: 7 } };
  V.mbCE_wrote = {};
  api.vanillaBirdMaterials(100);
  delete V.bird.materials;
  r = api.vanillaBirdUndo("bird-materials");
  assert(r.ok === false && /材料结构已不在/.test(r.message), "写材料后删 materials → 回退拒绝");

  V.bird = { state: "home", upgrades: { shelter: 1 } };
  V.mbCE_wrote = {};
  api.vanillaBirdUpgrades();
  delete V.bird;
  r = api.vanillaBirdUndo("bird-upgrades");
  assert(r.ok === false && /数据已不在/.test(r.message), "写设施后删 $bird → 回退拒绝");

  V.bird = { state: "home", upgrades: { shelter: 1 } };
  V.mbCE_wrote = {};
  api.vanillaBirdUpgrades();
  delete V.bird.upgrades;
  r = api.vanillaBirdUndo("bird-upgrades");
  assert(r.ok === false && /设施结构已不在/.test(r.message), "写设施后删 upgrades → 回退拒绝");

  /* ================= 4. 渲染时有 bird 无 materials 提示 ================= */
  section("4 渲染缺 materials 提示");
  V.bird = { state: "home", clean: 12 };
  V.mbCE_wrote = {};
  const pane = document.createElement("div");
  document.body.appendChild(pane);
  api.renderVanillaBird(pane);
  assert(pane.textContent.indexOf("材料堆还没建立") !== -1, "有 $bird 无 materials → 渲染出「材料堆还没建立」提示");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
