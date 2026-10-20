// CE 版运行时自检：模拟框架原生 romanceConditions（与 inject_early.js 一致的源码形态），
// 验证角色池枚举、条件解析/一键完成、转化阶段、数值补齐、全局批量、容错。
"use strict";
const fs = require("fs");
const path = require("path");

// v2：直接读取纯 JS 版（scriptFileList_inject_early 加载链）
// v1.9.0：测试读 git 源构建产物（javascript/maplebirchce.js），与打包源解耦；
// 可用环境变量 MCE_PKG_JS 覆盖为打包源路径（run_all.ps1 提供 --sync-pkg 后设此变量）。
const jsPath = process.env.MCE_PKG_JS || path.join(__dirname, "..", "javascript", "maplebirchce.js");
const js = fs.readFileSync(jsPath, "utf8");
fs.writeFileSync(path.join(__dirname, "mce_script.js"), js);

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

// ---- 原生恋爱 NPC（阿电：v0.1.880 走 DOL 原生注册，非 Maplebirch 池） ----
setup.loveAlias = { "阿电": function () {} };
V.loveInterest = [];
V.adian_romance = 0;
// ---- 扩展转化系统（v0.1.880 兔子/人鱼：setup.myTFSet 公共 API + V.rabbit/V.mermaid） ----
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

// 8.3) 扩展转化（v0.1.880 兔子/人鱼：setup.myTFSet 公共 API）
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
  "Orphanage", "Temple", "ManorHall", "Forest Shop", "Avery", "Kylar Abduction Intro"
];
// 模拟 SugarCube 2.36.1：无 Story.passages，场景页经 lookupWith 枚举段落名
global.Story = { has: (n) => PLACE_NAMES.indexOf(n) !== -1, lookupWith: (fn) => PLACE_NAMES.map(n => ({ name: n, text: "" })).filter(fn) };
let lap10 = api.listAllPassages();
assert(lap10.length === PLACE_NAMES.length, "listPlaceGroups 经 lookupWith 枚举全部段落, 实际 " + lap10.length);
let pGroups = api.listPlaceGroups();
assert(pGroups.length === 8, "场景分组 8 组（v1.7.0 新增多伦公寓/麋鹿街大院）, 实际 " + pGroups.length);
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
assert(totalItems === 24, "干扰段落不误入（总 24 段）, 实际 " + totalItems);
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
assert(api.listPlaceGroups().reduce((s, x) => s + x.items.length, 0) === 24, "兼容路径下场景分组总数不变");

