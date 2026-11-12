#!/usr/bin/env node
/* DoLOnline Guard 单测：node tests/test_dolonline_guard.js
 * 覆盖 4 条判据（F1 留痕 / F2 物资 / F3 金币 / F4 法术）+ 幂等 + 合法进度不误伤 + 只读审计。
 * 全部为纯对象断言，不读磁盘、不起浏览器，秒级完成。
 *
 * 每条判据的源码依据（2026-11-12 逐行实证，见 tools/dolonline-guard/README.md）：
 *   F1 → MapleBirchCE/javascript/src/04b-modcheat-write.js L141-142（无条件留痕，before 保原值）
 *   F2 → git HEAD 的 04a-17-dolonline.js dl_fill_inv：18 键一次补到 99；
 *        对照 Dolonline index.js dgAdd(L9010) 无上限 clamp——故必须加「等级仍为 1」佐证，
 *        否则长期玩家合法堆到 18×99 会被误清。
 *   F3 → 同上 dl_refill_run：dgGold → 9999；Dolonline index.js 全库 dgGold 唯一写入是
 *        「进本置 0」(L9523)，合法恒 0 → 9999 即指纹。dgKills 在 5.34 是死键
 *        （只在 dgUnlocked 老存档兼容分支被读，全库零写入），不能拿它当豁免。
 *   F4 → 同上 dl_all_spells：9 个法术键一次全置 1、不扣点。合法达到「9 键全 1」需
 *        mpDgLv >= 12（5 个 auto 白送）+ 4 个无 auto 节点花 14 点；等级不足 12 时必须
 *        额外花 14 点买 auto 节点，合计 28 点。故判据 = 9 键全 1 且 mpDgLv < 12，
 *        删除时按 SKILL_NODES 的 cost 退回点数（未被等级白送的才退），误伤可逆。
 */
"use strict";
global.__DOLGUARD_NO_AUTO__ = true;

const G = require("../tools/dolonline-guard/guard.js");

let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (info ? "  → " + info : "")); }
}
function allInv99() {
  const o = {};
  G._invKeys.forEach(k => { o[k] = 99; });
  return o;
}
function allSpellsOn() {
  const o = {};
  G._spellKeys.forEach(k => { o[k] = 1; });
  return o;
}

/* ---------- [1] F1 留痕精确回退 ---------- */
console.log("[1] F1 CE 留痕按 before 精确还原");
{
  const v = {
    mbCE_wrote: {
      "cheat:dolonline:dl_dglv": { type: "cheat", modId: "dolonline", path: "mpDgLv", before: 3, after: 42 },
      "cheat:dolonline:dl_agi": { type: "cheat", modId: "dolonline", path: "mpDgAgi", before: undefined, after: 10 },
      "cheat:deadwood-reblooms:dd_x": { type: "cheat", modId: "deadwood-reblooms", path: "ddPower", before: 1, after: 9 },
      "cheat:dolonline:dl_money": { type: "cheat", modId: "dolonline", path: "money", before: 100, after: 99999 },
      "lock:something": { type: "lock", modId: "dolonline", path: "mpDgDef", before: 0, after: 5 }
    },
    mpDgLv: 42,
    mpDgAgi: 10,
    ddPower: 9,
    money: 99999,
    mpDgDef: 5
  };
  const items = G.sweep(v);
  ok("留痕命中 2 条（dolonline 且键在命名空间内）", items.length === 2, "实际 " + items.length);
  ok("before=3 → mpDgLv 还原为 3", v.mpDgLv === 3, "实际 " + v.mpDgLv);
  ok("before=undefined → mpDgAgi 字段被删除", !("mpDgAgi" in v), "仍存在");
  ok("其它 mod 留痕不动（ddPower 仍 9）", v.ddPower === 9, "实际 " + v.ddPower);
  ok("原版变量不被改（money 仍 99999）", v.money === 99999, "实际 " + v.money);
  ok("lock 类型留痕不参与回退（mpDgDef 仍 5）", v.mpDgDef === 5, "实际 " + v.mpDgDef);
  ok("命中留痕已被清除", !("cheat:dolonline:dl_dglv" in v.mbCE_wrote) && !("cheat:dolonline:dl_agi" in v.mbCE_wrote));
  ok("未命中的留痕保持原样", "cheat:deadwood-reblooms:dd_x" in v.mbCE_wrote && "lock:something" in v.mbCE_wrote);
}

