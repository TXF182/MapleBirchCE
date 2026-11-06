/* check_key_types.js —— 声明 type 与源码实际存储形态的一致性核查
   背景：适配器只标 number / boolean / list，但模组源码里同一个键可能是字符串哨兵（""）、
   对象容器或 0/1 布尔。CE 直写数字进字符串键会留下无法比较的脏值（模组 `=== ""` 判定失效），
   直写数字进对象容器会覆盖掉整个结构。这类问题 audit/resolve 都不查——它们只查「键存不存在」。
   用法：
     node tools/check_key_types.js                全量（映射取自 tools/_modcache/STATE.json）
     node tools/check_key_types.js <adapterId>    单模组
     node tools/check_key_types.js --json         机器可读
   退出码：0 无冲突；1 存在 CONFLICT
*/
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "javascript", "src");
const STATE = path.join(__dirname, "_modcache", "STATE.json");
const MODCACHE = path.join(__dirname, "_modcache");
/* 模组源码实际扩展名：wr134 用 .txt 存 passage、.json5 存 patch——只扫 js/twee 会漏掉严格比较 */
const EXTS = /\.(js|ts|twee|txt|json|json5|mjs|cjs|html|htm)$/i;

function readState() {
	const j = JSON.parse(fs.readFileSync(STATE, "utf8"));
	return (j.entries || []).filter((e) => e.present && e.adapter && e.dir && e.dir !== "_dl");
}

/* 取出包住 pos 的那一层对象字面量文本。
   type 必须同块才算数——首版用「varPath 后 400 字符」抓 type，会跨到相邻声明块，
   把 stages 项（有 level/labels 但无 type）误配成 boolean。 */
function blockOf(text, pos) {
	let depth = 0;
	let start = -1;
	for (let i = pos; i >= 0; i--) {
		const c = text[i];
		if (c === "}") depth++;
		else if (c === "{") {
			if (depth === 0) { start = i; break; }
			depth--;
		}
		if (pos - i > 900) break;
	}
	if (start < 0) return null;
	let d = 0;
	for (let j = start; j < text.length && j - start < 1600; j++) {
		const c = text[j];
		if (c === "{") d++;
		else if (c === "}") {
			d--;
			if (d === 0) return text.slice(start, j + 1);
		}
	}
	return null;
}

function parseDecls() {
	const out = [];
	for (const f of fs.readdirSync(SRC_DIR)) {
		if (!/^04a-.*\.js$/.test(f)) continue;
		const text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
		const re = /varPath\s*:\s*"([^"]+)"/g;
		let m;
		while ((m = re.exec(text))) {
			const vp = m[1];
			const block = blockOf(text, m.index);
			if (!block) continue;
			const t = block.match(/type\s*:\s*"(number|boolean|list)"/);
			if (!t) continue;
			const head = text.slice(0, m.index);
			const all = [...head.matchAll(/CHEAT_ADAPTERS\[\s*"([^"]+)"\s*\]/g)];
			const adapter = all.length ? all[all.length - 1][1] : null;
			/* numeric: true 是既有约定（05-modcheat-ui.js:124）：boolean 项渲染成数字控件、写 1。
			   认定它时按 number 语义比对，否则会把它当成「声明布尔却按数字比较」重复报错。 */
			const numeric = /numeric\s*:\s*true/.test(block);
			out.push({ file: f, adapter, varPath: vp, type: numeric ? "number" : t[1], numeric });
		}
	}
	return out;
}

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyLiteral(raw) {
	const lit = String(raw).trim().replace(/;+$/, "");
	if (/^-?\d+(\.\d+)?$/.test(lit)) return "number";
	if (/^"(?:[^"\\]|\\.)*"$/.test(lit) || /^'(?:[^'\\]|\\.)*'$/.test(lit)) return "string";
	if (/^(true|false)$/.test(lit)) return "boolean";
	if (/^\[\s*\]$/.test(lit)) return "array";
	if (/^\{\s*\}$/.test(lit)) return "object";
	if (/^null$/.test(lit)) return "null";
	return null;
}

function collectFiles(root) {
	const out = [];
	(function walk(dir) {
		let ents;
		try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
		for (const en of ents) {
			const p = path.join(dir, en.name);
			if (en.isDirectory()) walk(p);
			else if (EXTS.test(en.name)) out.push(p);
		}
	})(root);
	return out;
}

const CACHE = new Map();
function readText(f) {
	if (!CACHE.has(f)) CACHE.set(f, fs.readFileSync(f, "utf8"));
	return CACHE.get(f);
}

/* 证据：只认「显式赋值 / 默认值兜底」两种，避免任意对象字面量同名键造成的误报 */
function collectEvidence(files, vp) {
	if (/\d/.test(vp.split(".").slice(1).join("."))) return { got: null, why: "skip-dynamic" };
	const dotted = escapeRe(vp);
	const pats = [
		new RegExp("(?:\\bV\\.|\\$)" + dotted + "\\s*(?:=|\\?\\?|\\|\\|)\\s*([^;\\n,}\\]]{0,40})"),
		new RegExp("<<set\\s+\\$" + dotted + "\\s+(?:to|=)\\s+([^>]{0,40})"),
		new RegExp("\\b" + dotted + "\\s*(?:=|\\?\\?|\\|\\|)\\s*([^;\\n,}\\]]{0,40})"),
	];
	for (const f of files) {
		const text = readText(f);
		for (const re of pats) {
			const m = re.exec(text);
			if (!m) continue;
			const got = classifyLiteral(m[1]);
			if (got) {
				const line = text.slice(0, m.index).split("\n").length;
				return { got, why: rel(f) + ":" + line + " → " + m[0].trim().slice(0, 70) };
			}
		}
	}
	return { got: null, why: "no-evidence" };
}

