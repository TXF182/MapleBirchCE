/* UI shell4 测试：P0–P2 灯台学习落地（2026-11-22）
 *
 * 覆盖十组：
 *   1. 设置坏字段逐项修复（ui state 的 collapsed/placeOpen 逐键过滤 + mbCE_auto 逐项布尔化）
 *   2. 主题边饰（4 套 SVG 帧 + 响应式降级，零动画）
 *   3. 外观三开关（动效 fx / 纹理 tex / 边饰 orn，data 属性 gate + 持久化）
 *   4. 按压反馈只缩放不下沉（后写覆盖 07a 的 translateY 规则）
 *   5. ≤560 窄屏全屏（2026-11-22 撤除底部抽屉：长列表操作不便，回归铺满视口）
 *   6. 滚动摘 backdrop-filter（160ms 恢复）
 *   7. Esc 关闭 + aria-expanded 同步
 *   8. 无障碍结构（complementary / tablist / roving tabindex / Home/End）
 *   9. 主题切换零重建（选档不重绘全局页，业务 DOM 保持身份）
 *   10. 宿主 token 快照协议（apply/drop + 手动主题优先）+ 同值不写
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
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;

/* 窄屏开关（抽屉判定用），其余媒体查询一律 false */
let mqNarrow = true;
window.matchMedia = function (q) {
  return {
    matches: q.indexOf("max-width:560") !== -1 ? mqNarrow : false,
    media: q,
    onchange: null,
    addListener: function () {}, removeListener: function () {},
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () { return false; }
  };
};

const V = { player: {}, passage: "Room", mbCE_wrote: {}, mbCE_queue: [] };
global.V = V;
global.State = { variables: V, passage: "Room" };
global.setup = {};
global.Story = { has: function () { return false; }, passages: [], size: 0, get: function () { return null; } };
global.passage = function () { return "Room"; };
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.maplebirch = { get: function () { return null; }, npc: {} };
window.modUtils = { getMod: function () { return null; } };

/* eval 前埋坏字段：ui state 的 collapsed/placeOpen 混入脏值；mbCE_auto 混入脏项 */
window.localStorage.setItem("mbCE_ui_state_v1", JSON.stringify({
  tab: "global", collapsed: { "3|庄园自动维护": 1, "bad": "x", "k": 2 },
  placeOpen: { "a": "1", "b": 0 }, theme: "jade", fx: "0"
}));
window.localStorage.setItem("mbCE_auto", JSON.stringify({ items: { feed: true, farm: 1, bad: "yes", x: 0 }, lastDay: "nope" }));

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
const SOURCE = fs.readFileSync(jsPath, "utf8");
eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;

