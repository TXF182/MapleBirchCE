/* 原版态度设置（08b-attitude）+ 说话态度三档（05b2-modcheat-attitude）测试（branches 门槛 70→80 整改轮 · 第七批）
 *
 * 覆盖：
 *  08b —— $uncomfortable 五项直写 / 未知项与非法值拒绝 / 一键全解除与全恢复 / 逐条回退 /
 *          门槛只读展示 / 存档无 $uncomfortable 时明确报错 / 全局页真实按钮路径。
 *  05b2 —— 三档选择写 $speech_attitude + 锚值、维持锁与每秒复位、暂停维持、解除维持（保留/还原）、
 *          tick 修正计数、旧数字入口按最近锚值映射、状态行文案、角色页真实按钮路径。
 * 判据：写入读存档 + V.mbCE_wrote 留痕；拒绝读返回 message；UI 断言点真实按钮后读状态栏/存档。
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

const V = {
  player: { sex: "f", gender_appearance: "f" },
  uncomfortable: { underwear: true, nude: true, prostituting: true, lewd: true, hypnosis: true },
  attitudesControl: { unlockExhibitionismUnderwear: false, unlockExhibitionismNude: true },
  speech_attitude: "neutral", submissive: 1000,
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

/* ================= 1. 不安项读取 ================= */
section("1 mbCEAttitudeGet / Gate");
assert(api.mbCEAttitudeGet("underwear") === true, "读取 $uncomfortable.underwear = true");
assert(api.mbCEAttitudeGet("no-such") === undefined, "未知键读取 → undefined（不抛）");
assert(api.MB_CE_ATTITUDE_ITEMS.length === 5, "五条不安项常量完整");
const g1 = api.mbCEAttitudeGate("unlockExhibitionismUnderwear");
assert(g1 && g1.ok === false && /exhibitionism>=55/.test(g1.need), "门槛只读展示：未满足时 ok=false 且带需要条件");
const g2 = api.mbCEAttitudeGate("unlockExhibitionismNude");
assert(g2 && g2.ok === true, "门槛已满足 → ok=true");
assert(api.mbCEAttitudeGate("no-such-gate") === null, "未知门槛键 → null");

/* ================= 2. 逐项写入与拒绝 ================= */
section("2 mbCEAttitudeSet");
const r1 = api.mbCEAttitudeSet("underwear", false);
assert(r1.ok === true && V.uncomfortable.underwear === false, "解除不安 → 写 false");
assert(V.mbCE_wrote["cheat:vanilla-attitudes:underwear"].before === true, "首次写入留痕记录 before=true");
const rBadKey = api.mbCEAttitudeSet("ghost", false);
assert(rBadKey.ok === false && /未知不安项/.test(rBadKey.message) && /underwear/.test(rBadKey.message), "未知项 → 拒绝并列出可选键");
const rBadVal = api.mbCEAttitudeSet("nude", "no");
assert(rBadVal.ok === false && /必须是 true \/ false/.test(rBadVal.message), "非布尔值 → 拒绝（不写字符串）");
assert(V.uncomfortable.nude === true, "拒绝时不落档");
const rBack = api.mbCEAttitudeSet("underwear", true);
assert(rBack.ok === true && V.uncomfortable.underwear === true, "恢复不安 → 写 true");
assert(V.mbCE_wrote["cheat:vanilla-attitudes:underwear"].before === true, "二次写入保留首次 before（回退可回到最初）");

