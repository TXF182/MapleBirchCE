#!/usr/bin/env node
/* 深扫 4：town_projects 字段上下文（跨行）+ office 工作细节 + 角色（NPCList） */
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

// 1) town_projects 各字段赋值/比较
for (const f of ["road", "diving", "thicket", "bridge", "green"]) {
  const c = ctxAround("town_projects" + "\\." + f, 100, 140, 6);
  console.log("\n===== town_projects." + f + "（" + c.length + "）=====");
  c.forEach((s, i) => console.log("[" + i + "] " + s + "\n"));
}

// 2) town_projects 初始化/整体
const init = ctxAround("town_projects\\s*=\\s*\\{", 60, 400, 3);
console.log("\n===== town_projects 初始化 =====");
init.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 500) + "\n"));

// 3) office 工作
for (const k of ["officeFloor", "officejobintro", "officecomplaints", "officelastcomplaintday"]) {
  const c = ctxAround(k, 90, 130, 5);
  console.log("\n===== " + k + "（" + c.length + "）=====");
  c.forEach((s, i) => console.log("[" + i + "] " + s + "\n"));
}

// 4) NPCList 角色注册
const npcRe = /NPCList\.([a-zA-Z_]+)/g;
const npcs = new Map();
let nm;
while ((nm = npcRe.exec(html)) !== null) npcs.set(nm[1], (npcs.get(nm[1]) || 0) + 1);
console.log("\n===== NPCList 角色（" + npcs.size + "）=====");
console.log([...npcs].sort((a, b) => a[1] - b[1]).map(x => x[0]).join(", "));
