/* Mod 作弊页动作与拒绝路径测试（branches 门槛 70→80 整改轮 · 第五批）
 *
 * 覆盖对象：05a-modcheat-rows.js（动作分流/拒绝文案/模组列表渲染）+ 05a2-modcheat-rows-build.js
 * （模组查询、阶段枚举、行构建）+ 05a3-modcheat-actions.js（动作行）。
 *
 * 判据：所有写入断言读 **存档实际值 + V.mbCE_wrote 留痕**；拒绝断言读 **状态栏 .mce-err 文案**
 * （即玩家真实可见层），不看内部返回值。
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
const V = {
  player: {}, passage: "Room",
  fakeA: { t1_skip: false, t1_done: false, t2_skip: false, s1: 0, s2: "none", a1: 0, a2: false, sc1_skip: false, sc1_done: false, sc1p: 0, v1: 3, v2: false, v3: "x", v4: ["A"] },
  mbCE_wrote: {}
};
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
window.__mbCE_forceSyncRows = true; /* 分片构建强制同步（测试环境，见 05a 文件头契约） */

/* 假模组：注册通道 setup.mbCE_modCheats（05a2 getCheatMods 第一来源） */
const DECL = {
  modId: "fake-a", modName: "假模组A", declared: true,
  tasks: [
    { key: "t1", name: "任务1", skipVar: "fakeA.t1_skip", completeVar: "fakeA.t1_done" },
    { key: "t2", name: "任务2" }
  ],
  stages: [
    { key: "s1", name: "数字阶段", varPath: "fakeA.s1", levels: [0, 1, 2] },
    { key: "s2", name: "字符串阶段", varPath: "fakeA.s2", levels: ["none", "mid", "full"] }
  ],
  abilities: [
    { key: "a1", name: "数值能力", varPath: "fakeA.a1", numeric: true, min: 0, max: 5 },
    { key: "a2", name: "布尔能力", varPath: "fakeA.a2" },
    { key: "a3", name: "无变量能力" }
  ],
  scenes: [
    { key: "sc1", name: "剧情1", skipVar: "fakeA.sc1_skip", completeVar: "fakeA.sc1_done", progressVar: "fakeA.sc1p", resetValue: 2 },
    { key: "sc2", name: "剧情2" }
  ],
  values: [
    { key: "v1", name: "数值1", varPath: "fakeA.v1", type: "number", min: 0, max: 10 },
    { key: "v2", name: "布尔2", varPath: "fakeA.v2", type: "boolean" },
    { key: "v3", name: "文本3", varPath: "fakeA.v3", type: "string" },
    { key: "v4", name: "列表4", varPath: "fakeA.v4", type: "list", options: ["A", "B"] },
    { key: "v5", name: "无变量5" }
  ]
};
setup.mbCE_modCheats = [DECL, null, { modId: "only-id" }, { modId: "undecl-x", modName: "未声明模组X", declared: false }];

function tab(t) {
  const btns = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of btns) { if (b.getAttribute("data-tab") === t) { b.click(); return true; } }
  return false;
}
function statusErr() {
  const e = document.querySelector("#mce-root .mce-err");
  return e ? e.textContent : "";
}
function pane() { return document.querySelector('#mce-root [data-pane="mods"]'); }
function openGroup(gkey) {
  const head = pane().querySelector('[data-mce-head="' + gkey + '"]');
  if (head) { head.click(); }
  return head;
}
function rowByKey(k) { return pane().querySelector('[data-mce-key="' + k + '"]'); }
function btnIn(row, text) {
  if (!row) { return null; }
  const bs = row.querySelectorAll("button");
  for (const b of bs) { if (b.textContent.trim() === text) { return b; } }
  return null;
}

/* ================= 1. 模组查询容错 ================= */
section("1 getCheatMods 归一化");
const mods = api.getCheatMods();
const ids = mods.map(function (m) { return m.modId; });
assert(ids.indexOf("fake-a") >= 0, "注册的模组被识别（fake-a）");
assert(ids.indexOf("undecl-x") >= 0, "未声明模组也展示（declared:false）");
assert(ids.indexOf("only-id") === -1, "缺 modName 的注册项被跳过");
assert(ids.indexOf("") === -1, "空 modId 被跳过（null 项）");
const fake = mods.filter(function (m) { return m.modId === "fake-a"; })[0];
assert(Array.isArray(fake.values) && fake.values.length === DECL.values.length, "四分组被归一化为数组（values=" + fake.values.length + "）");

