/* 礼顿把柄（学校）直写通道测试（v2.1.15 追加轮）
 *
 * 覆盖对象：07o-vanilla-leighton.js
 * 判据口径：每个写入用例同时断言「返回体」与「存档实际值」，并核对 vcore-leighton 留痕的 before 与回退还原（含「原档本来没有该键 → 回退是删除」）。
 * 原版事实来源（DoL 0.5.12.13 单文件 HTML 行号实证，game\Degrees of Lewdity.html）：
 *   - headblackmailed 全库无写 0；置 1：L686106 / L686131（School First Shoot）、L695630（科学展 £5000）、L695638（拘留）
 *   - 版本升级回填：L185169 `if $headnodetention is 1 or $headmoney is 1 or $headphotoshoot is 1` → headblackmailed 1（widget L184483，调用 L179027 / L187986）
 *   - 判定点：L299783 / L380149 / L540125 / L685909 / L824459 / L824473 / L891945
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
global.HTMLSelectElement = window.HTMLSelectElement;
const V = { player: {}, passage: "Room" };
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = { bodyparts: ["chest", "face", "feet", "leftarm", "rightarm", "neck", "thigh", "tummy"] };
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.vanillaLeightonClear === "function" && typeof api.vanillaLeightonStats === "function", "礼顿 API 已导出（clear / stats）");
assert(typeof api.vanillaLeightonGet === "function", "礼顿获取把柄 API 已导出");
assert(typeof api.vanillaLeightonUndo === "function" && typeof api.renderVanillaLeighton === "function", "礼顿 API 已导出（undo / render）");

/* ================= 1. 空档：未设置把柄 ================= */
section("1 空档（未设置把柄）");
let st = api.vanillaLeightonStats();
assert(st.ok === true && st.set === false && st.blackmailed === 0, "无 headblackmailed → 统计标 set=false、读数 0");
V.mbCE_wrote = {};
let r = api.vanillaLeightonClear(false);
assert(r.ok === true && V.headblackmailed === 0, "空档也能写 0（把柄键可选，写 0 即「无把柄」）");
assert(V.mbCE_wrote["vcore:leighton-clear"].before.had.headblackmailed === false, "留痕记住原档没有这个键");
assert(V.mbCE_wrote["vcore:leighton-clear"].type === "vcore-leighton", "留痕类型 vcore-leighton（回退中心单独分组）");
let u = api.vanillaLeightonUndo("leighton-clear");
assert(u.ok === true && !("headblackmailed" in V), "回退把「原本不存在的键」删掉，而不是留 0");

/* ================= 2. 只清把柄（贴吧言灵口径） ================= */
section("2 只清把柄");
V.headblackmailed = 1;
V.headnodetention = 1;
V.headmoney = 1;
V.headphotoshoot = 0;
V.headpolice = 1;
V.mbCE_wrote = {};
st = api.vanillaLeightonStats();
assert(st.blackmailed === 1 && st.police === 1 && st.src.headmoney === 1 && st.src.headnodetention === 1, "读取把柄 1、警局 1、5000 线 1、拘留线 1");
r = api.vanillaLeightonClear(false);
assert(r.ok === true && V.headblackmailed === 0, "把柄写成 0");
assert(V.headmoney === 1 && V.headnodetention === 1 && V.headpolice === 1, "来源分支与警局线保持原值（只清把柄）");
assert(r.message.indexOf("版本升级") !== -1, "提示写明版本升级可能回填（L185169 迁移条件）");
u = api.vanillaLeightonUndo("leighton-clear");
assert(u.ok === true && V.headblackmailed === 1, "回退还原把柄 1");

/* ================= 3. 彻底解除（连三条来源） ================= */
section("3 彻底解除");
V.mbCE_wrote = {};
r = api.vanillaLeightonClear(true);
assert(r.ok === true && V.headblackmailed === 0, "把柄写 0");
assert(V.headmoney === 0 && V.headnodetention === 0 && V.headphotoshoot === 0, "三条来源分支一起清 0（升级迁移不会再回填）");
assert(V.headpolice === 1, "警局线不被动（另一条独立分支）");
assert(r.message.indexOf("警局") !== -1, "提示写明警局线未动");
assert(V.mbCE_wrote["vcore:leighton-purge"].before.val.headmoney === 1, "留痕保存 5000 线原值 1");
u = api.vanillaLeightonUndo("leighton-purge");
assert(u.ok === true && V.headblackmailed === 1 && V.headmoney === 1 && V.headnodetention === 1, "回退还原把柄与来源分支");
assert(V.headphotoshoot === 0, "原本为 0 的写真线回退成 0（不是删除/未定义）");

