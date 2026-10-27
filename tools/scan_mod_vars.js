#!/usr/bin/env node
/* ============================================================================
 * scan_mod_vars.js — 模组变量引用扫描器
 * 学习自 Cheat Extended 的「变量搜索 / 快照差异」Debug 工具，转为 MCE 适配器开发辅助。
 *
 * 用法：node tools/scan_mod_vars.js <模组源码目录> [适配器id]
 *
 * 正向扫描：从模组源码提取 $xxx / V.xxx / setup.xxx 引用 → 与 CHEAT_ADAPTERS
 * 声明 + 原版顶层键清单（03-global.js ORIGINAL_V_ROOT_KEYS）对比 → 三分类：
 *
 *   [已声明]           源码引用 & 适配器声明命中（varPath 根一致）
 *   [未声明·候选补录]   源码引用 & 非原版/非面板自身/非框架根 & 未声明 —— 补录候选
 *   [声明但源码未见]    适配器声明 varPath 在源码目录无字面引用（动态键/别名需 resolve_missing 复核）
 *
 * 与原 resolve_missing.js（声明→找证据，逆向）互补：本工具是 源码→对比声明（正向）。
 * ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
/* 适配器源码按模组拆分（04a-00..09-*.js，v1.9.13）：目录扫描拼接，顺序与 build_js.js sort 一致 */
const ADAPTER_DIR = path.join(ROOT, "javascript", "src");
const GLOBAL_SRC = path.join(ROOT, "javascript", "src", "03-global.js");

const srcDir = process.argv[2];
const filterMod = process.argv[3];
if (!srcDir || !fs.existsSync(srcDir)) {
	console.error("用法: node tools/scan_mod_vars.js <模组源码目录> [适配器id]");
	console.error("说明: 目录内 .twee/.js/.ts 会递归扫描变量引用，输出与适配器声明的三分类对比。");
	process.exit(1);
}

/* ---------- 1. 提取适配器声明 varPath ---------- */
function extractAdapterPaths() {
	const text = fs.readdirSync(ADAPTER_DIR).filter(f => /^04a-.*\.js$/.test(f)).sort()
	  .map(f => fs.readFileSync(path.join(ADAPTER_DIR, f), "utf8")).join("\n");
	const out = {};
	const re = /CHEAT_ADAPTERS\["([^"]+)"\]\s*=\s*\{/g;
	let m;
	while ((m = re.exec(text))) {
		const modId = m[1];
		if (filterMod && modId !== filterMod) continue;
		let i = text.indexOf("{", m.index), depth = 0, end = -1;
		for (; i < text.length; i++) {
			if (text[i] === "{") depth++;
			else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
		}
		const block = text.slice(m.index, end + 1);
		const paths = [];
		const re2 = /varPath:\s*"([^"]+)"/g;
		let m2;
		while ((m2 = re2.exec(block))) paths.push(m2[1]);
		out[modId] = paths;
	}
	return out;
}

/* ---------- 2. 原版顶层键清单（03-global.js 数组字面量解析） ---------- */
function extractVanillaRoots() {
	const text = fs.readFileSync(GLOBAL_SRC, "utf8");
	const start = text.indexOf("ORIGINAL_V_ROOT_KEYS = [");
	if (start === -1) return [];
	const end = text.indexOf("];", start);
	const arrText = text.slice(text.indexOf("[", start), end + 1);
	const re = /"([^"]+)"/g;
	const out = [];
	let m;
	while ((m = re.exec(arrText))) out.push(m[1]);
	return out;
}

/* ---------- 3. 收集源码文件 ---------- */
function collectFiles(dir) {
	const out = [];
	(function walk(d) {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (/\.(twee|js|ts)$/i.test(e.name)) out.push(p);
		}
	})(dir);
	return out;
}

