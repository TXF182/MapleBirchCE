/* 特殊古董单列 + 收集判据 + 框架闸门 + 调度守卫（v2.1.2）
 *
 * 取证依据（DoL 0.5.12.13 单行 HTML，行号实测）：
 * - L609341–L609404  `$museumAntiques.antiques` 全集 **63 件**（<<widget "updateMuseumAntiques">>）；
 *   58 件白名单的说法来自 CE 1.20.4 的 `Widgets cheat_extended.twee` L641-716，其"排除"实际只漏两件。
 * - L188980 起（每次 passage 都跑）：`<<if $necklaceThief is undefined>>` 三分支——
 *   `antiqueivorynecklace isnot "notFound"` → `$necklaceThief = "player"`。
 *   所以把项链写成 found 会**顺带**把 Wraith 项链回收线判定成「玩家已发现」，必须显式落地这个副作用。
 * - L190320：`antiquegoldchastitybelt` 只在博物馆价格表出现，无剧情副作用。
 * - 全 HTML 无 `antique*curse*` 键（"cursed" 是服装属性字段），CE changeLog 的第三件「詛咒硬幣」无对应键。
 *
 * 判据口径：一键收齐 = 只写 `notFound` 的普通件（不覆盖 talk / museum / stolen 等中间态与已上交态），
 * 特殊件由单件键各自处理；单件键的留痕 id 是 `antique-<key>`，可与一键收齐的 `antique` 并存回退。
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
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
const V = { player: {}, passage: "Room", mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
window.maplebirch = { get: function () { return null; }, npc: {} };

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

function resetV() {
  V.museumAntiques = {
    antiques: {
      antiquebox: "notFound",
      antiquesilverring: "notFound",
      antiquegoldchastitybelt: "notFound",
      antiqueivorynecklace: "notFound",
      antiquecrystal: "talk",
      antiquehorn: "museum",
      antiqueshell: "stolen"
    },
    paintings: { paintingward: "notFound", paintingsnake: "found" },
    museumCount: 1,
    stolenCount: 1,
    recoveredCount: 0,
    maxCount: 7
  };
  V.feats = { currentSave: {} };
  V.mbCE_wrote = {};
  delete V.necklaceThief;
  delete V.museumAntiqueJournalHints;
}

async function main() {
  section("0 导出齐备");
  assert(!!api, "setup.mbStageCE 已挂载");
  assert(!!api.MCE_VANILLA_SPECIAL_ANTIQUES, "MCE_VANILLA_SPECIAL_ANTIQUES 已导出");
  assert(typeof api.mbCEVanillaAntiqueCollectOne === "function", "mbCEVanillaAntiqueCollectOne 已导出");
  assert(typeof api.mbCEVanillaAntiqueSpecials === "function", "mbCEVanillaAntiqueSpecials 已导出");
  assert(typeof api.mbCEFrameworkGate === "function", "mbCEFrameworkGate 已导出");
  assert(typeof api.mbCECompareVersion === "function", "mbCECompareVersion 已导出");
  assert(typeof api.mceSchedule === "function", "mceSchedule 已导出");

  section("1 特殊古董清单只有两件真实键");
  const spKeys = Object.keys(api.MCE_VANILLA_SPECIAL_ANTIQUES);
  assert(spKeys.length === 2, "清单内是 2 件真实键（黄金贞操带 / 象牙项链），不塞假键：" + spKeys.join(","));
  assert(api.MCE_VANILLA_SPECIAL_ANTIQUES.antiquegoldchastitybelt === "黄金贞操带", "黄金贞操带键名正确");
  assert(api.MCE_VANILLA_SPECIAL_ANTIQUES.antiqueivorynecklace === "象牙项链", "象牙项链键名正确");
  assert(spKeys.indexOf("antiquecursecoin") < 0 && spKeys.indexOf("antiquecurse") < 0, "不虚构诅咒硬币键");

  section("2 一键收齐：跳过特殊件、只写 notFound");
  resetV();
  const r1 = api.mbCEVanillaAntiqueCollect();
  const a1 = V.museumAntiques.antiques;
  assert(r1.ok, "一键收齐成功");
  assert(a1.antiquegoldchastitybelt === "notFound", "黄金贞操带保持 notFound（不进一键收齐）");
  assert(a1.antiqueivorynecklace === "notFound", "象牙项链保持 notFound（不进一键收齐）");
  assert(a1.antiquebox === "found", "普通件 notFound → found");
  assert(a1.antiquesilverring === "found", "第二件普通件也写 found");
  assert(a1.antiquecrystal === "talk", "中间态 talk 不被降级为 found");
  assert(a1.antiquehorn === "museum", "已上交 museum 不被覆盖");
  assert(a1.antiqueshell === "stolen", "stolen 态不被覆盖");
  assert(Array.isArray(r1.skipped) && r1.skipped.length === 2, "返回值带 skipped 清单（2 件）");
  assert(V.museumAntiques.paintings.paintingward === "found", "画作 notFound → found");
  assert(V.museumAntiques.paintings.paintingsnake === "found", "已是 found 的画作保持");
  assert(V.necklaceThief === undefined, "一键收齐不触碰 $necklaceThief");

  section("3 单件收集：只改一件、不误伤");
  resetV();
  const r2 = api.mbCEVanillaAntiqueCollectOne("antiquegoldchastitybelt");
  assert(r2.ok && r2.changed === true, "黄金贞操带单件收集 changed=true");
  assert(V.museumAntiques.antiques.antiquegoldchastitybelt === "found", "目标件写 found");
  assert(V.museumAntiques.antiques.antiquebox === "notFound", "其他件保持 notFound");
  assert(V.museumAntiques.antiques.antiqueivorynecklace === "notFound", "另一件特殊件不受影响");
  assert(V.necklaceThief === undefined, "黄金贞操带不写 $necklaceThief");

  section("4 象牙项链单件：副作用显式落地");
  resetV();
  const r3 = api.mbCEVanillaAntiqueCollectOne("antiqueivorynecklace");
  assert(r3.ok && r3.changed === true, "象牙项链单件收集成功");
  assert(V.museumAntiques.antiques.antiqueivorynecklace === "found", "项链写 found");
  assert(V.necklaceThief === "player", "同步写 $necklaceThief=player（原版 L188980 分支的等价落地）");
  assert(r3.message.indexOf("necklaceThief") >= 0, "消息里说明该项副作用");

  section("5 已有 necklaceThief 时绝不覆盖");
  resetV();
  V.necklaceThief = "diver";
  api.mbCEVanillaAntiqueCollectOne("antiqueivorynecklace");
  assert(V.necklaceThief === "diver", "已是 diver 的进度不被覆盖");

  section("6 非 notFound 时单件键不改写");
  resetV();
  V.museumAntiques.antiques.antiquegoldchastitybelt = "museum";
  const r4 = api.mbCEVanillaAntiqueCollectOne("antiquegoldchastitybelt");
  assert(r4.ok === true && r4.changed === false, "已是 museum 时 changed=false");
  assert(V.museumAntiques.antiques.antiquegoldchastitybelt === "museum", "已上交态不被拉回 found");

  section("7 单件回退（留痕 id 与一键收齐互不影响）");
  resetV();
  api.mbCEVanillaAntiqueCollectOne("antiqueivorynecklace");
  assert(!!V.mbCE_wrote["vcore:antique-antiqueivorynecklace"], "单件留痕键为 vcore:antique-<key>");
  assert(!V.mbCE_wrote["vcore:antique"], "未覆盖一键收齐的留痕键");
  const u1 = api.mbCEVanillaExtUndo("antique-antiqueivorynecklace");
  assert(u1.ok, "单件回退成功");
  assert(V.museumAntiques.antiques.antiqueivorynecklace === "notFound", "项链回退到 notFound");
  assert(!("necklaceThief" in V), "回退同时撤销本次写入的 $necklaceThief");

  section("8 一键收齐回退仍是全量还原");
  resetV();
  api.mbCEVanillaAntiqueCollect();
  const u2 = api.mbCEVanillaExtUndo("antique");
  assert(u2.ok, "一键收齐回退成功");
  assert(V.museumAntiques.antiques.antiquebox === "notFound", "普通件回退到 notFound");
  assert(V.museumAntiques.antiques.antiquecrystal === "talk", "中间态回退后仍是 talk");
  assert(V.museumAntiques.museumCount === 1, "museumCount 还原");

  section("9 特殊古董状态清单（UI 三键数据源）");
  resetV();
  const sp = api.mbCEVanillaAntiqueSpecials();
  assert(sp.length === 3, "返回 3 条（两件真实键 + 诅咒硬币占位）");
  assert(sp[0].key === "antiquegoldchastitybelt" && sp[0].exists === true, "第 1 条：黄金贞操带，键存在");
  assert(sp[0].label === "黄金贞操带", "第 1 条标签");
  assert(sp[1].key === "antiqueivorynecklace" && sp[1].exists === true, "第 2 条：象牙项链，键存在");
  assert(sp[2].exists === false, "第 3 条：诅咒硬币，原版无此键（exists=false）");
  assert(sp[2].label === "诅咒硬币", "第 3 条标签");

  section("10 框架版本比较（CE framework_detector 同口径）");
  assert(api.mbCECompareVersion("5.6.2", "5.6.2") === 0, "同版本 = 0");
  assert(api.mbCECompareVersion("5.7.0", "5.6.2") === 1, "更高 = 1");
  assert(api.mbCECompareVersion("5.5.9", "5.6.2") === -1, "更低 = -1");
  assert(api.mbCECompareVersion("3.2.5", "5.6.2") === -1, "CE 的 3.2.5 相对我们基线更低");
  assert(api.mbCECompareVersion("5.6.2.1", "5.6.2") === 1, "四段版本可比较");
  assert(api.mbCECompareVersion("", "5.6.2") === -1, "空版本视为最低（不冒充满足）");

  section("11 框架闸门在岗判定");
  const g = api.mbCEFrameworkGate();
  assert(g && typeof g.level === "string", "gate 返回 level");
  assert(g.level === "ok" || g.level === "old", "测试环境框架在岗 → 不报 missing/incompatible，实际：" + g.level);
  assert(Array.isArray(g.missing), "gate 带 missing 清单");
  assert(g.tested === "5.6.2", "基线版本记录为我们实测的 5.6.2");

  section("12 mceSchedule 内层守卫（300ms 窗口内失效不渲染）");
  let ran = 0;
  const guardFalse = function () { return false; };
  api.mceSchedule(function () { ran++; }, 10, null, guardFalse);
  await new Promise(function (res) { setTimeout(res, 60); });
  assert(ran === 0, "guard 返回 false → 回调未执行（不再渲染到已卸载 DOM）");

  let ran2 = 0;
  api.mceSchedule(function () { ran2++; }, 10, null, function () { return true; });
  await new Promise(function (res) { setTimeout(res, 60); });
  assert(ran2 === 1, "guard 返回 true → 正常执行一次");

  let ran3 = 0;
  api.mceSchedule(function () { ran3++; }, 10, null, function () { throw new Error("boom"); });
  await new Promise(function (res) { setTimeout(res, 60); });
  assert(ran3 === 0, "guard 自身抛错按失效处理（fail-closed，不炸调度器）");

  console.log("\n=== 结果 ===");
  console.log(passes + " PASS / " + failures + " FAIL");
  if (failures > 0) { process.exitCode = 1; }
}

main().catch(function (e) { console.error("测试异常：" + (e && e.stack || e)); process.exitCode = 1; });
