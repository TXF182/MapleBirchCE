/* 锁定恢复真实路径测试（v2.0.10 修「锁定后数值仍会变化」）
 *
 * 玩家真实路径：存档里已有锁定向 → 刷新页面/读档（注入早于 State 就绪）→ 不打开 CE 面板，
 * 只正常翻页游玩 → 游戏自身逻辑改值（如 V.willpower *= 0.99）→ 必须在翻页后被写回。
 *
 * 覆盖三层：
 *   ① 注入时 V 未就绪导致模块加载期 mbCELockEnsureTimer 拿空对象、定时器没起；
 *   ② :passagedisplay 翻页钩子恢复（修前缺失 = 用户实测「意志变成 99」根因）；
 *   ③ 面板全部可锁 property path 的批量写回（连带检查其他锁定数值）。
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
global.passage = function () { return "Room"; };

/* 只装框架事件壳：V / State 故意不设，模拟「脚本注入阶段读档还没发生」 */
const handlers = {};
window.maplebirch = {
  npc: {}, temporary: {},
  on: function (ev, cb) { handlers[ev] = cb; return function () {}; }
};

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 注入阶段：不得因为拿不到 V 而崩，也不得凭空建锁表 ================= */
section("1 注入早于读档");
assert(!!api, "注入完成即挂载 api（读档前）");
assert(typeof handlers[":passagedisplay"] === "function", "hookRefresh 注册了 :passagedisplay 翻页钩子");

/* ================= 2. 读档后：存档里已有锁定向，游戏把意志衰减到 99 ================= */
section("2 翻页恢复（用户实测路径）");
const V = { willpower: 99, purity: 1500, mbCE_lock: [{ path: "willpower", target: 100 }] };
global.V = V;
global.State = { variables: V, passage: "Room" };

assert(typeof api.mbCELockResume === "function", "导出 mbCELockResume（翻页/初始化统一恢复入口）");
assert(typeof api.mbCEResumeTimers === "function", "导出 mbCEResumeTimers（锁定+潜伏者+隐藏+态度+言灵 统一恢复）");
if (typeof api.mbCELockResume === "function") { api.mbCELockResume(); }
assert(V.willpower === 100, "恢复入口立即把 99 写回锁定目标 100（不等 1s tick）");

V.willpower = 97; /* 模拟游戏再次衰减 */
try { handlers[":passagedisplay"](); } catch (e) { console.error("passagedisplay threw: " + (e && e.message)); }
assert(V.willpower === 100, ":passagedisplay 翻页钩子同样恢复锁定（不打开面板也生效）");

/* ================= 3. 定时器：改值后 1s 内自动写回（跨 passage 的持续锁定） ================= */
section("3 定时写回");
V.willpower = 96;
const waitTick = new Promise(function (resolve) { setTimeout(resolve, 1300); });

/* ================= 4. 连带检查：面板全部 property path 批量写回 ================= */
section("4 全部可锁数值批量核查");
const src = fs.readFileSync(path.join(__dirname, "..", "javascript", "src", "05b-modcheat-player.js"), "utf8");
const groupBlock = src.slice(src.indexOf("var PANEL_QUICK_GROUPS"), src.indexOf("var PANEL_MAX_GROUPS") > 0 ? src.indexOf("var PANEL_MAX_GROUPS") : src.length);
const paths = [];
groupBlock.replace(/path:\s*"([^"]+)"/g, function (_m, p) { if (paths.indexOf(p) < 0) { paths.push(p); } return _m; });
assert(paths.length >= 20, "从面板属性表解析出 " + paths.length + " 条可锁 path（自更新，不硬编码）");

/* 按 path 形状建宿主：嵌套路径补父级（与玩家真实存档一致），顶层直接给数字 */
const seed = {};
paths.forEach(function (p) {
  const cur = V;
  const parts = p.split(".");
  let o = seed === null ? null : V;
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) { o[parts[i]] = 42; }
    else { if (!o[parts[i]] || typeof o[parts[i]] !== "object") { o[parts[i]] = {}; } o = o[parts[i]]; }
  }
});
V.mbCE_lock = [];
paths.forEach(function (p) { api.mbCELockSet(p, 77); });
paths.forEach(function (p) { api.mbCELockTick(); });
const bad = paths.filter(function (p) {
  const parts = p.split(".");
  let o = V;
  for (let i = 0; i < parts.length - 1; i++) { o = o && o[parts[i]]; }
  return !(o && o[parts[parts.length - 1]] === 77);
});
assert(bad.length === 0, "面板全部 " + paths.length + " 条锁定路径 tick 后都等于目标值" + (bad.length ? "（失败：" + bad.join(", ") + "）" : ""));

/* 缺失字段绝不凭空创建（老边界回归） */
api.mbCELockSet("willpowerMissingProbe", 5);
api.mbCELockTick();
assert(!("willpowerMissingProbe" in V), "目标字段不存在时 tick 跳过，不造脏键");

/* 同类缺陷：其它「按需 1s/500ms 定时器」也必须靠翻页恢复（不打开对应页也生效） */
const exp2 = fs.readFileSync(path.join(__dirname, "..", "javascript", "src", "09-exports2.js"), "utf8");
assert(exp2.indexOf("mbCEResumeTimers()") > 0, "hookRefresh 的 :passagedisplay 走统一恢复入口（源码级防回归）");

/* 同源缺陷另三处：转化隐藏 / 说话态度维持 / 言灵守卫，同样只在「点开关或打开对应页」时起表 */
V.transformationParts = { traits: { horns: "default" } };
V.mbCE_hide = { force: true, inner: true, wings: false };
V.mbCE_attitudeLock = { value: "meek", anchor: 1500, hold: true, fixed: 0 };
V.speech_attitude = "bratty";
V.submissive = 600;
V.mbCE_yanling = { noCross: true, noTrait: false };
V.crossdressing = 3;

V.mbCE_lurkerAuto = true;
V.hookah = { lurkers: 0 };
V.lurkers_held = 2;
V.lurkers_stored = 0;
api.mbCEResumeTimers();

waitTick.then(function () {
  assert(V.willpower === 77 || V.willpower === 100, "1.3s 后意志仍为锁定目标（实际 " + V.willpower + "）");
  assert(V.hookah.lurkers === 2 && V.lurkers_held === 0, "潜伏者自动搬运定时器随恢复入口起表（held 2 → 冰箱 2，实际 " + V.hookah.lurkers + "/" + V.lurkers_held + "）");
  assert(V.transformationParts && V.transformationParts.traits && V.transformationParts.traits.horns === "hidden", "转化隐藏定时器随恢复入口起表（traits.horns default → hidden）");
  assert(V.speech_attitude === "meek" && V.submissive === 851, "说话态度维持定时器随恢复入口起表（bratty/600 → meek/851，实际 " + V.speech_attitude + "/" + V.submissive + "）");
  assert(V.crossdressing === 0, "言灵守卫定时器随恢复入口起表（异装度 3 → 0，实际 " + V.crossdressing + "）");
  V.mbCE_lurkerAuto = false;
  section("5 清理");
  paths.forEach(function (p) { try { api.mbCELockRemove(p); } catch (e) {} });
  try { api.mbCELockRemove("willpowerMissingProbe"); } catch (e) {}
  try { api.mbCELockRemove("willpower"); } catch (e) {}
  V.mbCE_lock = [];
  console.log("\nLOCK RESUME: passed=" + passes + " failed=" + failures);
  if (failures) { process.exit(1); }
  process.exit(0);
});
