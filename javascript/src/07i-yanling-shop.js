	/* 职责：言灵页第三批动作（贴吧「言灵分享：森林商店相关」帖 6L 街机 / 16-17L 项圈破损）——
	   ① 街机计数设 7（$tenyclusPlayCount：future_suit 需求 141655；入口显示条件 532472）
	   ② 项圈破损层（type+broken + eventskipoverrule=1，原版 198062-198065 / 198496 空分支）
	   拆段原因：07i-yanling-posts.js 403/400，再加动作会破单段预算（S1）；语义命名符合 S2。
	   全部走变量直写 + mbCE_wrote 留痕（yanling: 前缀）。 */

	/* ⑩ 街机计数（6L「V.tenyclusPlayCount >= 7」）：
	   · 该计数就是 future_suit 套装的获取需求：requirements: () => V.tenyclusPlayCount >= 7（141655）；
	   · 首页街机入口的显示条件是 `gte 1 and lt 7`（532472），写 7 后该入口关闭 = 剧情走完语义
	     （原版 533180 每玩一局 ++，533181 在 6 档且无触手时直接跳到 7）；
	   · 首次遇见时初始化 0（532464-532465）。
	   故写 7 即「打过七次」，不伪造 hallucinations / daily.tenyclusPlayed 等见面门槛。 */
	function mbCEYanlingArcadeCount() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = V.tenyclusPlayCount;
			if (typeof before === "number" && before >= 7) {
				return { ok: true, msg: "街机计数已是 " + before + "（>=7，future_suit 需求 141655 已满足，无需再写）" };
			}
			V.tenyclusPlayCount = 7;
			mbCEYanlingTrace("arcade_count", { count: before }, { count: 7 });
			return { ok: true, msg: "街机计数 " + (before === undefined ? "未初始化" : String(before)) + " → 7（future_suit 服装需求满足；原版 `gte 1 and lt 7` 的 Play Tenyclus 入口随之关闭，属剧情走完语义）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* ⑪ 项圈破损层（87L 原言灵的 `type.push("broken")` + `<<neckruined>>`）：
	   · 原版 leash widget 198061-198066：cursed 时先 type.push("broken") 再 <<neckruined>>，然后才 generalWear；
	   · <<neckruined>> = generalRuined "neck"（198712-198715）；
	   · generalRuined 198496 对「cursed 且尚未 broken/split」走**空分支**：不销毁、不移除、不进 ruined 列表，
	     唯一实际写入是 198495 的 `$eventskipoverrule = 1`（Re-buy 198532 也因 198534 的 `cursed isnot 1` 被拦下，
	     _noRebuy 对诅咒件无实际作用）。
	   所以破损层的等价效果 = type 加 "broken" + eventskipoverrule=1，项圈仍留在身上、只改描述。 */
	function mbCEYanlingCollarBreak() {
		try {
			var V = getV();
			if (!mbCEYanlingWornOk(V)) { return { ok: false, msg: "存档变量不可用" }; }
			var cur = V.worn.neck;
			if (!cur || typeof cur !== "object" || cur.name !== "familiar collar") {
				return { ok: false, msg: "当前没穿眷属项圈（先「戴上并锁死」，破损层只作用于已锁项圈）" };
			}
			if (cur.cursed !== 1) { return { ok: false, msg: "项圈未锁（cursed≠1）；原版破损处理只在 cursed 状态发生（198062）" }; }
			var types = Array.isArray(cur.type) ? cur.type : (cur.type = []);
			var dup = types.indexOf("broken") !== -1;
			if (!dup) { types.push("broken"); }
			V.eventskipoverrule = 1;
			mbCEYanlingTrace("collar_break", { broken: dup, eventskipoverrule: undefined }, { broken: true, eventskipoverrule: 1 });
			return { ok: true, msg: dup ? "项圈已是破损态（type 已含 broken），本次只补 eventskipoverrule=1" : "项圈已标记破损（type+broken、eventskipoverrule=1；项圈不脱、只改描述，符合原版 198496 空分支）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}
