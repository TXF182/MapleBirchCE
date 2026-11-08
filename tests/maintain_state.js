/* 庄园自动维护状态测试（branches 门槛 70→80 整改轮 · 第二批）
 *
 * 覆盖对象：03b-global-maint.js —— 维护写入的幂等 + 首次 before 留痕（含 5 类拒绝）、单键/全量回退、
 * 六个维护动作各自的「前条件门控」（艾弗里关系、塔卫+技能、技能 1000、火坑升级、房间计数）、
 * 每日全自动调度的 localStorage 状态机（开启记录当日、同日不重复、异日执行、无 Time 兜底）。
 *
 * 判据说明：维护动作是「能改就改、不能改就不动」的语义，所以每个用例都同时断言
 * **返回结构**（r.xxx 计数/布尔）与 **存档实际值**，避免只信返回体。
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
const setupObj = { foodstuff: {
  steak: { category: "dish", prop_folder: "food", recipe: { difficulty: 1 } },
  souffle: { category: "dish", prop_folder: "food", recipe: { difficulty: 5 } },
  linguine: { category: "dish", prop_folder: "food", recipe: { difficulty: 3 } },
  truffle_dish: { category: "dish", prop_folder: "food", recipe: { difficulty: 9 } },
  drink_wine: { category: "drink", prop_folder: "drink", recipe: { difficulty: 2 } },
  no_recipe: { category: "dish", prop_folder: "food" }
} };
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
assert(typeof api.maintWrite === "function" && typeof api.mcMaintainTemple === "function", "维护写入/维护动作 API 已导出");

/* ================= 1. 维护写入：幂等 / 留痕 / 五类拒绝 ================= */
section("1 mbCEMaintWrite 写入口径");
V.soap = 4;
assert(api.maintWrite("soap", 10) === true && V.soap === 10, "数值键不满 → 写入成功");
assert(V.mbCE_wrote["maint:soap"].before === 4 && V.mbCE_wrote["maint:soap"].after === 10, "留痕记录 before=4 / after=10");
V.soap = 10;
assert(api.maintWrite("soap", 10) === false, "值已到位 → 幂等跳过（不写档不留痕）");
V.soap = 10;
api.maintWrite("soap", 100);
assert(V.mbCE_wrote["maint:soap"].before === 4, "二次写入保留「首次 before」=4（不是 10）");
assert(api.maintWrite("", 1) === false, "空路径 → 拒绝");
assert(api.maintWrite("nope.deep", 1) === false, "宿主缺失 → 拒绝（维护不补壳）");
V.objHost = "not-object";
assert(api.maintWrite("objHost.x", 1) === false, "宿主非对象 → 拒绝");
V.txtHost = { leaf: "string" };
assert(api.maintWrite("txtHost.leaf", 1) === false, "叶子非数值 → 拒绝（只维护数值键）");
V.txtHost.leaf = "1";
assert(V.txtHost.leaf === "1", "非数值叶子未被强转写入");

