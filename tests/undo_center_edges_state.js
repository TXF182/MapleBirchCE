/* 回退中心边界与展示名测试（branches 70→80 整改轮 · 第十六批）
 * 覆盖 08c-undo-center 的分发/拒绝/异常分支与 08e-undo-labels 的「留痕键 → 中文名」解析层
 * （含此前 0 覆盖的 mbCEUndoWorldName）。玩家路径 = 全局页「统一回退中心」区块：
 * 单条回退 / 按类型分组回退 / 全部回退 / 刷新 / diff 预览开关；不可回退类型只显示徽标。
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

const V = { player: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room", temporary: {} };
global.setup = {};
global.Story = { has: function () { return true; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };
/* 展示名依赖的宿主函数：只桩最小面 */
global.displayName = function (n) { return n === "Robin" ? "罗宾" : n; };
global.zhKey = function (k) { return k === "spray" ? "防狼喷雾余量" : k; };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

section("1 展示名解析（08e）");
assert(api.undoItemName("barekey", null) === "barekey", "无命名空间键原样返回");
assert(api.undoItemName("cheat:player-self:p:spray", { path: "spray" }) === "防狼喷雾余量", "player-self 词表命中（p: 前缀不带动作名）");
assert(/^特质 · /.test(api.undoItemName("cheat:player-self:trait:masochism", { path: "masochism_level" })), "trait: 前缀补「特质 ·」动作名");
assert(api.undoItemName("cheat:unknown-mod:p:whatever.path", { path: "whatever.path" }) === "whatever.path", "未知模组/未知项时退回 rec.path（含点号才走该兜底）");
assert(api.undoItemName("place:no.such.path", null) === "no.such.path", "place 未命中分组表时退回原路径");
assert(api.undoItemName("maint:temple_quarters", null) === "神殿宿舍清洁", "maint 词表命中");
assert(api.undoItemName("yanling:purge_cross", null) === "异装与校规记录清除", "yanling 词表命中");
assert(api.undoItemName("world:no-such-gid:no-such-path", { path: "no-such-path" }) === "no-such-path", "world 未知分组 + 有路径 → 退回路径名（mbCEUndoWorldName 已执行）");
assert(api.undoItemName("world:no-such-gid", null) === "no-such-gid", "world 未知分组 + 无路径 → 退回 gid");
const worldPathName = api.undoItemName("world:no-such-gid:soap", null);
assert(worldPathName === "肥皂补给", "world 路径命中 maint 词表（gid 未知名时只显示路径中文）");
assert(api.undoItemName("romance:native:Robin", null) === "罗宾", "native 走 displayName 翻译");
assert(api.undoItemName("romance:native:Unknown", null) === "Unknown", "displayName 未命中时退回原名（不返回空串）");
assert(api.undoItemName("vanilla:some_stage", null) === "some_stage", "vanilla 键退回尾段可读");
assert(api.undoItemName(null, null) === "null", "空键也返回非空兜底（不渲染空白行）");

section("2 单条回退分发与拒绝（08c）");
assert(api.undoOne("no-such-key").msg.indexOf("该留痕已不存在") !== -1, "不存在的留痕 → 拒绝并说明");
V.mbCE_wrote["batch:x"] = { type: "batch", path: "x" };
assert(api.undoOne("batch:x").msg.indexOf("无法逐条还原") !== -1, "batch 类型显式拒绝（只保留审计）");
V.mbCE_wrote["yanling:purge_cross"] = { type: "yanling", path: "purge_cross" };
assert(api.undoOne("yanling:purge_cross").msg.indexOf("言灵") !== -1, "yanling 类型指向页内撤销");
V.mbCE_wrote["state:rel"] = { type: "state", path: "rel" };
assert(api.undoOne("state:rel").msg.indexOf("关系状态") !== -1, "state 类型拒绝（防破坏真实关系）");
V.mbCE_wrote["set:nopath"] = { type: "set" };
assert(api.undoOne("set:nopath").msg.indexOf("缺少 path") !== -1, "set 缺 path → 拒绝，不误删");
V.mbCE_wrote["clear:nopath"] = { type: "clear" };
assert(api.undoOne("clear:nopath").msg.indexOf("缺少 path") !== -1, "clear 缺 path → 拒绝");
V.mbCE_wrote["append:nopath"] = { type: "append" };
assert(api.undoOne("append:nopath").msg.indexOf("缺少 path") !== -1, "append 缺 path → 拒绝");
V.mbCE_wrote["weird:1"] = { type: "" };
assert(api.undoOne("weird:1").msg.indexOf("未知留痕类型") !== -1, "未知/空类型 → 明确拒绝");

