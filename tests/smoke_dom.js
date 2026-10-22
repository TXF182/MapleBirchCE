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
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
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
/* v1.8.12 持久化：把 jsdom 的 localStorage 挂到全局，主代码 typeof localStorage 才能命中 */
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
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
/* 九巡懒渲染：收起组不建行——先全部展开，后续系列行/数值行断言才能命中 */
const openAll0 = [].slice.call(modsPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "全部展开"; })[0];
if (openAll0) { openAll0.click(); }
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

/* v1.8.12 收藏功能 DOM 冒烟：☆按钮 → 点击 → 收藏组置顶渲染 → 取消 */
const favBtn0 = [].slice.call(modsPane.querySelectorAll(".mce-row button")).filter(function (b) { return b.textContent === "☆" || b.textContent === "★"; })[0];
assert(!!favBtn0, "特质行渲染收藏按钮（☆/★），实际 " + (favBtn0 ? favBtn0.textContent : "无"));
const favPreg = api.compileVanillaTraits().filter(function (t) { return t.name === "Pregnant"; })[0];
if (favPreg) {
  const toggled = api.toggleFavTrait(favPreg, V);
  assert(toggled.ok && toggled.fav === true, "收藏 Pregnant 成功（数据层）");
  api.renderPlayerEdit();
  const grpTxt = [].slice.call(modsPane.querySelectorAll(".mce-grp-t")).map(function (h) { return h.textContent; }).join("|");
  assert(grpTxt.indexOf("已收藏") !== -1, "「★ 已收藏」组渲染，实际 " + grpTxt.slice(0, 120));
  /* v1.8.15 懒渲染：收藏组默认收起不建行 → 展开后才可见行（点击标题补建） */
  const favHeadLazy = modsPane.querySelector('.mce-grp[data-tcat="★ 已收藏"] .mce-grp-t');
  if (favHeadLazy && favHeadLazy.nextElementSibling && favHeadLazy.nextElementSibling.getAttribute("data-collapsed") === "1") { favHeadLazy.click(); }
  const favRows = [].slice.call(modsPane.querySelectorAll('.mce-grp[data-tcat="★ 已收藏"] .mce-row'));
  assert(favRows.length === 1 && favRows[0].textContent.indexOf("怀孕") !== -1, "收藏组含 Pregnant（怀孕）行，实际 " + favRows.length + " 行");
  /* 收藏组在特质区最前（属性面板组无 data-tcat，第一个带 data-tcat 的组即特质区首个分组） */
  const firstGrpT = modsPane.querySelector(".mce-grp[data-tcat] .mce-grp-t");
  assert(firstGrpT && firstGrpT.textContent.indexOf("已收藏") !== -1, "收藏组置顶（特质区第一个分组），实际 " + (firstGrpT ? firstGrpT.textContent.slice(0, 20) : "无"));
  /* 点击 ★ 取消收藏 → 收藏组消失 */
  const starBtn = [].slice.call(modsPane.querySelectorAll('.mce-grp[data-tcat="★ 已收藏"] .mce-row button')).filter(function (b) { return b.textContent === "★"; })[0];
  if (starBtn) { starBtn.click(); }
  api.renderPlayerEdit();
  const grpTxt2 = [].slice.call(modsPane.querySelectorAll(".mce-grp-t")).map(function (h) { return h.textContent; }).join("|");
  assert(grpTxt2.indexOf("已收藏") === -1, "取消收藏后「★ 已收藏」组消失，实际 " + grpTxt2.slice(0, 120));
  delete V.mbCE_favTraits;
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
/* v1.8.7 能力/数值项说明折叠（学 CE 逐项数值文档） */
const abDetails = document.querySelector('[data-pane="mods"]').querySelectorAll(".mce-ab-detail");
assert(abDetails.length >= 1, "能力/数值行渲染「说明」折叠（≥1），实际 " + abDetails.length);
const abFirst = abDetails[0].textContent || "";
assert(abFirst.indexOf("写入路径：") !== -1 && abFirst.indexOf("类型：") !== -1, "说明折叠含 写入路径+类型，实际 " + abFirst.slice(0, 80));
const detailTxt2 = document.querySelector('[data-pane="mods"]').textContent;
assert(detailTxt2.indexOf("说明：") !== -1, "note 手写说明已渲染，实际 " + detailTxt2.slice(0, 300));

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
/* v1.9.0 角色页四分类折叠：jsdom 真实 querySelector + data-collapsed 点击切换 */
const perGrp = document.querySelector('.mce-grp[data-tcat="持久NPC"]');
const perBody = perGrp && perGrp.querySelector(".mce-grp-body");
assert(!!perGrp && !!perBody, "角色页「持久NPC」分组存在（jsdom）");
assert(perBody.getAttribute("data-collapsed") === "1", "持久NPC分组默认收起 data-collapsed=1（jsdom）");
const perHead = perGrp.querySelector(".mce-grp-t");
perHead.click();
assert(perBody.getAttribute("data-collapsed") === "0", "点击标题 → 持久NPC分组展开 data-collapsed=0（jsdom）");
const loveGrp = document.querySelector('.mce-grp[data-tcat="恋爱角色"]');
assert(!!loveGrp && loveGrp.textContent.indexOf("罗宾") !== -1, "恋爱角色分组含 罗宾（jsdom），实际 " + (loveGrp ? loveGrp.textContent.slice(0, 60) : "无"));
ptxt = clickTabSafe("stage");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "阶段页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("scenes");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "剧情页渲染不崩，实际 " + ptxt.slice(0, 50));
ptxt = clickTabSafe("places");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "场景直达页渲染不崩，实际 " + ptxt.slice(0, 50));
/* v1.9.0 场景页双层页签：真实 jsdom classList/内容切换（mock 层盲区，jsdom 层验证真实 DOM 语义） */
const placesPane = document.querySelector('[data-pane="places"]');
const placeStageBtn = placesPane.querySelector('.mce-inner button[data-place="stage"]');
assert(!!placeStageBtn, "场景页「地点」子页签按钮存在（jsdom）");
placeStageBtn.click();
assert(placesPane.textContent.indexOf("市政改造") !== -1 && placesPane.textContent.indexOf("拉满") !== -1, "点击「地点」页签 → 地点阶段任务区渲染（jsdom），实际 " + placesPane.textContent.slice(0, 80));
/* renderPlaces 重建 pane 子节点 → 按钮被替换，需重新查询（旧引用 classList 不更新） */
const stageBtnNew = placesPane.querySelector('.mce-inner button[data-place="stage"]');
assert(!!stageBtnNew && stageBtnNew.classList.contains("mce-active"), "「地点」页签 classList 含 mce-active（真实 classList.toggle 语义）");
const placeDirectBtn = placesPane.querySelector('.mce-inner button[data-place="direct"]');
placeDirectBtn.click();
const directBtnNew = placesPane.querySelector('.mce-inner button[data-place="direct"]');
assert(!!directBtnNew && directBtnNew.classList.contains("mce-active") && placesPane.textContent.indexOf("场景直达") !== -1, "切回「场景直达」页签激活（jsdom）");
ptxt = clickTabSafe("global");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "全局页渲染不崩，实际 " + ptxt.slice(0, 50));
/* v1.8.8 全局页新区：战斗终结（学 CombatTerminator）+ 庄园自动维护（学 AutoClean） */
const globalPane = document.querySelector('[data-pane="global"]');
const gtxt = globalPane.textContent;
assert(gtxt.indexOf("战斗终结") !== -1 && gtxt.indexOf("庄园自动维护") !== -1, "全局页含 战斗终结+庄园自动维护 两区，实际 " + gtxt.slice(0, 120));
const btBtns = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自我了断") !== -1; });
assert(btBtns.length === 1, "战斗终结「自我了断」按钮存在");
if (btBtns[0]) { btBtns[0].click(); }
assert(V.pain === 1000, "点击自我了断 → V.pain=1000，实际 " + V.pain);
const feedBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键投喂艾弗里") !== -1; });
assert(feedBtn.length === 1, "庄园维护「一键投喂艾弗里」按钮存在");
const farmBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键农场维护") !== -1; });
assert(farmBtn.length === 1, "庄园维护「一键农场维护」按钮存在");
/* v1.8.10 维护扩展按钮：神殿/伊甸/补给/打扫 */
const templeBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键神殿维护") !== -1; });
assert(templeBtn.length === 1, "庄园维护「一键神殿维护」按钮存在");
if (templeBtn[0]) { templeBtn[0].click(); }
const edenBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键伊甸维护") !== -1; });
assert(edenBtn.length === 1, "庄园维护「一键伊甸维护」按钮存在");
if (edenBtn[0]) { edenBtn[0].click(); }
const restockBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键补给") !== -1; });
assert(restockBtn.length === 1, "庄园维护「一键补给」按钮存在");
if (restockBtn[0]) { restockBtn[0].click(); }
const cleanBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键庄园打扫") !== -1; });
assert(cleanBtn.length === 1, "庄园维护「一键庄园打扫」按钮存在");
if (cleanBtn[0]) { cleanBtn[0].click(); }
/* v1.8.8 三个新适配器：注入探测 mock 后 Mod作弊 页出现 */
window.DolOptimization = {};
window.MirrorHypnoVariableRefresh = function () {};
V.WraithsReflection = 1;
V.mbCE_wrote = {};
api.renderModCheats();
const modsTxt2 = document.querySelector('[data-pane="mods"]').textContent;
assert(modsTxt2.indexOf("Dol-Optimization") !== -1 && modsTxt2.indexOf("幽灵的倒影") !== -1 && modsTxt2.indexOf("DoLSims") !== -1, "Mod作弊 页渲染三新适配器，实际 " + modsTxt2.slice(0, 300));
delete window.DolOptimization; delete window.MirrorHypnoVariableRefresh; delete V.WraithsReflection;
ptxt = clickTabSafe("mods");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "切回 Mod作弊页渲染正常");

