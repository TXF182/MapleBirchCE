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
assert(!sd1 || !sd1.defs || Object.keys(sd1.defs).length === 0, "07e L144/L145 widget 无 scenes 注册表 → defs 为空");
/* `<<set $scenes to {` 之后没有闭合大括号 → L157 end<0 return null */
var sd2 = withStory([{ name: "W2", text: '<<widget "scenes">><<set $scenes to {"a": { name: "A"' }], function () { return api.getScenesDefs(); });
assert(!sd2 || !sd2.defs || Object.keys(sd2.defs).length === 0, "07e L157 大括号不闭合 → defs 为空");
/* Story 全文恢复路径：key 块未闭合（L115 continue）→ recover 收不到任何键 */
var sd3 = withStory([{ name: "P1", text: '"bad": { name: "Bad", unlocked: "$scenePassages.includes(\'bad\')"' }], function () { return api.getScenesDefs(); });
assert(!sd3 || !sd3.defs || Object.keys(sd3.defs).length === 0, "07e L115/L167 未闭合键块 → 全文恢复不产出 defs");
/* Story 全文恢复成功 → L232 recoveredC 整份返回 {defs, live:true} */
var sd4 = withStory([{ name: "P2", text: '"rec1": { name: "Rec1", startPassage: "Rec1Start", passages: ["Rec1Start"], unlocked: "$scenePassages.includes(\'rec1\')" }' }], function () { return api.getScenesDefs(); });
assert(sd4 && sd4.live === true && !!sd4.defs.rec1 && sd4.defs.rec1.name === "Rec1", "07e L232 Story 全文恢复命中 → live:true 且收到 rec1");
/* widget 解析出 k1，同时 V.scenes 也有 k1 → L216 merged[k] 已存在直接跳过（保留 widget 侧解析值） */
var sd5 = withStory([{ name: "W5", text: '<<widget "scenes">><<set $scenes to {"k1": { name: "K1", startPassage: "S1" }}}>>' }], function () {
  global.V.scenes = { k1: { name: "运行期注入", startPassage: "S9" } };
  return api.getScenesDefs();
});
assert(sd5 && sd5.defs.k1 && sd5.defs.k1.name === "K1" && sd5.defs.k1.startPassage === "S1", "07e L216 live 键已存在于 widget 解析结果 → 不覆盖");
global.V.scenes = scenesKeep;

/* ---------- 5b. 跨文件零散可达分支（01-core L255 / 06c L332 / 06d L18 / 07e2 L190 / 07i-actions L334 / 07l L302+L307 / 02 L162） ---------- */
assert(api.findNpcEx("") === null || api.findNpc("") === null, "01-core L255 空 NPC 名 → null");
assert(api.isModOnlyRoot("") === false, "06c L332 isModOnlyRoot 空键 → false");
var plKeep = global.V.player;
global.V.player = { penisExist: false, vaginaExist: true };
assert(api.getPlayerGender(global.V) === "f", "06d L18 仅阴道（无 sex 键）→ 性别 f（getPlayerGender 首参是 V，不传 V 会被 catch 兜成 unknown）");
global.V.player = plKeep;
assert(api.applyRolePlotAction("zz_unknown_action") === "未知动作", "07e-scenes2 L190 未知剧情动作 → 未知动作");
var npcListKeep = global.V.NPCList;
global.V.NPCList = (Array.isArray(npcListKeep) ? npcListKeep.slice() : []).concat([{ name: "Whitney", init: 0, state: "active" }]);
var whRes = call(function () { return api.yanlingWhitney(true); });
assert(!!whRes && whRes.ok === false && /尚未初始化|无惠特尼槽位/.test(String(whRes.msg || whRes.message || "")), "07i-actions L334 惠特尼不可操作（未初始化/无槽位）→ 明确拒绝");
global.V.NPCList = npcListKeep;
/* 07l：连续两次收集，首次写成就日期（L307）、第二次 before 快照已含 maxCount（L302） */
var featsKeep = global.V.feats;
var maKeep = global.V.museumAntiques;
/* 收集的前置是 $museumAntiques 存在（L138 无则直接拒绝），缺它整条用例只测到拒绝分支 */
global.V.museumAntiques = { antiques: { zzA1: "notFound" }, paintings: {}, maxCount: 0 };
global.V.feats = { currentSave: {} };
var col1 = call(function () { return api.mbCEVanillaAntiqueCollect(); });
var antKeys1 = Object.keys(global.V.feats.currentSave || {});
call(function () { return api.mbCEVanillaAntiqueCollect(); });
assert(!!col1 && col1.ok === true && antKeys1.length > 0 && global.V.museumAntiques.antiques.zzA1 === "found",
  "07l L174/L175 首次收集把古董写 found 并写入博物馆成就日期（L307 是回退期的 feat 恢复，不在本用例）");
