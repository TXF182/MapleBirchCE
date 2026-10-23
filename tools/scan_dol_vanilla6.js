#!/usr/bin/env node
/* 深扫 6：命名 NPC 注册表（NPCNameList/updateNewNamedNpcs）是否含 Winter；town_projects 全字段 */
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

// 1) updateNewNamedNpcs 完整内容（可能很长，分段取）
const un = ctxAround("updateNewNamedNpcs", 30, 3000, 2);
console.log("===== updateNewNamedNpcs 定义 =====");
un.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 2600) + "\n"));

// 2) NPCNameList 初始化/键名表
const ncl = ctxAround("NPCNameList\\s*=\\s*\\[", 60, 600, 3);
console.log("===== NPCNameList = [ 上下文 =====");
ncl.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 700) + "\n"));

// 3) Winter 的 npc 对象键（love/lust/dom/awareness）
for (const k of ["C\\.npc\\.Winter", "npc\\.Winter\\.", "\\.Winter\\.love", "Winter.*love"]) {
  const c = ctxAround(k, 60, 160, 4);
  if (c.length) { console.log("\n===== " + k + "（" + c.length + "）====="); c.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 280) + "\n")); }
}

// 4) town_projects 全字段（不截断）
const fieldRe = /town_projects(?:\[['"]?([a-zA-Z_0-9]+)['"]?\])?(?:\.([a-zA-Z_0-9]+))?/g;
const fields = new Map();
let fm;
while ((fm = fieldRe.exec(html)) !== null) {
  const f = fm[1] || fm[2] || "(裸引用)";
  fields.set(f, (fields.get(f) || 0) + 1);
}
console.log("===== town_projects 全字段（" + fields.size + "）=====");
console.log([...fields].sort((a, b) => b[1] - a[1]).map(x => x[0] + "×" + x[1]).join(", "));