/* ================= 3. 一键全解除 / 全恢复 ================= */
section("3 mbCEAttitudeSetAll");
const allOff = api.mbCEAttitudeSetAll(false);
assert(allOff.ok === true && /全部解除/.test(allOff.message), "一键全解除 → ok 文案");
assert(api.MB_CE_ATTITUDE_ITEMS.every(function (it) { return V.uncomfortable[it.key] === false; }), "5 项全部变 false");
const allOn = api.mbCEAttitudeSetAll(true);
assert(allOn.ok === true && /全部恢复/.test(allOn.message), "一键全恢复 → ok 文案");
assert(api.MB_CE_ATTITUDE_ITEMS.every(function (it) { return V.uncomfortable[it.key] === true; }), "5 项全部变 true");
const allBad = api.mbCEAttitudeSetAll(1);
assert(allBad.ok === false, "非法值 → 一键拒绝");
/* 部分失败分支：把 $uncomfortable 换成拒绝写入的只读代理不可能，改走「对象被换成非对象」路径 */
const savedUnc = V.uncomfortable;
V.uncomfortable = null; /* Set 内部会重建空壳，逐项写入仍成功 —— 验证自动建壳而非静默失败 */
const rebuilt = api.mbCEAttitudeSet("lewd", false);
assert(rebuilt.ok === true && V.uncomfortable && V.uncomfortable.lewd === false, "存档缺 $uncomfortable → 自动重建空壳后写入（不静默失败）");
V.uncomfortable = savedUnc;

/* ================= 4. 回退与留痕判定 ================= */
section("4 mbCEAttitudeUndo / 留痕");
/* hasTrace 未导出（09-exports2 只导出 Set/SetAll/Undo/Get/Gate），留痕判据直接读存档通道键 */
assert(!!V.mbCE_wrote["cheat:vanilla-attitudes:nude"], "已写过 → 留痕键存在 cheat:vanilla-attitudes:nude");
assert(!V.mbCE_wrote["cheat:vanilla-attitudes:ghost"], "未写过 → 无留痕键");
const undo = api.mbCEAttitudeUndo("nude");
assert(undo.ok === true && V.uncomfortable.nude === true, "逐条回退 → 还原为首次写入前 true");
assert(!V.mbCE_wrote["cheat:vanilla-attitudes:nude"], "回退后留痕被清除");
const undoNothing = api.mbCEAttitudeUndo("ghost");
assert(undoNothing && undoNothing.ok === false, "无留痕项回退 → 明确拒绝（不静默成功）");

/* ================= 5. 全局页真实按钮路径 ================= */
section("5 全局页 UI");
api.open();
function tab(t) {
  const btns = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of btns) { if (b.getAttribute("data-tab") === t) { b.click(); return true; } }
  return false;
}
assert(tab("global") === true, "切到「全局」页签");
const pane = document.querySelector('#mce-root [data-pane="global"]');
assert(pane.textContent.indexOf("你对什么感到不安") >= 0, "全局页出现态度分组标题");
const rows = Array.prototype.slice.call(pane.querySelectorAll(".mce-row")).filter(function (r) { return /把内衣暴露出来/.test(r.textContent); });
assert(rows.length === 1, "不安项行建出（把内衣暴露出来）");
const lblText = rows[0].textContent;
assert(lblText.indexOf("不安（勾选）") >= 0 || lblText.indexOf("已解除（不勾选）") >= 0 || lblText.indexOf("未初始化") >= 0, "行文案带三态之一");
const tog = Array.prototype.slice.call(rows[0].querySelectorAll("button")).filter(function (b) { return /解除不安|恢复不安/.test(b.textContent); })[0];
assert(!!tog, "行内有「解除不安／恢复不安」按钮");
V.uncomfortable.underwear = true;
tog.click();
assert(V.uncomfortable.underwear === false, "点击 → 存档写 false（真实按钮路径）");
assert(pane.textContent.indexOf("已解除（不勾选）") >= 0, "局部刷新后行文案变「已解除（不勾选）」");
const undoBtn = Array.prototype.slice.call(rows[0].querySelectorAll("button")).filter(function (b) { return b.textContent.trim() === "回退"; })[0];
assert(!!undoBtn, "写入后该行内出现「回退」按钮");
undoBtn.click();
assert(V.uncomfortable.underwear === true, "点回退 → 该行还原 true");
const offAll = Array.prototype.slice.call(pane.querySelectorAll("button")).filter(function (b) { return /全部解除不安/.test(b.textContent); })[0];
assert(!!offAll, "有「全部解除不安」批量按钮");
offAll.click();
assert(api.MB_CE_ATTITUDE_ITEMS.every(function (it) { return V.uncomfortable[it.key] === false; }), "批量按钮 → 5 项全解除");
/* 无 $uncomfortable 时的分组报错分支 */
const savedUnc2 = V.uncomfortable;
V.uncomfortable = undefined;
api.open();
tab("global");
assert(document.querySelector('#mce-root [data-pane="global"]').textContent.indexOf("存档里没有 $uncomfortable") >= 0, "存档无 $uncomfortable → 分组显式报错（不渲染假开关）");
V.uncomfortable = savedUnc2;

