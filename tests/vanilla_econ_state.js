/* 原版经济/学业/农田/消耗品/纹身 直写通道测试（v2.1.14 新增轮）
 *
 * 覆盖对象：07m-vanilla-econ-data.js + 07m-vanilla-econ-view.js
 * 判据口径：每个写入用例同时断言「返回体」与「存档实际值」，并核对 vcore 留痕的 before 与回退还原；
 * 反向用例锁死空地块 / 无 plant / 宿主缺失 / 非数字输入四类拒绝，防作弊把原版状态机写坏。
 * 原版事实来源（DoL 0.5.12.13 源码实证）：
 *   - passRentTick(): V.renttime--；<0 && %7===0 才把 rentmoney+(babyRent||0) 累进 baileyRefusedToPayTotal
 *   - daily.school.attended.{science,maths,english,history,swimming,housekeeping} + schoolLessonsMissed 同名键
 *   - tendingDay(): plot.days+=1；days >= growth_days*(stage+1)/5 才 stage+=1；stage 5 = 可收获
 *   - $condoms 顶层键（侧栏 Total condoms）；V.skin[part].pen === "tattoo" 才是纹身
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " ==="); }

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
const setupObj = {
  foodstuff: { wheat: { tending: { growth_days: 10 } }, carrot: { tending: { growth_days: 6 } } },
  bodyparts: ["chest", "face", "feet", "leftarm", "rightarm", "neck", "thigh", "tummy"],
  /* 原版 setup.bodywriting 结构镜像（DoL 0.5.12.13 单文件 HTML 实证：{index,writing,type,arrow,special,gender,lewd,degree}）；
     index 值为镜像占位，CE 写入只 clone 整个对象不读 index，故不作断言对象 */
  bodywriting: {
    unicorn: { index: 70, writing: "unicorn", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    heart: { index: 71, writing: "heart", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    flower: { index: 72, writing: "flower", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    butterfly: { index: 73, writing: "butterfly", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    star: { index: 74, writing: "star", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    skull: { index: 75, writing: "skull", type: "object", arrow: 0, special: "none", gender: "m", lewd: 0, degree: 0 },
    flame: { index: 76, writing: "flame", type: "object", arrow: 0, special: "none", gender: "m", lewd: 0, degree: 0 },
    cross: { index: 77, writing: "cross", type: "object", arrow: 0, special: "none", gender: "n", lewd: 0, degree: 0 },
    paw_print: { index: 78, writing: "paw print", type: "object", arrow: 0, special: "bestiality", gender: "n", lewd: 0, degree: 0 },
    /* v2.2.9 涂鸦：原版菜单部分样本 + 非菜单特殊样本（真实全量 206 条由宿主提供，CE 只内嵌菜单键表） */
    slut: { index: 90, writing: "Slut", writ_cn: "骚货", type: "text", arrow: 0, special: "none", gender: "n", lewd: 1, degree: 0 },
    submissive: { index: 120, writing: "Submissive", writ_cn: "顺从", type: "text", arrow: 0, special: "none", gender: "n", lewd: 0, degree: 0 },
    stupid_little_fucking_sextease_bitch_fucker: { index: 178, writing: "Stupid little fucking sextease bitch fucker", writ_cn: "操他妈的只会色诱的白痴脑瘫小婊子", type: "text", arrow: 0, special: "Sydney", gender: "n", lewd: 1, degree: 0 },
    book_criminal_heart: { index: 160, writing: "Book Criminal <3", writ_cn: "书犯 <3", type: "text", arrow: 0, special: "Sydney", gender: "n", lewd: 0, degree: 0 },
    cattle_brand: { index: 100, writing: "cattle brand", writ_cn: "牲口烙印", type: "object", arrow: 0, special: "cattle", gender: "n", lewd: 0, degree: 0 },
    bitch: { index: 20, writing: "Bitch", writ_cn: "婊子", type: "text", arrow: 0, special: "none", gender: "n", lewd: 1, degree: 0 }
  }
};
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.vanillaEconStats === "function" && typeof api.vanillaEconRipen === "function", "经济/农田直写 API 已导出");
assert(typeof api.vanillaEconBwWrite === "function" && typeof api.vanillaEconBwSpecial === "function", "涂鸦直写与分组 API 已导出");

/* ================= 1. 房租与欠租 ================= */
section("1 房租与欠租");
V.renttime = 3;
V.rentmoney = 500;
V.babyRent = 40;
V.baileyRefusedToPayTotal = 1080;
V.baileyRefusedToPayTotalStat = 5000;
let st = api.vanillaEconStats();
assert(st.rent.has === true && st.rent.renttime === 3, "读取租期倒计时 = 3 天");
assert(st.rent.debt === 1080 && st.rent.rentmoney === 500 && st.rent.babyRent === 40, "读取欠租 1080 / 周租 500 / 婴儿附加 40");

let r = api.vanillaEconRentDays(0);
assert(r.ok === true && V.renttime === 0, "写成 0 天：今天刚见过 Bailey，7 天内不会累计欠租");
assert(V.mbCE_wrote["vcore:rent-days"].before.renttime === 3, "留痕 before = 3（首次写入前）");
r = api.vanillaEconRentDays("-2");
assert(r.ok === false, "负数天数 → 拒绝（原版 renttime 负值是欠租计时，不允许手填负数）");
r = api.vanillaEconRentDays("abc");
assert(r.ok === false && V.renttime === 0, "非数字 → 拒绝且不写档");

r = api.vanillaEconClearDebt();
assert(r.ok === true && V.baileyRefusedToPayTotal === 0, "清空欠租 = 0");
assert(V.baileyRefusedToPayTotalStat === 5000, "累计统计 baileyRefusedToPayTotalStat 不被误清（只清实际欠款）");
assert(V.mbCE_wrote["vcore:rent-debt"].before.debt === 1080, "欠租留痕 before = 1080");
let u = api.vanillaEconUndo("rent-debt");
assert(u.ok === true && V.baileyRefusedToPayTotal === 1080, "回退欠租还原 1080");
u = api.vanillaEconUndo("rent-days");
assert(u.ok === true && V.renttime === 3, "回退租期还原 3 天");

/* ================= 2. 学校出勤 ================= */
section("2 学校出勤");
V.daily = { school: { attended: { science: 1, maths: 0, english: 1, history: 0, swimming: 0, housekeeping: 0 } } };
V.schoolLessonsMissed = { science: 2, maths: 5, english: 1, history: 4, swimming: 3, housekeeping: 2 };
st = api.vanillaEconStats();
assert(st.school.has === true && st.school.attendedCount === 2, "读取今日已出勤 2/6");
assert(st.school.missedTotal === 17, "读取旷课累计 17");

r = api.vanillaEconAttend("maths", 1);
assert(r.ok === true && V.daily.school.attended.maths === 1, "数学设为已出勤");
r = api.vanillaEconAttend("science", 0);
assert(r.ok === true && V.daily.school.attended.science === 0, "科学设为缺席");
r = api.vanillaEconAttend("nope", 1);
assert(r.ok === false, "未知科目 → 拒绝（不接受裸键名之外的拼写）");

r = api.vanillaEconAttendAll(1);
assert(r.ok === true && Object.keys(V.daily.school.attended).every(function (k) { return V.daily.school.attended[k] === 1; }), "今日全部出勤 = 6 科全 1");
r = api.vanillaEconMissedClear();
assert(r.ok === true && V.schoolLessonsMissed.maths === 0 && V.schoolLessonsMissed.housekeeping === 0, "旷课次数全清零");
u = api.vanillaEconUndo("school");
assert(u.ok === true && V.daily.school.attended.maths === 0 && V.schoolLessonsMissed.maths === 5, "回退还原出勤与旷课原值");

/* ================= 3. 农场地块 ================= */
section("3 农场地块");
V.plots = {
  garden: [
    { plant: "wheat", stage: 2, days: 3, water: 1, bed: "dirt" },
    { stage: 0, days: 0, water: 0, bed: "dirt" },
    { plant: "ghostcrop", stage: 1, days: 1, water: 1, bed: "dirt" }
  ],
  farm: [{ plant: "carrot", stage: 1, days: 0, water: 1, bed: "water" }]
};
st = api.vanillaEconStats();
assert(st.farm.locations.length === 2 && st.farm.locations[0].key === "garden", "枚举两块地（garden / farm）");
assert(st.farm.locations[0].total === 3 && st.farm.locations[0].planted === 2, "花园 3 块 / 已种 2 块");
assert(st.farm.locations[0].ripe === 0, "花园当前可收获 0 块");

r = api.vanillaEconRipen("garden");
assert(r.ok === true && r.ripened === 1, "花园催熟只写有 plant 且 setup 有该作物的 1 块");
assert(V.plots.garden[0].stage === 5 && V.plots.garden[0].days === 0, "小麦地块 → stage 5 / days 0（可收获）");
assert(V.plots.garden[1].stage === 0, "空格子不动（stage 0 写 5 会让 tendingDay 读 setup.foodstuff[undefined] 崩）");
assert(V.plots.garden[2].stage === 1, "未知作物 ghostcrop 不动（setup.foodstuff 无该键，写 5 会崩）");
u = api.vanillaEconUndo("farm-garden");
assert(u.ok === true && V.plots.garden[0].stage === 2 && V.plots.garden[0].days === 3, "回退还原花园地块原值");

r = api.vanillaEconRipenAll();
assert(r.ok === true && V.plots.farm[0].stage === 5, "全部地块催熟：农场胡萝卜 → 5");
r = api.vanillaEconRipen("nowhere");
assert(r.ok === false, "不存在的地块 → 拒绝");

/* ================= 4. 避孕套 ================= */
section("4 避孕套");
V.condoms = 2;
st = api.vanillaEconStats();
assert(st.condoms.has === true && st.condoms.count === 2, "读取避孕套 2 个");
r = api.vanillaEconCondoms(20);
assert(r.ok === true && V.condoms === 20, "写入 20 个");
assert(V.mbCE_wrote["vcore:condoms"].before.condoms === 2, "留痕 before = 2");
r = api.vanillaEconCondomsAdd(10);
assert(r.ok === true && V.condoms === 30, "+10 → 30（相对写法）");
r = api.vanillaEconCondoms(-5);
assert(r.ok === false && V.condoms === 30, "负数 → 拒绝");
u = api.vanillaEconUndo("condoms");
assert(u.ok === true && V.condoms === 2, "回退还原 2 个");

/* ================= 5. 玩家皮肤清除（原版 bodywriting_clear 语义） ================= */
section("5 玩家皮肤清除");
V.skin = {
  "left_cheek": { type: "text", pen: "tattoo", writing: "★" },
  "chest": { type: "text", pen: "pen", writing: "hi" },
  "tummy": { type: "text", pen: "tattoo", writing: "☆" },
  "face": { show: 1 }
};
st = api.vanillaEconStats();
assert(st.tattoo.has === true && st.tattoo.count === 2 && st.tattoo.parts.length === 2, "只读统计仍能读出 2 处纹身（左脸颊 / 肚子）");
assert(st.tattoo.parts[0].zh === "左脸颊", "部位显示中文，不暴露裸键");

r = api.vanillaEconTattooClear("left_cheek");
assert(r.ok === true && JSON.stringify(V.skin["left_cheek"]) === "{}", "清除单部位 = 原版 bodywriting_clear 的整块重置");
u = api.vanillaEconUndo("bodywriting-left_cheek");
assert(u.ok === true && V.skin["left_cheek"].pen === "tattoo", "回退还原该部位原内容");

r = api.vanillaEconBwClear("chest");
assert(r.ok === true && JSON.stringify(V.skin.chest) === "{}", "涂鸦（pen）同样可清除，不再限定纹身");
r = api.vanillaEconBwClear("face");
assert(r.ok === false, "没有 pen 的部位 → 拒绝清除");

r = api.vanillaEconBwClearAll();
assert(r.ok === true && r.cleared === 2 && !V.skin["tummy"].pen, "一键清除全部涂鸦与纹身（2 处）");
assert(V.skin.face.show === 1, "无涂写部位不动");
u = api.vanillaEconUndo("bodywriting-all");
assert(u.ok === true && V.skin["tummy"].pen === "tattoo" && V.skin["left_cheek"].pen === "tattoo", "回退整块还原皮肤对象");

/* ================= 5b 身体涂鸦（原版分类菜单 + 特殊涂鸦） ================= */
section("5b 身体涂鸦");
const bwMenu = api.vanillaEconBwMenu();
assert(Array.isArray(bwMenu) && bwMenu.length === 9, "涂鸦菜单 9 个分类（通用/淫乱/卖淫/暴露/异种/受虐/顺从/怀孕/恋爱对象）");
assert(bwMenu.reduce(function (n, g) { return n + g.items.length; }, 0) === 118, "菜单条目共 118 条（原版 _bodyWritingOptions 静态全量）");
assert(bwMenu[0].zh === "通用" && bwMenu[8].zh === "恋爱对象", "分类中文名按原版菜单顺序");
assert(bwMenu.filter(function (g) { return g.zh === "顺从"; }).length === 1, "补上截图缺失的「顺从」组（原版 submissive≥1200 才出现）");
assert(bwMenu[1].items.some(function (it) { return it.key === "slut" && it.zh === "骚货"; }), "分类条目显示中文（汉化 writ_cn）且 value 为原版键");

const spGroups = api.vanillaEconBwSpecial();
const spNames = spGroups.map(function (g) { return g.grp; });
assert(spGroups.length === 5, "特殊涂鸦按来源/角色分子组（镜像 5 组：悉尼 / 牧场 / 兽交 / 纹样 / 杂项）");
assert(api.vanillaEconBwSpecialOrder().length === 14, "特殊分组顺序表覆盖 14 类来源（含 rape / criminal / pregnancy 等）");
assert(spNames.indexOf("Sydney") >= 0 && spNames.indexOf("cattle") >= 0 && spNames.indexOf("bestiality") >= 0, "悉尼 / 雷米牧场 / 兽交 三组存在");
const sydGroup = spGroups.filter(function (g) { return g.grp === "Sydney"; })[0];
assert(!!sydGroup && sydGroup.items.some(function (it) { return it.key === "book_criminal_heart"; }), "悉尼特殊组收录非菜单条目");
assert(!!sydGroup && !sydGroup.items.some(function (it) { return it.key === api.vanillaEconBwSpecialKey(); }), "十六字真言从悉尼组剔除（单独按钮）");
assert(api.vanillaEconBwSpecialKey() === "stupid_little_fucking_sextease_bitch_fucker", "十六字真言键固定为原版 Sydney 专属条目");
const patGroup = spGroups.filter(function (g) { return g.grp === "pattern"; })[0];
const miscGroup = spGroups.filter(function (g) { return g.grp === "misc"; })[0];
assert(!!patGroup && patGroup.items.some(function (it) { return it.key === "unicorn"; }), "图形类涂鸦归入纹样符号组");
assert(!!miscGroup && miscGroup.items.some(function (it) { return it.key === "bitch"; }), "无来源文本涂鸦归入杂项组");

V.skin = { "forehead": {}, "chest": { type: "text", pen: "pen", writing: "hi" } };
V.mbCE_wrote = {};
r = api.vanillaEconBwWrite("forehead", "slut");
assert(r.ok === true && V.skin.forehead.pen === "pen" && V.skin.forehead.writing === "Slut", "写入涂鸦 = clone 原版条目 + pen 置 pen（原版 add_bodywriting 同语义）");
assert(V.skin.forehead.writ_cn === "骚货", "clone 保留汉化字段 writ_cn（面板显示中文）");
assert(V.mbCE_wrote["vcore:bodywriting-forehead"].before.kind === "bodywriting" && V.mbCE_wrote["vcore:bodywriting-forehead"].before.had === true, "留痕 kind=bodywriting 且记录原部位已存在");
u = api.vanillaEconUndo("bodywriting-forehead");
assert(u.ok === true && JSON.stringify(V.skin.forehead) === "{}", "回退还原为空部位");
r = api.vanillaEconBwWrite("forehead", api.vanillaEconBwSpecialKey());
assert(r.ok === true && V.skin.forehead.writing === "Stupid little fucking sextease bitch fucker" && V.skin.forehead.writ_cn === "操他妈的只会色诱的白痴脑瘫小婊子", "十六字真言写入当前部位（中文译名同步）");
r = api.vanillaEconBwWrite("forehead", "nope_key");
assert(r.ok === false, "不在宿主 setup.bodywriting 的键 → 拒绝");
const bwHost = setupObj.bodywriting; delete setupObj.bodywriting;
r = api.vanillaEconBwWrite("forehead", "slut");
setupObj.bodywriting = bwHost;
assert(r.ok === false, "宿主缺 bodywriting 数据 → 拒绝（不凭空造对象）");
r = api.vanillaEconBwWrite("breasts", "slut");
assert(r.ok === true && V.skin.breasts.pen === "pen", "原档没有的部位 → 创建");
u = api.vanillaEconUndo("bodywriting-breasts");
assert(u.ok === true && !("breasts" in V.skin), "回退删除原本不存在的部位");
r = api.vanillaEconBwClear("chest");
assert(r.ok === true && JSON.stringify(V.skin.chest) === "{}", "清除该部位（bodywriting_clear 语义）");
u = api.vanillaEconUndo("bodywriting-chest");
assert(u.ok === true && V.skin.chest.writing === "hi", "回退还原清除前内容");

/* ================= 6. 宿主缺失拒绝 ================= */
section("6 宿主缺失拒绝");
delete V.skin;
st = api.vanillaEconStats();
assert(st.tattoo.has === false, "无 $skin → 统计标 has=false");
r = api.vanillaEconTattooClearAll();
assert(r.ok === false, "无 $skin → 清除被拒绝");
delete V.plots;
r = api.vanillaEconRipenAll();
assert(r.ok === false, "无 $plots → 催熟被拒绝");
delete V.condoms;
r = api.vanillaEconCondoms(5);
assert(r.ok === true && V.condoms === 5, "避孕套键缺失时允许创建（原版顶层计数键，无父级对象）");

/* ================= 7. 面板渲染（玩家实际路径：全局页 ⑪） ================= */
section("7 面板渲染");
V.skin = { "forehead": {}, "face": { show: 1 } };
V.plots = { garden: [{ plant: "wheat", stage: 2, days: 3 }], farm: [{ plant: "carrot", stage: 1, days: 0 }] };
V.condoms = 3;
V.renttime = 2; V.baileyRefusedToPayTotal = 700; V.rentmoney = 300;
V.daily = { school: { attended: { science: 1, maths: 0, english: 0, history: 0, swimming: 0, housekeeping: 0 } } };
V.schoolLessonsMissed = { science: 0, maths: 1, english: 0, history: 0, swimming: 0, housekeeping: 0 };
V.options = { bodywritingImages: 1 };
const pane = document.createElement("div");
pane.setAttribute("data-pane", "global");
document.body.appendChild(pane);
function paneBtns() { return Array.prototype.slice.call(pane.querySelectorAll("button")); }
function paneOpts() { return Array.prototype.slice.call(pane.querySelectorAll("option")); }
function clickBtn(text) {
  const b = paneBtns().filter(function (x) { return x.textContent === text; })[0];
  if (b) { b.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
  return !!b;
}
api.renderVanillaEcon(pane);
assert(pane.textContent.indexOf("经济 · 学业 · 农田 · 消耗品 · 身体涂鸦") !== -1, "区块标题改为身体涂鸦");
assert(pane.textContent.indexOf("$") === -1, "面板文案不出现任何裸变量名（$ 开头）");
assert(pane.textContent.indexOf("纹上该样式") === -1, "旧纹身样式按钮已移除");
const catNames = ["通用", "淫乱", "卖淫", "暴露", "异种", "受虐", "顺从", "怀孕", "恋爱对象"];
assert(paneBtns().filter(function (b) { return catNames.indexOf(b.textContent) >= 0; }).length === 9, "九个分类按钮（原版截图 8 个 + 顺从）");
assert(clickBtn("特殊涂鸦"), "特殊涂鸦入口按钮存在");
assert(paneBtns().some(function (b) { return b.textContent === "悉尼十六字真言"; }), "十六字真言单独按钮存在");
const imgChk = pane.querySelector('input[type="checkbox"]');
assert(!!imgChk && imgChk.parentNode.textContent.indexOf("启用身体涂鸦图像") >= 0, "启用身体涂鸦图像勾选存在");
assert(paneOpts().filter(function (o) { return o.textContent === "科学"; }).length === 1, "科目下拉仍为中文");
assert(paneOpts().filter(function (o) { return o.textContent === "孤儿院花园"; }).length === 1, "地块下拉仍为中文");
assert(paneOpts().some(function (o) { return o.textContent === "额头" && o.value === "forehead"; }), "部位下拉显示中文");

/* 点「淫乱」→ 下拉出现「骚货」→ 点「写入涂鸦」→ 存档写入（UI 到存档真实链路） */
assert(clickBtn("淫乱"), "点击「淫乱」分类");
assert(paneOpts().some(function (o) { return o.textContent === "骚货" && o.value === "slut"; }), "分类下拉出现「骚货」");
assert(clickBtn("写入涂鸦"), "找到「写入涂鸦」按钮");
assert(V.skin.forehead.pen === "pen" && V.skin.forehead.writing === "Slut", "点击后把所选涂鸦写进所选部位");
assert(!!V.mbCE_wrote["vcore:bodywriting-forehead"], "涂鸦写入后落 vcore 留痕");

/* 特殊涂鸦：子组按钮 + 组内条目 */
assert(clickBtn("特殊涂鸦"), "再次点击「特殊涂鸦」展开子组");
assert(paneBtns().some(function (b) { return b.textContent === "悉尼"; }), "特殊涂鸦出现「悉尼」子组按钮");
assert(clickBtn("悉尼"), "点击「悉尼」子组");
assert(paneOpts().some(function (o) { return o.textContent === "书犯 <3"; }), "悉尼子组下拉出现「书犯 <3」");

/* 十六字真言独立按钮：直接写当前部位 */
assert(clickBtn("悉尼十六字真言"), "点击「悉尼十六字真言」");
assert(V.skin.forehead.writing === "Stupid little fucking sextease bitch fucker", "十六字真言写入当前部位");

/* 图像开关 */
if (imgChk) {
  imgChk.checked = false;
  imgChk.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert(V.options.bodywritingImages === 0, "取消勾选写入 bodywritingImages=0");
}

console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
process.exit(failures ? 1 : 0);
