/* ============================================================
 * 07f-lock.js — 数值固定（Lock Values）
 * 需求实证（玩家反馈 + 模组对照源码核对 dw257）：
 *  - 枯木逢春渡鸦转化 maplebirch.transformation.raven.build：未戴「渡鸦羽毛项链」时
 *    每日衰减（Raven.ts decayConditions: build≥1 && 项链≠raven feather necklace）
 *  - 原版天使转化 angel：无三位一体（VanillaPlus.divineTransformations.trinity）时
 *    成长点数仍会减少（Trinity 特质说明 "their development points no longer decrease"）
 *  - 堕天使每日纯洁流失 / 恶魔高于最低纯洁结束日压力（VanillaPlus 特质文本）
 *  - 亡灵转化 maplebirch.transformation.undead.level：诅咒每游戏小时 Psyche -2 + 压力
 *    （Undead.ts regTimeEvent onSec deadwood-undead-curse），来源为金币洞穴诅咒
 * 机制：锁定向存 V.mbCE_lock（[{path,target}]，存档内持久，读档自动恢复）；
 *      常驻 1s 定时器遍历写回（v2.0.7 P4：写回前先落 `lock:<path>` 留痕，回退中心可「取消锁定+还原原值」；
 *      同 path 复用一条，before 恒为首次覆盖前的真实值，不影响 400 条留痕窗口）；
 *      无锁定向空转直接返回。UI 挂「全局」页 renderGlobal 末尾（mbCERenderLock）。
 * ============================================================ */

/* 预设推荐项：真实键名全部来自 CE 适配器声明/模组对照源码（dw257）与 DoL 原版转化键 */
var MB_CE_LOCK_PRESETS = [
	{ path: "maplebirch.transformation.raven.build", name: "渡鸦转化点数", note: "未戴渡鸦羽毛项链时每日衰减" },
	{ path: "maplebirch.transformation.horse.build", name: "马转化点数", note: "build≥1 后模组自带停止衰减，可锁" },
	{ path: "maplebirch.transformation.whale.build", name: "鲸转化点数", note: "" },
	{ path: "maplebirch.transformation.undead.level", name: "亡灵转化等级", note: "锁 0 解除亡灵诅咒（每游戏小时扣 Psyche/涨压力）" },
	{ path: "angel", name: "天使转化等级", note: "无三位一体时成长点数会减少/失贞掉级" },
	{ path: "fallenangel", name: "堕落天使等级", note: "≥4 堕天使判定；每日纯洁流失" },
	{ path: "demon", name: "恶魔转化等级", note: "" },
	{ path: "purity", name: "纯洁（0-2000 内部）", note: "面板显示 0-100%，内部 0-2000" }
];

/* 锁定向：V.mbCE_lock = [{ path, target }]（target 恒 number，0/1 也按 number 写，防 ===1 语义破坏） */
function mbCELockData() {
	var Vp = getV();
	if (!Vp || typeof Vp !== "object") { return null; }
	if (!Array.isArray(Vp.mbCE_lock)) { Vp.mbCE_lock = []; }
	return Vp.mbCE_lock;
}
/* v2.0.1：锁定相关文案一律走中文名（原先直接拼 path，状态栏出现「已锁定 history = 1000」这种英文裸 key）。
   取值顺序：快速面板索引的中文 label → 全局键名映射 zhKey → 原 path（三级回落，任何一级缺失都不会显示空串） */
function mbCELockLabel(path) {
	try {
		if (typeof ensureQuickIndex === "function") {
			var it = ensureQuickIndex()[path];
			if (it && it.label) { return it.label; }
		}
	} catch (e) {}
	try {
		if (typeof zhKey === "function") {
			var z = zhKey(path);
			if (z && z !== path) { return z; }
			var leafParts = String(path).split(".");
			var leaf = leafParts[leafParts.length - 1];
			var z2 = zhKey(leaf);
			if (z2 && z2 !== leaf) { return z2; }
		}
	} catch (e2) {}
	return String(path);
}
/* v2.0.8：判定类接口一律**只读**，不经 mbCELockData 建空表——
   此前 mbCELurkerState（只读查询）经 mbCELockHas → mbCELockData 会把 V.mbCE_lock 就地创建出来，
   等于「查一次就改存档」。建表只留给 mbCELockSet/mbCERenderLock 这类明确要写的地方。 */
