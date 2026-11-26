/* 职责：需求⑥「格威岚消失期直接完成」A 档 —— 只跳过等待计时，保留原版来信→读信→和解整条剧情。
   原版事实（DoL 0.5.12.13 HTML 行号实证）：
   - 生气期写入：<<gwylanRequestEnd "skip">> 之后 npcset Gwylan state "scorned" + $daily.gwylan.preventProgress
     + $gwylan.timer.scorned = 今天 +9 天（L402967–L402970）；酒吧再次离开再 +3 天（L385338）。
   - 自动恢复：每日维护 L78390–L78395 —— state==="scorned" && timer.scorned 到期 && request.event !== "yearning"
     时 set $yearningLetter 1 并删 timer.scorned。
   - 来信链：safehouseEvents 在 $yearningLetter is 1 时给窗鸟链接（L344612–L344615）→ Gwylan Yearning Letter
     读信 Next 置 2 并 unset yearningLetterExit（L385467）。
   - 和解入口：Forest Shop Locked 在 $yearningLetter is 2 && state is "scorned" && !isGwylanAbsent() 时
     给「Enter → Gwylan Yearning Start」（L406823–L406830）。
   - isGwylanAbsent() 只看 timer.nobody 与 state（L169329–L169334）。
   因此 A 档 = 删 timer.scorned / timer.nobody + 把 yearningLetter 直接置 1；state 保持 "scorned" 不动。
   不碰 request.event：若玩家正卡在来信事件里，原版自身会走完，这里只负责把「还要等」变成「现在就能来信」。 */

	var MCE_GWYLAN_WAIT_KEY = "gwylan-wait";
	/* 原版计时用 SugarCube DateTime.timeStamp（毫秒）；测试/非引擎环境退回 Date.now()，口径一致 */
	function mbCEGwylanNow() {
		try {
			if (typeof Time !== "undefined" && Time && Time.date && isFinite(Number(Time.date.timeStamp))) {
				return Number(Time.date.timeStamp);
			}
		} catch (eT) { /* 引擎时间不可用 → 走系统时间 */ }
		return Date.now();
	}
	function mbCEGwylanRemainDays(ts) {
		var n = Number(ts);
		if (!isFinite(n) || n <= 0) { return 0; }
		return Math.max(0, Math.ceil((n - mbCEGwylanNow()) / 86400000));
	}
	/* 状态快照：状态 / 生气剩余天 / 离店剩余天 / 来信标志（1 = 待来信，2 = 已读过） */
	function mbCEGwylanHas(gw, state) {
		return (gw && typeof gw === "object") || state !== "";
	}
	function mbCEGwylanAwaiting(state, sc, nb) {
		return sc > 0 || nb > 0 || state === "scorned";
	}
	function mbCEGwylanWaitState() {
		var V = getV();
		var out = { has: false, state: "", scornedDays: 0, nobodyDays: 0, letter: 0, awaiting: false };
		if (!V) { return out; }
		var st = getNpcState("Gwylan");
		out.state = st && st.found ? st.state : "";
		var gw = V.gwylan;
		out.has = mbCEGwylanHas(gw, out.state);
		var t = gw && gw.timer;
		if (t && typeof t === "object") {
			out.scornedDays = mbCEGwylanRemainDays(t.scorned);
			out.nobodyDays = mbCEGwylanRemainDays(t.nobody);
		}
		out.letter = Number(V.yearningLetter) || 0;
		out.awaiting = mbCEGwylanAwaiting(out.state, out.scornedDays, out.nobodyDays);
		return out;
	}
	/* 可跳条件判定（拆出来压复杂度）：返回拒绝文案，空串表示可跳 */
	function mbCEGwylanSkipBlock(st) {
		if (!st.has) { return "当前没有格威岚消失期可跳过（她不在生气 / 离店状态）"; }
		if (st.letter >= 2) { return "来信已经读过（yearningLetter = 2），请直接去森林商店触发和解"; }
		if (st.scornedDays > 0 || st.nobodyDays > 0) { return ""; }
		if (st.state === "scorned" && st.letter === 0) { return ""; }
		return "当前没有格威岚消失期可跳过（她不在生气 / 离店状态）";
	}
	function mbCEGwylanTraceBefore(V, gw, st) {
		return {
			kind: MCE_GWYLAN_WAIT_KEY,
			scorned: gw.timer.scorned === undefined ? undefined : Number(gw.timer.scorned),
			nobody: gw.timer.nobody === undefined ? undefined : Number(gw.timer.nobody),
			letter: V.yearningLetter === undefined ? undefined : Number(V.yearningLetter),
			state: st.state
		};
	}
	function mbCEGwylanSkipWait() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var st = mbCEGwylanWaitState();
		var block = mbCEGwylanSkipBlock(st);
		if (block) { return { ok: false, message: block }; }
		var gw = V.gwylan;
		if (!gw || typeof gw !== "object") { gw = {}; V.gwylan = gw; }
		if (!gw.timer || typeof gw.timer !== "object") { gw.timer = {}; }
		var before = mbCEGwylanTraceBefore(V, gw, st);
		try { delete gw.timer.scorned; } catch (eS) { gw.timer.scorned = undefined; }
		try { delete gw.timer.nobody; } catch (eN) { gw.timer.nobody = undefined; }
		V.yearningLetter = 1;
		mbCEVanillaTrace(MCE_GWYLAN_WAIT_KEY, before, "gwylan.timer / yearningLetter", "跳过格威岚消失期（保留原版来信与和解）", "vcore-econ");
		return { ok: true, message: "已跳过格威岚消失期：生气/离店计时清零，来信标志置 1；回家后等窗边鸟来信，读信后到森林商店和解即可" };
	}
	/* 单字段还原：原值缺失则删除（与 07m 的删除语义一致） */
	function mbCEGwylanRestoreField(obj, k, v) {
		if (v === undefined || v === null) {
			try { delete obj[k]; } catch (eR0) { obj[k] = undefined; }
		} else {
			obj[k] = Number(v);
		}
	}
	function mbCEGwylanUndoKind(V, b, key) {
		var gw = V.gwylan;
		if (!gw || typeof gw !== "object") { gw = {}; V.gwylan = gw; }
		if (!gw.timer || typeof gw.timer !== "object") { gw.timer = {}; }
		mbCEGwylanRestoreField(gw.timer, "scorned", b.scorned);
		mbCEGwylanRestoreField(gw.timer, "nobody", b.nobody);
		if (b.letter === undefined || b.letter === null) {
			try { delete V.yearningLetter; } catch (eR3) {}
		} else {
			V.yearningLetter = Number(b.letter) || 0;
		}
		delete V.mbCE_wrote[key];
		return { ok: true, message: "已还原格威岚消失期（生气计时 / 离店计时 / 来信标志）" };
	}
	/* 回退注册进统一 kind 表（与 07p 食物 / 07q 艾弗里同一做法，不改 07m / 07n 一行） */
	var MCE_GWYLAN_UNDO_REG = /** @type {Object<string, any>} */ (MB_CE_ECON_UNDO);
	if (MCE_GWYLAN_UNDO_REG) { MCE_GWYLAN_UNDO_REG[MCE_GWYLAN_WAIT_KEY] = mbCEGwylanUndoKind; }

	/* 阶段页区块：只在该角色是 Gwylan 时渲染（由 07c 的 mbCEStageExtras 统一调用） */
	function mbCEGwylanRender(pane, name) {
		if (!pane || String(name) !== "Gwylan") { return; }
		var body = mceNewGroup(pane, "格威岚 · 消失期", "生气期 / 离店计时 · 跳过等待但保留原版来信与和解");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEGwylanWaitState();
			var stateTxt = st.state === "scorned" ? "生气中（scorned）" : (st.state ? stateCN(st.state) : "未注册");
			var letterTxt = st.letter === 1 ? "待来信（1）" : (st.letter === 2 ? "已读信（2）" : "未触发（" + st.letter + "）");
			mbCEVanillaEconUiKv(body, [
				["关系状态", stateTxt],
				["生气剩余", st.scornedDays > 0 ? st.scornedDays + " 天" : "无计时"],
				["离店剩余", st.nobodyDays > 0 ? st.nobodyDays + " 天" : "无计时"],
				["来信标志", letterTxt]
			]);
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "跳过消失期", "删掉生气 / 离店计时并把来信标志置 1；之后按原版走窗鸟来信→读信→森林商店和解", function () {
				mbCEVanillaEconUiRun(mbCEGwylanSkipWait(), redraw);
			});
			body.appendChild(mceFoldHint("原版生气期 9 天、酒吧再离开追加 3 天；来信链路为：回家看到窗边鸟 → 读信（标志变 2）"
				+ " → 森林商店门口出现「Enter」→ 和解后 state 才恢复 active。这里只清计时，不替你跳过这一段剧情。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [[MCE_GWYLAN_WAIT_KEY, "回退消失期"]]);
		};
		redraw();
	}
