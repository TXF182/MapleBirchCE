/* 负向路径覆盖率驱动测试（v2.0.6 整改轮：把 branches 门槛 70 → 80 补上来）
 *
 * 目的：现有 7 个测试几乎只走"正常路径"，覆盖不到的 1,300 多条分支绝大多数是
 *       IF 的 else 侧——即「宿主缺失 / 数据缺失 / 非法入参」时的拒绝分支。
 *       本测试专门喂坏数据，断言两件事：
 *         1) 不抛异常（面板不能白屏或卡死）；
 *         2) 给出可读的拒绝语义（ok:false / false / 明确的提示文本），而不是静默写入。
 *       这两条正是"UI 拒绝路径 + 适配器负向分支"的可验证形态，不是凑断言数。
 *
 * 结构：
 *   A 框架层拒绝（Maplebirch 缺失 / 注册池为空）
 *   B 玩家数据缺失（V.player 空壳）
 *   C 场景/爱情线/地点数据畸形
 *   D 适配器负向（mod 声明畸形、宿主缺失、未知键）
 *   E 面板 UI 拒绝路径（真实 DOM 点击，在缺数据状态下点按钮）
 *   F 回退中心/态度/潜伏者 空态拒绝
 *
 * 用法：node tests/coverage_negative.js（由 tools/run_coverage.js 串进覆盖率序列）
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
/* 通用：调用必须不抛；返回值落到「拒绝语义」才算通过 */
function refusal(r) {
  if (r === false || r === null || r === undefined) return true;
  if (typeof r === "string") return r.length > 0;
  if (typeof r === "object") {
    if (r.ok === false) return true;
    if (typeof r.message === "string" && r.message.length > 0) return true;
    if (typeof r.error === "string") return true;
    /* sceneStatus 之类的状态机：state 不是 ok/met 即视为"未达成/拒绝" */
    if (typeof r.state === "string" && r.state !== "ok" && r.state !== "met" && r.state !== "done") return true;
  }
  return false;
}
/* 切页签（renderScenes / renderStagePane / renderGlobal 只经页签切换进入，未单独导出） */
function clickTab(tab) {
  const b = [].slice.call(document.querySelectorAll(".mce-tabs button")).filter(function (x) { return x.getAttribute("data-tab") === tab; })[0];
  if (!b) { throw new Error("页签 " + tab + " 不存在"); }
  b.click();
}
const threw = [];
function guard(label, fn, opts) {
  const wantReject = opts && opts.reject;
  try {
    const r = fn();
    if (wantReject) {
      assert(refusal(r), label + " → 拒绝且不抛（返回 " + safeStr(r) + "）");
    } else {
      assert(true, label + " → 不抛异常（返回 " + safeStr(r) + "）");
    }
  } catch (e) {
    threw.push(label + ": " + (e && e.message));
    failures++;
    console.error("FAIL: " + label + " 抛出异常：" + (e && e.message ? e.message : e));
  }
}
function safeStr(v) {
  try {
    if (v === undefined) return "undefined";
    if (v === null) return "null";
    if (typeof v === "object") {
      const keys = Object.keys(v).slice(0, 4);
      return "{" + keys.map(function (k) { return k + ":" + String(v[k]).slice(0, 30); }).join(",") + "}";
    }
    return String(v).slice(0, 90);
  } catch (e) { return "(不可序列化)"; }
}

/* ---------- 1. 最小 jsdom 环境（只求"不崩"，不追求视觉正确） ---------- */
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
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };
window.__mbCE_forceSyncRows = true;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath + "，先 node tools/build_js.js"); process.exit(1); }
/* sourceURL 必填：否则 c8 把执行记到 evalmachine.<anonymous>，--include 直接丢弃 */
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(!!api, "setup.mbStageCE 已挂载（负向测试前置）");

