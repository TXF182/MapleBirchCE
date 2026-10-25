#!/usr/bin/env node
/* 深扫 5：Winter/manager 角色注册方式 + NPCName 池内容 + npc 宏注册机制 */
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

// 1) Winter 注册上下文
const w = ctxAround("npc Winter", 120, 220, 6);
console.log("===== <<npc Winter>> 上下文（" + w.length + "）=====");
w.forEach((s, i) => console.log("[" + i + "] " + s + "\n"));
const w2 = ctxAround("'Winter'", 80, 150, 10);
console.log("===== 'Winter' 字符串引用（" + w2.length + "）=====");
w2.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 260) + "\n"));

// 2) NPCName 池：找初始化/内容
const nl = ctxAround("NPCName", 60, 200, 8);
console.log("===== NPCName 上下文（" + nl.length + "）=====");
nl.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 320) + "\n"));

// 3) npc 宏如何注册（找 NpcList / npc 数据源）
const nm = ctxAround("npcList", 60, 160, 6);
console.log("===== npcList 上下文（" + nm.length + "）=====");
nm.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 300) + "\n"));

// 4) manager 角色
const mg = ctxAround("managerLove", 80, 120, 6);
console.log("===== managerLove 上下文（" + mg.length + "）=====");
mg.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 260) + "\n"));
const mg2 = ctxAround("npc manager", 100, 200, 6);
console.log("===== <<npc manager>> 上下文（" + mg2.length + "）=====");
mg2.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 300) + "\n"));