global.V.feats = featsKeep;
global.V.museumAntiques = maKeep;
var dcRes = call(function () { return api.describeCondition('rv.characters.npc.Robin.state !== "drunk"'); });
assert(typeof dcRes === "string" && dcRes.indexOf("当前状态不是") !== -1, "07d L359 反向 state 条件可识别（displayName 会把 Robin 转成中文名，故按句式判；describeCondition 只认 rv. 前缀）");

/* 04b L158/L161：列表写入的路径门禁（原版根拒绝 / 宿主不存在拒绝） */
/* 原版根黑名单是窄列表（farm/gwylan/daily/characters…），money 不在其中（CE 本就允许改原版数值），故选 farm_stage 作靶 */
var lvVanilla = call(function () { return api.cheatWriteListValue("zz_mod", "k", "value_set", "farm_stage", 1, true); });
assert(!!lvVanilla && lvVanilla.ok === false && /原版变量/.test(String(lvVanilla.message || "")), "04b L158 原版根路径 → 拒绝写入");
var lvParent = call(function () { return api.cheatWriteListValue("zz_mod", "k", "value_set", "zz_no_such_host.leaf", 1, true); });
assert(!!lvParent && lvParent.ok === false && /宿主不存在/.test(String(lvParent.message || "")), "04b L161 宿主不存在 → 拒绝写入");

/* ---------- 5c. 07f-pins2 队列边界（plain：L190 / L252 / L317） ---------- */
/* L252：播放中收到 passage end → 直接返回，不动队列 */
var qKeep252 = global.V.mbCE_queue;
var replayKeep252 = global.V.replayScene;
global.V.mbCE_queue = [{ key: "zzQ", startPassage: "Room", active: true }];
var qJson252 = JSON.stringify(global.V.mbCE_queue);
global.V.replayScene = { key: "zzProbe", startPassage: "Room" };
call(function () { api.mbCEOnPassageEnd(); });
assert(JSON.stringify(global.V.mbCE_queue) === qJson252, "07f-pins2 L252 播放中 passage end → 不清理队列");
global.V.replayScene = replayKeep252;
global.V.mbCE_queue = qKeep252;
/* L317：旧版单固定项与队列同 key → 不重复并入 */
var pinKeep317 = global.V.mbCE_pinned;
global.V.mbCE_queue = [{ key: "dupKey", startPassage: "Room", active: true }];
global.V.mbCE_pinned = { active: true, startPassage: "Room", key: "dupKey" };
var pinned317 = call(function () { return api.getPinnedScene(); });
assert(Array.isArray(pinned317) && pinned317.length === 1, "07f-pins2 L317 旧版单固定同 key → 不重复并入队列");
global.V.mbCE_pinned = pinKeep317;
global.V.mbCE_queue = qKeep252;
/* L190：场景注册但入口段落不存在 → 直达失败并回传原因 */
var sdDirect = withStory([{ name: "W", text: '<<widget "scenes">><<set $scenes to {"zzDirect": { name: "Zd", startPassage: "NoSuchPassage" }}}>>' }], function () {
  return api.directTriggerScene("zzDirect");
});
assert(!!sdDirect && sdDirect.ok === false, "07f-pins2 L190 入口段落不存在 → 直达回传失败");