/* ---------- 8. v1.8.12 错误收集器 + 面板状态持久化 ---------- */
const errBtn0 = document.querySelector(".mce-errbtn");
assert(!!errBtn0, "错误红点按钮存在（mce-errbtn）");
api.mbCEPushError("mce-test-err", "test.js:1", "Error: mce-test-err\n  at test.js:1");
assert(api.mbCEErrors().length === 1, "推入错误后收集器 1 条，实际 " + api.mbCEErrors().length); /* badge 文本 200ms 节流，最终一致性在 11.3 复核 */
errBtn0.click();
const errBox = document.querySelector(".mce-errbox");
assert(!!errBox && errBox.classList.contains("mce-on"), "点击红点展开错误列表箱");
assert(errBox.textContent.indexOf("mce-test-err") !== -1 && errBox.textContent.indexOf("test.js:1") !== -1, "错误列表含 报错信息+来源，实际 " + errBox.textContent.slice(0, 120));
const copyB = [].slice.call(errBox.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("复制全部") !== -1; })[0];
assert(!!copyB, "错误列表「复制全部」按钮存在");
const clearB = [].slice.call(errBox.querySelectorAll("button")).filter(function (b) { return b.textContent === "清空"; })[0];
assert(!!clearB, "错误列表「清空」按钮存在");
clearB.click();
assert(api.mbCEErrors().length === 0 && !errBtn0.classList.contains("mce-on"), "清空后错误数与红点归零");
/* 持久化：切页签 → localStorage 记录；搜索词写入记录 */
const globalTab = document.querySelector('.mce-tabs button[data-tab="global"]');
globalTab.click();
let savedState = null;
try { savedState = JSON.parse(window.localStorage.getItem("mbCE_ui_state_v1")); } catch (e2) {}
assert(!!savedState && savedState.tab === "global", "切到全局页 → localStorage 记录 tab=global，实际 " + (savedState ? savedState.tab : "无"));
api.mbCEUiSave({ filter: "受虐" });
savedState = JSON.parse(window.localStorage.getItem("mbCE_ui_state_v1"));
assert(!!savedState && savedState.filter === "受虐", "搜索词持久化写入 localStorage，实际 " + (savedState ? savedState.filter : "无"));
api.mbCEUiSave({ tab: "char", filter: "" });

