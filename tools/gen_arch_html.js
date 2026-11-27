#!/usr/bin/env node
/* gen_arch_html.js —— 把 .codegraph/arch-data.json 渲染成单文件可交互架构页
 * 用法：node tools/gen_arch_html.js [--data <json>] [--out <html>]
 * 模板：tools/arch-template.html（占位符 __ARCH_DATA__ / __VERSION__）
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const DATA = path.resolve(arg("--data") || path.join(ROOT, ".codegraph", "arch-data.json"));
const OUT = path.resolve(arg("--out") || path.join(ROOT, "docs", "architecture-interactive.html"));
const tpl = fs.readFileSync(path.join(__dirname, "arch-template.html"), "utf8");
const json = fs.readFileSync(DATA, "utf8");
const meta = JSON.parse(json).meta;
if (!tpl.includes("__ARCH_DATA__")) { console.error("模板缺少 __ARCH_DATA__ 占位符"); process.exit(1); }
let html = tpl.replace("__ARCH_DATA__", () => json);
html = html.split("__VERSION__").join(meta.mceVersion);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
const left = (html.match(/__ARCH_DATA__|__VERSION__/g) || []).length;
console.log(JSON.stringify({ out: OUT, bytes: Buffer.byteLength(html), version: meta.mceVersion, placeholdersLeft: left }, null, 2));
if (left) process.exit(1);