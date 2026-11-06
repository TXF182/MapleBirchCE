/* check_coverage.js —— 覆盖缺口探测：模组源码里被反复读写的状态路径，CE 是否声明了
   用途：找「模组有主线开关、CE 面板里点不到」的遗漏项。输出是候选清单，不是结论——
   命中次数高只说明模组常读写它，是否值得作弊仍需按语义判断（瞬态/内部计数不该暴露）。
   用法：node tools/check_coverage.js [adapterId] [--top N]
*/
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "javascript", "src");
const STATE = path.join(__dirname, "_modcache", "STATE.json");
const MODCACHE = path.join(__dirname, "_modcache");
const EXTS = /\.(js|ts|twee|txt|json5|mjs|cjs)$/i;
const SKIP_DIRS = /[\\/](node_modules|dist|_dl)[\\/]/i;

function readState() {
	const j = JSON.parse(fs.readFileSync(STATE, "utf8"));
	return (j.entries || []).filter((e) => e.present && e.adapter && e.dir && e.dir !== "_dl" && e.keys && e.keys.declared);
}

function parseDecls() {
	const out = [];
	for (const f of fs.readdirSync(SRC_DIR)) {
		if (!/^04a-.*\.js$/.test(f)) continue;
		const text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
		const re = /varPath\s*:\s*"([^"]+)"/g;
		let m;
		while ((m = re.exec(text))) {
			const head = text.slice(0, m.index);
			const all = [...head.matchAll(/CHEAT_ADAPTERS\[\s*"([^"]+)"\s*\]/g)];
			out.push({ adapter: all.length ? all[all.length - 1][1] : null, varPath: m[1] });
		}
	}
	return out;
}

function collectFiles(root) {
	const out = [];
	(function walk(dir) {
		let ents;
		try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
		for (const en of ents) {
			const p = path.join(dir, en.name);
			if (SKIP_DIRS.test(p)) continue;
			if (en.isDirectory()) walk(p);
			else if (EXTS.test(en.name)) out.push(p);
		}
	})(root);
	return out;
}

/* 只取 ≤4 段的字面点路径：V.A.b.c / $A.b.c。数字段与方括号动态访问一律跳过 */
const PATH_RE = /(?:\bV\.|\$)("?)([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){0,3})\1(?![.\w$])/g;

function scan(files) {
	const stat = new Map();
	for (const f of files) {
		let text;
		try { text = fs.readFileSync(f, "utf8"); } catch (e) { continue; }
		let m;
		PATH_RE.lastIndex = 0;
		while ((m = PATH_RE.exec(text))) {
			const p = m[2];
			if (/^\d/.test(p)) continue;
			const cur = stat.get(p) || { n: 0, where: null };
			cur.n++;
			if (!cur.where) {
				const line = text.slice(0, m.index).split("\n").length;
				cur.where = f.replace(/^.*_modcache[\\/]/, "").replace(/\\/g, "/") + ":" + line;
			}
			stat.set(p, cur);
		}
	}
	return stat;
}

const NOISE = /^(phase|money|passage|purity|name|state|time|args|argsraw|temp|result|value|i|j|k|n|m|e|t|x|y|p|s|c|d|r)$/;
function plausible(p) {
	const segs = p.split(".");
	if (NOISE.test(p)) return false;
	if (segs.length >= 2) return true; /* 容器路径优先：A.b / A.b.c 是模组状态的主要形态 */
	if (p.length < 7) return false;
	return /[A-Z_]/.test(p) || p.length >= 11; /* 单段只保留明显非通用的名字 */
}

function covered(declared, p) {
	for (const d of declared) {
		if (d === p) return true;
		/* 声明的是更深路径（A.b.c.d）时，A.b.c 也算已覆盖前缀 */
		if (d.startsWith(p + ".")) return true;
	}
	return false;
}

function main() {
	const args = process.argv.slice(2);
	const only = args.find((a) => !a.startsWith("--"));
	const topIdx = args.indexOf("--top");
	const TOP = topIdx > -1 ? Number(args[topIdx + 1]) : 12;
	const decls = parseDecls();
	const entries = readState();
	for (const e of entries) {
		if (only && e.adapter !== only) continue;
		const root = path.join(MODCACHE, e.dir);
		if (!fs.existsSync(root)) continue;
		const declared = decls.filter((d) => d.adapter === e.adapter).map((d) => d.varPath);
		if (!declared.length) continue;
		const stat = scan(collectFiles(root));
		const gaps = [];
		for (const [p, v] of stat) {
			if (v.n < 3) continue;
			if (!plausible(p)) continue;
			if (covered(declared, p)) continue;
			gaps.push({ p, n: v.n, where: v.where });
		}
		gaps.sort((a, b) => b.n - a.n);
		console.log("\n=== " + e.adapter + " (" + e.dir + ")  已声明 " + declared.length + " 条，未覆盖候选 " + gaps.length + " 条 ===");
		for (const g of gaps.slice(0, TOP)) console.log("  " + String(g.n).padStart(4) + "x  " + g.p + "   " + g.where);
	}
}

main();
