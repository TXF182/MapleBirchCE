/* 07q-avery-mansion-keep — 艾弗里线「放逐后保留房子」
 *
 * 社区需求（QQ 群）："可不可以放逐线保留房子"。
 *
 * 原版事实（DoL 0.5.12.13 单文件 HTML 实证，全部回原文取证）：
 *   · $avery_fate 是顶层变量，取值只有 saved / fallen / ascended / kicked（写入 7 处 / 判定 149 处 / 总引用 242）。
 *     fallen 来自 "Save yourself" 逃生，kicked 来自 "Kick Avery off the building"，两者都紧跟 <<dismissAvery "hard">>；
 *     另有 Destroy Avery's mansion 直接置 fallen。
 *   · 庄园能否使用只看甲：`V.avery_mansion && avery_fate !== "fallen" && !== "kicked"`（hasMansion 判据）。
 *     一旦 fallen/kicked，每日例程走 passRentTick → 庄园免租失效、退回孤儿院房租，庄园入口关闭。
 *   · <<dismissAvery "hard">> 只做四件事：npcset Avery state "dismissed"、unset 8 个约会计数、
 *     set $averyDismissalSceneWait to 1、loveInterestRemove "Avery"。**它不删 $avery_mansion**：
 *     全库 `unset $avery_mansion`（整对象）实测 0 处，4 处命中全是 .folder / .fox.message /
 *     .bedroom_state / .rage.ingredients 子键 → 房子数据本来就在，只是 hasMansion 判定被 fate 关掉。
 *   · <<unDismissAvery>>（原版自带复位 widget）= unset $averyDismissalScene / $averyDismissalSceneWait
 *     + npcset Avery state "active"。
 *   · $averyDismissalSceneWait 是「解雇即刻场景」的防抖位：孤儿院周日 20 点事件条件是
 *     `$averyDismissalScene and $averyDismissalSceneWait isnot 1`。复位时两键一起清，避免旧场景重播。
 *   · C.npc.X 实为 V.NPCName[V.NPCNameList.indexOf("X")] 的别名（initCNPC 55579-55595 实证），
 *     所以改 V 侧 NPCName 数组即等价 npcset（CE 07i 言灵动作已用同一写法）。
 *
 * 本段写入四项：
 *   ① V.avery_fate = "saved"  —— 唯一能让 hasMansion 复活的路径（原版判据写死，挂庇护标记无效）
 *   ② Avery 的 NPC 状态 dismissed → active（对齐 unDismissAvery）
 *   ③ 清 $averyDismissalScene / $averyDismissalSceneWait
 *   ④ 庄园或高塔对象缺失时补壳（**不带 mb_ce_shell**，否则会被 07f 的启动清理当成 CE 壳误撤）
 *
 * 明确不做（CE 纪律：不动玩家真实进度）：
 *   · 不恢复恋爱关系（loveInterestRemove 已把 Avery 移出 loveInterestList，属玩家真实关系进度）
 *   · 不动庄园建造进度 / 家具 / 派对状态（只恢复 fate 与 NPC 状态，房子里的东西原样）
 *   · 不动 $avery_tower 进度；saved 线高塔转烧毁态是原版行为，UI 里写清
 */
"use strict";

/* fate 中文映射（UI 用） */
var MCE_AVERY_FATE_ZH = {
	saved: "救星线（saved）",
	fallen: "自己逃走（fallen）",
	kicked: "踢下大楼（kicked）",
	ascended: "飞升线（ascended）",
	"": "未进入火灾线"
};
var MCE_AVERY_KEEP_KEY = "avery-keep";

/* 取 Avery 的 NPC 对象（V.NPCName 别名，等同 C.npc.Avery） */
function mbCEAveryNpc() {
	var V = getV();
	if (!V) { return null; }
	var list = V.NPCNameList, arr = V.NPCName;
	if (!Array.isArray(list) || !Array.isArray(arr)) { return null; }
	var i = list.indexOf("Avery");
	if (i < 0) { return null; }
	var o = arr[i];
	return (o && typeof o === "object") ? o : null;
}

