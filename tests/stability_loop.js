/*
 * 面板开关循环回归（v2.0.x 工程收敛轮新增）
 *
 * 解决的问题：面板 open() 会重渲染，close() 有 130ms 淡出定时器。历史上「反复开关后越来越卡」
 * 属于用户实际报过的症状（四巡做过内存/CPU 有界化），但此前没有一条断言直接盯「循环不累积」。
 *
 * 只看四件事，全部可机读：
 *   1. 重复 toggle 不会重复创建 #mce-root / #mce-toggle（单例约束）
 *   2. 多轮 open 后 DOM 节点数不增长（渲染不堆积）
 *   3. close 后淡出定时器按时收敛（mce-open 被移除，不留 display:flex 假开态）
 *   4. 悬浮球事件不重复绑定（30 轮后点一次仍只切换一次状态）
 *
 * 用法：node tests/stability_loop.js（需先生成产物：node tools/build_js.js）
 */
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

/* ---------- jsdom 环境（与 smoke_dom 同口径） ---------- */
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;
try {
  Object.defineProperty(window.HTMLSelectElement.prototype, "type", {
    get: function () { return "select-one"; },
    set: function () { throw new TypeError("Cannot set property type of #<HTMLSelectElement> which has only a getter"); },
    configurable: true
  });
} catch (e) { console.error("WARN: patch select.type 失败:", e.message); }

const V = {
  player: { virginity: { vaginal: true, penile: false }, charisma: 10, beauty: 20, physique: 30, willpower: 40, awareness: 50, arousal: 60, exhibitionism: 70, deviancy: 80, purity: 90, trauma: 10, stress: 5, stress100: 5, control: 50 },
  temple_burden: 0,
  loveInterest: [],
  passage: "Room",
  scenePassages: [],
  world_corruption_hard: 2, world_corruption_soft: 0,
  mbCE_wrote: {}
};
global.V = V;
global.State = { variables: V };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [] };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };

window.__mbCE_forceSyncRows = true;
/* v2.0.3 覆盖率归因修复：eval 执行的脚本必须带 //# sourceURL，否则 V8 把覆盖率记到
   evalmachine.<anonymous>，`c8 --include=javascript/maplebirchce.js` 会整段丢弃本测试的执行。
   这是 C 维长期只统计 test_mce 一个测试、UI 惰性渲染全部"零覆盖"的根因。 */
const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
const js = fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/");
eval(js);
const api = setup.mbStageCE;

/* ---------- 1. 单例约束 ---------- */
assert(!!api && typeof api.toggle === "function" && typeof api.open === "function" && typeof api.close === "function",
  "api 暴露 toggle/open/close");
assert(document.querySelectorAll("#mce-root").length === 1, "初始 #mce-root 唯一，实际 " + document.querySelectorAll("#mce-root").length);
assert(document.querySelectorAll("#mce-toggle").length === 1, "初始 #mce-toggle 唯一，实际 " + document.querySelectorAll("#mce-toggle").length);

/* ---------- 2. 多轮 open 后节点数不增长 ---------- */
const nodeCount = () => document.querySelectorAll("*").length;
api.open();
const n1 = nodeCount();
for (let i = 0; i < 20; i++) { api.open(); }
const n2 = nodeCount();
assert(n1 === n2, "连续 20 次 open 后 DOM 节点数不增长（" + n1 + " → " + n2 + "）");

/* ---------- 3. toggle 30 轮仍单例 ---------- */
for (let i = 0; i < 30; i++) { api.toggle(); }
assert(document.querySelectorAll("#mce-root").length === 1, "30 轮 toggle 后 #mce-root 仍唯一，实际 " + document.querySelectorAll("#mce-root").length);
assert(document.querySelectorAll("#mce-toggle").length === 1, "30 轮 toggle 后 #mce-toggle 仍唯一，实际 " + document.querySelectorAll("#mce-toggle").length);
assert(nodeCount() <= n2 * 1.02, "30 轮 toggle 后节点数未越界（" + nodeCount() + " vs 基准 " + n2 + "）");

/* ---------- 4. 事件不重复绑定：点一次只切换一次 ---------- */
api.close();
const toggleBtn = document.getElementById("mce-toggle");
const before = (toggleBtn.classList && toggleBtn.classList.contains("mce-open")) ? "open" : "unknown";
api.open();
const root = document.getElementById("mce-root");
const wasOpen = root.classList.contains("mce-open");
toggleBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
/* close() 是 130ms 淡出：mce-open 不会立刻消失，但 mce-closing 会立刻加上。
   若监听重复绑定，第二次 toggle 会把 mce-closing 又清掉并重开 → 本断言正好能抓。 */
assert(wasOpen === true && root.classList.contains("mce-closing") === true,
  "点击悬浮球只触发一次切换（关闭淡出被触发一次，未叠加监听）");

/* ---------- 5. close 淡出定时器收敛 ---------- */
api.close();
assert(root.classList.contains("mce-closing"), "close 后进入淡出态（mce-closing）");
setTimeout(function () {
  assert(!root.classList.contains("mce-open"), "130ms 后 mce-open 已移除（不留假开态）");
  assert(!root.classList.contains("mce-closing"), "130ms 后 mce-closing 也清除");
  api.open();
  assert(root.classList.contains("mce-open"), "再次 open 恢复正常开态");
  console.log(failures === 0 ? "\nSTABILITY LOOP ALL PASSED" : "\nSTABILITY LOOP FAILED: " + failures);
  process.exit(failures === 0 ? 0 : 1);
}, 220);
