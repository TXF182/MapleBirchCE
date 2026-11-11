#!/usr/bin/env node
/* ============================================================================
 * modcache_state.js — 把「对照源码现状表」从手写文档变成机器可读的 STATE.json
 *
 * 用法：
 *   node tools/modcache_state.js            # 只扫盘上事实（快）
 *   node tools/modcache_state.js --keys     # 额外跑 audit + resolve，写入键数校验结果（慢，约 1-2 分钟）
 *   node tools/modcache_state.js --check    # 只校验 STATE.json 是否与盘上现状一致（不一致 exit 1，可做门禁）
 *
 * 解决什么问题：tools/_modcache 的目录清单、模组版本、键数校验结论原先手写在
 * AGENTS.md §5 里，模组一升版表格就滞后（历史上已多次滞后）。本脚本以盘上事实为准
 * 生成 tools/_modcache/STATE.json，文档只留"路径 + 生成命令"，不再手写数字。
 *
 * 记录字段（每个对照目录一条）：
 *   dir / adapter / bootVersion / slugVersion / versionConsistent / files / bytes
 *   downloadedAt（目录 birthtime，非内容真实下载时间，见 note）/ license / layout
 *   keys: { declared, alive, coveragePct, verdicts, source } —— 仅 --keys 时写
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "tools", "_modcache");
const STATE_FILE = path.join(CACHE_DIR, "STATE.json");

/* 目录 → 适配器 id + 人工对照口径版本（slug 为开发者目录命名对应的版本，仅作交叉核对） */
const MAP = [
	{ dir: "cat119", adapter: "cattery", name: "Cattery", slug: "1.1.9" },
	{ dir: "dolmod0990", adapter: "dolmod", name: "DolMod-（人物附加与生活质量提升）", slug: "0.1.990" },
	{ dir: "dolonline531", adapter: "dolonline", name: "DoL 联机&地下城（仅单机状态键）", slug: "5.31" },
	{ dir: "dw258", adapter: "deadwood-reblooms", name: "枯木逢春", slug: "2.5.8" },
	{ dir: "farm108", adapter: "more-farm-upgrade", name: "More Farm Upgrade", slug: "1.0.8" },
	{ dir: "fw562", adapter: "maplebirch-framework", name: "Maplebirch Framework", slug: "5.6.2", noKeys: "框架本体走 declOverride 兼容记录，不是 CHEAT_ADAPTERS 适配器，audit/resolve 不适用" },
	{ dir: "mli0180", adapter: "more_love_interests", name: "More Love Interests", slug: "1.8.0" },
	{ dir: "opt1121", adapter: "dol-optimization", name: "Dol-Optimization", slug: "1.1.2.1" },
	{ dir: "rv146", adapter: "revelation-the-book-of-return", name: "归途之书", slug: "1.4.6" },
	{ dir: "sp0391", adapter: "smartphone", name: "SmartPhone", slug: "3.9.1" },
	{ dir: "wr134", adapter: "wraiths-reflection", name: "Wraith's Reflection", slug: "1.3.4" },
];

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }

function countFiles(dir) {
	let files = 0, bytes = 0;
	(function walk(d) {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.isFile()) { files++; try { bytes += fs.statSync(p).size; } catch {} }
		}
	})(dir);
	return { files, bytes };
}

/* 按宽度优先在最多 2 层内找指定文件：模组包常把 boot.json / LICENSE 放在 <dir>/unpacked/ 之类子目录 */
function findNamed(dir, re, maxDepth = 2) {
	const queue = [[dir, 0]];
	while (queue.length) {
		const [d, depth] = queue.shift();
		let ents;
		try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
		for (const e of ents) if (e.isFile() && re.test(e.name)) return path.join(d, e.name);
		if (depth < maxDepth) for (const e of ents) if (e.isDirectory()) queue.push([path.join(d, e.name), depth + 1]);
	}
	return null;
}

/* 版本来源优先级：boot.json.version > package.json.version；深度 2 内找不到即 unknown（不猜） */
function readVersion(dir) {
	const boot = findNamed(dir, /^boot\.json$/i);
	if (boot) {
		try {
			const b = JSON.parse(fs.readFileSync(boot, "utf8"));
			if (b.version) return { version: String(b.version), source: path.relative(dir, boot).split(path.sep).join("/") };
		} catch { /* 落到下一级 */ }
	}
	const pkg = findNamed(dir, /^package\.json$/i);
	if (pkg) {
		try {
			const p = JSON.parse(fs.readFileSync(pkg, "utf8"));
			if (p.version) return { version: String(p.version), source: path.relative(dir, pkg).split(path.sep).join("/") };
		} catch { /* 落到下一级 */ }
	}
	return { version: null, source: "unknown" };
}

