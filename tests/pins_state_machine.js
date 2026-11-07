/* 锚定触发状态机测试（branches 门槛 70→80 整改轮 / 任务 #165 的自动化验收面）
 *
 * 覆盖对象：07f-pins2-anchor.js（场景锚定元数据 / 前置判定 / 确认条）、
 *           07f-pins3-queue.js（锚定入队 / 整线锚定 / 队首匹配）、
 *           07f-pins3-queue2.js（取消 / 清理已触发项 / 重放启动 / 直达）
 *
 * 断言原则：每条都对应玩家会真实遇到的一种状态（重复锚定、暂无地点元数据、农场线未开、
 * 确认条暂不触发后的冷却、换地点后残留条、双击立即触发、播放完的已完成标记…），
 * 不是为了让覆盖率数字好看而空跑。
 *
 * 场景数据来源：tests/fixtures/scenes-widget.twee（68 KB，从原版抽出的 $scenes 元数据），
 * 所以本测试在干净克隆 / CI 上同样可跑。
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
try {
  Object.defineProperty(window.HTMLSelectElement.prototype, "type", {
    get: function () { return "select-one"; },
    set: function () { throw new TypeError("Cannot set property type of #<HTMLSelectElement> which has only a getter"); },
    configurable: true
  });
} catch (e) { console.log("WARN: select.type patch 跳过：" + e.message); }

const V = { player: {}, passage: "Room", mbCE_wrote: {}, mbCE_queue: [] };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };
window.__mbCE_forceSyncRows = true;

/* 场景元数据：入库 fixture（原版优先，缺失回退 fixture 与 smoke 第 15 节同口径） */
const FIXTURE = path.join(__dirname, "fixtures", "scenes-widget.twee");
const GAME_HTML = process.env.MCE_DOL_HTML || "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
function loadScenesText() {
  if (fs.existsSync(GAME_HTML)) {
    const html = fs.readFileSync(GAME_HTML, "utf8");
    const re = /<tw-passagedata[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/tw-passagedata>/g;
    let pm;
    while ((pm = re.exec(html)) !== null) {
      const t = pm[2].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      if (t.indexOf('<<widget "scenes">>') !== -1) return t;
    }
  }
  if (fs.existsSync(FIXTURE)) return fs.readFileSync(FIXTURE, "utf8");
  return null;
}
const scenesText = loadScenesText();
if (!scenesText) { console.error("FAIL: 既无原版 HTML 也无 fixture，场景元数据不可得"); process.exit(1); }
global.Story.passages = [{ name: "scenes", text: scenesText }];
global.Story.size = 1;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(!!api, "setup.mbStageCE 已挂载");

/* ---------- 基础数据 ---------- */
const defs = api.getScenesDefs();
assert(!!defs && !!defs.defs, "getScenesDefs 解析出场景定义（依赖 fixture）");
const keys = Object.keys(defs.defs || {});
assert(keys.length > 50, "场景定义规模 > 50（实际 " + keys.length + "）");

/* 找一个有静态地点元数据的 key（供后续入队/触发用） */
let anchorKey = null, anchorMeta0 = null, anchorKey2 = null;
for (let i = 0; i < keys.length; i++) {
  const m = api.sceneAnchorMeta(keys[i], defs.defs[keys[i]]);
  if (m && m.location) {
    if (!anchorKey) { anchorKey = keys[i]; anchorMeta0 = m; }
    else if (m.location === anchorMeta0.location && keys[i] !== anchorKey) { anchorKey2 = keys[i]; break; }
  }
}
assert(!!anchorKey, "至少存在一个带静态地点元数据的场景（找到 " + anchorKey + " → " + (anchorMeta0 && anchorMeta0.location) + "）");
assert(!!anchorKey2, "存在第二个同地点场景（冷却/同地点多锚定用例需要，找到 " + anchorKey2 + "）");

/* ================= 1. 锚定元数据解析 ================= */
section("1 锚定元数据 sceneAnchorMeta");
let metaHit = 0, metaMiss = 0, metaErr = 0;
keys.forEach(function (k) {
  try {
    const m = api.sceneAnchorMeta(k, defs.defs[k]);
    if (m && m.location) metaHit++; else metaMiss++;
  } catch (e) { metaErr++; }
});
assert(metaErr === 0, "全量场景元数据解析零异常（" + keys.length + " 个）");
assert(metaHit > 0 && metaMiss >= 0, "元数据命中 " + metaHit + " / 未命中 " + metaMiss + "（未命中走旧档段落跳转语义，允许存在）");
/* mvc 提取分支：def 缺 mvc 时回退 getScenesDefs；无 $location 的 mvc → null；有 $location 的 mvc → 命中 */
assert(api.sceneAnchorMeta("NoSuchSceneKeyXYZ", null) === null, "未知 key + def=null → null（不抛）");
assert(api.sceneAnchorMeta("NoSuchSceneKeyXYZ", { manualVariableChanges: "<<set $nothing to 1>>" }) === null,
  "mvc 无 $location → null");
const mvcMeta = api.sceneAnchorMeta("NoSuchSceneKeyXYZ", { manualVariableChanges: "<<set $location to 'pub'>>" });
assert(!!mvcMeta && mvcMeta.location === "pub", "mvc 含 $location → 提取为地点（实际 " + JSON.stringify(mvcMeta) + "）");
const mvcMeta2 = api.sceneAnchorMeta("NoSuchSceneKeyXYZ", { manualVariableChanges: "<<location 'mall'>>" });
assert(!!mvcMeta2 && mvcMeta2.location === "mall", "<<location 'x'>> 写法同样可提取（实际 " + JSON.stringify(mvcMeta2) + "）");
/* 位宽兼容：AlexFarmWorkStage3 → 两位 key 查找（命中或未命中都不能抛） */
assert(api.sceneAnchorMeta("AlexFarmWorkStage3", {}) === null || typeof api.sceneAnchorMeta("AlexFarmWorkStage3", {}) === "object",
  "AlexFarmWorkStage3 位宽兼容分支不抛");

/* ================= 2. 入队拒绝路径 ================= */
section("2 pinScene 拒绝路径");
V.mbCE_queue = [];
assert(api.pinScene(null).ok === false, "pinScene(null) → 拒绝（无场景定义）");
assert(api.pinScene({}).ok === false, "pinScene({}) → 拒绝");
assert(api.pinScene({ key: "k", def: {} }).ok === false, "def 无 startPassage → 拒绝");
const r2 = api.pinScene({ key: "k", def: { startPassage: "SomePassage" } });
assert(r2.ok === false && /未标注触发地点/.test(r2.message), "def 无地点元数据 → 拒绝并说明原因（实际：" + r2.message + "）");
/* 农场依赖：startPassage 必须是 Scene Viewer passages 且 mvc 含 farm_work_update */
const r2b = api.pinScene({ key: "k", def: { startPassage: "Scene Viewer passages", manualVariableChanges: "<<set _x to 1>> <<exec $farm_work_update>>" } });
assert(r2b.ok === false && /未标注触发地点|依赖农场/.test(r2b.message), "农场依赖场景（$farm 未初始化）→ 拒绝入队（实际：" + r2b.message + "）");

/* ================= 3. 入队成功 + 去重 + 队列索引 ================= */
section("3 pinScene 入队 / 去重 / 索引");
const pinOk = api.pinScene({ key: anchorKey, def: defs.defs[anchorKey] });
assert(pinOk.ok === true, "带地点元数据的场景可入队（" + pinOk.message + "）");
assert(V.mbCE_queue.length === 1, "队列长度 1，实际 " + V.mbCE_queue.length);
assert(V.mbCE_queue[0].used === false && !!V.mbCE_queue[0].anchor, "队列项 used=false 且带 anchor 元数据");
const pinDup = api.pinScene({ key: anchorKey, def: defs.defs[anchorKey] });
assert(pinDup.ok === false && /已在锚定队列/.test(pinDup.message), "重复锚定同一场景 → 拒绝（实际：" + pinDup.message + "）");
assert(api.pinQueueIndex(anchorKey) === 0, "pinQueueIndex 命中返回 0");
assert(api.pinQueueIndex("no-such-key") === -1, "pinQueueIndex 未命中返回 -1");
assert(api.getPinnedScene().length === 1, "getPinnedScene 返回 1 个未触发项");

/* ================= 4. 整线锚定（混合成败） ================= */
section("4 pinSceneLine 混合结果");
V.mbCE_queue = [];
const lineMix = api.pinSceneLine({
  prefix: "测试线",
  items: [
    { key: anchorKey, def: defs.defs[anchorKey] },
    { key: "no-meta-key-x", def: { startPassage: "P1" } },
    { key: anchorKey, def: defs.defs[anchorKey] }
  ]
});
assert(lineMix.ok === true && /跳过/.test(lineMix.message), "整线锚定：1 个入队 + 2 个跳过并回报（" + lineMix.message + "）");
assert(V.mbCE_queue.length === 1, "整线锚定后队列长度仍 1（去重生效）");
assert(api.pinSceneLine({ items: [{ key: "only-meta-missing", def: { startPassage: "P2" } }] }).ok === false,
  "整线全部不可锚定 → 拒绝");
assert(api.pinSceneLine({ items: [] }).ok === false, "空线 → 拒绝");
assert(api.pinSceneLine(null).ok === false, "null 线 → 拒绝");

/* ================= 5. 段末判定：地点匹配 / 冷却 / 残留条 ================= */
section("5 mbCEOnPassageEnd 触发判定");
V.mbCE_queue = [];
api.pinScene({ key: anchorKey, def: defs.defs[anchorKey] });
const locA = V.mbCE_queue[0].anchor.location;
V.location = "别的地点-xyz";
api.mbCEOnPassageEnd();
assert(!document.querySelector(".mce-anchor-prompt"), "地点不匹配 → 不弹确认条");
V.location = locA;
api.mbCEOnPassageEnd();
const promptEl = document.querySelector(".mce-anchor-prompt");
assert(!!promptEl, "地点匹配 → 弹确认条（" + locA + "）");
assert(!!promptEl && /是否立即触发/.test(promptEl.textContent), "确认条文案含「是否立即触发」");
assert(!!promptEl && /触发前置/.test(promptEl.textContent), "确认条写明触发前置状态（无前置时显示「触发前置：无」）");
/* 换地点：残留条自动收起（五轮实机修复的回归面） */
V.location = "别的地点-xyz";
api.mbCEOnPassageEnd();
assert(!document.querySelector(".mce-anchor-prompt"), "离开触发地点 → 残留确认条自动收起");
/* 暂不触发 → 同 key 冷却 60s 内不再弹（静默走过的玩家路径） */
V.location = locA;
api.mbCEOnPassageEnd();
const skipBtn = [].slice.call(document.querySelectorAll(".mce-anchor-prompt button")).filter(function (b) { return b.textContent === "暂不触发"; })[0];
assert(!!skipBtn, "确认条含「暂不触发」按钮");
if (skipBtn) skipBtn.click();
assert(!document.querySelector(".mce-anchor-prompt"), "点「暂不触发」→ 确认条收起");
api.mbCEOnPassageEnd();
assert(!document.querySelector(".mce-anchor-prompt"), "冷却期内同场景不再弹（队列项保留待下次）");
assert(api.getPinnedScene().length === 1, "冷却不消耗队列项（仍是 1 个待触发）");

/* ================= 6. 立即触发（引擎桩）+ 双击防重入 ================= */
section("6 立即触发 / 防重入 / 清理");
let played = [];
window.wikifier = function () { return true; };
window.Engine = { play: function (p) { played.push(p); return true; } };
api.mbCEOnPassageEnd(); /* 冷却中不弹 → 直接走 startAnchoredReplay 验证 */
/* 真实路径：确认条的闭包持有的是队列项本身，所以这里也传队列项（不是复制体），
   P.used=true 才会真的落在队列项上——这正是「六轮 used 被冻结快照还原」要防的东西 */
const rr = api.startAnchoredReplay(V.mbCE_queue[0]);
assert(rr.ok === true, "startAnchoredReplay 成功（引擎桩被调用：" + played.join(",") + "）");
assert(V.mbCE_queue[0].used === true, "触发后队列项 used=true（冻结前写入，防复活）");
assert(!!V.replayScene && V.replayScene.startPassage === V.mbCE_queue[0].startPassage, "重放状态写入 V.replayScene（入口 = 队列项 startPassage）");
assert(V.mbCE_replayOnce === true, "mbCE_replayOnce=true（播放完不重播）");
const rr2 = api.startAnchoredReplay({ key: "k2", name: "第二次", startPassage: "Room", used: false });
assert(rr2.ok === false && /已有重放在进行中/.test(rr2.message), "重放进行中再次触发 → 拒绝（防 exitpassage 覆盖，实际：" + rr2.message + "）");
/* 段末清理：used 项移出队列 + 记「已完成」 */
delete V.replayScene;
api.mbCEOnPassageEnd();
assert(V.mbCE_queue.length === 0, "段末清理把 used 项移出队列（实际剩 " + V.mbCE_queue.length + "）");
assert(!!V.mbCE_completedScenes && !!V.mbCE_completedScenes[anchorKey], "清理时记入 mbCE_completedScenes（剧情页显示「已完成 ✓」）");

/* ================= 7. startAnchoredReplay 拒绝路径 ================= */
section("7 startAnchoredReplay 拒绝路径");
delete V.replayScene;
/* 前面的成功触发会调用 ensureFarmState() 补齐 V.farm（这是设计），
   所以验"农场未开"必须先清掉，否则测的不是拒绝分支 */
delete V.farm;
assert(api.startAnchoredReplay(null).ok === false, "P=null → 拒绝");
assert(api.startAnchoredReplay({ name: "x" }).ok === false, "P 无 startPassage → 拒绝");
const rrFarm = api.startAnchoredReplay({ name: "农场线", startPassage: "Scene Viewer passages", manualVariableChanges: "$farm_work_update", used: false });
assert(rrFarm.ok === false, "农场依赖 + $farm 未初始化 → 拒绝（实际：" + rrFarm.message + "）");
V.farm = {};
const rrNoEngine = (function () {
  const savedEngine = window.Engine;
  delete window.Engine;
  try { return api.startAnchoredReplay({ name: "无引擎", startPassage: "Room", used: false }); }
  finally { window.Engine = savedEngine; }
})();
assert(rrNoEngine.ok === false && /引擎不可用/.test(rrNoEngine.message), "无引擎 → 拒绝并提示刷新（实际：" + rrNoEngine.message + "）");
delete V.farm;
delete V.replayScene;

/* ================= 8. 直达触发 ================= */
section("8 directTriggerScene");
const drBad = api.directTriggerScene("NoSuchSceneKeyXYZ");
assert(drBad.ok === false && /未找到剧情/.test(drBad.message), "未知 key → 拒绝（实际：" + drBad.message + "）");
const drNoEntry = api.directTriggerScene("no-meta-key-x");
assert(drNoEntry.ok === false, "无入口段落 → 拒绝");
const drOk = api.directTriggerScene(anchorKey);
assert(drOk.ok === true, "真实场景可直达（" + (drOk.message || "") + "）");
assert(!!V.replayScene && V.replayScene.mbCE_direct === true, "直达标记 mbCE_direct=true（不冻结数值）");
const drBusy = api.directTriggerScene(anchorKey);
assert(drBusy.ok === false && /播放中/.test(drBusy.message), "播放中再直达 → 拒绝（实际：" + drBusy.message + "）");
delete V.replayScene;

/* ================= 9. 取消锚定 / 清空 ================= */
section("9 unpinScene");
V.mbCE_queue = [];
/* 用第二个同地点场景：第一个 key 还处在 60s 冷却里，用它会让「取消前确认条在展示」前置不成立 */
api.pinScene({ key: anchorKey2, def: defs.defs[anchorKey2] });
V.location = anchorMeta0.location;
api.mbCEOnPassageEnd();
assert(!!document.querySelector(".mce-anchor-prompt"), "取消前确认条在展示（前置）");
const un = api.unpinScene(anchorKey2);
assert(V.mbCE_queue.length === 0, "取消指定 key → 队列清空（" + (un && un.message ? un.message : "") + "）");
assert(!document.querySelector(".mce-anchor-prompt"), "取消锚定时连带收起正在展示的确认条");
let unEmpty = null;
try { unEmpty = api.unpinScene(); } catch (e) { failures++; console.error("FAIL: 空队列取消抛出 " + e.message); }
assert(unEmpty === false || (unEmpty && typeof unEmpty === "object"), "空队列取消不抛异常（返回 " + JSON.stringify(unEmpty) + "）");
api.pinScene({ key: anchorKey2, def: defs.defs[anchorKey2] });
api.unpinScene();
assert(V.mbCE_queue.length === 0, "unpinScene() 无参 → 清空全部");

/* ================= 10. 旧键迁移 getPinQueue ================= */
section("10 旧版 mbCE_pinned 迁移");
V.mbCE_queue = [];
delete V.mbCE_queue;
V.mbCE_pinned = { active: true, key: "legacy-key", name: "旧固定", startPassage: "LegacyPassage", passages: [] };
const qMigration = api.getPinnedScene();
assert(V.mbCE_queue.length === 1 && V.mbCE_queue[0].used === true, "旧 mbCE_pinned 迁移入队并标 used=true（已触发过不再重复）");
assert(!V.mbCE_pinned, "迁移后旧键被删除（幂等）");
assert(qMigration.length === 0, "迁移项 used=true → 不算待触发项");
api.getPinnedScene();
assert(V.mbCE_queue.length === 1, "重复调用不重复迁移（幂等）");

/* ================= 11. 确认条主题与时间提示 ================= */
section("11 showAnchorPrompt 主题 / 时间提示");
api.setTheme("starry");
const P = { key: anchorKey, name: "主题测试", startPassage: "Room" };
api.showAnchorPrompt(P, { location: anchorMeta0.location, timeNote: "夜晚" });
const el11 = document.querySelector(".mce-anchor-prompt");
assert(!!el11 && el11.className.indexOf("mce-theme-starry") !== -1, "starry 主题下确认条带 mce-theme-starry 类");
assert(!!el11 && /时间 夜晚/.test(el11.textContent), "timeNote 写入文案（时间 夜晚）");
assert(!!el11 && /检测到锚定剧情「主题测试」/.test(el11.textContent), "确认条带场景名");
api.hideAnchorPrompt();
assert(!document.querySelector(".mce-anchor-prompt"), "hideAnchorPrompt 移除 DOM 节点");
api.setTheme("gold");

console.log("\nPINS STATE MACHINE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
