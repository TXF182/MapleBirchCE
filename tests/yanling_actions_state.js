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

console.log("\nYANLING ACTIONS STATE: passed=" + passes + " failed=" + failures);
if (failures) process.exit(1);
process.exit(0);
