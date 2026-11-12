/*!
 * DoLOnline Guard 1.0.0
 * 作用：拦截旧版 MapleBirchCE dolonline 适配器（及该适配器 4 个手写动作）
 *      在存档里留下的作弊值，使其无法用于联机交易 / 地下城进度。
 *
 * 设计原则：只回退「能证明是外部作弊写入」的字段，绝不动合法进度。
 * 判据全部来自模组与 CE 源码实证，均要求严格矛盾，不做启发式猜测。
 *
 * 判据表：
 *   F1 trace  — V.mbCE_wrote 中 modId === "dolonline" 的记录，按 CE 自己的
 *               before 快照精确还原（等同 CE 的 undoCheatModValue 语义）。
 *               CE 写入契约：04b-modcheat-write.js L141-142 无条件留痕。
 *   F2 inv    — dgInv 的 18 个物品键全部恰好 99（CE dl_fill_inv 写死值），
 *               且 mpDgLv 仍为 1（等级没升过）。dgAdd(index.js:9010) 无上限
 *               clamp，长期玩家可能合法堆到 99，故必须加等级佐证。
 *   F3 gold   — dgGold === 9999（CE dl_refill_run 写死值）。index.js 全库
 *               dgGold 唯一写入是「进本置 0」(L9523)，合法恒 0；dgKills 在
 *               5.34 是死键（只在 dgUnlocked 老存档兼容分支被读、零写入），
 *               不能拿它当豁免。
 *   F4 spell  — mpSkill 的 9 个法术键全部为 1，且 mpDgLv < 12。
 *               CE dl_all_spells 一次把 9 键全置 1、不扣点。合法达到「9 键全 1」
 *               需 mpDgLv >= 12（5 个 auto 白送）再花 14 点买 4 个无 auto 节点；
 *               等级不足 12 时要额外花 14 点买 auto 节点，合计 28 点。
 *               删除时按 cost 退回点数，且只退「未被等级白送」的，误伤可逆。
 *
 * 不做的事（有意放弃，避免误伤）：
 *   - 不把「mpDgUnlocked === 1」单独判为作弊：模组自带 canCheat() 管理员
 *     unlock 按钮（index.js:1453-1456）只写这一个键，形态与 CE 相同。
 *   - 不用 exp/lv 一致性判定：gainExp 是扣减制且 0 经验本身合法。
 *   - 不用 dgFloor / dgKills 作判据：5.34 全库不写这两个键，读到的恒为默认值。
 *   - 不用 mpSkillPts 余额作 F4 豁免：CE 不写 pts，作弊者余额可任意，
 *     而合法玩家花光点后余额也是 0，两者不可区分。
 */
