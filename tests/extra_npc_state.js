/* v2.2.7 需求③④⑤⑥ 测试（07m-money / 07r / 07s / 07t）
 *
 * 覆盖：
 *  ⑤ 租金：便士↔英镑格式化口径（档位表 £100/£300/…）、每周租金写入（英镑输入→便士）、
 *     金额锁定（原版重算后 passageinit tick 写回）、欠租输入口径、rent-money/rent-lock 回退；
 *  ⑥ 格威岚：生气期/离店计时读取、A 档跳过（删计时 + yearningLetter=1 + state 保持 scorned）、
 *     已读信拒绝、gwylan-wait 回退；
 *  ③ Sam：isInPark 包装只拦 "sam" 且其余角色透传、开关持久化与回退；
 *  ④ 认识：initnpc 初始化后数值写回、幂等拒绝、wikifier 缺失拒绝、0→1 探测记录首次相认段落、
 *     know-npc 回退。
 * 原版事实见各段源码头部注释（DoL 0.5.12.13 行号）。
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

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;

const V = {
  player: {}, passage: "Room",
  NPCName: [
    { nam: "Sam", init: 0, trust: 5, love: 7, dom: 0, lust: 0, trauma: 0, rage: 0, purity: 0, corruption: 0 },
    { nam: "Gwylan", init: 1, trust: 10, love: 20, dom: 0, lust: 0, trauma: 0, rage: 0, purity: 0, corruption: 0 },
    { nam: "Robin", init: 1, trust: 30, love: 40, dom: 0, lust: 0, trauma: 0, rage: 0, purity: 0, corruption: 0 }
  ],
  characters: { npc: { Sam: { state: "active" }, Gwylan: { state: "scorned" }, Robin: { state: "active" } } },
  gwylan: { timer: { scorned: Date.now() + 9 * 86400000, nobody: Date.now() + 3 * 86400000 } },
  yearningLetter: 0
};
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = { foodstuff: {}, bodyparts: [] };
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();
/* 宿主侧 mock：原版 initnpc 的最小语义（init=1 + 七项清零），用于验证「初始化后写回面板数值」 */
window.wikifier = function (txt) {
  const m = /<<initnpc "([^"]+)">>/.exec(String(txt));
  if (!m) { return; }
  const n = V.NPCName.filter(function (x) { return x.nam === m[1]; })[0];
  if (!n) { return; }
  n.init = 1;
  ["trust", "love", "dom", "lust", "trauma", "rage", "purity", "corruption"].forEach(function (k) { n[k] = 0; });
  n.state = "active";
  n.name_known = 1;
};
let parkCalls = [];
window.isInPark = function (name) { parkCalls.push(String(name)); return String(name).toLowerCase() !== "doren"; };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.vanillaEconRentMoney === "function" && typeof api.gwylanSkipWait === "function"
  && typeof api.samAwaySet === "function" && typeof api.knowSet === "function", "四条需求 API 已导出");

/* ================= 1. 租金单位与锁定 ================= */
section("1 租金单位与锁定");
assert(api.vanillaEconFmt(10000) === "£100" && api.vanillaEconFmt(30000) === "£300", "档位便士 10000/30000 显示为 £100 / £300（此前面板少除 100）");
assert(api.vanillaEconFmt(1080) === "£10.80" && api.vanillaEconFmt(0) === "£0", "小数与零值格式正确（便士 1080 → £10.80）");
assert(api.vanillaEconFmt(-500) === "-£5", "负值保留符号（欠款为负时的显示兜底）");
V.renttime = 3; V.rentmoney = 500; V.babyRent = 40; V.baileyRefusedToPayTotal = 1080;
let r = api.vanillaEconRentMoney("300");
assert(r.ok === true && V.rentmoney === 30000, "输入 £300 写入 rentmoney = 30000 便士");
assert(V.mbCE_wrote["vcore:rent-money"].before.rentmoney === 500, "周租留痕 before = 原值 500 便士");
r = api.vanillaEconRentMoney("");
assert(r.ok === false, "空输入 → 拒绝");
r = api.vanillaEconRentMoney("abc");
assert(r.ok === false && V.rentmoney === 30000, "非数字 → 拒绝且不写档");
r = api.vanillaEconRentMoney("-5");
assert(r.ok === false, "负数 → 拒绝");
r = api.vanillaEconRentMoney("9999999");
assert(r.ok === false, "超过 £999,999.99 上限 → 拒绝");