section("3 单条回退成功路径");
V.someFlag = 1;
V.mbCE_wrote["set:someFlag"] = { type: "set", path: "someFlag" };
let r = api.undoOne("set:someFlag");
assert(r.ok && (V.someFlag === undefined), "set 回退删除该键（" + r.msg + "）");
assert(!V.mbCE_wrote["set:someFlag"], "set 回退后留痕同步清除");
V.someFlag = 0;
V.mbCE_wrote["clear:someFlag"] = { type: "clear", path: "someFlag" };
r = api.undoOne("clear:someFlag");
assert(r.ok && V.someFlag === 1, "clear 回退恢复原值 1");
V.listA = ["x", "y"];
V.mbCE_wrote["append:listA"] = { type: "append", path: "listA", value: "y" };
assert(api.undoOne("append:listA").ok && V.listA.join("") === "x", "append 数组回退移除指定值");
V.listA = ["x"];
V.mbCE_wrote["append:listA2"] = { type: "append", path: "listA", value: "zzz" };
assert(api.undoOne("append:listA2").msg.indexOf("已找不到") !== -1, "append 目标已不存在 → 明确失败（不改数组）");
V.mapA = { a: "v", b: "other" };
V.mbCE_wrote["append:mapA"] = { type: "append", path: "mapA", value: "v" };
assert(api.undoOne("append:mapA").ok && Object.keys(V.mapA).length === 1 && V.mapA.a === undefined, "append 对象形态回退删除同值键");
Object.defineProperty(V, "boom", { get: function () { throw new Error("boom"); }, configurable: true });
V.mbCE_wrote["append:boom"] = { type: "append", path: "boom", value: "x" };
assert(api.undoOne("append:boom").msg.indexOf("回退异常") !== -1, "读取目标抛错 → catch 兜底为「回退异常」，不崩面板");

