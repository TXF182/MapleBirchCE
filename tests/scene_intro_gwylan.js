/* v2.2.8 剧情补录 + 格威岚阶段线测试（TDD 先行）
 *
 * 覆盖：
 *  A 角色初见 7 条（Sam/Doren/Sydney/Wren/Whitney/Alex/Kylar）：注册、入口段、段落清单、角色归组、计入「原版剧情」区；
 *  B Eden/BlackWolf startPassage 修正（ForestHuntDebug → 真初见段），只改错位值、不动其它键；
 *  C 格威岚 13 条支线直达注册；
 *  D 格威岚 5 阶段：好感公式（total/love/pct）、按阶段补 gwylanTalked 到阈值、缺 yearning 拒绝、写入 stage-1、
 *    播放目标为 Gwylan Talk Shop。
 * 原版事实：Degrees of Lewdity 0.5.12.13，$gwylan.stage 唯一写入点 Gwylan Talk Shop；
 * gwylanLovePercent = ceil(love/(totalSets*2)*100)，love = 已解锁森林特装 + gwylanTalked 中森林特装数（wary>1 时扣 2*wary）。
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

const V = {
  player: {}, passage: "Room",
  NPCName: [{ nam: "Gwylan", init: 1, trust: 10, love: 20, dom: 0, lust: 0, trauma: 0, rage: 0, purity: 0, corruption: 0 }],
  characters: { npc: { Gwylan: { state: "active" } } },
  gwylan: { stage: 0, wary: 0, progress: 0 },
  gwylanTalked: [], gwylanSeen: [], specialClothes: []
};
global.V = V;
global.State = { variables: V, passage: "Room" };
/* 森林特装 3 套（A/B/C），另 1 套非森林（D）——用于验证 shop 过滤 */
const setupObj = {
  foodstuff: {}, bodyparts: [],
  specialClothesSets: {
    "forest-a": { shop: ["forest"] },
    "forest-b": { shop: ["forest", "town"] },
    "forest-c": { shop: ["forest"] },
    "town-d": { shop: ["town"] }
  }
};
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

let played = [];
window.Engine = { play: function (n) { played.push(String(n)); } };
window.wikifier = function () {};

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.introScenes === "function" && typeof api.gwylanStagePrepare === "function"
  && typeof api.sceneRoleOf === "function" && typeof api.applySceneStartFixes === "function", "API 已导出（introScenes/gwylanStagePrepare/sceneRoleOf/applySceneStartFixes）");

/* ================= A 角色初见 ================= */
section("A 角色初见 7 条");
const intros = api.introScenes();
assert(Array.isArray(intros) && intros.length === 7, "初见条目共 7 条");
const wantStart = {
  SamIntro: "Sam Park Intro", DorenIntro: "Doren Intro", SydneyIntro: "Sydney Library Intro",
  WrenIntro: "Smuggler Pub Wren Intro", WhitneyIntro: "Street Alex Cafe Whitney Intro",
  AlexIntro: "Street Alex Cafe React Intro", KylarIntro: "Kylar Intro Intervene"
};
Object.keys(wantStart).forEach(function (k) {
  const it = intros.filter(function (x) { return x.key === k; })[0];
  assert(!!it, "已注册 " + k);
  assert(it && it.startPassage === wantStart[k], k + " 入口段 = " + wantStart[k]);
  assert(it && Array.isArray(it.passages) && it.passages.length >= 2 && it.passages[0] === wantStart[k], k + " 段落清单以入口段开头且 ≥2 段");
});
assert(api.isVanillaSceneKey("SamIntro") === true && api.isVanillaSceneKey("GwylanShopHat") === false, "初见键计入原版区、格威岚支线不计入");
assert(api.vanillaSceneKeyCount() === 110, "原版名单长度仍为 110（未混入补录键）");
assert(api.sceneRoleOf("SamIntro") === "山姆 Sam", "SamIntro → 山姆 Sam");
assert(api.sceneRoleOf("DorenIntro") === "多伦 Doren", "DorenIntro → 多伦 Doren");
assert(api.sceneRoleOf("SydneyIntro") === "悉尼 Sydney", "SydneyIntro → 悉尼 Sydney");
assert(api.sceneRoleOf("WrenIntro") === "雷恩 Wren", "WrenIntro → 雷恩 Wren");
assert(api.sceneRoleOf("WhitneyIntro") === "惠特尼 Whitney", "WhitneyIntro → 惠特尼 Whitney");
assert(api.sceneRoleOf("AlexIntro") === "艾利克斯 Alex", "AlexIntro → 艾利克斯 Alex");
assert(api.sceneRoleOf("KylarIntro") === "凯拉尔 Kylar", "KylarIntro → 凯拉尔 Kylar");
assert(api.sceneRoleOf("GwylanShopHat") === "格威岚 Gwylan", "格威岚支线 → 格威岚 Gwylan");

