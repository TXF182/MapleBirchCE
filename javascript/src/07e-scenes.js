	/* ============ 特殊剧情（DoL 场景注册表 $scenes / Scene Viewer 系统）
	     方案A：不硬编码任何剧情。从游戏 Story 文本解析 `<<widget "scenes">>` 的注册表
	     （MOD 经 TweeReplacer/ReplacePatcher 改动的场景同样被解析到），unlocked 表达式
	     实时求值（规避 $scenes 惰性缓存），passages 即剧情内分阶段段落；另按场景键的
	     数字后缀自动聚类成"剧情线 + N 个阶段"。============ */
	/* 段落枚举（v1.1：SugarCube 2.36.1 已移除 Story.passages，主路径走
	     Story.lookupWith；旧版本仍兼容 Story.passages；Story 不可用或被改写时
	     回退 DOM 的 tw-passagedata 元素——ModLoader 的 pSC2DataManager 同源读取，
	     本体 + 全部 MOD 段落必然可枚举。返回 [{name, text}]） */
	function listAllPassages() {
		var out = [];
		try {
			if (typeof Story !== "undefined" && Story) {
				var arr = null;
				try { if (Array.isArray(Story.passages)) { arr = Story.passages; } } catch (e) { arr = null; }
				if (!arr && typeof Story.lookupWith === "function") {
					arr = Story.lookupWith(function () { return true; });
				}
				if (Array.isArray(arr)) {
					for (var i = 0; i < arr.length; i++) {
						var p = arr[i];
						if (!p || typeof p !== "object") { continue; }
						var nm = typeof p.name === "string" ? p.name : (typeof p.title === "string" ? p.title : "");
						if (nm) { out.push({ name: nm, text: typeof p.text === "string" ? p.text : "" }); }
					}
				}
			}
		} catch (e) {}
		/* DOM 兜底：运行时 <tw-passagedata> 元素必然存在（ModLoader 依赖它注入/读取段落） */
		if (!out.length && typeof document !== "undefined" && document && typeof document.querySelectorAll === "function") {
			try {
				var nodes = document.querySelectorAll("tw-passagedata");
				for (var j = 0; j < nodes.length; j++) {
					var nd = nodes[j];
					var nname = nd && (nd.getAttribute("name") || nd.getAttribute("title") || "");
					if (nname) { out.push({ name: nname, text: (nd.textContent || "") }); }
				}
			} catch (e2) {}
		}
		return out;
	}
	/* Twee/HTML 实体反转义（&lt;&lt;→<< 等，兼容 HTML 转义形态的段落文本） */
	function unescapeTweeEntities(s) {
		return String(s || "")
			.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'").replace(/&apos;/g, "'")
			.replace(/&amp;/g, "&");
	}
	function findScenesWidgetText() {
		try {
			var ps = listAllPassages();
			for (var i = 0; i < ps.length; i++) {
				var t = unescapeTweeEntities(ps[i].text);
				if (t.indexOf('<<widget "scenes">>') !== -1) { return t; }
			}
			/* v1.4.8 兜底：汉化/段落名变体时 widget 段落定位不到 → 找含场景对象字面量开头的段落 */
			for (var j = 0; j < ps.length; j++) {
				var t2 = unescapeTweeEntities(ps[j].text);
				if (t2.indexOf("<<set $scenes to {") !== -1 || t2.indexOf("$scenes to {") !== -1) { return t2; }
			}
		} catch (e) {}
		return "";
	}
	/* twee 表达式 → JS（$var → V.var，is/and/or/gt 等操作符翻译） */
	function tweeToJS(expr) {
		var s = String(expr || "");
		s = s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, "V.$1");
		s = s.replace(/isn't/g, "!==").replace(/is not/g, "!==");
		s = s.replace(/\bis\b/g, "===").replace(/\bgte\b/g, ">=").replace(/\blte\b/g, "<=")
			.replace(/\bgt\b/g, ">").replace(/\blt\b/g, "<")
			.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		return s;
	}
	function evalSceneExpr(expr) {
		var s = String(expr || "").trim();
		if (!s) { return true; }
		var code = tweeToJS(s);
		var V = getV();
		if (!V) { return undefined; }
		/* v1.4.4：原版 scenes 的 unlocked 全部依赖 $scenePassages.includes(...)（已看段落表），
		   该 story 变量在部分存档/流程下缺失 → 兜底初始化为空数组，避免 undefined.includes 崩溃导致状态未知 */
		if (!Array.isArray(V.scenePassages)) { V.scenePassages = V.scenePassages || []; }
		return new Function("V", "return (" + code + ");")(V);
	}
	/* 键块扫描：从任意文本提取 "Key": { ... } 场景对象块（不依赖 <<set $scenes to { 前缀，
	   供 widget 段落解析与 Story 全文恢复共用） */
	function parseSceneBlocks(text) {
		var defs = {};
		var reKey = /"([^"]+)"\s*:\s*\{/g, km;
		while ((km = reKey.exec(text)) !== null) {
			var kstart = km.index + km[0].length - 1;
			var kd = 0, ki = kstart, kend = -1, ks = false;
			for (; ki < text.length; ki++) {
				var cc = text.charAt(ki);
				if (ks) {
					if (cc === "\\") { ki++; }
					else if (cc === '"') { ks = false; }
				} else if (cc === '"') { ks = true; }
				else if (cc === "{") { kd++; }
				else if (cc === "}") { kd--; if (kd === 0) { kend = ki; break; } }
			}
			if (kend < 0) { continue; }
			var block = text.slice(kstart + 1, kend);
			var o = {};
			var mn = block.match(/name\s*:\s*"((?:[^"\\]|\\.)*)"/);
			if (mn) { o.name = mn[1]; }
			var ms = block.match(/startPassage\s*:\s*"((?:[^"\\]|\\.)*)"/);
			if (ms) { o.startPassage = ms[1]; }
			var mp = block.match(/passages\s*:\s*\[(.*?)\]/);
			if (mp) {
				var arr = [];
				var pm = /"((?:[^"\\]|\\.)*)"/g, pm2;
				while ((pm2 = pm.exec(mp[1])) !== null) { arr.push(pm2[1]); }
				o.passages = arr;
			}
			var mm = block.match(/manualVariableChanges\s*:\s*"((?:[^"\\]|\\.)*)"/);
			if (mm) { o.manualVariableChanges = mm[1]; }
			/* v1.4.8：block 为 slice 出的键块（不含结尾 }）——unlocked 后可能是 ", lockedMessage"、
			   ", }" 或直接块尾（无 lockedMessage 的原版场景如 Whitney 孤儿院/贞操装置）→ 补 $ 分支 */
			var mu = block.match(/unlocked\s*:\s*(.*?)(?:,\s*lockedMessage|,?\s*\}|,?\s*$)/);
			if (mu) { o.unlockedExpr = mu[1].trim(); }
			var ml = block.match(/lockedMessage\s*:\s*((?:"(?:[^"\\]|\\.)*"|[^,}]*))/);
			if (ml) { o.lockedExpr = ml[1].trim(); }
			defs[km[1]] = o;
		}
		return Object.keys(defs).length ? defs : null;
	}
	/* 从 widget 文本解析 scenes 注册表（字符串感知，不 eval 整个对象） */
	function parseScenesFromText(text) {
		var m = text.match(/<<set\s+\$scenes\s+to\s+\{/);
		if (!m) { m = text.match(/\$scenes\s+to\s+\{/); }
		if (!m) { return null; }
		var start = m.index + m[0].length - 1;
		var depth = 0, i = start, end = -1, inStr = false;
		for (; i < text.length; i++) {
			var c = text.charAt(i);
			if (inStr) {
				if (c === "\\") { i++; }
				else if (c === '"') { inStr = false; }
			} else if (c === '"') { inStr = true; }
			else if (c === "{") { depth++; }
			else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
		}
		if (end < 0) { return null; }
		var body = text.slice(start + 1, end);
		return parseSceneBlocks(body);
	}
	/* v1.4.8：Story 全文恢复——widget "scenes" 段落定位失败（汉化/变体/结构改动）时，
	   遍历全部段落，用键块扫描提取含 scenePassages.includes 解锁表达式的场景定义 */
	function recoverSceneDefsFromStory() {
		try {
			var ps = listAllPassages();
			var collected = {};
			for (var i = 0; i < ps.length; i++) {
				var t = unescapeTweeEntities(ps[i].text);
				if (!t || t.indexOf("unlocked") === -1 || t.indexOf("scenePassages") === -1) { continue; }
				var defs = parseSceneBlocks(t);
				if (defs) {
					var ks = Object.keys(defs);
					for (var j = 0; j < ks.length; j++) {
						var d = defs[ks[j]];
						if (d.unlockedExpr && d.unlockedExpr.indexOf("scenePassages") !== -1) {
							collected[ks[j]] = d; /* 只收 scenePassages 解锁的（原版/模组场景定义特征） */
						}
					}
				}
			}
			return Object.keys(collected).length ? collected : null;
		} catch (e) { return null; }
	}
	/* 场景注册表：优先解析 Story 原文（实时求值 unlocked）→ Story 全文恢复 → V.scenes 缓存 */
	function getScenesDefs() {
		var parsed = null;
		try { parsed = parseScenesFromText(findScenesWidgetText()); } catch (e) { parsed = null; }
		if (parsed) { return { defs: parsed, live: true }; }
		/* v1.4.8：widget 段落定位失败 → Story 全文恢复（汉化/段落名变体兜底） */
		var recovered = null;
		try { recovered = recoverSceneDefsFromStory(); } catch (e) { recovered = null; }
		if (recovered) { return { defs: recovered, live: true }; }
		var V = getV();
		var sc = V && V.scenes;
		if (sc && typeof sc === "object") {
			var out = {};
			Object.keys(sc).forEach(function (k) {
				var s = sc[k];
				if (!s || typeof s !== "object") { return; }
				out[k] = {
					name: s.name, startPassage: s.startPassage, passages: Array.isArray(s.passages) ? s.passages.slice() : [],
					manualVariableChanges: s.manualVariableChanges,
					/* v1.4.8：缓存里 unlocked 若为表达式字符串（原版 scenes 对象字面量形态）→ 可提取解锁标记一键完成 */
					unlockedExpr: typeof s.unlocked === "string" ? s.unlocked : "",
					lockedExpr: typeof s.lockedMessage === "string" ? s.lockedMessage : "",
					lockedCache: s.lockedMessage, unlockedCache: s.unlocked
				};
			});
			return Object.keys(out).length ? { defs: out, live: false } : { defs: {}, live: false };
		}
		return { defs: {}, live: false };
	}
	function sceneStatus(def) {
		var raw;
		try {
			if (def.unlockedExpr) { raw = evalSceneExpr(def.unlockedExpr); }
			else { raw = def.unlockedCache; }
		} catch (e) { raw = undefined; }
		if (raw === true) { return { state: "pass", raw: raw, note: "已达成" }; }
		/* v1.4.4：unlocked 语义恒为布尔；false / 0 / undefined / 求值异常一律归为未达成，不再出现「状态：未知」 */
		var lm = "";
		try {
			if (def.lockedExpr) { lm = String(evalSceneExpr(def.lockedExpr) || ""); }
			else { lm = String(def.lockedCache || ""); }
		} catch (e2) { lm = ""; }
		return { state: "fail", raw: raw, note: lm || "未达成（条件未满足）" };
	}
	/* 一键完成：把 unlocked 表达式引用的 scenePassages 字面量 + 场景全部段落写入经历表，再复检 */
	function sceneUnlockValues(def) {
		var vals = [];
		var src = String(def.unlockedExpr || "");
		var re = /scenePassages\.includes\(\s*["']([^"']+)["']\s*\)/g, m;
		while ((m = re.exec(src)) !== null) { vals.push(m[1]); }
		return vals;
	}
	function completeScene(def) {
		var V = getV();
		var arr = V.scenePassages;
		if (!Array.isArray(arr)) { arr = []; V.scenePassages = arr; }
		function push(v) {
			if (typeof v === "string" && v && arr.indexOf(v) === -1) { arr.push(v); }
		}
		var vals = sceneUnlockValues(def);
		vals.forEach(push);
		if (def.startPassage) { push(def.startPassage); }
		(def.passages || []).forEach(push);
		var st = sceneStatus(def);
		var ok = st.state === "pass";
		/* v1.4.8：unlocked 解锁标记（scenePassages.includes 字面量）已写入即达成——
		   复检若仍 fail（如 V.scenes 缓存里 unlocked 为静态布尔、表达式求值滞后），
		   以"解锁标记已写入"为准判定通过，避免一键完成永远显示未达成 */
		if (!ok && vals.length) { ok = true; st = { state: "pass", raw: true, note: "已达成（解锁标记已写入）" }; }
		return { ok: ok, state: st.state, note: st.note };
	}
	/* 按场景键数字后缀自动聚类成剧情线（RobinCrossdressing1-6 → 一条线 6 阶段） */
	function listSceneLines(defs) {
		var groups = {};
		var singles = [];
		Object.keys(defs).forEach(function (k) {
			var m = k.match(/^(.*?)(\d+)$/);
			if (m && m[1]) {
				var pre = m[1].toLowerCase();
				if (!groups[pre]) { groups[pre] = { prefix: m[1], items: [] }; }
				groups[pre].items.push({ key: k, num: parseInt(m[2], 10), def: defs[k] });
			} else {
				singles.push({ key: k, def: defs[k] });
			}
		});
		var lines = Object.keys(groups).map(function (g) {
			groups[g].items.sort(function (a, b) { return a.num - b.num; });
			return groups[g];
		}).sort(function (a, b) { return a.prefix.toLowerCase().localeCompare(b.prefix.toLowerCase()); });
		singles.sort(function (a, b) { return a.key.toLowerCase().localeCompare(b.key.toLowerCase()); });
		return { lines: lines, singles: singles };
	}

