/* 职责：需求③「让 Sam 滚蛋、不要来找我」—— 只拦公园清晨的 Sam 遭遇，不动 Sam 主线与 NPC 状态。
   原版事实（DoL 0.5.12.13）：
   - 公园事件表 L531051：<<elseif isInPark("sam") and $Sam_Park_Intro isnot 1 and $exposed lte 0>>；
   - isInPark 的 sam 分支（L66411–L66415）只看 C.npc.Sam.init === 1、Time.hour 在 6:00–6:55、无雨，
     不读任何 state —— 原版本身没有「让 Sam 别来」的开关，只能在判定入口拦截。
   - window.isInPark 在 L66420 挂到 window，CE 注入早于它定义时安装会拿不到，故 passageinit 里补装（幂等）。
   开关存 $mbCE_samAway（存档内，跨读档保留）；拦的是「sam 是否在公园」这一个布尔，其余 NPC 原样透传。 */

	var MCE_SAM_AWAY_KEY = "sam-away";
	function mbCESamAway() {
		var V = getV();
		return !!(V && V.mbCE_samAway === true);
	}
	function mbCESamAwaySet(on) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var before = { kind: MCE_SAM_AWAY_KEY, value: V.mbCE_samAway === true };
		if (on) { V.mbCE_samAway = true; } else { delete V.mbCE_samAway; }
		mbCEVanillaTrace(MCE_SAM_AWAY_KEY, before, "mbCE_samAway", "公园 Sam 遭遇开关", "vcore-econ");
		mbCESamEnsureHook();
		return { ok: true, message: on ? "已开启：公园清晨不再出现 Sam（其余角色不受影响）" : "已关闭：Sam 的公园遭遇恢复原版" };
	}
	/* 包装 window.isInPark（幂等）：只在开关开启且询问 "sam" 时返回 false，其它参数完全透传 */
	function mbCESamEnsureHook() {
		if (typeof window === "undefined" || !window) { return; }
		if (window.__mbCESamHooked) { return; }
		var orig = window.isInPark;
		if (typeof orig !== "function") { return; }
		window.__mbCESamHooked = true;
		window.isInPark = function (name) {
			try {
				if (mbCESamAway() && String(name).toLowerCase() === "sam") { return false; }
			} catch (eC) { /* 开关读取失败按原版放行 */ }
			return orig.apply(window, arguments);
		};
	}
	var MCE_SAM_UNDO_REG = /** @type {Object<string, any>} */ (MB_CE_ECON_UNDO);
	if (MCE_SAM_UNDO_REG) {
		MCE_SAM_UNDO_REG[MCE_SAM_AWAY_KEY] = function (V, b, key) {
			if (b.value === true) { V.mbCE_samAway = true; } else { try { delete V.mbCE_samAway; } catch (eS) {} }
			delete V.mbCE_wrote[key];
			return { ok: true, message: "已还原 Sam 公园开关为 " + (b.value === true ? "开启" : "关闭") };
		};
	}
	/* 阶段页区块：只在 Sam 卡片里出现 */
	function mbCESamRender(pane, name) {
		if (!pane || String(name) !== "Sam") { return; }
		var body = mceNewGroup(pane, "Sam · 公园遭遇", "让他别在清晨的公园里冒出来（不改变 Sam 线与 NPC 状态）");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var on = mbCESamAway();
			mbCEVanillaEconUiKv(body, [
				["公园遭遇", on ? "已驱离（不出现）" : "原版（可能清晨出现）"],
				["拦截方式", "isInPark(\"sam\") 返回 false"]
			]);
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, on ? "关闭驱离" : "让他滚蛋", on ? "恢复原版：清晨 6:00–6:55 晴天仍会在公园遇到 Sam" : "开启后公园清晨不再触发 Sam 的喂鸭子初见 / 日常遭遇", function () {
				mbCEVanillaEconUiRun(mbCESamAwaySet(!on), redraw);
			});
			body.appendChild(mceFoldHint("原版公园事件只判断 isInPark(\"sam\")（看 init、6:00–6:55、是否下雨），没有「别再出现」的分支，"
				+ "所以在判定入口拦截。只影响公园这一处；Sam 的咖啡馆线与其它剧情不受影响。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [[MCE_SAM_AWAY_KEY, "回退开关"]]);
		};
		redraw();
	}
