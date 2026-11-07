/*
 * 生成测试 fixture：把原版 DoL 安装里「测试真正需要的那两段」抽出来入库，
 * 让 CI / 干净克隆在没有 64 MB 原版 HTML 时也能跑同一批断言（而不是 SKIP）。
 *
 * 产出（tests/fixtures/）：
 *   scenes-widget.html      —— 原版 `Scene Viewer Widgets` 段落（含 `<<widget "scenes">>` 与 $scenes 元数据），
 *                              供 smoke_dom 第 15 节解析「原版 111 场景 + 分组」断言
 *   dol-gender-funcs.js     —— 原版 isGenitalMismatch / isCrossdressing / isHermOrCrossdresser 三个函数原文，
 *                              供 integration_gender 用真实逻辑断言性别切换
 *   README.md               —— 来源、许可证说明、重生成命令
 *
 * 用法：
 *   node tools/gen_test_fixture.js            # 从本机原版 HTML 重新生成
 *   node tools/gen_test_fixture.js --check    # 只校验 fixture 存在且可解析（CI / pre-commit 用）
 *   原版路径可用 MCE_DOL_HTML 覆盖（与 tests 同口径）。
 *
 * 边界：fixture 只服务测试，不进发布包（zip 只含 boot.json / javascript / twee 等 3 条目）。
 */
"use strict";
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..");
const FIX = path.join(ROOT, "tests", "fixtures");
const DOL_HTML = process.env.MCE_DOL_HTML || "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/Degrees of Lewdity.html";
const SCENES_OUT = path.join(FIX, "scenes-widget.twee");
const GENDER_OUT = path.join(FIX, "dol-gender-funcs.js");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function unesc(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}
/* 与 smoke_dom 同一套解析：按 <tw-passagedata> 抓段落，找含 scenes widget 的那一段 */
function findScenesWidget(html) {
  const re = /<tw-passagedata[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/tw-passagedata>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const t = unesc(m[2]);
    if (t.indexOf('<<widget "scenes">>') !== -1) return { name: m[1], text: t };
  }
  return null;
}
/* 与 integration_gender 同一套抽取：function name( → 花括号配平 */
function extractFunc(src, name) {
  let i = src.indexOf("function " + name + "(");
  if (i < 0) i = src.indexOf(name + " = function(");
  if (i < 0) return null;
  const j = src.indexOf("{", i);
  let depth = 1, m = j + 1;
  while (m < src.length && depth > 0) {
    const c = src[m];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    m++;
  }
  return src.slice(i, m);
}

