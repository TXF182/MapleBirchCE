	CHEAT_ADAPTERS["cattery"] = {
		detect: function () {
			try {
				if (typeof window !== "undefined" && typeof window.createCafePC === "function") { return true; }
				var v = getV();
				return !!(v && (v.cattery_time !== undefined || v.pcfood_cake !== undefined || v.rentingahouse !== undefined || v.pchaveCat !== undefined));
			} catch (e) { return false; }
		},
		entry: {
			modId: "cattery",
			modName: "猫舍 Cattery v1.1.9（猫咖/出租屋/养宠/飞行）",
			tasks: [],
			stages: [
				{ key: "cat_rent", name: "出租屋 · 是否已租", varPath: "rentingahouse",
				  levels: [0, 1], labels: ["未租屋", "已租屋"],
				  note: "写「已租屋」触发租屋事件（源码实证：租屋确定时 pcHome_clean=30，另有场景惰性置 35；pcHouseCleanLimit 锁 0-40）；每月 1 日需交租" },
				{ key: "cat_owncat", name: "养猫 · 是否已领养", varPath: "pchaveCat",
				  levels: [0, 1], labels: ["未养猫", "已养猫"],
				  sync: { set: [
					{ path: "firstCat_variety", value: "橘猫", if: { min: 1 } },
					{ path: "catArr", value: [{ name: "咪咪", love: 0, play: 0 }], if: { min: 1 }, ifMissing: true }
				  ] },
				  note: "写「已养猫」自动补猫数据（仅当 catArr 不存在时，已有猫不重置；名字「咪咪」/好感 0/玩力 0）" },
				{ key: "cat_garden", name: "出租屋 · 花园升级", varPath: "pcGardenupgrade",
				  levels: [0, 1], labels: ["未升级", "已升级"] },
				{ key: "cat_fly", name: "飞行 · 全图飞行解锁", varPath: "birdFly",
				  levels: [0, 1], labels: ["未解锁", "已解锁"],
				  note: "对应飞行训练 6 次后的「鸟翼」解锁（源码 cafefly.twee 写 $birdFly=1，判定 $birdFly gte 1）；飞往地点用 $flycattery 编号选择" },
				{ key: "cat_book1", name: "书房 · 藏书 1", varPath: "pcHouseBook1",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book2", name: "书房 · 藏书 2", varPath: "pcHouseBook2",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book3", name: "书房 · 藏书 3", varPath: "pcHouseBook3",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book4", name: "书房 · 藏书 4", varPath: "pcHouseBook4",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book5", name: "书房 · 藏书 5", varPath: "pcHouseBook5",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] }
			],
			abilities: [
				/* 特质直接获取（用户实测请求；判定均 gte 1 严格比较 → numeric 数字通道，禁 boolean）。
				   特质注册实证：mods/cattery/tj/traits.txt —— 金牌饲养员 has $pchaveCat>=1 and $firstCat_loveMax gte 1；
				   爱·时·机 has $pcHouseBook1_speciality gte 1（书房藏书1阅读获得，homeBook.twee）；绝爱同藏书2。 */
				{ key: "cat_trait_gold", name: "特质 · 金牌饲养员", varPath: "firstCat_loveMax", numeric: true, min: 0, max: 1,
				  sync: { set: [{ path: "pchaveCat", value: 1 }] },
				  note: "模组判定 pchaveCat≥1 且 firstCat_loveMax≥1；勾选=补领养猫并置好感上限达成（好感写 40 亦自动触发），特质直接获得；取消=loveMax 归 0（特质消失，领养保留）" },
				{ key: "cat_trait_book1", name: "特质 · 爱·时·机", varPath: "pcHouseBook1_speciality", numeric: true, min: 0, max: 1,
				  note: "书房·藏书1 阅读获得（homeBook.twee 实证）；判定 gte 1，勾选写 1" },
				{ key: "cat_trait_book2", name: "特质 · 绝爱", varPath: "pcHouseBook2_speciality", numeric: true, min: 0, max: 1,
				  note: "书房·藏书2 阅读获得；判定 gte 1，勾选写 1" }
			],
			scenes: [],
			values: [
				{ key: "cat_love", name: "猫 · 好感（0-40）", varPath: "catArr.0.love", type: "number", min: 0, max: 40,
				  sync: { set: [
					{ path: "firstCat_loveMax", value: 1, if: { min: 40 } }
				  ] },
				  note: "需先领养猫（catArr 存在）；写 ≥40 自动补 firstCat_loveMax=1——模组特质「金牌饲养员」触发条件是 love≥40 且 loveMax≠1 时置 loveMax=1（源码 Cathave_speciality widget 实证），不补则特质不出现；写低值不撤销 loveMax（模组仅电脑降级操作归 0）" },
				{ key: "cat_play", name: "猫 · 玩力（0-40）", varPath: "catArr.0.play", type: "number", min: 0, max: 40,
				  note: "需先领养猫（catArr 存在）" },
				{ key: "cat_stray", name: "流浪猫 · 幸福度", varPath: "stray_happiness", type: "number", min: 0, max: 999 },
				{ key: "cat_food_store", name: "食材 · 储备（pc_food）", varPath: "pc_food", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cake", name: "食材 · 蛋糕（pcfood_cake）", varPath: "pcfood_cake", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cabbage", name: "食材 · 卷心菜", varPath: "pc_cabbages", type: "number", min: 0, max: 99 },
				{ key: "cat_food_eggplant", name: "食材 · 茄子", varPath: "pc_aubergine", type: "number", min: 0, max: 99 },
				{ key: "cat_food_potato", name: "食材 · 土豆", varPath: "pc_potato", type: "number", min: 0, max: 99 },
				{ key: "cat_food_pepper", name: "食材 · 青椒", varPath: "pc_green_pepper", type: "number", min: 0, max: 99 },
				{ key: "cat_food_fillet", name: "食材 · 鱼排", varPath: "pc_fillet", type: "number", min: 0, max: 99 },
				{ key: "cat_food_chicken", name: "食材 · 鸡胸肉", varPath: "pc_chicken_breast", type: "number", min: 0, max: 99 },
				{ key: "cat_food_sichuan", name: "食材 · 花椒", varPath: "pc_Sichuan_pepper", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cream", name: "食材 · 奶油", varPath: "pc_cream", type: "number", min: 0, max: 99 },
				{ key: "cat_food_flour", name: "食材 · 蛋糕粉", varPath: "pc_cake_flour", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cocoa", name: "食材 · 可可粉", varPath: "pc_cocoa_powder", type: "number", min: 0, max: 99 },
				{ key: "cat_food_milk", name: "食材 · 牛奶", varPath: "pc_milk", type: "number", min: 0, max: 99 },
				{ key: "cat_boxed_meal", name: "便当 · 盒饭储备", varPath: "boxed_meal", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_dsx", name: "菜品 · 地三鲜（次数）", varPath: "cookok_dsx", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_sltds", name: "菜品 · 酸辣土豆丝（次数）", varPath: "cookok_sltds", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_qxjl", name: "菜品 · 茄香鸡柳（次数）", varPath: "cookok_qxjl", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_qjrs", name: "菜品 · 青椒肉丝（次数）", varPath: "cookok_qjrs", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_nxqzb", name: "菜品 · 奶香茄子煲（次数）", varPath: "cookok_nxqzb", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_jytd", name: "菜品 · 椒盐土豆（次数）", varPath: "cookok_jytd", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_bcdjp", name: "菜品 · 白菜炖鸡脯（次数）", varPath: "cookok_bcdjp", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_tdcrp", name: "菜品 · 土豆炒肉片（次数）", varPath: "cookok_tdcrp", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_gbjd", name: "菜品 · 宫保鸡丁（次数）", varPath: "cookok_gbjd", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_qcbc", name: "菜品 · 清炒白菜（次数）", varPath: "cookok_qcbc", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_zccp", name: "菜品 · 自创菜品（次数）", varPath: "cookok_zccp", type: "number", min: 0, max: 99 },
				{ key: "cat_clean_home", name: "清洁 · 出租屋（0-40）", varPath: "pcHome_clean", type: "number", min: 0, max: 40,
				  note: "模组源码自身 Math.clamp 0-40（面板不钳制，写超由模组源码处理）；顶层标量直写（租屋初始化时模组写入 30），无宿主缺失" },
				{ key: "cat_clean_front", name: "清洁 · 门口（0-3）", varPath: "pcEntranceFront_clean", type: "number", min: 0, max: 3 },
				{ key: "cat_clean_after", name: "清洁 · 后院（0-3）", varPath: "pcEntranceAfter_clean", type: "number", min: 0, max: 3 },
				{ key: "cat_drawing", name: "绘画 · 进度（0-100）", varPath: "pchouse_drawing", type: "number", min: 0, max: 100 },
				{ key: "cat_toubi", name: "投币 · 硬币数", varPath: "pctoubi", type: "number", min: 0, max: 999 },
				{ key: "cat_time", name: "猫咖 · 累计经营时间", varPath: "cattery_time", type: "number", min: 0, max: 99999 },
				{ key: "cat_cook_time", name: "猫咖 · 烹饪时间", varPath: "cattery_cook_time", type: "number", min: 0, max: 99999 }
			]
		}
	};


