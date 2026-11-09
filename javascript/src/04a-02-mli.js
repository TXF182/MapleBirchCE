/* 职责：MLI（more_love_interests）适配器声明 */
	CHEAT_ADAPTERS["more_love_interests"] = {
		detect: function () {
			return !!(setup && setup.foodPreference && typeof setup.foodPreference === "object");
		},
		entry: {
			modId: "more_love_interests",
			modName: "More Love Interests Mod 0.1.8.0",
			tasks: [],
			stages: [],
			abilities: [],
			scenes: [],
			values: [
				{
					key: "loveInterestList",
					name: "恋人列表（模组扩容版）",
					varPath: "loveInterestList",
					type: "list",
					options: ["Robin", "Whitney", "Kylar", "Eden", "Avery", "Sydney", "Alex", "Black Wolf", "Great Hawk", "Gwylan", "Remy"],
					/* v2.0.12 适配深度补测（mli0180 源码逐行取证）：
					   ① 这是**唯一生效**的恋人入口。11 个 $loveInterest.<槽位>（primary..undecimal）全是本数组的派生态——
					      more_love_interest_main.twee:173-185 的 moreLoveInterestConfirm 每次交互都从 $loveInterestList[0..10]
					      反向覆盖全部槽位，单独写槽位会被立刻覆盖 → 不做入口（避免"面板显示写入成功、实机无效"）。
					   ② 写入后会被模组自身条件剪裁（main.twee:164-172）：Black Wolf 需 hasSexStat("deviancy",3)、
					      Avery 需 $auriga_artefact 且 C.npc.Avery.state isnot "dismissed"、Remy 需装 Remy Love Mod。
					      这是模组的防误置保护，不是 CE 缺陷：面板写入后若条件不满足，下次交互会被移除。 */
					note: "上限 11 位；槽位为派生不设入口；Black Wolf/Avery/Remy 受模组条件剪裁"
				},
				{
					key: "mate_for_life_debuff",
					name: "终生伴侣 Debuff（换恋人掉精神）",
					/* main.twee:98 `<<checkbox "$options.mateForLifeDebuff" false true autocheck>>` 默认 false；
					   box.twee:39/80 `<<if $transformationParts.traits.mateForLife isnot "disabled" and $options.mateForLifeDebuff>>`
					   → 真值判定，写 1 即开启（换恋人按终生伴侣特质加压力/创伤）。$options 由本体初始化，
					   若该对象缺失，写入器按"父链缺失"优雅拒绝（不会凭空造 $options）。 */
					varPath: "options.mateForLifeDebuff",
					type: "boolean",
					note: "1=开启（换恋人掉精神）/0=关闭；真值判定"
				},
				{
					key: "drag_mode",
					name: "恋人列表操作模式（1=拖拽 / 0=选项）",
					/* main.twee:107-116 `<<link `$dragMode ? '拖拽模式' : '选项模式'`>>`、box.twee:9/63 `<<if $dragMode>>` → 真值判定；
					   undefined 视为选项模式（默认）。 */
					varPath: "dragMode",
					type: "boolean",
					note: "1=拖拽模式 / 0=选项模式（默认 undefined）"
				}
			]
		}
	};

	/* 内置适配器：DomRobin 0.0.8-for-dol-0.5.12.13（罗宾大型增强模组，2026-10-15 解压探查实证）
	   探测键：window.modUtils.getMod("DomRobin")（ModLoader 已加载模组注册表，boot.json name=DomRobin）。
	   边界隔离：DomRobin 大量复用 DoL 原版罗宾线变量（robinpaid/renttime_fight/robinShouldPayBack/
	   lemonadeUpgraded/chocolateUpgraded/robinPayBothNote/robinCouldPayBoth/robinSoldConsole 等），
	   适配器一律不声明；只暴露模组自建键（均见源码赋值/初始化）：
	   $liveStreamStage 直播周数 0-6（作者在言灵提示中明示可改）、$robinFightChain 反抗链打赢次数
	   （≥3 解锁共同战斗）、$lemonadeNewGoodsList 柠檬水摊新商品列表
	   （popcorn/snack/balloon/flower，gameStartOnly.txt 初始化 []），
	   以及一批 boolean 进度标记（战斗谈话/共同战斗/还债谈话/花环/直播准备/一起直播/4 项还钱进度）。 */
