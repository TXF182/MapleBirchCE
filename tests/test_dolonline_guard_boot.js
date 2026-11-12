#!/usr/bin/env node
/* DoLOnline Guard 自动挂载链路单测：node tests/test_dolonline_guard_boot.js
 *
 * 为什么单独一条：主单测只验证纯函数（G.sweep），但玩家真实路径是
 *   脚本加载 → SugarCube 就绪 → 立即巡检 → 每次 :passagestart 巡检 → 30s 定时兜底。
 * 这段链路在纯 node 里跑不到，必须给一个带 window/jQuery/State 的环境。
 * 用 jsdom 造真实 DOM，window.eval 在 window 上下文执行脚本，等价于 ModLoader 的加载方式。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (info ? "  → " + info : "")); }
}

const SRC = path.join(__dirname, "..", "tools", "dolonline-guard", "guard.js");
const code = fs.readFileSync(SRC, "utf8");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  runScripts: "outside-only",
  url: "file:///C:/fake/Degrees%20of%20Lewdity.html"
});
const w = dom.window;

/* 记录 jQuery 事件绑定 */
const bound = [];
w.jQuery = function () {
  return {
    on: function (ev, fn) { bound.push({ ev: ev, fn: fn }); return this; },
    off: function () { return this; }
  };
};

/* 记录定时器；不真正跑，避免拖住进程 */
const intervalFns = [];
w.setInterval = function (fn) { intervalFns.push(fn); return intervalFns.length; };

/* 造一个「被旧版 CE dolonline 适配器污染过的存档」 */
w.SugarCube = {};
w.State = {
  variables: {
    mbCE_wrote: {
      "cheat:dolonline:dl_dglv": { type: "cheat", modId: "dolonline", path: "mpDgLv", before: 1, after: 99 },
      "cheat:dolonline:dl_agi": { type: "cheat", modId: "dolonline", path: "mpDgAgi", before: 2, after: 30 },
      "cheat:deadwood-reblooms:dd_x": { type: "cheat", modId: "deadwood-reblooms", path: "ddPower", before: 1, after: 9 }
    },
    mpDgLv: 99,
    mpDgAgi: 30,
    ddPower: 9,
    dgGold: 9999,
    dgKills: 0,
    dgInv: (() => {
      const o = {};
      ["fang","hide","herb","ore","dust","ember","slime","pot_hp1","pot_hp2","pot_mp1","pot_mp2","pot_atk","pot_def","pot_agi","food_soup","food_steak","food_stew","food_ember_tea"].forEach(k => { o[k] = 99; });
      return o;
    })(),
    mpSkill: { fireWall: 1, iceSpike: 1, shadowBolt: 1, thunderStorm: 1, meteor: 1, uDesp: 1, uBurst: 1, uChain: 1, uBlood: 1 },
    mpSkillPts: 0,
    money: 5000
  }
};

w.eval(code);

console.log("[1] 加载即巡检");
{
  const v = w.State.variables;
  ok("脚本加载后暴露 window.DoLOnlineGuard", typeof w.DoLOnlineGuard === "object" && w.DoLOnlineGuard.version === "1.1.0");
  ok("F1：mpDgLv 已还原为 before=1", v.mpDgLv === 1, "实际 " + v.mpDgLv);
  ok("F1：mpDgAgi 已还原为 before=2", v.mpDgAgi === 2, "实际 " + v.mpDgAgi);
  ok("F1：其它 mod 留痕未被处理（ddPower 仍 9）", v.ddPower === 9);
  ok("F2：dgInv 18 键归 0（等级已还原为 1 才命中）", v.dgInv.fang === 0 && v.dgInv.food_ember_tea === 0);
  ok("F3：dgGold 归 0", v.dgGold === 0, "实际 " + v.dgGold);
  ok("F4：9 个法术键全被清空（lv1 < 12，9 键全 1 即 CE 指纹）",
    !("uBurst" in v.mpSkill) && !("iceSpike" in v.mpSkill) && !("fireWall" in v.mpSkill));
  ok("F4：退回 28 点（lv1 无任何等级白送）", v.mpSkillPts === 28, "实际 " + v.mpSkillPts);
  ok("原版 money 未被动", v.money === 5000);
  /* F1 2 条 + F2 1 条 + F3 1 条 + F4 9 条 = 13 */
  ok("回退日志已写入 13 条", Array.isArray(v.dolguard_log) && v.dolguard_log.length === 13, "实际 " + (v.dolguard_log || []).length);
}

console.log("[2] 事件与定时器挂载");
{
  ok("绑定了 :passagestart", bound.some(b => b.ev === ":passagestart"), JSON.stringify(bound.map(b => b.ev)));
  ok("注册了 30s 巡检 + 5s 长轮询两个定时器",
    intervalFns.length === 2 && intervalFns.every(f => typeof f === "function"),
    "intervalFns=" + intervalFns.length);
}

console.log("[3] passage 切换时再次拦截（模拟 CE 面板中途写入）");
{
  const v = w.State.variables;
  /* 玩家在游戏中途用旧 CE 面板又写了一笔（含留痕） */
  v.mbCE_wrote["cheat:dolonline:dl_dgdef"] = { type: "cheat", modId: "dolonline", path: "mpDgDef", before: 1, after: 40 };
  v.mpDgDef = 40;
  v.dgGold = 9999;
  v.dgKills = 0;
  const before = v.dolguard_log.length;
  bound.filter(b => b.ev === ":passagestart").forEach(b => b.fn());
  ok("事件触发后 mpDgDef 还原为 1", v.mpDgDef === 1, "实际 " + v.mpDgDef);
  ok("事件触发后 dgGold 归 0", v.dgGold === 0, "实际 " + v.dgGold);
  ok("日志新增 2 条", v.dolguard_log.length === before + 2, "实际 " + (v.dolguard_log.length - before));
}

console.log("[4] 定时兜底也生效");
{
  const v = w.State.variables;
  v.dgGold = 9999;
  v.dgKills = 0;
  intervalFns[0]();
  ok("定时器回调后 dgGold 归 0", v.dgGold === 0, "实际 " + v.dgGold);
}

console.log("[5] 二次巡检幂等（真实环境）");
{
  const v = w.State.variables;
  const snapLv = v.mpDgLv;
  const snapCount = v.dolguard_count;
  bound.filter(b => b.ev === ":passagestart").forEach(b => b.fn());
  ok("再次触发不再改动", v.mpDgLv === snapLv && v.dolguard_count === snapCount,
    "lv " + v.mpDgLv + " count " + v.dolguard_count);
}

console.log("\n合计: " + pass + " 通过 / " + fail + " 失败");
dom.window.close();
process.exit(fail ? 1 : 0);
