/*
 * 功能级端到端测试（v1.8.11）：
 * 模拟游戏运行环境（8 适配器全命中 + 模组特质注入 + 完整 V 状态），
 * 真实 jsdom DOM 点击，验证：六面板渲染、适配器子页操作、模组特质获取/移除、
 * 全局页战斗终结 + 庄园自动维护 —— 全链路能正常运行。
 * 用法：node tests/functional_e2e.js（构建产物需已生成：node tools/build_js.js）
 */
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function deepGet(o, p) {
  return String(p).split(".").reduce(function (a, k) { return (a && a[k] !== undefined) ? a[k] : undefined; }, o);
}
function expectCheatResult(r, ctx) {
  if (!r || typeof r !== "object") { assert(false, ctx + " 未返回结构化结果，实际 " + JSON.stringify(r)); return r; }
  if (r.ok) { assert(true, ctx + " 写入成功"); return r; }
  const msg = String(r.message || r.reason || "");
  const expected = msg.indexOf("拒绝") !== -1 || r.reason === "vanilla" || r.reason === "parent" || r.reason === "invalid";
  assert(expected, ctx + " 被写入防线按预期拒绝（" + msg + "）");
  return r;
}

/* ---------- 1. jsdom 环境 + select.type 只读 patch（同 smoke_dom，复现真实浏览器） ---------- */
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;
try {
  Object.defineProperty(window.HTMLSelectElement.prototype, "type", {
    get: function () { return "select-one"; },
    set: function () { throw new TypeError("Cannot set property type of #<HTMLSelectElement> which has only a getter"); },
    configurable: true
  });
} catch (e) { console.error("WARN: patch select.type 失败:", e.message); }

/* ---------- 2. 游戏全局 + 8 适配器探测键 + 模组特质注入全命中 mock ---------- */
const V = {
  player: { virginity: { vaginal: true, penile: false }, name: "X", penissize: 2 },
  skill: { housekeeping: 1000, tending: 1000 },
  temple_quarters: 50, temple_garden: 50,
  edengarden: 0, edenshrooms: 0, edenspring: 0,
  soap: 0, salve: 0, pain: 0,
  mbCE_wrote: {},
  /* 归途之书 4 根（探测命中 + 可写宿主） */
  RobinTemple: { stage: "none" }, TempleChoir: {}, LostLamb: {}, TempleDuties: {},
  /* SmartPhone 根 */
  Phone: { Owned: 1, photography: 1 },
  /* Wraith 根 + Dol-Optimization 原版根缝隙 options.opt */
  WraithsReflection: 1, options: { opt: {} },
  loveInterest: [], passage: "Room", scenePassages: []
};
global.V = V;
global.State = { variables: V };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [] };
global.passage = function () { return "Room"; };
window.maplebirch = {
  get: function (k) { return (k === "RobinTemple" || k === "TempleChoir" || k === "DeadwoodReblooms") ? {} : null; },
  npc: {},
  temporary: { traitLists: [
    { title: "Book Traits", traits: [
      { name: "命运之轮", has: function () { return false; }, text: "转吧，命运之神。" },
      { name: "Acceptance: Small Penis", has: "$acceptance_penis_small gte 1000", text: "You're proud of your small penis." }
    ] }
  ] }
};
window.modUtils = { getMod: function (m) { return m === "DomRobin" ? {} : null; } };
setup.foodPreference = {};
window.DolOptimization = {};
window.MirrorHypnoVariableRefresh = function () {};

/* ---------- 3. 加载构建产物（init 自动建面板） ---------- */
const js = fs.readFileSync(path.join(__dirname, "..", "javascript", "maplebirchce.js"), "utf8");
eval(js);
const api = setup.mbStageCE;
assert(!!api && typeof api.renderPlayerEdit === "function", "setup.mbStageCE 挂载且渲染函数可用");
assert(!!document.querySelector("#mce-root"), "init→ensureDom 创建面板 #mce-root");