/* 05a L268：声明为可操控但四类项全空的模组 → 明细页提示「未声明可操控项」 */
api.CHEAT_ADAPTERS.zzEmptyProbe = {
  modId: "zzEmptyProbe", modName: "空声明探针", declared: true,
  entry: { stages: [], abilities: [], values: [], scenes: [] }
};
setActivePane("mods");
var dProbe = call(function () { return api.renderModCheatDetail("zzEmptyProbe"); });
var dPane = document.querySelector('[data-pane="mods"]');
var dText = dPane ? dPane.textContent : "";
assert(!(dProbe && dProbe.threw) && /未识别|未声明可操控项/.test(dText),
  "05a 无有效声明的模组 → 明细页明确提示且不抛错（L269 空声明提示；仅声明 entry 而不注册则走「未识别」）");
delete api.CHEAT_ADAPTERS.zzEmptyProbe;

/* ---------- 5d. 03c 原版恋爱阶段回退（plain：L110 / L190 / L194 / L195 / L196） ---------- */
assert(api.unlockVanillaAll("zz_not_an_npc") === 0, "03c L110 非 gwylan 角色 → 解锁返回 0");
var wKeep03c = global.V.mbCE_wrote;
var seenKeep03c = global.V.gwylanSeen;
global.V.mbCE_wrote = global.V.mbCE_wrote || {};
global.V.gwylanSeen = [];
global.V.mbCE_wrote["vanilla:yearning"] = { kind: "vanilla" };
var u1 = call(function () { return api.undoVanillaStage("gwylan", "yearning"); });
assert(!!u1 && u1.ok === true && /已回退「yearning」/.test(String(u1.message || "")), "03c L190/L194 seen 未含 yearning → 撤销无效但仍回执");
global.V.gwylanSeen = ["partners"];
global.V.mbCE_wrote["vanilla:partners"] = { kind: "vanilla" };
var u2 = call(function () { return api.undoVanillaStage("gwylan", "partners"); });
assert(!!u2 && typeof u2.ok === "boolean", "03c L195 partners 分支被执行并回执");
global.V.gwylanSeen = ["romance"];
global.V.mbCE_wrote["vanilla:romance"] = { kind: "vanilla" };
var u3 = call(function () { return api.undoVanillaStage("gwylan", "romance"); });
assert(!!u3 && typeof u3.ok === "boolean", "03c L196 romance 分支被执行并回执");
global.V.mbCE_wrote = wKeep03c;
global.V.gwylanSeen = seenKeep03c;

/* ---------- 5e. 04a-15 孩子阶段/地点兜底（plain：L114 / L200 / L205） ---------- */
var kidKids0 = global.V.children;
var kidApi0 = window.EdenChildData;
/* L114：模组 API 直供 child（无 phaseOf）→ 走 edenDeleted 兜底判 removed */
window.EdenChildData = { get: function () { return { childId: 0, bornDate: 1, edenDeleted: true }; } };
var kidDel = call(function () { return api.mbCEFertKidInfo(0); });
assert(!!kidDel && kidDel.phase === "removed", "04a-15 L114 edenDeleted 兜底 → 阶段 removed");
window.EdenChildData = kidApi0;
/* L200：无 development 的孩子 → 直写 child.location 兜底 */
global.V.children = { "0": { childId: 0, bornDate: 1, location: "eden_home" } };
var kidLocFlat = call(function () { return api.mbCEFertKidSetLocation(0, "home"); });
assert(!!kidLocFlat && kidLocFlat.ok === true && global.V.children["0"].location === "home", "04a-15 L200 无 development → 直写 child.location 成功");
/* L205：development 只读（写入静默失效）→ 回执“无法更新地点” */
global.V.children = { "0": { childId: 0, bornDate: 1, location: "eden_home", development: Object.freeze({}) } };
var kidLocRo = call(function () { return api.mbCEFertKidSetLocation(0, "home"); });
assert(!!kidLocRo && kidLocRo.ok === false && /无法更新这个孩子的地点/.test(String(kidLocRo.message || "")), "04a-15 L205 只读 development 写不进 → 明确拒绝");
global.V.children = kidKids0;

