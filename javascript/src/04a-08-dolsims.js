/* 职责：DoLSims 适配器声明
   2026-11-28：图书馆 10 特质适配补齐（只动声明，不动写入引擎）——
   14 号书五注视从 boolean 改数字通道（模组 SugarCube 用 is 1 严格比较，true 会半失效），
   开启时补书页标记 / 每日快照 / 祈祷计数；新增命运之轮 / 无限制格斗 / 量子速读 / 无形之术 / 置闰五行。
   效果仍由 DoLSims 本体执行，适配器只负责把它的状态机拨到正确位置，不重写一套数值逻辑。 */
	CHEAT_ADAPTERS["dolsims"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				return typeof window.MirrorHypnoVariableRefresh === "function";
			} catch (e) { return false; }
		},
		entry: {
			modId: "dolsims",
			modName: "图书馆扩展 · 兼容入口（0.8.1.7）",
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
				{ key: "ds_trait_1", name: "恐虐注视（生效）", varPath: "citylibrarybook_14_1_trait", type: "number", numeric: true, min: 0, max: 1,
				  note: "1=生效/0=封印；开启补书页标记、施虐/受虐每日快照、本周疼痛祈祷次数。当天无战斗会 +3000 创伤（帝皇生效时免除）；战斗内疼痛祈祷受本扩展 14_3 门控限制。",
				  sync: { set: [
					{ path: "citylibrarybook_14_1", value: 1, if: { min: 1 } },
					{ path: "masochismSavedSims", value: function (V) { return Number(V.masochism) || 0; }, if: { min: 1 } },
					{ path: "sadismSavedSims", value: function (V) { return Number(V.sadism) || 0; }, if: { min: 1 } },
					{ path: "usedNotPraySims", value: 1, if: { min: 1 } },
					{ path: "uncomfortable_Sims_141", value: 1 }
				  ] } },
				{ key: "ds_trait_2", name: "奸奇注视（生效）", varPath: "citylibrarybook_14_2_trait", type: "number", numeric: true, min: 0, max: 1,
				  note: "1=生效/0=封印；学校科目读书双倍、技能书上限 300→600；技能书额外 +2 还要求 14_2 书页标记，开启时一并补写；检定失败有 15% 翻盘。",
				  sync: { set: [{ path: "citylibrarybook_14_2", value: 1, if: { min: 1 } }] } },
				{ key: "ds_trait_3", name: "纳垢注视（生效）", varPath: "citylibrarybook_14_3_trait", type: "number", numeric: true, min: 0, max: 1,
				  note: "1=生效/0=封印；温度对压力/疼痛/性奋/疲劳的负面全免；每天需用一次祈祷，否则 +6000 压力（帝皇生效时免除）。开启补今日祈祷次数。",
				  sync: { set: [
					{ path: "citylibrarybook_14_3", value: 1, if: { min: 1 } },
					{ path: "usedpraySims", value: 1, if: { min: 1 } }
				  ] } },
				{ key: "ds_trait_4", name: "色孽注视（生效）", varPath: "citylibrarybook_14_4_trait", type: "number", numeric: true, min: 0, max: 1,
				  note: "1=生效/0=封印；恶魔每日 -10 纯洁、堕天使 +9；压力非零会 +300 疼痛（帝皇只免这条）。天使≥6 时纯洁上限 1000，战斗文本保护童贞/誓言。",
				  sync: { set: [{ path: "citylibrarybook_14_4", value: 1, if: { min: 1 } }] } },
				{ key: "ds_trait_5", name: "帝皇注视（生效）", varPath: "citylibrarybook_14_5_trait", type: "number", numeric: true, min: 0, max: 1,
				  note: "1=生效/0=封印；每日意志快照恢复、意志修正 +5%；关闭恐虐/纳垢/色孽三条日结惩罚，但不关恶魔每日纯洁流失与祈祷门控。",
				  sync: { set: [
					{ path: "citylibrarybook_14_5", value: 1, if: { min: 1 } },
					{ path: "willpowerSavedSims", value: function (V) { return Number(V.willpower) || 0; }, if: { min: 1 } },
					{ path: "uncomfortable_Sims_145", value: 1 }
				  ] } },
				{ key: "ds_pray_used", name: "纳垢 · 今日祈祷可用（1=可用/0=已用）", varPath: "usedpraySims", type: "number", numeric: true, min: 0, max: 1,
				  note: "源码语义：1=今天还没用，0=已用；日结后重置为 1。" },
				{ key: "ds_pray_not", name: "恐虐 · 本周疼痛祈祷可用（1=可用/0=已用）", varPath: "usedNotPraySims", type: "number", numeric: true, min: 0, max: 1,
				  note: "源码语义：1=本周还没用，0=已用；每周重置为 1。" },
				{ key: "ds_wdestiny", name: "命运之轮（生效）", varPath: "WDestinytrait", type: "number", numeric: true, min: 0, max: 1,
				  note: "疲劳>2000 时生效：90% 无惩罚、9% 按溢出比例加压力/创伤、1% 直接 +3000 压力/+1500 创伤；只改疲劳溢出段。",
				  sync: { set: [{ path: "citylibrarybook_11", value: 1000, if: { min: 1 } }] } },
				{ key: "ds_excombat", name: "无限制格斗（生效）", varPath: "EXCombattrait", type: "number", numeric: true, min: 0, max: 1,
				  note: "只解锁扇耳光/短棍/鞭子/伞的战斗动作资格；短棍/鞭子仍需对应熟练度与神殿武器类型，伞需手持。",
				  sync: { set: [{ path: "citylibrarybook_12", value: 1000, if: { min: 1 } }] } },
				{ key: "ds_quantum", name: "量子速读法（生效）", varPath: "quantumtrait", type: "number", numeric: true, min: 0, max: 1,
				  note: "诡术检定修正 ×1.05（向下取整），不是裸加 5 点诡术；受当前 modifier 基数影响。",
				  sync: { set: [{ path: "citylibrarybook_13", value: 1000, if: { min: 1 } }] } },
				{ key: "ds_hypnotrait", name: "无形之术（生效）", varPath: "hypnotraitsSims", type: "number", numeric: true, min: 0, max: 1,
				  note: "只解锁镜子菜单「沉入大海」；不自动改硬腐化（图书馆解封本身会 +1 world_corruption_hard）。",
				  sync: { set: [{ path: "citylibrarybook_16", value: 1000, if: { min: 1 } }] } },
				{ key: "ds_intercalate", name: "置闰五行（生效）", varPath: "intercalatetrait", type: "number", numeric: true, min: 0, max: 1,
				  note: "只给触手战斗追加「放入前穴/放入后穴」动作；其他场景无效果。",
				  sync: { set: [{ path: "citylibrarybook_17", value: 1000, if: { min: 1 } }] } }
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
				  note: "本扩展复用原版转化键（demon），写此值会同时推进原版恶魔转化阶段" },
				{ key: "ds_angel", name: "天使化进度", varPath: "angel", type: "number", min: 0, max: 10,
				  note: "本扩展复用原版转化键（angel），写此值会同时推进原版天使转化阶段" },
				{ key: "ds_fallen", name: "堕落天使进度（≥2 判定）", varPath: "fallenangel", type: "number", min: 0, max: 10,
				  note: "本扩展复用原版转化键（fallenangel），写此值会同时推进原版堕落天使转化阶段" },
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
