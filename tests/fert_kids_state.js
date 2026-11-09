/* FertilityExpansion 孩子页状态测试（branches 门槛 70→80 整改轮）
 *
 * 覆盖对象：04a-15-fert-children.js（孩子列表/存活判定/phase/地点/好感/长大）、
 *           04a-15b-fert-kid-stats.js（养育四项/先天四项写入与钳制）、
 *           04a-14-fert-cheats.js（模组自带作弊等价调用 + cheatsEnabled 临时满足）。
 *
 * 断言口径：模组 API 在场 / 缺失 / 抛异常三种环境下，**玩家看到的结果都必须是明确的一句话**，
 * 不允许静默空转（这是该页最容易出现的假成功）。所有写入都要留痕 V.mbCE_wrote（可回退）。
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
try {
  Object.defineProperty(window.HTMLSelectElement.prototype, "type", {
    get: function () { return "select-one"; },
    set: function () { throw new TypeError("Cannot set property type of #<HTMLSelectElement> which has only a getter"); },
    configurable: true
  });
} catch (e) { console.log("WARN: select.type patch 跳过：" + e.message); }

const V = { player: {}, passage: "Room", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };
window.__mbCE_forceSyncRows = true;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(!!api, "setup.mbStageCE 已挂载");

/* ---------- 构造孩子与养育记录（三种形态 + 三种 phase） ---------- */
function mkRecord(extra) {
  return Object.assign({ species: "human", lifeStage: "child", lifeStageLabel: "幼儿", status: "active",
    affection: 40, innate: {}, training: {} }, extra || {});
}
V.eden = { settings: {}, children: {
  "0": mkRecord({ affection: 40 }),
  "1": mkRecord({ lifeStage: "infant", affection: 12 }),
  "2": mkRecord({})
} };
const childBorn = { name: "Tracey", gender: "f", bornDate: 12, development: { location: "eden_home" }, species: "human" };
const childEgg = { name: "卵A", gender: "m", eggTimer: 3, development: { location: "eden_home" } };
const childUnborn = { name: "胎B", gender: "f", pregnancyId: 0 };
const childRemoved = { name: "已删", edenDeleted: true, bornDate: 5 };
V.childRecords = [childBorn, childEgg, childUnborn, childRemoved];
V.pregnancies = [{ carrier: "cleared" }, { deliveredDate: 30 }, {}];

/* ================= 1. mbCEFertReady / 可用性 ================= */
section("1 mbCEFertReady 三态");
let readyNo = api.mbCEFertReady();
assert(readyNo.ok === false && /未检测到 window.EdenCheats/.test(readyNo.message), "无 EdenCheats → ok:false 并说明原因（" + readyNo.message + "）");
window.EdenCheats = { available: function () { return false; } };
let readyOff = api.mbCEFertReady();
assert(readyOff.ok === true && readyOff.bypass === true, "available() 为假 → ok:true 且 bypass=true（先开作弊页不再是门槛）");
window.EdenCheats.available = function () { return true; };
assert(api.mbCEFertReady().bypass === false, "available() 为真 → bypass=false");
window.EdenCheats.available = function () { throw new Error("boom"); };
assert(api.mbCEFertReady().bypass === true, "available() 抛异常 → 按未开启处理（bypass=true）");

/* ================= 2. cheatsEnabled 临时满足与还原 ================= */
section("2 cheatsEnabled 临时满足");
let seenInside = null;
window.EdenCheats = { available: function () { return false; }, children: function () { seenInside = V.cheatsEnabled; return [["0", childBorn]]; } };
api.mbCEFertChildren();
assert(seenInside === true, "调用期间模组看到 cheatsEnabled=true（" + seenInside + "）");
assert(!("cheatsEnabled" in V), "调用返回后 cheatsEnabled 被删除（不污染存档）");
V.cheatsEnabled = false;
api.mbCEFertChildren();
assert(V.cheatsEnabled === false, "原值 false → 还原为 false（不是删字段）");
V.cheatsEnabled = true;
api.mbCEFertChildren();
assert(V.cheatsEnabled === true, "原值 true → 保持 true");
delete V.cheatsEnabled;

