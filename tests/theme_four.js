/* 四主题测试（v2.0.23 · 参考 MapleLantern v1.1.8 src/style.css 原文）
 *
 * 学三份东西：
 *   cyberpunk —— 赛博朋克：#00E5FF 青 / #FF3D9A 品红，六层网格纹理 + 霓虹描边光晕
 *   jade      —— 青瓷：#5FBFAC 青釉，七层开片纹理（112° 高光条 + 118° 对角反光 + 66/28/-24° 三向细纹）
 *   star      —— 星空：#8FA6FF 星蓝，银河流光带 + 12 个星点 + 两条极窄流星线
 *
 * 断言分四层，每层都能被玩家看见：
 *   ① 状态层：setTheme/getTheme/循环顺序/非法回落/持久化白名单
 *   ② 类层：#mce-root 与悬浮球挂对类，且三类互斥不留残类
 *   ③ CSS 层：MB_CSS 里真有那套 token 与纹理变量（不是"看起来有主题"）
 *   ④ 联动层：锚定确认条跟随、按压环经 html 属性拿到当前主题的辉光色
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

const jsPath = path.join(__dirname, "..", "javascript", "maplebirchce.js");
if (!fs.existsSync(jsPath)) { console.error("FAIL: 缺构建产物 " + jsPath); process.exit(1); }
const SOURCE = fs.readFileSync(jsPath, "utf8");
eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
assert(!!api, "setup.mbStageCE 已挂载");

const root = document.getElementById("mce-root");
assert(!!root, "面板容器 #mce-root 已建立");
const toggle = document.getElementById("mce-toggle");

/* 四主题的合法名字与对应类名。gold 历来不挂类（黑金是默认态），其余三个各挂 mce-theme-<name>。 */
const THEMES = ["gold", "starry", "cyberpunk", "jade"];
const THEME_CLASS = {
  starry: "mce-theme-starry",
  cyberpunk: "mce-theme-cyberpunk",
  jade: "mce-theme-jade"
};

section("1. 状态层：四主题切换、互斥、非法回落");
assert(api.setTheme("cyberpunk") === "cyberpunk" && api.getTheme() === "cyberpunk", "1.1 setTheme(cyberpunk) 生效并回读");
assert(api.setTheme("jade") === "jade" && api.getTheme() === "jade", "1.2 setTheme(jade) 生效并回读");
assert(api.setTheme("starry") === "starry" && api.getTheme() === "starry", "1.3 setTheme(starry) 向后兼容仍生效");
assert(api.setTheme("bogus") === "gold" && api.getTheme() === "gold", "1.4 非法主题名回落 gold（不写脏值）");
assert(api.setTheme("") === "gold", "1.5 空字符串同样回落 gold");
assert(api.setTheme(undefined) === "gold", "1.6 undefined 回落 gold");

section("2. 类层：根容器与悬浮球同步、三类互斥");
function hasCls(node, cls) { return !!node && !!node.classList && node.classList.contains(cls); }
api.setTheme("cyberpunk");
assert(hasCls(root, THEME_CLASS.cyberpunk), "2.1 cyberpunk → #mce-root 挂 mce-theme-cyberpunk");
assert(!hasCls(root, THEME_CLASS.starry) && !hasCls(root, THEME_CLASS.jade), "2.2 cyberpunk → 不残留 starry/jade 类");
assert(hasCls(toggle, THEME_CLASS.cyberpunk), "2.3 cyberpunk → 悬浮球同步挂类");
api.setTheme("jade");
assert(hasCls(root, THEME_CLASS.jade), "2.4 jade → #mce-root 挂 mce-theme-jade");
assert(!hasCls(root, THEME_CLASS.cyberpunk) && !hasCls(root, THEME_CLASS.starry), "2.5 jade → 不残留其它主题类");
assert(hasCls(toggle, THEME_CLASS.jade), "2.6 jade → 悬浮球同步挂类");
api.setTheme("starry");
assert(hasCls(root, THEME_CLASS.starry), "2.7 starry → 挂 mce-theme-starry（旧断言面保持）");
assert(!hasCls(root, THEME_CLASS.cyberpunk) && !hasCls(root, THEME_CLASS.jade), "2.8 starry → 不残留新主题类");
api.setTheme("gold");
assert(!hasCls(root, THEME_CLASS.starry) && !hasCls(root, THEME_CLASS.cyberpunk) && !hasCls(root, THEME_CLASS.jade), "2.9 gold → 三类全清（回到默认黑金）");

