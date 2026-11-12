/* ============================================================
 * DoLOnline 反作弊守卫（内置版）v1.0.0
 *
 * 目的：让外部作弊器（如 MapleBirchCE 的旧版 "dolonline" 适配器）
 *       无法再改写本模组的关键状态。原理是**实时阻断**，不是事后清理。
 *
 * 为什么能挡住：
 *   实测 MapleBirchCE 的写入器 `cheatWriteValue` 最终执行的是
 *     `r.parent[r.leaf] = val;`        （04b-modcheat-write.js:140）
 *   这是一句**普通赋值**。本守卫把目标属性换成「getter + 受控 setter」，
 *   setter 在「非模组写入窗口」里**主动 throw TypeError**。
 *   该异常由 CE 自己的 try/catch（同文件 L96 / L146）接住，面板表现为
 *   「操作异常：...」，值不会落进存档。
 *
 *   注意：拦截强度**与 CE 是否开严格模式无关**——因为是我们主动抛，
 *   不是靠"严格模式下给 getter-only 属性赋值才报错"那套机制。
 *   （实测 CE 包体在 (function(){ "use strict"; ... })() 里，产物 L112-113，
 *    但即便它不开严格模式，这里照样抛。）
 *
 * 实测依据（dolonline534/unpacked/index.js，行号已逐条核对）：
 *   dgGold    唯一写入 L9523（进本置 0），模组从不给它加钱 → 合法态恒为 0
 *   dgInv     写入 L7610(dgAdd) / L7689(dolDgUse) / L7713(dolDgCook)
 *   mpSkill   写入 L8828(等级白送) / L8848(解锁) / L8871(洗点重建)
 *   mpSkillPts 写入 L1448 / L3087 / L3088 / L3891 / L8849 / L8873
 *   mpDgLv    写入 L5953/L5961（gainExpKind 里的 v[lvKey]，上限 99）
 *   dgFloor   写入 L1455 / L1460 / L9522
 *
 * 接入方式（二选一）：
 *   A. 推荐：把本文件作为独立脚本随包分发，在 index.js 最前面 require/eval，
 *      并把下面「需要改的写入点」逐条换成 DGAC.set(...) / DGAC.write(...)。
 *   B. 改动最小的兜底：只调用 DGAC.boot()，不装实时守卫（dgac.strict = false），
 *      仅靠 audit() 自检。能拦"不可能值"（如金币 9999），但拦不住"恰好合法"的值。
 * ============================================================ */
