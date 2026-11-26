/* 职责：贝利扣押拦截（全局页「防护」组）
 *
 * 原版机制（0.5.12.13 Bailey Confiscation System，行号取自 game\Degrees of Lewdity.html）：
 *   · 触发：Orphanage 睡眠线 `<<elseif $renttime lte -21 and !$bailey_confiscation>>`（@43841899）
 *     → `<<baileyRentConfiscation>>`
 *   · widget `baileyRentConfiscation`（@44071041）：
 *       `<<set _bundle to baileyConfiscationBundle($rentmoney + $babyRent)>>`
 *       `<<if _bundle.items.length is 0>>` → 只走 `<<rentdue 0>>` / `<<rentduerobin 0>>`（正常催租）
 *       `<<else>>` → `baileyConfiscationApply(_bundle)` 搬走衣物与家具，并把 `$renttime` 重置为 7 天赎回期
 *   · 清单生成：`window.baileyConfiscationPool` / `window.baileyConfiscationBundle(target)`（@16508590 起）
 *       `baileyClothingEligible` 排除特殊服装 / event 类 / cursed / heavy / 服装店买不到；
 *       `baileyFurnitureEligible` 只取 bed/table/chair/desk/decoration/windowsill 且非 starter
 *
 * 拦截切口：只把 `baileyConfiscationBundle` 换成恒返回空清单的函数 —— 原版 widget 的
 * `items.length is 0` 分支本就存在，于是自然退化为「只催租、不搬东西」，无需改 apply / restore，
 * 也不动 `$bailey_confiscation` 结构（旧档已扣押记录照原版赎回）。
 *
 * 幂等：每个 passageinit 调一次 mbCEBaileySync；原函数引用只保存一次，关闭时写回同一引用。
 * 边界：原版没有该函数（0.5.12.13 之前 / 其他分支）→ 明确拒绝开启，不伪造「已开启」。
 */

/* 空清单：形状必须与原版一致（twee 直接读 _bundle.items.length / 后续读 total） */
function mbCEBaileyEmptyBundle() { return { items: [], total: 0 }; }
mbCEBaileyEmptyBundle.__mbceBaileyEmpty = true;

var mbCEBaileyOrig = null;

/* 取值链：hasV() 未读档时 getV() 返回 {}（truthy 但不可写），必须先判「真实就绪」 */
var mbCEBaileyVSources = [
	function () { if (typeof hasV === "function" && hasV()) { return getV(); } return null; },
	function () { if (typeof State !== "undefined" && State && State.variables) { return State.variables; } return null; },
	function () { if (typeof window !== "undefined" && window && window.V) { return window.V; } return null; }
];

function mbCEBaileyTry(fn) {
	try { return fn() || null; } catch (e) { return null; }
}

function mbCEBaileyV() {
	for (var i = 0; i < mbCEBaileyVSources.length; i++) {
		var v = mbCEBaileyTry(mbCEBaileyVSources[i]);
		if (v) { return v; }
	}
	return null;
}

function mbCEBaileyOn(v) { return !!(v && (v.mbCE_baileyKeep === true || v.mbCE_baileyKeep === 1)); }

/* 当前 window 上的清单函数（含自己装的空函数；都没有时返回 null） */
function mbCEBaileyFn() {
	try {
		if (typeof window === "undefined" || !window) { return null; }
		var f = window.baileyConfiscationBundle;
		return (typeof f === "function") ? f : null;
	} catch (e) { return null; }
}

/* 当前 window 上的原版清单函数（排除自己装的空函数） */
function mbCEBaileyNative() {
	var f = mbCEBaileyFn();
	return (f && f.__mbceBaileyEmpty !== true) ? f : null;
}

/* 幂等：保存原引用 → 按开关装/卸。原版函数尚未定义时静默返回，等下一回合 passageinit 再补 */
function mbCEBaileySync() {
	try {
		if (typeof window === "undefined" || !window) { return; }
		var cur = window.baileyConfiscationBundle;
		if (typeof cur !== "function") { return; }
		if (cur.__mbceBaileyEmpty !== true && !mbCEBaileyOrig) { mbCEBaileyOrig = cur; }
		var on = mbCEBaileyOn(mbCEBaileyV());
		var want = on ? mbCEBaileyEmptyBundle : mbCEBaileyOrig;
		if (want && cur !== want) { window.baileyConfiscationBundle = want; }
	} catch (e) { /* 拦截失配一律静默，不阻断段落流转 */ }
}

