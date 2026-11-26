/* 职责：格威岚阶段线（v2.2.8）
   原版事实（Degrees of Lewdity 0.5.12.13）：
   - 5 档阶段全部内联在 `Gwylan Talk Shop`（passage 内 if/elseif 链，从 100% 往 10% 判），
     没有独立 passage 名，只能「写值 + 进店」触发；每档命中后 `$gwylan.stage` 升到对应档。
   - 判定同时看 `_gwylanLovePercent` 与 `$gwylan.stage`（lte 上一档），所以低档回放必须
     让好感落回该档区间；高档则要补足。
   - `_gwylanLovePercent = ceil(C.npc.Gwylan.love / (totalSets*2) * 100)`，
     `love = 已解锁森林特装数 + $gwylanTalked 中森林特装数`（`$gwylan.wary>1` 且 state active/scorned 时再减 2*wary）。
     love 由 `statusCheck("Gwylan")` 每次重算 → 直接写 `C.npc.Gwylan.love` 无效，只能改 `$gwylanTalked`。
   - 本模块按「模拟写值」语义实现：临时增/删 `$gwylanTalked` 与 `$gwylan.stage`，播完（离开 Talk Shop）全部还原，
     不污染真实进度。 */
var GWYLAN_STAGE_ROWS = [
	{ stage: 1, pct: 10, cn: "阶段 1 · 修旧架子（好感 ≥10%）" },
	{ stage: 2, pct: 25, cn: "阶段 2 · 整理衣架（好感 ≥25%）" },
	{ stage: 3, pct: 50, cn: "阶段 3 · 书架后探头（好感 ≥50%）" },
	{ stage: 4, pct: 75, cn: "阶段 4 · 修藤蔓（好感 ≥75%）" },
	{ stage: 5, pct: 100, cn: "阶段 5 · 背后拥抱（100% + 已见 yearning）" }
];
function mbCEGwylanStageRows() { return GWYLAN_STAGE_ROWS.slice(); }
function mbCEGwylanSetupObj() {
	var s = null;
	try { if (typeof setup !== "undefined" && setup) { s = setup; } } catch (e) {}
	if (!s) { try { s = (typeof getSetup === "function") ? getSetup() : null; } catch (e2) { s = null; } }
	return s;
}
/* 森林商店特装套装名（setup.specialClothesSets 中 shop 含 forest） */
function mbCEGwylanForestSets() {
	var S = mbCEGwylanSetupObj();
	var all = (S && S.specialClothesSets) ? S.specialClothesSets : null;
	if (!all) { return []; }
	return Object.keys(all).filter(function (k) {
		var st = all[k];
		return st && Array.isArray(st.shop) && st.shop.indexOf("forest") !== -1;
	});
}
function mbCEGwylanUnlockedCount(sets, list) {
	var unlocked = 0;
	list.forEach(function (c) {
		if (c && Number(c.unlocked) >= 2 && sets.indexOf(String(c.name)) !== -1) { unlocked++; }
	});
	return unlocked;
}
function mbCEGwylanTalkedCount(sets, list) {
	var talked = 0;
	list.forEach(function (k) { if (sets.indexOf(String(k)) !== -1) { talked++; } });
	return talked;
}
/* wary>1 且处于 active/scorned → 原版 love 扣 2*wary（见 07u 头注释公式） */
function mbCEGwylanWaryOf(V) {
	var wary = (V.gwylan && Number(V.gwylan.wary)) ? Number(V.gwylan.wary) : 0;
	var npc = V.characters && V.characters.npc ? V.characters.npc.Gwylan : null;
	var state = npc ? String(npc.state || "") : "";
	if (wary > 1 && (state === "active" || state === "scorned")) { return { wary: wary, penalty: wary * 2 }; }
	return { wary: wary, penalty: 0 };
}
function mbCEGwylanLoveInfo() {
	var V = getV();
	var sets = mbCEGwylanForestSets();
	var total = sets.length;
	var out = { total: total, love: 0, pct: 0, unlocked: 0, talked: 0, wary: 0 };
	if (!V || !total) { return out; }
	var unlocked = mbCEGwylanUnlockedCount(sets, Array.isArray(V.specialClothes) ? V.specialClothes : []);
	var talked = mbCEGwylanTalkedCount(sets, Array.isArray(V.gwylanTalked) ? V.gwylanTalked : []);
	var w = mbCEGwylanWaryOf(V);
	var love = unlocked + talked - w.penalty;
	out.unlocked = unlocked; out.talked = talked; out.wary = w.wary;
	out.love = love;
	out.pct = Math.ceil(love / (total * 2) * 100);
	return out;
}
/* 目标档的 love 区间：[ceil(本档阈值/100*总分), floor((下一档阈值-1)/100*总分)]
   总分 = total*2；不依赖「写 C.npc.Gwylan.love」，只调 $gwylanTalked。 */