/* ---------- A. 六面板全部渲染不崩 ---------- */
function clickTabSafe(name) {
  try {
    const btn = document.querySelector('.mce-tabs button[data-tab="' + name + '"]');
    if (btn) { btn.click(); }
    const p = document.querySelector('[data-pane="' + name + '"]');
    return p ? p.textContent : "(pane 缺失)";
  } catch (e) { return "THREW: " + e.message; }
}
[["char", "角色"], ["stage", "阶段"], ["scenes", "剧情"], ["places", "场景"], ["global", "全局"], ["mods", "Mod作弊"]].forEach(function (pair) {
  const t = clickTabSafe(pair[0]);
  assert(t.indexOf("THREW") === -1 && t.length > 0, "A. " + pair[1] + "页渲染不崩，实际 " + t.slice(0, 40));
});

/* ---------- B. 8 适配器全命中 ---------- */
const mods = api.getCheatMods();
assert(mods.length === 8, "B. 8 适配器全部探测命中，实际 " + mods.length + " → " + mods.map(function (m) { return m.modId; }).join(","));
mods.forEach(function (m) {
  assert(!!m.modId && Array.isArray(m.stages) && Array.isArray(m.abilities) && Array.isArray(m.values), "B. " + m.modId + " 声明结构完整（stages/abilities/values 数组）");
});
const modsTxt = document.querySelector('[data-pane="mods"]').textContent;
["枯木逢春", "Dol-Optimization", "幽灵的倒影", "DoLSims", "归途", "More Love Interests", "DomRobin", "SmartPhone"].forEach(function (kw) {
  assert(modsTxt.indexOf(kw) !== -1, "B. Mod作弊 主容器含 " + kw + " 入口，实际 " + modsTxt.slice(0, 200));
});

/* ---------- C. 逐适配器子页：真实 DOM 点击 + 数据层写入/防线验证 ---------- */
let stageJumpOk = 0, abilityToggleOk = 0, valueApplyOk = 0, domClickThrew = 0, domClickDone = 0;
mods.forEach(function (mod) {
  try {
    api.renderModCheatDetail(mod.modId);
    const pane = document.querySelector('[data-pane="mods"]');
    const t = pane.textContent;
    assert(t.length > 0 && t.indexOf("THREW") === -1, "C. " + mod.modId + " 子页渲染不崩，实际 " + t.slice(0, 40));
    /* DOM 点击：第一个「跳至最高」（若该模组有阶段） */
    if (mod.stages.length) {
      const maxBtns = [].slice.call(pane.querySelectorAll("button")).filter(function (b) { return b.textContent === "跳至最高"; });
      if (maxBtns[0]) {
        try { maxBtns[0].click(); domClickDone++; } catch (e) { domClickThrew++; assert(false, "C. " + mod.modId + " 跳至最高按钮点击抛错: " + e.message); }
      }
      const r = api.jumpCheatStageMax(mod.modId, mod.stages[0].key);
      if (r && r.ok) {
        const v = api.cheatReadSafe(mod.modId, mod.stages[0].varPath);
        assert(v !== undefined && v !== null, "C. " + mod.modId + " 阶段跳至最高写入 " + mod.stages[0].varPath + "=" + JSON.stringify(v));
        stageJumpOk++;
      } else {
        expectCheatResult(r, "C. " + mod.modId + " 阶段跳至最高");
      }
    }
    /* DOM 点击：第一个能力 checkbox（若该模组有能力） */
    if (mod.abilities.length) {
      const boxes = pane.querySelectorAll('input[type="checkbox"]');
      if (boxes[0]) {
        try { boxes[0].click(); domClickDone++; } catch (e) { domClickThrew++; assert(false, "C. " + mod.modId + " 能力勾选抛错: " + e.message); }
      }
      const r2 = api.toggleCheatAbility(mod.modId, mod.abilities[0].key, true);
      if (r2 && r2.ok) {
        const v2 = api.cheatReadSafe(mod.modId, mod.abilities[0].varPath);
        assert(!!v2, "C. " + mod.modId + " 能力勾选写入 " + mod.abilities[0].varPath + "=" + JSON.stringify(v2));
        abilityToggleOk++;
      } else {
        expectCheatResult(r2, "C. " + mod.modId + " 能力勾选");
      }
    }
    /* 数据层：第一个数值/布尔值应用（list 型走 DOM checkbox 已覆盖） */
    const firstVal = mod.values.filter(function (it) { return it.type !== "list"; })[0];
    if (firstVal) {
      const raw = firstVal.type === "boolean" ? true : (typeof firstVal.min === "number" ? firstVal.min : 1);
      const r3 = api.applyCheatModValue(mod.modId, firstVal.key, raw);
      if (r3 && r3.ok) {
        const v3 = api.cheatReadSafe(mod.modId, firstVal.varPath);
        assert(v3 !== undefined && v3 !== null, "C. " + mod.modId + " 数值应用写入 " + firstVal.varPath + "=" + JSON.stringify(v3));
        valueApplyOk++;
      } else {
        expectCheatResult(r3, "C. " + mod.modId + " 数值应用");
      }
    }
  } catch (e) {
    assert(false, "C. " + mod.modId + " 子页操作抛错: " + (e && e.message || e));
  }
});
assert(domClickThrew === 0, "C. 适配器子页 DOM 点击全部无抛错（执行 " + domClickDone + " 次）");
assert(stageJumpOk >= 1 && abilityToggleOk >= 1 && valueApplyOk >= 1, "C. 至少各 1 个 阶段/能力/数值 正向写入成功（实得 " + stageJumpOk + "/" + abilityToggleOk + "/" + valueApplyOk + "）");

