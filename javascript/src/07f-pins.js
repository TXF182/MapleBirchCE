	/* ============ 锚定触发（v1.9.23）：把某个剧情锚定到其发生地点，走到该地点交互时
	     弹确认条（含地点/时间/前置说明），确认后复用原版 $replayScene 重放通道播放
	     （startPassage/passages 内段落正常播放，离开场景自动回原位）；播放完标
	     「已完成 ✓」并移出队列，可再自由锚定。旧「固定触发（任意推进即触发）」已移除。
	     存储于 V.mbCE_queue（存档持久）+ V.mbCE_completedScenes（已完成记录）；
	     重放期间原版自动禁存 + 冻结属性，零副作用。 ============ */
	/* 锚定触发队列（v1.9.23）：V.mbCE_queue 数组按锚定顺序存储。队首未 used 项若带
	     地点元数据（anchor.location）→ 走到该地点时（:passageend 判定 V.location）弹
	     确认条，确认后经原版 $replayScene 重放；「暂不触发」保留待下次（60s 冷却防打扰）。
	     无地点元数据项（旧档迁移：v1.1 旧单固定 mbCE_pinned 自动并入队列视为已触发过、
	     v1.2-1.9.22 旧队列项）保持旧段落跳转语义直至触发完，不破坏存档。
	     重放结束（Scene Viewer End / 链回 / exitpassage 返回 / Farm Work / unfreeze 钩子）
	     时把该场景记入 V.mbCE_completedScenes（「已完成 ✓」）并移出队列。
	     场景联动解锁（unlockPlaceForScene / applyWorldUnlockForScene）保留。 */
	/* ============ 场景地点元数据（v1.9.23 第一批，全部实证） ============
	   来源分级：
	     [reg]  = 本体 $scenes 注册表 manualVariableChanges 内 <<set $location to '...'>>（extract_scene_locs.js 实证）
	     [reg-w]= 本体注册表 manualVariableChanges 内 <<location '...'>> widget（同上）
	     [pas]  = 本体剧情段落实证（入口段落开头 <<set $location>> / <<location>> / 段落文本）
	     [同区] = 同一条线相邻段落实证（如罗宾地下系列）
	     [名]   = 场景名/入口段落名语义（值域与相邻段落佐证）
	   timeNote 仅展示、不参与触发判定；无 timeNote 时确认条省略时间说明。 */
	console.log("[MCE-BOOT] 07f-pins loaded v-probe2");