/* ================= 2. 单键 / 全量回退 ================= */
section("2 回退口径");
V.farm = { aggro: 3, beasts: { horses: 5 } };
V.mbCE_wrote = {};
api.maintWrite("farm.aggro", 0);
assert(V.farm.aggro === 0, "嵌套路径写入生效");
assert(api.maintUndo("farm.aggro").ok === true && V.farm.aggro === 3, "单键回退还原 before=3");
assert(!V.mbCE_wrote["maint:farm.aggro"], "回退后删除该留痕项");
assert(api.maintUndo("farm.aggro").ok === false, "无留痕 → 拒绝回退并给原因");
V.mbCE_wrote["maint:ghost.key"] = { type: "maint", path: "ghost.key", before: 1 };
assert(api.maintUndo("ghost.key").ok === false, "宿主已消失 → 拒绝回退（不误建对象）");
V.undefBefore = {};
V.mbCE_wrote["maint:undefBefore.created"] = { type: "maint", path: "undefBefore.created", before: undefined };
assert(api.maintUndo("undefBefore.created").ok === true && V.undefBefore.created === undefined, "before=undefined → 回退时删除字段（不写 undefined）");
V.mbCE_wrote = {};
assert(api.maintUndoAll().ok === false && api.maintUndoAll().n === 0, "无任何维护留痕 → 全量回退返回 n=0");
V.a1 = 1; V.a2 = 2;
api.maintWrite("a1", 9); api.maintWrite("a2", 8);
V.mbCE_wrote["cheat:x"] = { type: "cheat" };
const rAll = api.maintUndoAll();
assert(rAll.ok === true && rAll.n === 2, "全量回退只处理 maint: 前缀（2 项），不碰别的类型");
assert(V.a1 === 1 && V.a2 === 2, "全量回退后两个键都还原");
assert(!!V.mbCE_wrote["cheat:x"], "非维护留痕保留（分类型回退不越界）");
/* 混合场景：一个能回退、一个宿主已没了 → n 只数成功的 */
V.good = 1; V.mbCE_wrote = {};
api.maintWrite("good", 5);
V.mbCE_wrote["maint:dead.path"] = { type: "maint", path: "dead.path", before: 0 };
const rMix = api.maintUndoAll();
assert(rMix.n === 1 && rMix.ok === true, "混合场景：只计成功项（n=1），不因坏项整体判失败");

/* ================= 3. 艾弗里投喂 ================= */
section("3 mcFeedAvery 分支");
V.mbCE_wrote = {};
V.avery_fate = "alive";
assert(api.mcFeedAvery().skipped === true, "关系未确立（非 saved/ascended）→ 跳过，且不计 dinner_missed");
V.avery_fate = "saved";
V.avery_mansion = { food: "steak", rage: { dinner_missed: 0 } };
V.foodstuff = { steak: { amount: 3 } };
const f1 = api.mcFeedAvery();
assert(f1.fed === "steak" && V.foodstuff.steak.amount === 2, "点了牛排 → 扣 1 份牛排");
V.avery_mansion.food = "souffle";
V.foodstuff = { souffle: { amount: 2 } };
assert(api.mcFeedAvery().fed === "souffle", "牛排没了 → 退舒芙蕾");
V.avery_mansion.food = "linguine";
V.foodstuff = { linguine: { amount: 2 } };
assert(api.mcFeedAvery().fed === "linguine", "再没 → 退扁意面");
V.avery_mansion.food = "unknown_dish";
V.foodstuff = { steak: { amount: 0 }, souffle: { amount: 0 }, linguine: { amount: 0 }, truffle_dish: { amount: 1 }, drink_wine: { amount: 1 } };
const f4 = api.mcFeedAvery();
assert(f4.fed === "truffle_dish" && V.foodstuff.truffle_dish.amount === 0, "前三种为 0 → 按难度降序取最高的 dish（跳过 drink 与无 recipe）");
V.foodstuff = {};
V.avery_mansion.rage = { dinner_missed: 0 };
const f5 = api.mcFeedAvery();
assert(f5.missed === true && V.avery_mansion.rage.dinner_missed === 1, "厨房全空 → 记 dinner_missed +1");
V.avery_mansion = null;
V.foodstuff = { steak: { amount: 1 } };
assert(api.mcFeedAvery().fed === "steak", "庄园对象缺失（man 为 null）→ 落到牛排兜底不炸");