/* 庄园壳：照原版 avery_mansion_init 初值；**不写 mb_ce_shell**（这是玩家主动恢复的房子，不是 CE 兜底壳） */
function mbCEAveryMansionShell(V) {
	V.avery_mansion = {
		version: 5,
		pool: 0, kitchen: 0, lounge: 0, display: 0, bedroom: 0, bathroom: 0,
		dining: 0, garden: 0, study: 0, garage: 0,
		jobs: [],
		schedule: "home",
		state: "normal",
		days: 0, days_absent: 0, walk_cycle: 0, display_antiques: 0,
		food: "hamburger", food_last: "none", date_ready: false,
		rage: { work: false, apologetic: false, dinner_missed: 0, dinner_done: 0, dinner_wrong: false, assess: 0, timer: 0 },
		fox: { progress: 0, known: false },
		date_seen: false,
		party_state: "waiting",
		guest: "Bailey",
		landry: 0, vault_progress: 0,
		study_unlocked: 0, folder: 0, folder_gone: false,
		kitchen_made: 0, recipe: [],
		attend: {}
	};
}
function mbCEAveryTowerShell(V) {
	V.avery_tower = { progress: 0, effects: [], stage: 0, intro: 0 };
}

/* 当前状态（只读，拆小函数压复杂度） */
function mbCEAveryFateOf(V) {
	var f = V.avery_fate;
	if (f === undefined || f === null) { return ""; }
	return String(f);
}
function mbCEAveryNpcStateOf(npc) {
	if (!npc || !npc.state) { return ""; }
	return String(npc.state);
}
function mbCEAveryFlagOf(V, k) {
	if (V[k] === undefined) { return ""; }
	return String(V[k]);
}
function mbCEAveryCanKeep(fate, npcState, hasMansion) {
	if (!(fate === "fallen" || fate === "kicked" || npcState === "dismissed")) { return false; }
	if (fate === "" && !hasMansion) { return false; }
	return true;
}
function mbCEAveryKeepState() {
	var V = getV();
	if (!V) { return { ok: false }; }
	var npc = mbCEAveryNpc();
	var fate = mbCEAveryFateOf(V);
	var npcState = mbCEAveryNpcStateOf(npc);
	var hasMansion = !!(V.avery_mansion && typeof V.avery_mansion === "object");
	return {
		ok: true,
		fate: fate,
		npcState: npcState,
		mansion: hasMansion,
		tower: !!(V.avery_tower && typeof V.avery_tower === "object"),
		dismissScene: mbCEAveryFlagOf(V, "averyDismissalScene"),
		dismissWait: mbCEAveryFlagOf(V, "averyDismissalSceneWait"),
		/* 可恢复：命运是 fallen/kicked，或 NPC 被解雇；且不是「从没进过这条线」的空档 */
		canKeep: mbCEAveryCanKeep(fate, npcState, hasMansion),
		/* 已恢复：fate 是 saved 且 NPC 不是 dismissed */
		done: (fate === "saved" && npcState !== "dismissed")
	};
}
/* 写入前快照 */
function mbCEAverySnapshot(V, st) {
	return {
		kind: MCE_AVERY_KEEP_KEY,
		fate: st.fate,
		npcState: st.npcState,
		dismissScene: (V.averyDismissalScene === undefined ? null : V.averyDismissalScene),
		dismissWait: (V.averyDismissalSceneWait === undefined ? null : V.averyDismissalSceneWait),
		mansionBuilt: !st.mansion,
		towerBuilt: !st.tower
	};
}

/* 主写入：恢复 fate + NPC 状态 + 清解雇标志 + 缺壳补建 */
function mbCEAveryKeep() {
	var V = getV();
	if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
	var st = mbCEAveryKeepState();
	if (!st.ok) { return { ok: false, message: "存档变量不可用" }; }
	if (st.done) { return { ok: false, message: "当前已是救星线且 Avery 在场，不需要恢复" }; }
	if (!st.canKeep) { return { ok: false, message: "该存档还没进入艾弗里火灾线（avery_fate 为空且无庄园数据），没有可恢复的房子" }; }

	var before = mbCEAverySnapshot(V, st);
	mbCEVanillaTrace(MCE_AVERY_KEEP_KEY, before, "avery_fate / Avery.state / averyDismissalScene*", "放逐后保留艾弗里庄园", "vcore");

	V.avery_fate = "saved";
	var npc = mbCEAveryNpc();
	if (npc && npc.state === "dismissed") { npc.state = "active"; }
	delete V.averyDismissalScene;
	delete V.averyDismissalSceneWait;
	if (!st.mansion) { mbCEAveryMansionShell(V); }
	if (!st.tower) { mbCEAveryTowerShell(V); }

	return {
		ok: true,
		id: MCE_AVERY_KEEP_KEY,
		message: "已恢复：avery_fate = saved（庄园可用、免租恢复），Avery 状态 active。"
			+ "庄园数据与建造进度未改动；恋爱关系不自动恢复（原版解雇时已移除，属你的真实进度）。"
	};
}

