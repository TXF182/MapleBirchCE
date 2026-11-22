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
    paw_print: { index: 78, writing: "paw print", type: "object", arrow: 0, special: "bestiality", gender: "n", lewd: 0, degree: 0 }
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
assert(typeof api.vanillaEconTattooSet === "function", "纹身样式直写 API 已导出");

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

/* ================= 5. 玩家纹身 ================= */
section("5 玩家纹身");
V.skin = {
  "left_cheek": { type: "text", pen: "tattoo", writing: "★" },
  "chest": { type: "text", pen: "pen", writing: "hi" },
  "tummy": { type: "text", pen: "tattoo", writing: "☆" },
  "face": { show: 1 }
};
st = api.vanillaEconStats();
assert(st.tattoo.has === true && st.tattoo.count === 2 && st.tattoo.parts.length === 2, "读取纹身 2 处（左脸颊 / 肚子）");
assert(st.tattoo.parts[0].zh === "左脸颊", "部位显示中文，不暴露裸键");

r = api.vanillaEconTattooClear("left_cheek");
assert(r.ok === true && JSON.stringify(V.skin["left_cheek"]) === "{}", "清除单部位 = 原版 bodywriting_clear 的整块重置");
u = api.vanillaEconUndo("tattoo-left_cheek");
assert(u.ok === true && V.skin["left_cheek"].pen === "tattoo", "回退还原该部位纹身");

r = api.vanillaEconTattooMark("chest");
assert(r.ok === true && V.skin.chest.pen === "tattoo", "把已有涂写的部位标记为纹身");
r = api.vanillaEconTattooMark("face");
assert(r.ok === false, "无 writing / 无 type 的部位 → 拒绝标记（原版不会凭空长纹身）");

r = api.vanillaEconTattooClearAll();
assert(r.ok === true && r.cleared === 3 && !V.skin["tummy"].pen && !V.skin.chest.pen, "一键清除全部纹身（含刚标记的胸口）");
assert(V.skin.face.show === 1, "无纹身部位不动");
u = api.vanillaEconUndo("tattoo-all");
assert(u.ok === true && V.skin["tummy"].pen === "tattoo" && V.skin["left_cheek"].pen === "tattoo" && V.skin.face.show === 1, "回退整块还原皮肤对象");

