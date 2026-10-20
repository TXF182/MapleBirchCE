	CHEAT_ADAPTERS["revelation-the-book-of-return"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }
				return !!(window.maplebirch.get("RobinTemple") || window.maplebirch.get("TempleChoir"));
			} catch (e) { return false; }
		},
		entry: {
			modId: "revelation-the-book-of-return",
			modName: "默示录：归途之书 v1.3.8",
			tasks: [],
			stages: [
				{ key: "rt_stage", name: "罗宾神殿 · 路线阶段", varPath: "RobinTemple.stage",
				  levels: ["none", "invited", "scheduled", "failed", "member", "approved", "promised"],
				  labels: ["未开始", "受邀", "已预约", "失败", "成员", "已批准", "已承诺"] },
				{ key: "rt_secret_stage", name: "秘密誓言 · 调查阶段", varPath: "RobinTemple.secret.stage",
				  levels: ["none", "research", "travelling", "decision", "ritual", "complete"],
				  labels: ["未开始", "调查", "旅行", "抉择", "仪式", "完成"] },
				{ key: "rt_rite_stage", name: "秘密誓言 · 亵渎仪式阶段", varPath: "RobinTemple.secret.rite_stage",
				  levels: [0, 1, 2, 3, 4, 5, 6, 7],
				  labels: ["未开始", "下沉", "触手", "致幻", "同席", "再下潜", "合唱", "收束"] },
				{ key: "rt_vigil", name: "罗宾神殿 · 守夜结果", varPath: "RobinTemple.vigil_result",
				  levels: ["", "passed", "failed"],
				  labels: ["未守夜", "通过", "失败"] },
				{ key: "rt_faith_band", name: "罗宾神殿 · 信仰带", varPath: "RobinTemple.faith_band",
				  levels: ["steady", "belief", "doubt"],
				  labels: ["平稳", "信靠", "动摇"] },
				{ key: "rt_hospital", name: "罗宾神殿 · 医院阶段", varPath: "RobinTemple.hospital_stage",
				  levels: ["", "waiting", "discharged", "therapy", "rescue", "vanilla"],
				  labels: ["无", "等待中", "已出院", "治疗中", "已救援", "原版流程"] },
				{ key: "rt_secret_followup", name: "秘密誓言 · 后日谈阶段", varPath: "RobinTemple.secret.followup",
				  levels: ["none", "meal", "records", "complete", "declined"],
				  labels: ["无", "共餐", "查档", "完成", "婉拒"] },
				{ key: "rt_night_scene", name: "罗宾神殿 · 夜访场景", varPath: "RobinTemple.night_scene",
				  levels: ["", "rain", "voice", "blanket", "embers", "ledger"],
				  labels: ["无", "雨夜", "呼唤", "盖毯", "余烬", "账本"] },
				{ key: "rt_transformation", name: "罗宾神殿 · 变身形态", varPath: "RobinTemple.transformation_kind",
				  levels: ["", "fox", "wolf", "cat", "bird", "cow", "horse", "whale", "raven"],
				  labels: ["无", "狐", "狼", "猫", "鸟", "牛", "马", "鲸", "鸦"] },
				{ key: "ll_vow", name: "迷途羔羊 · 誓约状态", varPath: "LostLamb.talkVow",
				  levels: ["", "offered", "refused", "sealed", "broken"],
				  labels: ["无", "已提出", "已拒绝", "已封印", "已破碎"] },
				{ key: "ll_ending", name: "迷途羔羊 · 梦境结局", varPath: "LostLamb.ending",
				  levels: ["", "main", "stay", "verdict"],
				  labels: ["无", "主线结局", "留守结局", "审判结局"] },
				{ key: "td_oath", name: "神殿值勤 · 誓言", varPath: "TempleDuties.oath",
				  levels: ["", "care", "obedience"],
				  labels: ["无誓言", "照护誓言", "服从誓言"] },
				{ key: "td_bishop", name: "神殿值勤 · 主教进展", varPath: "TempleDuties.bishop",
				  levels: ["none", "invited", "accepted", "refused", "reported"],
				  labels: ["无", "已邀请", "已接受", "已拒绝", "已上报"] },
				{ key: "td_manor", name: "神殿值勤 · 庄园线", varPath: "TempleDuties.manor",
				  levels: ["none", "accepted", "declined", "copied", "complete"],
				  labels: ["无", "已接受", "已婉拒", "已抄录", "已完成"] },
				{ key: "td_declaration", name: "神殿值勤 · 宣言方式", varPath: "TempleDuties.declaration",
				  levels: ["private", "scar"],
				  labels: ["私下", "伤疤"] },
				{ key: "td_watch", name: "神殿值勤 · 守夜阶段", varPath: "TempleDuties.watch.phase",
				  levels: ["threshold", "roots", "voices", "shadow", "seal", "passed", "failed"],
				  labels: ["门槛", "根源", "声音", "阴影", "封印", "已通过", "已失败"] },
				{ key: "td_case", name: "神殿值勤 · 案件阶段", varPath: "TempleDuties.case.stage",
				  levels: ["field", "combat", "report"],
				  labels: ["现场", "战斗", "汇报"] }
			],
			abilities: [
				{ key: "tc_joined", name: "唱诗班 · 已入团", varPath: "TempleChoir.joined", type: "boolean",
				  note: "判定：唱诗班入团事件后为 true；勾选直接入团，跳过考核剧情" },
				{ key: "tc_lead", name: "唱诗班 · 领唱资格", varPath: "TempleChoir.lead", type: "boolean" },
				{ key: "rt_pendant", name: "罗宾神殿 · 携带挂坠", varPath: "RobinTemple.pendant", type: "boolean",
				  note: "判定：获得罗宾神殿挂坠后为 true；勾选视为已携带，挂坠相关剧情选项可触发" },
				{ key: "rt_dual", name: "罗宾神殿 · 第二份誓约", varPath: "RobinTemple.dual_promise", type: "boolean" },
				{ key: "rt_assess", name: "罗宾神殿 · 评估通过", varPath: "RobinTemple.assessment_passed", type: "boolean" },
				{ key: "rt_clasp", name: "罗宾神殿 · 圣带装备", varPath: "RobinTemple.clasp_equipped", type: "boolean" },
				{ key: "rt_hospital_support", name: "罗宾神殿 · 医院陪伴", varPath: "RobinTemple.hospital_support", type: "boolean" },
				{ key: "rt_assess_fire", name: "罗宾神殿 · 评估之火", varPath: "RobinTemple.assessment_fire", type: "boolean" },
				{ key: "rt_vigil_attending", name: "罗宾神殿 · 守夜进行中", varPath: "RobinTemple.vigil_attending", type: "boolean" },
				{ key: "rt_vigil_with_robin", name: "罗宾神殿 · 与罗宾同守夜", varPath: "RobinTemple.vigil_with_robin", type: "boolean" },
				{ key: "rt_abandoned", name: "罗宾神殿 · 已放弃路线", varPath: "RobinTemple.abandoned", type: "boolean" },
				{ key: "rt_rite_done", name: "秘密誓言 · 仪式已完成", varPath: "RobinTemple.secret.rite_done", type: "boolean" },
				{ key: "ll_recalled", name: "迷途羔羊 · 已回想起童年", varPath: "LostLamb.recalled", type: "boolean" },
				{ key: "ll_active", name: "迷途羔羊 · 梦境进行中", varPath: "LostLamb.active", type: "boolean" },
				{ key: "ll_known_bishop", name: "迷途羔羊 · 已知主教秘密", varPath: "LostLamb.known.bishop", type: "boolean" },
				{ key: "ll_known_gwylan", name: "迷途羔羊 · 已知格威岚秘密", varPath: "LostLamb.known.gwylan", type: "boolean" },
				{ key: "ll_known_auriga", name: "迷途羔羊 · 已知御夫座秘密", varPath: "LostLamb.known.auriga", type: "boolean" },
				{ key: "td_enrolled", name: "神殿值勤 · 已加入值勤", varPath: "TempleDuties.enrolled", type: "boolean" },
				{ key: "td_review", name: "神殿值勤 · 待审查", varPath: "TempleDuties.review", type: "boolean" },
				{ key: "td_robin_agree", name: "神殿值勤 · 罗宾候选同意", varPath: "TempleDuties.candidates.Robin.agreed", type: "boolean" },
				{ key: "td_sydney_agree", name: "神殿值勤 · 悉尼候选同意", varPath: "TempleDuties.candidates.Sydney.agreed", type: "boolean" }
			],
			scenes: [
				{ key: "rt_prayer", name: "罗宾神殿 · 祷告事件", skipVar: "RobinTemple.prayer_event_resolved", completeVar: "RobinTemple.prayer_event_done", progressVar: "RobinTemple.prayer_event", resetValue: 0 }
			],
			values: [
				{ key: "tc_singing", name: "唱诗班 · 歌唱熟练度", varPath: "TempleChoir.singing", type: "number", min: 0, max: 1000 },
				{ key: "tc_services", name: "唱诗班 · 出席弥撒次数", varPath: "TempleChoir.services", type: "number", min: 0, max: 999 },
				{ key: "tc_practices", name: "唱诗班 · 练习次数", varPath: "TempleChoir.practices", type: "number", min: 0, max: 999 },
				{ key: "tc_bonus", name: "唱诗班 · 待领津贴(便士)", varPath: "TempleChoir.bonus", type: "number", min: 0, max: 100000 },
				{ key: "rt_service", name: "罗宾神殿 · 服务贡献", varPath: "RobinTemple.service", type: "number", min: 0, max: 100 },
				{ key: "rt_grace", name: "罗宾神殿 · 恩典", varPath: "RobinTemple.grace", type: "number", min: 0, max: 100 },
				{ key: "rt_chastity", name: "罗宾神殿 · 守贞计时", varPath: "RobinTemple.chastity_timer", type: "number", min: 0, max: 30 },
				{ key: "rt_assess_bonus", name: "罗宾神殿 · 评估加分", varPath: "RobinTemple.assessment_bonus", type: "number", min: 0, max: 15 },
				{ key: "rt_rite_round", name: "秘密誓言 · 同席连续次数", varPath: "RobinTemple.secret.rite_round", type: "number", min: 0, max: 99 },
				{ key: "rt_intimacy_count", name: "罗宾神殿 · 亲密累计次数", varPath: "RobinTemple.intimacy_count", type: "number", min: 0, max: 999 },
				{ key: "rt_evaluation_marks", name: "罗宾神殿 · 评估分数", varPath: "RobinTemple.evaluation_marks", type: "number", min: 0, max: 100 },
				{ key: "ll_doubt", name: "迷途羔羊 · 疑虑", varPath: "LostLamb.doubt", type: "number", min: 0, max: 100 },
				{ key: "ll_fear", name: "迷途羔羊 · 恐惧", varPath: "LostLamb.fear", type: "number", min: 0, max: 100 },
				{ key: "ll_notice", name: "迷途羔羊 · 觉察", varPath: "LostLamb.notice", type: "number", min: 0, max: 100 },
				{ key: "td_duties", name: "神殿值勤 · 值勤次数", varPath: "TempleDuties.duties", type: "number", min: 0, max: 999 },
				{ key: "td_roof", name: "神殿值勤 · 屋顶修复进度", varPath: "TempleDuties.archive.roof", type: "number", min: -1, max: 99 },
				{ key: "td_shelves", name: "神殿值勤 · 书架整理进度", varPath: "TempleDuties.archive.shelves", type: "number", min: -1, max: 99 },
				{ key: "td_sorted", name: "神殿值勤 · 归档次数", varPath: "TempleDuties.archive.sorted", type: "number", min: 0, max: 999 }
			]
		}
	};

	/* 内置适配器：More Love Interests Mod 0.1.7.0（用户已装 mli_mod_patched.zip，2026-10-15 探查实证）
	   探测键：setup.foodPreference（模组 foodPreference.js 无条件注入的 setup 键，模组卸载即消失）。
	   可操控面（已实证模组源码）：$loveInterestList = 扩容恋人列表（字符串数组，模组主交互对象，
	   moreLoveInterestConfirm 会按模组条件自动剔除 Remy/Black Wolf/Avery）；
	   $loveInterest.primary..undecimal 由模组 widget 从列表自动重建，面板不直接写（避免被重建覆盖）。 */
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
					options: ["Robin", "Whitney", "Kylar", "Eden", "Avery", "Sydney", "Alex", "Black Wolf", "Great Hawk", "Gwylan", "Remy"]
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
	   （≥3 解锁共同战斗）、$liveStream 直播开关 0/1、$lemonadeNewGoodsList 柠檬水摊新商品列表
	   （popcorn/snack/balloon/flower，gameStartOnly.txt 初始化 []），
	   以及一批 boolean 进度标记（战斗谈话/共同战斗/还债谈话/花环/直播准备/一起直播/4 项还钱进度）。 */
	CHEAT_ADAPTERS["dom_robin"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.modUtils || typeof window.modUtils.getMod !== "function") { return false; }
				return !!window.modUtils.getMod("DomRobin");
			} catch (e) { return false; }
		},
		entry: {
			modId: "dom_robin",
			modName: "DomRobin 0.0.8（罗宾大型增强）",
			tasks: [],
			stages: [
				{ key: "ls_stage", name: "直播 · 周数阶段", varPath: "liveStreamStage",
				  levels: [0, 1, 2, 3, 4, 5, 6],
				  labels: ["初始", "第 1 周", "第 2 周", "第 3 周", "第 4 周", "第 5 周", "第 6 周（最高）"] }
			],
			abilities: [
				{ key: "rf_talked", name: "反抗战斗 · 已谈话", varPath: "robinFightTalked", type: "boolean" },
				{ key: "rf_together", name: "反抗战斗 · 共同战斗完成", varPath: "robinFightTogether", type: "boolean" },
				{ key: "rp_both", name: "还债线 · 共同还债谈话", varPath: "robinPayBothTalked", type: "boolean" },
				{ key: "rp_self", name: "还债线 · 自还债谈话", varPath: "robinPaySelfTalked", type: "boolean" },
				{ key: "fc_talked", name: "柠檬摊 · 花环谈话", varPath: "flowerCrownTalked", type: "boolean" },
				{ key: "ls_agree", name: "直播 · 同意准备直播", varPath: "liveStreamAgreePrepare", type: "boolean" },
				{ key: "ls_talked", name: "直播 · 谈过一起直播", varPath: "liveStreamTogetherTalked", type: "boolean" },
				{ key: "ls_together", name: "直播 · 一起直播", varPath: "liveStreamTogether", type: "boolean" },
				{ key: "pb_lemon", name: "还钱进度 · 柠檬水摊", varPath: "lemonadeShouldPayBack", type: "boolean" },
				{ key: "pb_live", name: "还钱进度 · 直播设备", varPath: "liveStreamShouldPayBack", type: "boolean" },
				{ key: "pb_choc", name: "还钱进度 · 巧克力摊升级", varPath: "chocolateUpgradeShouldPayBack", type: "boolean" },
				{ key: "pb_choc2", name: "还钱进度 · 巧克力摊改造", varPath: "chocolateReformShouldPayBack", type: "boolean" }
			],
			scenes: [],
			values: [
				{ key: "rf_chain", name: "反抗链 · 打赢次数（≥3 解锁共同战斗）", varPath: "robinFightChain", type: "number", min: 0, max: 99 },
				{ key: "ls_on", name: "直播 · 开启（0 关 / 1 开）", varPath: "liveStream", type: "number", min: 0, max: 1 },
				{ key: "goods_list", name: "柠檬水摊 · 新商品", varPath: "lemonadeNewGoodsList", type: "list", options: ["popcorn", "snack", "balloon", "flower"] }
			]
		}
	};

	/* 内置适配器：枯木逢春 · Deadwood Reblooms 2.2.7（2026-10-18 与 2.2.0 逐文件对比实证，作者楓樺葉）
	   探测键：window.maplebirch.get("DeadwoodReblooms")（框架根模块，main.ts 注册，关闭即停用全部子模块）。
	   2.2.0→2.2.7 差异实证：20 模块 define 全同、V 键名不变（各模块类 super 构造 name 逐一实证）；
	   constants 仅 bird-tower.ts 注释一字之差（无实质）、vanilla-plus.ts 结构迁移
	   （beauty:{alluring} 清空为 {}、新增 attitudes:{ironWill,sadomasochist} 特质）——
	   原声明路径全部仍有效，新增能力 2 项 attitudes.*。
	   状态键（Module.ts 通用机制：preInit 挂 :variable 钩子 → V[模块名] ??= {} + migration fill 默认值）：
	   人物模块 V.RobinExpansion / V.SydneyExpansion / V.WhitneyExpansion / V.KylarExpansion，
	   系统模块 V.LifeSimulation / V.StreetLife / V.BirdTower / V.Finance / V.Transport / V.Orchard /
	   V.VanillaPlus / V.CelestialAnomalies（各模块类 super 构造 name 逐一实证）。
	   边界隔离：模组从不读写原版顶层 V.rebellion/V.victories/V.self_rent/V.both_rent/V.rent_separated
	   （全量 grep 实证），适配器也不声明原版复用键；只暴露模组自建字段。 */
	CHEAT_ADAPTERS["deadwood-reblooms"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }
				return !!window.maplebirch.get("DeadwoodReblooms");
			} catch (e) { return false; }
		},
		entry: {
			modId: "deadwood-reblooms",
			modName: "枯木逢春 · Deadwood Reblooms 2.4.2",
			tasks: [],
			stages: [
				{ key: "r_shop_stage", name: "罗宾 · 店铺开办阶段", varPath: "RobinExpansion.shop_stage",
				  levels: ["none", "planning", "applied", "site", "inspected", "permitted"],
				  labels: ["未开始", "筹备", "已申请", "选址", "已验收", "已许可"] },
				{ key: "r_balloon", name: "罗宾 · 气球支线走向", varPath: "RobinExpansion.balloon",
				  levels: ["none", "cooperate", "compete", "resolved"],
				  labels: ["未开始", "合作", "竞争", "已收束"] },
				{ key: "r_asylum", name: "罗宾 · 收容所状态", varPath: "RobinExpansion.asylum.status",
				  levels: ["home", "admitted", "recovering"],
				  labels: ["在家", "已入院", "康复中"] },
				{ key: "r_doctor", name: "罗宾 · 医生游戏进度", varPath: "RobinExpansion.doctor.stage",
				  levels: [0, 1, 2],
				  labels: ["未入门", "已玩过", "罗宾会主动提出"] },
				{ key: "ls_role", name: "校园 · 职务", varPath: "LifeSimulation.school.role",
				  levels: ["student", "prefect", "president"],
				  labels: ["学生", "风纪委员", "学生会长"] },
				{ key: "ls_history", name: "校园 · 历史课题", varPath: "LifeSimulation.historyProject.status",
				  levels: ["none", "ongoing", "done", "won"],
				  labels: ["未开始", "进行中", "已完成", "已获奖"] },
				{ key: "dress_active", name: "校园 · 着装规范", varPath: "LifeSimulation.school.dress.active",
				  levels: ["uniform", "free", "revealing", "optionalNudity", "nudeDay", "mandatoryNudity"],
				  labels: ["校服", "自由着装", "暴露着装", "可选裸体", "裸体日", "强制裸体"] },
				{ key: "dress_highest", name: "校园 · 保住过的最高着装政策", varPath: "LifeSimulation.school.dress.highest",
				  levels: ["uniform", "free", "revealing", "optionalNudity", "nudeDay", "mandatoryNudity"],
				  labels: ["校服", "自由着装", "暴露着装", "可选裸体", "裸体日", "强制裸体"] }
			],
			abilities: [
				{ key: "r_rebellion", name: "罗宾 · 反抗贝利路线", varPath: "RobinExpansion.rebellion", type: "boolean" },
				{ key: "r_allies", name: "罗宾 · 已结成同盟", varPath: "RobinExpansion.allies", type: "boolean" },
				{ key: "r_solidarity", name: "罗宾 · 团结结局线", varPath: "RobinExpansion.solidarity", type: "boolean" },
				{ key: "r_bailey", name: "罗宾 · 贝利已击败", varPath: "RobinExpansion.bailey_defeated", type: "boolean",
				  note: "反抗线终点：勾选视为已击败贝利，反抗路线结算剧情可直接进入" },
				{ key: "r_shop", name: "罗宾 · 店铺已开张", varPath: "RobinExpansion.shop", type: "boolean" },
				{ key: "r_tutor", name: "罗宾 · 家教业务开办", varPath: "RobinExpansion.tutor", type: "boolean" },
				{ key: "r_fish_cooked", name: "罗宾 · 鲜鱼料理试做", varPath: "RobinExpansion.fish_cooked", type: "boolean" },
				{ key: "r_fish_grill", name: "罗宾 · 便携烤架", varPath: "RobinExpansion.fish_grill", type: "boolean" },
				{ key: "ls_exempt", name: "校园 · 免听凭证", varPath: "LifeSimulation.school.attendanceExempt", type: "boolean" },
				{ key: "ls_bailey", name: "校园 · 贝利已签署（会长线）", varPath: "LifeSimulation.school.baileySigned", type: "boolean" },
				{ key: "bt_milk", name: "鹰塔 · 哺乳事件已触发", varPath: "BirdTower.seen.milk", type: "boolean" },
				{ key: "clothes_stored", name: "校园 · 校服已存放", varPath: "LifeSimulation.school.clothesStored", type: "boolean" },
				{ key: "vp_ironwill", name: "原版增强 · 铁意志特质", varPath: "VanillaPlus.attitudes.ironWill", type: "boolean" },
				{ key: "vp_sadomaso", name: "原版增强 · 受虐狂特质", varPath: "VanillaPlus.attitudes.sadomasochist", type: "boolean",
				  note: "2.2.7 新增特质：勾选直接获得，影响原版受虐狂相关判定" },
				{ key: "f_avery_refused", name: "孤儿院 · 已拒绝艾弗里收养（2.4.2 新增）", varPath: "Finance.orphanage.avery_adoption_refused", type: "boolean",
				  note: "2.4.2 新增：勾选视为已拒绝艾弗里收养，孤儿院收养剧情将跳过" }
			],
			scenes: [],
			values: [
				{ key: "r_lemonade", name: "罗宾 · 柠檬水摊改造等级", varPath: "RobinExpansion.lemonade", type: "number", min: 0, max: 99 },
				{ key: "r_chocolate", name: "罗宾 · 巧克力摊改造等级", varPath: "RobinExpansion.chocolate", type: "number", min: 0, max: 99 },
				{ key: "r_victories", name: "罗宾 · 反抗路线胜场", varPath: "RobinExpansion.victories", type: "number", min: 0, max: 999 },
				{ key: "r_reserve", name: "罗宾 · 储备金（英镑）", varPath: "RobinExpansion.reserve", type: "number", min: 0, max: 1000000 },
				{ key: "r_care", name: "罗宾 · 照护基金（英镑）", varPath: "RobinExpansion.care_fund", type: "number", min: 0, max: 1000000 },
				{ key: "r_balloon_wins", name: "罗宾 · 气球小游戏胜场", varPath: "RobinExpansion.balloon_wins", type: "number", min: 0, max: 999 },
				{ key: "r_tutor_lessons", name: "罗宾 · 家教累计课时", varPath: "RobinExpansion.tutor_lessons", type: "number", min: 0, max: 999 },
				{ key: "r_doctor_count", name: "罗宾 · 医生游戏次数", varPath: "RobinExpansion.doctor.count", type: "number", min: 0, max: 99 },
				{ key: "r_shop_stock", name: "罗宾 · 店铺库存", varPath: "RobinExpansion.shop_stock", type: "number", min: 0, max: 99999 },
				{ key: "r_shop_staff", name: "罗宾 · 店铺雇员", varPath: "RobinExpansion.shop_staff", type: "number", min: 0, max: 99 },
				{ key: "sl_reputation", name: "街头 · 口碑", varPath: "StreetLife.reputation", type: "number", min: 0, max: 100 },
				{ key: "sl_race_wins", name: "街头 · 公路赛胜场", varPath: "StreetLife.races.wins", type: "number", min: 0, max: 999 },
				{ key: "sl_race_done", name: "街头 · 公路赛完赛次数", varPath: "StreetLife.races.completed", type: "number", min: 0, max: 999 },
				{ key: "bt_ring", name: "鹰塔 · 金戒指类型（0 无/1 普通/2 镶宝石）", varPath: "BirdTower.ring.kept", type: "number", min: 0, max: 2 },
				{ key: "ls_student", name: "校园 · 学生支持", varPath: "LifeSimulation.school.studentSupport", type: "number", min: 0, max: 100 },
				{ key: "ls_staff", name: "校园 · 教职支持", varPath: "LifeSimulation.school.staffSupport", type: "number", min: 0, max: 100 },
				{ key: "ls_corruption", name: "校园 · 腐败值", varPath: "LifeSimulation.school.corruption", type: "number", min: 0, max: 100 },
				{ key: "duties_completed", name: "校园 · 已完成值勤次数", varPath: "LifeSimulation.school.duties.completed", type: "number", min: 0, max: 999 },
				{ key: "pc_loan", name: "罗宾 · 尚欠你的借款（英镑）", varPath: "RobinExpansion.pc_loan", type: "number", min: 0, max: 1000000 },
				{ key: "weekly_income", name: "罗宾 · 上周结算收入（英镑）", varPath: "RobinExpansion.weekly_income", type: "number", min: 0, max: 1000000 }
			]
		}
	};

	/* 内置适配器：SmartPhone Alpha 0.3.91（万能的智能手机，2026-10-18 解压探查实证，作者自述尝鲜版）
	   探测键：V.Phone（模组核心状态对象，scripts/smartphone-patch.js 初始化；模组卸载即消失）。
	   状态键实证：48 个 $Phone 键——Owned 手机对象数组 / photography 摄影 0-1000 /
	   TaskDanger 危险任务模式（模组判断 ===1）/ Using·ReturnPassage 使用状态 /
	   FengMeeet·MetFengGiveup·SecondShopKnown·FengAcceptExposed·FengLine 老冯线 /
	   SydneySexLiveCompanion 悉尼直播陪伴 / Alarms·Memos·Yenotes·Photos 应用数据等。
	   边界隔离：模组键全部为 0/1 数字语义（<<if $Phone.X>> 与 ===1 混用，写 boolean true 会
	   破坏 ===1 判断），故一律走 number 型 values（min 0 max 1），绝不使用 boolean 型；
	   应用数据类（闹钟/备忘录/相册）为内容对象（结构复杂、改坏易崩），不做数值作弊。
	   只声明 V.Phone 自建键，不碰原版任何键。 */
	CHEAT_ADAPTERS["smartphone"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				var V = getV();
				return !!(V && V.Phone && typeof V.Phone === "object" && (V.Phone.photography !== undefined || V.Phone.Owned !== undefined));
			} catch (e) { return false; }
		},
		entry: {
			modId: "smartphone",
			modName: "SmartPhone Alpha 0.3.91（万能智能手机）",
			tasks: [],
			stages: [
				{ key: "sp_feng_line", name: "老冯线 · 阶段", varPath: "Phone.FengLine",
				  levels: [0, 1, 2],
				  labels: ["初始", "进货", "更深"] }
			],
			abilities: [],
			scenes: [],
			values: [
				{ key: "sp_photography", name: "摄影技能", varPath: "Phone.photography", type: "number", min: 0, max: 1000,
				  note: "摄影技能 0-1000：写值后立即生效，影响摄影相关剧情判定" },
				{ key: "sp_task_danger", name: "危险任务模式（0 关 / 1 开）", varPath: "Phone.TaskDanger", type: "number", min: 0, max: 1,
				  note: "模组以 ===1 严格判断：只可写 0/1，勿写 boolean true（会破坏判断）" },
				{ key: "sp_feng_meet", name: "已初遇老冯（0/1）", varPath: "Phone.FengMeeet", type: "number", min: 0, max: 1 },
				{ key: "sp_feng_giveup", name: "已放弃老冯线（0/1）", varPath: "Phone.MetFengGiveup", type: "number", min: 0, max: 1 },
				{ key: "sp_second_known", name: "已发现老冯二手店（0/1）", varPath: "Phone.SecondShopKnown", type: "number", min: 0, max: 1 },
				{ key: "sp_feng_exposed", name: "暴露场景计数", varPath: "Phone.FengAcceptExposed", type: "number", min: 0, max: 99 },
				{ key: "sp_sydney_live", name: "悉尼直播陪伴（0/1）", varPath: "Phone.SydneySexLiveCompanion", type: "number", min: 0, max: 1 }
			]
		}
	};

	/* 内置适配器：原版优化 Dol-Optimization 1.1.2（DoL 体验优化合集，2026-10-20 解压实证，作者 Needmeet）
	   探测键：window.DolOptimization（opt-early-inject.js inject_early 无条件挂载，装上即存在）。
	   边界与风险：设置主存 V.options.opt.*（options 为 DoL 原版根，不在 CHEAT_VANILLA_ROOTS 拦截清单内，
	   当前可经面板写入——属边界地带，若 MCE 日后把 options 补进拦截清单，条目自动变为拒绝写入不崩）；
	   存档扩展状态 V.options.DolOptimization.*（衣柜扩容）；顶层自有键 needmeet_romance（NPC Needmeet 好感，
	   ≥80 解锁恋爱线，运行时副本在 C.npc.Needmeet.love 不写 V）/ hymenreconstructioncount（处女膜修复倒计时）/
	   hairtexture（发质 0-100，疑模组自建）/ nicotine（尼古丁 0-95，疑模组自建）。纯显示类开关（浇水状态/进度
	   速览、快速按钮位置等）模组设置页可改，面板不重复暴露。 */
	CHEAT_ADAPTERS["dol-optimization"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				return !!window.DolOptimization;
			} catch (e) { return false; }
		},
		entry: {
			modId: "dol-optimization",
			modName: "原版优化 Dol-Optimization v1.1.2",
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
				{ key: "opt_needmeet", name: "Needmeet 好感（0-100，≥80 解锁恋爱线）", varPath: "needmeet_romance", type: "number", min: 0, max: 100,
				  note: "≥50 信赖，≥80 解锁 loveInterest/恋爱线；面板写 V 侧，运行时副本在 C.npc.Needmeet.love" },
				{ key: "opt_hymen", name: "处女膜修复剩余天数（每日递减）", varPath: "hymenreconstructioncount", type: "number", min: 0, max: 30 },
				{ key: "opt_hair", name: "发质（0-100）", varPath: "hairtexture", type: "number", min: 0, max: 100,
				  note: "模组自建键（原版清单无），随每小时 +0.05 增长" },
				{ key: "opt_nicotine", name: "尼古丁依赖（0-95）", varPath: "nicotine", type: "number", min: 0, max: 95 },
				{ key: "opt_wardrobe", name: "衣柜扩容值（模组自标「作弊」）", varPath: "options.DolOptimization.LargerWardrobeValue", type: "number", min: 1, max: 9999 }
			]
		}
	};

	/* 内置适配器：Wraith'sReflection 1.3.4（象牙怨灵恋爱线扩展，2026-10-20 解压 10 twee/1 js/26 补丁逐文件实证）
	   探测键：模组无具名模块注册（addon 只做 maplebirch.npc.add + 事件监听），用自有 V 根并集探测
	   （剧情未启动的新档 detect=false，此时本无可作弊内容，可接受；无框架降级安装时 V 键语义不变）。
	   状态键：V.WraithsReflection（恋爱总闸门=1）/ HelpAsk（米奇求助线 1-5）/ necklaceWR（项链持有 0-3）/
	   necklaceThief（偷窃责任枚举，模组自身 Return Necklace 2 写入 "rreturn"（双 r）但约 6 处补丁只认 "return"——
	   面板如实列出两种取值，写 "return" 覆盖面最全）/ AdmitMR / RefuseWR / SilverConchWR / SilverConchAsk /
	   WRR / stealdailyMR。原版根（wraith.state="forgive"/weekly.wraithDate/dateCount.Wraith）一律不暴露。 */
	CHEAT_ADAPTERS["wraiths-reflection"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				var V = getV();
				if (!V) { return false; }
				return (V.WraithsReflection !== undefined || V.HelpAsk !== undefined ||
					V.necklaceWR !== undefined || V.necklaceThief !== undefined ||
					V.necklaceThiefWR !== undefined || V.SilverConchWR !== undefined ||
					V.stealdailyMR !== undefined || V.WRR !== undefined);
			} catch (e) { return false; }
		},
		entry: {
			modId: "wraiths-reflection",
			modName: "Wraith'sReflection 1.3.4（幽灵的倒影）",
			tasks: [],
			stages: [
				{ key: "wr_gate", name: "恋爱线总闸门", varPath: "WraithsReflection",
				  levels: [0, 1],
				  labels: ["未开启", "已开启"],
				  note: "=1 后怨灵可设为恋爱对象（约会/海螺/倒影特质解锁）；项链线未走时 UI 会「能恋爱但无记忆」，建议配合项链阶段一起设" },
				{ key: "wr_help", name: "米奇求助线 · 进程", varPath: "HelpAsk",
				  levels: [1, 2, 3, 4, 5],
				  labels: ["已答应", "已找到 IP", "已汇报", "已翻到 IP", "已偷完离开"] },
				{ key: "wr_necklace", name: "象牙项链 · 持有阶段", varPath: "necklaceWR",
				  levels: [0, 1, 2, 3],
				  labels: ["未偷", "已偷出", "监狱已推进", "已归还基座"] },
				{ key: "wr_thief", name: "偷窃责任归属", varPath: "necklaceThief",
				  levels: ["", "player", "diver", "return", "rreturn"],
				  labels: ["未定", "玩家", "潜水者", "已归还", "已归还(双r)"],
				  note: "模组自身 Return Necklace 2 写入「rreturn」（双 r），但 Lake Ruin Plinth/Schism/Nightmare 等约 6 处补丁只认「return」——写「return」覆盖面最全" }
			],
			abilities: [
				{ key: "wr_admit", name: "监狱对峙 · 承认罪过", varPath: "AdmitMR", type: "boolean" },
				{ key: "wr_refuse", name: "分裂 · 已拒绝", varPath: "RefuseWR", type: "boolean" },
				{ key: "wr_conch_ask", name: "银海螺 · 已咨询约旦", varPath: "SilverConchAsk", type: "boolean" },
				{ key: "wr_rr", name: "麋鹿公寓/公园 · 罗宾介绍标记", varPath: "WRR", type: "boolean",
				  note: "复用型标记：麋鹿公寓「说过话」与公园约会「罗宾已见过祂」共用" }
			],
			scenes: [],
			values: [
				{ key: "wr_conch", name: "银海螺已获得（0/1）", varPath: "SilverConchWR", type: "number", min: 0, max: 1,
				  note: "前提 $WraithsReflection：湖底罐子摸到海螺" },
				{ key: "wr_steal", name: "当日偷窃冷却（0/1，清 0 可再偷）", varPath: "stealdailyMR", type: "number", min: 0, max: 1 }
			]
		}
	};

	/* 内置适配器：DoLSims 0.8.1.7（类模拟人生大扩展，2026-10-20 解压 19 twee/2 js/265 文件实证）
	   探测键：window.MirrorHypnoVariableRefresh（funcSims.js 无条件挂载，脚本加载即存在）。
	   结构：无统一宿主对象，持久态散挂 V 顶层（*Sims 后缀 + 少量无前缀新根）；从 250 个候选根精选 42 项，
	   剔除原版键（options/NPCName/kylarenglish/mental 等）与日锁类（每日自动重置，无作弊价值）。
	   值域依据源码 clamp 实证；未确认具体枚举的阶段（Seath_phase/Judgement_Init 等）按数值钳制暴露并注明。
	   写入防线天然成立：四维 .value/SchoolOrder 等只在开局/迁移 passage 后存在，宿主缺失时拒绝写入不崩。 */
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
				  note: "源码 clamp 锁死上限 40；宿主对象在开局/迁移 passage 后存在，未初始化时拒绝写入" },
				{ key: "ds_popularity", name: "风纪委员 · 声望", varPath: "PopularitySims.value", type: "number", min: 0, max: 40 },
				{ key: "ds_horniness", name: "风纪委员 · 性欲值", varPath: "HorninessSims.value", type: "number", min: 0, max: 40 },
				{ key: "ds_influence", name: "风纪委员 · 影响力", varPath: "InfluenceSims.value", type: "number", min: 0, max: 40 },
				{ key: "ds_gym", name: "健身卡剩余（每日非周一 -1）", varPath: "Gym_Card", type: "number", min: 0, max: 7 },
				{ key: "ds_skill_game", name: "电脑房 · 游戏技能", varPath: "gameskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_skill_live", name: "电脑房 · 直播技能", varPath: "liveskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_skill_program", name: "电脑房 · 编程技能", varPath: "programskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_skill_create", name: "电脑房 · 创作技能", varPath: "createskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_skill_search", name: "电脑房 · 检索技能", varPath: "searchskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_skill_hypno", name: "电脑房 · 催眠技能", varPath: "hypnosisskillSims", type: "number", min: 0, max: 999 },
				{ key: "ds_book_11", name: "图书馆 · 11 号书进度", varPath: "citylibrarybook_11", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_12", name: "图书馆 · 12 号书进度", varPath: "citylibrarybook_12", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_13", name: "图书馆 · 13 号书进度", varPath: "citylibrarybook_13", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_14", name: "图书馆 · 14 号书进度", varPath: "citylibrarybook_14", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_15", name: "图书馆 · 15 号书进度", varPath: "citylibrarybook_15", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_16", name: "图书馆 · 16 号书进度", varPath: "citylibrarybook_16", type: "number", min: 0, max: 1000 },
				{ key: "ds_book_17", name: "图书馆 · 17 号书进度", varPath: "citylibrarybook_17", type: "number", min: 0, max: 1000 },
				{ key: "ds_demon", name: "恶魔化进度（≥6 判定）", varPath: "demon", type: "number", min: 0, max: 10 },
				{ key: "ds_angel", name: "天使化进度", varPath: "angel", type: "number", min: 0, max: 10 },
				{ key: "ds_fallen", name: "堕落天使进度（≥2 判定）", varPath: "fallenangel", type: "number", min: 0, max: 10 },
				{ key: "ds_corruption", name: "世界软腐化（≥90 触发，时间钩子 -50）", varPath: "world_corruption_soft", type: "number", min: 0, max: 100 },
				{ key: "ds_spray_skill", name: "喷雾枪熟练度", varPath: "weaponSprayGunSkillSims", type: "number", min: 0, max: 100 },
				{ key: "ds_head_blackmail", name: "多伦 · 黑料掌握（0/1）", varPath: "headblackmailed", type: "number", min: 0, max: 1 }
			]
		}
	};

	function cheatIsVanillaRoot(root) {
		var i;
		for (i = 0; i < CHEAT_VANILLA_ROOTS.length; i++) {
			if (CHEAT_VANILLA_ROOTS[i] === root) { return true; }
		}
		return false;
	}
	/* varPath 解析：父级对象链必须存在（禁止写入 undefined 对象）；叶子允许缺失（正常初始化）。 */
	function cheatResolvePath(path) {
		var V = getV();
		if (!V) { return { ok: false, reason: "存档变量不可用" }; }
		var parts = String(path || "").split(".");
		if (!parts.length || !parts[0]) { return { ok: false, reason: "空路径" }; }
		if (cheatIsVanillaRoot(parts[0])) { return { ok: false, reason: "vanilla", root: parts[0] }; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") {
				return { ok: false, reason: "parent", path: parts.slice(0, i + 1).join(".") };
			}
			cur = cur[parts[i]];
		}
		return { ok: true, parent: cur, leaf: parts[parts.length - 1], exists: cur[parts[parts.length - 1]] !== undefined };
	}
	/* 通用写入执行器（幂等防崩）：类型校验 + 越界钳制 + 留痕（保留首次 before，回退可还原）。 */
	function cheatWriteValue(modId, itemKey, op, path, raw, type, min, max) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			var r = cheatResolvePath(path);
			if (!r.ok) {
				if (r.reason === "vanilla") {
					return { ok: false, message: "目标「" + r.root + "」为 DoL 原版变量，拒绝操作（原版内容请使用对应五大面板）" };
				}
				if (r.reason === "parent") {
					return { ok: false, message: "目标变量宿主不存在（" + r.path + "），拒绝写入 undefined 对象；请先推进模组剧情初始化" };
				}
				return { ok: false, message: "目标变量路径无效（" + path + "）" };
			}
			var val = raw;
			if (type === "number") {
				if (typeof val !== "number") { val = Number(val); }
				if (!isFinite(val)) { return { ok: false, message: "数值无效（需为数字）" }; }
				if (typeof min === "number" && val < min) { val = min; }
				if (typeof max === "number" && val > max) { val = max; }
			} else if (type === "boolean") {
				val = (val === true || val === 1 || val === "1" || val === "true" || val === "on");
			} else {
				val = String(val);
			}
			var before = r.parent[r.leaf];
			var prev = V.mbCE_wrote && V.mbCE_wrote["cheat:" + modId + ":" + itemKey];
			if (prev && prev.before !== undefined) { before = prev.before; } /* 保留首次面板写入前状态 */
			r.parent[r.leaf] = val;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:" + modId + ":" + itemKey] = { type: "cheat", modId: modId, op: op, path: path, before: before, after: val, t: Date.now() };
			return { ok: true, message: "已写入 " + path + " = " + JSON.stringify(val), before: before, after: val };
		} catch (e) {
			return { ok: false, message: "操作异常：" + (e && e.message ? e.message : e) };
		}
	}
	/* 列表型写入（v1.4.0 扩展）：varPath 指向字符串数组，on=true 追加 / on=false 移除；
	   留痕 before/after 为数组快照（before 保留首次面板写入前状态）。 */
	function cheatWriteListValue(modId, itemKey, op, path, value, on) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			var r = cheatResolvePath(path);
			if (!r.ok) {
				if (r.reason === "vanilla") {
					return { ok: false, message: "目标「" + r.root + "」为 DoL 原版变量，拒绝操作（原版内容请使用对应五大面板）" };
				}
				if (r.reason === "parent") {
					return { ok: false, message: "目标变量宿主不存在（" + r.path + "），拒绝写入 undefined 对象；请先推进模组剧情初始化" };
				}
				return { ok: false, message: "目标变量路径无效（" + path + "）" };
			}
			var cur = r.parent[r.leaf];
			var arr = Array.isArray(cur) ? cur.slice() : [];
			var idx = arr.indexOf(value);
			if (on && idx === -1) { arr.push(value); }
			if (!on && idx !== -1) { arr.splice(idx, 1); }
			var before = Array.isArray(cur) ? cur.slice() : undefined;
			var prev = V.mbCE_wrote && V.mbCE_wrote["cheat:" + modId + ":" + itemKey];
			if (prev && prev.before !== undefined) { before = prev.before; }
			r.parent[r.leaf] = arr;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:" + modId + ":" + itemKey] = { type: "cheat", modId: modId, op: op, path: path, before: before, after: arr.slice(), t: Date.now() };
			return { ok: true, message: "已更新 " + path + (on ? " ＋ " : " － ") + value, after: arr.slice() };
		} catch (e) {
			return { ok: false, message: "操作异常：" + (e && e.message ? e.message : e) };
		}
	}
	/* 回退：还原 before（首次面板写入前状态）；无痕迹 / 结构已变化 → 拒绝。 */
	function undoCheatModValue(modId, itemKey) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return { ok: false, message: "无面板写入痕迹" }; }
			var key = "cheat:" + modId + ":" + itemKey;
			var rec = V.mbCE_wrote[key];
			if (!rec || rec.type !== "cheat") { return { ok: false, message: "该操作非面板写入（或已回退），无可撤销痕迹" }; }
			var r = cheatResolvePath(rec.path);
			if (!r.ok) { return { ok: false, message: "目标变量结构已变化，拒绝回退（" + rec.path + "）" }; }
			if (rec.before === undefined) {
				try { delete r.parent[r.leaf]; } catch (e) { r.parent[r.leaf] = undefined; }
			} else {
				r.parent[r.leaf] = rec.before;
			}
			try { delete V.mbCE_wrote[key]; } catch (e) { V.mbCE_wrote[key] = undefined; }
			return { ok: true, message: "已回退（还原为面板写入前状态）" };
		} catch (e) {
			return { ok: false, message: "回退异常：" + (e && e.message ? e.message : e) };
		}
	}
	function normalizeCheatMod(m) {
		return {
			modId: m.modId, modName: m.modName, declared: true,
			tasks: Array.isArray(m.tasks) ? m.tasks : [],
			stages: Array.isArray(m.stages) ? m.stages : [],
			abilities: Array.isArray(m.abilities) ? m.abilities : [],
			scenes: Array.isArray(m.scenes) ? m.scenes : [],
			values: Array.isArray(m.values) ? m.values : []
		};
	}
