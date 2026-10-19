/*
 * DOM 冒烟测试（v1.9.0 工程化第 2 项）：
 * 用 jsdom 真实 DOM 复现浏览器语义（select.type 只读抛错、querySelector/click 等），
 * 渲染各面板并模拟用户点击，验证不崩溃 + 关键 DOM 与交互正确。
 * 弥补 test_mce.js 手写 mock 与真实浏览器语义不一致的盲区（v1.8.4 select.type 崩溃漏检）。
 * 用法：node tests/smoke_dom.js（构建产物需已生成：node tools/build_js.js）
 */
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

/* ---------- 1. jsdom 环境 ---------- */
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;

/* select.type 只读：真实浏览器 setter 抛 TypeError，jsdom 静默忽略 → patch 原型完全复现 */
try {
  Object.defineProperty(window.HTMLSelectElement.prototype, "type", {
    get: function () { return "select-one"; },
    set: function () { throw new TypeError("Cannot set property type of #<HTMLSelectElement> which has only a getter"); },
    configurable: true
  });
  console.log("PASS: select.type 已 patch 为只读抛错（复现真实浏览器）");
} catch (e) { console.error("WARN: patch select.type 失败:", e.message); }

/* ---------- 2. 游戏全局最小模拟 ---------- */
const V = {
  player: { virginity: { vaginal: true, penile: false }, charisma: 10, beauty: 20, physique: 30, willpower: 40, awareness: 50, arousal: 60, exhibitionism: 70, deviancy: 80, purity: 90, trauma: 10, stress: 5, stress100: 5, control: 50 },
  temple_burden: 0,
  loveInterest: [],
  passage: "Room",
  scenePassages: [],
  mbCE_wrote: {}
};
global.V = V;
global.State = { variables: V };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [] };
global.passage = function () { return "Room"; };
/* 框架探测：默认无第三方模组；枯木逢春命中在 Mod作弊节注入 */
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };

/* ---------- 3. 加载构建产物（eval 后 init 自动建面板） ---------- */
const js = fs.readFileSync(path.join(__dirname, "..", "javascript", "maplebirchce.js"), "utf8");
eval(js);
const api = setup.mbStageCE;
assert(!!api && typeof api.renderPlayerEdit === "function", "setup.mbStageCE 挂载且 renderPlayerEdit 可用");
assert(!!document.querySelector("#mce-root"), "init→ensureDom 创建面板 #mce-root");

/* ---------- 4. 玩家页冒烟（v1.8.4 select.type 崩溃路径） ---------- */
api.renderPlayerEdit();
const modsPane = document.querySelector('[data-pane="mods"]');
assert(!!modsPane, "mods pane 存在");
const selects = modsPane.querySelectorAll("select");
assert(selects.length >= 1, "系列行渲染出 select（≥1），实际 " + selects.length);
assert(selects[0].type === "select-one", "select.type 为只读 select-one");
const txt = modsPane.textContent;
assert(txt.indexOf("特质管理") !== -1, "特质管理区渲染");
assert(txt.indexOf("受虐狂") !== -1, "系列行 受虐狂 渲染");
assert(txt.indexOf("游戏属性面板") !== -1, "属性快捷编辑区渲染");
/* 交互 1：跳至最高 → masochism_level=4 */
const maxBtns = [].slice.call(modsPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("跳至最高") !== -1; });
assert(maxBtns.length >= 1, "跳至最高按钮存在");
if (maxBtns[0]) { maxBtns[0].click(); }
assert(V.masochism_level === 4, "点击跳至最高 → masochism_level=4，实际 " + V.masochism_level);
/* 交互 2：回退初始 → 0 */
const initBtns = [].slice.call(modsPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("回退初始") !== -1; });
if (initBtns[0]) { initBtns[0].click(); }
assert(V.masochism_level === 0, "点击回退初始 → masochism_level=0，实际 " + V.masochism_level);
/* 交互 3：受虐狂系列行下拉选 2 + 应用 → 2（定位该行，不点错行） */
const masoRow = [].slice.call(modsPane.querySelectorAll(".mce-row")).filter(function (row) {
  const lbl = row.querySelector(".mce-row-lbl");
  return lbl && lbl.textContent.indexOf("受虐狂（当前") !== -1;
})[0];
assert(!!masoRow, "受虐狂系列行存在");
if (masoRow) {
  const ms = masoRow.querySelector("select");
  ms.value = "2";
  const mApp = [].slice.call(masoRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "应用"; })[0];
  mApp.click();
  assert(V.masochism_level === 2, "受虐狂下拉选 2 + 应用 → masochism_level=2，实际 " + V.masochism_level);
}
/* 交互 4：强制获得（无可写条件特质 Pregnant）→ 记入标记；重新渲染后该行显示移除 */
const pregTrait = api.compileVanillaTraits().filter(function (t) { return t.name === "Pregnant"; })[0];
assert(!!pregTrait, "Pregnant 特质存在于静态表");
if (pregTrait) {
  const gRes = api.grantTrait(pregTrait, V);
  assert(Array.isArray(V.mbCE_forcedTraits) && V.mbCE_forcedTraits.length === 1, "grantTrait(Pregnant) → 强制获得标记，实际 " + JSON.stringify(V.mbCE_forcedTraits));
  api.renderPlayerEdit();
  const pregRowTxt = [].slice.call(modsPane.querySelectorAll(".mce-row")).filter(function (row) {
    const lbl = row.querySelector(".mce-row-lbl");
    return lbl && lbl.textContent.indexOf("怀孕") !== -1;
  })[0];
  assert(!!pregRowTxt && pregRowTxt.textContent.indexOf("移除") !== -1, "重新渲染后怀孕行显示 移除（强制获得生效），实际 " + (pregRowTxt ? pregRowTxt.textContent.slice(0, 40) : "无"));
  api.revokeTrait(pregTrait, V);
  assert(!V.mbCE_forcedTraits || V.mbCE_forcedTraits.length === 0, "revokeTrait → 强制标记清空");
}

