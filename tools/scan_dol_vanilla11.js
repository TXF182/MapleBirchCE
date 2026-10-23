#!/usr/bin/env node
/* 深扫 11：全稳定 NPC 名单（npcincr/npc 宏/C.npc 全形态）vs MCE 池 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Desktop\\DoL-ModLoader-0.5.12.13-v2.101.1\\Degrees of Lewdity.html";
const html = fs.readFileSync(FILE, "utf8");

const names = new Map(); // name -> count

// 1) npcincr 宏：<<npcincr NAME stat delta>>
let re = /npcincr\s+([A-Za-z][A-Za-z ]*?)\s+(?:love|lust|dom|awareness|like|submissiveness|alcohol|stress|trauma|obedience|jealousy|trust|romance)\b/g;
let m;
while ((m = re.exec(html)) !== null) {
  const n = m[1].trim();
  if (n) names.set(n, (names.get(n) || 0) + 1);
}
// 2) npc 宏：<<npc NAME>>
re = /<<npc\s+([A-Za-z][A-Za-z ]*?)(?:\s+[-]?\d+)?>>/g;
while ((m = re.exec(html)) !== null) {
  const n = m[1].trim();
  if (n && n !== "_position" && n !== "null") names.set(n, (names.get(n) || 0) + 1);
}
// 3) C.npc.NAME 全形态（压缩后可能 C.npc.NAME 或 c.npc["NAME"]）
re = /C\.npc\.([A-Za-z][A-Za-z0-9]*)|C\.npc\["([A-Za-z ][^"]*)"\]/g;
while ((m = re.exec(html)) !== null) {
  const n = (m[1] || m[2] || "").trim();
  if (n) names.set(n, (names.get(n) || 0) + 1);
}
// 4) llove/lperlove/llperlove 等宏的 NPC 参数：<<llove NAME>> <<lperlove "manager">>
re = /l(?:l|per|al)?(?:ove|ovehigh|perlove)?\s+["']?([A-Za-z][A-Za-z ]*)["']?\b/gi;
while ((m = re.exec(html)) !== null) {
  const n = m[1].trim();
  if (/love|al/i.test(m[0]) && n.length > 1) names.set(n, (names.get(n) || 0) + 1);
}

const sorted = [...names].sort((a, b) => b[1] - a[1]);
console.log("===== 全部稳定 NPC 引用（" + sorted.length + " 个，按引用数降序）=====");
console.log(sorted.map(x => x[0] + "×" + x[1]).join("\n"));
