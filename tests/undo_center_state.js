/* 统一回退中心状态测试（branches 门槛 70→80 整改轮）
 *
 * 覆盖对象：08c-undo-center.js（留痕清单 / 单条回退分发 / 分组回退 / 全部回退 / 面板区块）。
 *
 * 关键口径：回退中心的输入只有一份数据源 —— 存档里的 V.mbCE_wrote。
 * 所以这里**不手工造 UI**，而是造留痕记录（12 种 type 全打一遍）再看它如何分发；
 * 三种「只审计不可回退」的类型（batch / yanling / state）必须显式禁用并给出原因，
 * 不能被静默吞掉（否则玩家点了「回退」以为成功）。
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
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(!!api && typeof api.undoOne === "function", "回退中心已导出（undoList / undoOne / undoGroup / undoAll）");

/* ================= 1. 类型标签与不可回退原因 ================= */
section("1 undoLabel / 分组文案");
assert(api.undoLabel("cheat") === "作弊项写入", "cheat → 中文名");
assert(api.undoLabel("batch") === "批量操作（仅审计）", "batch → 标注仅审计");
assert(api.undoLabel("") === "未知类型", "空类型 → 未知类型（不留空白按钮）");
assert(api.undoLabel("weird") === "weird", "未知类型原样回显，便于排障");

/* ================= 2. 留痕清单 ================= */
section("2 undoList 排序与容错");
assert(api.undoList().length === 0, "无留痕 → 空清单");
V.mbCE_wrote = null;
assert(api.undoList().length === 0, "mbCE_wrote 被置 null → 返回空清单不抛");
V.mbCE_wrote = {
  "cheat:deadwood-reblooms:dw_stage": { type: "cheat", path: "deadwood.stage", t: 100 },
  "batch:1": { type: "batch", t: 300, n: 5 },
  "not-an-object": "oops"
};
const list2 = api.undoList();
assert(list2.length === 2, "非对象留痕被跳过（2 条而非 3 条）");
assert(list2[0].t === 300 && list2[1].t === 100, "按时间倒序（最新在前）");
assert(list2[0].type === "batch", "条目带 type 供分组");

/* ================= 3. 单条回退：不可回退三类 ================= */
section("3 三类只审计不可回退");
V.mbCE_wrote = {
  "batch:2": { type: "batch", t: 10 },
  "yanling:x": { type: "yanling", t: 11 },
  "state:y": { type: "state", t: 12 }
};
assert(/批量操作/.test(api.undoOne("batch:2").msg), "batch → 明确说只记录条数不可逐条还原");
assert(/言灵/.test(api.undoOne("yanling:x").msg), "yanling → 指回言灵页撤销");
assert(/关系状态/.test(api.undoOne("state:y").msg), "state → 说明回退会破坏真实关系");
assert(api.undoOne("no-such-key").ok === false, "留痕不存在 → 拒绝（" + api.undoOne("no-such-key").msg + "）");
V.mbCE_wrote = {};
assert(api.undoOne("anything").ok === false, "空留痕表下回退任何 key 都不抛");

