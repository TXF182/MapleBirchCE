/* 战斗终结 + 扩展转化 + 格威岚花园兜底（03c-global-combat / 03c-global-combat2）真实路径测试
 * （branches 70→80 整改轮 · 第十二批）
 * 这三块此前在 tests/ 里零专项覆盖：COMBAT_ACTIONS 8 个动作的写入语义、未知 key 与执行异常两条拒绝、
 * listExtTransforms 的三级来源与兜底、completeExtTransform 的回读判定，以及格威岚花园兜底状态。
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

const V = { player: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room", temporary: {} };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 八个战斗动作的写入语义 ================= */
section("1 COMBAT_ACTIONS 逐项");
assert(api.COMBAT_ACTIONS.length === 8, "战斗动作共 8 项");
V.pain = 20;
let r = api.mcCombatAction("suicide");
assert(r.ok === true && V.pain === 1000, "自我了断 → V.pain=1000");
V.pain = 900; V.arousal = 50; V.stress = 40;
r = api.mcCombatAction("hero");
assert(r.ok === true && V.pain === 10 && V.arousal === 0 && V.stress === 0, "英雄不屈 → pain=10 且清空性奋/压力");
V.enemyarousal = 600;
api.mcCombatAction("extend");
assert(V.enemyarousal === 100, "延长战斗 → 敌方性奋 -500");
delete V.enemyarousal;
api.mcCombatAction("extend");
assert(V.enemyarousal === -500, "敌方性奋缺失（undefined）时按 0 计，不产生 NaN");
V.enemyarousalmax = 800;
api.mcCombatAction("calm");
assert(V.enemyarousal === 800, "息事宁人 → 敌方性奋=上限");
delete V.enemyarousalmax;
api.mcCombatAction("calm");
assert(V.enemyarousal === 0, "上限缺失时退化为 0（不是 NaN）");
V.enemyhealth = 300;
api.mcCombatAction("knockout");
assert(V.enemyhealth === 0, "一拳打飞 → 敌方生命=0");
V.struggle = { number: 4, done: 0 };
api.mcCombatAction("struggle");
assert(V.struggle.done === 5, "结束挣扎 → done = number+1");
delete V.struggle;
r = api.mcCombatAction("struggle");
assert(r.ok === true && !("struggle" in V), "无挣扎对象时不报错也不造键");
V.tentacles = { active: 1 };
api.mcCombatAction("tentacle");
assert(V.tentacles.active === 0, "结束触手 → active=0");
delete V.tentacles;
api.mcCombatAction("tentacle");
assert(!("tentacles" in V), "无触手对象时同样不造键");
V.timer = 3; V.vorestage = 2; V.swimdistance = 100;
api.mcCombatAction("cluster");
assert(V.timer === 0 && V.vorestage === 0 && V.swimdistance === 0, "结束集群 → 吞食计时/阶段/距离清零");
r = api.mcCombatAction("nope");
assert(r.ok === false && /未知战斗操作：nope/.test(r.message), "未知 key → 明确拒绝并回显 key");

/* 执行异常：临时把某个动作改成抛错，验证 catch 分支（随后还原） */
const act0 = api.COMBAT_ACTIONS[0];
const origRun = act0.run;
act0.run = function () { throw new Error("boom"); };
r = api.mcCombatAction("suicide");
assert(r.ok === false && /执行失败/.test(r.message) && /boom/.test(r.message), "动作抛错 → 「执行失败：…」不崩面板");
act0.run = origRun;

/* ================= 2. 扩展转化列举 ================= */
section("2 listExtTransforms");
delete setup.myTFSet;
assert(api.listExtTransforms().length === 0, "setup.myTFSet 不是函数 → 直接返回空（不报错）");
setup.myTFSet = function () {};
setup.transformations = [{ key: "Wolf" }, null, {}];
V.transformationParts = { Wolf: 1, rabbit: 2, mermaid: "3", cat: 3, ghost: NaN };
assert(api.listExtTransforms().length === 0, "已注册到 setup.transformations 的键被排除（大小写不敏感），非数字与 NaN 也排除");
V.transformationParts = { Wolf: 1, cat: 3 };
assert(api.listExtTransforms().length === 0, "只有已注册键时为空（不走 rabbit/mermaid 兜底）");
V.transformationParts = {};
V.rabbit = 1; V.mermaid = 2;
const l1 = api.listExtTransforms();
assert(l1.indexOf("rabbit") !== -1 && l1.indexOf("mermaid") !== -1, "transformationParts 为空 → 兜底扫 rabbit/mermaid 存档变量");
V.rabbit = NaN;
const l2 = api.listExtTransforms();
assert(l2.indexOf("rabbit") === -1 && l2.indexOf("mermaid") !== -1, "兜底也会跳过 NaN 值");
V.transformationParts = { mermaid: 1 };
delete V.rabbit;
const l3 = api.listExtTransforms();
assert(l3.length === 1 && l3[0] === "mermaid", "transformationParts 有键时按它列举（不重复兜底）");

/* ================= 3. 完成扩展转化 ================= */
section("3 completeExtTransform");
setup.myTFSet = function (name, stage) { V[name] = stage; };
assert(api.completeExtTransform("mermaid") === true && V.mermaid === 3, "myTFSet 写入 3 → 回读一致返回 true");
setup.myTFSet = function (name) { V[name] = 2; };
assert(api.completeExtTransform("mermaid") === false, "回读不等于 3（模组没真写）→ 返回 false");
setup.myTFSet = function () { throw new Error("no api"); };
assert(api.completeExtTransform("mermaid") === false, "myTFSet 抛错 → 返回 false 不崩面板");
delete setup.myTFSet;
assert(api.completeExtTransform("mermaid") === false, "框架缺 myTFSet → 返回 false");

/* ================= 4. 格威岚花园兜底 ================= */
section("4 ensureGwylanSceneState / isGwylanGardenPassage");
State.temporary = null;
assert(api.ensureGwylanSceneState() === undefined, "State.temporary 缺失 → 静默返回，不抛错");
State.temporary = {};
api.ensureGwylanSceneState();
assert(Array.isArray(State.temporary.gwylanStatus), "gwylanStatus 非数组 → 调用原版状态刷新补齐");
assert(typeof State.temporary.gwylanTF === "object" && State.temporary.gwylanTF.known === false, "gwylanTF 缺失 → 建出 ears/tail/fangs=hidden + known=false");
State.temporary.gwylanTF = { ears: "shown" };
api.ensureGwylanSceneState();
assert(State.temporary.gwylanTF.ears === "shown", "gwylanTF 已存在时不覆盖玩家现状");
assert(api.isGwylanGardenPassage("Gwylan Cottage") === true, "含 gwylan 的段落判定为花园/森林商店场景");
assert(api.isGwylanGardenPassage("Forest Shop") === true, "Forest Shop 前缀命中");
assert(api.isGwylanGardenPassage("Pregnancy Birth Forest Shop") === true, "Pregnancy Birth Forest Shop 前缀命中");
assert(api.isGwylanGardenPassage("Town") === false, "普通段落不命中");
assert(api.isGwylanGardenPassage(null) === false, "空值不命中且不抛错");

console.log("\nCOMBAT TRANSFORM STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
