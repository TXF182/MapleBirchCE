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
		"banner": "旗地", "blitz": "闪电区"
	};
