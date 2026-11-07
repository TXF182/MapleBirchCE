/* 恋爱阶段 / 转化阶段状态测试（branches 门槛 70→80 整改轮）
 *
 * 覆盖对象：02-romance.js —— 框架条件解析（parseCondition 九种形态）、写入修复（applyRomanceFix
 * 的 set/clear/append/state 四类）、原生恋人卡槽（数组 / 对象空槽 / 满槽 + MLI 扩容 / 无处可写）、
 * 一键完成与批量的计数口径、转化阶段（levels 门槛、目标档位钳制、build 差额补偿、无框架 API 拒绝）。
 *
 * 关键口径：这里的「能不能作弊成功」= 条件函数复检通过（stage.fn() 真值），不是「写了就算」。
 * 所以每个用例都在写入后**重新执行原条件函数**，写入与复检必须同时成立才算 PASS。
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
const V = { player: {}, passage: "Room", loveInterest: ["Gwylan"] };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;

/* 框架桩：先装好再首次调用，否则 resolveMB 缓存不到（01-core.js:38 首次成功即存模块变量） */
const tfStore = {};
window.maplebirch = {
  npc: {
    romanceConditions: {
      Gwylan: [
        function () { return V.gwylan_stage >= 1; },
        function () { throw new Error("条件函数自身抛错"); },
        "not-a-function"
      ],
      Alex: [
        function () { return V.alex_stage >= 1; },
        function () { return (V.loveInterest && V.loveInterest.includes("Alex")); }
      ]
    },
    data: new Map(),
    Transformation: {
      configs: new Map([
        ["gwylan", new Map([["wolf", { levels: [5, 10, 15] }], ["cat", { levels: [] }]])]
      ]),
      get: function (n, t) {
        const cur = tfStore[n + ":" + t];
        return cur ? { build: cur.build, level: cur.level } : null;
      },
      build: function (n, t, d) {
        const k = n + ":" + t;
        tfStore[k] = tfStore[k] || { build: 0, level: 0 };
        tfStore[k].build += d;
      },
      set: function (n, t, lv) {
        const k = n + ":" + t;
        tfStore[k] = tfStore[k] || { build: 0, level: 0 };
        tfStore[k].level = lv;
      }
    }
  }
};

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.getRomanceStages === "function" && typeof api.completeRomanceStage === "function", "恋爱/转化 API 已导出");

/* ================= 1. 条件读取与阶段枚举 ================= */
section("1 getRomanceStages 枚举口径");
const stG = api.getRomanceStages("gwylan"); /* 大小写不敏感 */
assert(stG.length === 2, "非函数条件被跳过（3 条只剩 2 条，实际 " + stG.length + "）");
assert(stG[0].fn && typeof stG[0].fn === "function", "可执行条件保留 fn 供复检");
assert(stG[1].ok === false, "抛错的条件按 false 处理（不炸整页）");
assert(typeof stG[0].text === "string" && stG[0].text.length > 0, "条件源码文本可读（用于静态解析）");
assert(api.getRomanceStages("nobody").length === 0, "框架无该 NPC 条件 → 空列表");
/* 原生兜底：无框架条件但 V.loveInterest 命中 */
const stNative = api.getRomanceStages("Gwylan2");
assert(stNative.length === 0, "既无框架条件也无原生标记 → 空");
V.loveInterest = ["Gwylan"];
const stNativeHit = api.getRomanceStages("Gwylan");
assert(stNativeHit.length === 2, "有框架条件时不重复叠加原生兜底");

/* ================= 2. 原生恋人卡槽三种形态 ================= */
section("2 addLoveInterest 与 recordNativeLoveWrite");
V.loveInterest = [];
V.mbCE_wrote = {};
const sNativeArr = { native: true, index: 0, text: "() => rv.variables.loveInterest.includes(\"NativeA\")" };
const rFirst = api.completeRomanceStage("NativeA", sNativeArr);
assert(rFirst.ok === true && V.loveInterest.indexOf("NativeA") !== -1, "空卡槽 + 原生兜底条件 → 直接写入卡槽");
assert(api.completeRomanceStage("NativeA", sNativeArr).ok === true && V.loveInterest.length === 1, "已在卡槽 → 判完成且不重复写");
V.loveInterest = [];
const rAdd = api.completeRomanceStage("NativeA", sNativeArr);
assert(rAdd.ok === true && V.loveInterest.indexOf("NativeA") !== -1, "数组形态 → push 进卡槽");
assert(!!V.mbCE_wrote["romance:native:nativea"], "写入后留痕登记（romance:native:<小写名>）");
assert(typeof V.mbCE_wrote["romance:native:nativea"].t === "number", "留痕带时间戳（trim 排序不丢条目）");
V.loveInterest = { primary: "Gwylan", secondary: "" };
const rSlot = api.completeRomanceStage("NativeB", sNativeArr);
assert(rSlot.ok === true && V.loveInterest.secondary === "NativeB", "对象形态 → 写入首个空槽（不覆盖已有恋人）");
V.loveInterest = { primary: "Gwylan", secondary: "Alex" };
V.loveInterestList = [];
const rFull = api.completeRomanceStage("NativeC", sNativeArr);
assert(rFull.ok === true && V.loveInterestList.indexOf("NativeC") !== -1, "槽位全满 + 有 MLI 扩容列表 → 追加到扩容列表");
V.loveInterest = { primary: "Gwylan" };
delete V.loveInterestList;
const rNoRoom = api.completeRomanceStage("NativeD", sNativeArr);
assert(rNoRoom.ok === false, "槽位全满且无扩容列表 → 拒绝（不覆盖已有恋人）");
V.loveInterest = {};
const rEmpty = api.completeRomanceStage("NativeE", sNativeArr);
assert(rEmpty.ok === true && V.loveInterest.primary === "NativeE", "空对象 → 写入 primary 主槽");