/* ================= 3. 孩子列表三种形态 ================= */
section("3 mbCEFertKidPairs 三种形态");
/* 3a API 返回数组 [ [id, child], ... ] */
window.EdenChildData = {
  entries: function () { return [["0", childBorn], ["1", childEgg]]; },
  get: function (id) { return id === "0" ? childBorn : (id === 1 ? childEgg : null); },
  phaseOf: function (c) { return c === childRemoved ? "removed" : (c && c.bornDate !== undefined ? "born" : (c && c.eggTimer !== undefined ? "egg" : "unborn")); },
  locationOf: function (c) { return c && c.development ? c.development.location : ""; },
  setLocation: function (c, loc) { if (!c || !c.development) { return false; } c.development.location = loc; return true; },
  ageDays: function () { return 42; }
};
assert(api.mbCEFertKidPairs().length === 2, "API 返回数组形态 → 2 条");
/* 3b API 返回 Map-like（非数组，带 forEach） */
window.EdenChildData.entries = function () {
  const m = { forEach: function (cb) { cb(childBorn, "0"); cb(childEgg, "1"); } };
  return m;
};
assert(api.mbCEFertKidPairs().length === 2, "API 返回 forEach 形态 → 2 条");
/* 3c API 返回带 childId 的对象数组 */
window.EdenChildData.entries = function () { return [{ childId: "0", name: "Tracey" }, { childId: "1", name: "卵A" }]; };
assert(api.mbCEFertKidPairs().length === 2, "API 返回对象项形态 → 2 条");
/* 3d API 抛异常 → 回退直读存档（childRecords） */
window.EdenChildData.entries = function () { throw new Error("boom"); };
const pairsFallback = api.mbCEFertKidPairs();
assert(pairsFallback.length === 3, "API 抛异常 → 回退 childRecords，跳过 edenDeleted 条目（实际 " + pairsFallback.length + " 条）");
assert(pairsFallback.filter(function (p) { return p[0] === "3"; }).length === 0, "edenDeleted 的孩子不列出（不留「假存在」）");
/* 3e 无 API → 回退 V.children 对象形态 */
delete window.EdenChildData;
delete V.childRecords;
V.children = { c1: { name: "对象A" }, c2: { name: "对象B", edenDeleted: true } };
const pairsObj = api.mbCEFertKidPairs();
assert(pairsObj.length === 1 && pairsObj[0][0] === "c1", "V.children 对象形态 → 跳过 edenDeleted（" + pairsObj.length + " 条）");
V.childRecords = [childBorn, childEgg, childUnborn, childRemoved];

/* ================= 4. 存活判定与 phase ================= */
section("4 mbCEFertKidAlive / phase");
window.EdenChildData = {
  get: function (id) {
    if (String(id) === "0") { return childBorn; }
    if (String(id) === "3") { return childRemoved; }
    return null;
  },
  phaseOf: function (c) {
    if (!c) { return "missing"; }
    if (c === childRemoved) { return "removed"; }
    if (c.bornDate !== undefined) { return "born"; }
    return (c.eggTimer !== undefined) ? "egg" : "unborn";
  },
  entries: function () { return [["0", childBorn], ["3", childRemoved]]; },
  locationOf: function (c) { return c && c.development ? c.development.location : ""; },
  setLocation: function (c, loc) { if (!c || !c.development) { return false; } c.development.location = loc; return true; },
  ageDays: function () { return 42; }
};
assert(api.mbCEFertKidAlive("0") === childBorn, "get 命中 → 返回孩子对象");
assert(api.mbCEFertKidAlive("3") === null, "phaseOf=removed → 判死返回 null");
assert(api.mbCEFertKidAlive("97") === null, "查不到且枚举无 → null");
window.EdenChildData.get = function () { throw new Error("boom"); };
assert(api.mbCEFertKidAlive("0") === childBorn, "get 抛异常 → 回退枚举仍能找到（不误判为已删除）");
delete window.EdenChildData;
delete V.childRecords; /* 只留 V.children 对象形态，才走 children 兜底通道 */
V.children = { c1: { name: "对象A" } };
assert(api.mbCEFertKidAlive("c1") !== null, "API 缺失时靠枚举兜底能判活");
V.children = {};
assert(api.mbCEFertKidAlive("c1") === null, "枚举也没有 → null");
delete V.children;

