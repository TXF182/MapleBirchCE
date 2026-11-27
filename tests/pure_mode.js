/*
 * 纯净模式：暂停写入总开关 + 回退通道不被误拦
 *
 * 目标（v2.2.8 需求①）：
 *   1) 默认关闭（旧档没有 mbCE_pure 时行为不变）
 *   2) 开启后 cheatWriteValue / cheatWriteListValue 直接拒绝，不落值、不留痕
 *   3) 关闭后写入恢复（留痕照常）
 *   4) 纯净模式下 undoCheatModValue 仍能执行（回退是出口，不能被自己拦死）
 *   5) mbCEAdapterRun / mbCELockTick 走同一判定（命令式动作与每秒写回都要停）
 *
 * 做法：vm 分别加载 07w-pure.js 与 04b-modcheat-write.js，注入最小宿主。
 * 边界：不断言 Render 的 DOM 细节（由 e2e 全局页渲染覆盖）。
 *
 * 用法：node tests/pure_mode.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "..", "javascript", "src");
const PURE = path.join(SRC, "07w-pure.js");
const WRITE = path.join(SRC, "04b-modcheat-write.js");
const ACTIONS = path.join(SRC, "05a3-modcheat-actions.js");
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

/* 真实原版黑名单从运行时常量解析（与 unit_modcheat_write.js 同口径，避免复制会漂移的清单） */
function loadVanillaRoots() {
  const text = fs.readFileSync(path.join(SRC, "03d-global-modzh.js"), "utf8");
  const m = text.match(/var CHEAT_VANILLA_ROOTS = \[([\s\S]*?)\];/);
  if (!m) { throw new Error("未找到 CHEAT_VANILLA_ROOTS 定义"); }
  return (m[1].match(/"[^"]+"/g) || []).map(function (s) { return s.slice(1, -1); });
}

/* ---------- 07w-pure.js 独立沙箱 ---------- */
function loadPure(V) {
  const sandbox = {
    getV: function () { return V; },
    console: console,
    /* UI 依赖只在 Render 里用到；本测试不调 Render，占位避免解析阶段报错 */
    el: function () { return { appendChild: function () {}, addEventListener: function () {} }; },
    MCE_CLS: { row: "", btn: "", ok: "", err: "", hint: "", gold: "" },
    mceBtnGrid: function () { return { appendChild: function () {} }; },
    setStatus: function () {},
    renderGlobal: function () {},
    mbCEUndoAll: function () { return { ok: true, n: 0, fail: 0, skip: 0, msg: "stub" }; }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(PURE, "utf8"), sandbox, { filename: PURE });
  return sandbox;
}

/* ---------- 04b 沙箱：先加载 07w-pure（与真实同域），再加载 04b；UI 依赖给空壳 ---------- */
function loadWrite(opts) {
  const o = opts || {};
  const V = o.V === undefined ? {} : o.V;
  const sandbox = {
    CHEAT_VANILLA_ROOTS: loadVanillaRoots(),
    CHEAT_ADAPTERS: o.adapters || {},
    getV: function () { return V; },
    window: {},
    console: console,
    mbCEWroteTrim: function () {},
    mbCEErr: function (e) { return (e && e.message) ? e.message : String(e); },
    el: function () { return { appendChild: function () {}, addEventListener: function () {} }; },
    MCE_CLS: { row: "", btn: "", ok: "", err: "", hint: "", gold: "" },
    mceBtnGrid: function () { return { appendChild: function () {} }; },
    setStatus: function () {},
    renderGlobal: function () {},
    mbCEUndoAll: function () { return { ok: true, n: 0, fail: 0, skip: 0, msg: "stub" }; }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(PURE, "utf8"), sandbox, { filename: PURE });
  vm.runInContext(fs.readFileSync(WRITE, "utf8"), sandbox, { filename: WRITE });
  sandbox.__V = V;
  return sandbox;
}

/* ---------- 05a3 沙箱（同样先加载 07w，mbCEPureGuard 才可用） ---------- */
function loadActions(opts) {
  const o = opts || {};
  const V = o.V === undefined ? {} : o.V;
  const sandbox = {
    CHEAT_ADAPTERS: o.adapters || {},
    mbCEErr: function (e) { return (e && e.message) ? e.message : String(e); },
    getV: function () { return V; },
    console: console,
    el: function () { return {}; },
    MCE_CLS: { row: "", btn: "", ok: "", err: "", hint: "", gold: "" },
    mceBtnGrid: function () { return { appendChild: function () {} }; },
    setStatus: function () {},
    renderGlobal: function () {},
    mbCEUndoAll: function () { return { ok: true, n: 0, fail: 0, skip: 0, msg: "stub" }; }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(PURE, "utf8"), sandbox, { filename: PURE });
  vm.runInContext(fs.readFileSync(ACTIONS, "utf8"), sandbox, { filename: ACTIONS });
  return sandbox;
}

/* ---------- 1. 状态机 ---------- */
{
  const V = {};
  const p = loadPure(V);
  assert(p.mbCEPureIsOn() === false, "默认关闭：旧档无 mbCE_pure 时判定为关闭");
  const on = p.mbCEPureSet(true);
  assert(on.ok === true && V.mbCE_pure === 1, "mbCEPureSet(true)：写入 V.mbCE_pure=1 并返回 ok");
  assert(p.mbCEPureIsOn() === true, "mbCEPureIsOn：开启后为真");
  assert(p.mbCEPureBlock("测试通道") !== null, "mbCEPureBlock：开启时返回拦截对象");
  const off = p.mbCEPureSet(false);
  assert(off.ok === true && V.mbCE_pure === 0, "mbCEPureSet(false)：写 0 恢复");
  assert(p.mbCEPureBlock("测试通道") === null, "mbCEPureBlock：关闭时返回 null（放行）");
  /* 无存档：不炸、不放行 */
  const nullV = loadPure(null);
  assert(typeof nullV.mbCEPureIsOn() === "boolean" && nullV.mbCEPureIsOn() === false, "getV 为空时 mbCEPureIsOn 返回 false 且不抛错");
  const setNull = nullV.mbCEPureSet(true);
  assert(setNull.ok === false, "getV 为空时 mbCEPureSet 明确失败");
}

/* ---------- 2. cheatWriteValue：开启拦截 / 关闭恢复 ---------- */
{
  const V = { custom: { a: { b: 1 } }, mbCE_wrote: {} };
  const s = loadWrite({ V: V });
  s.mbCEPureSet(true);
  const blocked = s.cheatWriteValue("m", "k", "set", "custom.a.b", 2, "number");
  assert(blocked.ok === false && String(blocked.message).indexOf("纯净模式") !== -1, "纯净模式：cheatWriteValue 返回拒绝且文案点名纯净模式");
  assert(V.custom.a.b === 1, "纯净模式：值未被改写");
  assert(Object.keys(V.mbCE_wrote).length === 0, "纯净模式：不产生留痕");

  s.mbCEPureSet(false);
  const ok = s.cheatWriteValue("m", "k", "set", "custom.a.b", 2, "number");
  assert(ok.ok === true && V.custom.a.b === 2, "关闭纯净模式：同一路径写入恢复");
  assert(V.mbCE_wrote["cheat:m:k"] && V.mbCE_wrote["cheat:m:k"].after === 2, "关闭后留痕照常记录 after");

  /* 4. 回退通道不被拦 */
  s.mbCEPureSet(true);
  const undo = s.undoCheatModValue("m", "k");
  assert(undo.ok === true, "纯净模式下 undoCheatModValue 仍可执行（回退是出口，不被拦截）");
  assert(V.custom.a.b === 1, "回退把值还原为首次写入前");
}

/* ---------- 3. cheatWriteListValue：开启拦截 ---------- */
{
  const V = { custom: { a: { arr: ["x"] } }, mbCE_wrote: {} };
  const s = loadWrite({ V: V });
  s.mbCEPureSet(true);
  const r1 = s.cheatWriteListValue("m", "list", "add", "custom.a.arr", "y", true);
  assert(r1.ok === false && String(r1.message).indexOf("纯净模式") !== -1, "纯净模式：cheatWriteListValue 返回拒绝");
  assert(V.custom.a.arr.length === 1 && V.custom.a.arr[0] === "x", "纯净模式：列表未被追加");
  s.mbCEPureSet(false);
  const r2 = s.cheatWriteListValue("m", "list", "add", "custom.a.arr", "y", true);
  assert(r2.ok === true && V.custom.a.arr.length === 2, "关闭后列表写入恢复");
}

/* ---------- 5. 命令式动作 ---------- */
{
  const adapters = { a: { actions: [{ key: "do", run: function () { return { ok: true, message: "ran" }; } }] } };
  const s = loadActions({ adapters: adapters });
  s.mbCEPureSet(true);
  const blocked = s.mbCEAdapterRun(adapters.a, "do");
  assert(blocked.ok === false && String(blocked.message).indexOf("纯净模式") !== -1, "纯净模式：命令式动作 mbCEAdapterRun 被拦");
  s.mbCEPureSet(false);
  const ok = s.mbCEAdapterRun(adapters.a, "do");
  assert(ok.ok === true && ok.message === "ran", "关闭后命令式动作恢复执行");
}

if (failures) {
  console.error("\n" + failures + " 项失败");
  process.exit(1);
}
console.log("\n全部通过");
