/* 四主题视觉对照页生成器（v2.0.23）
 *
 * 为什么要有它：CSS 里的 token 对不对，自动化断言只能证明"字符串在"，
 * 证明不了"看起来是赛博朋克/青瓷/星空"。这个脚本从构建产物里取出真实的 MB_CSS，
 * 拼 4 份同一套面板 DOM（每份挂不同 mce-theme-*），生成一个 2×2 对照页给 moli 截图。
 *
 * 用法：node tools/theme_preview.js [输出路径]
 */
"use strict";
const { JSDOM } = require("jsdom");
const fs = require("fs"), path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "..", "docs", "theme-preview.html");

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
const SOURCE = fs.readFileSync(jsPath, "utf8");
eval(SOURCE + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));

/* 取真实 CSS：injectCSS 把 MB_CSS 塞进 <style>，直接读回而不是自己重写一套 */
const styles = Array.from(document.querySelectorAll("style"));
const css = styles.map(function (s) { return s.textContent; }).join("\n");
if (css.length < 5000) { console.error("FAIL: 没取到 MB_CSS（" + css.length + " B）"); process.exit(1); }

const root = document.getElementById("mce-root");
if (!root) { console.error("FAIL: 没有 #mce-root"); process.exit(1); }

/* 演示内容：每份面板塞同样的骨架（主题选择器 / 卡片 / 数值卡 / 按钮 / 页签），让三套纹理的差异看得见。
   v2.1.0 起主题选择器是「全局」页第一块，所以对照页第一块也画它，顺带验证 .mce-on 高亮色对不对。 */
/* 字形与 07a-shell3-fx.js 的 MCE_THEME_ICON 保持一致（✦ 在雅黑下是豆腐块，已换成 ◇/★/⚡/◆） */
const PICKS = [
  ["gold", "◇ 黑金"], ["starry", "★ 星空蓝"], ["cyberpunk", "⚡ 赛博朋克"], ["jade", "◆ 青瓷"]
];
function demoTimerPicker(theme) {
  const row = PICKS.map(function (p) {
    return '<button class="mce-theme-pick' + (p[0] === theme ? " mce-on" : "") + '" data-theme="' + p[0] + '" type="button">' + p[1] + "</button>";
  }).join("");
  return '<div class="mce-group"><div class="mce-group-h"><span>外观主题</span><span class="mce-group-n">四档 · 点一下立刻换，自动记住</span></div>' +
    '<div class="mce-group-b"><div class="mce-theme-pick-row">' + row + "</div></div></div>";
}
const DEMO_BODY = [
  '<div class="mce-card">',
  '<div class="mce-data-card"><div class="mce-data-label">支配</div><div class="mce-data-value">1000</div></div>',
  '<div class="mce-data-card"><div class="mce-data-label">顺从</div><div class="mce-data-value">750</div></div>',
  "</div>",
  '<div class="mce-group"><div class="mce-row"><span class="mce-txt">赛博朋克 / 青瓷 / 星空 三套材质对照</span></div>',
  '<div class="mce-row"><button class="mce-btn" type="button">普通按钮</button><button class="mce-seg-btn" type="button">分段</button></div></div>',
  '<div class="mce-card"><div class="mce-row"><span class="mce-chip">标签</span><span class="mce-chip">材质</span></div>' +
  '<div class="mce-row"><span class="mce-txt-dim">次要文字 dim</span></div>' +
  '<div class="mce-row"><span class="mce-txt-faint">弱文字 faint</span></div></div>'
].join("");

const THEMES = [
  ["gold", "黑金 gold（未改动，作为对照基线）"],
  ["starry", "星空蓝 starry v2（银河带 + 15 星点 + 双流星线）"],
  ["cyberpunk", "赛博朋克 cyberpunk（#00E5FF 青 / #FF3D9A 品红）"],
  ["jade", "青瓷 jade（#5FBFAC 青釉 + 七层开片）"]
];

function panelHtml(theme) {
  const clone = root.cloneNode(true);
  // 去掉所有主题类，只留当前这一档
  ["mce-theme-starry", "mce-theme-cyberpunk", "mce-theme-jade"].forEach(function (c) { clone.classList.remove(c); });
  if (theme !== "gold") { clone.classList.add("mce-theme-" + theme); }
  clone.classList.add("mce-open");
  const body = clone.querySelector(".mce-body");
  if (body) { body.innerHTML = demoTimerPicker(theme) + DEMO_BODY; }
  return clone.outerHTML;
}

const cards = THEMES.map(function (t) {
  return '<section class="pv-cell"><h2>' + t[1] + "</h2>" + panelHtml(t[0]) + "</section>";
}).join("\n");

const html = '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="utf-8"><title>MapleBirchCE v2.1.0 四主题对照</title>\n<style>\n' +
  css +
  '\n/* 预览页专用：把固定定位面板摆进网格，不改任何主题 token */\n' +
  'html,body{margin:0;background:#0A0C10;font-family:"Microsoft YaHei",system-ui,sans-serif}\n' +
  '.pv-wrap{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px;box-sizing:border-box}\n' +
  '.pv-cell h2{font-size:13px;color:#8A93A6;margin:0 0 8px;font-weight:400;letter-spacing:.04em}\n' +
  '#mce-root,#mce-root.mce-open{position:relative;top:auto;right:auto;bottom:auto;display:flex;width:100%;' +
  'max-width:none;height:660px;max-height:660px;border-right:1px solid var(--mce-border-quiet);border-radius:14px;overflow:hidden}\n' +
  '#mce-toggle{display:none}\n' +
  '</style></head>\n<body><div class="pv-wrap">' + cards + "</div></body></html>\n";

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, "utf8");
console.log("预览页已写: " + OUT);
console.log("CSS 取回 " + css.length + " B / 面板 " + THEMES.length + " 档");
