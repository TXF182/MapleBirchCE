#!/usr/bin/env node
/* 深扫 9：办公楼房间全景 + Quinn/市长 + MCE 映射对比（原版 32 命名 NPC 是否全有译名） */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Downloads\\DoL-0.5.12.13-Lyra-1.0.1a-goose-1004.1\\Degrees of Lewdity.html";
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

// 1) 办公楼 passage 全景（Office* 场景名）
const passageRe = /name="([^"]+)"[^>]*><tw-passagedata|:: ([^\n]+)/g;
const officePass = new Set();
let m;
while ((m = passageRe.exec(html)) !== null) {
  const n = (m[1] || m[2] || "").trim();
  if (/^Office|office/i.test(n) || /Helen|Lounge|lounge/i.test(n)) officePass.add(n);
}
console.log("===== Office/Helen/Lounge 相关 passage（" + officePass.size + "）=====");
console.log([...officePass].slice(0, 60).join("\n"));

// 2) Quinn/市长
const q = ctxAround("Quinn", 90, 200, 8);
console.log("\n===== Quinn 上下文（" + q.length + "）=====");
q.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 340) + "\n"));
const q2 = ctxAround("mayor", 60, 160, 8);
console.log("===== mayor 上下文（" + q2.length + "）=====");
q2.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 300) + "\n"));

// 3) 码头/其他区域 named NPC：loveInterestNpc + NPCNameList 已在原版扫到；
//    这里补：Lyra 版 NPCNameList（是否被模组扩展）
const nl = ctxAround("NPCNameList\\s*=\\s*\\[", 30, 600, 2);
console.log("\n===== Lyra NPCNameList 定义 =====");
nl.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 700) + "\n"));

// 4) 随机 NPC 名字池之外的"稳定命名角色"：title 字段（市长/医生/etc 的 NPC 头衔）
const tRe = /title:\s*"([^"]+)"/g;
const titles = new Set();
let tm;
while ((tm = tRe.exec(html)) !== null) titles.add(tm[1]);
console.log("===== NPC title 头衔（" + titles.size + "）=====");
console.log([...titles].join(", "));
