/* 言灵页一键动作（07i-yanling-actions）负向与边界分支测试（branches 70→80 整改轮 · 第八批）
 *
 * 每条动作都按「三态」判：可写时真写进存档 + 留痕；键缺失 / 类型不对 / 前置未就绪时明确拒绝，
 * 不允许「面板显示成功、游戏侧静默无效」。idempotent 场景（已经是目标值）必须报 0 项改动。
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

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;

const V = { player: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0 };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
window.maplebirch = { npc: {}, temporary: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 烘干四态 ================= */
section("1 yanlingDryClothes");
V.upperwet = 2; V.lowerwet = 0; V.underupperwet = 3;
delete V.underlowerwet;           /* 缺失键 → 补 0 */
const dry = api.yanlingDryClothes();
assert(dry.ok === true && /已烘干/.test(dry.msg), "烘干返回 ok（" + dry.msg + "）");
assert(V.upperwet === 0 && V.underupperwet === 0, "非零湿度被归零");
assert(V.lowerwet === 0, "已经是 0 的项保持 0（不计数）");
assert(V.underlowerwet === 0, "缺失键补 0（不留 undefined）");
assert(/3 项湿度归零/.test(dry.msg), "统计只数真正改动项（upperwet / underupperwet / 缺失补 0 共 3 项）");
const dry2 = api.yanlingDryClothes();
assert(/0 项湿度归零/.test(dry2.msg), "再跑一次 → 0 项改动（幂等）");
V.upperwet = "wet";                 /* 字符串形态：按原版语义不写 */
const dry3 = api.yanlingDryClothes();
assert(V.upperwet === "wet", "非数字形态不硬写（保持原值，交原版处理）");
assert(!!V.mbCE_wrote["yanling:dry_clothes"], "留痕写入 yanling:dry_clothes（可查审计）");

/* ================= 2. 衣物加固 ================= */
section("2 yanlingRepairClothes");
V.worn = null;
assert(api.yanlingRepairClothes().ok === false, "无 $worn 对象 → 拒绝");
V.worn = {
  upper: { name: "shirt", integrity: 10, integrity_max: 100 },
  lower: { name: "naked", integrity: 5 },
  under_upper: undefined,
  under_lower: { name: "skirt", integrity: "abc" }   /* 非数字 → 归 0 再 +1000 */
};
window.clothingData = function (slot, w, prop) {
  if (slot === "lower") { throw new Error("boom"); }
  return 0;                                        /* 返回非法上限 → 退回 cur+1000 */
};
const rep = api.yanlingRepairClothes();
assert(rep.ok === true, "加固返回 ok（" + rep.msg + "）");
assert(V.worn.upper.integrity === 100, "自带 integrity_max=100 → 直接回满");
assert(V.worn.lower.integrity === 5, "naked 槽跳过（不加固）");
assert(V.worn.under_lower.integrity === 1000, "非数字耐久归 0 后按「当前+1000」补到 1000");
assert(/2 件耐久回满/.test(rep.msg), "统计 2 件（naked 与空槽不计）");
/* clothingData 返回有效上限的路径 */
window.clothingData = function () { return 250; };
V.worn.under_lower = { name: "skirt", integrity: 3 };
const rep2 = api.yanlingRepairClothes();
assert(V.worn.under_lower.integrity === 250, "clothingData 给出上限 250 → 按 250 回满");

/* ================= 3. 精液量 ================= */
section("3 yanlingSemen");
delete V.semen_volume; delete V.semen_amount;
const sem0 = api.yanlingSemen();
assert(sem0.ok === false && /不是男性生理档/.test(sem0.msg), "两个键都缺 → 明确说不是男性档（" + sem0.msg + "）");
V.semen_volume = 90; V.semen_amount = 20;
const sem1 = api.yanlingSemen();
assert(sem1.ok === true && V.semen_amount === 90 && V.semen_volume === 1090, "先补 amount 再抬 volume（90 / 1090）");