/* 目录名版本由 MAP.slug 人工登记（目录命名不总能反推版本，如 dolmod0990 = 0.1.990），
   此处不再从目录名猜，只负责比对。 */
function normalize(v) { return String(v == null ? "" : v).replace(/[^0-9]/g, "").replace(/^0+/, ""); }
function versionConsistent(bootV, slugV) {
	if (!bootV || !slugV) return null;
	return normalize(bootV) === normalize(slugV);
}

function readLicense(dir) {
	const file = findNamed(dir, /^(LICENSE|LICENCE|COPYING)(\..*)?$/i);
	if (!file) return { file: null, spdx: "unknown", note: "目录（含 2 层子目录）内无 LICENSE 文件" };
	let head = "";
	try { head = fs.readFileSync(file, "utf8").slice(0, 400); } catch {}
	const t = head.toLowerCase();
	let spdx = "unknown";
	if (t.includes("mit license")) spdx = "MIT";
	else if (t.includes("apache license")) spdx = "Apache-2.0";
	else if (t.includes("gnu general public license")) spdx = t.includes("version 3") ? "GPL-3.0" : "GPL";
	else if (t.includes("all rights reserved")) spdx = "proprietary";
	return { file: path.relative(dir, file).split(path.sep).join("/"), spdx };
}

function layout(dir) {
	const hasSrc = isDir(path.join(dir, "src"));
	const hasDist = isDir(path.join(dir, "dist"));
	const hasUnpacked = isDir(path.join(dir, "unpacked"));
	if (hasSrc) return "source-repo";
	if (hasUnpacked) return "unpacked-mod";
	if (hasDist) return "dist-mod";
	return "mod-package";
}

function runJson(cmd, args) {
	try {
		const out = execFileSync(process.execPath, [path.join(__dirname, cmd), ...args, "--json"], {
			cwd: ROOT, encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024
		});
		return JSON.parse(out);
	} catch (e) {
		return { error: String(e.message || e).slice(0, 200) };
	}
}

function collect(withKeys) {
	const entries = [];
	for (const m of MAP) {
		const dir = path.join(CACHE_DIR, m.dir);
		if (!isDir(dir)) {
			entries.push({ ...m, present: false, note: "目录不存在（清单滞后或已删除）" });
			continue;
		}
		const { files, bytes } = countFiles(dir);
		const v = readVersion(dir);
		const st = fs.statSync(dir);
		const e = {
			dir: m.dir, adapter: m.adapter, name: m.name, present: true,
			bootVersion: v.version, versionSource: v.source,
			slugVersion: m.slug, versionConsistent: versionConsistent(v.version, m.slug),
			files, bytes,
			downloadedAt: st.birthtime.toISOString(),
			license: readLicense(dir),
			layout: layout(dir),
		};
		if (withKeys) {
			if (m.noKeys) {
				e.keys = { skipped: m.noKeys };
			} else {
				const audit = runJson("audit_adapters.js", [m.adapter, path.join("tools", "_modcache", m.dir)]);
				const resolve = runJson("resolve_missing.js", [m.adapter, path.join("tools", "_modcache", m.dir)]);
				e.keys = audit.error || resolve.error
					? { error: audit.error || resolve.error }
					: {
						declared: audit.declared, literalAlive: audit.literalAlive, aliveAfterGrade: audit.aliveAfterGrade,
						coveragePct: audit.coveragePct, alive: resolve.alive, resolveCoveragePct: resolve.coveragePct,
						verdicts: resolve.groups, source: "audit_adapters.js + resolve_missing.js"
					};
			}
		}
		entries.push(e);
	}
	/* 盘上存在但不在映射表里的目录也列出来，避免"新下载了却没登记"再次变成静默滞后 */
	const known = new Set(MAP.map((m) => m.dir));
	for (const d of fs.readdirSync(CACHE_DIR, { withFileTypes: true })) {
		if (!d.isDirectory() || known.has(d.name)) continue;
		entries.push({ dir: d.name, adapter: null, present: true, note: "未映射目录（可能是下载暂存区，若是对照源码请在 MAP 里登记）", files: countFiles(path.join(CACHE_DIR, d.name)).files });
	}
	return entries;
}

