#!/usr/bin/env node
/* 深扫 10：找"海伦办公室"真身（Helen's office 变体）+ 办公楼场景名全景 */
"use strict";
const fs = require("fs");
const files = {
  "原版": "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game\\Degrees of Lewdity.html",
  "Lyra": "C:\\Users\\27352\\Downloads\\DoL-0.5.12.13-Lyra-1.0.1a-goose-1004.1\\Degrees of Lewdity.html"
};
for (const [tag, FILE] of Object.entries(files)) {
  const html = fs.readFileSync(FILE, "utf8");
  console.log("################ " + tag + " ################");

  // 1) Helen's / Helen 变体 + office 邻近
  for (const v of ["Helen's", "Helens", "Helen.", "Helen ", "Helene", "Ellen", "Hellen"]) {
    const re = new RegExp("[\\s\\S]{0,90}" + v + "[\\s\\S]{0,140}", "g");
    let m, n = 0;
    while ((m = re.exec(html)) !== null) {
      const s = m[0].replace(/\s+/g, " ").trim();
      if (s.indexOf("Helen") !== -1 && s.indexOf("office") !== -1) console.log("[" + v + " OFFICE] " + s.slice(0, 260) + "\n");
      if (++n >= 6) break;
    }
  }

  // 2) 办公楼场景名（tw-passagedata 正确结构）
  const passRe = /<tw-passagedata[^>]*name="([^"]+)"/g;
  const officePass = new Set();
  let pm;
  while ((pm = passRe.exec(html)) !== null) {
    const n = pm[1].trim();
    if (/office|agency|lobby|lounge|temp|floor/i.test(n)) officePass.add(n);
  }
  console.log("===== 办公楼相关 passage（" + officePass.size + "）=====");
  console.log([...officePass].slice(0, 70).join("\n"));

  // 3) office 区域名（<<set $location to "office...">>）
  const locRe = /\$location\s+to\s+"([^"]*office[^"]*)"/g;
  const locs = new Set();
  let lm;
  while ((lm = locRe.exec(html)) !== null) locs.add(lm[1]);
  console.log("\n===== office location 值（" + locs.size + "）=====");
  console.log([...locs].join(", "));
}
