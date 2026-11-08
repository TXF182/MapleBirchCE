/* 地点阶段读写状态测试（branches 门槛 70→80 整改轮 · 第四批）
 *
 * 覆盖对象：07d-places2.js —— placeStageRead 的容错读数、placeStageWrite 的钳制/宿主拒绝/
 * town_projects 自动建壳/「首次 before」留痕、placeStageUndo 的还原与删字段语义，以及
 * 地点页阶段区的真实按钮路径（−1 / +1 / 拉满 / 回退）。
 *
 * 判据说明：所有断言读 **存档实际值** 与 **V.mbCE_wrote 留痕**，不看按钮文案。
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
const V = { player: {}, passage: "Room" };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.placeStageWrite === "function" && typeof api.renderPlaces === "function", "地点阶段写入/渲染 API 已导出");

/* ================= 1. 读数容错 ================= */
section("1 placeStageRead 读数额");
V.town_projects = { school: { fund: 12 } };
assert(api.placeStageRead("town_projects.school.fund") === 12, "嵌套路径读数正确");
assert(api.placeStageRead("town_projects.school.nope") === 0, "字段缺失 → 0（不返回 undefined）");
assert(api.placeStageRead("town_projects.nope.deeper") === 0, "中间宿主缺失 → 0 不抛");
V.weirdNum = "7.6";
assert(api.placeStageRead("weirdNum") === 8, "字符串数字取整（四舍五入）");
V.weirdNum = "not-a-number";
assert(api.placeStageRead("weirdNum") === 0, "非数字 → 0");
V.nullHost = null;
assert(api.placeStageRead("nullHost.x") === 0, "中间为 null → 0（提前返回）");
assert(api.placeStageRead("") === 0, "空路径 → 0");

/* ================= 2. 写入与钳制 ================= */
section("2 placeStageWrite 钳制与留痕");
V.town_projects = { school: { fund: 5 } };
V.mbCE_wrote = {};
const w1 = api.placeStageWrite("town_projects.school.fund", 9, 0, 10);
assert(w1.ok === true && V.town_projects.school.fund === 9, "正常写入 9");
assert(w1.before === 5 && w1.after === 9, "返回结构带 before/after");
assert(V.mbCE_wrote["place:town_projects.school.fund"].before === 5, "留痕记录首次写入前值 5");
const w2 = api.placeStageWrite("town_projects.school.fund", 20, 0, 10);
assert(V.town_projects.school.fund === 10, "超过上限 → 钳到 max=10（阶段档位语义）");
assert(V.mbCE_wrote["place:town_projects.school.fund"].before === 5, "二次写入仍保留首次 before=5（回退不丢失）");
const w3 = api.placeStageWrite("town_projects.school.fund", -3, 2, 10);
assert(V.town_projects.school.fund === 2, "低于下限 → 钳到 min=2");
const w4 = api.placeStageWrite("town_projects.school.fund", "abc", 0, 10);
assert(V.town_projects.school.fund === 0, "非数字目标 → 按 0 处理（不写 NaN）");
assert(api.placeStageWrite("town_projects.school.fund", 3).ok === true, "缺省 min/max 时仍可写（上限放开为 Infinity）");
assert(api.placeStageWrite("", 1).ok === false, "空路径 → 拒绝");
V.ghost = {};
const wGhost = api.placeStageWrite("ghost.child.leaf", 5);
assert(wGhost.ok === false && wGhost.message.indexOf("宿主不存在") >= 0, "非 town_projects 的缺失宿主 → 拒绝并给原因");
assert(V.ghost.child === undefined, "拒绝时不臆造中间宿主");
V.town_projects = undefined;
api.placeStageWrite("town_projects.road", 4, 0, 5);
assert(V.town_projects && V.town_projects.road === 4, "town_projects 顶层缺失 → 自动建壳后写入");
V.mbCE_wrote = "broken";
V.town_projects = { ok: { v: 1 } };
api.placeStageWrite("town_projects.ok.v", 2, 0, 5);
assert(typeof V.mbCE_wrote === "object" && V.mbCE_wrote["place:town_projects.ok.v"], "mbCE_wrote 非对象时自动重建（不抛）");

