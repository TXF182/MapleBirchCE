#!/usr/bin/env node
/* 侦察：DoL 0.5.12.13 本体 HTML 扫描「市政府改造项目 / 办公大楼工作 / 新角色」
 * 目标：列出相关 passage 名、变量键、NPC 引用，供适配甄别。 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game\\Degrees of Lewdity.html";
const html = fs.readFileSync(FILE, "utf8");
console.log("HTML 大小: " + (html.length / 1048576).toFixed(1) + " MB");

// 1) passage 名侦察：市政府/办公楼/市长/改造
const passageRe = /:: ([^\n]+)/g;
const hits = new Map(); // keyword -> Set(passageName)
const kws = ["town hall", "townhall", "office", "mayor", "renovat", "municipal", "civic", "city hall"];
let m;
while ((m = passageRe.exec(html)) !== null) {
  const name = m[1].trim();
  const low = name.toLowerCase();
  for (const kw of kws) {
    if (low.indexOf(kw) !== -1) {
      if (!hits.has(kw)) hits.set(kw, new Set());
      hits.get(kw).add(name);
    }
  }
}
for (const [kw, set] of hits) {
  console.log("\n== passage 含「" + kw + "」(" + set.size + ") ==");
  console.log([...set].slice(0, 40).join("\n"));
}

// 2) 变量键侦察
function keyCounts(pattern, label) {
  const re = new RegExp(pattern, "g");
  const counts = new Map();
  let mm;
  while ((mm = re.exec(html)) !== null) {
    const k = mm[1];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const arr = [...counts].sort((a, b) => b[1] - a[1]);
  console.log("\n== " + label + " 键（top 40）==");
  console.log(arr.slice(0, 40).map(x => x[0] + "×" + x[1]).join("\n"));
}
keyCounts(/\$(townhall|townHall|mayor|renovat[a-zA-Z]*|municipal[a-zA-Z]*|office[a-zA-Z]*|civic[a-zA-Z]*)[a-zA-Z_.]*\b/g, "市政府/办公楼");
keyCounts(/\$([a-zA-Z_]*[Rr]enovat[a-zA-Z_]*)\b/g, "改造");
