#!/usr/bin/env node
/* 深扫 13：per_npc 全量持久 NPC 清单 + 地点阶段任务全景 */
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

// 1) loveAlias 全表（含 per_npc 全部持久角色）
const la = ctxAround("setup.loveAlias", 40, 2500, 1);
console.log("===== loveAlias 全表 =====");
la.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 2600) + "\n"));

// 2) allowed_npcs / per_npc 相关角色清单
const an = ctxAround("allowed_npcs", 60, 500, 2);
console.log("===== allowed_npcs =====");
an.forEach((s, i) => console.log("[" + i + "] " + s.slice(0, 600) + "\n"));

// 3) 地点阶段任务键：progress/stage/phase + 地点词
const kws = {
  "庄园": "avery|estate|mansion",
  "监狱": "prison|inmate",
  "修道院": "temple",
  "孤儿院": "orphan",
  "妓院": "brothel",
  "鸟舍": "bird",
  "学校": "school",
  "商场": "mall",
  "码头": "docks|dock",
  "岛": "island",
  "医院": "hospital|asylum"
};
for (const [tag, pat] of Object.entries(kws)) {
  const re = new RegExp("\\$([a-zA-Z0-9_]*(?:" + pat + ")[a-zA-Z0-9_]*)\\b", "gi");
  const set = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const k = m[1];
    set.set(k, (set.get(k) || 0) + 1);
  }
  const arr = [...set].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("\n===== " + tag + " 键（top 12）=====");
  console.log(arr.map(x => x[0] + "×" + x[1]).join(", "));
}

// 4) 阶段类键（progress|stage|phase 后缀）
const stageRe = /\$([a-zA-Z0-9_]+(?:progress|stage|phase|upgrade|repair|renovat|level|tier)[a-zA-Z0-9_]*)\b/g;
const stages = new Map();
let sm;
while ((sm = stageRe.exec(html)) !== null) {
  const k = sm[1];
  stages.set(k, (stages.get(k) || 0) + 1);
}
console.log("\n===== 阶段类键（" + stages.size + "，top 40）=====");
console.log([...stages].sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x[0] + "×" + x[1]).join(", "));
