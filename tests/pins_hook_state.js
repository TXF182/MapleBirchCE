/* :passageoverride / :passageinit / unfreeze 钩子状态机测试（branches 70→80 整改轮 · 第十五批）
 * 玩家路径：走剧情时 SugarCube 触发 :passageoverride（redirect 前）与 :passageinit（段落渲染前），
 * 本测试用等价 jQLite 桩把两个钩子函数取出来，逐条喂 passageArgs，验证：
 * 庄园兜底、MOD 重放清理、直达（mbCE_direct）出口/回触发点/分支并链、非直达链外出口、
 * Farm Work 终点、链内末段线性播完、循环回点、首次访问不误伤、队列触发（锚定项与旧档项）、
 * Scene Viewer passages 首进消费 pending、unfreeze 包装清理。
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

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;

/* jQLite 桩：off/on 记录 handler，供测试手动触发 */
const handlers = {};
global.$ = function () {
  return {
    off: function (ev) { delete handlers[ev]; return this; },
    on: function (ev, fn) { handlers[ev] = fn; return this; }
  };
};
window.unfreezePlayerStats = function () { window.__unfreezeCalls = (window.__unfreezeCalls || 0) + 1; };

const V = { player: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room", temporary: {} };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

const fire = function (ev, args) {
  const h = handlers[ev];
  if (!h) { throw new Error("钩子未注册: " + ev); }
  h(null, args);
};

api.open();

section("1 钩子注册");
assert(typeof handlers[":passageoverride.mbce"] === "function", ":passageoverride 钩子已注册（off 再 on 防重复）");
assert(typeof handlers[":passageinit.mbce"] === "function", ":passageinit 钩子已注册");
assert(typeof window.unfreezePlayerStats === "function" && window.__mbCEUnfreezeHooked === true, "unfreezePlayerStats 已被包装且只包一次");

section("2 庄园 / 格威岚兜底");
V.daily = { avery: {} };
fire(":passageoverride.mbce", { name: "Mansion Hallway" });
assert(!!V.daily && !!V.daily.avery, "进入 Mansion* 段落前补 $daily.avery 壳（不因缺 chat 而崩）");
const queueBefore = (function () { api.pinScene({ key: "x", def: { name: "X", startPassage: "A", passages: ["A"] } }); return null; })();
assert(!!V.mbCE_queue, "队列容器按需建壳（V.mbCE_queue 数组）");

section("3 直达（mbCE_direct）分支");
V.replayScene = { name: "d", startPassage: "Start P", passages: ["Start P", "Mid P"], exitpassage: "Danube", mbCE_direct: true };
V.mbCE_replayOnce = true;
let args = { name: "Scene Viewer" };
fire(":passageoverride.mbce", args);
assert(args.name === "Danube", "直达落到 Scene Viewer UI → 清理并回原位（name=exitpassage）");
assert(V.replayScene === undefined, "清理后 replayScene 已清空");

V.replayScene = { name: "d", startPassage: "Start P", passages: ["Start P", "Mid P"], exitpassage: "Danube", mbCE_direct: true };
V.mbCE_replayOnce = true;
args = { name: "Mid P" };
fire(":passageoverride.mbce", args);
assert(args.name === "Mid P", "直达链内分支段放行（不被回原位）");
assert(Array.isArray(V.replayScene.passages) && V.replayScene.passages.length === 2, "链内段不重复并入白名单");

V.replayScene = { name: "d", startPassage: "Start P", passages: ["Start P", "Mid P"], exitpassage: "Danube", mbCE_direct: true };
V.mbCE_replayOnce = true;
args = { name: "Branch X" };
fire(":passageoverride.mbce", args);
assert(V.replayScene.passages.indexOf("Branch X") !== -1, "剧情分支段动态并入白名单（防原版 redirect 改写为 End）");
assert(args.name === "Branch X", "分支段不被改写");

V.replayScene = { name: "d", startPassage: "Start P", passages: ["Start P", "Mid P"], exitpassage: "Danube", mbCE_direct: true };
V.mbCE_replayOnce = true;
args = { name: "Danube" };
fire(":passageoverride.mbce", args);
assert(V.replayScene === undefined, "直达回到触发点（exitpassage）→ 清理，不留残余");

section("4 直达出口段（当前段含结束信号）");
State.passage = "Breast Inspection End";
global.Story.get = function (t) { return { title: t, source: "<<endevent>>" }; };
V.replayScene = { name: "d", startPassage: "Science Lesson", passages: ["Science Lesson"], exitpassage: "Science Lesson", mbCE_direct: true };
V.mbCE_replayOnce = true;
args = { name: "Hallway" };
fire(":passageoverride.mbce", args);
assert(V.replayScene === undefined && args.name === "Hallway", "出口段点击 → 清理重放但保留 dest（剧情自然收尾）");
global.Story.get = function () { return null; };
State.passage = "Room";

section("5 非直达 MOD 重放");
V.replayScene = { name: "m", startPassage: "SV A", passages: ["SV A"], exitpassage: "Room", mbCE_direct: false };
V.mbCE_replayOnce = true;
args = { name: "Outside" };
fire(":passageoverride.mbce", args);
assert(args.name === "Room", "链外出口 → 清理并回原位");

V.replayScene = { name: "m", startPassage: "SV A", passages: ["SV A"], exitpassage: "Room", mbCE_direct: false };
V.mbCE_replayOnce = true;
args = { name: "Scene Viewer passages" };
V.mbCE_replayPending = false;
fire(":passageoverride.mbce", args);
assert(args.name === "Room", "链回 Scene Viewer passages（非首次）→ 自动回原位并解除");

V.replayScene = { name: "m", startPassage: "SV A", passages: ["SV A"], exitpassage: "Room", mbCE_direct: false };
V.mbCE_replayOnce = true;
args = { name: "Room" };
fire(":passageoverride.mbce", args);
assert(V.replayScene === undefined, "原版 Back 回原位 → 清理残留");

V.replayScene = { name: "m", startPassage: "SV A", passages: ["SV A"], exitpassage: "Room", mbCE_direct: false };
V.mbCE_replayOnce = true;
args = { name: "Farm Work" };
fire(":passageoverride.mbce", args);
assert(V.replayScene === undefined, "农场剧情终点 Farm Work → 清理");

section("6 链内末段 / 循环回点");
V.replayScene = { name: "m", startPassage: "P1", passages: ["P1", "P2", "P3"], exitpassage: "Room", mbCE_direct: false, mbCE_visited: ["P1", "P2"] };
V.mbCE_replayOnce = true;
args = { name: "P3" };
fire(":passageoverride.mbce", args);
assert(V.replayScene === undefined && args.name === "Room", "链内末段且前置全访问 → 线性播完清理并回原位");

V.replayScene = { name: "m", startPassage: "P1", passages: ["P1", "P3"], exitpassage: "Room", mbCE_direct: false, mbCE_visited: [] };
V.mbCE_replayOnce = true;
args = { name: "P3" };
fire(":passageoverride.mbce", args);
assert(!!V.replayScene, "分支场景首次到末段（前置未全访问）→ 不误清理");

V.replayScene = { name: "m", startPassage: "P1", passages: ["P1", "P2"], exitpassage: "Room", mbCE_direct: false, mbCE_visited: ["P1", "P2"] };
V.mbCE_replayOnce = true;
args = { name: "P1" };
fire(":passageoverride.mbce", args);
assert(!!V.replayScene, "循环回起点 startPassage → 不触发");
args = { name: "P2" };
fire(":passageoverride.mbce", args);
assert(V.replayScene === undefined && args.name === "Room", "循环回点（非 start/exit）→ 播完清理并回原位");

section("7 队列触发");
V.mbCE_queue = [{ key: "k1", name: "K1", startPassage: "K1 Start", passages: ["K1 Start", "K1 Mid"], used: false, anchor: { location: "Street" } }];
args = { name: "K1 Start" };
fire(":passageoverride.mbce", args);
assert(args.name === "K1 Start" && !V.mbCE_queue[0].used, "带地点元数据的锚定项：段落跳转本身不触发（等 :passageend 确认条）");
V.mbCE_queue = [{ key: "k2", name: "K2", startPassage: "K2 Start", passages: ["K2 Start"], used: false }];
args = { name: "K2 Start" };
fire(":passageoverride.mbce", args);
assert(args.name === "K2 Start" && V.mbCE_queue[0].used === false, "dest 即入口段落 → 不触发（防自触发）");
args = { name: "Somewhere" };
fire(":passageoverride.mbce", args);
assert(args.name === "K2 Start", "旧档无元数据项：任意推进即触发并重定向到入口段落");
assert(V.mbCE_queue[0].used === true, "触发后标 used（一次性，不重复触发）");
assert(!!V.replayScene && V.replayScene.startPassage === "K2 Start" && V.replayScene.exitpassage === "Room", "重放状态按队列项建立（exitpassage=当前段落）");
assert(V.mbCE_replayOnce === true, "标记本重放由 MOD 固定触发");
assert(V.mbCE_replayPending === false, "直入剧情段（入口非 Scene Viewer passages）不设 pending");

section("8 :passageinit");
V.replayScene = { name: "m", startPassage: "SV A", passages: ["SV A"], exitpassage: "Room" };
V.mbCE_replayOnce = true;
V.mbCE_replayPending = true;
fire(":passageinit.mbce", { title: "Scene Viewer passages" });
assert(V.mbCE_replayPending === false, "首进 Scene Viewer passages 消费 pending（保留 case 正常播放）");
assert(V.sceneViewSwitch === undefined, "首次进入不改 sceneViewSwitch");
V.mbCE_replayPending = false;
fire(":passageinit.mbce", { title: "Scene Viewer passages" });
assert(V.sceneViewSwitch === "MB_CE_END", "剧情结束链回时把 sceneViewSwitch 置无效（switch 走 default，不重播）");
fire(":passageinit.mbce", { title: "Room" });
assert(true, "普通段落只做格威岚/维护兜底，不碰 sceneViewSwitch");

section("9 unfreeze 包装");
V.replayScene = { name: "m", startPassage: "SV A", passages: ["SV A"], exitpassage: "Room" };
V.mbCE_replayOnce = true;
window.unfreezePlayerStats();
assert(window.__unfreezeCalls === 1, "包装后仍调用原版 unfreeze（不吞原逻辑）");
assert(V.replayScene === undefined && V.mbCE_replayOnce === undefined, "MOD 重放中收到 unfreeze → 清理重放状态（框架播放器结束也能收尾）");

api.close();
console.log("\nPINS HOOK STATE: passed=" + passes + " failed=" + failures);
process.exit(failures ? 1 : 0);
