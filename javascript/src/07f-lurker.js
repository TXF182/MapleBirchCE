/* ============ v2.0.0.002 需求⑥：潜伏者捕捉狂（无上限）+ 水烟馆冰箱（无上限） ============
   原版取证见同批次 07f-lurker0-patch.js 头部（逐字取自 DoL 0.5.12.13）：
     捕捉门控 5 处 `$farm_stage gte 10 and $lurkers_held lt 1`；
     冰箱门控 `$lurkers_held gte 1 and $hookah.lurkers lt 5` + `<<switch $hookah.lurkers>>` 只映射 1–5；
     成功结算 `$lurkers_held += 1` 本身无上界。
   本文件的两条语义：
     ① 无上限 —— 由 07f-lurker0-patch 在 SugarCube 启动前改 passage 文本解除门控，手持/冰箱都能累积到任意只；
     ② 保底 —— 补丁未命中时（版本差异/加载顺序），可开"自动搬运"把抓到的转入冰箱与蒸馏笼，
        手上常空使 `lt 1` 恒成立，等价"可以无限次捕捉"（但手持不累积，UI 会如实标注）。
   旧口径（`hookah.lurkers` 一律钳 0–5）已作废：那是把显示缺陷当成上限。 */
var mbCELurkerTimer = null;
var MB_CE_LURKER_MAX = 9999; /* 数值写入上限（原版无上界，这里只做防呆） */
var MB_CE_LURKER_FRIDGE_MAX = MB_CE_LURKER_MAX; /* 兼容旧符号：冰箱不再钳 5 */
function mbCELurkerV() {
	try { return (typeof getV === "function") ? getV() : null; } catch (e) { return null; }
}
function mbCELurkerState() {
	var V = mbCELurkerV();
	if (!V) { return { ok: false, message: "存档变量不可用" }; }
	var patch = (typeof mbCELurkerPatchReport === "function") ? mbCELurkerPatchReport() : null;
	return {
		ok: true,
		held: (typeof V.lurkers_held === "number") ? V.lurkers_held : null,
		fridge: (V.hookah && typeof V.hookah === "object" && typeof V.hookah.lurkers === "number") ? V.hookah.lurkers : null,
		juice: (V.hookah && typeof V.hookah === "object" && typeof V.hookah.juice === "number") ? V.hookah.juice : null,
		stored: (typeof V.lurkers_stored === "number") ? V.lurkers_stored : null,
		captured: (typeof V.stat_lurkers_captured === "number") ? V.stat_lurkers_captured : null,
		farmStage: (typeof V.farm_stage === "number") ? V.farm_stage : null,
		auto: !!(V.mbCE_lurkerAuto),
		patch: patch
	};
}
function mbCELurkerSet(path, val) {
	return cheatWriteValue("player-self", "p:lurker:" + path, "value_set", path, val, "number", 0, MB_CE_LURKER_MAX);
}
/* 自动搬运一轮：held → 冰箱 → 农场笼；返回搬运只数（仅在补丁未生效时由玩家手动开启） */
function mbCELurkerAutoTick() {
	try {
		var V = mbCELurkerV();
		if (!V || !V.mbCE_lurkerAuto) { return 0; }
		var held = (typeof V.lurkers_held === "number") ? V.lurkers_held : 0;
		if (held < 1) { return 0; }
		if (typeof mbCELockHas === "function" && mbCELockHas("lurkers_held")) { return 0; } /* 锁定优先，不抢写 */
		var moved = 0;
		if (V.hookah && typeof V.hookah === "object") {
			var hl = (typeof V.hookah.lurkers === "number") ? V.hookah.lurkers : 0;
			/* 补丁生效后冰箱无上限，直接全搬；未生效时也照搬（消耗/pluralise 按真实值走，仅文案显示降级） */
			V.hookah.lurkers = hl + held;
			moved += held; held = 0;
		}
		if (held > 0) {
			V.lurkers_stored = ((typeof V.lurkers_stored === "number") ? V.lurkers_stored : 0) + held;
			moved += held; held = 0;
		}
		V.lurkers_held = held;
		V.mbCE_lurkerMoved = ((typeof V.mbCE_lurkerMoved === "number") ? V.mbCE_lurkerMoved : 0) + moved;
		return moved;
	} catch (e) { return 0; }
}
function mbCELurkerEnsureTimer() {
	try {
		var V = mbCELurkerV();
		var on = !!(V && V.mbCE_lurkerAuto);
		if (on && !mbCELurkerTimer) {
			mbCELurkerTimer = setInterval(function () {
				var moved = mbCELurkerAutoTick();
				if (moved && typeof renderGlobal === "function" && root.querySelector('[data-pane="global"]')) { renderGlobal(); }
			}, 500);
		} else if (!on && mbCELurkerTimer) {
			clearInterval(mbCELurkerTimer); mbCELurkerTimer = null;
		}
	} catch (e) { /* 面板未就绪时静默 */ }
}
function mbCELurkerSetAuto(on) {
	var V = mbCELurkerV();
	if (!V) { return { ok: false, message: "存档变量不可用" }; }
	V.mbCE_lurkerAuto = !!on;
	mbCELurkerEnsureTimer();
	return {
		ok: true,
		message: on
			? "已开启自动搬运（保底模式）：抓到即刻转入冰箱与农场笼，手上常空 → 捕捉链永不被上限卡住"
			: "已关闭自动搬运：手持可累积（解限补丁生效时正常无上限）"
	};
}
function mbCELurkerPatchLabel(st) {
	if (st && st.patch && st.patch.ok) {
		var extra = "";
		if (st.patch.kept) { extra += " · 长度守恒 " + st.patch.kept; }
		if (st.patch.skipped) { extra += " · 汉化在场保留 switch " + st.patch.skipped; }
		return "解限补丁：已生效（" + st.patch.hits + " 处" + extra + "）";
	}
	return "解限补丁：未命中";
}
function mbCERenderLurker(pane) {
	if (!pane) { return; }
	mbCELurkerEnsureTimer();
	var st = mbCELurkerState();
	var sec = mceNewSec(pane, 9, "潜伏者", "原版上限来自 twee 门控（不是数值上限）：捕捉 `$farm_stage gte 10 and $lurkers_held lt 1`（5 处）、存冰箱 `$lurkers_held gte 1 and $hookah.lurkers lt 5`、冰箱文案只映射 1–5。CE 在 SugarCube 启动前改这些 passage 文本（不动磁盘上的任何模组包），手持与冰箱都可累积到任意只。改法为「等长替换」（右补空格，字符总数不变）——汉化包按字符偏移逐条匹配译文，长度一变就会整段落回英文（v2.0.4 修复）。汉化在场时冰箱 switch 原文保留（>5 只原版文案显示 no，真实数量看本面板数值），否则改写成真实数值。未命中时可用下方「自动搬运」保底：手上常空，等价无限次捕捉。");
	if (!st.ok) { sec.appendChild(el("div", "mce-err", st.message)); return; }
	var rows = [
		{ path: "lurkers_held", name: "手持潜伏者（无上限）", cur: st.held, note: "原版 ≥1 即不再出网；解限后不再受限" },
		{ path: "hookah.lurkers", name: "水烟馆冰箱（无上限）", cur: st.fridge, note: "≥1 可消耗换 50 juice；未装汉化时显示真实数量，装汉化时 >5 保留原版 no（真实数量看本行数值）" },
		{ path: "lurkers_stored", name: "农场蒸馏笼", cur: st.stored, note: "farm_stage ≥9 时每 7 天 1 只 → 1 瓶" }
	];
	rows.forEach(function (r) {
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", r.name + "（当前 " + (r.cur == null ? "—" : r.cur) + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = (r.cur == null) ? "0" : String(r.cur);
		inp.title = r.note;
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () {
			var raw = String(inp.value || "").trim();
			if (!/^-?\d+(?:\.\d+)?$/.test(raw)) { setStatus("请输入数字", "mce-err"); return; }
			var res = mbCELurkerSet(r.path, Number(raw));
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderGlobal();
		});
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () {
			var res = undoCheatModValue("player-self", "p:lurker:" + r.path);
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderGlobal();
		});
		row.appendChild(inp); row.appendChild(b); row.appendChild(und);
		sec.appendChild(row);
	});
	var actRow = el("div", "mce-row");
	var rep = el("button", "mce-btn mce-gold", "重新应用解限补丁"); rep.type = "button";
	rep.title = "DOM 通道已过时点时改 Story 文本重试（普通剧情入口有效，widget 定义无法覆盖）";
	rep.addEventListener("click", function () {
		var r = mbCELurkerRepatch();
		setStatus(r.message, r.ok ? "mce-ok" : "mce-warn");
		renderGlobal();
	});
	var sw = el("button", st.auto ? "mce-btn mce-gold" : "mce-btn", st.auto ? "自动搬运：开" : "自动搬运：关");
	sw.type = "button";
	sw.title = "补丁未命中时的保底：每 0.5 秒把手持潜伏者转入冰箱/蒸馏笼，手上常空 → 捕捉不再被 1 只卡住";
	sw.addEventListener("click", function () {
		var r = mbCELurkerSetAuto(!st.auto);
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		renderGlobal();
	});
	actRow.appendChild(rep); actRow.appendChild(sw);
	sec.appendChild(actRow);
	sec.appendChild(el("div", "mce-hint",
		mbCELurkerPatchLabel(st) + "；累计捕获 " + (st.captured == null ? "—" : st.captured) + " 只；自动搬运累计 " + mbCELurkerMovedText() + " 只"));
}
/* v2.0.0.005 清理：原 mbCELurkerAutoLabel() 删除（拆分期遗留死代码）——上方「自动搬运：开/关」
   按钮渲染一直用内联三元，该函数全仓零引用。 */
function mbCELurkerMovedText() {
	var V = mbCELurkerV();
	return (V && typeof V.mbCE_lurkerMoved === "number") ? V.mbCE_lurkerMoved : 0;
}
