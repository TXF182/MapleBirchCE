	CHEAT_ADAPTERS["dol-optimization"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				return !!window.DolOptimization;
			} catch (e) { return false; }
		},
		entry: {
			modId: "dol-optimization",
			modName: "原版优化 Dol-Optimization v1.1.2.1",
			tasks: [],
			stages: [
				{ key: "opt_ui_bar", name: "导航栏开关美化", varPath: "options.opt.UiBarToggle",
				  levels: ["default", "back", "hide"],
				  labels: ["默认", "返回式", "隐藏"],
				  note: "经 V.options 子键写入（options 不在原版根拦截清单，边界地带）" }
			],
			abilities: [
				{ key: "opt_worn", name: "叠穿总开关", varPath: "options.opt.WornStacking", type: "boolean",
				  note: "实验性功能，默认关；开启后衣物可叠穿" },
				{ key: "opt_worn_traits", name: "叠穿 · 特质叠加", varPath: "options.opt.WornStackingTraits", type: "boolean" },
				{ key: "opt_worn_warmth", name: "叠穿 · 保暖叠加", varPath: "options.opt.WornStackingWarmth", type: "boolean" },
				{ key: "opt_quicksave", name: "快速存档开关", varPath: "options.opt.QuickSaveEnabled", type: "boolean" }
			],
			scenes: [],
			values: [
				{ key: "opt_needmeet", name: "遇欲（Needmeet）· 好感（0-100，≥80 解锁恋爱线）", varPath: "needmeet_romance", type: "number", min: 0, max: 100,
				  note: "遇欲便利店店主 NPC：≥50 信赖，≥80 解锁 loveInterest/恋爱线；面板写 V 侧即可（恋爱判定只看此值）；C.npc.Needmeet.love 是「询问他手中的本子」认识剧情的运行时标记，由剧情自然推进" },
				{ key: "opt_hymen", name: "处女膜修复剩余天数（每日递减）", varPath: "hymenreconstructioncount", type: "number", min: 0, max: 30 },
				{ key: "opt_hair", name: "发质（0-100）", varPath: "hairtexture", type: "number", min: 0, max: 100,
				  note: "模组自建键（原版清单无），随每小时 +0.05 增长" },
				{ key: "opt_nicotine", name: "尼古丁依赖（0-95）", varPath: "nicotine", type: "number", min: 0, max: 95 },
				{ key: "opt_wardrobe", name: "衣柜扩容值（模组自标「作弊」）", varPath: "options.DolOptimization.LargerWardrobeValue", type: "number", min: 1, max: 9999 },
				{ key: "opt_cs_condom", name: "便利店 · 避孕套库存", varPath: "daily.conveniencestoregoods.避孕套", type: "number", min: 0, max: 99,
				  note: "遇欲便利店柜台商品每日库存（初始 18，售出递减、不自动补货）；首次需先进入遇欲便利店一次（进入即初始化库存对象）" },
				{ key: "opt_cs_pregtest", name: "便利店 · 验孕棒库存", varPath: "daily.conveniencestoregoods.验孕棒", type: "number", min: 0, max: 99,
				  note: "遇欲便利店柜台商品每日库存（初始 5，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_cig", name: "便利店 · 香烟库存", varPath: "daily.conveniencestoregoods.香烟", type: "number", min: 0, max: 99,
				  note: "遇欲便利店柜台商品每日库存（初始 27，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_sober", name: "便利店 · 醒酒药库存", varPath: "daily.conveniencestoregoods.醒酒药", type: "number", min: 0, max: 99,
				  note: "遇欲便利店柜台商品每日库存（初始 4，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_frigid", name: "便利店 · 降火药库存", varPath: "daily.conveniencestoregoods.降火药", type: "number", min: 0, max: 99,
				  note: "遇欲便利店柜台商品每日库存（初始 4，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_energy", name: "便利店 · 能量饮料库存", varPath: "daily.conveniencestoregoods.能量饮料", type: "number", min: 0, max: 99,
				  note: "遇欲便利店货架商品每日库存（初始 27，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_wash", name: "便利店 · 洗面奶库存", varPath: "daily.conveniencestoregoods.洗面奶", type: "number", min: 0, max: 99,
				  note: "遇欲便利店货架商品每日库存（初始 6，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_shampoo", name: "便利店 · 洗发水库存", varPath: "daily.conveniencestoregoods.洗发水", type: "number", min: 0, max: 99,
				  note: "遇欲便利店货架商品每日库存（初始 6，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_egg", name: "便利店 · 鸡蛋库存", varPath: "daily.conveniencestoregoods.鸡蛋", type: "number", min: 0, max: 99,
				  note: "遇欲便利店外摆食材每日库存（初始 40，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_tomato", name: "便利店 · 番茄库存", varPath: "daily.conveniencestoregoods.番茄", type: "number", min: 0, max: 99,
				  note: "遇欲便利店外摆食材每日库存（初始 21，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_apple", name: "便利店 · 苹果库存", varPath: "daily.conveniencestoregoods.苹果", type: "number", min: 0, max: 99,
				  note: "遇欲便利店外摆食材每日库存（初始 21，售出递减、不自动补货）；首次需先进入遇欲便利店一次" },
				{ key: "opt_cs_orange", name: "便利店 · 橙子库存", varPath: "daily.conveniencestoregoods.橙子", type: "number", min: 0, max: 99,
				  note: "遇欲便利店外摆食材每日库存（初始 21，售出递减、不自动补货）；首次需先进入遇欲便利店一次" }
			]
		}
	};

	/* 内置适配器：Wraith'sReflection 1.3.4（象牙怨灵恋爱线扩展，2026-10-20 解压 10 twee/1 js/26 补丁逐文件实证）
	   探测键：模组无具名模块注册（addon 只做 maplebirch.npc.add + 事件监听），用自有 V 根并集探测
	   （剧情未启动的新档 detect=false，此时本无可作弊内容，可接受；无框架降级安装时 V 键语义不变）。
	   状态键：V.WraithsReflection（恋爱总闸门=1）/ HelpAsk（米奇求助线 1-5）/ necklaceWR（项链持有 0-3）/
	   necklaceThief（偷窃责任枚举，模组自身 Return Necklace 2 写入 "rreturn"（双 r）但约 6 处补丁只认 "return"——
	   面板如实列出两种取值，写 "return" 覆盖面最全）/ AdmitMR / RefuseWR / SilverConchAsk /
	   necklaceThiefWR（项链窃案·怨灵侧标记，并入探测）/ stealdailyMR。原版根（wraith.state="forgive"/weekly.wraithDate/dateCount.Wraith）一律不暴露。 */
