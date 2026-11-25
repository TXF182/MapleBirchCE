/* 职责：统一回退中心的单条回退分发器（08c-undo-center 的处理器段）。
   v2.2.4 结构治理：拆分自 08c-undo-center.js 的 mbCEUndoOne（原圈复杂度 102 / 130 行，一处承担
   12 类留痕的分发）。现按留痕 type 拆成独立处理器（签名按需取 key / rec / V，统一返回结果对象），
   由 mbCEUndoOne 只做「取留痕 → 审阅拦截（mbCEUndoBlocked）→ 查处理器 → 异常兜底」四件事。
   vcore 家族（vcore / vcore-econ / vcore-bird / vcore-leighton）经 mbCEUndoIsVcoreType 统一归到 vcore 处理器。 */

/* 锁定路径的中文显示名（07f-lock 提供 mbCELockLabel；缺失时退回原始路径） */
function mbCEUndoLockName(path) {
	return (typeof mbCELockLabel === "function") ? mbCELockLabel(path) : path;
}
/* 该路径当前是否处于锁定（只读查询，异常一律按未锁定处理） */
function mbCEUndoLockPresent(path) {
	try {
		if (path && typeof mbCELockHas === "function") { return !!mbCELockHas(path); }
	} catch (e) { /* 查询失败按未锁定，回退继续（锁定可能在 tick 之间已自行消失） */ }
	return false;
}
/* 解除锁定：未锁定视为已解除；已锁定则调用 remove 并取 ok */
function mbCEUndoLockRelease(path, hadLock) {
	if (!hadLock) { return true; }
	try {
		if (typeof mbCELockRemove === "function") {
			var lr = /** @type {any} */ (mbCELockRemove(path));
			return !!(lr && lr.ok);
		}
	} catch (e) { /* 解除异常按未解除，返回 false 让上层提示「仍锁着」 */ }
	return false;
}
/* 还原 before 快照；before 缺省视为无需还原（仍算成功） */
function mbCEUndoRestoreBefore(V, path, before) {
	if (before === undefined) { return true; }
	try { setPathVal(V, path, before); return true; } catch (e) { return false; }
}
/* 删留痕（失败静默：留痕残留最多让玩家再点一次，不影响「值已还原」的事实） */
function mbCEUndoDropRecord(V, key) {
	try { delete V.mbCE_wrote[key]; } catch (e) { /* 留痕删除失败静默 */ }
}

/* cheat：作弊项写入。P2（玩家图 7「回退无效且仍显示已锁定」）：留痕里就带 rec.path，
   回退必须连带解除该路径的锁定 —— 否则 07f-lock 的 1s tick 立刻把值写回，
   留痕没了、值还锁着，玩家再点回退只会看到「没有留痕」。分组回退 / 全部回退都走本函数，同口生效。 */
function mbCEUndoCheat(key, rec) {
	var parts = mbCEUndoCheatKeyParts(key);
	var r1 = /** @type {any} */ (undoCheatModValue(parts.modId, parts.itemKey));
	var lockPath = String(rec.path || "");
	var lockedNow = mbCEUndoLockPresent(lockPath);
	var lockOff = mbCEUndoLockRelease(lockPath, lockedNow);
	return mbCEUndoCheatResult(r1, lockPath, lockedNow, lockOff);
}

/* 作弊留痕 key 拆段：cheat:<modId>:<itemKey>（无冒号时整段即 modId、itemKey 空） */
function mbCEUndoCheatKeyParts(key) {
	var rest = key.indexOf("cheat:") === 0 ? key.slice(6) : key;
	var sep = rest.indexOf(":");
	if (sep === -1) { return { modId: rest, itemKey: "" }; }
	return { modId: rest.slice(0, sep), itemKey: rest.slice(sep + 1) };
}

/* 作弊回退结果：成功时若同步解除锁定给出提示；仍锁着则明确警告 1s tick 会写回 */
function mbCEUndoCheatResult(r1, lockPath, lockedNow, lockOff) {
	var ok = !!(r1 && r1.ok);
	var baseMsg = /** @type {any} */ (r1 && (r1.message || r1.msg)) || "作弊项回退失败";
	if (ok && lockOff) {
		return { ok: true, msg: "已回退 " + mbCEUndoLockName(lockPath) + "，并已同步解除锁定", unlocked: true, locked: lockedNow };
	}
	if (ok && lockedNow && !lockOff) {
		return { ok: true, msg: baseMsg + "（注意：该路径仍在锁定，值会被 1 秒写回，请到「全局 → 数值固定」手动取消）", unlocked: false, locked: true };
	}
	return { ok: ok, msg: baseMsg, unlocked: lockOff, locked: lockedNow };
}

/* part：外观隐藏（转化部件）整表回退 */
function mbCEUndoPart(key) {
	var r6 = /** @type {any} */ (mbCEHideUndo(key));
	return { ok: !!(r6 && r6.ok), msg: (r6 && r6.msg) || "外观回退失败" };
}

/* lock：锁定写回留痕（P4 / v2.0.7）。顺序必须是「先解除锁定、再还原原值」——
   反过来的话 07f-lock 下一秒 tick 又会把值写回目标，玩家以为回退没生效。
   还原异常时保留留痕，玩家可以再点一次重试；只有真还原成功才删记录。 */
