/* 职责：FertilityExpansion 孩子页数据层 —— 读数 / 年龄阶段 / 地点 / 召见 / 成年 */
/* ============ v2.0.0.002 需求①③ + 玩家截图四条：FertilityExpansion 孩子页 ============
   位置：挂在 fertility-expansion 适配器面板的最下面（04a-14 的 mbCEFertRender 之后），
         孩子集中在这里做数值调整，不再散落在角色页。
   源码实证（_modcache/fert_tmp/.../mods/FertilityExpansion/modules，1.7.0，逐字读，非二手）：
   - 孩子数据两种形态：新存档 V.childRecords（数组）/ 旧存档 V.children（对象）；
     统一走 window.EdenChildData 的 entries / get / phaseOf / locationOf / setLocation / ageDays。
     EdenChildData.entries({scope:"all"}) 已排除 removed（edenDeleted === true 或 pregnancy.carrier === "cleared"）。
   - 孩子「好感/爱意」= V.eden.children[<childId>].affection，范围 0-100、两位小数：
     eden-adult.js:144-149 ensureAffection（默认 newResident 40 / existingResident 50）、
     :488-490 remittance 用 affectionFloor 30 + fullAffection 80、
     :539-549 intimacy minimumAffection 40；
     eden-profile.js:176-182 面板显示为「好感」；eden-chat-prompt.js:10-15 按 20/40/60/80 分段描述亲疏。
   - 成长：eden-age.js:150-169 syncRecord —— record.forcedAdult === true 时 lifeStage 直接置 "adult"
     （只改阶段，不写 adult.settled）；年龄按 getAgeDays(child, record)（以 growthStartSerialDay 或 born 起算）。
   - 地点：eden-child-data.js setLocation 只对 phase born/egg 生效，records 形态写 child.development.location；
     源码实际产出过的合法值 = eden_home / home / eden_contacts / away / eden_released
     （eden-breeding.js:222/245/419 生产 eden_home 与 home；eden-adult.js:357 结算写 eden_contacts / eden_released）。
   - 「一键长大 + 立刻成年结算」的配合：settleAdult 的前置 needsSettlement 要求 lifeStage==="adult"
     + phaseOf==="born" + locationOf==="eden_home" + !adult.settled（eden-adult.js:402-413）。
     所以必须先在 eden_home 一键长大，再点「立刻成年结算」；已在其它地点的孩子按钮会如实报前置失败，不静默。 */
var MB_CE_FERT_KID_LOCS = [
	{ key: "eden_home", label: "伊甸园（eden_home）" },
	{ key: "home", label: "玩家住处（home）" },
	{ key: "eden_contacts", label: "成年·通讯录（eden_contacts）" },
	{ key: "away", label: "成年·离家（away）" },
	{ key: "eden_released", label: "成年·已放归（eden_released）" }
];
var MB_CE_FERT_KID_STATUS = {
	active: "在园", resident: "常驻", adult_pending: "待成年结算", adult: "已成年", released: "已放归"
};
function mbCEFertKidData() {
	try { return (typeof window !== "undefined" && window.EdenChildData) ? window.EdenChildData : null; } catch (e) { return null; }
}
/* 模组每个方法都有可选的 vars 尾参（eden-child-data.js: get(id, vars) / phaseOf(child, vars) /
   setLocation(child, location, vars) / ageDays(child, record, vars) / entries(opts, vars)），
   缺省值取自 window.SugarCube?.State?.variables。本页实测该通道不可见（SugarCube 只挂空壳对象），
   所以一律显式传存档变量，避免整页静默空转；多传实参对旧版模组无副作用（多余实参被忽略）。 */
function mbCEFertKidVars() {
	try { var V = getV(); return (V && typeof V === "object") ? V : {}; } catch (e) { return {}; }
}
/* 取孩子列表（含未出生的卵/胎儿，scope=all 且排除 removed）。
   优先 EdenChildData.entries，回退直读存档（模组未加载时孩子页也能列出并告警）。 */
