/* ============================================================
 * 07j-transform-hide.js — R1/R2 转化部件「隐藏」作弊（外观层，纯原版字段）
 *
 * 原版取证（DoL 0.5.12.13 tw-passagedata，passage = "Transformation Widgets"）：
 *   1) 隐藏惩罚的唯一来源：
 *      <<if _value is "hidden" and _key isnot "traits" and !["pubes","pits","cheeks"].includes(_label)
 *            and !(_label is "wings" and _excludeWings is true)>>
 *        <<if $panicattacks gte 2>>   → 强制取消隐藏（写回 "default"，_hidingFailed）
 *        <<else>>                     → <<trauma 15>>
 *      即：每次「重新隐藏」重组时，非 traits / 非 pubes / 非 pits / 非 cheeks 的隐藏部件各 +15 创伤；
 *      panicattacks ≥ 2 时原版会直接把部件打回 "default"（隐藏失败）。
 *   2) 翅膀豁免：_excludeWings 在「鸟翼 + 任一天使/堕落天使/恶魔翼同时隐藏」时为 false，
 *      否则为 true → 此时隐藏 wings 不进惩罚分支。翅膀属独立部件，隐藏不影响其它部位判定。
 *   3) $transformationParts 为 { 物种: { 部件: "default"|"hidden"|"disabled" } }；
 *      大量原版场景用 `isnot "hidden"` 决定 NPC 是否看见/反应（Traits / Avery / History Lesson / Temple / Mirror）。
 *
 * 因此本页做三件事（全部只写原版字段，不 patch 段落）：
 *   · 隐藏内在（traits.*：尖牙/锐眼/追逐/炫耀/终身伴侣）
 *   · 隐藏翅膀（bird / angel / fallenAngel / demon 的 wings，独立开关）
 *   · 隐藏无惩罚：① 锁 $trauma = 0（复用 07f-lock 的 1s 写回，压掉 +15）
 *                 ② 强制保持隐藏：1s 校验，被原版打回 "default" 立即写回 "hidden"
 * ============================================================ */

var MB_CE_HIDE_WINGS_SPECIES = ["bird", "angel", "fallenAngel", "demon"];
var mbCEHideTimer = null;

