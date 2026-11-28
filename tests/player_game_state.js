/* v2.3.0 玩家的游戏 · 自动化验收（TDD 红绿）
   覆盖：
   A 62 项注册表 / 7 分组 / 唯一 id
   B 默认状态（62 关、被动开、爽玩、特质未授予）
   C 逐项开关 + 首次授予 + 关闭还原开启前值
   D 子开关自动开主项 + 财神收入/支出子项
   E 一键全开/全关/恢复默认 + 四套预设 + 模式/被动
   F 特质 config 与 traits 表注册（不依赖 DoLSims）
   G 财神金钱换算（+300% / -50% / recordOnly / 战利品 ×4 叠乘）
   H tick：全属性/技能/状态/战斗/命运/三形/万人迷/触手每日
   I 真实页面：player 页签排最前、62 卡、搜索、子开关、收藏、预设条
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
function clickText(scope, text) {
  const all = Array.from(scope.querySelectorAll("button"));
  const b = all.find(function (x) { return x.textContent.trim() === text; });
  if (b) { b.click(); }
  return b;
}

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.localStorage = window.localStorage;
localStorage.clear();

const V = {
  player: {}, passage: "Room", money: 10000, day: 10,
  physique: 100, willpower: 100, beauty: 100, awareness: 100, promiscuity: 100, exhibitionism: 100, deviancy: 100,
  purity: 1000, stress: 100, trauma: 100, pain: 100, tiredness: 100, arousal: 100,
  drugged: 1, drunk: 100, anxiety: 2, delinquency: 100, suspicion: 50, exposed: 1,
  demon: 0, angel: 0, fallenangel: 0, combat: 0,
  fame: { prostitution: 0, sex: 0, rape: 0, exhibitionism: 0, bestiality: 0, good: 0 },
  prof: { spray: 10, baton: 10, whip: 10, net: 10, pickaxe: 10 },
  skulduggery: 10, danceskill: 10, swimmingskill: 10, athletics: 10, tending: 10, housekeeping: 10,
  seductionskill: 10, oralskill: 10, chestskill: 10, handskill: 10, bottomskill: 10, penileskill: 10,
  vaginalskill: 10, analskill: 10, thighskill: 10, feetskill: 10,
  science: 10, maths: 10, english: 10, history: 10,
  NPCList: [{ name: "A", love: 0, health: 100 }, { name: "B", love: 0, health: 100, boss: true }]
};
global.V = V;
global.State = { variables: V, temporary: { traitLists: [{ title: "原版", traits: [] }] } };
global.T = global.State.temporary;
global.Time = { days: 10, passCalls: [], pass: function (seconds) { this.passCalls.push(seconds); } };
global.$ = undefined;
const setupObj = { foodstuff: {}, bodyparts: [] };
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.getV = function () { return V; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
window.statChange = {
  money: function (amount, source, optional) { this.calls = this.calls || []; this.calls.push({ amount: amount, source: source, optional: optional }); return amount; },
  pain: function (amount) { this.lastPain = amount; return amount; },
  spray: function (amount) { this.lastSpray = amount; return amount; },
  suspicion: function (amount) { this.lastSuspicion = amount; return amount; }
};
global.statChange = window.statChange;
window.dangerEvent = function () { return true; };
global.dangerEvent = window.dangerEvent;

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(!!api, "setup.mbStageCE 已挂载");
assert(typeof api.mbCEPlayerGameRegistry === "function" && typeof api.mbCEPlayerGameSet === "function"
  && typeof api.mbCEPlayerGameTick === "function" && typeof api.renderPlayerGame === "function",
  "玩家的游戏 API 已导出");

/* ================= A 注册表 ================= */
section("A 注册表");
let reg = api.mbCEPlayerGameRegistry();
assert(Array.isArray(reg) && reg.length === 62, "注册表 62 项，实际 " + reg.length);
let groups = api.mbCEPlayerGameGroups();
assert(Array.isArray(groups) && groups.length === 7, "7 个分组，实际 " + groups.length);
const ids = reg.map(function (e) { return e.id; });
assert(ids.filter(function (x, i) { return ids.indexOf(x) !== i; }).length === 0, "id 全部唯一");
assert(reg.every(function (e) { return e.id && e.name && e.desc && Array.isArray(e.subs); }), "每项都有 id/name/desc/subs");
assert(reg.filter(function (e) { return e.group === "books"; }).length === 10, "书籍 10 项");
assert(reg.filter(function (e) { return e.group === "mirror"; }).length === 6, "镜子 6 项");
assert(reg.filter(function (e) { return e.group === "weapons"; }).length === 6, "武器 6 项");
assert(reg.filter(function (e) { return e.group === "system"; }).length === 9, "系统 9 项");
assert(reg.filter(function (e) { return e.group === "economy"; }).length === 1, "财神 1 项");
assert(reg.filter(function (e) { return e.group === "hypno"; }).length === 15, "催眠 15 项");
assert(reg.filter(function (e) { return e.group === "new"; }).length === 15, "新生特权 15 项");
assert(!!reg.find(function (e) { return e.id === "tentacle_king" && e.name === "触手王权"; }), "书籍触手王权已改名");
assert(!!reg.find(function (e) { return e.id === "tentacle_weapon" && e.name === "触手武具"; }), "武器触手武具已改名");
assert(!!reg.find(function (e) { return e.id === "tentacle_grow" && e.name === "触手培育"; }), "系统触手培育独立");
assert(JSON.stringify(reg).indexOf("DoLSims") === -1 && JSON.stringify(reg).indexOf("模拟人生") === -1, "游戏文案不含原模组名");
assert(reg.every(function (e) { return !/「[A-Za-z_]+」/.test(e.desc); }), "能力描述不出现英文属性键名");
assert(!!reg.find(function (e) { return e.id === "desire_intox" && e.desc.indexOf("「美貌」") !== -1; }), "催眠描述属性名已中文化");