/* ================= 3. parseCondition 九种形态（经一键完成反证） ================= */
section("3 条件静态解析 + 写入修复");
function tryStage(name, src, fn) {
  const r = api.completeRomanceStage(name, { index: 0, text: src, fn: fn });
  return r;
}
V.numericGate = 0;
assert(tryStage("Gwylan", "() => 5 >= rv.variables.numericGate", function () { return V.numericGate >= 5; }).ok === true,
  "数值在前（N <= path）→ 置为该值后复检通过");
V.farm_stage = 0;
assert(tryStage("Alex", "() => rv.variables.farm_stage >= 5", function () { return V.farm_stage >= 5; }).ok === true,
  "路径在前（path >= N）→ 置为 N + 复检通过");
assert(V.farm_stage === 5 && V.farm && typeof V.farm === "object", "farm_stage 写入后立刻补 $farm 空壳（否则社交段崩）");
V.strictGate = 0;
assert(tryStage("Gwylan", "() => rv.variables.strictGate > 3", function () { return V.strictGate > 3; }).ok === true,
  "严格大于 → 置 N+1 才能通过（不是置 N）");
V.clearGate = "x";
assert(tryStage("Gwylan", "() => undefined === rv.variables.clearGate", function () { return V.clearGate === undefined; }).ok === true,
  "undefined 判断 → 删除该字段后复检通过");
V.listGate = ["a"];
assert(tryStage("Gwylan", "() => rv.variables.listGate?.includes(\"b\")", function () { return V.listGate.indexOf("b") !== -1; }).ok === true,
  "数组 includes → 追加值后复检通过");
V.seenGate = ["a"];
assert(tryStage("Gwylan", "() => rv.variables[\"seenGate\"] ?? []).includes(\"b\")", function () { return V.seenGate.indexOf("b") !== -1; }).ok === true,
  "字面键 [?] .includes → 追加值");
V.dynSeen = [];
assert(tryStage("Dyn", "() => rv.variables[key + \"Seen\"] ?? []).includes(\"x\")", function () { return V.dynSeen.indexOf("x") !== -1; }).ok === true,
  "动态键 [X+\"Seen\"] → 归一到 <npc小写>Seen 后追加");
V.bareGate = 0;
assert(tryStage("Gwylan", "() => rv.variables.bareGate", function () { return !!V.bareGate; }).ok === true,
  "裸真值 → 写 1");
V.characters = { npc: { gwylan: { state: "hostile" } } };
assert(tryStage("Gwylan", "() => \"stable\" !== rv.variables.characters.npc.Gwylan.state", function () {
  return V.characters.npc.gwylan.state === "stable";
}).ok === true, "NPC state 判据 → 置 stable");
V.characters = {};
assert(tryStage("Gwylan", "() => \"stable\" !== rv.variables.characters.npc.Gwylan.state", function () { return false; }).fixed === false,
  "NPC 记录缺失 → state 修复返回 false（不假装成功）");
V.characters = { npc: { gwylan: "not-object" } };
/* 记录现状：state 分支只校验「键存在」就返回 fixed=true，值非对象时既不写入也不报 false
   —— 面板会显示「已修复」而状态没变。属待决口径，此处钉住事实，防止悄悄改动。 */