/* ================= B Eden/BlackWolf 修正 ================= */
section("B Eden/BlackWolf startPassage 修正");
const fixes = api.sceneStartFixes();
assert(fixes.EdenIntro === "Forest Hunter Intro" && fixes.BlackWolfIntro === "Forest Wolf Cave Intro", "修正表：Eden→Forest Hunter Intro / BlackWolf→Forest Wolf Cave Intro");
const defs = {
  EdenIntro: { name: "Eden Intro", startPassage: "ForestHuntDebug", passages: ["ForestHuntDebug", "Forest Hunter Intro"] },
  BlackWolfIntro: { name: "Black Wolf Intro", startPassage: "ForestHuntDebug", passages: ["ForestHuntDebug", "Forest Wolf Cave Intro"] },
  KylarStalkingReversal: { name: "凯拉尔", startPassage: "Kylar Stalking Reversal Hide Confront" }
};
const applied = api.applySceneStartFixes(defs);
assert(applied.EdenIntro.startPassage === "Forest Hunter Intro", "EdenIntro 已修正为 Forest Hunter Intro");
assert(applied.BlackWolfIntro.startPassage === "Forest Wolf Cave Intro", "BlackWolfIntro 已修正为 Forest Wolf Cave Intro");
assert(applied.KylarStalkingReversal.startPassage === "Kylar Stalking Reversal Hide Confront", "非错位键不受影响");
const defs2 = { EdenIntro: { startPassage: "Forest Hunter Molestation" } };
api.applySceneStartFixes(defs2);
assert(defs2.EdenIntro.startPassage === "Forest Hunter Molestation", "已是正确值时不改写（只修 ForestHuntDebug 错位）");

/* ================= C 格威岚支线 13 条 ================= */
section("C 格威岚支线 13 条");
const sides = api.gwylanSideScenes();
assert(Array.isArray(sides) && sides.length === 13, "支线共 13 条");
const sideMap = {
  GwylanRitual: "Gwylan Ritual Select", GwylanHypnosis: "Gwylan Hypnosis Start",
  GwylanShopNowhere: "Forest Shop Nowhere", GwylanShopReunion: "Forest Shop Reunion",
  GwylanShopThief: "Forest Shop Thief", GwylanShopTrauma: "Forest Shop Trauma",
  GwylanShopIntruder: "Forest Shop Intruder", GwylanShopCollar: "Forest Shop Familiar Collar",
  GwylanShopHat: "Forest Shop Hat", GwylanShopLights: "Forest Shop Lights",
  GwylanShopSnoop: "Forest Shop Snoop", GwylanYearning: "Gwylan Yearning Start",
  GwylanPubSulking: "Gwylan Pub Sulking"
};
Object.keys(sideMap).forEach(function (k) {
  const it = sides.filter(function (x) { return x.key === k; })[0];
  assert(!!it && it.startPassage === sideMap[k], k + " → " + sideMap[k]);
  assert(!!it && Array.isArray(it.passages) && it.passages.length >= 2, k + " 段落清单 ≥2 段");
});

/* ================= D 格威岚 5 阶段 ================= */
section("D 格威岚 5 阶段");
const rows = api.gwylanStageRows();
assert(rows.length === 5 && rows[0].pct === 10 && rows[4].pct === 100, "5 档阈值 10/25/50/75/100");