/* 统一的模组侧桩：默认按「模组真实语义」判定 phase / 地点 / 年龄，个别用例覆盖单项 */
function installFixture(over) {
  window.EdenChildData = Object.assign({
    entries: function () { return [["0", childBorn], ["1", childEgg], ["2", childUnborn], ["3", childRemoved]]; },
    get: function (id) {
      var k = String(id);
      return k === "0" ? childBorn : k === "1" ? childEgg : k === "2" ? childUnborn : k === "3" ? childRemoved : null;
    },
    phaseOf: function (c) {
      if (!c) { return "missing"; }
      if (c.edenDeleted === true) { return "removed"; }
      if (c.bornDate !== undefined) { return "born"; }
      return (c.eggTimer !== undefined) ? "egg" : "unborn";
    },
    locationOf: function (c) { return (c && c.development && c.development.location) ? String(c.development.location) : ""; },
    setLocation: function (c, loc) {
      if (!c || !c.development || typeof c.development !== "object") { return false; }
      c.development.location = loc;
      return true;
    },
    ageDays: function () { return 42; }
  }, over || {});
  return window.EdenChildData;
}
installFixture();

/* phase 判定：模组 API 缺 phaseOf 时走本文件的本地兜底语义（eden-child-data.js:50-59 对齐） */
section("4b phase 兜底语义");
const childCleared = { name: "清", bornDate: 7, pregnancyId: 0 };
const childDelivered = { name: "蛋", bornDate: null, pregnancyId: 1 };
const childPlain = { name: "胎", bornDate: null, pregnancyId: 2 };
const childOldEgg = { name: "旧蛋", eggTimer: 5 };
V.pregnancies = [{ carrier: "cleared" }, { deliveredDate: 30 }, {}];
installFixture({
  phaseOf: undefined,
  entries: function () {
    return [["0", childBorn], ["1", childEgg], ["2", childUnborn], ["6", childCleared], ["7", childDelivered], ["8", childPlain], ["9", childOldEgg]];
  },
  get: function (id) {
    var k = String(id);
    var map = { "0": childBorn, "1": childEgg, "2": childUnborn, "6": childCleared, "7": childDelivered, "8": childPlain, "9": childOldEgg };
    return map[k] || null;
  }
});
assert(api.mbCEFertKidInfo("0").phase === "born", "有 bornDate → born");
assert(api.mbCEFertKidInfo("1").phase === "egg", "只有 eggTimer（旧存档卵）→ egg");
assert(api.mbCEFertKidInfo("8").phase === "unborn", "孕期未破水 → unborn（" + api.mbCEFertKidInfo("8").phase + "）");
assert(api.mbCEFertKidInfo("6").phase === "removed", "pregnancy.carrier=cleared → removed（" + api.mbCEFertKidInfo("6").phase + "）");
assert(api.mbCEFertKidInfo("7").phase === "egg", "pregnancy.deliveredDate 有限 → egg（" + api.mbCEFertKidInfo("7").phase + "）");
assert(api.mbCEFertKidInfo("9").phase === "egg", "非记录形态带 eggTimer → egg");
assert(api.mbCEFertKidInfo("404").phase === "missing", "查不到 → missing");
installFixture();
V.pregnancies = [{ carrier: "cleared" }, { deliveredDate: 30 }, {}];

/* ================= 5. 概要信息 ================= */
section("5 mbCEFertKidInfo 概要");
const info0 = api.mbCEFertKidInfo("0");
assert(info0.alive === true && info0.name === "Tracey", "存活孩子概要带名字（" + info0.name + "）");
assert(info0.affection === 40, "好感来自 eden.children.0.affection（" + info0.affection + "）");
assert(info0.location === "eden_home", "地点来自 locationOf（" + info0.location + "）");
assert(typeof info0.ageDays === "number", "ageDays 走 EdenChildData.ageDays（" + info0.ageDays + "）");
const info9 = api.mbCEFertKidInfo("9");
assert(info9.alive === false && info9.name === "未命名", "不存在的孩子 alive=false 且名字回落「未命名」");
const infoNoApi = (function () {
  delete window.EdenChildData;
  const r = api.mbCEFertKidInfo("0");
  window.EdenChildData = null;
  delete window.EdenChildData;
  return r;
})();
assert(infoNoApi.ageDays === null || typeof infoNoApi.ageDays === "number", "API 缺失时 ageDays 走记录回退（" + infoNoApi.ageDays + "）");
installFixture(); /* 上一步删了模组 API，这里复原，否则后面的写入全被判「孩子已不存在」 */