/* ---------- [2] F2 物资指纹 ---------- */
console.log("[2] F2 dgInv 18 键全 99 且地下城等级仍为 1");
{
  const v = { dgInv: allInv99(), mpDgLv: 1 };
  const items = G.sweep(v);
  ok("18×99 + lv1 → 命中 1 条", items.length === 1 && items[0].rule === "F2-inv", JSON.stringify(items.map(x => x.rule)));
  ok("命中后 18 键归 0", G._invKeys.every(k => v.dgInv[k] === 0));
  ok("dgInv 对象本身保留", typeof v.dgInv === "object");
}
{
  const v = { dgInv: allInv99(), mpDgLv: 6 };
  const items = G.sweep(v);
  ok("18×99 但 lv6 → 不命中（可能是长期玩家合法堆积）", items.length === 0, JSON.stringify(items.map(x => x.rule)));
  ok("值保持原样", G._invKeys.every(k => v.dgInv[k] === 99));
}
{
  const near = allInv99();
  near[G._invKeys[0]] = 98;
  const v = { dgInv: near, mpDgLv: 1 };
  const items = G.sweep(v);
  ok("17×99 + 1×98 + lv1 → 不命中（非精确指纹）", items.length === 0, JSON.stringify(items.map(x => x.rule)));
}
{
  const v = {};
  const items = G.sweep(v);
  ok("dgInv 缺失 → 不命中、不创建字段", items.length === 0 && !("dgInv" in v));
}

/* ---------- [3] F3 金币指纹 ---------- */
console.log("[3] F3 dgGold===9999（dgKills 是死键，不作豁免）");
{
  const v = { dgGold: 9999 };
  const items = G.sweep(v);
  ok("9999 → 命中 1 条", items.length === 1 && items[0].rule === "F3-gold", JSON.stringify(items.map(x => x.rule)));
  ok("命中后 dgGold 归 0", v.dgGold === 0, "实际 " + v.dgGold);
}
{
  const v = { dgGold: 9999, dgKills: 12, dgFloor: 9 };
  const items = G.sweep(v);
  ok("9999 + 残留 dgKills/dgFloor → 仍命中（那两个键 5.34 不写，不可作证据）",
    items.length === 1 && items[0].rule === "F3-gold", JSON.stringify(items.map(x => x.rule)));
}
{
  const v = { dgGold: 500 };
  const items = G.sweep(v);
  ok("500 → 不命中（非特征值）", items.length === 0);
}
{
  const v = { dgGold: 0 };
  const items = G.sweep(v);
  ok("0（合法恒值） → 不命中", items.length === 0);
}

