/* 言灵页「原帖 52 条」补丁（07i-yanling-quick-data / 07i-yanling-quick）状态机测试
 *
 * 覆盖：数据表 52 条 / 4 选项卡分组与唯一 id、四类写入（布尔 / 置数 / 相对增量 / 时间）、
 *       特殊写入（晒痕数组 / 枷锁承租人 / 怨灵 lust）、宿主缺失拒绝、留痕只记首次、
 *       逐条撤销与整页撤销、选项卡渲染与切换状态。
 * 判据：读存档实际值 + V.mbCE_wrote 留痕 + 返回 message；不 mock 执行器内部。
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
window.isCrossdressing = function () { return false; };

const NAMES = [];
for (let i = 0; i < 30; i++) { NAMES.push("NPC" + i); }
NAMES[29] = "Ivory Wraith";
const NPCS = NAMES.map(n => ({ name: n, lust: 55 }));

const V = {
  player: { virginity: { vaginal: false, penile: false, anal: false, oral: false, handholding: false, kiss: false }, skin: { layers: [{ layers: ["tan"], slots: {}, value: 2 }] } },
  virginityProtected: false,
  orgasmstat: 5, orgasmTimeStat: 7,
  vaginalstat: 4, analstat: 6, vaginalTimeStat: 8, analTimeStat: 9,
  oralstat: 3, oralejacstat: 2, semenswallowedstat: 1,
  handstat: 5, handejacstat: 4,
  feetstat: 1, thighstat: 2, feetejacstat: 3, thighejacstat: 4,
  cheststat: 5, bottomstat: 6, chestejacstat: 7, bottomejacstat: 8,
  faceejacstat: 1, neckejacstat: 2, hairejacstat: 3, tummyejacstat: 4,
  creamstat: 9, sexStats: { creampie: { self: { vagina: 7, anus: 6, mouth: 5 } } },
  masturbationstat: 2, masturbationorgasmstat: 3, masturbationTimeStat: 4,
  milk_drank_stat: 1, milk_produced_stat: 2, nectar_drank_stat: 3, semen_produced_stat: 4, lube_produced_stat: 5,
  vaginaldoublestat: 6, analdoublestat: 7, urinestat: 8, sextoystat: 9, straponstat: 10,
  rapestat: 11, forcedprostitutionstat: 12, beastrapestat: 13, rapeTimeStat: 14,
  pain: 1, tiredness: 2, stress: 3, trauma: 4, control: 5, drunk: 6, drugged: 7, hallucinogen: 8, arousal: 9,
  hypnosis: 10, fallenbuild: 11, englishPlayReadiness: 12, foodstuff: { bottle_of_breast_milk: { amount: 100 } },
  framed: "none", pillory: { tenant: { exists: true, endTime: 1000 } },
  lessonmissed: 3, detention: 4, grace: 5, farm: { irrigation: 2, build_timer: 6 },
  fame: { exhibitionism: 100, impreg: 200, sex: 300, prostitution: 400, rape: 500, bestiality: 600 },
  NPCName: NPCS, NPCNameList: NAMES, timeStamp: 1800, mbCE_wrote: {}
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0 };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };
const timeCalls = [];
global.Time = { date: { timeStamp: V.timeStamp }, set: function (ts) { timeCalls.push(ts); V.timeStamp = ts; Time.date.timeStamp = ts; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 数据表 ================= */
section("1 数据表与分组");
assert(Array.isArray(api.YANLING_QUICK) && api.YANLING_QUICK.length === 52, "数据表 52 条（与原帖去重后一致）");
assert(Array.isArray(api.YANLING_QUICK_TABS) && api.YANLING_QUICK_TABS.length === 4, "4 个选项卡分组");
const ids = api.YANLING_QUICK.map(e => e.id);
assert(new Set(ids).size === 52, "条目 id 唯一（撤销留痕键不冲突）");
const byTab = [0, 1, 2, 3].map(t => api.YANLING_QUICK.filter(e => e.tab === t).length);
assert(JSON.stringify(byTab) === "[20,9,6,17]", "分组数量 20 / 9 / 6 / 17 = 52");
assert(api.YANLING_QUICK.every(e => typeof e.label === "string" && e.label && typeof e.hint === "string"), "每条都有中文标签与说明");
assert(api.YANLING_QUICK.filter(e => e.kind === "time").length === 11, "时间类 11 条（倒退 6 + 前进 5）");
assert(api.YANLING_QUICK.every(e => e.kind === "time" || e.kind === "skin" || e.kind === "pillory" || e.kind === "npc" || (Array.isArray(e.ops) && e.ops.length)), "非特殊条目必须带 ops");
assert(api.YANLING_QUICK.every(e => e.kind !== "time" || typeof e.value === "number"), "时间条目带秒数增量");

