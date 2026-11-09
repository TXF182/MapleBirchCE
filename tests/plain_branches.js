/*
 * plain 分支补测专项（覆盖率欠账轮 2026-11-09）
 *
 * 背景：report_branch_gaps.js 把未覆盖分支按行文归为 catch / shortcircuit / ternary /
 * env-guard / plain。plain 是"普通 if-else 没写断言"的欠账——过去各测试只走正常路径，
 * 拒绝分支、空集合分支、队列边界从没被喂到。
 *
 * 边界（重要）：本测试**不**覆盖 dead-guard 一类（`if (!V)` 且 V 来自 getV()）。
 * getV() 在未读档时返回 {} 兜底（truthy），`!V` 恒 false，那批分支结构性不可达，
 * 硬塞断言只会模仿执行、不产生真覆盖。它们已由报表工具单列一类。
 *
 * 用法：node tests/plain_branches.js（需先 node tools/build_js.js）
 */
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;

/* 最小游戏全局（与 smoke_dom 同口径，但不声明 V/State 等同名局部变量，避免遮蔽产物内的裸全局） */
global.V = {
  player: { virginity: { vaginal: true, penile: false }, charisma: 10, beauty: 20, physique: 30 },
  loveInterest: [],
  passage: "Room",
  scenePassages: [],
  mbCE_wrote: {}
};
global.State = { variables: global.V };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [] };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };
window.__mbCE_forceSyncRows = true;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
const js = fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/");
eval(js);
const api = global.setup.mbStageCE;

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function call(fn) { try { return fn(); } catch (e) { return { threw: String(e && e.message || e) }; } }

assert(!!api && typeof api.mbCEPreviewGate === "function", "setup.mbStageCE 已挂载且预览接口可用");

/* ---------- 1. 08d 预览队列边界（plain：L48 超限丢最旧 / L56 空队列 / L64 非对象结果） ---------- */
api.mbCEUiSave({ diffPreview: "1" });
assert(api.mbCEUiState().diffPreview === "1", "diff 预览开关已开启（后续队列断言的前提）");

let gateErr = null, pushed = 0;
for (let i = 0; i < 9; i++) {
  const r = call(function () { return api.mbCEPreviewGate("t.k" + i, 1, 2, function () { return undefined; }); });
  if (r && r.threw) { gateErr = r.threw; break; }
  if (r === true) pushed++;
}
assert(!gateErr, "连续 9 次入队不抛异常" + (gateErr ? "（实际：" + gateErr + "）" : ""));
assert(pushed === 9, "9 次均被预览拦下（进入待确认队列），实际 " + pushed);
assert(api.mbCEPreviewCount() === 8, "队列封顶 MB_CE_PREVIEW_MAX=8，超出丢最旧，实际 " + api.mbCEPreviewCount());

const confirm1 = call(function () { return api.mbCEPreviewConfirm(); });
assert(confirm1 && confirm1.ok === true && String(confirm1.message).indexOf("已写入") === 0,
  "确认队首：run 返回非对象时回落为「已写入 …」（08d L64），实际 " + JSON.stringify(confirm1));

const cancelR = call(function () { return api.mbCEPreviewCancel(); });
assert(cancelR && cancelR.ok === true && api.mbCEPreviewCount() === 0, "取消清空整个队列，实际 " + JSON.stringify(cancelR));

const confirmEmpty = call(function () { return api.mbCEPreviewConfirm(); });
assert(confirmEmpty && confirmEmpty.ok === false && confirmEmpty.message === "没有待确认的写入",
  "空队列确认返回明确拒绝（08d L56），实际 " + JSON.stringify(confirmEmpty));

/* ---------- 2. 07d 地点中文名：无匹配关键词（plain：L91 !parts.length → ""） ---------- */
const nameMiss = call(function () { return api.placeNameCN("zzzz-not-a-place"); });
assert(nameMiss === "", "未知地点名返回空串（不拼出「（）」空壳），实际 " + JSON.stringify(nameMiss));
const nameHit = call(function () { return api.placeNameCN("bedroom"); });
assert(typeof nameHit === "string" && nameHit.indexOf("（") === 0, "已知地点名仍返回中文括号名，实际 " + JSON.stringify(nameHit));

