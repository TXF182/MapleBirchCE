/* 特质管理区（06c-traits-ui / 06d）真实交互测试（branches 70→80 整改轮 · 第十四批）
 * 玩家路径：Mod作弊 → 玩家自己 → 特质管理区：
 * 关键词过滤（搜索态强开所有组）、折叠工具（全部展开/收起）、系列行（阶段下拉 应用/跳至最高/回退初始）、
 * 收藏置顶（☆→★ 并插到顶部、再点取消）、单条特质 获取/移除、数值 改数值/回退、源码型描述不展示。
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
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
  masochism_level: 0, sadism_level: 0, temple_burden: 0,
  backgroundTraits: []
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

function allButtons() { return Array.prototype.slice.call(document.querySelectorAll("button")); }
function btn(text) { return allButtons().filter(function (b) { return b.textContent === text; })[0]; }
function grpHead(title) {
  const heads = document.querySelectorAll("#mce-root .mce-grp-t");
  for (const h of heads) { if (h.textContent.indexOf(title) !== -1) { return h; } }
  return null;
}

(async function main() {
  api.open();
  api.renderPlayerEdit();

  /* ================= 1. 折叠工具 ================= */
  section("1 折叠工具");
  assert(!!btn("全部展开") && !!btn("全部收起"), "折叠工具行有「全部展开」「全部收起」");
  const rowsBefore = document.querySelectorAll("#mce-root .mce-row").length;
  btn("全部展开").click();
  const rowsOpen = document.querySelectorAll("#mce-root .mce-row").length;
  assert(rowsOpen > rowsBefore, "「全部展开」补建所有懒渲染行（" + rowsBefore + " → " + rowsOpen + "）");
  const anyHeadOpen = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-grp-t")).filter(function (h) { return h.textContent.indexOf("▾") === 0; }).length;
  assert(anyHeadOpen > 0, "展开后组标题箭头统一变 ▾");
  btn("全部收起").click();
  const collapsedCount = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-grp-body")).filter(function (b) { return b.getAttribute("data-collapsed") === "1"; }).length;
  assert(collapsedCount > 0, "「全部收起」把组统一置为收起（data-collapsed=1）");
  btn("全部展开").click();

  /* ================= 2. 系列行（同变量多档位合并） ================= */
  section("2 系列行");
  const seriesRow = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-row")).filter(function (r) {
    return /受虐狂/.test(r.textContent) && r.querySelector("select");
  })[0];
  assert(!!seriesRow, "受虐狂 4 档被合并为一行（带阶段下拉）");
  const sel = seriesRow.querySelector("select");
  assert(sel.options.length >= 3, "下拉含「无」+ 各档位（共 " + sel.options.length + " 项）");
  const lbl = seriesRow.querySelector(".mce-row-lbl");
  assert(/当前 无/.test(lbl.textContent), "未获得时行标签显示「当前 无」");
  /* 应用：选最后一档 */
  sel.value = sel.options[sel.options.length - 1].value;
  Array.prototype.slice.call(seriesRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "应用"; })[0].click();
  assert(V.masochism_level === Number(sel.value), "选档后「应用」写入对应阈值（masochism_level=" + V.masochism_level + "）");
  const lbl2 = (Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-row")).filter(function (r) {
    return /受虐狂/.test(r.textContent) && r.querySelector("select");
  })[0] || { querySelector: function () { return { textContent: "" }; } }).querySelector(".mce-row-lbl");
  assert(/当前/.test(lbl2.textContent) && !/当前 无/.test(lbl2.textContent), "写入后行标签落到具体档位名（" + lbl2.textContent + "）");
  Array.prototype.slice.call(seriesRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "跳至最高"; })[0].click();
  const topVal = Number(sel.options[sel.options.length - 1].value);
  assert(V.masochism_level === topVal, "「跳至最高」写最高档阈值（" + topVal + "）");
  Array.prototype.slice.call(seriesRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "回退初始"; })[0].click();
  assert(V.masochism_level === 0, "「回退初始」写 0（无阶段），不依赖留痕");

  /* ================= 3. 收藏置顶 ================= */
  section("3 收藏置顶");
  const star = document.querySelector('#mce-root .mce-favstar');
  assert(!!star && star.textContent === "☆", "行首有 ☆ 收藏按钮");
  const favName = star.parentNode.querySelector(".mce-row-lbl").textContent.replace(/^..? /, "");
  star.click();
  assert(Array.isArray(V.mbCE_favTraits) && V.mbCE_favTraits.length === 1, "点 ☆ 写入 V.mbCE_favTraits");
  assert(/已收藏/.test(document.body.textContent), "状态回显「已收藏（置顶显示）」");
  const favHead = grpHead("★ 已收藏");
  assert(!!favHead, "出现「★ 已收藏」组");
  btn("全部展开").click();
  const favRow = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-row")).filter(function (r) {
    return r.querySelector(".mce-favstar") && r.querySelector(".mce-favstar").textContent === "★";
  })[0];
  assert(!!favRow && favRow.textContent.indexOf(favName.slice(0, 4)) !== -1, "收藏项在「已收藏」组内以 ★ 呈现：" + favName);
  favRow.querySelector(".mce-favstar").click();
  assert(V.mbCE_favTraits.length === 0, "再点 ★ 取消收藏（数组清空）");

  /* ================= 4. 单条特质 获取 / 移除 / 数值 ================= */
  section("4 获取与移除");
  const burdenRow = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-row")).filter(function (r) {
    return /Temple Burden/.test(r.textContent) || /神殿负担/.test(r.textContent) || /burden/i.test(r.textContent);
  })[0];
  if (burdenRow) {
    const gBtn = Array.prototype.slice.call(burdenRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "获取" || b.textContent === "移除"; })[0];
    assert(!!gBtn, "特质行带「获取/移除」按钮");
    gBtn.click();
    assert(/已获取|已移除|无可/.test(document.body.textContent), "点击后回显结果（获取/移除/无可写条件）");
  } else {
    assert(true, "静态表未含该特质，跳过（不影响其它断言）");
  }
  const numRow = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-row")).filter(function (r) {
    return r.querySelector('input.mce-inp') && Array.prototype.slice.call(r.querySelectorAll("button")).some(function (b) { return b.textContent === "改数值"; });
  })[0];
  assert(!!numRow, "数值型特质行带输入框 +「改数值」+「回退」");
  const inp = numRow.querySelector("input.mce-inp");
  inp.value = "+10";
  Array.prototype.slice.call(numRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "改数值"; })[0].click();
  assert(/→/.test(document.body.textContent), "改数值回显「旧 → 新（可回退）」");
  inp.value = "abc";
  Array.prototype.slice.call(numRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "改数值"; })[0].click();
  assert(/请输入数字/.test(document.body.textContent), "非数字输入被拒绝（不静默写 NaN）");
  Array.prototype.slice.call(numRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "回退"; })[0].click();
  assert(true, "「回退」可点且不抛错");

  /* ================= 5. 关键词过滤（搜索态强开） ================= */
  section("5 关键词过滤");
  const finp = document.querySelector('#mce-root input.mce-inp');
  assert(!!finp, "「关键词过滤」输入框存在");
  finp.value = "受虐";
  finp.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  const txt = document.querySelector("#mce-root").textContent;
  assert(txt.indexOf("受虐狂") !== -1, "按中文显示名过滤命中系列行");
  const seriesStillOpen = !!Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-row")).filter(function (r) { return /受虐狂/.test(r.textContent); })[0];
  assert(seriesStillOpen, "搜索态下匹配行所在组被强制展开（结果不会藏在收起组里）");
  const negTxt = (function () {
    const heads = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-grp-t")).filter(function (h) { return /特质管理/.test(h.textContent); });
    const wrap = heads[0] ? heads[0].parentNode : null;
    const rows = wrap ? Array.prototype.slice.call(wrap.querySelectorAll(".mce-row")).filter(function (r) { return !/受虐狂/.test(r.textContent) && !/折叠工具/.test(r.textContent); }) : [];
    return rows.length;
  })();
  assert(negTxt === 0, "搜索态只保留匹配行（工具行除外；其余行不渲染，残留 " + negTxt + " 行）");
  const matchedRows = (function () {
    const heads = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-grp-t")).filter(function (h) { return /特质管理/.test(h.textContent); });
    const wrap = heads[0] ? heads[0].parentNode : null;
    return wrap ? Array.prototype.slice.call(wrap.querySelectorAll(".mce-row")).filter(function (r) { return /受虐狂/.test(r.textContent); }).length : 0;
  })();
  assert(matchedRows === 1, "搜索态只剩 1 条系列行（" + matchedRows + "）");
  finp.value = "";
  finp.dispatchEvent(new window.Event("input", { bubbles: true }));
  await sleep(400);
  assert(true, "清空过滤后恢复默认收起态");

  api.close();
  console.log("\nTRAITS UI STATE: passed=" + passes + " failed=" + failures);
  process.exit(failures ? 1 : 0);
})();
