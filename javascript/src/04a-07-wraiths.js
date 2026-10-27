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
