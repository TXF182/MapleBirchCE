/* 07v-avery-injury — 艾弗里「保持受伤」三档 + 休养
 *
 * 原版事实（DoL 0.5.12.13 单文件 HTML 实证，全部回原文取证）：
 *   · $avery_mansion.injury 全库 1 处读取（每日结算 `if $avery_mansion.injury is true → set $avery_injury to true`）、
 *     **0 处写入**（`to true/false`、`= true/false`、`isnot` 全部 0 命中）——它是 0.5.7 重构后的遗留键，该分支恒不触发。
 *   · 真正的伤由两个键表达：`injury_timer`（每日结算 -1，0 停）+ `injury_stage`（同处按 timer 重算：
 *     >50 sling / 16~49 cast / 1~15 healing / <=0 healed；version 4→5 迁移把 fresh/fresh_done → sling）。
 *   · `<<avery_injury_check>>`（widget 定义实证）：`_avery_injured = stage in [sling, cast, healing]`；
 *     受伤期渲染 NPC 时 `NPCList[i].righthand = "idle"`（右手不可用于互动）。
 *   · `$avery_injury`（布尔）是日程总闸，14 处判定：办公室工作 / 工作邀请 / 学校接送 / 庄园 away 归家 / 派对 /
 *     晚餐 / 约会 / 红毯宴会 / 温泉 / 学校 drop-off / 街头初见，全部要求 `!$avery_injury`。
 *     全库只有 `Mansion Return Broken` 的两个链接会 `set $avery_injury to false`（无任何置 true 的写入）。
 *
 * 本段做三件事：
 *   ① 三档外观（吊带 90 / 石膏 40 / 快好 10）：写 `injury_timer` + `injury_stage`，并按档位对齐原版分档；
 *   ② 休养：写 `avery_injury = true`（原版门控语义，工作/接送/赴宴/约会/温泉全停）；
 *   ③ 冻结：每次进段落回写 timer 与 stage（每日结算的 -1 与重算会被拉回），解除时按开启前快照还原。
 *
 * 明确不做：
 *   · 无 $avery_mansion 的存档不补壳（补壳会让 hasMansion 判据成立 → 白送庄园与免租），外观档直接拒绝，只给「仅休养」；
 *   · 不动 NPC 数值 / 恋爱关系 / 庄园建造进度；
 *   · 不改 $avery_mansion.injury（死键，写了也没人读）。
 */
"use strict";

var MCE_AVERY_INJURY_KEY = "avery-injury";
var MCE_AVERY_INJURY_MODES = /** @type {Object<string, any>} */ ({
	sling: { key: "sling", timer: 90, stage: "sling", zh: "吊带（90 天）" },
	cast: { key: "cast", timer: 40, stage: "cast", zh: "石膏（40 天）" },
	healing: { key: "healing", timer: 10, stage: "healing", zh: "快好（10 天）" }
});

