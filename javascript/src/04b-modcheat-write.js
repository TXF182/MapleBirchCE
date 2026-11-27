/* 职责：作弊写入执行器 —— 原版根拦截、适配器路径解析、按类型写入与回退（applyCheatSync） */

	function cheatIsVanillaRoot(root) {
		var i;
		for (i = 0; i < CHEAT_VANILLA_ROOTS.length; i++) {
			if (CHEAT_VANILLA_ROOTS[i] === root) { return true; }
		}
		return false;
	}
	/* v1.9.11 未定版：适配器声明路径豁免——第三方模组会借用原版变量宿主存自己的键
	   （实证：Dol-Optimization 源码 `<<set $daily.conveniencestoregoods to {}>>` 把便利店库存写进原版 $daily，
	   opt1121/Source/twee/game.twee:321），凡在已注册适配器 stages/abilities/values 声明中的 varPath
	   一律放行（声明经对照源码核对），未声明的原版根仍按黑名单拒绝（玩家自己面板等通道不受影响）。 */
	var mbCEAdapterPaths = null;
	function mbCEBuildAdapterPaths() {
		var out = {}, mid, e, sec, arr, i, it;
		try {
			for (mid in CHEAT_ADAPTERS) {
				if (!Object.prototype.hasOwnProperty.call(CHEAT_ADAPTERS, mid)) { continue; }
				e = CHEAT_ADAPTERS[mid] && CHEAT_ADAPTERS[mid].entry;
				if (!e) { continue; }
				for (sec = 0; sec < 3; sec++) {
					arr = sec === 0 ? e.stages : (sec === 1 ? e.abilities : e.values);
					if (!Array.isArray(arr)) { continue; }
					for (i = 0; i < arr.length; i++) {
						it = arr[i];
						if (it && typeof it.varPath === "string" && it.varPath) { out[it.varPath] = true; }
					}
				}
			}
		} catch (e2) { /* 豁免集合构建失败 → 保守全部拒绝 */ }
		return out;
	}
	function mbCEIsDeclaredAdapterPath(path) {
		if (!mbCEAdapterPaths) { mbCEAdapterPaths = mbCEBuildAdapterPaths(); }
		return !!(path && mbCEAdapterPaths[path]);
	}
	/* varPath 解析：父级对象链必须存在（禁止写入 undefined 对象）；叶子允许缺失（正常初始化）。 */
	/** @returns {{ok: false, reason: string, root?: string, path?: string} | {ok: true, parent: any, leaf: string, exists: boolean}} */
	function cheatResolvePath(path) {
		var V = getV();
		if (!V) { return { ok: false, reason: "存档变量不可用" }; }
		var parts = String(path || "").split(".");
		if (!parts.length || !parts[0]) { return { ok: false, reason: "空路径" }; }
		if (cheatIsVanillaRoot(parts[0]) && !mbCEIsDeclaredAdapterPath(path)) { return { ok: false, reason: "vanilla", root: parts[0] }; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") {
				return { ok: false, reason: "parent", path: parts.slice(0, i + 1).join(".") };
			}
			cur = cur[parts[i]];
		}
		return { ok: true, parent: cur, leaf: parts[parts.length - 1], exists: cur[parts[parts.length - 1]] !== undefined };
	}
	/* 联动写入（v1.9.6 扩展）：条目可声明 sync 字段，主键写入成功后按序执行联动，
	   保持模组状态机一致（如写 dress.active 时同步清 proposal / 升 highest / 清试行期）。
	   v2.2.2 联动留痕：每改一个联动键先把「本次写入前的值」记进 log（同路径去重取首次——
	     电脑应用「先 clear 置 null 再 set true」只能记原值，不能记成 null），
	     由 cheatWriteValue 挂到主留痕 sync 字段，undo 逆序还原。
	     修的是：主键回退原来只还原单键，联动清掉的原数据（校园着装 proposal、一键装应用前的应用）
	     会被永久留成 null / 抬高值，玩家状态机半截。
	   联动失败不影响主写入结果。
	   v1.9.10 自查扩展：s.ifMissing = true 时仅在目标键不存在（undefined）才写入，
	   防覆盖玩家已有数据（如 Cattery 养猫联动补 catArr，已有猫不重置）。 */
	function applyCheatSync(V, syncData, newVal, log) {
		log = log || [];
		try {
			if (!syncData || typeof syncData !== "object") { return log; }
			var snap = function (p, r) {
				if (r.ok !== true) { return; }
				for (var i = 0; i < log.length; i++) { if (log[i].path === p) { return; } }
				log.push({ path: p, had: Object.prototype.hasOwnProperty.call(r.parent, r.leaf), before: r.parent[r.leaf] });
			};
			if (Array.isArray(syncData.clear)) {
				syncData.clear.forEach(function (p) {
					var r = cheatResolvePath(p);
					if (r.ok) { snap(p, r); r.parent[r.leaf] = null; }
				});
			}
			if (Array.isArray(syncData.set)) {
				syncData.set.forEach(function (s) {
					var r = cheatResolvePath(s.path);
					/* v1.9.9 sync.set 条件扩展：s.if = { min / max } 按「主写入后的新值」判定，
					   不满足则跳过该联动（如写 shrine.stage=0 重置时不补 feeds/init）。无 if 字段=无条件，兼容旧声明。
					   v1.9.10：s.ifMissing 时目标已存在（r.exists）则跳过，防覆盖玩家数据。 */
					if (r.ok && !(s.ifMissing && r.exists) && (!s.if || ((typeof s.if.min !== "number" || newVal >= s.if.min) && (typeof s.if.max !== "number" || newVal <= s.if.max)))) {
						snap(s.path, r);
						r.parent[r.leaf] = typeof s.value === "function" ? s.value(V) : s.value;
					}
				});
			}
			if (syncData.copyMax && syncData.copyMax.path && Array.isArray(syncData.copyMax.order)) {
				var tr = cheatResolvePath(syncData.copyMax.path);
				if (tr.ok) {
					var oi = syncData.copyMax.order.indexOf(newVal);
					var ci = syncData.copyMax.order.indexOf(tr.parent[tr.leaf]);
					if (oi >= 0 && ci < oi) { snap(syncData.copyMax.path, tr); tr.parent[tr.leaf] = syncData.copyMax.order[oi]; }
				}
			}
		} catch (e) { /* 联动失败不影响主写入 */ }
		return log;
	}
	/* 通用写入执行器（幂等防崩）：类型校验 + 保留下限 + 留痕（保留首次 before，回退可还原）。
	   v1.9.10 用户需求：数值上限不钳制——声明 max 仅作 UI 参考范围提示，写入原样落档
	   （模组自身 clamp 由其源码负责；CE 不做面板上限拦截）。下限仍钳 0 防负值破坏。 */
	function cheatWriteValue(modId, itemKey, op, path, raw, type, min, max, syncData) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			/* v2.2.8 纯净模式：总开关在「全局 → 防护」，开启时所有适配器写入在入口拒绝（不解析路径、不改值、不留痕）。
			   判定收进 mbCEPureGuard（恒返回非空对象或 null），返回类型保持「一定给对象」，否则可空会传染到
			   lurker / attitude / fert 的 res.message（TS18047）。 */
			var pureNo = (typeof mbCEPureGuard === "function") ? mbCEPureGuard("适配器写入") : null;
			if (pureNo) { return pureNo; }
			var r = cheatResolvePath(path);
			if (r.ok !== true) {
				if (r.reason === "vanilla") {
					return { ok: false, message: "目标「" + r.root + "」为 DoL 原版变量，拒绝操作（原版内容请使用对应五大面板）" };
				}
				if (r.reason === "parent") {
					return { ok: false, message: "目标变量宿主不存在（" + r.path + "），拒绝写入 undefined 对象；请先推进模组剧情初始化" };
				}
				return { ok: false, message: "目标变量路径无效（" + path + "）" };
			}
			var val = raw;
			if (type === "number") {
				/* v1.8.12 相对值：raw 为字符串且以 + / - 开头 → 按「当前值 + delta」计算（v1.9.10 起上限不钳制、下限 0） */
				var relDelta = null;
				if (typeof raw === "string") {
					var relM = /^([+\-])\s*([\d.]+)$/.exec(raw.trim());
					if (relM) { relDelta = (relM[1] === "+" ? 1 : -1) * Number(relM[2]); }
				}
				var curNum = Number(r.parent[r.leaf]);
				var baseNum = Number.isFinite(curNum) ? curNum : 0;
				val = relDelta !== null ? baseNum + relDelta : (typeof val === "number" ? val : Number(val));
				if (!isFinite(val)) { return { ok: false, message: "数值无效（需为数字，支持 +N / -N 相对调整）" }; }
				if (typeof min === "number" && val < min) { val = min; }
				/* v1.9.10：上限不再钳制（声明 max 仅参考）；写低值不受影响 */
			} else if (type === "boolean") {
				val = (val === true || val === 1 || val === "1" || val === "true" || val === "on");
			} else {
				val = String(val);
			}
			var before = r.parent[r.leaf];
			var prev = V.mbCE_wrote && V.mbCE_wrote["cheat:" + modId + ":" + itemKey];
			/* 留痕语义与地点通道一致：before 始终保留「首次面板写入前」状态（含 undefined=原本无字段），
			   用 in 判断避免二次写入把 before 覆盖成当前值、回退丢失删除语义 */
			if (prev && "before" in prev) { before = prev.before; }
			/* v2.0.3 P4-2：写入前 diff 预览（默认关闭；开启时本函数不落档，改由确认条重放） */
			var curNow = r.parent[r.leaf];
			if (typeof mbCEPreviewGate === "function" && mbCEPreviewGate(path, curNow, val, function () {
				return cheatWriteValue(modId, itemKey, op, path, raw, type, min, max, syncData);
			})) {
				return { ok: false, pending: true, message: "待确认写入：" + path + "（" + mbCEPreviewFmt(curNow) + " → " + mbCEPreviewFmt(val) + "）" };
			}
			r.parent[r.leaf] = val;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var recKey = "cheat:" + modId + ":" + itemKey;
			V.mbCE_wrote[recKey] = { type: "cheat", modId: modId, op: op, path: path, before: before, after: val, t: Date.now() };
			/* v2.2.2：联动键快照并入同一条留痕，undo 才能连带还原；二次写入沿用首次 sync（与 before 同语义） */
			var syncLog = (prev && Array.isArray(prev.sync)) ? prev.sync.slice() : [];
			applyCheatSync(V, syncData, val, syncLog); /* 联动修正（主写入成功后） */
			if (syncLog.length) { V.mbCE_wrote[recKey].sync = syncLog; }
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
			return { ok: true, message: "已写入 " + path + " = " + JSON.stringify(val), before: before, after: val };
		} catch (e) {
			return { ok: false, message: "操作异常：" + mbCEErr(e) };
		}
	}
	/* 列表型写入（v1.4.0 扩展）：varPath 指向字符串数组，on=true 追加 / on=false 移除；
	   留痕 before/after 为数组快照（before 保留首次面板写入前状态）。 */
	function cheatWriteListValue(modId, itemKey, op, path, value, on, replay) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			/* v2.2.8 纯净模式：列表写入同走总开关（勾选项也是适配器写入）；返回类型理由同上 */
			var pureNo2 = (typeof mbCEPureGuard === "function") ? mbCEPureGuard("适配器写入") : null;
			if (pureNo2) { return pureNo2; }
			var r = cheatResolvePath(path);
			if (r.ok !== true) {
				if (r.reason === "vanilla") {
					return { ok: false, message: "目标「" + r.root + "」为 DoL 原版变量，拒绝操作（原版内容请使用对应五大面板）" };
				}
				if (r.reason === "parent") {
					return { ok: false, message: "目标变量宿主不存在（" + r.path + "），拒绝写入 undefined 对象；请先推进模组剧情初始化" };
				}
				return { ok: false, message: "目标变量路径无效（" + path + "）" };
			}
			var cur = r.parent[r.leaf];
			var arr = Array.isArray(cur) ? cur.slice() : [];
			var idx = arr.indexOf(value);
			if (on && idx === -1) { arr.push(value); }
			if (!on && idx !== -1) { arr.splice(idx, 1); }
			var before = Array.isArray(cur) ? cur.slice() : undefined;
			/* v2.0.7 D1：列表写入（05a-modcheat-rows.js:75 的勾选项）原先完全绕过 diff 预览——现在同走门控 */
			if (!replay && typeof mbCEPreviewGate === "function" &&
				mbCEPreviewGate(path, Array.isArray(cur) ? cur.slice() : "（无此字段）", arr,
					function () { return cheatWriteListValue(modId, itemKey, op, path, value, on, true); })) {
				return { ok: false, pending: true, message: "待确认写入：" + path };
			}
			var prev = V.mbCE_wrote && V.mbCE_wrote["cheat:" + modId + ":" + itemKey];
			if (prev && "before" in prev) { before = prev.before; }
			r.parent[r.leaf] = arr;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:" + modId + ":" + itemKey] = { type: "cheat", modId: modId, op: op, path: path, before: before, after: arr.slice(), t: Date.now() };
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
			return { ok: true, message: "已更新 " + path + (on ? " ＋ " : " － ") + value, after: arr.slice() };
		} catch (e) {
			return { ok: false, message: "操作异常：" + mbCEErr(e) };
		}
	}
	/* 回退：还原 before（首次面板写入前状态）；无痕迹 / 结构已变化 → 拒绝。
	   v2.2.2：连同 sync 快照逆序还原联动键（后写的先撤），无法解析的跳过并点名；旧留痕无 sync 时行为不变。 */
	function undoCheatModValue(modId, itemKey) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return { ok: false, message: "无面板写入痕迹" }; }
			var key = "cheat:" + modId + ":" + itemKey;
			var rec = V.mbCE_wrote[key];
			if (!rec || rec.type !== "cheat") { return { ok: false, message: "该操作非面板写入（或已回退），无可撤销痕迹" }; }
			var r = cheatResolvePath(rec.path);
			if (r.ok !== true) { return { ok: false, message: "目标变量结构已变化，拒绝回退（" + rec.path + "）" }; }
			var skipped = [], i, s, sr;
			if (Array.isArray(rec.sync)) {
				for (i = rec.sync.length - 1; i >= 0; i--) {
					s = rec.sync[i];
					sr = cheatResolvePath(s.path);
					if (sr.ok !== true) { skipped.push(s.path); continue; }
					if (s.had) { sr.parent[sr.leaf] = s.before; } else { try { delete sr.parent[sr.leaf]; } catch (e) { sr.parent[sr.leaf] = undefined; } }
				}
			}
			if (rec.before === undefined) {
				try { delete r.parent[r.leaf]; } catch (e) { r.parent[r.leaf] = undefined; }
			} else {
				r.parent[r.leaf] = rec.before;
			}
			try { delete V.mbCE_wrote[key]; } catch (e) { V.mbCE_wrote[key] = undefined; }
			var msg = "已回退（还原为面板写入前状态）";
			if (skipped.length) { msg += "；联动键结构已变化已跳过：" + skipped.join("、"); }
			return { ok: true, message: msg };
		} catch (e) {
			return { ok: false, message: "回退异常：" + mbCEErr(e) };
		}
	}