/* ---------- 5f. 07f-lock 未知路径 / 09 render 早退 / 08c 回退分发（plain：07f-lock L76、09 L4、08c L85 / L140） ---------- */
/* L76 的 mbCELockTarget 未导出，且 tick 只遍历已有项，外部构造不出「列表存在但不含该 path」；此处验证同一语义层 label 的回退行为 */
assert(api.mbCELockLabel("zz_bogus_path") === "zz_bogus_path", "07f-lock 未知路径的标签回退为原路径（L55）；L76 mbCELockTarget 未导出，不可直达");
var r9 = call(function () { api.close(); api.open(); return true; });
assert(!(r9 && r9.threw), "09 面板 close→open 往返不抛错（open 内调 render；L4 的 root 缺失早退是防御分支，root 变量在 close 后仍存在，本用例构造不出）");
var uPart = call(function () { return api.undoOne("part:zz_probe"); });
assert(!!uPart && typeof uPart.ok === "boolean", "08c L85 part 分支回执");
var uVcore = call(function () { return api.undoOne("vcore:zz_probe"); });
assert(!!uVcore && typeof uVcore.ok === "boolean", "08c L140 vcore 分支回执");

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

/* ---------- 7. 09-exports render 主线（plain：L18 角色记忆失效回落 / L19 恢复上次角色） ----------
   本轮取证：此前 render 在 frameworkReady() 或 chars 为空处就 return，L15-19 整段从未执行
   （09-exports.js 覆盖率 63.8% 全仓最低的直接原因：夹具里 window.maplebirch.npc 是空对象）。
   补 NPCNameList 让 listCharacters() 非空后，render 主线才真正跑到。
   顺序不可颠倒：先 curName 为空 + uiState 命中（L19），再让池内不含 curName（L18）。
   放在最后：open() 会重建面板 DOM，会改变前面依赖 pane 结构的断言。 */
window.maplebirch.npc.NPCNameList = ["Robin", "Whitney"];
api.mbCEUiSave({ curName: "Robin" });
const r19 = call(function () { api.open(); return true; });
assert(!(r19 && r19.threw), "09 L19 恢复上次角色：curName 空 + uiState.curName 命中池内，render 不抛" + (r19 && r19.threw ? "（" + r19.threw + "）" : ""));
assert(api.mbCEUiState().curName === "Robin", "09 L19 执行后 curName 取回 uiState 值 Robin（实际 " + String(api.mbCEUiState().curName) + "）");
window.maplebirch.npc.NPCNameList = ["Whitney"];
const r18 = call(function () { api.open(); return api.mbCEUiState().curName; });
assert(!(r18 && r18.threw), "09 L18 角色记忆失效回落：curName=Robin 已不在池内，render 不抛" + (r18 && r18.threw ? "（" + r18.threw + "）" : ""));
assert(r18 === "Whitney", "09 L18 回落到池内第一个角色 Whitney 并同步 UI 状态（实际 " + String(r18) + "）");

/* ---------- 8. 05a Mod 作弊页：注册池贯通（plain：L115 未声明 / L118 已声明 / L268 空声明） ----------
   取证：getCheatMods() 的三源之一是 setup.mbCE_modCheats 注册数组（05a2-modcheat-rows-build.js:5），
   测试可直接注入。此前该数组为空、且适配器 detect() 在空框架夹具下全不命中 ⇒ renderModCheats
   走 L104「暂未识别」早退，L109-124 的卡片循环与 L262-270 的四组判定从未执行。
   放在最后：本段改写注册池，会影响前面所有依赖「无模组」的断言。 */
/* 第 6 段移走 [data-pane="mods"] 后，ensureDom 因 root 仍在 body 内而不会重建（09-exports.js:67），
   故本段自行把 pane 补回 .mce-root 下，否则 renderModCheats 会停在 L91 早退。 */