/* 档位表（UI 顺序） */
function mbCEAveryInjuryModes() {
	return ["sling", "cast", "healing"].map(function (k) { return MCE_AVERY_INJURY_MODES[k]; });
}
/* 庄园对象（不存在返回 null；**不补壳**） */
function mbCEAveryInjuryMansion(V) {
	return (V.avery_mansion && typeof V.avery_mansion === "object") ? V.avery_mansion : null;
}
/* 是否已在街头/办公室见过 Avery（UI 提示用：未认识时开休养会挡掉初见） */
function mbCEAveryInjuryKnown(V) {
	try {
		if (V.averySeen && typeof V.averySeen.includes === "function" && V.averySeen.length > 0) { return true; }
	} catch (e) { /* averySeen 非数组时忽略 */ }
	return V.averyseen === 1 || !!V.averydate || !!V.avery_party;
}
/* 开启前快照（只取本项会动的三个值） */
function mbCEAveryInjurySnapshot(V) {
	var m = mbCEAveryInjuryMansion(V);
	return {
		kind: MCE_AVERY_INJURY_KEY,
		hasMansion: !!m,
		hasTimer: !!(m && "injury_timer" in m),
		timer: m ? m.injury_timer : undefined,
		hasStage: !!(m && "injury_stage" in m),
		stage: m ? m.injury_stage : undefined,
		hasInj: ("avery_injury" in V),
		inj: V.avery_injury
	};
}
/* 已有保持标记时沿用最初快照，避免切档把「已被改过的值」当原值 */
function mbCEAveryInjuryPrev(V) {
	var h = V.mbCE_averyInjuryHold;
	if (h && h.prev) { return h.prev; }
	return mbCEAveryInjurySnapshot(V);
}
/* 状态（只读）：三个字段各自小函数取值，避免 state 本身堆三目超复杂度基线 */
function mbCEAveryInjuryTimerOf(m) {
	if (!m || typeof m.injury_timer !== "number") { return null; }
	return m.injury_timer;
}
function mbCEAveryInjuryStageOf(m) {
	if (!m || !m.injury_stage) { return ""; }
	return String(m.injury_stage);
}
function mbCEAveryInjuryHoldView(h) {
	if (!h || typeof h !== "object") { return null; }
	return { mode: String(h.mode || ""), timer: h.timer, stage: String(h.stage || "") };
}
function mbCEAveryInjuryState() {
	var V = getV();
	if (!V) { return { ok: false, known: false, mansion: false, timer: null, stage: "", injury: false, hold: null }; }
	var m = mbCEAveryInjuryMansion(V);
	return {
		ok: true,
		known: mbCEAveryInjuryKnown(V),
		mansion: !!m,
		timer: mbCEAveryInjuryTimerOf(m),
		stage: mbCEAveryInjuryStageOf(m),
		injury: V.avery_injury === true,
		hold: mbCEAveryInjuryHoldView(V.mbCE_averyInjuryHold)
	};
}
/* 写外观 + 休养 */
function mbCEAveryInjuryApply(V, timer, stage) {
	var m = mbCEAveryInjuryMansion(V);
	if (m) {
		m.injury_timer = timer;
		m.injury_stage = stage;
	}
	V.avery_injury = true;
}
/* 开启/切档：三档外观 + 休养 */
function mbCEAveryInjuryHold(mode) {
	var V = getV();
	if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
	var cfg = MCE_AVERY_INJURY_MODES[mode];
	if (!cfg) { return { ok: false, message: "未知的受伤档位（可选 sling / cast / healing）" }; }
	if (!mbCEAveryInjuryMansion(V)) {
		return { ok: false, message: "该存档没有艾弗里庄园数据 —— 伤势外观依赖 $avery_mansion.injury_stage，无法呈现。可先用「仅休养」停日程，或进庄园线后再开。" };
	}
	var prev = mbCEAveryInjuryPrev(V);
	mbCEVanillaTrace(MCE_AVERY_INJURY_KEY, { kind: MCE_AVERY_INJURY_KEY, prev: prev },
		"avery_mansion.injury_timer / injury_stage / avery_injury", "保持艾弗里受伤状态（" + cfg.zh + "）", "vcore");
	mbCEAveryInjuryApply(V, cfg.timer, cfg.stage);
	V.mbCE_averyInjuryHold = { mode: cfg.key, timer: cfg.timer, stage: cfg.stage, stopSchedule: true, prev: prev, at: Date.now() };
	return {
		ok: true,
		id: MCE_AVERY_INJURY_KEY,
		message: "已保持「" + cfg.zh + "」：伤势外观按原版档位呈现，Avery 进入休养（不工作 / 不接送 / 不赴宴 / 不约会 / 不温泉）。"
			+ "每进一段会自动回写，伤不会自愈；解除后按开启前还原。"
	};
}
/* 仅休养：不写外观，只关日程（无庄园存档也能用） */
function mbCEAveryInjurySettleOnly() {
	var V = getV();
	if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
	var prev = mbCEAveryInjuryPrev(V);
	mbCEVanillaTrace(MCE_AVERY_INJURY_KEY, { kind: MCE_AVERY_INJURY_KEY, prev: prev },
		"avery_injury（仅休养）", "艾弗里休养（无伤势外观）", "vcore");
	V.avery_injury = true;
	V.mbCE_averyInjuryHold = { mode: "settle", timer: null, stage: null, stopSchedule: true, prev: prev, at: Date.now() };
	return {
		ok: true,
		id: MCE_AVERY_INJURY_KEY,
		message: "已开「仅休养」：Avery 不工作 / 不接送 / 不赴宴 / 不约会 / 不温泉。"
			+ "该存档没有庄园数据，因此没有石膏/吊带外观；每进一段自动维持，解除后还原。"
	};
}
/* 冻结：每日结算 -1 与 stage 重算后回写（挂 passage init）——写回拆出以控复杂度 */
function mbCEAveryInjuryFreeze(m, h) {
	if (!m) { return; }
	if (m.injury_timer !== h.timer) { m.injury_timer = h.timer; }
	if (h.stage && m.injury_stage !== h.stage) { m.injury_stage = h.stage; }
}
function mbCEAveryInjuryHoldTick() {
	var V = getV();
	if (!V) { return; }
	var h = V.mbCE_averyInjuryHold;
	if (!h || typeof h !== "object") { return; }
	if (h.stopSchedule && V.avery_injury !== true) { V.avery_injury = true; }
	if (h.timer === null || h.timer === undefined) { return; }
	mbCEAveryInjuryFreeze(mbCEAveryInjuryMansion(V), h);
}
/* 还原辅助：快照里有就写回，没有就删键（保持「原本未定义」） */
function mbCEAveryInjuryRestore(V, prev) {
	var m = mbCEAveryInjuryMansion(V);
	if (m) {
		if (prev.hasTimer) { m.injury_timer = prev.timer; } else { delete m.injury_timer; }
		if (prev.hasStage) { m.injury_stage = prev.stage; } else { delete m.injury_stage; }
	}
	if (prev.hasInj) { V.avery_injury = prev.inj; } else { delete V.avery_injury; }
}
/* 解除并还原 */
function mbCEAveryInjuryOff() {
	var V = getV();
	if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
	var h = V.mbCE_averyInjuryHold;
	if (!h || typeof h !== "object") { return { ok: false, message: "当前没有保持中的受伤状态" }; }
	mbCEAveryInjuryRestore(V, h.prev || {});
	delete V.mbCE_averyInjuryHold;
	if (V.mbCE_wrote) { delete V.mbCE_wrote["vcore:" + MCE_AVERY_INJURY_KEY]; }
	return { ok: true, message: "已解除：injury_timer / injury_stage / avery_injury 已还原到开启前（原本未定义的键已删除）。" };
}
/* 统一回退表处理器（08c vcore → 07l ExtUndo → 07n KindUndo → 07m EconUndo） */
function mbCEAveryInjuryUndoKind(V, b, key) {
	if (!V || !b || b.kind !== MCE_AVERY_INJURY_KEY) { return null; }
	mbCEAveryInjuryRestore(V, b.prev || {});
	delete V.mbCE_averyInjuryHold;
	if (V.mbCE_wrote) { delete V.mbCE_wrote[key]; }
	return { ok: true, message: "已还原艾弗里伤势（injury_timer / injury_stage / avery_injury）" };
}
var MCE_AVERY_INJURY_UNDO_REG = /** @type {Object<string, any>} */ (MB_CE_ECON_UNDO);
if (MCE_AVERY_INJURY_UNDO_REG) { MCE_AVERY_INJURY_UNDO_REG[MCE_AVERY_INJURY_KEY] = mbCEAveryInjuryUndoKind; }