function mbCEFertKidPairs() {
	var out = [];
	var api = mbCEFertKidData();
	var V0 = mbCEFertKidVars();
	if (api && typeof api.entries === "function") {
		try {
			var e = api.entries({ scope: "all" }, V0);
			if (e && typeof e.forEach === "function" && !Array.isArray(e)) { e.forEach(function (v, k) { out.push([String(k), v]); }); }
			else if (Array.isArray(e)) {
				e.forEach(function (it) {
					if (Array.isArray(it) && it.length >= 2) { out.push([String(it[0]), it[1]]); }
					else if (it && typeof it === "object") { out.push([String(it.childId), it]); }
				});
			}
		} catch (x) { out = []; }
	}
	if (!out.length) {
		var V = getV();
		var rec = (V && V.childRecords) ? V.childRecords : null;
		if (Array.isArray(rec)) {
			/* records 形态：孩子 id 就是数组下标（EdenChildData.indexOf 只接受 (0|[1-9]\d*) 并按下标取），
			   且模组 get() 要求 child.childId === 下标——childId 与下标不符的条目模组自己查不到，
			   这里也不列出，否则删孩子后会留下「假存在」。edenDeleted === true 同样跳过。 */
			rec.forEach(function (c, i) {
				if (!c || typeof c !== "object" || c.edenDeleted === true) { return; }
				var cid = (c.childId !== undefined && c.childId !== null) ? Number(c.childId) : i;
				if (cid !== i) { return; }
				out.push([String(i), c]);
			});
		}
		else if (V && V.children && typeof V.children === "object") {
			Object.keys(V.children).forEach(function (k) {
				var c = V.children[k];
				if (c && c.edenDeleted !== true) { out.push([k, c]); }
			});
		}
	}
	return out;
}
/* 存在性检测：模组侧删掉孩子后这里必须返回 null（玩家要求「自动检测是否还存在、不能出问题」）。
   两道通道：EdenChildData.get（在线时的正路，phaseOf=removed 直接判死）→ 枚举兜底（API 缺失或查不到时）。 */
function mbCEFertKidAlive(id) {
	var key = String(id);
	var api = mbCEFertKidData();
	var V = mbCEFertKidVars();
	var child = null;
	if (api && typeof api.get === "function") {
		try { child = api.get(key, V); } catch (e) { child = null; }
		if (!child) { try { child = api.get(Number(key), V); } catch (e2) { child = null; } }
		if (child) {
			try {
				if (typeof api.phaseOf === "function") {
					var ph = api.phaseOf(child, V);
					if (ph === "removed" || ph === "missing") { return null; }
				}
			} catch (e3) { /* 判定失败按存在处理，交给写入前的 record 校验兜底 */ }
			return child;
		}
	}
	var pairs = mbCEFertKidPairs();
	for (var i = 0; i < pairs.length; i++) { if (pairs[i][0] === key) { return pairs[i][1]; } }
	return null;
}
/* phase 判定兜底：逐条对齐 eden-child-data.js:50-59 的 phaseOf 语义
   （无 child→missing / edenDeleted→removed / 非 record→eggTimer?egg:born /
      record 且 pregnancy.carrier==="cleared"→removed / bornDate 有限→born /
      hawk 且 pregnancy.deliveredDate 有限→egg / 其余 unborn）。 */
