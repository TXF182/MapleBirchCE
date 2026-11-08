/* 适配器动作直调通道 + 存档就绪判据（v2.0.10）
 *
 * 背景（v2.0.9 遗留缺口）：
 *  ① 适配器 actions 原先只在 UI 点击时内联 a.run({})，测试/外部无直调通道 → 动作分支无法覆盖；
 *  ② detect 与两个 action 的 `if (!v)` 判空恒不成立（getV() 未读档时返回 {} 兜底，truthy），
 *     分支不可达；且真未读档时写进 {} 只落在临时对象上，静默无效。
 * 本测试同时验证「未就绪要明确报错」与「就绪后动作真写进存档」。
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
global.localStorage = window.localStorage;
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
window.maplebirch = { npc: {}, temporary: {}, on: function () { return function () {}; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ============ 1. 注入早于读档：两条通道都必须明确说「未就绪」，不得静默写空对象 ============ */
section("1 未读档");
assert(!!api && typeof api.mbCEAdapterAction === "function", "导出 mbCEAdapterAction（适配器动作直调通道）");
const early = api.mbCEAdapterAction("dolonline", "dl_init_run", {});
assert(early && early.ok === false && /尚未就绪/.test(early.message), "未读档执行动作 → ok:false 且提示游戏尚未就绪（实际：" + (early && early.message) + "）");
assert(api.CHEAT_ADAPTERS.dolonline.detect() === false, "未读档 detect 返回 false（不会把兜底空对象当成模组在场）");

/* ============ 2. 读档但没有任何 Dolonline 键：detect 仍应为 false ============ */
section("2 读档无该模组键");
const V = {};
global.V = V; window.V = V; /* 真实游戏里 V 挂在 window 上；hasV() 按 window 判就绪，两条都要设 */
global.State = { variables: V, passage: "Room" };
window.State = global.State;
assert(api.CHEAT_ADAPTERS.dolonline.detect() === false, "空存档 detect false");

/* ============ 3. 有 mpCat 即认定在场（Dolonline 独有键） ============ */
section("3 detect 命中");
V.mpCat = 0;
assert(api.CHEAT_ADAPTERS.dolonline.detect() === true, "存在 mpCat → detect true");
delete V.mpCat;
V.npcCh = 0;
assert(api.CHEAT_ADAPTERS.dolonline.detect() === true, "存在 npcCh（灰的章节）→ detect true");

/* ============ 4. dl_init_run：补齐运行态键、不覆盖已有值、可重复执行 ============ */
section("4 初始化地下城运行态键");
V.dgHp = 42; /* 已有值不能被覆盖 */
const r1 = api.mbCEAdapterAction("dolonline", "dl_init_run", {});
assert(r1 && r1.ok === true, "动作执行成功");
assert(V.dgFloor === 1 && V.dgGold === 0 && V.dgMana === 100 && V.dgManaMax === 100 && V.dgKills === 0, "按 dungeon.twee:3–5 原版初值补齐 dgFloor/dgGold/dgMana/dgManaMax/dgKills");
assert(V.dgHp === 42, "已有 dgHp=42 未被覆盖（写回原值而非重置）");
assert(V.mpSkill && typeof V.mpSkill === "object", "mpSkill 补空对象（法术动作的宿主）");
assert(/已补齐/.test(r1.message), "首次提示「已补齐 N 个运行态键」（" + r1.message + "）");
const r2 = api.mbCEAdapterAction("dolonline", "dl_init_run", {});
assert(r2 && r2.ok === true && /已齐全/.test(r2.message), "重复执行幂等：提示已齐全，不再改动");

/* ============ 5. dl_all_spells：9 键置 1、幂等、宿主缺失自动建 ============ */
section("5 解锁全部法术");
delete V.mpSkill;
const r3 = api.mbCEAdapterAction("dolonline", "dl_all_spells", {});
assert(r3 && r3.ok === true, "宿主缺失时动作自动建 mpSkill 并执行成功");
const keys = ["fireWall", "iceSpike", "shadowBolt", "thunderStorm", "meteor", "uDesp", "uBurst", "uChain", "uBlood"];
assert(keys.every(function (k) { return V.mpSkill[k] === 1; }), "9 个法术键全部置 1（含 4 个职业技能）");
const r4 = api.mbCEAdapterAction("dolonline", "dl_all_spells", {});
assert(r4 && /此前已解锁/.test(r4.message), "重复执行幂等：全部此前已解锁");