function mbCELockListRO() {
	try {
		var Vp = getV();
		return (Vp && Array.isArray(Vp.mbCE_lock)) ? Vp.mbCE_lock : null;
	} catch (e) { return null; }
}
function mbCELockHas(path) {
	var list = mbCELockListRO();
	if (!list) { return false; }
	for (var i = 0; i < list.length; i++) { if (list[i] && list[i].path === path) { return true; } }
	return false;
}
function mbCELockTarget(path) {
	var list = mbCELockListRO();
	if (!list) { return undefined; }
	for (var i = 0; i < list.length; i++) { if (list[i] && list[i].path === path) { return list[i].target; } }
	return undefined;
}
/* replay=true：由 08d 的「确认写入」回调重放，跳过预览门控（防递归） */
function mbCELockSet(path, target, replay) {
	var Vp = getV();
	if (!Vp || !path) { return { ok: false, message: "存档变量不可用或路径为空" }; }
	/* 路径段校验：拒绝空段（"a..b"）与纯点串，防建脏键 */
	var pParts = String(path).split(".");
	for (var pi = 0; pi < pParts.length; pi++) { if (!pParts[pi]) { return { ok: false, message: "路径格式无效（存在空段）：" + path }; } }
	var num = Number(target);
	if (!isFinite(num)) { return { ok: false, message: "锁定目标必须是有限数值" }; }
	/* v2.0.7（D4）：锁定同样走 diff 预览——此前 mbCELockSet 直写 setPathVal + 写锁表，完全绕过 gate，
	   导致「锁定」这类最常在面板里做的写入，开预览时反而看不到确认条。 */
	if (!replay && typeof mbCEPreviewGate === "function") {
		var curNow = mbCELockRead(Vp, path);
		if (mbCEPreviewGate(path, curNow === undefined ? "（无此字段）" : curNow, num,
			function () { return mbCELockSet(path, target, true); })) {
			return { ok: false, pending: true, message: "待确认锁定：" + mbCELockLabel(path) + " = " + num };
		}
	}
	var list = mbCELockData();
	if (!list) { return { ok: false, message: "存档变量不可用" }; }
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].path === path) { list[i].target = num; mbCELockEnsureTimer(); mbCELockTick(); return { ok: true, message: "已更新锁定 " + mbCELockLabel(path) + " = " + num }; }
	}
	list.push({ path: path, target: num });
	mbCELockEnsureTimer();
	mbCELockTick(); /* 立即生效：点击即改值，不等下个 1s tick（不存在的键仍跳过，不凭空创建） */
	return { ok: true, message: "已锁定 " + mbCELockLabel(path) + " = " + num };
}
function mbCELockRemove(path) {
	var Vp = getV();
	var list = Vp && Vp.mbCE_lock;
	if (!list) { return { ok: false, message: "无锁定记录" }; }
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].path === path) { list.splice(i, 1); mbCELockEnsureTimer(); return { ok: true, message: "已取消锁定 " + mbCELockLabel(path) }; }
	}
	return { ok: false, message: "该路径未锁定" };
}

/* 深路径读取（只读不建壳；宿主缺失返回 undefined） */
function mbCELockRead(V, path) {
	var parts = String(path).split(".");
	var cur = V;
	for (var i = 0; i < parts.length; i++) {
		if (cur == null || typeof cur !== "object") { return undefined; }
		cur = cur[parts[i]];
	}
	return cur;
}

/* P4（v2.0.7）：锁定写回留痕——同 path 只留一条 `lock:<path>`，before 恒为「第一次被锁定覆盖前的真实值」，
   之后每 1 秒只更新 after/t，不会把 400 条留痕窗口冲掉。回退中心据此可以「取消锁定 + 还原锁定前值」，
   否则玩家在回退中心看不到任何锁定写入（旧实现是直写 setPathVal、完全不留痕）。 */
