/* 性别切换（v1.9.1 新功能：玩家自己页）——原版权威键实证（0.5.12.13 源码，自查轮补全）：
   七键：V.player.sex（"m"/"f"/"h"=herm，生殖器性别权威键，isGenitalMismatch/crossdressing/成就 Being a Boy 均读它）
         V.player.gender（社会性别，"m"/"f"/"h"，新游戏预设 herm=gender"h"）
         V.player.gender_body（身体外观，"m"/"f"/"a"，bimbo/pimp 事件改写；herm 预设为 "a"）
         V.player.penisExist / V.player.vaginaExist / V.player.penissize（0-6，0=N/A；sex=m 时大阴茎阈值 6，否则 4）
         V.player.ballsExist（新游戏预设：男/女 false，双性 true）
   引擎 genderappearancecheck 会由 sex 定期重算 gender_appearance，无需手写。 */
var GENDER_CN = { m: "男", f: "女", h: "双性", a: "双性", unknown: "未知" };
function getPlayerGender(V) {
	try {
		var pl = V.player || {};
		if (pl.sex === "m") { return "m"; }
		if (pl.sex === "f") { return "f"; }
		if (pl.sex === "h") { return "a"; }
		var pe = !!pl.penisExist, ve = !!pl.vaginaExist;
		if (pe && ve) { return "a"; }
		if (pe) { return "m"; }
		if (ve) { return "f"; }
		return "unknown";
	} catch (e) { return "unknown"; }
}
function applyPlayerGender(V, g) {
	try {
		if (!V || typeof V !== "object") { return "FAIL: 存档变量不可用"; }
		if (!V.player || typeof V.player !== "object") { V.player = {}; }
		var out = [];
		if (g === "m") {
			V.player.penisExist = true;
			if (typeof V.player.penissize !== "number" || V.player.penissize < 1) { V.player.penissize = 1; }
			V.player.vaginaExist = false;
			V.player.gender = "m";
			V.player.gender_body = "m";
			V.player.sex = "m";
			V.player.ballsExist = false;
			out.push("penisExist=true", "penissize=" + V.player.penissize, "vaginaExist=false", "gender=m", "gender_body=m", "sex=m", "ballsExist=false");
		} else if (g === "f") {
			V.player.vaginaExist = true;
			V.player.penisExist = false;
			V.player.penissize = 0;
			V.player.gender = "f";
			V.player.gender_body = "f";
			V.player.sex = "f";
			V.player.ballsExist = false;
			out.push("vaginaExist=true", "penisExist=false", "penissize=0", "gender=f", "gender_body=f", "sex=f", "ballsExist=false");
		} else if (g === "a") {
			V.player.penisExist = true;
			if (typeof V.player.penissize !== "number" || V.player.penissize < 1) { V.player.penissize = 1; }
			V.player.vaginaExist = true;
			V.player.gender = "h";
			V.player.gender_body = "a";
			V.player.sex = "h";
			V.player.ballsExist = true;
			out.push("penisExist=true", "penissize=" + V.player.penissize, "vaginaExist=true", "gender=h", "gender_body=a", "sex=h", "ballsExist=true");
		} else {
			return "FAIL: 未知性别 " + g;
		}
		/* 引擎收敛（实测路径=测试路径修复）：原版 gender_appearance 由 exposure()→exposedcheck()
		   在场景更新时重算；切性别后立即触发一次（alwaysRun=true 战斗内也收敛），同场景外观性别立即生效，
		   避免下一场景前 UI/服装分型读到旧值。环境无引擎函数（单测沙箱）时静默跳过，不影响七键结果。 */
		try {
			if (typeof window !== "undefined" && typeof window.exposedcheck === "function") { window.exposedcheck(true); }
		} catch (e) {}
		return out.join(",");
	} catch (e) { return "FAIL: " + (e && e.message ? e.message : e); }
}
function renderGenderBox(pane, V) {
	var g = getPlayerGender(V);
	var box = el("div", "mce-grp");
	box.setAttribute("data-mce-gender", g);
	box.appendChild(el("div", "mce-grp-t", "★ 性别切换（原版键 sex/gender/gender_body/penisExist/vaginaExist/penissize/ballsExist）当前：" + (GENDER_CN[g] || g)));
	var brow = el("div", "mce-row");
	["m", "f", "a"].forEach(function (gv) {
		var b = el("button", g === gv ? "mce-btn-active" : "", (GENDER_CN[gv] || gv) + (g === gv ? " ✓" : ""));
		b.type = "button";
		b.setAttribute("data-gender", gv);
		b.addEventListener("click", function () {
			var res = applyPlayerGender(V, gv);
			var isFail = typeof res === "string" && res.indexOf("FAIL") === 0;
			setStatus(isFail ? res : "性别已切换为「" + (GENDER_CN[gv] || gv) + "」", isFail ? "mce-err" : "mce-ok");
			renderPlayerEdit();
		});
		brow.appendChild(b);
	});
	box.appendChild(brow);
	pane.appendChild(box);
}
function renderPlayerEdit() {
	/* 十巡：渲染时从持久化状态恢复搜索词（搜索框 input 事件已写入 mbCEUiState.filter；
	   此前只写不读，刷新/重开面板后搜索词丢失） */
	curPlayerFilter = (typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.filter) ? String(mbCEUiState.filter) : "";
	var pane = root.querySelector('[data-pane="mods"]');
	if (!pane) { return; }
	var st = pane.scrollTop; /* 五巡：重建后保持滚动位置（快速面板/特质区长列表操作不跳顶） */
	pane.textContent = "";
	var back = el("button", "", "← 返回模组列表");
	back.type = "button";
	back.addEventListener("click", function () { renderModCheats(); });
	pane.appendChild(back);
	pane.appendChild(el("div", "mce-hint", "【玩家自己 · 属性与特质】游戏属性面板数值快捷编辑 + 全部特质管理（含其他模组注入的特质，自动发现）。中文键名仅用于显示，写入仍用原键名。"));
	var frow = el("div", "mce-row");
	frow.appendChild(el("span", "mce-row-lbl", "关键词过滤："));
	var finp = el("input", "mce-inp");
	finp.type = "text";
	finp.value = curPlayerFilter || "";
	finp.addEventListener("input", function () {
		curPlayerFilter = finp.value;
		mbCEUiSave({ filter: finp.value });
		/* v1.8.12 功能13：搜索输入 250ms 防抖，避免逐键全量重建特质区 */
		mceSchedule(renderPlayerEdit, 250, "search");
	});
	frow.appendChild(finp);
	pane.appendChild(frow);
	var qwrap = el("div", "mce-grp");
	qwrap.appendChild(el("div", "mce-grp-t", "★ 游戏属性面板（颜色分级）快捷编辑：直接改面板显示的核心属性/技能/性技能/成绩/武器"));
	renderQuickPanel(qwrap);
	pane.appendChild(qwrap);
	var V = getV();
	if (!V) { pane.appendChild(el("div", "mce-err", "存档变量不可用。")); return; }
	var C = null;
	try { if (typeof C !== "undefined" && C) { C = window.C || C; } } catch (e) {}
	renderGenderBox(pane, V);
	renderTraitsSection(pane, V, C);
	pane.scrollTop = st; /* 五巡：恢复滚动位置 */
}


