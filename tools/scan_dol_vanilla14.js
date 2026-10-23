#!/usr/bin/env node
/* 深扫 14：setup.NPCNameList 精确清单 + perName/per_npc 结构与键 + 经理字段 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Desktop\\DoL-ModLoader-0.5.12.13-v2.101.1\\Degrees of Lewdity.html";
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

// 1) setup.NPCNameList 精确数组
const nl = ctxAround("setup.NPCNameList", 30, 900, 1);
console.log("===== setup.NPCNameList =====");
nl.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 1100) + "\n"));

// 2) setup.perName 全表（持久 NPC 显示名来源）
const pn = ctxAround("setup.perName", 30, 2500, 1);
console.log("===== setup.perName =====");
pn.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 2600) + "\n"));

// 3) per_npc 键分布（$per_npc.<key> 出现统计）
const perRe = /\$per_npc\.([A-Za-z0-9_]+)\b/g;
const pks = new Map();
let pm;
while ((pm = perRe.exec(html)) !== null) {
  const k = pm[1];
  pks.set(k, (pks.get(k) || 0) + 1);
}
console.log("===== per_npc 键（" + pks.size + "）=====");
console.log([...pks].sort((a, b) => b[1] - a[1]).map(x => x[0] + "×" + x[1]).join(", "));

// 4) manager 生成后字段（generateRole office manager 产物字段，取 generateRole 定义）
const gr = ctxAround('widget "generateRole"', 30, 2000, 1);
console.log("===== generateRole 定义 =====");
gr.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 2200) + "\n"));

// 5) per_npc.manager 字段实例（love/lust/dom/wary/name_known 等）
const mg = ctxAround("per_npc.manager.", 30, 200, 6);
console.log("===== per_npc.manager.* 字段 =====");
mg.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 260) + "\n"));