/* ================= B 默认状态 ================= */
section("B 默认状态");
let st = api.mbCEPlayerGameState();
assert(st.passive === 1 && st.mode === "fun" && st.trait === 0, "默认：被动开 / 爽玩 / 特质未授予");
assert(Object.keys(st.on).length === 62, "on 有 62 个键");
assert(ids.every(function (id) { return st.on[id] === 0; }), "62 项默认全关");

/* ================= C 逐项开关 ================= */
section("C 逐项开关");
let r = api.mbCEPlayerGameSet("arsenal_open", true);
assert(r.ok === true, "开启百兵全开：" + r.message);
assert(V.mbCE_playerGame.on.arsenal_open === 1 && V.mbCE_playerGame.trait === 1, "主开关=1 + 特质已授予");
assert(V.prof.whip === 1000 && V.prof.spray === 1000, "武器熟练写入 1000");
let tr = global.T.traitLists.find(function (c) { return c.title === "枫桦扩展"; });
assert(!!tr && tr.traits.some(function (t) { return t.name === "玩家的游戏"; }), "特质已写入基础 traits 表");
r = api.mbCEPlayerGameSet("arsenal_open", false);
assert(r.ok === true && V.mbCE_playerGame.on.arsenal_open === 0, "关闭主开关");
assert(V.mbCE_playerGame.trait === 1, "关闭后特质保留");
assert(V.prof.whip === 10, "关闭后还原开启前值，不再保留 1000");
r = api.mbCEPlayerGameSet("nope", true);
assert(r.ok === false && /未知/.test(r.message), "未知能力拒绝并说明");

