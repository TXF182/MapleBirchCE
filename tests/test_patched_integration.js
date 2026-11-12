/* 集成验证：用**打过补丁的真实源码片段**跑一遍
 *
 * 为什么必须做这一层：
 *   模组的写入函数（dgAdd 等）自带 `try { ... } catch (e) {}`。
 *   如果守卫误伤了模组自己的写入，代码不会崩、不会报错，只会**静默失效**——
 *   玩家看到的是"加了物资但背包不增加"。这是最危险的失败形态，
 *   语法检查、单元测试都发现不了。必须拿真实片段跑。
 *
 * 运行：node tests/test_patched_integration.js [patchedIndexPath]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let pass = 0, fail = 0;
function T(name, fn) {
	try { fn(); pass++; console.log('  PASS  ' + name); }
	catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}

const patched = process.argv[2]
	|| path.join(process.env.TEMP || '', 'dolonline_index.patched.js');

if (!fs.existsSync(patched)) {
	console.error('[SKIP] 找不到 patched 产物: ' + patched);
	console.error('       先跑: node tools/dolonline-guard-inline/patch_index.js ' +
		'tools/_modcache/dolonline534/unpacked/index.js <输出>');
	process.exit(2);
}

const src = fs.readFileSync(patched, 'utf8');

/* ---------- 从真实产物里切出 ensureDgInv + dgAdd ---------- */
const startMark = 'function ensureDgInv';
const endMark = 'window.dolDgAdd = dgAdd;';
const i0 = src.indexOf(startMark);
const i1 = src.indexOf(endMark);
if (i0 < 0 || i1 < 0 || i1 < i0) {
	console.error('[FAIL] 无法从 patched 产物定位 ensureDgInv/dgAdd 段');
	process.exit(1);
}
const snippet = src.slice(i0, i1 + endMark.length);
console.log('切出真实片段: ' + snippet.length + ' 字符（ensureDgInv + dgAdd）');
console.log('');

/* ---------- 装守卫 ---------- */
let V = {
	dgGold: 0, dgFloor: 1, mpDgLv: 1, mpSkillPts: 0,
	dgInv: { fang: 3, herb: 5 }, mpSkill: {}
};
global.VV = function () { return V; };
const DGAC = require(path.join(__dirname, '..', 'tools', 'dolonline-guard-inline', 'dgac_inline.js'));

/* ---------- mock 掉 dgAdd 依赖的渲染函数 ---------- */
const calls = { renderBag: 0, renderCatBalance: 0 };

/* 用 new Function 在「守卫已 boot」的上下文里执行真实片段 */
function runSnippet() {
	const body = snippet + '\nreturn { dgAdd: dgAdd, ensureDgInv: ensureDgInv };';
	const fn = new Function('VV', 'renderBag', 'renderCatBalance', 'DGAC', 'window', body);
	return fn(
		global.VV,
		function () { calls.renderBag++; },
		function () { calls.renderCatBalance++; },
		DGAC,
		{ dolDgAdd: null }
	);
}

console.log('【1】守卫未安装时：真实 dgAdd 正常工作（基线）');

T('1.1 dgAdd 在无守卫时加物资', function () {
	V = { dgInv: { fang: 3 }, dgGold: 0, mpSkillPts: 0, mpDgLv: 1, dgFloor: 1, mpSkill: {} };
	DGAC.bootedReset && DGAC.bootedReset();
	const api = runSnippet();
	api.dgAdd('fang', 2);
	assert.strictEqual(V.dgInv.fang, 5);
});

console.log('');
console.log('【2】守卫已安装：真实 dgAdd 必须仍然正常工作（不误伤）');

T('2.1 boot() 后，真实 dgAdd 走 DGAC.set 成功加物资', function () {
	V = { dgInv: { fang: 3, herb: 5 }, dgGold: 0, mpSkillPts: 0, mpDgLv: 1, dgFloor: 1, mpSkill: {} };
	DGAC.boot();
	const api = runSnippet();
	api.dgAdd('fang', 4);
	assert.strictEqual(V.dgInv.fang, 7, '守卫装上后 dgAdd 必须仍能加（否则就是静默失效）');
	assert.ok(calls.renderCatBalance >= 1, '渲染回调应被调用');
});