/* ================= 2. 选项卡渲染 ================= */
section("2 选项卡渲染");
const host = document.createElement("div");
api.renderYanlingQuick(host);
assert(host.querySelectorAll(".mce-subtabs button").length === 4, "渲染出 4 个选项卡按钮");
assert(host.querySelectorAll(".mce-btn-grid .mce-btn").length === 20, "默认第 1 页显示 20 条（贞洁 6 + 统计 14）");
assert(host.querySelector(".mce-quick-undo .mce-btn"), "撤销按钮存在");
assert(host.querySelectorAll(".mce-subpanel").length === 1, "选项卡内容包进唯一 .mce-subpanel（与外层分组视觉隔离）");
assert(host.querySelectorAll(".mce-subsec").length === 3, "第 1 页按 sec 合并成 3 个小节（贞洁 / 性经历统计 / 事件统计）");
assert(Array.from(host.querySelectorAll(".mce-subtabs button")).map(b => b.getAttribute("data-count")).join(",") === "20,9,6,17", "页签角标 20/9/6/17 由数据表现算（不写死）");
assert(/共 20 项/.test(host.querySelector(".mce-quick-meta").textContent), "页内摘要显示「共 20 项」");
assert(host.querySelectorAll(".mce-btn-grid .mce-btn").length === 20 && host.querySelectorAll(".mce-subsec-n").length === 3, "小节计数徽标与按钮数一致（20 项）");
const tabBtn = host.querySelectorAll(".mce-subtabs button")[1];
tabBtn.click();
assert(api.yanlingQuickTab() === 1, "点击第 2 个选项卡 → 当前页签切到 1");
host.textContent = "";
api.renderYanlingQuick(host);
assert(host.querySelectorAll(".mce-subtabs button.mce-active").length === 1, "重渲染后仍有且只有一个高亮选项卡");
assert(host.querySelectorAll(".mce-btn-grid .mce-btn").length === 9, "第 2 页显示 9 条（身体与状态）");
assert(host.querySelectorAll(".mce-subsec").length === 1, "第 2 页只有 1 个小节（身体与状态）");
api.yanlingQuickTabSet(0);

/* ================= 3. 布尔 / 置数 / 多键 ================= */
section("3 普通写入");
const rv = api.yanlingQuickRun("virg_vaginal");
assert(rv.ok === true && V.player.virginity.vaginal === true, "布尔条目：阴道贞洁 false → true");
assert(V.mbCE_wrote["yanling:q:virg_vaginal"].before.ops[0].before === false, "留痕记录写入前 false");
host.textContent = "";
api.renderYanlingQuick(host);
const dirt = host.querySelector(".mce-subsec-d");
assert(dirt && /已改动 1/.test(dirt.textContent), "写入后所属小节显示「已改动 1」");
assert(host.querySelector(".mce-quick-undo .mce-btn").disabled === false, "有留痕时整页撤销按钮可点（不再只靠 N=0 判断）");
assert(api.yanlingQuickUndo("virg_vaginal").ok === true && V.player.virginity.vaginal === false, "撤销还原 false");
const ro = api.yanlingQuickRun("stat_orgasm");
assert(ro.ok === true && V.orgasmstat === 0 && V.orgasmTimeStat === 0, "多键置数：高潮两项清零");
const undone = api.yanlingQuickUndo("stat_orgasm");
assert(undone.ok === true && V.orgasmstat === 5 && V.orgasmTimeStat === 7, "撤销按逐键 before 还原 5 / 7");
assert(V.mbCE_wrote["yanling:q:stat_orgasm"] === undefined, "撤销后留痕键删除");
assert(api.yanlingQuickUndo("stat_orgasm").ok === false, "无留痕再撤销 → 明确拒绝");

/* ================= 4. 相对增量与首次留痕 ================= */
section("4 相对增量");
const ra = api.yanlingQuickRun("body_play");
assert(ra.ok === true && V.englishPlayReadiness === 112, "戏剧魅影 +100（12 → 112）");
const ra2 = api.yanlingQuickRun("body_play");
assert(ra2.ok === true && V.englishPlayReadiness === 212, "重复点击继续累加（212）");
assert(V.mbCE_wrote["yanling:q:body_play"].before.ops[0].before === 12, "留痕仍保留首次写入前 12");
assert(api.yanlingQuickUndo("body_play").ok === true && V.englishPlayReadiness === 12, "撤销一次回到最初（连点不丢原值）");
const rf = api.yanlingQuickRun("fame_exhibitionism");
assert(rf.ok === true && V.fame.exhibitionism === 2100, "名声 +2000（100 → 2100）");
assert(api.yanlingQuickUndo("fame_exhibitionism").ok === true && V.fame.exhibitionism === 100, "名声撤销回 100");