var DGAC = (function () {
	'use strict';

	var VERSION = '1.0.0';
	var TAG = '[DoLOnline] ';

	/* 唯一允许写状态的窗口计数（可嵌套，便于 write 里再调 write） */
	var W = 0;
	/* 容器键的当前真实对象与代理对象，按 key 存 */
	var slots = {};
	/* 拦截记录（内存，不进存档），上限 40 条 */
	var log = [];
	/* 是否安装实时守卫（A 方案 true / B 方案 false） */
	var strict = true;

	var INV_KEYS = ['fang', 'hide', 'herb', 'ore', 'dust', 'ember', 'slime',
		'pot_hp1', 'pot_hp2', 'pot_mp1', 'pot_mp2', 'pot_atk', 'pot_def', 'pot_agi',
		'food_soup', 'food_steak', 'food_stew', 'food_ember_tea'];

	function win() { return W > 0; }

	function note(kind, key, val) {
		try {
			log.push({ t: Date.now(), kind: kind, key: String(key), v: val });
			if (log.length > 40) { log.shift(); }
			if (typeof window !== 'undefined' && window) { window.__dgacLog = log; }
		} catch (e) { /* 记录器自身失败必须静默 */ }
	}

	function deny(key) {
		var e = new TypeError(TAG + '拒绝外部写入 ' + key + '（该状态只允许模组自身修改）');
		e.dolonlineGuard = true;
		return e;
	}

	/* ---- 状态对象取值：兼容模组自己的 VV() ---- */
	function getV() {
		try {
			if (typeof VV === 'function') { return VV(); }
		} catch (e) {}
		try {
			if (typeof window !== 'undefined' && window.State && window.State.variables) {
				return window.State.variables;
			}
		} catch (e2) {}
		return null;
	}

	/* ---- 标量键：装 getter/setter，外部写入抛 TypeError ---- */
	function armScalar(v, key) {
		if (!v || typeof v !== 'object') { return false; }
		var cur = v[key];
		var desc = Object.getOwnPropertyDescriptor(v, key);
		if (desc && desc.get && desc.get.__dolGuard) { return true; }   /* 已装，幂等 */

		var getter = function () { return cur; };
		getter.__dolGuard = true;
		Object.defineProperty(v, key, {
			configurable: true,
			enumerable: true,
			get: getter,
			set: function (x) {
				if (!win()) { note('reject', key, x); throw deny(key); }
				cur = x;
			}
		});
		return true;
	}

	/* ---- 容器键（dgInv / mpSkill）：键本身防整体替换，成员防逐键写 ---- */
	function makeProxy(key, real) {
		if (typeof Proxy !== 'function') { return real; }   /* 老运行环境降级为原对象 */
		var px = new Proxy(real, {
			set: function (t, k, val) {
				if (!win()) { note('reject', key + '.' + String(k), val); throw deny(key + '.' + String(k)); }
				t[k] = val;
				return true;
			},
			deleteProperty: function (t, k) {
				if (!win()) { note('reject-del', key + '.' + String(k), ''); throw deny(key + '.' + String(k)); }
				delete t[k];
				return true;
			}
		});
		/* 注意：绝不能给 px 自身赋标记属性——那会走它自己的 set trap 被自己拦下（实测踩过） */
		return px;
	}

	function armObj(v, key) {
		if (!v || typeof v !== 'object') { return false; }
		var real = v[key];
		if (real === null || typeof real !== 'object') { return false; }

		var desc = Object.getOwnPropertyDescriptor(v, key);
		if (desc && desc.get && desc.get.__dolGuard) {
			/* 已装容器键：仅当底层对象被换掉时刷新代理 */
			if (slots[key] && slots[key].real === real) { return true; }
		} else {
			slots[key] = { real: real, proxy: makeProxy(key, real) };
			var getter = function () {
				return slots[key] ? slots[key].proxy : undefined;
			};
			getter.__dolGuard = true;
			Object.defineProperty(v, key, {
				configurable: true,
				enumerable: true,
				get: getter,
				set: function (nv) {
					if (!win()) { note('reject', key, nv); throw deny(key); }
					slots[key] = { real: nv, proxy: makeProxy(key, nv) };
				}
			});
			return true;
		}
		slots[key] = { real: real, proxy: makeProxy(key, real) };
		return true;
	}

	/* ---- 安装 / 重装（存档加载会整体替换 State.variables，必须能重来） ---- */
	function boot() {
		var v = getV();
		if (!v) { return false; }
		if (!strict) { note('boot', 'skip-strict', ''); return true; }
		armScalar(v, 'dgGold');
		armScalar(v, 'mpSkillPts');
		armScalar(v, 'mpDgLv');
		armScalar(v, 'dgFloor');
		armObj(v, 'dgInv');
		armObj(v, 'mpSkill');
		return true;
	}

	/* ---- 对外写入入口（模组自身唯一合法通道） ---- */
	function write(fn) {
		W++;
		try { return fn(); } finally { W--; }
	}

	function set(container, key, val) {
		W++;
		try { container[key] = val; } finally { W--; }
	}

	/* ---- 兜底自检：清掉「守卫装上之前」就已经被写进来的不可能值 ---- */
	function audit() {
		var v = getV();
		if (!v) { return []; }
		var fixed = [];

		write(function () {
			if (Number(v.dgGold) !== 0) { fixed.push('dgGold(' + v.dgGold + '→0)'); v.dgGold = 0; }
			if (!(Number(v.mpSkillPts) >= 0)) { fixed.push('mpSkillPts(' + v.mpSkillPts + '→0)'); v.mpSkillPts = 0; }
			var lv = Number(v.mpDgLv);
			if (!(lv >= 1 && lv <= 99)) { fixed.push('mpDgLv(' + v.mpDgLv + '→1)'); v.mpDgLv = 1; }
			var fl = Number(v.dgFloor);
			if (!(fl >= 1 && fl <= 999)) { fixed.push('dgFloor(' + v.dgFloor + '→1)'); v.dgFloor = 1; }
			var inv = v.dgInv;
			if (inv && typeof inv === 'object') {
				for (var i = 0; i < INV_KEYS.length; i++) {
					var k = INV_KEYS[i], n = Number(inv[k]);
					if (inv[k] !== undefined && !(n >= 0 && n <= 99)) { fixed.push('dgInv.' + k + '(' + inv[k] + '→0)'); inv[k] = 0; }
				}
			}
			var sk = v.mpSkill;
			if (sk && typeof sk === 'object') {
				for (var k2 in sk) {
					if (!Object.prototype.hasOwnProperty.call(sk, k2)) { continue; }
					var m = Number(sk[k2]);
					if (!(m >= 0)) { fixed.push('mpSkill.' + k2 + '(' + sk[k2] + '→0)'); sk[k2] = 0; }
				}
			}
		});
		if (fixed.length) { note('audit', 'fixed', fixed.join(' / ')); }
		return fixed;
	}

	/* ---- 自动挂载：等待 SugarCube 就绪 → 装守卫 → 每次换页自检 ---- */
	var booted = false, tries = 0;
	function waitBoot() {
		if (boot()) {
			booted = true;
			audit();
			try {
				if (typeof jQuery === 'function') {
					jQuery(document).on(':passageinit', function () { boot(); audit(); });
				}
			} catch (e) {}
			try { setInterval(function () { boot(); audit(); }, 30000); } catch (e2) {}
			return;
		}
		tries++;
		if (tries > 60) { return; }
		setTimeout(waitBoot, 500);
	}

	/* ---- 公开 API ---- */
	return {
		version: VERSION,
		boot: boot,
		rearm: boot,
		audit: audit,
		write: write,
		set: set,
		deny: deny,
		log: log,
		invKeys: INV_KEYS,
		setStrict: function (on) { strict = !!on; },
		start: function () { try { waitBoot(); } catch (e) { note('boot-fail', 'waitBoot', String(e)); } },
		booted: function () { return booted; }
	};
})();

if (typeof window !== 'undefined' && window) { window.DGAC = DGAC; }
if (typeof module !== 'undefined' && module.exports) { module.exports = DGAC; }
