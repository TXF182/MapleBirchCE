#!/usr/bin/env node
/* 深扫 8：Lyra 整合版（用户实际游玩）找 Helen/海伦 + 办公室角色 + 其他区域 NPC */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Downloads\\DoL-0.5.12.13-Lyra-1.0.1a-goose-1004.1\\Degrees of Lewdity.html";
if (!fs.existsSync(FILE)) { console.error("Lyra 版不存在: " + FILE); process.exit(1); }
const html = fs.readFileSync(FILE, "utf8");
console.log("Lyra HTML 大小: " + (html.length / 1048576).toFixed(1) + " MB");

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

// 1) Helen / 海伦
const h = ctxAround("Helen", 90, 220, 12);
console.log("===== Helen 上下文（" + h.length + "）=====");
h.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 360) + "\n"));
const hn = ctxAround("海伦", 90, 220, 12);
console.log("===== 海伦 上下文（" + hn.length + "）=====");
hn.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 360) + "\n"));

// 2) Helen 的 office / 办公室形态
const ho = ctxAround("Helen", 40, 40, 30);
console.log("===== Helen 短上下文（" + ho.length + "）=====");
ho.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 120) + "\n"));

// 3) 办公楼相关角色（manager 之外）：temp agency / office 场景里的 named NPC
const mo = ctxAround("office_manager", 60, 160, 4);
console.log("===== office_manager 宏上下文 =====");
mo.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 320) + "\n"));

// 4) 其他区域角色甄别：码头/庄园/学校 等非命名 NPC 但有名字的对象
for (const k of ["Harlow", "Haley", "Hellen", "Helena", "Henley"]) {
  const c = ctxAround(k, 70, 120, 3);
  console.log("\n===== " + k + "（" + c.length + "）=====");
  c.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 260) + "\n"));
}