const rNonObj = tryStage("Gwylan", "() => \"stable\" !== rv.variables.characters.npc.Gwylan.state", function () { return false; });
assert(V.characters.npc.gwylan === "not-object", "NPC 记录非对象 → 实际未写入（fixed=" + rNonObj.fixed + "，已知宽松口径）");
const unparsable = tryStage("Gwylan", "() => someWeirdClosure(x)", function () { return false; });
assert(unparsable.parsed === null && unparsable.fixed === false, "无法解析的条件 → 不写入（仅显示，避免瞎改）");
V.objGate = { a: "", b: "x" };
assert(tryStage("Gwylan", "() => rv.variables.objGate?.includes(\"y\")", function () {
  return V.objGate.a === "y";
}).ok === true, "对象结构调整为空槽写入（不是 push）");
V.objFull = { a: "x", b: "y" };
tryStage("Gwylan", "() => rv.variables.objFull?.includes(\"z\")", function () { return false; });
assert(V.objFull["0"] === "z", "对象无空槽 → 退化为写 \"0\" 新键（保留原键不覆盖）");

/* ================= 4. 批量一键完成计数 ================= */
section("4 unlockAllRomance 计数口径");
V.gwylan_stage = 1;
V.loveInterest = ["Gwylan"];
const uAll = api.unlockAllRomance("gwylan");
assert(typeof uAll.total === "number" && uAll.total >= 2, "批量返回 total（该 NPC 条件条数）");
assert(uAll.passed >= 1, "已完成的条件计入 passed 而不重复写（" + uAll.passed + "）");
assert(uAll.passed === 1 && uAll.total === 2, "已完成 1 条计入 passed，另 1 条（条件函数抛错且不可解析）不计入 fixed（passed=" + uAll.passed + " total=" + uAll.total + "）");
assert(uAll.fixed + uAll.passed <= uAll.total, "fixed + passed 不超过 total（不夸大）");

/* ================= 5. 转化阶段 ================= */
section("5 转化阶段 levels 门槛");
const types = api.listStageTypes("gwylan");
assert(types instanceof Map, "listStageTypes 返回 Map");
assert(types.get("wolf").length === 3, "带 levels 的自定义档位被采用（3 档）");
assert(types.get("cat").length === 6, "levels 为空 → 回落默认 6 档");
V.maplebirch = { npc: { gwylan: { transformation: { bird: { build: 1, level: 2 } } } } };
const types2 = api.listStageTypes("gwylan");
assert(types2.get("bird").length === 6, "存档里出现的新类型补进列表（默认 6 档）");
assert(api.readTransformState("gwylan", "wolf").build === 0, "无记录 → build/level 归零");
tfStore["gwylan:wolf"] = { build: 7, level: 1 };
assert(api.readTransformState("gwylan", "wolf").level === 1, "框架 API 命中 → 读真实档位");
V.maplebirch = { npc: { gwylan: { transformation: { wolf: { build: 12, level: 2 } } } } };
delete window.maplebirch.npc.Transformation.get;
assert(api.readTransformState("gwylan", "wolf").build === 12, "框架 API 缺失 → 回退读存档变量");
window.maplebirch.npc.Transformation.get = function (n, t) {
  const cur = tfStore[n + ":" + t];
  return cur ? { build: cur.build, level: cur.level } : null;
};
const adj = api.adjustTransform("gwylan", "wolf", 3);
assert(typeof adj.build === "number", "adjustTransform 走框架 build 并回读（" + adj.build + "）");
assert(api.completeTransformStage("gwylan", "wolf", 0) === true, "目标档位 0 → 直接置 0 并成功");
tfStore["gwylan:wolf"] = { build: 0, level: 0 };
assert(api.completeTransformStage("gwylan", "wolf", 2) === true, "目标档位 2 → 补 build 差额 + set 档位");
assert(tfStore["gwylan:wolf"].build === 10 && tfStore["gwylan:wolf"].level === 2, "build 按 levels[1]=10 补偿到位（实际 " + tfStore["gwylan:wolf"].build + "）");
assert(api.completeTransformStage("gwylan", "wolf", 99) === true && tfStore["gwylan:wolf"].level === 3, "超上限目标 → 钳到档位上限 3");
window.maplebirch.npc.Transformation.set = null;
assert(api.completeTransformStage("gwylan", "wolf", 1) === false, "框架无 set API → 拒绝（不空写档位）");
window.maplebirch.npc.Transformation.set = function (n, t, lv) {
  const k = n + ":" + t;
  tfStore[k] = tfStore[k] || { build: 0, level: 0 };
  tfStore[k].level = lv;
};
assert(api.unlockAllTransform("gwylan") >= 1, "一键解锁全部转化 → 至少完成一个类型");
/* 档位已达标时不应再补 build（幂等） */
tfStore["gwylan:wolf"] = { build: 10, level: 2 };
const before = tfStore["gwylan:wolf"].build;
api.completeTransformStage("gwylan", "wolf", 2);
assert(tfStore["gwylan:wolf"].build === before, "build 已达标 → 差额为 0 不再重复累加（幂等）");

console.log("\nROMANCE STAGE STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
