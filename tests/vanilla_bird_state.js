/* 原版鹰塔（大鹰塔）清洁度与八种材料直写通道测试（v2.1.15 新增轮）
 *
 * 覆盖对象：07n-vanilla-bird.js
 * 判据口径：每个写入用例同时断言「返回体」与「存档实际值」，并核对 vcore-bird 留痕的 before 与回退还原；
 * 反向用例锁死「无 $bird」「有 $bird 但 materials 未初始化」「非数字输入」「负数」四类拒绝。
 * 原版事实来源（DoL 0.5.12.13 单文件 HTML 行号实证，game\Degrees of Lewdity.html）：
 *   - 新档 L182150 `<<set $bird to {}>>`；materials 九键由 L189817–189839 段建（需 $bird.state 且 !$bird.hunts）
 *   - clean 清理动作后 clamp 0..30，仅 $syndromebird 下 0..110（L452195–452199）
 *   - 日结 L77668 `clamp(clean - (10 - shelter), 0, 100)`；显示 L448061 gte 100 = 最高档
 *   - 材料消耗：wood 2–3（L456368/456378）、sticks 3–5（L456410/456420）、lurkers 1（L451457）
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

let failures = 0, passes = 0;
function assert(cond, msg) {
  if (cond) { passes++; console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}
function section(n) { console.log("\n== " + n + " ==="); }

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;
const V = { player: {}, passage: "Room" };
global.V = V;
global.State = { variables: V, passage: "Room" };
const setupObj = { bodyparts: ["chest", "face", "feet", "leftarm", "rightarm", "neck", "thigh", "tummy"] };
global.setup = setupObj;
global.getSetup = function () { return setupObj; };
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
localStorage.clear();

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(typeof api.vanillaBirdStats === "function" && typeof api.vanillaBirdClean === "function", "鹰塔直写 API 已导出（stats / clean）");
assert(typeof api.vanillaBirdMaterials === "function" && typeof api.renderVanillaBird === "function", "鹰塔直写 API 已导出（materials / render）");

/* ================= 1. 宿主缺失拒绝 ================= */
section("1 宿主缺失拒绝");
let st = api.vanillaBirdStats();
assert(st.has === false && st.hasMaterials === false, "无 $bird → 统计标 has=false");
let r = api.vanillaBirdClean(100);
assert(r.ok === false, "无 $bird → 清洁度写入被拒绝");
r = api.vanillaBirdMaterials(100);
assert(r.ok === false, "无 $bird → 材料写入被拒绝");

V.bird = { state: "home" };
st = api.vanillaBirdStats();
assert(st.has === true && st.hasMaterials === false && st.clean === 0, "只有空壳 $bird → materials 未初始化（贴吧原版言灵踩的就是这一步）");
r = api.vanillaBirdMaterials(100);
assert(r.ok === false, "materials 不存在 → 材料写入被拒绝（不制造 pinned 0 的死键）");
r = api.vanillaBirdClean(100);
assert(r.ok === true && V.bird.clean === 100, "materials 缺失不影响清洁度（clean 由 L189819 同段建，$bird 是对象即可）");

/* ================= 2. 清洁度 ================= */
section("2 清洁度");
V.bird = {
  state: "home",
  clean: 12,
  materials: { wood: 5, fabric: 0, sticks: 40, leaves: 0, junk: 200, lurkers: 0, leather: 0, feathers: 0, valuables: {} },
  upgrades: { firepit: 2, shelter: 1 }
};
st = api.vanillaBirdStats();
assert(st.clean === 12 && st.materials.wood === 5 && st.materials.junk === 200, "读取清洁度 12 与材料（木材 5 / 亮晶晶 200）");
assert(st.firepit === 2 && st.shelter === 1, "读取火坑 2 级与庇护 1 级（日结衰减 = 10 - 庇护）");

