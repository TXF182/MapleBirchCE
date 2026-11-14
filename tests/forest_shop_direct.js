/* 森林商店「无剧情场景直达」测试（v2.0.22）
 *
 * 用户诉求原话（QQ 截图）：能不能做个场景直达 / ？不是有吗 / 没有剧情的场景直达 /
 *   我想去森林商店 / 但是都有剧情 / 我不知道为什么找不到商店
 *
 * 取证结论（本体 0.5.12.13 逐字核对，见 07d-places3.js / 07d-places4.js 注释）：
 *   - passage `Forest Shop`（pid=1800，tags=exitCheckBypass，正文仅 77 字符）是纯商店界面，
 *     <<widget "forestShop-main">> 第一行自带 $outside=0 / $location="forest_shop" / $shopName="forest"；
 *   - 旧 gwylan_garden 组把 main 设在 Gwylan Ritual Start Garden（仪式剧情段），Forest Shop 只作为
 *     「更多入口」子场景 → 玩家在面板看到的永远是剧情段；
 *   - Forest Shop 尾部出口只在 $tryOn.value is 0 分支，$tryOn 缺失 → TypeError 且无出口。
 *
 * 走玩家真实路径：listPlaceGroups（面板分组）+ ensureSceneStateFor（直达前兜底），
 * 不经导出层旁路 —— 导出层 09-exports2.js 已顶到结构门禁 400 行上限。
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " =="); }

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;
global.localStorage = window.localStorage;

const V = { player: {}, scenePassages: [], mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room", temporary: {} };
global.setup = {};
global.passage = function () { return "Room"; };
window.maplebirch = { npc: {}, temporary: {} };
function resetV() { Object.keys(V).forEach(function (k) { delete V[k]; }); }

/* 段落清单：只放本测试关心的几段（listPlaceGroups 靠 Story.passages 枚举） */
const P = [
  { name: "Forest Shop", text: "<div id=\"clothingShop-div\" class=\"main-shop-div\">\n\t<<forestShop-main>>\n</div>" },
  { name: "Forest Shop Entrance", text: "<<set $outside to 0>><<set $location to \"forest_shop\">><<if $forest_shop_intro isnot 1>><<link [[Leave|Forest]]>><</link>><</if>>" },
  { name: "Forest Shop Widgets", text: "<<widget \"forestShopLeave\">><<passage [[Forest Shop Entrance]]>><</widget>>" },
  { name: "Forest Shop Caught", text: "<<set $outside to 0>><<link [[Run|Forest]]>><</link>>" },
  { name: "Gwylan Ritual Start Garden", text: "<<set $outside to 1>><<link [[Begin|Gwylan Ritual Garden]]>><</link>>" },
  { name: "Gwylan Cottage", text: "<<link [[Talk|Gwylan Talk]]>><</link>>" },
  { name: "Pregnancy Birth Forest Shop", text: "<<link [[Go on|Pregnancy Birth Forest Shop 2]]>><</link>>" }
];
const fixturePath = path.join(__dirname, "fixtures", "scenes-widget.twee");
let fixtureText = "";
try { fixtureText = fs.readFileSync(fixturePath, "utf8"); } catch (e) { fixtureText = ""; }
if (fixtureText) { P.push({ name: "Scene Viewer Widgets", text: fixtureText }); }

const byName = {};
P.forEach(function (p) { byName[p.name] = p; });
global.Story = {
  size: P.length,
  passages: P,
  has: function (n) { return Object.prototype.hasOwnProperty.call(byName, n); },
  get: function (n) { return byName[n] || null; }
};

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

/* ================= 1. 组结构 ================= */
section("1 分组顺序（森林商店独立成组、排在格威岚组之前）");
const lg = api.listPlaceGroups();
const ids = lg.map(function (x) { return x.group.id; });
const idxForest = ids.indexOf("forest_shop");
const idxGwylan = ids.indexOf("gwylan_garden");
assert(idxForest >= 0, "存在 id=forest_shop 的组");
assert(idxGwylan >= 0, "gwylan_garden 组仍在");
assert(idxForest < idxGwylan, "forest_shop(" + idxForest + ") 排在 gwylan_garden(" + idxGwylan + ") 之前（seen 先占先得）");
const gF = idxForest >= 0 ? lg[idxForest].group : {};
assert(gF.main === "Forest Shop", "forest_shop 的 main = Forest Shop（纯商店段，不是仪式剧情段）");
assert(gF.kind === "place", "forest_shop 标记 kind=place（UI 显示〔纯地点〕）");
assert(typeof gF.exclude === "function", "组带 exclude 判据（滤掉 widget 定义段）");