/* ================= 5b. 纹身样式直写（v2.2.0：等价原版 Tattoo Get 的 clone+pen 通道） ================= */
section("5b 纹身样式直写");
V.skin = { "forehead": {}, "left_cheek": { type: "text", pen: "tattoo", writing: "★" } };
V.mbCE_wrote = {};
r = api.vanillaEconTattooSet("forehead", "heart");
assert(r.ok === true && V.skin.forehead.pen === "tattoo" && V.skin.forehead.type === "object" && V.skin.forehead.writing === "heart", "样式写入 = clone 原版设计对象 + pen 置纹身");
assert(V.mbCE_wrote["vcore:tattoo-forehead"].before.kind === "tattoo" && V.mbCE_wrote["vcore:tattoo-forehead"].before.had === true, "留痕 kind 纹身且记录部位原已存在");
assert(JSON.stringify(V.mbCE_wrote["vcore:tattoo-forehead"].before.value) === "{}", "留痕 before 是写入前的空部位对象");
u = api.vanillaEconUndo("tattoo-forehead");
assert(u.ok === true && JSON.stringify(V.skin.forehead) === "{}", "回退还原为空部位");
r = api.vanillaEconTattooSet("left_cheek", "star");
assert(r.ok === true && V.skin.left_cheek.writing === "star" && V.skin.left_cheek.pen === "tattoo", "覆盖已有纹身部位（原版 add_bodywriting 同语义）");
u = api.vanillaEconUndo("tattoo-left_cheek");
assert(u.ok === true && V.skin.left_cheek.writing === "★", "回退还原原纹身");
r = api.vanillaEconTattooSet("breasts", "paw_print");
assert(r.ok === true && V.skin.breasts.special === "bestiality", "原档没有的部位 → 创建（paw_print 带 special 字段随设计对象写入）");
u = api.vanillaEconUndo("tattoo-breasts");
assert(u.ok === true && !("breasts" in V.skin), "回退删除原本不存在的部位");
r = api.vanillaEconTattooSet("forehead", "nope_key");
assert(r.ok === false, "不在原版设计表里的样式 key → 拒绝");
const bw5 = setupObj.bodywriting; delete setupObj.bodywriting;
r = api.vanillaEconTattooSet("forehead", "heart");
setupObj.bodywriting = bw5;
assert(r.ok === false, "宿主 setup 缺 bodywriting 数据 → 拒绝（不凭空造设计对象）");
delete V.skin;
r = api.vanillaEconTattooSet("forehead", "heart");
assert(r.ok === false, "无 skin → 拒绝");

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
V.skin = { "left_cheek": { type: "text", pen: "tattoo", writing: "★" }, "face": { show: 1 } };
V.plots = { garden: [{ plant: "wheat", stage: 2, days: 3 }], farm: [{ plant: "carrot", stage: 1, days: 0 }] };
V.condoms = 3;
V.renttime = 2; V.baileyRefusedToPayTotal = 700; V.rentmoney = 300;
V.daily = { school: { attended: { science: 1, maths: 0, english: 0, history: 0, swimming: 0, housekeeping: 0 } } };
V.schoolLessonsMissed = { science: 0, maths: 1, english: 0, history: 0, swimming: 0, housekeeping: 0 };
const pane = document.createElement("div");
pane.setAttribute("data-pane", "global");
document.body.appendChild(pane);
api.renderVanillaEcon(pane);
const selects = pane.querySelectorAll("select");
assert(selects.length === 4, "四个下拉：科目 / 地块 / 部位 / 样式（共 " + selects.length + " 个）");
const opts = Array.prototype.slice.call(selects[0].querySelectorAll("option"));
assert(opts.length === 6, "科目下拉 6 项");
assert(opts[0].textContent === "科学" && opts[5].textContent === "家政", "科目显示中文名，不是裸键名");
const farmOpts = Array.prototype.slice.call(selects[1].querySelectorAll("option"));
assert(farmOpts[0].textContent === "孤儿院花园" && farmOpts[1].textContent === "亚历克斯农场", "地块显示中文名");
const tattooOpts = Array.prototype.slice.call(selects[2].querySelectorAll("option"));
assert(tattooOpts.some(function (o) { return o.textContent === "左脸颊"; }), "部位下拉含中文部位名");
const styleSel = selects[3];
const styleGroups = Array.prototype.slice.call(styleSel.querySelectorAll("optgroup"));
assert(styleGroups.length === 4, "样式下拉按原版刺青店四组分类（可爱/帅气/神圣/异端）");
const styleOpts = Array.prototype.slice.call(styleSel.querySelectorAll("option"));
assert(styleOpts.length === 9, "样式下拉 9 个图案设计（共 " + styleOpts.length + " 个）");
assert(styleOpts.some(function (o) { return o.textContent === "独角兽" && o.value === "unicorn"; }), "样式显示中文名且 value 为原版设计键");
const txt = pane.textContent;
assert(txt.indexOf("$") === -1, "面板文案不出现任何裸变量名（$ 开头）");
assert(txt.indexOf("经济 · 学业 · 农田 · 消耗品 · 纹身") !== -1, "区块标题存在（全局页 ⑪）");
assert(txt.indexOf("汇总：2 个地点 · 共 2 块 · 已种 2 · 可收获 0") !== -1, "农田有跨地块汇总行");
assert(txt.indexOf("科学 已出勤 · 旷课 0") !== -1, "学校逐科状态行（出勤 / 旷课分开显示）");
assert(selects[2].value === "left_cheek", "部位下拉默认定位到已有纹身部位");
/* 点一次「今日六科全出勤」：按钮文案定位，验证 UI → 数据层 → 存档这条真实链路 */
const btns = Array.prototype.slice.call(pane.querySelectorAll("button"));
const allBtn = btns.filter(function (b) { return b.textContent === "今日六科全出勤"; })[0];
assert(!!allBtn, "找到「今日六科全出勤」按钮");
if (allBtn) {
  allBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.daily.school.attended.maths === 1 && V.daily.school.attended.housekeeping === 1, "点击按钮把六科写出勤（UI 到存档链路打通）");
  assert(!!V.mbCE_wrote["vcore:school"], "点击后落了 vcore 留痕");
}
/* 纹身样式链路：部位默认 left_cheek、样式默认第一组第一项，点「纹上该样式」应把设计对象写进该部位 */
const setBtn = btns.filter(function (b) { return b.textContent === "纹上该样式"; })[0];
assert(!!setBtn, "找到「纹上该样式」按钮");
if (setBtn) {
  setBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.skin["left_cheek"].pen === "tattoo" && V.skin["left_cheek"].type === "object", "点击「纹上该样式」把所选设计写进所选部位（UI 到存档链路打通）");
  assert(!!V.mbCE_wrote["vcore:tattoo-left_cheek"], "样式写入后落 vcore 留痕");
}

console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
process.exit(failures ? 1 : 0);
