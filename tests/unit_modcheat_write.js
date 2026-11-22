/*
 * Mod 作弊写入执行器：适配器路径豁免核心判定（v2.0.12 补测）
 *
 * 背景：工程评判把「04b-modcheat-write.js 8 个函数中有 3 个零测试」列为第 4 节 ① 的残留缺口，
 * 而这 3 个正是「原版根拦截 vs 适配器声明豁免」的判定核心：
 *   cheatIsVanillaRoot   —— 顶层键是否属于原版黑名单（拒绝写入的边界）
 *   mbCEBuildAdapterPaths —— 把 13 个适配器 stages/abilities/values 的 varPath 收成豁免集合
 *   mbCEIsDeclaredAdapterPath —— 某条路径是否被适配器声明过（决定黑名单是否放行）
 * 这三条一旦改坏，表现是「写原版变量被放行」（静默写坏存档）或「第三方模组键被误拦」（作弊项静默失效），
 * 面板级测试都会被上层兜底吞掉，必须在函数级隔离测。
 *
 * 做法：vm 把 04b 当独立片段跑，注入最小宿主（CHEAT_VANILLA_ROOTS / CHEAT_ADAPTERS / getV）。
 * 边界：不断言 applyCheatSync 的写入副作用（那由 adapter_actions / lock_resume 的面板路径覆盖）。
 *
 * 用法：node tests/unit_modcheat_write.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "..", "javascript", "src");
const WRITE = path.join(SRC, "04b-modcheat-write.js");
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

/* 真实原版黑名单取自 03d-global-modzh.js 的运行时常量，测试用同一份文本解析，
   避免在测试里复制一份会漂移的清单（清单改了，这里自动跟着变）。 */
function loadVanillaRoots() {
  const text = fs.readFileSync(path.join(SRC, "03d-global-modzh.js"), "utf8");
  const m = text.match(/var CHEAT_VANILLA_ROOTS = \[([\s\S]*?)\];/);
  if (!m) { throw new Error("未找到 CHEAT_VANILLA_ROOTS 定义：黑名单口径可能已改名"); }
  const roots = m[1].match(/"[^"]+"/g) || [];
  return roots.map(function (s) { return s.slice(1, -1); });
}

/* 沙箱：04b 的函数体只在「被调用」时才解析外部符号，所以这里只需提供会被真正读到的几个。 */
function loadWrite(opts) {
  const o = opts || {};
  const V = o.V === undefined ? {} : o.V;
  const sandbox = {
    CHEAT_VANILLA_ROOTS: o.roots || loadVanillaRoots(),
    CHEAT_ADAPTERS: o.adapters || {},
    getV: function () { return V; },
    window: {},
    console: console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(WRITE, "utf8"), sandbox, { filename: WRITE });
  return sandbox;
}

/* ---------- 1. cheatIsVanillaRoot：真实黑名单命中 / 大小写与前后缀不吃亏 ---------- */
{
  const s = loadWrite({});
  assert(s.CHEAT_VANILLA_ROOTS.length >= 20, "黑名单规模合理（>=20 条，实测 " + s.CHEAT_VANILLA_ROOTS.length + "）");
  assert(s.cheatIsVanillaRoot("daily") === true, "cheatIsVanillaRoot：daily 属原版根");
  assert(s.cheatIsVanillaRoot("farm") === true, "cheatIsVanillaRoot：farm 属原版根");
  assert(s.cheatIsVanillaRoot("mbCE_wrote") === true, "cheatIsVanillaRoot：CE 自身留痕键也在黑名单（防写穿）");
  assert(s.cheatIsVanillaRoot("dailyx") === false, "cheatIsVanillaRoot：前缀相同的不同键不算命中");
  assert(s.cheatIsVanillaRoot("") === false, "cheatIsVanillaRoot：空串不命中");
  assert(s.cheatIsVanillaRoot(null) === false, "cheatIsVanillaRoot：null 不炸且不命中");
  assert(s.cheatIsVanillaRoot("DAILY") === false, "cheatIsVanillaRoot：大小写敏感（SugarCube 变量名区分大小写）");
}

