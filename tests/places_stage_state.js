/* 地点阶段读写状态测试（branches 门槛 70→80 整改轮 · 第四批）
 *
 * 覆盖对象：07d-places2.js —— placeStageRead 的容错读数、placeStageWrite 的钳制/宿主拒绝/
 * town_projects 自动建壳/「首次 before」留痕、placeStageUndo 的还原与删字段语义，以及
 * 地点页阶段区的真实按钮路径（−1 / +1 / 拉满 / 回退）。
 *
 * 判据说明：所有断言读 **存档实际值** 与 **V.mbCE_wrote 留痕**，不看按钮文案。
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
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.placeStageWrite === "function" && typeof api.renderPlaces === "function", "地点阶段写入/渲染 API 已导出");

/* ================= 1. 读数容错 ================= */
section("1 placeStageRead 读数额");
V.town_projects = { school: { fund: 12 } };
assert(api.placeStageRead("town_projects.school.fund") === 12, "嵌套路径读数正确");
assert(api.placeStageRead("town_projects.school.nope") === 0, "字段缺失 → 0（不返回 undefined）");
assert(api.placeStageRead("town_projects.nope.deeper") === 0, "中间宿主缺失 → 0 不抛");
V.weirdNum = "7.6";
assert(api.placeStageRead("weirdNum") === 8, "字符串数字取整（四舍五入）");
V.weirdNum = "not-a-number";
assert(api.placeStageRead("weirdNum") === 0, "非数字 → 0");
V.nullHost = null;
assert(api.placeStageRead("nullHost.x") === 0, "中间为 null → 0（提前返回）");
assert(api.placeStageRead("") === 0, "空路径 → 0");

/* ================= 2. 写入与钳制 ================= */
section("2 placeStageWrite 钳制与留痕");
V.town_projects = { school: { fund: 5 } };
V.mbCE_wrote = {};
const w1 = api.placeStageWrite("town_projects.school.fund", 9, 0, 10);
assert(w1.ok === true && V.town_projects.school.fund === 9, "正常写入 9");
assert(w1.before === 5 && w1.after === 9, "返回结构带 before/after");
assert(V.mbCE_wrote["place:town_projects.school.fund"].before === 5, "留痕记录首次写入前值 5");
const w2 = api.placeStageWrite("town_projects.school.fund", 20, 0, 10);
assert(V.town_projects.school.fund === 10, "超过上限 → 钳到 max=10（阶段档位语义）");
assert(V.mbCE_wrote["place:town_projects.school.fund"].before === 5, "二次写入仍保留首次 before=5（回退不丢失）");
const w3 = api.placeStageWrite("town_projects.school.fund", -3, 2, 10);
assert(V.town_projects.school.fund === 2, "低于下限 → 钳到 min=2");
const w4 = api.placeStageWrite("town_projects.school.fund", "abc", 0, 10);
assert(V.town_projects.school.fund === 0, "非数字目标 → 按 0 处理（不写 NaN）");
assert(api.placeStageWrite("town_projects.school.fund", 3).ok === true, "缺省 min/max 时仍可写（上限放开为 Infinity）");
assert(api.placeStageWrite("", 1).ok === false, "空路径 → 拒绝");
V.ghost = {};
const wGhost = api.placeStageWrite("ghost.child.leaf", 5);
assert(wGhost.ok === false && wGhost.message.indexOf("宿主不存在") >= 0, "非 town_projects 的缺失宿主 → 拒绝并给原因");
assert(V.ghost.child === undefined, "拒绝时不臆造中间宿主");
V.town_projects = undefined;
api.placeStageWrite("town_projects.road", 4, 0, 5);
assert(V.town_projects && V.town_projects.road === 4, "town_projects 顶层缺失 → 自动建壳后写入");
V.mbCE_wrote = "broken";
V.town_projects = { ok: { v: 1 } };
api.placeStageWrite("town_projects.ok.v", 2, 0, 5);
assert(typeof V.mbCE_wrote === "object" && V.mbCE_wrote["place:town_projects.ok.v"], "mbCE_wrote 非对象时自动重建（不抛）");

