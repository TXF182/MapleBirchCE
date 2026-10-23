/* 复现：框架注册 MOD 角色（Alice/Liddell/Seath/Luna 等）在角色页的分类归属 */
const fs = require("fs"), path = require("path");
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window; global.document = window.document;
global.Node = window.Node; global.Element = window.Element; global.HTMLElement = window.HTMLElement; global.HTMLSelectElement = window.HTMLSelectElement;
const V = { player: {}, scenePassages: [], mbCE_wrote: {} };
global.V = V; global.State = { variables: V };
global.localStorage = window.localStorage; global.sessionStorage = window.sessionStorage;
global.passage = function () { return "Room"; };
/* 模拟框架：原版 32 NPC + MOD 角色（Alice/Liddell 恋爱、Seath 恋爱、Luna 恋爱、TestNPC 普通） */
const vanilla = ["Avery","Bailey","Briar","Charlie","Darryl","Doren","Eden","Gwylan","Harper","Jordan","Kylar","Landry","Leighton","Mason","Morgan","River","Robin","Sam","Sirris","Whitney","Winter","Black Wolf","Niki","Quinn","Remy","Alex","Great Hawk","Wren","Sydney","Ivory Wraith","Zephyr","Night Monster"];
/* 真实游戏：MOD 会把新角色名扩展进 setup.NPCNameList（原版角色池扩展机制）——旧版 isVanillaNPC 因此误判 MOD 角色为原版 */
global.setup = { NPCNameList: vanilla.concat(["Alice", "Liddell", "Seath", "Luna", "TestNPC"]), loveInterestNpc: ["Robin","Whitney","Kylar","Sydney","Eden","Avery","Black Wolf","Great Hawk","Alex","Gwylan"] };
const modData = new Map();
vanilla.forEach(n => modData.set(n, { Config: { loveInterest: ["Robin","Whitney","Kylar","Sydney","Eden","Avery","Black Wolf","Great Hawk","Alex","Gwylan"].indexOf(n) !== -1 } }));
modData.set("Alice", { Config: { loveInterest: true } });
modData.set("Liddell", { Config: { loveInterest: true } });
modData.set("Seath", { Config: { loveInterest: true } });
modData.set("Luna", { Config: { loveInterest: true } });
modData.set("TestNPC", { Config: { loveInterest: false } });
window.maplebirch = { get: function () { return null; }, npc: { data: modData, NPCNameList: vanilla, romanceConditions: {}, type: { loveInterestNpcs: ["Alice", "Liddell", "Seath", "Luna"], importantNPCs: [], specialNPCs: [] } } };
window.modUtils = { getMod: function () { return null; } };
const js = fs.readFileSync(path.join(__dirname, "..", "javascript", "maplebirchce.js"), "utf8");
eval(js);
const api = setup.mbStageCE;
/* 直接调角色页渲染 */
api.renderCharCards ? api.renderCharCards() : (function(){ try { document.querySelector('[data-tab="char"]') && document.querySelector('.mce-tabs button[data-tab="char"]').click(); } catch(e) {} })();
const pane = document.querySelector('[data-pane="char"]');
const txt = pane.textContent;
["模组角色", "恋爱角色", "普通角色", "持久NPC"].forEach(function (g) {
  const i = txt.indexOf(g + "（");
  console.log(g + " 分组: " + (i !== -1 ? txt.slice(i, i + 60) : "未找到"));
});
/* 展开模组角色组，验证内部细分恋爱/普通（点击后用新快照） */
const modHead = [].slice.call(pane.querySelectorAll(".mce-grp-t")).find(function (h) { return h.textContent.indexOf("模组角色") !== -1; });
if (modHead) { modHead.click(); }
const txt2 = pane.textContent;
console.log("模组分区内细分: 含「模组·恋爱角色」=" + (txt2.indexOf("模组·恋爱角色") !== -1) + " 含「模组·普通角色」=" + (txt2.indexOf("模组·普通角色") !== -1));
/* 模组区展开后：输出各子组标题与卡片数 */
const modBody = [].slice.call(pane.querySelectorAll(".mce-grp")).find(function (c) { return c.querySelector(".mce-grp-t") && c.querySelector(".mce-grp-t").textContent.indexOf("模组角色") !== -1; });
[].slice.call(modBody.querySelectorAll(".mce-stage-head")).forEach(function (h) {
  const cards = h.nextElementSibling ? h.nextElementSibling.querySelectorAll(".mce-card").length : 0;
  console.log("子组: " + h.textContent + " 卡片数=" + cards);
});
const loveBody = modBody.querySelector(".mce-cards");
console.log("恋爱子组含 爱丽丝=" + (loveBody ? loveBody.textContent.indexOf("爱丽丝") !== -1 : "无") + " 利德尔=" + (loveBody ? loveBody.textContent.indexOf("利德尔") !== -1 : "无") + " Seath=" + (loveBody ? loveBody.textContent.indexOf("Seath") !== -1 : "无") + " Luna=" + (loveBody ? loveBody.textContent.indexOf("Luna") !== -1 : "无"));
