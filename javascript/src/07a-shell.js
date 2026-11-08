	/* ============ UI：右侧常驻黑色悬浮侧边面板（CE 样式，双层标签） ============ */
	var root = null;
	var toggleBtn = null;
	var openFlag = false;
	var curName = "";
	var curInnerTab = "romance";
	var initialized = false;
	var mbCETheme = "gold"; /* v1.9.29 主题：gold 黑金 / starry 星空蓝 */

	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) { node.className = cls; }
		if (text !== undefined && text !== null) { node.textContent = String(text); }
		return node;
	}

	/* ============ v2.0.2 按键排版helper：区块编号 / 二级分组 / 按钮网格 / 说明折叠 ============
	   设计口径（解决"功能越加越多、面板越堆越乱"）：
	     ① 同页区块统一编号（mceNewSec），玩家一眼知道一页有几块、当前在第几块；
	     ② 语义相近的区块收进二级分组（mceNewGroup），组名一句话说明"这一组在干什么"；
	     ③ 同构按钮走 2 列网格（mceBtnGrid），不再每行一个把纵向拉长；
	     ④ 长说明默认折叠成 2 行（mceFoldHint），点击展开，避免每块 2~3 行密文占屏。
	   全部返回普通 DOM 节点，调用方后续 appendChild 逻辑不变（替换点最小）。 */
	var mceSecNo = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯"];
	/* 编号映射：idx<=0 / 非数字 → 空串（真正“不编号”）；超出字表 → 阿拉伯数字。
	   旧实现 mceSecMark(0) 返回 "0"、mceSecMark(undefined) 返回 "undefined" 文本，与“idx=0 不编号”的约定不符。 */
	function mceSecMark(idx) {
		var n = Number(idx);
		if (!isFinite(n) || n <= 0) { return ""; }
		return mceSecNo[n - 1] || String(n);
	}
	/* 说明折叠：默认 2 行截断，点击整块切换展开/收起（data-open=1/0 供测试断言） */
	function mceFoldHint(text) {
		var h = el("div", "mce-hint mce-fold", text);
		h.setAttribute("data-open", "0");
		h.title = "点击展开 / 收起完整说明";
		h.addEventListener("click", function () {
			h.setAttribute("data-open", h.getAttribute("data-open") === "0" ? "1" : "0");
		});
		return h;
	}
	/* 带编号区块：返回区块容器，后续照旧 sec.appendChild(...) */
	function mceNewSec(parent, idx, title, hint) {
		var sec = el("div", "mce-block");
		var head = el("div", "mce-sec-title");
		head.appendChild(el("span", "mce-sec-n", mceSecMark(idx)));
		head.appendChild(el("span", "", title));
		sec.appendChild(head);
		if (hint) { sec.appendChild(mceFoldHint(hint)); }
		if (parent) { parent.appendChild(sec); }
		return sec;
	}
	/* 二级分组：返回组内 body 容器（组名 + 右侧副标） */
	function mceNewGroup(parent, title, sub) {
		var g = el("div", "mce-group");
		var head = el("div", "mce-group-h");
		head.appendChild(el("span", "", title));
		if (sub) { head.appendChild(el("span", "mce-group-n", sub)); }
		g.appendChild(head);
		var body = el("div", "mce-group-b");
		g.appendChild(body);
		if (parent) { parent.appendChild(g); }
		return body;
	}
	/* 2 列按钮网格容器 */
	function mceBtnGrid(parent) {
		var g = el("div", "mce-btn-grid");
		if (parent) { parent.appendChild(g); }
		return g;
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

	var MB_CSS = "" +
		/* ===== v1.9.18 排版 token 化：改主题/字号只动 :root 变量 ===== */
		":root{" +
		"--mce-accent:#d4a73c;--mce-accent-hover:#e0b44a;--mce-accent-dark:#b38a2a;--mce-accent-55:rgba(212,167,60,.55);" +
		"--mce-gold-soft:#f0d070;--mce-gold-note:#8a6d3b;--mce-gold-bg:#2a2208;--mce-gold-txt:#f0d98c;" +
		"--mce-bg-panel:rgba(5,5,5,.92);--mce-bg-deep:#0d0d0d;--mce-bg-base:#1a1a1a;--mce-bg-card:#111;--mce-bg-block:#0f0f0f;" +
		"--mce-bg-stage:#101010;--mce-bg-detail:#141414;--mce-bg-ctl:#181818;--mce-bg-btn:#222;--mce-bg-hover:#333;--mce-bg-sel:#18150c;" +
		"--mce-red:#ff6b6b;--mce-red-soft:#ff9c9c;--mce-red-deep:#c0392b;--mce-red-bg:#5a2323;--mce-red-bg-h:#6e2b2b;--mce-red-bg-b:#7a3030;" +
		"--mce-red-badge:#3a1c1c;--mce-red-badge-b:#5a2e2e;--mce-red-row:#170d0d;--mce-red-err:#2a1515;--mce-red-err-txt:#ffd0d0;--mce-red-err-src:#a07070;--mce-red-err-soft:#ffb0b0;--mce-red-errbox:#150b0b;" +
		"--mce-green:#7ed89a;--mce-green-deep:#2e9e52;--mce-green-badge:#1c3a24;--mce-green-badge-b:#2e5a3c;--mce-green-row:#0d1710;" +
		"--mce-border:#3c3c3c;--mce-border-soft:#333;--mce-border-dim:#2a2a2a;--mce-border-ctl:#3a3a3a;--mce-border-stage:#555;" +
		"--mce-txt:#f2f2f2;--mce-txt-bright:#fff;--mce-txt-on-accent:#111;--mce-txt-hi:#e6e6e6;--mce-txt-label:#d8d8d8;--mce-txt-strong:#eee;" +
		"--mce-txt-mid:#ccc;--mce-txt-dim:#b9b9b9;--mce-txt-faint:#aaa;--mce-txt-muted:#9c9c9c;--mce-txt-weak:#8a8a8a;--mce-txt-star:#666;" +
		"--mce-fs-xl:16px;--mce-fs-lg:15px;--mce-fs-tab:14px;--mce-fs-base:13px;--mce-fs-btn:12px;--mce-fs-sm:11px;--mce-fs-xs:10px;" +
		"--mce-radius:4px;--mce-radius-sm:2px;--mce-radius-pill:8px;" +
		"--mce-space:8px;--mce-space-md:6px;--mce-space-sm:4px;--mce-h-header:42px;--mce-panel-w:430px;--mce-panel-r:8px;--mce-row-h:34px;--mce-tab-h:36px;--mce-border-quiet:rgba(255,255,255,.08);--mce-scroll:8px;" +
		"}" +
		"#mce-root{display:none;position:fixed;top:8px;right:0;bottom:8px;width:var(--mce-panel-w);max-width:96vw;max-height:calc(100vh - 16px);z-index:2147483000;" +
		"background:var(--mce-bg-panel);border:1px solid var(--mce-border-quiet);border-right:none;border-radius:var(--mce-panel-r) 0 0 var(--mce-panel-r);box-shadow:0 10px 28px rgba(0,0,0,.55);" +
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
		"border-bottom:1px solid var(--mce-border-quiet);color:var(--mce-accent);font-weight:700;font-size:var(--mce-fs-lg)}" +
		".mce-header .mce-title{flex:1;text-align:center}" +
		".mce-header button{background:transparent;border:none;color:var(--mce-txt-mid);font-size:var(--mce-fs-xl);cursor:pointer;padding:0 7px}" +
		".mce-header button:hover{color:var(--mce-txt-bright)}" +
		".mce-tabs{display:flex;background:var(--mce-bg-deep);border-bottom:1px solid var(--mce-border-quiet);overflow-x:auto}" +
		/* v2.0.0.006 页签增至 7 个：改 flex:1 0 auto + nowrap + 横向滚动，避免「Mod作弊」被压窄换行 */
		".mce-tabs button{flex:1 0 auto;background:transparent;border:none;border-bottom:2px solid transparent;white-space:nowrap;" +
		"color:var(--mce-txt-dim);padding:8px 6px;min-height:var(--mce-tab-h);cursor:pointer;font-size:var(--mce-fs-tab);font-family:inherit}" +
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
		".mce-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:8px}" +
		".mce-card-name{flex:1 1 auto;min-width:0;color:var(--mce-txt-bright);font-weight:700;font-size:var(--mce-fs-base);white-space:normal;line-height:1.4;word-break:break-word}" +
		".mce-badge{font-size:var(--mce-fs-xs);padding:1px 6px;border-radius:var(--mce-radius-pill);white-space:nowrap}" +
		".mce-badge.mce-on{background:var(--mce-green-badge);color:var(--mce-green);border:1px solid var(--mce-green-badge-b)}" +
		".mce-badge.mce-off{background:var(--mce-red-badge);color:var(--mce-red);border:1px solid var(--mce-red-badge-b)}" +
		".mce-card-stats{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:var(--mce-fs-sm);color:var(--mce-txt-muted)}" +
		".mce-card-stats b{color:var(--mce-accent)}" +
		/* 数据卡 */
		/* v1.9.22 自查补：角色数据卡（07c-stage 角色数据卡，此前裸样式无容器视觉） */
		".mce-data-card{background:var(--mce-bg-card);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius);padding:8px;margin:var(--mce-space) 0}" +
		".mce-section{font-size:var(--mce-fs-btn);color:var(--mce-txt-muted);border-bottom:1px solid var(--mce-border-quiet);padding:2px 0 4px;margin:10px 0 6px}" +
		".mce-statrow{display:flex;align-items:center;gap:var(--mce-space-md);margin:5px 0;min-height:var(--mce-row-h);flex-wrap:wrap}" +
		".mce-statrow:hover .mce-label{color:var(--mce-accent)}" +
		".mce-label{color:var(--mce-txt-label);min-width:56px}" +
		".mce-value{color:var(--mce-accent);font-weight:700;min-width:44px;text-align:right}" +
		".mce-btn{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border:1px solid var(--mce-border);border-radius:var(--mce-radius);padding:3px 9px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit;" +
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
		/* v2.0.2 按键排版：编号区块 / 二级分组 / 按钮网格 / 说明折叠 */
		".mce-block{margin:4px 0 10px}" +
		".mce-sec-title{display:flex;align-items:center;gap:6px;color:var(--mce-txt-strong);font-weight:700;font-size:var(--mce-fs-base);border-bottom:1px solid var(--mce-border-quiet);padding:2px 0 5px;margin:8px 0 6px}" +
		".mce-sec-n{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:4px;background:var(--mce-accent);color:var(--mce-txt-on-accent);font-size:var(--mce-fs-sm);font-weight:700;padding:0 4px;flex:none}" +
		".mce-group{margin:8px 0 4px;padding:6px 8px 8px;background:var(--mce-bg-block);border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius);contain:content}" +
		".mce-group-h{display:flex;align-items:baseline;gap:6px;color:var(--mce-accent);font-weight:700;font-size:var(--mce-fs-btn);margin-bottom:2px}" +
		".mce-group-n{color:var(--mce-gold-soft);font-size:var(--mce-fs-sm);font-weight:400;opacity:.85}" +
		".mce-btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--mce-space-sm);margin:var(--mce-space-sm) 0 2px}" +
		".mce-btn-grid .mce-btn{width:100%;text-align:center;white-space:normal;line-height:1.35;padding:6px 8px}" +
		".mce-btn-grid .mce-btn:only-child{grid-column:1 / -1}" +
		".mce-hint.mce-fold{cursor:pointer;line-height:1.5}" +
		".mce-hint.mce-fold[data-open=\"0\"]{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
		".mce-hint.mce-fold:hover{color:var(--mce-txt-hi)}" +
		/* 折叠说明盒：收起时只留摘要行，展开后补出全部条目 */
		".mce-foldbox[data-open=\"0\"] .mce-hint:not(.mce-fold){display:none}" +
		".mce-foldbox[data-open=\"1\"] .mce-hint:not(.mce-fold){display:block;animation:mce-fade-in .2s ease-out}" +
		/* 内层标签 */
		".mce-inner{display:flex;gap:var(--mce-space-sm);margin:var(--mce-space) 0;border-bottom:1px solid var(--mce-border-quiet);padding-bottom:6px}" +
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
		/* v1.9.22 自查补：剧情进度说明 note（07h-render，此前裸样式） */
		".mce-note{color:var(--mce-txt-dim);font-size:var(--mce-fs-sm);margin-top:3px;word-break:break-all}" +
		/* v1.5.2 使用提示（剧情页页首警示框） */
		".mce-warn{background:var(--mce-gold-bg);border:1px solid var(--mce-accent);color:var(--mce-gold-txt);font-size:var(--mce-fs-btn);margin:var(--mce-space-sm) 0;padding:8px 10px;border-radius:var(--mce-radius);line-height:1.6}" +
		".mce-err{color:var(--mce-red);font-size:var(--mce-fs-base)}" +
		".mce-ok{color:var(--mce-green);font-size:var(--mce-fs-base)}" +
		".mce-status{min-height:18px;padding:6px 10px;border-top:1px solid var(--mce-border-quiet);background:var(--mce-bg-deep);color:var(--mce-txt-muted);font-size:var(--mce-fs-btn)}" +
		/* v2.0.3 P4-2：写入前 diff 预览确认条（吸在面板底部，不遮挡列表）
		   v2.0.7 D3：原先只有注释说「吸底」、CSS 无 sticky，实际挂在滚动内容最末尾 → 玩家永远看不到。
		   现改为 position:sticky + bottom:0（挂在当前活动 pane 内，滚动容器为 .mce-body），并加顶部分隔阴影。 */
		".mce-preview-bar{position:sticky;bottom:0;z-index:12;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid var(--mce-accent);background:var(--mce-gold-bg);color:var(--mce-gold-txt);font-size:var(--mce-fs-btn);box-shadow:0 -6px 14px rgba(0,0,0,.45)}" +
		".mce-preview-lbl{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
		/* P1：自定义锁定项的来源徽标（角色页 / Mod作弊 / 手动） */
		".mce-badge.mce-src{background:var(--mce-bg-ctl);color:var(--mce-txt-faint);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius-sm);padding:1px 6px;font-size:11px;white-space:nowrap}" +
		".mce-build{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:var(--mce-space-sm) 0}" +
		/* v1.4.0 Mod作弊页面 */
		/* v1.9.1（DoL-Game-UI 冲突排查）：.mce-grp 加 contain:content——限制组内重排/重绘范围，
		   减少大列表下（如枯木逢春 28 数值项展开）对 DoL-Game-UI 每帧 rAF 全量扫描的主线程叠加压力 */
		".mce-grp{border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius);margin:var(--mce-space) 0;padding:8px;background:var(--mce-bg-block);contain:content}" +
		".mce-grp-t{color:var(--mce-txt-strong);font-weight:700;font-size:var(--mce-fs-base);margin-bottom:6px}" +
		".mce-collapse-head{cursor:pointer;user-select:none}" +
		".mce-collapse-head:hover{color:var(--mce-gold-soft)}" +
		".mce-grp-body[data-collapsed=\"1\"]{display:none}" +
		/* v1.9.14 效果4：折叠组展开淡入（display:none→block 切换时动画自动重放，覆盖 Mod 作弊/特质/角色/剧情全部折叠组） */
		".mce-grp-body[data-collapsed=\"0\"]{animation:mce-fade-in .2s ease-out}" +
		".mce-row{display:flex;align-items:center;gap:var(--mce-space);flex-wrap:wrap;padding:6px 0;min-height:var(--mce-row-h);font-size:var(--mce-fs-btn)}" +
		".mce-row:hover .mce-row-lbl,.mce-row:hover .mce-row-name{color:var(--mce-accent)}" +
		".mce-row-lbl,.mce-row-name{color:var(--mce-txt-hi);flex:1;min-width:120px;word-break:break-all}" +
		".mce-btn-active{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent);font-weight:700}" +
		".mce-row button{background:var(--mce-bg-ctl);color:var(--mce-txt-mid);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 8px;min-height:22px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit}" +
		".mce-row button:hover{border-color:var(--mce-accent);color:var(--mce-accent)}" +
		".mce-inp{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 6px;font-size:var(--mce-fs-btn);width:90px;font-family:Consolas,Menlo,monospace}" +
		".mce-search-inp{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 6px;font-size:var(--mce-fs-btn);width:220px;max-width:100%;font-family:Consolas,Menlo,monospace}" +
		/* v1.9.22 自查补：锁定页自由添加 varPath 输入框（宽 200px 曾直写 JS 内联样式，现回归 CSS） */
		".mce-inp.mce-path{width:200px;max-width:100%}" +
		".mce-sel{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 4px;font-size:var(--mce-fs-btn);font-family:inherit;max-width:170px;flex:0 1 auto}" +
		".mce-inp:focus,.mce-search-inp:focus,.mce-sel:focus{outline:none;border-color:var(--mce-accent)}" +
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
		".mce-errbox{display:none;background:var(--mce-red-errbox);border-bottom:1px solid var(--mce-border-quiet);max-height:40%;overflow-y:auto;padding:6px 8px}" +
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
		"@keyframes mce-flash{0%{background:var(--mce-accent-55);box-shadow:0 0 0 1px var(--mce-accent)}100%{background:transparent;box-shadow:none}}" +
		/* v1.9.29 锚定确认条 token 化：此前内联米色/绿/灰（#f5f0e0/#7a9b4f/#888），与面板黑金 token 脱节——改走 CSS 类，换主题自动跟随 */
		".mce-anchor-prompt{position:fixed;top:0;left:0;right:0;z-index:2147483647;background:var(--mce-gold-bg);color:var(--mce-gold-txt);" +
		"border-bottom:2px solid var(--mce-accent);padding:8px 12px;font-size:14px;line-height:1.6;box-shadow:0 2px 8px rgba(0,0,0,.3);" +
		"display:flex;flex-wrap:wrap;align-items:center;gap:8px;animation:mce-prompt-in .18s ease-out}" +
		".mce-anchor-prompt button{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);" +
		"border-radius:var(--mce-radius);padding:4px 12px;cursor:pointer;font-size:13px;font-family:inherit;transition:background .12s ease,transform .12s ease}" +
		".mce-anchor-prompt button:hover{background:var(--mce-bg-hover)}" +
		".mce-anchor-prompt button:active{transform:scale(.96)}" +
		".mce-anchor-prompt .mce-anchor-go{margin-left:auto;background:var(--mce-accent);color:var(--mce-txt-on-accent);" +
		"border-color:var(--mce-accent-dark);font-weight:700}" +
		".mce-anchor-prompt .mce-anchor-go:hover{background:var(--mce-accent-hover)}" +
		"@keyframes mce-prompt-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}" +
		/* v1.9.29 星空蓝主题：深蓝夜空 + 星辉（accent 星蓝、金保留为点缀）。token 化红利——换主题只覆盖变量，组件零改动 */
		"#mce-root.mce-theme-starry{--mce-accent:#8fb3ff;--mce-accent-hover:#a9c4ff;--mce-accent-dark:#5d82d9;--mce-accent-55:rgba(143,179,255,.55);" +
		"--mce-gold-soft:#ffd98a;--mce-gold-note:#8fa3d9;--mce-gold-bg:#1a2140;--mce-gold-txt:#c9d8ff;" +
		"--mce-bg-panel:rgba(6,8,20,.94);--mce-bg-deep:#0c1022;--mce-bg-base:#10142a;--mce-bg-card:#131a36;--mce-bg-block:#0e1326;" +
		"--mce-bg-stage:#111631;--mce-bg-detail:#141b3c;--mce-bg-ctl:#1a2142;--mce-bg-btn:#1e2750;--mce-bg-hover:#2a3768;--mce-bg-sel:#1a1f3d;" +
		"--mce-border:#3d4a80;--mce-border-soft:#333e6e;--mce-border-dim:#2a3360;--mce-border-ctl:#3d4a80;--mce-border-stage:#5d7fd9;" +
		"--mce-txt:#eef2ff;--mce-txt-bright:#fff;--mce-txt-on-accent:#0a0e20;--mce-txt-hi:#e8edff;--mce-txt-label:#d9e0ff;--mce-txt-strong:#f0f3ff;" +
		"--mce-txt-mid:#c3cbee;--mce-txt-dim:#aab4e0;--mce-txt-faint:#96a2d4;--mce-txt-muted:#8b97cc;--mce-txt-weak:#7c88bf;--mce-txt-star:#5a679e;" +
		"--mce-border-quiet:rgba(160,180,255,.12);" +
		"background:radial-gradient(1200px 600px at 85% -10%,rgba(90,130,255,.16),transparent 60%),radial-gradient(900px 500px at -10% 110%,rgba(150,100,255,.10),transparent 55%),var(--mce-bg-panel)}" +
		/* 星空氛围：内容区星点（径向渐变点阵，无图零请求） */
		"#mce-root.mce-theme-starry .mce-body{background-image:radial-gradient(1px 1px at 12% 20%,rgba(255,255,255,.55),transparent)," +
		"radial-gradient(1px 1px at 31% 64%,rgba(190,215,255,.35),transparent),radial-gradient(1.2px 1.2px at 57% 10%,rgba(255,255,255,.4),transparent)," +
		"radial-gradient(1px 1px at 76% 42%,rgba(190,215,255,.3),transparent),radial-gradient(1.3px 1.3px at 87% 76%,rgba(255,255,255,.45),transparent)," +
		"radial-gradient(1px 1px at 44% 92%,rgba(190,215,255,.3),transparent);background-color:transparent}" +
		/* 悬浮球星蓝渐变 + 星辉光晕呼吸（3.5s，不影响阅读） */
		"#mce-toggle.mce-theme-starry{background:linear-gradient(135deg,#2a3768,#5d82d9 55%,#8fb3ff);border-color:#8fb3ff;animation:mce-toggle-glow 3.5s ease-in-out infinite}" +
		"@keyframes mce-toggle-glow{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 8px rgba(143,179,255,.35)}50%{box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 18px rgba(143,179,255,.7)}}" +
		/* 锚定确认条跟随主题（条在 #story 内、root 外，不继承 root 星空变量——把星空 token 组定义在条自身元素上，子按钮经继承引用） */
		".mce-anchor-prompt.mce-theme-starry{--mce-gold-bg:#1a2140;--mce-gold-txt:#c9d8ff;--mce-accent:#8fb3ff;--mce-accent-hover:#a9c4ff;" +
		"--mce-accent-dark:#5d82d9;--mce-txt-on-accent:#0a0e20;--mce-bg-btn:#1e2750;--mce-txt-strong:#f0f3ff;--mce-border-ctl:#3d4a80;--mce-bg-hover:#2a3768;" +
		"background:var(--mce-gold-bg);color:var(--mce-gold-txt);border-bottom-color:var(--mce-accent)}" +
		".mce-anchor-prompt.mce-theme-starry button{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border-color:var(--mce-border-ctl)}" +
		".mce-anchor-prompt.mce-theme-starry button:hover{background:var(--mce-bg-hover)}" +
		".mce-anchor-prompt.mce-theme-starry .mce-anchor-go{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent-dark)}" +
		".mce-anchor-prompt.mce-theme-starry .mce-anchor-go:hover{background:var(--mce-accent-hover)}" +
		/* v2.0.7 P5：窄屏（≤520px，手机竖屏 / 桌面分屏）控件拥挤——面板转全屏、行内 label 独占一行、
		   按钮网格单列、预览条说明换行，避免 84-90px 输入框 + 两个按钮挤在同一行而溢出错位 */
		"@media (max-width:520px){" +
		"#mce-root{top:0;right:0;bottom:0;left:0;width:100vw;max-width:100vw;max-height:100vh;border-radius:0;border:none}" +
		".mce-body{padding:8px}" +
		".mce-tabs button{padding:8px 5px}" +
		".mce-row{gap:var(--mce-space-sm)}" +
		".mce-row-lbl,.mce-row-name{flex:1 1 100%;min-width:0}" +
		".mce-inp{width:84px}" +
		".mce-search-inp{width:100%}" +
		".mce-inp.mce-path{width:100%}" +
		".mce-btn-grid{grid-template-columns:1fr}" +
		".mce-cards{grid-template-columns:1fr}" +
		".mce-preview-bar{gap:6px}" +
		".mce-preview-lbl{flex:1 1 100%;white-space:normal;overflow:visible}" +
		".mce-anchor-prompt{padding:6px 8px;font-size:13px}" +
		"}";

	function injectCSS() {
		if (document.getElementById("mce-style")) { return; }
		var style = el("style", "");
		style.id = "mce-style";
		style.textContent = MB_CSS;
		(document.head || document.documentElement).appendChild(style);
	}

	function setStatus(text, cls) {
		var st = root && root.querySelector(".mce-status");
		if (!st) { return; }
		st.textContent = text;
		st.className = "mce-status" + (cls ? " " + cls : "");
	}