/* ================= 4. 精神 / 施虐 ================= */
section("4 yanlingMind / yanlingSadism");
V.control = 1000; V.hallucinogen = "x";
const mind = api.yanlingMind();
assert(mind.ok === true && /改动 0 项/.test(mind.msg), "control 已满 + hallucinogen 非数字 → 0 项改动（不硬写）");
V.control = 100; V.hallucinogen = 50;
const mind2 = api.yanlingMind();
assert(/改动 2 项/.test(mind2.msg) && V.control === 1000 && V.hallucinogen === 0, "两项都改 → 2 项");
delete V.sadism; delete V.masochism;
const sad = api.yanlingSadism();
assert(sad.ok === true && /改动 0 项/.test(sad.msg), "键缺失 → 不建垃圾键，0 项");
V.sadism = 10; V.masochism = 20;
assert(/改动 2 项/.test(api.yanlingSadism().msg) && V.sadism === 1000 && V.masochism === 1000, "存在则拉满 1000");

/* ================= 5. 种子 / 存款 / 约会 / 密码 / 成就 ================= */
section("5 杂项写入");
delete window.unlockAllSeeds;
assert(api.yanlingSeeds().ok === false, "无 unlockAllSeeds() → 拒绝（不自造数据表）");
let seedCalls = 0;
window.unlockAllSeeds = function () { seedCalls++; };
assert(api.yanlingSeeds().ok === true && seedCalls === 1, "有函数 → 调一次并报成功");
delete V.robinmoney;
assert(/无 \$robinmoney/.test(api.yanlingRobinMoney().msg), "无 $robinmoney → 拒绝");
V.robinmoney = 1234;
const rm = api.yanlingRobinMoney();
assert(rm.ok === true && V.robinmoney === 0, "有键 → 清零");
const av = api.yanlingAveryDate();
assert(av.ok === true && V.averydate === 1, "艾弗里约会写 1（原 undefined 也可写）");
const hp = api.yanlingHeadPassword();
assert(hp.ok === true && V.headpasswordknown === 1, "校长密码写 1");
V.feats = null;
assert(/无 \$feats 对象/.test(api.yanlingFeats().msg), "无 $feats → 拒绝");
V.feats = { locked: true };
const ft = api.yanlingFeats();
assert(ft.ok === true && V.feats.locked === false, "有 $feats → locked 置 false（解除限制）");

/* ================= 6. 农场 / 奶量 ================= */
section("6 yanlingFarm / yanlingMilk");
delete V.farm; delete V.fertiliser;
const farm0 = api.yanlingFarm();
assert(farm0.ok === true && /改动 0 项/.test(farm0.msg), "无农场进度 → 空转报 0 项（不报错）");
V.farm = { clearing: 0 }; V.fertiliser = { current: "x" };
assert(/改动 0 项/.test(api.yanlingFarm().msg), "clearing 已 0 + 堆肥非数字 → 0 项");
V.farm = { clearing: 3 }; V.fertiliser = { current: 7 };
const farm2 = api.yanlingFarm();
assert(V.farm.clearing === 0 && V.fertiliser.current === 12, "清场归 0、堆肥 +5（7 → 12）");
delete V.milk_max;
assert(/无 \$milk_volume/.test(api.yanlingMilk().msg), "缺奶量键 → 拒绝");
V.milk_max = 100; V.milk_volume = 30;
const milk = api.yanlingMilk();
assert(milk.ok === true && V.milk_max === 10000 && V.milk_volume === 5000, "奶量 5000 / 上限 10000");