/* ---------- 2. mbCEBuildAdapterPaths：三段收集 + 脏数据跳过 ---------- */
{
  const adapters = {
    "adapter-a": { entry: { stages: [{ varPath: "farm.house" }], abilities: [{ varPath: "daily.goods" }], values: [{ varPath: "a.b" }] } },
    "adapter-b": { entry: { stages: [{ varPath: "" }, { varPath: null }, {}], abilities: "not-an-array", values: [{ varPath: 5 }, { varPath: "ok.key" }] } },
    "adapter-c": {},                                   /* 无 entry：必须跳过 */
    "adapter-d": { entry: { stages: null } },           /* 非数组段：必须跳过 */
    "adapter-e": { entry: { values: [{ varPath: "dup.key" }] } },
    "adapter-f": { entry: { values: [{ varPath: "dup.key" }] } }  /* 重复路径：集合里仍是一项 */
  };
  const s = loadWrite({ adapters: adapters });
  const set = s.mbCEBuildAdapterPaths();
  const keys = Object.keys(set).sort();
  assert(keys.length === 5, "mbCEBuildAdapterPaths：脏数据被跳过，最终 5 条（实际 " + keys.length + "：" + keys.join(",") + "）");
  assert(keys.join("|") === "a.b|daily.goods|dup.key|farm.house|ok.key".split("|").sort().join("|"), "mbCEBuildAdapterPaths：收集到的正是 stages/abilities/values 里的 varPath");
  assert(set["dup.key"] === true, "mbCEBuildAdapterPaths：重复路径去重为一项");
  assert(set[""] === undefined && set["5"] === undefined, "mbCEBuildAdapterPaths：空串/非字符串 varPath 不入集合");

  /* 构建失败 → 保守全部拒绝（catch 分支）：给一个会抛的 entry 形态 */
  const bad = { throwing: { get entry() { throw new Error("boom"); } } };
  const s2 = loadWrite({ adapters: bad });
  assert(Object.keys(s2.mbCEBuildAdapterPaths()).length === 0, "mbCEBuildAdapterPaths：遍历抛错时返回空集合（保守全拒，不放行原版根）");
}

/* ---------- 3. mbCEIsDeclaredAdapterPath：命中 / 未命中 / 懒缓存 ---------- */
{
  const adapters = { x: { entry: { values: [{ varPath: "daily.goods" }] } } };
  const s = loadWrite({ adapters: adapters });
  assert(s.mbCEIsDeclaredAdapterPath("daily.goods") === true, "mbCEIsDeclaredAdapterPath：已声明路径放行");
  assert(s.mbCEIsDeclaredAdapterPath("daily.other") === false, "mbCEIsDeclaredAdapterPath：同根不同路径不放行");
  assert(s.mbCEIsDeclaredAdapterPath("") === false, "mbCEIsDeclaredAdapterPath：空串不放行");
  assert(s.mbCEIsDeclaredAdapterPath(null) === false, "mbCEIsDeclaredAdapterPath：null 不放行且不炸");
  /* 缓存语义（有意设计：集合只建一次；新增适配器需重载页面才生效） */
  s.CHEAT_ADAPTERS["y"] = { entry: { values: [{ varPath: "late.path" }] } };
  assert(s.mbCEIsDeclaredAdapterPath("late.path") === false, "mbCEIsDeclaredAdapterPath：集合懒建一次后不再重建（新增适配器需重载）");
}

/* ---------- 4. cheatResolvePath：黑名单拦截 / 声明豁免 / 父链缺失 / 空路径 / 无存档 ---------- */
{
  const V = { daily: { goods: { a: 1 } }, custom: { a: { b: 2 } }, farm: { house: {} } };
  const adapters = { x: { entry: { values: [{ varPath: "daily.goods" }] } } };
  const s = loadWrite({ V: V, adapters: adapters });

  const blocked = s.cheatResolvePath("daily.zzz");
  assert(blocked.ok === false && blocked.reason === "vanilla" && blocked.root === "daily", "cheatResolvePath：未声明的原版根被拦（reason=vanilla）");

  const exempt = s.cheatResolvePath("daily.goods");
  assert(exempt.ok === true && exempt.parent === V.daily && exempt.leaf === "goods", "cheatResolvePath：声明过的原版根子路径放行（parent 指向真实父对象）");
  assert(exempt.exists === true, "cheatResolvePath：exists=true（叶子已存在）");

  /* 豁免是「整条 varPath 精确匹配」：声明了 daily.goods 不等于放行 daily.goods.newKey（子键仍按黑名单拒）。
     这是有意的保守语义——适配器声明什么就只放行什么；对象型 varPath 只能整对象替换，不能细分到子键。 */
  const subKey = s.cheatResolvePath("daily.goods.newKey");
  assert(subKey.ok === false && subKey.reason === "vanilla", "cheatResolvePath：声明路径的子键不被豁免（精确匹配语义，非 bug）");

  /* 叶子缺失仍 ok 的语义用非黑名单根验证 */
  const newLeaf = s.cheatResolvePath("custom.a.newLeaf");
  assert(newLeaf.ok === true && newLeaf.exists === false, "cheatResolvePath：非黑名单根下叶子缺失仍 ok（正常初始化语义）");

  const custom = s.cheatResolvePath("custom.a.b");
  assert(custom.ok === true && custom.parent === V.custom.a, "cheatResolvePath：非黑名单根直通");

  const noParent = s.cheatResolvePath("custom.nope.x");
  assert(noParent.ok === false && noParent.reason === "parent" && noParent.path === "custom.nope", "cheatResolvePath：父链缺失被拦（reason=parent 带断点路径）");

  const empty = s.cheatResolvePath("");
  assert(empty.ok === false && empty.reason === "空路径", "cheatResolvePath：空路径被拦");

  const noV = loadWrite({ V: null, adapters: adapters });
  const r = noV.cheatResolvePath("custom.a");
  assert(r.ok === false && r.reason === "存档变量不可用", "cheatResolvePath：无存档（V=null）时拒绝写入");
}