/* ---------- 3. 08 未知 NPC 特质（plain：08-npc-traits L111 !t → "未知特质 …"） ---------- */
const revUnknown = call(function () { return api.revertNpcTrait("no-such-trait"); });
assert(revUnknown && revUnknown.ok === false && String(revUnknown.message).indexOf("未知特质") === 0,
  "撤回未知 NPC 特质返回明确拒绝（08-npc-traits L111），实际 " + JSON.stringify(revUnknown));

/* ---------- 3b. 08d 页签分发：mods / places（plain：L108 / L110） ---------- */
function setActivePane(name) {
  document.querySelectorAll(".mce-pane").forEach(function (p) { p.classList.remove("mce-active"); });
  const p = document.querySelector('[data-pane="' + name + '"]');
  if (p) { p.classList.add("mce-active"); }
  return p;
}
const paneModsBefore = setActivePane("mods");
assert(!!paneModsBefore, "存在 data-pane=mods 的页容器（前置）");
const refreshMods = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshMods === "mods", "活动页 = mods 时分发到 renderModCheats（08d L108），实际 " + JSON.stringify(refreshMods));
const panePlaces = setActivePane("places");
assert(!!panePlaces, "存在 data-pane=places 的页容器（前置）");
const refreshPlaces = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshPlaces === "places", "活动页 = places 时分发到 renderPlaces（08d L110），实际 " + JSON.stringify(refreshPlaces));

/* ---------- 4. 09 页签栏点击空白（plain：L265 !b → return） ---------- */
const tabs = document.querySelector(".mce-tabs");
assert(!!tabs, "面板页签栏存在（init→ensureDom 已建）");
let tabErr = null;
if (tabs) {
  const r = call(function () { tabs.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); return true; });
  if (r && r.threw) tabErr = r.threw;
}
assert(!tabErr, "点击页签栏自身（非 button[data-tab]）不抛错" + (tabErr ? "（" + tabErr + "）" : ""));
assert(!!document.querySelector(".mce-tabs .mce-active, .mce-tabs button"),
  "页签栏仍保持可用（未因空点击被破坏）");

/* ---------- 5. 06b 特质写入全分支（grantTrait / revokeTrait 的 isnot / is / lt / NaN 形态） ----------
   这些走的是面板「获取 / 移除」按钮的同一函数，只是原版特质表里没有这些 has 组合，所以从没被喂到。 */
const Vg = global.V;
function tdef(has) { return { cat: "测试", name: "T" + has, has: has, text: "" }; }
function grant(has) { return call(function () { return api.grantTrait(tdef(has), Vg, null); }); }
function revoke(has) { return call(function () { return api.revokeTrait(tdef(has), Vg, null); }); }

const wA = grant("$ta isnot true");
assert(Array.isArray(wA) && Vg.ta === false, "isnot true 的满足值写 false（06b L194），实际 " + JSON.stringify(wA) + " / " + JSON.stringify(Vg.ta));
const wB = grant("$tb isnot false");
assert(Array.isArray(wB) && Vg.tb === true, "isnot false 的满足值写 true（06b L195），实际 " + JSON.stringify(Vg.tb));
const wC = grant("$tc isnot undefined");
assert(Array.isArray(wC) && Vg.tc === 1, "isnot undefined 的满足值写 1（06b L196），实际 " + JSON.stringify(Vg.tc));
const wD = grant("$td isnot 7");
assert(Array.isArray(wD) && Vg.td === 6, "isnot 数字的满足值写 N-1（06b L197），实际 " + JSON.stringify(Vg.td));
const wE = grant("$te is undefined");
assert(Array.isArray(wE) && Vg.mbCE_forcedTraits && Vg.mbCE_forcedTraits.length > 0,
  "is undefined 无可写值 → 走强制获得标记（06b L201），实际 " + JSON.stringify(wE));
const wF = grant("$tf is \"none\"");
assert(Array.isArray(wF) && Vg.tf === "none", "is 非数字字符串按原串写回（06b L202），实际 " + JSON.stringify(Vg.tf));

