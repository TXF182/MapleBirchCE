/* 职责：FertilityExpansion 自带作弊的等价实现 —— 代理 window.EdenCheats + 面板三块 */
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
/* v2.1.9 汉化 + 指向明确：中文名与取值文案全部逐字取自模组自带 UI / 源码，不是转述。
   中文名出处 eden-cheats-ui.js:151（先天四项）、:157（身份九项）；
   值域出处 eden-cheats.js:138-147 choices()（species / gender / monster / beastTransform /
   divineTransform / size / skinColour 为硬编码），hairColour / eyeColour / size 的默认项来自原版
   PregnancyConstants.genePool（game HTML 偏移 15631738：hairColour / eyeColour / wolfFur / hawkFeather / childSize）。
   为什么要建这两张表：模组 saveInnate 对身份九项逐 key 校验
   `value !== before[key] && !options[key].includes(value)` → 抛「请选择支持的种族或外貌。」（eden-cheats.js:158）。
   旧版 CE 用纯文本框，玩家只能凭猜英文值，填错即报错且没有提示；改成下拉后选项与模组同源，值不可能越界。 */
var MB_CE_FERT_LABELS = {
	appearance: "容貌", fitness: "体格", intelligence: "智力", temperament: "性格倾向",
	knowledge: "知识", social: "社交", awareness: "警觉",
	species: "基础种族", monster: "人形特征", beastTransform: "兽化特征",
	divineTransform: "神圣特征", gender: "生理性别", size: "体型",
	hairColour: "发色／毛色", eyeColour: "瞳色", skinColour: "肤色"
};
var MB_CE_FERT_VAL_CN = {
	species: { human: "人类", wolf: "狼", hawk: "鹰" },
	gender: { m: "男", f: "女", h: "间性" },
	monster: { monster: "人形特征" },
	beastTransform: { bird: "鸟", cat: "猫", fox: "狐", wolf: "狼", cow: "牛" },
	divineTransform: { angel: "天使", fallen: "堕落", demon: "恶魔" },
	size: { tiny: "极小", small: "小", normal: "正常", large: "大" },
	skinColour: { light: "白", medium: "中", dark: "深", gyaru: "辣妹", ylight: "偏黄白", ymedium: "偏黄中", ydark: "偏黄深", ygyaru: "偏黄辣妹", ghostlyPale: "苍白" },
	hairColour: { red: "红", jetblack: "乌黑", black: "黑", brown: "棕", softbrown: "浅棕", lightbrown: "淡棕", burntorange: "焦橙", blond: "金", softblond: "浅金", platinumblond: "铂金", ashyblond: "灰金", strawberryblond: "草莓金", ginger: "姜红", "dark brown": "深棕", grey: "灰", white: "白", tan: "黄褐" },
	eyeColour: { purple: "紫", "dark blue": "深蓝", "light blue": "浅蓝", amber: "琥珀", hazel: "榛", green: "绿", "lime green": "青柠绿", red: "红", pink: "粉", grey: "灰", "light grey": "浅灰" }
};
/* 「保持当前值」哨兵。不能用空串兼作「不改」：monster / beastTransform / divineTransform 的合法值本身
   就含空串（语义是「无」），两者撞车会导致「选了无」被当成「没动」。 */
var MB_CE_FERT_KEEP = "__mce_keep";
function mbCEFertLabel(k) { return MB_CE_FERT_LABELS[k] || k; }
function mbCEFertValText(k, v) {
	if (!v) { return "（无）"; }
	var cn = MB_CE_FERT_VAL_CN[k];
	return (cn && cn[v]) ? (cn[v] + "（" + v + "）") : String(v);
}
/* 选项优先取模组自身 choices()（发色/瞳色/体型随原版 genePool 动态），取不到时退化为静态表键集，
   保证下拉恒有值可选 —— API 缺失只影响精度，不让整块不可用。 */
function mbCEFertOptions(k, api, child) {
	var arr = null;
	try { if (api && child && typeof api.choices === "function") { arr = api.choices(child)[k]; } } catch (e) { arr = null; }
	if (!arr || !arr.length) { var cn = MB_CE_FERT_VAL_CN[k]; arr = cn ? Object.keys(cn) : []; }
	return arr;
}
/* 身份单行：下拉 + 首项「保持当前值」。当前值不在选项里（旧版本遗留值）时补一条，
   否则 select 会静默落到第一个选项，玩家一保存就把值改掉。 */