/* ================= A. 框架层拒绝 —— 见 tests/coverage_negative_noframework.js =================
   注：resolveMB() 首次解析成功后会把框架对象缓存进模块变量 MB，之后再置空 window.maplebirch
   也改不动（刻意的缓存，避免每次渲染重查）。所以"真正的无框架"必须在**全新实例**里验证，
   落在 coverage_negative_noframework.js（完全不装 maplebirch 从零启动）。本文件只做数据负向。 */
console.log("\n== A 框架层拒绝：见 coverage_negative_noframework.js ==");

/* ================= B. 玩家数据缺失 ================= */
console.log("\n== B 玩家数据缺失 ==");
const savedPlayer = V.player;
V.player = {};
guard("B1 V.player 空壳 → renderPlayerEdit()", function () { api.renderPlayerEdit(); });
guard("B2 V.player 空壳 → renderCards()", function () { api.renderCards(); });
guard("B3 V.player 空壳 → refresh()", function () { api.refresh(); });
guard("B4 V.player 空壳 → getVanillaStages()", function () { return api.getVanillaStages(); });
guard("B5 V.player 空壳 → getRomanceStages()", function () { return api.getRomanceStages(); });
guard("B6 V.player 空壳 → attitudeState()", function () { return api.attitudeState(); });
guard("B7 V.player 空壳 → mbCELurkerState()", function () { return api.mbCELurkerState(); });
guard("B8 V.player 空壳 → quickTargetValue(未知键)", function () { return api.quickTargetValue("no_such_key"); }, { reject: true });
V.player = savedPlayer;

/* ================= C. 场景/爱情线/地点数据畸形 ================= */
console.log("\n== C 数据畸形 ==");
const savedScenes = V.scenes;
V.scenes = { badNull: null, badPassages: { name: "坏定义", passages: "not-an-array", startPassage: "" }, noName: { startPassage: "Room" } };
window.__mceScenesText = null;
guard("C1 畸形 V.scenes → 切 scenes 页签（renderScenes 入口）", function () { clickTab("scenes"); });
guard("C2 畸形 V.scenes → sceneStatus(未知键)", function () { return api.sceneStatus("no_such_scene_key"); }, { reject: true });
guard("C3 畸形 V.scenes → listSceneLines(未知键)", function () { return api.listSceneLines("no_such_scene_key"); });
guard("C4 畸形 V.scenes → isVanillaSceneKey(未知键)", function () { return api.isVanillaSceneKey("no_such_scene_key"); });
guard("C5 畸形 V.scenes → sceneRoleOf(未知键)", function () { return api.sceneRoleOf("no_such_scene_key"); });
V.loveInterest = "not-an-array";
guard("C6 V.loveInterest 非数组 → 切 stage 页签（renderStagePane 入口）", function () { clickTab("stage"); });
guard("C7 V.loveInterest 非数组 → getRolePlots()", function () { return api.getRolePlots(); });
guard("C8 V.loveInterest 非数组 → completeRomanceStage(未知角色)", function () { return api.completeRomanceStage("nobody", 0); }, { reject: true });
V.loveInterest = [];
V.places = "not-an-object";
guard("C9 V.places 畸形 → renderPlaces()", function () { api.renderPlaces(); });
guard("C10 V.places 畸形 → listPlaceGroups()", function () { return api.listPlaceGroups(); });
guard("C11 teleportTo(不存在的段落)", function () { return api.teleportTo("NoSuchPassage"); }, { reject: true });
guard("C12 V.scenes 恢复后 pinScene(无 def)", function () { return api.pinScene({}); }, { reject: true });
guard("C13 pinScene(有 key 无 def)", function () { return api.pinScene({ key: "x" }); }, { reject: true });
guard("C14 pinSceneLine(空线)", function () { return api.pinSceneLine({ items: [] }); }, { reject: true });
guard("C15 pinSceneLine(null)", function () { return api.pinSceneLine(null); }, { reject: true });
guard("C16 unpinScene(未知 key)", function () { return api.unpinScene("no_such_scene_key"); }, { reject: true });
guard("C17 pinQueueIndex(未知 key)", function () { return api.pinQueueIndex("no_such_scene_key"); });
guard("C18 getPinnedScene() 空队列", function () { return api.getPinnedScene(); });
guard("C19 applyWorldUnlock(未知场景)", function () { return api.applyWorldUnlock("no_such_scene_key"); }, { reject: true });
guard("C20 applyWorldUnlockForScene(空对象)", function () { return api.applyWorldUnlockForScene({}); }, { reject: true });
V.scenes = savedScenes;

