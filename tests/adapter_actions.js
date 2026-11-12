/* 适配器动作直调通道 + 存档就绪判据 hasV（v2.0.10，2026-11-12 改挂自建适配器）
 *
 * 背景（v2.0.9 遗留缺口）：
 *  ① 适配器 actions 原先只在 UI 点击时内联 a.run({})，测试/外部无直调通道 → 动作分支无法覆盖；
 *  ② 动作内的 `if (!v)` 判空恒不成立（getV() 未读档时返回 {} 兜底，truthy），分支不可达；
 *     且真未读档时写进 {} 只落在临时对象上，静默无效。
 * 本测试同时验证「未就绪要明确报错」与「就绪后动作真写进存档」。
 *
 * 2026-11-12：Dolonline 适配器撤下（上游含联机交易与市场，作弊会破坏其他玩家公平），
 * 本测试不再依赖任何真实模组——改用测试内自建 __t_probe 适配器。顺带补上原版漏测的
 * actions 直挂形态（原版只用 entry 内形态，mbCEAdapterList 的另一条分支从未被覆盖）。
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

/* ============ 0. 自建测试适配器：两种 actions 声明形态各一个 ============
   probe_fill：ifMissing 语义（缺才补，已有不覆盖），幂等；
   probe_free：直挂形态（不带 entry），只验证 mbCEAdapterList 能取到。 */
const PROBE_KEYS = ["__t_a", "__t_b", "__t_c"];
function probeFillRun() {
  if (!api.hasV()) { return { ok: false, message: "游戏尚未就绪，请先读档" }; }
  const v = window.V;
  let added = 0;
  PROBE_KEYS.forEach(function (k) {
    if (v[k] === undefined) { v[k] = 7; added++; }
  });
  return added
    ? { ok: true, message: "已补齐 " + added + " 个测试键" }
    : { ok: true, message: "已齐全，未改动" };
}
api.CHEAT_ADAPTERS["__t_probe"] = {
  entry: {
    detect: function () { return false; },
    actions: [
      { key: "probe_fill", name: "测试补齐", run: probeFillRun },
      { key: "__t_norun", name: "临时未实现" },
      { key: "__t_boom", name: "临时抛异常", run: function () { throw new Error("boom"); } }
    ]
  }
};
/* 直挂形态（无 entry 包裹）：单独一个适配器，避免影响上面的 entry 形态断言 */
api.CHEAT_ADAPTERS["__t_flat"] = {
  actions: [{ key: "flat_ok", name: "直挂动作", run: function () { return { ok: true, message: "flat done" }; } }]
};
assert(Array.isArray(api.CHEAT_ADAPTERS["__t_probe"].entry.actions), "自建适配器（entry 形态）注册成功");
assert(Array.isArray(api.CHEAT_ADAPTERS["__t_flat"].actions), "自建适配器（直挂形态）注册成功");

/* ============ 1. 注入早于读档：直调通道必须明确说「未就绪」，不得静默写空对象 ============ */
section("1 未读档");
assert(!!api && typeof api.mbCEAdapterAction === "function", "导出 mbCEAdapterAction（适配器动作直调通道）");
const early = api.mbCEAdapterAction("__t_probe", "probe_fill", {});
assert(early && early.ok === false && /尚未就绪/.test(early.message), "未读档执行动作 → ok:false 且提示游戏尚未就绪（实际：" + (early && early.message) + "）");

/* ============ 2. 读档后：ifMissing 补齐、不覆盖已有值、幂等 ============ */
section("2 读档后执行");
const V = {};
global.V = V; window.V = V; /* 真实游戏里 V 挂在 window 上；hasV() 按 window 判就绪，两条都要设 */
global.State = { variables: V, passage: "Room" };
window.State = global.State;
V.__t_b = 42; /* 已有值不能被覆盖 */
const r1 = api.mbCEAdapterAction("__t_probe", "probe_fill", {});
assert(r1 && r1.ok === true, "动作执行成功");
assert(V.__t_a === 7 && V.__t_c === 7, "缺失的 __t_a / __t_c 被补为 7（ifMissing 语义）");
assert(V.__t_b === 42, "已有 __t_b=42 未被覆盖（写回原值而非重置）");
assert(/已补齐 2 个测试键/.test(r1.message), "首次提示补齐条数（实际：" + r1.message + "）");
const r2 = api.mbCEAdapterAction("__t_probe", "probe_fill", {});
assert(r2 && r2.ok === true && /已齐全/.test(r2.message), "重复执行幂等：提示已齐全，不再改动");

