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

/* ---------- 5a. 07e 场景注册表解析：畸形 widget / Story 全文恢复 / live 合并（plain：L144 / L145 / L157 / L115 / L167 / L232 / L216） ---------- */
var keepStoryObj = global.Story;
function withStory(passages, fn) {
  var arr = passages.map(function (p) { return { name: p.name, text: p.text }; });
  global.Story = { size: arr.length, passages: arr };
  try { return fn(); } finally { global.Story = keepStoryObj; }
}
var scenesKeep = global.V.scenes;
global.V.scenes = {};
/* widget 段落存在但不含 scenes 注册表 → 两级 match 都落空，L145 return null */
var sd1 = withStory([{ name: "W1", text: '<<widget "scenes">><<set $foo to 1>>' }], function () { return api.getScenesDefs(); });
assert("07e L144/L145 widget 无 scenes 注册表 → defs 为空", !sd1 || !sd1.defs || Object.keys(sd1.defs).length === 0);
/* `<<set $scenes to {` 之后没有闭合大括号 → L157 end<0 return null */
var sd2 = withStory([{ name: "W2", text: '<<widget "scenes">><<set $scenes to {"a": { name: "A"' }], function () { return api.getScenesDefs(); });
assert("07e L157 大括号不闭合 → defs 为空", !sd2 || !sd2.defs || Object.keys(sd2.defs).length === 0);
/* Story 全文恢复路径：key 块未闭合（L115 continue）→ recover 收不到任何键 */
var sd3 = withStory([{ name: "P1", text: '"bad": { name: "Bad", unlocked: "$scenePassages.includes(\'bad\')"' }], function () { return api.getScenesDefs(); });
assert("07e L115/L167 未闭合键块 → 全文恢复不产出 defs", !sd3 || !sd3.defs || Object.keys(sd3.defs).length === 0);
/* Story 全文恢复成功 → L232 recoveredC 整份返回 {defs, live:true} */
var sd4 = withStory([{ name: "P2", text: '"rec1": { name: "Rec1", startPassage: "Rec1Start", passages: ["Rec1Start"], unlocked: "$scenePassages.includes(\'rec1\')" }' }], function () { return api.getScenesDefs(); });
assert("07e L232 Story 全文恢复命中 → live:true 且收到 rec1", sd4 && sd4.live === true && !!sd4.defs.rec1 && sd4.defs.rec1.name === "Rec1");
/* widget 解析出 k1，同时 V.scenes 也有 k1 → L216 merged[k] 已存在直接跳过（保留 widget 侧解析值） */
var sd5 = withStory([{ name: "W5", text: '<<widget "scenes">><<set $scenes to {"k1": { name: "K1", startPassage: "S1" }}}>>' }], function () {
  global.V.scenes = { k1: { name: "运行期注入", startPassage: "S9" } };
  return api.getScenesDefs();
});
assert("07e L216 live 键已存在于 widget 解析结果 → 不覆盖", sd5 && sd5.defs.k1 && sd5.defs.k1.name === "K1" && sd5.defs.k1.startPassage === "S1");
global.V.scenes = scenesKeep;

/* ---------- 5b. 跨文件零散可达分支（01-core L255 / 06c L332 / 06d L18 / 07e2 L190 / 07i-actions L334 / 07l L302+L307 / 02 L162） ---------- */
assert("01-core L255 空 NPC 名 → null", api.findNpcEx("") === null || api.findNpc("") === null);
assert("06c L332 isModOnlyRoot 空键 → false", api.isModOnlyRoot("") === false);
var plKeep = global.V.player;
global.V.player = { penisExist: false, vaginaExist: true };
assert("06d L18 仅阴道 → 性别 f", api.getPlayerGender() === "f");
global.V.player = plKeep;
assert("07e-scenes2 L190 未知剧情动作 → 未知动作", api.applyRolePlotAction("zz_unknown_action") === "未知动作");
var npcListKeep = global.V.NPCList;
global.V.NPCList = (Array.isArray(npcListKeep) ? npcListKeep.slice() : []).concat([{ name: "Whitney", init: 0, state: "active" }]);
var whRes = call(function () { return api.yanlingWhitney(true); });
assert("07i-actions L334 惠特尼未初始化 → 明确拒绝", !!whRes && whRes.ok === false && /尚未初始化/.test(String(whRes.msg || whRes.message || "")));
global.V.NPCList = npcListKeep;
/* 07l：连续两次收集，首次写成就日期（L307）、第二次 before 快照已含 maxCount（L302） */
var featsKeep = global.V.feats;
global.V.feats = { currentSave: {} };
call(function () { api.mbCEVanillaAntiqueCollect(); });
var antKeys1 = Object.keys(global.V.feats.currentSave || {});
call(function () { api.mbCEVanillaAntiqueCollect(); });
assert("07l L307 首次收集写入博物馆成就日期", antKeys1.length > 0);
global.V.feats = featsKeep;
assert("02 L162 state !== \"x\" 反向条件可识别", !!call(function () { return api.describeCondition('V.characters.npc.Robin.state !== "drunk"'); }));

