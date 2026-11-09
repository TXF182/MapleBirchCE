/*
 * 纯函数层隔离单测（v2.0.12，补「测试形态单一：只有面板级冒烟，没有函数级隔离单测」的缺口）
 *
 * 背景：01-core.js 顶层 29 个函数声明中有 11 个从没被任何测试命中（mbCEErr / frameworkReady /
 * stateCN / typeCN / vanillaNPCList / vanillaLoveInterests / isVanillaLoveInterest / isLoveCharacter /
 * getNpcState / statValue / writeStat）。面板级测试只覆盖「点按钮→出结果」的复合路径，
 * 这些函数一旦被改坏，会被上层的兜底吞掉而不报警。
 *
 * 做法：用 vm 把 01-core.js 当独立片段跑（它不是模块，不需要 require 守卫），
 * 注入最小宿主（window / V / State / setup），直接调用函数断言返回值。
 * 这样与产品构建产物无关：改坏 01-core，本测试立刻红，不必等整条链跑到 E2E。
 *
 * 边界：只测「输入→输出」确定的纯函数；依赖 MB（框架注册池）的分支用空宿主覆盖不到，
 *       那部分由 smoke_dom / functional_e2e 的面板路径覆盖。
 *
 * 用法：node tests/unit_core.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CORE = path.join(__dirname, "..", "javascript", "src", "01-core.js");
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

/* 每个用例组用独立的沙箱：01-core 里 `var MB` 会被 resolveMB 缓存，跨用例复用会串味 */
function loadCore(vars) {
  const V = vars || {};
  const sandbox = {
    window: { V: V, State: { variables: V } },
    V: V,
    State: { variables: V },
    setup: {},
    console: console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CORE, "utf8"), sandbox, { filename: CORE });
  return sandbox;
}

/* ---------- 1. mbCEErr：catch 变量取值收敛（有 message 用 message，否则原值） ---------- */
{
  const s = loadCore({});
  assert(s.mbCEErr({ message: "boom" }) === "boom", "mbCEErr：取 Error.message");
  assert(s.mbCEErr("plain") === "plain", "mbCEErr：非对象原样返回");
  assert(s.mbCEErr(null) === null, "mbCEErr：null 不炸且原样返回");
  assert(s.mbCEErr({ message: "" }) !== "", "mbCEErr：空 message 回退整个对象（避免把空串当原因）");
}

/* ---------- 2. stateCN / typeCN：中文映射层（未收录必须原样返回，不能猜义） ---------- */
{
  const s = loadCore({});
  assert(s.stateCN("active") === "活跃（active）", "stateCN：命中词条并在括号里回显原值");
  assert(s.stateCN("ACTIVE") === "活跃（ACTIVE）", "stateCN：大小写不敏感（toLowerCase 匹配）");
  assert(s.stateCN("not-in-table") === "not-in-table", "stateCN：未收录原样返回（不猜义）");
  assert(s.stateCN(null) === null, "stateCN：null 透传");
  assert(s.typeCN("Wolf") === "狼", "typeCN：驼峰/大小写归一后命中");
  assert(s.typeCN("wolf pack") === "狼群", "typeCN：多词词条命中");
  assert(s.typeCN("unknown-type") === "unknown-type", "typeCN：未收录原样返回");
}

/* ---------- 3. 原版清单：固定 32 NPC / 10 恋人，且不随 MOD 扩展漂移 ---------- */
{
  const s = loadCore({});
  const npcList = s.vanillaNPCList();
  assert(npcList.length === 32, "vanillaNPCList：原版 32 个命名 NPC，实际 " + npcList.length);
  assert(npcList[0] === "avery", "vanillaNPCList：返回全小写");
  assert(s.isVanillaNPC("Robin") && s.isVanillaNPC(" robin "), "isVanillaNPC：大小写/空格归一后命中");
  assert(s.isVanillaNPC("ModOnlyGuy") === false, "isVanillaNPC：MOD 角色不判为原版");
  const loveList = s.vanillaLoveInterests();
  assert(loveList.length === 10, "vanillaLoveInterests：原版 10 个恋人，实际 " + loveList.length);
  assert(s.isVanillaLoveInterest("Sydney") === true, "isVanillaLoveInterest：Sydney 在恋人清单");
  assert(s.isVanillaLoveInterest("Charlie") === false, "isVanillaLoveInterest：Charlie 是 NPC 但不是恋人");
}

/* ---------- 4. getNpcState：状态缺省为 active、未找到标记 found=false ---------- */
{
  const s = loadCore({ characters: { npc: { Robin: { state: "stable" }, Kylar: {} } } });
  const robin = s.getNpcState("robin");
  assert(robin.found === true && robin.state === "stable", "getNpcState：命中且回读 state");
  const kylar = s.getNpcState("Kylar");
  assert(kylar.found === true && kylar.state === "active", "getNpcState：对象存在但无 state → 缺省 active");
  const ghost = s.getNpcState("Nobody");
  assert(ghost.found === false && ghost.state === "active", "getNpcState：未找到 → found=false 且 state 仍为 active");
  const empty = loadCore({});
  assert(empty.getNpcState("Robin").found === false, "getNpcState：无 characters 结构时不炸");
}

/* ---------- 5. statValue：npc 自带值优先，否则框架 customStats 默认，否则 0 ---------- */
{
  const s = loadCore({});
  assert(s.statValue({ love: 42 }, "Robin", { key: "love" }) === 42, "statValue：读 npc 上的值");
  assert(s.statValue({ love: "abc" }, "Robin", { key: "love" }) === 0, "statValue：非有限数字回退 0（不返回 NaN）");
  assert(s.statValue({}, "Robin", { key: "love" }) === 0, "statValue：字段缺失回退 0");
  assert(s.statValue(null, "Robin", { key: "love" }) === 0, "statValue：npc 为 null 不炸");
}

/* ---------- 6. writeStat：下限钳制、上限不钳制、四舍五入、null 保护 ---------- */
{
  const s = loadCore({});
  const npc = {};
  const def = { key: "love", min: 0, max: 100 };
  assert(s.writeStat(npc, "Robin", def, -5) === 0 && npc.love === 0, "writeStat：负数被下限钳到 0");
  assert(s.writeStat(npc, "Robin", def, 999) === 999 && npc.love === 999, "writeStat：超上限不钳制（刻意设计）");
  assert(s.writeStat(npc, "Robin", { key: "dom", min: 1 }, 0) === 1, "writeStat：自定义 min=1 生效");
  assert(s.writeStat(npc, "Robin", def, "50.6") === 51 && npc.dom === 1, "writeStat：字符串数字四舍五入");
  assert(s.writeStat(null, "Robin", def, 10) === 0, "writeStat：npc 为 null 返回 0 且不写");
}

/* ---------- 7. frameworkReady：只认 window.maplebirch.npc 或 setup.MapleBirch ---------- */
{
  const withMB = loadCore({});
  withMB.window.maplebirch = { npc: {} };
  assert(withMB.frameworkReady() === true, "frameworkReady：window.maplebirch.npc 存在 → true");
  const noNpc = loadCore({});
  noNpc.window.maplebirch = { somethingElse: 1 };
  assert(noNpc.frameworkReady() === false, "frameworkReady：框架存在但无 npc 注册池 → false");
  const none = loadCore({});
  assert(none.frameworkReady() === false, "frameworkReady：完全没有框架 → false 且不炸");
}

console.log(failures === 0 ? "\nALL PASS（纯函数隔离单测）" : "\nFAILED: " + failures);
process.exit(failures === 0 ? 0 : 1);
