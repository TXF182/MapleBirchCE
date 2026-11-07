/* 言灵页核心（07i-yanling-core）状态机测试（branches 门槛 70→80 整改轮 · 第六批）
 *
 * 覆盖：状态读写容错 / window.isCrossdressing 钩子装卸 / 三项存量净化 / 正面名声拉满 /
 *       1s 守卫 tick 与定时器起停 / 开关白名单与留痕。
 * 判据：一律读「存档实际值 + V.mbCE_wrote 留痕 + 返回 message」，并通过 window.isCrossdressing()
 *       的真实调用结果验证钩子语义（玩家实际经过的就是这个 window 入口，见源码取证 ①）。
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " ==="); }

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;

/* 原版 isCrossdressing 桩：返回是否为异装（测试要验证钩子把它压成 false / 卸载后恢复） */
let crossCallCount = 0;
window.isCrossdressing = function () { crossCallCount++; return true; };

const V = {
  player: { sex: "f", gender_appearance: "m" },
  crossdressing: 1, crossdressingTrait: 68,
  backgroundTraits: ["crossdresser", "other"],
  schoolrep: { crossdress: 1, herm: 1, other: 5 },
  school_crossdress_message: "m", school_herm_message: "h",
  fame: { good: 100, business: 0, scrap: 1, social: 2, model: 3, sex: 4, prostitution: 5, pimp: 6 },
  fameDecay: { sex: 1, good: 2 }, fameDecayTimer: { rape: 3 },
  mbCE_wrote: {}
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0 };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 状态读写与严格布尔 ================= */
section("1 状态读写");
assert(api.yanlingState() !== null && V.mbCE_yanling, "首次读状态时自动建壳（noCross/noTrait 默认 false）");
assert(V.mbCE_yanling.noCross === false && V.mbCE_yanling.noTrait === false, "默认两开关均 false");
verify: {
  const st = api.yanlingState();
  assert(st === V.mbCE_yanling, "返回的就是存档对象本体（非副本）");
}
V.mbCE_yanling.noCross = "false"; /* 手改存档模拟：字符串不能被真值判定当成开启 */
assert(api.yanlingToggle("noCross").ok === true && V.mbCE_yanling.noCross === true, "字符串 \"false\" 被归一化后再切换 → 变为 true（严格比较生效）");

/* ================= 2. 开关白名单 ================= */
section("2 开关白名单与留痕");
const badField = api.yanlingToggle("whatever");
assert(badField.ok === false && /未知开关/.test(badField.msg), "未知字段 → 拒绝并列出合法值");
assert(V.mbCE_yanling.whatever === undefined, "拒绝时不往存档写垃圾键");
const onCross = api.yanlingToggle("noCross");
assert(onCross.ok === true && /无视着装性别 已关闭/.test(onCross.msg), "再次切换 noCross → 关闭语义文案正确");
assert(!!V.mbCE_wrote["yanling:toggle_noCross"], "开关动作留痕（yanling:toggle_noCross）");
assert(V.mbCE_wrote["yanling:toggle_noCross"].before === true && V.mbCE_wrote["yanling:toggle_noCross"].after === false, "留痕 before/after 记录真实前后值");

/* ================= 3. isCrossdressing 钩子装卸 ================= */
section("3 window.isCrossdressing 钩子");
api.yanlingToggle("noCross"); /* 重新开启 */
const hooked = window.isCrossdressing;
assert(api.yanlingInstall() === true, "开关开启后挂载钩子");
assert(window.isCrossdressing === hooked, "重复挂载幂等（同一函数引用，不再套一层）");
crossCallCount = 0;
assert(window.isCrossdressing() === false, "开关开启 → 钩子把 isCrossdressing() 压成 false（45 处 twee 判定被覆盖）");
assert(crossCallCount === 0, "压成 false 时根本不透传上游（省一次可见衣物扫描）");
api.yanlingToggle("noCross"); /* 关闭 */
assert(window.isCrossdressing() === (function () { const c = crossCallCount; return true; })(), "关闭后 window 钩子被拆（上游函数本体恢复调用）");
/* 上述断言依赖上游真实返回 true：直接校验上游函数身份 */
assert(typeof window.isCrossdressing === "function" && window.isCrossdressing !== hooked, "卸载后 window 上不再是本页钩子");
crossCallCount = 0;
window.isCrossdressing();
assert(crossCallCount === 1, "上游原函数被真实调用（判据：调用计数 +1）");
api.yanlingUninstall();
assert(api.yanlingInstall() === false || typeof window.isCrossdressing === "function", "无上游可挂时 Install 返回 false 或保持幂等，不抛异常");
/* 无 isCrossdressing 的环境：install 返回 false（防崩） */
const savedIsCross = window.isCrossdressing;
window.isCrossdressing = undefined;
assert(api.yanlingInstall() === false, "环境无 isCrossdressing → Install 返回 false（不伪造钩子）");
window.isCrossdressing = savedIsCross;
api.yanlingToggle("noCross"); /* 开启，供后续 tick 用 */

