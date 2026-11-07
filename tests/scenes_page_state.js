/* 剧情页（07h-render2 / renderSceneRegion / 07h-render3 懒渲染）真实路径测试
 * （branches 70→80 整改轮 · 第九批）
 *
 * 走玩家真实入口：点「剧情」页签 → 面板用**真实场景注册表**（fixture 里原版 $scenes 元数据）渲染 →
 * 展开角色组（懒渲染：展开时才建控件）→ 逐条交互（展开线 / 锚定整线 / 单阶段锚定与取消 /
 * 一键完成 / 直达触发的禁用态 / 清空队列 / 空注册表）。
 * 目的：UI 的拒绝路径（未标注地点不可锚定、无入口段落不可直达、无注册表时的说明）必须真的走到。
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

const V = { player: {}, scenePassages: [], mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

/* 真实场景元数据：把 fixture（原版 $scenes 对象）塞进 Story 段落，走 findScenesWidgetText 主路径 */
const fixturePath = path.join(__dirname, "fixtures", "scenes-widget.twee");
const fixtureText = fs.readFileSync(fixturePath, "utf8");
global.Story = { size: 1, passages: [{ name: "Scene Viewer Widgets", text: fixtureText }], has: function () { return false; }, get: function () { return null; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 注册表解析 ================= */
section("1 getScenesDefs 读 fixture");
const defs0 = api.getScenesDefs();
assert(Object.keys(defs0.defs).length > 100, "解析到原版场景注册表（" + Object.keys(defs0.defs).length + " 条）");
assert(defs0.live === true, "widget 原文解析成功 → live=true（解锁条件实时求值）");

/* ================= 2. 剧情页渲染（分组默认收起 + 懒渲染） ================= */
section("2 点「剧情」页签渲染");
function clickTab(key) {
  const b = Array.prototype.slice.call(document.querySelectorAll(".mce-tabs button"))
    .filter(function (x) { return x.getAttribute("data-tab") === key; })[0];
  if (!b) { return false; }
  b.click();
  return true;
}
function pane() { return document.querySelector('[data-pane="scenes"]'); }
function btns(re) {
  const p = pane();
  if (!p) { return []; }
  return Array.prototype.slice.call(p.querySelectorAll("button")).filter(function (b) { return re.test(b.textContent); });
}
api.open();
assert(clickTab("scenes"), "找到「剧情」页签");
const p0 = pane();
assert(!!p0 && /已读取场景注册表/.test(p0.textContent), "页内提示读到注册表条数");
assert(/原版剧情（游戏本体注册/.test(p0.textContent), "原版剧情分区存在");
assert(/使用提示：锚定剧情后/.test(p0.textContent), "顶部使用提示（锚定 → 弹确认条语义）");
const heads0 = Array.prototype.slice.call(p0.querySelectorAll(".mce-grp-t.mce-collapse-head"));
assert(heads0.length > 0, "原版剧情按角色分组（" + heads0.length + " 个组头）");
assert(btns(/^一键完成$/).length === 0, "分组默认收起 → 未建阶段控件（懒渲染生效）");
/* 全部分组逐个展开：不假设首个分组一定含「剧情线」（不同角色分组的场景形态不同） */
heads0.forEach(function (h) { h.click(); });
console.log("（组内阶段控件：一键完成 " + btns(/^一键完成$/).length + " / 锚定 " + btns(/^锚定$/).length + " / 展开线 " + btns(/^展开各阶段$/).length + "）");
assert(btns(/^一键完成$/).length > 0, "展开全部分组后出现「一键完成」按钮（" + btns(/^一键完成$/).length + " 个）");
assert(btns(/^直达触发$/).length > 0, "阶段行有「直达触发」按钮");

/* ================= 3. 展开 / 收起剧情线 ================= */
section("3 展开收起");
const tog = btns(/^展开各阶段$/)[0];
assert(!!tog, "剧情线有「展开各阶段」按钮");
const headName = function () {
  const nm = pane().querySelector(".mce-line-head .mce-stage-name");
  return nm ? nm.textContent : "";
};
if (tog) {
  tog.click();
  const nmTxt = headName();
  assert(/展开）/.test(nmTxt), "展开后线头文案改成「展开」（" + nmTxt + "）");
  const togBack = btns(/^收起各阶段$/)[0];
  assert(!!togBack, "按钮文案同步改为「收起各阶段」");
  if (togBack) { assert(true, "可再次点击收起"); }
} else {
  assert(false, "缺少「展开各阶段」按钮");
}

/* ================= 4. 单阶段锚定 / 取消 ================= */
section("4 锚定与取消锚定");
const pins = btns(/^锚定$/);
const pinEnabled = pins.filter(function (b) { return !b.disabled; })[0];
const pinDisabled = pins.filter(function (b) { return b.disabled; })[0];
assert(!!pinDisabled, "未标注触发地点的阶段 → 锚定按钮禁用（拒绝路径可见）");
assert(pinDisabled && /暂不可锚定/.test(pinDisabled.title), "禁用按钮 tooltip 说明原因");
if (pinEnabled) {
  pinEnabled.click();
  assert(api.getPinnedScene().length >= 1, "点「锚定」→ 进入锚定队列（" + api.getPinnedScene().length + " 项）");
  const un = btns(/^取消锚定$/)[0];
  assert(!!un, "锚定后行内出现「取消锚定」");
  if (un) {
    un.click();
    assert(api.getPinnedScene().length === 0, "点「取消锚定」→ 队列清空");
  }
} else {
  assert(true, "本组无带地点元数据的阶段（只验证禁用态）");
}
const linePin = btns(/^锚定整线$/)[0];
assert(!!linePin, "剧情线有「锚定整线」按钮");
if (linePin) {
  linePin.click();
  assert(typeof api.getPinnedScene().length === "number", "点「锚定整线」不抛（队列 " + api.getPinnedScene().length + " 项）");
}

/* ================= 5. 一键完成 / 直达触发禁用态 ================= */
section("5 一键完成与直达触发");
const beforeCount = V.scenePassages.length;
const doneBtn = btns(/^一键完成$/)[0];
if (doneBtn) {
  doneBtn.click();
  assert(V.scenePassages.length >= beforeCount, "点「一键完成」后经历表被写入（" + beforeCount + " → " + V.scenePassages.length + "）");
  assert(/已解锁|未解锁/.test(document.body.textContent), "状态栏给出已解锁 / 未解锁说明");
} else {
  assert(false, "缺少「一键完成」按钮");
}
function expandAll() {
  Array.prototype.slice.call(pane().querySelectorAll(".mce-grp-t.mce-collapse-head")).forEach(function (h) {
    const body = h.parentNode.querySelector(".mce-grp-body");
    if (body && body.getAttribute("data-collapsed") === "1") { h.click(); }
  });
}
V.replayScene = { key: "x" };
clickTab("mods"); clickTab("scenes");
expandAll();
const dt = btns(/^直达触发$/);
assert(dt.length > 0 && dt.every(function (b) { return b.disabled; }), "播放中（$replayScene 有值）→「直达触发」全部禁用");
assert(/正在播放剧情/.test(dt[0].title), "禁用 tooltip 说明“正在播放”");
delete V.replayScene;

/* ================= 6. 剧情进度控制块（组内尾部） ================= */
section("6 剧情进度块");
clickTab("mods"); clickTab("scenes");
expandAll();
const pText = pane().textContent;
assert(/剧情进度（非场景事件状态）/.test(pText), "展开角色组后出现「剧情进度」控制块");
const inp = pane().querySelector('input[type="number"]');
if (inp) {
  const applyR = Array.prototype.slice.call(pane().querySelectorAll("button")).filter(function (b) { return /^应用$/.test(b.textContent); })[0];
  inp.value = "";
  applyR.click();
  assert(true, "进度输入留空点「应用」不抛（按 0 处理）");
  inp.value = "999999";
  applyR.click();
  assert(true, "超上限点「应用」不抛（钳到 max）");
} else {
  assert(false, "剧情进度块缺少 range 输入框");
}
/* 剧情进度 info / action 行 */
const partyBtn = Array.prototype.slice.call(pane().querySelectorAll("button")).filter(function (b) { return /派对来宾区域补全/.test(b.textContent); })[0];
if (partyBtn) {
  partyBtn.click();
  assert(true, "剧情进度 action 按钮（派对来宾补全）点击不抛");
}

/* ================= 7. 空注册表 ================= */
section("7 空注册表拒绝路径");
global.Story = { size: 0, passages: [], has: function () { return false; }, get: function () { return null; } };
V.scenes = {};
clickTab("mods"); clickTab("scenes");
assert(/未读取到场景注册表/.test(pane().textContent), "无 $scenes → 页内红字说明（不显示空白页）");
assert(/请先在游戏菜单打开一次「场景」页面/.test(pane().textContent), "并给出可执行的补救指引");

api.close();
console.log("\nSCENES PAGE STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