V.mbCE_wrote = {};
r = api.vanillaBirdClean(110);
assert(r.ok === true && V.bird.clean === 110, "清洁度写成 110（巨鹰配偶态上限）");
assert(V.mbCE_wrote["vcore:bird-clean"].before.clean === 12, "留痕 before = 12（首次写入前）");
assert(V.mbCE_wrote["vcore:bird-clean"].type === "vcore-bird", "留痕类型标为 vcore-bird（回退中心单独分组）");
r = api.vanillaBirdClean(300);
assert(r.ok === true && V.bird.clean === 110, "超过 110 → 钳到 110（原版 L452199 clamp 上限）");
r = api.vanillaBirdClean("-5");
assert(r.ok === true && V.bird.clean === 0, "负数 → 钳到 0（与 0..110 clamp 同口径，0 是合法值）");
r = api.vanillaBirdClean(110);
assert(V.bird.clean === 110, "复位 110");
r = api.vanillaBirdClean("abc");
assert(r.ok === false && V.bird.clean === 110, "非数字 → 拒绝且不写档");
let u = api.vanillaBirdUndo("bird-clean");
assert(u.ok === true && V.bird.clean === 12, "回退清洁度还原 12");
assert(!V.mbCE_wrote["vcore:bird-clean"], "回退后留痕键被清掉");

/* clean 键本来不存在时：写入后可回退成「未定义」 */
V.bird = { state: "home" };
V.mbCE_wrote = {};
r = api.vanillaBirdClean();
assert(r.ok === true && V.bird.clean === 100, "缺省目标 100（显示层 gte 100 即最高档）");
u = api.vanillaBirdUndo("bird-clean");
assert(u.ok === true && V.bird.clean === undefined, "原档没有 clean 时，回退是删除而不是写 0");

/* ================= 3. 材料补足 ================= */
section("3 材料补足");
V.bird = {
  state: "home",
  clean: 12,
  materials: { wood: 5, fabric: 0, sticks: 40, leaves: 0, junk: 200, lurkers: 0, leather: 0, feathers: 0, valuables: {} }
};
V.mbCE_wrote = {};
r = api.vanillaBirdMaterials();
assert(r.ok === true && r.changed === 7, "八种材料补到 100：7 种不足被补（亮晶晶 200 不动）");
assert(V.bird.materials.wood === 100 && V.bird.materials.sticks === 100, "木材 5→100、树枝 40→100");
assert(V.bird.materials.junk === 200, "已有 200 的亮晶晶不被压低（只升不降）");
assert(V.bird.materials.valuables && typeof V.bird.materials.valuables === "object", "贵重金属子对象 valuables 不受影响");
assert(V.mbCE_wrote["vcore:bird-materials"].before.mat.wood === 5, "材料留痕 before.wood = 5");
r = api.vanillaBirdMaterials();
assert(r.ok === true && r.changed === 0, "再点一次 changed = 0（幂等，不会像裸 +=100 累加成几百）");
r = api.vanillaBirdMaterials("abc");
assert(r.ok === false, "非数字目标 → 拒绝");
r = api.vanillaBirdMaterials(40);
assert(r.ok === true && V.bird.materials.wood === 100, "更低目标不会降值（100 保持 100）");

u = api.vanillaBirdUndo("bird-materials");
assert(u.ok === true && V.bird.materials.wood === 5 && V.bird.materials.sticks === 40, "回退还原首次写入前的 5 / 40");
assert(V.bird.materials.junk === 200 && V.bird.materials.valuables !== undefined, "回退不碰亮晶晶与 valuables");

/* 原档缺键：回退应删除而不是写 undefined */
V.bird = { state: "home", materials: { wood: 3, junk: 7 } };
V.mbCE_wrote = {};
r = api.vanillaBirdMaterials(50);
assert(r.ok === true && V.bird.materials.sticks === 50, "缺键按目标补齐");
u = api.vanillaBirdUndo("bird-materials");
assert(u.ok === true && !("sticks" in V.bird.materials) && V.bird.materials.wood === 3, "缺键回退是删除（不留 undefined 死键）");