function mbCELockTrace(Vp, path, before, after) {
	try {
		if (!Vp || !path) { return; }
		if (!Vp.mbCE_wrote || typeof Vp.mbCE_wrote !== "object") { Vp.mbCE_wrote = {}; }
		var key = "lock:" + path;
		var prev = Vp.mbCE_wrote[key];
		if (prev && prev.type === "lock" && typeof prev === "object") {
			/* 原地更新：t 保留首次落痕时间（不然每秒刷新会把这条顶到回退中心最前、挤掉真的一次性写入），
			   last 记最近一次写回，before 只在缺失时补 */
			if (prev.before === undefined) { prev.before = before; }
			prev.after = after;
			prev.last = Date.now();
			return;
		}
		Vp.mbCE_wrote[key] = { type: "lock", path: path, before: before, after: after, t: Date.now(), last: Date.now() };
	} catch (e) {}
}

/* 强制写回：当前值 ≠ 锁定目标 → 先记留痕（mbCELockTrace）再写回。
   安全边界：当前值不存在（undefined）时跳过——只固定「已存在」的值，
   绝不因锁定而 setPathVal 凭空创建字段（防把未触发的转化/未开的键造出来）。 */
function mbCELockTick() {
	var Vp = getV();
	var list = Vp && Vp.mbCE_lock;
	if (!Vp || !Array.isArray(list) || !list.length) { return; }
	var wrote = 0;
	for (var i = 0; i < list.length; i++) {
		var it = list[i];
		if (!it || !it.path) { continue; }
		var cur = mbCELockRead(Vp, it.path);
		if (cur === undefined) { continue; }
		var tgt = Number(it.target);
		/* v2.0.8 形态兜底：旧判据 `Number(cur) !== Number(it.target)` 有两个真缺陷——
		   ① Number(null)===0，让「空值 + 锁 0」被判为已达标、永不写回；
		   ② 字符串键（如 hookah.drink="wine"）被 Number() 成 NaN 后仍走写回，把原值写成数字。
		   现判据：number 严格比；null 视为空值写回；可解析有限数的字符串（"5"）形态归一为数字
		   （模组按 `<<if $X is 5>>` 判，字符串恒假）；其余（布尔 / 对象 / 不可解析字符串 / 空白串）跳过不覆盖。 */
		var need = false;
		if (typeof cur === "number") { need = (cur !== tgt); }
		else if (cur === null) { need = true; }
		else if (typeof cur === "string" && cur.trim() !== "" && isFinite(Number(cur))) { need = true; }
		if (!need) { continue; }
		mbCELockTrace(Vp, it.path, cur, tgt);
		setPathVal(Vp, it.path, tgt);
		wrote++;
	}
	/* 锁定条数多时（每个 path 一条留痕）仍要守住 400 条窗口，走同一套 trim */
	if (wrote && typeof mbCEWroteTrim === "function") {
		try { mbCEWroteTrim(Vp); } catch (eTrim) {}
	}
}

/* 惰性定时器：有锁定向才启动 1s 写回（无锁定向不空转——防 jsdom/测试进程被挂起句柄拖住），
   启动时机：mbCELockSet/Remove 成功后、renderGlobal 渲染锁定区块时、模块加载时兜底（读档恢复） */
var mbCELockTimer = null;
function mbCELockEnsureTimer() {
	try {
		var Vp = getV();
		var list = Vp && Vp.mbCE_lock;
		var has = Array.isArray(list) && list.length > 0;
		if (has && !mbCELockTimer) {
			mbCELockTimer = setInterval(function () { try { mbCELockTick(); } catch (e) {} }, 1000);
		} else if (!has && mbCELockTimer) {
			clearInterval(mbCELockTimer);
			mbCELockTimer = null;
		}
	} catch (e) {}
}

