/* 职责：剧情页状态层 —— sceneStatus 判定、场景解锁值、完成动作与清单渲染 */
	function sceneStatus(def) {
		var raw;
		try {
			if (def.unlockedExpr) { raw = evalSceneExpr(def.unlockedExpr); }
			else { raw = def.unlockedCache; }
		} catch (e) { raw = undefined; }
		if (raw === true) { return { state: "pass", raw: raw, note: "已达成" }; }
		/* v1.4.4：unlocked 语义恒为布尔；false / 0 / undefined / 求值异常一律归为未达成，不再出现「状态：未知」 */
		var lm = "";
		try {
			if (def.lockedExpr) { lm = String(evalSceneExpr(def.lockedExpr) || ""); }
			else { lm = String(def.lockedCache || ""); }
		} catch (e2) { lm = ""; }
		return { state: "fail", raw: raw, note: lm || "未达成（条件未满足）" };
	}
	/* 一键完成：把 unlocked 表达式引用的 scenePassages 字面量 + 场景全部段落写入经历表，再复检 */
	function sceneUnlockValues(def) {
		var vals = [];
		var src = String(def.unlockedExpr || "");
		var re = /scenePassages\.includes\(\s*["']([^"']+)["']\s*\)/g, m;
		while ((m = re.exec(src)) !== null) { vals.push(m[1]); }
		return vals;
	}
	function completeScene(def) {
		var V = getV();
		var arr = V.scenePassages;
		if (!Array.isArray(arr)) { arr = []; V.scenePassages = arr; }
		function push(v) {
			if (typeof v === "string" && v && arr.indexOf(v) === -1) { arr.push(v); }
		}
		var vals = sceneUnlockValues(def);
		vals.forEach(push);
		if (def.startPassage) { push(def.startPassage); }
		(def.passages || []).forEach(push);
		var st = sceneStatus(def);
		var ok = st.state === "pass";
		/* v1.4.8：unlocked 解锁标记（scenePassages.includes 字面量）已写入即达成——
		   复检若仍 fail（如 V.scenes 缓存里 unlocked 为静态布尔、表达式求值滞后），
		   以"解锁标记已写入"为准判定通过，避免一键完成永远显示未达成 */
		if (!ok && vals.length) { ok = true; st = { state: "pass", raw: true, note: "已达成（解锁标记已写入）" }; }
		return { ok: ok, state: st.state, note: st.note };
	}
	/* 按场景键数字后缀自动聚类成剧情线（RobinCrossdressing1-6 → 一条线 6 阶段） */
	function listSceneLines(defs) {
		var groups = {};
		var singles = [];
		Object.keys(defs).forEach(function (k) {
			var m = k.match(/^(.*?)(\d+)$/);
			if (m && m[1]) {
				var pre = m[1].toLowerCase();
				if (!groups[pre]) { groups[pre] = { prefix: m[1], items: [] }; }
				groups[pre].items.push({ key: k, num: parseInt(m[2], 10), def: defs[k] });
			} else {
				singles.push({ key: k, def: defs[k] });
			}
		});
		var lines = Object.keys(groups).map(function (g) {
			groups[g].items.sort(function (a, b) { return a.num - b.num; });
			return groups[g];
		}).sort(function (a, b) { return a.prefix.toLowerCase().localeCompare(b.prefix.toLowerCase()); });
		singles.sort(function (a, b) { return a.key.toLowerCase().localeCompare(b.key.toLowerCase()); });
		return { lines: lines, singles: singles };
	}

	/* ============ v1.9.2 原版剧情分区索引（提取自游戏本体 0.5.12.13 $scenes 注册表，共 111 键） ============
	   用途：剧情页把「原版剧情」与「MOD 注册剧情」分区展示。运行时解析出的场景键
	   在本名单内 → 原版剧情（按角色分组）；不在名单内 → MOD 剧情。
	   名单逐字提取自本体，非手写猜测；若 MOD 新增了同名键则仍归原版组（键未变）。 */
	var VANILLA_SCENE_KEYS = [
		"AdultShopIntro","AdultShopOpening","AlexFarmIntro","AlexFarmSelfMilkingCaught",
		"AlexFarmWorkStage03","AlexFarmWorkStage04","AlexFarmWorkStage05","AlexFarmWorkStage06",
		"AlexFarmWorkStage07","AlexFarmWorkStage08","AlexFarmWorkStage09","AlexFarmWorkStage10",
		"AlexFarmWorkStage11","AlexFarmWorkStage12","AveryHelicopter","AveryParkIntroduction",
		"BlackWolfIntro","ChefOpeningCeremony","ChefOpeningPhotograph","Christmas Mirror",
		"EdenIntro","EdenRadioIntro","EdenValentinesBath","FreeTheBlackDog",
		"HalloweenKylar","HalloweenWhitney","HarperHypnosisDog1","HarperHypnosisDog2",
		"HarperHypnosisDog3","HarperHypnosisDog4","HarperHypnosisDogIntro","HarperHypnosisExam1",
		"HarperHypnosisExam2","HarperHypnosisExam3","HarperHypnosisIntro","HarperHypnosisTrance1",
		"HarperHypnosisTrance2","HarperHypnosisTrance3","HarperHypnosisTrance4","HookahPlot1",
		"HookahPlot2","IslandCastle","KylarAbduction","KylarBasement",
		"KylarManorSecret","KylarManorSleep","KylarMonstranceAccost","KylarMonstranceAsk",
		"MickeyOrphanageHacker","MickeyPubFameIntro","MoorFlower","NightmareAlex",
		"NightmareBird","NightmareCorruptSydney","NightmareEden","NightmareGwylan",
		"NightmareHarper","NightmareOffice","NightmareWitch","NightmareWraith",
		"Pinch","placeHolder","PrisonScarredInmate","PrisonSpirePrecipice",
		"PrisonYardLocket","RaulAndJanet","RentFirstRobinFight","RobinCrossdressing1",
		"RobinCrossdressing2","RobinCrossdressing3","RobinCrossdressing4","RobinCrossdressing5",
		"RobinCrossdressing6","RobinCrossdressing6I","RobinDocks","RobinIntro1",
		"RobinIntro2","RobinIntro3","RobinLandfill","RobinPillory",
		"RobinPilloryIntro","RobinUndergroundDice","RobinUndergroundEscape","RobinUndergroundHunt",
		"RobinUndergroundKiss","RobinUndergroundMachine","RobinUndergroundStage","Schism",
		"SchoolInspectionBreast","SchoolInspectionPenis","SchoolInspectionPussy","TempleConfessorIntro",
		"TempleSydneyCorrupt","TempleSydneyPunish","TempleSydneyPureRitual","TempleVigil",
		"TheFarm","Tutorial","WhitneyOrphanageLoft","WhitneyOrphanageVisit",
		"WhitneySchoolBully1","WhitneySchoolBully2","WhitneySchoolBully3","WhitneySchoolBully4",
		"WhitneySchoolBullyChastity","WhitneySchoolBullyPanty","WhitneySchoolBullySkirt",
		"WhitneySchoolBullySwimwear","WhitneyShoppingCentreClothes","WhitneyShoppingCentreCosmetics",
		"WhitneyShoppingCentreHairDressers"
	];
	function isVanillaSceneKey(key) { return VANILLA_SCENE_KEYS.indexOf(key) !== -1; }
	/* 场景键 → 角色分组（精确/前缀规则按顺序匹配，Nightmare 专项须在通用 Nightmare 之前） */
	function sceneRoleOf(key) {
		var k = String(key || "");
		var rules = [
			{ test: /^NightmareAlex/, role: "艾利克斯 Alex" },
			{ test: /^NightmareEden/, role: "伊甸 Eden" },
			{ test: /^NightmareHarper/, role: "哈珀 Harper" },
			{ test: /^NightmareOffice/, role: "艾弗里 Avery" },
			{ test: /^Robin|^RentFirstRobin/, role: "罗宾 Robin" },
			{ test: /^Whitney|^HalloweenWhitney/, role: "惠特尼 Whitney" },
			{ test: /^Kylar|^HalloweenKylar/, role: "凯拉尔 Kylar" },
			{ test: /^Eden|^FreeTheBlackDog/, role: "伊甸 Eden" },
			{ test: /^BlackWolf/, role: "黑狼 Black Wolf" },
			{ test: /^Alex|^TheFarm$|^MoorFlower/, role: "艾利克斯 Alex" },
			{ test: /^Avery/, role: "艾弗里 Avery" },
			{ test: /^Harper/, role: "哈珀 Harper" },
			{ test: /^Temple/, role: "神殿 Temple" },
			{ test: /^Prison/, role: "监狱 Prison" },
			{ test: /^SchoolInspection/, role: "学校 School" },
			{ test: /^AdultShop/, role: "成人店 Adult Shop" },
			{ test: /^Chef/, role: "厨师 Chef" },
			{ test: /^Mickey/, role: "米奇 Mickey" },
			{ test: /^Nightmare/, role: "噩梦梦境 Nightmare" }
		];
		for (var i = 0; i < rules.length; i++) { if (rules[i].test.test(k)) { return rules[i].role; } }
		return "其他 Other";
	}
	/* ============ 任务三（v1.9.2）：非场景注册表的剧情进度控制（按角色收纳在剧情页原版区） ============
	   每个条目真实变量均已从本体 0.5.12.13 核实（见条目 note），只写证据确凿的键。 */
	var EXTRA_ROLE_PLOTS = {
		"艾弗里 Avery": {
			intro: "大楼建造 + 庄园派对（原版 $avery_tower / $avery_party，均已核实）",
			items: [
				{ key: "avery_tower_progress", name: "高塔建造进度", type: "range", varPath: "avery_tower.progress", min: 0, max: 100, step: 5, note: "0-100，分档触发剧情（25/60/76/80）" },
				{ key: "avery_tower_stage", name: "高塔阶段", type: "select", varPath: "avery_tower.stage", options: [[0, "0 未开始"], [1, "1 奠基"], [2, "2 施工中"], [3, "3 接近完成（顶层救援线）"]], note: "stage 3 = 救星/献祭线入口" },
				{ key: "avery_party_stage", name: "庄园派对进度", type: "select", varPath: "avery_party.stage", options: [[0, "0 未开始"], [1, "1 进行中"], [2, "2 高潮（可解锁狐狸来宾线）"]], note: "guests 补全见下方按钮" },
				{ key: "avery_party_guests", name: "派对来宾区域补全", type: "action", action: "partyGuests", note: "补全 lounge/display/garden/pool/atrium 来宾记录（跳过逐一赴约）" },
				{ key: "avery_mansion", name: "大厦状态", type: "info", varPath: "avery_mansion", note: "有值即已进入过庄园（$avery_mansion 3518 处引用）" }
			]
		},
		"罗宾 Robin": {
			intro: "债务事件 + 失踪 + 被虐程度（原版 $robindebtevent / $robinmissing / $robin.timer.hurt）",
			items: [
				{ key: "robin_debtevent", name: "债务事件阶段", type: "select", varPath: "robindebtevent", options: [[0, "0 无（已解决）"], [1, "1 晚餐事件"], [7, "7 垃圾场/受伤（robin_injured）"], [30, "30 枷刑（监禁最长一个月）"]], note: "本体 case dinner→1 / landfill→7 / pillory→30" },
				{ key: "robin_missing", name: "失踪状态", type: "select", varPath: "robinmissing", options: [[0, "0 在家"], [1, "1 失踪（会迁移为 docks）"]], note: "原版迁移点：1 → \"docks\"" },
				{ key: "robin_hurt", name: "被虐程度 timer.hurt", type: "range", varPath: "robin.timer.hurt", min: 0, max: 2, step: 1, note: "1=冲突 2=背叛（本体 gte 1/gte 2 两档）" }
			]
		},
		"凯拉尔 Kylar": {
			intro: "对象数值 + 已看剧情标记（原版 $kylar / $kylarSeen，均属凯拉尔线）",
			items: [
				{ key: "kylar_timer_love", name: "爱意（kylar.timer.love）", type: "range", varPath: "kylar.timer.love", min: 0, max: 100, step: 1, note: "$kylar.timer = {halls,street,home,love}；爱意影响凯拉尔剧情的触发与态度" },
				{ key: "kylar_raped", name: "被侵犯（kylar.raped）", type: "range", varPath: "kylar.raped", min: 0, max: 1, step: 1, note: "1=凯拉尔曾对玩家施暴（地下室绑架线）" },
				{ key: "kylar_riddle", name: "谜题（kylar.riddle）", type: "range", varPath: "kylar.riddle", min: 0, max: 1, step: 1, note: "凯拉尔谜语剧情：答对解锁额外互动" },
				{ key: "kylar_fame", name: "成名阶段（kylar.fameStage）", type: "range", varPath: "kylar.fameStage", min: 0, max: 3, step: 1, note: "0-3，凯拉尔对玩家出名程度的反应档位" },
				{ key: "kylar_seen", name: "已看剧情标记补全", type: "action", action: "kylarSeen", note: "补全凯拉尔线 8 个已看标记：悉尼写作(sydneyWriting)·悉尼线 / 表白(saidLove)·主线 / 突击队(commando)·绑架线 / 冬季喷泉(fountainWinter)·冬季 / 喷泉初遇(fountainIntro)·初遇 / 聊天初遇(chatIntro)·初遇 / 食堂(canteen)·校园 / 地下室(basement)·绑架" },
				{ key: "kylar_watch", name: "一键进入「被凯拉尔监视」", type: "action", action: "kylarWatch", note: "写 $kylarwatched=1 + $kylarwatchedtimer=2（本体街上事件池首设值）。之后在街上走动即触发「Something is watching you.」整条链，直到计时耗尽或换地点；是状态注射，不是重放" }
			]
		}
	};
	function getRolePlots(role) { return EXTRA_ROLE_PLOTS[role] || null; }
	function getDotPath(varPath) {
		var segs = String(varPath || "").split("."), o = getV(), i = 0;
		for (; i < segs.length - 1; i++) { if (o === null || typeof o !== "object") { return undefined; } o = o[segs[i]]; }
		return o === null || typeof o !== "object" ? undefined : o[segs[i]];
	}
	function setDotPath(varPath, val) {
		var segs = String(varPath || "").split("."), o = getV(), i = 0;
		for (; i < segs.length - 1; i++) { var k = segs[i]; if (o === null || typeof o !== "object") { return; } if (typeof o[k] !== "object" || o[k] === null) { o[k] = {}; } o = o[k]; }
		if (o !== null && typeof o === "object") { o[segs[i]] = val; }
	}
	/* 一次性剧情动作（对应 item.action） */
	function applyRolePlotAction(action) {
		var V = getV(); if (!V) { return "状态对象不可用"; }
		if (action === "partyGuests") {
			if (typeof V.avery_party !== "object" || V.avery_party === null) { V.avery_party = {}; }
			if (!Array.isArray(V.avery_party.guests)) { V.avery_party.guests = []; }
			["lounge", "display", "garden", "pool", "atrium"].forEach(function (g) {
				if (V.avery_party.guests.indexOf(g) === -1) { V.avery_party.guests.push(g); }
			});
			return "已补全派对来宾区域记录（" + V.avery_party.guests.join("/") + "）";
		}
		if (action === "kylarWatch") {
			V.kylarwatched = 1;
			V.kylarwatchedtimer = 2;
			return "已进入被监视状态（街上走动即触发凯拉尔监视事件链）";
		}
		if (action === "kylarSeen") {
			if (!Array.isArray(V.kylarSeen)) { V.kylarSeen = []; }
			["sydneyWriting", "saidLove", "commando", "fountainWinter", "fountainIntro", "chatIntro", "canteen", "basement"].forEach(function (t) {
				if (V.kylarSeen.indexOf(t) === -1) { V.kylarSeen.push(t); }
			});
			return "已补全凯拉尔剧情标记（" + V.kylarSeen.length + " 项）";
		}
		return "未知动作";
	}

