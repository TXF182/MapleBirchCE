#!/usr/bin/env node
/* ============================================================================
 * resolve_missing.js — 适配器缺失条目自动定案
 *
 * 用法：node tools/resolve_missing.js <适配器id> <模组源码目录> [--json]
 *
 * 解决什么问题：audit_adapters.js 是字面正则扫描，`this.state.xxx`、twee 别名
 * （_alias.xxx）、动态键（obj[_cheatSchoolField.id] / obj[_ordinand].field）等
 * 访问形态扫不到，会误报"声明缺失"。本脚本对每条 varPath 搜证据自动判定。
 *
 * 判定顺序（v1.9.31 增补 ③-5 / ⑤-3 / ⑥，其余与历史口径一致）：
 *   ① 字面完整路径 / twee $path                    → KEEP
 *   ② 连写访问（parent.leaf，含 _alias.leaf）       → KEEP
 *   ③ 父根定义块内 leaf: 类型/默认值                → KEEP
 *   ④ this.state.leaf 且 state 绑定属主含父根       → KEEP
 *   ③-5 属主归位：state 属主即本 root 的文件内出现相对路径 parentTail.leaf
 *        （如 Robin.ts 里 `investment.agreed = true` 归位为
 *          RobinExpansion.investment.agreed）        → KEEP
 *   ⑤ this.state.leaf 属主非父根 → 父根模块目录复查：
 *        模块内有其它形态 → REVIEW / 模块内零出现 → REMOVE
 *   ⑤-3 动态键两侧闭合：代码有 `['<prefix>' + …]` 拼接，且数据侧（json 键/值）
 *        存在该余部枚举值（如 featsBoosts 的 deadwood- + boosts 的 attribute）
 *                                                    → KEEP_DYNAMIC
 *   ⑥ 叶子键字符串/动态键形态：
 *        命中行邻近出现父段（±3 行）                 → REVIEW（中等证据）
 *        仅远处出现（常见词噪声）                    → WEAK（证据不足，禁止当 KEEP）
 *   ⑦ 根的命名空间在被测源码中零出现                 → SOURCE_MISMATCH（核错源）
 *   ⑧ 以上全无                                      → REMOVE
 *
 * 判定原则：宁可"存在"不误删。REMOVE 只给"零证据"或"属主不符+模块内零出现"。
 * WEAK 与 SOURCE_MISMATCH 都不是删除信号，是"这个结论不可信，去看/换源"的告警。
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const kk = require("./lib/keycheck.js");

/* 判定常量（v1.8.6 review：替代魔法字符串；v1.9.31 增补分级值） */
const KEEP = "KEEP", REVIEW = "REVIEW", REMOVE = "REMOVE";
const KEEP_DYNAMIC = kk.KEEP_DYNAMIC, WEAK = kk.WEAK, SOURCE_MISMATCH = kk.SOURCE_MISMATCH;

const ROOT = path.join(__dirname, "..");
/* 适配器声明自 v1.9.13 起按模组拆分（src/04a-00-core.js + 04a-01..11-*.js），
   此处读目录下全部 04a-*.js 拼接后按块提取（与 build_js.js sort 顺序一致） */
const ADAPTER_DIR = path.join(ROOT, "javascript", "src");

/* ---------- 1. 提取适配器全部 varPath ---------- */
function extractVarPaths(modId) {
	const text = fs.readdirSync(ADAPTER_DIR).filter(f => /^04a-.*\.js$/.test(f)).sort()
		.map(f => fs.readFileSync(path.join(ADAPTER_DIR, f), "utf8")).join("\n");
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

/* ---------- 2. 收集源码文件（含 json：动态键的"数据侧枚举"只存在于数据文件） ---------- */
function collectFiles(dir) {
	const out = [];
	(function walk(d) {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (/\.(twee|js|ts|json)$/i.test(e.name)) out.push(p);
		}
	})(dir);
	return out;
}