function mbCEUndoLock(key, rec, V) {
	var lp = String(rec.path || key.replace(/^lock:/, ""));
	var hadLock = mbCEUndoLockPresent(lp);
	var offOk = mbCEUndoLockRelease(lp, hadLock);
	var restored = mbCEUndoRestoreBefore(V, lp, rec.before);
	if (restored) { mbCEUndoDropRecord(V, key); }
	var head = hadLock ? (offOk ? "已取消锁定 " : "已还原原值，但锁定未能解除 ") : "锁定已不在，仅还原 ";
	return {
		ok: restored && (!hadLock || offOk),
		msg: head + mbCEUndoLockName(lp) + (rec.before !== undefined ? " = " + String(rec.before) : "") + (restored ? "" : "（还原异常，见状态栏）")
	};
}

/* world：世界入口解锁（key 形如 world:<gid>:...，gid 取首个冒号前段） */
function mbCEUndoWorld(key) {
	var gid = key.indexOf("world:") === 0 ? key.slice(6) : key;
	var sepW = gid.indexOf(":");
	if (sepW !== -1) { gid = gid.slice(0, sepW); }
	var r2 = /** @type {any} */ (mbCEWorldUndo(gid));
	return { ok: !!(r2 && r2.ok), msg: (r2 && (r2.message || r2.msg)) || "世界入口回退失败" };
}

/* maint：庄园维护写入 */
function mbCEUndoMaint(key, rec) {
	var r3 = mbCEMaintUndo(rec.path || key.replace(/^maint:/, ""));
	return { ok: !!(r3 && r3.ok), msg: (r3 && r3.msg) || "维护写入回退失败" };
}

/* place：地点阶段任务 */
function mbCEUndoPlace(key, rec) {
	var r4 = /** @type {any} */ (placeStageUndo(rec.path || key.replace(/^place:/, "")));
	return { ok: !!(r4 && r4.ok), msg: (r4 && (r4.message || r4.msg)) || "地点阶段回退失败" };
}

/* native：恋爱（恋人卡槽）*/
function mbCEUndoNative(key) {
	var nm = key.replace(/^romance:native:/, "");
	var okN = undoRomanceStage(nm, { native: true });
	return { ok: !!okN, msg: okN ? "已从恋人卡槽移除「" + nm + "」" : "回退未生效（恋爱状态可能已被原版改写）" };
}

/* vanilla：原版恋爱阶段（rec.key / rec.npc 优先，缺省从 key 反推） */
function mbCEUndoVanilla(key, rec) {
	var vk = rec.key || key.replace(/^vanilla:/, "");
	var r5 = /** @type {any} */ (undoVanillaStage(rec.npc || "Gwylan", vk));
	return { ok: !!(r5 && r5.ok), msg: (r5 && (r5.message || r5.msg)) || "原版阶段回退失败" };
}

/* vcore：v2.0.9 需求②③④：原版档案 / 收藏 / 头衔三项整块写入（07l-vanilla-ext.js）
   id in {crime, antique, title}；before 为「首次写入前」整块快照，由 mbCEVanillaExtUndo 按 kind 还原 */
function mbCEUndoVcore(key, rec) {
	var vid = String(rec.id || key.replace(/^vcore:/, ""));
	var rv = /** @type {any} */ (mbCEVanillaExtUndo(vid));
	return { ok: !!(rv && rv.ok), msg: (rv && (rv.message || rv.msg)) || "原版档案回退失败" };
}

/* set：框架恋爱条件·置位（留痕里已存 path，直接删键还原「未设置」） */
function mbCEUndoSet(key, rec, V) {
	if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
	try { delete V[rec.path]; } catch (e) { V[rec.path] = undefined; }
	mbCEUndoDropRecord(V, key);
	return { ok: true, msg: "已撤销置位（" + rec.path + "）" };
}

/* clear：框架恋爱条件·清零（原值恒为 1） */
function mbCEUndoClear(key, rec, V) {
	if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
	V[rec.path] = 1;
	mbCEUndoDropRecord(V, key);
	return { ok: true, msg: "已恢复原值 1（" + rec.path + "）" };
}

/* append：框架恋爱条件·追加（从数组/对象集合里移除 rec.value） */
function mbCEUndoAppend(key, rec, V) {
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
	mbCEUndoDropRecord(V, key);
	return { ok: true, msg: "已从 " + rec.path + " 移除「" + rec.value + "」" };
}

/* 类型 → 处理器注册表（函数声明已提升，段内求值即可用） */
var MCE_UNDO_HANDLERS = {
	cheat: mbCEUndoCheat,
	part: mbCEUndoPart,
	lock: mbCEUndoLock,
	world: mbCEUndoWorld,
	maint: mbCEUndoMaint,
	place: mbCEUndoPlace,
	native: mbCEUndoNative,
	vanilla: mbCEUndoVanilla,
	set: mbCEUndoSet,
	clear: mbCEUndoClear,
	append: mbCEUndoAppend
};

/* 单条回退：key 形如 <ns>:<...>，按 rec.type 分发到既有实现 */
function mbCEUndoOne(key) {
	try {
		var V = getV();
		if (!V || !V.mbCE_wrote || !V.mbCE_wrote[key]) { return { ok: false, msg: "该留痕已不存在（可能已回退或超出保留窗口）" }; }
		var rec = V.mbCE_wrote[key];
		var type = String(rec.type || "");
		var blocked = mbCEUndoBlocked(type);
		if (blocked) { return { ok: false, msg: blocked }; }
		var h = mbCEUndoIsVcoreType(type) ? mbCEUndoVcore : MCE_UNDO_HANDLERS[type];
		if (!h) { return { ok: false, msg: "未知留痕类型：" + (type || "(空)") }; }
		return h(key, rec, V);
	} catch (e) {
		return { ok: false, msg: "回退异常：" + mbCEErr(e) };
	}
}
