	/* v1.9.4 问题2 根治：Mod 子页超长组时间分片构建（模块级状态，跨 renderModCheatDetail 渲染存活）。
	   背景：DoL-Game-UI 每帧 rAF 全量样式扫描抢主线程，Mod 子页"全部展开"一次性建数百行 =
	   单帧长任务 → 移动 WebView 滚动丢帧 / 长任务 ANR 闪退（用户实测）。
	   方案：pending > MOD_ROW_BATCH_LIMIT 时改为分帧构建（首帧同步建 MOD_ROW_BATCH 行，剩余入队
	   逐帧 setTimeout 排空），把长任务摊平，不砍任何作弊项；测试环境设
	   window.__mbCE_forceSyncRows=true 强制同步（smoke 同步断言）。 */
	var modRowBatchTimer = null;
	var modRowQueue = []; /* 分片任务：{ body, fns, i, failed } */
	var MOD_ROW_BATCH = 40;
	var MOD_ROW_BATCH_LIMIT = 60;
	function mbCEForceSyncRows() {
		try { return typeof window !== "undefined" && window && window.__mbCE_forceSyncRows === true; } catch (e) { return false; }
	}
	function appendRowNodes(body, n) {
		if (!n) { return; }
		if (n.length) { for (var i2 = 0; i2 < n.length; i2++) { body.appendChild(n[i2]); } }
		else { body.appendChild(n); }
	}
	/* 分片排空：每帧最多建 BATCH 行，直到队列清空（长任务摊平；3 个 guard 防本帧过度） */
	function modRowStep() {
		var guard = 0;
		while (modRowQueue.length && guard < 3) {
			var t = modRowQueue[0];
			var built = 0;
			while (t.i < t.fns.length && built < MOD_ROW_BATCH) {
				try { appendRowNodes(t.body, t.fns[t.i]()); } catch (e) { t.failed++; }
				t.i++; built++;
			}
			if (t.i >= t.fns.length) {
				if (t.failed) { t.body.appendChild(el("div", "mce-hint", "有 " + t.failed + " 行加载失败（适配器数据异常），已跳过。")); }
				modRowQueue.shift();
			}
			guard++;
		}
		if (modRowQueue.length) { modRowBatchTimer = setTimeout(modRowStep, 0); }
		else { modRowBatchTimer = null; }
	}
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
	/* v1.9.1（DoL-Game-UI 冲突排查）：子页四分组默认收起 + 懒渲染——
	   用户实测「滑动卡住截断 / 展开过多卡住闪退」，根因链：子页一次全量建数百行
	   （枯木逢春 9 阶段+18 能力+3 场景+28 数值）+ DoL-Game-UI 每帧 rAF 全量扫描抢占主线程 →
	   移动 WebView 滚动丢帧 / 长任务 ANR。
	   改为：组头常驻、组体默认收起（data-collapsed=1）、行闭包进 pending 点击展开才建
	   （学 06-traits 九巡懒渲染模式）；展开状态经 mbCEUiCollapsed 持久化
	   （key "mods:<modId>:<组名>"），重建后按持久化恢复。 */
	function renderModCheatDetail(modId) {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		var m = findCheatMod(modId);
		var st = pane.scrollTop; /* 五巡：重建后保持滚动位置（翻到长列表底部操作不再跳回顶部） */
		/* v1.9.5-自检：重建时清残留分片任务——切 tab/重进子页后旧渲染的分片不再往已脱离 DOM 的 body 补行（省帧），
		   新渲染的 pending 行由全新任务构建，与旧队列无关 */
		if (modRowBatchTimer) { clearTimeout(modRowBatchTimer); modRowBatchTimer = null; }
		modRowQueue.length = 0;
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
		/* 折叠工具行：全部展开 / 全部收起（懒渲染下组体行按需补建） */
		var toolRow = el("div", "mce-row");
		toolRow.appendChild(el("span", "mce-row-lbl", "折叠工具："));
		var bAllOpen = el("button", "", "全部展开"); bAllOpen.type = "button";
		bAllOpen.setAttribute("data-mce-tool", "mods-open");
		bAllOpen.addEventListener("click", function () {
			Object.keys(groups).forEach(function (k) {
				var g = groups[k];
				g.body.setAttribute("data-collapsed", "0");
				g.head.textContent = g.head.textContent.replace(/^▸\s*/, "▾ ");
				buildModGrpRows(g);
				mbCEUiCollapsed("mods:" + modId + ":" + k, true);
			});
		});
		var bAllClose = el("button", "", "全部收起"); bAllClose.type = "button";
		bAllClose.setAttribute("data-mce-tool", "mods-close");
		bAllClose.addEventListener("click", function () {
			Object.keys(groups).forEach(function (k) {
				var g = groups[k];
				g.body.setAttribute("data-collapsed", "1");
				g.head.textContent = g.head.textContent.replace(/^▾\s*/, "▸ ");
				mbCEUiCollapsed("mods:" + modId + ":" + k, false);
			});
		});
		toolRow.appendChild(bAllOpen); toolRow.appendChild(bAllClose);
		pane.appendChild(toolRow);
		/* 分组容器：gkey -> { head, body, count, pending }（渲染过程局部缓存） */
		var groups = {};
		function grpFor(gkey, title) {
			if (groups[gkey]) { return groups[gkey]; }
			var grp = el("div", "mce-grp");
			grp.setAttribute("data-gkey", gkey);
			var restoreOpen = mbCEUiState.collapsed["mods:" + modId + ":" + gkey] === 0;
			var head = el("div", "mce-grp-t mce-collapse-head", (restoreOpen ? "▾ " : "▸ ") + title);
			head.setAttribute("data-mce-head", gkey);
			var body = el("div", "mce-grp-body");
			body.setAttribute("data-collapsed", restoreOpen ? "0" : "1");
			/* 分组对象先建（闭包引用 g 而非 DOM 节点 grp：计数/懒渲染 pending 都在 g 上） */
			var g = { head: head, body: body, count: 0, pending: [] };
			groups[gkey] = g;
			head.addEventListener("click", function () {
				var open = body.getAttribute("data-collapsed") !== "1";
				body.setAttribute("data-collapsed", open ? "1" : "0");
				head.textContent = (open ? "▸ " : "▾ ") + title + "（" + g.count + "）";
				/* 懒渲染：点击前收起（open=false）→ 点击后展开 → 补建行 */
				if (!open) { buildModGrpRows(g); }
				mbCEUiCollapsed("mods:" + modId + ":" + gkey, !open);
			});
			grp.appendChild(head); grp.appendChild(body);
			pane.appendChild(grp);
			return g;
		}
		function buildModGrpRows(grp) {
			if (!grp || !grp.pending || !grp.pending.length) { return; }
			var pend = grp.pending;
			grp.pending = [];
			var failed = 0;
			/* v1.9.4：行数超阈值或测试强制同步时走同步（首帧立即可见全部行）；否则分片 */
			if (mbCEForceSyncRows() || pend.length <= MOD_ROW_BATCH_LIMIT) {
				for (var i = 0; i < pend.length; i++) {
					try { appendRowNodes(grp.body, pend[i]()); } catch (e) { failed++; }
				}
				if (failed) {
					grp.body.appendChild(el("div", "mce-hint", "有 " + failed + " 行加载失败（适配器数据异常），已跳过。"));
				}
				return;
			}
			/* 分片：先同步建首批 BATCH 行（点击展开立刻可见内容），剩余入队逐帧排空 */
			var first = Math.min(MOD_ROW_BATCH, pend.length);
			for (var fi = 0; fi < first; fi++) {
				try { appendRowNodes(grp.body, pend[fi]()); } catch (e) { failed++; }
			}
			if (pend.length <= MOD_ROW_BATCH) {
				if (failed) {
					grp.body.appendChild(el("div", "mce-hint", "有 " + failed + " 行加载失败（适配器数据异常），已跳过。"));
				}
				return;
			}
			var task = { body: grp.body, fns: pend.slice(first), i: 0, failed: failed };
			modRowQueue.push(task);
			if (!modRowBatchTimer) { modRowBatchTimer = setTimeout(modRowStep, 0); }
		}
		var any = false;
		if (m.tasks.length) { any = true; renderCheatTasks(m, grpFor, buildModGrpRows); }
		if (m.stages.length || m.abilities.length) { any = true; renderCheatStages(m, grpFor, buildModGrpRows); }
		if (m.scenes.length) { any = true; renderCheatScenes(m, grpFor, buildModGrpRows); }
		if (m.values.length) { any = true; renderCheatValues(m, grpFor, buildModGrpRows); }
		if (!any) {
			pane.appendChild(el("div", "mce-hint", "该模组已识别但未声明可操控项（任务/阶段/剧情/数值均为空）。"));
		}
		/* 组头统一补计数 + 展开态初始建行（与 06-traits 一致：收起的组保持空，等点击展开才建） */
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			var open = g.body.getAttribute("data-collapsed") !== "1";
			g.head.textContent = (open ? "▾ " : "▸ ") + g.head.textContent.replace(/^[▸▾]\s*/, "") + "（" + g.count + "）";
			if (open) { buildModGrpRows(g); }
		});
		pane.scrollTop = st; /* 五巡：恢复滚动位置 */
	}
	/* 行构建抽为独立小函数（返回 node，懒渲染闭包内执行；data-mce-key 与事件保持五巡局部刷新兼容） */
	function buildCheatTaskRow(m, t) {
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "tasks:" + t.key);
		row.appendChild(el("span", "mce-row-lbl", t.name || t.key));
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
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "stages:" + s.key);
		row.appendChild(el("span", "mce-row-lbl", "阶段 · " + (s.name || s.key)));
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
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "abilities:" + a.key);
		var box = el("input", "");
		box.type = "checkbox";
		box.checked = !!cheatReadSafe(m.modId, a.varPath);
		box.addEventListener("change", function () { actCheat(toggleCheatAbility(m.modId, a.key, box.checked), m.modId, "abilities:" + a.key); });
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
		return row;
	}
	function renderCheatStages(m, grpFor, buildRows) {
		var g = grpFor("stages", "2. 模组新增阶段 & 能力");
		m.stages.forEach(function (s) { g.count++; g.pending.push(function () { return buildCheatStageRow(m, s); }); });
		m.abilities.forEach(function (a) { g.count++; g.pending.push(function () { return buildCheatAbilityRow(m, a); }); });
	}
	function buildCheatSceneRow(m, s) {
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "scenes:" + s.key);
		row.appendChild(el("span", "mce-row-lbl", s.name || s.key));
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
				rows.push(el("div", "mce-hint", (it.name || it.key) + "：未声明候选值（options 为空）。"));
			}
			opts.forEach(function (opt) {
				var brow = el("div", "mce-row");
				brow.setAttribute("data-mce-key", "values:" + it.key + ":" + opt);
				var box = el("input", "");
				box.type = "checkbox";
				box.checked = arr.indexOf(opt) !== -1;
				box.addEventListener("change", function () {
					actCheat(applyCheatModValue(m.modId, it.key, { value: opt, on: box.checked }), m.modId, "values:" + it.key + ":" + opt);
				});
				brow.appendChild(box);
				brow.appendChild(el("span", "mce-row-lbl", (it.name || it.key) + " · " + opt + "（" + it.varPath + "）"));
				var und = el("button", "", "回退"); und.type = "button";
				und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key + ":" + opt), m.modId, "values:" + it.key + ":" + opt); });
				brow.appendChild(und);
				rows.push(brow);
			});
			return rows;
		}
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "values:" + it.key);
		row.appendChild(el("span", "mce-row-lbl", (it.name || it.key) + "（" + it.varPath + "）"));
		var inp = el("input", "mce-inp");
		inp.type = it.type === "boolean" ? "checkbox" : "text";
		if (it.type !== "boolean") {
			/* v1.8.12 功能9+优化：text 输入使 +N / -N 相对语法可输入（number 输入框会拒绝 + 号），
			   数值合法性由 cheatWriteValue 校验兜底 */
			inp.inputmode = "decimal";
			inp.placeholder = "+N / -N 相对";
			inp.title = "支持相对调整：输入 +100 表示在当前值上加 100，-20 表示减 20；直接输入数字为绝对值（受钳制范围约束）";
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
			body.appendChild(el("div", "", "钳制范围：" + (typeof it.min === "number" ? it.min : "-∞") + " ~ " + (typeof it.max === "number" ? it.max : "∞")));
		}
		if (it.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + it.note)); }
		det.appendChild(body);
		row.appendChild(det);
		return row;
	}
	function renderCheatValues(m, grpFor, buildRows) {
		var g = grpFor("values", "4. 自定义数值修改");
		m.values.forEach(function (it) {
			g.count++;
			g.pending.push(function () { return buildCheatValueRow(m, it); });
		});
	}
	function actCheat(res, modId, key) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		/* 五巡：操作后局部刷新目标行（不再全量重建整个模组页——高频操作下 DOM churn 是卡顿/闪退累积源之一） */
		if (modId && key) {
			var pane = root.querySelector('[data-pane="mods"]');
			if (pane && refreshModRow(pane, modId, key)) { return; }
		}
		if (modId) { renderModCheatDetail(modId); }
	}
	/* 阶段下拉回显公共（渲染与局部刷新共用，v1.4.4 行为保持） */
	function reflectStageSelect(sel, s, modId) {
		try {
			var curStage = cheatReadSafe(modId, s.varPath);
			if (curStage !== undefined && curStage !== null) {
				var curStr = String(curStage);
				for (var si = 0; si < s.levels.length; si++) {
					if (String(s.levels[si]) === curStr) { sel.selectedIndex = si; return; }
				}
			}
		} catch (e) {}
	}
	/* 五巡：局部刷新单行回显态；行不存在或出错返回 false（调用方兜底全量重建） */
	function refreshModRow(pane, modId, key) {
		try {
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape(key) : String(key).replace(/["\\]/g, "\\$&");
			var row = pane.querySelector('[data-mce-key="' + esc + '"]');
			if (!row) { return false; }
			var m = findCheatMod(modId);
			if (!m) { return false; }
			var parts = String(key).split(":");
			var kind = parts[0];
			if (kind === "stages") {
				var s = findCheatItem(m.stages, parts.slice(1).join(":"));
				var sel = row.querySelector("select");
				if (s && sel) { reflectStageSelect(sel, s, modId); }
				return true;
			}
			if (kind === "abilities") {
				var a = findCheatItem(m.abilities, parts.slice(1).join(":"));
				var box = row.querySelector('input[type="checkbox"]');
				if (a && box) { box.checked = !!cheatReadSafe(modId, a.varPath); }
				return true;
			}
			if (kind === "values") {
				var it = findCheatItem(m.values, parts[1]);
				if (it && it.type === "list") {
					var opt = parts.slice(2).join(":");
					var lb = row.querySelector('input[type="checkbox"]');
					var arr = Array.isArray(cheatReadSafe(modId, it.varPath)) ? cheatReadSafe(modId, it.varPath) : [];
					if (lb) { lb.checked = arr.indexOf(opt) !== -1; }
				} else if (it) {
					var inp = row.querySelector("input");
					var cur = cheatReadSafe(modId, it.varPath);
					if (inp) {
						if (it.type === "boolean") { inp.checked = !!cur; }
						else if (cur !== undefined && cur !== null) { inp.value = String(cur); }
					}
				}
				return true;
			}
			return true; /* 任务/剧情行无回显态，行存在即视为已刷新 */
		} catch (e) { return false; }
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
	function actPlayer(res, path) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		/* 六巡：快速面板数值操作局部刷新该行（不再全量重建 33 行 + 特质区）；特质类操作无 path → 全量重建 */
		if (path) {
			var pane = root.querySelector('[data-pane="mods"]');
			/* 兜底分支必须带 "quick:" 前缀（与渲染 setAttribute 一致）；无 CSS.escape 时仅转义引号/反斜杠 */
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape("quick:" + path) : String("quick:" + path).replace(/["\\]/g, "\\$&");
			var row = pane ? pane.querySelector('[data-mce-key="' + esc + '"]') : null;
			if (row) {
				var inp = row.querySelector("input.mce-inp");
				var lbl = row.querySelector(".mce-row-lbl");
				var cur = quickReadValue(path);
				if (inp) { inp.value = (typeof cur === "number") ? String(cur) : "0"; }
				if (lbl) {
					var meta = (PANEL_QUICK_PATH_INDEX && PANEL_QUICK_PATH_INDEX[path]) || null;
					lbl.textContent = (meta ? meta.label : path) + "（当前 " + (typeof cur === "number" ? cur : "—") + "）";
				}
				return;
			}
		}
		renderPlayerEdit();
	}
	/* v1.8.12 功能6：能力项数据驱动重构——数据表声明式（path/label/type/min/max/note），渲染与钳制统一走表数据。
	   口径：purity 内部 0-2000（UI 显示 %）；beauty/physique 及意志/意识/淫乱/暴露癖/异种癖按用户要求无硬上限
	   （999999 仅防误输入，非游戏上限；v1.8.19 体能 physique 由 0-100 提为无上限）；技能/性技能/成绩/武器 0-1000（百分比量纲）。 */
	var PANEL_QUICK_GROUPS = [
		{ title: "核心属性", items: [
			{ path: "purity", label: "纯洁", min: 0, max: 2000, note: "面板显示 0-100%，内部 0-2000" },
			{ path: "beauty", label: "容貌", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "physique", label: "体能", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "willpower", label: "意志", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "awareness", label: "意识", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "promiscuity", label: "淫乱", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "exhibitionism", label: "暴露癖", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "deviancy", label: "异种癖", min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "money", label: "资金", min: 0, max: 99999999, note: "单位 £，建议输入整数；上限已放开（防误输入）" }
		] },
		{ title: "基础技能", items: [
			{ path: "skulduggery", label: "诡术", min: 0, max: 1000 },
			{ path: "danceskill", label: "舞蹈", min: 0, max: 1000 },
			{ path: "swimmingskill", label: "游泳", min: 0, max: 1000 },
			{ path: "athletics", label: "运动", min: 0, max: 1000 },
			{ path: "tending", label: "护理", min: 0, max: 1000 },
			{ path: "housekeeping", label: "家务", min: 0, max: 1000 }
		] },
		{ title: "性技能", items: [
			{ path: "seductionskill", label: "魅惑", min: 0, max: 1000 },
			{ path: "oralskill", label: "口部", min: 0, max: 1000 },
			{ path: "chestskill", label: "胸部", min: 0, max: 1000 },
			{ path: "handskill", label: "手部", min: 0, max: 1000 },
			{ path: "bottomskill", label: "臀部", min: 0, max: 1000 },
			{ path: "penileskill", label: "阴茎", min: 0, max: 1000 },
			{ path: "vaginalskill", label: "小穴", min: 0, max: 1000 },
			{ path: "analskill", label: "后庭", min: 0, max: 1000 },
			{ path: "thighskill", label: "大腿", min: 0, max: 1000 },
			{ path: "feetskill", label: "足部", min: 0, max: 1000 }
		] },
		{ title: "学校成绩", items: [
			{ path: "science", label: "科学", min: 0, max: 1000 },
			{ path: "maths", label: "数学", min: 0, max: 1000 },
			{ path: "english", label: "语文", min: 0, max: 1000 },
			{ path: "history", label: "历史", min: 0, max: 1000 }
		] },
		{ title: "武器技能", items: [
			{ path: "prof.spray", label: "防狼喷雾", min: 0, max: 1000 },
			{ path: "prof.baton", label: "短棍", min: 0, max: 1000 },
			{ path: "prof.whip", label: "鞭子", min: 0, max: 1000 },
			{ path: "prof.net", label: "网", min: 0, max: 1000 },
			{ path: "prof.pickaxe", label: "镐", min: 0, max: 1000 }
		] }
	];
	/* v1.8.12 功能13：数据表路径索引（quickWrite 查 min/max 用，懒建） */
	var PANEL_QUICK_PATH_INDEX = null;
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
		/* v1.8.12 功能6：查数据表取该项 min/max，传给 cheatWriteValue 统一钳制（一次性索引，避免每次遍历 33 项） */
		if (!PANEL_QUICK_PATH_INDEX) {
			PANEL_QUICK_PATH_INDEX = {};
			PANEL_QUICK_GROUPS.forEach(function (g) {
				g.items.forEach(function (it) { PANEL_QUICK_PATH_INDEX[it.path] = it; });
			});
		}
		var meta = PANEL_QUICK_PATH_INDEX[path] || null;
		return cheatWriteValue("player-self", "p:" + path, "value_set", path, raw, "number",
			meta && typeof meta.min === "number" ? meta.min : undefined,
			meta && typeof meta.max === "number" ? meta.max : undefined);
	}
	function renderQuickRow(pane, it) {
		var path = it.path, label = it.label;
		var cur = quickReadValue(path);
		var row = el("div", "mce-row");
		/* 六巡：行带 data-mce-key——快速面板数值操作后 actPlayer 局部刷新该行，不再全量重建 33 行 + 特质区 */
		row.setAttribute("data-mce-key", "quick:" + path);
		row.appendChild(el("span", "mce-row-lbl", label + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = (typeof cur === "number") ? String(cur) : "0";
		inp.placeholder = "+N / -N 相对";
		var rangeTxt = (typeof it.min === "number" && typeof it.max === "number") ? "；合理范围 " + it.min + "–" + it.max : "";
		inp.title = "支持相对调整：+100 / -20；直接输入数字为绝对值" + rangeTxt + (it.note ? "（" + it.note + "）" : "");
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () { actPlayer(quickWrite(path, inp.value), path); });
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actPlayer(undoCheatModValue("player-self", "p:" + path), path); });
		row.appendChild(inp); row.appendChild(b); row.appendChild(und);
		pane.appendChild(row);
	}
	function renderQuickPanel(pane) {
		PANEL_QUICK_GROUPS.forEach(function (g) {
			var box = el("div", "mce-grp");
			box.appendChild(el("div", "mce-grp-t", g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）"));
			g.items.forEach(function (it) { renderQuickRow(box, it); });
			pane.appendChild(box);
		});
	}