/* ================= D 子开关 ================= */
section("D 子开关");
r = api.mbCEPlayerGameSetSub("fortune_bless", "income", false);
assert(r.ok === true && V.mbCE_playerGame.on.fortune_bless === 1, "单独子开关会自动打开主开关");
assert(V.mbCE_playerGame.subs["fortune_bless|income"] === 0, "收入子项=0 已保留");
assert(api.mbCEPlayerGameMoneyAmount(100, "shop", {}) === 100, "收入子项关闭：+100 不变");
r = api.mbCEPlayerGameSetSub("fortune_bless", "income", true);
assert(r.ok === true && api.mbCEPlayerGameMoneyAmount(100, "shop", {}) === 400, "收入子项开启：+100 → 400");
r = api.mbCEPlayerGameSetSub("fortune_bless", "nope", true);
assert(r.ok === false && /未知子开关/.test(r.message), "未知子开关拒绝");

/* ================= E 一键 / 预设 / 模式 ================= */
section("E 一键 / 预设 / 模式");
r = api.mbCEPlayerGameAll(true);
assert(r.ok === true && api.mbCEPlayerGameStatus().on === 62, "一键全开 62 项");
assert(V.mbCE_playerGame.passive === 1, "一键全开包含特质被动");
r = api.mbCEPlayerGameAll(false);
assert(r.ok === true && api.mbCEPlayerGameStatus().on === 0 && V.mbCE_playerGame.passive === 0, "一键全关 62 项 + 被动关");
assert(V.mbCE_playerGame.trait === 1, "一键全关后特质保留");
r = api.mbCEPlayerGameReset();
assert(r.ok === true && api.mbCEPlayerGameStatus().on === 0 && V.mbCE_playerGame.passive === 1 && V.mbCE_playerGame.mode === "fun", "恢复默认：全关 + 被动开 + 爽玩");
assert(V.mbCE_playerGame.trait === 1, "恢复默认后特质保留");
r = api.mbCEPlayerGamePreset("library");
assert(r.ok === true && api.mbCEPlayerGameStatus().on === 25, "图书馆预设 25 项");
r = api.mbCEPlayerGamePreset("battle");
assert(r.ok === true && api.mbCEPlayerGameStatus().on > 0, "战斗预设生效：" + api.mbCEPlayerGameStatus().on + " 项");
r = api.mbCEPlayerGamePreset("life");
assert(r.ok === true && api.mbCEPlayerGameStatus().on > 0, "生活预设生效：" + api.mbCEPlayerGameStatus().on + " 项");
r = api.mbCEPlayerGamePreset("nope");
assert(r.ok === false && /未知预设/.test(r.message), "未知预设拒绝");
r = api.mbCEPlayerGameSetMode("vanilla");
assert(r.ok === true && V.mbCE_playerGame.mode === "vanilla", "切原版模式");
r = api.mbCEPlayerGameSetMode("fun");
assert(r.ok === true && V.mbCE_playerGame.mode === "fun", "切回爽玩模式");
r = api.mbCEPlayerGameSetMode("nope");
assert(r.ok === false, "未知模式拒绝");
r = api.mbCEPlayerGameSetPassive(false);
assert(r.ok === true && V.mbCE_playerGame.passive === 0, "特质被动可单独关");
r = api.mbCEPlayerGameSetPassive(true);
assert(r.ok === true && V.mbCE_playerGame.passive === 1, "特质被动可重新开");

/* ================= F 特质 ================= */
section("F 特质");
const cfg = api.mbCEPlayerGameTraitConfig();
assert(cfg.name === "玩家的游戏" && cfg.title === "枫桦扩展" && cfg.colour === "gold", "特质名称/分类/金色");
assert(typeof cfg.has === "function" && cfg.has() === true, "has() 读取存档标志（已授予）");
assert(typeof cfg.text === "function" && /62 项/.test(cfg.text()), "特质文案含 62 项");
const reg2 = api.mbCEPlayerRegisterTrait();
assert(reg2.ok === true, "重复注册幂等：" + reg2.message);
assert(tr.traits.filter(function (t) { return t.name === "玩家的游戏"; }).length === 1, "traits 表不重复");

