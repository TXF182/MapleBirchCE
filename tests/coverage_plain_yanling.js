/* 言灵页「原帖 52 条」补丁（07i-yanling-quick）plain 拒绝侧补测 — 覆盖率提升轮
 *
 * yanling_quick_state.js 已覆盖正常写入 + 宿主缺失/未知条目/无人示众/怨灵缺失等拒绝，
 * 本测试专打 report_branch_gaps 归类的剩余 plain：时间戳缺失、Time.set 不可用、非法增量、
 * NPC 字段空/增量非数字、变量路径空、克隆 undefined 源、撤销时结构已变化（三种）、
 * 整页撤销含失败项、渲染容器为 null 的早退。
 * 判据：改数据表条目 / 删宿主结构后调 api，断言「不抛 + 明确拒绝」，测完还原全局状态。
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
window.isCrossdressing = function () { return false; };

const NAMES = [];
for (let i = 0; i < 30; i++) { NAMES.push("NPC" + i); }
NAMES[29] = "Ivory Wraith";
const NPCS = NAMES.map(n => ({ name: n, lust: 55 }));

const V = {
  player: { virginity: { vaginal: false, penile: false, anal: false, oral: false, handholding: false, kiss: false }, skin: { layers: [{ layers: ["tan"], slots: {}, value: 2 }] } },
  fame: { exhibitionism: 100, impreg: 200, sex: 300, prostitution: 400, rape: 500, bestiality: 600 },
  englishPlayReadiness: 12,
  pillory: { tenant: { exists: true, endTime: 1000 } },
  NPCName: NPCS, NPCNameList: NAMES, timeStamp: 1800, mbCE_wrote: {}
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0 };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };
const timeCalls = [];
global.Time = { date: { timeStamp: V.timeStamp }, set: function (ts) { timeCalls.push(ts); V.timeStamp = ts; Time.date.timeStamp = ts; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
try { eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

const Q = api.YANLING_QUICK;
const byId = function (id) { return Q.filter(function (e) { return e.id === id; })[0]; };

try {
  /* ================= 1. 时间戳缺失 / Time.set 不可用 / 非法增量 ================= */
  section("1 时间类拒绝");
  const tBack = byId("time_back_15m");
  const savedTs = V.timeStamp, savedTsDate = global.Time.date.timeStamp;
  delete V.timeStamp; global.Time.date.timeStamp = undefined;
  let r = api.yanlingQuickRun("time_back_15m");
  assert(r.ok === false && /时间戳不可用/.test(r.msg), "时间戳双源缺失 → 拒绝");
  V.timeStamp = savedTs; global.Time.date.timeStamp = savedTsDate;

  const savedSet = global.Time.set;
  global.Time.set = undefined;
  r = api.yanlingQuickRun("time_back_15m");
  assert(r.ok === false && /Time\.set 不可用/.test(r.msg), "Time.set 非函数 → 拒绝");
  global.Time.set = savedSet;

  const savedTVal = tBack.value;
  tBack.value = "abc";
  r = api.yanlingQuickRun("time_back_15m");
  assert(r.ok === false && /不是有效数字/.test(r.msg), "时间增量非数字 → 拒绝");
  tBack.value = savedTVal;

  /* ================= 2. NPC 字段空 / 增量非数字 ================= */
  section("2 NPC 类拒绝");
  const ivory = byId("misc_ivory");
  const savedField = ivory.field;
  ivory.field = "";
  r = api.yanlingQuickRun("misc_ivory");
  assert(r.ok === false && /字段名为空/.test(r.msg), "NPC 字段空 → 拒绝");
  ivory.field = savedField;

  const savedIVal = ivory.value;
  ivory.value = "abc";
  r = api.yanlingQuickRun("misc_ivory");
  assert(r.ok === false && /不是有效数字/.test(r.msg), "NPC 增量非数字 → 拒绝");
  ivory.value = savedIVal;

  /* ================= 3. 变量路径空 / 克隆 undefined 源 ================= */
  section("3 ops 边界");
  const virg = byId("virg_vaginal");
  const savedOps = virg.ops;
  virg.ops = [["", true]];
  r = api.yanlingQuickRun("virg_vaginal");
  assert(r.ok === false && /路径为空/.test(r.msg), "变量路径空 → 拒绝");
  /* 写入一个不存在的叶子键：before 为 undefined，走 Clone(undefined) 早退分支 */
  virg.ops = [["player.nonexistent_flag", true]];
  r = api.yanlingQuickRun("virg_vaginal");
  assert(r.ok === true && V.player.nonexistent_flag === true, "写缺失叶子键 → before undefined 克隆早退且写入成功");
  assert(api.yanlingQuickUndo("virg_vaginal").ok === true && !("nonexistent_flag" in V.player), "撤销删除该新建键");
  virg.ops = savedOps;

  /* ================= 4. 撤销时结构已变化（三种） ================= */
  section("4 撤销结构变化");
  V.pillory = { tenant: { exists: true, endTime: 1000 } };
  api.yanlingQuickRun("misc_pillory");
  delete V.pillory.tenant;
  r = api.yanlingQuickUndo("misc_pillory");
  assert(r.ok === false && /结构已变化/.test(r.msg), "撤销时 $pillory.tenant 缺失 → 拒绝");
  V.pillory = { tenant: { exists: true, endTime: 1000 } };

  api.yanlingQuickRun("misc_ivory");
  const savedNames = V.NPCNameList;
  V.NPCNameList = NAMES.filter(function (n) { return n !== "Ivory Wraith"; });
  r = api.yanlingQuickUndo("misc_ivory");
  assert(r.ok === false && /槽位缺失/.test(r.msg), "撤销时角色槽位缺失 → 拒绝");
  V.NPCNameList = savedNames;

  api.yanlingQuickRun("fame_exhibitionism");
  const savedFame = V.fame;
  delete V.fame;
  r = api.yanlingQuickUndo("fame_exhibitionism");
  assert(r.ok === false && /结构已变化/.test(r.msg), "撤销时中间宿主缺失 → 拒绝");
  V.fame = savedFame;

  /* ================= 5. 整页撤销含失败项 ================= */
  section("5 整页撤销失败项");
  V.mbCE_wrote = {};
  api.yanlingQuickRun("fame_exhibitionism");
  delete V.fame;
  r = api.yanlingQuickUndoTab(2);
  assert(r.ok === false && /失败/.test(r.msg), "整页撤销含失败项 → 返回失败并报告数量");
  V.fame = savedFame;
  V.mbCE_wrote = {};

  /* ================= 6. 渲染容器为 null 早退 ================= */
  section("6 渲染空容器");
  let threw = null;
  try { api.renderYanlingQuick(null); } catch (e) { threw = e; }
  assert(threw === null, "渲染容器 null → 早退不抛异常");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