/* ---------- 9. v1.8.12 优化复验：相对语法 UI 可输入 + 折叠箭头恢复 + Promise 拒绝收集 ---------- */
/* 9.1 快速属性纯度行：数值框为 text+decimal（number 框会拒绝 + 号），输入 +5 相对调整生效 */
api.renderPlayerEdit();
V.purity = 10;
const purityRow2 = [].slice.call(modsPane.querySelectorAll(".mce-row")).filter(function (row) {
  const lbl = row.querySelector(".mce-row-lbl");
  return lbl && lbl.textContent.indexOf("纯洁（当前") !== -1;
})[0];
assert(!!purityRow2, "快速属性「纯洁」行存在");
const purityInp = purityRow2.querySelector("input");
assert(!!purityInp && purityInp.type === "text" && purityInp.inputmode === "decimal", "纯度数值框 type=text+inputmode=decimal（可输入 +N/-N），实际 type=" + (purityInp ? purityInp.type : "无"));
purityInp.value = "+5";
const purityApp = [].slice.call(purityRow2.querySelectorAll("button")).filter(function (b) { return b.textContent === "应用"; })[0];
purityApp.click();
assert(V.purity === 15, "UI 输入 +5 应用 → purity 相对 +5=15，实际 " + V.purity);
/* 9.2 特质数值行（traitWriteValue）输入框 text（定位含「改数值」按钮的行），并验证 +N 相对写入 */
delete V.temple_burden;
api.renderPlayerEdit();
const ntRow = [].slice.call(modsPane.querySelectorAll(".mce-row")).filter(function (row) {
  return [].slice.call(row.querySelectorAll("button")).some(function (b) { return b.textContent === "改数值"; });
})[0];
assert(!!ntRow, "特质数值行（含「改数值」按钮）存在");
const ntInp = ntRow.querySelector("input");
assert(!!ntInp && ntInp.type === "text" && ntInp.inputmode === "decimal", "特质数值行输入框 type=text+inputmode=decimal（可输入 +N/-N），实际 type=" + (ntInp ? ntInp.type : "无"));
ntInp.value = "+5";
const ntApply = [].slice.call(ntRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "改数值"; })[0];
ntApply.click();
assert(V.temple_burden === 5, "特质数值行 UI 输入 +5 → temple_burden 相对 +5=5，实际 " + V.temple_burden);
/* 9.3 折叠箭头恢复：收藏 Pregnant → 「★ 已收藏」组（bodyFor 折叠组）展开 → 重渲染后 ▾ + 展开态保持 */
const favP2 = api.compileVanillaTraits().filter(function (t) { return t.name === "Pregnant"; })[0];
if (favP2) { api.toggleFavTrait(favP2, V); }
api.renderPlayerEdit();
const favHead = [].slice.call(modsPane.querySelectorAll('.mce-grp[data-tcat="★ 已收藏"] .mce-grp-t')).filter(function (h) { return h.textContent.indexOf("已收藏") !== -1; })[0];
assert(!!favHead, "「★ 已收藏」折叠组标题存在");
const favBody = favHead.nextElementSibling;
assert(favBody && favBody.getAttribute("data-collapsed") === "1", "收藏组初始收起（data-collapsed=1）");
favHead.click();
assert(favBody.getAttribute("data-collapsed") === "0" && favHead.textContent.indexOf("▾") === 0, "点击后展开（data-collapsed=0 + ▾ 箭头）");
api.renderPlayerEdit();
const favHead2 = [].slice.call(modsPane.querySelectorAll('.mce-grp[data-tcat="★ 已收藏"] .mce-grp-t')).filter(function (h) { return h.textContent.indexOf("已收藏") !== -1; })[0];
assert(!!favHead2 && favHead2.textContent.indexOf("▾") === 0, "重渲染后收藏组保持展开 + ▾ 箭头（持久化恢复），实际 " + (favHead2 ? favHead2.textContent.slice(0, 12) : "无"));
const favBody2 = favHead2.nextElementSibling;
assert(favBody2.getAttribute("data-collapsed") === "0", "重渲染后展开态保持（data-collapsed=0）");
favHead2.click();
delete V.mbCE_favTraits;
api.mbCEUiSave({ collapsed: {} });
api.mbCEUiSave({ tab: "char", filter: "" });
/* 9.4 Promise 拒绝（unhandledrejection）进错误收集器 */
const errCount0 = api.mbCEErrors().length;
const rejEv = new window.Event("unhandledrejection");
Object.defineProperty(rejEv, "reason", { value: new Error("pr-reject-test") });
window.dispatchEvent(rejEv);
const errCount1 = api.mbCEErrors().length;
assert(errCount1 === errCount0 + 1 && api.mbCEErrors()[errCount1 - 1].msg.indexOf("pr-reject-test") !== -1, "Promise 拒绝入错误收集器，实际 " + (errCount1 - errCount0) + " 条，msg=" + api.mbCEErrors()[errCount1 - 1].msg.slice(0, 40));

