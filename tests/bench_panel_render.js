/* P0-3 · 声明驱动面板压测（第 5 节 P0-3 的落地脚本）
 *
 * 目的：把「445 条适配器声明 × 7 个页签 × 13 个模组详情全展开」这一最坏情况压出可复现数字，
 * 而不是靠体感判断"面板卡不卡"。断言只盯两件事：
 *   ① 规模：注入的真实声明条数 == 声明总数（确认压的是全量，不是抽样）
 *   ② 时延：首帧 / 逐页签 / 单模组详情 / 全展开最坏帧，各自不超过阈值
 *
 * 与其它测试的差别：本脚本不进 run_all 门禁（耗时波动大，且不覆盖产品逻辑），
 * 只作发布前体检。用法：
 *   node tools/build_js.js && node tests/bench_panel_render.js
 *
 * 口径说明（必读，别把这些数字当"真机首帧"）：
 *  - jsdom 只执行 JS 与 DOM 构建，不跑 CSS 布局、绘制、合成，因此本脚本量到的是
 *    **面板逻辑构建耗时**，不是浏览器渲染性能。它抓的是算法复杂度退化（把 O(n) 写成 O(n²)
 *    会立刻撞线），不能用来断言玩家看到的帧率。
 *  - 判据取宽松阈值，只判"数量级"，不判几十 ms 的抖动。
 *  - 数据来源是产物里的 CHEAT_ADAPTERS（setup.mbStageCE 已导出），不是 adapter_matrix.json
 *    —— 后者只有 key/varPath，没有面板渲染需要的 name/note/options。
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

/* 阈值（ms）：按 2026-11-09 实测基线（4.2 / 17.4 / 4.9 / 28.5）取 10~20 倍余量。
   余量再放大就拦不住真实退化（jsdom 下 140 条的 O(n²) 大约 1~2 s，仍能撞线）。 */
const LIMIT = {
  open: 200,        /* 面板首帧（7 个 pane 一次性建壳 + 默认页渲染） */
  tab: 200,         /* 单个页签切换首帧 */
  detail: 150,      /* 单个模组详情（含该模组的 stages/abilities/values 分组） */
  allOpen: 600      /* 单模组详情内全部折叠组展开后的最坏帧 */
};

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " =="); }
function ms(fn) {
  const t0 = process.hrtime.bigint();
  fn();
  return Math.round(Number(process.hrtime.bigint() - t0) / 1e5) / 10;
}
function pad(s, n) { s = String(s); while (s.length < n) { s += " "; } return s; }

/* ---------- 1. jsdom 最小环境（与 tests/mod_actions_batch_state.js 同款） ---------- */
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="story"></div></body></html>', { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;

const V = {
  player: {
    charisma: 10, beauty: 20, physique: 30, willpower: 40, awareness: 50, arousal: 60,
    exhibitionism: 70, deviancy: 80, purity: 90, trauma: 10, stress: 5, control: 50,
    virginity: { vaginal: true, penile: false }
  },
  passage: "Room",
  scenePassages: [],
  loveInterest: [],
  specialClothes: [],
  foodstuff: {},
  mbCE_wrote: {},
  world_corruption_hard: 2,
  world_corruption_soft: 0
};
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {}, get: function () { return undefined; } };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
window.__mbCE_forceSyncRows = true;

/* ---------- 2. 注入真实声明（全量 445 条） ---------- */
const AD = api.CHEAT_ADAPTERS;
assert(!!AD && typeof AD === "object", "CHEAT_ADAPTERS 已从 setup.mbStageCE 导出");

const ids = Object.keys(AD);
const mods = [];
let declaredTotal = 0;
const biggest = { modId: "", n: 0 };
ids.forEach(function (id) {
  const e = (AD[id] && AD[id].entry) || {};
  const m = {
    modId: id,
    modName: e.modName || id,
    declared: true,
    tasks: e.tasks || [],
    stages: e.stages || [],
    abilities: e.abilities || [],
    scenes: e.scenes || [],
    values: e.values || []
  };
  const n = m.tasks.length + m.stages.length + m.abilities.length + m.scenes.length + m.values.length;
  declaredTotal += n;
  if (n > biggest.n) { biggest.modId = id; biggest.n = n; }
  mods.push(m);
});
setup.mbCE_modCheats = mods;

const scanned = api.getCheatMods();
section("声明规模");
console.log("  适配器 " + ids.length + " 个 / 声明条目 " + declaredTotal + " 条");
console.log("  面板可见模组 " + scanned.length + " 个（getCheatMods 重扫后）");
console.log("  条目最多的模组：" + biggest.modId + "（" + biggest.n + " 条）");
assert(scanned.length === ids.length, "重扫后模组数 == 适配器数（" + ids.length + "）");
assert(declaredTotal === 445, "注入声明总数 445（实测 " + declaredTotal + "）");

/* ---------- 3. 首帧 ---------- */
section("首帧");
const tOpen = ms(function () { api.open(); });
console.log("  open() 首帧        " + pad(tOpen, 9) + "ms");
assert(!!document.querySelector("#mce-root"), "面板根 #mce-root 已建立");
assert(tOpen <= LIMIT.open, "open() 首帧 " + tOpen + "ms <= " + LIMIT.open + "ms");

