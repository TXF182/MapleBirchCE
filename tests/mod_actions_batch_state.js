/* 模组页「命令式动作」分组 + 全局批量解锁（05a3-modcheat-actions / 03a-global-batch）
 * （branches 70→80 整改轮 · 第十批）
 *
 * 两条都是玩家真实入口：
 *  · Mod作弊页 → 点模组卡片进详情 → 展开「命令式动作」组 → 点「执行」（正常 / 未实现 / 抛异常 / 面板渲染失败）
 *  · 全局页批量解锁（衣物全解锁 / 食谱全解锁）→ 逐键写入 + 坏条目守卫 + 聚合留痕（type=batch 不可逐键回退）
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

const V = { player: {}, mbCE_wrote: {}, specialClothes: [], foodstuff: {}, gwylanSeen: [] };
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
window.__mbCE_forceSyncRows = true;

/* 假模组：一个用 actions 逐行按钮，一个用 actionPanel 整体接管（含抛异常版本） */
let panelCalls = 0, panelThrowCalls = 0;
setup.mbCE_modCheats = [
  {
    modId: "fake-actions", modName: "动作模组", declared: true,
    actions: [
      { key: "act_ok", name: "正常动作", note: "写入标记", run: function () { V.fakeA = { flag: 1 }; return { ok: true, message: "已写入标记" }; } },
      { key: "act_throw", name: "抛异常动作", run: function () { throw new Error("boom"); } },
      { key: "act_norun", name: "未实现动作" },
      null,
      { name: "缺 key 的动作" }
    ]
  },
  {
    modId: "fake-panel", modName: "面板模组", declared: true,
    actionPanel: function (box) { panelCalls++; box.appendChild(document.createElement("div")); }
  },
  {
    modId: "fake-panel-throw", modName: "面板异常模组", declared: true,
    actionPanel: function () { panelThrowCalls++; throw new Error("panel boom"); }
  }
];

function tab(t) {
  const bs = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of bs) { if (b.getAttribute("data-tab") === t) { b.click(); return true; } }
  return false;
}
function pane() { return document.querySelector('#mce-root [data-pane="mods"]'); }
function statusText() {
  const e = document.querySelector("#mce-root .mce-status, #mce-root .mce-err, #mce-root .mce-ok");
  return e ? e.textContent : "";
}
function openCard(name) {
  const card = Array.prototype.slice.call(pane().querySelectorAll(".mce-card"))
    .filter(function (c) { return c.textContent.indexOf(name) >= 0; })[0];
  if (card) { card.click(); }
  return !!card;
}
function openGroup(gkey) {
  const head = pane().querySelector('[data-mce-head="' + gkey + '"]');
  if (head) { head.click(); }
  return !!head;
}
function btnIn(row, text) {
  if (!row) { return null; }
  const bs = row.querySelectorAll("button");
  for (const b of bs) { if (b.textContent.trim() === text) { return b; } }
  return null;
}

/* ================= 1. actions 逐行按钮 ================= */
section("1 命令式动作（actions 声明）");
api.open();
assert(tab("mods") === true, "切到「Mod作弊」页签");
assert(openCard("动作模组"), "点「动作模组」卡片进入详情");
assert(openGroup("actions"), "展开「命令式动作」分组");
const rowOk = pane().querySelector('[data-mce-key="action:act_ok"]');
assert(!!rowOk, "正常动作行建出（data-mce-key=action:act_ok）");
assert(!!btnIn(rowOk, "执行"), "行内「执行」按钮存在");
assert(rowOk && /写入标记/.test(rowOk.textContent), "note 作为说明同时挂到行上（手机端可读）");
btnIn(rowOk, "执行").click();
assert(V.fakeA && V.fakeA.flag === 1, "点「执行」→ 动作真的写进存档");
assert(/已写入标记/.test(document.body.textContent), "状态栏回显动作返回的 message");
const rowThrow = pane().querySelector('[data-mce-key="action:act_throw"]');
assert(!!rowThrow, "抛异常动作行建出");
btnIn(rowThrow, "执行").click();
assert(/动作抛出异常/.test(document.body.textContent) && /boom/.test(document.body.textContent), "抛异常 → 状态栏显示「动作抛出异常：boom」（不冒泡打断面板）");
const rowNoRun = pane().querySelector('[data-mce-key="action:act_norun"]');
assert(!!rowNoRun, "未实现动作行建出");
btnIn(rowNoRun, "执行").click();
assert(/该动作未实现/.test(document.body.textContent), "run 不是函数 → 明确报「该动作未实现」");
const rows = pane().querySelectorAll('[data-mce-key^="action:"]');
assert(rows.length === 3, "缺 key / null 的动作条目被跳过（只建 3 行）");