T('2.2 真实 dgAdd 能新增原本不存在的物资键', function () {
	V = { dgInv: { fang: 3 }, dgGold: 0, mpSkillPts: 0, mpDgLv: 1, dgFloor: 1, mpSkill: {} };
	DGAC.boot();
	const api = runSnippet();
	api.dgAdd('food_soup', 1);
	assert.strictEqual(V.dgInv.food_soup, 1, '新键也必须能加');
});

T('2.3 真实 ensureDgInv 在容器缺失时能建出新容器', function () {
	V = { dgGold: 0, mpSkillPts: 0, mpDgLv: 1, dgFloor: 1, mpSkill: {} };
	DGAC.boot();
	const api = runSnippet();
	const inv = api.ensureDgInv(V);
	assert.ok(inv && typeof inv === 'object', 'ensureDgInv 应返回对象');
	assert.strictEqual(typeof V.dgInv, 'object', 'dgInv 应被建出来');
});

console.log('');
console.log('【3】守卫已安装：CE 真实写入路径必须被挡');

T('3.1 CE 写 dgInv.fang=99 → 抛错，值不变', function () {
	V = { dgInv: { fang: 3 }, dgGold: 0, mpSkillPts: 0, mpDgLv: 1, dgFloor: 1, mpSkill: {} };
	DGAC.boot();
	let threw = false;
	try { V.dgInv.fang = 99; } catch (e) { threw = !!e.dolonlineGuard; }
	assert.strictEqual(threw, true, '必须被守卫拦下');
	assert.strictEqual(V.dgInv.fang, 3);
});

T('3.2 CE 写 dgGold=9999 → 被挡', function () {
	V = { dgInv: {}, dgGold: 0, mpSkillPts: 0, mpDgLv: 1, dgFloor: 1, mpSkill: {} };
	DGAC.boot();
	let threw = false;
	try { V.dgGold = 9999; } catch (e) { threw = !!e.dolonlineGuard; }
	assert.strictEqual(threw, true);
	assert.strictEqual(V.dgGold, 0);
});

console.log('');
console.log('【4】补丁完整性：产物里不该再有裸写入');

/* 只检查「模组本体」区的裸写入：内联守卫自己的 audit() 里也有 v.dgGold = 0，
   那是守卫的合法修复写入（且已包在 write 窗口内），不能算漏洞。 */
const afterGuard = src.indexOf('/* ===== 内联结束 ===== */');
const MODBODY = afterGuard >= 0 ? src.slice(afterGuard) : src;

T('4.1 patched 产物里已无 `inv[item] = ` 裸写法', function () {
	assert.ok(MODBODY.indexOf('inv[item] = (Number(inv[item]) || 0)') < 0, 'L7610 应已改为 DGAC.set');
});

T('4.2 模组本体里不应再有裸 `v.dgGold = ` 写入', function () {
	const bad = MODBODY.match(/\bv\.dgGold = /g) || [];
	assert.strictEqual(bad.length, 0, '不应再有裸 v.dgGold = 写入，实际 ' + bad.length + ' 处');
});

T('4.2b 模组本体里不应再有裸 `v.mpSkillPts = ` 写入', function () {
	const bad = MODBODY.match(/\bv\.mpSkillPts = /g) || [];
	assert.strictEqual(bad.length, 0, '实际 ' + bad.length + ' 处: ' +
		(bad.length ? (MODBODY.match(/\bv\.mpSkillPts = [^\n]*/g) || []).join(' | ') : ''));
});

T('4.2c 模组本体里不应再有裸 `inv[` 赋值', function () {
	const bad = MODBODY.match(/^[\t ]*(?:inv|v\.dgInv)\[[^\]]+\] = /gm) || [];
	assert.strictEqual(bad.length, 0, '实际 ' + bad.length + ' 处: ' + bad.join(' | '));
});