/* ---------- 5. Mod作弊页冒烟（模拟枯木逢春命中） ---------- */
window.maplebirch.get = function (k) { return k === "DeadwoodReblooms" ? {} : null; };
const cheats = api.getCheatMods();
assert(cheats.some(function (m) { return m.modId === "deadwood-reblooms"; }), "枯木逢春适配器探测命中，实际 " + cheats.map(function (m) { return m.modId; }).join(","));
api.renderModCheats();
const listTxt = document.querySelector('[data-pane="mods"]').textContent;
assert(listTxt.indexOf("枯木逢春") !== -1, "Mod作弊主容器显示 枯木逢春");
api.renderModCheatDetail("deadwood-reblooms");
const detailTxt = document.querySelector('[data-pane="mods"]').textContent;
assert(detailTxt.indexOf("店铺开办阶段") !== -1, "枯木逢春子页面渲染阶段控件，实际 " + detailTxt.slice(0, 200));
const dSelects = document.querySelector('[data-pane="mods"]').querySelectorAll("select");
assert(dSelects.length >= 1 && dSelects[0].type === "select-one", "子页面阶段下拉 select 只读 select-one，实际 " + dSelects.length + " 个");

/* ---------- 6. 属性面板快捷编辑（quickWrite 顶层键） ---------- */
const r = api.quickWrite("purity", "15");
assert(!!r && V.purity === 15, "quickWrite 改纯洁 purity=15，实际 " + V.purity);

/* ---------- 7. 其余外层标签冒烟（角色/阶段/剧情/场景/全局） ---------- */
/* 之前只覆盖 mods（玩家页 + Mod作弊页）；这里模拟点击外层标签，逐个验证剩余 5 页 DOM 渲染不崩 */
V.NPCName = [{ nam: "Robin" }, { nam: "Whitney" }];
const tabBtns = document.querySelectorAll('.mce-tabs button[data-tab]');
assert(tabBtns.length >= 6, "外层标签按钮 >=6，实际 " + tabBtns.length);
function clickTabSafe(name) {
  try {
    const btn = document.querySelector('.mce-tabs button[data-tab="' + name + '"]');
    if (btn) { btn.click(); }
    const p = document.querySelector('[data-pane="' + name + '"]');
    return p ? p.textContent : "(pane 缺失)";
  } catch (e) { return "THREW: " + e.message; }
}
let ptxt = clickTabSafe("char");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "角色页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("stage");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "阶段页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("scenes");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "剧情页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("places");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "场景直达页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("global");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "全局页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("mods");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "切回 Mod作弊页渲染正常");

console.log(failures === 0 ? "\nSMOKE ALL PASSED" : "\nSMOKE " + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