/* ================= 4. set / clear / append ================= */
section("4 框架恋爱条件三类");
V.mbCE_wrote = { "set:a": { type: "set", path: "romanceILoveInterest", t: 1 } };
V.romanceILoveInterest = true;
assert(api.undoOne("set:a").ok === true, "set → 撤销置位（" + api.undoOne("set:a").msg + "）");
assert(V.romanceILoveInterest === undefined, "set 回退后字段被删除");
assert(V.mbCE_wrote["set:a"] === undefined, "回退成功即移除留痕（防重复回退）");
V.mbCE_wrote = { "set:b": { type: "set", t: 2 } };
assert(api.undoOne("set:b").ok === false && /缺少 path/.test(api.undoOne("set:b").msg), "set 缺 path → 拒绝并说明");
V.mbCE_wrote = { "clear:c": { type: "clear", path: "romanceSoftEdge", t: 3 } };
assert(api.undoOne("clear:c").ok === true && V.romanceSoftEdge === 1, "clear → 恢复原值 1");
V.mbCE_wrote = { "append:d": { type: "append", path: "romanceFlags", value: "kiss", t: 4 } };
V.romanceFlags = ["kiss", "date"];
assert(api.undoOne("append:d").ok === true && V.romanceFlags.length === 1, "append 数组形态 → 移除对应元素");
V.mbCE_wrote = { "append:e": { type: "append", path: "romanceObj", value: "hug", t: 5 } };
V.romanceObj = { x: "hug", y: "talk" };
assert(api.undoOne("append:e").ok === true && V.romanceObj.x === undefined, "append 对象形态 → 删除等值键");
V.mbCE_wrote = { "append:f": { type: "append", path: "romanceFlags", value: "gone", t: 6 } };
V.romanceFlags = ["kiss"];
const apMiss = api.undoOne("append:f");
assert(apMiss.ok === false && /已找不到/.test(apMiss.msg), "append 目标已不存在 → 如实报失败（不假装成功）");
V.mbCE_wrote = { "append:g": { type: "append", value: "x", t: 7 } };
assert(api.undoOne("append:g").ok === false && /缺少 path/.test(api.undoOne("append:g").msg), "append 缺 path → 拒绝");

/* ================= 5. 既有实现的四种分发 ================= */
section("5 cheat / world / maint / place / native / vanilla 分发");
V.mbCE_wrote = { "cheat:nosuchmod:nokey": { type: "cheat", path: "nosuch.key", before: 1, t: 8 } };
const rCheat = api.undoOne("cheat:nosuchmod:nokey");
assert(typeof rCheat.ok === "boolean", "cheat 分发到 undoCheatModValue 并返回明确结果（" + rCheat.msg + "）");
V.mbCE_wrote = { "world:gwylan_home": { type: "world", t: 9 } };
const rWorld = api.undoOne("world:gwylan_home");
assert(typeof rWorld.ok === "boolean" && typeof rWorld.msg === "string", "world 分发并给出文案（" + rWorld.msg + "）");
V.mbCE_wrote = { "maint:housekeeping": { type: "maint", path: "housekeeping", t: 10 } };
const rMaint = api.undoOne("maint:housekeeping");
assert(typeof rMaint.ok === "boolean", "maint 分发（" + rMaint.msg + "）");
V.mbCE_wrote = { "place:pub_stage": { type: "place", path: "pub_stage", t: 11 } };
const rPlace = api.undoOne("place:pub_stage");
assert(typeof rPlace.ok === "boolean", "place 分发（" + rPlace.msg + "）");
V.mbCE_wrote = { "romance:native:Gwylan": { type: "native", t: 12 } };
const rNative = api.undoOne("romance:native:Gwylan");
assert(typeof rNative.ok === "boolean" && rNative.msg.length > 0, "native 分发并带角色名（" + rNative.msg + "）");
V.mbCE_wrote = { "vanilla:Gwylan:stage": { type: "vanilla", key: "stage", npc: "Gwylan", t: 13 } };
const rVanilla = api.undoOne("vanilla:Gwylan:stage");
assert(typeof rVanilla.ok === "boolean", "vanilla 分发（" + rVanilla.msg + "）");
V.mbCE_wrote = { "unknown:z": { type: "weird", t: 14 } };
const rUnknown = api.undoOne("unknown:z");
assert(rUnknown.ok === false && /未知留痕类型/.test(rUnknown.msg), "未知类型 → 拒绝并回显类型名（" + rUnknown.msg + "）");