/* ================= 3. 回退语义 ================= */
section("3 placeStageUndo");
V.town_projects = { ok: { v: 5 } };
V.mbCE_wrote = {};
api.placeStageWrite("town_projects.ok.v", 1, 0, 5);
const u1 = api.placeStageUndo("town_projects.ok.v");
assert(u1.ok === true && V.town_projects.ok.v === 5, "回退还原首次写入前值 5");
assert(!V.mbCE_wrote["place:town_projects.ok.v"], "回退后删除留痕");
assert(api.placeStageUndo("town_projects.ok.v").ok === false, "无留痕 → 拒绝回退");
V.town_projects = { ok: {} };
V.mbCE_wrote = {};
api.placeStageWrite("town_projects.ok.fresh", 3, 0, 5);
assert(api.placeStageUndo("town_projects.ok.fresh").ok === true && ("fresh" in V.town_projects.ok) === false, "before=undefined → 回退时删字段（不是写 undefined）");
V.town_projects = { ok: { v: 4 } };
V.mbCE_wrote = { "place:town_projects.ok.v": { type: "place", path: "town_projects.ok.v", before: 4, after: 4 } };
delete V.town_projects.ok;
const u3 = api.placeStageUndo("town_projects.ok.v");
assert(u3.ok === false && u3.message.indexOf("宿主已被清除") >= 0, "宿主已被清除 → 拒绝回退（不重建宿主）");

/* ================= 4. 真面板路径（−1 / +1 / 拉满 / 回退） ================= */
section("4 renderPlaces 阶段区按钮");
const groups = api.PLACE_STAGE_GROUPS;
assert(Array.isArray(groups) && groups.length > 0, "阶段分组表已导出（" + groups.length + " 组）");
const firstItem = groups[0].items[0];
console.log("INFO: 首项 " + firstItem.key + " path=" + firstItem.path + " max=" + firstItem.max);
/* 按真实 path 建宿主（中间层按需补对象） */
function ensurePath(p, val) {
  const parts = p.split(".");
  let cur = V;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) { cur[parts[i]] = {}; }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}
ensurePath(firstItem.path, 0);
V.mbCE_wrote = {};
api.open();
function clickTab(tab) {
  const btns = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of btns) { if (b.getAttribute("data-tab") === tab) { b.click(); return true; } }
  return false;
}
assert(clickTab("places") === true, "切到「地点」页签");
const pane = document.querySelector('#mce-root [data-pane="places"]');
assert(!!pane, "地点面板已建出");
/* 地点页是「场景直达 / 地点阶段」双层子界面，阶段区要先点子页签（玩家真实路径） */
const stageTab = pane.querySelector('[data-place="stage"]');
assert(!!stageTab, "「地点」子页签按钮存在");
stageTab.click();
const rowSel = '#mce-root [data-pane="places"] [data-stagekey="' + firstItem.key + '"]';
const row = document.querySelector(rowSel);
assert(!!row, "阶段行按 data-stagekey 建出（" + firstItem.key + "）");
assert(!row.querySelector('[data-op="undo"]'), "未写入前不显示「回退」按钮");
function btn(op) { return row.querySelector('[data-op="' + op + '"]'); }
btn("inc").click();
assert(api.placeStageRead(firstItem.path) === 1, "+1 → 从 0 推进到 1");
btn("dec").click();
assert(api.placeStageRead(firstItem.path) === 0, "−1 → 回到 0（下限钳制不出现负数）");
btn("max").click();
assert(api.placeStageRead(firstItem.path) === firstItem.max, "拉满 → 写入原版上限 " + firstItem.max);
const row2 = document.querySelector(rowSel);
const undoBtn = row2.querySelector('[data-op="undo"]');
assert(!!undoBtn, "有留痕后出现「回退」按钮");
undoBtn.click();
assert(api.placeStageRead(firstItem.path) === 0, "点「回退」→ 还原到首次写入前值 0");
/* +1 在满档时不越界 */
ensurePath(firstItem.path, firstItem.max);
V.mbCE_wrote = {};
api.renderPlaces();
const rowFull = document.querySelector(rowSel);
rowFull.querySelector('[data-op="inc"]').click();
assert(api.placeStageRead(firstItem.path) === firstItem.max, "+1 在满档时钳制在上限（不点出不存在档位）");

