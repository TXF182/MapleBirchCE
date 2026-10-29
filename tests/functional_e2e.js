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

/* ---------- 2. 游戏全局 + 9 适配器探测键 + 模组特质注入全命中 mock ---------- */
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
  /* Cattery 探测根（顶层标量） */
  cattery_time: 0, pcfood_cake: 0,
  /* DolMod 人物附加与生活质量提升 探测根（阿电状态 + 电脑 + 银行 + 转化） */
  adian_met: 0, adian_romance: 0, adian_confession_state: "",
  adian: { _inHospital: 0, _imprisoned: 0, _reported: 0, _jealousReady: 0, _loftRadioParts: 0, _loftRadioSet: 0, _stockholm: 0 },
  computer: { assembled: false, parts: {}, performance: 0, location: null },
  computerApps: {}, bank: { savings: 1000 },
  rabbitbuild: 0, mermaidbuild: 0, ngplusCycle: 0,
  indianStall_found: 0, seaPlatform_found: 0,
  /* 原版世界腐化（v1.9.12 全局页新区块） */
  world_corruption_hard: 2, world_corruption_soft: 0,
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
      { name: "Acceptance: Small Penis", has: "$acceptance_penis_small gte 1000", text: "You're proud of your small penis." },
      { name: "Purity Boost", has: "$featsPurityBoost gt 0", text: "You are gaining purity daily." }
    ] }
  ] }
};
window.modUtils = { getMod: function (m) { return m === "DomRobin" ? {} : null; } };
setup.foodPreference = {};
window.DolOptimization = {};
window.MirrorHypnoVariableRefresh = function () {};

/* ---------- 3. 加载构建产物（init 自动建面板） ---------- */
/* ---------- 2.5 localStorage mock（jsdom opaque origin 无 localStorage，Node 全局亦无） ----------
   eval 前注入，使源码的持久化分支（拖动锁/位置/UI 状态/收藏）走与真实浏览器一致的路径 */
global.localStorage = (function () {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  };
})();

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

/* ---------- B. 10 适配器全命中 ---------- */
const mods = api.getCheatMods();
assert(mods.length === 10, "B. 10 适配器全部探测命中，实际 " + mods.length + " → " + mods.map(function (m) { return m.modId; }).join(","));
mods.forEach(function (m) {
  assert(!!m.modId && Array.isArray(m.stages) && Array.isArray(m.abilities) && Array.isArray(m.values), "B. " + m.modId + " 声明结构完整（stages/abilities/values 数组）");
});
const modsTxt = document.querySelector('[data-pane="mods"]').textContent;
["枯木逢春", "Dol-Optimization", "幽灵的倒影", "DoLSims", "归途", "More Love Interests", "DomRobin", "SmartPhone", "Cattery", "人物附加与生活质量提升"].forEach(function (kw) {
  assert(modsTxt.indexOf(kw) !== -1, "B. Mod作弊 主容器含 " + kw + " 入口，实际 " + modsTxt.slice(0, 200));
});