function mbCEFertKidPhase(child) {
	var api = mbCEFertKidData();
	try { if (api && typeof api.phaseOf === "function") { return api.phaseOf(child, mbCEFertKidVars()); } } catch (e) { /* 回退下一条 */ }
	if (!child || typeof child !== "object") { return "missing"; }
	if (child.edenDeleted === true) { return "removed"; }
	var isRec = (child.bornDate !== undefined);
	if (!isRec) { return (child.eggTimer !== undefined) ? "egg" : "born"; }
	var pg = null;
	try {
		var V = mbCEFertKidVars();
		var idx = Number(child.pregnancyId);
		if (Number.isInteger(idx) && idx >= 0 && Array.isArray(V.pregnancies)) { pg = V.pregnancies[idx] || null; }
	} catch (e2) { pg = null; }
	if (pg && pg.carrier === "cleared") { return "removed"; }
	if (Number.isFinite(child.bornDate)) { return "born"; }
	if (pg && Number.isFinite(pg.deliveredDate)) { return "egg"; }
	return "unborn";
}
function mbCEFertKidLocation(child) {
	var api = mbCEFertKidData();
	try {
		if (api && typeof api.locationOf === "function") {
			var l = api.locationOf(child);
			if (l !== undefined && l !== null && l !== "") { return String(l); }
		}
	} catch (e) { /* 回退直读 */ }
	if (child && child.development && typeof child.development === "object" && child.development.location) { return String(child.development.location); }
	if (child && child.location) { return String(child.location); }
	return "";
}
/* 概要：一行里需要的全部只读信息，全部实时取，不缓存（保证删孩子后立刻反映） */
function mbCEFertKidInfo(id) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	var api = mbCEFertKidData();
	var ageDays = null;
	if (child) {
		try { ageDays = (api && typeof api.ageDays === "function") ? api.ageDays(child, rec, mbCEFertKidVars()) : ((rec && typeof rec.ageDays === "number") ? rec.ageDays : null); } catch (e) { ageDays = null; }
	}
	var affection = (rec && Number.isFinite(Number(rec.affection))) ? Number(rec.affection) : null;
	return {
		id: String(id),
		alive: !!child,
		child: child,
		record: rec,
		name: (child && child.name) ? String(child.name) : "未命名",
		gender: (child && child.gender) ? String(child.gender) : "",
		phase: child ? mbCEFertKidPhase(child) : "missing",
		location: child ? mbCEFertKidLocation(child) : "",
		species: (rec && rec.species) ? String(rec.species) : ((child && child.species) ? String(child.species) : ""),
		lifeStage: (rec && rec.lifeStage) ? String(rec.lifeStage) : "",
		lifeStageLabel: (rec && rec.lifeStageLabel) ? String(rec.lifeStageLabel) : "",
		ageDays: ageDays,
		affection: affection,
		status: (rec && rec.status) ? String(rec.status) : "",
		settled: !!(rec && rec.adult && rec.adult.settled),
		outcome: (rec && rec.adult && rec.adult.outcome) ? String(rec.adult.outcome) : "",
		training: (rec && rec.training && rec.training.skills) ? rec.training.skills : null,
		innate: (rec && rec.innate) ? rec.innate : null
	};
}
/* 写好感：走通用执行器（0-100 下限钳制 + V.mbCE_wrote 留痕可回退），
   动态 id 路径 eden.children.<id>.affection 不在 varPath 声明体系里，只能这样写。 */
function mbCEFertKidSetAffection(id, raw) {
	var rec = mbCEFertRecord(String(id));
	if (!rec) { return { ok: false, message: "这个孩子在养育记录 eden.children 里不存在（可能刚被模组侧删除），已刷新列表" }; }
	if (!mbCEFertKidAlive(id)) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	return cheatWriteValue("fertility-expansion", "fert_child_aff_" + id, "fert_child_aff", "eden.children." + id + ".affection", raw, "number", 0, 100);
}
/* 定向发送：走模组 EdenChildData.setLocation（只对 born/egg 生效），失败不静默 */
function mbCEFertKidSetLocation(id, loc) {
	var child = mbCEFertKidAlive(id);
	if (!child) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	var target = String(loc === undefined || loc === null ? "" : loc).trim();
	if (!target) { return { ok: false, message: "地点不能为空（例：eden_home / home / eden_contacts）" }; }
	/* 模组 setLocation 的前置：phase 必须是 born / egg（eden-child-data.js:99）。
	   兜底直写前必须先过同一道门控，否则会把未出生的胎儿也写出地点（越过模组语义）。 */
	var phase = mbCEFertKidPhase(child);
	if (phase !== "born" && phase !== "egg") {
		return { ok: false, message: "无法发送：该孩子当前是「" + phase + "」（未出生/已移除），模组只允许已出生或已产卵的孩子指定地点" };
	}
	var before = mbCEFertKidLocation(child);
	var ok = false, via = "setLocation";
	var api = mbCEFertKidData();
	var V = mbCEFertKidVars();
	try { if (api && typeof api.setLocation === "function") { ok = api.setLocation(child, target, V) !== false; } } catch (e) { ok = false; }
	if (!ok) {
		/* 兜底直写（模组 API 缺失或被拒时按数据结构写，已过上面的 phase 门控） */
		try {
			if (child.development && typeof child.development === "object") { child.development.location = target; }
			else { child.location = target; }
			ok = mbCEFertKidLocation(child) === target;
			via = "direct";
		} catch (e2) { ok = false; }
	}
	if (!ok) { return { ok: false, message: "无法更新这个孩子的地点（模组 setLocation 拒绝，通常是还没出生/已移除）" }; }
	try {
		/* v2.0.12 自查：本函数 L194 已声明 var V = mbCEFertKidVars()（等价 getV() 的空值兜底），
		   此处再 var 属同作用域重复声明（ESLint no-redeclare）。改为赋值复用，语义不变。 */
		V = getV();
		if (V) {
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = "cheat:fertility-expansion:fert_child_loc_" + id;
			var prev = V.mbCE_wrote[key];
			var keepBefore = (prev && "before" in prev) ? prev.before : before;
			V.mbCE_wrote[key] = { type: "cheat", modId: "fertility-expansion", op: "fert_child_loc", path: "eden.children." + id + ".location", childId: String(id), before: keepBefore, after: target, via: via, t: Date.now() };
			if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
		}
	} catch (e3) { /* 留痕失败不影响写入结果 */ }
	return { ok: true, message: "已把孩子 #" + id + " 定向送到 " + target + "（原地点 " + (before || "未知") + "）" };
}
/* 随叫随到：把地点对齐到玩家当前位置；玩家所在位置若不是模组认的两个居所，退回 eden_home 并说明 */
function mbCEFertKidCallToMe(id) {
	var V = getV();
	var here = (V && V.location) ? String(V.location) : "";
	var target = here;
	if (target !== "eden_home" && target !== "home") { target = "eden_home"; }
	var res = mbCEFertKidSetLocation(id, target);
	if (res.ok && here && here !== target) {
		res.message += "（玩家当前在 " + here + "，模组只认 eden_home/home 作为孩子居所，已送到 eden_home）";
	}
	return res;
}
/* 一键长大：forcedAdult = true + EdenAge.syncRecord（lifeStage 直接成年），
   随后跑 EdenAdult.syncRecord 让 status 变成 adult_pending（不等于结算，收益仍需「立刻成年结算」）。 */
