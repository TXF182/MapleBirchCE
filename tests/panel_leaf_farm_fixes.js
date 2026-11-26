/* v2.2.8 实机四项 bug 修复测试（TDD 先行）：回退中心中文名 / 特质数值标签 / 枝叶变装立绘与持久化 / 农场 monster_roll 守卫
 *
 * 原版事实（DoL 0.5.12.13 单文件 HTML 实证）：
 *  · 立绘主图 genlayer_clothing_main(93323-99360)：showfn 要求 worn[slot].index > 0 && setup.mainImage !== 0；
 *      srcfn = img/clothes/<slot>/<setup.variable>/<worn.integrity>.png
 *  · 胸部层 genlayer_clothing_breasts(99546-99579)：showfn 要求 breast_img[breast_size] !== null；
 *      srcfn = img/clothes/<slot>/<setup.variable>/<breast_img[size]>.png
 *  · clothesIndex(66895-66905) 匹配 item.variable === it.variable && item.modder === it.modder
 *  · setup.clothes 由 <<clothing_data>>（variables-static，每次加载）整表重建 → 注入项每次加载都会消失
 *  · wardrobeSkip 不含 leaf shirt / leaf skirt（被挡的是 plant top / plant skirt）
 *  · <<farm_actions>>(487233) 首行即 <<farm_gen_all>>(487597) → $farm_work.{horse,pig,dog,cattle}
 *      任一缺失，farm_gen 读 .monster_roll 直接 TypeError（用户截图报错链）
 *  · 四键仅在 farm_work_update 的「新一天」分支建立（486782-486796）
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

function naked(slot) { return { name: "naked", variable: "naked", index: 0, integrity: 0, type: [], state: "", colour: "default", colour_options: [] }; }
const plantTop = {
  name: "plant top", name_cap: "Plant top", variable: "plant", index: 1, mainImage: 0,
  breast_img: { 0: 0, 1: 0, 2: 0, 3: 3, 4: 3, 5: 3, 6: 3 }, integrity: "full", integrity_max: 10,
  type: ["swim", "bellyShow"], state: "midriff", word: "a", plural: 0, colour: "default", colour_options: []
};
const plantSkirt = {
  name: "plant skirt", name_cap: "Plant skirt", variable: "plant", index: 1, mainImage: 0,
  integrity: "full", integrity_max: 10, type: ["swim"], state: "skirt", word: "a", plural: 0,
  colour: "default", colour_options: []
};

const setupObj = {
  clothes: {
    over_upper: [naked("over_upper")],
    over_lower: [naked("over_lower")],
    upper: [naked("upper"), plantTop],
    lower: [naked("lower"), plantSkirt]
  },
  clothes_all_slots: ["over_upper", "over_lower", "upper", "lower"],
  wardrobeSkip: ["plant top", "plant skirt"]
};
global.setup = setupObj;
global.getSetup = function () { return setupObj; };

const V = {
  player: {}, passage: "Yanling", location: "farm",
  worn: {
    over_upper: naked("over_upper"), over_lower: naked("over_lower"),
    upper: naked("upper"), lower: naked("lower")
  },
  wardrobe: { space: 20, over_upper: [], over_lower: [], upper: [], lower: [] },
  wardrobes: {},
  wardrobe_location: "wardrobe",
  farm: { plots: {}, woodland: 0 }, farm_stage: 2,
  farm_work: { horse: {}, pig: {}, dog: {}, cattle: {} }
};
global.V = V;
global.State = { variables: V, passage: "Yanling" };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Yanling"; };
global.localStorage = window.localStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api === "object" && api, "API 已挂载 setup.mbStageCE");

/* ================= A 回退中心条目中文名 ================= */
section("A 回退中心条目中文名");
assert(typeof api.mbCEUndoItemName === "function", "mbCEUndoItemName 已导出");
const nm = function (k, rec) { try { return api.mbCEUndoItemName(k, rec || {}); } catch (e) { return "<ERR:" + e.message + ">"; } };
const cases = [
  ["vcore:crime", "犯罪记录"],
  ["vcore:antique", "古董"],
  ["vcore:title", "头衔"],
  ["yanling:avery_office", "艾弗里"],
  ["yanling:toggle_noCross", "异装"],
  ["yanling:leaf_suit", "枝叶"],
  ["yanling:gwylan_stage", "格威岚"],
  ["yanling:cheat_on", "言灵"],
  ["vcore:avery-keep", "艾弗里"],
  ["vcore:avery-injury", "艾弗里"],
  ["vcore:rent-money", "租金"]
];
cases.forEach(function (c) {
  const got = nm(c[0], { type: "vcore" });
  assert(got.indexOf(c[1]) !== -1 && !/^[a-z][a-z0-9_-]*$/i.test(got), c[0] + " → 「" + got + "」（含「" + c[1] + "」且非裸键）");
});
/* 未知项兜底：不得直接甩裸英文键 */
const unknown = nm("vcore:zzz_unknown_key", { type: "vcore" });
assert(/[\u4e00-\u9fa5]/.test(unknown) && unknown.indexOf("原版") !== -1, "未知 vcore 兜底含中文类别：" + unknown);
const unknownYan = nm("yanling:zzz_unknown_op", {});
assert(/[\u4e00-\u9fa5]/.test(unknownYan) && unknownYan.indexOf("言灵") !== -1, "未知 yanling 兜底含中文类别：" + unknownYan);