/* ================= 5. 直达跳转的拒绝路径 ================= */
section("5 teleportTo 拒绝路径");
/* teleportTo 无返回值，拒绝语义体现在状态栏（玩家可见层）——按真实路径断言 */
api.open();
api.teleportTo("NoSuchPassageXYZ");
const errEl = document.querySelector("#mce-root .mce-err");
assert(!!errEl && /段落不存在/.test(errEl.textContent), "未安装的段落 → 状态栏报「段落不存在」（" + (errEl ? errEl.textContent.slice(0, 40) : "无元素") + "）");
api.teleportTo("");
const errEl2 = document.querySelector("#mce-root .mce-err");
assert(!!errEl2 && /段落不存在/.test(errEl2.textContent), "空段落名 → 同拒绝路径（不抛异常）");
/* ================= 6. v2.0.10 场景直达健壮化（好友三处实测崩溃的回归防线） ================= */
section("6 场景直达健壮化（折叠分组 / 调试报告开关 / 段落体检 / 状态兜底）");
V.mbCE_unlockedPlaces = {};

/* 6a 折叠分组：标题行可点、默认收起、mceNewSec 返回 body（29 处调用点靠它继续 appendChild） */
function goDirect() {
  const t = document.querySelector('#mce-root [data-pane="places"] [data-place="direct"]');
  if (t) { t.click(); }
  return document.querySelector('#mce-root [data-pane="places"]');
}
let dPane = goDirect();
assert(!!dPane, "场景直达子页签可进入");
let folds = dPane.querySelectorAll(".mce-blockfold");
assert(folds.length >= 2, "新增折叠区块 ≥2（原版调试报告 / 段落体检），实得 " + folds.length);
const f0 = folds[0];
assert(f0.getAttribute("data-open") === "0", "折叠区块默认收起（data-open=0）");
assert(!!f0.querySelector(".mce-sec-head[role='button']"), "标题行 role=button（可点 + 键盘可达）");
assert(f0.querySelector(".mce-sec-head").getAttribute("tabindex") === "0", "标题行 tabindex=0（Enter/空格可切换）");
assert(!!f0.querySelector(".mce-sec-body") && f0.querySelector(".mce-sec-body").parentElement === f0, "内容落在 body 容器（mceNewSec 返回 body 生效）");
f0.querySelector(".mce-sec-head").click();
dPane = document.querySelector('#mce-root [data-pane="places"]');
const f1 = dPane.querySelectorAll(".mce-blockfold")[0];
assert(f1.getAttribute("data-open") === "1", "点标题行 → 展开（data-open=1）");
assert(f1.querySelector(".mce-sec-arrow").textContent === "▾", "展开后箭头为 ▾");
f1.querySelector(".mce-sec-head").click();
const f2 = document.querySelector('#mce-root [data-pane="places"]').querySelectorAll(".mce-blockfold")[0];
assert(f2.getAttribute("data-open") === "0", "再点 → 收起（data-open=0）");
const lsRaw = window.localStorage.getItem("mbCE_seccollapse");
assert(!!lsRaw && lsRaw.indexOf("|") !== -1, "展开态持久化到 localStorage（mbCE_seccollapse），实得 " + String(lsRaw).slice(0, 60));

/* 6b 原版调试报告开关：写 $options.debugdisable（图 3 野兽战红字的真正开关） */
dPane = goDirect();
function findBtn(root, text) {
  const list = root.querySelectorAll("button");
  for (let i = 0; i < list.length; i++) { if (list[i].textContent.indexOf(text) !== -1) { return list[i]; } }
  return null;
}
const bDbgOff = findBtn(dPane, "关闭调试报告");
assert(!!bDbgOff, "「关闭调试报告」按钮存在");
V.options = {};
bDbgOff.click();
assert(V.options.debugdisable === "t", "点关闭 → $options.debugdisable='t'（调试诊断行不再打印）");
dPane = goDirect();
const bDbgOn = findBtn(dPane, "打开（排查用）");
assert(!!bDbgOn, "「打开（排查用）」按钮存在（可逆）");
bDbgOn.click();
assert(V.options.debugdisable === "f", "点打开 → 回到 'f'");

