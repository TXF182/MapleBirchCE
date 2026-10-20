	/* 动态发现：注册制 + 内置适配器（探测命中即合并）+ 被动识别占位；每次调用重扫。 */
	function getCheatMods() {
		try {
			var out = [], seen = {}, i;
			var regs = (setup && Array.isArray(setup.mbCE_modCheats)) ? setup.mbCE_modCheats : [];
			for (i = 0; i < regs.length; i++) {
				var m = regs[i];
				if (!m || !m.modId || !m.modName) { continue; }
				seen[m.modId] = true;
				out.push(normalizeCheatMod(m));
			}
			var adIds = Object.keys(CHEAT_ADAPTERS);
			for (i = 0; i < adIds.length; i++) {
				var ad = CHEAT_ADAPTERS[adIds[i]];
				if (!ad || seen[adIds[i]]) { continue; }
				try { if (typeof ad.detect !== "function" || !ad.detect()) { continue; } } catch (e) { continue; }
				seen[adIds[i]] = true;
				out.push(normalizeCheatMod(ad.entry));
			}
			for (i = 0; i < CHEAT_PASSIVE_PROBES.length; i++) {
				var p = CHEAT_PASSIVE_PROBES[i];
				if (!p || !p.modId || seen[p.modId]) { continue; }
				try { if (typeof p.detect !== "function" || !p.detect()) { continue; } } catch (e) { continue; }
				seen[p.modId] = true;
				out.push({ modId: p.modId, modName: p.modName, declared: false, tasks: [], stages: [], abilities: [], scenes: [], values: [] });
			}
			return out;
		} catch (e) { return []; }
	}
	function findCheatMod(modId) {
		var mods = getCheatMods(), i;
		for (i = 0; i < mods.length; i++) { if (mods[i].modId === modId) { return mods[i]; } }
		return null;
	}
	function findCheatItem(list, key) {
		var i;
		for (i = 0; i < list.length; i++) { if (list[i] && list[i].key === key) { return list[i]; } }
		return null;
	}
	/* ---- 四分组动作（统一走通用执行器，不写模组专属逻辑） ---- */
	function skipCheatTask(modId, key) {
		var m = findCheatMod(modId), t = m && findCheatItem(m.tasks, key);
		if (!t) { return { ok: false, message: "任务不存在或该模组未注册" }; }
		if (!t.skipVar) { return { ok: false, message: "「" + t.name + "」未声明跳过标记变量（skipVar），无法跳过" }; }
		return cheatWriteValue(modId, "task_skip:" + key, "task_skip", t.skipVar, true, "boolean");
	}
	function completeCheatTask(modId, key) {
		var m = findCheatMod(modId), t = m && findCheatItem(m.tasks, key);
		if (!t) { return { ok: false, message: "任务不存在或该模组未注册" }; }
		if (!t.completeVar) { return { ok: false, message: "「" + t.name + "」未声明完成标记变量（completeVar），无法直接完成" }; }
		return cheatWriteValue(modId, "task_complete:" + key, "task_complete", t.completeVar, true, "boolean");
	}
	function setCheatStage(modId, key, level) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.stages, key);
		if (!s) { return { ok: false, message: "阶段不存在或该模组未注册" }; }
		if (!s.varPath) { return { ok: false, message: "「" + s.name + "」未声明阶段变量（varPath），无法修改" }; }
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		if (typeof levels[0] === "string") {
			/* 字符串枚举阶段（v1.4.1）：目标值必须在 levels 内，越界拒绝，保持幂等 */
			var idxStr = levels.indexOf(String(level));
			if (idxStr === -1) { return { ok: false, message: "阶段值「" + level + "」不在枚举范围内（" + levels.join(" / ") + "）" }; }
			return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, levels[idxStr], "string", 0, levels.length - 1);
		}
		return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, Number(level), "number", levels[0], levels[levels.length - 1]);
	}
	function jumpCheatStageMax(modId, key) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.stages, key);
		if (!s) { return { ok: false, message: "阶段不存在或该模组未注册" }; }
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		return setCheatStage(modId, key, levels[levels.length - 1]);
	}
	function resetCheatStage(modId, key) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.stages, key);
		if (!s) { return { ok: false, message: "阶段不存在或该模组未注册" }; }
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		return setCheatStage(modId, key, levels[0]);
	}
	function toggleCheatAbility(modId, key, enabled) {
		var m = findCheatMod(modId), a = m && findCheatItem(m.abilities, key);
		if (!a) { return { ok: false, message: "能力不存在或该模组未注册" }; }
		if (!a.varPath) { return { ok: false, message: "「" + a.name + "」未声明能力变量（varPath），无法切换" }; }
		return cheatWriteValue(modId, "ability_set:" + key, "ability_set", a.varPath, !!enabled, "boolean");
	}
	function cheatSceneAction(modId, key, op) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.scenes, key);
		if (!s) { return { ok: false, message: "剧情不存在或该模组未注册" }; }
		if (op === "scene_skip") {
			if (!s.skipVar) { return { ok: false, message: "「" + s.name + "」未声明跳过标记变量（skipVar）" }; }
			return cheatWriteValue(modId, "scene_skip:" + key, "scene_skip", s.skipVar, true, "boolean");
		}
		if (op === "scene_force") {
			if (!s.completeVar) { return { ok: false, message: "「" + s.name + "」未声明完成标记变量（completeVar）" }; }
			return cheatWriteValue(modId, "scene_force:" + key, "scene_force", s.completeVar, true, "boolean");
		}
		if (op === "scene_reset") {
			if (!s.progressVar) { return { ok: false, message: "「" + s.name + "」未声明进度变量（progressVar），无法重置" }; }
			var rv = (typeof s.resetValue === "number") ? s.resetValue : 0;
			return cheatWriteValue(modId, "scene_reset:" + key, "scene_reset", s.progressVar, rv, "number");
		}
		return { ok: false, message: "未知剧情操作" };
	}
	function applyCheatModValue(modId, key, raw) {
		var m = findCheatMod(modId), it = m && findCheatItem(m.values, key);
		if (!it) { return { ok: false, message: "数值项不存在或该模组未注册" }; }
		if (!it.varPath) { return { ok: false, message: "「" + it.name + "」未声明变量（varPath）" }; }
		if (it.type === "list") {
			var v = raw && typeof raw === "object" ? raw : { value: String(raw), on: true };
			return cheatWriteListValue(modId, "value_set:" + key + ":" + v.value, "value_set", it.varPath, v.value, !!v.on);
		}
		return cheatWriteValue(modId, "value_set:" + key, "value_set", it.varPath, raw, it.type === "boolean" ? "boolean" : "number", it.min, it.max);
	}
	function cheatReadSafe(modId, path) {
		try {
			var r = cheatResolvePath(path);
			return r.ok ? r.parent[r.leaf] : undefined;
		} catch (e) { return undefined; }
	}
	/* ---- 渲染：主容器页（模组列表，本身不展示修改控件） ---- */
	function renderModCheats() {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		pane.textContent = "";
		pane.appendChild(el("div", "mce-hint", "本页面用于操控其他第三方模组新增的拓展内容，不修改游戏原版数据。下方为已识别到支持作弊控制的模组，点击模组名称进入对应控制子页面。"));
		/* v1.7.0：玩家自己编辑入口（玩家所有属性 + 模组加入属性，全量，数值与阶段可改） */
		var pcard = el("div", "mce-card mce-sel");
		var ptop = el("div", "mce-card-top");
		ptop.appendChild(el("span", "mce-card-name", "▶ 玩家自己 · 属性与特质"));
		ptop.appendChild(el("span", "mce-badge mce-on", "面板数值/特质可改"));
		pcard.appendChild(ptop);
		pcard.appendChild(el("div", "mce-hint", "游戏属性面板数值快捷编辑 + 全部特质管理（含其他模组注入的特质，自动发现；获取时条件不满足自动改为满足）。"));
		pcard.addEventListener("click", function () { renderPlayerEdit(); });
		pane.appendChild(pcard);
		var mods = getCheatMods();
		if (!mods.length) {
			pane.appendChild(el("div", "mce-err", "⚠ 暂未识别到可控制的第三方模组拓展内容，请加载对应模组后重试。"));
			return;
		}
		var list = el("div", "mce-cards");
		mods.forEach(function (m) {
			var row = el("div", "mce-card" + (m.modId === curCheatModId ? " mce-sel" : ""));
			var top = el("div", "mce-card-top");
			top.appendChild(el("span", "mce-card-name", "▶ " + m.modName));
			top.appendChild(el("span", "mce-badge " + (m.declared ? "mce-on" : "mce-off"), m.declared ? "可操控" : "未声明"));
			row.appendChild(top);
			if (!m.declared) {
				row.appendChild(el("div", "mce-hint", "该模组未按注册协议声明可操控项，仅识别展示（不提供操控）。"));
			} else {
				row.addEventListener("click", (function (mod) {
					return function () { curCheatModId = mod.modId; renderModCheatDetail(mod.modId); };
				})(m));
			}
			list.appendChild(row);
		});
		pane.appendChild(list);
	}
	/* ---- 渲染：模组子页面（四分组通用控件，严格隔离：只渲染归属模组的项） ---- */
	function renderModCheatDetail(modId) {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		var m = findCheatMod(modId);
		pane.textContent = "";
		if (!m) {
			pane.appendChild(el("div", "mce-err", "模组未识别（可能已卸载），请返回列表。"));
			return;
		}
		var back = el("button", "", "← 返回模组列表");
		back.type = "button";
		back.addEventListener("click", function () { curCheatModId = ""; renderModCheats(); });
		pane.appendChild(back);
		pane.appendChild(el("div", "mce-hint", "【" + m.modName + "】作弊控制"));
		pane.appendChild(el("div", "mce-hint", "所有操作仅作用于 " + m.modName + " 的新增内容，不会改动游戏本体与其他模组数据。"));
		var any = false;
		if (m.tasks.length) { any = true; renderCheatTasks(pane, m); }
		if (m.stages.length || m.abilities.length) { any = true; renderCheatStages(pane, m); }
		if (m.scenes.length) { any = true; renderCheatScenes(pane, m); }
		if (m.values.length) { any = true; renderCheatValues(pane, m); }
		if (!any) {
			pane.appendChild(el("div", "mce-hint", "该模组已识别但未声明可操控项（任务/阶段/剧情/数值均为空）。"));
		}
	}
	function renderCheatTasks(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "1. 模组新增任务"));
		m.tasks.forEach(function (t) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", t.name || t.key));
			var b1 = el("button", "", "跳过任务"); b1.type = "button";
			b1.addEventListener("click", function () { actCheat(skipCheatTask(m.modId, t.key), m.modId); });
			var b2 = el("button", "", "直接完成任务"); b2.type = "button";
			b2.addEventListener("click", function () { actCheat(completeCheatTask(m.modId, t.key), m.modId); });
			row.appendChild(b1); row.appendChild(b2);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function renderCheatStages(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "2. 模组新增阶段 & 能力"));
		m.stages.forEach(function (s) {
			var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
			var labels = Array.isArray(s.labels) && s.labels.length ? s.labels : levels.map(function (lv) { return String(lv); });
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", "阶段 · " + (s.name || s.key)));
			var sel = el("select", "mce-sel");
			levels.forEach(function (lv, i) {
				var opt = el("option", "", labels[i] !== undefined ? labels[i] : String(lv));
				opt.value = String(lv);
				sel.appendChild(opt);
			});
			/* v1.4.4：回显当前阶段值（字符串枚举/数字枚举均按值匹配），应用后重渲染立即可见生效 */
			var curStage = cheatReadSafe(m.modId, s.varPath);
			if (curStage !== undefined && curStage !== null) {
				var curStr = String(curStage);
				for (var si = 0; si < levels.length; si++) {
					if (String(levels[si]) === curStr) { sel.selectedIndex = si; break; }
				}
			}
			var bSet = el("button", "", "应用"); bSet.type = "button";
			bSet.addEventListener("click", function () { actCheat(setCheatStage(m.modId, s.key, sel.value), m.modId); });
			var bMax = el("button", "", "跳至最高"); bMax.type = "button";
			bMax.addEventListener("click", function () { actCheat(jumpCheatStageMax(m.modId, s.key), m.modId); });
			var bMin = el("button", "", "回退初始"); bMin.type = "button";
			bMin.addEventListener("click", function () { actCheat(resetCheatStage(m.modId, s.key), m.modId); });
			row.appendChild(sel); row.appendChild(bSet); row.appendChild(bMax); row.appendChild(bMin);
			g.appendChild(row);
		});
		m.abilities.forEach(function (a) {
			var row = el("div", "mce-row");
			var box = el("input", "");
			box.type = "checkbox";
			box.checked = !!cheatReadSafe(m.modId, a.varPath);
			box.addEventListener("change", function () { actCheat(toggleCheatAbility(m.modId, a.key, box.checked), m.modId); });
			row.appendChild(box);
			row.appendChild(el("span", "mce-row-lbl", "能力 · " + (a.name || a.key) + (a.varPath ? "（" + a.varPath + "）" : "")));
			/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
			var det = el("details", "mce-ab-detail");
			det.appendChild(el("summary", "mce-ab-sum", "说明"));
			var body = el("div", "mce-ab-body");
			if (a.varPath) { body.appendChild(el("div", "", "写入路径：" + a.varPath)); }
			body.appendChild(el("div", "", "类型：" + (a.type || "boolean")));
			if (a.type === "number" && (a.min !== undefined || a.max !== undefined)) {
				body.appendChild(el("div", "", "钳制范围：" + (a.min !== undefined ? a.min : "-∞") + " ~ " + (a.max !== undefined ? a.max : "∞")));
			}
			if (a.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + a.note)); }
			det.appendChild(body);
			row.appendChild(det);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function renderCheatScenes(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "3. 模组自定义剧情"));
		m.scenes.forEach(function (s) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", s.name || s.key));
			var b1 = el("button", "", "跳过此段剧情"); b1.type = "button";
			b1.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_skip"), m.modId); });
			var b2 = el("button", "", "强制完成剧情"); b2.type = "button";
			b2.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_force"), m.modId); });
			var b3 = el("button", "", "重置剧情进度"); b3.type = "button";
			b3.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_reset"), m.modId); });
			row.appendChild(b1); row.appendChild(b2); row.appendChild(b3);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function renderCheatValues(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "4. 自定义数值修改"));
		m.values.forEach(function (it) {
			if (it.type === "list") {
				var opts = Array.isArray(it.options) ? it.options : [];
				var curArr = cheatReadSafe(m.modId, it.varPath);
				var arr = Array.isArray(curArr) ? curArr : [];
				if (!opts.length) {
					g.appendChild(el("div", "mce-hint", (it.name || it.key) + "：未声明候选值（options 为空）。"));
				}
				opts.forEach(function (opt) {
					var brow = el("div", "mce-row");
					var box = el("input", "");
					box.type = "checkbox";
					box.checked = arr.indexOf(opt) !== -1;
					box.addEventListener("change", function () {
						actCheat(applyCheatModValue(m.modId, it.key, { value: opt, on: box.checked }), m.modId);
					});
					brow.appendChild(box);
					brow.appendChild(el("span", "mce-row-lbl", (it.name || it.key) + " · " + opt + "（" + it.varPath + "）"));
					var und = el("button", "", "回退"); und.type = "button";
					und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key + ":" + opt), m.modId); });
					brow.appendChild(und);
					g.appendChild(brow);
				});
				return;
			}
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", (it.name || it.key) + "（" + it.varPath + "）"));
			var inp = el("input", "mce-inp");
			inp.type = it.type === "boolean" ? "checkbox" : "number";
			if (it.type !== "boolean") {
				if (typeof it.min === "number") { inp.min = String(it.min); }
				if (typeof it.max === "number") { inp.max = String(it.max); }
				inp.step = "1";
			}
			var cur = cheatReadSafe(m.modId, it.varPath);
			if (it.type === "boolean") { inp.checked = !!cur; }
			else if (cur !== undefined && cur !== null) { inp.value = String(cur); }
			var b = el("button", "", "应用修改"); b.type = "button";
			b.addEventListener("click", function () {
				var raw = it.type === "boolean" ? inp.checked : inp.value;
				actCheat(applyCheatModValue(m.modId, it.key, raw), m.modId);
			});
			row.appendChild(inp); row.appendChild(b);
			var und = el("button", "", "回退"); und.type = "button";
			und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key), m.modId); });
			row.appendChild(und);
			/* v1.8.7 数值项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
			var det = el("details", "mce-ab-detail");
			det.appendChild(el("summary", "mce-ab-sum", "说明"));
			var body = el("div", "mce-ab-body");
			if (it.varPath) { body.appendChild(el("div", "", "写入路径：" + it.varPath)); }
			body.appendChild(el("div", "", "类型：" + (it.type || "number")));
			if (typeof it.min === "number" || typeof it.max === "number") {
				body.appendChild(el("div", "", "钳制范围：" + (typeof it.min === "number" ? it.min : "-∞") + " ~ " + (typeof it.max === "number" ? it.max : "∞")));
			}
			if (it.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + it.note)); }
			det.appendChild(body);
			row.appendChild(det);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function actCheat(res, modId) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		if (modId) { renderModCheatDetail(modId); }
	}

	/* ============ v1.7.0 玩家属性全量编辑（Mod作弊 主容器页「玩家自己」入口）
	       数据源：① V.player 全量（递归限深 3，循环引用防崩）；② 模组属性 = 运行时 V 顶层键
	       - ORIGINAL_V_ROOT_KEYS - CHEAT_VANILLA_ROOTS - mbCE_*（与原版比对，只添加没有的）。
	       可改：number（数字输入）/ boolean（勾选）/ 短字符串阶段（≤24 字符且无空白 → 文本输入）；
	       只读：长字符串 / 函数 / undefined / null / 深度超限 / 循环引用。
	       写入：复用 cheatWriteValue（modId="player-self"，root=player 或模组键不在原版黑名单），
	       mbCE_wrote 留痕 + 每项回退按钮。 ============ */
	var curPlayerFilter = "";
	var curPlayerSection = "player";
	function actPlayer(res) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		renderPlayerEdit();
	}
	/* v1.7.2：游戏属性面板（颜色分级）快捷编辑——直接改游戏面板显示的原版数值键
	   （purity/physique 等顶层键 + prof.* 武器键；实证自本体 currentSkillValue 体系与 $prof 对象；
	     歌唱/驾驶无原版变量（GameUI 自定义/未解锁），不收录；不安感无数值显示，不收录）。 */
	var PANEL_QUICK_GROUPS = [
		{ title: "核心属性", items: [["purity", "纯洁"], ["beauty", "容貌"], ["physique", "体能"], ["willpower", "意志"], ["awareness", "意识"], ["promiscuity", "淫乱"], ["exhibitionism", "暴露癖"], ["deviancy", "异种癖"]] },
		{ title: "基础技能", items: [["skulduggery", "诡术"], ["danceskill", "舞蹈"], ["swimmingskill", "游泳"], ["athletics", "运动"], ["tending", "护理"], ["housekeeping", "家务"]] },
		{ title: "性技能", items: [["seductionskill", "魅惑"], ["oralskill", "口部"], ["chestskill", "胸部"], ["handskill", "手部"], ["bottomskill", "臀部"], ["penileskill", "阴茎"], ["vaginalskill", "小穴"], ["analskill", "后庭"], ["thighskill", "大腿"], ["feetskill", "足部"]] },
		{ title: "学校成绩", items: [["science", "科学"], ["maths", "数学"], ["english", "语文"], ["history", "历史"]] },
		{ title: "武器技能", items: [["prof.spray", "防狼喷雾"], ["prof.baton", "短棍"], ["prof.whip", "鞭子"], ["prof.net", "网"], ["prof.pickaxe", "镐"]] }
	];
	function quickReadValue(path) {
		try {
			var V2 = getV();
			if (!V2) { return null; }
			if (String(path).indexOf("prof.") === 0) {
				var leaf = String(path).split(".")[1];
				return (V2.prof && typeof V2.prof === "object") ? V2.prof[leaf] : undefined;
			}
			return V2[path];
		} catch (e) { return null; }
	}
	/* 武器父级兜底：$prof 缺失时补空壳（只建不覆盖），使 prof.* 可安全写入 */
	function ensureProfShell() {
		try {
			var V2 = getV();
			if (!V2) { return { ok: false, message: "存档变量不可用" }; }
			if (!V2.prof || typeof V2.prof !== "object") {
				V2.prof = { spray: 0, baton: 0, whip: 0, net: 0, pickaxe: 0 };
				return { ok: true, created: true };
			}
			return { ok: true, created: false };
		} catch (e) { return { ok: false, message: "武器数据初始化失败" }; }
	}
	function quickWrite(path, raw) {
		if (String(path).indexOf("prof.") === 0) {
			var es = ensureProfShell();
			if (!es.ok) { return es; }
		}
		return cheatWriteValue("player-self", "p:" + path, "value_set", path, raw, "number");
	}
	function renderQuickRow(pane, path, label) {
		var cur = quickReadValue(path);
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", label + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "number"; inp.step = "1"; inp.value = (typeof cur === "number") ? String(cur) : "0";
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () { actPlayer(quickWrite(path, inp.value)); });
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actPlayer(undoCheatModValue("player-self", "p:" + path)); });
		row.appendChild(inp); row.appendChild(b); row.appendChild(und);
		pane.appendChild(row);
	}
	function renderQuickPanel(pane) {
		PANEL_QUICK_GROUPS.forEach(function (g) {
			var box = el("div", "mce-grp");
			box.appendChild(el("div", "mce-grp-t", g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）"));
			g.items.forEach(function (it) { renderQuickRow(box, it[0], it[1]); });
			pane.appendChild(box);
		});
	}