/* 04b L158/L161：列表写入的路径门禁（原版根拒绝 / 宿主不存在拒绝） */
var lvVanilla = call(function () { return api.cheatWriteListValue("zz_mod", "k", "value_set", "money", 1, true); });
assert("04b L158 原版根路径 → 拒绝写入", !!lvVanilla && lvVanilla.ok === false && /原版变量/.test(String(lvVanilla.message || "")));
var lvParent = call(function () { return api.cheatWriteListValue("zz_mod", "k", "value_set", "zz_no_such_host.leaf", 1, true); });
assert("04b L161 宿主不存在 → 拒绝写入", !!lvParent && lvParent.ok === false && /宿主不存在/.test(String(lvParent.message || "")));

/* ---------- 5c. 07f-pins2 队列边界（plain：L190 / L252 / L317） ---------- */
/* L252：播放中收到 passage end → 直接返回，不动队列 */
var qKeep252 = global.V.mbCE_queue;
var replayKeep252 = global.V.replayScene;
global.V.mbCE_queue = [{ key: "zzQ", startPassage: "Room", active: true }];
var qJson252 = JSON.stringify(global.V.mbCE_queue);
global.V.replayScene = { key: "zzProbe", startPassage: "Room" };
call(function () { api.mbCEOnPassageEnd(); });
assert("07f-pins2 L252 播放中 passage end → 不清理队列", JSON.stringify(global.V.mbCE_queue) === qJson252);
global.V.replayScene = replayKeep252;
global.V.mbCE_queue = qKeep252;
/* L317：旧版单固定项与队列同 key → 不重复并入 */
var pinKeep317 = global.V.mbCE_pinned;
global.V.mbCE_queue = [{ key: "dupKey", startPassage: "Room", active: true }];
global.V.mbCE_pinned = { active: true, startPassage: "Room", key: "dupKey" };
var pinned317 = call(function () { return api.getPinnedScene(); });
assert("07f-pins2 L317 旧版单固定同 key → 不重复并入队列", Array.isArray(pinned317) && pinned317.length === 1);
global.V.mbCE_pinned = pinKeep317;
global.V.mbCE_queue = qKeep252;
/* L190：场景注册但入口段落不存在 → 直达失败并回传原因 */
var sdDirect = withStory([{ name: "W", text: '<<widget "scenes">><<set $scenes to {"zzDirect": { name: "Zd", startPassage: "NoSuchPassage" }}}>>' }], function () {
  return api.directTriggerScene("zzDirect");
});
assert("07f-pins2 L190 入口段落不存在 → 直达回传失败", !!sdDirect && sdDirect.ok === false);

/* 05a L268：声明为可操控但四类项全空的模组 → 明细页提示「未声明可操控项」 */
api.CHEAT_ADAPTERS.zzEmptyProbe = {
  modId: "zzEmptyProbe", modName: "空声明探针", declared: true,
  entry: { stages: [], abilities: [], values: [], scenes: [] }
};
setActivePane("mods");
call(function () { api.renderModCheatDetail("zzEmptyProbe"); });
assert("05a L268 声明但四类项全空 → 明细页提示", !!document.querySelector('[data-pane="mods"] .mce-hint'));
delete api.CHEAT_ADAPTERS.zzEmptyProbe;