function mbCEGwylanStageLoveRange(n) {
	var total = mbCEGwylanForestSets().length;
	var row = null, nextPct = 101;
	for (var i = 0; i < GWYLAN_STAGE_ROWS.length; i++) {
		if (GWYLAN_STAGE_ROWS[i].stage === n) { row = GWYLAN_STAGE_ROWS[i]; nextPct = (i + 1 < GWYLAN_STAGE_ROWS.length) ? GWYLAN_STAGE_ROWS[i + 1].pct : 101; }
	}
	if (!row || !total) { return null; }
	var denom = total * 2;
	return {
		min: Math.ceil(row.pct / 100 * denom),
		max: Math.floor((nextPct - 1) / 100 * denom),
		total: total
	};
}
/* 前置校验：阶段号 / wary / yearning / 森林特装 / 区间。返回 {ok, sets, range} 或拒绝原因 */
/** @returns {{ ok: true, sets: string[], range: { min: number, max: number, total: number } } | { ok: false, message: string }} */
function mbCEGwylanStageGuard(n, V) {
	function rowFound(n2) { return GWYLAN_STAGE_ROWS.filter(function (r) { return r.stage === n2; })[0]; }
	var row = rowFound(n);
	if (!row) { return { ok: false, message: "未知阶段：" + n }; }
	var wary = Number(V.gwylan.wary) || 0;
	if (wary > 1) {
		return { ok: false, message: "格威岚当前对你保持警惕（$gwylan.wary=" + wary + "）：进店会走警戒对白，阶段剧情不会正常播放。请先完成和解（降至 0～1）再来。" };
	}
	var seen = Array.isArray(V.gwylanSeen) ? V.gwylanSeen : [];
	if (n === 5 && seen.indexOf("yearning") === -1) {
		return { ok: false, message: "阶段 5 需先看过「渴望」场景（$gwylanSeen 含 yearning）；缺失时拒绝，不伪造标记以免污染真实进度。" };
	}
	var sets = mbCEGwylanForestSets();
	if (!sets.length) { return { ok: false, message: "未读取到森林特装数据（setup.specialClothesSets 不可用），无法计算好感。" }; }
	var range = mbCEGwylanStageLoveRange(n);
	if (!range) { return { ok: false, message: "阶段区间计算失败。" }; }
	return { ok: true, sets: sets, range: range };
}
/* 把 $gwylanTalked 临时补到区间内 / 移出区间外（返回增删清单；不可行时拒绝） */
/** @returns {{ ok: true, added: string[], removed: string[] } | { ok: false, message: string }} */
function mbCEGwylanStageFill(V, sets, range, n) {
	var talk = Array.isArray(V.gwylanTalked) ? V.gwylanTalked : (V.gwylanTalked = []);
	var info = mbCEGwylanLoveInfo();
	var added = [], removed = [];
	if (info.love < range.min) {
		var pool = sets.filter(function (k) { return talk.indexOf(k) === -1; });
		var need = range.min - info.love;
		for (var i = 0; i < pool.length && added.length < need; i++) { added.push(pool[i]); }
		if (added.length < need) {
			return { ok: false, message: "森林特装可用项不足（需补 " + need + " 项，仅 " + added.length + " 项），无法把好感拉到该阶段阈值。" };
		}
		added.forEach(function (k) { talk.push(k); });
		return { ok: true, added: added, removed: removed };
	}
	if (info.love > range.max) {
		/* 只移除「仅靠 talked 计数」的项：已解锁项即使移出 talked 仍计入 love */
		var drop = info.love - range.max;
		var cand = talk.filter(function (k) {
			return sets.indexOf(String(k)) !== -1 && !(V.specialClothes || []).some(function (c) { return c && String(c.name) === String(k) && Number(c.unlocked) >= 2; });
		});
		for (var j = 0; j < cand.length && removed.length < drop; j++) { removed.push(cand[j]); }
		if (removed.length < drop) {
			return { ok: false, message: "你当前好感 P" + info.pct + "% 已越过阶段 " + n + "（原版按当前好感从高到低判定，低档无法回放）；已解锁特装本身计入好感，无法临时降低。" };
		}
		removed.forEach(function (k) { var idx = talk.indexOf(k); if (idx !== -1) { talk.splice(idx, 1); } });
	}
	return { ok: true, added: added, removed: removed };
}
/** @returns {{ ok: true, message: string, info: any, added: string[], removed: string[] } | { ok: false, message: string }} */
function mbCEGwylanStagePrepare(n) {
	var V = getV();
	if (!V) { return { ok: false, message: "存档不可用" }; }
	/* 重复准备（如先 Prepare 再 Play）：先还原上一次的临时写值，避免 added 记录被覆盖后漏还原 */
	if (V.mbCE_gwylanStageRestore) { mbCEGwylanStageRestoreTick("__prepare__"); }
	if (!V.gwylan || typeof V.gwylan !== "object") { V.gwylan = {}; }
	/** @type {any} */
	var g = mbCEGwylanStageGuard(n, V);
	if (!g.ok) { return { ok: false, message: String(g.message || "") }; }
	/** @type {any} */
	var fill = mbCEGwylanStageFill(V, g.sets, g.range, n);
	if (!fill.ok) { return { ok: false, message: String(fill.message || "") }; }
	var hadStage = Object.prototype.hasOwnProperty.call(V.gwylan, "stage");
	var oldStage = V.gwylan.stage;
	V.gwylan.stage = n - 1;
	V.mbCE_gwylanStageRestore = { hadStage: hadStage, stage: oldStage, added: fill.added, removed: fill.removed, at: Date.now() };
	var after = mbCEGwylanLoveInfo();
	return {
		ok: true,
		message: "已准备阶段 " + n + "（stage " + (hadStage ? oldStage : "未设置") + " → " + (n - 1) + "，补 " + fill.added.length + " 项 / 暂移 " + fill.removed.length + " 项，好感 P" + after.pct + "%）；离开商店后自动还原",
		info: after, added: fill.added, removed: fill.removed
	};
}
/** @returns {{ ok: boolean, message: string, info?: any }} */
function mbCEGwylanStagePlay(n) {
	var pr = mbCEGwylanStagePrepare(n);
	if (!pr.ok) { return pr; }
	var ep = getEnginePlayFn();
	if (!ep) { return { ok: false, message: "引擎不可用，无法进入 Gwylan Talk Shop" }; }
	try {
		ep.play.call(ep.e, "Gwylan Talk Shop", true);
		return { ok: true, message: pr.message, info: pr.info };
	} catch (e) {
		return { ok: false, message: "进入商店失败：" + mbCEErr(e) };
	}
}
/* 还原临时写值（talked 增删 + stage 回写/删除 + 清标记） */
function mbCEGwylanStageRestoreApply(V) {
	var R = V.mbCE_gwylanStageRestore;
	var talk = Array.isArray(V.gwylanTalked) ? V.gwylanTalked : (V.gwylanTalked = []);
	(R.added || []).forEach(function (k) { var i = talk.indexOf(k); if (i !== -1) { talk.splice(i, 1); } });
	(R.removed || []).forEach(function (k) { if (talk.indexOf(k) === -1) { talk.push(k); } });
	if (!V.gwylan || typeof V.gwylan !== "object") { V.gwylan = {}; }
	if (R.hadStage) { V.gwylan.stage = R.stage; } else { delete V.gwylan.stage; }
	delete V.mbCE_gwylanStageRestore;
}
/* 离开 Talk Shop 即还原（进入任意其它段落触发；仍在 Talk Shop 时不还原） */
function mbCEGwylanStageRestoreTick(title) {
	try {
		var V = getV();
		if (!V || !V.mbCE_gwylanStageRestore) { return false; }
		if (String(title || "") === "Gwylan Talk Shop") { return false; }
		mbCEGwylanStageRestoreApply(V);
		return true;
	} catch (e) { return false; }
}
