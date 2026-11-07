/* ============ v2.0.0.002：模组页「命令式动作」分组渲染（从 05a 拆出，守住单文件 ≤400 行） ============
   用途：适配器可以声明 actions（自己的"一键"按钮），或用 actionPanel 整体接管一组渲染。
   首个使用者是 FertilityExpansion：它自带 eden-cheats-ui.js（10 项作弊），CE 直接调用其
   window.EdenCheats 复刻同一套能力（04a-14-fert-cheats.js），不重写模组的 sync/回滚链。
   行构建沿用模组页既有懒渲染协议：grpFor 建组 → g.pending 存返回节点的函数 → 展开时 buildModGrpRows 补建。 */
function mbCEActionRow(m, a) {
	var row = el("div", "mce-row");
	row.setAttribute("data-mce-key", "action:" + a.key);
	row.appendChild(el("span", "mce-row-lbl", a.name));
	var b = el("button", "mce-btn mce-gold", "执行");
	b.type = "button";
	b.title = a.note || "";
	b.addEventListener("click", function () {
		var res;
		try {
			res = (typeof a.run === "function") ? a.run({}) : { ok: false, message: "该动作未实现" };
		} catch (e) { res = { ok: false, message: "动作抛出异常：" + mbCEErr(e) }; }
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
	});
	row.appendChild(b);
	if (a.note) { row.appendChild(el("span", "mce-hint", a.note)); }
	return row;
}
function renderCheatActions(m, grpFor, buildModGrpRows) {
	var list = Array.isArray(m.actions) ? m.actions : [];
	if (!list.length && typeof m.actionPanel !== "function") { return; }
	var g = grpFor("actions", "命令式动作（模组自带作弊等价）");
	if (typeof m.actionPanel === "function") {
		/* 适配器自带完整面板：面板里已有全部动作入口，不再重复铺一行一个按钮 */
		g.pending.push(function () {
			var box = el("div", "mce-col");
			try { m.actionPanel(box, m); } catch (e) { box.appendChild(el("div", "mce-err", "动作面板渲染失败：" + mbCEErr(e))); }
			return box;
		});
		g.count += 1;
		return;
	}
	list.forEach(function (a) {
		if (!a || !a.key) { return; }
		g.pending.push(function () { return mbCEActionRow(m, a); });
		g.count += 1;
	});
}