/* 回退辅助：fate 为空则删键，否则写回 */
function mbCEAveryRestoreFate(V, val) {
	if (val === "" || val === undefined || val === null) { delete V.avery_fate; return; }
	V.avery_fate = val;
}
/* 回退辅助：值为 null/undefined 则删键，否则写回（0 与有值都写回） */
function mbCEAveryRestoreKey(V, k, val) {
	if (val === null || val === undefined) { delete V[k]; return; }
	V[k] = val;
}
/* 回退处理器：还原 fate / NPC 状态 / 解雇标志；本次补建的壳删除 */
function mbCEAveryUndoKind(V, b, key) {
	if (!V || !b) { return null; }
	if (b.kind !== MCE_AVERY_KEEP_KEY) { return null; }
	mbCEAveryRestoreFate(V, b.fate);
	var npc = mbCEAveryNpc();
	if (npc && b.npcState) { npc.state = b.npcState; }
	mbCEAveryRestoreKey(V, "averyDismissalScene", b.dismissScene);
	mbCEAveryRestoreKey(V, "averyDismissalSceneWait", b.dismissWait);
	if (b.mansionBuilt) { delete V.avery_mansion; }
	if (b.towerBuilt) { delete V.avery_tower; }
	delete V.mbCE_wrote[key];
	return { ok: true, message: "已还原艾弗里状态（fate = " + (b.fate || "空") + "，NPC = " + (b.npcState || "原状") + "）" };
}
/* 注册进统一经济回退表（07m 的 MB_CE_ECON_UNDO；同 07p 食物做法，不改 07m/07n 一行） */
var MCE_AVERY_UNDO_REG = /** @type {Object<string, any>} */ (MB_CE_ECON_UNDO);
if (MCE_AVERY_UNDO_REG) { MCE_AVERY_UNDO_REG[MCE_AVERY_KEEP_KEY] = mbCEAveryUndoKind; }

/* 对外回退入口：走统一回退链 08c vcore → 07l ExtUndo → 07n KindUndo → 07m EconUndo → 本段处理器 */
function mbCEAveryUndo(id) {
	if (typeof mbCEVanillaExtUndo !== "function") { return { ok: false, message: "回退通道不可用" }; }
	return mbCEVanillaExtUndo(id || MCE_AVERY_KEEP_KEY);
}

/* 面板区块 */
function mbCERenderAveryKeep(sec) {
	var body = mceNewGroup(sec, "艾弗里庄园 · 放逐后保留房子", "改 avery_fate 与 NPC 状态；房子里的数据原样");
	var redraw = function () {
		while (body.firstChild) { body.removeChild(body.firstChild); }
		var st = mbCEAveryKeepState();
		var kv = el("div", "mce-statrow");
		[["命运", MCE_AVERY_FATE_ZH[st.fate || ""] || st.fate || "未进入火灾线"],
			["Avery", st.npcState === "dismissed" ? "已解雇（dismissed）" : (st.npcState || "未初始化")],
			["庄园数据", st.mansion ? "在（可恢复）" : "缺失（恢复时补壳）"],
			["高塔", st.tower ? "在" : "缺失（恢复时补壳）"]].forEach(function (p, i) {
			if (i) { kv.appendChild(el("span", "mce-kv-sep", "｜")); }
			kv.appendChild(el("span", MCE_CLS.rowLbl, p[0]));
			kv.appendChild(el("span", "mce-value", p[1]));
		});
		body.appendChild(kv);
		var g = mceBtnGrid(body);
		mbCEVanillaEconUiBtn(g, "保留房子（恢复庄园）", "avery_fate → saved + Avery 状态回 active + 清解雇场景标志；庄园数据与建造进度不动", function () {
			var res = mbCEAveryKeep();
			setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
			if (res.ok) { redraw(); }
		});
		mbCEVanillaEconUiBtn(g, "回退", "把命运 / NPC 状态 / 解雇标志还原到恢复前", function () {
			var res = mbCEAveryUndo(MCE_AVERY_KEEP_KEY);
			setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
			if (res.ok) { redraw(); }
		});
		body.appendChild(mceFoldHint("原版判定：庄园能否使用只看 avery_fate —— fallen（自己逃走）/ kicked（踢下大楼）都会关闭庄园并恢复孤儿院房租；"
			+ "而 dismissAvery 并不会删掉庄园数据（全库 unset $avery_mansion 整对象 0 处）。所以「保留房子」只需把 fate 改回 saved 并把 Avery 的 NPC 状态复位，"
			+ "房子里的家具、派对、藏宝进度一概不动。\n"
			+ "不做的事：恋爱关系不恢复（解雇时 loveInterestRemove 已移除，那是你的真实进度）；saved 线高塔转烧毁态是原版行为，与本项无关。"));
	};
	redraw();
}
