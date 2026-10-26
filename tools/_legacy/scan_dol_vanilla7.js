#!/usr/bin/env node
/* 深扫 7：Helen 注册 + 全量命名 NPC 池提取 + MCE 缺失甄别 */
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

// 1) Helen 注册：C.npc.Helen / Helen 字符串 / office 相关
const h1 = ctxAround("Helen", 90, 200, 10);
console.log("===== Helen 上下文（" + h1.length + "）=====");
h1.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 340) + "\n"));

// 2) Helen 是否命名 NPC / 恋爱对象
const h2 = ctxAround("loveInterestNpc", 40, 300, 2);
console.log("===== loveInterestNpc 定义 =====");
h2.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 420) + "\n"));

// 3) 全量命名 NPC：setup.NPCNameList 主定义 + 所有 newNamedNpc 调用
const nl = ctxAround("setup\\.NPCNameList\\s*=\\s*\\[", 40, 500, 2);
console.log("===== setup.NPCNameList 定义 =====");
nl.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 560) + "\n"));

// 4) 所有 _newNNPCs / newNamedNpc 注册的角色名（含模组整合注入）
const nnRe = /nam\s*:\s*"([^"]+)"/g;
const nams = new Set();
let nm;
while ((nm = nnRe.exec(html)) !== null) nams.add(nm[1]);
console.log("===== nam: 注册角色（" + nams.size + "）=====");
console.log([...nams].join(", "));
