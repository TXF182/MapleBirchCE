/* 框架缺失拒绝路径（branches 门槛 70→80 整改轮）
 *
 * 为什么单独一个文件：产物里的 resolveMB() 首次解析成功会把框架对象缓存进模块级变量 MB，
 * 之后再置空 window.maplebirch 也改不动（这是刻意的缓存，避免每次渲染重查）。
 * 所以要验证「没装 Maplebirch 框架」时的拒绝分支，必须在**全新实例**里。
 *
 * 断言目标（玩家可见行为，不是内部实现）：
 *   1) 面板照样建出来（悬浮球是唯一入口，不能因为框架缺失就连入口都没有 → 玩家无法自救）；
 *   2) 状态栏写明「未检测到 Maplebirch 框架」（不白屏、不静默）；
 *   3) 各渲染入口 + 各页签切换全部不抛异常；
 *   4) 不产生任何写入留痕（V.mbCE_wrote 必须为空）。
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

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
} catch (e) { console.log("WARN: select.type patch 跳过：" + e.message); }

const V = { player: {}, passage: "Room", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
/* 关键：不装框架。window.maplebirch / window.modUtils / setup.MapleBirch 全部缺省 */
window.__mbCE_forceSyncRows = true;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath + "，先 node tools/build_js.js"); process.exit(1); }
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));

const api = setup.mbStageCE;
assert(!!api, "无框架环境下 setup.mbStageCE 仍挂载（面板入口不能被框架缺失吞掉）");
assert(!!document.querySelector("#mce-root"), "无框架环境下 #mce-root 仍建出（玩家能看到面板并读到拒绝原因）");

const status = document.querySelector("#mce-root .mce-status");
const initText = status ? status.textContent : ""; /* 元素是活的，先快照文本再 refresh */
/* init 只建面板不渲染（首次渲染由玩家点悬浮球触发），所以这里主动走一次 refresh，
   验证的才是"玩家真点了"的那条拒绝路径 */
api.refresh();
const status2 = document.querySelector("#mce-root .mce-status");
assert(!!status2 && String(status2.textContent).indexOf("未检测到 Maplebirch 框架") !== -1,
  "点开面板（refresh）后状态栏给出「未检测到 Maplebirch 框架」，实际 " + (status2 ? status2.textContent : "无状态栏"));
assert(!!status2 && /mce-err/.test(status2.className), "状态栏用错误样式（mce-err）而非正常色，实际 className=" + (status2 ? status2.className : ""));
assert(initText === "就绪", "初始状态栏文本为「就绪」（未渲染前不假装成功），实际 " + initText);

/* 各渲染入口：必须不抛 */
const entries = ["refresh", "renderCards", "renderPlaces", "renderModCheats", "renderPlayerEdit", "renderYanling", "listCharacters",
  "getCheatMods", "listPlaceGroups", "getScenesDefs", "getVanillaStages", "getRomanceStages"];
entries.forEach(function (k) {
  if (typeof api[k] !== "function") { console.log("WARN: 导出缺 " + k + "（导出面变化）"); return; }
  try {
    const r = api[k]();
    assert(true, "无框架时 " + k + "() 不抛（返回 " + (r === undefined ? "undefined" : typeof r) + "）");
  } catch (e) { failures++; console.error("FAIL: 无框架时 " + k + "() 抛出 " + e.message); }
});
/* open / close / toggle：面板开关链不能因框架缺失而崩 */
try { api.open(); assert(true, "无框架时 open() 不抛"); } catch (e) { failures++; console.error("FAIL: 无框架时 open() 抛出 " + e.message); }
try { api.close(); assert(true, "无框架时 close() 不抛"); } catch (e) { failures++; console.error("FAIL: 无框架时 close() 抛出 " + e.message); }
try { api.toggle(); assert(true, "无框架时 toggle() 不抛"); } catch (e) { failures++; console.error("FAIL: 无框架时 toggle() 抛出 " + e.message); }

/* 七个页签逐个切换：每个 pane 渲染都要扛住无框架 */
api.open();
["char", "stage", "scenes", "places", "global", "mods", "yanling"].forEach(function (tab) {
  const b = [].slice.call(document.querySelectorAll(".mce-tabs button")).filter(function (x) { return x.getAttribute("data-tab") === tab; })[0];
  if (!b) { console.log("WARN: 页签 " + tab + " 不存在（面板结构变化）"); return; }
  try { b.click(); assert(true, "无框架时切页签 " + tab + " 不抛"); }
  catch (e) { failures++; console.error("FAIL: 无框架时切页签 " + tab + " 抛出 " + e.message); }
});
assert(Object.keys(V.mbCE_wrote || {}).length === 0, "无框架时全程零写入留痕（mbCE_wrote 条数 " + Object.keys(V.mbCE_wrote || {}).length + "）");
/* 写入入口直接调用：必须被拒绝，而不是写进假数据 */
if (typeof api.applyCheatModValue === "function") {
  try {
    const r = api.applyCheatModValue("no-such-mod", "no-such-key", 1);
    const refused = r === false || r === null || r === undefined || (r && r.ok === false) || (r && typeof r.message === "string");
    assert(refused, "无框架时 applyCheatModValue 走拒绝（返回 " + JSON.stringify(r) + "）");
  } catch (e) { failures++; console.error("FAIL: 无框架时 applyCheatModValue 抛出 " + e.message); }
}

console.log("\nNO-FRAMEWORK REFUSAL: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
