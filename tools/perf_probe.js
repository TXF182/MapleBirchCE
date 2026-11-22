/*
 * 性能探针（只读测量，不做断言）—— 2026-11-22 P0–P2 之后的性能体检
 *
 * 口径（可复查）：
 *   - jsdom harness 与 tests/ui_shell4_state.js 相同；只走公开 API（setup.mbStageCE）与真实 DOM 点击，
 *     不直接调用 IIFE 内部函数（产物整体包在 (function(){...})() 里，外部不可见）。
 *   - V 为最小样本（无 NPC 注册池），char 页因「注册池为空」不渲染；global 页各分组缺字段时按自身守卫
 *     早退 —— 测的是「最小真实形态」成本。jsdom 绝对耗时约为真实浏览器 2–5 倍，只做同环境前后对比。
 *   - 指标：open 首帧 / 7 页切换 / renderGlobal（重复点 global 页签）/ 全局页节点数 / 一次「应用」写值 /
 *     localStorage 次数与字节 / lurker 自动搬运 500ms 轮询引发的全量重绘（MutationObserver 统计 pane
 *     直接子节点的「先删后加」）/ 10 次 open-close 节点增量（泄漏）
 *
 * 用法：node tools/perf_probe.js
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
window.matchMedia = function (q) {
  return { matches: false, media: q, onchange: null, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
};

const V = {
  player: {}, passage: "Room",
  mbCE_wrote: {}, mbCE_queue: [],
  hookah: { lurkers: 0 }, lurkers_held: 0, lurkers_stored: 0,
  time: { day: 1, hour: 8 }, money: 100
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };

let lsWrites = 0, lsBytes = 0;
const origSet = window.Storage.prototype.setItem;
window.Storage.prototype.setItem = function (k, v) {
  try { lsWrites++; lsBytes += String(v == null ? "" : v).length; } catch (e) {}
  return origSet.call(this, k, v);
};

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
const SOURCE = fs.readFileSync(jsPath, "utf8");
eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
if (!api || typeof api.open !== "function") { console.error("FAIL: api 未挂载"); process.exit(1); }

function nowMs() { return Number(process.hrtime.bigint()) / 1e6; }
function timeIt(fn) { const t0 = nowMs(); fn(); return nowMs() - t0; }
function root() { return document.getElementById("mce-root"); }
function paneNodes() { const p = document.querySelector('[data-pane="global"]'); return p ? p.querySelectorAll("*").length : -1; }
function findSec(word) {
  const p = document.querySelector('[data-pane="global"]');
  if (!p) { return null; }
  const secs = p.querySelectorAll(".mce-blockfold");
  for (let i = 0; i < secs.length; i++) {
    const t = secs[i].querySelector(".mce-sec-t");
    if (t && (t.textContent || "").trim() === word) { return secs[i]; }
  }
  return null;
}
function findBtn(sec, word, exact) {
  if (!sec) { return null; }
  const bs = sec.querySelectorAll("button");
  for (let i = 0; i < bs.length; i++) {
    const t = (bs[i].textContent || "").trim();
    if (exact ? t === word : t.indexOf(word) !== -1) { return bs[i]; }
  }
  return null;
}
const results = [];
function rec(name, value, unit) { results.push({ name: name, value: value, unit: unit }); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 1. open 首帧 */
rec("open 首帧（ensureDom + 当前页）", timeIt(function () { api.open(); }).toFixed(2), "ms");

/* 2. 7 页切换 */
const tabs = ["char", "stage", "scenes", "places", "global", "mods", "yanling"];
tabs.forEach(function (t) {
  const btn = root().querySelector('.mce-tabs button[data-tab="' + t + '"]');
  rec("切页 " + t, timeIt(function () { if (btn) { btn.click(); } }).toFixed(2), "ms");
});
rec("全局页 DOM 节点数", paneNodes(), "个");

/* 3. renderGlobal 重复点 global 页签 5 次（每次都会全量重建） */
let gMs = 0;
const gBtn = root().querySelector('.mce-tabs button[data-tab="global"]');
for (let i = 0; i < 5; i++) { gMs += timeIt(function () { gBtn.click(); }); }
rec("renderGlobal 单次均值（5 次）", (gMs / 5).toFixed(2), "ms");

/* 4. 一次「应用」写值（潜伏者手持行）→ 内部 renderGlobal */
let writeMs = -1;
const lurkSec = findSec("潜伏者");
const applyBtn = findBtn(lurkSec, "应用", true);
if (applyBtn) {
  const inp = lurkSec.querySelector("input");
  if (inp) { inp.value = "3"; }
  writeMs = timeIt(function () { applyBtn.click(); });
}
rec("一次应用（写值 + 全量重绘）", writeMs >= 0 ? writeMs.toFixed(2) : "N/A", "ms");

/* 5. localStorage 成本 */
rec("localStorage setItem 次数", lsWrites, "次");
rec("localStorage 写入总字节", lsBytes, "B");

/* 6. lurker 自动搬运轮询：是否引发全量重绘 */
const gp = document.querySelector('[data-pane="global"]');
let fullRebuilds = 0, nodeChanges = 0;
const mo = new window.MutationObserver(function (muts) {
  muts.forEach(function (m) {
    nodeChanges++;
    if (m.type === "childList" && m.target === gp && m.removedNodes.length && m.addedNodes.length) { fullRebuilds++; }
  });
});
mo.observe(gp, { childList: true, subtree: true, characterData: true });
const autoBtn = findBtn(findSec("潜伏者"), "自动搬运");
let autoToggled = false;
if (autoBtn) { autoBtn.click(); autoToggled = true; }
V.lurkers_held = 9; /* 下一次 tick 会搬 → 旧实现会 renderGlobal 全量重建 */

sleep(1400).then(function () {
  rec("lurker 轮询 1.4s 内全量重绘", fullRebuilds, "次");
  rec("lurker 轮询 1.4s 内节点变更", nodeChanges, "次");
  rec("自动搬运是否成功开启（V.mbCE_lurkerAuto）", V.mbCE_lurkerAuto === true ? 1 : 0, "");
  if (autoToggled) { try { autoBtn.click(); } catch (e) {} } /* 关掉，防 500ms timer 干扰后续 */
  V.lurkers_held = 0;

  /* 7. 10 次 open-close 节点增长 */
  const before = root().querySelectorAll("*").length;
  for (let i = 0; i < 10; i++) { api.open(); api.close(); }
  rec("10 次 open-close 节点增量", root().querySelectorAll("*").length - before, "个");

  console.log("\n===== perf probe 结果 =====");
  results.forEach(function (r) { console.log("  " + r.name + ": " + r.value + " " + r.unit); });
  console.log("提示：jsdom 绝对值约为真实浏览器 2–5 倍；同一环境前后两轮对比即可。");
  process.exit(0);
});
