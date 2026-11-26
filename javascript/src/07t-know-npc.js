/* 职责：需求④「角色阶段页加认识开关 + 显示原版相认场景」。
   原版事实（DoL 0.5.12.13）：
   - <<initnpc "名字">>（HTML L299222–L299249）只在 $NPCName[_i].init is 0 时执行，一次性写入
     init=1、trust/love/dom/lust/trauma/rage/purity/corruption=0、state="active"、chastity、name_known=1，
     再 generatePronouns / initNNPCClothes / initNNPCstrapon，并有多角色特化分支（部分会重置 seen 标志）。
     所以「标记为认识」不能裸写 init=1，必须调原版 initnpc 完成全套初始化，再把面板数值写回。
   - 已取证的相认入口：Robin 公园冬季周末白天（L531026）；Sam 公园清晨 6:00–6:55 晴天（L531051）；
     Gwylan 森林猎手遭遇（init 为 0 的初见，L71700）。其余角色不硬编码，靠运行时探测记录。
   - 运行时探测：passageinit 比对 V.NPCName[].init，0→1 且从未记录过时把当前段落名写进 $mbCE_firstMeet。
     首次运行只建基线（避免把已认识的角色误记成"刚相认"）。 */

	var MCE_KNOW_SCENES = {
		"Robin": "公园 · 冬季周末白天（热巧克力摊）",
		"Sam": "公园 · 清晨 6:00-6:55 且不下雨（喂鸭子）",
		"Gwylan": "森林 · 猎手遭遇（尚未认识时的初见）"
	};
	function mbCEKnowFirstMeet(V, nm) {
		try {
			if (V && V.mbCE_firstMeet && Object.prototype.hasOwnProperty.call(V.mbCE_firstMeet, nm)) {
				return String(V.mbCE_firstMeet[nm] || "");
			}
		} catch (eF) { /* 记录损坏按未记录处理 */ }
		return "";
	}
	function mbCEKnowState(name) {
		var V = getV();
		var nm = String(name || "");
		var npc = findNpcEx(nm);
		var st = getNpcState(nm);
		return {
			has: !!npc,
			init: npc && Number(npc.init) === 1 ? 1 : 0,
			state: st && st.found ? st.state : "",
			known: !!(npc && Number(npc.init) === 1),
			firstMeet: mbCEKnowFirstMeet(V, nm),
			staticScene: MCE_KNOW_SCENES[nm] || ""
		};
	}
	/* 单个 NPC 的 0→1 差分（拆出来压复杂度；first 只记第一次命中） */
	function mbCEKnowTickOne(n, snap, first, t) {
		if (!n || !n.nam) { return; }
		var nm = String(n.nam);
		var initFlag = Number(n.init) === 1 ? 1 : 0;
		var prev = snap[nm];
		if (prev === undefined) { snap[nm] = initFlag; return; }
		if (prev === 0 && initFlag === 1 && !Object.prototype.hasOwnProperty.call(first, nm)) { first[nm] = t; }
		snap[nm] = initFlag;
	}
	/* 认识探测（passageinit 调用）：只写差分，不建多余结构 */
	function mbCEKnowProbe(title) {
		var V = getV();
		if (!V || !Array.isArray(V.NPCName)) { return; }
		var snap = V.mbCE_npcInitSnap;
		if (!snap || typeof snap !== "object") { snap = {}; V.mbCE_npcInitSnap = snap; }
		var first = V.mbCE_firstMeet;
		if (!first || typeof first !== "object") { first = {}; V.mbCE_firstMeet = first; }
		var t = String(title || "");
		for (var i = 0; i < V.NPCName.length; i++) { mbCEKnowTickOne(V.NPCName[i], snap, first, t); }
	}
	function mbCEKnowSnapshot(npc, nm) {
		var keys = [], vals = {};
		statDefsFor(nm).forEach(function (def) {
			keys.push(def.key);
			vals[def.key] = statValue(npc, nm, def);
		});
		return { keys: keys, vals: vals };
	}
	function mbCEKnowRestoreVals(npc, keys, vals) {
		keys.forEach(function (k) {
			try { npc[k] = vals[k]; } catch (eB) { /* 单键写回失败不影响其余数值 */ }
		});
	}
	function mbCEKnowTraceBefore(nm, npc, vals) {
		return {
			kind: "know-npc",
			name: nm,
			init: 0,
			state: npc.state === undefined ? undefined : String(npc.state),
			nameKnown: npc.name_known === undefined ? undefined : Number(npc.name_known),
			stats: mbCEVanillaEconClone(vals)
		};
	}
	function mbCEKnowSet(name) {
		var V = getV();
		var nm = String(name || "");
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var npc = findNpcEx(nm);
		if (!npc) { return { ok: false, message: "「" + nm + "」不在运行时名单（V.NPCName / V.per_npc），无法初始化" }; }
		if (Number(npc.init) === 1) { return { ok: false, message: "「" + nm + "」已经是认识状态" }; }
		if (typeof window === "undefined" || typeof window.wikifier !== "function") {
			return { ok: false, message: "宿主 wikifier 不可用，无法执行原版 initnpc 初始化" };
		}
		/* 先快照面板可见数值：initnpc 会把 7 项数值清零，初始化后原样写回 */
		var snap = mbCEKnowSnapshot(npc, nm);
		var before = mbCEKnowTraceBefore(nm, npc, snap.vals);
		try {
			window.wikifier('<<initnpc "' + nm.replace(/"/g, "") + '">>');
		} catch (eW) {
			return { ok: false, message: "调用原版 initnpc 失败：" + String(eW) };
		}
		var after = findNpcEx(nm) || npc;
		if (Number(after.init) !== 1) {
			return { ok: false, message: "原版 initnpc 没有把 init 置 1（角色名可能不在 $NPCNameList），未写入任何数值" };
		}
		mbCEKnowRestoreVals(after, snap.keys, snap.vals);
		mbCEVanillaTrace("know-npc", before, "NPC init / 面板数值", "标记为认识（原版 initnpc 初始化后写回数值）", "vcore-econ");
		return { ok: true, message: "已把「" + nm + "」标记为认识（原版初始化完成，面板数值已保留）" };
	}
	function mbCEKnowUndoKind(V, b, key) {
		var npc = findNpcEx(String(b.name || ""));
		if (!npc) { return { ok: false, message: "该角色已不在运行时名单，无法回退认识状态" }; }
		npc.init = 0;
		if (b.state !== undefined) { npc.state = b.state; }
		if (b.nameKnown !== undefined) { npc.name_known = b.nameKnown; }
		if (b.stats && typeof b.stats === "object") {
			Object.keys(b.stats).forEach(function (k) {
				try { npc[k] = b.stats[k]; } catch (eK) { /* 单键失败继续 */ }
			});
		}
		delete V.mbCE_wrote[key];
		return { ok: true, message: "已把「" + String(b.name || "") + "」还原为未认识（数值 / state / name_known 已恢复；装备与贞操等一次性生成不回退）" };
	}
	var MCE_KNOW_UNDO_REG = /** @type {Object<string, any>} */ (MB_CE_ECON_UNDO);
	if (MCE_KNOW_UNDO_REG) { MCE_KNOW_UNDO_REG["know-npc"] = mbCEKnowUndoKind; }

	/* 阶段页区块：每个角色都显示认识状态与原版相认入口 */
	function mbCEKnowRender(pane, name) {
		if (!pane) { return; }
		var body = mceNewGroup(pane, "认识状态", "原版相认场景 · 标记为认识（走 initnpc 全套初始化）");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEKnowState(name);
			var initTxt = st.known ? "已认识（init = 1）" : (st.has ? "未认识（init = 0）" : "无运行时对象");
			var firstTxt = st.firstMeet ? "「" + st.firstMeet + "」" : "暂无（仅记录本模组注入后的相认）";
			mbCEVanillaEconUiKv(body, [
				["认识状态", initTxt],
				["相认场景", st.staticScene || "未登记（遇到后会自动记录当时段落）"],
				["首次记录", firstTxt]
			]);
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "标记为认识", "调原版 initnpc 完成 init / 数值 / 贞操 / 衣装 / 代词初始化，再把当前面板数值写回", function () {
				mbCEVanillaEconUiRun(mbCEKnowSet(name), redraw);
			});
			body.appendChild(mceFoldHint("原版 initnpc 只对 init = 0 的角色执行一次，会清空七项数值并生成衣装与代词；"
				+ "这里初始化后立刻把七项数值写回，剧情标志（如 seen 列表）仍按原版初始化结果走。"
				+ "相认场景优先显示已取证的原版入口；运行时命中 0→1 的段落会自动追加到「首次记录」。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["know-npc", "回退认识"]]);
		};
		redraw();
	}
	/* 阶段页扩展聚合：07c 只在数据卡之后调这一个入口，后续新增块不必再改 07c */
	function mbCEStageExtras(pane, name) {
		if (typeof mbCEKnowRender === "function") { mbCEKnowRender(pane, name); }
		if (typeof mbCEGwylanRender === "function") { mbCEGwylanRender(pane, name); }
		if (typeof mbCESamRender === "function") { mbCESamRender(pane, name); }
	}
	/* 异常不得阻断阶段页主卡与内层标签（try 收在这里，避免给 07c 的 renderStagePane 增加复杂度） */
	function mbCEStageExtrasSafe(pane, name) {
		try { mbCEStageExtras(pane, name); } catch (eX) { /* 扩展块失败静默 */ }
	}
