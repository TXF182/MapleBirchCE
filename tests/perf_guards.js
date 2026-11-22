/*
 * 性能守卫测试（2026-11-22 性能轮）—— 行为级断言，不测墙钟时间（避免机器差异 flaky）
 *
 * 两个真实热点（tools/perf_probe.js 基线取证：renderGlobal 12.78 ms / 404 节点）：
 *   1. 全局页写值后全量重建 → .mce-body 滚动位被钳到顶（重绘期间内容高度瞬降为 0）。
 *      守卫：renderGlobal 在当前页激活时，重绘前记 scrollTop、重绘后显式写回。
 *   2. 潜伏者「自动搬运」500ms 轮询在搬动时调 renderGlobal() —— 其守卫
 *      `root.querySelector('[data-pane="global"]')` 恒真（pane 常驻，只切 display），
 *      等于玩家在任意页/面板关闭时都每 0.5s 全量重建 404 节点。守卫：tick 只刷新 3 行数值。
 *
 * 用法：node tests/perf_guards.js（构建产物需已生成）
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
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
  player: {}, passage: "Room", mbCE_wrote: {}, mbCE_queue: [],
  hookah: { lurkers: 0 }, lurkers_held: 0, lurkers_stored: 0,
  time: { day: 1, hour: 8 }
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

window.localStorage.setItem("mbCE_ui_state_v1", JSON.stringify({ tab: "global", theme: "gold" }));

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
const SOURCE = fs.readFileSync(jsPath, "utf8");
eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

function pane() { return document.querySelector('[data-pane="global"]'); }
function findSec(word) {
  const p = pane();
  if (!p) { return null; }
  const secs = p.querySelectorAll(".mce-blockfold");
  for (let i = 0; i < secs.length; i++) {
    const t = secs[i].querySelector(".mce-sec-t");
    if (t && (t.textContent || "").trim() === word) { return secs[i]; }
  }
  return null;
}
function findBtn(sec, word) {
  if (!sec) { return null; }
  const bs = sec.querySelectorAll("button");
  for (let i = 0; i < bs.length; i++) {
    if (((bs[i].textContent || "").trim()).indexOf(word) !== -1) { return bs[i]; }
  }
  return null;
}

(async function main() {
try {
  assert(!!api && typeof api.renderGlobal === "function", "0.1 api 已挂载（renderGlobal 可用）");

  section("1. renderGlobal 保持滚动位（显式写回，不依赖浏览器 clamp）");
  api.open();
  const bodyEl = document.getElementById("mce-root").querySelector(".mce-body");
  let curTop = 0, topWrites = 0, lastWrite = -1;
  Object.defineProperty(bodyEl, "scrollTop", {
    configurable: true,
    get: function () { return curTop; },
    set: function (v) { curTop = v; topWrites++; lastWrite = v; }
  });
  Object.defineProperty(bodyEl, "scrollHeight", { configurable: true, get: function () { return 900; } });
  curTop = 300;
  topWrites = 0; lastWrite = -1;
  api.renderGlobal();
  assert(topWrites >= 1, "1.1 重绘后显式写回 scrollTop（写回次数 " + topWrites + "）");
  assert(lastWrite === 300 && curTop === 300, "1.2 写回值 = 重绘前 300（实得 " + lastWrite + "）");
  curTop = 0; topWrites = 0;
  api.renderGlobal();
  assert(topWrites === 0, "1.3 原本在顶部（0）时不写 scrollTop（无谓写入为 0）");
  /* 非激活页不恢复：切到 char 页后调用 renderGlobal（后台重建隐藏 pane），scrollTop 不应被改成 global 的值 */
  const tabsEl = document.getElementById("mce-root").querySelector(".mce-tabs");
  tabsEl.querySelector('button[data-tab="char"]').click();
  curTop = 120; topWrites = 0; lastWrite = -1;
  api.renderGlobal();
  assert(topWrites === 0, "1.4 全局页非激活时不动共享滚动容器（避免把 char 页位置改成 global 的值）");
  tabsEl.querySelector('button[data-tab="global"]').click();

  section("2. 潜伏者自动搬运 tick 局部刷新（不重建全局页）");
  api.renderGlobal();
  const lurk = findSec("潜伏者");
  assert(!!lurk, "2.1 找到潜伏者区块");
  const autoBtn = findBtn(lurk, "自动搬运");
  assert(!!autoBtn, "2.2 找到自动搬运开关");
  V.lurkers_held = 4; V.hookah = { lurkers: 0 }; V.lurkers_stored = 0;
  autoBtn.click();
  assert(V.mbCE_lurkerAuto === true, "2.3 自动搬运已开启（V.mbCE_lurkerAuto=true）");
  const p2 = pane();
  const kidsBefore = Array.prototype.slice.call(p2.children);
  const secRefs = Array.prototype.slice.call(p2.querySelectorAll(".mce-blockfold"));
  await sleep(700); /* 500ms 轮询至少跑一轮 */
  assert(V.lurkers_held === 0, "2.4 手持 4 只全部搬走（实得 " + V.lurkers_held + "）");
  assert(V.hookah.lurkers === 4, "2.5 冰箱累计到 4（实得 " + V.hookah.lurkers + "）");
  const kidsAfter = p2.children;
  let same = kidsAfter.length === kidsBefore.length;
  for (let i = 0; same && i < kidsBefore.length; i++) { same = kidsAfter[i] === kidsBefore[i]; }
  assert(same, "2.6 全局页子节点身份全部保持（未全量重建，区块 " + secRefs.length + " 个）");
  const valHeld = p2.querySelector('[data-mce-lurk="lurkers_held"]');
  const valFridge = p2.querySelector('[data-mce-lurk="hookah.lurkers"]');
  assert(!!valHeld && (valHeld.textContent || "").indexOf("（当前 0）") !== -1, "2.7 手持行文本刷新为 0（" + (valHeld && valHeld.textContent) + "）");
  assert(!!valFridge && (valFridge.textContent || "").indexOf("（当前 4）") !== -1, "2.8 冰箱行文本刷新为 4（" + (valFridge && valFridge.textContent) + "）");

  section("3. 面板关闭时 tick 只写数据、不碰 DOM");
  api.close();
  await sleep(200);
  const p3 = pane();
  const kids3 = Array.prototype.slice.call(p3.children);
  const mo = new window.MutationObserver(function () { mo.__hits = (mo.__hits || 0) + 1; });
  mo.observe(p3, { childList: true, subtree: true, characterData: true });
  V.lurkers_held = 2;
  await sleep(700);
  assert(V.lurkers_held === 0 && V.hookah.lurkers === 6, "3.1 关闭期自动搬运照常工作（冰箱 6，实得 " + V.hookah.lurkers + "）");
  let same3 = p3.children.length === kids3.length;
  for (let i = 0; same3 && i < kids3.length; i++) { same3 = p3.children[i] === kids3[i]; }
  assert(same3, "3.2 关闭期无区块重建（子节点身份保持）");
  const val3 = p3.querySelector('[data-mce-lurk="hookah.lurkers"]');
  assert(!!val3 && (val3.textContent || "").indexOf("（当前 6）") !== -1, "3.3 隐藏页数值文本同步到 6（" + (val3 && val3.textContent) + "），零节点重建");
  mo.disconnect();

  section("4. 关闭自动搬运 + 状态复位");
  api.open();
  api.renderGlobal();
  const lurk4 = findSec("潜伏者");
  const auto4 = findBtn(lurk4, "自动搬运");
  if (auto4) { auto4.click(); }
  assert(V.mbCE_lurkerAuto === false, "4.1 关闭后 V.mbCE_lurkerAuto=false");
  V.lurkers_held = 0;

  console.log("\n--- 汇总 ---");
  console.log("PASS " + passes + " / FAIL " + failures);
  if (failures) { process.exit(1); }
  process.exit(0);
} catch (e) { console.error("测试异常终止: " + (e && e.stack || e)); process.exit(1); }
})();