section("3. 循环：gold → starry → cyberpunk → jade → gold");
api.setTheme("gold");
var seen = [];
for (var i = 0; i < 4; i++) { seen.push(api.cycleTheme()); }
assert(api.getTheme() === "gold", "3.1 cycle 走满一圈（4 次）回到起点 gold");
assert(seen.join(">") === "starry>cyberpunk>jade>gold", "3.2 循环顺序 starry→cyberpunk→jade→gold（实得 " + seen.join(">") + "）");
api.cycleTheme();
assert(api.getTheme() === "starry", "3.3 第二圈第一步仍是 starry（循环不跳档）");
api.setTheme("gold");

section("4. 持久化：白名单扩到四主题，脏值不入库");
api.setTheme("jade");
var st4 = api.mbCEUiState();
assert(st4.theme === "jade", "4.1 setTheme(jade) 写入 ui state.theme=jade");
api.mbCEUiSave({ theme: "cyberpunk" });
assert(api.mbCEUiState().theme === "cyberpunk", "4.2 mbCEUiSave 接受 cyberpunk（旧白名单只有 starry/gold 会静默丢弃）");
api.mbCEUiSave({ theme: "bogus" });
assert(api.mbCEUiState().theme === "cyberpunk", "4.3 非法主题名不写入（保留上一次合法值）");
var lsKey = Object.keys(window.localStorage).filter(function (k) { return k.indexOf("mbCE") !== -1; });
assert(lsKey.length > 0, "4.4 主题状态已落 localStorage（键名前缀 mbCE）");