/* ================= 6. 好感写入（钳制 + 留痕） ================= */
section("6 mbCEFertKidSetAffection");
assert(api.mbCEFertKidSetAffection("404", 50).ok === false, "没有养育记录 → 拒绝（" + api.mbCEFertKidSetAffection("404", 50).message + "）");
V.eden.children["0"].affection = 40;
const affHigh = api.mbCEFertKidSetAffection("0", 999);
assert(affHigh.ok === true, "超范围值仍写入（v1.9.10 起数值上限不钳制，仅保留下限 0）");
/* 记录现状而不是假装正确：模组侧 affection 语义是 0-100（eden-adult.js:144-149 / :488-490），
   这里写 999 会原样落档 —— 属产品侧待决口径，本测试只把它钉成「已知行为」，防止悄悄改动。 */
assert(V.eden.children["0"].affection === 999, "上限不钳制是既定语义：999 原样写入（实际 " + V.eden.children["0"].affection + "）");
const affNeg = api.mbCEFertKidSetAffection("0", -5);
assert(V.eden.children["0"].affection === 0, "负数钳制到 0（实际 " + V.eden.children["0"].affection + "）");
const affKey = "cheat:fertility-expansion:fert_child_aff_0";
assert(!!V.mbCE_wrote[affKey], "好感写入留痕（" + affKey + "）");
assert(V.mbCE_wrote[affKey].before === 40, "留痕 before 保留首次写入前的原值 40（实际 " + V.mbCE_wrote[affKey].before + "）");

/* ================= 7. 定向送养 ================= */
section("7 mbCEFertKidSetLocation");
assert(api.mbCEFertKidSetLocation("404", "home").ok === false, "孩子不存在 → 拒绝");
assert(api.mbCEFertKidSetLocation("0", "  ").ok === false, "空地点 → 拒绝（" + api.mbCEFertKidSetLocation("0", " ").message + "）");
assert(api.mbCEFertKidSetLocation("2", "home").ok === false, "未出生胎儿 → 拒绝（模组 setLocation 只允许 born/egg）");
const locOk = api.mbCEFertKidSetLocation("0", "home");
assert(locOk.ok === true && childBorn.development.location === "home", "已出生孩子可定向（" + locOk.message + "）");
assert(V.mbCE_wrote["cheat:fertility-expansion:fert_child_loc_0"].via === "setLocation",
  "模组 API 在场时走 setLocation 并如实标注（实际 " + V.mbCE_wrote["cheat:fertility-expansion:fert_child_loc_0"].via + "）");
V.childRecords = [childBorn, childEgg, childUnborn, childRemoved]; /* 第 4 节验 children 兜底时删过，这里复原，让「无 API」用例能靠枚举判活 */
delete window.EdenChildData;
const locNoApi = api.mbCEFertKidSetLocation("0", "eden_contacts");
assert(locNoApi.ok === true && childBorn.development.location === "eden_contacts", "模组 API 缺失 → 兜底直写地点");
assert(V.mbCE_wrote["cheat:fertility-expansion:fert_child_loc_0"].via === "direct", "API 缺失时留痕标注 via=direct");
window.EdenChildData = {
  setLocation: function () { return false; },
  phaseOf: function (c) { return c && c.bornDate !== undefined ? "born" : "unborn"; },
  get: function (id) { return String(id) === "0" ? childBorn : null; },
  entries: function () { return [["0", childBorn]]; },
  locationOf: function (c) { return c.development.location; },
  ageDays: function () { return 42; }
};
const locFallback = api.mbCEFertKidSetLocation("0", "away");
assert(locFallback.ok === true && childBorn.development.location === "away", "模组 setLocation 返回 false → 兜底直写仍成功");
window.EdenChildData.setLocation = function () { throw new Error("boom"); };
assert(api.mbCEFertKidSetLocation("0", "eden_contacts").ok === true, "模组 setLocation 抛异常 → 兜底直写（不把异常抛给玩家）");

/* ================= 8. 随叫随到 ================= */
section("8 mbCEFertKidCallToMe");
V.location = "home";
const callHome = api.mbCEFertKidCallToMe("0");
assert(callHome.ok === true && childBorn.development.location === "home", "玩家在家 → 孩子送到 home");
V.location = "pub";
const callOther = api.mbCEFertKidCallToMe("0");
assert(callOther.ok === true && childBorn.development.location === "eden_home", "玩家在模组不认的地点 → 回退 eden_home");
assert(/模组只认 eden_home\/home/.test(callOther.message), "并说明为什么不是玩家当前地点（" + callOther.message + "）");
delete V.location;