/* 6c 段落体检：只报宏不配对的段落，注释里的示例宏不算 */
global.Story.passages = [
  { name: "BadIf", text: "<<if $a>>一段没有闭合" },
  { name: "GoodIf", text: "<<if $a>>ok<</if>>" },
  { name: "CommentOnly", text: "/% <<if 示例 %/ 正常正文" }
];
global.Story.has = function (n) { return n === "Bedroom" || n === "Lake Stroll" || n === "BadIf"; };
dPane = goDirect();
const bLint = findBtn(dPane, "开始体检");
assert(!!bLint, "「开始体检」按钮存在");
bLint.click();
dPane = document.querySelector('#mce-root [data-pane="places"]');
const lintTexts = [];
dPane.querySelectorAll(".mce-row-lbl").forEach(function (e) { lintTexts.push(e.textContent); });
assert(lintTexts.some(function (t) { return t.indexOf("BadIf") === 0 && /if 1\/0/.test(t); }), "体检抓到 BadIf 的 if 1/0（未闭合）");
assert(!lintTexts.some(function (t) { return t.indexOf("GoodIf") === 0; }), "配对的 GoodIf 不误报");
assert(!lintTexts.some(function (t) { return t.indexOf("CommentOnly") === 0; }), "注释里的示例宏不误报");
/* 汇总文案在体检区块自己的说明行里（页面另有多个 .mce-stage-txt，按文案特征匹配而非取第一个） */
const allText = [];
dPane.querySelectorAll(".mce-stage-txt, .mce-hint").forEach(function (e) { allText.push(e.textContent); });
assert(allText.some(function (t) { return /共扫描 \d+ 段，宏不配对 1 段/.test(t); }), "汇总文案写明「共扫描 N 段，宏不配对 1 段」");

/* 6d 直达前状态兜底：Bedroom / Lake（只补缺失、不覆盖已有进度） */
const played = [];
global.Engine = { play: function (name) { played.push(name); } };
V.passage = "Room";
V.location = undefined; V.outside = undefined; V.furniture = undefined;
api.teleportTo("Bedroom");
assert(played[played.length - 1] === "Bedroom", "play 了 Bedroom");
assert(V.location === "home", "Bedroom 兜底 location=home");
assert(V.outside === 0, "Bedroom 兜底 outside=0");
assert(typeof V.furniture === "object" && V.furniture !== null && typeof V.furniture.bedroom === "object", "Bedroom 兜底 furniture.bedroom 壳");
/* 原版 StoryInit 的 V.furniture 是 { bedroom: { bed, wardrobe, desk } } 三件默认家具。
   只补空壳 {} 会让 Furniture.get('bed') 返回 null（area 存在但 area[category] 为 undefined），
   Bedroom 段 <<furnitureicon _bed.iconFile>> 直接空引用抛 TypeError → 正文空白 + footer 报
   "The passage Bedroom has no usable links"（实测崩溃形态）。 */
assert(V.furniture.bedroom.bed && V.furniture.bedroom.bed.id === "bed", "Bedroom 兜底补默认家具 bed");
assert(V.furniture.bedroom.wardrobe && V.furniture.bedroom.wardrobe.id === "wardrobe", "Bedroom 兜底补默认家具 wardrobe");
assert(V.furniture.bedroom.desk && V.furniture.bedroom.desk.id === "desk", "Bedroom 兜底补默认家具 desk");
/* 已有进度绝不覆盖 */
V.furniture.bedroom.bed = { id: "luxury" };
V.furniture.bedroom.wardrobe = undefined;
api.teleportTo("Bedroom");
assert(V.furniture.bedroom.bed.id === "luxury", "已有 bed 不被覆盖");
assert(V.furniture.bedroom.wardrobe && V.furniture.bedroom.wardrobe.id === "wardrobe", "缺失的 wardrobe 单独补齐");
V.location = "home"; V.outside = 0;
V.phase = undefined;
api.teleportTo("Lake Stroll");
assert(played[played.length - 1] === "Lake Stroll", "play 了 Lake Stroll");
assert(V.phase === 1, "Lake 兜底 phase=1（缺省草丛）");
V.phase = 0;
api.teleportTo("Lake Stroll");
assert(V.phase === 0, "已走过湖畔时保留 phase=0（不覆盖进度）");

