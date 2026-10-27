/* ============================================================
 * 07f-lock.js — 数值固定（Lock Values）
 * 需求实证（玩家反馈 + 模组对照源码核对 dw252）：
 *  - 枯木逢春渡鸦转化 maplebirch.transformation.raven.build：未戴「渡鸦羽毛项链」时
 *    每日衰减（Raven.ts decayConditions: build≥1 && 项链≠raven feather necklace）
 *  - 原版天使转化 angel：无三位一体（VanillaPlus.divineTransformations.trinity）时
 *    成长点数仍会减少（Trinity 特质说明 "their development points no longer decrease"）
 *  - 堕天使每日纯洁流失 / 恶魔高于最低纯洁结束日压力（VanillaPlus 特质文本）
 *  - 亡灵转化 maplebirch.transformation.undead.level：诅咒每游戏小时 Psyche -2 + 压力
 *    （Undead.ts regTimeEvent onSec deadwood-undead-curse），来源为金币洞穴诅咒
 * 机制：锁定向存 V.mbCE_lock（[{path,target}]，存档内持久，读档自动恢复）；
 *      常驻 1s 定时器遍历写回（直写不留痕，复用 setPathVal；无锁定向空转直接返回）。
 *      UI 挂「全局」页 renderGlobal 末尾（mbCERenderLock）。
 * ============================================================ */

/* 预设推荐项：真实键名全部来自 CE 适配器声明/模组对照源码（dw252）与 DoL 原版转化键 */
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
function mbCELockHas(path) {
	var list = mbCELockData();
	if (!list) { return false; }
	for (var i = 0; i < list.length; i++) { if (list[i] && list[i].path === path) { return true; } }
	return false;
}
function mbCELockTarget(path) {
	var list = mbCELockData();
	if (!list) { return undefined; }
	for (var i = 0; i < list.length; i++) { if (list[i] && list[i].path === path) { return list[i].target; } }
	return undefined;
}
function mbCELockSet(path, target) {
	var Vp = getV();
	if (!Vp || !path) { return { ok: false, message: "存档变量不可用或路径为空" }; }
	/* 路径段校验：拒绝空段（"a..b"）与纯点串，防建脏键 */
	var pParts = String(path).split(".");
	for (var pi = 0; pi < pParts.length; pi++) { if (!pParts[pi]) { return { ok: false, message: "路径格式无效（存在空段）：" + path }; } }
	var num = Number(target);
	if (!isFinite(num)) { return { ok: false, message: "锁定目标必须是有限数值" }; }
	var list = mbCELockData();
	if (!list) { return { ok: false, message: "存档变量不可用" }; }
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].path === path) { list[i].target = num; mbCELockEnsureTimer(); mbCELockTick(); return { ok: true, message: "已更新锁定 " + path + " = " + num }; }
	}
	list.push({ path: path, target: num });
	mbCELockEnsureTimer();
	mbCELockTick(); /* 立即生效：点击即改值，不等下个 1s tick（不存在的键仍跳过，不凭空创建） */
	return { ok: true, message: "已锁定 " + path + " = " + num };
}
function mbCELockRemove(path) {
	var Vp = getV();
	var list = Vp && Vp.mbCE_lock;
	if (!list) { return { ok: false, message: "无锁定记录" }; }
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].path === path) { list.splice(i, 1); mbCELockEnsureTimer(); return { ok: true, message: "已取消锁定 " + path }; }
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

/* 强制写回：当前值 ≠ 锁定目标 → 直写（不留痕，复用 setPathVal）。
   安全边界：当前值不存在（undefined）时跳过——只固定「已存在」的值，
   绝不因锁定而 setPathVal 凭空创建字段（防把未触发的转化/未开的键造出来）。 */
function mbCELockTick() {
	var Vp = getV();
	var list = Vp && Vp.mbCE_lock;
	if (!Vp || !Array.isArray(list) || !list.length) { return; }
	for (var i = 0; i < list.length; i++) {
		var it = list[i];
		if (!it || !it.path) { continue; }
		var cur = mbCELockRead(Vp, it.path);
		if (cur === undefined) { continue; }
		if (Number(cur) !== Number(it.target)) { setPathVal(Vp, it.path, Number(it.target)); }
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

/* 全局页区块渲染（由 renderGlobal 在末尾调用；pane = [data-pane="global"] 容器） */
function mbCERenderLock(pane) {
	if (!pane) { return; }
	mbCELockEnsureTimer(); /* 开面板兜底：读档后已有锁定向时恢复写回 */
	var sec = el("div", "mce-section", "数值固定（防游戏机制改动）");
	pane.appendChild(sec);
	sec.appendChild(el("div", "mce-hint", "锁定后每 1 秒强制写回目标值，直到手动取消；锁定表存于存档 V.mbCE_lock，读档自动恢复。预设为模组实证键：渡鸦转化未戴羽毛项链会每日衰减、天使无三位一体成长点会减少、堕天使每日纯洁流失、亡灵诅咒每秒扣 Psyche/涨压力——锁目标值即可防这些机制改值。"));
	var Vg = getV();
	var presetPaths = {};
	MB_CE_LOCK_PRESETS.forEach(function (p) { presetPaths[p.path] = true; });
	var makeRow = function (it, locked) {
		var row = el("div", "mce-row");
		row.setAttribute("data-lockpath", it.path);
		var lbl = el("span", "mce-row-lbl", it.name + "（" + it.path + "）当前 ");
		var val = el("span", "mce-value", String(mbCELockRead(Vg, it.path) === undefined ? "—" : mbCELockRead(Vg, it.path)));
		lbl.appendChild(val);
		if (it.note) { lbl.appendChild(el("span", "mce-ab-note", " " + it.note)); }
		row.appendChild(lbl);
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
		sec.appendChild(row);
	};
	/* 预设行：未锁定 → 「锁定」；已锁定 → 「更新目标/取消」 */
	MB_CE_LOCK_PRESETS.forEach(function (p) { makeRow(p, mbCELockHas(p.path)); });
	/* 已锁定的自定义项（不在预设列表）也显示，便于取消 */
	var list = mbCELockData();
	if (list) {
		for (var i = 0; i < list.length; i++) {
			var li = list[i];
			if (!li || !li.path || presetPaths[li.path]) { continue; }
			makeRow({ path: li.path, name: "自定义", note: "" }, true);
		}
	}
	/* 自由添加 */
	var addRow = el("div", "mce-row");
	addRow.appendChild(el("span", "mce-row-lbl", "自由添加（任意 varPath，按数值写回）："));
	var addPath = el("input", "mce-inp");
	addPath.type = "text";
	addPath.value = "";
	addPath.placeholder = "如 more_love_interests.x.love";
	addPath.style.width = "200px";
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
