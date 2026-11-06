#!/usr/bin/env node
/* 深扫 16：地点阶段键的阶段上限（gte/is/== 阈值实证），供"地点"子界面 max 取值 */
"use strict";
const fs = require("fs");
const FILE = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game\\Degrees of Lewdity.html";
const html = fs.readFileSync(FILE, "utf8");

const keys = ["farm_stage", "farm_phase", "flats_progress", "temple_cloister_progress", "temple_arcade_phase",
  "asylumassessmentprogress", "asylumPuzzleProgress", "scienceprogression", "scienceterrariumprogression",
  "adultshopprogress", "loft_upgrade", "brothel_machine_repair",
  "town_projects.road", "town_projects.diving", "town_projects.thicket", "town_projects.bridge", "town_projects.green"];

for (const k of keys) {
  const re = new RegExp("\\$" + k.replace(/\./g, "\\.") + "\\s*(?:gte|gt|is|lte|lt)\\s*([0-9]+)", "g");
  const set = new Set();
  let m;
  while ((m = re.exec(html)) !== null) { set.add(m[1]); }
  // 也收 == N / = N（is N 或 === N）
  const re2 = new RegExp("\\$" + k.replace(/\./g, "\\.") + "\\s*(?:is|===)\\s*([0-9]+)", "g");
  while ((m = re2.exec(html)) !== null) { set.add(m[1]); }
  const arr = [...set].map(Number).sort((a, b) => a - b);
  console.log(k + " → 阈值 " + (arr.length ? arr.join("/") : "（无数值比较）"));
}
// town_projects 子字段确认
const tp = html.match(/\$town_projects\.[A-Za-z_]+/g);
if (tp) { const s = new Set(tp.map(x => x.replace("$town_projects.", ""))); console.log("\ntown_projects 子字段: " + [...s].join(", ")); }