/* ---------- [4] F4 法术指纹 ---------- */
console.log("[4] F4 9 键全 1 且等级不足 12");
{
  const v = { mpSkill: allSpellsOn(), mpDgLv: 1, mpSkillPts: 0 };
  const items = G.sweep(v);
  ok("lv1 + 9 键全 1 → 9 条逐键命中",
    items.length === 9 && items.every(x => x.rule === "F4-spell"), "实际 " + items.length);
  ok("9 键被删除", G._spellKeys.every(k => !(k in v.mpSkill)), Object.keys(v.mpSkill).join(","));
  ok("mpSkill 对象保留（模组仍可用）", typeof v.mpSkill === "object");
  ok("按 cost 退回 28 点（lv1 无任何等级白送）", v.mpSkillPts === G._costTotal, "实际 " + v.mpSkillPts);
}
{
  const v = { mpSkill: allSpellsOn(), mpDgLv: 11, mpSkillPts: 0 };
  const items = G.sweep(v);
  ok("lv11 + 9 键全 1 → 命中 9 条", items.length === 9, "实际 " + items.length);
  ok("只退未白送的 18 点（meteor4 + uBurst4 + uChain4 + uDesp3 + uBlood3）",
    v.mpSkillPts === 18, "实际 " + v.mpSkillPts);
}
{
  const v = { mpSkill: allSpellsOn(), mpDgLv: 12, mpSkillPts: 0 };
  const items = G.sweep(v);
  ok("lv12 + 9 键全 1 → 不命中（5 auto 白送 + 4 个无 auto 可合法花点买到）",
    items.length === 0, JSON.stringify(items.map(x => x.path)));
  ok("mpSkill 未被改动", G._spellKeys.every(k => v.mpSkill[k] === 1));
}
{
  const v = { mpSkill: { fireWall: 1 }, mpDgLv: 4 };
  const items = G.sweep(v);
  ok("lv4 仅 fireWall（等级白送）→ 不命中", items.length === 0, JSON.stringify(items.map(x => x.path)));
  ok("fireWall 保留", v.mpSkill.fireWall === 1);
}
{
  const v = { mpSkill: { atk: 4, fireWall: 1 }, mpDgLv: 6 };
  const items = G.sweep(v);
  ok("lv6 普通节点 + 1 个 auto 法术 → 不命中（普通节点不参与 F4）",
    items.length === 0, JSON.stringify(items.map(x => x.path)));
  ok("普通节点 atk 保留", v.mpSkill.atk === 4);
}
{
  const v = { mpSkill: { uBurst: 1, uChain: 1, uDesp: 1, uBlood: 1 }, mpDgLv: 2, mpSkillPts: 5 };
  const items = G.sweep(v);
  ok("只有 4 个无 auto 法术、不是 9 键全开 → 不命中（宁可漏判）",
    items.length === 0, JSON.stringify(items.map(x => x.path)));
}
{
  const v = { mpSkill: allSpellsOn(), mpDgLv: 1, mpSkillPts: 40 };
  const items = G.sweep(v);
  ok("lv1 + 9 键全 1 但余额 40 → 仍命中（CE 不写 pts，余额不能当豁免）",
    items.length === 9, "实际 " + items.length);
  ok("退点叠加：40 + 28 = 68", v.mpSkillPts === 68, "实际 " + v.mpSkillPts);
}

/* ---------- [5] 幂等 ---------- */
console.log("[5] 幂等：二次巡检无重复命中");
{
  const v = {
    mbCE_wrote: { "cheat:dolonline:dl_dglv": { type: "cheat", modId: "dolonline", path: "mpDgLv", before: 1, after: 50 } },
    mpDgLv: 50,
    dgGold: 9999,
    dgInv: allInv99(),
    mpSkill: allSpellsOn(),
    mpSkillPts: 0
  };
  const first = G.sweep(v);
  const rules = Array.from(new Set(first.map(x => x.rule))).sort().join(",");
  ok("首轮覆盖 F1/F2/F3/F4 四种规则", rules === "F1-trace,F2-inv,F3-gold,F4-spell", rules);
  const second = G.sweep(v);
  ok("次轮命中 0 条", second.length === 0, "实际 " + second.length + " " + JSON.stringify(second.map(x => x.rule)));
  ok("状态稳定：lv 仍是 1（F1 已还原）", v.mpDgLv === 1, "实际 " + v.mpDgLv);
}

/* ---------- [6] 合法进度整体不动（误伤防线） ---------- */
console.log("[6] 合法存档零改动（防误伤）");
{
  const v = {
    mpDgUnlocked: 1,
    mpDgLv: 12,
    mpDgExp: 320,
    mpDgAtk: 14,
    mpDgDef: 10,
    mpDgAgi: 6,
    mpSkill: { atk: 4, def: 3, fireWall: 1, iceSpike: 1, shadowBolt: 1, thunderStorm: 1, meteor: 1 },
    mpSkillPts: 5,
    dgFloor: 9,
    dgKills: 137,
    dgGold: 2400,
    dgHp: 180,
    dgMana: 95,
    dgManaMax: 100,
    dgInv: { fang: 12, hide: 7, herb: 40, pot_hp1: 3 }
  };
  const snap = JSON.stringify(v);
  const items = G.sweep(v);
  ok("合法存档 0 命中", items.length === 0, JSON.stringify(items.map(x => x.rule + ":" + x.path)));
  ok("合法存档内容完全未变", JSON.stringify(v) === snap);
  ok("mpDgUnlocked=1 不被单独判作弊（模组自带管理员 unlock 同形态）", v.mpDgUnlocked === 1);
}
{
  /* 高等级老玩家：lv30 + 9 法术全开 + 18 样物资全 99 + 9999 金币都合法（F4 靠等级豁免）*/
  const v = { mpDgLv: 30, mpSkill: allSpellsOn(), dgInv: allInv99() };
  const snap = JSON.stringify(v);
  const items = G.sweep(v);
  ok("lv30 老玩家 9 法术 + 18×99 物资 → 全部豁免", items.length === 0,
    JSON.stringify(items.map(x => x.rule + ":" + x.path)));
  ok("内容未变", JSON.stringify(v) === snap);
}

