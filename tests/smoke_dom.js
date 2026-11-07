/*
 * DOM 冒烟测试（v1.9.0 工程化第 2 项）：
 * 用 jsdom 真实 DOM 复现浏览器语义（select.type 只读抛错、querySelector/click 等），
 * 渲染各面板并模拟用户点击，验证不崩溃 + 关键 DOM 与交互正确。
 * 弥补 test_mce.js 手写 mock 与真实浏览器语义不一致的盲区（v1.8.4 select.type 崩溃漏检）。
 * 用法：node tests/smoke_dom.js（构建产物需已生成：node tools/build_js.js）
 */
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");
/* 原版游戏 HTML（64MB，不入库）：路径可用 MCE_DOL_HTML 覆盖；缺失时依赖它的用例显式 SKIP，
   其余矩阵/判据/direct 链路断言照常强制（否则干净克隆或 CI 上整份冒烟都跑不起来）。 */
const GAME_HTML_PATH = process.env.MCE_DOL_HTML || "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
const HAS_GAME_HTML = fs.existsSync(GAME_HTML_PATH);

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
  world_corruption_hard: 2, world_corruption_soft: 0,
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

/* ---------- 3.5 v1.9.18 排版 token 化 + 容器自适应断言 ---------- */
const mceCss = (document.getElementById("mce-style") || {}).textContent || "";
assert(mceCss.indexOf(":root{--mce-accent:#d4a73c") !== -1, "CSS token：:root 定义 --mce-accent（改主题只动变量区）");
assert(mceCss.indexOf("height:var(--mce-h-header)") !== -1, "CSS token：.mce-header 高度走 var(--mce-h-header)（自查抓漏：42px 字面量）");
assert(mceCss.indexOf("background:var(--mce-bg-panel)") !== -1, "CSS token：面板背景走 var(--mce-bg-panel)");
assert(mceCss.indexOf("font-size:var(--mce-fs-base)") !== -1, "CSS token：字号走 var(--mce-fs-base)");
assert(mceCss.indexOf("max-height:calc(100vh - 16px)") !== -1, "容器自适应：#mce-root max-height 随视口（防御 DoL-Game-UI 滚动截断）");
assert(mceCss.indexOf(".mce-body{flex:1;overflow-y:auto") !== -1, "容器自适应：.mce-body 内容区独立滚动");
assert(mceCss.indexOf("::-webkit-scrollbar-thumb") !== -1, "容器自适应：面板滚动条样式已注入");
assert(!!document.querySelector(".mce-body"), "容器自适应：.mce-body 滚动容器存在");
assert(!!document.querySelector(".mce-header") && !!document.querySelector(".mce-tabs"), "容器自适应：header/tabs 固定行存在（sticky 页头）");

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
assert(tabBtns.length >= 7, "外层标签按钮 >=7（v2.0.0.006 新增言灵页），实际 " + tabBtns.length);
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
/* v2.0.0.007 好友实测：场景直达补「妓院（含地下层）/ 雷米牧场牲口线 / 雷米农场」三组（组标题在 passages 为空时也必须渲染） */
assert(placesPane.textContent.indexOf("妓院 · 含地下层 Brothel") !== -1 && placesPane.textContent.indexOf("雷米牧场 · 牲口线 Livestock") !== -1 && placesPane.textContent.indexOf("雷米农场 · The Farm") !== -1, "场景直达新增妓院/雷米牧场/雷米农场三组，实际 " + placesPane.textContent.slice(0, 200));
/* 地点子页：监狱 / 雷米牧场档位组（原版 $prison.* / $livestock.* 实证键） */
const stageBtnV7 = placesPane.querySelector('.mce-inner button[data-place="stage"]');
assert(!!stageBtnV7, "地点阶段页签按钮可再次获取");
stageBtnV7.click();
assert(placesPane.textContent.indexOf("监狱（原版 Prison）") !== -1 && placesPane.textContent.indexOf("雷米牧场（原版 Livestock）") !== -1, "地点阶段新增监狱/雷米牧场档位组，实际 " + placesPane.textContent.slice(0, 200));
assert(placesPane.textContent.indexOf("监狱关注度") !== -1 && placesPane.textContent.indexOf("服从度") !== -1, "监狱关注度 / 牲口服从度 档位行渲染");
const directBtnV7 = placesPane.querySelector('.mce-inner button[data-place="direct"]');
if (directBtnV7) { directBtnV7.click(); }

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
const feedBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自动投喂艾弗里") !== -1; });
assert(feedBtn.length === 1, "庄园维护「自动投喂艾弗里」按钮存在");
const farmBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自动农场维护") !== -1; });
assert(farmBtn.length === 1, "庄园维护「自动农场维护」按钮存在");
/* v1.8.10 维护扩展按钮：神殿/伊甸/补给/打扫 */
const templeBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自动神殿维护") !== -1; });
assert(templeBtn.length === 1, "庄园维护「自动神殿维护」按钮存在");
if (templeBtn[0]) { templeBtn[0].click(); }
const edenBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自动伊甸维护") !== -1; });
assert(edenBtn.length === 1, "庄园维护「自动伊甸维护」按钮存在");
if (edenBtn[0]) { edenBtn[0].click(); }
const restockBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自动补给") !== -1; });
assert(restockBtn.length === 1, "庄园维护「自动补给」按钮存在");
if (restockBtn[0]) { restockBtn[0].click(); }
const cleanBtn = [].slice.call(globalPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自动庄园打扫") !== -1; });
assert(cleanBtn.length === 1, "庄园维护「自动庄园打扫」按钮存在");
if (cleanBtn[0]) { cleanBtn[0].click(); }

/* v2.0.0.006 言灵页：玩家路径真实点击（开页签 → 开启 → 按钮翻转 → 清零读回） */
window.isCrossdressing = function () { return true; }; /* 模拟原版 72536 挂在 window 上的判定 */
const ylOrigCD = window.isCrossdressing;
ptxt = clickTabSafe("yanling");
assert(ptxt.indexOf("THREW") === -1 && ptxt.length > 0, "言灵页渲染不崩，实际 " + ptxt.slice(0, 50));
let ylPane = document.querySelector('[data-pane="yanling"]');
assert(ylPane.textContent.indexOf("无视着装性别") !== -1 && ylPane.textContent.indexOf("负面名声清零") !== -1, "言灵页含「无视着装性别 / 负面名声清零」两区，实际 " + ylPane.textContent.slice(0, 120));
/* v2.0.2 言灵扩容：4 新增区块渲染 + 玩家路径真实点击读回 */
assert(ylPane.textContent.indexOf("身体与衣物") !== -1 && ylPane.textContent.indexOf("数值快补") !== -1 && ylPane.textContent.indexOf("天气") !== -1 && ylPane.textContent.indexOf("角色放逐") !== -1,
  "言灵页含扩容 4 区块（身体与衣物 / 数值快补 / 天气 / 角色放逐）");
V.upperwet = 12; V.lowerwet = 8; V.underupperwet = 5; V.underlowerwet = 3;
const ylDry = [].slice.call(ylPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "一键烘干衣服"; });
assert(ylDry.length === 1, "「一键烘干衣服」按钮存在");
if (ylDry[0]) { ylDry[0].click(); }
assert(V.upperwet === 0 && V.lowerwet === 0 && V.underupperwet === 0 && V.underlowerwet === 0, "点击烘干 → 4 项湿度归零，实际 " + [V.upperwet, V.lowerwet, V.underupperwet, V.underlowerwet].join("/"));
V.sadism = 0; V.masochism = 0;
const ylSad = [].slice.call(document.querySelector('[data-pane="yanling"]').querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("施虐 / 受虐拉满") !== -1; });
assert(ylSad.length === 1, "「施虐 / 受虐拉满」按钮存在");
if (ylSad[0]) { ylSad[0].click(); }
assert(V.sadism === 1000 && V.masochism === 1000, "点击后 $sadism / $masochism = 1000，实际 " + V.sadism + "/" + V.masochism);
const ylWx = [].slice.call(document.querySelector('[data-pane="yanling"]').querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("切到「") !== -1; });
assert(ylWx.length === 4, "天气 4 档按钮齐备（晴 / 阴云 / 大雨大雪 / 雷暴），实际 " + ylWx.length);
const ylBanish = [].slice.call(document.querySelector('[data-pane="yanling"]').querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("格威岚 · 放逐 9 天") !== -1; });
assert(ylBanish.length === 1, "「格威岚 · 放逐 9 天」按钮存在（原版 scorned 线语义）");
const ylOnBtn = [].slice.call(ylPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "开启"; });
assert(ylOnBtn.length === 1, "言灵页「开启」按钮存在");
if (ylOnBtn[0]) { ylOnBtn[0].click(); }
assert(!!V.mbCE_yanling && V.mbCE_yanling.noCross === true, "点击开启 → $mbCE_yanling.noCross=true，实际 " + JSON.stringify(V.mbCE_yanling));
assert(typeof window.isCrossdressing === "function" && window.isCrossdressing() === false, "开启后 window.isCrossdressing() 恒 false（NPC 不再按服装标注性别判异装）");
ylPane = document.querySelector('[data-pane="yanling"]');
const ylOffBtn = [].slice.call(ylPane.querySelectorAll("button")).filter(function (b) { return b.textContent === "关闭（恢复原版判定）"; });
assert(ylOffBtn.length === 1, "开启后按钮翻转为「关闭（恢复原版判定）」（rerender 生效）");
/* 存量净化：写脏值 → 点按钮 → 读回 */
V.crossdressingTrait = 66;
V.backgroundTraits = ["crossdresser"];
const ylPurgeT = [].slice.call(ylPane.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("立即清空进度") !== -1; });
assert(ylPurgeT.length === 1, "「立即清空进度 + 移除特质」按钮存在");
if (ylPurgeT[0]) { ylPurgeT[0].click(); }
assert(V.crossdressingTrait === 0 && V.backgroundTraits.indexOf("crossdresser") === -1, "点击后 $crossdressingTrait=0 且 crossdresser 已移除，实际 " + V.crossdressingTrait);
V.schoolrep = { crossdress: 3, herm: 2 };
V.school_crossdress_message = 2;
V.fame = { sex: 500, scrap: 1000 };
const ylPurgeF = [].slice.call(document.querySelector('[data-pane="yanling"]').querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("全部负面名声") !== -1; });
assert(ylPurgeF.length === 1, "「一键清零：全部负面名声」按钮存在");
if (ylPurgeF[0]) { ylPurgeF[0].click(); }
assert(V.fame.sex === 0 && V.fame.scrap === 1000 && V.schoolrep.crossdress === 0 && V.schoolrep.herm === 0 && V.school_crossdress_message === undefined, "点击后 城镇负面清零、正面 scrap 保持 1000、学校 2 键清零、文案已删");
/* 关闭链：卸载钩子必须把 window.isCrossdressing 还原为原版函数（而不是留一层空包装） */
const ylOff = [].slice.call(document.querySelector('[data-pane="yanling"]').querySelectorAll("button")).filter(function (b) { return b.textContent === "关闭（恢复原版判定）"; });
assert(ylOff.length === 1, "「关闭（恢复原版判定）」按钮存在");
if (ylOff[0]) { ylOff[0].click(); }
assert(window.isCrossdressing === ylOrigCD && window.isCrossdressing() === true, "关闭后 window.isCrossdressing 还原为原版函数且判定恢复 true（不留空包装层）");
/* 收尾：关掉开关 + 复位 mock，避免守卫定时器影响后续用例 */
if (V.mbCE_yanling) { V.mbCE_yanling.noCross = false; V.mbCE_yanling.noTrait = false; }
/* v1.9.12 全局页新区：世界腐化（原版 World Corruption）数值调整 */
const wcTxt = globalPane.textContent;
assert(wcTxt.indexOf("世界腐化") !== -1 && wcTxt.indexOf("world_corruption_hard") !== -1 && wcTxt.indexOf("world_corruption_soft") !== -1,
  "全局页含「世界腐化」区（硬/软腐化两行），实际 " + wcTxt.slice(0, 200));