/* ================= 4. 面板渲染（玩家实际路径：全局页 ⑫） ================= */
section("4 面板渲染");
V.bird = {
  state: "home",
  clean: 12,
  materials: { wood: 5, fabric: 0, sticks: 40, leaves: 0, junk: 200, lurkers: 0, leather: 0, feathers: 0, valuables: {} },
  upgrades: { firepit: 2, shelter: 1 }
};
V.mbCE_wrote = {};
const pane = document.createElement("div");
pane.setAttribute("data-pane", "global");
document.body.appendChild(pane);
api.renderVanillaBird(pane);
const txt = pane.textContent;
assert(txt.indexOf("鹰塔") !== -1, "区块标题出现（全局页 ⑫）");
assert(txt.indexOf("清洁度") !== -1 && txt.indexOf("材料") !== -1, "清洁度与材料两个分组都在");
assert(txt.indexOf("$") === -1, "面板文案不出现裸变量名（$ 开头）");
assert(!/undefined/.test(txt), "文案不把 undefined 漏给玩家");
const btns = Array.prototype.slice.call(pane.querySelectorAll("button"));
const fillBtn = btns.filter(function (b) { return b.textContent.indexOf("补足") !== -1 && b.textContent.indexOf("100") !== -1; })[0];
assert(!!fillBtn, "找到「补足到 100」按钮");
if (fillBtn) {
  fillBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.bird.materials.wood === 100 && V.bird.materials.junk === 200, "点击按钮写进存档（UI 到存档链路打通）");
  assert(!!V.mbCE_wrote["vcore:bird-materials"], "点击后落了 vcore-bird 留痕");
}
const cleanBtn = btns.filter(function (b) { return b.textContent.indexOf("100") !== -1 && b.textContent.indexOf("清洁") !== -1; })[0];
assert(!!cleanBtn, "找到「清洁度写 100」按钮");
if (cleanBtn) {
  cleanBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.bird.clean === 100, "点击后清洁度写为 100");
  assert(!!V.mbCE_wrote["vcore:bird-clean"], "清洁度点击也落留痕");
}
/* 无 bird 时面板要优雅拒绝，不抛异常 */
delete V.bird;
const pane2 = document.createElement("div");
document.body.appendChild(pane2);
let threw = null;
try { api.renderVanillaBird(pane2); } catch (e) { threw = e; }
assert(threw === null && pane2.textContent.indexOf("鹰塔") !== -1, "无 $bird 时面板仍正常渲染并给出提示");
assert(pane2.querySelectorAll("button").length === 0, "无 $bird 时不渲染任何写入按钮（防误点）");

/* ================= 5. 回退中心文案 ================= */
section("5 回退中心文案");
V.bird = { state: "home", clean: 12, materials: { wood: 5 } };
V.mbCE_wrote = {};
api.vanillaBirdClean(100);
api.vanillaBirdMaterials(100);
assert(typeof api.mbCEUndoItemName === "function", "回退中心命名入口已导出（测试钩子）");
if (typeof api.mbCEUndoItemName === "function") {
  assert(api.mbCEUndoItemName("vcore:bird-clean", V.mbCE_wrote["vcore:bird-clean"]) === "鹰塔清洁度", "回退中心把 bird-clean 显示为中文行名");
  assert(api.mbCEUndoItemName("vcore:bird-materials", V.mbCE_wrote["vcore:bird-materials"]) === "鹰塔八种材料", "回退中心把 bird-materials 显示为中文行名");
}