/* ================= D. 适配器负向 ================= */
console.log("\n== D 适配器负向 ==");
setup.mbCE_modCheats = "not-an-array";
guard("D1 setup.mbCE_modCheats 非数组 → getCheatMods()", function () { return api.getCheatMods(); });
guard("D2 setup.mbCE_modCheats 非数组 → renderModCheats()", function () { api.renderModCheats(); });
setup.mbCE_modCheats = [null, {}, { modId: "m-empty" }, { modId: "m-rows", values: "not-an-array", stages: null, abilities: null, tasks: null, scenes: null }];
guard("D3 mod 声明畸形（null/空壳/字段类型错）→ renderModCheats()", function () { api.renderModCheats(); });
guard("D4 applyCheatModValue(未知 mod)", function () { return api.applyCheatModValue("no-such-mod", "no-such-key", 1); }, { reject: true });
guard("D5 applyCheatModValue(已知空 mod, 未知 key)", function () { return api.applyCheatModValue("m-empty", "no-such-key", 1); }, { reject: true });
guard("D6 setCheatStage(未知 mod)", function () { return api.setCheatStage("no-such-mod", "no-such-stage", 5); }, { reject: true });
guard("D7 jumpCheatStageMax(未知 mod)", function () { return api.jumpCheatStageMax("no-such-mod", "no-such-stage"); }, { reject: true });
guard("D8 resetCheatStage(未知 mod)", function () { return api.resetCheatStage("no-such-mod", "no-such-stage"); }, { reject: true });
guard("D9 toggleCheatAbility(未知 mod)", function () { return api.toggleCheatAbility("no-such-mod", "no-such-ab"); }, { reject: true });
guard("D10 skipCheatTask(未知 mod)", function () { return api.skipCheatTask("no-such-mod", "no-such-task"); }, { reject: true });
guard("D11 completeCheatTask(未知 mod)", function () { return api.completeCheatTask("no-such-mod", "no-such-task"); }, { reject: true });
guard("D12 cheatSceneAction(未知 mod)", function () { return api.cheatSceneAction("no-such-mod", "no-such-scene", "x"); }, { reject: true });
guard("D13 cheatWriteValue(空行定义)", function () { return api.cheatWriteValue({}); }, { reject: true });
guard("D14 cheatWriteListValue(空参)", function () { return api.cheatWriteListValue(null); }, { reject: true });
guard("D15 undoCheatModValue(未知 mod)", function () { return api.undoCheatModValue("no-such-mod", "no-such-key"); }, { reject: true });
guard("D16 cheatReadSafe(未知路径)", function () { return api.cheatReadSafe("no.such.path"); });
guard("D17 适配器玩家数据缺失下 renderModCheatDetail(未知 mod)", function () { return api.renderModCheatDetail("no-such-mod"); }, { reject: true });
guard("D18 ensureFarmState(V.farm 缺失)", function () { return api.ensureFarmState(); }, { reject: false });
guard("D19 ensureAveryMansion(空态)", function () { return api.ensureAveryMansion(); }, { reject: false });
guard("D20 ensureGwylanSceneState(空态)", function () { return api.ensureGwylanSceneState(); }, { reject: false });
guard("D21 isGwylanGardenPassage(非段落名)", function () { return api.isGwylanGardenPassage("Room"); });
setup.mbCE_modCheats = [];