/* 6e 到达校验（到达后 250ms 复查）：有可用链接不回退、零可用链接退回直达前段落 */
section("6e 到达校验 mbCEArrivalCheck");
const mceTimers = [];
const origWindowSetTimeout = window.setTimeout;
const origGlobalSetTimeout = global.setTimeout;
window.setTimeout = function (fn) { mceTimers.push(fn); return mceTimers.length; };
global.setTimeout = window.setTimeout;
function mbCEFlushTimers() {
  let guard = 0;
  while (mceTimers.length && guard++ < 50) {
    const fn = mceTimers.shift();
    try { fn(); } catch (e) { console.error("timer threw: " + e.message); }
  }
}
const pBox = document.createElement("div");
pBox.id = "passages";
document.body.appendChild(pBox);
/* A. 目标段落有可用链接 → 视为到达成功，不回退 */
const okLink = document.createElement("a");
okLink.setAttribute("data-passage", "Bedroom");
okLink.className = "link-internal";
pBox.appendChild(okLink);
V.passage = "Home"; global.State.passage = "Home";
const nA = played.length;
api.teleportTo("Bedroom");
V.passage = "Bedroom"; global.State.passage = "Bedroom";
mbCEFlushTimers();
assert(played.length === nA + 1 && played[played.length - 1] === "Bedroom", "有可用链接 → 不回退（只 play 一次），实得 " + JSON.stringify(played.slice(nA)));
/* B. 零可用链接 → 退回直达前段落，页面不再死锁 */
while (pBox.firstChild) { pBox.removeChild(pBox.firstChild); }
V.passage = "Home"; global.State.passage = "Home";
const nB = played.length;
api.teleportTo("Bedroom");
V.passage = "Bedroom"; global.State.passage = "Bedroom";
mbCEFlushTimers();
assert(played.length === nB + 2 && played[played.length - 1] === "Home", "零可用链接 → 退回原段落 Home（不卡死），实得 " + JSON.stringify(played.slice(nB)));
/* C. 判据必须取 State.passage：$passage 滞后一帧（仍 Home）但 State 已到 Bedroom → 仍要判定到达并回退 */
V.passage = "Home"; global.State.passage = "Home";
const nC = played.length;
api.teleportTo("Bedroom");
V.passage = "Home"; global.State.passage = "Bedroom";
mbCEFlushTimers();
assert(played.length === nC + 2 && played[played.length - 1] === "Home", "零可用链接 + $passage 滞后 → 仍按 State.passage 判定并回退（不漏判），实得 " + JSON.stringify(played.slice(nC)));
window.setTimeout = origWindowSetTimeout;
global.setTimeout = origGlobalSetTimeout;

