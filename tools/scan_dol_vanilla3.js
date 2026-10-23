#!/usr/bin/env node
/* 深扫 3：town_projects / office 键的上下文与关联角色 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Desktop\\DoL-ModLoader-0.5.12.13-v2.101.1\\Degrees of Lewdity.html";
const html = fs.readFileSync(FILE, "utf8");

// 1) town_projects 上下文：抽取含该键的片段（前 120 后 200 字符），聚类
function ctxOf(key, limit) {
  const re = new RegExp("(.{120}" + key + ".{200})", "g");
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) { out.push(m[1].replace(/\s+/g, " ").slice(0, 320)); if (out.length >= limit) break; }
  return out;
}
const tp = ctxOf("town_projects", 40);
console.log("== town_projects 上下文样例（" + tp.length + "）==");
tp.forEach((s, i) => console.log("[" + i + "] " + s + "\n"));

// 2) town_projects 的字段形态：找 .xxx. 引用
const fieldRe = /town_projects(?:\[['"]?([a-zA-Z_0-9]+)['"]?\])?(?:\.([a-zA-Z_0-9]+))?/g;
const fields = new Map();
let fm;
while ((fm = fieldRe.exec(html)) !== null) {
  const f = fm[1] || fm[2] || "(裸引用)";
  fields.set(f, (fields.get(f) || 0) + 1);
}
console.log("== town_projects 字段形态（top 30）==");
console.log([...fields].sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0] + "×" + x[1]).join("\n"));

// 3) office 键上下文
for (const k of ["officejobintro", "officecomplaints"]) {
  const c = ctxOf(k, 8);
  console.log("\n== " + k + " 上下文（" + c.length + "）==");
  c.forEach((s, i) => console.log("[" + i + "] " + s + "\n"));
}

// 4) town_projects 关联角色：找附近 NPC 名（大写首字母的人名模式太难，改为找 passage 名）
const passageRe = /:: ([^\n]+)/g;
const tpPassages = new Set();
let m2;
while ((m2 = passageRe.exec(html)) !== null) {
  const n = m2[1].trim();
  if (/town|project|office|job|work|mayor|municipal|civic/i.test(n)) tpPassages.add(n);
}
console.log("== 相关 passage 名（" + tpPassages.size + "）==");
console.log([...tpPassages].slice(0, 80).join("\n"));
