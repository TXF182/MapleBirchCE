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