function mbCEFertIdRow(parent, k, cur, opt) {
	var row = el("div", MCE_CLS.row);
	row.setAttribute("data-mce-key", "fert.id:" + k);
	row.appendChild(el("span", MCE_CLS.rowLbl, mbCEFertLabel(k) + "（" + k + "）："));
	var sel2 = el("select", "mce-sel");
	var keep = el("option", "", "（保持当前值）"); keep.value = MB_CE_FERT_KEEP; sel2.appendChild(keep);
	var has = false;
	opt.forEach(function (v) {
		var o = el("option", "", mbCEFertValText(k, v)); o.value = String(v);
		if (String(v) === String(cur)) { has = true; }
		sel2.appendChild(o);
	});
	if (!has && cur) { var co = el("option", "", mbCEFertValText(k, cur) + " · 当前值不在模组选项内"); co.value = String(cur); sel2.appendChild(co); }
	sel2.value = cur ? String(cur) : MB_CE_FERT_KEEP;
	row.appendChild(sel2);
	parent.appendChild(row);
	return sel2;
}
function mbCEFertApi() {
	try { return (typeof window !== "undefined" && window.EdenCheats) ? window.EdenCheats : null; } catch (e) { return null; }
}
/* v2.1.9：输入框登记表。键必须按域区分 —— 先天 fitness 与养育 fitness 同名，旧版共用 inputs[k]
   会被后渲染的那份覆盖，保存先天时读到的其实是养育输入框（先天体格被静默写错值）。
   每次渲染重建，域前缀：先天 in_ / 身份 id_ / 养育 sk_。 */
var mbCEFertInputs = null;
function mbCEFertAddField(parent, label, key, value, dictKey) {
	var row = el("div", MCE_CLS.row);
	row.setAttribute("data-mce-key", "fert.field:" + (dictKey || key));
	row.appendChild(el("span", MCE_CLS.rowLbl, label + "："));
	var inp = el("input", MCE_CLS.inp);
	inp.type = "text"; inp.value = (value == null) ? "" : String(value); inp.placeholder = "0-100 整数";
	mbCEFertInputs[dictKey || key] = inp;
	row.appendChild(inp);
	parent.appendChild(row);
	return inp;
}
/* v2.0.0.003 需求①：不再要求玩家先开原版作弊页。
   模组侧有两道闸：available()（vars().cheatsEnabled === true 或原版 Cheats 面板 DOM 判据）和
   perform() 里的 guard()（每次动作都 `if (!available()) throw new Error("请先打开原版作弊页。")`，
   _modcache\fert_tmp\...\modules\eden-cheats.js:37-51 逐字实证）。所以仅绕开 CE 侧的自检不够，
   必须在调用它的瞬间让它「看见」cheatsEnabled=true。做法：临时置 V.cheatsEnabled = true，
   调用返回后立即还原原值（原本没有该字段则删除），不污染存档、不触发原版作弊页 UI。
   模组其余安全闸（statFreeze / 战斗中 / 附属 NPC / 生产流程中 / NPCList[0]）仍全部生效。
   置位到还原在同一个同步调用栈内完成（finally 覆盖 throw），SugarCube 的 autosave 只发生在 passage
   导航/显式保存，不会插进这段同步栈 —— 结构性推理，非实机实测；enabled-cheats 全模组只有 1 处读它（:38）。 */