/* ================= B 特质数值标签 ================= */
section("B 特质数值标签");
assert(typeof api.traitVarLabel === "function", "traitVarLabel 已导出");
const lb = function (p, op, v) { try { return api.traitVarLabel(p, op, v); } catch (e) { return "<ERR:" + e.message + ">"; }; };
const wings = [["harpy", "gte", 6], ["birdFly", "gte", 1], ["angel", "gte", 6], ["fallenangel", "gte", 2], ["demon", "gte", 6]];
wings.forEach(function (w) {
  const txt = lb(w[0], w[1], w[2]);
  assert(txt.indexOf(w[0]) !== -1 && txt.indexOf("≥") !== -1 && /[\u4e00-\u9fa5]/.test(txt),
    "翅膀条件 " + w[0] + " → 「" + txt + "」");
});
assert(lb("temple_burden", "is", 1).indexOf("=") !== -1, "is 条件用等号：" + lb("temple_burden", "is", 1));
assert(lb("fooBar", "gte", 3).indexOf("fooBar") !== -1, "未收录变量回落原变量名：" + lb("fooBar", "gte", 3));

/* ================= C 枝叶变装 ================= */
section("C 枝叶变装");
assert(typeof api.yanlingLeafRepair === "function", "yanlingLeafRepair 已导出");
let r = api.yanlingLeafSuit();
assert(r.ok === true && /已换上枝叶装/.test(r.msg), "变装成功：" + r.msg);
let up = V.worn.upper, lo = V.worn.lower;
assert(up && up.name === "leaf shirt", "上身 = leaf shirt");
assert(lo && lo.name === "leaf skirt", "下身 = leaf skirt");
assert(up.variable === "plant", "上身 variable 复用 plant（命中 img/clothes/upper/plant/*.png 立绘资源）");
assert(lo.variable === "plant", "下身 variable 复用 plant（命中 img/clothes/lower/plant/*.png）");
assert(up.modder === "MapleBirchCE" && lo.modder === "MapleBirchCE", "modder 唯一标记，避免与植物装 clothesIndex 撞车");
assert(setupObj.clothes.upper[up.index] && setupObj.clothes.upper[up.index].name === "leaf shirt", "上身 index 指向注入项（" + up.index + "）");
assert(setupObj.clothes.lower[lo.index] && setupObj.clothes.lower[lo.index].name === "leaf skirt", "下身 index 指向注入项（" + lo.index + "）");
assert(Array.isArray(V.wardrobe.upper) && V.wardrobe.upper.some(function (i) { return i && i.name === "leaf shirt" && i.mbCE_leafCopy === 1; }), "枝叶上衣副本已进主衣柜");