/* ================= 2. 模组列表页 ================= */
section("2 renderModCheats");
api.open();
assert(tab("mods") === true, "切到「Mod作弊」页签");
const union = pane().textContent;
assert(union.indexOf("玩家自己") >= 0, "玩家自己入口卡片常驻");
const undeclCard = Array.prototype.slice.call(pane().querySelectorAll(".mce-card")).filter(function (c) { return c.textContent.indexOf("未声明模组X") >= 0; })[0];
assert(!!undeclCard, "未声明模组卡片建出");
/* 已知口径（实测 normalizeCheatMod）：走 setup.mbCE_modCheats 注册通道的模组一律视为 declared=true
   ——「未声明」标记只产生于被动探测/适配器自动识别（declared:false）路径，注册即等于声明。 */
assert(undeclCard.querySelector(".mce-badge.mce-on") && /可操控/.test(undeclCard.textContent), "注册通道的模组统一按 declared=true 展示「可操控」（注册=声明口径）");
assert(fake.declared === true, "getCheatMods 归一化后 declared 为 true（与上一条同源）");
const fakeCard = Array.prototype.slice.call(pane().querySelectorAll(".mce-card")).filter(function (c) { return c.textContent.indexOf("假模组A") >= 0; })[0];
assert(!!fakeCard && !!fakeCard.querySelector(".mce-on"), "已声明模组打「可操控」标记");
fakeCard.click();
assert(pane().textContent.indexOf("【假模组A】作弊控制") >= 0, "点模组卡片进入控制子页（玩家真实路径）");
assert(!!pane().querySelector('[data-mce-tool="mods-open"]'), "子页有「全部展开」工具");

/* ================= 3. 任务组 ================= */
section("3 任务：跳过/完成/拒绝");
openGroup("tasks");
const t1 = rowByKey("tasks:t1"), t2 = rowByKey("tasks:t2");
assert(!!t1 && !!t2, "任务行按 data-mce-key 建出");
btnIn(t1, "跳过任务").click();
assert(V.fakeA.t1_skip === true, "跳过任务 → skipVar 写 true");
assert(V.mbCE_wrote["cheat:fake-a:task_skip:t1"], "写入留痕（cheat:fake-a:task_skip:t1）");
btnIn(t1, "直接完成任务").click();
assert(V.fakeA.t1_done === true, "直接完成任务 → completeVar 写 true");
btnIn(t2, "跳过任务").click();
assert(/未声明跳过标记变量/.test(statusErr()), "未声明 skipVar → 状态栏拒绝文案");
assert(V.fakeA.t2_skip === false, "拒绝时不落档");
/* 局部刷新失败 → 兜底全量重建详情页（05a actCheat 删两层恒真判定的等价保护断言）：
   原代码走 `if (modId) { renderModCheatDetail(modId); }` 的真分支（modId 假分支结构性不可达），
   删除判定后该行无条件执行，玩家可见结果必须与改前完全一致——仍停在模组子页、不抛。
   构造方式：把目标行从 DOM 摘掉，使 refreshModRow 因 querySelector 落空返回 false。 */
const t1RowFb = rowByKey("tasks:t1");
const t1SkipBtnFb = btnIn(t1RowFb, "跳过任务");
t1RowFb.parentNode.removeChild(t1RowFb);
let rFallback = null;
try { t1SkipBtnFb.click(); } catch (e) { rFallback = String((e && e.message) || e); }
assert(rFallback === null, "局部刷新落空时 actCheat 不抛（行已摘除）" + (rFallback ? "（" + rFallback + "）" : ""));
assert(pane().textContent.indexOf("【假模组A】作弊控制") >= 0, "局部刷新落空 → 兜底重建详情页（仍停在模组子页，非退回列表页）");

/* ================= 4. 阶段组 ================= */
section("4 阶段：数字枚举 / 字符串枚举 / 跳最高 / 回退初始");
openGroup("stages");
const s1 = rowByKey("stages:s1"), s2 = rowByKey("stages:s2");
assert(!!s1 && !!s2, "阶段行建出（含能力行同组）");
const sel1 = s1.querySelector("select");
sel1.value = "2";
btnIn(s1, "应用").click();
assert(V.fakeA.s1 === 2, "数字阶段应用 2");
btnIn(s1, "跳至最高").click();
assert(V.fakeA.s1 === 2, "跳至最高 → levels 末位 2");
btnIn(s1, "回退初始").click();
assert(V.fakeA.s1 === 0, "回退初始 → levels 首位 0");
const sel2 = s2.querySelector("select");
sel2.value = "full";
btnIn(s2, "应用").click();
assert(V.fakeA.s2 === "full", "字符串枚举阶段写字符串本身（不是索引）");
btnIn(s2, "回退初始").click();
assert(V.fakeA.s2 === "none", "字符串枚举回退初始 → 首项 none");