/* ---------- [7] 只读审计 ---------- */
console.log("[7] audit 只读，不改存档");
{
  const v = {
    mbCE_wrote: { "cheat:dolonline:dl_floor": { type: "cheat", modId: "dolonline", path: "dgFloor", before: 1, after: 30 } },
    dgFloor: 30,
    dgGold: 9999
  };
  const before = JSON.stringify(v);
  const found = G.audit(v);
  ok("审计报出 F1 + F3", found.length === 2 && found.some(x => x.rule === "F1-trace") && found.some(x => x.rule === "F3-gold"),
    JSON.stringify(found.map(x => x.rule)));
  ok("审计后存档一字未改", JSON.stringify(v) === before);
}
{
  const v = { mpSkill: allSpellsOn(), mpDgLv: 2 };
  const snap = JSON.stringify(v);
  const found = G.audit(v);
  ok("审计报出 F4 9 条", found.filter(x => x.rule === "F4-spell").length === 9,
    JSON.stringify(found.map(x => x.rule)));
  ok("审计不改 mpSkill", JSON.stringify(v) === snap);
}

/* ---------- [8] 回退日志 ---------- */
console.log("[8] 回退留痕可追溯");
{
  const v = { dgGold: 9999 };
  G.sweep(v);
  ok("dolguard_log 记录 1 条", Array.isArray(v.dolguard_log) && v.dolguard_log.length === 1);
  ok("日志含规则与路径", v.dolguard_log[0].rule === "F3-gold" && v.dolguard_log[0].path === "dgGold");
  ok("count 累加为 1", v.dolguard_count === 1, "实际 " + v.dolguard_count);
  G.sweep(v);
  ok("二次巡检 log 不再增长", v.dolguard_log.length === 1);
}

/* ---------- [9] 路径与命名空间守卫 ---------- */
console.log("[9] 命名空间守卫");
{
  ok("mp 前缀放行", G._isGuardKey("mpDgLv") === true);
  ok("dg 前缀放行", G._isGuardKey("dgInv.fang") === true);
  ok("npcAff 放行", G._isGuardKey("npcAff") === true);
  ok("原版 money 拦下", G._isGuardKey("money") === false);
  ok("原版 pain 拦下", G._isGuardKey("pain") === false);
  ok("空串拦下", G._isGuardKey("") === false);
  ok("resolvePath 正常解析", G._resolvePath({ a: { b: 1 } }, "a.b").parent.b === 1);
  ok("resolvePath 宿主缺失返回 null", G._resolvePath({}, "x.y") === null);
}

/* ---------- [10] 判据常量与源码一致 ---------- */
console.log("[10] 判据常量自检");
{
  ok("9 个法术键", G._spellKeys.length === 9, String(G._spellKeys.length));
  ok("18 个物资键", G._invKeys.length === 18, String(G._invKeys.length));
  ok("5 个 auto 等级左值", Object.keys(G._autoByKey).length === 5);
  ok("cost 合计 28", G._costTotal === 28, String(G._costTotal));
  ok("auto 等级：fireWall3/iceSpike5/shadowBolt7/thunderStorm9/meteor12",
    G._autoByKey.fireWall === 3 && G._autoByKey.iceSpike === 5 && G._autoByKey.shadowBolt === 7 &&
    G._autoByKey.thunderStorm === 9 && G._autoByKey.meteor === 12);
  ok("金币特征值 9999", G._goldVal === 9999);
  ok("F4 等级门槛 12", G._spellFullLv === 12, String(G._spellFullLv));
}

console.log("\n合计: " + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
