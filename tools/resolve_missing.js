#!/usr/bin/env node
/* ============================================================================
 * resolve_missing.js — 适配器缺失条目自动定案
 *
 * 用法：node tools/resolve_missing.js <适配器id> <模组源码目录>
 *
 * 解决什么问题：audit_adapters.js 是字面正则扫描，`this.state.xxx`、twee 别名
 * （_alias.xxx）、动态键（obj[_cheatSchoolField.id] / obj[_ordinand].field）等
 * 访问形态扫不到，会误报"声明缺失"。本脚本对每条 varPath 搜证据自动判定：
 *
 *   1. 字面完整路径（V.$root.path / $root.path）        → KEEP（audit 误报）
 *   2. 连写访问（parent.leaf，含 _alias.leaf）           → KEEP（别名假报）
 *   3. 父根定义块内 leaf: 类型/默认值（interface/type/对象字面量）→ KEEP（结构定义存在）
 *   4. this.state.leaf 且 state 绑定属主含父根           → KEEP（别名盲区）
 *   5. this.state.leaf 属主非父根 → 父根模块目录内 leaf 复查：
 *        模块内有其它形态 → REVIEW（疑似有效，建议复核）
 *        模块内零出现      → REMOVE（真缺失：模组删除/改名）
 *   6. 叶子键字符串 / 动态键形态                          → REVIEW（声明保留，建议复核）
 *   7. 以上全无                                         → REMOVE（零证据真缺失）
 *
 * 判定原则：宁可"存在"不误删。REMOVE 只给"零证据"或"属主不符+模块内零出现"。
 * 输出：每缺失条目一行判定 + 汇总建议动作（KEEP / REVIEW / REMOVE）。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ADAPTER_SRC = path.join(ROOT, "javascript", "src", "04-modcheat.js");

/* ---------- 1. 提取适配器全部 varPath ---------- */
function extractVarPaths(modId) {
	const text = fs.readFileSync(ADAPTER_SRC, "utf8");
	const key = `CHEAT_ADAPTERS["${modId}"]`;
	const start = text.indexOf(key);
	if (start === -1) throw new Error("适配器未找到: " + modId);
	let i = text.indexOf("{", start), depth = 0, end = -1;
	for (; i < text.length; i++) {
		if (text[i] === "{") depth++;
		else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
	}
	const block = text.slice(start, end + 1);
	const paths = [];
	const re = /varPath:\s*"([^"]+)"/g;
	let m;
	while ((m = re.exec(block))) paths.push(m[1]);
	return paths;
}

/* ---------- 2. 收集源码文件 ---------- */
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