/* ---------- 10. v1.8.12 二轮优化：错误去重合并 / 全部展开收起 / 角色记忆 / 残留键清理 / 时间戳 ---------- */
/* 10.1 同源错误 30 秒内合并计数（×N） */
const dedup0 = api.mbCEErrors().length;
api.mbCEPushError("重复错误", "src-x", "stack-x");
api.mbCEPushError("重复错误", "src-x", "stack-x");
api.mbCEPushError("重复错误", "src-x", "stack-x");
const dedup1 = api.mbCEErrors();
assert(dedup1.length === dedup0 + 1 && dedup1[dedup1.length - 1].n === 3, "同源错误合并计数（1 条 ×3），实际 " + (dedup1.length - dedup0) + " 条 n=" + (dedup1.length ? dedup1[dedup1.length - 1].n : "-"));
/* 10.2 折叠工具：全部展开 → 全部 data-collapsed=0 + ▾；全部收起 → 全 1 */
api.mbCEUiSave({ collapsed: {} });
api.renderPlayerEdit();
const bAllOpen = [].slice.call(modsPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "全部展开"; })[0];
const bAllClose = [].slice.call(modsPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "全部收起"; })[0];
assert(!!bAllOpen && !!bAllClose, "折叠工具行（全部展开/全部收起）存在");
bAllOpen.click();
const grpBodies = [].slice.call(modsPane.querySelectorAll(".mce-grp-body"));
assert(grpBodies.length > 0 && grpBodies.every(function (b) { return b.getAttribute("data-collapsed") === "0"; }), "全部展开后所有组 data-collapsed=0（共 " + grpBodies.length + " 组）");
assert([].slice.call(modsPane.querySelectorAll(".mce-grp-t.mce-collapse-head")).every(function (h) { return h.textContent.indexOf("▾") === 0; }), "全部展开后组标题均为 ▾");
bAllClose.click();
assert(grpBodies.every(function (b) { return b.getAttribute("data-collapsed") === "1"; }), "全部收起后所有组 data-collapsed=1");
api.mbCEUiSave({ collapsed: {} });
/* 10.3 角色记忆：mbCEUiSave/ mbCEUiLoad 往返 */
api.mbCEUiSave({ curName: "Robin" });
assert(api.mbCEUiState().curName === "Robin", "mbCEUiSave 记录当前角色 curName=Robin，实际 " + api.mbCEUiState().curName);
window.localStorage.setItem("mbCE_ui_state_v1", JSON.stringify({ tab: "stage", filter: "", collapsed: {}, curName: "Whitney", innerTab: "transform" }));
api.mbCEUiLoad();
assert(api.mbCEUiState().curName === "Whitney" && api.mbCEUiState().innerTab === "transform" && api.mbCEUiState().tab === "stage", "mbCEUiLoad 恢复角色/内层页签/页签，实际 " + api.mbCEUiState().curName + "/" + api.mbCEUiState().innerTab + "/" + api.mbCEUiState().tab);
api.mbCEUiSave({ tab: "char", filter: "", curName: "", innerTab: "romance" });
/* 10.4 折叠残留键清理（全量渲染时删除不存在的分类键，保留存在的） */
api.mbCEUiSave({ collapsed: { "幽灵分类": 1, "一般特质": 1 } });
api.renderPlayerEdit();
const clnState = api.mbCEUiState().collapsed;
assert(!("幽灵分类" in clnState) && ("一般特质" in clnState), "残留键清理：幽灵分类已删、一般特质保留，实际 keys=" + Object.keys(clnState).join(","));
api.mbCEUiSave({ collapsed: {} });
/* 10.5 错误行时间戳 [HH:MM:SS]（第 8 节已点开过 errBox——若当前开着，先点关再点开重新渲染） */
const errBoxEl10 = document.querySelector(".mce-errbox");
const errWasOn = errBoxEl10 && errBoxEl10.className.indexOf("mce-on") !== -1;
const errBtn10 = document.querySelector(".mce-errbtn");
errBtn10.click();
if (errWasOn) { errBtn10.click(); }
const errMsgTexts = [].slice.call(document.querySelectorAll(".mce-err-msg")).map(function (n) { return n.textContent; });
assert(errMsgTexts.some(function (t) { return /\[\d\d:\d\d:\d\d\]/.test(t); }), "错误行含 [HH:MM:SS] 时间戳，实际 " + JSON.stringify(errMsgTexts.slice(0, 3)));