(async function main() {
try {
assert(!!api, "0.1 setup.mbStageCE 已挂载");

const root = document.getElementById("mce-root");
const toggle = document.getElementById("mce-toggle");
assert(!!root && !!toggle, "0.2 面板容器与悬浮球已建立");

function hasCss(frag) { return SOURCE.indexOf(frag) !== -1; }
/* 运行时注入层：面板 CSS 最终以 style 标签进页面，断言以页面实际 CSS 为准（源码转义形态不可作数） */
function domCss() {
  var out = "";
  document.querySelectorAll("style").forEach(function (s) { out += s.textContent; });
  return out;
}

section("1. 设置坏字段逐项修复");
assert(api.mbCEUiState().collapsed["3|庄园自动维护"] === 1, "1.1 collapsed 合法键保留（值 1）");
assert(!("bad" in api.mbCEUiState().collapsed) && !("k" in api.mbCEUiState().collapsed), "1.2 collapsed 脏键被逐项丢弃（字符串/数字 2）");
assert(!("a" in api.mbCEUiState().placeOpen) && api.mbCEUiState().placeOpen.b === 0, "1.3 placeOpen 同样逐键过滤（字符串 \"1\" 丢弃、0 保留）");
assert(api.mbCEUiState().fx === "0", "1.4 新键 fx 白名单 \"0\" 入 state（旧键全部不受影响）");
assert(api.mcAutoState().items.feed === true && api.mcAutoState().items.farm === true, "1.5 mbCE_auto items 逐项布尔化（true/1 → true）");
assert(!("bad" in api.mcAutoState().items) && !("x" in api.mcAutoState().items), "1.6 mbCE_auto 脏项丢弃（字符串/0）");
assert(api.mcAutoState().lastDay === -1, "1.7 mbCE_auto lastDay 非数回落 -1");
assert(document.documentElement.getAttribute("data-mce-fx") === "off", "1.8 启动即应用 fx=0 → html data-mce-fx=off");

section("2. 主题边饰（4 套 SVG 帧 · 零动画）");
assert(hasCss("--mce-orn-frame"), "2.1 有边饰帧变量 --mce-orn-frame");
assert(hasCss("#mce-root::before"), "2.2 边饰挂 #mce-root::before（零 DOM 节点）");
assert(hasCss("border-image-slice:24"), "2.3 帧切片 24 等分（灯台同款口径）");
assert(hasCss("%23E3B25F"), "2.4 gold 帧金色 #E3B25F（默认态帧）");
assert(hasCss("%238FA6FF"), "2.5 starry 帧星蓝 #8FA6FF");
assert(hasCss("%2300E5FF"), "2.6 cyberpunk 帧霓虹青 #00E5FF");
assert(hasCss("%237FD6C5"), "2.7 jade 帧青釉 #7FD6C5");
assert(hasCss("@media (max-width:600px)") && hasCss("--mce-orn-thick:8px"), "2.8 ≤600px 边饰收细 8px");
assert(hasCss("@media (max-width:420px)"), "2.9 ≤420px 有降级分支（只留标题枝语义）");
assert(domCss().indexOf('html[data-mce-orn="off"]') !== -1, "2.10 边饰可被外观开关整体关闭（运行时 style）");

section("3. 外观三开关（fx/tex/orn）");
assert(api.mbCEUiOptToggle("fx") === "1", "3.1 fx \"0\"→\"1\"（toggle 返回新值）");
assert(document.documentElement.getAttribute("data-mce-fx") === "1", "3.2 开态属性 data-mce-fx=1");
assert(api.mbCEUiOptToggle("fx") === "0", "3.3 再点回 \"0\"");
assert(document.documentElement.getAttribute("data-mce-fx") === "off", "3.4 关态属性 data-mce-fx=off");
assert(api.mbCEUiOptToggle("tex") === "0", "3.5 tex 默认 \"1\" → 关");
assert(document.documentElement.getAttribute("data-mce-tex") === "off", "3.6 data-mce-tex=off 同步");
assert(api.mbCEUiOptToggle("orn") === "0", "3.7 orn 关（此后各节不受边饰干扰）");
assert(api.mbCEUiOptToggle("bogus") === null, "3.8 非法开关名返回 null 且不写状态");
assert(domCss().indexOf('html[data-mce-fx="off"]') !== -1, "3.9 CSS gate：动效开关存在（运行时 style）");
assert(domCss().indexOf('html[data-mce-tex="off"]') !== -1 && domCss().indexOf("background-image:none!important") !== -1, "3.10 CSS gate：纹理开关存在且以 none!important 压纹理");
assert(JSON.parse(window.localStorage.getItem("mbCE_ui_state_v1")).tex === "0", "3.11 开关状态落 localStorage（mbCE_ui_state_v1.tex）");

section("4. 按压反馈只缩放不下沉");
const pressOld = SOURCE.indexOf(".mce-btn:active{transform:translateY");
const pressNew = SOURCE.lastIndexOf("#mce-root .mce-btn:active{");
assert(pressOld !== -1, "4.1 旧规则（translateY 下沉）存在于早期段");
assert(pressNew !== -1 && pressNew > pressOld, "4.2 追加段规则后写覆盖（位置晚于旧规则）");
const pressRule = SOURCE.slice(pressNew, SOURCE.indexOf("}", pressNew) + 1);
assert(pressRule.indexOf("translateY") === -1, "4.3 追加规则无 translateY（只缩放不下沉）");
assert(pressRule.indexOf("scale(.96)") !== -1, "4.4 追加规则保留统一缩放 scale(.96)");

section("5. ≤560 窄屏全屏（撤除底部抽屉）");
assert(hasCss("#mce-root{top:0;right:0;bottom:0;left:0;width:100vw;max-width:100vw;max-height:100vh;border-radius:0;border:none}"), "5.1 窄屏全屏几何存在（铺满视口）");
assert(!hasCss("62vh") && !hasCss("mce-drawer-in") && !hasCss("mce-drawer-out"), "5.2 抽屉几何与进出动画已撤除（无 62vh / 无 mce-drawer）");
toggle.style.top = "300px"; toggle.style.left = "100px"; toggle.style.right = "auto"; toggle.style.bottom = "auto";
api.open();
assert(document.documentElement.getAttribute("data-mce-drawer-open") === null, "5.3 窄屏 open 不再挂 data-mce-drawer-open");
assert(toggle.style.top === "300px", "5.4 悬浮球不再被抬升（保持 300px）");
assert(toggle.getAttribute("aria-expanded") === "true", "5.5 面板开 → aria-expanded=true");
api.close();
await sleep(220);
assert(document.documentElement.getAttribute("data-mce-drawer-open") === null, "5.6 关闭后仍无抽屉属性");
assert(toggle.style.top === "300px" && toggle.style.left === "100px", "5.7 球位置未被快照改写（300/100）");
assert(toggle.getAttribute("aria-expanded") === "false", "5.8 面板关 → aria-expanded=false");
mqNarrow = false;
api.open();
assert(document.documentElement.getAttribute("data-mce-drawer-open") === null, "5.9 宽屏 open 同样无抽屉属性");
api.close();
await sleep(220);
mqNarrow = true;

section("6. 滚动摘 backdrop-filter");
const bodyEl = root.querySelector(".mce-body");
assert(!!bodyEl, "6.1 .mce-body 存在");
bodyEl.dispatchEvent(new window.Event("scroll"));
assert(root.getAttribute("data-mce-scroll") === "1", "6.2 滚动即挂 data-mce-scroll=1");
await sleep(220);
assert(root.getAttribute("data-mce-scroll") === null, "6.3 停滚 160ms 后摘除");
assert(domCss().indexOf('data-mce-scroll="1"') !== -1 && domCss().indexOf("backdrop-filter:none!important") !== -1, "6.4 CSS 有滚动摘模糊规则（运行时 style）");

section("7. Esc 关闭");
api.open();
document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await sleep(220);
assert(!root.classList.contains("mce-open"), "7.1 Esc 关闭面板（mce-open 摘除）");
api.open();
document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "a" }));
assert(root.classList.contains("mce-open"), "7.2 非 Esc 键不关闭");
/* 7.3/7.4 与 MapleLantern 共存：灯台档案面板（#ml-panel，hidden 属性=关闭态）开着时 CE 让出 Esc */
const mlPanel = document.createElement("section");
mlPanel.id = "ml-panel";
document.body.appendChild(mlPanel);
document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
assert(root.classList.contains("mce-open"), "7.3 灯台面板打开时 CE 不抢 Esc（无双关）");
mlPanel.hidden = true;
document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await sleep(220);
assert(!root.classList.contains("mce-open"), "7.4 灯台面板关闭后 Esc 正常关闭 CE");
mlPanel.remove();
api.close();
await sleep(220);

