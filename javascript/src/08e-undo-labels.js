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
	/* 庄园维护写入的变量名 → 中文（03b mcMaintain* 的写入面）
	   2026-11-26 补齐：农场家畜敬重（HTML 305720-305723 Steeds/Pigs/Cattle/Dogs' Respect，-30..30）、
	   雷米侵蚀度（HTML 305735 Remy's Encroachment）、艾弗里庄园十间房与离开天数（03b L226-229）——
	   这些原先都落裸点号路径（回退中心显示 farm.beasts.horses / avery_mansion.pool）。 */
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
		farm: "农场投喂",
		"farm.beasts.horses": "农场马群敬重",
		"farm.beasts.pigs": "农场猪群敬重",
		"farm.beasts.cattle": "农场牛群敬重",
		"farm.beasts.dogs": "农场狗群敬重",
		"farm.aggro": "雷米侵蚀度",
		"avery_mansion.pool": "艾弗里庄园泳池脏度",
		"avery_mansion.kitchen": "艾弗里庄园厨房脏度",
		"avery_mansion.lounge": "艾弗里庄园起居室脏度",
		"avery_mansion.display": "艾弗里庄园陈列室脏度",
		"avery_mansion.bedroom": "艾弗里庄园卧室脏度",
		"avery_mansion.bathroom": "艾弗里庄园浴室脏度",
		"avery_mansion.dining": "艾弗里庄园餐厅脏度",
		"avery_mansion.garden": "艾弗里庄园花园脏度",
		"avery_mansion.study": "艾弗里庄园书房脏度",
		"avery_mansion.garage": "艾弗里庄园车库脏度",
		"avery_mansion.days_absent": "艾弗里庄园离开天数"
	};
	/* 言灵改写 op → 中文（07i-yanling-core 的 mbCEYanlingTrace 全集，v2.2.8 实机：曾只映射 3 条，
	   其余条目在回退中心显示裸键 avery_office / toggle_noCross，玩家看不懂） */
	var MB_CE_UNDO_YANLING = {
		purge_cross: "异装与校规记录清除",
		purge_trait: "特质清除",
		purge_fame: "名声清除",
		max_fame: "名声上限提升",
		uncap_pregnancy_fame: "怀孕名声上限解除",
		dry_clothes: "一键烘干衣物",
		repair_clothes: "一键修补衣物",
		semen: "清除体液",
		mind: "精神状态恢复",
		sadomasochism: "施虐受虐值",
		seeds: "清除体内种子",
		robin_money: "罗宾欠款",
		avery_date: "艾弗里约会进度",
		avery_office: "艾弗里办公室剧情",
		head_password: "项圈密码",
		collar_lock: "项圈锁定",
		collar_break: "项圈破坏",
		feats_locked: "解锁成就",
		farm: "农场地块整备",
		milk: "泌乳清空",
		weather: "天气改写",
		gwylan_banish: "格威岚驱逐",
		gwylan_recall: "格威岚召回",
		gwylan_talk: "格威岚对话",
		gwylan_desire: "格威岚欲望",
		gwylan_request_done: "格威岚请求完成",
		gwylan_petbed: "格威岚宠物床",
		gwylan_sea: "格威岚海边",
		gwylan_sex: "格威岚亲密",
		gwylan_stage: "格威岚阶段",
		kylar_state: "凯拉状态",
		whitney_state: "惠特尼状态",
		prison_protection: "监狱保护",
		cheat_on: "言灵总开关",
		hopeless_endings: "绝望结局跳过",
		clear_curiosity: "好奇心清除",
		hypno_cd: "催眠冷却",
		hypno_daily: "催眠当日次数",
		arcade_count: "街机次数",
		leaf_suit: "枝叶变装",
		leaf_revert: "枝叶还原",
		toggle_noCross: "异装判定开关"
	};
	/* 言灵条目解析：词表 → toggle_* 动态开关 → 中文兜底（绝不返回裸英文键） */
	function mbCEUndoYanlingName(rest) {
		if (MB_CE_UNDO_YANLING[rest]) { return MB_CE_UNDO_YANLING[rest]; }
		if (rest.indexOf("toggle_") === 0) { return "言灵开关 · " + rest.slice(7); }
		return "言灵改写 · " + rest;
	}
	/* 经济 / 学业 / 农田 / 消耗品 / 纹身留痕 id → 中文（07m-vanilla-econ-data.js 的 vcore-econ 留痕） */
	var MB_CE_UNDO_ECON = {
		"rent-days": "租期倒计时",
		"rent-debt": "欠租金额",
		"school": "今日出勤与旷课计数",
		"condoms": "避孕套数量",
		"tattoo-all": "全部纹身清除"
	};
	function mbCEUndoEconName(rest) {
		if (MB_CE_UNDO_ECON[rest]) { return MB_CE_UNDO_ECON[rest]; }		if (rest.indexOf("farm-") === 0) {
			var loc = rest.slice(5);
			try { return "地块催熟（" + mbCEVanillaEconPlotZh(loc) + "）"; } catch (eFm) { return "地块催熟"; }
		}
		if (rest.indexOf("tattoo-") === 0) {
			var part = rest.slice(7);
			try { return "纹身（" + mbCEVanillaEconBodyZh(part) + "）"; } catch (eTt) { return "纹身"; }
		}
		return "";
	}
	/* vcore 专用：只在 ns/type 命中时改名，其余原样放过（拆出来是为了不给 mbCEUndoItemName 加分支/复杂度） */
	function mbCEUndoEconFixName(name, ns, rest, rec) {
		if (ns !== "vcore" || !rec || rec.type !== "vcore-econ") { return name; }
		/* v2.2.8：未命中 econ 词表时保留上层已解析的名字（原先返回空串会把 vcore 分支的结果清掉） */
		return mbCEUndoEconName(rest) || name;
	}
	/* 原版档案类留痕 id → 中文（07l-vanilla-ext / 07q 艾弗里庄园 / 07v 保持受伤 的 type 默认 "vcore"）
	   know-npc / gwylan-wait / sam-away 是 2026-11-26 补齐：分别来自 07t 认识角色、07r 格威岚消失期、07s Sam 公园驱逐，
	   三条实参原先都落「原版档案 · 键名」。 */
	var MB_CE_UNDO_VCORE = {
		crime: "犯罪记录全清",
		antique: "古董收藏与成就",
		title: "头衔（雷米疤面）",
		"avery-keep": "艾弗里庄园保留",
		"avery-injury": "艾弗里保持受伤",
		"rent-money": "每周租金金额",
		"rent-lock": "每周租金锁定",
		"rent-days": "租期倒计时",
		"rent-debt": "欠租金额",
		"school": "今日出勤与旷课计数",
		"condoms": "避孕套数量",
		"tattoo-all": "全部纹身清除",
		"know-npc": "标记角色为认识",
		"gwylan-wait": "格威岚消失期等待",
		"sam-away": "Sam 公园驱逐"
	};
	/* vcore 前缀型条目：food-<食材键>（07p 库存直写）/ antique-<特殊件键>（07l-special 单件收集） */
	function mbCEUndoVcorePrefixName(rest) {
		if (rest.indexOf("food-") === 0) {
			var fk = rest.slice(5);
			try { return "食物 · " + (typeof mbCEFoodZh === "function" ? mbCEFoodZh(fk) : fk); } catch (eF) { return "食物库存 · " + fk; }
		}
		if (rest.indexOf("antique-") === 0) {
			var ak = rest.slice(8);
			var al = (typeof MCE_VANILLA_SPECIAL_ANTIQUES === "object" && MCE_VANILLA_SPECIAL_ANTIQUES) ? MCE_VANILLA_SPECIAL_ANTIQUES[ak] : "";
			return "古董 · " + (al || ak);
		}
		return "";
	}
	/* vcore 条目解析：档案词表 → 前缀条目 → 经济/农田/纹身词表 → 中文兜底（绝不返回裸英文键） */
	function mbCEUndoVcoreName(rest, rec) {
		if (MB_CE_UNDO_VCORE[rest]) { return MB_CE_UNDO_VCORE[rest]; }
		var pref = mbCEUndoVcorePrefixName(rest);
		if (pref) { return pref; }
		var econ = mbCEUndoEconName(rest);
		if (econ) { return econ; }
		if (MB_CE_UNDO_BIRD && MB_CE_UNDO_BIRD[rest]) { return MB_CE_UNDO_BIRD[rest]; }
		if (MB_CE_UNDO_LEIGHTON && MB_CE_UNDO_LEIGHTON[rest]) { return MB_CE_UNDO_LEIGHTON[rest]; }
		return "原版档案 · " + rest;
	}
	/* 鹰塔留痕 id → 中文（07n-vanilla-bird.js 的 vcore-bird 留痕；同样只在命中时改名） */
	var MB_CE_UNDO_BIRD = {
		"bird-clean": "鹰塔清洁度",
		"bird-materials": "鹰塔八种材料",
		"bird-upgrades": "鹰塔十二项设施"
	};
	function mbCEUndoBirdFixName(name, ns, rest, rec) {
		if (ns !== "vcore" || !rec || rec.type !== "vcore-bird") { return name; }
		return MB_CE_UNDO_BIRD[rest] || name;
	}
	/* 礼顿把柄留痕 id → 中文（07o-vanilla-leighton.js 的 vcore-leighton 留痕） */
	var MB_CE_UNDO_LEIGHTON = {
		"leighton-clear": "礼顿把柄",
		"leighton-purge": "礼顿把柄与来源分支",
		"leighton-get": "礼顿把柄（获取）"
	};
	function mbCEUndoLeightonFixName(name, ns, rest, rec) {
		if (ns !== "vcore" || !rec || rec.type !== "vcore-leighton") { return name; }
		return MB_CE_UNDO_LEIGHTON[rest] || name;
	}
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
	/* 全局批次 / 孩子留痕的 op 名（都不是适配器 entry，靠这张小表兜住；
	   2026-11-26 实机：回退中心原先显示 unlockClothes / eden.children.12.location 这类英文）
	   孩子留痕 key 形如 cheat:fertility-expansion:fert_child_loc_<id>（04a-15:213 / 04a-15b:102/127） */
	var MB_CE_UNDO_CHEAT_OP = {
		unlockClothes: "解锁全部服装",
		unlockRecipes: "解锁全部食谱",
		fert_child_loc: "孩子居住地",
		fert_child_adult: "孩子强制成年",
		fert_child_skills: "孩子养育属性",
		fert_child_innate: "孩子先天属性",
		fert_child_aff: "孩子好感"
	};
	function mbCEUndoCheatOpName(itemKey) {
		if (MB_CE_UNDO_CHEAT_OP[itemKey]) { return MB_CE_UNDO_CHEAT_OP[itemKey]; }
		var m = /^(fert_child_[a-z]+)_([0-9]+)$/.exec(itemKey);
		if (m && MB_CE_UNDO_CHEAT_OP[m[1]]) { return MB_CE_UNDO_CHEAT_OP[m[1]] + " · #" + m[2]; }
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
		if (!name) { name = mbCEUndoCheatOpName(itemKey); }
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
			else if (ns === "maint") { name = mbCEUndoZh(MB_CE_UNDO_MAINT, rest) || (rest ? "庄园维护 · " + rest : "庄园维护"); }
			else if (ns === "vcore") { name = mbCEUndoVcoreName(rest, rec); }
			else if (ns === "yanling") { name = mbCEUndoYanlingName(rest); }
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
		name = mbCEUndoEconFixName(name, ns, rest, rec);
		name = mbCEUndoBirdFixName(name, ns, rest, rec);
		name = mbCEUndoLeightonFixName(name, ns, rest, rec);
		name = String(name || "").trim();
		if (!name) { name = rest || String(key); }
		return name;
	}