/* ================= 6. 分组回退 ================= */
section("6 undoGroup");
V.mbCE_wrote = {};
const gEmpty = api.undoGroup("cheat");
assert(gEmpty.n === 0 && gEmpty.ok === false && /没有留痕/.test(gEmpty.msg), "空分组 → 明确说没有留痕");
V.mbCE_wrote = { "batch:3": { type: "batch", t: 20 } };
const gBlocked = api.undoGroup("batch");
assert(gBlocked.ok === false && gBlocked.fail === 1 && /批量操作/.test(gBlocked.msg), "只审计分组 → 全部计入 skip/fail 并给原因");
V.mbCE_wrote = {
  "set:h1": { type: "set", path: "romanceH1", t: 21 },
  "set:h2": { type: "set", path: "romanceH2", t: 22 }
};
const gOk = api.undoGroup("set");
assert(gOk.ok === true && gOk.n === 2 && /「框架恋爱条件·置位」已回退 2 项/.test(gOk.msg), "同类型两条 → 逐条回退且文案带组名（" + gOk.msg + "）");
V.mbCE_wrote = {
  "set:m1": { type: "set", path: "romanceM1", t: 23 },
  "set:m2": { type: "set", t: 24 }
};
const gPart = api.undoGroup("set");
assert(gPart.n === 1 && gPart.fail === 1 && /1 项未能回退/.test(gPart.msg), "部分失败 → 分别计数并在文案里报出（" + gPart.msg + "）");

/* ================= 7. 全部回退 ================= */
section("7 undoAll");
V.mbCE_wrote = {};
const aEmpty = api.undoAll();
assert(aEmpty.ok === false && /没有任何面板写入留痕/.test(aEmpty.msg), "空留痕 → 明确说没有写入");
V.mbCE_wrote = {
  "batch:4": { type: "batch", t: 30 },
  "state:s1": { type: "state", t: 31 },
  "set:a1": { type: "set", path: "romanceA1", t: 32 },
  "set:a2": { type: "set", path: "romanceA2", t: 33 }
};
const aMix = api.undoAll();
assert(aMix.ok === true && aMix.n === 2 && aMix.skip === 2, "全部回退 → 可回退 2 项、跳过 2 项审计类（" + aMix.msg + "）");
assert(/2 项仅审计不可回退/.test(aMix.msg), "文案报出跳过数量，不让玩家以为全清了");
assert(Object.keys(V.mbCE_wrote).length === 2, "审计类留痕保留（只跳过不删）");

/* ================= 8. 时间格式化 ================= */
section("8 时间列");
const t0 = new Date(2026, 10, 7, 15, 4).getTime();
const btnInfo = api.undoList().filter(function (it) { return it.t === 30; })[0];
assert(!!btnInfo, "清单条目保留时间戳（用于倒序与展示）");