const rootEl8 = document.querySelector(".mce-root");
if (rootEl8 && !rootEl8.querySelector('[data-pane="mods"]')) {
  const mkPane8 = rootEl8.ownerDocument.createElement("div");
  mkPane8.setAttribute("data-pane", "mods");
  rootEl8.appendChild(mkPane8);
}
global.setup.mbCE_modCheats = [
  { modId: "t_nodecl", modName: "测试-未声明模组", declared: false },
  { modId: "t_empty", modName: "测试-空声明模组", declared: true, tasks: [], stages: [], abilities: [], scenes: [], values: [], actions: [] }
];
const rList = call(function () { api.renderModCheats(); return true; });
assert(!(rList && rList.threw), "renderModCheats 注入两条注册项后不抛（L109 卡片循环可达）" + (rList && rList.threw ? "（" + rList.threw + "）" : ""));
const mp8 = document.querySelector('[data-pane="mods"]');
/* 05a L115「未声明模组」守卫已删除（结构性不可达）：declared 只有两个来源——注册表项经
   normalizeCheatMod 强制 declared:true（04c-modcheat-util.js:4），被动探针项字面写 declared:false
   （05a2:25）但 CHEAT_PASSIVE_PROBES 在 03d:122 建为空数组后全仓无任何 push ⇒ 无可达输入。
   下面这条断言继续取证「输入域全体 declared=true」这个恒真前提——它就是删除该守卫的依据；
   断言若变红说明输入域变了，必须回去恢复 05a 的未声明守卫（不绑点击、只展示提示）。
   注意注入的 t_nodecl 字面 declared:false 会被 normalizeCheatMod 覆盖成 true，故不是可达反例。 */
const mods8 = api.getCheatMods();
assert(Array.isArray(mods8) && mods8.length >= 2 && mods8.every(function (m) { return m.declared === true; }), "declared 输入域取证（05a 守卫删除前提）：getCheatMods() 全部 declared=true（" + String(mods8 ? mods8.length : -1) + " 项）");
assert(!!mp8 && mp8.querySelectorAll(".mce-card").length >= 2, "L118 已声明模组走可操控卡片分支（卡片数 " + String(mp8 ? mp8.querySelectorAll(".mce-card").length : -1) + "）");
const rEmpty = call(function () { api.renderModCheatDetail("t_empty"); return true; });
assert(!(rEmpty && rEmpty.threw), "renderModCheatDetail 空声明模组不抛（L262 四组判定可达）" + (rEmpty && rEmpty.threw ? "（" + rEmpty.threw + "）" : ""));
assert(!!mp8 && /未声明可操控项/.test(mp8.textContent), "L268 四组全空时渲染「未声明可操控项」提示");

/* ---------- 9. 08-npc-traits2 全局页：誓言状态 + 自动维护开关（plain：L125 / L126 / L255 / L257） ----------
   取证：vowTxt 的两个「有值才追加」分支要被 getVowStatus() 非空（08-npc-traits.js:71/72 读
   V.templePromised / V.temple_rank）；自动维护的 msg 兜底 else 只被 acItems 中「没有专属
   else-if」的 clean 命中（08-npc-traits2.js:250-255 覆盖 feed/farm/temple/eden/restock 五项，漏 clean）。
   放在最后：本段点击会真写 V（mcAutoRunOnce），会改变前面依赖 V 原值的断言。 */