function main() {
	const argv = process.argv.slice(2);
	const withKeys = argv.includes("--keys");
	const checkOnly = argv.includes("--check");

	if (checkOnly) {
		if (!fs.existsSync(STATE_FILE)) { console.error("STATE.json 不存在，先跑 node tools/modcache_state.js"); process.exit(1); }
		const old = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
		const now = collect(false);
		const diffs = [];
		for (const e of now) {
			const o = old.entries.find((x) => x.dir === e.dir);
			if (!o) { diffs.push("新增目录: " + e.dir); continue; }
			if (o.files !== e.files) diffs.push(e.dir + " 文件数 " + o.files + " → " + e.files);
			if (o.bootVersion !== e.bootVersion) diffs.push(e.dir + " 版本 " + o.bootVersion + " → " + e.bootVersion);
			if (o.present !== e.present) diffs.push(e.dir + " 存在性变化");
		}
		for (const o of old.entries) if (!now.some((e) => e.dir === o.dir)) diffs.push("目录消失: " + o.dir);
		console.log(diffs.length ? "STATE.json 已滞后：\n  " + diffs.join("\n  ") : "STATE.json 与盘上现状一致");
		process.exit(diffs.length ? 1 : 0);
	}

	const entries = collect(withKeys);
	const state = {
		generatedAt: new Date().toISOString(),
		generator: "tools/modcache_state.js",
		note: [
			"本文件由脚本生成，请勿手改；文档只引用本路径。",
			"downloadedAt 取目录 birthtime，是目录创建时间，不等于内容真实下载时间（复制/解压会重置）。",
			"bootVersion 取自模组包内 boot.json（无则 package.json）；slugVersion 由目录名推导，仅作交叉核对。",
			"versionConsistent=false 表示目录名与包内版本口径不一致，需人工确认哪个是当前对照版本。",
			"keys 只在 --keys 时写入，来源为 audit_adapters.js 字面审计 + resolve_missing.js 分级定案（KEEP/KEEP_DYNAMIC 计入存活）。",
		],
		keysGenerated: withKeys,
		entries
	};
	fssafeWrite(state);

	const pad = (s, n) => String(s == null ? "-" : s).padEnd(n);
	console.log("写入 " + path.relative(ROOT, STATE_FILE));
	console.log(pad("目录", 12) + pad("适配器", 30) + pad("包内版本", 10) + pad("目录名版本", 10) + pad("一致", 6) + pad("文件", 6) + pad("许可", 8) + "布局 / 键数定案");
	for (const e of entries) {
		if (!e.present) { console.log(pad(e.dir, 12) + pad(e.adapter, 30) + "缺失"); continue; }
		if (e.adapter === null) { console.log(pad(e.dir, 12) + pad("(未映射)", 30) + pad(e.files, 6) + e.note); continue; }
		console.log(
			pad(e.dir, 12) + pad(e.adapter, 30) + pad(e.bootVersion, 10) + pad(e.slugVersion, 10) +
			pad(e.versionConsistent === null ? "?" : e.versionConsistent ? "是" : "否", 6) +
			pad(e.files, 6) + pad(e.license && e.license.spdx, 8) + e.layout +
			(e.keys ? "  " + keyLine(e.keys) : "")
		);
	}
}

/* 区分「存活 / 待复核 / 弱证据 / 换源核对 / 判删」——只报 alive/declared 会把待复核误读成真丢失 */
function keyLine(k) {
	if (k.skipped) return "键数不适用（" + k.skipped + "）";
	if (k.error) return "键数校验失败：" + k.error;
	const v = k.verdicts || {};
	const parts = [
		"K" + (v.KEEP || 0),
		"D" + (v.KEEP_DYNAMIC || 0),
		"R" + (v.REVIEW || 0),
		"W" + (v.WEAK || 0),
		"S" + (v.SOURCE_MISMATCH || 0),
		"X" + (v.REMOVE || 0)
	];
	return parts.join(" ") + "  (" + k.alive + "/" + k.declared + " 存活)";
}

function fssafeWrite(obj) {
	fs.writeFileSync(STATE_FILE, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

main();
