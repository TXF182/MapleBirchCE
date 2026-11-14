/* 职责：核心基础层 —— 版本号 / 错误取值池 / 存档对象守卫 / 角色与属性读写（getV·writeStat·fillStats） */
	/* ============ 基础 ============ */
	/* 面板版本号（v1.8.3：修复面板标题版本号写死为 v1.2 的遗留问题，随版本自动更新） */
	var MCE_VERSION = "2.1.6";
	/* v2.1.6 类名常量表：把散在 40+ 分片的高频 "mce-xxx" 字面量收口到一处，改类名只改这里；
	   新代码一律用 MCE_CLS.xxx，不要再手写字符串（选择器写法 ".mce-x" 带前导点，不在此表）。 */
	var MCE_CLS = { err: "mce-err", ok: "mce-ok", hint: "mce-hint", row: "mce-row", rowLbl: "mce-row-lbl", btn: "mce-btn", gold: "mce-gold", inp: "mce-inp" };
	/* v2.0.4 类型债清理：catch 变量在 strict 下是 unknown，内联读 .message 会报 TS2339/TS18046。
	   此处收口为单一取值函数，语义与内联写法完全一致（有 message 用 message，否则用原值）。 */
	/** @param {any} e @returns {any} */
	function mbCEErr(e) { return (e && e.message) ? e.message : e; }
	/* v2.0.12 错误池：静默 catch 的兜底记录。只进内存、不进存档、上限 48 条（环形丢最旧）。
	   接入判据见 docs/catch-policy.md：**只有「失败后玩家状态与面板显示会不一致」的路径才接入**；
	   探测/降级类 catch（`typeof X === "function"` 这类能力嗅探）保持静默——它们失败即走降级分支，
	   属设计意图，接入只会在缺环境时刷屏，反而淹没真错误。
	   窗口挂载 window.__mceErrPool 供实机探针（moli）直接读取，不必进 passage 开面板。 */
	var mbCEErrPool = [];
	/** @param {string} where @param {any} e */
	function mbCECatch(where, e) {
		try {
			if (mbCEErrPool.length >= 48) { mbCEErrPool.shift(); }
			mbCEErrPool.push({ where: String(where), msg: String(mbCEErr(e)), t: Date.now() });
			if (typeof window !== "undefined" && window) { window.__mceErrPool = mbCEErrPool; }
		} catch (eIgnored) { /* 记录器自身失败必须静默，否则级联成二次错误 */ }
	}
	function mbCEErrPoolDump() { return mbCEErrPool.slice(); }
	function getV() {
		try { if (typeof V !== "undefined" && V && typeof V === "object") { return V; } } catch (e) {}
		try { if (typeof State !== "undefined" && State.variables) { return State.variables; } } catch (e) {}
		return {};
	}
	/* v2.0.10：存档变量是否**真实**就绪。getV() 在未读档时返回 {} 兜底，truthy 但不可写；
	   适配器若用 `!v` 判空会永远不成立（分支不可达），写进 {} 也只落在临时对象上。 */
	/* hasV：存档是否真的可写。getV() 未读档时返回 {}（truthy），不能靠 !v 判；这里看引擎挂在
	   window 上的两处来源（V 与 State.variables），既不会误判空对象，也不会被同名作用域变量遮蔽。 */
	function hasV() {
		return !!(typeof window !== "undefined" && (window.V && typeof window.V === "object" || window.State && window.State.variables));
	}
	function getSetup() {
		try { if (typeof setup !== "undefined" && setup) { return setup; } } catch (e) {}
		return {};
	}

	/* ============ 框架解析（window.maplebirch 优先，setup.MapleBirch 回退） ============ */
	var MB = null;
	function resolveMB() {
		if (MB) { return MB; }
		try {
			if (typeof window !== "undefined" && window.maplebirch) { MB = window.maplebirch; }
			else if (getSetup().MapleBirch) { MB = getSetup().MapleBirch; }
		} catch (e) { MB = null; }
		return MB;
	}
	function frameworkReady() {
		var mb = resolveMB();
		return !!(mb && mb.npc);
	}

	/* 框架版本闸门已拆到 01c-fwgate.js（v2.1.2，结构门禁 S1）：mbCEFrameworkGate / mbCECompareVersion / mbCEFrameworkGateOnce */

	/* ============ 数值定义（通用标准，非角色硬编码） ============ */
	/** @type {Array<{key: string, label: string, fill: number, max: number, min?: number, custom?: boolean}>} */
	var STAT_DEFS = [
		{ key: "love",      label: "爱意", fill: 100, max: 100 },
		{ key: "lust",      label: "情欲", fill: 100, max: 100 },
		{ key: "dom",       label: "支配", fill: 100, max: 100 },
		{ key: "obedience", label: "服从", fill: 100, max: 100 },
		{ key: "trust",     label: "信任", fill: 100, max: 100 },
		{ key: "wary",      label: "警戒", fill: 0,   max: 100 },
		{ key: "jealousy",  label: "嫉妒", fill: 0,   max: 100 }
	];

	/* v1.9.27：框架 MB.npc.customStats 注册属性的中文显示（阶段页数值行直显 key 的兜底汉化）。
	   仅收录玩家会看到的恋爱线英文名；未收录的自定义属性保持 key 直显（兜底，不猜义）。 */
	var CUSTOM_STAT_CN = {
		"conviction": "执念",
		"doubt": "疑虑"
	};

	/* ============ 中文显示层（仅 UI 展示，不影响任何逻辑/存档） ============ */
	var DISPLAY_NAMES = {
		"robin": "罗宾", "whitney": "惠特尼", "kylar": "凯拉尔", "sydney": "悉尼",
		"eden": "伊甸", "avery": "艾弗里", "black wolf": "黑狼", "great hawk": "巨鹰",
		"alex": "艾利克斯", "gwylan": "格威岚", "jordan": "约旦", "leighton": "礼顿",
		"bailey": "贝利", "remy": "雷米", "landry": "兰德里", "wren": "伦恩",
		"winter": "温特", "briar": "布莱尔", "mason": "梅森", "doren": "多伦",
		"sam": "萨姆", "charlie": "查里", "mickey": "米奇", "harper": "哈珀",
		"quinn": "奎恩", "darryl": "达里尔", "niki": "尼奇", "luna": "露娜", "raven": "渡鸦", "ivory wraith": "怨灵", "adian": "阿电",
		"zephyr": "泽菲尔", "morgan": "摩根", "river": "瑞沃", "sirris": "西里斯", "night monster": "夜魔",
		/* v1.8.3：模组枚举角色中文映射（音译初版，可在游戏内按实际名称校对调整） */
		"tsukihan": "月羽", "rowan": "罗文", "adrian": "阿德里安", "marlow": "马洛",
		"grant": "格兰特", "needmeet": "遇欲", "feng": "老冯",
		/* v1.8.19：Maplebirch 恋爱扩展/模组注入角色（用户实测角色页仍有英文名） */
		"seath": "希斯", "alice": "爱丽丝", "liddell": "利德尔"
	};
	function displayName(name) {
		try {
			var k = String(name || "").trim().toLowerCase();
			if (k && DISPLAY_NAMES[k]) { return DISPLAY_NAMES[k]; }
		} catch (e) {}
		return name;
	}
	var STATE_CN = {
		"active": "活跃", "stable": "稳定", "dungeon": "地牢", "prison": "监狱",
		"dismissed": "已辞退", "pregnant": "怀孕", "ill": "生病", "asleep": "沉睡"
	};
	function stateCN(s) {
		try {
			var k = String(s || "").toLowerCase();
			if (k && STATE_CN[k]) { return STATE_CN[k] + "（" + s + "）"; }
		} catch (e) {}
		return s;
	}
	var TYPE_CN = {
		"wolf": "狼", "harpy": "哈比", "fox": "狐", "tentacle": "触手", "cat": "猫",
		"bull": "公牛", "cow": "母牛", "wolf pack": "狼群", "swan": "天鹅",
		"angel": "天使", "demon": "恶魔", "siren": "塞壬", "horse": "马", "deer": "鹿"
	};
	function typeCN(t) {
		try {
			var k = String(t || "").trim().toLowerCase();
			if (k && TYPE_CN[k]) { return TYPE_CN[k]; }
		} catch (e) {}
		return t;
	}

	/* ============ 角色枚举（方案A：动态注册池，零硬编码） ============ */
	function listCharacters() {
		var names = [];
		var seen = new Set();
		function push(n) {
			if (typeof n === "string" && n.trim()) {
				var k = n.trim().toLowerCase();
				if (!seen.has(k)) { seen.add(k); names.push(n.trim()); }
			}
		}
		try {
			var npc = MB && MB.npc;
			if (npc) {
				if (npc.data instanceof Map) { npc.data.forEach(function (_v, name) { push(name); }); }
				if (Array.isArray(npc.NPCNameList)) { npc.NPCNameList.forEach(push); }
				if (npc.romanceConditions && typeof npc.romanceConditions === "object") {
					Object.keys(npc.romanceConditions).forEach(push);
				}
				if (npc.type && typeof npc.type === "object") {
					Object.keys(npc.type).forEach(function (k) {
						if (Array.isArray(npc.type[k])) { npc.type[k].forEach(push); }
					});
				}
			}
		} catch (e) {}
		try {
			var nl = getV().NPCName;
			if (Array.isArray(nl)) {
				nl.forEach(function (n) { if (n && n.nam) { push(n.nam); } });
			}
		} catch (e) {}
		try {
			var st = getV().maplebirch && getV().maplebirch.npc;
			if (st && typeof st === "object") { Object.keys(st).forEach(push); }
		} catch (e) {}
		/* v1.9.0 持久 NPC（per_npc 注册表实证枚举：只在存档已生成时出现） */
		try {
			var per = getV().per_npc;
			if (per && typeof per === "object") {
				Object.keys(per).forEach(function (k) {
					if (isPerNpcRole(k) && per[k] && typeof per[k] === "object") { push(k); }
				});
			}
		} catch (e) {}
		return names;
	}

	/* ============ v1.9.0 角色分类：模组/恋爱/普通/持久NPC（按类型拆角色页子页面） ============ */
	/* 原版 32 个命名 NPC（固定清单，来源：DoL 0.5.12.13 原版。v1.9.2 起不再读运行时 setup.NPCNameList——
	   它会随 MOD 扩展而污染"是否原版"判定，见 vanillaNPCList 注释） */
	var VANILLA_NPC_NAMES = [
		"Avery", "Bailey", "Briar", "Charlie", "Darryl", "Doren", "Eden", "Gwylan",
		"Harper", "Jordan", "Kylar", "Landry", "Leighton", "Mason", "Morgan", "River",
		"Robin", "Sam", "Sirris", "Whitney", "Winter", "Black Wolf", "Niki", "Quinn",
		"Remy", "Alex", "Great Hawk", "Wren", "Sydney", "Ivory Wraith", "Zephyr", "Night Monster"
	];
	/* 原版官方恋人清单（固定清单，同理不读运行时 loveInterestNpc） */
	var VANILLA_LOVE_INTERESTS = ["Robin", "Whitney", "Kylar", "Sydney", "Eden", "Avery", "Black Wolf", "Great Hawk", "Alex", "Gwylan"];
	/* 持久 NPC 角色键（原版 allowed_npcs 注册表；守卫/囚犯/坐骑为角色族，变体名以 _<键> 结尾） */
	var PER_NPC_ROLES = ["steed", "guard", "inmate", "panty_thief", "school_nurse", "pinch", "black_dog", "hacker", "bishop", "bishop_right_hand", "bishop_left_hand", "manager", "alexs_parent1", "alexs_parent2", "whitneys_auncle", "whitney_parent_flat"];
	var PER_NPC_CN = {
		"manager": "经理", "hacker": "黑客·米奇", "school_nurse": "校医", "bishop": "主教",
		"bishop_right_hand": "主教右侍", "bishop_left_hand": "主教左侍", "black_dog": "黑狗",
		"pinch": "皮奇", "steed": "坐骑", "panty_thief": "内衣贼",
		"alexs_parent1": "艾利克斯父母", "alexs_parent2": "艾利克斯父母",
		"whitneys_auncle": "惠特尼姑/叔", "whitney_parent_flat": "惠特尼父母公寓",
		"guard": "守卫", "inmate": "囚犯"
	};
	/* v1.9.2 自查修复：不再读运行时 setup.NPCNameList/loveInterestNpc——MOD 会把新角色名
	   扩展进这两个清单（原版角色池扩展机制），导致 MOD 角色被误判为原版而分进恋爱/普通区。
	   锁定 DoL 0.5.12.13 固定清单判定，MOD 扩展不影响"是否原版"分类。 */
	function vanillaNPCList() {
		return VANILLA_NPC_NAMES.map(function (n) { return String(n).toLowerCase(); });
	}
	function vanillaLoveInterests() {
		return VANILLA_LOVE_INTERESTS.map(function (n) { return String(n).toLowerCase(); });
	}
	function isVanillaNPC(name) {
		return vanillaNPCList().indexOf(String(name || "").trim().toLowerCase()) !== -1;
	}
	function isVanillaLoveInterest(name) {
		return vanillaLoveInterests().indexOf(String(name || "").trim().toLowerCase()) !== -1;
	}
	/* 持久 NPC 判定：精确键 或 角色族变体（xxx_guard / xxx_inmate / saddled_steed）；"guardian" 这类前缀不误判 */
	function isPerNpcRole(name) {
		var k = String(name || "").trim().toLowerCase();
		for (var i = 0; i < PER_NPC_ROLES.length; i++) {
			var r = PER_NPC_ROLES[i].toLowerCase();
			if (k === r || (k.length > r.length + 1 && k.lastIndexOf("_" + r) === k.length - r.length - 1)) { return true; }
		}
		return false;
	}
	/* 恋爱角色判定：官方恋人清单 或 框架恋爱条件 或 框架 loveInterest 标记（原版恋爱阶段另算） */
	function isLoveCharacter(name) {
		if (isVanillaLoveInterest(name)) { return true; }
		try {
			if (getRomanceList(name).length > 0) { return true; }
		} catch (e) {}
		try {
			var mb = resolveMB();
			if (mb && mb.npc && mb.npc.data instanceof Map) {
				var k2 = String(name).toLowerCase();
				/** @type {any} */
				var hit = null;
				mb.npc.data.forEach(function (v, key) {
					if (!hit && String(key).toLowerCase() === k2) { hit = v; }
				});
				var d = hit;
				if (d && d.Config && d.Config.loveInterest === true) { return true; }
			}
		} catch (e) {}
		return false;
	}
	/* v2.0.0.002 需求③：FertilityExpansion 的孩子识别。
	   源码实证（_modcache/fert_tmp/.../modules/eden-breeding.js:292-305 encounterCarrier）：
	   孩子「成年结算」后会被写进 $NPCList，条目带 edenChildId 字段，fullDescription 就是 descriptionFor(childId)
	   （模组用这个名字做身份比对，名字永不作为键）。这类 NPC 的随机英文名不属于原版 32 个名字，
	   会被 charCategory 判成 "mod" 而混进角色页（玩家截图「多出一堆英文名」即此）。
	   这里只按 edenChildId 标记识别，不猜名字、不猜种族，判不出来就维持原分类。 */
	function mbCEEdenChildIdOf(name) {
		try {
			if (name === null || name === undefined) { return null; }
			var V = (typeof getV === "function") ? getV() : null;
			if (!V || !Array.isArray(V.NPCList)) { return null; }
			var key = String(name).trim();
			if (!key) { return null; }
			var list = V.NPCList;
			for (var i = 0; i < list.length; i++) {
				var npc = list[i];
				if (!npc || typeof npc !== "object") { continue; }
				if (npc.edenChildId === undefined || npc.edenChildId === null || npc.edenChildId === "") { continue; }
				var nm = (npc.fullDescription !== undefined && npc.fullDescription !== null) ? npc.fullDescription : npc.name;
				if (nm === undefined || nm === null) { continue; }
				if (String(nm) === key) { return String(npc.edenChildId); }
			}
			return null;
		} catch (e) { return null; }
	}
	/* 角色分类（优先级：伊甸孩子 > 持久NPC > 模组 > 恋爱 > 普通） */
	function charCategory(name) {
		if (mbCEEdenChildIdOf(name) !== null) { return "edenChild"; }
		if (isPerNpcRole(name)) { return "pernpc"; }
		if (!isVanillaNPC(name)) { return "mod"; }
		if (isLoveCharacter(name)) { return "love"; }
		return "normal";
	}
	/* 持久 NPC 显示名：类型中文 + （随机名）；黑客 name_known=1 时用 V.mickeyName（原版 perName 逻辑）；
	   角色族变体键（xxx_guard / xxx_inmate / saddled_steed）回退显示族中文名，不再裸显英文键名 */
	function perNpcDisplayName(key) {
		var base = PER_NPC_CN[key];
		if (!base) {
			var k = String(key || "").trim().toLowerCase();
			var fam = null;
			for (var fi = 0; fi < PER_NPC_ROLES.length; fi++) {
				var r = PER_NPC_ROLES[fi].toLowerCase();
				if (k.length > r.length + 1 && k.lastIndexOf("_" + r) === k.length - r.length - 1) {
					fam = PER_NPC_CN[PER_NPC_ROLES[fi]] || PER_NPC_ROLES[fi];
					break;
				}
			}
			base = fam || displayName(key) || key;
		}
		try {
			var Vx = getV();
			var p = Vx.per_npc && Vx.per_npc[key];
			if (p && typeof p === "object" && typeof p.name === "string" && p.name) {
				var n = p.name;
				if (String(key).toLowerCase() === "hacker" && p.name_known === 1 && Vx.mickeyName) { n = Vx.mickeyName; }
				return base + "（" + n + "）";
			}
		} catch (e) {}
		return base;
	}
	function displayNameEx(name) {
		if (isPerNpcRole(name)) { return perNpcDisplayName(name); }
		return displayName(name);
	}
	/* 运行时 NPC 对象扩展：findNpc 未命中时查 per_npc（持久 NPC 卡数值读写通道） */
	function findNpcEx(name) {
		var n = findNpc(name);
		if (n) { return n; }
		try {
			var per = getV().per_npc;
			if (per && typeof per === "object") {
				var k = String(name).toLowerCase();
				var pk = Object.keys(per);
				for (var i = 0; i < pk.length; i++) {
					if (pk[i].toLowerCase() === k && per[pk[i]] && typeof per[pk[i]] === "object") { return per[pk[i]]; }
				}
			}
		} catch (e) {}
		return null;
	}

	/* 运行时 NPC 对象（DoL V.NPCName，按名不区分大小写匹配） */
	function findNpc(name) {
		try {
			var nl = getV().NPCName;
			if (Array.isArray(nl)) {
				var k = String(name).toLowerCase();
				for (var i = 0; i < nl.length; i++) {
					var n = nl[i];
					if (n && n.nam && String(n.nam).toLowerCase() === k) { return n; }
				}
			}
		} catch (e) {}
		return null;
	}

	/* 角色状态 active/inactive（DoL characters.npc.<名>.state） */
	function getNpcState(name) {
		try {
			var chars = getV().characters && getV().characters.npc;
			if (chars && typeof chars === "object") {
				var k = String(name).toLowerCase();
				var keys = Object.keys(chars);
				for (var i = 0; i < keys.length; i++) {
					if (keys[i].toLowerCase() === k) {
						var obj = chars[keys[i]];
						var st = obj && typeof obj.state === "string" && obj.state ? obj.state : "active";
						return { found: true, state: st };
					}
				}
			}
		} catch (e) {}
		return { found: false, state: "active" };
	}

	/* ============ 数值读写 ============ */
	function statDefsFor(npcName) {
		var out = STAT_DEFS.slice();
		try {
			var cs = MB && MB.npc && MB.npc.customStats;
			if (cs && typeof cs === "object") {
				Object.keys(cs).forEach(function (k) {
					var c = cs[k];
					if (c && typeof c === "object" && Number.isFinite(Number(c.max))) {
						var min = Number.isFinite(Number(c.min)) ? Number(c.min) : 0;
						out.push({ key: k, label: CUSTOM_STAT_CN[k] || k, fill: Number(c.max), max: Number(c.max), min: min, custom: true });
					}
				});
			}
		} catch (e) {}
		return out;
	}
	function statValue(npc, name, def) {
		if (npc && npc[def.key] != null && Number.isFinite(Number(npc[def.key]))) { return Number(npc[def.key]); }
		try {
			var cs = MB && MB.npc && MB.npc.customStats;
			if (cs && cs[def.key] && Number.isFinite(Number(cs[def.key].default))) { return Number(cs[def.key].default); }
		} catch (e) {}
		return 0;
	}
	function writeStat(npc, name, def, val) {
		if (!npc) { return 0; }
		/* v1.9.10：快捷面板数值上限不钳制（def.max 仅作 UI 参考），保留下限防负值破坏 */
		var min = def.min != null ? def.min : 0;
		var v = Math.round(Number(val) || 0);
		npc[def.key] = Math.max(min, v);
		return npc[def.key];
	}
	function fillStats(npc, name) {
		var n = 0;
		if (!npc) { return n; }
		statDefsFor(name).forEach(function (def) {
			writeStat(npc, name, def, def.fill);
			n += 1;
		});
		return n;
	}

