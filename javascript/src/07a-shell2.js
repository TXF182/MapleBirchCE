/* 职责：面板外壳续 —— 外层页签分发（switchOuterTab）、页签状态持久化（mbCEUiLoad / mbCEUiSave / mbCEUiCollapsed）、主题切换 */
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
		if (name === "yanling") { renderYanling(); } /* v2.0.0.006 言灵页（07i-yanling.js） */
	}

	/* ============ v1.8.12 面板状态持久化（localStorage：页签 / 特质搜索词 / 折叠状态 / 当前角色 / 内层页签） ============ */
	/** @type {any} */
	var mbCEUiState = { tab: "char", filter: "", collapsed: {}, curName: "", innerTab: "romance", placesTab: "direct", theme: "gold", charFilter: "" };
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
				/* v1.9.29 主题与角色页搜索词持久化 */
				if (obj.theme === "starry" || obj.theme === "gold") { mbCEUiState.theme = obj.theme; }
				if (typeof obj.charFilter === "string") { mbCEUiState.charFilter = obj.charFilter; charSearch = obj.charFilter; }
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
				if (partial.theme === "starry" || partial.theme === "gold") { mbCEUiState.theme = partial.theme; }
				if (typeof partial.charFilter === "string") { mbCEUiState.charFilter = partial.charFilter; }
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

	/* ============ v1.9.29 双主题：黑金（gold）⇄ 星空蓝（starry） ============ */
	/* 切换只改 #mce-root 与悬浮球的主题类 + localStorage 持久化（token 覆盖在 07a-shell CSS 串）。
	   silent=true 用于初始化恢复（mbCEUiLoad 已持久化到 state，恢复时不重复写）。 */
	function setTheme(name, silent) {
		try {
			var t = name === "starry" ? "starry" : "gold";
			mbCETheme = t;
			if (root && root.classList) { root.classList.toggle("mce-theme-starry", t === "starry"); }
			if (toggleBtn && toggleBtn.classList) { toggleBtn.classList.toggle("mce-theme-starry", t === "starry"); }
			if (!silent) { mbCEUiSave({ theme: t }); }
			return t;
		} catch (e) { return "gold"; }
	}
	function getTheme() { return mbCETheme; }

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
					origErr.apply(this, /** @type {any} */ (arguments));
				};
			}
		} catch (e) {}
	}

