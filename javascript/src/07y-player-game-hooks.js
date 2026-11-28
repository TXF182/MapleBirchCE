/* 职责：玩家的游戏 · 真实运行时钩子与可逆快照。
   口径：开启时先快照再写；关闭时只还原没有被其它已开启项占用的路径。
   钩子：statChange 数值入口 / Time.pass / 地图可用表 / 犯罪清零 / 喷雾无限。
   零依赖：只包基础游戏已暴露的 window/Time 入口，不读取 DoLSims 的任何变量。 */
	var MB_CE_PG_HOOK_KNOWN_PROF = ["spray", "baton", "whip", "net", "pickaxe"];
	var MB_CE_PG_HOOK_STAT_METHODS = ["pain", "tiredness", "stress", "trauma", "arousal", "suspicion", "delinquency", "spray"];
	function mbCEPGCloneValue(v) {
		if (v === null || typeof v !== "object") { return v; }
		try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
	}
	function mbCEPGPathGet(V, path) {
		var parts = String(path).split("."), obj = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (!obj || typeof obj !== "object" || !Object.prototype.hasOwnProperty.call(obj, parts[i])) { return { ok: false }; }
			obj = obj[parts[i]];
		}
		if (!obj || typeof obj !== "object" || !Object.prototype.hasOwnProperty.call(obj, parts[parts.length - 1])) { return { ok: false }; }
		return { ok: true, val: obj[parts[parts.length - 1]] };
	}
	function mbCEPGPathSet(V, path, val) {
		try {
			var parts = String(path).split("."), obj = V, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (!obj[parts[i]] || typeof obj[parts[i]] !== "object") { obj[parts[i]] = {}; }
				obj = obj[parts[i]];
			}
			obj[parts[parts.length - 1]] = val;
		} catch (e) { /* 坏路径不写入 */ }
	}
	function mbCEPGPathDel(V, path) {
		try {
			var parts = String(path).split("."), obj = V, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (!obj || typeof obj !== "object" || !obj[parts[i]]) { return; }
				obj = obj[parts[i]];
			}
			if (obj && typeof obj === "object") { delete obj[parts[parts.length - 1]]; }
		} catch (e) { /* 缺键不造键 */ }
	}
	function mbCEPGAddPath(out, seen, path) {
		var p = String(path || "");
		if (!p || seen[p]) { return; }
		seen[p] = 1;
		out.push(p);
	}
	function mbCEPGAddPaths(out, seen, list) {
		(Array.isArray(list) ? list : [list]).forEach(function (p) { mbCEPGAddPath(out, seen, p); });
	}
	function mbCEPGCollectProfPaths(out, seen, V) {
		MB_CE_PG_HOOK_KNOWN_PROF.forEach(function (k) { mbCEPGAddPath(out, seen, "prof." + k); });
		if (V && V.prof && typeof V.prof === "object") {
			Object.keys(V.prof).forEach(function (k) { mbCEPGAddPath(out, seen, "prof." + k); });
		}
	}
	function mbCEPGIsSetOp(op) { return op === "set" || op === "clear"; }
	function mbCEPGCollectOpPaths(out, seen, op, V) {
		if (!op || !op.op) { return; }
		if (mbCEPGIsSetOp(op.op)) { mbCEPGAddPaths(out, seen, op.path); return; }
		if (op.op === "profAll") { mbCEPGCollectProfPaths(out, seen, V); return; }
		if (op.op === "statsMax" || op.op === "bookRes") { mbCEPGAddPaths(out, seen, MB_CE_PG_CORE_STATS.concat(["purity"])); return; }
		if (op.op === "skillsMax") { MB_CE_PG_SKILL_ITEMS.forEach(function (it) { mbCEPGAddPath(out, seen, it.path); }); return; }
		if (op.op === "statusLock") { MB_CE_PG_STATUS_SUBS.forEach(function (s) { mbCEPGAddPath(out, seen, s.id); }); return; }
		if (op.op === "transformSub") { mbCEPGAddPaths(out, seen, ["demon", "fallenangel", "angel"]); }
	}
	function mbCEPGEntryPaths(entry, V) {
		var out = [], seen = {};
		(entry.eff || []).forEach(function (op) { mbCEPGCollectOpPaths(out, seen, op, V); });
		if (entry.id === "infinite_items" || entry.id === "wolf_firepower") { mbCEPGAddPaths(out, seen, ["infinitespray", "spray", "spraymax"]); }
		if (entry.id === "library_unlock") { mbCEPGAddPaths(out, seen, ["sciencetrait", "mathstrait", "englishtrait", "historytrait"]); }
		if (entry.id === "charmer") { mbCEPGAddPath(out, seen, "allure"); }
		if (entry.id === "stealth") { mbCEPGAddPath(out, seen, "crime"); }
		return out;
	}
	function mbCEPGPathBusy(V, st, path, exceptId) {
		for (var i = 0; i < MB_CE_PG_REGISTRY.length; i++) {
			var e = MB_CE_PG_REGISTRY[i];
			if (e.id === exceptId || st.on[e.id] !== 1) { continue; }
			if (mbCEPGEntryPaths(e, V).indexOf(path) !== -1) { return true; }
		}
		return false;
	}
	function mbCEPGSnapshotExtra(bak, entry, V) {
		if (entry.id === "allmap" && V.map && typeof V.map === "object") {
			bak.s.map = { available: mbCEPGCloneValue(V.map.available), hideLinks: V.map.hideLinks };
		}
		if (entry.id === "charmer" && Array.isArray(V.NPCList)) {
			bak.s.love = V.NPCList.map(function (n, i) { return { i: i, v: n && n.love }; });
		}
	}
	function mbCEPGRealBefore(entry, V, st) {
		if (!entry || !V || !st) { return; }
		if (!st.meta.bak || typeof st.meta.bak !== "object") { st.meta.bak = {}; }
		if (st.meta.bak[entry.id]) { return; }
		/** @type {{p: Record<string, any>, s: Record<string, any>}} */
		var bak = { p: {}, s: {} };
		mbCEPGEntryPaths(entry, V).forEach(function (p) {
			var g = mbCEPGPathGet(V, p);
			bak.p[p] = g.ok ? { h: 1, v: mbCEPGCloneValue(g.val) } : { h: 0 };
		});
		mbCEPGSnapshotExtra(bak, entry, V);
		st.meta.bak[entry.id] = bak;
	}
	function mbCEPGApplyBakRecord(V, path, rec) {
		if (rec.h) { mbCEPGPathSet(V, path, mbCEPGCloneValue(rec.v)); } else { mbCEPGPathDel(V, path); }
	}
	function mbCEPGRestoreExtra(bak, V) {
		if (bak.s && bak.s.map && V.map && typeof V.map === "object") {
			V.map.available = mbCEPGCloneValue(bak.s.map.available);
			V.map.hideLinks = bak.s.map.hideLinks;
		}
		if (bak.s && bak.s.love && Array.isArray(V.NPCList)) {
			V.NPCList.forEach(function (n, i) { if (n && bak.s.love[i]) { n.love = bak.s.love[i].v; } });
		}
	}
	function mbCEPGRestorePathEntries(bak, V, st, entry) {
		Object.keys(bak.p || {}).forEach(function (p) {
			if (mbCEPGPathBusy(V, st, p, entry.id)) { return; }
			mbCEPGApplyBakRecord(V, p, bak.p[p]);
		});
	}
	function mbCEPGRealRestore(entry, V, st) {
		if (!entry || !V || !st || !st.meta || !st.meta.bak) { return; }
		var bak = st.meta.bak[entry.id];
		if (!bak) { return; }
		mbCEPGRestorePathEntries(bak, V, st, entry);
		mbCEPGRestoreExtra(bak, V);
		delete st.meta.bak[entry.id];
	}
	function mbCEPGRealRestoreAll(V, st) {
		if (!st) { return; }
		var ids = (st.meta && st.meta.bak) ? Object.keys(st.meta.bak) : [];
		ids.forEach(function (id) { var e = mbCEPGFind(id); if (e) { mbCEPGRealRestore(e, V, st); } });
		if (st.passive === 1) { mbCEPGRealPassiveApply(V, st); } else { mbCEPGRealPassiveRestore(V, st); }
	}
	function mbCEPGSubPath(entry, sub, V) {
		if (entry.id === "all_stats_max") { return sub; }
		if (entry.id === "all_skills_max") { return sub; }
		if (entry.id === "status_lock") { return sub; }
		if (entry.id === "triple_form") { return { demon: "demon", fallen: "fallenangel", angel: "angel" }[sub] || ""; }
		if (entry.id === "infinite_items") {
			if (sub === "consume") { return "infinitespray"; }
			if (sub === "capacity") { return "spraymax"; }
		}
		return "";
	}
	function mbCEPGSubRestoreTarget(entry, sub, V, st) {
		if (!entry || !V || !st || !st.meta || !st.meta.bak) { return null; }
		var bak = st.meta.bak[entry.id], path = mbCEPGSubPath(entry, sub, V);
		if (!bak || !path || !bak.p || !bak.p[path]) { return null; }
		return { bak: bak, path: path };
	}
	function mbCEPGRealRestoreSub(entry, sub, V, st) {
		var target = mbCEPGSubRestoreTarget(entry, sub, V, st);
		if (!target) { return; }
		if (mbCEPGPathBusy(V, st, target.path, entry.id)) { return; }
		mbCEPGApplyBakRecord(V, target.path, target.bak.p[target.path]);
		delete target.bak.p[target.path];
	}
	function mbCEPGRealPassiveApply(V, st) {
		if (!V || !st || st.passive !== 1) { return; }
		if (!st.meta.passiveBak) {
			var bak = {};
			MB_CE_PG_CORE_STATS.forEach(function (p) {
				var g = mbCEPGPathGet(V, p);
				bak[p] = g.ok ? { h: 1, v: mbCEPGCloneValue(g.val) } : { h: 0 };
			});
			st.meta.passiveBak = bak;
			MB_CE_PG_CORE_STATS.forEach(function (p) {
				var cur = Number(V[p]);
				if (isFinite(cur) && cur > 0) { V[p] = Math.min(999999, Math.floor(cur * 1.1)); }
			});
		}
		st.meta.passiveDone = 1;
	}
	function mbCEPGRealPassiveRestore(V, st) {
		if (!V || !st || !st.meta || !st.meta.passiveBak) { return; }
		var bak = st.meta.passiveBak;
		Object.keys(bak).forEach(function (p) {
			if (mbCEPGPathBusy(V, st, p, null)) { return; }
			var rec = bak[p];
			if (rec.h) { mbCEPGPathSet(V, p, mbCEPGCloneValue(rec.v)); } else { mbCEPGPathDel(V, p); }
		});
		delete st.meta.passiveBak;
		st.meta.passiveDone = 0;
	}
	function mbCEPGAllMap(V) {
		if (!V || !V.map || typeof V.map !== "object" || !V.map.available) { return; }
		var all = Array.isArray(V.map.arrayList) ? V.map.arrayList.slice() : Object.keys(V.map.available);
		Object.keys(V.map.available).forEach(function (k) { V.map.available[k] = all.slice(); });
		if (V.passage) { V.map.available[V.passage] = all.slice(); }
		V.map.hideLinks = false;
	}
	function mbCEPGZeroCrime(V) {
		if (!V || !V.crime || typeof V.crime !== "object") { return; }
		Object.keys(V.crime).forEach(function (k) {
			var c = V.crime[k];
			if (!c || typeof c !== "object") { return; }
			["current", "history", "daily", "count", "countHistory"].forEach(function (f) {
				if (typeof c[f] === "number") { c[f] = 0; }
			});
		});
	}
	function mbCEPGStatAmount(name, amount, st, V) {
		var n = Number(amount);
		if (!isFinite(n) || !st || mbCEPGBlocked()) { return amount; }
		var rule = MB_CE_PG_STAT_RULES[name];
		if (!rule) { return amount; }
		var out = rule(n, st, V);
		return (out === undefined) ? amount : out;
	}
	var MB_CE_PG_STAT_RULES = {
		pain: function (n, st) {
			if (n <= 0) { return n; }
			if (st.on.absolute_defense === 1 || st.on.fun_mode === 1) { return 0; }
			if (st.on.status_lock === 1 && mbCEPGSubOn("status_lock", "pain", st)) { return 0; }
			return n;
		},
		tiredness: function (n, st) {
			if (n <= 0) { return n; }
			if (st.on.infinite_body === 1 || st.on.fun_mode === 1 || st.on.library_shelter === 1 || st.on.reading_master === 1) { return 0; }
			return n;
		},
		stress: function (n, st) {
			if (n <= 0) { return n; }
			if (st.on.fun_mode === 1 || st.on.library_shelter === 1 || st.on.mind_wall === 1 || st.on.emperor_aegis === 1) { return 0; }
			return n;
		},
		trauma: function (n, st) {
			if (n <= 0) { return n; }
			if (st.on.fun_mode === 1 || st.on.library_shelter === 1 || st.on.mind_wall === 1 || st.on.emperor_aegis === 1 || st.on.undying_father === 1) { return 0; }
			return n;
		},
		arousal: function (n, st) {
			if (n > 0 && st.on.status_lock === 1 && mbCEPGSubOn("status_lock", "arousal", st)) { return 0; }
			return n;
		},
		suspicion: function (n, st) {
			if (n > 0 && (st.on.stealth === 1 || st.on.charmer === 1 || st.on.common_sense === 1)) { return 0; }
			return n;
		},
		delinquency: function (n, st) {
			if (n > 0 && (st.on.stealth === 1 || st.on.charmer === 1 || st.on.common_sense === 1)) { return 0; }
			return n;
		},
		spray: function (n, st) {
			if (n < 0 && st.on.wolf_firepower === 1) { return 0; }
			return n;
		}
	};
	function mbCEPGInstallHooks() {
		try {
			if (typeof window === "undefined" || window.__mbCEPGStatHooks === true) { return true; }
			var sc = window.statChange;
			if (!sc || typeof sc !== "object") { return false; }
			MB_CE_PG_HOOK_STAT_METHODS.forEach(function (name) {
				var orig = sc[name];
				if (typeof orig !== "function" || orig.__mbCEPG) { return; }
				var wrapped = function () {
					var args = Array.prototype.slice.call(arguments);
					try {
						var V = mbCEPGV();
						var st = V ? mbCEPGState() : null;
						if (st) { args[0] = mbCEPGStatAmount(name, args[0], st, V); }
					} catch (e) { /* 钩子异常不阻断原版结算 */ }
					return orig.apply(sc, args);
				};
				wrapped.__mbCEPG = true;
				wrapped.__mbCEPGOrig = orig;
				sc[name] = wrapped;
			});
			window.__mbCEPGStatHooks = true;
			return true;
		} catch (e) { return false; }
	}
	function mbCEPGInReading(V) {
		return /(library|book|read|study|class|school)/i.test(String((V && V.passage) || ""));
	}
	function mbCEPGTimeReadingAmount(n, st) {
		if (st.on.library_unlock === 1 && mbCEPGSubOn("library_unlock", "instant", st)) { return 0; }
		if (st.on.reading_master === 1 || st.on.quantum_cram === 1 || st.on.library_unlock === 1) { return Math.max(1, Math.floor(n / 2)); }
		return -1;
	}
	function mbCEPGTimeAmount(seconds, st, V) {
		var n = Number(seconds);
		if (!isFinite(n) || n <= 0 || !st) { return seconds; }
		if (st.on.time_control === 1 && n <= 600) { return 0; }
		if (!mbCEPGInReading(V) || n > 600) { return seconds; }
		var reading = mbCEPGTimeReadingAmount(n, st);
		return reading < 0 ? seconds : reading;
	}
	function mbCEPGInstallTimeHook() {
		try {
			if (typeof window === "undefined" || window.__mbCEPGTimeHook === true) { return true; }
			var T = (typeof Time !== "undefined") ? Time : window.Time;
			if (!T || typeof T.pass !== "function" || T.pass.__mbCEPG) { return false; }
			var orig = T.pass;
			T.pass = function (seconds) {
				var args = Array.prototype.slice.call(arguments);
				try {
					var V = mbCEPGV();
					var st = V ? mbCEPGState() : null;
					if (st) { args[0] = mbCEPGTimeAmount(seconds, st, V); }
					if (args[0] === 0) { return; }
				} catch (e) { /* 时间钩子异常走原版 */ }
				return orig.apply(T, args);
			};
			T.pass.__mbCEPG = true;
			T.pass.__mbCEPGOrig = orig;
			window.__mbCEPGTimeHook = true;
			return true;
		} catch (e2) { return false; }
	}
	function mbCEPGInstallDangerHook() {
		try {
			if (typeof window === "undefined" || window.__mbCEPGDangerHook === true || typeof window.dangerEvent !== "function") { return false; }
			var orig = window.dangerEvent;
			window.dangerEvent = function () {
				try {
					var st = mbCEPGState();
					if (!mbCEPGBlocked() && st.on.allmap === 1) { return false; }
				} catch (e) { /* 钩子异常走原版 */ }
				return orig.apply(window, arguments);
			};
			window.dangerEvent.__mbCEPG = true;
			window.__mbCEPGDangerHook = true;
			return true;
		} catch (e2) { return false; }
	}
	function mbCEPGBookCount(st) {
		return MB_CE_PG_REGISTRY.filter(function (e) { return e.group === "books" && st.on[e.id] === 1; }).length;
	}
	function mbCEPGBookPercent(st, n) {
		var tiers = [{ id: "b2", n: 2, pct: 5 }, { id: "b4", n: 4, pct: 10 }, { id: "b6", n: 6, pct: 15 },
			{ id: "b8", n: 8, pct: 20 }, { id: "b10", n: 10, pct: 30 }], pct = 0;
		tiers.forEach(function (t) {
			if (n >= t.n && mbCEPGSubOn("book_resonance", t.id, st)) { pct = Math.max(pct, t.pct); }
		});
		return pct;
	}
	function mbCEPGApplyBookRes(V, st) {
		var bak = st.meta.bak && st.meta.bak.book_resonance, pct = mbCEPGBookPercent(st, mbCEPGBookCount(st));
		if (!bak || !bak.p) { return; }
		MB_CE_PG_CORE_STATS.forEach(function (p) {
			var rec = bak.p[p], base = (rec && rec.h) ? Number(rec.v) : Number(V[p]);
			if (!isFinite(base)) { return; }
			V[p] = pct > 0 ? Math.min(999999, Math.floor(base * (1 + pct / 100))) : base;
		});
	}
	var MB_CE_PG_REAL_AFTER = {
		allmap: function (V) { mbCEPGAllMap(V); mbCEPGInstallDangerHook(); },
		stealth: function (V) { V.skulduggery = 1000; V.suspicion = 0; V.exposed = 0; mbCEPGZeroCrime(V); },
		charmer: function (V) { V.allure = Math.max(Number(V.allure) || 0, 10000); mbCEPGZeroCrime(V); },
		common_sense: function (V) { mbCEPGZeroCrime(V); },
		time_control: function () { mbCEPGInstallTimeHook(); },
		absolute_defense: function (V) { V.pain = 0; mbCEPGInstallHooks(); },
		infinite_body: function (V) { V.tiredness = 0; },
		infinite_items: function (V) { V.infinitespray = 1; V.spraymax = Math.max(Number(V.spraymax) || 0, 8); V.spray = V.spraymax; },
		wolf_firepower: function (V) { V.infinitespray = 1; V.spraymax = Math.max(Number(V.spraymax) || 0, 8); V.spray = Math.max(Number(V.spray) || 0, V.spraymax); },
		library_unlock: function (V) { V.sciencetrait = 4; V.mathstrait = 4; V.englishtrait = 4; V.historytrait = 4; },
			mirror_lord: function (V) { V.mbCE_pg_mirrorLevel = 6; },
		tentacle_king: function (V) { V.mbCE_pg_tentacleLevel = Math.max(Number(V.mbCE_pg_tentacleLevel) || 0, 1); },
		fun_mode: function (V) { V.pain = 0; },
		fate_driver: function (V) { if (Number(V.tiredness) > 2000) { V.stress = 0; V.trauma = 0; } },
		library_owner: function (V) { V.mbCE_pg_libraryOwner = 1; },
		book_resonance: function (V, st) { mbCEPGApplyBookRes(V, st); }
	};
	function mbCEPGRealAfter(entry, V, st) {
		mbCEPGInstallHooks();
		var h = MB_CE_PG_REAL_AFTER[entry.id];
		if (h) { h(V, st, entry); }
		if (entry.id === "one_hit" && Number(V.combat) === 1) { mbCEPGZeroEnemies(V); }
	}
