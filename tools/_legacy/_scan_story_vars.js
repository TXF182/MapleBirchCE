/* 任务三扫描：从本体核实非 $scenes 注册表的关键剧情状态变量（按角色）
   只输出候选变量名在本体中的出现次数与代表上下文，供补作弊项时用真实键名 */
const fs = require("fs");
const GAME = "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
const html = fs.readFileSync(GAME, "utf8");
const patterns = [
  ["avery_tower.progress", /avery_tower\.progress/g], ["avery_mansion", /avery_mansion/g],
  ["avery_events", /avery_events/g], ["avery_party", /avery_party/g],
  ["robin.confidence", /robin\.confidence/g], ["robin.trauma", /robin\.trauma/g],
  ["robin.dom", /robin\.dom/g], ["robin.love", /robin\.love/g],
  ["bailey", /\bbailey\b/gi], ["orphanage", /\borphanage\b/gi],
  ["eden.trauma", /eden\.trauma/g], ["eden.confidence", /eden\.confidence/g],
  ["kylar_trauma", /\bkylar_trauma\b/gi], ["kylar_love", /\bkylar_love\b/gi],
  ["sydney_trauma", /\bsydney_trauma\b/gi], ["whitney_trauma", /\bwhitney_trauma\b/gi],
  ["wolf_pack", /\bwolf_pack\b/gi], ["great_hawk", /\bgreat_hawk\b/gi],
  ["landfill", /\blandfill\b/gi], ["teaser", /\bteaser\b/gi],
  ["confident", /\bconfident\b/gi], ["submissive", /\bsubmissive\b/gi]
];
const seen = {};
for (const [label, re] of patterns) {
  re.lastIndex = 0;
  let n = 0; let sample = "";
  let m;
  while ((m = re.exec(html)) !== null) {
    n++;
    if (sample.length < 200) {
      const s = Math.max(0, m.index - 60), e = Math.min(html.length, m.index + m[0].length + 60);
      sample = html.slice(s, e).replace(/\n/g, " ");
    }
    if (n > 5000) break;
  }
  seen[label] = { n, sample };
}
for (const [label, v] of Object.entries(seen)) {
  console.log(label + ": " + v.n + " 处" + (v.sample ? " | " + v.sample : ""));
}