/* ---------- 11. v1.8.12 三巡优化：错误风暴熔断（DoLGameUI 等特效层每帧刷屏不再卡顿/闪退） ---------- */
/* 12.1 面板开关与 badge 写入解耦（五巡：置于非熔断期验证真实路径——面板关闭时 push 只记数据不写 badge，重开立即刷新） */
const badgeA = document.querySelector(".mce-errbtn");
const badgeA0 = badgeA.textContent;
api.mbCEPushError("关闭期错误-A", "x", "y");
assert(badgeA.textContent === badgeA0, "面板关闭时 push 不更新 badge（保持 " + badgeA0 + "）");
api.open();
assert(badgeA.textContent === String(api.mbCEErrors().length), "重开面板后 badge 立即刷新（" + badgeA.textContent + " vs " + api.mbCEErrors().length + "）");
api.close();
/* 11.1 同源 30 连发 → 合并为 1 条 ×N，不爆炸 */
const fuse0 = api.mbCEErrors().length;
for (let i = 0; i < 30; i++) { api.mbCEPushError("DoLGameUI spotlight src", "layer", "stack-" + i); }
const fuse1 = api.mbCEErrors();
const fuseLast = fuse1[fuse1.length - 1];
assert(fuse1.length - fuse0 === 1 && fuseLast.msg.indexOf("spotlight") !== -1, "同源 30 连发合并为 1 条（n=" + (fuseLast ? fuseLast.n : "-") + "），实际 +" + (fuse1.length - fuse0) + " 条");
/* 11.2 全局熔断：200 条异源受 50 上限约束并触发全熔断，熔断后 20 条不再新增 */
const fuseAll0 = api.mbCEErrors().length;
for (let j = 0; j < 200; j++) { api.mbCEPushError("异源-" + j, "layer", "x"); }
const fuseAll1 = api.mbCEErrors().length;
for (let k = 0; k < 20; k++) { api.mbCEPushError("after-fuse", "layer", "x"); }
const fuseAll2 = api.mbCEErrors().length;
assert(fuseAll1 - fuseAll0 <= 50, "全局异源 200 连发受 50 上限约束（实际 +" + (fuseAll1 - fuseAll0) + " 条）");
assert(fuseAll2 === fuseAll1, "全熔断后 20 条不再新增（实际 +" + (fuseAll2 - fuseAll1) + " 条）");

