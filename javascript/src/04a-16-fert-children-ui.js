/* 职责：FertilityExpansion 孩子页 UI —— 单孩子卡片 + 整块渲染 + 挂载到适配器面板 */
// v2.0.0.002 需求①③（续）：FertilityExpansion 孩子页 UI 层（由 04a-15 拆出，单文件 ≤400 行门禁）
// 构建按文件名升序拼接，两层同处一个作用域，可直接互调。
// 符号：mbCEFertKidCard（单孩子卡片）/ mbCEFertRenderChildren（整块孩子页）/ 尾部 IIFE 把本页挂到适配器面板最下面。
/* 单个孩子的卡片 */
function mbCEFertKidCard(info, refresh) {
	var box = el("div", "mce-grp");
	var head = el("div", MCE_CLS.row);
	var title = el("span", MCE_CLS.rowLbl, "孩子 #" + info.id + " " + info.name
		+ (info.gender === "f" ? "（女）" : info.gender === "m" ? "（男）" : ""));
	head.appendChild(title);
	box.appendChild(head);
	if (!info.alive || info.phase === "missing") {
		box.appendChild(el("div", MCE_CLS.err, "该孩子已不存在（模组侧已删除或已移除），列表已自动刷新；这里不再提供按钮，避免写入已删数据。"));
		return box;
	}
	var line = "地点：" + mbCEFertKidLocLabel(info.location)
		+ " · " + (info.lifeStageLabel || info.lifeStage || "阶段未知")
		+ " · " + mbCEFertKidAgeText(info)
		+ (info.species ? (" · " + info.species) : "")
		+ " · 养育状态：" + (MB_CE_FERT_KID_STATUS[info.status] || info.status || "未知")
		+ " · " + (info.settled ? ("未来已结算（" + (info.outcome || "?") + "）") : "未来未结算");
	box.appendChild(el("div", MCE_CLS.hint, line));
	/* 好感（爱意） */
	var affRow = el("div", MCE_CLS.row);
	affRow.appendChild(el("span", MCE_CLS.rowLbl, "好感/爱意（0–100）："));
	var affInp = el("input", MCE_CLS.inp);
	affInp.type = "text";
	affInp.value = (info.affection === null) ? "" : String(info.affection);
	affRow.appendChild(affInp);
	var affBtn = el("button", "mce-btn mce-gold", "写好感");
	affBtn.type = "button";
	affBtn.title = "写 V.eden.children." + info.id + ".affection（模组 eden-adult.js 用该值判定亲疏/汇款/亲密难度）";
	affBtn.addEventListener("click", function () {
		var res = mbCEFertKidSetAffection(info.id, String(affInp.value || "").trim());
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	affRow.appendChild(affBtn);
	var affHint = el("button", MCE_CLS.btn, "好感拉满");
	affHint.type = "button";
	affHint.addEventListener("click", function () {
		var res = mbCEFertKidSetAffection(info.id, 100);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	affRow.appendChild(affHint);
	box.appendChild(affRow);
	/* 养育四项（模组 EdenCheats.saveSkills：knowledge/fitness/social/awareness，0–100）。
	   模组要求四项齐全（缺项抛错），这里留空即沿用当前值，不会被清零。 */
	var skNow = (info.training && typeof info.training === "object") ? info.training : {};
	var SK_CN = { knowledge: "知识", fitness: "体能", social: "社交", awareness: "意识" };
	var skRow = el("div", MCE_CLS.row);
	skRow.appendChild(el("span", MCE_CLS.rowLbl, "养育四项："));
	var skInp = {};
	MB_CE_FERT_KID_SKILLS.forEach(function (k) {
		skRow.appendChild(el("span", MCE_CLS.rowLbl, SK_CN[k] + " "));
		var i2 = el("input", MCE_CLS.inp);
		i2.type = "text";
		i2.value = (skNow[k] === undefined || skNow[k] === null) ? "" : String(skNow[k]);
		i2.title = "V.eden.children." + info.id + ".training.skills." + k + "（0–100，留空=不改）";
		skRow.appendChild(i2);
		skInp[k] = i2;
	});
	var skBtn = el("button", "mce-btn mce-gold", "写养育");
	skBtn.type = "button";
	skBtn.title = "调 EdenCheats.saveSkills（四项必须齐全；留空的项沿用当前值）";
	skBtn.addEventListener("click", function () {
		var patch = {};
		MB_CE_FERT_KID_SKILLS.forEach(function (k) { patch[k] = String(skInp[k].value || "").trim(); });
		var res = mbCEFertKidSaveSkills(info.id, patch);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	skRow.appendChild(skBtn);
	box.appendChild(skRow);
	/* 先天四项（模组 EdenCheats.saveInnate：appearance/fitness/intelligence/temperament，0–100 整数） */
	var inNow = (info.innate && typeof info.innate === "object") ? info.innate : {};
	var IN_CN = { appearance: "外貌", fitness: "体质", intelligence: "智力", temperament: "性格" };
	var inRow = el("div", MCE_CLS.row);
	inRow.appendChild(el("span", MCE_CLS.rowLbl, "先天四项："));
	var inInp = {};
	MB_CE_FERT_KID_INNATE.forEach(function (k) {
		inRow.appendChild(el("span", MCE_CLS.rowLbl, IN_CN[k] + " "));
		var i3 = el("input", MCE_CLS.inp);
		i3.type = "text";
		i3.value = (inNow[k] === undefined || inNow[k] === null) ? "" : String(inNow[k]);
		i3.title = "V.eden.children." + info.id + ".innate." + k + "（0–100 整数，留空=不改）";
		inRow.appendChild(i3);
		inInp[k] = i3;
	});
	var inBtn = el("button", "mce-btn mce-gold", "写先天");
	inBtn.type = "button";
	inBtn.title = "调 EdenCheats.saveInnate（四项必须齐全且为整数；身份九项自动沿用现值）";
	inBtn.addEventListener("click", function () {
		var patch = {};
		MB_CE_FERT_KID_INNATE.forEach(function (k) { patch[k] = String(inInp[k].value || "").trim(); });
		var res = mbCEFertKidSaveInnate(info.id, patch);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	inRow.appendChild(inBtn);
	box.appendChild(inRow);
	/* 定向发送 / 随叫随到 */
	var locRow = el("div", MCE_CLS.row);
	locRow.appendChild(el("span", MCE_CLS.rowLbl, "定向发送："));
	var sel = el("select", MCE_CLS.inp);
	MB_CE_FERT_KID_LOCS.forEach(function (o) {
		var op = el("option", "", o.label);
		op.value = o.key;
		if (o.key === info.location) { op.selected = true; }
		sel.appendChild(op);
	});
	locRow.appendChild(sel);
	var locInp = el("input", MCE_CLS.inp);
	locInp.type = "text";
	locInp.placeholder = "自定义地点（留空=用左侧下拉）";
	locInp.title = "模组 location 是自由字符串；只对已出生/已产卵生效";
	locRow.appendChild(locInp);
	var sendBtn = el("button", "mce-btn mce-gold", "发送");
	sendBtn.type = "button";
	sendBtn.title = "写 EdenChildData.setLocation（只对已出生/蛋生效，等价 eden-adult.js 结算里的目的地写入）";
	sendBtn.addEventListener("click", function () {
		var custom = String(locInp.value || "").trim();
		var res = mbCEFertKidSetLocation(info.id, custom || sel.value);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	locRow.appendChild(sendBtn);
	var callBtn = el("button", MCE_CLS.btn, "随叫随到");
	callBtn.type = "button";
	callBtn.title = "把孩子的居所对齐到玩家当前位置（模组只认 eden_home/home，其余位置退回 eden_home 并提示）";
	callBtn.addEventListener("click", function () {
		var res = mbCEFertKidCallToMe(info.id);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	locRow.appendChild(callBtn);
	box.appendChild(locRow);
	/* 一键长大 / 成年结算 / 删除 */
	var actRow = el("div", MCE_CLS.row);
	var growBtn = el("button", "mce-btn mce-gold", "一键长大");
	growBtn.type = "button";
	growBtn.title = "forcedAdult=true + EdenAge.syncRecord（lifeStage 直接成年，不改未来结算状态）";
	growBtn.addEventListener("click", function () {
		var res = mbCEFertKidGrowUp(info.id, false);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	actRow.appendChild(growBtn);
	var settleBtn = el("button", MCE_CLS.btn, "立刻成年结算");
	settleBtn.type = "button";
	settleBtn.title = "调 EdenCheats.settleAdult：要求已成年 + 已出生 + 在 eden_home + 未结算";
	settleBtn.addEventListener("click", function () {
		var res = mbCEFertRun("fert_adult", info.id, null);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	actRow.appendChild(settleBtn);
	var delBtn = el("button", MCE_CLS.btn, "删除孩子（不可恢复）");
	delBtn.type = "button";
	delBtn.addEventListener("click", function () {
		if (typeof window === "undefined" || typeof window.confirm !== "function") { return; }
		if (!window.confirm("确认删除 #" + info.id + " " + info.name + "？该操作不可恢复（等价模组 removeChild）。")) { return; }
		var res = mbCEFertRun("fert_remove", info.id, null);
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		refresh();
	});
	actRow.appendChild(delBtn);
	box.appendChild(actRow);
	return box;
}
/* 孩子页：适配器面板最下面的一块 */
function mbCEFertRenderChildren(container) {
	if (!container) { return; }
	var refresh = function () {
		try { if (typeof renderModCheatDetail === "function") { renderModCheatDetail("fertility-expansion"); } } catch (e) { /* 刷新失败不影响已写入 */ }
	};
	var pairs = mbCEFertKidPairs();
	var aliveCount = 0;
	container.appendChild(el("div", MCE_CLS.hint, "—— 孩子（FertilityExpansion）—— 板块内每个孩子独立调整；模组侧删掉孩子后这里会实时消失，按钮失效时会明确提示，不写已删数据。"));
	if (!pairs.length) {
		container.appendChild(el("div", MCE_CLS.hint, "当前没有任何孩子记录（V.childRecords / V.children 均为空）。孩子出生后会自动出现在这里。"));
		return;
	}
	var barRow = el("div", MCE_CLS.row);
	barRow.appendChild(el("span", MCE_CLS.rowLbl, "共 " + pairs.length + " 条记录："));
	var growAll = el("button", "mce-btn mce-gold", "全部一键长大");
	growAll.type = "button";
	growAll.addEventListener("click", function () {
		if (typeof window === "undefined" || typeof window.confirm !== "function") { return; }
		if (!window.confirm("把当前 " + pairs.length + " 条孩子记录全部一键长大？")) { return; }
		var okN = 0, failN = 0, skipN = 0;
		pairs.forEach(function (p) {
			var inf;
			try { inf = mbCEFertKidInfo(p[0]); } catch (e) { inf = null; }
			if (!inf || !inf.alive || inf.phase !== "born") { skipN++; return; }
			var r = mbCEFertKidGrowUp(p[0], true);
			if (r.ok) { okN++; } else { failN++; }
		});
		setStatus("批量一键长大：成功 " + okN + " 个，失败 " + failN + " 个"
			+ (skipN ? "，跳过 " + skipN + " 个（未出生/未孵化/已不存在）" : ""), failN ? MCE_CLS.err : MCE_CLS.ok);
		refresh();
	});
	barRow.appendChild(growAll);
	var reloadBtn = el("button", MCE_CLS.btn, "重新检测");
	reloadBtn.type = "button";
	reloadBtn.title = "按 EdenChildData 重新枚举一次（模组侧删/加孩子后手动刷新）";
	reloadBtn.addEventListener("click", function () { refresh(); });
	barRow.appendChild(reloadBtn);
	container.appendChild(barRow);
	pairs.forEach(function (p) {
		var info;
		try { info = mbCEFertKidInfo(p[0]); } catch (e) { info = null; }
		if (!info) {
			container.appendChild(el("div", MCE_CLS.err, "孩子 #" + p[0] + " 读取失败（数据结构异常），已跳过。"));
			return;
		}
		if (info.alive) { aliveCount++; }
		container.appendChild(mbCEFertKidCard(info, refresh));
	});
	if (aliveCount !== pairs.length) {
		container.appendChild(el("div", MCE_CLS.hint, "（" + (pairs.length - aliveCount) + " 条记录已不在存活列表中，可能刚被模组侧删除；重新打开面板会彻底消失。）"));
	}
}
/* 在 04a-14 的 actionPanel 之后追加孩子页：适配器面板最下面就是孩子 */
(function () {
	try {
		var ad = (typeof CHEAT_ADAPTERS !== "undefined") ? CHEAT_ADAPTERS["fertility-expansion"] : null;
		if (!ad || !ad.entry) { return; }
		var base = ad.entry.actionPanel;
		if (typeof base !== "function") { return; }
		if (base.__mbCEHasKids) { return; }
		ad.entry.actionPanel = function (container) {
			base(container);
			mbCEFertRenderChildren(container);
		};
		ad.entry.actionPanel.__mbCEHasKids = true;
	} catch (e) { /* 适配器未注册时静默 */ }
})();