function mbCEFertKidGrowUp(id, silent) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	if (!child || !rec) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	/* 只对已出生的孩子长大：胎儿/未孵化的卵没有年龄起点，模组 syncRecord 会按 0 天算出婴儿期，
       forcedAdult 虽能强推成年，但会连带把 bornDate 缺失的孩子写进 adult_pending，属越过模组语义。 */
	var phase = mbCEFertKidPhase(child);
	if (phase !== "born") {
		return { ok: false, message: "无法长大：#" + id + " 当前是「" + phase + "」，只有已出生的孩子可以一键长大" };
	}
	var V = getV();
	var settings = (V && V.eden && V.eden.settings && typeof V.eden.settings === "object") ? V.eden.settings : {};
	var before = { forcedAdult: rec.forcedAdult, lifeStage: rec.lifeStage, status: rec.status };
	rec.forcedAdult = true;
	var synced = false;
	try {
		if (typeof window !== "undefined" && window.EdenAge && typeof window.EdenAge.syncRecord === "function") {
			window.EdenAge.syncRecord(rec, child, settings);
			synced = true;
		}
	} catch (e) { synced = false; }
	if (!synced) { rec.lifeStage = "adult"; rec.lifeStageLabel = (rec.lifeStageLabel || "") || "成年"; }
	try {
		if (typeof window !== "undefined" && window.EdenAdult && typeof window.EdenAdult.syncRecord === "function") { window.EdenAdult.syncRecord(rec, child); }
	} catch (e2) { /* 成年状态同步失败不影响已长大 */ }
	try {
		if (V) {
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = "cheat:fertility-expansion:fert_child_adult_" + id;
			var prev = V.mbCE_wrote[key];
			var keep = (prev && "before" in prev) ? prev.before : before;
			V.mbCE_wrote[key] = { type: "cheat", modId: "fertility-expansion", op: "fert_child_adult", path: "eden.children." + id + ".forcedAdult", childId: String(id), before: keep, after: true, via: synced ? "EdenAge.syncRecord" : "direct", t: Date.now() };
			if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
		}
	} catch (e3) { /* 留痕失败不影响写入结果 */ }
	if (silent) { return { ok: true, message: "" }; }
	return {
		ok: true,
		message: "已把 #" + id + " 一键长大：阶段 " + (rec.lifeStageLabel || rec.lifeStage || "?")
			+ "、" + (MB_CE_FERT_KID_STATUS[rec.status] || rec.status || "?")
			+ (rec.lifeStage === "adult" ? "（要结算未来收益请再点「立刻成年结算」）" : "（模组未把阶段推到成年，请检查该孩子的种族是否可养育）")
	};
}
function mbCEFertKidLocLabel(loc) {
	var hit = MB_CE_FERT_KID_LOCS.filter(function (x) { return x.key === loc; })[0];
	return hit ? hit.label : (loc || "未知");
}
function mbCEFertKidAgeText(info) {
	if (info.phase === "egg") { return "未孵化"; }
	if (typeof info.ageDays !== "number" || !isFinite(info.ageDays)) { return "年龄未知"; }
	return "约 " + Math.max(0, Math.floor(info.ageDays)) + " 天";
}
