/*
 * 事件日历（07x-calendar.js）：纯数据推演 + 跳日探测 + 页面渲染降级
 *
 * 取证依据（DoL 0.5.12.13 HTML）：
 *   - 起点 new DateTime(2022, 9, 4, 7)，V.timeStamp 为毫秒偏移（L76786–76795）
 *   - holidayMonths = [4, 7, 8, 12]（L76779）
 *   - $rentday = 收租星期（1=周日…7=周六，L76696）；$renttime <= 0 逾期（L308066）
 *   - 扣押赎回 = 扣押日 + 7 / 变卖 = +8（L308077–308078）
 *   - passTime(time, "day") 走 Time.pass（L76623–76627）
 *
 * 用法：node tests/event_calendar.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const CAL = path.join(__dirname, "..", "javascript", "src", "07x-calendar.js");
let failures = 0;
function assert(cond, msg) {
	if (cond) { console.log("PASS: " + msg); }
	else { failures++; console.error("FAIL: " + msg); }
}

const DAY = 86400000;
const START = new Date(2022, 8, 4, 7).getTime(); /* 2022-09-04 07:00 本地时区，与 DateTime(2022,9,4,7) 同口径 */

function stubEl(tag, cls, text) {
	return {
		tag: tag, cls: cls || "", text: text || "", children: [], title: "", type: "", disabled: false,
		appendChild: function (c) { this.children.push(c); },
		addEventListener: function () {}
	};
}

function load(opts) {
	const o = opts || {};
	const V = o.V === undefined ? null : o.V;
	const jumpStub = o.passTime === undefined ? null : o.passTime;
	const sandbox = {
		getV: function () { return V; },
		el: stubEl,
		MCE_CLS: { row: "r", btn: "b", ok: "ok", err: "err", hint: "h", gold: "g" },
		setStatus: function () {},
		window: jumpStub ? { passTime: jumpStub } : {},
		root: null,
		console: console
	};
	vm.createContext(sandbox);
	vm.runInContext(fs.readFileSync(CAL, "utf8"), sandbox, { filename: CAL });
	return sandbox;
}

/* ---------- 1. 无时间戳：不猜、返回空 ---------- */
{
	const S = load({ V: { rentday: 3, renttime: 2 } });
	assert(S.mbCECalendarRows(S.getV(), 14).length === 0, "1 无 startDate/timeStamp → 0 行（不猜测当前时间）");
	assert(S.mbCECalNow(S.getV()) === null, "2 无时间戳 → mbCECalNow 返回 null");
}

/* ---------- 2. 行数与边界 ---------- */
{
	const V = { startDate: START, timeStamp: 0 };
	const S = load({ V: V });
	assert(S.mbCECalendarRows(V, 14).length === 14, "3 默认 14 天 → 14 行");
	assert(S.mbCECalendarRows(V, 7).length === 7, "4 显式 7 天 → 7 行");
	assert(S.mbCECalendarRows(V, 999).length === 30, "5 超界截到 30 行（MCE_CAL_MAXSPAN）");
	assert(S.mbCECalendarRows(V, 0).length === 14, "6 非法 span=0 → 回落默认 14");
}

/* ---------- 3. 首行与星期 ---------- */
{
	const V = { startDate: START, timeStamp: 0 };
	const S = load({ V: V });
	const rows = S.mbCECalendarRows(V, 14);
	assert(rows[0].today === true && rows[0].offset === 0, "7 首行 today/offset=0");
	assert(rows[0].month === 9 && rows[0].day === 4 && rows[0].weekday === "周日", "8 首行 = 2022-09-04 周日（起点原文一致）");
	assert(rows[1].weekday === "周一" && rows[1].day === 5, "9 第二行 = 09-05 周一");
}

/* ---------- 4. 租金：到期日 / 逾期 ---------- */
{
	const V = { startDate: START, timeStamp: 0, rentday: 3, renttime: 5 }; /* 今天是周日(1)，rentday=3(周二) → 2 天后 */
	const S = load({ V: V });
	const rows = S.mbCECalendarRows(V, 14);
	assert(rows[2].tags.indexOf("租金到期") !== -1, "10 rentday=周二 → 第 2 行（周二）标「租金到期」");
	assert(rows[0].tags.indexOf("租金到期") === -1, "11 今天不是收租日 → 首行无租金标签");

	const V2 = { startDate: START, timeStamp: 0, rentday: 1, renttime: 0 };
	const S2 = load({ V: V2 });
	const rows2 = S2.mbCECalendarRows(V2, 14);
	assert(rows2[0].tags.indexOf("租金已逾期") !== -1, "12 rentday=今天 + renttime<=0 → 首行「租金已逾期」");

	const V3 = { startDate: START, timeStamp: 0 };
	const S3 = load({ V: V3 });
	assert(S3.mbCECalendarRows(V3, 14).every(function (r) { return r.tags.indexOf("租金到期") === -1; }), "13 无 rentday → 不产生租金标签（不伪造）");
}