/* ================= 5. 特殊写入 ================= */
section("5 特殊写入");
const rs = api.yanlingQuickRun("body_tan");
assert(rs.ok === true && V.player.skin.layers.length === 1 && V.player.skin.layers[0].layers.length === 0 && V.player.skin.layers[0].value === 0, "去除晒痕：layers 写空壳");
assert(api.yanlingQuickUndo("body_tan").ok === true && V.player.skin.layers[0].layers[0] === "tan" && V.player.skin.layers[0].value === 2, "撤销还原晒痕数组");
const rp = api.yanlingQuickRun("misc_pillory");
assert(rp.ok === true && V.pillory.tenant.endTime === 1000 + 86400000000, "手枷延长 +1000 天");
assert(api.yanlingQuickUndo("misc_pillory").ok === true && V.pillory.tenant.endTime === 1000, "撤销还原 endTime");
V.pillory.tenant.exists = false;
const rp2 = api.yanlingQuickRun("misc_pillory");
assert(rp2.ok === false && /无人示众/.test(rp2.msg) && V.pillory.tenant.endTime === 1000, "枷锁无人时拒绝且不写入");
V.pillory.tenant.exists = true;
/* 怨灵 lust：按 setup.NPCNameList 名字定位，不依赖硬下标 */
const rn = api.yanlingQuickRun("misc_ivory");
assert(rn.ok === true && V.NPCName[29].lust === -45, "怨灵 lust -100（55 → -45）");
assert(api.yanlingQuickUndo("misc_ivory").ok === true && V.NPCName[29].lust === 55, "撤销还原 lust 55");
const savedNames = V.NPCNameList;
V.NPCNameList = NAMES.filter(n => n !== "Ivory Wraith");
const rn2 = api.yanlingQuickRun("misc_ivory");
assert(rn2.ok === false && /怨灵/.test(rn2.msg), "NPC 名称不存在 → 明确拒绝");
V.NPCNameList = savedNames;

/* ================= 6. 时间 ================= */
section("6 时间倒退 / 前进");
const rt = api.yanlingQuickRun("time_back_15m");
assert(rt.ok === true && V.timeStamp === 900 && timeCalls.length === 1, "倒退一刻：Time.set(1800-900)");
assert(api.yanlingQuickUndo("time_back_15m").ok === true && V.timeStamp === 1800, "撤销把时间戳还原 1800");
const rt2 = api.yanlingQuickRun("time_fwd_1m");
assert(rt2.ok === true && V.timeStamp === 1800 + 2592000, "前进一月 +2592000 秒");
assert(api.yanlingQuickUndo("time_fwd_1m").ok === true && V.timeStamp === 1800, "撤销回到 1800");

/* ================= 7. 宿主缺失与整页撤销 ================= */
section("7 拒绝与整页撤销");
const savedFarm = V.farm;
V.farm = undefined;
const bad = api.yanlingQuickRun("body_irrigation");
assert(bad.ok === false && /宿主不存在/.test(bad.msg), "农场未初始化 → 明确拒绝（不造 undefined 对象）");
V.farm = savedFarm;
assert(api.yanlingQuickRun("no_such_entry").ok === false, "未知条目 id → 拒绝");
api.yanlingQuickTabSet(0);
api.yanlingQuickRun("virg_anal");
api.yanlingQuickRun("stat_urine");
assert(api.yanlingQuickUndoTab(0).ok === true, "整页撤销返回 ok");
assert(V.player.virginity.anal === false && V.urinestat === 8, "整页撤销把本页所有改动还原");
assert(!V.mbCE_wrote["yanling:q:virg_anal"] && !V.mbCE_wrote["yanling:q:stat_urine"], "整页撤销后相关留痕键清空");
assert(api.yanlingQuickUndoTab(1).ok === false, "无改动页整页撤销 → 明确拒绝");

/* ================= 8. 无存档容错 ================= */
section("8 无存档容错");
const savedState = global.State;
global.State = { variables: null };
assert(typeof api.yanlingQuickRun("virg_oral").ok === "boolean", "无存档 → 写入返回结构化结果（不抛）");
assert(typeof api.yanlingQuickUndo("virg_oral").ok === "boolean", "无存档 → 撤销返回结构化结果（不抛）");
global.State = savedState;

console.log("\nYANLING QUICK: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