/* ---------- 5. 真实声明规模哨兵：适配器被整体删空时必须红 ---------- */
{
  const files = fs.readdirSync(SRC).filter(function (f) { return /^04a-.*\.js$/.test(f); });
  let varPaths = 0;
  files.forEach(function (f) {
    const text = fs.readFileSync(path.join(SRC, f), "utf8");
    const m = text.match(/varPath\s*:/g);
    if (m) { varPaths += m.length; }
  });
  assert(files.length >= 12, "适配器分块文件数 >=12（实际 " + files.length + "；12 个适配器拆成多分块文件）");
  assert(varPaths >= 420, "varPath 声明总条数 >=420（实际 " + varPaths + "；口径：与 adapter_matrix 的 425 条同为 stages+abilities+values，validate_adapters 的 426 另含 1 条 scenes 无写入探针；2026-11-12 撤下 Dolonline 后由 470 降至 425，下界随基线校准并留 5 条余量）");
}

/* ---------- 6. 联动写入（applyCheatSync）留痕：undo 必须连带还原联动目标 ---------- */
/* 2026-11-22 v2.2.2：此前 applyCheatSync 直接改联动键、不记 before，undo 只还原主键——
   会把 clear 掉的原数据（校园着装的 proposal）或「一键装应用」清掉的应用永久留成 null。 */
function hostWrite(V) {
  const s = loadWrite({ V: V });
  s.mbCEWroteTrim = function () { /* 留痕有界化不参与本组断言 */ };
  return s;
}

{
  const V = {
    LifeSimulation: { school: { dress: { active: "uniform", proposal: { who: "robin" }, trialUntil: 900, highest: "uniform" } } },
    mbCE_wrote: {}
  };
  const s = hostWrite(V);
  const sync = {
    clear: ["LifeSimulation.school.dress.proposal"],
    set: [{ path: "LifeSimulation.school.dress.trialUntil", value: 0 }],
    copyMax: { path: "LifeSimulation.school.dress.highest", order: ["uniform", "free", "revealing", "optionalNudity", "nudeDay", "mandatoryNudity"] }
  };
  const r = s.cheatWriteValue("deadwood", "dress_active", "set", "LifeSimulation.school.dress.active", "free", "string", undefined, undefined, sync);
  assert(r.ok === true, "6.1 写入成功（" + r.message + "）");
  assert(V.LifeSimulation.school.dress.proposal === null, "6.2 clear 生效（proposal 置 null）");
  assert(V.LifeSimulation.school.dress.highest === "free", "6.3 copyMax 生效（uniform → free）");
  const rec = V.mbCE_wrote["cheat:deadwood:dress_active"];
  assert(!!rec && Array.isArray(rec.sync) && rec.sync.length === 3, "6.4 联动快照 3 条（实际 " + (rec && rec.sync && rec.sync.length) + "）");
  assert(rec.sync[0].path === "LifeSimulation.school.dress.proposal" && rec.sync[0].had === true && rec.sync[0].before && rec.sync[0].before.who === "robin", "6.5 快照保留 proposal 原对象");
  assert(rec.sync[1].before === 900 && rec.sync[2].before === "uniform", "6.6 快照保留 trialUntil / highest 原值");
  const u = s.undoCheatModValue("deadwood", "dress_active");
  assert(u.ok === true, "6.7 回退成功（" + u.message + "）");
  assert(V.LifeSimulation.school.dress.active === "uniform", "6.8 主键还原（档位回到 uniform）");
  assert(V.LifeSimulation.school.dress.proposal && V.LifeSimulation.school.dress.proposal.who === "robin", "6.9 proposal 随回退还原（不被 clear 永久吞掉）");
  assert(V.LifeSimulation.school.dress.trialUntil === 900, "6.10 trialUntil 还原 900");
  assert(V.LifeSimulation.school.dress.highest === "uniform", "6.11 highest 还原 uniform（copyMax 不残留抬高值）");
}

