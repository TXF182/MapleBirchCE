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

	/* v1.9.14 效果2：写入成功闪烁——目标行/按钮加 .mce-flash（金底 0.6s→透明），
	   同一 timer 统一清理全部 flash 节点（连点不堆积；强制 reflow 保证同一节点动画重放） */
	var mbCEFlashTimer = null;
	function mbCEFlash(node) {
		try {
			if (!node || !node.classList || !node.classList.add) { return; }
			node.classList.remove("mce-flash");
			void node.offsetWidth; /* 强制 reflow：同节点连闪时重放动画 */
			node.classList.add("mce-flash");
			if (mbCEFlashTimer) { clearTimeout(mbCEFlashTimer); }
			mbCEFlashTimer = setTimeout(function () {
				mbCEFlashTimer = null;
				var els = root ? root.querySelectorAll(".mce-flash") : [];
				for (var i = 0; i < els.length; i++) { els[i].classList.remove("mce-flash"); }
			}, 650);
		} catch (e) {}
	}
	function mbCEFlashRow(btnOrEl) {
		try {
			var n = btnOrEl && btnOrEl.closest ? btnOrEl.closest(".mce-row, .mce-statrow, .mce-stage") : null;
			mbCEFlash(n || btnOrEl);
		} catch (e) {}
	}
	/* v1.9.14 效果2：全量重建页（renderPlaces 等）重渲染后按 data-stagekey 定位新行闪烁——render 同步执行完 DOM 已建 */
	function mbCEFlashAfterRender(stageKey) {
		try {
			if (!stageKey) { return; }
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape(stageKey) : String(stageKey).replace(/["\\]/g, "\\$&");
			var row = root ? root.querySelector('[data-stagekey="' + esc + '"]') : null;
			if (row) { mbCEFlash(row); }
		} catch (e) {}
	}

	var CSS = "" +
		/* ===== v1.9.18 排版 token 化：改主题/字号只动 :root 变量 ===== */
		":root{" +
		"--mce-accent:#d4a73c;--mce-accent-hover:#e0b44a;--mce-accent-dark:#b38a2a;--mce-accent-55:rgba(212,167,60,.55);" +
		"--mce-gold-soft:#f0d070;--mce-gold-note:#8a6d3b;--mce-gold-bg:#2a2208;--mce-gold-txt:#f0d98c;" +
		"--mce-bg-panel:rgba(5,5,5,.96);--mce-bg-deep:#0d0d0d;--mce-bg-base:#1a1a1a;--mce-bg-card:#111;--mce-bg-block:#0f0f0f;" +
		"--mce-bg-stage:#101010;--mce-bg-detail:#141414;--mce-bg-ctl:#181818;--mce-bg-btn:#222;--mce-bg-hover:#333;--mce-bg-sel:#18150c;" +
		"--mce-red:#ff6b6b;--mce-red-soft:#ff9c9c;--mce-red-deep:#c0392b;--mce-red-bg:#5a2323;--mce-red-bg-h:#6e2b2b;--mce-red-bg-b:#7a3030;" +
		"--mce-red-badge:#3a1c1c;--mce-red-badge-b:#5a2e2e;--mce-red-row:#170d0d;--mce-red-err:#2a1515;--mce-red-err-txt:#ffd0d0;--mce-red-err-src:#a07070;--mce-red-err-soft:#ffb0b0;--mce-red-errbox:#150b0b;" +
		"--mce-green:#7ed89a;--mce-green-deep:#2e9e52;--mce-green-badge:#1c3a24;--mce-green-badge-b:#2e5a3c;--mce-green-row:#0d1710;" +
		"--mce-border:#3c3c3c;--mce-border-soft:#333;--mce-border-dim:#2a2a2a;--mce-border-faint:#1f1f1f;--mce-border-ctl:#3a3a3a;--mce-border-stage:#555;" +
		"--mce-txt:#f2f2f2;--mce-txt-bright:#fff;--mce-txt-on-accent:#111;--mce-txt-hi:#e6e6e6;--mce-txt-label:#d8d8d8;--mce-txt-strong:#eee;" +
		"--mce-txt-mid:#ccc;--mce-txt-dim:#b9b9b9;--mce-txt-faint:#aaa;--mce-txt-muted:#9c9c9c;--mce-txt-weak:#8a8a8a;--mce-txt-star:#666;" +
		"--mce-fs-xl:16px;--mce-fs-lg:15px;--mce-fs-tab:14px;--mce-fs-base:13px;--mce-fs-btn:12px;--mce-fs-sm:11px;--mce-fs-xs:10px;" +
		"--mce-radius:3px;--mce-radius-sm:2px;--mce-radius-pill:8px;" +
		"--mce-space:8px;--mce-space-md:6px;--mce-space-sm:4px;--mce-h-header:42px;--mce-scroll:8px;" +
		"}" +
		"#mce-root{display:none;position:fixed;top:8px;right:0;bottom:8px;width:430px;max-width:96vw;max-height:calc(100vh - 16px);z-index:2147483000;" +
		"background:var(--mce-bg-panel);border:1px solid var(--mce-border);border-right:none;box-shadow:0 12px 34px rgba(0,0,0,.7);" +
		"color:var(--mce-txt);flex-direction:column;overflow:hidden;" +
		"font-family:'Noto Serif SC','Source Han Serif SC','Microsoft YaHei',serif;font-size:var(--mce-fs-base);line-height:1.5}" +
		"#mce-root.mce-open{display:flex;animation:mce-pop-in .15s ease-out}" +
		"#mce-root.mce-closing{animation:mce-pop-out .12s ease-in forwards}" +
		"#mce-toggle{position:fixed;right:14px;bottom:14px;z-index:2147482999;width:52px;height:52px;border-radius:50%;" +
		"background:var(--mce-accent);color:var(--mce-txt-on-accent);border:2px solid var(--mce-accent-dark);font-size:var(--mce-fs-lg);font-weight:700;cursor:pointer;" +
		"box-shadow:0 4px 14px rgba(0,0,0,.6);font-family:inherit;touch-action:none;" +
		"user-select:none;-webkit-user-select:none;transition:background .12s ease,transform .12s ease,box-shadow .12s ease}" +
		"#mce-toggle:hover{background:var(--mce-accent-hover)}" +
		"#mce-toggle:active{transform:scale(.94)}" +
		"#mce-toggle.mce-dragging{cursor:grabbing!important;background:var(--mce-accent-hover);transform:none!important}" +
		".mce-header{display:flex;align-items:center;height:var(--mce-h-header);padding:0 10px;background:var(--mce-bg-base);" +
		"border-bottom:1px solid var(--mce-border);color:var(--mce-accent);font-weight:700;font-size:var(--mce-fs-lg)}" +
		".mce-header .mce-title{flex:1;text-align:center}" +
		".mce-header button{background:transparent;border:none;color:var(--mce-txt-mid);font-size:var(--mce-fs-xl);cursor:pointer;padding:0 7px}" +
		".mce-header button:hover{color:var(--mce-txt-bright)}" +
		".mce-tabs{display:flex;background:var(--mce-bg-deep);border-bottom:1px solid var(--mce-border)}" +
		".mce-tabs button{flex:1;background:transparent;border:none;border-bottom:2px solid transparent;" +
		"color:var(--mce-txt-dim);padding:9px 0;cursor:pointer;font-size:var(--mce-fs-tab);font-family:inherit}" +
		".mce-tabs button.mce-active{color:var(--mce-accent);border-bottom-color:var(--mce-accent)}" +
		".mce-body{flex:1;overflow-y:auto;padding:10px;min-height:120px;overscroll-behavior:contain}" +
		/* v1.9.18 容器自适应：面板内滚动条统一（金色系，随 token 主题）+ 分页 sticky 页头（header/tabs 为 flex 固定行，明确防压缩） */
		".mce-header,.mce-tabs{flex:none}" +
		"#mce-root ::-webkit-scrollbar{width:var(--mce-scroll);height:var(--mce-scroll)}" +
		"#mce-root ::-webkit-scrollbar-thumb{background:var(--mce-border-ctl);border-radius:var(--mce-radius-pill)}" +
		"#mce-root ::-webkit-scrollbar-thumb:hover{background:var(--mce-border)}" +
		"#mce-root ::-webkit-scrollbar-track{background:transparent}" +
		"#mce-root{scrollbar-width:thin;scrollbar-color:var(--mce-border-ctl) transparent}" +
		".mce-pane{display:none}.mce-pane.mce-active{display:block}" +
		/* 角色卡片 */
		".mce-cards{display:grid;grid-template-columns:1fr 1fr;gap:var(--mce-space)}" +
		".mce-card{background:var(--mce-bg-card);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius);padding:8px;cursor:pointer}" +
		".mce-card:hover{border-color:var(--mce-accent)}" +
		".mce-card.mce-sel{border-color:var(--mce-accent);background:var(--mce-bg-sel)}" +
		".mce-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}" +
		".mce-card-name{color:var(--mce-txt-bright);font-weight:700;font-size:var(--mce-fs-base);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
		".mce-badge{font-size:var(--mce-fs-xs);padding:1px 6px;border-radius:var(--mce-radius-pill);white-space:nowrap}" +
		".mce-badge.mce-on{background:var(--mce-green-badge);color:var(--mce-green);border:1px solid var(--mce-green-badge-b)}" +
		".mce-badge.mce-off{background:var(--mce-red-badge);color:var(--mce-red);border:1px solid var(--mce-red-badge-b)}" +
		".mce-card-stats{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:var(--mce-fs-sm);color:var(--mce-txt-muted)}" +
		".mce-card-stats b{color:var(--mce-accent)}" +
		/* 数据卡 */
		".mce-section{font-size:var(--mce-fs-btn);color:var(--mce-txt-muted);border-bottom:1px dashed var(--mce-border-soft);padding:2px 0 4px;margin:10px 0 6px}" +
		".mce-statrow{display:flex;align-items:center;gap:var(--mce-space-md);margin:5px 0;flex-wrap:wrap}" +
		".mce-label{color:var(--mce-txt-label);min-width:56px}" +
		".mce-value{color:var(--mce-accent);font-weight:700;min-width:44px;text-align:right}" +
		".mce-btn{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border:1px solid var(--mce-border);border-radius:var(--mce-radius-sm);padding:3px 9px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit;" +
		"transition:background .12s ease,transform .12s ease,box-shadow .12s ease}" +
		".mce-btn:hover{background:var(--mce-bg-hover)}" +
		".mce-btn:active{transform:scale(.96)}" +
		".mce-btn.mce-gold{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent-dark);font-weight:700}" +
		".mce-btn.mce-gold:hover{background:var(--mce-accent-hover);transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.45)}" +
		".mce-btn.mce-gold:active{transform:scale(.96);box-shadow:none}" +
		".mce-btn.mce-red{background:var(--mce-red-bg);color:var(--mce-red-soft);border-color:var(--mce-red-bg-b)}" +
		".mce-btn.mce-red:hover{background:var(--mce-red-bg-h)}" +
		".mce-btn:disabled{opacity:.45;cursor:not-allowed}" +
		".mce-actions{display:flex;flex-wrap:wrap;gap:var(--mce-space-md);margin:var(--mce-space) 0}" +
		/* 内层标签 */
		".mce-inner{display:flex;gap:var(--mce-space-sm);margin:var(--mce-space) 0;border-bottom:1px solid var(--mce-border-dim);padding-bottom:6px}" +
		".mce-inner button{background:var(--mce-bg-ctl);color:var(--mce-txt-faint);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius-sm);padding:3px 10px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit}" +
		".mce-inner button.mce-active{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent)}" +
		/* 阶段列表 */
		".mce-stages{display:flex;flex-direction:column;gap:var(--mce-space-md)}" +
		".mce-stage{border-left:3px solid var(--mce-border-stage);background:var(--mce-bg-stage);border-radius:var(--mce-radius-sm);padding:7px 9px}" +
		".mce-stage.mce-pass{border-left-color:var(--mce-green-deep);background:var(--mce-green-row)}" +
		".mce-stage.mce-fail{border-left-color:var(--mce-red-deep);background:var(--mce-red-row)}" +
		".mce-stage-head{display:flex;align-items:center;gap:var(--mce-space)}" +
		".mce-dot{width:9px;height:9px;border-radius:50%;flex:none}" +
		".mce-pass .mce-dot{background:var(--mce-green-deep)}" +
		".mce-fail .mce-dot{background:var(--mce-red-deep)}" +
		".mce-stage-name{color:var(--mce-txt-strong);font-weight:700;font-size:var(--mce-fs-base);flex:1}" +
		".mce-stage-txt{color:var(--mce-txt-dim);font-size:var(--mce-fs-sm);margin-top:4px;word-break:break-all;font-family:Consolas,Menlo,monospace}" +
		".mce-stage-note{color:var(--mce-gold-note);font-size:var(--mce-fs-sm);margin-top:3px}" +
		".mce-hint{color:var(--mce-txt-weak);font-size:var(--mce-fs-btn);margin:var(--mce-space-sm) 0}" +
		/* v1.5.2 使用提示（剧情页页首警示框） */
		".mce-warn{background:var(--mce-gold-bg);border:1px solid var(--mce-accent);color:var(--mce-gold-txt);font-size:var(--mce-fs-btn);margin:var(--mce-space-sm) 0;padding:8px 10px;border-radius:var(--mce-radius);line-height:1.6}" +
		".mce-err{color:var(--mce-red);font-size:var(--mce-fs-base)}" +
		".mce-ok{color:var(--mce-green);font-size:var(--mce-fs-base)}" +
		".mce-status{min-height:18px;padding:6px 10px;border-top:1px solid var(--mce-border);background:var(--mce-bg-deep);color:var(--mce-txt-muted);font-size:var(--mce-fs-btn)}" +
		".mce-type{display:inline-block;background:var(--mce-bg-base);color:var(--mce-txt-mid);border:1px solid var(--mce-border);border-radius:var(--mce-radius-sm);padding:2px 8px;font-size:var(--mce-fs-sm);margin:2px}" +
		".mce-build{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:var(--mce-space-sm) 0}" +
		/* v1.4.0 Mod作弊页面 */
		/* v1.9.1（DoL-Game-UI 冲突排查）：.mce-grp 加 contain:content——限制组内重排/重绘范围，
		   减少大列表下（如枯木逢春 28 数值项展开）对 DoL-Game-UI 每帧 rAF 全量扫描的主线程叠加压力 */
		".mce-grp{border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius);margin:var(--mce-space) 0;padding:8px;background:var(--mce-bg-block);contain:content}" +
		".mce-grp-t{color:var(--mce-accent);font-weight:700;font-size:var(--mce-fs-base);margin-bottom:6px}" +
		".mce-collapse-head{cursor:pointer;user-select:none}" +
		".mce-collapse-head:hover{color:var(--mce-gold-soft)}" +
		".mce-grp-body[data-collapsed=\"1\"]{display:none}" +
		/* v1.9.14 效果4：折叠组展开淡入（display:none→block 切换时动画自动重放，覆盖 Mod 作弊/特质/角色/剧情全部折叠组） */
		".mce-grp-body[data-collapsed=\"0\"]{animation:mce-fade-in .2s ease-out}" +
		".mce-row{display:flex;align-items:center;gap:var(--mce-space);flex-wrap:wrap;padding:5px 0;border-top:1px solid var(--mce-border-faint);font-size:var(--mce-fs-btn)}" +
		".mce-row-lbl{color:var(--mce-txt-hi);flex:1;min-width:120px;word-break:break-all}" +
		".mce-row button{background:var(--mce-bg-ctl);color:var(--mce-txt-mid);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius-sm);padding:3px 8px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit}" +
		".mce-row button:hover{border-color:var(--mce-accent);color:var(--mce-accent)}" +
		".mce-inp{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius-sm);padding:3px 6px;font-size:var(--mce-fs-btn);width:90px;font-family:Consolas,Menlo,monospace}" +
		".mce-search-inp{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius-sm);padding:3px 6px;font-size:var(--mce-fs-btn);width:220px;font-family:Consolas,Menlo,monospace}" +
		".mce-sel{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius-sm);padding:3px 4px;font-size:var(--mce-fs-btn);font-family:inherit;max-width:170px;flex:0 1 auto}" +
		/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档） */
		".mce-ab-detail{margin-left:4px;font-size:var(--mce-fs-sm)}" +
		".mce-ab-sum{cursor:pointer;color:var(--mce-txt-weak);user-select:none;display:inline-block}" +
		".mce-ab-sum:hover{color:var(--mce-gold-soft)}" +
		".mce-ab-body{background:var(--mce-bg-detail);border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius-sm);padding:5px 8px;margin-top:3px;color:var(--mce-txt-dim);line-height:1.7;min-width:220px}" +
		".mce-ab-note{color:var(--mce-gold-note);margin-top:2px}" +
		/* v1.8.12 特质收藏星标 */
		".mce-favstar{background:transparent;border:none;padding:0 5px;cursor:pointer;color:var(--mce-txt-star);font-size:var(--mce-fs-btn);line-height:1}" +
		".mce-favstar:hover{color:var(--mce-gold-soft)}" +
		".mce-favstar.mce-fav{color:var(--mce-accent)}" +
		/* v1.8.12 错误收集器 */
		".mce-errbtn{background:var(--mce-red-bg);color:var(--mce-red-soft);border:1px solid var(--mce-red-bg-b);border-radius:50%;" +
		"min-width:20px;height:20px;line-height:18px;font-size:var(--mce-fs-sm);font-weight:700;cursor:pointer;padding:0 4px;display:none}" +
		".mce-errbtn.mce-on{display:inline-block}" +
		".mce-errbox{display:none;background:var(--mce-red-errbox);border-bottom:1px solid var(--mce-border);max-height:40%;overflow-y:auto;padding:6px 8px}" +
		".mce-errbox.mce-on{display:block}" +
		".mce-errrow{border-top:1px solid var(--mce-red-err);padding:4px 0;font-size:var(--mce-fs-sm);color:var(--mce-red-err-soft);font-family:Consolas,Menlo,monospace;word-break:break-all}" +
		".mce-errrow .mce-err-msg{color:var(--mce-red-err-txt)}" +
		".mce-errrow .mce-err-src{color:var(--mce-red-err-src);font-size:var(--mce-fs-xs)}" +
		/* v1.9.14 UI 动效：面板内全部按钮统一按压反馈（缩放）与过渡；写入成功闪烁 + 面板开合/折叠淡入 keyframes */
		"#mce-root button{transition:background .12s ease,color .12s ease,transform .12s ease,box-shadow .12s ease}" +
		"#mce-root button:active{transform:scale(.96)}" +
		".mce-flash{animation:mce-flash .6s ease-out}" +
		"@keyframes mce-pop-in{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}" +
		"@keyframes mce-pop-out{from{opacity:1}to{opacity:0}}" +
		"@keyframes mce-fade-in{from{opacity:0}to{opacity:1}}" +
		"@keyframes mce-flash{0%{background:var(--mce-accent-55);box-shadow:0 0 0 1px var(--mce-accent)}100%{background:transparent;box-shadow:none}}";

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