/* ============ 6. 错误通道：未知适配器/未知动作必须报错，不能静默返回 undefined ============ */
section("6 错误通道");
const e1 = api.mbCEAdapterAction("no-such-adapter", "x", {});
assert(e1 && e1.ok === false && /未找到适配器/.test(e1.message), "未知适配器 → 明确报错");
const e2 = api.mbCEAdapterAction("dolonline", "no-such-action", {});
assert(e2 && e2.ok === false && /无此动作/.test(e2.message), "未知动作 → 明确报错");
const e3 = api.mbCEAdapterAction("", "dl_init_run", {});
assert(e3 && e3.ok === false && /未指定适配器/.test(e3.message), "空 adapterId → 明确报错（不落到注册表首项）");
/* 临时动作：声明了 key 但没有 run / run 抛异常 —— 两条错误分支真实走一遍后清理 */
const host = api.CHEAT_ADAPTERS.dolonline.entry.actions;
host.push({ key: "__t_norun", name: "临时未实现" }, { key: "__t_boom", name: "临时抛异常", run: function () { throw new Error("boom"); } });
const e4 = api.mbCEAdapterAction("dolonline", "__t_norun", {});
assert(e4 && e4.ok === false && /该动作未实现/.test(e4.message), "run 不是函数 → 「该动作未实现」（不抛 TypeError）");
const e5 = api.mbCEAdapterAction("dolonline", "__t_boom", {});
assert(e5 && e5.ok === false && /动作抛出异常/.test(e5.message) && /boom/.test(e5.message), "run 抛异常 → 被 catch 成 { ok:false, message }（不冒泡）");
host.splice(host.length - 2, 2);
assert(host.length === 2, "临时动作已清理（注册表回到 2 条真实动作）");

/* ============ 7. 单一实现路径（源码级防回归）：UI 按钮不得再内联 a.run() ============ */
section("7 单一实现路径");
const src = fs.readFileSync(path.join(__dirname, "..", "javascript", "src", "05a3-modcheat-actions.js"), "utf8");
assert(src.indexOf("mbCEAdapterRun(m, a.key, {})") > 0, "UI 按钮走共用执行函数 mbCEAdapterRun（单一实现路径）");
assert(src.indexOf("list[i].run(args") > 0, "执行本体只有一处 run 调用");
assert(src.indexOf("function mbCEAdapterRun(") > 0 && src.indexOf("function mbCEAdapterAction(") > 0, "执行本体与直调入口各只定义一次");

/* ============ 8. 存档就绪判据 hasV：V / State 两条来源的四种组合 ============ */
section("8 存档就绪判据 hasV");
assert(typeof api.hasV === "function", "导出 hasV（就绪判据可被测试与外部脚本核对）");
const savedV = window.V, savedState = window.State;
window.V = {}; window.State = undefined;
assert(api.hasV() === true, "window.V 是对象 → 就绪");
window.V = 42;
assert(api.hasV() === false, "window.V 存在但不是对象且 State 缺失 → 未就绪（不把数字当真值）");
window.V = null;
assert(api.hasV() === false, "window.V 为 null → 未就绪");
window.V = undefined; window.State = { variables: {} };
assert(api.hasV() === true, "window.V 未定义但 State.variables 存在 → 就绪（框架另一条来源也算）");
window.State = {};
assert(api.hasV() === false, "State 存在但无 variables → 未就绪");
window.V = savedV; window.State = savedState;
assert(api.hasV() === true, "复原后回到就绪态（后续断言不受污染）");

console.log("\nADAPTER ACTIONS: passed=" + passes + " failed=" + failures);
if (failures) { process.exit(1); }
process.exit(0);
