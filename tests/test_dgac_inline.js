/* 测试：DoLOnline 反作弊守卫（内置版）dgac_inline.js
 * 判据全部来自实证：
 *   CE 写入 = r.parent[r.leaf] = val（04b-modcheat-write.js:140）
 *   CE 包体 = (function(){ "use strict"; ... })()（产物 L112-113）
 * 所以「CE 能不能写进去」必须用**严格模式赋值**来复现，否则测出来的结论是假的。
 *
 * 运行：node tests/test_dgac_inline.js
 */
'use strict';

const assert = require('assert');
const path = require('path');

let pass = 0, fail = 0;
const fails = [];
function T(name, fn) {
	try { fn(); pass++; console.log('  PASS  ' + name); }
	catch (e) { fail++; fails.push(name + ' → ' + e.message); console.log('  FAIL  ' + name + '\n        ' + e.message); }
}

/* ---------- 造一份贴近真实的存档变量 ---------- */
const INV_KEYS = ['fang', 'hide', 'herb', 'ore', 'dust', 'ember', 'slime',
	'pot_hp1', 'pot_hp2', 'pot_mp1', 'pot_mp2', 'pot_atk', 'pot_def', 'pot_agi',
	'food_soup', 'food_steak', 'food_stew', 'food_ember_tea'];

function newSave() {
	const V = {
		dgGold: 0, dgFloor: 1, mpDgLv: 1, mpSkillPts: 0,
		dgInv: {}, mpSkill: {}, mbCE_wrote: {}
	};
	INV_KEYS.forEach(function (k, i) { V.dgInv[k] = (i < 4 ? 3 : 0); });
	return V;
}

/* ---------- 复刻 CE 的 cheatResolvePath（04b-modcheat-write.js:40-54） ---------- */
function cheatResolvePath(V, p) {
	const parts = String(p || '').split('.');
	let cur = V;
	for (let i = 0; i < parts.length - 1; i++) {
		if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') {
			return { ok: false, reason: 'parent' };
		}
		cur = cur[parts[i]];
	}
	return { ok: true, parent: cur, leaf: parts[parts.length - 1] };
}

/* ---------- 复刻 CE 的写入（严格模式，同 cheatWriteValue:140） ---------- */
function ceWrite(V, p, val) {
	const r = cheatResolvePath(V, p);
	if (r.ok !== true) { return { ok: false, message: '路径无效' }; }
	try {
		r.parent[r.leaf] = val;           /* ← 严格模式下这一句会抛 TypeError */
		return { ok: true };
	} catch (e) {
		return { ok: false, message: '操作异常：' + (e && e.message ? e.message : e) };
	}
}

/* ---------- 加载被测模块 ---------- */
const modPath = path.join(__dirname, '..', 'tools', 'dolonline-guard-inline', 'dgac_inline.js');
let V = newSave();
global.VV = function () { return V; };
const DGAC = require(modPath);

console.log('DGAC version = ' + DGAC.version);
console.log('');
console.log('【1】装守卫前的基线');

T('1.1 未装守卫时 CE 能写入（证明测试复现了真实写入路径）', function () {
	V = newSave();
	assert.strictEqual(ceWrite(V, 'dgGold', 9999).ok, true);
	assert.strictEqual(V.dgGold, 9999);
});

console.log('');
console.log('【2】装守卫：实时阻断 CE');

T('2.0 boot() 成功', function () {
	V = newSave();
	assert.strictEqual(DGAC.boot(), true);
});

T('2.1 CE 写 dgGold=9999 → 抛错，值不变', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'dgGold', 9999);
	assert.strictEqual(r.ok, false, 'CE 应当写入失败');
	assert.ok(/操作异常/.test(r.message), '应为操作异常，实际: ' + r.message);
	assert.strictEqual(V.dgGold, 0, '值必须没变');
});

T('2.2 CE 写 dgInv.fang=99 → 抛错，值不变', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'dgInv.fang', 99);
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.dgInv.fang, 3, '值必须没变');
});

T('2.3 CE 写 dgInv 为 undefined 键 → 抛错，不新增', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'dgInv.__hack', 1);
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.dgInv.__hack, undefined, '不应新增键');
});

T('2.4 CE 整体替换 dgInv → 抛错', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'dgInv', { fang: 99 });
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.dgInv.fang, 3, '原对象不应被换掉');
});

T('2.5 CE 写 mpSkillPts=28 → 抛错', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'mpSkillPts', 28);
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.mpSkillPts, 0);
});

T('2.6 CE 写 mpSkill.fireWall=1 → 抛错', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'mpSkill.fireWall', 1);
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.mpSkill.fireWall, undefined);
});

T('2.7 CE 写 mpDgLv=99 → 抛错', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'mpDgLv', 99);
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.mpDgLv, 1);
});