/* ================= 9. 一键长大 ================= */
section("9 mbCEFertKidGrowUp");
installFixture(); /* 第 7 节把 API 桩换成了只认 #0，这里要先复原全量，否则 #1 会被误判「已不存在」 */
assert(api.mbCEFertKidGrowUp("404").ok === false, "孩子不存在 → 拒绝");
assert(api.mbCEFertKidGrowUp("1").ok === false && /只有已出生的孩子/.test(api.mbCEFertKidGrowUp("1").message), "卵/胎儿 → 拒绝（" + api.mbCEFertKidGrowUp("1").message + "）");
window.EdenAge = { syncRecord: function (rec) { rec.lifeStage = "adult"; rec.lifeStageLabel = "成年"; } };
const grow = api.mbCEFertKidGrowUp("0");
assert(grow.ok === true && V.eden.children["0"].forcedAdult === true, "已出生孩子可长大且写入 forcedAdult");
assert(V.eden.children["0"].lifeStage === "adult", "EdenAge.syncRecord 把阶段推到成年");
assert(/要结算未来收益/.test(grow.message), "文案提示还需「立刻成年结算」（" + grow.message + "）");
assert(V.mbCE_wrote["cheat:fertility-expansion:fert_child_adult_0"].via === "EdenAge.syncRecord",
  "留痕标注 via=EdenAge.syncRecord");
window.EdenAge.syncRecord = function () { throw new Error("boom"); };
V.eden.children["1"].forcedAdult = false;
window.EdenChildData.phaseOf = function () { return "born"; };
window.EdenChildData.get = function () { return childEgg; };
const growDirect = api.mbCEFertKidGrowUp("1");
assert(growDirect.ok === true && V.eden.children["1"].lifeStage === "adult", "syncRecord 抛异常 → 兜底把阶段直接置 adult");
assert(V.mbCE_wrote["cheat:fertility-expansion:fert_child_adult_1"].via === "direct", "兜底路径留痕 via=direct");
delete window.EdenAge;
const growSilent = api.mbCEFertKidGrowUp("0", true);
assert(growSilent.ok === true && growSilent.message === "", "silent 模式返回空消息（批量长大时不刷屏）");