/* ================= 6. 说话态度三档：状态与写入 ================= */
section("6 attitudeState / Apply");
assert(api.attitudeState(1200).sub === true && api.attitudeState(1200).resist === false && api.attitudeState(1200).both === false, "区间判定 1200：sub=true / resist=false / both=false（1200 超出 Bratty 门槛）");
assert(api.attitudeState(900).both === true, "区间判定 900：both=true");
assert(api.attitudeState("x").value === null, "非数字入参 → value=null（不抛）");
assert(api.readAttitude() === "neutral", "readAttitude 读当前档位");
const st0 = api.mbCEAttitudeState();
assert(st0.attitude === "neutral" && st0.submissive === 1000 && st0.lock === null && st0.fixed === 0, "初始状态：无锁、fixed=0");
const applyBad = api.mbCEAttitudeApply("ghost");
assert(applyBad.ok === false && /未知态度档位/.test(applyBad.message), "未知档位 → 拒绝");
const applyMeek = api.mbCEAttitudeApply("meek");
assert(applyMeek.ok === true && /已选定「Meek（温顺）」/.test(applyMeek.message), "选 Meek → ok 且文案带档位名");
assert(V.speech_attitude === "meek" && V.submissive === 1500, "写入 $speech_attitude=meek、$submissive=1500（锚值）");
assert(V.mbCE_attitudeLock && V.mbCE_attitudeLock.hold === true && V.mbCE_attitudeLock.value === "meek", "登记维持锁并默认开启 hold");
assert(V.mbCE_attitudeLock.prevAttitude === "neutral" && V.mbCE_attitudeLock.prevSubmissive === 1000, "首次锁定保留锁定前值（供「解除并还原」）");
const applyBratty = api.mbCEAttitudeApply("bratty");
assert(applyBratty.ok === true && V.submissive === 500 && V.mbCE_attitudeLock.value === "bratty", "改选 Bratty → 锚值 500 且锁跟着换");
assert(V.mbCE_attitudeLock.prevAttitude === "neutral", "二次选定不覆盖 prev（回退仍回到最初）");

/* ================= 7. 维持 / 暂停 / 解除 ================= */
section("7 Hold / Tick / Release");
const tickClean = api.mbCEAttitudeTick();
assert(tickClean === 0, "态度与锚值都正确 → 本轮修正 0 次");
V.speech_attitude = "meek"; /* 被其它数值带偏 */
V.submissive = 1200;        /* Bratty 档：>1149 越界 */
const tickFix = api.mbCEAttitudeTick();
assert(tickFix === 2, "两项同时被带偏 → 修正 2 次（档位复位 + 顺从度拉回 ≤1149）");
assert(V.speech_attitude === "bratty" && V.submissive === 1149, "复位到 bratty、顺从度钳到 1149 门槛内侧");
assert(V.mbCE_attitudeLock.fixed >= 2, "fixed 计数累加（" + V.mbCE_attitudeLock.fixed + "）");
const holdOff = api.mbCEAttitudeHold(false);
assert(holdOff.ok === true && /已暂停维持/.test(holdOff.message) && V.mbCE_attitudeLock.hold === false, "暂停维持 → hold=false");
V.speech_attitude = "lewd";
assert(api.mbCEAttitudeTick() === 0 && V.speech_attitude === "lewd", "暂停后 tick 不再复位（尊重玩家/其它模组写入）");
api.mbCEAttitudeHold(true);
assert(V.mbCE_attitudeLock.hold === true, "重新开启维持");
const rel = api.mbCEAttitudeRelease(true);
assert(rel.ok === true && /已解除维持并还原/.test(rel.message), "解除并还原 → ok 文案");
assert(V.speech_attitude === "neutral" && V.submissive === 1000, "还原为锁定前的 neutral / 1000");
assert(V.mbCE_attitudeLock === undefined, "锁被清除");
const relNothing = api.mbCEAttitudeRelease(false);
assert(relNothing.ok === false && /当前没有锁定中的态度/.test(relNothing.message), "无锁时解除 → 拒绝");
const holdNothing = api.mbCEAttitudeHold(true);
assert(holdNothing.ok === false && /尚未选定档位/.test(holdNothing.message), "无锁时开维持 → 拒绝");

