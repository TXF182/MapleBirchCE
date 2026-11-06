	/* ============ v2.0.0.002 需求⑤：原版三档说话态度 + 选定后永久维持 ============
	   原版取证（DoL 0.5.12.13，逐字取自 Degrees of Lewdity.html，非二手转述）：
	   1) 三档控件 `<<widget "cheatsSpeechAttitude">>`（Cheats passage）：
	        <<set _submissiveness = [1500, 1000, 500]>>
	        <<set _attitude = ["meek", "neutral", "bratty"]>>
	        … <<set $speech_attitude to _attitude[_i]>><<<set $submissive to _submissiveness[_i]>>
	      ￼点一档 = 同时写 `$speech_attitude`（档名）与 `$submissive`（对应锚值）。
	   2) 门槛（`<<widget "attitudes">>`）：Meek 需 `$submissive gt 850`、Bratty 需 `$submissive lt 1150`；
	      ￼1500 / 1000 / 500 三锚值分别落在门槛内侧，所以只要锚值不漂移，三档都保持可选。
	   3) `$speech_attitude` 全库写入点仅 6 处（gameStartOnly / variablesVersionUpdate / Cheats /
	      Pinch Widgets（喵化）/ Scarlet Widgets），其余数百处只读 → 游戏本身不会自行改档。
	   旧实现（只把 `$submissive` 写进 851–1149 交集）按用户口径作废：那是"两档都能选"，不是"所选档永久维持"。
	   维持语义 = 每秒把 `$speech_attitude` 复位到所选档；同时把所选档的门槛锚值拉回门槛内侧
	   （Meek 不低于 851、Bratty 不高于 1149），原版设置页才会继续把该档显示为选中而不是灰掉。 */
	var MB_CE_ATTITUDE_TIERS = [
		{ key: "meek", label: "Meek（温顺）", anchor: 1500, gateMin: 851, gateMax: null, gateNote: "需顺从度 > 850" },
		{ key: "neutral", label: "Neutral（中性）", anchor: 1000, gateMin: null, gateMax: null, gateNote: "无门槛" },
		{ key: "bratty", label: "Bratty（叛逆）", anchor: 500, gateMin: null, gateMax: 1149, gateNote: "需顺从度 < 1150" }
	];
	/* 旧符号保留（09-exports2 与既有断言在引用）：区间判定仍按原版两条门槛取值 */
	var FSA_FREE_MIN = 851;
	var FSA_FREE_MAX = 1149;
	var FSA_FREE_MID = 1000;
	function mbCEAttitudeTier(key) {
		var i;
		for (i = 0; i < MB_CE_ATTITUDE_TIERS.length; i++) {
			if (MB_CE_ATTITUDE_TIERS[i].key === key) { return MB_CE_ATTITUDE_TIERS[i]; }
		}
		return null;
	}
	function readAttitude() {
		var V2 = getV();
		return (V2 && typeof V2.speech_attitude === "string") ? V2.speech_attitude : null;
	}
	function attitudeState(v) {
		var n = (typeof v === "number") ? v : null;
		return {
			value: n,
			sub: (n !== null && n > 850),
			resist: (n !== null && n < 1150),
			both: (n !== null && n > 850 && n < 1150)
		};
	}
	function mbCEAttitudeState() {
		var V = getV(), lock = V && V.mbCE_attitudeLock;
		var has = !!(lock && typeof lock === "object" && typeof lock.value === "string");
		return {
			attitude: (V && typeof V.speech_attitude === "string") ? V.speech_attitude : null,
			submissive: (V && typeof V.submissive === "number") ? V.submissive : null,
			lock: has ? lock : null,
			value: has ? lock.value : null,
			anchor: (has && typeof lock.anchor === "number") ? lock.anchor : null,
			hold: !!(has && lock.hold),
			fixed: (has && typeof lock.fixed === "number") ? lock.fixed : 0
		};
	}
	/* 选定档位：写 $speech_attitude + 锚值，并登记维持锁（prev 只在首次锁定时留，用于回退） */
	function mbCEAttitudeApply(key) {
		var t = mbCEAttitudeTier(key);
		if (!t) { return { ok: false, message: "未知态度档位：" + key }; }
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var cur = mbCEAttitudeState();
		var r1 = cheatWriteValue("player-self", "p:speech_attitude", "value_set", "speech_attitude", t.key, "string");
		if (!r1 || !r1.ok) { return r1 || { ok: false, message: "态度写入失败" }; }
		var r2 = cheatWriteValue("player-self", "p:submissive", "value_set", "submissive", t.anchor, "number", 0, 2000);
		if (!r2 || !r2.ok) { return r2 || { ok: false, message: "顺从度写入失败" }; }
		if (!cur.lock) {
			V.mbCE_attitudeLock = {
				prevAttitude: cur.attitude,
				prevSubmissive: cur.submissive,
				fixed: 0
			};
		}
		V.mbCE_attitudeLock.value = t.key;
		V.mbCE_attitudeLock.anchor = t.anchor;
		V.mbCE_attitudeLock.hold = true;
		mbCEAttitudeEnsureTimer();
		return { ok: true, message: "已选定「" + t.label + "」并开启永久维持（" + t.gateNote + "，锚值 " + t.anchor + "）" };
	}
	function mbCEAttitudeHold(on) {
		var st = mbCEAttitudeState();
		if (!st.lock) { return { ok: false, message: "尚未选定档位：请先在下方三档里选一个" }; }
		getV().mbCE_attitudeLock.hold = !!on;
		mbCEAttitudeEnsureTimer();
		return { ok: true, message: on ? "已开启维持：态度不会再被其它数值变化带偏" : "已暂停维持（当前档位不再被复位，但仍记录着你的选择）" };
	}
	/* 解除维持：清锁；restore=true 时把锁定前的 $speech_attitude / $submissive 还原 */
	function mbCEAttitudeRelease(restore) {
		var V = getV(), st = mbCEAttitudeState();
		if (!V || !st.lock) { return { ok: false, message: "当前没有锁定中的态度" }; }
		if (restore) {
			if (typeof st.lock.prevAttitude === "string") { V.speech_attitude = st.lock.prevAttitude; }
			if (typeof st.lock.prevSubmissive === "number") { V.submissive = st.lock.prevSubmissive; }
		}
		delete V.mbCE_attitudeLock;
		mbCEAttitudeEnsureTimer();
		return { ok: true, message: restore ? "已解除维持并还原锁定前的态度与顺从度" : "已解除维持（保留当前态度值）" };
	}
	/* 维持一轮：返回本轮修正动作数（0 = 无需修正） */
	function mbCEAttitudeTick() {
		try {
			var V = getV(), st = mbCEAttitudeState();
			if (!V || !st.lock || !st.hold) { return 0; }
			var t = mbCEAttitudeTier(st.value);
			if (!t) { return 0; }
			var fixed = 0;
			if (V.speech_attitude !== t.key) { V.speech_attitude = t.key; fixed++; }
			var sub = (typeof V.submissive === "number") ? V.submissive : 0;
			if (t.gateMin !== null && sub < t.gateMin) { V.submissive = t.gateMin; fixed++; }
			else if (t.gateMax !== null && sub > t.gateMax) { V.submissive = t.gateMax; fixed++; }
			if (fixed) { V.mbCE_attitudeLock.fixed = (st.fixed || 0) + fixed; }
			return fixed;
		} catch (e) { return 0; }
	}
	var mbCEAttitudeTimer = null;
	/* 状态行文本：渲染与 tick 共用，tick 只改这一段文字，不重渲染整页（避免打断用户输入） */
	function mbCEAttitudeStatusLine(st) {
		if (!st) { st = mbCEAttitudeState(); }
		return "在原版三档（Meek / Neutral / Bratty）里选一个后，CE 每秒把 $speech_attitude 复位到该档，"
			+ "并把顺从度拉回该档门槛内侧（Meek ≥851 / Bratty ≤1149），其它数值怎么变都不会把态度带偏。"
			+ "当前：态度 " + (st.attitude || "—") + "，顺从度 " + (st.submissive === null ? "—" : st.submissive)
			+ "；维持 " + (st.hold ? "开" : "关") + "，已修正 " + st.fixed + " 次。";
	}
	function mbCEAttitudeEnsureTimer() {
		try {
			var st = mbCEAttitudeState();
			var on = !!(st.lock && st.hold);
			if (on && !mbCEAttitudeTimer) {
				mbCEAttitudeTimer = setInterval(function () {
					try {
						var n = mbCEAttitudeTick();
						if (!n) { return; }
						var line = document.querySelector('[data-mce-att="1"]');
						if (line) { line.textContent = mbCEAttitudeStatusLine(); }
					} catch (e) { /* tick 失败静默，不打断游戏 */ }
				}, 1000);
			} else if (!on && mbCEAttitudeTimer) {
				clearInterval(mbCEAttitudeTimer); mbCEAttitudeTimer = null;
			}
		} catch (e) { /* 面板未就绪时静默 */ }
	}
	/* 兼容旧入口：字符串按档位名；数字按最近的锚值映射档位（旧版写区间的调用不会静默失效） */
	function applyAttitude(v) {
		if (typeof v === "string") { return mbCEAttitudeApply(v); }
		if (typeof v !== "number" || !isFinite(v)) { return { ok: false, message: "请输入数字或档位名（meek/neutral/bratty）" }; }
		var best = MB_CE_ATTITUDE_TIERS[0], i, d;
		for (i = 1; i < MB_CE_ATTITUDE_TIERS.length; i++) {
			d = Math.abs(MB_CE_ATTITUDE_TIERS[i].anchor - v);
			if (d < Math.abs(best.anchor - v)) { best = MB_CE_ATTITUDE_TIERS[i]; }
		}
		return mbCEAttitudeApply(best.key);
	}
	function renderAttitudeFree(pane) {
		if (!pane) { return; }
		mbCEAttitudeEnsureTimer();
		var st = mbCEAttitudeState();
		var curTier = st.lock ? mbCEAttitudeTier(st.value) : null;
		pane.appendChild(el("div", "mce-section", "说话态度（原版三档 · 选定后永久维持）"));
		var hint = el("div", "mce-hint", mbCEAttitudeStatusLine(st));
		hint.setAttribute("data-mce-att", "1");
		pane.appendChild(hint);
		var row = el("div", "mce-row");
		MB_CE_ATTITUDE_TIERS.forEach(function (t) {
			var on = !!(curTier && curTier.key === t.key);
			var b = el("button", on ? "mce-btn mce-gold" : "mce-btn", (on ? "✓ " : "") + t.label);
			b.type = "button";
			b.title = t.gateNote + "；锚值 " + t.anchor;
			b.addEventListener("click", function () {
				var r = mbCEAttitudeApply(t.key);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
			});
			row.appendChild(b);
		});
		pane.appendChild(row);
		var ctl = el("div", "mce-row");
		var hold = el("button", st.hold ? "mce-btn mce-gold" : "mce-btn", st.hold ? "维持：开" : "维持：关");
		hold.type = "button";
		hold.title = "开启后每秒复位 $speech_attitude 到所选档，并把顺从度拉回该档门槛内侧";
		hold.addEventListener("click", function () {
			var r = mbCEAttitudeHold(!st.hold);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
		});
		var rel = el("button", "", "解除维持"); rel.type = "button";
		rel.title = "清除锁定（保留当前态度值）";
		rel.addEventListener("click", function () {
			var r = mbCEAttitudeRelease(false);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
		});
		var back = el("button", "", "解除并还原"); back.type = "button";
		back.title = "清除锁定，并把态度与顺从度恢复为首次锁定前的值";
		back.addEventListener("click", function () {
			var r = mbCEAttitudeRelease(true);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
		});
		ctl.appendChild(hold); ctl.appendChild(rel); ctl.appendChild(back);
		pane.appendChild(ctl);
	}
