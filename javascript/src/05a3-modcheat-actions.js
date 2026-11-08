/* ============ v2.0.0.002：模组页「命令式动作」分组渲染（从 05a 拆出，守住单文件 ≤400 行） ============
   用途：适配器可以声明 actions（自己的"一键"按钮），或用 actionPanel 整体接管一组渲染。
   首个使用者是 FertilityExpansion：它自带 eden-cheats-ui.js（10 项作弊），CE 直接调用其
   window.EdenCheats 复刻同一套能力（04a-14-fert-cheats.js），不重写模组的 sync/回滚链。
   行构建沿用模组页既有懒渲染协议：grpFor 建组 → g.pending 存返回节点的函数 → 展开时 buildModGrpRows 补建。 */

/* 适配器动作的两种声明形态：直接挂在注册项上，或包在 entry 里（04a-*.js 现行写法把 actions 放 entry 内）。 */
function mbCEAdapterList(m) {
	if (!m || typeof m !== "object") { return []; }
	if (Array.isArray(m.actions)) { return m.actions; }
	if (m.entry && Array.isArray(m.entry.actions)) { return m.entry.actions; }
	return [];
}

/* 单条执行路径：面板按钮、直调通道、测试都走这里，错误文案只在这一处产生。 */
function mbCEAdapterRun(m, actionKey, args) {
	var list = mbCEAdapterList(m);
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].key === actionKey) {
			if (typeof list[i].run !== "function") { return { ok: false, message: "该动作未实现：" + actionKey }; }
			try { return list[i].run(args || {}); }
			catch (e) { return { ok: false, message: "动作抛出异常：" + mbCEErr(e) }; }
		}
	}
	return { ok: false, message: "无此动作：" + actionKey };
}

/* 直调通道（面板按钮之外的第二条入口）：按 adapterId + actionKey 从注册表取适配器再执行。
   此前 a.run({}) 只在点击回调里内联调用，测试与外部脚本没有入口，动作分支无法被覆盖。 */
function mbCEAdapterAction(adapterId, actionKey, args) {
	if (!adapterId) { return { ok: false, message: "未指定适配器" }; }
	var reg = (typeof CHEAT_ADAPTERS === "object" && CHEAT_ADAPTERS) ? CHEAT_ADAPTERS : null;
	if (!reg) { return { ok: false, message: "适配器注册表不可用" }; }
	var m = reg[adapterId];
	if (!m) { return { ok: false, message: "未找到适配器：" + adapterId }; }
	return mbCEAdapterRun(m, actionKey, args);
}

function mbCEActionRow(m, a) {
	var row = el("div", "mce-row");
	row.setAttribute("data-mce-key", "action:" + a.key);
	row.appendChild(el("span", "mce-row-lbl", a.name));
	var b = el("button", "mce-btn mce-gold", "执行");
	b.type = "button";
	b.title = a.note || "";
	b.addEventListener("click", function () {
		var res = mbCEAdapterRun(m, a.key, {});
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
	});
	row.appendChild(b);
	if (a.note) { row.appendChild(el("span", "mce-hint", a.note)); }
	return row;
}

function renderCheatActions(m, grpFor, buildModGrpRows) {
	var list = mbCEAdapterList(m);
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