const uG = revoke("$tg lt 5");
assert(Array.isArray(uG) && Vg.tg === 5, "lt 的不满足值写 N（06b L228），实际 " + JSON.stringify(Vg.tg));
const uH = revoke("$th isnot true");
assert(Array.isArray(uH) && Vg.th === true, "isnot true 的不满足值写 true（06b L216），实际 " + JSON.stringify(Vg.th));
const uI = revoke("$ti isnot undefined");
assert(Array.isArray(uI) && Vg.ti === undefined && Object.prototype.hasOwnProperty.call(Vg, "ti"),
  "isnot undefined 的不满足值写 undefined（06b L218），实际 " + JSON.stringify(Vg.ti));
const uJ = revoke("$tj isnot 7");
assert(Array.isArray(uJ) && Vg.tj === 7, "isnot 数字的不满足值写 N（06b L222），实际 " + JSON.stringify(Vg.tj));
const uK = revoke("$tk is false");
assert(Array.isArray(uK) && Vg.tk === true, "is false 的不满足值写 true（06b L225），实际 " + JSON.stringify(Vg.tk));
const uL = revoke("$tl is \"none\"");
assert(Array.isArray(uL) && Vg.tl === "", "is 非数字字符串的不满足值写空串（06b L226），实际 " + JSON.stringify(Vg.tl));
const uM = revoke("$tm isnot false");
assert(Array.isArray(uM) && Vg.tm === false, "isnot false 的不满足值写 false（06b L217），实际 " + JSON.stringify(Vg.tm));

/* 判定函数缓存有界 512：喂满后整体重建（06b L43）。表达式各不相同才会新增条目。 */
let cacheErr = null;
for (let ci = 0; ci < 520; ci++) {
  const r = call(function () { return api.traitEval(Vg, null, "$cacheProbe" + ci + " is 1"); });
  if (r && r.threw) { cacheErr = r.threw; break; }
}
assert(!cacheErr, "判定函数缓存超过 512 条后整体重建且不抛错（06b L43）" + (cacheErr ? "（" + cacheErr + "）" : ""));

/* ---------- 6. 04c 适配器自检的拒绝分支（缺 modId / modId 不一致 / 缺 key / 缺 name / 缺 varPath / 空适配器） ---------- */
const AD = api.CHEAT_ADAPTERS;
const fakeIds = [];
function addFake(id, entry) { AD[id] = { entry: entry, detect: null }; fakeIds.push(id); }
addFake("zz_bad_pack", { tasks: [{ name: "缺 key 项" }, { key: "k2" }] });
addFake("zz_mismatch", { modId: "zz_other", values: [{ key: "v1", name: "数值1" }] });
addFake("zz_empty", { modId: "zz_empty" });
const audit = call(function () { return api.auditAdapters(); });
fakeIds.forEach(function (id) { try { delete AD[id]; } catch (e) {} });
assert(audit && !audit.threw, "auditAdapters 在含畸形声明的注册表上可运行" + (audit && audit.threw ? "（" + audit.threw + "）" : ""));
const auditErr = String((audit && audit.errors) || []).replace(/,/g, " | ");
const auditWarn = String((audit && audit.warnings) || []).replace(/,/g, " | ");
assert(auditErr.indexOf("缺 modId") !== -1, "entry 缺 modId 记入 errors（04c L35）");
assert(auditErr.indexOf("与注册键不一致") !== -1, "entry.modId 与注册键不一致记入 errors（04c L36）");
assert(auditErr.indexOf("缺 key") !== -1, "分类项缺 key 记入 errors（04c L43）");
assert(auditErr.indexOf("缺 name") !== -1, "分类项缺 name 记入 errors（04c L44）");
assert(auditErr.indexOf("缺 varPath") !== -1, "非场景分类项缺 varPath 记入 errors（04c L49）");
assert(auditWarn.indexOf("没有任何能力") !== -1, "空适配器记入 warnings（04c L37）");