/* ---------- 3. 工具 ---------- */
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/* 该文件内 this.state 绑定是否属于 parentRoot（如 LifeSimulation / RobinTemple） */
function stateOwnerMatches(absFile, parentRoot) {
	const text = fs.readFileSync(absFile, "utf8");
	// 形态：get state(): Type { return V.X } / get state(): Type { V.X } / this.state = V.X / state = V.X
	const re = /(?:get\s+state\s*\(\s*\)\s*:?\s*[A-Za-z_][A-Za-z0-9_.<>[\]]*\s*\{|this\.state\s*=|state\s*=\s*)(?:\s*return\s+)?\s*V\.([A-Za-z_][A-Za-z0-9_.]*)/g;
	let m;
	while ((m = re.exec(text))) {
		if (m[1] === parentRoot || m[1].startsWith(parentRoot + ".")) return true;
	}
	return false;
}

/* 任一 root 前缀定义块（interface/type <root>Xxx / <root>: { / <root> = {）内含 leaf: 类型/默认值 */
function findLeafDefBlock(files, root, leaf) {
	const defRe = new RegExp("\\b" + esc(leaf) + "\\s*:\\s*(?:boolean|number|string|true|false|'|\"|\\d)", "g");
	for (const f of files) {
		const text = fs.readFileSync(f, "utf8");
		const re = new RegExp("(?:interface|type)\\s+" + esc(root) + "[A-Za-z0-9_]*\\b|\\b" + esc(root) + "\\s*[:=]\\s*\\{", "g");
		let m;
		while ((m = re.exec(text))) {
			const i = text.indexOf("{", m.index);
			if (i === -1) continue;
			let depth = 0, end = -1;
			for (let j = i; j < text.length; j++) {
				if (text[j] === "{") depth++;
				else if (text[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
			}
			if (end !== -1 && defRe.test(text.slice(i, end + 1))) return true;
		}
	}
	return false;
}

/* 父根模块目录内（目录名含 root）是否出现 leaf 任意形态 */
function moduleDirHasLeaf(files, parentRoot, leaf) {
	const dirRe = new RegExp("(?:^|[\\\\/])" + esc(parentRoot) + "[\\\\/]");
	const anyRe = new RegExp("\\b" + esc(leaf) + "\\b");
	for (const f of files) {
		if (!dirRe.test(f)) continue;
		if (anyRe.test(fs.readFileSync(f, "utf8"))) return true;
	}
	return false;
}

/* ---------- 4. 单条 varPath 证据搜集 ---------- */
function gatherEvidence(files, vp) {
	const parts = vp.split(".");
	const leaf = parts[parts.length - 1];
	const parent = parts.slice(0, -1).join(".");
	const litRe = new RegExp("(?:V|\\$)\\." + esc(parent) + "\\.\\s*" + esc(leaf) + "\\b", "g");
	const concatRe = new RegExp("\\b" + esc(parent) + "\\.\\s*" + esc(leaf) + "\\b", "g");
	const stateRe = new RegExp("(?:this\\.)?state\\.(?:[A-Za-z_][A-Za-z0-9_]*\\.)*\\s*" + esc(leaf) + "\\b", "g");
	const strRe = new RegExp("[\"']\\s*" + esc(leaf) + "\\s*[\"']", "g");
	// 动态键：obj[xx.id] 或 obj[_ordinand].leaf（方括号变量 + 后缀 .leaf）
	const dynRe = new RegExp("\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\.id\\s*\\]|\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\]\\s*\\.\\s*" + esc(leaf), "g");

	const ev = { literal: [], concat: [], state: [], stringKey: [], dynamic: [] };
	for (const f of files) {
		const text = fs.readFileSync(f, "utf8");
		let m;
		const litReG = new RegExp(litRe.source, "g"); while ((m = litReG.exec(text))) ev.literal.push(f + ":" + (m.index + 1));
		const concatReG = new RegExp(concatRe.source, "g"); while ((m = concatReG.exec(text))) ev.concat.push(f + ":" + (m.index + 1));
		const stateReG = new RegExp(stateRe.source, "g"); while ((m = stateReG.exec(text))) ev.state.push(f + ":" + (m.index + 1));
		const strReG = new RegExp(strRe.source, "g"); while ((m = strReG.exec(text))) ev.stringKey.push(f + ":" + (m.index + 1));
		const dynReG = new RegExp(dynRe.source, "g"); while ((m = dynReG.exec(text))) ev.dynamic.push(f + ":" + (m.index + 1));
	}
	return { leaf, parent, ev };
}

/* ---------- 5. 判定 ---------- */
function classify(files, vp) {
	const { leaf, parent, ev } = gatherEvidence(files, vp);
	const root = vp.split(".")[0];

	// ① 字面完整路径
	if (ev.literal.length > 0)
		return { vp, verdict: "KEEP", why: "字面命中：源码存在 V/" + vp + "（" + ev.literal.length + " 处）" };

	// ② 连写访问（twee 别名 / 直接对象访问）
	if (ev.concat.length > 0)
		return { vp, verdict: "KEEP", why: "连写访问命中：" + parent + "." + leaf + "（别名形态，" + ev.concat.length + " 处）" };

	// ③ 父根定义块内 leaf: 类型/默认值（interface/type 前缀名或对象字面量，任一块命中）
	if (findLeafDefBlock(files, root, leaf))
		return { vp, verdict: "KEEP", why: "状态结构定义存在：" + root + " 定义块内 leaf: 类型/默认值" };

	// ④ this.state.leaf —— 属主校验
	if (ev.state.length > 0) {
		const ownerOk = ev.state.some((h) => {
			const idx = h.lastIndexOf(":");
			return stateOwnerMatches(h.slice(0, idx), root);
		});
		if (ownerOk) {
			const why = "this.state." + leaf + " 命中且 state 绑定属主含 " + root + "（别名盲区，" + ev.state.length + " 处）";
			return { vp: vp, verdict: "KEEP", why: why };
		}
		// 属主不符 → 父根模块目录复查
		if (moduleDirHasLeaf(files, root, leaf)) {
			const why = "this.state." + leaf + " 属主非 " + root + "，但模块目录内存在 " + leaf + "，疑似有效建议复核";
			return { vp: vp, verdict: "REVIEW", why: why };
		}
		const why = "属主非 " + root + " 且模块目录内零出现 " + leaf + "：真缺失（模组删除/改名该字段）";
		return { vp: vp, verdict: "REMOVE", why: why };
	}

	// ⑤ 叶子键字符串 / 动态键形态
	if (ev.stringKey.length > 0 || ev.dynamic.length > 0)
		return { vp, verdict: "REVIEW", why: "叶子键 " + leaf + " 以字符串/动态键形态存在（配置数组或 obj[xx] 访问，" + (ev.stringKey.length + ev.dynamic.length) + " 处），声明保留建议复核" };

	// ⑥ 零证据
	return { vp, verdict: "REMOVE", why: "零证据：源码中未出现 " + leaf + " 的任何形态，真缺失（模组删除/改名该字段）" };
}

/* ---------- main ---------- */
function main() {
	const modId = process.argv[2];
	const srcDir = process.argv[3];
	if (!modId || !srcDir) { console.error("用法：node tools/resolve_missing.js <适配器id> <模组源码目录>"); process.exit(1); }
	if (!fs.existsSync(srcDir)) { console.error("源码目录不存在: " + srcDir); process.exit(1); }

	const files = collectFiles(srcDir);
	const varPaths = extractVarPaths(modId);
	console.log("===== resolve_missing.js 缺失条目自动定案：适配器 " + modId + " vs " + srcDir + " =====");
	console.log("声明 varPath " + varPaths.length + " 条，源码文件 " + files.length + " 个\n");

	const results = [];
	for (const vp of varPaths) {
		const r = classify(files, vp);
		results.push(r);
		console.log("[" + r.verdict + "] " + r.vp);
		console.log("     " + r.why);
	}

	console.log("\n===== 汇总（建议动作） =====");
	const grp = (v) => results.filter((r) => r.verdict === v).map((r) => r.vp).join(" | ");
	console.log("KEEP   " + (grp("KEEP") || "（无）"));
	console.log("REVIEW " + (grp("REVIEW") || "（无）"));
	console.log("REMOVE " + (grp("REMOVE") || "（无）"));
}

main();