/* ---------- 5. 贝利扣押：+7 赎回 / +8 变卖 ---------- */
{
	/* gameDay = floor(timeStamp / DAY)；令扣押发生在 gameDay=3，则第 4 天 rel=7、第 5 天 rel=8 */
	const V = { startDate: START, timeStamp: 3 * DAY, bailey_confiscation: { day: 3, items: ["x"] } };
	const S = load({ V: V });
	const rows = S.mbCECalendarRows(V, 14);
	assert(rows[7].tags.indexOf("扣押赎回截止") !== -1, "14 扣押日 +7 → 第 7 行「扣押赎回截止」");
	assert(rows[8].tags.indexOf("扣押物变卖") !== -1, "15 扣押日 +8 → 第 8 行「扣押物变卖」");

	const V2 = { startDate: START, timeStamp: 3 * DAY, bailey_confiscation: { day: 3, items: [] } };
	const S2 = load({ V: V2 });
	assert(S2.mbCECalendarRows(V2, 14).every(function (r) { return r.tags.indexOf("扣押赎回截止") === -1; }), "16 items 为空 → 不产生扣押标签");
}

/* ---------- 6. 学校假期（4/7/8/12 月）---------- */
{
	const ts = new Date(2023, 3, 1, 7).getTime() - START; /* 2023-04-01 07:00 */
	const V = { startDate: START, timeStamp: ts };
	const S = load({ V: V });
	const rows = S.mbCECalendarRows(V, 14);
	assert(rows[0].month === 4 && S.mbCECalendarRows(V, 14)[0].tags.indexOf("学校假期") !== -1, "17 4 月首行标「学校假期」（holidayMonths 含 4）");
	const ts2 = new Date(2023, 4, 1, 7).getTime() - START; /* 5 月 */
	const V2 = { startDate: START, timeStamp: ts2 };
	const S2 = load({ V: V2 });
	assert(S2.mbCECalendarRows(V2, 14).every(function (r) { return r.tags.indexOf("学校假期") === -1; }), "18 5 月无假期标签（4/7/8/12 之外）");
}

/* ---------- 7. 跳日：可达时透传 (n, "day")；不可达时拒绝 ---------- */
{
	const calls = [];
	const S = load({ V: { startDate: START, timeStamp: 0 }, passTime: function (n, t) { calls.push([n, t]); } });
	const r = S.mbCECalJump(3);
	assert(r.ok === true && calls.length === 1 && calls[0][0] === 3 && calls[0][1] === "day", "19 passTime 可达 → 传 (3, \"day\")");
	assert(S.mbCECalJump(0).ok === false, "20 offset=0 → 拒绝（今天不需要跳转）");

	const S2 = load({ V: { startDate: START, timeStamp: 0 } });
	const r2 = S2.mbCECalJump(5);
	assert(r2.ok === false && r2.msg.indexOf("passTime") !== -1, "21 passTime 不可达 → 拒绝且给出原因（不静默失败）");
	assert(S2.mbCECalJumpReady() === false, "22 探测函数与调用结果一致");

	const S3 = load({ V: { startDate: START, timeStamp: 0 }, passTime: function () { throw new Error("boom"); } });
	assert(S3.mbCECalJump(1).ok === false, "23 passTime 抛错 → 返回 ok:false（不崩面板）");
}

/* ---------- 8. 页面渲染：无时间 → 单条提示；有数据 → 生成行 ---------- */
{
	function renderWith(V, jump) {
		const S = load({ V: V, passTime: jump });
		const pane = stubEl("div", "pane");
		S.root = { querySelector: function () { return pane; } };
		S.renderCalendar();
		return { S: S, pane: pane };
	}
	const a = renderWith({ rentday: 1, renttime: 0 });
	assert(a.pane.children.length === 1, "24 无时间戳 → 仅一条提示");
	assert(a.pane.children[0].text.indexOf("读不到存档时间") !== -1, "25 提示文案指明缺 V.startDate / V.timeStamp");

	const b = renderWith({ startDate: START, timeStamp: 0, rentday: 1, renttime: 0 }, function () {});
	assert(b.pane.children.length >= 16, "26 有数据 → 头部 + 锁定条 + 跳转条 + 14 行，实际 " + b.pane.children.length);
	assert(b.S.mbCECalJumpReady() === true, "27 用时探测 true（按钮可用）");
	console.log("渲染行数示例：", b.pane.children.length);
}

console.log(failures === 0 ? "ALL PASS" : "FAILURES: " + failures);
process.exit(failures === 0 ? 0 : 1);
