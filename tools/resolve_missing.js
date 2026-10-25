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

/* 判定常量（v1.8.6 review：替代魔法字符串） */
const KEEP = "KEEP", REVIEW = "REVIEW", REMOVE = "REMOVE";

const ROOT = path.join(__dirname, "..");
const ADAPTER_SRC = path.join(ROOT, "javascript", "src", "04a-modcheat-adapters.js");

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

/* ---------- 4. 单条 varPath 证据搜集（结构化：{file, line, text}） ---------- */
function gatherEvidence(files, vp) {
	const parts = vp.split(".");
	const leaf = parts[parts.length - 1];
	const parent = parts.slice(0, -1).join(".");
	const litRe = new RegExp("(?:V|\\$)\\." + (parent ? esc(parent) + "\\.\\s*" : "") + esc(leaf) + "\\b", "g");
	/* Twee/SugarCube 形态：$leaf（单段无点）与 $parent.leaf（多段）——twee 中 $x 即 V.x。
	   单段键此前只会生成 "(?:V|\$)\.\.leaf"（双点）且漏掉无点 $leaf，导致真实键被误判 REMOVE。 */
	const tweeRe = new RegExp("\\$\\s*" + (parent ? esc(parent) + "\\.\\s*" : "") + esc(leaf) + "\\b", "g");
	const concatRe = new RegExp("\\b" + esc(parent) + "\\.\\s*" + esc(leaf) + "\\b", "g");
	const stateRe = new RegExp("(?:this\\.)?state\\.(?:[A-Za-z_][A-Za-z0-9_]*\\.)*\\s*" + esc(leaf) + "\\b", "g");
	const strRe = new RegExp("[\"']\\s*" + esc(leaf) + "\\s*[\"']", "g");
	// 动态键：obj[xx.id] 或 obj[_ordinand].leaf（方括号变量 + 后缀 .leaf）
	const dynRe = new RegExp("\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\.id\\s*\\]|\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\]\\s*\\.\\s*" + esc(leaf), "g");

	function hit(re, text) {
		const m = re.exec(text);
		if (!m) return null;
		const line = text.slice(0, m.index).split("\n").length;
		let lineText = text.split("\n")[line - 1];
		if (lineText && lineText.length > 96) lineText = lineText.slice(0, 96) + "…";
		return { file: null, line, text: lineText || "" };
	}
	const ev = { literal: [], concat: [], state: [], stringKey: [], dynamic: [] };
	function pushHit(arr, f, text, idx) {
		const line = text.slice(0, idx).split("\n").length;
		const lineText = text.split("\n")[line - 1] || "";
		/* 截断时优先保留匹配词附近（前 96 字符可能不含目标词，误导人工核对） */
		const st = Math.max(0, idx - (idx - text.lastIndexOf("\n", idx - 1) - 1) - 24);
		const snip = lineText.length > 96 ? "…" + lineText.slice(Math.max(0, st), st + 96) : lineText;
		arr.push({ file: f, line, text: snip.slice(0, 120) });
	}
	for (const f of files) {
		const text = fs.readFileSync(f, "utf8");
		let m;
		const litReG = new RegExp(litRe.source, "g"); while ((m = litReG.exec(text))) pushHit(ev.literal, f, text, m.index);
		const tweeReG = new RegExp(tweeRe.source, "g"); while ((m = tweeReG.exec(text))) pushHit(ev.literal, f, text, m.index);
		const concatReG = new RegExp(concatRe.source, "g"); while ((m = concatReG.exec(text))) pushHit(ev.concat, f, text, m.index);
		const stateReG = new RegExp(stateRe.source, "g"); while ((m = stateReG.exec(text))) pushHit(ev.state, f, text, m.index);
		const strReG = new RegExp(strRe.source, "g"); while ((m = strReG.exec(text))) pushHit(ev.stringKey, f, text, m.index);
		const dynReG = new RegExp(dynRe.source, "g"); while ((m = dynReG.exec(text))) pushHit(ev.dynamic, f, text, m.index);
	}
	return { leaf, parent, ev };
}

/* 证据格式化：file:line: text（每类最多 3 条） */
function fmtEv(arr) {
	return arr.slice(0, 3).map((h) => h.file + ":" + h.line + ": " + (h.text || "")).join("  |  ");
}