/* ================= 7. 天气 ================= */
section("7 yanlingWeather");
delete window.setWeather;
assert(api.yanlingWeather("clear").ok === false, "无 setWeather() → 拒绝（旧 $weather 已废）");
let weatherArgs = null;
window.setWeather = function (t, force) { weatherArgs = [t, force]; };
assert(/未知天气类型/.test(api.yanlingWeather("snow").msg), "未知类型 → 拒绝并回显");
const wOk = api.yanlingWeather("thunderstorm");
assert(wOk.ok === true && /雷暴/.test(wOk.msg), "合法类型 → 中文名回显");
assert(weatherArgs && weatherArgs[0] === "thunderstorm" && weatherArgs[1] === true, "调用 setWeather(type, true)（强制切换）");
assert(Object.keys(api.YANLING_WEATHER).length === 4, "天气映射表 4 档（clear / heavyClouds / heavyPrecipitation / thunderstorm）");

/* ================= 8. NPC 槽位解析 ================= */
section("8 yanlingNpc 与 Gwylan / Kylar / Whitney");
delete V.NPCNameList;
assert(/无格威岚槽位/.test(api.yanlingGwylanBanish().msg), "无 NPCNameList → 拒绝");
V.NPCNameList = ["Robin"]; V.NPCName = [{ init: 1 }];
assert(/无格威岚槽位/.test(api.yanlingGwylanBanish().msg), "indexOf=-1（未相遇）→ 拒绝");
V.NPCNameList = ["Gwylan"]; V.NPCName = [{ init: 0 }];
assert(/尚未初始化/.test(api.yanlingGwylanBanish().msg), "init=0 → 明确说未相遇");
V.NPCName = [{ init: 1, state: "active" }];
/* 时间戳三种口径依次降级 */
delete window.DateTime; window.SugarCube = undefined; delete global.Time;
assert(/无法计算游戏内时间戳/.test(api.yanlingGwylanBanish().msg), "DateTime / Time.date 全缺 → 拒绝（不写坏 timer）");
global.Time = { date: { timeStamp: 1000 } };
const banish = api.yanlingGwylanBanish();
assert(banish.ok === true && V.NPCName[0].state === "scorned", "有 Time.date.timeStamp → 写 scorned");
assert(V.gwylan.timer.scorned === 1000 + 9 * 86400, "到期时间 = 当前 + 9 天（秒级）");
assert(V.daily.gwylan.preventProgress === true, "当日进度锁置 true（森林商店/咖啡馆/接送线跳过）");
V.gwylan = { timer: { scorned: 1, nobody: 2 } }; V.daily = { gwylan: { preventProgress: true } };
const recall = api.yanlingGwylanRecall();
assert(recall.ok === true && V.NPCName[0].state === "active", "召回 → state=active");
assert(V.gwylan.timer.scorned === undefined && V.gwylan.timer.nobody === undefined, "两个倒计时都清掉");
assert(V.daily.gwylan.preventProgress === false, "解除当日进度锁");
/* 无 timer 的召回（只清 state） */
V.gwylan = {}; V.daily = null;
assert(api.yanlingGwylanRecall().ok === true && V.NPCName[0].state === "active", "无 timer / 无 daily → 仍能召回（不抛）");
V.NPCNameList = ["Gwylan", "Kylar", "Whitney"];
V.NPCName = [{ init: 1, state: "active" }, { init: 0 }, { init: 1, state: "active" }];
assert(/尚未初始化/.test(api.yanlingKylar(true).msg), "凯拉尔 init=0 → 拒绝");
delete V.NPCNameList;
assert(/无凯拉尔槽位/.test(api.yanlingKylar(true).msg), "无槽位 → 拒绝");
V.NPCNameList = ["Kylar", "Whitney"]; V.NPCName = [{ init: 1, state: "active" }, { init: 1, state: "active" }];
const kylar = api.yanlingKylar(true);
assert(kylar.ok === true && V.NPCName[0].state === "prison", "凯拉尔送监狱 → state=prison");
assert(api.yanlingKylar(false).ok === true && V.NPCName[0].state === "active", "再捞回 → active");
const whit = api.yanlingWhitney(true);
assert(whit.ok === true && V.NPCName[1].state === "dungeon", "惠特尼送地牢 → dungeon");