/* ================= G 财神 ================= */
section("G 财神");
api.mbCEPlayerGameReset();
api.mbCEPlayerGameSet("fortune_bless", true);
assert(api.mbCEPlayerGameMoneyAmount(100, "shop", {}) === 400, "收入 +300% → ×4");
assert(api.mbCEPlayerGameMoneyAmount(-100, "shop", {}) === -50, "支出 -50% → ×0.5");
assert(api.mbCEPlayerGameMoneyAmount(100, "shop", { recordOnly: true }) === 100, "recordOnly 不改金额");
assert(api.mbCEPlayerGameMoneyAmount(0, "shop", {}) === 0, "0 保持 0");
api.mbCEPlayerGameSet("loot_carnival", true);
assert(api.mbCEPlayerGameMoneyAmount(100, "combat", {}) === 1600, "财神 + 战利品 = ×16");
assert(api.mbCEPlayerGameMoneyAmount(100, "shop", {}) === 400, "非战利品来源仍只 ×4");
const hookOk = api.mbCEPlayerGameInstallMoneyHook();
assert(hookOk === true && window.statChange.money.__mbCEPG === true, "statChange.money 已包装");
window.statChange.money(100, "shop", {});
const lastCall = window.statChange.calls[window.statChange.calls.length - 1];
assert(lastCall.amount === 400, "包装后原函数收到 400");
api.mbCEPlayerGameSet("fortune_bless", false);
assert(api.mbCEPlayerGameMoneyAmount(100, "shop", {}) === 100, "关闭财神后不再乘");

/* ================= H tick ================= */
section("H tick");
api.mbCEPlayerGameReset();
api.mbCEPlayerGameSet("all_stats_max", true);
api.mbCEPlayerGameTick();
assert(V.beauty === 999999 && V.physique === 999999 && V.willpower === 999999 && V.purity === 2000, "全属性满级写入");
api.mbCEPlayerGameSetSub("all_stats_max", "beauty", false);
V.beauty = 100;
api.mbCEPlayerGameTick();
assert(V.beauty === 100, "全属性子项关闭时不复写该项");
api.mbCEPlayerGameSetSub("all_stats_max", "beauty", true);
api.mbCEPlayerGameTick();
assert(V.beauty === 999999, "子项重新开启后复写");

api.mbCEPlayerGameSet("all_skills_max", true);
api.mbCEPlayerGameTick();
assert(V.skulduggery === 1000 && V.science === 1000 && V.prof.whip === 1000, "技能全满写入基础/学校/武器");
api.mbCEPlayerGameSetSub("all_skills_max", "skulduggery", false);
V.skulduggery = 10;
api.mbCEPlayerGameTick();
assert(V.skulduggery === 10, "技能子项关闭时不复写");

api.mbCEPlayerGameSet("status_lock", true);
V.stress = 100; V.trauma = 100; V.pain = 100; V.tiredness = 100; V.arousal = 100;
api.mbCEPlayerGameTick();
assert(V.stress === 0 && V.trauma === 0 && V.pain === 0 && V.tiredness === 0 && V.arousal === 0, "状态五项锁定 0");
api.mbCEPlayerGameSetSub("status_lock", "pain", false);
V.pain = 100;
api.mbCEPlayerGameTick();
assert(V.pain === 100, "疼痛子项关闭时不锁定");

api.mbCEPlayerGameSet("one_hit", true);
api.mbCEPlayerGameSet("absolute_defense", true);
V.combat = 1; V.pain = 100; V.NPCList[0].health = 100; V.NPCList[1].health = 100;
api.mbCEPlayerGameTick();
assert(V.NPCList[0].health === 0, "一击制胜：非 Boss 秒杀");
assert(V.NPCList[1].health === 50, "一击制胜：Boss 削 50%");
assert(V.pain === 0, "绝对防御：疼痛归零");
V.combat = 0;

