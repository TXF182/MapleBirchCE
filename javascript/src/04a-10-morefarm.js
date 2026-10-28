	/* 适配器：More Farm Upgrade（DOL-More-Farm-Upgrade-Mod v1.0.8，Qsx0391）
	   功能（boot.json TweeReplacer 注入原版农场 + 源码实证）：新增 11 项设施升级
	   （耕地机/播种机/收割机/施工机械/温室大棚/实验室/冷藏库/堆肥/农舍/坦克/地下室），
	   设施等级由 new_farm_build_day widget 竣工写入（cultivator/seeder/harvester 用 ++ 逐级升，
	   其余直接置 1；field_greenhouse 1-9 级逐块田置 greenhouse=true）；
	   配套资源：堆肥（compost_timer 7 天 1 袋 fertiliser_stored）、实验室（flowers_stored→phials_stored，
	   still_timer 实验室 1 天）、冷库（stock 松露/蛋/奶/奶油 ×1.25）、农夫（farmer/farmer_unpaid/farmer_wage/
	   farmer_skill/farmer_patience/farmer_can_hire + farmerSellTimer/farmersProduce 农贸 + 5 许可
	   （farmerCanWater/farmerCanTill/farmerCanPlant/farmerCanHarvest/farmerCanSell）。
	   键集：设施 11（values）+ 资源 5 + 农夫 5 + 温室 9（abilities 布尔）+ 在岗/可雇/许可 7（abilities）。 */
	CHEAT_ADAPTERS["more-farm-upgrade"] = {
		detect: function () {
			try {
				var v = getV();
				if (!v || !v.farm) { return false; }
				return !!(
					v.farm.compost !== undefined || v.farm.cultivator !== undefined ||
					v.farm.seeder !== undefined || v.farm.harvester !== undefined ||
					v.farm.laboratory !== undefined || v.farm.cold_store !== undefined ||
					v.farm.farmhouse !== undefined || v.farm.tank !== undefined ||
					v.farm.basement !== undefined || v.farm.construction_machinery !== undefined ||
					v.farm.field_greenhouse !== undefined || v.farm.farmer_can_hire !== undefined ||
					v.flowers_stored !== undefined || v.phials_stored !== undefined ||
					v.fertiliser_stored !== undefined || v.compost_timer !== undefined ||
					v.farmerSellTimer !== undefined
				);
			} catch (e) { return false; }
		},
		entry: {
			modId: "more-farm-upgrade",
			modName: "更多农场升级 More Farm Upgrade v1.0.8（农场 11 项新设施/资源/农夫）",
			tasks: [],
			stages: [],
			abilities: [
				/* 温室逐田覆盖：模组判定 _plantbed.greenhouse is true（严格布尔），竣工时
				   $plots.farm[$farm.field_greenhouse-1].greenhouse = true（第 N 级盖第 N 块田）；
				   作弊需同时写 field_greenhouse 等级数值 + 勾选对应田块 */
				{ key: "mf_gh1", name: "温室 · 田 1 覆盖", varPath: "plots.farm.0.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 1 级温室盖第 1 块田（new_farm_build_day 实证）；田块须已开垦（plots.farm[0] 对象存在，父缺失时面板会提示需先推进农场初始化）" },
				{ key: "mf_gh2", name: "温室 · 田 2 覆盖", varPath: "plots.farm.1.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 2 级温室盖第 2 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh3", name: "温室 · 田 3 覆盖", varPath: "plots.farm.2.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 3 级温室盖第 3 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh4", name: "温室 · 田 4 覆盖", varPath: "plots.farm.3.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 4 级温室盖第 4 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh5", name: "温室 · 田 5 覆盖", varPath: "plots.farm.4.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 5 级温室盖第 5 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh6", name: "温室 · 田 6 覆盖", varPath: "plots.farm.5.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 6 级温室盖第 6 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh7", name: "温室 · 田 7 覆盖", varPath: "plots.farm.6.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 7 级温室盖第 7 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh8", name: "温室 · 田 8 覆盖", varPath: "plots.farm.7.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 8 级温室盖第 8 块田（new_farm_build_day 实证）" },
				{ key: "mf_gh9", name: "温室 · 田 9 覆盖", varPath: "plots.farm.8.greenhouse",
				  note: "模组判定 is true（严格布尔），必须布尔通道；第 9 级温室盖第 9 块田（new_farm_build_day 实证）" },
				{ key: "mf_farmer_active", name: "农夫 · 在岗（雇佣状态）", varPath: "farm.farmer", numeric: true, min: 0, max: 1,
				  sync: { set: [
					{ path: "farm.farmer_can_hire", value: true, if: { max: 0 } },
					/* 雇佣链联动（PubFarmer.twee:128-138 实证）：写 1=雇佣自动补 浇水/耕地/播种许可 true + 收获/售货许可 false +
					   售货周期 7 + 可种清单 []；写 0=辞退补 can_hire（不触发许可链，if.min:1 门控）；ifMissing 不覆盖玩家已有配置。
					   farmerPlantable 必须补：getPlantableList() 对 V.farmerPlantable.forEach 无条件执行（FarmerEvents.js:153），
					   undefined 时 farmerTendingDay 每日事件一运行即 TypeError 崩 */
					{ path: "farmerCanWater", value: true, ifMissing: true, if: { min: 1 } },
					{ path: "farmerCanTill", value: true, ifMissing: true, if: { min: 1 } },
					{ path: "farmerCanPlant", value: true, ifMissing: true, if: { min: 1 } },
					{ path: "farmerCanHarvest", value: false, ifMissing: true, if: { min: 1 } },
					{ path: "farmerCanSell", value: false, ifMissing: true, if: { min: 1 } },
					{ path: "farmerSellTimer", value: 7, ifMissing: true, if: { min: 1 } },
					{ path: "farmerPlantable", value: [], ifMissing: true, if: { min: 1 } }
				  ] },
				  note: "模组判定 truthy 即在岗（farmerTendingDay 每日自动浇水/耕地/播种/收获 8 小时）；勾选写 1（名字占位 number 1，只做 truthy 判定实证安全）+ 自动补雇佣链（5 许可 + 售货周期 + 可种清单，见下方开关）、取消写 0=辞退并补 can_hire=1 可再雇（PubFarmer 雇佣链实证）；真实 NPC 雇佣走 Pub 事件，作弊仅状态模拟" },
				{ key: "mf_hire_ok", name: "农夫 · 可雇佣许可", varPath: "farm.farmer_can_hire",
				  note: "农舍竣工时置 true（new_farm_build_day 实证）；Pub 雇佣入口判定 farmhouse≥1 且 !farmer 且 can_hire；雇佣后不重置（farmer 有值即挡入口），可常开" },
				/* 农夫自动干活许可（FarmerEvents.js farmerTendingDay/farmerSell 实证：五个许可缺一即跳过对应动作）——
				   作弊雇农夫若不同步开许可，农夫在岗但什么都不干；雇佣链默认：浇水/耕地/播种开、收获/售货关 */
				{ key: "mf_can_water", name: "农夫 · 浇水许可", varPath: "farmerCanWater",
				  note: "雇佣链默认 true（PubFarmer.twee:132）；true 时每日给水=0 的成长中田浇水（FarmerEvents.js:14）" },
				{ key: "mf_can_till", name: "农夫 · 耕地许可", varPath: "farmerCanTill",
				  note: "雇佣链默认 true（PubFarmer.twee:133）；true 时每日耕地（温室需耕地机 2 级才快，FarmerEvents.js:26-29）" },
				{ key: "mf_can_plant", name: "农夫 · 播种许可", varPath: "farmerCanPlant",
				  note: "雇佣链默认 true（PubFarmer.twee:134）；true 时每日播种（温室需播种机 2 级才快，FarmerEvents.js:40-44）" },
				{ key: "mf_can_harvest", name: "农夫 · 收获许可", varPath: "farmerCanHarvest",
				  note: "雇佣链默认 false（PubFarmer.twee:135）；true 时每日自动收割成熟作物（FarmerEvents.js:63）" },
				{ key: "mf_can_sell", name: "农夫 · 自动售货许可", varPath: "farmerCanSell",
				  note: "雇佣链默认 false（PubFarmer.twee:136）；true 时售货周期归 0 卖库存≥250 产物进 $farmersProduce（FarmerEvents.js:108-112）；与下方售货计时配套" }
			],
			scenes: [],
			values: [
				/* 设施等级：模组竣工写入语义（作弊直写等价秒建；greenhouse 需配套勾选田块） */
				{ key: "mf_cultivator", name: "设施 · 耕地机（0-2）", varPath: "farm.cultivator", type: "number", min: 0, max: 2,
				  note: "1=普通（缩短耕地时间）；2=量子耕地机温室可用（FarmCultivator/NewFarmUpgradesWidgets 实证 gte 2 判定）；模组竣工走 ++（new_farm_build_day:300-302），已写满值后再触发建造竣工会越界到 3（判定 gte 2 不受影响，仅显示越界）" },
				{ key: "mf_seeder", name: "设施 · 播种机（0-2）", varPath: "farm.seeder", type: "number", min: 0, max: 2,
				  note: "1=普通（缩短播种时间）；2=念力播种机温室可用；模组竣工走 ++，写满后再触发建造竣工会越界（判定 gte 2 不受影响，仅显示）" },
				{ key: "mf_harvester", name: "设施 · 收割机（0-3）", varPath: "farm.harvester", type: "number", min: 0, max: 3,
				  note: "1=普通（缩短收获时间）；2=空间收割机温室可用；3=智能监控——收获量改为 tending/2+random(10,50) 稳定高产（FarmHarvester.twee:59 + boot.json ReplacePatcher 实证）；模组竣工走 ++，写满后再触发建造竣工会越界到 4（判定 gte 3 不受影响，仅显示）" },
				{ key: "mf_machinery", name: "设施 · 施工机械（0-1）", varPath: "farm.construction_machinery", type: "number", min: 0, max: 1,
				  note: "缩短所有农场设施建造/升级时间（BuildTimeUtils calc_build_time 实证）" },
				{ key: "mf_greenhouse", name: "设施 · 温室大棚（0-9）", varPath: "farm.field_greenhouse", type: "number", min: 0, max: 9,
				  note: "突破季节限制；1-9 级逐级对应田块覆盖——须同步勾选下方「温室 · 田 N 覆盖」能力（模组竣工写 $plots.farm[N-1].greenhouse=true），只写等级不勾田则田不生效" },
				{ key: "mf_laboratory", name: "设施 · 实验室（0-1）", varPath: "farm.laboratory", type: "number", min: 0, max: 1,
				  sync: { set: [
					{ path: "farm.still_timer", value: 1, ifMissing: true, if: { min: 1 } }
				  ] },
				  note: "利用诡异花制作催情剂（$flowers_stored→$phials_stored，蒸馏计时缩为 1 天）；原版蒸馏区入口判定 farm.laboratory≥1（boot.json Farm Still 注入实证）；直写建实验室自动补蒸馏计时 1 天（ifMissing 不覆盖已有蒸馏进度；模组自身有页面级 FarmLaboratory.twee:20 + boot.json patch 兜底，CE 预置 1 为双保险立即启动蒸馏）" },
				{ key: "mf_coldstore", name: "设施 · 冷藏库（0-1）", varPath: "farm.cold_store", type: "number", min: 0, max: 1,
				  note: "库存检查改走 Farm Cold Stock 可任意取出；每日 stock 松露/蛋/奶/奶油 ×1.25 增涨（NewFarmEvents.js:19-24 实证）" },
				{ key: "mf_compost", name: "设施 · 堆肥设施（0-1）", varPath: "farm.compost", type: "number", min: 0, max: 1,
				  sync: { set: [
					{ path: "compost_timer", value: 7, ifMissing: true, if: { min: 1 } },
					{ path: "fertiliser_stored", value: 0, ifMissing: true, if: { min: 1 } }
				  ] },
				  note: "每周自动产 1 袋肥料（compost_timer 7→0 时 fertiliser_stored++）；竣工时 fertiliser_stored=0、compost_timer=7（new_farm_build_day:324-325 实证）；直写建堆肥自动补周期 7 天（ifMissing 不覆盖已有肥料/进度；compost 段模组无兜底，不补则每日事件 --undefined=NaN 卡死不产肥）" },
				{ key: "mf_farmhouse", name: "设施 · 农舍（0-1）", varPath: "farm.farmhouse", type: "number", min: 0, max: 1,
				  note: "允许雇佣农夫；竣工时 farmer_can_hire=true（可勾选下方能力或直接写）" },
				{ key: "mf_tank", name: "设施 · 坦克（0-1）", varPath: "farm.tank", type: "number", min: 0, max: 1,
				  note: "农场袭击（Farm Assault）获得坦克驾驶选项：主炮火力支援/装甲威慑（boot.json 多段注入实证）；战斗内 $isInTank 瞬态标记不作弊" },
				{ key: "mf_basement", name: "设施 · 地下室（0-1）", varPath: "farm.basement", type: "number", min: 0, max: 1,
				  note: "小屋地下室扩建，安装性爱机器（FarmSexMachine 实证）" },
				/* 资源 */
				{ key: "mf_flowers", name: "资源 · 诡异花储量", varPath: "flowers_stored", type: "number", min: 0, max: 99999,
				  note: "实验室原料（存 1000 朵=1 瓶催情剂；蒸馏消耗 1000）；可从食物库存 $foodstuff.strange_flower 转入（put_strange_flowers widget 实证）" },
				{ key: "mf_phials", name: "资源 · 催情剂药瓶", varPath: "phials_stored", type: "number", min: 0, max: 999,
				  note: "实验室/蒸馏产出（NewFarmEvents.js:34 实证：still_timer 归零时消费 1000 花或 1 潜伏者 → phials_stored++）" },
				{ key: "mf_fertiliser", name: "资源 · 肥料袋", varPath: "fertiliser_stored", type: "number", min: 0, max: 999,
				  note: "堆肥产出，取走转 $fertiliser.current（FarmCompost Take 实证）" },
				{ key: "mf_compost_timer", name: "资源 · 堆肥周期计时（0-7）", varPath: "compost_timer", type: "number", min: 0, max: 7,
				  note: "每日 -1，归 0 产 1 袋肥并重置 7" },
				{ key: "mf_still_timer", name: "资源 · 蒸馏计时（0-7）", varPath: "farm.still_timer", type: "number", min: 0, max: 7,
				  note: "实验室≥1 时蒸馏 1 天（boot.json Farm Still Cage 注入实证），否则原版 7 天" },
				/* 农夫 */
				{ key: "mf_farmer_unpaid", name: "农夫 · 欠薪天数", varPath: "farm.farmer_unpaid", type: "number", min: 0, max: 999,
				  note: "每周一 +1、耐心归 0；欠薪 2 天触发催薪（farmer_pay_request，boot.json 注入实证）；周薪结账时按欠薪日补技能" },
				{ key: "mf_farmer_patience", name: "农夫 · 耐心（0-1）", varPath: "farm.farmer_patience", type: "number", min: 0, max: 1,
				  note: "每周一归 0（NewFarmEvents.js:9 实证）；安抚后置 1（FarmFarmer.twee:316）；boot.json:54 判定 isnot 1 触发催薪线——写 1 免催薪，写 0 立即进入催薪剧情" },
				{ key: "mf_farmer_wage", name: "农夫 · 周薪", varPath: "farm.farmer_wage", type: "number", min: 0, max: 9999999,
				  note: "雇佣时 30000+tending*100，tending≥500 再加 20000（PubFarmer.twee:374-376 实证）；写低可降开销" },
				{ key: "mf_farmer_skill", name: "农夫 · 耕作技能（tending）", varPath: "farm.farmer_skill", type: "number", min: 0, max: 9999,
				  note: "决定自动干活的耕作/收获效率（calcTillingTime=360-skill*0.3、收获量 tending/2+50 区间，FarmerEvents.js 实证）；结账时按欠薪补技能" },
				{ key: "mf_sell_timer", name: "农夫 · 自动售货计时（0-7）", varPath: "farmerSellTimer", type: "number", min: 0, max: 7,
				  note: "每日 -1，归 0 触发 farmerSell 卖库存≥250 的产物（蔬菜/水果/蘑菇/蛋/奶/松露），售出进 $farmersProduce（农贸对象结构复杂，不作弊直接写）；需「自动售货许可」为 true 才生效（FarmerEvents.js:108-109 实证）；写 0 立即触发" }
			]
		}
	};