/* ---------- 3. 工具 ---------- */
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/* 文件文本缓存（同一文件被多条 varPath 反复读，缓存可把 O(条数×文件) 降到 O(文件)） */
const TEXT_CACHE = new Map();
function readText(f) {
	if (!TEXT_CACHE.has(f)) TEXT_CACHE.set(f, fs.readFileSync(f, "utf8"));
	return TEXT_CACHE.get(f);
}
const OWNER_CACHE = new Map();
function stateOwnerCache(absFile, parentRoot) {
	const k = absFile + "\u0000" + parentRoot;
	if (!OWNER_CACHE.has(k)) {
		const text = readText(absFile);
		// 形态：get state(): Type { return V.X } / get state(): Type { V.X } / this.state = V.X / state = V.X
		const re = /(?:get\s+state\s*\(\s*\)\s*:?\s*[A-Za-z_][A-Za-z0-9_.<>[\]]*\s*\{|this\.state\s*=|state\s*=\s*)(?:\s*return\s+)?\s*V\.([A-Za-z_][A-Za-z0-9_.]*)/g;
		let m, ok = false;
		while ((m = re.exec(text))) {
			if (m[1] === parentRoot || m[1].startsWith(parentRoot + ".")) { ok = true; break; }
		}
		OWNER_CACHE.set(k, ok);
	}
	return OWNER_CACHE.get(k);
}
function stateOwnerMatches(absFile, parentRoot) { return stateOwnerCache(absFile, parentRoot); }

/* 该文件内 this.state 绑定是否属于 parentRoot（如 LifeSimulation / RobinTemple） */
/* 任一 root 前缀定义块（interface/type <root>Xxx / <root>: { / <root> = {）内含 leaf: 类型/默认值 */
function findLeafDefBlock(files, root, leaf) {
	const defRe = new RegExp("\\b" + esc(leaf) + "\\s*:\\s*(?:boolean|number|string|true|false|'|\"|\\d)", "g");
	for (const f of files) {
		const text = readText(f);
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
		if (anyRe.test(readText(f))) return true;
	}
	return false;
}

/* 属主归位：去掉 root 后的相对路径在"属主就是本 root"的上下文里被读写。
   两档：①同文件 state 绑定属主 == root；②该文件里出现 root 的类型名（RobinExpansionState 等）
   或文件路径含 root —— 覆盖 migrations/Robin.ts 这种 `const state = data as RobinExpansionState`
   之后直接写 `investment.agreed = true`（无 V. 前缀）的形态。 */
function ownerRelocatedHit(files, vp, root) {
	const rest = vp.split(".").slice(1);
	if (!rest.length) return null;
	const relRe = new RegExp(rest.map(esc).join("\\.\\s*") + "\\b");
	const typeRe = new RegExp("\\b" + esc(root) + "[A-Za-z0-9_]*\\b");
	const pathRe = new RegExp(esc(root), "i");
	for (const f of files) {
		const ownsHere = stateOwnerMatches(f, root) || typeRe.test(readText(f)) || pathRe.test(f);
		if (!ownsHere) continue;
		const text = readText(f);
		const m = relRe.exec(text);
		if (!m) continue;
		/* 排除该命中只是字符串字面量（引号包裹的配置项），那是"数据"不是"状态访问" */
		const prev = text[m.index - 1];
		if (prev === "'" || prev === "\"") continue;
		const line = text.slice(0, m.index).split("\n").length;
		const lineText = (text.split("\n")[line - 1] || "").trim().slice(0, 120);
		return { file: f, line, text: lineText };
	}
	return null;
}

/* 命名空间是否在本源码出现过（V.root / $.root / root: { 三种真实形态） */
function rootAppears(files, root) {
	const re = new RegExp("(?:\\bV\\.|\\$)" + esc(root) + "\\b|\\b" + esc(root) + "\\s*[:=]\\s*\\{");
	for (const f of files) if (re.test(readText(f))) return true;
	return false;
}

/* 动态键两侧证据：代码侧前缀拼接 + 数据侧枚举值（json 键/值） */
function harvestDynamics(files) {
	const prefixes = new Set(), enums = new Set();
	for (const f of files) {
		const text = readText(f);
		let m;
		const dynRe = /\[['"]([A-Za-z0-9_$-]+)['"]\s*\+/g;
		while ((m = dynRe.exec(text)) !== null) prefixes.add(m[1]);
		if (/\.json$/i.test(f)) {
			const valRe = /":\s*"([A-Za-z0-9_-]{2,40})"/g;
			while ((m = valRe.exec(text)) !== null) enums.add(m[1]);
			const keyRe = /"([A-Za-z0-9_-]{2,40})"\s*:/g;
			while ((m = keyRe.exec(text)) !== null) enums.add(m[1]);
		}
	}
	return { prefixes, enums };
}

/* 字符串命中是否贴近父段（±3 行内含父段任一片段）——区分"真证据"与"常见词噪声" */
const LINES_CACHE = new Map();
function linesOf(f) {
	if (!LINES_CACHE.has(f)) LINES_CACHE.set(f, readText(f).split("\n"));
	return LINES_CACHE.get(f);
}
function nearParent(hit, innerSegs) {
	if (!innerSegs.length) return false;
	const lines = linesOf(hit.file);
	const from = Math.max(1, hit.line - 3), to = Math.min(lines.length, hit.line + 3);
	const block = lines.slice(from - 1, to).join("\n");
	return innerSegs.some((s) => block.includes(s));
}

/* 数字下标段改写为方括号形态（keycheck.bracketize），供字面匹配的 parent 备选形态使用。 */
const bracketize = kk.bracketize;

/* ---------- 4. 单条 varPath 证据搜集（结构化：{file, line, text}） ---------- */
function gatherEvidence(files, vp) {
	const parts = vp.split(".");
	const leaf = parts[parts.length - 1];
	const parent = parts.slice(0, -1).join(".");
	const parentAlts = parent ? Array.from(new Set([esc(parent), esc(bracketize(parent))])) : [""];
	const parentPat = parent ? "(" + parentAlts.join("|") + ")\\.\\s*" : "";
	const litRe = new RegExp("(?:V|\\$)\\." + parentPat + esc(leaf) + "\\b", "g");
	/* Twee/SugarCube 形态：$leaf（单段无点）与 $parent.leaf（多段）——twee 中 $x 即 V.x。
	   单段键此前只会生成 "(?:V|\$)\.\.leaf"（双点）且漏掉无点 $leaf，导致真实键被误判 REMOVE。 */
	const tweeRe = new RegExp("\\$\\s*" + parentPat + esc(leaf) + "\\b", "g");
	const concatRe = new RegExp("\\b" + parentPat + esc(leaf) + "\\b", "g");
	const stateRe = new RegExp("(?:this\\.)?state\\.(?:[A-Za-z_][A-Za-z0-9_]*\\.)*\\s*" + esc(leaf) + "\\b", "g");
	const strRe = new RegExp("[\"']\\s*" + esc(leaf) + "\\s*[\"']", "g");
	// 动态键：obj[xx.id] 或 obj[_ordinand].leaf（方括号变量 + 后缀 .leaf）
	const dynRe = new RegExp("\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\.id\\s*\\]|\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\]\\s*\\.\\s*" + esc(leaf), "g");

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
		const text = readText(f);
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
function shortFile(f) { return path.basename(f); }
function fmtEvShort(arr) {
	return arr.slice(0, 3).map((h) => shortFile(h.file) + ":" + h.line + ": " + (h.text || "")).join("  |  ");
}

/* ⑤-5 后缀拼接取证：源码存在 V[<变量> + "_suffix"]，且 vp 的头部在枚举里
   枚举头来源有两处：数据侧枚举（json 键/值）+ 代码侧字符串数组（如 CityMod.STUDY_KEYS = ["science", …]）
   —— 后者不进 dynCtx.enums，早期只认前者导致 dolmod 4 条 exam 键被误判「核错源」。 */
function findSuffixConcat(files, leaf, enums) {
	for (let i = 1; i < leaf.length; i++) {
		const head = leaf.slice(0, i), suffix = leaf.slice(i);
		if (!suffix) continue;
		let headOk = enums.has(head);
		if (!headOk) {
			const headLit = new RegExp("[\"']" + esc(head) + "[\"']");
			headOk = files.some((f) => headLit.test(readText(f)));
		}
		if (!headOk) continue;
		const re = new RegExp("\\[\\s*[A-Za-z_$][A-Za-z0-9_$]*\\s*\\+\\s*[\"']" + esc(suffix) + "[\"']\\s*\\]", "g");
		const hits = [];
		for (const f of files) {
			const text = readText(f);
			let m;
			const g = new RegExp(re.source, "g");
			while ((m = g.exec(text))) {
				const line = text.slice(0, m.index).split("\n").length;
				hits.push({ file: f, line, text: (text.split("\n")[line - 1] || "").trim().slice(0, 120) });
			}
		}
		if (hits.length) return { head: head, suffix: suffix, hits: hits };
	}
	return null;
}

/* ⑤-6 父容器动态键取证：$<parent>[<表达式>] / V.<parent>[<表达式>]
   注意 SugarCube 写作 `$daily.xxx[...]`（$ 与标识符之间没有点），V 形态才有点，
   此前照搬 `(?:V|\$)\.` 导致 $ 形态全部漏命中。 */
function findParentIndexAccess(files, parent) {
	if (!parent) return [];
	const re = new RegExp("(?:\\bV\\.|\\$)" + esc(parent) + "\\s*\\[", "g");
	const hits = [];
	for (const f of files) {
		const text = readText(f);
		let m;
		const g = new RegExp(re.source, "g");
		while ((m = g.exec(text))) {
			const line = text.slice(0, m.index).split("\n").length;
			hits.push({ file: f, line, text: (text.split("\n")[line - 1] || "").trim().slice(0, 120) });
		}
	}
	return hits;
}

/* ---------- 5. 判定 ---------- */
function classify(files, vp, dynCtx) {
	const { leaf, parent, ev } = gatherEvidence(files, vp);
	const root = vp.split(".")[0];

	// ① 字面完整路径
	if (ev.literal.length > 0)
		return { vp, verdict: KEEP, why: "字面命中：源码存在 V/" + vp + "（" + ev.literal.length + " 处）", evidence: fmtEvShort(ev.literal) };

	// ② 连写访问（twee 别名 / 直接对象访问）
	if (ev.concat.length > 0)
		return { vp, verdict: KEEP, why: "连写访问命中：" + parent + "." + leaf + "（别名形态，" + ev.concat.length + " 处）", evidence: fmtEvShort(ev.concat) };

	// ③ 父根定义块内 leaf: 类型/默认值（interface/type 前缀名或对象字面量，任一块命中）
	if (findLeafDefBlock(files, root, leaf))
		return { vp, verdict: KEEP, why: "状态结构定义存在：" + root + " 定义块内 leaf: 类型/默认值", evidence: root + " 定义块（interface/type/对象字面量）命中" };

	// ③-5 属主归位（state 属主就是本 root 时，相对路径即等价于完整路径）
	const reloc = ownerRelocatedHit(files, vp, root);
	if (reloc)
		return {
			vp, verdict: KEEP,
			why: "属主归位命中：" + shortFile(reloc.file) + " 的 state 绑定属主即 " + root + "，文件内相对路径 " + vp.split(".").slice(1).join(".") + " 存在",
			evidence: fmtEvShort([reloc])
		};

	// ⑤-5 后缀拼接：单段键 V[<枚举值> + "_后缀"]，枚举头来自数据数组，源码不会出现拼好的全名
	const sufConc = vp.indexOf(".") === -1 ? findSuffixConcat(files, leaf, dynCtx.enums) : null;
	if (sufConc)
		return {
			vp, verdict: KEEP_DYNAMIC,
			why: "后缀拼接闭合：源码以 V[<键> + '" + sufConc.suffix + "'] 拼接，枚举头 '" + sufConc.head + "' 存在于数据枚举（" + sufConc.hits.length + " 处）",
			evidence: fmtEvShort(sufConc.hits)
		};

	// ⑦ 命名空间零出现 —— 大概率核错了源（如框架键拿模组源码核）。
	//    位置在强证据（①②③③-5）之后、弱证据（④⑤⑥）之前：命名空间不在本源时，
	//    后面任何"字符串/state 出现过"的弱证据都不足以定案，只能报"换源核对"。
	if (!rootAppears(files, root)) {
		return {
			vp, verdict: SOURCE_MISMATCH,
			why: "根 " + root + " 在被测源码中零出现——该键大概率不由本源维护（核错源），不可据此判定删除",
			evidence: ""
		};
	}

	// ④ this.state.leaf —— 属主校验
	if (ev.state.length > 0) {
		const ownerOk = ev.state.some((h) => stateOwnerMatches(h.file, root));
		if (ownerOk) {
			const why = "this.state." + leaf + " 命中且 state 绑定属主含 " + root + "（别名盲区，" + ev.state.length + " 处）";
			return { vp, verdict: KEEP, why: why, evidence: fmtEvShort(ev.state) };
		}
		// 属主不符 → 父根模块目录复查
		if (moduleDirHasLeaf(files, root, leaf)) {
			const why = "this.state." + leaf + " 属主非 " + root + "，但模块目录内存在 " + leaf + "，疑似有效建议复核";
			return { vp: vp, verdict: REVIEW, why: why, evidence: fmtEvShort(ev.state) };
		}
		const why = "属主非 " + root + " 且模块目录内零出现 " + leaf + "：真缺失（模组删除/改名该字段）";
		return { vp: vp, verdict: REMOVE, why: why, evidence: fmtEvShort(ev.state) };
	}

	// ⑤-4 下标通配：vp 中间含数字下标段，且源码以「元素变量.leaf」形态访问该字段
	//      （SugarCube 里 <<each $plots.farm as _plantbed>> 后写 _plantbed.greenhouse，
	//       字面不会有 farm[1].greenhouse，但同族各下标共用同一字段）
	const idxSegs = kk.indexSegments(vp);
	if (idxSegs.length) {
		const elemHits = [];
		const elemRe = new RegExp("\\b([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\.\\s*" + esc(leaf) + "\\b", "g");
		for (const f of files) {
			const text = readText(f);
			let m;
			const g = new RegExp(elemRe.source, "g");
			while ((m = g.exec(text))) {
				if (m[1] === "V" || m[1] === "$" || m[1] === "this") continue; /* 根命名空间访问不算元素形态 */
				const line = text.slice(0, m.index).split("\n").length;
				elemHits.push({ file: f, line, text: (text.split("\n")[line - 1] || "").trim().slice(0, 120) });
			}
		}
		if (elemHits.length) {
			return {
				vp, verdict: KEEP_DYNAMIC,
				why: "下标通配：" + vp + " 的数字段由遍历元素持有，源码以「元素变量." + leaf + "」形态访问该字段（" + elemHits.length + " 处），同族下标共用",
				evidence: fmtEvShort(elemHits)
			};
		}
	}

	// ⑤-3 动态键两侧闭合（代码前缀 + 数据枚举），比"字符串出现过"强得多
	const dyn = kk.dynamicClosure(vp, Array.from(dynCtx.prefixes), dynCtx.enums);
	if (dyn && dyn.closed) {
		return {
			vp, verdict: KEEP_DYNAMIC,
			why: "动态键两侧闭合：代码有前缀 '" + dyn.prefix + "' 拼接，数据文件枚举含 '" + dyn.rest + "'",
			evidence: "prefix=" + dyn.prefix + "  enum=" + dyn.rest
		};
	}

	// ⑤-6 父容器动态键：$<parent>[<表达式>] 说明该对象是运行时键容器，子键不会字面出现
	if (parent) {
		const pIdx = findParentIndexAccess(files, parent);
		if (pIdx.length)
			return {
				vp, verdict: KEEP_DYNAMIC,
				why: "父容器动态键：源码以 $" + parent + "[<表达式>] 取值（" + pIdx.length + " 处），容器键由运行时决定，无法字面核对子键 " + leaf,
				evidence: fmtEvShort(pIdx)
			};
	}

	// ⑥ 叶子键字符串 / 动态键形态
	if (ev.stringKey.length > 0 || ev.dynamic.length > 0) {
		const evStr = fmtEvShort(ev.stringKey), evDyn = fmtEvShort(ev.dynamic);
		if (ev.stringKey.length > 0 && ev.dynamic.length > 0) {
			// 动态键读写对闭合：leaf 字符串定义（配置/数组字面量）+ obj[var].leaf 访问并存 → 键存活
			const why = "动态键读写对闭合：leaf 字符串定义（" + ev.stringKey.length + " 处）与 obj[var].leaf 访问（" + ev.dynamic.length + " 处）并存 → 键存活";
			return { vp, verdict: KEEP, why: why, evidence: evStr + "  ||  " + evDyn };
		}
		/* 字符串命中必须贴近父段才算中等证据；否则是常见词噪声，标 WEAK 并显式说明不可据此保留 */
		const innerSegs = vp.split(".").slice(1, -1);
		const near = innerSegs.length ? ev.stringKey.some((h) => nearParent(h, innerSegs)) : false;
		if (near) {
			const why = "叶子键 " + leaf + " 以字符串形态出现在父段邻近上下文（" + (ev.stringKey.length + ev.dynamic.length) + " 处），中等证据，建议复核";
			return { vp, verdict: REVIEW, why: why, evidence: (evStr ? evStr : "") + (evStr && evDyn ? "  ||  " : "") + evDyn };
		}
		const why = "证据不足：叶子键 " + leaf + " 仅以字符串/通用词形态出现在远离父段的上下文（" + (ev.stringKey.length + ev.dynamic.length) + " 处），无法定位到 " + vp + "，禁止据此判 KEEP";
		return { vp, verdict: WEAK, why: why, evidence: (evStr ? evStr : "") + (evStr && evDyn ? "  ||  " : "") + evDyn };
	}

	// ⑧ 零证据
	return { vp, verdict: REMOVE, why: "零证据：源码中未出现 " + leaf + " 的任何形态，真缺失（模组删除/改名该字段）", evidence: "" };
}

/* ---------- main ---------- */
function main() {
	const args = process.argv.slice(2);
	const jsonMode = args.indexOf("--json") !== -1;
	const modId = args[0];
	const srcDir = args[1];
	if (!modId || !srcDir) { console.error("用法：node tools/resolve_missing.js <适配器id> <模组源码目录> [--json]"); process.exit(1); }
	if (!fs.existsSync(srcDir)) { console.error("源码目录不存在: " + srcDir); process.exit(1); }

	const files = collectFiles(srcDir);
	const varPaths = extractVarPaths(modId);
	const dynCtx = harvestDynamics(files);
	const results = [];
	for (const vp of varPaths) {
		results.push(classify(files, vp, dynCtx));
	}

	const groups = {};
	for (const r of results) groups[r.verdict] = (groups[r.verdict] || 0) + 1;
	const alive = results.filter((r) => r.verdict === KEEP || r.verdict === KEEP_DYNAMIC).length;
	const covPct = results.length ? Math.round((alive / results.length) * 100) : 100;

	if (jsonMode) {
		/* 机器可读：供自动化流水线消费（后续可直接按 verdict 批量改 04a-modcheat-adapters.js） */
		const out = {
			adapter: modId, srcDir, declared: varPaths.length, files: files.length,
			groups, alive, coveragePct: covPct,
			dynamicPrefixes: Array.from(dynCtx.prefixes), enumValues: dynCtx.enums.size,
			results: results.map((r) => ({ verdict: r.verdict, vp: r.vp, why: r.why, evidence: r.evidence || "" }))
		};
		console.log(JSON.stringify(out, null, 2));
		return;
	}

	console.log("===== resolve_missing.js 缺失条目自动定案：适配器 " + modId + " vs " + srcDir + " =====");
	console.log("声明 varPath " + varPaths.length + " 条，源码文件 " + files.length + " 个，动态前缀 " + dynCtx.prefixes.size + " 个，数据枚举 " + dynCtx.enums.size + " 个\n");
	for (const r of results) {
		console.log("[" + r.verdict + "] " + r.vp);
		console.log("     " + r.why);
		if (r.evidence) console.log("     ↳ " + r.evidence);
	}

	console.log("\n===== 汇总（建议动作） =====");
	const grp = (v) => results.filter((r) => r.verdict === v).map((r) => r.vp).join(" | ");
	for (const v of [KEEP, KEEP_DYNAMIC, REVIEW, WEAK, SOURCE_MISMATCH, REMOVE]) {
		console.log(v.padEnd(16) + (grp(v) || "（无）"));
	}
	console.log("\n存活 " + alive + "/" + results.length + "（" + covPct + "%）；仅 REMOVE 需删声明，WEAK / SOURCE_MISMATCH 是「结论不可信」告警，不是删除信号。");
}

main();
