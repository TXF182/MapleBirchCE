/* ============ v2.0.0.002 收敛轮：孩子个体数值写入层（养育四项 / 先天四项）============ 
   从 04a-15-fert-children.js 拆出（原文件 407 行会越过评分 C3 的 ≤400 满分档）。
   模组 EdenCheats.saveSkills / saveInnate 的 patch 要求四项齐全（eden-cheats.js:189 numeric(patch[k]) 对缺项抛错，
   不是清零），所以这里先用记录当前值补齐、只改用户填的那一项；模组 API 缺失/失败时按同一结构兜底直写。
   全部写入走 V.mbCE_wrote 留痕（与好感/地点同一通道，可回退）。 */
/* ===== 养育四项 / 先天四项（孩子页里的数值调整主体） =====
   模组 EdenCheats.saveSkills / saveInnate 的 patch 要求四项齐全：
   eden-cheats.js:189 `numeric(patch[k], 0, 100)` 对缺项直接抛错（不是清零），
   所以调用前必须先用记录里的当前值补齐，只改用户填的那一项。 */
var MB_CE_FERT_KID_SKILLS = ["knowledge", "fitness", "social", "awareness"];
var MB_CE_FERT_KID_INNATE = ["appearance", "fitness", "intelligence", "temperament"];
function mbCEFertKidCurSkills(rec) {
	var src = (rec && rec.training && rec.training.skills && typeof rec.training.skills === "object") ? rec.training.skills : {};
	var out = {};
	MB_CE_FERT_KID_SKILLS.forEach(function (k) { var n = Number(src[k]); out[k] = Number.isFinite(n) ? n : 0; });
	return out;
}
function mbCEFertKidCurInnate(rec) {
	var src = (rec && rec.innate && typeof rec.innate === "object") ? rec.innate : {};
	var out = {};
	MB_CE_FERT_KID_INNATE.forEach(function (k) { var n = Number(src[k]); out[k] = Number.isFinite(n) ? n : 0; });
	return out;
}
/* 记录里的四项若还没由模组初始化（record.innate / record.training.skills 缺项），
   先让模组自己的 syncRecord 生成默认值再读，避免把「未生成」当成 0 写死。 */