/* ---------- 4. 扫描引用（根级聚合，保留示例行） ---------- */
function scanRefs(files) {
	const refs = new Map(); // root -> { count, paths:Set, examples:[], isSetup }
	function bump(root, fullPath, file, lineText, isSetup) {
		if (!refs.has(root)) refs.set(root, { count: 0, paths: new Set(), examples: [], isSetup: !!isSetup });
		const r = refs.get(root);
		r.count++;
		if (fullPath) r.paths.add(fullPath);
		if (r.examples.length < 3) {
			const short = lineText.replace(/\s+/g, " ").trim();
			r.examples.push(path.basename(file) + ":" + short.slice(0, 90));
		}
	}
	const reTwee = /\$([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g;
	const reJs = /\bV\.([A-Za-z_][A-Za-z0-9_]*)(?:\.[A-Za-z_][A-Za-z0-9_]*)*|setup\.([A-Za-z_][A-Za-z0-9_]*)/g;
	let skippedTmp = 0; // $_xxx 私有临时变量（Twine 每段作用域独立、不落存档，非声明候选）
	for (const f of files) {
		const text = fs.readFileSync(f, "utf8");
		const lines = text.split("\n");
		let m;
		reTwee.lastIndex = 0;
		while ((m = reTwee.exec(text))) {
			// twee 里 $xxx 即 V.xxx；$ 后直接 _ 开头是私有临时变量（_args/_tmp 等），不落存档
			const root = m[1];
			if (root.charAt(0) === "_") { skippedTmp++; continue; }
			const lineNo = text.slice(0, m.index).split("\n").length;
			const fullPath = m[0].slice(1);
			bump(root, fullPath, f, lines[lineNo - 1], false);
		}
		reJs.lastIndex = 0;
		while ((m = reJs.exec(text))) {
			const isSetup = !!m[2];
			const root = m[1] || m[2];
			if (root.charAt(0) === "_") { skippedTmp++; continue; }
			const lineNo = text.slice(0, m.index).split("\n").length;
			bump(root, null, f, lines[lineNo - 1], isSetup);
		}
	}
	return { refs, skippedTmp };
}

/* ---------- 5. 汇总 ---------- */
const adapterPaths = extractAdapterPaths();
const vanillaSet = new Set(extractVanillaRoots());
const files = collectFiles(srcDir);
const { refs, skippedTmp } = scanRefs(files);

const declaredRoots = new Set();
for (const modId of Object.keys(adapterPaths)) {
	for (const p of adapterPaths[modId]) declaredRoots.add(p.split(".")[0]);
}
// 面板自身根 / 框架根（不计入候选）
const selfRoots = new Set(["mbCE", "MapleBirchCE", "maplebirch", "MCEMod"]);

const declared = [], candidates = [], unseen = [];
for (const modId of Object.keys(adapterPaths)) {
	for (const p of adapterPaths[modId]) {
		let seen = false;
		for (const r of refs.values()) {
			for (const fp of r.paths) {
				if (fp === p || fp.startsWith(p + ".") || p.startsWith(fp + ".")) { seen = true; break; }
			}
			if (seen) break;
		}
		if (!seen) unseen.push({ modId, varPath: p });
	}
}
for (const [root, r] of refs) {
	if (r.isSetup) continue; // setup.* 是原版共享对象（clothes/colours 等），非 V 变量声明，不计入
	if (declaredRoots.has(root)) { declared.push({ root, count: r.count, paths: [...r.paths].slice(0, 6), examples: r.examples }); continue; }
	if (vanillaSet.has(root) || selfRoots.has(root)) continue;
	candidates.push({ root, count: r.count, paths: [...r.paths].slice(0, 6), examples: r.examples });
}

/* ---------- 6. 输出 ---------- */
function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
console.log("===== 模组变量引用扫描: " + srcDir + " =====");
console.log("文件数: " + files.length + " | 引用根数: " + refs.size + "（已过滤 Twine 私有临时变量 " + skippedTmp + " 个） | 适配器: " + (filterMod || "全部(" + Object.keys(adapterPaths).length + ")"));
console.log("");
console.log("[已声明] " + declared.length + " 个根（源码引用 & 适配器命中）");
for (const d of declared) {
	console.log("  " + pad(d.root, 24) + " ×" + d.count + "  " + d.paths.slice(0, 3).join(" / "));
}
console.log("");
console.log("[未声明·候选补录] " + candidates.length + " 个根（非原版/非自身/未声明）");
for (const c of candidates) {
	console.log("  " + pad(c.root, 24) + " ×" + c.count);
	for (const ex of c.examples) console.log("      " + ex);
}
console.log("");
console.log("[声明但源码未见] " + unseen.length + " 条（动态键/别名访问，用 resolve_missing 复核）");
for (const u of unseen) {
	console.log("  " + pad(u.varPath, 30) + " 适配器: " + u.modId);
}