/* ================= 2. 分组结果 ================= */
section("2 listPlaceGroups：主场景/子入口/互斥占位");
const eF = lg.filter(function (x) { return x.group.id === "forest_shop"; })[0] || { items: [] };
const eG = lg.filter(function (x) { return x.group.id === "gwylan_garden"; })[0] || { items: [] };
assert(eF.items[0] === "Forest Shop", "forest_shop 首位是主场景 Forest Shop（实测首位：" + (eF.items[0] || "-") + "）");
assert(eF.items.indexOf("Forest Shop Entrance") !== -1, "正门 Forest Shop Entrance 作为子入口保留（含格威岚登场剧情，玩家自选）");
assert(eF.items.indexOf("Forest Shop Widgets") === -1, "widget 定义段被 exclude 滤掉（不可直达）");
assert(eF.items.indexOf("Forest Shop Caught") !== -1, "前缀段 Forest Shop Caught 归入本组");
assert(eG.items.indexOf("Forest Shop") === -1, "gwylan_garden 不再占用 Forest Shop（避免两组重复/主场景错位）");
assert(eG.items.indexOf("Gwylan Ritual Start Garden") !== -1, "gwylan_garden 仍保留仪式剧情主场景");
assert(eG.items.indexOf("Pregnancy Birth Forest Shop") !== -1, "Pregnancy Birth Forest Shop 仍归 gwylan_garden（非 Forest Shop 前缀）");

/* ================= 3. $tryOn 补壳（走 ensureSceneStateFor 真实入口） ================= */
section("3 ensureSceneStateFor 对 Forest Shop 补 $tryOn 壳（缺失才补、不覆盖进度）");

resetV();
V.worn = {};
api.ensureSceneStateFor("Forest Shop");
assert(typeof V.tryOn === "object" && V.tryOn !== null, "缺失时建立 $tryOn 壳");
assert(V.tryOn && V.tryOn.autoReset === true, "autoReset=true（让 <<forestShop-main>> 自己调 <<tryOnReset>> 建全量结构）");
assert(V.tryOn && V.tryOn.value === 0, "value=0（命中尾部 <<elseif $tryOn.value is 0>> 出口分支，不会无出口）");
assert(V.tryOn && V.tryOn.showEquip && V.tryOn.showEquip.over_head === null && V.tryOn.showEquip.over_upper === null && V.tryOn.showEquip.over_lower === null, "showEquip 三键齐（<<tryOnStats>> 直接读）");
assert(V.tryOn && V.tryOn.showUnderEquip && V.tryOn.showUnderEquip.upper === null && V.tryOn.showUnderEquip.lower === null, "showUnderEquip 两键齐");
assert(V.location === "forest_shop", "$location 缺失时补 forest_shop");
assert(V.outside === 0, "$outside 缺失时补 0（室外=否）");

resetV();
V.location = "forest";
V.tryOn = { autoReset: false, value: 3 };
api.ensureSceneStateFor("Forest Shop");
assert(V.tryOn.value === 3 && V.tryOn.autoReset === false, "已有试衣进度不被覆盖");
assert(V.location === "forest", "已有 $location 不被覆盖");

resetV();
api.ensureSceneStateFor("Town");
assert(V.tryOn === undefined, "非 Forest Shop 段落不写入 $tryOn");
assert(V.location === undefined, "非 Forest Shop 段落不写入 $location");

resetV();
V.location = "forest";
V.tryOn = { autoReset: false, value: 2 };
api.ensureSceneStateFor("Forest Shop Entrance");
assert(V.tryOn.value === 2, "正门前缀命中分支但不覆盖既有试衣态（对正门无副作用）");