/* ---------- D. v1.8.11 核心：模组特质 DOM 点击级 获取/移除 ---------- */
function findTraitRow(keyword) {
  const pane = document.querySelector('[data-pane="mods"]');
  return [].slice.call(pane.querySelectorAll(".mce-row")).filter(function (row) {
    const lbl = row.querySelector(".mce-row-lbl");
    return lbl && lbl.textContent.indexOf(keyword) !== -1;
  })[0];
}
api.renderPlayerEdit();
/* v1.8.15 懒渲染：特质区默认收起 → 先展开全部分类，后续模组特质行断言才能命中 */
const openAllE = [].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll("button")).filter(function (b) { return b.textContent === "全部展开"; })[0];
if (openAllE) { openAllE.click(); }
/* D1. 函数型「命运之轮」：获取 → 强制标记；重渲染 ●+移除；移除 → 清空 */
let fateRow = findTraitRow("命运之轮");
assert(!!fateRow, "D1. 函数型模组特质「命运之轮」行渲染");
if (fateRow) {
  const gBtn = [].slice.call(fateRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "获取"; })[0];
  assert(!!gBtn, "D1. 模组特质行有「获取」按钮（v1.8.11 不再只读）");
  if (gBtn) { gBtn.click(); }
  assert(Array.isArray(V.mbCE_forcedTraits) && V.mbCE_forcedTraits.some(function (k) { return k.indexOf("命运之轮") !== -1; }), "D1. 点击获取 → 强制获得标记写入，实际 " + JSON.stringify(V.mbCE_forcedTraits));
  api.renderPlayerEdit();
  fateRow = findTraitRow("命运之轮");
  assert(!!fateRow && fateRow.textContent.indexOf("移除") !== -1 && fateRow.textContent.indexOf("●") !== -1, "D1. 重新渲染后显示 ●+移除（强制获得生效）");
  if (fateRow) {
    const rBtn = [].slice.call(fateRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "移除"; })[0];
    if (rBtn) { rBtn.click(); }
  }
  assert(!Array.isArray(V.mbCE_forcedTraits) || V.mbCE_forcedTraits.length === 0, "D1. 点击移除 → 强制标记清空");
}
/* D2. 字符串型「Acceptance: Small Penis」：获取 → 写满足变量 1000；移除 → 写回 0 */
let accRow = findTraitRow("Small Penis");
assert(!!accRow, "D2. 字符串型模组特质行渲染");
if (accRow) {
  const gBtn = [].slice.call(accRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "获取"; })[0];
  assert(!!gBtn, "D2. 字符串型模组特质行有「获取」按钮");
  if (gBtn) { gBtn.click(); }
  assert(V.acceptance_penis_small === 1000, "D2. 点击获取 → 写满足变量 acceptance_penis_small=1000，实际 " + V.acceptance_penis_small);
  api.renderPlayerEdit();
  accRow = findTraitRow("Small Penis");
  assert(!!accRow && accRow.textContent.indexOf("●") !== -1, "D2. 重新渲染后显示 ● 已拥有");
  if (accRow) {
    const rBtn = [].slice.call(accRow.querySelectorAll("button")).filter(function (b) { return b.textContent === "移除"; })[0];
    if (rBtn) { rBtn.click(); }
  }
  assert(V.acceptance_penis_small === 0, "D2. 点击移除 → 主变量写回不满足 0，实际 " + V.acceptance_penis_small);
}

