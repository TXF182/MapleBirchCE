/* 自查 1：验证 VANILLA_SCENE_KEYS 与本体 $scenes 注册表真实一致
   用法：node tools/_selfcheck_scene_keys.js
   从游戏本体提取 scenes widget 文本 → 用与运行时相同的 parseSceneBlocks 逻辑解析 →
   与 src/07e-scenes.js 内嵌索引对比，输出差集/误抓/角色映射覆盖检查。 */
const fs = require("fs");
const ROOT = "C:/Users/27352/Doubao/chats/2026-10-13/new-chat-2/MapleBirchCE";
const GAME = "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";

// 与运行时 parseSceneBlocks 相同的解析逻辑（从 07e-scenes.js 复制关键逻辑）
function unescapeTweeEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function parseSceneBlocks(text) {
  const defs = {};
  const reKey = /"([^"]+)"\s*:\s*\{/g;
  let km;
  while ((km = reKey.exec(text)) !== null) {
    const kstart = km.index + km[0].length - 1;
    let kd = 0, ki = kstart, kend = -1, ks = false;
    for (; ki < text.length; ki++) {
      const cc = text.charAt(ki);
      if (ks) { if (cc === "\\") { ki++; } else if (cc === '"') { ks = false; } }
      else if (cc === '"') { ks = true; }
      else if (cc === "{") { kd++; }
      else if (cc === "}") { kd--; if (kd === 0) { kend = ki; break; } }
    }
    if (kend < 0) { continue; }
    const block = text.slice(kstart + 1, kend);
    if (block.indexOf("startPassage") !== -1 || block.indexOf("unlocked") !== -1 || block.indexOf("name:") !== -1) {
      defs[km[1]] = true; // 只收有场景特征的对象块
    }
  }
  return defs;
}
function findScenesWidgetText(ps) {
  for (const p of ps) {
    const t = unescapeTweeEntities(p.text);
    if (t.indexOf('<<widget "scenes">>') !== -1) return t;
  }
  return "";
}

const html = fs.readFileSync(GAME, "utf8");
// 从 HTML 提取全部 tw-passagedata 段落
const pas = [];
const rePD = /<tw-passagedata[^>]*name="([^"]*)"[^>]*>(.*?)<\/tw-passagedata>/gs;
let m;
while ((m = rePD.exec(html)) !== null) { pas.push({ name: m[1], text: m[2] }); }
console.log("段落总数:", pas.length);

const widget = findScenesWidgetText(pas);
if (!widget) { console.error("FAIL: 未找到 scenes widget"); process.exit(1); }
const parsed = parseSceneBlocks(widget);
const parsedKeys = Object.keys(parsed);
console.log("本体解析出的场景键数:", parsedKeys.length);

// 读 src 内嵌索引
const src = fs.readFileSync(ROOT + "/javascript/src/07e-scenes.js", "utf8");
const idx = src.indexOf("var VANILLA_SCENE_KEYS = [");
const idxEnd = src.indexOf("];", idx);
const arrText = src.slice(idx + "var VANILLA_SCENE_KEYS = [".length, idxEnd);
const keys = eval("([" + arrText + "])");
console.log("内嵌索引键数:", keys.length);

const setParsed = new Set(parsedKeys);
const setKeys = new Set(keys);
const missing = parsedKeys.filter(k => !setKeys.has(k));          // 本体有、索引缺
const extra = keys.filter(k => !setParsed.has(k));                 // 索引有、本体无
console.log("\n== 本体有但索引缺（MISSING）==");
console.log(missing.length ? missing.join(", ") : "无");
console.log("\n== 索引有但本体无（EXTRA，疑误抓）==");
console.log(extra.length ? extra.join(", ") : "无");

// 角色映射覆盖检查（运行时同款逻辑）
const roleRules = [
  [/^NightmareAlex/, "亚历克斯 Alex"], [/^NightmareEden/, "伊甸 Eden"], [/^NightmareHarper/, "哈珀 Harper"],
  [/^NightmareOffice/, "艾弗里 Avery"], [/^Robin|^RentFirstRobin/, "罗宾 Robin"], [/^Whitney/, "惠特尼 Whitney"],
  [/^Kylar|^HalloweenKylar/, "凯拉尔 Kylar"], [/^Eden|^FreeTheBlackDog/, "伊甸 Eden"], [/^BlackWolf/, "黑狼 Black Wolf"],
  [/^Alex|^TheFarm$|^MoorFlower/, "亚历克斯 Alex"], [/^Avery/, "艾弗里 Avery"], [/^Harper/, "哈珀 Harper"],
  [/^Temple/, "神殿 Temple"], [/^Prison/, "监狱 Prison"], [/^SchoolInspection/, "学校 School"],
  [/^AdultShop/, "成人店 Adult Shop"], [/^Chef/, "厨师 Chef"], [/^Mickey/, "米奇 Mickey"], [/^Nightmare/, "噩梦梦境 Nightmare"]
];
function sceneRoleOf(k) {
  for (const r of roleRules) { if (r[0].test(k)) return r[1]; }
  return "其他 Other";
}
const roles = {};
keys.forEach(k => { const r = sceneRoleOf(k); (roles[r] = roles[r] || []).push(k); });
console.log("\n== 角色分组分布（共 " + keys.length + " 键）==");
Object.keys(roles).sort().forEach(r => console.log("  " + r + "（" + roles[r].length + "）: " + roles[r].join(", ")));
