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
		".mce-sel{background:#0d0d0d;color:#eee;border:1px solid #3a3a3a;border-radius:2px;padding:3px 4px;font-size:12px;font-family:inherit}";

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
		if (name === "char") { renderCards(); }
		if (name === "stage") { renderStagePane(); }
		if (name === "scenes") { renderScenes(); }
		if (name === "places") { renderPlaces(); }
		if (name === "global") { renderGlobal(); }
		if (name === "mods") { renderModCheats(); }
	}

