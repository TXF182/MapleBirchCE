#!/usr/bin/env node
/* 深扫 12：office_manager 宏定义 + manager NPC 注册机制 + manager 数据键 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game\\Degrees of Lewdity.html";
const html = fs.readFileSync(FILE, "utf8");

function ctxAround(key, before, after, limit) {
  const re = new RegExp("([\\s\\S]{0," + before + "}" + key + "[\\s\\S]{0," + after + "})", "g");
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const s = m[1].replace(/\s+/g, " ").trim();
    if (out.indexOf(s) === -1) out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

// 1) office_manager 宏定义
const om = ctxAround('widget "office_manager"', 40, 900, 2);
console.log("===== office_manager 宏定义 =====");
om.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 1000) + "\n"));

// 2) manager 的 npc 对象 / 名字 / 性别机制
for (const k of ["C\\.npc\\.manager", "npc_manager", "managerName", "managerGift", "managerGender", "managerAge"]) {
  const c = ctxAround(k, 70, 160, 5);
  if (c.length) { console.log("\n===== " + k + "（" + c.length + "）====="); c.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 300) + "\n")); }
}

// 3) manager 全部独立键（managerXxx / xxxManager）
const mkRe = /\$([a-zA-Z_]*[Mm]anager[a-zA-Z_]*)\b/g;
const mks = new Map();
let mm;
while ((mm = mkRe.exec(html)) !== null) {
  const k = mm[1];
  mks.set(k, (mks.get(k) || 0) + 1);
}
console.log("===== manager 键（" + mks.size + "）=====");
console.log([...mks].sort((a, b) => b[1] - a[1]).map(x => x[0] + "×" + x[1]).join(", "));

// 4) 经理名字来源（随机名字池中 manager 用的）
const nm = ctxAround('"manager"', 100, 200, 8);
console.log("\n===== \"manager\" 字符串上下文（" + nm.length + "）=====");
nm.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 320) + "\n"));