/* ================= 9. 监狱庇护枚举 ================= */
section("9 yanlingPrisonProtect");
delete V.prison;
assert(/本存档无监狱对象/.test(api.yanlingPrisonProtect("scarred").msg), "未进过监狱（无 $prison）→ 拒绝并说明");
V.prison = {};
const pr1 = api.yanlingPrisonProtect("scarred");
assert(pr1.ok === true && V.prison.protection === "scarred" && /疤痕狱友庇护/.test(pr1.msg), "scarred → 疤痕庇护");
assert(/原 未设置/.test(pr1.msg), "首次设置时把原值标为「未设置」");
const pr2 = api.yanlingPrisonProtect("tattooed");
assert(pr2.ok === true && V.prison.protection === "tattooed" && /纹身狱友庇护/.test(pr2.msg), "tattooed → 纹身庇护");
const pr3 = api.yanlingPrisonProtect("");
assert(pr3.ok === true && /无庇护/.test(pr3.msg) && V.prison.protection === "", "空串 → 无庇护（原版 !protection 判据）");
assert(V.mbCE_wrote["yanling:prison_protection"].after === "", "留痕记录 after=空串（回退可查）");

/* ================= 10. 格威岚当日讲故事（贴吧「森林商店相关 0.5.6+」补丁） ================= */
section("10 yanlingGwylanTalk");
V.daily = null;
assert(/无 \$daily/.test(api.yanlingGwylanTalk().msg), "无 $daily → 拒绝（不硬建每日结构）");
V.daily = { school: { attended: { maths: true } }, gwylan: { preventProgress: true } };
const talk0 = api.yanlingGwylanTalk();
assert(talk0.ok === true && V.daily.gwylan.clothesTalk === -1000 && V.daily.gwylan.enoughTalk === false, "写入 clothesTalk=-1000 / enoughTalk=false");
assert(V.daily.gwylan.preventProgress === true, "同日其它键（preventProgress）不被覆盖");
assert(!!V.daily.school && V.daily.school.attended.maths === true, "$daily 其它角色段不动");
const talk1 = api.yanlingGwylanTalk();
assert(talk1.ok === true && V.daily.gwylan.clothesTalk === -1000, "重复点击幂等（值不变仍 ok）");
assert(V.mbCE_wrote["yanling:gwylan_talk"] && V.mbCE_wrote["yanling:gwylan_talk"].after.clothesTalk === -1000, "留痕记录 after=-1000（回退可查）");
const talkBefore = V.mbCE_wrote["yanling:gwylan_talk"];
V.daily.gwylan.clothesTalk = 5; V.daily.gwylan.enoughTalk = true;
api.yanlingGwylanTalk();
assert(V.mbCE_wrote["yanling:gwylan_talk"] !== talkBefore, "真改动时重写留痕（记录新的 before）");
assert(V.daily.gwylan.clothesTalk === -1000 && V.daily.gwylan.enoughTalk === false, "已锁状态（5 / true）→ 解除回 -1000 / false");
V.daily = { gwylan: {} };
api.yanlingGwylanTalk();
assert(V.daily.gwylan.clothesTalk === -1000 && V.daily.gwylan.enoughTalk === false, "gwylan 段空对象 → 直接补两键");

/* ================= 11. 眷属项圈一键戴上并锁（贴吧 87L） ================= */
section("11 yanlingCollarLock");
V.worn = null;
assert(/存档变量不可用/.test(api.yanlingCollarLock().msg), "无 $worn → 拒绝");
setup.clothes = { neck: [{ name: "naked", slot: "neck", index: 0, variable: "neckslot" }] };
setup.clothes_all_slots = ["neck"];
V.worn = { neck: { name: "naked" } };const col0 = api.yanlingCollarLock();
assert(col0.ok === false && /缺少/.test(col0.msg), "服装表无 familiar collar → 拒绝（不硬造半成品）");
setup.clothes.neck.push({ name: "familiar collar", name_cap: "Familiar collar", slot: "neck", index: 40,
  variable: "collarfamiliar", type: ["eerie"], cursed: 0, integrity: 1000, integrity_max: 1000 });