/* ================= 5. 能力组（numeric / boolean / 无 varPath） ================= */
section("5 能力开关");
openGroup("abilities");
const a1 = rowByKey("abilities:a1"), a2 = rowByKey("abilities:a2"), a3 = rowByKey("abilities:a3");
assert(!!a1 && !!a2 && !!a3, "三行能力建出");
const box1 = a1.querySelector('input[type="checkbox"]');
box1.checked = true;
box1.dispatchEvent(new window.Event("change"));
assert(V.fakeA.a1 === 1, "numeric 能力勾选 → 写数字 1（满足模组 is 1 判定）");
box1.checked = false;
box1.dispatchEvent(new window.Event("change"));
assert(V.fakeA.a1 === 0, "numeric 能力取消 → 写数字 0");
const box2 = a2.querySelector('input[type="checkbox"]');
box2.checked = true;
box2.dispatchEvent(new window.Event("change"));
assert(V.fakeA.a2 === true, "布尔能力勾选 → 写 true");
const box3 = a3.querySelector('input[type="checkbox"]');
box3.checked = true;
box3.dispatchEvent(new window.Event("change"));
assert(/未声明能力变量/.test(statusErr()), "无 varPath 能力 → 状态栏拒绝文案");
box3.checked = false;
box3.dispatchEvent(new window.Event("change"));
assert(/未声明能力变量/.test(statusErr()), "取消勾选同样被拒绝（不静默落档）");
assert(a1.textContent.indexOf("写入路径：fakeA.a1") >= 0, "能力行「说明」折叠内含写入路径（可查）");

/* ================= 6. 剧情组 ================= */
section("6 剧情三键");
openGroup("scenes");
const sc1 = rowByKey("scenes:sc1"), sc2 = rowByKey("scenes:sc2");
assert(!!sc1 && !!sc2, "剧情行建出");
btnIn(sc1, "跳过此段剧情").click();
assert(V.fakeA.sc1_skip === true, "跳过剧情 → skipVar 写 true");
btnIn(sc1, "强制完成剧情").click();
assert(V.fakeA.sc1_done === true, "强制完成 → completeVar 写 true");
V.fakeA.sc1p = 9;
btnIn(sc1, "重置剧情进度").click();
assert(V.fakeA.sc1p === 2, "重置进度 → 写 resetValue=2（不是固定 0）");
btnIn(sc2, "跳过此段剧情").click();
assert(/未声明跳过标记变量/.test(statusErr()), "无 skipVar 的剧情拒绝");
btnIn(sc2, "重置剧情进度").click();
assert(/未声明进度变量/.test(statusErr()), "无 progressVar 的剧情拒绝");