/* ---------- 7. 08d 预览值格式化 + stage 页分发（plain：L29 null / L32 JSON.stringify 返回 undefined / L111） ---------- */
const gateNull = call(function () { return api.mbCEPreviewGate("t.fmtNull", null, 5, function () { return { ok: true, message: "n" }; }); });
const gateFn = call(function () { return api.mbCEPreviewGate("t.fmtFn", function () { return 1; }, 5, function () { return { ok: true, message: "f" }; }); });
assert(gateNull === true && gateFn === true, "null 与函数值都能入队待确认（fmt 兜底前置），实际 " + JSON.stringify([gateNull, gateFn]));
const bar = document.getElementById("mce-preview-bar");
assert(!!bar, "确认条已显示（fmt 渲染前置）");
const barTitle = bar ? String((bar.querySelector(".mce-preview-lbl") || {}).title || "") : "";
assert(barTitle.indexOf("旧值：null") !== -1, "旧值 null 渲染成字面 null（08d L29），实际 " + JSON.stringify(barTitle.slice(0, 60)));
/* L32 要看队首的旧值：确认条只渲染 queue[0]，所以清空队列后单独入队一个函数值 */
call(function () { return api.mbCEPreviewCancel(); });
const gateFnOnly = call(function () { return api.mbCEPreviewGate("t.fmtFn2", function () { return 1; }, 5, function () { return { ok: true, message: "f" }; }); });
const barFn = document.getElementById("mce-preview-bar");
const titleFn = barFn ? String((barFn.querySelector(".mce-preview-lbl") || {}).title || "") : "";
assert(gateFnOnly === true && titleFn.indexOf("旧值：function") !== -1,
  "JSON.stringify 返回 undefined 时回落 String(v)（08d L32），实际 " + JSON.stringify(titleFn.slice(0, 60)));
call(function () { return api.mbCEPreviewCancel(); });

const paneStageA = setActivePane("stage");
assert(!!paneStageA, "存在 data-pane=stage 的页容器（前置）");
const refreshStage = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshStage === "stage", "活动页 = stage 时分发到 renderStagePane（08d L111），实际 " + JSON.stringify(refreshStage));
const paneScenes = setActivePane("scenes");
assert(!!paneScenes, "存在 data-pane=scenes 的页容器（前置）");
assert(call(function () { return api.mbCEPaneRefresh(); }) === "scenes", "活动页 = scenes 时分发到 renderScenes（08d L112）");
const paneChar = setActivePane("char");
assert(!!paneChar, "存在 data-pane=char 的页容器（前置）");
assert(call(function () { return api.mbCEPaneRefresh(); }) === "char", "活动页 = char 时分发到 renderCards（08d L113）");
const paneYanling = setActivePane("yanling");
assert(!!paneYanling, "存在 data-pane=yanling 的页容器（前置）");
assert(call(function () { return api.mbCEPaneRefresh(); }) === "yanling", "活动页 = yanling 时分发到 renderYanling（08d L114）");
/* 没有任何 pane 带 mce-active 时 name = ""，走最后那条 else 兜底 */
const activePane = document.querySelector(".mce-pane.mce-active");
assert(!!activePane, "存在活动页容器（前置）");
if (activePane) { activePane.classList.remove("mce-active"); }
const refreshNone = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshNone === "", "无活动页（name 为空）时回落默认 renderModCheats（08d L115），实际 " + JSON.stringify(refreshNone));
setActivePane("mods");

/* ---------- 8. 07d 场景状态兜底与宏预检：outside 缺失（L209）/ Story 全无（L229） ---------- */
delete Vg.outside;
const esRes = call(function () { return api.ensureSceneStateFor("Lake Stroll"); });
assert(!(esRes && esRes.threw) && Vg.outside === 1, "湖畔直达兜底补 outside=1（07d L209），实际 " + JSON.stringify(Vg.outside));
const storyBak = global.Story;
global.Story = null;
const macroWarn = call(function () { return api.mbCEPassageMacroWarn("Room"); });
global.Story = storyBak;
assert(macroWarn === "", "Story 与 window.Story 均缺失时宏配对预检返回空串（07d L229），实际 " + JSON.stringify(macroWarn));

/* ---------- 9. 08-npc-traits 誓言修复兜底与时间非有限数（plain：L81 / L82 / L138） ---------- */
const playerBak = Vg.player;
delete Vg.player;
const fixA = call(function () { return api.fixVows(); });
assert(fixA && fixA.ok === true && Vg.player && Vg.player.virginity && Vg.player.virginity.temple === true,
  "V.player 缺失时 fixVows 自建并修复（08-npc-traits L81）");