/* ---------- C. 逐适配器子页：真实 DOM 点击 + 数据层写入/防线验证 ---------- */
let stageJumpOk = 0, abilityToggleOk = 0, valueApplyOk = 0, domClickThrew = 0, domClickDone = 0;
mods.forEach(function (mod) {
  try {
    api.renderModCheatDetail(mod.modId);
    const pane = document.querySelector('[data-pane="mods"]');
    /* v1.9.1（DoL-Game-UI 冲突排查）：子页四分组默认收起 + 懒渲染 → 先展开全部分组，
       后续行断言 / DOM 点击才能命中（对齐 D 段「全部展开」模式） */
    const modHeads = [].slice.call(pane.querySelectorAll(".mce-collapse-head"));
    modHeads.forEach(function (h) { try { h.click(); } catch (e) {} });
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
/* D3. 双巡优化①：模组特质行出现「改数值」数值控件；点击写入生效；回退还原（D2 结束时值为 0） */
api.renderPlayerEdit();
let accRow3 = findTraitRow("Small Penis");
assert(!!accRow3 && [].slice.call(accRow3.querySelectorAll("button")).some(function (b) { return b.textContent === "改数值"; }), "D3. 字符串型模组特质行有「改数值」按钮（数值可改放开）");
const accInp = accRow3 && accRow3.querySelector("input.mce-inp");
assert(!!accInp, "D3. 模组特质行有数值输入框 input.mce-inp");
if (accRow3 && accInp) {
  accInp.value = "2000";
  const sBtn = [].slice.call(accRow3.querySelectorAll("button")).filter(function (b) { return b.textContent === "改数值"; })[0];
  sBtn.click();
  assert(V.acceptance_penis_small === 2000, "D3. 点击改数值 → 写入 2000，实际 " + V.acceptance_penis_small);
  api.renderPlayerEdit();
  accRow3 = findTraitRow("Small Penis");
  const uBtn = accRow3 && [].slice.call(accRow3.querySelectorAll("button")).filter(function (b) { return b.textContent === "回退"; })[0];
  assert(!!uBtn, "D3. 重新渲染后模组特质行仍有「回退」按钮");
  if (uBtn) { uBtn.click(); }
  assert(V.acceptance_penis_small === 0, "D3. 点击回退 → 还原写入前值 0，实际 " + V.acceptance_penis_small);
}
/* D4. 五巡自查：gt（严格大于）条件特质点击级覆盖——获取写 num+1 判定已拥有；
   改数值默认值 = 满足值 1（此前 values 对 gt 生成 0，点「改数值」写 0 恒不满足）；移除归 0 */
V.featsPurityBoost = 0;
api.renderPlayerEdit();
let pRow4 = findTraitRow("纯洁增幅（模组）");
assert(!!pRow4, "D4. gt 特质行（Purity Boost）渲染");
if (pRow4) {
  assert(pRow4.textContent.indexOf("●") === -1, "D4. 初始无已拥有标记 ●（未获得）, 实际 " + pRow4.textContent.slice(-40));
  const gBtn4 = [].slice.call(pRow4.querySelectorAll("button")).filter(function (b) { return b.textContent === "获取"; })[0];
  assert(!!gBtn4, "D4. gt 特质行有「获取」按钮");
  if (gBtn4) { gBtn4.click(); }
  assert(V.featsPurityBoost === 1, "D4. 点击获取 → featsPurityBoost=1（gt 0 写 num+1），实际 " + V.featsPurityBoost);
  api.renderPlayerEdit();
  pRow4 = findTraitRow("纯洁增幅（模组）");
  assert(!!pRow4 && pRow4.textContent.indexOf("●") !== -1, "D4. 重新渲染后显示 ● 已拥有");
  if (pRow4) {
    const inp4 = pRow4.querySelector("input.mce-inp");
    assert(!!inp4 && inp4.value === "1", "D4. 改数值默认值 = 满足值 1（gt values 已随 satisfy 改 num+1），实际 " + (inp4 ? inp4.value : "(无输入框)"));
    const sBtn4 = [].slice.call(pRow4.querySelectorAll("button")).filter(function (b) { return b.textContent === "改数值"; })[0];
    assert(!!sBtn4, "D4. gt 特质行有「改数值」按钮");
    if (sBtn4) { sBtn4.click(); }
    assert(V.featsPurityBoost === 1, "D4. 点击改数值（默认值 1）→ 写 1 条件满足，实际 " + V.featsPurityBoost);
    api.renderPlayerEdit();
    pRow4 = findTraitRow("纯洁增幅（模组）");
    const rBtn4 = pRow4 && [].slice.call(pRow4.querySelectorAll("button")).filter(function (b) { return b.textContent === "移除"; })[0];
    assert(!!rBtn4, "D4. 重新渲染后有「移除」按钮");
    if (rBtn4) { rBtn4.click(); }
    assert(V.featsPurityBoost === 0, "D4. 点击移除 → featsPurityBoost=0（不满足 gt 0），实际 " + V.featsPurityBoost);
    api.renderPlayerEdit();
    pRow4 = findTraitRow("纯洁增幅（模组）");
    assert(!!pRow4 && pRow4.textContent.indexOf("●") === -1, "D4. 移除后重新渲染无已拥有标记 ●（未获得）");
  }
}
/* D5. v1.9.1 性别切换（玩家自己页）：性别区三按钮 + 当前高亮；点击写七键 + 重渲染高亮正确 */
V.player = { money: 500, name: "X", penisExist: true, vaginaExist: false, penissize: 2, gender_body: "m", gender: "m", sex: "m", ballsExist: false };
api.renderPlayerEdit();
let gBox5 = document.querySelector('[data-mce-gender]');
assert(!!gBox5, "D5. 性别区渲染（data-mce-gender）");
if (gBox5) {
  assert(gBox5.getAttribute("data-mce-gender") === "m" && gBox5.textContent.indexOf("男 ✓") !== -1, "D5. 初始男高亮, 实际 " + gBox5.textContent.slice(0, 60));
  const btnF5 = gBox5.querySelector('button[data-gender="f"]');
  assert(!!btnF5, "D5. 女按钮存在");
  if (btnF5) { btnF5.click(); }
  assert(V.player.vaginaExist === true && V.player.penisExist === false && V.player.penissize === 0 && V.player.gender_body === "f" && V.player.gender === "f" && V.player.sex === "f" && V.player.ballsExist === false, "D5. 点击女 → 七键写入正确, 实际 " + JSON.stringify({ pe: V.player.penisExist, ve: V.player.vaginaExist, ps: V.player.penissize, gb: V.player.gender_body, g: V.player.gender, s: V.player.sex, b: V.player.ballsExist }));
  gBox5 = document.querySelector('[data-mce-gender]');
  assert(!!gBox5 && gBox5.getAttribute("data-mce-gender") === "f" && gBox5.textContent.indexOf("女 ✓") !== -1, "D5. 重渲染后女高亮");
  const btnA5 = gBox5 && gBox5.querySelector('button[data-gender="a"]');
  if (btnA5) { btnA5.click(); }
  assert(V.player.penisExist === true && V.player.vaginaExist === true && V.player.gender === "h" && V.player.gender_body === "a" && V.player.sex === "h" && V.player.ballsExist === true && V.player.penissize >= 1, "D5. 点击双性 → 七键写入正确（herm 预设）, 实际 " + JSON.stringify({ pe: V.player.penisExist, ve: V.player.vaginaExist, g: V.player.gender, gb: V.player.gender_body, s: V.player.sex, b: V.player.ballsExist }));
  gBox5 = document.querySelector('[data-mce-gender]');
  assert(!!gBox5 && gBox5.getAttribute("data-mce-gender") === "a" && gBox5.textContent.indexOf("双性 ✓") !== -1, "D5. 重渲染后双性高亮");
  const btnM5 = gBox5.querySelector('button[data-gender="m"]');
  if (btnM5) { btnM5.click(); }
  assert(V.player.penisExist === true && V.player.vaginaExist === false && V.player.gender === "m" && V.player.gender_body === "m" && V.player.sex === "m" && V.player.ballsExist === false && V.player.penissize >= 1, "D5. 点击男 → 七键写入正确, 实际 " + JSON.stringify({ pe: V.player.penisExist, ve: V.player.vaginaExist, g: V.player.gender, gb: V.player.gender_body, s: V.player.sex, b: V.player.ballsExist }));
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
  /* v1.9.x 神殿维护改为 V 顶层技能判定（原版实证）→ E2E 场景需预设达标技能值 */
  V.housekeeping = 1200; V.tending = 1200;
  let threw = 0, done = 0;
  [].slice.call(farmGrp.querySelectorAll("button")).forEach(function (b) {
    try { b.click(); done++; } catch (e) { threw++; console.error("FAIL: 庄园维护按钮[" + b.textContent + "]抛错: " + e.message); }
  });
  assert(threw === 0, "E. 庄园自动维护全部 " + done + " 按钮点击无抛错");
  assert(V.temple_quarters === 100 && V.temple_garden === 100, "E. 神殿维护 → temple_quarters/garden=100（housekeeping/tending≥1000），实际 " + V.temple_quarters + "/" + V.temple_garden);
  assert(V.edengarden === 4 && V.edenshrooms === 4 && V.edenspring === 4, "E. 伊甸维护 → 3 键锁 4，实际 " + V.edengarden + "/" + V.edenshrooms + "/" + V.edenspring);
  assert(V.soap === 10 && V.salve === 10, "E. 补给 → soap/salve=10，实际 " + V.soap + "/" + V.salve);
}

/* ---------- F. 悬浮球：可拖动 + 全局页顶部固定按钮（v1.9.10+） ---------- */
const toggleEl = document.getElementById("mce-toggle");
assert(!!toggleEl && toggleEl.textContent === "解锁", "F. 右下角悬浮球按钮存在（id=mce-toggle，文本「解锁」）");
function findFabRow() {
  return [].slice.call(globalPane.querySelectorAll("div")).filter(function (g) { return g.textContent.indexOf("悬浮入口") !== -1; })[0];
}
const fabRowF = findFabRow();
assert(!!fabRowF, "F. 全局页顶部含「悬浮入口」固定按钮行");
if (fabRowF) {
  assert(toggleEl.__mbCEBound === true, "F. 悬浮球事件已绑定并打标（__mbCEBound=true，热重载防重复绑定），实际 " + toggleEl.__mbCEBound);
  const fabBtnF = fabRowF.querySelector("button");
  assert(!!fabBtnF && fabBtnF.textContent.indexOf("锁定悬浮球拖动") !== -1, "F. 悬浮入口按钮默认文案「锁定悬浮球拖动」，实际 " + (fabBtnF ? fabBtnF.textContent : "(无)"));
  assert(toggleEl.dataset.mceLocked === "0", "F. 默认未锁定（data-mce-locked=0），实际 " + toggleEl.dataset.mceLocked);
  /* 锁定 → 禁拖动（点击仍可开关面板） */
  fabBtnF.click();
  assert(toggleEl.dataset.mceLocked === "1", "F. 点击「锁定悬浮球拖动」→ 锁定 data-mce-locked=1，实际 " + toggleEl.dataset.mceLocked);
  assert(localStorage.getItem("mbCE_toggle_lock_v1") === "1", "F. 锁定状态已持久化 mbCE_toggle_lock_v1=1，实际 " + localStorage.getItem("mbCE_toggle_lock_v1"));
  /* 锁定时点击悬浮球仍正常开关面板 */
  toggleEl.click();
  assert(document.querySelector("#mce-root").classList.contains("mce-open"), "F. 锁定时点击悬浮球 → 面板仍打开");
  toggleEl.click();
  const rootLockedF = document.querySelector("#mce-root");
  assert(rootLockedF.classList.contains("mce-closing") || !rootLockedF.classList.contains("mce-open"), "F. 锁定时再次点击悬浮球 → 面板已触发关闭（v1.9.14 关闭动画 mce-closing 中或已移除 mce-open）");
  /* 重渲染后按钮变「解锁悬浮球拖动」，再点恢复 */
  const fabUnlockF = findFabRow() && findFabRow().querySelector("button");
  assert(!!fabUnlockF && fabUnlockF.textContent.indexOf("解锁悬浮球拖动") !== -1, "F. 锁定后按钮文案变「解锁悬浮球拖动」，实际 " + (fabUnlockF ? fabUnlockF.textContent : "(无)"));
  if (fabUnlockF) { fabUnlockF.click(); }
  assert(toggleEl.dataset.mceLocked === "0", "F. 点击「解锁悬浮球拖动」→ 解锁 data-mce-locked=0，实际 " + toggleEl.dataset.mceLocked);
  assert(localStorage.getItem("mbCE_toggle_lock_v1") === "0", "F. 解锁状态已持久化 mbCE_toggle_lock_v1=0，实际 " + localStorage.getItem("mbCE_toggle_lock_v1"));
  assert(toggleEl.style.display !== "none", "F. 悬浮球始终显示（无隐藏态），实际 display=" + toggleEl.style.display);
}
/* 点击仍正常开关面板（拖拽拦截逻辑不破坏点击） */
toggleEl.click();
assert(document.querySelector("#mce-root").classList.contains("mce-open"), "F. 点击悬浮球 → 面板打开");
toggleEl.click();
const rootF = document.querySelector("#mce-root");
assert(rootF.classList.contains("mce-closing") || !rootF.classList.contains("mce-open"), "F. 再次点击悬浮球 → 面板已触发关闭（v1.9.14 关闭动画 mce-closing 中或已移除 mce-open）");
/* 拖拽事件链最小验证：pointerdown 派发不抛错（jsdom 无真实坐标，仅验证监听器已注册且不崩） */
(function () {
  let threw = false;
  try {
    toggleEl.dispatchEvent(new window.Event("pointerdown", { cancelable: true }));
  } catch (e) { threw = true; console.error("FAIL: 拖拽 pointerdown 派发抛错: " + e.message); }
  assert(!threw, "F. 拖拽 pointerdown 事件监听已注册且派发无抛错");
})();

/* ---------- M. v1.9.2 自查补盲：values list 型端到端链路（apply → 局部刷新回显 → 取消 → 回退 → 重渲染） ----------
   C 段注释曾误标「list 型走 DOM checkbox 已覆盖」——实际 firstVal 过滤掉了 list，能力 checkbox 也不走 values。
   真实链路：list 行 checkbox 点击 → applyCheatModValue(list 分支) → actCheat → refreshModRow(list 分支) 回显。 */
const mockListMod = {
  modId: "mocklist", modName: "自查 list 链路测试模组",
  tasks: [], stages: [], abilities: [], scenes: [],
  values: [{ key: "tags", name: "标签列表", varPath: "mocklist_tags", type: "list", options: ["alpha", "beta", "gamma"] }]
};
setup.mbCE_modCheats = [mockListMod];
V.mocklist_tags = [];
clickTabSafe("mods");
api.renderModCheatDetail("mocklist");
const paneM = document.querySelector('[data-pane="mods"]');
[].slice.call(paneM.querySelectorAll(".mce-collapse-head")).forEach(function (h) { try { h.click(); } catch (e) {} });
const listRowsM = [].slice.call(paneM.querySelectorAll(".mce-row")).filter(function (r) { return r.getAttribute("data-mce-key") === "values:tags:alpha"; });
assert(listRowsM.length === 1, "M. list 行渲染（values:tags:alpha）, 实际 " + listRowsM.length + " 行");
const boxM = listRowsM[0] && listRowsM[0].querySelector('input[type="checkbox"]');
assert(!!boxM && boxM.checked === false, "M. list 行初始未勾选");
if (boxM) { boxM.click(); }
assert(Array.isArray(V.mocklist_tags) && V.mocklist_tags.indexOf("alpha") !== -1, "M. 勾选 alpha → 写入数组, 实际 " + JSON.stringify(V.mocklist_tags));
assert(listRowsM[0].querySelector('input[type="checkbox"]').checked === true, "M. 局部刷新回显勾选态（refreshModRow list 分支）");
assert(listRowsM[0].classList.contains("mce-flash"), "M. 写入成功 → 目标行 mce-flash 闪烁反馈（v1.9.14 效果2）");
const undM = [].slice.call(listRowsM[0].querySelectorAll("button")).filter(function (b) { return b.textContent === "回退"; })[0];
assert(!!undM, "M. list 行回退按钮存在");
if (undM) { undM.click(); }
assert(Array.isArray(V.mocklist_tags) && V.mocklist_tags.indexOf("alpha") === -1, "M. 回退 → 移除 alpha, 实际 " + JSON.stringify(V.mocklist_tags));
api.renderModCheatDetail("mocklist");
[].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll(".mce-collapse-head")).forEach(function (h) { try { h.click(); } catch (e) {} });
const listRowsM2 = [].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll(".mce-row")).filter(function (r) { return r.getAttribute("data-mce-key") === "values:tags:alpha"; });
assert(!!listRowsM2[0] && listRowsM2[0].querySelector('input[type="checkbox"]').checked === false, "M. 重渲染后回显未勾选");
delete V.mocklist_tags; setup.mbCE_modCheats = [];

/* ---------- N. v1.9.13 数值搜索框（独立 class + 过滤重建，走真实渲染/API/DOM） ---------- */
const mockNMod = {
  modId: "mocksrch", modName: "搜索测试模组", tasks: [], stages: [], abilities: [], scenes: [],
  values: [
    { key: "v1", name: "张力值", varPath: "mock_tension" },
    { key: "v2", name: "好感度", varPath: "mock_love" },
    { key: "v3", name: "张力上限", varPath: "mock_tension_max" }
  ]
};
setup.mbCE_modCheats = [mockNMod];
V.mock_tension = 0; V.mock_love = 0; V.mock_tension_max = 100;
clickTabSafe("mods");
api.renderModCheatDetail("mocksrch");
const paneN = document.querySelector('[data-pane="mods"]');
[].slice.call(paneN.querySelectorAll(".mce-collapse-head")).forEach(function (h) { try { h.click(); } catch (e) {} });
const srchInpN = paneN.querySelector("input.mce-search-inp");
assert(!!srchInpN, "N. 数值搜索框存在（.mce-search-inp 独立 class）");
const valInpCountN = paneN.querySelectorAll("input.mce-inp").length;
assert(valInpCountN === 3, "N. 搜索框不污染 input.mce-inp（数值输入框恰 3 个）, 实际 " + valInpCountN);
const rowsAllN = [].slice.call(paneN.querySelectorAll('.mce-row[data-mce-key^="values:"]')).length;
assert(rowsAllN === 3, "N. 初始渲染 3 行数值, 实际 " + rowsAllN);
api.setModValueFilter("张力");
api.renderModCheatDetail("mocksrch");
const rowsFilN = [].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll('.mce-row[data-mce-key^="values:"]')).length;
assert(rowsFilN === 2, "N. 搜索「张力」过滤后 2 行（张力值/张力上限，好感度隐藏）, 实际 " + rowsFilN);
api.setModValueFilter("");
api.renderModCheatDetail("mocksrch");
[].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll(".mce-collapse-head")).forEach(function (h) { try { h.click(); } catch (e) {} });
const rowsBackN = [].slice.call(document.querySelector('[data-pane="mods"]').querySelectorAll('.mce-row[data-mce-key^="values:"]')).length;
assert(rowsBackN === 3, "N. 清空搜索后重新展开恢复 3 行, 实际 " + rowsBackN);
delete V.mock_tension; delete V.mock_love; delete V.mock_tension_max; setup.mbCE_modCheats = [];