function rel(p) {
	return p.replace(/^.*_modcache[\\/]/, "").replace(/\\/g, "/");
}

/* 严格比较探测：SugarCube 的 `is` 等价 ===，`$x is 1` 与 JS 的 `=== 1` 都拒绝 true。
   声明 boolean 但模组按数字严格比较 → 面板写 true 后判定为假，作弊项静默失效。
   反向同理：声明 number 但模组按 true/false 严格比较。 */
function collectStrict(files, vp, declType) {
	const dotted = escapeRe(vp);
	const numRe = [
		new RegExp("\\$" + dotted + "\\s+is\\s+(?:1|0)\\b"),
		new RegExp("(?:\\bV\\.|\\$)" + dotted + "\\s*(?:===|!==|==|!=)\\s*(?:1|0)\\b"),
	];
	const boolRe = [
		new RegExp("\\$" + dotted + "\\s+is\\s+(?:true|false)\\b"),
		new RegExp("(?:\\bV\\.|\\$)" + dotted + "\\s*(?:===|!==|==|!=)\\s*(?:true|false)\\b"),
	];
	for (const f of files) {
		const text = readText(f);
		for (const re of numRe) {
			const m = re.exec(text);
			if (m && declType === "boolean") {
				const line = text.slice(0, m.index).split("\n").length;
				return { kind: "num", why: rel(f) + ":" + line + " → " + m[0].trim() };
			}
		}
		for (const re of boolRe) {
			const m = re.exec(text);
			if (m && declType === "number") {
				const line = text.slice(0, m.index).split("\n").length;
				return { kind: "bool", why: rel(f) + ":" + line + " → " + m[0].trim() };
			}
		}
	}
	return null;
}

function judge(declType, got) {
	if (!got) return "NO_EVIDENCE";
	if (declType === "list") return got === "array" ? "OK" : "CONFLICT";
	if (declType === "boolean") {
		if (got === "boolean") return "OK";
		if (got === "number") return "WARN_BOOL_01";
		return "CONFLICT";
	}
	if (declType === "number") return got === "number" ? "OK" : "CONFLICT";
	return "UNKNOWN";
}

function main() {
	const args = process.argv.slice(2);
	const asJson = args.includes("--json");
	const only = args.find((a) => !a.startsWith("--")) || null;
	const entries = readState();
	const decls = parseDecls();
	const results = [];
	const filesByDir = new Map();
	for (const e of entries) {
		const root = path.join(MODCACHE, e.dir);
		if (!fs.existsSync(root)) continue;
		filesByDir.set(e.adapter, collectFiles(root));
	}
	for (const d of decls) {
		if (only && d.adapter !== only) continue;
		const files = filesByDir.get(d.adapter);
		if (!files) continue;
		const ev = collectEvidence(files, d.varPath);
		let verdict = judge(d.type, ev.got);
		let evidence = ev.why;
		const strict = collectStrict(files, d.varPath, d.type);
		if (strict) {
			verdict = strict.kind === "num" ? "STRICT_NUM" : "STRICT_BOOL";
			evidence = strict.why;
		}
		results.push({ adapter: d.adapter, file: d.file, varPath: d.varPath, declared: d.type, actual: ev.got || "-", verdict, evidence });
	}
	const conflict = results.filter((r) => r.verdict === "CONFLICT");
	const strictNum = results.filter((r) => r.verdict === "STRICT_NUM");
	const strictBool = results.filter((r) => r.verdict === "STRICT_BOOL");
	const warn = results.filter((r) => r.verdict === "WARN_BOOL_01");
	if (asJson) {
		console.log(JSON.stringify({ total: results.length, conflict: conflict.length, strictNum: strictNum.length, strictBool: strictBool.length, warn: warn.length, results }, null, 1));
	} else {
		console.log("声明类型 vs 源码形态（只认显式赋值 / 严格比较口径）");
		console.log("检查 " + results.length + " 条：CONFLICT " + conflict.length + " / STRICT " + (strictNum.length + strictBool.length) + " / WARN_BOOL_01 " + warn.length + " / NO_EVIDENCE " + results.filter((r) => r.verdict === "NO_EVIDENCE").length);
		const show = (arr, title) => {
			if (!arr.length) return;
			console.log("\n[" + title + "]");
			for (const r of arr) console.log("  " + r.adapter + " | " + r.varPath + "  声明=" + r.declared + " 实际=" + r.actual + "\n      " + r.evidence);
		};
		show(conflict, "CONFLICT 直写会破坏结构");
		show(strictNum, "STRICT_NUM 声明布尔，模组按数字严格比较（写 true 不生效）");
		show(strictBool, "STRICT_BOOL 声明数值，模组按布尔严格比较（写 1 不生效）");
		show(warn, "WARN_BOOL_01 数字位当布尔（模组用 0/1 非严格比较时属正常）");
	}
	process.exit(conflict.length || strictNum.length || strictBool.length ? 1 : 0);
}

main();
