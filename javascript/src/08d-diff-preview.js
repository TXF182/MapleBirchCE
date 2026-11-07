/* 职责：写入前 diff 预览（v2.0.3 P4-2）——面板写入执行前先给出「键 / 旧值 → 新值」，
   玩家点「确认写入」才真正落档。默认关闭（与旧行为完全一致），开关在「全局」页 统一回退中心 上方。
   实现要点：
   - 门控收口在执行器 cheatWriteValue（04b-modcheat-write.js），所有作弊项/数值/任务/阶段写入自动覆盖；
   - 待确认记录只存内存（含重放闭包），刷新页面即失效——避免把函数塞进存档；
   - 确认后置 mbCEPreviewReplay=true 重放一次，避免二次触发门控。 */

	var mbCEPendingPreview = null;
	var mbCEPreviewReplay = false;
	var mbCEPreviewBarId = "mce-preview-bar";

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
	/* 返回 true = 本次被拦下（已挂起待确认），false = 放行 */
	function mbCEPreviewGate(path, beforeVal, afterVal, run) {
		if (mbCEPreviewReplay || !mbCEPreviewEnabled()) { return false; }
		if (beforeVal === afterVal) { return false; }
		mbCEPendingPreview = { path: path, before: beforeVal, after: afterVal, run: run, t: Date.now() };
		mbCEPreviewShow();
		return true;
	}
	function mbCEPreviewConfirm() {
		var p = mbCEPendingPreview;
		if (!p || typeof p.run !== "function") { mbCEPreviewHide(); mbCEPendingPreview = null; return { ok: false, message: "没有待确认的写入" }; }
		mbCEPendingPreview = null;
		mbCEPreviewReplay = true;
		try { return p.run(); } finally { mbCEPreviewReplay = false; mbCEPreviewHide(); }
	}
	function mbCEPreviewCancel() {
		var had = !!mbCEPendingPreview;
		mbCEPendingPreview = null;
		mbCEPreviewHide();
		return { ok: had, message: had ? "已取消本次写入（存档未改动）" : "没有待确认的写入" };
	}
	function mbCEPreviewHide() {
		try {
			var b = document.getElementById(mbCEPreviewBarId);
			if (b && b.parentNode) { b.parentNode.removeChild(b); }
		} catch (e) {}
	}
	/* 面板底部确认条：点「确认写入」重放，点「取消」丢弃（存档不动） */
	function mbCEPreviewShow() {
		try {
			mbCEPreviewHide();
			var p = mbCEPendingPreview;
			if (!p || !root) { return; }
			var bar = el("div", "mce-preview-bar");
			bar.id = mbCEPreviewBarId;
			bar.appendChild(el("span", "mce-preview-lbl",
				"待确认写入：" + p.path + "　" + mbCEPreviewFmt(p.before) + " → " + mbCEPreviewFmt(p.after)));
			var okBtn = el("button", "mce-btn mce-gold", "确认写入");
			okBtn.type = "button";
			okBtn.title = "确认后按此 diff 落档（同时保留回退留痕）";
			okBtn.addEventListener("click", function () {
				var r = mbCEPreviewConfirm();
				setStatus(r && r.message ? r.message : "已写入", (r && r.ok) ? "mce-ok" : "mce-err");
				try { renderModCheats(); } catch (e) {}
			});
			var cancelBtn = el("button", "mce-btn", "取消");
			cancelBtn.type = "button";
			cancelBtn.addEventListener("click", function () {
				var r = mbCEPreviewCancel();
				setStatus(r.message, "mce-ok");
			});
			bar.appendChild(okBtn);
			bar.appendChild(cancelBtn);
			root.appendChild(bar);
		} catch (e) {}
	}