/* ================= 10. 养育四项 / 先天四项写入 ================= */
section("10 saveSkills / saveInnate");
installFixture();
V.eden.children["0"].training = { skills: { knowledge: 10, fitness: 20, social: 30, awareness: 40 } };
V.eden.children["0"].innate = { appearance: 50, fitness: 60, intelligence: 70, temperament: 80, personality: "active" };
assert(api.mbCEFertKidSaveSkills("404", { knowledge: 5 }).ok === false, "没有记录 → 拒绝");
assert(api.mbCEFertKidSaveSkills("1", { knowledge: 5 }).ok === false, "未出生 → 拒绝（" + api.mbCEFertKidSaveSkills("1", { knowledge: 5 }).message + "）");
window.EdenChildData.get = function (id) { return String(id) === "0" ? childBorn : null; };
window.EdenChildData.phaseOf = function () { return "born"; };
const skOk = api.mbCEFertKidSaveSkills("0", { knowledge: 88 });
assert(skOk.ok === true && V.eden.children["0"].training.skills.knowledge === 88, "只改填的那一项（" + skOk.message + "）");
assert(V.eden.children["0"].training.skills.fitness === 20, "空串视为不改，其余三项保留原值");
assert(V.mbCE_wrote["cheat:fertility-expansion:fert_child_skills_0"] !== undefined, "养育四项写入留痕");
const skBad = api.mbCEFertKidSaveSkills("0", { knowledge: 101 });
assert(skBad.ok === false && /0–100/.test(skBad.message), "越界值 → 拒绝并说明范围（" + skBad.message + "）");
const skNaN = api.mbCEFertKidSaveSkills("0", { knowledge: "abc" });
assert(skNaN.ok === false && /knowledge/.test(skNaN.message), "非数字 → 拒绝并指出键名（" + skNaN.message + "）");
window.EdenCheats = { available: function () { return true; }, saveSkills: function () { return { ok: true, message: "模组写入" }; } };
const skApi = api.mbCEFertKidSaveSkills("0", { social: 77 });
assert(skApi.ok === true && /EdenCheats.saveSkills/.test(skApi.message), "模组 API 在场 → 走模组写入并标注通道（" + skApi.message + "）");
window.EdenCheats.saveSkills = function () { return { ok: false, message: "模组拒绝" }; };
const skApiFail = api.mbCEFertKidSaveSkills("0", { social: 55 });
assert(skApiFail.ok === true && V.eden.children["0"].training.skills.social === 55, "模组拒绝 → 兜底直写仍生效（不让玩家白点）");
const inOk = api.mbCEFertKidSaveInnate("0", { appearance: 99 });
assert(inOk.ok === true && V.eden.children["0"].innate.appearance === 99, "先天四项可写（" + inOk.message + "）");
assert(V.eden.children["0"].innate.personality === "active", "temperament>50 → personality 跟随 active");
const inQuiet = api.mbCEFertKidSaveInnate("0", { temperament: 20 });
assert(V.eden.children["0"].innate.personality === "quiet", "temperament<=50 → personality 跟随 quiet");
const inFloat = api.mbCEFertKidSaveInnate("0", { temperament: 20.5 });
assert(inFloat.ok === false && /整数/.test(inFloat.message), "先天需整数 → 小数被拒（" + inFloat.message + "）");
window.EdenCheats = { available: function () { return false; }, saveInnate: function () { return { ok: true }; } };
const inApi = api.mbCEFertKidSaveInnate("0", { intelligence: 66 });
assert(inApi.ok === true && /EdenCheats.saveInnate/.test(inApi.message), "模组 saveInnate 成功 → 标注通道");
delete window.EdenCheats;
/* EdenTraining / EdenTraits 同步兜底（记录缺项时先让模组生成默认值） */
window.EdenTraining = { syncRecord: function (rec) { rec.training = { skills: { knowledge: 1, fitness: 2, social: 3, awareness: 4 } }; } };
V.eden.children["0"].training = {};
const skSync = api.mbCEFertKidSaveSkills("0", { knowledge: 9 });
assert(skSync.ok === true && V.eden.children["0"].training.skills.knowledge === 9, "记录缺四项 → 先用 EdenTraining.syncRecord 生成再合并");
window.EdenTraits = { syncRecord: function (rec) { rec.innate = { appearance: 1, fitness: 2, intelligence: 3, temperament: 4 }; } };
V.eden.children["0"].innate = {};
const inSync = api.mbCEFertKidSaveInnate("0", { fitness: 9 });
assert(inSync.ok === true && V.eden.children["0"].innate.fitness === 9, "记录缺四项 → 先用 EdenTraits.syncRecord 生成再合并");

/* ================= 11. 模组自带作弊等价（10 项执行） ================= */
section("11 mbCEFertRun 十个动作");
const runNoApi = (function () {
  delete window.EdenCheats;
  return api.mbCEFertRun("fert_labour", "", null);
})();
assert(runNoApi.ok === false, "无 EdenCheats → 所有动作统一拒绝（" + runNoApi.message + "）");
window.EdenCheats = {
  available: function () { return false; },
  labour: function () { return { ok: true, message: "已推进孕期" }; },
  parasites: function (f) { return { ok: true, message: f ? "已受精" : "已成熟" }; },
  saveInnate: function () { return null; },
  saveSkills: function () { return { ok: true }; },
  reset: function () { return { ok: true, message: "已重置" }; },
  settleAdult: function () { return { ok: true, message: "已结算" }; },
  removeChild: function () { return { ok: true, message: "已删除" }; },
  resetReason: function () { return "怀孕中"; },
  adultReason: function () { return ""; }
};
assert(api.mbCEFertRun("fert_labour", "", null).message === "已推进孕期", "fert_labour → 调模组 labour()");
assert(/已受精/.test(api.mbCEFertRun("fert_parasite_fert", "", null).message), "fert_parasite_fert → parasites(true)");
assert(/已成熟/.test(api.mbCEFertRun("fert_parasite_ripe", "", null).message), "fert_parasite_ripe → parasites(false)");
assert(api.mbCEFertRun("fert_innate", "", null).ok === false, "需要孩子的动作缺 id → 拒绝并提示先选孩子");
assert(api.mbCEFertRun("fert_innate", "0", { a: 1 }).ok === true, "fert_innate → saveInnate（返回 null 时兜底「已执行」）");
assert(api.mbCEFertRun("fert_skills", "0", {}).ok === true, "fert_skills → saveSkills");
assert(/已重置/.test(api.mbCEFertRun("fert_reset", "0", null).message), "fert_reset → reset");
assert(/已结算/.test(api.mbCEFertRun("fert_adult", "0", null).message), "fert_adult → settleAdult");
assert(/已删除/.test(api.mbCEFertRun("fert_remove", "0", null).message), "fert_remove → removeChild");
assert(/怀孕中/.test(api.mbCEFertRun("fert_reset_reason", "0", null).message), "fert_reset_reason → 返回不可重置原因");
assert(/可以成年结算/.test(api.mbCEFertRun("fert_adult_reason", "0", null).message), "fert_adult_reason → 空原因时如实说可以结算");
assert(api.mbCEFertRun("no_such_action", "0", null).ok === false, "未知动作 → 拒绝（" + api.mbCEFertRun("no_such_action", "0", null).message + "）");
window.EdenCheats.labour = function () { throw new Error("模组崩了"); };
const runThrow = api.mbCEFertRun("fert_labour", "", null);
assert(runThrow.ok === false && /模组 API 抛出异常/.test(runThrow.message), "模组 API 抛异常 → 捕获并回报（" + runThrow.message + "）");

