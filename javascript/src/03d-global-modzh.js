	/* ============ v1.4.0 Mod作弊：第三方模组扩展内容操控（第 6 主页面）
	       边界：默认不处理 DoL 原版变量（过滤清单 CHEAT_VANILLA_ROOTS）；
	       只操作注册表 / 内置适配器 / 被动探测声明出的模组专属变量。
	       唯一例外（v2.0.0.003，用户明确要求）：原版 cheat 页「你对什么感到不安?」的 $uncomfortable.*，
	       由 08b-attitude.js 直写（modId="vanilla-attitudes"，键白名单限定 5 项，不留其他原版变量入口）。
	       机制：① setup.mbCE_modCheats 注册制（外部模组按约定声明，动态识别）
	             ② CHEAT_ADAPTERS 内置适配器数据（已装内容模组，探测命中即合并）
	             ③ CHEAT_PASSIVE_PROBES 被动识别占位（识别到模组但未声明可操控项）
	       留痕：V.mbCE_wrote 扩展 {type:"cheat", modId, op, path, before, after, t}，
	             key="cheat:"+modId+":"+itemKey；回退还原 before（首次面板写入前状态）。 ============ */
	var CHEAT_VANILLA_ROOTS = [
		"farm", "farm_stage", "gwylan", "gwylanSeen", "gwylanTalked",
		"robinromance", "whitneyromance", "kylarenglish", "avery_mansion", "avery_tower",
		"daily", "settings", "scenes", "NPCName", "characters", "npc",
		"weekly", "specialClothes", "loveInterest", "replayScene", "sceneViewSwitch",
		"mbCE_queue", "mbCE_wrote", "mbCE_replayOnce", "mbCE_replayPending", "mbCE_unlockedPlaces", "mbCE_completedScenes"
	];
	/* v1.7.0：DoL 原版 V 顶层键清单（从本体 0.5.12.13 HTML 宏上下文实证提取，186 键）。
	   用途：玩家属性编辑页「模组属性」区 = 运行时 V 顶层键 - 本清单（只添加原版没有的，原版键不重复添加）。
	   来源：twine 宏内 $xxx（含对象型）全部出现 + 手工补充运行时实证的原版顶层对象键（scenes/compound/money 等）。 */
	var ORIGINAL_V_ROOT_KEYS = [
		"NPCList", "alarm", "allure", "alluretest", "analchastityparasite", "analskill",
		"angelbuild", "arousalmax", "askedtochoke", "asylummedicated", "avery_mansion",
		"averydate", "averyragerevealed", "awareness", "baileydefeatedchain", "ballssize",
		"beastrapestat", "beauty", "beautymax", "bestialitytrait", "bottomskill", "brothelshowdata",
		"bullytimer", "bullytimeroutside", "bus", "cat", "catbuild", "cave", "chestskill",
		"choketrait", "compound", "consensual", "container", "control", "cool", "cowbuild",
		"daily", "dancelocation", "danceskill", "dancing", "debugLines",
		"debugWeatherBandBounds", "delinquency", "demonbuild", "detention", "deviancy",
		"drugged", "edengarden", "edenshrooms", "edenspring", "ejacstat", "ejactrait",
		"enemyanger", "enemyarousal", "enemyhealth", "enemyno", "enemytrust", "english",
		"english_exam", "englishtrait", "eventskip", "exhibitionism", "farm", "farm_stage",
		"feats", "feetskill", "feetuse", "fingersInVagina", "finish", "forest", "fox",
		"foxbuild", "fringelength", "gwylan", "gwylanSeen", "gwylanTalked", "hairlength",
		"hallucinogen", "handskill", "harper_appointments", "history", "history_exam",
		"historytrait", "id", "lakeRuin", "leftarm", "location", "loveInterest",
		"lowerschoolswimsuitno", "maths", "maths_exam", "mathstrait", "medicated", "minute",
		"molestationstart", "moleststat", "molesttrait", "money", "moonstate", "moor",
		"moor_hunt", "museumAntiques", "neckuse", "oralskill", "orgasmstat", "orgasmtrait",
		"outside", "overlowerwet", "overupperwet", "oxygen", "pain", "penileskill",
		"penistarget", "phase", "physique", "physiquesize", "player", "possessed", "pregnancyStats",
		"prevPassage", "promiscuity", "prostitutionstat", "pubwhore", "purity", "rapestat",
		"rapetrait", "renttime", "rightarm", "rng", "robinPillory", "robindebt",
		"robinmissing", "robinnote", "robinpaid", "robinromance", "scenePassages", "scenes",
		"school", "schoolswimshortsno", "science", "science_exam", "scienceprogression",
		"sciencetrait", "sea", "seductionskill", "selectedToy", "settings", "sexStats",
		"sexstart", "skulduggery", "smuggler_location", "specialClothes", "spraymax",
		"stat_police", "stress", "struggle_start", "submissive", "suffocating",
		"swallowedstat", "swimmingskill", "syndromeeden", "tentaclerapestat", "tentacletrait",
		"testvar", "thighskill", "timeDistortion", "timer", "tiredness", "trauma",
		"undertemp", "upperschoolswimsuitno", "uppertemp", "vaginalskill", "venuemod",
		"vorestage", "wardrobes", "water", "whitney_home_timer", "whitneyromance",
		"willpower", "willpowermax", "wolfbuild", "wolfgirl", "wolfpacktrust", "worn", "wraithPrison"
	];
	/* 玩家属性/模组键 中英映射（仅用于面板显示，写入路径始终用原键名，绝不影响数据层） */
	var ZH_KEYS = {
		/* 玩家基础 */
		"player": "玩家", "money": "金钱", "name": "姓名", "age": "年龄", "height": "身高", "gender": "性别",
		"sex": "生理性别", "appearance": "外貌", "pronoun": "代词", "pronouns": "代词（复数）", "he": "他", "his": "他的",
		"gender_body": "身体性别", "gender_appearance": "外观性别", "gender_posture": "姿态性别",
		"gender_appearance_factors": "外观性别影响因素", "gender_appearance_without_overwear": "外观性别（无外套）",
		"gender_appearance_without_overwear_factors": "外观性别因素（无外套）", "femininity": "女性气质",
		"femininity_without_overwear": "女性气质（无外套）",
		/* 身体 */
		"penis": "阴茎", "penisExist": "有无阴茎", "penissize": "阴茎尺寸", "vagina": "阴道",
		"vaginaExist": "有无阴道", "vaginaExists": "有无阴道", "VaginaExist": "有无阴道", "ballsExist": "有无睾丸",
		"ballssize": "睾丸尺寸", "hymenExist": "有无处女膜", "titsExist": "有无乳房", "breastsize": "胸围",
		"bottomsize": "臀围", "perceived_breastsize": "感知胸围", "perceived_bottomsize": "感知臀围",
		"condom": "避孕套", "bodyshape": "体型", "bodyTemperature": "体温", "bodyliquid": "体液",
		"bodywriting": "身体涂鸦", "types": "类型", "freckles": "雀斑", "skin": "皮肤", "color": "肤色",
		"layers": "衣物层", "sunscreen": "防晒霜", "usesLeft": "剩余次数", "hair": "头发", "length": "长度",
		"colour": "颜色", "crop": "发型", "wings": "翅膀", "scars": "疤痕", "tattoos": "纹身",
		"earPiercings": "耳洞", "nipplePiercings": "乳环", "labiaPiercings": "阴唇环",
		"temple_virginity": "神殿童贞", "virginity": "童贞", "virginityDetails": "童贞详情",
		"hymen": "处女膜", "temple": "神殿", "anal": "肛", "oral": "口", "penile": "阴茎的",
		"vaginal": "阴道的", "handholding": "牵手", "kiss": "亲吻", "virgin": "处子", "chastity": "贞操",
		/* 属性数值 */
		"love": "爱意", "lust": "欲望", "stress": "压力", "trauma": "创伤", "awareness": "意识",
		"arousal": "情欲", "pain": "疼痛", "control": "控制", "deviancy": "异种癖", "promiscuity": "淫乱",
		"fame": "名声", "reputation": "声誉", "dominance": "支配欲", "confidence": "自信", "sanity": "理智",
		"health": "健康", "willpower": "意志", "swim": "游泳", "tenderness": "温柔", "sensitivity": "敏感",
		"familiarity": "熟悉度", "pheromones": "信息素", "sass": "傲慢", "beauty": "容貌",
		"paraphilia": "性癖", "weirdness": "怪诞", "addiction": "上瘾", "corruption": "腐化",
		"whoring": "卖淫", "exhibitionism": "暴露癖", "submissive": "顺从", "submissiveness": "顺从度",
		"tolerances": "耐受", "tolerance": "耐受", "spunk": "精液", "life": "生命", "dead": "死亡",
		"physique": "体能", "purity": "纯洁", "drugged": "药物影响", "tiredness": "疲劳",
		"history": "历史", "inventory": "物品栏", "map": "地图", "position": "姿势", "target": "目标",
		"state": "状态", "seen": "已被看见", "action": "动作", "hide": "隐藏", "beastRut": "兽性发情",
		"reputation_fame": "声名", "reputation_rep": "声誉值",
		/* 技能（常见派生键） */
		"skulduggery": "诡术", "english": "语文", "maths": "数学", "science": "科学",
		"historytrait": "历史才能", "english_exam": "英语考试", "maths_exam": "数学考试",
		"science_exam": "科学考试", "history_exam": "历史考试",
		"handskill": "手部", "oralskill": "口部", "penileskill": "阴茎",
		"vaginalskill": "小穴", "analSkill": "后庭", "analskill": "后庭",
		"thighskill": "大腿", "feetskill": "足部", "chestskill": "胸部",
		"bottomskill": "臀部", "swimmingskill": "游泳", "seductionskill": "魅惑",
		"danceskill": "舞蹈", "feetuse": "足交使用", "neckuse": "颈部使用",
		/* 模组键 */
		"RobinTemple": "罗宾神殿", "TempleChoir": "神殿唱诗班", "LostLamb": "迷途羔羊",
		"TempleDuties": "神殿职责", "DeadwoodReblooms": "枯木逢春", "DeadwoodRebloomsAttitudes": "枯木逢春·态度",
		"Phone": "智能手机", "VPhone": "智能手机", "SmartPhone": "智能手机", "GameUI": "游戏界面",
		"SoftWet": "SoftWet 湿润系统", "ModHub": "模组中心", "DomRobin": "DomRobin", "MLI": "MLI 恋爱扩展",
		"stage": "阶段", "secret": "秘密", "rite_stage": "仪式阶段", "followup": "后续", "allowed": "允许",
		"discovered": "已发现",
		/* 快捷编辑补充键（v1.9.13 翻译表收敛：旧区无同名键才在此列；
		   PANEL_QUICK_GROUPS 的 label 经 zhKey(path) 动态生成，本表为单一事实源） */
		"athletics": "运动", "tending": "护理", "housekeeping": "家务",
		"spray": "防狼喷雾", "baton": "短棍", "whip": "鞭子", "net": "网", "pickaxe": "镐", "prof": "武器技能",
		"prof.spray": "防狼喷雾", "prof.baton": "短棍", "prof.whip": "鞭子", "prof.net": "网", "prof.pickaxe": "镐",
		/* 负面状态（v1.9.13） */
		"anxiety": "焦虑", "delinquency": "不良", "drunk": "醉酒",
		/* 名声子键（v1.9.13） */
		"fame.prostitution": "卖淫名声", "fame.sex": "性名声", "fame.rape": "施暴名声",
		"fame.exhibitionism": "暴露名声", "fame.bestiality": "异种名声", "fame.good": "善行名声"
	};
	var ZH_TYPES = { "number": "数值", "boolean": "布尔", "string": "文本", "object": "对象", "function": "函数", "undefined": "未定义", "null": "空" };
	function zhKey(k) { return ZH_KEYS[k] || String(k); }
	function zhPath(p) { return String(p).split(".").map(zhKey).join("."); }
	function zhType(t) { return ZH_TYPES[t] || t; }
	/* CHEAT_ADAPTERS 容器声明在 04a-00-core.js（v1.9.13 拆分时迁走，此处不再重复声明，避免后声明重置前者） */
	var CHEAT_PASSIVE_PROBES = []; /* { modId, modName, detect: fn } */
	var curCheatModId = "";

	/* 内置适配器：默示录：归途之书 v1.3.4（用户 2026-10-18 提供源码 Revelation-The-Book-of-Return-1.3.4.zip，
	   与 1.3.1 逐文件哈希对比实证：RobinTemple/TempleChoir 常量无变化；LostLamb/TempleDuties 两模块
	   1.3.1 起已注册但此前漏适配，1.3.4 又实质更新其实现——本次补录）
	   探测点：maplebirch 框架模块注册（Module.preInit 挂 :variable → V[模块名]）；
	   状态键：V.RobinTemple（罗宾神殿路线，constants/robin-temple.ts）、V.TempleChoir（唱诗班，
	   constants/temple-choir.ts）、V.LostLamb（迷途羔羊，constants/lost-lamb*.ts 共 5 文件）、
	   V.TempleDuties（神殿值勤，constants/temple-duties.ts）。
	   只声明模组自建键，不碰原版 V.temple_rank / V.templePromised / V.temple_chastity_timer 等。 */