/* ================= 6. 设施一键满级（十二项 upgrades） ================= */
section("6 设施一键满级");
V.bird = { state: "home", upgrades: { firepit: 1, shelter: 1, nest: 0, pot: 0, rack: 1, decor: 3, snare: 0, wardrobe: 0, mirror: 0, tools: 0, tarp: 0, telescope: 0 } };
V.mbCE_wrote = {};
assert(typeof api.vanillaBirdUpgrades === "function", "设施满级 API 已导出");
r = api.vanillaBirdUpgrades();
assert(r.ok === true, "有 upgrades → 满级写入被接受");
assert(V.bird.upgrades.shelter === 3 && V.bird.upgrades.nest === 3 && V.bird.upgrades.firepit === 3, "庇护 / 巢 / 火坑 = 3（建造菜单最后一级）");
assert(V.bird.upgrades.pot === 3 && V.bird.upgrades.rack === 3, "炊具 / 晾架 = 3");
assert(V.bird.upgrades.decor === 5, "装饰 = 5（第 5 档 Decor Silver）");
assert(V.bird.upgrades.snare === 2, "陷阱 = 2（原版只有 Build Snare 1 一级可建）");
assert(V.bird.upgrades.mirror === 1 && V.bird.upgrades.tools === 1 && V.bird.upgrades.tarp === 1 && V.bird.upgrades.telescope === 1 && V.bird.upgrades.wardrobe === 1, "布尔式设施写 1（不写大数，保留 is 0 / is 1 判定）");
assert(V.mbCE_wrote["vcore:bird-upgrades"].before.lvl.firepit === 1, "留痕 before.lvl.firepit = 1");
assert(V.mbCE_wrote["vcore:bird-upgrades"].type === "vcore-bird", "留痕类型 vcore-bird");
r = api.vanillaBirdUpgrades();
assert(r.ok === true && r.changed === 0, "再点一次 changed = 0（幂等）");
V.bird.upgrades.decor = 6;
api.vanillaBirdUpgrades();
assert(V.bird.upgrades.decor === 6, "已超过上限的装饰 6 不被压低（只升不降）");
u = api.vanillaBirdUndo("bird-upgrades");
assert(u.ok === true && V.bird.upgrades.firepit === 1 && V.bird.upgrades.decor === 3 && V.bird.upgrades.snare === 0, "回退还原首次写入前的等级");
/* emissions / 无 upgrades 拒绝 */
V.bird = { state: "home" };
V.mbCE_wrote = {};
r = api.vanillaBirdUpgrades();
assert(r.ok === false, "upgrades 未初始化 → 满级被拒绝");
/* 面板：满级按钮真实写档 */
V.bird = { state: "home", clean: 12, materials: { wood: 5 }, upgrades: { shelter: 1 } };
V.mbCE_wrote = {};
const pane3 = document.createElement("div");
document.body.appendChild(pane3);
api.renderVanillaBird(pane3);
const txt3 = pane3.textContent;
assert(txt3.indexOf("设施") !== -1, "面板出现「设施满级」分组");
assert(txt3.indexOf("$") === -1 && !/undefined/.test(txt3), "设施分组文案无裸变量名 / 无 undefined");
const maxBtn = Array.prototype.slice.call(pane3.querySelectorAll("button")).filter(function (b) { return b.textContent.indexOf("一键满级") !== -1; })[0];
assert(!!maxBtn, "找到「一键满级」按钮");
if (maxBtn) {
  maxBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert(V.bird.upgrades.shelter === 3 && V.bird.upgrades.decor === 5, "点击后设施写满（UI 到存档链路打通）");
  assert(!!V.mbCE_wrote["vcore:bird-upgrades"], "点击后落 vcore-bird 留痕");
}
if (typeof api.mbCEUndoItemName === "function") {
  assert(api.mbCEUndoItemName("vcore:bird-upgrades", V.mbCE_wrote["vcore:bird-upgrades"]) === "鹰塔十二项设施", "回退中心把 bird-upgrades 显示为中文行名");
}

console.log("\n" + (failures ? "FAILED: " + failures + " / " + (passes + failures) : "ALL PASS: " + passes));
process.exit(failures ? 1 : 0);