r = api.vanillaEconRentLock();
assert(r.ok === true && api.vanillaEconRentLockState().money === 30000, "锁定成功且锁值 = 30000 便士");
assert(V.mbCE_wrote["vcore:rent-lock"].before.lock === undefined, "首次锁定前无锁，留痕 before.lock = undefined");
V.rentmoney = 60000; /* 模拟原版 <<rentmod>> 重算 */
api.vanillaEconRentLockTick();
assert(V.rentmoney === 30000, "原版重算改写后 tick 写回锁值 30000");
r = api.vanillaEconRentUnlock();
assert(r.ok === true && !V.mbCE_rentLock, "解除锁定后 mbCE_rentLock 移除");
let u = api.vanillaEconUndo("rent-lock");
assert(u.ok === true && !V.mbCE_rentLock, "回退 rent-lock 还原为未锁定");
u = api.vanillaEconUndo("rent-money");
assert(u.ok === true && V.rentmoney === 500, "回退 rent-money 还原 500 便士");
r = api.vanillaEconRentDebt("12.34");
assert(r.ok === true && V.baileyRefusedToPayTotal === 1234, "欠租输入 £12.34 → 1234 便士");
u = api.vanillaEconUndo("rent-debt");
assert(u.ok === true && V.baileyRefusedToPayTotal === 1080, "回退欠租还原 1080 便士");

/* ================= 2. 格威岚消失期 A 档 ================= */
section("2 格威岚消失期 A 档");
let gs = api.gwylanWaitState();
assert(gs.has === true && gs.state === "scorned" && gs.scornedDays === 9, "读取生气期：state=scorned / 剩 9 天");
assert(gs.nobodyDays === 3 && gs.letter === 0 && gs.awaiting === true, "离店计时 3 天 / 来信标志 0 / 处于消失期");
r = api.gwylanSkipWait();
assert(r.ok === true, "A 档跳过成功");
assert(!V.gwylan.timer.scorned && !V.gwylan.timer.nobody, "两个计时器已删除（isGwylanAbsent 只看 timer.nobody）");
assert(V.yearningLetter === 1, "来信标志置 1 → safehouseEvents 会出窗鸟链接");
assert(V.characters.npc.Gwylan.state === "scorned", "state 保持 scorned（原版和解链要求 state 为 scorned）");
assert(V.mbCE_wrote["vcore:gwylan-wait"].before.scorned > 0, "留痕 before.scorned 保存原时间戳");
assert(V.mbCE_wrote["vcore:gwylan-wait"].before.letter === 0, "留痕 before.letter = 0");
r = api.gwylanSkipWait();
assert(r.ok === false, "重复跳过 → 拒绝（没有消失期可跳）");
V.yearningLetter = 2;
assert(api.gwylanSkipWait().ok === false, "已读信（letter=2）→ 拒绝，避免重复来信");
u = api.vanillaEconUndo("gwylan-wait");
assert(u.ok === true && V.yearningLetter === 0 && V.gwylan.timer.scorned > 0 && V.gwylan.timer.nobody > 0, "回退还原两个计时器与来信标志");

/* ================= 3. Sam 公园驱逐 ================= */
section("3 Sam 公园驱逐");
assert(api.samAway() === false, "默认未开启");
r = api.samAwaySet(true);
assert(r.ok === true && V.mbCE_samAway === true && api.samAway() === true, "开关写入 $mbCE_samAway");
api.samEnsureHook();
assert(window.__mbCESamHooked === true, "isInPark 包装已安装（幂等标记）");
parkCalls = [];
assert(window.isInPark("sam") === false, "开启后 isInPark(\"sam\") 返回 false（公园事件不触发）");
assert(window.isInPark("robin") === true, "其它角色透传原函数（robin 仍为 true）");
assert(parkCalls.length === 1 && parkCalls[0] === "robin", "拦截分支不调用原函数，透传分支调用一次");
r = api.samAwaySet(false);
assert(r.ok === true && !V.mbCE_samAway && window.isInPark("sam") === true, "关闭后恢复原版判定");
u = api.vanillaEconUndo("sam-away");
assert(u.ok === true && !V.mbCE_samAway, "回退 sam-away 还原关闭态");