/* ================= 4. 注册表空名条目过滤 ================= */
section("4 getScenesDefs：placeHolder 注释样本不进剧情列表");
if (fixtureText) {
  const defs = api.getScenesDefs().defs || {};
  assert(Object.prototype.hasOwnProperty.call(defs, "placeHolder") === false, "placeHolder（name 为空的注释样本）已被丢弃");
  /* 111 = 本体真实场景 110（注册表 111 键减 placeHolder）+ EXTRA_SCENES 1 条
     （KylarStalkingReversal，v2.0.20 B 批手工补的凯拉尔跟踪反转线，不在本体注册表里） */
  assert(Object.keys(defs).length === 111, "本体 110 + EXTRA 1 = 111 条（实测 " + Object.keys(defs).length + "）");
  assert(typeof defs.KylarStalkingReversal === "object" && defs.KylarStalkingReversal.startPassage === "Kylar Stalking Reversal Hide Confront", "EXTRA_SCENES 凯拉尔跟踪反转线仍在（startPassage 未被本次过滤误伤）");
  assert(typeof defs.Tutorial === "object" && defs.Tutorial.startPassage === "SV Tutorial", "对照：Tutorial 正常保留（startPassage=SV Tutorial）");
} else {
  console.log("SKIP: fixtures/scenes-widget.twee 缺失，跳过注册表过滤断言");
}

/* ================= 5. 正门并列主入口（v2.0.22 parallel 机制） ================= */
section("5 正门并列主入口：森林商店正门与纯商店并列成行，不再只收在折叠里");
const mle = api.mbCEListPlaceEntries;
assert(typeof mle === "function", "mbCEListPlaceEntries 已导出（测试可走真实入口）");
const entF = lg.filter(function (x) { return x.group.id === "forest_shop"; })[0] || null;
const subsF = (typeof mle === "function" && entF) ? mle(entF) : [];
const parEnt = subsF.filter(function (s) { return s.name === "Forest Shop Entrance"; })[0] || null;
assert(!!parEnt, "子入口清单含 Forest Shop Entrance（实测 " + subsF.map(function (s) { return s.name; }).join(",") + "）");
assert(!!parEnt && parEnt.parallel === true, "Forest Shop Entrance 标 parallel=true（渲染为与纯商店并列的主入口行）");
assert(!!parEnt && String(parEnt.cn || "").indexOf("会有剧情") !== -1, "正门行中文提示点明「会有剧情」");
const nonPar = subsF.filter(function (s) { return !s.parallel; });
assert(nonPar.map(function (s) { return s.name; }).indexOf("Forest Shop Entrance") === -1, "折叠区不再重复正门（剩余 " + nonPar.length + " 项：" + nonPar.map(function (s) { return s.name; }).join(",") + "）");

/* 追加段落：P 与 Story 索引必须同步，否则 mbCEPassageText 取不到正文（exclude 判据会全部判「可玩」） */
function addPassages(list) {
  list.forEach(function (p) { P.push(p); byName[p.name] = p; });
  global.Story.size = P.length;
}

/* ================= 6. 惠特尼家成组（v2.1.3） ================= */
section("6 惠特尼家：Whitney Home 前缀成组、主场景 Knock、不可直达段被剔除");
addPassages([
  { name: "Whitney Home Knock", text: "<<set $outside to 0>><<set $location to \"flats\">><<effects>>\n<<if Time.dayState is \"night\">><<link [[Leave|Barb Street]]>><<pass 2>><</link>><<<else>>><<link [[Enter|Whitney Home Enter]]>><</link>><<endif>>" },
  { name: "Whitney Home Dawn Enter", text: "<<effects>><<if !$daily.whitney.breakfast_done>><<loadNPC 1 \"whitney_parent_flat\">><<person2>><<else>><<endif>><<link [[Next|Whitney Home Dawn Breakfast]]>><</link>>" },
  { name: "Whitney Home Hang", text: "<<set $outside to 0>><<set $location to \"flats\">><<effects>><<whitney_home_events>>" },
  { name: "Whitney Home Gang Sex", text: "<<if $sexstart is 1>><<set $sexstart to 0>><</if>><<link [[Next|Whitney Home Hang]]>><</link>>" },
  { name: "Whitney Home Widgets", text: "<<widget \"whitney_home_events\">><<link [[Leave|Barb Street]]>><</link>><</widget>>" }
]);
const lg2 = api.listPlaceGroups();
const ids2 = lg2.map(function (x) { return x.group.id; });
const idxWh = ids2.indexOf("whitney_home");
assert(idxWh >= 0, "存在 id=whitney_home 的组（Whitney Home 前缀此前完全缺失）");
const gW = idxWh >= 0 ? lg2[idxWh].group : {};
assert(gW.main === "Whitney Home Knock", "main = Whitney Home Knock（段内自带 outside/location 与各时段出口）");
assert(typeof gW.exclude === "function", "组带 exclude 判据（战斗/性爱中继段不入组）");
const eW = lg2.filter(function (x) { return x.group.id === "whitney_home"; })[0] || { items: [] };
assert(eW.items[0] === "Whitney Home Knock", "首位是主场景（实测首位：" + (eW.items[0] || "-") + "）");
assert(eW.items.indexOf("Whitney Home Dawn Enter") !== -1, "清晨进家段归入本组");
assert(eW.items.indexOf("Whitney Home Hang") !== -1, "沙发闲聊段归入本组");
assert(eW.items.indexOf("Whitney Home Gang Sex") === -1, "首宏 $sexstart 的中继段被剔除");
assert(eW.items.indexOf("Whitney Home Widgets") === -1, "widget 定义段被剔除");