assert(wcTxt.indexOf("当前 2") !== -1 && wcTxt.indexOf("当前 0") !== -1, "世界腐化行显示原版初始值（hard=2 / soft=0），实际 " + wcTxt.slice(0, 200));
/* v1.9.15 全局页新区：数值固定（防游戏机制改动，07f-lock.js） */
const lockTxtSm = globalPane.textContent;
assert(lockTxtSm.indexOf("数值固定") !== -1 && lockTxtSm.indexOf("maplebirch.transformation.raven.build") !== -1 && lockTxtSm.indexOf("fallenangel") !== -1,
  "全局页含「数值固定」区（渡鸦/堕天使等预设行），实际 " + lockTxtSm.slice(-500));
const lockRowsSm = [].slice.call(globalPane.querySelectorAll('.mce-row[data-lockpath]'));
assert(lockRowsSm.length === api.MB_CE_LOCK_PRESETS.length, "数值固定预设行渲染 " + api.MB_CE_LOCK_PRESETS.length + " 项, 实际 " + lockRowsSm.length);
assert(lockTxtSm.indexOf("自由添加") !== -1, "数值固定区含自由添加 varPath 输入行");
delete V.mbCE_lock;
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
/* ---------- 9.5 v2.0.0.007 好友实机反馈三修：锁定即时反馈 / 行标签中文 / 武器「已获得」 ---------- */
if (typeof api.mbCELockHas === "function" && api.mbCELockHas("skulduggery")) { api.mbCELockRemove("skulduggery"); }
if (typeof api.mbCELockHas === "function" && api.mbCELockHas("prof.baton")) { api.mbCELockRemove("prof.baton"); }
V.prof = V.prof || {};
V.prof.baton = 0;
api.renderPlayerEdit();
const skRow1 = modsPane.querySelector('.mce-row[data-mce-key="quick:skulduggery"]');
assert(!!skRow1, "9.5 快速面板 skulduggery 行存在");
const skLbl1 = skRow1.querySelector(".mce-row-lbl");
assert(skLbl1.textContent.indexOf("skulduggery") === -1, "9.5 行标签走中文映射（不含英文裸 key），实际 " + skLbl1.textContent);
const skLock1 = skRow1.querySelector('[data-mce-role="lock"]');
assert(!!skLock1 && skLock1.textContent === "锁定" && skLock1.className.indexOf("mce-gold") === -1, "9.5 初始锁定按钮=锁定且不高亮，实际 " + (skLock1 ? skLock1.textContent : "无"));
skLock1.click();
const skRow2 = modsPane.querySelector('.mce-row[data-mce-key="quick:skulduggery"]');
const skLock2 = skRow2 && skRow2.querySelector('[data-mce-role="lock"]');
assert(!!skLock2 && skLock2.textContent === "已锁定", "9.5 点一下 → 按钮立刻变「已锁定」（不再需要切页签），实际 " + (skLock2 ? skLock2.textContent : "无"));
assert(skLock2.className.indexOf("mce-gold") !== -1, "9.5 已锁定按钮金色高亮，实际 class=" + skLock2.className);
assert(api.mbCELockHas("skulduggery"), "9.5 锁定表已记录 skulduggery");
const skLbl2 = skRow2.querySelector(".mce-row-lbl");
assert(skLbl2.textContent.indexOf("skulduggery") === -1, "9.5 锁定后行标签仍为中文（回归：原先退回英文 key），实际 " + skLbl2.textContent);
const skLock3Now = skRow2.querySelector('[data-mce-role="lock"]');
skLock3Now.click();
const skLock4 = modsPane.querySelector('.mce-row[data-mce-key="quick:skulduggery"] [data-mce-role="lock"]');
assert(!api.mbCELockHas("skulduggery") && skLock4 && skLock4.textContent === "锁定", "9.5 再点取消锁定并立刻恢复「锁定」，实际 " + (skLock4 ? skLock4.textContent : "无"));
/* 武器持有态：prof.baton=500 → 「已获得」；归 0 → 「获得」 */
V.prof.baton = 500;
api.renderPlayerEdit();
const batonRow1 = modsPane.querySelector('.mce-row[data-mce-key="quick:prof.baton"]');
const batonGr1 = batonRow1 && batonRow1.querySelector('[data-mce-role="grant"]');
assert(!!batonGr1 && batonGr1.textContent === "已获得" && batonGr1.className.indexOf("mce-gold") !== -1, "9.5 武器已持有 → 按钮「已获得」+高亮，实际 " + (batonGr1 ? batonGr1.textContent : "无"));
V.prof.baton = 0;
api.renderPlayerEdit();
const batonGr2 = modsPane.querySelector('.mce-row[data-mce-key="quick:prof.baton"] [data-mce-role="grant"]');
assert(!!batonGr2 && batonGr2.textContent === "获得", "9.5 未持有 → 按钮「获得」，实际 " + (batonGr2 ? batonGr2.textContent : "无"));
/* ---------- 9.6 v2.0.1 收敛：锁定状态栏文案中文化 + 监狱/农场直达兜底 ---------- */
V.skulduggery = 500;
api.renderPlayerEdit();
const skLock6 = modsPane.querySelector('.mce-row[data-mce-key="quick:skulduggery"] [data-mce-role="lock"]');
skLock6.click();
const st6 = document.querySelector(".mce-status");
assert(!!st6, "9.6 状态栏节点存在");
assert(st6.textContent.indexOf("skulduggery") === -1 && st6.textContent.indexOf("诡术") !== -1,
  "9.6 锁定后状态栏走中文名（不含英文裸 key），实际「" + (st6 ? st6.textContent : "无") + "」");
