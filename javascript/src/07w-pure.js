/* 职责：纯净模式（全局页「防护」组）—— 一键暂停 CE 的自动/批量写入通道，用于排除干扰验证原版行为。
 *
 * 为什么需要：回退中心只能「事后撤销」，但数值固定每秒写回、言灵守卫每秒清理、适配器批量写入
 * 这类通道会在玩家不操作时持续改档，排障时无法判断「这个数值是原版给的还是 CE 写的」。
 * 纯净模式 = 一个存档内持久的总开关，开启后上述通道在执行器入口直接拒绝，不写值、不留痕。
 *
 * 覆盖范围（v2.2.8 定稿，口径必须与 UI 文案一致）：
 *   · 04b cheatWriteValue / cheatWriteListValue —— 适配器作弊项
 *   · 05a3 mbCEAdapterRun —— 命令式动作（模组自带一键按钮）
 *   · 07f mbCELockTick —— 数值固定每秒回写
 *   · 07i mbCEYanlingTick + mbCEYanlingRenderBtn —— 异装守卫与言灵手动按钮
 * 不覆盖：原版扩展类面板（档案 / 经济 / 鹰塔 / 食物 / 艾弗里等）的手动单次写入——那些是玩家主动点按、
 * 逐条留痕可回退，不属于「自动改档」；需要绝对干净时不要去点它们即可。
 * 回退通道永不被拦：undoCheatModValue / mbCEUndoOne 等走自己的实现，不经过上述入口。
 *
 * 持久化：V.mbCE_pure = 1/0（存档内，与 mbCE_baileyKeep 同风格），换档各自独立。
 */

function mbCEPureV() {
	try {
		var V = getV();
		return (V && typeof V === "object") ? V : null;
	} catch (e) { return null; }
}

function mbCEPureIsOn() {
	var V = mbCEPureV();
	if (!V) { return false; }
	return V.mbCE_pure === 1 || V.mbCE_pure === true;
}

function mbCEPureSet(on) {
	var V = mbCEPureV();
	if (!V) { return { ok: false, msg: "存档变量不可用（尚未读档）" }; }
	V.mbCE_pure = on ? 1 : 0;
	return {
		ok: true, on: !!on,
		msg: on
			? "纯净模式已开启：适配器写入 / 命令式动作 / 数值固定回写 / 言灵改写将全部拒绝"
			: "纯净模式已关闭：写入通道恢复"
	};
}

/* 写入通道统一门控：null = 放行；对象 = 拒绝（同时给 message 与 msg，兼容两类调用方的字段习惯） */
function mbCEPureBlock(tag) {
	if (!mbCEPureIsOn()) { return null; }
	var t = "纯净模式已开启，写入已拦截（" + (tag || "面板") + "）；如需写入请到「全局 → 防护」关闭纯净模式";
	return { ok: false, blocked: "pure", message: t, msg: t };
}

/* 组合门控（04b / 05a3 共用）：开启时恒返回非空拒绝对象，调用侧只需一个 if，避免在每个热点函数里
   叠加「判开关 + 判函数存在 + 兜文案」多组分支把复杂度推过棘轮（mbCEAdapterRun 实测 11 就是这么做出来的）。 */
function mbCEPureGuard(tag) {
	if (!mbCEPureIsOn()) { return null; }
	return mbCEPureBlock(tag) || { ok: false, blocked: "pure", message: "纯净模式已开启，写入已拦截（" + tag + "）" };
}

/* 全局页「防护」组区块：开关 + 回退并开启 + 范围说明 */
function mbCEPureRender(sec) {
	if (!sec) { return; }
	var on = mbCEPureIsOn();
	var row = el("div", MCE_CLS.row);
	var btn = el("button", MCE_CLS.btn + (on ? " mce-gold" : ""), on ? "纯净模式：已开启（写入已暂停）" : "纯净模式：已关闭");
	btn.type = "button";
	btn.title = on
		? "当前适配器写入 / 命令式动作 / 数值固定回写 / 言灵改写全部拒绝；点此关闭恢复写入"
		: "开启后暂停上述自动与批量写入通道（不写存档、不留痕），用于排除 CE 干扰验证原版行为";
	btn.addEventListener("click", function () {
		var r = mbCEPureSet(!on);
		setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
		renderGlobal();
	});
	row.appendChild(btn);
	sec.appendChild(row);

	var row2 = el("div", MCE_CLS.row);
	var rollBtn = el("button", MCE_CLS.btn, "回退全部 CE 写入并开启纯净模式");
	rollBtn.type = "button";
	rollBtn.title = "先按时间倒序回退所有可回退留痕（审计类自动跳过），再把写入通道切到暂停状态";
	rollBtn.addEventListener("click", function () {
		var undo = mbCEUndoAll();
		var r = mbCEPureSet(true);
		/* 汇总两个结果：回退是主诉求，它的统计在前；开启结果只作补充说明 */
		setStatus(undo.msg + "；" + r.msg, (undo.ok || r.ok) ? MCE_CLS.ok : MCE_CLS.err);
		renderGlobal();
	});
	row2.appendChild(rollBtn);
	sec.appendChild(row2);

	sec.appendChild(el("div", MCE_CLS.hint,
		"覆盖：适配器作弊项 · 命令式动作 · 数值固定每秒回写 · 言灵按钮与异装守卫。" +
		"回退中心不受影响（撤销随时可用）；原版扩展面板（档案 / 经济 / 鹰塔 / 食物等）为手动单次写入，不在此开关内。"));
}
