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
/* v1.9.4 问题2：Mod 子页超长组时间分片构建（>60 行分帧，防 DoL-Game-UI rAF 扫描下长任务卡顿/闪退）。
   分片默认开启；测试环境强制同步（smoke 同步断言依赖行渲染完成） */
window.__mbCE_forceSyncRows = true;
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
/* v1.9.1（DoL-Game-UI 冲突排查）：子页四分组默认收起 + 懒渲染 → 先展开全部分组，控件断言才能命中 */
const modHeadsSmoke = [].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll(".mce-collapse-head"));
modHeadsSmoke.forEach(function (h) { try { h.click(); } catch (e) {} });
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
V.NPCName = [{ nam: "Robin" }, { nam: "Whitney" }, { nam: "Alice" }, { nam: "Liddell" }, { nam: "Seath" }, { nam: "TestNPC" }];
/* v1.9.2 自查：模拟真实 MOD 环境——框架注册恋爱标记（Alice/Liddell/Seath）+
   原版角色池扩展污染（MOD 把新角色名加进 setup.NPCNameList，旧版 isVanillaNPC 会误判为原版） */
window.maplebirch.npc = {
  data: new Map([
    ["Alice", { Config: { loveInterest: true } }],
    ["Liddell", { Config: { loveInterest: true } }],
    ["Seath", { Config: { loveInterest: true } }],
    ["TestNPC", { Config: { loveInterest: false } }]
  ]),
  NPCNameList: [], romanceConditions: {}, type: {}
};
global.setup.NPCNameList = (global.setup.NPCNameList || []).concat(["Alice", "Liddell", "Seath", "TestNPC"]);
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
assert(!!loveGrp, "角色页「恋爱角色」分组存在（jsdom）");
/* 懒渲染（v1.9.0 自查）：默认收起组不建卡片 DOM，textContent 无角色名——先点击展开再断言 */
const loveBody = loveGrp.querySelector(".mce-grp-body");
if (loveBody && loveBody.getAttribute("data-collapsed") === "1") { loveGrp.querySelector(".mce-grp-t").click(); }
assert(loveGrp.textContent.indexOf("罗宾") !== -1, "恋爱角色分组展开后含 罗宾（jsdom），实际 " + loveGrp.textContent.slice(0, 60));
/* v1.9.2 自查：MOD 角色必须全部进「模组角色」分区（即使 setup.NPCNameList 被 MOD 扩展污染），
   且分区内细分为「模组·恋爱角色 / 模组·普通角色」 */
const modGrp = document.querySelector('.mce-grp[data-tcat="模组角色"]');
assert(!!modGrp, "角色页「模组角色」分组存在（jsdom）");
assert(modGrp.querySelector(".mce-grp-t").textContent.indexOf("模组角色（4）") !== -1, "模组角色分区计数 = 4（Alice/Liddell/Seath/TestNPC），实际 " + modGrp.querySelector(".mce-grp-t").textContent);
const modBody16 = modGrp.querySelector(".mce-grp-body");
if (modBody16 && modBody16.getAttribute("data-collapsed") === "1") { modGrp.querySelector(".mce-grp-t").click(); }
assert(modBody16.textContent.indexOf("模组·恋爱角色（3）") !== -1, "模组分区内细分「模组·恋爱角色（3）」，实际 " + modBody16.textContent.slice(0, 120));
assert(modBody16.textContent.indexOf("模组·普通角色（1）") !== -1, "模组分区内细分「模组·普通角色（1）」，实际 " + modBody16.textContent.slice(0, 120));
assert(modBody16.textContent.indexOf("爱丽丝") !== -1 && modBody16.textContent.indexOf("利德尔") !== -1 && modBody16.textContent.indexOf("希斯") !== -1, "恋爱子组含汉化名 爱丽丝/利德尔/希斯，实际 " + modBody16.textContent.slice(0, 200));
assert(modBody16.textContent.indexOf("TestNPC") !== -1, "普通子组含 TestNPC，实际 " + modBody16.textContent.slice(0, 240));
ptxt = clickTabSafe("stage");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "阶段页渲染不崩，实际 " + ptxt.slice(0, 50));
/* v1.9.2 剧情页分区真实验证：注入含「原版键 + MOD 键」的 scenes widget 段落，
   renderScenes 必须产出 原版剧情（按角色分组）/ MOD 剧情 两区，键各归其位 */
