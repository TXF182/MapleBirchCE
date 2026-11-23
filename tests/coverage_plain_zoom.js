/* 09-exports 悬浮球缩放/钳位（zoom）plain 兜底补测 — 覆盖率提升轮
 *
 * mbCEToggleLayoutPos 是纯函数（09-exports.js 导出到 window），本测试直接喂数值打三个兜底分支：
 *   L96 zs<=0 → z 兜底 1；L100 bw<=0 → 52；L101 bh<=0 → 52。
 * 判据：断言返回的 left/top 数值，验证兜底后钳位结果正确（不只判断「不抛错」）。
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
global.getSetup = function () { return global.setup; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
try { eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }

try {
  section("1 zs<=0 兜底 z=1");
  // zs=0 → mbCEToggleNum(0,1)=0 → !(0>0) → z=1；视口 100x100、球 52x52 → 左/上边界 44
  const p1 = window.mbCEToggleLayoutPos(0, 0, 0, 0, 0, 100, 100, 52, 52);
  assert(p1 && p1.left === 0 && p1.top === 0, "zs=0 → z 兜底 1，left/top 正常钳位为 0");

  section("2 bw/bh<=0 兜底 52");
  // bw=0 → L100 bwl=52；bh=0 → L101 bhl=52；视口 200x200 → 边界 144，起点 (10,20) 落在边界内
  const p2 = window.mbCEToggleLayoutPos(10, 20, 0, 0, 1, 200, 200, 0, 0);
  assert(p2 && p2.left === 10 && p2.top === 20, "bw/bh<=0 → 兜底 52，起点 (10,20) 未越界");

  section("3 越界钳制（兜底后仍受视口约束）");
  // 起点 (1000,1000) 越界 → 钳到 44（w-bwl-4 = 100-52-4）
  const p3 = window.mbCEToggleLayoutPos(1000, 1000, 0, 0, 1, 100, 100, 52, 52);
  assert(p3 && p3.left === 44 && p3.top === 44, "越界起点 → 钳到视口右下边界 44");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
