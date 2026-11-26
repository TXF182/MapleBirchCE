/* v2.2.8 艾弗里「保持受伤」测试（TDD 先行）
 *
 * 原版事实（DoL 0.5.12.13 单文件 HTML 实证）：
 *  · $avery_mansion.injury 全库 1 处读取、0 处写入（废弃键），每日结算 "if injury is true → avery_injury=true" 恒不触发。
 *  · 真正的伤 = avery_mansion.injury_timer（每日 -1）+ injury_stage 按 timer 分档重算：
 *      >50 sling / 16~49 cast / 1~15 healing / <=0 healed；version 4→5 迁移把 fresh → sling。
 *  · <<avery_injury_check>>：_avery_injured = stage in [sling, cast, healing]；受伤时 NPCList.righthand = "idle"。
 *  · $avery_injury（布尔）是日程总闸：办公室工作 / 工作邀请 / 学校接送 / 庄园 away 归家 / 派对 / 晚餐 / 约会 /
 *     红毯宴会 / 温泉 / 学校 drop-off / 街头初见 全部要求 !$avery_injury。
 * 覆盖：
 *  A 三档模式表（吊带 90 / 石膏 40 / 快好 10）
 *  B 开启：写 timer/stage + avery_injury=true + 保持标记 + 首快照
 *  C tick 冻结：每日 -1 与 stage 重算后被回写
 *  D 档位切换保留最初快照
 *  E 解除：原值还原（未定义键删除）
 *  F 无庄园：外观档拒绝、仅休养可开
 *  G 重复解除 / 未开启时解除的返回
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

const V = {
  player: {}, passage: "Room",
  NPCNameList: ["Avery"], NPCName: [{ nam: "Avery", init: 1, state: "active", love: 40, dom: 0, lust: 0 }],
  averySeen: ["office"], avery_mansion: { version: 5, schedule: "home", days: 3 }
};
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = { foodstuff: {}, bodyparts: [] };
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.averyInjuryHold === "function" && typeof api.averyInjuryOff === "function"
  && typeof api.averyInjuryHoldTick === "function" && typeof api.averyInjuryState === "function", "API 已导出（hold/off/tick/state）");

/* ================= A 模式表 ================= */
section("A 三档模式表");
const modes = api.averyInjuryModes();
assert(Array.isArray(modes) && modes.length === 3, "三档：吊带 / 石膏 / 快好");
const byKey = {};
modes.forEach(function (m) { byKey[m.key] = m; });
assert(byKey.sling && byKey.sling.timer === 90 && byKey.sling.stage === "sling", "吊带 = timer 90 / stage sling（>50 档）");
assert(byKey.cast && byKey.cast.timer === 40 && byKey.cast.stage === "cast", "石膏 = timer 40 / stage cast（16~49 档）");
assert(byKey.healing && byKey.healing.timer === 10 && byKey.healing.stage === "healing", "快好 = timer 10 / stage healing（1~15 档）");

/* ================= B 开启（吊带） ================= */
section("B 开启吊带");
let r = api.averyInjuryHold("sling");
assert(r.ok === true, "开启成功：" + r.message);
assert(V.avery_mansion.injury_timer === 90 && V.avery_mansion.injury_stage === "sling", "写入 timer 90 / stage sling");
assert(V.avery_injury === true, "avery_injury = true（休养：工作/接送/赴宴/约会全停）");
assert(V.mbCE_averyInjuryHold && V.mbCE_averyInjuryHold.mode === "sling", "保持标记 mode=sling");
assert(V.mbCE_averyInjuryHold.prev && V.mbCE_averyInjuryHold.prev.hasTimer === false, "首快照记录：开启前没有 injury_timer");
assert(V.mbCE_wrote && V.mbCE_wrote["vcore:avery-injury"], "留痕已写（vcore:avery-injury）");

/* ================= C tick 冻结 ================= */
section("C tick 冻结");
V.avery_mansion.injury_timer = 89;            /* 模拟每日结算 -1 */
V.avery_mansion.injury_stage = "cast";         /* 模拟按 89 重算仍 cast？89>50 应为 sling —— 这里故意写错档，验证 tick 拉回 */
api.averyInjuryHoldTick();
assert(V.avery_mansion.injury_timer === 90, "tick 把 timer 回写到 90");
assert(V.avery_mansion.injury_stage === "sling", "tick 把 stage 拉回 sling");
V.avery_injury = false;                        /* 模拟原版 Mansion Return Broken 链接清掉休养位 */
api.averyInjuryHoldTick();
assert(V.avery_injury === true, "tick 把 avery_injury 拉回 true");

/* ================= D 切档保留最初快照 ================= */
section("D 切档保留最初快照");
const prev0 = V.mbCE_averyInjuryHold.prev;
r = api.averyInjuryHold("cast");
assert(r.ok === true && V.avery_mansion.injury_timer === 40 && V.avery_mansion.injury_stage === "cast", "切到石膏：timer 40 / cast");
assert(V.mbCE_averyInjuryHold.prev && V.mbCE_averyInjuryHold.prev.hasTimer === false, "快照仍是最初（未被 90 覆盖）");
assert(V.mbCE_averyInjuryHold.prev === prev0, "快照对象引用未变");

/* ================= E 解除还原 ================= */
section("E 解除还原");
r = api.averyInjuryOff();
assert(r.ok === true, "解除成功：" + r.message);
assert(!("injury_timer" in V.avery_mansion) && !("injury_stage" in V.avery_mansion), "未定义键被删除（timer/stage）");
assert(!("avery_injury" in V), "avery_injury 原为未定义 → 删除");
assert(!V.mbCE_averyInjuryHold, "保持标记已清");

/* ================= F 无庄园 ================= */
section("F 无庄园");
delete V.avery_mansion;
r = api.averyInjuryHold("sling");
assert(r.ok === false && /庄园/.test(r.message), "无庄园时外观档拒绝并说明原因：" + r.message);
r = api.averyInjurySettleOnly();
assert(r.ok === true && V.avery_injury === true, "仅休养可开（无外观，只停日程）");
assert(!V.mbCE_averyInjuryHold.prev.hasMansion, "仅休养快照记录 hasMansion=false");
api.averyInjuryHoldTick();
assert(V.avery_injury === true, "仅休养 tick 维持 avery_injury");
r = api.averyInjuryOff();
assert(r.ok === true && !("avery_injury" in V), "仅休养解除后 avery_injury 删除");

/* ================= G 幂等 ================= */
section("G 幂等");
r = api.averyInjuryOff();
assert(r.ok === false && /没有保持/.test(r.message), "未开启时解除返回说明：" + r.message);
r = api.averyInjuryHold("bogus");
assert(r.ok === false && /档/.test(r.message), "非法档位拒绝：" + r.message);

/* ================= H 已知角色判定（UI 提示用） ================= */
section("H 已知角色判定");
const st = api.averyInjuryState();
assert(st && st.known === true, "averySeen 含 office → known=true");
assert(typeof st.mansion === "boolean" && st.mansion === false, "state 反映当前无庄园");
V.averySeen = [];
assert(api.averyInjuryState().known === false, "无 averySeen 记录 → known=false（UI 提示：未认识时不要开休养）");

console.log("\n== 汇总: " + passes + " PASS / " + failures + " FAIL ==");
process.exit(failures ? 1 : 0);
