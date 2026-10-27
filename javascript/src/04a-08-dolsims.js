	CHEAT_ADAPTERS["dolsims"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				return typeof window.MirrorHypnoVariableRefresh === "function";
			} catch (e) { return false; }
		},
		entry: {
			modId: "dolsims",
			modName: "DoLSims 0.8.1.7（类模拟人生大扩展）",
			tasks: [],
			stages: [
				{ key: "ds_lib_trouble", name: "市立图书馆 · 事件状态", varPath: "Library_Trouble",
				  levels: [0, 1, 2],
				  labels: ["平静", "事件 1", "事件 2"] },
				{ key: "ds_clear_phase", name: "功能解锁阶段", varPath: "clearModSimsFuncDec_phase",
				  levels: [0, 1],
				  labels: ["未解锁", "已解锁"] }
			],
			abilities: [
				{ key: "ds_hypno_0", name: "镜中催眠 · 第 1 档", varPath: "MirrorHypnoSims_0", type: "boolean" },
				{ key: "ds_hypno_1", name: "镜中催眠 · 第 2 档", varPath: "MirrorHypnoSims_1", type: "boolean" },
				{ key: "ds_hypno_2", name: "镜中催眠 · 第 3 档", varPath: "MirrorHypnoSims_2", type: "boolean" },
				{ key: "ds_hypno_3", name: "镜中催眠 · 第 4 档", varPath: "MirrorHypnoSims_3", type: "boolean" },
				{ key: "ds_hypno_4", name: "镜中催眠 · 第 5 档", varPath: "MirrorHypnoSims_4", type: "boolean" },
				{ key: "ds_hypno_5", name: "镜中催眠 · 第 6 档", varPath: "MirrorHypnoSims_5", type: "boolean" },
				{ key: "ds_spray", name: "酒吧 · 喷雾枪", varPath: "weaponSprayGunSims", type: "boolean" },
				{ key: "ds_bike", name: "市场 · 已购自行车（£3000）", varPath: "BicycleSims", type: "boolean" },
				{ key: "ds_listen", name: "倾听权限", varPath: "FreeListenPermissionSims", type: "boolean" },
				{ key: "ds_temple_dream", name: "神殿 · 已知梦境", varPath: "TempleDreamKnewSims", type: "boolean" },
				{ key: "ds_pass_anytime", name: "图书馆 · 随时放行", varPath: "Seath_Allowed_Pass_Anytime", type: "boolean" },
				{ key: "ds_trait_1", name: "14 号书 · 特质 1 封印", varPath: "citylibrarybook_14_1_trait", type: "boolean" },
				{ key: "ds_trait_2", name: "14 号书 · 特质 2 封印", varPath: "citylibrarybook_14_2_trait", type: "boolean" },
				{ key: "ds_trait_3", name: "14 号书 · 特质 3 封印", varPath: "citylibrarybook_14_3_trait", type: "boolean" },
				{ key: "ds_trait_4", name: "14 号书 · 特质 4 封印", varPath: "citylibrarybook_14_4_trait", type: "boolean" },
				{ key: "ds_trait_5", name: "14 号书 · 特质 5 封印", varPath: "citylibrarybook_14_5_trait", type: "boolean" },
				{ key: "ds_pray_used", name: "今日已祈祷", varPath: "usedpraySims", type: "boolean" },
				{ key: "ds_pray_not", name: "今日未祈祷标记", varPath: "usedNotPraySims", type: "boolean" }
			],
			scenes: [],
			values: [
				{ key: "ds_sin", name: "罪恶值（0-1000）", varPath: "sinSims", type: "number", min: 0, max: 1000 },
				{ key: "ds_hypno", name: "催眠熟练度（0-1000，门槛 100/300/500/1000）", varPath: "hypnoSims", type: "number", min: 0, max: 1000 },
				{ key: "ds_discipline", name: "风纪委员 · 纪律", varPath: "DisciplineSims.value", type: "number", min: 0, max: 40,
				  note: "模组源码自身 clamp 上限 40（面板不钳制，写超由模组源码自行处理）；宿主对象在开局/迁移 passage 后存在，未初始化时拒绝写入" },
				{ key: "ds_popularity", name: "风纪委员 · 声望", varPath: "PopularitySims.value", type: "number", min: 0, max: 40 },
				{ key: "ds_horniness", name: "风纪委员 · 性欲值", varPath: "HorninessSims.value", type: "number", min: 0, max: 40 },
				{ key: "ds_influence", name: "风纪委员 · 影响力", varPath: "InfluenceSims.value", type: "number", min: 0, max: 40 },
				{ key: "ds_gym", name: "健身卡剩余（每日非周一 -1）", varPath: "Gym_Card", type: "number", min: 0, max: 7 },
				{ key: "ds_skill_game", name: "电脑房 · 游戏技能", varPath: "gameskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_skill_hypno", name: "电脑房 · 催眠技能", varPath: "hypnosisskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_book_11", name: "图书馆 · 11 号书进度", varPath: "citylibrarybook_11", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_12", name: "图书馆 · 12 号书进度", varPath: "citylibrarybook_12", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_13", name: "图书馆 · 13 号书进度", varPath: "citylibrarybook_13", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_14", name: "图书馆 · 14 号书进度", varPath: "citylibrarybook_14", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_16", name: "图书馆 · 16 号书进度", varPath: "citylibrarybook_16", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_17", name: "图书馆 · 17 号书进度", varPath: "citylibrarybook_17", type: "number", min: 0, max: 1000 },
				{ key: "ds_demon", name: "恶魔化进度（≥6 判定）", varPath: "demon", type: "number", min: 0, max: 10,
				  note: "DoLSims 复用原版转化键（demon），写此值会同时推进原版恶魔转化阶段" },
				{ key: "ds_angel", name: "天使化进度", varPath: "angel", type: "number", min: 0, max: 10,
				  note: "DoLSims 复用原版转化键（angel），写此值会同时推进原版天使转化阶段" },
				{ key: "ds_fallen", name: "堕落天使进度（≥2 判定）", varPath: "fallenangel", type: "number", min: 0, max: 10,
				  note: "DoLSims 复用原版转化键（fallenangel），写此值会同时推进原版堕落天使转化阶段" },
				{ key: "ds_corruption", name: "世界软腐化（≥90 触发，时间钩子 -50）", varPath: "world_corruption_soft", type: "number", min: 0, max: 100 },
				{ key: "ds_spray_skill", name: "喷雾枪熟练度", varPath: "weaponSprayGunSkillSims", type: "number", min: 0, max: 100 },
				{ key: "ds_head_blackmail", name: "多伦 · 黑料掌握（0/1）", varPath: "headblackmailed", type: "number", min: 0, max: 1 }
			]
		}
	};
	/* ===== Cattery 猫舍（猫咖/出租屋/养宠/全图飞行） v1.1.8.2 =====
	   状态模型：无根对象，全部为顶层标量（$rentingahouse/$pchaveCat/$pcfood_cake/$catArr 等）。
	   判定方式均为严格比较（is 1 / gte 1），故所有键走数字通道（stages/values），禁用 boolean。
	   养猫写 1 联动补猫数据（catArr 数组 + 品种），防止模组 catArr[0] 崩。 */
