/* 职责：回退中心的「留痕键 → 中文名」解析层（v2.0.4）。
   回退中心原先直接渲染原始键（cheat:player-self:p:prof.spray / place:town_projects.green /
   maint:temple_quarters / yanling:purge_cross …），玩家看不懂。本段只做展示层翻译，不改键本身、
   不改回退逻辑（回退仍按原始 key 精确分发）。解析顺序：专用词表 → 注册表（适配器 entry / 地点分组 /
   世界入口分组 / 汉化键表 ZH_KEYS）→ 兜底（原键去命名空间 + 中文动作前缀）。
   词表与数据源同源：适配器 entry 的 name 字段、07d 的 PLACE_STAGE_GROUPS.item.name、
   PLACE_GROUPS.name、03d 的 ZH_KEYS（zhKey）。新增写入点若没中文名，兜底会退回原键，不会崩。 */

	/* 写入动作（键前缀）→ 中文动作名；空串表示「路径本身就是项名」，不额外加前缀 */
	var MB_CE_UNDO_OPS = {
		p: "",
		trait: "特质",
		ability_set: "能力",
		scene_skip: "剧情跳过",
		scene_force: "剧情完成",
		scene_reset: "剧情进度",
		task_skip: "任务跳过",
		task_complete: "任务完成",
		stage_set: "阶段",
		value_set: "数值",
		fert_child_aff: "孩子好感"
	};
	/* 玩家自身（modId=player-self）常见写入路径的中文名：与面板行名同源，zhKey 兜不到的在此补齐 */
	var MB_CE_UNDO_PLAYER = {
		"speech_attitude": "说话态度",
		"submissive": "顺从度",
		"spraymax": "防狼喷雾容量上限",
		"spray": "防狼喷雾余量",
		"baton": "短棍",
		"whip": "鞭子",
		"net": "网",
		"pickaxe": "镐",
		"lurkers_held": "手持潜伏者",
		"lurker:lurkers_held": "手持潜伏者",
		"lurker:hookah.lurkers": "水烟馆冰箱潜伏者",
		"lurker:hookah.juice": "水烟壶汁液",
		"lurker:lurkers_stored": "农场蒸馏笼潜伏者",
		"lurker:farm_stage": "农场阶段",
		"lurker:stat_lurkers_captured": "累计捕获潜伏者"
	};
	/* 庄园维护写入的变量名 → 中文（03b mcMaintain* 的写入面） */
	var MB_CE_UNDO_MAINT = {
		temple_quarters: "神殿宿舍清洁",
		temple_garden: "神殿花园打理",
		edengarden: "伊甸菜地",
		edenshrooms: "伊甸菇桶",
		edenspring: "伊甸泉水",
		soap: "肥皂补给",
		salve: "药膏补给",
		"bird.materials.wood": "鹰塔木材补给",
		"eden.children": "伊甸孩子",
		farm: "农场投喂"
	};
	/* 言灵改写 op → 中文（07i-yanling-core 的 mbCEYanlingTrace 三处） */
	var MB_CE_UNDO_YANLING = {
		purge_cross: "异装与校规记录清除",
		purge_trait: "特质清除",
		purge_fame: "名声清除"
	};
	/* 键拆分：<ns>:<rest> */
	function mbCEUndoSplitKey(key) {
		var s = String(key == null ? "" : key), i = s.indexOf(":");
		if (i < 0) { return { ns: "", rest: s }; }
		return { ns: s.slice(0, i), rest: s.slice(i + 1) };
	}
	function mbCEUndoZh(table, k) {
		if (!table || !k) { return ""; }
		return (typeof table[k] === "string") ? table[k] : "";
	}
	/* 适配器 entry 里按 itemKey / varPath / path 反查中文行名（tasks/stages/values/abilities/scenes … 全量扫） */
	function mbCEUndoAdapterItemName(entry, itemKey, op, recPath) {
		if (!entry || typeof entry !== "object") { return ""; }
		var fields = Object.keys(entry), i, j, arr, it;
		var wantOp = op ? (op + ":" + itemKey) : itemKey;
		for (i = 0; i < fields.length; i++) {
			arr = entry[fields[i]];
			if (!Array.isArray(arr)) { continue; }
			for (j = 0; j < arr.length; j++) {
				it = arr[j];
				if (!it || typeof it !== "object" || typeof it.name !== "string") { continue; }
				if (it.key === wantOp || it.key === itemKey) { return it.name; }
				if (recPath && (it.varPath === recPath || it.path === recPath || it.skipVar === recPath ||
					it.completeVar === recPath || it.progressVar === recPath)) { return it.name; }
			}
		}
		return "";
	}
	/* cheat:<modId>:<op|路径> */
	function mbCEUndoCheatName(rest, rec) {
		var i = rest.indexOf(":"), modId = (i < 0 ? rest : rest.slice(0, i)), itemKey = (i < 0 ? "" : rest.slice(i + 1));
		var op = "", m = /^([a-z][a-z_0-9]*):(.+)$/.exec(itemKey);
		if (m && MB_CE_UNDO_OPS[m[1]] !== undefined) { op = m[1]; itemKey = m[2]; }
		var recPath = (rec && typeof rec.path === "string") ? rec.path : "";
		var name = mbCEUndoAdapterItemName((typeof CHEAT_ADAPTERS === "object" && CHEAT_ADAPTERS) ? (CHEAT_ADAPTERS[modId] || {}).entry : null, itemKey, op, recPath);
		if (!name && modId === "player-self") { name = mbCEUndoZh(MB_CE_UNDO_PLAYER, itemKey) || mbCEUndoZh(MB_CE_UNDO_PLAYER, (op ? op + ":" : "") + itemKey); }
		if (!name) {
			try { if (typeof zhKey === "function") { name = zhKey(recPath || itemKey); } } catch (e) { name = ""; }
		}
		if (!name && recPath && recPath.indexOf(".") > 0) { name = recPath; }
		if (!name) { name = itemKey; }
		var opName = MB_CE_UNDO_OPS[op];
		return opName ? (opName + " · " + name) : name;
	}
	/* place:<path> → 「分组 · 项名」（07d PLACE_STAGE_GROUPS 同源） */
	function mbCEUndoPlaceName(rest) {
		try {
			if (typeof PLACE_STAGE_GROUPS === "object" && Array.isArray(PLACE_STAGE_GROUPS)) {
				for (var gi = 0; gi < PLACE_STAGE_GROUPS.length; gi++) {
					var g = PLACE_STAGE_GROUPS[gi];
					if (!g || !Array.isArray(g.items)) { continue; }
					for (var ii = 0; ii < g.items.length; ii++) {
						var it = g.items[ii];
						if (it && it.path === rest) { return (g.name ? String(g.name).replace(/（.*?）/g, "") + " · " : "") + it.name; }
					}
				}
			}
		} catch (e) { /* 数据表未加载时走兜底 */ }
		return "";
	}
	/* world:<gid>:<path> → 「地点分组名 · 路径中文」 */
	function mbCEUndoWorldName(rest, rec) {
		var gid = rest, path = (rec && typeof rec.path === "string") ? rec.path : "";
		var cut = rest.indexOf(":");
		if (cut >= 0) { gid = rest.slice(0, cut); path = rest.slice(cut + 1); }
		var gname = "";
		try {
			if (typeof PLACE_GROUPS === "object" && Array.isArray(PLACE_GROUPS)) {
				for (var i = 0; i < PLACE_GROUPS.length; i++) {
					if (PLACE_GROUPS[i] && PLACE_GROUPS[i].id === gid) { gname = PLACE_GROUPS[i].name || ""; }
				}
			}
			if (!gname && typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS && WORLD_UNLOCKS[gid] && WORLD_UNLOCKS[gid].name) {
				gname = WORLD_UNLOCKS[gid].name;
			}
		} catch (e) { gname = ""; }
		if (!path) { return gname || gid; }
		var pn = mbCEUndoZh(MB_CE_UNDO_MAINT, path) || path;
		return gname ? (gname + " · " + pn) : pn;
	}
	/* 统一入口：返回展示用中文名（解析不出时原样退回键体，绝不返回空串） */
	function mbCEUndoItemName(key, rec) {
		var sp = mbCEUndoSplitKey(key), ns = sp.ns, rest = sp.rest, name = "";
		try {
			if (ns === "cheat") { name = mbCEUndoCheatName(rest, rec); }
			else if (ns === "place") { name = mbCEUndoPlaceName(rest); }
			else if (ns === "maint") { name = mbCEUndoZh(MB_CE_UNDO_MAINT, rest); }
			else if (ns === "yanling") { name = mbCEUndoZh(MB_CE_UNDO_YANLING, rest); }
			else if (ns === "world") { name = mbCEUndoWorldName(rest, rec); }
			/* P4（v2.0.7）：lock:<path> 用锁定页同一套中文名（快速面板标签 → zhKey → 原 path 三级回落） */
			else if (ns === "lock") {
				name = "";
				try { if (typeof mbCELockLabel === "function") { name = mbCELockLabel(rest); } } catch (eL) { name = ""; }
				if (!name || name === rest) {
					try { if (typeof zhKey === "function" && zhKey(rest) !== rest) { name = zhKey(rest); } } catch (eL2) { name = ""; }
				}
				if (!name) { name = rest; }
			}
			else if (ns === "romance" || ns === "vanilla" || ns === "native") {
				var tail = rest.replace(/^native:/, "");
				try { if (typeof displayName === "function") { name = displayName(tail); } } catch (e) { name = ""; }
				if (!name || name === tail) {
					try { if (typeof zhKey === "function") { name = zhKey(tail) === tail ? "" : zhKey(tail); } } catch (e2) { name = ""; }
				}
				if (!name) { name = tail; }
			}
		} catch (e) { name = ""; }
		name = String(name || "").trim();
		if (!name) { name = rest || String(key); }
		return name;
	}