function mbCEHideState() {
	var V = getV();
	if (!V || typeof V !== "object") { return null; }
	if (!V.mbCE_hide || typeof V.mbCE_hide !== "object") { V.mbCE_hide = {}; }
	return V.mbCE_hide;
}
/* 目标部件清单：kind = "inner"（traits 全部）| "wings"（四系翅膀） */
function mbCEHideTargets(parts, kind) {
	var out = [];
	if (!parts || typeof parts !== "object") { return out; }
	if (kind === "wings") {
		MB_CE_HIDE_WINGS_SPECIES.forEach(function (sp) {
			var c = parts[sp];
			if (c && typeof c === "object" && typeof c.wings === "string") { out.push([sp, "wings"]); }
		});
		return out;
	}
	var tr = parts.traits;
	if (tr && typeof tr === "object") {
		Object.keys(tr).forEach(function (k) {
			if (typeof tr[k] === "string") { out.push(["traits", k]); }
		});
	}
	return out;
}
/* 首次改动前存一份整体快照：任一开关回退都还原到这份快照（一次开关=一次可回退动作） */
function mbCEHideSnap(V) {
	try {
		if (!V.mbCE_hideSnap || typeof V.mbCE_hideSnap !== "object") {
			V.mbCE_hideSnap = JSON.parse(JSON.stringify(V.transformationParts));
		}
	} catch (e) { /* 快照失败则放弃回退留痕，不影响本次写入 */ }
}
/* 切换：on=true → 全部设 "hidden"（保留 "disabled" 不动）；on=false → 把 "hidden" 还原 "default" */
function mbCEHideApply(kind, on) {
	try {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var parts = V.transformationParts;
		if (!parts || typeof parts !== "object") { return { ok: false, message: "转化数据尚未建立（先在游戏内触发任一转化，部件表才会生成）" }; }
		var targets = mbCEHideTargets(parts, kind);
		if (!targets.length) { return { ok: false, message: "未找到对应部件（" + (kind === "wings" ? "四系翅膀" : "traits 内在") + "）" }; }
		mbCEHideSnap(V);
		var n = 0;
		targets.forEach(function (t) {
			var c = parts[t[0]][t[1]];
			if (on) {
				if (c !== "disabled" && c !== "hidden") { parts[t[0]][t[1]] = "hidden"; n++; }
			} else {
				if (c === "hidden") { parts[t[0]][t[1]] = "default"; n++; }
			}
		});
		var hs = mbCEHideState();
		if (hs) { hs[kind] = !!on; }
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		V.mbCE_wrote["part:" + kind] = { type: "part", path: kind, kind: kind, on: !!on, before: true, after: !!on, t: Date.now() };
		mbCEWroteTrim(V);
		mbCEHideEnsureTimer();
		var label = kind === "wings" ? "翅膀" : "内在（traits）";
		return {
			ok: true,
			message: (on ? "已隐藏" : "已取消隐藏") + label + "（变更 " + n + " 个部件" + (n === 0 ? "，本来就是这个状态" : "") + "）" +
				(on && kind === "inner" ? "；内在隐藏不改造 NPC 反应，但原版每次重组隐藏会 +15 创伤 → 用下方「隐藏无惩罚」压掉" : "")
		};
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 强制保持隐藏：1s 校验，凡属已开启类别且被写成非 hidden/disabled 的，写回 "hidden" */
function mbCEHideTick() {
	try {
		var V = getV();
		var hs = V && V.mbCE_hide;
		if (!V || !hs || typeof hs !== "object" || !hs.force) { return 0; }
		var parts = V.transformationParts;
		if (!parts || typeof parts !== "object") { return 0; }
		var fixed = 0;
		["inner", "wings"].forEach(function (kind) {
			if (!hs[kind]) { return; }
			mbCEHideTargets(parts, kind).forEach(function (t) {
				var c = parts[t[0]][t[1]];
				if (c !== "disabled" && c !== "hidden") { parts[t[0]][t[1]] = "hidden"; fixed++; }
			});
		});
		return fixed;
	} catch (e) { return 0; }
}
function mbCEHideEnsureTimer() {
	try {
		var V = getV();
		var hs = V && V.mbCE_hide;
		var on = !!(hs && typeof hs === "object" && hs.force);
		if (on && !mbCEHideTimer) {
			mbCEHideTimer = setInterval(function () { try { mbCEHideTick(); } catch (e) {} }, 1000);
		} else if (!on && mbCEHideTimer) {
			clearInterval(mbCEHideTimer); mbCEHideTimer = null;
		}
	} catch (e) {}
}
/* 隐藏无惩罚：锁 $trauma = 0（原版 +15 会被 1s 写回压回 0）；关闭时解除这条锁定 */
function mbCEHideNoPenalty(on) {
	try {
		if (typeof mbCELockSet !== "function" || typeof mbCELockHas !== "function") {
			return { ok: false, message: "锁定模块未加载（07f-lock.js）" };
		}
		if (on) {
			if (mbCELockHas("trauma")) { return { ok: true, message: "创伤已处于锁定 0（无惩罚已生效）" }; }
			var r = mbCELockSet("trauma", 0, true);
			return (r && r.ok) ? { ok: true, message: "隐藏无惩罚已开启：创伤锁定 0（每 1 秒写回，原版 +15 压不住时也不会累积）" } : (r || { ok: false, message: "锁定失败" });
		}
		if (!mbCELockHas("trauma")) { return { ok: true, message: "创伤当前未锁定，无惩罚已是关闭态" }; }
		var r2 = mbCELockRemove("trauma");
		return (r2 && r2.ok) ? { ok: true, message: "隐藏无惩罚已关闭：已解除创伤锁定" } : (r2 || { ok: false, message: "解绑失败" });
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 强制保持隐藏开关 */
function mbCEHideForce(on) {
	try {
		var hs = mbCEHideState();
		if (!hs) { return { ok: false, message: "存档变量不可用" }; }
		hs.force = !!on;
		mbCEHideEnsureTimer();
		if (on) { mbCEHideTick(); }
		return {
			ok: true,
			message: on
				? "已开启「强制保持隐藏」：每秒校验，被原版打回默认（如 panicattacks ≥ 2 的隐藏失败）会立即写回隐藏"
				: "已关闭「强制保持隐藏」：原版可以自行取消你的隐藏"
		};
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 回退（08c 统一回退中心 type="part" 分支调用）：整体还原首次开关前的部件表 */
function mbCEHideUndo(key) {
	try {
		var V = getV();
		if (!V) { return { ok: false, msg: "存档变量不可用" }; }
		var hs = V.mbCE_hideSnap;
		if (!hs || typeof hs !== "object") { return { ok: false, msg: "没有可还原的外观快照（可能已回退或超出保留窗口）" }; }
		V.transformationParts = JSON.parse(JSON.stringify(hs));
		try { delete V.mbCE_hideSnap; } catch (e) { V.mbCE_hideSnap = undefined; }
		if (V.mbCE_hide && typeof V.mbCE_hide === "object") {
			V.mbCE_hide.inner = false; V.mbCE_hide.wings = false; V.mbCE_hide.force = false;
		}
		mbCEHideEnsureTimer();
		if (V.mbCE_wrote) { try { delete V.mbCE_wrote[key]; } catch (e2) {} }
		return { ok: true, msg: "已还原外观（转化部件回到首次隐藏前的状态）" };
	} catch (e) { return { ok: false, msg: "回退异常：" + mbCEErr(e) }; }
}

/* 阶段页「转化阶段」内层页签的区块（renderTransformStages 末尾/早退前调用） */
function renderTransformHideSec(pane) {
	if (!pane) { return; }
	var V = getV();
	var parts = V && V.transformationParts;
	var sec = mceNewSec(pane, 2, "外观隐藏（转化部件 · 原版字段）",
		"原版 $transformationParts 是三态字符串（default / hidden / disabled）。" +
		"「隐藏内在」= traits.*（尖牙/锐眼/追逐/炫耀/终身伴侣）；「隐藏翅膀」= 鸟/天使/堕落天使/恶魔的 wings（独立开关，互不影响）。" +
		"实证：隐藏后原版大量场景的 `isnot \"hidden\"` 判定不再触发（NPC 看不见翅膀、不因尖牙发怵），但每次「重新隐藏」时非 traits 部件各 +15 创伤、panicattacks ≥ 2 会强制取消隐藏 —— 用「隐藏无惩罚」压掉。");
	if (!parts || typeof parts !== "object") {
		sec.appendChild(el("div", "mce-hint", "当前存档还没有转化部件表：先在游戏内触发任一转化（天使/恶魔/狼/猫/牛/狐/鸟/树精等），或直接在「阶段」页解锁一个转化阶段后再回来。"));
		return;
	}
	var innerN = 0, hiddenInner = 0, wingsN = 0, hiddenWings = 0;
	mbCEHideTargets(parts, "inner").forEach(function (t) {
		innerN++; if (parts[t[0]][t[1]] === "hidden") { hiddenInner++; }
	});
	mbCEHideTargets(parts, "wings").forEach(function (t) {
		wingsN++; if (parts[t[0]][t[1]] === "hidden") { hiddenWings++; }
	});
	var hs = (V.mbCE_hide && typeof V.mbCE_hide === "object") ? V.mbCE_hide : {};

	var mk = function (title, kind, total, hidden, note) {
		var row = el("div", "mce-row");
		var lbl = el("span", "mce-row-lbl", title + "（" + hidden + " / " + total + " 个部件处于隐藏）");
		lbl.title = note;
		row.appendChild(lbl);
		var on = el("button", "mce-btn mce-gold", "全部隐藏");
		on.type = "button";
		on.addEventListener("click", function () { var r = mbCEHideApply(kind, true); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
		var off = el("button", "mce-btn", "全部取消隐藏");
		off.type = "button";
		off.addEventListener("click", function () { var r = mbCEHideApply(kind, false); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
		row.appendChild(on); row.appendChild(off);
		if (hs[kind]) { row.appendChild(el("span", "mce-badge mce-on", "已开启")); }
		sec.appendChild(row);
	};
	mk("隐藏内在（traits：尖牙/锐眼/追逐/炫耀/终身伴侣）", "inner", innerN, hiddenInner, "内在隐藏后 NPC 不会再因尖牙/锐眼等对你产生对应反应");
	if (wingsN) { mk("隐藏翅膀（鸟 / 天使 / 堕落天使 / 恶魔）", "wings", wingsN, hiddenWings, "独立开关：只藏翅膀，不动其它部位；原版对翅膀隐藏有惩罚豁免"); }
	else { sec.appendChild(el("div", "mce-hint", "翅膀：当前存档四系翅膀字段均未生成（还没有鸟类/天使/恶魔转化）。")); }

	/* 隐藏无惩罚 */
	var npRow = el("div", "mce-row");
	npRow.appendChild(el("span", "mce-row-lbl", "隐藏无惩罚（锁创伤 0）"));
	var npOn = (typeof mbCELockHas === "function") && mbCELockHas("trauma");
	var npBtn = el("button", "mce-btn" + (npOn ? " mce-gold" : ""), npOn ? "无惩罚：已开启（点此关闭）" : "开启隐藏无惩罚");
	npBtn.type = "button";
	npBtn.addEventListener("click", function () { var r = mbCEHideNoPenalty(!npOn); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
	npRow.appendChild(npBtn);
	sec.appendChild(npRow);

	var fcRow = el("div", "mce-row");
	fcRow.appendChild(el("span", "mce-row-lbl", "强制保持隐藏（防原版打回）"));
	var fcBtn = el("button", "mce-btn" + (hs.force ? " mce-gold" : ""), hs.force ? "强制保持：已开启（点此关闭）" : "开启强制保持");
	fcBtn.type = "button";
	fcBtn.title = "每秒校验一次：已被开启的类别若被原版写回 default（panicattacks ≥ 2 的隐藏失败），立即写回 hidden";
	fcBtn.addEventListener("click", function () { var r = mbCEHideForce(!hs.force); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
	fcRow.appendChild(fcBtn);
	sec.appendChild(fcRow);
	sec.appendChild(el("div", "mce-hint", "组合用法：先点「全部隐藏」→ 再开「隐藏无惩罚」→ 若角色有恐慌发作（panicattacks ≥ 2）再开「强制保持隐藏」。三项都在本页，随存档保存；改动在「全局」页回退中心可整体还原。"));
}
