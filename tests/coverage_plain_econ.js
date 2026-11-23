/* 原版经济/学业/农田/消耗品/纹身（07m）plain 拒绝侧补测 — 覆盖率提升轮
 *
 * vanilla_econ_state.js 已覆盖正常路径 + 四类拒绝（负数/非数字/未知键/宿主缺失），
 * 本测试专打 report_branch_gaps 归类的 plain 剩余欠账：幂等路径、非数组地块、无作物催熟、
 * 超限钳制、非纹身/已是纹身/无纹身三态、欠租非数字、学校出勤表未生成、缺科等。
 * 判据：只断言「返回体 ok/message + 存档实际值」，不 mock 执行器内部。
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
const V = { player: {}, passage: "Room", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = {
  foodstuff: { wheat: { tending: { growth_days: 10 } }, carrot: { tending: { growth_days: 6 } } },
  bodyparts: ["chest", "face", "feet", "leftarm", "rightarm", "neck", "thigh", "tummy"],
  bodywriting: {
    unicorn: { index: 70, writing: "unicorn", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    heart: { index: 71, writing: "heart", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    flower: { index: 72, writing: "flower", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    butterfly: { index: 73, writing: "butterfly", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    star: { index: 74, writing: "star", type: "object", arrow: 0, special: "none", gender: "f", lewd: 0, degree: 0 },
    skull: { index: 75, writing: "skull", type: "object", arrow: 0, special: "none", gender: "m", lewd: 0, degree: 0 },
    flame: { index: 76, writing: "flame", type: "object", arrow: 0, special: "none", gender: "m", lewd: 0, degree: 0 },
    cross: { index: 77, writing: "cross", type: "object", arrow: 0, special: "none", gender: "n", lewd: 0, degree: 0 },
    paw_print: { index: 78, writing: "paw print", type: "object", arrow: 0, special: "bestiality", gender: "n", lewd: 0, degree: 0 }
  }
};
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
try { eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/")); }
catch (e) { console.error("FAIL: 产物 eval 抛错 " + e.message); process.exit(1); }
const api = setup.mbStageCE;
if (!api) { console.error("FAIL: setup.mbStageCE 未挂载"); process.exit(1); }

try {
  /* ================= 1. 欠租金额非数字 ================= */
  section("1 欠租金额非数字");
  V.baileyRefusedToPayTotal = 500;
  V.mbCE_wrote = {};
  let r = api.vanillaEconRentDebt("abc");
  assert(r.ok === false && V.baileyRefusedToPayTotal === 500, "欠租非数字 → 拒绝且不写档");

  /* ================= 2. 学校出勤表未生成 / 幂等 / 缺科 ================= */
  section("2 出勤边界");
  delete V.daily;
  V.mbCE_wrote = {};
  r = api.vanillaEconAttend("maths", 1);
  assert(r.ok === false && /学校流程/.test(r.message), "出勤表未生成 → Attend 拒绝");
  r = api.vanillaEconAttendAll(1);
  assert(r.ok === false && /学校流程/.test(r.message), "出勤表未生成 → AttendAll 拒绝");
  V.daily = { school: { attended: { maths: 1 } } };
  V.mbCE_wrote = {};
  r = api.vanillaEconAttend("maths", 1);
  assert(r.ok === true && /已经是该状态/.test(r.message), "同值幂等 → 不重复写入");
  assert(V.daily.school.attended.maths === 1, "幂等后值不变");
  /* 缺科：att 只有 maths，其余五科 hasOwnProperty 短路跳过，最后 n=0 走整体幂等 */
  r = api.vanillaEconAttendAll(1);
  assert(r.ok === true && /已是该状态/.test(r.message), "缺科 + 已有科同值 → 整体幂等（不造缺失科目）");
  assert(!("science" in V.daily.school.attended), "缺失科目不被顺手创建");

  /* ================= 3. 旷课已全 0 幂等 ================= */
  section("3 旷课幂等");
  V.daily = { school: { attended: { maths: 1 } } };
  V.schoolLessonsMissed = { science: 0, maths: 0, english: 0, history: 0, swimming: 0, housekeeping: 0 };
  V.mbCE_wrote = {};
  r = api.vanillaEconMissedClear();
  assert(r.ok === true && /已经是 0/.test(r.message), "旷课已全 0 → 幂等不重复写");
  assert(!V.mbCE_wrote["vcore:school"], "幂等不落留痕");

  /* ================= 4. 农田无作物 / 空 plant / 非数组地块 ================= */
  section("4 农田拒绝侧");
  V.plots = { garden: [{ stage: 0, days: 0 }, { plant: "ghostcrop", stage: 1, days: 1 }] };
  V.mbCE_wrote = {};
  r = api.vanillaEconRipen("garden");
  assert(r.ok === false && /没有可催熟/.test(r.message), "空格 + 未知作物 → 催熟拒绝");
  /* stage>=1 但无 plant 键：CropOk(!plant) 拦截，tendingDay 不会崩 */
  V.plots = { garden: [{ stage: 2, days: 0 }] };
  r = api.vanillaEconRipen("garden");
  assert(r.ok === false && V.plots.garden[0].stage === 2, "有 stage 无 plant → 拒绝且 stage 不动");
  /* plots 里混入非数组键：RipenAll 跳过非数组，正常数组照常催熟 */
  V.plots = { garden: "not-an-array", farm: [{ plant: "carrot", stage: 1, days: 0 }] };
  V.mbCE_wrote = {};
  r = api.vanillaEconRipenAll();
  assert(r.ok === true && V.plots.farm[0].stage === 5, "混入非数组键 → 跳过它并催熟正常地块");
  /* 全无作物 → RipenAll 拒绝 */
  V.plots = { garden: [{ stage: 0, days: 0 }] };
  r = api.vanillaEconRipenAll();
  assert(r.ok === false && /没有任何可催熟/.test(r.message), "全无作物 → 整块催熟拒绝");

  /* ================= 5. 避孕套追加非数字 / 超限钳制 ================= */
  section("5 避孕套追加边界");
  V.condoms = 30;
  V.mbCE_wrote = {};
  r = api.vanillaEconCondomsAdd("abc");
  assert(r.ok === false && V.condoms === 30, "追加非数字 → 拒绝");
  V.condoms = 999;
  r = api.vanillaEconCondomsAdd(10);
  assert(r.ok === true && V.condoms === 999, "999 + 10 → 钳制在 999 不越界");

  /* ================= 6. 纹身三态（非纹身 / 已是纹身 / 无纹身） ================= */
  section("6 纹身三态");
  V.skin = { face: { show: 1 }, left_cheek: { type: "text", pen: "tattoo", writing: "★" } };
  V.mbCE_wrote = {};
  r = api.vanillaEconTattooClear("face");
  assert(r.ok === false && /没有纹身/.test(r.message), "非纹身部位 → 清除拒绝");
  assert(V.skin.face.show === 1, "非纹身部位不动");
  r = api.vanillaEconTattooMark("left_cheek");
  assert(r.ok === false && /已经是纹身/.test(r.message), "已是纹身 → 标记拒绝");
  delete V.skin.left_cheek;
  r = api.vanillaEconTattooClearAll();
  assert(r.ok === false && /没有任何纹身/.test(r.message), "当前无纹身 → 一键清除拒绝");

  console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
  process.exit(failures ? 1 : 0);
} catch (e) {
  failures++; console.error("FAIL: 未捕获异常 " + (e && e.stack ? e.stack : e));
  process.exit(1);
}
