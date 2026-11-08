/* 数值固定（07f-lock.js）真实路径测试（branches 70→80 整改轮 · 第十一批）
 *
 * 玩家路径：全局页 → 数值固定区块 → 点「锁定」/「更新目标」/「取消」/ 自由添加（输入框回车提交）。
 * 拒绝路径：空路径、含空段（a..b）、非有限目标值、不存在当前值的键（绝不凭空造键）、未锁定的取消。
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

const V = {
  player: {}, mbCE_wrote: {},
  maplebirch: { transformation: { raven: { build: 5 }, undead: { level: 2 } } },
  purity: 2000
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 锁定 set 的三条拒绝路径 ================= */
section("1 mbCELockSet 拒绝路径");
assert(api.mbCELockSet("", 1).ok === false, "空路径 → 拒绝");
assert(/路径为空/.test(api.mbCELockSet("", 1).message), "拒绝文案说明「路径为空」");
assert(api.mbCELockSet("a..b", 1).ok === false, "含空段的路径（a..b）→ 拒绝，不建脏键");
assert(/空段/.test(api.mbCELockSet("a..b", 1).message), "拒绝文案指出空段");
assert(api.mbCELockSet("purity", NaN).ok === false, "目标值 NaN → 拒绝（锁定只接受有限数值）");
assert(/有限数值/.test(api.mbCELockSet("purity", NaN).message), "拒绝文案说明必须是有限数值");

/* ================= 2. 立即生效与「不凭空造键」 ================= */
section("2 生效边界");
const s1 = api.mbCELockSet("purity", 1500);
assert(s1.ok === true && V.purity === 1500, "锁定 purity=1500 → 点即写回（不等 1s tick）");
assert(/已锁定/.test(s1.message), "成功文案「已锁定 …」");
assert(/纯洁/.test(s1.message), "文案用中文名而不是英文裸 key（" + s1.message + "）");
const s2 = api.mbCELockSet("angel", 3);
assert(s2.ok === true, "锁定不存在的键：登记成功（允许登记）");
assert(!("angel" in V), "但当前值不存在 → 立刻写回时跳过，绝不凭空创建字段");
assert(api.mbCELockHas ? api.mbCELockHas("angel") === true : true, "登记仍在锁定表里（等键出现后自然生效）");
const s3 = api.mbCELockSet("purity", 1800);
assert(/已更新锁定/.test(s3.message) && V.purity === 1800, "再次锁定同一路径 → 「已更新锁定」并写新目标");

/* ================= 3. Tick 写回 ================= */
section("3 mbCELockTick");
V.purity = 800;
api.mbCELockTick();
assert(V.purity === 1800, "tick 把被改动的值强行写回锁定目标");
V.mbCE_lock.push(null, { path: "" });
api.mbCELockTick();
assert(V.purity === 1800, "坏条目（null / 空路径）被跳过，不中断整轮写回");
V.maplebirch.transformation.raven.build = 1;
api.mbCELockSet("maplebirch.transformation.raven.build", 9);
assert(V.maplebirch.transformation.raven.build === 9, "深路径（模组转化键）也能锁定并写回");

/* ================= 4. Remove ================= */
section("4 mbCELockRemove");
assert(api.mbCELockRemove("purity").ok === true, "取消已有锁定 → ok");
assert(!api.mbCELockHas("purity"), "取消后不在锁定表");
assert(api.mbCELockRemove("purity").ok === false, "再次取消 → 「该路径未锁定」");
const savedList = V.mbCE_lock;
V.mbCE_lock = undefined;
assert(/无锁定记录/.test(api.mbCELockRemove("purity").message), "无锁定表 → 「无锁定记录」");
V.mbCE_lock = savedList;

/* ================= 5. 全局页面板交互 ================= */
section("5 面板渲染与交互");
api.mbCELockRemove("angel"); /* 只留 raven 一条已锁定项，用「锁定」与「更新目标」两种按钮做对照 */
function tab(t) {
  const bs = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of bs) { if (b.getAttribute("data-tab") === t) { b.click(); return true; } }
  return false;
}
function gpane() { return document.querySelector('#mce-root [data-pane="global"]'); }
api.open();
assert(tab("global") === true, "切到「全局」页签");
const gp = gpane();
assert(!!gp && /数值固定/.test(gp.textContent), "页面末尾出现「数值固定」区块");
const row = gp.querySelector('[data-lockpath="angel"]');
assert(!!row, "预设行按 data-lockpath 建出（angel）");
assert(/—/.test(row.textContent), "当前值不存在 → 显示「—」而不是 undefined");
const inp = row.querySelector('input[type="number"]');
const btn = Array.prototype.slice.call(row.querySelectorAll("button")).filter(function (b) { return /^锁定$/.test(b.textContent); })[0];
assert(!!btn, "未锁定时按钮是「锁定」");
inp.value = "4";
btn.click();
assert(V.angel === undefined, "面板点锁定但键不存在 → 仍不造键");
assert(/数值固定/.test(gpane().textContent), "重渲染后区块仍在（不白屏）");