V.specialClothes = [{ name: "forest-a", unlocked: 2 }, { name: "forest-b", unlocked: 2 }, { name: "forest-c", unlocked: 1 }];
V.gwylanTalked = []; V.gwylanSeen = []; V.gwylan = { stage: 0, wary: 0, progress: 3 };
let info = api.gwylanLoveInfo();
assert(info.total === 3, "森林特装总数 3（town-d 不计）");
assert(info.love === 2 && info.pct === 34, "已解锁 2 套 → love 2 / pct ceil(2/6*100)=34");

let pr = api.gwylanStagePrepare(1);
assert(pr.ok === false && /越过/.test(pr.message), "P34% 时回放阶段 1 → 拒绝（已解锁特装降不下来，原版会播阶段 2）");

V.specialClothes = []; V.gwylanTalked = []; V.gwylan = { stage: 0, wary: 0, progress: 3 };
pr = api.gwylanStagePrepare(1);
assert(pr.ok === true && V.gwylan.stage === 0 && V.gwylanTalked.length === 1, "空好感 → 阶段 1 补 1 项、stage=0");
played = [];
pr = api.gwylanStagePlay(1);
assert(pr.ok === true && played.length === 1 && played[0] === "Gwylan Talk Shop", "阶段 1 播放目标为 Gwylan Talk Shop");
api.gwylanStageRestoreTick("Forest Shop Entrance");
assert(V.gwylanTalked.length === 0 && V.gwylan.stage === 0 && !V.mbCE_gwylanStageRestore, "离开商店 → 还原 talked/stage 并清还原标记");
api.gwylanStageRestoreTick("Gwylan Talk Shop");
assert(V.gwylanTalked.length === 0 && !V.mbCE_gwylanStageRestore, "还原后再进 Talk Shop 不会二次还原（标记已清）");

V.specialClothes = []; V.gwylanTalked = []; V.gwylan = { stage: 0, wary: 0, progress: 3 };
pr = api.gwylanStagePrepare(2);
assert(pr.ok === true, "阶段 2 准备成功");
assert(V.gwylan.stage === 1, "准备阶段 2 → 写 stage=1（进店播完自动升 2）");
assert(V.gwylanTalked.length === 2, "补 2 个森林套装进 gwylanTalked（目标 love=ceil(0.25*6)=2）");
assert(V.gwylanTalked.every(function (x) { return ["forest-a", "forest-b", "forest-c"].indexOf(x) >= 0; }), "补入的都是森林特装");
info = api.gwylanLoveInfo();
assert(info.pct >= 25 && info.pct < 50, "补后 pct 落回阶段 2 区间 [25,50)");
api.gwylanStageRestoreTick("Forest Shop Entrance");
assert(V.gwylanTalked.length === 0 && V.gwylan.stage === 0, "阶段 2 播完同样还原");

V.specialClothes = []; V.gwylanTalked = []; V.gwylan = { stage: 0, wary: 0, progress: 3 };
pr = api.gwylanStagePrepare(5);
assert(pr.ok === false && /yearning/.test(pr.message), "阶段 5 缺 yearning → 拒绝并提示前置");
assert(V.gwylan.stage === 0 && V.gwylanTalked.length === 0, "拒绝时零写入");
V.gwylanSeen = ["yearning"];
V.specialClothes = [{ name: "forest-a", unlocked: 2 }, { name: "forest-b", unlocked: 2 }, { name: "forest-c", unlocked: 2 }];
pr = api.gwylanStagePrepare(5);
assert(pr.ok === true, "补 yearning + 满特装后阶段 5 准备成功");
assert(V.gwylan.stage === 4 && V.gwylanTalked.length === 3, "阶段 5：stage=4，unlocked 3 + talked 3 = love 6（满分）");
played = [];
pr = api.gwylanStagePlay(5);
assert(pr.ok === true && played.length === 1 && played[0] === "Gwylan Talk Shop", "播放目标为 Gwylan Talk Shop");

V.gwylan = { stage: 0, wary: 3, progress: 3 };
pr = api.gwylanStagePrepare(3);
assert(pr.ok === false && /wary|警惕/.test(pr.message), "wary>1 → 拒绝（先和解），避免对白错档");

console.log("\n" + (failures ? "FAILURES=" + failures : "ALL PASS") + " passes=" + passes);
process.exit(failures ? 1 : 0);