/* ---------- 4. 逐页签切换 ---------- */
section("页签切换（7 个）");
const tabBtns = Array.prototype.slice.call(document.querySelectorAll("#mce-root .mce-tabs button"));
assert(tabBtns.length === 7, "页签数 7（实测 " + tabBtns.length + "）");

const tabTimes = [];
tabBtns.forEach(function (b) {
  const name = b.getAttribute("data-tab");
  const t = ms(function () { b.click(); });
  tabTimes.push([name, t]);
  console.log("  " + pad(name, 8) + pad(t, 9) + "ms");
});
const worstTab = tabTimes.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
assert(worstTab[1] <= LIMIT.tab, "最慢页签 " + worstTab[0] + " " + worstTab[1] + "ms <= " + LIMIT.tab + "ms");

/* ---------- 5. 逐模组详情（13 次） ---------- */
section("模组详情首帧（逐个点卡片）");
function modsPane() { return document.querySelector('#mce-root [data-pane="mods"]'); }
function clickTab(name) {
  const bs = document.querySelectorAll("#mce-root .mce-tabs button");
  for (const b of bs) { if (b.getAttribute("data-tab") === name) { b.click(); return true; } }
  return false;
}
function cardByName(name) {
  const cards = Array.prototype.slice.call(modsPane().querySelectorAll(".mce-card"));
  for (const c of cards) {
    const nm = c.querySelector(".mce-card-name");
    if (nm && nm.textContent.indexOf(name) >= 0) { return c; }
  }
  return null;
}
clickTab("mods");
const detailTimes = [];
mods.forEach(function (m) {
  /* 每次先回列表：点开一个模组后 pane 内容会被详情视图替换，卡片列表已不在 DOM */
  clickTab("mods");
  const card = cardByName(m.modName);
  if (!card) { detailTimes.push([m.modName, -1]); return; }
  const t = ms(function () { card.click(); });
  detailTimes.push([m.modName, t]);
});
const missing = detailTimes.filter(function (x) { return x[1] < 0; });
assert(missing.length === 0, "13 个模组卡片全部可点开（缺失 " + missing.length + "）");
const worstDetail = detailTimes.reduce(function (a, b) { return b[1] > a[1] ? b : a; });
detailTimes.forEach(function (x) { console.log("  " + pad(x[0], 32) + pad(x[1], 9) + "ms"); });
const sumDetail = detailTimes.reduce(function (a, b) { return a + (b[1] > 0 ? b[1] : 0); }, 0);
console.log("  13 个详情累计     " + pad(Math.round(sumDetail * 10) / 10, 9) + "ms");
assert(sumDetail <= LIMIT.detail * 13, "13 个详情累计 " + Math.round(sumDetail) + "ms <= " + (LIMIT.detail * 13) + "ms");
assert(worstDetail[1] <= LIMIT.detail, "最慢详情 " + worstDetail[0] + " " + worstDetail[1] + "ms <= " + LIMIT.detail + "ms");

/* ---------- 6. 最坏帧：条目最多的模组全部展开 ---------- */
section("最坏帧（" + biggest.modId + " 全展开）");
clickTab("mods");
const biggestMod = mods.filter(function (m) { return m.modId === biggest.modId; })[0];
const card = cardByName((biggestMod && biggestMod.modName) || biggest.modId);
assert(!!card, "定位到条目最多的模组卡片");
if (card) {
  card.click();
  const openBtn = modsPane().querySelector('[data-mce-tool="mods-open"]');
  assert(!!openBtn, "存在「全部展开」按钮");
  const tAll = ms(function () { if (openBtn) { openBtn.click(); } else { modsPane().querySelectorAll('[data-mce-head]').forEach(function (h) { h.click(); }); } });
  const rows = modsPane().querySelectorAll("[data-mce-key]").length;
  console.log("  全展开            " + pad(tAll, 9) + "ms / 行 " + rows);
  assert(tAll <= LIMIT.allOpen, "全展开 " + tAll + "ms <= " + LIMIT.allOpen + "ms");
  assert(rows > 0, "展开后确有行渲染（" + rows + " 行）");
}

/* ---------- 7. 稳定性：页签往返 3 轮 ---------- */
section("稳定性（页签往返 3 轮）");
const round = [];
for (let i = 0; i < 3; i++) {
  const t = ms(function () {
    clickTab("global"); clickTab("mods"); clickTab("places"); clickTab("mods");
  });
  round.push(t);
}
console.log("  每轮(4 次切换)    " + round.join(" / ") + " ms");
assert(round.every(function (t) { return t <= LIMIT.tab * 2; }), "往返每轮 " + Math.max.apply(null, round) + "ms <= " + (LIMIT.tab * 2) + "ms");
const drift = Math.max.apply(null, round) - Math.min.apply(null, round);
assert(drift <= LIMIT.tab, "往返耗时无累积漂移（极差 " + drift + "ms <= " + LIMIT.tab + "ms）");

/* ---------- 汇总 ---------- */
section("汇总");
console.log("  首帧 " + tOpen + "ms / 最慢页签 " + worstTab[0] + " " + worstTab[1] + "ms / 最慢详情 " + worstDetail[1] + "ms");
console.log("\n" + (failures === 0 ? "ALL PASS（声明驱动压测 " + passes + " 条断言）" : "FAILED " + failures + " / " + (passes + failures)));
process.exit(failures === 0 ? 0 : 1);