/* ---------- 5d. 03c 原版恋爱阶段回退（plain：L110 / L190 / L194 / L195 / L196） ---------- */
assert("03c L110 非 gwylan 角色 → 解锁返回 0", api.unlockVanillaAll("zz_not_an_npc") === 0);
var wKeep03c = global.V.mbCE_wrote;
var seenKeep03c = global.V.gwylanSeen;
global.V.mbCE_wrote = global.V.mbCE_wrote || {};
global.V.gwylanSeen = [];
global.V.mbCE_wrote["vanilla:yearning"] = { kind: "vanilla" };
var u1 = call(function () { return api.undoVanillaStage("gwylan", "yearning"); });
assert("03c L190/L194 seen 未含 yearning → 撤销无效但仍回执", !!u1 && u1.ok === true && /已回退「yearning」/.test(String(u1.message || "")));
global.V.gwylanSeen = ["partners"];
global.V.mbCE_wrote["vanilla:partners"] = { kind: "vanilla" };
var u2 = call(function () { return api.undoVanillaStage("gwylan", "partners"); });
assert("03c L195 partners 分支被执行并回执", !!u2 && typeof u2.ok === "boolean");
global.V.gwylanSeen = ["romance"];
global.V.mbCE_wrote["vanilla:romance"] = { kind: "vanilla" };
var u3 = call(function () { return api.undoVanillaStage("gwylan", "romance"); });
assert("03c L196 romance 分支被执行并回执", !!u3 && typeof u3.ok === "boolean");
global.V.mbCE_wrote = wKeep03c;
global.V.gwylanSeen = seenKeep03c;

/* ---------- 5e. 04a-15 孩子阶段/地点兜底（plain：L114 / L200 / L205） ---------- */
var kidKids0 = global.V.children;
var kidApi0 = window.EdenChildData;
/* L114：模组 API 直供 child（无 phaseOf）→ 走 edenDeleted 兜底判 removed */
window.EdenChildData = { get: function () { return { childId: 0, bornDate: 1, edenDeleted: true }; } };
var kidDel = call(function () { return api.mbCEFertKidInfo(0); });
assert("04a-15 L114 edenDeleted 兜底 → 阶段 removed", !!kidDel && kidDel.phase === "removed");
window.EdenChildData = kidApi0;
/* L200：无 development 的孩子 → 直写 child.location 兜底 */
global.V.children = { "0": { childId: 0, bornDate: 1, location: "eden_home" } };
var kidLocFlat = call(function () { return api.mbCEFertKidSetLocation(0, "home"); });
assert("04a-15 L200 无 development → 直写 child.location 成功", !!kidLocFlat && kidLocFlat.ok === true && global.V.children["0"].location === "home");
/* L205：development 只读（写入静默失效）→ 回执“无法更新地点” */
global.V.children = { "0": { childId: 0, bornDate: 1, location: "eden_home", development: Object.freeze({}) } };
var kidLocRo = call(function () { return api.mbCEFertKidSetLocation(0, "home"); });
assert("04a-15 L205 只读 development 写不进 → 明确拒绝", !!kidLocRo && kidLocRo.ok === false && /无法更新这个孩子的地点/.test(String(kidLocRo.message || "")));
global.V.children = kidKids0;

/* ---------- 5f. 07f-lock 未知路径 / 09 render 早退 / 08c 回退分发（plain：07f-lock L76、09 L4、08c L85 / L140） ---------- */
assert("07f-lock L76 路径不在任何锁定列表 → 无标签", !api.mbCELockLabel("zz_bogus_path"));
var r9 = call(function () { api.close(); return api.render(); });
assert("09 L4 面板已关闭（root 不存在）→ render 早退", !(r9 && r9.threw));
var uPart = call(function () { return api.undoOne("part:zz_probe"); });
assert("08c L85 part 分支回执", !!uPart && typeof uPart.ok === "boolean");
var uVcore = call(function () { return api.undoOne("vcore:zz_probe"); });
assert("08c L140 vcore 分支回执", !!uVcore && typeof uVcore.ok === "boolean");

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