/* ================= 3. 回退语义 ================= */
section("3 placeStageUndo");
V.town_projects = { ok: { v: 5 } };
V.mbCE_wrote = {};
api.placeStageWrite("town_projects.ok.v", 1, 0, 5);
const u1 = api.placeStageUndo("town_projects.ok.v");
assert(u1.ok === true && V.town_projects.ok.v === 5, "回退还原首次写入前值 5");
assert(!V.mbCE_wrote["place:town_projects.ok.v"], "回退后删除留痕");
assert(api.placeStageUndo("town_projects.ok.v").ok === false, "无留痕 → 拒绝回退");
V.town_projects = { ok: {} };
V.mbCE_wrote = {};
api.placeStageWrite("town_projects.ok.fresh", 3, 0, 5);
assert(api.placeStageUndo("town_projects.ok.fresh").ok === true && ("fresh" in V.town_projects.ok) === false, "before=undefined → 回退时删字段（不是写 undefined）");
V.town_projects = { ok: { v: 4 } };
V.mbCE_wrote = { "place:town_projects.ok.v": { type: "place", path: "town_projects.ok.v", before: 4, after: 4 } };
delete V.town_projects.ok;
const u3 = api.placeStageUndo("town_projects.ok.v");
assert(u3.ok === false && u3.message.indexOf("宿主已被清除") >= 0, "宿主已被清除 → 拒绝回退（不重建宿主）");

/* ================= 4. 真面板路径（−1 / +1 / 拉满 / 回退） ================= */
section("4 renderPlaces 阶段区按钮");
const groups = api.PLACE_STAGE_GROUPS;
assert(Array.isArray(groups) && groups.length > 0, "阶段分组表已导出（" + groups.length + " 组）");
const firstItem = groups[0].items[0];
console.log("INFO: 首项 " + firstItem.key + " path=" + firstItem.path + " max=" + firstItem.max);
/* 按真实 path 建宿主（中间层按需补对象） */
function ensurePath(p, val) {
  const parts = p.split(".");
  let cur = V;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) { cur[parts[i]] = {}; }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}
ensurePath(firstItem.path, 0);
V.mbCE_wrote = {};
api.open();
function clickTab(tab) {
  const btns = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of btns) { if (b.getAttribute("data-tab") === tab) { b.click(); return true; } }
  return false;
}
assert(clickTab("places") === true, "切到「地点」页签");
const pane = document.querySelector('#mce-root [data-pane="places"]');
assert(!!pane, "地点面板已建出");
/* 地点页是「场景直达 / 地点阶段」双层子界面，阶段区要先点子页签（玩家真实路径） */
const stageTab = pane.querySelector('[data-place="stage"]');
assert(!!stageTab, "「地点」子页签按钮存在");
stageTab.click();
const rowSel = '#mce-root [data-pane="places"] [data-stagekey="' + firstItem.key + '"]';
const row = document.querySelector(rowSel);
assert(!!row, "阶段行按 data-stagekey 建出（" + firstItem.key + "）");
assert(!row.querySelector('[data-op="undo"]'), "未写入前不显示「回退」按钮");
function btn(op) { return row.querySelector('[data-op="' + op + '"]'); }
btn("inc").click();
assert(api.placeStageRead(firstItem.path) === 1, "+1 → 从 0 推进到 1");
btn("dec").click();
assert(api.placeStageRead(firstItem.path) === 0, "−1 → 回到 0（下限钳制不出现负数）");
btn("max").click();
assert(api.placeStageRead(firstItem.path) === firstItem.max, "拉满 → 写入原版上限 " + firstItem.max);
const row2 = document.querySelector(rowSel);
const undoBtn = row2.querySelector('[data-op="undo"]');
assert(!!undoBtn, "有留痕后出现「回退」按钮");
undoBtn.click();
assert(api.placeStageRead(firstItem.path) === 0, "点「回退」→ 还原到首次写入前值 0");
/* +1 在满档时不越界 */
ensurePath(firstItem.path, firstItem.max);
V.mbCE_wrote = {};
api.renderPlaces();
const rowFull = document.querySelector(rowSel);
rowFull.querySelector('[data-op="inc"]').click();
assert(api.placeStageRead(firstItem.path) === firstItem.max, "+1 在满档时钳制在上限（不点出不存在档位）");

/* ================= 5. 直达跳转的拒绝路径 ================= */
section("5 teleportTo 拒绝路径");
/* teleportTo 无返回值，拒绝语义体现在状态栏（玩家可见层）——按真实路径断言 */
api.open();
api.teleportTo("NoSuchPassageXYZ");
const errEl = document.querySelector("#mce-root .mce-err");
assert(!!errEl && /段落不存在/.test(errEl.textContent), "未安装的段落 → 状态栏报「段落不存在」（" + (errEl ? errEl.textContent.slice(0, 40) : "无元素") + "）");
api.teleportTo("");
const errEl2 = document.querySelector("#mce-root .mce-err");
assert(!!errEl2 && /段落不存在/.test(errEl2.textContent), "空段落名 → 同拒绝路径（不抛异常）");
console.log("\nPLACES STAGE STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
