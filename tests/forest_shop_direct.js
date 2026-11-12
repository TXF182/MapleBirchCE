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

/* ================= 汇总 ================= */
console.log("\n===== forest_shop_direct: " + passes + " PASS / " + failures + " FAIL =====");
process.exit(failures ? 1 : 0);
