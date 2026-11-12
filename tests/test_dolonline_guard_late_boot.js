#!/usr/bin/env node
/* DoLOnline Guard 晚就绪接续单测：node tests/test_dolonline_guard_late_boot.js
 *
 * 为什么单独一条：boot 用例假设「脚本加载时 State 已就绪」，而 ModLoader 的真实时序
 * 不是这样——从 game\Degrees of Lewdity.html 内实证 loadMod() 只显式处理
 *   scriptFileList_inject_early（@12385677）/ scriptFileList_earlyload（@12388849）/
 *   scriptFileList_preload（@12342860）三类，
 * 普通 scriptFileList（本包用的这一类）的执行点落在 SugarCube 自举前后不定的位置，
 * 脚本跑起来时 window.State 往往还不存在。
 *
 * 本用例把那一刻复现出来：脚本先执行（State 缺失）→ 之后 State 才出现 →
 * 必须靠 5s 长轮询接上，且只挂载一次。
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

/* jQuery 事件绑定记录 */
const bound = [];
w.jQuery = function () {
  return { on: function (ev, fn) { bound.push({ ev: ev, fn: fn }); return this; }, off: function () { return this; } };
};

/* 定时器全部只记录、不真跑（否则进程被拖住） */
const intervalFns = [];
w.setInterval = function (fn) { intervalFns.push(fn); return intervalFns.length; };
const timeoutFns = [];
w.setTimeout = function (fn) { timeoutFns.push(fn); return timeoutFns.length; };

/* 关键：脚本执行时 State 还不存在 */
console.log("[1] 脚本加载时 State 缺失");
w.eval(code);
{
  ok("脚本本身不抛错（已加载）", typeof w.DoLOnlineGuard === "object");
  ok("未绑定 :passagestart（State 没就绪不挂事件）", bound.length === 0, "bound=" + bound.length);
  ok("未启动 30s 巡检（只有长轮询在排队）", intervalFns.length === 1, "intervalFns=" + intervalFns.length);
  ok("waitBoot 已排入首轮重试", timeoutFns.length >= 1, "timeoutFns=" + timeoutFns.length);
}

console.log("[2] State 晚到：长轮询接上");
{
  /* 模拟 SugarCube 自举完成 */
  w.State = {
    variables: {
      dgGold: 9999,
      dgInv: (() => {
        const o = {};
        ["fang","hide","herb","ore","dust","ember","slime","pot_hp1","pot_hp2","pot_mp1","pot_mp2","pot_atk","pot_def","pot_agi","food_soup","food_steak","food_stew","food_ember_tea"].forEach(k => { o[k] = 99; });
        return o;
      })(),
      mpDgLv: 1,
      mpSkill: { fireWall: 1, iceSpike: 1, shadowBolt: 1, thunderStorm: 1, meteor: 1, uDesp: 1, uBurst: 1, uChain: 1, uBlood: 1 },
      mpSkillPts: 0,
      money: 5000
    }
  };
  /* 长轮询是 intervalFns[0]（State 缺失时唯一注册的那个） */
  intervalFns[0]();
  const v = w.State.variables;
  ok("长轮询触发后立即补跑巡检：F3 命中", v.dgGold === 0, "实际 " + v.dgGold);
  ok("F2 命中：18 键归 0", v.dgInv.fang === 0 && v.dgInv.food_ember_tea === 0);
  ok("F4 命中：9 键清空", !("uBlood" in v.mpSkill) && !("fireWall" in v.mpSkill));
  ok("F4 退回 28 点", v.mpSkillPts === 28, "实际 " + v.mpSkillPts);
  ok("此时才绑定 :passagestart", bound.some(b => b.ev === ":passagestart"), JSON.stringify(bound.map(b => b.ev)));
  ok("此时才启动 30s 巡检", intervalFns.length === 2, "intervalFns=" + intervalFns.length);
  ok("原版 money 未被动", v.money === 5000);
}

console.log("[3] 接上之后幂等：长轮询再触发不改动");
{
  const v = w.State.variables;
  const snapshot = JSON.stringify(v);
  intervalFns[0]();
  intervalFns[0]();
  ok("二次/三次长轮询不改存档", JSON.stringify(v) === snapshot);
  ok("事件与定时器未被重复挂载", bound.length === 1 && intervalFns.length === 2,
    "bound=" + bound.length + " intervalFns=" + intervalFns.length);
}

console.log("[4] passage 事件在线生效");
{
  const v = w.State.variables;
  v.dgGold = 9999;
  const before = (v.dolguard_log || []).length;
  bound.filter(b => b.ev === ":passagestart").forEach(b => b.fn());
  ok("事件触发后 dgGold 归 0", v.dgGold === 0, "实际 " + v.dgGold);
  ok("日志新增 1 条", (v.dolguard_log || []).length === before + 1, "新增 " + ((v.dolguard_log || []).length - before));
}

console.log("\n合计: " + pass + " 通过 / " + fail + " 失败");
dom.window.close();
process.exit(fail ? 1 : 0);