const stRm6 = api.mbCELockRemove("skulduggery");
assert(stRm6.ok && stRm6.message.indexOf("skulduggery") === -1, "9.6 取消锁定文案为中文名，实际「" + stRm6.message + "」");
/* 直达兜底（jsdom 无 SugarCube → 注入假 Wikifier 记录调用） */
const wik6 = [];
const scOrig6 = window.SugarCube;
window.SugarCube = { Wikifier: function (elm, txt) { wik6.push(String(txt)); } };
delete V.prison;
api.ensureSceneStateFor("Prison Cell");
assert(wik6.length === 1 && wik6[0].indexOf("prison_init") !== -1, "9.6 $prison 缺失 → 调 prison_init，实际 " + JSON.stringify(wik6));
V.prison = { guards: 50 };
api.ensureSceneStateFor("Prison Cell");
assert(wik6.length === 1, "9.6 已有 $prison → 不重复调 init，实际 " + wik6.length);
delete V.farm; delete V.farm_stage;
api.ensureSceneStateFor("The Farm");
assert(!!V.farm && V.farm.beasts && V.farm.beasts.pigs === 0, "9.6 The Farm 直达 → $farm 兜底建壳");
delete V.farm; delete V.farm_stage; delete V.prison;
window.SugarCube = scOrig6;
delete V.skulduggery;
delete V.prof.baton;
api.mbCEUiSave({ tab: "char", filter: "" });


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
/* v1.9.16：属性分组已并入折叠结构（7 组 .mce-grp-body 独立折叠），「全部展开/收起」工具属特质区
   （group 循环，06c-traits-ui 139-159）——断言限定特质区组（data-tcat），保持原语义 */