/* ================= 7. 数值组（类型分流） ================= */
section("7 数值写入类型分流");
openGroup("values");
assert(!!rowByKey("values:v1"), "数值行 v1 建出");
assert(!!rowByKey("values:v4:A"), "list 型按 option 建子行（values:v4:A）");
const v1row = rowByKey("values:v1");
const inp1 = v1row.querySelector("input.mce-inp");
inp1.value = "+5";
btnIn(v1row, "应用修改").click();
assert(V.fakeA.v1 === 8, "number 型相对语法 +5 → 3+5=8");
inp1.value = "999";
btnIn(v1row, "应用修改").click();
assert(V.fakeA.v1 === 999, "number 型上限不钳制（产品既定口径：仅钳下限）");
const v2row = rowByKey("values:v2");
const boxv2 = v2row.querySelector('input[type="checkbox"]');
boxv2.checked = true;
boxv2.dispatchEvent(new window.Event("change"));
btnIn(v2row, "应用修改").click();
assert(V.fakeA.v2 === true, "boolean 型写 true");
const v3row = rowByKey("values:v3");
v3row.querySelector("input.mce-inp").value = "hello";
btnIn(v3row, "应用修改").click();
assert(V.fakeA.v3 === "hello", "string 型写字符串（不被 Number 通道吞成 NaN）");
const v4rowA = rowByKey("values:v4:A");
const boxA = v4rowA.querySelector('input[type="checkbox"]');
assert(boxA.checked === true, "list 行回显当前成员 A 为勾选");
const v4rowB = rowByKey("values:v4:B");
const boxB = v4rowB.querySelector('input[type="checkbox"]');
boxB.checked = true;
boxB.dispatchEvent(new window.Event("change"));
assert(V.fakeA.v4.indexOf("B") >= 0, "list 勾选 B → 数组加入 B");
boxB.checked = false;
boxB.dispatchEvent(new window.Event("change"));
assert(V.fakeA.v4.indexOf("B") === -1, "list 取消 B → 数组移除 B");
const v5row = rowByKey("values:v5");
btnIn(v5row, "应用修改").click();
assert(/未声明变量/.test(statusErr()), "无 varPath 数值项 → 状态栏拒绝文案");
/* 直接调用导出面（拒绝分支：未注册模组 / 未知键） */
const r1 = api.applyCheatModValue("no-such-mod", "v1", 1);
assert(r1.ok === false && /数值项不存在或该模组未注册/.test(r1.message), "未注册模组 → 拒绝");
const r2 = api.applyCheatModValue("fake-a", "no-such-key", 1);
assert(r2.ok === false, "未知数值键 → 拒绝");
const r3 = api.toggleCheatAbility("fake-a", "no-such-ability", true);
assert(r3.ok === false, "未知能力键 → 拒绝");
const r4 = api.cheatSceneAction("fake-a", "sc1", "weird_op");
assert(r4.ok === false && /未知剧情操作/.test(r4.message), "未知剧情操作 → 拒绝");

/* ================= 8. 搜索过滤 + 折叠工具 + 返回 ================= */
section("8 搜索/折叠/返回");
const search = pane().querySelector("input.mce-search-inp");
assert(!!search, "有数值项时显示搜索框（无值模组不显）");
search.value = "数值1";
search.dispatchEvent(new window.Event("input"));
api.renderModCheatDetail("fake-a");
const filteredRows = pane().querySelectorAll('[data-gkey="values"] [data-mce-key^="values:"]');
assert(filteredRows.length === 1, "搜索「数值1」→ 数值组只剩 1 行（名称/键/路径三向匹配）");
const clearB = Array.prototype.slice.call(pane().querySelectorAll("button")).filter(function (b) { return b.textContent.trim() === "清除"; })[0];
assert(!!clearB, "搜索框带「清除」按钮");
clearB.click();
let valRowsOpen = pane().querySelectorAll('[data-gkey="values"] [data-mce-key^="values:"]');
if (valRowsOpen.length < 4) { openGroup("values"); valRowsOpen = pane().querySelectorAll('[data-gkey="values"] [data-mce-key^="values:"]'); }
assert(valRowsOpen.length >= 4, "清除过滤后数值行全量回来（" + valRowsOpen.length + " ≥ 4）");
pane().querySelector('[data-mce-tool="mods-open"]').click();
assert(pane().querySelector('[data-gkey="values"] .mce-grp-body').getAttribute("data-collapsed") === "0", "全部展开 → 组体展开");
assert(pane().textContent.indexOf("（") >= 0, "展开后组头带计数括号");
pane().querySelector('[data-mce-tool="mods-close"]').click();
assert(pane().querySelector('[data-gkey="values"] .mce-grp-body').getAttribute("data-collapsed") === "1", "全部收起 → 组体收起");
btnIn(pane(), "← 返回模组列表").click();
assert(pane().textContent.indexOf("暂未识别") === -1 && pane().textContent.indexOf("玩家自己") >= 0, "返回列表成功（不残留子页）");

/* ================= 9. 空态与未识别 ================= */
section("9 空态/未识别");
setup.mbCE_modCheats = [];
window.maplebirch = null; /* 适配器 detect 无框架 → 全部跳过 */
const emptyMods = api.getCheatMods().filter(function (m) { return m.modId === "fake-a"; });
assert(emptyMods.length === 0, "清空注册后不再识别 fake-a");
api.renderModCheats();
assert(/⚠ 暂未识别到可控制的第三方模组拓展内容/.test(pane().textContent), "无模组时给空态提示（不是空白页）");
api.renderModCheatDetail("ghost-mod");
assert(/模组未识别（可能已卸载）/.test(pane().textContent), "未识别模组进子页 → 明确提示返回列表");

console.log("\nMODCHEAT UI STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