global.Story.passages = [{
	name: "scenes",
	text: '<<widget "scenes">> <<set $scenes to {"RobinCrossdressing1": { startPassage: "RobinCrossdressing1", name: "原版-罗宾变装", unlocked: "true" }, "AveryHelicopter": { startPassage: "AveryHelicopter", name: "原版-艾弗里直升机", unlocked: "true" }, "TestModNewScene": { startPassage: "TestModNewScene", name: "MOD-测试新场景", unlocked: "true" }}>><</widget>>'
}];
ptxt = clickTabSafe("scenes");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "剧情页渲染不崩，实际 " + ptxt.slice(0, 50));
assert(ptxt.indexOf("原版剧情") !== -1 && ptxt.indexOf("MOD 剧情") !== -1, "剧情页含「原版剧情 / MOD 剧情」两区标题，实际 " + ptxt.slice(0, 80));
assert(ptxt.indexOf("罗宾 Robin") !== -1, "原版区含「罗宾 Robin」角色分组，实际 " + ptxt.slice(0, 120));
assert(ptxt.indexOf("艾弗里 Avery") !== -1, "原版区含「艾弗里 Avery」角色分组，实际 " + ptxt.slice(0, 120));
/* v1.9.4：角色/地点分组默认收起——展开罗宾/艾弗里组再断言原版键渲染 */
const sc13b = document.querySelector('[data-pane="scenes"]');
["罗宾 Robin", "艾弗里 Avery"].forEach(function (r) {
  const rg = sc13b.querySelector('.mce-grp[data-tcat="' + r + '"]');
  if (rg) {
    const rb = rg.querySelector(".mce-grp-body");
    if (rb && rb.getAttribute("data-collapsed") === "1") { rg.querySelector(".mce-grp-t").click(); }
  }
});
ptxt = sc13b.textContent;
assert(ptxt.indexOf("原版-罗宾变装") !== -1 && ptxt.indexOf("原版-艾弗里直升机") !== -1, "原版键渲染进原版角色组（罗宾变装/艾弗里直升机），实际 " + ptxt.slice(0, 160));
/* v1.9.2 自查：MOD 场景区懒渲染折叠——断言前先展开 MOD 区 */
const scPane13 = document.querySelector('[data-pane="scenes"]');
const modRegion13 = scPane13.querySelector('.mce-grp[data-tcat="MOD 场景"]');
if (modRegion13) {
  const mb13 = modRegion13.querySelector(".mce-grp-body");
  if (mb13 && mb13.getAttribute("data-collapsed") === "1") { modRegion13.querySelector(".mce-grp-t").click(); }
}
/* v1.9.4：角色/地点分组默认收起——展开艾弗里组再断言剧情进度块 */
const averyRegion13 = scPane13.querySelector('.mce-grp[data-tcat="艾弗里 Avery"]');
if (averyRegion13) {
  const ab13 = averyRegion13.querySelector(".mce-grp-body");
  if (ab13 && ab13.getAttribute("data-collapsed") === "1") { averyRegion13.querySelector(".mce-grp-t").click(); }
}
ptxt = scPane13.textContent;
assert(ptxt.indexOf("MOD-测试新场景") !== -1, "MOD 键渲染进 MOD 区，实际 " + ptxt.slice(0, 160));
assert(ptxt.indexOf("剧情进度") !== -1 && ptxt.indexOf("高塔建造进度") !== -1, "艾弗里组渲染「剧情进度」块（高塔建造进度控件），实际 " + ptxt.slice(0, 260));
global.Story.passages = [];
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
  /* v1.9.1（DoL-Game-UI 冲突排查）：子页分组默认收起 → 展开全部分组再操作 */
  [].slice.call(mpane.querySelectorAll(".mce-collapse-head")).forEach(function (h) { try { h.click(); } catch (e) {} });
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
  /* ---------- 15. v1.9.2 玩家真实路径自查：本体 111 键全量渲染 + 剧情进度控件真实点击 + 救星三按钮真实点击 ---------- */
  try {
    const GAME_HTML = "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
    if (fs.existsSync(GAME_HTML)) {
      const html = fs.readFileSync(GAME_HTML, "utf8");
      const rePD = /<tw-passagedata[^>]*name="([^"]*)"[^>]*>(.*?)<\/tw-passagedata>/gs;
      let pm, widgetText = "";
      while ((pm = rePD.exec(html)) !== null) {
        const t = pm[2].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
        if (t.indexOf('<<widget "scenes">>') !== -1) { widgetText = t; break; }
      }
      assert(!!widgetText && widgetText.length > 50000, "15 本体 scenes widget 已提取（长度 " + (widgetText || "").length + "）");
      /* 与运行时相同定位：把 MOD 键注入到 <<set $scenes to { ... } 对象体内（parseScenesFromText 只解析该对象体） */
      function injectIntoScenesObj(w) {
        var m = w.match(/<<set\s+\$scenes\s+to\s+\{/);
        if (!m) { m = w.match(/\$scenes\s+to\s+\{/); }
        if (!m) { return w; }
        var start = m.index + m[0].length - 1, depth = 0, i = start, end = -1, inStr = false;
        for (; i < w.length; i++) {
          var c = w.charAt(i);
          if (inStr) { if (c === "\\") { i++; } else if (c === '"') { inStr = false; } }
          else if (c === '"') { inStr = true; }
          else if (c === "{") { depth++; }
          else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end < 0) { return w; }
        var key = ', "TestModAddedScene": { startPassage: "TestModAddedScene", name: "MOD-注入新场景", unlocked: "true" }';
        return w.slice(0, end) + key + w.slice(end);
      }
      const widget2 = injectIntoScenesObj(widgetText);
      /* 同时模拟 MOD 运行时注入（Object.assign($scenes,...)）：键只存在于 V.scenes 缓存 */
      V.scenes = { TestModRuntimeScene: { name: "MOD-运行时新场景", startPassage: "TestModRuntimeScene", passages: [], unlocked: true } };
      global.Story.passages = [{ name: "scenes", text: widget2 }];
      /* v1.9.4：折叠状态持久化到 mbCEUiState.collapsed（13 节展开过会污染）——重置后验证默认收起 */
      api.mbCEUiSave({ collapsed: {} });
      const sptxt = clickTabSafe("scenes");
      assert(sptxt.indexOf("THREW") === -1, "15 本体 111 键全量渲染不崩（THREW 检测）");
      assert(sptxt.indexOf("原版剧情（游戏本体注册，111 场景）") !== -1, "15 原版区计数 = 111，实际 " + sptxt.slice(sptxt.indexOf("原版剧情"), sptxt.indexOf("原版剧情") + 60));
      assert(sptxt.indexOf("MOD 剧情（第三方模组注册，2 场景）") !== -1, "15 MOD 区计数 = 2（widget 注入 1 + 运行时注入 1），实际 " + sptxt.slice(sptxt.indexOf("MOD 剧情"), sptxt.indexOf("MOD 剧情") + 60));
      /* v1.9.2 自查：MOD 场景区懒渲染折叠——收起时场景键不渲染，点击标题展开后才补建 */
      const scPane = document.querySelector('[data-pane="scenes"]');
      const modRegion = scPane.querySelector('.mce-grp[data-tcat="MOD 场景"]');
      assert(!!modRegion, "15 MOD 场景折叠组存在（懒渲染）");
      assert(modRegion.querySelector(".mce-grp-body").getAttribute("data-collapsed") === "1", "15 MOD 场景组默认收起 data-collapsed=1（懒渲染）");
      assert(scPane.textContent.indexOf("MOD-注入新场景") === -1, "15 收起时 MOD 场景键未渲染（懒渲染生效）");
      modRegion.querySelector(".mce-grp-t").click();
      assert(modRegion.querySelector(".mce-grp-body").getAttribute("data-collapsed") === "0", "15 点击标题 → MOD 场景组展开 data-collapsed=0");
      const sptxt2 = scPane.textContent;
      assert(sptxt2.indexOf("MOD-注入新场景") !== -1 && sptxt2.indexOf("MOD-运行时新场景") !== -1, "15 展开后两条注入键渲染在 MOD 区");
      /* v1.9.4：展开状态持久化——切 tab 重建（tab 回调 renderScenes）后展开组保持展开 */
      clickTabSafe("char");
      clickTabSafe("scenes");
      const scPaneB = document.querySelector('[data-pane="scenes"]');
      const modRegionB = scPaneB.querySelector('.mce-grp[data-tcat="MOD 场景"]');
      assert(!!modRegionB && modRegionB.querySelector(".mce-grp-body").getAttribute("data-collapsed") === "0", "15 展开状态持久化：重建后 MOD 区仍展开 data-collapsed=0");
      assert(modRegionB.querySelector(".mce-grp-body").textContent.indexOf("MOD-注入新场景") !== -1, "15 重建后展开组懒渲染内容保留（MOD-注入新场景）");
      delete V.scenes;
      assert(sptxt.indexOf("惠特尼 Whitney（14 场景）") !== -1, "15 惠特尼组 14 场景（含修复后的 HalloweenWhitney），实际 " + (sptxt.match(/惠特尼 Whitney（(\d+) 场景）/) ? sptxt.match(/惠特尼 Whitney（(\d+) 场景）/)[1] : "无"));
      function findBtnIn(scope, txt) {
        const btns = [].slice.call((scope || document).querySelectorAll("button"));
        return btns.filter(function (b) { return b.textContent.indexOf(txt) !== -1; })[0] || null;
      }
      function stageOf(scope, headTxt) {
        /* v1.9.4：角色组改为折叠组（.mce-grp + .mce-grp-t 标题），兼容旧 .mce-stage 结构 */
        const all = [].slice.call((scope || document).querySelectorAll(".mce-grp, .mce-stage"));
        return all.filter(function (s) {
          const h = s.querySelector(".mce-grp-t") || s.querySelector(".mce-stage-head");
          return h && h.textContent.indexOf(headTxt) !== -1;
        })[0] || null;
      }
      function expandGrp(stage) {
        const t = stage && stage.querySelector(".mce-grp-t");
        if (t && t.textContent.indexOf("▸") !== -1) { t.click(); }
      }
      function rowOf(stage, nameTxt) {
        const rows = [].slice.call(stage.querySelectorAll(".mce-row"));
        return rows.filter(function (r) { return r.textContent.indexOf(nameTxt) !== -1; })[0] || null;
      }
      /* 剧情进度控件真实点击：艾弗里高塔进度 */
      const averyStage = stageOf(scPane, "艾弗里 Avery");
      assert(!!averyStage, "15 艾弗里角色组存在（剧情页）");
      if (averyStage) { expandGrp(averyStage); }
      if (averyStage) {
        const towerRow = rowOf(averyStage, "高塔建造进度");
        assert(!!towerRow, "15 艾弗里组含「高塔建造进度」控件行");
        if (towerRow) {
          const inp = towerRow.querySelector("input.mce-inp");
          assert(!!inp, "15 高塔进度 input 存在");
          if (inp) { inp.value = "85"; }
          const applyT = findBtnIn(towerRow, "应用");
          assert(!!applyT, "15 高塔进度应用按钮存在");
          if (applyT) { applyT.click(); }
          assert(V.avery_tower && V.avery_tower.progress === 85, "15 点击应用 → V.avery_tower.progress=85，实际 " + (V.avery_tower && V.avery_tower.progress));
        }
        const pgBtn = findBtnIn(averyStage, "派对来宾区域补全");
        assert(!!pgBtn, "15 派对来宾补全按钮存在");
        if (pgBtn) { pgBtn.click(); }
        assert(Array.isArray(V.avery_party.guests) && V.avery_party.guests.length === 5, "15 点按钮 → guests 补全 5 区域，实际 " + (V.avery_party.guests || []).length);
      }
      /* 罗宾债务事件阶段 */
      const robinStage = stageOf(scPane, "罗宾 Robin");
      assert(!!robinStage, "15 罗宾角色组存在（剧情页）");
      if (robinStage) { expandGrp(robinStage); }
      if (robinStage) {
        const debRow = rowOf(robinStage, "债务事件阶段");
        assert(!!debRow, "15 罗宾组含「债务事件阶段」控件行");
        if (debRow) {
          const sel = debRow.querySelector("select");
          assert(!!sel, "15 债务事件 select 存在");
          if (sel) { sel.value = "7"; }
          const applyD = findBtnIn(debRow, "应用");
          if (applyD) { applyD.click(); }
          assert(V.robindebtevent === 7, "15 点击应用 → V.robindebtevent=7，实际 " + V.robindebtevent);
        }
      }
      /* 凯拉尔剧情标记补全 */
      const kylarStage = stageOf(scPane, "凯拉尔 Kylar");
      assert(!!kylarStage, "15 凯拉尔角色组存在（剧情页）");
      if (kylarStage) { expandGrp(kylarStage); }
      if (kylarStage) {
        const kylarTxt = kylarStage.textContent;
        assert(kylarTxt.indexOf("[object HTMLSpanElement]") === -1, "15 凯拉尔组无 [object HTMLSpanElement]（独立场景标题渲染 bug 已修），实际 " + kylarTxt.slice(0, 60));
        assert(kylarTxt.indexOf("独立场景（未聚合成线）") !== -1, "15 独立场景标题正常显示（非 [object...]）");
        assert(kylarTxt.indexOf("悉尼写作(sydneyWriting)·悉尼线") !== -1, "15 凯拉尔标记汉化：悉尼写作·悉尼线（标明剧情归属）");
        assert(kylarTxt.indexOf("被侵犯（kylar.raped）") !== -1, "15 凯拉尔行名汉化：被侵犯（kylar.raped）");
        assert(kylarTxt.indexOf("表白(saidLove)·主线") !== -1 && kylarTxt.indexOf("地下室(basement)·绑架") !== -1, "15 凯拉尔标记汉化：表白·主线 / 地下室·绑架");
        const seenBtn = findBtnIn(kylarStage, "已看剧情标记补全");
        assert(!!seenBtn, "15 凯拉尔标记补全按钮存在");
        if (seenBtn) { seenBtn.click(); }
        assert(Array.isArray(V.kylarSeen) && V.kylarSeen.length === 8, "15 点按钮 → kylarSeen 补全 8 标记，实际 " + (V.kylarSeen || []).length);
      }
      /* 15.5 v1.9.5-自检：乱码兜底单定时器（清旧设新，防 renderScenes 频繁重建时 800ms 闭包堆积扫描旧 pane） */
      assert(js.indexOf("var sHeadGuardTimer = null;") !== -1, "15.5 sHeadGuardTimer 单定时器变量已声明（源码）");
      assert(js.indexOf("if (sHeadGuardTimer) { clearTimeout(sHeadGuardTimer); }") !== -1, "15.5 渲染重建时先清旧定时器（源码）");
      assert(js.indexOf("sHeadGuardTimer = setTimeout") !== -1, "15.5 兜底定时器挂到模块级变量（源码）");
      /* 救星三按钮真实点击（全局页） */
      delete V.avery_fate; delete V.mceAveryShelter; delete V.mceAveryFateSnapshot;
      const gptxt = clickTabSafe("global");
      assert(gptxt.indexOf("THREW") === -1, "15 全局页渲染不崩");
      const gPane = document.querySelector('[data-pane="global"]');
      const bSaved = findBtnIn(gPane, "获取（原版线）");
      assert(!!bSaved, "15 救星「获取（原版线）」按钮存在（未拥有态）");
      if (bSaved) { bSaved.click(); }
      assert(V.avery_fate === "saved", "15 点击原版线 → V.avery_fate=saved，实际 " + V.avery_fate);
      /* 点击后 renderGlobal 重建 → 重新查找撤回按钮 */
      const r1 = findBtnIn(document.querySelector('[data-pane="global"]'), "撤回（恢复操作前状态）");
      assert(!!r1, "15 拥有态出现「撤回」按钮");
      if (r1) { r1.click(); }
      assert(V.avery_fate === undefined && V.mceAveryShelter === undefined, "15 撤回 → fate/shelter 还原，实际 fate=" + V.avery_fate + " shelter=" + V.mceAveryShelter);
      const bShelter = findBtnIn(document.querySelector('[data-pane="global"]'), "获取（庇护模式）");
      assert(!!bShelter, "15 撤回后回到未拥有态（庇护按钮出现）");
      if (bShelter) { bShelter.click(); }
      assert(V.mceAveryShelter === true && V.avery_fate === undefined, "15 点庇护 → shelter=true 且 fate 未动，实际 shelter=" + V.mceAveryShelter + " fate=" + V.avery_fate);
      const r2 = findBtnIn(document.querySelector('[data-pane="global"]'), "撤回（恢复操作前状态）");
      if (r2) { r2.click(); }
      assert(V.mceAveryShelter === undefined && V.avery_fate === undefined, "15 撤回庇护 → 全部还原，实际 shelter=" + V.mceAveryShelter);
      /* 清理注入态 */
      delete V.avery_tower; delete V.avery_party; delete V.robindebtevent; delete V.robinmissing; delete V.robin; delete V.kylarSeen;
      global.Story.passages = [];
    } else {
      console.log("WARN: 15 本体 HTML 缺失，跳过玩家路径测试");
    }
  } catch (e15) {
    failures++;
    console.error("FAIL: 15 玩家路径测试异常：" + (e15 && e15.message ? e15.message : e15));
  }
  /* ---------- 16. v1.9.4 问题2：Mod 子页超长组时间分片（首帧同步 40 行 + 逐帧排空，防 DoL-Game-UI rAF 扫描下长任务 ANR） ---------- */
  try {
    const bigValues = [];
    for (let bi = 0; bi < 70; bi++) { bigValues.push({ key: "bv" + bi, name: "大数值" + bi, varPath: "big_v" + bi }); V["big_v" + bi] = 0; }
    setup.mbCE_modCheats = [{ modId: "bigmod", modName: "大模组", tasks: [{ key: "bt", name: "大任务" }], stages: [{ key: "bs", name: "大阶段", varPath: "big_s", levels: [0, 1], labels: ["零", "一"] }], abilities: [{ key: "ba", name: "大能力", varPath: "big_a" }], scenes: [{ key: "bsc", name: "大剧情" }], values: bigValues }];
    V.big_s = 0; V.big_a = false;
    window.__mbCE_forceSyncRows = false;
    api.renderModCheatDetail("bigmod");
    const bPane = document.querySelector('[data-pane="mods"]');
    [].slice.call(bPane.querySelectorAll(".mce-collapse-head")).forEach(function (h) { try { h.click(); } catch (e) {} });
    const builtNow = bPane.querySelectorAll(".mce-row").length;
    assert(builtNow < 70, "16 分片：70 行组展开首帧未全量渲染（" + builtNow + "/70，长任务已摊平）");
    assert(builtNow >= 40, "16 分片：首帧已渲染 40+ 行（点击立即可见内容），实际 " + builtNow);
    window.__mbCE_forceSyncRows = true;
    setTimeout(function () {
      const total = bPane.querySelectorAll(".mce-row").length;
      const bTxt = bPane.textContent;
      if (total > builtNow && bTxt.indexOf("大数值0") !== -1 && bTxt.indexOf("大数值69") !== -1) {
        console.log("PASS: 16 分片：逐帧排空后全量渲染（首帧 " + builtNow + " 行 → 排空后 " + total + " 行，含大数值0/69）");
      } else { failures++; console.error("FAIL: 16 分片排空后未全量（首帧 " + builtNow + " → 现 " + total + "，大数值0=" + (bTxt.indexOf("大数值0") !== -1) + " 大数值69=" + (bTxt.indexOf("大数值69") !== -1) + "）"); process.exitCode = 1; }
      assert(js.indexOf("modRowQueue.length = 0;") !== -1, "16.1 重建时清残留分片任务（renderModCheatDetail 入口，源码）");
      assert(js.indexOf("if (modRowBatchTimer) { clearTimeout(modRowBatchTimer); modRowBatchTimer = null; }") !== -1, "16.1 重建时先清分片定时器（源码）");
      delete setup.mbCE_modCheats;
    }, 800);
  } catch (e16) {
    failures++;
    console.error("FAIL: 16 分片测试异常：" + (e16 && e16.message ? e16.message : e16));
    window.__mbCE_forceSyncRows = true;
  }
  console.log(failures === 0 ? "\nSMOKE ALL PASSED" : "\nSMOKE " + failures + " FAILURES");
  process.exitCode = failures === 0 ? 0 : 1;
}, 20000);
