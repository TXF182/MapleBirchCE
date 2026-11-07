	/* ============ 言灵页（v2.0.0.006）：NPC 无视着装性别 / 异装残留净化 / 负面名声清零 ============
	   诉求（好友走全正面线）：给 PC 穿好看的异性服装，不触发异装判定、不涨异装癖、不产生学校异装负面名声。

	   实现依据（DoL 0.5.12.13 逐行取证，均可复跑核对）：
	     ① 判定入口 isCrossdressing() 72520-72536：
	        getVisibleClothesList().some(item => ["f","m"].includes(item.gender) && item.gender !== V.player.sex
	        && item.gender === V.player.gender_appearance) && !isGenitalMismatch()
	        末尾 `window.isCrossdressing = isCrossdressing;` → 本页据此做运行期覆盖（幂等、可重装、可卸载）。
	        作用域实证：声明位于 SugarCube <script>（twine-user-script，最近 <script> 起点 68457）编译域内，
	        函数声明不泄漏到全局词法作用域，所以两处调用路径都必须经 window 才够得着本函数。
	        全文 49 行命中 isCrossdressing：twee 侧 45 处 `<<if / <<elseif isCrossdressing()>>`、
	        JS 内裸调用仅 1 处（isHermOrCrossdresser 72548）、其余 3 行为声明与注释。
	        （314549 / 314554 的「裸调用」其实是 <<switch>> 内事件文本里的 SugarCube `is` 语法，不是 JS 调用。）
	        覆盖 window 即覆盖 45 处 twee 判定；72548 保持原版 herm / 外观语义（见下 ④ 与面板边界 ①）。
	     ② 唯一总开关是 $crossdressing 变量，写入点 crossdressing_check 242916-242924：
	        penisExist && vaginaExist → 2；elseif isCrossdressing() → 1；else → 0。
	     ③ 下游全部读 $crossdressing，拦截 isCrossdressing() 使其恒为 0 即全链断开：
	        - 战斗 man widget 243068-243069：$crossdressing gte 1 → exposedcheck + schoolrep_naked
	        - schoolrep_naked 346684-346700：isCrossdressing() → schoolrep crossdress 1（学校负面名声）
	        - 异装癖累积 243201-243208：crossdress 分支内 $crossdressingTrait += 1，满 100 pushUnique("crossdresser")
	        - 换衣间 changingRoomFeelings 668274-668300「You feel naughty.」等 twee 侧 45 处判定点全部经 window 求值
	     ④ 与压力循环解耦：77866-77870 用本地 const isCrossdressing（源码注释明确「不复用函数」，
	        因压力增减不该随 NudeGenderDC 变），故本页拦截不改变 stress 语义。
	     ⑤ 学校名声存量：schoolrep 346656-346682（仅 crossdress / herm 两键）
	        + 文案 V.school_crossdress_message 163371-163391 + 提示 77378 → 清零需一并删文案。
	     ⑥ 城镇名声：V.fame 键取自 306912-306928（sex / prostitution / rape / bestiality / pregnancy /
	        impreg / exhibitionism / scrap / good / business / social / model，另注释保留 pimp），
	        V.fameDecay / V.fameDecayTimer 为衰减队列（77558-77564），清零须同步删队列项。

	   CheatExtend 1.1.3 的「言灵」是 TweeReplacer 对原版 Cheats 面板 widget 的**整块文本替换**，
	   原版文案一改 findString 即失效（用户「时间太久了、有些已不适用」的根因）。
	   本页改为 JS 层运行期钩子 + 变量直写，不依赖任何原版文案，版本升级不会静默失效。 */

	var mbCEYanlingFameNeg = ["sex", "prostitution", "rape", "bestiality", "pregnancy", "impreg", "exhibitionism", "pimp"];

	function mbCEYanlingState() {
		try {
			var V = getV();
			if (!V) { return null; }
			if (!V.mbCE_yanling || typeof V.mbCE_yanling !== "object") {
				V.mbCE_yanling = { noCross: false, noTrait: false };
			}
			V.mbCE_yanling.noCross = V.mbCE_yanling.noCross === true;
			V.mbCE_yanling.noTrait = V.mbCE_yanling.noTrait === true;
			return V.mbCE_yanling;
		} catch (e) { return null; }
	}
	/* 只读状态：isCrossdressing() 每秒被高频调用，绝不能在未启用时创建存档变量 */
	function mbCEYanlingRead() {
		try {
			var V = getV();
			if (!V || !V.mbCE_yanling || typeof V.mbCE_yanling !== "object") { return null; }
			return V.mbCE_yanling;
		} catch (e) { return null; }
	}
	function mbCEYanlingNoCross() {
		var s = mbCEYanlingRead();
		/* 严格比较：手改存档写进字符串 "false" 时不能被真值判定当成开启 */
		return !!(s && s.noCross === true);
	}
	function mbCEYanlingTrace(op, before, after) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["yanling:" + op] = { type: "yanling", modId: "vanilla", op: op, before: before, after: after, t: Date.now() };
		} catch (e) {}
	}

	/* 运行期覆盖 window.isCrossdressing（幂等）：已装则跳过；被第三方重包则以新函数为上游重新包裹。
	   钩子内部每次调用都现读 V.mbCE_yanling.noCross —— 读档前装、读档后同样生效。
	   上游函数单独保存：关闭开关时可原样还原（见 mbCEYanlingUninstall）。 */
	var mbCEYanlingHookFn = null;
	var mbCEYanlingUpstream = null;
	function mbCEYanlingInstall() {
		try {
			if (typeof window === "undefined") { return false; }
			var cur = window.isCrossdressing;
			if (typeof cur !== "function") { return false; }
			if (cur === mbCEYanlingHookFn) { return true; }
			var upstream = cur;
			mbCEYanlingUpstream = upstream;
			mbCEYanlingHookFn = function () {
				try {
					if (mbCEYanlingNoCross()) { return false; }
				} catch (e) {}
				return upstream.apply(this, arguments);
			};
			window.isCrossdressing = mbCEYanlingHookFn;
			return true;
		} catch (e) { return false; }
	}
	/* 卸载：只在 window 上仍是本页钩子时还原上游，绝不覆盖已被第三方替换的函数。
	   意义有二：① 关闭开关后不留无谓包装层；② 若第三方把本页钩子当上游包进自己的链，
	   关闭时拆掉最外层即可断开，避免「我方→第三方→我方」无限递归。 */
	function mbCEYanlingUninstall() {
		try {
			if (typeof window === "undefined") { return false; }
			if (!mbCEYanlingHookFn) { return true; }
			if (window.isCrossdressing === mbCEYanlingHookFn && typeof mbCEYanlingUpstream === "function") {
				window.isCrossdressing = mbCEYanlingUpstream;
			}
			mbCEYanlingHookFn = null;
			mbCEYanlingUpstream = null;
			return true;
		} catch (e) { return false; }
	}
	/* 按开关状态同步钩子：开 → 挂，关 → 卸载。所有自动路径（tick / 定时器 / 面板）只用它，
	   不直接调 Install，否则「关闭状态也挂着钩子」，与 Uninstall 语义冲突。 */
	function mbCEYanlingSync() {
		if (mbCEYanlingNoCross()) { return mbCEYanlingInstall(); }
		mbCEYanlingUninstall();
		return true;
	}

	/* 存量净化：$crossdressing / 学校异装名声 / 学校异装文案 */
	function mbCEYanlingPurgeCross() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = {
				crossdressing: V.crossdressing,
				schoolrep: (V.schoolrep && typeof V.schoolrep === "object") ? V.schoolrep.crossdress : undefined,
				message: V.school_crossdress_message
			};
			if (typeof V.crossdressing === "number" && V.crossdressing !== 0) { V.crossdressing = 0; }
			if (V.schoolrep && typeof V.schoolrep === "object" && V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; }
			if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			mbCEYanlingTrace("purge_cross", before, { crossdressing: 0, schoolrep: 0, message: null });
			return { ok: true, msg: "已清空异装判定与学校异装名声" };
		} catch (e) { return { ok: false, msg: "净化异常：" + (e && e.message ? e.message : e) }; }
	}
	/* 存量净化：异装癖进度 + crossdresser 背景特质 */
	function mbCEYanlingPurgeTrait() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { trait: V.crossdressingTrait, has: false };
			var arr = V.backgroundTraits;
			if (arr && typeof arr.indexOf === "function") { before.has = arr.indexOf("crossdresser") !== -1; }
			if (typeof V.crossdressingTrait === "number" && V.crossdressingTrait !== 0) { V.crossdressingTrait = 0; }
			if (arr && typeof arr.indexOf === "function") {
				var i = arr.indexOf("crossdresser");
				while (i !== -1) { arr.splice(i, 1); i = arr.indexOf("crossdresser"); }
			} else if (arr && typeof arr.delete === "function") {
				arr.delete("crossdresser");
			}
			mbCEYanlingTrace("purge_trait", before, { trait: 0, has: false });
			return { ok: true, msg: "已清空异装癖进度并移除 Crossdresser 特质" };
		} catch (e) { return { ok: false, msg: "净化异常：" + (e && e.message ? e.message : e) }; }
	}
	/* 负面名声清零：学校 crossdress / herm 双键 + 学校文案 + 城镇 fame 负面项与衰减队列 */
	function mbCEYanlingPurgeFame() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { schoolrep: {}, fame: {} }, n = 0, ns = 0, k;
			if (V.schoolrep && typeof V.schoolrep === "object") {
				before.schoolrep = { crossdress: V.schoolrep.crossdress, herm: V.schoolrep.herm };
				if (V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; ns++; }
				if (V.schoolrep.herm !== 0) { V.schoolrep.herm = 0; ns++; }
			}
			if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			if (V.school_herm_message !== undefined) { delete V.school_herm_message; }
			for (var i = 0; i < mbCEYanlingFameNeg.length; i++) {
				k = mbCEYanlingFameNeg[i];
				if (V.fame && typeof V.fame === "object" && typeof V.fame[k] === "number" && V.fame[k] !== 0) {
					before.fame[k] = V.fame[k];
					V.fame[k] = 0;
					n++;
				}
				if (V.fameDecay && typeof V.fameDecay === "object" && V.fameDecay[k] !== undefined) { delete V.fameDecay[k]; }
				if (V.fameDecayTimer && typeof V.fameDecayTimer === "object" && V.fameDecayTimer[k] !== undefined) { delete V.fameDecayTimer[k]; }
			}
			mbCEYanlingTrace("purge_fame", before, { cleared: n });
			return { ok: true, msg: "负面名声已清零（学校 " + ns + " 项 + 城镇 " + n + " 项）" };
		} catch (e) { return { ok: false, msg: "净化异常：" + (e && e.message ? e.message : e) }; }
	}

	/* 守卫：开关开启期间每秒把存量压回 0（防读档后残留、防战斗/舞蹈中途恢复判定）。
	   全部包在 try 内 —— 回调里的任何异常都不能每秒抛一次（见 ui-tick-refresh-scope-guard）。 */
	function mbCEYanlingTick() {
		try {
			var st = mbCEYanlingRead();
			if (!st || (st.noCross !== true && st.noTrait !== true)) {
				/* 两个开关都未开启：立即停表。守卫定时器不该在没人用时空转
				   （Node/jsdom 里常驻 interval 会阻止进程退出，冒烟测试将永远不返回）。 */
				if (mbCEYanlingTimer) { clearInterval(mbCEYanlingTimer); mbCEYanlingTimer = null; }
				return;
			}
			mbCEYanlingSync();
			var V = getV();
			if (!V) { return; }
			if (st.noCross === true) {
				if (typeof V.crossdressing === "number" && V.crossdressing !== 0) { V.crossdressing = 0; }
				if (V.schoolrep && typeof V.schoolrep === "object" && typeof V.schoolrep.crossdress === "number" && V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; }
				if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			}
			if (st.noTrait === true) {
				if (typeof V.crossdressingTrait === "number" && V.crossdressingTrait !== 0) { V.crossdressingTrait = 0; }
				var arr = V.backgroundTraits;
				if (arr && typeof arr.indexOf === "function" && arr.indexOf("crossdresser") !== -1) { arr.splice(arr.indexOf("crossdresser"), 1); }
			}
		} catch (e) {}
	}
	var mbCEYanlingTimer = null;
	function mbCEYanlingEnsureTimer() {
		try {
			/* 只有开关真的开着才起表：没人用时不占事件循环（浏览器里也省一个空转 1s 定时器） */
			var st = mbCEYanlingRead();
			mbCEYanlingSync();
			if (!st || (st.noCross !== true && st.noTrait !== true)) { return; }
			if (mbCEYanlingTimer || typeof setInterval !== "function") { return; }
			mbCEYanlingTimer = setInterval(mbCEYanlingTick, 1000);
			/* Node/jsdom：unref 让守卫定时器不阻止进程退出（浏览器 interval 是数字，没有 unref） */
			try { if (mbCEYanlingTimer && typeof mbCEYanlingTimer.unref === "function") { mbCEYanlingTimer.unref(); } } catch (eU) {}
		} catch (e) {}
	}

	/* 开关动作（写状态 + 立即执行一次 + 留痕） */
	function mbCEYanlingToggle(field) {
		try {
			/* 白名单：本函数对外暴露在 mountApi 上，控制台误传字段会往存档里写垃圾键 */
			if (field !== "noCross" && field !== "noTrait") { return { ok: false, msg: "未知开关：" + String(field) }; }
			var st = mbCEYanlingState();
			if (!st) { return { ok: false, msg: "存档变量不可用" }; }
			var on = !st[field];
			st[field] = on;
			mbCEYanlingEnsureTimer();
			if (field === "noCross") {
				mbCEYanlingSync();
				if (on) { mbCEYanlingPurgeCross(); }
			}
			if (field === "noTrait" && on) { mbCEYanlingPurgeTrait(); }
			mbCEYanlingTrace("toggle_" + field, !on, on);
			var label = field === "noCross" ? "无视着装性别" : "压制异装癖";
			return { ok: true, msg: label + (on ? " 已开启" : " 已关闭") };
		} catch (e) { return { ok: false, msg: "切换异常：" + (e && e.message ? e.message : e) }; }
	}

	/* 渲染：言灵页（7 号外层页签） */
	function renderYanling() {
		try {
			mbCEYanlingEnsureTimer();
			var pane = root ? root.querySelector('[data-pane="yanling"]') : null;
			if (!pane) { return; }
			/* 重建面板前记住滚动位置：点开关后整页重渲染，不能让玩家每点一次都跳回顶端 */
			var scroller = null, keepTop = 0;
			try { scroller = pane.closest ? pane.closest(".mce-body") : null; keepTop = scroller ? scroller.scrollTop : 0; } catch (eS) {}
			pane.textContent = "";
			var V = getV();
			var st = mbCEYanlingState();
			var hooked = !!(mbCEYanlingHookFn && typeof window !== "undefined" && window.isCrossdressing === mbCEYanlingHookFn);

			var mkSec = function (title) { var s = el("div", "mce-section", title); pane.appendChild(s); return s; };
			var mkStatus = function (sec, on, onText, offText) {
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", "当前状态："));
				row.appendChild(el("span", "mce-value", on ? onText : offText));
				sec.appendChild(row);
			};
			var mkBtn = function (sec, text, cls, fn, tip) {
				var row = el("div", "mce-row");
				var b = el("button", "mce-btn " + (cls || ""), text);
				b.type = "button";
				if (tip) { b.title = tip; }
				b.addEventListener("click", function () {
					var r = fn();
					if (r && r.msg) { setStatus(r.msg, r.ok ? "mce-ok" : "mce-err"); }
					mbCEFlashRow(b);
					renderYanling();
				});
				row.appendChild(b);
				sec.appendChild(row);
				return b;
			};

			/* ① 核心：无性别着装 */
			var s1 = mkSec("言灵 · 无视着装性别");
			s1.appendChild(el("div", "mce-hint", "开启后 NPC 不再按服装标注性别判定异装：穿异性服装不触发异装判定、不涨异装癖、不产生学校异装名声，换衣间也不再出现「naughty」类文案。判定在 JS 层覆盖 isCrossdressing()，$crossdressing 恒为 0，版本升级不会像文本替换那样静默失效。"));
			mkStatus(s1, st && st.noCross, "已开启", "未开启");
			var row1 = el("div", "mce-row");
			var b1 = el("button", "mce-btn " + (st && st.noCross ? "mce-red" : "mce-gold"), st && st.noCross ? "关闭（恢复原版判定）" : "开启");
			b1.type = "button";
			b1.addEventListener("click", function () {
				var r = mbCEYanlingToggle("noCross");
				setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
				mbCEFlashRow(b1);
				renderYanling();
			});
			row1.appendChild(b1);
			s1.appendChild(row1);
			var diag = el("div", "mce-row");
			diag.appendChild(el("span", "mce-row-lbl", "运行时诊断："));
			var hookedTxt = hooked ? "钩子已挂载" : ((st && st.noCross === true) ? "钩子未挂载（游戏脚本未就绪或已被重载）" : "未启用（开关关闭时不挂钩子）");
			diag.appendChild(el("span", "mce-value", hookedTxt + " ｜ $crossdressing = " + (V && V.crossdressing !== undefined ? String(V.crossdressing) : "—")));
			s1.appendChild(diag);

			/* ② 异装癖（crossdresser 特质） */
			var s2 = mkSec("言灵 · 异装癖压制");
			var hasTrait = false;
			try {
				var bt = V && V.backgroundTraits;
				hasTrait = !!(bt && typeof bt.indexOf === "function" && bt.indexOf("crossdresser") !== -1);
			} catch (e0) {}
			s2.appendChild(el("div", "mce-hint", "异装癖累积点在异装分支内（243201-243208：$crossdressingTrait 满 100 → 背景特质 crossdresser）。开启「无视着装性别」后不再累积；本组额外把存量进度与已获得的特质清掉，并可按秒压制（读档后同样生效）。"));
			var tRow = el("div", "mce-row");
			tRow.appendChild(el("span", "mce-row-lbl", "当前：进度 " + (V && typeof V.crossdressingTrait === "number" ? String(V.crossdressingTrait) : "0") + "/100，特质 "));
			tRow.appendChild(el("span", "mce-value", hasTrait ? "已获得（可按下方按钮移除）" : "未获得"));
			s2.appendChild(tRow);
			mkStatus(s2, st && st.noTrait, "压制中（每秒压回 0）", "未压制");
			mkBtn(s2, "立即清空进度 + 移除特质", "mce-gold", mbCEYanlingPurgeTrait, "清空 $crossdressingTrait 并从 $backgroundTraits 移除 crossdresser");
			var rowT = el("div", "mce-row");
			var bT = el("button", "mce-btn " + (st && st.noTrait ? "mce-red" : ""), st && st.noTrait ? "停止压制" : "开启持续压制");
			bT.type = "button";
			bT.addEventListener("click", function () {
				var r = mbCEYanlingToggle("noTrait");
				setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
				mbCEFlashRow(bT);
				renderYanling();
			});
			rowT.appendChild(bT);
			s2.appendChild(rowT);

			/* ③ 负面名声清零 */
			var s3 = mkSec("言灵 · 负面名声清零");
			s3.appendChild(el("div", "mce-hint", "学校名声仅 crossdress / herm 两键（schoolrep 346656-346682）；城镇名声取 V.fame 负面 8 项（sex / prostitution / rape / bestiality / pregnancy / impreg / exhibitionism / pimp），并同步删除 V.fameDecay / V.fameDecayTimer 的衰减队列项，避免清零后又被队列改回。正面项（scrap / good / business / social / model）保持不动。"));
			var schTxt = "—";
			try {
				if (V && V.schoolrep && typeof V.schoolrep === "object") {
					schTxt = "crossdress=" + String(V.schoolrep.crossdress === undefined ? 0 : V.schoolrep.crossdress) + "，herm=" + String(V.schoolrep.herm === undefined ? 0 : V.schoolrep.herm);
				}
			} catch (e1) {}
			var fRow = el("div", "mce-row");
			fRow.appendChild(el("span", "mce-row-lbl", "学校名声：" + schTxt + " ｜ 城镇负面合计 " + (function () {
				try {
					var tot = 0, V1 = getV();
					for (var j = 0; j < mbCEYanlingFameNeg.length; j++) {
						var kk = mbCEYanlingFameNeg[j];
						if (V1 && V1.fame && typeof V1.fame[kk] === "number") { tot += V1.fame[kk]; }
					}
					return String(tot);
				} catch (e2) { return "—"; }
			})() + " 点"));
			s3.appendChild(fRow);
			mkBtn(s3, "一键清零：学校异装名声", "mce-gold", mbCEYanlingPurgeCross, "清 $schoolrep.crossdress 并删 $school_crossdress_message");
			mkBtn(s3, "一键清零：全部负面名声", "mce-gold", mbCEYanlingPurgeFame, "学校 crossdress/herm + 城镇 fame 负面 8 项 + 衰减队列");

			/* ④ 边界说明 */
			var s4 = mkSec("说明与边界");
			s4.appendChild(el("div", "mce-hint", "① 只拦「服装性别」链，不改玩家性别、生殖器、外观性别（isGenitalMismatch 与原版 herm 链保持原样；双生殖器仍会按原版进 herm 分支，如需一并消掉请用上面的名声清零）。"));
			s4.appendChild(el("div", "mce-hint", "② 压力循环不受影响：77866-77870 用本地 const 判定（源码注释明确不复用函数），本页只覆盖函数不改语义。"));
			s4.appendChild(el("div", "mce-hint", "③ 不依赖任何原版文案：老式「言灵」模组靠文本替换原版 Cheats 面板，原版一更新即整块失效；本页全部为运行期钩子与变量直写，仅依赖 6 个变量键（$crossdressing / $schoolrep / $school_crossdress_message / $crossdressingTrait / $backgroundTraits / $fame）。"));
			s4.appendChild(el("div", "mce-hint", "④ 所有净化动作按 mbCE_wrote[\"yanling:op\"] 留痕（含 before/after/t），可在全局页留痕区核对。"));
			s4.appendChild(el("div", "mce-hint", "⑤ 关闭开关会立即卸载钩子（window.isCrossdressing 还原为原版函数），不留空包装层；钩子被第三方模组重包时，开关开启期间每秒自动以新函数为上游重新包裹。"));
			s4.appendChild(el("div", "mce-hint", "⑥ 性别认知残留属正常：学校异装名声升到 5 时原版会把 9 名 NPC 写进 $genderknown（schoolrep widget 的 pushUnique）。本页清零名声不撤销这些认知——它们只代表「NPC 已知道你的性别」，不是负面名声，撤销反而让 NPC 忘记已有认知。"));
			/* 恢复滚动位置（见上方 keepTop） */
			if (scroller && keepTop) { try { scroller.scrollTop = keepTop; } catch (eR) {} }
		} catch (e) { /* 渲染失败不抛到 UI 主链 */ }
	}

	/* 模块加载即起守卫：存档里已开启的开关无需打开面板也持续生效（V 未就绪时 tick 内静默跳过） */
	mbCEYanlingEnsureTimer();