var SCENE_LOCATIONS = {
		/* 罗宾 */
		"RobinIntro1": { loc: "home", src: "pas: Orphanage 段落实证 $location=home" },
		"RobinIntro2": { loc: "shopping_centre", src: "名: startPassage=Shopping Centre（值域实证）" },
		"RobinIntro3": { loc: "school", src: "pas: Canteen 段落实证 $location=school" },
		"RobinCrossdressing1": { loc: "home", src: "pas: Robin Caught CD SV Start $location=home" },
		"RobinCrossdressing2": { loc: "home", time: "16:00", src: "pas: Robin CD Door SV Start $location=home + Time.setTime(16)" },
		"RobinCrossdressing3": { loc: "home", src: "pas: Robin CD Socialise SV Start $location=home" },
		"RobinCrossdressing6": { loc: "school", time: "12:00", src: "pas: Canteen Lunch Robin CD 1 $location=school + setTime(12,0)" },
		"RobinCrossdressing6I": { loc: "school", time: "12:00", src: "pas: School Infirmary Robin CD Intro $location=school + setTime(12,0)" },
		"RobinDocks": { loc: "docks", src: "pas: Docks_Robin 段落实证 $location=docks" },
		"RobinLandfill": { loc: "landfill", src: "pas: Robin Mist Intro 段落实证 $location=landfill" },
		"RobinPilloryIntro": { loc: "home", src: "pas: Robin Pillory Intro 段落实证 $location=home" },
		"RobinPillory": { loc: "town", src: "pas: Robin Pillory Watch 段落实证 $location=town" },
		"RobinUndergroundDice": { loc: "underground", src: "同区: Underground Robin 系列（Stage Intro 段落实证 $location=underground）" },
		"RobinUndergroundMachine": { loc: "underground", src: "同区: 同上" },
		"RobinUndergroundKiss": { loc: "underground", src: "同区: 同上" },
		"RobinUndergroundStage": { loc: "underground", src: "pas: Underground Robin Stage Intro $location=underground" },
		"RobinUndergroundHunt": { loc: "forest", src: "pas: Underground Robin Hunt Intro <<location 'forest'>>" },
		"RobinUndergroundEscape": { loc: "forest", src: "名: undergroundEscapeForestRobin widget 名实证" },
		"RentFirstRobinFight": { loc: "orphanage", src: "pas: Rent First Robin SV 段落文本 'main hall of the orphanage'" },
		/* 惠特尼 */
		"WhitneySchoolBully1": { loc: "school", src: "名: 校园欺凌剧情（schoolbully widget；school 值域实证）" },
		"WhitneySchoolBully2": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBully3": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBully4": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullyChastity": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullyPanty": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullySkirt": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullySwimwear": { loc: "school", src: "名: 同上" },
		"WhitneyOrphanageLoft": { loc: "orphanage", src: "名: 孤儿院阁楼场景（Bird Loft 1 段落实证 $location=orphanage）" },
		"WhitneyOrphanageVisit": { loc: "orphanage", src: "名: SV Street Bully Orphanage Go（孤儿院）" },
		"WhitneyShoppingCentreClothes": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		"WhitneyShoppingCentreCosmetics": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		"WhitneyShoppingCentreHairDressers": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		/* 艾弗里 */
		"AveryHelicopter": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		"AveryParkIntroduction": { loc: "park", src: "pas: Park Lichen 段落实证 $location=park" },
		/* 凯拉尔 */
		"KylarAbduction": { loc: "kylarmanor", src: "pas: Kylar Abduction Intro <<location 'kylarmanor'>>" },
		"KylarBasement": { loc: "school", src: "pas: Kylar Basement 段落实证 $location=school" },
		"KylarManorSecret": { loc: "kylarmanor", src: "reg-w: manualVariableChanges <<location 'kylarmanor'>>" },
		"KylarManorSleep": { loc: "kylarmanor", src: "reg-w: manualVariableChanges <<location 'kylarmanor'>>" },
		"KylarMonstranceAsk": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"KylarMonstranceAccost": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		/* 神殿（悉尼） */
		"TempleConfessorIntro": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleVigil": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleSydneyCorrupt": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleSydneyPunish": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleSydneyPureRitual": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		/* 艾利克斯农场 */
		"TheFarm": { loc: "farm", src: "名: 被卖至农场（farm 值域实证）" },
		"AlexFarmWorkStage03": { loc: "farm", src: "名: 农场工作剧情（sceneViewSwitch farmStage3；farm 值域实证）" },
		"AlexFarmWorkStage04": { loc: "farm", src: "名: 同上（farmStage4）" },
		"AlexFarmWorkStage05": { loc: "farm", src: "名: 同上（farmStage5）" },
		"AlexFarmWorkStage06": { loc: "farm", src: "名: 同上（farmStage6）" },
		"AlexFarmWorkStage07": { loc: "farm", src: "名: 同上（farmStage7）" },
		"AlexFarmWorkStage08": { loc: "farm", src: "名: 同上（farmStage8）" },
		"AlexFarmWorkStage09": { loc: "farm", src: "名: 同上（farmStage9）" },
		"AlexFarmWorkStage10": { loc: "farm", src: "名: 同上（farmStage10）" },
		"AlexFarmWorkStage11": { loc: "farm", src: "名: 同上（farmStage11）" },
		"AlexFarmWorkStage12": { loc: "farm", src: "名: 同上（farmStage12）" },
		/* 其他注册表实证 */
		"AdultShopIntro": { loc: "dilapidated_shop", src: "reg: manualVariableChanges $location" },
		"AdultShopOpening": { loc: "adult_shop", src: "reg: manualVariableChanges $location" },
		"EdenIntro": { loc: "forest", src: "reg: manualVariableChanges $location" },
		"BlackWolfIntro": { loc: "forest", src: "reg: manualVariableChanges $location" },
		"FreeTheBlackDog": { loc: "town", src: "reg: manualVariableChanges $location" },
		"IslandCastle": { loc: "island", src: "reg: manualVariableChanges $location" },
		"MoorFlower": { loc: "moor", src: "reg: manualVariableChanges $location" },
		"HookahPlot1": { loc: "tentworld", src: "reg: manualVariableChanges $location" },
		"HookahPlot2": { loc: "town", src: "reg: manualVariableChanges $location" },
		"Schism": { loc: "lake_ruin", src: "reg: manualVariableChanges $location" },
		"MickeyOrphanageHacker": { loc: "home", src: "reg: manualVariableChanges $location" },
		"MickeyPubFameIntro": { loc: "pub", src: "reg: manualVariableChanges $location" },
		"PrisonSpirePrecipice": { loc: "prison", src: "reg: manualVariableChanges $location" },
		"PrisonYardLocket": { loc: "prison", src: "reg: manualVariableChanges $location" },
		"PrisonScarredInmate": { loc: "prison", src: "reg: manualVariableChanges $location" }
	};
	/* 跨线前置映射（v1.9.23 第一批）：剧情有关联性时的显式前置。
	   线内前置（数字后缀聚线）由 pendingPreconds 自动推导、零维护；
	   此处只放跨线剧情顺序明确的保守映射。前置缺失不禁止锚定，仅提示。 */
	var SCENE_PRECONDITIONS = {
		"RobinCrossdressing1": ["RobinIntro1"],
		"RobinCrossdressing2": ["RobinIntro1"],
		"RobinCrossdressing3": ["RobinIntro1"],
		"RobinCrossdressing6": ["RobinIntro1"],
		"RobinCrossdressing6I": ["RobinIntro1"],
		"RobinDocks": ["RobinIntro1"],
		"RobinLandfill": ["RobinIntro1"],
		"RentFirstRobinFight": ["RobinIntro1"],
		"RobinUndergroundDice": ["RobinDocks"],
		"RobinUndergroundMachine": ["RobinDocks"],
		"RobinUndergroundKiss": ["RobinDocks"],
		"RobinUndergroundStage": ["RobinDocks"],
		"RobinUndergroundHunt": ["RobinDocks"],
		"RobinUndergroundEscape": ["RobinDocks"],
		"WhitneyShoppingCentreClothes": ["WhitneySchoolBully1"],
		"WhitneyShoppingCentreCosmetics": ["WhitneySchoolBully1"],
		"WhitneyShoppingCentreHairDressers": ["WhitneySchoolBully1"],
		"WhitneyOrphanageLoft": ["WhitneySchoolBully1"],
		"WhitneyOrphanageVisit": ["WhitneySchoolBully1"],
		"AveryHelicopter": ["AveryParkIntroduction"],
		"KylarManorSecret": ["KylarAbduction"],
		"KylarManorSleep": ["KylarAbduction"],
		"KylarMonstranceAsk": ["KylarAbduction"],
		"KylarMonstranceAccost": ["KylarAbduction"]
	};
	/* 地点值域 → 中文显示名（锚定提示/确认条用；未知值原样显示） */
	var LOCATION_LABELS = {
		"home": "孤儿院（家）", "orphanage": "孤儿院（阁楼/公共区）", "school": "学校", "school_rear_courtyard": "学校后院",
		"town": "城镇（街道）", "docks": "码头", "landfill": "垃圾场", "park": "公园", "forest": "森林", "forest_shop": "森林商店",
		"temple": "神殿", "old_temple": "旧神殿", "kylarmanor": "凯拉尔庄园", "avery_mansion": "艾弗里庄园", "avery_skyscraper": "艾弗里大厦",
		"farm": "艾利克斯农场", "alex_cottage": "艾利克斯小屋", "alex_farm": "农场", "farm_manors": "农庄",
		"underground": "地下（罗宾地下）", "brothel": "妓院", "island": "岛", "lake": "湖", "lake_ruin": "湖畔遗迹",
		"moor": "荒野", "tentworld": "帐篷世界", "pub": "酒吧", "prison": "监狱", "shopping_centre": "购物中心",
		"adult_shop": "成人商店", "dilapidated_shop": "破旧商店", "beach": "海滩", "sewers": "下水道", "police_station": "警察局",
		"hospital": "医院", "hotel": "旅馆", "cafe": "咖啡馆", "office": "办公室", "industrial": "工业区", "alley": "小巷",
		"arcade": "游戏厅", "asylum": "疯人院", "bog": "沼泽", "cabin": "小屋", "castle": "城堡", "chalets": "小屋群",
		"compound": "大院", "dance_studio": "舞蹈室", "drain": "排水沟", "estate": "庄园", "factory": "工厂", "flats": "公寓",
		"market": "市场", "meadow": "草地", "mer_pier": "美人鱼码头", "museum": "博物馆", "night_monster_lair": "夜魔巢穴",
		"oak": "橡树", "pirate_ship": "海盗船", "pool": "泳池", "promenade": "海滨大道", "riding_school": "马术学校",
		"sea": "海", "spa": "水疗馆", "strip_club": "脱衣舞俱乐部", "studio": "工作室", "tower": "塔", "wolf_cave": "狼穴",
		"banner": "旗地", "blitz": "闪电区", "old_temple": "旧神殿"
	};
	function locLabel(loc) { return LOCATION_LABELS[loc] || loc || "（未标注）"; }
	/* 场景 key → 锚定元数据（表内命中；旧队列项无元数据 → null，保持旧段落跳转语义） */
	function sceneAnchorMeta(key) {
		try {
			var s = SCENE_LOCATIONS[key];
			if (!s && /^AlexFarmWorkStage\d+$/.test(key || "")) {
				/* 兼容一位/两位数字位宽：真实注册表 key 为两位（03..12），部分来源为一位 */
				var nn = /^AlexFarmWorkStage(\d+)$/.exec(key)[1];
				s = SCENE_LOCATIONS["AlexFarmWorkStage" + (nn.length === 1 ? "0" + nn : nn)];
			}
			if (s) { return { location: s.loc, timeNote: s.time || "" }; }
		} catch (e) {}
		return null;
	}
	/* 前置是否已完成：scenePassages 达成（绿标）或锚定播放完成（mbCE_completedScenes）任一即算 */
	function precondDone(key) {
		try {
			var defs = getScenesDefs();
			var def = defs.defs[key];
			if (def && sceneStatus(def).state === "pass") { return true; }
		} catch (e) {}
		try {
			var V = getV();
			if (V && V.mbCE_completedScenes && V.mbCE_completedScenes[key]) { return true; }
		} catch (e) {}
		return false;
	}
	/* 锚定某场景的未完成前置列表（显示名）：跨线显式映射 + 线内数字后缀自动推导 */
	function pendingPreconds(key) {
		var names = [];
		try {
			var defs = getScenesDefs();
			var nm = function (k2) { var d = defs.defs[k2]; return (d && d.name) || k2; };
			var pre = SCENE_PRECONDITIONS[key];
			if (Array.isArray(pre)) {
				for (var i = 0; i < pre.length; i++) {
					var k3 = pre[i];
					if (!precondDone(k3)) { names.push(nm(k3)); }
				}
			}
			/* 线内前置：同前缀、数字更小的未完成阶段（数字后缀聚线自动推导，零维护） */
			var m = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/.exec(key);
			if (m) {
				var prefix = m[1], num = parseInt(m[2], 10), suffix = m[3];
				Object.keys(defs.defs).forEach(function (k4) {
					var m4 = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/.exec(k4);
					if (m4 && m4[1] === prefix && m4[3] === suffix && parseInt(m4[2], 10) < num && !precondDone(k4)) { names.push(nm(k4)); }
				});
			}
		} catch (e) {}
		var seen = {}, out = [];
		for (var j = 0; j < names.length; j++) {
			if (!seen[names[j]]) { seen[names[j]] = true; out.push(names[j]); }
		}
		return out;
	}
	/* ============ 锚定确认条与手动触发（v1.9.23） ============ */
	var mbCE_anchorPrompt = null;      /* 内存态：当前展示中的确认条 { key, t } */
	var mbCE_anchorCooldown = {};      /* key -> Date.now()：暂不触发后 60s 冷却，防同地点反复弹（v1.9.23-实机修复五轮 60s→1h；用户拍板 1h→60s） */
	var mbCE_anchorPromptEl = null;
	function anchorPromptActive(key) {
		if (mbCE_anchorPrompt && mbCE_anchorPrompt.key === key) { return true; }
		var cd = mbCE_anchorCooldown[key];
		if (cd && (Date.now() - cd) < 60000) { return true; } /* 60s 冷却（用户拍板 1h→60s） */
		return false;
	}
	/* 确认「立即触发」：与原固定触发的重放启动通道一致（manualVariableChanges → freeze → replayScene → 跳转入口） */
	function startAnchoredReplay(P) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档不可用，无法触发" }; }
			if (!P || !P.startPassage) { return { ok: false, message: "缺少入口段落，无法触发" }; }
			/* v1.9.23-实机修复：SV 注册场景（startPassage 以 "SV " 开头的查看器预览页，如 "SV Adult Shop Opening"）
			   锚定触发不再播放预览页（角色卡+Start 的「剧情播放器」样式）→ 直接进入剧情第一段。
			   判据：预览页段落源码含 <<link [[Start|剧情入口>>（label 恰为 Start）；
			   SV 链形态（如 SV Temple Confess Purge → Start → SV Temple Confess Purge 2）递归跳过；
			   剧情本体类（如 SV Pub Fame Intro 含场景初始化、无 Start 链接）→ 保持原入口。 */
			var entry = P.startPassage;
			if (String(P.startPassage).indexOf("SV ") === 0) {
				var hop = P.startPassage;
				for (var depth = 0; depth < 10; depth++) {
					var svSrc = "";
					try {
						if (typeof Story !== "undefined" && Story) {
							if (typeof Story.get === "function") {
								var svTpl = Story.get(hop);
								if (svTpl && (svTpl.source || svTpl.text)) { svSrc = svTpl.source || svTpl.text; }
							}
							if (!svSrc && typeof Story.lookupWith === "function") {
								var svHits = Story.lookupWith(function (p) { return p && p.name === hop; });
								if (svHits && svHits.length && (svHits[0].source || svHits[0].text)) {
									svSrc = svHits[0].source || svHits[0].text;
								}
							}
						}
					} catch (e) {}
					var svM = /\[\[Start\|([^\]|]+)/.exec(svSrc);
					if (!svM || !svM[1]) { entry = hop; break; }   /* 无 Start 链接：当前段即入口（保留其初始化） */
					var svNext = String(svM[1]).trim();
					if (svNext.indexOf("SV ") === 0) { hop = svNext; continue; }  /* SV 预览链 → 递归下一跳 */
					entry = svNext; break;  /* 直达剧情入口 */
				}
			}
			/* v1.9.23-自检：防重入——重放进行中（确认条双击/重复调用）再次触发会覆盖 exitpassage
			   为播放器段落导致返回错位甚至被困播放器 → 拒绝并提示等待 */
			if (V.replayScene) { return { ok: false, message: "已有重放在进行中（" + ((V.replayScene.name) || "") + "），请先等播放完成" }; }
			if (isFarmDependentScene(P) && !farmStateReady()) {
				return { ok: false, message: "「" + P.name + "」依赖农场系统状态（$farm 未初始化）：请先推进到艾利克斯农场线后再触发" };
			}
			ensureAveryMansion();
			ensureFarmState();
			var ep = getEnginePlayFn();
			if (!ep) { return { ok: false, message: "游戏引擎不可用，无法触发（请刷新页面重试）" }; }
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			/* v1.9.23-实机修复六轮：P.used=true 必须在本重放 freezePlayerStats 之前写入——
			   原版 freezePlayerStats widget 深拷贝整个 State.variables 冻结快照（mbCE_queue 不在其
			   skipKeysOnFreeze 排除表，used:false 被冻结），播完原版 unfreezePlayerStats 用 strict-replace
			   恢复快照会把 used 还原为 false（队列项复活 → 确认条循环弹；实机 F12 铁证：live=true / frozen=false）。
			   先置 used=true 使冻结快照含 true，恢复后保持 true，配合 mbCEOnPassageEnd 残留清理闭环。 */
			P.used = true;
			/* v1.9.23-运行时探针（实机定位 frozen:false 根因用，定位后移除） */
			try { console.log("[MCE-PROBE] pre-freeze qUsed=" + (V.mbCE_queue && V.mbCE_queue[0] ? V.mbCE_queue[0].used : "no-q") + " fzExists=" + (!!V.frozenValues) + " fzQUsed=" + (V.frozenValues && V.frozenValues.mbCE_queue && V.frozenValues.mbCE_queue[0] ? V.frozenValues.mbCE_queue[0].used : "no-fzq")); } catch (e) {}
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			try { console.log("[MCE-PROBE] post-freeze liveQUsed=" + (V.mbCE_queue && V.mbCE_queue[0] ? V.mbCE_queue[0].used : "no-q") + " fzQUsed=" + (V.frozenValues && V.frozenValues.mbCE_queue && V.frozenValues.mbCE_queue[0] ? V.frozenValues.mbCE_queue[0].used : "no-fzq") + " sf=" + V.statFreeze); } catch (e) {}
			V.replayScene = {
				name: P.name,
				startPassage: entry,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName()
			};
			V.mbCE_replayOnce = true;  /* 本重放由锚定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			V.mbCE_replayPending = (entry === "Scene Viewer passages");
			unlockPlaceForScene(P);  /* 联动解锁：触发即解锁所在场景组 */
			applyWorldUnlockForScene(P);
			hideAnchorPrompt();
			try { ep.play.call(ep.e, entry, true); } catch (e) {
				/* 跳转失败：回滚 used（保留队列项）+ 清重放状态，避免卡死 */
				try { P.used = false; } catch (e2) {}
				mbCEClearReplay(true);
				return { ok: false, message: "跳转失败：" + (e && e.message ? e.message : e) };
			}
			return { ok: true, message: "已开始触发「" + P.name + "」" };
		} catch (e) { return { ok: false, message: "触发失败：" + (e && e.message ? e.message : e) }; }
	}
	/* 挂载确认条（页面顶部，非阻断式） */
	function showAnchorPrompt(P, meta) {
		try {
			mbCE_anchorPrompt = { key: P.key, t: Date.now() };
			if (mbCE_anchorPromptEl && mbCE_anchorPromptEl.parentNode) { mbCE_anchorPromptEl.parentNode.removeChild(mbCE_anchorPromptEl); }
			var box = document.createElement("div");
			box.className = "mce-anchor-prompt";
			box.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#f5f0e0;color:#3a2e1c;border-bottom:2px solid #b89b5e;padding:8px 12px;font-size:14px;line-height:1.6;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;flex-wrap:wrap;align-items:center;gap:8px;";
			var txt = document.createElement("span");
			var timeTxt = meta.timeNote ? "｜时间 " + meta.timeNote : "";
			var pre = pendingPreconds(P.key);
			/* v1.9.23-自查优化：无前置要求时不再显示「前置均已达成」——该文案与面板完成状态
			   「要求：未达成（条件未满足）」同屏自相矛盾（触发前置 ≠ 完成条件，13_17 截图实证）；
			   改为「触发前置：无」，明确这是触发条件而非完成状态。 */
			var preTxt = pre.length ? "｜触发前置未完成：" + pre.join("、") : "｜触发前置：无";
			txt.textContent = "检测到锚定剧情「" + P.name + "」：触发地点「" + locLabel(meta.location) + "」" + timeTxt + preTxt + "，是否立即触发？";
			box.appendChild(txt);
			var go = document.createElement("button");
			go.type = "button";
			go.textContent = "立即触发★";
			go.style.cssText = "margin-left:auto;background:#7a9b4f;color:#fff;border:0;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:13px;";
			go.addEventListener("click", function () {
				var r = startAnchoredReplay(P);
				if (!r.ok) { setStatus(r.message, "mce-err"); }
				hideAnchorPrompt();
			});
			var skip = document.createElement("button");
			skip.type = "button";
			skip.textContent = "暂不触发";
			skip.style.cssText = "background:#888;color:#fff;border:0;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:13px;";
			skip.addEventListener("click", function () {
				mbCE_anchorCooldown[P.key] = Date.now(); /* 60s 冷却：同地点不再反复弹，保留队列待下次（用户拍板 1h→60s） */
				hideAnchorPrompt();
			});
			box.appendChild(go);
			box.appendChild(skip);
			var host = document.getElementById("story") || document.body;
			host.insertBefore(box, host.firstChild);
			mbCE_anchorPromptEl = box;
		} catch (e) {}
	}
	function hideAnchorPrompt() {
		try {
			mbCE_anchorPrompt = null;
			if (mbCE_anchorPromptEl) {
				if (mbCE_anchorPromptEl.parentNode) { mbCE_anchorPromptEl.parentNode.removeChild(mbCE_anchorPromptEl); }
				mbCE_anchorPromptEl = null;
			}
		} catch (e) {}
	}
	/* :passageend 钩子：锚定触发判定——段落渲染完成后 V.location 已更新为当前段落地点，
	   队首未用未完成项带地点元数据且与当前地点匹配 → 弹确认条（确认触发 / 暂不待下次）。
	   重放中（V.replayScene）不弹；旧档无元数据项不走此通道（passageoverride 旧语义）。 */
	function mbCEOnPassageEnd() {
		try {
			var V = getV();
			if (!V) { return; }
			if (V.replayScene) { return; }
			/* v1.9.23-实机修复六轮：段落后清理残留 used 项——原版 unfreezePlayerStats strict-replace 恢复
			   冻结快照会把已移除/已标记的队列项复活（used 被还原 → 确认条循环弹）。此处幂等清理：
			   已触发（used）项写「已完成 ✓」并移出队列，复活项在下一段落被清，确认条不再循环弹。 */
			cleanupUsedPins();
			var q = getPinQueue();
			if (!q) { return; }
			/* v1.9.23-实机修复五轮：残留确认条清理——弹条后未点按钮直接离开触发地点（如酒吧→麋鹿街），
			   fixed 条会跨段残留（玩家反馈「取消锚定之后立即触发并没有消失」的画面证据：麋鹿街挂着酒吧条）。
			   当前展示条对应地点已非当前段落 → 自动收起。 */
			if (mbCE_anchorPrompt && mbCE_anchorPrompt.key) {
				var pk = mbCE_anchorPrompt.key;
				var curMeta = null;
				for (var k = 0; k < q.length; k++) {
					if (q[k] && q[k].key === pk) { curMeta = q[k].anchor || sceneAnchorMeta(q[k].key); break; }
				}
				if (curMeta && curMeta.location && (typeof V.location !== "string" || V.location !== curMeta.location)) {
					hideAnchorPrompt();
				}
			}
			/* 遍历队列找「当前地点匹配」的锚定项。旧实现只取队首、location 不匹配即 return，
			   队首「米奇酒吧知名度初见」（酒吧）在玩家到其他地点时拦截了后续所有锚定
			   （玩家反馈「暂不触发之后再去选其他锚定，其他锚定的立即触发也不会出现」根因）。 */
			var P = null;
			for (var i = 0; i < q.length; i++) {
				var it = q[i];
				if (it && it.active !== false && !it.used && it.startPassage) {
					var m = it.anchor || sceneAnchorMeta(it.key);
					if (m && m.location) {
						if (typeof V.location === "string" && V.location === m.location) {
							/* v1.9.23-自查优化：原实现 break 后在下方 anchorPromptActive(P.key) return——
							   同地点多锚定时，A 暂不触发（1h 冷却）或正展示中 → B（同地点）被拦截永不弹
							   （「暂不触发后其他锚定不弹」的同地点残余路径）。改为冷却/展示中的项 continue
							   继续找下一个同地点匹配项，全部不可用才不弹。 */
							if (anchorPromptActive(it.key)) { continue; }
							P = it; break;
						}
					}
					/* 无元数据旧档项：保留旧 passageoverride 语义，不在此通道处理 */
				}
			}
			if (!P) { return; }
			var meta = P.anchor || sceneAnchorMeta(P.key);
			if (!meta || !meta.location) { return; } /* 旧档无元数据项 → 保持旧段落跳转语义 */
			showAnchorPrompt(P, meta);
		} catch (e) {}
	}
	function hookPassageEnd() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageend.mbceAnchor").on(":passageend.mbceAnchor", function () {
				try { mbCEOnPassageEnd(); } catch (e) {}
			});
		} catch (e) {}
	}
	function getPinQueue() {
		try {
			var V = getV();
			if (!V) { return null; }
			var q = V.mbCE_queue;
			if (!Array.isArray(q)) { q = []; V.mbCE_queue = q; }
			/* 旧版兼容迁移（幂等）：v1.1 单固定 mbCE_pinned → 并入队列并标记 used（已触发过，不再重复触发） */
			var old = V.mbCE_pinned;
			if (old && typeof old === "object" && old.active && old.startPassage) {
				var dup = false;
				for (var i = 0; i < q.length; i++) {
					if (q[i] && q[i].key === old.key) { dup = true; break; }
				}
				if (!dup) {
					q.push({ key: old.key, name: old.name, startPassage: old.startPassage, passages: Array.isArray(old.passages) ? old.passages.slice() : [], manualVariableChanges: old.manualVariableChanges || "", used: true });
				}
				try { delete V.mbCE_pinned; } catch (e) { V.mbCE_pinned = undefined; }
			}
			return q;
		} catch (e) { return null; }
	}
	/* 队列中未触发的固定项（UI 横幅/条目用） */
	function getPinnedScene() {
		try {
			var q = getPinQueue();
			if (!q) { return []; }
			return q.filter(function (p) { return p && p.active !== false && !p.used && p.startPassage; });
		} catch (e) { return []; }
	}
	/* 固定项在队列中的序号（0 起，未固定返回 -1） */
	function pinQueueIndex(key) {
		try {
			var q = getPinQueue();
			if (!q) { return -1; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === key && q[i].active !== false && !q[i].used) { return i; }
			}
		} catch (e) {}
		return -1;
	}
	/* 农场依赖剧情检测：startPassage=Scene Viewer passages 且 manualVariableChanges 执行 farm_work_update
	   （其内部 V.farm.clearing -= 1，$farm 未初始化时直接崩场景查看器 → "setting 'clearing'"） */
	function isFarmDependentScene(P) {
		if (!P || !P.startPassage || P.startPassage !== "Scene Viewer passages") { return false; }
		var mvc = P.manualVariableChanges || "";
		return /farm_work_update/i.test(mvc);
	}
	function farmStateReady() {
		try {
			var V = getV();
			if (!V) { return false; }
			return typeof V.farm === "object" && V.farm !== null;
		} catch (e) { return false; }
	}
	/* 艾弗里庄园状态兜底：$avery_mansion 由本体 avery_mansion_init 初始化，但该初始化被延迟到"进入艾弗里线"才触发；
	   新档/未开线时直达庄园段落或固定触发艾弗里剧情会因 $avery_mansion 缺失而崩
	   （reading 'schedule'/'jobs'/'party_state'/'folder'/'study_unlocked'/'landry' 等，均为 V.avery_mansion 子键；
	   reading 'stage' 来自 $avery_tower）。
	   此处按本体 init widget 的纯字面量结构建空壳（跳过服装/antiques 子 widget，避免副作用与依赖），
	   仅当对象缺失时写入，绝不覆盖已有进度。 */
	/* 农场状态兜底（v1.3.1）：本体社交页在 $farm_stage gte 2 时无条件读 $farm.beasts（马/猪/牛/狗敬重值）与 $farm.aggro，
	   若存档里 farm_stage 已推进但 $farm 整体缺失（早期版本触发农场剧情置高 farm_stage 但未走本体农场线初始化），
	   孤儿院/多瑙河街等含 <<social>> 的段落直接崩（reading 'beasts'/'aggro'）。
	   v1.3.4：睡眠/跨午夜结算（本体 dailyFarmEvents 与农场库存显示）读 $farm.stock.truffles/eggs/milk/cream，
	   该结构仅由本体 <<farm_stock_init>> 在"共享农场"剧情节点初始化——一键置高 farm_stage 后同样缺失 → 睡觉崩（reading 'truffles'），
	   故空壳与残缺分支同步补齐 stock 四字段。
	   按本体农场线初始化结构补空壳：仅当 farm_stage >= 1 且 $farm 缺失/结构残缺时补，绝不覆盖已有进度。 */
	function ensureFarmState() {
		try {
			var V = getV();
			if (!V) { return; }
			var fs = Number(V.farm_stage);
			if (!(fs >= 1)) { return; } /* 农场线未推进 → 本体社交页有 $farm_stage gte 2 条件，不读 $farm */
			if (typeof V.farm !== "object" || V.farm === null) {
				V.farm = {
					beasts: { horses: 0, pigs: 0, cattle: 0, dogs: 0 },
					wage: 15,
					clearing: 100,
					milking: { caught: false, alexNightEvent: false, catchChance: 0, dayMilking: false },
					build_finished: [],
					stock: { truffles: 0, eggs: 0, milk: 0, cream: 0 }
				};
				return;
			}
			/* 已存在但结构残缺 → 只补缺失字段，不覆盖已有值 */
			if (typeof V.farm.beasts !== "object" || V.farm.beasts === null) { V.farm.beasts = {}; }
			var b = V.farm.beasts;
			if (typeof b.horses !== "number") { b.horses = 0; }
			if (typeof b.pigs !== "number") { b.pigs = 0; }
			if (typeof b.cattle !== "number") { b.cattle = 0; }
			if (typeof b.dogs !== "number") { b.dogs = 0; }
			if (typeof V.farm.wage !== "number") { V.farm.wage = 15; }
			if (typeof V.farm.clearing !== "number") { V.farm.clearing = 100; }
			if (typeof V.farm.milking !== "object" || V.farm.milking === null) { V.farm.milking = { caught: false, alexNightEvent: false, catchChance: 0, dayMilking: false }; }
			if (typeof V.farm.milking.catchChance !== "number" || V.farm.milking.catchChance !== V.farm.milking.catchChance) { V.farm.milking.catchChance = 0; }
			if (V.farm.build_finished === undefined || V.farm.build_finished === 0 || V.farm.build_finished === null) { V.farm.build_finished = []; }
			/* v1.3.4：farm_stock 结算防崩——本体只由 <<farm_stock_init>> 建 stock 四字段，缺失时读/累加即崩 */
			if (typeof V.farm.stock !== "object" || V.farm.stock === null) {
				V.farm.stock = { truffles: 0, eggs: 0, milk: 0, cream: 0 };
			}
			var st = V.farm.stock;
			if (typeof st.truffles !== "number") { st.truffles = 0; }
			if (typeof st.eggs !== "number") { st.eggs = 0; }
			if (typeof st.milk !== "number") { st.milk = 0; }
			if (typeof st.cream !== "number") { st.cream = 0; }
		} catch (e) {}
	}
	function ensureAveryMansion() {
		try {
			var V = getV();
			if (!V) { return; }
			if (typeof V.avery_mansion !== "object" || V.avery_mansion === null) {
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
			if (typeof V.avery_tower !== "object" || V.avery_tower === null) {
				V.avery_tower = { progress: 0, effects: [], stage: 0, intro: 0 };
			}
			/* daily.avery 结构兜底（v1.3.3 → v1.5.1 强化）：本体 0.5.5.5 后 $daily.avery 由艾弗里线入口建为 {}，
			   talk/ask 子对象仅在 avery_mansion_init / 0.5.7.1 版本迁移时创建；直达、重放、固定触发或新档未开
			   艾弗里线时进入 Mansion 系段落（Mansion Talk 调 avery_daily_talk 读 $daily.avery.talk.chat、
			   正文读 .ignore/.limit）会因 $daily.avery.talk 缺失而崩（TypeError reading 'chat'/'ignore'）
			   → 逐层补齐 + 逐字段补齐，绝不覆盖已有值 */
			if (typeof V.daily !== "object" || V.daily === null) {
				/* 防御：$daily 缺失（理论上游戏启动即有）时建最小壳，避免后续读崩 */
				V.daily = {};
			}
			if (typeof V.daily.avery !== "object" || V.daily.avery === null) {
				V.daily.avery = {
					talk: { ignore: false, limit: false, flirt: false, seduce: false, annoyed: 0, chat: 0, chat_limit: 3 },
					ask: { science: false, maths: false, play: false },
					housekeeping_events: {}
				};
			} else {
				var dav = V.daily.avery;
				if (typeof dav.talk !== "object" || dav.talk === null) {
					dav.talk = { ignore: false, limit: false, flirt: false, seduce: false, annoyed: 0, chat: 0, chat_limit: 3 };
				} else {
					/* 对象已存在但个别字段缺失（旧档/异常路径）：逐字段补默认，绝不覆盖已有值 */
					if (typeof dav.talk.ignore !== "boolean") { dav.talk.ignore = false; }
					if (typeof dav.talk.limit !== "boolean") { dav.talk.limit = false; }
					if (typeof dav.talk.flirt !== "boolean") { dav.talk.flirt = false; }
					if (typeof dav.talk.seduce !== "boolean") { dav.talk.seduce = false; }
					if (typeof dav.talk.annoyed !== "number") { dav.talk.annoyed = 0; }
					if (typeof dav.talk.chat !== "number") { dav.talk.chat = 0; }
					if (typeof dav.talk.chat_limit !== "number") {
						var wd = 0;
						try {
							var t = (typeof Time !== "undefined" && Time && typeof Time.weekDay === "number") ? Time.weekDay : 0;
							wd = t;
						} catch (e2) {}
						dav.talk.chat_limit = (wd === 1 || wd === 7) ? 6 : 3;
					}
				}
				if (typeof dav.ask !== "object" || dav.ask === null) {
					dav.ask = { science: false, maths: false, play: false };
				} else {
					if (typeof dav.ask.science !== "boolean") { dav.ask.science = false; }
					if (typeof dav.ask.maths !== "boolean") { dav.ask.maths = false; }
					if (typeof dav.ask.play !== "boolean") { dav.ask.play = false; }
				}
				if (typeof dav.housekeeping_events !== "object" || dav.housekeeping_events === null) {
					dav.housekeeping_events = {};
				}
			}
		} catch (e) {}
	}
	function pinScene(it) {
		try {
			var def = it && it.def;
			if (!def) { return { ok: false, message: "无场景定义，无法锚定" }; }
			var start = def.startPassage || (Array.isArray(def.passages) && def.passages[0]) || "";
			if (!start) { return { ok: false, message: "该剧情缺少入口段落（startPassage 为空），无法锚定" }; }
			/* v1.9.23：锚定必须有地点元数据（走到该地点交互时触发）；无元数据 → 禁止锚定（旧固定触发已移除） */
			var meta = sceneAnchorMeta(it.key);
			if (!meta || !meta.location) { return { ok: false, message: "「" + (def.name || it.key) + "」未标注触发地点（第一批元数据未覆盖该场景），暂不可锚定" }; }
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法锚定" }; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === it.key && q[i].active !== false && !q[i].used) {
					return { ok: false, message: "该剧情已在锚定队列中（第 " + (i + 1) + " 位，走到触发地点时弹确认条）" };
				}
			}
			/* 防崩：农场依赖剧情需 $farm 已初始化（本体 farm_work_update 内 V.farm.clearing -= 1，未初始化直接崩） */
			if (isFarmDependentScene({ startPassage: start, manualVariableChanges: def.manualVariableChanges || "" }) && !farmStateReady()) {
				return { ok: false, message: "「" + (def.name || it.key) + "」依赖农场系统状态（$farm 未初始化）：直接播放会触发本体 farm_work_update 崩溃。请先推进游戏到艾利克斯农场线后再锚定" };
			}
			q.push({
				key: it.key,
				name: def.name || it.key,
				startPassage: start,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || "",
				used: false,
				anchor: { location: meta.location, timeNote: meta.timeNote || "" }
			});
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			/* 锚定提示：地点/时间 + 未完成前置（已完成的不提示；前置缺失不禁止锚定） */
			var pre = pendingPreconds(it.key);
			var msg = "已锚定「" + (def.name || it.key) + "」（队列第 " + pending + " 位）：触发地点「" + locLabel(meta.location) + "」";
			if (meta.timeNote) { msg += "｜时间 " + meta.timeNote; }
			msg += pre.length ? "｜前置未完成：" + pre.join("、") : "｜前置均已达成";
			msg += "。走到该地点交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
			return { ok: true, message: msg };
		} catch (e) {
			return { ok: false, message: "锚定失败：" + (e && e.message ? e.message : e) };
		}
	}
	/* 锚定整条剧情线（v1.9.23）：把线内已标注触发地点的全部阶段按顺序加入锚定队列，
	   走到各阶段发生地点交互时依次触发，触发完自动完成；无地点元数据的阶段跳过并提示 */
	function pinSceneLine(line) {
		try {
			if (!line || !Array.isArray(line.items) || !line.items.length) { return { ok: false, message: "无阶段可锚定" }; }
			var added = 0, noMeta = 0, dup = 0, farm = 0, other = 0;
			for (var i = 0; i < line.items.length; i++) {
				var it = line.items[i];
				if (!it || !it.def) { continue; }
				var r = pinScene(it);
				if (r.ok) { added++; continue; }
				if (r.message.indexOf("未标注触发地点") >= 0) { noMeta++; }
				else if (r.message.indexOf("已在锚定队列") >= 0) { dup++; }
				else if (r.message.indexOf("依赖农场系统状态") >= 0) { farm++; }
				else { other++; }
			}
			var nm = (line.items[0].def && line.items[0].def.name) || line.prefix || "";
			if (added > 0) {
				var skipParts = [];
				if (noMeta) { skipParts.push(noMeta + " 个未标注触发地点"); }
				if (dup) { skipParts.push(dup + " 个已在队列"); }
				if (farm) { skipParts.push(farm + " 个依赖农场线未开启"); }
				if (other) { skipParts.push(other + " 个缺少入口段落"); }
				return { ok: true, message: "已锚定整线「" + nm + "」系列（" + added + " 个阶段入队：走到各阶段发生地点交互时弹确认条，触发完自动完成）" + (skipParts.length ? "；跳过 " + skipParts.join("、") : "") };
			}
			var reason = noMeta ? "：这些阶段均未标注触发地点（第一批元数据未覆盖），暂不可锚定" : (dup ? "：已在锚定队列中" : (farm ? "：依赖农场线未开启" : ""));
			return { ok: false, message: "没有可锚定的阶段" + reason };
		} catch (e) { return { ok: false, message: "锚定失败：" + (e && e.message ? e.message : e) }; }
	}
	/* 回退：取消指定剧情（key 省略=清空队列）的固定；若正在重放固定场景，立即解冻并返回原位 */
	function unpinScene(key) {
		var V = getV();
		var back = "";
		var changed = false;
		try {
			/* v1.9.23-实机修复五轮：取消锚定（指定 key 或清空）时，若该 key 正展示确认条 → 一并收起
			   （玩家反馈「取消锚定之后立即触发并没有消失」） */
			if (mbCE_anchorPrompt && (key === undefined || key === null || key === "" || mbCE_anchorPrompt.key === key)) {
				hideAnchorPrompt();
			}
			var q = getPinQueue();
			if (q && q.length) {
				if (key === undefined || key === null || key === "") {
					q.length = 0; changed = true;
				} else {
					for (var i = q.length - 1; i >= 0; i--) {
						if (q[i] && q[i].key === key) { q.splice(i, 1); changed = true; }
					}
				}
			}
			if (V && V.replayScene) {
				changed = true;
				/* v1.8.19 防困播放器重构（用户实测：手动取消后仍被困场景播放器）+ v1.9.4 根治：
				   根因一：back = exitpassage || currentPassageName() 的兜底会让"玩家正处于播放器段落
				   时取消"变成原地跳转（跳去当前播放器段落），且随后删 replayScene → 播放器 default 分支
				   的 Back 链接无源 → 退出按钮消失 → 被困。
				   根因二：先调 unfreezePlayerStats（wikifier）会经 mbCEUnfreezeHook 提前删掉 replayScene，
				   跳转目标若恰为播放器段落同样导致 Back 无源。
				   v1.9.4：合并 inPlayer 分支——重放中取消固定，一律 Engine.play(back) 强制跳回原位再清理，
				   不再区分"是否原版 Scene Viewer 播放器段落"。覆盖用户实测的模组恋爱播放器场景
				   （播放器停在第 N 张图、手动取消后仍被困）：back 有效即强制脱离任何播放器/中间段落。
				   play(back) 触发 :passageoverride（dest=back → 489 行 Back 返回原位分支）自然清理
				   used 队列项；随后手动清 replayScene/标记兜底（幂等）。 */
				back = (V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				/* 先清 sceneViewSwitch 为无效值 → Scene Viewer passages 的 switch 走 default（顺序不可反） */
				V.sceneViewSwitch = "MB_CE_END";
				if (back) {
					var ep = getEnginePlayFn();
					if (ep) {
						/* v1.9.5-自检：跳转可用才清理——若 Engine 不可用（极端），保留 replayScene/标记，
						   播放器 Back 链接仍有源，避免重蹈「删 replayScene → Back 无源 → 被困」覆辙 */
						try { ep.play.call(ep.e, back, true); } catch (e) {}
						mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					}
				}
				/* back 为空：保留 replayScene/标记
				   （播放器 default 的 Back 链接依赖它），不主动跳转——玩家经 Back 退出
				   （489 行路径清理）或播放器自身退出调用 unfreeze → mbCEUnfreezeHook 兜底清理。 */
			}
		} catch (e) {}
		return changed;
	}
	/* 剧情入口段落/剧情名 → 匹配的场景组 id（联动解锁用）；
	   兼容 Maplebirch 场景查看器入口前缀（SV xxx / Scene Viewer xxx） */
	function placeIdForPassage(startPassage, sceneName) {
		try {
			var cands = [];
			if (startPassage) {
				cands.push(startPassage);
				if (startPassage.indexOf("SV ") === 0) { cands.push(startPassage.slice(3)); }
				if (startPassage.indexOf("Scene Viewer ") === 0) { cands.push(startPassage.slice(13)); }
			}
			if (sceneName) { cands.push(sceneName); }
			for (var i = 0; i < PLACE_GROUPS.length; i++) {
				var g = PLACE_GROUPS[i];
				if (!g || typeof g.match !== "function") { continue; }
				for (var j = 0; j < cands.length; j++) {
					if (cands[j] && g.match(cands[j])) { return g.id; }
				}
			}
		} catch (e) {}
		return null;
	}
	/* 场景联动解锁：剧情触发完成 → 记录对应场景组解锁（场景页显示已解锁并可直接直达） */
	function unlockPlaceForScene(P) {
		try {
			var V = getV();
			if (!V || !P || !P.startPassage) { return; }
			if (!V.mbCE_unlockedPlaces || typeof V.mbCE_unlockedPlaces !== "object") { V.mbCE_unlockedPlaces = {}; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			/* 入口为 SV 前缀等特殊形态时，用剧情包含段落兜底匹配（如 "Manor Kylar Room" 在 passages 中） */
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) {
				V.mbCE_unlockedPlaces[gid] = { key: P.key, name: P.name, startPassage: P.startPassage, t: Date.now() };
			}
		} catch (e) {}
	}
	/* 世界入口解锁表（v1.3）：各组场景在游戏世界里的原版进入条件（已从本体源码实证）：
	   - kylar_manor：多瑙河街 → "Kylar's manor" 链接，条件 $syndromekylar gte 1
	   - orphanage_loft：孤儿院大厅 → "Loft" 链接，条件 $loft_known is 1
	   - avery_mansion：多瑙河街 → "Avery's mansion" 链接，条件 $avery_mansion 存在且 fate 非 fallen/kicked（v1.2.1 兜底已自动满足）
	   - sirris_places：成人商店 → "Approach Sirris" 链接，条件 $adultshopstate 非 "closed"（营业时间仍受原版控制）
	   - elk_compound（v1.7.0）：Elk Street → "Approach the compound" 链接，条件 $compound.allowed 为 true
	     （未允许时仅显示 "Sneak into the compound" 潜入链接，crimeUp 30 trespassing——已从本体源码实证）
	   - doren_flat / sydney_temple / gwylan_garden：无持久世界入口（剧情/时间触发或动态位置）→ 不写入 */
	var WORLD_UNLOCKS = {
		"kylar_manor": { var: "syndromekylar", set: 1, entry: "多瑙河街 → Kylar's manor（庄园花园）" },
		"orphanage_loft": { var: "loft_known", set: 1, entry: "孤儿院大厅 → Loft（阁楼）" },
		"avery_mansion": { entry: "多瑙河街 → Avery's mansion（已由庄园状态兜底自动解锁）" },
		"sirris_places": { var: "adultshopstate", set: "open", entry: "成人商店 → 接近西里斯（营业时段可见）" },
		"elk_compound": { path: "compound.allowed", set: true, entry: "Elk Street → Approach the compound（需 $compound.allowed）" }
	};
	/* 幂等写入世界入口条件：已有更高/相同值不覆盖，只补缺失或更低值（v1.7.0 支持子路径 path 型，如 compound.allowed） */
	function applyWorldUnlock(gid) {
		try {
			var V = getV();
			if (!V || !gid || !WORLD_UNLOCKS[gid]) { return; }
			var w = WORLD_UNLOCKS[gid];
			if (w.path !== undefined) {
				var segs = String(w.path).split(".");
				var cur = V, i;
				for (i = 0; i < segs.length - 1; i++) {
					if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") {
						/* 父级缺失则逐层补空对象壳（防 undefined 写入） */
						cur[segs[i]] = {};
					}
					cur = cur[segs[i]];
				}
				if (cur[segs[segs.length - 1]] !== w.set) { cur[segs[segs.length - 1]] = w.set; }
				/* 顺带补 discovered（Elk Street 逻辑：discovered 才显示大院入口判定） */
				if (gid === "elk_compound" && V.compound && V.compound.discovered !== true) { V.compound.discovered = true; }
				return;
			}
			if (w.var === undefined) { return; }
			if (typeof w.set === "number") {
				var cur2 = typeof V[w.var] === "number" ? V[w.var] : 0;
				if (cur2 < w.set) { V[w.var] = w.set; }
			} else if (V[w.var] === undefined || V[w.var] === null || V[w.var] === "") {
				V[w.var] = w.set;
			}
		} catch (e) {}
	}
	/* 剧情 → 其场景组的世界入口解锁（联动解锁时一并调用） */
	function applyWorldUnlockForScene(P) {
		try {
			if (!P || !P.startPassage) { return; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) { applyWorldUnlock(gid); }
		} catch (e) {}
	}
	/* 执行场景初始变量（manualVariableChanges，与场景查看器点「重放」一致） */
	function execTweeMacros(str) {
		try {
			if (typeof str !== "string" || !str || typeof document === "undefined" || typeof Wikifier === "undefined") { return; }
			var holder = document.createElement("span");
			holder.style.display = "none";
			document.body.appendChild(holder);
			try { new Wikifier(holder, str); }
			finally { if (holder.parentNode) { holder.parentNode.removeChild(holder); } }
		} catch (e) {}
	}
	/* 当前段落名：SugarCube 全局 passage() 优先，V.passage 兜底（真实环境可靠取到"返回原位"目标） */
	function currentPassageName() {
		try { if (typeof passage === "function") { var p = passage(); if (typeof p === "string" && p) { return p; } } } catch (e) {}
		try { var V2 = getV(); if (V2 && typeof V2.passage === "string" && V2.passage) { return V2.passage; } } catch (e) {}
		return "";
	}
	/* v1.4.8：清理队列中已触发（used）的固定项并联动解锁（三个重放终点共用）；
	   v1.9.23：播放完 → 记入 mbCE_completedScenes（「已完成 ✓」，剧情页条目显示，可再自由锚定） */
	function cleanupUsedPins() {
		try {
			var Vq = getV();
			if (!Vq) { return; }
			var qc = Vq.mbCE_queue;
			if (Array.isArray(qc)) {
				for (var i2 = 0; i2 < qc.length; i2++) {
					if (qc[i2] && qc[i2].used) {
						unlockPlaceForScene(qc[i2]);
						applyWorldUnlockForScene(qc[i2]);
						if (qc[i2].key) {
							if (typeof Vq.mbCE_completedScenes !== "object" || Vq.mbCE_completedScenes === null) { Vq.mbCE_completedScenes = {}; }
							Vq.mbCE_completedScenes[qc[i2].key] = { name: qc[i2].name, t: Date.now() };
							/* v1.9.23-实机修复六轮：同步冻结快照——原版 unfreezePlayerStats 用 frozenValues
							   strict-replace 覆盖 State.variables，不同步则刚写入的「已完成 ✓」记录被恢复撤销
							   （实机：播完后面板仍无「已完成 ✓」、按钮仍可锚定）。 */
							try { if (Vq.frozenValues && typeof Vq.frozenValues === "object") { Vq.frozenValues.mbCE_completedScenes = Vq.mbCE_completedScenes; } } catch (e) {}
						}
					}
				}
				for (var i3 = qc.length - 1; i3 >= 0; i3--) {
					if (qc[i3] && qc[i3].used) { qc.splice(i3, 1); }
				}
			}
		} catch (e) {}
	}
	/* v1.9.5-自检：清重放残留的统一入口（unpinScene / onPassageOverride 各终点共用，消除 5 处分叉不一致）。
	   顺序固定：先清 replayScene/标记，再 unfreeze（避免 mbCEUnfreezeHook 在清理前重复走 cleanup）；
	   skipUnfreeze=true 时不调 unfreeze（原版手动重放场景不干预原版流程）。 */
	function mbCEClearReplay(skipUnfreeze) {
		var Vr = getV();
		try { Vr.replayScene = undefined; } catch (e) { Vr.replayScene = undefined; }
		try { Vr.mbCE_replayOnce = undefined; Vr.mbCE_replayPending = undefined; } catch (e) {}
		if (!skipUnfreeze) {
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
		}
	}
	/* :passageoverride 钩子：固定触发判定（在 SugarCube 原版 redirect 之前改 passageArgs.name） */
	function onPassageOverride(passageArgs) {
		try {
			var V = getV();
			if (!V) { return; }
			var dest = passageArgs && passageArgs.name;
			/* v1.5.1：Mansion 系段落兜底——无论以何种方式进入艾弗里庄园段落（场景直达、场景查看器重放、
			   固定触发、第二天正常日常），只要 $daily.avery.talk 缺失，avery_daily_talk / Mansion Talk 正文
			   都会 TypeError（reading 'chat'/'ignore'）；在固定触发判定前无条件兜底（缺失才建，不覆盖进度） */
			if (typeof dest === "string" && dest.length > 0 &&
				(dest.indexOf("Mansion") === 0 || dest.indexOf("Avery") === 0 || dest.indexOf("Avery's") === 0)) {
				ensureAveryMansion();
			}
			/* 原版重放结束（Scene Viewer End 且正处于重放）→ 记录场景解锁 + 清理已触发项 */
			if (dest === "Scene Viewer End" && V.replayScene) {
				cleanupUsedPins();
				/* v1.4.8：MOD 固定触发的重放播放完（到 Scene Viewer End）→ 自动返回原位（exitpassage）
				   并解除固定；跳过 End 段落（原版 End 显示 "Exit scene" 需手动点、且回的是场景查看器列表）。
				   原版手动重放保持原版行为：End → Exit scene 回场景查看器。 */
				var wasMod = !!V.mbCE_replayOnce;
				var backTo = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				mbCEClearReplay(!wasMod); /* v1.9.5-自检：统一清理入口（原版手动重放不 unfreeze） */
				if (wasMod && backTo && passageArgs) { passageArgs.name = backTo; }
				return;
			}
			if (V.replayScene) {
				/* 原版手动重放（非 MOD 固定触发）→ 交给原版处理，不干预 */
				if (!V.mbCE_replayOnce) { return; }
				/* v1.9.23-实机修复二轮（锚定触发播放完不清队列/被困 Scene Viewer End 死循环的根治）：
				   MOD 锚定/固定触发直接播剧情段（不经场景查看器播放器容器）——剧情出口段（dest 不在
				   replayScene.passages）会被原版 redirect（31697-31698）改写为 "Scene Viewer End"，
				   而本钩子已在同一轮 :passageoverride 事件内执行过（只看到旧 dest），下方 823 的
				   "Scene Viewer End" 分支永远收不到改写后的 dest → 播完不清理、队列残留、返回地点再弹；
				   玩家点「退出场景」（End 段汉化链接 target=Scene Viewer）又被 redirect 打回 End → 死循环被困。
				   修复：在本轮事件内直接接管剧情出口——清理队列 + 改 passageArgs.name 回原位（exitpassage），
				   原版 31683 检测 name 已变 → return 新 dest，redirect 不再执行。 */
				var rpExit = V.replayScene.passages;
				var exitDest = V.replayScene.exitpassage || "";
				var inChain = Array.isArray(rpExit) && rpExit.indexOf(dest) !== -1;
				var isEndUi = (dest === "Scene Viewer End" || dest === "Scene Viewer passages" || dest === "Scene Viewer End 2");
				if (dest === "Scene Viewer" || (!isEndUi && dest !== "Farm Work" && dest !== V.replayScene.startPassage && !inChain && dest !== exitDest)) {
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (exitDest && passageArgs) { passageArgs.name = exitDest; }
					return;
				}
				/* v1.4.8：MOD 固定触发的 case 场景播放完链回 Scene Viewer passages（非首次进入）→
				   自动返回原位并解除固定（跳过原版 default 的 "Error occurred" + 手动 Back 步） */
				if (dest === "Scene Viewer passages" && !V.mbCE_replayPending) {
					cleanupUsedPins();
					var backS = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (backS && passageArgs) { passageArgs.name = backS; }
					return;
				}
				/* v1.4.5：原版重放经 Back 正常返回原位（exitpassage）→ 清理残留（replayScene/标记/已用队列项），
				   避免残留导致后续取消固定误判"正在重放"、以及再次重放时被残留干扰 */
				if (dest === (V.replayScene.exitpassage || "")) {
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					return;
				}
				/* MOD 固定触发的重放：仅已知确定性逃逸终点到达时清理残留（农场剧情结束直接去 Farm Work 而非回 Scene Viewer），
				   否则一律视为仍在重放（含剧情中间段落不在注册表列表的情况）→ 不干预、不触发 */
				if (dest === "Farm Work") {
					/* 农场剧情确定性终点：结束即清理残留（unfreeze + 清标记），并移除已触发项（同 Scene Viewer End） */
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
				} else {
					/* v1.9.23-实机修复三轮：重放链内段判定——dest 在 replayScene.passages 内（inChain 恒 true），
					   二轮「链外出口」接管覆盖不到。两类播完信号：
					   ① 剧情线性走完：到达剧情末段（passages 最后一段）且前置链内段均已访问 → 剧情播完（落地点，
					      如「米奇酒吧知名度初见」Pub Fame Intro 4 为酒吧主段，实机 $pubfame 已存在走 else 选项、
					      无循环出口）→ 清理 + 回原位；分支型场景（如 Avery 各分支段）前置未全访问 → 不触发不误伤。
					   ② 剧情链循环回点：已访问段再次到达且非 startPassage/exitpassage（如 4 段剧情分支 Next 回
					      Pub Fame Intro）→ 剧情播完进入循环 → 清理 + 回原位。 */
					var visArr = V.replayScene.mbCE_visited;
					if (!Array.isArray(visArr)) { visArr = V.replayScene.mbCE_visited = []; }
					var wasVisited = visArr.indexOf(dest) !== -1;
					if (!wasVisited) { visArr.push(dest); }
					var isLastSeg = rpExit.length > 0 && dest === rpExit[rpExit.length - 1];
					if (isLastSeg) {
						var allPrevVisited = true;
						for (var pi = 0; pi < rpExit.length - 1; pi++) {
							if (visArr.indexOf(rpExit[pi]) === -1) { allPrevVisited = false; break; }
						}
						if (allPrevVisited) {
							cleanupUsedPins(); /* 线性播完：解锁 + 已完成记录 + 移除 */
							mbCEClearReplay();
							if (exitDest && passageArgs) { passageArgs.name = exitDest; }
							return;
						}
					}
					if (!wasVisited) { return; } /* 首次访问（含分支场景首次到末段）→ 不清理 */
					if (dest !== V.replayScene.startPassage && dest !== exitDest) {
						/* 非首次访问（循环回点）→ 播完清理 */
						cleanupUsedPins();
						mbCEClearReplay();
						if (exitDest && passageArgs) { passageArgs.name = exitDest; }
					}
					return; /* startPassage / exitpassage 重访 → 不触发 */
				}
			}
			var q = getPinQueue();
			if (!q) { return; }
			var P = null;
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].active !== false && !q[i].used && q[i].startPassage) { P = q[i]; break; }
			}
			if (!P) { return; }
			/* v1.9.23：带地点元数据的锚定项由 :passageend 弹确认条触发（走到该地点交互时），
			   段落跳转本身不再自动触发；旧档无元数据项保持旧「任意推进即触发」语义直至触发完 */
			var anchorMeta = P.anchor || sceneAnchorMeta(P.key);
			if (anchorMeta && anchorMeta.location) { return; }
			if (!dest || dest === P.startPassage || dest === "Scene Viewer End") { return; }
			if (Array.isArray(P.passages) && P.passages.indexOf(dest) !== -1) { return; }
			/* 防崩：农场依赖剧情且 $farm 未初始化 → 本次不触发（保留队列项，待农场线开启后自动可触发） */
			if (isFarmDependentScene(P) && !farmStateReady()) { return; }
			/* 防崩：艾弗里庄园/森林商店等段落依赖 $avery_mansion（可能延迟初始化）→ 触发前兜底 */
			ensureAveryMansion();
			/* 防崩：农场依赖剧情需 $farm 结构存在（触发前兜底，缺失才补，不覆盖已有进度） */
			ensureFarmState();
			/* 启动原版重放：先执行场景初始变量 → 冻结属性 → 设 $replayScene → 重定向入口 */
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			V.replayScene = {
				name: P.name,
				startPassage: P.startPassage,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName()
			};
			V.mbCE_replayOnce = true;  /* 本重放由 MOD 固定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			/* v1.4.8：仅当场景入口是 Scene Viewer passages 才需"首次保留 sceneViewSwitch"；
			   直入剧情段落的场景（如孤儿院 SV Street Bully Orphanage Go）不设 pending，
			   避免链回 Scene Viewer passages 时被误判为首次 → 无法自动回原位 */
			V.mbCE_replayPending = (P.startPassage === "Scene Viewer passages");
			passageArgs.name = P.startPassage;
			P.used = true; /* 一次性：触发后不再重复触发 */
			unlockPlaceForScene(P); /* 联动解锁：触发即解锁所在场景组（如凯拉尔剧情 → 庄园可直达） */
			applyWorldUnlockForScene(P); /* 世界入口解锁：写入原版进入条件（多瑙河街→庄园等） */
		} catch (e) {}
	}
	function hookPassageOverride() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			/* SugarCube 自定义事件系统（jQLite）：与 DoL 本体 $(document).one(':passageend',…) 一致。
			   四巡：命名空间防重——重载/重复注入时先 off 再 on，避免 jQuery handler 无限累积 */
			$(document).off(":passageoverride.mbce").on(":passageoverride.mbce", function (ev, passageArgs) {
				onPassageOverride(passageArgs);
			});
		} catch (e) {}
	}
	/* 场景查看器段落初始化拦截（防"播放完又播放"无限循环）：
	   本体的 Scene Viewer passages 段落在 <<switch $sceneViewSwitch>> 里无条件播放 case 剧情，
	   剧情 widget 结束若链回该段落会再次命中 case → 无限循环（且 replayScene 只在 default/End 清理）。
	   机制：固定触发跳转前设 mbCE_replayPending；首次进入该段落（pending=true）→ 消费标记、保留
	   sceneViewSwitch（case 正常播放）；剧情结束链回（pending=false 且处于我们的重放）→ 清
	   sceneViewSwitch 为无效值 → switch 走 default → 原版给出 Back 链接返回原位，不再重播。 */
	function mbCEOnPassageInit(title) {
		try {
			/* v1.3.5：格威岚场景临时变量全局兜底——每次进入任意段落都先确保
			   T.gwylanStatus / T.gwylanTF 已初始化（缺失才补，已有绝不覆盖）。
			   本体 Gwylan Ritual Start Garden 等段落靠 <<run statusCheck("Gwylan")>>
			   初始化这两个临时变量，但 statusCheck 仅在 C.npc.Gwylan.init === 1 时才调用
			   gwylanStatusCheck()（新存档未见过格威岚即不调用）；且 gwylanStatusCheck()
			   在 V.gwylanTalked/V.gwylanSeen/V.gwylan 缺失时早退，只设 T.gwylanStatus=[]、
			   不设 T.gwylanTF。新存档场景直达/固定触发格威岚段落 → 读 _gwylanStatus/
			   _gwylanTF 即崩（reading 'includesAny' / 'tail'）。全局兜底可覆盖任何段落名
			   （含框架改段落名/宿主段落内嵌格威岚内容的渲染路径）。 */
			ensureGwylanSceneState();
			/* v1.9.x 庄园自动维护每日调度：任意段落进入时检查游戏日变化，
			   执行已开启的自动维护项（AutoClean 模式，见 03-global.js mcAutoMaintainTick） */
			try { mcAutoMaintainTick(); } catch (e) {}
			if (title !== "Scene Viewer passages") { return; }
			var V = getV();
			if (!V) { return; }
			if (V.mbCE_replayPending) { V.mbCE_replayPending = false; return; }
			if (V.replayScene && V.mbCE_replayOnce) { V.sceneViewSwitch = "MB_CE_END"; }
		} catch (e) {}
	}
	function hookPassageInit() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageinit.mbce").on(":passageinit.mbce", function (ev, passage) {
				try {
					var t = (passage && passage.title) ? passage.title : "";
					mbCEOnPassageInit(t);
				} catch (e) {}
			});
		} catch (e) {}
	}
	/* v1.8.19：播放结束自动清理——包装 window.unfreezePlayerStats。
	   背景（用户实测）：固定 MOD 剧情播放完一次后不自动取消、仍重新播放；手动取消后仍被困播放器。
	   根因：结束判定只认 4 个硬编码段落名（Scene Viewer End / Scene Viewer passages / exitpassage /
	   Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景，结束段落为框架自有名，
	   不走原版 Scene Viewer 通道）的结束段落不被识别 → 队列 used 项永不清理 + replayScene 残留 →
	   下次推进剧情再次触发（循环）或拦截后续固定。
	   修复：任何合法 unfreezePlayerStats 调用（原版 Scene Viewer 退出 / 框架播放器结束 / mod 播放器
	   结束都会解冻）都视为"场景播放结束"→ 清理队列 used 项 + 清 replayScene/标记。不再依赖段落名。 */
	function hookUnfreezePlayerStats() {
		try {
			if (typeof window === "undefined" || !window) { return; }
			var orig = window.unfreezePlayerStats;
			if (typeof orig !== "function" || window.__mbCEUnfreezeHooked) { return; }
			window.__mbCEUnfreezeHooked = true;
			window.unfreezePlayerStats = function () {
				try {
					var V = getV();
					if (V && V.replayScene && V.mbCE_replayOnce) {
						/* MOD 固定触发的重放中收到 unfreeze = 播放结束 → 清理已触发项 + 重放状态 */
						cleanupUsedPins();
						try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
						try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
					}
				} catch (e) {}
				try { return orig.apply(window, arguments); } catch (e) {}
			};
		} catch (e) {}
	}