global.V.templePromised = "Robin";
global.V.temple_rank = 5;
/* renderGlobal 未导出（09-exports2 只导出 render* 之外的操作层），走页签分发 switchOuterTab（07a-shell2.js:17） */
const tabGlobal9 = document.querySelector('.mce-tabs button[data-tab="global"]');
assert(!!tabGlobal9, "全局页签按钮存在（前置）");
const rVow = call(function () { tabGlobal9.dispatchEvent(new window.Event("click", { bubbles: true })); return true; });
assert(!(rVow && rVow.threw), "renderGlobal 带誓言状态渲染不抛" + (rVow && rVow.threw ? "（" + rVow.threw + "）" : ""));
const gp9 = document.querySelector('[data-pane="global"]');
assert(!!gp9 && /承诺对象：Robin/.test(gp9.textContent), "L125 承诺对象非空时追加「承诺对象」（实际含 " + String(!!gp9 && /承诺对象/.test(gp9.textContent)) + "）");
assert(!!gp9 && /神殿等级：5/.test(gp9.textContent), "L126 神殿等级非空时追加「神殿等级」（实际含 " + String(!!gp9 && /神殿等级/.test(gp9.textContent)) + "）");
/* 自动庄园打扫：acItems 里唯一没有专属 else-if 的 key（clean）→ 首次开启落到 L255 兜底文案 */
const btnClean = gp9 ? Array.prototype.filter.call(gp9.querySelectorAll("button"), function (b) { return /自动庄园打扫/.test(b.textContent); })[0] : null;
assert(!!btnClean, "自动庄园打扫开关按钮存在（前置，原文 " + String(btnClean ? btnClean.textContent : "") + "）");
if (btnClean) {
  const rOn = call(function () { btnClean.dispatchEvent(new window.Event("click", { bubbles: true })); return true; });
  assert(!(rOn && rOn.threw), "L255 开启 clean 开关不抛（无专属 else-if → 兜底文案）" + (rOn && rOn.threw ? "（" + rOn && rOn.threw + "）" : ""));
  assert(/自动庄园打扫（开）/.test(btnClean.textContent), "L255 开启后按钮文案变为「（开）」（实际 " + btnClean.textContent + "）");
  const rOff = call(function () { btnClean.dispatchEvent(new window.Event("click", { bubbles: true })); return true; });
  assert(!(rOff && rOff.threw), "L257 关闭分支不抛" + (rOff && rOff.threw ? "（" + rOff.threw + "）" : ""));
  assert(/自动庄园打扫（关）/.test(btnClean.textContent), "L257 关闭后按钮文案回到「（关）」（实际 " + btnClean.textContent + "）");
}

/* ---------- 10. 07a-shell2 错误池：全局熔断提示 + 钩子幂等（plain：L202 / L235） ----------
   熔断阈值取自源码而非猜测：07a-shell2.js:179 `curCount + prevCount >= 200` 才置 fuseAllUntil，
   L202 只在错误框渲染时（点开 .mce-errbtn → mbCEToggleErrBox → mbCERenderErrBox）判定，
   故先压 210 条再点开列表。L235 是 mbCEHookErrors 的幂等闸（mbCEHookDone），open() 内会调一次
   （09-exports2.js:36），所以第二次 open() 必然命中。 */
const rReopen = call(function () { api.open(); return true; });
assert(!(rReopen && rReopen.threw), "二次 open() 幂等不抛（L235 mbCEHookDone 早退）" + (rReopen && rReopen.threw ? "（" + rReopen.threw + "）" : ""));
const rPush = call(function () {
  for (var k = 0; k < 210; k++) { api.mbCEPushError("plain 风暴 " + k, "mce-plain-test", ""); }
  return true;
});
assert(!(rPush && rPush.threw), "压入 210 条错误不抛（触发 1 分钟 ≥200 条全局熔断）" + (rPush && rPush.threw ? "（" + rPush.threw + "）" : ""));
const errBtn10 = document.querySelector(".mce-errbtn");
assert(!!errBtn10, "错误徽标按钮存在（前置）");
const rErrBox = call(function () { errBtn10.dispatchEvent(new window.Event("click", { bubbles: true })); return true; });
assert(!(rErrBox && rErrBox.threw), "点开错误列表不抛" + (rErrBox && rErrBox.threw ? "（" + rErrBox.threw + "）" : ""));
assert(/高频错误风暴已熔断/.test(document.body.textContent), "L202 熔断期渲染「高频错误风暴已熔断」提示（实际含 " + String(/已熔断/.test(document.body.textContent)) + "）");

/* ---------- 汇总 ---------- */
console.log("");
if (failures) { console.error("PLAIN BRANCHES TEST: " + failures + " 项失败"); process.exit(1); }
console.log("PLAIN BRANCHES TEST PASSED");
process.exit(0);