V.wardrobe = { space: 20, neck: [] };
V.worn = { neck: { name: "naked" } };
const col1 = api.yanlingCollarLock();
assert(col1.ok === true, "naked → 戴上（" + col1.msg + "）");
assert(V.worn.neck.name === "familiar collar" && V.worn.neck.cursed === 1, "写入 familiar collar + cursed=1（锁死）");
assert(V.worn.neck !== setup.clothes.neck[1], "写进存档的是深拷贝，不是 setup 原型对象");
assert(!!V.mbCE_wrote["yanling:collar_lock"], "留痕写入 yanling:collar_lock");
const col2 = api.yanlingCollarLock();
assert(col2.ok === true && /已锁/.test(col2.msg), "已锁状态 → 幂等 ok（不重复处理）");
V.worn = { neck: { name: "choker", cursed: 0, integrity: 100 } };
const col3 = api.yanlingCollarLock();
assert(col3.ok === true && V.worn.neck.name === "familiar collar" && V.worn.neck.cursed === 1, "普通颈饰 → 换成项圈并锁");
assert(V.wardrobe.neck.length === 1 && V.wardrobe.neck[0].name === "choker", "原颈饰进衣柜");
V.worn = { neck: { name: "cursed choker", cursed: 1 } };
const col4 = api.yanlingCollarLock();
assert(col4.ok === false && /诅咒/.test(col4.msg) && V.worn.neck.name === "cursed choker", "当前是其它诅咒衣物 → 拒绝覆盖");
V.worn = { neck: { name: "familiar collar", cursed: 0, type: [] } };
const col5 = api.yanlingCollarLock();
assert(col5.ok === true && V.worn.neck.cursed === 1 && /锁/.test(col5.msg), "已穿项圈未锁 → 只补 cursed=1，不重穿");

/* ================= 12. 绝望轮回全结局 + Trials of Faith（贴吧 90L） ================= */
section("12 yanlingHopelessEndings");
V.hcEndings = undefined; V.feats = undefined;
const hc0 = api.yanlingHopelessEndings();
assert(hc0.ok === true, "空档 → 写入全结局（" + hc0.msg + "）");
assert(Array.isArray(V.hcEndings) && V.hcEndings.length === 7, "hcEndings 7 项（A-F + S）");
assert(["A", "B", "C", "D", "E", "F", "S"].every(function (k) { return V.hcEndings.indexOf(k) !== -1; }), "七结局齐备");
assert(V.feats && V.feats.currentSave && V.feats.currentSave["Trials of Faith"] instanceof Date, "成就写 currentSave（Date 时间戳）");
const hcDate = V.feats.currentSave["Trials of Faith"];
V.hcEndings = ["S"];
const hc1 = api.yanlingHopelessEndings();
assert(hc1.ok === true && V.hcEndings.filter(function (k) { return k === "S"; }).length === 1, "已有 S → 补齐且不重复");
assert(V.feats.currentSave["Trials of Faith"] === hcDate, "已有成就 → 不覆盖原时间");
const hcOld = V.mbCE_wrote["yanling:hopeless_endings"];
V.hcEndings = [];
api.yanlingHopelessEndings();
assert(V.mbCE_wrote["yanling:hopeless_endings"] !== hcOld, "重复执行重写留痕（before 更新）");

