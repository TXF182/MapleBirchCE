/* 职责：角色初见补录 + 格威岚支线场景数据（v2.2.8）
   20 条 EXTRA_SCENES 从 07e-scenes.js 拆出（单段 400 行预算），合并仍由 07e-scenes.js 的 mergeExtraScenes 负责；
   Eden/BlackWolf startPassage 修正也在此（原名键在本体注册表里就存在，只能在合并后校正）。 */
	var EXTRA_SCENES_EXTRA = {
		/* 初见 7 条：原版有完整开头段、$scenes 未收录；入口段与一层后继逐字取自 0.5.12.13 段落名，
		   不带 manualVariableChanges（各段自带 location 初始化）；键名以角色名开头，
		   让 sceneRoleOf 归到对应角色组（07e-scenes2 的角色规则）。 */
		"SamIntro": {
			name: "山姆 · 公园初见",
			startPassage: "Sam Park Intro",
			passages: ["Sam Park Intro", "Sam Park Intro 2"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"DorenIntro": {
			name: "多伦 · 出警局初见",
			startPassage: "Doren Intro",
			passages: ["Doren Intro", "Doren Intro Cry", "Doren Intro Talk"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"SydneyIntro": {
			name: "悉尼 · 图书馆初见",
			startPassage: "Sydney Library Intro",
			passages: ["Sydney Library Intro", "Sydney Library Intro 2"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"WrenIntro": {
			name: "雷恩 · 酒吧初见",
			startPassage: "Smuggler Pub Wren Intro",
			passages: ["Smuggler Pub Wren Intro", "Smuggler Pub Wren Intro Wait", "Smuggler Pub Wren Intro Tell", "Smuggler Pub Wren Intro Threaten"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"WhitneyIntro": {
			name: "惠特尼 · 咖啡店初见",
			startPassage: "Street Alex Cafe Whitney Intro",
			passages: ["Street Alex Cafe Whitney Intro", "Street Alex Cafe Whitney Intro Bully", "Street Alex Cafe Whitney Intro Rival", "Street Alex Cafe Whitney Intro Friend", "Street Alex Cafe Whitney Intro Affection"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"AlexIntro": {
			name: "艾利克斯 · 咖啡店初见",
			startPassage: "Street Alex Cafe React Intro",
			passages: ["Street Alex Cafe React Intro", "Street Alex Cafe Whitney Intro"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"KylarIntro": {
			name: "凯拉尔 · 校园初见（出手介入）",
			startPassage: "Kylar Intro Intervene",
			passages: ["Kylar Intro Intervene", "Kylar Intro Help", "Kylar Intro Ignore"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		/* v2.2.8 格威岚支线直达：13 条有 passage 名的分支（阶段主线内联在 Gwylan Talk Shop，
		   不走这里，见 07u-gwylan-stage.js）。入口段均取自 Forest Shop Entrance / Gwylan Widgets 的实际跳转目标。 */
		"GwylanRitual": {
			name: "格威岚 · 仪式",
			startPassage: "Gwylan Ritual Select",
			passages: ["Gwylan Ritual Select", "Gwylan Forest Journey Prep", "Gwylan Ritual Start"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanHypnosis": {
			name: "格威岚 · 催眠求助",
			startPassage: "Gwylan Hypnosis Start",
			passages: ["Gwylan Hypnosis Start", "Gwylan Hypnosis Start 2", "Gwylan Hypnosis Deepest"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopNowhere": {
			name: "格威岚 · Nowhere 梦境",
			startPassage: "Forest Shop Nowhere",
			passages: ["Forest Shop Nowhere", "Forest Shop Nowhere Passout"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopReunion": {
			name: "格威岚 · 重逢",
			startPassage: "Forest Shop Reunion",
			passages: ["Forest Shop Reunion", "Forest Shop Taken Start"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopThief": {
			name: "格威岚 · 偷窃",
			startPassage: "Forest Shop Thief",
			passages: ["Forest Shop Thief", "Forest Shop Stolen Wrap"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopTrauma": {
			name: "格威岚 · 创伤",
			startPassage: "Forest Shop Trauma",
			passages: ["Forest Shop Trauma", "Forest Shop Trauma 2", "Forest Shop Trauma 3", "Forest Shop Trauma 4", "Forest Shop Trauma 5"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopIntruder": {
			name: "格威岚 · 闯入者",
			startPassage: "Forest Shop Intruder",
			passages: ["Forest Shop Intruder", "Forest Shop Entrance"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopCollar": {
			name: "格威岚 · 项圈",
			startPassage: "Forest Shop Familiar Collar",
			passages: ["Forest Shop Familiar Collar", "Forest Shop Familiar Collar Wear"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopHat": {
			name: "格威岚 · 帽子",
			startPassage: "Forest Shop Hat",
			passages: ["Forest Shop Hat", "Forest Shop Hat 2"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopLights": {
			name: "格威岚 · 灯光",
			startPassage: "Forest Shop Lights",
			passages: ["Forest Shop Lights", "Forest Shop Lights 2", "Forest Shop Lights 3"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanShopSnoop": {
			name: "格威岚 · 暗室",
			startPassage: "Forest Shop Snoop",
			passages: ["Forest Shop Snoop", "Forest Shop Hunt Intro"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanYearning": {
			name: "格威岚 · 渴望和解",
			startPassage: "Gwylan Yearning Start",
			passages: ["Gwylan Yearning Start", "Gwylan Yearning Start 2"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		},
		"GwylanPubSulking": {
			name: "格威岚 · 酒吧生气",
			startPassage: "Gwylan Pub Sulking",
			passages: ["Gwylan Pub Sulking", "Gwylan Pub Sulking Sit"],
			manualVariableChanges: "", unlockedExpr: "", lockedExpr: ""
		}

	};
	/* v2.2.8 初见入口修正：本体注册表里 EdenIntro / BlackWolfIntro 的 startPassage 写成 ForestHuntDebug
	   （该段全文仅 <<foresthunt>>，是怨灵狩猎调试段，与两条初见无关）；重放会在错误段落开播。
	   只改这一个错位值，其余键与已正确值一律不动。 */
	var SCENE_START_FIXES = { "EdenIntro": "Forest Hunter Intro", "BlackWolfIntro": "Forest Wolf Cave Intro" };
	function applySceneStartFixes(defs) {
		if (!defs || typeof defs !== "object") { return defs; }
		Object.keys(SCENE_START_FIXES).forEach(function (k) {
			var d = defs[k];
			if (d && d.startPassage === "ForestHuntDebug") { d.startPassage = SCENE_START_FIXES[k]; }
		});
		return defs;
	}
	var INTRO_SCENE_KEYS = ["SamIntro", "DorenIntro", "SydneyIntro", "WrenIntro", "WhitneyIntro", "AlexIntro", "KylarIntro"];
	var GWYLAN_SIDE_KEYS = ["GwylanRitual", "GwylanHypnosis", "GwylanShopNowhere", "GwylanShopReunion", "GwylanShopThief",
		"GwylanShopTrauma", "GwylanShopIntruder", "GwylanShopCollar", "GwylanShopHat", "GwylanShopLights",
		"GwylanShopSnoop", "GwylanYearning", "GwylanPubSulking"];
	function listExtraScenes(keys) {
		var out = [];
		keys.forEach(function (k) {
			var s = EXTRA_SCENES[k] || (typeof EXTRA_SCENES_EXTRA !== "undefined" ? EXTRA_SCENES_EXTRA[k] : null);
			if (s) { out.push({ key: k, name: s.name, startPassage: s.startPassage, passages: s.passages.slice() }); }
		});
		return out;
	}
	function mbCEIntroScenes() { return listExtraScenes(INTRO_SCENE_KEYS); }
	function mbCEGwylanSideScenes() { return listExtraScenes(GWYLAN_SIDE_KEYS); }