api.mbCEPlayerGameReset();
api.mbCEPlayerGameSet("fate_driver", true);
V.tiredness = 2500; V.stress = 100; V.trauma = 100;
api.mbCEPlayerGameTick();
assert(V.stress === 0 && V.trauma === 0, "命运操盘：疲劳>2000 时压力/创伤归零");

api.mbCEPlayerGameSet("triple_form", true);
V.demon = 0; V.angel = 0; V.fallenangel = 0;
api.mbCEPlayerGameTick();
assert(V.demon === 10 && V.angel === 10 && V.fallenangel === 10, "三形共存：三形态写入");
api.mbCEPlayerGameSetSub("triple_form", "angel", false);
V.angel = 0;
api.mbCEPlayerGameTick();
assert(V.angel === 0, "三形子项关闭：天使不写");

api.mbCEPlayerGameSet("charmer", true);
V.NPCList.forEach(function (n) { n.love = 0; });
api.mbCEPlayerGameTick();
assert(V.NPCList.every(function (n) { return n.love === 100; }), "万人迷：NPC 好感拉满");
assert(V.fame.good === 999999, "万人迷：善名拉满");

api.mbCEPlayerGameSet("tentacle_grow", true);
V.mbCE_pg_tentacleLevel = 0;
V.mbCE_playerGame.meta.lastGrowDay = null;
global.Time.days = 10;
api.mbCEPlayerGameTick();
assert(V.mbCE_pg_tentacleLevel === 1, "触手培育：首日 +1");
global.Time.days = 11;
api.mbCEPlayerGameTick();
assert(V.mbCE_pg_tentacleLevel === 2, "触手培育：次日再 +1");
api.mbCEPlayerGameTick();
assert(V.mbCE_pg_tentacleLevel === 2, "触手培育：同一天不重复 +1");

api.mbCEPlayerGameReset();
V.mbCE_playerGame.meta.pleasureApplied = 0;
V.demon = 6; V.fallenangel = 4; V.purity = 1000;
api.mbCEPlayerGameSet("pleasure_lord", true);
assert(V.purity === 980, "欢愉主宰：恶魔 -10 / 堕天使 +9（内部 2000 制 → 980）");

/* ================= I 真实页面 ================= */
section("I 真实页面");
api.open();
const tabs = document.querySelectorAll(".mce-tabs button");
assert(tabs.length === 9 && tabs[0].getAttribute("data-tab") === "player" && tabs[0].textContent === "玩家的游戏", "顶层页签排最前");
tabs[0].click();
const pane = document.querySelector('[data-pane="player"]');
assert(pane && pane.classList.contains("mce-active"), "player 面板已激活");
assert(pane.querySelectorAll(".mce-pg-card").length === 62, "页面渲染 62 张卡");
assert(pane.querySelector(".mce-pg-hero").getAttribute("data-art") === "embedded", "页面横幅使用内嵌图片，不依赖外部文件");
assert(Array.from(pane.querySelectorAll(".mce-pg-card")).every(function (c) {
  return c.querySelector(".mce-pg-card-h .mce-pg-sw") !== null;
}), "每张卡一个主开关");
const search = pane.querySelector(".mce-pg-search");
search.value = "财神"; search.dispatchEvent(new window.Event("input", { bubbles: true }));
const visible = Array.from(pane.querySelectorAll(".mce-pg-card")).filter(function (c) { return c.style.display !== "none"; }).length;
assert(visible > 0 && visible < 62, "搜索过滤生效，可见 " + visible + " 项");
assert(V.mbCE_playerGame.trait === 1, "搜索不改变特质状态");
search.value = ""; search.dispatchEvent(new window.Event("input", { bubbles: true }));

const card = pane.querySelector('.mce-pg-card[data-pg-id="fate_driver"]');
assert(!!card, "找到命运操盘卡片");
card.querySelector(".mce-pg-sw").click();
assert(V.mbCE_playerGame.on.fate_driver === 1, "点击主开关写入存档");
const fav = card.querySelector(".mce-pg-fav");
fav.click();
assert(V.mbCE_playerGame.fav.fate_driver === 1, "收藏星可写");