delete Vg.player.virginity;
const fixB = call(function () { return api.fixVows(); });
assert(fixB && fixB.ok === true && Vg.player.virginity && Vg.player.virginity.temple === true,
  "V.player.virginity 缺失时自建（08-npc-traits L82）");
Vg.player = playerBak;

global.Time = { set: function (ts) { global.__mbCElastTimeSet = ts; }, hour: 8, minute: 0, weekDay: 0 };
Vg.timeStamp = "not-a-number";
const advRes = call(function () { return api.mcTimeAdvance(30); });
assert(advRes && advRes.ok === true && global.__mbCElastTimeSet === 1800,
  "timeStamp 非有限数时按 0 起算再前进（08-npc-traits L138），实际 " + JSON.stringify(global.__mbCElastTimeSet));
delete global.Time;
Vg.timeStamp = 12345;

/* ---------- 10. 07f-lock 锁定留痕缺 before 时补记（plain：L139） ---------- */
Vg.mbCE_lock = [{ path: "lkProbe", target: 7 }];
Vg.lkProbe = 1;
Vg.mbCE_wrote = Vg.mbCE_wrote || {};
Vg.mbCE_wrote["lock:lkProbe"] = { type: "lock", path: "lkProbe", after: 1, t: 1, last: 1 };
const tickRes = call(function () { return api.mbCELockTick(); });
assert(!(tickRes && tickRes.threw) && Vg.mbCE_wrote["lock:lkProbe"].before === 1 && Vg.lkProbe === 7,
  "锁定留痕缺 before 时补记首次真实值并写回目标（07f-lock L139）");

/* ---------- 11. 07f-lurker 三条锁态提示（plain：L170 / L171 / L172） ---------- */
Vg.lurkers_held = 3;
Vg.hookah = { lurkers: 2, juice: 0 };
Vg.lurkers_stored = 1;
Vg.mbCE_lock = [
  { path: "lurkers_held", target: 1 },
  { path: "hookah.lurkers", target: 0 },
  { path: "lurkers_stored", target: 0 }
];
const paneGlobal = setActivePane("global");
assert(!!paneGlobal, "存在 data-pane=global 的页容器（前置）");
const refreshGlobal = call(function () { return api.mbCEPaneRefresh(); });
assert(refreshGlobal === "global", "活动页 = global 时分发到 renderGlobal（08d L109），实际 " + JSON.stringify(refreshGlobal));
const globalText = paneGlobal ? paneGlobal.textContent : "";
assert(globalText.indexOf("手持已锁定") !== -1, "手持被锁时标注整轮暂停（07f-lurker L170）");
assert(globalText.indexOf("冰箱已锁定") !== -1, "冰箱被锁时标注跳过冰箱（07f-lurker L171）");
assert(globalText.indexOf("蒸馏笼已锁定") !== -1, "蒸馏笼被锁时标注跳过笼（07f-lurker L172)");

/* ---------- 6. 05a 面板容器缺失时的渲染早退（plain：L91 / L141 !pane → return） ----------
   放在最后：移走 [data-pane="mods"] 会改变面板结构，不影响前面的状态断言。 */
const modsPane = document.querySelector('[data-pane="mods"]');
assert(!!modsPane, "Mod作弊 pane 存在（前置）");
if (modsPane) {
  modsPane.parentNode.removeChild(modsPane);
  const r1 = call(function () { return api.renderModCheats(); });
  assert(!(r1 && r1.threw), "pane 缺失时 renderModCheats 直接返回（05a L91）" + (r1 && r1.threw ? "（" + r1.threw + "）" : ""));
  const r2 = call(function () { return api.renderModCheatDetail("no-such-mod"); });
  assert(!(r2 && r2.threw), "pane 缺失时 renderModCheatDetail 直接返回（05a L141）" + (r2 && r2.threw ? "（" + r2.threw + "）" : ""));
}

/* ---------- 汇总 ---------- */
console.log("");
if (failures) { console.error("PLAIN BRANCHES TEST: " + failures + " 项失败"); process.exit(1); }
console.log("PLAIN BRANCHES TEST PASSED");
process.exit(0);