section("8. 无障碍结构 + roving tabindex");
assert(root.getAttribute("role") === "complementary", "8.1 面板 role=complementary（非模态侧栏语义）");
assert(!!root.getAttribute("aria-label"), "8.2 面板有 aria-label");
const tabs = root.querySelector(".mce-tabs");
assert(tabs.getAttribute("role") === "tablist", "8.3 页签容器 role=tablist");
const tabBtns = tabs.querySelectorAll("button[data-tab]");
let activeIdx = -1;
tabBtns.forEach(function (b, i) {
  if (b.classList.contains("mce-active")) { activeIdx = i; }
});
assert(activeIdx === 4, "8.4 当前激活页签是 global（坏字段 tab 已恢复）");
tabBtns.forEach(function (b, i) {
  assert(b.getAttribute("role") === "tab", "8.5[" + i + "] 页签 role=tab");
  const sel = b.getAttribute("aria-selected");
  assert(sel === (i === activeIdx ? "true" : "false"), "8.6[" + i + "] aria-selected 与激活态一致");
  assert(b.getAttribute("tabindex") === (i === activeIdx ? "0" : "-1"), "8.7[" + i + "] roving tabindex（激活 0 其余 -1）");
});
const paneEls = root.querySelectorAll(".mce-pane");
assert(paneEls.length === 7, "8.8 七个 pane");
assert(paneEls[0].getAttribute("role") === "tabpanel", "8.9 pane role=tabpanel");
tabs.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
let act = tabs.querySelector(".mce-active");
assert(act && act.getAttribute("data-tab") === "mods", "8.10 → 键移到下一档 mods 并激活");
assert(tabs.querySelector("button[data-tab=\"mods\"]").getAttribute("tabindex") === "0", "8.11 新激活页签 tabindex=0");
assert(tabs.querySelector("button[data-tab=\"global\"]").getAttribute("tabindex") === "-1", "8.12 旧激活页签回退 -1");
tabs.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
assert(tabs.querySelector(".mce-active").getAttribute("data-tab") === "char", "8.13 Home 回第一档 char");
tabs.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
assert(tabs.querySelector(".mce-active").getAttribute("data-tab") === "yanling", "8.14 ← 从 char 回卷到末档 yanling");
tabs.dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
assert(tabs.querySelector(".mce-active").getAttribute("data-tab") === "yanling", "8.15 End 到末档");
api.mbCEUiSave({ tab: "global" });
tabs.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
assert(tabs.querySelector(".mce-active").getAttribute("data-tab") === "char", "8.16 再次 Home（roving 持续可用）");