/* ============ 面板区块 ============ */
var MCE_AVERY_STAGE_ZH = { sling: "吊带", cast: "石膏", healing: "快好", healed: "已痊愈", fresh: "刚受伤" };

function mbCEAveryInjuryKv(st) {
	var kv = el("div", "mce-statrow");
	var modeZh = st.hold ? (MCE_AVERY_INJURY_MODES[st.hold.mode] ? MCE_AVERY_INJURY_MODES[st.hold.mode].zh : "仅休养") : "未开启";
	[["庄园数据", st.mansion ? "在" : "缺（无外观档）"],
		["当前伤势", (MCE_AVERY_STAGE_ZH[st.stage] || st.stage || "无") + (st.timer === null ? "" : "（剩 " + st.timer + " 天）")],
		["休养", st.injury ? "开（工作/接送/赴宴/约会停）" : "关"],
		["保持中", modeZh]].forEach(function (p, i) {
		if (i) { kv.appendChild(el("span", "mce-kv-sep", "｜")); }
		kv.appendChild(el("span", MCE_CLS.rowLbl, p[0]));
		kv.appendChild(el("span", "mce-value", p[1]));
	});
	return kv;
}
function mbCEAveryInjuryButtons(g, redraw) {
	mbCEAveryInjuryModes().forEach(function (m) {
		var tip = "写 injury_timer=" + m.timer + " + injury_stage=" + m.stage + " + avery_injury=true；"
			+ "原版每日按 timer 分档（>50 吊带 / 16~49 石膏 / 1~15 快好），本项每进一段回写，伤不会自愈";
		mbCEVanillaEconUiBtn(g, "保持" + m.zh, tip, function () {
			var res = mbCEAveryInjuryHold(m.key);
			setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
			if (res.ok) { redraw(); }
		});
	});
	mbCEVanillaEconUiBtn(g, "仅休养（不显示伤）", "只把 avery_injury 置 true：停工作 / 接送 / 赴宴 / 约会 / 温泉；不写伤势外观", function () {
		var res = mbCEAveryInjurySettleOnly();
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		if (res.ok) { redraw(); }
	});
	mbCEVanillaEconUiBtn(g, "解除（还原开启前）", "按开启前快照还原 injury_timer / injury_stage / avery_injury；原本未定义的键删除", function () {
		var res = mbCEAveryInjuryOff();
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		if (res.ok) { redraw(); }
	});
}
function mbCERenderAveryInjury(sec) {
	var body = mceNewGroup(sec, "艾弗里 · 保持受伤（三档 + 休养）", "伤势外观按原版档位；休养 = 不工作 / 不接送 / 不赴宴 / 不约会");
	var redraw = function () {
		while (body.firstChild) { body.removeChild(body.firstChild); }
		var st = mbCEAveryInjuryState();
		body.appendChild(mbCEAveryInjuryKv(st));
		var g = mceBtnGrid(body);
		mbCEAveryInjuryButtons(g, redraw);
		body.appendChild(mceFoldHint("原版判定：$avery_mansion.injury 是 0.5.7 遗留死键（全库 0 写入），"
			+ "真正的伤只看 injury_timer + injury_stage；$avery_injury 是日程总闸（办公室工作 / 接送 / 派对 / 晚餐 / 约会 / 红毯 / 温泉 / 街头初见）。\n"
			+ "外观三档依赖庄园的 injury_stage（<<avery_injury_check>>），所以没有庄园数据的存档只能「仅休养」。\n"
			+ "注意：还没在街头遇过 Avery（$averyseen 不是 1）时开休养，会连初见一起挡掉——先认识再开。\n"
			+ "冻结方式：每次进段落回写 timer/stage，每日结算的 -1 会被拉回；解除后按开启前原值还原。"));
		if (!st.known) { body.appendChild(el("div", "mce-warn", "该存档尚未记录与 Avery 的初见（averySeen 为空 / averyseen 不是 1）：开休养会挡掉街头初见，建议先认识。")); }
	};
	redraw();
}
