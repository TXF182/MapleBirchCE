/* 适配器负向分支（05a-modcheat-rows：能力切换 / 剧情操作 / 数值写入的三组分发）
 * branches 70→80 整改轮 · 第十七批
 * 目标：把「模组未注册 / 条目存在但缺声明变量 / 类型未知 / 列表型 / 读取安全兜底」
 * 这五类拒绝路径全部打穿 —— 这些是玩家在面板上点按钮时最容易静默失败的地方。
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
global.HTMLSelectElement = window.HTMLSelectElement;

const V = { negmod: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* 假适配器：故意包含「缺 varPath / 缺 skipVar / 缺 completeVar / 缺 progressVar」的坏条目 */
setup.mbCE_modCheats = [
  {
    modId: "neg-mod", modName: "负向模组", declared: true,
    abilities: [
      { key: "ab_num", name: "数值能力", varPath: "negmod.flagNum", numeric: true, min: 0, max: 9 },
      { key: "ab_bool", name: "布尔能力", varPath: "negmod.flagBool" },
      { key: "ab_nov", name: "缺变量能力" },
      null
    ],
    scenes: [
      { key: "sc_full", name: "完整剧情", skipVar: "negmod.skip", completeVar: "negmod.done", progressVar: "negmod.prog", resetValue: 3 },
      { key: "sc_bare", name: "裸剧情" },
      null
    ],
    values: [
      { key: "val_num", name: "数值项", varPath: "negmod.money", type: "number", min: 0, max: 9999 },
      { key: "val_bool", name: "布尔项", varPath: "negmod.flagBool", type: "boolean" },
      { key: "val_str", name: "字符串项", varPath: "negmod.strVal", type: "string" },
      { key: "val_list", name: "列表项", varPath: "negmod.listArr", type: "list" },
      { key: "val_nov", name: "缺变量数值项", type: "number" },
      null
    ]
  }
];

section("1 能力切换（toggleCheatAbility）");
let r = api.toggleCheatAbility("no-such-mod", "x", true);
assert(!r.ok && /能力不存在/.test(r.message), "未注册模组 → 拒绝并说明（" + r.message + "）");
r = api.toggleCheatAbility("neg-mod", "no-such-key", true);
assert(!r.ok && /能力不存在/.test(r.message), "未注册能力键 → 拒绝");
r = api.toggleCheatAbility("neg-mod", "ab_nov", true);
assert(!r.ok && /未声明能力变量/.test(r.message), "能力缺 varPath → 拒绝（不写 undefined 路径）");
r = api.toggleCheatAbility("neg-mod", "ab_num", true);
assert(r.ok && V.negmod.flagNum === 1, "numeric 能力勾选写 1（严格 is/gte 比较，不能写 boolean）");
r = api.toggleCheatAbility("neg-mod", "ab_num", false);
assert(r.ok && V.negmod.flagNum === 0, "numeric 能力取消写 0");
r = api.toggleCheatAbility("neg-mod", "ab_bool", true);
assert(r.ok && V.negmod.flagBool === true, "布尔能力保持 true 语义");
r = api.toggleCheatAbility("neg-mod", "ab_bool", false);
assert(r.ok && V.negmod.flagBool === false, "布尔能力取消写 false");
assert(V.mbCE_wrote["cheat:neg-mod:ability_set:ab_num"], "能力写入留下 ability_set 留痕（可回退）");

section("2 剧情操作（cheatSceneAction）");
r = api.cheatSceneAction("no-such-mod", "x", "scene_skip");
assert(!r.ok && /剧情不存在/.test(r.message), "未注册模组 → 拒绝");
r = api.cheatSceneAction("neg-mod", "sc_bare", "scene_skip");
assert(!r.ok && /未声明跳过标记变量/.test(r.message), "缺 skipVar → 拒绝该操作");
r = api.cheatSceneAction("neg-mod", "sc_bare", "scene_force");
assert(!r.ok && /未声明完成标记变量/.test(r.message), "缺 completeVar → 拒绝该操作");
r = api.cheatSceneAction("neg-mod", "sc_bare", "scene_reset");
assert(!r.ok && /未声明进度变量/.test(r.message), "缺 progressVar → 拒绝重置");
r = api.cheatSceneAction("neg-mod", "sc_full", "unknown_op");
assert(!r.ok && /未知剧情操作/.test(r.message), "未知操作码 → 拒绝（不落到默认写入）");
r = api.cheatSceneAction("neg-mod", "sc_full", "scene_skip");
assert(r.ok && V.negmod.skip === true, "skipVar 写入 true");
r = api.cheatSceneAction("neg-mod", "sc_full", "scene_force");
assert(r.ok && V.negmod.done === true, "completeVar 写入 true");
r = api.cheatSceneAction("neg-mod", "sc_full", "scene_reset");
assert(r.ok && V.negmod.prog === 3, "scene_reset 写声明里的 resetValue（缺省 0）");

section("3 数值写入（applyCheatModValue）");
r = api.applyCheatModValue("no-such-mod", "x", "1");
assert(!r.ok && /数值项不存在/.test(r.message), "未注册模组 → 拒绝");
r = api.applyCheatModValue("neg-mod", "val_nov", "1");
assert(!r.ok && /未声明变量/.test(r.message), "数值项缺 varPath → 拒绝");
r = api.applyCheatModValue("neg-mod", "val_num", "8888");
assert(r.ok && V.negmod.money === 8888, "number 通道按声明钳制写入");
r = api.applyCheatModValue("neg-mod", "val_str", "abc");
assert(typeof V.negmod.strVal === "string" && V.negmod.strVal === "abc", "string 项按声明类型原样写入（不再被 Number() 静默拒绝）");
r = api.applyCheatModValue("neg-mod", "val_list", "newItem");
assert(r.ok && Array.isArray(V.negmod.listArr), "list 项按 value_set 追加成数组");

section("4 读取安全兜底（cheatReadSafe）");
assert(api.cheatReadSafe("neg-mod", "negmod.money") === 8888, "存活路径读到真实值");
assert(api.cheatReadSafe("neg-mod", "negmod.nope") === undefined, "未设置路径返回 undefined（渲染显示「未设置」而不是崩）");
assert(api.cheatReadSafe("no-such-mod", "x.y") === undefined, "不可解析路径返回 undefined");
Object.defineProperty(V, "explode", { get: function () { throw new Error("boom"); }, configurable: true });
assert(api.cheatReadSafe("neg-mod", "explode") === undefined, "读取抛错 → catch 兜底 undefined");

console.log("\nADAPTER NEGATIVE: passed=" + passes + " failed=" + failures);
process.exit(failures ? 1 : 0);