/* ================= 4. 农场维护门控 ================= */
section("4 mcMaintainFarm 门控");
V.mbCE_wrote = {};
V.farmerCanSell = false;
V.farm = { tower_guard: true, tower_guard_skill: 500, beasts: { horses: 5, pigs: 5, cattle: 5, dogs: 5 }, aggro: 3, stock: {} };
const m1 = api.mcMaintainFarm();
assert(m1.beasts === 0 && V.farm.beasts.horses === 5 && V.farm.aggro === 3, "塔卫技能 <1000 → 一只不锁、agro 不清（门控生效）");
V.farm.tower_guard_skill = 1000; V.farm_stage = 5;
const m2 = api.mcMaintainFarm();
assert(m2.beasts === 4 && V.farm.beasts.horses === 30 && V.farm.beasts.dogs === 30, "塔卫在岗且技能≥1000 → 四畜锁 30");
assert(m2.aggro === true && V.farm.aggro === 0, "farm_stage>=5 且守卫在岗 → agro 清零");
assert(!!V.mbCE_wrote["maint:farm.beasts.horses"], "锁畜写入走维护留痕（可回退）");
V.farm_stage = 3; V.farm.aggro = 5; V.mbCE_wrote = {};
const m3 = api.mcMaintainFarm();
assert(m3.aggro === false && V.farm.aggro === 5, "farm_stage<5 → 不清 agro（未到有袭击的阶段）");
delete V.farm.beasts.dogs;
const m4 = api.mcMaintainFarm();
assert(m4.beasts === 3, "缺 beasts.dogs 键 → 只锁存在的 3 种（不补壳）");
V.farm.stock = { truffles: 3, eggs: 0, milk: 2, cream: 1 };
const m5 = api.mcMaintainFarm();
assert(m5.harvested === 3 && V.farm.stock.truffles === 0, "库存有值的都清 0（含 cream）；已有 0 的不计");
V.farm.stock = { truffles: 2 };
V.farmerCanSell = true;
const m6 = api.mcMaintainFarm();
assert(m6.harvested === 0 && V.farm.stock.truffles === 2, "farmerCanSell=true（农夫自售）→ 不清库存，避免截断模组经济");
V.farmerCanSell = false;
V.farm = null;
const m7 = api.mcMaintainFarm();
assert(m7.beasts === 0 && m7.harvested === 0, "无 $farm → 全零空转，不抛错");

/* ================= 5. 神殿 / 伊甸 / 补给 / 打扫 ================= */
section("5 其余四个维护面");
V.mbCE_wrote = {};
V.housekeeping = 999; V.tending = 1000; V.temple_quarters = 1; V.temple_garden = 1;
const t1 = api.mcMaintainTemple();
assert(t1.quarters === false && t1.garden === true, "技能门控逐个生效（housekeeping 999 不动 / tending 1000 满值）");
assert(V.temple_quarters === 1 && V.temple_garden === 100, "只写达标的那个键");
V.housekeeping = 1000;
assert(api.mcMaintainTemple().quarters === true, "housekeeping 达标后神殿房间也写 100");
delete V.temple_quarters;
assert(api.mcMaintainTemple().quarters === false, "键不存在（模组未初始化）→ 不补壳");
V.edengarden = 1; V.edenshrooms = 1; V.edenspring = 1;
const e1 = api.mcMaintainEden();
assert(e1.locked === 3 && V.edengarden === 4 && V.edenshrooms === 4 && V.edenspring === 4, "伊甸三处无条件锁 4");
delete V.edenspring;
assert(api.mcMaintainEden().locked === 2, "缺一个键 → 只锁存在的两处");
V.soap = 3; V.salve = 20;
V.bird = { upgrades: { firepit: 3 }, materials: { wood: 2 } };
const s1 = api.mcRestockSupplies();
assert(s1.soap === true && V.soap === 10, "肥皂不足 10 → 补到 10");
assert(s1.salve === false && V.salve === 20, "药膏已够 20 → 不压低高值");
assert(s1.wood === true && V.bird.materials.wood === 10, "火坑≥3 且木材不足 → 补 10");
V.bird.upgrades.firepit = 2; V.bird.materials.wood = 1;
const s2 = api.mcRestockSupplies();
assert(s2.wood === false && V.bird.materials.wood === 1, "火坑 <3 → 不补木材（未解锁鹰塔贮材）");
V.avery_fate = "saved";
V.avery_mansion = { pool: 5, kitchen: 3, garden: 2, days_absent: 4 };
const c1 = api.mcCleanMansion();
assert(c1.rooms === 3 && V.avery_mansion.pool === 0 && V.avery_mansion.kitchen === 0, "只清存在的 3 间房（study/garage 缺失不补壳）");
assert(c1.days === true && V.avery_mansion.days_absent === 0, "days_absent 一并归零");
V.avery_fate = "unknown";
assert(api.mcCleanMansion().skipped === true, "关系未确立 → 跳过打扫");

