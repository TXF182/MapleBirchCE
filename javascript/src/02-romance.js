	/* ============ 恋爱剧情阶段（原生条件，自动解析） ============ */
	function getRomanceList(name) {
		var list = null;
		try {
			var mb = resolveMB();
			if (mb && mb.npc) {
				var rc = mb.npc.romanceConditions;
				if (rc && typeof rc === "object") {
					var keys = Object.keys(rc);
					var k = String(name).toLowerCase();
					for (var i = 0; i < keys.length; i++) {
						if (keys[i].toLowerCase() === k) { list = rc[keys[i]]; break; }
					}
				}
				if (!Array.isArray(list)) {
					var d = mb.npc.data instanceof Map ? mb.npc.data.get(name) : null;
					if (!d && mb.npc.data instanceof Map) {
						var dk = String(name).toLowerCase();
						mb.npc.data.forEach(function (v, n2) { if (String(n2).toLowerCase() === dk) { d = v; } });
					}
					var cfg = d && d.Config;
					if (cfg && Array.isArray(cfg.romance)) { list = cfg.romance; }
				}
			}
		} catch (e) {}
		return Array.isArray(list) ? list : [];
	}
	/* 原生恋爱 NPC 判定（不走 Maplebirch 注册池，如阿电：V.loveInterest / setup.loveAlias / T.npcConfig 标记） */
	function checkNativeLove(name) {
		try {
			var V = getV();
			var li = V.loveInterest;
			if (li) {
				if (Array.isArray(li)) {
					for (var i = 0; i < li.length; i++) { if (li[i] && String(li[i]).toLowerCase() === String(name).toLowerCase()) { return true; } }
				} else if (typeof li === "object") {
					for (var k in li) { if (li[k] && String(li[k]).toLowerCase() === String(name).toLowerCase()) { return true; } }
				}
			}
			if (typeof setup !== "undefined" && setup && setup.loveAlias && setup.loveAlias[name]) { return true; }
			if (typeof T !== "undefined" && T && T.npcConfig) {
				var c = T.npcConfig[name];
				/* v1.4.5：仅明确的恋爱标记（loveInterest）算恋爱候选；important（重要 NPC）不算——
				   否则非恋爱角色会被误判为恋爱候选而在恋爱阶段区显示"恋人卡槽"条件 */
				if (c && c.loveInterest === true) { return true; }
			}
		} catch (e) {}
		return false;
	}
	/* 恋爱候选判定（v1.4.5）：能进恋人卡槽（loveInterest）的角色才在角色一览显示。
	   判定：框架恋爱条件 / 原版恋爱阶段系统（格威岚）/ 恋爱标记（loveAlias·npcConfig·loveInterest）/ MLI 扩容恋人列表 */
	function isLoveCandidate(name) {
		try {
			if (getRomanceList(name).length > 0) { return true; }
			if (hasVanillaRomance(name)) { return true; }
			if (checkNativeLove(name)) { return true; }
			var V = getV();
			if (V && Array.isArray(V.loveInterestList)) {
				var k = String(name).toLowerCase();
				for (var i = 0; i < V.loveInterestList.length; i++) {
					var it = V.loveInterestList[i];
					if (it && String(it).toLowerCase() === k) { return true; }
				}
			}
		} catch (e) {}
		return false;
	}
	function getRomanceStages(name) {
		var out = [];
		getRomanceList(name).forEach(function (fn, idx) {
			if (typeof fn !== "function") { return; }
			var txt = "";
			try { txt = String(fn); } catch (e) { txt = "(条件不可读)"; }
			var ok = false;
			try { ok = !!fn(); } catch (e) { ok = false; }
			out.push({ index: idx, text: txt, ok: ok, fn: fn });
		});
		/* 原生恋爱 NPC 兜底：框架无条件时给通用"恋人（loveInterest 槽位）"条件 */
		if (!out.length && checkNativeLove(name)) {
			out.push({
				index: 0,
				text: '() => rv.variables.loveInterest.includes("' + name + '")',
				ok: loveInterestHas(name),
				fn: null,
				native: true
			});
		}
		return out;
	}
	function loveInterestHas(name) {
		try {
			var V = getV();
			var li = V.loveInterest;
			if (!li) { return false; }
			if (Array.isArray(li)) {
				for (var i = 0; i < li.length; i++) { if (li[i] && String(li[i]).toLowerCase() === String(name).toLowerCase()) { return true; } }
			} else if (typeof li === "object") {
				for (var k in li) { if (li[k] && String(li[k]).toLowerCase() === String(name).toLowerCase()) { return true; } }
			}
		} catch (e) {}
		return false;
	}
	/* 加入恋人卡槽（v1.4.5）：恋爱阶段兜底条件（loveInterest.includes("X")）一键完成时调用——
	   把角色写入 V.loveInterest（数组 push / 对象首个空槽；槽位全满且存在 MLI 扩容列表时写入
	   loveInterestList，由模组 widget 自动重建 primary..；绝不覆盖已有恋人）。返回是否写入成功。 */
	function addLoveInterest(name) {
		try {
			var V = getV();
			if (!V) { return false; }
			var li = V.loveInterest;
			if (!li) { li = []; V.loveInterest = li; }
			if (Array.isArray(li)) {
				if (li.indexOf(name) === -1) { li.push(name); }
				recordNativeLoveWrite(name);
				return true;
			}
			if (typeof li === "object") {
				var wrote = false;
				Object.keys(li).forEach(function (k) {
					if (!wrote && (li[k] === "" || li[k] == null)) { li[k] = name; wrote = true; }
				});
				/* 空对象（无任何槽位键）→ 写入 primary 主槽（安全，无覆盖） */
				if (!wrote && Object.keys(li).length === 0) { li["primary"] = name; wrote = true; }
				if (!wrote) {
					/* 槽位全满：不覆盖已有恋人；存在 MLI 扩容列表则追加（模组 widget 会重建槽位） */
					if (Array.isArray(V.loveInterestList) && V.loveInterestList.indexOf(name) === -1) {
						V.loveInterestList.push(name); wrote = true;
					}
				}
				if (wrote) { recordNativeLoveWrite(name); }
				return wrote;
			}
		} catch (e) {}
		return false;
	}
	function recordNativeLoveWrite(name) {
		try {
			var V = getV();
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["romance:native:" + String(name).toLowerCase()] = { type: "native", path: "loveInterest", value: name, name: name };
		} catch (e) {}
	}

	/* 条件静态解析（读取函数源码，绝不 eval）：
	 * 支持框架原生条件形态：数值比较 / 字符串比较 / undefined 判断 /
	 * includes 追加 / 裸真值 / [X+"Seen"] 动态键。不可解析 → null（仅显示）。
	 */
	function parseCondition(fnStr, npcName) {
		var s = String(fnStr || "");
		var m;
		/* [X+"Seen"] 动态键（loveInterest 通用恋爱条件，闭包键形态） */
		m = s.match(/variables\[\s*\w+\s*\+\s*"Seen"\s*\]\s*\?\?\s*\[\s*\]\s*\)?\s*\.includes\(\s*"([^"]+)"\s*\)/);
		if (m) { return { type: "append", path: String(npcName).toLowerCase().replace(/\s+/g, "") + "Seen", value: m[1] }; }
		/* ["Seen"] 字面键形态 */
		m = s.match(/variables\[\s*["'](\w+)["']\s*\]\s*\?\?\s*\[\s*\]\s*\)?\s*\.includes\(\s*"([^"]+)"\s*\)/);
		if (m) { return { type: "append", path: m[1], value: m[2] }; }
		/* "x" !== characters.npc.X.state 或反向（rv.characters 与 rv.variables.characters 两种路径） */
		m = s.match(/"([^"]+)"\s*!==\s*(?:rv\.variables|rv|V|State\.variables)\.characters\.npc\.(\w+)\.state/);
		if (!m) {
			m = s.match(/(?:rv\.variables|rv|V|State\.variables)\.characters\.npc\.(\w+)\.state\s*!==\s*"([^"]+)"/);
			if (m) { m = [m[0], m[2], m[1]]; }
		}
		if (m) { return { type: "state", value: "stable" }; }
		/* 数值在前：N OP path */
		m = s.match(/(\d+(?:\.\d+)?)\s*(===|==|>=|>)\s*(?:rv\.variables|V|State\.variables)\.(\w+)/);
		if (m) {
			var a = Number(m[1]);
			return { type: "set", path: m[3], value: m[2] === ">" ? a + 1 : a };
		}
		/* 路径在前：path OP N */
		m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*(===|==|>=|>)\s*(\d+(?:\.\d+)?)/);
		if (m) {
			var b = Number(m[3]);
			return { type: "set", path: m[1], value: m[2] === ">" ? b + 1 : b };
		}
		/* undefined === path / path === undefined */
		m = s.match(/undefined\s*===?\s*(?:rv\.variables|V|State\.variables)\.(\w+)/);
		if (!m) { m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*===?\s*undefined/); }
		if (m) { return { type: "clear", path: m[1] }; }
		/* path?.includes("x") */
		m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*\?\?\s*\[\s*\]\s*\)?\s*\.includes\(\s*"([^"]+)"\s*\)/);
		if (!m) { m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*\??\.includes\(\s*"([^"]+)"\s*\)/); }
		if (m) { return { type: "append", path: m[1], value: m[2] }; }
		/* 裸真值：V.var（排除箭头函数 => 的 >） */
		m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*\)?\s*$/);
		if (m && !/[=<>!]/.test(s.replace(/===|==|>=|<=|!==|!=|=>/g, ""))) {
			return { type: "set", path: m[1], value: 1 };
		}
		return null;
	}
	function applyRomanceFix(parsed, npcName) {
		if (!parsed) { return false; }
		var v = getV();
		try {
			if (parsed.type === "set") {
				v[parsed.path] = Number(parsed.value);
				/* 一键完成亚历克斯农场阶段会把 $farm_stage 直接置高（绕过本体农场线初始化），
				   若不补 $farm 空壳，之后任何含 <<social>> 的段落会崩（读 $farm.beasts/aggro）→ 写入点立即兜底 */
				if (parsed.path === "farm_stage") { ensureFarmState(); }
				return true;
			}
			if (parsed.type === "clear") {
				try { delete v[parsed.path]; } catch (e) { v[parsed.path] = undefined; }
				return true;
			}
			if (parsed.type === "append") {
				var arr = v[parsed.path];
				if (Array.isArray(arr)) {
					if (arr.indexOf(parsed.value) === -1) { arr.push(parsed.value); }
					return true;
				}
				if (arr && typeof arr === "object") {
					/* 对象结构（如原版 V.loveInterest 按槽位存）→ 写入首个空槽 */
					var wrote = false;
					Object.keys(arr).forEach(function (k) {
						if (!wrote && (arr[k] === "" || arr[k] == null)) { arr[k] = parsed.value; wrote = true; }
					});
					if (!wrote) { arr["0"] = parsed.value; }
					return true;
				}
				arr = []; v[parsed.path] = arr; arr.push(parsed.value);
				return true;
			}
			if (parsed.type === "state") {
				var chars = v.characters && v.characters.npc;
				if (chars && typeof chars === "object") {
					var k = String(npcName).toLowerCase();
					var keys = Object.keys(chars);
					for (var i = 0; i < keys.length; i++) {
						if (keys[i].toLowerCase() === k) {
							if (chars[keys[i]] && typeof chars[keys[i]] === "object") { chars[keys[i]].state = "stable"; }
							return true;
						}
					}
				}
				return false;
			}
		} catch (e) { return false; }
		return false;
	}
	/* 一键完成单个恋爱阶段：先修复数值/Flag，再复检 */
	function completeRomanceStage(name, stage) {
		var parsed = null;
		var fixed = false;
		var ok = false;
		if (stage.native) {
			/* v1.4.5：兜底条件（loveInterest.includes("X")）一键完成 = 把角色加入恋人卡槽——
			   统一走 addLoveInterest（数组 push / 对象首个空槽 / 槽位全满写 MLI 扩容列表），
			   不走通用 applyRomanceFix（其 append 在对象无空槽时会写 "0" 新键，且不联动 MLI 列表） */
			ok = loveInterestHas(name);
			if (!ok) { ok = addLoveInterest(name); }
		} else {
			parsed = parseCondition(stage.text, name);
			fixed = applyRomanceFix(parsed, name);
			if (fixed && parsed) { recordRomanceWrite(parsed, name); }
			try { ok = !!stage.fn(); } catch (e) { ok = false; }
		}
		return { fixed: fixed, ok: ok, parsed: parsed };
	}
	function unlockAllRomance(name) {
		var n = 0, okCount = 0;
		getRomanceStages(name).forEach(function (st) {
			if (st.ok) { okCount += 1; return; }
			var r = completeRomanceStage(name, st);
			if (r.ok) { n += 1; }
		});
		return { fixed: n, total: getRomanceStages(name).length, passed: okCount };
	}

	/* ============ 转化阶段（build/level/levels 门槛 + 自动校验） ============ */
	var DEFAULT_LEVELS = [5, 10, 15, 20, 25, 30];
	function listStageTypes(npcName) {
		var key = String(npcName).toLowerCase();
		var out = new Map();
		try {
			var T = MB.npc.Transformation;
			if (T && T.configs instanceof Map) {
				var cfg = T.configs.get(key);
				if (cfg instanceof Map) {
					cfg.forEach(function (conf, type) {
						var lv = (conf && Array.isArray(conf.levels) && conf.levels.length) ? conf.levels : DEFAULT_LEVELS;
						out.set(type, lv);
					});
				}
			}
		} catch (e) {}
		try {
			var st = getV().maplebirch && getV().maplebirch.npc && getV().maplebirch.npc[key];
			var tf = (st && typeof st === "object") ? st.transformation : null;
			if (tf && typeof tf === "object") {
				Object.keys(tf).forEach(function (t) { if (!out.has(t)) { out.set(t, DEFAULT_LEVELS); } });
			}
		} catch (e) {}
		return out;
	}
	function readTransformState(npcName, type) {
		try {
			var T = MB.npc.Transformation;
			if (T && typeof T.get === "function") {
				var s = T.get(npcName, type);
				if (s && typeof s === "object") { return { build: Number(s.build) || 0, level: Number(s.level) || 0 }; }
			}
		} catch (e) {}
		try {
			var st = getV().maplebirch && getV().maplebirch.npc && getV().maplebirch.npc[String(npcName).toLowerCase()];
			var tf = (st && st.transformation) ? st.transformation[type] : null;
			if (tf && typeof tf === "object") { return { build: Number(tf.build) || 0, level: Number(tf.level) || 0 }; }
		} catch (e) {}
		return { build: 0, level: 0 };
	}
	function adjustTransform(npcName, type, delta) {
		try {
			var T = MB.npc.Transformation;
			if (T && typeof T.build === "function") { T.build(npcName, type, Number(delta) || 0); }
		} catch (e) {}
		return readTransformState(npcName, type);
	}
	function completeTransformStage(npcName, type, targetLevel) {
		try {
			var T = MB.npc.Transformation;
			if (!T || typeof T.set !== "function") { return false; }
			var levels = listStageTypes(npcName).get(type) || DEFAULT_LEVELS;
			var max = levels.length;
			var target = Math.max(0, Math.min(Math.round(Number(targetLevel) || 0), max));
			if (target <= 0) { T.set(npcName, type, 0); return true; }
			var threshold = levels[target - 1];
			var cur = readTransformState(npcName, type);
			var curBuild = Number.isFinite(Number(cur.build)) ? Number(cur.build) : 0;
			var delta = threshold - curBuild;
			if (Math.abs(delta) > 1e-6 && typeof T.build === "function") { T.build(npcName, type, delta); }
			T.set(npcName, type, target);
			return true;
		} catch (e) { return false; }
	}
	function unlockAllTransform(npcName) {
		var n = 0;
		listStageTypes(npcName).forEach(function (levels, type) {
			if (completeTransformStage(npcName, type, levels.length)) { n += 1; }
		});
		return n;
	}