function mbCEFertWithCheats(fn) {
	var V = null, had = false, old;
	try { V = getV(); } catch (e) { V = null; }
	if (!V || typeof V !== "object") { return fn(); }
	had = Object.prototype.hasOwnProperty.call(V, "cheatsEnabled");
	old = V.cheatsEnabled;
	if (old !== true) { try { V.cheatsEnabled = true; } catch (e2) { return fn(); } }
	try {
		return fn();
	} finally {
		try {
			if (old !== true) {
				if (had) { V.cheatsEnabled = old; }
				else { try { delete V.cheatsEnabled; } catch (e3) { /* delete 被拒（Proxy/冻结对象）：退化为 undefined，而非写 false —— false 会在存档里留下与「从未设置」语义不同的假值，undefined 会被 JSON.stringify 丢弃 */ try { V.cheatsEnabled = undefined; } catch (e5) { /* 只能放弃还原 */ } } }
			}
		} catch (e4) { /* 还原失败不影响主流程 */ }
	}
}
function mbCEFertReady() {
	var api = mbCEFertApi();
	if (!api) { return { ok: false, message: "未检测到 window.EdenCheats（FertilityExpansion 未加载或版本不含自带作弊）", bypass: false }; }
	var avail = true;
	try { if (typeof api.available === "function") { avail = !!api.available(); } } catch (e) { avail = false; }
	/* available 只作说明（面板据此展示红字），不再作为不可用门槛 */
	return { ok: true, bypass: !avail };
}
function mbCEFertChildren() {
	var api = mbCEFertApi();
	if (!api || typeof api.children !== "function") { return []; }
	return mbCEFertWithCheats(function () {
		try { return api.children("") || []; } catch (e) { return []; }
	});
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
/* 统一执行入口：所有动作都走模组 API，返回模组给出的 { ok, message }
   v2.0.0.003：整个调用包在 mbCEFertWithCheats 里——模组 guard() 每次动作都查 available()，
   所以临时满足必须覆盖「从进入 perform 到它内部快照/回滚结束」的完整区间。 */
function mbCEFertRun(key, id, patch) {
	var r = mbCEFertReady();
	if (!r.ok) { return r; }
	var api = mbCEFertApi();
	return mbCEFertWithCheats(function () {
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
		} catch (e) { return { ok: false, message: "模组 API 抛出异常：" + mbCEErr(e) }; }
	});
}
/* 面板：孩子下拉 + 10 项动作（先天/养成需要填表，其余一键） */
/* v2.1.9 抽取自 mbCEFertRender（原函数 131 行，超 120 行上限）：先天四项 + 身份九项表单 */
function mbCEFertRenderInnateBox(container, list, sel, rec0) {
	var innateBox = el("div", "mce-grp");
	var innate0 = (rec0 && rec0.innate) ? rec0.innate : {};
	container.appendChild(el("div", MCE_CLS.hint,
		"先天四项：0–100 整数，四项必须齐全（模组自己会拦缺项）；留空按当前值提交。"));
	MB_CE_FERT_INNATE_KEYS.forEach(function (k) { mbCEFertAddField(innateBox, mbCEFertLabel(k) + "（" + k + "）", k, innate0[k], "in_" + k); });
	container.appendChild(innateBox);
	container.appendChild(el("div", MCE_CLS.hint,
		"身份九项：下拉选项直接取模组 EdenCheats.choices()，与模组自带面板同源；选「保持当前值」则该项不提交。"));
	var idBox = el("div", "mce-grp");
	var api0 = mbCEFertApi(), kid0 = list.length ? list[0][1] : null;
	MB_CE_FERT_ID_KEYS.forEach(function (k) {
		var cur = "";
		try { if (kid0 && api0 && typeof api0.identity === "function") { cur = api0.identity(kid0)[k] || ""; } } catch (e) { cur = ""; }
		mbCEFertInputs["id_" + k] = mbCEFertIdRow(idBox, k, cur, mbCEFertOptions(k, api0, kid0));
	});
	container.appendChild(idBox);
	container.appendChild(el("div", MCE_CLS.hint,
		"模组的三条硬规则（eden-cheats.js:162/164/165，违反会被它直接拒绝）：① 基础种族选「人类」时，模组自动清空「人形特征」——猫/狐/牛用人类 + 兽化特征，狼/鹰可再选人形特征；② 该角色孕期未结束，不能改种族 / 人形特征 / 兽化特征 / 生理性别；③ 已成年结算的角色，不能再改成动物形态。"));
	var bInnate = el("button", "mce-btn mce-gold", "保存先天属性与外貌"); bInnate.type = "button";
	bInnate.addEventListener("click", function () {
		var patch = {}, rec = mbCEFertRecord(String(sel.value));
		var innate = (rec && rec.innate) ? rec.innate : {};
		var missing = [];
		MB_CE_FERT_INNATE_KEYS.forEach(function (k) {
			var v = String(mbCEFertInputs["in_" + k].value || "").trim();
			if (!v) { if (typeof innate[k] === "number") { patch[k] = innate[k]; } else { missing.push(mbCEFertLabel(k) + "（" + k + "）"); } }
			else { patch[k] = v; }
		});
		if (missing.length) { setStatus("缺少先天属性：" + missing.join(" / ") + "（模组要求四项全填）", MCE_CLS.err); return; }
		var child = null;
		try { child = list.filter(function (e) { return String(e[0]) === String(sel.value); })[0]; } catch (e) { child = null; }
		/* 「保持当前值」= 该项不进 patch：模组用 `patch[key] ?? before[key]` 自动沿用，避免 CE 补值补出与模组不一致的枚举。 */
		MB_CE_FERT_ID_KEYS.forEach(function (k) {
			var v = String(mbCEFertInputs["id_" + k].value == null ? "" : mbCEFertInputs["id_" + k].value);
			/* 空串是 monster / beastTransform / divineTransform 的合法值（语义「无」），必须照传；
			   只有哨兵才算「不改」。species 等 key 的选项集本身不含空串，不会产出空值。 */
			if (v !== MB_CE_FERT_KEEP) { patch[k] = v; }
		});
		if (patch.species === undefined) { patch.species = (child && child[1] && child[1].species) || "human"; }
		if (patch.gender === undefined) { patch.gender = (child && child[1] && child[1].gender) || "f"; }
		var res = mbCEFertRun("fert_innate", String(sel.value), patch);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		renderModCheatDetail("fertility-expansion");
	});
	container.appendChild(bInnate);
}

