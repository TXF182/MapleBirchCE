/* 职责：玩家的游戏 · 核心引擎。
   状态：V.mbCE_playerGame（存档内持久）。默认 62 项全关、特质被动开、爽玩模式。
   写入口径：开启时执行一次效果；每次 passage tick 对已开启项复写，防原版结算冲掉。
   零依赖：不读取 DoLSims 的变量/文件/特质；特质注册到基础游戏 traits 表。 */
	function mbCEPGV() {
		try { var v = getV(); if (v && typeof v === "object") { return v; } } catch (e) {}
		try { if (typeof V !== "undefined" && V && typeof V === "object") { return V; } } catch (e2) {}
		return null;
	}
	function mbCEPGFind(id) {
		for (var i = 0; i < MB_CE_PG_REGISTRY.length; i++) { if (MB_CE_PG_REGISTRY[i].id === id) { return MB_CE_PG_REGISTRY[i]; } }
		return null;
	}
	function mbCEPGBlocked() { try { return typeof mbCEPureIsOn === "function" && mbCEPureIsOn() === true; } catch (e) { return false; } }
	function mbCEPGMap(st, key) {
		if (!st[key] || typeof st[key] !== "object") { st[key] = {}; }
	}
	function mbCEPGNormalize(st) {
		["on", "subs", "fav", "flags", "meta"].forEach(function (k) { mbCEPGMap(st, k); });
		st.passive = (st.passive === 0) ? 0 : 1;
		st.mode = (st.mode === "vanilla") ? "vanilla" : "fun";
		st.trait = (st.trait === 1) ? 1 : 0;
		st.filter = (typeof st.filter === "string") ? st.filter : "";
		MB_CE_PG_REGISTRY.forEach(function (e) {
			if (st.on[e.id] !== 0 && st.on[e.id] !== 1) { st.on[e.id] = 0; }
		});
	}
	function mbCEPGState() {
		var V = mbCEPGV();
		var fallback = { v: 1, on: {}, subs: {}, fav: {}, flags: {}, meta: {}, passive: 1, mode: "fun", trait: 0, filter: "" };
		if (!V) { return fallback; }
		if (!V.mbCE_playerGame || typeof V.mbCE_playerGame !== "object") { V.mbCE_playerGame = {}; }
		var st = V.mbCE_playerGame;
		st.v = 1;
		mbCEPGNormalize(st);
		return st;
	}
	function mbCEPGSubKey(id, sub) { return String(id) + "|" + String(sub); }
	function mbCEPGSubOn(id, sub, st) {
		var key = mbCEPGSubKey(id, sub);
		var v = (st && st.subs) ? st.subs[key] : undefined;
		return (v === 0 || v === "0") ? false : true;
	}
	function mbCEPGSetPath(V, path, val) {
		try {
			var parts = String(path).split("."), obj = V, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") { obj[parts[i]] = {}; }
				obj = obj[parts[i]];
			}
			obj[parts[parts.length - 1]] = val;
		} catch (e) { /* 坏路径不写入，避免造脏键 */ }
	}
	function mbCEPGClearPath(V, path) {
		try {
			var parts = String(path).split("."), obj = V, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (!obj || typeof obj !== "object" || !obj[parts[i]]) { return; }
				obj = obj[parts[i]];
			}
			if (obj && Object.prototype.hasOwnProperty.call(obj, parts[parts.length - 1])) {
				obj[parts[parts.length - 1]] = 0;
			}
		} catch (e) { /* 缺键不造键 */ }
	}
	function mbCEPGStatsMax(entry, V, st) {
		var hasSubs = entry.subs && entry.subs.length > 0;
		MB_CE_PG_CORE_STATS.forEach(function (p) {
			if (!hasSubs || mbCEPGSubOn(entry.id, p, st)) { V[p] = 999999; }
		});
		V.purity = 2000;
	}
	function mbCEPGSkillsMax(entry, V, st) {
		var hasSubs = entry.subs && entry.subs.length > 0;
		MB_CE_PG_SKILL_ITEMS.forEach(function (it) {
			if (!hasSubs || mbCEPGSubOn(entry.id, it.path, st)) { mbCEPGSetPath(V, it.path, 1000); }
		});
	}
	function mbCEPGProfAll(V, val) {
		if (!V.prof || typeof V.prof !== "object") { V.prof = {}; }
		var keys = ["spray", "baton", "whip", "net", "pickaxe"];
		Object.keys(V.prof).forEach(function (k) { if (keys.indexOf(k) === -1) { keys.push(k); } });
		keys.forEach(function (k) { V.prof[k] = val; });
	}
	function mbCEPGStatusLock(entry, V, st) {
		MB_CE_PG_STATUS_SUBS.forEach(function (s) {
			if (mbCEPGSubOn(entry.id, s.id, st)) { V[s.id] = 0; }
		});
	}
	function mbCEPGTransformSub(entry, V, st) {
		var map = { demon: "demon", fallen: "fallenangel", angel: "angel" };
		(entry.subs || []).forEach(function (s) {
			if (map[s.id] && mbCEPGSubOn(entry.id, s.id, st)) { V[map[s.id]] = 10; }
		});
	}
	function mbCEPGDailyGrow(op, V, st) {
		var today = 0;
		try { today = (typeof Time !== "undefined" && Time && typeof Time.days === "number") ? Time.days : (Number(V.day) || 0); } catch (e) { today = Number(V.day) || 0; }
		if (st.meta.lastGrowDay === today) { return; }
		st.meta.lastGrowDay = today;
		var cur = Number(V[op.key]) || 0;
		V[op.key] = Math.min(Number(op.max) || 10, cur + 1);
	}
	function mbCEPGPurityBranch(V, st) {
		if (st.meta.pleasureApplied === 1) { return; }
		var purity = Number(V.purity);
		if (!isFinite(purity)) { purity = 1000; }
		if (Number(V.demon) >= 6) { V.purity = Math.max(0, purity - 200); purity = V.purity; }
		if (Number(V.fallenangel) >= 4) { V.purity = Math.min(2000, purity + 180); }
		st.meta.pleasureApplied = 1;
	}
	var MB_CE_PG_OPS = {
		set: function (c) {
			(Array.isArray(c.op.path) ? c.op.path : [c.op.path]).forEach(function (p) { mbCEPGSetPath(c.V, p, c.op.val); });
		},
		clear: function (c) {
			(Array.isArray(c.op.path) ? c.op.path : [c.op.path]).forEach(function (p) { mbCEPGClearPath(c.V, p); });
		},
		flag: function (c) { c.st.flags[c.op.key] = (c.op.val === undefined) ? 1 : c.op.val; },
		profAll: function (c) { mbCEPGProfAll(c.V, c.op.val); },
		statsMax: function (c) { mbCEPGStatsMax(c.entry, c.V, c.st); },
		skillsMax: function (c) { mbCEPGSkillsMax(c.entry, c.V, c.st); },
		statusLock: function (c) { mbCEPGStatusLock(c.entry, c.V, c.st); },
		transformSub: function (c) { mbCEPGTransformSub(c.entry, c.V, c.st); },
		loveAll: function (c) {
			if (Array.isArray(c.V.NPCList)) {
				c.V.NPCList.forEach(function (n) { if (n && typeof n === "object") { n.love = c.op.val; } });
			}
		},
		dailyGrow: function (c) { mbCEPGDailyGrow(c.op, c.V, c.st); },
		chips: function (c) {
			c.V.mbCE_pg_chips = Math.max(Number(c.V.mbCE_pg_chips) || 0, Number(c.op.val) || 0);
		},
		bookRes: function (c) {
			if ((c.entry.subs || []).some(function (s) { return mbCEPGSubOn(c.entry.id, s.id, c.st); })) {
				MB_CE_PG_CORE_STATS.forEach(function (p) { c.V[p] = 999999; });
				c.V.purity = 2000;
			}
		},
		purityBranch: function (c) { mbCEPGPurityBranch(c.V, c.st); }
	};
	function mbCEPGApplyOp(op, entry, V, st) {
		if (!op || !op.op) { return; }
		var h = MB_CE_PG_OPS[op.op];
		if (h) { h({ op: op, entry: entry, V: V, st: st }); }
	}
	function mbCEPGApplyEntry(entry, V, st) {
		if (!entry || !V) { return; }
		if (typeof mbCEPGRealBefore === "function") { mbCEPGRealBefore(entry, V, st); }
		(entry.eff || []).forEach(function (op) { mbCEPGApplyOp(op, entry, V, st); });
		if (typeof mbCEPGRealAfter === "function") { mbCEPGRealAfter(entry, V, st); }
	}
	function mbCEPGApplyAll(V, st) {
		MB_CE_PG_REGISTRY.forEach(function (e) {
			if (st.on[e.id] === 1) { mbCEPGApplyEntry(e, V, st); }
		});
	}
	function mbCEPGPassiveOnce(V, st) {
		if (!V || !st.passive || st.meta.passiveDone === 1) { return; }
		if (typeof mbCEPGRealPassiveApply === "function") { mbCEPGRealPassiveApply(V, st); }
	}
	function mbCEPGTraitConfig() {
		return {
			title: "枫桦扩展",
			name: "玩家的游戏",
			colour: "gold",
			has: function () { return mbCEPGState().trait === 1; },
			text: function () {
				var st = mbCEPGState();
				return "枫桦扩展 · 62 项纯增益总开关；首次启用任一项后永久获得。" +
					(st.passive ? " 特质被动：全属性 +10%。" : " 特质被动已关闭。");
			}
		};
	}
	function mbCEPGTraitListOf(o) {
		try { return (o && Array.isArray(o.traitLists)) ? o.traitLists : null; } catch (e) { return null; }
	}
	function mbCEPGTraitLists() {
		var getters = [
			function () { return (typeof T !== "undefined") ? T : null; },
			function () { return (typeof window !== "undefined") ? window.T : null; },
			function () { return (typeof State !== "undefined" && State && State.temporary) ? State.temporary : null; },
			function () {
				try {
					var mb = resolveMB();
					return (mb && mb.host && mb.host.dol) ? mb.host.dol.temporary : null;
				} catch (e) { return null; }
			}
		];
		for (var i = 0; i < getters.length; i++) {
			try {
				var lists = mbCEPGTraitListOf(getters[i]());
				if (lists) { return lists; }
			} catch (e2) {}
		}
		return null;
	}
	function mbCEPGTraitFramework(cfg) {
		try {
			var mb = resolveMB();
			if (!(mb && mb.tool && mb.tool.patch && typeof mb.tool.patch.addTraits === "function")) { return null; }
			mb.tool.patch.addTraits(cfg);
			if (typeof mb.tool.patch.injectTraits === "function") { mb.tool.patch.injectTraits(); }
			if (typeof window !== "undefined") { window.__mbCEPGTraitRegistered = true; }
			return { ok: true, message: "特质已注册到基础游戏 traits" };
		} catch (e) { return null; }
	}
	function mbCEPGTraitFallback(cfg) {
		try {
			var lists = mbCEPGTraitLists();
			if (!Array.isArray(lists)) { return { ok: false, message: "traits 表不可用，暂未注册" }; }
			var cat = null;
			for (var i = 0; i < lists.length; i++) { if (lists[i] && lists[i].title === cfg.title) { cat = lists[i]; break; } }
			if (!cat) { cat = { title: cfg.title, traits: [] }; lists.push(cat); }
			if (!Array.isArray(cat.traits)) { cat.traits = []; }
			var exists = cat.traits.some(function (t) { return t && t.name === cfg.name; });
			if (!exists) { cat.traits.push(cfg); }
			if (typeof window !== "undefined") { window.__mbCEPGTraitRegistered = true; }
			return { ok: true, message: "特质已写入 traits 表" };
		} catch (e2) { return { ok: false, message: "特质注册失败" }; }
	}
	function mbCEPGRegisterTrait() {
		if (typeof window !== "undefined" && window.__mbCEPGTraitRegistered === true) { return { ok: true, message: "特质已注册" }; }
		var cfg = mbCEPGTraitConfig();
		return mbCEPGTraitFramework(cfg) || mbCEPGTraitFallback(cfg);
	}
	function mbCEPGInstallMoneyHook() {
		try {
			if (typeof window === "undefined" || !window.statChange || typeof window.statChange.money !== "function") { return false; }
			var sc = window.statChange;
			if (sc.money.__mbCEPG === true) { return true; }
			var orig = sc.money;
			var wrapped = function (amount, source, optional) {
				return orig.call(sc, mbCEPGMoneyAmount(amount, source, optional), source, optional);
			};
			wrapped.__mbCEPG = true;
			wrapped.__mbCEPGOrig = orig;
			sc.money = wrapped;
			return true;
		} catch (e) { return false; }
	}
	function mbCEPGIncomeMult(st, source) {
		var mult = 1;
		if (st.on.fortune_bless === 1 && mbCEPGSubOn("fortune_bless", "income", st)) { mult *= 4; }
		if (st.on.loot_carnival === 1 && /(combat|loot|defeat|reward|rob|mug|battle|fight|arena)/i.test(String(source || ""))) { mult *= 4; }
		return mult;
	}
	function mbCEPGMoneyAmount(amount, source, optional) {
		var n = Number(amount);
		if (!isFinite(n)) { return amount; }
		if (optional && optional.recordOnly) { return n; }
		if (mbCEPGBlocked()) { return n; }
		var st = mbCEPGState();
		if (n > 0) { return Math.floor(n * mbCEPGIncomeMult(st, source)); }
		if (n < 0 && st.on.fortune_bless === 1 && mbCEPGSubOn("fortune_bless", "expense", st)) {
			return -Math.floor(Math.abs(n) * 0.5);
		}
		return n;
	}
	function mbCEPGZeroEnemies(V) {
		try {
			if (Array.isArray(V.NPCList)) {
				V.NPCList.forEach(function (n) {
					if (!n || typeof n !== "object" || typeof n.health !== "number") { return; }
					if (n.boss || n.isBoss || n.bossType) { n.health = Math.max(0, Math.floor(n.health * 0.5)); }
					else { n.health = 0; }
				});
			}
			if (V.struggle && V.struggle.enemy && typeof V.struggle.enemy === "object") {
				Object.keys(V.struggle.enemy).forEach(function (k) {
					var e = V.struggle.enemy[k];
					if (e && typeof e.health === "number") { e.health = 0; }
				});
			}
		} catch (e) { /* 战斗结构异常不阻断 tick */ }
	}
	function mbCEPGTick() {
		var V = mbCEPGV();
		if (!V || mbCEPGBlocked()) { return; }
		var st = mbCEPGState();
		if (!st) { return; }
		mbCEPGInstallMoneyHook();
		MB_CE_PG_REGISTRY.forEach(function (e) {
			if (st.on[e.id] === 1) { mbCEPGApplyEntry(e, V, st); }
		});
		if (st.on.fate_driver === 1 && Number(V.tiredness) > 2000) { V.stress = 0; V.trauma = 0; }
		if (Number(V.combat) === 1) {
			if (st.on.absolute_defense === 1 || st.on.blood_rage === 1) { V.pain = 0; }
		}
	}
	function mbCEPGSet(id, on) {
		if (mbCEPGBlocked()) { return { ok: false, message: "纯净模式已开启，能力写入被拒绝" }; }
		var entry = mbCEPGFind(id);
		if (!entry) { return { ok: false, message: "未知能力：" + id }; }
		var st = mbCEPGState();
		st.on[id] = on ? 1 : 0;
		if (!on && typeof mbCEPGRealRestore === "function") { mbCEPGRealRestore(entry, mbCEPGV(), st); }
		if (on) {
			st.trait = 1;
			mbCEPGPassiveOnce(mbCEPGV(), st);
			mbCEPGRegisterTrait();
			mbCEPGApplyEntry(entry, mbCEPGV(), st);
			mbCEPGInstallMoneyHook();
		}
		return { ok: true, message: (on ? "已开启「" : "已关闭「") + entry.name + "」" };
	}
	function mbCEPGSetSub(id, sub, on) {
		if (mbCEPGBlocked()) { return { ok: false, message: "纯净模式已开启，子开关写入被拒绝" }; }
		var entry = mbCEPGFind(id);
		if (!entry) { return { ok: false, message: "未知能力：" + id }; }
		var hit = (entry.subs || []).some(function (s) { return s.id === sub; });
		if (!hit) { return { ok: false, message: "未知子开关：" + sub }; }
		var st = mbCEPGState();
		st.subs[mbCEPGSubKey(id, sub)] = on ? 1 : 0;
		/* 口径：无论子开关开还是关，只要玩家单独操作了子开关，主开关就自动打开。 */
		st.on[id] = 1;
		if (!on && typeof mbCEPGRealRestoreSub === "function") { mbCEPGRealRestoreSub(entry, sub, mbCEPGV(), st); }
		st.trait = 1;
		mbCEPGRegisterTrait();
		if (on) { mbCEPGApplyEntry(entry, mbCEPGV(), st); }
		return { ok: true, message: "子开关「" + sub + "」已" + (on ? "开启" : "关闭") + "，主开关同步" };
	}
	function mbCEPGAll(on) {
		if (on && mbCEPGBlocked()) { return { ok: false, message: "纯净模式已开启，一键全开被拒绝" }; }
		var st = mbCEPGState();
		MB_CE_PG_REGISTRY.forEach(function (e) { st.on[e.id] = on ? 1 : 0; });
		st.passive = on ? 1 : 0;
		if (!on && typeof mbCEPGRealRestoreAll === "function") { mbCEPGRealRestoreAll(mbCEPGV(), st); }
		if (on) {
			st.trait = 1;
			mbCEPGRegisterTrait();
			mbCEPGPassiveOnce(mbCEPGV(), st);
			mbCEPGApplyAll(mbCEPGV(), st);
			mbCEPGInstallMoneyHook();
		}
		return { ok: true, message: on ? "已一键全开 62 项 + 特质被动" : "已一键全关 62 项 + 特质被动" };
	}
	function mbCEPGReset() {
		var st = mbCEPGState();
		MB_CE_PG_REGISTRY.forEach(function (e) { st.on[e.id] = 0; });
		st.passive = 1;
		st.mode = "fun";
		if (typeof mbCEPGRealRestoreAll === "function") { mbCEPGRealRestoreAll(mbCEPGV(), st); }
		return { ok: true, message: "已恢复默认：62 项全关、特质被动开、爽玩模式；特质保留" };
	}
	function mbCEPGPreset(key) {
		if (mbCEPGBlocked()) { return { ok: false, message: "纯净模式已开启，预设写入被拒绝" }; }
		var maps = {
			full: MB_CE_PG_REGISTRY.map(function (e) { return e.id; }),
			library: MB_CE_PG_REGISTRY.filter(function (e) { return e.group === "books" || e.group === "mirror" || e.group === "system"; }).map(function (e) { return e.id; }),
			battle: ["arsenal_open", "blood_rage", "emperor_aegis", "mirror_lord", "killer_instinct", "infinite_body", "temple_arms", "umbrella_mastery", "tentacle_weapon", "wolf_firepower", "fujin_toy", "baseball_bat", "weapon_master", "absolute_defense", "one_hit", "loot_carnival", "all_stats_max", "all_skills_max", "status_lock"],
			life: ["fortune_bless", "book_resonance", "library_shelter", "reading_master", "fate_chips", "tentacle_grow", "fun_mode", "library_owner", "allmap", "stealth", "time_control", "charmer", "infinite_items", "library_unlock", "triple_form", "transform_free", "all_stats_max", "all_skills_max", "status_lock", "presets"]
		};
		if (!maps[key]) { return { ok: false, message: "未知预设：" + key }; }
		var st = mbCEPGState();
		MB_CE_PG_REGISTRY.forEach(function (e) { st.on[e.id] = 0; });
		st.passive = 1;
		if (typeof mbCEPGRealRestoreAll === "function") { mbCEPGRealRestoreAll(mbCEPGV(), st); }
		maps[key].forEach(function (id) { st.on[id] = 1; });
		st.trait = 1;
		mbCEPGRegisterTrait();
		mbCEPGPassiveOnce(mbCEPGV(), st);
		mbCEPGApplyAll(mbCEPGV(), st);
		mbCEPGInstallMoneyHook();
		return { ok: true, message: "已应用预设「" + key + "」（" + maps[key].length + " 项）" };
	}
	function mbCEPGSetMode(mode) {
		if (mode !== "fun" && mode !== "vanilla") { return { ok: false, message: "未知模式：" + mode }; }
		var st = mbCEPGState();
		st.mode = mode;
		st.trait = 1;
		mbCEPGRegisterTrait();
		mbCEPGPassiveOnce(mbCEPGV(), st);
		return { ok: true, message: mode === "fun" ? "已切到爽玩模式" : "已切到原版模式" };
	}
	function mbCEPGSetPassive(on) {
		var st = mbCEPGState();
		st.passive = on ? 1 : 0;
		if (on) { st.trait = 1; mbCEPGRegisterTrait(); mbCEPGPassiveOnce(mbCEPGV(), st); }
		if (!on && typeof mbCEPGRealPassiveRestore === "function") { mbCEPGRealPassiveRestore(mbCEPGV(), st); }
		return { ok: true, message: "特质被动已" + (on ? "开启" : "关闭") };
	}
	function mbCEPGFav(id) {
		var entry = mbCEPGFind(id);
		if (!entry) { return { ok: false, message: "未知能力：" + id }; }
		var st = mbCEPGState();
		st.fav[id] = st.fav[id] === 1 ? 0 : 1;
		return { ok: true, message: (st.fav[id] === 1 ? "已收藏「" : "已取消收藏「") + entry.name + "」" };
	}
	function mbCEPGStatus() {
		var st = mbCEPGState();
		var n = 0;
		MB_CE_PG_REGISTRY.forEach(function (e) { if (st.on[e.id] === 1) { n++; } });
		return { total: MB_CE_PG_REGISTRY.length, on: n, passive: st.passive, mode: st.mode, trait: st.trait };
	}
