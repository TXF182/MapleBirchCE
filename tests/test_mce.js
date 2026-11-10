// CE 版运行时自检：模拟框架原生 romanceConditions（与 inject_early.js 一致的源码形态），
// 验证角色池枚举、条件解析/一键完成、转化阶段、数值补齐、全局批量、容错。
"use strict";
const fs = require("fs");
const path = require("path");

// v2：直接读取纯 JS 版（scriptFileList_inject_early 加载链）
// v1.9.0：测试读 git 源构建产物（javascript/maplebirchce.js），与打包源解耦；
// 可用环境变量 MCE_PKG_JS 覆盖为打包源路径（run_all.ps1 提供 --sync-pkg 后设此变量）。
const jsPath = process.env.MCE_PKG_JS || path.join(__dirname, "..", "javascript", "maplebirchce.js");
const rawJs = fs.readFileSync(jsPath, "utf8");
fs.writeFileSync(path.join(__dirname, "mce_script.js"), rawJs);
// c8 覆盖率归因：eval 执行的代码没有脚本 URL，V8 覆盖率无法映射回源文件
// （实测归因后 c8 才能统计 javascript/maplebirchce.js 的语句/分支/行覆盖）。
// 只加在传给 eval 的副本上，mce_script.js 快照保持与原产物逐字节一致。
const js = rawJs + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/");

// ---- 全局环境（rv 即框架对 V 的引用：rv.variables===V，rv.characters===V.characters） ----
global.V = { maplebirch: { npc: {} }, NPCName: [], characters: { npc: {} } };
global.State = { variables: global.V };
global.setup = {};
global.rv = { variables: global.V, characters: global.V.characters };
const store = global.V.maplebirch.npc;

// ---- 转化 mock（照抄框架 sc/sl/build/set 语义） ----
const DEFAULT_LEVELS = [5, 10, 15, 20, 25, 30];
function sl(build, levels) { return levels.filter(t => build >= t).length; }
function sc(state, levels) {
  const n = (state && typeof state === "object") ? state : {};
  const r = n.build == null ? NaN : Number(n.build);
  const a = Number(n.level);
  const i = Number.isFinite(a) ? (levels[Math.max(0, Math.min(Math.round(a), levels.length)) - 1] ?? 0) : 0;
  const b = Math.max(0, Math.min(Number.isFinite(r) ? r : i, levels.at(-1)));
  return { build: b, level: sl(b, levels) };
}
class FakeTransformation {
  constructor(st) { this.configs = new Map(); this.store = st; }
  add(npc, type, levels) {
    const n = String(npc).toLowerCase();
    if (!this.configs.has(n)) this.configs.set(n, new Map());
    this.configs.get(n).set(type, { levels: levels.slice() });
  }
  ensure(npc, type) {
    const n = String(npc).toLowerCase();
    if (!this.store[n]) this.store[n] = {};
    if (!this.store[n].transformation) this.store[n].transformation = {};
    const i = this.store[n].transformation, t = i[type] || {};
    i[type] = Object.assign(t, sc(t, this.configs.get(n)?.get(type)?.levels ?? DEFAULT_LEVELS));
    return i;
  }
  get(npc, type) { return this.ensure(npc, type)[type]; }
  build(npc, type, delta) {
    const levels = this.configs.get(String(npc).toLowerCase())?.get(type)?.levels ?? DEFAULT_LEVELS;
    const a = this.get(npc, type);
    a.build = Math.max(0, Math.min(a.build + delta, levels.at(-1)));
    a.level = sl(a.build, levels);
    return a;
  }
  set(npc, type, level) {
    const levels = this.configs.get(String(npc).toLowerCase())?.get(type)?.levels ?? DEFAULT_LEVELS;
    const a = this.get(npc, type);
    a.level = Math.max(0, Math.min(Math.round(level), levels.length));
    a.build = levels[a.level - 1] ?? 0;
    return a;
  }
}

// ---- 框架注册池（本体角色 + MOD 角色 + 原生恋爱条件） ----
// 原生 NPC 运行时对象（V.NPCName）
function mkNpc(nam, extra) { return Object.assign({ nam, love: 0, lust: 0, dom: 0, obedience: 0, trust: 0, wary: 0, jealousy: 0 }, extra); }
V.NPCName = [mkNpc("Robin"), mkNpc("Whitney"), mkNpc("Kylar"), mkNpc("Sydney"), mkNpc("Eden"), mkNpc("Avery"), mkNpc("Black Wolf"), mkNpc("Great Hawk"), mkNpc("Alex"), mkNpc("Gwylan")];
// MOD 角色：注册池 + 运行时
V.NPCName.push(mkNpc("Luna", { affection: 0 }));
V.NPCName.push(mkNpc("Raven"));
// Wraith'sReflection MOD（Maplebirch 注册）与原生 NPC（阿电/普通角色 Bailey）
V.NPCName.push(mkNpc("Ivory Wraith"));
V.NPCName.push(mkNpc("阿电"));
V.NPCName.push(mkNpc("Bailey"));

// 恋爱条件（与框架源码同形态）
const rc = {
  Robin: [() => 1 === rv.variables.robinromance],
  Whitney: [() => 1 === rv.variables.whitneyromance, () => "dungeon" !== rv.characters.npc.Whitney.state],
  Kylar: [() => rv.variables.kylarenglish >= 1, () => "prison" !== rv.characters.npc.Kylar.state],
  Sydney: [() => 1 === rv.variables.sydneyromance],
  Eden: [() => 1 === rv.variables.syndromeeden],
  Avery: [() => rv.variables.auriga_artefact, () => "dismissed" !== rv.characters.npc.Avery.state],
  "Black Wolf": [() => 1 === rv.variables.syndromewolves, () => hasSexStat("deviancy", 3)],
  "Great Hawk": [() => 1 === rv.variables.syndromebird],
  Alex: [() => rv.variables.farm_stage >= 7, () => undefined === rv.variables.alex_countdown],
  Gwylan: [() => rv.variables.gwylanSeen?.includes("partners") || rv.variables.gwylanSeen?.includes("romance")],
  Luna: [() => (rv.variables[n + "Seen"] ?? []).includes("romance")]  // loveInterest 通用形态（n 为闭包键）
};
// Luna 的闭包键需要真实变量名，重建为具体名以模拟框架展开后的行为
rc.Luna = [() => (rv.variables["lunaSeen"] ?? []).includes("romance")];
// Wraith'sReflection MOD：Maplebirch 注册角色的恋爱条件（变量在左的反向比较形态，照抄 js/maplebirchAddon.js）
rc["Ivory Wraith"] = [() => rv.variables.WraithsReflection === 1];
// Zephyr：真实闭包键形态（n 是闭包变量，函数源码显示 n + "Seen"）
rc.Zephyr = (function () { var n = "zephyr"; return [() => (rv.variables[n + "Seen"] ?? []).includes("romance")]; })();

const npcData = new Map();
["Robin", "Whitney", "Kylar", "Sydney", "Eden", "Avery", "Black Wolf", "Great Hawk", "Alex", "Gwylan"].forEach(name => {
  npcData.set(name, { Data: { nam: name }, Config: {}, Patch: {} });
});
npcData.set("Luna", { Data: { nam: "Luna" }, Config: { loveInterest: true }, Patch: {} });
npcData.set("Raven", { Data: { nam: "Raven" }, Config: { romance: [() => rv.variables.ravenStory >= 2] }, Patch: {} });
npcData.set("Zephyr", { Data: { nam: "Zephyr" }, Config: { loveInterest: true }, Patch: {} });
npcData.set("Ivory Wraith", { Data: { nam: "Ivory Wraith" }, Config: {}, Patch: {} });

const T = new FakeTransformation(store);
T.add("Black Wolf", "wolf", [5, 10, 15, 20, 25, 30]);
T.add("Luna", "harpy", [3, 8, 16]);
T.add("Raven", "wolf", [5, 12, 20, 30]);

const npc = {
  data: npcData,
  NPCNameList: ["Robin", "Whitney", "Kylar", "Sydney", "Eden", "Avery", "Black Wolf", "Great Hawk", "Alex", "Gwylan", "Luna", "Raven", "Zephyr", "Ivory Wraith"],
  romanceConditions: rc,
  customStats: { affection: { min: 0, max: 100, default: 0 } },
  type: { loveInterestNpcs: ["Luna"], importantNPCs: [], specialNPCs: [] },
  Transformation: T
};
global.window = { maplebirch: { npc, tool: { addTo() {} }, on() {} } };
function hasSexStat() { return false; }

// ---- 原生恋爱 NPC（阿电：v0.1.990 走 DOL 原生注册，非 Maplebirch 池） ----
setup.loveAlias = { "阿电": function () {} };
V.loveInterest = [];
V.adian_romance = 0;
// ---- 扩展转化系统（v0.1.990 兔子/人鱼：setup.myTFSet 公共 API + V.rabbit/V.mermaid） ----
setup.myTFSet = function (name, stage) {
  V[name] = Math.max(0, Math.min(3, Math.floor(stage) || 0));
  V[name + "build"] = V[name] === 0 ? 0 : [30, 60, 90][V[name] - 1];
};
V.transformationParts = { rabbit: { ears: "disabled" }, mermaid: { gills: "disabled" } };
V.rabbit = 0; V.rabbitbuild = 0;
V.mermaid = 0; V.mermaidbuild = 0;

// ---- 原版恋爱阶段（格威岚）mock：setup 套装 + gwylanStatusCheck（照抄游戏原版 0.5.12.13 公式） ----
setup.specialClothesSets = {
  "Forest Garb": { shop: ["forest"] },
  "Woodland Cloak": { shop: ["forest"] },
  "Town Outfit": { shop: ["town"] }
};
setup.specialClothes = [
  { name: "Forest Garb", sets: {} },
  { name: "Woodland Cloak", sets: {} }
];
V.gwylan = { wary: 3 };
V.gwylanSeen = [];
V.gwylanTalked = [];
V.specialClothes = [];
V.weekly = {};
V.gwylanPregnant = false;
V.playerPregnant = false;
window.gwylanStatusCheck = function () {
  const S = global.V;
  const gwylanStatus = [];
  if (!Array.isArray(S.gwylanSeen)) S.gwylanSeen = [];
  const npc = S.NPCName.find(n => n.nam === "Gwylan");
  const sets = setup.specialClothesSets || {};
  const totalSets = Object.keys(sets).filter(k => (sets[k].shop || []).includes("forest")).length;
  const unlocked = (S.specialClothes || []).filter(c => c.unlocked >= 2).length;
  const talked = (S.gwylanTalked || []).filter(s => sets[s] && (sets[s].shop || []).includes("forest")).length;
  const love = Math.ceil(unlocked + talked);
  if (npc) npc.love = love;
  const lovePct = Math.ceil(totalSets ? (love / (totalSets * 2)) * 100 : 0);
  let cautious = false;
  if (S.gwylan && S.gwylan.wary > 1 && ["active", "scorned"].includes(npc && npc.state)) cautious = true;
  if (lovePct >= 65 && S.gwylanSeen.includes("ritual_sex") && npc.dom >= 20 && npc.lust >= 40 && !cautious) {
    if (!S.gwylanSeen.includes("yearning")) gwylanStatus.push("aroused");
  }
  if (lovePct >= 75 && S.gwylanSeen.includes("yearning") && npc.dom >= 50 && npc.lust >= 30 && npc.dom + npc.lust >= 90 && !cautious) {
    gwylanStatus.push("lust");
    if (S.gwylanSeen.includes("partners") && npc.dom >= 100 && npc.lust >= 40 && npc.dom + npc.lust >= 160 && !(S.weekly && S.weekly.gwylanNoHeat)) {
      gwylanStatus.push("heat");
    }
    if (lovePct >= 90 && npc.dom >= 140 && gwylanStatus.includes("heat") && !S.gwylanPregnant && !S.playerPregnant) {
      gwylanStatus.push("wantsPregnancy");
    }
  }
  State.temporary = State.temporary || {};
  State.temporary.gwylanStatus = gwylanStatus;
  return gwylanStatus;
};

// 状态：Whitney 在地牢、Kylar 在监狱、Avery 已辞退
rv.characters.npc.Whitney = { state: "dungeon" };
rv.characters.npc.Kylar = { state: "prison" };
rv.characters.npc.Avery = { state: "dismissed" };

eval(js);
const api = setup.mbStageCE;

let failures = 0;
function assert(cond, msg) { if (!cond) { failures++; console.log("FAIL: " + msg); } else { console.log("PASS: " + msg); } }

// 1) 角色池：本体 10 + MOD 3 + Wraith MOD + 原生 NPC 阿电/Bailey，全部自动枚举，零硬编码
const chars = api.listCharacters();
assert(chars.length === 16, "枚举 16 个角色（本体+MOD+原生），实际 " + chars.length + " : " + JSON.stringify(chars));
assert(chars.includes("Black Wolf") && chars.includes("Luna") && chars.includes("Raven") && chars.includes("Zephyr"), "包含多词角色名与 MOD 角色");
assert(chars.includes("Ivory Wraith") && chars.includes("阿电"), "包含 Wraith MOD 角色与原生 NPC 阿电");

// 2) 恋爱条件自动解析与判定
let robinStages = api.getRomanceStages("Robin");
assert(robinStages.length === 1 && robinStages[0].ok === false, "Robin 恋爱条件未达成(红)");
assert(/robinromance/.test(robinStages[0].text), "条件原文可显示: " + robinStages[0].text);
let whitneyStages = api.getRomanceStages("Whitney");
assert(whitneyStages.length === 2 && whitneyStages[0].ok === false && whitneyStages[1].ok === false, "Whitney 2 条件均未达成");

// 3) 一键完成（先补数值 → 再置 flag）：Robin
let r1 = api.completeRomanceStage("Robin", robinStages[0]);
assert(r1.fixed && r1.ok && V.robinromance === 1, "Robin: 自动写入 robinromance=1 并复检通过");

// Whitney：条件1 whitneyromance，条件2 状态 dungeon
let w1 = api.completeRomanceStage("Whitney", whitneyStages[0]);
assert(w1.ok && V.whitneyromance === 1, "Whitney 条件1 通过 (whitneyromance=1)");
let w2 = api.completeRomanceStage("Whitney", whitneyStages[1]);
assert(w2.ok && rv.characters.npc.Whitney.state === "stable", "Whitney 条件2 通过 (state→stable, 实际 " + rv.characters.npc.Whitney.state + ")");

// Kylar: kylarenglish>=1 + prison
let kStages = api.getRomanceStages("Kylar");
let k1 = api.completeRomanceStage("Kylar", kStages[0]);
let k2 = api.completeRomanceStage("Kylar", kStages[1]);
assert(k1.ok && V.kylarenglish === 1, "Kylar 条件1 (kylarenglish=1)");
assert(k2.ok && rv.characters.npc.Kylar.state === "stable", "Kylar 条件2 (state→stable)");

// Avery: auriga_artefact 裸真值 + dismissed 状态
let aStages = api.getRomanceStages("Avery");
let a1 = api.completeRomanceStage("Avery", aStages[0]);
let a2 = api.completeRomanceStage("Avery", aStages[1]);
assert(a1.ok && V.auriga_artefact === 1, "Avery 条件1 (裸真值→1)");
assert(a2.ok && rv.characters.npc.Avery.state === "stable", "Avery 条件2 (dismissed→stable)");

// Alex: farm_stage>=7 + alex_countdown undefined
let alStages = api.getRomanceStages("Alex");
let al1 = api.completeRomanceStage("Alex", alStages[0]);
let al2 = api.completeRomanceStage("Alex", alStages[1]);
assert(al1.ok && V.farm_stage === 7, "Alex 条件1 (farm_stage=7)");
assert(al2.ok && !("alex_countdown" in V), "Alex 条件2 (alex_countdown 清除)");

// Gwylan: includes OR 形态
let gStages = api.getRomanceStages("Gwylan");
let g1 = api.completeRomanceStage("Gwylan", gStages[0]);
assert(g1.ok && Array.isArray(V.gwylanSeen) && V.gwylanSeen.indexOf("partners") !== -1, "Gwylan (gwylanSeen 追加 partners)");

// Luna: [X+"Seen"] 动态键形态
let lStages = api.getRomanceStages("Luna");
assert(lStages.length === 1 && lStages[0].ok === false, "Luna 条件解析为 1 条未达成");
let l1 = api.completeRomanceStage("Luna", lStages[0]);
assert(l1.ok && Array.isArray(V.lunaSeen) && V.lunaSeen.indexOf("romance") !== -1, "Luna 动态键 [lunaSeen] 追加 romance");

// Zephyr: 真实闭包键形态（源码显示 n + "Seen"）
let zStages = api.getRomanceStages("Zephyr");
assert(zStages.length === 1 && /Seen/.test(zStages[0].text), "Zephyr 闭包键条件解析, 原文: " + zStages[0].text);
let z1 = api.completeRomanceStage("Zephyr", zStages[0]);
assert(z1.ok && Array.isArray(V.zephyrSeen) && V.zephyrSeen.indexOf("romance") !== -1, "Zephyr 闭包键 → zephyrSeen 追加 romance");

// Raven: Config.romance 形态
let rvStages = api.getRomanceStages("Raven");
assert(rvStages.length === 1 && /ravenStory/.test(rvStages[0].text), "Raven Config.romance 自动解析");
let rv1 = api.completeRomanceStage("Raven", rvStages[0]);
assert(rv1.ok && V.ravenStory === 2, "Raven (ravenStory=2)");

// Black Wolf: hasSexStat 不可解析 → 不写入、提示
let bwStages = api.getRomanceStages("Black Wolf");
assert(bwStages.length === 2, "Black Wolf 2 条条件");
let bw2 = api.completeRomanceStage("Black Wolf", bwStages[1]);
assert(bw2.fixed === false && bw2.ok === false, "Black Wolf hasSexStat 不可自动完成（仅提示）");

// 4.4) 条件中文说明（已达成=达成了什么）
let dAvery1 = api.describeCondition("()=>rv.variables.auriga_artefact", "Avery");
assert(dAvery1.includes("御夫座神器"), "条件中文说明：auriga_artefact → 御夫座神器, 实际 " + dAvery1);
let dAvery2 = api.describeCondition('()=>"dismissed"!==rv.characters.npc.Avery.state', "Avery");
assert(dAvery2.includes("艾弗里") && dAvery2.includes("已辞退"), "条件中文说明：state 比较 → 艾弗里状态不是已辞退, 实际 " + dAvery2);
let dRobin = api.describeCondition("() => 1 === rv.variables.robinromance", "Robin");
assert(dRobin.includes("罗宾"), "条件中文说明：robinromance=1 → 罗宾·恋人关系, 实际 " + dRobin);
let dGwylan = api.describeCondition('() => rv.variables.gwylanSeen?.includes("partners") || rv.variables.gwylanSeen?.includes("romance")', "Gwylan");
assert(dGwylan.includes("恋人"), "条件中文说明：gwylanSeen includes → 恋人关系, 实际 " + dGwylan);
let dAlex = api.describeCondition("() => rv.variables.farm_stage >= 7", "Alex");
assert(dAlex.includes("农场"), "条件中文说明：farm_stage>=7 → 农场阶段, 实际 " + dAlex);

// 4.5) 原版恋爱阶段（格威岚 7 阶段，来自游戏原版 gwylanStatusCheck 体系）
let vAll = api.getVanillaStages("Gwylan");
assert(vAll.length === 7, "格威岚原版恋爱阶段 7 条，实际 " + vAll.length);
assert(api.getVanillaStages("Robin").length === 0, "非格威岚角色无原版阶段（Robin=0）");
assert(vAll.filter(s => !s.ok).length === 6 && vAll.find(s => s.key === "partners").ok === true, "初始 7 阶段：仅「恋人」绿（框架条件已写入 gwylanSeen partners），其余 6 个未达成");
let vRitual = api.completeVanillaStage("Gwylan", "ritual_sex");
assert(vRitual.ok && V.gwylanSeen.includes("ritual_sex"), "仪式之约：gwylanSeen 追加 ritual_sex");
let vYearn = api.completeVanillaStage("Gwylan", "yearning");
let gNpc = api.findNpc("Gwylan");
assert(vYearn.ok && V.gwylanSeen.includes("yearning") && gNpc.dom >= 20 && gNpc.lust >= 40 && V.gwylan.wary === 0, "渴望：补爱意/支配≥20/情欲≥40 + 警戒清零 + seen 追加 yearning");
let vLust = api.completeVanillaStage("Gwylan", "lust");
assert(vLust.ok && State.temporary.gwylanStatus.includes("lust"), "欲望：数值达标后原版 statusCheck 计算 lust");
let vHeat = api.completeVanillaStage("Gwylan", "heat");
assert(vHeat.ok && State.temporary.gwylanStatus.includes("heat"), "发情：恋人 + 支配≥100 + 情欲≥40 + 支配+情欲≥160 → heat");
let vPreg = api.completeVanillaStage("Gwylan", "wantsPregnancy");
assert(vPreg.ok && State.temporary.gwylanStatus.includes("wantsPregnancy"), "孕育意愿：爱意≥90% + 支配≥140 + 发情 → wantsPregnancy");
let vPart = api.completeVanillaStage("Gwylan", "partners");
let vRom = api.completeVanillaStage("Gwylan", "romance");
assert(vPart.ok && V.gwylanSeen.includes("partners") && vRom.ok && V.gwylanSeen.includes("romance"), "恋人/永远：seen 事件经历");
let vLeft = api.getVanillaStages("Gwylan");
assert(vLeft.every(s => s.ok === true), "全阶段完成后复检全部已达成（规避自动校验重置）");
let vUnlock = api.unlockVanillaAll("Gwylan");
assert(vUnlock === 0, "重复执行 unlockVanillaAll 返回 0（已全部达成）");

// 原版函数缺失兜底：内置公式（与游戏 0.5.12.13 源码一致）
const savedW = window.gwylanStatusCheck;
delete window.gwylanStatusCheck;
V.gwylanSeen = ["partners"];
let vb0 = api.getVanillaStages("Gwylan");
assert(vb0.length === 7 && vb0.filter(s => !s.ok).length === 6, "内置公式兜底：仅恋人绿，其余 6 阶段未达成");
let vbHeat = api.completeVanillaStage("Gwylan", "heat");
assert(vbHeat.ok && State.temporary.gwylanStatus.includes("heat"), "内置公式兜底：一键发情 → heat 由内置公式实时算出");
window.gwylanStatusCheck = savedW;
api.unlockVanillaAll("Gwylan");
let vbOk = api.getVanillaStages("Gwylan");
assert(vbOk.every(s => s.ok === true), "恢复原版函数后全阶段复检达成（不干扰后续全局批量）");

// 4) 转化阶段：一键完成顺序 + 自动校验存活
let tf = api.listStageTypes("Black Wolf");
assert(tf.get("wolf").join() === "5,10,15,20,25,30", "Black Wolf wolf 门槛");
api.completeTransformStage("Black Wolf", "wolf", 3);
let tfs = api.readTransformState("Black Wolf", "wolf");
assert(tfs.build === 15 && tfs.level === 3, "wolf 阶段3: build=15 level=3, 实际 " + JSON.stringify(tfs));
T.ensure("Black Wolf", "wolf");
tfs = api.readTransformState("Black Wolf", "wolf");
assert(tfs.level === 3, "自动校验后 level 保持 3（不被重置）");
api.completeTransformStage("Black Wolf", "wolf", 99);
tfs = api.readTransformState("Black Wolf", "wolf");
assert(tfs.level === 6 && tfs.build === 30, "超上限钳制到 6/30");
api.adjustTransform("Black Wolf", "wolf", -10);
tfs = api.readTransformState("Black Wolf", "wolf");
assert(tfs.build === 20 && tfs.level === 4, "-10 后 build=20 level=4（sl(20,[5,10,15,20,25,30])=4），实际 " + JSON.stringify(tfs));

// 5) 数值读写与补齐（含 customStats）
let luna = api.findNpc("Luna");
assert(luna && luna.love === 0, "Luna 运行时对象存在");
api.adjust = null;
let nFilled = api.fillStats(luna, "Luna");
assert(nFilled >= 8 && luna.love === 100 && luna.wary === 0 && luna.affection === 100, "补齐: love=100 wary=0 custom affection=100, 项数=" + nFilled);

// 5a) v1.9.27：框架 customStats 注册属性中文显示（阶段页数值行直显 key 的兜底汉化）
npc.customStats.conviction = { min: 0, max: 100, default: 0 };
npc.customStats.doubt = { min: 0, max: 100, default: 0 };
let defs5a = api.statDefsFor("Luna");
let cn5a = {};
defs5a.forEach(d => { if (d.custom) { cn5a[d.key] = d.label; } });
assert(cn5a.conviction === "执念", "conviction → 执念, 实际 " + cn5a.conviction);
assert(cn5a.doubt === "疑虑", "doubt → 疑虑, 实际 " + cn5a.doubt);
assert(cn5a.affection === "affection", "未收录自定义属性保持 key 直显（affection）, 实际 " + cn5a.affection);

// 6) 全局批量
let gRom = api.globalRomance();
assert(gRom.fixed === 6, "全局恋爱阶段新增解锁 6 个（Sydney/Eden/GreatHawk/BlackWolf 条件1 + Wraith + 阿电原生），实际 " + gRom.fixed);
let left = 0;
api.listCharacters().forEach(n => api.getRomanceStages(n).forEach(s => { if (!s.ok) { left++; } }));
assert(left === 1, "全局后全角色仅剩 hasSexStat 1 条不可自动条件，实际 " + left);
let gTf = api.globalTransform();
assert(gTf.stages >= 3, "全局转化阶段解锁 >=3, 实际 " + gTf.stages);
let gFill = api.globalFill();
assert(gFill.stats >= 16, "全局数值补齐项数 >=16, 实际 " + gFill.stats);

// 7) 容错：框架缺失不抛错（见文件末尾：需重新加载脚本获得干净闭包，MB 缓存为空）

// 8) 剧情 MOD 适配专项（先恢复框架 mock）
global.window.maplebirch = { npc, tool: { addTo() {} }, on() {} };
// 8.1) Wraith'sReflection：变量在左的反向比较条件（V.WraithsReflection === 1）
V.WraithsReflection = 0;
let wrStages = api.getRomanceStages("Ivory Wraith");
assert(wrStages.length === 1 && wrStages[0].ok === false, "Wraith 反向条件解析为 1 条未达成");
let wr1 = api.completeRomanceStage("Ivory Wraith", wrStages[0]);
assert(wr1.fixed && wr1.ok && V.WraithsReflection === 1, "Wraith 一键完成：写入 WraithsReflection=1 并复检通过");
assert(api.displayName("Ivory Wraith") === "怨灵", "译名：Ivory Wraith → 怨灵, 实际 " + api.displayName("Ivory Wraith"));
// 8.1a) 汉化对照补齐译名（ModI18N 人名表：Morgan/River/Sirris/Night Monster + 统一译法）
assert(api.displayName("Morgan") === "摩根", "译名：Morgan → 摩根, 实际 " + api.displayName("Morgan"));
assert(api.displayName("River") === "瑞沃", "译名：River → 瑞沃, 实际 " + api.displayName("River"));
assert(api.displayName("Sirris") === "西里斯", "译名：Sirris → 西里斯, 实际 " + api.displayName("Sirris"));
assert(api.displayName("Night Monster") === "夜魔", "译名：Night Monster → 夜魔, 实际 " + api.displayName("Night Monster"));
assert(api.displayName("Alex") === "艾利克斯", "译名：Alex → 艾利克斯（按汉化统一）, 实际 " + api.displayName("Alex"));
assert(api.displayName("Jordan") === "约旦", "译名：Jordan → 约旦（按汉化统一）, 实际 " + api.displayName("Jordan"));
assert(api.displayName("Leighton") === "礼顿", "译名：Leighton → 礼顿（按汉化统一）, 实际 " + api.displayName("Leighton"));
assert(api.displayName("Wren") === "伦恩", "译名：Wren → 伦恩（按汉化统一）, 实际 " + api.displayName("Wren"));
assert(api.displayName("Briar") === "布莱尔", "译名：Briar → 布莱尔（按汉化统一）, 实际 " + api.displayName("Briar"));
assert(api.displayName("Sam") === "萨姆", "译名：Sam → 萨姆（按汉化统一）, 实际 " + api.displayName("Sam"));
assert(api.displayName("Charlie") === "查里", "译名：Charlie → 查里（按汉化统一）, 实际 " + api.displayName("Charlie"));
assert(api.displayName("Quinn") === "奎恩", "译名：Quinn → 奎恩（按汉化统一）, 实际 " + api.displayName("Quinn"));
assert(api.displayName("Niki") === "尼奇", "译名：Niki → 尼奇（按汉化统一）, 实际 " + api.displayName("Niki"));
assert(api.displayName("Robin") === "罗宾" && api.displayName("Sydney") === "悉尼" && api.displayName("Kylar") === "凯拉尔", "既有译名不回归：Robin/Sydney/Kylar");
let dWr = api.describeCondition('() => rv.variables.WraithsReflection === 1', "Ivory Wraith");
assert(dWr.includes("怨灵"), "条件中文说明：反向 ===1 → 怨灵·剧情进度, 实际 " + dWr);

// 8.2) 原生 NPC 恋爱兜底（阿电：DOL 原生注册，Maplebirch 池外）
V.loveInterest = [];
let adStages = api.getRomanceStages("阿电");
assert(adStages.length === 1 && /loveInterest/.test(adStages[0].text) && adStages[0].ok === false, "阿电原生恋爱条件兜底 1 条（loveInterest），未达成");
let ad1 = api.completeRomanceStage("阿电", adStages[0]);
assert(ad1.ok && Array.isArray(V.loveInterest) && V.loveInterest.indexOf("阿电") !== -1, "阿电一键完成：loveInterest 数组追加「阿电」");
assert(api.displayName("阿电") === "阿电", "译名：阿电（中文注册键）");
let dAd = api.describeCondition('() => rv.variables.loveInterest.includes("阿电")', "阿电");
assert(dAd.includes("阿电") && dAd.includes("恋人"), "条件中文说明：loveInterest → 阿电已确立恋人关系, 实际 " + dAd);
// loveInterest 对象槽位容错（原版可能按槽位存）
V.loveInterest = {};
let adStages2 = api.getRomanceStages("阿电");
let ad2 = api.completeRomanceStage("阿电", adStages2[0]);
assert(ad2.ok && V.loveInterest.primary === "阿电", "loveInterest 对象槽位容错：空对象写入 primary 主槽");
// 普通 NPC 不误伤（Bailey 无恋爱标记 → 无恋爱条件）
assert(api.getRomanceStages("Bailey").length === 0, "Bailey 无恋爱条件（不误伤普通 NPC）");

// 8.3) 扩展转化（v0.1.990 兔子/人鱼：setup.myTFSet 公共 API）
let extList = api.listExtTransforms();
assert(extList.indexOf("rabbit") !== -1 && extList.indexOf("mermaid") !== -1, "扩展转化自动枚举 rabbit/mermaid, 实际 " + JSON.stringify(extList));
let ext1 = api.completeExtTransform("rabbit");
assert(ext1 && V.rabbit === 3 && V.rabbitbuild === 90, "扩展转化一键完成：myTFSet→阶段3 build90");
assert(extList.indexOf("wolf") === -1, "原版注册转化不被误判为扩展（wolf 不在扩展列表）");

// 9) 特殊剧情（DoL $scenes 场景注册表，照抄本体 <<widget "scenes">> 文本形态）
const SCENE_TEXT = `<<widget "scenes">> header <<if $scenePassages is undefined>><<set $scenePassages to []>><</if>><<if $scenes is undefined>><<seenPassageChecks>><<set $scenes to { "Tutorial":{ name:"Tutorial", startPassage:"SV Tutorial", passages:["SV Tutorial","Tutorial","Tutorial Finish"], manualVariableChanges:"<<set $tutorial to 0>>", unlocked: $scenePassages.includes("Tutorial"), lockedMessage:"Locked." }, "TempleSydneyPure":{ name:"Temple Sydney Pure", startPassage:"SV Sydney Temple Pure", passages:["SV Sydney Temple Pure","Sydney Temple Pure","Sydney Temple Pure 2"], manualVariableChanges:"<<set $outside to 0>><<set $location to 'temple'>>", unlocked: $scenePassages.includes("TempleSydneyPureRitual"), lockedMessage: $scenePassages.includes("TempleSydneyCorrupt") ? "Mutually exclusive scene" : "Locked" }, "TempleSydneyCorrupt":{ name:"Temple Sydney Corrupt", startPassage:"SV Sydney Temple Corrupt", passages:["SV Sydney Temple Corrupt","Sydney Temple Corrupt"], manualVariableChanges:"", unlocked: $scenePassages.includes("TempleSydneyCorrupt"), lockedMessage: $scenePassages.includes("TempleSydneyPure") ? "Mutually exclusive scene" : "Locked" }, "RobinCrossdressing1":{ name:"Robin Crossdressing 1", startPassage:"Robin Crossdressing 1", passages:["Robin Crossdressing 1"], manualVariableChanges:"", unlocked: $scenePassages.includes("RobinCrossdressing1"), lockedMessage:"Locked" }, "RobinCrossdressing2":{ name:"Robin Crossdressing 2", startPassage:"Robin Crossdressing 2", passages:["Robin Crossdressing 2"], manualVariableChanges:"", unlocked: $scenePassages.includes("RobinCrossdressing2"), lockedMessage:"Locked" }, "RobinCrossdressing3":{ name:"Robin Crossdressing 3", startPassage:"Robin Crossdressing 3", passages:["Robin Crossdressing 3"], manualVariableChanges:"", unlocked: $scenePassages.includes("RobinCrossdressing3"), lockedMessage:"Locked" }, "AlexFarmWorkStage3":{ name:"Alex Farm Work Stage 3", startPassage:"AlexFarmWorkStage3", passages:["AlexFarmWorkStage3"], manualVariableChanges:"", unlocked: $scenePassages.includes("AlexFarmWorkStage3"), lockedMessage:"Locked" }, "AlexFarmWorkStage4":{ name:"Alex Farm Work Stage 4", startPassage:"AlexFarmWorkStage4", passages:["AlexFarmWorkStage4"], manualVariableChanges:"", unlocked: $scenePassages.includes("AlexFarmWorkStage4"), lockedMessage:"Locked" }, "AlexFarmWorkStage5":{ name:"Alex Farm Work Stage 5", startPassage:"AlexFarmWorkStage5", passages:["AlexFarmWorkStage5"], manualVariableChanges:"", unlocked: $scenePassages.includes("AlexFarmWorkStage5"), lockedMessage:"Locked" } }>><</if>><</widget>>`;
// 模拟 SugarCube 2.36.1（Story.passages 已移除）：段落经 Story.lookupWith 枚举
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT }].filter(fn) };
V.scenePassages = [];
// 9.0) 段落枚举修复：listAllPassages 走 lookupWith 主路径
let lap0 = api.listAllPassages();
assert(lap0.length === 1 && lap0[0].name === "Scene Viewer", "listAllPassages 经 Story.lookupWith 枚举段落, 实际 " + lap0.length);
// 9.1) 实时解析 widget 文本（live 模式），9 个场景
let sDefs = api.getScenesDefs();
assert(sDefs.live === true && Object.keys(sDefs.defs).length === 9, "场景注册表从 Story 文本实时解析 9 条, 实际 " + Object.keys(sDefs.defs).length);
// 9.2) Tutorial：未达成 → 一键完成（push "Tutorial"）→ 复检达成
let stTut = api.sceneStatus(sDefs.defs["Tutorial"]);
assert(stTut.state === "fail", "Tutorial 初始未达成(红)");
let cTut = api.completeScene(sDefs.defs["Tutorial"]);
assert(cTut.ok && V.scenePassages.indexOf("Tutorial") !== -1 && api.sceneStatus(sDefs.defs["Tutorial"]).state === "pass", "Tutorial 一键完成 → 达成");
// 9.3) TempleSydneyPure：解锁条件是段落之外的场景键（"TempleSydneyPureRitual"）→ 表达式字面量提取
let stPure = api.sceneStatus(sDefs.defs["TempleSydneyPure"]);
assert(stPure.state === "fail", "TempleSydneyPure 初始未达成");
let cPure = api.completeScene(sDefs.defs["TempleSydneyPure"]);
assert(cPure.ok && V.scenePassages.indexOf("TempleSydneyPureRitual") !== -1, "TempleSydneyPure 一键完成：从 unlocked 表达式提取字面量写入");
// 9.4) TempleSydneyCorrupt：互斥提示在 lockedMessage（未达成时展示）；达成后 unlocked 为真
let cCorr = api.completeScene(sDefs.defs["TempleSydneyCorrupt"]);
let stCorr = api.sceneStatus(sDefs.defs["TempleSydneyCorrupt"]);
assert(cCorr.ok && stCorr.state === "pass", "TempleSydneyCorrupt 一键完成 → 达成");
V.scenePassages = [];
let stCorr2 = api.sceneStatus(sDefs.defs["TempleSydneyCorrupt"]);
assert(stCorr2.state === "fail" && stCorr2.note.length > 0, "未完成时显示锁定原因(lockedMessage), 实际 " + stCorr2.note);
V.scenePassages = ["TempleSydneyPure"];
let stCorr3 = api.sceneStatus(sDefs.defs["TempleSydneyCorrupt"]);
assert(/Mutually|exclusive/.test(stCorr3.note), "互斥场景提示来自 lockedMessage, 实际 " + stCorr3.note);
V.scenePassages = ["TempleSydneyCorrupt"];
// 9.5) 聚类：RobinCrossdressing1-3 → 一条线 3 阶段；AlexFarmWorkStage3-5 → 一条线；单场景 3 个
let cluster = api.listSceneLines(sDefs.defs);
assert(cluster.lines.length === 2, "剧情线聚类 2 条, 实际 " + cluster.lines.length + " " + JSON.stringify(cluster.lines.map(l => l.prefix)));
let robinLine = cluster.lines.find(l => /RobinCrossdressing/i.test(l.prefix));
assert(robinLine && robinLine.items.length === 3 && robinLine.items.map(i => i.num).join() === "1,2,3", "罗宾变装线 3 阶段(1,2,3)");
let alexLine = cluster.lines.find(l => /AlexFarmWorkStage/i.test(l.prefix));
assert(alexLine && alexLine.items.length === 3 && alexLine.items.map(i => i.num).join() === "3,4,5", "亚历克斯农场线 3 阶段(3,4,5)");
assert(cluster.singles.length === 3, "独立场景 3 个(Tutorial/TempleSydneyPure/Corrupt), 实际 " + cluster.singles.length);
// 9.6) V.scenes 缓存回退（无 Story 时读存档缓存值）
delete global.Story;
V.scenes = { FakeScene: { name: "假场景", startPassage: "S", passages: ["S"], unlocked: true, lockedMessage: "Locked" } };
let sDefs2 = api.getScenesDefs();
assert(sDefs2.live === false && sDefs2.defs["FakeScene"] && api.sceneStatus(sDefs2.defs["FakeScene"]).state === "pass", "无 Story 时回退 V.scenes 缓存（unlocked:true → 已达成）");
delete V.scenes;
// 9.7) HTML 转义形态（本体实际存储 &lt;&lt;...&gt;&gt;）：反转义后仍可实时解析
const SCENE_TEXT_ESCAPED = SCENE_TEXT.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT_ESCAPED }].filter(fn) };
let sDefs3 = api.getScenesDefs();
assert(sDefs3.live === true && Object.keys(sDefs3.defs).length === 9, "转义形态 widget 文本反转义后可解析 9 条, 实际 " + Object.keys(sDefs3.defs).length);
let stTut3 = api.sceneStatus(sDefs3.defs["Tutorial"]);
assert(stTut3.state === "fail", "转义形态下 unlocked 表达式求值正常（Tutorial 未达成）");
delete global.Story;
// 9.8) DOM 兜底：Story 不可用/被改写时，从 <tw-passagedata> 元素枚举（ModLoader 同源）
global.document = { querySelectorAll: () => [{ getAttribute: (a) => a === "name" ? "Orphanage Loft" : "", textContent: "x" }] };
let lapDom = api.listAllPassages();
assert(lapDom.length === 1 && lapDom[0].name === "Orphanage Loft", "Story 缺失时 DOM(tw-passagedata) 兜底枚举, 实际 " + JSON.stringify(lapDom));
// 9.9) Story.lookupWith 抛错也不阻断（外层容错 → DOM 兜底）
global.Story = { lookupWith: () => { throw new Error("Story 被改写"); } };
let lapDom2 = api.listAllPassages();
assert(lapDom2.length === 1 && lapDom2[0].name === "Orphanage Loft", "lookupWith 抛错时 DOM 兜底仍可枚举, 实际 " + JSON.stringify(lapDom2));
delete global.Story;
delete global.document;

// 10) 特殊场景直达（动态枚举 Story 段落名 + 主从分组 + 一键直达）
const PLACE_NAMES = [
  "Orphanage Loft", "Orphanage Loft Kitchen", "Orphanage Loft Reading Nook", "Orphanage Loft Intro",
  "Manor Hall", "Manor Garden", "Manor Lab", "Manor Kylar Room",
  "Temple Sydney", "Temple Sydney Wakeup", "Sydney Temple Corrupt",
  "Mansion Bed", "Mansion Pool", "Mansion Bathroom", "Mansion Wardrobe", "Mansion Intro Orphanage Avery",
  "Gwylan Ritual Start Garden", "Pregnancy Birth Forest Shop", "Gwylan Garden Trim",
  "Adult Shop Approach Sirris", "Sirris Shop Assistant 1", "School Sirris Help", "Sydney Ride Home",
  "Orphanage", "Temple", "ManorHall", "Forest Shop", "Avery", "Kylar Abduction Intro",
  /* v1.9.13 场景直达补充 6 组：精神病院/警局监狱/码头/湖畔/狼群领地/医院（段落名均经本体实证） */
  "Asylum", "Asylum Wardrobe",
  "Docks", "Docks_Robin Swap",
  "Lake Stroll", "Lake Insect",
  "Police Cell", "Police Community Start", "Prison Wren Intro",
  "Wolf Pack", "Forest Wolf Cave Intro",
  /* v2.0.16 主场景修正：Wolf Pack / The Farm 首宏都是 if($molestationstart is 1) 的纯战斗遭遇段
     （实证原文含 <<beastCombatInit>>，硬跳必白屏），主场景换到自带出口的 hub / 小屋。 */
  "Wolf Cave", "Farm Cottage",
  "Hospital front", "Hospital Foyer"
];
// 模拟 SugarCube 2.36.1：无 Story.passages，场景页经 lookupWith 枚举段落名
global.Story = { has: (n) => PLACE_NAMES.indexOf(n) !== -1, lookupWith: (fn) => PLACE_NAMES.map(n => ({ name: n, text: "" })).filter(fn) };
let lap10 = api.listAllPassages();
assert(lap10.length === PLACE_NAMES.length, "listPlaceGroups 经 lookupWith 枚举全部段落, 实际 " + lap10.length);
let pGroups = api.listPlaceGroups();
assert(pGroups.length === 22, "场景分组 22 组（14 + v2.0.0.007 妓院/雷米牧场/雷米农场 + v2.0.7 海岛 Island + v2.0.15 怨灵/万圣节/情人节/圣诞 4 组）, 实际 " + pGroups.length);
let brV7 = pGroups.find(x => x.group.id === "brothel");
assert(!!brV7 && brV7.group.main === "Brothel Basement" && brV7.items.length === 0 && brV7.group.name.indexOf("妓院") === 0, "v2.0.0.007 妓院组存在（主场景 Brothel Basement=地下妓院；模拟段落表无 Brothel 段 → items 空）, 实际 " + JSON.stringify(brV7 && brV7.group.main));
let lvV7 = pGroups.find(x => x.group.id === "remy_livestock");
assert(!!lvV7 && lvV7.group.main === "Livestock Intro" && lvV7.group.name.indexOf("雷米牧场") === 0, "v2.0.0.007 雷米牧场牲口线组存在（主场景 Livestock Intro）, 实际 " + JSON.stringify(lvV7 && lvV7.group.main));
let fmV7 = pGroups.find(x => x.group.id === "remy_farm");
assert(!!fmV7 && fmV7.group.main === "Farm Cottage" && fmV7.group.name.indexOf("雷米农场") === 0, "雷米农场组存在（v2.0.16 主场景 The Farm→Farm Cottage：前者首宏 if($molestationstart is 1) 是纯战斗遭遇段）, 实际 " + JSON.stringify(fmV7 && fmV7.group.main));
let asy = pGroups.find(x => x.group.id === "asylum");
assert(asy.group.name.indexOf("精神病院") === 0 && asy.items.length === 2 && asy.items[0] === "Asylum", "精神病院组 2 段主置顶, 实际 " + JSON.stringify(asy.items));
let dp = pGroups.find(x => x.group.id === "police_prison");
assert(dp.group.name.indexOf("警局") === 0 && dp.items.length === 3 && dp.items[0] === "Police Cell", "警局与监狱组 3 段主置顶, 实际 " + JSON.stringify(dp.items));
let dk = pGroups.find(x => x.group.id === "docks");
assert(dk.group.name.indexOf("码头") === 0 && dk.items.length === 2 && dk.items[0] === "Docks", "码头组 2 段主置顶, 实际 " + JSON.stringify(dk.items));
let lk = pGroups.find(x => x.group.id === "lake");
assert(lk.group.name.indexOf("湖畔") === 0 && lk.items.length === 2 && lk.items[0] === "Lake Stroll", "湖畔组 2 段主置顶, 实际 " + JSON.stringify(lk.items));
let wf = pGroups.find(x => x.group.id === "wolf_territory");
assert(wf.group.name.indexOf("森林深处") === 0 && wf.items.length === 3 && wf.items[0] === "Wolf Cave", "狼群领地组 3 段主置顶（v2.0.16 主场景 Wolf Pack→Wolf Cave）, 实际 " + JSON.stringify(wf.items));
let hp = pGroups.find(x => x.group.id === "hospital");
assert(hp.group.name.indexOf("医院") === 0 && hp.items.length === 2 && hp.items[0] === "Hospital front", "医院组 2 段主置顶, 实际 " + JSON.stringify(hp.items));
let og = pGroups.find(x => x.group.id === "orphanage_loft");
assert(og.items.length === 4 && og.items[0] === "Orphanage Loft", "阁楼组 4 段且主场景置顶, 实际 " + JSON.stringify(og.items));
let kg = pGroups.find(x => x.group.id === "kylar_manor");
assert(kg.items.length === 4 && kg.items[0] === "Manor Hall", "凯拉尔庄园组 4 段主置顶, 实际 " + JSON.stringify(kg.items));
let sg = pGroups.find(x => x.group.id === "sydney_temple");
assert(sg.group.name.indexOf("悉尼") === 0 && sg.items.length === 3 && sg.items[0] === "Temple Sydney", "悉尼神殿组 3 段主置顶, 实际 " + sg.group.name + " " + JSON.stringify(sg.items));
let sr = pGroups.find(x => x.group.id === "sirris_places");
assert(sr.group.name.indexOf("西里斯") === 0 && sr.items.length === 4 && sr.items[0] === "Adult Shop Approach Sirris", "西里斯学校/商店组 4 段主置顶, 实际 " + sr.group.name + " " + JSON.stringify(sr.items));
let ag = pGroups.find(x => x.group.id === "avery_mansion");
assert(ag.items.length === 5 && ag.items[0] === "Mansion Bed", "艾弗里庄园组 5 段主置顶, 实际 " + JSON.stringify(ag.items));
let gg = pGroups.find(x => x.group.id === "gwylan_garden");
assert(gg.items.length === 4 && gg.items[0] === "Gwylan Ritual Start Garden", "格威岚花园组 4 段主置顶, 实际 " + JSON.stringify(gg.items));
let totalItems = pGroups.reduce((s, x) => s + x.items.length, 0);
assert(totalItems === 39, "干扰段落不误入（v2.0.16 起含 Wolf Cave / Farm Cottage 两条新主场景，总 39 段）, 实际 " + totalItems);
// 10.0) v2.0.16 场景直达子入口（用户「note 里点了名的子区域也该有直达按钮」）
assert(typeof api.mbCEListPlaceEntries === "function" && typeof api.PLACE_EXTRA_ENTRIES === "object", "子入口表 PLACE_EXTRA_ENTRIES 与过滤函数已导出");
const PXE = api.PLACE_EXTRA_ENTRIES;
assert(Object.keys(PXE).length === 22, "子入口表覆盖全部 22 组, 实际 " + Object.keys(PXE).length);
assert(Array.isArray(PXE.wraith) && PXE.wraith.length === 0, "象牙怨灵组显式不拆子入口（四套状态机依赖 $wraith.state 与月相，直跳会崩）");
let subTotal = 0, subBadCn = [], subMainDup = [];
Object.keys(PXE).forEach(k => {
  (PXE[k] || []).forEach(it => {
    subTotal++;
    if (typeof it.cn !== "string" || !it.cn.trim()) { subBadCn.push(it.name); }
    const grp = pGroups.find(x => x.group.id === k);
    if (grp && it.name === grp.group.main) { subMainDup.push(it.name); }
  });
});
assert(subTotal === 151, "子入口总条数 151（21 组非空 + wraith 空）, 实际 " + subTotal);
assert(subBadCn.length === 0, "每条子入口都有非空中文标签（汉化硬约束：不许裸英文）, 违规 " + JSON.stringify(subBadCn));
assert(subMainDup.length === 0, "子入口不得与主场景重名（避免同一段两个按钮）, 实际 " + JSON.stringify(subMainDup));
assert(api.mbCEListPlaceEntries(kg).length === 3, "凯拉尔庄园子入口按 mock 段落表过滤后剩 3 条（Manor Garden/Lab/Kylar Room）, 实际 " + JSON.stringify(api.mbCEListPlaceEntries(kg)));
assert(api.mbCEListPlaceEntries(kg)[0].cn === "花园", "子入口中文标签取显式 cn 而非子串拼接, 实际 " + JSON.stringify(api.mbCEListPlaceEntries(kg)[0]));
assert(api.mbCEListPlaceEntries(og).length === 2, "孤儿院阁楼子入口过滤后 2 条（Spray 不在 mock 段落表 → 自动降级）, 实际 " + JSON.stringify(api.mbCEListPlaceEntries(og)));
assert(api.mbCEListPlaceEntries(wf).length === 0, "狼群子入口在 mock 表全缺 → 返回空数组（模组缺段不显示死按钮）, 实际 " + JSON.stringify(api.mbCEListPlaceEntries(wf)));
assert(api.mbCEListPlaceEntries({ group: { id: "no_such_group", main: "X" }, items: [] }).length === 0, "未知组 id 返回空数组且不抛错");
let cn = api.placeNameCN ? api.placeNameCN("Orphanage Loft Kitchen") : "";
assert(typeof cn === "string" && cn.indexOf("厨房") !== -1, "段落名中文提示：厨房, 实际 " + cn);
// teleportTo：无 Engine 时不抛错（setStatus 安全空转）
api.teleportTo("Orphanage Loft");
let played = null;
global.Engine = { play: (name, noHistory) => { played = name + ":" + !!noHistory; } };
api.teleportTo("Mansion Bed");
assert(played === "Mansion Bed:true", "teleportTo 调用 Engine.play(段落,true), 实际 " + played);
api.teleportTo("NotExistScene");
delete global.Engine;
// 10.1) 旧版 Story.passages 兼容路径（非 2.36.1 的 SugarCube）
global.Story = { has: () => false, passages: PLACE_NAMES.map(n => ({ name: n, text: "" })) };
let lapC = api.listAllPassages();
assert(lapC.length === PLACE_NAMES.length, "旧版 Story.passages 兼容路径可用, 实际 " + lapC.length);
assert(api.listPlaceGroups().reduce((s, x) => s + x.items.length, 0) === 39, "兼容路径下场景分组总数不变（v2.0.16 起 39 段）");

// 11) 锚定触发队列 / 回退 / 联动解锁（v1.9.23）：地点触发 + 确认条 + 已完成 + 旧档兼容
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT }].filter(fn) };
const wikiCalls = [];
window.wikifier = (n) => { wikiCalls.push(n); };
let playedBack = null;
global.Engine = { play: (n, h) => { playedBack = n + ":" + !!h; } };
V.passage = "Orphanage";
// 11.1) 未锚定时不干预
const pa1 = { name: "Orphanage" };
api.onPassageOverride(pa1);
assert(pa1.name === "Orphanage" && !V.replayScene && wikiCalls.length === 0, "未锚定时钩子不干预");
// 11.2) 锚定触发：写入队列（mbCE_queue），带地点元数据 + 提示含地点
let robinLine2 = api.listSceneLines(api.getScenesDefs().defs).lines.find(l => /RobinCrossdressing/i.test(l.prefix));
let pinR = api.pinScene(robinLine2.items[1]);
assert(pinR.ok && pinR.message.indexOf("触发地点") !== -1 && Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === "RobinCrossdressing2" && V.mbCE_queue[0].startPassage === "Robin Crossdressing 2" && V.mbCE_queue[0].used === false && V.mbCE_queue[0].anchor && V.mbCE_queue[0].anchor.location === "home", "锚定触发：写入队列带地点元数据+提示, 实际 " + JSON.stringify(V.mbCE_queue));
// 11.2a) 锚定提示含未完成前置（RobinCrossdressing2：跨线前置 RobinIntro1 + 线内 RobinCrossdressing1 未完成 → 提示）
assert(pinR.message.indexOf("前置未完成") !== -1, "锚定提示列出未完成前置, 实际 " + pinR.message);
// 11.2b) 队列顺序：再锚定 2 条，按追加顺序排列
let singles11 = api.listSceneLines(api.getScenesDefs().defs).singles;
let pinB1 = api.pinScene(singles11[0]);
let sec11 = robinLine2.items[2]; /* RobinCrossdressing3（表内 home 元数据）——singles 仅 1 个带元数据场景 */
let pinB2 = api.pinScene(sec11);
assert(pinB1.ok && pinB2.ok && V.mbCE_queue.length === 3 && V.mbCE_queue[1].key === singles11[0].key && V.mbCE_queue[2].key === sec11.key, "锚定队列按追加顺序排列, 实际 " + V.mbCE_queue.map(x => x.key).join());
// 11.2c) 重复锚定同一剧情 → 拒绝不追加
let pinDup = api.pinScene(robinLine2.items[1]);
assert(pinDup.ok === false && V.mbCE_queue.length === 3, "重复锚定 → 拒绝不追加");
// 11.2d) 无地点元数据场景 → 拒绝锚定（旧固定触发入口已移除）
let badMetaPin = api.pinScene({ key: "NoMetaScene", def: { name: "无元数据", startPassage: "NoMetaStart", passages: ["NoMetaStart"], manualVariableChanges: "" } });
assert(badMetaPin.ok === false && badMetaPin.message.indexOf("未标注触发地点") !== -1 && V.mbCE_queue.length === 3, "无地点元数据 → 拒绝锚定, 实际 " + badMetaPin.message);
// 11.3) 锚定项在段落跳转时不再自动触发（旧固定触发已移除）：passageoverride 短路
const pa2 = { name: "Robin Crossdressing 2" };
api.onPassageOverride(pa2);
assert(pa2.name === "Robin Crossdressing 2" && !V.replayScene && !V.mbCE_queue[0].used, "锚定项段落跳转不自动触发（走确认条通道）, 实际 used=" + V.mbCE_queue[0].used);
// 11.4) 走到锚定地点（passageend 判定 V.location）→ 弹确认条；确认触发 → 原版重放通道
V.location = "home"; /* 模拟进入孤儿院（RobinCrossdressing2 锚定地点） */
let ceCalls11 = 0;
let mkNodes11 = []; /* v1.9.23-自查优化：保存全部 createElement 节点，供文案断言（弹条 txt.textContent） */
let mkNode11 = (tag) => { ceCalls11++; const n11 = { tagName: tag, style: {}, className: "", textContent: "", type: "", disabled: false, children: [], listeners: {}, appendChild(c) { this.children.push(c); }, addEventListener(ev, fn) { this.listeners[ev] = fn; }, parentNode: null }; mkNodes11.push(n11); return n11; };
global.document = { createElement: mkNode11, getElementById: () => ({ insertBefore() {}, firstChild: null }), body: {} };
api.mbCEOnPassageEnd();
assert(ceCalls11 === 4, "走到锚定地点 → 弹确认条（DOM 已构建确认条）, createElement=" + ceCalls11);
// 11.4d) 已 used 项走到地点不再弹确认条（「弄完之后还是触发」回归防线：showAnchorPrompt 排除 used 项）
//        （v1.9.23-实机修复五轮：隔离队列只留 used 项——旧用例依赖「队首地点不匹配即 return」这一旧 bug 才不弹；
//          新行为遍历队列弹地点匹配项，队列内其他未用且地点匹配项会正常弹出）
const qBackup11 = V.mbCE_queue.slice();
V.mbCE_queue = [qBackup11[0]];
V.mbCE_queue[0].used = true;
api.mbCEOnPassageEnd();
assert(ceCalls11 === 4, "已 used 项不再弹确认条（播完不再次触发）, createElement=" + ceCalls11);
/* v1.9.23-实机修复六轮：mbCEOnPassageEnd 入口现会幂等清理残留 used 项（cleanupUsedPins：记「已完成 ✓」+移出队列），
   临时队列中的 used 项已被清理，直接恢复原队列即可（不再复位 used）。 */
V.mbCE_queue = qBackup11;
let anchorR = api.startAnchoredReplay(V.mbCE_queue[0]);
assert(anchorR.ok && V.replayScene && V.replayScene.name === "Robin Crossdressing 2" && V.replayScene.exitpassage === "Orphanage", "确认触发 → 原版重放通道, 实际 " + JSON.stringify(V.replayScene));
assert(wikiCalls.indexOf("freezePlayerStats") !== -1, "确认触发调用原版 freezePlayerStats");
assert(V.mbCE_queue[0].used === true, "确认触发后队首标记 used（一次性）");
assert(playedBack === "Robin Crossdressing 2:true", "确认触发 Engine.play 跳转入口, 实际 " + playedBack);
// 11.4b) 防重入：重放进行中再次确认触发（如双击「立即触发」）→ 拒绝且不二次跳转
const playedBefore11b = playedBack;
let anchorR2 = api.startAnchoredReplay(V.mbCE_queue[0]);
assert(anchorR2.ok === false && playedBack === playedBefore11b, "重放中再次触发被拒绝（防重入，双击保护）, 实际 ok=" + anchorR2.ok + " playedBack=" + playedBack);
// 11.5) 重放中 → 不再弹确认条（V.replayScene 短路）；剧情出口（链外段落）→ 出口拦截：清理 + 回原位
const pa4 = { name: "Park" }; /* 剧情出口（不在重放链；原版 redirect 会打回 Scene Viewer End 死循环） */
api.onPassageOverride(pa4);
assert(pa4.name === "Orphanage" && !V.replayScene, "剧情出口（链外段落）→ 出口拦截：清理 + 回原位, 实际 name=" + pa4.name);
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 2, "出口拦截移除已 used 项, 实际 " + V.mbCE_queue.length);
// 11.6) 重放结束（Scene Viewer End）→ 清理 used 项 + 记「已完成 ✓」+ 自动推进下一锚定
const pa5 = { name: "Scene Viewer End" };
api.onPassageOverride(pa5);
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 2 && V.mbCE_queue[0].key === singles11[0].key, "重放结束移除已 used 项（自动推进到下一锚定）, 实际 " + JSON.stringify(V.mbCE_queue));
assert(V.mbCE_completedScenes && V.mbCE_completedScenes["RobinCrossdressing2"] && V.mbCE_completedScenes["RobinCrossdressing2"].name === "Robin Crossdressing 2", "重放结束记入已完成（mbCE_completedScenes）, 实际 " + JSON.stringify(V.mbCE_completedScenes));
// 11.6b) 已完成判定（precondDone）：已完成场景不再计入前置提示
assert(api.precondDone("RobinCrossdressing2") === true, "已完成场景 precondDone=true");
// 11.6c) 再锚定已完成的剧情 → 允许（可再自由锚定）
let repin = api.pinScene(robinLine2.items[1]);
assert(repin.ok && V.mbCE_queue.length === 3 && V.mbCE_queue[2].key === "RobinCrossdressing2", "已完成可再自由锚定, 实际 " + JSON.stringify(V.mbCE_queue));
V.mbCE_queue.splice(2, 1); /* 还原队列为 2 项 */
/* 模拟原版 Scene viewer redirect 收尾（真实游戏中玩家点「结束回放」后由原版执行） */
window.wikifier("unfreezePlayerStats");
delete V.replayScene;
// 11.7) 顺序触发：确认触发队首（TempleSydneyCorrupt）→ used → 再推进下一项
V.location = "temple"; /* TempleSydneyCorrupt 锚定地点 */
api.startAnchoredReplay(V.mbCE_queue[0]);
assert(V.replayScene && V.mbCE_queue[0].used === true, "确认触发队首并重定向其入口（顺序）");
const pa7 = { name: "Scene Viewer End" };
api.onPassageOverride(pa7);
assert(V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === sec11.key, "顺序触发推进：剩最后一项");
// 11.7b) 场景联动解锁：触发悉尼神殿剧情后，神殿组自动解锁（场景页可直达）
assert(V.mbCE_unlockedPlaces && V.mbCE_unlockedPlaces.sydney_temple && V.mbCE_unlockedPlaces.sydney_temple.startPassage === "SV Sydney Temple Corrupt", "场景联动解锁：触发剧情后对应场景组解锁, 实际 " + JSON.stringify(V.mbCE_unlockedPlaces));
window.wikifier("unfreezePlayerStats");
delete V.replayScene;
// 11.8) 回退（指定 key）：取消队列中指定剧情
let unp1 = api.unpinScene(sec11.key);
assert(unp1 && V.mbCE_queue.length === 0, "回退指定剧情 → 队列移除该项");
// 11.4c) SV 注册场景（startPassage="SV xxx" 查看器预览页）锚定触发 → 跳过预览页直接播剧情段
//        （v1.9.23-实机修复：玩家反馈「要的是剧情不是剧情播放器」——原实现 play 预览页会打开查看器入口）
const svDef = { name: "Adult Shop Opening", startPassage: "SV Adult Shop Opening", passages: ["SV Adult Shop Opening", "Adult Shop Opening", "Adult Shop Opening 2", "Adult Shop Opening End 2"], manualVariableChanges: "<<set $location to 'adult_shop'>>" };
let svPin = api.pinScene({ key: "AdultShopOpening", def: svDef });
assert(svPin.ok && V.mbCE_queue.length === 1, "SV 注册场景可锚定, 实际 " + (svPin.message || ""));
const storyBefore4c = global.Story;
/* 预览页段落源码：SVSydney 展示 + Start 链接（原版 SV Adult Shop Opening 形态；SV 链递归验证 SV Temple Confess Purge） */
const svSrcMap = {
	"SV Adult Shop Opening": "<<SVSydney>>\n\n<br><br>\n<<link [[Start|Adult Shop Opening]]>><</link>>",
	"SV Temple Confess Purge": "<<SVSydney>>\n\n<br><br>\n<<link [[Start|SV Temple Confess Purge 2]]>><</link>>",
	"SV Temple Confess Purge 2": "<<SVSydney>>\n\n<br><br>\n<<link [[Start|Temple Confess Purge 2]]>><</link>>"
};
global.Story = { get: (n) => ({ source: svSrcMap[n] || "" }), lookupWith: (fn) => storyBefore4c.lookupWith(fn) };
V.location = "adult_shop";
const ceBefore4c = ceCalls11;
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBefore4c + 4, "SV 场景走到地点 → 弹确认条, createElement 增量=" + (ceCalls11 - ceBefore4c));
const playedBefore4c = playedBack;
let svR = api.startAnchoredReplay(V.mbCE_queue[0]);
assert(svR.ok && playedBack === "Adult Shop Opening:true", "SV 预览页场景触发 → 直接播剧情段（非预览页）, 实际 " + playedBack);
assert(V.replayScene && V.replayScene.startPassage === "Adult Shop Opening" && V.replayScene.passages.length === 4, "replayScene 起点=剧情首段, 实际 " + JSON.stringify(V.replayScene));
assert(V.mbCE_queue[0].used === true, "SV 场景触发后标记 used");
const backTo4c = V.replayScene && V.replayScene.exitpassage;
/* 出口拦截（v1.9.23-实机修复二轮）：剧情出口段（不在重放链）→ 本钩子在原版 redirect 之前接管：
   清理队列 + 标已完成 ✓ + 直接回原位（原版 31683 检测 name 已变 → 采用新 dest，redirect 不再打回 Scene Viewer End 死循环） */
const paSV1 = { name: "Adult Shop" };
api.onPassageOverride(paSV1);
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "SV 场景播完自动移除队列项, 实际 " + V.mbCE_queue.length);
assert(V.mbCE_completedScenes && V.mbCE_completedScenes["AdultShopOpening"], "SV 场景播完标已完成 ✓");
assert(paSV1.name === backTo4c, "SV 剧情出口：直接回原位（exitpassage）, 实际 " + paSV1.name);
/* SV 预览链递归：SV Temple Confess Purge → SV Temple Confess Purge 2 → Temple Confess Purge 2（剧情入口） */
let svChainItem = { key: "TempleConfessPurge", name: "Temple Purge and Confessor Intro", startPassage: "SV Temple Confess Purge", passages: ["SV Temple Confess Purge", "SV Temple Confess Purge 2", "Temple Confess Purge 2"], manualVariableChanges: "", used: false, anchor: { location: "temple" } };
V.mbCE_queue.push(svChainItem);
V.location = "temple";
let svChainR = api.startAnchoredReplay(V.mbCE_queue[V.mbCE_queue.length - 1]);
assert(svChainR.ok && playedBack === "Temple Confess Purge 2:true", "SV 预览链递归直达剧情入口, 实际 " + playedBack);
assert(V.replayScene && V.replayScene.startPassage === "Temple Confess Purge 2", "SV 预览链 replayScene 起点=剧情入口, 实际 " + JSON.stringify(V.replayScene));
const paChain1 = { name: "Danube Street" }; /* 任意剧情出口（不在重放链） */
api.onPassageOverride(paChain1);
assert(V.mbCE_completedScenes && V.mbCE_completedScenes["TempleConfessPurge"], "SV 预览链播完标已完成 ✓");
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "SV 预览链播完队列清空, 实际 " + V.mbCE_queue.length);
assert(paChain1.name !== "Danube Street", "SV 预览链出口：dest 被接管改写回原位, 实际 " + paChain1.name);
/* 死循环出口：「退出场景」（End 段汉化链接 target=Scene Viewer，不在重放链）→ 原版 redirect 会打回 Scene Viewer End 死循环；
   本钩子拦截 → 清理 + 回原位 */
let svLoopItem = { key: "AveryHelicopter", name: "Avery Helicopter", startPassage: "SV Avery Helicopter", passages: ["SV Avery Helicopter", "Avery Helicopter", "Avery Helicopter Drink", "Avery Helicopter Refuse", "Avery Helicopter 2", "Avery Helicopter Nod", "Avery Helicopter Brush", "Avery Helicopter Push", "Avery Helicopter Sex", "Avery Helicopter Sex End", "Avery Helicopter Roll", "Avery Helicopter Slap", "Avery Helicopter Walk"], manualVariableChanges: "", used: false, anchor: { location: "town" } };
V.mbCE_queue.push(svLoopItem);
V.location = "town";
api.startAnchoredReplay(V.mbCE_queue[V.mbCE_queue.length - 1]);
const paLoop1 = { name: "Avery Helicopter Walk" }; /* 剧情中段（在链内）→ 不拦截 */
api.onPassageOverride(paLoop1);
assert(paLoop1.name === "Avery Helicopter Walk" && V.mbCE_queue.length === 1, "剧情中段在链内：本钩子不拦截, 实际 " + JSON.stringify(paLoop1));
const paLoop2 = { name: "Oxford Street" }; /* 剧情出口（不在链内）→ 拦截清理回原位 */
api.onPassageOverride(paLoop2);
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "出口拦截：队列清空, 实际 " + V.mbCE_queue.length);
assert(paLoop2.name !== "Oxford Street", "出口拦截：dest 被接管改写回原位, 实际 " + paLoop2.name);
/* 11.4e) 剧情链播完检测（v1.9.23-实机修复三轮/四轮）：剧情末段出口回链列表内段（如米奇酒吧知名度初见
   Pub Fame Intro 4 剧情分支 Next → Pub Fame Intro，dest 在 passages 内 inChain 恒 true）→ 二轮出口接管不触发、
   播完不清队列。三轮修复：重放期间记录已访问段，已访问段再次到达（循环回点）→ 清理回原位；
   四轮实机补盲（$pubfame 已存在时 4 段走 else 酒吧选项、无循环出口）：到达剧情末段且前置链内段全访问
   = 剧情线性播完（落地点）→ 清理回原位，不等玩家点选项。分支型场景前置未全访问 → 不触发不误伤。 */
let pubFameItem = { key: "MickeyPubFameIntro", name: "Mickey Pub Fame Intro", startPassage: "SV Pub Fame Intro", passages: ["SV Pub Fame Intro", "Pub Fame Intro", "Pub Fame Intro 2", "Pub Fame Intro 3", "Pub Fame Intro 4"], manualVariableChanges: "", used: false, anchor: { location: "pub" } };
V.mbCE_queue.push(pubFameItem);
V.location = "pub";
let pubFameR = api.startAnchoredReplay(V.mbCE_queue[V.mbCE_queue.length - 1]);
assert(pubFameR.ok, "米奇酒吧知名度初见：锚定触发成功");
let pfExit = V.replayScene.exitpassage;
/* 触发入口段：startAnchoredReplay 的 play(entry) 实机触发 :passageoverride → visited 记录入口段（模拟） */
const paEntry = { name: "SV Pub Fame Intro" };
api.onPassageOverride(paEntry);
assert(paEntry.name === "SV Pub Fame Intro", "入口段记录 visited 不拦截, 实际 " + paEntry.name);
/* 第一次链内播放：Intro → 2 → 3（均首次访问，不拦截） */
["Pub Fame Intro", "Pub Fame Intro 2", "Pub Fame Intro 3"].forEach(function (seg) {
	let paSeg = { name: seg };
	api.onPassageOverride(paSeg);
	assert(paSeg.name === seg, "链内段首次访问不拦截, 实际 " + paSeg.name);
});
/* 到达剧情末段 Pub Fame Intro 4（前置链内段全访问 = 剧情线性播完 → 清理 + 回原位，不等玩家点酒吧选项） */
const paLoop3 = { name: "Pub Fame Intro 4" };
api.onPassageOverride(paLoop3);
assert(!V.replayScene, "剧情线性播完：重放已清理（播完自动完成）, 实际 " + JSON.stringify(V.replayScene));
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "剧情线性播完：队列清空, 实际 " + V.mbCE_queue.length);
assert(V.mbCE_completedScenes && V.mbCE_completedScenes["MickeyPubFameIntro"], "剧情线性播完：标已完成 ✓");
assert(paLoop3.name === pfExit, "剧情线性播完：dest 接管改写回原位, 实际 " + paLoop3.name);
/* 11.4f) 跨地点残留确认条清理（v1.9.23-实机修复五轮）：弹条后未点按钮直接离开触发地点（酒吧→麋鹿街），
   fixed 条跨段残留 → :passageend 自动收起，不重弹（玩家反馈「取消锚定之后立即触发并没有消失」画面证据） */
V.mbCE_queue = [{ key: "PubLead", name: "酒吧主线", startPassage: "PubA", passages: ["PubA"], used: false, anchor: { location: "pub" } }];
V.location = "pub";
const ceBeforeF = ceCalls11;
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeF + 4, "pub 落地弹确认条, createElement 增量=" + (ceCalls11 - ceBeforeF));
V.location = "park"; /* 未点按钮离开 */
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeF + 4, "离开触发地点：残留确认条自动收起（不重弹）, createElement 增量=" + (ceCalls11 - ceBeforeF));
// 11.4g) 队首地点不匹配 → 遍历队列找地点匹配项（玩家反馈「暂不触发后其他锚定的立即触发不出现」根因：
//        旧实现只取队首、location 不匹配即 return → 后续锚定永远不弹）
V.mbCE_queue = [
	{ key: "PubLead", name: "酒吧主线", startPassage: "PubA", passages: ["PubA"], used: false, anchor: { location: "pub" } },
	{ key: "TempleSecond", name: "神殿二线", startPassage: "TempleB", passages: ["TempleB"], used: false, anchor: { location: "temple" } }
];
V.location = "temple";
const ceBeforeG = ceCalls11;
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeG + 4, "队首地点不匹配 → 遍历到神殿项（location 匹配）→ 弹确认条, 增量=" + (ceCalls11 - ceBeforeG));
/* 取消锚定当前条对应 key → 残留条一并收起（「取消锚定后立即触发没消失」修复：unpinScene 收起展示中的条） */
api.unpinScene("TempleSecond");
api.mbCEOnPassageEnd(); /* 再来一段落地：条已随取消锚定收起，不重弹 */
assert(ceCalls11 === ceBeforeG + 4, "取消锚定后残留确认条收起（不重弹）, 增量=" + (ceCalls11 - ceBeforeG));
/* 11.4h) 同地点多锚定：A 正展示中 → 同地点 B 仍正常弹出（v1.9.23-自查优化：原实现找到 A 后
   anchorPromptActive(A) return——A 暂不触发（1h 冷却）或展示中时，同地点后续锚定永不弹，
   「暂不触发后其他锚定不弹」的同地点残余路径；现改为冷却/展示中的项 continue 找下一个匹配） */
V.mbCE_queue = [
	{ key: "PubLead", name: "酒吧主线", startPassage: "PubA", passages: ["PubA"], used: false, anchor: { location: "pub" } },
	{ key: "PubSecond", name: "酒吧二线", startPassage: "PubB", passages: ["PubB"], used: false, anchor: { location: "pub" } }
];
V.location = "pub";
const ceBeforeH = ceCalls11;
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeH + 4, "同地点首锚定 A 弹确认条, 增量=" + (ceCalls11 - ceBeforeH));
api.mbCEOnPassageEnd(); /* A 展示中 → 遍历跳过 A → 弹同地点 B（修复前 return 拦截不弹） */
assert(ceCalls11 === ceBeforeH + 8, "A 展示中：同地点 B 正常弹出（不被 A 拦截）, 增量=" + (ceCalls11 - ceBeforeH));
/* 11.4i) 弹条文案：无前置要求的锚定不显示「前置均已达成」（触发前置 ≠ 完成条件，
   13_17 截图「前置均已达成」与面板「要求：未达成（条件未满足）」同屏矛盾的文案误导消除） */
V.mbCE_queue = [{ key: "PubLead", name: "酒吧主线", startPassage: "PubA", passages: ["PubA"], used: false, anchor: { location: "pub" } }];
V.location = "pub";
const ceBeforeI = ceCalls11;
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeI + 4, "pub 落地弹确认条（文案断言前）, 增量=" + (ceCalls11 - ceBeforeI));
const anchorBoxI = mkNodes11[mkNodes11.length - 4]; /* 最后一次弹条：createElement 顺序 box/txt/go/skip */
const anchorTxtI = anchorBoxI.children[0] ? anchorBoxI.children[0].textContent : "";
assert(typeof anchorTxtI === "string" && anchorTxtI.indexOf("前置均已达成") === -1 && anchorTxtI.indexOf("触发前置：无") !== -1,
	"弹条文案：无前置要求显示「触发前置：无」而非「前置均已达成」, 实际 " + anchorTxtI);
/* 11.4j) 暂不触发 60s 冷却（用户拍板 1h→60s）：skip 后冷却内同地点不再弹，60s 后恢复可弹 */
api.unpinScene("PubLead"); /* 清 11.4i 遗留展示态（内存确认条），避免干扰冷却用例 */
V.mbCE_queue = [{ key: "PubLead", name: "酒吧主线", startPassage: "PubA", passages: ["PubA"], used: false, anchor: { location: "pub" } }];
V.location = "pub";
const ceBeforeJ = ceCalls11;
const realNowJ = Date.now;
let fakeNowJ = 1000000;
global.Date.now = () => fakeNowJ; /* 临时接管真实时间，隔离冷却测试 */
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeJ + 4, "pub 落地弹确认条（skip 前）, 增量=" + (ceCalls11 - ceBeforeJ));
const skipBtnJ = mkNodes11[mkNodes11.length - 1]; /* createElement 顺序 box/txt/go/skip → skip 是最后一个 */
skipBtnJ.listeners.click(); /* 模拟点「暂不触发」→ 写 60s 冷却 + 收起条 */
assert(ceCalls11 === ceBeforeJ + 4, "暂不触发：条已收起（冷却写入）, 增量=" + (ceCalls11 - ceBeforeJ));
api.mbCEOnPassageEnd(); /* 冷却内（<60s）同地点不再弹 */
assert(ceCalls11 === ceBeforeJ + 4, "冷却内（60s 未到）同地点不再弹, 增量=" + (ceCalls11 - ceBeforeJ));
fakeNowJ += 61000; /* 61s 后冷却过期 */
api.mbCEOnPassageEnd();
assert(ceCalls11 === ceBeforeJ + 8, "61s 后冷却过期：同地点恢复弹条, 增量=" + (ceCalls11 - ceBeforeJ));
global.Date.now = realNowJ;
V.mbCE_queue = []; /* 还原 */
/* 手动重放护栏：mbCE_replayOnce 未设（原版查看器播放）→ 出口不拦截（交原版 redirect），End 由 823 分支按原版行为处理 */
const manualBackup = V.replayScene;
V.mbCE_replayOnce = undefined;
const paMan1 = { name: "Danube Street" };
api.onPassageOverride(paMan1);
assert(paMan1.name === "Danube Street", "手动重放：剧情出口不拦截（原版 redirect 处理）, 实际 " + paMan1.name);
const paMan2 = { name: "Scene Viewer End" };
api.onPassageOverride(paMan2);
assert(paMan2.name === "Scene Viewer End", "手动重放：Scene Viewer End 不改 dest（原版行为）, 实际 " + paMan2.name);
V.mbCE_replayOnce = true;
window.wikifier("unfreezePlayerStats");
delete V.replayScene;
global.Story = storyBefore4c;
window.wikifier("unfreezePlayerStats");
delete V.replayScene;
// 11.9) 回退（无参）：清空队列 + 结束重放（unfreeze + 回原位）
let pinS2 = api.pinScene(robinLine2.items[0]);
V.location = "home";
api.startAnchoredReplay(V.mbCE_queue[0]);
assert(V.replayScene && V.mbCE_queue[0].used, "锚定+触发（为回退造重放现场）");
let unp2 = api.unpinScene();
assert(unp2 && V.mbCE_queue.length === 0 && !V.replayScene, "无参回退：清空队列并结束重放");
assert(wikiCalls.indexOf("unfreezePlayerStats") !== -1, "回退时调用原版 unfreezePlayerStats");
assert(playedBack === "Orphanage:true", "回退后 Engine.play 返回原位, 实际 " + playedBack);
// 11.10) 缺入口段落 → 锚定失败不写入
let badPin = api.pinScene({ key: "X", def: { name: "X", passages: [], startPassage: "" } });
assert(badPin.ok === false && V.mbCE_queue.length === 0, "缺入口段落 → 锚定失败不写入");
// 11.11) 旧版兼容迁移：v1.1 mbCE_pinned → 队列（视为已触发过，不再触发）
V.mbCE_pinned = { key: "OLD", name: "旧固定", startPassage: "OldStart", passages: [], manualVariableChanges: "", active: true };
const pa9 = { name: "Elsewhere" };
api.onPassageOverride(pa9);
assert(pa9.name === "Elsewhere" && !V.replayScene, "旧 mbCE_pinned 迁移为 used → 不触发");
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === "OLD" && V.mbCE_queue[0].used === true, "旧 mbCE_pinned 并入队列且 used");
// 11.12) 旧档无地点元数据队列项 → 保持旧段落跳转语义（任意推进即触发）直至触发完
V.mbCE_queue = [{ key: "OLD2", name: "旧档项", startPassage: "Old2Start", passages: [], manualVariableChanges: "", used: false }];
const pa10 = { name: "Anywhere" };
api.onPassageOverride(pa10);
assert(pa10.name === "Old2Start" && V.replayScene && V.mbCE_queue[0].used === true, "旧档无元数据项保持旧语义触发, 实际 " + pa10.name);
delete V.replayScene;
delete V.mbCE_completedScenes;
delete V.mbCE_pinned;
delete V.mbCE_queue;
delete V.mbCE_unlockedPlaces;
delete global.Engine;
delete global.document;

// 12) 阶段回退（v1.2）：只撤销面板写入的标记，真实达成拒绝回退
// 12.1) 框架恋爱 set 类：一键完成 → 记录痕迹 → 回退撤销 → 复检未达成
V.WraithsReflection = 0;
V.mbCE_wrote = {};
let wr12 = api.getRomanceStages("Ivory Wraith");
let wrC = api.completeRomanceStage("Ivory Wraith", wr12[0]);
assert(wrC.ok && V.WraithsReflection === 1 && V.mbCE_wrote && V.mbCE_wrote["set:WraithsReflection:1"], "一键完成写入并记录痕迹, 实际 " + JSON.stringify(V.mbCE_wrote));
let wrU = api.undoRomanceStage("Ivory Wraith", wr12[0]);
assert(wrU === true && !("WraithsReflection" in V), "回退撤销 set 类写入（变量删除）");
assert(!V.mbCE_wrote["set:WraithsReflection:1"], "回退后清除写入痕迹");
// 12.2) 真实达成（无面板痕迹）→ 拒绝回退，进度不破坏
V.gwylanSeen = ["partners"];
V.mbCE_wrote = {};
let realStage = { text: '() => rv.variables.gwylanSeen?.includes("partners")', native: false, fn: () => true };
let realU = api.undoRomanceStage("Gwylan", realStage);
assert(realU === false && V.gwylanSeen.indexOf("partners") !== -1, "真实达成（无痕迹）拒绝回退，进度不破坏");
delete V.gwylanSeen;
// 12.3) 原生恋爱（loveInterest 兜底）：一键完成加入卡槽 → 痕迹 → 回退移除槽位
V.loveInterest = [];
V.mbCE_wrote = {};
let ad12 = api.getRomanceStages("阿电");
let adC = api.completeRomanceStage("阿电", ad12[0]);
assert(adC.ok && V.loveInterest.indexOf("阿电") !== -1 && V.mbCE_wrote["romance:native:阿电"], "原生恋爱一键完成并记录痕迹");
let adU = api.undoRomanceStage("阿电", ad12[0]);
assert(adU === true && V.loveInterest.indexOf("阿电") === -1, "原生恋爱回退：loveInterest 槽位移除");
delete V.loveInterest;
// 12.4) 原版恋爱阶段：一键完成 → 回退 → 经历标记移除
V.mbCE_wrote = {};
V.gwylanSeen = [];
V.gwylan = { wary: 0 };
let vr = api.completeVanillaStage("Gwylan", "ritual_sex");
assert(vr.ok && V.gwylanSeen.indexOf("ritual_sex") !== -1 && V.mbCE_wrote["vanilla:ritual_sex"], "原版阶段一键完成并记录痕迹");
let vu = api.undoVanillaStage("Gwylan", "ritual_sex");
assert(vu.ok && V.gwylanSeen.indexOf("ritual_sex") === -1, "原版阶段回退：经历标记移除");
// 12.5) 原版真实达成 → 拒绝回退
V.mbCE_wrote = {};
V.gwylanSeen = ["ritual_sex"];
let vu2 = api.undoVanillaStage("Gwylan", "ritual_sex");
assert(vu2.ok === false, "原版真实达成（无痕迹）拒绝回退");
delete V.gwylanSeen;
delete V.gwylan;
delete V.mbCE_wrote;

// 13) 修正（v1.2.1）：SugarCube 命名空间 Engine + 农场防崩
// 13.1) teleportTo 经 window.SugarCube.Engine 通道工作（SugarCube 2.36.1 的 Engine 不在 window 顶层）
global.Story = { has: (n) => n === "Manor Bed", lookupWith: () => [] };
window.SugarCube = { Engine: { play: (n, h) => { playedBack = n + ":" + !!h; } } };
api.teleportTo("Manor Bed");
assert(playedBack === "Manor Bed:true", "teleportTo 经 window.SugarCube.Engine 通道, 实际 " + playedBack);
// 13.1b) teleportTo 的农场兜底：farm_stage 已推进且 $farm 缺失 → 建空壳（模拟用户档状态，社交页不崩）
V.farm_stage = 2; delete V.farm;
api.teleportTo("Manor Bed");
assert(V.farm && V.farm.beasts && V.farm.beasts.horses === 0 && V.farm.clearing === 100, "teleportTo 触发农场兜底（farm_stage>=1 建空壳）");
// 13.2) 农场依赖剧情（Scene Viewer passages + farm_work_update）：$farm 未初始化 → 锚定被拒（防崩）
delete V.farm; delete V.farm_stage;
let farmPin = api.pinScene({ key: "AlexFarmWorkStage3", def: { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], manualVariableChanges: "<<set $sceneViewSwitch to 'AlexFarmWorkStage3'>><<farm_work_update>>" } });
assert(farmPin.ok === false && farmPin.message.indexOf("农场") !== -1 && (V.mbCE_queue === undefined || V.mbCE_queue.length === 0), "农场剧情 $farm 缺失 → 锚定被拒（防崩分支）, 实际 " + JSON.stringify(farmPin));
// 13.3) 农场依赖剧情：$farm 初始化后允许锚定
V.farm = {};
let farmPin2 = api.pinScene({ key: "AlexFarmWorkStage3", def: { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], manualVariableChanges: "<<set $sceneViewSwitch to 'AlexFarmWorkStage3'>><<farm_work_update>>" } });
assert(farmPin2.ok === true, "$farm 存在 → 可锚定");
// 13.4) onPassageOverride：锚定项（带地点元数据）在段落跳转时不自动触发（走确认条通道，不崩）
V.farm = undefined;
let paF = { name: "Elsewhere" };
api.onPassageOverride(paF);
assert(paF.name === "Elsewhere" && !V.replayScene, "农场剧情 $farm 缺失 → 触发被拦（不崩）");
delete V.farm;
delete V.mbCE_queue;
delete window.SugarCube;

// 14) 修正（v1.2.1）：$avery_mansion/$avery_tower 缺失兜底（艾弗里庄园/森林商店直达防崩）
// 14.1) 直达前兜底：V.avery_mansion 缺失 → teleportTo 建立结构（schedule/jobs/party_state 存在，不崩）
V.avery_mansion = undefined; V.avery_tower = undefined;
global.Story = { has: (n) => n === "Manor Bed", lookupWith: () => [] };
window.SugarCube = { Engine: { play: (n, h) => { playedBack = n + ":" + !!h; } } };
api.teleportTo("Manor Bed");
assert(V.avery_mansion && V.avery_mansion.schedule === "home" && Array.isArray(V.avery_mansion.jobs) && V.avery_mansion.party_state === "waiting", "直达前 $avery_mansion 空壳生成（schedule/jobs/party_state）");
assert(V.avery_tower && V.avery_tower.stage === 0, "$avery_tower 空壳生成（stage）");
// 14.2) 幂等：已有对象不覆盖
V.avery_mansion.my_progress = 42;
api.teleportTo("Manor Bed");
assert(V.avery_mansion.my_progress === 42 && V.avery_mansion.schedule === "home", "已有 $avery_mansion 不被覆盖（幂等）");
// 14.3) 固定触发艾弗里剧情前兜底：$avery_mansion 缺失 → onPassageOverride 触发时建立
delete V.avery_mansion; delete V.avery_tower;
V.mbCE_queue = [{ key: "AVERY", name: "Avery Mansion", startPassage: "Mansion Bed", passages: ["Mansion Bedroom"], manualVariableChanges: "<<set $sceneViewSwitch to 'avery_mansion'>>", used: false }];
let paA = { name: "Elsewhere" };
api.onPassageOverride(paA);
assert(paA.name === "Mansion Bed" && V.avery_mansion && V.avery_mansion.schedule === "home", "固定触发前 $avery_mansion 兜底并跳转入口");
delete V.avery_mansion; delete V.avery_tower; delete V.mbCE_queue; delete V.replayScene;
delete window.SugarCube;
delete global.Story;

// 14.4) 修正（v1.3.3）：daily.avery 已存在但 talk 缺失 → ensureAveryMansion 逐层补 talk（Mansion Talk 读 talk.chat/talk.ignore 防崩）
V.avery_mansion = { version: 5, schedule: "home" };
V.avery_tower = { stage: 0 };
V.daily = { avery: {} };
api.ensureAveryMansion();
assert(V.daily.avery.talk && V.daily.avery.talk.chat === 0 && V.daily.avery.talk.ignore === false && V.daily.avery.talk.annoyed === 0 && V.daily.avery.talk.chat_limit === 3, "daily.avery 存在但 talk 缺失 → 补全 talk（chat=" + (V.daily.avery.talk && V.daily.avery.talk.chat) + " ignore=" + (V.daily.avery.talk && V.daily.avery.talk.ignore) + "）");
// 14.5) 幂等：talk/ask 已有值不覆盖
V.daily.avery.talk.chat = 2;
V.daily.avery.ask.science = true;
api.ensureAveryMansion();
assert(V.daily.avery.talk.chat === 2 && V.daily.avery.ask.science === true, "talk/ask 已有值不被覆盖（幂等）");
delete V.avery_mansion; delete V.avery_tower; delete V.daily;

// 15) 修正（v1.3）：世界入口解锁 + 循环修复 + 剧情线合并
// 15.1) 世界入口解锁：直达/触发后写入原版进入条件变量
V.mbCE_unlockedPlaces = {};
api.applyWorldUnlock("kylar_manor");
api.applyWorldUnlock("orphanage_loft");
api.applyWorldUnlock("sirris_places");
assert(V.syndromekylar === 1 && V.loft_known === 1 && V.adultshopstate === "open", "世界入口变量写入: syndromekylar=" + V.syndromekylar + " loft_known=" + V.loft_known + " adultshopstate=" + V.adultshopstate);
// 15.2) 幂等：已有更高值不降级
V.syndromekylar = 5;
api.applyWorldUnlock("kylar_manor");
assert(V.syndromekylar === 5, "已有更高 syndromekylar 不降级");
delete V.syndromekylar; delete V.loft_known; delete V.adultshopstate;
// 15.3) 循环修复：首次进入 Scene Viewer passages 消费 pending 且保留 sceneViewSwitch（case 正常播放）
V.mbCE_replayPending = true;
V.sceneViewSwitch = "AlexFarmWorkStage3";
V.replayScene = { exitpassage: "Danube Street" };
V.mbCE_replayOnce = true;
api.mbCEOnPassageInit("Scene Viewer passages");
assert(V.mbCE_replayPending === false && V.sceneViewSwitch === "AlexFarmWorkStage3", "首次进入保留 sceneViewSwitch（播放）");
// 15.4) 剧情结束链回 → 清 sceneViewSwitch 走 default（不再重播）
api.mbCEOnPassageInit("Scene Viewer passages");
assert(V.sceneViewSwitch === "MB_CE_END", "再次进入清 sceneViewSwitch（退出不重播）");
// 15.5) 无关段落不处理
V.sceneViewSwitch = "keep";
api.mbCEOnPassageInit("Manor Hall");
assert(V.sceneViewSwitch === "keep", "非 Scene Viewer passages 段落不影响");
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending;
// 15.6) 固定触发启动时设重放标记 + 世界解锁
delete V.mbCE_queue;
V.mbCE_queue = [{ key: "KYLAR", name: "Kylar Manor", startPassage: "Manor Hall", passages: ["Manor Bedroom"], manualVariableChanges: "", used: false }];
let paK = { name: "Elsewhere" };
api.onPassageOverride(paK);
assert(V.mbCE_replayOnce === true && V.mbCE_replayPending === false && V.syndromekylar === 1, "触发设重放标记并写世界入口 syndromekylar=" + V.syndromekylar + " pending(直入段落不设)=" + V.mbCE_replayPending);
// 15.7) 取消固定（重放中）→ 清 sceneViewSwitch（防被困播放器）+ 返回原位（Engine 可用路径）
V.sceneViewSwitch = "AlexFarmWorkStage3";
V.replayScene = { exitpassage: "Danube Street" }; /* v1.9.5-自检：补重放中状态；并显式 mock Engine——无 Engine 时新防御保留 replayScene（Back 有源）属正确行为，不在此断言 */
var played15 = "";
global.Engine = { play: function (n, h) { played15 = n + ":" + !!h; } };
api.unpinScene();
assert(V.sceneViewSwitch === "MB_CE_END" && !V.replayScene, "取消固定清 sceneViewSwitch 与 replayScene");
assert(played15 === "Danube Street:true", "15.7 Engine.play 跳回原位（Danube Street）, 实际 " + played15);
delete global.Engine;
// 15.8) 固定整线：全部阶段按顺序入队
delete V.mbCE_queue;
let line = { prefix: "AlexFarmWorkStage", items: [
  { key: "AlexFarmWorkStage3", num: 3, def: { name: "Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], manualVariableChanges: "<<set $sceneViewSwitch to 'AlexFarmWorkStage3'>>" } },
  { key: "AlexFarmWorkStage4", num: 4, def: { name: "Stage 4", startPassage: "Scene Viewer passages", passages: ["Farm Stage 4"], manualVariableChanges: "<<set $sceneViewSwitch to 'AlexFarmWorkStage4'>>" } }
]};
let lr = api.pinSceneLine(line);
assert(lr.ok && V.mbCE_queue.length === 2 && V.mbCE_queue[0].key === "AlexFarmWorkStage3" && V.mbCE_queue[1].key === "AlexFarmWorkStage4", "固定整线按顺序入队, " + JSON.stringify(lr.message));
delete V.mbCE_queue;
// 15.9) 场景组：格威岚匹配扩展（森林商店等恋爱阶段段落进组）
global.Story = { has: (n) => false, lookupWith: (fn) => [{ name: "Gwylan Ritual Start Garden" }, { name: "Forest Shop Entrance" }, { name: "Pregnancy Birth Forest Shop" }] };
let pgs = api.listPlaceGroups();
let gwg = pgs.filter((g) => g.group.id === "gwylan_garden")[0];
assert(gwg && gwg.items.length === 3, "格威岚组含森林商店等段落, items=" + (gwg ? gwg.items.length : "none"));
// 15.9b) 新 6 组主场景名中文化映射（v1.9.23-实机修复：场景直达「主场景 X ★（中文）」）
assert(js.indexOf('"asylum": "精神病院"') !== -1 && js.indexOf('"police": "警局与监狱"') !== -1
  && js.indexOf('"hospital": "医院"') !== -1 && js.indexOf('"wolf": "狼群"') !== -1,
  "新 6 组主场景名中文化映射已入构建产物（主场景行 placeNameCN 生效）");
delete global.Story;
// 15.10) 农场剧情逃逸终点（Farm Work）→ 清理残留重放，后续项可触发；其它链外段落仍视为重放中不干预
V.replayScene = { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = false;
V.mbCE_queue = [{ key: "FARM4", name: "Farm Stage 4", startPassage: "Scene Viewer passages", passages: ["Farm Stage 4"], manualVariableChanges: "", used: false }];
let paL = { name: "Farm Work" };
api.onPassageOverride(paL);
assert(paL.name === "Scene Viewer passages" && V.replayScene && V.replayScene.name === "Farm Stage 4" && V.mbCE_replayPending === true, "Farm Work 终点清理残留并启动下一项重放, paL.name=" + paL.name);
// 15.10b) 重放中走到链外段落（不在注册表）→ 原版 redirect 语义即"剧情结束"→ 出口拦截：清理队列 + 回原位（v1.9.23-实机修复）
V.replayScene = { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true;
V.mbCE_queue = [{ key: "FARM4", name: "Farm Stage 4", startPassage: "Scene Viewer passages", passages: ["Farm Stage 4"], manualVariableChanges: "", used: false }];
let paLb = { name: "Farm Barn" };
api.onPassageOverride(paLb);
assert(paLb.name === "Danube Street" && !V.replayScene, "链外段落（不在注册表）→ 出口拦截：清理 + 回原位, 实际 name=" + paLb.name);
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === "FARM4", "未触发队列项不被误删, 实际 " + V.mbCE_queue.length);
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.mbCE_queue;
// 15.10c) 农场终点清理同时移除已触发项（整线依次推进，队尾不残留）
V.replayScene = { name: "Farm Stage 4", startPassage: "Scene Viewer passages", passages: ["Farm Stage 4"], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true;
V.mbCE_queue = [{ key: "FARM3", name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: [], manualVariableChanges: "", used: true }, { key: "FARM5", name: "Farm Stage 5", startPassage: "Scene Viewer passages", passages: [], manualVariableChanges: "", used: false }];
let paLc = { name: "Farm Work" };
api.onPassageOverride(paLc);
assert(V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === "FARM5" && V.mbCE_queue[0].used === true && V.replayScene && V.replayScene.name === "Farm Stage 5", "Farm Work 终点移除已触发项并连续触发下一项, 剩余=" + V.mbCE_queue.map(x => x.key + ":" + x.used).join());
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.mbCE_queue;
// 15.11) 原版手动重放不干预：无 mbCE_replayOnce → override 不触发、不清理
V.replayScene = { name: "Manual", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], exitpassage: "Danube Street" };
delete V.mbCE_replayOnce;
V.mbCE_queue = [{ key: "M", name: "M", startPassage: "Manor Hall", passages: [], manualVariableChanges: "", used: false }];
let paM = { name: "Farm Work" };
api.onPassageOverride(paM);
assert(paM.name === "Farm Work" && V.replayScene && V.replayScene.name === "Manual", "原版手动重放不干预");
delete V.replayScene; delete V.mbCE_queue;
// 15.12) 直达 Scene Viewer passages 设完整 replayScene（default 退出分支需要 exitpassage）
global.Story = { has: (n) => n === "Scene Viewer passages", lookupWith: () => [] };
window.SugarCube = { Engine: { play: (n, h) => { playedBack = n + ":" + !!h; } } };
V.passage = "Danube Street";
api.teleportTo("Scene Viewer passages");
assert(V.replayScene && V.replayScene.exitpassage === "Danube Street" && V.mbCE_replayPending === true, "直达 Scene Viewer passages 设 replayScene/exitpassage");
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending;
delete window.SugarCube; delete global.Story; delete V.passage;

// 16) 农场状态兜底（v1.3.1）：社交页 $farm_stage gte 2 时读 $farm.beasts/aggro
// 16.1) farm_stage 已推进但 $farm 缺失 → 补空壳（beasts 四类/wage/clearing/milking/build_finished）
delete V.farm;
V.farm_stage = 2;
api.ensureFarmState();
assert(V.farm && V.farm.beasts && V.farm.beasts.horses === 0 && V.farm.beasts.pigs === 0 && V.farm.beasts.cattle === 0 && V.farm.beasts.dogs === 0 && V.farm.wage === 15 && V.farm.clearing === 100, "farm_stage>=1 且 $farm 缺失 → 补空壳, wage=" + (V.farm && V.farm.wage));
assert(V.farm.milking && V.farm.milking.catchChance === 0 && Array.isArray(V.farm.build_finished), "空壳含 milking 与 build_finished（farm_update 字段）");
// 16.2) 已存在 → 不覆盖已有进度
V.farm.beasts.horses = 25;
V.farm.clearing = 66;
api.ensureFarmState();
assert(V.farm.beasts.horses === 25 && V.farm.clearing === 66, "已有 $farm 不覆盖（幂等）");
// 16.3) 存在但缺 beasts → 只补 beasts，不覆盖
V.farm.beasts = undefined;
api.ensureFarmState();
assert(V.farm.beasts && V.farm.beasts.horses === 0 && V.farm.clearing === 66, "缺 beasts 时补结构不覆盖其它值");
// 16.4) farm_stage 未推进 → 不建 $farm
delete V.farm;
V.farm_stage = 0;
api.ensureFarmState();
assert(V.farm === undefined, "farm_stage<1 不建 $farm");
delete V.farm; delete V.farm_stage;
// 16.5) 一键完成亚历克斯农场阶段（恋爱条件含 farm_stage）→ 写 $farm_stage 后自动补 $farm 空壳（社交页防崩）
let alexStage = { text: "State.variables.farm_stage >= 2", native: false, fn: () => true };
let ar = api.completeRomanceStage("Alex", alexStage);
assert(ar.fixed === true && V.farm_stage === 2 && V.farm && V.farm.beasts && V.farm.beasts.horses === 0, "写 farm_stage 后自动补 $farm 空壳, fixed=" + ar.fixed);
// 16.6) 全局一键恋爱完成后兜底（globalRomance 路径）
delete V.farm; delete V.farm_stage; delete V.mbCE_wrote;
global.Story = { has: (n) => false, lookupWith: (fn) => [] };
let gr = api.globalRomance();
assert(V.farm_stage >= 2 && V.farm && V.farm.beasts && V.farm.beasts.horses === 0, "globalRomance 后 $farm 已兜底, farm_stage=" + V.farm_stage);
delete global.Story;
delete V.farm; delete V.farm_stage;
// 16.7) farm_stage>=1 且 $farm 缺失 → 空壳含 stock（本体 farm_stock_init 四字段，睡觉结算防崩）
delete V.farm;
V.farm_stage = 2;
api.ensureFarmState();
assert(V.farm && V.farm.stock && V.farm.stock.truffles === 0 && V.farm.stock.eggs === 0 && V.farm.stock.milk === 0 && V.farm.stock.cream === 0, "空壳含 stock 四字段（farm_stock 结算防崩）, stock=" + JSON.stringify(V.farm.stock));
// 16.8) $farm 已存在但缺 stock → 只补 stock，不覆盖已有值（幂等）
V.farm.stock = undefined;
V.farm.clearing = 66;
api.ensureFarmState();
assert(V.farm.stock && V.farm.stock.truffles === 0 && V.farm.clearing === 66, "缺 stock 时补全且不覆盖已有值, clearing=" + V.farm.clearing);
// 16.9) 模拟本体 <<farm_stock>> widget 结算（$farm.stock[_args[0]] += n）不再抛错
V.farm.stock.truffles += 3;
assert(V.farm.stock.truffles === 3, "farm_stock 累加路径可正常执行（不再 reading 'truffles'）, truffles=" + V.farm.stock.truffles);
delete V.farm; delete V.farm_stage;

// 17) 格威岚场景临时变量兜底（v1.3.5）：新存档场景直达崩 _gwylanStatus/_gwylanTF → passageinit 全局补齐
// 17.1) 新存档（未见过格威岚，V.gwylan* 缺失）：ensureGwylanSceneState 补 T.gwylanStatus 数组 + T.gwylanTF 默认隐藏态四字段
delete V.gwylan; delete V.gwylanSeen; delete V.gwylanTalked;
State.temporary = {};
api.ensureGwylanSceneState();
assert(Array.isArray(State.temporary.gwylanStatus), "新存档兜底：T.gwylanStatus 为数组, 实际 " + JSON.stringify(State.temporary.gwylanStatus));
assert(State.temporary.gwylanTF && State.temporary.gwylanTF.ears === "hidden" && State.temporary.gwylanTF.tail === "hidden" && State.temporary.gwylanTF.fangs === "hidden" && State.temporary.gwylanTF.known === false, "新存档兜底：T.gwylanTF 默认隐藏态四字段, 实际 " + JSON.stringify(State.temporary.gwylanTF));
// 17.2) 幂等：已有 T.gwylanTF/status 不覆盖
State.temporary.gwylanTF = { ears: "revealed", tail: "fake", fangs: "fake", known: true };
State.temporary.gwylanStatus = ["heat"];
api.ensureGwylanSceneState();
assert(State.temporary.gwylanTF.ears === "revealed" && State.temporary.gwylanTF.known === true && State.temporary.gwylanStatus.join() === "heat", "已有 T.gwylanTF/status 不被覆盖（幂等）");
// 17.3) 模拟本体段落读取不再崩：_gwylanStatus.includes / _gwylanTF.tail 路径（includesAny 崩溃实为数组缺失）
assert(State.temporary.gwylanStatus.includes("wounded") === false, "T.gwylanStatus 可安全执行 includes 判定");
assert(State.temporary.gwylanTF.tail !== "revealed", "T.gwylanTF.tail 可安全比较（isnot revealed）");
// 17.4) mbCEOnPassageInit 全局兜底：任意段落进入都补齐（含用户报错归属的 Danube Street）
State.temporary = {};
api.mbCEOnPassageInit("Danube Street");
assert(Array.isArray(State.temporary.gwylanStatus) && State.temporary.gwylanTF && State.temporary.gwylanTF.tail === "hidden", "mbCEOnPassageInit 对任意段落补齐（Danube Street 亦覆盖）");
// 17.5) 场景查看器段落逻辑不回归（v1.3 无限循环修复仍生效）
V.mbCE_replayPending = true;
V.sceneViewSwitch = "AlexFarmWorkStage3";
V.replayScene = { exitpassage: "Danube Street" };
V.mbCE_replayOnce = true;
api.mbCEOnPassageInit("Scene Viewer passages");
assert(V.mbCE_replayPending === false && V.sceneViewSwitch === "AlexFarmWorkStage3", "17.5 首次进入 SV 保留 sceneViewSwitch（不回归）");
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending;
// 17.6) isGwylanGardenPassage 段落匹配
assert(api.isGwylanGardenPassage && api.isGwylanGardenPassage("Gwylan Ritual Start Garden") === true && api.isGwylanGardenPassage("Pregnancy Birth Forest Shop") === true && api.isGwylanGardenPassage("Forest Shop") === true && api.isGwylanGardenPassage("Manor Hall") === false, "isGwylanGardenPassage 匹配格威岚花园/森林商店段落");

// 18) Mod作弊页面（v1.4.0）：动态发现 / 隔离 / 防崩 / 类型校验 / 留痕回退 / 原版过滤 / 重扫
// 18.0) 清理角色恋爱节（15）写入的 Wraith 根，避免内置 wraiths-reflection 适配器误命中计数（v1.8.8 新增适配器回归隔离）
delete V.WraithsReflection; delete V.HelpAsk; delete V.necklaceWR; delete V.necklaceThief; delete V.necklaceThiefWR; delete V.SilverConchWR; delete V.stealdailyMR; delete V.WRR;
/* 18.0b) 清理 13 节恋爱测试写入的 DolMod 探测根（adian_met/adian_romance 等），本段只允许 2 个测试模组（v0.1.990 适配轮回归隔离） */
delete V.adian_met; delete V.adian_romance; delete V.computer; delete V.computerApps; delete V.ngplusCycle;
// 18.1) 扫描识别：setup.mbCE_modCheats 注册 2 个模组 → getCheatMods 返回 2（标准化结构）
setup.mbCE_modCheats = [
	{
		modId: "cheatTestA", modName: "测试模组A",
		tasks: [{ key: "t1", name: "任务一", skipVar: "mliState.t1_skipped", completeVar: "mliState.t1_done" }, { key: "t2", name: "任务二" }],
		stages: [{ key: "s1", name: "阶段一", varPath: "mliState.stage", levels: [0, 1, 2, 3], labels: ["零", "一", "二", "三"] }],
		abilities: [{ key: "a1", name: "能力一", varPath: "mliState.ability1", type: "boolean" }],
		scenes: [{ key: "sc1", name: "剧情一", skipVar: "mliState.sc1_skip", completeVar: "mliState.sc1_done", progressVar: "mliState.sc1_prog", resetValue: 0 }],
		values: [
			{ key: "score", name: "分数", varPath: "mliState.score", type: "number", min: 0, max: 5 },
			{ key: "flagB", name: "开关", varPath: "mliState.flagB", type: "boolean" },
			{ key: "loveList", name: "列表", varPath: "mliState.loveList", type: "list", options: ["Robin", "Whitney"] },
			{ key: "badVanilla", name: "原版陷阱", varPath: "farm_stage", type: "number" }
		]
	},
	{ modId: "cheatTestB", modName: "测试模组B", tasks: [], stages: [], abilities: [], scenes: [], values: [{ key: "bVal", name: "B数值", varPath: "mliStateB.bVal", type: "number" }] }
];
delete V.mliState; delete V.mliStateB;
var cheatMods = api.getCheatMods();
assert(cheatMods.length === 2, "18.1 扫描识别 2 个模组, 实际 " + cheatMods.length);
assert(cheatMods[0].declared === true && cheatMods[0].tasks.length === 2 && cheatMods[0].stages.length === 1 && cheatMods[0].values.length === 4, "18.1 标准化结构（tasks/stages/values 完整）");
// 18.2) 隔离：模组A 的 values 不含模组B 的项
var aValues = cheatMods[0].values.map(function (v) { return v.key; }).join();
assert(aValues.indexOf("bVal") === -1 && cheatMods[1].values[0].key === "bVal", "18.2 子页面隔离：模组A 只含自身数值项");
// 18.3) 防崩：父级对象缺失 → 拒绝写入 undefined
V.mliState = {};
var rP = api.applyCheatModValue("cheatTestA", "score", 3);
assert(rP.ok === true && V.mliState.score === 3, "18.3 父级存在可写入, ok=" + rP.ok);
delete V.mliState;
var rMiss = api.applyCheatModValue("cheatTestA", "score", 3);
assert(rMiss.ok === false && /拒绝写入 undefined/.test(rMiss.message), "18.3 父级缺失 → 拒绝（" + rMiss.message + "）");
assert(!V.mliState, "18.3 拒绝后不产生 mliState（未写 undefined）");
// 18.4) 原版变量过滤：varPath 一级键命中原版清单 → 拒绝
V.mliState = {};
var rV = api.applyCheatModValue("cheatTestA", "badVanilla", 5);
assert(rV.ok === false && /原版变量/.test(rV.message), "18.4 原版变量拒绝（" + rV.message + "）");
assert(V.farm_stage === undefined, "18.4 原版变量未被写入");
// 18.5) 数值类型校验 + 越界钳制
api.applyCheatModValue("cheatTestA", "score", 99);
assert(V.mliState.score === 99, "18.5 上限不钳制（写 99 原样 99）, 实际 " + V.mliState.score);
api.applyCheatModValue("cheatTestA", "score", -3);
assert(V.mliState.score === 0, "18.5 越下限钳制到 0, 实际 " + V.mliState.score);
var rNaN = api.applyCheatModValue("cheatTestA", "score", "abc");
assert(rNaN.ok === false && /数值无效/.test(rNaN.message), "18.5 非数字拒绝（" + rNaN.message + "）");
// 18.6) 布尔归一化
api.applyCheatModValue("cheatTestA", "flagB", "1");
assert(V.mliState.flagB === true, "18.6 '1' → true");
api.applyCheatModValue("cheatTestA", "flagB", 0);
assert(V.mliState.flagB === false, "18.6 0 → false");
// 18.7) 留痕结构：modId/op/path/before/after/t
api.applyCheatModValue("cheatTestA", "score", 4);
var rec = V.mbCE_wrote && V.mbCE_wrote["cheat:cheatTestA:value_set:score"];
assert(rec && rec.type === "cheat" && rec.modId === "cheatTestA" && rec.op === "value_set" && rec.path === "mliState.score" && rec.after === 4, "18.7 留痕含 modId/op/path/after, 实际 " + JSON.stringify(rec && { modId: rec.modId, op: rec.op, path: rec.path, after: rec.after }));
// 18.8) 回退：还原首次写入前状态（score 首次写入前不存在 → 回退删除字段）；二次回退无痕迹
api.undoCheatModValue("cheatTestA", "value_set:score");
assert(("score" in V.mliState) === false, "18.8 回退还原首次写入前状态（score 原本不存在 → 删除）, 存在=" + ("score" in V.mliState));
// 18.8b) 既有值场景：score=5 → 写入 → 回退还原 5（44.8 亦有同类断言）
V.mliState.score = 5;
api.applyCheatModValue("cheatTestA", "score", 4);
api.undoCheatModValue("cheatTestA", "value_set:score");
assert(V.mliState.score === 5, "18.8b 既有值回退还原原值 5, 实际 " + V.mliState.score);
var rU2 = api.undoCheatModValue("cheatTestA", "value_set:score");
assert(rU2.ok === false && /无可撤销痕迹/.test(rU2.message), "18.8 二次回退拒绝（" + rU2.message + "）");
// 18.9) 任务：跳过 / 直接完成；未声明标记 → 拒绝
api.skipCheatTask("cheatTestA", "t1");
assert(V.mliState.t1_skipped === true, "18.9 跳过任务写入 skipVar");
api.completeCheatTask("cheatTestA", "t1");
assert(V.mliState.t1_done === true, "18.9 直接完成写入 completeVar");
var rT2 = api.skipCheatTask("cheatTestA", "t2");
assert(rT2.ok === false && /未声明跳过标记/.test(rT2.message), "18.9 未声明 skipVar 拒绝（" + rT2.message + "）");
// 18.10) 阶段：下拉钳制 / 跳最高 / 回退初始
api.setCheatStage("cheatTestA", "s1", 5);
assert(V.mliState.stage === 3, "18.10 阶段越界钳制到最高 3, 实际 " + V.mliState.stage);
api.jumpCheatStageMax("cheatTestA", "s1");
assert(V.mliState.stage === 3, "18.10 跳至最高=3");
api.resetCheatStage("cheatTestA", "s1");
assert(V.mliState.stage === 0, "18.10 回退初始=0");
// 18.11) 能力：勾选启用/禁用
api.toggleCheatAbility("cheatTestA", "a1", true);
assert(V.mliState.ability1 === true, "18.11 能力启用");
api.toggleCheatAbility("cheatTestA", "a1", false);
assert(V.mliState.ability1 === false, "18.11 能力禁用");
// 18.12) 自定义剧情：跳过 / 强制完成 / 重置进度
api.cheatSceneAction("cheatTestA", "sc1", "scene_skip");
assert(V.mliState.sc1_skip === true, "18.12 跳过剧情");
api.cheatSceneAction("cheatTestA", "sc1", "scene_force");
assert(V.mliState.sc1_done === true, "18.12 强制完成");
api.cheatSceneAction("cheatTestA", "sc1", "scene_reset");
assert(V.mliState.sc1_prog === 0, "18.12 重置进度=0");
// 18.13) 列表型数值：追加/移除/回退
V.mliState.loveList = ["Whitney"];
api.applyCheatModValue("cheatTestA", "loveList", { value: "Robin", on: true });
assert(V.mliState.loveList.join() === "Whitney,Robin", "18.13 列表追加, 实际 " + V.mliState.loveList.join());
api.applyCheatModValue("cheatTestA", "loveList", { value: "Whitney", on: false });
assert(V.mliState.loveList.join() === "Robin", "18.13 列表移除, 实际 " + V.mliState.loveList.join());
api.undoCheatModValue("cheatTestA", "value_set:loveList:Whitney");
assert(V.mliState.loveList.join() === "Whitney,Robin", "18.13 列表回退还原 before, 实际 " + V.mliState.loveList.join());
api.undoCheatModValue("cheatTestA", "value_set:loveList:Robin");
assert(V.mliState.loveList.join() === "Whitney", "18.13 列表回退还原初始, 实际 " + V.mliState.loveList.join());
// 18.14) 内置适配器：探测 setup.foodPreference（More Love Interests Mod）→ 自动出现并可直接操控
setup.foodPreference = { orange_juice: { name: "orange_juice", NPC: ["Black Wolf", "Great Hawk"] } };
var mli = api.getCheatMods().filter(function (x) { return x.modId === "more_love_interests"; })[0];
var mliValues = mli ? mli.values.map(function (v) { return v.key + "|" + v.varPath + "|" + v.type; }) : [];
assert(mli && mli.declared === true && mliValues.length === 3
&& mliValues[0] === "loveInterestList|loveInterestList|list"
&& mliValues.indexOf("mate_for_life_debuff|options.mateForLifeDebuff|boolean") !== -1
&& mliValues.indexOf("drag_mode|dragMode|boolean") !== -1,
"18.14 适配器探测命中：MLI 声明 3 条（恋人列表 + 终生伴侣 Debuff + 拖拽模式），实际 " + JSON.stringify(mliValues));
api.applyCheatModValue("more_love_interests", "loveInterestList", { value: "Gwylan", on: true });
assert(Array.isArray(V.loveInterestList) && V.loveInterestList.indexOf("Gwylan") !== -1, "18.14 MLI 恋人列表写入 Gwylan, 实际 " + JSON.stringify(V.loveInterestList));
delete V.loveInterestList; delete setup.foodPreference;
// 18.15) 重扫：动态新增注册模组 → 列表随之变化
setup.mbCE_modCheats.push({ modId: "cheatTestC", modName: "测试模组C", tasks: [], stages: [], abilities: [], scenes: [], values: [] });
assert(api.getCheatMods().length === 3, "18.15 重扫后新增模组出现, 实际 " + api.getCheatMods().length);
// 清理 18 节测试变量
delete V.mliState; delete V.mliStateB; delete setup.mbCE_modCheats;
Object.keys(V.mbCE_wrote || {}).filter(function (k) { return k.indexOf("cheat:") === 0; }).forEach(function (k) { delete V.mbCE_wrote[k]; });

// 19) 归途之书适配器（v1.4.1 + v1.6.0 补录）：默示录：归途之书 v1.3.4（RBR 罗宾神殿 + 唱诗班 + 迷途羔羊 + 神殿值勤）
// 19.1) 探测：maplebirch 框架注册模块 → 自动识别
global.window = { maplebirch: { get: function (n) { return (n === "RobinTemple" || n === "TempleChoir" || n === "LostLamb" || n === "TempleDuties") ? {} : undefined; } } };
var rbr = api.getCheatMods().filter(function (x) { return x.modId === "revelation-the-book-of-return"; })[0];
assert(rbr && rbr.declared === true, "19.1 探测命中：归途之书自动识别");
assert(rbr.stages.length === 18 && rbr.abilities.length === 24 && rbr.scenes.length === 1 && rbr.values.length === 18, "19.1 分组齐全 阶段18/能力24/剧情1/数值18（v1.8.23 补 1.3.10 项链归还能力；1.9.x 移除失效 td_watch 守夜阶段；1.9.17 适配 1.4.4 补 td_ordination_stage 授职阶段；1.9.24 适配 1.4.6 新增 nkl_retaken 取回能力；1.9.25 适配 1.4.6 项链回收线补 nkl_stage 阶段 + nkl_reclaimed 能力）, 实际 " + rbr.stages.length + "/" + rbr.abilities.length + "/" + rbr.scenes.length + "/" + rbr.values.length);
// 19.2) 隔离：适配器只声明模组自建键，不含原版神殿变量路径
var allPaths = [];
rbr.stages.concat(rbr.abilities).concat(rbr.values).forEach(function (it) { allPaths.push(it.varPath); });
assert(allPaths.every(function (p) { return p.indexOf("temple_rank") === -1 && p.indexOf("templePromised") === -1 && p.indexOf("temple_chastity") === -1; }), "19.2 不暴露原版神殿变量（temple_rank/templePromised/temple_chastity_timer）");
// 19.3) 字符串枚举阶段：写入合法值
V.RobinTemple = { stage: "none", templePromised: "", chastity_timer: 30, monthly_checked: true, secret: { stage: "none", rite_stage: 0, rite_round: 0, dream: { active: false } }, vigil_result: "", faith_band: "steady", prayer_event: 0, prayer_event_done: false, prayer_event_resolved: false };
V.TempleChoir = { joined: false, singing: 0, lead: false, services: 0, practices: 0, bonus: 0 };
api.setCheatStage("revelation-the-book-of-return", "rt_stage", "promised");
assert(V.RobinTemple.stage === "promised", "19.3 字符串枚举写入 promised, 实际 " + V.RobinTemple.stage);
var rBad = api.setCheatStage("revelation-the-book-of-return", "rt_stage", "bogus");
assert(rBad.ok === false && /不在枚举/.test(rBad.message), "19.3 越界字符串阶段拒绝（" + rBad.message + "）");
// 19.4) 跳最高 / 回退初始（字符串枚举）
api.resetCheatStage("revelation-the-book-of-return", "rt_stage");
assert(V.RobinTemple.stage === "none", "19.4 回退初始 none, 实际 " + V.RobinTemple.stage);
api.jumpCheatStageMax("revelation-the-book-of-return", "rt_stage");
assert(V.RobinTemple.stage === "promised", "19.4 跳至最高 promised, 实际 " + V.RobinTemple.stage);
// 19.5) 数字阶段：亵渎仪式 0-7
api.setCheatStage("revelation-the-book-of-return", "rt_rite_stage", 5);
assert(V.RobinTemple.secret.rite_stage === 5, "19.5 数字阶段写入 5, 实际 " + V.RobinTemple.secret.rite_stage);
api.jumpCheatStageMax("revelation-the-book-of-return", "rt_rite_stage");
assert(V.RobinTemple.secret.rite_stage === 7, "19.5 跳至最高 7, 实际 " + V.RobinTemple.secret.rite_stage);
api.resetCheatStage("revelation-the-book-of-return", "rt_rite_stage");
assert(V.RobinTemple.secret.rite_stage === 0, "19.5 回退初始 0, 实际 " + V.RobinTemple.secret.rite_stage);
// 19.5b) 1.4.4 新增授职阶段（td_ordination_stage）：合法/非法写入
// 模拟模组已启动（TempleDuties 宿主存在；未初始化时写入器按 18.3 拒绝）
V.TempleDuties = { ordination: { stage: "prepare", party: {}, choices: {}, completed: [], start: 0 } };
api.setCheatStage("revelation-the-book-of-return", "td_ordination_stage", "chant");
assert(V.TempleDuties.ordination.stage === "chant", "19.5b 授职阶段写入生效");
var rBadOrd = api.setCheatStage("revelation-the-book-of-return", "td_ordination_stage", "bogus");
assert(rBadOrd.ok === false && /不在枚举/.test(rBadOrd.message), "19.5b 授职阶段非法值拒绝（" + rBadOrd.message + "）");
api.setCheatStage("revelation-the-book-of-return", "td_ordination_stage", "aftercare");
assert(V.TempleDuties.ordination.stage === "aftercare", "19.5b 善后阶段（aftercare）合法写入");
api.jumpCheatStageMax("revelation-the-book-of-return", "td_ordination_stage");
assert(V.TempleDuties.ordination.stage === "complete", "19.5b 跳至最高 = 完成授职（complete）, 实际 " + V.TempleDuties.ordination.stage);
api.resetCheatStage("revelation-the-book-of-return", "td_ordination_stage");
assert(V.TempleDuties.ordination.stage === "prepare", "19.5b 授职阶段回退初始");
// 19.6) 能力：唱诗入团 / 领唱 / 挂坠 / 双誓约
api.toggleCheatAbility("revelation-the-book-of-return", "tc_joined", true);
assert(V.TempleChoir.joined === true, "19.6 唱诗班入团 true");
api.toggleCheatAbility("revelation-the-book-of-return", "tc_lead", true);
assert(V.TempleChoir.lead === true, "19.6 领唱资格 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_pendant", true);
assert(V.RobinTemple.pendant === true, "19.6 挂坠 true");
// 19.7) 数值：唱诗熟练度 / 恩典钳制
api.applyCheatModValue("revelation-the-book-of-return", "tc_singing", 5000);
assert(V.TempleChoir.singing === 5000, "19.7 歌唱熟练度上限不钳制（写 5000 原样）, 实际 " + V.TempleChoir.singing);
api.applyCheatModValue("revelation-the-book-of-return", "rt_grace", 999);
assert(V.RobinTemple.grace === 999, "19.7 恩典上限不钳制（写 999 原样）, 实际 " + V.RobinTemple.grace);
// 19.8) 剧情：祷告事件 跳过/强制完成/重置
api.cheatSceneAction("revelation-the-book-of-return", "rt_prayer", "scene_skip");
assert(V.RobinTemple.prayer_event_resolved === true, "19.8 祷告事件跳过（resolved）");
api.cheatSceneAction("revelation-the-book-of-return", "rt_prayer", "scene_force");
assert(V.RobinTemple.prayer_event_done === true, "19.8 祷告事件强制完成（done）");
V.RobinTemple.prayer_event = 3;
api.cheatSceneAction("revelation-the-book-of-return", "rt_prayer", "scene_reset");
assert(V.RobinTemple.prayer_event === 0, "19.8 祷告事件重置进度 0, 实际 " + V.RobinTemple.prayer_event);
// 19.9) 防崩：V.RobinTemple 缺失 → 拒绝写入 undefined
delete V.RobinTemple;
var rMissR = api.setCheatStage("revelation-the-book-of-return", "rt_stage", "member");
assert(rMissR.ok === false && /拒绝写入 undefined/.test(rMissR.message), "19.9 宿主缺失拒绝（" + rMissR.message + "）");
// 19.10) 留痕回退：字符串阶段回退还原 before
V.RobinTemple = { stage: "none", secret: { stage: "none", rite_stage: 0 }, vigil_result: "", faith_band: "steady", prayer_event: 0, prayer_event_done: false, prayer_event_resolved: false };
api.setCheatStage("revelation-the-book-of-return", "rt_stage", "approved");
assert(V.RobinTemple.stage === "approved", "19.10 写入 approved");
api.undoCheatModValue("revelation-the-book-of-return", "stage_set:rt_stage");
assert(V.RobinTemple.stage === "none", "19.10 回退还原 none, 实际 " + V.RobinTemple.stage);
// 19.11) v1.4.9 适配器重校验补录：医院阶段/后日谈/夜访/变身 + 6 项标记 + 3 项数值（源码 constants/robin-temple.ts 实证）
api.setCheatStage("revelation-the-book-of-return", "rt_hospital", "rescue");
assert(V.RobinTemple.hospital_stage === "rescue", "19.11 医院阶段写入 rescue, 实际 " + V.RobinTemple.hospital_stage);
api.setCheatStage("revelation-the-book-of-return", "rt_secret_followup", "complete");
assert(V.RobinTemple.secret.followup === "complete", "19.11 后日谈阶段写入 complete, 实际 " + V.RobinTemple.secret.followup);
api.setCheatStage("revelation-the-book-of-return", "rt_night_scene", "blanket");
assert(V.RobinTemple.night_scene === "blanket", "19.11 夜访场景写入 blanket, 实际 " + V.RobinTemple.night_scene);
api.setCheatStage("revelation-the-book-of-return", "rt_transformation", "fox");
assert(V.RobinTemple.transformation_kind === "fox", "19.11 变身形态写入 fox, 实际 " + V.RobinTemple.transformation_kind);
var rHospitalBad = api.setCheatStage("revelation-the-book-of-return", "rt_hospital", "bogus");
assert(rHospitalBad.ok === false && /不在枚举/.test(rHospitalBad.message), "19.11 医院阶段越界拒绝（" + rHospitalBad.message + "）");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_hospital_support", true);
assert(V.RobinTemple.hospital_support === true, "19.11 医院陪伴 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_assess_fire", true);
assert(V.RobinTemple.assessment_fire === true, "19.11 评估之火 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_vigil_attending", true);
assert(V.RobinTemple.vigil_attending === true, "19.11 守夜进行中 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_vigil_with_robin", true);
assert(V.RobinTemple.vigil_with_robin === true, "19.11 与罗宾同守夜 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_abandoned", true);
assert(V.RobinTemple.abandoned === true, "19.11 已放弃路线 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_rite_done", true);
assert(V.RobinTemple.secret.rite_done === true, "19.11 仪式已完成 true");
api.applyCheatModValue("revelation-the-book-of-return", "rt_rite_round", 5);
assert(V.RobinTemple.secret.rite_round === 5, "19.11 同席连续次数 5, 实际 " + V.RobinTemple.secret.rite_round);
api.applyCheatModValue("revelation-the-book-of-return", "rt_intimacy_count", 12);
assert(V.RobinTemple.intimacy_count === 12, "19.11 亲密累计次数 12, 实际 " + V.RobinTemple.intimacy_count);
api.applyCheatModValue("revelation-the-book-of-return", "rt_evaluation_marks", 80);
assert(V.RobinTemple.evaluation_marks === 80, "19.11 评估分数 80, 实际 " + V.RobinTemple.evaluation_marks);
// 清理 19 节
delete V.RobinTemple; delete V.TempleChoir; delete global.window;
Object.keys(V.mbCE_wrote || {}).filter(function (k) { return k.indexOf("cheat:revelation-the-book-of-return") === 0; }).forEach(function (k) { delete V.mbCE_wrote[k]; });

// 20) DomRobin 适配器（v1.4.2）：DomRobin 0.0.8-for-dol-0.5.12.13（罗宾大型增强）
// 20.1) 探测：ModLoader 已加载模组注册表 → 自动识别
global.window = { modUtils: { getMod: function (n) { return n === "DomRobin" ? {} : undefined; } } };
var drb = api.getCheatMods().filter(function (x) { return x.modId === "dom_robin"; })[0];
assert(drb && drb.declared === true, "20.1 探测命中：DomRobin 自动识别");
assert(drb.stages.length === 1 && drb.abilities.length === 11 && drb.values.length === 2, "20.1 分组齐全 阶段1/能力11/数值2（2026-10-24 删零证据声明 liveStreamTogetherTalked 能力12→11、ls_on 数值3→2）, 实际 " + drb.stages.length + "/" + drb.abilities.length + "/" + drb.values.length);
// 20.2) 隔离：DomRobin 大量复用原版罗宾线变量，适配器绝不声明
var drbPaths = [];
drb.stages.concat(drb.abilities).concat(drb.values).forEach(function (it) { drbPaths.push(it.varPath); });
assert(drbPaths.every(function (p) {
	return ["robinpaid", "renttime_fight", "robinShouldPayBack", "lemonadeUpgraded", "chocolateUpgraded",
	       "robinPayBothNote", "robinPaySelfNote", "robinCouldPayBoth", "robinCouldPaySelf",
	       "robinSoldConsole", "robinfirstrentfight", "robinconsole", "robinconsolelost"].every(function (vk) { return p.indexOf(vk) === -1; });
}), "20.2 不暴露原版罗宾线变量（robinpaid/renttime_fight/robinShouldPayBack/lemonadeUpgraded 等）");
// 20.3) 数字阶段：直播周数 0-6 写入/跳最高/回退
V.liveStreamStage = 0;
api.setCheatStage("dom_robin", "ls_stage", 3);
assert(V.liveStreamStage === 3, "20.3 直播周数写入 3, 实际 " + V.liveStreamStage);
api.jumpCheatStageMax("dom_robin", "ls_stage");
assert(V.liveStreamStage === 6, "20.3 跳至最高 6, 实际 " + V.liveStreamStage);
api.resetCheatStage("dom_robin", "ls_stage");
assert(V.liveStreamStage === 0, "20.3 回退初始 0, 实际 " + V.liveStreamStage);
// 20.4) 能力：战斗/还债/直播/还钱进度 boolean
api.toggleCheatAbility("dom_robin", "rf_talked", true);
assert(V.robinFightTalked === true, "20.4 反抗战斗已谈话 true");
api.toggleCheatAbility("dom_robin", "rf_together", true);
assert(V.robinFightTogether === true, "20.4 共同战斗完成 true");
api.toggleCheatAbility("dom_robin", "rp_both", true);
assert(V.robinPayBothTalked === true, "20.4 共同还债谈话 true");
api.toggleCheatAbility("dom_robin", "pb_choc", true);
assert(V.chocolateUpgradeShouldPayBack === true, "20.4 巧克力摊还钱进度 true");
api.toggleCheatAbility("dom_robin", "pb_live", true);
assert(V.liveStreamShouldPayBack === true, "20.4 直播设备还钱进度 true");
// 20.5) 数值钳制：打赢次数 0-99（2026-10-24 删零证据声明 ls_on/liveStream，直播开关不再暴露）
api.applyCheatModValue("dom_robin", "rf_chain", 200);
assert(V.robinFightChain === 200, "20.5 打赢次数上限不钳制（写 200 原样）, 实际 " + V.robinFightChain);
// 20.6) 列表：柠檬水摊新商品追加/移除
V.lemonadeNewGoodsList = ["popcorn"];
api.applyCheatModValue("dom_robin", "goods_list", "balloon");
assert(V.lemonadeNewGoodsList.includes("balloon"), "20.6 新商品追加 balloon, 实际 [" + V.lemonadeNewGoodsList + "]");
api.applyCheatModValue("dom_robin", "goods_list", { value: "popcorn", on: false });
assert(!V.lemonadeNewGoodsList.includes("popcorn"), "20.6 新商品移除 popcorn, 实际 [" + V.lemonadeNewGoodsList + "]");
// 20.7) 留痕回退：全新 stage key 首次写入前 undefined → 回退删除叶子
Object.keys(V.mbCE_wrote || {}).filter(function (k) { return k.indexOf("cheat:dom_robin:stage_set:ls_stage") === 0; }).forEach(function (k) { delete V.mbCE_wrote[k]; });
delete V.liveStreamStage;
api.setCheatStage("dom_robin", "ls_stage", 4);
assert(V.liveStreamStage === 4, "20.7 直播周数写入 4");
api.undoCheatModValue("dom_robin", "stage_set:ls_stage");
assert(V.liveStreamStage === undefined, "20.7 回退还原初始（删除叶子）, 实际 " + V.liveStreamStage);
// 20.8) 探测缺失：无 modUtils → 不出现
delete global.window;
var drbAbsent = api.getCheatMods().filter(function (x) { return x.modId === "dom_robin"; }).length;
assert(drbAbsent === 0, "20.8 无 modUtils 时不出现 DomRobin, 实际 " + drbAbsent);
// 清理 20 节
delete V.robinFightTalked; delete V.robinFightTogether; delete V.robinPayBothTalked; delete V.robinPaySelfTalked;
delete V.flowerCrownTalked; delete V.liveStreamAgreePrepare; delete V.liveStreamTogetherTalked; delete V.liveStreamTogether;
delete V.lemonadeShouldPayBack; delete V.liveStreamShouldPayBack; delete V.chocolateUpgradeShouldPayBack; delete V.chocolateReformShouldPayBack;
delete V.robinFightChain; delete V.liveStream; delete V.lemonadeNewGoodsList; delete V.liveStreamStage;
Object.keys(V.mbCE_wrote || {}).filter(function (k) { return k.indexOf("cheat:dom_robin") === 0; }).forEach(function (k) { delete V.mbCE_wrote[k]; });

// 21) 枯木逢春适配器（v1.4.3 + v1.6.0 核对）：Deadwood Reblooms 2.2.7（maplebirch 20 模块大型模组，作者楓樺葉）
// 21.1) 探测：框架根模块注册 → 自动识别
global.window = { maplebirch: { get: function (n) { return n === "DeadwoodReblooms" ? {} : undefined; } } };
var dwd = api.getCheatMods().filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
assert(dwd && dwd.declared === true, "21.1 探测命中：枯木逢春自动识别");
assert(dwd.stages.length >= 13 && dwd.abilities.length >= 65 && dwd.values.length >= 55, "21.1 分组齐全 阶段≥13/能力≥65/数值≥55（v1.9.9 扩展轮：心智 Psyche+PC 马鲸渡鸦转化+神社线+月羽 npc+果园计数；tsuki_init/tsuki_lover 走数值区——模组判定 init===1 需数字、恋人列表需 list 通道）" + ", 实际 " + dwd.stages.length + "/" + dwd.abilities.length + "/" + dwd.values.length);
// 21.2) 隔离：只声明 maplebirch 模块自建一级键（RobinExpansion/LifeSimulation/StreetLife/BirdTower/VanillaPlus/Finance/MoreTransformations/maplebirch），
//        不碰原版顶层键（rebellion/victories/self_rent/both_rent/rent_separated 等原版同名键均不声明）；
//        maplebirch 为框架 NPC 转化存档命名空间（$maplebirch.npc.<名>.transformation.<type>，2.4.5 悉尼转化作弊项，见 NPCTransformation.ts ensure/read）
var dwdPaths = [];
dwd.stages.concat(dwd.abilities).concat(dwd.values).forEach(function (it) { dwdPaths.push(it.varPath); });
var dwdRoots = [];
dwdPaths.forEach(function (p) { if (dwdRoots.indexOf(p.split(".")[0]) === -1) { dwdRoots.push(p.split(".")[0]); } });
assert(dwdRoots.every(function (r) { return ["RobinExpansion", "LifeSimulation", "StreetLife", "BirdTower", "VanillaPlus", "Finance", "MoreTransformations", "Transport", "maplebirch", "Psyche", "Orchard", "loveInterestList", "scienceprogression", "featsBoosts"].indexOf(r) !== -1; }),
	"21.2 声明根键均为模组模块状态, 实际 [" + dwdRoots + "]");
// 隔离补充：一级键全为模组模块根（V.RobinExpansion 等），绝不落到原版顶层键上；
// rebellion/victories/self_rent 等在模组里只是 RobinExpansion 对象内的自建副本（模组从不读写原版顶层同名键，已 grep 实证）
assert(dwdPaths.every(function (p) {
	return ["rebellion", "victories", "self_rent", "both_rent", "rent_separated"].every(function (vk) { return p.indexOf(vk + ".") === -1 && p.split(".")[0] !== vk; });
}), "21.2 无任何声明路径把原版同名键作为根键/一级路径使用");
// 21.3) 字符串枚举阶段：店铺开办/气球支线/收容所/校园职务/历史课题
V.RobinExpansion = { shop_stage: "none", balloon: "none", asylum: { status: "home" }, doctor: { stage: 0, count: 0 }, rebellion: false, allies: false, solidarity: false, bailey_defeated: false, shop: false, tutor: false, fish_cooked: false, fish_grill: false, lemonade: 0, chocolate: 0, victories: 0, reserve: 0, care_fund: 0, balloon_wins: 0, tutor_lessons: 0, shop_stock: 0, shop_staff: 0, pc_loan: 0, weekly_income: 0 };
V.LifeSimulation = { school: { role: "student", attendanceExempt: false, baileySigned: false, order: 20, studentSupport: 20, staffSupport: 20, corruption: 0, clothesStored: false, dress: { active: "uniform", highest: "uniform" }, duties: { completed: 0 } }, historyProject: { status: "none" } };
V.StreetLife = { reputation: 0, races: { wins: 0, completed: 0 } };
V.BirdTower = { seen: { milk: false }, ring: { kept: 0 } };
V.Finance = { orphanage: {} };
api.setCheatStage("deadwood-reblooms", "r_shop_stage", "permitted");
assert(V.RobinExpansion.shop_stage === "permitted", "21.3 店铺阶段写入 permitted, 实际 " + V.RobinExpansion.shop_stage);
api.setCheatStage("deadwood-reblooms", "ls_role", "president");
assert(V.LifeSimulation.school.role === "president", "21.3 校园职务写入 president, 实际 " + V.LifeSimulation.school.role);
var dwdBad = api.setCheatStage("deadwood-reblooms", "r_balloon", "bogus");
assert(dwdBad.ok === false && /不在枚举/.test(dwdBad.message), "21.3 越界字符串阶段拒绝（" + dwdBad.message + "）");
api.jumpCheatStageMax("deadwood-reblooms", "ls_history");
assert(V.LifeSimulation.historyProject.status === "won", "21.3 历史课题跳至最高 won, 实际 " + V.LifeSimulation.historyProject.status);
api.resetCheatStage("deadwood-reblooms", "r_asylum");
assert(V.RobinExpansion.asylum.status === "home", "21.3 收容所回退初始 home, 实际 " + V.RobinExpansion.asylum.status);
// 21.4) 数字阶段：医生游戏 0-2
api.setCheatStage("deadwood-reblooms", "r_doctor", 2);
assert(V.RobinExpansion.doctor.stage === 2, "21.4 医生游戏写入 2, 实际 " + V.RobinExpansion.doctor.stage);
// 21.5) 能力：反抗路线/同盟/团结/贝利击败/免听/哺乳
api.toggleCheatAbility("deadwood-reblooms", "r_rebellion", true);
assert(V.RobinExpansion.rebellion === true, "21.5 反抗贝利路线 true");
api.toggleCheatAbility("deadwood-reblooms", "r_bailey", true);
assert(V.RobinExpansion.bailey_defeated === true, "21.5 贝利已击败 true");
api.toggleCheatAbility("deadwood-reblooms", "ls_exempt", true);
assert(V.LifeSimulation.school.attendanceExempt === true, "21.5 免听凭证 true");
api.toggleCheatAbility("deadwood-reblooms", "bt_milk", true);
assert(V.BirdTower.seen.milk === true, "21.5 哺乳事件 true");
api.toggleCheatAbility("deadwood-reblooms", "f_avery_refused", true);
assert(V.Finance.orphanage.avery_adoption_refused === true, "21.5 已拒绝艾弗里收养 true（2.4.2 新增）");
// 21.6) 数值钳制：储备金/口碑/戒指/腐败
api.applyCheatModValue("deadwood-reblooms", "r_reserve", 9999999);
assert(V.RobinExpansion.reserve === 9999999, "21.6 储备金上限不钳制（写 9999999 原样）, 实际 " + V.RobinExpansion.reserve);
api.applyCheatModValue("deadwood-reblooms", "bt_ring", 9);
assert(V.BirdTower.ring.kept === 9, "21.6 金戒指上限不钳制（写 9 原样）, 实际 " + V.BirdTower.ring.kept);
api.applyCheatModValue("deadwood-reblooms", "sl_race_wins", 3);
assert(V.StreetLife.races.wins === 3, "21.6 公路赛胜场 3, 实际 " + V.StreetLife.races.wins);
api.applyCheatModValue("deadwood-reblooms", "ls_corruption", 150);
assert(V.LifeSimulation.school.corruption === 150, "21.6 腐败上限不钳制（写 150 原样）, 实际 " + V.LifeSimulation.school.corruption);
// 21.11) v2.5.4 成就加成系统（featsBoosts）：写满 60 购买，键 upgrades['deadwood-<attr>']；越界钳制到 max=60
//        模组启动即初始化宿主（Boosts.twee widget <<set $featsBoosts.upgrades[...] ??= 0>>），此处模拟同结构
V.featsBoosts = { upgrades: {}, upgradeDetails: {}, name: {}, missing: {} };
api.applyCheatModValue("deadwood-reblooms", "fb_willpower", 60);
assert(V.featsBoosts.upgrades["deadwood-willpower"] === 60, "21.11 成就加成·意志力写 60, 实际 " + V.featsBoosts.upgrades["deadwood-willpower"]);
api.applyCheatModValue("deadwood-reblooms", "fb_physique", 70);
assert(V.featsBoosts.upgrades["deadwood-physique"] === 70, "21.11 成就加成·体格写 70 原样（values 数值不钳制，UI 滑块限 60）, 实际 " + V.featsBoosts.upgrades["deadwood-physique"]);
api.applyCheatModValue("deadwood-reblooms", "fb_beauty", 60);
assert(V.featsBoosts.upgrades["deadwood-beauty"] === 60, "21.11 成就加成·美貌写 60, 实际 " + V.featsBoosts.upgrades["deadwood-beauty"]);
api.applyCheatModValue("deadwood-reblooms", "fb_exhibitionism", 60);
assert(V.featsBoosts.upgrades["deadwood-exhibitionism"] === 60, "21.11 成就加成·暴露癖写 60, 实际 " + V.featsBoosts.upgrades["deadwood-exhibitionism"]);
api.applyCheatModValue("deadwood-reblooms", "fb_deviancy", 60);
assert(V.featsBoosts.upgrades["deadwood-deviancy"] === 60, "21.11 成就加成·变态癖写 60, 实际 " + V.featsBoosts.upgrades["deadwood-deviancy"]);
api.applyCheatModValue("deadwood-reblooms", "fb_promiscuity", 60);
assert(V.featsBoosts.upgrades["deadwood-promiscuity"] === 60, "21.11 成就加成·淫荡写 60, 实际 " + V.featsBoosts.upgrades["deadwood-promiscuity"]);
// 21.7) 防崩：模块状态宿主缺失 → 拒绝写入 undefined
delete V.RobinExpansion;
var dwdMiss = api.setCheatStage("deadwood-reblooms", "r_shop_stage", "applied");
assert(dwdMiss.ok === false && /拒绝写入 undefined/.test(dwdMiss.message), "21.7 宿主缺失拒绝（" + dwdMiss.message + "）");
// 21.8) 留痕回退：字符串阶段回退还原 before
V.RobinExpansion = { shop_stage: "none", balloon: "none", asylum: { status: "home" }, doctor: { stage: 0, count: 0 } };
api.setCheatStage("deadwood-reblooms", "r_shop_stage", "inspected");
assert(V.RobinExpansion.shop_stage === "inspected", "21.8 写入 inspected");
api.undoCheatModValue("deadwood-reblooms", "stage_set:r_shop_stage");
assert(V.RobinExpansion.shop_stage === "none", "21.8 回退还原 none, 实际 " + V.RobinExpansion.shop_stage);
// 21.9) v1.4.9 适配器重校验补录：着装规范（截图"自由着装"）/ 值勤次数（截图"已完成值勤：29"）/
//       校服存放 / 借款 / 周收入（源码 School.ts SchoolState + constants/robin.ts 实证）
api.setCheatStage("deadwood-reblooms", "dress_active", "free");
assert(V.LifeSimulation.school.dress.active === "free", "21.9 着装规范写入 free（自由着装）, 实际 " + V.LifeSimulation.school.dress.active);
// 21.10) v1.8.23 新增 2.4.4 冷月港·泽菲尔线阶段：写入 4 + 数字阶段越界钳制到最高（对齐 18.10/19.5 既有语义）
V.MoreTransformations = { harbour: { zephyr: { stage: 0 } } };
V.maplebirch = { npc: { Zephyr: { init: 0 } } };
var cmOk = api.setCheatStage("deadwood-reblooms", "cm_zephyr", 4);
assert(cmOk.ok && V.MoreTransformations.harbour.zephyr.stage === 4, "21.10 泽菲尔线阶段写入 4, 实际 " + V.MoreTransformations.harbour.zephyr.stage);
// 21.10b) 2026-10-29 条件审查补联动：写 1+ 补船+泽菲尔登场、2+ 补默认酬金、4+ 补交付场景（缺任一则入口 exit / 交箱显示 0 / 交付段落误显已结清）
assert(V.MoreTransformations.harbour.ship === true, "21.10b 写 4 联动补 harbour.ship（入口判定缺一即 exit）, 实际 " + V.MoreTransformations.harbour.ship);
assert(V.maplebirch.npc.Zephyr.init === 1, "21.10b 写 4 联动补 Zephyr.init=1（对话入口判定）, 实际 " + V.maplebirch.npc.Zephyr.init);
assert(V.MoreTransformations.harbour.zephyr.fee === 8000, "21.10b 写 4 联动补默认酬金 fee=8000（海盗 rank 未设）, 实际 " + V.MoreTransformations.harbour.zephyr.fee);
assert(V.MoreTransformations.harbour.scene === "zephyrPaid", "21.10b 写 4 联动补 scene=zephyrPaid（交付段落判定）, 实际 " + V.MoreTransformations.harbour.scene);
var cmReset = api.setCheatStage("deadwood-reblooms", "cm_zephyr", 0);
assert(cmReset.ok && V.MoreTransformations.harbour.zephyr.stage === 0 && V.MoreTransformations.harbour.ship === true, "21.10b 写 0 重置只降阶段、不撤销联动（ship 保持）, 实际 stage=" + V.MoreTransformations.harbour.zephyr.stage + " ship=" + V.MoreTransformations.harbour.ship);
var cmBad = api.setCheatStage("deadwood-reblooms", "cm_zephyr", 9);
assert(V.MoreTransformations.harbour.zephyr.stage === 4, "21.10 阶段越界 9 钳制到最高 4（原值 4 保持）, 实际 " + V.MoreTransformations.harbour.zephyr.stage);
api.setCheatStage("deadwood-reblooms", "dress_highest", "revealing");
assert(V.LifeSimulation.school.dress.highest === "revealing", "21.9 最高着装政策写入 revealing, 实际 " + V.LifeSimulation.school.dress.highest);
var dwdDressBad = api.setCheatStage("deadwood-reblooms", "dress_active", "bogus");
assert(dwdDressBad.ok === false && /不在枚举/.test(dwdDressBad.message), "21.9 着装规范越界拒绝（" + dwdDressBad.message + "）");
api.applyCheatModValue("deadwood-reblooms", "duties_completed", 29);
assert(V.LifeSimulation.school.duties.completed === 29, "21.9 已完成值勤 29, 实际 " + V.LifeSimulation.school.duties.completed);
api.applyCheatModValue("deadwood-reblooms", "pc_loan", 500);
assert(V.RobinExpansion.pc_loan === 500, "21.9 借款 500, 实际 " + V.RobinExpansion.pc_loan);
api.applyCheatModValue("deadwood-reblooms", "weekly_income", 1200);
assert(V.RobinExpansion.weekly_income === 1200, "21.9 周收入 1200, 实际 " + V.RobinExpansion.weekly_income);
api.toggleCheatAbility("deadwood-reblooms", "clothes_stored", true);
assert(V.LifeSimulation.school.clothesStored === true, "21.9 校服已存放 true");
// 21.11) v1.9.9 补枯木 2.5.0 说明页键：心智 Psyche、PC 马/鲸/渡鸦转化、神社线、月羽 npc、果园计数
V.MoreTransformations = { shrine: { stage: 0, feeds: 0 }, raven: { met: false } };
V.Psyche = { sanity: 1000 };
V.maplebirch = { transformation: { horse: { build: 0 }, whale: { build: 0 }, raven: { build: 0 } }, npc: { Tsukihan: { init: 1, love: 0, dom: 10, lust: 0 } } };
V.Orchard = { orders_completed: 0, contracts_completed: 0, sales_income: 0, regular_visits: 0 };
V.loveInterestList = [];
api.applyCheatModValue("deadwood-reblooms", "ps_sanity", 500);
assert(V.Psyche.sanity === 500, "21.11 心智·理智写 500, 实际 " + V.Psyche.sanity);
api.applyCheatModValue("deadwood-reblooms", "ps_sanity", -999);
assert(V.Psyche.sanity === -500, "21.11 理智下限钳制 -500, 实际 " + V.Psyche.sanity);
api.applyCheatModValue("deadwood-reblooms", "pc_horse_build", 100);
api.applyCheatModValue("deadwood-reblooms", "pc_whale_build", 100);
api.applyCheatModValue("deadwood-reblooms", "pc_raven_build", 100);
assert(V.maplebirch.transformation.horse.build === 100 && V.maplebirch.transformation.whale.build === 100 && V.maplebirch.transformation.raven.build === 100, "21.11 PC 马/鲸/渡鸦转化写满 100");
// 21.12) 神社线 sync 条件联动：写 0 不联动；写 1 补 feeds=3；写 3 补 feeds=3 + 月羽已认识
V.MoreTransformations = { shrine: { stage: 0, feeds: 0 }, raven: { met: false } };
api.setCheatStage("deadwood-reblooms", "shrine_stage", 0);
assert(V.MoreTransformations.shrine.feeds === 0 && V.MoreTransformations.raven.met === false, "21.12 写神社 0 不联动喂鸦/渡鸦（保持 0/false）, 实际 feeds " + V.MoreTransformations.shrine.feeds);
api.setCheatStage("deadwood-reblooms", "shrine_stage", 1);
assert(V.MoreTransformations.shrine.stage === 1 && V.MoreTransformations.shrine.feeds === 3 && V.MoreTransformations.raven.met === true, "21.12 写神社 1 → 自动补喂鸦 3 + 已遇见渡鸦（模组收信前置 feeds≥3 且 raven.met）, 实际 feeds " + V.MoreTransformations.shrine.feeds + " raven.met=" + V.MoreTransformations.raven.met);
V.MoreTransformations.raven.met = false;
api.applyCheatModValue("deadwood-reblooms", "shrine_feeds", 1);
assert(V.MoreTransformations.shrine.feeds === 1 && V.MoreTransformations.raven.met === true, "21.12 写喂鸦 1 → 自动补已遇见渡鸦（模组喂鸦前提 raven.met）, 实际 raven.met=" + V.MoreTransformations.raven.met);
V.maplebirch = { npc: { Tsukihan: { init: 0, love: 0, dom: 10, lust: 0 } } };
api.setCheatStage("deadwood-reblooms", "shrine_stage", 3);
assert(V.MoreTransformations.shrine.stage === 3 && V.MoreTransformations.shrine.feeds === 3 && V.maplebirch.npc.Tsukihan.init === 1 && V.MoreTransformations.raven.met === true, "21.12 写神社 3 → 补喂鸦 3 + 已遇见 + 月羽已认识 init=1, 实际 init " + V.maplebirch.npc.Tsukihan.init);
// 21.13) 月羽 npc 键 / 恋人列表 / 渡鸦遇见 / 果园计数
api.applyCheatModValue("deadwood-reblooms", "tsuki_love", 40);
api.applyCheatModValue("deadwood-reblooms", "tsuki_dom", 25);
api.applyCheatModValue("deadwood-reblooms", "tsuki_lust", 30);
assert(V.maplebirch.npc.Tsukihan.love === 40 && V.maplebirch.npc.Tsukihan.dom === 25 && V.maplebirch.npc.Tsukihan.lust === 30, "21.13 月羽 好感/任性/欲望 写入");
api.applyCheatModValue("deadwood-reblooms", "tsuki_lover", "Tsukihan");
assert(Array.isArray(V.loveInterestList) && V.loveInterestList.indexOf("Tsukihan") !== -1, "21.13 恋人列表追加 Tsukihan, 实际 " + JSON.stringify(V.loveInterestList));
api.applyCheatModValue("deadwood-reblooms", "tsuki_lover", { value: "Tsukihan", on: false });
assert(!V.loveInterestList || V.loveInterestList.indexOf("Tsukihan") === -1, "21.13 恋人列表移除 Tsukihan");
api.toggleCheatAbility("deadwood-reblooms", "raven_flock_met", true);
assert(V.MoreTransformations.raven.met === true, "21.13 渡鸦已遇见 true");
api.applyCheatModValue("deadwood-reblooms", "tsuki_init", 1);
assert(V.maplebirch.npc.Tsukihan.init === 1, "21.13 月羽已认识写 1（模组判定 ===1，布尔 true 不满足）, 实际 " + V.maplebirch.npc.Tsukihan.init);
api.applyCheatModValue("deadwood-reblooms", "or_orders_completed", 5);
api.applyCheatModValue("deadwood-reblooms", "or_contracts_completed", 2);
api.applyCheatModValue("deadwood-reblooms", "or_sales_income", 10000);
assert(V.Orchard.orders_completed === 5 && V.Orchard.contracts_completed === 2 && V.Orchard.sales_income === 10000, "21.13 果园 订单/合同/收入 写入");
// 21.14) v2.5.3 新增键：科学课事件档位 + 心智恐惧/入迷（模组 PsycheCheats 页同键同界）
var dwdSci = dwd.values.filter(function (x) { return x.key === "dw_science_progression"; })[0];
assert(dwdSci && dwdSci.varPath === "scienceprogression" && dwdSci.min === 0 && dwdSci.max === 4, "21.14 科学课进度声明存在（scienceprogression 0-4）");
api.applyCheatModValue("deadwood-reblooms", "dw_science_progression", 4);
assert(V.scienceprogression === 4, "21.14 科学课进度写 4, 实际 " + V.scienceprogression);
api.applyCheatModValue("deadwood-reblooms", "dw_science_progression", -1);
assert(V.scienceprogression === 0, "21.14 科学课进度下限钳 0, 实际 " + V.scienceprogression);
var dwdMood = dwd.values.filter(function (x) { return x.key === "psy_mood"; })[0];
assert(dwdMood && dwdMood.varPath === "Psyche.mood" && dwdMood.min === -1000 && dwdMood.max === 1000, "21.14 心智 mood 声明存在（-1000~1000）");
api.applyCheatModValue("deadwood-reblooms", "psy_mood", -1000);
assert(V.Psyche.mood === -1000, "21.14 心智入迷写 -1000, 实际 " + V.Psyche.mood);
api.applyCheatModValue("deadwood-reblooms", "psy_mood", 5000);
assert(V.Psyche.mood === 5000, "21.14 心智恐惧写 5000 原样（v1.9.10 上限不钳制策略，max 仅 UI 提示、模组自钳）, 实际 " + V.Psyche.mood);
api.applyCheatModValue("deadwood-reblooms", "psy_mood", -5000);
assert(V.Psyche.mood === -1000, "21.14 心智入迷下限钳 -1000（min 声明生效）, 实际 " + V.Psyche.mood);
// 清理 21 节
delete V.RobinExpansion; delete V.LifeSimulation; delete V.StreetLife; delete V.BirdTower; delete global.window;
delete V.MoreTransformations; delete V.Psyche; delete V.maplebirch; delete V.Orchard; delete V.loveInterestList; delete V.scienceprogression;
Object.keys(V.mbCE_wrote || {}).filter(function (k) { return k.indexOf("cheat:deadwood-reblooms") === 0; }).forEach(function (k) { delete V.mbCE_wrote[k]; });

// 22) v1.4.4 修复：原版 scenes 的 unlocked 全依赖 $scenePassages.includes(...)（已看段落表），
//     部分存档/流程下 $scenePassages 从未初始化 → 此前 undefined.includes 崩溃被 catch → raw=undefined → 状态「未知」
//     修复：evalSceneExpr 兜底初始化为 []，sceneStatus 非 true 一律归为未达成（不再出现「未知」）
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT }].filter(fn) };
delete V.scenePassages; /* 模拟缺失场景 */
var sDefs22 = api.getScenesDefs();
assert(sDefs22.live === true && !!sDefs22.defs["Tutorial"], "22.1 Story 文本实时解析可用");
var st22 = api.sceneStatus(sDefs22.defs["Tutorial"]);
assert(st22.state === "fail" && st22.note.indexOf("未知") === -1, "22.2 V.scenePassages 缺失时 Tutorial 显示未达成而非「未知」, 实际 " + st22.state + "/" + st22.note);
assert(Array.isArray(V.scenePassages), "22.3 evalSceneExpr 已兜底初始化 V.scenePassages 数组");
V.scenePassages.push("Tutorial");
assert(api.sceneStatus(sDefs22.defs["Tutorial"]).state === "pass", "22.4 段落写入后 Tutorial 已达成");
V.scenePassages = [];
var c22 = api.completeScene(sDefs22.defs["TempleSydneyPure"]);
assert(c22.ok && api.sceneStatus(sDefs22.defs["TempleSydneyPure"]).state === "pass", "22.5 一键完成（场景段落字面量写入 scenePassages）→ 复检已达成, note=" + c22.note);
// 22.6) unlocked 非布尔（0/false）→ 未达成而非「未知」
delete global.Story;
V.scenes = { F0: { name: "零值", startPassage: "S", passages: ["S"], unlocked: 0, lockedMessage: "Locked" }, FF: { name: "假值", startPassage: "S", passages: ["S"], unlocked: false, lockedMessage: "Locked" } };
var sDefs22b = api.getScenesDefs();
assert(sDefs22b.live === false && api.sceneStatus(sDefs22b.defs["F0"]).state === "fail" && api.sceneStatus(sDefs22b.defs["FF"]).state === "fail", "22.6 unlocked 0/false → 未达成（非未知）");
// 清理 22 节
delete V.scenes; delete global.Story; delete V.scenePassages;

// 23) v1.4.5：场景播放器被困修复（unpinScene 先跳后清 + Back 正常退出清理）+ 角色一览恋爱候选过滤
// 23.1) unpinScene：back 有效 → 先设无效 sceneViewSwitch 再跳转、跳转完成后才删 replayScene
V.passage = "Orphanage";
V.replayScene = { name: "X", startPassage: "Scene Viewer passages", passages: [], exitpassage: "Orphanage" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [{ key: "KX", name: "N", startPassage: "Scene Viewer passages", passages: [], used: true }];
V.sceneViewSwitch = "Tutorial";
var playLog23 = [];
global.Engine = { play: function (n, h) { playLog23.push(n + ":" + !!h); } };
api.unpinScene("KX");
assert(V.sceneViewSwitch === "MB_CE_END", "23.1 取消固定：sceneViewSwitch 清为无效值（switch 走 default）");
assert(playLog23.length === 1 && playLog23[0] === "Orphanage:true", "23.2 取消固定：跳转执行（Engine.play 已调用）, 实际 " + JSON.stringify(playLog23));
assert(!V.replayScene && !V.mbCE_replayOnce && !V.mbCE_replayPending, "23.3 取消固定：跳转完成后清理 replayScene/标记");
// 23.4) back 无效（exitpassage 空 + 当前段落读不到）→ 不删 replayScene（播放器 default 保留 Back 链接可手动退出）
V.replayScene = { name: "X", startPassage: "Scene Viewer passages", passages: [], exitpassage: "" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
delete V.passage; /* currentPassageName() 拿不到 → back 空 */
api.unpinScene("nokey");
assert(V.replayScene && V.sceneViewSwitch === "MB_CE_END" && playLog23.length === 1, "23.4 back 无效时不删 replayScene（default 仍有 Back 链接）");
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending;
// 23.17) v1.9.4 根治（用户实测盲区）：重放中取消且当前处于模组恋爱播放器段落（非 Scene Viewer）
//        → back 有效即强制 Engine.play 跳回原位 + 清理 replayScene/标记（不再区分播放器类型）
V.passage = "MB Love Player";
V.replayScene = { name: "Robin Pier", startPassage: "MB Love Player", passages: [], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [{ key: "KR", name: "N", startPassage: "MB Love Player", passages: [], used: true }];
playLog23.length = 0;
api.unpinScene("KR");
assert(playLog23.length === 1 && playLog23[0] === "Danube Street:true", "23.17 模组播放器段落取消 → 强制 Engine.play 回原位, 实际 " + JSON.stringify(playLog23));
assert(!V.replayScene && !V.mbCE_replayOnce && !V.mbCE_replayPending, "23.18 模组播放器段落取消 → 清理 replayScene/标记");
delete V.mbCE_queue; delete V.passage;
// 23.19) v1.9.5-自检：Engine 不可用（ep 缺失）→ 保留 replayScene/标记（播放器 Back 有源），只失效 switch 不删不跳
delete global.Engine;
V.passage = "MB Love Player";
V.replayScene = { name: "Robin Pier", startPassage: "MB Love Player", passages: [], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [{ key: "KR2", name: "N", startPassage: "MB Love Player", passages: [], used: true }];
api.unpinScene("KR2");
assert(!!V.replayScene, "23.19 Engine 缺失 → 保留 replayScene（Back 有源，不删）");
assert(!!V.mbCE_replayOnce, "23.19 Engine 缺失 → 保留 replayOnce 标记");
assert(V.sceneViewSwitch === "MB_CE_END", "23.19 Engine 缺失 → sceneViewSwitch 已失效");
assert((js.match(/mbCEClearReplay\(/g) || []).length >= 6, "23.20 统一清理入口：mbCEClearReplay 定义 + 5 调用点（播放器各终点不再散落三段式清理）");
delete V.mbCE_queue; delete V.passage; delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending;
// 23.5) onPassageOverride：dest === exitpassage（Back 正常返回原位）→ 清理残留
V.passage = "Orphanage";
V.replayScene = { name: "X", startPassage: "Scene Viewer passages", passages: [], exitpassage: "Orphanage" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [{ key: "K1", name: "N", startPassage: "Scene Viewer passages", passages: [], used: true }];
V.sceneViewSwitch = "MB_CE_END";
api.onPassageOverride({ name: "Orphanage" });
assert(!V.replayScene && !V.mbCE_replayOnce && !V.mbCE_replayPending, "23.5 Back 返回原位 → 清理重放残留");
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "23.6 Back 返回原位 → 移除已用队列项");
delete V.mbCE_queue; delete V.sceneViewSwitch;
delete global.Engine;
// 23.7) isLoveCandidate：MLI 扩容恋人列表命中 → 恋爱候选
V.loveInterestList = ["Bon", "Robin"];
assert(api.isLoveCandidate("Bon") === true, "23.7 恋爱候选：loveInterestList 命中（列表分支）");
assert(api.isLoveCandidate("robin") === true, "23.8 恋爱候选：框架恋爱条件命中（大小写不敏感）");
// 23.9) isLoveCandidate：loveAlias 恋爱标记命中 → 候选
setup.loveAlias = { Charlie: 1 };
assert(api.isLoveCandidate("Charlie") === true, "23.9 恋爱候选：loveAlias 标记命中");
delete setup.loveAlias;
// 23.10) isLoveCandidate：纯路人（无恋爱条件/标记/列表项）→ 非候选
assert(api.isLoveCandidate("路人甲") === false, "23.10 非恋爱候选：无恋爱标记的路人不显示");
delete V.loveInterestList;
// 23.11) 恋爱阶段兜底条件（loveInterest.includes）一键完成 → 真正加入恋人卡槽
setup.loveAlias = { Charlie: 1 };
var natSt = api.getRomanceStages("Charlie");
assert(natSt.length === 1 && natSt[0].native === true, "23.11 恋爱候选兜底条件生成（loveAlias 命中）");
var natR = api.completeRomanceStage("Charlie", natSt[0]);
assert(natR.ok === true && Array.isArray(V.loveInterest) && V.loveInterest.indexOf("Charlie") !== -1, "23.12 一键完成：角色已加入恋人卡槽（loveInterest 数组）");
assert(!!V.mbCE_wrote["romance:native:charlie"], "23.13 native 写入已留痕, 实际 mbCE_wrote=" + JSON.stringify(V.mbCE_wrote));
// 23.14) 对象结构槽位写入：写首个空槽、不覆盖已有恋人
delete V.loveInterest;
V.loveInterest = { primary: "Robin", secondary: "", tertiary: "" };
var natR2 = api.completeRomanceStage("Charlie", natSt[0]);
assert(natR2.ok === true && V.loveInterest.secondary === "Charlie" && V.loveInterest.primary === "Robin", "23.14 对象槽位：写入首个空槽、不覆盖已有恋人");
// 23.15) 槽位全满 + MLI 扩容列表 → 写 loveInterestList、不覆盖已有恋人
delete V.loveInterest;
V.loveInterest = { primary: "Robin", secondary: "Whitney", tertiary: "Kylar" };
V.loveInterestList = [];
var natR3 = api.completeRomanceStage("Charlie", natSt[0]);
assert(natR3.ok === true && V.loveInterestList.indexOf("Charlie") !== -1 && V.loveInterest.primary === "Robin", "23.15 槽位全满：写入 MLI 扩容列表、不覆盖已有恋人, 实际 ok=" + natR3.ok + " list=" + JSON.stringify(V.loveInterestList) + " li=" + JSON.stringify(V.loveInterest));
// 23.16) 非恋爱候选：isLoveCandidate 排除（渲染层不显示恋爱阶段）
delete setup.loveAlias;
delete V.loveInterest; delete V.loveInterestList;
V.mbCE_wrote = {};
assert(api.isLoveCandidate("路人甲") === false, "23.16 非恋爱候选（无恋爱标记）：恋爱阶段不显示");

// 7) 容错：框架缺失不抛错（重新加载脚本获得干净闭包 → MB 缓存为空，走存档兜底）
global.window = {};
delete global.setup.MapleBirch;
eval(js);
const api2 = setup.mbStageCE;
const ch2 = (function () { try { return api2.listCharacters(); } catch (e) { return "ERR:" + e.message; } })();
assert(Array.isArray(ch2) && ch2.length >= 15, "框架缺失时 listCharacters 从存档兜底不抛错: " + ch2.length);

// 24) Mod作弊：数值/阶段更改 → 读回确认 → 越界/宿主/vanilla 保护 → 回退还原（全链路）
// 24.0) 清理 23 节可能写入的 Wraith 根（内置 wraiths-reflection 适配器回归隔离，v1.8.8）
delete V.WraithsReflection; delete V.HelpAsk; delete V.necklaceWR; delete V.necklaceThief; delete V.necklaceThiefWR; delete V.SilverConchWR; delete V.stealdailyMR; delete V.WRR;
const api24 = setup.mbStageCE;   // 7) 容错节已 eval 重载，取新闭包
V.TestMod = { num1: 5, flag_b: false, list1: ["a"], str_stage: "started", num_stage: 1 };
V.mbCE_wrote = {};
setup.mbCE_modCheats = [{
	modId: "test-mod", modName: "测试模组",
	tasks: [{ key: "t1", name: "测试任务", skipVar: "TestMod.task_skip", completeVar: "TestMod.task_done" }],
	stages: [
		{ key: "s_str", name: "字符串阶段", varPath: "TestMod.str_stage", levels: ["none", "started", "done"], labels: ["未开始", "已开始", "已完成"] },
		{ key: "s_num", name: "数字阶段", varPath: "TestMod.num_stage", levels: [0, 1, 2], labels: ["0", "1", "2"] }
	],
	abilities: [{ key: "a1", name: "能力A", varPath: "TestMod.flag_a" }],
	scenes: [{ key: "sc1", name: "自定义场景", skipVar: "TestMod.sc_skip", completeVar: "TestMod.sc_done", progressVar: "TestMod.sc_prog", resetValue: 0 }],
	values: [
		{ key: "v1", name: "数值1", varPath: "TestMod.num1", type: "number", min: 0, max: 100 },
		{ key: "v2", name: "布尔", varPath: "TestMod.flag_b", type: "boolean" },
		{ key: "v3", name: "列表", varPath: "TestMod.list1", type: "list", options: ["a", "b", "c"] }
	]
}];
const mcMods = api24.getCheatMods();
assert(mcMods.length === 1 && mcMods[0].modId === "test-mod", "24.1 Mod作弊：测试模组注册识别");
// 24.2) 数值更改 → 写回 + 读回确认（面板输入框回显依据）
const mcN1 = api24.applyCheatModValue("test-mod", "v1", 42);
assert(mcN1.ok && V.TestMod.num1 === 42 && api24.cheatReadSafe("test-mod", "TestMod.num1") === 42, "24.2 数值更改 42：写入成功且读回确认");
// 24.3) 越界钳制（max=100）
const mcN2 = api24.applyCheatModValue("test-mod", "v1", 999);
assert(mcN2.ok && V.TestMod.num1 === 999, "24.3 越上限不钳制（写 999 原样）");
// 24.4) 布尔写入
const mcB = api24.applyCheatModValue("test-mod", "v2", true);
assert(mcB.ok && V.TestMod.flag_b === true, "24.4 布尔写入 true");
// 24.5) 列表追加 / 24.6) 列表移除
const mcL1 = api24.applyCheatModValue("test-mod", "v3", { value: "b", on: true });
assert(mcL1.ok && V.TestMod.list1.indexOf("b") !== -1, "24.5 列表追加 b");
const mcL2 = api24.applyCheatModValue("test-mod", "v3", { value: "a", on: false });
assert(mcL2.ok && V.TestMod.list1.indexOf("a") === -1 && V.TestMod.list1.indexOf("b") !== -1, "24.6 列表移除 a、保留 b");
// 24.7) 阶段更改（字符串枚举）→ 写回 + 读回确认（下拉回显依据）
const mcS1 = api24.setCheatStage("test-mod", "s_str", "done");
assert(mcS1.ok && V.TestMod.str_stage === "done" && api24.cheatReadSafe("test-mod", "TestMod.str_stage") === "done", "24.7 阶段更改：字符串枚举 done 写入且读回确认");
// 24.8) 阶段越界拒绝、原值不变
const mcS2 = api24.setCheatStage("test-mod", "s_str", "bogus");
assert(!mcS2.ok && V.TestMod.str_stage === "done", "24.8 字符串阶段越界拒绝且原值不变, 实际 " + mcS2.message);
// 24.9) 数字阶段写入
const mcSN = api24.setCheatStage("test-mod", "s_num", 2);
assert(mcSN.ok && V.TestMod.num_stage === 2, "24.9 数字阶段 2 写入");
// 24.10) 跳至最高 / 24.11) 回退初始
const mcMX = api24.jumpCheatStageMax("test-mod", "s_num");
assert(mcMX.ok && V.TestMod.num_stage === 2, "24.10 跳至最高：2（已是最高）");
const mcMN = api24.resetCheatStage("test-mod", "s_str");
assert(mcMN.ok && V.TestMod.str_stage === "none", "24.11 回退初始：none");
// 24.12) 能力勾选
const mcA = api24.toggleCheatAbility("test-mod", "a1", true);
assert(mcA.ok && V.TestMod.flag_a === true, "24.12 能力勾选 true");
// 24.13) 宿主缺失拒绝（不写 undefined 对象）
setup.mbCE_modCheats.push({ modId: "ghost", modName: "幽灵模组", tasks: [], stages: [{ key: "g1", name: "幽灵阶段", varPath: "GhostMod.stage", levels: ["x"], labels: ["x"] }], abilities: [], scenes: [], values: [] });
const mcG = api24.setCheatStage("ghost", "g1", "x");
assert(!mcG.ok && mcG.message.indexOf("宿主不存在") !== -1, "24.13 父级缺失拒绝写入 undefined 对象, 实际 " + mcG.message);
// 24.14) vanilla 根拒绝（loveInterest 为原版变量）
setup.mbCE_modCheats[1].values = [{ key: "gv", name: "原生数值", varPath: "loveInterest", type: "number", min: 0, max: 9 }];
const mcGV = api24.applyCheatModValue("ghost", "gv", 3);
assert(!mcGV.ok && mcGV.message.indexOf("原版变量") !== -1, "24.14 vanilla 根拒绝（loveInterest）, 实际 " + mcGV.message);
// 24.15) 任务跳过 / 24.16) 任务完成
const mcTK = api24.skipCheatTask("test-mod", "t1");
assert(mcTK.ok && V.TestMod.task_skip === true, "24.15 任务跳过标记写入");
const mcTC = api24.completeCheatTask("test-mod", "t1");
assert(mcTC.ok && V.TestMod.task_done === true, "24.16 任务完成标记写入");
// 24.17) 再次更改 → 24.18) 回退还原首次 before（5）
api24.applyCheatModValue("test-mod", "v1", 33);
assert(V.TestMod.num1 === 33, "24.17 再次更改 v1=33");
const mcU1 = api24.undoCheatModValue("test-mod", "value_set:v1");
assert(mcU1.ok && V.TestMod.num1 === 5, "24.18 回退还原首次 before（5）, 实际 " + V.TestMod.num1);
// 24.19) 阶段回退还原 before（started）
const mcUS = api24.undoCheatModValue("test-mod", "stage_set:s_str");
assert(mcUS.ok && V.TestMod.str_stage === "started", "24.19 阶段回退还原 before（started）, 实际 " + V.TestMod.str_stage);
// 24.20) 清理
delete setup.mbCE_modCheats;
delete V.TestMod; delete V.mbCE_wrote;

// 25) v1.4.8：一键完成兜底（Story 全文恢复 / 缓存 unlocked 字符串表达式）+ 固定触发播放完自动回原位
// 25.1) Story 全文恢复：widget "scenes" 段落定位不到（段落名变体）→ findScenesWidgetText 兜底找 "$scenes to {" 段落
delete V.scenes; delete V.scenePassages;
global.Story = { lookupWith: (fn) => [
	{ name: "Some Passage", text: "unrelated text" },
	{ name: "Scene List", text: `<<if $scenes is undefined>><<set $scenes to { "WhitneyOrphanageVisit":{ name:"Whitney Orphanage Visit", startPassage:"SV Street Bully Orphanage Go", passages:["SV Street Bully Orphanage Go","SV Street Bully Orphanage Go 2"], manualVariableChanges:"", unlocked: $scenePassages.includes("Street Bully Orphanage Go") }, "WhitneySchoolBullyChastity":{ name:"Whitney School Bully Chastity Rule", startPassage:"Scene Viewer passages", passages:["Bully Chastity"], manualVariableChanges:"<<set $sceneViewSwitch to 'schoolBully'>>", unlocked: $scenePassages.includes("WhitneySchoolBullySkirt") } }>><</if>>` }
].filter(fn) };
var sDefs25 = api.getScenesDefs();
assert(sDefs25.live === true && !!sDefs25.defs["WhitneyOrphanageVisit"] && !!sDefs25.defs["WhitneySchoolBullyChastity"], "25.1 段落名变体（无 widget scenes 头）也能解析惠特尼场景, live=" + sDefs25.live + " keys=" + Object.keys(sDefs25.defs).join(","));
// 25.2) 孤儿院一键完成：unlocked 引用 "Street Bully Orphanage Go"（≠键名/startPassage）→ 写入即达成
V.scenePassages = [];
var c25o = api.completeScene(sDefs25.defs["WhitneyOrphanageVisit"]);
assert(c25o.ok && V.scenePassages.indexOf("Street Bully Orphanage Go") !== -1 && api.sceneStatus(sDefs25.defs["WhitneyOrphanageVisit"]).state === "pass", "25.2 孤儿院一键完成：写入 includes 字面量（≠键名/startPassage）→ 复检达成, note=" + c25o.note);
// 25.3) 贞操装置一键完成：unlocked 复用裙子标记 "WhitneySchoolBullySkirt" → 达成
var c25c = api.completeScene(sDefs25.defs["WhitneySchoolBullyChastity"]);
assert(c25c.ok && V.scenePassages.indexOf("WhitneySchoolBullySkirt") !== -1, "25.3 贞操装置一键完成：复用裙子解锁标记写入 → 达成");
// 25.4) 无 Story：走 V.scenes 缓存
delete global.Story; delete V.scenePassages;
V.scenes = { StaticW: { name: "静态场景", startPassage: "S", passages: ["S"], unlocked: false, lockedMessage: "Locked" } };
var sDefs25b = api.getScenesDefs();
assert(sDefs25b.live === false, "25.4 无 Story：getScenesDefs 回退 V.scenes 缓存, live=" + sDefs25b.live);
// 25.5) 缓存 unlocked 为表达式字符串 → 提升为 unlockedExpr → 一键完成
V.scenes = { StrW: { name: "字符串场景", startPassage: "S", passages: ["S"], unlocked: '$scenePassages.includes("StrWMark")', lockedMessage: "Locked" } };
var sDefs25c = api.getScenesDefs();
var c25s = api.completeScene(sDefs25c.defs["StrW"]);
assert(c25s.ok && V.scenePassages.indexOf("StrWMark") !== -1, "25.5 缓存 unlocked 字符串表达式 → 提取标记写入并达成, note=" + c25s.note);
// 25.6) 固定触发播放完 → Scene Viewer End → MOD 重放自动回原位（passageArgs.name=exitpassage）
delete V.scenes;
V.passage = "Orphanage";
V.replayScene = { name: "N", startPassage: "Scene Viewer passages", passages: [], exitpassage: "Orphanage" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = false;
V.mbCE_queue = [{ key: "K", name: "N", startPassage: "Scene Viewer passages", passages: [], used: true }];
var ov25 = { name: "Scene Viewer End" };
api.onPassageOverride(ov25);
assert(ov25.name === "Orphanage", "25.6 Scene Viewer End：MOD 重放结束自动回原位, 实际 " + ov25.name);
assert(!V.replayScene && !V.mbCE_replayOnce && Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "25.7 Scene Viewer End：replayScene/标记清理 + 已用队列项移除");
// 25.8) 原版手动重放到 Scene Viewer End → 不改 dest（保持原版 Exit scene 行为）
V.replayScene = { name: "N", startPassage: "Scene Viewer passages", passages: [], exitpassage: "Orphanage" };
delete V.mbCE_replayOnce; V.mbCE_replayPending = false;
var ov25b = { name: "Scene Viewer End" };
api.onPassageOverride(ov25b);
assert(ov25b.name === "Scene Viewer End", "25.8 原版手动重放：Scene Viewer End 不改 dest, 实际 " + ov25b.name);
delete V.replayScene; delete V.mbCE_queue;
// 25.9) 固定触发 case 场景播放完链回 Scene Viewer passages（非首次）→ 自动回原位
V.passage = "Orphanage";
V.replayScene = { name: "N", startPassage: "Scene Viewer passages", passages: [], exitpassage: "Orphanage" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = false;
V.mbCE_queue = [{ key: "K", name: "N", startPassage: "Scene Viewer passages", passages: [], used: true }];
var ov25c = { name: "Scene Viewer passages" };
api.onPassageOverride(ov25c);
assert(ov25c.name === "Orphanage", "25.9 链回 Scene Viewer passages（非首次）→ 自动回原位, 实际 " + ov25c.name);
assert(!V.replayScene && Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "25.10 链回 passages：replayScene 清理 + 队列已用项移除");
// 25.11) 首次进入 Scene Viewer passages（pending=true）→ 不拦截（正常播放）
V.replayScene = { name: "N", startPassage: "Scene Viewer passages", passages: [], exitpassage: "Orphanage" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
var ov25d = { name: "Scene Viewer passages" };
api.onPassageOverride(ov25d);
assert(ov25d.name === "Scene Viewer passages", "25.11 首次进入 passages（pending=true）→ 不拦截, 实际 " + ov25d.name);
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.mbCE_queue; delete V.passage;
// 25.12) 锚定孤儿院场景：带地点元数据 → 入队；走到对应地点弹确认条（直入段落场景 startPassage≠"Scene Viewer passages" 不设 pending）
V.mbCE_queue = [];
V.passage = "Town";
var playedBack25 = "";
global.Engine = { play: (n, h) => { playedBack25 = n + ":" + !!h; } };
var pinR25 = api.pinScene({ key: "WhitneyOrphanageVisit", def: { name: "Whitney Orphanage Visit", startPassage: "SV Street Bully Orphanage Go", passages: ["SV Street Bully Orphanage Go"], manualVariableChanges: "" } });
assert(pinR25.ok === true, "25.12 锚定孤儿院场景入队, msg=" + pinR25.message);
V.location = "orphanage"; /* WhitneyOrphanageVisit 触发地点 */
let ceCalls25 = 0;
let mkNode25 = (tag) => { ceCalls25++; return ({ tagName: tag, style: {}, className: "", textContent: "", type: "", disabled: false, children: [], appendChild(c) { this.children.push(c); }, addEventListener() {}, parentNode: null }); };
global.document = { createElement: mkNode25, getElementById: () => ({ insertBefore() {}, firstChild: null }), body: {} };
api.mbCEOnPassageEnd();
assert(ceCalls25 === 4, "25.13 锚定触发：走到孤儿院地点弹确认条（DOM 已构建）, createElement=" + ceCalls25);
var r25 = api.startAnchoredReplay(V.mbCE_queue[0]);
assert(r25.ok && V.replayScene && V.replayScene.startPassage === "SV Street Bully Orphanage Go" && V.mbCE_replayOnce === true && V.mbCE_replayPending === false, "25.14 确认触发：直入段落（孤儿院 startPassage）+ replayOnce=true + pending=false, actual " + JSON.stringify(r25));
assert(playedBack25 === "SV Street Bully Orphanage Go:true", "25.14b Engine.play 跳转孤儿院入口, 实际 " + playedBack25);
// 25.15) 孤儿院播放完链回 Scene Viewer passages → 无 pending 残留 → 自动回原位
V.replayScene = { name: "Whitney Orphanage Visit", startPassage: "SV Street Bully Orphanage Go", passages: ["SV Street Bully Orphanage Go"], exitpassage: "Town" };
V.mbCE_replayOnce = true;
V.mbCE_replayPending = false;
var ov25f = { name: "Scene Viewer passages" };
api.onPassageOverride(ov25f);
assert(ov25f.name === "Town", "25.15 孤儿院链回 passages：自动回原位（无 pending 残留）, 实际 " + ov25f.name);
assert(!V.replayScene && Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "25.16 孤儿院链回 passages：replayScene 清理 + 队列清空");
delete global.Engine; delete global.document;
delete V.mbCE_queue; delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.passage; delete V.location;

// 26) v1.4.9 适配器重校验补录字段：更改数值/阶段 → 读回确认 → 钳制/越界 → 跳最高/回退初始 → 回退还原（全链路）
// 环境：三个内容模组同时探测命中（枯木逢春 + 归途之书 + DomRobin）
global.window = { maplebirch: { get: function (n) { return (n === "DeadwoodReblooms" || n === "RobinTemple" || n === "TempleChoir") ? {} : undefined; } } };
V.RobinExpansion = { shop_stage: "none", balloon: "none", asylum: { status: "home" }, doctor: { stage: 0, count: 0 }, rebellion: false, allies: false, solidarity: false, bailey_defeated: false, shop: false, tutor: false, fish_cooked: false, fish_grill: false, lemonade: 0, chocolate: 0, victories: 0, reserve: 0, care_fund: 0, balloon_wins: 0, tutor_lessons: 0, shop_stock: 0, shop_staff: 0, pc_loan: 0, weekly_income: 0 };
V.LifeSimulation = { school: { role: "student", attendanceExempt: false, baileySigned: false, order: 20, studentSupport: 20, staffSupport: 20, corruption: 0, clothesStored: false, dress: { active: "uniform", highest: "uniform" }, duties: { completed: 0 } }, historyProject: { status: "none" } };
V.StreetLife = { reputation: 0, races: { wins: 0, completed: 0 } };
V.BirdTower = { seen: { milk: false }, ring: { kept: 0 } };
V.RobinTemple = { stage: "none", secret: { stage: "none", rite_stage: 0, rite_round: 0, followup: "none", rite_done: false }, vigil_result: "", faith_band: "steady", prayer_event: 0, prayer_event_done: false, prayer_event_resolved: false, hospital_stage: "", hospital_support: false, assessment_fire: false, vigil_attending: false, vigil_with_robin: false, abandoned: false, night_scene: "", transformation_kind: "", intimacy_count: 0, evaluation_marks: 0 };
V.TempleChoir = { joined: false, singing: 0, lead: false, services: 0, practices: 0, bonus: 0 };
V.mbCE_wrote = {};
// 26.1) 三适配器同时探测命中
var mc26Mods = api24.getCheatMods();
var mc26Dwd = mc26Mods.filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
var mc26Rbr = mc26Mods.filter(function (x) { return x.modId === "revelation-the-book-of-return"; })[0];
assert(mc26Dwd && mc26Rbr, "26.1 枯木逢春+归途之书适配器同时命中");
assert(mc26Dwd.stages.filter(function (s) { return s.key === "dress_active" || s.key === "dress_highest"; }).length === 2 &&
       mc26Dwd.values.filter(function (v) { return v.key === "duties_completed" || v.key === "pc_loan" || v.key === "weekly_income"; }).length === 3 &&
       mc26Dwd.abilities.filter(function (a) { return a.key === "clothes_stored"; }).length === 1, "26.1 枯木逢春补录 6 项已声明（着装2/数值3/标记1）");
assert(mc26Rbr.stages.filter(function (s) { return s.key === "rt_hospital" || s.key === "rt_secret_followup" || s.key === "rt_night_scene" || s.key === "rt_transformation"; }).length === 4 &&
       mc26Rbr.abilities.filter(function (a) { return a.key === "rt_hospital_support" || a.key === "rt_assess_fire" || a.key === "rt_vigil_attending" || a.key === "rt_vigil_with_robin" || a.key === "rt_abandoned" || a.key === "rt_rite_done"; }).length === 6 &&
       mc26Rbr.values.filter(function (v) { return v.key === "rt_rite_round" || v.key === "rt_intimacy_count" || v.key === "rt_evaluation_marks"; }).length === 3, "26.1 归途之书补录 13 项已声明（阶段4/标记6/数值3）");
// 26.2) 枯木逢春·值勤次数（用户截图「已完成值勤：29」）：更改 → 读回确认
var mc26A = api24.applyCheatModValue("deadwood-reblooms", "duties_completed", 29);
assert(mc26A.ok && V.LifeSimulation.school.duties.completed === 29 && api24.cheatReadSafe("deadwood-reblooms", "LifeSimulation.school.duties.completed") === 29, "26.2 值勤次数写 29：写入成功且读回确认, 实际 " + api24.cheatReadSafe("deadwood-reblooms", "LifeSimulation.school.duties.completed"));
// 26.3) 枯木逢春·值勤次数：越界钳制（max=999）
api24.applyCheatModValue("deadwood-reblooms", "duties_completed", 99999);
assert(V.LifeSimulation.school.duties.completed === 99999, "26.3 值勤次数上限不钳制（写 99999 原样）, 实际 " + V.LifeSimulation.school.duties.completed);
// 26.4) 枯木逢春·着装规范（用户截图「自由着装」）：更改 → 读回确认
var mc26B = api24.setCheatStage("deadwood-reblooms", "dress_active", "free");
assert(mc26B.ok && V.LifeSimulation.school.dress.active === "free" && api24.cheatReadSafe("deadwood-reblooms", "LifeSimulation.school.dress.active") === "free", "26.4 着装规范写 free（自由着装）：写入成功且读回确认");
var mc26B2 = api24.setCheatStage("deadwood-reblooms", "dress_active", "bogus");
assert(mc26B2.ok === false && V.LifeSimulation.school.dress.active === "free", "26.4 着装规范越界拒绝且原值不变（" + mc26B2.message + "）");
// 26.5) 枯木逢春·着装规范：跳至最高 / 回退初始
api24.jumpCheatStageMax("deadwood-reblooms", "dress_active");
assert(V.LifeSimulation.school.dress.active === "mandatoryNudity", "26.5 着装规范跳至最高 mandatoryNudity, 实际 " + V.LifeSimulation.school.dress.active);
api24.resetCheatStage("deadwood-reblooms", "dress_active");
assert(V.LifeSimulation.school.dress.active === "uniform", "26.5 着装规范回退初始 uniform, 实际 " + V.LifeSimulation.school.dress.active);
// 26.6) 枯木逢春·借款 / 周收入（钳制）/ 校服存放
api24.applyCheatModValue("deadwood-reblooms", "pc_loan", 500);
assert(V.RobinExpansion.pc_loan === 500, "26.6 借款写 500, 实际 " + V.RobinExpansion.pc_loan);
api24.applyCheatModValue("deadwood-reblooms", "weekly_income", 2000000);
assert(V.RobinExpansion.weekly_income === 2000000, "26.6 周收入上限不钳制（写 2000000 原样）, 实际 " + V.RobinExpansion.weekly_income);
api24.toggleCheatAbility("deadwood-reblooms", "clothes_stored", true);
assert(V.LifeSimulation.school.clothesStored === true, "26.6 校服已存放 true");
// 26.7) 归途之书·医院阶段（v1.4.9 新增）：更改 → 读回确认 → 越界 → 跳最高 → 回退初始
var mc26C = api24.setCheatStage("revelation-the-book-of-return", "rt_hospital", "rescue");
assert(mc26C.ok && V.RobinTemple.hospital_stage === "rescue" && api24.cheatReadSafe("revelation-the-book-of-return", "RobinTemple.hospital_stage") === "rescue", "26.7 医院阶段写 rescue：写入成功且读回确认");
var mc26C2 = api24.setCheatStage("revelation-the-book-of-return", "rt_hospital", "bogus");
assert(mc26C2.ok === false && V.RobinTemple.hospital_stage === "rescue", "26.7 医院阶段越界拒绝且原值不变（" + mc26C2.message + "）");
api24.jumpCheatStageMax("revelation-the-book-of-return", "rt_hospital");
assert(V.RobinTemple.hospital_stage === "vanilla", "26.7 医院阶段跳至最高 vanilla, 实际 " + V.RobinTemple.hospital_stage);
api24.resetCheatStage("revelation-the-book-of-return", "rt_hospital");
assert(V.RobinTemple.hospital_stage === "", "26.7 医院阶段回退初始空串, 实际 [" + V.RobinTemple.hospital_stage + "]");
// 26.8) 归途之书·后日谈 / 夜访 / 变身形态
api24.setCheatStage("revelation-the-book-of-return", "rt_secret_followup", "complete");
assert(V.RobinTemple.secret.followup === "complete", "26.8 后日谈阶段 complete, 实际 " + V.RobinTemple.secret.followup);
api24.setCheatStage("revelation-the-book-of-return", "rt_night_scene", "blanket");
assert(V.RobinTemple.night_scene === "blanket", "26.8 夜访场景 blanket, 实际 " + V.RobinTemple.night_scene);
api24.setCheatStage("revelation-the-book-of-return", "rt_transformation", "fox");
assert(V.RobinTemple.transformation_kind === "fox", "26.8 变身形态 fox, 实际 " + V.RobinTemple.transformation_kind);
// 26.9) 归途之书·6 项标记 + 3 项数值（钳制）
api24.toggleCheatAbility("revelation-the-book-of-return", "rt_hospital_support", true);
assert(V.RobinTemple.hospital_support === true, "26.9 医院陪伴 true");
api24.toggleCheatAbility("revelation-the-book-of-return", "rt_assess_fire", true);
assert(V.RobinTemple.assessment_fire === true, "26.9 评估之火 true");
api24.toggleCheatAbility("revelation-the-book-of-return", "rt_vigil_attending", true);
assert(V.RobinTemple.vigil_attending === true, "26.9 守夜进行中 true");
api24.toggleCheatAbility("revelation-the-book-of-return", "rt_vigil_with_robin", true);
assert(V.RobinTemple.vigil_with_robin === true, "26.9 与罗宾同守夜 true");
api24.toggleCheatAbility("revelation-the-book-of-return", "rt_abandoned", true);
assert(V.RobinTemple.abandoned === true, "26.9 已放弃路线 true");
api24.toggleCheatAbility("revelation-the-book-of-return", "rt_rite_done", true);
assert(V.RobinTemple.secret.rite_done === true, "26.9 仪式已完成 true");
api24.applyCheatModValue("revelation-the-book-of-return", "rt_rite_round", 999);
assert(V.RobinTemple.secret.rite_round === 999, "26.9 同席连续次数上限不钳制（写 999 原样）, 实际 " + V.RobinTemple.secret.rite_round);
api24.applyCheatModValue("revelation-the-book-of-return", "rt_intimacy_count", 12);
assert(V.RobinTemple.intimacy_count === 12, "26.9 亲密累计次数 12, 实际 " + V.RobinTemple.intimacy_count);
api24.applyCheatModValue("revelation-the-book-of-return", "rt_evaluation_marks", 200);
assert(V.RobinTemple.evaluation_marks === 200, "26.9 评估分数上限不钳制（写 200 原样）, 实际 " + V.RobinTemple.evaluation_marks);
// 26.10) 回退还原首次 before：值勤 29→再次写 50→回退还原 0；着装 free→再次写 revealing→回退还原 uniform
api24.applyCheatModValue("deadwood-reblooms", "duties_completed", 50);
assert(V.LifeSimulation.school.duties.completed === 50, "26.10 值勤再次写 50, 实际 " + V.LifeSimulation.school.duties.completed);
var mc26U1 = api24.undoCheatModValue("deadwood-reblooms", "value_set:duties_completed");
assert(mc26U1.ok && V.LifeSimulation.school.duties.completed === 0, "26.10 值勤回退还原首次 before（0）, 实际 " + V.LifeSimulation.school.duties.completed);
api24.setCheatStage("deadwood-reblooms", "dress_active", "revealing");
assert(V.LifeSimulation.school.dress.active === "revealing", "26.10 着装再次写 revealing, 实际 " + V.LifeSimulation.school.dress.active);
var mc26U2 = api24.undoCheatModValue("deadwood-reblooms", "stage_set:dress_active");
assert(mc26U2.ok && V.LifeSimulation.school.dress.active === "uniform", "26.10 着装回退还原首次 before（uniform）, 实际 " + V.LifeSimulation.school.dress.active);
// 26.11) 清理
delete V.RobinExpansion; delete V.LifeSimulation; delete V.StreetLife; delete V.BirdTower; delete V.RobinTemple; delete V.TempleChoir; delete V.mbCE_wrote; delete global.window;

// 27) v1.5.0 誓言修复 + NPC 特质获取：条件读取 → 一键修复誓言 → 获取特质（条件不满足直接改满足）→ 重复/未知拒绝
// 27.1) 誓言状态读取：未破 / 承诺对象 / 神殿等级
V.player = { virginity: { temple: true } };
V.templePromised = "Sydney"; V.temple_rank = "acolyte"; V.temple_burden = 15;
var vs1 = api24.getVowStatus();
assert(vs1.temple === true && vs1.templePromised === "Sydney" && vs1.templeRank === "acolyte" && vs1.templeBurden === 15, "27.1 誓言状态读取：未破 + 承诺 Sydney + 等级 acolyte + 负担 15, 实际 " + JSON.stringify(vs1));
// 27.2) 一键修复誓言：已破（被 Avery）→ 恢复 true + 破誓计数清零 + 承诺对象保留
V.player.virginity.temple = "Avery";
V.brokenVowCount = { Robin: 2, Avery: 1, Undefined: 0 };
var fv1 = api24.fixVows();
assert(fv1.ok && V.player.virginity.temple === true, "27.2 修复誓言：temple 恢复 true, 实际 " + V.player.virginity.temple);
assert(V.brokenVowCount.Robin === 0 && V.brokenVowCount.Avery === 0, "27.2 破誓计数清零, 实际 " + JSON.stringify(V.brokenVowCount));
assert(fv1.after.templePromised === "Sydney", "27.2 承诺对象保留（Sydney）, 实际 " + fv1.after.templePromised);
// 27.3) 特质列表：6 项、初始全部未拥有
var nt1 = api24.listNpcTraits();
assert(nt1.length === 6, "27.3 NPC 特质 6 项, 实际 " + nt1.length);
// 前置节（世界入口/场景直达）可能残留 syndrome* 变量，显式清理模拟「未获取过」的干净初始态
delete V.syndromeeden; delete V.syndromekylar; delete V.syndromewolves; delete V.syndromebird; delete V.robinpaid; delete V.avery_fate;
var nt1b = api24.listNpcTraits();
assert(nt1b.filter(function (t) { return t.owned; }).length === 0, "27.3 初始全部未拥有, owned=" + JSON.stringify(nt1b.filter(function (t) { return t.owned; }).map(function (t) { return t.key; })));
assert(nt1.filter(function (t) { return t.name === "同舟共济—罗宾" || t.name === "斯德哥尔摩综合征：凯拉尔"; }).length === 2, "27.3 汉化名齐全（同舟共济—罗宾 / 斯德哥尔摩综合征：凯拉尔）");
// 27.4) 获取同舟共济—罗宾：条件不满足 → 直接把 robinpaid 改为 1 → owned=true
var gn1 = api24.grantNpcTrait("robin_protector");
assert(gn1.ok && V.robinpaid === 1, "27.4 获取罗宾特质：robinpaid=1, 实际 " + V.robinpaid);
assert(api24.listNpcTraits().filter(function (t) { return t.key === "robin_protector"; })[0].owned === true, "27.4 获取后 owned=true");
// 27.5) 获取伊甸 / 狼群 / 巨鹰
api24.grantNpcTrait("stockholm_eden");
assert(V.syndromeeden === 1, "27.5 获取伊甸：syndromeeden=1, 实际 " + V.syndromeeden);
api24.grantNpcTrait("stockholm_wolves");
assert(V.syndromewolves === 1, "27.5 获取狼群：syndromewolves=1, 实际 " + V.syndromewolves);
api24.grantNpcTrait("stockholm_hawk");
assert(V.syndromebird === 1, "27.5 获取巨鹰：syndromebird=1, 实际 " + V.syndromebird);
// 27.6) 获取凯拉尔：syndromekylar=1；凯拉尔在监狱且玩家不在监狱 → 提示仍不显示（NPC 状态不改）
global.C = { npc: { Kylar: { state: "prison" } } };
V.location = "town";
var gk = api24.grantNpcTrait("stockholm_kylar");
assert(gk.ok && V.syndromekylar === 1, "27.6 获取凯拉尔：syndromekylar=1, 实际 " + V.syndromekylar);
assert(gk.message.indexOf("在监狱") !== -1 && global.C.npc.Kylar.state === "prison", "27.6 凯拉尔在监狱：提示暂不显示且 NPC 状态未改, 实际 " + gk.message);
// 27.7) 获取艾弗里的救星：avery_fate=saved（默认原版线，向后兼容）
var ga = api24.grantNpcTrait("avery_saviour");
assert(ga.ok && V.avery_fate === "saved", "27.7 获取艾弗里救星：avery_fate=saved, 实际 " + V.avery_fate);
// 27.7b) 撤回救星（原版线）：avery_fate 按快照还原为操作前（未定义）
var gv = api24.revertNpcTrait("avery_saviour");
assert(gv.ok && V.avery_fate === undefined, "27.7b 撤回救星（原版线）：avery_fate 还原未定义, 实际 " + V.avery_fate);
assert(api24.listNpcTraits().filter(function (t) { return t.key === "avery_saviour"; })[0].owned === false, "27.7b 撤回后 owned=false");
// 27.7c) 庇护模式：不碰 avery_fate，仅挂 mceAveryShelter 标记，owned=true
delete V.avery_fate; delete V.mceAveryShelter; delete V.mceAveryFateSnapshot;
var gs = api24.grantNpcTrait("avery_saviour", "shelter");
assert(gs.ok && V.avery_fate === undefined && V.mceAveryShelter === true, "27.7c 庇护模式：avery_fate 未改动且 mceAveryShelter=true, 实际 fate=" + V.avery_fate + " shelter=" + V.mceAveryShelter);
assert(api24.listNpcTraits().filter(function (t) { return t.key === "avery_saviour"; })[0].owned === true, "27.7c 庇护模式 owned=true（大楼保留建造进度）");
// 27.7d) 撤回庇护：清除标记，fate 保持未定义
var gd = api24.revertNpcTrait("avery_saviour");
assert(gd.ok && V.mceAveryShelter === undefined && V.avery_fate === undefined, "27.7d 撤回庇护：标记清除且 fate 保持, 实际 shelter=" + V.mceAveryShelter + " fate=" + V.avery_fate);
// 27.7e) saved 线快照还原：模拟获取后手动改值，撤回恢复快照
V.avery_fate = "saved"; V.mceAveryFateSnapshot = "undefined";
var ge = api24.revertNpcTrait("avery_saviour");
assert(ge.ok && V.avery_fate === undefined, "27.7e 撤回 saved 线：fate 还原未定义, 实际 " + V.avery_fate);
// 27.7f) 操作前 fate=fallen：获取后快照 fallen，撤回恢复 fallen（不丢原状态）
delete V.avery_fate; delete V.mceAveryShelter; delete V.mceAveryFateSnapshot;
V.avery_fate = "fallen";
var gf2 = api24.grantNpcTrait("avery_saviour");
assert(gf2.ok && V.avery_fate === "saved" && V.mceAveryFateSnapshot === "fallen", "27.7f 获取：fate=saved 且快照 fallen, 实际 fate=" + V.avery_fate + " 快照=" + V.mceAveryFateSnapshot);
var gr2 = api24.revertNpcTrait("avery_saviour");
assert(gr2.ok && V.avery_fate === "fallen", "27.7f 撤回：fate 恢复 fallen（快照值）, 实际 " + V.avery_fate);
// 27.10) v1.9.2 剧情页分区：原版场景键索引 + 角色映射（VANILLA_SCENE_KEYS 提取自本体 111 键）
var sk1 = api24.isVanillaSceneKey("RobinCrossdressing1");
assert(sk1 === true, "27.10 RobinCrossdressing1 属原版场景, 实际 " + sk1);
var sk2 = api24.isVanillaSceneKey("SomeModNewScene");
assert(sk2 === false, "27.10 非原版键判为 MOD 场景, 实际 " + sk2);
assert(api24.VANILLA_SCENE_KEYS.length === 111, "27.10 原版场景键索引 111 条, 实际 " + api24.VANILLA_SCENE_KEYS.length);
assert(api24.sceneRoleOf("AveryHelicopter") === "艾弗里 Avery", "27.10 AveryHelicopter → 艾弗里分组, 实际 " + api24.sceneRoleOf("AveryHelicopter"));
assert(api24.sceneRoleOf("TempleVigil") === "神殿 Temple", "27.10 TempleVigil → 神殿分组, 实际 " + api24.sceneRoleOf("TempleVigil"));
assert(api24.sceneRoleOf("RobinUndergroundDice") === "罗宾 Robin", "27.10 RobinUndergroundDice → 罗宾分组, 实际 " + api24.sceneRoleOf("RobinUndergroundDice"));
assert(api24.sceneRoleOf("NightmareWraith") === "噩梦梦境 Nightmare", "27.10 NightmareWraith → 噩梦分组, 实际 " + api24.sceneRoleOf("NightmareWraith"));
assert(api24.sceneRoleOf("MickeyPubFameIntro") === "米奇 Mickey", "27.10 MickeyPubFameIntro → 米奇分组, 实际 " + api24.sceneRoleOf("MickeyPubFameIntro"));
// 27.11) 任务三：非场景剧情进度控制（按角色收纳，配置真实变量 + 点路径写入 + 动作）
var pl1 = api24.getRolePlots("艾弗里 Avery");
assert(!!pl1 && pl1.items.length >= 5, "27.11 艾弗里剧情进度配置存在且 ≥5 项, 实际 " + (pl1 ? pl1.items.length : "无"));
var pl2 = api24.getRolePlots("罗宾 Robin");
assert(!!pl2 && pl2.items.length >= 3, "27.11 罗宾剧情进度配置存在且 ≥3 项, 实际 " + (pl2 ? pl2.items.length : "无"));
var pl3 = api24.getRolePlots("凯拉尔 Kylar");
assert(!!pl3 && pl3.items.length >= 5, "27.11 凯拉尔剧情进度配置存在且 ≥5 项, 实际 " + (pl3 ? pl3.items.length : "无"));
assert(api24.getRolePlots("惠特尼 Whitney") === null, "27.11 未配置角色返回 null（不误挂进度块）");
// 点路径写入：avery_tower.progress=85 / stage=3
delete V.avery_tower;
api24.setDotPath("avery_tower.progress", 85);
assert(V.avery_tower && V.avery_tower.progress === 85, "27.11 点路径写入 avery_tower.progress=85, 实际 " + (V.avery_tower && V.avery_tower.progress));
api24.setDotPath("avery_tower.stage", 3);
assert(V.avery_tower.stage === 3, "27.11 点路径写入 avery_tower.stage=3, 实际 " + V.avery_tower.stage);
assert(api24.getDotPath("avery_tower.progress") === 85, "27.11 点路径读取 avery_tower.progress=85");
assert(api24.getDotPath("no_such.path") === undefined, "27.11 不存在路径读取为 undefined（不抛错）");
// 动作：partyGuests 补全 + kylarSeen 补全
delete V.avery_party; delete V.kylarSeen;
var pg = api24.applyRolePlotAction("partyGuests");
assert(Array.isArray(V.avery_party.guests) && V.avery_party.guests.length === 5, "27.11 partyGuests 补全 5 区域, 实际 " + (V.avery_party.guests || []).length + "：" + pg);
var ks = api24.applyRolePlotAction("kylarSeen");
assert(Array.isArray(V.kylarSeen) && V.kylarSeen.length === 8, "27.11 kylarSeen 补全 8 标记, 实际 " + (V.kylarSeen || []).length + "：" + ks);
delete V.avery_tower; delete V.avery_party; delete V.kylarSeen;
// 27.12) v1.9.2 自查：MOD 运行时注入场景（V.scenes 缓存键）必须进入 getScenesDefs（MOD 区不空）
V.scenes = { TestModRuntimeScene: { name: "MOD-运行时新场景", startPassage: "TestModRuntimeScene", passages: [], unlocked: true } };
var sd12 = api24.getScenesDefs();
assert(sd12.defs && sd12.defs.TestModRuntimeScene !== undefined, "27.12 运行时注入键（V.scenes）进入 getScenesDefs, 实际含键 " + JSON.stringify(Object.keys(sd12.defs || {})));
delete V.scenes;
// 27.13) v1.9.2 自查：MOD 扩展 setup.NPCNameList（原版角色池扩展机制）不得污染 isVanillaNPC/charCategory
try {
	setup.NPCNameList = (setup.NPCNameList || []).concat(["Alice", "Liddell", "Seath", "Luna", "TestNPC"]);
} catch (e) { setup.NPCNameList = ["Alice", "Liddell", "Seath", "Luna", "TestNPC"]; }
assert(api24.charCategory("Alice") === "mod", "27.13 MOD 角色 Alice 归 mod（NPCNameList 扩展不再误判原版）, 实际 " + api24.charCategory("Alice"));
assert(api24.charCategory("Liddell") === "mod", "27.13 MOD 角色 Liddell 归 mod");
assert(api24.charCategory("Seath") === "mod", "27.13 MOD 角色 Seath 归 mod");
assert(api24.charCategory("Luna") === "mod", "27.13 MOD 角色 Luna 归 mod");
assert(api24.charCategory("TestNPC") === "mod", "27.13 MOD 角色 TestNPC 归 mod");
assert(api24.charCategory("Robin") === "love", "27.13 原版恋爱角色 Robin 仍归 love, 实际 " + api24.charCategory("Robin"));
assert(api24.charCategory("Mason") === "normal", "27.13 原版普通角色 Mason 仍归 normal, 实际 " + api24.charCategory("Mason"));
/* 模组分区内细分（恋爱/普通）的 DOM 归属断言见 smoke 16 节（jsdom 环境 window.maplebirch 未被替换，
   可注入 loveInterest 标记；test_mce 的 window.maplebirch 中途被各 MOD 测试整体替换致 MB 缓存陈旧，
   恋爱判定在此环境不可注入，故数据层不重复断言） */
// 27.8) 未知特质拒绝
var gx = api24.grantNpcTrait("no_such_trait");
assert(gx.ok === false && gx.message.indexOf("未知特质") !== -1, "27.8 未知特质拒绝, 实际 " + gx.message);
// 27.9) 清理
delete V.player; delete V.templePromised; delete V.temple_rank; delete V.temple_burden; delete V.brokenVowCount; delete V.robinpaid; delete V.syndromeeden; delete V.syndromekylar; delete V.syndromewolves; delete V.syndromebird; delete V.avery_fate; delete V.mceAveryShelter; delete V.mceAveryFateSnapshot; delete V.location; delete global.C;

// 28) v1.5.0 与原有功能协同/隔离检验：恋爱解锁 ↔ 特质获取 / 场景直达 ↔ 特质状态 / 誓言修复 ↔ 恋爱 / Mod作弊 ↔ robinpaid 隔离 / 全局批量不碰新变量
// 28.1) 恢复恋爱条件环境（第 7 节容错测试清空过 window，重新挂载完整框架 npc）
global.window = { modUtils: { getMod: function (n) { return n === "DomRobin" ? {} : undefined; } }, maplebirch: { npc: { NPCNameList: ["Robin", "Whitney", "Kylar", "Sydney", "Eden", "Avery", "Black Wolf", "Great Hawk", "Alex", "Gwylan", "Luna", "Raven", "Zephyr", "Ivory Wraith"], romanceConditions: rc, customStats: {}, type: { loveInterestNpcs: ["Luna"], importantNPCs: [], specialNPCs: [] } }, tool: { addTo() {} }, on() {}, get: function (n) { return (n === "RobinTemple" || n === "TempleChoir" || n === "DeadwoodReblooms") ? {} : undefined; } } };
delete V.loveInterest; delete V.loveInterestList;
// 28.2) 特质获取 → 恋爱解锁协同：获取「斯德哥尔摩综合征：伊甸」后 Eden 恋爱条件（syndromeeden===1）满足，可正常解锁
api24.grantNpcTrait("stockholm_eden");
assert(V.syndromeeden === 1, "28.2 获取伊甸特质：syndromeeden=1");
var es28 = api24.getRomanceStages("Eden");
assert(Array.isArray(es28) && es28.length >= 1, "28.2 Eden 恋爱阶段可枚举, 实际 " + es28.length);
var er28 = api24.completeRomanceStage("Eden", es28[0]);
assert(er28.ok === true, "28.2 特质获取后 Eden 恋爱一键完成正常（条件已满足）, 实际 " + (er28.message || ""));
// 28.3) 恋爱解锁不影响特质状态：Eden 特质仍 owned=true
var ed28 = api24.listNpcTraits().filter(function (t) { return t.key === "stockholm_eden"; })[0];
assert(ed28.owned === true, "28.3 恋爱解锁后特质状态仍 owned=true");
// 28.4) 场景直达/世界入口与特质状态一致：世界入口写 syndromekylar=1（与特质获取同值 1），特质 owned=true 且再次获取不报错
V.syndromekylar = 1;
var ky28 = api24.listNpcTraits().filter(function (t) { return t.key === "stockholm_kylar"; })[0];
assert(ky28.owned === true, "28.4 世界入口已写 syndromekylar=1 → 特质状态 owned=true（一致）");
var ky28b = api24.grantNpcTrait("stockholm_kylar");
assert(ky28b.ok && V.syndromekylar === 1, "28.4 已满足后再获取：仍返回成功且值不变, 实际 " + V.syndromekylar);
// 28.5) 誓言修复与恋爱协同：修复誓言（承诺对象 Sydney 保留）后 Sydney 恋爱一键完成不受影响
V.player = { virginity: { temple: false } };
V.templePromised = "Sydney";
api24.fixVows();
assert(V.player.virginity.temple === true && V.templePromised === "Sydney", "28.5 修复誓言：temple=true 且承诺 Sydney 保留");
var ss28 = api24.getRomanceStages("Sydney");
var sr28 = api24.completeRomanceStage("Sydney", ss28[0]);
assert(sr28.ok === true, "28.5 誓言修复后 Sydney 恋爱一键完成正常, 实际 " + (sr28.message || ""));
// 28.6) Mod作弊 与 robinpaid 隔离：DomRobin 适配器不含原版罗宾线变量（20.2 边界），新特质写入 robinpaid=1 不被适配器覆盖
var dm28 = api24.getCheatMods().filter(function (x) { return x.modId === "dom_robin"; })[0];
assert(dm28 && dm28.values.filter(function (v) { return v.varPath === "robinpaid" || v.varPath.indexOf("robinpaid") !== -1; }).length === 0 &&
       dm28.stages.filter(function (s) { return s.varPath === "robinpaid"; }).length === 0, "28.6 DomRobin 适配器不含 robinpaid（边界隔离保持）");
V.RobinExpansion = { ls_stage: 0, lemonade: 0 };
api24.grantNpcTrait("robin_protector");
assert(V.robinpaid === 1, "28.6 获取罗宾特质：robinpaid=1");
var dr28 = api24.setCheatStage("dom_robin", "ls_stage", 2);
assert(dr28.ok && V.robinpaid === 1 && V.liveStreamStage === 2, "28.6 Mod作弊 写入 DomRobin 直播阶段后 robinpaid 保持 1（互不覆盖）, 实际 robinpaid=" + V.robinpaid + " liveStreamStage=" + V.liveStreamStage);
// 28.7) 全局批量（globalFill）不碰新变量：执行后 robinpaid / syndrome* / avery_fate 保持
var gf28 = api24.globalFill();
assert(gf28.characters >= 1, "28.7 全局补齐枚举角色正常, 实际 " + gf28.characters + " 个");
assert(V.robinpaid === 1 && V.syndromeeden === 1 && V.avery_fate === undefined, "28.7 全局补齐数值后特质变量保持（robinpaid=1 syndromeeden=1 avery_fate=undefined）, 实际 robinpaid=" + V.robinpaid + " syndromeeden=" + V.syndromeeden + " avery_fate=" + V.avery_fate);
// ============ 第 29 节：艾弗里庄园 Mansion 段落 $daily.avery.talk 兜底（v1.5.1，修复 Mansion Talk 崩溃） ============
// 背景：本体 $daily.avery.talk 只在 avery_mansion_init（首次进庄园）/0.5.7.1 迁移时创建；场景直达、重放、
// 固定触发或新档未开艾弗里线时进 Mansion 系段落（Mansion Talk 调 avery_daily_talk 读 talk.chat、正文读
// talk.ignore/.limit）会因 talk 缺失 TypeError（reading 'chat'/'ignore'）→ ensureAveryMansion 逐层补齐 +
// onPassageOverride 对 Mansion/Avery 段落无条件兜底
// 29.1) daily.avery.talk 整体缺失 → ensureAveryMansion 补齐默认结构
V.daily = { avery: {} };
api24.ensureAveryMansion();
assert(V.daily.avery.talk && V.daily.avery.talk.chat === 0 && V.daily.avery.talk.ignore === false &&
       V.daily.avery.talk.limit === false && V.daily.avery.talk.annoyed === 0 &&
       typeof V.daily.avery.talk.chat_limit === "number", "29.1 talk 缺失时补齐（chat=0 ignore=false limit=false annoyed=0 chat_limit 数值）, 实际 chat=" +
       (V.daily.avery.talk && V.daily.avery.talk.chat) + " ignore=" + (V.daily.avery.talk && V.daily.avery.talk.ignore));
assert(V.daily.avery.ask && V.daily.avery.ask.science === false, "29.1 ask 子对象同步补齐");
// 29.2) $daily 整体缺失 → ensureAveryMansion 防御建最小壳（不抛错且 talk 可用）
delete V.daily;
api24.ensureAveryMansion();
assert(V.daily && V.daily.avery && V.daily.avery.talk && V.daily.avery.talk.chat === 0, "29.2 $daily 缺失时防御建壳（daily.avery.talk.chat=0 可用）");
// 29.3) talk 对象存在但字段缺失（chat_limit/annoyed 缺失）→ 逐字段补齐且不覆盖已有值
V.daily = { avery: { talk: { chat: 2, ignore: true } } };
api24.ensureAveryMansion();
assert(V.daily.avery.talk.chat === 2 && V.daily.avery.talk.ignore === true, "29.3 已有值 chat=2 ignore=true 不被覆盖");
assert(V.daily.avery.talk.chat_limit === 3 && V.daily.avery.talk.annoyed === 0 && V.daily.avery.talk.limit === false &&
       V.daily.avery.talk.flirt === false && V.daily.avery.talk.seduce === false, "29.3 缺失字段补齐（chat_limit=3 annoyed=0 limit/flirt/seduce=false）, 实际 chat_limit=" + V.daily.avery.talk.chat_limit);
// 29.4) onPassageOverride 对 Mansion 段落无条件兜底：talk 缺失时跳转 Mansion Talk 前已重建
V.daily = { avery: {} };
api24.onPassageOverride({ name: "Mansion Talk" });
assert(V.daily.avery.talk && V.daily.avery.talk.chat === 0 && V.daily.avery.talk.ignore === false,
       "29.4 跳转 Mansion Talk 前兜底重建 talk（chat=0 ignore=false）, 实际 chat=" + (V.daily.avery.talk && V.daily.avery.talk.chat));
// 29.5) 非 Mansion 段落不触发兜底（保持原状）
V.daily = { avery: {} };
api24.onPassageOverride({ name: "Start" });
assert(V.daily.avery.talk === undefined, "29.5 非庄园段落不触发兜底（talk 保持缺失）, 实际 " + typeof V.daily.avery.talk);
// 29.6) Mansion 系段落名变体全覆盖（Mansion Intro / Avery's / Avery 开头）
V.daily = { avery: {} };
api24.onPassageOverride({ name: "Mansion Intro" });
assert(V.daily.avery.talk !== undefined, "29.6 Mansion Intro 触发兜底");
V.daily = { avery: {} };
api24.onPassageOverride({ name: "Avery's Mansion" });
assert(V.daily.avery.talk !== undefined, "29.6 Avery's Mansion 触发兜底");
// 29.7) 28 节残留清理
delete V.player; delete V.templePromised; delete V.robinpaid; delete V.syndromeeden; delete V.syndromekylar; delete V.RobinExpansion; delete global.window;

// 30) v1.5.2 剧情页页首使用提示（页首常驻、位于锚定触发状态横幅之前；v1.9.23：文案随「固定触发 → 锚定触发」改版——锚定后走到地点弹确认条，触发一次自动完成并停止，退出场景返回原位）
const SRC_NOW = fs.readFileSync(jsPath, "utf8");
const WARN_TXT = "使用提示：锚定剧情后，走到该剧情发生地点并交互时会弹确认条（含地点/时间/前置说明），确认后触发、播放完标「已完成 ✓」；「暂不触发」保留待下次。旧「固定触发」已移除，「一键完成」「场景直达」保留；若需恢复原版随机触发，点顶部横幅「清空队列」即可。";
assert(SRC_NOW.includes(WARN_TXT), "30.1 剧情页页首提示文案已写入源码（锚定语义，不写旧版固定触发说法）");
const RSI = SRC_NOW.indexOf("function renderScenes()");
const RNEXT = SRC_NOW.indexOf("锚定触发状态横幅", RSI);
const WARN_I = SRC_NOW.indexOf("mce-warn", RSI);
assert(RSI >= 0 && RNEXT > RSI && WARN_I > RSI && WARN_I < RNEXT, "30.2 提示位于 renderScenes 页首（锚定触发状态横幅之前）");
assert(SRC_NOW.includes(".mce-warn{"), "30.3 mce-warn 警示样式已注入 CSS");

// ============ 第 31 节：v1.6.0 归途之书 1.3.4 补录——LostLamb + TempleDuties 适配（1.3.1 起漏适配根因闭环） ============
global.window = { maplebirch: { npc: {}, get: function (n) { return (n === "RobinTemple" || n === "TempleChoir" || n === "LostLamb" || n === "TempleDuties" || n === "DeadwoodReblooms") ? {} : undefined; } } };
delete V.mbCE_wrote;
V.LostLamb = { recalled: false, active: false, scene: "", doubt: 0, fear: 10, notice: 0, ending: "", talkVow: "", known: { bishop: false, gwylan: false, auriga: false } };
V.TempleDuties = { enrolled: false, review: false, duties: 0, oath: "", bishop: "none", manor: "none", declaration: "private", case: { stage: "field" }, archive: { roof: -1, shelves: -1, sorted: 0 }, candidates: { Robin: { agreed: false }, Sydney: { agreed: false } } };
var r31 = api.getCheatMods().filter(function (x) { return x.modId === "revelation-the-book-of-return"; })[0];
assert(r31 && r31.modName.indexOf("归途之书") !== -1 && /v1\.4\.\d+/.test(r31.modName), "31.1 适配器声明已升级到 1.4.x 最新（版本无关断言，当前 " + (r31 && r31.modName) + "）");
assert(r31.stages.filter(function (s) { return s.key === "ll_vow"; }).length === 1 && r31.stages.filter(function (s) { return s.key === "td_oath"; }).length === 1 &&
       r31.stages.filter(function (s) { return s.varPath === "TempleDuties.case.stage"; }).length === 1, "31.1 LostLamb 誓约 / TempleDuties 誓言·案件阶段已收录");
assert(r31.abilities.filter(function (a) { return a.varPath === "LostLamb.known.bishop"; }).length === 1 &&
       r31.abilities.filter(function (a) { return a.varPath === "TempleDuties.candidates.Robin.agreed"; }).length === 1 &&
       r31.abilities.filter(function (a) { return a.varPath === "RBR.necklace.returnedOnce"; }).length === 1 &&
       r31.abilities.filter(function (a) { return a.varPath === "RBR.necklace.retaken"; }).length === 1 &&
       r31.abilities.filter(function (a) { return a.varPath === "RBR.necklace.reclaimed"; }).length === 1 &&
       r31.stages.filter(function (s) { return s.varPath === "RBR.necklace.stage"; }).length === 1, "31.1 秘密/候选/项链归还（1.4.6 改 returnedOnce）/项链取回（retaken）/项链已取回（reclaimed）/项链回收线阶段（stage）能力已收录");
// 31.2) LostLamb 阶段写入读回
var rll = api.setCheatStage("revelation-the-book-of-return", "ll_vow", "sealed");
assert(rll.ok && V.LostLamb.talkVow === "sealed", "31.2 LostLamb 誓约写入 sealed, 实际 " + V.LostLamb.talkVow);
var rll2 = api.setCheatStage("revelation-the-book-of-return", "ll_ending", "main");
assert(rll2.ok && V.LostLamb.ending === "main", "31.2 梦境结局写入 main");
// 31.3) LostLamb 数值钳制（七巡：fear 上限 100→1000）
api.applyCheatModValue("revelation-the-book-of-return", "ll_fear", 999);
assert(V.LostLamb.fear === 999, "31.3 恐惧写入 999（上限 1000），实际 " + V.LostLamb.fear);
api.applyCheatModValue("revelation-the-book-of-return", "ll_fear", 9999);
assert(V.LostLamb.fear === 9999, "31.3 恐惧上限不钳制（写 9999 原样）, 实际 " + V.LostLamb.fear);
api.applyCheatModValue("revelation-the-book-of-return", "ll_notice", -5);
assert(V.LostLamb.notice === 0, "31.3 觉察越下限钳制到 0");
// 31.4) LostLamb 能力
api.toggleCheatAbility("revelation-the-book-of-return", "ll_recalled", true);
assert(V.LostLamb.recalled === true, "31.4 回想起童年能力启用");
api.toggleCheatAbility("revelation-the-book-of-return", "ll_known_gwylan", true);
assert(V.LostLamb.known.gwylan === true, "31.4 已知格威岚秘密启用");
// 31.5) TempleDuties 阶段
var rtd = api.setCheatStage("revelation-the-book-of-return", "td_oath", "care");
assert(rtd.ok && V.TempleDuties.oath === "care", "31.5 值勤誓言写入 care, 实际 " + V.TempleDuties.oath);
var rtd2 = api.setCheatStage("revelation-the-book-of-return", "td_bishop", "accepted");
assert(rtd2.ok && V.TempleDuties.bishop === "accepted", "31.5 主教进展写入 accepted");
var rtd4 = api.setCheatStage("revelation-the-book-of-return", "td_case", "report");
assert(rtd4.ok && V.TempleDuties.case.stage === "report", "31.5 案件阶段写入 report");
// 31.6) TempleDuties 数值
api.applyCheatModValue("revelation-the-book-of-return", "td_duties", 42);
assert(V.TempleDuties.duties === 42, "31.6 值勤次数写入 42");
api.applyCheatModValue("revelation-the-book-of-return", "td_sorted", 7);
assert(V.TempleDuties.archive.sorted === 7, "31.6 归档次数写入 7");
// 31.7) TempleDuties 能力
api.toggleCheatAbility("revelation-the-book-of-return", "td_enrolled", true);
assert(V.TempleDuties.enrolled === true, "31.7 已加入值勤启用");
api.toggleCheatAbility("revelation-the-book-of-return", "td_robin_agree", true);
assert(V.TempleDuties.candidates.Robin.agreed === true, "31.7 罗宾候选同意启用");
// 31.9) 回退
api.undoCheatModValue("revelation-the-book-of-return", "value_set:td_duties");
assert(V.TempleDuties.duties === 0, "31.9 值勤次数回退到 0, 实际 " + V.TempleDuties.duties);
api.undoCheatModValue("revelation-the-book-of-return", "value_set:ll_fear");
assert(V.LostLamb.fear === 10, "31.9 恐惧回退到初始 10");
// 31.11) v1.8.23 新增 1.3.10 项链归还能力（RBR.necklace.returned 主开关）；1.9.24 适配 1.4.6：键重构为 RBR.necklace.returnedOnce + 新增 nkl_retaken（RBR.necklace.retaken）；1.9.25 补 nkl_reclaimed（reclaimed）+ nkl_stage（回收线阶段）
V.RBR = { necklace: { returnedOnce: false, retaken: 0, reclaimed: false, stage: '' } };
var nkl = api.toggleCheatAbility("revelation-the-book-of-return", "nkl_returned", true);
assert(nkl.ok && V.RBR.necklace.returnedOnce === true, "31.11 项链归还能力启用, 实际 " + V.RBR.necklace.returnedOnce);
api.toggleCheatAbility("revelation-the-book-of-return", "nkl_returned", false);
assert(V.RBR.necklace.returnedOnce === false, "31.11 项链归还能力禁用");
var nkl2 = api.toggleCheatAbility("revelation-the-book-of-return", "nkl_retaken", true);
assert(nkl2.ok && V.RBR.necklace.retaken === 1, "31.11 项链取回能力启用, 实际 " + V.RBR.necklace.retaken);
api.toggleCheatAbility("revelation-the-book-of-return", "nkl_retaken", false);
assert(V.RBR.necklace.retaken === 0, "31.11 项链取回能力禁用");
var nkl3 = api.toggleCheatAbility("revelation-the-book-of-return", "nkl_reclaimed", true);
assert(nkl3.ok && V.RBR.necklace.reclaimed === true, "31.11 项链已取回能力启用, 实际 " + V.RBR.necklace.reclaimed);
api.toggleCheatAbility("revelation-the-book-of-return", "nkl_reclaimed", false);
assert(V.RBR.necklace.reclaimed === false, "31.11 项链已取回能力禁用");
var nkls = api.setCheatStage("revelation-the-book-of-return", "nkl_stage", "take");
assert(nkls.ok && V.RBR.necklace.stage === "take", "31.11 回收线阶段写入 take, 实际 " + V.RBR.necklace.stage);
var nkls2 = api.setCheatStage("revelation-the-book-of-return", "nkl_stage", "smash");
assert(nkls2.ok && V.RBR.necklace.stage === "smash", "31.11 回收线阶段写入 smash, 实际 " + V.RBR.necklace.stage);
// 31.10) 原版键隔离：不暴露 temple_rank/templePromised
assert(r31.values.filter(function (v) { return v.varPath === "temple_rank" || v.varPath.indexOf("temple_rank") !== -1 || v.varPath.indexOf("templePromised") !== -1; }).length === 0 &&
       r31.stages.filter(function (s) { return s.varPath === "temple_rank" || s.varPath.indexOf("temple_rank") !== -1; }).length === 0, "31.10 原版神殿变量未暴露");
delete V.LostLamb; delete V.TempleDuties; delete V.mbCE_wrote;

// ============ 第 32 节：v1.6.0 枯木逢春 2.2.7 核对——vanilla-plus attitudes 新能力 + 旧声明兼容 ============
V.RobinExpansion = { shop_stage: "none", asylum: { status: "home" } };
V.VanillaPlus = { attitudes: { ironWill: true, sadomasochist: false } };
var dw32 = api.getCheatMods().filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
assert(dw32 && dw32.modName.indexOf("枯木逢春") !== -1 && /2\.5\.\d+/.test(dw32.modName), "32.1 适配器声明已升级到 2.5.x 最新（版本无关断言，当前 " + (dw32 && dw32.modName) + "）");
assert(dw32.abilities.filter(function (a) { return a.varPath === "VanillaPlus.attitudes.ironWill"; }).length === 1 &&
       dw32.abilities.filter(function (a) { return a.varPath === "VanillaPlus.attitudes.sadomasochist"; }).length === 1 &&
       dw32.stages.filter(function (s) { return s.varPath === "MoreTransformations.harbour.zephyr.stage"; }).length === 1, "32.1 铁意志/受虐狂能力 + 冷月港·泽菲尔线阶段已收录");
// 32.2) attitudes 能力读写
api.toggleCheatAbility("deadwood-reblooms", "vp_sadomaso", true);
assert(V.VanillaPlus.attitudes.sadomasochist === true, "32.2 受虐狂特质启用");
api.toggleCheatAbility("deadwood-reblooms", "vp_ironwill", false);
assert(V.VanillaPlus.attitudes.ironWill === false, "32.2 铁意志特质禁用");
// 32.3) 2.2.7 下旧声明仍有效：阶段越界拒绝 + 收容所写入
var dwBad = api.setCheatStage("deadwood-reblooms", "r_shop_stage", "bogus");
assert(dwBad.ok === false, "32.3 旧声明阶段越界拒绝仍有效（2.2.7 兼容）");
var dwAsy = api.setCheatStage("deadwood-reblooms", "r_asylum", "admitted");
assert(dwAsy.ok && V.RobinExpansion.asylum.status === "admitted", "32.3 收容所阶段写入 admitted（2.2.7 兼容）, 实际 " + JSON.stringify(V.RobinExpansion.asylum));
delete V.RobinExpansion; delete V.VanillaPlus; delete V.mbCE_wrote;
// 32.4) 2.4.5/2.4.6 CoinCave 金币洞穴：声明 + 布尔/数值写入（入口源码：Widgets.twee _coinCave=$MoreTransformations.treasure；found 跳过岛屿探索 100 次门槛；2.4.6 适配轮：agreed 已删——2.4.5 起源码即零证据）
V.MoreTransformations = { treasure: { torch: 0, coins: 0, museumCoins: 0, crewCoins: 0, zephyrCoins: 0 } };
var dw32b = api.getCheatMods().filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
assert(dw32b.abilities.filter(function (a) { return a.varPath === "MoreTransformations.treasure.found"; }).length === 1 &&
       dw32b.abilities.filter(function (a) { return a.varPath === "MoreTransformations.treasure.appraised"; }).length === 1 &&
       dw32b.abilities.filter(function (a) { return a.varPath === "MoreTransformations.treasure.agreed"; }).length === 0,
       "32.4 CoinCave 布尔能力已收录 found/appraised，agreed 已移除（2.4.6 源码零证据）");
assert(dw32b.values.filter(function (v) { return v.varPath === "MoreTransformations.treasure.torch"; }).length === 1 &&
       dw32b.values.filter(function (v) { return v.varPath === "MoreTransformations.treasure.coins"; }).length === 1 &&
       dw32b.values.filter(function (v) { return v.varPath === "MoreTransformations.treasure.museumCoins"; }).length === 1 &&
       dw32b.values.filter(function (v) { return v.varPath === "MoreTransformations.treasure.crewCoins"; }).length === 1 &&
       dw32b.values.filter(function (v) { return v.varPath === "MoreTransformations.treasure.zephyrCoins"; }).length === 1,
       "32.4 CoinCave 5 个数值已收录（torch/coins/museum/crew/zephyr）");
api.toggleCheatAbility("deadwood-reblooms", "cc_found", true);
assert(V.MoreTransformations.treasure.found === true, "32.4 found 勾选 → 已发现洞窟");
api.applyCheatModValue("deadwood-reblooms", "cc_torch", 30);
assert(V.MoreTransformations.treasure.torch === 30, "32.4 火把写 30, 实际 " + V.MoreTransformations.treasure.torch);
api.applyCheatModValue("deadwood-reblooms", "cc_torch", 200);
assert(V.MoreTransformations.treasure.torch === 200, "32.4 火把上限不钳制（写 200 原样）");
// 32.5) 2.4.5 新增悉尼 NPC 转化（框架 $maplebirch.npc.sydney.transformation.<type>.build，level 由 build 派生：angel 25..50 / fallen 1/21/31 / demon 5..30 max 100）
var _mb32Before = V.maplebirch;
V.maplebirch = { npc: { sydney: { transformation: { angel: { build: 0 }, fallen: { build: 0 }, demon: { build: 0 } } } } };
assert(dw32b.values.filter(function (v) { return v.varPath === "maplebirch.npc.sydney.transformation.angel.build"; }).length === 1 &&
       dw32b.values.filter(function (v) { return v.varPath === "maplebirch.npc.sydney.transformation.fallen.build"; }).length === 1 &&
       dw32b.values.filter(function (v) { return v.varPath === "maplebirch.npc.sydney.transformation.demon.build"; }).length === 1,
       "32.5 悉尼三形态转化数值已收录（angel/fallen/demon）");
api.applyCheatModValue("deadwood-reblooms", "sy_angel_build", 50);
assert(V.maplebirch.npc.sydney.transformation.angel.build === 50, "32.5 天使点数写 50（满级 6）, 实际 " + V.maplebirch.npc.sydney.transformation.angel.build);
api.applyCheatModValue("deadwood-reblooms", "sy_demon_build", 90);
assert(V.maplebirch.npc.sydney.transformation.demon.build === 90, "32.5 恶魔点数写 90（触发原版受孕强化判定门槛）, 实际 " + V.maplebirch.npc.sydney.transformation.demon.build);
api.applyCheatModValue("deadwood-reblooms", "sy_demon_build", 500);
assert(V.maplebirch.npc.sydney.transformation.demon.build === 500, "32.5 恶魔点数上限不钳制（写 500 原样）");
if (_mb32Before !== undefined) { V.maplebirch = _mb32Before; } else { delete V.maplebirch; }
delete V.MoreTransformations; delete V.mbCE_wrote;

// 32.6) v1.9.6 扩展轮：原版增强六项突破特质 + 三位一体 + 诡异镜子 + 健身房会员 + 赌场疑心 + 着装审批联动
V.VanillaPlus = {
	attitudes: { ironWill: true, sadomasochist: true },
	traits: { willpower: false, physique: false, beauty: false, exhibitionism: false, deviancy: false, promiscuity: false, incorrigible: false },
	divineTransformations: { prayer: { holy: false, stone: false, dark: false }, trinity: false },
	deviancy: { mirrors: { home: false, farm: false, tower: false, temple: false, sirris: false, kylar: false } }
};
var dw32c = api.getCheatMods().filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
// 32.6.1) 声明收录
var dwVpPaths = dw32c.abilities.map(function (a) { return a.varPath; });
["VanillaPlus.traits.willpower","VanillaPlus.traits.physique","VanillaPlus.traits.beauty","VanillaPlus.traits.exhibitionism","VanillaPlus.traits.deviancy","VanillaPlus.traits.promiscuity","VanillaPlus.traits.incorrigible",
 "VanillaPlus.divineTransformations.prayer.holy","VanillaPlus.divineTransformations.prayer.stone","VanillaPlus.divineTransformations.prayer.dark","VanillaPlus.divineTransformations.trinity",
 "VanillaPlus.deviancy.mirrors.home","VanillaPlus.deviancy.mirrors.farm","VanillaPlus.deviancy.mirrors.tower","VanillaPlus.deviancy.mirrors.temple","VanillaPlus.deviancy.mirrors.sirris","VanillaPlus.deviancy.mirrors.kylar"].forEach(function (p) {
	assert(dwVpPaths.indexOf(p) !== -1, "32.6.1 原版增强键已收录 " + p);
});
assert(dw32c.stages.filter(function (s) { return s.varPath === "LifeSimulation.gym.membership"; }).length === 1, "32.6.1 健身房会员阶段已收录");
assert(dw32c.values.filter(function (v) { return v.varPath === "LifeSimulation.casino.suspicion"; }).length === 1 &&
	   dw32c.abilities.filter(function (a) { return a.varPath === "LifeSimulation.medicine.review.pending"; }).length === 1, "32.6.1 赌场疑心值 + 医务待审已收录");
// 宿主初始化（写入前置）
V.LifeSimulation = { gym: { membership: "none", expires_at: 0, sessions_today: 0 }, casino: { suspicion: 0 }, medicine: { review: { day: -1, shared: false, pending: false } } };
// 32.6.2) 写入生效
api.toggleCheatAbility("deadwood-reblooms", "vp_trait_physique", true);
assert(V.VanillaPlus.traits.physique === true, "32.6.2 体能突破特质勾选生效");
api.toggleCheatAbility("deadwood-reblooms", "vp_trinity", true);
assert(V.VanillaPlus.divineTransformations.trinity === true, "32.6.2 三位一体勾选生效");
api.toggleCheatAbility("deadwood-reblooms", "vp_mirror_temple", true);
assert(V.VanillaPlus.deviancy.mirrors.temple === true, "32.6.2 神殿镜子勾选生效");
api.setCheatStage("deadwood-reblooms", "gym_membership", "year");
assert(V.LifeSimulation.gym.membership === "year", "32.6.2 健身房年卡写入, 实际 " + V.LifeSimulation.gym.membership);
assert(typeof V.LifeSimulation.gym.expires_at === "number" && V.LifeSimulation.gym.expires_at > Math.floor(Date.now() / 1000),
	   "32.6.2 写会员联动给十年有效期（expires_at > 当前）, 实际 " + V.LifeSimulation.gym.expires_at + " / now=" + Math.floor(Date.now() / 1000));
api.applyCheatModValue("deadwood-reblooms", "ls_casino_suspicion", 60);
assert(V.LifeSimulation.casino.suspicion === 60, "32.6.2 赌场疑心写 60（≥60 触发可疑判定）");
// 32.6.3) 着装规范联动：写 active 同时清 proposal、升 highest、清试行期（模组 School.ts 状态机一致）
V.LifeSimulation.school = { dress: { active: "uniform", highest: "free", previous: "uniform", proposal: "revealing", trialUntil: 800, cooldownUntil: 0 } };
var dwSync = api.setCheatStage("deadwood-reblooms", "dress_active", "mandatoryNudity");
assert(dwSync.ok === true, "32.6.3 着装规范写入强制裸体成功");
assert(V.LifeSimulation.school.dress.active === "mandatoryNudity", "32.6.3 active=强制裸体");
assert(V.LifeSimulation.school.dress.proposal === null, "32.6.3 待审批申请已清（proposal=null）, 实际 " + JSON.stringify(V.LifeSimulation.school.dress.proposal));
assert(V.LifeSimulation.school.dress.highest === "mandatoryNudity", "32.6.3 保住过的最高政策已同步（highest=强制裸体）, 实际 " + V.LifeSimulation.school.dress.highest);
assert(V.LifeSimulation.school.dress.trialUntil === 0, "32.6.3 试行期已清零（trialUntil=0）, 实际 " + V.LifeSimulation.school.dress.trialUntil);
// 32.6.4) 联动降级语义：把 active 降回 uniform 时 highest 只升不降
api.setCheatStage("deadwood-reblooms", "dress_active", "uniform");
assert(V.LifeSimulation.school.dress.active === "uniform" && V.LifeSimulation.school.dress.highest === "mandatoryNudity", "32.6.4 active 回退但 highest 保持强制裸体（保住过的最高不降）");
// 32.6.5) 联动中间值语义：写回 revealing（档位低于 mandatoryNudity）时 highest 仍保持不降；再升到最高档联动同步
api.setCheatStage("deadwood-reblooms", "dress_active", "revealing");
assert(V.LifeSimulation.school.dress.active === "revealing" && V.LifeSimulation.school.dress.highest === "mandatoryNudity",
	   "32.6.5 写中间档 revealing：active=revealing 且 highest 保持强制裸体（copyMax 只升不降）");
delete V.LifeSimulation; delete V.VanillaPlus; delete V.mbCE_wrote;

// 32.7) v1.9.6 自查优化扩展轮：金融（银行/证券/公司/孤儿院）+ 罗宾投资与店铺设施 + 交通 + 街道（悬赏/劫案）+ 原版增强锁定与驱除
V.VanillaPlus = { lock: { willpower: false, physique: false, beauty: false, promiscuity: false, exhibitionism: false, deviancy: false }, divineTransformations: { expungeUsed: false, beautyBonus: 0 } };
V.RobinExpansion = { investment: { agreed: false, share: 0, valuation: 0, invested_total: 0, returned_total: 0, dividends_total: 0 }, shop_bank_supported: false, shop_flowers: false, shop_popcorn: false, shop_balloons: false, self_rent: false, both_rent: false, rent_separated: false };
V.Finance = { bank: { opened: false, account_tier: "current", balance: 0, debit_card: false, credit_card: false }, brokerage: { opened: false, cash: 0 }, company: { office: false, agreement: false, completed: 0, shareholders: { board: false, controller: false }, ascension: { recognized: false } }, orphanage: { pc_bought_out: false, robin_bought_out: false } };
V.Transport = { helmet: false, repair_tools: { bicycle: false, motor: false }, repair_parts: { bicycle: 0, motor: 0 } };
V.StreetLife = { bounties: { completed: 0 }, heist: { stage: "idle" } };
var dw37 = api.getCheatMods().filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
// 32.7.1) 声明收录（抽查关键新键）
var dw37Vp = dw37.values.map(function (v) { return v.varPath; });
var dw37Ab = dw37.abilities.map(function (a) { return a.varPath; });
assert(dw37.abilities.filter(function (a) { return a.varPath === "VanillaPlus.lock.willpower"; }).length === 1, "32.7.1 锁定意志能力已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "VanillaPlus.divineTransformations.expungeUsed"; }).length === 1, "32.7.1 驱除已用标记已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "RobinExpansion.investment.agreed"; }).length === 1, "32.7.1 罗宾投资协议已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "RobinExpansion.shop_bank_supported"; }).length === 1, "32.7.1 店铺银行支持已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "Finance.bank.opened"; }).length === 1, "32.7.1 银行开户已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "Finance.company.shareholders.board"; }).length === 1, "32.7.1 董事会席位已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "Finance.orphanage.pc_bought_out"; }).length === 1, "32.7.1 孤儿院买断已收录");
assert(dw37.abilities.filter(function (a) { return a.varPath === "Transport.helmet"; }).length === 1, "32.7.1 头盔已收录");
assert(dw37.stages.filter(function (s) { return s.varPath === "Finance.bank.account_tier"; }).length === 1, "32.7.1 银行档位阶段已收录");
assert(dw37.stages.filter(function (s) { return s.varPath === "StreetLife.heist.stage"; }).length === 1, "32.7.1 劫案阶段已收录");
assert(dw37Vp.indexOf("Finance.bank.balance") !== -1 && dw37Vp.indexOf("StreetLife.bounties.completed") !== -1, "32.7.1 银行余额/悬赏计数值已收录");
// 32.7.2) 抽样写入生效
api.toggleCheatAbility("deadwood-reblooms", "vp_lock_willpower", true);
assert(V.VanillaPlus.lock.willpower === true, "32.7.2 锁定意志勾选生效");
api.toggleCheatAbility("deadwood-reblooms", "r_invest_agreed", true);
assert(V.RobinExpansion.investment.agreed === true, "32.7.2 投资协议勾选生效");
api.toggleCheatAbility("deadwood-reblooms", "fin_board", true);
assert(V.Finance.company.shareholders.board === true, "32.7.2 董事会席位勾选生效");
api.toggleCheatAbility("deadwood-reblooms", "fin_orc_pc_free", true);
assert(V.Finance.orphanage.pc_bought_out === true, "32.7.2 孤儿院买断勾选生效");
api.toggleCheatAbility("deadwood-reblooms", "tr_helmet", true);
assert(V.Transport.helmet === true, "32.7.2 头盔勾选生效");
api.setCheatStage("deadwood-reblooms", "fin_bank_tier", "premier");
assert(V.Finance.bank.account_tier === "premier", "32.7.2 银行档位写入尊享, 实际 " + V.Finance.bank.account_tier);
api.setCheatStage("deadwood-reblooms", "sl_heist_stage", "vault");
assert(V.StreetLife.heist.stage === "vault", "32.7.2 劫案阶段写入金库, 实际 " + V.StreetLife.heist.stage);
api.applyCheatModValue("deadwood-reblooms", "fin_bank_balance", 1000000);
assert(V.Finance.bank.balance === 1000000, "32.7.2 银行余额写 100 万便士（=1 万英镑）");
api.applyCheatModValue("deadwood-reblooms", "sl_bounty_completed", 1);
assert(V.StreetLife.bounties.completed === 1, "32.7.2 已结悬赏写 1（成就判定 ≥1）");
api.applyCheatModValue("deadwood-reblooms", "tr_parts_bike", 5);
assert(V.Transport.repair_parts.bicycle === 5, "32.7.2 自行车零件写 5");
delete V.VanillaPlus; delete V.RobinExpansion; delete V.Finance; delete V.Transport; delete V.StreetLife; delete V.mbCE_wrote;
// 32.7.3) 联动补足断言（v1.9.6 自查优化：写卡/余额/投资/租金自动补前置，避免「键写了但功能不生效」）
V.Finance = { bank: { opened: false, debit_card: false, credit_card: false, balance: 0 } };
V.RobinExpansion = { investment: { agreed: false, share: 0 }, self_rent: false, rent_separated: false };
V.mbCE_wrote = {};
api.toggleCheatAbility("deadwood-reblooms", "fin_debit", true);
assert(V.Finance.bank.opened === true && V.Finance.bank.debit_card === true, "32.7.3 勾借记卡自动联动开户");
api.toggleCheatAbility("deadwood-reblooms", "fin_credit", true);
assert(V.Finance.bank.opened === true && V.Finance.bank.credit_card === true, "32.7.3 勾信用卡自动联动开户");
api.applyCheatModValue("deadwood-reblooms", "fin_bank_balance", 500000);
assert(V.Finance.bank.balance === 500000 && V.Finance.bank.opened === true && V.Finance.bank.debit_card === true, "32.7.3 写余额自动联动开户+借记卡");
api.applyCheatModValue("deadwood-reblooms", "r_invest_total", 100000);
api.toggleCheatAbility("deadwood-reblooms", "r_invest_agreed", true);
assert(V.RobinExpansion.investment.agreed === true && V.RobinExpansion.shop === true && V.RobinExpansion.shop_flowers === true && V.RobinExpansion.shop_popcorn === true && V.RobinExpansion.shop_balloons === true, "32.7.3 投资协议勾选联动四门店（2.5.0 已移除股份 share 键）");
api.toggleCheatAbility("deadwood-reblooms", "r_invest_agreed", false);
api.toggleCheatAbility("deadwood-reblooms", "r_invest_agreed", true);
assert(V.RobinExpansion.investment.agreed === true && V.RobinExpansion.investment.share === 0, "32.7.3 再次勾选不联动写 share（2.5.0 无此键）");
api.toggleCheatAbility("deadwood-reblooms", "r_rent_self", true);
assert(V.RobinExpansion.self_rent === true && V.RobinExpansion.rent_separated === true, "32.7.3 勾自租联动分开租房标记（对齐模组自身语义）");
delete V.Finance; delete V.RobinExpansion; delete V.mbCE_wrote;

// ============ 第 33 节：v1.6.0 SmartPhone Alpha 0.3.91 新增适配（V.Phone 探测 + 0/1 数字语义） ============
V.Phone = { Owned: [], photography: 0, TaskDanger: 0, FengMeeet: 0, MetFengGiveup: 0, SecondShopKnown: 0, FengAcceptExposed: 0, SydneySexLiveCompanion: 0, FengLine: 0 };
var sp33 = api.getCheatMods().filter(function (x) { return x.modId === "smartphone"; })[0];
assert(sp33 && sp33.values.filter(function (v) { return v.varPath === "Phone.photography"; }).length === 1, "33.1 适配器探测命中（V.Phone）");
assert(sp33.values.filter(function (v) { return v.varPath === "Phone.TaskDanger"; })[0].max === 1, "33.1 危险任务模式 0/1 钳制上限");
// 33.2) 数值写入读回 + 钳制
api.applyCheatModValue("smartphone", "sp_photography", 500);
assert(V.Phone.photography === 500, "33.2 摄影技能写入 500");
api.applyCheatModValue("smartphone", "sp_photography", 2000);
assert(V.Phone.photography === 2000, "33.2 摄影上限不钳制（写 2000 原样）");
// 33.3) 0/1 数字语义（模组 ===1 判断兼容，禁止 boolean true）
api.applyCheatModValue("smartphone", "sp_task_danger", 1);
assert(V.Phone.TaskDanger === 1 && typeof V.Phone.TaskDanger === "number", "33.3 危险任务模式写入数字 1（===1 判断兼容）, 实际 " + V.Phone.TaskDanger + " 类型 " + typeof V.Phone.TaskDanger);
api.applyCheatModValue("smartphone", "sp_feng_meet", 1);
assert(V.Phone.FengMeeet === 1, "33.3 初遇老冯写入 1");
// 33.4) 老冯线阶段（钳制）
var rf = api.setCheatStage("smartphone", "sp_feng_line", 2);
assert(rf.ok && V.Phone.FengLine === 2, "33.4 老冯线阶段写入 2");
var rfb = api.setCheatStage("smartphone", "sp_feng_line", 9);
assert(rfb.ok && V.Phone.FengLine === 2, "33.4 老冯线越界钳制到最高 2");
// 33.5) 暴露计数
api.applyCheatModValue("smartphone", "sp_feng_exposed", 3);
assert(V.Phone.FengAcceptExposed === 3, "33.5 暴露场景计数写入 3");
// 33.6) 回退
api.undoCheatModValue("smartphone", "value_set:sp_photography");
assert(V.Phone.photography === 0, "33.6 摄影技能回退到 0");
// 33.7) 模组卸载后探测自动消失
delete V.Phone;
assert(api.getCheatMods().filter(function (x) { return x.modId === "smartphone"; }).length === 0, "33.7 卸载后 SmartPhone 适配器自动消失");
delete V.mbCE_wrote; delete global.window;

// ============ 第 34 节：v1.7.0 场景直达新增——多伦公寓（Doren Entrance/Talk/Cry/Shower + Doren Loft）与麋鹿街大院（Elk Compound） ============
// 段落名均实证自本体 0.5.12.13：Doren Entrance/Talk/Cry/Shower 为 $location="flats"（Doren's flat 公寓内）；
// Doren Loft 系列为孤儿院阁楼布置线（用户点名一并收录）；Doren Jog/Beach/校医室/Hot Chocolate 为户外/学校/孤儿院，排除；
// Elk Compound 为入口（"You are in the compound on Elk Street"），Interior/Underground/Central/Wraith/Possessed/Station 为子场景；Docks Compound 为码头大院，排除。
const PLACE_NAMES_V17 = [
  "Doren Entrance", "Doren Talk", "Doren Cry", "Doren Shower", "Doren Shower Ask", "Doren Shower 1", "Doren Shower 2", "Doren Shower 3",
  "Doren Loft", "Doren Loft 2", "Doren Loft Thank",
  "Elk Compound", "Elk Compound Interior", "Elk Compound Underground", "Elk Compound Central", "Elk Compound Wraith", "Elk Compound Possessed", "Elk Compound Station",
  "Doren Jog", "Doren Beach Volleyball", "School Infirmary Doren", "Hot Chocolate Doren", "Hallways Exposed Doren",
  "Docks Compound", "Manor Hall", "Orphanage Loft", "Mansion Bed"
];
global.Story = { has: (n) => PLACE_NAMES_V17.indexOf(n) !== -1, lookupWith: (fn) => PLACE_NAMES_V17.map(n => ({ name: n, text: "" })).filter(fn) };
let pg34 = api.listPlaceGroups();
let df34 = pg34.find(x => x.group.id === "doren_flat");
assert(df34 && df34.group.name.indexOf("多伦") === 0, "34.1 多伦公寓组存在, 实际 " + (df34 && df34.group.name));
assert(df34.items.length === 11 && df34.items[0] === "Doren Entrance", "34.2 多伦公寓收录 11 段（Entrance/Talk/Cry/Shower 系列 + Loft 系列）且入口主置顶, 实际 " + JSON.stringify(df34.items));
assert(df34.items.indexOf("Doren Loft") !== -1 && df34.items.indexOf("Doren Jog") === -1 && df34.items.indexOf("Doren Beach Volleyball") === -1 && df34.items.indexOf("School Infirmary Doren") === -1 && df34.items.indexOf("Hot Chocolate Doren") === -1 && df34.items.indexOf("Hallways Exposed Doren") === -1, "34.3 含 Doren Loft（点名一并收录）且排除 Jog/海滩/校医室/热巧克力/走廊暴露");
let ec34 = pg34.find(x => x.group.id === "elk_compound");
assert(ec34 && ec34.group.name.indexOf("麋鹿街") === 0 && ec34.items.length === 7 && ec34.items[0] === "Elk Compound", "34.4 麋鹿街大院收录 7 段主置顶, 实际 " + JSON.stringify(ec34.items));
assert(ec34.items.indexOf("Docks Compound") === -1, "34.5 Docks Compound（码头大院）不误入");
// 34.6) 世界入口：elk_compound 写入 $compound.allowed=true + discovered=true（本体 Elk Street：Approach 链接需 allowed）
delete V.compound;
api.applyWorldUnlock("elk_compound");
assert(V.compound && V.compound.allowed === true && V.compound.discovered === true, "34.6 elk_compound 世界入口写 compound.allowed/discovered, 实际 " + JSON.stringify(V.compound));
// 34.7) 幂等：allowed 已 true 不覆盖，缺失 discovered 补齐
V.compound = { allowed: true, discovered: false };
api.applyWorldUnlock("elk_compound");
assert(V.compound.discovered === true && V.compound.allowed === true, "34.7 幂等补写 discovered（allowed 保持 true）");
// 34.8) doren_flat 无持久世界入口（不写入任何键）
delete V.compound;
api.applyWorldUnlock("doren_flat");
assert(V.compound === undefined, "34.8 doren_flat 不写世界入口（剧情/时间触发，仅传送）");
// 34.9) 传送联动：teleportTo(Elk Compound) → applyWorldUnlockForScene 解锁入口
let played34 = null;
global.Engine = { play: (n, h) => { played34 = n + ":" + !!h; } };
api.teleportTo("Elk Compound");
assert(played34 === "Elk Compound:true" && V.compound && V.compound.allowed === true, "34.9 传送到 Elk Compound 联动解锁世界入口, 实际 " + JSON.stringify(V.compound));
delete global.Engine; delete V.compound; delete global.Story;

// ============ 第 35 节：v1.7.0 玩家属性全量编辑（玩家自己 + 模组属性区，数值/阶段/布尔可改，留痕回退） ============
// 35.1) ORIGINAL_V_ROOT_KEYS 原版顶层键清单（含 player/scenes/compound/money，不含模组键）
assert(Array.isArray(api.ORIGINAL_V_ROOT_KEYS) && api.ORIGINAL_V_ROOT_KEYS.indexOf("player") !== -1 && api.ORIGINAL_V_ROOT_KEYS.indexOf("scenes") !== -1 && api.ORIGINAL_V_ROOT_KEYS.indexOf("compound") !== -1 && api.ORIGINAL_V_ROOT_KEYS.indexOf("money") !== -1, "35.1 原版顶层键清单含 player/scenes/compound/money");
assert(api.ORIGINAL_V_ROOT_KEYS.indexOf("RobinTemple") === -1 && api.ORIGINAL_V_ROOT_KEYS.indexOf("Phone") === -1 && api.ORIGINAL_V_ROOT_KEYS.indexOf("TempleDuties") === -1, "35.1 清单不含模组键");
// 35.2) isModOnlyRoot：原版键 false、模组键 true、面板键 false
V.player = { money: 100, virginity: { temple: false }, name: "X" };
assert(api.isModOnlyRoot("player") === false && api.isModOnlyRoot("money") === false && api.isModOnlyRoot("scenes") === false && api.isModOnlyRoot("loveInterest") === false, "35.2 原版键不判为模组键（不重复添加）");
V.RobinTemple = { stage: "none" }; V.Phone = { Owned: [] };
assert(api.isModOnlyRoot("RobinTemple") === true && api.isModOnlyRoot("Phone") === true, "35.2 模组键判为模组属性（原版没有的才列）");
assert(api.isModOnlyRoot("mbCE_wrote") === false && api.isModOnlyRoot("mbCE_queue") === false, "35.2 面板自身键不列出");
// 35.3) 玩家数值写入读回（modId=player-self，全量可改）
delete V.mbCE_wrote;
let pw1 = api.cheatWriteValuePlayer("player.money", 500, "number");
assert(pw1.ok && V.player.money === 500, "35.3 玩家金钱写入 500, 实际 " + V.player.money);
let pw1b = api.cheatWriteValuePlayer("player.money", -10, "number");
assert(pw1b.ok && V.player.money === -10, "35.3 金钱写入 -10（数值全量可改）");
// 35.4) 布尔写入
let pw2 = api.cheatWriteValuePlayer("player.virginity.temple", true, "boolean");
assert(pw2.ok && V.player.virginity.temple === true, "35.4 誓言布尔写入 true");
// 35.5) 阶段字符串写入
let pw3 = api.cheatWriteValuePlayer("player.name", "M", "string");
assert(pw3.ok && V.player.name === "M", "35.5 玩家名阶段写入 M");
// 35.6) 留痕回退（保留首次 before=100）
assert(V.mbCE_wrote && V.mbCE_wrote["cheat:player-self:p:player.money"], "35.6 留痕键 cheat:player-self:p:player.money 存在");
let pu1 = api.undoPlayerValue("player.money");
assert(pu1.ok && V.player.money === 100, "35.6 回退金钱到首次 before=100, 实际 " + V.player.money);
// 35.7) 模组键写入（顶层对象递归路径）
let pw4 = api.cheatWriteValuePlayer("RobinTemple.stage", "member", "string");
assert(pw4.ok && V.RobinTemple.stage === "member", "35.7 模组阶段写入 member");
// 35.8) 父级缺失拒绝（player.virginity=null 时写子键 → 拒绝不崩）
V.player.virginity = null;
let pw5 = api.cheatWriteValuePlayer("player.virginity.temple", true, "boolean");
assert(pw5.ok === false && /宿主不存在/.test(pw5.message), "35.8 父级缺失拒绝写入不崩, 实际 " + pw5.message);
// 35.9) 循环引用对象：数据层深层路径写入正常（渲染层限深 3 防崩由 renderPlayerFieldRow 处理）
let cyc = {}; cyc.self = cyc;
V.player.cyc = cyc;
let pw6 = api.cheatWriteValuePlayer("player.cyc.self.self.self.x", 1, "number");
assert(pw6.ok && V.player.cyc.self.self.self.x === 1, "35.9 深层路径写入正常（循环引用不炸栈）, 实际 " + (pw6.message || ""));
// 35.10) 模组属性区全量（运行时 V 键 - 原版清单 - 面板键）：含模组键，不含原版键
let modKeys35 = Object.keys(V).filter(k => api.isModOnlyRoot(k)).sort();
assert(modKeys35.indexOf("RobinTemple") !== -1 && modKeys35.indexOf("Phone") !== -1, "35.10 模组键区含 RobinTemple/Phone, 实际 " + JSON.stringify(modKeys35));
assert(modKeys35.indexOf("player") === -1 && modKeys35.indexOf("scenes") === -1 && modKeys35.indexOf("mbCE_wrote") === -1 && modKeys35.indexOf("loveInterest") === -1, "35.10 模组键区不含原版键与面板键");
// 35.11) 玩家键全量枚举覆盖（模组写入 player 的原版键复用：LostLamb 写 gender 等 → player.gender 直接在玩家区可改）
V.player.gender = "male";
let pw7 = api.cheatWriteValuePlayer("player.gender", "female", "string");
assert(pw7.ok && V.player.gender === "female", "35.11 模组复用键 player.gender 可改（全量覆盖）, 实际 " + V.player.gender);
// 清理
delete V.player; delete V.RobinTemple; delete V.Phone; delete V.mbCE_wrote;

// ============ 第 36 节：v1.7.0 综合链路交叉校验——场景直达 ↔ 玩家数值 ↔ 模组阶段（用户要求：改数值/直达/改阶段，查冲突/错误/是否成功） ============
// 36.1) 环境：归途之书适配器探测 + 场景段落 + Engine mock
global.window = { maplebirch: { npc: {}, get: function (n) { return (n === "RobinTemple" || n === "TempleChoir" || n === "LostLamb" || n === "TempleDuties" || n === "DeadwoodReblooms") ? {} : undefined; } } };
V.RobinTemple = { stage: "none", secret: { stage: "none", rite_stage: 0, followup: "none" } };
V.player = { money: 100, virginity: { temple: false }, name: "X", penisExist: true };
delete V.compound; delete V.mbCE_wrote;
const PLACE_V17B = ["Doren Entrance", "Doren Talk", "Doren Shower", "Doren Loft", "Elk Compound", "Elk Compound Interior", "Elk Compound Wraith", "Mansion Bed", "Manor Hall"];
global.Story = { has: (n) => PLACE_V17B.indexOf(n) !== -1, lookupWith: (fn) => PLACE_V17B.map(n => ({ name: n, text: "" })).filter(fn) };
let played36 = [];
global.Engine = { play: (n, h) => { played36.push(n + ":" + !!h); } };
// 36.2) 场景直达成功：传送到多伦公寓入口 + 麋鹿街大院（含世界入口联动）
api.teleportTo("Doren Entrance");
assert(played36.indexOf("Doren Entrance:true") !== -1, "36.2 直达多伦公寓入口成功, 实际 " + JSON.stringify(played36));
assert(V.compound === undefined, "36.2 多伦公寓为剧情触发，不误写 compound 世界入口");
api.teleportTo("Elk Compound");
assert(played36.indexOf("Elk Compound:true") !== -1 && V.compound && V.compound.allowed === true && V.compound.discovered === true, "36.2 直达麋鹿街大院成功并联动解锁世界入口, 实际 " + JSON.stringify(V.compound));
// 36.3) 玩家数值更改成功（玩家编辑区）
let pc1 = api.cheatWriteValuePlayer("player.money", 500, "number");
assert(pc1.ok && V.player.money === 500, "36.3 玩家金钱改 500 成功, 实际 " + V.player.money);
let pc2 = api.cheatWriteValuePlayer("player.virginity.temple", true, "boolean");
assert(pc2.ok && V.player.virginity.temple === true, "36.3 誓言布尔改 true 成功");
// 36.4) 模组阶段更改成功（Mod作弊 模组子页通道）
let pc3 = api.setCheatStage("revelation-the-book-of-return", "rt_stage", "member");
assert(pc3.ok && V.RobinTemple.stage === "member", "36.4 归途之书路线阶段改 member 成功, 实际 " + V.RobinTemple.stage);
let pc4 = api.setCheatStage("revelation-the-book-of-return", "rt_secret_stage", "complete");
assert(pc4.ok && V.RobinTemple.secret.stage === "complete", "36.4 秘密誓言阶段改 complete 成功");
// 36.5) 交叉冲突检查：场景直达 / 玩家数值 / 模组阶段互不破坏
api.teleportTo("Doren Loft");
assert(V.player.money === 500 && V.player.virginity.temple === true, "36.5a 场景直达后玩家数值保持（money=500 temple=true）, 实际 money=" + V.player.money + " temple=" + V.player.virginity.temple);
api.cheatWriteValuePlayer("player.name", "Test", "string");
assert(V.RobinTemple.stage === "member" && V.RobinTemple.secret.stage === "complete", "36.5b 玩家编辑后模组阶段保持（stage=member secret=complete）, 实际 stage=" + V.RobinTemple.stage);
// 36.5c) 同路径双通道互不毁：玩家页改模组键 RobinTemple.stage → 玩家页回退还原 member；Mod作弊 通道回退独立还原 none
let pc5 = api.cheatWriteValuePlayer("RobinTemple.stage", "approved", "string");
assert(pc5.ok && V.RobinTemple.stage === "approved", "36.5c 玩家页改模组键 stage=approved 成功, 实际 " + V.RobinTemple.stage);
let pc5u = api.undoPlayerValue("RobinTemple.stage");
assert(pc5u.ok && V.RobinTemple.stage === "member", "36.5c 玩家页回退模组键还原 member（Mod作弊 痕迹未破坏）, 实际 " + V.RobinTemple.stage);
let pc3u = api.undoCheatModValue("revelation-the-book-of-return", "stage_set:rt_stage");
assert(pc3u.ok && V.RobinTemple.stage === "none", "36.5c Mod作弊 回退路线阶段还原 none（与玩家痕迹互不干扰）, 实际 " + V.RobinTemple.stage);
// 36.6) 玩家区回退独立（还原首次 before）
let pc2u = api.undoPlayerValue("player.virginity.temple");
assert(pc2u.ok && V.player.virginity.temple === false, "36.6 玩家誓言回退还原 false, 实际 " + V.player.virginity.temple);
// 36.7) 错误路径：越界 / 宿主缺失 / 深层缺失 / 不存在段落均拒绝不崩、不改值
let pe1 = api.setCheatStage("revelation-the-book-of-return", "rt_stage", "bogus");
assert(pe1.ok === false && V.RobinTemple.stage === "none", "36.7 阶段越界拒绝且原值保持 none, 实际 " + (pe1.message || ""));
V.RobinTemple.secret = null;
let pe2 = api.setCheatStage("revelation-the-book-of-return", "rt_secret_stage", "complete");
assert(pe2.ok === false && /宿主不存在/.test(pe2.message), "36.7 宿主缺失拒绝不崩, 实际 " + (pe2.message || ""));
let pe3 = api.cheatWriteValuePlayer("player.missing.deep.x", 1, "number");
assert(pe3.ok === false, "36.7 深层缺失父级拒绝（player.missing.deep.x）, 实际 " + (pe3.message || ""));
api.teleportTo("NotExistPlace");
assert(played36.indexOf("NotExistPlace:") === -1, "36.7 不存在段落拒绝传送不崩");
// 36.8) 场景直达全程无残留：直达调用共 3 次（Entrance/Elk/Doren Loft；NotExist 被段落存在性拦截不调 Engine）
assert(played36.length === 3 && played36.indexOf("NotExistPlace:") === -1, "36.8 场景直达调用共 3 次（不存在段落拦截不触发）, 实际 " + JSON.stringify(played36));
// 清理
delete V.RobinTemple; delete V.player; delete V.compound; delete V.mbCE_wrote; delete global.Engine; delete global.Story; delete global.window;

// ============ 第 37 节：玩家编辑页中文化（用户要求"改为中文不要英文"；显示层翻译，写入仍用原键名） ============
// 37.1) 纯函数翻译：zhKey / zhPath / zhType
assert(api.zhKey("money") === "金钱" && api.zhKey("penisExist") === "有无阴茎" && api.zhKey("temple") === "神殿", "37.1 zhKey 常用键翻译正确, 实际 money→" + api.zhKey("money") + " temple→" + api.zhKey("temple"));
assert(api.zhKey("NoSuchKeyXYZ") === "NoSuchKeyXYZ", "37.1 zhKey 未收录键兜底原样, 实际 " + api.zhKey("NoSuchKeyXYZ"));
assert(api.zhPath("player.virginity.temple") === "玩家.童贞.神殿", "37.1 zhPath 逐段翻译, 实际 " + api.zhPath("player.virginity.temple"));
assert(api.zhPath("player.money") === "玩家.金钱", "37.1 zhPath 金钱路径, 实际 " + api.zhPath("player.money"));
assert(api.zhType("number") === "数值" && api.zhType("boolean") === "布尔" && api.zhType("object") === "对象", "37.1 zhType 类型翻译, number→" + api.zhType("number"));
// 37.2) DOM mock：重新 eval 初始化面板（document 存在 → ensureDom 建 root）
function mkNode(tag) {
	const n = {
		tagName: tag, children: [], _text: "", className: "", type: "", value: "", checked: false, step: "", id: "", title: "", listeners: {},
		/* 真实 DOM 语义：设置 textContent 会替换全部子节点（清空用 ""） */
		set textContent(v) { this._text = String(v); this.children = []; },
		get textContent() { let s = this._text; this.children.forEach(function (c) { s += c.textContent; }); return s; },
		appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
		setAttribute(k, v) { this["attr_" + k] = v; },
		getAttribute(k) { return this["attr_" + k]; },
		addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
		contains(n) { return n === this || (this.children && this.children.some(function (c) { return c.contains ? c.contains(n) : false; })); },
		removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); } return c; },
		querySelector(sel) { return qsSel37(this, sel); },
		querySelectorAll(sel) { const out = []; qsAll37(this, sel, out); return out; }
	};
	/* v1.8.5 回归：HTMLSelectElement.type 是只读 getter，对其赋值抛 TypeError（复现真实浏览器，
	   防系列行渲染再写 sel.type=xxx；v1.8.4 曾因此特质区整体消失） */
	if (tag === "select") {
		Object.defineProperty(n, "type", {
			get: function () { return "select-one"; },
			set: function () { throw new TypeError("Cannot set property type of #<HTMLSelectElement> which has only a getter"); },
			configurable: true
		});
	}
	return n;
}
function qsSel37(node, sel) {
	if (!node || !node.children) { return null; }
	/* v1.9.1：属性名允许连字符（data-mce-head / data-mce-tool 等） */
	const m = sel.match(/^\[data-([\w-]+)="([^"]+)"\]$/);
	for (let i = 0; i < node.children.length; i++) {
		const c = node.children[i];
		if (m && c.getAttribute && c.getAttribute("data-" + m[1]) === m[2]) { return c; }
		const r = qsSel37(c, sel);
		if (r) { return r; }
	}
	return null;
}
function qsAll37(node, sel, out) {
	if (!node || !node.children) { return; }
	const m = sel.match(/^\[data-([\w-]+)="([^"]+)"\]$/);
	node.children.forEach(function (c) {
		if (m && c.getAttribute && c.getAttribute("data-" + m[1]) === m[2]) { out.push(c); }
		qsAll37(c, sel, out);
	});
}
// ============ 第 37 节：玩家自己页渲染（v1.8.0 特质管理替代玩家属性/模组属性区；中文显示、写入原键名） ============
// 37.2) DOM mock：重新 eval 初始化面板（含 mock 模组特质注入：maplebirch.temporary.traitLists）
global.window = { maplebirch: { npc: {}, temporary: { traitLists: [ { title: "Book Traits", traits: [ { name: "命运之轮", has: function () { return false; }, text: "转吧，命运之神。" }, { name: "Acceptance: Small Penis", has: "$acceptance_penis_small gte 1000", text: "You're proud of your small penis." } ] } ] } } };
V.player = { money: 500, name: "X", virginity: { temple: true, vaginal: true, penile: true }, penisExist: true };
V.temple_burden = 0;
delete V.RobinTemple; delete V.mbCE_wrote;
delete V.mbCE_wrote;
const dBody = mkNode("body"), dHead = mkNode("head");
global.document = { body: dBody, head: dHead, createElement: mkNode, getElementById: () => null, addEventListener: () => {} };
delete global.$;
eval(js);
const api37 = setup.mbStageCE;
const root37 = dBody.children.filter(c => c.id === "mce-root")[0];
assert(!!root37, "37.2 ensureDom 建立面板根节点");
/* 版本断言不硬编码大版本号：直接与 boot.json 的 version 自洽比对，
   升版只改双源即通过；同时守住了「MCE_VERSION 与 boot.json 必须同步」这条项目纪律 */
const bootVer = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "boot.json"), "utf8")).version;
assert(root37.textContent.indexOf("剧情条件解锁面板 v" + bootVer) !== -1 && root37.textContent.indexOf("关闭") !== -1 && root37.textContent.indexOf("收起") === -1, "37.2 面板标题版本号动态化（header=标题+v boot.json 版本+主题✦+错误红点+关闭，无收起）, 实际 " + root37.textContent.slice(0, 70));
api37.renderPlayerEdit();
let pane37 = root37.querySelector('[data-pane="mods"]');
/* v1.8.15 懒渲染：特质区默认收起 → 先展开全部分类，后续行级断言才能命中 */
const openAll37 = [].slice.call(pane37.querySelectorAll("button")).filter(function (b) { return b.textContent === "全部展开"; })[0];
if (openAll37 && openAll37.listeners && openAll37.listeners.click) { openAll37.listeners.click[0](); }
let txt37 = pane37.textContent;
assert(txt37.indexOf("玩家自己 · 属性与特质") !== -1, "37.2 页面标题中文化, 实际 " + txt37.slice(0, 80));
assert(txt37.indexOf("游戏属性面板（颜色分级）快捷编辑") !== -1, "37.2 快捷编辑区保留, 实际 " + txt37.slice(0, 120));
assert(txt37.indexOf("特质管理") !== -1 && txt37.indexOf("一般特质") !== -1, "37.2 特质管理区+一般特质分类出现, 实际 " + txt37.slice(0, 300));
assert(txt37.indexOf("1. 玩家属性") === -1 && txt37.indexOf("2. 模组属性") === -1 && txt37.indexOf("模组属性（仅新增）") === -1, "37.2 玩家属性区/模组属性区已删除, 实际 " + txt37.slice(0, 300));
assert(txt37.indexOf("General Traits") === -1 && txt37.indexOf("player.money") === -1, "37.2 无英文分类/路径残留, 实际 " + txt37.slice(0, 300));
/* 37.2b) 分类折叠：同类型特质收在一起，默认收起（data-collapsed=1），点击标题展开 */
const grp37G = root37.querySelector('[data-tcat="一般特质"]');
assert(!!grp37G && grp37G.children.length === 2, "37.2b 一般特质组 = 标题 + 折叠体, 实际子节点 " + (grp37G ? grp37G.children.length : 0));
const body37G = grp37G.children[1];
assert(body37G.getAttribute("data-collapsed") === "1", "37.2b 分类默认收起（data-collapsed=1）");
assert(grp37G.children[0].textContent.indexOf("▸ 一般特质") !== -1, "37.2b 折叠标题显示 ▸+分类, 实际 " + grp37G.children[0].textContent.slice(0, 40));
grp37G.children[0].listeners.click[0]();
assert(body37G.getAttribute("data-collapsed") === "0", "37.2b 点击标题后展开（data-collapsed=0）");
assert(grp37G.children[0].textContent.indexOf("▾ 一般特质") !== -1, "37.2b 展开标题显示 ▾+分类, 实际 " + grp37G.children[0].textContent.slice(0, 40));
assert(txt37.indexOf("一般特质（") !== -1, "37.2b 分类标题带数量, 实际 " + txt37.slice(0, 300));
/* v1.8.15 懒渲染：点击展开后行才建 → 刷新快照再断言行级文本 */
txt37 = pane37.textContent;
assert(txt37.indexOf("童贞") !== -1 && (txt37.indexOf("○ 童贞") !== -1 || txt37.indexOf("● 童贞") !== -1), "37.2 童贞行中文显示（拥有 ● 或未拥有 ○）, 实际 " + txt37.slice(0, 300));
assert(txt37.indexOf("神殿之担") !== -1 && txt37.indexOf("改数值") !== -1, "37.2 神殿之担行+改数值按钮出现, 实际 " + txt37.slice(0, 400));
// 37.2c) v1.8.15 懒渲染：点击展开后行才建（mock DOM 的 querySelectorAll 层级不全，用 textContent 判定行已建）
const rows37Gtxt = body37G.textContent;
assert(rows37Gtxt.indexOf("童贞") !== -1, "37.2c 点击展开后一般特质组行已建, 实际 " + rows37Gtxt.slice(0, 60));
// 37.3) 模组特质自动发现：maplebirch.temporary.traitLists 注入的"命运之轮"出现在面板（自动收录）
const grp37M = root37.querySelector('[data-tcat="Book Traits（模组）"]');
if (grp37M && grp37M.children[0] && grp37M.children[0].listeners && grp37M.children[0].listeners.click) { grp37M.children[0].listeners.click[0](); }
txt37 = pane37.textContent;
assert(txt37.indexOf("Book Traits（模组）") !== -1 && txt37.indexOf("命运之轮") !== -1, "37.3 模组特质分类+条目自动发现显示, 实际 " + txt37.slice(0, 400));
assert(txt37.indexOf("（模组）") !== -1, "37.3 模组注入标记出现, 实际 " + txt37.slice(0, 400));
// 37.3b) v1.8.11 模组特质可直接获取/移除：字符串判定写变量直接获得；函数判定走强制获得标记（不再只读）
const mt37 = api37.discoverModTraits();
assert(mt37.length === 2, "37.3b 自动发现 2 个模组特质（函数型+字符串型）, 实际 " + mt37.length);
const fnTrait37 = mt37.filter(function (t) { return t.name.indexOf("命运之轮") !== -1; })[0];
const strTrait37 = mt37.filter(function (t) { return t.name.indexOf("Small Penis") !== -1; })[0];
assert(!!fnTrait37 && typeof fnTrait37.hasFn === "function" && fnTrait37.has === "", "37.3b 函数型 has 保留 hasFn（has 为空）");
assert(!!strTrait37 && strTrait37.has === "$acceptance_penis_small gte 1000", "37.3b 字符串型 has 原样保留, 实际 " + (strTrait37 && strTrait37.has));
const g37s = api37.grantTrait(strTrait37, V, null);
assert(V.acceptance_penis_small === 1000, "37.3b 字符串型模组特质获取 → 写满足变量 acceptance_penis_small=1000, 实际 " + V.acceptance_penis_small);
assert(api37.traitOwned(strTrait37, V, null) === true, "37.3b 字符串型获取后拥有判定 true");
const r37s = api37.revokeTrait(strTrait37, V, null);
assert(V.acceptance_penis_small === 0, "37.3b 字符串型移除 → 主变量写回不满足（gte 写 0）, 实际 " + V.acceptance_penis_small);
const g37f = api37.grantTrait(fnTrait37, V, null);
assert(Array.isArray(V.mbCE_forcedTraits) && V.mbCE_forcedTraits.length === 1 && api37.traitOwned(fnTrait37, V, null) === true, "37.3b 函数型模组特质强制获得标记 + 拥有判定 true, 实际 " + JSON.stringify(V.mbCE_forcedTraits));
const r37f = api37.revokeTrait(fnTrait37, V, null);
assert(!Array.isArray(V.mbCE_forcedTraits) || V.mbCE_forcedTraits.length === 0, "37.3b 函数型移除 → 强制标记清除");
// 37.3c) 双巡优化①：模组特质数字比较变量生成「可改数值」清单（仿原版编译），写入/回退走通用留痕通道
assert(Array.isArray(strTrait37.values) && strTrait37.values.length === 1 && strTrait37.values[0].path === "acceptance_penis_small" && strTrait37.values[0].op === "gte" && strTrait37.values[0].val === 1000, "37.3c 字符串型模组特质生成可改数值清单 {acceptance_penis_small, gte, 1000}, 实际 " + JSON.stringify(strTrait37.values));
assert(Array.isArray(fnTrait37.values) && fnTrait37.values.length === 0, "37.3c 函数型模组特质无可解析数值变量（values 空数组）, 实际 " + JSON.stringify(fnTrait37.values));
V.acceptance_penis_small = 1000; /* 重新置位（37.3b 已移除为 0）作为写入前值 */
let w37m = api37.traitWriteValue(strTrait37, V, "acceptance_penis_small", "2000");
assert(w37m.ok && V.acceptance_penis_small === 2000, "37.3c 模组特质数值写入 acceptance_penis_small=2000, 实际 " + V.acceptance_penis_small);
let w37mu = api37.undoCheatModValue("player-self", "trait:acceptance_penis_small");
assert(w37mu && w37mu.ok && V.acceptance_penis_small === 1000, "37.3c 模组特质数值回退还原 1000, 实际 " + V.acceptance_penis_small);
V.acceptance_penis_small = 1000;
let w37mr = api37.traitWriteValue(strTrait37, V, "acceptance_penis_small", "+500");
assert(w37mr.ok && V.acceptance_penis_small === 1500, "37.3c 模组特质相对写入 +500 → 1500, 实际 " + V.acceptance_penis_small);
let w37mru = api37.undoCheatModValue("player-self", "trait:acceptance_penis_small");
assert(w37mru && w37mru.ok && V.acceptance_penis_small === 1000, "37.3c 相对写入回退还原 1000, 实际 " + V.acceptance_penis_small);
delete V.acceptance_penis_small; delete V.mbCE_forcedTraits;
/* 37.3d) 四巡自查修复：gt（严格大于）条件满足值 = num+1——
   Purity Boost（$featsPurityBoost gt 0）获取后必须判定已拥有；Bratty（$submissive lte 850 and gt 500）复合条件同理 */
const gtTrait = { cat: "General Traits", name: "Purity Boost", has: "$featsPurityBoost gt 0" };
V.featsPurityBoost = 0;
let w37d = api37.grantTrait(gtTrait, V, null);
assert(w37d.indexOf("featsPurityBoost=1") !== -1 && V.featsPurityBoost === 1, "37.3d gt 满足值写 num+1（featsPurityBoost=1，0 不满足 gt 0）, 实际 " + V.featsPurityBoost + " " + JSON.stringify(w37d));
assert(api37.traitOwned(gtTrait, V, null) === true, "37.3d gt 条件获取后判定已拥有（此前写 0 恒未获得）");
let r37d = api37.revokeTrait(gtTrait, V, null);
assert(V.featsPurityBoost === 0 && api37.traitOwned(gtTrait, V, null) === false, "37.3d gt 移除写 0（不满足）且判定未获得, 实际 " + V.featsPurityBoost);
const brattyTrait = { cat: "General Traits", name: "Bratty", has: "$submissive lte 850 and $submissive gt 500" };
V.submissive = 500;
let w37e = api37.grantTrait(brattyTrait, V, null);
assert(api37.traitOwned(brattyTrait, V, null) === true, "37.3d 复合 gt+lte 条件获取后判定已拥有（实际 submissive=" + V.submissive + " " + JSON.stringify(w37e) + "）");
delete V.featsPurityBoost; delete V.submissive;
/* 37.4) v1.9.1 性别切换（玩家自己页）：applyPlayerGender 三态写七键正确 + getPlayerGender 推断正确 + 幂等 + 缺壳兜底 */
V.player = { money: 500, name: "X", virginity: { temple: true, vaginal: true, penile: true }, penisExist: true, vaginaExist: false, penissize: 2, gender_body: "m", gender: "m", sex: "m", ballsExist: false };
assert(api37.getPlayerGender(V) === "m", "37.4 初始推断男, 实际 " + api37.getPlayerGender(V));
let r37g = api37.applyPlayerGender(V, "f");
assert(r37g.indexOf("FAIL") === -1 && V.player.penisExist === false && V.player.penissize === 0 && V.player.vaginaExist === true && V.player.gender_body === "f" && V.player.gender === "f" && V.player.sex === "f" && V.player.ballsExist === false, "37.4 切女 → 七键正确（penisExist=false/penissize=0/vaginaExist=true/gender=f/gender_body=f/sex=f/ballsExist=false）, 实际 " + r37g);
assert(api37.getPlayerGender(V) === "f", "37.4 切女后推断女, 实际 " + api37.getPlayerGender(V));
r37g = api37.applyPlayerGender(V, "a");
assert(r37g.indexOf("FAIL") === -1 && V.player.penisExist === true && V.player.penissize >= 1 && V.player.vaginaExist === true && V.player.gender === "h" && V.player.gender_body === "a" && V.player.sex === "h" && V.player.ballsExist === true, "37.4 切双性 → 两者存在 + gender=h/gender_body=a/sex=h/ballsExist=true + penissize 补 1, 实际 " + r37g);
assert(api37.getPlayerGender(V) === "a", "37.4 切双性后推断双性, 实际 " + api37.getPlayerGender(V));
r37g = api37.applyPlayerGender(V, "m");
assert(r37g.indexOf("FAIL") === -1 && V.player.penisExist === true && V.player.vaginaExist === false && V.player.gender === "m" && V.player.gender_body === "m" && V.player.sex === "m" && V.player.ballsExist === false && V.player.penissize >= 1, "37.4 切男 → 阴茎保留 + 无阴道 + gender=m/sex=m/ballsExist=false, 实际 " + r37g);
const ps37 = V.player.penissize;
api37.applyPlayerGender(V, "m");
assert(V.player.penissize === ps37 && V.player.penisExist === true, "37.4 幂等：重复切男不重置 penissize, 实际 " + V.player.penissize);
const V37b = {};
const r37b = api37.applyPlayerGender(V37b, "f");
assert(r37b.indexOf("FAIL") === -1 && V37b.player.vaginaExist === true && V37b.player.penisExist === false && V37b.player.gender_body === "f" && V37b.player.sex === "f", "37.4 边界：V.player 缺失时建壳写女不崩, 实际 " + r37b);
const r37c = api37.applyPlayerGender(V, "x");
assert(r37c.indexOf("FAIL") !== -1, "37.4 边界：未知性别返回 FAIL, 实际 " + r37c);
delete V.player;
// 37.4) 特质写值仍用原键名：traitWriteValue 写 temple_burden（中文显示不影响写入路径）
let w37 = api37.traitWriteValue(api37.compileVanillaTraits().filter(t => t.name === "Temple Burden: $temple_burden%")[0] || { name: "?" }, V, "temple_burden", "30");
assert(w37.ok && V.temple_burden === 30, "37.4 特质写值 temple_burden=30 成功, 实际 " + V.temple_burden);
assert(Object.keys(V).indexOf("temple_burden") !== -1, "37.4 写入原键名 temple_burden（无中文键污染）");
let w37u = api37.undoPlayerValue ? api37.undoCheatModValue("player-self", "trait:temple_burden") : null;
assert(w37u && w37u.ok && V.temple_burden === 0, "37.4 特质数值回退还原 0, 实际 " + V.temple_burden);
// 37.5) v1.8.3 同阶段特质合并为系列行：受虐狂/施虐狂/成绩系列不再逐条平铺，渲染为阶段下拉+应用+跳至最高+回退初始
const s37 = api37.groupTraitSeries(api37.compileVanillaTraits());
const pathSet37 = {}; s37.forEach(s => { pathSet37[s.path] = (pathSet37[s.path] || 0) + 1; });
assert(s37.length >= 6 && pathSet37["masochism_level"] === 1 && pathSet37["sadism_level"] === 1 && pathSet37["mathstrait"] === 1, "37.5 系列分组含 受虐狂/施虐狂/数学成绩, 实际 " + JSON.stringify(Object.keys(pathSet37)));
const maso37 = s37.filter(s => s.path === "masochism_level")[0];
assert(maso37 && maso37.series.length === 4 && maso37.series.map(x => x.val).join(",") === "1,2,3,4", "37.5 受虐狂系列 4 档阈值 1,2,3,4, 实际 " + (maso37 ? maso37.series.map(x => x.val).join(",") : "无"));
assert(api37.traitSeriesName(maso37) === "受虐狂", "37.5 系列中文名 受虐狂, 实际 " + (maso37 ? api37.traitSeriesName(maso37) : "无"));
assert(pane37.textContent.indexOf("受虐狂（当前 无）") !== -1 && pane37.textContent.indexOf("愧疚的受虐狂（1）") !== -1, "37.5 系列行显示当前无+档位下拉, 实际 " + pane37.textContent.slice(0, 200));
assert(pane37.textContent.indexOf("跳至最高") !== -1 && pane37.textContent.indexOf("回退初始") !== -1 && pane37.textContent.indexOf("应用") !== -1, "37.5 系列行含 应用/跳至最高/回退初始 按钮, 实际 " + pane37.textContent.slice(0, 300));
// 37.6) v1.8.5 回归：HTMLSelectElement.type 是只读 getter（mock 已复现，赋值会直接抛错），渲染树中 select 不得被赋 type
const selNodes37 = [];
(function walkSel(n) {
  if (!n || typeof n !== "object") { return; }
  if (n.tagName === "select") { selNodes37.push(n); }
  if (Array.isArray(n.children)) { n.children.forEach(walkSel); }
})(pane37);
assert(selNodes37.length >= 1, "37.6 系列行渲染出 select 元素, 实际 " + selNodes37.length);
assert(selNodes37.every(s => s.type === "select-one"), "37.6 select 的 type 为只读 getter（select-one）, 实际 " + selNodes37.map(s => s.type).join(","));
// 清理
delete V.temple_burden; delete V.RobinTemple; delete V.player; delete V.mbCE_wrote; delete global.document; delete global.window; delete global.$;

// ============ 第 38 节：游戏属性面板（颜色分级）快捷编辑（v1.7.2，用户指定"改这些面板数值"） ============
// 38.1) 组清单：5 组覆盖 核心属性/基础技能/性技能/学校成绩/武器技能
let g38 = api.PANEL_QUICK_GROUPS;
assert(g38.length === 7 && g38[0].title === "核心属性" && g38[4].title === "武器技能" && g38[5].title === "负面状态" && g38[6].title === "名声（fame）", "38.1 快捷区 7 组（核心/基础/性/成绩/武器/负面状态/名声）, 实际 " + JSON.stringify(g38.map(x => x.title)));
let all38 = g38.reduce((a, g) => a.concat(g.items), []);
let names38 = all38.map(x => x.label);
["纯洁", "容貌", "体能", "意志", "意识", "淫乱", "暴露癖", "异种癖", "诡术", "舞蹈", "游泳", "运动", "护理", "家务", "魅惑", "口部", "胸部", "手部", "臀部", "阴茎", "小穴", "后庭", "大腿", "足部", "科学", "数学", "语文", "历史", "防狼喷雾", "短棍", "鞭子"].forEach(n => {
	assert(names38.indexOf(n) !== -1, "38.1 快捷区含「" + n + "」");
});
// 38.2) 顶层数值写入：purity/physique/skulduggery/science（原版数值键，走 player-self 通道，无越界钳制）
V.purity = 12; V.physique = 34; V.science = 56;
let q1 = api.quickWrite("purity", 100);
assert(q1.ok && V.purity === 100, "38.2 纯洁写 100 成功, 实际 " + V.purity);
let q2 = api.quickWrite("physique", 88);
assert(q2.ok && V.physique === 88, "38.2 体能写 88 成功");
let q3 = api.quickWrite("skulduggery", 900);
assert(q3.ok && V.skulduggery === 900, "38.2 诡术写 900 成功（技能量纲 0-1000）");
let q4 = api.quickWrite("science", 1000);
assert(q4.ok && V.science === 1000, "38.2 科学写 1000 成功");
// 38.3) 武器写入：$prof 缺失 → 补空壳后可写；已存在不覆盖
delete V.prof;
let q5 = api.quickWrite("prof.spray", 60);
assert(q5.ok && V.prof && V.prof.spray === 60, "38.3 武器防狼喷雾写 60 成功（prof 缺失自动补壳）, 实际 " + JSON.stringify(V.prof));
assert(V.prof.baton === 0 && V.prof.whip === 0, "38.3 补壳默认值 baton=0 whip=0（只建不覆盖）");
V.prof.baton = 99;
let q6 = api.quickWrite("prof.baton", 120);
assert(q6.ok && V.prof.baton === 120, "38.3 短棍写 120 成功（已有值覆盖）");
let q7 = api.quickWrite("prof.whip", 77);
assert(q7.ok && V.prof.whip === 77, "38.3 鞭子写 77 成功");
// 38.4) 回退：每项独立还原首次 before
let q1u = api.undoPlayerValue("purity");
assert(q1u.ok && V.purity === 12, "38.4 纯洁回退还原 12, 实际 " + V.purity);
let q5u = api.undoPlayerValue("prof.spray");
assert(q5u.ok && V.prof.spray === 0, "38.4 防狼喷雾回退还原 0（补壳默认）, 实际 " + V.prof.spray);
// 38.5) 当前值读取：quickReadValue 返回原值
assert(api.quickReadValue("physique") === 88 && api.quickReadValue("prof.whip") === 77, "38.5 当前值读取正确");
assert(api.quickReadValue("prof.missing") === undefined, "38.5 不存在武器键返回 undefined");
// 38.6) 渲染：快捷区中文化（DOM mock 重新 eval，独立 body 避免旧 root 干扰）
V.purity = 12; V.science = 56; V.prof = { spray: 60, baton: 99, whip: 0, net: 0, pickaxe: 0 };
delete V.mbCE_wrote;
delete global.window;
const dBody38 = mkNode("body"), dHead38 = mkNode("head");
global.document = { body: dBody38, head: dHead38, createElement: mkNode, getElementById: () => null, addEventListener: () => {} };
eval(js);
const api38 = setup.mbStageCE;
const root38 = dBody38.children.filter(c => c.id === "mce-root")[0];
assert(!!root38, "38.6 面板根节点重建");
api38.renderPlayerEdit();
let pane38 = root38.querySelector('[data-pane="mods"]');
let txt38 = pane38.textContent;
assert(txt38.indexOf("游戏属性面板（颜色分级）快捷编辑") !== -1, "38.6 快捷区标题中文化, 实际 " + txt38.slice(0, 100));
assert(txt38.indexOf("纯洁（当前 12）") !== -1 && txt38.indexOf("防狼喷雾（当前 60）") !== -1 && txt38.indexOf("科学（当前 56）") !== -1, "38.6 快捷行中文名+当前值, 实际 " + txt38.slice(0, 400));
assert(txt38.indexOf("purity") === -1 && txt38.indexOf("prof.spray") === -1, "38.6 快捷区无英文键名残留, 实际 " + txt38.slice(0, 400));
// 38.7) 快捷区与玩家区/模组区共存：快捷区 + 玩家属性区都在同一页
assert(txt38.indexOf("特质管理") !== -1 && txt38.indexOf("一般特质") !== -1, "38.7 快捷区下特质管理区仍在（共存）");
// 清理
delete V.purity; delete V.physique; delete V.science; delete V.skulduggery; delete V.prof; delete V.mbCE_wrote; delete global.document; delete global.$;


// ============ 第 39 节：v1.8.0 特质管理核心（原版特质表/拥有判定/获取/移除/数值可改/模组特质发现） ============
// 39.0) 独立 eval：window mock（maplebirch.temporary.traitLists 含模组特质）+ document mock
delete global.window;
global.window = { maplebirch: { npc: {}, temporary: { traitLists: [
	{ title: "Book Traits", traits: [ { name: "命运之轮", has: function () { return false; }, text: "转吧，命运之神。" }, { name: "恐虐注视", has: function () { return true; }, text: "血祭血神。" } ] }
] } } };
const dBody39 = mkNode("body"), dHead39 = mkNode("head");
global.document = { body: dBody39, head: dHead39, createElement: mkNode, getElementById: () => null, addEventListener: () => {} };
delete global.$;
eval(js);
const api39 = setup.mbStageCE;
// 39.1) 原版特质静态表：114 项、9 分类、关键特质存在
const vt39 = api39.compileVanillaTraits();
assert(vt39.length >= 110, "39.1 原版特质表条目 >=110, 实际 " + vt39.length);
const cats39 = {}; vt39.forEach(t => { cats39[t.cat] = (cats39[t.cat] || 0) + 1; });
assert(cats39["General Traits"] >= 8 && cats39["Hypnosis Traits"] >= 29 && cats39["School Traits"] >= 20 && cats39["NPC Traits"] >= 5, "39.1 分类覆盖 General/Hypnosis/School/NPC, 实际 " + JSON.stringify(cats39));
function findT39(namePart) { return vt39.filter(t => String(t.name).indexOf(namePart) !== -1)[0]; }
const tVirgin39 = findT39("Virgin");
const tTemple39 = findT39("Temple Burden");
const tVow39 = findT39("Chastity Vow");
assert(!!tVirgin39 && !!tTemple39 && !!tVow39, "39.1 童贞/神殿之担/贞洁誓言条目存在");
// 39.2) 拥有判定：童贞（双条件）与神殿之担（gte 1）
V.player = { virginity: { vaginal: true, penile: true }, temple: true };
V.temple_burden = 0;
assert(api39.traitOwned(tVirgin39, V) === true, "39.2 童贞拥有判定 true（双条件满足）");
V.player.virginity.penile = false;
assert(api39.traitOwned(tVirgin39, V) === false, "39.2 童贞拥有判定 false（penile 不满足）");
assert(api39.traitOwned(tTemple39, V) === false, "39.2 神殿之担未拥有（temple_burden=0）");
// 39.3) 获取：has 全部条件变量写满足（童贞双条件 + 神殿之担 gte 1）
V.player.virginity.penile = false;
let g39a = api39.grantTrait(tVirgin39, V);
assert(V.player.virginity.vaginal === true && V.player.virginity.penile === true, "39.3 获取童贞：vaginal/penile 均写满足, 实际 " + JSON.stringify(V.player.virginity));
let g39b = api39.grantTrait(tTemple39, V);
assert(V.temple_burden === 1, "39.3 获取神殿之担：temple_burden=1, 实际 " + V.temple_burden);
// 39.4) 移除：主变量写回不满足
let r39a = api39.revokeTrait(tTemple39, V);
assert(V.temple_burden === 0, "39.4 移除神殿之担：temple_burden=0, 实际 " + V.temple_burden);
let r39b = api39.revokeTrait(tVirgin39, V);
assert(V.player.virginity.vaginal === false, "39.4 移除童贞：主变量 vaginal=false, 实际 " + JSON.stringify(V.player.virginity));
// 39.5) 数值可改 + 留痕回退（通道 player-self）
let w39 = api39.traitWriteValue(tTemple39, V, "temple_burden", "25");
assert(w39.ok && V.temple_burden === 25, "39.5 神殿之担数值改 25 成功, 实际 " + V.temple_burden);
assert(V.mbCE_wrote && V.mbCE_wrote["cheat:player-self:trait:temple_burden"], "39.5 留痕键 trait:temple_burden 存在");
let u39 = api39.undoCheatModValue("player-self", "trait:temple_burden");
assert(u39.ok && V.temple_burden === 0, "39.5 数值回退还原 0, 实际 " + V.temple_burden);
// 39.6) 表达式求值器：复杂 and/or/嵌套/全局函数兜底不崩
const tKylar39 = findT39("Stockholm Syndrome: Kylar");
V.syndromekylar = 1; V.location = "prison";
const C39 = { npc: { Kylar: { state: "normal" } } };
assert(api39.traitOwned(tKylar39, V) === true, "39.6 Kylar 综合征判定 true（syndrome+location 组合）, 实际 " + api39.traitOwned(tKylar39, V));
V.syndromekylar = 0;
assert(api39.traitOwned(tKylar39, V) === false, "39.6 Kylar 综合征判定 false");
// 39.7) 中文显示名：静态名+插值名
assert(api39.traitDisplayName(tTemple39, V).indexOf("神殿之担") !== -1, "39.7 神殿之担中文名, 实际 " + api39.traitDisplayName(tTemple39, V));
assert(api39.traitDisplayName(tVirgin39, V).indexOf("童贞") !== -1, "39.7 童贞中文名, 实际 " + api39.traitDisplayName(tVirgin39, V));
// 39.8) 模组特质自动发现（maplebirch.temporary.traitLists，39.0 已前置 mock）
const mod39 = api39.discoverModTraits();
assert(mod39.length === 2 && mod39[0].name === "命运之轮" && mod39[1].hasFn() === true, "39.8 模组特质发现 2 条（has 函数可判定）, 实际 " + JSON.stringify(mod39.map(m => m.name)));
assert(api39.traitOwned(mod39[1], V) === true && api39.traitOwned(mod39[0], V) === false, "39.8 模组特质拥有判定用 hasFn, 实际 " + api39.traitOwned(mod39[1], V));
// 39.9) 全部特质名中文化：无英文残留/无函数源码/无乱码；A/B 多段与函数名映射正确
const raw39 = api39.VANILLA_TRAITS_RAW;
const badZh = [];
raw39.forEach(t => {
  const nm = String(t.name || '').replace(/^"|"$/g, '');
  const d = api39.traitDisplayName({name: nm, has: t.has, text: t.text}, {});
  if (d === nm || /=>/.test(d) || /\$\{/.test(d) || /^\s*`/.test(d) || (/[A-Za-z]{4}/.test(d) && !/NPC/.test(d))) { badZh.push(d); }
});
assert(badZh.length === 0, "39.9 静态表全部特质显示为中文, 实际未中文化 " + badZh.length + " 条: " + badZh.slice(0, 3).join(" | "));
assert(raw39.length >= 160, "39.9 静态表总条目 >=160（General 分类补全）, 实际 " + raw39.length);
const zhSpec = api39.traitDisplayName({name: '() => { const penisSize = setup.penisSizes[$player.penissize].toUpperFirst(); return `Acceptance: ${penisSize} Penis`; }', has: '', text: ''}, {});
assert(zhSpec.indexOf("接纳：阴茎") !== -1, "39.9 函数源码型特质映射 接纳：阴茎, 实际 " + zhSpec);
const zhMulti = api39.traitDisplayName({name: 'Breasts／Flat Chest', has: '', text: ''}, {});
assert(zhMulti.indexOf("胸部") !== -1 && zhMulti.indexOf("平胸") !== -1, "39.9 A/B 多段映射 胸部 / 平胸, 实际 " + zhMulti);
const zhCollar = api39.traitDisplayName({name: 'familiar collar／Hypnotic Devotion／Hypnotic Curiosity', has: '', text: ''}, {});
assert(zhCollar.indexOf("催眠项圈") !== -1 && zhCollar.indexOf("催眠虔信") !== -1 && zhCollar.indexOf("催眠好奇") !== -1, "39.9 催眠项圈三档映射, 实际 " + zhCollar);
const zhAngels = api39.traitDisplayName({name: 'Radiant', has: '', text: ''}, {});
assert(zhAngels.indexOf("圣光璀璨") !== -1, "39.9 圣光璀璨映射, 实际 " + zhAngels);
const zhKnowledge = api39.traitDisplayName({name: 'Knowledge: Islander language', has: '', text: ''}, {});
assert(zhKnowledge.indexOf("知识：海岛语言") !== -1, "39.9 知识：海岛语言映射, 实际 " + zhKnowledge);
// 清理
delete global.window; delete global.document; delete global.$;
delete V.player; delete V.temple_burden; delete V.syndromekylar; delete V.location; delete V.mbCE_wrote;

// ============ 第 40 节：v1.8.3 三需求（角色中文映射 / 系列合并 API / 无可写条件强制获得） ============
// 40.1) 模组角色英文名 → 中文映射（截图 5：Tsukihan/Rowan/Adrian/Marlow/Grant/Needmeet/Feng）
assert(api39.displayName("Tsukihan") === "月羽", "40.1 Tsukihan → 月羽（v1.9.9 更正：枯木 2.5.0 官方中文名月羽，旧译名月半废弃）, 实际 " + api39.displayName("Tsukihan"));
assert(api39.displayName("Rowan") === "罗文", "40.1 Rowan → 罗文, 实际 " + api39.displayName("Rowan"));
assert(api39.displayName("Adrian") === "阿德里安", "40.1 Adrian → 阿德里安, 实际 " + api39.displayName("Adrian"));
assert(api39.displayName("Marlow") === "马洛", "40.1 Marlow → 马洛, 实际 " + api39.displayName("Marlow"));
assert(api39.displayName("Grant") === "格兰特", "40.1 Grant → 格兰特, 实际 " + api39.displayName("Grant"));
assert(api39.displayName("Needmeet") === "遇欲", "40.1 Needmeet → 遇欲（对齐 DolOpt 官方中文名，旧译名尼德米特废弃）, 实际 " + api39.displayName("Needmeet"));
assert(api39.displayName("Feng") === "老冯", "40.1 Feng → 老冯, 实际 " + api39.displayName("Feng"));
assert(api39.displayName("Seath") === "希斯" && api39.displayName("Alice") === "爱丽丝" && api39.displayName("Liddell") === "利德尔", "40.1 v1.8.19 新译名 Seath→希斯/Alice→爱丽丝/Liddell→利德尔, 实际 " + api39.displayName("Seath") + "/" + api39.displayName("Alice") + "/" + api39.displayName("Liddell"));
assert(api39.displayName("Ivory Wraith") === "怨灵" && api39.displayName("Avery") === "艾弗里", "40.1 原有映射不受影响 怨灵/艾弗里");
assert(api39.displayName("NoSuchModChar") === "NoSuchModChar", "40.1 未收录模组角色兜底原样");
// 40.2) 系列合并 API：学校成绩系列（同变量多档位）
const s40 = api39.groupTraitSeries(vt39);
const math40 = s40.filter(s => s.path === "mathstrait")[0];
assert(!!math40 && math40.series.length === 4, "40.2 数学成绩系列 4 档, 实际 " + (math40 ? math40.series.length : 0));
assert(api39.traitSeriesName(math40) === "数学成绩", "40.2 数学成绩系列中文名, 实际 " + (math40 ? api39.traitSeriesName(math40) : "无"));
const eng40 = s40.filter(s => s.path === "englishtrait")[0];
assert(api39.traitSeriesName(eng40) === "语文成绩", "40.2 语文成绩系列中文名（DoL 中 english=语文）, 实际 " + (eng40 ? api39.traitSeriesName(eng40) : "无"));
// 40.3) 无可写条件特质 → 强制获得（截图 6：接纳特质只读 → 直接获得；Pregnant 为纯函数型 has）
const tPreg40 = vt39.filter(t => t.name === "Pregnant")[0];
assert(!!tPreg40, "40.3 Pregnant 特质存在");
delete V.mbCE_forcedTraits;
const g40 = api39.grantTrait(tPreg40, V);
assert(Array.isArray(V.mbCE_forcedTraits) && V.mbCE_forcedTraits.length === 1, "40.3 无可写条件 → 记入强制获得标记, 实际 " + JSON.stringify(V.mbCE_forcedTraits));
assert(g40.some(w => String(w).indexOf("mbCE_forcedTraits+") !== -1), "40.3 返回值标记强制获得, 实际 " + JSON.stringify(g40));
assert(api39.traitOwned(tPreg40, V) === true, "40.3 强制获得后拥有判定 true（不再只读）");
const r40 = api39.revokeTrait(tPreg40, V);
assert(V.mbCE_forcedTraits.length === 0, "40.3 移除后强制标记清空, 实际 " + JSON.stringify(V.mbCE_forcedTraits));
assert(r40.some(w => String(w).indexOf("mbCE_forcedTraits-") !== -1), "40.3 返回值标记移除强制, 实际 " + JSON.stringify(r40));
assert(api39.traitOwned(tPreg40, V) === false, "40.3 移除后拥有判定 false（函数未满足）");
// 40.4) 强制获得不影响可写条件特质（回归：神殿之担仍走变量写入，不误标强制）
delete V.mbCE_forcedTraits;
V.temple_burden = 0;
const tTemple40 = vt39.filter(t => String(t.name).indexOf("Temple Burden") !== -1)[0];
const g40b = api39.grantTrait(tTemple40, V);
assert(V.temple_burden === 1 && (!V.mbCE_forcedTraits || V.mbCE_forcedTraits.length === 0), "40.4 可写条件特质走变量写入, 不误标强制, 实际 mbCE_forcedTraits=" + JSON.stringify(V.mbCE_forcedTraits));
delete V.temple_burden; delete V.mbCE_forcedTraits;

// ============ 第 41 节：v1.8.8 新模组适配（学 CombatTerminator/AutoClean 全局页功能 + 三新适配器） ============
/* 41.1）庄园自动维护 mcFeedAvery（学 AutoClean AutoCleanFeedAvery）：按喜好→牛排/舒芙蕾/扁意面→最高难度
   v1.9.10 修复：avery_food_select 刷新在所有喂食分支后无条件执行（对齐 AutoClean 函数末尾
   wikifier("avery_food_select")；此前仅最高难度分支内刷新 → 点菜/牛排路径点菜永不轮换） */
V.avery_fate = "saved"; V.avery_mansion = { food: "steak", rage: {} };
V.foodstuff = { steak: { amount: 5 }, souffle: { amount: 2 } };
var averyFS_calls = 0;
var hadWindow41 = typeof window !== "undefined";
if (!hadWindow41) { global.window = {}; }
var oldSC41 = window.SugarCube;
window.SugarCube = { Wikifier: function (ignore, code) { if (String(code).indexOf("avery_food_select") !== -1) { averyFS_calls += 1; } } };
var feed1 = api.mcFeedAvery ? api.mcFeedAvery() : (setup.mbStageCE.mcFeedAvery ? setup.mbStageCE.mcFeedAvery() : null);
if (feed1 === null) { feed1 = { error: "mcFeedAvery 不可达" }; }
assert(feed1 && feed1.fed === "steak" && V.foodstuff.steak.amount === 4, "41.1 艾弗里投喂按喜好扣 steak，实际 fed=" + (feed1 && feed1.fed) + " amount=" + V.foodstuff.steak.amount);
assert(averyFS_calls === 1, "41.1 点菜/牛排分支喂食后也刷新 avery_food_select（点菜轮换），实际调用=" + averyFS_calls);
V.avery_mansion.food = "linguine"; delete V.foodstuff.steak; delete V.foodstuff.souffle;
var feed2 = api.mcFeedAvery ? api.mcFeedAvery() : (setup.mbStageCE.mcFeedAvery ? setup.mbStageCE.mcFeedAvery() : { missed: true });
assert(feed2.missed === true && V.avery_mansion.rage.dinner_missed === 1, "41.1 无菜可喂 → dinner_missed+1，实际 missed=" + feed2.missed + " 计数=" + V.avery_mansion.rage.dinner_missed);
assert(averyFS_calls === 2, "41.1 无菜可喂（missed）后仍刷新点菜（AutoClean 无条件），实际调用=" + averyFS_calls);
V.avery_fate = "unknown";
var feed3 = api.mcFeedAvery ? api.mcFeedAvery() : (setup.mbStageCE.mcFeedAvery ? setup.mbStageCE.mcFeedAvery() : { missed: true });
assert(feed3.skipped === true && feed3.missed !== true && V.avery_mansion.rage.dinner_missed === 1, "41.1 未达喂食阶段不操作不计 missed（对齐 AutoClean），实际 skipped=" + feed3.skipped + " 计数=" + V.avery_mansion.rage.dinner_missed);
assert(averyFS_calls === 2, "41.1 skipped（fate 未确立）不刷新点菜，实际调用=" + averyFS_calls);
if (oldSC41 !== undefined) { window.SugarCube = oldSC41; } else { delete window.SugarCube; }
if (!hadWindow41) { delete global.window; }
delete V.avery_fate; delete V.avery_mansion; delete V.foodstuff;

/* 41.2）农场维护 mcMaintainFarm（学 AutoClean AutoCleanFarm）：塔卫≥1000 锁动物 / 清 aggro / stock 收获清零 */
V.farm = { tower_guard: {}, tower_guard_skill: 1200, beasts: { horses: 12, pigs: 5, cattle: 8, dogs: 3 }, aggro: 1, stock: { eggs: 4, milk: 2 } };
V.farm_stage = 6;
var mf1 = api.mcMaintainFarm ? api.mcMaintainFarm() : (setup.mbStageCE.mcMaintainFarm ? setup.mbStageCE.mcMaintainFarm() : {});
assert(mf1.beasts === 4 && V.farm.beasts.horses === 30 && V.farm.aggro === 0, "41.2 塔卫在岗且技能≥1000 动物锁 30 + aggro 清零，实际 beasts=" + mf1.beasts + " aggro=" + V.farm.aggro);
assert(mf1.harvested === 2 && V.farm.stock.eggs === 0 && V.farm.stock.milk === 0, "41.2 库存收获并清零，实际 harvested=" + mf1.harvested + " eggs=" + V.farm.stock.eggs);
V.farmerCanSell = true;
var mf2 = api.mcMaintainFarm ? api.mcMaintainFarm() : (setup.mbStageCE.mcMaintainFarm ? setup.mbStageCE.mcMaintainFarm() : {});
assert(mf2.harvested === 0, "41.2 farmerCanSell 让位不自动收货，实际 " + mf2.harvested);
V.farmerCanSell = false;
V.farm = { tower_guard: {}, tower_guard_skill: 1200, beasts: { horses: 1, pigs: 1, cattle: 1, dogs: 1 }, aggro: 1, stock: { eggs: 1, milk: 1, truffles: 1, cream: 2 } };
V.farm_stage = 6;
var mf1b = api.mcMaintainFarm ? api.mcMaintainFarm() : (setup.mbStageCE.mcMaintainFarm ? setup.mbStageCE.mcMaintainFarm() : {});
assert(mf1b.harvested === 4 && V.farm.stock.cream === 0 && V.farm.stock.truffles === 0 && V.farm.stock.eggs === 0, "41.2b 四类库存全部处理并清零（eggs→chicken_egg/milk→bottle_of_milk/truffles→truffle 映射收货，cream 无原版食物键仅清库存），实际 harvested=" + mf1b.harvested + " cream=" + V.farm.stock.cream);
delete V.farm; delete V.farm_stage; delete V.farmerCanSell;

/* 41.2c）v1.8.10 维护扩展（学 AutoClean 剩余维护面）：神殿条件锁 / 伊甸无条件锁 / 补给 / 打扫
   修复（v1.9.x）：神殿技能判断改为 V 顶层标量 V.housekeeping/V.tending（原版+AutoClean boot.json 实证，
   V.skill 在原版不存在 → 旧写法恒 false → 玩家报"技能满足却未达标"） */
V.housekeeping = 1200; V.tending = 800; V.temple_quarters = 55; V.temple_garden = 60;
var mt1 = api.mcMaintainTemple ? api.mcMaintainTemple() : (setup.mbStageCE.mcMaintainTemple ? setup.mbStageCE.mcMaintainTemple() : {});
assert(mt1.quarters === true && V.temple_quarters === 100 && mt1.garden === false && V.temple_garden === 60, "41.2c 神殿维护按顶层技能条件锁：housekeeping≥1000 宿舍=100，tending<1000 花园不动（无 V.skill 不误判），实际 quarters=" + mt1.quarters + " garden=" + mt1.garden + " temple_garden=" + V.temple_garden);
V.tending = 1200;
var mt2 = api.mcMaintainTemple ? api.mcMaintainTemple() : (setup.mbStageCE.mcMaintainTemple ? setup.mbStageCE.mcMaintainTemple() : {});
assert(mt2.garden === true && V.temple_garden === 100, "41.2c 神殿维护 tending≥1000 花园=100，实际 garden=" + mt2.garden);
delete V.housekeeping; delete V.tending;
V.housekeeping = 900; V.temple_quarters = 40;
var mt3 = api.mcMaintainTemple ? api.mcMaintainTemple() : (setup.mbStageCE.mcMaintainTemple ? setup.mbStageCE.mcMaintainTemple() : {});
assert(mt3.quarters === false && V.temple_quarters === 40, "41.2c 神殿维护 housekeeping<1000 不锁宿舍，实际 quarters=" + mt3.quarters + " temple_quarters=" + V.temple_quarters);
V.edengarden = 1; V.edenshrooms = 2; V.edenspring = 3;
var me1 = api.mcMaintainEden ? api.mcMaintainEden() : (setup.mbStageCE.mcMaintainEden ? setup.mbStageCE.mcMaintainEden() : {});
assert(me1.locked === 3 && V.edengarden === 4 && V.edenshrooms === 4 && V.edenspring === 4, "41.2c 伊甸维护无条件锁 4（三键），实际 locked=" + me1.locked);
V.soap = 3; V.salve = 15; V.bird = { upgrades: { firepit: 3 }, materials: { wood: 12 } };
var mr1 = api.mcRestockSupplies ? api.mcRestockSupplies() : (setup.mbStageCE.mcRestockSupplies ? setup.mbStageCE.mcRestockSupplies() : {});
assert(mr1.soap === true && mr1.salve === false && mr1.wood === false && V.soap === 10 && V.salve === 15 && V.bird.materials.wood === 12, "41.2c 补给：肥皂不足 10 补到 10；药膏/木材已 ≥10 不压低（对齐 AutoClean <10 才补），实际 soap=" + V.soap + " salve=" + V.salve + " wood=" + V.bird.materials.wood);
V.soap = 15; V.bird = { upgrades: { firepit: 2 }, materials: { wood: 2 } };
var mr2 = api.mcRestockSupplies ? api.mcRestockSupplies() : (setup.mbStageCE.mcRestockSupplies ? setup.mbStageCE.mcRestockSupplies() : {});
assert(mr2.soap === false && mr2.wood === false && V.soap === 15 && V.bird.materials.wood === 2, "41.2c 补给：肥皂≥10 不动；火坑<3 不补木材（对齐 AutoClean 前置），实际 soap=" + V.soap + " wood=" + V.bird.materials.wood);
V.avery_fate = "saved"; V.avery_mansion = { pool: 2, kitchen: 1, lounge: 3, display: 0, bedroom: 2, bathroom: 1, dining: 2, garden: 3, study: 1, garage: 1, days_absent: 3 };
var mc1 = api.mcCleanMansion ? api.mcCleanMansion() : (setup.mbStageCE.mcCleanMansion ? setup.mbStageCE.mcCleanMansion() : {});
assert(mc1.rooms === 10 && V.avery_mansion.pool === 0 && V.avery_mansion.bedroom === 0 && V.avery_mansion.days_absent === 0, "41.2c 庄园打扫：fate=saved 时十房间计数归零 + days_absent=0（原版数值结构），实际 rooms=" + mc1.rooms + " days=" + mc1.days);
V.avery_fate = "none";
var mc2 = api.mcCleanMansion ? api.mcCleanMansion() : (setup.mbStageCE.mcCleanMansion ? setup.mbStageCE.mcCleanMansion() : {});
assert(mc2.skipped === true && mc2.rooms === 0, "41.2c 庄园打扫：fate 未确立跳过不操作，实际 skipped=" + mc2.skipped + " rooms=" + mc2.rooms);
delete V.housekeeping; delete V.tending; delete V.temple_quarters; delete V.temple_garden; delete V.edengarden; delete V.edenshrooms; delete V.edenspring; delete V.soap; delete V.salve; delete V.bird; delete V.avery_mansion; delete V.avery_fate;

/* 41.2d）v1.9.x 每日全自动维护调度：开关持久化（localStorage mbCE_auto）+ Time.days 日更自动执行 */
var ls41 = (function () { var m = {}; return { getItem: function (k) { return m[k] === undefined ? null : m[k]; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; })();
var oldLS41 = global.localStorage;
global.localStorage = ls41;
var oldTime41 = global.Time;
global.Time = { days: 100 };
api.mcAutoSet("feed", true);
var st41 = api.mcAutoState();
assert(st41.items.feed === true, "41.2d mcAutoSet 开启自动投喂并持久化，实际 " + (st41.items.feed));
var t1 = api.mcAutoMaintainTick ? api.mcAutoMaintainTick() : { ran: 0 };
assert(t1.ran === 0, "41.2d 开启当日（mcAutoSet 已记 lastDay=100，按钮已即时执行）tick 不重复执行，实际 ran=" + t1.ran);
var t2 = api.mcAutoMaintainTick ? api.mcAutoMaintainTick() : { ran: 0 };
assert(t2.ran === 0, "41.2d 同日不重复执行，实际 ran=" + t2.ran);
global.Time = { days: 101 };
var t3 = api.mcAutoMaintainTick ? api.mcAutoMaintainTick() : { ran: 0 };
assert(t3.ran === 1, "41.2d 次日（Time.days=101）再次自动执行，实际 ran=" + t3.ran);
api.mcAutoSet("feed", false);
global.Time = { days: 102 };
var t4 = api.mcAutoMaintainTick ? api.mcAutoMaintainTick() : { ran: 0 };
assert(t4.ran === 0, "41.2d 关闭后不再自动执行，实际 ran=" + t4.ran);
api.mcAutoSet("temple", true);
V.housekeeping = 1200; V.tending = 1200; V.temple_quarters = 55; V.temple_garden = 60;
global.Time = { days: 103 };
var t5 = api.mcAutoMaintainTick ? api.mcAutoMaintainTick() : { ran: 0 };
assert(t5.ran === 1 && V.temple_quarters === 100 && V.temple_garden === 100, "41.2d 自动神殿维护生效（宿舍/花园=100），实际 ran=" + t5.ran + " tq=" + V.temple_quarters + " tg=" + V.temple_garden);
api.mcAutoSet("temple", false);
/* 持久化跨"重载"验证：lastDay=103 保留 → 同日不重复 */
var t6 = api.mcAutoMaintainTick ? api.mcAutoMaintainTick() : { ran: 0 };
assert(t6.ran === 0, "41.2d 重载后 lastDay=103 保留、同日不重复，实际 ran=" + t6.ran);
if (oldTime41 !== undefined) { global.Time = oldTime41; } else { delete global.Time; }
if (oldLS41 !== undefined) { global.localStorage = oldLS41; } else { delete global.localStorage; }
delete V.housekeeping; delete V.tending; delete V.temple_quarters; delete V.temple_garden;

/* 41.3）新适配器探测：Dol-Optimization（window.DolOptimization）/ Wraith（V 根）/ DoLSims（window.MirrorHypnoVariableRefresh） */
global.window = { DolOptimization: {}, MirrorHypnoVariableRefresh: function () {} };
V.WraithsReflection = 1;
var mods41 = api.getCheatMods();
var mo41 = mods41.filter(function (x) { return x.modId === "dol-optimization"; })[0];
var mw41 = mods41.filter(function (x) { return x.modId === "wraiths-reflection"; })[0];
var md41 = mods41.filter(function (x) { return x.modId === "dolsims"; })[0];
assert(!!mo41 && mo41.modName.indexOf("Dol-Optimization") !== -1, "41.3 Dol-Optimization 探测命中（window.DolOptimization）");
assert(!!mw41 && mw41.stages.filter(function (s) { return s.varPath === "WraithsReflection"; }).length === 1, "41.3 Wraith'sReflection 探测命中（V 根并集）");
assert(!!md41 && md41.values.filter(function (v) { return v.varPath === "sinSims"; }).length === 1, "41.3 DoLSims 探测命中（window.MirrorHypnoVariableRefresh）");
/* 41.4）Dol-Optimization 写入：needmeet_romance 钳制 + options 子键路径 */
api.applyCheatModValue("dol-optimization", "opt_needmeet", 90);
assert(V.needmeet_romance === 90, "41.4 Needmeet 好感写入 90");
api.applyCheatModValue("dol-optimization", "opt_needmeet", 500);
assert(V.needmeet_romance === 500, "41.4 Needmeet 上限不钳制（写 500 原样）");
V.options = { opt: { WornStacking: false } };
api.toggleCheatAbility("dol-optimization", "opt_worn", true);
assert(V.options.opt.WornStacking === true, "41.4 叠穿开关经 options.opt 写入，实际 " + V.options.opt.WornStacking);
V.options.DolOptimization = {};
api.applyCheatModValue("dol-optimization", "opt_wardrobe", 5000);
assert(V.options.DolOptimization.LargerWardrobeValue === 5000, "41.4 衣柜扩容值写入 5000");
/* 41.4b 便利店库存豁免（v1.9.11 未定版：DolOpt 借用原版 $daily 存自己的键，opt1121/Source/twee/game.twee 实证
   `<<set $daily.conveniencestoregoods to {}>>`；适配器声明路径放行 vanilla 拦截，未声明原版根仍拒） */
V.daily = { conveniencestoregoods: {} };
var rc41b = api.applyCheatModValue("dol-optimization", "opt_cs_egg", 50);
assert(rc41b.ok && V.daily.conveniencestoregoods["鸡蛋"] === 50, "41.4b 便利店·鸡蛋库存写入成功（豁免 vanilla 拦截），实际 " + JSON.stringify(V.daily.conveniencestoregoods["鸡蛋"]));
api.applyCheatModValue("dol-optimization", "opt_cs_shampoo", 8);
assert(V.daily.conveniencestoregoods["洗发水"] === 8, "41.4b 便利店·洗发水库存写入成功");
api.applyCheatModValue("dol-optimization", "opt_cs_orange", 30);
assert(V.daily.conveniencestoregoods["橙子"] === 30, "41.4b 便利店·橙子库存写入成功");
api.applyCheatModValue("dol-optimization", "opt_cs_egg", 200);
assert(V.daily.conveniencestoregoods["鸡蛋"] === 200, "41.4b 鸡蛋库存上限不钳制（写 200 原样）");
delete V.daily;
api.applyCheatModValue("dol-optimization", "opt_wardrobe", 99999);
assert(V.options.DolOptimization.LargerWardrobeValue === 99999, "41.4 衣柜扩容上限不钳制（写 99999 原样）");
delete V.needmeet_romance; delete V.options;
/* 41.5）Wraith'sReflection：恋爱闸门 0/1 + necklaceThief 枚举拒绝 + rreturn/return 双取值 */
var wrg = api.setCheatStage("wraiths-reflection", "wr_gate", 1);
assert(wrg.ok && V.WraithsReflection === 1, "41.5 恋爱闸门写入 1");
var wrt = api.setCheatStage("wraiths-reflection", "wr_thief", "return");
assert(wrt.ok && V.necklaceThief === "return", "41.5 necklaceThief 写 return 通过");
var wrt2 = api.setCheatStage("wraiths-reflection", "wr_thief", "bogus");
assert(wrt2.ok === false, "41.5 necklaceThief 枚举越界拒绝（bogus），实际 ok=" + wrt2.ok);
var wrt3 = api.setCheatStage("wraiths-reflection", "wr_thief", "rreturn");
assert(wrt3.ok && V.necklaceThief === "rreturn", "41.5 双 r 拼写 rreturn 如实可写（模组自身 bug 取值）");
/* 2026-10-24：wr_conch（SilverConchWR）已删——1.3.4 对照源码零证据（resolve_missing 人工复核 0 命中），银海螺键不再暴露 */
delete V.WraithsReflection; delete V.necklaceThief;
/* 41.6）DoLSims：钳制 + 宿主缺失拒绝 */
api.applyCheatModValue("dolsims", "ds_sin", 5000);
assert(V.sinSims === 5000, "41.6 sinSims 上限不钳制（写 5000 原样），实际 " + V.sinSims);
var dsd = api.applyCheatModValue("dolsims", "ds_discipline", 30);
assert(dsd.ok === false && (dsd.message || "").indexOf("宿主") !== -1, "41.6 四维宿主缺失拒绝写入不崩，实际 " + (dsd.message || ""));
V.DisciplineSims = { value: 5 };
api.applyCheatModValue("dolsims", "ds_discipline", 50);
assert(V.DisciplineSims.value === 50, "41.6 纪律值上限不钳制（写 50 原样，模组自身 clamp 由其源码负责），实际 " + V.DisciplineSims.value);
api.applyCheatModValue("dolsims", "ds_hypno", 999);
assert(V.hypnoSims === 999, "41.6 催眠熟练度写入 999");
var dsu = api.undoCheatModValue("dolsims", "value_set:ds_hypno");
assert(dsu.ok && V.hypnoSims === undefined, "41.6 催眠熟练度回退还原初始（原为 undefined，删除叶子），实际 " + V.hypnoSims);
delete V.sinSims; delete V.DisciplineSims; delete V.hypnoSims; delete V.mbCE_wrote;
/* 41.7）卸载后三个适配器自动消失 */
delete global.window.DolOptimization; delete global.window.MirrorHypnoVariableRefresh; delete V.WraithsReflection;
var mods41b = api.getCheatMods();
assert(mods41b.filter(function (x) { return x.modId === "dol-optimization" || x.modId === "dolsims" || x.modId === "wraiths-reflection"; }).length === 0, "41.7 卸载后三新适配器自动消失");
delete global.window;

/* 42.1）v1.8.12 数值相对值修改：+N / -N 相对调整（cheatWriteValue 数据层，全部数值通道生效） */
V.mceRelTest = 50;
var r42a = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "100", "number");
assert(r42a.ok && V.mceRelTest === 100, "42.1 绝对值 100 写入（不受相对解析影响），实际 " + V.mceRelTest);
var r42b = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "+100", "number");
assert(r42b.ok && V.mceRelTest === 200, "42.1 相对 +100（当前 100→200），实际 " + V.mceRelTest);
var r42c = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "-20", "number");
assert(r42c.ok && V.mceRelTest === 180, "42.1 相对 -20（当前 200→180），实际 " + V.mceRelTest);
var r42d = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "+ 5", "number");
assert(r42d.ok && V.mceRelTest === 185, "42.1 相对 + 5（空格宽容，180→185），实际 " + V.mceRelTest);
/* 相对值 + 钳制组合 */
var r42e = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "+50", "number", undefined, 190);
assert(r42e.ok && V.mceRelTest === 235, "42.1 相对 +50 上限不钳制（185+50→235），实际 " + V.mceRelTest);
var r42f = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "abc", "number");
assert(r42f.ok === false, "42.1 非数字拒绝（abc），实际 ok=" + r42f.ok);
var r42g = api.cheatWriteValue("player-self", "t:rel", "value_set", "mceRelTest", "+", "number");
assert(r42g.ok === false, "42.1 只有符号无数字拒绝（+），实际 ok=" + r42g.ok);
/* 特质数值可改块通道（traitWriteValue → cheatWriteValue）同样支持相对 */
V.lifeTest = 30;
var t42 = api.traitWriteValue({ name: "mceRelLife", text: "" }, V, "lifeTest", "+10");
assert(t42.ok && V.lifeTest === 40, "42.1 特质数值通道相对 +10（30→40），实际 " + V.lifeTest);
/* 原始状态恢复 */
var r42u = api.undoCheatModValue("player-self", "t:rel");
assert(r42u.ok && V.mceRelTest === 50, "42.1 相对写入同样留痕可回退（还原首次写入前 50），实际 " + V.mceRelTest);
delete V.mceRelTest; delete V.lifeTest; delete V.mbCE_wrote;

/* 42.2）v1.8.12 特质收藏（数据层）：toggle 往返 + key 规则 + 容错 */
var favT = api.compileVanillaTraits().filter(function (x) { return x.name === "Pregnant"; })[0];
assert(!!favT, "42.2 Pregnant 特质存在于静态表");
var fk0 = api.getFavTraits(V);
assert(Array.isArray(fk0) && fk0.length === 0, "42.2 初始无收藏");
var ft1 = api.toggleFavTrait(favT, V);
assert(ft1.ok && ft1.fav === true, "42.2 收藏 Fashionable 成功，实际 fav=" + ft1.fav);
var fk1 = api.getFavTraits(V);
assert(fk1.length === 1 && fk1[0] === api.favTraitKey(favT), "42.2 收藏数组含 key（cat\u0001name），实际 " + JSON.stringify(fk1));
assert(api.isFavTrait(favT, V) === true, "42.2 isFavTrait 判定 true");
var ft2 = api.toggleFavTrait(favT, V);
assert(ft2.ok && ft2.fav === false && api.isFavTrait(favT, V) === false, "42.2 再次 toggle 取消收藏，fav=" + ft2.fav);
var fk2 = api.getFavTraits(V);
assert(fk2.length === 0, "42.2 取消后数组清空");
/* 容错：V.mbCE_favTraits 缺失 / 非数组时读空数组、写自动创建 */
delete V.mbCE_favTraits;
assert(Array.isArray(api.getFavTraits(V)) && api.getFavTraits(V).length === 0, "42.2 缺失时读空数组");
var ft3 = api.toggleFavTrait(favT, V);
assert(ft3.ok && Array.isArray(V.mbCE_favTraits) && V.mbCE_favTraits.length === 1, "42.2 缺失时自动创建数组并写入");
delete V.mbCE_favTraits;

/* 42.3）v1.8.12 错误收集器数据层 + 面板状态持久化（内存态；无 localStorage 环境静默） */
var e1 = api.mbCEPushError("测试错误A", "test.js:1", "stack-A");
assert(e1 === undefined && api.mbCEErrors().length === 1, "42.3 推入 1 条错误，实际 " + api.mbCEErrors().length);
api.mbCEPushError("测试错误B", "test.js:2", "stack-B");
api.mbCEPushError("测试错误C", "test.js:3", "stack-C");
var e3 = api.mbCEErrors();
assert(e3.length === 3 && e3[0].msg === "测试错误A" && e3[2].msg === "测试错误C", "42.3 三条错误按序记录，实际 " + JSON.stringify(e3.map(function (x) { return x.msg; })));
for (var i = 0; i < 60; i++) { api.mbCEPushError("批量" + i, "x.js", ""); }
var eCap = api.mbCEErrors();
assert(eCap.length === 50 && eCap[0].msg === "批量10" && eCap[49].msg === "批量59", "42.3 错误缓冲上限 50 条（环形截断），实际 " + eCap.length + " 首条=" + eCap[0].msg);
/* 持久化内存态：保存页签 / 折叠 / 搜索词 */
api.mbCEUiSave({ tab: "global" });
var st1 = api.mbCEUiState();
assert(st1.tab === "global", "42.3 mbCEUiSave 更新页签为 global，实际 " + st1.tab);
api.mbCEUiSave({ filter: "受虐" });
var st2 = api.mbCEUiState();
assert(st2.filter === "受虐", "42.3 搜索词持久化，实际 " + st2.filter);
api.mbCEUiCollapsed("性格特质", true);
var st3 = api.mbCEUiState();
assert(st3.collapsed["性格特质"] === 0, "42.3 展开状态记录为 0（open=true），实际 " + st3.collapsed["性格特质"]);
api.mbCEUiCollapsed("性格特质", false);
var st4 = api.mbCEUiState();
assert(st4.collapsed["性格特质"] === 1, "42.3 收起状态记录为 1（open=false），实际 " + st4.collapsed["性格特质"]);
/* 恢复：mbCEUiLoad 无 localStorage 时保持内存态不崩 */
api.mbCEUiLoad();
var st5 = api.mbCEUiState();
assert(st5.tab === "global", "42.3 mbCEUiLoad 容错（无 localStorage 静默不崩），实际 " + st5.tab);
api.mbCEUiSave({ tab: "char", filter: "" });

/* 42.4）v1.8.12 能力项数据驱动重构：items 对象化（path/label/min/max/note）+ 范围钳制走数据表 */
var ddAll = api.PANEL_QUICK_GROUPS.reduce(function (a, g) { return a.concat(g.items); }, []);
assert(ddAll.length === 49, "42.4 数据表共 49 个能力项（9 核心+6 技能+10 性技能+4 成绩+5 武器+9 负面状态+6 名声，v1.9.13 新增 15）, 实际 " + ddAll.length);
assert(ddAll.every(function (it) { return typeof it.path === "string" && typeof it.label === "string" && typeof it.min === "number" && typeof it.max === "number"; }), "42.4 每项均含 path/label/min/max（声明式数据表），缺失项 " + JSON.stringify(ddAll.filter(function (it) { return !(typeof it.path === "string" && typeof it.label === "string" && typeof it.min === "number" && typeof it.max === "number"); })[0]));
var ddPurity = ddAll.filter(function (it) { return it.path === "purity"; })[0];
assert(!!ddPurity && ddPurity.max === 2000 && ddPurity.min === 0, "42.4 purity 范围 0-2000（面板 0-100% 内部量纲），实际 " + ddPurity.min + "-" + ddPurity.max);
var ddSkill = ddAll.filter(function (it) { return it.path === "skulduggery"; })[0];
assert(!!ddSkill && ddSkill.max === 1000, "42.4 技能量纲 0-1000，实际 max=" + ddSkill.max);
var ddProf = ddAll.filter(function (it) { return it.path === "prof.spray"; })[0];
assert(!!ddProf && ddProf.max === 1000, "42.4 武器技能 0-1000，实际 max=" + ddProf.max);
/* 钳制走数据表：超范围被 min/max 拦下 */
var c1 = api.quickWrite("physique", 500);
assert(c1.ok && V.physique === 500, "42.4 physique 写 500 成功（v1.8.19 起无上限，修复前被钳 100），实际 " + V.physique);
var c1b = api.quickWrite("physique", 999999);
assert(c1b.ok && V.physique === 999999, "42.4 physique 写 999999 成功（无上限仅防误输入），实际 " + V.physique);
var c2 = api.quickWrite("skulduggery", -50);
assert(c2.ok && V.skulduggery === 0, "42.4 skulduggery 写 -50 被钳制到 0，实际 " + V.skulduggery);
var c3 = api.quickWrite("purity", 9999);
assert(c3.ok && V.purity === 9999, "42.4 purity 写 9999 上限不钳制（原样），实际 " + V.purity);

/* 42.5）v1.8.12 适配器工作流审计：全部适配器健康，无错误/警告（版本无关：断言 ≥9，具体数随新增适配器增长） */
var aud = api.auditAdapters();
assert(aud.total >= 9, "42.5 审计覆盖 ≥9 个适配器，实际 " + aud.total);
assert(aud.healthy >= 9, "42.5 全部适配器健康（注册键=entry.modId、项 key/name/varPath 完整、有 detect），实际 healthy=" + aud.healthy);
assert(aud.errors.length === 0, "42.5 审计无错误，实际 " + JSON.stringify(aud.errors));
assert(aud.warnings.length === 0, "42.5 审计无警告（无空适配器），实际 " + JSON.stringify(aud.warnings));
assert(aud.healthy === aud.total, "42.5 healthy 与 total 一致（全部可渲染）");

/* 42.6）十二巡：isnot 布尔条件满足/不满足值方向修复（模组特质 has 含 `$x isnot true/false` 时）
   原版 "Broken Vow" 首条件即 $player.virginity.temple isnot true——修复前 grantTrait 写 true（条件仍不满足）、
   revokeTrait 写 false（条件仍满足）。修复后：满足 isnot true → 写 false；移除 → 写 true。 */
var tVow46 = api.compileVanillaTraits().filter(function (x) { return x.name === "Broken Vow"; })[0];
assert(!!tVow46, "42.6 Broken Vow 特质存在于静态表");
V.player = V.player || {};
V.player.virginity = { temple: true };
V.temple_rank = "initiate";
assert(api.traitOwned(tVow46, V) === false, "42.6 前置：temple=true 时 Broken Vow 未拥有");
var g46 = api.grantTrait(tVow46, V);
assert(V.player.virginity.temple === false, "42.6 获取 Broken Vow：isnot true 满足值应写 false，实际 " + V.player.virginity.temple);
assert(api.traitOwned(tVow46, V) === true, "42.6 获取后拥有判定 true（temple=false 满足 isnot true），实际 " + api.traitOwned(tVow46, V));
var r46 = api.revokeTrait(tVow46, V);
assert(V.player.virginity.temple === true, "42.6 移除 Broken Vow：isnot true 不满足值应写 true，实际 " + V.player.virginity.temple);
assert(api.traitOwned(tVow46, V) === false, "42.6 移除后拥有判定 false（temple=true 不满足 isnot true）");
/* isnot undefined 满足 → 写 1（非 undefined）；isnot N → 写 N-1 */
var tI46 = { name: "测试isnot未定义", has: "$mce_isnot_test isnot undefined", text: "" };
var g46b = api.grantTrait(tI46, V);
assert(V.mce_isnot_test === 1, "42.6 isnot undefined 满足值写 1，实际 " + V.mce_isnot_test);
var tI46n = { name: "测试isnot数字", has: "$mce_isnot_num isnot 10", text: "" };
V.mce_isnot_num = 9;
var g46c = api.grantTrait(tI46n, V);
assert(V.mce_isnot_num === 9, "42.6 isnot 10 满足值写 9（N-1，当前已 9 不变），实际 " + V.mce_isnot_num);
delete V.mce_isnot_test; delete V.mce_isnot_num;
/* isnot false 满足 → 写 true */
var tI46f = { name: "测试isnotfalse", has: "$mce_isnot_f isnot false", text: "" };
V.mce_isnot_f = false;
var g46d = api.grantTrait(tI46f, V);
assert(V.mce_isnot_f === true, "42.6 isnot false 满足值写 true，实际 " + V.mce_isnot_f);
delete V.mce_isnot_f; delete V.player.virginity; delete V.temple_rank; delete V.mbCE_wrote; delete V.mbCE_forcedTraits;

/* ============ 第 43 节：v1.8.19 十三巡——播放结束自动清理 + 播放器内取消防困 + 体能无上限 + 新角色译名 ============ */
/* 43.1）独立 eval：window 含 unfreezePlayerStats（原版函数）+ document mock（触发 init 注册 hook） */
global.window = { unfreezePlayerStats: function () { unfreezeCalls43++; }, maplebirch: { npc: {}, get: function () { return undefined; } } };
const dBody43 = mkNode("body"), dHead43 = mkNode("head");
global.document = { body: dBody43, head: dHead43, createElement: mkNode, getElementById: () => null, addEventListener: () => {} };
delete global.$;
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.mbCE_queue; delete V.mbCE_wrote;
V.passage = "Scene Viewer passages";
let unfreezeCalls43 = 0;
eval(js);
const api43 = setup.mbStageCE;
assert(typeof window.unfreezePlayerStats === "function" && window.__mbCEUnfreezeHooked === true, "43.1 unfreeze hook 已安装（__mbCEUnfreezeHooked 标记，原版函数被包装）");
/* 43.2）MOD 固定触发重放中收到 unfreeze = 播放结束 → 自动清理队列 + 重放状态（修复"播放完不取消/重复播放"） */
V.replayScene = { startPassage: "SV Test", exitpassage: "Bedroom" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [ { key: "k43", name: "测试", startPassage: "SV Test", used: true } ];
window.unfreezePlayerStats();
assert(!V.replayScene && !V.mbCE_replayOnce && !V.mbCE_replayPending, "43.2 播放结束自动清理重放状态（修复前残留导致再次触发/拦截新固定）, 实际 replayScene=" + JSON.stringify(V.replayScene));
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "43.2 队列 used 项自动清理（不再重复播放）, 实际 " + JSON.stringify(V.mbCE_queue));
assert(unfreezeCalls43 === 1, "43.2 原版 unfreezePlayerStats 仍被调用（不破坏原版行为）, 实际 " + unfreezeCalls43);
/* 43.3）原版手动重放（未走 MOD 通道）收 unfreeze → hook 不越权清理，保持原版行为 */
unfreezeCalls43 = 0;
V.replayScene = { startPassage: "SV Manual", exitpassage: "Bedroom" };
delete V.mbCE_replayOnce; delete V.mbCE_replayPending;
V.mbCE_queue = [ { key: "k43m", name: "手动", startPassage: "SV Manual", used: true } ];
window.unfreezePlayerStats();
assert(!!V.replayScene && unfreezeCalls43 === 1, "43.3 原版手动重放收 unfreeze 保持原版行为（不删 replayScene）, 实际 replayScene=" + JSON.stringify(V.replayScene));
delete V.replayScene; delete V.mbCE_queue; delete V.mbCE_wrote;
/* 43.4）播放器内取消固定（用户实测场景）：当前段落在原版播放器内 → 取消 → 跳回原位 exitpassage（不原地跳） */
let played43 = null;
global.Engine = { play: function (n, h) { played43 = n + ":" + !!h; } };
V.passage = "Scene Viewer passages";
V.replayScene = { startPassage: "SV Test2", exitpassage: "Bedroom" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [ { key: "k43d", name: "测试2", startPassage: "SV Test2", used: false } ];
V.sceneViewSwitch = "foo";
const up43 = api43.unpinScene("k43d");
assert(up43 === true, "43.4 播放器内取消返回 changed=true, 实际 " + up43);
assert(played43 === "Bedroom:true", "43.4 播放器内取消 → 跳回原位（修复前 back=当前播放器段落原地跳 → 困在播放器）, 实际 " + played43);
assert(!V.replayScene && !V.mbCE_replayOnce && !V.mbCE_replayPending, "43.4 取消后重放状态清空, 实际 " + JSON.stringify(V.replayScene));
assert(!V.mbCE_queue || V.mbCE_queue.length === 0, "43.4 队列该项已移除, 实际 " + JSON.stringify(V.mbCE_queue));
/* 43.5）back 为空（框架播放器取消）：不主动跳转、保留 replayScene → 播放器 Back 链接可用（unfreeze hook 兜底清理） */
V.passage = "Scene Viewer passages";
V.replayScene = { startPassage: "SV Test3", exitpassage: "" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = true;
V.mbCE_queue = [ { key: "k43e", name: "测试3", startPassage: "SV Test3", used: false } ];
played43 = null;
const up43e = api43.unpinScene("k43e");
assert(up43e === true, "43.5 back 空取消仍返回 changed=true, 实际 " + up43e);
assert(played43 === null, "43.5 back 空不主动跳转（防原地跳/无源 Back 被困）, 实际 " + played43);
assert(!!V.replayScene, "43.5 back 空保留 replayScene（原版 Back 链接可用，防被困）, 实际 " + JSON.stringify(V.replayScene));
/* 43.6）体能无上限：quickWrite 写 500/999999 成功（修复前钳 100） */
V.physique = 0;
var ph43 = api43.quickWrite("physique", 500);
assert(ph43.ok && V.physique === 500, "43.6 physique 写 500 成功（v1.8.19 无上限）, 实际 " + V.physique);
var ph43b = api43.quickWrite("physique", 999999);
assert(ph43b.ok && V.physique === 999999, "43.6 physique 写 999999 成功（仅防误输入）, 实际 " + V.physique);
/* 43.7）新角色译名（用户实测角色页英文名 Seath/Alice/Liddell） */
assert(api43.displayName("Seath") === "希斯", "43.7 Seath → 希斯, 实际 " + api43.displayName("Seath"));
assert(api43.displayName("Alice") === "爱丽丝", "43.7 Alice → 爱丽丝, 实际 " + api43.displayName("Alice"));
assert(api43.displayName("Liddell") === "利德尔", "43.7 Liddell → 利德尔, 实际 " + api43.displayName("Liddell"));
/* 清理 43 节 */
delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.mbCE_queue; delete V.mbCE_wrote; delete V.physique; delete V.passage;
delete global.Engine; delete global.document; delete global.window; delete global.$;

/* ============ 第 44 节：v1.9.0 角色分类子页（模组/恋爱/普通/持久NPC）+ 场景"地点"子界面 ============ */
/* 44.0）环境：权威原版清单（setup.NPCNameList 32 / setup.loveInterestNpc 10）+ per_npc 持久角色 mock + DOM mock 重载 */
setup.NPCNameList = ["Avery","Bailey","Briar","Charlie","Darryl","Doren","Eden","Gwylan","Harper","Jordan","Kylar","Landry","Leighton","Mason","Morgan","River","Robin","Sam","Sirris","Whitney","Winter","Black Wolf","Niki","Quinn","Remy","Alex","Great Hawk","Wren","Sydney","Ivory Wraith","Zephyr","Night Monster"];
setup.loveInterestNpc = ["Robin","Whitney","Kylar","Sydney","Eden","Avery","Black Wolf","Great Hawk","Alex","Gwylan"];
V.per_npc = {
  "manager": { name: "Helen", love: 42, lust: 3, dom: 10, wary: 0, name_known: 1 },
  "school_nurse": { love: 0, lust: 0 },
  "anxious_guard": { name: "Mark", name_known: 1, love: 7 }
};
V.mickeyName = "米奇";
delete V.town_projects; delete V.farm_stage; delete V.flats_progress; delete V.mbCE_wrote;
V.NPCName = [mkNpc("Robin"), mkNpc("Bailey")];
V.maplebirch = V.maplebirch || {};
V.maplebirch.npc = {};
global.window = {
  maplebirch: { npc: {
    data: new Map([
      ["Robin", { Data: { nam: "Robin" }, Config: {}, Patch: {} }],
      ["Bailey", { Data: { nam: "Bailey" }, Config: {}, Patch: {} }],
      ["tsukihan", { Data: { nam: "tsukihan" }, Config: {}, Patch: {} }],
      ["Zephyr", { Data: { nam: "Zephyr" }, Config: { loveInterest: true }, Patch: {} }]
    ]),
    NPCNameList: setup.NPCNameList,
    romanceConditions: { Robin: [() => true] },
    customStats: {},
    type: { loveInterestNpcs: [], importantNPCs: [], specialNPCs: [] }
  } }
};
const dBody44 = mkNode("body"), dHead44 = mkNode("head");
global.document = { body: dBody44, head: dHead44, createElement: mkNode, getElementById: () => null, addEventListener: () => {} };
/* 44.6 需要：面板状态持久化走 localStorage（mbCEUiLoad/mbCEUiSave），注入内存 mock */
const localStorage44 = {
	store: {},
	setItem: function (k, v) { this.store[k] = String(v); },
	getItem: function (k) { return this.store[k] != null ? this.store[k] : null; },
	removeItem: function (k) { delete this.store[k]; }
};
global.localStorage = localStorage44;
delete global.$;
eval(js);
const api44 = setup.mbStageCE;
const root44 = dBody44.children.filter(c => c.id === "mce-root")[0];
assert(!!root44, "44.0 ensureDom 重建面板根节点");

/* 44.1）纯函数分类：isVanillaNPC / isPerNpcRole / charCategory / perNpcDisplayName / displayNameEx / findNpcEx */
assert(api44.isVanillaNPC("robin") === true, "44.1 robin 原版判定 true, 实际 " + api44.isVanillaNPC("robin"));
assert(api44.isVanillaNPC("Black Wolf") === true, "44.1 Black Wolf 原版判定 true, 实际 " + api44.isVanillaNPC("Black Wolf"));
assert(api44.isVanillaNPC("tsukihan") === false, "44.1 tsukihan 非原版（模组角色）, 实际 " + api44.isVanillaNPC("tsukihan"));
assert(api44.isPerNpcRole("manager") === true, "44.1 manager 持久NPC判定, 实际 " + api44.isPerNpcRole("manager"));
assert(api44.isPerNpcRole("anxious_guard") === true, "44.1 anxious_guard 持久NPC判定（守卫变体）, 实际 " + api44.isPerNpcRole("anxious_guard"));
assert(api44.isPerNpcRole("saddled_steed") === true, "44.1 saddled_steed 持久NPC判定（坐骑变体）, 实际 " + api44.isPerNpcRole("saddled_steed"));
assert(api44.isPerNpcRole("guardian") === false, "44.1 guardian 前缀误判防死（不以 _guard 结尾）, 实际 " + api44.isPerNpcRole("guardian"));
assert(api44.isPerNpcRole("robin") === false, "44.1 robin 非持久NPC, 实际 " + api44.isPerNpcRole("robin"));
assert(api44.charCategory("manager") === "pernpc", "44.1 经理→持久NPC类, 实际 " + api44.charCategory("manager"));
assert(api44.charCategory("tsukihan") === "mod", "44.1 tsukihan→模组类, 实际 " + api44.charCategory("tsukihan"));
assert(api44.charCategory("robin") === "love", "44.1 罗宾→恋爱类, 实际 " + api44.charCategory("robin"));
assert(api44.charCategory("bailey") === "normal", "44.1 贝利→普通类, 实际 " + api44.charCategory("bailey"));
assert(api44.charCategory("zephyr") === "love", "44.1 泽菲尔→恋爱类（框架 loveInterest 标记）, 实际 " + api44.charCategory("zephyr"));
assert(api44.perNpcDisplayName("manager") === "经理（Helen）", "44.1 经理显示名=经理（随机名）, 实际 " + api44.perNpcDisplayName("manager"));
assert(api44.perNpcDisplayName("school_nurse") === "校医", "44.1 校医显示名兜底（无随机名）, 实际 " + api44.perNpcDisplayName("school_nurse"));
assert(api44.displayNameEx("manager") === "经理（Helen）", "44.1 displayNameEx 经理, 实际 " + api44.displayNameEx("manager"));
assert(api44.displayNameEx("robin") === "罗宾", "44.1 displayNameEx 罗宾（沿用原显示名）, 实际 " + api44.displayNameEx("robin"));
const npcM44 = api44.findNpcEx("manager");
assert(!!npcM44 && npcM44 === V.per_npc.manager, "44.1 findNpcEx 命中 per_npc.manager, 实际 " + (npcM44 ? "命中" : "未命中"));
assert(npcM44.love === 42, "44.1 findNpcEx 返回的经理对象 love=42, 实际 " + npcM44.love);

/* 44.2）listCharacters 收录已生成持久NPC（V.per_npc 实证枚举），未生成的不出现 */
var lc44 = api44.listCharacters();
assert(lc44.indexOf("manager") !== -1 && lc44.indexOf("school_nurse") !== -1 && lc44.indexOf("anxious_guard") !== -1, "44.2 listCharacters 含已生成持久NPC（manager/校医/守卫）, 实际 " + JSON.stringify(lc44.filter(function (n) { return api44.isPerNpcRole(n); })));
assert(lc44.indexOf("bishop") === -1, "44.2 未生成的持久NPC 不出现（bishop 不在 per_npc）, 实际含 " + (lc44.indexOf("bishop") !== -1 ? "bishop" : "无"));
assert(lc44.indexOf("Robin") !== -1 && lc44.indexOf("tsukihan") !== -1, "44.2 原版+模组角色照常枚举（保留注册原名 Robin/tsukihan）, 实际 " + JSON.stringify(lc44.slice(0, 8)));

/* 44.3）地点阶段写入（placeStageWrite）：宿主缺失建壳 / 钳制 / 绕过原版黑名单 / 留痕 / 回退 */
delete V.town_projects;
var ps1 = api44.placeStageWrite("town_projects.road", 4, 0, 5);
assert(ps1.ok && V.town_projects && V.town_projects.road === 4, "44.3 宿主缺失自动建壳+写 road=4, 实际 " + JSON.stringify(V.town_projects));
assert(V.mbCE_wrote && !!V.mbCE_wrote["place:town_projects.road"], "44.3 留痕 place:town_projects.road 存在");
var ps2 = api44.placeStageWrite("town_projects.road", 99, 0, 5);
assert(ps2.ok && V.town_projects.road === 5, "44.3 写 99 钳到上限 5（阶段档位语义）, 实际 " + V.town_projects.road);
var ps3 = api44.placeStageWrite("farm_stage", 7, 0, 12);
assert(ps3.ok && V.farm_stage === 7, "44.3 farm_stage 写 7（绕过原版变量黑名单直写）, 实际 " + V.farm_stage);
var ps4 = api44.placeStageWrite("farm_stage", -5, 0, 12);
assert(ps4.ok && V.farm_stage === 0, "44.3 farm_stage 负值钳到 0, 实际 " + V.farm_stage);
var ps5 = api44.placeStageWrite("flats_progress", 3, 0, 2);
assert(ps5.ok && V.flats_progress === 2, "44.3 flats_progress 写 3 钳到上限 2（阶段档位语义）, 实际 " + V.flats_progress);
var ps6 = api44.placeStageWrite("no.such.deep.path", 1, 0, 9);
assert(ps6.ok === false, "44.3 嵌套宿主缺失且非 town_projects 拒绝, ok=" + ps6.ok);
var psU = api44.placeStageUndo("town_projects.road");
assert(psU.ok && !V.mbCE_wrote["place:town_projects.road"], "44.3 回退清留痕, 实际留痕=" + (V.mbCE_wrote && V.mbCE_wrote["place:town_projects.road"]));
delete V.town_projects; delete V.farm_stage; delete V.flats_progress; delete V.mbCE_wrote;

/* 44.4）DOM：角色页四分类区块（恋爱/普通/模组/持久NPC），默认收起、点击展开 */
api44.renderCards();
let secLove44 = root44.querySelector('[data-tcat="恋爱角色"]');
let secNormal44 = root44.querySelector('[data-tcat="普通角色"]');
let secMod44 = root44.querySelector('[data-tcat="模组角色"]');
let secPer44 = root44.querySelector('[data-tcat="持久NPC"]');
assert(!!secLove44 && !!secNormal44 && !!secMod44 && !!secPer44, "44.4 角色页四个分类区块全部生成（恋爱/普通/模组/持久NPC）, 实际 love=" + !!secLove44 + " normal=" + !!secNormal44 + " mod=" + !!secMod44 + " per=" + !!secPer44);
assert(secLove44.children[0].textContent.indexOf("恋爱角色") !== -1 && secLove44.children[0].textContent.indexOf("11") !== -1, "44.4 恋爱角色标题带数量（官方10+泽菲尔=11）, 实际 " + secLove44.children[0].textContent.slice(0, 40));
assert(secPer44.children[0].textContent.indexOf("持久NPC") !== -1, "44.4 持久NPC区块标题（按类型命名）, 实际 " + secPer44.children[0].textContent.slice(0, 40));
assert(secLove44.children[1].getAttribute("data-collapsed") === "1", "44.4 恋爱角色默认收起（data-collapsed=1）");
assert(secPer44.children[1].getAttribute("data-collapsed") === "1", "44.4 持久NPC默认收起（data-collapsed=1）");
secPer44.children[0].listeners.click[0]();
assert(secPer44.children[1].getAttribute("data-collapsed") === "0", "44.4 点击标题展开持久NPC（data-collapsed=0）");
let perTxt44 = secPer44.children[1].textContent;
assert(perTxt44.indexOf("经理（Helen）") !== -1, "44.4 持久NPC卡含 经理（Helen）, 实际 " + perTxt44.slice(0, 80));
assert(perTxt44.indexOf("校医") !== -1, "44.4 持久NPC卡含 校医, 实际 " + perTxt44.slice(0, 80));
assert(perTxt44.indexOf("42") !== -1, "44.4 经理卡爱意显示 42（per_npc.manager.love）, 实际 " + perTxt44.slice(0, 80));
secMod44.children[0].listeners.click[0]();
assert(secMod44.children[1].textContent.indexOf("月羽") !== -1, "44.4 模组角色卡含 月羽（tsukihan）, 实际 " + secMod44.children[1].textContent.slice(0, 60));
secLove44.children[0].listeners.click[0]();
assert(secLove44.children[1].textContent.indexOf("罗宾") !== -1, "44.4 恋爱角色卡含 罗宾, 实际 " + secLove44.children[1].textContent.slice(0, 60));

/* 44.5）DOM：场景页新增"地点"子界面（场景直达/地点 双层页签；市政改造+农场等阶段任务行；拉满直写） */
api44.renderPlaces();
let paneP44 = root44.querySelector('[data-pane="places"]');
assert(paneP44.textContent.indexOf("场景直达") !== -1 && paneP44.textContent.indexOf("地点") !== -1, "44.5 场景页含子页签 场景直达/地点, 实际 " + paneP44.textContent.slice(0, 80));
let tabStage44 = paneP44.querySelector('[data-place="stage"]');
assert(!!tabStage44, "44.5 地点页签按钮存在");
tabStage44.listeners.click[0]();
let txtP44 = paneP44.textContent;
assert(txtP44.indexOf("市政改造") !== -1 && txtP44.indexOf("农场") !== -1, "44.5 地点子界面含市政改造+农场分区, 实际 " + txtP44.slice(0, 120));
assert(txtP44.indexOf("道路") !== -1 && txtP44.indexOf("潜水") !== -1 && txtP44.indexOf("拉满") !== -1, "44.5 地点含 道路/潜水/拉满, 实际 " + txtP44.slice(0, 160));
let roadRow44 = paneP44.querySelector('[data-stagekey="road"]');
assert(!!roadRow44, "44.5 道路行存在（data-stagekey=road）");
let fillRoad44 = roadRow44.querySelector('[data-op="max"]');
assert(!!fillRoad44, "44.5 道路行拉满按钮存在（data-op=max）");
delete V.town_projects;
fillRoad44.listeners.click[0]();
assert(V.town_projects && V.town_projects.road === 5, "44.5 道路拉满 → town_projects.road=5, 实际 " + (V.town_projects && V.town_projects.road));
let farmRow44 = paneP44.querySelector('[data-stagekey="farm_stage"]');
assert(!!farmRow44 && farmRow44.querySelector('[data-op="max"]'), "44.5 农场阶段行+拉满按钮存在");
/* 页签状态持久化：切回场景直达后重渲染仍记住地点页签 */
let tabDirect44 = paneP44.querySelector('[data-place="direct"]');
assert(!!tabDirect44 && paneP44.querySelector('[data-place="stage"]').className.indexOf("mce-active") !== -1, "44.5 地点页签为当前激活态");
delete V.town_projects; delete V.mbCE_wrote; delete V.per_npc; delete V.mickeyName;

/* 44.6）自查优化补盲：地点 +1/−1 步进、undo 删字段回退、placesTab 持久化恢复、变体守卫名、空档不枚举 */
/* 步进：flats_progress 缺失 → +1 建宿主并写 1，再 +1 → 2（钳到 max=2），−1 → 1 */
api44.renderPlaces();
paneP44 = root44.querySelector('[data-pane="places"]');
paneP44.querySelector('[data-place="stage"]').listeners.click[0]();
let flatsRow44 = paneP44.querySelector('[data-stagekey="flats"]');
assert(!!flatsRow44, "44.6 公寓区进度行存在");
let incFlats44 = flatsRow44.querySelector('[data-op="inc"]');
let decFlats44 = flatsRow44.querySelector('[data-op="dec"]');
delete V.flats_progress;
incFlats44.listeners.click[0]();
assert(V.flats_progress === 1, "44.6 公寓区 +1 → 1, 实际 " + V.flats_progress);
paneP44.querySelector('[data-stagekey="flats"]').querySelector('[data-op="inc"]').listeners.click[0]();
assert(V.flats_progress === 2, "44.6 公寓区再 +1 → 2（钳到 max=2）, 实际 " + V.flats_progress);
paneP44.querySelector('[data-stagekey="flats"]').querySelector('[data-op="dec"]').listeners.click[0]();
assert(V.flats_progress === 1, "44.6 公寓区 −1 → 1, 实际 " + V.flats_progress);
/* undo：town_projects 缺失建壳写入 road=3 → 回退删字段（before 为 undefined 时 delete） */
delete V.town_projects;
let roadRowB44 = paneP44.querySelector('[data-stagekey="road"]');
roadRowB44.querySelector('[data-op="inc"]').listeners.click[0]();
assert(V.town_projects && V.town_projects.road === 1, "44.6 道路 +1（宿主缺失自动建壳）→ 1, 实际 " + (V.town_projects && V.town_projects.road));
let undoRoad44 = paneP44.querySelector('[data-stagekey="road"]').querySelector('[data-op="undo"]');
assert(!!undoRoad44, "44.6 有留痕时显示回退按钮");
undoRoad44.listeners.click[0]();
assert(("road" in (V.town_projects || {})) === false, "44.6 回退删字段（before=undefined → delete）, road 存在=" + ("road" in (V.town_projects || {})));
delete V.town_projects; delete V.flats_progress;
/* placesTab 持久化恢复：模拟 localStorage 存 stage → mbCEUiLoad 恢复 → renderPlaces 仍激活地点页签 */
localStorage44.setItem("mbCE_ui_state_v1", JSON.stringify({ placesTab: "stage" }));
api44.mbCEUiLoad();
delete V.town_projects;
api44.renderPlaces();
paneP44 = root44.querySelector('[data-pane="places"]');
assert(paneP44.querySelector('[data-place="stage"]').className.indexOf("mce-active") !== -1 && paneP44.textContent.indexOf("市政改造") !== -1, "44.6 placesTab 持久化恢复（localStorage → 地点页签激活且渲染市政改造）");
localStorage44.setItem("mbCE_ui_state_v1", JSON.stringify({ placesTab: "direct" }));
api44.mbCEUiLoad();
/* 变体守卫/坐骑键显示族中文名（不再裸显英文键名） */
assert(api44.perNpcDisplayName("saddled_steed") === "坐骑", "44.6 变体坐骑键显示族中文名, 实际 " + api44.perNpcDisplayName("saddled_steed"));
assert(api44.perNpcDisplayName("stray_guard") === "守卫", "44.6 变体守卫键显示族中文名, 实际 " + api44.perNpcDisplayName("stray_guard"));
/* 空存档（无 per_npc）不枚举持久 NPC：listCharacters 不含 manager */
V.per_npc = undefined;
let namesNoPer44 = api44.listCharacters();
assert(namesNoPer44.indexOf("manager") === -1, "44.6 无 per_npc 时角色池不含持久NPC键, 实际 " + namesNoPer44.slice(0, 40));
V.per_npc = { manager: { name: "Helen", love: 42 } };
/* 切回地点子界面（44.6 末尾 mbCEUiLoad 已恢复 placesTab=direct，需先点回 stage 再验证留痕语义） */
paneP44.querySelector('[data-place="stage"]').listeners.click[0]();
paneP44 = root44.querySelector('[data-pane="places"]');
/* 留痕语义：建壳字段两次写入后再回退，仍还原首次写入前状态（删除字段，而非留在上次值） */
delete V.town_projects;
let roadW44 = paneP44.querySelector('[data-stagekey="road"]');
roadW44.querySelector('[data-op="inc"]').listeners.click[0]();
roadW44 = paneP44.querySelector('[data-stagekey="road"]');
roadW44.querySelector('[data-op="inc"]').listeners.click[0]();
assert(V.town_projects && V.town_projects.road === 2, "44.7 两次 +1 → road=2, 实际 " + (V.town_projects && V.town_projects.road));
roadW44 = paneP44.querySelector('[data-stagekey="road"]');
roadW44.querySelector('[data-op="undo"]').listeners.click[0]();
assert(("road" in (V.town_projects || {})) === false, "44.7 两次写入后回退仍删字段（before 保留首次 undefined）, road 存在=" + ("road" in (V.town_projects || {})));
delete V.town_projects; delete V.mbCE_wrote;
/* 回退到非 undefined 原值：既有 town_projects.road=3 → 写入 5 → 回退还原 3 */
V.town_projects = { road: 3 };
let roadE44 = paneP44.querySelector('[data-stagekey="road"]');
roadE44.querySelector('[data-op="max"]').listeners.click[0]();
assert(V.town_projects.road === 5, "44.7 既有 road=3 拉满 → 5, 实际 " + V.town_projects.road);
paneP44.querySelector('[data-stagekey="road"]').querySelector('[data-op="undo"]').listeners.click[0]();
assert(V.town_projects.road === 3, "44.7 回退还原原值 3（非删除）, 实际 " + V.town_projects.road);
delete V.town_projects; delete V.mbCE_wrote;
/* 44.8）cheatWriteValue 留痕语义（与地点通道同源修复）：叶子缺失两次写入后回退仍删除字段；既有值回退还原首次前值 */
delete V.mbCE_wrote;
V.modtest = {};
let cw1 = api44.cheatWriteValue("t", "k1", "value_set", "modtest.myval", "5", "number", 0, 100);
assert(cw1.ok && V.modtest.myval === 5, "44.8 首次写入 modtest.myval=5, 实际 " + (V.modtest && V.modtest.myval));
let cw2 = api44.cheatWriteValue("t", "k1", "value_set", "modtest.myval", "7", "number", 0, 100);
assert(cw2.ok && V.modtest.myval === 7, "44.8 二次写入 modtest.myval=7, 实际 " + V.modtest.myval);
let cw3 = api44.undoCheatModValue("t", "k1");
assert(cw3.ok && ("myval" in V.modtest) === false, "44.8 两次写入后回退仍删除字段（before 保留首次 undefined）, 存在=" + ("myval" in V.modtest));
V.modtest.exist = 3;
api44.cheatWriteValue("t", "k2", "value_set", "modtest.exist", "8", "number", 0, 100);
api44.cheatWriteValue("t", "k2", "value_set", "modtest.exist", "9", "number", 0, 100);
assert(V.modtest.exist === 9, "44.8 既有值两次写入 exist=9, 实际 " + V.modtest.exist);
api44.undoCheatModValue("t", "k2");
assert(V.modtest.exist === 3, "44.8 既有值回退还原首次前值 3, 实际 " + V.modtest.exist);
delete V.modtest; delete V.mbCE_wrote;

/* 44.9 v1.9.15 数值固定（Lock Values）：数据层 + tick 强制写回（防渡鸦/天使/转化值被游戏机制改动） */
delete V.mbCE_lock;
let rLock49 = api44.mbCELockSet("maplebirch.transformation.raven.build", 0);
assert(rLock49 && rLock49.ok, "44.9 锁定渡鸦转化 build=0, 实际 " + (rLock49 && rLock49.message));
assert(api44.mbCELockHas("maplebirch.transformation.raven.build"), "44.9 mbCELockHas 命中已锁定路径");
assert(!api44.mbCELockHas("angel"), "44.9 未锁定路径 mbCELockHas 不误命中");
V.maplebirch.transformation = V.maplebirch.transformation || {};
V.maplebirch.transformation.raven = V.maplebirch.transformation.raven || {};
V.maplebirch.transformation.raven.build = 42;
api44.mbCELockTick();
assert(V.maplebirch.transformation.raven.build === 0, "44.9 改值 42 → tick 强制写回 0, 实际 " + V.maplebirch.transformation.raven.build);
let rUp49 = api44.mbCELockSet("maplebirch.transformation.raven.build", 5);
assert(rUp49 && rUp49.ok && V.mbCE_lock.length === 1, "44.9 更新目标 5 不重复追加（1 条）, 实际 " + V.mbCE_lock.length);
assert(V.maplebirch.transformation.raven.build === 5, "44.9 更新目标后立即写回 5（不等 tick）, 实际 " + V.maplebirch.transformation.raven.build);
api44.mbCELockTick();
assert(V.maplebirch.transformation.raven.build === 5, "44.9 更新目标后 tick 保持 5, 实际 " + V.maplebirch.transformation.raven.build);
let rRm49 = api44.mbCELockRemove("maplebirch.transformation.raven.build");
assert(rRm49 && rRm49.ok && !api44.mbCELockHas("maplebirch.transformation.raven.build"), "44.9 取消锁定成功");
V.maplebirch.transformation.raven.build = 9;
api44.mbCELockTick();
assert(V.maplebirch.transformation.raven.build === 9, "44.9 取消后 tick 不再写回（保持 9）, 实际 " + V.maplebirch.transformation.raven.build);
let rBad49 = api44.mbCELockSet("purity", "abc");
assert(rBad49 && !rBad49.ok && !api44.mbCELockHas("purity"), "44.9 非数值目标拒绝且不写入");
let rEmpty49 = api44.mbCELockSet("", 1);
assert(rEmpty49 && !rEmpty49.ok, "44.9 空路径拒绝");
/* 自查边界：锁定不存在的键 → tick 不凭空创建字段；空段路径拒绝 */
delete V.maplebirch.transformation;
api44.mbCELockSet("maplebirch.transformation.raven.build", 0);
api44.mbCELockTick();
assert(!V.maplebirch.transformation || !V.maplebirch.transformation.raven,
  "44.9 锁定不存在的键 → tick 不凭空创建（raven 仍不存在）");
api44.mbCELockRemove("maplebirch.transformation.raven.build");
let rDot49 = api44.mbCELockSet("a..b", 1);
assert(rDot49 && !rDot49.ok, "44.9 空段路径（a..b）拒绝");
delete V.mbCE_lock; delete V.maplebirch.transformation;
/* 44.10 v2.0.1 收敛：锁定文案中文化 + 三处新直达目标的状态兜底 */
assert(api44.mbCELockLabel("skulduggery") === "诡术", "44.10 锁定文案中文映射 skulduggery→诡术，实际 " + api44.mbCELockLabel("skulduggery"));
assert(api44.mbCELockLabel("prof.baton") === "短棍", "44.10 prof.baton→短棍，实际 " + api44.mbCELockLabel("prof.baton"));
assert(api44.mbCELockLabel("no_such_key_xyz") === "no_such_key_xyz", "44.10 未映射键回落原 path（不显示空串）");
let rMsg410 = api44.mbCELockSet("skulduggery", 500);
assert(rMsg410.ok && rMsg410.message.indexOf("skulduggery") === -1 && rMsg410.message.indexOf("诡术") !== -1,
  "44.10 锁定成功文案用中文名（不含英文裸 path），实际 " + rMsg410.message);
assert(api44.mbCELockRemove("skulduggery").message.indexOf("skulduggery") === -1, "44.10 取消锁定文案也用中文名");
/* 直达兜底：$prison 缺失才调 <<prison_init>>（原版 widget 自带 <<if !$prison>> 守卫；末尾无条件 set morning，故已有进度绝不调） */
const wikCalls410 = [];
const winOrig410 = global.window;
global.window = { SugarCube: { Wikifier: function (elm, txt) { wikCalls410.push(String(txt)); } } };
delete V.prison;
api44.ensureSceneStateFor("Prison Cell");
assert(wikCalls410.length === 1 && wikCalls410[0].indexOf("prison_init") !== -1,
  "44.10 $prison 缺失 → 调 prison_init，实际 " + JSON.stringify(wikCalls410));
V.prison = { guards: 50 };
api44.ensureSceneStateFor("Prison Walkway");
assert(wikCalls410.length === 1, "44.10 已有 $prison → 不再调 init（避免 morning 被重置），实际 " + wikCalls410.length);
api44.ensureSceneStateFor("Police Cell");
assert(wikCalls410.length === 1, "44.10 非 Prison 前缀（警局 Police Cell）不触发监狱 init");
delete V.prison;
api44.ensureSceneStateFor("PrisonScarredInmate");
assert(wikCalls410.length === 2, "44.10 无空格段名 PrisonScarredInmate 也命中监狱兜底（原 /^Prison\\b/ 会漏），实际 " + wikCalls410.length);
V.prison = { guards: 50 };
/* 农场：farm_stage 未推进（0）也建壳；已有 $farm 只补不覆盖 */
delete V.farm; delete V.farm_stage;
api44.ensureSceneStateFor("The Farm");
assert(V.farm && typeof V.farm === "object" && V.farm.beasts && V.farm.beasts.pigs === 0,
  "44.10 The Farm 直达 → $farm 兜底建壳（farm_stage=0 也建）");
V.farm.clearing = 42;
api44.ensureSceneStateFor("Farmland Field");
assert(V.farm.clearing === 42, "44.10 已有 $farm → 不覆盖进度（clearing 保持 42），实际 " + V.farm.clearing);
delete V.farm; V.farm_stage = 0;
api44.ensureSceneStateFor("Brothel Basement");
assert(!V.farm, "44.10 非农场段（妓院）不建 $farm");
delete V.farm; delete V.farm_stage; delete V.prison;
global.window = winOrig410;


/* 45.x）v1.9.1（DoL-Game-UI 冲突排查）：Mod作弊 子页四分组默认收起 + 懒渲染——
   用户实测「滑动卡住截断 / 展开过多卡住闪退」：子页一次全量建数百行 + DGU 每帧 rAF 扫描抢主线程。
   修复 = 组头常驻、组体默认收起、行闭包进 pending 点击展开才建（学 06-traits 九巡）；展开态持久化。 */
const pane45 = root44.querySelector('[data-pane="mods"]');
/* 44 段环境无 window.maplebirch.get（枯木逢春探测不命中）→ 用注册制测试模组覆盖四分组 */
setup.mbCE_modCheats = [{
  modId: "mockmod45", modName: "懒渲染测试模组",
  tasks: [{ key: "t1", name: "测试任务" }],
  stages: [{ key: "s1", name: "阶段S", varPath: "mock45_stage", levels: [0, 1, 2], labels: ["零", "一", "二"] }],
  abilities: [{ key: "a1", name: "能力A", varPath: "mock45_ability" }],
  scenes: [{ key: "sc1", name: "剧情X" }],
  values: [{ key: "v1", name: "数值V", varPath: "mock45_value", min: 0, max: 100 },
           { key: "v2", name: "列表L", type: "list", varPath: "mock45_list", options: ["a", "b"] }]
}];
V.mock45_stage = 0; V.mock45_ability = false; V.mock45_value = 10;
api44.renderModCheatDetail("mockmod45");
/* 45.1 默认渲染：四组头存在 + 组体收起 + 不建行 */
const hTasks45 = pane45.querySelector('[data-mce-head="tasks"]'), hStages45 = pane45.querySelector('[data-mce-head="stages"]'),
	hScenes45 = pane45.querySelector('[data-mce-head="scenes"]'), hValues45 = pane45.querySelector('[data-mce-head="values"]');
assert(!!hTasks45 && !!hStages45 && !!hScenes45 && !!hValues45, "45.1 子页四分组组头齐全（任务/阶段能力/剧情/数值）");
const gTasks45 = pane45.querySelector('[data-gkey="tasks"]'), gStages45 = pane45.querySelector('[data-gkey="stages"]'),
	gScenes45 = pane45.querySelector('[data-gkey="scenes"]'), gValues45 = pane45.querySelector('[data-gkey="values"]');
assert(!!gTasks45 && !!gStages45 && !!gScenes45 && !!gValues45, "45.1 四分组容器存在（data-gkey）");
assert(gValues45.children[1].getAttribute("data-collapsed") === "1", "45.1 数值组默认收起（data-collapsed=1）");
assert(gValues45.children[1].children.length === 0, "45.1 收起组不建行（懒渲染）, 行数 " + gValues45.children[1].children.length);
/* 45.2 组头文本含计数（values 组 2 项：数值V+列表L） */
assert(gValues45.children[0].textContent.indexOf("（2）") !== -1, "45.2 组头计数含 （2）, 实际 " + gValues45.children[0].textContent);
/* 45.3 点击组头展开 → 补建行（数值V 1 行 + 列表L 2 选项 = 3 行） */
gValues45.children[0].listeners.click[0]();
assert(gValues45.children[1].getAttribute("data-collapsed") === "0", "45.3 点击展开 → data-collapsed=0");
assert(gValues45.children[1].children.length === 3, "45.3 展开后补建行（数值V+列表L 3 行）, 行数 " + gValues45.children[1].children.length);
/* 45.4 展开后行内控件可用（数值行有输入框 + 应用修改按钮） */
const valRow45 = gValues45.children[1].children[0];
assert(!!valRow45 && valRow45.getAttribute("data-mce-key") === "values:v1", "45.4 行带 data-mce-key（局部刷新寻址）, key=" + (valRow45 ? valRow45.getAttribute("data-mce-key") : "null"));
assert(!!valRow45.querySelector('[data-mce-key]') === false, "45.4 行内不含嵌套 data-mce-key（无重复寻址）");
/* 45.5 全部展开工具行 → 其余组也补建行 */
const openAll45 = pane45.querySelector('[data-mce-tool="mods-open"]');
assert(!!openAll45, "45.5 折叠工具行「全部展开」存在");
openAll45.listeners.click[0]();
assert(gTasks45.children[1].getAttribute("data-collapsed") === "0" && gTasks45.children[1].children.length === 1, "45.5 全部展开后任务组补建行（1 行）, 行数 " + gTasks45.children[1].children.length);
assert(gStages45.children[1].children.length === 2 && gScenes45.children[1].children.length === 1, "45.5 阶段/剧情组均补建行（2/1）, 实际 " + gStages45.children[1].children.length + "/" + gScenes45.children[1].children.length);
/* 45.6 展开态持久化：重建子页后恢复展开并补建行 */
api44.renderModCheatDetail("mockmod45");
const gValues45b = pane45.querySelector('[data-gkey="values"]');
assert(gValues45b.children[1].getAttribute("data-collapsed") === "0" && gValues45b.children[1].children.length === 3, "45.6 重建后按持久化恢复展开并补建行, 行数 " + gValues45b.children[1].children.length);
/* 45.7 收起工具行 → 组体收起（行保留，等下次展开时 pending 已空不再重复建） */
const closeAll45 = pane45.querySelector('[data-mce-tool="mods-close"]');
closeAll45.listeners.click[0]();
assert(gValues45b.children[1].getAttribute("data-collapsed") === "1", "45.7 全部收起 → data-collapsed=1");
const rowsBefore45 = gValues45b.children[1].children.length;
gValues45b.children[0].listeners.click[0]();
assert(gValues45b.children[1].children.length === rowsBefore45, "45.7 收起→展开不重复建行（pending 已清空）, 行数 " + gValues45b.children[1].children.length);
delete V.mbCE_wrote; delete V.mock45_stage; delete V.mock45_ability; delete V.mock45_value;
/* 45.8 contain 样式注入（.mce-grp 限制组内重排范围，降低 DGU 每帧 rAF 扫描下的主线程压力） */
const css45 = dHead44.children.filter(c => c.id === "mce-style")[0].textContent;
assert(css45.indexOf("contain:content") !== -1, "45.8 .mce-grp contain:content 已注入");
assert(css45.indexOf("overscroll-behavior:contain") !== -1, "45.8 .mce-body overscroll-behavior:contain 已注入");

/* ============ 47）Cattery 猫舍 v1.1.9 适配（顶层标量 + catArr 数组联动 + 数字语义） ============
   状态模型：无根对象，全部为顶层标量（$rentingahouse/$pchaveCat/$pcfood_cake/$catArr 等）；
   判定均为 is 1 / gte 1 严格比较，禁 boolean、全走数字通道；养猫写 1 联动补 catArr + 品种。 */
V.cattery_time = 0; V.pcfood_cake = 0; V.rentingahouse = 0; V.pchaveCat = 0;
var ct42 = api.getCheatMods().filter(function (x) { return x.modId === "cattery"; })[0];
assert(ct42 && ct42.stages.filter(function (s) { return s.varPath === "rentingahouse"; }).length === 1, "47.1 适配器探测命中（V 顶层标量）");
assert(ct42.values.filter(function (v) { return v.varPath === "catArr.0.love"; })[0].max === 40, "47.1 猫好感 0-40 钳制上限");
/* 47.2 出租屋阶段写入 */
var rr42 = api.setCheatStage("cattery", "cat_rent", 1);
assert(rr42.ok && V.rentingahouse === 1, "47.2 租屋阶段写入 1");
/* 47.3 养猫联动：写 1 自动补 catArr + 品种 */
var rc42 = api.setCheatStage("cattery", "cat_owncat", 1);
assert(rc42.ok && V.pchaveCat === 1, "47.3 养猫阶段写入 1");
assert(Array.isArray(V.catArr) && V.catArr[0] && V.catArr[0].name === "咪咪" && V.catArr[0].love === 0, "47.3 联动补猫数据（catArr）");
assert(V.firstCat_variety === "橘猫", "47.3 联动补品种（橘猫）");
/* 47.3b 幂等：已有猫数据时不覆盖（v1.9.10 自查修复，防重置玩家已养猫） */
V.catArr = [{ name: "玩家自己养的猫", love: 21, play: 15 }];
var ri42 = api.setCheatStage("cattery", "cat_owncat", 1);
assert(ri42.ok && V.catArr[0].name === "玩家自己养的猫" && V.catArr[0].love === 21 && V.catArr[0].play === 15, "47.3b 已有猫数据不被覆盖（ifMissing 幂等）");
assert(V.firstCat_variety === "橘猫", "47.3b 品种联动正常（覆盖无害）");
V.catArr = [{ name: "咪咪", love: 0, play: 0 }]; /* 还原供 47.4 继续 */
/* 47.4 写 0 不触发联动（sync if min:1），联动键保留 */
api.setCheatStage("cattery", "cat_owncat", 0);
assert(V.pchaveCat === 0 && Array.isArray(V.catArr) && V.catArr[0].name === "咪咪", "47.4 写 0 只降主键，联动键保留");
/* 47.5 恢复养猫 + 猫好感/玩力写入与钳制 */
api.setCheatStage("cattery", "cat_owncat", 1);
api.applyCheatModValue("cattery", "cat_love", 40);
assert(V.catArr[0].love === 40, "47.5 猫好感写入 40");
api.applyCheatModValue("cattery", "cat_love", 50);
assert(V.catArr[0].love === 50, "47.5 猫好感上限不钳制（写 50 原样）");
/* 47.5b 好感联动：写 ≥40 自动补 firstCat_loveMax=1（模组特质「金牌饲养员」触发条件），写低值不撤销 */
assert(V.firstCat_loveMax === 1, "47.5b 写 love=40 自动补 firstCat_loveMax=1（金牌饲养员触发条件成立），实际 " + V.firstCat_loveMax);
api.applyCheatModValue("cattery", "cat_love", 20);
assert(V.firstCat_loveMax === 1, "47.5b 写低值不撤销 loveMax（模组仅电脑降级操作归 0），实际 " + V.firstCat_loveMax);
api.applyCheatModValue("cattery", "cat_love", 40);
api.applyCheatModValue("cattery", "cat_play", 33);
assert(V.catArr[0].play === 33, "47.5 猫玩力写入 33");
/* 47.6 飞行解锁 + 书房藏书（数字语义，is 1 / gte 1 兼容） */
api.setCheatStage("cattery", "cat_fly", 1);
assert(V.birdFly === 1 && typeof V.birdFly === "number", "47.6 飞行解锁写入数字 1");
api.setCheatStage("cattery", "cat_book1", 1);
assert(V.pcHouseBook1 === 1 && typeof V.pcHouseBook1 === "number", "47.6 书房藏书 1 写入数字 1");
/* 47.7 食材/菜品数值 + 钳制 */
api.applyCheatModValue("cattery", "cat_food_milk", 12);
assert(V.pc_milk === 12, "47.7 牛奶写入 12");
api.applyCheatModValue("cattery", "cat_cook_gbjd", 5);
assert(V.cookok_gbjd === 5, "47.7 宫保鸡丁次数写入 5");
api.applyCheatModValue("cattery", "cat_cook_gbjd", 200);
assert(V.cookok_gbjd === 200, "47.7 菜品上限不钳制（写 200 原样）");
/* 47.8 猫数据缺失 → 宿主拒绝（未领养时 catArr 不存在，防崩） */
delete V.catArr; delete V.firstCat_variety;
var rn42 = api.applyCheatModValue("cattery", "cat_love", 10);
assert(!rn42.ok, "47.8 catArr 缺失时拒绝写入（防崩）");
/* 47.9 回退（最后一次写入 47.5 写 1 的 before=0） */
var bu42 = api.undoCheatModValue("cattery", "stage_set:cat_owncat");
assert(bu42.ok && V.pchaveCat === 0, "47.9 养猫阶段回退到 0");
/* 47.10 卸载后探测自动消失 */
delete V.cattery_time; delete V.pcfood_cake; delete V.rentingahouse; delete V.pchaveCat; delete V.birdFly;
delete V.pcHouseBook1; delete V.pc_milk; delete V.cookok_gbjd; delete V.catArr; delete V.firstCat_variety; delete V.firstCat_loveMax; delete V.mbCE_wrote;
assert(api.getCheatMods().filter(function (x) { return x.modId === "cattery"; }).length === 0, "47.10 卸载后 Cattery 适配器自动消失");

/* ============ 47.11）Cattery 特质直接获取（用户实测请求：模组作弊区直接给特质） ============
   特质注册实证：cat119/unzip/game/tj/traits.txt —— 金牌饲养员 has $pchaveCat>=1 and $firstCat_loveMax gte 1；
   爱·时·机 has $pcHouseBook1_speciality gte 1；绝爱 has $pcHouseBook2_speciality gte 1。
   判定均 gte 1 严格比较 → 能力走 numeric 数字通道（勾选 1 / 取消 0），禁 boolean。 */
V.cattery_time = 0; /* 重新命中探测 */
var ct44 = api.getCheatMods().filter(function (x) { return x.modId === "cattery"; })[0];
assert(ct44 && ct44.abilities.filter(function (a) { return a.key === "cat_trait_gold"; }).length === 1, "47.11 特质·金牌饲养员能力已声明");
assert(ct44.abilities.filter(function (a) { return a.numeric === true; }).length === 3, "47.11 三个特质均为数字通道（模组 gte 1 禁 boolean）");
var tg11 = api.toggleCheatAbility("cattery", "cat_trait_gold", true);
assert(tg11.ok && V.firstCat_loveMax === 1 && typeof V.firstCat_loveMax === "number" && V.pchaveCat === 1, "47.11 勾选金牌饲养员 → loveMax=1（数字）+ 补领养（特质条件成立），实际 " + V.firstCat_loveMax + "/" + V.pchaveCat);
var tb11 = api.toggleCheatAbility("cattery", "cat_trait_book1", true);
assert(tb11.ok && V.pcHouseBook1_speciality === 1 && typeof V.pcHouseBook1_speciality === "number", "47.11 勾选爱·时·机 → 藏书1特质写数字 1，实际 " + V.pcHouseBook1_speciality);
api.toggleCheatAbility("cattery", "cat_trait_book2", true);
assert(V.pcHouseBook2_speciality === 1, "47.11 勾选绝爱 → 藏书2特质写 1");
api.toggleCheatAbility("cattery", "cat_trait_book1", false);
assert(V.pcHouseBook1_speciality === 0, "47.11 取消爱·时·机 → 写 0（特质消失）");
var tu11 = api.undoCheatModValue("cattery", "ability_set:cat_trait_gold");
assert(tu11.ok && V.firstCat_loveMax == null, "47.11 金牌饲养员回退 → loveMax 还原首次写入前（未定义→删除）");
delete V.firstCat_loveMax; delete V.pcHouseBook1_speciality; delete V.pcHouseBook2_speciality; delete V.mbCE_wrote;

/* ============ 47.12）遇欲（Needmeet）角色卡：DolOpt 经 maplebirch.npc.add 注册的框架恋爱角色 ============
   源码实证：opt1121/Source/javascript/opt-main-onframe.js —— { loveInterest: () => V.needmeet_romance >= 80,
   romance: [() => V.needmeet_romance >= 80], CN: "遇欲" }。恋爱一键完成经 parseCondition 闭包键解析写 80。 */
var nmData = { Data: { nam: "Needmeet" }, Config: { romance: [() => rv.variables.needmeet_romance >= 80], loveInterest: function () { return rv.variables.needmeet_romance >= 80; } }, Patch: {} };
var nmMap44 = null;
try {
  /* 本段 api 属首次 eval 模块：其 MB.npc.data = 顶层 npcData Map（本文件 90 行构建），直接注册；
     44 区重建的 window 数据源同步注册（api44 侧），两处都覆盖 */
  if (npcData instanceof Map) { npcData.set("Needmeet", nmData); }
  nmMap44 = global.window && global.window.maplebirch && global.window.maplebirch.npc && global.window.maplebirch.npc.data;
  if (nmMap44 instanceof Map) { nmMap44.set("Needmeet", nmData); }
} catch (e) {}
assert(api.listCharacters().indexOf("Needmeet") !== -1, "47.12 角色池枚举含 遇欲（Needmeet）");
assert(api.charCategory("Needmeet") === "mod", "47.12 遇欲归模组角色区（框架注册模组角色）");
assert(api.isLoveCandidate("Needmeet") === true, "47.12 遇欲为恋爱候选（框架 Config.romance 命中 → 模组区「模组·恋爱角色」子组显示角色卡），实际 " + api.isLoveCandidate("Needmeet"));
assert(api.displayName("Needmeet") === "遇欲", "47.12 遇欲显示名 = 官方中文（DolOpt CN 映射），实际 " + api.displayName("Needmeet"));
V.needmeet_romance = 0;
var nmSt = api.getRomanceStages("Needmeet");
assert(nmSt.length >= 1 && /needmeet_romance/.test(nmSt[0].text), "47.12 遇欲恋爱条件解析（needmeet_romance >= 80）");
var nmFix = api.completeRomanceStage("Needmeet", nmSt[0]);
assert(nmFix.ok && V.needmeet_romance === 80, "47.12 遇欲恋爱一键完成 → needmeet_romance=80（闭包键自动写满足值），实际 " + V.needmeet_romance);
/* 还原框架 mock，避免影响后续段落 */
try { if (npcData instanceof Map) { npcData.delete("Needmeet"); } } catch (e) {}
try { if (nmMap44 instanceof Map) { nmMap44.delete("Needmeet"); } } catch (e) {}
delete V.needmeet_romance; delete V.mbCE_wrote;


/* ============ 46）存档卫生：新游戏不继承旧存档的 CE 写入 ============
   背景：用户实测疑虑"之前用模组改过数值，开新游戏会不会继承"。
   结论机制：CE 无 localStorage 存档值、无 StoryInit 注入、无模块级 V 缓存，
   写入全部经函数内 getV() 命中当前存档对象；新游戏 = SugarCube 重建 State.variables。 */
/* 46.0 构造"被 CE 重度改过的旧存档"：作弊数值 + 庇护标记 + 留痕 + 回放队列 */
const oldSaveCE = V;
oldSaveCE.money = 999999;
oldSaveCE.avery_fate = "saved";
oldSaveCE.mceAveryShelter = true;
oldSaveCE.mbCE_wrote = { "set:money:999999": { type: "set", path: "money", value: 999999, t: 1 } };
oldSaveCE.mbCE_queue = [{ key: "OLD", name: "旧固定", startPassage: "OldStart", passages: [], used: true }];
const oldKeys46 = Object.keys(oldSaveCE);
assert(oldKeys46.indexOf("mceAveryShelter") !== -1 && oldKeys46.indexOf("mbCE_wrote") !== -1 && oldKeys46.indexOf("mbCE_queue") !== -1,
	"46.0 前置：旧存档确有 CE 写入（作弊数值/庇护标记/留痕/回放队列）");
/* 46.1 模拟新游戏：SugarCube 重建 State.variables（V 换全新对象，仅含原版 StoryInit 结构壳）。
   判定口径：characters/player/daily/weekly 属原版 StoryInit 本就会建的壳键，不算继承；
   真正的污染是「CE 专属键 + 作弊数值」进入新档。 */
global.V = { characters: { npc: {} }, player: {}, daily: {}, weekly: {} };
global.State.variables = global.V;
global.rv.variables = global.V;
const shellKeys46 = ["characters", "player", "daily", "weekly"];
const leaked46 = oldKeys46.filter(k => k in global.V && shellKeys46.indexOf(k) === -1);
assert(leaked46.length === 0, "46.1 新游戏 V 重建后 CE 专属键/作弊键 0 条继承, 实际 " + JSON.stringify(leaked46));
assert(global.V.money !== 999999 && global.V.avery_fate !== "saved" && global.V.mceAveryShelter === undefined,
	"46.1 作弊数值未污染新档（money≠999999 / avery_fate≠saved / 无庇护标记）");
/* 46.2 新档加载 mod（重 eval 产物）：只建原版默认壳（avery_mansion/avery_tower/daily），不写 CE 自产键 */
eval(js);
const newKeys46 = Object.keys(global.V);
const newCEKeys46 = newKeys46.filter(k => /^mbCE_/i.test(k) || /^mce/i.test(k));
assert(newCEKeys46.length === 0, "46.2 新档加载后 V 无 CE 自产键（含留痕/标记/队列）, 实际 " + JSON.stringify(newCEKeys46));
assert(global.V.avery_mansion !== undefined && global.V.avery_tower !== undefined && global.V.daily !== undefined,
	"46.2 新档加载建原版结构默认壳（avery_mansion/avery_tower/daily 存在）, 实际 " + newKeys46.join("/"));


/* ============ 48）世界腐化数值调整（v1.9.12 全局页）：直写原版键 + 上限不钳制 + 下限保留 + 留痕回退 ============
   背景：用户要求在全局页加入原版「世界硬腐化 world_corruption_hard / 世界软腐化 world_corruption_soft」数值调整，
   明确"上限是多少就是多少，别钳制"（数值直填不钳上限）；下限按原版宏语义保留（hard ≥ -30，soft ≥ 0）。
   实现通道：复用地点页 placeStageWrite/placeStageUndo（绕过原版根键黑名单直写顶层键，留痕 place: 前缀可回退）。 */
global.V = { characters: { npc: {} }, player: {}, daily: {}, weekly: {} };
global.State.variables = global.V;
global.rv.variables = global.V;
V.world_corruption_hard = 2;  /* 原版新档初始 2 */
V.world_corruption_soft = 0;  /* 原版新档初始 0 */
const api48 = setup.mbStageCE;
assert(!!api48 && typeof api48.placeStageWrite === "function", "48.0 前置：api48.placeStageWrite 可用");
assert(V.world_corruption_hard === 2 && V.world_corruption_soft === 0, "48.0 前置：原版初始 world_corruption_hard=2 / soft=0, 实际 hard=" + V.world_corruption_hard + " soft=" + V.world_corruption_soft);
/* 48.1 顶层键直写（绕过原版根键黑名单 reason=vanilla 的拒绝路径） */
var w48a = api48.placeStageWrite("world_corruption_hard", 10, -30, Infinity);
assert(w48a.ok && V.world_corruption_hard === 10, "48.1 直写 hard=10（绕过原版根键黑名单）, 实际 " + V.world_corruption_hard);
assert(!!V.mbCE_wrote && !!V.mbCE_wrote["place:world_corruption_hard"], "48.1 留痕 place:world_corruption_hard 存在");
/* 48.2/48.3 上限不钳制：CE 直写越过原版宏 clamp 上限（hard 原版 clamp 30 / soft 原版 clamp 100） */
var w48b = api48.placeStageWrite("world_corruption_hard", 50, -30, Infinity);
assert(w48b.ok && V.world_corruption_hard === 50, "48.2 写 hard=50 不钳制（原版宏上限 30 不生效）, 实际 " + V.world_corruption_hard);
var w48c = api48.placeStageWrite("world_corruption_soft", 150, 0, Infinity);
assert(w48c.ok && V.world_corruption_soft === 150, "48.3 写 soft=150 不钳制（原版宏上限 100 不生效）, 实际 " + V.world_corruption_soft);
/* 48.4 下限按原版语义保留（hard ≥ -30 / soft ≥ 0），防负值破坏 */
var w48d = api48.placeStageWrite("world_corruption_hard", -40, -30, Infinity);
assert(w48d.ok && V.world_corruption_hard === -30, "48.4 写 hard=-40 钳到下限 -30, 实际 " + V.world_corruption_hard);
var w48e = api48.placeStageWrite("world_corruption_soft", -5, 0, Infinity);
assert(w48e.ok && V.world_corruption_soft === 0, "48.4 写 soft=-5 钳到下限 0, 实际 " + V.world_corruption_soft);
/* 48.5 回退：既有值还原（清留痕重来，保证 before 为首写前状态） */
delete V.mbCE_wrote;
V.world_corruption_hard = 8;
var w48f = api48.placeStageWrite("world_corruption_hard", 20, -30, Infinity);
assert(w48f.ok && V.world_corruption_hard === 20, "48.5 既有 hard=8 写 20, 实际 " + V.world_corruption_hard);
var w48u = api48.placeStageUndo("world_corruption_hard");
assert(w48u.ok && V.world_corruption_hard === 8, "48.5 回退还原原值 8, 实际 " + V.world_corruption_hard);
assert(!!V.mbCE_wrote && !V.mbCE_wrote["place:world_corruption_hard"], "48.5 回退清留痕");
/* 48.6 回退删字段（before=undefined 语义）：soft 原本无字段 → 写入 → 回退删字段 */
delete V.world_corruption_soft; delete V.mbCE_wrote;
var w48g = api48.placeStageWrite("world_corruption_soft", 30, 0, Infinity);
assert(w48g.ok && V.world_corruption_soft === 30, "48.6 无字段建写 soft=30, 实际 " + V.world_corruption_soft);
var w48h = api48.placeStageUndo("world_corruption_soft");
assert(w48h.ok && ("world_corruption_soft" in V) === false, "48.6 回退删字段（before=undefined → delete）, soft 存在=" + ("world_corruption_soft" in V));
delete V.mbCE_wrote;

/* ============ 49）v1.9.13 全面优化：负面属性快捷项 + 预设模板 + 时间调节 + 数值搜索 ============
   背景：用户要求三方面全面优化（作弊/游戏遗漏/代码），8 项优化中本节能覆盖的 4 项：
   #127 快捷面板补负面属性（原版 V 键实证 + 名声子键点路径直写）
   #129 预设模板（全属性拉满 / 经典开局，逐项留痕）
   #126 全局页时间调节（Time 全局对象快进 + 跳时段，非 V.timer 行动点）
   #128 Mod 数值搜索（cheatValueMatches 纯过滤 + renderCheatValues 计数/展开态） */
const api49 = setup.mbStageCE;
assert(!!api49 && typeof api49.applyQuickPreset === "function" && typeof api49.mcTimeAdvance === "function" && typeof api49.cheatValueMatches === "function", "49.0 前置：api49 导出预设/时间/搜索函数");
/* 武器技能走 prof.* 点路径，父级需有壳（与玩家页 ensureProfShell 语义一致） */
global.V.prof = {};
/* 49.1 负面状态 + 名声组存在（原版键实证：stress/trauma/pain/arousal/tiredness/anxiety/delinquency/drugged/drunk
   + fame.prostitution 等子键；均不在 CHEAT_VANILLA_ROOTS 黑名单，玩家面板通道可直写） */
var negGrp49 = api49.PANEL_QUICK_GROUPS.find(function (g) { return g.title === "负面状态"; });
assert(!!negGrp49 && negGrp49.items.length === 9, "49.1 负面状态组 9 项, 实际 " + (negGrp49 ? negGrp49.items.length : "无"));
var famGrp49 = api49.PANEL_QUICK_GROUPS.find(function (g) { return g.title === "名声（fame）"; });
assert(!!famGrp49 && famGrp49.items.length === 6 && famGrp49.items[0].path === "fame.prostitution", "49.1 名声组 6 项且首项 fame.prostitution, 实际 " + (famGrp49 ? JSON.stringify(famGrp49.items.map(x => x.path)) : "无"));
["stress", "trauma", "pain", "arousal", "tiredness", "anxiety", "delinquency", "drugged", "drunk"].forEach(function (p) {
  assert(!!negGrp49.items.find(function (it) { return it.path === p; }), "49.1 负面项存在：" + p);
});
/* 49.2 点路径写入：fame.prostitution（父级 V.fame 存在 → cheatResolvePath 通过） */
global.V.fame = { prostitution: 5, sex: 0 };
var qw49 = api49.quickWrite("fame.prostitution", 100);
assert(qw49.ok && V.fame.prostitution === 100, "49.2 点路径写入 fame.prostitution=100, 实际 " + V.fame.prostitution);
var ur49 = api49.undoPlayerValue("fame.prostitution");
assert(ur49.ok && V.fame.prostitution === 5, "49.2 回退还原 fame.prostitution=5, 实际 " + V.fame.prostitution);
/* 保留 V.fame 父级给 49.3/49.4 预设复用（预设含 fame 清零项） */
V.fame = { prostitution: 5, sex: 0 };
delete V.mbCE_wrote;
/* 49.3 预设「经典开局」：资金 5000 + 技能/成绩/武器 100 + 负面清零 + 名声清零 */
var r49a = api49.applyQuickPreset("fresh");
assert(r49a.ok && V.money === 5000, "49.3 经典开局 money=5000, 实际 " + V.money);
assert(V.stress === 0 && V.trauma === 0 && V.drunk === 0 && V.delinquency === 0, "49.3 经典开局负面清零, 实际 stress=" + V.stress + " trauma=" + V.trauma);
assert(V.handskill === 100 && V.oralskill === 100 && V.maths === 100 && V.prof.spray === 100, "49.3 经典开局技能/成绩/武器=100, 实际 hand=" + V.handskill + " oral=" + V.oralskill + " maths=" + V.maths + " spray=" + V.prof.spray);
assert(V.beauty === 100 && V.purity === 2000, "49.3 经典开局核心属性=100 / purity=2000, 实际 beauty=" + V.beauty + " purity=" + V.purity);
/* 49.4 预设「全属性拉满」：核心 999 / purity 2000 / 资金 999999 / 技能 1000 + 负面清零 */
delete V.mbCE_wrote;
var r49b = api49.applyQuickPreset("max");
assert(r49b.ok && V.money === 999999 && V.purity === 2000 && V.willpower === 999, "49.4 拉满 money/purity/willpower, 实际 " + V.money + "/" + V.purity + "/" + V.willpower);
assert(V.handskill === 1000 && V.maths === 1000 && V.prof.baton === 1000 && V.deviancy === 999, "49.4 拉满技能/成绩/武器=1000、异种癖=999, 实际 " + V.handskill + "/" + V.maths + "/" + V.prof.baton + "/" + V.deviancy);
assert(V.stress === 0 && V.pain === 0, "49.4 拉满负面清零, 实际 stress=" + V.stress + " pain=" + V.pain);
/* 49.5 留痕可回退：预设写入项均在 mbCE_wrote 留痕（key=p:path） */
assert(!!V.mbCE_wrote && !!V.mbCE_wrote["cheat:player-self:p:stress"], "49.5 预设留痕存在（cheat:player-self:p:stress）, 实际 keys=" + Object.keys(V.mbCE_wrote || {}).length);
delete V.mbCE_wrote;
/* 49.6 时间调节：Time mock（set 秒级快进 / setTime 跳时分）；V.timer 是行动点不是时钟，不误写 */
var tTime49 = { ts: 0, h: -1, m: -1, hour: 8, minute: 30, weekDay: 3, set: function (ts) { this.ts = ts; }, setTime: function (h, m) { this.h = h; this.m = m; } };
var oldTime49 = global.Time;
global.Time = tTime49;
V.timeStamp = 1000000;
var ta49 = api49.mcTimeAdvance(60);
assert(ta49.ok && tTime49.ts === 1000000 + 60 * 60, "49.6 快进 60 分钟 → Time.set(ts+3600), 实际 ts=" + tTime49.ts);
var tj49 = api49.mcTimeJump(18, 0);
assert(tj49.ok && tTime49.h === 18 && tTime49.m === 0, "49.6 跳时段 → Time.setTime(18,0), 实际 " + tTime49.h + ":" + tTime49.m);
var tn49 = api49.mcTimeNow();
assert(tn49 && tn49.hour === 8 && tn49.minute === 30 && tn49.weekDay === 3, "49.6 mcTimeNow 读取当前 8:30 周3, 实际 " + JSON.stringify(tn49));
/* 时间调节不写 V 存档键（V.timer 是行动点，误写会拨回当日 0 点——README FAQ 警示） */
assert(V.timer === undefined || V.timer === 0, "49.6 时间调节未触碰 V.timer 行动点, 实际 " + V.timer);
if (oldTime49 !== undefined) { global.Time = oldTime49; } else { delete global.Time; }
/* 49.7 数值搜索纯过滤：cheatValueMatches 命中 名称/键名/路径，q 空恒命中 */
var m49 = { values: [
  { key: "prost_peak", name: "卖淫巅峰", varPath: "DeadWood.prost.peak" },
  { key: "sword_skill", name: "武艺", varPath: "Fight.sword" }
] };
assert(api49.cheatValueMatches(m49.values[0], "") === true, "49.7 空搜索恒命中");
assert(api49.cheatValueMatches(m49.values[0], "prost") === true, "49.7 键名 prost 命中, 实际 " + api49.cheatValueMatches(m49.values[0], "prost"));
assert(api49.cheatValueMatches(m49.values[0], "卖淫") === true, "49.7 中文名 卖淫 命中, 实际 " + api49.cheatValueMatches(m49.values[0], "卖淫"));
assert(api49.cheatValueMatches(m49.values[0], "Fight") === false, "49.7 路径 Fight 不命中卖淫项");
/* 49.8 搜索态渲染：renderCheatValues 过滤计数 + 搜索态强制组展开（grp mock 每次新建，count 不串号） */
function grp49() { return { count: 0, pending: [], body: { setAttribute: function (k, v) { this[k] = v; } } }; }
api49.setModValueFilter("sword");
var g49 = grp49();
api49.renderCheatValues(m49, function () { return g49; }, function () { return null; });
assert(g49.count === 1 && g49.pending.length === 1, "49.8 搜索 sword 只计 1 项, 实际 count=" + g49.count);
assert(g49.body["data-collapsed"] === "0", "49.8 搜索态强制数值组展开, 实际 " + g49.body["data-collapsed"]);
api49.setModValueFilter("xyz");
var g49b = grp49();
api49.renderCheatValues(m49, function () { return g49b; }, function () { return null; });
assert(g49b.count === 0, "49.8 搜索 xyz 无命中 count=0, 实际 " + g49b.count);
api49.setModValueFilter("");
var g49c = grp49();
api49.renderCheatValues(m49, function () { return g49c; }, function () { return null; });
assert(g49c.count === 2, "49.8 清空搜索恢复 2 项, 实际 " + g49c.count);
/* 49.9 翻译表收敛验收（v1.9.13）：PANEL_QUICK_GROUPS 的 label 必须与 zhKey(path) 一致（单一事实源） */
var qg49 = api38.PANEL_QUICK_GROUPS;
var zhMismatch = [];
for (var gi49 = 0; gi49 < qg49.length; gi49++) {
	for (var it49 = 0; it49 < qg49[gi49].items.length; it49++) {
		var itm49 = qg49[gi49].items[it49];
		if (itm49.label !== api.zhKey(itm49.path)) { zhMismatch.push(itm49.path + ":" + itm49.label + "!=" + api.zhKey(itm49.path)); }
	}
}
assert(zhMismatch.length === 0, "49.9 快捷组 label 与 zhKey(path) 全一致（翻译单一事实源）, 不一致 " + zhMismatch.join(","));
assert(api.zhKey("anxiety") === "焦虑" && api.zhKey("drunk") === "醉酒" && api.zhKey("english") === "语文" && api.zhKey("arousal") === "情欲", "49.9 新增/统一翻译键: anxiety=焦虑 drunk=醉酒 english=语文 arousal=情欲, 实际 " + api.zhKey("anxiety") + "/" + api.zhKey("drunk") + "/" + api.zhKey("english") + "/" + api.zhKey("arousal"));

/* 50) MoreFarmUpgrade 适配器（DOL-More-Farm-Upgrade-Mod v1.0.8 适配轮）：农场 11 设施/资源/农夫键 */
/* 50.1 探测命中：V.farm 扩展字段出现即识别 more-farm-upgrade */
global.V.farm = { compost: 1 };
var mf50 = api.getCheatMods().filter(function (x) { return x.modId === "more-farm-upgrade"; })[0];
assert(mf50 && mf50.declared === true, "50.1 MoreFarmUpgrade 探测命中, 实际 " + (mf50 ? mf50.declared : "未识别"));
assert(mf50.values.length === 21 && mf50.abilities.length === 16, "50.1 声明 21 数值 + 16 能力, 实际 " + mf50.values.length + "/" + mf50.abilities.length);
/* 50.2 隔离：适配器不声明原版既有键（farm.build 施工中/farm.stock 原版库存/plots.farm 原版田） */
var mf50Paths = mf50.values.concat(mf50.abilities).map(function (x) { return x.varPath; });
assert(mf50Paths.indexOf("farm.build") === -1 && mf50Paths.indexOf("farm.stock") === -1 && mf50Paths.indexOf("plots.farm") === -1, "50.2 隔离原版键 farm.build/farm.stock/plots.farm 不声明");
assert(mf50Paths.indexOf("plots.farm.0.greenhouse") !== -1 && mf50Paths.indexOf("farm.farmer_can_hire") !== -1 && mf50Paths.indexOf("flowers_stored") !== -1, "50.2 新键存在：温室田 1/可雇许可/诡异花储量");
/* 50.3 数值写入读回：收割机 3 级（智能监控稳定高产） */
var wv50 = api.applyCheatModValue("more-farm-upgrade", "mf_harvester", 3);
assert(wv50.ok && V.farm.harvester === 3, "50.3 mf_harvester=3 写回, 实际 " + V.farm.harvester);
/* 50.4 越下限钳制到 0（max 由面板输入框约束，apply 层不钳） */
var wv50b = api.applyCheatModValue("more-farm-upgrade", "mf_harvester", -2);
assert(wv50b.ok && V.farm.harvester === 0, "50.4 越下限 -2 钳制到 0, 实际 " + V.farm.harvester);
/* 50.5 温室能力布尔通道：田 1 覆盖（模组 is true 严格布尔，禁 numeric 1） */
global.V.plots = { farm: [{}, {}, {}] };
var ga50 = api.toggleCheatAbility("more-farm-upgrade", "mf_gh1", true);
assert(ga50.ok && V.plots.farm[0].greenhouse === true, "50.5 mf_gh1 勾选写 boolean true, 实际 " + V.plots.farm[0].greenhouse);
var ga50b = api.toggleCheatAbility("more-farm-upgrade", "mf_gh1", false);
assert(ga50b.ok && V.plots.farm[0].greenhouse === false, "50.5 mf_gh1 取消写 false, 实际 " + V.plots.farm[0].greenhouse);
/* 50.6 农夫在岗 numeric 0/1 + 辞退 sync 补可雇许可 */
var fa50 = api.toggleCheatAbility("more-farm-upgrade", "mf_farmer_active", true);
assert(fa50.ok && V.farm.farmer === 1, "50.6 农夫在岗写 1, 实际 " + V.farm.farmer);
V.farm.farmer_can_hire = false;
var fa50b = api.toggleCheatAbility("more-farm-upgrade", "mf_farmer_active", false);
assert(fa50b.ok && V.farm.farmer === 0 && V.farm.farmer_can_hire === true, "50.6 辞退写 0 且 sync 补 can_hire=true, 实际 farmer=" + V.farm.farmer + " can_hire=" + V.farm.farmer_can_hire);
/* 50.7 资源直写：催情剂药瓶/诡异花/肥料袋 */
var wr50 = api.applyCheatModValue("more-farm-upgrade", "mf_phials", 5);
assert(wr50.ok && V.phials_stored === 5, "50.7 phials_stored=5, 实际 " + V.phials_stored);
var wr50b = api.applyCheatModValue("more-farm-upgrade", "mf_flowers", 1000);
assert(wr50b.ok && V.flowers_stored === 1000, "50.7 flowers_stored=1000, 实际 " + V.flowers_stored);
var wr50c = api.applyCheatModValue("more-farm-upgrade", "mf_fertiliser", 3);
assert(wr50c.ok && V.fertiliser_stored === 3, "50.7 fertiliser_stored=3, 实际 " + V.fertiliser_stored);
/* 50.8 温室等级 + 逐田标记联动语义核对：写等级 2 后勾选田 1/2 即完整生效（作弊两步走，note 已说明） */
var wg50 = api.applyCheatModValue("more-farm-upgrade", "mf_greenhouse", 2);
assert(wg50.ok && V.farm.field_greenhouse === 2, "50.8 field_greenhouse=2 写回, 实际 " + V.farm.field_greenhouse);
/* 50.9 农夫耐心（自查补键）：写 1 免催薪（boot.json isnot 1 判定）/写 0 进入催薪 */
delete V.farm.farmer_patience;
var wpat = api.applyCheatModValue("more-farm-upgrade", "mf_farmer_patience", 1);
assert(wpat.ok && V.farm.farmer_patience === 1, "50.9 mf_farmer_patience=1 写回（免催薪语义）, 实际 " + V.farm.farmer_patience);
var wpat2 = api.applyCheatModValue("more-farm-upgrade", "mf_farmer_patience", 0);
assert(wpat2.ok && V.farm.farmer_patience === 0, "50.9 mf_farmer_patience=0 写回（触发催薪语义）, 实际 " + V.farm.farmer_patience);
/* 50.10 直写堆肥联动补周期：写 compost=1 → ifMissing 补 compost_timer=7 + fertiliser_stored=0（竣工语义，模组每日事件无 undefined 兜底） */
V.farm.compost = 0; delete V.compost_timer; delete V.fertiliser_stored;
var wc50 = api.applyCheatModValue("more-farm-upgrade", "mf_compost", 1);
assert(wc50.ok && V.farm.compost === 1 && V.compost_timer === 7 && V.fertiliser_stored === 0, "50.10 compost=1 联动补 timer=7/肥=0, 实际 timer=" + V.compost_timer + " 肥=" + V.fertiliser_stored);
/* 50.10b 已有进度不被覆盖（ifMissing 防覆盖）：timer=3/肥=2 再写 1 → 保持 */
V.compost_timer = 3; V.fertiliser_stored = 2;
var wc50b = api.applyCheatModValue("more-farm-upgrade", "mf_compost", 1);
assert(wc50b.ok && V.compost_timer === 3 && V.fertiliser_stored === 2, "50.10b 已有堆肥进度不被联动覆盖, 实际 timer=" + V.compost_timer + " 肥=" + V.fertiliser_stored);
/* 50.10c 拆除（写 0）不触发补周期 */
delete V.compost_timer;
var wc50c = api.applyCheatModValue("more-farm-upgrade", "mf_compost", 0);
assert(wc50c.ok && V.compost_timer === undefined, "50.10c 拆除堆肥不补周期（if.min 1 门控）, 实际 timer=" + V.compost_timer);
/* 50.11 直写实验室联动补蒸馏计时：写 laboratory=1 → ifMissing 补 still_timer=1（实验室蒸馏 1 天） */
delete V.farm.still_timer;
var wl50 = api.applyCheatModValue("more-farm-upgrade", "mf_laboratory", 1);
assert(wl50.ok && V.farm.laboratory === 1 && V.farm.still_timer === 1, "50.11 laboratory=1 联动补 still_timer=1, 实际 " + V.farm.still_timer);
/* 50.11b 已有蒸馏进度不被覆盖 */
V.farm.still_timer = 4;
var wl50b = api.applyCheatModValue("more-farm-upgrade", "mf_laboratory", 1);
assert(wl50b.ok && V.farm.still_timer === 4, "50.11b 已有蒸馏进度不被联动覆盖, 实际 " + V.farm.still_timer);
/* 50.12 雇佣链联动（第二轮自查补：FarmerEvents 五个许可缺一即跳过对应动作，farmerTendingDay 依赖 water/till/plant/harvest；
   第三轮自查补：farmerPlantable 必初始化——getPlantableList() 对 V.farmerPlantable.forEach 无条件执行（FarmerEvents.js:153），
   undefined 时每日事件一运行即 TypeError 崩）：
   写 farmer=1 → 补 water/till/plant=true + harvest/sell=false + sellTimer=7 + farmerPlantable=[]（PubFarmer.twee:132-138 实证） */
V.farm.farmer = 0; V.farm.farmer_can_hire = true;
delete V.farmerCanWater; delete V.farmerCanTill; delete V.farmerCanPlant; delete V.farmerCanHarvest; delete V.farmerCanSell; delete V.farmerSellTimer; delete V.farmerPlantable;
var fe50 = api.toggleCheatAbility("more-farm-upgrade", "mf_farmer_active", true);
assert(fe50.ok && V.farm.farmer === 1 && V.farmerCanWater === true && V.farmerCanTill === true && V.farmerCanPlant === true && V.farmerCanHarvest === false && V.farmerCanSell === false && V.farmerSellTimer === 7 && Array.isArray(V.farmerPlantable) && V.farmerPlantable.length === 0,
  "50.12 雇佣联动补许可链 water/till/plant=true + harvest/sell=false + timer=7 + farmerPlantable=[], 实际 " + V.farmerCanWater + "/" + V.farmerCanTill + "/" + V.farmerCanPlant + "/" + V.farmerCanHarvest + "/" + V.farmerCanSell + "/" + V.farmerSellTimer + "/" + (V.farmerPlantable && V.farmerPlantable.length));
/* 50.12b 玩家已有许可不被覆盖（ifMissing 防覆盖）：先手动开收获/售货再雇佣 → 保持 */
V.farmerCanHarvest = true; V.farmerCanSell = true;
V.farm.farmer = 0;
var fe50b = api.toggleCheatAbility("more-farm-upgrade", "mf_farmer_active", true);
assert(fe50b.ok && V.farm.farmer === 1 && V.farmerCanHarvest === true && V.farmerCanSell === true, "50.12b 已有许可不被雇佣联动覆盖, 实际 harvest=" + V.farmerCanHarvest + " sell=" + V.farmerCanSell);
/* 50.12c 辞退（写 0）不触发许可链（if.min:1 门控），仅补 can_hire */
V.farmerCanWater = true;
var fe50c = api.toggleCheatAbility("more-farm-upgrade", "mf_farmer_active", false);
assert(fe50c.ok && V.farm.farmer === 0 && V.farm.farmer_can_hire === true && V.farmerCanWater === true, "50.12c 辞退补 can_hire 且许可链不被清空, 实际 farmer=" + V.farm.farmer + " water=" + V.farmerCanWater);
/* 50.13 农夫许可独立布尔开关：浇水/收获/售货写回 */
var pl50 = api.toggleCheatAbility("more-farm-upgrade", "mf_can_water", false);
assert(pl50.ok && V.farmerCanWater === false, "50.13 mf_can_water 取消写 false, 实际 " + V.farmerCanWater);
var pl50b = api.toggleCheatAbility("more-farm-upgrade", "mf_can_harvest", true);
assert(pl50b.ok && V.farmerCanHarvest === true, "50.13 mf_can_harvest 勾选写 true, 实际 " + V.farmerCanHarvest);
var pl50c = api.toggleCheatAbility("more-farm-upgrade", "mf_can_sell", true);
assert(pl50c.ok && V.farmerCanSell === true, "50.13 mf_can_sell 勾选写 true, 实际 " + V.farmerCanSell);

/* 51) DolMod 人物附加与生活质量提升 适配器（doctor55555-55555/DolMod- v0.1.990 适配轮）：
   阿电状态/电脑满配与全应用/银行活期/网课学习/兔人鱼转化/NG+/伊洛圣化 键（官方中文名三源一致） */
/* 51.1 探测命中（补 Adian/电脑/银行/平台根；V.rabbitbuild 已由 10.x 段设置） */
V.adian_met = 0; V.adian_romance = 0; V.adian_confession_state = "";
V.adian = { _inHospital: 0, _imprisoned: 0, _reported: 0, _jealousReady: 0, _loftRadioParts: 0, _loftRadioSet: 0, _stockholm: 0 };
V.computer = { assembled: false, parts: {}, performance: 0, location: null };
V.computerApps = {}; V.bank = { savings: 1000 }; V.ngplusCycle = 0;
V.indianStall_found = 0; V.seaPlatform_found = 0;
var dm51 = api.getCheatMods().filter(function (x) { return x.modId === "dolmod"; })[0];
assert(dm51 && dm51.declared === true && dm51.modName.indexOf("人物附加与生活质量提升") !== -1, "51.1 DolMod 探测命中且显示官方中文名, 实际 " + (dm51 ? dm51.modName : "未识别"));
assert(dm51.values.length === 18 && dm51.abilities.length === 12 && dm51.stages.length === 1, "51.1 声明 18 数值 + 12 能力 + 1 阶段, 实际 " + dm51.values.length + "/" + dm51.abilities.length + "/" + dm51.stages.length);
/* 51.2 隔离：适配器不声明原版既有键（阿电本体属性走角色面板/NPCName 槽位/现金/恋爱槽位） */
var dm51Paths = dm51.values.concat(dm51.abilities).map(function (x) { return x.varPath; });
assert(dm51Paths.indexOf("NPCName") === -1 && dm51Paths.indexOf("loveInterest") === -1 && dm51Paths.indexOf("money") === -1 && dm51Paths.indexOf("adian.love") === -1, "51.2 隔离原版键 NPCName/loveInterest/money/adian.love 不声明");
assert(dm51Paths.indexOf("adian_met") !== -1 && dm51Paths.indexOf("bank.savings") !== -1 && dm51Paths.indexOf("computer.assembled") !== -1 && dm51Paths.indexOf("rabbitbuild") !== -1, "51.2 新键存在：已认识/活期/电脑组装/兔子转化值");
/* 51.3 阿电状态 numeric 能力通道（模组 is/isnot 1 严格比较）：已认识勾选写 1/0 读回 */
var wm51 = api.toggleCheatAbility("dolmod", "dm_met", true);
assert(wm51.ok && V.adian_met === 1, "51.3 dm_met 勾选写 1, 实际 " + V.adian_met);
var wm51b = api.toggleCheatAbility("dolmod", "dm_met", false);
assert(wm51b.ok && V.adian_met === 0, "51.3 dm_met 取消写 0（可重走相遇剧情）, 实际 " + V.adian_met);
/* 51.4 表白状态字符串阶段通道：lovers 写回（四态 levels 实证）；跳最高=恋人 */
delete V.adian_confession_state;
var wc51 = api.setCheatStage("dolmod", "dm_conf_state", "lovers");
assert(wc51.ok && V.adian_confession_state === "lovers", "51.4 dm_conf_state=lovers 阶段写回, 实际 " + V.adian_confession_state);
var wc51b = api.setCheatStage("dolmod", "dm_conf_state", "bogus");
assert(!wc51b.ok && V.adian_confession_state === "lovers", "51.4 非法阶段拒绝且原值保持, 实际 " + V.adian_confession_state);
var wc51c = api.resetCheatStage("dolmod", "dm_conf_state");
assert(wc51c.ok && V.adian_confession_state === "", "51.4 回退初始（空=未表白）, 实际 " + JSON.stringify(V.adian_confession_state));
/* 51.5 满配电脑组合（写 1 → sync 补 10 顶级件 + 性能 91 + 卧室；ComputerMod.PartsCatalog 逐字名 + performance 桌面直读实证） */
V.computer = { assembled: false, parts: {}, performance: 0, location: null };
var pcf = api.toggleCheatAbility("dolmod", "dm_pc_full", true);
assert(pcf.ok && V.computer.assembled === 1 && V.computer.parts.gpu === "RTX 5090" && V.computer.parts.case === "全塔工作站机箱" && V.computer.parts.kb === "客制化机械键盘" && V.computer.performance === 91 && V.computer.location === "bedroom",
  "51.5 满配电脑 assembled=1 + GPU/机箱/键盘 + 性能91 + 卧室, 实际 " + JSON.stringify(V.computer));
/* 51.5b 拆机（写 0）不清部件（保留可自行拆装，uninstallPart 库存回写不崩） */
var pcfb = api.toggleCheatAbility("dolmod", "dm_pc_full", false);
assert(pcfb.ok && V.computer.assembled === 0 && V.computer.parts.gpu === "RTX 5090", "51.5b 拆机 assembled=0 且部件保留, 实际 " + JSON.stringify(V.computer));
/* 51.6 安装全部应用（写 1 → 10 应用 true；AppCatalog id 实证）；取消 → 其余 9 键 clear 置 null（主键 false） */
V.computerApps = {};
var pca = api.toggleCheatAbility("dolmod", "dm_pc_apps", true);
assert(pca.ok && V.computerApps.game_aaa === true && V.computerApps.freelance === true && V.computerApps.office === true, "51.6 全应用安装 3A/接单/办公 true, 实际 " + JSON.stringify(V.computerApps).slice(0, 120));
var pcab = api.toggleCheatAbility("dolmod", "dm_pc_apps", false);
assert(pcab.ok && V.computerApps.game_indie === 0 && V.computerApps.game_aaa === null && V.computerApps.office === null, "51.6b 取消卸载全部（主键 0 + 其余 null）, 实际 " + JSON.stringify(V.computerApps).slice(0, 120));
/* 51.7 银行/转化/学习/NG+/告白拒绝日 数值直写 */
var bs = api.applyCheatModValue("dolmod", "dm_bank_savings", 50000);
assert(bs.ok && V.bank.savings === 50000, "51.7 活期=50000, 实际 " + V.bank.savings);
var rb = api.applyCheatModValue("dolmod", "dm_rabbit", 3);
assert(rb.ok && V.rabbit === 3, "51.7 兔子阶段=3, 实际 " + V.rabbit);
var ls = api.applyCheatModValue("dolmod", "dm_learn_sci", 2);
assert(ls.ok && V.sciencetrait === 2, "51.7 网课科学等级=2（C+ 封顶）, 实际 " + V.sciencetrait);
var ng = api.applyCheatModValue("dolmod", "dm_ngplus", 2);
assert(ng.ok && V.ngplusCycle === 2, "51.7 NG+ 轮次=2, 实际 " + V.ngplusCycle);
var rj = api.applyCheatModValue("dolmod", "dm_reject_day", 42);
assert(rj.ok && V.adian_reject_day === 42, "51.7 告白拒绝日=42（Time.days 语义）, 实际 " + V.adian_reject_day);
var ct = api.applyCheatModValue("dolmod", "dm_captive_trust", 88);
assert(ct.ok && V.adian._captiveTrust === 88, "51.7 囚禁信任=88（自由等级派生≥3）, 实际 " + V.adian._captiveTrust);
/* 51.7b 伊洛圣化（0.1.990 新增键） */
var yh = api.applyCheatModValue("dolmod", "dm_yiluo_holy", 1);
assert(yh.ok && V.yiluo_holy === 1, "51.7b 伊洛圣化=1, 实际 " + V.yiluo_holy);
var yh0 = api.applyCheatModValue("dolmod", "dm_yiluo_holy", 0);
assert(yh0.ok && V.yiluo_holy === 0, "51.7b 伊洛圣化复位=0, 实际 " + V.yiluo_holy);
/* 51.8 卸载消失：清全部探测键后适配器自动消失 */
delete V.adian_met; delete V.adian_romance; delete V.adian; delete V.adian_confession_state; delete V.adian_reject_day; delete V.computer; delete V.computerApps; delete V.bank; delete V.ngplusCycle; delete V.indianStall_found; delete V.seaPlatform_found; delete V.sciencetrait; delete V.mermaidbuild; delete V.yiluo_holy;
assert(api.getCheatMods().filter(function (x) { return x.modId === "dolmod"; }).length === 0, "51.8 卸载后 DolMod 适配器自动消失");
V.rabbitbuild = 0; V.rabbit = 0; /* 恢复 10.x 段基线 */

/* 52) v1.9.28 优化回归：场景/特质求值编译缓存 + 批量解锁逐项守卫 + 聚合审计留痕 + 分类表覆盖 */
/* 52.1 TRAIT_ZH_CAT 覆盖 RAW 全部分类（缺中文组标题会退化为英文原文——静态表完整性守卫） */
var cats52 = {};
api.VANILLA_TRAITS_RAW.forEach(function (t) { if (t && t.cat) { cats52[t.cat] = true; } });
var miss52 = Object.keys(cats52).filter(function (c) { return !api.TRAIT_ZH_CAT[c]; });
assert(miss52.length === 0, "52.1 TRAIT_ZH_CAT 覆盖全部 " + Object.keys(cats52).length + " 个分类, 缺失 " + JSON.stringify(miss52));
/* 52.2 globalUnlockClothes：坏条目跳过不中断 + 聚合审计留痕（batch 不可逐键回退）+ 幂等 */
var oldSetupClothes52 = setup.specialClothes;
var oldVClothes52 = V.specialClothes;
var oldWrote52 = V.mbCE_wrote;
var oldVScenePassages52 = V.scenePassages;
var oldFood52 = setup.foodstuff;
var oldVFood52 = V.foodstuff;
setup.specialClothes = [null, { name: "MCE测试服A", sets: [] }, { name: "MCE测试服B", sets: ["mce-testset"] }];
delete V.specialClothes;
V.mbCE_wrote = {};
var u52 = api.globalUnlockClothes();
assert(u52.unlocked === 2 && u52.stories === 0, "52.2 坏条目跳过、2 件有效解锁, 实际 " + JSON.stringify(u52));
assert(Array.isArray(V.specialClothes) && V.specialClothes.length === 2 && V.specialClothes[0].name === "MCE测试服A" && V.specialClothes[0].unlocked === 3, "52.2 unlocked=3 写入, 实际 " + JSON.stringify(V.specialClothes));
var rec52 = V.mbCE_wrote["cheat:global:unlockClothes"];
assert(rec52 && rec52.type === "batch" && rec52.count === 2 && rec52.stories === 0, "52.2 聚合审计 type=batch count=2, 实际 " + JSON.stringify(rec52));
var un52 = api.undoCheatModValue("global", "unlockClothes");
assert(!un52.ok, "52.2 批量操作不可逐键回退（rec.type!=cheat 拒绝）, 实际 " + JSON.stringify(un52));
var u52b = api.globalUnlockClothes();
assert(u52b.unlocked === 2 && V.specialClothes.length === 2, "52.2 重复点击幂等（不重复建条目）, 实际 " + JSON.stringify(u52b));
/* 52.3 globalUnlockRecipes：仅含材料食谱解锁 + 聚合留痕 */
setup.foodstuff = { "mce_test_dish": { recipe: { ingredients: ["mce_flour"] } }, "mce_empty": { recipe: { ingredients: [] } }, "mce_noRecipe": { amount: 5 } };
delete V.foodstuff;
V.mbCE_wrote = {};
var ur52 = api.globalUnlockRecipes();
assert(ur52.unlocked === 1, "52.3 仅含材料食谱解锁 1 条, 实际 " + JSON.stringify(ur52));
assert(V.foodstuff.mce_test_dish && V.foodstuff.mce_test_dish.knows_recipe === true && !V.foodstuff.mce_empty && !V.foodstuff.mce_noRecipe, "52.3 knows_recipe 写入且无食谱条目不建壳, 实际 " + JSON.stringify(V.foodstuff));
var recR52 = V.mbCE_wrote["cheat:global:unlockRecipes"];
assert(recR52 && recR52.type === "batch" && recR52.count === 1, "52.3 食谱聚合留痕 count=1, 实际 " + JSON.stringify(recR52));
/* 52.4 场景注册表缓存：同 Story 引用命中（键集稳定）；换新对象强制失效重解析；V.scenes 注入实时合并；无 Story 不误用旧缓存 */
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT }].filter(fn) };
delete V.scenes;
delete V.scenePassages;
var gd52a = api.getScenesDefs();
var gd52b = api.getScenesDefs();
assert(gd52a.live === true && Object.keys(gd52a.defs).length === 9, "52.4 同 Story 解析 live=true 9 条, 实际 " + Object.keys(gd52a.defs).length);
assert(JSON.stringify(Object.keys(gd52a.defs).sort()) === JSON.stringify(Object.keys(gd52b.defs).sort()), "52.4 同 Story 引用两次调用键集一致（缓存命中）");
V.scenes = { MCE注入52: { name: "注入测试", startPassage: "P52", passages: ["P52"], unlocked: "$scenePassages.includes(\"X52\")" } };
var gd52c = api.getScenesDefs();
assert(!!gd52c.defs["MCE注入52"] && gd52c.defs["MCE注入52"].unlockedExpr.indexOf("X52") !== -1, "52.4 V.scenes 运行时注入键实时合并, 实际 " + JSON.stringify(gd52c.defs["MCE注入52"]));
delete V.scenes;
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT_ESCAPED }].filter(fn) };
var gd52d = api.getScenesDefs();
assert(gd52d.live === true && Object.keys(gd52d.defs).length === 9, "52.4 Story 对象引用变化强制失效重解析（转义形态仍 9 条）, 实际 " + Object.keys(gd52d.defs).length);
delete global.Story;
var gd52e = api.getScenesDefs();
assert(gd52e.live === false, "52.4 无 Story 时 live=false（不误用旧缓存）");
/* 52.4b 同 Story 对象内 passages 数组被原地替换（smoke 15 真实模式：global.Story.passages = [...]）
   → 数组引用信号变化强制失效重建，不误用空 Story 旧缓存 */
global.Story = { has: function () { return false; }, passages: [] };
delete V.scenes;
var gd52f = api.getScenesDefs();
assert(gd52f.live === false, "52.4b 空 passages 首查 live=false");
global.Story.passages = [{ name: "scenes", text: SCENE_TEXT }];
var gd52g = api.getScenesDefs();
assert(gd52g.live === true && Object.keys(gd52g.defs).length === 9, "52.4b passages 数组替换后失效重解析（9 条）, 实际 " + Object.keys(gd52g.defs).length);
delete global.Story;
/* 52.5 evalSceneExpr 编译缓存：判定函数每次调用实时读 V（无陈旧状态） */
delete V.scenePassages;
var st52a = api.sceneStatus({ unlockedExpr: "$scenePassages.includes(\"abc52\")" });
V.scenePassages = ["abc52"];
var st52b = api.sceneStatus({ unlockedExpr: "$scenePassages.includes(\"abc52\")" });
assert(st52a.state === "fail" && st52b.state === "pass", "52.5 同表达式两次求值随 V 状态变化正确（缓存无污染）, " + st52a.state + "/" + st52b.state);
/* 52.6 traitEval 编译缓存：命中仍实时读 V */
delete V.player;
var te52a = api.traitEval(V, {}, "$player.virginity.vaginal is true");
var te52b = api.traitEval(V, {}, "$player.virginity.vaginal is true");
V.player = { virginity: { vaginal: true } };
var te52c = api.traitEval(V, {}, "$player.virginity.vaginal is true");
assert(te52a === false && te52b === false && te52c === true, "52.6 traitEval 缓存命中仍实时读 V, " + te52a + "/" + te52b + "/" + te52c);
delete V.player;
/* 恢复基线 */
setup.specialClothes = oldSetupClothes52;
setup.foodstuff = oldFood52;
if (oldVClothes52 === undefined) { delete V.specialClothes; } else { V.specialClothes = oldVClothes52; }
if (oldVFood52 === undefined) { delete V.foodstuff; } else { V.foodstuff = oldVFood52; }
if (oldWrote52 === undefined) { delete V.mbCE_wrote; } else { V.mbCE_wrote = oldWrote52; }
if (oldVScenePassages52 === undefined) { delete V.scenePassages; } else { V.scenePassages = oldVScenePassages52; }

/* 53. v1.9.30 剧情直达触发：directTriggerScene 构造与守卫 */
try {
  const oldScenes53 = V.scenes;
  const oldRS53 = V.replayScene;
  const oldWinEngine53 = global.window && global.window.Engine;
  global.window.Engine = { play: function () {} }; /* startAnchoredReplay 引擎调用点（test_mce 无真实引擎） */
  delete V.replayScene;
  /* 53.1 未注册键拒绝 */
  const d1 = api.directTriggerScene("__nope__");
  assert(!!d1 && d1.ok === false && String(d1.message).indexOf("未找到") !== -1, "53.1 未注册剧情键直达被拒, " + JSON.stringify(d1));
  /* 53.2 def 构造：startPassage/passages 复制/mvc 传递 */
  V.scenes = { T53: { name: "测试直达", startPassage: "T53 Intro", passages: ["T53 Intro", "T53 2"], manualVariableChanges: "<<npcincr Kylar rage 100>>", unlocked: true } };
  const d2 = api.directTriggerScene("T53");
  assert(!!d2 && d2.ok === true && d2.scene.startPassage === "T53 Intro" && Array.isArray(d2.scene.passages) && d2.scene.passages.length === 2 && d2.scene.manualVariableChanges === "<<npcincr Kylar rage 100>>", "53.2 直达构造 P（startPassage/passages/mvc 传递）, " + JSON.stringify(d2.scene));
  /* 53.3 播放结束可重复直达（重看剧情，不写 scenePassages） */
  delete V.replayScene;
  const d3 = api.directTriggerScene("T53");
  assert(!!d3 && d3.ok === true, "53.3 播放结束后可再次直达（重看）, " + JSON.stringify(d3));
  delete V.replayScene;
  if (oldRS53 === undefined) { delete V.replayScene; } else { V.replayScene = oldRS53; }
  if (oldScenes53 === undefined) { delete V.scenes; } else { V.scenes = oldScenes53; }
  if (oldWinEngine53 === undefined) { delete global.window.Engine; } else { global.window.Engine = oldWinEngine53; }
} catch (e53) {
  failures++;
  console.error("FAIL: 53 剧情直达 api 测试异常: " + (e53 && e53.message ? e53.message : e53));
}


/* ===== 54：v2.0.0.002 新增能力（说话态度自由选择 / 武器直接获得 / 潜伏者 / 新适配器） ===== */
try {
  const api54 = setup.mbStageCE;
  const gV = global.V;

  // 54.1 说话态度：原版门槛 $submissive gt 850（顺从档）与 lt 1150（抗拒档）的交集判定
  const st851 = api54.attitudeState(851);
  assert(st851.sub === true && st851.resist === true && st851.both === true, "54.1a 851 两档全开, " + JSON.stringify(st851));
  const st1000 = api54.attitudeState(1000);
  assert(st1000.both === true, "54.1b 1000 两档全开（区间中点）");
  const st850 = api54.attitudeState(850);
  assert(st850.sub === false && st850.resist === true, "54.1c 850 顺从档锁定（需 gt 850）, " + JSON.stringify(st850));
  const st1150 = api54.attitudeState(1150);
  assert(st1150.resist === false && st1150.sub === true, "54.1d 1150 抗拒档锁定（需 lt 1150）, " + JSON.stringify(st1150));
  const stNull = api54.attitudeState(null);
  assert(stNull.value === null && stNull.both === false, "54.1e 未初始化不误判为可用");
  assert(api54.FSA_FREE_MID === 1000, "54.1f 一键中值常量=1000");

  // 54.2 写入闭环：applyAttitude 写的是 submissive 本体，且能回退
  gV.submissive = 400;
  const a1 = api54.applyAttitude(api54.FSA_FREE_MID);
  assert(a1.ok === true, "54.2a 写入 1000 成功, " + JSON.stringify(a1));
  assert(gV.submissive === 1000, "54.2b 变量已落盘, " + gV.submissive);
  assert(api54.attitudeState(gV.submissive).both === true, "54.2c 写入后两档全开");
  const au = api54.undoCheatModValue("player-self", "p:submissive");
  assert(au.ok === true && gV.submissive === 400, "54.2d 回退还原原值, " + gV.submissive);
  const a2 = api54.applyAttitude("abc");
  assert(a2.ok === false, "54.2e 非数字拒绝, " + a2.message);

  // 54.3 锁定目标值解析（绝对 / 相对 / 非法）
  assert(api54.quickTargetValue("100", 50) === 100, "54.3a 绝对值");
  assert(api54.quickTargetValue("+30", 50) === 80, "54.3b +N 相对");
  assert(api54.quickTargetValue("-20", 50) === 30, "54.3c -N 相对");
  assert(api54.quickTargetValue("  +5 ", 0) === 5, "54.3d 空格容错");
  assert(api54.quickTargetValue("abc", 0) === null, "54.3e 非法返回 null");
  assert(api54.quickTargetValue("", 0) === null, "54.3f 空串返回 null");

  // 54.4 武器直接获得：写 prof 键 = 原版持有判定（isnot undefined）
  gV.prof = { spray: 0, baton: 0, whip: 0, net: 0, pickaxe: 0 };
  delete gV.spray; delete gV.spraymax;
  const gw1 = api54.grantWeapon("prof.whip");
  assert(gw1.ok === true, "54.4a 获得鞭子 ok, " + JSON.stringify(gw1));
  gV.prof.baton = 722;
  const gwKeep = api54.grantWeapon("prof.baton");
  assert(gwKeep.ok === true && gV.prof.baton === 722, "54.4b 已有熟练度不被覆盖（722 保持）, " + gV.prof.baton);
  delete gV.prof.net;
  const gw2 = api54.grantWeapon("prof.net");
  assert(gw2.ok === true && gV.prof.net === 100, "54.4c 未定义武器建键=100, " + gV.prof.net);
  const gw3 = api54.grantWeapon("prof.spray");
  assert(gw3.ok === true, "54.4d 获得喷雾 ok");
  assert(gV.prof.spray === 100, "54.4e 喷雾熟练度=100");
  assert(gV.spraymax === 5, "54.4f 喷雾容量补到 5（否则 clamp 打不出）, " + gV.spraymax);
  assert(gV.spray === 5, "54.4g 喷雾弹药补满, " + gV.spray);
  const gw4 = api54.grantWeapon("prof.nope");
  assert(gw4.ok === false, "54.4h 未知武器键拒绝, " + gw4.message);
  delete gV.prof; delete gV.spray; delete gV.spraymax;
  const ga = api54.grantAllWeapons();
  assert(ga.ok === true, "54.4i 全部获得 ok, " + ga.message);
  ["spray", "baton", "whip", "net", "pickaxe"].forEach(function (w, i) {
    assert(typeof gV.prof[w] === "number" && gV.prof[w] > 0, "54.4j" + i + " " + w + " 已获得（非 undefined）");
  });

  // 54.5 潜伏者：状态 / 高值原样保留（无上限）/ 自动搬运（保底模式，补丁未命中时用）
  gV.lurkers_held = 0; gV.lurkers_stored = 0; gV.mbCE_lurkerMoved = 0;
  gV.hookah = { lurkers: 1, juice: 0 };
  const ls = api54.mbCELurkerState();
  assert(ls.ok === true && ls.fridge === 1 && ls.held === 0, "54.5a 状态读取, " + JSON.stringify(ls));
  const s9 = api54.mbCELurkerSet("hookah.lurkers", 9);
  assert(s9.ok === true && gV.hookah.lurkers === 9, "54.5b 冰箱写 9 原样保留（不再钳 5）, " + gV.hookah.lurkers);
  const s12 = api54.mbCELurkerSet("lurkers_held", 12);
  assert(s12.ok === true && gV.lurkers_held === 12, "54.5b2 手持写 12 原样保留, " + gV.lurkers_held);
  gV.lurkers_held = 3; gV.hookah.lurkers = 4; gV.lurkers_stored = 0; gV.mbCE_lurkerAuto = true;
  const moved = api54.mbCELurkerAutoTick();
  assert(moved === 3, "54.5c 自动搬运 3 只, moved=" + moved);
  assert(gV.lurkers_held === 0, "54.5d 手持清零（lt 1 恒成立，捕捉链不被卡）, " + gV.lurkers_held);
  assert(gV.hookah.lurkers === 7, "54.5e 冰箱累加无上限（4+3=7）, " + gV.hookah.lurkers);
  assert(gV.lurkers_stored === 0, "54.5f 冰箱不封顶故余量为 0, " + gV.lurkers_stored);
  assert(gV.mbCE_lurkerMoved === 3, "54.5g 累计搬运计数, " + gV.mbCE_lurkerMoved);
  api54.mbCELurkerSetAuto(false);
  gV.lurkers_held = 2;
  const moved0 = api54.mbCELurkerAutoTick();
  assert(moved0 === 0 && gV.lurkers_held === 2, "54.5h 关闭后不搬运, moved=" + moved0);
  assert(api54.MB_CE_LURKER_FRIDGE_MAX === 9999 && api54.MB_CE_LURKER_MAX === 9999, "54.5i 上限常量=9999（防呆值，非原版 5）");
  // 54.5j 文本解限纯函数：门控移除 + 冰箱 switch 换真实数值 + 幂等
  const src54 = '<<if $farm_stage gte 10 and $lurkers_held lt 1>>x<</if>>';
  const p1 = api54.mbCELurkerPatchText("Farm Yard", src54);
  assert(p1.hits === 1 && p1.kept === 1 && p1.text.indexOf("lurkers_held lt 1") < 0 && p1.text.indexOf("$farm_stage gte 10 ") >= 0,
    "54.5j 捕捉门控已移除, " + p1.text);
  assert(p1.text.length === src54.length, "54.5j2 长度守恒（汉化 pos 锚点不位移）: " + p1.text.length + " == " + src54.length);
  assert(api54.mbCELurkerPatchText("Farm Yard", p1.text).hits === 0, "54.5k 幂等（二次替换 0 处）");
  const p2 = api54.mbCELurkerPatchText("Widgets Flats",
    'and <<switch $hookah.lurkers>><<case 5>>five<</case>><<case 1>>one<</case>><<default>>no<</default>><</switch>> <<pluralise $hookah.lurkers "lurker">>');
  assert(p2.hits === 1 && p2.text.indexOf("switch") < 0 && p2.text.indexOf("$hookah.lurkers gt 0") >= 0,
    "54.5l 冰箱 switch 换成真实数值, " + p2.text);
  const p3 = api54.mbCELurkerPatchText("Widgets Flats", '<<if $lurkers_held gte 1 and $hookah.lurkers lt 5>>store<</if>>');
  assert(p3.hits === 1 && p3.text.indexOf("lt 5") < 0, "54.5m 存冰箱门控已移除, " + p3.text);
  // 54.5n 态度：三档成对写入 + 维持（把被改坏的值拉回所选档）
  gV.speech_attitude = "neutral"; gV.submissive = 1000; delete gV.mbCE_attitudeLock;
  const ap = api54.mbCEAttitudeApply("meek");
  assert(ap.ok === true, "54.5n 选 Meek 成功, " + ap.message);
  assert(gV.speech_attitude === "meek" && gV.submissive === 1500, "54.5o 成对写入 meek/1500, " + gV.speech_attitude + "/" + gV.submissive);
  gV.submissive = 300; gV.speech_attitude = "bratty";
  const tk = api54.mbCEAttitudeTick();
  assert(tk >= 1, "54.5p 维持触发修正, fixed=" + tk);
  assert(gV.speech_attitude === "meek", "54.5q 态度复位回 Meek, " + gV.speech_attitude);
  assert(gV.submissive === 851, "54.5r 顺从度拉回 Meek 门槛内侧（851）, " + gV.submissive);
  api54.mbCEAttitudeApply("bratty");
  gV.submissive = 1500;
  api54.mbCEAttitudeTick();
  assert(gV.speech_attitude === "bratty" && gV.submissive === 1149, "54.5s Bratty 拉回 1149, " + gV.submissive);
  const rel = api54.mbCEAttitudeRelease(true);
  assert(rel.ok === true && gV.speech_attitude === "neutral" && gV.submissive === 1000,
    "54.5t 解除并还原到锁定前的 neutral/1000, " + gV.speech_attitude + "/" + gV.submissive);

  // 54.6 FertilityExpansion 适配器：detect 依赖 ModLoader 列表 / 存档 eden 对象
  const oldZip = global.window.modDataValueZipList;
  global.window.modDataValueZipList = [{ name: "FertilityExpansion" }];
  const mods54 = api54.getCheatMods();
  const ids54 = mods54.map(function (m) { return m && m.modId; }).join(",");
  assert(ids54.indexOf("fertility-expansion") >= 0, "54.6a FertilityExpansion 适配器可见, " + ids54);
  const fert54 = mods54.filter(function (m) { return m && m.modId === "fertility-expansion"; })[0];
  assert(!!fert54 && Array.isArray(fert54.values) && fert54.values.length === 2, "54.6b 声明 2 个数值项");
  assert(!!fert54 && fert54.values[0].varPath === "eden.facility.capacity", "54.6c 首个数值项 = 房产容量");
  assert(!!fert54 && Array.isArray(fert54.stages) && fert54.stages.length === 1, "54.6d 只声明 1 个阶段（lifeStoryReadMode 为字符串已排除）");
  assert(!!fert54 && Array.isArray(fert54.abilities) && fert54.abilities.length === 11, "54.6e 11 个能力项（8 原有 + 3 个 settings 布尔）");
  // 54.6f 模组自带作弊等价：10 项动作 + 面板接管 + 无 API 时优雅降级
  assert(!!fert54 && Array.isArray(fert54.actions) && fert54.actions.length === 10, "54.6f 声明 10 个命令式动作（对齐 eden-cheats-ui）");
  assert(!!fert54 && typeof fert54.actionPanel === "function", "54.6g actionPanel 接管渲染（孩子下拉 + 表单 + 一键）");
  assert(api54.MB_CE_FERT_ACTIONS.map(function (a) { return a.key; }).join(",") ===
    "fert_labour,fert_parasite_fert,fert_parasite_ripe,fert_innate,fert_skills,fert_reset,fert_adult,fert_remove,fert_reset_reason,fert_adult_reason",
    "54.6h 10 项 key 与模组面板一一对应");
  const oldEden = global.window.EdenCheats;
  delete global.window.EdenCheats;
  const nr = api54.mbCEFertReady();
  assert(nr.ok === false && /EdenCheats/.test(nr.message), "54.6i 无 EdenCheats 时拒绝并说明原因, " + nr.message);
  let called = [];
  global.window.EdenCheats = {
    available: function () { return true; },
    labour: function () { called.push("labour"); return { ok: true, message: "已执行 labour" }; },
    parasites: function (f) { called.push("parasites:" + f); return { ok: true, message: "已执行 parasites" }; },
    children: function () { return [["7", { name: "测试孩子", gender: "f" }]]; },
    resetReason: function () { return "伊甸园没有空位，无法重置成年孩子的养育进度。请先腾出空位。"; }
  };
  assert(api54.mbCEFertReady().ok === true, "54.6j 有 EdenCheats 时可用");
  const fl = api54.mbCEFertRun("fert_labour", "", null);
  assert(fl.ok === true && called.indexOf("labour") >= 0, "54.6k 一键分娩走模组 API, " + fl.message);
  const fp = api54.mbCEFertRun("fert_parasite_fert", "", null);
  assert(fp.ok === true && called.indexOf("parasites:true") >= 0, "54.6l 寄生卵受精走模组 API, " + fp.message);
  const fr = api54.mbCEFertRun("fert_reset_reason", "7", null);
  assert(fr.ok === true && fr.message.indexOf("空位") >= 0, "54.6m 只读前置查询透传模组文案, " + fr.message);
  const fc = api54.mbCEFertChildren();
  assert(fc.length === 1 && String(fc[0][0]) === "7", "54.6n 孩子列表透传");
  // 54.6w 需求①（2026-11-07）：命令式动作不再要求先开原版作弊页；红字保留原文 + 「我不同意」
  const hadCheatFlag54 = Object.prototype.hasOwnProperty.call(global.V, "cheatsEnabled");
  const prevCheatFlag54 = global.V.cheatsEnabled;
  const savedAvail54 = global.window.EdenCheats.available;
  global.window.EdenCheats.available = function () { return false; };
  const readyOff = api54.mbCEFertReady();
  assert(readyOff.ok === true, "54.6w available() 为 false 时 CE 仍可用（不必先开原版作弊页）, " + readyOff.message);
  const seen54 = [];
  global.window.EdenCheats.labour = function () {
    seen54.push("cheatsEnabled=" + String(global.V && global.V.cheatsEnabled));
    return { ok: true, message: "已执行 labour" };
  };
  const runOff = api54.mbCEFertRun("fert_labour", "", null);
  assert(runOff.ok === true && seen54.length === 1 && seen54[0] === "cheatsEnabled=true",
    "54.6w2 调用期间临时置 cheatsEnabled=true 满足模组 guard, " + seen54.join(""));
  assert(hadCheatFlag54 ? global.V.cheatsEnabled === prevCheatFlag54 : global.V.cheatsEnabled === undefined,
    "54.6w3 调用后 cheatsEnabled 还原原值（不污染存档）");
  const paneRed54 = document.createElement("div");
  fert54.actionPanel(paneRed54, fert54);
  assert(paneRed54.textContent.indexOf("模组要求先开启原版作弊页") >= 0 && paneRed54.textContent.indexOf("我不同意") >= 0,
    "54.6w4 红字保留原文并追加「我不同意」");
  const paneRedOff54 = document.createElement("div");
  fert54.actionPanel(paneRedOff54, fert54);
  assert(paneRedOff54.textContent.indexOf("共 3 条记录") >= 0 || paneRedOff54.textContent.indexOf("目标孩子") >= 0,
    "54.6w5 available()=false 时面板仍完整渲染（不再只剩红字）");
  /* 54.6w6 最硬一条：mock 的 available() 照模组 eden-cheats.js:37-43 写法直接读 vars().cheatsEnabled，
     labour 里照 guard() 写法（:44-51）先检查再抛。临时置位若真生效，这条链路才通。 */
  global.window.EdenCheats.available = function () { return global.V.cheatsEnabled === true; };
  const guard54 = [];
  global.window.EdenCheats.labour = function () {
    if (!global.window.EdenCheats.available()) { throw new Error("请先打开原版作弊页。"); }
    guard54.push("guard-passed");
    return { ok: true, message: "ok" };
  };
  const runGuard54 = api54.mbCEFertRun("fert_labour", "", null);
  assert(runGuard54.ok === true && guard54.length === 1,
    "54.6w6 模组 guard 判据（读 V.cheatsEnabled）在临时置位后通过, " + runGuard54.message);
  assert(global.V.cheatsEnabled === prevCheatFlag54 || (!hadCheatFlag54 && global.V.cheatsEnabled === undefined),
    "54.6w7 guard 链路跑完后 cheatsEnabled 仍还原");
  /* 54.6w8 二轮修复：API 缺失时不能把「缺 API」说成「你已经开着原版作弊页」（原实现文案自相矛盾） */
  const savedApi54 = global.window.EdenCheats;
  global.window.EdenCheats = null;
  const paneNoApi54 = document.createElement("div");
  fert54.actionPanel(paneNoApi54, fert54);
  const txtNoApi54 = paneNoApi54.textContent;
  assert(txtNoApi54.indexOf("你已经开着原版作弊页") < 0 && txtNoApi54.indexOf("未检测到 window.EdenCheats") >= 0,
    "54.6w8 API 缺失时文案不矛盾（不谎称已开启原版作弊页）");
  global.window.EdenCheats = savedApi54;
  /* 54.6w9 异常路径：模组 action 抛错时 cheatsEnabled 也必须还原（finally 覆盖 throw） */
  global.window.EdenCheats.available = function () { return global.V.cheatsEnabled === true; };
  global.window.EdenCheats.labour = function () { throw new Error("模拟模组内部失败"); };
  const runThrow54 = api54.mbCEFertRun("fert_labour", "", null);
  assert(runThrow54.ok === false, "54.6w9 模组抛错时 mbCEFertRun 返回失败, " + runThrow54.message);
  assert(global.V.cheatsEnabled === prevCheatFlag54 || (!hadCheatFlag54 && global.V.cheatsEnabled === undefined),
    "54.6w9b 抛错路径 cheatsEnabled 仍还原");
  global.window.EdenCheats.available = savedAvail54;
  // 54.6y 需求②：原版「你对什么感到不安?」直写（绕开 attitudesControl 重算门控）
  const attKeys54 = api54.MB_CE_ATTITUDE_ITEMS.map(function (it) { return it.key; }).join(",");
  assert(attKeys54 === "underwear,nude,prostituting,lewd,hypnosis",
    "54.6y 5 项不安键与本体 $uncomfortable 一一对应, " + attKeys54);
  if (!global.V.uncomfortable || typeof global.V.uncomfortable !== "object") {
    global.V.uncomfortable = { underwear: true, nude: true, prostituting: true, lewd: true, hypnosis: true };
  }
  const prevUnder54 = global.V.uncomfortable.underwear;
  delete global.V.mbCE_wrote["cheat:vanilla-attitudes:underwear"];
  const attSet54 = api54.mbCEAttitudeSet("underwear", false);
  assert(attSet54.ok === true && global.V.uncomfortable.underwear === false,
    "54.6y2 直写 underwear=false 生效（不依赖 unlockExhibitionismUnderwear）, " + attSet54.message);
  assert(!!(global.V.mbCE_wrote && global.V.mbCE_wrote["cheat:vanilla-attitudes:underwear"]),
    "54.6y3 走留痕通道（可回退）");
  const attUndo54 = api54.mbCEAttitudeUndo("underwear");
  assert(attUndo54.ok === true && global.V.uncomfortable.underwear === prevUnder54,
    "54.6y4 回退还原面板写入前状态, " + attUndo54.message);
  assert(api54.mbCEAttitudeSet("underwear", "x").ok === false, "54.6y5 非法值类型拒绝写入");
  const attAll54 = api54.mbCEAttitudeSetAll(false);
  assert(attAll54.ok === true && global.V.uncomfortable.nude === false && global.V.uncomfortable.hypnosis === false,
    "54.6y6 一键全部解除不安（门控外直写）");
  const gate54 = api54.mbCEAttitudeGate("unlockExhibitionismNude");
  assert(gate54 && gate54.need === "exhibitionism>=95" && typeof gate54.ok === "boolean",
    "54.6y7 门槛只作说明（exhibitionism>=95）, " + JSON.stringify(gate54));
  /* 54.6y8 叶子键原本不存在也能直写（cheatResolvePath 只要求父级是对象，叶子允许缺失） */
  delete global.V.uncomfortable.lewd;
  const attAdd54 = api54.mbCEAttitudeSet("lewd", false);
  assert(attAdd54.ok === true && global.V.uncomfortable.lewd === false,
    "54.6y8 缺键时新建并写入（不因 undefined 拒绝）, " + attAdd54.message);
  // 54.6o/v2.0.0.002 补声明：eden-age.js normalizeSettings 里三个布尔设置
  assert(fert54.abilities.filter(function (a) { return a.varPath === "eden.settings.resetAgeOnTransfer"; }).length === 1,
    "54.6o 新增 resetAgeOnTransfer 声明");
  assert(fert54.abilities.filter(function (a) { return a.varPath === "eden.settings.immediateLifeStory"; }).length === 1 &&
    fert54.abilities.filter(function (a) { return a.varPath === "eden.settings.enableNightVisits"; }).length === 1,
    "54.6o2 新增 immediateLifeStory / enableNightVisits 声明");
  assert(fert54.abilities.filter(function (a) { return a.varPath === "eden.settings.parentTitleSource"; }).length === 0,
    "54.6o3 有意不声明 parentTitleSource（字符串枚举，避免数字档位打坏模组判定）");

  // 54.6p 需求③：孩子被注册进 $NPCList 后按 edenChildId 摘出，不进角色页
  const gV54 = global.V;
  const oldNpc54 = gV54.NPCList;
  gV54.NPCList = [{ name: "Luna", fullDescription: "Luna", edenChildId: 3 }];
  assert(api54.mbCEEdenChildIdOf("Luna") === "3", "54.6p 带 edenChildId 的 NPC 能识别出孩子 id");
  assert(api54.charCategory("Luna") === "edenChild", "54.6p2 孩子的分类是 edenChild（角色页据此拦截）");
  assert(api54.charCategory("Robin") !== "edenChild", "54.6p3 普通角色不受影响, " + api54.charCategory("Robin"));
  assert(api54.mbCEEdenChildIdOf("Robin") === null, "54.6p4 无 edenChildId 标记时返回 null");
  gV54.NPCList = oldNpc54;

  // 54.6q 孩子页数据层：列表 / 存在性 / 好感 / 定向发送 / 随叫随到 / 一键长大
  const oldEden54 = gV54.eden;
  const oldRec54 = gV54.childRecords;
  gV54.eden = {
    settings: { maturityDays: 90 },
    children: {
      "3": { name: "Luna", affection: 40, lifeStage: "toddler", lifeStageLabel: "幼儿期", status: "resident", species: "human", training: { skills: {} }, innate: {} }
    }
  };
  gV54.childRecords = [
    { childId: 0, name: "Egg0", development: { location: "eden_home" }, bornDate: 3 },
    null,
    null,
    { childId: 3, name: "Luna", development: { location: "eden_home" }, bornDate: 3 }
  ];
  const pairs54 = api54.mbCEFertKidPairs();
  assert(pairs54.length === 2, "54.6q 孩子列表 2 条, " + pairs54.length);
  assert(api54.mbCEFertKidAlive("3") !== null && api54.mbCEFertKidAlive("9") === null,
    "54.6q2 存在性检测：有则返回 child、无则 null");
  // 54.6q3 回退通道（模组 API 缺失时）不得留下「假存在」：childId 与下标不符、edenDeleted 的条目都不列
  const savedECD54 = global.window.EdenChildData;
  delete global.window.EdenChildData;
  (function () {
    const keep = gV54.childRecords;
    gV54.childRecords = [
      { childId: 0, bornDate: 3, development: { location: "eden_home" } },
      { childId: 9, bornDate: 3, development: { location: "eden_home" } },
      { childId: 2, bornDate: 3, development: { location: "eden_home" }, edenDeleted: true }
    ];
    const r = api54.mbCEFertKidPairs();
    gV54.childRecords = keep;
    assert(r.length === 1 && r[0][0] === "0", "54.6q3 回退跳过 childId≠下标 / edenDeleted 的假存在条目, " + JSON.stringify(r.map(function (x) { return x[0]; })));
    assert(api54.mbCEFertKidAlive("9") === null && api54.mbCEFertKidAlive("2") === null, "54.6q4 回退通道下这些条目判为不存在");
  })();
  if (savedECD54 !== undefined) { global.window.EdenChildData = savedECD54; }
  const aff54 = api54.mbCEFertKidSetAffection("3", "88");
  assert(aff54.ok === true && gV54.eden.children["3"].affection === 88, "54.6r 好感写入 88, " + aff54.message);
  assert(!!(gV54.mbCE_wrote && gV54.mbCE_wrote["cheat:fertility-expansion:fert_child_aff_3"]),
    "54.6r2 好感写入走留痕通道（可回退）");
  const loc54 = api54.mbCEFertKidSetLocation("3", "home");
  assert(loc54.ok === true && gV54.childRecords[3].development.location === "home", "54.6s 定向发送写 development.location, " + loc54.message);
  gV54.location = "home";
  assert(api54.mbCEFertKidCallToMe("3").ok === true, "54.6s2 随叫随到（玩家在 home）");
  gV54.location = "street";
  const call54 = api54.mbCEFertKidCallToMe("3");
  assert(call54.ok === true && /eden_home/.test(call54.message), "54.6s3 玩家不在居所时退回 eden_home 并说明, " + call54.message);
  delete gV54.location;
  const grow54 = api54.mbCEFertKidGrowUp("3", false);
  assert(grow54.ok === true && gV54.eden.children["3"].forcedAdult === true && gV54.eden.children["3"].lifeStage === "adult",
    "54.6t 一键长大写 forcedAdult 并置成年阶段, " + grow54.message);
  // 54.6u 模组侧删孩子后：检测为不存在，写操作明确拒绝且不抛错
  const saved54 = gV54.childRecords;
  gV54.childRecords = saved54.filter(function (c) { return !!c && c.childId !== 3; });
  assert(api54.mbCEFertKidAlive("3") === null, "54.6u 模组侧删掉后立即检测为不存在");
  const dead54 = api54.mbCEFertKidSetAffection("3", "90");
  assert(dead54.ok === false && /不存在/.test(dead54.message), "54.6u2 对已删孩子写入被拒绝并说明, " + dead54.message);
  assert(api54.mbCEFertKidGrowUp("3", false).ok === false, "54.6u3 对已删孩子一键长大被拒绝");
  gV54.childRecords = saved54;
  // 54.6v EdenChildData 通道（模组在线时的正路）+ 页面渲染
  const fakeApi54 = {
    entries: function () {
      return new Map([
        ["3", { name: "Luna", bornDate: 3, development: { location: "eden_home" } }],
        ["9", { name: "Gone", bornDate: 3, edenDeleted: true }]
      ]);
    },
    get: function (id) {
      if (String(id) === "3") { return { name: "Luna", bornDate: 3, development: { location: "eden_home" } }; }
      if (String(id) === "9") { return { name: "Gone", bornDate: 3, edenDeleted: true }; }
      return null;
    },
    phaseOf: function (c) { if (!c) { return "missing"; } if (c.edenDeleted) { return "removed"; } if (c.forcePhase) { return c.forcePhase; } return "born"; },
    locationOf: function (c) { return (c && c.development) ? c.development.location : ""; },
    ageDays: function () { return 12; },
    setLocation: function (c, l) { if (!c) { return false; } c.development.location = l; return true; }
  };
  global.window.EdenChildData = fakeApi54;
  const ep54 = api54.mbCEFertKidPairs();
  assert(ep54.length === 2, "54.6v EdenChildData.entries 列出 2 条");
  assert(api54.mbCEFertKidAlive("9") === null, "54.6v2 phaseOf=removed 判为不存在");
  assert(api54.mbCEFertKidInfo("3").ageDays === 12, "54.6v3 年龄走 EdenChildData.ageDays");
  assert(api54.mbCEFertKidSetLocation("3", "eden_contacts").ok === true, "54.6v4 地点走 EdenChildData.setLocation");
  const paneKid54 = global.document.createElement("div");
  api54.mbCEFertRenderChildren(paneKid54);
  assert(paneKid54.children.length > 0, "54.6w 孩子页能渲染出内容, n=" + paneKid54.children.length);
  // 54.6x 收敛轮：显式传存档变量 + 养育四项/先天四项（模组要求四项齐全，缺项抛错而非清零）
  const varsX = api54.mbCEFertKidVars();
  assert(!!varsX && varsX.eden === gV54.eden, "54.6x 孩子页显式把存档变量传给模组 API（不依赖 SugarCube.State 通道）");
  gV54.eden.children["3"].training = { skills: { knowledge: 10, fitness: 20, social: 30, awareness: 40 } };
  if (gV54.mbCE_wrote) { delete gV54.mbCE_wrote["cheat:fertility-expansion:fert_child_skills_3"]; }
  const skRes = api54.mbCEFertKidSaveSkills("3", { knowledge: "66" });  assert(skRes.ok === true && gV54.eden.children["3"].training.skills.knowledge === 66
    && gV54.eden.children["3"].training.skills.fitness === 20
    && gV54.eden.children["3"].training.skills.social === 30
    && gV54.eden.children["3"].training.skills.awareness === 40,
    "54.6x2 养育四项只改填写项，其余沿用现值（不被清零）, " + skRes.message);
  assert(!!(gV54.mbCE_wrote && gV54.mbCE_wrote["cheat:fertility-expansion:fert_child_skills_3"]),
    "54.6x3 养育写入走留痕通道");
  assert(api54.mbCEFertKidSaveSkills("3", { knowledge: "120" }).ok === false, "54.6x4 养育越界值被拒绝");
  const inRes = api54.mbCEFertKidSaveInnate("3", { appearance: "77" });
  assert(inRes.ok === true && gV54.eden.children["3"].innate.appearance === 77, "54.6x5 先天四项写入 77, " + inRes.message);
  assert(api54.mbCEFertKidSaveInnate("3", { appearance: "50.5" }).ok === false, "54.6x6 先天属性要求整数（50.5 被拒）");
  // 模组在线：patch 必须补齐四项，否则 eden-cheats.js 的 numeric(undefined) 会整笔抛错
  const prevCheatsX = global.window.EdenCheats;
  let spyX = null;
  global.window.EdenCheats = {
    available: function () { return true; },
    saveSkills: function (id, patch) { spyX = { id: id, patch: patch }; return { ok: true, message: "mod-ok" }; }
  };
  const spyRes = api54.mbCEFertKidSaveSkills("3", { fitness: "55" });
  assert(spyRes.ok === true && !!spyX && spyX.id === "3" && spyX.patch.knowledge === 66
    && spyX.patch.fitness === 55 && spyX.patch.social === 30 && spyX.patch.awareness === 40,
    "54.6x7 模组 saveSkills 收到补齐后的完整四项," + JSON.stringify(spyX));
  global.window.EdenCheats = prevCheatsX;
  // 54.6y phase 门控：未出生的孩子不能定向发送 / 一键长大（越过模组 born|egg 判定会写脏数据）
  const unbornX = { name: "Fetus", forcePhase: "unborn", development: {} };
  fakeApi54.get = function (id) {
    if (String(id) === "3") { return { name: "Luna", bornDate: 3, development: { location: "eden_home" } }; }
    if (String(id) === "4") { return unbornX; }
    return null;
  };
  gV54.eden.children["4"] = { name: "Fetus", lifeStage: "infant", status: "active" };
  const locX = api54.mbCEFertKidSetLocation("4", "home");
  assert(locX.ok === false && unbornX.development.location === undefined,
    "54.6y 未出生孩子拒绝定向发送且不写脏数据, " + locX.message);
  assert(api54.mbCEFertKidGrowUp("4", false).ok === false, "54.6y2 未出生孩子拒绝一键长大");
  assert(api54.mbCEFertKidSaveInnate("4", { appearance: "10" }).ok === false, "54.6y3 未出生孩子拒绝写先天属性");
  /* 收敛轮新增的 7 个孩子页符号必须真的挂在 api 上（否则面板/外部调用拿不到） */
  const kidApiNames54 = ["mbCEFertKidSaveSkills", "mbCEFertKidSaveInnate", "mbCEFertKidCurSkills",
    "mbCEFertKidCurInnate", "MB_CE_FERT_KID_SKILLS", "MB_CE_FERT_KID_INNATE", "mbCEFertKidVars"];
  const kidApiMiss54 = kidApiNames54.filter(function (k) { return typeof api54[k] === "undefined"; });
  assert(kidApiMiss54.length === 0, "54.6y4 api 暴露孩子页 7 个符号, 缺失=" + JSON.stringify(kidApiMiss54));
  assert(Array.isArray(api54.MB_CE_FERT_KID_SKILLS) && api54.MB_CE_FERT_KID_SKILLS.length === 4
    && Array.isArray(api54.MB_CE_FERT_KID_INNATE) && api54.MB_CE_FERT_KID_INNATE.length === 4,
    "54.6y5 养育/先天四项常量均为 4 项");
  delete gV54.eden.children["4"];
  delete global.window.EdenChildData;
  gV54.eden = oldEden54;
  gV54.childRecords = oldRec54;
  if (oldEden === undefined) { delete global.window.EdenCheats; } else { global.window.EdenCheats = oldEden; }
  if (oldZip === undefined) { delete global.window.modDataValueZipList; } else { global.window.modDataValueZipList = oldZip; }
} catch (e54) {
  failures++;
  console.error("FAIL: 54 新增能力测试异常: " + (e54 && e54.message ? e54.message : e54));
}

/* ===== 55：v2.0.0.002 边界矩阵（态度区间 / 武器获得 / 潜伏者钳制 / 相对值解析） ===== */
try {
  const api55 = setup.mbStageCE;
  const gV55 = global.V;

  // 55.1 态度区间穷举：sub = v > 850；resist = v < 1150（原版两档门槛，交集 851..1149）
  const attCases = [
    [0, false, true], [1, false, true], [849, false, true], [850, false, true],
    [851, true, true], [1000, true, true], [1149, true, true], [1150, true, false],
    [1151, true, false], [2000, true, false]
  ];
  for (const c of attCases) {
    const st = api55.attitudeState(c[0]);
    assert(st.sub === c[1], "55.1 sub@" + c[0] + " 期望 " + c[1] + " 实际 " + st.sub);
    assert(st.resist === c[2], "55.1 resist@" + c[0] + " 期望 " + c[2] + " 实际 " + st.resist);
    assert(st.both === (c[1] && c[2]), "55.1 both@" + c[0]);
  }

  // 55.2 武器获得矩阵：键缺失 / 0 → 写 100；1 / 722 / 1000 → 保持现值
  const weapons55 = ["spray", "baton", "whip", "net", "pickaxe"];
  gV55.prof = { spray: 0, baton: 0, whip: 0, net: 0, pickaxe: 0 };
  for (const w of weapons55) {
    delete gV55.prof[w];
    const r1 = api55.grantWeapon("prof." + w);
    assert(r1.ok === true && gV55.prof[w] === 100, "55.2 键缺失→建键 100：" + w + " 实际 " + gV55.prof[w]);
    gV55.prof[w] = 0;
    api55.grantWeapon("prof." + w);
    assert(gV55.prof[w] === 100, "55.2 值 0→写 100：" + w + " 实际 " + gV55.prof[w]);
    gV55.prof[w] = 1;
    api55.grantWeapon("prof." + w);
    assert(gV55.prof[w] === 1, "55.2 值 1→保持：" + w);
    gV55.prof[w] = 722;
    api55.grantWeapon("prof." + w);
    assert(gV55.prof[w] === 722, "55.2 已有 722 不被覆盖：" + w);
    gV55.prof[w] = 1000;
    api55.grantWeapon("prof." + w);
    assert(gV55.prof[w] === 1000, "55.2 已满 1000 不被覆盖：" + w);
  }

  // 55.2b 喷雾附带容量与弹药（spray() 内 Math.clamp(V.spray,0,V.spraymax)，spraymax=0 时打不出）
  gV55.spraymax = 0;
  gV55.spray = 0;
  const sp = api55.grantWeapon("prof.spray");
  assert(sp.ok === true, "55.2b 喷雾获得成功");
  assert(gV55.spraymax === 5, "55.2b spraymax=5，实际 " + gV55.spraymax);
  assert(gV55.spray === 5, "55.2b spray=5，实际 " + gV55.spray);
  assert(api55.grantWeapon("prof.nunchaku").ok === false, "55.2b 未知武器键被拒绝");
  gV55.prof = {};
  api55.grantAllWeapons();
  for (const w of weapons55) {
    assert(typeof gV55.prof[w] === "number" && gV55.prof[w] >= 1, "55.2c grantAllWeapons 后已获得：" + w);
  }

  // 55.3 潜伏者：冰箱/手持均无上限（原版 5 与 1 都是 twee 门控，不是数值上限）
  gV55.hookah = { lurkers: 0, juice: 0 };
  gV55.lurkers_held = 0;
  gV55.lurkers_stored = 0;
  assert(api55.MB_CE_LURKER_FRIDGE_MAX === 9999, "55.3 冰箱上限常量=9999（防呆值）");
  api55.mbCELurkerSet("hookah.lurkers", 9);
  assert(gV55.hookah.lurkers === 9, "55.3 写 9 原样保留，实际 " + gV55.hookah.lurkers);
  api55.mbCELurkerSet("hookah.lurkers", 6);
  assert(gV55.hookah.lurkers === 6, "55.3 写 6 原样保留");
  api55.mbCELurkerSet("hookah.lurkers", 5);
  assert(gV55.hookah.lurkers === 5, "55.3 写 5 原样");
  api55.mbCELurkerSet("hookah.lurkers", 0);
  assert(gV55.hookah.lurkers === 0, "55.3 写 0 原样");
  api55.mbCELurkerSet("lurkers_held", 2);
  assert(gV55.lurkers_held === 2, "55.3 手持写入，实际 " + gV55.lurkers_held);
  api55.mbCELurkerSet("lurkers_stored", 3);
  assert(gV55.lurkers_stored === 3, "55.3 蒸馏笼写入，实际 " + gV55.lurkers_stored);
  const lst = api55.mbCELurkerState();
  assert(lst.ok === true && lst.fridge === 0 && lst.held === 2, "55.3 状态读取 held=2 fridge=0");
  gV55.mbCE_lurkerAuto = false;
  assert(api55.mbCELurkerAutoTick() === 0, "55.3 未开自动搬运时不搬");

  // 55.4 相对值解析：绝对 / +N / -N / 非法
  const qc = api55.quickTargetValue;
  assert(qc("100", 10) === 100, "55.4 绝对值");
  assert(qc("+5", 10) === 15, "55.4 相对加");
  assert(qc("+ 5", 10) === 15, "55.4 相对加带空格");
  assert(qc("-5", 10) === 5, "55.4 相对减");
  assert(qc(" 7 ", 0) === 7, "55.4 前后空格");
  assert(qc("abc", 5) === null, "55.4 非法输入");
  assert(qc("", 5) === null, "55.4 空串");
  assert(qc(null, 5) === null, "55.4 null");
  assert(qc("1e2", 5) === null, "55.4 科学计数法不认");
  assert(qc("0x10", 5) === null, "55.4 十六进制不认");
  assert(qc("5.5", 5) === 5.5, "55.4 小数");
  assert(qc("+0", 10) === 10, "55.4 +0 保持当前值");
  assert(qc("-0", 10) === 10, "55.4 -0 保持当前值");
  assert(qc("-100", 5) === -95, "55.4 相对减可到负数（由写入层 clamp）");
  assert(qc("+12.5", 7.5) === 20, "55.4 相对加小数");
  assert(qc("5 ", 0) === 5, "55.4 尾随空格");
} catch (e55) {
  failures++;
  console.error("FAIL: 55 边界矩阵测试异常: " + (e55 && e55.message ? e55.message : e55));
}


// ===== 54 言灵页（v2.0.0.006）：isCrossdressing 运行期拦截 / 异装残留净化 / 负面名声清零 =====
try {
  const origWin54 = global.window;
  const y54 = setup.mbStageCE; /* 产物内部函数走对外 API（严格模式 eval 的 var/function 不泄漏到外层） */
  let hit54 = 0;
  global.window = { isCrossdressing: function () { hit54++; return true; } };

  // 54.1~54.5 钩子挂载 / 语义透传 / 开关拦截 / 幂等 / 关闭恢复
  V.mbCE_yanling = { noCross: false, noTrait: false };
  const ok54a = y54.yanlingInstall();
  assert(ok54a === true && typeof global.window.isCrossdressing === "function", "54.1 钩子挂载成功（window.isCrossdressing 为函数）");
  hit54 = 0;
  assert(global.window.isCrossdressing() === true && hit54 === 1, "54.2 开关关闭 → 透传原判定 true 且上游被调用 1 次");
  V.mbCE_yanling.noCross = true;
  hit54 = 0;
  assert(global.window.isCrossdressing() === false && hit54 === 0, "54.3 开关开启 → 恒 false 且上游零调用（不穿帮）");
  const w54 = global.window.isCrossdressing;
  y54.yanlingInstall(); y54.yanlingInstall();
  assert(global.window.isCrossdressing === w54, "54.4 重复安装幂等（wrapper 不被二次包裹）");
  V.mbCE_yanling.noCross = false;
  hit54 = 0;
  assert(global.window.isCrossdressing() === true && hit54 === 1, "54.5 关闭后恢复原版判定（可逆）");
  // 54.6 第三方在我们之后重包：以新函数为上游重新包裹，拦截仍生效
  const mine54 = global.window.isCrossdressing;
  global.window.isCrossdressing = function () { return mine54(); };
  y54.yanlingInstall();
  V.mbCE_yanling.noCross = true;
  hit54 = 0;
  assert(global.window.isCrossdressing() === false && hit54 === 0, "54.6 第三方重包后重新包裹，拦截仍生效");
  V.mbCE_yanling.noCross = false; /* 复位，避免后续净化用例被守卫干扰 */

  // 54.7~54.9 异装残留净化（$crossdressing / 学校名声 / 文案）
  V.crossdressing = 2;
  V.schoolrep = { crossdress: 4, herm: 1 };
  V.school_crossdress_message = 3;
  const r54a = y54.yanlingPurgeCross();
  assert(r54a.ok === true && V.crossdressing === 0 && V.schoolrep.crossdress === 0, "54.7 purge_cross 清 $crossdressing 与 $schoolrep.crossdress");
  assert(V.school_crossdress_message === undefined, "54.8 purge_cross 删除 $school_crossdress_message（清文案，否则左侧仍提示）");
  assert(!!(V.mbCE_wrote && V.mbCE_wrote["yanling:purge_cross"] && V.mbCE_wrote["yanling:purge_cross"].before && V.mbCE_wrote["yanling:purge_cross"].before.schoolrep === 4), "54.9 purge_cross 按 yanling:op 留痕且含 before 真值");

  // 54.10~54.11 异装癖进度 + 背景特质
  V.crossdressingTrait = 87;
  V.backgroundTraits = ["crossdresser", "lustful"];
  const r54b = y54.yanlingPurgeTrait();
  assert(r54b.ok === true && V.crossdressingTrait === 0, "54.10 purge_trait 清空 $crossdressingTrait 进度");
  assert(V.backgroundTraits.indexOf("crossdresser") === -1 && V.backgroundTraits.indexOf("lustful") !== -1, "54.11 purge_trait 只移除 crossdresser，其他背景特质保留");

  // 54.12~54.15 负面名声清零（学校 2 键 + fame 负面 8 项 + 衰减队列，正面项不动）
  V.fame = { sex: 120, prostitution: 40, rape: 5, bestiality: 0, pregnancy: 0, impreg: 0, exhibitionism: 300, pimp: 8, scrap: 1000, good: 1000, business: 500, social: 700, model: 300 };
  V.fameDecay = { sex: 2, scrap: 1 };
  V.fameDecayTimer = { sex: 3, scrap: 5 };
  V.schoolrep = { crossdress: 0, herm: 1 };
  V.school_herm_message = 2;
  const r54c = y54.yanlingPurgeFame();
  assert(r54c.ok === true && V.fame.sex === 0 && V.fame.prostitution === 0 && V.fame.rape === 0 && V.fame.exhibitionism === 0 && V.fame.pimp === 0, "54.12 purge_fame 清零 fame 负面 8 项");
  assert(V.fame.scrap === 1000 && V.fame.good === 1000 && V.fame.business === 500 && V.fame.social === 700 && V.fame.model === 300, "54.13 purge_fame 不动正面 5 项（scrap/good/business/social/model）");
  assert(V.fameDecay.sex === undefined && V.fameDecayTimer.sex === undefined && V.fameDecay.scrap === 1 && V.fameDecayTimer.scrap === 5, "54.14 purge_fame 同步删负面衰减队列项、保留正面项（不删整个对象，避免 77558 遍历崩）");
  assert(V.schoolrep.herm === 0 && V.school_herm_message === undefined, "54.15 purge_fame 清学校 herm 名声与文案");

  // 54.16~54.17 未启用时不污染存档
  delete V.mbCE_yanling;
  y54.yanlingTick();
  assert(V.mbCE_yanling === undefined, "54.16 tick 在未启用时不创建 $mbCE_yanling（不污染每个存档）");
  assert(global.window.isCrossdressing() === true, "54.17 无状态时不误拦（window.isCrossdressing 透传原判定）");

  // 54.18~54.20 开关 + 每秒守卫压制
  const s54 = y54.yanlingState();
  assert(!!s54 && s54.noCross === false && s54.noTrait === false, "54.18 mbCE_yanlingState 建默认态（noCross/noTrait 均 false）");
  const t54a = y54.yanlingToggle("noCross");
  assert(t54a.ok === true && V.mbCE_yanling.noCross === true, "54.19 toggle 开启 noCross 并写状态");
  V.crossdressing = 1; V.schoolrep = { crossdress: 5 }; V.school_crossdress_message = 2;
  y54.yanlingTick();
  assert(V.crossdressing === 0 && V.schoolrep.crossdress === 0 && V.school_crossdress_message === undefined, "54.20 tick 每秒把 $crossdressing / schoolrep.crossdress / 文案压回 0（读档后同样生效）");
  V.crossdressingTrait = 55;
  y54.yanlingToggle("noTrait");
  y54.yanlingTick();
  assert(V.crossdressingTrait === 0, "54.21 noTrait 开启后 tick 把异装癖进度压回 0");
  const t54b = y54.yanlingToggle("noCross");
  assert(t54b.ok === true && V.mbCE_yanling.noCross === false, "54.22 再次 toggle 关闭 noCross（可随时恢复原版）");

  // 54.23~54.27 收敛轮：状态归一严格化 / 「关闭即卸载」/ 未启用不重挂（防第三方链式重包成环）
  V.mbCE_yanling = { noCross: "false", noTrait: "0" };
  const s54c = y54.yanlingState();
  assert(s54c.noCross === false && s54c.noTrait === false, "54.23 状态归一严格（字符串 \"false\"/\"0\" 不得被判为开启）");

  const origCD54 = function () { return true; };
  global.window.isCrossdressing = origCD54;
  V.mbCE_yanling = { noCross: true, noTrait: false };
  y54.yanlingInstall();
  assert(global.window.isCrossdressing !== origCD54, "54.24 显式 install 后 window 上是 wrapper（上游被保存）");
  y54.yanlingToggle("noCross");
  assert(global.window.isCrossdressing === origCD54, "54.25 关闭 noCross 立即卸载，window.isCrossdressing 还原为上游原函数");
  V.mbCE_yanling.noTrait = true;
  y54.yanlingTick();
  assert(global.window.isCrossdressing === origCD54 && y54.yanlingState().noTrait === true, "54.26 noCross 关闭而 noTrait 开启时 tick 不重挂钩子（只压异装癖）");
  y54.yanlingUninstall(); y54.yanlingUninstall();
  assert(global.window.isCrossdressing === origCD54, "54.27 uninstall 幂等且不误改已被第三方替换的函数");
  const t54c = y54.yanlingToggle("evilField");
  assert(t54c.ok === false && V.mbCE_yanling.evilField === undefined, "54.28 toggle 拒绝白名单外字段（不往存档写垃圾键）");

  // 54.29~54.32 正面名声拉满（v2.0.3：fame 正面 5 项写到 clamp 上限 2000，pregnancy 上限动态不写）
  V.fame = { sex: 0, prostitution: 0, good: 120, business: 2000, scrap: 800, social: 350, model: 5, pregnancy: 3, impreg: 0 };
  const r54d = y54.yanlingMaxFame();
  assert(r54d.ok === true && V.fame.good === 2000 && V.fame.business === 2000 && V.fame.scrap === 2000 && V.fame.social === 2000 && V.fame.model === 2000,
    "54.29 max_fame 把正面 5 项拉到 2000（原 business 已是 2000 不重复改写）");
  assert(V.fame.pregnancy === 3 && V.fame.impreg === 0 && V.fame.sex === 0,
    "54.30 max_fame 不动 pregnancy（上限是动态的 playerNormalPregnancyTotal*250）/ impreg / 负面项");
  assert(!!(V.mbCE_wrote && V.mbCE_wrote["yanling:max_fame"] && V.mbCE_wrote["yanling:max_fame"].before.good === 120),
    "54.31 max_fame 按 yanling:op 留痕且 before 含原值（可回退）");
  const r54e = y54.yanlingMaxFame();
  assert(r54e.ok === true && r54e.msg.indexOf("实际改写 0 项") !== -1, "54.32 max_fame 幂等（已满时改写 0 项），实际 " + r54e.msg);
  delete V.fame;
  assert(y54.yanlingMaxFame().ok === false, "54.33 无 $fame 时拒绝并给中文原因（不凭空建对象污染存档）");

  // 54.34~54.36 监狱庇护枚举直写（原版 $prison.protection 合法值 = "" / "scarred" / "tattooed"）
  V.prison = { protection: "", attention_level: 2, scarred_level: 1 };
  const r54f = y54.yanlingPrisonProtect("scarred");
  assert(r54f.ok === true && V.prison.protection === "scarred" && typeof V.prison.protection === "string",
    "54.34 prison_protect 直写字符串 \"scarred\"（写数字会让原版两处 is 判定 + !protection 同时失效）");
  assert(y54.yanlingPrisonProtect("tattooed").ok === true && V.prison.protection === "tattooed", "54.35 prison_protect 可切到 \"tattooed\"");
  assert(!!(V.mbCE_wrote && V.mbCE_wrote["yanling:prison_protection"]), "54.36 prison_protect 按 yanling:op 留痕（含 before 供回退）");
  assert(y54.yanlingPrisonProtect("").ok === true && V.prison.protection === "", "54.37 prison_protect 清空为 \"\"（空串为假值 = 无庇护）");
  delete V.prison;
  const r54h = y54.yanlingPrisonProtect("scarred");
  assert(r54h.ok === false && r54h.msg.indexOf("无监狱对象") !== -1, "54.38 无 $prison 时拒绝并提示「进一次监狱后可用」");

  global.window = origWin54;
} catch (e54) {
  failures++;
  console.error("FAIL: 54 言灵页测试异常: " + (e54 && e54.message ? e54.message : e54));
}


// ===== 56 言灵扩容（v2.0.2）：衣物烘干/加固 · 数值快补 · 天气 · 角色放逐 =====
try {
  const origWin56 = global.window;
  const y56 = setup.mbStageCE;
  let hitWeather = {};
  const mockWin56 = {
    setWeather: function (t, inst) { hitWeather = { t: t, inst: inst, seeds: hitWeather.seeds === true }; },
    unlockAllSeeds: function () { hitWeather.seeds = true; }
  };
  global.window = mockWin56;
  const origTime56 = global.Time;
  global.Time = { date: { timeStamp: 1000 } };
  mockWin56.DateTime = function (ts) {
    const base = (ts && typeof ts === "object" && typeof ts.timeStamp === "number") ? ts.timeStamp : (Number(ts) || 0);
    this.timeStamp = base;
    this.addDays = function (n) { return { timeStamp: base + n * 86400 }; };
  };

  // 56.1~56.2 衣物烘干
  V.upperwet = 30; V.lowerwet = 12; V.underupperwet = 0; V.underlowerwet = 44;
  const d56 = y56.yanlingDryClothes();
  assert(d56.ok === true && V.upperwet === 0 && V.lowerwet === 0 && V.underlowerwet === 0, "56.1 一键烘干 4 项湿度归零");
  assert(!!(V.mbCE_wrote && V.mbCE_wrote["yanling:dry_clothes"] && V.mbCE_wrote["yanling:dry_clothes"].before.upperwet === 30), "56.2 烘干按 yanling:op 留痕且 before 含原值");

  // 56.3~56.5 衣物加固（按 integrity_max / 回落 +1000 / naked 跳过）
  V.worn = {
    upper: { name: "shirt", integrity: 40, integrity_max: 1000 },
    lower: { name: "skirt", integrity: 500 },
    under_upper: { name: "naked" },
    under_lower: { name: "panties", integrity: 10, integrity_max: 300 }
  };
  const rp56 = y56.yanlingRepairClothes();
  assert(rp56.ok === true && V.worn.upper.integrity === 1000, "56.3 加固把带 integrity_max 的衣物写满（不超上限）");
  assert(V.worn.lower.integrity === 1500 && V.worn.under_lower.integrity === 300, "56.4 无上限的回落「当前 +1000」，有上限的写满");
  assert(V.worn.under_upper.name === "naked" && V.worn.under_upper.integrity === undefined, "56.5 穿着的 naked 槽跳过不写");

  // 56.6 精液补满（amount=原 volume，volume+=1000）
  V.semen_volume = 90; V.semen_amount = 20;
  const sm56 = y56.yanlingSemen();
  assert(sm56.ok === true && V.semen_amount === 90 && V.semen_volume === 1090, "56.6 精液补满：amount 补到原 volume，volume +1000");

  // 56.7 精神恢复
  V.control = 0; V.hallucinogen = 40;
  const md56 = y56.yanlingMind();
  assert(md56.ok === true && V.control === 1000 && V.hallucinogen === 0, "56.7 精神恢复：control=1000、hallucinogen=0");

  // 56.8 施虐 / 受虐
  V.sadism = 0; V.masochism = 12;
  y56.yanlingSadism();
  assert(V.sadism === 1000 && V.masochism === 1000, "56.8 施虐 / 受虐拉满 1000");

  // 56.9 种子走原版函数
  const sd56 = y56.yanlingSeeds();
  assert(sd56.ok === true && hitWeather !== null && hitWeather.seeds === true, "56.9 集齐种子调原版 unlockAllSeeds()（不自造种子表）");

  // 56.10~56.12 杂项数值
  V.robinmoney = 300; V.averydate = 0; V.headpasswordknown = undefined;
  y56.yanlingRobinMoney(); y56.yanlingAveryDate(); y56.yanlingHeadPassword();
  assert(V.robinmoney === 0 && V.averydate === 1 && V.headpasswordknown === 1, "56.10 罗宾存款 0 / 艾弗里约会 1 / 校长密码 1");
  V.feats = { locked: true };
  y56.yanlingFeats();
  assert(V.feats.locked === false, "56.11 成就限制解除写布尔 false（原版以 isnot true 判已解锁）");
  V.farm = { clearing: 60 }; V.fertiliser = { current: 2 };
  y56.yanlingFarm();
  assert(V.farm.clearing === 0 && V.fertiliser.current === 7, "56.12 农田清场 + 堆肥 +5");

  // 56.13 奶量：先抬上限再写当前值
  V.milk_volume = 30; V.milk_max = 3000;
  y56.yanlingMilk();
  assert(V.milk_max === 10000 && V.milk_volume === 5000, "56.13 奶量 5000 且上限先抬到 10000（不被每日钳制卡回）");

  // 56.14~56.15 天气走 setWeather，拒绝旧式 rain
  const w156 = y56.yanlingWeather("thunderstorm");
  assert(w156.ok === true && hitWeather.t === "thunderstorm" && hitWeather.inst === true, "56.14 天气走 window.setWeather(type, true)");
  const w256 = y56.yanlingWeather("rain");
  assert(w256.ok === false, "56.15 旧式 weather=\"rain\" 被拒（0.5 类型表无 rain，只有 heavyPrecipitation）");

  // 56.16~56.19 格威岚放逐 / 召回（scorned 线：state + 当日锁 + 9 天倒计时；召回清双倒计时）
  V.NPCNameList = ["Gwylan", "Kylar", "Whitney"];
  V.NPCName = [{ init: 1, state: "active" }, { init: 1, state: "active" }, { init: 1, state: "active" }];
  V.gwylan = { timer: {} }; V.daily = { gwylan: {} };
  const gb56 = y56.yanlingGwylanBanish();
  assert(gb56.ok === true && V.NPCName[0].state === "scorned", "56.16 格威岚放逐写 state=scorned");
  assert(V.gwylan.timer.scorned === 1000 + 9 * 86400, "56.17 放逐倒计时 = 今天 + 9 天（DateTime.addDays 路径）");
  assert(V.daily.gwylan.preventProgress === true, "56.18 放逐同时锁当日进度 preventProgress=true（对齐 402967-402970）");
  const gr56 = y56.yanlingGwylanRecall();
  assert(gr56.ok === true && V.NPCName[0].state === "active" && V.gwylan.timer.scorned === undefined && V.gwylan.timer.nobody === undefined, "56.19 召回 state=active 并清 scorned / nobody 双倒计时");

  // 56.20~56.21 凯拉尔 / 惠特尼 state 切换
  y56.yanlingKylar(true); y56.yanlingWhitney(true);
  assert(V.NPCName[1].state === "prison" && V.NPCName[2].state === "dungeon", "56.20 凯拉尔送监狱（prison）/ 惠特尼关地牢（dungeon）");
  y56.yanlingKylar(false); y56.yanlingWhitney(false);
  assert(V.NPCName[1].state === "active" && V.NPCName[2].state === "active", "56.21 两者均召回为 active");

  // 56.22 未相遇守卫
  V.NPCName[0].init = 0;
  const gz56 = y56.yanlingGwylanBanish();
  assert(gz56.ok === false && V.NPCName[0].state === "active", "56.22 init=0（未相遇）拒绝放逐且不改 state");

  global.window = origWin56;
  global.Time = origTime56;
} catch (e56) {
  failures++;
  console.error("FAIL: 56 言灵扩容测试异常: " + (e56 && e56.message ? e56.message : e56));
}


// ===== 57 回退语义补齐（v2.0.3）：世界入口解锁留痕 · 维护写入留痕 =====
try {
  const api57 = setup.mbStageCE;
  const V7 = global.V;

  // 57.1~57.4 世界入口（子路径型）：父对象原本缺失 → 逐层补壳 + before=undefined
  V7.mbCE_wrote = {};
  delete V7.compound;
  api57.applyWorldUnlock("elk_compound");
  assert(V7.compound && V7.compound.allowed === true, "57.1 compound.allowed 写入 true（父对象缺失时逐层补壳）");
  assert(V7.compound.discovered === true, "57.2 顺带补 compound.discovered=true");
  const rec57a = V7.mbCE_wrote["world:elk_compound:compound.allowed"];
  const rec57b = V7.mbCE_wrote["world:elk_compound:compound.discovered"];
  assert(rec57a && rec57a.type === "world" && rec57a.before === undefined && rec57a.after === true, "57.3 主键留痕：type=world / before=undefined / after=true");
  assert(rec57b && rec57b.before === undefined && rec57b.after === true, "57.4 discovered 亦留痕（before=undefined）");
  const t57a = rec57a.t;
  api57.applyWorldUnlock("elk_compound");
  assert(V7.mbCE_wrote["world:elk_compound:compound.allowed"].t === t57a, "57.5 重复调用幂等：值已到位不重写、留痕时间戳不变");

  // 57.6~57.7 撤回：before=undefined → 删字段；记录清除
  const u57a = api57.worldUndo("elk_compound");
  assert(u57a.ok === true && u57a.n === 2, "57.6 worldUndo 撤回 2 项世界入口写入");
  assert(V7.compound && !("allowed" in V7.compound) && !("discovered" in V7.compound), "57.7 before=undefined → 回退即删除两字段");
  assert(V7.mbCE_wrote["world:elk_compound:compound.allowed"] === undefined, "57.8 撤回后留痕记录清除");

  // 57.9~57.10 首次 before 语义：原本 false → 写 true → 撤回回 false（不是删除）
  V7.mbCE_wrote = {};
  V7.compound = { allowed: false };
  api57.applyWorldUnlock("elk_compound");
  assert(V7.compound.allowed === true, "57.9 原本 false 时写入 true");
  api57.worldUndo("elk_compound");
  assert(V7.compound.allowed === false, "57.10 before 保留首次写入前值 → 撤回还原 false（非删除）");

  // 57.11~57.12 平铺数值型 / 字符串型
  V7.mbCE_wrote = {};
  delete V7.syndromekylar;
  api57.applyWorldUnlock("kylar_manor");
  assert(V7.syndromekylar === 1, "57.11 平铺数值型 syndromekylar 写入 1");
  assert(V7.mbCE_wrote["world:kylar_manor:syndromekylar"] && V7.mbCE_wrote["world:kylar_manor:syndromekylar"].before === undefined, "57.12 平铺键同样留痕（before=undefined）");
  api57.worldUndo("kylar_manor");
  assert(!("syndromekylar" in V7) || V7.syndromekylar === undefined, "57.13 撤回后删除 syndromekylar");

  V7.mbCE_wrote = {};
  V7.adultshopstate = "";
  api57.applyWorldUnlock("sirris_places");
  assert(V7.adultshopstate === "open", "57.14 字符串型 adultshopstate 空值时写入 open");
  api57.worldUndo("sirris_places");
  assert(V7.adultshopstate === "", "57.15 撤回还原空串（原逻辑只补空值）");
  V7.adultshopstate = "closed";
  api57.applyWorldUnlock("sirris_places");
  assert(V7.adultshopstate === "closed" && !V7.mbCE_wrote["world:sirris_places:adultshopstate"], "57.15b 非空值（closed）不覆盖、不留痕（保持幂等语义）");

  // 57.16~57.18 维护写入：伊甸锁 4 幂等 + before 留痕 + 单键回退
  V7.mbCE_wrote = {};
  V7.edengarden = 2; V7.edenshrooms = 4; V7.edenspring = 0;
  const ed57 = api57.mcMaintainEden();
  assert(ed57.locked === 3 && V7.edengarden === 4 && V7.edenspring === 4, "57.16 伊甸三键锁 4（locked 计数保持原语义=3）");
  const rec57e = V7.mbCE_wrote["maint:edengarden"];
  assert(rec57e && rec57e.type === "maint" && rec57e.before === 2 && rec57e.after === 4, "57.17 maint:edengarden 留痕 before=2 / after=4");
  assert(V7.mbCE_wrote["maint:edenshrooms"] === undefined, "57.18 值已为 4 的键幂等不写、不留痕");
  const t57e = rec57e.t;
  api57.mcMaintainEden();
  assert(V7.mbCE_wrote["maint:edengarden"].t === t57e && V7.edengarden === 4, "57.19 再次维护幂等：值不变、留痕时间戳不变");
  api57.maintUndo("edengarden");
  assert(V7.edengarden === 2, "57.20 maintUndo 还原 edengarden=2");

  // 57.21~57.23 庄园打扫（嵌套路径）+ 全量回退
  V7.mbCE_wrote = {};
  V7.avery_fate = "saved";
  V7.avery_mansion = { pool: 3, kitchen: 5, days_absent: 7 };
  const cl57 = api57.mcCleanMansion();
  assert(cl57.rooms === 2 && V7.avery_mansion.pool === 0 && V7.avery_mansion.kitchen === 0 && V7.avery_mansion.days_absent === 0, "57.21 打扫清零房间与 days_absent");
  assert(V7.mbCE_wrote["maint:avery_mansion.pool"] && V7.mbCE_wrote["maint:avery_mansion.pool"].before === 3, "57.22 嵌套路径留痕 before=3");
  const ua57 = api57.maintUndoAll();
  assert(ua57.ok === true && ua57.n === 3 && V7.avery_mansion.pool === 3 && V7.avery_mansion.kitchen === 5 && V7.avery_mansion.days_absent === 7, "57.23 maintUndoAll 还原 3 项嵌套维护键");

  // 57.24~57.26 边界：未达标不写 / 宿主缺失不补壳 / 非数值键拒绝
  V7.mbCE_wrote = {};
  V7.housekeeping = 999; V7.tending = 0; V7.temple_quarters = 40; V7.temple_garden = 40;
  const tm57 = api57.mcMaintainTemple();
  assert(tm57.quarters === false && tm57.garden === false && V7.temple_quarters === 40, "57.24 技能未达标（999/0）不写、不留痕");
  delete V7.farm;
  assert(api57.maintWrite("farm.beasts.horses", 30) === false, "57.25 宿主缺失 → maintWrite 返回 false，不补壳");
  assert(!V7.farm, "57.26 宿主缺失时未创建空壳 farm 对象");

  delete V7.edengarden; delete V7.edenshrooms; delete V7.edenspring;
  delete V7.avery_fate; delete V7.avery_mansion;
  V7.mbCE_wrote = {};
} catch (e57) {
  failures++;
  console.error("FAIL: 57 回退语义补齐测试异常: " + (e57 && e57.message ? e57.message : e57));
}


// ===== 58 覆盖率补盲（v2.0.3 P0~P3）：战斗终结分支 · 扩展转化 · 原版阶段边界 · 潜伏者 · 数值固定 =====
try {
  const api58 = setup.mbStageCE;
  const V8 = global.V;
  const bk58 = {
    NPCName: V8.NPCName, gwylanSeen: V8.gwylanSeen, gwylan: V8.gwylan, wrote: V8.mbCE_wrote,
    tfSet: global.setup.myTFSet, tfParts: V8.transformationParts, lock: V8.mbCE_lock,
    temp: global.State.temporary, sets: global.setup.specialClothesSets, clothes: global.setup.specialClothes,
    li: V8.loveInterest, struggle: V8.struggle, tentacles: V8.tentacles
  };

  // 58.1~58.7 战斗终结：三条未覆盖动作 + 未知 key + 动作抛错
  delete V8.struggle;
  const c1 = api58.mcCombatAction("struggle");
  assert(c1.ok === true && !V8.struggle, "58.1 结束挣扎：struggle 缺失时静默成功且不建空壳");
  V8.struggle = { number: 3, done: 0 };
  api58.mcCombatAction("struggle");
  assert(V8.struggle.done === 4, "58.2 结束挣扎：done = number + 1（3→4）");
  delete V8.struggle;
  delete V8.tentacles;
  const c2 = api58.mcCombatAction("tentacle");
  assert(c2.ok === true && !V8.tentacles, "58.3 结束触手：tentacles 缺失时静默成功");
  V8.tentacles = { active: 2 };
  api58.mcCombatAction("tentacle");
  assert(V8.tentacles.active === 0, "58.4 结束触手：active 归零");
  delete V8.tentacles;
  api58.mcCombatAction("cluster");
  assert(V8.timer === 0 && V8.vorestage === 0 && V8.swimdistance === 0, "58.5 结束集群：计时/阶段/距离三键清零");
  const c3 = api58.mcCombatAction("no_such_action");
  assert(c3.ok === false && c3.message.indexOf("未知战斗操作") !== -1, "58.6 未知战斗操作给出明确拒绝（" + c3.message + "）");
  api58.COMBAT_ACTIONS.push({ key: "p4boom", name: "炸", run: function () { throw new Error("boom"); } });
  const c4 = api58.mcCombatAction("p4boom");
  api58.COMBAT_ACTIONS.pop();
  assert(c4.ok === false && c4.message.indexOf("执行失败") !== -1, "58.7 动作抛错被捕获为执行失败（" + c4.message + "）");
  delete V8.timer; delete V8.vorestage; delete V8.swimdistance;

  // 58.8~58.11 扩展转化：API 缺失早退 / transformationParts 兜底补位 / 非数值过滤 / 完成校验
  delete global.setup.myTFSet;
  assert(api58.listExtTransforms().length === 0, "58.8 myTFSet 缺失时 listExtTransforms 返回空（不误报扩展转化）");
  assert(api58.completeExtTransform("rabbit") === false, "58.9 myTFSet 缺失时 completeExtTransform 返回 false");
  global.setup.myTFSet = function (k, lv) { global.V[k] = lv; return true; };
  delete V8.transformationParts;
  V8.rabbit = 1;
  const ex1 = api58.listExtTransforms();
  assert(ex1.indexOf("rabbit") !== -1, "58.10 transformationParts 缺失时按 rabbit/mermaid 兜底补位（" + ex1.join(",") + "）");
  V8.rabbit = "notnum";
  assert(api58.listExtTransforms().length === 0, "58.11 同名键非数值时不计入扩展转化");
  delete V8.rabbit;
  V8.transformationParts = { rabbit: 1 };
  V8.rabbit = 1;
  assert(api58.completeExtTransform("rabbit") === true && V8.rabbit === 3, "58.12 扩展转化一键完成写入 stage=3 并回读确认");
  delete V8.rabbit; delete V8.transformationParts;

  // 58.13~58.20 原版恋爱阶段（格威岚）：三种 hasVanillaRomance 入口 + 未知阶段 / NPC 缺失 / 数值不足 / 达成
  V8.NPCName = [{ nam: "Gwylan", love: 0, dom: 0, lust: 0, wary: 0, state: "active", init: 1 }];
  V8.gwylanSeen = [];
  delete V8.gwylan;
  const r1 = api58.completeVanillaStage("Robin", "lust");
  assert(r1.ok === false && r1.message.indexOf("没有原版恋爱阶段系统") !== -1, "58.13 非格威岚角色拒绝（hasVanillaRomance=false）");
  const r2 = api58.completeVanillaStage("Gwylan", "no_such_stage");
  assert(r2.ok === false && r2.message.indexOf("未知阶段") !== -1, "58.14 未知阶段拒绝（" + r2.message + "）");
  const namesBk = V8.NPCName;
  V8.NPCName = [];
  const r3 = api58.completeVanillaStage("Gwylan", "ritual_sex");
  V8.NPCName = namesBk;
  assert(r3.ok === false && r3.message.indexOf("未找到该角色运行时对象") !== -1, "58.15 NPC 运行时对象缺失时拒绝写入");
  /* 第三入口：无 gwylanSeen / 无 gwylan 对象，仅 findNpc 命中（01-core.js:306 按 nam 匹配） */
  delete V8.gwylanSeen;
  delete V8.gwylan;
  assert(api58.getVanillaStages("Gwylan").length === 7, "58.16 findNpc 命中即视为原版恋爱角色（第三分支，返回 7 阶段）");
  V8.gwylan = { wary: 0 };
  assert(api58.getVanillaStages("Gwylan").length === 7, "58.17 V.gwylan 对象型入口同样成立（第二分支）");
  delete V8.gwylan;
  V8.gwylanSeen = [];
  /* 数值不足 → 孕育意愿不达成 */
  global.setup.specialClothesSets = {};
  global.setup.specialClothes = [];
  const r4 = api58.completeVanillaStage("Gwylan", "wantsPregnancy");
  assert(r4.ok === false && r4.message.indexOf("均未怀孕") !== -1, "58.18 数值不足时孕育意愿如实说明不达成（" + r4.message + "）");
  /* 数值充足 → 内置原版公式路径（vanillaComputeStatus）判达成 */
  global.setup.specialClothesSets = { f1: { shop: ["forest"] }, f2: { shop: ["forest"] } };
  global.setup.specialClothes = [{ name: "f1", sets: ["forest"] }, { name: "f2", sets: ["forest"] }];
  V8.specialClothes = [];
  V8.gwylanTalked = [];
  V8.gwylanSeen = [];
  const npc58 = V8.NPCName[0];
  npc58.dom = 200; npc58.lust = 100; npc58.state = "active";
  const r5 = api58.completeVanillaStage("Gwylan", "wantsPregnancy");
  assert(r5.ok === true && V8.specialClothes.length === 2 && V8.gwylanTalked.indexOf("f1") !== -1,
    "58.19 数值充足时孕育意愿达成，且森林套装/已聊套装自动补满（" + r5.message + "）");
  const st58 = global.State.temporary && global.State.temporary.gwylanStatus;
  assert(Array.isArray(st58) && st58.indexOf("lust") !== -1 && st58.indexOf("heat") !== -1 && st58.indexOf("wantsPregnancy") !== -1,
    "58.20 内置原版公式算出 lust/heat/wantsPregnancy（" + (Array.isArray(st58) ? st58.join(",") : "无") + "）");
  /* 面板痕迹：completeVanillaStage 成功必留 vanilla:<key> 痕迹 */
  assert(V8.mbCE_wrote && V8.mbCE_wrote["vanilla:wantsPregnancy"] && V8.mbCE_wrote["vanilla:wantsPregnancy"].type === "vanilla",
    "58.21 原版阶段完成写入 vanilla 留痕（可供统一回退中心识别）");

  // 58.22~58.26 undoVanillaStage / undoRomanceStage 的拒绝与还原边界
  const u1 = api58.undoVanillaStage("Gwylan", "heat");
  assert(u1.ok === false && u1.message.indexOf("实时计算") !== -1, "58.22 状态型阶段（heat）拒绝回退并说明原因");
  delete V8.mbCE_wrote["vanilla:ritual_sex"];
  const u2 = api58.undoVanillaStage("Gwylan", "ritual_sex");
  assert(u2.ok === false && u2.message.indexOf("真实达成") !== -1, "58.23 无面板痕迹（真实达成）拒绝回退");
  V8.mbCE_wrote["vanilla:ritual_sex"] = { type: "vanilla", key: "ritual_sex", npc: "Gwylan", t: Date.now() };
  const u3 = api58.undoVanillaStage("Gwylan", "ritual_sex");
  assert(u3.ok === true && V8.gwylanSeen.indexOf("ritual_sex") === -1 && !V8.mbCE_wrote["vanilla:ritual_sex"],
    "58.24 有痕迹的 seen 型阶段回退成功并清痕迹（" + u3.message + "）");
  V8.mbCE_wrote["vanilla:no_such_stage"] = { type: "vanilla", key: "no_such_stage", npc: "Gwylan", t: Date.now() };
  const u4 = api58.undoVanillaStage("Gwylan", "no_such_stage");
  delete V8.mbCE_wrote["vanilla:no_such_stage"];
  assert(u4.ok === false && u4.message.indexOf("未知阶段") !== -1, "58.25 有痕迹但阶段名未知时拒绝（" + u4.message + "）");
  V8.loveInterest = ["Gwylan", "Whitney"];
  V8.mbCE_wrote["romance:native:gwylan"] = { type: "native", t: Date.now() };
  const u5 = api58.undoRomanceStage("Gwylan", { native: true });
  assert(u5 === true && V8.loveInterest.length === 1 && V8.loveInterest[0] === "Whitney", "58.26 native 回退：数组型恋人卡槽按名移除");
  V8.loveInterest = { a: "Whitney", b: "Gwylan" };
  V8.mbCE_wrote["romance:native:gwylan"] = { type: "native", t: Date.now() };
  const u6 = api58.undoRomanceStage("Gwylan", { native: true });
  assert(u6 === true && !V8.loveInterest.b && V8.loveInterest.a === "Whitney", "58.27 native 回退：对象型恋人卡槽按值删除");

  // 58.28~58.34 潜伏者：状态读取 / 写入上限 / 自动搬运（含空手持与锁定优先）
  V8.lurkers_held = 3;
  V8.hookah = { lurkers: 2, juice: 1 };
  V8.lurkers_stored = 1;
  const ls58 = api58.mbCELurkerState();
  assert(ls58.ok === true && ls58.held === 3 && ls58.fridge === 2, "58.28 潜伏者状态读取 handheld/fridge 真值");
  assert(api58.MB_CE_LURKER_MAX === 9999, "58.29 潜伏者写入上限为防呆值 9999（原版无上限）");
  const set58 = api58.mbCELurkerSet("lurkers_held", 7);
  assert(set58.ok === true && V8.lurkers_held === 7, "58.30 潜伏者写入走 cheat 通道（留痕可回退）");
  V8.mbCE_lurkerAuto = true;
  V8.lurkers_held = 3; V8.hookah = { lurkers: 2 };
  const mv1 = api58.mbCELurkerAutoTick();
  assert(mv1 === 3 && V8.hookah.lurkers === 5 && V8.lurkers_held === 0, "58.31 自动搬运：手持转入冰箱（3→0，冰箱 2→5）");
  V8.lurkers_held = 0;
  assert(api58.mbCELurkerAutoTick() === 0, "58.32 自动搬运：手持为 0 时早退不搬运");
  delete V8.hookah;
  V8.lurkers_held = 2; V8.lurkers_stored = 1;
  const mv2 = api58.mbCELurkerAutoTick();
  assert(mv2 === 2 && V8.lurkers_stored === 3, "58.33 自动搬运：冰箱缺失时转入农场蒸馏笼（1→3）");
  V8.hookah = { lurkers: 0, juice: 1 };
  V8.lurkers_held = 4;
  api58.mbCELockSet("lurkers_held", 4);
  assert(api58.mbCELurkerAutoTick() === 0, "58.34 锁定优先：lurkers_held 被锁定时自动搬运不抢写");
  api58.mbCELockRemove("lurkers_held");
  const auto58 = api58.mbCELurkerSetAuto(false);
  assert(auto58.ok === true && V8.mbCE_lurkerAuto === false, "58.35 自动搬运开关可关闭（关闭即清定时器）");

  // 58.36~58.42 数值固定：路径校验 / 非数值拒绝 / 写入生效 / 只固定已存在键 / 移除
  const l1 = api58.mbCELockSet("a..b", 1);
  assert(l1.ok === false && l1.message.indexOf("空段") !== -1, "58.36 锁定路径存在空段时拒绝（防建脏键）");
  const l2 = api58.mbCELockSet("p4lock", "abc");
  assert(l2.ok === false && l2.message.indexOf("有限数值") !== -1, "58.37 锁定目标非有限数值时拒绝");
  V8.p4lock = 1;
  const l3 = api58.mbCELockSet("p4lock", 9);
  assert(l3.ok === true && V8.p4lock === 9 && api58.mbCELockHas("p4lock") === true, "58.38 锁定立即生效（点击即写，不等 tick）");
  assert(Array.isArray(V8.mbCE_lock) && V8.mbCE_lock[0] && V8.mbCE_lock[0].target === 9, "58.39 锁定目标可回读（清单项 target=9）");
  assert(api58.mbCELockRead({ a: { b: { c: 5 } } }, "a.b.c") === 5, "58.40 深路径读取命中嵌套值");
  V8.p4lock = 1;
  api58.mbCELockTick();
  assert(V8.p4lock === 9, "58.41 tick 强制写回锁定目标（1→9）");
  delete V8.p4lock;
  api58.mbCELockTick();
  assert(!("p4lock" in V8), "58.42 当前值缺失时 tick 跳过，不凭空创建键");
  const l4 = api58.mbCELockRemove("p4lock");
  assert(l4.ok === true && api58.mbCELockHas("p4lock") === false, "58.43 取消锁定后清单移除");
  const l5 = api58.mbCELockRemove("p4lock");
  assert(l5.ok === false && l5.message.indexOf("未锁定") !== -1, "58.44 未锁定路径取消时如实拒绝");
  assert(typeof api58.mbCELockLabel("history") === "string" && api58.mbCELockLabel("history").length > 0,
    "58.45 锁定文案走中文名/falback（history → " + api58.mbCELockLabel("history") + "）");

  // 58.46~58.62 v2.0.7（玩家拍板 P1/P2/R1–R4/D1–D6）：海岛组 · 锁定来源 · 岛屿直写 · 预览队列 · 锁定走预览 · 回退连带解锁 · 外观回退
  const g18 = api58.listPlaceGroups().filter(function (x) { return x.group.id === "island"; })[0];
  assert(!!g18 && g18.group.main === "Island" && g18.group.name.indexOf("海岛") === 0,
    "58.46 R3 海岛场景组存在（主场景 Island）, 实际 " + JSON.stringify(g18 && g18.group.main));

  assert(api58.mbCELockSource("zz.v207.src") === "手动", "58.47 P1 无来源线索时锁定来源判定「手动」");
  V8.mbCE_wrote = V8.mbCE_wrote || {};
  V8.mbCE_wrote["cheat:player-self:p:zz.v207.src"] = { type: "cheat", modId: "player-self", op: "value_set", path: "zz.v207.src", before: 0, after: 5, t: 900 };
  assert(api58.mbCELockSource("zz.v207.src") === "Mod作弊", "58.48 P1 命中 cheat 留痕时来源判定「Mod作弊」");

  delete V8.island;
  const sh = api58.mbCEIslandV();
  assert(!!sh && sh.island.home === "rocky_hillock" && Array.isArray(sh.island.explore_locations) &&
    !!sh.island.rocky_hillock && !!sh.island.waterfall && !!sh.island.gulch,
    "58.49 R3 无 $island 时建壳（home=rocky_hillock + 三处营地对象 + explore_locations 数组）");
  const wIsl = api58.mbCEPlaceWriteRaw("island.hide", 12, true);
  assert(wIsl.ok === true && V8.island.hide === 12, "58.50 R3 岛屿数值直写生效（hide=12）");
  assert(!!V8.mbCE_wrote["place:island.hide"] && V8.mbCE_wrote["place:island.hide"].before === 1,
    "58.51 R3 岛屿写入留痕保留首次旧值（before=1）");
  const ltA = api58.mbCEIslandLocToggle("bay", true);
  assert(ltA.ok === true && V8.island.explore_locations.indexOf("bay") !== -1, "58.52 R3 探索地点解锁入列（bay）");
  const ltB = api58.mbCEIslandLocToggle("bay", false);
  assert(ltB.ok === true && V8.island.explore_locations.indexOf("bay") === -1, "58.53 R3 探索地点可撤销出列（bay）");
  const sh2 = api58.mbCEIslandV();
  assert(!!sh2 && sh2.island.hide === 12, "58.54 R3 建壳幂等（已存在不覆盖进度）");

  const hu = api58.mbCEHideUndo("part:zz.v207");
  assert(!!hu && hu.ok === false, "58.55 R1/R2 无隐藏快照时外观回退如实拒绝");

  api58.mbCEUiSave({ diffPreview: "1" });
  assert(api58.mbCEPreviewCount() === 0, "58.56 D2 初始预览队列为空");
  let rA = 0; let rB = 0;
  const gA = api58.mbCEPreviewGate("zz.v207.a", 0, 1, function () { rA++; return { ok: true, message: "a" }; });
  const gB = api58.mbCEPreviewGate("zz.v207.b", 10, 20, function () { rB++; return { ok: true, message: "b" }; });
  assert(gA === true && gB === true && api58.mbCEPreviewCount() === 2,
    "58.57 D2 连续两次写入都入队（不再单槽覆盖）, 实际 " + api58.mbCEPreviewCount());
  const allR = api58.mbCEPreviewConfirmAll();
  assert(allR.ok === true && api58.mbCEPreviewCount() === 0 && rA === 1 && rB === 1,
    "58.58 D2「全部确认」一次落两笔（A/B 各重放一次）");
  assert(typeof api58.mbCEPaneRefresh === "function", "58.59 D5 提供按当前页签重渲染的分发器");

  V8.zzv207lock = 3;
  const gl = api58.mbCELockSet("zzv207lock", 8);
  assert(gl.ok === false && gl.pending === true && V8.zzv207lock === 3 && api58.mbCEPreviewCount() === 1,
    "58.60 D4 锁定同样走预览（未确认前不改值、不写锁表）");
  api58.mbCEPreviewCancel();
  api58.mbCEUiSave({ diffPreview: "0" });

  api58.mbCELockSet("zzv207lock", 5);
  V8.mbCE_wrote["cheat:player-self:p:zzv207lock"] = { type: "cheat", modId: "player-self", op: "value_set", path: "zzv207lock", before: 3, after: 5, t: 901 };
  const u207 = api58.undoOne("cheat:player-self:p:zzv207lock");
  assert(u207.ok === true && V8.zzv207lock === 3 && api58.mbCELockHas("zzv207lock") === false,
    "58.61 P2 回退作弊项时连带解除锁定（值回到 before=3 且锁表清空）");

  // 收尾：恢复全部被改动的既有状态
  V8.NPCName = bk58.NPCName;
  if (bk58.gwylanSeen === undefined) { delete V8.gwylanSeen; } else { V8.gwylanSeen = bk58.gwylanSeen; }
  if (bk58.gwylan === undefined) { delete V8.gwylan; } else { V8.gwylan = bk58.gwylan; }
  if (bk58.wrote === undefined) { delete V8.mbCE_wrote; } else { V8.mbCE_wrote = bk58.wrote; }
  if (bk58.tfSet === undefined) { delete global.setup.myTFSet; } else { global.setup.myTFSet = bk58.tfSet; }
  if (bk58.tfParts === undefined) { delete V8.transformationParts; } else { V8.transformationParts = bk58.tfParts; }
  if (bk58.lock === undefined) { delete V8.mbCE_lock; } else { V8.mbCE_lock = bk58.lock; }
  if (bk58.temp === undefined) { delete global.State.temporary; } else { global.State.temporary = bk58.temp; }
  if (bk58.sets === undefined) { delete global.setup.specialClothesSets; } else { global.setup.specialClothesSets = bk58.sets; }
  if (bk58.clothes === undefined) { delete global.setup.specialClothes; } else { global.setup.specialClothes = bk58.clothes; }
  if (bk58.li === undefined) { delete V8.loveInterest; } else { V8.loveInterest = bk58.li; }
  if (bk58.struggle === undefined) { delete V8.struggle; } else { V8.struggle = bk58.struggle; }
  if (bk58.tentacles === undefined) { delete V8.tentacles; } else { V8.tentacles = bk58.tentacles; }
  delete V8.specialClothes; delete V8.gwylanTalked;
  delete V8.lurkers_held; delete V8.lurkers_stored; delete V8.hookah; delete V8.mbCE_lurkerAuto; delete V8.mbCE_lurkerMoved;
  delete V8.timer; delete V8.vorestage; delete V8.swimdistance;
  /* v2.0.7 新断言用到的临时键/壳（海岛壳 / 临时锁定路径 / 外观隐藏快照） */
  delete V8.zzv207lock; delete V8.island; delete V8.mbCE_hideSnap;
} catch (e58) {
  failures++;
  console.error("FAIL: 58 覆盖率补盲测试异常: " + (e58 && e58.message ? e58.message : e58));
}

// ===== 59 覆盖率补盲（v2.0.3 P1~P3 续）：言灵运行期钩子 · FertilityExpansion API · 潜伏者解限补丁 · 面板状态持久化 =====
try {
  const api59 = setup.mbStageCE;
  const V9 = global.V;
  const bk59 = { yanling: V9.mbCE_yanling, wrote: V9.mbCE_wrote, cheats: V9.cheatsEnabled, eden: V9.eden, win: global.window, ls: global.localStorage };

  // 59.1~59.8 言灵：钩子安装/拦截/透传/幂等/卸载/同步
  assert(api59.yanlingInstall() === false, "59.1 无 window 环境时钩子安装安全返回 false");
  assert(api59.yanlingUninstall() === true, "59.2 无 window 时卸载幂等成功");
  global.window = global.window || {};
  delete global.window.isCrossdressing;
  assert(api59.yanlingInstall() === false, "59.3 上游 isCrossdressing 非函数时拒绝安装");
  let up59 = 0;
  const upFn59 = function () { up59++; return true; };
  global.window.isCrossdressing = upFn59;
  V9.mbCE_yanling = { noCross: true, noTrait: false };
  assert(api59.yanlingInstall() === true, "59.4 上游存在时安装钩子成功");
  assert(global.window.isCrossdressing() === false && up59 === 0, "59.5 开关开启时钩子恒 false 且不调用上游");
  assert(api59.yanlingInstall() === true, "59.6 重复安装幂等（已装则直接返回 true）");
  V9.mbCE_yanling.noCross = false;
  assert(global.window.isCrossdressing() === true && up59 === 1, "59.7 开关关闭时透传上游原值");
  assert(api59.yanlingSync() === true, "59.8 同步：关闭状态下走卸载分支");
  assert(global.window.isCrossdressing === upFn59, "59.9 卸载后 window 恢复为上游原函数（不留包装层）");
  V9.mbCE_yanling = { noCross: true, noTrait: false };
  assert(api59.yanlingSync() === true && global.window.isCrossdressing !== upFn59, "59.10 同步：开启状态自动挂钩子");

  // 59.11~59.15 言灵存量净化三项
  V9.mbCE_wrote = {};
  V9.crossdressing = 1; V9.schoolrep = { crossdress: 2, herm: 3 }; V9.school_crossdress_message = "x"; V9.school_herm_message = "y";
  const pc59 = api59.yanlingPurgeCross();
  assert(pc59.ok === true && V9.crossdressing === 0 && V9.schoolrep.crossdress === 0 && V9.school_crossdress_message === undefined,
    "59.11 异装净化：crossdressing/schoolrep/学校文案三处清零");
  assert(V9.mbCE_wrote["yanling:purge_cross"] && V9.mbCE_wrote["yanling:purge_cross"].before.crossdressing === 1,
    "59.12 净化留痕记录 before=1（可回退中心可见）");
  V9.crossdressingTrait = 88; V9.backgroundTraits = ["crossdresser", "other", "crossdresser"];
  const pt59 = api59.yanlingPurgeTrait();
  assert(pt59.ok === true && V9.crossdressingTrait === 0 && V9.backgroundTraits.join(",") === "other",
    "59.13 异装癖净化：进度归零 + 重复特质全部移除");
  V9.fame = { sex: 5, rape: 3, good: 10 }; V9.fameDecay = { sex: 1 }; V9.fameDecayTimer = { rape: 2 };
  const pf59 = api59.yanlingPurgeFame();
  assert(pf59.ok === true && V9.fame.sex === 0 && V9.fame.rape === 0 && V9.fame.good === 10 && V9.schoolrep.herm === 0,
    "59.14 负面名声清零：只清负面项、正面项不动（" + pf59.msg + "）");
  assert(!V9.fameDecay.sex && !V9.fameDecayTimer.rape, "59.15 负面名声清零同步删除衰减队列项");
  const mf59 = api59.yanlingMaxFame();
  assert(mf59.ok === true && V9.fame.good === 2000 && V9.fame.business === 2000, "59.16 正面名声拉满 5 项各 2000");
  delete V9.fame;
  const mf59b = api59.yanlingMaxFame();
  assert(mf59b.ok === false && mf59b.msg.indexOf("无 $fame") !== -1, "59.17 $fame 缺失时如实拒绝（不凭空建名声对象）");

  // 59.18~59.26 FertilityExpansion 自带作弊 API 桥接
  global.window = global.window || {};
  delete global.window.EdenCheats;
  assert(api59.mbCEFertReady().ok === false, "59.18 未装模组（无 window.EdenCheats）时明示不可用");
  assert(api59.mbCEFertChildren().length === 0, "59.19 无 API 时孩子清单为空（不抛错）");
  let calls59 = [];
  global.window.EdenCheats = {
    available: function () { return false; },
    children: function () { return [["0", { name: "Tracey", gender: "f" }]]; },
    labour: function () { calls59.push("labour"); return { ok: true, message: "已推进到破水" }; },
    parasites: function (fert) { calls59.push("parasites:" + fert); return { ok: true }; },
    saveInnate: function (id, p) { calls59.push("innate:" + id); return { ok: true }; },
    saveSkills: function (id) { calls59.push("skills:" + id); return { ok: true }; },
    reset: function (id) { calls59.push("reset:" + id); return { ok: true }; },
    settleAdult: function (id) { calls59.push("adult:" + id); return { ok: true }; },
    removeChild: function (id) { calls59.push("remove:" + id); return { ok: true }; },
    resetReason: function () { return "生产流程进行中"; },
    adultReason: function () { return ""; }
  };
  const fr59 = api59.mbCEFertReady();
  assert(fr59.ok === true && fr59.bypass === true, "59.20 available() 为假时仍可用，但标记 bypass=true（说明红字来源）");
  assert(api59.mbCEFertChildren().length === 1, "59.21 孩子清单直连模组 API（1 条）");
  assert(api59.mbCEFertRun("fert_labour").ok === true && calls59.indexOf("labour") !== -1, "59.22 一键分娩转发模组 labour()");
  assert(!("cheatsEnabled" in V9), "59.23 调用期间临时置位 cheatsEnabled，返回后还原（不污染存档）");
  const ar59 = api59.mbCEFertRun("fert_adult_reason", "0");
  assert(ar59.ok === true && ar59.message.indexOf("可以成年结算") !== -1, "59.24 只读查询：无阻塞前置时给出可结算结论");
  const rr59 = api59.mbCEFertRun("fert_reset_reason", "0");
  assert(rr59.ok === true && rr59.message.indexOf("不可重置") !== -1, "59.25 只读查询：有阻塞前置时回传模组原因（" + rr59.message + "）");
  const noId59 = api59.mbCEFertRun("fert_innate");
  assert(noId59.ok === false && noId59.message.indexOf("请先选择") !== -1, "59.26 孩子级动作缺 id 时拒绝");
  const unk59 = api59.mbCEFertRun("fert_no_such", "0");
  assert(unk59.ok === false && unk59.message.indexOf("未知动作") !== -1, "59.27 未知动作如实拒绝");
  global.window.EdenCheats.labour = function () { throw new Error("模组内闸拒绝"); };
  const boom59 = api59.mbCEFertRun("fert_labour");
  assert(boom59.ok === false && boom59.message.indexOf("模组 API 抛出异常") !== -1, "59.28 模组 API 抛错被捕获并原文回传（" + boom59.message + "）");
  global.window.EdenCheats.available = function () { throw new Error("available 炸了"); };
  const fava = api59.mbCEFertReady();
  assert(fava.ok === true && fava.bypass === true, "59.29 available() 自身抛错按不可用处理，不影响调用（bypass=true）");

  // 59.30~59.38 潜伏者解限补丁：纯文本替换 / 幂等 / 通道缺失 / Story 通道 / 汇总
  const FARM59 = "行首 $farm_stage gte 10 and $lurkers_held lt 1 结句";
  const ptxt59 = api59.mbCELurkerPatchText("Farm Yard", FARM59);
  assert(ptxt59.hits === 1 && ptxt59.kept === 1 && ptxt59.text.indexOf("and $lurkers_held lt 1") === -1 && ptxt59.text.indexOf("$farm_stage gte 10 ") !== -1,
    "59.30 纯文本替换：捕捉门控去掉手持上限条件");
  assert(ptxt59.text.length === FARM59.length, "59.30a 替换后字符数不变（" + ptxt59.text.length + " == " + FARM59.length + "，汉化锚点靠 pos 定位）");
  const ptxt59b = api59.mbCELurkerPatchText("Farm Yard", ptxt59.text);
  assert(ptxt59b.hits === 0, "59.31 幂等：已替换过的文本再跑 hits=0");
  assert(api59.mbCELurkerPatchText("No Such Passage", FARM59).hits === 0, "59.32 未登记的 passage 不改动");
  const SW59 = "前 <<switch $hookah.lurkers>> <<case 1>>1<<default>>no<</switch>> 后";
  const sw59 = api59.mbCELurkerPatchText("Widgets Flats", SW59);
  assert(sw59.hits === 1 && sw59.text.indexOf("<<switch") === -1 && sw59.text.indexOf("gt 0 ? $hookah.lurkers") !== -1,
    "59.33 冰箱显示：switch 段整体换成真实数值表达式（>5 不再落到 no）");
  /* 59.33a/b 汉化在场（window.modI18N）时：switch 整块必须原样保留，否则 6 条 span 译文锚点被物理删除 → 整段落回英文 */
  global.window.modI18N = { fake: true };
  const sw59b = api59.mbCELurkerPatchText("Widgets Flats", SW59);
  assert(sw59b.hits === 0 && sw59b.skipped === 1 && sw59b.text === SW59,
    "59.33a 汉化在场：switch 原样保留（skipped=1, 文本未变）");
  const gate59b = api59.mbCELurkerPatchText("Farm Yard", FARM59);
  assert(gate59b.hits === 1 && gate59b.text.length === FARM59.length,
    "59.33b 汉化在场：门控仍按长度守恒替换（不因汉化而失效）");
  delete global.window.modI18N;
  const dom59 = api59.mbCELurkerPatchDom();
  assert(dom59.ok === false && dom59.channel === "dom", "59.34 无 document 环境时 DOM 通道安全降级（不抛错）");
  const st59 = api59.mbCELurkerPatchStory();
  assert(st59.ok === false && st59.access === "none", "59.35 无 Story/SugarCube 通道时如实标注 access=none");
  global.Story = { get: function (n) { return (n === "Farm Yard") ? { text: FARM59 } : null; } };
  const st59b = api59.mbCELurkerPatchStory();
  assert(st59b.ok === true && st59b.access === "Story" && st59b.hits === 1, "59.36 Story 通道命中 1 处（运行期兜底生效）");
  const rep59 = api59.mbCELurkerPatchReport();
  assert(rep59 && rep59.hits >= 1, "59.37 补丁汇总报告累计 hits（供面板状态行显示）");
  const rp59 = api59.mbCELurkerRepatch();
  assert(typeof rp59.message === "string" && rp59.message.indexOf("解限补丁") !== -1, "59.38 重新应用补丁返回可读结论（" + rp59.message.slice(0, 40) + "…）");
  delete global.Story;

  // 59.39~59.42 面板状态持久化与主题
  const mem59 = {};
  global.localStorage = {
    getItem: function (k) { return mem59[k] === undefined ? null : mem59[k]; },
    setItem: function (k, v) { mem59[k] = String(v); }
  };
  api59.mbCEUiSave({ tab: "mods", theme: "starry", filter: "abc" });
  const key59 = Object.keys(mem59)[0];
  assert(key59 && mem59[key59].indexOf('"tab":"mods"') !== -1 && mem59[key59].indexOf('"theme":"starry"') !== -1,
    "59.40 面板状态写入 localStorage（页签/主题/搜索词同一条）");
  api59.mbCEUiLoad();
  assert(api59.getTheme() === "gold" || api59.getTheme() === "starry", "59.41 读回状态不抛错（getTheme 返回合法值 " + api59.getTheme() + "）");
  assert(api59.setTheme("starry") === "starry" && api59.getTheme() === "starry", "59.42 切星空蓝主题生效并回读");
  assert(api59.setTheme("bogus") === "gold" && api59.getTheme() === "gold", "59.43 非法主题名回落 gold（不写入脏值）");

  // 59.44~59.50 回退中心键→中文名（08e-undo-labels）：截图里 8 个裸键必须落到汉字，且兜底不返回空
  assert(api59.undoItemName("cheat:player-self:p:prof.spray", { path: "prof.spray" }) === "防狼喷雾",
    "59.44 cheat 玩家自身路径名（prof.spray→防狼喷雾）, " + api59.undoItemName("cheat:player-self:p:prof.spray", { path: "prof.spray" }));
  assert(api59.undoItemName("place:town_projects.green", { path: "town_projects.green" }).indexOf("绿地") !== -1,
    "59.45 place 项名带分组中文（绿地），" + api59.undoItemName("place:town_projects.green", {}));
  assert(api59.undoItemName("maint:temple_quarters", {}) === "神殿宿舍清洁",
    "59.46 maint 维护键中文（temple_quarters）, " + api59.undoItemName("maint:temple_quarters", {}));
  assert(api59.undoItemName("yanling:purge_cross", {}) === "异装与校规记录清除",
    "59.47 yanling op 中文（purge_cross）, " + api59.undoItemName("yanling:purge_cross", {}));
  assert(api59.undoItemName("weird:unknown_key", {}) === "unknown_key", "59.48 未知命名空间兜底原键体（不返回空）");
  assert(api59.undoItemName("", {}) === "", "59.49 空键不抛错");
  const dw59 = api59.undoItemName("cheat:deadwood-reblooms:stage_set:r_shop_stage", { path: "RobinExpansion.shop_stage" });
  assert(dw59.indexOf("店铺开办阶段") !== -1, "59.50 适配器 entry 反查行名（枯木 r_shop_stage）, " + dw59);

  // 收尾
  if (bk59.yanling === undefined) { delete V9.mbCE_yanling; } else { V9.mbCE_yanling = bk59.yanling; }
  if (bk59.wrote === undefined) { delete V9.mbCE_wrote; } else { V9.mbCE_wrote = bk59.wrote; }
  if (bk59.cheats === undefined) { delete V9.cheatsEnabled; } else { V9.cheatsEnabled = bk59.cheats; }
  if (bk59.eden === undefined) { delete V9.eden; } else { V9.eden = bk59.eden; }
  delete V9.crossdressing; delete V9.crossdressingTrait; delete V9.backgroundTraits;
  delete V9.schoolrep; delete V9.school_crossdress_message; delete V9.school_herm_message;
  delete V9.fame; delete V9.fameDecay; delete V9.fameDecayTimer;
  if (bk59.win === undefined) { delete global.window; } else { global.window = bk59.win; }
  if (bk59.ls === undefined) { delete global.localStorage; } else { global.localStorage = bk59.ls; }
} catch (e59) {
  failures++;
  console.error("FAIL: 59 覆盖率补盲测试异常: " + (e59 && e59.message ? e59.message : e59));
}

// ===== 60 v2.0.7 新增分支覆盖（R1/R2 外观隐藏 · R3 小岛直写 · D1 裸写走预览）=====
try {
  const api60 = setup.mbStageCE;
  const V60 = global.V;
  const bk60 = {
    tp: V60.transformationParts, hide: V60.mbCE_hide, snap: V60.mbCE_hideSnap,
    island: V60.island, ub: V60.undergroundbrothel, trauma: V60.trauma, wrote: V60.mbCE_wrote
  };

  // 60.1~60.9 目标枚举与拒绝分支
  V60.transformationParts = {
    traits: { fangs: "default", sharpEyes: "hidden", chase: "disabled", fakeN: 5 },
    bird: { wings: "default" }, demon: { wings: "hidden" }, angel: {}, wolf: { ears: "hidden" }
  };
  assert(api60.MB_CE_HIDE_WINGS_SPECIES.length === 4, "60.1 翅膀物种清单 4 项（bird/angel/fallenAngel/demon）");
  const innerOn = api60.mbCEHideApply("inner", true);
  assert(innerOn.ok === true && V60.transformationParts.traits.fangs === "hidden" &&
    V60.transformationParts.traits.sharpEyes === "hidden" && V60.transformationParts.traits.chase === "disabled",
    "60.2 隐藏内在：default→hidden，已隐藏跳过，disabled 不动");
  assert(V60.transformationParts.traits.fakeN === 5, "60.3 非字符串部件值被跳过（不强行改成 hidden）");
  const wingsOn = api60.mbCEHideApply("wings", true);
  assert(wingsOn.ok === true && V60.transformationParts.bird.wings === "hidden" &&
    V60.transformationParts.demon.wings === "hidden" && !V60.transformationParts.angel.wings,
    "60.4 隐藏翅膀：只命中有 wings 字符串的物种（不凭空造字段）");
  const wingsOff = api60.mbCEHideApply("wings", false);
  assert(wingsOff.ok === true && V60.transformationParts.bird.wings === "default",
    "60.5 取消隐藏翅膀：hidden→default");
  const innerOff = api60.mbCEHideApply("inner", false);
  assert(innerOff.ok === true && V60.transformationParts.traits.fangs === "default" &&
    V60.transformationParts.traits.chase === "disabled",
    "60.6 取消隐藏内在：只还原 hidden，disabled 保持不动");
  V60.transformationParts = { bird: { wings: "" } };
  const noTraits = api60.mbCEHideApply("inner", true);
  assert(noTraits.ok === false && noTraits.message.indexOf("traits") !== -1, "60.7 无 traits 时拒绝（文案点明 traits）");
  V60.transformationParts = { bird: {}, demon: {} };
  const noWings = api60.mbCEHideApply("wings", true);
  assert(noWings.ok === false && noWings.message.indexOf("四系翅膀") !== -1, "60.8 四系翅膀字段全空时拒绝（wings 分支文案）");
  delete V60.transformationParts;
  const noParts = api60.mbCEHideApply("inner", true);
  assert(noParts.ok === false && noParts.message.indexOf("转化数据尚未建立") !== -1,
    "60.9 无转化部件表时拒绝并给出引导");

  // 60.10~60.11 快照语义
  V60.transformationParts = { traits: { fangs: "default" } };
  delete V60.mbCE_hideSnap; delete V60.mbCE_hide;
  api60.mbCEHideApply("inner", true);
  assert(!!V60.mbCE_hideSnap && V60.mbCE_hideSnap.traits.fangs === "default",
    "60.10 首次改动前存快照（记录隐藏前原值 default）");
  const snapRef = V60.mbCE_hideSnap;
  V60.transformationParts.traits.fangs = "default";
  api60.mbCEHideApply("inner", true);
  assert(V60.mbCE_hideSnap === snapRef, "60.11 二次改动复用同一份快照（不重复深拷贝）");

  // 60.12~60.16 强制保持隐藏 tick / 开关
  assert(api60.mbCEHideTick() === 0, "60.12 force 未开启时 tick 空转返回 0");
  const fcOn60 = api60.mbCEHideForce(true);
  assert(fcOn60.ok === true && fcOn60.message.indexOf("已开启") !== -1, "60.13 强制保持可开启");
  V60.transformationParts.traits.fangs = "default";
  const fixedN = api60.mbCEHideTick();
  assert(fixedN >= 1 && V60.transformationParts.traits.fangs === "hidden",
    "60.14 被原版打回 default 的部件立即复位 hidden, fixed=" + fixedN);
  V60.mbCE_hide.force = false;
  V60.transformationParts.traits.fangs = "default";
  assert(api60.mbCEHideTick() === 0 && V60.transformationParts.traits.fangs === "default",
    "60.15 force 关掉后 tick 不再干预");
  V60.mbCE_hide.force = true;
  V60.mbCE_hide.inner = false; V60.mbCE_hide.wings = false;
  V60.transformationParts = { traits: { fangs: "default" } };
  assert(api60.mbCEHideTick() === 0, "60.16 类别未开启时 tick 不写（hs[kind] 假分支）");
  const fcOff60 = api60.mbCEHideForce(false);
  assert(fcOff60.ok === true && fcOff60.message.indexOf("已关闭") !== -1, "60.17 强制保持可关闭");

  // 60.18~60.21 隐藏无惩罚（锁 trauma=0）
  delete V60.trauma;
  const npOn60 = api60.mbCEHideNoPenalty(true);
  assert(npOn60.ok === true && api60.mbCELockHas("trauma") === true, "60.18 隐藏无惩罚：锁定 trauma=0");
  const npDup60 = api60.mbCEHideNoPenalty(true);
  assert(npDup60.ok === true && npDup60.message.indexOf("已处于锁定") !== -1, "60.19 重复开启幂等（不重复建锁定）");
  const npOff60 = api60.mbCEHideNoPenalty(false);
  assert(npOff60.ok === true && api60.mbCELockHas("trauma") === false, "60.20 关闭无惩罚：解除 trauma 锁定");
  const npIdle60 = api60.mbCEHideNoPenalty(false);
  assert(npIdle60.ok === true && npIdle60.message.indexOf("未锁定") !== -1, "60.21 已是关闭态时幂等");

  // 60.22 外观整体回退
  V60.transformationParts = { traits: { fangs: "default" } };
  delete V60.mbCE_hideSnap; V60.mbCE_wrote = {};
  api60.mbCEHideApply("inner", true);
  const undo60 = api60.mbCEHideUndo("part:inner");
  assert(undo60.ok === true && V60.transformationParts.traits.fangs === "default" && !V60.mbCE_wrote["part:inner"],
    "60.22 外观回退：整体还原快照并清掉留痕条目");

  // 60.23~60.25 裸写路径校验
  const badPath60 = api60.mbCEPlaceWriteRaw("", 1);
  assert(badPath60.ok === false && badPath60.message.indexOf("路径无效") !== -1, "60.23 空路径拒绝");
  const badHost60 = api60.mbCEPlaceWriteRaw("zz.nope.deep", 1);
  assert(badHost60.ok === false && badHost60.message.indexOf("宿主不存在") !== -1, "60.24 父链不存在拒绝（不造中间对象）");

  // 60.25~60.27 壳自修复
  delete V60.island;
  api60.mbCEIslandV();
  V60.island.home = "undefined";
  V60.island.explore_locations = "broken";
  delete V60.island.gulch;
  const fixedIsl = api60.mbCEIslandV();
  assert(fixedIsl.island.home === "rocky_hillock" && Array.isArray(fixedIsl.island.explore_locations) &&
    !!fixedIsl.island.gulch && typeof fixedIsl.island.gulch === "object",
    "60.25 壳自修复：home=\"undefined\" / 非数组地点 / 缺失营子对象全部补回");
  V60.island.hide = 1;
  const firstW60 = api60.mbCEPlaceWriteRaw("island.hide", 12, true);
  assert(firstW60.ok === true && V60.island.hide === 12 && V60.mbCE_wrote["place:island.hide"].before === 1,
    "60.26 首次写入留痕记录写入前旧值（before=1）");
  const sameW60 = api60.mbCEPlaceWriteRaw("island.hide", 12, true);
  assert(sameW60.ok === true && sameW60.message.indexOf("值未变化") !== -1, "60.27 同值写入短路（不产生新留痕）");
  const chgW60 = api60.mbCEPlaceWriteRaw("island.hide", 5, true);
  assert(chgW60.ok === true && V60.island.hide === 5 && V60.mbCE_wrote["place:island.hide"].before === 1,
    "60.28 二次写入沿用首次 before（before 保持 1，回退仍回到最初值）");

  // 60.28~60.30 地点开关幂等
  const locOn60 = api60.mbCEIslandLocToggle("bay", true);
  assert(locOn60.ok === true && V60.island.explore_locations.indexOf("bay") !== -1, "60.29 地点解锁入列");
  const locDup60 = api60.mbCEIslandLocToggle("bay", true);
  assert(locDup60.ok === true && locDup60.message.indexOf("未变化") !== -1, "60.30 重复解锁幂等（不重复 push）");
  const locIdle60 = api60.mbCEIslandLocToggle("castle", false);
  assert(locIdle60.ok === true && locIdle60.message.indexOf("未变化") !== -1, "60.31 移除未解锁项幂等");

  // 60.31~60.32 数值钳制 + 裸写走预览
  const numW60 = api60.mbCEIslandNumWrite({ path: "island.hide", max: 30 }, 20);
  assert(numW60.ok === true && V60.island.hide === 20, "60.32 岛屿数值写入走地点阶段通道（钳制 [0, max]）");
  const numClamp60 = api60.mbCEIslandNumWrite({ path: "island.hide", max: 30 }, 999);
  assert(numClamp60.ok === true && V60.island.hide === 30, "60.33 超上限钳制到 max=30");
  api60.mbCEUiSave({ diffPreview: "1" });
  const gated60 = api60.mbCEPlaceWriteRaw("island.walnut", 7, false);
  assert(gated60.ok === false && gated60.pending === true && V60.island.walnut === 0,
    "60.34 D1 裸写（岛屿/地下字符串）同样受预览门控");
  api60.mbCEPreviewCancel();
  api60.mbCEUiSave({ diffPreview: "0" });

  // 60.35~60.36 目标枚举的空输入 / 空物种字段
  assert(api60.mbCEHideTargets(null, "inner").length === 0 && api60.mbCEHideTargets(null, "wings").length === 0,
    "60.35 目标枚举对空 parts 返回空数组（走 !parts 早退）");
  V60.transformationParts = { bird: null, demon: { wings: "default" }, fallenAngel: { wings: 5 } };
  const wingsNull60 = api60.mbCEHideApply("wings", true);
  assert(wingsNull60.ok === true && V60.transformationParts.demon.wings === "hidden",
    "60.36 物种字段为 null / wings 非字符串时跳过（只命中合法项）");

  // 60.37~60.40 渲染入口无 pane 安全早退 + 队列空态
  let paneGuard60 = 0;
  try {
    api60.renderTransformHideSec(undefined); paneGuard60++;
    api60.renderIslandSec(undefined); paneGuard60++;
    api60.renderNpcUndergroundSec(undefined); paneGuard60++;
  } catch (eR60) { paneGuard60 = -1; }
  assert(paneGuard60 === 3, "60.37 三个渲染入口传空 pane 均安全早退（不抛错）");
  assert(api60.mbCEPreviewConfirmAll().ok === false, "60.38 队列空时「全部确认」返回失败文案（不写档）");
  const failPrev60 = api60.mbCEPlaceWriteRaw("zz.missing.host", 5);
  assert(failPrev60.ok === false && failPrev60.pending !== true, "60.39 父链缺失的裸写直接被拒（不进预览队列）");
  api60.mbCEUiSave({ diffPreview: "1" });
  const pendFail60 = api60.mbCEPlaceWriteRaw("island.hide", 4);
  assert(pendFail60.pending === true && api60.mbCEPreviewCount() === 1, "60.40 开启预览后写入进待确认队列（1 笔，值未落档）");
  assert(V60.island.hide === 30, "60.41 待确认期间原值不动（仍为 30）");
  delete V60.island;
  const allFail60 = api60.mbCEPreviewConfirmAll();
  assert(allFail60.ok === false && allFail60.message.indexOf("失败 1 项") !== -1,
    "60.42 确认时宿主已消失 → 计入失败项（" + allFail60.message + "）");
  api60.mbCEUiSave({ diffPreview: "0" });

  // 收尾（force 必须关，否则 1s 定时器挂住进程）
  try { api60.mbCEHideForce(false); api60.mbCEHideTick(); } catch (eC60) {}
  if (bk60.tp === undefined) { delete V60.transformationParts; } else { V60.transformationParts = bk60.tp; }
  if (bk60.hide === undefined) { delete V60.mbCE_hide; } else { V60.mbCE_hide = bk60.hide; }
  if (bk60.snap === undefined) { delete V60.mbCE_hideSnap; } else { V60.mbCE_hideSnap = bk60.snap; }
  if (bk60.island === undefined) { delete V60.island; } else { V60.island = bk60.island; }
  if (bk60.ub === undefined) { delete V60.undergroundbrothel; } else { V60.undergroundbrothel = bk60.ub; }
  if (bk60.trauma === undefined) { delete V60.trauma; } else { V60.trauma = bk60.trauma; }
  if (bk60.wrote === undefined) { delete V60.mbCE_wrote; } else { V60.mbCE_wrote = bk60.wrote; }
} catch (e60) {
  failures++;
  console.error("FAIL: 60 v2.0.7 分支覆盖测试异常: " + (e60 && e60.message ? e60.message : e60));
}

// ===== 61 v2.0.7 收尾三项（P3 潜伏者锁优先 · P4 锁定写回留痕可回退）=====
try {
  const api61 = setup.mbStageCE;
  const V61 = global.V;
  const bk61 = {
    lock: V61.mbCE_lock, wrote: V61.mbCE_wrote, held: V61.lurkers_held, hookah: V61.hookah,
    stored: V61.lurkers_stored, auto: V61.mbCE_lurkerAuto, moved: V61.mbCE_lurkerMoved, probe: V61.mceProbe61
  };

  // 61.1~61.4 锁定写回落留痕（同 path 复用一条，before 恒为首次覆盖前的真实值）
  V61.mbCE_wrote = {};
  V61.mbCE_lock = [{ path: "mceProbe61", target: 1000 }];
  V61.mceProbe61 = 50;
  api61.mbCELockTick();
  const rec611 = V61.mbCE_wrote["lock:mceProbe61"];
  assert(V61.mceProbe61 === 1000 && !!rec611 && rec611.type === "lock" && rec611.before === 50 && rec611.after === 1000,
    "61.1 锁定写回：值固定到目标，并落 lock:<path> 留痕（before 记锁定前真实值）");
  V61.mceProbe61 = 30; /* 模拟游戏机制把值改回去 */
  api61.mbCELockTick();
  assert(V61.mceProbe61 === 1000 && V61.mbCE_wrote["lock:mceProbe61"].before === 50 &&
    Object.keys(V61.mbCE_wrote).length === 1,
    "61.2 反复写回复用同一条留痕（before 不被二次覆盖、条数不增长）");
  api61.mbCELockTick();
  assert(V61.mbCE_wrote["lock:mceProbe61"].after === 1000 && V61.mbCE_wrote["lock:mceProbe61"].t > 0,
    "61.3 值已等于目标时不再重复写，留痕保留 after/t 供回退");
  V61.mbCE_lock = [{ path: "mceProbe61b", target: 7 }];
  api61.mbCELockTick();
  assert(V61.mceProbe61b === undefined && !V61.mbCE_wrote["lock:mceProbe61b"],
    "61.4 目标键不存在时跳过：不凭空造字段、不留痕");

  // 61.5~61.7 回退 lock 留痕（先解锁定再还原，标签同步）
  assert(api61.undoLabel("lock") === "数值锁定写回", "61.5 lock 类型已登记回退中心中文标签");
  V61.mbCE_lock = [{ path: "mceProbe61", target: 1000 }];
  V61.mceProbe61 = 99;
  api61.mbCELockTick();
  const undo611 = api61.undoOne("lock:mceProbe61");
  assert(undo611.ok === true && V61.mceProbe61 === 50 && api61.mbCELockHas("mceProbe61") === false &&
    !V61.mbCE_wrote["lock:mceProbe61"],
    "61.6 回退 lock 留痕：先解除锁定再还原锁定前值，留痕删除（" + undo611.msg + "）");
  const undo612 = api61.undoOne("lock:mceProbe61");
  assert(undo612.ok === false && undo612.msg.indexOf("已不存在") !== -1,
    "61.7 重复回退同一条 lock 留痕：明确提示留痕已不存在（不抛错）");

  // 61.8~61.13 潜伏者自动搬运：锁定优先，不抢写
  V61.mbCE_wrote = {};
  V61.mbCE_lock = [];
  V61.lurkers_held = 5; V61.hookah = { lurkers: 2 }; V61.lurkers_stored = 1;
  V61.mbCE_lurkerAuto = true; V61.mbCE_lurkerMoved = 0;
  const mv618 = api61.mbCELurkerAutoTick();
  assert(mv618 === 5 && V61.hookah.lurkers === 7 && V61.lurkers_stored === 1 && V61.lurkers_held === 0,
    "61.8 无锁定时正常搬运：held 5 → 冰箱 2+5=7，笼不动");
  V61.lurkers_held = 4; V61.hookah = { lurkers: 3 }; V61.lurkers_stored = 0;
  V61.mbCE_lock = [{ path: "hookah.lurkers", target: 3 }];
  const mv619 = api61.mbCELurkerAutoTick();
  assert(mv619 === 4 && V61.hookah.lurkers === 3 && V61.lurkers_stored === 4 && V61.lurkers_held === 0,
    "61.9 冰箱被锁定：跳过冰箱这站、直接搬进蒸馏笼（不抢写锁定值）");
  V61.lurkers_held = 6; V61.hookah = { lurkers: 3 }; V61.lurkers_stored = 2;
  V61.mbCE_lock = [{ path: "hookah.lurkers", target: 3 }, { path: "lurkers_stored", target: 2 }];
  const mv6110 = api61.mbCELurkerAutoTick();
  assert(mv6110 === 0 && V61.lurkers_held === 6 && V61.hookah.lurkers === 3 && V61.lurkers_stored === 2,
    "61.10 冰箱与笼都被锁定：原地保留 held（不丢不重）");
  V61.mbCE_lock = [{ path: "lurkers_held", target: 6 }];
  const mv6111 = api61.mbCELurkerAutoTick();
  assert(mv6111 === 0 && V61.lurkers_held === 6, "61.11 手持被锁定：整轮不搬运（锁定优先）");
  const st61 = api61.mbCELurkerState();
  assert(st61.lockHeld === true && st61.lockFridge === false && st61.lockStored === false,
    "61.12 状态回读带锁定标志（面板据此提示哪一站被锁）");
  V61.mbCE_lurkerAuto = false; V61.lurkers_held = 3; V61.mbCE_lock = [];
  assert(api61.mbCELurkerAutoTick() === 0, "61.13 自动搬运关闭时直接返回 0（不写档）");

  // 收尾：还原全部被触碰的存档键（不留定时器——本节从未调用 EnsureTimer）
  if (bk61.lock === undefined) { delete V61.mbCE_lock; } else { V61.mbCE_lock = bk61.lock; }
  if (bk61.wrote === undefined) { delete V61.mbCE_wrote; } else { V61.mbCE_wrote = bk61.wrote; }
  if (bk61.held === undefined) { delete V61.lurkers_held; } else { V61.lurkers_held = bk61.held; }
  if (bk61.hookah === undefined) { delete V61.hookah; } else { V61.hookah = bk61.hookah; }
  if (bk61.stored === undefined) { delete V61.lurkers_stored; } else { V61.lurkers_stored = bk61.stored; }
  if (bk61.auto === undefined) { delete V61.mbCE_lurkerAuto; } else { V61.mbCE_lurkerAuto = bk61.auto; }
  if (bk61.moved === undefined) { delete V61.mbCE_lurkerMoved; } else { V61.mbCE_lurkerMoved = bk61.moved; }
  if (bk61.probe === undefined) { delete V61.mceProbe61; } else { V61.mceProbe61 = bk61.probe; }
  delete V61.mceProbe61b;
} catch (e61) {
  failures++;
  console.error("FAIL: 61 P3/P4 收尾项测试异常: " + (e61 && e61.message ? e61.message : e61));
}

// ===== 62 v2.0.7 收尾项防御分支（P4 留痕建表/脏项/trim · P3 异常形态 · 回退锁定的边界形态）=====
try {
  const api62 = setup.mbStageCE;
  const V62 = global.V;
  const bk62 = {
    lock: V62.mbCE_lock, wrote: V62.mbCE_wrote, probe: V62.mceProbe62, held: V62.lurkers_held,
    hookah: V62.hookah, stored: V62.lurkers_stored, auto: V62.mbCE_lurkerAuto, moved: V62.mbCE_lurkerMoved
  };

  // 62.1 留痕表缺失时 tick 自行建表（读档后首次锁定写回不报错）
  delete V62.mbCE_wrote;
  V62.mbCE_lock = [{ path: "mceProbe62", target: 9 }];
  V62.mceProbe62 = 3;
  api62.mbCELockTick();
  assert(V62.mceProbe62 === 9 && !!V62.mbCE_wrote && !!V62.mbCE_wrote["lock:mceProbe62"],
    "62.1 留痕表缺失时 tick 自行建表并落痕（读档首次写回不报错）");

  // 62.2 锁定表脏项（null / 缺 path / 空 path）全部跳过，只处理合法项
  V62.mbCE_lock = [null, {}, { path: "" }, { path: "mceProbe62", target: 11 }];
  V62.mceProbe62 = 3;
  api62.mbCELockTick();
  assert(V62.mceProbe62 === 11, "62.2 锁定表含 null/缺 path 脏项时跳过，只处理合法项（不抛错）");

  // 62.3 写回后走同一套 400 条 trim（锁定留痕不能被自身高频写回挤出窗口）
  V62.mbCE_wrote = {};
  for (let i623 = 0; i623 < 401; i623++) { V62.mbCE_wrote["zz62:" + i623] = { type: "cheat", path: "x", before: 0, t: i623 }; }
  V62.mbCE_lock = [{ path: "mceProbe62", target: 13 }];
  V62.mceProbe62 = 3;
  api62.mbCELockTick();
  const n623 = Object.keys(V62.mbCE_wrote).length;
  assert(V62.mceProbe62 === 13 && n623 <= 201 && !!V62.mbCE_wrote["lock:mceProbe62"],
    "62.3 写回后走同一套 trim（超 400 条删最旧一半、锁定留痕保留），实际 " + n623 + " 条");

  // 62.5~62.7 潜伏者异常形态（冰箱非对象 / held 非数字 / held 缺失）
  V62.mbCE_lock = [];
  V62.mbCE_lurkerAuto = true; V62.mbCE_lurkerMoved = 0;
  V62.lurkers_held = 4; V62.hookah = null; V62.lurkers_stored = 1;
  const mv625 = api62.mbCELurkerAutoTick();
  assert(mv625 === 4 && V62.lurkers_stored === 5 && V62.lurkers_held === 0,
    "62.5 冰箱字段不是对象时跳过冰箱这站，直接进蒸馏笼");
  V62.lurkers_held = "5"; V62.hookah = { lurkers: 1 }; V62.lurkers_stored = 0;
  const mv626 = api62.mbCELurkerAutoTick();
  assert(mv626 === 5 && V62.hookah.lurkers === 6 && V62.lurkers_held === 0,
    "62.6 手持是字符串数值 \"5\" 时按 5 搬运（v2.0.8：旧写法按 0 起算会整轮不动）");
  V62.lurkers_held = "abc"; V62.hookah = { lurkers: 1 }; V62.lurkers_stored = 0;
  const mv626b = api62.mbCELurkerAutoTick();
  assert(mv626b === 0 && V62.hookah.lurkers === 1,
    "62.6b 手持不可解析（\"abc\"）→ 按 0 处理，不搬运不写档");
  delete V62.lurkers_held; V62.hookah = { lurkers: 2 };
  const st627 = api62.mbCELurkerState();
  assert(st627.ok === true && st627.held === null && st627.fridge === 2,
    "62.7 状态回读：held 缺失回落 null（渲染显示「—」而不是 NaN）");

  // 62.8~62.11 回退锁定留痕的边界形态 + 展示名回落
  V62.mbCE_wrote = {};
  V62.mbCE_lock = [];
  V62.mceProbe62 = 13;
  V62.mbCE_wrote["lock:mceProbe62"] = { type: "lock", path: "mceProbe62", before: 5, after: 13, t: 1 };
  const u628 = api62.undoOne("lock:mceProbe62");
  assert(u628.ok === true && V62.mceProbe62 === 5 && u628.msg.indexOf("锁定已不在") !== -1,
    "62.8 锁定表里已没有该 path 时只还原原值并提示（" + u628.msg + "）");
  V62.mbCE_wrote["lock:mceProbe62"] = { type: "lock", path: "mceProbe62", after: 13, t: 1 };
  V62.mceProbe62 = 13;
  const u629 = api62.undoOne("lock:mceProbe62");
  assert(u629.ok === true && !V62.mbCE_wrote["lock:mceProbe62"] && u629.msg.indexOf(" = ") === -1,
    "62.9 留痕缺 before 时只清留痕、不写值（" + u629.msg + "）");
  const nm6210 = api62.undoItemName("lock:mceProbe62", { type: "lock", path: "mceProbe62" });
  assert(typeof nm6210 === "string" && nm6210.length > 0 && nm6210.indexOf("lock:") !== 0,
    "62.10 lock 留痕展示名不吃原始键前缀（得到「" + nm6210 + "」）");
  const lb6211 = api62.mbCELockLabel("zz.unknown.62");
  assert(typeof lb6211 === "string", "62.11 未知锁定路径取标签不抛错（三级回落返回字符串）");

  // 62.12~62.13 潜伏者数值形态兜底（冰箱计数非数字 / 笼与累计计数缺失）
  V62.mbCE_lock = []; V62.mbCE_lurkerAuto = true;
  V62.lurkers_held = 4; V62.hookah = { lurkers: "2" }; V62.lurkers_stored = 0;
  const mv6212 = api62.mbCELurkerAutoTick();
  assert(mv6212 === 4 && V62.hookah.lurkers === 6,
    "62.12 冰箱计数是字符串 \"2\" 时按 2 累加 → 6（v2.0.8：旧写法按 0 覆盖会丢掉原有的 2）");
  delete V62.lurkers_stored; delete V62.mbCE_lurkerMoved;
  V62.lurkers_held = 3; V62.hookah = { lurkers: 1 };
  api62.mbCELockSet("hookah.lurkers", 1); /* 锁冰箱 → 跳过冰箱这站，held 只能进笼 */
  const mv6213 = api62.mbCELurkerAutoTick();
  api62.mbCELockRemove("hookah.lurkers");
  assert(mv6213 === 3 && V62.lurkers_stored === 3 && V62.mbCE_lurkerMoved === 3,
    "62.13 蒸馏笼/累计计数缺失时按 0 起算（冰箱被锁 → 全进笼，不写 NaN）");

  // 收尾
  if (bk62.lock === undefined) { delete V62.mbCE_lock; } else { V62.mbCE_lock = bk62.lock; }
  if (bk62.wrote === undefined) { delete V62.mbCE_wrote; } else { V62.mbCE_wrote = bk62.wrote; }
  if (bk62.probe === undefined) { delete V62.mceProbe62; } else { V62.mceProbe62 = bk62.probe; }
  if (bk62.held === undefined) { delete V62.lurkers_held; } else { V62.lurkers_held = bk62.held; }
  if (bk62.hookah === undefined) { delete V62.hookah; } else { V62.hookah = bk62.hookah; }
  if (bk62.stored === undefined) { delete V62.lurkers_stored; } else { V62.lurkers_stored = bk62.stored; }
  if (bk62.auto === undefined) { delete V62.mbCE_lurkerAuto; } else { V62.mbCE_lurkerAuto = bk62.auto; }
  if (bk62.moved === undefined) { delete V62.mbCE_lurkerMoved; } else { V62.mbCE_lurkerMoved = bk62.moved; }
} catch (e62) {
  failures++;
  console.error("FAIL: 62 P3/P4 防御分支测试异常: " + (e62 && e62.message ? e62.message : e62));
}

// ===== 63 v2.0.9 需求②③④：原版档案 / 收藏 / 头衔（07l-vanilla-ext.js）=====
try {
  const api63 = setup.mbStageCE;
  const V63 = global.V;
  const bk63 = {
    crime: V63.crime, ma: V63.museumAntiques, hints: V63.museumAntiqueJournalHints,
    feats: V63.feats, wrote: V63.mbCE_wrote, npc: V63.NPCName, fate: V63.avery_fate,
    list: global.setup.NPCNameList, dgLv: V63.mpDgLv, mpCat: V63.mpCat, npcAff: V63.npcAff, chestReq: V63.dgChestReq
  };
  const CRIME63 = ["assault", "coercion", "destruction", "exposure", "obstruction",
    "prostitution", "resisting", "thievery", "petty", "trespassing"];

  // 63.1~63.7 犯罪记录全清（原版作弊页只清 current/count/daily/事件，history 与 countHistory 清不掉）
  V63.crime = { events: { assault: [{ type: "assault", severity: 2, date: 1 }], thievery: [{ type: "thievery", severity: 1, date: 2 }] } };
  CRIME63.forEach((t, i) => {
    V63.crime[t] = { current: 10 + i, history: 100 + i, daily: 3, count: 2, countHistory: 7 };
  });
  const r631 = api63.mbCEVanillaCrimeClear();
  assert(r631.ok === true && r631.touched === 10, "63.1 犯罪全清覆盖 10 类（touched=10）");
  assert(V63.crime.assault.current === 0 && V63.crime.trespassing.history === 0 && V63.crime.trespassing.countHistory === 0,
    "63.2 current / history / countHistory 全部归零（案底一并清掉）");
  assert(Object.keys(V63.crime.events).length === 0, "63.3 事件日志 $crime.events 清空");
  assert(!!(V63.mbCE_wrote && V63.mbCE_wrote["vcore:crime"]), "63.4 写入留痕 vcore:crime 落地（回退中心可见）");
  assert(V63.mbCE_wrote["vcore:crime"].before.crime.assault.history === 100,
    "63.5 留痕 before 保留首次写入前案底（100）");
  const u631 = api63.mbCEVanillaExtUndo("crime");
  assert(u631.ok === true && V63.crime.assault.history === 100 && V63.crime.trespassing.count === 2,
    "63.6 回退还原 current / history / count / countHistory");
  assert(!!(V63.crime.events.assault && V63.crime.events.assault.length === 1) && !V63.mbCE_wrote["vcore:crime"],
    "63.7 回退同时还原事件日志并删除留痕");

  // 63.8~63.10 犯罪：结构缺失时补零值（不因脏档报错）
  V63.crime = { events: {} };

  // 63.46~63.47 回退的结构缺失与「快照后新增项」两条反向路径
  V63.feats = { currentSave: {} };
  V63.museumAntiques = { antiques: { a1: "notFound" }, paintings: { p1: "notFound" }, museumCount: 2 };
  api63.mbCEVanillaAntiqueCollect();
  delete V63.museumAntiques;
  const u6346 = api63.mbCEVanillaExtUndo("antique");
  assert(u6346.ok === false && u6346.message.indexOf("博物馆结构已不在") !== -1,
    "63.46 回退前 $museumAntiques 已消失 → 显式拒绝（不留半截状态）");
  delete V63.mbCE_wrote["vcore:antique"];
  V63.museumAntiques = { antiques: { a1: "notFound" }, paintings: { p1: "notFound" }, museumCount: 2 };
  api63.mbCEVanillaAntiqueCollect();
  V63.museumAntiques.paintings.p3 = "found";
  const u6347 = api63.mbCEVanillaExtUndo("antique");
  assert(u6347.ok === true && V63.museumAntiques.paintings.p1 === "notFound"
    && V63.museumAntiques.paintings.p3 === "found",
    "63.47 快照里没有的新画不作还原（只回滚自己写过的键，不动玩家后来的进度）");
  const r631b = api63.mbCEVanillaCrimeClear();
  assert(r631b.ok === true && V63.crime.petty && V63.crime.petty.history === 0 && V63.crime.petty.countHistory === 0,
    "63.8 某类犯罪结构缺失时补零值（10 类全建，避免后续读到 undefined）");
  const u631b = api63.mbCEVanillaExtUndo("crime");
  assert(u631b.ok === true && V63.crime.petty === undefined,
    "63.9 回退把首次写入前不存在的类型删除（不留空壳）");

  // 63.10~63.15 博物馆古董：只收集（found）不上交（museum），成就直写
  V63.museumAntiques = {
    antiques: { antiquebox: "found", antiquesilverring: "notFound", antiquecrystal: "talk" },
    paintings: { paintingward: "notFound", paintingsnake: "notFound" },
    museumCount: 1, stolenCount: 0, recoveredCount: 0
  };
  V63.museumAntiqueJournalHints = [{ k: "antiquebox" }];
  V63.feats = { currentSave: {}, soft: false, locked: false };
  const r632 = api63.mbCEVanillaAntiqueCollect();
  assert(r632.ok === true && r632.got === 4, "63.10 收齐：2 件古董 + 2 幅画（原已 found 的不重复计数）");
  assert(V63.museumAntiques.antiques.antiquesilverring === "found" && V63.museumAntiques.paintings.paintingward === "found",
    "63.11 全部写 found（已发现未上交），不是 museum（不上交、不计入柜位）");
  assert(V63.museumAntiques.museumCount === 1,
    "63.12 不动 museumCount（不结算奖金；museum→museumCount++ 只在原版 widget 里发生）");
  assert(V63.museumAntiques.maxCount === 3, "63.13 maxCount 缺失时按实际古董键数补齐（3）");
  assert(r632.feat === true && V63.feats.currentSave["It Belongs in a Museum"] !== undefined,
    "63.14 成就直写 V.feats.currentSave（earnFeat 在 cheatsEnabled 下被门控，等不到原版结算）");
  assert(Array.isArray(V63.museumAntiqueJournalHints) && V63.museumAntiqueJournalHints.length === 0,
    "63.15 期刊提示清空（全部 found 后不再指向「未发现位置」）");
  const u632 = api63.mbCEVanillaExtUndo("antique");
  assert(u632.ok === true && V63.museumAntiques.antiques.antiquesilverring === "notFound"
    && V63.museumAntiques.paintings.paintingward === "notFound",
    "63.16 回退还原古董状态机");
  assert(V63.museumAntiques.museumCount === 1 && V63.feats.currentSave["It Belongs in a Museum"] === undefined,
    "63.17 回退删除本次解锁的成就（before 记 hadFeat=false），并还原 museumCount");

  // 63.18~63.21 雷米头衔：飞升线写疤面 + 补 Harper/Avery 关掉幂等回滚
  global.setup.NPCNameList = ["Avery", "Harper", "Remy"];
  V63.NPCName = [
    { nam: "Avery", title: "high elk" },
    { nam: "Harper", title: "high elk" },
    { nam: "Remy", title: "high elk" }
  ];
  V63.avery_fate = "ascended";
  const r633 = api63.mbCEVanillaRemyScar();
  assert(r633.ok === true && V63.NPCName[2].title === "scarred", "63.18 Remy 头衔写 scarred（飞升线也能拿）");
  assert(V63.NPCName[1].title === "silver fox" && V63.NPCName[0].title === "crimson hound" && r633.guard === true,
    "63.19 飞升线同步补 Harper=silver fox / Avery=crimson hound（让原版幂等守卫不成立，防回滚）");
  const st633 = api63.mbCEVanillaExtState();
  assert(st633.title.remy === "scarred" && st633.title.remyZh === "疤面" && st633.title.fate === "ascended",
    "63.20 状态回读：headlem 英文 key + 中文「疤面」映射 + $avery_fate");
  const u633 = api63.mbCEVanillaExtUndo("title");
  assert(u633.ok === true && V63.NPCName[2].title === "high elk" && V63.NPCName[1].title === "high elk",
    "63.21 回退还原 Remy / Harper / Avery 三个头衔");

  // 63.22 非飞升线：只写 Remy，不动 Harper/Avery
  V63.avery_fate = "saved";
  const r634 = api63.mbCEVanillaRemyScar();
  assert(r634.ok === true && r634.guard === false && V63.NPCName[2].title === "scarred"
    && V63.NPCName[0].title === "high elk",
    "63.22 非飞升线只写 Remy，不改 Harper/Avery（原版本就写疤面）");
  api63.mbCEVanillaExtUndo("title");

  // 63.23~63.27 Dolonline 5.27 单机状态键（只写本地 $ 变量，不涉联机交互）
  V63.mpDgLv = 1; V63.mpCat = 0; V63.npcAff = 3;
  const w6323 = api63.cheatWriteValue("dolonline", "dl_dglv", "value_set", "mpDgLv", "9", "number", 1, 99);
  assert(w6323.ok === true && V63.mpDgLv === 9,
    "63.23 mpDgLv 写 9（法术解锁门槛 3/5/7/9/12 中的「雷暴」档）");
  const w6324 = api63.cheatWriteValue("dolonline", "dl_chestreq", "value_set", "dgChestReq", "0", "number", 0, 500);
  assert(w6324.ok === true && V63.dgChestReq === 0,
    "63.24 dgChestReq 写 0 = 任何诡术都能撬箱（原版 `skulduggery >= dgChestReq`）");
  const w6325 = api63.cheatWriteValue("dolonline", "dl_npcaff", "value_set", "npcAff", "99", "number", 0, 15);
  assert(w6325.ok === true && V63.npcAff === 99,
    "63.25 写入器下限钳 0、上限不钳（npcAff 写 99 保留，模组侧自己 Math.min(15, ...)）");
  assert(typeof api63.mbCERenderVanillaExt === "function", "63.26 ⑧ 区块渲染函数已导出（页签分发可调用）");
  assert(api63.mbCEVanillaExtState().crime.types === 10, "63.27 状态回读：犯罪类型数 10（缺 setup.crimeNames 时走兜底清单）");

  // 63.28~63.41 v2.0.9 拆段轮补测：脏档 / 二次写入 / 结构缺失 / 已解锁 / 缺角色等反向路径
  /* 犯罪：二次点击不覆盖首次 before；结构被清掉后回退显式拒绝 */
  V63.crime = { events: {}, assault: { current: 5, history: 50, daily: 1, count: 1, countHistory: 3 } };
  api63.mbCEVanillaCrimeClear();
  api63.mbCEVanillaCrimeClear();
  assert(V63.mbCE_wrote["vcore:crime"].before.crime.assault.history === 50,
    "63.28 同块二次清空不覆盖首次 before（回退仍能还原到最初的 50，而不是被第二次的 0 顶掉）");
  V63.crime = null;
  const u6328 = api63.mbCEVanillaExtUndo("crime");
  assert(u6328.ok === false && u6328.message.indexOf("犯罪结构已不在") !== -1,
    "63.29 $crime 结构被清掉时回退显式拒绝（不静默写回 undefined）");
  delete V63.mbCE_wrote["vcore:crime"];
  V63.crime = { events: {} };


  /* 古董：feats 缺失 / feats 无 currentSave / 成就早已解锁 / paintings 缺失 / 结构缺失 */
  delete V63.feats;
  V63.museumAntiques = { antiques: { a1: "notFound" }, museumCount: 0 };
  const r6329 = api63.mbCEVanillaAntiqueCollect();
  assert(r6329.ok === true && r6329.feat === false && r6329.message.indexOf("成就写入失败") !== -1,
    "63.30 存档缺 $feats → 古董照收，成就写不进去要在文案里明说（不假报成功）");
  V63.feats = {};
  const r6330 = api63.mbCEVanillaAntiqueCollect();
  assert(r6330.feat === true && V63.feats.currentSave && V63.feats.currentSave["It Belongs in a Museum"] !== undefined,
    "63.31 $feats 存在但缺 currentSave 时自动建表再写成就");
  api63.mbCEVanillaExtUndo("antique");
  V63.feats = { currentSave: { "It Belongs in a Museum": new Date() } };
  V63.museumAntiques = { antiques: { a1: "notFound" }, museumCount: 0 };
  const r6331 = api63.mbCEVanillaAntiqueCollect();
  assert(r6331.feat === false && r6331.message.indexOf("此前已解锁") !== -1,
    "63.32 成就早已解锁时如实回「此前已解锁」（不重复写、不谎报本次解锁）");
  assert(V63.museumAntiques.paintings === undefined,
    "63.33 存档无 $paintings 字段时不代建（只处理实际存在的古董表）");
  api63.mbCEVanillaExtUndo("antique");
  assert(api63.mbCEVanillaExtState().antique.has === true && V63.museumAntiques.antiques.a1 === "notFound",
    "63.34 已解锁状态下回退不删成就、古董状态照还原（hadFeat=true 分支）");
  delete V63.museumAntiques;
  const r6332 = api63.mbCEVanillaAntiqueCollect();
  assert(r6332.ok === false && r6332.message.indexOf("未找到 $museumAntiques") !== -1,
    "63.35 未进博物馆线（$museumAntiques 不存在）时拒绝并给原因");

  /* 头衔：缺 Harper→守卫提示；Harper/Avery 已在位；缺 Remy→拒绝；回退时 Remy 消失→拒绝 */
  global.setup.NPCNameList = ["Avery", "Remy"];
  V63.NPCName = [{ nam: "Avery", title: "high elk" }, { nam: "Remy", title: "high elk" }];
  V63.avery_fate = "ascended";
  const r6333 = api63.mbCEVanillaRemyScar();
  assert(r6333.ok === true && r6333.guard === true && r6333.message.indexOf("回滚守卫可能失效") !== -1
    && V63.NPCName[0].title === "crimson hound",
    "63.36 飞升线缺 Harper 时仍写疤面 + 补 Avery，并在文案里提示守卫可能失效");
  api63.mbCEVanillaExtUndo("title");
  global.setup.NPCNameList = ["Avery", "Harper", "Remy"];
  V63.NPCName = [{ nam: "Avery", title: "crimson hound" }, { nam: "Harper", title: "silver fox" }, { nam: "Remy", title: "high elk" }];
  const r6334 = api63.mbCEVanillaRemyScar();
  assert(r6334.ok === true && r6334.guard === false && r6334.message.indexOf("已在位") !== -1,
    "63.37 飞升线 Harper/Avery 已是目标头衔时只写 Remy（guard=false，不重复写）");
  api63.mbCEVanillaExtUndo("title");
  global.setup.NPCNameList = ["Avery"];
  V63.NPCName = [{ nam: "Avery", title: "high elk" }];
  const r6335 = api63.mbCEVanillaRemyScar();
  assert(r6335.ok === false && r6335.message.indexOf("未找到 Remy") !== -1,
    "63.38 $NPCName 里没有 Remy 时拒绝（不往别的角色身上糊头衔）");
  assert(api63.mbCEVanillaExtState().title.exists === false,
    "63.39 头衔状态回读：缺 Remy 时 exists=false（面板据此给提示而不是崩）");
  global.setup.NPCNameList = ["Avery", "Harper", "Remy"];
  V63.NPCName = [{ nam: "Avery", title: "high elk" }, { nam: "Harper", title: "high elk" }, { nam: "Remy", title: "high elk" }];
  api63.mbCEVanillaRemyScar();
  V63.NPCName = [];
  const u6337 = api63.mbCEVanillaExtUndo("title");
  assert(u6337.ok === false && u6337.message.indexOf("Remy 已不在") !== -1,
    "63.40 回退时 Remy 已不在 $NPCName → 显式拒绝");
  delete V63.mbCE_wrote["vcore:title"];

  /* 未知留痕类型：不落到默认写入，直接拒绝 */
  V63.mbCE_wrote["vcore:bogus"] = { type: "vcore", before: { kind: "bogus" } };
  const u6338 = api63.mbCEVanillaExtUndo("bogus");
  assert(u6338.ok === false && u6338.message.indexOf("未知的留痕类型") !== -1,
    "63.41 未知留痕类型拒绝回退（不猜语义、不误写别的键）");
  delete V63.mbCE_wrote["vcore:bogus"];
  // 63.42~63.45 统计快照降级分支（面板读脏档不崩）
  V63.crime = null;
  const st6342 = api63.mbCEVanillaExtState().crime;
  assert(st6342.has === false && st6342.ok === false && st6342.types === 0,
    "63.42 $crime 缺失时统计快照返回 has=false（面板显示「无档案」而不是崩）");
  V63.crime = { events: { assault: "corrupt" }, assault: { current: 3, history: 30, countHistory: 1 } };
  const st6343 = api63.mbCEVanillaExtState().crime;
  assert(st6343.events === 0 && st6343.history === 30,
    "63.43 事件日志值不是数组时不计条数（脏档不抛、其余统计照常）");
  global.setup.NPCNameList = ["Remy"];
  V63.NPCName = [{ nam: "Remy" }];
  const st6344 = api63.mbCEVanillaExtState().title;
  assert(st6344.exists === true && st6344.remy === "" && st6344.harper === "" && st6344.avery === ""
    && st6344.remyZh === "（空）",
    "63.44 Remy 无 title / 缺 Harper、Avery 时统计给空串（不显示 undefined）");
  V63.museumAntiques = { antiques: { a1: "found" }, museumCount: 0 };
  const st6345 = api63.mbCEVanillaExtState().antique;
  assert(st6345.has === true && st6345.paintings === 0 && st6345.found === 1,
    "63.45 存档无 $paintings 时画作计数为 0（不代建、不崩）");
  V63.feats = { currentSave: {} };
  V63.museumAntiques = { antiques: { a1: "notFound" }, museumCount: 0 };
  V63.crime = { events: {} };

  // 收尾还原
  if (bk63.crime === undefined) { delete V63.crime; } else { V63.crime = bk63.crime; }
  if (bk63.ma === undefined) { delete V63.museumAntiques; } else { V63.museumAntiques = bk63.ma; }
  if (bk63.hints === undefined) { delete V63.museumAntiqueJournalHints; } else { V63.museumAntiqueJournalHints = bk63.hints; }
  if (bk63.feats === undefined) { delete V63.feats; } else { V63.feats = bk63.feats; }
  if (bk63.wrote === undefined) { delete V63.mbCE_wrote; } else { V63.mbCE_wrote = bk63.wrote; }
  if (bk63.npc === undefined) { delete V63.NPCName; } else { V63.NPCName = bk63.npc; }
  if (bk63.fate === undefined) { delete V63.avery_fate; } else { V63.avery_fate = bk63.fate; }
  if (bk63.list === undefined) { delete global.setup.NPCNameList; } else { global.setup.NPCNameList = bk63.list; }
  if (bk63.dgLv === undefined) { delete V63.mpDgLv; } else { V63.mpDgLv = bk63.dgLv; }
  if (bk63.mpCat === undefined) { delete V63.mpCat; } else { V63.mpCat = bk63.mpCat; }
  if (bk63.npcAff === undefined) { delete V63.npcAff; } else { V63.npcAff = bk63.npcAff; }
  if (bk63.chestReq === undefined) { delete V63.dgChestReq; } else { V63.dgChestReq = bk63.chestReq; }
} catch (e63) {
  failures++;
  console.error("FAIL: 63 原版档案/收藏/头衔测试异常: " + (e63 && e63.stack ? e63.stack : e63));
}

// ===== 64 v2.0.15 剧情直达补 4 组：象牙怨灵 / 万圣节 / 情人节 / 圣诞（07d-places.js）=====
/* 取证（本体 0.5.12.13 单行 HTML，全部实测）：
   - 象牙怨灵：原版 $passageData 的测试直跳表里有 { link: ["Summon the Wraith","Wraith Test Start"],
     widgets: [<<endcombat>>, <<run Time.timeTravel(new DateTime(Time.year,Time.month,Time.lastDayOfMonth,21,0))>>,
     <<set $moonstate to "evening">>] } —— 即「Wraith Test Start」是原版自带的可直接 play 的入口，
     且初始化三件套给出了权威前置清单。该段首行 <<set $outside to 0>><<set $location to "home">>
     + <<generateWraith 1 true>>，自带生成与退出链接，不需要外部前置。
   - 节日：原版不按段落判日期，而是 Time 每日例程按月份置存档旗标——
     V.valentines=1 @2月6~14；V.halloween=1 @10月>=21；V.christmas=1 @12月18~25；
     离开窗口会 delete V.halloween 并连带删 halloween_lake / halloweenWolves 等子旗标。
     故 B 方案必须推进日期到窗口内让原版自己置旗标，只置标志会被次日例程清掉。 */
try {
  const api64 = setup.mbStageCE;
  const V64 = global.V;
  const bk64 = {
    time: global.Time, dt: global.DateTime, story: global.Story,
    wraith: V64.wraith, moonstate: V64.moonstate, wraithPrison: V64.wraithPrison,
    phase: V64.phase, cool: V64.cool, av: V64.avery_valentines, food: V64.foodstuff
  };
  const FEST_NAMES = [
    "Wraith Test Start", "Wraith Intro Pray", "Wraith Stalk",
    "Lake Halloween Party", "Kylar Halloween", "Kylar Halloween Bed",
    "Avery Valentines", "Avery Valentines 2", "Avery Valentines Missed",
    "Christmas Mirror", "Christmas Mirror 2", "Eden Christmas Meal",
    "Lake Stroll", "Lake Insect",
    "Ivory Wraith Stalk", "Gwylan Talk Clothes Halloween", "Bedroom Robin Christmas Wrap"
  ];
  global.Story = {
    has: (n) => FEST_NAMES.indexOf(n) !== -1,
    lookupWith: (fn) => FEST_NAMES.map(n => ({ name: n, text: "" })).filter(fn)
  };
  const pg64 = api64.listPlaceGroups();

  const gW = pg64.find(x => x.group.id === "wraith");
  assert(!!gW, "64.1 怨灵组存在");
  assert(gW.group.main === "Wraith Test Start", "64.2 怨灵主场景 = 原版 Summon the Wraith 载入段, 实际 " + gW.group.main);
  assert(gW.items[0] === "Wraith Test Start" && gW.items.length === 4 && gW.items.indexOf("Ivory Wraith Stalk") !== -1,
    "64.3 怨灵组收录 Wraith/Ivory Wraith 前缀 4 段且主场景置顶（Ivory Wraith 前缀也归本组）, 实际 " + JSON.stringify(gW.items));

  const gH = pg64.find(x => x.group.id === "halloween");
  assert(!!gH && gH.group.main === "Lake Halloween Party", "64.4 万圣节组主场景 = Lake Halloween Party, 实际 " + (gH && gH.group.main));
  assert(gH.items.indexOf("Lake Halloween Party") !== -1 && gH.items.indexOf("Kylar Halloween") !== -1
    && gH.items.indexOf("Gwylan Talk Clothes Halloween") === -1,
    "64.5 万圣节组吃到派对段与凯拉尔段，但不抢格威兰换装线（Gwylan Talk 前缀留在 gwylan_garden）, 实际 " + JSON.stringify(gH.items));
  const gL = pg64.find(x => x.group.id === "lake");
  assert(gL.items.indexOf("Lake Halloween Party") === -1 && gL.items.indexOf("Lake Stroll") !== -1, "64.6 湖畔组不重复收录万圣节派对段（先占先得无跨组重复）, 实际 " + JSON.stringify(gL.items));

  const gV = pg64.find(x => x.group.id === "valentines");
  assert(!!gV && gV.group.main === "Avery Valentines", "64.7 情人节组主场景 = Avery Valentines, 实际 " + (gV && gV.group.main));
  assert(gV.items[0] === "Avery Valentines" && gV.items.length === 3, "64.8 情人节组 3 段且主场景置顶, 实际 " + JSON.stringify(gV.items));

  const gC = pg64.find(x => x.group.id === "christmas");
  assert(!!gC && gC.group.main === "Christmas Mirror", "64.9 圣诞组主场景 = Christmas Mirror, 实际 " + (gC && gC.group.main));
  assert(gC.items[0] === "Christmas Mirror" && gC.items.length === 3 && gC.items.indexOf("Bedroom Robin Christmas Wrap") === -1,
    "64.10 圣诞组 3 段且主场景置顶，且不抢 Bedroom Robin Christmas Wrap（留在 bedroom 组）, 实际 " + JSON.stringify(gC.items));

  /* 64.11~64.16 象牙怨灵：时间通道 + $wraith 八字段 + 月相 */
  const travels64 = [];
  global.DateTime = function (y, mo, d, h, mi) { this.y = y; this.mo = mo; this.d = d; this.h = h; this.mi = mi; };
  global.Time = { year: 2026, month: 11, monthDay: 25, lastDayOfMonth: 30, timeTravel: function (dt) { travels64.push(dt); } };
  delete V64.wraith; delete V64.moonstate;
  api64.ensureSceneStateFor("Wraith Test Start");
  assert(!!V64.wraith && V64.wraith.init === 1 && V64.wraith.hunt === 0 && V64.wraith.nightmare === 0,
    "64.11 怨灵直达 → 补 $wraith 壳（init=1/hunt=0/nightmare=0）, 实际 " + JSON.stringify(V64.wraith));
  assert(["init", "seen", "days", "defeated", "evaded", "nightmare", "timer", "hunt"].every(k => k in V64.wraith),
    "64.12 $wraith 八字段齐（对齐原版 checkWraith 初始化）, 实际 " + Object.keys(V64.wraith).join(","));
  assert(V64.moonstate === "evening", "64.13 月相补 evening（原版 Summon the Wraith 同值）, 实际 " + V64.moonstate);
  assert(travels64.length === 1 && travels64[0].mo === 11 && travels64[0].d === 30 && travels64[0].h === 21 && travels64[0].mi === 0,
    "64.14 时间推进到当月最后一天 21:00（原版三件套口径）, 实际 " + JSON.stringify(travels64[0]));
  V64.wraith.hunt = 8; V64.wraith.seen = 5;
  api64.ensureSceneStateFor("Wraith Intro Pray");
  assert(V64.wraith.hunt === 8 && V64.wraith.seen === 5, "64.15 已有 $wraith 进度不被覆盖（hunt=8/seen=5 保留）, 实际 hunt=" + V64.wraith.hunt);

  /* 64.17~64.20 万圣节 */
  delete V64.phase; delete V64.cool;
  travels64.length = 0;
  api64.ensureSceneStateFor("Lake Halloween Party");
  assert(travels64.length === 1 && travels64[0].mo === 10 && travels64[0].d === 28,
    "64.17 万圣节 → 时间推进到 10 月 28 日（落在 V.halloween 置 1 的 >=21 窗口）, 实际 " + JSON.stringify(travels64[0]));
  assert(V64.phase === 0, "64.18 万圣节派对 $phase 补 0（走湖岸篝火分支，而非湖畔默认 1）, 实际 " + V64.phase);
  assert(V64.cool === 240, "64.19 $cool 补 240（原版 gte 240 = 欢呼最高档；0 会读到「没人理你」）, 实际 " + V64.cool);
  V64.phase = 2;
  travels64.length = 0;
  api64.ensureSceneStateFor("Lake Halloween Party");
  assert(V64.phase === 2, "64.20 已有 $phase=2 不被覆盖, 实际 " + V64.phase);

  /* 64.21~64.25 情人节 */
  delete V64.avery_valentines; delete V64.foodstuff;
  travels64.length = 0;
  api64.ensureSceneStateFor("Avery Valentines");
  assert(travels64.length === 1 && travels64[0].mo === 2 && travels64[0].d === 10,
    "64.21 情人节 → 时间推进到 2 月 10 日（落在 V.valentines 的 6~14 窗口）, 实际 " + JSON.stringify(travels64[0]));
  const AV64 = ["intro", "invite", "ready", "done", "reservation", "chocolate", "chocolate_asked", "opinion",
    "confess", "food", "soften", "talk", "talk_count", "sex", "end", "end_talk", "missed_approach"];
  assert(!!V64.avery_valentines && AV64.every(k => k in V64.avery_valentines),
    "64.22 $avery_valentines 十七字段齐（逐字对齐原版每日例程建壳）, 实际 " + Object.keys(V64.avery_valentines || {}).join(","));
  assert(V64.avery_valentines.invite === false && V64.avery_valentines.opinion === "none" && V64.avery_valentines.talk_count === 0,
    "64.23 字段默认值对齐原版（invite=false / opinion=none / talk_count=0）");
  assert(!!V64.foodstuff && !!V64.foodstuff.valentines_chocolate && typeof V64.foodstuff.valentines_chocolate.amount === "number",
    "64.24 补 $foodstuff.valentines_chocolate.amount（段落读 .amount gte 1，缺对象会 TypeError）, 实际 " + JSON.stringify(V64.foodstuff && V64.foodstuff.valentines_chocolate));
  V64.avery_valentines.done = true;
  api64.ensureSceneStateFor("Avery Valentines");
  assert(V64.avery_valentines.done === true && V64.avery_valentines.invite === false,
    "64.25 已有情人节进度不被覆盖（done=true 保留）");

  /* 64.26~64.28 圣诞 */
  delete V64.wraith; delete V64.wraithPrison;
  travels64.length = 0;
  api64.ensureSceneStateFor("Christmas Mirror");
  assert(travels64.length === 1 && travels64[0].mo === 12 && travels64[0].d === 22,
    "64.26 圣诞 → 时间推进到 12 月 22 日（落在 V.christmas 的 18~25 窗口）, 实际 " + JSON.stringify(travels64[0]));
  assert(!!V64.wraith && V64.wraith.seen >= 3, "64.27 圣诞镜段落守卫 $wraith.seen gte 3 达成, 实际 seen=" + (V64.wraith && V64.wraith.seen));
  assert(V64.wraithPrison === false, "64.28 $wraithPrison 补 false（段落读该守卫）, 实际 " + V64.wraithPrison);

  /* 64.29~64.31 边界：普通湖畔段不被节日分支截获 / Time 缺 timeTravel 不崩 */
  V64.phase = 0; V64.cool = 0;
  travels64.length = 0;
  api64.ensureSceneStateFor("Lake Stroll");
  assert(V64.phase === 0, "64.29 普通湖畔段走原湖畔分支且合法值 0 不被覆盖（末被节日分支截获）, 实际 " + V64.phase);
  V64.phase = 9;
  api64.ensureSceneStateFor("Lake Stroll");
  assert(V64.phase === 1, "64.30 湖畔分支非法 $phase=9 校正到 1（0-2 才是合法档）, 实际 " + V64.phase);
  assert(travels64.length === 0, "64.31 普通湖畔段不推进时间（原地不动）, 实际 " + travels64.length);
  global.Time = { year: 2026, month: 11, lastDayOfMonth: 30 };
  delete V64.wraith; delete V64.moonstate;
  api64.ensureSceneStateFor("Wraith Test Start");
  assert(V64.moonstate === "evening" && !!V64.wraith, "64.31 Time 无 timeTravel 时不崩，仍补状态壳");

  /* 64.33~64.38 精度轮：时间窗口语义（已在窗口内不动 / 跨月回拨明示）+ 跨组不接管 */
  global.Time = { year: 2026, month: 10, monthDay: 25, lastDayOfMonth: 31, timeTravel: function (dt) { travels64.push(dt); } };
  travels64.length = 0;
  api64.ensureSceneStateFor("Lake Halloween Party");
  assert(travels64.length === 0, "64.33 已在万圣节窗口内（10-25，窗口 21~31）→ 完全不碰日期, 实际 " + JSON.stringify(travels64));
  global.Time = { year: 2026, month: 10, monthDay: 31, lastDayOfMonth: 31, timeTravel: function (dt) { travels64.push(dt); } };
  travels64.length = 0;
  api64.ensureSceneStateFor("Lake Halloween Party");
  assert(travels64.length === 0, "64.34 窗口右端 10-31 也不推（旧实现只比 day>=28，会误判）, 实际 " + travels64.length);

  global.Time = { year: 2026, month: 2, monthDay: 6, lastDayOfMonth: 28, timeTravel: function (dt) { travels64.push(dt); } };
  travels64.length = 0;
  api64.ensureSceneStateFor("Avery Valentines");
  assert(travels64.length === 0, "64.35 情人节窗口下端 2-6 不动（原版判定 monthDay 6~14 含边界）, 实际 " + travels64.length);

  global.Time = { year: 2026, month: 3, monthDay: 15, lastDayOfMonth: 31, timeTravel: function (dt) { travels64.push(dt); } };
  travels64.length = 0;
  api64.ensureSceneStateFor("Christmas Mirror");
  assert(travels64.length === 1 && travels64[0].mo === 12 && travels64[0].d === 22 && travels64[0].y === 2026,
    "64.36 3 月点圣诞 → 回拨到同年 12-22（不回拨就永远玩不到，故为功能本意）, 实际 " + JSON.stringify(travels64[0]));

  travels64.length = 0;
  V64.phase = 0; V64.cool = 240;
  api64.ensureSceneStateFor("Gwylan Talk Clothes Halloween");
  assert(travels64.length === 0 && V64.phase === 0 && V64.cool === 240,
    "64.37 格威兰换装段不被节日分支接管（不推日期、不动 phase/cool）, 实际 travels=" + travels64.length);
  travels64.length = 0;
  api64.ensureSceneStateFor("Bedroom Robin Christmas Wrap");
  assert(travels64.length === 0, "64.38 Bedroom Robin Christmas Wrap 不被圣诞分支接管（不以 Christmas 前缀开头）, 实际 " + travels64.length);

  /* 64.39~64.43 可玩性过滤：<<widget>> 定义段与战斗起始段不入组，正常段不被误杀
     正文样例取自原版实测（%TEMP%\mce_playability.txt 127 段逐段扫描的首宏形态） */
  const PLAYABLE_MOCK = {
    "Kylar Halloween Start": '<<widget "halloweenkylar">>\n\t<<npc Kylar>>',
    "Wraith Stalk": '<<if $molestationstart is 1>>\n\t<<set $molestationstart to 0>>',
    "Wolf Halloween 7": '<<effects>>\n\n<<if $phase is 0>>\n\tYou creep around the unaware.\n<<if $molestationstart is 1>>',
    "Elk Compound": '<<set $outside to 1>><<set $location to "compound">>\n\nThe compound.',
    "Elk Compound Widgets": '<<widget "resetCompound">>\n\t<<set $compound to {}>>',
    "Elk Compound Fight": '<<if $fightstart is 1>>\n\t<<set $fightstart to 0>>',
    "Elk Compound Central": '<<set $outside to 1>><<set $location to "compound">>\n\nYou enter the central hall.'
  };
  const playNames = FEST_NAMES.concat(Object.keys(PLAYABLE_MOCK));
  global.Story = {
    has: (n) => playNames.indexOf(n) !== -1,
    lookupWith: (fn) => playNames.map(n => ({ name: n, text: PLAYABLE_MOCK[n] || "" })).filter(fn),
    get: (n) => (PLAYABLE_MOCK[n] ? { title: n, text: PLAYABLE_MOCK[n] } : undefined)
  };
  const pg64b = api64.listPlaceGroups();
  const gWb = pg64b.find(x => x.group.id === "wraith");
  const gHb = pg64b.find(x => x.group.id === "halloween");
  const gEb = pg64b.find(x => x.group.id === "elk_compound");
  assert(!!gWb && gWb.items.indexOf("Wraith Stalk") === -1 && gWb.items.length === 3,
    "64.39 首宏是 <<if $molestationstart …>> 的中继段不入组（Wraith Stalk 被剔除，余 3 段）, 实际 " + JSON.stringify(gWb && gWb.items));
  assert(!!gHb && gHb.items.indexOf("Kylar Halloween Start") === -1,
    "64.40 <<widget>> 定义段不入组（Kylar Halloween Start 被剔除）, 实际 " + JSON.stringify(gHb && gHb.items));
  assert(!!gHb && gHb.items.indexOf("Wolf Halloween 7") !== -1,
    "64.41 含 $molestationstart 但首宏是 $phase 的正常段不被误杀（Wolf Halloween 7 保留）, 实际 " + JSON.stringify(gHb && gHb.items));
  assert(!!gEb && gEb.items.indexOf("Elk Compound Widgets") === -1 && gEb.items.indexOf("Elk Compound Fight") === -1
    && gEb.items.indexOf("Elk Compound Central") !== -1,
    "64.42 麋鹿街大院同口径过滤（widget 定义段 + $fightstart 起始段剔除，正常段保留）, 实际 " + JSON.stringify(gEb && gEb.items));
  global.Story = { has: (n) => FEST_NAMES.indexOf(n) !== -1, lookupWith: (fn) => FEST_NAMES.map(n => ({ name: n, text: "" })).filter(fn) };
  const pg64c = api64.listPlaceGroups();
  const gWc = pg64c.find(x => x.group.id === "wraith");
  assert(gWc.items.length === 4 && gWc.items.indexOf("Wraith Stalk") !== -1,
    "64.43 取不到正文（Story.get 缺失）时不过滤，items 回到 4 段（不因缺能力就少收）, 实际 " + JSON.stringify(gWc.items));
  global.Story = bk64.story;
  /* 64.32 中文词条（主场景行「★ 中文」依赖 PLACE_CN） */
  assert(typeof api64.placeNameCN === "function" && api64.placeNameCN("Lake Halloween Party").indexOf("万圣节") !== -1,
    "64.32 placeNameCN 含「万圣节」词条, 实际 " + (typeof api64.placeNameCN === "function" ? api64.placeNameCN("Lake Halloween Party") : "no-api"));

  // 收尾还原
  if (bk64.story === undefined) { delete global.Story; } else { global.Story = bk64.story; }
  if (bk64.time === undefined) { delete global.Time; } else { global.Time = bk64.time; }
  if (bk64.dt === undefined) { delete global.DateTime; } else { global.DateTime = bk64.dt; }
  if (bk64.wraith === undefined) { delete V64.wraith; } else { V64.wraith = bk64.wraith; }
  if (bk64.moonstate === undefined) { delete V64.moonstate; } else { V64.moonstate = bk64.moonstate; }
  if (bk64.wraithPrison === undefined) { delete V64.wraithPrison; } else { V64.wraithPrison = bk64.wraithPrison; }
  if (bk64.phase === undefined) { delete V64.phase; } else { V64.phase = bk64.phase; }
  if (bk64.cool === undefined) { delete V64.cool; } else { V64.cool = bk64.cool; }
  if (bk64.av === undefined) { delete V64.avery_valentines; } else { V64.avery_valentines = bk64.av; }
  if (bk64.food === undefined) { delete V64.foodstuff; } else { V64.foodstuff = bk64.food; }
} catch (e64) {
  failures++;
  console.error("FAIL: 64 v2.0.15 剧情直达四组测试异常: " + (e64 && e64.stack ? e64.stack : e64));
}

// ===== 65 v2.0.17 子入口状态兜底：$gwylan / $pubfame（07d-places4.js + 07d-places.js 调用点）=====
/* 取证（原版 0.5.12.13 解码后 16,087 段落，脚本 %TEMP%\mce_writeinit2.js）：
   - StoryInit 仅 355 B / 只跑 <<variablesStatic>>，且原文注明「在故事变量载入前执行、每个 $ 都是 undefined」。
   - 新档真正的 $ 初始化入口是 Start → Start2 → <<variablesStart2>>（<<variablesStart>> 全库零调用者，
     探针 %TEMP%\mce_callers.js）。
   - 判据 = 段落前 6 行内做「$K.属性 = / += / ++ / <<set $K.属性>>」写入的键 ∩ (gameStartOnly ∪ variablesStart2)
     的差集 → 151 条子入口只剩 2 组真缺口：
       $gwylan（Forest Gwylan Lure 第 3 行 <<set $gwylan.lureDistance -= 5>>，原版只在 Widgets Named Npcs 建壳）
       $pubfame（Hospital Keycard Receptionist 首屏 <<set $pubfame.hospital to {}>>，原版只在 SV Pub Fame Intro 建壳）
     其余 $compound/$docks/$livestock/$harper_appointments 均在 <<variablesStart2>> 内新档必建；
     $wraith 由 <<gameStartOnly>> 建壳（子键写入不崩）；$island/$prison/$farm 已有分支覆盖。 */
try {
  const api65 = setup.mbStageCE;
  const V65 = global.V;
  const bk65 = { gwylan: V65.gwylan, pubfame: V65.pubfame, forest: V65.forest, MathClamp: Math.clamp };

  /* 65.1~65.3 $gwylan 建壳：字面量照抄原版 Widgets Named Npcs */
  delete V65.gwylan; delete V65.forest;
  api65.ensureSceneStateFor("Forest Gwylan Lure");
  assert(!!V65.gwylan && typeof V65.gwylan === "object", "65.1 格威岚引诱段 → 建 $gwylan 壳, 实际 " + JSON.stringify(V65.gwylan));
  assert(["progress", "stage", "sea", "wary", "robin", "purged", "timer", "request", "requestCount", "requestDone"]
    .every(k => k in V65.gwylan), "65.2 $gwylan 十字段齐（对齐原版 Widgets Named Npcs 字面量）, 实际 " + Object.keys(V65.gwylan).join(","));
  assert(V65.gwylan.lureDistance === 15 && V65.gwylan.lureWill === 0,
    "65.3 $forest 缺失时 lureDistance 落 clamp 下界 15（原版 Math.clamp($forest,15,100)）, 实际 " + V65.gwylan.lureDistance + "/" + V65.gwylan.lureWill);

  /* 65.4~65.5 只补不覆盖：已有进度与已有距值一律保留 */
  V65.forest = 60;
  api65.ensureSceneStateFor("Forest Gwylan Lure");
  assert(V65.gwylan.progress === 0 && V65.gwylan.lureDistance === 15,
    "65.4 二次进入不重复初始化（progress 仍 0、lureDistance 仍 15，不按 $forest=60 重算）, 实际 " + V65.gwylan.progress + "/" + V65.gwylan.lureDistance);
  V65.gwylan = { progress: 7, stage: 3, lureDistance: 42, robin: 2 };
  api65.ensureSceneStateFor("Forest Gwylan Lure");
  assert(V65.gwylan.progress === 7 && V65.gwylan.stage === 3 && V65.gwylan.lureDistance === 42 && V65.gwylan.requestDone === false,
    "65.5 已有进度完整保留、只补缺失键（progress=7/stage=3/lureDistance=42 + 补 requestDone）, 实际 " + JSON.stringify(V65.gwylan));

  /* 65.6 新档 $forest 存在时按 Math.clamp 取真值（不是恒 15） */
  delete V65.gwylan; V65.forest = 60;
  api65.ensureSceneStateFor("Forest Gwylan Lure");
  assert(V65.gwylan.lureDistance === 60, "65.6 $forest=60 → lureDistance=60（clamp(60,15,100) 真值, 非硬编码 15）, 实际 " + V65.gwylan.lureDistance);
  delete V65.gwylan; V65.forest = 3;
  api65.ensureSceneStateFor("Forest Gwylan Lure");
  assert(V65.gwylan.lureDistance === 15, "65.7 $forest=3 低于下界 → 钳到 15, 实际 " + V65.gwylan.lureDistance);

  /* 65.8~65.9 $pubfame 建壳：字面量照抄原版 SV Pub Fame Intro */
  delete V65.pubfame;
  api65.ensureSceneStateFor("Hospital Keycard Receptionist");
  assert(!!V65.pubfame && Array.isArray(V65.pubfame.seen) && Array.isArray(V65.pubfame.tasksDone),
    "65.8 医院门禁卡前台 → 建 $pubfame 壳 {seen:[],tasksDone:[]}, 实际 " + JSON.stringify(V65.pubfame));
  V65.pubfame = { seen: ["hospital"], tasksDone: ["t1"], hospital: {} };
  api65.ensureSceneStateFor("Brothel Stage");
  assert(V65.pubfame.seen.length === 1 && V65.pubfame.tasksDone[0] === "t1" && V65.pubfame.hospital && V65.pubfame.hospital.constructor === Object,
    "65.9 妓院段同享兜底且不覆盖已见列表（seen/tasksDone/hospital 原样保留）, 实际 " + JSON.stringify(V65.pubfame));

  /* 65.10~65.11 无副作用的边界：无关段落不新增任何键 / 空名与非法 V 不崩 */
  const keysBefore = Object.keys(V65).sort().join(",");
  api65.ensureSceneStateFor("Bedroom Robin Christmas Wrap");
  assert(Object.keys(V65).sort().join(",") === keysBefore, "65.10 无关段落零副作用（不凭空新增 $gwylan/$pubfame）");
  api65.ensureSceneStateFor("");
  api65.ensureSceneStateFor(null);
  assert(true, "65.11 空名/null 段名不抛异常");

  /* 65.12 补壳函数对数组与嵌套对象的深补（$compound 的 theft 是三键对象、symbol 是数组） */
  const sh = api65.mbCEFillShapeV({ alarm: 5, theft: { centre: true } }, { alarm: 0, theft: { centre: false, pipes: false }, symbol: [] });
  assert(sh.alarm === 5 && sh.theft.centre === true && sh.theft.pipes === false && Array.isArray(sh.symbol),
    "65.12 深补只填缺失：alarm/theft.centre 保留、theft.pipes 补 false、symbol 补数组, 实际 " + JSON.stringify(sh));

  // 收尾还原
  if (bk65.gwylan === undefined) { delete V65.gwylan; } else { V65.gwylan = bk65.gwylan; }
  if (bk65.pubfame === undefined) { delete V65.pubfame; } else { V65.pubfame = bk65.pubfame; }
  if (bk65.forest === undefined) { delete V65.forest; } else { V65.forest = bk65.forest; }
  if (bk65.MathClamp === undefined) { delete Math.clamp; } else { Math.clamp = bk65.MathClamp; }
} catch (e65) {
  failures++;
  console.error("FAIL: 65 v2.0.17 子入口状态兜底测试异常: " + (e65 && e65.stack ? e65.stack : e65));
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : "\n" + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
