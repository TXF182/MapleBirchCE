/* 职责：面板 API 与页签注册表 —— render / open / close / toggle、names / panes / paneRenders 七页签、setup.mbStageCE 导出 */

	function render() {
		if (!root) { return; }
		if (!frameworkReady()) {
			setStatus("未检测到 Maplebirch 框架", MCE_CLS.err);
			return;
		}
		var pane = root.querySelector('[data-pane="char"]');
		var chars = listCharacters();
		if (!chars.length) {
			setStatus("注册池为空：未枚举到角色", MCE_CLS.err);
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
		setStatus("就绪：" + chars.length + " 个角色", MCE_CLS.ok);
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
		try {
			/* v2.2.1 无障碍：开面板即同步 aria-expanded（2026-11-22 撤抽屉，悬浮球让位协议随之删除） */
			if (toggleBtn && toggleBtn.setAttribute) { toggleBtn.setAttribute("aria-expanded", "true"); }
		} catch (e) { /* 装饰层失败不影响面板开关 */ }
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
				try {
					/* v2.2.1：关面板收尾——aria-expanded 回落（抽屉快照恢复已随抽屉一并撤除） */
					if (toggleBtn && toggleBtn.setAttribute) { toggleBtn.setAttribute("aria-expanded", "false"); }
				} catch (e) { /* 装饰层失败不影响面板开关 */ }
			}, 130);
		}
	}
	function toggle() {
		if (openFlag) { close(); } else { open(); }
	}

	/* v2.1.14 悬浮球拖动坐标换算（手机端偏移修复）
	   DoL 的「缩放」设置给 body 打 CSS zoom（options.zoom，50–200%，默认 100；原版 widget zoom() 实证
	   `$("body").css("zoom", value + "%")`）。zoom 下 getBoundingClientRect()/clientX 给的是
	   「缩放后的视口坐标」，而 style.left/top 写的是「未缩放布局坐标」——原样互写会被再缩一次：
	   zoom<100 球落在手指左上、zoom>100 落右下，且越靠边偏得越多（手机端默认就会用非 100 缩放）。
	   修法：读/写全部换算到布局坐标，位移按同一系数归一。 */
	function mbCEToggleZoomScale() {
		try {
			var z = (typeof window !== "undefined" && window.getComputedStyle) ? parseFloat(window.getComputedStyle(document.body).zoom) : NaN;
			return (isFinite(z) && z > 0) ? z : 1;
		} catch (e) { return 1; }
	}
	/* 小工具：取有限数值，否则用默认（减少分支，满足复杂度棘轮） */
	function mbCEToggleNum(v, d) {
		var n = parseFloat(v);
		return (isFinite(n) ? n : d);
	}
	/* 纯函数（供单测直接喂数值）：布局基准位 + 视口位移 → 布局 left/top，并钳进视口
	   入参全部是「布局坐标/布局尺寸」：baseLeft/baseTop 为已换算的布局起点，bw/bh 为布局宽高；
	   zs 为 body zoom（视口宽高与位移在这里归一） */
	function mbCEToggleLayoutPos(baseLeft, baseTop, dx, dy, zs, vw, vh, bw, bh) {
		var z = mbCEToggleNum(zs, 1);
		if (!(z > 0)) { z = 1; }
		var w = mbCEToggleNum(vw, 1280) / z;
		var h = mbCEToggleNum(vh, 720) / z;
		var bwl = mbCEToggleNum(bw, 52), bhl = mbCEToggleNum(bh, 52);
		if (!(bwl > 0)) { bwl = 52; }
		if (!(bhl > 0)) { bhl = 52; }
		return {
			left: Math.max(0, Math.min(Math.max(0, w - bwl - 4), mbCEToggleNum(baseLeft, 0) + mbCEToggleNum(dx, 0) / z)),
			top: Math.max(0, Math.min(Math.max(0, h - bhl - 4), mbCEToggleNum(baseTop, 0) + mbCEToggleNum(dy, 0) / z))
		};
	}
	/* body style 里的 zoom 变化监听（DoL 缩放 50–120% 浮动，改设置不触发 resize）：
	   只在 zoom 实际变化时回调一次，其余 style 抖动不打扰 */
	function mbCEToggleWatchZoom(getClamp) {
		try {
			if (typeof window.MutationObserver !== "function" || !document.body) { return null; }
			var last = mbCEToggleZoomScale();
			var obs = new window.MutationObserver(function () {
				var z = mbCEToggleZoomScale();
				if (z !== last) { last = z; getClamp(); }
			});
			obs.observe(document.body, { attributes: true, attributeFilter: ["style"] });
			return obs;
		} catch (e) { return null; }
	}
	function mbCEToggleEnsureZoomWatch(btn, getClamp) {
		try {
			window.mbCEToggleReclampNow = getClamp;
			if (btn.__mbCEZoomBound) { return; }
			btn.__mbCEZoomBound = mbCEToggleWatchZoom(getClamp) || "none";
		} catch (e) {}
	}
	try { window.mbCEToggleZoomScale = mbCEToggleZoomScale; window.mbCEToggleLayoutPos = mbCEToggleLayoutPos; } catch (eExp) {}

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
		/* v2.0.12 悬浮球坐标钳制：坐标是「上次拖拽当时的视口」写下的，换窄窗口 / 缩放 / 换显示器后
		   原坐标可能整个落在视口外；面板已废除「隐藏」功能，球是唯一入口，跑出去等于面板打不开。
		   位置恢复与窗口 resize 都走这里（拖动过程中的钳位另在 pointermove 内，同一套边界）。 */
		function tgClampPos() {
			try {
				/* v2.1.14：innerWidth / rect 是「缩放后视口坐标」，left/top 存的是布局坐标 → 边界与球尺寸都要除以 zoom */
				var z = mbCEToggleZoomScale();
				var w = ((typeof window !== "undefined" && window.innerWidth) || 1280) / z;
				var h = ((typeof window !== "undefined" && window.innerHeight) || 720) / z;
				var r = toggleBtn.getBoundingClientRect ? toggleBtn.getBoundingClientRect() : null;
				var bw = (((r && r.width) || 56) / z), bh = (((r && r.height) || 56) / z);
				var l = parseInt(tgSt.left, 10), t = parseInt(tgSt.top, 10);
				if (!isFinite(l) || !isFinite(t)) { return; } /* 从未拖过（right/bottom 定位）→ 不动 */
				tgSt.left = Math.max(0, Math.min(w - bw - 4, l)) + "px";
				tgSt.top = Math.max(0, Math.min(h - bh - 4, t)) + "px";
				tgSt.right = "auto";
				tgSt.bottom = "auto";
			} catch (e) {}
		}
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
					}
					/* v2.0.12：恢复后立即按当前视口钳回内区（历史坐标可能来自更宽的窗口，原样照写会把唯一入口送出屏幕） */
					tgClampPos();
				}
				/* 拖动锁：mbCE_toggle_lock_v1 = "1" 时禁拖动（点击仍正常开关面板） */
				toggleBtn.dataset.mceLocked = (localStorage.getItem("mbCE_toggle_lock_v1") === "1") ? "1" : "0";
				if (toggleBtn.dataset.mceLocked === "1") {
					toggleBtn.title = "Maplebirch CE 剧情条件解锁面板（拖动已锁定：点击开关面板，到「全局」页解锁拖动）";
				}
			}
		} catch (e) { /* 读不到悬浮球偏好（隐私模式/配额满/JSON 损坏）→ 保留默认位置与显示状态 */ }
		var drag = { on: false, moved: false, sx: 0, sy: 0, l: 0, t: 0, bw: 52, bh: 52, nx: 0, ny: 0, raf: 0, zs: 1 };
		/* v1.9.11+ 自查：绑定守卫——ModLoader 热重载复用同一 #mce-toggle 时跳过重复 addEventListener，
		   否则 click 监听堆叠会导致一次点击多次开关面板 */
		if (!toggleBtn.__mbCEBound) {
		toggleBtn.addEventListener("pointerdown", function (ev) {
			if (toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1") { return; }
			drag.on = true; drag.moved = false;
			drag.sx = ev.clientX; drag.sy = ev.clientY;
			/* v2.1.14：先切 mce-dragging（压掉 :active 的 transform:scale(.94)）再读矩形，按下瞬间不跳位 */
			try { toggleBtn.classList.add("mce-dragging"); } catch (e2) {}
			drag.zs = mbCEToggleZoomScale();
			var r = toggleBtn.getBoundingClientRect ? toggleBtn.getBoundingClientRect() : { left: 0, top: 0, width: 52, height: 52 };
			drag.l = r.left / drag.zs; drag.t = r.top / drag.zs;
			drag.bw = (r.width || 52) / drag.zs; drag.bh = (r.height || 52) / drag.zs;
			try { toggleBtn.setPointerCapture(ev.pointerId); } catch (e2) {}
			try { ev.preventDefault(); } catch (e2) {}
		});
		toggleBtn.addEventListener("pointermove", function (ev) {
			if (!drag.on) { return; }
			var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
			if (Math.abs(dx) < 3 && Math.abs(dy) < 3) { return; }
			drag.moved = true;
			drag.nx = drag.l + dx / (drag.zs || 1); drag.ny = drag.t + dy / (drag.zs || 1); /* v2.1.14：位移按 zoom 归一 */
			if (!drag.raf) {
				drag.raf = (typeof window !== "undefined" && window.requestAnimationFrame) ? window.requestAnimationFrame(function () {
					drag.raf = 0;
					if (!drag.on && !drag.moved) { return; }
					var w = (typeof window !== "undefined" && window.innerWidth) || 1280;
					var h = (typeof window !== "undefined" && window.innerHeight) || 720;
					var p = mbCEToggleLayoutPos(drag.nx, drag.ny, 0, 0, drag.zs, w, h, drag.bw || 52, drag.bh || 52);
					tgSt.left = p.left + "px";
					tgSt.top = p.top + "px";
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
				var p = mbCEToggleLayoutPos(drag.nx, drag.ny, 0, 0, drag.zs, w, h, drag.bw || 52, drag.bh || 52); /* v2.1.14 */
				var nl = p.left, nt = p.top;
				tgSt.left = nl + "px";
				tgSt.top = nt + "px";
				tgSt.right = "auto";
				tgSt.bottom = "auto";
				try {
					if (typeof localStorage !== "undefined" && localStorage) {
						localStorage.setItem("mbCE_toggle_pos_v1", JSON.stringify({ left: nl, top: nt }));
					}
				} catch (e2) { /* 位置持久化失败 → 位置本次会话仍生效，仅刷新后回到默认位 */ }
			}
		}
		toggleBtn.addEventListener("pointerup", tgDragEnd);
		toggleBtn.addEventListener("pointercancel", tgDragEnd);
		toggleBtn.addEventListener("click", function () {
			if (drag.moved) { drag.moved = false; return; }
			toggle();
		});
		/* v2.0.12：窗口缩放 / 屏幕旋转后重新钳位——拖拽只在那一次 move 内钳，之后窗口变小球就留在视口外 */
		if (!toggleBtn.__mbCEPosBound) {
			try { window.addEventListener("resize", tgClampPos); toggleBtn.__mbCEPosBound = true; } catch (e2) {}
		}
		/* v2.1.14：DoL「缩放」在 50–120% 浮动且改设置不触发 resize；缩小→放大时布局视口收窄，
		   球原坐标可能整颗落到屏幕外（球是面板唯一入口），故监听 zoom 变化后重新钳位 */
		mbCEToggleEnsureZoomWatch(toggleBtn, tgClampPos);
		try { toggleBtn.__mbCEBound = true; } catch (e2) {}
		}

		root = el("div", "mce-root");
		root.id = "mce-root";

		var header = el("div", "mce-header");
		header.appendChild(el("span", "mce-title", "剧情条件解锁面板 v" + MCE_VERSION));
		/* v2.1.0 主题切换从头部搬到「全局」页最上面（mceRenderThemePicker，07a-shell3-fx.js）：
		   头部原来那颗循环按钮玩家要连点三下才知道有几档，四档平铺后一档一颗、点哪颗是哪颗。 */
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
		var errTools = el("div", MCE_CLS.row);
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
		setTheme(mbCEThemeValid(mbCEUiState.theme) ? mbCEUiState.theme : "gold", true); /* v2.0.23 四主题恢复 */

		closeBtn.addEventListener("click", close);
		tabs.addEventListener("click", function (e) {
			var b = e.target && e.target.closest ? e.target.closest("button[data-tab]") : null;
			if (!b) { return; }
			switchOuterTab(b.getAttribute("data-tab"));
		});
	}

	/* v1.8.12 功能13：渲染节流工具——高频触发合并为一次执行（面板打开期间 passage 切换/搜索输入均适用）
	   v2.1.2：加第四参 guard，回调执行前再做一次有效性校验（对标 CE 1.20.4 scripts/core/CE_mapView.js 的
	   `generation === epoch && V === state && node.isConnected` 三重判定）。外层判据只在调度那一刻成立，
	   300ms 窗口内关面板 / 切页会让 root 脱离文档；guard 不成立就整段跳过，不再往已卸载的 DOM 上渲染。
	   guard 自身抛错按「失效」处理（fail-closed），不许把调度器一起炸掉。 */
	var mceRenderTimer = null;
	var mceSearchTimer = null;
	function mceSchedule(fn, ms, bucket, guard) {
		var t = bucket === "search" ? mceSearchTimer : mceRenderTimer;
		if (t) { clearTimeout(t); }
		t = setTimeout(function () {
			if (bucket === "search") { mceSearchTimer = null; } else { mceRenderTimer = null; }
			if (typeof guard === "function") {
				try { if (!guard()) { return; } } catch (eG) { return; }
			}
			try { fn(); } catch (e) {}
		}, ms || 60);
		if (bucket === "search") { mceSearchTimer = t; } else { mceRenderTimer = t; }
	}