/* ---------- 5. 判定 ---------- */
function classify(files, vp) {
	const { leaf, parent, ev } = gatherEvidence(files, vp);
	const root = vp.split(".")[0];

	// ① 字面完整路径
	if (ev.literal.length > 0)
		return { vp, verdict: KEEP, why: "字面命中：源码存在 V/" + vp + "（" + ev.literal.length + " 处）", evidence: fmtEv(ev.literal) };

	// ② 连写访问（twee 别名 / 直接对象访问）
	if (ev.concat.length > 0)
		return { vp, verdict: KEEP, why: "连写访问命中：" + parent + "." + leaf + "（别名形态，" + ev.concat.length + " 处）", evidence: fmtEv(ev.concat) };

	// ③ 父根定义块内 leaf: 类型/默认值（interface/type 前缀名或对象字面量，任一块命中）
	if (findLeafDefBlock(files, root, leaf))
		return { vp, verdict: KEEP, why: "状态结构定义存在：" + root + " 定义块内 leaf: 类型/默认值", evidence: root + " 定义块（interface/type/对象字面量）命中" };

	// ④ this.state.leaf —— 属主校验
	if (ev.state.length > 0) {
		const ownerOk = ev.state.some((h) => stateOwnerMatches(h.file, root));
		if (ownerOk) {
			const why = "this.state." + leaf + " 命中且 state 绑定属主含 " + root + "（别名盲区，" + ev.state.length + " 处）";
			return { vp, verdict: KEEP, why: why, evidence: fmtEv(ev.state) };
		}
		// 属主不符 → 父根模块目录复查
		if (moduleDirHasLeaf(files, root, leaf)) {
			const why = "this.state." + leaf + " 属主非 " + root + "，但模块目录内存在 " + leaf + "，疑似有效建议复核";
			return { vp: vp, verdict: REVIEW, why: why, evidence: fmtEv(ev.state) };
		}
		const why = "属主非 " + root + " 且模块目录内零出现 " + leaf + "：真缺失（模组删除/改名该字段）";
		return { vp: vp, verdict: REMOVE, why: why, evidence: fmtEv(ev.state) };
	}

	// ⑤ 叶子键字符串 / 动态键形态
	if (ev.stringKey.length > 0 || ev.dynamic.length > 0) {
		const evStr = fmtEv(ev.stringKey), evDyn = fmtEv(ev.dynamic);
		if (ev.stringKey.length > 0 && ev.dynamic.length > 0) {
			// 动态键读写对闭合：leaf 字符串定义（配置/数组字面量）+ obj[var].leaf 访问并存 → 键存活
			const why = "动态键读写对闭合：leaf 字符串定义（" + ev.stringKey.length + " 处）与 obj[var].leaf 访问（" + ev.dynamic.length + " 处）并存 → 键存活";
			return { vp, verdict: KEEP, why: why, evidence: evStr + "  ||  " + evDyn };
		}
		const why = "叶子键 " + leaf + " 以字符串/动态键形态存在（" + (ev.stringKey.length + ev.dynamic.length) + " 处），声明保留建议复核";
		return { vp, verdict: REVIEW, why: why, evidence: (evStr ? evStr : "") + (evStr && evDyn ? "  ||  " : "") + evDyn };
	}

	// ⑥ 零证据
	return { vp, verdict: REMOVE, why: "零证据：源码中未出现 " + leaf + " 的任何形态，真缺失（模组删除/改名该字段）", evidence: "" };
}

/* ---------- main ---------- */
function main() {
	const args = process.argv.slice(2);
	const jsonMode = args.indexOf("--json") !== -1;
	const modId = jsonMode ? args[0] : args[0];
	const srcDir = jsonMode ? args[1] : args[1];
	if (!modId || !srcDir) { console.error("用法：node tools/resolve_missing.js <适配器id> <模组源码目录> [--json]"); process.exit(1); }
	if (!fs.existsSync(srcDir)) { console.error("源码目录不存在: " + srcDir); process.exit(1); }

	const files = collectFiles(srcDir);
	const varPaths = extractVarPaths(modId);
	const results = [];
	for (const vp of varPaths) {
		const r = classify(files, vp);
		results.push(r);
	}

	if (jsonMode) {
		/* 机器可读：供自动化流水线消费（后续可直接按 verdict 批量改 04a-modcheat-adapters.js） */
		const out = {
			adapter: modId, srcDir, declared: varPaths.length, files: files.length,
			results: results.map((r) => ({ verdict: r.verdict, vp: r.vp, why: r.why, evidence: r.evidence || "" }))
		};
		console.log(JSON.stringify(out, null, 2));
		return;
	}

	console.log("===== resolve_missing.js 缺失条目自动定案：适配器 " + modId + " vs " + srcDir + " =====");
	console.log("声明 varPath " + varPaths.length + " 条，源码文件 " + files.length + " 个\n");
	for (const r of results) {
		console.log("[" + r.verdict + "] " + r.vp);
		console.log("     " + r.why);
		if (r.evidence) console.log("     ↳ " + r.evidence);
	}

	console.log("\n===== 汇总（建议动作） =====");
	const grp = (v) => results.filter((r) => r.verdict === v).map((r) => r.vp).join(" | ");
	console.log("KEEP   " + (grp("KEEP") || "（无）"));
	console.log("REVIEW " + (grp("REVIEW") || "（无）"));
	console.log("REMOVE " + (grp("REMOVE") || "（无）"));
}

main();