(function (root) {
	'use strict';

	var MOD_ID = 'dolonline';
	var LOG_MAX = 20;

	/* CE dl_fill_inv 写入的 18 个键（04a-17-dolonline.js L246-262 实证） */
	var CE_INV_KEYS = [
		'fang', 'hide', 'herb', 'ore', 'dust', 'ember', 'slime',
		'pot_hp1', 'pot_hp2', 'pot_mp1', 'pot_mp2', 'pot_atk', 'pot_def', 'pot_agi',
		'food_soup', 'food_steak', 'food_stew', 'food_ember_tea'
	];
	var CE_INV_VAL = 99;

	/* CE dl_all_spells 写入的 9 个键（同文件 L228-231 实证） */
	var CE_SPELL_KEYS = [
		'fireWall', 'iceSpike', 'shadowBolt', 'thunderStorm', 'meteor',
		'uDesp', 'uBurst', 'uChain', 'uBlood'
	];

	/* 等级白送的法术节点（Dolonline index.js:8827 的 auto 字段，按 mpDgLv 判） */
	var AUTO_BY_KEY = { fireWall: 3, iceSpike: 5, shadowBolt: 7, thunderStorm: 9, meteor: 12 };

	/* 各法术节点的解锁成本（index.js:8782-8799 的 cost 字段），合计 28 */
	var COST_BY_KEY = {
		fireWall: 2, iceSpike: 2, shadowBolt: 3, thunderStorm: 3, meteor: 4,
		uBurst: 4, uChain: 4, uDesp: 3, uBlood: 3
	};
	var COST_TOTAL = 28;

	/* 9 键全 1 在 mpDgLv >= 12 时可合法达成（5 个 auto 全白送），故只拦等级不足 */
	var SPELL_FULL_LV = 12;

	/* CE dl_refill_run 写入的金币特征值（同文件 L296-300 实证） */
	var CE_GOLD_VAL = 9999;

	/* 只允许动模组自己的命名空间，防止留痕 path 指到原版变量时误改 */
	function isGuardKey(path) {
		if (typeof path !== 'string' || !path) { return false; }
		if (path === 'npcAff') { return true; }
		return /^(mp|dg)[A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/.test(path);
	}

	/* 点号路径解析；只取一层宿主，不做数组下标 */
	function resolvePath(v, path) {
		var parts = String(path).split('.');
		var parent = v;
		for (var i = 0; i < parts.length - 1; i++) {
			if (!parent || typeof parent !== 'object') { return null; }
			if (!(parts[i] in parent)) { return null; }
			parent = parent[parts[i]];
		}
		if (!parent || typeof parent !== 'object') { return null; }
		return { parent: parent, leaf: parts[parts.length - 1] };
	}

	function num(x, dflt) {
		var n = Number(x);
		return isFinite(n) ? n : dflt;
	}

	/* ---- F1：CE 留痕精确回退 ---- */
	function ruleTrace(v) {
		var wrote = v.mbCE_wrote;
		if (!wrote || typeof wrote !== 'object') { return []; }
		var out = [];
		var keys = Object.keys(wrote);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (k.indexOf('cheat:') !== 0) { continue; }
			var rec = wrote[k];
			if (!rec || rec.type !== 'cheat') { continue; }
			if (rec.modId !== MOD_ID) { continue; }
			if (!isGuardKey(rec.path)) { continue; }
			var r = resolvePath(v, rec.path);
			if (!r) { continue; }
			var cur = r.parent[r.leaf];
			var before = rec.before;
			if (before === undefined) {
				try { delete r.parent[r.leaf]; } catch (e) { r.parent[r.leaf] = undefined; }
			} else {
				r.parent[r.leaf] = before;
			}
			try { delete wrote[k]; } catch (e2) { wrote[k] = undefined; }
			out.push({ rule: 'F1-trace', path: rec.path, from: cur, to: before });
		}
		return out;
	}

	/* ---- F2：dgInv 18 键全 99，且等级还没升过 ---- */
	/* dgAdd(index.js:9010) 是 inv[item] += n，没有上限 clamp，长期玩家可以合法堆到 99；
	   故必须加「mpDgLv 仍为 1」佐证——等级 1 却有 18 样物资同时精确 99，
	   而物资只在层内掉落、掉落伴随经验，两者不可能同时成立。 */
	function ruleInv(v) {
		var inv = v.dgInv;
		if (!inv || typeof inv !== 'object') { return []; }
		if (num(v.mpDgLv, 1) > 1) { return []; }
		var keys = CE_INV_KEYS;
		var hit = 0;
		for (var i = 0; i < keys.length; i++) {
			if (num(inv[keys[i]], -1) === CE_INV_VAL) { hit++; }
		}
		if (hit !== keys.length) { return []; }
		for (var j = 0; j < keys.length; j++) { inv[keys[j]] = 0; }
		return [{ rule: 'F2-inv', path: 'dgInv', from: '18×99', to: '0' }];
	}

	/* ---- F3：dgGold 9999（CE dl_refill_run 写死值） ---- */
	/* index.js 全库 dgGold 唯一写入是「进本置 0」(L9523)，合法态恒为 0，故 9999 即指纹。
	   dgKills 在 5.34 是死键（只在 dgUnlocked 老存档兼容分支被读、全库零写入），
	   拿它当豁免等于不判，故不引用。 */
	function ruleGold(v) {
		if (num(v.dgGold, 0) !== CE_GOLD_VAL) { return []; }
		var cur = v.dgGold;
		v.dgGold = 0;
		return [{ rule: 'F3-gold', path: 'dgGold', from: cur, to: 0 }];
	}

	/* ---- F4：9 个法术键一次全置 1，且等级不足以白送齐 ---- */
	/* CE dl_all_spells 把 9 键全置 1、不扣点，这是它的精确指纹。
	   合法达到「9 键全 1」需要 mpDgLv >= 12（fireWall:3 / iceSpike:5 / shadowBolt:7 /
	   thunderStorm:9 / meteor:12 全白送），再花 14 点买 4 个无 auto 节点；
	   等级不足 12 时要额外花 14 点买 auto 节点，合计 28 点。
	   只按「9 键全 1」判、不按「某个节点越权」判——后者会误伤提前花点买 auto 节点的玩家。 */
	function detectSpell(v) {
		var sk = v.mpSkill;
		if (!sk || typeof sk !== 'object') { return []; }
		var lv = num(v.mpDgLv, 1);
		if (lv >= SPELL_FULL_LV) { return []; }        /* 等级够，9 键全开可合法达成 */
		var hit = 0;
		for (var i = 0; i < CE_SPELL_KEYS.length; i++) {
			if (num(sk[CE_SPELL_KEYS[i]], 0) > 0) { hit++; }
		}
		if (hit !== CE_SPELL_KEYS.length) { return []; }   /* 非精确指纹，宁可漏判 */
		return CE_SPELL_KEYS.slice();
	}

	function ruleSpell(v) {
		var bad = detectSpell(v);
		if (!bad.length) { return []; }
		var sk = v.mpSkill;
		var lv = num(v.mpDgLv, 1);
		var refund = 0;
		var out = [];
		for (var i = 0; i < bad.length; i++) {
			var k = bad[i];
			var cur = sk[k];
			try { delete sk[k]; } catch (e) { sk[k] = 0; }
			var autoAt = AUTO_BY_KEY[k];
			if (!(autoAt && lv >= autoAt)) { refund += (COST_BY_KEY[k] || 1); }   /* 只退未被等级白送的 */
			out.push({ rule: 'F4-spell', path: 'mpSkill.' + k, from: cur, to: undefined });
		}
		if (refund > 0) {
			v.mpSkillPts = num(v.mpSkillPts, 0) + refund;
			out[out.length - 1].to = '(已退 ' + refund + ' 点)';
		}
		return out;
	}

	function log(v, items) {
		if (!v) { return; }
		var arr = Array.isArray(v.dolguard_log) ? v.dolguard_log : [];
		for (var i = 0; i < items.length; i++) {
			arr.push({
				t: Date.now(),
				rule: items[i].rule,
				path: items[i].path,
				from: summarize(items[i].from),
				to: summarize(items[i].to)
			});
		}
		while (arr.length > LOG_MAX) { arr.shift(); }
		v.dolguard_log = arr;
		v.dolguard_count = num(v.dolguard_count, 0) + items.length;
		v.dolguard_last = Date.now();
	}

	function summarize(x) {
		if (x === undefined) { return '(undefined)'; }
		if (x === null) { return '(null)'; }
		if (typeof x === 'object') {
			try { return JSON.stringify(x); } catch (e) { return '(object)'; }
		}
		return String(x);
	}

	/* 一次巡检：返回本次修掉的条目 */
	function sweep(v) {
		if (!v || typeof v !== 'object') { return []; }
		var items = [];
		try { items = items.concat(ruleTrace(v) || []); } catch (e1) {}
		try { items = items.concat(ruleInv(v) || []); } catch (e2) {}
		try { items = items.concat(ruleGold(v) || []); } catch (e3) {}
		try { items = items.concat(ruleSpell(v) || []); } catch (e4) {}
		if (items.length) { log(v, items); }
		if (items.length && root.console && root.console.warn) {
			try {
				root.console.warn('[DoLOnlineGuard] 已回退 ' + items.length + ' 项作弊残留：' +
					items.map(function (x) { return x.rule + ' ' + x.path; }).join(' / '));
			} catch (e5) {}
		}
		return items;
	}

	/* 只读审计，不改动存档 */
	function audit(v) {
		var found = [];
		try {
			var wrote = v && v.mbCE_wrote;
			if (wrote && typeof wrote === 'object') {
				Object.keys(wrote).forEach(function (k) {
					var rec = wrote[k];
					if (rec && rec.type === 'cheat' && rec.modId === MOD_ID && isGuardKey(rec.path)) {
						found.push({ rule: 'F1-trace', path: rec.path, before: rec.before });
					}
				});
			}
		} catch (eA) {}
		try {
			var inv = v && v.dgInv;
			if (inv && typeof inv === 'object') {
				var hit = 0;
				CE_INV_KEYS.forEach(function (k) { if (num(inv[k], -1) === CE_INV_VAL) { hit++; } });
				if (hit === CE_INV_KEYS.length && num(v.mpDgLv, 1) <= 1) { found.push({ rule: 'F2-inv', path: 'dgInv', detail: '18 键全 99 且等级仍为 1' }); }
			}
		} catch (eB) {}
		try {
			if (num(v.dgGold, 0) === CE_GOLD_VAL) {
				found.push({ rule: 'F3-gold', path: 'dgGold', detail: '9999（合法态恒为 0）' });
			}
		} catch (eC) {}
		try {
			var badSpell = detectSpell(v);
			for (var si = 0; si < badSpell.length; si++) {
				found.push({ rule: 'F4-spell', path: 'mpSkill.' + badSpell[si], detail: '9 键全 1 且等级不足 12' });
			}
		} catch (eD) {}
		return found;
	}

	var G = {
		version: '1.1.0',
		modId: MOD_ID,
		audit: audit,
		sweep: sweep,
		ruleTrace: ruleTrace,
		ruleInv: ruleInv,
		ruleGold: ruleGold,
		ruleSpell: ruleSpell,
		detectSpell: detectSpell,
		_autoByKey: AUTO_BY_KEY,
		_costByKey: COST_BY_KEY,
		_costTotal: COST_TOTAL,
		_spellFullLv: SPELL_FULL_LV,
		_invKeys: CE_INV_KEYS,
		_spellKeys: CE_SPELL_KEYS,
		_goldVal: CE_GOLD_VAL,
		_isGuardKey: isGuardKey,
		_resolvePath: resolvePath
	};
	root.DoLOnlineGuard = G;

	/* ---- 自动挂载：仅在真实游戏环境（SugarCube 已就绪）才启动，测试可完全隔离 ---- */
	function onPassage() {
		try {
			var v = root.State && root.State.variables;
			if (v) { sweep(v); }
		} catch (e) {}
	}

	var booted = false;
	var tries = 0;

	function boot() {
		/* 直接以 State.variables 就绪为准：SugarCube 2 的 window.SugarCube 在部分
		   ModLoader 封装下不暴露，但 State 一定是全局可用的。
		   幂等：多次调用只做一次挂载，避免重复绑定事件与重复起定时器。 */
		if (!root.State || typeof root.State !== 'object' || !root.State.variables) { return false; }
		if (booted) { return true; }
		booted = true;
		onPassage();
		try {
			if (root.jQuery) { root.jQuery(document).on(':passagestart', onPassage); }
		} catch (e) {}
		try {
			setInterval(onPassage, 30000);
		} catch (e2) {}
		return true;
	}

	function waitBoot() {
		if (boot()) { return; }
		tries++;
		if (tries > 60) { return; }
		setTimeout(waitBoot, 500);
	}
	/* 两段式挂载：
	   ModLoader 的 loadMod() 只显式处理 scriptFileList_inject_early / earlyload / preload
	   （game\Degrees of Lewdity.html 内实证：@12385677 / @12388849 / @12342860），
	   普通 scriptFileList 的执行时机落在 SugarCube 自举前后不定的位置，脚本跑起来时
	   State 往往还没就绪——所以不能只靠固定次数的重试。
	   ① waitBoot：500ms × 60（最多 30s），抢早期窗口；
	   ② 长轮询：每 5s 试一次且永不放弃，只在未 boot 时动作，boot 成功后自动空转。
	   两条都幂等，且只在 boot 成功的那一次真正挂载事件与巡检定时器。 */
	try {
		if (!root.__DOLGUARD_NO_AUTO__) {
			waitBoot();
			setInterval(function () { if (!booted) { boot(); } }, 5000);
		}
	} catch (eBoot) {}

	if (typeof module !== 'undefined' && module.exports) { module.exports = G; }
})(typeof window !== 'undefined' ? window : globalThis);
