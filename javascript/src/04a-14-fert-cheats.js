/* ============ v2.0.0.002 需求④：FertilityExpansion 自带作弊的等价实现 ============
   模组自带作弊的原始清单（逐字读自 _modcache\fert_tmp\...\modules\eden-cheats.js + eden-cheats-ui.js，
   1.7.0，非二手转述）：window.EdenCheats = { available, labour, parasites, children, choices, identity,
   saveInnate, saveSkills, reset, resetReason, adultReason, settleAdult, removeChild }
   面板三块（eden-cheats-ui.js 挂在原版作弊页 #overlayTabs 的一个页签）：
     A 怀孕作弊扩展：一键分娩 / 寄生卵一键受精 / 寄生物一键成熟
     B 生育作弊扩展（单个已出生孩子）：先天四项 appearance/fitness/intelligence/temperament（0-100 整数）
       + 身份九项 species / monster / beastTransform / divineTransform / gender / size / hairColour /
         eyeColour / skinColour
     C 养育作弊扩展：knowledge / fitness / social / awareness（0-100）+ 重置养育进度 / 立刻成年结算 / 删除孩子
   本文件直接复用模组自己的 API（不重写它的 sync 链），因此行为与门控（guard/rollback/feats.locked）
   与模组面板完全一致；模组未装或 API 缺失时优雅降级为不可用提示。 */