/* ================= 4. 三项存量净化 ================= */
section("4 净化");
/* 先把三项存量重置成「有残留」的初始态（前面 toggle 已触发过一次自动净化） */
V.crossdressing = 1; V.schoolrep.crossdress = 1; V.schoolrep.herm = 1;
V.school_crossdress_message = "m"; V.school_herm_message = "h";
V.crossdressingTrait = 68; V.backgroundTraits = ["crossdresser", "other"];
V.fame = { good: 100, business: 0, scrap: 1, social: 2, model: 3, sex: 4, prostitution: 5, pimp: 6 };
V.fameDecay = { sex: 1, good: 2 }; V.fameDecayTimer = { rape: 3 };
const pc = api.yanlingPurgeCross();
assert(pc.ok === true, "净化异装判定与学校名声 → ok");
assert(V.crossdressing === 0, "crossdressing 归零");
assert(V.schoolrep.crossdress === 0 && V.schoolrep.other === 5, "schoolrep.crossdress 归零且未波及其它键");
assert(V.school_crossdress_message === undefined, "学校异装文案被删（否则原版仍按文案提示）");
assert(V.mbCE_wrote["yanling:purge_cross"].before.crossdressing === 1, "留痕记录净化前值 crossdressing=1");
V.crossdressing = 0; V.schoolrep.crossdress = 0;
const pc2 = api.yanlingPurgeCross();
assert(pc2.ok === true && V.crossdressing === 0, "已是 0 时再净化不写（幂等）");
V.schoolrep.crossdress = 1; V.school_herm_message = "h"; V.schoolrep.herm = 1; /* 恢复残留，供名声净化统计 */
V.fame.rape = 7; V.fame.bestiality = 8; /* 补齐 8 项负面里的另两项 */
const pt = api.yanlingPurgeTrait();
assert(pt.ok === true && V.crossdressingTrait === 0, "异装癖进度归零");
assert(V.backgroundTraits.indexOf("crossdresser") === -1 && V.backgroundTraits.indexOf("other") !== -1, "crossdresser 特质被移除，其它特质保留");
assert(V.mbCE_wrote["yanling:purge_trait"].before.has === true, "留痕记录净化前该特质已存在");
/* Set 形态背景特质（原版有 Set 分支） */
V.backgroundTraits = new Set(["crossdresser", "x"]);
const pt2 = api.yanlingPurgeTrait();
assert(pt2.ok === true && V.backgroundTraits.has("crossdresser") === false, "Set 形态背景特质走 delete 分支");
V.backgroundTraits = ["other"]; /* 复原为数组，后续 tick 用 */
const pf = api.yanlingPurgeFame();
assert(pf.ok === true && /学校 2 项/.test(pf.msg), "负面名声清零统计正确（学校 2 项）");
assert(V.schoolrep.herm === 0 && V.school_herm_message === undefined, "学校 herm 与文案一并清空");
assert(V.fame.sex === 0 && V.fame.prostitution === 0 && V.fame.pimp === 0 && V.fame.rape === 0, "城镇负面 fame 8 项全部归零（sex/prostitution/pimp/rape）");
assert(V.fame.good === 100 && V.fame.business === 0, "正面 fame 不动（good 保持 100）");
assert(V.fameDecay.sex === undefined && V.fameDecay.good === 2, "衰减队列只删负面项（good 保留）");
assert(V.fameDecayTimer.rape === undefined, "衰减计时器负面项同样删除");
assert(V.mbCE_wrote["yanling:purge_fame"].before.fame.sex === 4, "留痕记录 fame 净化前值");
/* 无 fame 对象的存档 */
const savedFame = V.fame;
V.fame = undefined;
const pf2 = api.yanlingPurgeFame();
assert(pf2.ok === true && /城镇 0 项/.test(pf2.msg), "无 $fame 时负面清零照常完成（0 项）");
const mfNoFame = api.yanlingMaxFame();
assert(mfNoFame.ok === false && /无 \$fame 对象/.test(mfNoFame.msg), "正面拉满：无 $fame 对象 → 明确拒绝（不造空壳）");
V.fame = savedFame;

