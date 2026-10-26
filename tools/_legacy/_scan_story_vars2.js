/* 任务三精扫 v2：确认各角色数值存储路径（$robin.xxx / $npc.xxx / _xxx）与关键剧情状态取值 */
const fs = require("fs");
const GAME = "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
const html = fs.readFileSync(GAME, "utf8");
function count(sample) { let n = 0; let i = 0; while ((i = html.indexOf(sample, i)) !== -1) { n++; i += sample.length; } return n; }
function ctx(re, tag) {
  re.lastIndex = 0; let m, out = [];
  while ((m = re.exec(html)) !== null) {
    const s = Math.max(0, m.index - 70), e = Math.min(html.length, m.index + m[0].length + 70);
    out.push(html.slice(s, e).replace(/\n/g, " "));
    if (out.length >= 3) break;
  }
  console.log("[" + tag + "]");
  out.forEach(o => console.log("   " + o));
  console.log("");
}
console.log("== $robin. 存储读取 ==");
ctx(/\$robin\.(love|trauma|dom|confidence|lust)\b/g, "$robin.xxx");
console.log("== $npc.robin / NPCData ==");
ctx(/\$npc(?:Data)?\.robin\.(love|trauma|dom|confidence|lust)\b/g, "$npc.robin.xxx");
console.log("== robindebtevent 取值 ==");
ctx(/\$robindebtevent\s+to\s+(\d+)/g, "robindebtevent to N");
console.log("== avery_party.stage 取值 ==");
ctx(/\$avery_party\.stage\s*[+\-]?=/g, "avery_party.stage");
ctx(/\$avery_party\.guests\b/g, "avery_party.guests");
console.log("== avery_tower 其他 ==");
ctx(/\$avery_tower\.(progress|complete|height)\b/g, "avery_tower.*");
console.log("== eden 数值 ==");
ctx(/\$eden\.(love|trauma|dom)\b/g, "$eden.xxx");
ctx(/\$npc(?:Data)?\.eden\b/g, "$npc.eden");
console.log("== kylar 状态 ==");
ctx(/\$kylar(?:State|_state)?\b/g, "$kylar*");
ctx(/\$kylar\.(love|trauma|dom)\b/g, "$kylar.xxx");
console.log("== sydney / whitney 数值 ==");
ctx(/\$sydney\.(love|trauma|dom)\b/g, "$sydney.xxx");
ctx(/\$whitney\.(love|trauma|dom)\b/g, "$whitney.xxx");
console.log("== 全局次数：$robin.= / _robin.= 赋值 ==");
console.log("  $robin. 出现:", count("$robin."), "| _robin. 出现:", count("_robin."), "| $NPCData 出现:", count("$NPCData"), "| $npc. 出现:", count("$npc."));