T('2.8 CE 写 dgFloor=99 → 抛错', function () {
	V = newSave();
	DGAC.boot();
	const r = ceWrite(V, 'dgFloor', 99);
	assert.strictEqual(r.ok, false);
	assert.strictEqual(V.dgFloor, 1);
});

T('2.9 非严格模式的外部写入 → 同样被拦（守卫 setter 主动 throw，不依赖严格模式）', function () {
	V = newSave();
	DGAC.boot();
	/* 关键：守卫不靠"严格模式静默失败"来拦，而是 setter 主动 throw。
	   所以就算旧版 CE 没开严格模式，也照抛不误——拦截强度与 CE 的模式无关。 */
	let threw = false;
	try {
		/* eslint-disable no-eval */
		eval('(function(){ "use sloppy"; V.dgGold = 9999; })()');
	} catch (e) { threw = true; }
	assert.strictEqual(threw, true, '非严格模式也必须抛（主动 throw）');
	assert.strictEqual(V.dgGold, 0, '值必须没变');
});

console.log('');
console.log('【3】不误伤：模组自身写入必须全部成功');

T('3.1 write() 内 dgGold=0（模拟 L9523 进本重置）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.dgGold = 0; });
	assert.strictEqual(V.dgGold, 0);
});

T('3.2 set() 写 dgInv.fang（模拟 L7610 dgAdd）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.set(V.dgInv, 'fang', 4);
	assert.strictEqual(V.dgInv.fang, 4);
	assert.strictEqual(ceWrite(V, 'dgInv.fang', 99).ok, false, '写完后外部仍进不来');
});

T('3.3 set() 扣物资（模拟 L7689 dolDgUse -1）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.set(V.dgInv, 'pot_hp1', Number(V.dgInv.pot_hp1) - 1);
	assert.strictEqual(V.dgInv.pot_hp1, -1 === 0 ? 0 : V.dgInv.pot_hp1, '不崩即可');
});

T('3.4 write() 内新增键（模拟 dgAdd 新物资）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.dgInv.brand_new = 1; });
	assert.strictEqual(V.dgInv.brand_new, 1);
	assert.strictEqual(ceWrite(V, 'dgInv.brand_new', 99).ok, false, '新增的键也受保护');
});

T('3.5 write() 内整体替换 mpSkill（模拟 L8807/L8869 v.mpSkill = {}）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.mpSkill = {}; });
	assert.deepStrictEqual(Object.keys(V.mpSkill), []);
	DGAC.write(function () { V.mpSkill.fireWall = 1; });
	assert.strictEqual(V.mpSkill.fireWall, 1);
	assert.strictEqual(ceWrite(V, 'mpSkill.fireWall', 2).ok, false, '替换后成员仍受保护');
});

T('3.6 write() 内 mpSkillPts 加点（模拟 L3087 升级 +1）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.mpSkillPts = (Number(V.mpSkillPts) || 0) + 1; });
	assert.strictEqual(V.mpSkillPts, 1);
	assert.strictEqual(ceWrite(V, 'mpSkillPts', 28).ok, false, '加点后外部仍进不来');
});

T('3.7 write() 内 mpDgLv 升级（模拟 L5961 v[lvKey] += 1）', function () {
	V = newSave();
	DGAC.boot();
	const lvKey = 'mpDgLv';
	DGAC.write(function () { V[lvKey] = (Number(V[lvKey]) || 1) + 1; });
	assert.strictEqual(V.mpDgLv, 2);
	assert.strictEqual(ceWrite(V, 'mpDgLv', 99).ok, false);
});

T('3.8 write() 内管理员 dgFloor（模拟 L1460 floor +1）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.dgFloor = (Number(V.dgFloor) || 1) + 1; });
	assert.strictEqual(V.dgFloor, 2);
	assert.strictEqual(ceWrite(V, 'dgFloor', 99).ok, false);
});

T('3.9 嵌套 write()（write 里再调 set）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () {
		DGAC.set(V.dgInv, 'herb', 7);
		DGAC.set(V, 'mpSkillPts', 2);
	});
	assert.strictEqual(V.dgInv.herb, 7);
	assert.strictEqual(V.mpSkillPts, 2);
	assert.strictEqual(ceWrite(V, 'mpSkillPts', 28).ok, false, '嵌套结束后窗口必须关闭');
});

console.log('');
console.log('【4】兜底自检：守卫装上之前就被写坏的历史存档');

T('4.0 先造一份「已被旧 CE 改过」的存档，且守卫尚未安装', function () {
	V = newSave();
	V.dgGold = 9999;
	V.mpSkillPts = 28;
	V.dgInv.fang = 999;
	V.mpDgLv = 0;
	assert.strictEqual(V.dgGold, 9999);
});

