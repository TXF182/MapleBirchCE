/* 职责：写入前 diff 预览（v2.0.3 P4-2）——面板写入执行前先给出「键 / 旧值 → 新值」，
	   玩家点「确认写入」才真正落档。默认关闭（与旧行为完全一致），开关在「全局」页 统一回退中心 上方。
	   v2.0.7 修 A（玩家：「df 预览似乎没啥作用」）——六条缺陷一次收口：
	   D1 覆盖不全：gate 原来只挂在 cheatWriteValue。现在 cheatWriteListValue（列表写入）、
	      placeStageWrite（地点阶段/世界入口）、mbCELockSet（锁定）、mbCEPlaceWriteRaw（岛屿/地下字符串写入）
	     全部走同一个 mbCEPreviewGate，任何面板写入都能被预览拦下。
	   D2 单槽覆盖：`var mbCEPendingPreview = null` 直接覆盖，连续两次写入第一笔的 run 闭包被顶掉、
	      既不落档也不提示。改为队列 mbCEPendingQueue（最多 8 项，超出丢最旧并在条上提示）。
	   D3 确认条在滚动内容最底部（root.appendChild，无 sticky）→ 改为挂到**当前活动 pane** 内并 sticky 贴底。
	   D4 锁定绕开预览 → mbCELockSet 加 replay 参数并接 gate。
	   D5 确认后只刷 Mod作弊页 → mbCEPaneRefresh() 按当前活动页签重渲染。
	   D6 条上显示英文裸 varPath → 复用 mbCELockLabel 的三级中文回落，中文名 + 小字 path。
	   另：mbCEUiState.diffPreview 的持久化缺口（mbCEUiLoad 无此白名单分支）在 07a-shell2.js 一并补。
	   实现要点：
	   - 待确认记录只存内存（含重放闭包），刷新页面即失效——避免把函数塞进存档；
	   - 确认时置 mbCEPreviewReplay=true 重放，避免二次触发门控。 */

	var mbCEPendingQueue = [];
	var mbCEPendingPreview = null; /* 兼容旧引用：始终等于队首（不再作为唯一存储） */
	var mbCEPreviewReplay = false;
	var mbCEPreviewBarId = "mce-preview-bar";
	var MB_CE_PREVIEW_MAX = 8;

	function mbCEPreviewEnabled() {
		try { return !!(mbCEUiState && mbCEUiState.diffPreview === "1"); } catch (e) { return false; }
	}
	function mbCEPreviewFmt(v) {
		if (v === undefined) { return "（无此字段）"; }
		if (v === null) { return "null"; }
		try {
			var s = JSON.stringify(v);
			if (s === undefined) { return String(v); }
			return s.length > 48 ? s.slice(0, 48) + "…" : s;
		} catch (e) { return String(v); }
	}
	/* 中文名：复用 07f-lock 的三级回落（快速面板索引 label → zhKey(path) → zhKey(leaf) → path 原文） */
	function mbCEPreviewLabel(path) {
		try {
			if (typeof mbCELockLabel === "function") { return mbCELockLabel(path); }
		} catch (e) {}
		return String(path);
	}
	/* 返回 true = 本次被拦下（已入队待确认），false = 放行 */
	function mbCEPreviewGate(path, beforeVal, afterVal, run) {
		if (mbCEPreviewReplay || !mbCEPreviewEnabled()) { return false; }
		if (beforeVal === afterVal) { return false; }
		mbCEPendingQueue.push({ path: path, before: beforeVal, after: afterVal, run: run, t: Date.now() });
		if (mbCEPendingQueue.length > MB_CE_PREVIEW_MAX) { mbCEPendingQueue.shift(); }
		mbCEPendingPreview = mbCEPendingQueue[0];
		mbCEPreviewShow();
		return true;
	}
	function mbCEPreviewCount() { return mbCEPendingQueue.length; }
	/* 确认队首（逐条） */
	function mbCEPreviewConfirm() {
		if (!mbCEPendingQueue.length) { mbCEPreviewHide(); return { ok: false, message: "没有待确认的写入" }; }
		var p = mbCEPendingQueue.shift();
		mbCEPendingPreview = mbCEPendingQueue[0];
		mbCEPreviewReplay = true;
		var r;
		try { r = p.run(); } finally { mbCEPreviewReplay = false; }
		mbCEPreviewShow();
		if (r && typeof r === "object") { return r; }
		return { ok: true, message: "已写入 " + mbCEPreviewLabel(p.path) };
	}
	/* 全部确认（玩家诉求②） */
	function mbCEPreviewConfirmAll() {
		if (!mbCEPendingQueue.length) { mbCEPreviewHide(); return { ok: false, message: "没有待确认的写入" }; }
		var okN = 0, failN = 0;
		mbCEPreviewReplay = true;
		try {
			while (mbCEPendingQueue.length) {
				var p = mbCEPendingQueue.shift();
				if (!p || typeof p.run !== "function") { failN++; continue; }
				try {
					var r = p.run();
					if (r && r.ok === false) { failN++; } else { okN++; }
				} catch (e) { failN++; }
			}
		} finally { mbCEPreviewReplay = false; }
		mbCEPendingPreview = null;
		mbCEPreviewHide();
		return {
			ok: okN > 0,
			message: "已确认写入 " + okN + " 项" + (failN ? "，失败 " + failN + " 项（详见状态栏/控制台）" : "")
		};
	}
	/* 取消：清空整个待确认队列（存档未改动） */
	function mbCEPreviewCancel() {
		var had = mbCEPendingQueue.length;
		mbCEPendingQueue = [];
		mbCEPendingPreview = null;
		mbCEPreviewHide();
		return { ok: had > 0, message: had > 0 ? ("已取消 " + had + " 笔待确认写入（存档未改动）") : "没有待确认的写入" };
	}
	function mbCEPreviewHide() {
		try {
			var b = document.getElementById(mbCEPreviewBarId);
			if (b && b.parentNode) { b.parentNode.removeChild(b); }
		} catch (e) {}
	}
	/* 确认/撤销后按「当前活动页签」重渲染（D5：原先只 renderModCheats，在角色/地点/全局页确认完看不到变化） */
	function mbCEPaneRefresh() {
		var name = "";
		try {
			var pane = root && root.querySelector(".mce-pane.mce-active");
			name = pane ? (pane.getAttribute("data-pane") || "") : "";
			if (name === "mods") { renderModCheats(); }
			else if (name === "global") { renderGlobal(); }
			else if (name === "places") { renderPlaces(); }
			else if (name === "stage") { renderStagePane(); }
			else if (name === "scenes") { renderScenes(); }
			else if (name === "char") { renderCards(); }
			else if (name === "yanling") { renderYanling(); }
			else { renderModCheats(); }
		} catch (e) {}
		return name;
	}
	/* 面板底部确认条（sticky 贴底，挂在当前活动 pane 内）：确认队首 / 全部确认 / 取消全部 */
	function mbCEPreviewShow() {
		try {
			mbCEPreviewHide();
			if (!mbCEPendingQueue.length || !root) { return; }
			var p = mbCEPendingQueue[0];
			var n = mbCEPendingQueue.length;
			var host = root.querySelector(".mce-pane.mce-active") || root;
			var bar = el("div", "mce-preview-bar");
			bar.id = mbCEPreviewBarId;
			var lbl = el("span", "mce-preview-lbl",
				"待确认" + (n > 1 ? "（共 " + n + " 项，下方为第 1 项）" : "") + "：" +
				mbCEPreviewLabel(p.path) + "　" + mbCEPreviewFmt(p.before) + " → " + mbCEPreviewFmt(p.after));
			lbl.title = "varPath：" + p.path + "\n旧值：" + mbCEPreviewFmt(p.before) + "\n新值：" + mbCEPreviewFmt(p.after) +
				(n > 1 ? "\n队列：" + mbCEPendingQueue.map(function (x) { return x.path; }).join(" ｜ ") : "");
			bar.appendChild(lbl);
			var okBtn = el("button", "mce-btn mce-gold", "确认写入");
			okBtn.type = "button";
			okBtn.title = "确认后按此 diff 落档（同时保留回退留痕）";
			okBtn.addEventListener("click", function () {
				var r = mbCEPreviewConfirm();
				setStatus(r && r.message ? r.message : "已写入", (r && r.ok) ? MCE_CLS.ok : MCE_CLS.err);
				mbCEPaneRefresh();
			});
			bar.appendChild(okBtn);
			if (n > 1) {
				var allBtn = el("button", "mce-btn mce-gold", "全部确认（" + n + "）");
				allBtn.type = "button";
				allBtn.title = "按队列顺序一次性落档全部待确认写入（每一项仍各自留痕、可单独回退）";
				allBtn.addEventListener("click", function () {
					var r = mbCEPreviewConfirmAll();
					setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
					mbCEPaneRefresh();
				});
				bar.appendChild(allBtn);
			}
			var cancelBtn = el("button", MCE_CLS.btn, n > 1 ? "全部取消" : "取消");
			cancelBtn.type = "button";
			cancelBtn.addEventListener("click", function () {
				var r = mbCEPreviewCancel();
				setStatus(r.message, MCE_CLS.ok);
			});
			bar.appendChild(cancelBtn);
			host.appendChild(bar);
		} catch (e) {}
	}