section("5. CSS 层：三套 token 与纹理变量真的在 MB_CSS 里");
function hasCss(frag) { return SOURCE.indexOf(frag) !== -1; }
assert(hasCss("#mce-root.mce-theme-cyberpunk{"), "5.1 有 cyberpunk token 组");
assert(hasCss("--mce-accent:#00E5FF"), "5.2 cyberpunk accent = #00E5FF（MapleLantern 原值）");
assert(hasCss("--mce-bg-deep:#05070F"), "5.3 cyberpunk 底色 = #05070F（原值）");
assert(hasCss("#FF3D9A"), "5.4 cyberpunk 副色品红 #FF3D9A 出现（描边/霓虹）");
assert(hasCss("#mce-root.mce-theme-jade{"), "5.5 有 jade token 组");
assert(hasCss("--mce-accent:#5FBFAC"), "5.6 jade accent = #5FBFAC（青瓷釉色原值）");
assert(hasCss("--mce-bg-deep:#0A1110"), "5.7 jade 底色 = #0A1110（原值）");
assert(hasCss("repeating-linear-gradient(66deg"), "5.8 jade 有 66° 开片细纹（瓷器开片语言）");
assert(hasCss("repeating-linear-gradient(-24deg"), "5.9 jade 有 -24° 开片细纹");
assert(hasCss("#mce-root.mce-theme-starry{--mce-accent:#8FA6FF"), "5.10 星空 accent 升级为 #8FA6FF（MapleLantern 原值，替代旧 #8fb3ff）");
assert(hasCss("--mce-bg-deep:#070A14"), "5.11 星空底色升级为 #070A14（更深夜空）");
assert(hasCss("linear-gradient(58deg"), "5.12 星空有 58° 银河流光带");
assert(hasCss("linear-gradient(116deg"), "5.13 星空有 116° 流星线");
assert(hasCss("linear-gradient(64deg"), "5.14 星空有 64° 第二条流星线");
var starDots = (SOURCE.match(/radial-gradient\(\d+(?:\.\d+)?px \d+(?:\.\d+)?px at \d+% \d+%/g) || []).length;
assert(starDots >= 12, "5.15 星空星点 ≥12 个（实得 " + starDots + "；面板 10 + 正文 3 + 卡片 2）");

section("6. 联动：确认条跟随 + 按压环取当前主题辉光");
api.setTheme("cyberpunk");
/* showAnchorPrompt(P, meta) 的真实签名：P 是场景注册表项（key/name），meta 是地点/时间元数据 */
api.showAnchorPrompt({ key: "forest_shop", name: "森林商店" }, { location: "forest", timeNote: "" });
var box6 = document.querySelector(".mce-anchor-prompt");
assert(!!box6, "6.1 确认条已出现");
assert(hasCls(box6, "mce-theme-cyberpunk"), "6.2 cyberpunk 下确认条挂 mce-theme-cyberpunk");
api.setTheme("jade");
assert(hasCls(box6, "mce-theme-jade"), "6.3 切 jade 后确认条类同步换掉（旧类被移除）");
assert(!hasCls(box6, "mce-theme-cyberpunk"), "6.4 确认条不残留上一主题类");
api.hideAnchorPrompt();
assert(document.documentElement.getAttribute("data-mce-theme") === "jade", "6.5 html 上写 data-mce-theme=jade（按压环/浮层取色通道）");
assert(hasCss(':root[data-mce-theme="cyberpunk"]'), "6.6 按压辉光按主题分档（cyberpunk 分支存在）");
assert(hasCss(':root[data-mce-theme="jade"]'), "6.7 按压辉光 jade 分支存在");
assert(hasCss(':root[data-mce-theme="starry"]'), "6.8 按压辉光 starry 分支存在");
assert(hasCss("--mce-press-glow:rgba(0,229,255,.56)"), "6.9 赛博按压辉光 = 原值 rgba(0,229,255,.56)");
assert(hasCss("--mce-press-glow:rgba(127,214,197,.5)"), "6.10 青瓷按压辉光 = 原值 rgba(127,214,197,.5)");
assert(hasCss("--mce-press-glow:rgba(143,166,255,.5)"), "6.11 星空按压辉光 = 原值 rgba(143,166,255,.5)");

section("7. 主题选择器在全局页最上面（v2.1.0：从面板头部搬到全局页顶）");
/* 第 6 节收在 jade，这里显式回 gold，才能断言"默认档就是高亮档" */
api.setTheme("gold");
api.renderGlobal();
var pane7 = root.querySelector('[data-pane="global"]');
assert(!!pane7, "7.1 全局页容器存在");
var picks7 = pane7 ? pane7.querySelectorAll(".mce-theme-pick") : [];
assert(picks7.length === 4, "7.2 全局页有 4 个主题按钮（实得 " + picks7.length + "）");
assert(!!(pane7 && pane7.firstElementChild) && pane7.firstElementChild.querySelector(".mce-theme-pick"),
  "7.3 主题选择器是全局页最上面的一块（不是埋在分组中间）");
var order7 = Array.prototype.map.call(picks7, function (b) { return b.getAttribute("data-theme"); });
assert(order7.join(">") === "gold>starry>cyberpunk>jade", "7.4 四个按钮顺序 gold>starry>cyberpunk>jade（实得 " + order7.join(">") + "）");
assert(picks7.length === 4 && picks7[0].classList.contains("mce-on"), "7.5 当前主题 gold 的按钮高亮 mce-on");
/* 直点赛博朋克：必须是"选中该档"而不是在循环里滚一格 */
picks7[2].click();
assert(api.getTheme() === "cyberpunk", "7.6 点第 3 个按钮直接命中 cyberpunk（不是循环滚一格）");
var picks7b = root.querySelector('[data-pane="global"]').querySelectorAll(".mce-theme-pick");
assert(picks7b[2].classList.contains("mce-on"), "7.7 切换后重绘：高亮落到 cyberpunk 按钮");
assert(!picks7b[0].classList.contains("mce-on"), "7.8 旧高亮被摘掉（不同时亮两个）");
assert(document.documentElement.getAttribute("data-mce-theme") === "cyberpunk", "7.9 点按钮也同步 html 属性（按压环取色）");
var hdr7 = root.querySelector(".mce-header");
assert(!hdr7.querySelector(".mce-theme-btn"), "7.10 面板头部不再有主题按钮（已搬走，不留双入口）");

section("8. 复位与收尾");
api.setTheme("gold");
assert(api.getTheme() === "gold", "8.1 收尾复位 gold");
assert(document.documentElement.getAttribute("data-mce-theme") === "gold", "8.2 html 属性同步复位 gold");

console.log("\n--- 汇总 ---");
console.log("PASS " + passes + " / FAIL " + failures);
if (failures) { process.exit(1); }