function baileyKeepState() {
	var v = mbCEBaileyV();
	var hasNative = (mbCEBaileyNative() !== null) || (mbCEBaileyOrig !== null);
	var active = false;
	try {
		active = (typeof window !== "undefined" && window) ? (window.baileyConfiscationBundle === mbCEBaileyEmptyBundle) : false;
	} catch (e) { active = false; }
	return {
		on: mbCEBaileyOn(v),
		hasNative: hasNative,
		active: active,
		reason: v ? (hasNative ? "" : "nonative") : "novars"
	};
}

function baileyKeepSet(on) {
	var v = mbCEBaileyV();
	if (!v) { return { ok: false, on: false, message: "存档变量不可用：先进入游戏再开本项" }; }
	var want = !!on;
	if (want && mbCEBaileyFn() === null) {
		return { ok: false, on: false, message: "未检测到原版贝利扣押函数（该机制需 0.5.12.13+，或游戏尚未加载完），本项未开启" };
	}
	v.mbCE_baileyKeep = want;
	mbCEBaileySync();
	return {
		ok: true,
		on: want,
		message: want
			? "已开启：欠租只走催租（付钱/拒绝/色诱），不搬衣物与家具；已扣押的旧记录仍按原版赎回"
			: "已关闭：恢复原版扣押（欠租 21 天后搬走可再购买的衣物与卧室非初始家具，7 天内可赎回）"
	};
}

function mbCEBaileyHint(on) {
	var st = baileyKeepState();
	if (st.reason === "novars") { return "存档变量不可用，先进入游戏再开本项。"; }
	if (st.reason === "nonative") { return "当前游戏没有贝利扣押机制（需 0.5.12.13+）；开关不会生效。"; }
	return on
		? "已开启：欠租只走催租，不搬衣物家具；已扣押的旧记录仍照原版赎回。"
		: "已关闭：原版扣押照旧 —— 欠租 21 天后搬走「能轻松再买到」的衣物与卧室非初始家具，7 天内可在办公室赎回。";
}

function mbCERenderBailey(pane) {
	if (!pane) { return; }
	var on = baileyKeepState().on;
	var sec = mceNewSec(pane, 0, "贝利扣押拦截（欠租不搬衣物家具）",
		"原版 0.5.12.13：`$renttime lte -21` 且当前无扣押记录时，贝利会把衣柜里「能在服装店重新买到」的衣物与卧室非初始家具搬走，给 7 天赎回期，超期典当。本项开启后原版清单恒为空（widget 的 0 件分支本就走正常催租），因此不搬东西、不产生扣押记录；已扣押的旧记录与其他租金线不受影响。安装包不含游戏本体，需 0.5.12.13+ 才生效。");
	var row = el("div", MCE_CLS.row);
	var sw = el("button", on ? "mce-btn mce-gold" : MCE_CLS.btn, on ? "不扣押：开" : "不扣押：关");
	sw.type = "button";
	sw.title = "开启后欠租不再被搬走衣物与家具；仍会正常催租（付钱/拒绝/色诱）";
	var hint = el("div", MCE_CLS.hint, mbCEBaileyHint(on));
	sw.addEventListener("click", function () {
		var r = baileyKeepSet(!baileyKeepState().on);
		setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
		var now = baileyKeepState().on;
		sw.textContent = now ? "不扣押：开" : "不扣押：关";
		sw.className = now ? "mce-btn mce-gold" : MCE_CLS.btn;
		hint.textContent = mbCEBaileyHint(now);
	});
	row.appendChild(sw);
	sec.appendChild(row);
	sec.appendChild(hint);
}

/* 载入即尝试一次（原版脚本若已加载则立即接管；未加载时由 passageinit 钩子补） */
mbCEBaileySync();
