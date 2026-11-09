/*
 * plain 分支补测专项（覆盖率欠账轮 2026-11-09）
 *
 * 背景：report_branch_gaps.js 把未覆盖分支按行文归为 catch / shortcircuit / ternary /
 * env-guard / plain。plain 是"普通 if-else 没写断言"的欠账——过去各测试只走正常路径，
 * 拒绝分支、空集合分支、队列边界从没被喂到。
 *
 * 边界（重要）：本测试**不**覆盖 dead-guard 一类（`if (!V)` 且 V 来自 getV()）。
 * getV() 在未读档时返回 {} 兜底（truthy），`!V` 恒 false，那批分支结构性不可达，
 * 硬塞断言只会模仿执行、不产生真覆盖。它们已由报表工具单列一类。
 *
 * 用法：node tests/plain_branches.js（需先 node tools/build_js.js）
 */
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;

/* 最小游戏全局（与 smoke_dom 同口径，但不声明 V/State 等同名局部变量，避免遮蔽产物内的裸全局） */
global.V = {
  player: { virginity: { vaginal: true, penile: false }, charisma: 10, beauty: 20, physique: 30 },
  loveInterest: [],
  passage: "Room",
  scenePassages: [],
  mbCE_wrote: {}
};
global.State = { variables: global.V };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [] };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };
window.__mbCE_forceSyncRows = true;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
const js = fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/");
eval(js);
const api = global.setup.mbStageCE;

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function call(fn) { try { return fn(); } catch (e) { return { threw: String(e && e.message || e) }; } }

assert(!!api && typeof api.mbCEPreviewGate === "function", "setup.mbStageCE 已挂载且预览接口可用");

/* ---------- 1. 08d 预览队列边界（plain：L48 超限丢最旧 / L56 空队列 / L64 非对象结果） ---------- */
api.mbCEUiSave({ diffPreview: "1" });
assert(api.mbCEUiState().diffPreview === "1", "diff 预览开关已开启（后续队列断言的前提）");

let gateErr = null, pushed = 0;
for (let i = 0; i < 9; i++) {
  const r = call(function () { return api.mbCEPreviewGate("t.k" + i, 1, 2, function () { return undefined; }); });
  if (r && r.threw) { gateErr = r.threw; break; }
  if (r === true) pushed++;
}
assert(!gateErr, "连续 9 次入队不抛异常" + (gateErr ? "（实际：" + gateErr + "）" : ""));
assert(pushed === 9, "9 次均被预览拦下（进入待确认队列），实际 " + pushed);
assert(api.mbCEPreviewCount() === 8, "队列封顶 MB_CE_PREVIEW_MAX=8，超出丢最旧，实际 " + api.mbCEPreviewCount());

const confirm1 = call(function () { return api.mbCEPreviewConfirm(); });
assert(confirm1 && confirm1.ok === true && String(confirm1.message).indexOf("已写入") === 0,
  "确认队首：run 返回非对象时回落为「已写入 …」（08d L64），实际 " + JSON.stringify(confirm1));

const cancelR = call(function () { return api.mbCEPreviewCancel(); });
assert(cancelR && cancelR.ok === true && api.mbCEPreviewCount() === 0, "取消清空整个队列，实际 " + JSON.stringify(cancelR));

const confirmEmpty = call(function () { return api.mbCEPreviewConfirm(); });
assert(confirmEmpty && confirmEmpty.ok === false && confirmEmpty.message === "没有待确认的写入",
  "空队列确认返回明确拒绝（08d L56），实际 " + JSON.stringify(confirmEmpty));

/* ---------- 2. 07d 地点中文名：无匹配关键词（plain：L91 !parts.length → ""） ---------- */
const nameMiss = call(function () { return api.placeNameCN("zzzz-not-a-place"); });
assert(nameMiss === "", "未知地点名返回空串（不拼出「（）」空壳），实际 " + JSON.stringify(nameMiss));
const nameHit = call(function () { return api.placeNameCN("bedroom"); });
assert(typeof nameHit === "string" && nameHit.indexOf("（") === 0, "已知地点名仍返回中文括号名，实际 " + JSON.stringify(nameHit));

/* ---------- 3. 08 未知 NPC 特质（plain：08-npc-traits L111 !t → "未知特质 …"） ---------- */
const revUnknown = call(function () { return api.revertNpcTrait("no-such-trait"); });
assert(revUnknown && revUnknown.ok === false && String(revUnknown.message).indexOf("未知特质") === 0,
  "撤回未知 NPC 特质返回明确拒绝（08-npc-traits L111），实际 " + JSON.stringify(revUnknown));

/* ---------- 3b. 08d 页签分发：mods / places（plain：L108 / L110） ---------- */
function setActivePane(name) {
  document.querySelectorAll(".mce-pane").forEach(function (p) { p.classList.remove("mce-active"); });
  const p = document.querySelector('[data-pane="' + name + '"]');
  if (p) { p.classList.add("mce-active"); }
  return p;
}
const paneModsBefore = setActivePane("mods");
assert(!!paneModsBefore, "存在 data-pane=mods 的页容器（前置）");
const refreshMods = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshMods === "mods", "活动页 = mods 时分发到 renderModCheats（08d L108），实际 " + JSON.stringify(refreshMods));
const panePlaces = setActivePane("places");
assert(!!panePlaces, "存在 data-pane=places 的页容器（前置）");
const refreshPlaces = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshPlaces === "places", "活动页 = places 时分发到 renderPlaces（08d L110），实际 " + JSON.stringify(refreshPlaces));

/* ---------- 4. 09 页签栏点击空白（plain：L265 !b → return） ---------- */
const tabs = document.querySelector(".mce-tabs");
assert(!!tabs, "面板页签栏存在（init→ensureDom 已建）");
let tabErr = null;
if (tabs) {
  const r = call(function () { tabs.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); return true; });
  if (r && r.threw) tabErr = r.threw;
}
assert(!tabErr, "点击页签栏自身（非 button[data-tab]）不抛错" + (tabErr ? "（" + tabErr + "）" : ""));
assert(!!document.querySelector(".mce-tabs .mce-active, .mce-tabs button"),
  "页签栏仍保持可用（未因空点击被破坏）");

/* ---------- 5. 05a 面板容器缺失时的渲染早退（plain：L91 / L141 !pane → return） ----------
   放在最后：移走 [data-pane="mods"] 会改变面板结构，不影响前面的状态断言。 */
const modsPane = document.querySelector('[data-pane="mods"]');
assert(!!modsPane, "Mod作弊 pane 存在（前置）");
if (modsPane) {
  modsPane.parentNode.removeChild(modsPane);
  const r1 = call(function () { return api.renderModCheats(); });
  assert(!(r1 && r1.threw), "pane 缺失时 renderModCheats 直接返回（05a L91）" + (r1 && r1.threw ? "（" + r1.threw + "）" : ""));
  const r2 = call(function () { return api.renderModCheatDetail("no-such-mod"); });
  assert(!(r2 && r2.threw), "pane 缺失时 renderModCheatDetail 直接返回（05a L141）" + (r2 && r2.threw ? "（" + r2.threw + "）" : ""));
}

/* ---------- 汇总 ---------- */
console.log("");
if (failures) { console.error("PLAIN BRANCHES TEST: " + failures + " 项失败"); process.exit(1); }
console.log("PLAIN BRANCHES TEST PASSED");
process.exit(0);