const grpBodies = [].slice.call(modsPane.querySelectorAll(".mce-grp[data-tcat] .mce-grp-body"));
assert(grpBodies.length > 0 && grpBodies.every(function (b) { return b.getAttribute("data-collapsed") === "0"; }), "全部展开后所有组 data-collapsed=0（共 " + grpBodies.length + " 组）");
assert([].slice.call(modsPane.querySelectorAll(".mce-grp[data-tcat] .mce-grp-t.mce-collapse-head")).every(function (h) { return h.textContent.indexOf("▾") === 0; }), "全部展开后组标题均为 ▾");
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
  const applyV = [].slice.call(mpane.querySelectorAll("button")).filter(function (b) { return b.textContent === "应用修改"; })[0];
  /* v1.9.13 数值搜索框独立 class 后 input.mce-inp 仅剩数值输入框；仍按「应用修改」按钮所在行取输入框，双保险防未来新控件插队 */
  const vinp = applyV.parentNode.querySelector("input.mce-inp");
  vinp.value = "+5";
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
  /* v1.9.16：玩家属性分组改可折叠（默认收起，学特质页；jsdom 中 CSS 隐藏不影响 DOM 查询，
     此处先验证折叠结构再展开，模拟真实用户路径。属性组头文案「（当前值即游戏面板原始量纲…」唯一，
     按文案过滤避免误中特质区折叠头（特质区 wrap 同为 .mce-grp 嵌套结构）破坏 13.5 懒渲染前提） */
  const qHeads = [].slice.call(qp2.querySelectorAll(".mce-grp .mce-collapse-head")).filter(function (h) {
    return h.textContent.indexOf("（当前值即游戏面板原始量纲") !== -1;
  });
  assert(qHeads.length >= 7, "玩家属性分组全部可折叠（≥7 组折叠头）, 实际 " + qHeads.length);
  assert(qHeads.filter(function (h) { return h.nextElementSibling && h.nextElementSibling.getAttribute("data-collapsed") === "1"; }).length >= 7, "属性组默认收起（data-collapsed=1）");
  qHeads.forEach(function (h) { try { h.click(); } catch (e) {} });
  assert(qHeads.filter(function (h) { return h.nextElementSibling && h.nextElementSibling.getAttribute("data-collapsed") === "0"; }).length >= 7, "点击后属性组展开（data-collapsed=0）");
  /* v1.9.16 自查补：展开状态持久化往返——重建后 restoreOpen 应保持展开（读 collapsed["quick:组名"]） */
  api.renderPlayerEdit();
  const qHeads2 = [].slice.call(qp2.querySelectorAll(".mce-grp .mce-collapse-head")).filter(function (h) {
    return h.textContent.indexOf("（当前值即游戏面板原始量纲") !== -1;
  });
  assert(qHeads2.filter(function (h) { return h.nextElementSibling && h.nextElementSibling.getAttribute("data-collapsed") === "0"; }).length >= 7, "展开状态持久化：重建后属性组仍展开（data-collapsed=0）");
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
    /* 原版 HTML 路径见文件头 GAME_HTML_PATH（可用 MCE_DOL_HTML 覆盖；缺失时本段自然跳过）。 */
    const GAME_HTML = GAME_HTML_PATH;
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
      /* v1.9.16：角色译名统一——Alex 分组标题「亚历克斯」→「艾利克斯」（与 01-core 角色名表一致） */
      assert(sptxt.indexOf("艾利克斯 Alex") !== -1 && sptxt.indexOf("亚历克斯 Alex") === -1, "15 角色译名：Alex 分组标题 = 艾利克斯 Alex（修复前显示 亚历克斯），实际 " + sptxt.slice(sptxt.indexOf("艾利克斯"), sptxt.indexOf("艾利克斯") + 30));
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
      /* ---------- 17. v1.9.14 UI 动效：CSS 规则与工具函数源码断言（CSS 串内嵌构建产物） ---------- */
      assert(js.indexOf(".mce-btn:active{transform:scale(.96)}") !== -1, "17 .mce-btn 按压缩放 scale(.96)（效果1）");
      assert(js.indexOf("#mce-root button:active{transform:scale(.96)}") !== -1, "17 面板内全部按钮统一按压缩放（效果1）");
      assert(js.indexOf("#mce-toggle:active{transform:scale(.94)}") !== -1, "17 悬浮球按压缩放 scale(.94)");
      assert(js.indexOf("translateY(-1px)") !== -1 && js.indexOf(".mce-btn.mce-gold:hover") !== -1, "17 金色按钮 hover 上浮+阴影（效果3）");
      assert(js.indexOf("transition:background .12s ease,transform .12s ease,box-shadow .12s ease") !== -1, "17 按钮过渡 12ms（效果1/3）");
      assert(js.indexOf("@keyframes mce-pop-in") !== -1 && js.indexOf("@keyframes mce-pop-out") !== -1, "17 面板开合 keyframes（效果6）");
      assert(js.indexOf("#mce-root.mce-closing{animation:mce-pop-out .12s ease-in forwards}") !== -1, "17 面板关闭淡出 class（效果6）");
      assert(js.indexOf("@keyframes mce-fade-in") !== -1 && js.indexOf('data-collapsed=\\"0\\"]{animation:mce-fade-in .2s ease-out}') !== -1, "17 折叠组展开淡入规则（效果4）");
      assert(js.indexOf(".mce-flash{animation:mce-flash .6s ease-out}") !== -1 && js.indexOf("@keyframes mce-flash") !== -1, "17 写入成功闪烁规则（效果2）");
      assert(js.indexOf("function mbCEFlash(node)") !== -1 && js.indexOf("function mbCEFlashAfterRender(stageKey)") !== -1, "17 mbCEFlash/mbCEFlashAfterRender 工具在位（效果2）");
    }, 800);
  } catch (e16) {
    failures++;
    console.error("FAIL: 16 分片测试异常：" + (e16 && e16.message ? e16.message : e16));
    window.__mbCE_forceSyncRows = true;
  }
  /* ---------- 18. v1.9.29 UI 优化：星空蓝双主题 + 锚定确认条 token 化 + 角色页搜索 ---------- */
  try {
    const rootEl18 = document.querySelector("#mce-root");
    const tg18 = document.querySelector("#mce-toggle");
    assert(!!rootEl18 && !!tg18, "18 面板根与悬浮球存在（主题切换载体）");
    assert(!!document.querySelector(".mce-theme-btn"), "18 header 主题按钮存在（✦，.mce-theme-btn）");
    /* 18.1 主题切换：类挂载 + localStorage 持久化 + 恢复 */
    api.setTheme("starry");
    assert(rootEl18.classList.contains("mce-theme-starry"), "18 setTheme(starry) → #mce-root 挂 .mce-theme-starry");
    assert(tg18.classList.contains("mce-theme-starry"), "18 setTheme(starry) → 悬浮球挂 .mce-theme-starry");
    const st18 = JSON.parse(localStorage.getItem("mbCE_ui_state_v1") || "{}");
    assert(st18.theme === "starry", "18 主题持久化 → mbCE_ui_state_v1.theme=starry");
    assert(api.getTheme() === "starry", "18 api.getTheme()=starry");
    api.setTheme("gold");
    assert(!rootEl18.classList.contains("mce-theme-starry") && !tg18.classList.contains("mce-theme-starry"), "18 切回 gold → 星空类移除");
    assert(api.getTheme() === "gold", "18 api.getTheme()=gold");
    assert(mceCss.indexOf("#mce-root.mce-theme-starry{--mce-accent:#8fb3ff") !== -1, "18 CSS 星空主题变量组（accent 星蓝 #8fb3ff，深蓝夜空）");
    assert(mceCss.indexOf("radial-gradient(1px 1px at 12% 20%") !== -1, "18 CSS 星空氛围：.mce-body 星点（径向渐变点阵，零图片请求）");
    assert(mceCss.indexOf("@keyframes mce-toggle-glow") !== -1, "18 CSS 悬浮球星辉光晕呼吸动画");
    /* 18.2 确认条 token 化：无内联色、类名/按钮类、进入动画、主题跟随 */
    api.showAnchorPrompt({ key: "__smoke__", name: "测试锚定" }, { location: "Room" });
    const ap18 = document.querySelector(".mce-anchor-prompt");
    assert(!!ap18, "18 确认条 DOM 存在（.mce-anchor-prompt）");
    assert(ap18.style.cssText.indexOf("background:") === -1, "18 确认条无内联背景色（此前 #f5f0e0 内联，现走 token CSS 类）");
    assert(!!ap18.querySelector(".mce-anchor-go"), "18 确认条「立即触发★」带 .mce-anchor-go 类");
    assert(ap18.querySelectorAll("button").length === 2, "18 确认条双按钮（立即触发/暂不触发）");
    assert(mceCss.indexOf(".mce-anchor-prompt{position:fixed") !== -1 && mceCss.indexOf("@keyframes mce-prompt-in") !== -1, "18 CSS 定义 .mce-anchor-prompt + 进入动画");
    assert(js.indexOf("background:#f5f0e0") === -1 && js.indexOf("background:#7a9b4f") === -1 && js.indexOf("background:#888") === -1, "18 源码无确认条旧内联硬编码色（f5f0e0/7a9b4f/888 已清除）");
    api.setTheme("starry");
    api.showAnchorPrompt({ key: "__smoke2__", name: "测试锚定2" }, { location: "Room" });
    const ap18b = document.querySelector(".mce-anchor-prompt");
    assert(!!ap18b && ap18b.classList.contains("mce-theme-starry"), "18 星空主题下确认条跟随 .mce-theme-starry");
    api.hideAnchorPrompt();
    api.setTheme("gold");
    assert(!document.querySelector(".mce-anchor-prompt"), "18 hideAnchorPrompt → 确认条移除");
    /* 18.3 角色页搜索：input 过滤 → 分组计数/hint 匹配数；清空恢复 */
    api.renderCards();
    const charPane18 = document.querySelector('[data-pane="char"]');
    let cs18 = charPane18.querySelector(".mce-char-search");
    assert(!!cs18, "18 角色页搜索框存在（.mce-char-search，复用 .mce-search-inp）");
    assert(cs18.placeholder.indexOf("搜索角色") !== -1, "18 搜索框占位文案（placeholder 搜索角色）");
    cs18.value = "爱丽丝";
    cs18.dispatchEvent(new window.Event("input", { bubbles: true }));
    const modHead18 = charPane18.querySelector('.mce-grp[data-tcat="模组角色"] .mce-grp-t');
    assert(!!modHead18 && modHead18.textContent.indexOf("模组角色（1）") !== -1, "18 搜索「爱丽丝」→ 模组角色分区计数 1，实际 " + (modHead18 ? modHead18.textContent : "无"));
    assert(charPane18.textContent.indexOf("匹配 1 个") !== -1, "18 hint 显示「匹配 1 个」");
    cs18 = charPane18.querySelector(".mce-char-search");
    cs18.value = "";
    cs18.dispatchEvent(new window.Event("input", { bubbles: true }));
    const modHead18b = charPane18.querySelector('.mce-grp[data-tcat="模组角色"] .mce-grp-t');
    assert(!!modHead18b && modHead18b.textContent.indexOf("模组角色（4）") !== -1, "18 清空搜索 → 恢复计数 4，实际 " + (modHead18b ? modHead18b.textContent : "无"));
    const st18b = JSON.parse(localStorage.getItem("mbCE_ui_state_v1") || "{}");
    assert(st18b.charFilter === "", "18 搜索词清空后 charFilter 持久化为空串");
  } catch (e18) {
    failures++;
    console.error("FAIL: 18 UI 优化测试异常：" + (e18 && e18.message ? e18.message : e18));
  }
  /* ---------- 19. v1.9.30 剧情直达触发：每场景行「直达触发」按钮 + directTriggerScene 链路 ---------- */
  try {
    /* 19.0 mock 引擎：捕获 Engine.play（startAnchoredReplay 内部调用点）；mock wikifier 记录 freeze/unfreeze */
    const playCalls = [];
    window.Engine = { play: function (name, pass) { playCalls.push(name); window.__mce_play_pass = pass; } };
    window.wikifier = function (n) { (window.__mce_wiki = window.__mce_wiki || []).push(n); };
    window.__mce_wiki = [];
    delete V.replayScene;
    /* 19.1 api 层：directTriggerScene 从 def 构造 P → startAnchoredReplay 开播（凯拉尔绑架） */
    V.scenes = {
      KylarAbduction: { name: "Kylar Abduction", startPassage: "Kylar Abduction Intro", passages: ["Kylar Abduction Intro", "Abduction", "Rescue Attempt", "Free Rescue"], unlocked: true }
    };
    const dr19 = api.directTriggerScene("KylarAbduction");
    assert(!!dr19 && dr19.ok === true, "19 api.directTriggerScene(KylarAbduction) 返回 ok（直达凯拉尔绑架），实际 " + JSON.stringify(dr19));
    assert(playCalls.indexOf("Kylar Abduction Intro") !== -1, "19 直达触发调用 Engine.play(入口段落 Kylar Abduction Intro)");
    assert(!!V.replayScene && V.replayScene.name === "Kylar Abduction" && V.replayScene.startPassage === "Kylar Abduction Intro", "19 V.replayScene 已设置（name/startPassage，进入播放态）");
    assert(V.replayScene.exitpassage === "Room", "19 exitpassage=当前段落（播完自动回原位），实际 " + (V.replayScene && V.replayScene.exitpassage));
    assert(V.replayScene.mbCE_direct === true, "19 直达重放带 mbCE_direct 标志（不走白名单中断）");
    assert(window.__mce_wiki.indexOf("freezePlayerStats") === -1, "19 直达不冻结数值（freezePlayerStats 未被调用，剧情效果真实生效）");
    /* 19.2 防重入：播放中再次直达被拒 */
    const dr19b = api.directTriggerScene("KylarAbduction");
    assert(!!dr19b && dr19b.ok === false && String(dr19b.message).indexOf("播放") !== -1, "19 播放中再次直达被拒（防重入），实际 " + JSON.stringify(dr19b));
    /* 19.3 无入口段落场景：def 无 startPassage → 拒绝且提示（先清播放态） */
    delete V.replayScene;
    V.scenes.NoEntry = { name: "无入口测试", unlocked: true };
    const dr19c = api.directTriggerScene("NoEntry");
    assert(!!dr19c && dr19c.ok === false && String(dr19c.message).indexOf("无入口") !== -1, "19 无 startPassage 场景直达被拒，实际 " + JSON.stringify(dr19c));
    /* 19.4 播放结束清理：模拟退出重放（replayScene 清除）→ 可再次直达 */
    delete V.replayScene;
    const dr19d = api.directTriggerScene("KylarAbduction");
    assert(!!dr19d && dr19d.ok === true, "19 播放结束后可再次直达（重看剧情），实际 " + JSON.stringify(dr19d));
    delete V.replayScene;
    delete V.scenes.NoEntry;
    /* 19.5–19.8 UI：剧情页渲染 → 场景行「直达触发」按钮存在且可用。
       依赖原版 HTML 抽取的场景元数据（干净克隆 / CI 上无原版文件 → SKIP，不误报）。 */
    if (!HAS_GAME_HTML) {
      console.log("SKIP: 19.5-19.8 剧情页 UI 断言（原版 HTML 不在本机：" + GAME_HTML_PATH + "）");
    } else {
    /* 19.5 UI：剧情页渲染 → 场景行「直达触发」按钮存在且可用 */
    clickTabSafe("scenes");
    const pane19 = document.querySelector('[data-pane="scenes"]');
    const row19 = pane19 ? Array.prototype.slice.call(pane19.querySelectorAll(".mce-stage")).find(function (r) { return r.textContent.indexOf("Kylar Abduction") !== -1; }) : null;
    assert(!!row19, "19 剧情页渲染出凯拉尔绑架场景行（Kylar Abduction）");
    const dtBtn19 = row19 ? Array.prototype.slice.call(row19.querySelectorAll("button")).find(function (b) { return b.textContent === "直达触发"; }) : null;
    assert(!!dtBtn19 && !dtBtn19.disabled, "19 场景行「直达触发」按钮存在且可用（非播放中）");
    /* 19.6 点击按钮 → 触发播放（Engine.play + replayScene） */
    playCalls.length = 0;
    dtBtn19.click();
    assert(playCalls.indexOf("Kylar Abduction Intro") !== -1, "19 点击「直达触发」→ Engine.play 被调用（入口段落）");
    assert(!!V.replayScene && V.replayScene.name === "Kylar Abduction", "19 点击按钮后 V.replayScene 设置（进入播放态）");
    /* 19.7 播放中重渲染 → 按钮禁用（title 提示「正在播放剧情」） */
    clickTabSafe("scenes");
    const pane19b = document.querySelector('[data-pane="scenes"]');
    const dtBtn19b = pane19b ? Array.prototype.slice.call(pane19b.querySelectorAll("button")).find(function (b) { return b.textContent === "直达触发"; }) : null;
    assert(!!dtBtn19b && dtBtn19b.disabled && String(dtBtn19b.title).indexOf("播放") !== -1, "19 播放中重渲染直达按钮禁用（title 提示正在播放剧情），实际 title=" + (dtBtn19b ? dtBtn19b.title : "无"));
    /* 19.8 播放结束 → 按钮恢复可用 */
    delete V.replayScene;
    clickTabSafe("scenes");
    const pane19c = document.querySelector('[data-pane="scenes"]');
    const dtBtn19c = pane19c ? Array.prototype.slice.call(pane19c.querySelectorAll("button")).find(function (b) { return b.textContent === "直达触发"; }) : null;
    assert(!!dtBtn19c && !dtBtn19c.disabled, "19 播放结束重渲染直达按钮恢复可用");
    }
    /* 19.9 重开直达（走完可重看）→ 直达语义：mbCE_direct + 不冻结数值 */
    const dr19e = api.directTriggerScene("KylarAbduction");
    assert(!!dr19e && dr19e.ok === true, "19 直达结束后可再次直达（重看剧情），实际 " + JSON.stringify(dr19e));
    assert(!!V.replayScene && V.replayScene.mbCE_direct === true, "19 直达重放 mbCE_direct 标志保留");
    assert(window.__mce_wiki.indexOf("freezePlayerStats") === -1, "19 直达全程不冻结数值（freezePlayerStats 始终未调用）");
    /* 19.10 实机 bug 核心回归：剧情分支段跳转（玩家选任意选项）→ 不被判出口、不跳回原地点。
       修复前：dest ∉ passages 白名单 → 链外出口判定清 replayScene + 改 dest 回触发点（牛津街） */
    const paA = { name: "Kylar Abduction Angry" };
    api.onPassageOverride(paA);
    assert(!!V.replayScene, "19 选选项去分支段（白名单外）→ replayScene 保留（不跳回原地点）");
    assert(Array.isArray(V.replayScene.passages) && V.replayScene.passages.indexOf("Kylar Abduction Angry") !== -1, "19 分支段动态并入白名单（防原版 redirect 改写）");
    assert(paA.name === "Kylar Abduction Angry", "19 分支段 dest 未被改写为原位（剧情继续流转）");
    /* 19.11 原版 redirect 兼容：并入后 passages.includes(dest) 命中 → 原版 checkPassages（L31697）放行 */
    assert(V.replayScene.passages.includes("Kylar Abduction Angry"), "19 原版 redirect 判据 passages.includes 现命中 → 不再改 Scene Viewer End");
    /* 19.12 走完剧情：出口段（当前段源码含 <<endevent>>/<<badEndTrackingEnd>>）点 Next 跳普通段
       → 清理重放状态但保留 dest（剧情自然回主循环 = 走完正常发展） */
    const savedPassage19 = global.State.passage;
    const savedStory19 = global.Story;
    global.State.passage = "Kylar Abduction Release 4";
    global.Story = global.Story || {};
    global.Story.get = function () { return { source: "<<link [[Next|Danube Street]]>><<endevent>><<badEndTrackingEnd \"Kylar Abduction\" { reason: \"kylarAbductionReleased\" }>><</link>>" }; };
    const paB = { name: "Danube Street" };
    api.onPassageOverride(paB);
    assert(!V.replayScene, "19 出口段点 Next → replayScene 清理（剧情已结束）");
    assert(paB.name === "Danube Street", "19 出口 dest 保留（剧情自然回 Danube Street，走完正常发展）");
    global.State.passage = savedPassage19;
    if (savedStory19) { global.Story = savedStory19; } else { delete global.Story; }
    /* 19.12a 多段出口剧情：出口段（含 <<endevent>>）Next 指向剧情内段（白名单内）→ 不清理、放行（剧情继续流转） */
    const dr19g = api.directTriggerScene("KylarAbduction");
    assert(!!dr19g && dr19g.ok === true, "19 再次直达开播（19.12a 前置），实际 " + JSON.stringify(dr19g));
    const savedPassage19b = global.State.passage;
    const savedStory19b = global.Story;
    global.State.passage = "Kylar Abduction Release 4";
    global.Story = global.Story || {};
    global.Story.get = function () { return { source: "<<link [[Next|Abduction]]>><<endevent>><<badEndTrackingEnd \"Kylar Abduction\" { reason: \"kylarAbductionReleased\" }>><</link>>" }; };
    const paB2 = { name: "Abduction" };
    api.onPassageOverride(paB2);
    assert(!!V.replayScene, "19 出口段 Next 到剧情内段（白名单内）→ replayScene 保留（剧情继续，不误判出口）");
    assert(paB2.name === "Abduction", "19 剧情内 dest 未被改写");
    global.State.passage = savedPassage19b;
    if (savedStory19b) { global.Story = savedStory19b; } else { delete global.Story; }
    delete V.replayScene;
    /* 19.14 实机 bug（v1.9.30.002）：学校检查剧情（SchoolInspection）出口段 Next 回 startPassage → 必须清理。
       修复前：出口段含 <<endevent>> 但 dest === startPassage 被 (b) 排除 → replayScene 残留 → 剧情页全部
       「直达触发」按钮永久禁用（title 正在播放剧情）。修复：出口段一律判定剧情结束（dest 在白名单内仍由
       19.12a 保护放行；dest=startPassage ∉ 白名单 / 剧情外段 → 清理 + 保留 dest 落主循环）。 */
    V.scenes.SchoolInspectionBreast = {
      name: "School Inspection - Breast", startPassage: "Science Lesson",
      passages: ["Breast Inspection", "Breast Inspection Comply", "Breast Inspection Flaunt", "Breast Inspection Flat Flaunt", "Breast Inspection Protest", "Breast Inspection End"],
      unlocked: true
    };
    const dr19h = api.directTriggerScene("SchoolInspectionBreast");
    assert(!!dr19h && dr19h.ok === true, "19 直达开播学校检查-胸部（19.14 前置），实际 " + JSON.stringify(dr19h));
    assert(!!V.replayScene && V.replayScene.startPassage === "Science Lesson", "19 SchoolInspection startPassage=Science Lesson（∉ passages 白名单）");
    const savedPassage19c = global.State.passage;
    const savedStory19c = global.Story;
    global.State.passage = "Breast Inspection End";
    global.Story = global.Story || {};
    global.Story.get = function () { return { source: "<<link [[Next|Science Lesson]]>><<endevent>><</link>>" }; };
    const paB3 = { name: "Science Lesson" };
    api.onPassageOverride(paB3);
    assert(!V.replayScene, "19 学校检查出口段（<<endevent>>）Next 回 startPassage → replayScene 清理（修复直达按钮永久禁用）");
    assert(paB3.name === "Science Lesson", "19 出口 dest 保留（玩家落 Science Lesson 课堂主循环，不跳回触发点）");
    global.State.passage = savedPassage19c;
    if (savedStory19c) { global.Story = savedStory19c; } else { delete global.Story; }
    /* 19.14b 清理后重渲染：剧情页该行「直达触发」按钮恢复可用（title 不再是「正在播放剧情」）。
       同样依赖原版 HTML 的场景元数据 → 缺失时 SKIP。 */
    if (!HAS_GAME_HTML) {
      console.log("SKIP: 19.14b 学校检查行按钮恢复断言（原版 HTML 不在本机）");
    } else {
    clickTabSafe("scenes");
    const pane19d = document.querySelector('[data-pane="scenes"]');
    const schoolHead19 = pane19d ? Array.prototype.slice.call(pane19d.querySelectorAll(".mce-grp-t")).find(function (h) { return h.textContent.indexOf("学校") !== -1; }) : null;
    if (schoolHead19) { schoolHead19.click(); } else if (pane19d) { Array.prototype.slice.call(pane19d.querySelectorAll(".mce-grp-t")).forEach(function (h) { h.click(); }); } /* 学校组默认收起（懒渲染），先展开再找行 */
    const row19d = pane19d ? Array.prototype.slice.call(pane19d.querySelectorAll(".mce-stage")).find(function (r) { return r.textContent.indexOf("School Inspection - Breast") !== -1; }) : null;
    const dtBtn19d = row19d ? Array.prototype.slice.call(row19d.querySelectorAll("button")).find(function (b) { return b.textContent === "直达触发"; }) : null;
    assert(!!dtBtn19d && !dtBtn19d.disabled && String(dtBtn19d.title).indexOf("正在播放剧情") === -1, "19 学校检查剧情播完 → 直达按钮恢复可用（title 非「正在播放剧情」），实际 title=" + (dtBtn19d ? dtBtn19d.title : "无"));
    }
    delete V.scenes.SchoolInspectionBreast;
    delete V.replayScene;
    /* 19.15 迭代优化（v1.9.30.003）：出口段 Next 回触发点（exitDest）→ 必须清理。
       实证：玩家在 Danube Street 触发凯拉尔绑架直达（exitpassage=Danube Street），出口段
       "Kylar Abduction Release 4"（含 <<endevent>>+<<badEndTrackingEnd>>）Next 回 Danube Street=exitDest，
       旧 (b) 的「dest !== exitDest」排除把它当剧情未结束 → replayScene 残留 → 直达按钮永久禁用。
       修复：出口段一律以「当前段含结束信号」为准（rpExit 白名单保护保留），dest=exitDest 同样清理。 */
    const dr19i = api.directTriggerScene("KylarAbduction");
    assert(!!dr19i && dr19i.ok === true, "19 直达开播凯拉尔绑架（19.15 前置），实际 " + JSON.stringify(dr19i));
    const savedPassage19d = global.State.passage;
    const savedStory19d = global.Story;
    global.State.passage = "Kylar Abduction Release 4";
    global.Story = global.Story || {};
    global.Story.get = function () { return { source: "<<endevent>><<badEndTrackingEnd>><<link [[Next|Room]]>><</link>>" }; };
    const paB4 = { name: "Room" };
    api.onPassageOverride(paB4);
    assert(!V.replayScene, "19 出口段（<<endevent>>）Next 回触发点 exitDest → replayScene 清理（防 Danube Street 直达残留）");
    assert(paB4.name === "Room", "19 出口 dest 保留（玩家落触发点，剧情结束语义）");
    global.State.passage = savedPassage19d;
    if (savedStory19d) { global.Story = savedStory19d; } else { delete global.Story; }
    /* 19.16 迭代优化（v1.9.30.003）：分支段（无 endevent）Next 回触发点（exitDest）→ 必须清理。
       玩家在触发点中途从剧情分支段返回原位（剧情退出）→ 清理重放，防残留；须在并入白名单之前判定
       （exitDest 非剧情链段，不应被并入）。 */
    const dr19h2 = api.directTriggerScene("KylarAbduction");
    assert(!!dr19h2 && dr19h2.ok === true, "19 再次直达开播（19.16 前置），实际 " + JSON.stringify(dr19h2));
    const savedPassage19e = global.State.passage;
    const savedStory19e = global.Story;
    global.State.passage = "Kylar Abduction Intro";
    global.Story = global.Story || {};
    global.Story.get = function () { return { source: "<<link [[Next|Room]]>><</link>>" }; };
    const paB5 = { name: "Room" };
    api.onPassageOverride(paB5);
    assert(!V.replayScene, "19 分支段（无 endevent）Next 回触发点 exitDest → replayScene 清理（防中途返回残留）");
    assert(paB5.name === "Room", "19 返回 dest 保留");
    global.State.passage = savedPassage19e;
    if (savedStory19e) { global.Story = savedStory19e; } else { delete global.Story; }
    delete V.replayScene;
    /* 19.13 场景查看器 UI 兜底：直达被 redirect 落到 Scene Viewer End → 清理 + 回原位（exitpassage） */
    const dr19f = api.directTriggerScene("KylarAbduction");
    assert(!!dr19f && dr19f.ok === true, "19 再次直达开播（19.13 前置），实际 " + JSON.stringify(dr19f));
    const paC = { name: "Scene Viewer End" };
    api.onPassageOverride(paC);
    assert(!V.replayScene, "19 直达落到 Scene Viewer End → 清理重放");
    assert(paC.name === "Room", "19 Scene Viewer End 兜底回原位（exitpassage=Room），实际 " + paC.name);
    delete V.replayScene;
    /* 19.17 穷举回归（v1.9.30.003 提分项）：地点 × 出口组合矩阵。
       数据源 tests/data/direct_exit_matrix.json —— tools/gen_direct_exit_matrix.py 从原版 HTML
       （110 场景 def / 16087 段 / 355 个链内含结束信号段）解析生成 2080 条 (场景, 当前段, Next 目标)
       组合；期望值由生成器内独立规则判定器 R1-R6 给出，与 07f-pins.js 实现构成双实现交叉验证：
         R1 出口段(dest∉链)→clear  R2 出口段(dest∈链)→keep  R3 无信号段(dest=触发点槽位)→clear
         R4 无信号段(dest∈链)→keep  R5 无信号段(dest∉链)→push 并入白名单  R6 Scene Viewer→clear+回原位
       覆盖 .002 只测「出口≠触发点」单路径的盲区：R3 全 110 场景 × 每段逐一跑到，实机才暴露的
       残留洞（如 Danube Street 触发凯拉尔）在 CI 即被拦截。表缺失 → SKIP（不误报），表存在 → 必须全绿。 */
    const mxPath19 = path.join(__dirname, "data", "direct_exit_matrix.json");
    let mx19 = null, scenes19 = null, cases19 = null; /* 提升到块外：19.18/19.19/19.20 复用同一份解析结果，避免重复读 1MB JSON */
    if (!fs.existsSync(mxPath19)) {
      console.log("SKIP: 19.17 穷举矩阵表缺失（先跑 python tools/gen_direct_exit_matrix.py）");
    } else {
      mx19 = JSON.parse(fs.readFileSync(mxPath19, "utf8"));
      scenes19 = mx19.scenes || {};
      cases19 = mx19.cases || [];
      /* 判据升级（v1.9.30.004）：段「含结束信号」= 源码字面 OR 段内直接调用「定义体内含 <<endevent>> 的
         widget」（depth=1）。mock 必须提供 widget 定义载体，否则实现退化为字面判据 → 94 条 depth=1 出口段
         会被误判 push（假红）。这里按矩阵 indirectVia 名单动态生成一份 widget 定义段落。 */
      const wName19 = new Set();
      cases19.forEach(function (c) { (c.indirectVia || []).forEach(function (n) { wName19.add(n); }); });
      const wSrc19 = Array.from(wName19).map(function (n) { return '<<widget "' + n + '">><<endevent>><</widget>>'; }).join("\n");
      global.Story = global.Story || {};
      const wSaved19f = global.Story.passages;
      global.Story.passages = [{ name: "__mce_widget_defs_19", text: wSrc19 }];
      api.resetWidgetEndSignalCache();
      const bad19 = [];
      const stat19 = {};
      V.daily = (typeof V.daily === "object" && V.daily) ? V.daily : {};
      V.scenes = (typeof V.scenes === "object" && V.scenes) ? V.scenes : {};
      const savedPassage19f = global.State.passage;
      const savedStory19f = global.Story;
      window.__mce_wiki = []; /* 清空 wikifier 调用记录：direct 路径不应触发 unfreeze（见下方断言） */
      for (let ci19 = 0; ci19 < cases19.length; ci19++) {
        const cs19 = cases19[ci19];
        const sc19 = scenes19[cs19.scene];
        if (!sc19) { bad19.push(cs19.id + " 场景表缺失"); continue; }
        V.replayScene = { mbCE_direct: true, passages: sc19.passages.slice(), exitpassage: mx19.meta.exitSlot, startPassage: sc19.startPassage };
        V.mbCE_replayOnce = { key: cs19.scene }; /* 实现前置条件：MOD 触发标记为真才进入判定（否则按原版手动重放直接 return） */
        global.State.passage = cs19.curPassage;
        global.Story = global.Story || {};
        /* 三类段源码：字面含信号 / 仅段内调用含信号 widget（indirectVia）/ 无任何信号。
           第三类之外必须让实现能真正"看到"间接信号，否则等于没测到新判据。 */
        const via19 = (cs19.curHasEndIndirect && Array.isArray(cs19.indirectVia) && cs19.indirectVia.length)
          ? ("<<" + cs19.indirectVia[0] + ">>") : "";
        global.Story.get = function () {
          return {
            source: cs19.curHasEnd
              ? "<<endevent>><<badEndTrackingEnd>><<link [[Next|X]]>><</link>>"
              : (via19 + "<<link [[Next|X]]>><</link>>")
          };
        };
        const pa19 = { name: cs19.dest };
        api.onPassageOverride(pa19);
        let ok19 = false, act19 = "";
        const rp19 = V.replayScene;
        /* 清理完整性：清 replayScene 之外还必须清掉触发标记，否则剧情页直达按钮仍被禁用（v1.9.30 实机症状） */
        const pend19 = (V.mbCE_replayOnce !== undefined) || (V.mbCE_replayPending !== undefined);
        const pendMsg19 = pend19 ? " 清理不完整（mbCE_replayOnce/mbCE_replayPending 残留 → 按钮仍禁用）" : "";
        if (cs19.expect === "clear") {
          ok19 = !rp19 && pa19.name === cs19.dest && !pend19;
          act19 = (rp19 ? "replayScene 残留" : "") + (pa19.name !== cs19.dest ? " dest 被改写→" + pa19.name : "") + pendMsg19;
        } else if (cs19.expect === "clear_return") {
          ok19 = !rp19 && pa19.name === mx19.meta.exitSlot && !pend19;
          act19 = (rp19 ? "replayScene 残留" : "") + (pa19.name !== mx19.meta.exitSlot ? " name=" + pa19.name : "") + pendMsg19;
        } else if (cs19.expect === "keep") {
          ok19 = !!rp19 && pa19.name === cs19.dest;
          act19 = (!rp19 ? "replayScene 被清" : "") + (pa19.name !== cs19.dest ? " dest 被改写→" + pa19.name : "");
        } else if (cs19.expect === "push") {
          ok19 = !!rp19 && Array.isArray(rp19.passages) && rp19.passages.indexOf(cs19.dest) !== -1;
          act19 = (!rp19 ? "replayScene 被清" : ((!rp19.passages || rp19.passages.indexOf(cs19.dest) === -1) ? " dest 未并入白名单" : ""));
        } else {
          act19 = "未知期望 " + cs19.expect;
        }
        stat19[cs19.rule] = stat19[cs19.rule] || { pass: 0, fail: 0 };
        if (ok19) { stat19[cs19.rule].pass++; }
        else { stat19[cs19.rule].fail++; bad19.push(cs19.id + " [expect=" + cs19.expect + "/" + cs19.rule + "] " + act19); }
      }
      global.State.passage = savedPassage19f;
      if (savedStory19f) { global.Story = savedStory19f; } else { delete global.Story; }
      /* 还原 widget 定义载体并重置判据缓存，避免污染后续 19.18/19.19/19.20 与其它块 */
      if (global.Story) { global.Story.passages = wSaved19f; }
      api.resetWidgetEndSignalCache();
      delete V.replayScene;
      /* direct 路径在进入时就不冻结数值（startAnchoredReplay 对 P.direct 跳过 freeze），因此清理阶段
         也不得调用 unfreeze——误调会把冻结快照恢复回去，造成数值跳变（v1.9.30 实机修复点）。 */
      const unfr19 = (window.__mce_wiki || []).filter(function (n) { return n === "unfreezePlayerStats"; }).length;
      assert(unfr19 === 0, "19.17 direct 路径清理不触发 unfreeze（wikifier(unfreezePlayerStats) 实际调用 " + unfr19 + " 次，应为 0）");
      const rules19 = ["R1", "R2", "R3", "R4", "R5", "R6"];
      const summary19 = rules19.map(function (r) {
        const s = stat19[r] || { pass: 0, fail: 0 };
        return r + " " + s.pass + "/" + (s.pass + s.fail);
      }).join(", ");
      /* P2：规模不再硬编码 2080（判据升级后矩阵会变），改为「与 meta 自洽 + 不退化下限」双锁：
         meta.caseCount 与 cases 实际长度必须相等（生成器自洽）；同时给下限，防止生成器退化成空表后全绿假象。 */
      assert(cases19.length === mx19.meta.caseCount, "19.17 矩阵规模与 meta 自洽（meta " + mx19.meta.caseCount + " 条 / 实际 " + cases19.length + " 条）");
      assert(cases19.length >= 2000, "19.17 矩阵规模未退化（下限 2000 条，实际 " + cases19.length + " 条；110 场景/16087 段解析）");
      assert(bad19.length === 0, "19.17 地点×出口穷举全绿 [" + summary19 + "]，失配 " + bad19.length + (bad19.length ? "：\n      " + bad19.slice(0, 15).join("\n      ") : ""));
      /* 强化锚点：.003 实机 bug 的两类组合必须各自被覆盖到（防生成器退化成空表后"全绿"假象） */
      const coversR3Exit19 = cases19.some(function (c) { return c.rule === "R3" && c.scene === "KylarAbduction"; });
      const coversR1Exit19 = cases19.some(function (c) { return c.rule === "R1" && c.scene === "SchoolInspectionBreast"; });
      assert(coversR3Exit19 && coversR1Exit19, "19.17 关键组合在表内（凯拉尔 R3 返回触发点 / 学校检查 R1 出口段），实际 " + coversR3Exit19 + "/" + coversR1Exit19);
    }
    /* 19.18 矩阵新鲜度护栏：矩阵是原版 HTML 的快照产物，HTML 版本更新/场景段改名后不重生成 → 回归跑的是
       过期数据（规模自洽也可能"全绿"假象）。meta.source 存在且可读时按字节数比对，不一致即失败并提示重生成。 */
    const mxPath19b = path.join(__dirname, "data", "direct_exit_matrix.json");
    if (fs.existsSync(mxPath19b)) {
      const meta19b = (mx19 && mx19.meta) || JSON.parse(fs.readFileSync(mxPath19b, "utf8")).meta || {};
      if (meta19b.source && fs.existsSync(meta19b.source)) {
        const bytes19b = fs.statSync(meta19b.source).size;
        /* 字节数比对挡不住「内容改但长度不变」的替换（等长改写/换字），SHA256 才能证明矩阵对应哪一版 HTML */
        if (meta19b.srcHash) {
          const sha19 = require("crypto").createHash("sha256").update(fs.readFileSync(meta19b.source)).digest("hex");
          assert(sha19 === meta19b.srcHash, "19.18 矩阵与原版 HTML 同步（SHA256 " + meta19b.srcHash.slice(0, 12) + "… / 实际 " + sha19.slice(0, 12) + "…，" + bytes19b + " B；不一致请重跑 python tools/gen_direct_exit_matrix.py）");
        } else {
          assert(bytes19b === meta19b.htmlBytes, "19.18 矩阵与原版 HTML 同步（meta " + meta19b.htmlBytes + " B / 实际 " + bytes19b + " B，不一致请重跑 python tools/gen_direct_exit_matrix.py）");
        }
      } else {
        console.log("SKIP: 19.18 原版 HTML 不在本机，跳过矩阵新鲜度比对（矩阵快照 " + (meta19b.htmlBytes || "?") + " B，source=" + (meta19b.source || "?") + "）");
      }
    }
    /* 19.19 间接结束信号已纳入判定：段内字面无 <<endevent>>，但直接调用了内部含 <<endevent>> 的 widget
       （endcombat / kylar_abduction_end / endconfession 等 365 个）。v1.9.30.004 起两端判据升级为
       「字面 OR depth=1 间接」，这类段不再判 R5(push) → 不许出现 R5 残留（残留即判据回退，
       replayScene 残留 = v1.9.30 实机 bug 的同构复发）。本块锁「数据一致性 + 零残留 + 判据同源」。 */
    if (mx19 && cases19) {
      const ind19 = cases19.filter(function (c) { return c.curHasEndIndirect; });
      assert(ind19.length === mx19.meta.indirectEndCaseCount, "19.19 间接结束信号字段与 meta 一致（矩阵 " + ind19.length + " 条 / meta " + mx19.meta.indirectEndCaseCount + " 条）");
      assert(mx19.meta.indirectEndPassages >= 151, "19.19 间接结束信号段数不低于基线 151（实际 " + mx19.meta.indirectEndPassages + "；下降说明 widget 解析能力退化）");
      /* 判据升级的核心回归：间接结束信号段不得再落 R5（历史 94 条 depth=1 正是此偏差） */
      const drift19 = ind19.filter(function (c) { return !c.destIsExitSlot && c.rule === "R5"; });
      assert(drift19.length === 0, "19.19 间接结束信号段零 R5 残留（实际 " + drift19.length + " 条；≥1 说明判据回退到字面判定，历史 94 条偏差会复发）");
      /* 判据同源护栏：有效结束信号段数必须 = 字面段数 + 间接段数（两侧都不许漏算/重复算） */
      const effSum19 = mx19.meta.chainEndSignalPassages + mx19.meta.indirectEndPassages;
      assert(mx19.meta.effEndSignalPassages === effSum19, "19.19 有效结束信号段数自洽（eff " + mx19.meta.effEndSignalPassages + " = 字面 " + mx19.meta.chainEndSignalPassages + " + 间接 " + mx19.meta.indirectEndPassages + "）");
      /* 间接段必须有对外可见的调用证据（indirectVia 非空），否则字段语义被破坏 */
      const badVia19 = ind19.filter(function (c) { return !(c.indirectVia && c.indirectVia.length); });
      assert(badVia19.length === 0, "19.19 间接段均携带 indirectVia 证据（缺失 " + badVia19.length + " 条：" + badVia19.slice(0, 3).map(function (c) { return c.id; }).join(", ") + "）");
    } else {
      console.log("SKIP: 19.19 矩阵缺失，跳过间接结束信号审计");
    }
    /* 19.20 多跳序列回归：19.17 每条都是「干净初始白名单 + 单跳」，测不到运行时白名单累积后
       被再次使用的情形（push 会改 rpExit，进而改变后续 inChain 判定与清理时机）。
       用真实场景串一次「链内 keep → 链外分支 push → 回触发点 clear → 重复调用幂等」。 */
    if (mx19 && scenes19) {
      const scA19 = scenes19.MoorFlower;
      if (!scA19) {
        console.log("SKIP: 19.20 MoorFlower 场景不在矩阵内，跳过多跳序列");
      } else {
        const savedPassage19g = global.State.passage;
        const savedStory19g = global.Story;
        V.replayScene = { mbCE_direct: true, passages: scA19.passages.slice(), exitpassage: "Moor", startPassage: scA19.startPassage };
        V.mbCE_replayOnce = { key: "MoorFlower" };
        global.State.passage = scA19.startPassage;
        global.Story = global.Story || {};
        global.Story.get = function () { return { source: "<<link [[Next|X]]>><</link>>" }; }; /* 无结束信号的链内段 */
        const len19a = V.replayScene.passages.length;
        const pa19a = { name: "Moor Plant Sex" }; /* 该场景 Next 目标之一、但不在白名单链内 → 应 push 并入 */
        api.onPassageOverride(pa19a);
        const len19b = V.replayScene && Array.isArray(V.replayScene.passages) ? V.replayScene.passages.length : -1;
        assert(len19b === len19a + 1 && V.replayScene.passages.indexOf("Moor Plant Sex") !== -1,
          "19.20 序列1 链外分支段并入白名单（白名单 " + len19a + "→" + len19b + " 段）");
        const pa19b = { name: "Moor" }; /* 回触发点（= exitpassage）→ 应整体清理 */
        api.onPassageOverride(pa19b);
        assert(!V.replayScene && V.mbCE_replayOnce === undefined && pa19b.name === "Moor",
          "19.20 序列2 白名单累积后回触发点仍能清理（replayScene=" + !!V.replayScene + " / 标记=" + (V.mbCE_replayOnce !== undefined) + "）");
        const pa19c = { name: "Moor" }; /* 清理后重复调用：不得崩、不得改写 dest */
        let idem19 = true;
        try { api.onPassageOverride(pa19c); idem19 = (pa19c.name === "Moor" && !V.replayScene); }
        catch (e) { idem19 = false; console.error("19.20 幂等调用抛错: " + (e && e.message)); }
        assert(idem19, "19.20 序列3 清理后重复调用幂等（不崩、不改写 dest）");
        global.State.passage = savedPassage19g;
        if (savedStory19g) { global.Story = savedStory19g; } else { delete global.Story; }
        delete V.replayScene;
        delete V.mbCE_replayOnce;
      }
    }
    /* 19.21 判据只在有效代码上生效（注释剔除）：原文有 4 段的 <<endevent 仅存在于块注释、
       1 个 widget（checkEventNPC）的信号仅在 <!-- --> 里。若把注释当信号，这些段会被提前判「剧情已结束」
       → 直接清锁（还剩可选链接的剧情被中断）。本块用纯函数口锁住三种噪声形态 + widget 表同步口径。 */
    try {
      const sig19n = api.srcHasEndSignal;
      assert(typeof sig19n === "function", "19.21 判据自检口已导出（srcHasEndSignal）");
      if (typeof sig19n === "function") {
        /* 形态 A：块注释里的信号不算 */
        assert(sig19n("段正文 /* <<endevent>> */ 结束") === false,
          "19.21 块注释里的 <<endevent>> 不算信号（实测 Pirate Deck 等 4 段即此形态）");
        /* 形态 B：HTML 注释里的信号不算 */
        assert(sig19n("段正文 <!-- <<endevent phaseless>> --> 结束") === false,
          "19.21 HTML 注释里的 <<endevent>> 不算信号（实测 checkEventNPC 即此形态）");
        /* 形态 C：真信号仍然命中（防止剔除过度把真信号也吃掉） */
        assert(sig19n("段正文 <<endevent>> 结束") === true,
          "19.21 有效代码里的 <<endevent>> 仍判为信号（剔除不得误伤）");
        /* 形态 D：widget 定义体只有注释信号 → 调用它的段不算含信号（与生成器同一口径） */
        if (global.Story && global.Story.passages) {
          const saved19h = global.Story.passages;
          const arr19h = Array.isArray(saved19h) ? saved19h.slice() : [];
          arr19h.push({
            name: "mbCE_test_comment_widget",
            text: '<<widget "wOnlyComment">><!-- <<endevent --><</widget>>'
          });
          global.Story.passages = arr19h;
          api.resetWidgetEndSignalCache();
          assert(sig19n("<<wOnlyComment>>") === false,
            "19.21 定义体仅含注释信号的 widget 不进入命中表（生成器 end_signal_widgets 同口径）");
          global.Story.passages = saved19h;
          api.resetWidgetEndSignalCache();
        }
      }
    } catch (e19c) {
      failures++;
      console.error("FAIL: 19.21 注释剔除判据异常：" + (e19c && e19c.message ? e19c.message : e19c));
    }
    /* 19.22 玩家路径级闭环（19.21 只测纯函数）：完整走 onPassageOverride 的直达态出口判定，
       锁「当前段只剩注释里的结束信号 → 不清锁」（实测 Pirate Deck 即此形态，清锁会让剧情剩链接时被打断），
       并用对照组证明剔除没有把「真信号清锁」的能力一起削掉。 */
    try {
      const savedP22 = global.State.passage;
      const savedS22 = global.Story;
      global.Story = global.Story || {};
      V.replayScene = { mbCE_direct: true, passages: ["T19p"], exitpassage: "T19home", startPassage: "T19p" };
      V.mbCE_replayOnce = { key: "k19p" };
      global.State.passage = "T19p";
      global.Story.get = function () { return { source: "正文 /* <<endevent>> */ 尾声 <<link [[Door|T19out]]>><</link>>" }; };
      const pa22 = { name: "T19out" };
      api.onPassageOverride(pa22);
      assert(!!V.replayScene && pa22.name === "T19out",
        "19.22 仅注释信号的段不清锁、不跳回（replayScene=" + !!V.replayScene + " / dest=" + pa22.name + "）");
      /* 对照组：同一路径下真信号必须正常清锁，且 dest 保留（剧情自然回主循环） */
      global.Story.get = function () { return { source: "正文 <<endevent>> 尾声" }; };
      const pa22b = { name: "T19out2" };
      api.onPassageOverride(pa22b);
      assert(!V.replayScene && pa22b.name === "T19out2",
        "19.22 真信号段仍正常清锁并保留 dest（replayScene=" + !!V.replayScene + " / dest=" + pa22b.name + "）");
      global.State.passage = savedP22;
      if (savedS22) { global.Story = savedS22; } else { delete global.Story; }
      delete V.replayScene;
      delete V.mbCE_replayOnce;
    } catch (e22) {
      failures++;
      console.error("FAIL: 19.22 注释信号玩家路径异常：" + (e22 && e22.message ? e22.message : e22));
    }
    delete V.scenes;
    delete window.Engine;
    delete window.wikifier;
    delete window.__mce_wiki;
  } catch (e19) {
    failures++;
    console.error("FAIL: 19 剧情直达触发测试异常：" + (e19 && e19.message ? e19.message : e19));
  }
  console.log(failures === 0 ? "\nSMOKE ALL PASSED" : "\nSMOKE " + failures + " FAILURES");
  process.exitCode = failures === 0 ? 0 : 1;
}, 20000);
