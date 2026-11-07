/* 角色页快速面板（05b-modcheat-player）真实交互测试（branches 70→80 整改轮 · 第十三批）
 * 玩家路径：角色页 → 各属性折叠组 → 应用 / 回退 / 锁定 / 获得 / 全部获得 / 预设模板。
 * 拒绝路径：锁定目标非数值、武器父级缺失自动补壳、非武器组不出现「获得」。
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
  player: {}, mbCE_wrote: {},
  stress: 10, money: 0, purity: 100, prof: undefined, fame: { sex: 5 }
};
global.V = V;
global.State = { variables: V, passage: "Room", temporary: {} };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

function rowByKey(k) { return document.querySelector('#mce-root [data-mce-key="quick:' + k + '"]'); }
function btnOf(row, text) {
  return Array.prototype.slice.call(row.querySelectorAll("button")).filter(function (b) { return b.textContent === text; })[0];
}
function groupHead(title) {
  const heads = document.querySelectorAll('#mce-root .mce-grp-t');
  for (const h of heads) { if (h.textContent.indexOf(title) !== -1) { return h; } }
  return null;
}

api.open();
api.renderPlayerEdit();

/* ================= 1. 分组折叠与行结构 ================= */
section("1 分组折叠");
const headSkill = groupHead("武器技能");
assert(!!headSkill, "武器技能分组存在");
const bodyOf = function (h) { return h.parentNode.querySelector(".mce-grp-body"); };
assert(bodyOf(headSkill).getAttribute("data-collapsed") === "1", "分组默认收起（data-collapsed=1）");
headSkill.click();
assert(bodyOf(headSkill).getAttribute("data-collapsed") === "0", "点组头展开");
headSkill.click();
assert(bodyOf(headSkill).getAttribute("data-collapsed") === "1", "再点收起（文案与状态双向切换）");

/* 非武器组不出现「获得」按钮，武器组才出现 */
const headStress = groupHead("负面状态");
headStress.click();
assert(!btnOf(rowByKey("stress"), "获得"), "非武器组不渲染「获得」按钮（武器组专属）");
assert(/当前/.test(rowByKey("stress").textContent), "行标签带「当前」值");

/* ================= 2. 武器父级补壳 + 获得 ================= */
section("2 武器获得");
headSkill.click();
assert(!V.prof, "开局 prof 缺失");
const rowBaton = rowByKey("prof.baton");
btnOf(rowBaton, "获得").click();
assert(V.prof && V.prof.baton === 100, "$prof 缺失时自动补壳并写入入门熟练度 100");
assert(/已获得/.test(rowByKey("prof.baton").textContent), "局部刷新后按钮变「已获得」");
const rowSpray = rowByKey("prof.spray");
btnOf(rowSpray, "获得").click();
assert(V.spraymax === 5 && V.spray === 5, "喷雾同时补容量 5 与满弹药（否则面板「已获得」但实战无弹）");
V.prof.whip = 722;
const rowWhip = rowByKey("prof.whip");
btnOf(rowWhip, "获得").click();
assert(V.prof.whip === 722, "已持有且熟练度 ≥1 → 保持现值，不冲成 100");
const allBtn = Array.prototype.slice.call(bodyOf(groupHead("武器技能")).querySelectorAll("button")).filter(function (b) { return /全部获得/.test(b.textContent); })[0];
assert(!!allBtn, "武器组底部有「全部获得（5 件武器）」");
V.prof.pickaxe = 0;
allBtn.click();
assert(V.prof.pickaxe === 100, "「全部获得」补齐 0 值武器");
assert(V.prof.net === 100 && V.prof.baton === 100, "「全部获得」逐件写入（每件各自留痕）");

/* ================= 3. 应用 / 相对写法 / 回退 ================= */
section("3 应用与回退");
headStress.click();
const rowS = rowByKey("stress");
const inpS = rowS.querySelector("input.mce-inp");
inpS.value = "+100";
btnOf(rowS, "应用").click();
assert(V.stress === 110, "相对写法 +100 在当前值上累加");
inpS.value = "-20";
btnOf(rowS, "应用").click();
assert(V.stress === 90, "相对写法 -20 递减");
const before = V.stress;
btnOf(rowS, "回退").click();
assert(V.stress === 10, "「回退」撤销到留痕里的旧值（before=" + before + " → 10）");

/* ================= 4. 锁定与取消 ================= */
section("4 锁定联动");
const rowM = rowByKey("money");
const inpM = rowM.querySelector("input.mce-inp");
V.money = 100;
inpM.value = "abc";
btnOf(rowM, "锁定").click();
assert(/锁定需要具体目标值/.test(document.body.textContent), "锁定目标非数值 → 明确提示（不静默写脏值）");
assert(!api.mbCELockHas("money"), "非数值不产生锁定项");
inpM.value = "+50";
V.money = 100;
btnOf(rowM, "锁定").click();
assert(api.mbCELockHas("money"), "相对写法也能锁定（目标 = 当前 +50）");
assert(/已锁定/.test(rowByKey("money").textContent), "锁定后按钮变「已锁定」");
assert(/目标 150/.test(btnOf(rowByKey("money"), "已锁定").title), "按钮 tooltip 带目标值");
btnOf(rowByKey("money"), "已锁定").click();
assert(!api.mbCELockHas("money"), "再点一下即取消锁定");

/* ================= 5. 预设模板 ================= */
section("5 一键方案");
const presetBtn = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) { return b.textContent === "经典开局"; })[0];
assert(!!presetBtn, "预设模板按钮「经典开局」存在");
presetBtn.click();
assert(V.money === 5000 && V.purity === 2000, "经典开局：资金 5000 + 纯洁 2000");
assert(V.stress === 0, "经典开局把负面状态清零");
assert(V.fame.sex === 0, "经典开局把名声清零（对象子键也能写）");
const maxBtn = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) { return b.textContent === "全属性拉满"; })[0];
maxBtn.click();
assert(V.purity === 2000 && V.prof.baton === 1000, "全属性拉满：武器写满 1000");
api.close();

console.log("\nQUICK PANEL STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