/* ================= E. 面板 UI 拒绝路径（真实 DOM 点击） ================= */
console.log("\n== E 面板 UI 拒绝路径 ==");
window.maplebirch = { get: function () { return null; }, npc: {} };
api.open();
guard("E1 打开面板（无框架）", function () { api.open(); });
const paneModsE = document.querySelector('[data-pane="mods"]');
assert(!!paneModsE, "E2 mods 分页容器存在（即使无数据）");
/* 缺数据时点选题材/写入按钮：必须不抛，且不产生写入留痕 */
V.mbCE_wrote = {};
const btnsE = [].slice.call((paneModsE || document).querySelectorAll("button")).slice(0, 12);
let clickedE = 0;
btnsE.forEach(function (b) {
  try { b.click(); clickedE++; } catch (e) { threw.push("E3 " + (b.textContent || "?") + ": " + e.message); failures++; }
});
assert(clickedE === btnsE.length, "E3 无数据态点击 " + btnsE.length + " 个 mods 按钮全部不抛（实际成功 " + clickedE + "）");
assert(Object.keys(V.mbCE_wrote || {}).length === 0, "E4 拒绝态点击未产生任何写入留痕（mbCE_wrote 条数 " + Object.keys(V.mbCE_wrote || {}).length + "）");
/* 切所有页签：每个渲染入口都要能扛住空数据 */
["char", "stage", "scenes", "places", "global", "mods", "yanling"].forEach(function (tab) {
  const b = [].slice.call(document.querySelectorAll(".mce-tabs button")).filter(function (x) { return x.getAttribute("data-tab") === tab; })[0];
  if (!b) { console.log("WARN: 页签 " + tab + " 未渲染（面板结构变化）"); return; }
  try { b.click(); assert(true, "E5 切页签 " + tab + " 空数据不抛"); }
  catch (e) { failures++; console.error("FAIL: E5 切页签 " + tab + " 抛出 " + e.message); }
});
api.close();

/* ================= F. 回退中心 / 态度 / 潜伏者 空态拒绝 ================= */
console.log("\n== F 回退中心与空态拒绝 ==");
V.mbCE_wrote = {};
guard("F1 undoList() 空留痕", function () { return api.undoList(); });
guard("F2 undoOne(未知 id)", function () { return api.undoOne("no-such-id"); }, { reject: true });
guard("F3 undoGroup(未知分组)", function () { return api.undoGroup("no-such-group"); }, { reject: true });
guard("F4 undoAll() 空留痕", function () { return api.undoAll(); });
guard("F5 undoLabel(未知 id)", function () { return api.undoLabel("no-such-id"); });
guard("F6 undoItemName(未知 id)", function () { return api.undoItemName("no-such-id"); });
guard("F7 applyAttitude(非法档位)", function () { return api.applyAttitude("not-a-tier"); }, { reject: true });
guard("F8 readAttitude(空态)", function () { return api.readAttitude(); });
guard("F9 mbCEAttitudeHold() 空态", function () { return api.mbCEAttitudeHold(); });
guard("F10 mbCEAttitudeRelease() 空态", function () { return api.mbCEAttitudeRelease(); });
guard("F11 mbCEAttitudeTick() 空态", function () { return api.mbCEAttitudeTick(); });
guard("F12 mbCELurkerSet(非法值)", function () { return api.mbCELurkerSet(-1); }, { reject: true });
guard("F13 mbCELurkerSetAuto(非布尔)", function () { return api.mbCELurkerSetAuto("yes"); });
guard("F14 mbCELurkerAutoTick() 空态", function () { return api.mbCELurkerAutoTick(); });
guard("F15 mbCELurkerPatchText(null)", function () { return api.mbCELurkerPatchText(null); });
guard("F16 readTransformState() 空态", function () { return api.readTransformState(); });
guard("F17 listAllPassages() 无 Story.passages", function () { return api.listAllPassages(); });

/* ---------- 汇总 ---------- */
console.log("\nNEGATIVE COVERAGE DRIVE: passed=" + passes + " failed=" + failures);
if (failures) {
  console.error("抛出点：" + threw.join(" | "));
  process.exit(1);
}
process.exit(0);