/* ================= 11b. 模组 API 返回空值时的兜底（负向断言） =================
   契约：源码里所有动作都写成 `api.xxx() || { ok: true, message: "已执行" }`。
   即模组 API 没回结果（null / undefined / false）时，CE 认为动作已被接受并按
   「已执行」回报，而不是把空值当失败。同理 reason 系列对空原因必须如实回答
   "可以"，不能把"查不到原因"说成"不可"。这两类路径此前没有任何用例走过，
   是 11 节只覆盖"API 正常返回对象"留下的负向缺口。 */
section("11b 模组 API 返回空值 → 兜底");
window.EdenCheats = {
  available: function () { return true; },
  labour: function () { return null; },
  parasites: function () { return undefined; },
  saveInnate: function () { return null; },
  saveSkills: function () { return null; },
  reset: function () { return null; },
  settleAdult: function () { return null; },
  removeChild: function () { return null; },
  resetReason: function () { return null; },
  adultReason: function () { return null; }
};
[["fert_labour", ""], ["fert_parasite_fert", ""], ["fert_parasite_ripe", ""],
  ["fert_innate", "0"], ["fert_skills", "0"], ["fert_reset", "0"],
  ["fert_adult", "0"], ["fert_remove", "0"]].forEach(function (c) {
  const r = api.mbCEFertRun(c[0], c[1], null);
  assert(r.ok === true && r.message === "已执行", c[0] + " 模组返回空值 → 兜底「已执行」（实际：" + r.message + "）");
});
assert(/可以重置/.test(api.mbCEFertRun("fert_reset_reason", "0", null).message),
  "resetReason 返回空 → 如实说可以重置（不把查不到原因说成不可重置）");
assert(/可以成年结算/.test(api.mbCEFertRun("fert_adult_reason", "0", null).message),
  "adultReason 返回空 → 如实说可以成年结算");

/* ================= 12. 孩子页渲染（有孩子 / 无孩子） ================= */
section("12 mbCEFertRenderChildren");
window.EdenChildData = {
  get: function (id) { return String(id) === "0" ? childBorn : null; },
  phaseOf: function () { return "born"; },
  entries: function () { return [["0", childBorn]]; },
  locationOf: function (c) { return c.development.location; },
  setLocation: function () { return true; },
  ageDays: function () { return 30; }
};
window.EdenCheats = { available: function () { return false; } };
const host12 = document.createElement("div");
document.body.appendChild(host12);
api.mbCEFertRenderChildren(host12);
assert(host12.textContent.indexOf("Tracey") !== -1 || host12.textContent.indexOf("#0") !== -1,
  "有孩子时渲染出条目（含名字或编号）");
assert(api.mbCEFertKidInfo("0").alive === true, "渲染后条目仍可读（无副作用）");
V.childRecords = [];
delete window.EdenChildData;
const host12b = document.createElement("div");
document.body.appendChild(host12b);
api.mbCEFertRenderChildren(host12b);
assert(host12b.textContent.length >= 0, "无孩子时渲染不抛异常");
api.mbCEFertRenderChildren(null);
assert(true, "容器为 null 时直接返回（不抛）");

console.log("\nFERT KIDS STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
