/* 职责：框架版本闸门 —— 版本号分段比较 + 低于实测版只提示不阻断（不硬锁还能用的功能） */
	/* ============ 框架版本闸门（v2.1.2，对标 CE 1.20.4 的 scriptEarly/framework_detector.js） ============ */
	/* 结构门禁拆段（S1：01-core.js 加错误池后 452 行超 400 上限，同 01b-wrote-trim.js 先例）。
	   本段只放框架版本判定与闸门结论，不碰其他核心逻辑；依赖 01-core.js 的 resolveMB。 */
	/* 本项目实测通过的框架版本（tools/_modcache/fw562 对照）。低于它只提示不阻断 ——
	   本模组每个功能自身都做了「取不到就返回失败」的降级，硬闸门只会把还能用的功能一起锁死。 */
	var MCE_FRAMEWORK_TESTED = "5.6.2";
	/** 版本串 → 四段数字数组（非数字段按 0） @param {any} v @returns {number[]} */
	function mbCEVersionParts(v) {
		var s = String(v === undefined || v === null ? "" : v).replace(/^[vV]/, "").split(/[.\-+ ]/);
		var out = [];
		for (var i = 0; i < 4; i++) {
			var n = parseInt(s[i], 10);
			out.push(isNaN(n) ? 0 : n);
		}
		return out;
	}
	/* 1 = a 高于 b；0 = 相等；-1 = a 低于 b（空串视为最低，不冒充满足） */
	function mbCECompareVersion(a, b) {
		var x = mbCEVersionParts(a), y = mbCEVersionParts(b);
		for (var i = 0; i < 4; i++) {
			if (x[i] !== y[i]) { return x[i] > y[i] ? 1 : -1; }
		}
		return 0;
	}
	/* 框架版本读 ModLoader 注册表（CE 同法用 modUtils.getMod('maplebirch')；这里多试几个常见注册名） */
	function mbCEFrameworkVersion() {
		try {
			var mu = (typeof window !== "undefined" && window) ? window.modUtils : null;
			if (!mu || typeof mu.getMod !== "function") { return ""; }
			var names = ["maplebirch", "MapleBirch", "MapleBirchLeaf", "maplebirchFramework"];
			for (var i = 0; i < names.length; i++) {
				var m = mu.getMod(names[i]);
				if (m && m.version) { return String(m.version); }
			}
		} catch (eMod) { /* 注册表不可读 → 版本号留空，闸门按「不可读」处理，不误判为过低 */ }
		return "";
	}
	/* 闸门结论：missing（没装）/ incompatible（关键 API 缺）/ old（低于实测基线）/ ok */
	function mbCEFrameworkGate() {
		/** @type {{ level: string, version: string, missing: string[], tested: string, message: string }} */
		var out = { level: "ok", version: "", missing: [], tested: MCE_FRAMEWORK_TESTED, message: "" };
		var mb = resolveMB();
		if (!mb) {
			out.level = "missing";
			out.message = "缺少 MapleBirch 框架：未检测到 window.maplebirch";
			return out;
		}
		try { out.version = mbCEFrameworkVersion(); } catch (eVer) {}
		if (typeof mb.get !== "function") { out.missing.push("get"); }
		if (!mb.npc) { out.missing.push("npc"); }
		if (out.missing.length) {
			out.level = "incompatible";
			out.message = "框架 API 不完整（缺 " + out.missing.join(" / ") + "），作弊项会大面积失效";
			return out;
		}
		if (out.version && mbCECompareVersion(out.version, MCE_FRAMEWORK_TESTED) < 0) {
			out.level = "old";
			out.message = "框架版本 " + out.version + " 低于本项目实测基线 " + MCE_FRAMEWORK_TESTED + "，部分功能可能取不到值";
			return out;
		}
		out.message = "框架在岗" + (out.version ? "（" + out.version + "）" : "（版本号不可读）");
		return out;
	}
	/* 注入即体检一次：结论挂 window.__mceFrameworkGate 供面板/实机探针读取；
	   missing / incompatible / old 只告警不阻断（各功能自身已有取不到即失败的降级）。 */
	function mbCEFrameworkGateOnce() {
		try {
			var gate = mbCEFrameworkGate();
			if (typeof window !== "undefined" && window) { window.__mceFrameworkGate = gate; }
			if (gate.level !== "ok") {
				try { if (typeof window !== "undefined" && window && window.console) { window.console.warn("[MCE] 框架闸门：" + gate.message); } } catch (eW) { /* 控制台不可用就只留 window.__mceFrameworkGate */ }
			}
			return gate;
		} catch (eGate) {
			try { mbCECatch("framework-gate", eGate); } catch (eC) { /* 错误池不可用 → 只吞掉，不阻断启动 */ }
			return null;
		}
	}