/* ================= 13. 清除催眠·好奇（贴吧 92L 排障言灵） ================= */
section("13 yanlingClearCuriosity");
V.hypnosis_traits = null; V.hypnosisTimers = null;
assert(/无 \$hypnosis_traits/.test(api.yanlingClearCuriosity().msg), "无 $hypnosis_traits → 拒绝");
V.hypnosis_traits = { devotion: 3, suggestion: 5 };
V.hypnosisTimers = { devotion: 42, suggestion: 7 };
const cu1 = api.yanlingClearCuriosity();
assert(cu1.ok === true && !("devotion" in V.hypnosis_traits), "删除 hypnosis_traits.devotion");
assert(!("devotion" in V.hypnosisTimers), "删除 hypnosisTimers.devotion");
assert(V.hypnosis_traits.suggestion === 5 && V.hypnosisTimers.suggestion === 7, "其它催眠键不动");
assert(/好奇/.test(cu1.msg), "返回文案指明「好奇」");
const cu2 = api.yanlingClearCuriosity();
assert(cu2.ok === true && /0 项/.test(cu2.msg), "已清除 → 0 项（幂等）");
V.hypnosis_traits = { devotion: 1 }; V.hypnosisTimers = null;
const cu3 = api.yanlingClearCuriosity();
assert(cu3.ok === true && !("devotion" in V.hypnosis_traits), "timers 缺失仍成功（只删存在的）");
assert(!!V.mbCE_wrote["yanling:clear_curiosity"], "留痕写入 yanling:clear_curiosity");

/* ================= 14. 贴吧续：仪式 / 渴望 / 委托 / 宠物床 / 计数 / 催眠 cd ================= */
section("14 yanlingGwylanRitual & Desire & Request & PetBed & Sea/Sex & Hypno");
global.Time = { date: { timeStamp: 5000 } };
delete window.DateTime;
V.gwylan = {};
assert(/尚未开启仪式线/.test(api.yanlingGwylanRitualReady().msg), "无 timer.ritual → 拒绝（不硬造键）");
V.gwylan.timer = { ritual: 999999 };
const rr = api.yanlingGwylanRitualReady();
assert(rr.ok === true && V.gwylan.timer.ritual === 5000, "无限仪式 → ritual=当前时刻（dayDifference=0 可进行）");
const rd = api.yanlingGwylanRitualDelay();
assert(rd.ok === true && V.gwylan.timer.ritual === 5000 + 7 * 86400, "仪式延期 → +7 天（同原版 405614）");
assert(!!V.mbCE_wrote["yanling:gwylan_ritual_ready"] && !!V.mbCE_wrote["yanling:gwylan_ritual_delay"], "两动作各自留痕");

V.NPCNameList = ["Gwylan"]; V.NPCName = [{ init: 0, lust: 10, dom: 20 }];
assert(/尚未初始化/.test(api.yanlingGwylanDesire().msg), "init=0 → 拒绝");
V.NPCName = [{ init: 1, lust: 10, dom: 20 }];
const ds = api.yanlingGwylanDesire();
assert(ds.ok === true && V.NPCName[0].lust === 100 && V.NPCName[0].dom === 150, "渴望拉满 → lust 100 / dom 150（原版 345281-345282 clamp）");
assert(/corr/.test(ds.msg), "文案写明原帖 `corr` 键在当前版已失效");

V.gwylan = { request: {} };
assert(/没有进行中/.test(api.yanlingGwylanRequestDone().msg), "空 request → 拒绝");
V.daily = { gwylan: {} };
V.gwylan = { request: { event: "jewel", items: [] }, requestCount: 2, timer: {} };
const rq = api.yanlingGwylanRequestDone();
assert(rq.ok === true && V.gwylan.requestDone === true && V.gwylan.requestCount === 3, "完成委托 → requestDone=true + requestCount++");
assert(V.daily.gwylan.request === true, "当日 request 标记 true（同 widget 393001）");
assert(V.gwylan.timer.jewel === 5000 + 14 * 86400, "event 冷却 +14 天（同 widget 393052）");
assert(V.gwylan.request && Object.keys(V.gwylan.request).length === 0, "request 清空（393056）");
assert(!!V.mbCE_wrote["yanling:gwylan_request_done"], "留痕写入");

