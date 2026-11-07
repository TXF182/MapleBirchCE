/* 职责：面板 API 与页签注册表 —— render / open / close / toggle、names / panes / paneRenders 七页签、setup.mbStageCE 导出 */

	function render() {
		if (!root) { return; }
		if (!frameworkReady()) {
			setStatus("未检测到 Maplebirch 框架", "mce-err");
			return;
		}
		var pane = root.querySelector('[data-pane="char"]');
		var chars = listCharacters();
		if (!chars.length) {
			setStatus("注册池为空：未枚举到角色", "mce-err");
			return;
		}
		var prev = (curName || mbCEUiState.curName || "").toLowerCase();
		var keep = false;
		chars.forEach(function (n) { if (n.toLowerCase() === prev) { keep = true; } });
		if (!keep) { curName = chars[0]; mbCEUiSave({ curName: curName }); /* v1.8.12 二轮优化：角色记忆失效时回落到第一个角色并同步 */ }
		else if (!curName) { curName = mbCEUiState.curName; } /* v1.8.12 二轮优化：恢复上次操作角色 */
		/* 刷新当前可见页 */
		var activeTab = null;
		var tabs = root.querySelectorAll(".mce-tabs button");
		var i;
		for (i = 0; i < tabs.length; i++) {
			if (tabs[i].classList.contains("mce-active")) { activeTab = tabs[i].getAttribute("data-tab"); }
		}
		/* 表驱动分发（v1.8.6 review：替代 6 分支 if 链） */
		var paneRenders = {
			char: renderCards, stage: renderStagePane, scenes: renderScenes,
			places: renderPlaces, global: renderGlobal, mods: renderModCheats, yanling: renderYanling
		};
		var doRender = paneRenders[activeTab];
		if (doRender) { doRender(); }
		setStatus("就绪：" + chars.length + " 个角色", "mce-ok");
	}

	/* v1.9.14 效果6：关闭淡出定时器（open 复位时清掉，防关闭动画残留） */
	var mceCloseTimer = null;
	function open() {
		openFlag = true;
		if (root) {
			if (mceCloseTimer) { clearTimeout(mceCloseTimer); mceCloseTimer = null; }
			root.classList.remove("mce-closing");
			root.classList.add("mce-open"); /* v1.9.14 效果6：display:none→flex 重放 pop-in 缩放淡入 */
		}
		mbCEUpdateErrBadge(true); /* 四巡：面板打开时立即刷新错误徽标（关闭期只记数据不写 DOM） */
		render();
	}
	function close() {
		openFlag = false;
		if (root) {
			/* v1.9.14 效果6：先播 0.12s 淡出，再移除 mce-open（display:none）；打开复位见 open() */
			root.classList.add("mce-closing");
			if (mceCloseTimer) { clearTimeout(mceCloseTimer); }
			mceCloseTimer = setTimeout(function () {
				mceCloseTimer = null;
				root.classList.remove("mce-open");
				root.classList.remove("mce-closing");
			}, 130);
		}
	}
	function toggle() {
		if (openFlag) { close(); } else { open(); }
	}

	function ensureDom() {
		if (root && document.body && document.body.contains(root)) { return; }
		injectCSS();

		toggleBtn = (document.getElementById && document.getElementById("mce-toggle")) || el("button", "", "解锁");
		toggleBtn.id = "mce-toggle";
		toggleBtn.type = "button";
		toggleBtn.title = "Maplebirch CE 剧情条件解锁面板（可拖动：按住移到任意位置，位置自动记忆）";
		if (!toggleBtn.isConnected && document.body) { document.body.appendChild(toggleBtn); }
		/* v1.9.11+：悬浮球可拖动（pointer 拖拽，rAF 节流，位置持久化 localStorage）+ 拖动锁；
		   拖动后吞掉本次 click（区分「点击开关」与「拖动挪位」）。
		   悬浮球是面板唯一入口，废除「隐藏」功能（隐藏即死锁）——清旧键并强制恢复显示。 */
		var tgSt = toggleBtn.style || {};
		try {
			if (typeof localStorage !== "undefined" && localStorage) {
				if (localStorage.getItem("mbCE_toggle_hidden_v1") !== null) {
					localStorage.removeItem("mbCE_toggle_hidden_v1");
				}
				tgSt.display = "";
				var tpRaw = localStorage.getItem("mbCE_toggle_pos_v1");
				if (tpRaw) {
					var tpj = JSON.parse(tpRaw);
					if (tpj && typeof tpj.left === "number" && typeof tpj.top === "number") {
						tgSt.left = tpj.left + "px";
						tgSt.top = tpj.top + "px";
						tgSt.right = "auto";
						tgSt.bottom = "auto";
					}
				}
				/* 拖动锁：mbCE_toggle_lock_v1 = "1" 时禁拖动（点击仍正常开关面板） */
				toggleBtn.dataset.mceLocked = (localStorage.getItem("mbCE_toggle_lock_v1") === "1") ? "1" : "0";
				if (toggleBtn.dataset.mceLocked === "1") {
					toggleBtn.title = "Maplebirch CE 剧情条件解锁面板（拖动已锁定：点击开关面板，到「全局」页解锁拖动）";
				}
			}
		} catch (e) {}
		var drag = { on: false, moved: false, sx: 0, sy: 0, l: 0, t: 0, bw: 56, bh: 56, nx: 0, ny: 0, raf: 0 };
		/* v1.9.11+ 自查：绑定守卫——ModLoader 热重载复用同一 #mce-toggle 时跳过重复 addEventListener，
		   否则 click 监听堆叠会导致一次点击多次开关面板 */
		if (!toggleBtn.__mbCEBound) {
		toggleBtn.addEventListener("pointerdown", function (ev) {
			if (toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1") { return; }
			drag.on = true; drag.moved = false;
			drag.sx = ev.clientX; drag.sy = ev.clientY;
			var r = toggleBtn.getBoundingClientRect ? toggleBtn.getBoundingClientRect() : { left: 0, top: 0, width: 56, height: 56 };
			drag.l = r.left; drag.t = r.top;
			drag.bw = r.width || 56; drag.bh = r.height || 56;
			try { toggleBtn.classList.add("mce-dragging"); } catch (e2) {}
			try { toggleBtn.setPointerCapture(ev.pointerId); } catch (e2) {}
			try { ev.preventDefault(); } catch (e2) {}
		});
		toggleBtn.addEventListener("pointermove", function (ev) {
			if (!drag.on) { return; }
			var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
			if (Math.abs(dx) < 3 && Math.abs(dy) < 3) { return; }
			drag.moved = true;
			drag.nx = drag.l + dx; drag.ny = drag.t + dy;
			if (!drag.raf) {
				drag.raf = (typeof window !== "undefined" && window.requestAnimationFrame) ? window.requestAnimationFrame(function () {
					drag.raf = 0;
					if (!drag.on && !drag.moved) { return; }
					var w = (typeof window !== "undefined" && window.innerWidth) || 1280;
					var h = (typeof window !== "undefined" && window.innerHeight) || 720;
					var nl = Math.max(0, Math.min(w - (drag.bw || 56) - 4, drag.nx));
					var nt = Math.max(0, Math.min(h - (drag.bh || 56) - 4, drag.ny));
					tgSt.left = nl + "px";
					tgSt.top = nt + "px";
					tgSt.right = "auto";
					tgSt.bottom = "auto";
				}) : 0;
			}
		});
		function tgDragEnd(ev) {
			if (!drag.on) { return; }
			drag.on = false;
			try { toggleBtn.classList.remove("mce-dragging"); } catch (e2) {}
			try { toggleBtn.releasePointerCapture(ev.pointerId); } catch (e2) {}
			if (drag.moved) {
				var w = (typeof window !== "undefined" && window.innerWidth) || 1280;
				var h = (typeof window !== "undefined" && window.innerHeight) || 720;
				var nl = Math.max(0, Math.min(w - (drag.bw || 56) - 4, drag.nx));
				var nt = Math.max(0, Math.min(h - (drag.bh || 56) - 4, drag.ny));
				tgSt.left = nl + "px";
				tgSt.top = nt + "px";
				tgSt.right = "auto";
				tgSt.bottom = "auto";
				try {
					if (typeof localStorage !== "undefined" && localStorage) {
						localStorage.setItem("mbCE_toggle_pos_v1", JSON.stringify({ left: nl, top: nt }));
					}
				} catch (e2) {}
			}
		}
		toggleBtn.addEventListener("pointerup", tgDragEnd);
		toggleBtn.addEventListener("pointercancel", tgDragEnd);
		toggleBtn.addEventListener("click", function () {
			if (drag.moved) { drag.moved = false; return; }
			toggle();
		});
		try { toggleBtn.__mbCEBound = true; } catch (e2) {}
		}

		root = el("div", "mce-root");
		root.id = "mce-root";

		var header = el("div", "mce-header");
		header.appendChild(el("span", "mce-title", "剧情条件解锁面板 v" + MCE_VERSION));
		/* v1.9.29 主题切换按钮（✦ 星星图标）：黑金 ⇄ 星空蓝 循环，持久化 localStorage */
		var themeBtn = el("button", "mce-theme-btn", "✦");
		themeBtn.type = "button";
		themeBtn.title = "切换主题：黑金 / 星空蓝";
		themeBtn.addEventListener("click", function () {
			var next = getTheme() === "starry" ? "gold" : "starry";
			setTheme(next);
			setStatus(next === "starry" ? "已切换：星空蓝 ✦ 愿星光指引你" : "已切换：黑金", "mce-ok");
		});
		header.appendChild(themeBtn);
		/* v1.8.12 错误收集红点（数量徽标，点击展开错误列表） */
		var errBtn = el("button", "mce-errbtn", "0");
		errBtn.type = "button";
		errBtn.addEventListener("click", mbCEToggleErrBox);
		header.appendChild(errBtn);
		var closeBtn = el("button", "mce-close", "关闭");
		closeBtn.type = "button";
		closeBtn.title = "关闭";
		header.appendChild(closeBtn);

		var tabs = el("div", "mce-tabs");
		var names = [["char", "角色"], ["stage", "阶段"], ["scenes", "剧情"], ["places", "场景"], ["global", "全局"], ["mods", "Mod作弊"], ["yanling", "言灵"]];
		names.forEach(function (pair) {
			var b = el("button", pair[0] === mbCEUiState.tab ? "mce-active" : "", pair[1]);
			b.type = "button";
			b.setAttribute("data-tab", pair[0]);
			tabs.appendChild(b);
		});

		var body = el("div", "mce-body");
		var panes = [["char", "mce-pane mce-active"], ["stage", "mce-pane"], ["scenes", "mce-pane"],
			["places", "mce-pane"], ["global", "mce-pane"], ["mods", "mce-pane"], ["yanling", "mce-pane"]];
		panes.forEach(function (pair) {
			var p = el("div", pair[0] === mbCEUiState.tab ? "mce-pane mce-active" : "mce-pane");
			p.setAttribute("data-pane", pair[0]);
			body.appendChild(p);
		});

		var status = el("div", "mce-status", "就绪");

		root.appendChild(header);
		root.appendChild(tabs);
		root.appendChild(body);
		root.appendChild(status);
		document.body.appendChild(root);

		/* v1.8.12 错误列表箱（header 红点下方） + 复制全部 */
		var errBox = el("div", "mce-errbox");
		var errTools = el("div", "mce-row");
		var copyBtn = el("button", "", "复制全部错误"); copyBtn.type = "button";
		copyBtn.addEventListener("click", mbCECopyErrors);
		var clearBtn = el("button", "", "清空"); clearBtn.type = "button";
		clearBtn.addEventListener("click", function () { mbCEErrors = []; mbCEUpdateErrBadge(true); mbCERenderErrBox(); });
		errTools.appendChild(copyBtn);
		errTools.appendChild(clearBtn);
		var errRows = el("div", "mce-errrows");
		errBox.appendChild(errTools);
		errBox.appendChild(errRows);
		if (body.insertBefore) { body.insertBefore(errBox, body.firstChild); }
		else { body.appendChild(errBox); }
		mbCEErrBtn = errBtn;
		mbCEErrBox = errBox;
		mbCEErrRows = errRows;
		mbCEUpdateErrBadge();

		/* v1.9.29 主题恢复：mbCEUiLoad 已把持久化主题读入 state，ensureDom 后应用类（silent 不重复写） */
		setTheme(mbCEUiState.theme === "starry" ? "starry" : "gold", true);

		closeBtn.addEventListener("click", close);
		tabs.addEventListener("click", function (e) {
			var b = e.target && e.target.closest ? e.target.closest("button[data-tab]") : null;
			if (!b) { return; }
			switchOuterTab(b.getAttribute("data-tab"));
		});
	}

	/* v1.8.12 功能13：渲染节流工具——高频触发合并为一次执行（面板打开期间 passage 切换/搜索输入均适用） */
	var mceRenderTimer = null;
	var mceSearchTimer = null;
	function mceSchedule(fn, ms, bucket) {
		var t = bucket === "search" ? mceSearchTimer : mceRenderTimer;
		if (t) { clearTimeout(t); }
		t = setTimeout(function () {
			if (bucket === "search") { mceSearchTimer = null; } else { mceRenderTimer = null; }
			try { fn(); } catch (e) {}
		}, ms || 60);
		if (bucket === "search") { mceSearchTimer = t; } else { mceRenderTimer = t; }
	}