// 11) 固定触发队列 / 回退 / 联动解锁（v1.2）：按顺序触发 + 一次性 + 场景解锁
global.Story = { lookupWith: (fn) => [{ name: "Scene Viewer", text: SCENE_TEXT }].filter(fn) };
const wikiCalls = [];
window.wikifier = (n) => { wikiCalls.push(n); };
let playedBack = null;
global.Engine = { play: (n, h) => { playedBack = n + ":" + !!h; } };
V.passage = "Orphanage";
// 11.1) 未固定时不干预
const pa1 = { name: "Orphanage" };
api.onPassageOverride(pa1);
assert(pa1.name === "Orphanage" && !V.replayScene && wikiCalls.length === 0, "未固定时钩子不干预");
// 11.2) 固定触发：写入队列（mbCE_queue），保持追加顺序
let robinLine2 = api.listSceneLines(api.getScenesDefs().defs).lines.find(l => /RobinCrossdressing/i.test(l.prefix));
let pinR = api.pinScene(robinLine2.items[1]);
assert(pinR.ok && Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === "RobinCrossdressing2" && V.mbCE_queue[0].startPassage === "Robin Crossdressing 2" && V.mbCE_queue[0].used === false, "固定触发：写入队列, 实际 " + JSON.stringify(V.mbCE_queue));
// 11.2b) 队列顺序：再固定 2 条，按追加顺序排列
let singles11 = api.listSceneLines(api.getScenesDefs().defs).singles;
let pinB1 = api.pinScene(singles11[0]);
let pinB2 = api.pinScene(singles11[1]);
assert(pinB1.ok && pinB2.ok && V.mbCE_queue.length === 3 && V.mbCE_queue[1].key === singles11[0].key && V.mbCE_queue[2].key === singles11[1].key, "固定队列按追加顺序排列, 实际 " + V.mbCE_queue.map(x => x.key).join());
// 11.2c) 重复固定同一剧情 → 拒绝不追加
let pinDup = api.pinScene(robinLine2.items[1]);
assert(pinDup.ok === false && V.mbCE_queue.length === 3, "重复固定 → 拒绝不追加");
// 11.3) 目标段落就在场景内 → 不触发
const pa2 = { name: "Robin Crossdressing 2" };
api.onPassageOverride(pa2);
assert(pa2.name === "Robin Crossdressing 2" && !V.replayScene, "目标在场景内段落 → 不触发");
// 11.4) 场景外段落（下次推进/遇见）→ 触发队首（Robin），标记 used（一次性），重定向入口
const pa3 = { name: "Orphanage" };
api.onPassageOverride(pa3);
assert(pa3.name === "Robin Crossdressing 2", "场景外段落 → 重定向队首剧情入口, 实际 " + pa3.name);
assert(V.replayScene && V.replayScene.name === "Robin Crossdressing 2" && V.replayScene.exitpassage === "Orphanage", "设置原版重放通道（name/exitpassage=原位）");
assert(wikiCalls.indexOf("freezePlayerStats") !== -1, "启动时调用原版 freezePlayerStats");
assert(V.mbCE_queue[0].used === true, "触发后队首标记 used（一次性，不再重复触发）");
// 11.5) 重放中 → 不重复触发（交给原版 Scene viewer redirect）
const pa4 = { name: "Park" };
api.onPassageOverride(pa4);
assert(pa4.name === "Park" && V.replayScene, "重放中钩子不干预");
// 11.6) 重放结束（Scene Viewer End）→ 清理 used 项（自动推进到下一固定）
const pa5 = { name: "Scene Viewer End" };
api.onPassageOverride(pa5);
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 2 && V.mbCE_queue[0].key === singles11[0].key, "重放结束移除已 used 项（自动推进到下一固定）, 实际 " + JSON.stringify(V.mbCE_queue));
/* 模拟原版 Scene viewer redirect 收尾（真实游戏中玩家点「结束回放」后由原版执行） */
window.wikifier("unfreezePlayerStats");
delete V.replayScene;
// 11.7) 顺序触发：触发队首（TempleSydneyCorrupt）→ used → 再触发时推进下一项
const pa6 = { name: "Dorm" };
api.onPassageOverride(pa6);
assert(pa6.name === singles11[0].def.startPassage && V.mbCE_queue[0].used === true, "触发队首并重定向其入口（顺序）");
const pa7 = { name: "Scene Viewer End" };
api.onPassageOverride(pa7);
assert(V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === singles11[1].key, "顺序触发推进：剩最后一项");
// 11.7b) 场景联动解锁：触发悉尼神殿剧情后，神殿组自动解锁（场景页可直达）
assert(V.mbCE_unlockedPlaces && V.mbCE_unlockedPlaces.sydney_temple && V.mbCE_unlockedPlaces.sydney_temple.startPassage === "SV Sydney Temple Corrupt", "场景联动解锁：触发剧情后对应场景组解锁, 实际 " + JSON.stringify(V.mbCE_unlockedPlaces));
window.wikifier("unfreezePlayerStats");
delete V.replayScene;
// 11.8) 回退（指定 key）：取消队列中指定剧情
let unp1 = api.unpinScene(singles11[1].key);
assert(unp1 && V.mbCE_queue.length === 0, "回退指定剧情 → 队列移除该项");
// 11.9) 回退（无参）：清空队列 + 结束重放（unfreeze + 回原位）
let pinS2 = api.pinScene(robinLine2.items[0]);
const pa8 = { name: "Temple" };
api.onPassageOverride(pa8);
assert(V.replayScene && V.mbCE_queue[0].used, "固定+触发（为回退造重放现场）");
let unp2 = api.unpinScene();
assert(unp2 && V.mbCE_queue.length === 0 && !V.replayScene, "无参回退：清空队列并结束重放");
assert(wikiCalls.indexOf("unfreezePlayerStats") !== -1, "回退时调用原版 unfreezePlayerStats");
assert(playedBack === "Orphanage:true", "回退后 Engine.play 返回原位, 实际 " + playedBack);
// 11.10) 缺入口段落 → 固定失败不写入
let badPin = api.pinScene({ key: "X", def: { name: "X", passages: [], startPassage: "" } });
assert(badPin.ok === false && V.mbCE_queue.length === 0, "缺入口段落 → 固定失败不写入");
// 11.11) 旧版兼容迁移：v1.1 mbCE_pinned → 队列（视为已触发过，不再触发）
V.mbCE_pinned = { key: "OLD", name: "旧固定", startPassage: "OldStart", passages: [], manualVariableChanges: "", active: true };
const pa9 = { name: "Elsewhere" };
api.onPassageOverride(pa9);
assert(pa9.name === "Elsewhere" && !V.replayScene, "旧 mbCE_pinned 迁移为 used → 不触发");
assert(Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 1 && V.mbCE_queue[0].key === "OLD" && V.mbCE_queue[0].used === true, "旧 mbCE_pinned 并入队列且 used");
delete V.mbCE_pinned;
delete V.mbCE_queue;
delete V.mbCE_unlockedPlaces;
delete global.Engine;

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
// 13.2) 农场依赖剧情（Scene Viewer passages + farm_work_update）：$farm 未初始化 → 固定被拒（防崩）
delete V.farm; delete V.farm_stage;
let farmPin = api.pinScene({ key: "FARM", def: { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], manualVariableChanges: "<<set $sceneViewSwitch to 'AlexFarmWorkStage3'>><<farm_work_update>>" } });
assert(farmPin.ok === false && V.mbCE_queue && V.mbCE_queue.length === 0, "农场剧情 $farm 缺失 → 固定被拒, 实际 " + JSON.stringify(farmPin));
// 13.3) 农场依赖剧情：$farm 初始化后允许固定
V.farm = {};
let farmPin2 = api.pinScene({ key: "FARM2", def: { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], manualVariableChanges: "<<set $sceneViewSwitch to 'AlexFarmWorkStage3'>><<farm_work_update>>" } });
assert(farmPin2.ok === true, "$farm 存在 → 可固定");
// 13.4) onPassageOverride：农场依赖且 $farm 缺失 → 本次不触发（不崩，队列项保留）
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
// 15.7) 取消固定（重放中）→ 清 sceneViewSwitch（防被困播放器）+ 返回原位
V.sceneViewSwitch = "AlexFarmWorkStage3";
api.unpinScene();
assert(V.sceneViewSwitch === "MB_CE_END" && !V.replayScene, "取消固定清 sceneViewSwitch 与 replayScene");
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
delete global.Story;
// 15.10) 农场剧情逃逸终点（Farm Work）→ 清理残留重放，后续项可触发；其它链外段落仍视为重放中不干预
V.replayScene = { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true; V.mbCE_replayPending = false;
V.mbCE_queue = [{ key: "FARM4", name: "Farm Stage 4", startPassage: "Scene Viewer passages", passages: ["Farm Stage 4"], manualVariableChanges: "", used: false }];
let paL = { name: "Farm Work" };
api.onPassageOverride(paL);
assert(paL.name === "Scene Viewer passages" && V.replayScene && V.replayScene.name === "Farm Stage 4" && V.mbCE_replayPending === true, "Farm Work 终点清理残留并启动下一项重放, paL.name=" + paL.name);
// 15.10b) 重放中走到其它链外段落（剧情中间段落不在列表）→ 不干预、不触发
V.replayScene = { name: "Farm Stage 3", startPassage: "Scene Viewer passages", passages: ["Farm Visitor"], exitpassage: "Danube Street" };
V.mbCE_replayOnce = true;
V.mbCE_queue = [{ key: "FARM4", name: "Farm Stage 4", startPassage: "Scene Viewer passages", passages: ["Farm Stage 4"], manualVariableChanges: "", used: false }];
let paLb = { name: "Farm Barn" };
api.onPassageOverride(paLb);
assert(paLb.name === "Farm Barn" && V.replayScene && V.replayScene.name === "Farm Stage 3", "链外段落仍视为重放中（不误清不误触发）");
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
assert(V.mliState.score === 5, "18.5 越上限钳制到 5, 实际 " + V.mliState.score);
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
// 18.8) 回退：还原首次写入前状态；二次回退无痕迹
api.undoCheatModValue("cheatTestA", "value_set:score");
assert(V.mliState.score === 5, "18.8 回退还原 before=5, 实际 " + V.mliState.score);
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
assert(mli && mli.declared === true && mli.values.length === 1 && mli.values[0].key === "loveInterestList", "18.14 适配器探测命中：MLI 自动识别并声明 loveInterestList");
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
assert(rbr.stages.length === 17 && rbr.abilities.length === 21 && rbr.scenes.length === 1 && rbr.values.length === 18, "19.1 分组齐全 阶段17/能力21/剧情1/数值18（v1.6.0 补录 LostLamb+TempleDuties）, 实际 " + rbr.stages.length + "/" + rbr.abilities.length + "/" + rbr.scenes.length + "/" + rbr.values.length);
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
// 19.6) 能力：唱诗入团 / 领唱 / 挂坠 / 双誓约
api.toggleCheatAbility("revelation-the-book-of-return", "tc_joined", true);
assert(V.TempleChoir.joined === true, "19.6 唱诗班入团 true");
api.toggleCheatAbility("revelation-the-book-of-return", "tc_lead", true);
assert(V.TempleChoir.lead === true, "19.6 领唱资格 true");
api.toggleCheatAbility("revelation-the-book-of-return", "rt_pendant", true);
assert(V.RobinTemple.pendant === true, "19.6 挂坠 true");
// 19.7) 数值：唱诗熟练度 / 恩典钳制
api.applyCheatModValue("revelation-the-book-of-return", "tc_singing", 5000);
assert(V.TempleChoir.singing === 1000, "19.7 歌唱熟练度钳制 1000, 实际 " + V.TempleChoir.singing);
api.applyCheatModValue("revelation-the-book-of-return", "rt_grace", 999);
assert(V.RobinTemple.grace === 100, "19.7 恩典钳制 100, 实际 " + V.RobinTemple.grace);
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
assert(drb.stages.length === 1 && drb.abilities.length === 12 && drb.values.length === 3, "20.1 分组齐全 阶段1/能力12/数值3, 实际 " + drb.stages.length + "/" + drb.abilities.length + "/" + drb.values.length);
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
// 20.5) 数值钳制：打赢次数 0-99 / 直播开关 0-1
api.applyCheatModValue("dom_robin", "rf_chain", 200);
assert(V.robinFightChain === 99, "20.5 打赢次数钳制 99, 实际 " + V.robinFightChain);
api.applyCheatModValue("dom_robin", "ls_on", 5);
assert(V.liveStream === 1, "20.5 直播开关钳制 1, 实际 " + V.liveStream);
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
assert(dwd.stages.length === 8 && dwd.abilities.length === 15 && dwd.values.length === 20, "21.1 分组齐全 阶段8/能力15/数值20（v1.8.7 补 2.4.2 新增的拒绝收养能力）, 实际 " + dwd.stages.length + "/" + dwd.abilities.length + "/" + dwd.values.length);
// 21.2) 隔离：只声明 maplebirch 模块自建一级键（RobinExpansion/LifeSimulation/StreetLife/BirdTower/VanillaPlus），
//        不碰原版顶层键（rebellion/victories/self_rent/both_rent/rent_separated 等原版同名键均不声明）
var dwdPaths = [];
dwd.stages.concat(dwd.abilities).concat(dwd.values).forEach(function (it) { dwdPaths.push(it.varPath); });
var dwdRoots = [];
dwdPaths.forEach(function (p) { if (dwdRoots.indexOf(p.split(".")[0]) === -1) { dwdRoots.push(p.split(".")[0]); } });
assert(dwdRoots.every(function (r) { return ["RobinExpansion", "LifeSimulation", "StreetLife", "BirdTower", "VanillaPlus", "Finance"].indexOf(r) !== -1; }),
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
assert(V.RobinExpansion.reserve === 1000000, "21.6 储备金钳制 1000000, 实际 " + V.RobinExpansion.reserve);
api.applyCheatModValue("deadwood-reblooms", "bt_ring", 9);
assert(V.BirdTower.ring.kept === 2, "21.6 金戒指钳制 2, 实际 " + V.BirdTower.ring.kept);
api.applyCheatModValue("deadwood-reblooms", "sl_race_wins", 3);
assert(V.StreetLife.races.wins === 3, "21.6 公路赛胜场 3, 实际 " + V.StreetLife.races.wins);
api.applyCheatModValue("deadwood-reblooms", "ls_corruption", 150);
assert(V.LifeSimulation.school.corruption === 100, "21.6 腐败钳制 100, 实际 " + V.LifeSimulation.school.corruption);
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
// 清理 21 节
delete V.RobinExpansion; delete V.LifeSimulation; delete V.StreetLife; delete V.BirdTower; delete global.window;
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
assert(Array.isArray(ch2) && ch2.length === 15, "框架缺失时 listCharacters 从存档兜底不抛错: " + ch2.length);

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
assert(mcN2.ok && V.TestMod.num1 === 100, "24.3 越界钳制：999 → 100");
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
// 25.12) 触发处 pending 条件化：直入剧情段落的场景（startPassage≠"Scene Viewer passages"）不设 pending
V.mbCE_queue = [];
V.passage = "Town";
var pinR25 = api.pinScene({ key: "WhitneyOrphanageVisit", def: { name: "Whitney Orphanage Visit", startPassage: "SV Street Bully Orphanage Go", passages: ["SV Street Bully Orphanage Go"], manualVariableChanges: "" } });
assert(pinR25.ok === true, "25.12 固定孤儿院场景入队, msg=" + pinR25.message);
var ov25e = { name: "Town" };
api.onPassageOverride(ov25e);
assert(ov25e.name === "SV Street Bully Orphanage Go", "25.13 触发：dest 改为直入段落（孤儿院 startPassage）, 实际 " + ov25e.name);
assert(V.mbCE_replayPending === false && V.mbCE_replayOnce === true, "25.14 直入段落场景：pending 不设（false）、replayOnce=true, 实际 pending=" + V.mbCE_replayPending);
// 25.15) 孤儿院播放完链回 Scene Viewer passages → 无 pending 残留 → 自动回原位
V.replayScene = { name: "Whitney Orphanage Visit", startPassage: "SV Street Bully Orphanage Go", passages: ["SV Street Bully Orphanage Go"], exitpassage: "Town" };
V.mbCE_replayPending = false;
var ov25f = { name: "Scene Viewer passages" };
api.onPassageOverride(ov25f);
assert(ov25f.name === "Town", "25.15 孤儿院链回 passages：自动回原位（无 pending 残留）, 实际 " + ov25f.name);
assert(!V.replayScene && Array.isArray(V.mbCE_queue) && V.mbCE_queue.length === 0, "25.16 孤儿院链回 passages：replayScene 清理 + 队列清空");
delete V.mbCE_queue; delete V.replayScene; delete V.mbCE_replayOnce; delete V.mbCE_replayPending; delete V.passage;

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
assert(V.LifeSimulation.school.duties.completed === 999, "26.3 值勤次数钳制 999, 实际 " + V.LifeSimulation.school.duties.completed);
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
assert(V.RobinExpansion.weekly_income === 1000000, "26.6 周收入钳制 1000000, 实际 " + V.RobinExpansion.weekly_income);
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
assert(V.RobinTemple.secret.rite_round === 99, "26.9 同席连续次数钳制 99, 实际 " + V.RobinTemple.secret.rite_round);
api24.applyCheatModValue("revelation-the-book-of-return", "rt_intimacy_count", 12);
assert(V.RobinTemple.intimacy_count === 12, "26.9 亲密累计次数 12, 实际 " + V.RobinTemple.intimacy_count);
api24.applyCheatModValue("revelation-the-book-of-return", "rt_evaluation_marks", 200);
assert(V.RobinTemple.evaluation_marks === 100, "26.9 评估分数钳制 100, 实际 " + V.RobinTemple.evaluation_marks);
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
// 27.7) 获取艾弗里的救星：avery_fate=saved
var ga = api24.grantNpcTrait("avery_saviour");
assert(ga.ok && V.avery_fate === "saved", "27.7 获取艾弗里救星：avery_fate=saved, 实际 " + V.avery_fate);
// 27.8) 未知特质拒绝
var gx = api24.grantNpcTrait("no_such_trait");
assert(gx.ok === false && gx.message.indexOf("未知特质") !== -1, "27.8 未知特质拒绝, 实际 " + gx.message);
// 27.9) 清理
delete V.player; delete V.templePromised; delete V.temple_rank; delete V.temple_burden; delete V.brokenVowCount; delete V.robinpaid; delete V.syndromeeden; delete V.syndromekylar; delete V.syndromewolves; delete V.syndromebird; delete V.avery_fate; delete V.location; delete global.C;

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

// 30) v1.5.2 剧情页页首使用提示（用户给定文案，页首常驻、位于固定触发横幅之前）
const SRC_NOW = fs.readFileSync(jsPath, "utf8");
const WARN_TXT = "使用提示：当你使用固定触发后，会一直循环。当出现退出场景时，回到此页面取消队列。之后你会被困在场景播放器中，请使用场景直达退出去。";
assert(SRC_NOW.includes(WARN_TXT), "30.1 剧情页页首提示文案已写入源码（用户给定全文）");
const RSI = SRC_NOW.indexOf("function renderScenes()");
const RNEXT = SRC_NOW.indexOf("固定触发状态横幅", RSI);
const WARN_I = SRC_NOW.indexOf("mce-warn", RSI);
assert(RSI >= 0 && RNEXT > RSI && WARN_I > RSI && WARN_I < RNEXT, "30.2 提示位于 renderScenes 页首（固定触发横幅之前）");
assert(SRC_NOW.includes(".mce-warn{"), "30.3 mce-warn 警示样式已注入 CSS");

// ============ 第 31 节：v1.6.0 归途之书 1.3.4 补录——LostLamb + TempleDuties 适配（1.3.1 起漏适配根因闭环） ============
global.window = { maplebirch: { npc: {}, get: function (n) { return (n === "RobinTemple" || n === "TempleChoir" || n === "LostLamb" || n === "TempleDuties" || n === "DeadwoodReblooms") ? {} : undefined; } } };
delete V.mbCE_wrote;
V.LostLamb = { recalled: false, active: false, scene: "", doubt: 0, fear: 10, notice: 0, ending: "", talkVow: "", known: { bishop: false, gwylan: false, auriga: false } };
V.TempleDuties = { enrolled: false, review: false, duties: 0, oath: "", bishop: "none", manor: "none", declaration: "private", watch: { phase: "threshold" }, case: { stage: "field" }, archive: { roof: -1, shelves: -1, sorted: 0 }, candidates: { Robin: { agreed: false }, Sydney: { agreed: false } } };
var r31 = api.getCheatMods().filter(function (x) { return x.modId === "revelation-the-book-of-return"; })[0];
assert(r31 && r31.modName.indexOf("归途之书") !== -1 && r31.modName.indexOf("1.3.8") !== -1, "31.1 适配器声明升级 1.3.8, 实际 " + (r31 && r31.modName));
assert(r31.stages.filter(function (s) { return s.key === "ll_vow"; }).length === 1 && r31.stages.filter(function (s) { return s.key === "td_oath"; }).length === 1 &&
       r31.stages.filter(function (s) { return s.varPath === "TempleDuties.watch.phase"; }).length === 1 &&
       r31.stages.filter(function (s) { return s.varPath === "TempleDuties.case.stage"; }).length === 1, "31.1 LostLamb 誓约 / TempleDuties 誓言·守夜·案件阶段已收录");
assert(r31.abilities.filter(function (a) { return a.varPath === "LostLamb.known.bishop"; }).length === 1 &&
       r31.abilities.filter(function (a) { return a.varPath === "TempleDuties.candidates.Robin.agreed"; }).length === 1, "31.1 秘密/候选能力已收录");
// 31.2) LostLamb 阶段写入读回
var rll = api.setCheatStage("revelation-the-book-of-return", "ll_vow", "sealed");
assert(rll.ok && V.LostLamb.talkVow === "sealed", "31.2 LostLamb 誓约写入 sealed, 实际 " + V.LostLamb.talkVow);
var rll2 = api.setCheatStage("revelation-the-book-of-return", "ll_ending", "main");
assert(rll2.ok && V.LostLamb.ending === "main", "31.2 梦境结局写入 main");
// 31.3) LostLamb 数值钳制
api.applyCheatModValue("revelation-the-book-of-return", "ll_fear", 999);
assert(V.LostLamb.fear === 100, "31.3 恐惧越上限钳制到 100, 实际 " + V.LostLamb.fear);
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
var rtd3 = api.setCheatStage("revelation-the-book-of-return", "td_watch", "seal");
assert(rtd3.ok && V.TempleDuties.watch.phase === "seal", "31.5 守夜阶段写入 seal");
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
// 31.8) 宿主缺失拒绝：watch=null 时写守夜阶段 → 拒绝且不崩（防 undefined 写）
V.TempleDuties.watch = null;
var rnull = api.setCheatStage("revelation-the-book-of-return", "td_watch", "passed");
assert(rnull.ok === false && /宿主不存在/.test(rnull.message), "31.8 watch=null 拒绝写入不崩（" + rnull.message + "）");
V.TempleDuties.watch = { phase: "threshold" };
// 31.9) 回退
api.undoCheatModValue("revelation-the-book-of-return", "value_set:td_duties");
assert(V.TempleDuties.duties === 0, "31.9 值勤次数回退到 0, 实际 " + V.TempleDuties.duties);
api.undoCheatModValue("revelation-the-book-of-return", "value_set:ll_fear");
assert(V.LostLamb.fear === 10, "31.9 恐惧回退到初始 10");
// 31.10) 原版键隔离：不暴露 temple_rank/templePromised
assert(r31.values.filter(function (v) { return v.varPath === "temple_rank" || v.varPath.indexOf("temple_rank") !== -1 || v.varPath.indexOf("templePromised") !== -1; }).length === 0 &&
       r31.stages.filter(function (s) { return s.varPath === "temple_rank" || s.varPath.indexOf("temple_rank") !== -1; }).length === 0, "31.10 原版神殿变量未暴露");
delete V.LostLamb; delete V.TempleDuties; delete V.mbCE_wrote;

// ============ 第 32 节：v1.6.0 枯木逢春 2.2.7 核对——vanilla-plus attitudes 新能力 + 旧声明兼容 ============
V.RobinExpansion = { shop_stage: "none", asylum: { status: "home" } };
V.VanillaPlus = { attitudes: { ironWill: true, sadomasochist: false } };
var dw32 = api.getCheatMods().filter(function (x) { return x.modId === "deadwood-reblooms"; })[0];
assert(dw32 && dw32.modName.indexOf("枯木逢春") !== -1 && dw32.modName.indexOf("2.4.2") !== -1, "32.1 适配器声明升级 2.4.2, 实际 " + (dw32 && dw32.modName));
assert(dw32.abilities.filter(function (a) { return a.varPath === "VanillaPlus.attitudes.ironWill"; }).length === 1 &&
       dw32.abilities.filter(function (a) { return a.varPath === "VanillaPlus.attitudes.sadomasochist"; }).length === 1, "32.1 铁意志/受虐狂能力已收录");
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

// ============ 第 33 节：v1.6.0 SmartPhone Alpha 0.3.91 新增适配（V.Phone 探测 + 0/1 数字语义） ============
V.Phone = { Owned: [], photography: 0, TaskDanger: 0, FengMeeet: 0, MetFengGiveup: 0, SecondShopKnown: 0, FengAcceptExposed: 0, SydneySexLiveCompanion: 0, FengLine: 0 };
var sp33 = api.getCheatMods().filter(function (x) { return x.modId === "smartphone"; })[0];
assert(sp33 && sp33.values.filter(function (v) { return v.varPath === "Phone.photography"; }).length === 1, "33.1 适配器探测命中（V.Phone）");
assert(sp33.values.filter(function (v) { return v.varPath === "Phone.TaskDanger"; })[0].max === 1, "33.1 危险任务模式 0/1 钳制上限");
// 33.2) 数值写入读回 + 钳制
api.applyCheatModValue("smartphone", "sp_photography", 500);
assert(V.Phone.photography === 500, "33.2 摄影技能写入 500");
api.applyCheatModValue("smartphone", "sp_photography", 2000);
assert(V.Phone.photography === 1000, "33.2 摄影越上限钳制到 1000");
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
		set textContent(v) { this._text = String(v); },
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
	const m = sel.match(/^\[data-(\w+)="([^"]+)"\]$/);
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
	node.children.forEach(function (c) {
		const m = sel.match(/^\[data-(\w+)="([^"]+)"\]$/);
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
assert(/剧情条件解锁面板 v1\.\d+\.\d+收起/.test(root37.textContent), "37.2 面板标题版本号动态化（不再写死 v1.2）, 实际 " + root37.textContent.slice(0, 60));
api37.renderPlayerEdit();
let pane37 = root37.querySelector('[data-pane="mods"]');
let txt37 = pane37.textContent;
assert(txt37.indexOf("玩家自己 · 属性与特质") !== -1, "37.2 页面标题中文化, 实际 " + txt37.slice(0, 80));
assert(txt37.indexOf("游戏属性面板（颜色分级）快捷编辑") !== -1, "37.2 快捷编辑区保留, 实际 " + txt37.slice(0, 120));
assert(txt37.indexOf("特质管理") !== -1 && txt37.indexOf("一般特质") !== -1, "37.2 特质管理区+一般特质分类出现, 实际 " + txt37.slice(0, 300));
assert(txt37.indexOf("童贞") !== -1 && (txt37.indexOf("○ 童贞") !== -1 || txt37.indexOf("● 童贞") !== -1), "37.2 童贞行中文显示（拥有 ● 或未拥有 ○）, 实际 " + txt37.slice(0, 300));
assert(txt37.indexOf("神殿之担") !== -1 && txt37.indexOf("改数值") !== -1, "37.2 神殿之担行+改数值按钮出现, 实际 " + txt37.slice(0, 400));
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
// 37.3) 模组特质自动发现：maplebirch.temporary.traitLists 注入的"命运之轮"出现在面板（自动收录）
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
delete V.acceptance_penis_small; delete V.mbCE_forcedTraits;
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
assert(g38.length === 5 && g38[0].title === "核心属性" && g38[4].title === "武器技能", "38.1 快捷区 5 组（核心/基础/性/成绩/武器）, 实际 " + JSON.stringify(g38.map(x => x.title)));
let all38 = g38.reduce((a, g) => a.concat(g.items), []);
let names38 = all38.map(x => x[1]);
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
assert(api39.displayName("Tsukihan") === "月半", "40.1 Tsukihan → 月半, 实际 " + api39.displayName("Tsukihan"));
assert(api39.displayName("Rowan") === "罗文", "40.1 Rowan → 罗文, 实际 " + api39.displayName("Rowan"));
assert(api39.displayName("Adrian") === "阿德里安", "40.1 Adrian → 阿德里安, 实际 " + api39.displayName("Adrian"));
assert(api39.displayName("Marlow") === "马洛", "40.1 Marlow → 马洛, 实际 " + api39.displayName("Marlow"));
assert(api39.displayName("Grant") === "格兰特", "40.1 Grant → 格兰特, 实际 " + api39.displayName("Grant"));
assert(api39.displayName("Needmeet") === "尼德米特", "40.1 Needmeet → 尼德米特, 实际 " + api39.displayName("Needmeet"));
assert(api39.displayName("Feng") === "老冯", "40.1 Feng → 老冯, 实际 " + api39.displayName("Feng"));
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
/* 41.1）庄园自动维护 mcFeedAvery（学 AutoClean AutoCleanFeedAvery）：按喜好→牛排/舒芙蕾/扁意面→最高难度 */
V.avery_fate = "saved"; V.avery_mansion = { food: "steak", rage: {} };
V.foodstuff = { steak: { amount: 5 }, souffle: { amount: 2 } };
var feed1 = api.mcFeedAvery ? api.mcFeedAvery() : (setup.mbStageCE.mcFeedAvery ? setup.mbStageCE.mcFeedAvery() : null);
if (feed1 === null) { feed1 = { error: "mcFeedAvery 不可达" }; }
assert(feed1 && feed1.fed === "steak" && V.foodstuff.steak.amount === 4, "41.1 艾弗里投喂按喜好扣 steak，实际 fed=" + (feed1 && feed1.fed) + " amount=" + V.foodstuff.steak.amount);
V.avery_mansion.food = "linguine"; delete V.foodstuff.steak; delete V.foodstuff.souffle;
var feed2 = api.mcFeedAvery ? api.mcFeedAvery() : (setup.mbStageCE.mcFeedAvery ? setup.mbStageCE.mcFeedAvery() : { missed: true });
assert(feed2.missed === true && V.avery_mansion.rage.dinner_missed === 1, "41.1 无菜可喂 → dinner_missed+1，实际 missed=" + feed2.missed + " 计数=" + V.avery_mansion.rage.dinner_missed);
V.avery_fate = "unknown";
var feed3 = api.mcFeedAvery ? api.mcFeedAvery() : (setup.mbStageCE.mcFeedAvery ? setup.mbStageCE.mcFeedAvery() : { missed: true });
assert(feed3.skipped === true && feed3.missed !== true && V.avery_mansion.rage.dinner_missed === 1, "41.1 未达喂食阶段不操作不计 missed（对齐 AutoClean），实际 skipped=" + feed3.skipped + " 计数=" + V.avery_mansion.rage.dinner_missed);
delete V.avery_fate; delete V.avery_mansion; delete V.foodstuff;

/* 41.2）农场维护 mcMaintainFarm（学 AutoClean AutoCleanFarm）：塔卫≥1000 锁动物 / 清 aggro / stock 收获清零 */
V.farm = { tower_guard_skill: 1200, beasts: { horses: 12, pigs: 5, cattle: 8, dogs: 3 }, aggro: 1, stock: { eggs: 4, milk: 2 } };
V.farm_stage = 6;
var mf1 = api.mcMaintainFarm ? api.mcMaintainFarm() : (setup.mbStageCE.mcMaintainFarm ? setup.mbStageCE.mcMaintainFarm() : {});
assert(mf1.beasts === 4 && V.farm.beasts.horses === 30 && V.farm.aggro === 0, "41.2 塔卫≥1000 动物锁 30 + aggro 清零，实际 beasts=" + mf1.beasts + " aggro=" + V.farm.aggro);
assert(mf1.harvested === 2 && V.farm.stock.eggs === 0 && V.farm.stock.milk === 0, "41.2 库存收获并清零，实际 harvested=" + mf1.harvested + " eggs=" + V.farm.stock.eggs);
V.farmerCanSell = true;
var mf2 = api.mcMaintainFarm ? api.mcMaintainFarm() : (setup.mbStageCE.mcMaintainFarm ? setup.mbStageCE.mcMaintainFarm() : {});
assert(mf2.harvested === 0, "41.2 farmerCanSell 让位不自动收货，实际 " + mf2.harvested);
V.farmerCanSell = false;
V.farm = { tower_guard_skill: 1200, beasts: { horses: 1, pigs: 1, cattle: 1, dogs: 1 }, aggro: 1, stock: { eggs: 1, milk: 1, truffles: 1, cream: 2 } };
V.farm_stage = 6;
var mf1b = api.mcMaintainFarm ? api.mcMaintainFarm() : (setup.mbStageCE.mcMaintainFarm ? setup.mbStageCE.mcMaintainFarm() : {});
assert(mf1b.harvested === 4 && V.farm.stock.cream === 0 && V.farm.stock.truffles === 0 && V.farm.stock.eggs === 0, "41.2b 四类库存（含 cream）全部收获并清零（直接传键名，与 AutoClean 一致），实际 harvested=" + mf1b.harvested + " cream=" + V.farm.stock.cream);
delete V.farm; delete V.farm_stage; delete V.farmerCanSell;

/* 41.2c）v1.8.10 维护扩展（学 AutoClean 剩余维护面）：神殿条件锁 / 伊甸无条件锁 / 补给 / 动态打扫 */
V.skill = { housekeeping: 1200, tending: 800 };
V.temple_quarters = 55; V.temple_garden = 60;
var mt1 = api.mcMaintainTemple ? api.mcMaintainTemple() : (setup.mbStageCE.mcMaintainTemple ? setup.mbStageCE.mcMaintainTemple() : {});
assert(mt1.quarters === true && V.temple_quarters === 100 && mt1.garden === false && V.temple_garden === 60, "41.2c 神殿维护按技能条件锁：housekeeping≥1000 宿舍=100，tending<1000 花园不动，实际 quarters=" + mt1.quarters + " garden=" + mt1.garden + " temple_garden=" + V.temple_garden);
V.skill.tending = 1200;
var mt2 = api.mcMaintainTemple ? api.mcMaintainTemple() : (setup.mbStageCE.mcMaintainTemple ? setup.mbStageCE.mcMaintainTemple() : {});
assert(mt2.garden === true && V.temple_garden === 100, "41.2c 神殿维护 tending≥1000 花园=100，实际 garden=" + mt2.garden);
V.edengarden = 1; V.edenshrooms = 2; V.edenspring = 3;
var me1 = api.mcMaintainEden ? api.mcMaintainEden() : (setup.mbStageCE.mcMaintainEden ? setup.mbStageCE.mcMaintainEden() : {});
assert(me1.locked === 3 && V.edengarden === 4 && V.edenshrooms === 4 && V.edenspring === 4, "41.2c 伊甸维护无条件锁 4（三键），实际 locked=" + me1.locked);
V.soap = 3; V.salve = 5; V.bird = { materials: { wood: 2 } };
var mr1 = api.mcRestockSupplies ? api.mcRestockSupplies() : (setup.mbStageCE.mcRestockSupplies ? setup.mbStageCE.mcRestockSupplies() : {});
assert(mr1.soap === true && mr1.salve === true && mr1.wood === true && V.soap === 10 && V.salve === 10 && V.bird.materials.wood === 10, "41.2c 补给：肥皂/药膏/鹰塔木材补 10，实际 soap=" + V.soap + " wood=" + V.bird.materials.wood);
V.avery_mansion = { office: { cleaned: false }, bathroom: { cleaned: false }, bedroom: { cleaned: false }, man: { food: "steak" }, days_absent: 3 };
var mc1 = api.mcCleanMansion ? api.mcCleanMansion() : (setup.mbStageCE.mcCleanMansion ? setup.mbStageCE.mcCleanMansion() : {});
assert(mc1.rooms === 3 && V.avery_mansion.office.cleaned === true && V.avery_mansion.bedroom.cleaned === true && V.avery_mansion.days_absent === 0, "41.2c 庄园打扫动态枚举房间清零（3 间，man 非房间不动）+ days_absent=0，实际 rooms=" + mc1.rooms + " days=" + mc1.days);
delete V.skill; delete V.temple_quarters; delete V.temple_garden; delete V.edengarden; delete V.edenshrooms; delete V.edenspring; delete V.soap; delete V.salve; delete V.bird; delete V.avery_mansion;

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
assert(V.needmeet_romance === 100, "41.4 Needmeet 越上限钳制到 100");
V.options = { opt: { WornStacking: false } };
api.toggleCheatAbility("dol-optimization", "opt_worn", true);
assert(V.options.opt.WornStacking === true, "41.4 叠穿开关经 options.opt 写入，实际 " + V.options.opt.WornStacking);
V.options.DolOptimization = {};
api.applyCheatModValue("dol-optimization", "opt_wardrobe", 5000);
assert(V.options.DolOptimization.LargerWardrobeValue === 5000, "41.4 衣柜扩容值写入 5000");
api.applyCheatModValue("dol-optimization", "opt_wardrobe", 99999);
assert(V.options.DolOptimization.LargerWardrobeValue === 9999, "41.4 衣柜扩容钳制 9999");
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
api.applyCheatModValue("wraiths-reflection", "wr_conch", 1);
assert(V.SilverConchWR === 1, "41.5 银海螺获得写入 1");
delete V.WraithsReflection; delete V.necklaceThief; delete V.SilverConchWR;
/* 41.6）DoLSims：钳制 + 宿主缺失拒绝 */
api.applyCheatModValue("dolsims", "ds_sin", 5000);
assert(V.sinSims === 1000, "41.6 sinSims 越上限钳制到 1000，实际 " + V.sinSims);
var dsd = api.applyCheatModValue("dolsims", "ds_discipline", 30);
assert(dsd.ok === false && (dsd.message || "").indexOf("宿主") !== -1, "41.6 四维宿主缺失拒绝写入不崩，实际 " + (dsd.message || ""));
V.DisciplineSims = { value: 5 };
api.applyCheatModValue("dolsims", "ds_discipline", 50);
assert(V.DisciplineSims.value === 40, "41.6 纪律值钳制 40（源码 clamp），实际 " + V.DisciplineSims.value);
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

console.log(failures === 0 ? "\nALL TESTS PASSED" : "\n" + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