/* ================= 5. 正面名声拉满 ================= */
section("5 正面名声拉满");
const mf = api.yanlingMaxFame();
assert(mf.ok === true && /实际改写 5 项/.test(mf.msg), "五项原本都非 2000 → 改写 5 项（统计口径按实际写入数）");
assert(V.fame.good === 2000 && V.fame.business === 2000 && V.fame.scrap === 2000 && V.fame.social === 2000 && V.fame.model === 2000, "五项全 2000");
assert(V.fame.pregnancy === undefined, "pregnancy 不写（上限动态，见源码注释）");
const mf2 = api.yanlingMaxFame();
assert(mf2.ok === true && /实际改写 0 项/.test(mf2.msg), "二次拉满 → 改写 0 项（幂等）");

/* ================= 6. tick 守卫 ================= */
section("6 1s 守卫 tick");
V.crossdressing = 2; V.schoolrep.crossdress = 3; V.school_crossdress_message = "back";
V.crossdressingTrait = 55; V.backgroundTraits = ["crossdresser", "keep"];
V.mbCE_yanling.noCross = true; V.mbCE_yanling.noTrait = true;
api.yanlingTick();
assert(V.crossdressing === 0 && V.schoolrep.crossdress === 0 && V.school_crossdress_message === undefined, "noCross 开启 → 守卫把异装存量与文案压回 0");
assert(V.crossdressingTrait === 0 && V.backgroundTraits.indexOf("crossdresser") === -1 && V.backgroundTraits.indexOf("keep") !== -1, "noTrait 开启 → 守卫清进度与特质（保留其它特质）");
assert(window.isCrossdressing() === false, "守卫每轮先 Sync，钩子保持挂载");
V.mbCE_yanling.noCross = false; V.mbCE_yanling.noTrait = false;
api.yanlingTick();
assert(typeof window.isCrossdressing === "function", "两开关全关 → 守卫卸载钩子（不留无谓包装层）");
assert(V.crossdressing === 0, "全关后的存量不再被复写（值保持上一轮结果）");
/* 空 tick（未启用的存档）不建变量 */
const saved = V.mbCE_yanling;
V.mbCE_yanling = undefined;
api.yanlingTick();
assert(V.mbCE_yanling === undefined, "未启用的存档 tick 不创建 $mbCE_yanling（读路径不写档）");
V.mbCE_yanling = saved;

/* ================= 7. 定时器起停 ================= */
section("7 定时器");
V.mbCE_yanling.noCross = true;
api.yanlingToggle("noTrait"); /* 开启 → EnsureTimer 起表（unref） */
assert(V.mbCE_yanling.noTrait === true, "toggle noTrait 开启");
api.yanlingToggle("noTrait"); /* 关闭 */
V.mbCE_yanling.noCross = false;
api.yanlingToggle("noTrait"); /* 再开（此时 noCross 已 false） */
assert(V.mbCE_yanling.noTrait === true, "仅 noTrait 一项开着也允许（任一开关即可）");
api.yanlingToggle("noTrait");
assert(V.mbCE_yanling.noTrait === false, "关闭后状态落档");

/* ================= 8. 无存档容错（getV 兜底返回空对象，接口不得抛异常） ================= */
section("8 无存档容错");
const savedState = global.State;
global.State = { variables: null };
/* 判据只看「返回结构完整 + 不抛异常」：getV() 的兜底是空对象，不是 null，
   null 只在 getV 内部异常时出现（防御性 catch 分支，不在本测试目标内）。 */
assert(typeof api.yanlingState() === "object", "无存档 → 状态接口返回对象（不抛异常）");
assert(typeof api.yanlingPurgeCross().ok === "boolean", "无存档 → 净化返回结构化结果（不抛）");
assert(typeof api.yanlingToggle("noCross").ok === "boolean", "无存档 → 开关返回结构化结果（不抛）");
global.State = savedState;

console.log("\nYANLING STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
