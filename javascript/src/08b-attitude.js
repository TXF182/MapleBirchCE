	/* ============ v2.0.0.003 需求②：原版「你对什么感到不安?」直写 ============
	   对照 DoL 0.5.12.13 本体逐行实证（game\Degrees of Lewdity.html）：
	     · 默认值块 182418-182424：<<set $uncomfortable to {underwear:true, nude:true, prostituting:true, lewd:true, hypnosis:true}>>
	     · cheat 设置页渲染段 283966-284017：「What makes you feel uncomfortable?」
	       每项形如 <<if $attitudesControl.unlockXxx or $uncomfortable.xxx is false>> ... <<else>> disabled 灰勾 + 蓝字门槛 <</if>>
	     · 重算覆盖点 284869-284895 <<widget "attitudesControlCheck">>：
	         unlockExhibitionismUnderwear = V.exhibitionism >= 55
	         unlockExhibitionismNude      = V.exhibitionism >= 95
	         unlockProstitution           = V.soldCount >= 1 || V.docksrobinintro === 1
	         unlockLewd                   = V.exhibitionism >= 35 || V.promiscuity >= 35 || V.deviancy >= 35
	         unlockHypnosis               = Object.keys(V.hypnosis_traits).length >= 1
	   结论：写 $attitudesControl.unlock* 无效（每次刷新都被重算覆盖），
	   真正决定「这一项能不能改」的是 $uncomfortable.* 本身——它才是全游戏读取的最终生效值
	   （110132-110133 遮体判据 / 77312 露骨值衰减 / 202829+ 催眠接受判据）。
	   所以本面板直接写 $uncomfortable.*，不看门槛；门槛只作为说明展示。 ============ */
var MB_CE_ATTITUDE_ITEMS = [
	{ key: "underwear", gate: "unlockExhibitionismUnderwear", need: "exhibitionism>=55", name: "把内衣暴露出来",
		effect: "取消后，暴露 1 档（只走光）不再自动遮掩（本体 110132-110133：underwear && exposed>=1）" },
	{ key: "nude", gate: "unlockExhibitionismNude", need: "exhibitionism>=95", name: "在别人面前赤身裸体",
		effect: "取消后，暴露 2 档（全裸）不再自动遮掩（本体 110132-110133：nude && exposed>=2）" },
	{ key: "prostituting", gate: "unlockProstitution", need: "soldCount>=1 或 docksrobinintro===1", name: "出卖自己的身体以免受贝利的折磨",
		effect: "取消后，promiscuity 不够时也会多出「勉强顺从 / 开价接活」这类走投无路选项（本体 41 处 'is false' 分支，置 _desperateaction）" },
	{ key: "lewd", gate: "unlockLewd", need: "exhibitionism/promiscuity/deviancy 任一>=35（hard 模式不显示该项）", name: "反思你施加和承受过的折磨",
		effect: "取消后，三项不再每日 -1（本体 77312：gamemode !== hard 且 lewd 为真时各减 1；hard 模式本来就不衰减）" },
	{ key: "hypnosis", gate: "unlockHypnosis", need: "hypnosis_traits 非空（至少中过一次催眠）", name: "被催眠着做爱",
		effect: "取消后，催眠遮蔽效果直接判为 accepted（本体 202829：跳过 willpower 意志判定）" }
];
/* 门槛只作展示：返回该门的原版真实解锁状态 + 需要的数值条件（便于玩家自己判断要不要顺手抬数值） */
function mbCEAttitudeGate(gateKey) {
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	var item = null;
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) { if (it.gate === gateKey) { item = it; } });
	if (!item) { return null; }
	var unlocked = false;
	try { unlocked = !!(V && V.attitudesControl && V.attitudesControl[gateKey]); } catch (e2) { unlocked = false; }
	return { key: gateKey, need: item.need, ok: unlocked };
}
function mbCEAttitudeItem(key) {
	var hit = null;
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) { if (it.key === key) { hit = it; } });
	return hit;
}
function mbCEAttitudeGet(key) {
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	try { return (V && V.uncomfortable) ? V.uncomfortable[key] : undefined; } catch (e2) { return undefined; }
}
/* 直写最终生效值，复用 04b 的通用写入器 → 自动获得类型校验 + 首次 before 留痕 + 回退能力。
   modId 固定 vanilla-attitudes，留痕键 cheat:vanilla-attitudes:<key>，回退走 undoCheatModValue。 */