/* ================= 6. 每日全自动调度状态机 ================= */
section("6 mcAuto* 状态机");
localStorage.clear();
const st0 = api.mcAutoState();
assert(st0.lastDay === -1 && Object.keys(st0.items).length === 0, "无记录 → items 空、lastDay=-1");
localStorage.setItem("mbCE_auto", "not-json{");
assert(api.mcAutoState().lastDay === -1, "localStorage 里是坏 JSON → 兜底默认值不抛");
localStorage.setItem("mbCE_auto", JSON.stringify({ items: { feed: true }, lastDay: 3 }));
assert(api.mcAutoIsOn("feed") === true && api.mcAutoIsOn("farm") === false, "开关读数按 items 项判断");
global.Time = { days: 3 };
const st1 = api.mcAutoSet("farm", true);
assert(!!st1.items.farm && st1.lastDay === 3, "开启时把 lastDay 钉成当日（当日不再重复执行）");
const st2 = api.mcAutoSet("farm", false);
assert(!st2.items.farm, "关闭时删除该项");
delete global.Time;
api.mcAutoSet("temple", true);
assert(api.mcAutoState().lastDay === 3, "无 Time → lastDay 保持原值（不写 -1 覆盖）");
assert(api.mcAutoRunOnce("nope").error.indexOf("未知维护项") >= 0, "未知维护项 → 明确报错文本");
/* tick：无开启项 → 空转 */
localStorage.clear();
assert(api.mcAutoMaintainTick().ran === 0, "没有任何开关 → ran=0 空转");
/* tick：有开关但同日 → 不重复执行 */
V.avery_fate = "saved"; V.avery_mansion = { pool: 1 };
V.mbCE_wrote = {};
localStorage.setItem("mbCE_auto", JSON.stringify({ items: { clean: true }, lastDay: 7 }));
global.Time = { days: 7 };
const tickSame = api.mcAutoMaintainTick();
assert(tickSame.ran === 0 && V.avery_mansion.pool === 1, "同日（days===lastDay）→ 不执行，房间未打扫");
/* tick：异日 → 执行并刷新 lastDay */
global.Time = { days: 8 };
const tickNext = api.mcAutoMaintainTick();
assert(tickNext.ran === 1 && tickNext.day === 8, "异日 → 执行 1 项");
assert(V.avery_mansion.pool === 0, "自动打扫真实生效（pool 归零）");
assert(api.mcAutoState().lastDay === 8, "执行后 lastDay 刷新为 8");
/* tick：无 Time / days<0 → 不执行 */
delete global.Time;
V.avery_mansion.pool = 9;
const tickNoTime = api.mcAutoMaintainTick();
assert(tickNoTime.ran === 0 && V.avery_mansion.pool === 9, "无 Time → ran=0 不执行（不会误判成异日）");
/* tick：单项抛错不影响其它项（run 内部各函数自带 try，这里断言计数正常） */
global.Time = { days: 9 };
localStorage.setItem("mbCE_auto", JSON.stringify({ items: { clean: true, restock: true }, lastDay: 8 }));
V.soap = 1;
const tickTwo = api.mcAutoMaintainTick();
assert(tickTwo.ran === 2, "两项开启 → 计数为 2（逐项独立执行）");
assert(V.soap === 10, "自动补给真实生效");

console.log("\nMAINTAIN STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