/* ================= 4. 认识角色 ================= */
section("4 认识角色");
let ks = api.knowState("Sam");
assert(ks.has === true && ks.known === false && ks.init === 0, "Sam 初始未认识（init=0）");
assert(ks.staticScene.indexOf("公园") !== -1, "Sam 的已取证相认场景显示为公园");
assert(api.knowState("Nope").has === false, "名单外角色 → has=false");
r = api.knowSet("Nope");
assert(r.ok === false, "名单外角色 → 拒绝初始化");
const samObj = V.NPCName[0];
samObj.init = 1;
r = api.knowSet("Sam");
assert(r.ok === false, "已认识（init=1）→ 幂等拒绝");
samObj.init = 0; samObj.trust = 5; samObj.love = 7;
const savedWikifier = window.wikifier;
delete window.wikifier;
r = api.knowSet("Sam");
assert(r.ok === false && samObj.init === 0, "wikifier 缺失 → 拒绝且不写 init");
window.wikifier = savedWikifier;
r = api.knowSet("Sam");
assert(r.ok === true && samObj.init === 1, "调原版 initnpc 后 init = 1");
assert(samObj.trust === 5 && samObj.love === 7, "initnpc 清零的数值已写回面板原值（trust 5 / love 7）");
assert(V.mbCE_wrote["vcore:know-npc"].before.stats.love === 7, "留痕 before.stats 保存写入前面板数值");
u = api.vanillaEconUndo("know-npc");
assert(u.ok === true && samObj.init === 0 && samObj.trust === 5 && samObj.love === 7, "回退认识：init 归 0 且数值保持");
/* 0→1 探测：先建基线，再改 init 后记录当前段落 */
const robinObj = V.NPCName[2];
robinObj.init = 0;
api.knowProbe("Park");
robinObj.init = 1;
api.knowProbe("Park");
assert(V.mbCE_firstMeet.Robin === "Park", "运行时 0→1 记录首次相认段落 Park");
api.knowProbe("Park");
assert(Object.keys(V.mbCE_firstMeet).length === 1, "重复探测不追加第二条记录（幂等）");

/* ================= 5. 阶段页区块 ================= */
section("5 阶段页区块");
const stagePane = document.createElement("div");
document.body.appendChild(stagePane);
api.stageExtras(stagePane, "Sam");
assert(stagePane.textContent.indexOf("认识状态") !== -1, "任意角色都有「认识状态」块");
assert(stagePane.textContent.indexOf("Sam · 公园遭遇") !== -1, "Sam 卡片出现公园遭遇块");
assert(stagePane.textContent.indexOf("格威岚 · 消失期") === -1, "非 Gwylan 不渲染格威岚块");
const knowBtn = Array.prototype.slice.call(stagePane.querySelectorAll("button")).filter(function (b) { return b.textContent === "标记为认识"; })[0];
assert(!!knowBtn, "找到「标记为认识」按钮");
if (knowBtn) {
  knowBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.NPCName[0].init === 1, "点击「标记为认识」把 Sam 初始化为已认识（UI 到存档链路打通）");
}
const gPane = document.createElement("div");
document.body.appendChild(gPane);
api.stageExtras(gPane, "Gwylan");
assert(gPane.textContent.indexOf("格威岚 · 消失期") !== -1, "Gwylan 卡片出现消失期块");
const skipBtn = Array.prototype.slice.call(gPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "跳过消失期"; })[0];
assert(!!skipBtn, "找到「跳过消失期」按钮");
if (skipBtn) {
  skipBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(!V.gwylan.timer.scorned && V.yearningLetter === 1, "点击跳过消失期：计时清零 + 来信置 1");
}

/* ================= 6. 经济面板租金行 ================= */
section("6 经济面板租金行");
V.renttime = 2; V.rentmoney = 30000; V.babyRent = 0; V.baileyRefusedToPayTotal = 1080;
const econPane = document.createElement("div");
econPane.setAttribute("data-pane", "global");
document.body.appendChild(econPane);
api.renderVanillaEcon(econPane);
const econTxt = econPane.textContent;
assert(econTxt.indexOf("每周租金") !== -1 && econTxt.indexOf("£300") !== -1, "面板每周租金显示 £300（便士 30000 ÷ 100）");
assert(econTxt.indexOf("£10.80") !== -1, "面板欠租显示 £10.80（便士 1080 ÷ 100）");
assert(econTxt.indexOf("租金锁定") !== -1, "面板出现租金锁定状态行");
assert(econTxt.indexOf("$") === -1, "面板文案不出现裸变量名");

console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
process.exit(failures ? 1 : 0);