function mbCEFertKidEnsureSkills(rec, child) {
	try {
		var cur = mbCEFertKidCurSkills(rec), miss = false;
		MB_CE_FERT_KID_SKILLS.forEach(function (k) { if (!(rec && rec.training && rec.training.skills && rec.training.skills[k] !== undefined)) { miss = true; } });
		if (!miss) { return cur; }
		if (typeof window !== "undefined" && window.EdenTraining && typeof window.EdenTraining.syncRecord === "function") {
			var V = mbCEFertKidVars();
			window.EdenTraining.syncRecord(rec, child, (V && V.eden && V.eden.settings) ? V.eden.settings : {});
			return mbCEFertKidCurSkills(rec);
		}
	} catch (e) { /* 同步失败按当前值处理 */ }
	return mbCEFertKidCurSkills(rec);
}
function mbCEFertKidEnsureInnate(rec, child, id) {
	try {
		var miss = false;
		MB_CE_FERT_KID_INNATE.forEach(function (k) { if (!(rec && rec.innate && rec.innate[k] !== undefined)) { miss = true; } });
		if (!miss) { return mbCEFertKidCurInnate(rec); }
		if (typeof window !== "undefined" && window.EdenTraits && typeof window.EdenTraits.syncRecord === "function") {
			/* 签名见 eden-cheats.js:168 syncRecord(record, child, String(id), v) */
			window.EdenTraits.syncRecord(rec, child, String(id), mbCEFertKidVars());
			return mbCEFertKidCurInnate(rec);
		}
	} catch (e) { /* 同步失败按当前值处理 */ }
	return mbCEFertKidCurInnate(rec);
}
/* 合并优先级：用户填的值 > 记录当前值；空串视为「不改」，避免误清 0 */
function mbCEFertKidMerge4(base, keys, supplied, integer) {
	var out = {}, bad = "";
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i];
		var s = supplied ? supplied[k] : undefined;
		var use = (s !== undefined && s !== null && String(s).trim() !== "") ? s : base[k];
		var n = Number(String(use === undefined || use === null ? "" : use).trim());
		if (!Number.isFinite(n) || n < 0 || n > 100) { bad = k + "=" + use; break; }
		if (integer && !Number.isInteger(n)) { bad = k + "=" + use + "（需整数）"; break; }
		out[k] = n;
	}
	return bad ? { ok: false, message: "数值需为 0–100" + (integer ? " 的整数" : "") + "：" + bad } : { ok: true, vals: out };
}
/* 留痕（与好感/地点同一通道，回退语义一致：保留首次 before） */
function mbCEFertKidMark(id, op, before, after, via, path) {
	try {
		var V = getV();
		if (!V) { return; }
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		var key = "cheat:fertility-expansion:" + op + "_" + id;
		var prev = V.mbCE_wrote[key];
		V.mbCE_wrote[key] = {
			type: "cheat", modId: "fertility-expansion", op: op, path: path || ("eden.children." + id), childId: String(id),
			before: (prev && "before" in prev) ? prev.before : before, after: after, via: via, t: Date.now()
		};
		if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
	} catch (e) { /* 留痕失败不影响写入 */ }
}
function mbCEFertKidSaveSkills(id, vals) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	if (!child || !rec) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	if (mbCEFertKidPhase(child) !== "born") { return { ok: false, message: "孩子还没出生，养育属性只在出生后可写" }; }
	var before = mbCEFertKidEnsureSkills(rec, child);
	var merged = mbCEFertKidMerge4(before, MB_CE_FERT_KID_SKILLS, vals, false);
	if (!merged.ok) { return merged; }
	var full = /** @type {any} */ (merged.vals), res = null, via = "direct";
	var api = mbCEFertApi();
	if (api && typeof api.saveSkills === "function") {
		try { res = api.saveSkills(String(id), full); if (res && res.ok === true) { via = "EdenCheats.saveSkills"; } } catch (e) { res = null; }
	}
	if (!res || res.ok !== true) {
		try {
			if (!rec.training || typeof rec.training !== "object" || Array.isArray(rec.training)) { rec.training = {}; }
			if (!rec.training.skills || typeof rec.training.skills !== "object" || Array.isArray(rec.training.skills)) { rec.training.skills = {}; }
			Object.assign(rec.training.skills, full);
		} catch (e2) { return { ok: false, message: "写入养育属性失败：" + mbCEErr(e2) }; }
	}
	mbCEFertKidMark(id, "fert_child_skills", before, full, via, "eden.children." + id + ".training.skills");
	return { ok: true, message: "已写入养育属性 " + MB_CE_FERT_KID_SKILLS.map(function (k) { return k + "=" + full[k]; }).join(" / ") + "（" + via + "）" };
}
function mbCEFertKidSaveInnate(id, vals) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	if (!child || !rec) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	if (mbCEFertKidPhase(child) !== "born") { return { ok: false, message: "孩子还没出生，先天属性只在出生后可写" }; }
	var before = mbCEFertKidEnsureInnate(rec, child, id);
	var merged = mbCEFertKidMerge4(before, MB_CE_FERT_KID_INNATE, vals, true);
	if (!merged.ok) { return merged; }
	var full = /** @type {any} */ (merged.vals), res = null, via = "direct";
	var api = mbCEFertApi();
	if (api && typeof api.saveInnate === "function") {
		/* 只给四项先天；身份九项由模组用 patch[key] ?? before[key] 自动沿用，不会被打乱 */
		try { res = api.saveInnate(String(id), full); if (res && res.ok === true) { via = "EdenCheats.saveInnate"; } } catch (e) { res = null; }
	}
	if (!res || res.ok !== true) {
		try {
			if (!rec.innate || typeof rec.innate !== "object" || Array.isArray(rec.innate)) { rec.innate = {}; }
			Object.assign(rec.innate, full);
			/* 与模组 eden-cheats.js:178 同一判据：temperament<=50 为 quiet，否则 active；仅在该字段已存在时跟随 */
			if (rec.innate.personality !== undefined) { rec.innate.personality = full.temperament <= 50 ? "quiet" : "active"; }
		} catch (e2) { return { ok: false, message: "写入先天属性失败：" + mbCEErr(e2) }; }
	}
	mbCEFertKidMark(id, "fert_child_innate", before, full, via, "eden.children." + id + ".innate");
	return { ok: true, message: "已写入先天属性 " + MB_CE_FERT_KID_INNATE.map(function (k) { return k + "=" + full[k]; }).join(" / ") + "（" + via + "）" };
}