const fortCard = pane.querySelector('.mce-pg-card[data-pg-id="fortune_bless"]');
const subTog = fortCard.querySelector(".mce-pg-subtog");
assert(!!subTog, "财神卡有子开关入口");
subTog.click();
const subPanel = fortCard.querySelector(".mce-pg-subs");
assert(subPanel.getAttribute("data-collapsed") === "0", "子开关面板展开");
const subSwitch = subPanel.querySelector(".mce-pg-sw");
subSwitch.click();
assert(V.mbCE_playerGame.on.fortune_bless === 1, "点子开关自动开主项");

api.mbCEPlayerGameSet("presets", true);
api.renderPlayerGame();
assert(!!pane.querySelector(".mce-pg-presets"), "开启预设方案后显示预设条");
clickText(pane, "图书馆");
assert(api.mbCEPlayerGameStatus().on === 25, "页面点「图书馆」预设生效");

const host = document.createElement("div");
api.mbCEPlayerGameRenderEntry(host);
assert(!!host.querySelector(".mce-pg-entry"), "全局页入口卡函数可渲染");
assert(/62 项/.test(host.textContent), "入口卡显示 62 项说明");

/* ================= J 边界与脏状态 ================= */
section("J 边界与脏状态");
assert(api.mbCEPlayerGameSet("no_such_id", true).ok === false, "未知能力拒绝");
assert(api.mbCEPlayerGameSetSub("fate_driver", "no_such_sub", true).ok === false, "未知子开关拒绝");
assert(api.mbCEPlayerGameFav("no_such_id").ok === false, "未知收藏项拒绝");
assert(api.mbCEPlayerGameMoneyAmount("not-a-number") === "not-a-number", "非数字金额原样透传");
assert(api.mbCEPlayerGameInstallMoneyHook() === true && api.mbCEPlayerGameInstallMoneyHook() === true, "金钱钩子重复安装幂等");

V.mbCE_pure = 1;
assert(api.mbCEPlayerGameSet("fate_driver", true).ok === false, "纯净模式拒绝单项写入");
assert(api.mbCEPlayerGameSetSub("fate_driver", "stress", true).ok === false, "纯净模式拒绝子开关写入");
assert(api.mbCEPlayerGameAll(true).ok === false, "纯净模式拒绝一键全开");
assert(api.mbCEPlayerGamePreset("full").ok === false, "纯净模式拒绝预设写入");
assert(api.mbCEPlayerGameMoneyAmount(100) === 100, "纯净模式不乘财神倍率");
V.mbCE_pure = 0;

V.mbCE_playerGame = { on: null, subs: "bad", fav: 0, flags: [], meta: null, passive: 0, mode: "x", trait: 2, filter: 5 };
api.mbCEPlayerGameStatus();
assert(V.mbCE_playerGame.on && typeof V.mbCE_playerGame.on === "object", "脏 on 被重建为对象");
assert(V.mbCE_playerGame.subs && typeof V.mbCE_playerGame.subs === "object", "脏 subs 被重建为对象");
assert(V.mbCE_playerGame.fav && typeof V.mbCE_playerGame.fav === "object", "脏 fav 被重建为对象");
assert(V.mbCE_playerGame.flags && typeof V.mbCE_playerGame.flags === "object", "脏 flags 被重建为对象");
assert(V.mbCE_playerGame.meta && typeof V.mbCE_playerGame.meta === "object", "脏 meta 被重建为对象");
assert(V.mbCE_playerGame.passive === 0 && V.mbCE_playerGame.mode === "fun" && V.mbCE_playerGame.trait === 0 && V.mbCE_playerGame.filter === "", "脏标量按白名单回落");