/* ================= 2. actionPanel 整体接管 ================= */
section("2 actionPanel 接管");
assert(tab("mods") === true, "回到模组列表");
assert(openCard("面板模组"), "点「面板模组」卡片");
assert(openGroup("actions"), "面板模组也有「命令式动作」组");
assert(panelCalls >= 1, "actionPanel 被调用一次（懒渲染展开时）");
assert(pane().querySelectorAll('[data-mce-key^="action:"]').length === 0, "自带面板时不再逐行铺按钮（不重复入口）");
tab("mods");
assert(openCard("面板异常模组"), "点「面板异常模组」卡片");
openGroup("actions");
assert(panelThrowCalls >= 1, "抛异常的 actionPanel 被调用");
assert(/动作面板渲染失败/.test(pane().textContent), "面板渲染失败 → 组内红字提示（页面不崩）");

/* ================= 3. 全局衣物全解锁（坏条目 + 三种 op） ================= */
section("3 globalUnlockClothes");
setup.specialClothes = null;
const gu0 = api.globalUnlockClothes();
assert(gu0.unlocked === 0 && gu0.stories === 0, "setup.specialClothes 非数组 → 直接返 0（不抛）");
V.specialClothes = [{ name: "rose", unlocked: 0 }, { name: "temple_sparring", unlocked: 0 }];
V.museumAntiques = { paintings: { paintingward: "somewhere", other: 1 } };
setup.specialClothes = [
  null, "not-an-object", { name: "" },
  { name: "rose", sets: ["nonexistent_set"] },
  { name: "vintage", sets: ["vintage"] },
  { name: "temple_sparring", sets: ["temple_sparring"] },
  { name: "brand_new_item", sets: [] }
];
const gu1 = api.globalUnlockClothes();
assert(gu1.unlocked === 4, "坏条目（null / 字符串 / 空 name）被跳过，有效 4 件计入（" + gu1.unlocked + "）");
assert(V.specialClothes.filter(function (e) { return e.name === "brand_new_item"; })[0].unlocked === 3, "新条目建出并标 unlocked=3");
assert(V.specialClothes.filter(function (e) { return e.name === "rose"; })[0].unlocked === 3, "已存在条目原地升级为 unlocked=3（不重复插入）");
assert(V.gwylanSeen.indexOf("rose") >= 0, "单件条件 op=push 写入 gwylanSeen");
assert(V.museumAntiques.paintings.paintingward === "museum", "ensureField 对象值 → 合并画作归属");
assert(V.museumAntiques.paintings.other === 1, "同名兄弟键保留（不覆盖 paintings 其他画）");
assert(V.prof && V.prof.whip === 600, "ensureField 标量值 → temple_sparring 写入 whip=600");
assert(V.mbCE_wrote["cheat:global:unlockClothes"].type === "batch", "聚合留痕 type=batch（不可逐键回退）");
assert(V.mbCE_wrote["cheat:global:unlockClothes"].count === 4, "留痕记录计数 4");
assert(typeof gu1.stories === "number", "联动故事计数返回（" + gu1.stories + "）");

/* ================= 4. 全局食谱全解锁 ================= */
section("4 globalUnlockRecipes");
delete setup.foodstuff;
const gr0 = api.globalUnlockRecipes();
assert(gr0.unlocked === 0, "无 setup.foodstuff → 返 0");
setup.foodstuff = {
  soup: { recipe: { ingredients: ["water", "salt"] } },
  cake: { recipe: { ingredients: [] } },
  pie: { recipe: { ingredients: ["flour"] } },
  broken: null,
  norecipe: {}
};
V.foodstuff = { soup: { amount: 5 }, pie: "not-an-object" };
const gr1 = api.globalUnlockRecipes();
assert(gr1.unlocked === 2, "两份配方非空的食谱被解锁（空 ingredients / 坏定义跳过）");
assert(V.foodstuff.soup.knows_recipe === true, "已有条目保留 amount 并补 knows_recipe");
assert(V.foodstuff.soup.amount === 5, "已有 amount 不被覆盖");
assert(/^not-an-object$/.test(String(V.foodstuff.pie)) === false && V.foodstuff.pie && V.foodstuff.pie.knows_recipe === true, "非对象条目重建后写入 knows_recipe");
assert(V.foodstuff.pie.amount === 0, "重建时 amount 归 0");
assert(V.foodstuff.cake === undefined, "空 ingredients 的食谱不解锁（保持未定义）");
assert(V.mbCE_wrote["cheat:global:unlockRecipes"].count === 2, "食谱批量留痕计数 2");

api.close();
console.log("\nMOD ACTIONS BATCH: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