function mbCEAttitudeSet(key, val) {
	var item = mbCEAttitudeItem(key);
	if (!item) { return { ok: false, message: "未知不安项：" + key + "（可选 " + MB_CE_ATTITUDE_ITEMS.map(function (x) { return x.key; }).join(" / ") + "）" }; }
	if (val !== true && val !== false) { return { ok: false, message: "值必须是 true / false（布尔）" }; }
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	if (!V) { return { ok: false, message: "存档变量不可用" }; }
	if (!V.uncomfortable || typeof V.uncomfortable !== "object") { V.uncomfortable = {}; }
	return cheatWriteValue("vanilla-attitudes", key, "set", "uncomfortable." + key, val, "boolean");
}
function mbCEAttitudeSetAll(val) {
	if (val !== true && val !== false) { return { ok: false, message: "值必须是 true / false（布尔）" }; }
	var fails = [];
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) {
		var r = mbCEAttitudeSet(it.key, val);
		if (!r || !r.ok) { fails.push(it.key); }
	});
	if (fails.length) { return { ok: false, message: "部分失败：" + fails.join(" / ") }; }
	return { ok: true, message: "已把 5 项不安全部" + (val ? "恢复（重新勾选）" : "解除（取消勾选）") };
}
function mbCEAttitudeUndo(key) { return undoCheatModValue("vanilla-attitudes", key); }
function mbCEAttitudeHasTrace(key) {
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	try { return !!(V && V.mbCE_wrote && V.mbCE_wrote["cheat:vanilla-attitudes:" + key]); } catch (e2) { return false; }
}
/* 全局页分组：5 项逐条开关 + 一键全解除/全恢复 + 逐条回退 */
function renderAttitudesGroup(pane) {
	if (!pane) { return; }
	var box = el("div", "mce-grp");
	box.appendChild(el("div", "mce-row-lbl", "原版态度：你对什么感到不安?（$uncomfortable，等价原版 cheat 面板同一屏）"));
	box.appendChild(el("div", "mce-hint",
		"直接写最终生效值 $uncomfortable.*，不看 $attitudesControl.unlock* 门控——那组 unlock 每次刷新都会被原版 attitudesControlCheck 按真实数值重算覆盖，写它无效。门控条件只作说明展示。"));
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	if (!V || !V.uncomfortable || typeof V.uncomfortable !== "object") {
		box.appendChild(el("div", "mce-err", "存档里没有 $uncomfortable（请先读档；原版初始化后该对象才会存在）"));
		pane.appendChild(box);
		return;
	}
	/* 局部刷新：点击只改本行 DOM，不整页 renderGlobal()（全局页分组多，整页重建会丢滚动位置且卡帧） */
	var painters = [];
	function paintAttitudeRow(parts) {
		var val = mbCEAttitudeGet(parts.it.key);
		var state = (val === true) ? "不安（勾选）" : (val === false) ? "已解除（不勾选）" : "未初始化";
		var g = mbCEAttitudeGate(parts.it.gate);
		parts.lbl.textContent = parts.it.name + "：" + state;
		parts.lbl.title = parts.it.effect + "\n原版门槛：" + parts.it.need + (g && g.ok ? "（当前已满足）" : "（当前未满足，本面板照样能改）");
		parts.tog.textContent = (val === true) ? "解除不安" : "恢复不安";
		parts.tog.className = (val === true) ? "mce-btn mce-gold" : "mce-btn";
		var needUndo = mbCEAttitudeHasTrace(parts.it.key);
		if (needUndo && !parts.undo) {
			parts.undo = el("button", "mce-btn", "回退");
			parts.undo.type = "button";
			parts.undo.title = "还原为面板首次写入前的状态";
			parts.undo.addEventListener("click", function () {
				var r = mbCEAttitudeUndo(parts.it.key);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				paintAttitudeRow(parts);
			});
			parts.row.appendChild(parts.undo);
		} else if (!needUndo && parts.undo) {
			try { parts.row.removeChild(parts.undo); } catch (e2) { /* 已被整组重建移除 */ }
			parts.undo = null;
		}
	}
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) {
		var parts = { it: it, row: el("div", "mce-row"), lbl: el("span", "mce-row-lbl", ""), tog: el("button", "mce-btn", ""), undo: null };
		parts.tog.type = "button";
		parts.tog.title = it.effect;
		parts.tog.addEventListener("click", function () {
			var now = mbCEAttitudeGet(it.key) === true;
			var r = mbCEAttitudeSet(it.key, !now);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			paintAttitudeRow(parts);
		});
		parts.row.appendChild(parts.lbl);
		parts.row.appendChild(parts.tog);
		paintAttitudeRow(parts);
		painters.push(function () { paintAttitudeRow(parts); });
		box.appendChild(parts.row);
	});
	var bulk = el("div", "mce-row");
	var offAll = el("button", "mce-btn mce-gold", "全部解除不安（5 项取消勾选）");
	offAll.type = "button";
	offAll.addEventListener("click", function () {
		var r = mbCEAttitudeSetAll(false);
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		painters.forEach(function (f) { try { f(); } catch (e2) { /* 单行刷新失败不影响其余 */ } });
	});
	bulk.appendChild(offAll);
	var onAll = el("button", "mce-btn", "全部恢复不安（5 项勾选）");
	onAll.type = "button";
	onAll.addEventListener("click", function () {
		var r = mbCEAttitudeSetAll(true);
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		painters.forEach(function (f) { try { f(); } catch (e2) { /* 单行刷新失败不影响其余 */ } });
	});
	bulk.appendChild(onAll);
	box.appendChild(bulk);
	box.appendChild(el("div", "mce-hint",
		"注意：这 5 项是原版的「态度」设定，改的是你自己对这些事的接受度；写入即改 $uncomfortable 本身，重开原版 cheat 页那一屏会按当前值显示（读的是同一个变量）。"));
	pane.appendChild(box);
}