T('4.3 patched 产物已内联守卫（含 DGAC.start 调用）', function () {
	assert.ok(src.indexOf('DGAC.start();') >= 0, '应已内联并调用 start()');
	assert.ok(src.indexOf('dolonlineGuard') >= 0, '应含守卫实现');
});

console.log('');
console.log('【5】内联守卫段能否在「类游戏环境」里跑通（补丁生效的前提）');

const vm = require('vm');

function extractGuard() {
	const a = src.indexOf('/* ===== DoLOnline 反作弊守卫');
	const b = src.indexOf('/* ===== 内联结束 ===== */');
	if (a < 0 || b < 0) return null;
	return src.slice(a, b + '/* ===== 内联结束 ===== */'.length);
}

T('5.1 能从 patched 产物里抽出完整守卫段', function () {
	const g = extractGuard();
	assert.ok(g && g.length > 3000, '守卫段应存在且完整，实际长度 ' + (g ? g.length : 0));
});

T('5.2 守卫段在 sandbox（模拟 window.State.variables）里完整执行不抛', function () {
	const V2 = { dgGold: 0, dgFloor: 1, mpDgLv: 1, mpSkillPts: 0, dgInv: { fang: 3 }, mpSkill: {} };
	const win = { State: { variables: V2 } };
	const sandbox = {
		window: win,
		State: win.State,
		console: console,
		setInterval: function () { return 0; },
		clearInterval: function () {},
		setTimeout: function () { return 0; },
		clearTimeout: function () {},
		jQuery: function () { return { on: function () {}, off: function () {} }; },
		document: {},
		$: null
	};
	win.document = sandbox.document;
	vm.createContext(sandbox);
	vm.runInContext(extractGuard(), sandbox, { timeout: 5000 });
	assert.ok(win.DGAC, '应把 DGAC 挂到 window 上');
	assert.strictEqual(typeof win.DGAC.boot, 'function');
	assert.strictEqual(typeof win.DGAC.start, 'function');
});

T('5.3 走 window.State.variables 路径也能装上守卫并拦住写入', function () {
	const V2 = { dgGold: 0, dgFloor: 1, mpDgLv: 1, mpSkillPts: 0, dgInv: { fang: 3 }, mpSkill: {} };
	const win = { State: { variables: V2 } };
	const sandbox = {
		window: win, State: win.State, console: console,
		setInterval: function () { return 0; }, clearInterval: function () {},
		setTimeout: function () { return 0; }, clearTimeout: function () {},
		jQuery: function () { return { on: function () {}, off: function () {} }; },
		document: {}
	};
	vm.createContext(sandbox);
	vm.runInContext(extractGuard(), sandbox, { timeout: 5000 });
	/* 注意：sandbox 里没有 VV，走的是 window.State.variables 回退路径 */
	assert.strictEqual(win.DGAC.boot(), true, '无 VV 时也必须能 boot（存档路径回退）');
	let threw = false;
	try { V2.dgGold = 9999; } catch (e) { threw = !!e.dolonlineGuard; }
	assert.strictEqual(threw, true, '回退路径下也必须拦住');
	assert.strictEqual(V2.dgGold, 0);
});

T('5.4 DGAC.start() 在缺 jQuery 的环境里不抛（失败不影响模组本体）', function () {
	const V2 = { dgGold: 0, dgInv: {} };
	const win = { State: { variables: V2 } };
	const sandbox = {
		window: win, State: win.State, console: console,
		setInterval: function () { return 0; }, clearInterval: function () {},
		setTimeout: function () { return 0; }, clearTimeout: function () {},
		document: {}
	};   /* 故意不给 jQuery */
	vm.createContext(sandbox);
	vm.runInContext(extractGuard(), sandbox, { timeout: 5000 });
	assert.strictEqual(typeof win.DGAC.start, 'function');
	try { win.DGAC.start(); } catch (e) { assert.fail('start() 不应抛出：' + e.message); }
});

console.log('');
console.log('=== 合计：' + pass + ' 通过 / ' + fail + ' 失败 ===');
if (fail) process.exit(1);