function mbCEFertRender(container) {
	if (!container) { return; }
	var ready = mbCEFertReady();
	container.appendChild(el("div", MCE_CLS.hint,
		"直接调用模组自带的 window.EdenCheats（等价 eden-cheats-ui 的全部 10 项），门控、快照回滚与 feats.locked 语义与模组一致。"));
	/* v2.0.0.003 需求①：这行红字是模组自己的原始提示，原文保留不动，只在后面接一句「我不同意」。
	   用户 2026-11-07 明确要求保留原文（不是删掉），红字照旧显示，功能不再受它限制。 */
	container.appendChild(el("div", MCE_CLS.err,
		"模组要求先开启原版作弊页（cheatsEnabled / 原版 Cheats 面板处于打开状态）—— 我不同意。"));
	/* API 缺失时才早退：此时不能断言「你已经开着原版作弊页」（那会把缺 API 说成已开启） */
	if (!ready.ok) { container.appendChild(el("div", MCE_CLS.hint, ready.message)); return; }
	container.appendChild(el("div", MCE_CLS.hint,
		ready.bypass
			? "模组当前判为「未开启原版作弊页」：CE 每次调用时临时把 cheatsEnabled 置真满足它，返回后立刻还原原值，你不用真去开原版作弊页。"
			: "你已经开着原版作弊页；即便不开，CE 也会在调用期间临时满足该前置，用完还原。"));
	var list = mbCEFertChildren();
	var sel = el("select", "mce-sel");
	list.forEach(function (entry) { var o = el("option", "", mbCEFertChildLabel(entry)); o.value = String(entry[0]); sel.appendChild(o); });
	if (list.length) { sel.value = String(list[0][0]); }
	var childRow = el("div", MCE_CLS.row);
	childRow.appendChild(el("span", MCE_CLS.rowLbl, "目标孩子（" + list.length + " 个已出生）："));
	childRow.appendChild(sel);
	container.appendChild(childRow);
	if (!list.length) { container.appendChild(el("div", MCE_CLS.hint, "当前没有已出生的孩子：先天/养成/重置/成年/删除需要先有孩子。")); }
	/* A 怀孕三项：不需要孩子 */
	var groupA = el("div", MCE_CLS.row);
	["fert_labour", "fert_parasite_fert", "fert_parasite_ripe"].forEach(function (k) {
		var a = MB_CE_FERT_ACTIONS.filter(function (x) { return x.key === k; })[0];
		var b = el("button", "mce-btn mce-gold", a.name); b.type = "button"; b.title = a.note;
		b.addEventListener("click", function () {
			var res = mbCEFertRun(k, "", null);
			setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
			renderModCheatDetail("fertility-expansion");
		});
		groupA.appendChild(b);
	});
	container.appendChild(groupA);
	/* B 先天四项 + 身份九项（v2.1.9：中文化 + 下拉；表单一并抽函数，避免单函数超 120 行） */
	var rec0 = list.length ? mbCEFertRecord(String(sel.value)) : null;
	mbCEFertInputs = {};
	mbCEFertRenderInnateBox(container, list, sel, rec0);
	/* C 养成四项 + 三个二次确认动作 */
	var skillBox = el("div", "mce-grp");
	var training = (rec0 && rec0.training && rec0.training.skills) ? rec0.training.skills : {};
	MB_CE_FERT_SKILL_KEYS.forEach(function (k) { mbCEFertAddField(skillBox, mbCEFertLabel(k) + "（" + k + "）", k, training[k], "sk_" + k); });
	container.appendChild(skillBox);
	var bSkills = el("button", "mce-btn mce-gold", "保存养育属性"); bSkills.type = "button";
	bSkills.addEventListener("click", function () {
		var patch = {}, missing = [];
		MB_CE_FERT_SKILL_KEYS.forEach(function (k) {
			var v = String(mbCEFertInputs["sk_" + k].value || "").trim();
			if (!v) { if (typeof training[k] === "number") { patch[k] = training[k]; } else { missing.push(mbCEFertLabel(k) + "（" + k + "）"); } }
			else { patch[k] = v; }
		});
		if (missing.length) { setStatus("缺少养成属性：" + missing.join(" / ") + "（模组要求四项全填）", MCE_CLS.err); return; }
		var res = mbCEFertRun("fert_skills", String(sel.value), patch);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		renderModCheatDetail("fertility-expansion");
	});
	container.appendChild(bSkills);
	var groupC = el("div", MCE_CLS.row);
	["fert_reset", "fert_adult", "fert_remove", "fert_reset_reason", "fert_adult_reason"].forEach(function (k) {
		var a = MB_CE_FERT_ACTIONS.filter(function (x) { return x.key === k; })[0];
		var destructive = (k === "fert_reset" || k === "fert_remove");
		var b = el("button", destructive ? MCE_CLS.btn : MCE_CLS.btn, a.name); b.type = "button"; b.title = a.note;
		b.addEventListener("click", function () {
			var res = mbCEFertRun(k, String(sel.value), null);
			setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
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
