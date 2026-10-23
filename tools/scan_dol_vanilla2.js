#!/usr/bin/env node
/* 深扫 2：office 上下文 + 改造词形变体 + NPC 注册表 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game\\Degrees of Lewdity.html";
const html = fs.readFileSync(FILE, "utf8");

// 1) office 相关 passage 名
const passageRe = /:: ([^\n]+)/g;
const officePassages = new Set();
let m;
while ((m = passageRe.exec(html)) !== null) {
  const n = m[1].trim().toLowerCase();
  if (n.indexOf("office") !== -1 || n.indexOf("job") !== -1 || n.indexOf("work") !== -1) officePassages.add(m[1].trim());
}
console.log("== 含 office/job/work 的 passage（" + officePassages.size + "）==");
console.log([...officePassages].slice(0, 60).join("\n"));

// 2) 改造词形变体键
const variants = ["renov", "redecora", "construct", "rebuild", "upgrad", "project", "refurbish", "restor", "repair", "develo", "planning", "permit", "contract"];
for (const v of variants) {
  const re = new RegExp("\\$([a-zA-Z0-9_]*" + v + "[a-zA-Z0-9_]*)\\b", "gi");
  const set = new Map();
  let mm;
  while ((mm = re.exec(html)) !== null) {
    const k = mm[1];
    if (k.length > 3 && !/^(development)$/i.test(k)) set.set(k, (set.get(k) || 0) + 1);
  }
  if (set.size) {
    const arr = [...set].sort((a, b) => b[1] - a[1]);
    console.log("\n== 词形「" + v + "」键（top 15）==");
    console.log(arr.slice(0, 15).map(x => x[0] + "×" + x[1]).join("\n"));
  }
}

// 3) C.npc / NPC 注册：找人物定义块（DoL 用 NpcList 或 C.npc.xxx）
const npcRe = /C\.npc\.([a-zA-Z_]+)\s*=/g;
const npcs = new Map();
let nm;
while ((nm = npcRe.exec(html)) !== null) {
  npcs.set(nm[1], (npcs.get(nm[1]) || 0) + 1);
}
console.log("\n== C.npc 赋值角色（" + npcs.size + "）==");
console.log([...npcs].sort((a, b) => a[1] - b[1]).map(x => x[0]).join(", "));
