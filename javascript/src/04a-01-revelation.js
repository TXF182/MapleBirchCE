	CHEAT_ADAPTERS["revelation-the-book-of-return"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }
				return !!(window.maplebirch.get("RobinTemple") || window.maplebirch.get("TempleChoir"));
			} catch (e) { return false; }
		},
		entry: {
			modId: "revelation-the-book-of-return",
			modName: "默示录：归途之书 v1.4.3",
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