var MB_CE_FERT_ACTIONS = [
	{ key: "fert_labour", name: "一键分娩（孕期推进到足月破水）", note: "调 EdenCheats.labour()，随后需继续原版生产流程", needsChild: false },
	{ key: "fert_parasite_fert", name: "寄生卵一键受精", note: "给未受精寄生卵置 fertilised 并满 daysLeft", needsChild: false },
	{ key: "fert_parasite_ripe", name: "寄生物一键成熟", note: "把已受精寄生物的 daysLeft 置 0", needsChild: false },
	{ key: "fert_innate", name: "保存先天属性与外貌（四项 + 身份九项）", note: "等价模组 saveInnate；改种族/性别受孕期与成年结算门控", needsChild: true },
	{ key: "fert_skills", name: "保存养育属性（knowledge/fitness/social/awareness）", note: "等价模组 saveSkills", needsChild: true },
	{ key: "fert_reset", name: "重置养育进度", note: "清年龄/养成/日程/成年 LLM 与孕期数据，地点回 eden_home", needsChild: true },
	{ key: "fert_adult", name: "立刻成年结算", note: "forcedAdult=true，按已保存属性结算，不补收益", needsChild: true },
	{ key: "fert_remove", name: "删除孩子（不可恢复）", note: "等价模组 removeChild", needsChild: true },
	{ key: "fert_reset_reason", name: "查询重置前置（为何不可重置）", note: "只读：等价模组 resetReason", needsChild: true },
	{ key: "fert_adult_reason", name: "查询成年前置（为何不可结算）", note: "只读：等价模组 adultReason", needsChild: true }
];
var MB_CE_FERT_INNATE_KEYS = ["appearance", "fitness", "intelligence", "temperament"];
var MB_CE_FERT_SKILL_KEYS = ["knowledge", "fitness", "social", "awareness"];
var MB_CE_FERT_ID_KEYS = ["species", "monster", "beastTransform", "divineTransform", "gender", "size", "hairColour", "eyeColour", "skinColour"];
function mbCEFertApi() {
	try { return (typeof window !== "undefined" && window.EdenCheats) ? window.EdenCheats : null; } catch (e) { return null; }
}
function mbCEFertReady() {
	var api = mbCEFertApi();
	if (!api) { return { ok: false, message: "未检测到 window.EdenCheats（FertilityExpansion 未加载或版本不含自带作弊）" }; }
	try {
		if (typeof api.available === "function" && !api.available()) {
			return { ok: false, message: "模组要求先开启原版作弊页（cheatsEnabled / 原版 Cheats 面板处于打开状态）" };
		}
	} catch (e) { return { ok: false, message: "模组前置检查失败：" + (e && e.message ? e.message : e) }; }
	return { ok: true };
}
function mbCEFertChildren() {
	var api = mbCEFertApi();
	if (!api || typeof api.children !== "function") { return []; }
	try { return api.children("") || []; } catch (e) { return []; }
}
function mbCEFertRecord(id) {
	try {
		var V = getV();
		return (V && V.eden && V.eden.children && V.eden.children[id]) ? V.eden.children[id] : null;
	} catch (e) { return null; }
}
function mbCEFertChildLabel(entry) {
	var id = String(entry[0]), child = entry[1] || {};
	return "#" + id + " " + (child.name || "未命名") + "（" + (child.gender === "f" ? "女" : child.gender === "m" ? "男" : child.gender || "?") + "）";
}
/* 统一执行入口：所有动作都走模组 API，返回模组给出的 { ok, message } */
function mbCEFertRun(key, id, patch) {
	var r = mbCEFertReady();
	if (!r.ok) { return r; }
	var api = mbCEFertApi();
	try {
		if (key === "fert_labour") { return api.labour() || { ok: true, message: "已执行" }; }
		if (key === "fert_parasite_fert") { return api.parasites(true) || { ok: true, message: "已执行" }; }
		if (key === "fert_parasite_ripe") { return api.parasites(false) || { ok: true, message: "已执行" }; }
		if (!id) { return { ok: false, message: "请先选择一个已出生的孩子" }; }
		if (key === "fert_innate") { return api.saveInnate(id, patch || {}) || { ok: true, message: "已执行" }; }
		if (key === "fert_skills") { return api.saveSkills(id, patch || {}) || { ok: true, message: "已执行" }; }
		if (key === "fert_reset") { return api.reset(id) || { ok: true, message: "已执行" }; }
		if (key === "fert_adult") { return api.settleAdult(id) || { ok: true, message: "已执行" }; }
		if (key === "fert_remove") { return api.removeChild(id) || { ok: true, message: "已执行" }; }
		if (key === "fert_reset_reason") {
			var rr = api.resetReason(id);
			return { ok: true, message: rr ? ("不可重置：" + rr) : "可以重置（无阻塞前置）" };
		}
		if (key === "fert_adult_reason") {
			var ar = api.adultReason(id);
			return { ok: true, message: ar ? ("不可成年结算：" + ar) : "可以成年结算（无阻塞前置）" };
		}
		return { ok: false, message: "未知动作：" + key };
	} catch (e) { return { ok: false, message: "模组 API 抛出异常：" + (e && e.message ? e.message : e) }; }
}
/* 面板：孩子下拉 + 10 项动作（先天/养成需要填表，其余一键） */
function mbCEFertRender(container) {
	if (!container) { return; }
	var ready = mbCEFertReady();
	container.appendChild(el("div", "mce-hint",
		"直接调用模组自带的 window.EdenCheats（等价 eden-cheats-ui 的全部 10 项），门控、快照回滚与 feats.locked 语义与模组一致。"));
	if (!ready.ok) { container.appendChild(el("div", "mce-err", ready.message)); return; }
	var list = mbCEFertChildren();
	var sel = el("select", "mce-inp");
	list.forEach(function (entry) { var o = el("option", "", mbCEFertChildLabel(entry)); o.value = String(entry[0]); sel.appendChild(o); });
	var childRow = el("div", "mce-row");
	childRow.appendChild(el("span", "mce-row-lbl", "目标孩子（" + list.length + " 个已出生）："));
	childRow.appendChild(sel);
	container.appendChild(childRow);
	if (!list.length) { container.appendChild(el("div", "mce-hint", "当前没有已出生的孩子：先天/养成/重置/成年/删除需要先有孩子。")); }
	/* A 怀孕三项：不需要孩子 */
	var groupA = el("div", "mce-row");
	["fert_labour", "fert_parasite_fert", "fert_parasite_ripe"].forEach(function (k) {
		var a = MB_CE_FERT_ACTIONS.filter(function (x) { return x.key === k; })[0];
		var b = el("button", "mce-btn mce-gold", a.name); b.type = "button"; b.title = a.note;
		b.addEventListener("click", function () {
			var res = mbCEFertRun(k, "", null);
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderModCheatDetail("fertility-expansion");
		});
		groupA.appendChild(b);
	});
	container.appendChild(groupA);
	/* B 先天四项 + 身份九项 */
	var innateBox = el("div", "mce-grp");
	var rec0 = list.length ? mbCEFertRecord(String(sel.value)) : null;
	var innate0 = (rec0 && rec0.innate) ? rec0.innate : {};
	var inputs = {};
	function addField(parent, label, key, value) {
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", label + "："));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.value = (value == null) ? "" : String(value);
		inputs[key] = inp;
		row.appendChild(inp);
		parent.appendChild(row);
	}
	container.appendChild(el("div", "mce-hint", "先天属性（0–100 整数）与身份九项：留空按当前值提交（模组会校验可选值）"));
	MB_CE_FERT_INNATE_KEYS.forEach(function (k) { addField(innateBox, "先天 " + k, k, innate0[k]); });
	MB_CE_FERT_ID_KEYS.forEach(function (k) {
		var cur = "";
		try {
			var api = mbCEFertApi();
			if (list.length && api && typeof api.identity === "function") { cur = api.identity(list[0][1])[k] || ""; }
		} catch (e) { cur = ""; }
		addField(innateBox, "身份 " + k, k, cur);
	});
	container.appendChild(innateBox);
	var bInnate = el("button", "mce-btn mce-gold", "保存先天属性与外貌"); bInnate.type = "button";
	bInnate.addEventListener("click", function () {
		var patch = {}, rec = mbCEFertRecord(String(sel.value));
		var innate = (rec && rec.innate) ? rec.innate : {};
		var missing = [];
		MB_CE_FERT_INNATE_KEYS.forEach(function (k) {
			var v = String(inputs[k].value || "").trim();
			if (!v) { if (typeof innate[k] === "number") { patch[k] = innate[k]; } else { missing.push(k); } }
			else { patch[k] = v; }
		});
		if (missing.length) { setStatus("缺少先天属性：" + missing.join(" / ") + "（模组要求四项全填）", "mce-err"); return; }
		var api = mbCEFertApi(), child = null;
		try { child = list.filter(function (e) { return String(e[0]) === String(sel.value); })[0]; } catch (e) { child = null; }
		MB_CE_FERT_ID_KEYS.forEach(function (k) {
			var v = String(inputs[k].value || "").trim();
			if (v) { patch[k] = v; }
			else if (api && child && typeof api.identity === "function") { patch[k] = api.identity(child[1])[k] || ""; }
		});
		if (patch.species === undefined) { patch.species = (child && child[1] && child[1].species) || "human"; }
		if (patch.gender === undefined) { patch.gender = (child && child[1] && child[1].gender) || "f"; }
		var res = mbCEFertRun("fert_innate", String(sel.value), patch);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		renderModCheatDetail("fertility-expansion");
	});
	container.appendChild(bInnate);
	/* C 养成四项 + 三个二次确认动作 */
	var skillBox = el("div", "mce-grp");
	var training = (rec0 && rec0.training && rec0.training.skills) ? rec0.training.skills : {};
	MB_CE_FERT_SKILL_KEYS.forEach(function (k) { addField(skillBox, "养成 " + k, k, training[k]); });
	container.appendChild(skillBox);
	var bSkills = el("button", "mce-btn mce-gold", "保存养育属性"); bSkills.type = "button";
	bSkills.addEventListener("click", function () {
		var patch = {}, missing = [];
		MB_CE_FERT_SKILL_KEYS.forEach(function (k) {
			var v = String(inputs[k].value || "").trim();
			if (!v) { if (typeof training[k] === "number") { patch[k] = training[k]; } else { missing.push(k); } }
			else { patch[k] = v; }
		});
		if (missing.length) { setStatus("缺少养成属性：" + missing.join(" / ") + "（模组要求四项全填）", "mce-err"); return; }
		var res = mbCEFertRun("fert_skills", String(sel.value), patch);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		renderModCheatDetail("fertility-expansion");
	});
	container.appendChild(bSkills);
	var groupC = el("div", "mce-row");
	["fert_reset", "fert_adult", "fert_remove", "fert_reset_reason", "fert_adult_reason"].forEach(function (k) {
		var a = MB_CE_FERT_ACTIONS.filter(function (x) { return x.key === k; })[0];
		var destructive = (k === "fert_reset" || k === "fert_remove");
		var b = el("button", destructive ? "mce-btn" : "mce-btn", a.name); b.type = "button"; b.title = a.note;
		b.addEventListener("click", function () {
			var res = mbCEFertRun(k, String(sel.value), null);
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderModCheatDetail("fertility-expansion");
		});
		groupC.appendChild(b);
	});
	container.appendChild(groupC);
}
/* 挂到已注册的适配器（04a-13 先拼接，本文件后拼接 → 此处 entry 一定存在） */
(function () {
	try {
		var ad = CHEAT_ADAPTERS["fertility-expansion"];
		if (!ad || !ad.entry) { return; }
		ad.entry.actions = MB_CE_FERT_ACTIONS.map(function (a) {
			return {
				key: a.key, name: a.name, note: a.note, needsChild: !!a.needsChild,
				run: function (arg) { return mbCEFertRun(a.key, arg && arg.id ? arg.id : "", arg && arg.patch ? arg.patch : null); }
			};
		});
		ad.entry.actionPanel = mbCEFertRender;
	} catch (e) { /* 适配器未注册时静默 */ }
})();