/* ============ 2b. actions 两种声明形态都能被直调通道找到 ============ */
section("2b actions 声明形态");
const flat = api.mbCEAdapterAction("__t_flat", "flat_ok", {});
assert(flat && flat.ok === true && /flat done/.test(flat.message), "直挂形态 actions 可被直调（mbCEAdapterList 的非 entry 分支）");
const flatMiss = api.mbCEAdapterAction("__t_flat", "nope", {});
assert(flatMiss && flatMiss.ok === false && /无此动作/.test(flatMiss.message), "直挂形态未知动作 → 明确报错");

/* ============ 3. 错误通道：未知适配器/未知动作/空 id/未实现/抛异常 ============ */
section("3 错误通道");
const e1 = api.mbCEAdapterAction("no-such-adapter", "x", {});
assert(e1 && e1.ok === false && /未找到适配器/.test(e1.message), "未知适配器 → 明确报错");
const e2 = api.mbCEAdapterAction("__t_probe", "no-such-action", {});
assert(e2 && e2.ok === false && /无此动作/.test(e2.message), "未知动作 → 明确报错");
const e3 = api.mbCEAdapterAction("", "probe_fill", {});
assert(e3 && e3.ok === false && /未指定适配器/.test(e3.message), "空 adapterId → 明确报错（不落到注册表首项）");
const e4 = api.mbCEAdapterAction("__t_probe", "__t_norun", {});
assert(e4 && e4.ok === false && /该动作未实现/.test(e4.message), "run 不是函数 → 「该动作未实现」（不抛 TypeError）");
const e5 = api.mbCEAdapterAction("__t_probe", "__t_boom", {});
assert(e5 && e5.ok === false && /动作抛出异常/.test(e5.message) && /boom/.test(e5.message), "run 抛异常 → 被 catch 成 { ok:false, message }（不冒泡）");

/* ============ 4. 单一实现路径（源码级防回归）：UI 按钮不得再内联 a.run() ============ */
section("4 单一实现路径");
const src = fs.readFileSync(path.join(__dirname, "..", "javascript", "src", "05a3-modcheat-actions.js"), "utf8");
assert(src.indexOf("mbCEAdapterRun(m, a.key, {})") > 0, "UI 按钮走共用执行函数 mbCEAdapterRun（单一实现路径）");
assert(src.indexOf("list[i].run(args") > 0, "执行本体只有一处 run 调用");
assert(src.indexOf("function mbCEAdapterRun(") > 0 && src.indexOf("function mbCEAdapterAction(") > 0, "执行本体与直调入口各只定义一次");
assert(src.indexOf("function mbCEAdapterList(") > 0, "actions 取值收敛在 mbCEAdapterList 一处（两种声明形态同源）");

/* ============ 5. 存档就绪判据 hasV：V / State 两条来源的四种组合 ============ */
section("5 存档就绪判据 hasV");
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

/* ============ 6. 清理自建适配器，注册表不留测试残留 ============ */
section("6 清理");
delete api.CHEAT_ADAPTERS["__t_probe"];
delete api.CHEAT_ADAPTERS["__t_flat"];
assert(!api.CHEAT_ADAPTERS["__t_probe"] && !api.CHEAT_ADAPTERS["__t_flat"], "测试自建适配器已从注册表移除");
assert(!Object.prototype.hasOwnProperty.call(api.CHEAT_ADAPTERS, "dolonline"), "Dolonline 适配器已撤下（不在注册表）");

console.log("\nADAPTER ACTIONS: passed=" + passes + " failed=" + failures);
if (failures) { process.exit(1); }
process.exit(0);
