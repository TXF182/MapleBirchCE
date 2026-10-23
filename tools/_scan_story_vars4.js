/* 任务三精扫 v4：robindebtevent 阶段语义 + robinmissing 取值 + kylarSeen 标记 + avery_mansion 相关 flag */
const fs = require("fs");
const GAME = "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
const html = fs.readFileSync(GAME, "utf8");
function ctxAll(re, tag, maxN) {
  re.lastIndex = 0; let m, n = 0;
  while ((m = re.exec(html)) !== null) {
    const s = Math.max(0, m.index - 90), e = Math.min(html.length, m.index + m[0].length + 90);
    console.log("[" + tag + " #" + (++n) + "] " + html.slice(s, e).replace(/\n/g, " "));
    if (n >= maxN) break;
  }
  console.log("");
}
// robindebtevent 所有 case 阶段
ctxAll(/&lt;&lt;case "([a-z_]+)"&gt;&gt;[^&]*?&lt;&lt;set \$robindebtevent to (\d+)/g, "robindebtevent case", 20);
// robinmissing 所有赋值
ctxAll(/&lt;&lt;set \$robinmissing to ([^&]*?)&gt;&gt;/g, "robinmissing 赋值", 8);
// kylarSeen pushUnique
ctxAll(/\$kylarSeen\.pushUnique\("([^"]+)"\)/g, "kylarSeen 标记", 15);
// avery_tower.stage 设置
ctxAll(/&lt;&lt;set \$avery_tower\.stage to (\d+)&gt;&gt;/g, "avery_tower.stage", 6);
// avery_party.stage 最大可能取值相关（guests 类型）
ctxAll(/\$avery_party\.guests\.includes\("(\w+)"\)/g, "party guests 类型", 10);