/* ================= 3b. 获取把柄（v2.2.0：直写 1，不动来源分支与警局线） ================= */
section("3b 获取把柄");
V.mbCE_wrote = {};
r = api.vanillaLeightonGet();
assert(r.ok === true && V.headblackmailed === 1, "获取把柄 = 写 1（等价原版被勒索状态）");
assert(V.headmoney === 1 && V.headnodetention === 1 && V.headphotoshoot === 0 && V.headpolice === 1, "来源分支与警局线保持原值不动");
assert(V.mbCE_wrote["vcore:leighton-get"].type === "vcore-leighton", "留痕类型 vcore-leighton（回退中心单独分组）");
assert(V.mbCE_wrote["vcore:leighton-get"].before.had.headblackmailed === true && V.mbCE_wrote["vcore:leighton-get"].before.val.headblackmailed === 1, "留痕记住原值 1（幂等写入）");
u = api.vanillaLeightonUndo("leighton-get");
assert(u.ok === true && V.headblackmailed === 1, "回退还原把柄 1（获取前已是 1）");

/* ================= 3c. 空档获取 ================= */
section("3c 空档获取");
delete V.headblackmailed;
delete V.headmoney;
delete V.headnodetention;
delete V.headphotoshoot;
delete V.headpolice;
V.mbCE_wrote = {};
r = api.vanillaLeightonGet();
assert(r.ok === true && V.headblackmailed === 1, "空档获取把柄 = 创建键并写 1");
assert(!("headmoney" in V) && !("headpolice" in V), "空档不凭空创建来源分支与警局键");
assert(V.mbCE_wrote["vcore:leighton-get"].before.had.headblackmailed === false, "留痕记住原档没有这个键");
u = api.vanillaLeightonUndo("leighton-get");
assert(u.ok === true && !("headblackmailed" in V), "回退删除获取前不存在的键");

/* ================= 4. 面板渲染（玩家实际路径：全局页 ⑬） ================= */
section("4 面板渲染");
V.headblackmailed = 1;
V.headnodetention = 1;
V.headmoney = 0;
V.headphotoshoot = 0;
V.headpolice = 0;
V.mbCE_wrote = {};
const pane = document.createElement("div");
document.body.appendChild(pane);
api.renderVanillaLeighton(pane);
const txt = pane.textContent;
assert(txt.indexOf("礼顿") !== -1 && txt.indexOf("把柄") !== -1, "区块标题与分组出现（全局页 ⑬）");
assert(txt.indexOf("$") === -1, "面板文案不出现裸变量名");
assert(!/undefined/.test(txt), "文案不把 undefined 漏给玩家");
const btns = Array.prototype.slice.call(pane.querySelectorAll("button"));
const getBtn = btns.filter(function (b) { return b.textContent === "获取把柄"; })[0];
const clearBtn = btns.filter(function (b) { return b.textContent === "解除把柄"; })[0];
const purgeBtn = btns.filter(function (b) { return b.textContent === "彻底解除"; })[0];
assert(!!getBtn, "找到「获取把柄」按钮");
assert(!!clearBtn, "找到「解除把柄」按钮");
assert(!!purgeBtn, "找到「彻底解除」按钮");
if (getBtn) {
  getBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.headblackmailed === 1 && V.headnodetention === 1, "点击获取把柄只写把柄，不动拘留线");
  assert(!!V.mbCE_wrote["vcore:leighton-get"], "获取把柄落 vcore-leighton 留痕");
}
if (clearBtn) {
  clearBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.headblackmailed === 0 && V.headnodetention === 1, "点击只清把柄，不动拘留线");
  assert(!!V.mbCE_wrote["vcore:leighton-clear"], "点击后落 vcore-leighton 留痕");
}
if (purgeBtn) {
  purgeBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.headblackmailed === 0 && V.headnodetention === 0, "点击彻底解除，拘留线一起清 0");
  assert(!!V.mbCE_wrote["vcore:leighton-purge"], "彻底解除也落留痕");
}
/* 存档无变量时面板也要能渲染 */
delete V.headblackmailed;
delete V.headnodetention;
delete V.headmoney;
delete V.headphotoshoot;
const pane2 = document.createElement("div");
document.body.appendChild(pane2);
let threw = null;
try { api.renderVanillaLeighton(pane2); } catch (e) { threw = e; }
assert(threw === null && pane2.textContent.indexOf("礼顿") !== -1, "空档下面板正常渲染（不抛异常）");

/* ================= 5. 回退中心文案 ================= */
section("5 回退中心文案");
V.mbCE_wrote = {};
api.vanillaLeightonGet();
api.vanillaLeightonClear(false);
api.vanillaLeightonClear(true);
assert(typeof api.mbCEUndoItemName === "function", "回退中心命名入口可用");
if (typeof api.mbCEUndoItemName === "function") {
  assert(api.mbCEUndoItemName("vcore:leighton-get", V.mbCE_wrote["vcore:leighton-get"]) === "礼顿把柄（获取）", "leighton-get 显示为「礼顿把柄（获取）」");
  assert(api.mbCEUndoItemName("vcore:leighton-clear", V.mbCE_wrote["vcore:leighton-clear"]) === "礼顿把柄", "leighton-clear 显示为「礼顿把柄」");
  assert(api.mbCEUndoItemName("vcore:leighton-purge", V.mbCE_wrote["vcore:leighton-purge"]) === "礼顿把柄与来源分支", "leighton-purge 显示为「礼顿把柄与来源分支」");
}

console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
process.exit(failures ? 1 : 0);