/* 6f. 全局页区块序号不得重号（折叠键含序号，两个 ⑧ 会让玩家分不清；0 号按实现不显示序号） */
const globalSecIdx = [];
["08-npc-traits2.js", "07f-lock.js", "07f-lurker.js", "07l-vanilla-ext-view.js", "08c-undo-center.js"].forEach(function (f) {
  const src = fs.readFileSync(path.join(__dirname, "..", "javascript", "src", f), "utf8");
  const re = /mceNewSec\(\s*pane\s*,\s*(\d+)/g;
  let m;
  while ((m = re.exec(src)) !== null) { globalSecIdx.push(Number(m[1])); }
});
const dupIdx = globalSecIdx.filter(function (v, i) { return v > 0 && globalSecIdx.indexOf(v) !== i; });
assert(dupIdx.length === 0, "全局页区块序号无重号，实得 " + JSON.stringify(globalSecIdx) + (dupIdx.length ? "（重复 " + JSON.stringify(dupIdx) + "）" : ""));

/* 6g. 直达前宏结构预检：坏宏只提示不阻止、好宏静默、取不到文本安全返回 */
global.Story.has = function (n) { return n === "Bedroom" || n === "Lake Stroll" || n === "BadIf" || n === "GoodIf"; };
const origStoryGet = global.Story.get;
global.Story.get = function (n) { return n === "BadIf" ? { text: "<<if $x>>abc" } : null; };
V.passage = "Home"; global.State.passage = "Home";
const nG = played.length;
api.teleportTo("BadIf");
assert(played.length === nG + 1 && played[played.length - 1] === "BadIf", "坏宏段落仍允许进入（只提示不阻止），实得 " + JSON.stringify(played.slice(nG)));
global.Story.get = function (n) { return n === "GoodIf" ? { text: "<<if $x>>abc<</if>>" } : null; };
V.passage = "Home"; global.State.passage = "Home";
const nH = played.length;
api.teleportTo("GoodIf");
assert(played.length === nH + 1 && played[played.length - 1] === "GoodIf", "好宏段落静默进入，实得 " + JSON.stringify(played.slice(nH)));
global.Story.get = origStoryGet;
V.passage = "Home"; global.State.passage = "Home";
const nI = played.length;
api.teleportTo("Bedroom");
assert(played.length === nI + 1, "取不到段落文本时预检安全返回、不阻断直达，实得 " + JSON.stringify(played.slice(nI)));

/* 6h. 当前段落取值四级回落（直接打导出的内部函数，逐级覆盖 + 全缺分支） */
const stPassageBak = global.State.passage;
dom.window.SugarCube = { State: { passage: "ScPassage" } };
assert(api.mbCECurrentPassage() === "ScPassage", "L1 window.SugarCube.State.passage 优先");
dom.window.SugarCube = {};
global.State.passage = "StatePassage";
assert(api.mbCECurrentPassage() === "StatePassage", "L2 裸 State.passage");
delete global.State.passage;
dom.window.State = { passage: "WinState" };
assert(api.mbCECurrentPassage() === "WinState", "L3 window.State.passage");
dom.window.State = {};
V.passage = "VPassage";
assert(api.mbCECurrentPassage() === "VPassage", "L4 $passage 兜底");
V.passage = undefined;
assert(api.mbCECurrentPassage() === "", "L5 四级全缺返回空串");
delete dom.window.SugarCube; delete dom.window.State;
global.State.passage = stPassageBak; V.passage = "Room";

/* 6i. 宏预检的早退与异常分支 */
const storyBak = global.Story, storyWinBak = dom.window.Story;
/* 产物里 `Story` 走 window 作用域（SugarCube 挂在 window），只改 global.Story 预检会拿到空段落 */
const setStory = function (s) { global.Story = s; dom.window.Story = s; };
setStory({});
assert(api.mbCEPassageMacroWarn("X") === "", "Story 无 get/passage → 空串");
setStory({ get: function () { return null; } });
assert(api.mbCEPassageMacroWarn("X") === "", "取到空段落 → 空串");
setStory({ get: function () { return { text: 123 }; } });
assert(api.mbCEPassageMacroWarn("X") === "", "text 非字符串 → 空串");
setStory({ get: function () { throw new Error("boom"); } });
assert(api.mbCEPassageMacroWarn("X") === "", "Story.get 抛错 → 安全返回空串");
setStory(storyBak);
dom.window.Story = storyWinBak;

/* 6j. 四级回落各来源抛错都要安全落到下一级（覆盖 try/catch 分支） */
const stBak2 = global.State.passage;
Object.defineProperty(dom.window, "SugarCube", { configurable: true, get: function () { throw new Error("sc boom"); } });
global.State.passage = "Catch1";
assert(api.mbCECurrentPassage() === "Catch1", "SugarCube 抛错 → 回落 State.passage");
delete dom.window.SugarCube;
Object.defineProperty(global.State, "passage", { configurable: true, get: function () { throw new Error("st boom"); } });
dom.window.State = { passage: "Catch2" };
assert(api.mbCECurrentPassage() === "Catch2", "State.passage 抛错 → 回落 window.State");
delete global.State.passage;
Object.defineProperty(dom.window, "State", { configurable: true, get: function () { throw new Error("ws boom"); } });
V.passage = "Catch3";
assert(api.mbCECurrentPassage() === "Catch3", "window.State 抛错 → 回落 $passage，实得 " + JSON.stringify(api.mbCECurrentPassage()));
delete dom.window.State;
global.State.passage = stBak2;
V.passage = "Room";
/* Story 只有 passage() 没有 get() 的旧接口形态也要能预检 */
setStory({ passage: function () { return { text: "<<if $x>>abc" }; } });
const warnOld = api.mbCEPassageMacroWarn("X");
assert(warnOld.indexOf("宏结构不配对") >= 0, "Story.passage 旧接口形态也能预检，实得 " + JSON.stringify(warnOld));
global.Story = storyBak;

console.log("\nPLACES STAGE STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