/* ---------- W. 全局页世界腐化数值调整（v1.9.12）：直填不钳上限 + 下限保留 + 留痕回退 ---------- */
const wcSecW = [].slice.call(globalPane.querySelectorAll(".mce-section")).filter(function (s) { return s.textContent.indexOf("世界腐化") !== -1; })[0];
assert(!!wcSecW, "W. 全局页含「世界腐化（原版 World Corruption）」区块");
const wcRowsW = [].slice.call(globalPane.querySelectorAll(".mce-row")).filter(function (r) { return r.getAttribute("data-wckey"); });
assert(wcRowsW.length === 2, "W. 世界硬/软腐化两行渲染（data-wckey）, 实际 " + wcRowsW.length + " 行");
function wcRowW(key) { return wcRowsW.filter(function (r) { return r.getAttribute("data-wckey") === key; })[0]; }
assert(!!wcRowW("world_corruption_hard") && !!wcRowW("world_corruption_soft"), "W. 行键 world_corruption_hard / world_corruption_soft 均存在");
assert(!!wcRowW("world_corruption_hard").querySelector('input[type="number"]') && !!wcRowW("world_corruption_hard").querySelector("button"),
  "W. 行内含数值输入框 + 应用按钮");
assert(!wcRowW("world_corruption_hard").querySelector('[data-op="wc-undo"]'), "W. 初始无写入留痕 → 不显示回退按钮");
/* 交互：填 50 应用（上限不钳制，原版宏 clamp 30 不生效） → 回退按钮出现 → 点回退还原 */
const hardInpW = wcRowW("world_corruption_hard").querySelector('input[type="number"]');
const hardApplyW = [].slice.call(wcRowW("world_corruption_hard").querySelectorAll("button")).filter(function (b) { return b.textContent === "应用"; })[0];
assert(!!hardInpW && !!hardApplyW, "W. 硬腐化行输入框与应用按钮就绪");
if (hardInpW && hardApplyW) {
  hardInpW.value = "50";
  hardApplyW.click();
  assert(V.world_corruption_hard === 50, "W. 应用 hard=50 → V.world_corruption_hard=50（不钳制原版上限 30）, 实际 " + V.world_corruption_hard);
  assert(!!V.mbCE_wrote && !!V.mbCE_wrote["place:world_corruption_hard"], "W. 应用后留痕 place:world_corruption_hard");
  const undW = wcRowW("world_corruption_hard").querySelector('[data-op="wc-undo"]');
  assert(!!undW, "W. 应用后行内出现「回退」按钮");
  if (undW) {
    undW.click();
    assert(V.world_corruption_hard === 2, "W. 回退还原写入前原值 2, 实际 " + V.world_corruption_hard);
    assert(!V.mbCE_wrote["place:world_corruption_hard"], "W. 回退清留痕");
  }
}
/* 下限保留：软腐化填 -5 应用 → 钳到 0（原版下限语义） */
const softInpW = wcRowW("world_corruption_soft").querySelector('input[type="number"]');
const softApplyW = [].slice.call(wcRowW("world_corruption_soft").querySelectorAll("button")).filter(function (b) { return b.textContent === "应用"; })[0];
if (softInpW && softApplyW) {
  softInpW.value = "-5";
  softApplyW.click();
  assert(V.world_corruption_soft === 0, "W. 软腐化填 -5 → 钳到原版下限 0, 实际 " + V.world_corruption_soft);
}

