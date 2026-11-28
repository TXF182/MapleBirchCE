/* 职责：玩家的游戏 · 数据层（二）——系统 9 / 财神 1 / 催眠 15 / 新生特权 15。
   设计口径：同一催眠分支只取已启用的最高档（登记顺序 1→5，后档覆盖前档）；不同分支可叠加。
   子开关默认全开；主开关关闭时子开关状态保留，重新打开后按保留状态继续生效。 */
	var MB_CE_PG_SKILL_ITEMS = (function () {
		var out = [];
		try {
			if (typeof PANEL_QUICK_GROUPS !== "undefined" && Array.isArray(PANEL_QUICK_GROUPS)) {
				PANEL_QUICK_GROUPS.forEach(function (g) {
					if (!g || ["核心属性", "负面状态", "名声（fame）"].indexOf(g.title) !== -1) { return; }
					(g.items || []).forEach(function (it) {
						if (it && it.path) { out.push({ path: it.path, name: it.label || it.path }); }
					});
				});
			}
		} catch (e) { /* 数据表缺失时走下面的静态兜底 */ }
		if (out.length === 0) {
			["skulduggery", "danceskill", "swimmingskill", "athletics", "tending", "housekeeping",
				"seductionskill", "oralskill", "chestskill", "handskill", "bottomskill", "penileskill",
				"vaginalskill", "analskill", "thighskill", "feetskill", "science", "maths", "english", "history",
				"prof.spray", "prof.baton", "prof.whip", "prof.net", "prof.pickaxe"].forEach(function (p) {
				out.push({ path: p, name: p });
			});
		}
		return out;
	})();
	var MB_CE_PG_SKILL_SUBS = MB_CE_PG_SKILL_ITEMS.map(function (it) {
		return { id: it.path, name: it.name };
	});
	var MB_CE_PG_SIX_SUBS = [
		{ id: "beauty", name: "美貌" }, { id: "physique", name: "体能" }, { id: "willpower", name: "意志" },
		{ id: "awareness", name: "意识" }, { id: "promiscuity", name: "淫乱" }, { id: "exhibitionism", name: "暴露癖" }
	];
	var MB_CE_PG_STATUS_SUBS = [
		{ id: "stress", name: "压力" }, { id: "trauma", name: "创伤" }, { id: "pain", name: "疼痛" },
		{ id: "tiredness", name: "疲劳" }, { id: "arousal", name: "性奋" }
	];
	/* 催眠描述里出现的属性键统一走这张表，避免把 beauty / arousal 这类英文键直接甩给玩家。 */
	var MB_CE_PG_STAT_CN = {
		beauty: "美貌", physique: "体能", willpower: "意志", awareness: "意识",
		promiscuity: "淫乱", exhibitionism: "暴露癖", deviancy: "异种癖",
		arousal: "性奋", stress: "压力", trauma: "创伤", pain: "疼痛", tiredness: "疲劳"
	};
	function mbCEPGStatCN(id) { return MB_CE_PG_STAT_CN[id] || id; }
	var MB_CE_PG_HYPNO = [
		{ id: "desire", name: "魅惑渴望", stats: ["beauty", "arousal", "promiscuity"], tiers: ["压抑", "诱惑", "迷醉", "幻梦", "极致"] },
		{ id: "show", name: "展示主宰", stats: ["exhibitionism", "beauty"], tiers: ["压抑", "诱惑", "迷醉", "沉溺", "崇高"] },
		{ id: "alien", name: "异种亲和", stats: ["deviancy", "awareness"], tiers: ["压抑", "诱惑", "迷醉", "沉溺", "极致"] }
	];
	var MB_CE_PG_HYPNO_IDS = ["desire_repress", "desire_tempt", "desire_intox", "desire_dream", "desire_peak",
		"show_repress", "show_tempt", "show_intox", "show_indulge", "show_sublime",
		"alien_repress", "alien_tempt", "alien_intox", "alien_indulge", "alien_peak"];
	MB_CE_PG_HYPNO_IDS.forEach(function (id, i) {
		var b = MB_CE_PG_HYPNO[Math.floor(i / 5)];
		var lv = (i % 5) + 1;
		var tierName = b.tiers[i % 5];
		var vals = [];
		b.stats.forEach(function (p) { vals.push(pgSet(p, lv >= 5 ? 999999 : 1000 + lv * 800)); });
		vals.push(pgFlag("hypno_" + b.id + "_" + lv, lv));
		MB_CE_PG_REGISTRY.push(pgEntry(
			id, "hypno", b.name.slice(0, 1), b.name + "·" + tierName,
			"第 " + lv + " 档「" + tierName + "」：" + b.name + "分支按 " + lv + " 级强度改写" +
			(b.stats.map(function (p) { return "「" + mbCEPGStatCN(p) + "」"; }).join("、")) + "。同分支只取最高档，不同分支可叠加。",
			vals, [], ["第" + lv + "档", b.name]
		));
	});

	/* ================= 图书馆系统 9 ================= */
	MB_CE_PG_REGISTRY.push(
		pgEntry("book_resonance", "system", "鸣", "藏书共鸣",
			"藏书达到 2 / 4 / 6 / 8 / 10 本时，全属性按基础值 +5% / +10% / +15% / +20% / +30%；五档子开关可单独关闭。",
			[{ op: "bookRes" }],
			[{ id: "b2", name: "2 本 +5%" }, { id: "b4", name: "4 本 +10%" }, { id: "b6", name: "6 本 +15%" },
				{ id: "b8", name: "8 本 +20%" }, { id: "b10", name: "10 本 +30%" }],
			["藏书加成", "五档可关"]),
		pgEntry("page_link", "system", "页", "书页联动",
			"六组书页全部联动，阅读任意一本都会带动其余五组；组合效果不会互相覆盖。六组可分别关闭。",
			[pgFlag("pageLink")],
			[{ id: "p1", name: "书页·序" }, { id: "p2", name: "书页·承" }, { id: "p3", name: "书页·转" },
				{ id: "p4", name: "书页·合" }, { id: "p5", name: "书页·外" }, { id: "p6", name: "书页·终" }],
			["六组联动", "组合不覆盖"]),
		pgEntry("library_shelter", "system", "庇", "图书馆庇护",
			"疲劳不再增长，压力与创伤持续归零；馆内馆外都生效。",
			[pgClear(["tiredness", "stress", "trauma"]), pgFlag("libraryShelter")],
			[], ["疲劳0", "压力创伤0", "馆外也生效"]),
		pgEntry("reading_master", "system", "读", "阅读大师",
			"阅读耗时减半，疲劳不再增加；学校四科直接拉满。",
			[pgSet(["science", "maths", "english", "history"], 1000), pgClear("tiredness"), pgFlag("readingMaster")],
			[], ["耗时-50%", "学校四科满", "疲劳0"]),
		pgEntry("fate_chips", "system", "筹", "命运筹码",
			"必然成功 3 枚、属性祝福 5 枚、额外行动 2 枚；筹码可叠加，失败时自动消耗一枚改判。",
			[{ op: "chips", val: 3 }, pgFlag("fateChips")],
			[], ["必然成功3", "属性祝福5", "额外行动2"]),
		pgEntry("weapon_master", "system", "主", "百兵之主",
			"所有武器熟练拉满，双持不再有惩罚；拿什么打都一样疼。",
			[pgProf(1000), pgFlag("weaponMaster")],
			[], ["熟练满", "双持无惩罚"]),
		pgEntry("tentacle_grow", "system", "育", "触手培育",
			"每日自动 +1 级，每级全属性 +10%，上限 10 级；不用喂，自己长。",
			[{ op: "dailyGrow", key: "mbCE_pg_tentacleLevel", max: 10 }, pgFlag("tentacleGrow")],
			[], ["每日+1级", "属性+10%/级", "上限10"]),
		pgEntry("fun_mode", "system", "爽", "爽玩模式",
			"疼痛、压力、创伤、疲劳的正向结算直接跳过；切到「原版」则恢复原版结算。",
			[pgFlag("funMode")],
			[], ["负面跳过", "可切原版"]),
		pgEntry("library_owner", "system", "馆", "图书馆主人",
			"全属性直接拉满，图书馆资源视为全部解锁；馆长的权限，读者的自由。",
			[{ op: "statsMax" }, pgFlag("libraryOwner")],
			[], ["全属性满", "资源全解锁"]),

		/* ================= 财神 1 ================= */
		pgEntry("fortune_bless", "economy", "财", "财神赐福",
			"金钱获取 +300%（×4），金钱消耗 -50%（×0.5）；与「战利品狂欢」同时开启时，战利品收益再 ×4，合计 ×16。",
			[pgFlag("fortuneBless")],
			[{ id: "income", name: "收入 +300%" }, { id: "expense", name: "支出 -50%" }],
			["收入×4", "支出×0.5", "可与战利品叠乘"])
	);

	/* ================= 新生特权 15 ================= */
	MB_CE_PG_REGISTRY.push(
		pgEntry("allmap", "new", "图", "全图通行",
			"全部地点解锁，路上不再遇敌；想去哪就去哪。",
			[pgFlag("allmap"), pgClear(["tiredness", "stress"])],
			[], ["全地点解锁", "遇敌0", "地图常开"]),
		pgEntry("stealth", "new", "隐", "无痕潜行",
			"潜行必定成功，目击归零，通缉归零；你走过的地方不会留下名字。",
			[pgSet("skulduggery", 1000), pgClear(["suspicion", "exposed"]), pgFlag("stealth")],
			[], ["潜行必成", "目击0", "通缉0"]),
		pgEntry("time_control", "new", "时", "时间掌控",
			"10 分钟内的短行动不耗时；阅读场景耗时再减半。",
			[pgClear("tiredness"), pgFlag("timeControl")],
			[], ["短行动0耗时", "阅读减半"]),
		pgEntry("absolute_defense", "new", "御", "绝对防御",
			"受到的伤害归零，不会战败，控制效果全部免疫。",
			[pgClear("pain"), pgFlag("absoluteDefense")],
			[], ["伤害0", "不战败", "控制免疫"]),
		pgEntry("one_hit", "new", "斩", "一击制胜",
			"攻击必中必暴，非首领直接秒杀，首领也会被削掉 50% 生命；战斗在第一回合结束。",
			[pgFlag("oneHit")],
			[], ["必中必暴", "非首领秒杀", "首领-50%"]),
		pgEntry("loot_carnival", "new", "掠", "战利品狂欢",
			"所有奖励 ×4，掉落率 100%，还能与「财神赐福」继续叠乘；打赢一场，搬空一地。",
			[pgFlag("lootCarnival")],
			[], ["奖励×4", "掉落100%", "可叠财神"]),
		pgEntry("all_stats_max", "new", "满", "全属性满级",
			"六项核心属性直接拉满，可突破原版上限；每一项都能单独关闭，想留哪项就留哪项。",
			[{ op: "statsMax" }],
			MB_CE_PG_SIX_SUBS, ["六属性满", "可突破", "可单关"]),
		pgEntry("all_skills_max", "new", "技", "技能全满",
			"全部基础、性技能、学校成绩、武器熟练拉满；上限解除，检定 +100%。子开关按技能列表逐项生成。",
			[{ op: "skillsMax" }],
			MB_CE_PG_SKILL_SUBS, ["全技能满", "上限解除", "检定+100%"]),
		pgEntry("status_lock", "new", "锁", "状态锁定",
			"压力、创伤、疼痛、疲劳、性奋锁定在 0，生理负面免疫；五项可分别锁定。",
			[{ op: "statusLock" }],
			MB_CE_PG_STATUS_SUBS, ["五项锁定", "生理负面免疫"]),
		pgEntry("transform_free", "new", "化", "转化自由",
			"全形态解锁，转化收益保留、不衰减；可以随时切主形态，保护效果也保留。",
			[pgFlag("transformFree")],
			[{ id: "demon", name: "恶魔" }, { id: "fallen", name: "堕天使" }, { id: "angel", name: "天使" }, { id: "human", name: "凡人" }],
			["全形态解锁", "收益保留", "不衰减"]),
		pgEntry("charmer", "new", "魅", "万人迷",
			"社交必定成功，好感只增不减，声望只增不减；恶名与通缉自动清零，也不会被告发。",
			[{ op: "loveAll", val: 100 }, pgSet("fame.good", 999999), pgClear(["suspicion", "exposed"]), pgFlag("charmer")],
			[{ id: "social", name: "社交必成" }, { id: "love", name: "好感只增" }, { id: "fame", name: "声望只增" }, { id: "report", name: "不被告发" }],
			["社交必成", "好感只增", "不被告发"]),
		pgEntry("infinite_items", "new", "物", "物品无限",
			"喷雾不再减少，容量拉到 8；消耗品不会耗尽。",
			[pgFlag("infiniteItems")],
			[{ id: "capacity", name: "容量∞" }, { id: "consume", name: "消耗0" }, { id: "weight", name: "重量0" }],
			["喷雾∞", "容量8", "消耗0"]),
		pgEntry("library_unlock", "new", "库", "书库全开",
			"书库全部解锁、瞬读、效果 ×2；考试与作业自动完成。",
			[pgSet(["science", "maths", "english", "history"], 1000), pgFlag("libraryUnlock")],
			[{ id: "unlock", name: "全解锁" }, { id: "instant", name: "瞬读" }, { id: "double", name: "效果×2" }, { id: "exam", name: "考试作业自动" }],
			["全解锁", "瞬读", "效果×2"]),
		pgEntry("triple_form", "new", "三", "三形共存",
			"恶魔、堕天使、天使三种形态同时存在，收益全部保留；可自由指定主形态，保护效果不丢。",
			[{ op: "transformSub" }, pgFlag("tripleForm")],
			[{ id: "demon", name: "恶魔" }, { id: "fallen", name: "堕天使" }, { id: "angel", name: "天使" }],
			["三形共存", "收益共存", "自由切主形态"]),
		pgEntry("presets", "new", "案", "预设方案",
			"四套一键配置：全开、图书馆、战斗、生活；随时切换，不用逐项点。",
			[pgFlag("presets")],
			[], ["4套预设", "一键切换"])
	);
