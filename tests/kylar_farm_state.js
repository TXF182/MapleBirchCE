/* v2.0.20 四项改动真实路径测试（A 一键被监视 / B 凯拉尔跟踪反转直达 / C 30 条地点 / P0 farm_attack_timer）
 *
 * 走玩家真实入口：api.ensureFarmState（面板置高农场阶段时调）、api.applyRolePlotAction（凯拉尔分页按钮）、
 * api.getScenesDefs（剧情页列表渲染）、api.sceneAnchorMeta（单阶段锚定）。
 * 目的：断言这四项不只是"写了字符串"，而是在真实数据流上产生预期行为；
 * 以及防回归 —— 不得凭空写未推进存档、不得覆盖已有值、不得写 V.scenes。
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

const V = { player: {}, scenePassages: [], mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };
/* 场景注册表走 parsed 主路径：加载原版 $scenes fixture（与 scenes_page_state.js 同源），
   这样 getScenesDefs 的合并结果才是玩家真实看到的。 */
const fixtureText = fs.readFileSync(path.join(__dirname, "fixtures", "scenes-widget.twee"), "utf8");
global.Story = { size: 1, passages: [{ name: "Scene Viewer Widgets", text: fixtureText }], has: function () { return false; }, get: function () { return null; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. P0：farm_attack_timer 补齐 ================= */
section("1 ensureFarmState 补 farm_attack_timer");
function farmShell() {
  return {
    beasts: { horses: 0, pigs: 0, cattle: 0, dogs: 0 }, wage: 15, clearing: 100,
    milking: { catchChance: 0 }, build_finished: [], stock: { truffles: 0, eggs: 0, milk: 0, cream: 0 }
  };
}
V.farm_stage = 8;
V.farm = farmShell();
delete V.farm_attack_timer;
api.ensureFarmState(false);
assert(V.farm_attack_timer === 30, "缺失 → 补 30（实际 " + V.farm_attack_timer + "）");

V.farm_attack_timer = NaN;
api.ensureFarmState(false);
assert(V.farm_attack_timer === 30, "NaN（undefined-- 的产物）→ 复补 30");

V.farm_attack_timer = 7;
api.ensureFarmState(false);
assert(V.farm_attack_timer === 7, "已有合法值 7 不被覆盖");

V.farm_stage = 0;
delete V.farm_attack_timer;
api.ensureFarmState(false);
assert(V.farm_attack_timer === undefined, "农场线未推进(fs=0)且非 force → 不凭空写");

V.farm_stage = 8;
V.farm = null;
delete V.farm_attack_timer;
api.ensureFarmState(false);
assert(V.farm_attack_timer === undefined, "farm 空壳分支早退时不写 timer（保持原语义）");

/* ================= 2. A：一键进入被监视状态 ================= */
section("2 kylarWatch 动作");
V.kylarwatched = 0;
V.kylarwatchedtimer = 0;
const r = api.applyRolePlotAction("kylarWatch");
assert(V.kylarwatched === 1, "$kylarwatched → 1");
assert(V.kylarwatchedtimer === 2, "$kylarwatchedtimer → 2（本体事件池首设值）");
assert(/监视/.test(String(r)), "返回成功文案（" + r + "）");

const plots = api.getRolePlots("凯拉尔 Kylar");
assert(!!plots && Array.isArray(plots.items), "凯拉尔分页可读");
assert(!!plots && plots.items.some(function (i) { return i.action === "kylarWatch"; }), "分页含一键监视项");
assert(!!plots && plots.items.some(function (i) { return i.action === "kylarSeen"; }), "既有 kylarSeen 项未被破坏");

/* ================= 3. B：凯拉尔跟踪反转并入场景列表 ================= */
section("3 EXTRA_SCENES 凯拉尔跟踪反转");
const gd = api.getScenesDefs();
const sr = gd && gd.defs && gd.defs["KylarStalkingReversal"];
assert(!!sr, "getScenesDefs 结果含 KylarStalkingReversal");
assert(!!sr && Array.isArray(sr.passages) && sr.passages.length === 15, "15 段全在（实际 " + (sr ? sr.passages.length : 0) + "）");
assert(!!sr && sr.startPassage === "Kylar Stalking Reversal Hide Confront", "startPassage = Hide Confront");
assert(!!sr && String(sr.manualVariableChanges).indexOf("town") >= 0, "地点元数据 town 已标注");
assert(!!sr && /跟踪反转/.test(sr.name), "显示名含「跟踪反转」");
assert(!V.scenes || !V.scenes["KylarStalkingReversal"], "未写入 V.scenes（不污染存档 / 本体解锁判定）");

/* ================= 4. C：30 条静态地点 ================= */
section("4 SCENE_LOCATIONS 补齐 30 条");
const C = [
  ["ChefOpeningPhotograph", "town"], ["ChefOpeningCeremony", "cafe"],
  ["SchoolInspectionPenis", "school"], ["SchoolInspectionPussy", "school"], ["SchoolInspectionBreast", "school"],
  ["AlexFarmIntro", "alex_cottage"], ["EdenValentinesBath", "cabin"], ["Christmas Mirror", "home"],
  ["NightmareEden", "cabin"], ["NightmareWraith", "temple"], ["NightmareBird", "tower"],
  ["NightmareCorruptSydney", "temple"], ["NightmareHarper", "asylum"], ["NightmareAlex", "alex_cottage"],
  ["NightmareWitch", "old_temple"], ["NightmareOffice", "office"], ["NightmareGwylan", "docks"],
  ["HarperHypnosisIntro", "hospital"], ["HarperHypnosisTrance4", "hospital"], ["HarperHypnosisExam3", "hospital"],
  ["HarperHypnosisDogIntro", "hospital"], ["HarperHypnosisDog4", "hospital"]
];
let hit = 0;
C.forEach(function (p) {
  const m = api.sceneAnchorMeta(p[0]);
  if (m && m.location === p[1]) { hit++; }
  else { console.error("  loc miss: " + p[0] + " -> " + JSON.stringify(m)); }
});
assert(hit === C.length, "抽检 " + C.length + " 条静态地点命中 (" + hit + "/" + C.length + ")");
/* 负例：无地点证据的 9 条不得被臆造成某一个地点 */
const NO_LOC = ["Tutorial", "HalloweenWhitney", "HalloweenKylar", "AlexFarmSelfMilkingCaught",
  "RobinCrossdressing4", "RobinCrossdressing5", "EdenRadioIntro", "Pinch", "RaulAndJanet"];
let bad = 0;
NO_LOC.forEach(function (k) { const m = api.sceneAnchorMeta(k); if (m && m.location) { bad++; console.error("  unexpected loc: " + k + " -> " + m.location); } });
assert(bad === 0, "9 条无证据场景未被臆造地点 (" + bad + " 条误标)");

console.log("\n--- 结果 ---");
console.log("PASS " + passes + " / FAIL " + failures);
process.exit(failures ? 1 : 0);