V.gwylan = {};
assert(/尚未开启格威岚线/.test(api.yanlingGwylanPetBed().msg), "无 timer → 拒绝");
V.gwylan = { timer: {} }; V.gwylanSeen = ["yearning"];
assert(/伴侣线/.test(api.yanlingGwylanPetBed().msg), "未解锁 partners → 拒绝（同 415091 门控）");
V.gwylanSeen = ["partners"];
const pb = api.yanlingGwylanPetBed();
assert(pb.ok === true && V.gwylan.timer.petBed === 5000 + 7 * 86400, "宠物床续 7 天（同 392612）");

V.gwylan = {};
assert(/无 \$gwylan\.sea/.test(api.yanlingGwylanSea().msg), "无 sea 键 → 拒绝");
V.gwylan = { sea: 3 };
const sea = api.yanlingGwylanSea();
assert(sea.ok === true && V.gwylan.sea === 23, "看海次数 +20");
V.dateCount = {};
assert(/无 \$dateCount\.GwylanSex/.test(api.yanlingGwylanSex().msg), "无 GwylanSex → 拒绝");
V.dateCount = { GwylanSex: 2 };
const sx = api.yanlingGwylanSex();
assert(sx.ok === true && V.dateCount.GwylanSex === 7, "亲密仪式次数 +5");

V.hypnosis_traits = null; V.hypnosisTimers = null;
assert(/没有好奇特质/.test(api.yanlingHypnoCd().msg), "无 devotion 特质 → 拒绝（无需重置）");
V.hypnosis_traits = { devotion: 3 }; V.hypnosisTimers = { devotion: { time: 90 } };
const cd = api.yanlingHypnoCd();
assert(cd.ok === true && V.hypnosisTimers.devotion.time === 25, "cd 压到 (35-10)=25（devotion=3 对应 max 35）");
V.hypnosis_traits = { devotion: 1 }; V.hypnosisTimers = { devotion: { time: 90 } };
api.yanlingHypnoCd();
assert(V.hypnosisTimers.devotion.time === 0, "devotion=1 → level 0 → max 0 → 0（不为负）");
V.hypnosisTimers = {};
assert(/无 \$hypnosisTimers\.devotion/.test(api.yanlingHypnoCd().msg), "有特质无计时桶 → 拒绝");

V.daily = { gwylan: { hypnosis: true } }; V.hypnosis_potency = 3;
const hd = api.yanlingHypnoDaily();
assert(hd.ok === true && !("hypnosis" in V.daily.gwylan), "刷新当天催眠 → 删 daily 标记");
assert(V.hypnosis_potency === undefined, "同时清 $hypnosis_potency（同 389060 的 unset）");
const hd2 = api.yanlingHypnoDaily();
assert(hd2.ok === true && /无需刷新/.test(hd2.msg), "重复点击 → 无需刷新（幂等）");

/* 分支补测：拒绝 / 降级路径不留死代码（c8 branches 门禁） */
V.NPCNameList = []; V.NPCName = [];
assert(/无格威岚槽位/.test(api.yanlingGwylanDesire().msg), "无 Gwylan 槽位 → 拒绝");

V.gwylan = { timer: { ritual: 1 } };
delete global.Time;
assert(/无法计算游戏内时间戳/.test(api.yanlingGwylanRitualReady().msg), "时间戳不可用（DateTime+Time 双缺失）→ 拒绝");
global.Time = { date: { timeStamp: 5000 } };

V.gwylan = { timer: {} }; V.gwylanSeen = ["partners"];
delete global.Time;
assert(/无法计算游戏内时间戳/.test(api.yanlingGwylanPetBed().msg), "宠物床：时间戳不可用 → 拒绝");
global.Time = { date: { timeStamp: 7000 } };
api.yanlingGwylanPetBed();
assert(/原到期时间/.test(api.yanlingGwylanPetBed().msg) && V.gwylan.timer.petBed === 7000 + 7 * 86400, "宠物床二次点击 → 文案带原到期时间（before 有值分支）");