/* ================= 9. 面板区块渲染与按钮 ================= */
section("9 回退中心区块（真实 DOM 点击）");
/* renderGlobal 不是导出面（模块内函数），必须经页签点击进入 —— 走玩家真实路径 */
function clickTab(key) {
  const b = Array.prototype.slice.call(document.querySelectorAll(".mce-tabs button"))
    .filter(function (x) { return x.getAttribute("data-tab") === key; })[0];
  if (!b) { return false; }
  b.click();
  return true;
}
function btnByText(re) {
  return Array.prototype.slice.call(document.querySelectorAll("button")).filter(function (b) { return re.test(b.textContent); })[0];
}
function globalPane() { return document.querySelector('[data-pane="global"]'); }
function globalBtns(re) {
  const p = globalPane();
  if (!p) { return []; }
  return Array.prototype.slice.call(p.querySelectorAll("button")).filter(function (b) { return re.test(b.textContent); });
}
api.open();
assert(clickTab("global"), "能找到「全局」页签并点进去");
V.mbCE_wrote = {
  "set:p1": { type: "set", path: "romanceP1", t: t0 },
  "batch:p2": { type: "batch", t: t0 + 1 }
};
clickTab("mods"); clickTab("global"); /* 二次进入触发重渲染，确保读到最新留痕 */
const rootText = document.body.textContent;
assert(/统一回退中心/.test(rootText), "全局页出现「统一回退中心」区块");
assert(/写入前 diff 预览/.test(rootText), "区块含 diff 预览开关");
/* 点「全部回退（N 项可回退）」 */
const allBtn = btnByText(/全部回退/);
assert(!!allBtn, "找到「全部回退」按钮（" + (allBtn && allBtn.textContent) + "）");
allBtn.click();
assert(V.romanceP1 === undefined, "点「全部回退」后置位留痕被撤销（romanceP1 已删除）");
assert(!!V.mbCE_wrote["batch:p2"], "审计类留痕不被误删");
/* 点分组内「回退本组 N 项」 */
V.mbCE_wrote = { "set:q1": { type: "set", path: "romanceQ1", t: t0 } };
clickTab("mods"); clickTab("global");
const gBtn = btnByText(/回退本组/);
assert(!!gBtn, "可回退分组出现「回退本组」按钮");
if (gBtn) { gBtn.click(); }
assert(V.romanceQ1 === undefined, "点「回退本组」后该组留痕全部撤销");
/* 点「刷新清单」 */
clickTab("mods"); clickTab("global");
const rBtn = btnByText(/刷新清单/);
assert(!!rBtn, "存在「刷新清单」按钮");
if (rBtn) { rBtn.click(); }
assert(/留痕清单已刷新/.test(document.body.textContent), "点刷新后状态栏报出条数");
/* 点 diff 预览开关（状态翻转 + 持久化调用不抛） */
clickTab("mods"); clickTab("global");
const pvBtn = btnByText(/diff 预览/);
assert(!!pvBtn, "存在 diff 预览开关按钮");
const pvBefore = /已开启/.test(pvBtn.textContent);
pvBtn.click();
clickTab("mods"); clickTab("global");
const pvAfter = btnByText(/diff 预览/);
assert(/已开启/.test(pvAfter.textContent) !== pvBefore, "点开关后状态真翻转（" + pvBefore + " → " + /已开启/.test(pvAfter.textContent) + "）");
/* 单条「回退」按钮 */
V.mbCE_wrote = { "set:r1": { type: "set", path: "romanceR1", t: t0 }, "set:r2": { type: "set", path: "romanceR2", t: t0 + 1 } };
clickTab("mods"); clickTab("global");
const rowBtn = globalBtns(/^回退$/).filter(function (b) { return b.title && b.title.indexOf("还原「") === 0; })[0];
assert(!!rowBtn, "行级「回退」按钮存在（限定在全局面板内）");
const beforeKeys = Object.keys(V.mbCE_wrote).length;
if (rowBtn) { rowBtn.click(); }
assert(Object.keys(V.mbCE_wrote).length === beforeKeys - 1, "行级回退只动一条（" + beforeKeys + " → " + Object.keys(V.mbCE_wrote).length + "）");
/* 空留痕态 */
V.mbCE_wrote = {};
clickTab("mods"); clickTab("global");
assert(/暂无写入留痕/.test(document.body.textContent), "空留痕 → 显示「暂无写入留痕」占位说明");
/* 超过 24 条时提示「仅列出最近 24 条」 */
V.mbCE_wrote = {};
for (let i = 0; i < 30; i++) { V.mbCE_wrote["set:bulk" + i] = { type: "set", path: "romanceBulk" + i, t: t0 + i }; }
clickTab("mods"); clickTab("global");
assert(/仅列出最近 24 条/.test(document.body.textContent), "同组超过 24 条 → 提示只列最近 24 条");
const p = globalPane();
const rows = p ? Array.prototype.slice.call(p.querySelectorAll("button")).filter(function (b) { return b.title && b.title.indexOf("还原「") === 0; }).length : -1;
assert(rows <= 24, "同组行数受 24 条上限约束（实际 " + rows + "）");
api.close();
console.log("\nUNDO CENTER STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
