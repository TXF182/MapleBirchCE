/* DoLOnline 反作弊守卫：一键补丁脚本
 *
 * 用法：
 *   node patch_index.js <源 index.js> <输出文件> [--no-embed]
 *
 * 行为：
 *   1) 按「行号 + 全行 trim 精确断言」逐条替换写入点，任何一条失配立即报错退出（不静默）；
 *   2) 默认把 dgac_inline.js 内联到产物顶部，并调用 DGAC.start()（单文件直接替换即可）；
 *   3) 用 node --check 校验产物语法。
 *
 * 行号取自 DoLOnline 5.34 的 index.js（749,755 B），换版本后行号会漂移，
 * 脚本会一次性列出全部失配项，方便按 trim 内容重新定位。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const RULES = [
	// ---- dgInv ----
	{ n: 7604, from: "if (!v.dgInv || typeof v.dgInv !== 'object') v.dgInv = {};",
		to: "if (!v.dgInv || typeof v.dgInv !== 'object') DGAC.write(function () { v.dgInv = {}; });", why: 'ensureDgInv 初始化容器' },
	{ n: 7610, from: "inv[item] = (Number(inv[item]) || 0) + (Number(n) || 1);",
		to: "DGAC.set(inv, item, (Number(inv[item]) || 0) + (Number(n) || 1));", why: 'dgAdd 加物资' },
	{ n: 7689, from: "inv[invKey] = Number(inv[invKey]) - 1;",
		to: "DGAC.set(inv, invKey, Number(inv[invKey]) - 1);", why: 'dolDgUse 消耗 -1' },
	{ n: 7713, from: "for (var k2 in r.mats) inv[k2] = Number(inv[k2]) - r.mats[k2];",
		to: "for (var k2 in r.mats) DGAC.set(inv, k2, Number(inv[k2]) - r.mats[k2]);", why: 'dolDgCook 扣材料' },

	// ---- mpSkillPts ----
	{ n: 1448, from: "else if (k === 'sp') { v.mpSkillPts = (Number(v.mpSkillPts) || 0) + 3; showToast('技能点 +3'); }",
		to: "else if (k === 'sp') { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + 3); showToast('技能点 +3'); }", why: '管理员 sp +3' },
	{ n: 3087, from: "if (fl % 5 === 0) { v.mpSkillPts = (Number(v.mpSkillPts) || 0) + 1; gotPt = 1; }",
		to: "if (fl % 5 === 0) { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + 1); gotPt = 1; }", why: 'dgNext 每 5 层 +1' },
	{ n: 3088, from: "else if (Math.random() < 0.2) { v.mpSkillPts = (Number(v.mpSkillPts) || 0) + 1; gotPt = 1; }",
		to: "else if (Math.random() < 0.2) { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + 1); gotPt = 1; }", why: 'dgNext 20% +1' },
	{ n: 3891, from: "else if (kind === 'skill') { v.mpSkillPts = (Number(v.mpSkillPts) || 0) + n; showToast('技能点 +' + n); return; }",
		to: "else if (kind === 'skill') { DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + n); showToast('技能点 +' + n); return; }", why: 'grantItem 发技能点' },
	{ n: 8849, from: "v.mpSkillPts = skillPts() - cost;",
		to: "DGAC.set(v, 'mpSkillPts', skillPts() - cost);", why: '技能树解锁扣点' },
	{ n: 8873, from: "v.mpSkillPts = (Number(v.mpSkillPts) || 0) + refund;",
		to: "DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) || 0) + refund);", why: '洗点退点' },

	// ---- mpSkill ----
	{ n: 8807, from: "if (!v.mpSkill) v.mpSkill = {};",
		to: "if (!v.mpSkill) DGAC.write(function () { v.mpSkill = {}; });", why: '技能树初始化容器' },
	{ n: 8869, from: "v.mpSkill = {};",
		to: "DGAC.write(function () { v.mpSkill = {}; });", why: '洗点清空' },
	{ n: 8828, from: "if (autoOn && lv < 1) { v.mpSkill[nd.k] = 1; lv = 1; }",
		to: "if (autoOn && lv < 1) { DGAC.set(v.mpSkill, nd.k, 1); lv = 1; }", why: '等级白送节点' },
	{ n: 8871, from: "if (nd.auto && dgLv2 >= nd.auto) v.mpSkill[nd.k] = 1;",
		to: "if (nd.auto && dgLv2 >= nd.auto) DGAC.set(v.mpSkill, nd.k, 1);", why: '洗点后重建白送节点' },
	{ n: 8848, from: "v.mpSkill[k] = lv + 1;",
		to: "DGAC.set(v.mpSkill, k, lv + 1);", why: '解锁节点 +1' },

	// ---- dgFloor / mpDgUnlocked ----
	{ n: 1455, from: "v.mpDgUnlocked = 1; v.dgFloor = (Number(v.dgFloor) || 1);",
		to: "v.mpDgUnlocked = 1; DGAC.set(v, 'dgFloor', (Number(v.dgFloor) || 1));", why: '管理员 unlock' },
	{ n: 1460, from: "v.dgFloor = (Number(v.dgFloor) || 1) + 1;",
		to: "DGAC.set(v, 'dgFloor', (Number(v.dgFloor) || 1) + 1);", why: '管理员 floor +1' },

	// ---- 等级 / 经验池（gainExpKind 动态键）----
	{ n: 5953, from: "if (!Number(v[lvKey])) v[lvKey] = 1;",
		to: "if (!Number(v[lvKey])) DGAC.set(v, lvKey, 1);", why: 'gainExpKind 初始化等级' },
	{ n: 5954, from: "if (!Number(v[expKey])) v[expKey] = 0;",
		to: "if (!Number(v[expKey])) DGAC.set(v, expKey, 0);", why: 'gainExpKind 初始化经验' },
	{ n: 5956, from: "v[expKey] = Number(v[expKey]) + add;",
		to: "DGAC.set(v, expKey, Number(v[expKey]) + add);", why: 'gainExpKind 加经验' },
	{ n: 5960, from: "v[expKey] -= needFn(v[lvKey]);",
		to: "DGAC.set(v, expKey, v[expKey] - needFn(v[lvKey]));", why: '升级扣经验' },
	{ n: 5961, from: "v[lvKey] += 1;",
		to: "DGAC.set(v, lvKey, v[lvKey] + 1);", why: '升级 +1 级' },
	{ n: 5962, from: "v[spKey] = (Number(v[spKey]) || 0) + 1;",
		to: "DGAC.set(v, spKey, (Number(v[spKey]) || 0) + 1);", why: '升级 +1 点' },

	// ---- 初始化 ----
	{ n: 9520, from: "v.mpDLv = 1; v.mpDgLv = 1;",
		to: "DGAC.set(v, 'mpDLv', 1); DGAC.set(v, 'mpDgLv', 1);", why: '初始化双等级' },
	{ n: 9522, from: "v.dgFloor = 1; v.dgHp = null; v.dgEHp = 0; v.dgEHpMax = 0;",
		to: "DGAC.set(v, 'dgFloor', 1); v.dgHp = null; v.dgEHp = 0; v.dgEHpMax = 0;", why: '初始化层数' },
	{ n: 9523, from: "v.dgMana = (v.dgManaMax || 100); v.dgGold = 0;",
		to: "v.dgMana = (v.dgManaMax || 100); DGAC.set(v, 'dgGold', 0);", why: '初始化金币' }
];

function main() {
	const src = process.argv[2];
	const out = process.argv[3];
	const noEmbed = process.argv.indexOf('--no-embed') >= 0;

	if (!src || !out) {
		console.error('用法: node patch_index.js <源 index.js> <输出文件> [--no-embed]');
		process.exit(2);
	}
	if (!fs.existsSync(src)) { console.error('[FAIL] 源文件不存在: ' + src); process.exit(2); }

	const raw = fs.readFileSync(src, 'utf8');
	const LF = raw.split('\n');
	console.log('源文件: ' + src);
	console.log('  行数 ' + LF.length + ' / ' + raw.length + ' 字符');

	const fail = [];
	let ok = 0;
	for (const r of RULES) {
		const i = r.n - 1;
		const line = LF[i];
		if (line === undefined) { fail.push('L' + r.n + ' 行不存在（' + r.why + '）'); continue; }
		const trimmed = line.trim();
		if (trimmed !== r.from) {
			fail.push('L' + r.n + ' 内容失配（' + r.why + '）\n        期望: ' + r.from + '\n        实际: ' + trimmed);
			continue;
		}
		const lead = line.match(/^[\t ]*/)[0];
		LF[i] = lead + r.to;
		ok++;
	}

	if (fail.length) {
		console.error('\n[FAIL] ' + fail.length + ' 条规则失配，未写出产物：');
		fail.forEach(function (f) { console.error('  - ' + f); });
		console.error('\n提示：本脚本的行号按 DoLOnline 5.34 的 index.js 标定；换版本后请按「期望」那列原文重新定位行号。');
		process.exit(1);
	}

	let body = LF.join('\n');

	if (!noEmbed) {
		const guardPath = path.join(__dirname, 'dgac_inline.js');
		if (!fs.existsSync(guardPath)) { console.error('[FAIL] 缺少 ' + guardPath); process.exit(2); }
		const guard = fs.readFileSync(guardPath, 'utf8');
		body = '/* ===== DoLOnline 反作弊守卫（内联，由 patch_index.js 注入）===== */\n'
			+ guard
			+ '\n/* 启动守卫：等待 SugarCube 就绪后安装，并在每次换页 / 30s 巡检时自检 */\n'
			+ 'try { DGAC.start(); } catch (e) { /* 守卫启动失败不得影响模组本体 */ }\n'
			+ '/* ===== 内联结束 ===== */\n'
			+ body;
	}

	fs.writeFileSync(out, body, 'utf8');
	console.log('\n[OK] 已替换 ' + ok + ' / ' + RULES.length + ' 个写入点');
	console.log('[OK] 产物: ' + out + '（' + body.length + ' 字符' + (noEmbed ? '，未内联守卫' : '，已内联守卫') + '）');

	if (!noEmbed) {
		try {
			cp.execFileSync(process.execPath, ['--check', out], { stdio: 'pipe' });
			console.log('[OK] node --check 通过');
		} catch (e) {
			console.error('[FAIL] 产物语法错误：' + (e.stderr ? e.stderr.toString() : e.message));
			process.exit(1);
		}
	}
}

main();
