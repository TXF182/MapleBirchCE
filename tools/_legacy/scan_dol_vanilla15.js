#!/usr/bin/env node
/* 深扫 15：NPCNameList 字面量数组 + perName 键表（setup.perName 各键的函数） */
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

// 1) NPCNameList 字面量数组（找 = [ 或 : [ 形态）
for (const pat of ["NPCNameList\\s*=\\s*\\[", "NPCNameList\\s*:\\s*\\["]) {
  const c = ctxAround(pat, 0, 700, 3);
  if (c.length) {
    console.log("===== " + pat + " =====");
    c.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 800) + "\n"));
  }
}

// 2) perName 对象键（"key": () => 或 key: () => 形态，在 setup.perName 附近）
const pn = ctxAround("perName\\s*=\\s*\\{", 0, 4000, 1);
console.log("===== perName = { =====");
pn.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 4200) + "\n"));

// 3) loveAlias 对象键（持久 NPC 的好感标签）
const la = ctxAround("loveAlias\\s*=\\s*\\{", 0, 2600, 1);
console.log("===== loveAlias = { =====");
la.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 2800) + "\n"));
