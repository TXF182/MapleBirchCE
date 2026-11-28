/* 职责：玩家的游戏 · 数据层（一）——分组表、效果操作 helper、书籍/镜子/武器 22 项。
   口径：全部纯增益；不读取 DoLSims 的任何文件/变量/特质，不依赖外部模组。
   每一项 = 一个稳定 id + 一个主开关 + 可选子开关 + 一组声明式效果操作。
   效果操作在开启时执行一次，翻页 tick 时对已开启项复写，保证游戏结算不会把值冲掉。 */
	var MB_CE_PG_GROUPS = [
		{ id: "books", title: "书籍秘藏", sub: "十本禁书 · 命运与兵权", icon: "书" },
		{ id: "mirror", title: "镜中权柄", sub: "六面镜子 · 心智与肉体", icon: "镜" },
		{ id: "weapons", title: "兵器库", sub: "六种武装 · 出手即压制", icon: "刃" },
		{ id: "system", title: "图书馆系统", sub: "藏书 · 书页 · 庇护 · 经营", icon: "塔" },
		{ id: "economy", title: "财神", sub: "进账翻倍 · 支出减半", icon: "金" },
		{ id: "hypno", title: "催眠谱系", sub: "三条分支 × 五档", icon: "瞳" },
		{ id: "new", title: "新生特权", sub: "地图 · 时间 · 防御 · 全能", icon: "星" }
	];

	/* 效果操作 helper：全部返回普通对象，方便测试逐项断言与序列化。 */
	function pgSet(path, val) { return { op: "set", path: path, val: val }; }
	function pgClear(path) { return { op: "clear", path: path }; }
	function pgFlag(key, val) { return { op: "flag", key: key, val: val === undefined ? 1 : val }; }
	function pgProf(val) { return { op: "profAll", val: val }; }
	function pgEntry(id, group, icon, name, desc, eff, subs, tags) {
		return { id: id, group: group, icon: icon, name: name, desc: desc, eff: eff || [], subs: subs || [], tags: tags || [] };
	}

	var MB_CE_PG_CORE_STATS = ["beauty", "physique", "willpower", "awareness", "promiscuity", "exhibitionism", "deviancy"];
	var MB_CE_PG_REGISTRY = [
		/* ================= 书籍秘藏 10 ================= */
		pgEntry("fate_driver", "books", "命", "命运操盘",
			"疲劳压过 2000 时，压力与创伤不再上涨；检定自动取最优结果，每日首次失败还能重掷。成功一次攒一枚命运筹码，1% 的灾难直接被抹掉。",
			[pgFlag("fateDriver"), pgClear(["stress", "trauma"])],
			[], ["检定最优", "失败重掷", "灾难删除"]),
		pgEntry("arsenal_open", "books", "兵", "百兵全开",
			"短棍、鞭子、喷雾、网、镐全部视为已持有且熟练拉满；双持伤害翻倍，任何武器都不再有使用门槛。",
			[pgProf(1000), pgFlag("arsenalOpen")],
			[], ["全武器解锁", "熟练满", "双持×2"]),
		pgEntry("quantum_cram", "books", "量", "量子速成",
			"读书耗时砍半、收益翻倍，检定直接 +50%；失败可重掷，还能把普通成功抬成强成功。科学、数学、英语、历史一并拉满。",
			[pgSet(["science", "maths", "english", "history"], 1000), pgFlag("quantumCram")],
			[], ["阅读-50%", "收益×2", "检定+50%"]),
		pgEntry("blood_rage", "books", "怒", "血怒战神",
			"疼痛直接转成攻击力，伤害翻倍；每场战斗可祈祷一次，把身上的疼痛清空。越痛越能打，打完还是满状态。",
			[pgSet("physique", 999999), pgClear("pain"), pgFlag("bloodRage")],
			[], ["疼痛转攻", "伤害×2", "每战祈祷"]),
		pgEntry("omniscient", "books", "知", "万变全知",
			"学习收益翻倍，技能书上限抬到 1000；每次阅读额外 +10，失败有一半概率直接改判成功。所有技能一键推满。",
			[{ op: "skillsMax", val: 1000 }, pgFlag("omniscient")],
			[], ["学习×2", "上限1000", "失败转成功"]),
		pgEntry("undying_father", "books", "慈", "不朽慈父",
			"温度、毒素、疾病带来的负面全部归零；每日祈祷一次，压力与创伤一起清空。慈父不需要你受苦。",
			[pgClear(["drugged", "drunk", "anxiety", "delinquency", "stress", "trauma"]), pgFlag("undyingFather")],
			[], ["负面免疫", "每日净化", "压力创伤清零"]),
		pgEntry("pleasure_lord", "books", "欢", "欢愉主宰",
			"恶魔、堕天使、天使、凡人四条分支全部强化；欢愉会转成魅力与攻击。恶魔线 -10 纯洁、堕天使线 +9 纯洁，作为身份分支保留。",
			[pgFlag("pleasureLord"), { op: "purityBranch" }, pgSet(["beauty", "arousal", "promiscuity"], 999999)],
			[], ["四分支强化", "欢愉转魅力", "身份分支"]),
		pgEntry("emperor_aegis", "books", "帝", "帝皇庇护",
			"意志锁定在最高档，精神攻击直接免疫；每日自动净化一次，队友也能吃到五成庇护。",
			[pgSet("willpower", 999999), pgClear(["stress", "trauma"]), pgFlag("emperorAegis")],
			[], ["意志锁定", "精神免疫", "每日净化"]),
		pgEntry("mirror_lord", "books", "镜", "镜界主宰",
			"镜子六档全解锁，心力消耗归零；每次训练 +30，上限抬到 1000。镜中权柄，全部归你。",
			[pgFlag("mirrorLord"), pgSet(["willpower", "physique"], 999999)],
			[], ["六档全开", "心力0", "训练+30"]),
		pgEntry("tentacle_king", "books", "触", "触手王权",
			"双槽触手同时在场，触手伤害翻倍，每回合额外多一次攻击；每日自动成长，最高十级。",
			[pgFlag("tentacleKing"), { op: "dailyGrow", key: "mbCE_pg_tentacleLevel", max: 10 }],
			[], ["双槽", "伤害×2", "额外攻击"]),

		/* ================= 镜中权柄 6 ================= */
		pgEntry("mind_wall", "mirror", "壁", "心智壁垒",
			"精神攻击 100% 免疫，五成反弹给对面；压力与创伤每次翻页都被压回零。",
			[pgClear(["stress", "trauma"]), pgFlag("mindWall")],
			[], ["免疫100%", "反弹50%", "压力创伤0"]),
		pgEntry("infinite_body", "mirror", "体", "无限体能",
			"体能上限抬到 20000，体型判定 +1；体力见底也不会瘫倒，疲劳永远压得住。",
			[pgSet("physique", 999999), pgFlag("infiniteBody")],
			[], ["上限20000", "体型+1", "疲劳压制"]),
		pgEntry("killer_instinct", "mirror", "杀", "杀意增幅",
			"攻击直接翻倍，100% 抢到先手；战斗里每次出手都像背刺。",
			[pgSet("physique", 999999), pgFlag("killerInstinct")],
			[], ["攻击×2", "先手100%", "战斗压制"]),
		pgEntry("inner_eternal", "mirror", "恒", "内在永恒",
			"所有衰减归零，每日自动 +1，上限再 +5；转化与外貌不会随时间掉档。",
			[pgFlag("innerEternal")],
			[], ["衰减0", "每日+1", "上限+5"]),
		pgEntry("cognition_rewrite", "mirror", "改", "认知改写",
			"每日可改写一次，最多同时改写三个人；对方对你的认知直接按你的版本重写。",
			[pgFlag("cognitionRewrite")],
			[], ["每日1次", "最多3人", "认知重写"]),
		pgEntry("common_sense", "mirror", "常", "常识重写",
			"每日一次，暴露、怀疑、罪恶全部 -100%；在别人眼里你永远是清白的那一个。",
			[pgClear(["exposed", "suspicion"]), pgSet("fame.exhibitionism", 0), pgFlag("commonSense")],
			[], ["暴露清零", "怀疑清零", "罪恶清零"]),

		/* ================= 兵器库 6 ================= */
		pgEntry("temple_arms", "weapons", "殿", "神殿武具",
			"短棍与鞭子全开、熟练拉满，伤害翻倍；神殿的武具在你手里没有上限。",
			[{ op: "set", path: ["prof.baton", "prof.whip"], val: 1000 }, pgFlag("templeArms")],
			[], ["短棍/鞭全开", "熟练满", "伤害×2"]),
		pgEntry("umbrella_mastery", "weapons", "伞", "伞武精通",
			"三把伞全部解锁，短棍熟练同步拉满，伤害翻倍；雨天和晴天都能打。",
			[pgProf(1000), pgFlag("umbrellaMastery")],
			[], ["三伞全开", "短棍熟练", "伤害×2"]),
		pgEntry("tentacle_weapon", "weapons", "缠", "触手武具",
			"触手武器双槽同时装备，伤害翻倍，额外多一次攻击；不需要额外抬手。",
			[pgFlag("tentacleWeapon"), pgSet("prof.whip", 1000)],
			[], ["双槽", "伤害×2", "额外攻击"]),
		pgEntry("wolf_firepower", "weapons", "狼", "防狼火力",
			"喷雾弹药无限、容量 +2，伤害翻倍；对准谁，谁就得退。",
			[pgSet("prof.spray", 1000), pgFlag("wolfFirepower")],
			[], ["弹药∞", "容量+2", "伤害×2"]),
		pgEntry("fujin_toy", "weapons", "藤", "藤津伪器",
			"硬直 +100%，战意 -50%，致死率归零；打服为止，不打出人命。",
			[pgSet("prof.whip", 1000), pgFlag("fujinToy")],
			[], ["硬直+100%", "战意-50%", "致死0"]),
		pgEntry("baseball_bat", "weapons", "棒", "球棒",
			"球棒伤害翻倍，自带威慑，命中把对面击退一格；最朴素的武器，最直接的效果。",
			[pgSet("prof.baton", 1000), pgFlag("baseballBat")],
			[], ["伤害×2", "威慑", "击退1格"])
	];