/* ---------- E. 全局页：战斗终结（8 按钮）+ 庄园自动维护（6 按钮）全部真实点击 ---------- */
clickTabSafe("global");
const globalPane = document.querySelector('[data-pane="global"]');
const sections = [].slice.call(globalPane.querySelectorAll(".mce-section"));
const combatGrp = sections.filter(function (g) { return g.textContent.indexOf("战斗终结") !== -1; })[0];
assert(!!combatGrp, "E. 全局页含「战斗终结」区");
if (combatGrp) {
  /* 先单独验证 自我了断 → pain=1000 */
  const killBtn = [].slice.call(combatGrp.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("自我了断") !== -1; })[0];
  assert(!!killBtn, "E. 战斗终结「自我了断」按钮存在");
  if (killBtn) { killBtn.click(); }
  assert(V.pain === 1000, "E. 点击自我了断 → pain=1000，实际 " + V.pain);
  let threw = 0, done = 0;
  [].slice.call(combatGrp.querySelectorAll("button")).forEach(function (b) {
    try { b.click(); done++; } catch (e) { threw++; console.error("FAIL: 战斗终结按钮[" + b.textContent + "]抛错: " + e.message); }
  });
  assert(threw === 0, "E. 战斗终结全部 " + done + " 按钮点击无抛错");
}
const farmGrp = sections.filter(function (g) { return g.textContent.indexOf("庄园自动维护") !== -1; })[0];
assert(!!farmGrp, "E. 全局页含「庄园自动维护」区");
if (farmGrp) {
  let threw = 0, done = 0;
  [].slice.call(farmGrp.querySelectorAll("button")).forEach(function (b) {
    try { b.click(); done++; } catch (e) { threw++; console.error("FAIL: 庄园维护按钮[" + b.textContent + "]抛错: " + e.message); }
  });
  assert(threw === 0, "E. 庄园自动维护全部 " + done + " 按钮点击无抛错");
  assert(V.temple_quarters === 100 && V.temple_garden === 100, "E. 神殿维护 → temple_quarters/garden=100（housekeeping/tending≥1000），实际 " + V.temple_quarters + "/" + V.temple_garden);
  assert(V.edengarden === 4 && V.edenshrooms === 4 && V.edenspring === 4, "E. 伊甸维护 → 3 键锁 4，实际 " + V.edengarden + "/" + V.edenshrooms + "/" + V.edenspring);
  assert(V.soap === 10 && V.salve === 10, "E. 补给 → soap/salve=10，实际 " + V.soap + "/" + V.salve);
}

/* ---------- 收尾 ---------- */
console.log(failures === 0 ? "\nFUNCTIONAL E2E ALL PASSED" : "\nFUNCTIONAL E2E " + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
