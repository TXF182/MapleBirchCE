#!/usr/bin/env node
/* ============================================================================
 * find_def.js — 检索片段工具：给符号，回最小可读片段而不是整段源码
 *
 * 用法：
 *   node tools/find_def.js <symbol> [--dir <相对/绝对目录>] [--limit N]
 *                                  [--all] [--json] [--max-chars 400]
 *
 * 为什么不是 grep：直接 grep 一个符号会吐出整行（本项目单行常 200+ 字符），
 * 一次查三个符号就淹没上下文。本工具只投影两样东西：
 *   1) file:line（可直接跳转）
 *   2) 声明签名（从声明行到第一个 "{"，压缩空白后 ≤400 字符）
 * 默认只报"声明"（function / arrow const / class / 方法 / 对象字面量属性），
 * 加 --all 才把普通引用也列出（引用行只截 200 字符）。
 *
 * 退出码：0 有命中；1 无命中。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_DIR = path.join(ROOT, "javascript", "src");
const EXTS = [".js", ".ts", ".twee", ".json", ".md", ".ps1"];

function parseArgs(argv) {
	const opts = { symbol: null, dir: DEFAULT_DIR, limit: 0, all: false, json: false, maxChars: 400 };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--all") opts.all = true;
		else if (a === "--json") opts.json = true;
		else if (a === "--dir") opts.dir = argv[++i];
		else if (a === "--limit") opts.limit = parseInt(argv[++i], 10) || 0;
		else if (a === "--max-chars") opts.maxChars = parseInt(argv[++i], 10) || 400;
		else if (!opts.symbol) opts.symbol = a;
		else throw new Error("多余参数: " + a);
	}
	if (!opts.symbol) throw new Error("用法：node tools/find_def.js <symbol> [--dir DIR] [--limit N] [--all] [--json]");
	return opts;
}

function walk(dir, out) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) {
			if (e.name === "node_modules" || e.name.startsWith(".")) continue;
			walk(p, out);
		} else if (EXTS.includes(path.extname(e.name).toLowerCase())) out.push(p);
	}
	return out;
}

/* 声明形态：按优先级匹配，粗到细 */
function declKind(line, sym) {
	const s = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	/* 字符串键注册（CHEAT_ADAPTERS["deadwood-reblooms"] = { … }）——查适配器/键名时最常要的形态 */
	if (new RegExp("\\[\\s*[\"']" + s + "[\"']\\s*\\]\\s*=").test(line)) return "assignment";
	if (new RegExp("^\\s*(?:async\\s+)?function\\s+" + s + "\\s*\\(").test(line)) return "function";
	if (new RegExp("^\\s*(?:const|let|var)\\s+" + s + "\\s*=").test(line)) return "const";
	if (new RegExp("^\\s*class\\s+" + s + "\\b").test(line)) return "class";
	if (new RegExp("^\\s*(?:async\\s+)?(?:static\\s+)?get\\s+" + s + "\\s*\\(").test(line)) return "getter";
	if (new RegExp("^\\s*(?:async\\s+)?" + s + "\\s*\\([^)]*\\)\\s*\\{").test(line)) return "method";
	if (new RegExp("^\\s*" + s + "\\s*:\\s*(?:function|\\()").test(line)) return "property";
	if (new RegExp("^\\s*" + s + "\\s*:\\s*\\{").test(line)) return "object";
	return null;
}

/* 从声明行起拼接，直到签名"看起来完整"（出现 { 或 ;）或触到上限；压缩空白 */
function signature(lines, from, maxChars) {
	let buf = lines[from].trim();
	const complete = (s) => {
		const quotes = (s.match(/["'`]/g) || []).length;
		if (s.includes("{") && quotes % 2 === 0) return true;
		if (/;\s*$/.test(s) && quotes % 2 === 0) return true;
		return false;
	};
	const stopAt = Math.min(lines.length, from + 6);
	for (let i = from + 1; i < stopAt; i++) {
		if (complete(buf)) break;
		buf += " " + lines[i].trim();
	}
	buf = buf.replace(/\s+/g, " ").trim();
	if (buf.length > maxChars) buf = buf.slice(0, maxChars - 1) + "…";
	return buf;
}

function main() {
	let opts;
	try { opts = parseArgs(process.argv.slice(2)); }
	catch (e) { console.error(e.message); process.exit(2); }

	const dir = path.isAbsolute(opts.dir) ? opts.dir : path.join(ROOT, opts.dir);
	if (!fs.existsSync(dir)) { console.error("目录不存在: " + dir); process.exit(2); }

	const files = walk(dir, []);
	const symRe = new RegExp("\\b" + opts.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
	const hits = [];
	for (const f of files) {
		const text = fs.readFileSync(f, "utf8");
		if (!symRe.test(text)) continue;
		const lines = text.split("\n");
		const rel = path.relative(ROOT, f).split(path.sep).join("/");
		for (let i = 0; i < lines.length; i++) {
			if (!symRe.test(lines[i])) continue;
			/* 跳过注释行里的命中（注释不是声明也不是有效引用证据） */
			const t = lines[i].trim();
			if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
			const kind = declKind(lines[i], opts.symbol);
			if (!kind && !opts.all) continue;
			hits.push({
				file: rel, line: i + 1, kind: kind || "ref",
				snippet: kind ? signature(lines, i, opts.maxChars) : t.slice(0, 200)
			});
			if (opts.limit && hits.length >= opts.limit) break;
		}
		if (opts.limit && hits.length >= opts.limit) break;
	}

	if (opts.json) {
		console.log(JSON.stringify({ symbol: opts.symbol, dir: path.relative(ROOT, dir), files: files.length, count: hits.length, hits }, null, 2));
	} else {
		console.log("符号 " + opts.symbol + "：扫描 " + files.length + " 个文件，命中 " + hits.length + " 处");
		for (const h of hits) {
			console.log(h.file + ":" + h.line + "  [" + h.kind + "]  " + h.snippet);
		}
	}
	process.exit(hits.length ? 0 : 1);
}

main();