/* ================= 7. 艾弗里庄园挂筛子（v2.1.3） ================= */
section("7 艾弗里庄园：avery_mansion 挂 exclude，战斗/性爱中继段不再进列表");
addPassages([
  { name: "Mansion Bed", text: "<<set $location to \"mansion\">><<link [[Sleep|Mansion Sleep]]>><</link>>" },
  { name: "Mansion Pool", text: "<<link [[Swim|Mansion Pool Swim]]>><</link>>" },
  { name: "Mansion Dungeon Fight", text: "<<if $fightstart is 1>><<set $fightstart to 0>><</if>><<link [[Next|Mansion Dungeon]]>><</link>>" },
  { name: "Mansion Return Flowers Sex", text: "<<if $sexstart is 1>><<set $sexstart to 0>><</if>><<link [[Next|Mansion Return]]>><</link>>" }
]);
const lg3 = api.listPlaceGroups();
const idxAv = lg3.map(function (x) { return x.group.id; }).indexOf("avery_mansion");
assert(idxAv >= 0, "avery_mansion 组仍在");
const gA = idxAv >= 0 ? lg3[idxAv].group : {};
assert(typeof gA.exclude === "function", "avery_mansion 已挂 exclude 判据（此前缺，46 段战斗/中继会被当直达项）");
const eA = lg3.filter(function (x) { return x.group.id === "avery_mansion"; })[0] || { items: [] };
assert(eA.items[0] === "Mansion Bed", "首位仍是主场景 Mansion Bed");
assert(eA.items.indexOf("Mansion Pool") !== -1, "泳池段保留");
assert(eA.items.indexOf("Mansion Dungeon Fight") === -1, "首宏 $fightstart 的地牢战斗段被剔除");
assert(eA.items.indexOf("Mansion Return Flowers Sex") === -1, "首宏 $sexstart 的归家性爱中继段被剔除");

/* ================= 8. 子入口白名单（v2.1.4） ================= */
/* 背景：v2.1.3 的 whitney_home 组 note 写「留 258 段」，但 mbCEListPlaceEntries 对本组返回空清单
   （PLACE_EXTRA_ENTRIES 无 whitney_home 键 → L266 直接 return out），面板实际只渲染 Knock 一行。
   本节把「面板上真能点到几条」变成断言，防止数字与可达性再次脱钩。 */
section("8 子入口白名单：惠特尼家补 12 条严格自足入口 / 艾弗里两条会报错的入口已替换");
const WH_12 = [
  "Whitney Home Dawn Breakfast Start", "Whitney Home Dawn Breakfast End",
  "Whitney Home Dawn Breakfast Offer", "Whitney Home Dawn Shower Shy",
  "Whitney Home Intro 2 Blindfolded", "Whitney Home Intro 2 Closer",
  "Whitney Home Intro 3 Bedroom", "Whitney Home Intro 3 Drink",
  "Whitney Home Examine Door", "Whitney Home Examine Curtains",
  "Whitney Home School Walk", "Whitney Home Leave"
];
addPassages(WH_12.map(function (n) {
  /* 每条 mock 都按真实形态给：先 slot0 落地（或无人称宏），再有显式出口 */
  return { name: n, text: "<<effects>><<npc \"Whitney\">><<person1>><<He>> says.<br><<link [[Next|Whitney Home Hang]]>><</link>>" };
}));
assert(typeof api.mbCEListPlaceEntries === "function", "API 导出 mbCEListPlaceEntries（子入口清单是面板可达性的唯一来源，必须可断言）");
const eW2 = api.listPlaceGroups().filter(function (x) { return x.group.id === "whitney_home"; })[0] || { items: [], group: {} };
const subsW = api.mbCEListPlaceEntries(eW2);
assert(subsW.length === 12, "惠特尼家渲染 12 条子入口（实测 " + subsW.length + "：" + subsW.map(function (s) { return s.name; }).join(",") + "）");
assert(subsW.length > 0, "不再是空清单（v2.1.3 面板只有 Knock 一行是缺陷，不是设计）");
subsW.forEach(function (s) {
  assert(eW2.items.indexOf(s.name) !== -1, "白名单条目在组 items 内：" + s.name);
});
assert(subsW.map(function (s) { return s.name; }).indexOf("Whitney Home Knock") === -1, "主场景 Knock 不进子入口（L271 同一段去重）");
assert(subsW.map(function (s) { return s.name; }).indexOf("Whitney Home Hang") === -1, "纯 hub 段 Hang（86 字符，正文只有 <<whitney_home_events>>）不进白名单");
assert(subsW.map(function (s) { return s.name; }).indexOf("Whitney Home Gang Sex") === -1, "被 exclude 的性爱中继段即使误写进白名单也不会渲染（L273 二次过滤）");
/* 反向：白名单顺序与断言清单逐条一致（多写/少写/乱序都会失败；内部变量不导出，只能经 API 反查） */
assert(subsW.map(function (s) { return s.name; }).join("|") === WH_12.join("|"), "白名单 12 条与断言清单同序同集合（实测：" + subsW.map(function (s) { return s.name; }).join(",") + "）");
assert(subsW.every(function (s) { return s.cn && s.cn.length > 0; }), "每条子入口都有中文短名（面板显示用）");