/* 11.3 badge 节流最终一致性 + 熔断提示 + 12.2 异源连发稳健 */
setTimeout(function () {
  const badge = document.querySelector(".mce-errbtn");
  const n = api.mbCEErrors().length;
  api.open(); /* 打开面板 → force 刷新 badge（关闭期只记数据不写 DOM） */
  assert(badge.textContent === String(n), "badge 节流后最终数字与条数一致（" + badge.textContent + " vs " + n + "）");
  assert(badge.title.indexOf("熔断") !== -1, "熔断期 badge 提示含 ⚠ 熔断，实际 title=" + badge.title.slice(-18));
  /* 12.2 异源 300 连发稳健（熔断计数表有界 + 收集器 50 上限） */
  const f0 = api.mbCEErrors().length;
  for (let m = 0; m < 300; m++) { api.mbCEPushError("异源C-" + m, "l", "x"); }
  const f1 = api.mbCEErrors().length;
  assert(f1 <= 50 && f1 - f0 <= 50, "异源 300 连发后收集器受 50 上限（" + f1 + "）且无异常");
  /* ---------- 13. 五巡：Mod作弊 页局部行更新（操作只刷一行，不全量重建整个模组页） ---------- */
  setup.mbCE_modCheats = [{
    modId: "mockmod", modName: "测试模组",
    tasks: [{ key: "t1", name: "测试任务" }],
    stages: [{ key: "s1", name: "阶段S", varPath: "mock_stage", levels: [0, 1, 2], labels: ["零", "一", "二"] }],
    abilities: [{ key: "a1", name: "能力A", varPath: "mock_ability" }],
    scenes: [{ key: "sc1", name: "剧情X" }],
    values: [{ key: "v1", name: "数值V", varPath: "mock_value" }]
  }];
  V.mock_stage = 0; V.mock_ability = false; V.mock_value = 10;
  api.renderModCheatDetail("mockmod");
  const mpane = document.querySelector('[data-pane="mods"]');
  const rowsBefore = mpane.querySelectorAll(".mce-row").length;
  const msel = mpane.querySelector("select");
  msel.value = "2";
  const setBtn = [].slice.call(mpane.querySelectorAll("button")).filter(function (b) { return b.textContent === "应用"; })[0];
  setBtn.click();
  assert(V.mock_stage === 2, "阶段应用写入 V.mock_stage=2，实际 " + V.mock_stage);
  assert(msel.selectedIndex === 2, "阶段下拉局部回显 selectedIndex=2，实际 " + msel.selectedIndex);
  const rowsAfter = mpane.querySelectorAll(".mce-row").length;
  assert(rowsAfter === rowsBefore, "阶段应用后行数不变（局部更新 " + rowsBefore + " → " + rowsAfter + "）");
  const abBox = [].slice.call(mpane.querySelectorAll('input[type="checkbox"]'))[0];
  abBox.click();
  assert(V.mock_ability === true, "能力勾选写入 V.mock_ability=true，实际 " + V.mock_ability);
  assert(abBox.checked === true, "能力勾选局部回显 checked=true");
  assert(mpane.querySelectorAll(".mce-row").length === rowsBefore, "能力勾选后行数不变（局部更新）");
  const vinp = [].slice.call(mpane.querySelectorAll("input.mce-inp"))[0];
  vinp.value = "+5";
  const applyV = [].slice.call(mpane.querySelectorAll("button")).filter(function (b) { return b.textContent === "应用修改"; })[0];
  applyV.click();
  assert(V.mock_value === 15, "相对 +5 写入 V.mock_value=15，实际 " + V.mock_value);
  assert(vinp.value === "15", "数值输入框局部回显 15，实际 " + vinp.value);
  assert(mpane.querySelectorAll(".mce-row").length === rowsBefore, "数值应用后行数不变（局部更新）");
  delete setup.mbCE_modCheats;
  /* 13.2 快速面板数值局部更新（玩家编辑页——操作只刷一行，不再全量重建 33 行 + 特质区） */
  api.renderPlayerEdit();
  const qpane = document.querySelector('[data-pane="mods"]');
  const qRows0 = qpane.querySelectorAll(".mce-row").length;
  const purityRow = [].slice.call(qpane.querySelectorAll(".mce-row")).filter(function (r) { return r.textContent.indexOf("纯洁") !== -1; })[0];
  const purityInp = purityRow.querySelector("input.mce-inp");
  const purityBtn = purityRow.querySelector("button");
  const pBefore = (typeof V.purity === "number") ? V.purity : 0;
  purityInp.value = "+10";
  purityBtn.click();
  assert(V.purity === pBefore + 10, "纯洁 +10 写入（" + pBefore + "→" + V.purity + "）");
  assert(purityInp.value === String(pBefore + 10), "快速面板输入框局部回显（" + purityInp.value + "）");
  assert(qpane.querySelectorAll(".mce-row").length === qRows0, "快速面板应用后行数不变（局部更新 " + qRows0 + "）");
  /* 13.3 七巡：核心属性钳制上限修正——八巡扩展：5 属性无上限（写超 2000 应成功），beauty 无上限 */
  api.renderPlayerEdit();
  const qp2 = document.querySelector('[data-pane="mods"]');
  function quickRowByLabel(lbl) {
    return [].slice.call(qp2.querySelectorAll(".mce-row")).filter(function (r) { return r.textContent.indexOf(lbl) !== -1; })[0];
  }
  function quickApply(lbl, val) {
    const row = quickRowByLabel(lbl);
    const inp = row.querySelector("input.mce-inp");
    const btn = row.querySelector("button");
    inp.value = String(val);
    btn.click();
  }
  quickApply("意志", 5000);
  assert(V.willpower === 5000, "意志可写入 5000（无上限）实际 " + V.willpower);
  quickApply("意识", 5000);
  assert(V.awareness === 5000, "意识可写入 5000（无上限）实际 " + V.awareness);
  quickApply("淫乱", 5000);
  assert(V.promiscuity === 5000, "淫乱可写入 5000（无上限）实际 " + V.promiscuity);
  quickApply("暴露癖", 5000);
  assert(V.exhibitionism === 5000, "暴露癖可写入 5000（无上限）实际 " + V.exhibitionism);
  quickApply("异种癖", 5000);
  assert(V.deviancy === 5000, "异种癖可写入 5000（无上限）实际 " + V.deviancy);
  const bRow = quickRowByLabel("容貌");
  const bInp = bRow.querySelector("input.mce-inp");
  const bBtn = bRow.querySelector("button");
  bInp.value = "50000";
  bBtn.click();
  assert(V.beauty === 50000, "容貌可写入 50000（无硬上限，修复前被钳 100）实际 " + V.beauty);
  /* 13.4 七巡：DoLGameUI 特效层错误归一化——4 种 layer 消息交替刷 24 条，应归一为同源（合并 1 条或熔断 0 条），收集器不爆 */
  const layerKinds = ["spotlight", "glow", "linearGradient", "flatColorOverlay"];
  for (var li = 0; li < 6; li++) {
    for (var lj = 0; lj < 4; lj++) {
      api.mbCEPushError("Error evaluating layer " + layerKinds[lj] + " property src", "DoLGameUI", "");
    }
  }
  const fxRows = api.mbCEErrors().filter(function (e) { return String(e.msg).indexOf("特效层") !== -1; }).length;
  assert(fxRows <= 1, "特效层错误折叠（24 条 → 收集器特效层条目 " + fxRows + " 条 ≤1，修复前 ≥24 条）");
  /* 13.4b 九巡：其他已知第三方噪音源折叠扩展——Paperdoll+/Terraria Expand/Simple Frameworks/DependenceChecker/TweeReplacer
     各自交替刷 5 条，应归一为「第三方噪音·」前缀各 1 条（或熔断 0 条），收集器不爆 */
  const noiseMsgs = [
    "DependenceChecker.check() not found mod | DoLGameUI",
    "[TweeReplacer] do_patch() (pp.content.search(p.findString) < 0).",
    "[ReplacePatcher] patchInReplaceParamsItem() (f.content.search(rp.from) < 0).",
    "ModOrderContainer getByNameOneWithAlias() cannot find name/alias. | Terraria Expand Mod",
    "ModOrderContainer getByNameOne() cannot find name. | Simple Frameworks"
  ];
  for (var nk = 0; nk < 5; nk++) {
    for (var nm = 0; nm < 5; nm++) { api.mbCEPushError(noiseMsgs[nm], "thirdparty", ""); }
  }
  const noiseRows = api.mbCEErrors().filter(function (e) { return String(e.msg).indexOf("第三方噪音") === 0; }).length;
  assert(noiseRows <= 6, "第三方噪音折叠扩展（25 条 → 收集器噪音条目 " + noiseRows + " 条 ≤6，修复前各源独立 ≥25 条）");
  /* 13.5 九巡：特质区懒渲染——初始收起组不建行（行数 = 快速面板 33），点击展开补建行，全部展开后行数 = 全量 */
  api.renderPlayerEdit();
  const lpane = document.querySelector('[data-pane="mods"]');
  const lazyRows0 = lpane.querySelectorAll(".mce-row").length;
  assert(lazyRows0 < 60, "懒渲染：收起组不建行（初始行数 " + lazyRows0 + " < 60，旧行为全量 157）");
  const headsL = [].slice.call(lpane.querySelectorAll(".mce-collapse-head"));
  assert(headsL.length >= 1, "存在可折叠分类标题（共 " + headsL.length + " 个）");
  /* 点击第一个「收起状态」且「count>0」的分类 → 该组补建行（标题格式 ▸ 分类（N）·备注，按数字计数精确过滤空组） */
  const collapsedHead = headsL.filter(function (h) {
    var b = h.nextElementSibling;
    if (!b || b.getAttribute("data-collapsed") !== "1") { return false; }
    var m = h.textContent.match(/（(\d+)）/);
    return m && parseInt(m[1], 10) > 0;
  })[0];
  assert(!!collapsedHead, "存在收起状态的分类组");
  collapsedHead.click();
  const lazyRows1 = lpane.querySelectorAll(".mce-row").length;
  assert(lazyRows1 > lazyRows0, "点击展开后补建行（" + lazyRows0 + " → " + lazyRows1 + "）");
  const openAllBtn = [].slice.call(lpane.querySelectorAll("button")).filter(function (b) { return b.textContent === "全部展开"; })[0];
  openAllBtn.click();
  const lazyRows2 = lpane.querySelectorAll(".mce-row").length;
  assert(lazyRows2 > 100, "全部展开后补建全部行（" + lazyRows1 + " → " + lazyRows2 + " > 100，含快速面板+特质全量）");
  /* 13.6 九巡：V.mbCE_wrote 留痕有界化——450 条后裁剪 ≤400（最旧一半被删） */
  V.mbCE_wrote = {};
  for (var wi = 0; wi < 450; wi++) { V.mbCE_wrote["cheat:mock:" + wi] = { type: "cheat", t: wi }; }
  assert(Object.keys(V.mbCE_wrote).length === 450, "构造 450 条留痕");
  api.mbCEWroteTrim(V);
  const wroteLeft = Object.keys(V.mbCE_wrote).length;
  assert(wroteLeft <= 400, "留痕裁剪后 ≤400（实际 " + wroteLeft + "，删最旧一半）");
  const newestKept = V.mbCE_wrote["cheat:mock:449"] !== undefined;
  assert(newestKept, "裁剪保留最新写入（cheat:mock:449 仍存在）");
  /* 13.7 十巡自查：搜索态懒渲染边界——全部收起 + 搜索时，命中收起组的行必须可见（懒渲染不能吞搜索结果） */
  api.mbCEUiSave({ collapsed: {}, filter: "童贞" });
  api.renderPlayerEdit();
  const spane = document.querySelector('[data-pane="mods"]');
  assert(spane.textContent.indexOf("○ 童贞") !== -1 || spane.textContent.indexOf("● 童贞") !== -1, "搜索「童贞」时收起组的匹配行可见（懒渲染搜索边界），实际前 120 字 " + spane.textContent.slice(0, 120));
  api.mbCEUiSave({ filter: "" });
  console.log(failures === 0 ? "\nSMOKE ALL PASSED" : "\nSMOKE " + failures + " FAILURES");
  process.exitCode = failures === 0 ? 0 : 1;
}, 350);
