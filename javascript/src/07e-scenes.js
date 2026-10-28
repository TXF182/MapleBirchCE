	/* ============ 特殊剧情（DoL 场景注册表 $scenes / Scene Viewer 系统）
	     方案A：不硬编码任何剧情。从游戏 Story 文本解析 `<<widget "scenes">>` 的注册表
	     （MOD 经 TweeReplacer/ReplacePatcher 改动的场景同样被解析到），unlocked 表达式
	     实时求值（规避 $scenes 惰性缓存），passages 即剧情内分阶段段落；另按场景键的
	     数字后缀自动聚类成"剧情线 + N 个阶段"。============ */
	/* 段落枚举（v1.1：SugarCube 2.36.1 已移除 Story.passages，主路径走
	     Story.lookupWith；旧版本仍兼容 Story.passages；Story 不可用或被改写时
	     回退 DOM 的 tw-passagedata 元素——ModLoader 的 pSC2DataManager 同源读取，
	     本体 + 全部 MOD 段落必然可枚举。返回 [{name, text}]） */
	function listAllPassages() {
		var out = [];
		try {
			if (typeof Story !== "undefined" && Story) {
				var arr = null;
				try { if (Array.isArray(Story.passages)) { arr = Story.passages; } } catch (e) { arr = null; }
				if (!arr && typeof Story.lookupWith === "function") {
					arr = Story.lookupWith(function () { return true; });
				}
				if (Array.isArray(arr)) {
					for (var i = 0; i < arr.length; i++) {
						var p = arr[i];
						if (!p || typeof p !== "object") { continue; }
						var nm = typeof p.name === "string" ? p.name : (typeof p.title === "string" ? p.title : "");
						if (nm) { out.push({ name: nm, text: typeof p.text === "string" ? p.text : "" }); }
					}
				}
			}
		} catch (e) {}
		/* DOM 兜底：运行时 <tw-passagedata> 元素必然存在（ModLoader 依赖它注入/读取段落） */
		if (!out.length && typeof document !== "undefined" && document && typeof document.querySelectorAll === "function") {
			try {
				var nodes = document.querySelectorAll("tw-passagedata");
				for (var j = 0; j < nodes.length; j++) {
					var nd = nodes[j];
					var nname = nd && (nd.getAttribute("name") || nd.getAttribute("title") || "");
					if (nname) { out.push({ name: nname, text: (nd.textContent || "") }); }
				}
			} catch (e2) {}
		}
		return out;
	}
	/* Twee/HTML 实体反转义（&lt;&lt;→<< 等，兼容 HTML 转义形态的段落文本） */
	function unescapeTweeEntities(s) {
		return String(s || "")
			.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'").replace(/&apos;/g, "'")
			.replace(/&amp;/g, "&");
	}
	function findScenesWidgetText() {
		try {
			var ps = listAllPassages();
			for (var i = 0; i < ps.length; i++) {
				var t = unescapeTweeEntities(ps[i].text);
				if (t.indexOf('<<widget "scenes">>') !== -1) { return t; }
			}
			/* v1.4.8 兜底：汉化/段落名变体时 widget 段落定位不到 → 找含场景对象字面量开头的段落 */
			for (var j = 0; j < ps.length; j++) {
				var t2 = unescapeTweeEntities(ps[j].text);
				if (t2.indexOf("<<set $scenes to {") !== -1 || t2.indexOf("$scenes to {") !== -1) { return t2; }
			}
		} catch (e) {}
		return "";
	}
	/* twee 表达式 → JS（$var → V.var，is/and/or/gt 等操作符翻译） */
	function tweeToJS(expr) {
		var s = String(expr || "");
		s = s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, "V.$1");
		s = s.replace(/isn't/g, "!==").replace(/is not/g, "!==");
		s = s.replace(/\bis\b/g, "===").replace(/\bgte\b/g, ">=").replace(/\blte\b/g, "<=")
			.replace(/\bgt\b/g, ">").replace(/\blt\b/g, "<")
			.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		return s;
	}
	function evalSceneExpr(expr) {
		var s = String(expr || "").trim();
		if (!s) { return true; }
		var code = tweeToJS(s);
		var V = getV();
		if (!V) { return undefined; }
		/* v1.4.4：原版 scenes 的 unlocked 全部依赖 $scenePassages.includes(...)（已看段落表），
		   该 story 变量在部分存档/流程下缺失 → 兜底初始化为空数组，避免 undefined.includes 崩溃导致状态未知 */
		if (!Array.isArray(V.scenePassages)) { V.scenePassages = V.scenePassages || []; }
		return new Function("V", "return (" + code + ");")(V);
	}
	/* 键块扫描：从任意文本提取 "Key": { ... } 场景对象块（不依赖 <<set $scenes to { 前缀，
	   供 widget 段落解析与 Story 全文恢复共用） */
	function parseSceneBlocks(text) {
		var defs = {};
		var reKey = /"([^"]+)"\s*:\s*\{/g, km;
		while ((km = reKey.exec(text)) !== null) {
			var kstart = km.index + km[0].length - 1;
			var kd = 0, ki = kstart, kend = -1, ks = false;
			for (; ki < text.length; ki++) {
				var cc = text.charAt(ki);
				if (ks) {
					if (cc === "\\") { ki++; }
					else if (cc === '"') { ks = false; }
				} else if (cc === '"') { ks = true; }
				else if (cc === "{") { kd++; }
				else if (cc === "}") { kd--; if (kd === 0) { kend = ki; break; } }
			}
			if (kend < 0) { continue; }
			var block = text.slice(kstart + 1, kend);
			var o = {};
			var mn = block.match(/name\s*:\s*"((?:[^"\\]|\\.)*)"/);
			if (mn) { o.name = mn[1]; }
			var ms = block.match(/startPassage\s*:\s*"((?:[^"\\]|\\.)*)"/);
			if (ms) { o.startPassage = ms[1]; }
			var mp = block.match(/passages\s*:\s*\[(.*?)\]/);
			if (mp) {
				var arr = [];
				var pm = /"((?:[^"\\]|\\.)*)"/g, pm2;
				while ((pm2 = pm.exec(mp[1])) !== null) { arr.push(pm2[1]); }
				o.passages = arr;
			}
			var mm = block.match(/manualVariableChanges\s*:\s*"((?:[^"\\]|\\.)*)"/);
			if (mm) { o.manualVariableChanges = mm[1]; }
			/* v1.4.8：block 为 slice 出的键块（不含结尾 }）——unlocked 后可能是 ", lockedMessage"、
			   ", }" 或直接块尾（无 lockedMessage 的原版场景如 Whitney 孤儿院/贞操装置）→ 补 $ 分支 */
			var mu = block.match(/unlocked\s*:\s*(.*?)(?:,\s*lockedMessage|,?\s*\}|,?\s*$)/);
			if (mu) { o.unlockedExpr = mu[1].trim(); }
			var ml = block.match(/lockedMessage\s*:\s*((?:"(?:[^"\\]|\\.)*"|[^,}]*))/);
			if (ml) { o.lockedExpr = ml[1].trim(); }
			defs[km[1]] = o;
		}
		return Object.keys(defs).length ? defs : null;
	}
	/* 从 widget 文本解析 scenes 注册表（字符串感知，不 eval 整个对象） */
	function parseScenesFromText(text) {
		var m = text.match(/<<set\s+\$scenes\s+to\s+\{/);
		if (!m) { m = text.match(/\$scenes\s+to\s+\{/); }
		if (!m) { return null; }
		var start = m.index + m[0].length - 1;
		var depth = 0, i = start, end = -1, inStr = false;
		for (; i < text.length; i++) {
			var c = text.charAt(i);
			if (inStr) {
				if (c === "\\") { i++; }
				else if (c === '"') { inStr = false; }
			} else if (c === '"') { inStr = true; }
			else if (c === "{") { depth++; }
			else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
		}
		if (end < 0) { return null; }
		var body = text.slice(start + 1, end);
		return parseSceneBlocks(body);
	}
	/* v1.4.8：Story 全文恢复——widget "scenes" 段落定位失败（汉化/变体/结构改动）时，
	   遍历全部段落，用键块扫描提取含 scenePassages.includes 解锁表达式的场景定义 */
	function recoverSceneDefsFromStory() {
		try {
			var ps = listAllPassages();
			var collected = {};
			for (var i = 0; i < ps.length; i++) {
				var t = unescapeTweeEntities(ps[i].text);
				if (!t || t.indexOf("unlocked") === -1 || t.indexOf("scenePassages") === -1) { continue; }
				var defs = parseSceneBlocks(t);
				if (defs) {
					var ks = Object.keys(defs);
					for (var j = 0; j < ks.length; j++) {
						var d = defs[ks[j]];
						if (d.unlockedExpr && d.unlockedExpr.indexOf("scenePassages") !== -1) {
							collected[ks[j]] = d; /* 只收 scenePassages 解锁的（原版/模组场景定义特征） */
						}
					}
				}
			}
			return Object.keys(collected).length ? collected : null;
		} catch (e) { return null; }
	}
	/* 场景注册表：优先解析 Story 原文（实时求值 unlocked）→ Story 全文恢复 → V.scenes 缓存 */
	function getScenesDefs() {
		var parsed = null;
		try { parsed = parseScenesFromText(findScenesWidgetText()); } catch (e) { parsed = null; }
		if (parsed) {
			/* v1.9.2 自查：MOD 运行时注入（Object.assign($scenes, {...}) / 框架注册）的键只在
			   V.scenes 存档缓存、不在 widget 原文——合并进解析结果，确保 MOD 区显示运行时新增场景 */
			var V2 = getV();
			var sc2 = V2 && V2.scenes;
			if (sc2 && typeof sc2 === "object") {
				Object.keys(sc2).forEach(function (k) {
					if (parsed[k]) { return; }
					var s = sc2[k];
					if (!s || typeof s !== "object") { return; }
					parsed[k] = {
						name: s.name, startPassage: s.startPassage, passages: Array.isArray(s.passages) ? s.passages.slice() : [],
						unlockedExpr: typeof s.unlocked === "string" ? s.unlocked : "",
						lockedExpr: typeof s.lockedMessage === "string" ? s.lockedMessage : "",
						lockedCache: s.lockedMessage, unlockedCache: s.unlocked
					};
				});
			}
			return { defs: parsed, live: true };
		}
		/* v1.4.8：widget 段落定位失败 → Story 全文恢复（汉化/段落名变体兜底） */
		var recovered = null;
		try { recovered = recoverSceneDefsFromStory(); } catch (e) { recovered = null; }
		if (recovered) { return { defs: recovered, live: true }; }
		var V = getV();
		var sc = V && V.scenes;
		if (sc && typeof sc === "object") {
			var out = {};
			Object.keys(sc).forEach(function (k) {
				var s = sc[k];
				if (!s || typeof s !== "object") { return; }
				out[k] = {
					name: s.name, startPassage: s.startPassage, passages: Array.isArray(s.passages) ? s.passages.slice() : [],
					manualVariableChanges: s.manualVariableChanges,
					/* v1.4.8：缓存里 unlocked 若为表达式字符串（原版 scenes 对象字面量形态）→ 可提取解锁标记一键完成 */
					unlockedExpr: typeof s.unlocked === "string" ? s.unlocked : "",
					lockedExpr: typeof s.lockedMessage === "string" ? s.lockedMessage : "",
					lockedCache: s.lockedMessage, unlockedCache: s.unlocked
				};
			});
			return Object.keys(out).length ? { defs: out, live: false } : { defs: {}, live: false };
		}
		return { defs: {}, live: false };
	}
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
				{ key: "kylar_seen", name: "已看剧情标记补全", type: "action", action: "kylarSeen", note: "补全凯拉尔线 8 个已看标记：悉尼写作(sydneyWriting)·悉尼线 / 表白(saidLove)·主线 / 突击队(commando)·绑架线 / 冬季喷泉(fountainWinter)·冬季 / 喷泉初遇(fountainIntro)·初遇 / 聊天初遇(chatIntro)·初遇 / 食堂(canteen)·校园 / 地下室(basement)·绑架" }
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
		if (action === "kylarSeen") {
			if (!Array.isArray(V.kylarSeen)) { V.kylarSeen = []; }
			["sydneyWriting", "saidLove", "commando", "fountainWinter", "fountainIntro", "chatIntro", "canteen", "basement"].forEach(function (t) {
				if (V.kylarSeen.indexOf(t) === -1) { V.kylarSeen.push(t); }
			});
			return "已补全凯拉尔剧情标记（" + V.kylarSeen.length + " 项）";
		}
		return "未知动作";
	}