/* C2 模拟刷新/读档：setup.clothes 整表重建（注入项消失）→ repair 必须自愈 */
section("C2 setup 重建后自愈");
setupObj.clothes.upper = [naked("upper"), JSON.parse(JSON.stringify(plantTop))];
setupObj.clothes.lower = [naked("lower"), JSON.parse(JSON.stringify(plantSkirt))];
const idxBefore = V.worn.upper.index;
let rep = api.yanlingLeafRepair();
assert(rep && rep.ok === true, "repair 返回成功：" + (rep && rep.msg));
assert(setupObj.clothes.upper.some(function (i) { return i && i.name === "leaf shirt"; }), "repair 重新注入 leaf shirt");
assert(V.worn.upper.name === "leaf shirt" && setupObj.clothes.upper[V.worn.upper.index].name === "leaf shirt",
  "repair 修正 worn.index（" + idxBefore + " → " + V.worn.upper.index + "），立绘不再 TypeError");
assert(V.worn.lower.name === "leaf skirt" && setupObj.clothes.lower[V.worn.lower.index].name === "leaf skirt", "repair 同时修正下身 index");

/* C3 模板缺失：降级为裸装而不是留下越界 index */
section("C3 模板缺失降级");
setupObj.clothes.upper = [naked("upper")];
setupObj.clothes.lower = [naked("lower")];
rep = api.yanlingLeafRepair();
assert(rep && rep.ok === false, "无模板时 repair 报告失败：" + (rep && rep.msg));
assert(V.worn.upper.name === "naked" && V.worn.upper.index === 0, "上身退回裸装（index 0，不越界）");
assert(V.worn.lower.name === "naked" && V.worn.lower.index === 0, "下身退回裸装");

/* C4 还原：即使 worn 已被降级也要给出结果并清记录 */
section("C4 还原");
setupObj.clothes.upper = [naked("upper"), JSON.parse(JSON.stringify(plantTop))];
setupObj.clothes.lower = [naked("lower"), JSON.parse(JSON.stringify(plantSkirt))];
let rr = api.yanlingLeafRevert();
assert(rr.ok === true && /已还原/.test(rr.msg), "还原成功：" + rr.msg);
assert(!V.mbCE_yanling.leaf, "变装记录已清除");

/* ================= D 农场守卫 ================= */
section("D 农场 monster_roll 守卫");
assert(typeof api.farmWorkGuard === "function", "farmWorkGuard 已导出");
V.farm_work = {};
let g = api.farmWorkGuard();
assert(g && g.ok === true, "守卫执行成功：" + (g && g.msg));
["horse", "pig", "dog", "cattle"].forEach(function (k) {
  const o = V.farm_work[k];
  assert(o && typeof o === "object" && o.monster_roll === false && o.monster === false,
    "补齐 " + k + ".monster_roll / .monster");
  assert(typeof o.gender === "string" && typeof o.gender_plural === "string" && typeof o.genitals === "string",
    "补齐 " + k + " 的 gender/gender_plural/genitals");
});
/* 幂等：已有 true 不被覆盖 */
V.farm_work.horse.monster_roll = true;
V.farm_work.horse.monster = true;
api.farmWorkGuard();
assert(V.farm_work.horse.monster_roll === true && V.farm_work.horse.monster === true, "已有值不被覆盖（幂等）");
/* 未进农场线：不凭空创建（注意 getV() 优先读词法作用域里的 V，测试里换 global.V 无效，故在同一对象上删键验证） */
delete V.farm_work;
let g2 = api.farmWorkGuard();
assert(g2 && g2.ok === true && g2.created === 0, "未进农场线时不创建（created=" + g2.created + "）");
assert(!V.farm_work, "未进农场线保持 undefined（不影响 farmStateReady 判定）");
V.farm_work = { horse: {}, pig: {} };
g2 = api.farmWorkGuard();
assert(g2.created >= 4 && V.farm_work.dog && V.farm_work.cattle, "Farm Work 段落内补齐缺失键（created=" + g2.created + "）");

console.log("\n==== 结果：" + passes + " PASS / " + failures + " FAIL ====");
process.exit(failures > 0 ? 1 : 0);