section("10. 宿主 token 快照协议 + 手动主题优先（先于 S9：picker 点击即 manual 语义）");
window.DoLGameUI = { ui: { getTheme: function () { return { tokens: { ocean: "--dgu-accent", card: "--dgu-card", mist: "--dgu-secondary", radius: "--dgu-radius" } }; } } };
assert(api.syncHostTokens() === 4, "10.1 有宿主时同步写入 4 个内联 token");
assert(root.style.getPropertyValue("--mce-accent").indexOf("var(--dgu-accent") === 0, "10.2 --mce-accent 指向主 UI 变量");
assert(api.setTheme("jade", false, true) === "jade", "10.3 手动切主题（manual=true）生效");
assert(root.style.getPropertyValue("--mce-accent") === "", "10.4 手动切主题即 drop 宿主内联（主题类接管）");
assert(api.syncHostTokens() === -1, "10.5 手动主题优先：本会话不再自动跟随宿主");
assert(api.mbCEDropHostTokens() === 0, "10.6 二次 drop 幂等（返回 0 条）");
assert(api.getTheme() === "jade", "10.7 主题仍为手动所选 jade");

section("9. 主题切换零重建（选档不重绘全局页）");
api.setTheme("gold"); /* 复位（不传 manual——S10 的宿主协议依赖 manual 仍未置位） */
api.renderGlobal();
const pane9 = root.querySelector('[data-pane="global"]');
const probe = document.createElement("div");
probe.id = "ui-probe";
pane9.appendChild(probe);
const picks9 = pane9.querySelectorAll(".mce-theme-pick");
assert(picks9.length === 4, "9.1 全局页四个主题按钮");
picks9[2].click();
assert(api.getTheme() === "cyberpunk", "9.2 点第 3 档命中 cyberpunk");
assert(root.querySelector("#ui-probe") === probe, "9.3 业务 DOM 保持身份（未被 renderGlobal 清空重建）");
assert(picks9[2].classList.contains("mce-on"), "9.4 高亮移档到 cyberpunk");
assert(!picks9[0].classList.contains("mce-on"), "9.5 旧高亮摘除");
assert(root.classList.contains("mce-theme-cyberpunk"), "9.6 主题类挂上 root");
probe.parentNode.removeChild(probe);

section("11. 同值不写");
let setCalls = 0;
/* jsdom 的 localStorage 实例属性赋值会静默失效（真实写入正常），spy 必须挂 Storage.prototype */
const origSetProto = window.Storage.prototype.setItem;
window.Storage.prototype.setItem = function (k, v) { setCalls++; return origSetProto.call(this, k, v); };
api.mbCEUiSave({ tab: "global" }); /* 与当前 state 不同 → 必写 */
const c1 = setCalls;
api.mbCEUiSave({ tab: "global" });
assert(setCalls === c1, "11.1 同值 save 不再写 localStorage（calls " + setCalls + "）");
api.mbCEUiSave({ tab: "char" });
assert(setCalls === c1 + 1, "11.2 换值 save 正常写入");
window.Storage.prototype.setItem = origSetProto;

section("12. 外观开关渲染（全局页主题组下）");
api.renderGlobal();
const pane12 = root.querySelector('[data-pane="global"]');
const chips = pane12.querySelectorAll(".mce-opt-chip");
assert(chips.length === 3, "12.1 三个外观开关 chip（实得 " + chips.length + "）");
const kinds = Array.prototype.map.call(chips, function (c) { return c.getAttribute("data-opt"); });
assert(kinds.join(">") === "fx>tex>orn", "12.2 顺序 fx>tex>orn（实得 " + kinds.join(">") + "）");
assert(!chips[0].classList.contains("mce-on"), "12.3 fx 当前关（S3 末态 \"0\"）→ chip 无高亮");
assert(!chips[1].classList.contains("mce-on"), "12.4 tex 当前关 → chip 无高亮");
const probe12 = document.createElement("div");
probe12.id = "ui-probe12";
pane12.appendChild(probe12);
chips[1].click();
assert(document.documentElement.getAttribute("data-mce-tex") === "1", "12.5 点 chip 切 tex → on");
assert(pane12.querySelector("#ui-probe12") === probe12, "12.6 chip 点击不重建全局页");
assert(chips[1].classList.contains("mce-on"), "12.7 chip 自身高亮翻转");
probe12.parentNode.removeChild(probe12);

section("13. 复位");
api.setTheme("gold");
api.mbCEUiOptToggle("fx");
assert(api.getTheme() === "gold" && document.documentElement.getAttribute("data-mce-fx") === "1", "13.1 主题复位 gold、fx 复位开");

console.log("\n--- 汇总 ---");
console.log("PASS " + passes + " / FAIL " + failures);
if (failures) { process.exit(1); }
} catch (e) { console.error("测试异常终止: " + (e && e.stack || e)); process.exit(1); }
})();