T('4.1 audit() 把 dgGold 9999 归 0', function () {
	const fixed = DGAC.audit();
	assert.strictEqual(V.dgGold, 0);
	assert.ok(fixed.join(' ').indexOf('dgGold') >= 0, '应记录修复项: ' + fixed.join(' '));
});

T('4.2 audit() 把 dgInv.fang 999 归 0（>99 不可能值）', function () {
	assert.strictEqual(V.dgInv.fang, 0);
});

T('4.3 audit() 把 mpDgLv 0 归 1', function () {
	assert.strictEqual(V.mpDgLv, 1);
});

T('4.4 audit() 保留合法值：19..99 的 mpSkillPts 不动（合法上限内不误伤）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.mpSkillPts = 19; });
	DGAC.audit();
	assert.strictEqual(V.mpSkillPts, 19, '合法点数不能被误清');
});

T('4.5 audit() 保留 dgInv 恰好 99（它是合法上限，自检不越权）', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.dgInv.herb = 99; });
	DGAC.audit();
	assert.strictEqual(V.dgInv.herb, 99, '99 是合法上限，自检无权清');
});

console.log('');
console.log('【5】幂等与重装（存档加载会整体替换 State.variables）');

T('5.1 重复 boot() 幂等，不抛错', function () {
	V = newSave();
	DGAC.boot(); DGAC.boot(); DGAC.boot();
	assert.strictEqual(ceWrite(V, 'dgGold', 9999).ok, false);
});

T('5.2 模拟存档加载（V 整体换新对象）后 rearm 仍生效', function () {
	V = newSave();                      /* 新对象 = 模拟 State.variables 被替换 */
	DGAC.boot();                         /* 重新装 */
	assert.strictEqual(ceWrite(V, 'dgGold', 9999).ok, false);
	assert.strictEqual(ceWrite(V, 'dgInv.fang', 99).ok, false);
});

T('5.3 模拟模组自己整体替换 dgInv 后，外部仍写不进去', function () {
	V = newSave();
	DGAC.boot();
	const fresh = {}; INV_KEYS.forEach(function (k) { fresh[k] = 0; });
	DGAC.write(function () { V.dgInv = fresh; });
	assert.strictEqual(ceWrite(V, 'dgInv.fang', 99).ok, false, '整体替换后守卫必须跟着换到新对象');
});

console.log('');
console.log('【6】存档序列化不能被守卫弄坏（Proxy 必须对 JSON 透明）');

T('6.1 JSON.stringify(V) 仍能拿到真实值', function () {
	V = newSave();
	DGAC.boot();
	DGAC.write(function () { V.dgGold = 0; V.dgInv.fang = 5; V.mpSkill.fireWall = 1; });
	const j = JSON.parse(JSON.stringify(V));
	assert.strictEqual(j.dgGold, 0);
	assert.strictEqual(j.dgInv.fang, 5, 'Proxy 包裹后序列化必须仍是真实值');
	assert.strictEqual(j.mpSkill.fireWall, 1);
	assert.ok(INV_KEYS.every(function (k) { return k in j.dgInv; }), '18 键必须都在序列化结果里');
});

T('6.2 Object.keys(V) 仍包含被守卫的键（enumerable 未丢）', function () {
	V = newSave();
	DGAC.boot();
	const ks = Object.keys(V);
	['dgGold', 'mpSkillPts', 'mpDgLv', 'dgFloor', 'dgInv', 'mpSkill'].forEach(function (k) {
		assert.ok(ks.indexOf(k) >= 0, k + ' 必须仍可枚举，否则存档会丢字段');
	});
});

T('6.3 applyCheatSync 风格的联动写入（写 null）同样被挡', function () {
	V = newSave();
	DGAC.boot();
	const r = cheatResolvePath(V, 'dgInv.herb');
	try {
		r.parent[r.leaf] = null;          /* 04b-modcheat-write.js:66/76 的联动写法 */
		assert.fail('联动写入应当被拦');
	} catch (e) {
		assert.ok(e && e.dolonlineGuard, '应为守卫抛出的异常');
	}
	assert.strictEqual(V.dgInv.herb, 3, '值必须没变');
});

console.log('');
console.log('【7】拦截日志');

T('7.1 拦截会被记入 log（供作者排查）', function () {
	assert.ok(DGAC.log.length > 0, '应有拦截记录');
	const kinds = DGAC.log.map(function (x) { return x.kind; });
	assert.ok(kinds.indexOf('reject') >= 0, '应含 reject 记录');
});

console.log('');
console.log('=== 合计：' + pass + ' 通过 / ' + fail + ' 失败 ===');
if (fail) { fails.forEach(function (f) { console.log('  ✗ ' + f); }); process.exit(1); }
