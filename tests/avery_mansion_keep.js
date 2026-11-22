/* 艾弗里「放逐后保留房子」（07q-avery-mansion-keep.js）测试 — 2026-11-22
 *
 * 原版事实（DoL 0.5.12.13 单文件 HTML 实证）：
 *   - $avery_fate 取值 saved / fallen / ascended / kicked；falled/kicked 来自大厦火灾线并紧跟 dismissAvery "hard"。
 *   - 庄园可用判据：V.avery_mansion && avery_fate !== "fallen" && !== "kicked"。
 *   - dismissAvery "hard" 不删 $avery_mansion，只置 npc state dismissed + unset 约会计数 + 置 $averyDismissalSceneWait。
 *   - unDismissAvery = unset $averyDismissalScene/$averyDismissalSceneWait + npcset Avery state "active"。
 *
 * 覆盖七组：状态读取 / 恢复写入 / 留痕 / 幂等与未开线拒绝 / 缺壳补建 / 回退 / UI。
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
global.window = window; global.document = window.document;
global.Node = window.Node; global.Element = window.Element; global.HTMLElement = window.HTMLElement;
window.matchMedia = function (q) {
  return { matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
};

const V = {
  passage: "Room", mbCE_wrote: {}, mbCE_queue: [],
  NPCNameList: ["Avery", "Robin"],
  NPCName: [{ state: "dismissed", init: 1 }, { state: "active", init: 1 }],
  avery_fate: "kicked",
  avery_mansion: { days: 3, pool: 1, schedule: "home", party_state: "waiting" },
  avery_tower: { progress: 2, effects: ["theft"], stage: 1, intro: 1 },
  averyDismissalSceneWait: 1
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = { foodstuff: {}, fishing: { lootTables: { fish: {} } } };
global.Story = { has() { return false; }, passages: [], size: 0, get() { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage; global.sessionStorage = window.sessionStorage;
window.maplebirch = { get() { return null; }, npc: {} };
window.modUtils = { getMod() { return null; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
const SOURCE = fs.readFileSync(jsPath, "utf8");
try { eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

function need(name) {
  if (typeof api[name] !== "function") { assert(false, "缺少导出 " + name); return null; }
  return true;
}

try {
  assert(true, "0.1 产物已加载");

  section("1. 状态读取");
  if (need("vanillaAveryState")) {
    const st = api.vanillaAveryState();
    assert(st && st.ok, "1.1 状态读取成功");
    assert(st.fate === "kicked", "1.2 fate=kicked 如实读出");
    assert(st.npcState === "dismissed", "1.3 NPC 状态 dismissed 如实读出（V.NPCName 别名）");
    assert(st.mansion === true && st.tower === true, "1.4 庄园与高塔对象存在");
    assert(st.dismissWait === "1", "1.5 解雇防抖位如实读出");
  }

  section("2. 恢复写入");
  const keep = need("vanillaAveryKeep") ? api.vanillaAveryKeep() : null;
  assert(keep && keep.ok, "2.1 恢复成功");
  assert(V.avery_fate === "saved", "2.2 avery_fate → saved（原版 hasMansion 判据随之成立）");
  assert(V.NPCName[0].state === "active", "2.3 Avery NPC 状态 → active（对齐 unDismissAvery）");
  assert(V.averyDismissalSceneWait === undefined, "2.4 解雇防抖位已清（防周日 20 点重播）");
  assert(V.averyDismissalScene === undefined, "2.5 解雇场景标志已清");
  assert(V.avery_mansion.days === 3 && V.avery_mansion.pool === 1, "2.6 庄园建造进度一字未动");
  assert(V.NPCName[1].state === "active", "2.7 其它 NPC（Robin）不受影响");
  const tr = V.mbCE_wrote["vcore:avery-keep"];
  assert(!!tr && tr.before.kind === "avery-keep", "2.8 留痕 kind=avery-keep");
  assert(tr.before.fate === "kicked" && tr.before.npcState === "dismissed", "2.9 before 记 fate 与 NPC 状态");
  assert(tr.before.mansionBuilt === false && tr.before.towerBuilt === false, "2.10 未建壳（两对象原本就在）");

  section("3. 幂等");
  const again = api.vanillaAveryKeep();
  assert(!again.ok, "3.1 已 saved 且 NPC 非 dismissed → 拒绝重复恢复");

  section("4. 未开线拒绝");
  const savedFate = V.avery_fate, savedNpc = V.NPCName[0].state;
  V.avery_fate = undefined;
  const noHouse = V.avery_mansion;
  V.avery_mansion = undefined;
  const r2 = api.vanillaAveryKeep();
  assert(!r2.ok, "4.1 从未进艾弗里线（fate 空 + 无庄园）→ 拒绝");
  V.avery_fate = savedFate; V.avery_mansion = noHouse; V.NPCName[0].state = savedNpc;

  section("5. 回退（基于首写前快照）");
  if (need("vanillaAveryUndo")) {
    const ru = api.vanillaAveryUndo("avery-keep");
    assert(ru && ru.ok, "5.1 回退成功（走 vcore → ExtUndo → KindUndo → EconUndo → avery-keep 全链）");
    /* mbCEVanillaTrace 保留首写前快照（07l:69-73）：第 2 组的 before 是 kicked，回退即回到 kicked */
    assert(V.avery_fate === "kicked", "5.2 fate 还原为首次写入前的 kicked");
    assert(V.NPCName[0].state === "dismissed", "5.3 NPC 状态还原 dismissed");
    assert(V.averyDismissalSceneWait === 1, "5.4 解雇防抖位还原 1");
    assert(!!V.avery_mansion && !!V.avery_tower, "5.5 原有庄园与高塔保留（首写前没建壳，回退不删）");
    assert(!V.mbCE_wrote["vcore:avery-keep"], "5.6 回退后留痕删除");
  }

  section("6. 缺壳补建（独立一轮，首写前无庄园）");
  V.avery_fate = "fallen";
  V.NPCName[0].state = "dismissed";
  delete V.avery_mansion;
  delete V.avery_tower;
  const r3 = api.vanillaAveryKeep();
  assert(r3 && r3.ok, "6.1 庄园对象缺失时仍可恢复");
  assert(!!V.avery_mansion && V.avery_mansion.mb_ce_shell !== true, "6.2 补建的壳不带 mb_ce_shell 标记（不会被启动清理误撤）");
  assert(V.avery_mansion.days === 0 && V.avery_mansion.schedule === "home", "6.3 壳字段照 avery_mansion_init 初值");
  assert(!!V.avery_tower && Array.isArray(V.avery_tower.effects), "6.4 高塔壳一样补齐");
  const tr2 = V.mbCE_wrote["vcore:avery-keep"];
  assert(tr2 && tr2.before.mansionBuilt === true && tr2.before.towerBuilt === true, "6.5 新留痕记下本次补建");
  const ru2 = api.vanillaAveryUndo("avery-keep");
  assert(ru2 && ru2.ok, "6.6 补建轮回退成功");
  assert(V.avery_fate === "fallen", "6.7 fate 还原 fallen");
  assert(V.avery_mansion === undefined && V.avery_tower === undefined, "6.8 本次补建的壳已删除");

  section("7. UI");
  if (need("renderAveryKeep")) {
    const pane = document.createElement("div");
    document.body.appendChild(pane);
    api.renderAveryKeep(pane);
    const txt = pane.textContent;
    assert(txt.indexOf("艾弗里庄园") !== -1, "7.1 区块标题渲染");
    assert(pane.querySelectorAll("button").length >= 1, "7.2 至少一个动作按钮");
    assert(txt.indexOf("恋爱") !== -1, "7.3 说明里点明不动恋爱关系");
  }

  section("8. 边界：NPC 缺失 / 非法 kind / 空值回退");
  const npcArr = V.NPCName, npcList = V.NPCNameList;
  V.NPCNameList = [];
  const stNoNpc = api.vanillaAveryState();
  assert(stNoNpc && stNoNpc.ok && stNoNpc.npcState === "", "8.1 NPC 列表缺失时状态读取不崩、npcState 为空");
  V.avery_fate = null;
  assert(api.vanillaAveryState().fate === "", "8.2 fate = null 归一为空值");
  /* NPC 列表缺失时恢复：跳过状态复位，但 fate 照常恢复 */
  V.avery_fate = "fallen";
  const rNoNpc = api.vanillaAveryKeep();
  assert(rNoNpc && rNoNpc.ok, "8.3 NPC 列表缺失时恢复不崩（跳过 NPC 复位）");
  assert(V.avery_fate === "saved", "8.4 fate 仍恢复为 saved");
  V.NPCNameList = npcList; V.NPCName = npcArr;

  const uk = api.vanillaAveryUndoKind;
  assert(uk(null, { kind: "avery-keep" }, "x") === null, "8.5 回退处理器对空 V 返回 null");
  assert(uk(V, null, "x") === null, "8.6 对空 before 返回 null");
  assert(uk(V, { kind: "other" }, "x") === null, "8.7 对别的 kind 返回 null（不误吃他人留痕）");
  V.mbCE_wrote["vcore:probe"] = { before: {} };
  const probe = uk(V, { kind: "avery-keep", fate: "", npcState: "", dismissScene: 2, dismissWait: 0, mansionBuilt: false, towerBuilt: false }, "vcore:probe");
  assert(probe && probe.ok, "8.8 处理器直接调用成功");
  assert(V.avery_fate === undefined, "8.9 fate 为空值时回退删除该键");
  assert(V.averyDismissalScene === 2 && V.averyDismissalSceneWait === 0, "8.10 解雇标志按快照恢复（有值与 0 都写回）");
  assert(!V.mbCE_wrote["vcore:probe"], "8.11 处理器删除对应留痕");
  /* 无留痕时回退入口给文案而不崩（先清掉 8.3 那次恢复留下的留痕） */
  delete V.mbCE_wrote["vcore:avery-keep"];
  const ru3 = api.vanillaAveryUndo();
  assert(!ru3.ok && /不存在/.test(ru3.message), "8.12 无留痕时回退拒绝并给文案");

  section("9. UI 交互分支");
  const pane2 = document.createElement("div");
  document.body.appendChild(pane2);
  V.avery_fate = "kicked"; V.NPCName[0].state = "dismissed";
  V.averyDismissalScene = 1; /* 让恢复前的快照走「有值」分支 */
  api.renderAveryKeep(pane2);
  const btns = pane2.querySelectorAll("button");
  assert(btns.length >= 2, "9.1 恢复与回退两个按钮");
  btns[1].click(); /* 此时无留痕 → res.ok 假分支 */
  assert(true, "9.2 回退失败路径不崩");
  const b2 = pane2.querySelectorAll("button");
  assert(b2[0] && b2[0].textContent.indexOf("保留房子") !== -1, "9.3 恢复按钮文案在");
  b2[0].click(); /* res.ok 真分支 + redraw → npcState active 分支 */
  assert(V.avery_fate === "saved" && V.NPCName[0].state === "active", "9.4 点恢复按钮生效");
  assert(V.averyDismissalScene === undefined, "9.5 恢复后解雇场景标志被清");
  const tr9 = V.mbCE_wrote["vcore:avery-keep"];
  assert(tr9 && tr9.before.dismissScene === 1, "9.6 快照记下恢复前的解雇场景值");
  /* NPC 缺失时的 UI 文案分支 */
  const pane3 = document.createElement("div");
  document.body.appendChild(pane3);
  V.NPCNameList = [];
  api.renderAveryKeep(pane3);
  assert(pane3.textContent.indexOf("未初始化") !== -1, "9.7 NPC 缺失时渲染「未初始化」");
  V.NPCNameList = npcList; V.NPCName = npcArr;
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
}

console.log("\n" + (failures ? "FAILED " : "OK ") + passes + " passed, " + failures + " failed");
process.exit(failures ? 1 : 0);
