	/* ============ UI：右侧常驻黑色悬浮侧边面板（CE 样式，双层标签） ============ */
	var root = null;
	var toggleBtn = null;
	var openFlag = false;
	var curName = "";
	var curInnerTab = "romance";
	var initialized = false;

	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) { node.className = cls; }
		if (text !== undefined && text !== null) { node.textContent = String(text); }
		return node;
	}

	var CSS = "" +
		"#mce-root{display:none;position:fixed;top:8px;right:0;bottom:8px;width:430px;max-width:96vw;z-index:2147483000;" +
		"background:rgba(5,5,5,.96);border:1px solid #3c3c3c;border-right:none;box-shadow:0 12px 34px rgba(0,0,0,.7);" +
		"color:#f2f2f2;flex-direction:column;overflow:hidden;" +
		"font-family:'Noto Serif SC','Source Han Serif SC','Microsoft YaHei',serif;font-size:13px;line-height:1.5}" +
		"#mce-root.mce-open{display:flex}" +
		"#mce-toggle{position:fixed;right:14px;bottom:14px;z-index:2147482999;width:52px;height:52px;border-radius:50%;" +
		"background:#d4a73c;color:#111;border:2px solid #b38a2a;font-size:15px;font-weight:700;cursor:pointer;" +
		"box-shadow:0 4px 14px rgba(0,0,0,.6);font-family:inherit}" +
		"#mce-toggle:hover{background:#e0b44a}" +
		".mce-header{display:flex;align-items:center;height:42px;padding:0 10px;background:#1a1a1a;" +
		"border-bottom:1px solid #3c3c3c;color:#d4a73c;font-weight:700;font-size:15px}" +
		".mce-header .mce-title{flex:1;text-align:center}" +
		".mce-header button{background:transparent;border:none;color:#ccc;font-size:16px;cursor:pointer;padding:0 7px}" +
		".mce-header button:hover{color:#fff}" +
		".mce-tabs{display:flex;background:#0d0d0d;border-bottom:1px solid #3c3c3c}" +
		".mce-tabs button{flex:1;background:transparent;border:none;border-bottom:2px solid transparent;" +
		"color:#b9b9b9;padding:9px 0;cursor:pointer;font-size:14px;font-family:inherit}" +
		".mce-tabs button.mce-active{color:#d4a73c;border-bottom-color:#d4a73c}" +
		".mce-body{flex:1;overflow-y:auto;padding:10px;min-height:120px}" +
		".mce-pane{display:none}.mce-pane.mce-active{display:block}" +
		/* 角色卡片 */
		".mce-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
		".mce-card{background:#111;border:1px solid #333;border-radius:3px;padding:8px;cursor:pointer}" +
		".mce-card:hover{border-color:#d4a73c}" +
		".mce-card.mce-sel{border-color:#d4a73c;background:#18150c}" +
		".mce-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}" +
		".mce-card-name{color:#fff;font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
		".mce-badge{font-size:10px;padding:1px 6px;border-radius:8px;white-space:nowrap}" +
		".mce-badge.mce-on{background:#1c3a24;color:#7ed89a;border:1px solid #2e5a3c}" +
		".mce-badge.mce-off{background:#3a1c1c;color:#ff6b6b;border:1px solid #5a2e2e}" +
		".mce-card-stats{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:11px;color:#9c9c9c}" +
		".mce-card-stats b{color:#d4a73c}" +
		/* 数据卡 */
		".mce-section{font-size:12px;color:#9c9c9c;border-bottom:1px dashed #333;padding:2px 0 4px;margin:10px 0 6px}" +
		".mce-statrow{display:flex;align-items:center;gap:6px;margin:5px 0;flex-wrap:wrap}" +
		".mce-label{color:#d8d8d8;min-width:56px}" +
		".mce-value{color:#d4a73c;font-weight:700;min-width:44px;text-align:right}" +
		".mce-btn{background:#222;color:#eee;border:1px solid #3c3c3c;border-radius:2px;padding:3px 9px;cursor:pointer;font-size:12px;font-family:inherit}" +
		".mce-btn:hover{background:#333}" +
		".mce-btn.mce-gold{background:#d4a73c;color:#111;border-color:#b38a2a;font-weight:700}" +
		".mce-btn.mce-gold:hover{background:#e0b44a}" +
		".mce-btn.mce-red{background:#5a2323;color:#ff9c9c;border-color:#7a3030}" +
		".mce-btn.mce-red:hover{background:#6e2b2b}" +
		".mce-btn:disabled{opacity:.45;cursor:not-allowed}" +
		".mce-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}" +
		/* 内层标签 */
		".mce-inner{display:flex;gap:4px;margin:8px 0;border-bottom:1px solid #2a2a2a;padding-bottom:6px}" +
		".mce-inner button{background:#181818;color:#aaa;border:1px solid #333;border-radius:2px;padding:3px 10px;cursor:pointer;font-size:12px;font-family:inherit}" +
		".mce-inner button.mce-active{background:#d4a73c;color:#111;border-color:#d4a73c}" +
		/* 阶段列表 */
		".mce-stages{display:flex;flex-direction:column;gap:6px}" +
		".mce-stage{border-left:3px solid #555;background:#101010;border-radius:2px;padding:7px 9px}" +
		".mce-stage.mce-pass{border-left-color:#2e9e52;background:#0d1710}" +
		".mce-stage.mce-fail{border-left-color:#c0392b;background:#170d0d}" +
		".mce-stage-head{display:flex;align-items:center;gap:8px}" +
		".mce-dot{width:9px;height:9px;border-radius:50%;flex:none}" +
		".mce-pass .mce-dot{background:#2e9e52}" +
		".mce-fail .mce-dot{background:#c0392b}" +
		".mce-stage-name{color:#eee;font-weight:700;font-size:13px;flex:1}" +
		".mce-stage-txt{color:#b9b9b9;font-size:11px;margin-top:4px;word-break:break-all;font-family:Consolas,Menlo,monospace}" +
		".mce-stage-note{color:#8a6d3b;font-size:11px;margin-top:3px}" +
		".mce-hint{color:#8a8a8a;font-size:12px;margin:4px 0}" +
		/* v1.5.2 使用提示（剧情页页首警示框） */
		".mce-warn{background:#2a2208;border:1px solid #d4a73c;color:#f0d98c;font-size:12px;margin:4px 0;padding:8px 10px;border-radius:3px;line-height:1.6}" +
		".mce-err{color:#ff6b6b;font-size:13px}" +
		".mce-ok{color:#7ed89a;font-size:13px}" +
		".mce-status{min-height:18px;padding:6px 10px;border-top:1px solid #3c3c3c;background:#0d0d0d;color:#9c9c9c;font-size:12px}" +
		".mce-type{display:inline-block;background:#1a1a1a;color:#ccc;border:1px solid #3c3c3c;border-radius:2px;padding:2px 8px;font-size:11px;margin:2px}" +
		".mce-build{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:4px 0}" +
		/* v1.4.0 Mod作弊页面 */
		".mce-grp{border:1px solid #2a2a2a;border-radius:3px;margin:8px 0;padding:8px;background:#0f0f0f}" +
		".mce-grp-t{color:#d4a73c;font-weight:700;font-size:13px;margin-bottom:6px}" +
		".mce-collapse-head{cursor:pointer;user-select:none}" +
		".mce-collapse-head:hover{color:#f0d070}" +
		".mce-grp-body[data-collapsed=\"1\"]{display:none}" +
		".mce-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0;border-top:1px solid #1f1f1f;font-size:12px}" +
		".mce-row-lbl{color:#e6e6e6;flex:1;min-width:120px;word-break:break-all}" +
		".mce-row button{background:#181818;color:#ccc;border:1px solid #3a3a3a;border-radius:2px;padding:3px 8px;cursor:pointer;font-size:12px;font-family:inherit}" +
		".mce-row button:hover{border-color:#d4a73c;color:#d4a73c}" +
		".mce-inp{background:#0d0d0d;color:#eee;border:1px solid #3a3a3a;border-radius:2px;padding:3px 6px;font-size:12px;width:90px;font-family:Consolas,Menlo,monospace}" +
		".mce-sel{background:#0d0d0d;color:#eee;border:1px solid #3a3a3a;border-radius:2px;padding:3px 4px;font-size:12px;font-family:inherit}" +
		/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档） */
		".mce-ab-detail{margin-left:4px;font-size:11px}" +
		".mce-ab-sum{cursor:pointer;color:#8a8a8a;user-select:none;display:inline-block}" +
		".mce-ab-sum:hover{color:#f0d070}" +
		".mce-ab-body{background:#141414;border:1px solid #2a2a2a;border-radius:2px;padding:5px 8px;margin-top:3px;color:#b9b9b9;line-height:1.7;min-width:220px}" +
		".mce-ab-note{color:#8a6d3b;margin-top:2px}" +
		/* v1.8.12 特质收藏星标 */
		".mce-favstar{background:transparent;border:none;padding:0 5px;cursor:pointer;color:#666;font-size:12px;line-height:1}" +
		".mce-favstar:hover{color:#f0d070}" +
		".mce-favstar.mce-fav{color:#d4a73c}" +
		/* v1.8.12 错误收集器 */
		".mce-errbtn{background:#5a2323;color:#ff9c9c;border:1px solid #7a3030;border-radius:50%;" +
		"min-width:20px;height:20px;line-height:18px;font-size:11px;font-weight:700;cursor:pointer;padding:0 4px;display:none}" +
		".mce-errbtn.mce-on{display:inline-block}" +
		".mce-errbox{display:none;background:#150b0b;border-bottom:1px solid #3c3c3c;max-height:40%;overflow-y:auto;padding:6px 8px}" +
		".mce-errbox.mce-on{display:block}" +
		".mce-errrow{border-top:1px solid #2a1515;padding:4px 0;font-size:11px;color:#ffb0b0;font-family:Consolas,Menlo,monospace;word-break:break-all}" +
		".mce-errrow .mce-err-msg{color:#ffd0d0}" +
		".mce-errrow .mce-err-src{color:#a07070;font-size:10px}";

	function injectCSS() {
		if (document.getElementById("mce-style")) { return; }
		var style = el("style", "");
		style.id = "mce-style";
		style.textContent = CSS;
		(document.head || document.documentElement).appendChild(style);
	}

	function setStatus(text, cls) {
		var st = root && root.querySelector(".mce-status");
		if (!st) { return; }
		st.textContent = text;
		st.className = "mce-status" + (cls ? " " + cls : "");
	}

	function switchOuterTab(name) {
		var tabs = root.querySelectorAll(".mce-tabs button");
		var i;
		for (i = 0; i < tabs.length; i++) {
			tabs[i].classList.toggle("mce-active", tabs[i].getAttribute("data-tab") === name);
		}
		var panes = root.querySelectorAll(".mce-pane");
		for (i = 0; i < panes.length; i++) {
			panes[i].classList.toggle("mce-active", panes[i].getAttribute("data-pane") === name);
		}
		mbCEUiSave({ tab: name }); /* v1.8.12 持久化：记录当前页签 */
		if (name === "char") { renderCards(); }
		if (name === "stage") { renderStagePane(); }
		if (name === "scenes") { renderScenes(); }
		if (name === "places") { renderPlaces(); }
		if (name === "global") { renderGlobal(); }
		if (name === "mods") { renderModCheats(); }
	}

	/* ============ v1.8.12 面板状态持久化（localStorage：页签 / 特质搜索词 / 折叠状态 / 当前角色 / 内层页签） ============ */
	var mbCEUiState = { tab: "char", filter: "", collapsed: {}, curName: "", innerTab: "romance", placesTab: "direct" };
	var mbCEUiStateKey = "mbCE_ui_state_v1";
	function mbCEUiLoad() {
		try {
			var raw = (typeof localStorage !== "undefined" && localStorage) ? localStorage.getItem(mbCEUiStateKey) : null;
			if (!raw) { return; }
			var obj = JSON.parse(raw);
			if (obj && typeof obj === "object") {
				if (typeof obj.tab === "string") { mbCEUiState.tab = obj.tab; }
				if (typeof obj.filter === "string") { mbCEUiState.filter = obj.filter; curPlayerFilter = obj.filter; }
				if (obj.collapsed && typeof obj.collapsed === "object") { mbCEUiState.collapsed = obj.collapsed; }
				/* v1.8.12 二轮优化：记住上次操作角色与角色页内层页签（切存档/重开面板免重新找） */
				if (typeof obj.curName === "string") { mbCEUiState.curName = obj.curName; }
				if (obj.innerTab === "romance" || obj.innerTab === "transform") { mbCEUiState.innerTab = obj.innerTab; curInnerTab = obj.innerTab; }
				/* v1.9.0 场景页子页签持久化（场景直达/地点） */
				if (obj.placesTab === "stage" || obj.placesTab === "direct") { mbCEUiState.placesTab = obj.placesTab; }
			}
		} catch (e) {}
	}
	function mbCEUiSave(partial) {
		try {
			if (partial) {
				if (typeof partial.tab === "string") { mbCEUiState.tab = partial.tab; }
				if (typeof partial.filter === "string") { mbCEUiState.filter = partial.filter; }
				if (partial.collapsed) { mbCEUiState.collapsed = partial.collapsed; }
				if (typeof partial.curName === "string") { mbCEUiState.curName = partial.curName; }
				if (partial.innerTab === "romance" || partial.innerTab === "transform") { mbCEUiState.innerTab = partial.innerTab; }
				if (partial.placesTab === "stage" || partial.placesTab === "direct") { mbCEUiState.placesTab = partial.placesTab; }
			}
			if (typeof localStorage !== "undefined" && localStorage) {
				localStorage.setItem(mbCEUiStateKey, JSON.stringify(mbCEUiState));
			}
		} catch (e) {}
	}
	function mbCEUiCollapsed(tcat, open) {
		mbCEUiState.collapsed[tcat] = open ? 0 : 1;
		mbCEUiSave({ collapsed: mbCEUiState.collapsed });
	}

	/* ============ v1.8.12 面板内错误收集器（window error + console.error → 红点 + 堆栈 + 一键复制） ============ */
	var mbCEErrors = [];
	var mbCEErrCap = 50;
	var mbCEHookDone = false;
	var mbCEErrBtn = null;
	var mbCEErrBox = null;
	var mbCEErrRows = null;
	/* v1.8.12 三巡优化：风暴熔断状态——同源 60 秒窗口合并计数，单源 ≥20 熔断 60 秒，全局 ≥200/分钟 全熔断 30 秒。
	   切断「第三方特效层每帧 console.error → 收集器高频 DOM 写」的放大循环（DoLGameUI 等每帧刷 spotlight/glow 报错时不再卡顿）。
	   四巡优化：byKey 有界（>500 丢弃最旧一半）+ 速率桶化（每分钟两桶 O(1)，替代时间戳数组）+ 面板关闭不写 badge DOM。 */
	var mbCEFuse = { byKey: {}, curCount: 0, prevCount: 0, minIdx: -1, pushCount: 0, fuseAllUntil: 0 };
	var mbCEBadgeTimer = null;
	function mbCEInFuseAll() { return Date.now() < mbCEFuse.fuseAllUntil; }
	function mbCEFuseClean() {
		try {
			var keys = Object.keys(mbCEFuse.byKey);
			if (keys.length <= 500) { return; }
			keys.sort(function (a, b) { return mbCEFuse.byKey[a].t - mbCEFuse.byKey[b].t; });
			var drop = Math.floor(keys.length / 2);
			for (var i = 0; i < drop; i++) { delete mbCEFuse.byKey[keys[i]]; }
		} catch (e) {}
	}
	function mbCEUpdateErrBadge(force) {
		/* 面板关闭时只记数据不写 DOM（省 CPU）；open() 时 force 刷新 */
		if (!openFlag && !force) { return; }
		/* force=true（清空/打开面板等明确操作）→ 同步立即写，不节流；普通 push 200ms 节流合并 */
		if (force) {
			if (mbCEBadgeTimer) { clearTimeout(mbCEBadgeTimer); mbCEBadgeTimer = null; }
			mbCEWriteErrBadge();
			return;
		}
		if (mbCEBadgeTimer) { return; }
		mbCEBadgeTimer = setTimeout(function () {
			mbCEBadgeTimer = null;
			mbCEWriteErrBadge();
		}, 200);
	}
	function mbCEWriteErrBadge() {
		try {
			if (!mbCEErrBtn) { return; }
			var n = mbCEErrors.length;
			mbCEErrBtn.textContent = n > 99 ? "99+" : String(n);
			if (mbCEErrBtn.classList) { mbCEErrBtn.classList.toggle("mce-on", n > 0); }
			else if (mbCEErrBtn.style) { mbCEErrBtn.style.display = n > 0 ? "inline-block" : "none"; }
			mbCEErrBtn.title = "面板内错误收集：" + n + " 条（点击查看 / 一键复制）" + (mbCEInFuseAll() ? " ⚠ 高频错误已熔断" : "");
		} catch (e) {}
	}
	function mbCEFmtTime(t) {
		var d = new Date(t || Date.now());
		function p(n) { return n < 10 ? "0" + n : String(n); }
		return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
	}
	function mbCEPushError(msg, src, stack) {
		try {
			var now = Date.now();
			var m = String(msg || "未知错误").slice(0, 400);
			/* 七巡/九巡：第三方噪音源归一化——DoLGameUI 特效层 4 种消息 + 其他已知第三方模组报错（DependenceChecker/
			   TweeReplacer/ReplacePatcher/ModOrderContainer），交替刷屏时各自独立成源绕过单源熔断，归一为同源后
			   命中「单源 ≥20 熔断」，不再以多源各刷十几条挤满收集器 */
			var noiseRules = [
				{ re: /^Error evaluating layer (spotlight|glow|linearGradient|flatColorOverlay) property src$/, label: "特效层(DoLGameUI)" },
				{ re: /^DependenceChecker\.check\(\) not found mod /, label: "DependenceChecker(DoLGameUI)" },
				{ re: /^\[TweeReplacer\] do_patch\(\)/, label: "TweeReplacer(第三方)" },
				{ re: /^\[ReplacePatcher\] patchInReplaceParamsItem\(\)/, label: "ReplacePatcher(Paperdoll+)" },
				{ re: /^ModOrderContainer getByNameOneWithAlias\(\) cannot find name\/alias\./, label: "ModOrderContainer(第三方)" },
				{ re: /^ModOrderContainer getByNameOne\(\) cannot find name\./, label: "ModOrderContainer(SimpleFrameworks)" }
			];
			for (var ni = 0; ni < noiseRules.length; ni++) {
				if (noiseRules[ni].re.test(m)) { m = "第三方噪音·" + noiseRules[ni].label; break; }
			}
			var s = String(src || "").slice(0, 200);
			var key = m + "|" + s;
			/* 风暴计数（60 秒窗口） */
			var st = mbCEFuse.byKey[key];
			if (!st || (now - st.t) > 60000) { st = { n: 0, t: now }; }
			st.n++;
			st.t = now;
			mbCEFuse.byKey[key] = st;
			/* 全局速率：每分钟滚动两桶 O(1) 计数（四巡：替代时间戳数组，错误风暴下内存恒定） */
			var minNow = Math.floor(now / 60000);
			if (mbCEFuse.minIdx !== minNow) {
				mbCEFuse.prevCount = mbCEFuse.curCount;
				mbCEFuse.curCount = 0;
				mbCEFuse.minIdx = minNow;
			}
			mbCEFuse.curCount++;
			if (mbCEFuse.curCount + mbCEFuse.prevCount >= 200) { mbCEFuse.fuseAllUntil = now + 30000; }
			/* 四巡：熔断计数表有界——每 64 次 push 检查一次，>500 键丢弃最旧一半（防御错误源键无限变化） */
			mbCEFuse.pushCount++;
			if (mbCEFuse.pushCount % 64 === 0) { mbCEFuseClean(); }
			/* 熔断判定：单源 ≥20 次（窗口内）或全局熔断期 → 忽略不占条目 */
			if (st.n > 20 || mbCEInFuseAll()) { mbCEUpdateErrBadge(); return; }
			/* 同源 60 秒内合并计数（×N） */
			var last = mbCEErrors.length ? mbCEErrors[mbCEErrors.length - 1] : null;
			if (last && last.msg === m && last.src === s && (now - last.t) < 60000) {
				last.n = (last.n || 1) + 1;
				last.t = now;
				mbCEUpdateErrBadge();
				return;
			}
			mbCEErrors.push({ t: now, msg: m, src: s, stack: String(stack || "").slice(0, 800), n: 1 });
			if (mbCEErrors.length > mbCEErrCap) { mbCEErrors.shift(); }
			mbCEUpdateErrBadge();
		} catch (e) {}
	}
	function mbCERenderErrBox() {
		if (!mbCEErrRows) { return; }
		mbCEErrRows.textContent = "";
		/* v1.8.12 三巡优化：熔断提示（高频第三方错误被忽略时告知用户） */
		if (mbCEInFuseAll()) {
			mbCEErrRows.appendChild(el("div", "mce-errrow mce-err-fuse", "⚠ 高频错误风暴已熔断（30 秒）：期间同类错误不再记录，避免刷屏卡顿。点击「清空」可复位。"));
		}
		if (!mbCEErrors.length) {
			mbCEErrRows.appendChild(el("div", "mce-errrow", "（无记录的错误）"));
		}
		var i;
		for (i = mbCEErrors.length - 1; i >= 0; i--) {
			var e = mbCEErrors[i];
			var row = el("div", "mce-errrow");
			row.appendChild(el("div", "mce-err-msg", "[" + mbCEFmtTime(e.t) + "] #" + (mbCEErrors.length - i) + " " + e.msg + (e.n > 1 ? " ×" + e.n : "")));
			if (e.src) { row.appendChild(el("div", "mce-err-src", e.src)); }
			if (e.stack) { row.appendChild(el("div", "mce-err-src", String(e.stack).split("\n").slice(0, 3).join(" ↲ "))); }
			mbCEErrRows.appendChild(row);
		}
	}
	function mbCEToggleErrBox() {
		if (!mbCEErrBox) { return; }
		var on = mbCEErrBox.classList.toggle("mce-on");
		if (on) { mbCERenderErrBox(); }
	}
	function mbCECopyErrors() {
		try {
			var text = mbCEErrors.map(function (e, i) { return "#" + (i + 1) + " " + e.msg + (e.n > 1 ? " ×" + e.n : "") + (e.src ? " @" + e.src : "") + (e.stack ? "\n" + e.stack : ""); }).join("\n\n");
			if (!text) { text = "（无错误记录）"; }
			if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () { setStatus("已复制 " + mbCEErrors.length + " 条错误到剪贴板", "mce-ok"); }, function () { setStatus("复制失败（浏览器限制），请手动选择", "mce-err"); });
			} else {
				setStatus("（共 " + mbCEErrors.length + " 条错误，详见上方列表）", "");
			}
		} catch (e) { setStatus("复制失败", "mce-err"); }
	}
	function mbCEHookErrors() {
		if (mbCEHookDone) { return; }
		mbCEHookDone = true;
		try {
			if (typeof window === "undefined") { return; }
			window.addEventListener("error", function (ev) {
				try {
					var e = ev && ev.error;
					mbCEPushError(ev && ev.message ? ev.message : "未知错误",
						ev && ev.filename ? ev.filename + (ev.lineno ? ":" + ev.lineno : "") : "",
						e && e.stack ? e.stack : "");
				} catch (e2) {}
			});
			/* v1.8.12 优化：Promise 拒绝（未捕获的 async/await 异常）同样进面板 */
			if (typeof window.addEventListener === "function") {
				window.addEventListener("unhandledrejection", function (ev) {
					try {
						var r = ev && ev.reason;
						mbCEPushError("未处理的 Promise 拒绝：" + (r && r.message ? r.message : (r ? String(r) : "未知原因")),
							"unhandledrejection",
							r && r.stack ? r.stack : "");
					} catch (e2) {}
				});
			}
			if (window.console && typeof window.console.error === "function") {
				var origErr = window.console.error;
				window.console.error = function () {
					try {
						var parts = [];
						for (var i = 0; i < arguments.length; i++) {
							var a = arguments[i];
							parts.push(a && a.stack ? a.stack : String(a));
						}
						mbCEPushError(parts.join(" | "), "console.error", "");
					} catch (e2) {}
					origErr.apply(this, arguments);
				};
			}
		} catch (e) {}
	}