/* ---------- L. 数值固定（v1.9.15）：预设行 + 锁定写回 + 取消（防渡鸦/天使/转化值被游戏机制改动） ---------- */
const lockSecL = [].slice.call(globalPane.querySelectorAll(".mce-section")).filter(function (s) { return s.textContent.indexOf("数值固定") !== -1; })[0];
assert(!!lockSecL, "L. 全局页含「数值固定（防游戏机制改动）」区块");
const lockRowsL = [].slice.call(lockSecL.querySelectorAll(".mce-row")).filter(function (r) { return r.getAttribute("data-lockpath"); });
assert(lockRowsL.length === api.MB_CE_LOCK_PRESETS.length, "L. 预设推荐行渲染（" + api.MB_CE_LOCK_PRESETS.length + " 项）, 实际 " + lockRowsL.length + " 项");
function lockRowL(path) { return lockRowsL.filter(function (r) { return r.getAttribute("data-lockpath") === path; })[0]; }
assert(!!lockRowL("maplebirch.transformation.raven.build"), "L. 渡鸦转化预设行存在（data-lockpath=maplebirch.transformation.raven.build）");
const lockBtnL = [].slice.call(lockRowL("maplebirch.transformation.raven.build").querySelectorAll("button")).filter(function (b) { return b.textContent === "锁定"; })[0];
assert(!!lockBtnL, "L. 未锁定态显示「锁定」按钮");
if (lockBtnL) { lockBtnL.click(); }
assert(!!V.mbCE_lock && V.mbCE_lock.length >= 1, "L. 点击锁定 → V.mbCE_lock 写入");
const ravenLockL = (V.mbCE_lock || []).filter(function (x) { return x.path === "maplebirch.transformation.raven.build"; })[0];
assert(!!ravenLockL && ravenLockL.target === 0, "L. 渡鸦锁定目标 = 渲染时刻当前值（0）, 实际 " + (ravenLockL && ravenLockL.target));
/* tick 强制写回：改值 42 → tick → 还原 0 */
if (!V.maplebirch) { V.maplebirch = {}; }
if (!V.maplebirch.transformation) { V.maplebirch.transformation = {}; }
V.maplebirch.transformation.raven = V.maplebirch.transformation.raven || {};
V.maplebirch.transformation.raven.build = 42;
api.mbCELockTick();
assert(V.maplebirch.transformation.raven.build === 0, "L. 改值 42 后 tick 强制写回 0, 实际 " + V.maplebirch.transformation.raven.build);
/* 取消锁定 → 改值不再被写回 */
const lockRowsL2 = [].slice.call(globalPane.querySelectorAll(".mce-row")).filter(function (r) { return r.getAttribute("data-lockpath") === "maplebirch.transformation.raven.build"; })[0];
const cancelL = lockRowsL2 && [].slice.call(lockRowsL2.querySelectorAll("button")).filter(function (b) { return b.textContent === "取消"; })[0];
assert(!!cancelL, "L. 锁定态显示「取消」按钮");
if (cancelL) { cancelL.click(); }
assert(!api.mbCELockHas("maplebirch.transformation.raven.build"), "L. 取消后锁定表移除该路径");
V.maplebirch.transformation.raven.build = 9;
api.mbCELockTick();
assert(V.maplebirch.transformation.raven.build === 9, "L. 取消后 tick 不再写回（保持 9）, 实际 " + V.maplebirch.transformation.raven.build);
delete V.maplebirch.transformation.raven.build; delete V.mbCE_lock;

/* ---------- 收尾 ---------- */
console.log(failures === 0 ? "\nFUNCTIONAL E2E ALL PASSED" : "\nFUNCTIONAL E2E " + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