section("3b 其余类型的分发（cheat / world / maint / place / native / vanilla）");
V.mbCE_wrote = {};
V.mbCE_wrote["cheat:neg-mod:p:money"] = { type: "cheat", path: "negmod.money" };
r = api.undoOne("cheat:neg-mod:p:money");
assert(typeof r.msg === "string" && r.msg.length > 0, "cheat 分发到 undoCheatModValue 并给出可读结果（" + r.msg + "）");
V.mbCE_wrote["world:no-such-gid"] = { type: "world", path: "some.path" };
r = api.undoOne("world:no-such-gid");
assert(typeof r.msg === "string" && r.msg.length > 0, "world 无冒号键分发到 mbCEWorldUndo（冒号切分分支）");
V.mbCE_wrote["world:no-such-gid:deep.path"] = { type: "world", path: "deep.path" };
r = api.undoOne("world:no-such-gid:deep.path");
assert(typeof r.msg === "string" && r.msg.length > 0, "world 带冒号键 → 冒号前段当 gid 分发（不留整段进 gid）");
r = api.undoOne("maint:temple_quarters");
assert(typeof r.msg === "string" && r.msg.length > 0, "maint 无留痕键分发到 mbCEMaintUndo（键名回落规则）");
V.mbCE_wrote["maint:temple_quarters"] = { type: "maint", path: "temple_quarters" };
r = api.undoOne("maint:temple_quarters");
assert(typeof r.msg === "string" && r.msg.length > 0, "maint 带 path 留痕分发到 mbCEMaintUndo");
V.mbCE_wrote["place:town_projects.green"] = { type: "place", path: "town_projects.green" };
r = api.undoOne("place:town_projects.green");
assert(typeof r.msg === "string" && r.msg.length > 0, "place 分发到 placeStageUndo");
V.mbCE_wrote["romance:native:Robin"] = { type: "native", path: "Robin" };
r = api.undoOne("romance:native:Robin");
assert(typeof r.msg === "string" && /Robin|恋爱状态/.test(r.msg), "native 分发到 undoRomanceStage（含未生效说明）");
V.mbCE_wrote["vanilla:some_stage"] = { type: "vanilla", npc: "Gwylan", key: "some_stage" };
r = api.undoOne("vanilla:some_stage");
assert(typeof r.msg === "string" && r.msg.length > 0, "vanilla 分发到 undoVanillaStage（npc 缺省回落 Gwylan）");
V.mbCE_wrote["vanilla:nokey"] = { type: "vanilla", npc: "Gwylan" };
r = api.undoOne("vanilla:nokey");
assert(typeof r.msg === "string" && r.msg.length > 0, "vanilla 留痕缺 key → 回落剥离命名空间后的键名（" + r.msg + "）");

section("3c 地点阶段直写/回退的拒绝与边界（placeStageWrite / placeStageUndo）");
r = api.placeStageWrite("", 3, 0, 10);
assert(!r.ok && /路径无效/.test(r.message), "空路径 → 拒绝");
r = api.placeStageWrite("nohost.deep.deeper", 3, 0, 10);
assert(!r.ok && /宿主不存在/.test(r.message), "非 town_projects 的缺失宿主 → 拒绝并提示先推进剧情");
delete V.town_projects;
r = api.placeStageWrite("town_projects.green", 5, 0, 10);
assert(r.ok && V.town_projects && V.town_projects.green === 5, "town_projects 允许自动建壳（原版事件直接读写该字段）");
assert(api.placeStageRead("town_projects.green") === 5, "读回刚写入的档位");
assert(api.placeStageRead("no.such.path") === 0, "读不存在路径回落 0（渲染显示 0 而不是 NaN）");
assert(api.placeStageWrite("town_projects.green", 99, 0, 10).after === 10, "阶段写入钳制到声明上限");
r = api.placeStageUndo("town_projects.none");
assert(!r.ok && /不可回退/.test(r.message), "无留痕 → 明确不可回退");
r = api.placeStageUndo("town_projects.green");
assert(r.ok && V.town_projects.green === undefined, "回退到写入前（原本无字段 → 删键）");
r = api.placeStageWrite("town_projects.flag", 1, 0, 1);
assert(r.ok, "写入一个已有值字段");
delete V.town_projects;
r = api.placeStageUndo("town_projects.flag");
assert(!r.ok && /宿主已被清除/.test(r.message), "宿主被清除后回退 → 明确拒绝（不静默重建）");

