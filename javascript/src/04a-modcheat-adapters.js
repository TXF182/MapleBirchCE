	CHEAT_ADAPTERS["revelation-the-book-of-return"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }
				return !!(window.maplebirch.get("RobinTemple") || window.maplebirch.get("TempleChoir"));
			} catch (e) { return false; }
		},
		entry: {
			modId: "revelation-the-book-of-return",
			modName: "默示录：归途之书 v1.4.0",
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
				{ key: "td_sydney_agree", name: "神殿值勤 · 悉尼候选同意", varPath: "TempleDuties.candidates.Sydney.agreed", type: "boolean" },
				{ key: "nkl_returned", name: "怨灵 · 项链已归还", varPath: "RBR.necklace.returned", type: "boolean",
				  note: "1.3.10 项链取回/安抚线主开关：勾选视为已把象牙项链归还湖中，梦线与安抚线（WraithAftercare）入口开放" }
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
				{ key: "ll_doubt", name: "迷途羔羊 · 疑虑", varPath: "LostLamb.doubt", type: "number", min: 0, max: 1000 },
				{ key: "ll_fear", name: "迷途羔羊 · 恐惧", varPath: "LostLamb.fear", type: "number", min: 0, max: 1000 },
				{ key: "ll_notice", name: "迷途羔羊 · 觉察", varPath: "LostLamb.notice", type: "number", min: 0, max: 1000 },
				{ key: "td_duties", name: "神殿值勤 · 值勤次数", varPath: "TempleDuties.duties", type: "number", min: 0, max: 999 },
				{ key: "td_roof", name: "神殿值勤 · 屋顶修复进度", varPath: "TempleDuties.archive.roof", type: "number", min: -1, max: 100 },
				{ key: "td_shelves", name: "神殿值勤 · 书架整理进度", varPath: "TempleDuties.archive.shelves", type: "number", min: -1, max: 999 },
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
	   （≥3 解锁共同战斗）、$lemonadeNewGoodsList 柠檬水摊新商品列表
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
				{ key: "ls_together", name: "直播 · 一起直播", varPath: "liveStreamTogether", type: "boolean" },
				{ key: "pb_lemon", name: "还钱进度 · 柠檬水摊", varPath: "lemonadeShouldPayBack", type: "boolean" },
				{ key: "pb_live", name: "还钱进度 · 直播设备", varPath: "liveStreamShouldPayBack", type: "boolean" },
				{ key: "pb_choc", name: "还钱进度 · 巧克力摊升级", varPath: "chocolateUpgradeShouldPayBack", type: "boolean" },
				{ key: "pb_choc2", name: "还钱进度 · 巧克力摊改造", varPath: "chocolateReformShouldPayBack", type: "boolean" }
			],
			scenes: [],
			values: [
				{ key: "rf_chain", name: "反抗链 · 打赢次数（≥3 解锁共同战斗）", varPath: "robinFightChain", type: "number", min: 0, max: 99 },
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
			modName: "枯木逢春 · Deadwood Reblooms 2.5.0",
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
				  labels: ["校服", "自由着装", "暴露着装", "可选裸体", "裸体日", "强制裸体"],
				  sync: {
					clear: ["LifeSimulation.school.dress.proposal"],
					set: [{ path: "LifeSimulation.school.dress.trialUntil", value: 0 }],
					copyMax: { path: "LifeSimulation.school.dress.highest", order: ["uniform", "free", "revealing", "optionalNudity", "nudeDay", "mandatoryNudity"] }
				  },
				  note: "写 active 自动联动：清掉待审批申请（proposal）、同步保住过的最高政策（highest 只升不降）、清零试行期（trialUntil），与模组 School.ts 状态机保持一致，避免「已到强制裸体却还显示等待礼顿决定」" },
				{ key: "dress_highest", name: "校园 · 保住过的最高着装政策", varPath: "LifeSimulation.school.dress.highest",
				  levels: ["uniform", "free", "revealing", "optionalNudity", "nudeDay", "mandatoryNudity"],
				  labels: ["校服", "自由着装", "暴露着装", "可选裸体", "裸体日", "强制裸体"] },
				{ key: "cm_zephyr", name: "冷月港 · 泽菲尔线阶段", varPath: "MoreTransformations.harbour.zephyr.stage",
				  levels: [0, 1, 2, 3, 4],
				  labels: ["未开始", "已问起", "已谈交易", "已找回货物", "已付酬完成"],
				  note: "2.4.4 新增冷月港区域线：阶段 4 = 泽菲尔线完成态（对话与酬金结算需船 harbour.ship 与泽菲尔登场 Zephyr.init 前提，写 4 仅推进阶段、不代发酬金）" },
				{ key: "gym_membership", name: "健身房 · 会员方案（2.4.6 新增）", varPath: "LifeSimulation.gym.membership",
				  levels: ["none", "week", "month", "year", "lifetime"],
				  labels: ["无", "周卡", "月卡", "年卡", "终身"],
				  sync: {
					set: [{ path: "LifeSimulation.gym.expires_at", value: function () {
						var base = (typeof Time !== "undefined" && Time.date) ? Time.date.timeStamp : Math.floor(Date.now() / 1000);
						return base + 3650 * 86400; /* 写会员同时给十年有效期，防 onDay 结算把过期会员重置为 none */
					} }]
				  },
				  note: "GymPlan 枚举：'visit' 为单次入场不算会员，故从 week 起；写会员自动联动给 expires_at 十年有效期（模组 onDay 结算 expires_at<=now 会重置为 none，不联动写必当天失效）；lifetime 免过期检查，写它同样带十年值无副作用" },
				{ key: "fin_bank_tier", name: "银行 · 账户档位（2.4.6 自查优化新增）", varPath: "Finance.bank.account_tier",
				  levels: ["current", "preferred", "premier"],
				  labels: ["普通", "优选", "尊享"],
				  note: "模组 BankState.account_tier：档位决定透支/贷款/取现额度（premier=信用卡1.5万、贷款5万、取现1万英镑）；写档位后额度即刻生效" },
				{ key: "sl_heist_stage", name: "街道 · 劫案阶段（2.4.6 自查优化新增）", varPath: "StreetLife.heist.stage",
				  levels: ["idle", "prep", "entry", "challenge", "vault", "escape", "settlement", "closed"],
				  labels: ["未开始", "筹备", "潜入", "关卡", "金库", "逃出", "结算", "已关闭"],
				  note: "模组 HeistState.stage 状态机：劫案推进线；写 closed 会触发结算读取（outcome 未设时按失败结算），建议配合已筹备内容逐步写" },
				{ key: "shrine_stage", name: "神社 · 黯羽神社线阶段（2.5.0 说明页新增）", varPath: "MoreTransformations.shrine.stage",
				  levels: [0, 1, 2, 3],
				  labels: ["未开始", "已收信", "已获指路与鸦羽项链", "已到访认识月羽"],
				  sync: { set: [
					{ path: "MoreTransformations.shrine.feeds", value: 3, if: { min: 1 } },
					{ path: "MoreTransformations.raven.met", value: true, if: { min: 1 } },
					{ path: "maplebirch.npc.Tsukihan.init", value: 1, if: { min: 3 } }
				  ] },
				  note: "神社线：0 未开始 → 1 已接过渡鸦衔来的信（需喂鸦≥3 次且已遇见渡鸦，写 1+ 自动补 feeds=3 与已遇见渡鸦）→ 2 已交信给格威岚获鸦羽项链（项链为衣柜物品，不代发）→ 3 森林深度 20-40 神社小路到访认识 19 岁月羽（血月/追猎关闭；写 3 自动补月羽已认识 init=1，月羽 npc 数值请到月羽键写入）；写 0 为重置不联动" }
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
				{ key: "vp_trait_willpower", name: "原版增强 · 意志突破特质", varPath: "VanillaPlus.traits.willpower", type: "boolean",
				  note: "2.4.6 六项属性突破：勾选视为已达成意志突破（新上限 125%），需先练满原版意志上限才生效相关判定" },
				{ key: "vp_trait_physique", name: "原版增强 · 体能突破特质", varPath: "VanillaPlus.traits.physique", type: "boolean",
				  note: "2.4.6：体能突破特质；Physique.ts 以 traits.physique && !breakUsed 判定挣脱事件可触发" },
				{ key: "vp_trait_beauty", name: "原版增强 · 容貌突破特质", varPath: "VanillaPlus.traits.beauty", type: "boolean",
				  note: "2.4.6：容貌突破特质（新上限 125%）" },
				{ key: "vp_trait_exhibitionism", name: "原版增强 · 暴露突破特质", varPath: "VanillaPlus.traits.exhibitionism", type: "boolean",
				  note: "2.4.6：暴露突破特质（五级事件 levelFive 需另行推进）" },
				{ key: "vp_trait_deviancy", name: "原版增强 · 变态突破特质", varPath: "VanillaPlus.traits.deviancy", type: "boolean",
				  note: "2.4.6：变态突破特质（与诡异镜子系统同命名空间）" },
				{ key: "vp_trait_promiscuity", name: "原版增强 · 放纵突破特质", varPath: "VanillaPlus.traits.promiscuity", type: "boolean",
				  note: "2.4.6：放纵突破特质（五级事件 levelFive 需另行推进）" },
				{ key: "vp_trait_incorrigible", name: "原版增强 · 全能特质（六项全满）", varPath: "VanillaPlus.traits.incorrigible", type: "boolean",
				  note: "2.4.6：六项属性全部满值后置位的额外特质，勾选直接获得" },
				{ key: "vp_prayer_holy", name: "神圣转化 · 温暖接触已亲历", varPath: "VanillaPlus.divineTransformations.prayer.holy", type: "boolean",
				  note: "三位一体前置：神殿祈祷室原版温暖存在，接受或挣脱均记录" },
				{ key: "vp_prayer_stone", name: "神圣转化 · 岩石接触已亲历", varPath: "VanillaPlus.divineTransformations.prayer.stone", type: "boolean",
				  note: "三位一体前置：岩石接触，同上" },
				{ key: "vp_prayer_dark", name: "神圣转化 · 空无黑暗已亲历", varPath: "VanillaPlus.divineTransformations.prayer.dark", type: "boolean",
				  note: "三位一体前置：空无黑暗接触，同上" },
				{ key: "vp_trinity", name: "神圣转化 · 三位一体", varPath: "VanillaPlus.divineTransformations.trinity", type: "boolean",
				  note: "2.4.6 三位一体：勾选直接获得，允许天使/堕天使/恶魔共存、阻止成长点数衰减、免除堕天使每日纯洁流失" },
				{ key: "f_avery_refused", name: "孤儿院 · 已拒绝艾弗里收养（模组新增）", varPath: "Finance.orphanage.avery_adoption_refused", type: "boolean",
				  note: "模组 2.4.2 起提供：勾选视为已拒绝艾弗里收养，孤儿院收养剧情将跳过" },
				{ key: "cc_found", name: "金币洞穴 · 已发现洞窟（2.4.5 新增）", varPath: "MoreTransformations.treasure.found", type: "boolean",
				  note: "2.4.5 新增金币洞穴线：发现前置要求岛屿探索 100 次（$island.explore_count gte 100），勾选直接标记已发现，跳过探索门槛" },
				{ key: "cc_appraised", name: "金币洞穴 · 温特已记录纹饰（2.4.5 新增）", varPath: "MoreTransformations.treasure.appraised", type: "boolean",
				  note: "2.4.5 新增：博物馆对话让温特记录金币纹饰后的状态，勾选视为已完成记录" },
				{ key: "vp_mirror_home", name: "诡异镜子 · 孤儿院卧室（2.4.6 新增）", varPath: "VanillaPlus.deviancy.mirrors.home", type: "boolean",
				  note: "2.4.6 诡异镜子系统：标记该处镜子已发现，可进入触手平原的出口判定" },
				{ key: "vp_mirror_farm", name: "诡异镜子 · 农场（2.4.6 新增）", varPath: "VanillaPlus.deviancy.mirrors.farm", type: "boolean" },
				{ key: "vp_mirror_tower", name: "诡异镜子 · 高塔（2.4.6 新增）", varPath: "VanillaPlus.deviancy.mirrors.tower", type: "boolean" },
				{ key: "vp_mirror_temple", name: "诡异镜子 · 神殿宿舍（2.4.6 新增）", varPath: "VanillaPlus.deviancy.mirrors.temple", type: "boolean" },
				{ key: "vp_mirror_sirris", name: "诡异镜子 · 西里斯庄园（2.4.6 新增）", varPath: "VanillaPlus.deviancy.mirrors.sirris", type: "boolean" },
				{ key: "vp_mirror_kylar", name: "诡异镜子 · 凯拉尔庄园（2.4.6 新增）", varPath: "VanillaPlus.deviancy.mirrors.kylar", type: "boolean" },
				{ key: "ls_medicine_pending", name: "医务室 · 有待处理体检报告（2.4.6 新增）", varPath: "LifeSimulation.medicine.review.pending", type: "boolean",
				  note: "Medicine.ts review.pending：勾选视为有待处理体检结果（report 流程的待办标记）" },
				{ key: "vp_lock_willpower", name: "原版增强 · 锁定意志（2.4.6 自查优化新增）", varPath: "VanillaPlus.lock.willpower", type: "boolean",
				  note: "2.4.6 属性锁定系统：勾选后意志属性不被模组事件消耗/衰减，专用于「练满再突破」流程防掉值" },
				{ key: "vp_lock_physique", name: "原版增强 · 锁定体能（2.4.6 自查优化新增）", varPath: "VanillaPlus.lock.physique", type: "boolean" },
				{ key: "vp_lock_beauty", name: "原版增强 · 锁定容貌（2.4.6 自查优化新增）", varPath: "VanillaPlus.lock.beauty", type: "boolean" },
				{ key: "vp_lock_promiscuity", name: "原版增强 · 锁定放纵（2.4.6 自查优化新增）", varPath: "VanillaPlus.lock.promiscuity", type: "boolean" },
				{ key: "vp_lock_exhibitionism", name: "原版增强 · 锁定暴露（2.4.6 自查优化新增）", varPath: "VanillaPlus.lock.exhibitionism", type: "boolean" },
				{ key: "vp_lock_deviancy", name: "原版增强 · 锁定变态（2.4.6 自查优化新增）", varPath: "VanillaPlus.lock.deviancy", type: "boolean" },
				{ key: "vp_expunge_used", name: "神圣转化 · 驱除已用标记（2.4.6 自查优化新增）", varPath: "VanillaPlus.divineTransformations.expungeUsed", type: "boolean",
				  note: "勾选视为已用过一次驱除（expunge），影响转化净化类剧情判定" },
				{ key: "r_invest_agreed", name: "罗宾 · 投资协议已达成（2.4.6 自查优化新增）", varPath: "RobinExpansion.investment.agreed", type: "boolean",
				  sync: { set: [{ path: "RobinExpansion.shop", value: true }, { path: "RobinExpansion.shop_flowers", value: true }, { path: "RobinExpansion.shop_popcorn", value: true }, { path: "RobinExpansion.shop_balloons", value: true }] },
				  note: "罗宾投资线开启标记：勾选视为已签订投资协议，进入市场结算周期；自动联动四门店开启（2.5.0 已移除股份 share 键，不再联动股份；分红键 dividends 单独可写）" },
				{ key: "r_shop_bank", name: "罗宾 · 银行已支持店铺（2.4.6 自查优化新增）", varPath: "RobinExpansion.shop_bank_supported", type: "boolean" },
				{ key: "r_shop_flowers", name: "罗宾 · 花摊已开（2.4.6 自查优化新增）", varPath: "RobinExpansion.shop_flowers", type: "boolean" },
				{ key: "r_shop_popcorn", name: "罗宾 · 爆米花摊已开（2.4.6 自查优化新增）", varPath: "RobinExpansion.shop_popcorn", type: "boolean" },
				{ key: "r_shop_balloons", name: "罗宾 · 气球摊已开（2.4.6 自查优化新增）", varPath: "RobinExpansion.shop_balloons", type: "boolean" },
				{ key: "r_rent_self", name: "罗宾 · 自己承担房租（2.4.6 自查优化新增）", varPath: "RobinExpansion.self_rent", type: "boolean",
				  sync: { set: [{ path: "RobinExpansion.rent_separated", value: true }] },
				  note: "对齐模组自身语义（Robin.ts 判定 self_rent 时自动置 rent_separated）：勾选自动联动分开租房标记" },
				{ key: "r_rent_both", name: "罗宾 · 两人分担房租（2.4.6 自查优化新增）", varPath: "RobinExpansion.both_rent", type: "boolean" },
				{ key: "r_rent_separated", name: "罗宾 · 分开租房（2.4.6 自查优化新增）", varPath: "RobinExpansion.rent_separated", type: "boolean" },
				{ key: "fin_bank_opened", name: "银行 · 已开户（2.4.6 自查优化新增）", varPath: "Finance.bank.opened", type: "boolean",
				  note: "金融线起点：勾选视为已在银行开户，解锁存款/借记卡/贷款等业务" },
				{ key: "fin_debit", name: "银行 · 借记卡（2.4.6 自查优化新增）", varPath: "Finance.bank.debit_card", type: "boolean",
				  sync: { set: [{ path: "Finance.bank.opened", value: true }] },
				  note: "模组 2.4 金融扩展借记卡：可在刷卡商户消费（余额即付）；勾选自动联动开户（模组判定卡功能必须已开户，否则返回 bank-required）" },
				{ key: "fin_credit", name: "银行 · 信用卡（2.4.6 自查优化新增）", varPath: "Finance.bank.credit_card", type: "boolean",
				  sync: { set: [{ path: "Finance.bank.opened", value: true }] },
				  note: "模组 2.4 金融扩展信用卡：先消费后还款（欠款 credit_debt 累积计息）；勾选自动联动开户（模组判定卡功能必须已开户）" },
				{ key: "fin_broker_opened", name: "证券 · 券商已开户（2.4.6 自查优化新增）", varPath: "Finance.brokerage.opened", type: "boolean",
				  note: "证券线起点：勾选视为已在券商开户，解锁股票交易与分红" },
				{ key: "fin_co_office", name: "公司 · 已租办公室（2.4.6 自查优化新增）", varPath: "Finance.company.office", type: "boolean" },
				{ key: "fin_co_agreement", name: "公司 · 合作协议已签（2.4.6 自查优化新增）", varPath: "Finance.company.agreement", type: "boolean" },
				{ key: "fin_board", name: "公司 · 董事会席位（2.4.6 自查优化新增）", varPath: "Finance.company.shareholders.board", type: "boolean",
				  note: "勾选视为已进入董事会（Achievements 成就「Deadwood Board Seat」条件之一）" },
				{ key: "fin_controller", name: "公司 · 控股股东（2.4.6 自查优化新增）", varPath: "Finance.company.shareholders.controller", type: "boolean",
				  note: "勾选视为已控股公司（成就「Deadwood Controlling Stake」条件之一）" },
				{ key: "fin_ascension_recognized", name: "公司 · 黑乌鸦认可（2.4.6 自查优化新增）", varPath: "Finance.company.ascension.recognized", type: "boolean",
				  note: "勾选视为已获黑乌鸦认可（成就「Deadwood Black Raven」条件之一）" },
				{ key: "fin_orc_pc_free", name: "孤儿院 · 自己已买断（2.4.6 自查优化新增）", varPath: "Finance.orphanage.pc_bought_out", type: "boolean",
				  note: "孤儿院收购线：勾选视为 PC 已被买断自由（pcFree 判定），不再欠贝利" },
				{ key: "fin_orc_robin_free", name: "孤儿院 · 罗宾已买断（2.4.6 自查优化新增）", varPath: "Finance.orphanage.robin_bought_out", type: "boolean",
				  note: "孤儿院收购线：勾选视为罗宾已被买断自由（robinFree 判定）" },
				{ key: "tr_helmet", name: "交通 · 头盔已购（2.4.6 自查优化新增）", varPath: "Transport.helmet", type: "boolean",
				  note: "模组骑行判定：摩托车必须已购头盔才可骑行；车辆本身无作弊键，需存档已有对应车辆才有效" },
				{ key: "tr_tool_bike", name: "交通 · 自行车维修工具（2.4.6 自查优化新增）", varPath: "Transport.repair_tools.bicycle", type: "boolean",
				  note: "用于自行车修理流程；需存档已有自行车才用得上" },
				{ key: "tr_tool_motor", name: "交通 · 摩托维修工具（2.4.6 自查优化新增）", varPath: "Transport.repair_tools.motor", type: "boolean",
				  note: "用于摩托车修理流程；需存档已有摩托车才用得上" },
				{ key: "raven_flock_met", name: "渡鸦 · 已遇见鸦群（2.5.0 说明页新增）", varPath: "MoreTransformations.raven.met", type: "boolean",
				  note: "神社线前置：白天/傍晚找鸦群初见得 5 渡鸦点；勾选视为已见过（跳过找鸦群），随后可在白天喂浆果/苹果 +2、模仿鸣叫每日成长" }
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
				{ key: "weekly_income", name: "罗宾 · 上周结算收入（英镑）", varPath: "RobinExpansion.weekly_income", type: "number", min: 0, max: 1000000 },
				{ key: "cc_torch", name: "金币洞穴 · 火把数（2.4.5 新增）", varPath: "MoreTransformations.treasure.torch", type: "number", min: 0, max: 99,
				  note: "2.4.5 新增：洞窟探索消耗的火把储备（消费时 Math.max(0, torch - n)）" },
				{ key: "cc_coins", name: "金币洞穴 · 携带金币数（2.4.5 新增）", varPath: "MoreTransformations.treasure.coins", type: "number", min: 0, max: 99,
				  note: "2.4.5 新增：玩家从石匣取出的被诅咒金币，博物馆借展会转移为 museumCoins" },
				{ key: "cc_museum_coins", name: "金币洞穴 · 博物馆借展金币（2.4.5 新增）", varPath: "MoreTransformations.treasure.museumCoins", type: "number", min: 0, max: 99,
				  note: "2.4.5 新增：借给温特展览的金币数；与 crewCoins/zephyrCoins 一并归零即凑齐全部金币" },
				{ key: "cc_crew_coins", name: "金币洞穴 · 船员分得金币（2.4.5 新增）", varPath: "MoreTransformations.treasure.crewCoins", type: "number", min: 0, max: 99,
				  note: "2.4.5 新增：泽菲尔赏给见习水手的金币数，需船长在船舱或酒馆收回" },
				{ key: "cc_zephyr_coins", name: "金币洞穴 · 泽菲尔持有金币（2.4.5 新增）", varPath: "MoreTransformations.treasure.zephyrCoins", type: "number", min: 0, max: 99,
				  note: "2.4.5 新增：泽菲尔手中的金币数，其同意归还后计入凑齐进度" },
				{ key: "sy_angel_build", name: "悉尼 · 天使转化点数（2.4.5 新增）", varPath: "maplebirch.npc.sydney.transformation.angel.build", type: "number", min: 0, max: 50,
				  note: "2.4.5 新增 NPC 转化系统：天使等级门槛 25/30/35/40/45/50，点数 50 达满级 6；写此键只推进转化进度，外观与受孕判定由模组结算" },
				{ key: "sy_fallen_build", name: "悉尼 · 堕天转化点数（2.4.5 新增）", varPath: "maplebirch.npc.sydney.transformation.fallen.build", type: "number", min: 0, max: 31,
				  note: "2.4.5 新增：堕天等级门槛 1/21/31，点数 31 达满级 3（堕落羽翼）" },
				{ key: "sy_demon_build", name: "悉尼 · 恶魔转化点数（2.4.5 新增）", varPath: "maplebirch.npc.sydney.transformation.demon.build", type: "number", min: 0, max: 100,
				  note: "2.4.5 新增：恶魔等级门槛 5/10/15/20/25/30 上限 100，≥30 满级 6；level≥6 且 build≥90 时自愿场景受孕判定改强制（源码 demon.level<6||build<90 判定）" },
				{ key: "ls_casino_suspicion", name: "赌场 · 疑心值（2.4.6 新增）", varPath: "LifeSimulation.casino.suspicion", type: "number", min: 0, max: 100,
				  note: "Casino.ts clamp 上限 100：≥60 触发可疑判定、≥100 拒绝服务；赌注赔率随疑心升高（写 0 回到清白）" },
				{ key: "vp_beauty_bonus", name: "神圣转化 · 容貌加成点（2.4.6 自查优化新增）", varPath: "VanillaPlus.divineTransformations.beautyBonus", type: "number", min: 0, max: 100,
				  note: "DivineTransformations.ts beautyBonus：转化带来的容貌加成（模组按事件逐步累加），直接写值即时生效" },
				{ key: "r_invest_total", name: "罗宾 · 累计出资（便士，2.5.0 键名改造）", varPath: "RobinExpansion.investment.contributed", type: "number", min: 0, max: 100000000,
				  note: "2.5.0 由 invested_total 改名 contributed（统计页「店铺合伙累计出资」）：累计出资以便士计（1英镑=100便士），写 100000 便士=1000 英镑；仅影响统计/汇报口径" },
				{ key: "r_invest_returned", name: "罗宾 · 累计垫款已收回（便士，2.5.0 键名改造）", varPath: "RobinExpansion.investment.returned", type: "number", min: 0, max: 100000000,
				  note: "2.5.0 由 returned_total 改名 returned（统计页「合伙累计垫款收回」）" },
				{ key: "r_invest_dividends", name: "罗宾 · 累计分红（便士，2.5.0 键名改造）", varPath: "RobinExpansion.investment.dividends", type: "number", min: 0, max: 100000000,
				  note: "2.5.0 由 dividends_total 改名 dividends（统计页「合伙累计分红」）" },
				{ key: "r_invest_treasury", name: "罗宾 · 店铺周转金（便士，2.5.0 新增）", varPath: "RobinExpansion.investment.treasury", type: "number", min: 0, max: 100000000,
				  note: "2.5.0 新增：合伙店铺周转金（经济页「店铺周转金」展示），写高可覆盖店铺采购周转" },
				{ key: "fin_bank_balance", name: "银行 · 存款余额（便士，2.4.6 自查优化新增）", varPath: "Finance.bank.balance", type: "number", min: 0, max: 100000000,
				  sync: { set: [{ path: "Finance.bank.opened", value: true }, { path: "Finance.bank.debit_card", value: true }] },
				  note: "BankState.balance 以便士存（1英镑=100便士）：写 1000000=1万英镑；余额可用于借记卡消费/理财；写入自动联动开户+借记卡（模组可用资金判定=cashOnHand+(opened&&debit_card?balance:0)，不联动钱存着但不可用）；注意与原版 $money 分开计" },
				{ key: "fin_broker_cash", name: "证券 · 券商现金（便士，2.4.6 自查优化新增）", varPath: "Finance.brokerage.cash", type: "number", min: 0, max: 100000000,
				  note: "BrokerageState.cash 以便士计：写钱到券商账户可直接买股票（holdings 持仓结构复杂，不做直接持仓作弊）" },
				{ key: "fin_co_completed", name: "公司 · 已完成订单数（2.4.6 自查优化新增）", varPath: "Finance.company.completed", type: "number", min: 0, max: 999,
				  note: "CompanyState.completed：已完成订单计数（部分订单奖励/剧情按完成数推进）" },
				{ key: "tr_parts_bike", name: "交通 · 自行车零件（2.4.6 自查优化新增）", varPath: "Transport.repair_parts.bicycle", type: "number", min: 0, max: 99,
				  note: "用于自行车修理流程；需存档已有自行车才用得上" },
				{ key: "tr_parts_motor", name: "交通 · 摩托零件（2.4.6 自查优化新增）", varPath: "Transport.repair_parts.motor", type: "number", min: 0, max: 99,
				  note: "用于摩托车修理流程；需存档已有摩托车才用得上" },
				{ key: "sl_bounty_completed", name: "街道 · 已结悬赏数（2.4.6 自查优化新增）", varPath: "StreetLife.bounties.completed", type: "number", min: 0, max: 999,
				  note: "BountiesState.completed：已完结悬赏计数（成就「Deadwood First Bounty」判定 ≥1）" },
				{ key: "ps_sanity", name: "心智 · 理智（2.5.0 说明页新增）", varPath: "Psyche.sanity", type: "number", min: -500, max: 1000,
				  note: "心智系统：理智范围 -500~1000 初始 1000；8 档状态（混乱/迷乱/心乱/恍惚/动摇/安定/清醒/专注）与学习收益（60%~120%）由理智自动结算，影响课堂/读书等科学数学活动；睡/祈祷/写作可恢复（当日额度约 30 点、高位减半）；需枯木模组运行初始化（V.Psyche 由模组创建），未初始化写会被拒绝" },
				{ key: "ps_fear", name: "心智 · 恐惧（2.5.0 说明页新增）", varPath: "Psyche.fear", type: "number", min: 0, max: 1000,
				  note: "恐惧范围 0~1000 初始 0，短期受惊用；≥400 且非战斗/追猎/剧情强制时可安抚（冷却 cooldown_until，模组结算）；写 0 回平静，写 1000 满值；需枯木模组运行初始化（V.Psyche 由模组创建），未初始化写会被拒绝" },
				{ key: "pc_horse_build", name: "转化 · 马（2.5.0 说明页新增）", varPath: "maplebirch.transformation.horse.build", type: "number", min: 0, max: 100,
				  note: "马转化共六阶段：进度在角色属性页、外观在镜子选择；build≥1 后停止衰减（隐藏部位不失去能力）；正常成长=雷米骑术课/林间果实/追回受惊马匹/荒原骑乘；写 100 直达满级（模组按 build 结算阶段）" },
				{ key: "pc_whale_build", name: "转化 · 鲸（2.5.0 说明页新增）", varPath: "maplebirch.transformation.whale.build", type: "number", min: 0, max: 100,
				  note: "鲸转化六阶段：海滩远处礁石岩石水池漂浮 10 分钟 +1、阁楼白米饭开启鲸化、已有点数后游泳/潜水继续积累（满游泳技能也有效）；写 100 直达满级" },
				{ key: "pc_raven_build", name: "转化 · 渡鸦（2.5.0 说明页新增）", varPath: "maplebirch.transformation.raven.build", type: "number", min: 0, max: 100,
				  note: "渡鸦转化六阶段：白天/傍晚找鸦群初见 +5、喂浆果/苹果 +2 每份、模仿鸣叫每日成长；写 100 直达满级（渡鸦羽毛项链防衰减，非代发物品）" },
				{ key: "shrine_feeds", name: "神社 · 喂鸦次数（2.5.0 说明页新增）", varPath: "MoreTransformations.shrine.feeds", type: "number", min: 0, max: 999,
				  sync: { set: [{ path: "MoreTransformations.raven.met", value: true, if: { min: 1 } }] },
				  note: "神社收信前置：三个不同日子喂过鸦群（≥3）才可接渡鸦衔来的信；模组喂鸦前提=已遇见鸦群 raven.met，写 1+ 自动补已遇见；写 3 即可推进（喂食同时给渡鸦点）" },
				{ key: "tsuki_love", name: "月羽 · 好感（2.5.0 说明页新增）", varPath: "maplebirch.npc.Tsukihan.love", type: "number", min: 0, max: 100,
				  note: "月羽小屋进入实际判定=神社线完成（stage3）+已认识（init1）+npc活跃，好感不参与门禁；好感档位作用于互动：≥20 且恋人解锁聊天/亲密（Affection）、≥30 对应说明页「受邀入内」文案、≥50 解锁独处；聊天/一起读书（10 分钟每天一次压力-4 好感+1）/整理神社/购物提篮等提升；月羽 npc 需存档已初始化" },
				{ key: "tsuki_dom", name: "月羽 · 任性（2.5.0 说明页新增）", varPath: "maplebirch.npc.Tsukihan.dom", type: "number", min: 0, max: 100,
				  note: "模组 dom=Wilfulness 任性（初始 10）：周二购物顺着挑饼干/未获许可闯入浴室（好感-2 任性+2）等事件影响；写 0-100 直接调" },
				{ key: "tsuki_lust", name: "月羽 · 欲望（2.5.0 说明页新增）", varPath: "maplebirch.npc.Tsukihan.lust", type: "number", min: 0, max: 100,
				  note: "恋人亲密线：性欲≥30 且当日尚有亲密机会时可继续亲近（浴室同洗后）；写 100 直达上限；月羽 npc 需存档已初始化" },
				{ key: "tsuki_init", name: "月羽 · 已认识（2.5.0 说明页新增）", varPath: "maplebirch.npc.Tsukihan.init", type: "number", min: 0, max: 1,
				  note: "神社线 stage 3 首次到访自动认识 19 岁月羽（模组判定 init===1）；写 1 视为已认识；注意：月羽 npc 需存档已初始化（曾触发 npcInit），全新存档请先走神社线到访" },
				{ key: "tsuki_lover", name: "月羽 · 恋人（2.5.0 说明页新增）", varPath: "loveInterestList", type: "list", options: ["Tsukihan"],
				  note: "小屋邀请权限 = 好感≥30 且已选为恋人：追加把 Tsukihan 加入原版恋人列表（loveInterestList），配合好感键即受邀入内；小屋可同睡/洗澡（20:00-20:30，雨中 18:00）/聊天读书" },
				{ key: "or_orders_completed", name: "果园 · 已交付供货订单（2.5.0 说明页新增）", varPath: "Orchard.orders_completed", type: "number", min: 0, max: 999,
				  note: "果园市场线：向罗宾市场供货完成的订单数（orders_completed），影响重复订单量；写高解锁大额供货" },
				{ key: "or_contracts_completed", name: "果园 · 已交付农场合同（2.5.0 说明页新增）", varPath: "Orchard.contracts_completed", type: "number", min: 0, max: 999,
				  note: "果园农场合同线：交付雷米农场合同数（contracts_completed）" },
				{ key: "or_sales_income", name: "果园 · 累计销售收入（便士，2.5.0 说明页新增）", varPath: "Orchard.sales_income", type: "number", min: 0, max: 100000000,
				  note: "果园供货累计收入（便士，1英镑=100便士）：仅统计口径，写高即账目好看" },
				{ key: "or_regular_visits", name: "果园 · 常客到访次数（2.5.0 说明页新增）", varPath: "Orchard.regular_visits", type: "number", min: 0, max: 999,
				  note: "果园常客线：regular_visits 累计到访次数（常客系统按次数推进）" }
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
	CHEAT_ADAPTERS["wraiths-reflection"] = {
		detect: function () {
			try {
				if (typeof window === "undefined") { return false; }
				var V = getV();
				if (!V) { return false; }
				return (V.WraithsReflection !== undefined || V.HelpAsk !== undefined ||
					V.necklaceWR !== undefined || V.necklaceThief !== undefined ||
					V.necklaceThiefWR !== undefined ||
					V.stealdailyMR !== undefined);
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
				{ key: "wr_conch_ask", name: "银海螺 · 已咨询约旦", varPath: "SilverConchAsk", type: "boolean" }
			],
			scenes: [],
			values: [
				{ key: "wr_steal", name: "当日偷窃冷却（0/1，清 0 可再偷）", varPath: "stealdailyMR", type: "number", min: 0, max: 1 }
			]
		}
	};

	/* 内置适配器：DoLSims 0.8.1.7（类模拟人生大扩展，2026-10-20 解压 19 twee/2 js/265 文件实证）
	   探测键：window.MirrorHypnoVariableRefresh（funcSims.js 无条件挂载，脚本加载即存在）。
	   结构：无统一宿主对象，持久态散挂 V 顶层（*Sims 后缀 + 少量无前缀新根）；从 250 个候选根精选 45 项，
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
