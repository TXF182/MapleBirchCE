/* 职责：模组作弊行渲染 —— 分帧构建防长任务 ANR / 组懒展开 / 阶段控件 / 数值筛选 */
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
				if (t.failed) { t.body.appendChild(el("div", MCE_CLS.hint, "有 " + t.failed + " 行加载失败（适配器数据异常），已跳过。")); }
				modRowQueue.shift();
			}
			guard++;
		}
		if (modRowQueue.length) { modRowBatchTimer = setTimeout(modRowStep, 0); }
		else { modRowBatchTimer = null; }
	}
	/* 动态发现：注册制 + 内置适配器（探测命中即合并）+ 被动识别占位；每次调用重扫。 */
	function toggleCheatAbility(modId, key, enabled) {
		var m = findCheatMod(modId), a = m && findCheatItem(m.abilities, key);
		if (!a) { return { ok: false, message: "能力不存在或该模组未注册" }; }
		if (!a.varPath) { return { ok: false, message: "「" + a.name + "」未声明能力变量（varPath），无法切换" }; }
		/* v1.9.11 未定版：numeric 能力（模组 is 1 / gte 1 严格比较禁 boolean）——勾选写 1、取消写 0，
		   布尔能力保持原语义；min/max 按声明钳制（缺省 0/1） */
		var abilityVal = a.numeric ? (enabled ? 1 : 0) : !!enabled;
		var abilityType = a.numeric ? "number" : "boolean";
		var abilityMin = a.numeric ? (typeof a.min === "number" ? a.min : 0) : undefined;
		var abilityMax = a.numeric ? (typeof a.max === "number" ? a.max : 1) : undefined;
		return cheatWriteValue(modId, "ability_set:" + key, "ability_set", a.varPath, abilityVal, abilityType, abilityMin, abilityMax, a.sync);
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
		/* v2.0.4 治理：string 型也曾被 fallback 成 number 通道（Number("abc")=NaN → 静默拒绝写），
		   现按声明类型分流；当前声明无 string 项，此分支由声明矩阵的假适配器负控覆盖 */
		var wt = it.type === "boolean" ? "boolean" : (it.type === "string" ? "string" : "number");
		return cheatWriteValue(modId, "value_set:" + key, "value_set", it.varPath, raw, wt, it.min, it.max, it.sync);
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
		pane.appendChild(el("div", MCE_CLS.hint, "本页面用于操控其他第三方模组新增的拓展内容，不修改游戏原版数据。下方为已识别到支持作弊控制的模组，点击模组名称进入对应控制子页面。"));
		/* v1.7.0：玩家自己编辑入口（玩家所有属性 + 模组加入属性，全量，数值与阶段可改） */
		var pcard = el("div", "mce-card mce-sel");
		var ptop = el("div", "mce-card-top");
		ptop.appendChild(el("span", "mce-card-name", "▶ 玩家自己 · 属性与特质"));
		ptop.appendChild(el("span", "mce-badge mce-on", "面板数值/特质可改"));
		pcard.appendChild(ptop);
		pcard.appendChild(el("div", MCE_CLS.hint, "游戏属性面板数值快捷编辑 + 全部特质管理（含其他模组注入的特质，自动发现；获取时条件不满足自动改为满足）。"));
		pcard.addEventListener("click", function () { renderPlayerEdit(); });
		pane.appendChild(pcard);
		var mods = getCheatMods();
		if (!mods.length) {
			pane.appendChild(el("div", MCE_CLS.err, "⚠ 暂未识别到可控制的第三方模组拓展内容，请加载对应模组后重试。"));
			return;
		}
		var list = el("div", "mce-cards");
		mods.forEach(function (m) {
			var row = el("div", "mce-card" + (m.modId === curCheatModId ? " mce-sel" : ""));
			var top = el("div", "mce-card-top");
			top.appendChild(el("span", "mce-card-name", "▶ " + m.modName));
			top.appendChild(el("span", "mce-badge " + (m.declared ? "mce-on" : "mce-off"), m.declared ? "可操控" : "未声明"));
			row.appendChild(top);
			/* 已删去「未声明模组」守卫（原 if (!m.declared) 提示 / else 绑点击）：m.declared 在当前
			   输入域恒为 true —— 注册表项经 normalizeCheatMod 强制 declared:true（04c-modcheat-util.js:4），
			   唯一写 declared:false 的 CHEAT_PASSIVE_PROBES 在 03d-global-modzh.js:122 建空数组后全仓无 push，
			   故该守卫无可达输入。若将来被动探针被填充或新增 declared:false 来源，必须在此恢复
			   「未声明项不绑点击、只展示提示」的守卫（否则未声明模组会被误开子页）。 */
			row.addEventListener("click", (function (mod) {
				return function () { curCheatModId = mod.modId; renderModCheatDetail(mod.modId); };
			})(m));
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
	/* v1.9.13 模组数值搜索态：按名称/键名/写入路径过滤「4. 自定义数值修改」组；
	   输入防抖 250ms 重建子页（mceSchedule 桶 "search"），返回模组列表时清空 */
	var modValueFilter = "";
	/* v1.9.13 搜索态设置（外部/测试通道；UI 输入框直接改闭包变量） */
	function setModValueFilter(v) { modValueFilter = String(v == null ? "" : v); }
	function renderModCheatDetail(modId) {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		/** @type {any} 适配器 entry 形态有两类（含 actionPanel 与不含），统一按 any 访问可选字段 */
		var m = findCheatMod(modId);
		var st = pane.scrollTop; /* 五巡：重建后保持滚动位置（翻到长列表底部操作不再跳回顶部） */
		/* v1.9.5-自检：重建时清残留分片任务——切 tab/重进子页后旧渲染的分片不再往已脱离 DOM 的 body 补行（省帧），
		   新渲染的 pending 行由全新任务构建，与旧队列无关 */
		if (modRowBatchTimer) { clearTimeout(modRowBatchTimer); modRowBatchTimer = null; }
		modRowQueue.length = 0;
		pane.textContent = "";
		if (!m) {
			pane.appendChild(el("div", MCE_CLS.err, "模组未识别（可能已卸载），请返回列表。"));
			return;
		}
		var back = el("button", "", "← 返回模组列表");
		back.type = "button";
		back.addEventListener("click", function () { curCheatModId = ""; modValueFilter = ""; renderModCheats(); });
		pane.appendChild(back);
		pane.appendChild(el("div", MCE_CLS.hint, "【" + m.modName + "】作弊控制"));
		pane.appendChild(el("div", MCE_CLS.hint, "所有操作仅作用于 " + m.modName + " 的新增内容，不会改动游戏本体与其他模组数据。"));
		/* 折叠工具行：全部展开 / 全部收起（懒渲染下组体行按需补建） */
		var toolRow = el("div", MCE_CLS.row);
		toolRow.appendChild(el("span", MCE_CLS.rowLbl, "折叠工具："));
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
		/* v1.9.13 数值搜索框：仅该模组声明了数值项时显示；输入防抖重建（数值组过滤见 renderCheatValues） */
		if (m.values.length) {
			var fRow = el("div", MCE_CLS.row);
			fRow.appendChild(el("span", MCE_CLS.rowLbl, "数值搜索："));
			var fInp = el("input", "mce-search-inp");
			fInp.type = "text";
			fInp.value = modValueFilter;
			fInp.placeholder = "按名称 / 键名 / 写入路径过滤自定义数值";
			fInp.addEventListener("input", function () {
				modValueFilter = fInp.value.replace(/^\s+|\s+$/g, "");
				mceSchedule(function () { renderModCheatDetail(modId); }, 250, "search");
			});
			var fClear = el("button", "", "清除"); fClear.type = "button";
			fClear.addEventListener("click", function () {
				modValueFilter = "";
				renderModCheatDetail(modId);
			});
			fRow.appendChild(fInp); fRow.appendChild(fClear);
			pane.appendChild(fRow);
		}
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
					grp.body.appendChild(el("div", MCE_CLS.hint, "有 " + failed + " 行加载失败（适配器数据异常），已跳过。"));
				}
				return;
			}
			/* 分片：先同步建首批 BATCH 行（点击展开立刻可见内容），剩余入队逐帧排空。
			   注：本路径入口已保证 pend.length > MOD_ROW_BATCH_LIMIT(60) > MOD_ROW_BATCH(40)，
			   故不存在「首批已排空剩余」的分支（已删去恒假的 <=40 判定）；首批失败与
			   后续分片失败统一由 modRowStep 收尾按 t.failed 提示，提示语义不变。 */
			var first = Math.min(MOD_ROW_BATCH, pend.length);
			for (var fi = 0; fi < first; fi++) {
				try { appendRowNodes(grp.body, pend[fi]()); } catch (e) { failed++; }
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
		if (m.actions.length || typeof m.actionPanel === "function") { any = true; renderCheatActions(m, grpFor, buildModGrpRows); }
		if (!any) {
			pane.appendChild(el("div", MCE_CLS.hint, "该模组已识别但未声明可操控项（任务/阶段/剧情/数值均为空）。"));
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
	function actCheat(res, modId, key) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? MCE_CLS.ok : MCE_CLS.err);
		/* 五巡：操作后局部刷新目标行（不再全量重建整个模组页——高频操作下 DOM churn 是卡顿/闪退累积源之一） */
		/* 已删两层恒真判定（原 `if (modId && key)` 包住整块、其后再 `if (modId)` 包 renderModCheatDetail）：
		   13 个调用点（05a2-modcheat-rows-build.js）全部传 m.modId 与 "tasks:"+t.key 这类字面拼接（至少含前缀故
		   恒非空）；m.modId 由 getCheatMods 三源过滤空 id 保证（05a2:8 注册项 / 05a2:22 被动探针 / 适配器 entry
		   经 04c normalizeCheatMod 透传）⇒ modId 与 key 均为真值。
		   化简后行为等价：pane 取不到或局部刷新落空即落到 renderModCheatDetail（与原 else 分支同一行、同一结果）。
		   若将来出现「无 modId」或「无 key」的调用形态，必须在此恢复这两层判定。 */
		var pane = root.querySelector('[data-pane="mods"]');
		if (pane && refreshModRow(pane, modId, key)) {
			/* v1.9.14 效果2：写入成功 → 刷新回显后的目标行金底闪烁（反馈落在可见新值上） */
			if (res && res.ok) {
				var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape(key) : String(key).replace(/["\\]/g, "\\$&");
				var newRow = pane.querySelector('[data-mce-key="' + esc + '"]');
				if (newRow) { mbCEFlash(newRow); }
			}
			return;
		}
		renderModCheatDetail(modId);
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