function gen() {
  if (!fs.existsSync(DOL_HTML)) {
    console.error("FAIL: 原版 HTML 不存在（" + DOL_HTML + "），无法生成 fixture；可用 MCE_DOL_HTML 指定");
    return 2;
  }
  const html = fs.readFileSync(DOL_HTML, "utf8");
  const sw = findScenesWidget(html);
  if (!sw) { console.error("FAIL: 原版 HTML 中找不到 scenes widget 段落"); return 2; }
  const funcs = ["isGenitalMismatch", "isCrossdressing", "isHermOrCrossdresser"].map(function (n) {
    const f = extractFunc(html, n);
    return { name: n, src: f };
  });
  const missing = funcs.filter(function (f) { return !f.src; }).map(function (f) { return f.name; });
  if (missing.length) { console.error("FAIL: 原版函数抽取失败 " + missing.join("/")); return 2; }

  fs.mkdirSync(FIX, { recursive: true });
  /* 只保留测试真正读的那一段：`<<widget "scenes">>` + `<<set $scenes to {...}>>` 对象体。
     同段落里 scenesSearch 等兄弟 widget 与本项目断言无关，不入库（119 KB → 68 KB，且只含场景元数据）。 */
  const objStart = sw.text.indexOf("$scenes to {");
  if (objStart < 0) { console.error("FAIL: scenes widget 里找不到 $scenes 对象"); return 2; }
  let start = sw.text.indexOf("{", objStart), depth = 0, end = -1, inStr = false;
  for (let k = start; k < sw.text.length; k++) {
    const c = sw.text[k];
    if (inStr) { if (c === "\\") k++; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = k; break; } }
  }
  if (end < 0) { console.error("FAIL: $scenes 对象花括号不配平"); return 2; }
  const obj = sw.text.slice(start, end + 1);
  const scenesDoc = [
    "/* 自动生成，勿手改：node tools/gen_test_fixture.js",
    "   来源：原版 Degrees of Lewdity 段落「" + sw.name + "」中的 $scenes 元数据对象",
    "   用途：smoke_dom 第 15/19 节在没有 64 MB 原版 HTML 时仍能解析真实场景元数据",
    "   许可：仅为本地测试取证片段（只含场景名/段落名/解锁态），不进发布包，不再分发 */",
    '<<widget "scenes">>',
    "<<set $scenes to " + obj + ">>",
    "<</widget>>"
  ].join("\n");
  fs.writeFileSync(SCENES_OUT, scenesDoc, "utf8");

  const header = [
    "/* 自动生成，勿手改：node tools/gen_test_fixture.js",
    " * 来源：原版 Degrees of Lewdity " + path.basename(DOL_HTML) + " 中的三个性别判定函数原文。",
    " * 用途：integration_gender 在无原版 HTML 时用同一段真实逻辑断言（替代 SKIP）。",
    " * 许可：仅为本地测试取证片段，不进发布包，不再分发。 */"
  ].join("\n");
  fs.writeFileSync(GENDER_OUT, header + "\n" + funcs.map(function (f) { return "/* " + f.name + " */\n" + f.src; }).join("\n\n") + "\n", "utf8");

  fs.writeFileSync(path.join(FIX, "README.md"), [
    "# tests/fixtures —— 原版取证片段（测试专用，不进发布包）",
    "",
    "| 文件 | 内容 | 消费者 | 体积 |",
    "|---|---|---|---|",
    "| `scenes-widget.twee` | 原版 `" + sw.name + "` 里的 `$scenes` 元数据（外包一层 `<<widget \"scenes\">>`） | `tests/smoke_dom.js` 第 15 / 19 节 | " + fs.statSync(SCENES_OUT).size + " B |",
    "| `dol-gender-funcs.js` | 原版 `isGenitalMismatch` / `isCrossdressing` / `isHermOrCrossdresser` | `tests/integration_gender.js` | " + fs.statSync(GENDER_OUT).size + " B |",
    "",
    "来历：由 `node tools/gen_test_fixture.js` 从本机原版 `Degrees of Lewdity.html` 抽取，只保留测试真正读取的片段；",
    "目的：让 CI / 干净克隆在没有 64 MB 原版 HTML 时跑同一批断言，而不是 SKIP。",
    "",
    "重生成：`node tools/gen_test_fixture.js`（可用 `MCE_DOL_HTML` 指定原版路径）；",
    "校验：`node tools/gen_test_fixture.js --check`（存在性 + 可解析，CI/pre-commit 可挂）。",
    "",
    "**不进发布包**：`tools/pack.ps1` 只打 `boot.json` / `javascript/maplebirchce.js` / `twee/*.twee`。",
    "若原版升级导致场景数变化，重跑生成器并同步更新 smoke 断言里的数据口径。"
  ].join("\n"), "utf8");

  console.log("OK scenes-widget.twee " + fs.statSync(SCENES_OUT).size + " B");
  console.log("OK dol-gender-funcs.js " + fs.statSync(GENDER_OUT).size + " B");
  return 0;
}

function check() {
  let bad = 0;
  if (!fs.existsSync(SCENES_OUT)) { console.error("FAIL 缺 " + SCENES_OUT); bad++; }
  else {
    const txt = fs.readFileSync(SCENES_OUT, "utf8");
    /* fixture 是纯 Twee 片段（非 XML）：要求含 widget 外壳 + 可配平的 $scenes 对象 */
    const hasWidget = txt.indexOf('<<widget "scenes">>') !== -1;
    const objStart = txt.indexOf("$scenes to {");
    if (!hasWidget || objStart < 0) { console.error("FAIL scenes-widget.twee 结构不完整（widget 外壳或 $scenes 对象缺失）"); bad++; }
    else {
      let start = txt.indexOf("{", objStart), depth = 0, end = -1, inStr = false;
      for (let k = start; k < txt.length; k++) {
        const c = txt[k];
        if (inStr) { if (c === "\\") k++; else if (c === '"') inStr = false; }
        else if (c === '"') inStr = true;
        else if (c === "{") depth++;
        else if (c === "}") { depth--; if (depth === 0) { end = k; break; } }
      }
      if (end < 0) { console.error("FAIL scenes-widget.twee $scenes 对象不配平"); bad++; }
      else console.log("OK scenes-widget.twee 解析到 $scenes 对象（" + (end - start + 1) + " 字符）");
    }
  }
  if (!fs.existsSync(GENDER_OUT)) { console.error("FAIL 缺 " + GENDER_OUT); bad++; }
  else {
    const src = fs.readFileSync(GENDER_OUT, "utf8");
    const need = ["isGenitalMismatch", "isCrossdressing", "isHermOrCrossdresser"];
    const miss = need.filter(function (n) { return !extractFunc(src, n); });
    if (miss.length) { console.error("FAIL dol-gender-funcs.js 缺函数 " + miss.join("/")); bad++; }
    else console.log("OK dol-gender-funcs.js 三个函数均可抽取");
  }
  return bad ? 1 : 0;
}

process.exit(process.argv.includes("--check") ? check() : gen());