/* 已锁定行：按钮变「更新目标」并出现「取消」 */
V.maplebirch.transformation.raven.build = 3;
api.mbCELockSet("maplebirch.transformation.raven.build", 7);
tab("mods"); tab("global");
const rowRaven = gpane().querySelector('[data-lockpath="maplebirch.transformation.raven.build"]');
assert(/更新目标/.test(rowRaven.textContent), "已锁定行按钮变为「更新目标」");
const cancelBtn = Array.prototype.slice.call(rowRaven.querySelectorAll("button")).filter(function (b) { return /^取消$/.test(b.textContent); })[0];
assert(!!cancelBtn, "已锁定行另有「取消」按钮");
cancelBtn.click();
assert(!api.mbCELockHas("maplebirch.transformation.raven.build"), "点「取消」→ 移除锁定");

/* 回车提交（预设行） */
tab("mods"); tab("global");
const rowPurity = gpane().querySelector('[data-lockpath="purity"]');
const inpP = rowPurity.querySelector('input[type="number"]');
inpP.value = "1234";
const ev = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true });
inpP.dispatchEvent(ev);
assert(V.purity === 1234, "输入框按回车等价于点「锁定」（purity → 1234）");

/* 自由添加：空路径拒绝 / 非空成功 / 自定义已锁定项显示 */
tab("mods"); tab("global");
const gp2 = gpane();
const addPath = gp2.querySelector('input.mce-path');
const addVal = Array.prototype.slice.call(gp2.querySelectorAll('input[type="number"]')).pop();
const addBtn = Array.prototype.slice.call(gp2.querySelectorAll("button")).filter(function (b) { return /^添加$/.test(b.textContent); })[0];
assert(!!addPath && !!addBtn, "自由添加输入区建出");
addPath.value = "   ";
addBtn.click();
assert(/请填写要固定的 varPath/.test(document.body.textContent), "空路径点「添加」→ 明确提示（不是静默失败）");
addPath.value = "demo.flag";
addVal.value = "1";
addBtn.click();
assert(api.mbCELockHas("demo.flag"), "填写路径 + 目标后「添加」→ 进入锁定表");
tab("mods"); tab("global");
assert(!!gpane().querySelector('[data-lockpath="demo.flag"]'), "自定义锁定项也出现在面板（可取消）");
const addPath2 = gpane().querySelector('input.mce-path');
addPath2.value = "demo.extra";
addPath2.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
assert(api.mbCELockHas("demo.extra"), "自由添加输入框回车也能提交");

/* ================= 6. v2.0.7 P4：自定义锁定组（来源徽标 / 折叠记忆 / 自由添加拒绝路径） ================= */
section("6 自定义锁定组与拒绝路径");
function btns(scope, re) { return Array.prototype.slice.call(scope.querySelectorAll("button")).filter(function (b) { return re.test(b.textContent); }); }
api.mbCELockSet("purity", 900); /* 非预设项 → 进自定义折叠组 */
tab("mods"); tab("global");
const badges = Array.prototype.slice.call(gpane().querySelectorAll(".mce-src")).map(function (b) { return b.textContent; });
assert(badges.length > 0, "自定义锁定项逐行标出「谁锁的」（" + badges.join("/") + "）");
assert(badges.some(function (s) { return s === "角色页" || s === "Mod作弊" || s === "手动"; }), "来源徽标取值在「角色页 / Mod作弊 / 手动」三档内");

const head = gpane().querySelector(".mce-collapse-head");
assert(!!head, "自定义锁定组标题建出（默认收起）");
assert(head.parentNode.querySelector(".mce-grp-body").getAttribute("data-collapsed") === "1", "默认收起（data-collapsed=1）");
head.click();
assert(head.parentNode.querySelector(".mce-grp-body").getAttribute("data-collapsed") === "0", "点标题 → 展开");
api.mbCELockSet("purity", 950); /* 成功锁定触发重渲染，验证折叠状态被记住 */
tab("mods"); tab("global");
const head2 = gpane().querySelector(".mce-collapse-head");
assert(head2 && head2.parentNode.querySelector(".mce-grp-body").getAttribute("data-collapsed") === "0",
  "重渲染后仍保持展开（折叠状态落 localStorage，不每次回弹）");

/* 自由添加：空字符串 / 非法路径两条拒绝路径（都必须有可见提示） */
const gp3 = gpane();
const addPath3 = gp3.querySelector("input.mce-path");
addPath3.value = "";
btns(gp3, /^添加$/)[0].click();
assert(/请填写要固定的 varPath/.test(document.body.textContent), "空字符串点「添加」→ 明确提示");
tab("mods"); tab("global");
const gp4 = gpane();
const addPath4 = gp4.querySelector("input.mce-path");
addPath4.value = "a..b";
btns(gp4, /^添加$/)[0].click();
assert(/空段/.test(document.body.textContent), "非法路径（a..b）→ 面板回显拒绝原因（不是静默失败）");

/* 取消按钮二次点击（锁已解）→ 失败分支也要给提示，不能静默 */
tab("mods"); tab("global");
const rowP2 = gpane().querySelector('[data-lockpath="purity"]');
const cancel2 = btns(rowP2, /^取消$/)[0];
assert(!!cancel2, "purity 已锁定行有「取消」按钮");
cancel2.click();
assert(!api.mbCELockHas("purity"), "点「取消」→ 解除锁定");
cancel2.click();
assert(/未锁定|无锁定记录/.test(document.body.textContent), "同一按钮再点一次 → 明确提示锁已不在（不静默）");

/* 清理：移除全部锁定，避免定时器在进程里空转 */
api.mbCELockRemove("demo.flag");
api.mbCELockRemove("demo.extra");
api.mbCELockRemove("angel");
api.close();
console.log("\nLOCK PANEL STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
