/* 职责：统一回退中心（v2.0.3 P4-1）——把散落各处的回退入口收敛为「全局」页一个区块。
   数据源唯一：存档内 V.mbCE_wrote 留痕。类型覆盖 cheat / world / maint / place / native / vanilla /
   set / clear / append / state / batch / yanling / part / vcore / lock；回退业务逻辑复用既有实现（undoCheatModValue /
   mbCEWorldUndo / mbCEMaintUndo / placeStageUndo / undoRomanceStage / undoVanillaStage），本文件只做
   归一化分发与展示。不可逐条回退的类型（batch 审计 / yanling 页内撤销 / state 关系状态）显式禁用按钮并说明原因。 */

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
		lock: "数值锁定写回"
	};
	function mbCEUndoLabel(type) {
		if (!type) { return "未知类型"; }
		return MCE_UNDO_LABELS[type] || String(type);
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
	/* 单条回退：key 形如 <ns>:<...>，按 rec.type 分发到既有实现 */
	function mbCEUndoOne(key) {
		try {
			var V = getV();
			if (!V || !V.mbCE_wrote || !V.mbCE_wrote[key]) { return { ok: false, msg: "该留痕已不存在（可能已回退或超出保留窗口）" }; }
			var rec = V.mbCE_wrote[key];
			var type = String(rec.type || "");
			var blocked = mbCEUndoBlocked(type);
			if (blocked) { return { ok: false, msg: blocked }; }
			if (type === "cheat") {
				var rest = key.indexOf("cheat:") === 0 ? key.slice(6) : key;
				var sep = rest.indexOf(":");
				var modId = sep === -1 ? rest : rest.slice(0, sep);
				var itemKey = sep === -1 ? "" : rest.slice(sep + 1);
				var r1 = /** @type {any} */ (undoCheatModValue(modId, itemKey));
				/* P2（玩家图 7「回退无效且仍显示已锁定」）：留痕里就带 rec.path，
				   回退必须**连带解除该路径的锁定** —— 否则 07f-lock 的 1s tick 立刻把值写回，
				   留痕没了、值还锁着，玩家再点回退只会看到「没有留痕」。分组回退 / 全部回退都走本函数，同口生效。 */
				var lockPath = String(rec.path || "");
				var lockOff = false;
				var lockedNow = false;
				try {
					if (lockPath && typeof mbCELockHas === "function") { lockedNow = !!mbCELockHas(lockPath); }
					if (lockedNow && typeof mbCELockRemove === "function") {
						var lr = /** @type {any} */ (mbCELockRemove(lockPath));
						lockOff = !!(lr && lr.ok);
					}
				} catch (eLock) { lockOff = false; }
				var baseMsg = /** @type {any} */ (r1 && (r1.message || r1.msg)) || "作弊项回退失败";
				if (r1 && r1.ok && lockOff) {
					var lockName = (typeof mbCELockLabel === "function") ? mbCELockLabel(lockPath) : lockPath;
					baseMsg = "已回退 " + lockName + "，并已同步解除锁定";
				} else if (r1 && r1.ok && lockedNow && !lockOff) {
					baseMsg = baseMsg + "（注意：该路径仍在锁定，值会被 1 秒写回，请到「全局 → 数值固定」手动取消）";
				}
				return { ok: !!(r1 && r1.ok), msg: baseMsg, unlocked: lockOff, locked: lockedNow };
			}
			if (type === "part") {
				var r6 = /** @type {any} */ (mbCEHideUndo(key));
				return { ok: !!(r6 && r6.ok), msg: (r6 && r6.msg) || "外观回退失败" };
			}
			/* P4（v2.0.7）：锁定写回留痕。顺序必须是「先解除锁定、再还原原值」——
			   反过来的话 07f-lock 下一秒 tick 又会把值写回目标，玩家以为回退没生效。 */
			if (type === "lock") {
				var lp = String(rec.path || key.replace(/^lock:/, ""));
				var hadLock = false;
				try { if (typeof mbCELockHas === "function") { hadLock = !!mbCELockHas(lp); } } catch (eL0) {}
				var offOk = !hadLock;
				if (hadLock && typeof mbCELockRemove === "function") {
					var lr3 = /** @type {any} */ (mbCELockRemove(lp));
					offOk = !!(lr3 && lr3.ok);
				}
				var restored = true;
				if (rec.before !== undefined) {
					try { setPathVal(V, lp, rec.before); } catch (eL1) { restored = false; }
				}
				/* 还原异常时保留留痕，玩家可以再点一次重试；只有真还原成功才删记录 */
				if (restored) { try { delete V.mbCE_wrote[key]; } catch (eL2) {} }
				var lName = (typeof mbCELockLabel === "function") ? mbCELockLabel(lp) : lp;
				var head = hadLock ? (offOk ? "已取消锁定 " : "已还原原值，但锁定未能解除 ") : "锁定已不在，仅还原 ";
				return {
					ok: restored && (!hadLock || offOk),
					msg: head + lName + (rec.before !== undefined ? " = " + String(rec.before) : "") + (restored ? "" : "（还原异常，见状态栏）")
				};
			}
			if (type === "world") {
				var gid = key.indexOf("world:") === 0 ? key.slice(6) : key;
				var sepW = gid.indexOf(":");
				if (sepW !== -1) { gid = gid.slice(0, sepW); }
				var r2 = /** @type {any} */ (mbCEWorldUndo(gid));
				return { ok: !!(r2 && r2.ok), msg: (r2 && (r2.message || r2.msg)) || "世界入口回退失败" };
			}
			if (type === "maint") {
				var r3 = mbCEMaintUndo(rec.path || key.replace(/^maint:/, ""));
				return { ok: !!(r3 && r3.ok), msg: (r3 && r3.msg) || "维护写入回退失败" };
			}
			if (type === "place") {
				var r4 = /** @type {any} */ (placeStageUndo(rec.path || key.replace(/^place:/, "")));
				return { ok: !!(r4 && r4.ok), msg: (r4 && (r4.message || r4.msg)) || "地点阶段回退失败" };
			}
			if (type === "native") {
				var nm = key.replace(/^romance:native:/, "");
				var okN = undoRomanceStage(nm, { native: true });
				return { ok: !!okN, msg: okN ? "已从恋人卡槽移除「" + nm + "」" : "回退未生效（恋爱状态可能已被原版改写）" };
			}
			if (type === "vanilla") {
				var vk = rec.key || key.replace(/^vanilla:/, "");
				var r5 = /** @type {any} */ (undoVanillaStage(rec.npc || "Gwylan", vk));
				return { ok: !!(r5 && r5.ok), msg: (r5 && (r5.message || r5.msg)) || "原版阶段回退失败" };
			}
			/* v2.0.9 需求②③④：原版档案 / 收藏 / 头衔三项整块写入（07l-vanilla-ext.js）
			   id in {crime, antique, title}；before 为「首次写入前」整块快照，由 mbCEVanillaExtUndo 按 kind 还原 */
			if (type === "vcore") {
				var vid = String(rec.id || key.replace(/^vcore:/, ""));
				var rv = /** @type {any} */ (mbCEVanillaExtUndo(vid));
				return { ok: !!(rv && rv.ok), msg: (rv && (rv.message || rv.msg)) || "原版档案回退失败" };
			}
			/* 框架恋爱条件三类：留痕里已存 path / value，可直接还原（与 undoRomanceStage 同口径） */
			if (type === "set") {
				if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
				try { delete V[rec.path]; } catch (e) { V[rec.path] = undefined; }
				try { delete V.mbCE_wrote[key]; } catch (e) {}
				return { ok: true, msg: "已撤销置位（" + rec.path + "）" };
			}
			if (type === "clear") {
				if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
				V[rec.path] = 1;
				try { delete V.mbCE_wrote[key]; } catch (e) {}
				return { ok: true, msg: "已恢复原值 1（" + rec.path + "）" };
			}
			if (type === "append") {
				if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
				var arr = V[rec.path];
				var changed = false;
				if (Array.isArray(arr)) {
					var idx = arr.indexOf(rec.value);
					if (idx !== -1) { arr.splice(idx, 1); changed = true; }
				} else if (arr && typeof arr === "object") {
					Object.keys(arr).forEach(function (k) {
						if (arr[k] === rec.value) { delete arr[k]; changed = true; }
					});
				}
				if (!changed) { return { ok: false, msg: "目标集合里已找不到「" + rec.value + "」，可能已被原版改写" }; }
				try { delete V.mbCE_wrote[key]; } catch (e) {}
				return { ok: true, msg: "已从 " + rec.path + " 移除「" + rec.value + "」" };
			}
			return { ok: false, msg: "未知留痕类型：" + (type || "(空)") };
		} catch (e) {
			return { ok: false, msg: "回退异常：" + mbCEErr(e) };
		}
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
	/* 全局页区块渲染（renderGlobal 末尾调用，pane = [data-pane="global"]） */
	function mbCEUndoCenterRender(pane) {
		if (!pane) { return; }
		var sec = mceNewSec(pane, 0, "统一回退中心（v2.0.3）",
			"全部面板写入的留痕都在这里，一条一处：单条回退 / 按类型分组回退 / 全部回退。" +
			"回退只还原「面板写入前」的状态，玩家真实进度（原版达成的恋爱阶段、关系状态）一律不动；" +
			"批量操作与言灵改写只保留审计记录，需在对应页面撤销。");
		var list = mbCEUndoList();
		var undoable = list.filter(function (it) { return !mbCEUndoBlocked(it.type); }).length;
		/* v2.0.3 P4-2：写入前 diff 预览开关（门控在 04b 执行器，见 08d-diff-preview.js） */
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
		sec.appendChild(el("div", MCE_CLS.hint, "当前留痕 " + list.length + " 条，其中可回退 " + undoable + " 条。留痕上限 400 条，超出按时间升序删最旧一半（旧操作的回退窗口随之关闭）。"));
		if (!list.length) {
			sec.appendChild(el("div", MCE_CLS.hint, "暂无写入留痕：面板还没有写过任何东西，或已全部回退。"));
			return;
		}
		/* 按类型分组（组内按时间倒序，组按条数降序） */
		var groups = {};
		list.forEach(function (it) {
			var t = it.type || "(空)";
			if (!groups[t]) { groups[t] = []; }
			groups[t].push(it);
		});
		var order = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
		order.forEach(function (type) {
			var items = groups[type];
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
			items.slice(0, 24).forEach(function (it) {
				var row = el("div", MCE_CLS.row);
				/* 展示中文名（08e-undo-labels 解析），原始键留在 label 的 tooltip 里便于排障 */
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
			});
			if (items.length > 24) {
				body.appendChild(el("div", MCE_CLS.hint, "（本组共 " + items.length + " 条，仅列出最近 24 条；「回退本组」会处理全部）"));
			}
		});
	}
