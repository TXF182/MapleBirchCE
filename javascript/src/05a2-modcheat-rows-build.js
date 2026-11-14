/* 职责：Mod作弊页行构建 —— 模组/条目查询（getCheatMods 等）、任务跳过与完成 */
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
			return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, levels[idxStr], "string", 0, levels.length - 1, s.sync);
		}
		/* v1.9.10：阶段是枚举语义（UI 下拉限定）——仍钳制到 levels 范围，与数值项放开上限区分 */
		var lvStage = Math.max(levels[0], Math.min(levels[levels.length - 1], Number(level) || 0));
		return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, lvStage, "number", levels[0], levels[levels.length - 1], s.sync);
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
	function buildCheatTaskRow(m, t) {
		var row = el("div", MCE_CLS.row);
		row.setAttribute("data-mce-key", "tasks:" + t.key);
		row.appendChild(el("span", MCE_CLS.rowLbl, t.name || t.key));
		var b1 = el("button", "", "跳过任务"); b1.type = "button";
		b1.addEventListener("click", function () { actCheat(skipCheatTask(m.modId, t.key), m.modId, "tasks:" + t.key); });
		var b2 = el("button", "", "直接完成任务"); b2.type = "button";
		b2.addEventListener("click", function () { actCheat(completeCheatTask(m.modId, t.key), m.modId, "tasks:" + t.key); });
		row.appendChild(b1); row.appendChild(b2);
		return row;
	}
	function renderCheatTasks(m, grpFor, buildRows) {
		var g = grpFor("tasks", "1. 模组新增任务");
		m.tasks.forEach(function (t) {
			g.count++;
			g.pending.push(function () { return buildCheatTaskRow(m, t); });
		});
	}
	function buildCheatStageRow(m, s) {
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		var labels = Array.isArray(s.labels) && s.labels.length ? s.labels : levels.map(function (lv) { return String(lv); });
		var row = el("div", MCE_CLS.row);
		row.setAttribute("data-mce-key", "stages:" + s.key);
		row.appendChild(el("span", MCE_CLS.rowLbl, "阶段 · " + (s.name || s.key)));
		var sel = el("select", "mce-sel");
		levels.forEach(function (lv, i) {
			var opt = el("option", "", labels[i] !== undefined ? labels[i] : String(lv));
			opt.value = String(lv);
			sel.appendChild(opt);
		});
		/* v1.4.4：回显当前阶段值（字符串枚举/数字枚举均按值匹配），应用后局部刷新立即可见生效 */
		reflectStageSelect(sel, s, m.modId);
		var bSet = el("button", "", "应用"); bSet.type = "button";
		bSet.addEventListener("click", function () { actCheat(setCheatStage(m.modId, s.key, sel.value), m.modId, "stages:" + s.key); });
		var bMax = el("button", "", "跳至最高"); bMax.type = "button";
		bMax.addEventListener("click", function () { actCheat(jumpCheatStageMax(m.modId, s.key), m.modId, "stages:" + s.key); });
		var bMin = el("button", "", "回退初始"); bMin.type = "button";
		bMin.addEventListener("click", function () { actCheat(resetCheatStage(m.modId, s.key), m.modId, "stages:" + s.key); });
		row.appendChild(sel); row.appendChild(bSet); row.appendChild(bMax); row.appendChild(bMin);
		return row;
	}
	function buildCheatAbilityRow(m, a) {
		var row = el("div", MCE_CLS.row);
		row.setAttribute("data-mce-key", "abilities:" + a.key);
		var box = el("input", "");
		box.type = "checkbox";
		box.checked = !!cheatReadSafe(m.modId, a.varPath);
		box.addEventListener("change", function () { actCheat(toggleCheatAbility(m.modId, a.key, box.checked), m.modId, "abilities:" + a.key); });
		row.appendChild(box);
		var abl = el("span", MCE_CLS.rowLbl, "能力 · " + (a.name || a.key));
		/* v1.9.13 排版：写入路径移出 label（折叠「说明」与悬停 title 均可查），label 变短不再挤压按钮区 */
		if (a.varPath) { abl.title = a.varPath; }
		row.appendChild(abl);
		/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
		var det = el("details", "mce-ab-detail");
		det.appendChild(el("summary", "mce-ab-sum", "说明"));
		var body = el("div", "mce-ab-body");
		if (a.varPath) { body.appendChild(el("div", "", "写入路径：" + a.varPath)); }
		body.appendChild(el("div", "", "类型：" + (a.type || "boolean")));
		if (a.type === "number" && (a.min !== undefined || a.max !== undefined)) {
			body.appendChild(el("div", "", "参考范围：" + (a.min !== undefined ? a.min : "-∞") + " ~ " + (a.max !== undefined ? a.max : "∞")));
		}
		if (a.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + a.note)); }
		det.appendChild(body);
		row.appendChild(det);
		return row;
	}
	function renderCheatStages(m, grpFor, buildRows) {
		var g = grpFor("stages", "2. 模组新增阶段 & 能力");
		m.stages.forEach(function (s) { g.count++; g.pending.push(function () { return buildCheatStageRow(m, s); }); });
		m.abilities.forEach(function (a) { g.count++; g.pending.push(function () { return buildCheatAbilityRow(m, a); }); });
	}
	function buildCheatSceneRow(m, s) {
		var row = el("div", MCE_CLS.row);
		row.setAttribute("data-mce-key", "scenes:" + s.key);
		row.appendChild(el("span", MCE_CLS.rowLbl, s.name || s.key));
		var b1 = el("button", "", "跳过此段剧情"); b1.type = "button";
		b1.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_skip"), m.modId, "scenes:" + s.key); });
		var b2 = el("button", "", "强制完成剧情"); b2.type = "button";
		b2.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_force"), m.modId, "scenes:" + s.key); });
		var b3 = el("button", "", "重置剧情进度"); b3.type = "button";
		b3.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_reset"), m.modId, "scenes:" + s.key); });
		row.appendChild(b1); row.appendChild(b2); row.appendChild(b3);
		return row;
	}
	function renderCheatScenes(m, grpFor, buildRows) {
		var g = grpFor("scenes", "3. 模组自定义剧情");
		m.scenes.forEach(function (s) { g.count++; g.pending.push(function () { return buildCheatSceneRow(m, s); }); });
	}
	function buildCheatValueRow(m, it) {
		if (it.type === "list") {
			var opts = Array.isArray(it.options) ? it.options : [];
			var curArr = cheatReadSafe(m.modId, it.varPath);
			var arr = Array.isArray(curArr) ? curArr : [];
			var rows = [];
			if (!opts.length) {
				rows.push(el("div", MCE_CLS.hint, (it.name || it.key) + "：未声明候选值（options 为空）。"));
			}
			opts.forEach(function (opt) {
				var brow = el("div", MCE_CLS.row);
				brow.setAttribute("data-mce-key", "values:" + it.key + ":" + opt);
				var box = el("input", "");
				box.type = "checkbox";
				box.checked = arr.indexOf(opt) !== -1;
				box.addEventListener("change", function () {
					actCheat(applyCheatModValue(m.modId, it.key, { value: opt, on: box.checked }), m.modId, "values:" + it.key + ":" + opt);
				});
				brow.appendChild(box);
				var lbl = el("span", MCE_CLS.rowLbl, (it.name || it.key) + " · " + opt);
				if (it.varPath) { lbl.title = it.varPath; }
				brow.appendChild(lbl);
				var und = el("button", "", "回退"); und.type = "button";
				und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key + ":" + opt), m.modId, "values:" + it.key + ":" + opt); });
				brow.appendChild(und);
				rows.push(brow);
			});
			return rows;
		}
		var row = el("div", MCE_CLS.row);
		row.setAttribute("data-mce-key", "values:" + it.key);
		var vlbl = el("span", MCE_CLS.rowLbl, it.name || it.key);
		if (it.varPath) { vlbl.title = it.varPath; }
		row.appendChild(vlbl);
		var inp = el("input", MCE_CLS.inp);
		inp.type = it.type === "boolean" ? "checkbox" : "text";
		if (it.type !== "boolean") {
			/* v1.8.12 功能9+优化：text 输入使 +N / -N 相对语法可输入（number 输入框会拒绝 + 号），
			   数值合法性由 cheatWriteValue 校验兜底 */
			inp.inputmode = "decimal";
			inp.placeholder = "+N / -N 相对";
			inp.title = "支持相对调整：输入 +100 表示在当前值上加 100，-20 表示减 20；直接输入数字为绝对值（范围仅供参考，上限不钳制）";
		}
		var cur = cheatReadSafe(m.modId, it.varPath);
		if (it.type === "boolean") { inp.checked = !!cur; }
		else if (cur !== undefined && cur !== null) { inp.value = String(cur); }
		var b = el("button", "", "应用修改"); b.type = "button";
		b.addEventListener("click", function () {
			var raw = it.type === "boolean" ? inp.checked : inp.value;
			actCheat(applyCheatModValue(m.modId, it.key, raw), m.modId, "values:" + it.key);
		});
		row.appendChild(inp); row.appendChild(b);
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key), m.modId, "values:" + it.key); });
		row.appendChild(und);
		/* v1.8.7 数值项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
		var det = el("details", "mce-ab-detail");
		det.appendChild(el("summary", "mce-ab-sum", "说明"));
		var body = el("div", "mce-ab-body");
		if (it.varPath) { body.appendChild(el("div", "", "写入路径：" + it.varPath)); }
		body.appendChild(el("div", "", "类型：" + (it.type || "number")));
		if (typeof it.min === "number" || typeof it.max === "number") {
			body.appendChild(el("div", "", "参考范围：" + (typeof it.min === "number" ? it.min : "-∞") + " ~ " + (typeof it.max === "number" ? it.max : "∞")));
		}
		if (it.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + it.note)); }
		det.appendChild(body);
		row.appendChild(det);
		return row;
	}
	/* v1.9.13 数值项搜索命中判定（纯函数，可测）：q 为空恒命中；否则匹配 名称/键名/写入路径 */
	function cheatValueMatches(it, q) {
		if (!q) { return true; }
		var hay = ((it.name || "") + " " + it.key + " " + (it.varPath || "")).toLowerCase();
		return hay.indexOf(q) !== -1;
	}
	function renderCheatValues(m, grpFor, buildRows) {
		var g = grpFor("values", "4. 自定义数值修改");
		/* v1.9.13 搜索过滤：命中名称/键名/写入路径才计入；搜索态强制该组展开（过滤结果立即可见） */
		var q = modValueFilter ? modValueFilter.toLowerCase() : "";
		m.values.forEach(function (it) {
			if (!cheatValueMatches(it, q)) { return; }
			g.count++;
			g.pending.push(function () { return buildCheatValueRow(m, it); });
		});
		if (q && g.body) { g.body.setAttribute("data-collapsed", "0"); }
	}
