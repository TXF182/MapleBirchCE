/* 职责：统一回退中心（v2.0.3 P4-1）——把散落各处的回退入口收敛为「全局」页一个区块。
   数据源唯一：存档内 V.mbCE_wrote 留痕。类型覆盖 cheat / world / maint / place / native / vanilla /
   set / clear / append / state / batch / yanling / part / vcore / lock；回退业务逻辑复用既有实现（undoCheatModValue /
   mbCEWorldUndo / mbCEMaintUndo / placeStageUndo / undoRomanceStage / undoVanillaStage），本文件只做
   归一化分发与展示。不可逐条回退的类型（batch 审计 / yanling 页内撤销 / state 关系状态）显式禁用按钮并说明原因。
   v2.2.4 结构治理：单条回退分发 mbCEUndoOne（原 102 复杂度 / 130 行）已拆到 08c-undo-center-handlers.js
   （按类型独立处理器 + 注册表）；本段保留标签/清单/批量入口，渲染侧原 mbCEUndoCenterRender（100 行深嵌套）
   按块拆成 6 个函数（预览开关行 / 操作行 / 骨架 / 分组 / 单组 / 单行）。 */

	var MCE_UNDO_LABELS = {		cheat: "作弊项写入",
		world: "世界入口解锁",
		maint: "庄园维护写入",
		place: "地点阶段任务",
		native: "恋爱（恋人卡槽）",
		vanilla: "原版恋爱阶段",
		set: "框架恋爱条件·置位",
		clear: "框架恋爱条件·清零",
		append: "框架恋爱条件·追加",
		state: "框架恋爱条件·关系状态",
		batch: "批量操作（仅审计）",
		yanling: "言灵改写（页内撤销）",
		part: "外观隐藏（转化部件）",
		vcore: "原版档案 · 收藏 · 头衔",
		"vcore-econ": "原版经济 · 学业 · 农田 · 消耗品 · 纹身",
		"vcore-bird": "原版鹰塔（大鹰塔）",
		"vcore-leighton": "原版礼顿把柄（学校）",
		lock: "数值锁定写回"
	};
	function mbCEUndoLabel(type) {
		if (!type) { return "未知类型"; }
		return MCE_UNDO_LABELS[type] || String(type);
	}
	/* vcore 家族统一走 mbCEVanillaExtUndo（回退中心只判「是不是这一族」，具体 kind 由 07l/07m/07n 各自分发） */
	function mbCEUndoIsVcoreType(type) {
		return type === "vcore" || type === "vcore-econ" || type === "vcore-bird" || type === "vcore-leighton";
	}
	/* 不可回退原因（空串 = 可回退） */
	function mbCEUndoBlocked(type) {
		if (type === "batch") { return "批量操作只记录受影响条数，无法逐条还原"; }
		if (type === "yanling") { return "言灵改写在「言灵」页对应开关处撤销"; }
		if (type === "state") { return "关系状态由原版实时判定，回退会破坏真实关系"; }
		return "";
	}
	function mbCEUndoList() {
		var out = [];
		try {
			var V = getV();
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return out; }
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				var rec = V.mbCE_wrote[k];
				if (!rec || typeof rec !== "object") { return; }
				out.push({ key: k, type: String(rec.type || ""), path: rec.path || "", t: (typeof rec.t === "number" ? rec.t : 0) });
			});
			out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
		} catch (e) {}
		return out;
	}
	/* 按类型分组回退 */
	function mbCEUndoGroup(type) {
		var list = mbCEUndoList().filter(function (it) { return it.type === type; });
		if (!list.length) { return { ok: false, n: 0, fail: 0, msg: "该分组没有留痕" }; }
		var blocked = mbCEUndoBlocked(type);
		if (blocked) { return { ok: false, n: 0, fail: list.length, msg: blocked }; }
		var ok = 0, fail = 0;
		list.forEach(function (it) {
			var r = mbCEUndoOne(it.key);
			if (r.ok) { ok++; } else { fail++; }
		});
		return { ok: ok > 0, n: ok, fail: fail, msg: "「" + mbCEUndoLabel(type) + "」已回退 " + ok + " 项" + (fail ? "，" + fail + " 项未能回退" : "") };
	}
	/* 全部可回退项（按时间倒序，最新优先） */
	function mbCEUndoAll() {
		var all = mbCEUndoList();
		if (!all.length) { return { ok: false, n: 0, fail: 0, skip: 0, msg: "没有任何面板写入留痕" }; }
		var ok = 0, fail = 0, skip = 0;
		all.forEach(function (it) {
			if (mbCEUndoBlocked(it.type)) { skip++; return; }
			var r = mbCEUndoOne(it.key);
			if (r.ok) { ok++; } else { fail++; }
		});
		return {
			ok: ok > 0, n: ok, fail: fail, skip: skip,
			msg: "已回退 " + ok + " 项" + (fail ? "，" + fail + " 项未能回退" : "") + (skip ? "，" + skip + " 项仅审计不可回退" : "")
		};
	}
	function mbCEUndoFmtTime(t) {
		if (!t) { return "—"; }
		try {
			var d = new Date(t);
			var p = function (n) { return (n < 10 ? "0" : "") + n; };
			return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		} catch (e) { return "—"; }
	}
	/* v2.0.3 P4-2：写入前 diff 预览开关行（门控在 04b 执行器，见 08d-diff-preview.js） */
	function mbCEUndoPreviewRow(sec) {
		var pvRow = el("div", MCE_CLS.row);
		var pvOn = mbCEPreviewEnabled();
		var pvBtn = el("button", MCE_CLS.btn + (pvOn ? " mce-gold" : ""), pvOn ? "写入前 diff 预览：已开启" : "写入前 diff 预览：已关闭");
		pvBtn.type = "button";
		pvBtn.title = pvOn
			? "当前每次写入都会先弹出「键 旧值 → 新值」确认条，点「确认写入」才落档；点此关闭直接写入"
			: "开启后每次写入先显示「键 旧值 → 新值」确认条，确认才落档（防手滑改错数值）";
		pvBtn.addEventListener("click", function () {
			mbCEUiState.diffPreview = pvOn ? "0" : "1";
			try { mbCEUiSave({ diffPreview: mbCEUiState.diffPreview }); } catch (e) {}
			setStatus("写入前 diff 预览已" + (pvOn ? "关闭（恢复直接写入）" : "开启（写入前先确认）"), MCE_CLS.ok);
			renderGlobal();
		});
		pvRow.appendChild(pvBtn);
		sec.appendChild(pvRow);
	}
	/* 顶部操作行：全部回退 + 刷新清单；返回可回退条数（供下方提示文案复用） */
	function mbCEUndoActionRow(sec, list) {
		var undoable = list.filter(function (it) { return !mbCEUndoBlocked(it.type); }).length;
		var top = mceBtnGrid(sec);
		var allBtn = el("button", "mce-btn mce-gold", "全部回退（" + undoable + " 项可回退）");
		allBtn.type = "button";
		allBtn.title = "按时间倒序回退所有可回退的留痕；审计类（批量 / 言灵 / 关系状态）自动跳过";
		allBtn.addEventListener("click", function () {
			var r = mbCEUndoAll();
			setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
			renderGlobal();
		});
		top.appendChild(allBtn);
		var refreshBtn = el("button", MCE_CLS.btn, "刷新清单");
		refreshBtn.type = "button";
		refreshBtn.addEventListener("click", function () {
			setStatus("留痕清单已刷新：" + mbCEUndoList().length + " 条", MCE_CLS.ok);
			renderGlobal();
		});
		top.appendChild(refreshBtn);
		return undoable;
	}
	/* 全局页区块渲染（renderGlobal 末尾调用，pane = [data-pane="global"]） */
	function mbCEUndoCenterRender(pane) {
		if (!pane) { return; }
		var sec = mceNewSec(pane, 0, "统一回退中心（v2.0.3）",
			"全部面板写入的留痕都在这里，一条一处：单条回退 / 按类型分组回退 / 全部回退。" +
			"回退只还原「面板写入前」的状态，玩家真实进度（原版达成的恋爱阶段、关系状态）一律不动；" +
			"批量操作与言灵改写只保留审计记录，需在对应页面撤销。");
		var list = mbCEUndoList();
		mbCEUndoPreviewRow(sec);
		var undoable = mbCEUndoActionRow(sec, list);
		sec.appendChild(el("div", MCE_CLS.hint, "当前留痕 " + list.length + " 条，其中可回退 " + undoable + " 条。留痕上限 400 条，超出按时间升序删最旧一半（旧操作的回退窗口随之关闭）。"));
		if (!list.length) {
			sec.appendChild(el("div", MCE_CLS.hint, "暂无写入留痕：面板还没有写过任何东西，或已全部回退。"));
			return;
		}
		mbCEUndoRenderGroups(sec, list);
	}
	/* 按类型分组（组内按时间倒序，组按条数降序） */
	function mbCEUndoRenderGroups(sec, list) {
		var groups = {};
		list.forEach(function (it) {
			var t = it.type || "(空)";
			if (!groups[t]) { groups[t] = []; }
			groups[t].push(it);
		});
		var order = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
		order.forEach(function (type) { mbCEUndoRenderOneGroup(sec, type, groups[type]); });
	}
	/* 单个类型组：仅审计提示 / 组回退按钮 / 最近 24 条明细 */
	function mbCEUndoRenderOneGroup(sec, type, items) {
		var blocked = mbCEUndoBlocked(type);
		var body = mceNewGroup(sec, mbCEUndoLabel(type), items.length + " 条" + (blocked ? " · 仅审计" : ""));
		if (blocked) {
			body.appendChild(el("div", MCE_CLS.hint, blocked));
		} else {
			if (type === "lock") {
				body.appendChild(el("div", MCE_CLS.hint, "回退 = 取消该数值的锁定 + 还原锁定前原值（只还原值不解除锁定，1 秒 tick 会立刻写回目标）。"));
			}
			var gBtn = el("button", MCE_CLS.btn, "回退本组 " + items.length + " 项");
			gBtn.type = "button";
			gBtn.addEventListener("click", function () {
				var r = mbCEUndoGroup(type);
				setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
				renderGlobal();
			});
			body.appendChild(gBtn);
		}
		items.slice(0, 24).forEach(function (it) { mbCEUndoRenderRow(body, it, blocked); });
		if (items.length > 24) {
			body.appendChild(el("div", MCE_CLS.hint, "（本组共 " + items.length + " 条，仅列出最近 24 条；「回退本组」会处理全部）"));
		}
	}
	/* 单条明细行：中文名（08e-undo-labels 解析）+ 时间 + 回退按钮；原始键留在 label 的 tooltip 里便于排障 */
	function mbCEUndoRenderRow(body, it, blocked) {
		var row = el("div", MCE_CLS.row);
		var nm = mbCEUndoItemName(it.key, it);
		var lbl = el("span", MCE_CLS.rowLbl, nm.length > 58 ? nm.slice(0, 58) + "…" : nm);
		lbl.title = it.key;
		row.appendChild(lbl);
		row.appendChild(el("span", MCE_CLS.hint, mbCEUndoFmtTime(it.t)));
		if (blocked) {
			row.appendChild(el("span", "mce-badge", "不可回退"));
		} else {
			var b = el("button", MCE_CLS.btn, "回退");
			b.type = "button";
			b.title = "还原「" + nm + "」为面板写入前状态（原始键 " + it.key + "）";
			b.addEventListener("click", function () {
				var r = mbCEUndoOne(it.key);
				setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
				renderGlobal();
			});
			row.appendChild(b);
		}
		body.appendChild(row);
	}