/* ================= K 真实钩子与可逆 ================= */
section("K 真实钩子与可逆");
api.mbCEPlayerGameReset();
V.map = { arrayList: ["A", "B", "C"], available: { Room: ["A"], Other: ["B"] }, hideLinks: true };
api.mbCEPlayerGameSet("allmap", true);
api.mbCEPlayerGameTick();
assert(V.map.available.Room.length === 3 && V.map.available.Other.length === 3, "全图通行：所有地点可达");
assert(V.map.hideLinks === false, "全图通行：地图链接不再隐藏");
assert(window.dangerEvent() === false, "全图通行：遇敌判定被拦截");
api.mbCEPlayerGameSet("allmap", false);
assert(V.map.available.Room.length === 1 && V.map.hideLinks === true, "全图通行：关闭后还原原地图");
assert(window.dangerEvent() === true, "全图通行：关闭后恢复遇敌判定");

api.mbCEPlayerGameReset();
V.beauty = 100;
api.mbCEPlayerGameSet("book_resonance", true);
api.mbCEPlayerGameSet("arsenal_open", true);
api.mbCEPlayerGameSet("mirror_lord", true);
api.mbCEPlayerGameTick();
assert(V.beauty === 105, "藏书共鸣：2 本 +5%，实际 " + V.beauty);
api.mbCEPlayerGameSet("quantum_cram", true);
api.mbCEPlayerGameSet("tentacle_king", true);
api.mbCEPlayerGameTick();
assert(V.beauty === 110, "藏书共鸣：4 本 +10%，实际 " + V.beauty);
api.mbCEPlayerGameSetSub("book_resonance", "b4", false);
api.mbCEPlayerGameTick();
assert(V.beauty === 105, "藏书共鸣：关闭 4 本档回落到 2 本档 +5%");
api.mbCEPlayerGameSet("book_resonance", false);
assert(V.beauty === 100, "藏书共鸣：关闭后还原基础属性");

api.mbCEPlayerGameSet("time_control", true);
global.Time.passCalls.length = 0;
global.Time.pass(300);
assert(global.Time.passCalls.length === 0, "时间掌控：5 分钟行动不耗时");
global.Time.pass(3600);
assert(global.Time.passCalls.length === 1 && global.Time.passCalls[0] === 3600, "时间掌控：长行动仍走原版");
api.mbCEPlayerGameSet("time_control", false);

api.mbCEPlayerGameSet("absolute_defense", true);
window.statChange.pain(50);
assert(window.statChange.lastPain === 0, "绝对防御：statChange.pain 正伤害归零");
api.mbCEPlayerGameSet("absolute_defense", false);

api.mbCEPlayerGameSet("wolf_firepower", true);
window.statChange.spray(-5);
assert(window.statChange.lastSpray === 0, "防狼火力：喷雾消耗归零");
api.mbCEPlayerGameSet("wolf_firepower", false);

api.mbCEPlayerGameReset();
V.beauty = 100;
V.mbCE_playerGame.meta.bak = {};
delete V.mbCE_playerGame.meta.passiveBak;
delete V.mbCE_playerGame.meta.passiveDone;
api.mbCEPlayerGameSetPassive(false);
assert(V.beauty === 100, "特质被动关闭：还原开启前属性，实际 " + V.beauty);
api.mbCEPlayerGameSetPassive(true);
assert(V.beauty === 110, "特质被动开启：全属性 +10%，实际 " + V.beauty);

api.mbCEPlayerGameReset();
V.beauty = 100;
api.mbCEPlayerGameSet("all_stats_max", true);
assert(V.beauty === 999999, "全属性满级：写入满值");
api.mbCEPlayerGameSetSub("all_stats_max", "beauty", false);
assert(V.beauty === 100, "全属性子项关闭：单项还原");

console.log("\n" + (failures ? "FAIL" : "PASS") + "：" + passes + " 通过 / " + failures + " 失败");
process.exit(failures ? 1 : 0);