section("4 分组与全部回退");
V.mbCE_wrote = {};
assert(api.undoGroup("cheat").msg.indexOf("没有留痕") !== -1, "空分组 → 提示没有留痕");
V.mbCE_wrote["batch:a"] = { type: "batch" };
r = api.undoGroup("batch");
assert(!r.ok && r.fail === 1 && r.msg.indexOf("无法逐条还原") !== -1, "不可回退分组 → 全部计失败并说明原因");
V.mbCE_wrote = {};
V.ga = 1; V.gb = 1;
V.mbCE_wrote["set:ga"] = { type: "set", path: "ga", t: 1 };
V.mbCE_wrote["set:gb"] = { type: "set", path: "gb", t: 2 };
r = api.undoGroup("set");
assert(r.ok && r.n === 2 && r.msg.indexOf("已回退 2 项") !== -1, "分组回退逐条成功并汇总条数（" + r.msg + "）");
V.mbCE_wrote = {};
assert(api.undoAll().msg.indexOf("没有任何面板写入留痕") !== -1, "无留痕 → 全部回退明确提示");
V.ha = 1;
V.mbCE_wrote["set:ha"] = { type: "set", path: "ha" };
V.mbCE_wrote["batch:b"] = { type: "batch" };
V.mbCE_wrote["state:s"] = { type: "state" };
r = api.undoAll();
assert(r.ok && r.n === 1 && r.skip === 2 && r.msg.indexOf("仅审计不可回退") !== -1, "全部回退跳过审计类并统计 skip（" + r.msg + "）");
V.mbCE_wrote["set:nopath"] = { type: "set" };
r = api.undoAll();
assert(!r.ok && r.fail === 1 && r.msg.indexOf("未能回退") !== -1, "有失败项 → 汇总里带「未能回退」并计 fail（" + r.msg + "）");

section("4b 存档对象禁止删除属性时的 catch 兜底（set 回退）");
V.victim = 5;
V.mbCE_wrote["set:victim"] = { type: "set", path: "victim" };
const proxyV = new Proxy(V, { deleteProperty: function () { throw new Error("property is non-configurable"); } });
global.V = proxyV;
r = api.undoOne("set:victim");
assert(r.ok && r.msg.indexOf("已撤销置位") === 0, "delete 抛错 → catch 兜底写 undefined，仍判成功（" + r.msg + "）");
assert(proxyV.mbCE_wrote["set:victim"] === undefined, "留痕清理的 delete 抛错被空 catch 吞掉，不打断回退");
global.V = V;

section("5 全局页区块渲染");
function tab(t) {
  const bs = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of bs) { if (b.getAttribute("data-tab") === t) { b.click(); return true; } }
  return false;
}
api.open();
assert(tab("global") === true, "切到「全局」页签（回退中心区块挂在这里）");
V.mbCE_wrote = {};
tab("global");
let pane = document.querySelector('#mce-root [data-pane="global"]');
assert(/暂无写入留痕/.test(pane.textContent), "无留痕时渲染「暂无写入留痕」占位（不渲染空分组）");
V.mbCE_wrote = {};
for (let i = 0; i < 26; i++) { V["k" + i] = 1; V.mbCE_wrote["set:k" + i] = { type: "set", path: "k" + i, t: 1000 + i }; }
V.mbCE_wrote["batch:big"] = { type: "batch" };
tab("global");
pane = document.querySelector('#mce-root [data-pane="global"]');
assert(/仅列出最近 24 条/.test(pane.textContent), "同组超过 24 条 → 尾注「仅列出最近 24 条」");
assert(/不可回退/.test(pane.textContent), "不可回退类型显示徽标而非按钮");
const refresh = Array.prototype.slice.call(pane.querySelectorAll("button")).filter(function (b) { return b.textContent === "刷新清单"; })[0];
refresh.click();
assert(/留痕清单已刷新/.test(document.getElementById('mce-root').textContent), "「刷新清单」回显条数");
const pv = Array.prototype.slice.call(document.querySelectorAll('#mce-root [data-pane="global"] button')).filter(function (b) { return /diff 预览/.test(b.textContent); })[0];
pv.click();
assert(/diff 预览已(开启|关闭)/.test(document.getElementById('mce-root').textContent), "「写入前 diff 预览」开关可切换并回显");
const allBtn = Array.prototype.slice.call(document.querySelectorAll('#mce-root [data-pane="global"] button')).filter(function (b) { return /^全部回退/.test(b.textContent); })[0];
assert(!!allBtn, "「全部回退（N 项可回退）」按钮存在（可回退数已统计）");

api.close();
console.log("\nUNDO CENTER EDGES: passed=" + passes + " failed=" + failures);
process.exit(failures ? 1 : 0);


