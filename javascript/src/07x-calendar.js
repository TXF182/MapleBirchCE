/* 职责：事件日历页签 —— 未来 14 天逐日列出原版时间敏感事件，并提供「跳到该天」与原版语义的租金锁定入口。
 *
 * 取证（DoL 0.5.12.13 HTML，行号即源码位置，勿凭印象改口径）：
 *   · 起点/偏移：Time.set 用 new DateTime(2022, 9, 4, 7) 作 $startDate，V.timeStamp 为相对起点的毫秒偏移（L76786–76795）
 *   · 假期月份：holidayMonths = [4, 7, 8, 12]（L76779），Time.schoolTerm 据此判定学期/假期
 *   · 租金：$rentday = 收租星期（1=周日…7=周六，L76696 定义；交租后 <<set $rentday to Time.weekDay>> L346510）；
 *     $renttime <= 0 视为逾期（L308066「Bailey is looking for you」）
 *   · 贝利扣押：赎回截止 = 扣押日 + 7、变卖 = 扣押日 + 8，均以 Time.days 相对（L308077–308078）
 *   · 跳日：passTime(time, type) → Time.pass(毫秒)（L76623–76627），type 用 "day"
 *
 * 诚实边界（UI 文案必须与本段一致）：
 *   · passTime 只推进时间，不触发每日结算（催租、考试判定都在 passage 内），所以「跳到」是快进观看，不是跳过剧情。
 *   · 原版没有常驻节假日表（圣诞节只有服装/装饰条目），本版不造节日行；「学校假期」按月份标注，不编造具体日期。
 *   · 游戏日按 floor(V.timeStamp / 一天) 近似（起点 07:00），仅用于扣押相对日推算，不写回任何变量。
 *   · 「禁用」不做自由改写（会造半结算存档）：租金侧给的是 07m 已有的原版语义锁定（rent-lock）。
 */

var MCE_CAL_SPAN = 14;
var MCE_CAL_MAXSPAN = 30;
var MCE_CAL_HOLIDAY_MONTHS = [4, 7, 8, 12];
var MCE_CAL_WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
var MCE_CAL_DAY_MS = 86400000;

/* 当前游戏时间：优先 V.startDate + V.timeStamp（原版存的就是这两个），缺失即 null（不猜测） */
function mbCECalNow(V) {
	var start = Number(V && V.startDate);
	var off = Number(V && V.timeStamp);
	if (!isFinite(start) || !isFinite(off)) { return null; }
	var d = new Date(start + off);
	return isNaN(d.getTime()) ? null : d;
}

/* 近似游戏日（Time.days 的 floor 近似），用于扣押相对日；无时间戳返回 null */
function mbCECalGameDay(V) {
	var off = Number(V && V.timeStamp);
	return isFinite(off) ? Math.floor(off / MCE_CAL_DAY_MS) : null;
}

/* 租金判定（拆出以控复杂度）：rentday 1=周日…7=周六；due = 距今天数（0=今天收租） */
function mbCECalRentSetup(V, todayWd) {
	var rentDay = Number(V.rentday);
	var on = !!V.rentday && isFinite(rentDay) && rentDay >= 1 && rentDay <= 7;
	return { on: on, due: on ? ((rentDay - todayWd + 7) % 7) : -1, overdue: Number(V.renttime) <= 0 };
}

/* 扣押判定（拆出以控复杂度）：day 为扣押发生时的游戏日（Time.days） */
function mbCECalConfiscSetup(V) {
	var conf = V.bailey_confiscation;
	var on = !!(conf && conf.items && conf.items.length > 0 && isFinite(Number(conf.day)));
	return { on: on, day: on ? Number(conf.day) : -1 };
}

/* 单日租金标签：只在收租日命中；首行且已逾期给不同文案 */
function mbCECalRentTag(rent, i) {
	if (!rent.on || i !== rent.due) { return null; }
	return (i === 0 && rent.overdue) ? "租金已逾期" : "租金到期";
}

/* 单日扣押标签：扣押日 +7 赎回、+8 变卖（按 Time.days 相对，近似游戏日） */
function mbCECalConfiscTags(conf, gameDay, i) {
	var tags = [];
	if (!conf.on || gameDay === null) { return tags; }
	var rel = gameDay + i - conf.day;
	if (rel === 7) { tags.push("扣押赎回截止"); }
	if (rel === 8) { tags.push("扣押物变卖"); }
	return tags;
}

/* 纯数据：未来 span 天逐日事件（不碰 DOM、不写 V，测试直接断言这个） */
function mbCECalendarRows(V, span) {
	var rows = [];
	var now = mbCECalNow(V);
	if (!now) { return rows; }
	var days = Math.max(1, Math.min(MCE_CAL_MAXSPAN, Math.floor(Number(span) || MCE_CAL_SPAN)));
	var todayWd = now.getDay() + 1; /* JS 0=周日 → 原版 1=周日 */
	var rent = mbCECalRentSetup(V, todayWd);
	var conf = mbCECalConfiscSetup(V);
	var gameDay = mbCECalGameDay(V);
	var i;
	for (i = 0; i < days; i++) {
		var d = new Date(now.getTime() + i * MCE_CAL_DAY_MS);
		var tags = mbCECalConfiscTags(conf, gameDay, i);
		var rt = mbCECalRentTag(rent, i);
		if (rt) { tags.push(rt); }
		if (MCE_CAL_HOLIDAY_MONTHS.indexOf(d.getMonth() + 1) >= 0) { tags.push("学校假期"); }
		rows.push({
			offset: i,
			month: d.getMonth() + 1,
			day: d.getDate(),
			weekday: MCE_CAL_WEEK[d.getDay()],
			tags: tags,
			today: i === 0
		});
	}
	return rows;
}