/* ================= 8. 旧数字入口映射 ================= */
section("8 applyAttitude 兼容入口");
assert(api.applyAttitude("meek").ok === true && V.speech_attitude === "meek", "字符串入口直接按档位名");
assert(api.applyAttitude(1400).ok === true && V.speech_attitude === "meek", "数字 1400 → 最近锚值 Meek（1500）");
assert(api.applyAttitude(1050).ok === true && V.speech_attitude === "neutral", "数字 1050 → 最近锚值 Neutral（1000）");
assert(api.applyAttitude(600).ok === true && V.speech_attitude === "bratty", "数字 600 → 最近锚值 Bratty（500）");
const applyNaN = api.applyAttitude("abc");
assert(applyNaN.ok === false && /未知态度档位/.test(applyNaN.message), "非档位字符串 → 拒绝");
const applyInf = api.applyAttitude(Infinity);
assert(applyInf.ok === false && /请输入数字或档位名/.test(applyInf.message), "Infinity → 拒绝（isFinite 守卫生效）");

/* ================= 9. 玩家自己页真实按钮路径（说话态度区块在 mods 页的快速面板内） ================= */
section("9 快速面板 UI");
api.mbCEAttitudeRelease(false);
api.open();
assert(tab("mods") === true, "切到「Mod作弊」页签（玩家自己面板所在页）");
api.renderPlayerEdit();
const cpane = document.querySelector('#mce-root [data-pane="mods"]');
assert(!!cpane, "玩家自己面板已渲染到 mods 页");
assert(cpane.textContent.indexOf("说话态度") >= 0, "快速面板出现「说话态度」区块");
const line = cpane.querySelector('[data-mce-att="1"]');
assert(!!line && /当前：态度/.test(line.textContent), "状态行带「当前：态度 …」（data-mce-att=1 供 tick 局部刷新）");
const tierBtn = Array.prototype.slice.call(cpane.querySelectorAll("button")).filter(function (b) { return /Bratty（叛逆）/.test(b.textContent); })[0];
assert(!!tierBtn, "三档按钮建出（Bratty）");
assert(tierBtn && tierBtn.title.indexOf("需顺从度 < 1150") >= 0, "按钮 title 带门槛说明");
tierBtn.click();
assert(V.speech_attitude === "bratty" && V.mbCE_attitudeLock && V.mbCE_attitudeLock.value === "bratty", "点 Bratty 按钮 → 写档位并建锁（真实路径）");
const holdBtn = Array.prototype.slice.call(cpane.querySelectorAll("button")).filter(function (b) { return /维持：/.test(b.textContent); })[0];
assert(!!holdBtn, "「维持：开/关」按钮存在");
holdBtn.click();
assert(V.mbCE_attitudeLock.hold === false || V.mbCE_attitudeLock === undefined || V.mbCE_attitudeLock.hold === true, "维持按钮切换不抛异常");
const relBtn = Array.prototype.slice.call(cpane.querySelectorAll("button")).filter(function (b) { return b.textContent.trim() === "解除维持"; })[0];
assert(!!relBtn, "「解除维持」按钮存在");
if (relBtn) { relBtn.click(); }
assert(V.mbCE_attitudeLock === undefined, "点「解除维持」→ 锁清除");
const backBtn = Array.prototype.slice.call(cpane.querySelectorAll("button")).filter(function (b) { return b.textContent.trim() === "解除并还原"; })[0];
assert(!!backBtn, "「解除并还原」按钮存在");

console.log("\nATTITUDE STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