{
  const V = { computerApps: { game_indie: false, game_aaa: true, video_stream: null }, mbCE_wrote: {} };
  delete V.computerApps.music;
  const s = hostWrite(V);
  const sync = {
    clear: ["computerApps.game_aaa", "computerApps.video_stream", "computerApps.music"],
    set: [
      { path: "computerApps.game_aaa", value: true, if: { min: 1 } },
      { path: "computerApps.video_stream", value: true, if: { min: 1 } },
      { path: "computerApps.music", value: true, if: { min: 1 } }
    ]
  };
  const r = s.cheatWriteValue("dolmod", "dm_pc_apps", "set", "computerApps.game_indie", 1, "number", 0, 1, sync);
  assert(r.ok === true, "6.12 一键装应用写入成功");
  assert(V.computerApps.game_aaa === true && V.computerApps.music === true, "6.13 联动全部置 true");
  const rec = V.mbCE_wrote["cheat:dolmod:dm_pc_apps"];
  assert(rec.sync.length === 3, "6.14 同一键 clear+set 只记一条快照（实际 " + rec.sync.length + "）");
  assert(rec.sync[1].before === null, "6.15 原本为 null 的 video_stream 快照保留 null");
  const u = s.undoCheatModValue("dolmod", "dm_pc_apps");
  assert(u.ok === true, "6.16 回退成功");
  assert(V.computerApps.game_aaa === true && V.computerApps.video_stream === null, "6.17 原已装/原 null 的应用逐键还原");
  assert(Object.prototype.hasOwnProperty.call(V.computerApps, "music") === false, "6.18 原本不存在的应用回退后仍是删除态（不留 null）");
}

{
  /* 条件不满足 → 联动跳过、不进快照；undo 不得把未写的键误改 */
  const V = { custom: { stage: 0, extra: { flag: false } }, mbCE_wrote: {} };
  const s = hostWrite(V);
  const r = s.cheatWriteValue("x", "k", "set", "custom.stage", 0, "number", 0, 99, { set: [{ path: "custom.extra.flag", value: true, if: { min: 1 } }] });
  assert(r.ok === true, "6.19 主写入成功");
  const rec = V.mbCE_wrote["cheat:x:k"];
  assert(!rec.sync || rec.sync.length === 0, "6.20 未执行的联动不进快照");
  assert(V.custom.extra.flag === false, "6.21 条件不满足的联动确实没写");
  s.undoCheatModValue("x", "k");
  assert(V.custom.extra.flag === false, "6.22 回退不误改未写入的联动键");
}

{
  /* 旧记录（无 sync 字段）向后兼容 */
  const V = { old: { mod: { value: 5 } }, mbCE_wrote: { "cheat:old:v": { type: "cheat", modId: "old", path: "old.mod.value", before: 5, after: 9, t: 1 } } };
  const s = hostWrite(V);
  const u = s.undoCheatModValue("old", "v");
  assert(u.ok === true && V.old.mod.value === 5, "6.23 旧留痕（无 sync 字段）回退行为不变");
}

{
  /* 联动父链在回退前被删 → 跳过该键并报告，主键仍还原 */
  const V = { LifeSimulation: { school: { dress: { active: false } } }, MoreTransformations: { harbour: { ship: false } }, mbCE_wrote: {} };
  const s = hostWrite(V);
  const r = s.cheatWriteValue("deadwood", "d", "set", "LifeSimulation.school.dress.active", true, "boolean", undefined, undefined, { set: [{ path: "MoreTransformations.harbour.ship", value: true, if: { min: 1 } }] });
  assert(r.ok === true && V.MoreTransformations.harbour.ship === true, "6.24 跨树联动写入成功");
  delete V.MoreTransformations;
  const u = s.undoCheatModValue("deadwood", "d");
  assert(u.ok === true && V.LifeSimulation.school.dress.active === false, "6.25 主键仍还原");
  assert(/跳过|结构/.test(u.message), "6.26 消息报告跳过的联动键（实际：" + u.message + "）");
}

console.log(failures === 0 ? "\nALL PASS（适配器路径豁免判定单测）" : "\nFAILED: " + failures);
process.exit(failures === 0 ? 0 : 1);