/* 锁定来源判定（P1：自定义锁定项默认收进折叠组，这里给每行标出「谁锁的」）：
   ① 命中快速面板索引 → 角色页锁的；② 留痕里同 path 的 cheat 记录 → Mod作弊页锁的；③ 其余 → 手动自由添加 */
function mbCELockSource(path) {
	try {
		if (typeof ensureQuickIndex === "function") {
			var idx = ensureQuickIndex();
			if (idx && idx[path]) { return "角色页"; }
		}
	} catch (e) {}
	try {
		var w = getV() && getV().mbCE_wrote;
		if (w) {
			var ks = Object.keys(w);
			for (var i = 0; i < ks.length; i++) {
				var rec = w[ks[i]];
				if (rec && rec.type === "cheat" && rec.path === path) { return "Mod作弊"; }
			}
		}
	} catch (e2) {}
	return "手动";
}

/* 全局页区块渲染（由 renderGlobal 在末尾调用；pane = [data-pane="global"] 容器） */
function mbCERenderLock(pane) {
	if (!pane) { return; }
	mbCELockEnsureTimer(); /* 开面板兜底：读档后已有锁定向时恢复写回 */
	var sec = mceNewSec(pane, 8, "数值固定", "锁定后每 1 秒强制写回目标值，直到手动取消；锁定表存于存档 V.mbCE_lock，读档自动恢复。预设为模组实证键：渡鸦转化未戴羽毛项链会每日衰减、天使无三位一体成长点会减少、堕天使每日纯洁流失、亡灵诅咒每秒扣 Psyche/涨压力——锁目标值即可防这些机制改值。");
	var Vg = getV();
	var presetPaths = {};
	MB_CE_LOCK_PRESETS.forEach(function (p) { presetPaths[p.path] = true; });
	var makeRow = function (it, locked, parent) {
		var row = el("div", "mce-row");
		row.setAttribute("data-lockpath", it.path);
		var lbl = el("span", "mce-row-lbl", it.name + "（" + it.path + "）当前 ");
		var val = el("span", "mce-value", String(mbCELockRead(Vg, it.path) === undefined ? "—" : mbCELockRead(Vg, it.path)));
		lbl.appendChild(val);
		if (it.note) { lbl.appendChild(el("span", "mce-ab-note", " " + it.note)); }
		/* v2.0.8：锁了但当前值不是数值形态 → tick 会跳过（不覆盖原值），这里必须明示，不能静默失效 */
		if (locked) {
			var cv0 = mbCELockRead(Vg, it.path);
			var cvNumOk = (cv0 === null) || (typeof cv0 === "number")
				|| (typeof cv0 === "string" && cv0.trim() !== "" && isFinite(Number(cv0)));
			if (!cvNumOk && cv0 !== undefined) { lbl.appendChild(el("span", "mce-ab-note", " 当前值非数值，锁定不会写回")); }
		}
		row.appendChild(lbl);
		/* P1：自定义项标注来源，让玩家一眼看出这条不是预设、是被哪个页面锁上的 */
		if (it.source) { row.appendChild(el("span", "mce-badge mce-src", it.source)); }
		var inp = el("input", "mce-inp");
		inp.type = "number";
		inp.value = String(locked ? it.target : (Number(mbCELockRead(Vg, it.path)) || 0));
		inp.placeholder = "目标值";
		row.appendChild(inp);
		var btn = el("button", "mce-btn" + (locked ? " mce-gold" : ""), locked ? "更新目标" : "锁定");
		btn.type = "button";
		btn.addEventListener("click", function () {
			var r = mbCELockSet(it.path, Number(inp.value));
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (r.ok) { renderGlobal(); }
		});
		/* v1.9.15 输入框回车即提交（等价点击按钮） */
		inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { btn.click(); } });
		row.appendChild(btn);
		if (locked) {
			var ub = el("button", "mce-btn mce-red", "取消");
			ub.type = "button";
			ub.addEventListener("click", function () {
				var r = mbCELockRemove(it.path);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) { renderGlobal(); }
			});
			row.appendChild(ub);
		}
		(parent || sec).appendChild(row);
	};
	/* 预设行：未锁定 → 「锁定」；已锁定 → 「更新目标/取消」 */
	MB_CE_LOCK_PRESETS.forEach(function (p) { makeRow(p, mbCELockHas(p.path)); });
	/* P1（玩家图 3/图 4）：自定义锁定项**不再平铺在「⑧数值固定」列表里**——
	   属性页能锁的 beauty/physique/willpower/skulduggery/danceskill/swimmingskill/athletics
	   全不是预设，原先会被无条件追加成 7 行，把全局页撑成一张「锁定数值清单」。
	   现在收进默认收起的折叠组，并逐行标注来源（角色页 / Mod作弊 / 手动）。 */
	var list = mbCELockListRO();
	var customs = [];
	if (list) {
		for (var i = 0; i < list.length; i++) {
			var li = list[i];
			if (!li || !li.path || presetPaths[li.path]) { continue; }
			customs.push(li);
		}
	}
	if (customs.length) {
		var ckey = "lock:custom";
		var openC = !!(typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.collapsed && mbCEUiState.collapsed[ckey] === 0);
		var grp = el("div", "mce-grp");
		var head = el("div", "mce-grp-t mce-collapse-head", (openC ? "▾ " : "▸ ") + "其他已锁定（来自角色页 / Mod作弊页）　" + customs.length + " 条");
		var body = el("div", "mce-grp-body");
		body.setAttribute("data-collapsed", openC ? "0" : "1");
		head.addEventListener("click", function () {
			var open = body.getAttribute("data-collapsed") !== "1";
			body.setAttribute("data-collapsed", open ? "1" : "0");
			head.textContent = (open ? "▸ " : "▾ ") + "其他已锁定（来自角色页 / Mod作弊页）　" + customs.length + " 条";
			if (typeof mbCEUiCollapsed === "function") { mbCEUiCollapsed(ckey, !open); }
		});
		grp.appendChild(head);
		grp.appendChild(body);
		body.appendChild(el("div", "mce-hint", "这些不是预设项，是你在角色页（快速面板 / 转化）或 Mod 作弊页点过「锁定」后落到 $V.mbCE_lock 的；默认收起，展开可改目标值或取消。"));
		customs.forEach(function (li) {
			makeRow({ path: li.path, name: mbCELockLabel(li.path), note: "", source: mbCELockSource(li.path) }, true, body);
		});
		sec.appendChild(grp);
	}
	/* 自由添加 */
	var addRow = el("div", "mce-row");
	addRow.appendChild(el("span", "mce-row-lbl", "自由添加（任意 varPath，按数值写回）："));
	var addPath = el("input", "mce-inp mce-path");
	addPath.type = "text";
	addPath.value = "";
	addPath.placeholder = "如 more_love_interests.x.love";
	addRow.appendChild(addPath);
	var addVal = el("input", "mce-inp");
	addVal.type = "number";
	addVal.value = "0";
	addVal.placeholder = "目标值";
	addRow.appendChild(addVal);
	var addBtn = el("button", "mce-btn mce-gold", "添加");
	addBtn.type = "button";
	addBtn.addEventListener("click", function () {
		var p = String(addPath.value || "").trim();
		if (!p) { setStatus("请填写要固定的 varPath", "mce-err"); return; }
		var r = mbCELockSet(p, Number(addVal.value));
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		if (r.ok) { renderGlobal(); }
	});
	/* v1.9.15 自由添加输入框回车即提交 */
	var submitAdd = function (e) { if (e.key === "Enter") { addBtn.click(); } };
	addPath.addEventListener("keydown", submitAdd);
	addVal.addEventListener("keydown", submitAdd);
	addRow.appendChild(addBtn);
	sec.appendChild(addRow);
}

/* 模块加载兜底：读档后 V 已有锁定向时恢复写回（V 未就绪时静默跳过，开面板时 mbCERenderLock 再补） */
mbCELockEnsureTimer();