V.gwylan = {};
assert(/没有进行中/.test(api.yanlingGwylanRequestDone().msg), "无 request 对象 → 拒绝（!req 分支）");
V.daily = null;
V.gwylan = { request: { event: "ring" }, requestSeed: 0.502 };
const rq2 = api.yanlingGwylanRequestDone();
assert(rq2.ok === true && typeof V.gwylan.timer.ring === "number", "缺 timer / daily → 自建容器并写 event 冷却");
assert(Math.abs(V.gwylan.requestSeed - 0.503) < 1e-9, "requestSeed 0.502 → 0.503（0.001 步进、0.25-0.99 环内）");
delete global.Time;
V.gwylan = { request: { event: "sea2" } };
const rq3 = api.yanlingGwylanRequestDone();
assert(rq3.ok === true && V.gwylan.timer.sea2 === undefined, "时间戳不可用 → 仍完成（冷却/requestLast 跳过，不抛错）");
global.Time = { date: { timeStamp: 5000 } };

V.hypnosis_traits = { devotion: "x" }; V.hypnosisTimers = { devotion: { time: 9 } };
assert(/没有好奇特质/.test(api.yanlingHypnoCd().msg), "devotion 非数字 → 视为无特质（拒绝）");
V.daily = { gwylan: {} }; V.hypnosis_potency = 5;
const hd3 = api.yanlingHypnoDaily();
assert(hd3.ok === true && V.hypnosis_potency === undefined && /\$hypnosis_potency/.test(hd3.msg), "仅 potency 残留 → 只清 potency 并写明（不误报 daily 已清）");

V.gwylan = { sea: "3" };
assert(/无 \$gwylan\.sea/.test(api.yanlingGwylanSea().msg), "sea 非数字 → 拒绝");
V.dateCount = { GwylanSex: "2" };
assert(/无 \$dateCount\.GwylanSex/.test(api.yanlingGwylanSex().msg), "GwylanSex 非数字 → 拒绝");

section("15 yanlingArcadeCount & CollarBreak");
V.tenyclusPlayCount = 3;
const ac = api.yanlingArcadeCount();
assert(ac.ok === true && V.tenyclusPlayCount === 7, "街机计数 3 → 7（future_suit 需求 141655）");
V.tenyclusPlayCount = 9;
const ac2 = api.yanlingArcadeCount();
assert(ac2.ok === true && V.tenyclusPlayCount === 9 && /已是/.test(ac2.msg), ">=7 → 不再覆盖（幂等）");
delete V.tenyclusPlayCount;
const ac3 = api.yanlingArcadeCount();
assert(ac3.ok === true && V.tenyclusPlayCount === 7 && /未初始化/.test(ac3.msg), "未初始化 → 写 7 并在文案注明");

V.worn = { neck: null };
assert(/没穿眷属项圈/.test(api.yanlingCollarBreak().msg), "无项圈 → 拒绝（破损层只作用于已锁项圈）");
V.worn = { neck: { name: "familiar collar", cursed: 0, type: [] } };
assert(/未锁/.test(api.yanlingCollarBreak().msg), "未锁 → 拒绝（原版 198062 只在 cursed 下处理）");
V.worn = { neck: { name: "familiar collar", cursed: 1, type: [] } };
const cb = api.yanlingCollarBreak();
assert(cb.ok === true && V.worn.neck.type.indexOf("broken") !== -1 && V.eventskipoverrule === 1, "破损层 → type+broken + eventskipoverrule=1（198495 / 198496 空分支）");
const cb2 = api.yanlingCollarBreak();
assert(cb2.ok === true && /已是破损态/.test(cb2.msg), "重复点击 → 不重复 push（幂等）");
V.worn = { neck: { name: "familiar collar", cursed: 1 } };
api.yanlingCollarBreak();
assert(Array.isArray(V.worn.neck.type) && V.worn.neck.type.indexOf("broken") !== -1, "type 非数组 → 自建数组再 push");

console.log("\nYANLING ACTIONS STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