function mbCECalFmt(r) {
	if (!r) { return "—"; }
	return r.month + "月" + r.day + "日 " + r.weekday;
}

/* 原版 passTime 是否可达：DoL 的 twine-user-script 顶层函数，加载方式不同时可能不挂 window */
function mbCECalJumpReady() {
	return typeof window !== "undefined" && window && typeof window.passTime === "function";
}

function mbCECalJump(offset) {
	var n = Math.floor(Number(offset) || 0);
	if (n <= 0) { return { ok: false, msg: "今天不需要跳转" }; }
	if (!mbCECalJumpReady()) { return { ok: false, msg: "原版 passTime 不可达（当前加载方式未暴露），跳转已禁用" }; }
	try {
		window.passTime(n, "day");
	} catch (e) {
		return { ok: false, msg: "跳转失败：" + (e instanceof Error ? e.message : String(e || "未知异常")) };
	}
	return { ok: true, msg: "已推进 " + n + " 天（原版 passTime，不触发每日结算）" };
}

function mbCECalRowEl(r) {
	var row = el("div", MCE_CLS.row);
	row.appendChild(el("span", "", (r.today ? "今天 · " : "") + mbCECalFmt(r)));
	var i;
	for (i = 0; i < r.tags.length; i++) {
		row.appendChild(el("span", "mce-chip" + (r.tags[i].indexOf("逾期") >= 0 ? " mce-gold" : ""), r.tags[i]));
	}
	if (r.offset > 0) {
		var b = el("button", MCE_CLS.btn, "跳到");
		b.type = "button";
		b.title = "推进 " + r.offset + " 天（原版 passTime，不触发每日结算）";
		b.addEventListener("click", function () {
			var res = mbCECalJump(r.offset);
			setStatus(res.msg, res.ok ? MCE_CLS.ok : MCE_CLS.err);
			renderCalendar();
		});
		row.appendChild(b);
	}
	return row;
}

/* 租金锁定入口（复用 07m 的原版语义锁定：记住目标便士值，每次进段落检查写回） */
function mbCECalLockBar(V) {
	var bar = el("div", MCE_CLS.row);
	var ready = typeof mbCEVanillaEconRentLockRaw === "function";
	var lock = ready ? mbCEVanillaEconRentLockRaw() : null;
	var btn = el("button", MCE_CLS.btn + (lock ? " mce-gold" : ""), lock
		? "租金锁定中：" + mbCEVanillaEconFmt(lock.money) + "（点此解除）"
		: "锁定每周租金（原版语义）");
	btn.type = "button";
	btn.title = lock
		? "解除后原版会在交租时按倍率重算"
		: "记住当前每周租金并每次进段落写回；只改金额，不跳过催租流程";
	btn.addEventListener("click", function () {
		if (!ready) { setStatus("租金锁定依赖 07m 经济段，当前未加载", MCE_CLS.err); return; }
		var r = lock ? mbCEVanillaEconRentLockOff() : mbCEVanillaEconRentLockOn();
		if (r && r.ok) { setStatus(lock ? "已解除每周租金锁定" : "已锁定当前每周租金", MCE_CLS.ok); }
		else { setStatus("操作被拒绝：没有可锁定的周租金额（先去「原版扩展 → 经济」写入）", MCE_CLS.err); }
		renderCalendar();
	});
	bar.appendChild(btn);
	if (!lock && V && !isFinite(Number(V.rentmoney))) {
		bar.appendChild(el("span", MCE_CLS.hint, "（当前没有可锁定的周租金额，先去「原版扩展 → 经济」写入）"));
	}
	return bar;
}

function renderCalendar() {
	var pane = root ? root.querySelector('[data-pane="calendar"]') : null;
	if (!pane) { return; }
	pane.textContent = "";
	var V = getV();
	var now = mbCECalNow(V);
	if (!V || !now) {
		pane.appendChild(el("div", MCE_CLS.hint, "读不到存档时间（V.startDate / V.timeStamp 缺失），日历不可用；进一次游戏再打开。"));
		return;
	}
	var rows = mbCECalendarRows(V, MCE_CAL_SPAN);
	pane.appendChild(el("div", MCE_CLS.hint, "今天 " + mbCECalFmt(rows[0]) + " · 未来 " + rows.length + " 天（只读原版时间字段，不改档）"));
	pane.appendChild(mbCECalLockBar(V));

	var bar = el("div", MCE_CLS.row);
	var jumpOk = mbCECalJumpReady();
	var b1 = el("button", MCE_CLS.btn, jumpOk ? "跳到明天" : "跳到明天（不可用）");
	b1.type = "button";
	if (jumpOk) {
		b1.addEventListener("click", function () {
			var r = mbCECalJump(1);
			setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
			renderCalendar();
		});
	} else {
		b1.disabled = true;
		b1.title = "原版 passTime 未暴露，跳转不可用";
	}
	bar.appendChild(b1);
	pane.appendChild(bar);

	var i;
	for (i = 0; i < rows.length; i++) { pane.appendChild(mbCECalRowEl(rows[i])); }

	pane.appendChild(el("div", MCE_CLS.hint,
		"事件来源：租金（$rentday/$renttime）· 贝利扣押（$bailey_confiscation，+7 赎回 / +8 变卖）· 学校假期（4/7/8/12 月）。" +
		"原版没有固定节日表，未列节日；「跳到」只推进时间，不触发每日结算。"));
}