/* 艾弗里：两条既有 RISK 入口（Mansion Dungeon Intro / Mansion Skyscraper Rise）段内无 slot0 落地，
   直跳会触发 <<personselect>> 的 <<error "Undefined NPC in personselect 0">>。 */
addPassages([
  { name: "Mansion Dungeon", text: "<<set $location to \"avery_mansion\">><<avery_mansion>>\n<<link [[Next|Mansion Study]]>><</link>>" },
  { name: "Mansion Enter", text: "<<set $outside to 0>><<effects>><<link [[Next|Mansion Garden]]>><</link>>" },
  { name: "Mansion Bathroom", text: "<<set $bus to \"avery_bathroom\">><<avery_mansion>>\n<<avery_mansion_contents>>" },
  { name: "Mansion Bedroom", text: "<<set $bus to \"avery_bedroom\">><<avery_mansion>>\n<<avery_mansion_contents>>" },
  { name: "Mansion Display", text: "<<set $bus to \"avery_display\">><<avery_mansion>>\n<<avery_mansion_contents>>" },
  { name: "Mansion Folder", text: "<<effects>><<wearProp \"paper sheet\">><<link [[Next|Mansion Study]]>><</link>>" },
  { name: "Mansion Bathe", text: "<<effects>><<strip>><<wash>><<link [[Leave|Mansion Bathroom]]>><</link>>" },
  { name: "Mansion Talk", text: "<<effects>><<npc \"Avery\">><<person1>><<link [[Next|Mansion Sleep]]>><</link>>" },
  { name: "Mansion Dungeon Intro", text: "<<effects>><<He>> makes you wait." },
  { name: "Mansion Skyscraper Rise", text: "<<bedclotheson \"Mansion Bed\">><<He>> examines your outfit." }
]);
const eA2 = api.listPlaceGroups().filter(function (x) { return x.group.id === "avery_mansion"; })[0] || { items: [], group: {} };
const subsA = api.mbCEListPlaceEntries(eA2);
const namesA = subsA.map(function (s) { return s.name; });
assert(namesA.indexOf("Mansion Dungeon Intro") === -1, "Mansion Dungeon Intro 已从白名单移除（段内无人落地，直跳报 Undefined NPC）");
assert(namesA.indexOf("Mansion Skyscraper Rise") === -1, "Mansion Skyscraper Rise 已从白名单移除（<<He>> 在 197 字符处且前无落地）");
assert(namesA.indexOf("Mansion Dungeon") !== -1, "地牢改由 Mansion Dungeon 进入（<<avery_mansion>> widget 落地@1338 < 人称@1351）");
assert(namesA.indexOf("Mansion Enter") !== -1, "庄园入口由 Mansion Enter 提供（18 条显式出口）");
assert(subsA.length === 9, "艾弗里子入口仍为 9 条（替换而非净删，实测 " + subsA.length + "）");

/* ================= 汇总 ================= */
console.log("\n===== forest_shop_direct: " + passes + " PASS / " + failures + " FAIL =====");
process.exit(failures ? 1 : 0);
