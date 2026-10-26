/* 任务三精扫 v3：截取 $kylar / $robin / $avery_tower / $avery_party / $robindebtevent 初始化定义全文 */
const fs = require("fs");
const GAME = "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
const html = fs.readFileSync(GAME, "utf8");
function showSet(re, tag, maxLen) {
  re.lastIndex = 0; let m, n = 0;
  while ((m = re.exec(html)) !== null) {
    const s = Math.max(0, m.index - 30), e = Math.min(html.length, m.index + 400);
    console.log("[" + tag + " #" + (++n) + "] " + html.slice(s, e).replace(/\n/g, " ").slice(0, maxLen));
    console.log("");
    if (n >= 3) break;
  }
}
showSet(/&lt;&lt;set \$kylar to \{/g, "$kylar 初始化", 700);
showSet(/&lt;&lt;set \$robin to \{/g, "$robin 初始化", 700);
showSet(/&lt;&lt;set \$avery_tower to \{/g, "$avery_tower 初始化", 700);
showSet(/&lt;&lt;set \$avery_party to \{/g, "$avery_party 初始化", 500);
showSet(/&lt;&lt;set \$robinmissing to \d+/g, "$robinmissing 取值", 200);
showSet(/&lt;&lt;set \$robindebtevent to \d+/g, "$robindebtevent 取值", 160);
showSet(/\$robin\.\w+/g, "$robin. 任意字段", 120);
