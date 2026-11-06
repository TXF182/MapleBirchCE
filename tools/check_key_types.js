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

/* ④ v2.0.0.002：全库「类型共识」判据 —— 兜住「默认态写成独立常量」的形态
   背景：dw258 把 V.RobinExpansion 的默认态写进 constants/robin.ts 的 DEFAULT_ROBIN_STATE，
   块头不含父键名（`rebellion: boolean;` / `rebellion: false,`），父键块判据取不到，
   于是 58 条真实存在的键被判 NO_EVIDENCE。
   约束（保证零假阳性）：该叶子名在整库出现过的类型证据必须**只有一种**类型，且与声明一致；
   一旦出现两种类型（opened: boolean 与 opened: number、dark: string 颜色 与 dark: boolean）一律不采信。 */
var __typeCache = new WeakMap();
function typeConsensus(files, vp) {
	var leaf = vp.split(".").pop();
	var segs = vp.split(".");
	/* 父子链：父键 + 祖父键（`RobinExpansion.investment.contributed` 的类型证据写在 Robin.ts，
	   单看直接父键 investment 匹配不上，退一级用 RobinExpansion 才成立） */
	var parents = [];
	if (segs.length >= 2) parents.push(segs[segs.length - 2]);
	if (segs.length >= 3) parents.push(segs[segs.length - 3]);
	var norm = function (x) { return String(x || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
	var idx = __typeCache.get(files);
	if (!idx) {
		idx = Object.create(null);
		var declRe = /^[\t ]*(?:public |private |protected |readonly |static |declare )*([A-Za-z_$][\w$]*)\??[\t ]*:[\t ]*(boolean|number|string)[\t ]*[;,]/gm;
		var litRe = /^[\t ]*([A-Za-z_$][\w$]*)[\t ]*:[\t ]*(true|false|-?\d+(?:\.\d+)?|'[^'\n]{0,40}'|"[^"\n]{0,40}")[\t ]*[;,]?$/gm;
		var add = function (name, type, f, text, at, snippet) {
			var e = idx[name] || (idx[name] = { types: [], list: [] });
			if (e.types.indexOf(type) < 0) e.types.push(type);
			e.list.push({
				type: type,
				file: rel(f),
				where: rel(f) + ":" + text.slice(0, at).split("\n").length + " → " + snippet.trim().slice(0, 70),
			});
		};
		for (var i = 0; i < files.length; i++) {
			var f = files[i];
			if (!/\.(ts|js)$/i.test(f)) continue;
			var text = readText(f);
			var m;
			declRe.lastIndex = 0;
			litRe.lastIndex = 0;
			while ((m = declRe.exec(text))) add(m[1], m[2], f, text, m.index, m[0]);
			while ((m = litRe.exec(text))) {
				var t = classifyLiteral(m[2]);
				if (t) add(m[1], t, f, text, m.index, m[0]);
			}
		}
		__typeCache.set(files, idx);
	}
	var e2 = idx[leaf];
	if (!e2 || e2.types.length !== 1) return null;
	/* 跨父键防线（fixture 实证）：只有「证据文件与父键名相关」才算这个父键下的声明。
	   例：MarginTrading.ts 的 `opened: number` 不能给 Finance.bank.opened 作证；
	   而 constants/robin.ts（robin ⊂ RobinExpansion）、constants/temple-choir.ts（= TempleChoir）、
	   Finance/Company.ts（company）、LifeSimulation/School.ts（school）都成立。 */
	if (parents.length) {
		var pick = null;
		for (var j = 0; j < e2.list.length && !pick; j++) {
			var bN = norm(String(e2.list[j].file || "").split("/").pop().replace(/\.(ts|js)$/i, ""));
			for (var k = 0; k < parents.length; k++) {
				var pN = norm(parents[k]);
				if (!pN || !bN || pN.indexOf(bN) >= 0 || bN.indexOf(pN) >= 0) { pick = e2.list[j]; break; }
			}
		}
		if (!pick) return null;
		return { type: pick.type, why: "全库唯一类型共识 " + pick.where };
	}
	return { type: e2.types[0], why: "全库唯一类型共识 " + e2.list[0].where };
}


/* 证据：显式赋值 / 默认值兜底 / TS 类型声明 / 对象字面量键值 / `??` 惰性初始化。
   v2.0.0.002 扩展的判据都属于「模组作者写死的类型证据」，强度不低于赋值：
     ① TS 字段类型声明   `rebellion: boolean;`                （dw258 migrations/Robin.ts:108）
     ② 初始化对象字面量  `retaken: 0,` / `rebellion: false,`  （revelation.ts:10 / robin.ts:254）
     ③ `?? <字面量>` 惰性 `<<set $RBR.necklace.retaken to ($RBR.necklace.retaken ?? 0) + 1>>`（Wraith.twee:55）
   旧版只认 ①② 之外的「V. / $ 前缀赋值」与 `<<set>>`，且 RHS 是表达式时 classifyLiteral 取不到值，
   导致 171 条真实存在的键被判 NO_EVIDENCE（取证率 38%）。 */
function collectEvidence(files, vp) {
	if (/\d/.test(vp.split(".").slice(1).join("."))) return { got: null, why: "skip-dynamic" };
	const dotted = escapeRe(vp);
	const leaf = escapeRe(vp.split(".").pop());
	const pats = [
		new RegExp("(?:\\bV\\.|\\$)" + dotted + "\\s*(?:=|\\?\\?|\\|\\|)\\s*([^;\\n,}\\]]{0,40})"),
		new RegExp("<<set\\s+\\$" + dotted + "\\s+(?:to|=)\\s+([^>]{0,40})"),
		new RegExp("\\b" + dotted + "\\s*(?:=|\\?\\?|\\|\\|)\\s*([^;\\n,}\\]]{0,40})"),
	];
	const at = (text, idx) => text.slice(0, idx).split("\n").length;
	for (const f of files) {
		const text = readText(f);
		for (const re of pats) {
			const m = re.exec(text);
			if (!m) continue;
			const got = classifyLiteral(m[1]);
			if (got) return { got, why: rel(f) + ":" + at(text, m.index) + " → " + m[0].trim().slice(0, 70) };
		}
		/* ③ 惰性初始化：RHS 为表达式时从 `?? <字面量>` 取类型 */
		const qqRe = new RegExp("\\$" + dotted + "[^>\\n]{0,60}\\?\\?\\s*([^>\\n,)}]{1,20})");
		const qm = qqRe.exec(text);
		if (qm) {
			const got = classifyLiteral(qm[1]);
			if (got) return { got, why: rel(f) + ":" + at(text, qm.index) + " → " + qm[0].trim().slice(0, 70) };
		}
		/* ① TS 字段类型声明（仅 .ts；自定义类型名不认，避免误判）
		   反例（本轮抓到）：Finance.bank.opened 声明 boolean 是**对的**（Finance.ts:40 `typeof bank.opened === 'boolean'`），
		   但 MarginTrading.ts:19 有同名 `opened: number` —— 只看字段名会误判。
		   故要求命中位置附近的上下文里出现「父级键名」（bank / prayer / facility …）。 */
		const pv = vp.split(".");
		const parentName = pv.length >= 2 ? pv[pv.length - 2] : null;
		const ctxOk = (text, idx, len) => {
			if (!parentName) return true;
			const w = text.slice(Math.max(0, idx - 400), idx + len + 400);
			return new RegExp("\\b" + escapeRe(parentName) + "\\b").test(w);
		};
		/* 父键块头：`parent: {` / `interface Parent {` / `type Parent = {` / `class Parent {`
		   之后 1500 字符内（不跨嵌套 `{}`）找字段，避免相邻父键的同名子键互相污染 */
		const heads = [];
		if (parentName) {
			const pe = escapeRe(parentName);
			const headRe = new RegExp("(?:\\b" + pe + "\\s*:\\s*\\{|\\b(?:interface|class|type)\\s+" + pe + "\\b[^{;]{0,60}\\{)", "g");
			let hm;
			while ((hm = headRe.exec(text))) heads.push(hm.index + hm[0].length);
		}
		const blockScan = (re) => {
			for (const start of heads) {
				const seg = text.slice(start, start + 1500);
				const cut = seg.search(/[{}]/);
				const body = cut >= 0 ? seg.slice(0, cut) : seg;
				const m2 = re.exec(body);
				re.lastIndex = 0;
				if (m2) return { m: m2, at: start };
			}
			return null;
		};
		if (/\.ts$/i.test(f)) {
			/* TS 类型声明：先在父键块内找 `leaf: type`，再退化为裸字段 + 上下文校验 */
			const tb = blockScan(new RegExp("\\b" + leaf + "\\??\\s*:\\s*(boolean|number|string)"));
			if (tb) return { got: tb.m[1], why: rel(f) + ":" + at(text, tb.at) + " → " + parentName + " 块内 " + tb.m[0].trim().slice(0, 60) };
			const ab = blockScan(new RegExp("\\b" + leaf + "\\??\\s*:\\s*(?:[A-Za-z_$][\\w$]*\\[\\]|Array<[^>]*>)"));
			if (ab) return { got: "array", why: rel(f) + ":" + at(text, ab.at) + " → " + parentName + " 块内 " + leaf + "[]" };
			const tRe = new RegExp("^\\s*" + leaf + "\\??\\s*:\\s*(boolean|number|string)", "gm");
			let tm;
			while ((tm = tRe.exec(text))) {
				if (!ctxOk(text, tm.index, tm[0].length)) continue;
				return { got: tm[1], why: rel(f) + ":" + at(text, tm.index) + " → " + tm[0].trim().slice(0, 70) };
			}
			const aRe = new RegExp("^\\s*" + leaf + "\\??\\s*:\\s*(?:[A-Za-z_$][\\w$]*\\[\\]|Array<[^>]*>)", "gm");
			let am;
			while ((am = aRe.exec(text))) {
				if (!ctxOk(text, am.index, am[0].length)) continue;
				return { got: "array", why: rel(f) + ":" + at(text, am.index) + " → " + am[0].trim().slice(0, 70) };
			}
		}
		/* ② 初始化对象字面量：只在父键块内取 `leaf: <literal>`。
		   反例（本轮抓到）：Transport.ts 里 repair_tools:{bicycle:false} 与 repair_parts:{bicycle:0} 相邻，
		   只看同名字段会把 repair_parts.bicycle（number）判成 false。 */
		const kb = blockScan(new RegExp("\\b" + leaf + "\\s*:\\s*([^,}\\]\\n]{1,30})"));
		if (kb) {
			const got = classifyLiteral(kb.m[1]);
			if (got) return { got, why: rel(f) + ":" + at(text, kb.at) + " → " + parentName + " 块内 " + kb.m[0].trim().slice(0, 60) };
		}
	}
	/* ④ 全库类型共识（最后一道，约束最严：整库同名只有一种类型才采信） */
	var cons = typeConsensus(files, vp);
	if (cons) return { got: cons.type, why: cons.why };
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

/* 测试可导入：tests/test_keycheck.js 用临时 fixture 回归 collectEvidence 的三类判据形态，
   避免「父键块匹配 / interface 形态 / ?? 惰性初始化」被后续改动悄悄改坏。 */
module.exports = { collectEvidence, classifyLiteral, collectFiles, main };

if (require.main === module) main();
