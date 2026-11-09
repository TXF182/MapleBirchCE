
/*
 * ============================================================
 * Maplebirch CE 全局全自动剧情条件解锁面板（Twee MOD）
 * - 适配：SugarCube 2 + Degrees of Lewdity（本地 HTML / 网页版）+ maplebirchFramework v5.x
 * - 方案A：读取框架全局注册池（maplebirch.npc），自动扫描
 *   游戏本体全部角色 + 全部已加载 MOD 角色；零硬编码角色数据。
 * - 自动解析：原生恋爱剧情条件（romanceConditions / Config.romance）、
 *   转化阶段（Transformation build/level/levels 门槛）、
 *   角色数值（爱意 love / 支配 dom / 情欲 lust / 警戒 wary 等）。
 * - 阶段判定：条件求值 → 绿色已达成 / 红色未达成，逐条显示条件原文。
 * - 一键完成：先补齐数值至门槛 → 再激活阶段 Flag（规避框架自动校验重置）。
 * - 容错：框架未加载 / 角色缺失 / 条件不可解析时仅提示，不抛错、不炸档。
 *
 * v1.1（2026-10-13）：
 *  - 修复 SugarCube 2.36.1 段落枚举：Story.passages 已移除 → 统一走
 *    listAllPassages()（Story.passages 兼容 + Story.lookupWith 主路径），
 *    场景页「场景直达」与剧情页「$scenes 注册表」恢复可用；
 *  - 剧情文本实体反转义（&lt;&lt;→<<），兼容 HTML 转义形态的 widget 文本；
 *  - 新增「固定触发」：剧情页把任一剧情（含 MOD 注册场景，如罗宾神殿剧情）
 *    固定为下次推进剧情（遇见角色）即自动重放；「回退」恢复原版随机触发。
 *    复用原版 $replayScene 重放通道 + freezePlayerStats，零副作用。
 * v1.3.5（2026-10-15）：格威岚场景直达崩溃闭环——ensureGwylanSceneState()
 *  幂等补齐 T.gwylanStatus/T.gwylanTF（statusCheck 仅 init===1 才初始化），
 *  挂 :passageinit 全局钩子（mbCEOnPassageInit），任意入口先行补齐。
 * v1.4.0（2026-10-15）：新增第 6 主页面「Mod作弊」——第三方模组扩展内容
 *  作弊控制（主容器页展示模组列表 + 每模组独立子页面，四分组：模组新增任务/
 *  阶段&能力/自定义剧情/自定义数值修改）；注册制 setup.mbCE_modCheats +
 *  内置适配器 CHEAT_ADAPTERS + 被动探测 CHEAT_PASSIVE_PROBES 三通道动态发现；
 *  CHEAT_VANILLA_ROOTS 原版一级键过滤（loveInterest 拒、loveInterestList 可）；
 *  写入前父级链校验防 undefined、number isFinite+min/max 钳制、boolean 归一、
 *  list 型数组追加/移除（More Love Interests Mod 0.1.7.0 内置适配器）；
 *  全部修改留痕 V.mbCE_wrote（key=cheat:modId:op:item，含 before/after），
 *  每控件带「回退」按钮还原首次写入前状态。
 * v1.4.1（2026-10-15）：归途之书（默示录）适配——CHEAT_ADAPTERS
 *  ["revelation-the-book-of-return"] 探测 maplebirch.get('RobinTemple'/'TempleChoir')，
 *  状态键 V.RobinTemple（罗宾神殿路线）/V.TempleChoir（唱诗班），
 *  阶段 5（含字符串枚举：stage 七档/vigil_result/faith_band，setCheatStage 越界拒绝）、
 *  能力 6、剧情 1（祷告事件）、数值 8（0-1000 熟练度等钳制）；
 *  不暴露原版神殿变量 temple_rank/templePromised/temple_chastity_timer。
 * v1.4.2（2026-10-15）：DomRobin 适配——CHEAT_ADAPTERS["dom_robin"] 探测
 *  window.modUtils.getMod("DomRobin")（ModLoader 注册表，boot name=DomRobin）；
 *  边界隔离：DomRobin 大量复用原版罗宾线变量（robinpaid/renttime_fight/
 *  robinShouldPayBack/lemonadeUpgraded/robinPayBothNote/robinCouldPayBoth/
 *  robinSoldConsole 等一律不声明），只暴露模组自建键——
 *  阶段 1（直播周数 liveStreamStage 0-6，作者言灵明示可改）、能力 12
 *  （反抗战斗谈话/共同战斗/还债谈话/花环/直播准备/一起直播/4 项还钱进度）、
 *  数值 3（反抗链打赢次数 0-99、直播开关 0/1、柠檬水摊新商品列表）。
 * v1.4.3（2026-10-16）：枯木逢春适配——CHEAT_ADAPTERS["deadwood-reblooms"]
 *  探测 maplebirch.get("DeadwoodReblooms")（框架根模块，main.ts 注册）；
 *  状态键 V.RobinExpansion/V.LifeSimulation/V.StreetLife/V.BirdTower 等
 *  （Module.ts :variable 钩子 + super 构造 name 逐一实证）；
 *  阶段 6（店铺开办/气球支线/收容所/医生游戏/校园职务/历史课题，含字符串枚举）、
 *  能力 11、数值 18（摊位改造/反抗胜场/储备金/街头口碑/公路赛/金戒指/校园竞选值）；
 *  全量 grep 实证模组不读写原版顶层 rebellion/victories/self_rent 等，
 *  声明路径一律以模组模块根开头，绝不落到原版顶层键。
 * v1.4.5（2026-10-16）：实测反馈修复——①固定触发/场景直达后取消固定可能被困
 *  场景播放器且退出按钮消失：unpinScene 原先"先删 $replayScene 再跳转"，若跳转目标
 *  恰为 Scene Viewer passages，default 退出分支的 Back 链接依赖 $replayScene.exitpassage
 *  → Back 无源 → 退出按钮消失；改为"先清 sceneViewSwitch 无效值 → 跳转 → 再清理"，
 *  back 无效时保留 replayScene（播放器仍可手动 Back 退出）；onPassageOverride 新增
 *  dest===exitpassage（Back 正常返回原位）清理分支，杜绝残留。
 *  ②角色一览只显示能进恋人卡槽的角色：新增 isLoveCandidate（框架恋爱条件/原版恋爱
 *  阶段/恋爱标记 loveAlias·npcConfig·loveInterest/MLI 扩容恋人列表），非恋爱 NPC 不再展示。
 * v1.4.6（2026-10-16）：角色过滤方向修正——用户澄清：不要从角色一览"踢人"。
 *  ①撤销角色一览/阶段页默认角色的 isLoveCandidate 过滤：角色一览保留全部角色；
 *  ②非恋爱候选角色仅在恋爱阶段区不显示恋爱阶段（"不是恋爱角色的不显示"）；
 *  ③恋爱阶段兜底条件（loveInterest.includes("X")）一键完成 = 真正把角色加入恋人卡槽：
 *  新增 addLoveInterest——数组 push / 对象首个空槽（空对象写 primary）/ 槽位全满且存在
 *  MLI 扩容列表时写 loveInterestList（由模组 widget 自动重建槽位），绝不覆盖已有恋人；
 *  undoRomanceStage 支持 native 回退（移除卡槽 + 清痕迹）；checkNativeLove 收紧为仅
 *  npcConfig.loveInterest===true（important 重要 NPC 不再误判为恋爱候选）。
 * v1.4.7（2026-10-16）：Mod作弊 全链路自动化测试（test_mce.js 第 24 节 19 条）——
 *  数值/阶段更改→读回确认、越界钳制与拒绝、宿主缺失/vanilla 根保护、列表增删、
 *  任务跳过/完成、回退还原首次 before；API 导出补 cheatReadSafe（面板回显读取，供外部验证）。
 * v1.4.8（2026-10-16）：三大实测症状修复——
 *  ①剧情页「一键完成」对无 lockedMessage 的场景（惠特尼孤儿院/贞操装置等）失效：
 *    parseSceneBlocks 的 block 为 slice 出的键块（不含结尾 }），原 unlocked 正则 ",?\s*\}"
 *    匹配不到块尾 → unlockedExpr 提取失败 → 一键完成写不进解锁标记 → 复检恒「未达成」。
 *    补块尾 $ 分支；另加三层兜底：findScenesWidgetText 找不到 widget "scenes" 段落时
 *    找 "$scenes to {" 段落（汉化/段落名变体）、getScenesDefs 增加 Story 全文恢复
 *    （recoverSceneDefsFromStory 遍历段落键块扫描收 scenePassages.includes 解锁定义）、
 *    V.scenes 缓存里 unlocked 为表达式字符串时提升为 unlockedExpr；
 *    一键完成复检：includes 解锁标记已写入即达成（缓存静态布尔不再卡死）。
 *  ②固定触发场景播放完仍被困播放器/固定后不能自动解除：onPassageOverride 在
 *    Scene Viewer End 与「重放中链回 Scene Viewer passages」两个终点，MOD 固定触发
 *    （mbCE_replayOnce）一律自动改 passageArgs.name 回 exitpassage（原位）并补
 *    unfreezePlayerStats，跳过原版「Error occurred / Exit scene」手动步；原版手动
 *    重放保持原版行为不干预。触发处 mbCE_replayPending 改为仅 startPassage===
 *    "Scene Viewer passages" 时设置（直入剧情段落的场景链回 passages 时不被误判首次）。
 * v1.6.0（2026-10-18）：模组更新适配 + 新模组兼容（6 包源码实证）——
 *  ①归途之书 1.3.4 补录两大模块（1.3.1 起已注册但此前漏适配，用户反馈"阶段没收录"根因）：
 *   LostLamb（迷途羔羊·悉尼童年梦境线，V.LostLamb：talkVow 誓约 5 档 / ending 结局 4 档 /
 *   疑虑·恐惧·觉察 0-100 / recalled·active·known 秘密 3 项）与
 *   TempleDuties（神殿值勤系统，V.TempleDuties：oath 誓约 3 档 / bishop 主教进展 5 档 /
 *   manor 庄园线 5 档 / declaration 宣言 2 档 / watch.phase 守夜 7 档 / case.stage 案件 3 档 /
 *   duties 值勤 0-999 / archive 归档 3 值 / enrolled·review·候选同意 3 项）；
 *   RobinTemple/TempleChoir 常量 1.3.1→1.3.4 无变化，旧声明全部保留。
 *  ②枯木逢春 2.2.7 核对：20 模块 define 全同、V 键名不变（super name 逐一实证），
 *   仅 vanilla-plus 结构迁移（beauty 清空、新增 attitudes 特质）——原声明不受影响，
 *   新增能力 2 项：铁意志 ironWill / 受虐狂 sadomasochist（VanillaPlus.attitudes.*）。
 *  ③新增 SmartPhone Alpha 0.3.91 适配（万能的智能手机，V.Phone 实证 48 键）：
 *   stages 1（老冯线 FengLine 0/1/2）、values 7（摄影 photography 0-1000 /
 *   危险任务模式 TaskDanger 0/1 / 初遇老冯 FengMeeet / 放弃老冯线 MetFengGiveup /
 *   发现二手店 SecondShopKnown / 暴露场景计数 FengAcceptExposed 0-99 /
 *   悉尼直播陪伴 SydneySexLiveCompanion）；模组键全部为 0/1 数字语义（===1 判断），
 *   故一律走 number 型 values（checkbox 布尔会写 true 破坏 ===1 判断）。
 * ④框架 maplebirch 5.4.12 满足两内容模组新依赖（≥5.4.9 / ≥5.4.10）；SoftWet GameUI 2.7.0
 *  与 ModHub 1.7.6 为纯 UI/管理工具（无状态键），确认不冲突、无需适配。
 * ============================================================
 */
(function () {
	"use strict";

	/* ============ 基础 ============ */
	/* 面板版本号（v1.8.3：修复面板标题版本号写死为 v1.2 的遗留问题，随版本自动更新） */
	var MCE_VERSION = "2.0.12";
	/* v2.0.4 类型债清理：catch 变量在 strict 下是 unknown，内联读 .message 会报 TS2339/TS18046。
	   此处收口为单一取值函数，语义与内联写法完全一致（有 message 用 message，否则用原值）。 */
	/** @param {any} e @returns {any} */
	function mbCEErr(e) { return (e && e.message) ? e.message : e; }
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
	/* v1.8.15 九巡：面板写入留痕 V.mbCE_wrote 有界化——条目数 > 400 时按时间戳升序删除最旧一半。
	   防止长时间高强度操作导致留痕无限增长（每笔写入都占存档空间）；被删条目的回退窗口随之关闭（旧操作不再可回退）。 */
	function mbCEWroteTrim(V) {
		try {
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return; }
			var keys = Object.keys(V.mbCE_wrote);
			if (keys.length <= 400) { return; }
			keys.sort(function (a, b) {
				var ta = (V.mbCE_wrote[a] && typeof V.mbCE_wrote[a].t === "number") ? V.mbCE_wrote[a].t : 0;
				var tb = (V.mbCE_wrote[b] && typeof V.mbCE_wrote[b].t === "number") ? V.mbCE_wrote[b].t : 0;
				return ta - tb;
			});
			/* v2.0.8：锁定写回留痕（type:"lock"）不参与裁剪——每个被锁 key 只有一条，是「取消锁定 + 还原原值」的
			   唯一依据；被裁掉后再次写回会把 before 记成「已被锁定覆盖后的值」，回退就退化成原样还原、等于失效。 */
			var drop = Math.floor(keys.length / 2);
			var rm = 0, vi = 0;
			while (rm < drop && vi < keys.length) {
				var vLock = V.mbCE_wrote[keys[vi]];
				if (vLock && vLock.type === "lock") { vi++; continue; }
				try { delete V.mbCE_wrote[keys[vi]]; } catch (e) { V.mbCE_wrote[keys[vi]] = undefined; }
				rm++; vi++;
			}
		} catch (e) {}
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

	/* ============ 恋爱剧情阶段（原生条件，自动解析） ============ */
	function getRomanceList(name) {
		var list = null;
		try {
			var mb = resolveMB();
			if (mb && mb.npc) {
				var rc = mb.npc.romanceConditions;
				if (rc && typeof rc === "object") {
					var keys = Object.keys(rc);
					var k = String(name).toLowerCase();
					for (var i = 0; i < keys.length; i++) {
						if (keys[i].toLowerCase() === k) { list = rc[keys[i]]; break; }
					}
				}
				if (!Array.isArray(list)) {
					var d = mb.npc.data instanceof Map ? mb.npc.data.get(name) : null;
					if (!d && mb.npc.data instanceof Map) {
						var dk = String(name).toLowerCase();
						mb.npc.data.forEach(function (v, n2) { if (String(n2).toLowerCase() === dk) { d = v; } });
					}
					var cfg = d && d.Config;
					if (cfg && Array.isArray(cfg.romance)) { list = cfg.romance; }
				}
			}
		} catch (e) {}
		return Array.isArray(list) ? list : [];
	}
	/* 原生恋爱 NPC 判定（不走 Maplebirch 注册池，如阿电：V.loveInterest / setup.loveAlias / T.npcConfig 标记） */
	function checkNativeLove(name) {
		try {
			var V = getV();
			var li = V.loveInterest;
			if (li) {
				if (Array.isArray(li)) {
					for (var i = 0; i < li.length; i++) { if (li[i] && String(li[i]).toLowerCase() === String(name).toLowerCase()) { return true; } }
				} else if (typeof li === "object") {
					for (var k in li) { if (li[k] && String(li[k]).toLowerCase() === String(name).toLowerCase()) { return true; } }
				}
			}
			if (typeof setup !== "undefined" && setup && setup.loveAlias && setup.loveAlias[name]) { return true; }
			if (typeof T !== "undefined" && T && T.npcConfig) {
				var c = T.npcConfig[name];
				/* v1.4.5：仅明确的恋爱标记（loveInterest）算恋爱候选；important（重要 NPC）不算——
				   否则非恋爱角色会被误判为恋爱候选而在恋爱阶段区显示"恋人卡槽"条件 */
				if (c && c.loveInterest === true) { return true; }
			}
		} catch (e) {}
		return false;
	}
	/* 恋爱候选判定（v1.4.5）：能进恋人卡槽（loveInterest）的角色才在角色一览显示。
	   判定：框架恋爱条件 / 原版恋爱阶段系统（格威岚）/ 恋爱标记（loveAlias·npcConfig·loveInterest）/ MLI 扩容恋人列表 */
	function isLoveCandidate(name) {
		try {
			if (getRomanceList(name).length > 0) { return true; }
			if (hasVanillaRomance(name)) { return true; }
			if (checkNativeLove(name)) { return true; }
			var V = getV();
			if (V && Array.isArray(V.loveInterestList)) {
				var k = String(name).toLowerCase();
				for (var i = 0; i < V.loveInterestList.length; i++) {
					var it = V.loveInterestList[i];
					if (it && String(it).toLowerCase() === k) { return true; }
				}
			}
		} catch (e) {}
		return false;
	}
	function getRomanceStages(name) {
		var out = [];
		getRomanceList(name).forEach(function (fn, idx) {
			if (typeof fn !== "function") { return; }
			var txt = "";
			try { txt = String(fn); } catch (e) { txt = "(条件不可读)"; }
			var ok = false;
			try { ok = !!fn(); } catch (e) { ok = false; }
			out.push({ index: idx, text: txt, ok: ok, fn: fn });
		});
		/* 原生恋爱 NPC 兜底：框架无条件时给通用"恋人（loveInterest 槽位）"条件 */
		if (!out.length && checkNativeLove(name)) {
			out.push({
				index: 0,
				text: '() => rv.variables.loveInterest.includes("' + name + '")',
				ok: loveInterestHas(name),
				fn: null,
				native: true
			});
		}
		return out;
	}
	function loveInterestHas(name) {
		try {
			var V = getV();
			var li = V.loveInterest;
			if (!li) { return false; }
			if (Array.isArray(li)) {
				for (var i = 0; i < li.length; i++) { if (li[i] && String(li[i]).toLowerCase() === String(name).toLowerCase()) { return true; } }
			} else if (typeof li === "object") {
				for (var k in li) { if (li[k] && String(li[k]).toLowerCase() === String(name).toLowerCase()) { return true; } }
			}
		} catch (e) {}
		return false;
	}
	/* 加入恋人卡槽（v1.4.5）：恋爱阶段兜底条件（loveInterest.includes("X")）一键完成时调用——
	   把角色写入 V.loveInterest（数组 push / 对象首个空槽；槽位全满且存在 MLI 扩容列表时写入
	   loveInterestList，由模组 widget 自动重建 primary..；绝不覆盖已有恋人）。返回是否写入成功。 */
	function addLoveInterest(name) {
		try {
			var V = getV();
			if (!V) { return false; }
			var li = V.loveInterest;
			if (!li) { li = []; V.loveInterest = li; }
			if (Array.isArray(li)) {
				if (li.indexOf(name) === -1) { li.push(name); }
				recordNativeLoveWrite(name);
				return true;
			}
			if (typeof li === "object") {
				var wrote = false;
				Object.keys(li).forEach(function (k) {
					if (!wrote && (li[k] === "" || li[k] == null)) { li[k] = name; wrote = true; }
				});
				/* 空对象（无任何槽位键）→ 写入 primary 主槽（安全，无覆盖） */
				if (!wrote && Object.keys(li).length === 0) { li["primary"] = name; wrote = true; }
				if (!wrote) {
					/* 槽位全满：不覆盖已有恋人；存在 MLI 扩容列表则追加（模组 widget 会重建槽位） */
					if (Array.isArray(V.loveInterestList) && V.loveInterestList.indexOf(name) === -1) {
						V.loveInterestList.push(name); wrote = true;
					}
				}
				if (wrote) { recordNativeLoveWrite(name); }
				return wrote;
			}
		} catch (e) {}
		return false;
	}
	function recordNativeLoveWrite(name) {
		try {
			var V = getV();
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["romance:native:" + String(name).toLowerCase()] = { type: "native", path: "loveInterest", value: name, name: name, t: Date.now() }; /* 十巡：补 t 时间戳，否则 trim 排序兜底 0 永远优先裁剪本条目 */
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
		} catch (e) {}
	}

	/* 条件静态解析（读取函数源码，绝不 eval）：
	 * 支持框架原生条件形态：数值比较 / 字符串比较 / undefined 判断 /
	 * includes 追加 / 裸真值 / [X+"Seen"] 动态键。不可解析 → null（仅显示）。
	 */
	function parseCondition(fnStr, npcName) {
		var s = String(fnStr || "");
		var m;
		/* [X+"Seen"] 动态键（loveInterest 通用恋爱条件，闭包键形态） */
		m = s.match(/variables\[\s*\w+\s*\+\s*"Seen"\s*\]\s*\?\?\s*\[\s*\]\s*\)?\s*\.includes\(\s*"([^"]+)"\s*\)/);
		if (m) { return { type: "append", path: String(npcName).toLowerCase().replace(/\s+/g, "") + "Seen", value: m[1] }; }
		/* ["Seen"] 字面键形态 */
		m = s.match(/variables\[\s*["'](\w+)["']\s*\]\s*\?\?\s*\[\s*\]\s*\)?\s*\.includes\(\s*"([^"]+)"\s*\)/);
		if (m) { return { type: "append", path: m[1], value: m[2] }; }
		/* "x" !== characters.npc.X.state 或反向（rv.characters 与 rv.variables.characters 两种路径） */
		m = s.match(/"([^"]+)"\s*!==\s*(?:rv\.variables|rv|V|State\.variables)\.characters\.npc\.(\w+)\.state/);
		if (!m) {
			m = s.match(/(?:rv\.variables|rv|V|State\.variables)\.characters\.npc\.(\w+)\.state\s*!==\s*"([^"]+)"/);
			if (m) { m = [m[0], m[2], m[1]]; }
		}
		if (m) { return { type: "state", value: "stable" }; }
		/* 数值在前：N OP path */
		m = s.match(/(\d+(?:\.\d+)?)\s*(===|==|>=|>)\s*(?:rv\.variables|V|State\.variables)\.(\w+)/);
		if (m) {
			var a = Number(m[1]);
			return { type: "set", path: m[3], value: m[2] === ">" ? a + 1 : a };
		}
		/* 路径在前：path OP N */
		m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*(===|==|>=|>)\s*(\d+(?:\.\d+)?)/);
		if (m) {
			var b = Number(m[3]);
			return { type: "set", path: m[1], value: m[2] === ">" ? b + 1 : b };
		}
		/* undefined === path / path === undefined */
		m = s.match(/undefined\s*===?\s*(?:rv\.variables|V|State\.variables)\.(\w+)/);
		if (!m) { m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*===?\s*undefined/); }
		if (m) { return { type: "clear", path: m[1] }; }
		/* path?.includes("x") */
		m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*\?\?\s*\[\s*\]\s*\)?\s*\.includes\(\s*"([^"]+)"\s*\)/);
		if (!m) { m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*\??\.includes\(\s*"([^"]+)"\s*\)/); }
		if (m) { return { type: "append", path: m[1], value: m[2] }; }
		/* 裸真值：V.var（排除箭头函数 => 的 >） */
		m = s.match(/(?:rv\.variables|V|State\.variables)\.(\w+)\s*\)?\s*$/);
		if (m && !/[=<>!]/.test(s.replace(/===|==|>=|<=|!==|!=|=>/g, ""))) {
			return { type: "set", path: m[1], value: 1 };
		}
		return null;
	}
	function applyRomanceFix(parsed, npcName) {
		if (!parsed) { return false; }
		var v = getV();
		try {
			if (parsed.type === "set") {
				v[parsed.path] = Number(parsed.value);
				/* 一键完成艾利克斯农场阶段会把 $farm_stage 直接置高（绕过本体农场线初始化），
				   若不补 $farm 空壳，之后任何含 <<social>> 的段落会崩（读 $farm.beasts/aggro）→ 写入点立即兜底 */
				if (parsed.path === "farm_stage") { ensureFarmState(); }
				return true;
			}
			if (parsed.type === "clear") {
				try { delete v[parsed.path]; } catch (e) { v[parsed.path] = undefined; }
				return true;
			}
			if (parsed.type === "append") {
				var arr = v[parsed.path];
				if (Array.isArray(arr)) {
					if (arr.indexOf(parsed.value) === -1) { arr.push(parsed.value); }
					return true;
				}
				if (arr && typeof arr === "object") {
					/* 对象结构（如原版 V.loveInterest 按槽位存）→ 写入首个空槽 */
					var wrote = false;
					Object.keys(arr).forEach(function (k) {
						if (!wrote && (arr[k] === "" || arr[k] == null)) { arr[k] = parsed.value; wrote = true; }
					});
					if (!wrote) { arr["0"] = parsed.value; }
					return true;
				}
				arr = []; v[parsed.path] = arr; arr.push(parsed.value);
				return true;
			}
			if (parsed.type === "state") {
				var chars = v.characters && v.characters.npc;
				if (chars && typeof chars === "object") {
					var k = String(npcName).toLowerCase();
					var keys = Object.keys(chars);
					for (var i = 0; i < keys.length; i++) {
						if (keys[i].toLowerCase() === k) {
							if (chars[keys[i]] && typeof chars[keys[i]] === "object") { chars[keys[i]].state = "stable"; }
							return true;
						}
					}
				}
				return false;
			}
		} catch (e) { return false; }
		return false;
	}
	/* 一键完成单个恋爱阶段：先修复数值/Flag，再复检 */
	function completeRomanceStage(name, stage) {
		var parsed = null;
		var fixed = false;
		var ok = false;
		if (stage.native) {
			/* v1.4.5：兜底条件（loveInterest.includes("X")）一键完成 = 把角色加入恋人卡槽——
			   统一走 addLoveInterest（数组 push / 对象首个空槽 / 槽位全满写 MLI 扩容列表），
			   不走通用 applyRomanceFix（其 append 在对象无空槽时会写 "0" 新键，且不联动 MLI 列表） */
			ok = loveInterestHas(name);
			if (!ok) { ok = addLoveInterest(name); }
		} else {
			parsed = parseCondition(stage.text, name);
			fixed = applyRomanceFix(parsed, name);
			if (fixed && parsed) { recordRomanceWrite(parsed, name); }
			try { ok = !!stage.fn(); } catch (e) { ok = false; }
		}
		return { fixed: fixed, ok: ok, parsed: parsed };
	}
	function unlockAllRomance(name) {
		var n = 0, okCount = 0;
		getRomanceStages(name).forEach(function (st) {
			if (st.ok) { okCount += 1; return; }
			var r = completeRomanceStage(name, st);
			if (r.ok) { n += 1; }
		});
		return { fixed: n, total: getRomanceStages(name).length, passed: okCount };
	}

	/* ============ 转化阶段（build/level/levels 门槛 + 自动校验） ============ */
	var DEFAULT_LEVELS = [5, 10, 15, 20, 25, 30];
	function listStageTypes(npcName) {
		var key = String(npcName).toLowerCase();
		var out = new Map();
		try {
			var T = MB.npc.Transformation;
			if (T && T.configs instanceof Map) {
				var cfg = T.configs.get(key);
				if (cfg instanceof Map) {
					cfg.forEach(function (conf, type) {
						var lv = (conf && Array.isArray(conf.levels) && conf.levels.length) ? conf.levels : DEFAULT_LEVELS;
						out.set(type, lv);
					});
				}
			}
		} catch (e) {}
		try {
			var st = getV().maplebirch && getV().maplebirch.npc && getV().maplebirch.npc[key];
			var tf = (st && typeof st === "object") ? st.transformation : null;
			if (tf && typeof tf === "object") {
				Object.keys(tf).forEach(function (t) { if (!out.has(t)) { out.set(t, DEFAULT_LEVELS); } });
			}
		} catch (e) {}
		return out;
	}
	function readTransformState(npcName, type) {
		try {
			var T = MB.npc.Transformation;
			if (T && typeof T.get === "function") {
				var s = T.get(npcName, type);
				if (s && typeof s === "object") { return { build: Number(s.build) || 0, level: Number(s.level) || 0 }; }
			}
		} catch (e) {}
		try {
			var st = getV().maplebirch && getV().maplebirch.npc && getV().maplebirch.npc[String(npcName).toLowerCase()];
			var tf = (st && st.transformation) ? st.transformation[type] : null;
			if (tf && typeof tf === "object") { return { build: Number(tf.build) || 0, level: Number(tf.level) || 0 }; }
		} catch (e) {}
		return { build: 0, level: 0 };
	}
	function adjustTransform(npcName, type, delta) {
		try {
			var T = MB.npc.Transformation;
			if (T && typeof T.build === "function") { T.build(npcName, type, Number(delta) || 0); }
		} catch (e) {}
		return readTransformState(npcName, type);
	}
	function completeTransformStage(npcName, type, targetLevel) {
		try {
			var T = MB.npc.Transformation;
			if (!T || typeof T.set !== "function") { return false; }
			var levels = listStageTypes(npcName).get(type) || DEFAULT_LEVELS;
			var max = levels.length;
			var target = Math.max(0, Math.min(Math.round(Number(targetLevel) || 0), max));
			if (target <= 0) { T.set(npcName, type, 0); return true; }
			var threshold = levels[target - 1];
			var cur = readTransformState(npcName, type);
			var curBuild = Number.isFinite(Number(cur.build)) ? Number(cur.build) : 0;
			var delta = threshold - curBuild;
			if (Math.abs(delta) > 1e-6 && typeof T.build === "function") { T.build(npcName, type, delta); }
			T.set(npcName, type, target);
			return true;
		} catch (e) { return false; }
	}
	function unlockAllTransform(npcName) {
		var n = 0;
		listStageTypes(npcName).forEach(function (levels, type) {
			if (completeTransformStage(npcName, type, levels.length)) { n += 1; }
		});
		return n;
	}

	/* ============ 全局批量 ============ */
	function globalFill() {
		var chars = listCharacters();
		var n = 0;
		chars.forEach(function (name) {
			var npc = findNpc(name);
			n += fillStats(npc, name);
		});
		return { characters: chars.length, stats: n };
	}
	function globalRomance() {
		var chars = listCharacters();
		var fixed = 0, total = 0;
		chars.forEach(function (name) {
			var stages = getRomanceStages(name);
			total += stages.length;
			stages.forEach(function (st) {
				if (st.ok) { return; }
				if (completeRomanceStage(name, st).ok) { fixed += 1; }
			});
			if (hasVanillaRomance(name)) {
				total += VANILLA_STAGES.length;
				fixed += unlockVanillaAll(name);
			}
		});
		ensureFarmState(); /* 一键完成后兜底：若写入了 farm_stage（艾利克斯农场阶段），立即补 $farm 空壳防社交页崩 */
		return { characters: chars.length, total: total, fixed: fixed };
	}
	function globalTransform() {
		var chars = listCharacters();
		var fixed = 0;
		chars.forEach(function (name) { fixed += unlockAllTransform(name); });
		return { characters: chars.length, stages: fixed };
	}

	/* ============ v1.9.26：特殊服装（setup.specialClothes 款式）+ 食谱一键解锁
	     DoL 0.5.12.13 特殊服装 = setup.specialClothes（135 件款式，分属万圣节/圣诞/情人节/神殿等套装）；
	     解锁标志 = V.specialClothes[i].unlocked = 3（满足要求解锁）；
	     每件有对应"故事"前置条件（套装 requirements，如 tentacletrait/syndromekylar/temple_rank 等），
	     解锁时同步补足这些条件，让游戏认为玩家已完成对应剧情（服装合法获得，非凭空出现）。
	     食谱 = setup.foodstuff[key].recipe.ingredients 非空；学会标志 = V.foodstuff[key].knows_recipe = true。 ============ */
	/* 套装→补足条件映射（从 DoL 0.5.12.13 setup.specialClothesSets 实证提取）。
	   op: "set"=标量赋值, "push"=数组去重push, "ensureField"=确保对象+设子键。
	   日期条件（halloween/valentines）不补足——unlocked=3 已解锁，日期随游戏推进。 */
	var SPECIAL_CLOTHES_SET_COND = {
		witch: [{key:"tentacletrait", op:"set", val:1}],
		vampire: [{key:"syndromekylar", op:"set", val:1}],
		mummy: [{key:"specialClothesEvents", op:"push", val:"cocoon"}],
		scarecrow: [{key:"specialClothesEvents", op:"push", val:"farm_defended"}],
		skeleton: [{key:"crypt_intro", op:"set", val:1}],
		future_suit: [{key:"tenyclusPlayCount", op:"set", val:7}],
		christmas: [{key:"specialClothesEvents", op:"push", val:"skulduggery_gift"}],
		rose_wedding: [{key:"kylarSeen", op:"push", val:"basement"}],
		wrap: [{key:"gwylanSeen", op:"push", val:"steal_wrap"}],
		underground_brothel: [{key:"undergroundbrothelescaped", op:"set", val:true}],
		underground_farm: [{key:"livestock", op:"ensureField", val:{field:"intro", value:1}}],
		loincloth: [{key:"syndromeeden", op:"set", val:1}],
		bird: [{key:"syndromebird", op:"set", val:1}],
		prison: [{key:"prison_intro", op:"set", val:1}],
		asylum: [{key:"asylumescaped", op:"set", val:1}],
		temple_initiate: [{key:"temple_rank", op:"set", val:"monk"}],
		temple_monk_and_nun: [{key:"temple_rank", op:"set", val:"monk"}],
		temple_evangelist: [{key:"specialClothesEvents", op:"push", val:"temple_solicitation"}],
		temple_confessor: [{key:"temple_confessor_intro", op:"set", val:1}],
		temple_exorcist: [{key:"jordan_ritual_dance", op:"set", val:4}],
		temple_sparring: [{key:"prof", op:"ensureField", val:{field:"whip", value:600}}],
		temple_sexy: [{key:"world_corruption_reduced", op:"set", val:30}],
		holy_stole: [{key:"grace", op:"set", val:100}],
		holy_pendant: [{key:"soup_kitchen_known", op:"set", val:1}],
		stone_pendant: [{key:"stone_pendant_found", op:"set", val:1}],
		dark_pendant: [{key:"loft_known", op:"set", val:1}],
		museum_rags: [{key:"museum_horse_success", op:"set", val:1},{key:"museum_stool_success", op:"set", val:1}],
		vintage: [{key:"museumAntiques", op:"ensureField", val:{field:"paintings", value:{paintingward:"museum"}}}],
		chain_tunic: [{key:"hcEndings", op:"push", val:"S"}],
		foreign_school: [{key:"headdrive", op:"set", val:1}],
		brothel: [{key:"brothelshowdata", op:"ensureField", val:{field:"intro", value:1}}],
		chef: [{key:"chef_state", op:"set", val:9}],
		hookah: [{key:"hookah_state", op:"set", val:2}],
		islander: [{key:"islander_mask", op:"set", val:100}],
		fox_mask: [{key:"auriga_artefact", op:"set", val:1}],
		fedora: [{key:"specialClothesEvents", op:"push", val:"smuggling"}],
		catsuit: [{key:"catsuit_found", op:"set", val:1}],
		janet: [{key:"janet_book_read", op:"set", val:1}],
		dance_studio: [{key:"danceStudio", op:"ensureField", val:{field:"jobOffered", value:1}}],
		sage_witch_hat: [{key:"gwylanSeen", op:"push", val:"ritual_sex"}],
		familiar_collar: [{key:"gwylanSeen", op:"push", val:"familiar_collar"}],
		shrine: [{key:"fox", op:"set", val:6}],
		jasper: [{key:"gwylanSeen", op:"push", val:"request_gold_accessories"}],
		butterfly: [{key:"backgroundTraits", op:"push", val:"plantlover"}],
		succubus: [{key:"demon", op:"set", val:6}]
	};
	/* 单件条件（baseItem.requirements，非 set 条件） */
	var SPECIAL_CLOTHES_ITEM_COND = {
		"rose": [{key:"gwylanSeen", op:"push", val:"rose"}],
		"daisy": [{key:"plants_known", op:"push", val:"daisy"}],
		"flower crown": [{key:"specialClothesEvents", op:"push", val:"flowerCrownGH"}]
	};
	function globalUnlockClothes() {
		var V = getV(), setup = getSetup();
		var n = 0, stories = 0;
		try {
			if (!Array.isArray(setup.specialClothes)) { return { unlocked: 0, stories: 0 }; }
			if (!Array.isArray(V.specialClothes)) { V.specialClothes = []; }
			function applyCond(c) {
				try {
					if (c.op === "set") {
						if (V[c.key] !== c.val) { V[c.key] = c.val; stories += 1; }
					} else if (c.op === "push") {
						if (!Array.isArray(V[c.key])) { V[c.key] = []; }
						if (V[c.key].indexOf(c.val) === -1) { V[c.key].push(c.val); stories += 1; }
					} else if (c.op === "ensureField") {
						if (!V[c.key] || typeof V[c.key] !== "object") { V[c.key] = {}; }
						if (typeof c.val.value === "object" && c.val.value !== null) {
							/* value 是对象：确保 field 是对象，合并 value（不覆盖兄弟键，如 vintage.paintings 不丢其他画） */
							if (!V[c.key][c.val.field] || typeof V[c.key][c.val.field] !== "object") { V[c.key][c.val.field] = {}; }
							var chg = false;
							Object.keys(c.val.value).forEach(function (vk) {
								if (V[c.key][c.val.field][vk] !== c.val.value[vk]) { V[c.key][c.val.field][vk] = c.val.value[vk]; chg = true; }
							});
							if (chg) { stories += 1; }
						} else {
							if (V[c.key][c.val.field] !== c.val.value) { V[c.key][c.val.field] = c.val.value; stories += 1; }
						}
					}
				} catch (e) {}
			}
			setup.specialClothes.forEach(function (item) {
				/* v1.9.28：逐项守卫——坏条目（null/非对象/缺 name）跳过不中断，避免单条异常中止整批解锁 */
				if (!item || typeof item !== "object" || !item.name) { return; }
				var entry = null;
				for (var i = 0; i < V.specialClothes.length; i++) {
					if (V.specialClothes[i] && V.specialClothes[i].name === item.name) { entry = V.specialClothes[i]; break; }
				}
				if (!entry) { entry = { name: item.name, unlocked: 0 }; V.specialClothes.push(entry); }
				entry.unlocked = 3;
				n += 1;
				if (SPECIAL_CLOTHES_ITEM_COND[item.name]) { SPECIAL_CLOTHES_ITEM_COND[item.name].forEach(applyCond); }
				if (Array.isArray(item.sets)) {
					item.sets.forEach(function (set) {
						if (SPECIAL_CLOTHES_SET_COND[set]) { SPECIAL_CLOTHES_SET_COND[set].forEach(applyCond); }
					});
				}
			});
			/* v1.9.28：聚合审计留痕（type=batch，非面板写入——undo 按 rec.type!=="cheat" 拒绝，
			   不提供逐键回退；仅记录受影响的解锁数与联动故事计数，供玩家自查批量操作） */
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:global:unlockClothes"] = { type: "batch", modId: "global", op: "global_unlock:clothes", count: n, stories: stories, t: Date.now() };
			mbCEWroteTrim(V);
		} catch (e) {}
		return { unlocked: n, stories: stories };
	}
	function globalUnlockRecipes() {
		var V = getV(), setup = getSetup();
		var n = 0;
		try {
			if (setup.foodstuff && typeof setup.foodstuff === "object") {
				if (!V.foodstuff || typeof V.foodstuff !== "object") { V.foodstuff = {}; }
				Object.keys(setup.foodstuff).forEach(function (k) {
					var def = setup.foodstuff[k];
					/* v1.9.28：逐项守卫——坏定义跳过不中断整批 */
					if (!def || typeof def !== "object") { return; }
					if (def.recipe && def.recipe.ingredients && def.recipe.ingredients.length) {
						if (!V.foodstuff[k] || typeof V.foodstuff[k] !== "object") {
							V.foodstuff[k] = { amount: 0 };
						}
						V.foodstuff[k].knows_recipe = true;
						n += 1;
					}
				});
				/* v1.9.28：聚合审计留痕（type=batch，不可逐键回退，仅记录解锁数） */
				if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
				V.mbCE_wrote["cheat:global:unlockRecipes"] = { type: "batch", modId: "global", op: "global_unlock:recipes", count: n, t: Date.now() };
				mbCEWroteTrim(V);
			}
		} catch (e) {}
		return { unlocked: n };
	}

	/* ============ v2.0.3 回退语义补齐：维护写入统一走「幂等 + 首次 before 留痕」 ============
	   原维护函数是裸写（V[k] = 4 / 100 / 0），写入后无痕迹：玩家看不到自动维护改了什么，也无法撤回。
	   现所有「纯数值覆盖型」维护键统一走 mbCEMaintWrite：
	     - 值已到位则不写（幂等，避免每日调度重复写档）；
	     - 记录 key = maint:<点号路径>，before 保留「首次写入前」状态（undefined 亦记录，回退可删字段）；
	     - mbCEMaintUndo(path) 单键回退，mbCEMaintUndoAll() 全量回退。
	   不接留痕的三类（设计取舍，避免破坏模组状态机）：
	     ① 投喂：扣食材 + 经 wikifier 推进 avery_food_select 状态机；② 农场收获清库存：货已经 tending_give 发出；
	     ③ 战斗终结/恋爱阶段：走各自 dedicated 通道（cheat:* / romance:*）。 */
	function mbCEMaintWrite(path, val) {
		try {
			var V = getV();
			var parts = String(path || "").split(".");
			if (!V || !parts.length || !parts[0]) { return false; }
			var cur = V, i;
			for (i = 0; i < parts.length - 1; i++) {
				/* 维护不补壳：宿主（对象）缺失即视为模组未初始化，跳过该键 */
				if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") { return false; }
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			if (typeof cur[leaf] !== "number") { return false; }  /* 仅数值型维护键 */
			if (cur[leaf] === val) { return false; }              /* 幂等 */
			var before = cur[leaf];
			var key = "maint:" + path;
			var prev = V.mbCE_wrote && V.mbCE_wrote[key];
			if (prev && "before" in prev) { before = prev.before; }
			cur[leaf] = val;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote[key] = { type: "maint", path: path, before: before, after: val, t: Date.now() };
			mbCEWroteTrim(V);
			return true;
		} catch (e) { return false; }
	}
	function mbCEMaintUndo(path) {
		try {
			var V = getV(), key = "maint:" + path;
			if (!V || !V.mbCE_wrote || !V.mbCE_wrote[key]) { return { ok: false, msg: "无该维护写入留痕" }; }
			var rec = V.mbCE_wrote[key];
			var parts = String(path || "").split(".");
			var cur = V, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") { return { ok: false, msg: "宿主已被清除，无法回退" }; }
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			if (rec.before === undefined) { try { delete cur[leaf]; } catch (e) { cur[leaf] = undefined; } }
			else { cur[leaf] = rec.before; }
			try { delete V.mbCE_wrote[key]; } catch (e) { V.mbCE_wrote[key] = undefined; }
			return { ok: true, msg: "已回退 " + path + " 到维护写入前状态" };
		} catch (e) { return { ok: false, msg: "回退异常：" + mbCEErr(e) }; }
	}
	function mbCEMaintUndoAll() {
		try {
			var V = getV(), n = 0;
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return { ok: false, n: 0, msg: "无维护写入留痕" }; }
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				if (k.indexOf("maint:") !== 0) { return; }
				var r = mbCEMaintUndo(k.slice(6));
				if (r.ok) { n += 1; }
			});
			return { ok: n > 0, n: n, msg: n > 0 ? "已回退 " + n + " 项维护写入" : "无维护写入留痕" };
		} catch (e) { return { ok: false, n: 0, msg: "回退异常：" + mbCEErr(e) }; }
	}
	/* ============ v1.8.8：庄园自动维护（学 AutoClean 0.1.5 原功能，即时一键执行）
	     AutoClean 原实现：每日 0 点调 AutoCleanFeedAvery()（艾弗里优先吃想吃的菜）+ AutoCleanFarm()
	     （农场动物锁满/agro 清零/库存收获）。MCE 全局页提供同逻辑的即时按钮，数据逻辑与此处一致。 ============ */
	function mcFeedAvery() {
		var V = getV();
		/** @type {{fed: string, missed: boolean, skipped?: boolean, error?: string}} */
		var r = { fed: "", missed: false };
		var man = V.avery_mansion;
		try {
			if (V.avery_fate !== "saved" && V.avery_fate !== "ascended") {
				/* v1.8.9 对齐 AutoClean 0.1.5：仅 fate=saved/ascended 时喂食；未达喂食阶段不操作（不计 dinner_missed） */
				r.skipped = true;
				return r;
			}
			var fs = V.foodstuff;
				if (man && man.food && fs && fs[man.food] && fs[man.food].amount > 0) {
					fs[man.food].amount -= 1; r.fed = man.food;
				} else if (fs && fs.steak && fs.steak.amount > 0) { fs.steak.amount -= 1; r.fed = "steak"; }
				else if (fs && fs.souffle && fs.souffle.amount > 0) { fs.souffle.amount -= 1; r.fed = "souffle"; }
				else if (fs && fs.linguine && fs.linguine.amount > 0) { fs.linguine.amount -= 1; r.fed = "linguine"; }
				else {
					/* 其余按菜谱难度降序（与 AutoClean 一致） */
					var sf = getSetup().foodstuff;
					var foods = [];
					if (sf && fs) {
						Object.keys(sf).forEach(function (k) {
							var def = sf[k];
							if (def && def.category === "dish" && def.prop_folder !== "drink" && def.recipe &&
								fs[k] && fs[k].amount > 0) {
								foods.push([k, def.recipe.difficulty]);
							}
						});
						foods.sort(function (a, b) { return (b[1] || 0) - (a[1] || 0); });
					}
					if (foods.length < 1) {
						if (man && man.rage) { man.rage.dinner_missed = (man.rage.dinner_missed || 0) + 1; }
						r.missed = true;
					} else { fs[foods[0][0]].amount -= 1; r.fed = foods[0][0]; }
				}
				/* v1.9.10 对齐 AutoClean 原文（AutoCleanFeedAvery 末尾无条件 wikifier("avery_food_select")）：
				   点菜/牛排/舒芙蕾/扁意面/高阶任一分支喂完都刷新艾弗里下一餐点菜（avery_mansion.food 轮换）；
				   此前仅在最高难度分支内刷新 → 点菜/牛排路径永远吃同一种菜。 */
				try {
					if (typeof window !== "undefined" && window.SugarCube && window.SugarCube.Wikifier) {
						new window.SugarCube.Wikifier(null, "<<avery_food_select>>");
					}
				} catch (e3) {}
		} catch (e) { r.error = String(mbCEErr(e)); }
		return r;
	}
	function mcMaintainFarm() {
		var V = getV();
		var r = { beasts: 0, aggro: false, harvested: 0, error: "" };
		var f = V.farm;
		try {
			/* 对齐 AutoClean 0.1.5 AutoClean_js.js 原文：
			   if(V.farm && V.farm.tower_guard && V.farm.tower_guard_skill && V.farm.tower_guard_skill >= 1000)
			   —— 塔卫（原版 $farm.tower_guard 实证存在）在岗且技能≥1000 才锁四畜 30 / 清 agro */
			if (f && f.tower_guard && f.tower_guard_skill && f.tower_guard_skill >= 1000) {
				var b = f.beasts;
				if (b) {
					if (b.horses !== undefined) { mbCEMaintWrite("farm.beasts.horses", 30); r.beasts += 1; }
					if (b.pigs !== undefined) { mbCEMaintWrite("farm.beasts.pigs", 30); r.beasts += 1; }
					if (b.cattle !== undefined) { mbCEMaintWrite("farm.beasts.cattle", 30); r.beasts += 1; }
					if (b.dogs !== undefined) { mbCEMaintWrite("farm.beasts.dogs", 30); r.beasts += 1; }
				}
				if (V.farm_stage >= 5 && f.aggro) { mbCEMaintWrite("farm.aggro", 0); r.aggro = true; }
			}
			if (f && f.stock && !V.farmerCanSell) {
				Object.keys(f.stock).forEach(function (k) {
					var v = f.stock[k];
					if (!(v > 0)) { return; }
					/* 原版收获走 <<tending_give>> widget 发货给玩家；面板内尝试 SugarCube 通道（游戏中可用），失败仅清库存 */
					try {
						/* v1.9.x 对齐 AutoClean 0.1.5 映射（原版 farm_stock_init 实证 stock 键为
						   truffles/eggs/milk/cream，而原版食物键为 truffle/chicken_egg/bottle_of_milk：
						   直接传 stock 键名会把货加进不存在的食物键 → 玩家拿不到收成）。
						   cream 无原版食物键（原版 "cream" 均为药物），仅清库存、不进 tending_give。
						   原版收获通道 tending_give 需 SugarCube 通道（游戏中可用），失败仅清库存 */
						var STOCK_TO_FOOD = { truffles: "truffle", eggs: "chicken_egg", milk: "bottle_of_milk" };
						var target = STOCK_TO_FOOD[k];
						if (target && typeof window !== "undefined" && window.SugarCube && window.SugarCube.Wikifier) {
							new window.SugarCube.Wikifier(null, "<<tending_give '" + target + "' " + v + ">>");
						}
					} catch (e2) {}
					f.stock[k] = 0;
					r.harvested += 1;
				});
			}
		} catch (e) { r.error = String(mbCEErr(e)); }
		return r;
	}

	/* ============ v1.8.10 庄园自动维护扩展（学 AutoClean 0.1.5 剩余维护面：神殿/伊甸/补给/打扫）
	   与投喂、农场同属「即时执行原模组每日 0 点的维护逻辑」；全部写原版键，键存在才写，防无效写入。 ============ */
	function mcMaintainTemple() {
		var V = getV();
		var r = { quarters: false, garden: false, error: "" };
		try {
			/* 对齐 AutoClean 0.1.5 boot.json 补丁原文：
			   if(V.housekeeping >= 1000){V.temple_quarters = 100; }
			   if(V.tending >= 1000){V.temple_garden = 100;}
			   —— 技能是 V 顶层标量（原版实证：V.housekeeping / V.tending 为 0-1000 数字，
			   earnFeat("Majordomo") 判 V.housekeeping>=1000、cheatSection 用 $housekeeping；
			   V.skill 在原版不存在，v1.9.x 曾误写 V.skill.housekeeping → 恒 false → 永远"未达标"） */
			if (V.housekeeping >= 1000) {
				if (typeof V.temple_quarters === "number") { mbCEMaintWrite("temple_quarters", 100); r.quarters = true; }
			}
			if (V.tending >= 1000) {
				if (typeof V.temple_garden === "number") { mbCEMaintWrite("temple_garden", 100); r.garden = true; }
			}
		} catch (e) { r.error = String(mbCEErr(e)); }
		return r;
	}
	function mcMaintainEden() {
		var V = getV();
		var r = { locked: 0, error: "" };
		try {
			/* 对齐 AutoClean：伊甸菜地/菇桶/泉水无条件锁 4 */
			["edengarden", "edenshrooms", "edenspring"].forEach(function (k) {
				if (typeof V[k] === "number") { mbCEMaintWrite(k, 4); r.locked += 1; }
			});
		} catch (e) { r.error = String(mbCEErr(e)); }
		return r;
	}
	function mcRestockSupplies() {
		var V = getV();
		var r = { soap: false, salve: false, wood: false, error: "" };
		try {
			/* 对齐 AutoClean 0.1.5 boot.json 补丁：
			   if( V.soap != undefined && V.soap < 10 )V.soap = 10;  （不足 10 才补，不压低高值）
			   if( V.salve != undefined && V.salve < 10 )V.salve = 10;
			   if(V.bird.upgrades !=undefined && V.bird.upgrades.firepit >= 3 && V.bird.materials.wood < 10 )V.bird.materials.wood = 10;
			   —— 鹰塔木材需火坑升级≥3 且不足 10 才补 */
			if (typeof V.soap === "number" && V.soap < 10) { mbCEMaintWrite("soap", 10); r.soap = true; }
			if (typeof V.salve === "number" && V.salve < 10) { mbCEMaintWrite("salve", 10); r.salve = true; }
			if (V.bird && V.bird.upgrades && V.bird.upgrades.firepit >= 3 &&
				V.bird.materials && typeof V.bird.materials.wood === "number" && V.bird.materials.wood < 10) {
				mbCEMaintWrite("bird.materials.wood", 10); r.wood = true;
			}
		} catch (e) { r.error = String(mbCEErr(e)); }
		return r;
	}
	function mcCleanMansion() {
		var V = getV();
		/** @type {{rooms: number, days: boolean, error: string, skipped?: boolean}} */
		var r = { rooms: 0, days: false, error: "" };
		try {
			/* 对齐 AutoClean 0.1.5 boot.json 补丁：
			   if(V.avery_fate === "saved" || V.avery_fate === "ascended"){
			     V.avery_mansion.pool/kitchen/lounge/display/bedroom/bathroom/garden/dining = 0; days_absent = 0; }
			   —— 仅艾弗里关系确立（saved/ascended）才打扫；房间是数值计数（原版实证 version 5
			   初始化全部 to 0，含 study/garage），非带 cleaned 布尔的对象（v1.9.x 曾按对象结构
			   枚举 → 恒 0 间房、打扫从未生效） */
			if (V.avery_fate !== "saved" && V.avery_fate !== "ascended") {
				r.skipped = true;
				return r;
			}
			var man = V.avery_mansion;
			if (man && typeof man === "object") {
				["pool", "kitchen", "lounge", "display", "bedroom", "bathroom", "dining", "garden", "study", "garage"].forEach(function (k) {
					if (typeof man[k] === "number") { mbCEMaintWrite("avery_mansion." + k, 0); r.rooms += 1; }
				});
				if (typeof man.days_absent === "number") { mbCEMaintWrite("avery_mansion.days_absent", 0); r.days = true; }
			}
		} catch (e) { r.error = String(mbCEErr(e)); }
		return r;
	}


	/* ============ 庄园自动维护：每日全自动调度（AutoClean 模式，v1.9.x）
	   用户诉求：维护应是"全自动服务"而非手点按钮。调度器以游戏内天数 Time.days
	   （原版实证：Time.days 为开档以来总天数、从 0 起，过夜 +1）为锚，每次段落进入
	   （mbCEOnPassageInit）时若天数变化且对应开关开启 → 自动执行一次该维护项。
	   开关与上次执行天数存 localStorage（mbCE_auto），不写 V → 不污染存档、新档不继承。 */
	var AUTO_MAINTAIN_ITEMS = [
		{ key: "feed", name: "自动投喂艾弗里", run: function () { return mcFeedAvery(); } },
		{ key: "farm", name: "自动农场维护", run: function () { return mcMaintainFarm(); } },
		{ key: "temple", name: "自动神殿维护", run: function () { return mcMaintainTemple(); } },
		{ key: "eden", name: "自动伊甸维护", run: function () { return mcMaintainEden(); } },
		{ key: "restock", name: "自动补给", run: function () { return mcRestockSupplies(); } },
		{ key: "clean", name: "自动庄园打扫", run: function () { return mcCleanMansion(); } }
	];
	function mcAutoState() {
		var st = { items: {}, lastDay: -1 };
		try {
			if (typeof localStorage !== "undefined") {
				var raw = localStorage.getItem("mbCE_auto");
				if (raw) {
					var p = JSON.parse(raw);
					if (p && typeof p === "object") {
						if (p.items && typeof p.items === "object") { st.items = p.items; }
						if (typeof p.lastDay === "number") { st.lastDay = p.lastDay; }
					}
				}
			}
		} catch (e) {}
		return st;
	}
	function mcAutoSave(st) {
		try {
			if (typeof localStorage !== "undefined") { localStorage.setItem("mbCE_auto", JSON.stringify(st)); }
		} catch (e) {}
	}
	function mcAutoIsOn(key) {
		return !!mcAutoState().items[key];
	}
	function mcAutoSet(key, on) {
		var st = mcAutoState();
		if (on) {
			st.items[key] = true;
			/* v1.9.10：开启时 UI 已即时执行一次（mcAutoRunOnce），记录当日 lastDay，
			   当日 passage tick 不再重复执行（维护动作多数幂等但投喂会重复扣食材）；
			   次日（Time.days+1）起由调度器自动执行。 */
			if (typeof Time !== "undefined" && Time && typeof Time.days === "number" && Time.days >= 0) {
				st.lastDay = Time.days;
			}
		} else {
			delete st.items[key];
		}
		mcAutoSave(st);
		return st;
	}
	function mcAutoRunOnce(key) {
		for (var i = 0; i < AUTO_MAINTAIN_ITEMS.length; i += 1) {
			if (AUTO_MAINTAIN_ITEMS[i].key === key) { return AUTO_MAINTAIN_ITEMS[i].run(); }
		}
		return { error: "未知维护项 " + key };
	}
	function mcAutoMaintainTick() {
		try {
			var st = mcAutoState();
			var any = false, k;
			for (k in st.items) { if (st.items[k]) { any = true; break; } }
			if (!any) { return { day: null, ran: 0 }; }
			var days = (typeof Time !== "undefined" && Time && typeof Time.days === "number") ? Time.days : -1;
			if (days < 0 || days === st.lastDay) { return { day: days, ran: 0 }; }
			var ran = 0;
			AUTO_MAINTAIN_ITEMS.forEach(function (it) {
				if (st.items[it.key]) { try { it.run(); ran += 1; } catch (e) {} }
			});
			st.lastDay = days;
			mcAutoSave(st);
			return { day: days, ran: ran };
		} catch (e) { return { error: String(mbCEErr(e)) }; }
	}

	/* ============ v1.8.9 战斗终结（学 CombatTerminator 0.1 原功能，即时一键执行）
	   原模组为 TweeReplacer 注入到战斗 widget；此处为 MCE 全局页即时按钮，等价写入。
	   数据层与 UI 分离：动作定义在此，08-npc-traits.js 只负责渲染按钮。 ============ */
	var COMBAT_ACTIONS = [
		{ key: "suicide", name: "自我了断", desc: "写 V.pain=1000", run: function (V) { V.pain = 1000; } },
		{ key: "hero", name: "英雄不屈", desc: "pain=10，清空性奋/压力", run: function (V) { V.pain = 10; V.arousal = 0; V.stress = 0; } },
		{ key: "extend", name: "延长战斗", desc: "敌方性奋 -500", run: function (V) { V.enemyarousal = (V.enemyarousal || 0) - 500; } },
		{ key: "calm", name: "息事宁人", desc: "敌方性奋=上限", run: function (V) { V.enemyarousal = V.enemyarousalmax || 0; } },
		{ key: "knockout", name: "一拳打飞", desc: "写 V.enemyhealth=0", run: function (V) { V.enemyhealth = 0; } },
		{ key: "struggle", name: "结束挣扎", desc: "挣扎.done=number+1", run: function (V) { if (V.struggle) { V.struggle.done = V.struggle.number + 1; } } },
		{ key: "tentacle", name: "结束触手", desc: "触手.active=0", run: function (V) { if (V.tentacles) { V.tentacles.active = 0; } } },
		{ key: "cluster", name: "结束集群", desc: "战斗中生效：吞食计时/阶段/距离清零", run: function (V) { V.timer = 0; V.vorestage = 0; V.swimdistance = 0; } }
	];
	function mcCombatAction(key) {
		var act = null, i;
		for (i = 0; i < COMBAT_ACTIONS.length; i++) { if (COMBAT_ACTIONS[i].key === key) { act = COMBAT_ACTIONS[i]; break; } }
		if (!act) { return { ok: false, message: "未知战斗操作：" + key }; }
		try { act.run(getV()); return { ok: true, name: act.name }; }
		catch (e) { return { ok: false, message: "执行失败：" + mbCEErr(e) }; }
	}

	/* ============ 扩展转化系统（MOD 独立系统，如 v0.1.880 的兔子/人鱼：
	     setup.myTFSet(name, stage) 公共 API + V.<name>/V.<name+build> 存档变量，
	     不注册进 setup.transformations → 按"非原版注册键 + 存档存在"通用检测，零硬编码） ============ */
	var EXT_TF_CN = { "rabbit": "兔子", "mermaid": "人鱼" };
	function listExtTransforms() {
		var out = [];
		try {
			if (typeof setup === "undefined" || !setup || typeof setup.myTFSet !== "function") { return out; }
			var V = getV();
			var reg = {};
			if (Array.isArray(setup.transformations)) {
				setup.transformations.forEach(function (tf) { if (tf && tf.key) { reg[String(tf.key).toLowerCase()] = true; } });
			}
			var parts = V.transformationParts || {};
			Object.keys(parts).forEach(function (k) {
				if (reg[k.toLowerCase()]) { return; }
				if (typeof V[k] === "number" && !Number.isNaN(V[k])) { out.push(k); }
			});
			if (!out.length) {
				["rabbit", "mermaid"].forEach(function (k) {
					if (typeof V[k] === "number" && !Number.isNaN(V[k]) && !reg[k]) { out.push(k); }
				});
			}
		} catch (e) {}
		return out;
	}
	function completeExtTransform(name) {
		try {
			if (typeof setup === "undefined" || !setup || typeof setup.myTFSet !== "function") { return false; }
			setup.myTFSet(name, 3);
			return Number(getV()[name]) === 3;
		} catch (e) { return false; }
	}

	/* ============ 原版恋爱阶段系统（格威岚：游戏原版 0.5.12.13 的 gwylanStatusCheck 体系）
	     系统级功能而非角色数据硬编码：判定/写入完全对齐原版 gwylanStatusCheck 源码——
	     阶段状态实时计算存 T.gwylanStatus，事件经历存 V.gwylanSeen；
	     爱意为自动重算值（已解锁森林套装 + 已聊套装），不可直接写 C.npc.Gwylan.love。
	     内置原版公式副本：原版 gwylanStatusCheck 存在时优先调用，缺失时按同一公式自算。 ============ */
	function hasVanillaRomance(name) {
		try {
			if (String(name || "").trim().toLowerCase() !== "gwylan") { return false; }
			var V = getV();
			if (Array.isArray(V.gwylanSeen)) { return true; }
			if (V.gwylan && typeof V.gwylan === "object") { return true; }
			if (findNpc(name)) { return true; }
		} catch (e) {}
		return false;
	}
	function gwylanSeenAdd(v) {
		var V = getV();
		if (!Array.isArray(V.gwylanSeen)) { V.gwylanSeen = []; }
		if (V.gwylanSeen.indexOf(v) === -1) { V.gwylanSeen.push(v); }
	}
	/* 面板写入痕迹（v1.2）：一键完成成功时记录，回退时只撤记录过的写入，保护真实进度。
	   key 含 value，避免同路径多条件（如多个 gwylanSeen 事件）互相覆盖痕迹。 */
	function recordRomanceWrite(parsed, npcName) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = parsed.type + ":" + (parsed.path || npcName) + ":" + (parsed.value || "");
			V.mbCE_wrote[key] = { type: parsed.type, path: parsed.path || "", value: parsed.value || "", npc: npcName, t: Date.now() };
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
		} catch (e) {}
	}
	function recordVanillaWrite(key) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["vanilla:" + key] = { type: "vanilla", key: key, npc: "Gwylan", t: Date.now() };
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
		} catch (e) {}
	}
	function fillGwylanLoveMax() {
		try {
			var V = getV();
			var sets = setup.specialClothesSets || {};
			if (!Array.isArray(V.gwylanTalked)) { V.gwylanTalked = []; }
			Object.keys(sets).forEach(function (key) {
				var set = sets[key];
				if (!set || !Array.isArray(set.shop) || set.shop.indexOf("forest") === -1) { return; }
				if (V.gwylanTalked.indexOf(key) === -1) { V.gwylanTalked.push(key); }
			});
			if (!Array.isArray(V.specialClothes)) { V.specialClothes = []; }
			var cat = Array.isArray(setup.specialClothes) ? setup.specialClothes : [];
			cat.forEach(function (item) {
				if (!item || !item.name) { return; }
				var set = sets[item.name];
				if (!set || !Array.isArray(set.shop) || set.shop.indexOf("forest") === -1) { return; }
				var entry = null, i;
				for (i = 0; i < V.specialClothes.length; i++) {
					if (V.specialClothes[i] && V.specialClothes[i].name === item.name) { entry = V.specialClothes[i]; break; }
				}
				if (!entry) {
					entry = { name: item.name, sets: (typeof clone === "function" ? clone(item.sets) : item.sets), unlocked: 0 };
					V.specialClothes.push(entry);
				}
				entry.unlocked = Math.max(Number(entry.unlocked || 0), 2);
			});
		} catch (e) {}
	}
	function clearGwylanWary() {
		try {
			var V = getV();
			if (V.gwylan && typeof V.gwylan === "object") { V.gwylan.wary = 0; }
			else { V.gwylan = { wary: 0 }; }
		} catch (e) {}
	}
	function vanillaNpcPregnant(name) {
		try { if (typeof npcIsPregnant === "function") { return !!npcIsPregnant(name); } } catch (e) {}
		return false;
	}
	function vanillaPlayerPregnant() {
		try { if (typeof playerIsPregnant === "function") { return !!playerIsPregnant(); } } catch (e) {}
		return false;
	}
	/* 内置原版公式：与游戏 0.5.12.13 gwylanStatusCheck 完全一致（供原版函数缺失时兜底） */
	function vanillaComputeStatus() {
		var V = getV();
		var out = [];
		if (!Array.isArray(V.gwylanSeen)) { return out; }
		var npc = findNpc("Gwylan");
		if (!npc) { return out; }
		var sets = (typeof setup !== "undefined" && setup && setup.specialClothesSets) ? setup.specialClothesSets : {};
		var totalSets = 0;
		Object.keys(sets).forEach(function (k) {
			if (sets[k] && Array.isArray(sets[k].shop) && sets[k].shop.indexOf("forest") !== -1) { totalSets += 1; }
		});
		var unlocked = 0;
		if (Array.isArray(V.specialClothes)) {
			V.specialClothes.forEach(function (c) { if (c && Number(c.unlocked) >= 2) { unlocked += 1; } });
		}
		var talked = 0;
		if (Array.isArray(V.gwylanTalked)) {
			V.gwylanTalked.forEach(function (s) { if (sets[s] && Array.isArray(sets[s].shop) && sets[s].shop.indexOf("forest") !== -1) { talked += 1; } });
		}
		var love = Math.ceil(unlocked + talked);
		npc.love = love;
		var lovePct = totalSets ? Math.ceil((love / (totalSets * 2)) * 100) : 0;
		var cautious = false;
		if (V.gwylan && Number(V.gwylan.wary) > 1 && (npc.state === "active" || npc.state === "scorned")) { cautious = true; }
		if (lovePct >= 65 && V.gwylanSeen.indexOf("ritual_sex") !== -1 && npc.dom >= 20 && npc.lust >= 40 && !cautious) {
			if (V.gwylanSeen.indexOf("yearning") === -1) { out.push("aroused"); }
		}
		if (lovePct >= 75 && V.gwylanSeen.indexOf("yearning") !== -1 && npc.dom >= 50 && npc.lust >= 30 && (npc.dom + npc.lust) >= 90 && !cautious) {
			out.push("lust");
			if (V.gwylanSeen.indexOf("partners") !== -1 && npc.dom >= 100 && npc.lust >= 40 && (npc.dom + npc.lust) >= 160) {
				if (!(V.weekly && V.weekly.gwylanNoHeat)) { out.push("heat"); }
			}
			if (lovePct >= 90 && npc.dom >= 140 && out.indexOf("heat") !== -1 && !vanillaNpcPregnant("Gwylan") && !vanillaPlayerPregnant()) {
				out.push("wantsPregnancy");
			}
		}
		return out;
	}
	function refreshVanillaStatus() {
		try {
			if (typeof window.gwylanStatusCheck === "function") { window.gwylanStatusCheck(); return true; }
			if (typeof gwylanStatusCheck === "function") { gwylanStatusCheck(); return true; }
		} catch (e) {}
		try {
			var status = vanillaComputeStatus();
			var t = State.temporary || {};
			t.gwylanStatus = status;
			return true;
		} catch (e) {}
		return false;
	}
	/* 防崩：格威岚场景临时变量兜底（v1.3.5）
	   本体 Gwylan Ritual Start Garden 等段落开头靠 <<run statusCheck("Gwylan")>> 初始化
	   T.gwylanStatus / T.gwylanTF；但 statusCheck 仅在 C.npc.Gwylan.init === 1 时才调用
	   gwylanStatusCheck()——新存档未见过格威岚时 init 为 0，两个临时变量完全不初始化；
	   且 gwylanStatusCheck() 在 V.gwylanTalked/V.gwylanSeen/V.gwylan 缺失时早退，只设
	   T.gwylanStatus=[]、不设 T.gwylanTF → 段落读 _gwylanTF.tail 直接崩。
	   兜底：T.gwylanStatus 缺失时用本体公式刷新（本体 gwylanStatusCheck 或内置公式副本），
	   T.gwylanTF 缺失时补默认隐藏态四字段（ears/tail/fangs/known）；已有值绝不覆盖。 */
/* 职责：战斗终结续 —— 原版阶段数据读取（VANILLA_STAGES）、Gwylan 花园场景状态兜底、原版阶段完成 */
	function ensureGwylanSceneState() {
		try {
			var t = (typeof State !== "undefined" && State && State.temporary) ? State.temporary : null;
			if (!t) { return; }
			if (!Array.isArray(t.gwylanStatus)) { refreshVanillaStatus(); }
			if (!t.gwylanTF || typeof t.gwylanTF !== "object") {
				t.gwylanTF = { ears: "hidden", tail: "hidden", fangs: "hidden", known: false };
			}
		} catch (e) {}
	}
	/* 格威岚花园/森林商店段落判定（与场景直达组 gwylan_garden 同口径） */
	function isGwylanGardenPassage(name) {
		var n = String(name || "");
		return /gwylan/i.test(n) || n.indexOf("Pregnancy Birth Forest Shop") === 0 || n.indexOf("Forest Shop") === 0;
	}
	var VANILLA_STAGES = [
		{ key: "ritual_sex", label: "仪式之约", desc: "完成一次仪式性爱", seen: true },
		{ key: "yearning", label: "渴望（Yearning）", desc: "爱意 ≥65% + 支配 ≥20 + 情欲 ≥40（非警戒）→ 收信", seen: true },
		{ key: "lust", label: "欲望（Lust）", desc: "爱意 ≥75% + 支配 ≥50 + 情欲 ≥30 + 支配+情欲 ≥90", seen: false },
		{ key: "partners", label: "恋人", desc: "成为恋人", seen: true },
		{ key: "romance", label: "永远", desc: "步入永远", seen: true },
		{ key: "heat", label: "发情（Heat）", desc: "恋人 + 支配 ≥100 + 情欲 ≥40 + 支配+情欲 ≥160", seen: false },
		{ key: "wantsPregnancy", label: "孕育意愿", desc: "爱意 ≥90% + 支配 ≥140 + 发情（双方未怀孕）", seen: false }
	];
	function readVanillaStageData() {
		refreshVanillaStatus();
		var V = getV();
		var seen = Array.isArray(V.gwylanSeen) ? V.gwylanSeen : [];
		var status = [];
		try {
			var t = State.temporary || {};
			if (Array.isArray(t.gwylanStatus)) { status = t.gwylanStatus; }
		} catch (e) {}
		var okMap = {};
		VANILLA_STAGES.forEach(function (s) {
			okMap[s.key] = s.seen ? seen.indexOf(s.key) !== -1 : status.indexOf(s.key) !== -1;
		});
		return { seen: seen, status: status, okMap: okMap };
	}
	function getVanillaStages(name) {
		if (!hasVanillaRomance(name)) { return []; }
		var data = readVanillaStageData();
		return VANILLA_STAGES.map(function (s) {
			return { key: s.key, label: s.label, desc: s.desc, ok: !!data.okMap[s.key] };
		});
	}
	function completeVanillaStage(name, key) {
		if (!hasVanillaRomance(name)) { return { ok: false, message: "该角色没有原版恋爱阶段系统" }; }
		var npc = findNpc(name);
		if (!npc) { return { ok: false, message: "未找到该角色运行时对象（V.NPCName）" }; }
		var V = getV();
		try {
			if (key === "ritual_sex") {
				gwylanSeenAdd("ritual_sex");
			} else if (key === "yearning") {
				fillGwylanLoveMax();
				npc.dom = Math.max(Number(npc.dom || 0), 20);
				npc.lust = Math.max(Number(npc.lust || 0), 40);
				clearGwylanWary();
				gwylanSeenAdd("ritual_sex");
				gwylanSeenAdd("yearning");
			} else if (key === "lust") {
				fillGwylanLoveMax();
				npc.dom = Math.max(Number(npc.dom || 0), 50);
				npc.lust = Math.max(Number(npc.lust || 0), 40);
				clearGwylanWary();
				gwylanSeenAdd("ritual_sex");
				gwylanSeenAdd("yearning");
				refreshVanillaStatus();
			} else if (key === "partners") {
				gwylanSeenAdd("partners");
			} else if (key === "romance") {
				gwylanSeenAdd("romance");
			} else if (key === "heat") {
				fillGwylanLoveMax();
				npc.dom = Math.max(Number(npc.dom || 0), 100);
				npc.lust = Math.max(Number(npc.lust || 0), 60);
				clearGwylanWary();
				gwylanSeenAdd("ritual_sex");
				gwylanSeenAdd("yearning");
				gwylanSeenAdd("partners");
				if (V.weekly && typeof V.weekly === "object") { V.weekly.gwylanNoHeat = false; }
				refreshVanillaStatus();
			} else if (key === "wantsPregnancy") {
				fillGwylanLoveMax();
				npc.dom = Math.max(Number(npc.dom || 0), 140);
				npc.lust = Math.max(Number(npc.lust || 0), 60);
				clearGwylanWary();
				gwylanSeenAdd("ritual_sex");
				gwylanSeenAdd("yearning");
				gwylanSeenAdd("partners");
				if (V.weekly && typeof V.weekly === "object") { V.weekly.gwylanNoHeat = false; }
				refreshVanillaStatus();
			} else {
				return { ok: false, message: "未知阶段：" + key };
			}
		} catch (e) {
			return { ok: false, message: "执行异常：" + mbCEErr(e) };
		}
		recordVanillaWrite(key);
		var data = readVanillaStageData();
		var ok = !!data.okMap[key];
		if (key === "wantsPregnancy" && !ok) {
			return { ok: false, message: "数值已补齐，但原版要求格威岚与玩家均未怀孕才进入孕育意愿" };
		}
		return { ok: ok, message: ok ? "阶段已达成" : "数值已补齐，阶段仍由原版事件驱动（收信/剧情类需手动触发），可刷新后再试" };
	}
	function unlockVanillaAll(name) {
		if (!hasVanillaRomance(name)) { return 0; }
		var stages = getVanillaStages(name);
		var n = 0;
		stages.forEach(function (s) {
			if (s.ok) { return; }
			if (completeVanillaStage(name, s.key).ok) { n += 1; }
		});
		return n;
	}
	/* 恋爱阶段回退（v1.2）：只撤销"面板写入过"的标记/变量（依据 V.mbCE_wrote 痕迹），
	   玩家真实达成的进度拒绝回退；state 类（关系状态）一律不回退。返回 true=已撤销。 */
	function undoRomanceStage(name, stage) {
		try {
			var v = getV();
			if (!v || !v.mbCE_wrote || typeof v.mbCE_wrote !== "object") { return false; }
			/* v1.4.5：native（loveInterest 兜底）阶段回退——依据 romance:native 痕迹，
			   从恋人卡槽移除该角色（数组移除 / 对象删除槽位键），并清除痕迹 */
			if (stage && stage.native) {
				var nk = "romance:native:" + String(name).toLowerCase();
				if (!v.mbCE_wrote[nk]) { return false; }
				var li = v.loveInterest;
				var changedN = false;
				if (Array.isArray(li)) {
					var ixi = li.indexOf(name);
					if (ixi !== -1) { li.splice(ixi, 1); changedN = true; }
				} else if (li && typeof li === "object") {
					Object.keys(li).forEach(function (k) {
						if (li[k] === name) { delete li[k]; changedN = true; }
					});
				}
				if (changedN) { try { delete v.mbCE_wrote[nk]; } catch (e) {} }
				return changedN;
			}
			var parsed = /** @type {any} */ (parseCondition(stage.text, name));
			if (!parsed) { return false; }
			var key = parsed.type + ":" + (parsed.path || name) + ":" + (parsed.value || "");
			if (!v.mbCE_wrote[key]) { return false; } /* 非面板写入 → 拒绝 */
			var changed = false;
			if (parsed.type === "set") {
				try { delete v[parsed.path]; } catch (e) { v[parsed.path] = undefined; }
				changed = true;
			} else if (parsed.type === "clear") {
				v[parsed.path] = 1; changed = true;
			} else if (parsed.type === "append") {
				var arr = v[parsed.path];
				if (Array.isArray(arr)) {
					var idx = arr.indexOf(parsed.value);
					if (idx !== -1) { arr.splice(idx, 1); changed = true; }
				} else if (arr && typeof arr === "object") {
					Object.keys(arr).forEach(function (k) {
						if (arr[k] === parsed.value) { delete arr[k]; changed = true; }
					});
				}
			} else if (parsed.type === "state") {
				return false; /* 关系状态类不回退（避免破坏真实关系） */
			}
			if (changed) {
				try { delete v.mbCE_wrote[key]; } catch (e) { v.mbCE_wrote[key] = undefined; }
			}
			return changed;
		} catch (e) { return false; }
	}
	/* 原版恋爱阶段回退（v1.2）：只撤销面板写入的 gwylanSeen 经历标记（有 mbCE_wrote 痕迹才可回退），
	   不动爱意/支配/情欲等真实属性。
	   状态型阶段（欲望/发情/孕育意愿）由原版状态机实时计算（数值 + 前置经历），回退会连带删真实进度，
	   一律拒绝——可先回退其前置 seen 型阶段（渴望/恋人/永远），状态自然回落。 */
	function undoVanillaStage(name, key) {
		if (!hasVanillaRomance(name)) { return { ok: false, message: "该角色没有原版恋爱阶段系统" }; }
		var V = getV();
		try {
			if (key === "lust" || key === "heat" || key === "wantsPregnancy") {
				return { ok: false, message: "「" + key + "」由原版状态机实时计算（数值+前置经历），回退会破坏真实进度，已拒绝；可先回退前置 seen 型阶段（渴望/恋人/永远）使其自然回落" };
			}
			if (!V.mbCE_wrote || !V.mbCE_wrote["vanilla:" + key]) {
				return { ok: false, message: "该阶段非面板写入（真实达成），为保护真实进度不执行回退" };
			}
			var seen = Array.isArray(V.gwylanSeen) ? V.gwylanSeen : [];
			function rm(v) {
				var i = seen.indexOf(v);
				if (i !== -1) { seen.splice(i, 1); return true; }
				return false;
			}
			var changed = false;
			if (key === "ritual_sex") { changed = rm("ritual_sex"); }
			else if (key === "yearning") { changed = rm("yearning"); }
			else if (key === "partners") { changed = rm("partners"); }
			else if (key === "romance") { changed = rm("romance"); }
			else { return { ok: false, message: "未知阶段：" + key }; }
			if (changed) {
				try { delete V.mbCE_wrote["vanilla:" + key]; } catch (e) { V.mbCE_wrote["vanilla:" + key] = undefined; }
				refreshVanillaStatus();
			}
			var data = readVanillaStageData();
			var ok = !!data.okMap[key];
			if (ok) { return { ok: false, message: "回退未生效：该阶段仍由原版数值/事件驱动，已达成状态无法仅靠撤销标记回落" }; }
			return { ok: true, message: "已回退「" + key + "」阶段（撤销面板写入的经历标记，真实属性未改动）" };
		} catch (e) {
			return { ok: false, message: "回退异常：" + mbCEErr(e) };
		}
	}

	/* ============ v1.4.0 Mod作弊：第三方模组扩展内容操控（第 6 主页面）
	       边界：默认不处理 DoL 原版变量（过滤清单 CHEAT_VANILLA_ROOTS）；
	       只操作注册表 / 内置适配器 / 被动探测声明出的模组专属变量。
	       唯一例外（v2.0.0.003，用户明确要求）：原版 cheat 页「你对什么感到不安?」的 $uncomfortable.*，
	       由 08b-attitude.js 直写（modId="vanilla-attitudes"，键白名单限定 5 项，不留其他原版变量入口）。
	       机制：① setup.mbCE_modCheats 注册制（外部模组按约定声明，动态识别）
	             ② CHEAT_ADAPTERS 内置适配器数据（已装内容模组，探测命中即合并）
	             ③ CHEAT_PASSIVE_PROBES 被动识别占位（识别到模组但未声明可操控项）
	       留痕：V.mbCE_wrote 扩展 {type:"cheat", modId, op, path, before, after, t}，
	             key="cheat:"+modId+":"+itemKey；回退还原 before（首次面板写入前状态）。 ============ */
	var CHEAT_VANILLA_ROOTS = [
		"farm", "farm_stage", "gwylan", "gwylanSeen", "gwylanTalked",
		"robinromance", "whitneyromance", "kylarenglish", "avery_mansion", "avery_tower",
		"daily", "settings", "scenes", "NPCName", "characters", "npc",
		"weekly", "specialClothes", "loveInterest", "replayScene", "sceneViewSwitch",
		"mbCE_queue", "mbCE_wrote", "mbCE_replayOnce", "mbCE_replayPending", "mbCE_unlockedPlaces", "mbCE_completedScenes"
	];
	/* v1.7.0：DoL 原版 V 顶层键清单（从本体 0.5.12.13 HTML 宏上下文实证提取，186 键）。
	   用途：玩家属性编辑页「模组属性」区 = 运行时 V 顶层键 - 本清单（只添加原版没有的，原版键不重复添加）。
	   来源：twine 宏内 $xxx（含对象型）全部出现 + 手工补充运行时实证的原版顶层对象键（scenes/compound/money 等）。 */
	var ORIGINAL_V_ROOT_KEYS = [
		"NPCList", "alarm", "allure", "alluretest", "analchastityparasite", "analskill",
		"angelbuild", "arousalmax", "askedtochoke", "asylummedicated", "avery_mansion",
		"averydate", "averyragerevealed", "awareness", "baileydefeatedchain", "ballssize",
		"beastrapestat", "beauty", "beautymax", "bestialitytrait", "bottomskill", "brothelshowdata",
		"bullytimer", "bullytimeroutside", "bus", "cat", "catbuild", "cave", "chestskill",
		"choketrait", "compound", "consensual", "container", "control", "cool", "cowbuild",
		"daily", "dancelocation", "danceskill", "dancing", "debugLines",
		"debugWeatherBandBounds", "delinquency", "demonbuild", "detention", "deviancy",
		"drugged", "edengarden", "edenshrooms", "edenspring", "ejacstat", "ejactrait",
		"enemyanger", "enemyarousal", "enemyhealth", "enemyno", "enemytrust", "english",
		"english_exam", "englishtrait", "eventskip", "exhibitionism", "farm", "farm_stage",
		"feats", "feetskill", "feetuse", "fingersInVagina", "finish", "forest", "fox",
		"foxbuild", "fringelength", "gwylan", "gwylanSeen", "gwylanTalked", "hairlength",
		"hallucinogen", "handskill", "harper_appointments", "history", "history_exam",
		"historytrait", "id", "lakeRuin", "leftarm", "location", "loveInterest",
		"lowerschoolswimsuitno", "maths", "maths_exam", "mathstrait", "medicated", "minute",
		"molestationstart", "moleststat", "molesttrait", "money", "moonstate", "moor",
		"moor_hunt", "museumAntiques", "neckuse", "oralskill", "orgasmstat", "orgasmtrait",
		"outside", "overlowerwet", "overupperwet", "oxygen", "pain", "penileskill",
		"penistarget", "phase", "physique", "physiquesize", "player", "possessed", "pregnancyStats",
		"prevPassage", "promiscuity", "prostitutionstat", "pubwhore", "purity", "rapestat",
		"rapetrait", "renttime", "rightarm", "rng", "robinPillory", "robindebt",
		"robinmissing", "robinnote", "robinpaid", "robinromance", "scenePassages", "scenes",
		"school", "schoolswimshortsno", "science", "science_exam", "scienceprogression",
		"sciencetrait", "sea", "seductionskill", "selectedToy", "settings", "sexStats",
		"sexstart", "skulduggery", "smuggler_location", "specialClothes", "spraymax",
		"stat_police", "stress", "struggle_start", "submissive", "suffocating",
		"swallowedstat", "swimmingskill", "syndromeeden", "tentaclerapestat", "tentacletrait",
		"testvar", "thighskill", "timeDistortion", "timer", "tiredness", "trauma",
		"undertemp", "upperschoolswimsuitno", "uppertemp", "vaginalskill", "venuemod",
		"vorestage", "wardrobes", "water", "whitney_home_timer", "whitneyromance",
		"willpower", "willpowermax", "wolfbuild", "wolfgirl", "wolfpacktrust", "worn", "wraithPrison"
	];
	/* 玩家属性/模组键 中英映射（仅用于面板显示，写入路径始终用原键名，绝不影响数据层） */
	var ZH_KEYS = {
		/* 玩家基础 */
		"player": "玩家", "money": "金钱", "name": "姓名", "age": "年龄", "height": "身高", "gender": "性别",
		"sex": "生理性别", "appearance": "外貌", "pronoun": "代词", "pronouns": "代词（复数）", "he": "他", "his": "他的",
		"gender_body": "身体性别", "gender_appearance": "外观性别", "gender_posture": "姿态性别",
		"gender_appearance_factors": "外观性别影响因素", "gender_appearance_without_overwear": "外观性别（无外套）",
		"gender_appearance_without_overwear_factors": "外观性别因素（无外套）", "femininity": "女性气质",
		"femininity_without_overwear": "女性气质（无外套）",
		/* 身体 */
		"penis": "阴茎", "penisExist": "有无阴茎", "penissize": "阴茎尺寸", "vagina": "阴道",
		"vaginaExist": "有无阴道", "vaginaExists": "有无阴道", "VaginaExist": "有无阴道", "ballsExist": "有无睾丸",
		"ballssize": "睾丸尺寸", "hymenExist": "有无处女膜", "titsExist": "有无乳房", "breastsize": "胸围",
		"bottomsize": "臀围", "perceived_breastsize": "感知胸围", "perceived_bottomsize": "感知臀围",
		"condom": "避孕套", "bodyshape": "体型", "bodyTemperature": "体温", "bodyliquid": "体液",
		"bodywriting": "身体涂鸦", "types": "类型", "freckles": "雀斑", "skin": "皮肤", "color": "肤色",
		"layers": "衣物层", "sunscreen": "防晒霜", "usesLeft": "剩余次数", "hair": "头发", "length": "长度",
		"colour": "颜色", "crop": "发型", "wings": "翅膀", "scars": "疤痕", "tattoos": "纹身",
		"earPiercings": "耳洞", "nipplePiercings": "乳环", "labiaPiercings": "阴唇环",
		"temple_virginity": "神殿童贞", "virginity": "童贞", "virginityDetails": "童贞详情",
		"hymen": "处女膜", "temple": "神殿", "anal": "肛", "oral": "口", "penile": "阴茎的",
		"vaginal": "阴道的", "handholding": "牵手", "kiss": "亲吻", "virgin": "处子", "chastity": "贞操",
		/* 属性数值 */
		"love": "爱意", "lust": "欲望", "stress": "压力", "trauma": "创伤", "awareness": "意识",
		"arousal": "情欲", "pain": "疼痛", "control": "控制", "deviancy": "异种癖", "promiscuity": "淫乱",
		"fame": "名声", "reputation": "声誉", "dominance": "支配欲", "confidence": "自信", "sanity": "理智",
		"health": "健康", "willpower": "意志", "swim": "游泳", "tenderness": "温柔", "sensitivity": "敏感",
		"familiarity": "熟悉度", "pheromones": "信息素", "sass": "傲慢", "beauty": "容貌",
		"paraphilia": "性癖", "weirdness": "怪诞", "addiction": "上瘾", "corruption": "腐化",
		"whoring": "卖淫", "exhibitionism": "暴露癖", "submissive": "顺从", "submissiveness": "顺从度",
		"tolerances": "耐受", "tolerance": "耐受", "spunk": "精液", "life": "生命", "dead": "死亡",
		"physique": "体能", "purity": "纯洁", "drugged": "药物影响", "tiredness": "疲劳",
		"history": "历史", "inventory": "物品栏", "map": "地图", "position": "姿势", "target": "目标",
		"state": "状态", "seen": "已被看见", "action": "动作", "hide": "隐藏", "beastRut": "兽性发情",
		"reputation_fame": "声名", "reputation_rep": "声誉值",
		/* 技能（常见派生键） */
		"skulduggery": "诡术", "english": "语文", "maths": "数学", "science": "科学",
		"historytrait": "历史才能", "english_exam": "英语考试", "maths_exam": "数学考试",
		"science_exam": "科学考试", "history_exam": "历史考试",
		"handskill": "手部", "oralskill": "口部", "penileskill": "阴茎",
		"vaginalskill": "小穴", "analSkill": "后庭", "analskill": "后庭",
		"thighskill": "大腿", "feetskill": "足部", "chestskill": "胸部",
		"bottomskill": "臀部", "swimmingskill": "游泳", "seductionskill": "魅惑",
		"danceskill": "舞蹈", "feetuse": "足交使用", "neckuse": "颈部使用",
		/* 模组键 */
		"RobinTemple": "罗宾神殿", "TempleChoir": "神殿唱诗班", "LostLamb": "迷途羔羊",
		"TempleDuties": "神殿职责", "DeadwoodReblooms": "枯木逢春", "DeadwoodRebloomsAttitudes": "枯木逢春·态度",
		"Phone": "智能手机", "VPhone": "智能手机", "SmartPhone": "智能手机", "GameUI": "游戏界面",
		"SoftWet": "SoftWet 湿润系统", "ModHub": "模组中心", "DomRobin": "DomRobin", "MLI": "MLI 恋爱扩展",
		"stage": "阶段", "secret": "秘密", "rite_stage": "仪式阶段", "followup": "后续", "allowed": "允许",
		"discovered": "已发现",
		/* 快捷编辑补充键（v1.9.13 翻译表收敛：旧区无同名键才在此列；
		   PANEL_QUICK_GROUPS 的 label 经 zhKey(path) 动态生成，本表为单一事实源） */
		"athletics": "运动", "tending": "护理", "housekeeping": "家务",
		"spray": "防狼喷雾", "baton": "短棍", "whip": "鞭子", "net": "网", "pickaxe": "镐", "prof": "武器技能",
		"prof.spray": "防狼喷雾", "prof.baton": "短棍", "prof.whip": "鞭子", "prof.net": "网", "prof.pickaxe": "镐",
		/* 负面状态（v1.9.13） */
		"anxiety": "焦虑", "delinquency": "不良", "drunk": "醉酒",
		/* 名声子键（v1.9.13） */
		"fame.prostitution": "卖淫名声", "fame.sex": "性名声", "fame.rape": "施暴名声",
		"fame.exhibitionism": "暴露名声", "fame.bestiality": "异种名声", "fame.good": "善行名声"
	};
	var ZH_TYPES = { "number": "数值", "boolean": "布尔", "string": "文本", "object": "对象", "function": "函数", "undefined": "未定义", "null": "空" };
	function zhKey(k) { return ZH_KEYS[k] || String(k); }
	function zhPath(p) { return String(p).split(".").map(zhKey).join("."); }
	function zhType(t) { return ZH_TYPES[t] || t; }
	/* CHEAT_ADAPTERS 容器声明在 04a-00-core.js（v1.9.13 拆分时迁走，此处不再重复声明，避免后声明重置前者） */
	var CHEAT_PASSIVE_PROBES = []; /* { modId, modName, detect: fn } */
	var curCheatModId = "";

	/* 内置适配器：默示录：归途之书 v1.3.4（用户 2026-10-18 提供源码 Revelation-The-Book-of-Return-1.3.4.zip，
	   与 1.3.1 逐文件哈希对比实证：RobinTemple/TempleChoir 常量无变化；LostLamb/TempleDuties 两模块
	   1.3.1 起已注册但此前漏适配，1.3.4 又实质更新其实现——本次补录）
	   探测点：maplebirch 框架模块注册（Module.preInit 挂 :variable → V[模块名]）；
	   状态键：V.RobinTemple（罗宾神殿路线，constants/robin-temple.ts）、V.TempleChoir（唱诗班，
	   constants/temple-choir.ts）、V.LostLamb（迷途羔羊，constants/lost-lamb*.ts 共 5 文件）、
	   V.TempleDuties（神殿值勤，constants/temple-duties.ts）。
	   只声明模组自建键，不碰原版 V.temple_rank / V.templePromised / V.temple_chastity_timer 等。 */
/* ============ v1.9.13 拆分：Mod 作弊适配器声明（CHEAT_ADAPTERS 注册表容器） ============
   原 04a-modcheat-adapters.js（80KB）按模组拆分为本文件（注册表声明）+ 04a-01..11-*.js（各模组块）。
   构建 tools/build_js.js 按文件名 sort() 拼接：04a-00-core.js 排最前，先执行 var CHEAT_ADAPTERS = {}，
   各块文件随后执行 CHEAT_ADAPTERS["modId"] = {...} 赋值。
   工具脚本（check_mod_updates / audit_adapters / resolve_missing）已改读目录下全部 04a-*.js 拼接解析。 */
/** @type {Record<string, any>} 注册表容器：modId -> { detect, entry }；各 04a-XX-*.js 块随后赋值 */
var CHEAT_ADAPTERS = {};
/* 职责：归途之书（revelation-the-book-of-return）适配器声明：阶段 / 能力 / 剧情 / 数值键 */
	CHEAT_ADAPTERS["revelation-the-book-of-return"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }
				return !!(window.maplebirch.get("RobinTemple") || window.maplebirch.get("TempleChoir"));
			} catch (e) { return false; }
		},
		entry: {
			modId: "revelation-the-book-of-return",
			modName: "默示录：归途之书 v1.4.6",
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
				{ key: "td_case", name: "神殿值勤 · 案件阶段", varPath: "TempleDuties.case.stage",
				  levels: ["field", "combat", "report"],
				  labels: ["现场", "战斗", "汇报"] },
				{ key: "td_ordination_stage", name: "神殿值勤 · 授职阶段（1.4.4 新增晋铎线）", varPath: "TempleDuties.ordination.stage",
				  levels: ["prepare", "chant", "whispers", "care", "burden", "aid", "rest", "return", "testimony", "answer", "aftercare", "withdrawn", "complete"],
				  labels: ["准备", "颂唱", "低语", "关怀", "重担", "援助", "休息", "回归", "见证", "回答", "善后", "退出", "完成"] },
				{ key: "nkl_stage", name: "怨灵 · 回收线阶段（1.4.6 新增）", varPath: "RBR.necklace.stage",
				  levels: ["", "failed", "camera", "case", "take", "smash"],
				  labels: ["未开始", "失败", "摄像头", "展柜", "取走", "砸柜"] }
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
				{ key: "nkl_returned", name: "怨灵 · 项链已归还", varPath: "RBR.necklace.returnedOnce", type: "boolean",
				  note: "1.4.6 项链取回/安抚线主开关（原 RBR.necklace.returned 重构为 returnedOnce）：勾选视为已把象牙项链归还湖中一次，梦线与安抚线（WraithAftercare）入口开放" },
				{ key: "nkl_retaken", name: "怨灵 · 项链已取回", varPath: "RBR.necklace.retaken", type: "boolean", numeric: true, min: 0,
				  note: "1.4.6 新增取回分支：勾选=已再次取回（retaken=1，模组 gt 0 判定；模组侧 +1 累加计数，numeric 勾选写 1 不污染计数）。min 0 显式声明域（v2.0.4 清 WARN）" },
				{ key: "nkl_reclaimed", name: "怨灵 · 项链已取回（归还后）", varPath: "RBR.necklace.reclaimed", type: "boolean",
				  note: "1.4.6 回收线成功后置 true（WraithRecovery 实证）：勾选=当前持有已从湖边取回的项链，等价项链盗贼分支，开放 Gwylan/归还后续剧情（Wraith.twee:89/131/208 判定）" }
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
/* 职责：MLI（more_love_interests）适配器声明 */
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
/* 职责：DomRobin 适配器声明 */
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
/* 职责：枯木逢春（deadwood-reblooms）适配器声明：大量 varPath（阶段 / 能力 / 剧情 / 财务 / Robin 清算线等） */
	CHEAT_ADAPTERS["deadwood-reblooms"] = {
		detect: function () {
			try {
				if (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }
				return !!window.maplebirch.get("DeadwoodReblooms");
			} catch (e) { return false; }
		},
		entry: {
			modId: "deadwood-reblooms",
			modName: "枯木逢春 · Deadwood Reblooms 2.5.8",
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
				  sync: { set: [
					{ path: "MoreTransformations.harbour.ship", value: true, if: { min: 1 } },
					{ path: "maplebirch.npc.Zephyr.init", value: 1, if: { min: 1 } },
					{ path: "MoreTransformations.harbour.zephyr.fee", value: function (V) { return V && V.pirate_rank === 1 ? 12000 : 8000; }, if: { min: 2 }, ifMissing: true },
					{ path: "MoreTransformations.harbour.scene", value: "zephyrPaid", if: { min: 4 } }
				  ] },
				  note: "2.4.4 新增冷月港区域线：阶段 4 = 泽菲尔线完成态。2026-10-29 条件审查补联动：写 1+ 自动补「有船 harbour.ship + 泽菲尔登场 Zephyr.init」（模组入口判定缺一即 exit，白写阶段）；写 2+ 补默认酬金 fee（海盗 rank 1=12000 否则 8000，模组按此结算，不补交箱显示 0；已有谈判价时不覆盖）；写 4 补 scene=zephyrPaid（交付段落判定，不补显示「已结清」误导）；写 0 重置不联动" },
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
				  note: "果园常客线：regular_visits 累计到访次数（常客系统按次数推进）" },
				{ key: "dw_science_progression", name: "科学课 · 事件进度（0-4，2.5.3 新增）", varPath: "scienceprogression", type: "number", min: 0, max: 4,
				  note: "2.5.3 新增科学系统：scienceprogression 控制科学课演示事件档位（0 未开始 → 4 最高阶段）；演示触发另需 delinquency≥10 且衣着含裸露部位（Science.ts 判定），写 4 后配合该条件即达最高档演示" },
				{ key: "psy_mood", name: "心智 · 恐惧/入迷（-1000~1000，2.5.3 新增）", varPath: "Psyche.mood", type: "number", min: -1000, max: 1000,
				  note: "2.5.3 心智系统核心值：负数=入迷 Fascination、正数=恐惧 Dread，|值|>200 进入极端态（影响疲惫/特质污染判定）；写 -1000 拉满入迷或 1000 拉满恐惧（模组自带 PsycheCheats 页同键）" },
				{ key: "fb_willpower", name: "成就加成 · 意志力（0-60，2.5.4 新增）", varPath: "featsBoosts.upgrades.deadwood-willpower", type: "number", min: 0, max: 60,
				  note: "2.5.4 成就加成系统（featsBoosts）：写满 60 即购买该项加成，效果=直接获得「意志力」VanillaPlus 特质（$VanillaPlus.traits.willpower=true+lock）；前置=对应成就「钢铁意志 Sovereign Will」已解锁（feats.allSaves 存在），未解锁写 60 也无效；重开菜单保留选购" },
				{ key: "fb_physique", name: "成就加成 · 体格（0-60，2.5.4 新增）", varPath: "featsBoosts.upgrades.deadwood-physique", type: "number", min: 0, max: 60,
				  note: "2.5.4 成就加成（featsBoosts）：写满 60 购买「体格」VanillaPlus 特质；前置成就「不可摧毁 Unbreakable」已解锁" },
				{ key: "fb_beauty", name: "成就加成 · 美貌（0-60，2.5.4 新增）", varPath: "featsBoosts.upgrades.deadwood-beauty", type: "number", min: 0, max: 60,
				  note: "2.5.4 成就加成（featsBoosts）：写满 60 购买「美貌」VanillaPlus 特质；前置成就「素面 Unadorned」已解锁" },
				{ key: "fb_exhibitionism", name: "成就加成 · 暴露癖（0-60，2.5.4 新增）", varPath: "featsBoosts.upgrades.deadwood-exhibitionism", type: "number", min: 0, max: 60,
				  note: "2.5.4 成就加成（featsBoosts）：写满 60 购买「暴露癖」VanillaPlus 特质；前置成就「超越羞耻 Beyond Shame」已解锁" },
				{ key: "fb_deviancy", name: "成就加成 · 变态癖（0-60，2.5.4 新增）", varPath: "featsBoosts.upgrades.deadwood-deviancy", type: "number", min: 0, max: 60,
				  note: "2.5.4 成就加成（featsBoosts）：写满 60 购买「变态癖」VanillaPlus 特质；前置成就「超越自然 Beyond Nature」已解锁" },
				{ key: "fb_promiscuity", name: "成就加成 · 淫荡（0-60，2.5.4 新增）", varPath: "featsBoosts.upgrades.deadwood-promiscuity", type: "number", min: 0, max: 60,
				  note: "2.5.4 成就加成（featsBoosts）：写满 60 购买「淫荡」VanillaPlus 特质；前置成就「每一寸 Every Inch」已解锁" }
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
/* 职责：SmartPhone 适配器声明 */
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
/* 职责：Dol-Optimization 适配器声明 */
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
/* 职责：Wraith'sReflection 适配器声明 */
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
				{ key: "wr_admit", name: "监狱对峙 · 承认罪过", varPath: "AdmitMR", type: "boolean", numeric: true, min: 0, note: "v2.0：模组按严格比较 <<if $AdmitMR is 1>> 判定（ReturnNecklace.twee:34），写 true 恒为假、作弊项静默失效；numeric 勾选写 1；min 0 显式声明域（v2.0.4 清 WARN）" },
				{ key: "wr_refuse", name: "分裂 · 已拒绝", varPath: "RefuseWR", type: "boolean" },
				{ key: "wr_conch_ask", name: "银海螺 · 已咨询约旦", varPath: "SilverConchAsk", type: "boolean", numeric: true, min: 0, note: "v2.0：LakeConchTalk.txt:4 按 <<if $SilverConchWR is 1 and $SilverConchAsk is 1>> 严格比较，写 true 恒为假；numeric 勾选写 1；min 0 显式声明域（v2.0.4 清 WARN）" }
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
/* 职责：DoLSims 适配器声明 */
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
				  note: "模组源码自身 clamp 上限 40（面板不钳制，写超由模组源码自行处理）；宿主对象在开局/迁移 passage 后存在，未初始化时拒绝写入" },
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
	/* ===== Cattery 猫舍（猫咖/出租屋/养宠/全图飞行） v1.1.8.2 =====
	   状态模型：无根对象，全部为顶层标量（$rentingahouse/$pchaveCat/$pcfood_cake/$catArr 等）。
	   判定方式均为严格比较（is 1 / gte 1），故所有键走数字通道（stages/values），禁用 boolean。
	   养猫写 1 联动补猫数据（catArr 数组 + 品种），防止模组 catArr[0] 崩。 */
/* 职责：Cattery 适配器声明 */
	CHEAT_ADAPTERS["cattery"] = {
		detect: function () {
			try {
				if (typeof window !== "undefined" && typeof window.createCafePC === "function") { return true; }
				var v = getV();
				return !!(v && (v.cattery_time !== undefined || v.pcfood_cake !== undefined || v.rentingahouse !== undefined || v.pchaveCat !== undefined));
			} catch (e) { return false; }
		},
		entry: {
			modId: "cattery",
			modName: "猫舍 Cattery v1.1.9（猫咖/出租屋/养宠/飞行）",
			tasks: [],
			stages: [
				{ key: "cat_rent", name: "出租屋 · 是否已租", varPath: "rentingahouse",
				  levels: [0, 1], labels: ["未租屋", "已租屋"],
				  note: "写「已租屋」触发租屋事件（源码实证：租屋确定时 pcHome_clean=30，另有场景惰性置 35；pcHouseCleanLimit 锁 0-40）；每月 1 日需交租" },
				{ key: "cat_owncat", name: "养猫 · 是否已领养", varPath: "pchaveCat",
				  levels: [0, 1], labels: ["未养猫", "已养猫"],
				  sync: { set: [
					{ path: "firstCat_variety", value: "橘猫", if: { min: 1 } },
					{ path: "catArr", value: [{ name: "咪咪", love: 0, play: 0 }], if: { min: 1 }, ifMissing: true }
				  ] },
				  note: "写「已养猫」自动补猫数据（仅当 catArr 不存在时，已有猫不重置；名字「咪咪」/好感 0/玩力 0）" },
				{ key: "cat_garden", name: "出租屋 · 花园升级", varPath: "pcGardenupgrade",
				  levels: [0, 1], labels: ["未升级", "已升级"] },
				{ key: "cat_fly", name: "飞行 · 全图飞行解锁", varPath: "birdFly",
				  levels: [0, 1], labels: ["未解锁", "已解锁"],
				  note: "对应飞行训练 6 次后的「鸟翼」解锁（源码 cafefly.twee 写 $birdFly=1，判定 $birdFly gte 1）；飞往地点用 $flycattery 编号选择" },
				{ key: "cat_book1", name: "书房 · 藏书 1", varPath: "pcHouseBook1",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book2", name: "书房 · 藏书 2", varPath: "pcHouseBook2",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book3", name: "书房 · 藏书 3", varPath: "pcHouseBook3",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book4", name: "书房 · 藏书 4", varPath: "pcHouseBook4",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] },
				{ key: "cat_book5", name: "书房 · 藏书 5", varPath: "pcHouseBook5",
				  levels: [0, 1], labels: ["未拥有", "已拥有"] }
			],
			abilities: [
				/* 特质直接获取（用户实测请求；判定均 gte 1 严格比较 → numeric 数字通道，禁 boolean）。
				   特质注册实证：mods/cattery/tj/traits.txt —— 金牌饲养员 has $pchaveCat>=1 and $firstCat_loveMax gte 1；
				   爱·时·机 has $pcHouseBook1_speciality gte 1（书房藏书1阅读获得，homeBook.twee）；绝爱同藏书2。 */
				{ key: "cat_trait_gold", name: "特质 · 金牌饲养员", varPath: "firstCat_loveMax", numeric: true, min: 0, max: 1,
				  sync: { set: [{ path: "pchaveCat", value: 1 }] },
				  note: "模组判定 pchaveCat≥1 且 firstCat_loveMax≥1；勾选=补领养猫并置好感上限达成（好感写 40 亦自动触发），特质直接获得；取消=loveMax 归 0（特质消失，领养保留）" },
				{ key: "cat_trait_book1", name: "特质 · 爱·时·机", varPath: "pcHouseBook1_speciality", numeric: true, min: 0, max: 1,
				  note: "书房·藏书1 阅读获得（homeBook.twee 实证）；判定 gte 1，勾选写 1" },
				{ key: "cat_trait_book2", name: "特质 · 绝爱", varPath: "pcHouseBook2_speciality", numeric: true, min: 0, max: 1,
				  note: "书房·藏书2 阅读获得；判定 gte 1，勾选写 1" }
			],
			scenes: [],
			values: [
				{ key: "cat_love", name: "猫 · 好感（0-40）", varPath: "catArr.0.love", type: "number", min: 0, max: 40,
				  sync: { set: [
					{ path: "firstCat_loveMax", value: 1, if: { min: 40 } }
				  ] },
				  note: "需先领养猫（catArr 存在）；写 ≥40 自动补 firstCat_loveMax=1——模组特质「金牌饲养员」触发条件是 love≥40 且 loveMax≠1 时置 loveMax=1（源码 Cathave_speciality widget 实证），不补则特质不出现；写低值不撤销 loveMax（模组仅电脑降级操作归 0）" },
				{ key: "cat_play", name: "猫 · 玩力（0-40）", varPath: "catArr.0.play", type: "number", min: 0, max: 40,
				  note: "需先领养猫（catArr 存在）" },
				{ key: "cat_stray", name: "流浪猫 · 幸福度", varPath: "stray_happiness", type: "number", min: 0, max: 999 },
				{ key: "cat_food_store", name: "食材 · 储备（pc_food）", varPath: "pc_food", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cake", name: "食材 · 蛋糕（pcfood_cake）", varPath: "pcfood_cake", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cabbage", name: "食材 · 卷心菜", varPath: "pc_cabbages", type: "number", min: 0, max: 99 },
				{ key: "cat_food_eggplant", name: "食材 · 茄子", varPath: "pc_aubergine", type: "number", min: 0, max: 99 },
				{ key: "cat_food_potato", name: "食材 · 土豆", varPath: "pc_potato", type: "number", min: 0, max: 99 },
				{ key: "cat_food_pepper", name: "食材 · 青椒", varPath: "pc_green_pepper", type: "number", min: 0, max: 99 },
				{ key: "cat_food_fillet", name: "食材 · 鱼排", varPath: "pc_fillet", type: "number", min: 0, max: 99 },
				{ key: "cat_food_chicken", name: "食材 · 鸡胸肉", varPath: "pc_chicken_breast", type: "number", min: 0, max: 99 },
				{ key: "cat_food_sichuan", name: "食材 · 花椒", varPath: "pc_Sichuan_pepper", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cream", name: "食材 · 奶油", varPath: "pc_cream", type: "number", min: 0, max: 99 },
				{ key: "cat_food_flour", name: "食材 · 蛋糕粉", varPath: "pc_cake_flour", type: "number", min: 0, max: 99 },
				{ key: "cat_food_cocoa", name: "食材 · 可可粉", varPath: "pc_cocoa_powder", type: "number", min: 0, max: 99 },
				{ key: "cat_food_milk", name: "食材 · 牛奶", varPath: "pc_milk", type: "number", min: 0, max: 99 },
				{ key: "cat_boxed_meal", name: "便当 · 盒饭储备", varPath: "boxed_meal", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_dsx", name: "菜品 · 地三鲜（次数）", varPath: "cookok_dsx", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_sltds", name: "菜品 · 酸辣土豆丝（次数）", varPath: "cookok_sltds", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_qxjl", name: "菜品 · 茄香鸡柳（次数）", varPath: "cookok_qxjl", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_qjrs", name: "菜品 · 青椒肉丝（次数）", varPath: "cookok_qjrs", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_nxqzb", name: "菜品 · 奶香茄子煲（次数）", varPath: "cookok_nxqzb", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_jytd", name: "菜品 · 椒盐土豆（次数）", varPath: "cookok_jytd", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_bcdjp", name: "菜品 · 白菜炖鸡脯（次数）", varPath: "cookok_bcdjp", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_tdcrp", name: "菜品 · 土豆炒肉片（次数）", varPath: "cookok_tdcrp", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_gbjd", name: "菜品 · 宫保鸡丁（次数）", varPath: "cookok_gbjd", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_qcbc", name: "菜品 · 清炒白菜（次数）", varPath: "cookok_qcbc", type: "number", min: 0, max: 99 },
				{ key: "cat_cook_zccp", name: "菜品 · 自创菜品（次数）", varPath: "cookok_zccp", type: "number", min: 0, max: 99 },
				{ key: "cat_clean_home", name: "清洁 · 出租屋（0-40）", varPath: "pcHome_clean", type: "number", min: 0, max: 40,
				  note: "模组源码自身 Math.clamp 0-40（面板不钳制，写超由模组源码处理）；顶层标量直写（租屋初始化时模组写入 30），无宿主缺失" },
				{ key: "cat_clean_front", name: "清洁 · 门口（0-3）", varPath: "pcEntranceFront_clean", type: "number", min: 0, max: 3 },
				{ key: "cat_clean_after", name: "清洁 · 后院（0-3）", varPath: "pcEntranceAfter_clean", type: "number", min: 0, max: 3 },
				{ key: "cat_drawing", name: "绘画 · 进度（0-100）", varPath: "pchouse_drawing", type: "number", min: 0, max: 100 },
				{ key: "cat_toubi", name: "投币 · 硬币数", varPath: "pctoubi", type: "number", min: 0, max: 999 },
				{ key: "cat_time", name: "猫咖 · 累计经营时间", varPath: "cattery_time", type: "number", min: 0, max: 99999 },
				{ key: "cat_cook_time", name: "猫咖 · 烹饪时间", varPath: "cattery_cook_time", type: "number", min: 0, max: 99999 }
			]
		}
	};


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
/* 适配器：人物附加与生活质量提升（DolMod-/MyFirstMod v0.1.990，doctor55555-55555/DolMod-）
   功能（boot.json TweeReplacer 注入规则 + script 源码实证）：原创恋爱 NPC 阿电（注册进本体
   恋爱 NPC 区，好感/信任/嫉妒/性欲四属性 + 告白/约会/周六打工/嫉妒暗线四阶段）＋生活质量系统：
   电脑（部件商店/组装/性能分/应用商店/接零活/网课学习，computer.js）、银行（活期+定期+理财，
   bank.js）、兔子/人鱼转化（transformation.js，阈值 30/60/90 三阶段）、海上平台、异国小吃摊、
   贩卖机、钓鱼、阁楼广播、NG+（ngplus.js）、伊洛（yiluo.js，0.1.990 新增 NPC）。
   ★模组自带作弊菜单（boot.json 规则：本体 Cheats passage 注入阿电控件走 setup.cheatAdian；
   作弊器 Other 页签后注入 MyFirstMod 专属页）——CE 适配器与官方页同写同一键，无冲突。
   官方中文名核对：README 标题「MyFirstMod · 人物附加与生活质量提升」+ zip 文件名「人物附加与
   生活质量提升_v0.1.990.zip」+ boot.json name「人物附加与生活质量提升」三处一致 → 显示名用官方中文。
   键集：阿电状态 8（abilities 6 + values 2）+ 电脑 12（满配组合 1 + 全应用 1 + 学习 10）+
   银行 1 + 转化 4 + 杂项 4（ability）+ NG+ 1 + 伊洛 1（values）= 31 键。
   ★0.1.880→0.1.990 升版核对（2026-11-02）：boot.json 59KB→109KB、目录模块化重组（moduel/script
   按功能分目录）、新增塔科夫/gridtac 网格战斗/reversecombat 反向战斗/scavenge 拾荒/bunker 地堡/
   cityhall 市政厅/inventory 背包合成/limbs 肢体/audio 音效等系统；CE 声明 30 键 resolve 全部 KEEP
   （含 *_exam 动态键拼接存活，computer.js:508/524 V[key+"_exam"] 实证；game_indie AppCatalog 存活），
   0 REMOVE；按需补 yiluo_holy 1 键；bank.fixedDeposits/holdings（数组/嵌套对象超出数值面）、
   adian._freedomLevel（trust 派生瞬态，写 trust 即自动）、yiluo_carrying（瞬态）不补；
   大系统作弊项另轮适配（未声明）。 */
CHEAT_ADAPTERS["dolmod"] = {
	detect: function () {
		try {
			/* 首选 script 无条件挂载的 window 探测（装上即存在、卸载即消失：ComputerMod/BankMod/NgPlus）。
			   不用 rabbitbuild（与本体转化键同名会造成未装模组也误命中）、单键 adian_*（剧情前为 undefined）。 */
			if (typeof window !== "undefined") {
				if (window.ComputerMod || window.BankMod || window.NgPlus) { return true; }
			}
			var v = getV();
			if (!v) { return false; }
			return !!(
				v.computerApps !== undefined || v.computer !== undefined || v.ngplusCycle !== undefined ||
				(v.adian_met !== undefined && v.adian_romance !== undefined)
			);
		} catch (e) { return false; }
	},
	entry: {
		modId: "dolmod",
		modName: "人物附加与生活质量提升（DolMod-/MyFirstMod v0.1.990）",
		tasks: [],
		stages: [
			/* 阿电表白状态机：四态字符串（adian-confession.twee:14 实证：未触发(空)/rejected 拒绝/friend 朋友/lovers 恋人；
			   分手 passage 置 friend + romance=0 + 清 loveInterest 槽 + rage+20（adian-romance.twee:59-75）——CE 只写状态键，
			   完整分手联动由模组 passage 负责；恋人态建议配「恋爱中」能力一起写） */
			{ key: "dm_conf_state", name: "阿电 · 表白状态", varPath: "adian_confession_state",
			  levels: ["", "rejected", "friend", "lovers"],
			  labels: ["未触发", "拒绝", "朋友", "恋人"] }
		],
		abilities: [
			/* 阿电状态线：全部严格比较（is/isnot 1）→ numeric 通道 1/0 */
			{ key: "dm_met", name: "阿电 · 已认识", varPath: "adian_met", numeric: true, min: 0, max: 1,
			  note: "模组判定 $adian_met isnot 1（严格比较，boot.json 规则6/7/8 实证）——写 1 直接认识（跳过午餐相遇/俱乐部初遇剧情，社交面板阿电卡片即出现）；写 0 回未认识（相遇剧情可再触发）" },
			{ key: "dm_romance", name: "阿电 · 恋爱中", varPath: "adian_romance", numeric: true, min: 0, max: 1,
			  note: "告白答应时模组写 romance=1 + confession_state=lovers + loveInterest 槽位（adian-confession.twee:150-158）；官方作弊页同键直写无联动（boot.json 规则20）；CE 写 1=恋人态（lust 条显示/自愿遭遇战入口开），写 0=分手态（不联动清槽/嫉妒，模组分手 passage 才做完整清理；心形恋人图标依赖 loveInterest 槽位，缺失仅影响显示不影响功能）" },
			{ key: "dm_inhospital", name: "阿电 · 住院中", varPath: "adian._inHospital", numeric: true, min: 0, max: 1,
			  note: "模组判定 $adian._inHospital isnot 1（严格比较，boot.json 规则6/17 实证）挡共餐/告白；写 1=住院（房间互动消失走 Adian Room Empty），写 0=出院" },
			{ key: "dm_imprisoned", name: "阿电 · 囚禁中", varPath: "adian._imprisoned", numeric: true, min: 0, max: 1,
			  note: "暗-D 囚禁线核心开关（adian-room.twee:692 $adian._imprisoned is 1 实证）：写 1=开启囚禁（配合 rage 高值事件触发），写 0=释放；斯德哥尔摩值见下方数值区" },
			{ key: "dm_reported", name: "阿电 · 已报案", varPath: "adian._reported", numeric: true, min: 0, max: 1,
			  note: "报案线状态（adian-room.twee:127 $adian._reported is 1 实证）：写 1=已报案（房间互动受限走支线），写 0=未报案" },
			{ key: "dm_jealous", name: "阿电 · 嫉妒事件就绪", varPath: "adian._jealousReady", numeric: true, min: 0, max: 1,
			  note: "嫉妒暗线就绪标记（adian-room.twee:177 $adian._jealousReady is 1 and 间隔≥7天实证）：配合 C.npc[阿电].rage（本体角色面板可改）触发嫉妒事件链；跟踪期（rage≥50）氛围与事件由 modscript 第七节掷骰驱动" },
			/* 电脑系统 */
			{ key: "dm_pc_full", name: "电脑 · 满配组装", varPath: "computer.assembled", numeric: true, min: 0, max: 1,
			  sync: { set: [
				{ path: "computer.parts.case", value: "全塔工作站机箱", if: { min: 1 } },
				{ path: "computer.parts.motherboard", value: "旗舰主板", if: { min: 1 } },
				{ path: "computer.parts.cpu", value: "十二核处理器", if: { min: 1 } },
				{ path: "computer.parts.gpu", value: "RTX 5090", if: { min: 1 } },
				{ path: "computer.parts.ram", value: "32GB 内存", if: { min: 1 } },
				{ path: "computer.parts.storage", value: "2TB NVMe 固态", if: { min: 1 } },
				{ path: "computer.parts.psu", value: "1000W 电源", if: { min: 1 } },
				{ path: "computer.parts.monitor", value: "32寸 4K曲面屏", if: { min: 1 } },
				{ path: "computer.parts.kb", value: "客制化机械键盘", if: { min: 1 } },
				{ path: "computer.parts.mouse", value: "无线轻量化鼠标", if: { min: 1 } },
				{ path: "computer.performance", value: 91, if: { min: 1 } },
				{ path: "computer.location", value: "bedroom", if: { min: 1 } }
			  ] },
			  note: "一步到位满配电脑（勾选写 1）：10 类部件直写顶级件 + 性能分 91/100 + 默认放卧室——等价秒装（ComputerMod.PartsCatalog 逐字名，getHardware 按 name 匹配；updatePerformance 只在装卸时重算，桌面直接读 performance 故必须同步写分）；取消写 0=assembled false（电脑不可用，部件保留可自行拆装）；直写绕过库存（V.computerParts），拆件时 uninstallPart 会把部件放回库存不崩溃（computer.js:610-614 实证）" },
			{ key: "dm_pc_apps", name: "电脑 · 安装全部应用", varPath: "computerApps.game_indie", numeric: true, min: 0, max: 1,
			  sync: { clear: [
				"computerApps.game_aaa", "computerApps.video_stream", "computerApps.music",
				"computerApps.video_edit", "computerApps.photo_edit", "computerApps.code_ide",
				"computerApps.freelance", "computerApps.browser", "computerApps.office"
			  ], set: [
				{ path: "computerApps.game_aaa", value: true, if: { min: 1 } },
				{ path: "computerApps.video_stream", value: true, if: { min: 1 } },
				{ path: "computerApps.music", value: true, if: { min: 1 } },
				{ path: "computerApps.video_edit", value: true, if: { min: 1 } },
				{ path: "computerApps.photo_edit", value: true, if: { min: 1 } },
				{ path: "computerApps.code_ide", value: true, if: { min: 1 } },
				{ path: "computerApps.freelance", value: true, if: { min: 1 } },
				{ path: "computerApps.browser", value: true, if: { min: 1 } },
				{ path: "computerApps.office", value: true, if: { min: 1 } }
			  ] },
			  note: "一键安装商店全部应用（AppCatalog 10 个 id，computer.js:72-106 实证；主键=独立小游戏）；运行判定 V.computerApps[id] truthy，内存/磁盘配额由硬件决定（满配 2TB/32GB 全可跑）；取消=卸载全部（主键 false + 其余 clear 置 null，truthy 判定视为卸载；clear 先执行 set 后执行，勾选时最终全 true）；应用占硬盘不占内存（运行时才占，computerAppState 瞬态不作弊）" },
			/* 地图解锁 */
			{ key: "dm_indian", name: "异国小吃摊 · 已发现", varPath: "indianStall_found", numeric: true, min: 0, max: 1,
			  note: "首访触发发现小摊剧情（boot.json 规则15 实证，truthy 判定）；写 1=跳过发现剧情直接有摊，写 0=再触发" },
			{ key: "dm_platform", name: "海上平台 · 已发现", varPath: "seaPlatform_found", numeric: true, min: 0, max: 1,
			  note: "海上平台（远海第七区入口，boot.json 规则16 + seaplatform.twee:37 not 判定）；写 1=直接解锁平台（含衣柜/睡衣/电脑/收音机），写 0=重新走发现流程" },
			{ key: "dm_loft_parts", name: "阁楼广播 · 已找齐零件", varPath: "adian._loftRadioParts", numeric: true, min: 0, max: 1,
			  note: "阁楼广播任务线零件态（boot.json 规则30/31 实证，truthy 判定）；写 1=持零件可找罗宾商量布置，写 0=可再翻找" },
			{ key: "dm_loft_set", name: "阁楼广播 · 已布置", varPath: "adian._loftRadioSet", numeric: true, min: 0, max: 1,
			  note: "广播站布置态（boot.json 规则30 $adian._loftRadioSet is 1 严格比较）；写 1=阁楼广播站就绪（孤儿们播报，玩家收音机可收听），写 0=未布置" }
		],
		scenes: [],
		values: [
			/* 阿电 */
			{ key: "dm_stockholm", name: "阿电 · 斯德哥尔摩值（0-100）", varPath: "adian._stockholm", type: "number", min: 0, max: 100,
			  note: "囚禁线斯德哥尔摩综合征累积（adian-room.twee:699 +2/次实证）；高值软化囚禁互动，配合 rage/囚禁开关食用" },
			{ key: "dm_captive_trust", name: "阿电 · 囚禁信任（0-100）", varPath: "adian._captiveTrust", type: "number", min: 0, max: 100,
			  note: "囚禁期信任主存（adiankidnap.twee:96/184/193 ±值实证，Math.clamp 0-100）；**自由活动等级由信任派生**（:321 trust≥80→自由3/≥50→2/≥20→1/否则0，囚禁每日流程重算），写 100=最高信任+3 级自由（可出地下室自由活动）。**前置条件说明**：宿主 `adian` 由 modscript.js:318 passageinit 无条件兜底创建，父缺失拦截不触发；未囚禁（`_imprisoned`≠1）时写入**不生效但无害**（囚禁流程外零引用，孤儿值保留至囚禁启动后生效）——可先勾「已囚禁」再写，或先写信任再勾囚禁（进囚禁次日流程即按信任重算自由等级）" },
			{ key: "dm_reject_day", name: "阿电 · 告白拒绝日（Time.days）", varPath: "adian_reject_day", type: "number", min: 0, max: 9999,
			  note: "拒绝冷处理起始日（adian-confession.twee:70 设 Time.days 实证；modscript.js:348-349 `(Time.days - adian_reject_day) < 7` → 7 天内房间互动全消失）。填当天 Time.days + 状态设 rejected=完整冷处理体验；留 0/不设=无冷却（NaN < 7 恒 false）；配合「表白状态」食用" },
			/* 银行（bank.js 实证：$bank.savings 活期便士，贝利付款刷卡漏斗 bank.twee/规则59-60g 复用） */
			{ key: "dm_bank_savings", name: "银行 · 活期余额（便士）", varPath: "bank.savings", type: "number", min: 0, max: 99999999,
			  note: "活期存款（BankMod.ensure bank.js:79 实证）；贝利收租卡内足够时自动刷卡（baileycardpay 漏斗，规则59），集市/商店购物走现金不受影响；每日 0.02% 利息按 lastInterestDay 结算" },
			/* 电脑 · 网课学习（ComputerMod.Subjects 4 科，computer.js:310-318 实证；trait 上限 2=C+ 封顶，
			   exam 满 200 触发本体 school_skill_up 升本体科目等级） */
			{ key: "dm_learn_sci", name: "网课 · 科学等级（0-2）", varPath: "sciencetrait", type: "number", min: 0, max: 2,
			  note: "网课等级 0→2 对应 F-→C+（StudyCap=2 封顶，再高须去学校，computer.js:318 实证）；写 2=网课学满" },
			{ key: "dm_learn_mat", name: "网课 · 数学等级（0-2）", varPath: "mathstrait", type: "number", min: 0, max: 2,
			  note: "同科学：0-2 封顶 C+；进度见下方 _exam 键" },
			{ key: "dm_learn_eng", name: "网课 · 英语等级（0-2）", varPath: "englishtrait", type: "number", min: 0, max: 2,
			  note: "同科学：0-2 封顶 C+" },
			{ key: "dm_learn_his", name: "网课 · 历史等级（0-2）", varPath: "historytrait", type: "number", min: 0, max: 2,
			  note: "同科学：0-2 封顶 C+" },
			{ key: "dm_learn_sci_exam", name: "网课 · 科学进度（0-200）", varPath: "science_exam", type: "number", min: 0, max: 200,
			  note: "每次学习 +2（computer.js:524）；满 200 触发升级（等级 +1 并归零累积，school_skill_up 实证）；写 200 配合等级键一次学满" },
			{ key: "dm_learn_mat_exam", name: "网课 · 数学进度（0-200）", varPath: "maths_exam", type: "number", min: 0, max: 200,
			  note: "同科学：0-200，满 200 升级" },
			{ key: "dm_learn_eng_exam", name: "网课 · 英语进度（0-200）", varPath: "english_exam", type: "number", min: 0, max: 200,
			  note: "同科学：0-200，满 200 升级" },
			{ key: "dm_learn_his_exam", name: "网课 · 历史进度（0-200）", varPath: "history_exam", type: "number", min: 0, max: 200,
			  note: "同科学：0-200，满 200 升级" },
			/* 兔子/人鱼转化（transformation.js 实证：DEFS thresholds [30,60,90] 三阶段；V[name]=阶段、
			   V[name+"build"]=转化值 0-100；每日 -1 衰减跨阈值降阶，需持续接触触发源维持） */
			{ key: "dm_rabbit", name: "兔子转化 · 阶段（0-3）", varPath: "rabbit", type: "number", min: 0, max: 3,
			  note: "0 无 → 1 兔耳 → 2 兔尾 → 3 兔腿（boot.json 规则46 初始化 + transformation.js:36 阈值实证）；阶段 2 起踢击 ×1.5（规则51）、阶段 3 追逐疲劳（规则52）；与转化值配套写（值 100 + 阶段 3=满兔）" },
			{ key: "dm_rabbit_build", name: "兔子转化 · 转化值（0-100）", varPath: "rabbitbuild", type: "number", min: 0, max: 100,
			  note: "转化累积（transformation.js:165 addBuild 实证）；30/60/90 三阈值对应阶段 1/2/3；每日 -1 衰减，写 100 后自然回落；部件存 $transformationParts.rabbit 由本体 checkTFparts 兼容（规则46）" },
			{ key: "dm_mermaid", name: "人鱼转化 · 阶段（0-3）", varPath: "mermaid", type: "number", min: 0, max: 3,
			  note: "0 无 → 1 鳃 → 2 鳞片 → 3 鱼尾（transformation.js:65 阈值实证）；与转化值配套写（值 100 + 阶段 3=满人鱼）" },
			{ key: "dm_mermaid_build", name: "人鱼转化 · 转化值（0-100）", varPath: "mermaidbuild", type: "number", min: 0, max: 100,
			  note: "转化累积（transformation.js:165 实证）；30/60/90 三阈值；每日 -1 衰减；部件存 $transformationParts.mermaid" },
			/* NG+ */
			{ key: "dm_ngplus", name: "NG+ · 轮次", varPath: "ngplusCycle", type: "number", min: 0, max: 99,
			  note: "二周目轮次计数（ngplus.js:28 实证，供 twee 读取；NG+ 触发生成 ngplusCarried 继承快照）；写 0=普通档" },
			/* 伊洛（0.1.990 新增 NPC，yiluo.js 实证）：触碰伊洛剧情授予圣化（yiluo.twee 置 $yiluo_holy=1）；
			   圣化后兽类遭遇战免击/祝福（yiluo.js:105/128）——carrying 为瞬态不作弊 */
			{ key: "dm_yiluo_holy", name: "伊洛 · 圣化", varPath: "yiluo_holy", type: "number", min: 0, max: 1,
			  note: "圣化授予（yiluo.js:73 实证；:76 ensure 兜底 0）；写 1=圣化（兽类敌人免击 yiluo.js:105、圣化祝福 :128 实证），写 0=未圣化（触碰剧情可再触发）" }
		]
		}
	};
/* ============ v2.0.0.002 新适配：FertilityExpansion 1.7.0（伊甸生育/子女大扩展） ============
   源码实证（GitHub Liliths-Legacy/DOL-FertilityExpansion-MOD@main，对照源码 _modcache/fert_tmp）：
   mods/FertilityExpansion/boot.json —— name "FertilityExpansion"、version "1.7.0"，
   tweeFileList/scriptFileList/styleFileList 全空（全部内容靠 TweeReplacer 注入 + game/*.twee 15 个 + modules 20+ js + img 22 张）；
   addonPlugin = TweeReplacer（StoryCaption 挂 <<edenSetup>>、Children Activity Events 挂记录钩子等）。
   变量命名空间 = V.eden.*（eden.twee 里 $eden 是 schema 迁移对象，逐档 0→8 迁移，默认结构见 eden.twee:40-50/79-84/91-95）。
   本适配器只声明"源码有默认值、判定为标量"的键（object/array 如 eden.children / eden.facility 整体不声明，避免类型错配）。
   已证伪不声明的一条：`eden.lifeStoryReadMode` 取值为字符串 "first"/"reread"/null
   （eden-life-story.twee:3/93/121/128），不是 0/1 档位——按 v2.0.0.001 类型语义纪律，不建 stage。
   注：该模组自带 eden-cheats.js / eden-cheats-ui.js 作弊面板（10 项）。v2.0.0.002 起 CE 不做"只写数值"的
   缩水适配——04a-14-fert-cheats.js 直接复用其 window.EdenCheats，把模组面板的 10 项等价搬到 CE 的模组作弊页，
   与模组共用同一套 guard / 快照回滚 / feats.locked 语义（不重写它的 sync 链，避免两套写入口互相打架）。 */
/* 共享 helper：判定 ModLoader 是否装了某个名字的 mod。
   window.modDataValueZipList 的条目形态不稳定（string / {name|modName|id} 两种都见过），故都兼容。 */
function mbCEHasModNamed(names) {
	try {
		if (typeof window === "undefined") { return false; }
		var want = Array.isArray(names) ? names : [names];
		var list = window.modDataValueZipList;
		if (list && list.length) {
			for (var i = 0; i < list.length; i++) {
				var it = list[i];
				var n = "";
				if (typeof it === "string") { n = it; }
				else if (it && typeof it === "object") { n = String(it.name || it.modName || it.id || ""); }
				if (!n) { continue; }
				for (var j = 0; j < want.length; j++) {
					if (n.indexOf(want[j]) >= 0) { return true; }
				}
			}
		}
		return false;
	} catch (e) { return false; }
}
CHEAT_ADAPTERS["fertility-expansion"] = {
	detect: function () {
		try {
			if (typeof window === "undefined") { return false; }
			if (typeof mbCEHasModNamed === "function" && mbCEHasModNamed(["FertilityExpansion", "Fertility Expansion"])) { return true; }
			var V = (typeof getV === "function") ? getV() : null;
			return !!(V && V.eden && typeof V.eden === "object");
		} catch (e) { return false; }
	},
	entry: {
		modId: "fertility-expansion",
		modName: "FertilityExpansion 1.7.0（伊甸子女/生育扩展）",
		tasks: [],
		stages: [
			{ key: "fert_schema", name: "数据结构版本（0–8，逐档迁移）", varPath: "eden.schemaVersion",
			  levels: [0, 1, 2, 3, 4, 5, 6, 7, 8],
			  labels: ["0 初始", "1 子女容器", "2 journal→profile", "3 伊甸房产", "4 成长阶段设置",
			           "5 天赋与性格", "6 技能与日程", "7 亲密度/成年/通讯录", "8 成年遭遇指针"] }
		],
		abilities: [
			{ key: "fert_owned", name: "已取得伊甸房产", varPath: "eden.facility.owned", type: "boolean" },
			{ key: "fert_expanded", name: "伊甸房产已扩建", varPath: "eden.facility.expanded", type: "boolean" },
			{ key: "fert_bailey", name: "贝利已上门（房产线前置）", varPath: "eden.facility.baileyIntroduced", type: "boolean" },
			{ key: "fert_transfer", name: "转移流程已介绍", varPath: "eden.facility.transferIntroduced", type: "boolean" },
			{ key: "fert_neveradult", name: "禁止自动成年", varPath: "eden.settings.neverAutoAdult", type: "boolean" },
			{ key: "fert_sterile", name: "允许不孕妊娠分支", varPath: "eden.settings.allowSterilePregnancy", type: "boolean" },
			{ key: "fert_hotspot", name: "大厅热点显示", varPath: "eden.settings.showHallHotspots", type: "boolean" },
			{ key: "fert_human", name: "允许人类后代", varPath: "eden.settings.allowHumanDescendants", type: "boolean" },
			/* v2.0.0.002 补声明：eden-age.js normalizeSettings 里还有 3 个未被 CE 覆盖的布尔设置
			   （resetAgeOnTransfer:45 / immediateLifeStory:48 / enableNightVisits:52，均按 === true / !== false 判定）。
			   有意不声明 eden.settings.parentTitleSource（取值是字符串 "parentage"/"identity"/"appearance"，
			   eden-age.js:51，按 types-are-judgements 纪律不做 stage/number 档位，免得写入数字把模组判定打坏）。 */
			{ key: "fert_resetage", name: "转移时重置成长年龄", varPath: "eden.settings.resetAgeOnTransfer", type: "boolean" },
			{ key: "fert_immstory", name: "立即生成人生故事", varPath: "eden.settings.immediateLifeStory", type: "boolean" },
			{ key: "fert_nightvisit", name: "启用夜间探访（关闭后不触发）", varPath: "eden.settings.enableNightVisits", type: "boolean" }
		],
		scenes: [],
		values: [
			{ key: "fert_capacity", name: "伊甸房产容量（默认 3）", varPath: "eden.facility.capacity", type: "number", min: 0, max: 20,
			  note: "eden.twee:82 默认 3；模组按 gte 判定，写大值不会崩，但 UI 列表会随之变长" },
			{ key: "fert_maturity", name: "成长天数阈值（默认 90）", varPath: "eden.settings.maturityDays", type: "number", min: 0, max: 365,
			  note: "eden.twee:93 默认 90；写 0 会让子女立即进入下一成长阶段（模组按日结算）" }
		]
	}
};
/* ============ v2.0.0.002 需求④：FertilityExpansion 自带作弊的等价实现 ============
   模组自带作弊的原始清单（逐字读自 _modcache\fert_tmp\...\modules\eden-cheats.js + eden-cheats-ui.js，
   1.7.0，非二手转述）：window.EdenCheats = { available, labour, parasites, children, choices, identity,
   saveInnate, saveSkills, reset, resetReason, adultReason, settleAdult, removeChild }
   面板三块（eden-cheats-ui.js 挂在原版作弊页 #overlayTabs 的一个页签）：
     A 怀孕作弊扩展：一键分娩 / 寄生卵一键受精 / 寄生物一键成熟
     B 生育作弊扩展（单个已出生孩子）：先天四项 appearance/fitness/intelligence/temperament（0-100 整数）
       + 身份九项 species / monster / beastTransform / divineTransform / gender / size / hairColour /
         eyeColour / skinColour
     C 养育作弊扩展：knowledge / fitness / social / awareness（0-100）+ 重置养育进度 / 立刻成年结算 / 删除孩子
   本文件直接复用模组自己的 API（不重写它的 sync 链），因此行为与门控（guard/rollback/feats.locked）
   与模组面板完全一致；模组未装或 API 缺失时优雅降级为不可用提示。 */
var MB_CE_FERT_ACTIONS = [
	{ key: "fert_labour", name: "一键分娩（孕期推进到足月破水）", note: "调 EdenCheats.labour()，随后需继续原版生产流程", needsChild: false },
	{ key: "fert_parasite_fert", name: "寄生卵一键受精", note: "给未受精寄生卵置 fertilised 并满 daysLeft", needsChild: false },
	{ key: "fert_parasite_ripe", name: "寄生物一键成熟", note: "把已受精寄生物的 daysLeft 置 0", needsChild: false },
	{ key: "fert_innate", name: "保存先天属性与外貌（四项 + 身份九项）", note: "等价模组 saveInnate；改种族/性别受孕期与成年结算门控", needsChild: true },
	{ key: "fert_skills", name: "保存养育属性（knowledge/fitness/social/awareness）", note: "等价模组 saveSkills", needsChild: true },
	{ key: "fert_reset", name: "重置养育进度", note: "清年龄/养成/日程/成年 LLM 与孕期数据，地点回 eden_home", needsChild: true },
	{ key: "fert_adult", name: "立刻成年结算", note: "forcedAdult=true，按已保存属性结算，不补收益", needsChild: true },
	{ key: "fert_remove", name: "删除孩子（不可恢复）", note: "等价模组 removeChild", needsChild: true },
	{ key: "fert_reset_reason", name: "查询重置前置（为何不可重置）", note: "只读：等价模组 resetReason", needsChild: true },
	{ key: "fert_adult_reason", name: "查询成年前置（为何不可结算）", note: "只读：等价模组 adultReason", needsChild: true }
];
var MB_CE_FERT_INNATE_KEYS = ["appearance", "fitness", "intelligence", "temperament"];
var MB_CE_FERT_SKILL_KEYS = ["knowledge", "fitness", "social", "awareness"];
var MB_CE_FERT_ID_KEYS = ["species", "monster", "beastTransform", "divineTransform", "gender", "size", "hairColour", "eyeColour", "skinColour"];
function mbCEFertApi() {
	try { return (typeof window !== "undefined" && window.EdenCheats) ? window.EdenCheats : null; } catch (e) { return null; }
}
/* v2.0.0.003 需求①：不再要求玩家先开原版作弊页。
   模组侧有两道闸：available()（vars().cheatsEnabled === true 或原版 Cheats 面板 DOM 判据）和
   perform() 里的 guard()（每次动作都 `if (!available()) throw new Error("请先打开原版作弊页。")`，
   _modcache\fert_tmp\...\modules\eden-cheats.js:37-51 逐字实证）。所以仅绕开 CE 侧的自检不够，
   必须在调用它的瞬间让它「看见」cheatsEnabled=true。做法：临时置 V.cheatsEnabled = true，
   调用返回后立即还原原值（原本没有该字段则删除），不污染存档、不触发原版作弊页 UI。
   模组其余安全闸（statFreeze / 战斗中 / 附属 NPC / 生产流程中 / NPCList[0]）仍全部生效。
   置位到还原在同一个同步调用栈内完成（finally 覆盖 throw），SugarCube 的 autosave 只发生在 passage
   导航/显式保存，不会插进这段同步栈 —— 结构性推理，非实机实测；enabled-cheats 全模组只有 1 处读它（:38）。 */
function mbCEFertWithCheats(fn) {
	var V = null, had = false, old;
	try { V = getV(); } catch (e) { V = null; }
	if (!V || typeof V !== "object") { return fn(); }
	had = Object.prototype.hasOwnProperty.call(V, "cheatsEnabled");
	old = V.cheatsEnabled;
	if (old !== true) { try { V.cheatsEnabled = true; } catch (e2) { return fn(); } }
	try {
		return fn();
	} finally {
		try {
			if (old !== true) {
				if (had) { V.cheatsEnabled = old; }
				else { try { delete V.cheatsEnabled; } catch (e3) { /* delete 被拒（Proxy/冻结对象）：退化为 undefined，而非写 false —— false 会在存档里留下与「从未设置」语义不同的假值，undefined 会被 JSON.stringify 丢弃 */ try { V.cheatsEnabled = undefined; } catch (e5) { /* 只能放弃还原 */ } } }
			}
		} catch (e4) { /* 还原失败不影响主流程 */ }
	}
}
function mbCEFertReady() {
	var api = mbCEFertApi();
	if (!api) { return { ok: false, message: "未检测到 window.EdenCheats（FertilityExpansion 未加载或版本不含自带作弊）", bypass: false }; }
	var avail = true;
	try { if (typeof api.available === "function") { avail = !!api.available(); } } catch (e) { avail = false; }
	/* available 只作说明（面板据此展示红字），不再作为不可用门槛 */
	return { ok: true, bypass: !avail };
}
function mbCEFertChildren() {
	var api = mbCEFertApi();
	if (!api || typeof api.children !== "function") { return []; }
	return mbCEFertWithCheats(function () {
		try { return api.children("") || []; } catch (e) { return []; }
	});
}
function mbCEFertRecord(id) {
	try {
		var V = getV();
		return (V && V.eden && V.eden.children && V.eden.children[id]) ? V.eden.children[id] : null;
	} catch (e) { return null; }
}
function mbCEFertChildLabel(entry) {
	var id = String(entry[0]), child = entry[1] || {};
	return "#" + id + " " + (child.name || "未命名") + "（" + (child.gender === "f" ? "女" : child.gender === "m" ? "男" : child.gender || "?") + "）";
}
/* 统一执行入口：所有动作都走模组 API，返回模组给出的 { ok, message }
   v2.0.0.003：整个调用包在 mbCEFertWithCheats 里——模组 guard() 每次动作都查 available()，
   所以临时满足必须覆盖「从进入 perform 到它内部快照/回滚结束」的完整区间。 */
function mbCEFertRun(key, id, patch) {
	var r = mbCEFertReady();
	if (!r.ok) { return r; }
	var api = mbCEFertApi();
	return mbCEFertWithCheats(function () {
		try {
			if (key === "fert_labour") { return api.labour() || { ok: true, message: "已执行" }; }
			if (key === "fert_parasite_fert") { return api.parasites(true) || { ok: true, message: "已执行" }; }
			if (key === "fert_parasite_ripe") { return api.parasites(false) || { ok: true, message: "已执行" }; }
			if (!id) { return { ok: false, message: "请先选择一个已出生的孩子" }; }
			if (key === "fert_innate") { return api.saveInnate(id, patch || {}) || { ok: true, message: "已执行" }; }
			if (key === "fert_skills") { return api.saveSkills(id, patch || {}) || { ok: true, message: "已执行" }; }
			if (key === "fert_reset") { return api.reset(id) || { ok: true, message: "已执行" }; }
			if (key === "fert_adult") { return api.settleAdult(id) || { ok: true, message: "已执行" }; }
			if (key === "fert_remove") { return api.removeChild(id) || { ok: true, message: "已执行" }; }
			if (key === "fert_reset_reason") {
				var rr = api.resetReason(id);
				return { ok: true, message: rr ? ("不可重置：" + rr) : "可以重置（无阻塞前置）" };
			}
			if (key === "fert_adult_reason") {
				var ar = api.adultReason(id);
				return { ok: true, message: ar ? ("不可成年结算：" + ar) : "可以成年结算（无阻塞前置）" };
			}
			return { ok: false, message: "未知动作：" + key };
		} catch (e) { return { ok: false, message: "模组 API 抛出异常：" + mbCEErr(e) }; }
	});
}
/* 面板：孩子下拉 + 10 项动作（先天/养成需要填表，其余一键） */
function mbCEFertRender(container) {
	if (!container) { return; }
	var ready = mbCEFertReady();
	container.appendChild(el("div", "mce-hint",
		"直接调用模组自带的 window.EdenCheats（等价 eden-cheats-ui 的全部 10 项），门控、快照回滚与 feats.locked 语义与模组一致。"));
	/* v2.0.0.003 需求①：这行红字是模组自己的原始提示，原文保留不动，只在后面接一句「我不同意」。
	   用户 2026-11-07 明确要求保留原文（不是删掉），红字照旧显示，功能不再受它限制。 */
	container.appendChild(el("div", "mce-err",
		"模组要求先开启原版作弊页（cheatsEnabled / 原版 Cheats 面板处于打开状态）—— 我不同意。"));
	/* API 缺失时才早退：此时不能断言「你已经开着原版作弊页」（那会把缺 API 说成已开启） */
	if (!ready.ok) { container.appendChild(el("div", "mce-hint", ready.message)); return; }
	container.appendChild(el("div", "mce-hint",
		ready.bypass
			? "模组当前判为「未开启原版作弊页」：CE 每次调用时临时把 cheatsEnabled 置真满足它，返回后立刻还原原值，你不用真去开原版作弊页。"
			: "你已经开着原版作弊页；即便不开，CE 也会在调用期间临时满足该前置，用完还原。"));
	var list = mbCEFertChildren();
	var sel = el("select", "mce-inp");
	list.forEach(function (entry) { var o = el("option", "", mbCEFertChildLabel(entry)); o.value = String(entry[0]); sel.appendChild(o); });
	var childRow = el("div", "mce-row");
	childRow.appendChild(el("span", "mce-row-lbl", "目标孩子（" + list.length + " 个已出生）："));
	childRow.appendChild(sel);
	container.appendChild(childRow);
	if (!list.length) { container.appendChild(el("div", "mce-hint", "当前没有已出生的孩子：先天/养成/重置/成年/删除需要先有孩子。")); }
	/* A 怀孕三项：不需要孩子 */
	var groupA = el("div", "mce-row");
	["fert_labour", "fert_parasite_fert", "fert_parasite_ripe"].forEach(function (k) {
		var a = MB_CE_FERT_ACTIONS.filter(function (x) { return x.key === k; })[0];
		var b = el("button", "mce-btn mce-gold", a.name); b.type = "button"; b.title = a.note;
		b.addEventListener("click", function () {
			var res = mbCEFertRun(k, "", null);
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderModCheatDetail("fertility-expansion");
		});
		groupA.appendChild(b);
	});
	container.appendChild(groupA);
	/* B 先天四项 + 身份九项 */
	var innateBox = el("div", "mce-grp");
	var rec0 = list.length ? mbCEFertRecord(String(sel.value)) : null;
	var innate0 = (rec0 && rec0.innate) ? rec0.innate : {};
	var inputs = {};
	function addField(parent, label, key, value) {
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", label + "："));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.value = (value == null) ? "" : String(value);
		inputs[key] = inp;
		row.appendChild(inp);
		parent.appendChild(row);
	}
	container.appendChild(el("div", "mce-hint", "先天属性（0–100 整数）与身份九项：留空按当前值提交（模组会校验可选值）"));
	MB_CE_FERT_INNATE_KEYS.forEach(function (k) { addField(innateBox, "先天 " + k, k, innate0[k]); });
	MB_CE_FERT_ID_KEYS.forEach(function (k) {
		var cur = "";
		try {
			var api = mbCEFertApi();
			if (list.length && api && typeof api.identity === "function") { cur = api.identity(list[0][1])[k] || ""; }
		} catch (e) { cur = ""; }
		addField(innateBox, "身份 " + k, k, cur);
	});
	container.appendChild(innateBox);
	var bInnate = el("button", "mce-btn mce-gold", "保存先天属性与外貌"); bInnate.type = "button";
	bInnate.addEventListener("click", function () {
		var patch = {}, rec = mbCEFertRecord(String(sel.value));
		var innate = (rec && rec.innate) ? rec.innate : {};
		var missing = [];
		MB_CE_FERT_INNATE_KEYS.forEach(function (k) {
			var v = String(inputs[k].value || "").trim();
			if (!v) { if (typeof innate[k] === "number") { patch[k] = innate[k]; } else { missing.push(k); } }
			else { patch[k] = v; }
		});
		if (missing.length) { setStatus("缺少先天属性：" + missing.join(" / ") + "（模组要求四项全填）", "mce-err"); return; }
		var api = mbCEFertApi(), child = null;
		try { child = list.filter(function (e) { return String(e[0]) === String(sel.value); })[0]; } catch (e) { child = null; }
		MB_CE_FERT_ID_KEYS.forEach(function (k) {
			var v = String(inputs[k].value || "").trim();
			if (v) { patch[k] = v; }
			else if (api && child && typeof api.identity === "function") { patch[k] = api.identity(child[1])[k] || ""; }
		});
		if (patch.species === undefined) { patch.species = (child && child[1] && child[1].species) || "human"; }
		if (patch.gender === undefined) { patch.gender = (child && child[1] && child[1].gender) || "f"; }
		var res = mbCEFertRun("fert_innate", String(sel.value), patch);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		renderModCheatDetail("fertility-expansion");
	});
	container.appendChild(bInnate);
	/* C 养成四项 + 三个二次确认动作 */
	var skillBox = el("div", "mce-grp");
	var training = (rec0 && rec0.training && rec0.training.skills) ? rec0.training.skills : {};
	MB_CE_FERT_SKILL_KEYS.forEach(function (k) { addField(skillBox, "养成 " + k, k, training[k]); });
	container.appendChild(skillBox);
	var bSkills = el("button", "mce-btn mce-gold", "保存养育属性"); bSkills.type = "button";
	bSkills.addEventListener("click", function () {
		var patch = {}, missing = [];
		MB_CE_FERT_SKILL_KEYS.forEach(function (k) {
			var v = String(inputs[k].value || "").trim();
			if (!v) { if (typeof training[k] === "number") { patch[k] = training[k]; } else { missing.push(k); } }
			else { patch[k] = v; }
		});
		if (missing.length) { setStatus("缺少养成属性：" + missing.join(" / ") + "（模组要求四项全填）", "mce-err"); return; }
		var res = mbCEFertRun("fert_skills", String(sel.value), patch);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		renderModCheatDetail("fertility-expansion");
	});
	container.appendChild(bSkills);
	var groupC = el("div", "mce-row");
	["fert_reset", "fert_adult", "fert_remove", "fert_reset_reason", "fert_adult_reason"].forEach(function (k) {
		var a = MB_CE_FERT_ACTIONS.filter(function (x) { return x.key === k; })[0];
		var destructive = (k === "fert_reset" || k === "fert_remove");
		var b = el("button", destructive ? "mce-btn" : "mce-btn", a.name); b.type = "button"; b.title = a.note;
		b.addEventListener("click", function () {
			var res = mbCEFertRun(k, String(sel.value), null);
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderModCheatDetail("fertility-expansion");
		});
		groupC.appendChild(b);
	});
	container.appendChild(groupC);
}
/* 挂到已注册的适配器（04a-13 先拼接，本文件后拼接 → 此处 entry 一定存在） */
(function () {
	try {
		var ad = CHEAT_ADAPTERS["fertility-expansion"];
		if (!ad || !ad.entry) { return; }
		ad.entry.actions = MB_CE_FERT_ACTIONS.map(function (a) {
			return {
				key: a.key, name: a.name, note: a.note, needsChild: !!a.needsChild,
				run: function (arg) { return mbCEFertRun(a.key, arg && arg.id ? arg.id : "", arg && arg.patch ? arg.patch : null); }
			};
		});
		ad.entry.actionPanel = mbCEFertRender;
	} catch (e) { /* 适配器未注册时静默 */ }
})();
/* ============ v2.0.0.002 需求①③ + 玩家截图四条：FertilityExpansion 孩子页 ============
   位置：挂在 fertility-expansion 适配器面板的最下面（04a-14 的 mbCEFertRender 之后），
         孩子集中在这里做数值调整，不再散落在角色页。
   源码实证（_modcache/fert_tmp/.../mods/FertilityExpansion/modules，1.7.0，逐字读，非二手）：
   - 孩子数据两种形态：新存档 V.childRecords（数组）/ 旧存档 V.children（对象）；
     统一走 window.EdenChildData 的 entries / get / phaseOf / locationOf / setLocation / ageDays。
     EdenChildData.entries({scope:"all"}) 已排除 removed（edenDeleted === true 或 pregnancy.carrier === "cleared"）。
   - 孩子「好感/爱意」= V.eden.children[<childId>].affection，范围 0-100、两位小数：
     eden-adult.js:144-149 ensureAffection（默认 newResident 40 / existingResident 50）、
     :488-490 remittance 用 affectionFloor 30 + fullAffection 80、
     :539-549 intimacy minimumAffection 40；
     eden-profile.js:176-182 面板显示为「好感」；eden-chat-prompt.js:10-15 按 20/40/60/80 分段描述亲疏。
   - 成长：eden-age.js:150-169 syncRecord —— record.forcedAdult === true 时 lifeStage 直接置 "adult"
     （只改阶段，不写 adult.settled）；年龄按 getAgeDays(child, record)（以 growthStartSerialDay 或 born 起算）。
   - 地点：eden-child-data.js setLocation 只对 phase born/egg 生效，records 形态写 child.development.location；
     源码实际产出过的合法值 = eden_home / home / eden_contacts / away / eden_released
     （eden-breeding.js:222/245/419 生产 eden_home 与 home；eden-adult.js:357 结算写 eden_contacts / eden_released）。
   - 「一键长大 + 立刻成年结算」的配合：settleAdult 的前置 needsSettlement 要求 lifeStage==="adult"
     + phaseOf==="born" + locationOf==="eden_home" + !adult.settled（eden-adult.js:402-413）。
     所以必须先在 eden_home 一键长大，再点「立刻成年结算」；已在其它地点的孩子按钮会如实报前置失败，不静默。 */
var MB_CE_FERT_KID_LOCS = [
	{ key: "eden_home", label: "伊甸园（eden_home）" },
	{ key: "home", label: "玩家住处（home）" },
	{ key: "eden_contacts", label: "成年·通讯录（eden_contacts）" },
	{ key: "away", label: "成年·离家（away）" },
	{ key: "eden_released", label: "成年·已放归（eden_released）" }
];
var MB_CE_FERT_KID_STATUS = {
	active: "在园", resident: "常驻", adult_pending: "待成年结算", adult: "已成年", released: "已放归"
};
function mbCEFertKidData() {
	try { return (typeof window !== "undefined" && window.EdenChildData) ? window.EdenChildData : null; } catch (e) { return null; }
}
/* 模组每个方法都有可选的 vars 尾参（eden-child-data.js: get(id, vars) / phaseOf(child, vars) /
   setLocation(child, location, vars) / ageDays(child, record, vars) / entries(opts, vars)），
   缺省值取自 window.SugarCube?.State?.variables。本页实测该通道不可见（SugarCube 只挂空壳对象），
   所以一律显式传存档变量，避免整页静默空转；多传实参对旧版模组无副作用（多余实参被忽略）。 */
function mbCEFertKidVars() {
	try { var V = getV(); return (V && typeof V === "object") ? V : {}; } catch (e) { return {}; }
}
/* 取孩子列表（含未出生的卵/胎儿，scope=all 且排除 removed）。
   优先 EdenChildData.entries，回退直读存档（模组未加载时孩子页也能列出并告警）。 */
function mbCEFertKidPairs() {
	var out = [];
	var api = mbCEFertKidData();
	var V0 = mbCEFertKidVars();
	if (api && typeof api.entries === "function") {
		try {
			var e = api.entries({ scope: "all" }, V0);
			if (e && typeof e.forEach === "function" && !Array.isArray(e)) { e.forEach(function (v, k) { out.push([String(k), v]); }); }
			else if (Array.isArray(e)) {
				e.forEach(function (it) {
					if (Array.isArray(it) && it.length >= 2) { out.push([String(it[0]), it[1]]); }
					else if (it && typeof it === "object") { out.push([String(it.childId), it]); }
				});
			}
		} catch (x) { out = []; }
	}
	if (!out.length) {
		var V = getV();
		var rec = (V && V.childRecords) ? V.childRecords : null;
		if (Array.isArray(rec)) {
			/* records 形态：孩子 id 就是数组下标（EdenChildData.indexOf 只接受 (0|[1-9]\d*) 并按下标取），
			   且模组 get() 要求 child.childId === 下标——childId 与下标不符的条目模组自己查不到，
			   这里也不列出，否则删孩子后会留下「假存在」。edenDeleted === true 同样跳过。 */
			rec.forEach(function (c, i) {
				if (!c || typeof c !== "object" || c.edenDeleted === true) { return; }
				var cid = (c.childId !== undefined && c.childId !== null) ? Number(c.childId) : i;
				if (cid !== i) { return; }
				out.push([String(i), c]);
			});
		}
		else if (V && V.children && typeof V.children === "object") {
			Object.keys(V.children).forEach(function (k) {
				var c = V.children[k];
				if (c && c.edenDeleted !== true) { out.push([k, c]); }
			});
		}
	}
	return out;
}
/* 存在性检测：模组侧删掉孩子后这里必须返回 null（玩家要求「自动检测是否还存在、不能出问题」）。
   两道通道：EdenChildData.get（在线时的正路，phaseOf=removed 直接判死）→ 枚举兜底（API 缺失或查不到时）。 */
function mbCEFertKidAlive(id) {
	var key = String(id);
	var api = mbCEFertKidData();
	var V = mbCEFertKidVars();
	var child = null;
	if (api && typeof api.get === "function") {
		try { child = api.get(key, V); } catch (e) { child = null; }
		if (!child) { try { child = api.get(Number(key), V); } catch (e2) { child = null; } }
		if (child) {
			try {
				if (typeof api.phaseOf === "function") {
					var ph = api.phaseOf(child, V);
					if (ph === "removed" || ph === "missing") { return null; }
				}
			} catch (e3) { /* 判定失败按存在处理，交给写入前的 record 校验兜底 */ }
			return child;
		}
	}
	var pairs = mbCEFertKidPairs();
	for (var i = 0; i < pairs.length; i++) { if (pairs[i][0] === key) { return pairs[i][1]; } }
	return null;
}
/* phase 判定兜底：逐条对齐 eden-child-data.js:50-59 的 phaseOf 语义
   （无 child→missing / edenDeleted→removed / 非 record→eggTimer?egg:born /
      record 且 pregnancy.carrier==="cleared"→removed / bornDate 有限→born /
      hawk 且 pregnancy.deliveredDate 有限→egg / 其余 unborn）。 */
function mbCEFertKidPhase(child) {
	var api = mbCEFertKidData();
	try { if (api && typeof api.phaseOf === "function") { return api.phaseOf(child, mbCEFertKidVars()); } } catch (e) { /* 回退下一条 */ }
	if (!child || typeof child !== "object") { return "missing"; }
	if (child.edenDeleted === true) { return "removed"; }
	var isRec = (child.bornDate !== undefined);
	if (!isRec) { return (child.eggTimer !== undefined) ? "egg" : "born"; }
	var pg = null;
	try {
		var V = mbCEFertKidVars();
		var idx = Number(child.pregnancyId);
		if (Number.isInteger(idx) && idx >= 0 && Array.isArray(V.pregnancies)) { pg = V.pregnancies[idx] || null; }
	} catch (e2) { pg = null; }
	if (pg && pg.carrier === "cleared") { return "removed"; }
	if (Number.isFinite(child.bornDate)) { return "born"; }
	if (pg && Number.isFinite(pg.deliveredDate)) { return "egg"; }
	return "unborn";
}
function mbCEFertKidLocation(child) {
	var api = mbCEFertKidData();
	try {
		if (api && typeof api.locationOf === "function") {
			var l = api.locationOf(child);
			if (l !== undefined && l !== null && l !== "") { return String(l); }
		}
	} catch (e) { /* 回退直读 */ }
	if (child && child.development && typeof child.development === "object" && child.development.location) { return String(child.development.location); }
	if (child && child.location) { return String(child.location); }
	return "";
}
/* 概要：一行里需要的全部只读信息，全部实时取，不缓存（保证删孩子后立刻反映） */
function mbCEFertKidInfo(id) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	var api = mbCEFertKidData();
	var ageDays = null;
	if (child) {
		try { ageDays = (api && typeof api.ageDays === "function") ? api.ageDays(child, rec, mbCEFertKidVars()) : ((rec && typeof rec.ageDays === "number") ? rec.ageDays : null); } catch (e) { ageDays = null; }
	}
	var affection = (rec && Number.isFinite(Number(rec.affection))) ? Number(rec.affection) : null;
	return {
		id: String(id),
		alive: !!child,
		child: child,
		record: rec,
		name: (child && child.name) ? String(child.name) : "未命名",
		gender: (child && child.gender) ? String(child.gender) : "",
		phase: child ? mbCEFertKidPhase(child) : "missing",
		location: child ? mbCEFertKidLocation(child) : "",
		species: (rec && rec.species) ? String(rec.species) : ((child && child.species) ? String(child.species) : ""),
		lifeStage: (rec && rec.lifeStage) ? String(rec.lifeStage) : "",
		lifeStageLabel: (rec && rec.lifeStageLabel) ? String(rec.lifeStageLabel) : "",
		ageDays: ageDays,
		affection: affection,
		status: (rec && rec.status) ? String(rec.status) : "",
		settled: !!(rec && rec.adult && rec.adult.settled),
		outcome: (rec && rec.adult && rec.adult.outcome) ? String(rec.adult.outcome) : "",
		training: (rec && rec.training && rec.training.skills) ? rec.training.skills : null,
		innate: (rec && rec.innate) ? rec.innate : null
	};
}
/* 写好感：走通用执行器（0-100 下限钳制 + V.mbCE_wrote 留痕可回退），
   动态 id 路径 eden.children.<id>.affection 不在 varPath 声明体系里，只能这样写。 */
function mbCEFertKidSetAffection(id, raw) {
	var rec = mbCEFertRecord(String(id));
	if (!rec) { return { ok: false, message: "这个孩子在养育记录 eden.children 里不存在（可能刚被模组侧删除），已刷新列表" }; }
	if (!mbCEFertKidAlive(id)) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	return cheatWriteValue("fertility-expansion", "fert_child_aff_" + id, "fert_child_aff", "eden.children." + id + ".affection", raw, "number", 0, 100);
}
/* 定向发送：走模组 EdenChildData.setLocation（只对 born/egg 生效），失败不静默 */
function mbCEFertKidSetLocation(id, loc) {
	var child = mbCEFertKidAlive(id);
	if (!child) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	var target = String(loc === undefined || loc === null ? "" : loc).trim();
	if (!target) { return { ok: false, message: "地点不能为空（例：eden_home / home / eden_contacts）" }; }
	/* 模组 setLocation 的前置：phase 必须是 born / egg（eden-child-data.js:99）。
	   兜底直写前必须先过同一道门控，否则会把未出生的胎儿也写出地点（越过模组语义）。 */
	var phase = mbCEFertKidPhase(child);
	if (phase !== "born" && phase !== "egg") {
		return { ok: false, message: "无法发送：该孩子当前是「" + phase + "」（未出生/已移除），模组只允许已出生或已产卵的孩子指定地点" };
	}
	var before = mbCEFertKidLocation(child);
	var ok = false, via = "setLocation";
	var api = mbCEFertKidData();
	var V = mbCEFertKidVars();
	try { if (api && typeof api.setLocation === "function") { ok = api.setLocation(child, target, V) !== false; } } catch (e) { ok = false; }
	if (!ok) {
		/* 兜底直写（模组 API 缺失或被拒时按数据结构写，已过上面的 phase 门控） */
		try {
			if (child.development && typeof child.development === "object") { child.development.location = target; }
			else { child.location = target; }
			ok = mbCEFertKidLocation(child) === target;
			via = "direct";
		} catch (e2) { ok = false; }
	}
	if (!ok) { return { ok: false, message: "无法更新这个孩子的地点（模组 setLocation 拒绝，通常是还没出生/已移除）" }; }
	try {
		/* v2.0.12 自查：本函数 L194 已声明 var V = mbCEFertKidVars()（等价 getV() 的空值兜底），
		   此处再 var 属同作用域重复声明（ESLint no-redeclare）。改为赋值复用，语义不变。 */
		V = getV();
		if (V) {
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = "cheat:fertility-expansion:fert_child_loc_" + id;
			var prev = V.mbCE_wrote[key];
			var keepBefore = (prev && "before" in prev) ? prev.before : before;
			V.mbCE_wrote[key] = { type: "cheat", modId: "fertility-expansion", op: "fert_child_loc", path: "eden.children." + id + ".location", childId: String(id), before: keepBefore, after: target, via: via, t: Date.now() };
			if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
		}
	} catch (e3) { /* 留痕失败不影响写入结果 */ }
	return { ok: true, message: "已把孩子 #" + id + " 定向送到 " + target + "（原地点 " + (before || "未知") + "）" };
}
/* 随叫随到：把地点对齐到玩家当前位置；玩家所在位置若不是模组认的两个居所，退回 eden_home 并说明 */
function mbCEFertKidCallToMe(id) {
	var V = getV();
	var here = (V && V.location) ? String(V.location) : "";
	var target = here;
	if (target !== "eden_home" && target !== "home") { target = "eden_home"; }
	var res = mbCEFertKidSetLocation(id, target);
	if (res.ok && here && here !== target) {
		res.message += "（玩家当前在 " + here + "，模组只认 eden_home/home 作为孩子居所，已送到 eden_home）";
	}
	return res;
}
/* 一键长大：forcedAdult = true + EdenAge.syncRecord（lifeStage 直接成年），
   随后跑 EdenAdult.syncRecord 让 status 变成 adult_pending（不等于结算，收益仍需「立刻成年结算」）。 */
function mbCEFertKidGrowUp(id, silent) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	if (!child || !rec) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	/* 只对已出生的孩子长大：胎儿/未孵化的卵没有年龄起点，模组 syncRecord 会按 0 天算出婴儿期，
       forcedAdult 虽能强推成年，但会连带把 bornDate 缺失的孩子写进 adult_pending，属越过模组语义。 */
	var phase = mbCEFertKidPhase(child);
	if (phase !== "born") {
		return { ok: false, message: "无法长大：#" + id + " 当前是「" + phase + "」，只有已出生的孩子可以一键长大" };
	}
	var V = getV();
	var settings = (V && V.eden && V.eden.settings && typeof V.eden.settings === "object") ? V.eden.settings : {};
	var before = { forcedAdult: rec.forcedAdult, lifeStage: rec.lifeStage, status: rec.status };
	rec.forcedAdult = true;
	var synced = false;
	try {
		if (typeof window !== "undefined" && window.EdenAge && typeof window.EdenAge.syncRecord === "function") {
			window.EdenAge.syncRecord(rec, child, settings);
			synced = true;
		}
	} catch (e) { synced = false; }
	if (!synced) { rec.lifeStage = "adult"; rec.lifeStageLabel = (rec.lifeStageLabel || "") || "成年"; }
	try {
		if (typeof window !== "undefined" && window.EdenAdult && typeof window.EdenAdult.syncRecord === "function") { window.EdenAdult.syncRecord(rec, child); }
	} catch (e2) { /* 成年状态同步失败不影响已长大 */ }
	try {
		if (V) {
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = "cheat:fertility-expansion:fert_child_adult_" + id;
			var prev = V.mbCE_wrote[key];
			var keep = (prev && "before" in prev) ? prev.before : before;
			V.mbCE_wrote[key] = { type: "cheat", modId: "fertility-expansion", op: "fert_child_adult", path: "eden.children." + id + ".forcedAdult", childId: String(id), before: keep, after: true, via: synced ? "EdenAge.syncRecord" : "direct", t: Date.now() };
			if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
		}
	} catch (e3) { /* 留痕失败不影响写入结果 */ }
	if (silent) { return { ok: true, message: "" }; }
	return {
		ok: true,
		message: "已把 #" + id + " 一键长大：阶段 " + (rec.lifeStageLabel || rec.lifeStage || "?")
			+ "、" + (MB_CE_FERT_KID_STATUS[rec.status] || rec.status || "?")
			+ (rec.lifeStage === "adult" ? "（要结算未来收益请再点「立刻成年结算」）" : "（模组未把阶段推到成年，请检查该孩子的种族是否可养育）")
	};
}
function mbCEFertKidLocLabel(loc) {
	var hit = MB_CE_FERT_KID_LOCS.filter(function (x) { return x.key === loc; })[0];
	return hit ? hit.label : (loc || "未知");
}
function mbCEFertKidAgeText(info) {
	if (info.phase === "egg") { return "未孵化"; }
	if (typeof info.ageDays !== "number" || !isFinite(info.ageDays)) { return "年龄未知"; }
	return "约 " + Math.max(0, Math.floor(info.ageDays)) + " 天";
}
/* ============ v2.0.0.002 收敛轮：孩子个体数值写入层（养育四项 / 先天四项）============ 
   从 04a-15-fert-children.js 拆出（原文件 407 行会越过评分 C3 的 ≤400 满分档）。
   模组 EdenCheats.saveSkills / saveInnate 的 patch 要求四项齐全（eden-cheats.js:189 numeric(patch[k]) 对缺项抛错，
   不是清零），所以这里先用记录当前值补齐、只改用户填的那一项；模组 API 缺失/失败时按同一结构兜底直写。
   全部写入走 V.mbCE_wrote 留痕（与好感/地点同一通道，可回退）。 */
/* ===== 养育四项 / 先天四项（孩子页里的数值调整主体） =====
   模组 EdenCheats.saveSkills / saveInnate 的 patch 要求四项齐全：
   eden-cheats.js:189 `numeric(patch[k], 0, 100)` 对缺项直接抛错（不是清零），
   所以调用前必须先用记录里的当前值补齐，只改用户填的那一项。 */
var MB_CE_FERT_KID_SKILLS = ["knowledge", "fitness", "social", "awareness"];
var MB_CE_FERT_KID_INNATE = ["appearance", "fitness", "intelligence", "temperament"];
function mbCEFertKidCurSkills(rec) {
	var src = (rec && rec.training && rec.training.skills && typeof rec.training.skills === "object") ? rec.training.skills : {};
	var out = {};
	MB_CE_FERT_KID_SKILLS.forEach(function (k) { var n = Number(src[k]); out[k] = Number.isFinite(n) ? n : 0; });
	return out;
}
function mbCEFertKidCurInnate(rec) {
	var src = (rec && rec.innate && typeof rec.innate === "object") ? rec.innate : {};
	var out = {};
	MB_CE_FERT_KID_INNATE.forEach(function (k) { var n = Number(src[k]); out[k] = Number.isFinite(n) ? n : 0; });
	return out;
}
/* 记录里的四项若还没由模组初始化（record.innate / record.training.skills 缺项），
   先让模组自己的 syncRecord 生成默认值再读，避免把「未生成」当成 0 写死。 */
function mbCEFertKidEnsureSkills(rec, child) {
	try {
		var cur = mbCEFertKidCurSkills(rec), miss = false;
		MB_CE_FERT_KID_SKILLS.forEach(function (k) { if (!(rec && rec.training && rec.training.skills && rec.training.skills[k] !== undefined)) { miss = true; } });
		if (!miss) { return cur; }
		if (typeof window !== "undefined" && window.EdenTraining && typeof window.EdenTraining.syncRecord === "function") {
			var V = mbCEFertKidVars();
			window.EdenTraining.syncRecord(rec, child, (V && V.eden && V.eden.settings) ? V.eden.settings : {});
			return mbCEFertKidCurSkills(rec);
		}
	} catch (e) { /* 同步失败按当前值处理 */ }
	return mbCEFertKidCurSkills(rec);
}
function mbCEFertKidEnsureInnate(rec, child, id) {
	try {
		var miss = false;
		MB_CE_FERT_KID_INNATE.forEach(function (k) { if (!(rec && rec.innate && rec.innate[k] !== undefined)) { miss = true; } });
		if (!miss) { return mbCEFertKidCurInnate(rec); }
		if (typeof window !== "undefined" && window.EdenTraits && typeof window.EdenTraits.syncRecord === "function") {
			/* 签名见 eden-cheats.js:168 syncRecord(record, child, String(id), v) */
			window.EdenTraits.syncRecord(rec, child, String(id), mbCEFertKidVars());
			return mbCEFertKidCurInnate(rec);
		}
	} catch (e) { /* 同步失败按当前值处理 */ }
	return mbCEFertKidCurInnate(rec);
}
/* 合并优先级：用户填的值 > 记录当前值；空串视为「不改」，避免误清 0 */
function mbCEFertKidMerge4(base, keys, supplied, integer) {
	var out = {}, bad = "";
	for (var i = 0; i < keys.length; i++) {
		var k = keys[i];
		var s = supplied ? supplied[k] : undefined;
		var use = (s !== undefined && s !== null && String(s).trim() !== "") ? s : base[k];
		var n = Number(String(use === undefined || use === null ? "" : use).trim());
		if (!Number.isFinite(n) || n < 0 || n > 100) { bad = k + "=" + use; break; }
		if (integer && !Number.isInteger(n)) { bad = k + "=" + use + "（需整数）"; break; }
		out[k] = n;
	}
	return bad ? { ok: false, message: "数值需为 0–100" + (integer ? " 的整数" : "") + "：" + bad } : { ok: true, vals: out };
}
/* 留痕（与好感/地点同一通道，回退语义一致：保留首次 before） */
function mbCEFertKidMark(id, op, before, after, via, path) {
	try {
		var V = getV();
		if (!V) { return; }
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		var key = "cheat:fertility-expansion:" + op + "_" + id;
		var prev = V.mbCE_wrote[key];
		V.mbCE_wrote[key] = {
			type: "cheat", modId: "fertility-expansion", op: op, path: path || ("eden.children." + id), childId: String(id),
			before: (prev && "before" in prev) ? prev.before : before, after: after, via: via, t: Date.now()
		};
		if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
	} catch (e) { /* 留痕失败不影响写入 */ }
}
function mbCEFertKidSaveSkills(id, vals) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	if (!child || !rec) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	if (mbCEFertKidPhase(child) !== "born") { return { ok: false, message: "孩子还没出生，养育属性只在出生后可写" }; }
	var before = mbCEFertKidEnsureSkills(rec, child);
	var merged = mbCEFertKidMerge4(before, MB_CE_FERT_KID_SKILLS, vals, false);
	if (!merged.ok) { return merged; }
	var full = /** @type {any} */ (merged.vals), res = null, via = "direct";
	var api = mbCEFertApi();
	if (api && typeof api.saveSkills === "function") {
		try { res = api.saveSkills(String(id), full); if (res && res.ok === true) { via = "EdenCheats.saveSkills"; } } catch (e) { res = null; }
	}
	if (!res || res.ok !== true) {
		try {
			if (!rec.training || typeof rec.training !== "object" || Array.isArray(rec.training)) { rec.training = {}; }
			if (!rec.training.skills || typeof rec.training.skills !== "object" || Array.isArray(rec.training.skills)) { rec.training.skills = {}; }
			Object.assign(rec.training.skills, full);
		} catch (e2) { return { ok: false, message: "写入养育属性失败：" + mbCEErr(e2) }; }
	}
	mbCEFertKidMark(id, "fert_child_skills", before, full, via, "eden.children." + id + ".training.skills");
	return { ok: true, message: "已写入养育属性 " + MB_CE_FERT_KID_SKILLS.map(function (k) { return k + "=" + full[k]; }).join(" / ") + "（" + via + "）" };
}
function mbCEFertKidSaveInnate(id, vals) {
	var child = mbCEFertKidAlive(id);
	var rec = mbCEFertRecord(String(id));
	if (!child || !rec) { return { ok: false, message: "这个孩子已不存在（模组侧已删除/移除），已刷新列表" }; }
	if (mbCEFertKidPhase(child) !== "born") { return { ok: false, message: "孩子还没出生，先天属性只在出生后可写" }; }
	var before = mbCEFertKidEnsureInnate(rec, child, id);
	var merged = mbCEFertKidMerge4(before, MB_CE_FERT_KID_INNATE, vals, true);
	if (!merged.ok) { return merged; }
	var full = /** @type {any} */ (merged.vals), res = null, via = "direct";
	var api = mbCEFertApi();
	if (api && typeof api.saveInnate === "function") {
		/* 只给四项先天；身份九项由模组用 patch[key] ?? before[key] 自动沿用，不会被打乱 */
		try { res = api.saveInnate(String(id), full); if (res && res.ok === true) { via = "EdenCheats.saveInnate"; } } catch (e) { res = null; }
	}
	if (!res || res.ok !== true) {
		try {
			if (!rec.innate || typeof rec.innate !== "object" || Array.isArray(rec.innate)) { rec.innate = {}; }
			Object.assign(rec.innate, full);
			/* 与模组 eden-cheats.js:178 同一判据：temperament<=50 为 quiet，否则 active；仅在该字段已存在时跟随 */
			if (rec.innate.personality !== undefined) { rec.innate.personality = full.temperament <= 50 ? "quiet" : "active"; }
		} catch (e2) { return { ok: false, message: "写入先天属性失败：" + mbCEErr(e2) }; }
	}
	mbCEFertKidMark(id, "fert_child_innate", before, full, via, "eden.children." + id + ".innate");
	return { ok: true, message: "已写入先天属性 " + MB_CE_FERT_KID_INNATE.map(function (k) { return k + "=" + full[k]; }).join(" / ") + "（" + via + "）" };
}
// v2.0.0.002 需求①③（续）：FertilityExpansion 孩子页 UI 层（由 04a-15 拆出，单文件 ≤400 行门禁）
// 构建按文件名升序拼接，两层同处一个作用域，可直接互调。
// 符号：mbCEFertKidCard（单孩子卡片）/ mbCEFertRenderChildren（整块孩子页）/ 尾部 IIFE 把本页挂到适配器面板最下面。
/* 单个孩子的卡片 */
function mbCEFertKidCard(info, refresh) {
	var box = el("div", "mce-grp");
	var head = el("div", "mce-row");
	var title = el("span", "mce-row-lbl", "孩子 #" + info.id + " " + info.name
		+ (info.gender === "f" ? "（女）" : info.gender === "m" ? "（男）" : ""));
	head.appendChild(title);
	box.appendChild(head);
	if (!info.alive || info.phase === "missing") {
		box.appendChild(el("div", "mce-err", "该孩子已不存在（模组侧已删除或已移除），列表已自动刷新；这里不再提供按钮，避免写入已删数据。"));
		return box;
	}
	var line = "地点：" + mbCEFertKidLocLabel(info.location)
		+ " · " + (info.lifeStageLabel || info.lifeStage || "阶段未知")
		+ " · " + mbCEFertKidAgeText(info)
		+ (info.species ? (" · " + info.species) : "")
		+ " · 养育状态：" + (MB_CE_FERT_KID_STATUS[info.status] || info.status || "未知")
		+ " · " + (info.settled ? ("未来已结算（" + (info.outcome || "?") + "）") : "未来未结算");
	box.appendChild(el("div", "mce-hint", line));
	/* 好感（爱意） */
	var affRow = el("div", "mce-row");
	affRow.appendChild(el("span", "mce-row-lbl", "好感/爱意（0–100）："));
	var affInp = el("input", "mce-inp");
	affInp.type = "text";
	affInp.value = (info.affection === null) ? "" : String(info.affection);
	affRow.appendChild(affInp);
	var affBtn = el("button", "mce-btn mce-gold", "写好感");
	affBtn.type = "button";
	affBtn.title = "写 V.eden.children." + info.id + ".affection（模组 eden-adult.js 用该值判定亲疏/汇款/亲密难度）";
	affBtn.addEventListener("click", function () {
		var res = mbCEFertKidSetAffection(info.id, String(affInp.value || "").trim());
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	affRow.appendChild(affBtn);
	var affHint = el("button", "mce-btn", "好感拉满");
	affHint.type = "button";
	affHint.addEventListener("click", function () {
		var res = mbCEFertKidSetAffection(info.id, 100);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	affRow.appendChild(affHint);
	box.appendChild(affRow);
	/* 养育四项（模组 EdenCheats.saveSkills：knowledge/fitness/social/awareness，0–100）。
	   模组要求四项齐全（缺项抛错），这里留空即沿用当前值，不会被清零。 */
	var skNow = (info.training && typeof info.training === "object") ? info.training : {};
	var SK_CN = { knowledge: "知识", fitness: "体能", social: "社交", awareness: "意识" };
	var skRow = el("div", "mce-row");
	skRow.appendChild(el("span", "mce-row-lbl", "养育四项："));
	var skInp = {};
	MB_CE_FERT_KID_SKILLS.forEach(function (k) {
		skRow.appendChild(el("span", "mce-row-lbl", SK_CN[k] + " "));
		var i2 = el("input", "mce-inp");
		i2.type = "text";
		i2.value = (skNow[k] === undefined || skNow[k] === null) ? "" : String(skNow[k]);
		i2.title = "V.eden.children." + info.id + ".training.skills." + k + "（0–100，留空=不改）";
		skRow.appendChild(i2);
		skInp[k] = i2;
	});
	var skBtn = el("button", "mce-btn mce-gold", "写养育");
	skBtn.type = "button";
	skBtn.title = "调 EdenCheats.saveSkills（四项必须齐全；留空的项沿用当前值）";
	skBtn.addEventListener("click", function () {
		var patch = {};
		MB_CE_FERT_KID_SKILLS.forEach(function (k) { patch[k] = String(skInp[k].value || "").trim(); });
		var res = mbCEFertKidSaveSkills(info.id, patch);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	skRow.appendChild(skBtn);
	box.appendChild(skRow);
	/* 先天四项（模组 EdenCheats.saveInnate：appearance/fitness/intelligence/temperament，0–100 整数） */
	var inNow = (info.innate && typeof info.innate === "object") ? info.innate : {};
	var IN_CN = { appearance: "外貌", fitness: "体质", intelligence: "智力", temperament: "性格" };
	var inRow = el("div", "mce-row");
	inRow.appendChild(el("span", "mce-row-lbl", "先天四项："));
	var inInp = {};
	MB_CE_FERT_KID_INNATE.forEach(function (k) {
		inRow.appendChild(el("span", "mce-row-lbl", IN_CN[k] + " "));
		var i3 = el("input", "mce-inp");
		i3.type = "text";
		i3.value = (inNow[k] === undefined || inNow[k] === null) ? "" : String(inNow[k]);
		i3.title = "V.eden.children." + info.id + ".innate." + k + "（0–100 整数，留空=不改）";
		inRow.appendChild(i3);
		inInp[k] = i3;
	});
	var inBtn = el("button", "mce-btn mce-gold", "写先天");
	inBtn.type = "button";
	inBtn.title = "调 EdenCheats.saveInnate（四项必须齐全且为整数；身份九项自动沿用现值）";
	inBtn.addEventListener("click", function () {
		var patch = {};
		MB_CE_FERT_KID_INNATE.forEach(function (k) { patch[k] = String(inInp[k].value || "").trim(); });
		var res = mbCEFertKidSaveInnate(info.id, patch);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	inRow.appendChild(inBtn);
	box.appendChild(inRow);
	/* 定向发送 / 随叫随到 */
	var locRow = el("div", "mce-row");
	locRow.appendChild(el("span", "mce-row-lbl", "定向发送："));
	var sel = el("select", "mce-inp");
	MB_CE_FERT_KID_LOCS.forEach(function (o) {
		var op = el("option", "", o.label);
		op.value = o.key;
		if (o.key === info.location) { op.selected = true; }
		sel.appendChild(op);
	});
	locRow.appendChild(sel);
	var locInp = el("input", "mce-inp");
	locInp.type = "text";
	locInp.placeholder = "自定义地点（留空=用左侧下拉）";
	locInp.title = "模组 location 是自由字符串；只对已出生/已产卵生效";
	locRow.appendChild(locInp);
	var sendBtn = el("button", "mce-btn mce-gold", "发送");
	sendBtn.type = "button";
	sendBtn.title = "写 EdenChildData.setLocation（只对已出生/蛋生效，等价 eden-adult.js 结算里的目的地写入）";
	sendBtn.addEventListener("click", function () {
		var custom = String(locInp.value || "").trim();
		var res = mbCEFertKidSetLocation(info.id, custom || sel.value);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	locRow.appendChild(sendBtn);
	var callBtn = el("button", "mce-btn", "随叫随到");
	callBtn.type = "button";
	callBtn.title = "把孩子的居所对齐到玩家当前位置（模组只认 eden_home/home，其余位置退回 eden_home 并提示）";
	callBtn.addEventListener("click", function () {
		var res = mbCEFertKidCallToMe(info.id);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	locRow.appendChild(callBtn);
	box.appendChild(locRow);
	/* 一键长大 / 成年结算 / 删除 */
	var actRow = el("div", "mce-row");
	var growBtn = el("button", "mce-btn mce-gold", "一键长大");
	growBtn.type = "button";
	growBtn.title = "forcedAdult=true + EdenAge.syncRecord（lifeStage 直接成年，不改未来结算状态）";
	growBtn.addEventListener("click", function () {
		var res = mbCEFertKidGrowUp(info.id, false);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	actRow.appendChild(growBtn);
	var settleBtn = el("button", "mce-btn", "立刻成年结算");
	settleBtn.type = "button";
	settleBtn.title = "调 EdenCheats.settleAdult：要求已成年 + 已出生 + 在 eden_home + 未结算";
	settleBtn.addEventListener("click", function () {
		var res = mbCEFertRun("fert_adult", info.id, null);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	actRow.appendChild(settleBtn);
	var delBtn = el("button", "mce-btn", "删除孩子（不可恢复）");
	delBtn.type = "button";
	delBtn.addEventListener("click", function () {
		if (typeof window === "undefined" || typeof window.confirm !== "function") { return; }
		if (!window.confirm("确认删除 #" + info.id + " " + info.name + "？该操作不可恢复（等价模组 removeChild）。")) { return; }
		var res = mbCEFertRun("fert_remove", info.id, null);
		setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
		refresh();
	});
	actRow.appendChild(delBtn);
	box.appendChild(actRow);
	return box;
}
/* 孩子页：适配器面板最下面的一块 */
function mbCEFertRenderChildren(container) {
	if (!container) { return; }
	var refresh = function () {
		try { if (typeof renderModCheatDetail === "function") { renderModCheatDetail("fertility-expansion"); } } catch (e) { /* 刷新失败不影响已写入 */ }
	};
	var pairs = mbCEFertKidPairs();
	var aliveCount = 0;
	container.appendChild(el("div", "mce-hint", "—— 孩子（FertilityExpansion）—— 板块内每个孩子独立调整；模组侧删掉孩子后这里会实时消失，按钮失效时会明确提示，不写已删数据。"));
	if (!pairs.length) {
		container.appendChild(el("div", "mce-hint", "当前没有任何孩子记录（V.childRecords / V.children 均为空）。孩子出生后会自动出现在这里。"));
		return;
	}
	var barRow = el("div", "mce-row");
	barRow.appendChild(el("span", "mce-row-lbl", "共 " + pairs.length + " 条记录："));
	var growAll = el("button", "mce-btn mce-gold", "全部一键长大");
	growAll.type = "button";
	growAll.addEventListener("click", function () {
		if (typeof window === "undefined" || typeof window.confirm !== "function") { return; }
		if (!window.confirm("把当前 " + pairs.length + " 条孩子记录全部一键长大？")) { return; }
		var okN = 0, failN = 0, skipN = 0;
		pairs.forEach(function (p) {
			var inf;
			try { inf = mbCEFertKidInfo(p[0]); } catch (e) { inf = null; }
			if (!inf || !inf.alive || inf.phase !== "born") { skipN++; return; }
			var r = mbCEFertKidGrowUp(p[0], true);
			if (r.ok) { okN++; } else { failN++; }
		});
		setStatus("批量一键长大：成功 " + okN + " 个，失败 " + failN + " 个"
			+ (skipN ? "，跳过 " + skipN + " 个（未出生/未孵化/已不存在）" : ""), failN ? "mce-err" : "mce-ok");
		refresh();
	});
	barRow.appendChild(growAll);
	var reloadBtn = el("button", "mce-btn", "重新检测");
	reloadBtn.type = "button";
	reloadBtn.title = "按 EdenChildData 重新枚举一次（模组侧删/加孩子后手动刷新）";
	reloadBtn.addEventListener("click", function () { refresh(); });
	barRow.appendChild(reloadBtn);
	container.appendChild(barRow);
	pairs.forEach(function (p) {
		var info;
		try { info = mbCEFertKidInfo(p[0]); } catch (e) { info = null; }
		if (!info) {
			container.appendChild(el("div", "mce-err", "孩子 #" + p[0] + " 读取失败（数据结构异常），已跳过。"));
			return;
		}
		if (info.alive) { aliveCount++; }
		container.appendChild(mbCEFertKidCard(info, refresh));
	});
	if (aliveCount !== pairs.length) {
		container.appendChild(el("div", "mce-hint", "（" + (pairs.length - aliveCount) + " 条记录已不在存活列表中，可能刚被模组侧删除；重新打开面板会彻底消失。）"));
	}
}
/* 在 04a-14 的 actionPanel 之后追加孩子页：适配器面板最下面就是孩子 */
(function () {
	try {
		var ad = (typeof CHEAT_ADAPTERS !== "undefined") ? CHEAT_ADAPTERS["fertility-expansion"] : null;
		if (!ad || !ad.entry) { return; }
		var base = ad.entry.actionPanel;
		if (typeof base !== "function") { return; }
		if (base.__mbCEHasKids) { return; }
		ad.entry.actionPanel = function (container) {
			base(container);
			mbCEFertRenderChildren(container);
		};
		ad.entry.actionPanel.__mbCEHasKids = true;
	} catch (e) { /* 适配器未注册时静默 */ }
})();
/* 职责：DoL 联机&地下城（Dolonline 5.27）适配器 —— **只做单机状态键**。
   用户口径（2026-11-08）：Dolonline 仅本地单机状态，不做联机交互（不碰 WebSocket / auth / 服务器共享血量）。

   源码实证（tools\_modcache\dolonline527\unpacked\，10 文件 / index.js 447,621 B）：
   - boot.json：nickName「DoLOnline」、version 5.27、scriptFileList ["index.js"]、dependenceInfo []、addonPlugin []
     → 零依赖、无补丁注入，CE 侧只需读写存档变量，不调模组函数。
   - index.js 用 WebSocket 定向消息（auth L96 / cp_accept L159），**不上传整档**；只有共享怪物血量以服务器为准
     → 单机状态全部落在本地 $ 变量，本地直写成立。
   - 入口解锁：index.js L4157 `if (v.mpDgUnlocked) return true`；L4161 `if ((Number(v.mpDgLv) || 1) > 1) return true`；
     L4170–4171 `dgUnlocked()` 成立时自动 `v.mpDgUnlocked = 1`。
   - 等级/经验条：index.js L4663–4669 —— 日常 `mpDLv` / `mpDExp` need=80+(lv-1)*40；地下城 `mpDgLv` / `mpDgExp` need=100+(lv-1)*50。
   - 法术解锁（dungeon.twee:84–88 与 index.js）：`mpDgLv` ≥3/≥5/≥7/≥9/≥12 分别解锁 火墙/冰锥/暗影箭/雷暴/陨石；
     每次 5 层 +1 `mpSkillPts`（index.js L1805–1806）。
   - 进本初始化（dungeon.twee:3–5、:884）：`dgFloor=1`、`dgHp=dolStaminaMax()`、`dgGold=0`、`dgMana=100`、`dgManaMax=100`；
     `mpCat` 顶部 `<<set $mpCat to ($mpCat or 0)>>` 兜底 → 直写前不必保证存在，但运行态键必须先有。
   - 宝箱（dungeon.twee:891–905）：`_tier = min(5, max(1, ceil(floor/4)))`，10% +1 档；`_reqs = [100,200,300,400,500]`；
     `skulduggery >= dgChestReq` 才能撬（+100 为无损判据 `_clean`，倍率 1.5）。
   - 灰（npc.twee）：`npcAff` 上限 15（`Math.min(15, ...)`）；`npcCh` 0→3；`npcQ` 0/1/2 剧情阶段；
     `mpEquip.*` 读取前一律 `<<if $mpEquip and $mpEquip.helmet>>` 存在性守卫 → 装备对象缺失时模组自己会跳过，CE 不代建。 */

	CHEAT_ADAPTERS["dolonline"] = {
		detect: function () {
			try {
				var v = getV();
				if (!hasV()) { return false; }
				/* mpCat / mpDgLv / mpSkillPts / mpDgUnlocked / dgFloor / npcAff 都是 Dolonline 独有键；
				   任一组出现即认定模组在场（未进过本的新档也可能只有 mpDgLv） */
				return (v.mpCat !== undefined || v.mpDgLv !== undefined || v.mpSkillPts !== undefined
					|| v.mpDgUnlocked !== undefined || v.dgFloor !== undefined
					|| v.npcAff !== undefined || v.npcCh !== undefined);
			} catch (e) { return false; }
		},
		entry: {
			modId: "dolonline",
			modName: "DoL 联机&地下城 v5.27（单机状态键）",
			tasks: [],
			stages: [
				{ key: "dl_unlocked", name: "地下城 · 入口解锁", varPath: "mpDgUnlocked",
				  levels: [0, 1], labels: ["未解锁", "已解锁"],
				  note: "模组判据 index.js:4157 `if (v.mpDgUnlocked) return true`；L4170–4171 在 dgUnlocked() 成立时自动置 1（等级 >1 也会解锁）" },
				{ key: "dl_class", name: "地下城 · 职业", varPath: "mpClass",
				  levels: ["", "warrior", "mage", "ranger", "priest"],
				  labels: ["未选", "剑士", "法师", "游侠", "祭司"],
				  note: "职业专属技能在 dungeon.twee:90–93 判定；空串 = 未选职业" }
			],
			abilities: [],
			scenes: [],
			values: [
				{ key: "dl_dglv", name: "地下城等级 mpDgLv", varPath: "mpDgLv", type: "number", min: 1, max: 99,
				  note: "≥3/5/7/9/12 解锁 火墙/冰锥/暗影箭/雷暴/陨石；升级阈值 need=100+(lv-1)*50（index.js:4669）" },
				{ key: "dl_dgexp", name: "地下城经验 mpDgExp", varPath: "mpDgExp", type: "number", min: 0, max: 999999,
				  note: "写 need-1（=100+(lv-1)*50-1）再打一只怪即可自然升级" },
				{ key: "dl_dailylv", name: "日常挑战等级 mpDLv", varPath: "mpDLv", type: "number", min: 1, max: 99,
				  note: "升级阈值 need=80+(lv-1)*40（index.js:4664）" },
				{ key: "dl_dailyexp", name: "日常经验 mpDExp", varPath: "mpDExp", type: "number", min: 0, max: 999999,
				  note: "注意键名是 mpDExp（不是 mpDgExp），index.js:4436/4663 实证" },
				{ key: "dl_skillpts", name: "技能点 mpSkillPts", varPath: "mpSkillPts", type: "number", min: 0, max: 999,
				  note: "每下 5 层 +1（index.js:1805–1806）" },
				{ key: "dl_mpcat", name: "猫猫币 mpCat", varPath: "mpCat", type: "number", min: 0, max: 999999,
				  note: "地下城专属货币：30 换满体力 / 25 换满法力 / 120 掉道具 / 150 特殊（dungeon.twee:299–323）" },
				{ key: "dl_agi", name: "敏捷加成 mpDgAgi", varPath: "mpDgAgi", type: "number", min: 0, max: 999,
				  note: "命中/闪避公式 `3 + floor(min(100,physique)/15) + Number($mpDgAgi)`（dungeon.twee:65/213）" },
				{ key: "dl_floor", name: "当前层 dgFloor", varPath: "dgFloor", type: "number", min: 1, max: 30,
				  note: "层数门控 index.js:4091/4128/4159；开箱档位按 ceil(floor/4) 推导（dungeon.twee:891）" },
				{ key: "dl_hp", name: "地下城体力 dgHp", varPath: "dgHp", type: "number", min: 0, max: 99999,
				  note: "进本初始化 = dolStaminaMax()；写超上限即无敌（模组只做 <=0 判死）" },
				{ key: "dl_mana", name: "法力 dgMana", varPath: "dgMana", type: "number", min: 0, max: 99999,
				  note: "进本 100；低于技能消耗则无法施法" },
				{ key: "dl_manamax", name: "法力上限 dgManaMax", varPath: "dgManaMax", type: "number", min: 1, max: 99999,
				  note: "进本 100；`$mpCat gte 25` 时置回该值（dungeon.twee:307）" },
				{ key: "dl_gold", name: "地下城金币 dgGold", varPath: "dgGold", type: "number", min: 0, max: 999999,
				  note: "只是本局显示用的战利品计数；真实加钱走 $money（dungeon.twee:342 起）" },
				{ key: "dl_kills", name: "本局击杀 dgKills", varPath: "dgKills", type: "number", min: 0, max: 99999,
				  note: "灰的委托进度按 `dgKills - npcQStart >= 3` 判定（npc.twee:23/25）" },
				{ key: "dl_chestreq", name: "宝箱诡术门槛 dgChestReq", varPath: "dgChestReq", type: "number", min: 0, max: 500,
				  note: "原值 ∈ {100,200,300,400,500}；写 0 = 任何诡术都能撬（`skulduggery >= dgChestReq`，+100 判定无损）" },
				{ key: "dl_chesttier", name: "宝箱档位 dgChestTier", varPath: "dgChestTier", type: "number", min: 1, max: 5,
				  note: "1–5 档；原版由 min(5,max(1,ceil(floor/4))) 推导，10% 概率 +1（dungeon.twee:891–905）" },
				{ key: "dl_npcaff", name: "灰 · 好感 npcAff", varPath: "npcAff", type: "number", min: 0, max: 15,
				  note: "上限 15（模组处处 Math.min(15, ...)）；影响 npc.twee 剧情分支" },
				{ key: "dl_npcch", name: "灰 · 章节 npcCh", varPath: "npcCh", type: "number", min: 0, max: 3,
				  note: "npc.twee:225 置 2 / :242 置 3 —— 直写会跳过对应的剧情场景，仅在重复剧情时使用" }
			],
			actions: [
				{
					key: "dl_init_run",
					name: "初始化地下城运行态键",
					note: "未进过地下城时 dgFloor/dgHp/dgMana 等键还不存在，数值栏会拒绝写入。本动作按 dungeon.twee:3–5 的原版初值补齐（已有的不覆盖），并补 mpSkill 空对象。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						var added = 0;
						if (v.dgFloor === undefined) { v.dgFloor = 1; added++; }
						if (v.dgHp === undefined) {
							var hp = 100;
							try { if (typeof window !== "undefined" && typeof window.dolStaminaMax === "function") { hp = Number(window.dolStaminaMax()) || 100; } } catch (eHp) {}
							v.dgHp = hp; added++;
						}
						if (v.dgGold === undefined) { v.dgGold = 0; added++; }
						if (v.dgMana === undefined) { v.dgMana = 100; added++; }
						if (v.dgManaMax === undefined) { v.dgManaMax = 100; added++; }
						if (v.dgKills === undefined) { v.dgKills = 0; added++; }
						if (!v.mpSkill || typeof v.mpSkill !== "object") { v.mpSkill = {}; added++; }
						if (v.mpCat === undefined) { v.mpCat = 0; added++; }
						return {
							ok: true,
							message: added
								? "已补齐 " + added + " 个运行态键，已有值未覆盖（明细见下方数值栏）"
								: "运行态键已齐全，未做改动"
						};
					}
				},
				{
					key: "dl_all_spells",
					name: "解锁全部法术（含职业技能）",
					note: "mpSkill 9 键置 1：通用 fireWall/iceSpike/shadowBolt/thunderStorm/meteor + 职业 uDesp/uBurst/uChain/uBlood（dungeon.twee:84–97）。原版本靠 mpDgLv 3/5/7/9/12 逐档解锁，本动作直接写入等价。",
					run: function () {
						var v = getV();
						if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
						if (!v.mpSkill || typeof v.mpSkill !== "object") { v.mpSkill = {}; }
						var keys = ["fireWall", "iceSpike", "shadowBolt", "thunderStorm", "meteor", "uDesp", "uBurst", "uChain", "uBlood"];
						var n = 0;
						keys.forEach(function (k) { if (v.mpSkill[k] !== 1) { v.mpSkill[k] = 1; n++; } });
						return { ok: true, message: n ? "已解锁 " + n + " 个法术（其余此前已解锁）" : "全部法术此前已解锁" };
					}
				}
			]
		}
	};
/* 职责：作弊写入执行器 —— 原版根拦截、适配器路径解析、按类型写入与回退（applyCheatSync） */

	function cheatIsVanillaRoot(root) {
		var i;
		for (i = 0; i < CHEAT_VANILLA_ROOTS.length; i++) {
			if (CHEAT_VANILLA_ROOTS[i] === root) { return true; }
		}
		return false;
	}
	/* v1.9.11 未定版：适配器声明路径豁免——第三方模组会借用原版变量宿主存自己的键
	   （实证：Dol-Optimization 源码 `<<set $daily.conveniencestoregoods to {}>>` 把便利店库存写进原版 $daily，
	   opt1121/Source/twee/game.twee:321），凡在已注册适配器 stages/abilities/values 声明中的 varPath
	   一律放行（声明经对照源码核对），未声明的原版根仍按黑名单拒绝（玩家自己面板等通道不受影响）。 */
	var mbCEAdapterPaths = null;
	function mbCEBuildAdapterPaths() {
		var out = {}, mid, e, sec, arr, i, it;
		try {
			for (mid in CHEAT_ADAPTERS) {
				if (!Object.prototype.hasOwnProperty.call(CHEAT_ADAPTERS, mid)) { continue; }
				e = CHEAT_ADAPTERS[mid] && CHEAT_ADAPTERS[mid].entry;
				if (!e) { continue; }
				for (sec = 0; sec < 3; sec++) {
					arr = sec === 0 ? e.stages : (sec === 1 ? e.abilities : e.values);
					if (!Array.isArray(arr)) { continue; }
					for (i = 0; i < arr.length; i++) {
						it = arr[i];
						if (it && typeof it.varPath === "string" && it.varPath) { out[it.varPath] = true; }
					}
				}
			}
		} catch (e2) { /* 豁免集合构建失败 → 保守全部拒绝 */ }
		return out;
	}
	function mbCEIsDeclaredAdapterPath(path) {
		if (!mbCEAdapterPaths) { mbCEAdapterPaths = mbCEBuildAdapterPaths(); }
		return !!(path && mbCEAdapterPaths[path]);
	}
	/* varPath 解析：父级对象链必须存在（禁止写入 undefined 对象）；叶子允许缺失（正常初始化）。 */
	/** @returns {{ok: false, reason: string, root?: string, path?: string} | {ok: true, parent: any, leaf: string, exists: boolean}} */
	function cheatResolvePath(path) {
		var V = getV();
		if (!V) { return { ok: false, reason: "存档变量不可用" }; }
		var parts = String(path || "").split(".");
		if (!parts.length || !parts[0]) { return { ok: false, reason: "空路径" }; }
		if (cheatIsVanillaRoot(parts[0]) && !mbCEIsDeclaredAdapterPath(path)) { return { ok: false, reason: "vanilla", root: parts[0] }; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") {
				return { ok: false, reason: "parent", path: parts.slice(0, i + 1).join(".") };
			}
			cur = cur[parts[i]];
		}
		return { ok: true, parent: cur, leaf: parts[parts.length - 1], exists: cur[parts[parts.length - 1]] !== undefined };
	}
	/* 联动写入（v1.9.6 扩展）：条目可声明 sync 字段，主键写入成功后按序执行联动，
	   保持模组状态机一致（如写 dress.active 时同步清 proposal / 升 highest / 清试行期）。
	   联动键不留痕（属主写入的伴随修正）；联动失败不影响主写入结果。
	   v1.9.10 自查扩展：s.ifMissing = true 时仅在目标键不存在（undefined）才写入，
	   防覆盖玩家已有数据（如 Cattery 养猫联动补 catArr，已有猫不重置）。 */
	function applyCheatSync(V, syncData, newVal) {
		try {
			if (!syncData || typeof syncData !== "object") { return; }
			if (Array.isArray(syncData.clear)) {
				syncData.clear.forEach(function (p) {
					var r = cheatResolvePath(p);
					if (r.ok) { r.parent[r.leaf] = null; }
				});
			}
			if (Array.isArray(syncData.set)) {
				syncData.set.forEach(function (s) {
					var r = cheatResolvePath(s.path);
					/* v1.9.9 sync.set 条件扩展：s.if = { min / max } 按「主写入后的新值」判定，
					   不满足则跳过该联动（如写 shrine.stage=0 重置时不补 feeds/init）。无 if 字段=无条件，兼容旧声明。
					   v1.9.10：s.ifMissing 时目标已存在（r.exists）则跳过，防覆盖玩家数据。 */
					if (r.ok && !(s.ifMissing && r.exists) && (!s.if || ((typeof s.if.min !== "number" || newVal >= s.if.min) && (typeof s.if.max !== "number" || newVal <= s.if.max)))) {
						r.parent[r.leaf] = typeof s.value === "function" ? s.value(V) : s.value;
					}
				});
			}
			if (syncData.copyMax && syncData.copyMax.path && Array.isArray(syncData.copyMax.order)) {
				var tr = cheatResolvePath(syncData.copyMax.path);
				if (tr.ok) {
					var oi = syncData.copyMax.order.indexOf(newVal);
					if (oi >= 0) {
						var ci = syncData.copyMax.order.indexOf(tr.parent[tr.leaf]);
						tr.parent[tr.leaf] = syncData.copyMax.order[Math.max(ci, oi)];
					}
				}
			}
		} catch (e) { /* 联动失败不影响主写入 */ }
	}
	/* 通用写入执行器（幂等防崩）：类型校验 + 保留下限 + 留痕（保留首次 before，回退可还原）。
	   v1.9.10 用户需求：数值上限不钳制——声明 max 仅作 UI 参考范围提示，写入原样落档
	   （模组自身 clamp 由其源码负责；CE 不做面板上限拦截）。下限仍钳 0 防负值破坏。 */
	function cheatWriteValue(modId, itemKey, op, path, raw, type, min, max, syncData) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			var r = cheatResolvePath(path);
			if (r.ok !== true) {
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
				/* v1.8.12 相对值：raw 为字符串且以 + / - 开头 → 按「当前值 + delta」计算（v1.9.10 起上限不钳制、下限 0） */
				var relDelta = null;
				if (typeof raw === "string") {
					var relM = /^([+\-])\s*([\d.]+)$/.exec(raw.trim());
					if (relM) { relDelta = (relM[1] === "+" ? 1 : -1) * Number(relM[2]); }
				}
				var curNum = Number(r.parent[r.leaf]);
				var baseNum = Number.isFinite(curNum) ? curNum : 0;
				val = relDelta !== null ? baseNum + relDelta : (typeof val === "number" ? val : Number(val));
				if (!isFinite(val)) { return { ok: false, message: "数值无效（需为数字，支持 +N / -N 相对调整）" }; }
				if (typeof min === "number" && val < min) { val = min; }
				/* v1.9.10：上限不再钳制（声明 max 仅参考）；写低值不受影响 */
			} else if (type === "boolean") {
				val = (val === true || val === 1 || val === "1" || val === "true" || val === "on");
			} else {
				val = String(val);
			}
			var before = r.parent[r.leaf];
			var prev = V.mbCE_wrote && V.mbCE_wrote["cheat:" + modId + ":" + itemKey];
			/* 留痕语义与地点通道一致：before 始终保留「首次面板写入前」状态（含 undefined=原本无字段），
			   用 in 判断避免二次写入把 before 覆盖成当前值、回退丢失删除语义 */
			if (prev && "before" in prev) { before = prev.before; }
			/* v2.0.3 P4-2：写入前 diff 预览（默认关闭；开启时本函数不落档，改由确认条重放） */
			var curNow = r.parent[r.leaf];
			if (typeof mbCEPreviewGate === "function" && mbCEPreviewGate(path, curNow, val, function () {
				return cheatWriteValue(modId, itemKey, op, path, raw, type, min, max, syncData);
			})) {
				return { ok: false, pending: true, message: "待确认写入：" + path + "（" + mbCEPreviewFmt(curNow) + " → " + mbCEPreviewFmt(val) + "）" };
			}
			r.parent[r.leaf] = val;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:" + modId + ":" + itemKey] = { type: "cheat", modId: modId, op: op, path: path, before: before, after: val, t: Date.now() };
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
			applyCheatSync(V, syncData, val); /* 联动修正（主写入成功后） */
			return { ok: true, message: "已写入 " + path + " = " + JSON.stringify(val), before: before, after: val };
		} catch (e) {
			return { ok: false, message: "操作异常：" + mbCEErr(e) };
		}
	}
	/* 列表型写入（v1.4.0 扩展）：varPath 指向字符串数组，on=true 追加 / on=false 移除；
	   留痕 before/after 为数组快照（before 保留首次面板写入前状态）。 */
	function cheatWriteListValue(modId, itemKey, op, path, value, on, replay) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			var r = cheatResolvePath(path);
			if (r.ok !== true) {
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
			/* v2.0.7 D1：列表写入（05a-modcheat-rows.js:75 的勾选项）原先完全绕过 diff 预览——现在同走门控 */
			if (!replay && typeof mbCEPreviewGate === "function" &&
				mbCEPreviewGate(path, Array.isArray(cur) ? cur.slice() : "（无此字段）", arr,
					function () { return cheatWriteListValue(modId, itemKey, op, path, value, on, true); })) {
				return { ok: false, pending: true, message: "待确认写入：" + path };
			}
			var prev = V.mbCE_wrote && V.mbCE_wrote["cheat:" + modId + ":" + itemKey];
			if (prev && "before" in prev) { before = prev.before; }
			r.parent[r.leaf] = arr;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["cheat:" + modId + ":" + itemKey] = { type: "cheat", modId: modId, op: op, path: path, before: before, after: arr.slice(), t: Date.now() };
			mbCEWroteTrim(V); /* 九巡：留痕有界化 */
			return { ok: true, message: "已更新 " + path + (on ? " ＋ " : " － ") + value, after: arr.slice() };
		} catch (e) {
			return { ok: false, message: "操作异常：" + mbCEErr(e) };
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
			if (r.ok !== true) { return { ok: false, message: "目标变量结构已变化，拒绝回退（" + rec.path + "）" }; }
			if (rec.before === undefined) {
				try { delete r.parent[r.leaf]; } catch (e) { r.parent[r.leaf] = undefined; }
			} else {
				r.parent[r.leaf] = rec.before;
			}
			try { delete V.mbCE_wrote[key]; } catch (e) { V.mbCE_wrote[key] = undefined; }
			return { ok: true, message: "已回退（还原为面板写入前状态）" };
		} catch (e) {
			return { ok: false, message: "回退异常：" + mbCEErr(e) };
		}
	}
/* 职责：写入工具 —— 模组对象归一化（normalizeCheatMod）与适配器声明审计（auditAdapters） */
	function normalizeCheatMod(m) {
		return {
			modId: m.modId, modName: m.modName, declared: true,
			tasks: Array.isArray(m.tasks) ? m.tasks : [],
			stages: Array.isArray(m.stages) ? m.stages : [],
			abilities: Array.isArray(m.abilities) ? m.abilities : [],
			scenes: Array.isArray(m.scenes) ? m.scenes : [],
			values: Array.isArray(m.values) ? m.values : [],
			/* v2.0.0.002：命令式动作（适配器自己声明的"一键"按钮）。actionPanel 可整体接管渲染，
			   用于复刻模组自带作弊面板（如 FertilityExpansion 的 window.EdenCheats）。 */
			actions: Array.isArray(m.actions) ? m.actions : [],
			actionPanel: (typeof m.actionPanel === "function") ? m.actionPanel : null
		};
	}

	/* v1.8.12 功能12：适配器工作流工具——运行时一致性审计（开发新适配器后自查：
	   注册键与 entry.modId 一致、分类项 key/name/varPath 完整、探测函数存在、无空适配器）。
	   返回 { total, healthy, warnings[], errors[] }；healthy>0 时可用面板正常渲染全部适配器。 */
	function auditAdapters() {
		/** @type {{total: number, healthy: number, warnings: string[], errors: string[]}} */
		var out = { total: 0, healthy: 0, warnings: [], errors: [] };
		try {
			Object.keys(CHEAT_ADAPTERS).forEach(function (id) {
				var a = CHEAT_ADAPTERS[id];
				out.total++;
				var entry = (a && a.entry) ? a.entry : {};
				var name = entry.modName || id;
				var cats = ["tasks", "stages", "abilities", "scenes", "values"];
				var itemCount = 0;
				cats.forEach(function (c) {
					if (Array.isArray(entry[c])) { itemCount += entry[c].length; }
				});
				var errs = [];
				if (!entry.modId) { errs.push("entry 缺 modId"); }
				else if (entry.modId !== id) { errs.push("entry.modId（" + entry.modId + "）与注册键不一致"); }
				if (!itemCount) { out.warnings.push(id + "（" + name + "）：没有任何能力/阶段/数值项（空适配器）"); }
				/* 分类字段要求：varPath 类（tasks/stages/abilities/values）必须 varPath；
				   scenes 类（场景直达）用 skipVar/completeVar/progressVar，无 varPath */
				cats.forEach(function (c) {
					(Array.isArray(entry[c]) ? entry[c] : []).forEach(function (it, idx) {
						if (!it || typeof it !== "object") { errs.push(c + "[" + idx + "] 非对象项"); return; }
						if (!it.key) { errs.push(c + "[" + idx + "] 缺 key"); }
						if (!it.name) { errs.push(c + "[" + idx + "] 缺 name"); }
						if (c === "scenes") {
							if (it.skipVar === undefined && it.completeVar === undefined && it.progressVar === undefined) {
								errs.push(c + "[" + idx + "] 缺 skipVar/completeVar/progressVar（场景直达键）");
							}
						} else if (it.varPath === undefined) {
							errs.push(c + "[" + idx + "] 缺 varPath");
						}
					});
				});
				if (typeof a.detect !== "function") { out.warnings.push(id + "：缺 detect 探测函数（列表永不命中）"); }
				if (errs.length) { out.errors.push(id + "（" + name + "）：" + errs.slice(0, 6).join("；") + (errs.length > 6 ? " 等" + errs.length + " 项" : "")); return; }
				out.healthy++;
			});
		} catch (e) { out.errors.push("审计异常：" + mbCEErr(e)); }
		return out;
	}
	/* v1.9.4 问题2 根治：Mod 子页超长组时间分片构建（模块级状态，跨 renderModCheatDetail 渲染存活）。
	   背景：DoL-Game-UI 每帧 rAF 全量样式扫描抢主线程，Mod 子页"全部展开"一次性建数百行 =
	   单帧长任务 → 移动 WebView 滚动丢帧 / 长任务 ANR 闪退（用户实测）。
	   方案：pending > MOD_ROW_BATCH_LIMIT 时改为分帧构建（首帧同步建 MOD_ROW_BATCH 行，剩余入队
	   逐帧 setTimeout 排空），把长任务摊平，不砍任何作弊项；测试环境设
	   window.__mbCE_forceSyncRows=true 强制同步（smoke 同步断言）。 */
	var modRowBatchTimer = null;
	var modRowQueue = []; /* 分片任务：{ body, fns, i, failed } */
	var MOD_ROW_BATCH = 40;
	var MOD_ROW_BATCH_LIMIT = 60;
	function mbCEForceSyncRows() {
		try { return typeof window !== "undefined" && window && window.__mbCE_forceSyncRows === true; } catch (e) { return false; }
	}
	function appendRowNodes(body, n) {
		if (!n) { return; }
		if (n.length) { for (var i2 = 0; i2 < n.length; i2++) { body.appendChild(n[i2]); } }
		else { body.appendChild(n); }
	}
	/* 分片排空：每帧最多建 BATCH 行，直到队列清空（长任务摊平；3 个 guard 防本帧过度） */
	function modRowStep() {
		var guard = 0;
		while (modRowQueue.length && guard < 3) {
			var t = modRowQueue[0];
			var built = 0;
			while (t.i < t.fns.length && built < MOD_ROW_BATCH) {
				try { appendRowNodes(t.body, t.fns[t.i]()); } catch (e) { t.failed++; }
				t.i++; built++;
			}
			if (t.i >= t.fns.length) {
				if (t.failed) { t.body.appendChild(el("div", "mce-hint", "有 " + t.failed + " 行加载失败（适配器数据异常），已跳过。")); }
				modRowQueue.shift();
			}
			guard++;
		}
		if (modRowQueue.length) { modRowBatchTimer = setTimeout(modRowStep, 0); }
		else { modRowBatchTimer = null; }
	}
	/* 动态发现：注册制 + 内置适配器（探测命中即合并）+ 被动识别占位；每次调用重扫。 */
	function toggleCheatAbility(modId, key, enabled) {
		var m = findCheatMod(modId), a = m && findCheatItem(m.abilities, key);
		if (!a) { return { ok: false, message: "能力不存在或该模组未注册" }; }
		if (!a.varPath) { return { ok: false, message: "「" + a.name + "」未声明能力变量（varPath），无法切换" }; }
		/* v1.9.11 未定版：numeric 能力（模组 is 1 / gte 1 严格比较禁 boolean）——勾选写 1、取消写 0，
		   布尔能力保持原语义；min/max 按声明钳制（缺省 0/1） */
		var abilityVal = a.numeric ? (enabled ? 1 : 0) : !!enabled;
		var abilityType = a.numeric ? "number" : "boolean";
		var abilityMin = a.numeric ? (typeof a.min === "number" ? a.min : 0) : undefined;
		var abilityMax = a.numeric ? (typeof a.max === "number" ? a.max : 1) : undefined;
		return cheatWriteValue(modId, "ability_set:" + key, "ability_set", a.varPath, abilityVal, abilityType, abilityMin, abilityMax, a.sync);
	}
	function cheatSceneAction(modId, key, op) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.scenes, key);
		if (!s) { return { ok: false, message: "剧情不存在或该模组未注册" }; }
		if (op === "scene_skip") {
			if (!s.skipVar) { return { ok: false, message: "「" + s.name + "」未声明跳过标记变量（skipVar）" }; }
			return cheatWriteValue(modId, "scene_skip:" + key, "scene_skip", s.skipVar, true, "boolean");
		}
		if (op === "scene_force") {
			if (!s.completeVar) { return { ok: false, message: "「" + s.name + "」未声明完成标记变量（completeVar）" }; }
			return cheatWriteValue(modId, "scene_force:" + key, "scene_force", s.completeVar, true, "boolean");
		}
		if (op === "scene_reset") {
			if (!s.progressVar) { return { ok: false, message: "「" + s.name + "」未声明进度变量（progressVar），无法重置" }; }
			var rv = (typeof s.resetValue === "number") ? s.resetValue : 0;
			return cheatWriteValue(modId, "scene_reset:" + key, "scene_reset", s.progressVar, rv, "number");
		}
		return { ok: false, message: "未知剧情操作" };
	}
	function applyCheatModValue(modId, key, raw) {
		var m = findCheatMod(modId), it = m && findCheatItem(m.values, key);
		if (!it) { return { ok: false, message: "数值项不存在或该模组未注册" }; }
		if (!it.varPath) { return { ok: false, message: "「" + it.name + "」未声明变量（varPath）" }; }
		if (it.type === "list") {
			var v = raw && typeof raw === "object" ? raw : { value: String(raw), on: true };
			return cheatWriteListValue(modId, "value_set:" + key + ":" + v.value, "value_set", it.varPath, v.value, !!v.on);
		}
		/* v2.0.4 治理：string 型也曾被 fallback 成 number 通道（Number("abc")=NaN → 静默拒绝写），
		   现按声明类型分流；当前声明无 string 项，此分支由声明矩阵的假适配器负控覆盖 */
		var wt = it.type === "boolean" ? "boolean" : (it.type === "string" ? "string" : "number");
		return cheatWriteValue(modId, "value_set:" + key, "value_set", it.varPath, raw, wt, it.min, it.max, it.sync);
	}
	function cheatReadSafe(modId, path) {
		try {
			var r = cheatResolvePath(path);
			return r.ok ? r.parent[r.leaf] : undefined;
		} catch (e) { return undefined; }
	}
	/* ---- 渲染：主容器页（模组列表，本身不展示修改控件） ---- */
	function renderModCheats() {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		pane.textContent = "";
		pane.appendChild(el("div", "mce-hint", "本页面用于操控其他第三方模组新增的拓展内容，不修改游戏原版数据。下方为已识别到支持作弊控制的模组，点击模组名称进入对应控制子页面。"));
		/* v1.7.0：玩家自己编辑入口（玩家所有属性 + 模组加入属性，全量，数值与阶段可改） */
		var pcard = el("div", "mce-card mce-sel");
		var ptop = el("div", "mce-card-top");
		ptop.appendChild(el("span", "mce-card-name", "▶ 玩家自己 · 属性与特质"));
		ptop.appendChild(el("span", "mce-badge mce-on", "面板数值/特质可改"));
		pcard.appendChild(ptop);
		pcard.appendChild(el("div", "mce-hint", "游戏属性面板数值快捷编辑 + 全部特质管理（含其他模组注入的特质，自动发现；获取时条件不满足自动改为满足）。"));
		pcard.addEventListener("click", function () { renderPlayerEdit(); });
		pane.appendChild(pcard);
		var mods = getCheatMods();
		if (!mods.length) {
			pane.appendChild(el("div", "mce-err", "⚠ 暂未识别到可控制的第三方模组拓展内容，请加载对应模组后重试。"));
			return;
		}
		var list = el("div", "mce-cards");
		mods.forEach(function (m) {
			var row = el("div", "mce-card" + (m.modId === curCheatModId ? " mce-sel" : ""));
			var top = el("div", "mce-card-top");
			top.appendChild(el("span", "mce-card-name", "▶ " + m.modName));
			top.appendChild(el("span", "mce-badge " + (m.declared ? "mce-on" : "mce-off"), m.declared ? "可操控" : "未声明"));
			row.appendChild(top);
			if (!m.declared) {
				row.appendChild(el("div", "mce-hint", "该模组未按注册协议声明可操控项，仅识别展示（不提供操控）。"));
			} else {
				row.addEventListener("click", (function (mod) {
					return function () { curCheatModId = mod.modId; renderModCheatDetail(mod.modId); };
				})(m));
			}
			list.appendChild(row);
		});
		pane.appendChild(list);
	}
	/* ---- 渲染：模组子页面（四分组通用控件，严格隔离：只渲染归属模组的项） ---- */
	/* v1.9.1（DoL-Game-UI 冲突排查）：子页四分组默认收起 + 懒渲染——
	   用户实测「滑动卡住截断 / 展开过多卡住闪退」，根因链：子页一次全量建数百行
	   （枯木逢春 9 阶段+18 能力+3 场景+28 数值）+ DoL-Game-UI 每帧 rAF 全量扫描抢占主线程 →
	   移动 WebView 滚动丢帧 / 长任务 ANR。
	   改为：组头常驻、组体默认收起（data-collapsed=1）、行闭包进 pending 点击展开才建
	   （学 06-traits 九巡懒渲染模式）；展开状态经 mbCEUiCollapsed 持久化
	   （key "mods:<modId>:<组名>"），重建后按持久化恢复。 */
	/* v1.9.13 模组数值搜索态：按名称/键名/写入路径过滤「4. 自定义数值修改」组；
	   输入防抖 250ms 重建子页（mceSchedule 桶 "search"），返回模组列表时清空 */
	var modValueFilter = "";
	/* v1.9.13 搜索态设置（外部/测试通道；UI 输入框直接改闭包变量） */
	function setModValueFilter(v) { modValueFilter = String(v == null ? "" : v); }
	function renderModCheatDetail(modId) {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		/** @type {any} 适配器 entry 形态有两类（含 actionPanel 与不含），统一按 any 访问可选字段 */
		var m = findCheatMod(modId);
		var st = pane.scrollTop; /* 五巡：重建后保持滚动位置（翻到长列表底部操作不再跳回顶部） */
		/* v1.9.5-自检：重建时清残留分片任务——切 tab/重进子页后旧渲染的分片不再往已脱离 DOM 的 body 补行（省帧），
		   新渲染的 pending 行由全新任务构建，与旧队列无关 */
		if (modRowBatchTimer) { clearTimeout(modRowBatchTimer); modRowBatchTimer = null; }
		modRowQueue.length = 0;
		pane.textContent = "";
		if (!m) {
			pane.appendChild(el("div", "mce-err", "模组未识别（可能已卸载），请返回列表。"));
			return;
		}
		var back = el("button", "", "← 返回模组列表");
		back.type = "button";
		back.addEventListener("click", function () { curCheatModId = ""; modValueFilter = ""; renderModCheats(); });
		pane.appendChild(back);
		pane.appendChild(el("div", "mce-hint", "【" + m.modName + "】作弊控制"));
		pane.appendChild(el("div", "mce-hint", "所有操作仅作用于 " + m.modName + " 的新增内容，不会改动游戏本体与其他模组数据。"));
		/* 折叠工具行：全部展开 / 全部收起（懒渲染下组体行按需补建） */
		var toolRow = el("div", "mce-row");
		toolRow.appendChild(el("span", "mce-row-lbl", "折叠工具："));
		var bAllOpen = el("button", "", "全部展开"); bAllOpen.type = "button";
		bAllOpen.setAttribute("data-mce-tool", "mods-open");
		bAllOpen.addEventListener("click", function () {
			Object.keys(groups).forEach(function (k) {
				var g = groups[k];
				g.body.setAttribute("data-collapsed", "0");
				g.head.textContent = g.head.textContent.replace(/^▸\s*/, "▾ ");
				buildModGrpRows(g);
				mbCEUiCollapsed("mods:" + modId + ":" + k, true);
			});
		});
		var bAllClose = el("button", "", "全部收起"); bAllClose.type = "button";
		bAllClose.setAttribute("data-mce-tool", "mods-close");
		bAllClose.addEventListener("click", function () {
			Object.keys(groups).forEach(function (k) {
				var g = groups[k];
				g.body.setAttribute("data-collapsed", "1");
				g.head.textContent = g.head.textContent.replace(/^▾\s*/, "▸ ");
				mbCEUiCollapsed("mods:" + modId + ":" + k, false);
			});
		});
		toolRow.appendChild(bAllOpen); toolRow.appendChild(bAllClose);
		pane.appendChild(toolRow);
		/* v1.9.13 数值搜索框：仅该模组声明了数值项时显示；输入防抖重建（数值组过滤见 renderCheatValues） */
		if (m.values.length) {
			var fRow = el("div", "mce-row");
			fRow.appendChild(el("span", "mce-row-lbl", "数值搜索："));
			var fInp = el("input", "mce-search-inp");
			fInp.type = "text";
			fInp.value = modValueFilter;
			fInp.placeholder = "按名称 / 键名 / 写入路径过滤自定义数值";
			fInp.addEventListener("input", function () {
				modValueFilter = fInp.value.replace(/^\s+|\s+$/g, "");
				mceSchedule(function () { renderModCheatDetail(modId); }, 250, "search");
			});
			var fClear = el("button", "", "清除"); fClear.type = "button";
			fClear.addEventListener("click", function () {
				modValueFilter = "";
				renderModCheatDetail(modId);
			});
			fRow.appendChild(fInp); fRow.appendChild(fClear);
			pane.appendChild(fRow);
		}
		/* 分组容器：gkey -> { head, body, count, pending }（渲染过程局部缓存） */
		var groups = {};
		function grpFor(gkey, title) {
			if (groups[gkey]) { return groups[gkey]; }
			var grp = el("div", "mce-grp");
			grp.setAttribute("data-gkey", gkey);
			var restoreOpen = mbCEUiState.collapsed["mods:" + modId + ":" + gkey] === 0;
			var head = el("div", "mce-grp-t mce-collapse-head", (restoreOpen ? "▾ " : "▸ ") + title);
			head.setAttribute("data-mce-head", gkey);
			var body = el("div", "mce-grp-body");
			body.setAttribute("data-collapsed", restoreOpen ? "0" : "1");
			/* 分组对象先建（闭包引用 g 而非 DOM 节点 grp：计数/懒渲染 pending 都在 g 上） */
			var g = { head: head, body: body, count: 0, pending: [] };
			groups[gkey] = g;
			head.addEventListener("click", function () {
				var open = body.getAttribute("data-collapsed") !== "1";
				body.setAttribute("data-collapsed", open ? "1" : "0");
				head.textContent = (open ? "▸ " : "▾ ") + title + "（" + g.count + "）";
				/* 懒渲染：点击前收起（open=false）→ 点击后展开 → 补建行 */
				if (!open) { buildModGrpRows(g); }
				mbCEUiCollapsed("mods:" + modId + ":" + gkey, !open);
			});
			grp.appendChild(head); grp.appendChild(body);
			pane.appendChild(grp);
			return g;
		}
		function buildModGrpRows(grp) {
			if (!grp || !grp.pending || !grp.pending.length) { return; }
			var pend = grp.pending;
			grp.pending = [];
			var failed = 0;
			/* v1.9.4：行数超阈值或测试强制同步时走同步（首帧立即可见全部行）；否则分片 */
			if (mbCEForceSyncRows() || pend.length <= MOD_ROW_BATCH_LIMIT) {
				for (var i = 0; i < pend.length; i++) {
					try { appendRowNodes(grp.body, pend[i]()); } catch (e) { failed++; }
				}
				if (failed) {
					grp.body.appendChild(el("div", "mce-hint", "有 " + failed + " 行加载失败（适配器数据异常），已跳过。"));
				}
				return;
			}
			/* 分片：先同步建首批 BATCH 行（点击展开立刻可见内容），剩余入队逐帧排空 */
			var first = Math.min(MOD_ROW_BATCH, pend.length);
			for (var fi = 0; fi < first; fi++) {
				try { appendRowNodes(grp.body, pend[fi]()); } catch (e) { failed++; }
			}
			if (pend.length <= MOD_ROW_BATCH) {
				if (failed) {
					grp.body.appendChild(el("div", "mce-hint", "有 " + failed + " 行加载失败（适配器数据异常），已跳过。"));
				}
				return;
			}
			var task = { body: grp.body, fns: pend.slice(first), i: 0, failed: failed };
			modRowQueue.push(task);
			if (!modRowBatchTimer) { modRowBatchTimer = setTimeout(modRowStep, 0); }
		}
		var any = false;
		if (m.tasks.length) { any = true; renderCheatTasks(m, grpFor, buildModGrpRows); }
		if (m.stages.length || m.abilities.length) { any = true; renderCheatStages(m, grpFor, buildModGrpRows); }
		if (m.scenes.length) { any = true; renderCheatScenes(m, grpFor, buildModGrpRows); }
		if (m.values.length) { any = true; renderCheatValues(m, grpFor, buildModGrpRows); }
		if (m.actions.length || typeof m.actionPanel === "function") { any = true; renderCheatActions(m, grpFor, buildModGrpRows); }
		if (!any) {
			pane.appendChild(el("div", "mce-hint", "该模组已识别但未声明可操控项（任务/阶段/剧情/数值均为空）。"));
		}
		/* 组头统一补计数 + 展开态初始建行（与 06-traits 一致：收起的组保持空，等点击展开才建） */
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			var open = g.body.getAttribute("data-collapsed") !== "1";
			g.head.textContent = (open ? "▾ " : "▸ ") + g.head.textContent.replace(/^[▸▾]\s*/, "") + "（" + g.count + "）";
			if (open) { buildModGrpRows(g); }
		});
		pane.scrollTop = st; /* 五巡：恢复滚动位置 */
	}
	/* 行构建抽为独立小函数（返回 node，懒渲染闭包内执行；data-mce-key 与事件保持五巡局部刷新兼容） */
	function actCheat(res, modId, key) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		/* 五巡：操作后局部刷新目标行（不再全量重建整个模组页——高频操作下 DOM churn 是卡顿/闪退累积源之一） */
		if (modId && key) {
			var pane = root.querySelector('[data-pane="mods"]');
			if (pane && refreshModRow(pane, modId, key)) {
				/* v1.9.14 效果2：写入成功 → 刷新回显后的目标行金底闪烁（反馈落在可见新值上） */
				if (res && res.ok) {
					var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape(key) : String(key).replace(/["\\]/g, "\\$&");
					var newRow = pane.querySelector('[data-mce-key="' + esc + '"]');
					if (newRow) { mbCEFlash(newRow); }
				}
				return;
			}
		}
		if (modId) { renderModCheatDetail(modId); }
	}
	/* 阶段下拉回显公共（渲染与局部刷新共用，v1.4.4 行为保持） */
	function reflectStageSelect(sel, s, modId) {
		try {
			var curStage = cheatReadSafe(modId, s.varPath);
			if (curStage !== undefined && curStage !== null) {
				var curStr = String(curStage);
				for (var si = 0; si < s.levels.length; si++) {
					if (String(s.levels[si]) === curStr) { sel.selectedIndex = si; return; }
				}
			}
		} catch (e) {}
	}
	/* 五巡：局部刷新单行回显态；行不存在或出错返回 false（调用方兜底全量重建） */
	function refreshModRow(pane, modId, key) {
		try {
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape(key) : String(key).replace(/["\\]/g, "\\$&");
			var row = pane.querySelector('[data-mce-key="' + esc + '"]');
			if (!row) { return false; }
			var m = findCheatMod(modId);
			if (!m) { return false; }
			var parts = String(key).split(":");
			var kind = parts[0];
			if (kind === "stages") {
				var s = findCheatItem(m.stages, parts.slice(1).join(":"));
				var sel = row.querySelector("select");
				if (s && sel) { reflectStageSelect(sel, s, modId); }
				return true;
			}
			if (kind === "abilities") {
				var a = findCheatItem(m.abilities, parts.slice(1).join(":"));
				var box = row.querySelector('input[type="checkbox"]');
				if (a && box) { box.checked = !!cheatReadSafe(modId, a.varPath); }
				return true;
			}
			if (kind === "values") {
				var it = findCheatItem(m.values, parts[1]);
				if (it && it.type === "list") {
					var opt = parts.slice(2).join(":");
					var lb = row.querySelector('input[type="checkbox"]');
					var arr = Array.isArray(cheatReadSafe(modId, it.varPath)) ? cheatReadSafe(modId, it.varPath) : [];
					if (lb) { lb.checked = arr.indexOf(opt) !== -1; }
				} else if (it) {
					var inp = row.querySelector("input");
					var cur = cheatReadSafe(modId, it.varPath);
					if (inp) {
						if (it.type === "boolean") { inp.checked = !!cur; }
						else if (cur !== undefined && cur !== null) { inp.value = String(cur); }
					}
				}
				return true;
			}
			return true; /* 任务/剧情行无回显态，行存在即视为已刷新 */
		} catch (e) { return false; }
	}
/* 职责：Mod作弊页行构建 —— 模组/条目查询（getCheatMods 等）、任务跳过与完成 */
	function getCheatMods() {
		try {
			var out = [], seen = {}, i;
			var regs = (setup && Array.isArray(setup.mbCE_modCheats)) ? setup.mbCE_modCheats : [];
			for (i = 0; i < regs.length; i++) {
				var m = regs[i];
				if (!m || !m.modId || !m.modName) { continue; }
				seen[m.modId] = true;
				out.push(normalizeCheatMod(m));
			}
			var adIds = Object.keys(CHEAT_ADAPTERS);
			for (i = 0; i < adIds.length; i++) {
				var ad = CHEAT_ADAPTERS[adIds[i]];
				if (!ad || seen[adIds[i]]) { continue; }
				try { if (typeof ad.detect !== "function" || !ad.detect()) { continue; } } catch (e) { continue; }
				seen[adIds[i]] = true;
				out.push(normalizeCheatMod(ad.entry));
			}
			for (i = 0; i < CHEAT_PASSIVE_PROBES.length; i++) {
				var p = CHEAT_PASSIVE_PROBES[i];
				if (!p || !p.modId || seen[p.modId]) { continue; }
				try { if (typeof p.detect !== "function" || !p.detect()) { continue; } } catch (e) { continue; }
				seen[p.modId] = true;
				out.push({ modId: p.modId, modName: p.modName, declared: false, tasks: [], stages: [], abilities: [], scenes: [], values: [] });
			}
			return out;
		} catch (e) { return []; }
	}
	function findCheatMod(modId) {
		var mods = getCheatMods(), i;
		for (i = 0; i < mods.length; i++) { if (mods[i].modId === modId) { return mods[i]; } }
		return null;
	}
	function findCheatItem(list, key) {
		var i;
		for (i = 0; i < list.length; i++) { if (list[i] && list[i].key === key) { return list[i]; } }
		return null;
	}
	/* ---- 四分组动作（统一走通用执行器，不写模组专属逻辑） ---- */
	function skipCheatTask(modId, key) {
		var m = findCheatMod(modId), t = m && findCheatItem(m.tasks, key);
		if (!t) { return { ok: false, message: "任务不存在或该模组未注册" }; }
		if (!t.skipVar) { return { ok: false, message: "「" + t.name + "」未声明跳过标记变量（skipVar），无法跳过" }; }
		return cheatWriteValue(modId, "task_skip:" + key, "task_skip", t.skipVar, true, "boolean");
	}
	function completeCheatTask(modId, key) {
		var m = findCheatMod(modId), t = m && findCheatItem(m.tasks, key);
		if (!t) { return { ok: false, message: "任务不存在或该模组未注册" }; }
		if (!t.completeVar) { return { ok: false, message: "「" + t.name + "」未声明完成标记变量（completeVar），无法直接完成" }; }
		return cheatWriteValue(modId, "task_complete:" + key, "task_complete", t.completeVar, true, "boolean");
	}
	function setCheatStage(modId, key, level) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.stages, key);
		if (!s) { return { ok: false, message: "阶段不存在或该模组未注册" }; }
		if (!s.varPath) { return { ok: false, message: "「" + s.name + "」未声明阶段变量（varPath），无法修改" }; }
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		if (typeof levels[0] === "string") {
			/* 字符串枚举阶段（v1.4.1）：目标值必须在 levels 内，越界拒绝，保持幂等 */
			var idxStr = levels.indexOf(String(level));
			if (idxStr === -1) { return { ok: false, message: "阶段值「" + level + "」不在枚举范围内（" + levels.join(" / ") + "）" }; }
			return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, levels[idxStr], "string", 0, levels.length - 1, s.sync);
		}
		/* v1.9.10：阶段是枚举语义（UI 下拉限定）——仍钳制到 levels 范围，与数值项放开上限区分 */
		var lvStage = Math.max(levels[0], Math.min(levels[levels.length - 1], Number(level) || 0));
		return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, lvStage, "number", levels[0], levels[levels.length - 1], s.sync);
	}
	function jumpCheatStageMax(modId, key) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.stages, key);
		if (!s) { return { ok: false, message: "阶段不存在或该模组未注册" }; }
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		return setCheatStage(modId, key, levels[levels.length - 1]);
	}
	function resetCheatStage(modId, key) {
		var m = findCheatMod(modId), s = m && findCheatItem(m.stages, key);
		if (!s) { return { ok: false, message: "阶段不存在或该模组未注册" }; }
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		return setCheatStage(modId, key, levels[0]);
	}
	function buildCheatTaskRow(m, t) {
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "tasks:" + t.key);
		row.appendChild(el("span", "mce-row-lbl", t.name || t.key));
		var b1 = el("button", "", "跳过任务"); b1.type = "button";
		b1.addEventListener("click", function () { actCheat(skipCheatTask(m.modId, t.key), m.modId, "tasks:" + t.key); });
		var b2 = el("button", "", "直接完成任务"); b2.type = "button";
		b2.addEventListener("click", function () { actCheat(completeCheatTask(m.modId, t.key), m.modId, "tasks:" + t.key); });
		row.appendChild(b1); row.appendChild(b2);
		return row;
	}
	function renderCheatTasks(m, grpFor, buildRows) {
		var g = grpFor("tasks", "1. 模组新增任务");
		m.tasks.forEach(function (t) {
			g.count++;
			g.pending.push(function () { return buildCheatTaskRow(m, t); });
		});
	}
	function buildCheatStageRow(m, s) {
		var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
		var labels = Array.isArray(s.labels) && s.labels.length ? s.labels : levels.map(function (lv) { return String(lv); });
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "stages:" + s.key);
		row.appendChild(el("span", "mce-row-lbl", "阶段 · " + (s.name || s.key)));
		var sel = el("select", "mce-sel");
		levels.forEach(function (lv, i) {
			var opt = el("option", "", labels[i] !== undefined ? labels[i] : String(lv));
			opt.value = String(lv);
			sel.appendChild(opt);
		});
		/* v1.4.4：回显当前阶段值（字符串枚举/数字枚举均按值匹配），应用后局部刷新立即可见生效 */
		reflectStageSelect(sel, s, m.modId);
		var bSet = el("button", "", "应用"); bSet.type = "button";
		bSet.addEventListener("click", function () { actCheat(setCheatStage(m.modId, s.key, sel.value), m.modId, "stages:" + s.key); });
		var bMax = el("button", "", "跳至最高"); bMax.type = "button";
		bMax.addEventListener("click", function () { actCheat(jumpCheatStageMax(m.modId, s.key), m.modId, "stages:" + s.key); });
		var bMin = el("button", "", "回退初始"); bMin.type = "button";
		bMin.addEventListener("click", function () { actCheat(resetCheatStage(m.modId, s.key), m.modId, "stages:" + s.key); });
		row.appendChild(sel); row.appendChild(bSet); row.appendChild(bMax); row.appendChild(bMin);
		return row;
	}
	function buildCheatAbilityRow(m, a) {
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "abilities:" + a.key);
		var box = el("input", "");
		box.type = "checkbox";
		box.checked = !!cheatReadSafe(m.modId, a.varPath);
		box.addEventListener("change", function () { actCheat(toggleCheatAbility(m.modId, a.key, box.checked), m.modId, "abilities:" + a.key); });
		row.appendChild(box);
		var abl = el("span", "mce-row-lbl", "能力 · " + (a.name || a.key));
		/* v1.9.13 排版：写入路径移出 label（折叠「说明」与悬停 title 均可查），label 变短不再挤压按钮区 */
		if (a.varPath) { abl.title = a.varPath; }
		row.appendChild(abl);
		/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
		var det = el("details", "mce-ab-detail");
		det.appendChild(el("summary", "mce-ab-sum", "说明"));
		var body = el("div", "mce-ab-body");
		if (a.varPath) { body.appendChild(el("div", "", "写入路径：" + a.varPath)); }
		body.appendChild(el("div", "", "类型：" + (a.type || "boolean")));
		if (a.type === "number" && (a.min !== undefined || a.max !== undefined)) {
			body.appendChild(el("div", "", "参考范围：" + (a.min !== undefined ? a.min : "-∞") + " ~ " + (a.max !== undefined ? a.max : "∞")));
		}
		if (a.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + a.note)); }
		det.appendChild(body);
		row.appendChild(det);
		return row;
	}
	function renderCheatStages(m, grpFor, buildRows) {
		var g = grpFor("stages", "2. 模组新增阶段 & 能力");
		m.stages.forEach(function (s) { g.count++; g.pending.push(function () { return buildCheatStageRow(m, s); }); });
		m.abilities.forEach(function (a) { g.count++; g.pending.push(function () { return buildCheatAbilityRow(m, a); }); });
	}
	function buildCheatSceneRow(m, s) {
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "scenes:" + s.key);
		row.appendChild(el("span", "mce-row-lbl", s.name || s.key));
		var b1 = el("button", "", "跳过此段剧情"); b1.type = "button";
		b1.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_skip"), m.modId, "scenes:" + s.key); });
		var b2 = el("button", "", "强制完成剧情"); b2.type = "button";
		b2.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_force"), m.modId, "scenes:" + s.key); });
		var b3 = el("button", "", "重置剧情进度"); b3.type = "button";
		b3.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_reset"), m.modId, "scenes:" + s.key); });
		row.appendChild(b1); row.appendChild(b2); row.appendChild(b3);
		return row;
	}
	function renderCheatScenes(m, grpFor, buildRows) {
		var g = grpFor("scenes", "3. 模组自定义剧情");
		m.scenes.forEach(function (s) { g.count++; g.pending.push(function () { return buildCheatSceneRow(m, s); }); });
	}
	function buildCheatValueRow(m, it) {
		if (it.type === "list") {
			var opts = Array.isArray(it.options) ? it.options : [];
			var curArr = cheatReadSafe(m.modId, it.varPath);
			var arr = Array.isArray(curArr) ? curArr : [];
			var rows = [];
			if (!opts.length) {
				rows.push(el("div", "mce-hint", (it.name || it.key) + "：未声明候选值（options 为空）。"));
			}
			opts.forEach(function (opt) {
				var brow = el("div", "mce-row");
				brow.setAttribute("data-mce-key", "values:" + it.key + ":" + opt);
				var box = el("input", "");
				box.type = "checkbox";
				box.checked = arr.indexOf(opt) !== -1;
				box.addEventListener("change", function () {
					actCheat(applyCheatModValue(m.modId, it.key, { value: opt, on: box.checked }), m.modId, "values:" + it.key + ":" + opt);
				});
				brow.appendChild(box);
				var lbl = el("span", "mce-row-lbl", (it.name || it.key) + " · " + opt);
				if (it.varPath) { lbl.title = it.varPath; }
				brow.appendChild(lbl);
				var und = el("button", "", "回退"); und.type = "button";
				und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key + ":" + opt), m.modId, "values:" + it.key + ":" + opt); });
				brow.appendChild(und);
				rows.push(brow);
			});
			return rows;
		}
		var row = el("div", "mce-row");
		row.setAttribute("data-mce-key", "values:" + it.key);
		var vlbl = el("span", "mce-row-lbl", it.name || it.key);
		if (it.varPath) { vlbl.title = it.varPath; }
		row.appendChild(vlbl);
		var inp = el("input", "mce-inp");
		inp.type = it.type === "boolean" ? "checkbox" : "text";
		if (it.type !== "boolean") {
			/* v1.8.12 功能9+优化：text 输入使 +N / -N 相对语法可输入（number 输入框会拒绝 + 号），
			   数值合法性由 cheatWriteValue 校验兜底 */
			inp.inputmode = "decimal";
			inp.placeholder = "+N / -N 相对";
			inp.title = "支持相对调整：输入 +100 表示在当前值上加 100，-20 表示减 20；直接输入数字为绝对值（范围仅供参考，上限不钳制）";
		}
		var cur = cheatReadSafe(m.modId, it.varPath);
		if (it.type === "boolean") { inp.checked = !!cur; }
		else if (cur !== undefined && cur !== null) { inp.value = String(cur); }
		var b = el("button", "", "应用修改"); b.type = "button";
		b.addEventListener("click", function () {
			var raw = it.type === "boolean" ? inp.checked : inp.value;
			actCheat(applyCheatModValue(m.modId, it.key, raw), m.modId, "values:" + it.key);
		});
		row.appendChild(inp); row.appendChild(b);
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key), m.modId, "values:" + it.key); });
		row.appendChild(und);
		/* v1.8.7 数值项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
		var det = el("details", "mce-ab-detail");
		det.appendChild(el("summary", "mce-ab-sum", "说明"));
		var body = el("div", "mce-ab-body");
		if (it.varPath) { body.appendChild(el("div", "", "写入路径：" + it.varPath)); }
		body.appendChild(el("div", "", "类型：" + (it.type || "number")));
		if (typeof it.min === "number" || typeof it.max === "number") {
			body.appendChild(el("div", "", "参考范围：" + (typeof it.min === "number" ? it.min : "-∞") + " ~ " + (typeof it.max === "number" ? it.max : "∞")));
		}
		if (it.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + it.note)); }
		det.appendChild(body);
		row.appendChild(det);
		return row;
	}
	/* v1.9.13 数值项搜索命中判定（纯函数，可测）：q 为空恒命中；否则匹配 名称/键名/写入路径 */
	function cheatValueMatches(it, q) {
		if (!q) { return true; }
		var hay = ((it.name || "") + " " + it.key + " " + (it.varPath || "")).toLowerCase();
		return hay.indexOf(q) !== -1;
	}
	function renderCheatValues(m, grpFor, buildRows) {
		var g = grpFor("values", "4. 自定义数值修改");
		/* v1.9.13 搜索过滤：命中名称/键名/写入路径才计入；搜索态强制该组展开（过滤结果立即可见） */
		var q = modValueFilter ? modValueFilter.toLowerCase() : "";
		m.values.forEach(function (it) {
			if (!cheatValueMatches(it, q)) { return; }
			g.count++;
			g.pending.push(function () { return buildCheatValueRow(m, it); });
		});
		if (q && g.body) { g.body.setAttribute("data-collapsed", "0"); }
	}
/* ============ v2.0.0.002：模组页「命令式动作」分组渲染（从 05a 拆出，守住单文件 ≤400 行） ============
   用途：适配器可以声明 actions（自己的"一键"按钮），或用 actionPanel 整体接管一组渲染。
   首个使用者是 FertilityExpansion：它自带 eden-cheats-ui.js（10 项作弊），CE 直接调用其
   window.EdenCheats 复刻同一套能力（04a-14-fert-cheats.js），不重写模组的 sync/回滚链。
   行构建沿用模组页既有懒渲染协议：grpFor 建组 → g.pending 存返回节点的函数 → 展开时 buildModGrpRows 补建。 */

/* 适配器动作的两种声明形态：直接挂在注册项上，或包在 entry 里（04a-*.js 现行写法把 actions 放 entry 内）。 */
function mbCEAdapterList(m) {
	if (!m || typeof m !== "object") { return []; }
	if (Array.isArray(m.actions)) { return m.actions; }
	if (m.entry && Array.isArray(m.entry.actions)) { return m.entry.actions; }
	return [];
}

/* 单条执行路径：面板按钮、直调通道、测试都走这里，错误文案只在这一处产生。 */
function mbCEAdapterRun(m, actionKey, args) {
	var list = mbCEAdapterList(m);
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].key === actionKey) {
			if (typeof list[i].run !== "function") { return { ok: false, message: "该动作未实现：" + actionKey }; }
			try { return list[i].run(args || {}); }
			catch (e) { return { ok: false, message: "动作抛出异常：" + mbCEErr(e) }; }
		}
	}
	return { ok: false, message: "无此动作：" + actionKey };
}

/* 直调通道（面板按钮之外的第二条入口）：按 adapterId + actionKey 从注册表取适配器再执行。
   此前 a.run({}) 只在点击回调里内联调用，测试与外部脚本没有入口，动作分支无法被覆盖。 */
function mbCEAdapterAction(adapterId, actionKey, args) {
	if (!adapterId) { return { ok: false, message: "未指定适配器" }; }
	var reg = (typeof CHEAT_ADAPTERS === "object" && CHEAT_ADAPTERS) ? CHEAT_ADAPTERS : null;
	if (!reg) { return { ok: false, message: "适配器注册表不可用" }; }
	var m = reg[adapterId];
	if (!m) { return { ok: false, message: "未找到适配器：" + adapterId }; }
	return mbCEAdapterRun(m, actionKey, args);
}

function mbCEActionRow(m, a) {
	var row = el("div", "mce-row");
	row.setAttribute("data-mce-key", "action:" + a.key);
	row.appendChild(el("span", "mce-row-lbl", a.name));
	var b = el("button", "mce-btn mce-gold", "执行");
	b.type = "button";
	b.title = a.note || "";
	b.addEventListener("click", function () {
		var res = mbCEAdapterRun(m, a.key, {});
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
	});
	row.appendChild(b);
	if (a.note) { row.appendChild(el("span", "mce-hint", a.note)); }
	return row;
}

function renderCheatActions(m, grpFor, buildModGrpRows) {
	var list = mbCEAdapterList(m);
	if (!list.length && typeof m.actionPanel !== "function") { return; }
	var g = grpFor("actions", "命令式动作（模组自带作弊等价）");
	if (typeof m.actionPanel === "function") {
		/* 适配器自带完整面板：面板里已有全部动作入口，不再重复铺一行一个按钮 */
		g.pending.push(function () {
			var box = el("div", "mce-col");
			try { m.actionPanel(box, m); } catch (e) { box.appendChild(el("div", "mce-err", "动作面板渲染失败：" + mbCEErr(e))); }
			return box;
		});
		g.count += 1;
		return;
	}
	list.forEach(function (a) {
		if (!a || !a.key) { return; }
		g.pending.push(function () { return mbCEActionRow(m, a); });
		g.count += 1;
	});
}
	/* ============ v1.7.0 玩家属性全量编辑（Mod作弊 主容器页「玩家自己」入口）
	       数据源：① V.player 全量（递归限深 3，循环引用防崩）；② 模组属性 = 运行时 V 顶层键
	       - ORIGINAL_V_ROOT_KEYS - CHEAT_VANILLA_ROOTS - mbCE_*（与原版比对，只添加没有的）。
	       可改：number（数字输入）/ boolean（勾选）/ 短字符串阶段（≤24 字符且无空白 → 文本输入）；
	       只读：长字符串 / 函数 / undefined / null / 深度超限 / 循环引用。
	       写入：复用 cheatWriteValue（modId="player-self"，root=player 或模组键不在原版黑名单），
	       mbCE_wrote 留痕 + 每项回退按钮。 ============ */
	var curPlayerSection = "player";
	function actPlayer(res, path) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		/* 六巡：快速面板数值操作局部刷新该行（不再全量重建 33 行 + 特质区）；特质类操作无 path → 全量重建 */
		if (path) {
			var pane = root.querySelector('[data-pane="mods"]');
			/* 兜底分支必须带 "quick:" 前缀（与渲染 setAttribute 一致）；无 CSS.escape 时仅转义引号/反斜杠 */
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape("quick:" + path) : String("quick:" + path).replace(/["\\]/g, "\\$&");
			var row = pane ? pane.querySelector('[data-mce-key="' + esc + '"]') : null;
			if (row) {
				/* v2.0.0.007 好友实测修复：局部刷新必须连按钮状态一起同步——
				   ① 点「锁定」后按钮要立刻变「已锁定」（原先只刷 input/label，得切页才变）
				   ② 行标签走 ensureQuickIndex 取中文 label（索引未建时退回英文路径 = 「点了变英文」根因） */
				mbCESyncQuickRow(row, path);
				/* v1.9.14 效果2：写入成功 → 该行金底闪烁 */
				if (res && res.ok) { mbCEFlash(row); }
				return;
			}
		}
		renderPlayerEdit();
	}
	/* v1.8.12 功能6：能力项数据驱动重构——数据表声明式（path/label/type/min/max/note），渲染与钳制统一走表数据。
	   口径：purity 内部 0-2000（UI 显示 %）；beauty/physique 及意志/意识/淫乱/暴露癖/异种癖按用户要求无硬上限
	   （999999 仅防误输入，非游戏上限；v1.8.19 体能 physique 由 0-100 提为无上限）；技能/性技能/成绩/武器 0-1000（百分比量纲）。 */
	var PANEL_QUICK_GROUPS = [
		{ title: "核心属性", items: [
			{ path: "purity", label: zhKey("purity"), min: 0, max: 2000, note: "面板显示 0-100%，内部 0-2000" },
			{ path: "beauty", label: zhKey("beauty"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "physique", label: zhKey("physique"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "willpower", label: zhKey("willpower"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "awareness", label: zhKey("awareness"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "promiscuity", label: zhKey("promiscuity"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "exhibitionism", label: zhKey("exhibitionism"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "deviancy", label: zhKey("deviancy"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "money", label: zhKey("money"), min: 0, max: 99999999, note: "单位 £，建议输入整数；上限已放开（防误输入）" }
		] },
		{ title: "基础技能", items: [
			{ path: "skulduggery", label: zhKey("skulduggery"), min: 0, max: 1000 },
			{ path: "danceskill", label: zhKey("danceskill"), min: 0, max: 1000 },
			{ path: "swimmingskill", label: zhKey("swimmingskill"), min: 0, max: 1000 },
			{ path: "athletics", label: zhKey("athletics"), min: 0, max: 1000 },
			{ path: "tending", label: zhKey("tending"), min: 0, max: 1000 },
			{ path: "housekeeping", label: zhKey("housekeeping"), min: 0, max: 1000 }
		] },
		{ title: "性技能", items: [
			{ path: "seductionskill", label: zhKey("seductionskill"), min: 0, max: 1000 },
			{ path: "oralskill", label: zhKey("oralskill"), min: 0, max: 1000 },
			{ path: "chestskill", label: zhKey("chestskill"), min: 0, max: 1000 },
			{ path: "handskill", label: zhKey("handskill"), min: 0, max: 1000 },
			{ path: "bottomskill", label: zhKey("bottomskill"), min: 0, max: 1000 },
			{ path: "penileskill", label: zhKey("penileskill"), min: 0, max: 1000 },
			{ path: "vaginalskill", label: zhKey("vaginalskill"), min: 0, max: 1000 },
			{ path: "analskill", label: zhKey("analskill"), min: 0, max: 1000 },
			{ path: "thighskill", label: zhKey("thighskill"), min: 0, max: 1000 },
			{ path: "feetskill", label: zhKey("feetskill"), min: 0, max: 1000 }
		] },
		{ title: "学校成绩", items: [
			{ path: "science", label: zhKey("science"), min: 0, max: 1000 },
			{ path: "maths", label: zhKey("maths"), min: 0, max: 1000 },
			{ path: "english", label: zhKey("english"), min: 0, max: 1000 },
			{ path: "history", label: zhKey("history"), min: 0, max: 1000 }
		] },
		{ title: "武器技能", items: [
			{ path: "prof.spray", label: zhKey("prof.spray"), min: 0, max: 1000 },
			{ path: "prof.baton", label: zhKey("prof.baton"), min: 0, max: 1000 },
			{ path: "prof.whip", label: zhKey("prof.whip"), min: 0, max: 1000 },
			{ path: "prof.net", label: zhKey("prof.net"), min: 0, max: 1000 },
			{ path: "prof.pickaxe", label: zhKey("prof.pickaxe"), min: 0, max: 1000 }
		] },
		/* v1.9.13 负面状态：原版 V 键实证存在（stress/trauma 等均不在原版黑名单，
		   玩家面板通道可直写；上限不钳制，下限 0 防负值破坏） */
		{ title: "负面状态", items: [
			{ path: "stress", label: zhKey("stress"), min: 0, max: 999999, note: "原版上限 V.stressmax（每日钳制），CE 直写不钳" },
			{ path: "trauma", label: zhKey("trauma"), min: 0, max: 999999, note: "原版上限 V.traumamax；≥1000 触发创伤安全屋线" },
			{ path: "pain", label: zhKey("pain"), min: 0, max: 999999, note: "原版伤害值（HP 相关），0 即满血" },
			{ path: "arousal", label: zhKey("arousal"), min: 0, max: 999999, note: "原版上限 V.arousalmax，面板显示为百分比" },
			{ path: "tiredness", label: zhKey("tiredness"), min: 0, max: 999999, note: "原版上限 C.tiredness.max；≥上限 75% 触发昏倒" },
			{ path: "anxiety", label: zhKey("anxiety"), min: 0, max: 999999, note: "原版档位 0-2（≥2 触发事件），直写不钳" },
			{ path: "delinquency", label: zhKey("delinquency"), min: -100, max: 999999, note: "品行值：≤0 老师宠儿、≥1000 老师噩梦（feat 阈值）" },
			{ path: "drugged", label: zhKey("drugged"), min: 0, max: 1000, note: "原版 0-1000，越高药效越强" },
			{ path: "drunk", label: zhKey("drunk"), min: 0, max: 999999, note: "≥240 判定醉酒；写 0 直接醒酒" }
		] },
		/* v1.9.13 名声：fame 为原版 V 对象（fame.prostitution 等子键实证存在，
		   玩家面板通道直写对象子键，父级 V.fame 存在即合法） */
		{ title: "名声（fame）", items: [
			{ path: "fame.prostitution", label: zhKey("fame.prostitution"), min: 0, max: 999999 },
			{ path: "fame.sex", label: zhKey("fame.sex"), min: 0, max: 999999 },
			{ path: "fame.rape", label: zhKey("fame.rape"), min: 0, max: 999999 },
			{ path: "fame.exhibitionism", label: zhKey("fame.exhibitionism"), min: 0, max: 999999 },
			{ path: "fame.bestiality", label: zhKey("fame.bestiality"), min: 0, max: 999999 },
			{ path: "fame.good", label: zhKey("fame.good"), min: 0, max: 999999, note: "善行积累（≥1000 触发 A Good Reputation 线）" }
		] }
	];
	/* v1.8.12 功能13：数据表路径索引（quickWrite 查 min/max 用，懒建）
	   v2.0.0.007：抽成 ensureQuickIndex()，局部刷新（actPlayer）也走它——已建索引才拿得到中文 label，
	   否则行标签退回英文路径（好友实测「点锁定后技能名变英文」的根因） */
	var PANEL_QUICK_PATH_INDEX = null;
	function ensureQuickIndex() {
		if (PANEL_QUICK_PATH_INDEX) { return PANEL_QUICK_PATH_INDEX; }
		PANEL_QUICK_PATH_INDEX = {};
		PANEL_QUICK_GROUPS.forEach(function (g) {
			g.items.forEach(function (it) { PANEL_QUICK_PATH_INDEX[it.path] = it; });
		});
		return PANEL_QUICK_PATH_INDEX;
	}
	function quickReadValue(path) {
		try {
			var V2 = getV();
			if (!V2) { return null; }
			/* v1.9.13：通用点路径读取（prof.spray / fame.prostitution 等对象子键，
			   逐级下探，父级不存在返回 undefined，不抛错） */
			var parts = String(path).split(".");
			if (parts.length > 1) {
				var cur = V2;
				for (var qi = 0; qi < parts.length - 1; qi++) {
					if (cur == null || typeof cur[parts[qi]] !== "object") { return undefined; }
					cur = cur[parts[qi]];
				}
				return cur[parts[parts.length - 1]];
			}
			return V2[path];
		} catch (e) { return null; }
	}
	/* 武器父级兜底：$prof 缺失时补空壳（只建不覆盖），使 prof.* 可安全写入 */
	function ensureProfShell() {
		try {
			var V2 = getV();
			if (!V2) { return { ok: false, message: "存档变量不可用" }; }
			if (!V2.prof || typeof V2.prof !== "object") {
				V2.prof = { spray: 0, baton: 0, whip: 0, net: 0, pickaxe: 0 };
				return { ok: true, created: true };
			}
			return { ok: true, created: false };
		} catch (e) { return { ok: false, message: "武器数据初始化失败" }; }
	}
	/* ===== v2.0.0.002 需求②：武器「直接获得」=====
	   原版武器持有语义实证（DoL 0.5.12.13 源码逐条取证）：
	   - 持有判定 = V.prof.<武器> 键存在。角色页特性栏 `<<if $prof.whip isnot undefined>>` 才显示该武器特性，
	     未定义时走 _hiddenConfig（截图里「网（当前 —）」「镐（当前 —）」即 undefined 的呈现）。
	     神殿开启战斗链 `<<set $prof.baton to 200>><<<set $prof.whip to 800>><<<set $temple_weapon to "whip">>`
	     就是"直接给武器"的原版写法，故 CB 侧等价实现 = 建 prof 键 + 给入门熟练度。
	   - 防狼喷雾还有独立物资：V.spray（弹药数）/ V.spraymax（容量）/ V.infinitespray。
	     `spray()` 内 `V.spray = Math.clamp(V.spray, 0, V.spraymax)`，spraymax=0 时有熟练度也打不出，
	     故获得喷雾必须同时给容量与弹药（否则面板显示"已获得"但实战无弹）。
	   - 镐的真身是道具 `<<wearProp "pickaxe">>`（矿山/废土派发），prof.pickaxe 的显示块在原版被注释块包裹，
	     写键只为对齐"非 undefined"判定，道具本身由 game 的 wearProp 管理，不在此伪造。 */
	var WEAPON_GRANT_BASE = 100; /* 入门档：原版武器四档 100/300/500/1000 */
	var WEAPON_LABEL = { spray: "防狼喷雾", baton: "短棍", whip: "鞭子", net: "网", pickaxe: "镐" };
	function quickTargetValue(raw, cur) {
		var s = String(raw == null ? "" : raw).trim();
		if (!s) { return null; }
		var rel = /^([+-])\s*(\d+(?:\.\d+)?)$/.exec(s);
		if (rel) {
			var base = (typeof cur === "number" ? cur : 0);
			return rel[1] === "+" ? base + Number(rel[2]) : base - Number(rel[2]);
		}
		return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
	}
	function grantWeapon(path, base) {
		var w = String(path || "").replace(/^prof\./, "");
		if (!w || !WEAPON_LABEL[w]) { return { ok: false, message: "未知武器键：" + w }; }
		var es = ensureProfShell();
		if (!es.ok) { return es; }
		var V2 = getV();
		if (!V2) { return { ok: false, message: "存档变量不可用" }; }
		var val = (typeof base === "number" && base > 0 ? base : WEAPON_GRANT_BASE);
		var msgs = [], allOk = true;
		/* 自检（测试 54.4 抓到）：原版持有判定是 `isnot undefined`，但值为 0 时武器已"在手"却毫无熟练度——
		   玩家点「获得」的预期是"拿到能用"，所以规则定为：值 ≥1 一律保持（不冲掉 722 这类已有熟练度），
		   值为 0 或键缺失才写入门档 100。 */
		var curProf = (typeof V2.prof[w] === "number") ? V2.prof[w] : null;
		if (curProf !== null && curProf >= 1) {
			msgs.push("已持有，保持现值 " + curProf);
		} else {
			var r1 = cheatWriteValue("player-self", "p:prof." + w, "value_set", "prof." + w, val, "number", 0, 1000);
			allOk = allOk && !!(r1 && r1.ok);
			msgs.push(r1 && r1.ok ? "熟练度 " + val : "熟练度写入失败");
		}
		if (w === "spray") {
			if (!((typeof V2.spraymax === "number" ? V2.spraymax : 0) >= 1)) {
				var r2 = cheatWriteValue("player-self", "p:spraymax", "value_set", "spraymax", 5, "number", 0, 8);
				allOk = allOk && !!(r2 && r2.ok);
				msgs.push(r2 && r2.ok ? "容量 5" : "容量写入失败");
			}
			if (!((typeof V2.spray === "number" ? V2.spray : 0) >= 1)) {
				var cap = ((typeof V2.spraymax === "number" && V2.spraymax >= 1) ? V2.spraymax : 5);
				var r3 = cheatWriteValue("player-self", "p:spray", "value_set", "spray", cap, "number", 0, 8);
				allOk = allOk && !!(r3 && r3.ok);
				msgs.push(r3 && r3.ok ? "弹药 " + cap : "弹药写入失败");
			}
		}
		return { ok: allOk, message: "已获得「" + WEAPON_LABEL[w] + "」：" + msgs.join("，") };
	}
	function grantAllWeapons() {
		var done = 0, fails = [];
		["spray", "baton", "whip", "net", "pickaxe"].forEach(function (w) {
			var r = grantWeapon("prof." + w);
			if (r.ok) { done++; } else { fails.push(WEAPON_LABEL[w]); }
		});
		return {
			ok: fails.length === 0,
			message: "已获得 " + done + " 件武器" + (fails.length ? "，失败：" + fails.join("、") : "（喷雾含容量/弹药）")
		};
	}
	function quickWrite(path, raw) {
		if (String(path).indexOf("prof.") === 0) {
			var es = ensureProfShell();
			if (!es.ok) { return es; }
		}
		/* v1.8.12 功能6：查数据表取该项 min/max，传给 cheatWriteValue 统一写入（上限不钳制）*/
		var meta = ensureQuickIndex()[path] || null;
		return cheatWriteValue("player-self", "p:" + path, "value_set", path, raw, "number",
			meta && typeof meta.min === "number" ? meta.min : undefined,
			meta && typeof meta.max === "number" ? meta.max : undefined);
	}
	/* v2.0.0.007：行内状态唯一真值路径——渲染（renderQuickRow）与局部刷新（actPlayer）都调它。
	   好友实测两个问题都出在「只有整页重渲染才更新」：
	   ① 点「锁定」后按钮文案不变成「已锁定」，必须切页签再回来才看到；
	   ② 点完后该行技能名变英文裸 key（skulduggery / athletics …），切页后恢复中文——
	      根因是局部刷新时 PANEL_QUICK_PATH_INDEX 尚未构建，label 回退成 path 原文。 */
	function mbCESyncQuickRow(row, path) {
		if (!row) { return; }
		var cur = quickReadValue(path);
		var meta = ensureQuickIndex()[path] || null;
		var inp = row.querySelector("input.mce-inp");
		if (inp) { inp.value = (typeof cur === "number") ? String(cur) : "0"; }
		var lbl = row.querySelector(".mce-row-lbl");
		if (lbl) { lbl.textContent = (meta ? meta.label : path) + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"; }
		var lk = row.querySelector('[data-mce-role="lock"]');
		if (lk) {
			var locked = (typeof mbCELockHas === "function") ? !!mbCELockHas(path) : false;
			if (lk.classList) { lk.classList.toggle("mce-gold", locked); } else { lk.className = locked ? "mce-btn mce-gold" : ""; }
			lk.textContent = locked ? "已锁定" : "锁定";
			lk.title = locked
				? "该值已锁定（每 1 秒强制写回目标 " + mbCELockTarget(path) + "）；点击取消锁定"
				: "锁定：输入框的数值（含 +N/-N 相对写法）成为目标值，每 1 秒强制写回，存存档";
		}
		var gr = row.querySelector('[data-mce-role="grant"]');
		if (gr) {
			/* 持有判定对齐 grantWeapon：prof 值为 number 且 ≥1 = 已在手（原版 isnot undefined 外还挡住 0 值） */
			var owned = (typeof cur === "number") && cur >= 1;
			if (gr.classList) { gr.classList.toggle("mce-gold", owned); } else { gr.className = owned ? "mce-btn mce-gold" : "mce-btn"; }
			gr.textContent = owned ? "已获得" : "获得";
			gr.title = owned
				? "该武器已持有（熟练度 " + cur + "）；点此仍会补齐喷雾的容量与弹药"
				: "直接获得该武器：写 prof 键（原版持有判定）+ 入门熟练度 100；喷雾同时补容量 5 与满弹药";
		}
	}
	function renderQuickRow(pane, it) {
		var path = it.path, label = it.label;
		var cur = quickReadValue(path);
		var row = el("div", "mce-row");
		/* 六巡：行带 data-mce-key——快速面板数值操作后 actPlayer 局部刷新该行，不再全量重建 33 行 + 特质区 */
		row.setAttribute("data-mce-key", "quick:" + path);
		row.appendChild(el("span", "mce-row-lbl", label + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = (typeof cur === "number") ? String(cur) : "0";
		inp.placeholder = "+N / -N 相对";
		var rangeTxt = (typeof it.min === "number" && typeof it.max === "number") ? "；合理范围 " + it.min + "–" + it.max : "";
		inp.title = "支持相对调整：+100 / -20；直接输入数字为绝对值" + rangeTxt + (it.note ? "（" + it.note + "）" : "");
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () { actPlayer(quickWrite(path, inp.value), path); });
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actPlayer(undoCheatModValue("player-self", "p:" + path), path); });
		/* v2.0.0.002 需求①：数值锁定（复用 07f-lock.js 通道，每 1 秒强制写回，存存档）
		   v2.0.0.007：文案/样式交给 mbCESyncQuickRow，渲染与刷新共用一条真值路径 */
		var lk = el("button", "", "锁定");
		lk.type = "button";
		lk.setAttribute("data-mce-role", "lock");
		lk.addEventListener("click", function () {
			if (typeof mbCELockHas !== "function" || typeof mbCELockSet !== "function" || typeof mbCELockRemove !== "function") {
				setStatus("锁定模块未加载（07f-lock.js）", "mce-err"); return;
			}
			if (mbCELockHas(path)) { actPlayer(mbCELockRemove(path), path); return; }
			var tgt = quickTargetValue(inp.value, quickReadValue(path));
			if (tgt == null) { setStatus("锁定需要具体目标值（也支持 +N / -N 相对写法）", "mce-err"); return; }
			actPlayer(mbCELockSet(path, tgt), path);
		});
		row.appendChild(inp); row.appendChild(b); row.appendChild(und); row.appendChild(lk);
		/* v2.0.0.002 需求②：武器组每行加「获得」（非武器组不出现）
		   v2.0.0.007：已持有（prof ≥1）→ 文案变「已获得」（原先固定「获得」，好友截图四即此） */
		if (String(path).indexOf("prof.") === 0) {
			var gr = el("button", "mce-btn", "获得");
			gr.type = "button";
			gr.setAttribute("data-mce-role", "grant");
			gr.addEventListener("click", function () { actPlayer(grantWeapon(path), path); });
			row.appendChild(gr);
		}
		mbCESyncQuickRow(row, path);
		pane.appendChild(row);
	}
	function renderQuickPanel(pane) {
		/* v2.0.0.002 需求③：自由选择说话态度——放在本页最上方（用户指定位置）
		   v2.0.3：本页也是多区块页，传入本页编号 1（原先复用全局页写死的 ⑩，在本页是错号） */
		renderAttitudeFree(pane, 1);
		/* v1.9.13 预设模板：一键批量写入（逐项走 quickWrite 统一留痕，可单独回退）
		   v2.0.3：改 mceNewSec 统一区块样式与编号（本页第 2 区块） */
		var psec = mceNewSec(pane, 2, "一键方案（预设模板）", "整组批量写入（每个键各自留痕，可单独回退）；与下方各属性折叠组不冲突，预设只写固定档位。");
		var pWrap = el("div", "mce-row");
		var presets = [
			{ key: "max", name: "全属性拉满", desc: "全部核心/技能/性技能/成绩/武器写满 + 负面清零 + 名声清零" },
			{ key: "fresh", name: "经典开局", desc: "资金 5000 + 技能/成绩/武器 100 + 负面清零 + 名声清零" }
		];
		presets.forEach(function (p) {
			var b = el("button", "mce-btn mce-gold", p.name); b.type = "button";
			b.title = p.desc;
			b.addEventListener("click", function () {
				var r = applyQuickPreset(p.key);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderPlayerEdit();
			});
			pWrap.appendChild(b);
		});
		psec.appendChild(pWrap);
		psec.appendChild(el("div", "mce-hint", "预设为固定值批量写入，逐项留痕（「回退」可逐项还原）；如需微调请在各分组手动改。"));
		/* v2.0.3：mceNewSec 已把区块挂到 pane，无需再 append */
		PANEL_QUICK_GROUPS.forEach(function (g) {
			/* v1.9.16：属性分组改可折叠（学特质页 .mce-collapse-head 机制，mbCEUiCollapsed 持久化，默认收起） */
			var qkey = "quick:" + g.title;
			var restoreOpen = (typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.collapsed && mbCEUiState.collapsed[qkey] === 0);
			var grp = el("div", "mce-grp");
			var headTxt = (restoreOpen ? "▾ " : "▸ ") + g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）";
			var head = el("div", "mce-grp-t mce-collapse-head", headTxt);
			var body = el("div", "mce-grp-body");
			body.setAttribute("data-collapsed", restoreOpen ? "0" : "1");
			head.addEventListener("click", function () {
				var open = body.getAttribute("data-collapsed") !== "1";
				body.setAttribute("data-collapsed", open ? "1" : "0");
				head.textContent = (open ? "▸ " : "▾ ") + g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）";
				mbCEUiCollapsed(qkey, !open);
			});
			grp.appendChild(head);
			grp.appendChild(body);
			g.items.forEach(function (it) { renderQuickRow(body, it); });
			if (g.title === "武器技能") {
				var allG = el("button", "mce-btn mce-gold", "全部获得（5 件武器）");
				allG.type = "button";
				allG.title = "一次获得 防狼喷雾/短棍/鞭子/网/镐（写 prof 键 = 原版持有判定）；喷雾同时补容量 5 与满弹药";
				allG.addEventListener("click", function () {
					var r = grantAllWeapons();
					setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
					renderPlayerEdit();
				});
				body.appendChild(allG);
			}
			pane.appendChild(grp);
		});
	}
	/* v1.9.13 预设模板执行器：固定值表 × PANEL_QUICK_GROUPS 逐项写入（统一走 quickWrite 留痕）。
	   值语义：核心属性 max 写 999（无上限属性的“很高”量纲）/ purity 2000（满）/ 资金 999999；
	   技能/性技能/成绩/武器 fresh=100、max=1000；负面与名声一律清零。
	   组归属判断用组标题（面板文案），改名时需同步本函数。 */
	function applyQuickPreset(kind) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			var map = {};
			if (kind === "fresh") {
				map.money = 5000; map.purity = 2000;
			} else {
				map.purity = 2000; map.beauty = 999; map.physique = 999; map.willpower = 999; map.awareness = 999;
				map.promiscuity = 999; map.exhibitionism = 999; map.deviancy = 999; map.money = 999999;
			}
			var skillVal = kind === "fresh" ? 100 : 1000;
			PANEL_QUICK_GROUPS.forEach(function (g) {
				if (g.title === "负面状态" || g.title === "名声（fame）") { return; } /* 末尾统一清零 */
				g.items.forEach(function (it) {
					if (map[it.path] !== undefined) { return; }
					map[it.path] = skillVal;
				});
			});
			["stress", "trauma", "pain", "arousal", "tiredness", "anxiety", "delinquency", "drugged", "drunk",
			 "fame.prostitution", "fame.sex", "fame.rape", "fame.exhibitionism", "fame.bestiality", "fame.good"].forEach(function (p) {
				map[p] = 0;
			});
			var done = 0, fails = 0;
			Object.keys(map).forEach(function (path) {
				var r = quickWrite(path, map[path]);
				if (r && r.ok) { done++; } else { fails++; }
			});
			return { ok: fails === 0, message: "预设「" + (kind === "max" ? "全属性拉满" : "经典开局") + "」已写入 " + done + " 项" + (fails ? "，失败 " + fails + " 项" : "") };
		} catch (e) {
			return { ok: false, message: "预设执行异常：" + mbCEErr(e) };
		}
	}
	/* ============ v2.0.0.002 需求⑤：原版三档说话态度 + 选定后永久维持 ============
	   原版取证（DoL 0.5.12.13，逐字取自 Degrees of Lewdity.html，非二手转述）：
	   1) 三档控件 `<<widget "cheatsSpeechAttitude">>`（Cheats passage）：
	        <<set _submissiveness = [1500, 1000, 500]>>
	        <<set _attitude = ["meek", "neutral", "bratty"]>>
	        … <<set $speech_attitude to _attitude[_i]>><<<set $submissive to _submissiveness[_i]>>
	      ￼点一档 = 同时写 `$speech_attitude`（档名）与 `$submissive`（对应锚值）。
	   2) 门槛（`<<widget "attitudes">>`）：Meek 需 `$submissive gt 850`、Bratty 需 `$submissive lt 1150`；
	      ￼1500 / 1000 / 500 三锚值分别落在门槛内侧，所以只要锚值不漂移，三档都保持可选。
	   3) `$speech_attitude` 全库写入点仅 6 处（gameStartOnly / variablesVersionUpdate / Cheats /
	      Pinch Widgets（喵化）/ Scarlet Widgets），其余数百处只读 → 游戏本身不会自行改档。
	   旧实现（只把 `$submissive` 写进 851–1149 交集）按用户口径作废：那是"两档都能选"，不是"所选档永久维持"。
	   维持语义 = 每秒把 `$speech_attitude` 复位到所选档；同时把所选档的门槛锚值拉回门槛内侧
	   （Meek 不低于 851、Bratty 不高于 1149），原版设置页才会继续把该档显示为选中而不是灰掉。 */
	var MB_CE_ATTITUDE_TIERS = [
		{ key: "meek", label: "Meek（温顺）", anchor: 1500, gateMin: 851, gateMax: null, gateNote: "需顺从度 > 850" },
		{ key: "neutral", label: "Neutral（中性）", anchor: 1000, gateMin: null, gateMax: null, gateNote: "无门槛" },
		{ key: "bratty", label: "Bratty（叛逆）", anchor: 500, gateMin: null, gateMax: 1149, gateNote: "需顺从度 < 1150" }
	];
	/* 旧符号保留（09-exports2 与既有断言在引用）：区间判定仍按原版两条门槛取值 */
	var FSA_FREE_MIN = 851;
	var FSA_FREE_MAX = 1149;
	var FSA_FREE_MID = 1000;
	function mbCEAttitudeTier(key) {
		var i;
		for (i = 0; i < MB_CE_ATTITUDE_TIERS.length; i++) {
			if (MB_CE_ATTITUDE_TIERS[i].key === key) { return MB_CE_ATTITUDE_TIERS[i]; }
		}
		return null;
	}
	function readAttitude() {
		var V2 = getV();
		return (V2 && typeof V2.speech_attitude === "string") ? V2.speech_attitude : null;
	}
	function attitudeState(v) {
		var n = (typeof v === "number") ? v : null;
		return {
			value: n,
			sub: (n !== null && n > 850),
			resist: (n !== null && n < 1150),
			both: (n !== null && n > 850 && n < 1150)
		};
	}
	function mbCEAttitudeState() {
		var V = getV(), lock = V && V.mbCE_attitudeLock;
		var has = !!(lock && typeof lock === "object" && typeof lock.value === "string");
		return {
			attitude: (V && typeof V.speech_attitude === "string") ? V.speech_attitude : null,
			submissive: (V && typeof V.submissive === "number") ? V.submissive : null,
			lock: has ? lock : null,
			value: has ? lock.value : null,
			anchor: (has && typeof lock.anchor === "number") ? lock.anchor : null,
			hold: !!(has && lock.hold),
			fixed: (has && typeof lock.fixed === "number") ? lock.fixed : 0
		};
	}
	/* 选定档位：写 $speech_attitude + 锚值，并登记维持锁（prev 只在首次锁定时留，用于回退） */
	function mbCEAttitudeApply(key) {
		var t = mbCEAttitudeTier(key);
		if (!t) { return { ok: false, message: "未知态度档位：" + key }; }
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var cur = mbCEAttitudeState();
		var r1 = cheatWriteValue("player-self", "p:speech_attitude", "value_set", "speech_attitude", t.key, "string");
		if (!r1 || !r1.ok) { return r1 || { ok: false, message: "态度写入失败" }; }
		var r2 = cheatWriteValue("player-self", "p:submissive", "value_set", "submissive", t.anchor, "number", 0, 2000);
		if (!r2 || !r2.ok) { return r2 || { ok: false, message: "顺从度写入失败" }; }
		if (!cur.lock) {
			V.mbCE_attitudeLock = {
				prevAttitude: cur.attitude,
				prevSubmissive: cur.submissive,
				fixed: 0
			};
		}
		V.mbCE_attitudeLock.value = t.key;
		V.mbCE_attitudeLock.anchor = t.anchor;
		V.mbCE_attitudeLock.hold = true;
		mbCEAttitudeEnsureTimer();
		return { ok: true, message: "已选定「" + t.label + "」并开启永久维持（" + t.gateNote + "，锚值 " + t.anchor + "）" };
	}
	function mbCEAttitudeHold(on) {
		var st = mbCEAttitudeState();
		if (!st.lock) { return { ok: false, message: "尚未选定档位：请先在下方三档里选一个" }; }
		getV().mbCE_attitudeLock.hold = !!on;
		mbCEAttitudeEnsureTimer();
		return { ok: true, message: on ? "已开启维持：态度不会再被其它数值变化带偏" : "已暂停维持（当前档位不再被复位，但仍记录着你的选择）" };
	}
	/* 解除维持：清锁；restore=true 时把锁定前的 $speech_attitude / $submissive 还原 */
	function mbCEAttitudeRelease(restore) {
		var V = getV(), st = mbCEAttitudeState();
		if (!V || !st.lock) { return { ok: false, message: "当前没有锁定中的态度" }; }
		if (restore) {
			if (typeof st.lock.prevAttitude === "string") { V.speech_attitude = st.lock.prevAttitude; }
			if (typeof st.lock.prevSubmissive === "number") { V.submissive = st.lock.prevSubmissive; }
		}
		delete V.mbCE_attitudeLock;
		mbCEAttitudeEnsureTimer();
		return { ok: true, message: restore ? "已解除维持并还原锁定前的态度与顺从度" : "已解除维持（保留当前态度值）" };
	}
	/* 维持一轮：返回本轮修正动作数（0 = 无需修正） */
	function mbCEAttitudeTick() {
		try {
			var V = getV(), st = mbCEAttitudeState();
			if (!V || !st.lock || !st.hold) { return 0; }
			var t = mbCEAttitudeTier(st.value);
			if (!t) { return 0; }
			var fixed = 0;
			if (V.speech_attitude !== t.key) { V.speech_attitude = t.key; fixed++; }
			var sub = (typeof V.submissive === "number") ? V.submissive : 0;
			if (t.gateMin !== null && sub < t.gateMin) { V.submissive = t.gateMin; fixed++; }
			else if (t.gateMax !== null && sub > t.gateMax) { V.submissive = t.gateMax; fixed++; }
			if (fixed) { V.mbCE_attitudeLock.fixed = (st.fixed || 0) + fixed; }
			return fixed;
		} catch (e) { return 0; }
	}
	var mbCEAttitudeTimer = null;
	/* 状态行文本：渲染与 tick 共用，tick 只改这一段文字，不重渲染整页（避免打断用户输入） */
	function mbCEAttitudeStatusLine(st) {
		if (!st) { st = mbCEAttitudeState(); }
		return "在原版三档（Meek / Neutral / Bratty）里选一个后，CE 每秒把 $speech_attitude 复位到该档，"
			+ "并把顺从度拉回该档门槛内侧（Meek ≥851 / Bratty ≤1149），其它数值怎么变都不会把态度带偏。"
			+ "当前：态度 " + (st.attitude || "—") + "，顺从度 " + (st.submissive === null ? "—" : st.submissive)
			+ "；维持 " + (st.hold ? "开" : "关") + "，已修正 " + st.fixed + " 次。";
	}
	function mbCEAttitudeEnsureTimer() {
		try {
			var st = mbCEAttitudeState();
			var on = !!(st.lock && st.hold);
			if (on && !mbCEAttitudeTimer) {
				mbCEAttitudeTimer = setInterval(function () {
					try {
						var n = mbCEAttitudeTick();
						if (!n) { return; }
						var line = document.querySelector('[data-mce-att="1"]');
						if (line) { line.textContent = mbCEAttitudeStatusLine(); }
					} catch (e) { /* tick 失败静默，不打断游戏 */ }
				}, 1000);
			} else if (!on && mbCEAttitudeTimer) {
				clearInterval(mbCEAttitudeTimer); mbCEAttitudeTimer = null;
			}
		} catch (e) { /* 面板未就绪时静默 */ }
	}
	/* 兼容旧入口：字符串按档位名；数字按最近的锚值映射档位（旧版写区间的调用不会静默失效） */
	function applyAttitude(v) {
		if (typeof v === "string") { return mbCEAttitudeApply(v); }
		if (typeof v !== "number" || !isFinite(v)) { return { ok: false, message: "请输入数字或档位名（meek/neutral/bratty）" }; }
		var best = MB_CE_ATTITUDE_TIERS[0], i, d;
		for (i = 1; i < MB_CE_ATTITUDE_TIERS.length; i++) {
			d = Math.abs(MB_CE_ATTITUDE_TIERS[i].anchor - v);
			if (d < Math.abs(best.anchor - v)) { best = MB_CE_ATTITUDE_TIERS[i]; }
		}
		return mbCEAttitudeApply(best.key);
	}
	/* idx：区块编号。本函数只被快速页 renderQuickPanel 调用（05b-modcheat-player.js），原先写死 10 会显示成「⑩」错号；
	   现由调用方传入（快速页传 1）；缺省按「本页第 1 区块」处理 —— 不回落 10，避免任何复用方拿到全局页的错号（v2.0.3 修）。 */
	function renderAttitudeFree(pane, idx) {
		if (!pane) { return; }
		mbCEAttitudeEnsureTimer();
		var st = mbCEAttitudeState();
		var curTier = st.lock ? mbCEAttitudeTier(st.value) : null;
		var sec = mceNewSec(pane, (typeof idx === "number" && idx > 0) ? idx : 1, "说话态度", "原版三档（顺从 / 中立 / 反抗），选定后开启「维持」即每秒复位 $speech_attitude 并把顺从度拉回该档门槛内侧，永久维持；「解除维持」清除锁定但保留当前值，「解除并还原」恢复锁定前的态度与顺从度。");
		var hint = el("div", "mce-hint", mbCEAttitudeStatusLine(st));
		hint.setAttribute("data-mce-att", "1");
		sec.appendChild(hint);
		var g = mceBtnGrid(sec);
		MB_CE_ATTITUDE_TIERS.forEach(function (t) {
			var on = !!(curTier && curTier.key === t.key);
			var b = el("button", on ? "mce-btn mce-gold" : "mce-btn", (on ? "✓ " : "") + t.label);
			b.type = "button";
			b.title = t.gateNote + "；锚值 " + t.anchor;
			b.addEventListener("click", function () {
				var r = mbCEAttitudeApply(t.key);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
			});
			g.appendChild(b);
		});
		var ctl = mceBtnGrid(sec);
		var hold = el("button", st.hold ? "mce-btn mce-gold" : "mce-btn", st.hold ? "维持：开" : "维持：关");
		hold.type = "button";
		hold.title = "开启后每秒复位 $speech_attitude 到所选档，并把顺从度拉回该档门槛内侧";
		hold.addEventListener("click", function () {
			var r = mbCEAttitudeHold(!st.hold);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
		});
		var rel = el("button", "", "解除维持"); rel.type = "button";
		rel.title = "清除锁定（保留当前态度值）";
		rel.addEventListener("click", function () {
			var r = mbCEAttitudeRelease(false);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
		});
		var back = el("button", "", "解除并还原"); back.type = "button";
		back.title = "清除锁定，并把态度与顺从度恢复为首次锁定前的值";
		back.addEventListener("click", function () {
			var r = mbCEAttitudeRelease(true);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (typeof renderPlayerEdit === "function") { renderPlayerEdit(); }
		});
		ctl.appendChild(hold); ctl.appendChild(rel); ctl.appendChild(back);
	}
	/* 原版特质静态表（v1.8.0 自本体 traits widget 提取） */
var VANILLA_TRAITS_RAW = [
    {"cat":"General Traits","name":"Virgin","has":"$player.virginity.vaginal is true and $player.virginity.penile is true","text":"Your purity recovers faster. Your virginity might be worth something."},
  {"cat":"General Traits","name":"Chastity Vow","has":"$player.virginity.temple is true","text":"Lost when your penis/vagina is penetrated. The temple will know."},
  {"cat":"General Traits","name":"Broken Vow","has":"$player.virginity.temple isnot true and $temple_rank isnot \"prospective\" and $temple_rank isnot undefined","text":"The temple will know."},
  {"cat":"General Traits","name":"Rite of Promise: $templePromised","has":"$templePromised isnot \"\" and $player.virginity.temple is true","text":"You've been bound to another member of the temple."},
  {"cat":"General Traits","name":"Broken Promise: $templePromised","has":"$templePromised isnot \"\" and $player.virginity.temple isnot true","text":"The temple will know."},
  {"cat":"General Traits","name":"Temple Burden: $temple_burden%","has":"$temple_burden gte 1","text":"You are carrying part of the world's corruption within yourself."},
  {"cat":"General Traits","name":"Purity Boost","has":"$featsPurityBoost gt 0","text":"You are gaining purity daily."},
  {"cat":"General Traits","name":"Impurity Boost","has":"$featsPurityBoost lt 0","text":"You are losing purity daily."},
  {"cat":"General Traits","name":"Crossdresser","has":"$backgroundTraits.includes(\"crossdresser\")","text":"Stress decays faster when you look like the opposite gender."},
  {"cat":"General Traits","name":"Lustful","has":"$backgroundTraits.includes(\"lustful\")","text":"Arousal increases over time and needs to be managed."},
  {"cat":"General Traits","name":"Green Thumb","has":"$backgroundTraits.includes(\"greenthumb\")","text":"More bountiful crops and no decay when using fertiliser."},
  {"cat":"General Traits","name":"Dendrophile／Plant Lover","has":"$backgroundTraits.includes(\"plantlover\")","text":"Plants are everything to you."},
  {"cat":"General Traits","name":"Nectar Addict","has":"$backgroundTraits.includes(\"plantlover\")","text":"You're more vulnerable to aphrodisiacs and alcohol."},
  {"cat":"General Traits","name":"Ear slime focus: $earSlime.focus","has":"$earSlime.focus and $earSlime.focus isnot \"none\"","text":"You chose a path for the ear slime."},
  {"cat":"General Traits","name":"Pregnant","has":"playerIsPregnant() and playerAwareTheyArePregnant()","text":"You are with child."},
  {"cat":"General Traits","name":"First Time Mother","has":"playerNormalPregnancyTotal() is 1","text":"You have given birth to your first child."},
  {"cat":"General Traits","name":"Second Time Mother","has":"playerNormalPregnancyTotal() is 2","text":"You have given birth to children two times now."},
  {"cat":"General Traits","name":"Mother","has":"between(playerNormalPregnancyTotal(), 3, 7)","text":"You have some good experiences of being a mother."},
  {"cat":"General Traits","name":"Broodmother","has":"between(playerNormalPregnancyTotal(), 8, 19)","text":"You have given birth to many, many children."},
  {"cat":"General Traits","name":"Gaia","has":"playerNormalPregnancyTotal() gte 20","text":"You have given birth to a veritable dynasty of children."},
  {"cat":"General Traits","name":"Parasite Broodmother","has":"$sexStats.anus.pregnancy.motherStatus is 2 or $sexStats.vagina.pregnancy.motherStatus is 2","text":"You've become host to an endless number of little critters."},
  {"cat":"General Traits","name":"Parasite Mother","has":"($sexStats.anus.pregnancy.motherStatus is 1 or $sexStats.vagina.pregnancy.motherStatus is 1) and !($sexStats.anus.pregnancy.motherStatus is 2 or $sexStats.vagina.pregnancy.motherStatus is 2)","text":"You have given birth to little critters."},
  {"cat":"General Traits","name":"Lactating","has":"$lactating gte 1 and $settings.breastFeedingEnabled","text":"Your breasts are ready to be milked."},
  {"cat":"General Traits","name":"Milk Factory","has":"$lactating gte 1 and $settings.breastFeedingEnabled and $milk_volume gte 1000","text":"Your breasts are able to hold a tremendous amount of milk."},
  {"cat":"General Traits","name":"Sperm Bank","has":"$semen_volume gte 1000 and $player.penisExist","text":"You carry a tremendous amount of semen."},
  {"cat":"General Traits","name":"Possessed","has":"$possessed","text":"Your body is not your own."},
  {"cat":"General Traits","name":"Wolf","has":"$wolfgirl gte 6","text":"The spirit of the wild lives within you."},
  {"cat":"General Traits","name":"Cat","has":"$cat gte 6","text":"You have an urge to lap up cream."},
  {"cat":"General Traits","name":"Bull／Cow","has":"$cow gte 6","text":"You yearn to be milked."},
  {"cat":"General Traits","name":"Harpy／Bird","has":"$harpy gte 6","text":"The skies call."},
  {"cat":"General Traits","name":"Fox／Vixen","has":"$fox gte 6","text":"You have the urge to keep what's not yours."},
  {"cat":"General Traits","name":"Fangs","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.fangs)","text":"Biting is twice as effective."},
  {"cat":"General Traits","name":"Sharp Eyes","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.sharpEyes)","text":"Little escapes your notice. +5% skulduggery."},
  {"cat":"General Traits","name":"Heterochromia","has":"$heterochromia is 1","text":"Your eyes are two different colours."},
  {"cat":"General Traits","name":"Sturdy Horns","has":"$cow gte 2 and $demon lt 2","text":"Headbutts no longer hurt you."},
  {"cat":"General Traits","name":"Mate For Life","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.mateForLife)","text":"Gain bonuses when sleeping or copulating with your Love Interest."},
  {"cat":"General Traits","name":"Thrill of the Chase","has":"![\"disabled\", \"hidden\"].includes($transformationParts.traits.chase)","text":"Gain a bonus to athletics and unlocks the ambush action."},
  {"cat":"General Traits","name":"Fallen Angel","has":"$fallenangel gte 4","text":"The world is so cruel. Unlocks the disparage action."},
  {"cat":"General Traits","name":"Iron Will","has":"$fallenangel is 4","text":"Willpower no longer decays."},
  {"cat":"General Traits","name":"Angel","has":"$angel gte 6","text":"You radiate purity. Unlocks the forgive action."},
  {"cat":"General Traits","name":"Incubus／Succubus","has":"$demon gte 6","text":"You're devoid of purity."},
  {"cat":"General Traits","name":"Radiant","has":"$angel gte 4","text":"You are pure. Unlocks the banish action."},
  {"cat":"General Traits","name":"Dark Horns","has":"$cow lt 2 and $demon gte 2","text":"Headbutts deal twice as much damage."},
  {"cat":"General Traits","name":"Compound Horns","has":"$cow gte 2 and $demon gte 2","text":"Your headbutts are vicious."},
  {"cat":"General Traits","name":"Strong Wings／Thoroughly Preened Wings","has":"$harpy gte 6 and $birdFly gte 1","text":"Can glide from high locations. Can fly where the wind is willing."},
  {"cat":"General Traits","name":"Wings","has":"!($harpy gte 6 and $birdFly gte 1) and ($angel gte 6 or $fallenangel gte 2 or $demon gte 6 or $harpy gte 6)","text":"Can glide from high locations."},
  {"cat":"General Traits","name":"Meek","has":"$submissive gte 1150 and $submissive lt 1500","text":"Unlocks the Moan action."},
  {"cat":"General Traits","name":"Submissive","has":"$submissive gte 1500","text":"Unlocks the Moan action."},
  {"cat":"General Traits","name":"Bratty","has":"$submissive lte 850 and $submissive gt 500","text":"Unlocks the Demand action."},
  {"cat":"General Traits","name":"Defiant","has":"$submissive lte 500","text":"Unlocks the Demand action."},
  {"cat":"General Traits","name":"Innocent","has":"$innocencestate is 1","text":"You're flattered that so many people want to spend time with you."},
  {"cat":"General Traits","name":"Guilty Masochist","has":"$masochism_level is 1","text":"Provides a small resistance to most sources of pain."},
  {"cat":"General Traits","name":"Masochist","has":"$masochism_level is 2","text":"Provides resistance to most sources of pain."},
  {"cat":"General Traits","name":"Hardened Masochist","has":"$masochism_level is 3","text":"Provides strong resistance to most sources of pain."},
  {"cat":"General Traits","name":"Drooling Masochist","has":"$masochism_level is 4","text":"Provides incredible resistance to most sources of pain."},
  {"cat":"General Traits","name":"Guilty Sadist","has":"$sadism_level is 1","text":"Your defiant acts inflict a little more pain."},
  {"cat":"General Traits","name":"Sadist","has":"$sadism_level is 2","text":"Your defiant acts inflict more pain."},
  {"cat":"General Traits","name":"Hardened Sadist","has":"$sadism_level is 3","text":"Your defiant acts inflict much more pain."},
  {"cat":"General Traits","name":"Vengeful Sadist","has":"$sadism_level is 4","text":"Your defiant acts are far more dangerous."},
  {"cat":"General Traits","name":"Farmer","has":"$farm_stage gte 6","text":"You know your way around a barn."},
  {"cat":"General Traits","name":"Knowledge: Islander language","has":"$islander_language gte 100","text":"You can understand and speak the tongue of the islanders."},
  {"cat":"General Traits","name":"Knowledge: Quicksand","has":"$quicksand gte 5","text":"You know how to react when stuck in the stuff."},
  {"cat":"General Traits","name":"Ancient Arts","has":"$hc?.wraith","text":"You've learned techniques lost to the past."},
  {"cat":"General Traits","name":"Mirror Madness","has":"$asylum_mirror gte 5","text":"Looking in a mirror lowers awareness and trauma once a day."},
  {"cat":"General Traits","name":"Eyes in the Night","has":"$asylum_tunnels gte 6","text":"Lower allure in the forest at night."},
  {"cat":"Medicinal Traits","name":"Hair Growth Formula","has":"_pills and _pills[\"Hair Growth Formula\"] and _pills[\"Hair Growth Formula\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\treturn `A hair growth formula has been applied, to encourage faster hair growth. ${_pills[\"Hair Growth Formula\"].doseTaken} day${_pills[\"Hair Growth Formula\"].dose"},
  {"cat":"Medicinal Traits","name":"Anti-Parasite Cream","has":"_pills and _pills[\"Anti-Parasite Cream\"] and _pills[\"Anti-Parasite Cream\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\treturn `A parasite-repelling cream, preventing further internal parasite impregnation. ${_pills[\"Anti-Parasite Cream\"].doseTaken} day${_pills[\"Anti-Parasite Cream\""},
  {"cat":"Medicinal Traits","name":"Fertility booster","has":"_pills and _pills[\"fertility booster\"] and _pills[\"fertility booster\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"fertility booster\"].doseTaken gte 2 ? \"overdosed on pills\" : \"taken a pill\"} that `;\n\t\t\t\t\t\tlet multiple = false;\n\t\t\t\t\t\tlet hasEffe"},
  {"cat":"Medicinal Traits","name":"Contraceptive","has":"_pills and _pills[\"contraceptive\"] and _pills[\"contraceptive\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"contraceptive\"].doseTaken gte 2 ? \"overdosed on pills\" : \"taken a pill\"} that `;\n\t\t\t\t\t\tlet multiple = false;\n\t\t\t\t\t\tlet hasEffect ="},
  {"cat":"Medicinal Traits","name":"Penis blocker pills","has":"_pills and _pills[\"penis blocker\"] and _pills[\"penis blocker\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have taken a pill that`;\n\t\t\t\t\t\tif ($player.penisExist) {\n\t\t\t\t\t\t\tresult += \" prevents the re-sizing of your penis.\";\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tresult "},
  {"cat":"Medicinal Traits","name":"Penis growth pills","has":"_pills and _pills[\"penis growth\"] and _pills[\"penis growth\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"penis growth\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} pills that `;\n\t\t\t\t\t\tif ($player.penisExist) {\n\t\t\t\t\t\t\tresult += \" encour"},
  {"cat":"Medicinal Traits","name":"Penis reduction pills","has":"_pills and _pills[\"penis reduction\"] and _pills[\"penis reduction\"].doseTaken","text":"() =&gt; {\n\t\t\t\t\t\tlet result = `You have ${_pills[\"penis reduction\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} pills that `;\n\t\t\t\t\t\tif ($player.penisExist) {\n\t\t\t\t\t\t\tresult += \" enc"},
  {"cat":"Medicinal Traits","name":"Breast blocker pills","has":"_pills and _pills[\"breast blocker\"] and _pills[\"breast blocker\"].doseTaken","text":"\"You have taken a pill that prevents the re-sizing of your breasts.\""},
  {"cat":"Medicinal Traits","name":"Breast growth pills","has":"_pills and _pills[\"breast growth\"] and _pills[\"breast growth\"].doseTaken","text":"`You have ${_pills and _pills[\"breast growth\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the growth of your breasts.`"},
  {"cat":"Medicinal Traits","name":"Breast reduction pills","has":"_pills and _pills[\"breast reduction\"] and _pills[\"breast reduction\"].doseTaken","text":"`You have ${_pills and _pills[\"breast reduction\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the shrinking of your breasts.`"},
  {"cat":"Medicinal Traits","name":"Bottom blocker pills","has":"_pills and _pills[\"bottom blocker\"] and _pills[\"bottom blocker\"].doseTaken","text":"\"You have taken a pill that prevents the re-sizing of your bottom.\""},
  {"cat":"Medicinal Traits","name":"Bottom growth pills","has":"_pills and _pills[\"bottom growth\"] and _pills[\"bottom growth\"].doseTaken","text":"`You have ${_pills and _pills[\"bottom growth\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the growth of your bottom.`"},
  {"cat":"Medicinal Traits","name":"Bottom reduction pills","has":"_pills and _pills[\"bottom reduction\"] and _pills[\"bottom reduction\"].doseTaken","text":"`You have ${_pills and _pills[\"bottom reduction\"].doseTaken gte 2 ? \"overdosed on\" : \"taken\"} a pill that encourages the shrinking of your bottom.`"},
  {"cat":"Special Traits","name":"Hedonist／Orgasm Addict","has":"$orgasmtrait gte 1","text":"\"The number of orgasms you have had has left a lasting physiological effect. Climaxing is more difficult but pleasurable orgasms relieve more stress and painful orgasms no longer i"},
  {"cat":"Special Traits","name":"Asphyxiophilia","has":"$choketrait gte 1","text":"\"You've come to love the feeling of lack of oxygen. Getting choked makes sex more pleasurable.\""},
  {"cat":"Special Traits","name":"Cumoisseur／Cum Dump","has":"$ejactrait gte 1","text":"\"You've become accustomed to the scent of ejaculate and can take advantage of its calming effect. Your stress is reduced hourly depending on how much slime and semen covers you.\""},
  {"cat":"Special Traits","name":"Graceful／Plaything","has":"$molesttrait gte 1","text":"\"You've learned to better cope with psychological trauma. Being molested no longer removes your sense of control (rape still does).\""},
  {"cat":"Special Traits","name":"Survivor／Fucktoy","has":"$rapetrait gte 1","text":"\"You've been raped so much that you've learned how to cope. Trauma increases more slowly.\""},
  {"cat":"Special Traits","name":"Tamer／Bitch","has":"$bestialitytrait gte 1","text":"\"Animals have tried to &lt;&lt;if $settings.pregnancySpeechEnabled&gt;&gt;breed&lt;&lt;else&gt;&gt;mate&lt;&lt;/if&gt;&gt; with you so often that you're used to it. Trauma increase"},
  {"cat":"Special Traits","name":"Witch／Prey","has":"$tentacletrait gte 1","text":"\"Many tentacles have had their way with your body. Trauma increases more slowly when attacked by tentacles.\""},
  {"cat":"Special Traits","name":"Daredevil／Tasty","has":"$voretrait gte 1","text":"\"You've found your way into the belly of many a creature. They'll have a harder time swallowing you as they savour your taste.\""},
  {"cat":"Special Traits","name":"Milk Enthusiast／Milk Addict","has":"$milkdranktrait gte 1","text":"\"You take full advantage of the nutrition in fresh breast milk. Drinking it invigorates your body, improving physique.\""},
  {"cat":"School Traits","name":"Passable Science","has":"$sciencetrait is 1","text":"\"Pain is slightly easier to cope with.\""},
  {"cat":"School Traits","name":"Decent Science","has":"$sciencetrait is 2","text":"\"Pain is moderately easier to cope with.\""},
  {"cat":"School Traits","name":"Good Science","has":"$sciencetrait is 3","text":"\"Pain is easier to cope with.\""},
  {"cat":"School Traits","name":"Excellent Science","has":"$sciencetrait is 4","text":"\"Pain is much easier to cope with.\""},
  {"cat":"School Traits","name":"Passable Maths","has":"$mathstrait is 1","text":"\"You make 25% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Decent Maths","has":"$mathstrait is 2","text":"\"You make 50% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Good Maths","has":"$mathstrait is 3","text":"\"You make 75% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Excellent Maths","has":"$mathstrait is 4","text":"\"You make 100% more from tips and negotiated fees.\""},
  {"cat":"School Traits","name":"Passable English","has":"$englishtrait is 1","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are twice as effective.\""},
  {"cat":"School Traits","name":"Decent English","has":"$englishtrait is 2","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are three times as effective.\""},
  {"cat":"School Traits","name":"Good English","has":"$englishtrait is 3","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are four times as effective.\""},
  {"cat":"School Traits","name":"Excellent English","has":"$englishtrait is 4","text":"\"Speech actions (plead, moan, demand, apologise, mock, tease, ask to be more rough) are five times as effective.\""},
  {"cat":"School Traits","name":"Passable History","has":"$historytrait is 1","text":"\"You know there are secret paths around town.\""},
  {"cat":"School Traits","name":"Decent History","has":"$historytrait is 2","text":"\"You know of a few secret paths around town.\""},
  {"cat":"School Traits","name":"Good History","has":"$historytrait is 3","text":"\"You know of several secret paths around town.\""},
  {"cat":"School Traits","name":"Excellent History","has":"$historytrait is 4","text":"\"You know of many secret paths around town.\""},
  {"cat":"School Traits","name":"Okay at school","has":"$schooltrait is 1","text":"\"Your performance at school has improved your self-esteem, slightly increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Decent at school","has":"$schooltrait is 2","text":"\"Your performance at school has improved your self-esteem, moderately increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Good at school","has":"$schooltrait is 3","text":"\"Your performance at school has improved your self-esteem, increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Excellent at school","has":"$schooltrait is 4","text":"\"Your performance at school has improved your self-esteem, greatly increasing your daily trauma decay.\""},
  {"cat":"School Traits","name":"Science Fair Winner","has":"$scienceprojectwon is 1","text":"\"You have been publicly recognised for your detailed and informative science project.\""},
  {"cat":"School Traits","name":"Maths Competition Winner","has":"$mathsprojectwon is 1","text":"\"You have been publicly recognised for your insightful solution to such a challenging mathematics problem.\""},
  {"cat":"School Traits","name":"Stage Play Performer","has":"$englishPlayWell is 1","text":"\"Your star performance during the student stage play elevated the production to great heights and much acclaim.\""},
  {"cat":"Trauma Traits","name":"Suppressed Insomnia／Insomnia／Controlled Insomnia","has":"$sleeptrouble gte 1","text":"\"Sleep less effective.\""},
  {"cat":"Trauma Traits","name":"Nightmares／Controlled Nightmares","has":"$nightmares gte 1","text":"\"Sleep is stressful.\""},
  {"cat":"Trauma Traits","name":"Anxiety Disorder／Controlled Anxiety Disorder","has":"$anxiety gte 1","text":"\"Stress won't automatically decrease over time.\""},
  {"cat":"Trauma Traits","name":"Severe Anxiety Disorder／Controlled Severe Anxiety Disorder","has":"$anxiety gte 2","text":"\"Stress increases over time.\""},
  {"cat":"Trauma Traits","name":"Flashbacks／Controlled Flashbacks","has":"$flashbacks gte 1","text":"\"May relive nasty experiences.\""},
  {"cat":"Trauma Traits","name":"Panic Attacks／Controlled Panic Attacks","has":"$panicattacks gte 1","text":"\"Chance of paralysis.\""},
  {"cat":"Trauma Traits","name":"Severe Panic Attacks／Controlled Severe Panic Attacks","has":"$panicattacks gte 2","text":"\"Chance of uncontrollable violent outbursts.\""},
  {"cat":"Trauma Traits","name":"Hallucinations／Controlled Hallucinations","has":"$hallucinations gte 1","text":"\"More dangers during encounters.\""},
  {"cat":"Trauma Traits","name":"Severe Hallucinations／Controlled Severe Hallucinations","has":"$hallucinations gte 2","text":"\"More dangerous world.\""},
  {"cat":"Trauma Traits","name":"Visibly Disturbed","has":"$dissociation gte 1","text":"\"There's something wrong with you, and people can tell.\""},
  {"cat":"Trauma Traits","name":"Dissociation／Controlled Dissociation","has":"$dissociation gte 2","text":"\"Nothing feels real.\""},
  {"cat":"NPC Traits","name":"Robin's Protector","has":"$robinpaid gte 1","text":"\"Robin is dependent on you. You need to be strong. Increases daily trauma decay.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Eden","has":"$syndromeeden gte 1","text":"\"It must be lonely living on your own in the woods.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Kylar","has":"$syndromekylar gte 1 and (C.npc.Kylar.state isnot \"prison\" or $location is \"prison\")","text":"\"Everyone deserves a friend.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Wolves／Stockholm Syndrome: Wolf People","has":"$syndromewolves gte 1","text":"() =&gt; V.settings.bestialityEnabled ? \"They're just cute animals.\" : \"They're just cute monsters.\""},
  {"cat":"NPC Traits","name":"Stockholm Syndrome: Great Hawk","has":"$syndromebird gte 1","text":"() =&gt; V.greathawkmonster === 2 || !V.settings.bestialityEnabled ? \"&lt;&lt;nnpc_He 'Great Hawk'&gt;&gt; only wants a mate.\" : \"It only wants a mate.\""},
  {"cat":"NPC Traits","name":"Avery's Saviour","has":"$avery_fate is \"saved\"","text":"\"You saved Avery's life. Rage decreases daily.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Suggestion","has":"$hypnosis_traits.suggestion is 1","text":"\"Doctor Harper told you to do something, but it's a bit hazy.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Suggestion","has":"$hypnosis_traits.suggestion is 2","text":"\"Doctor Harper told you to do something, but you have trouble remembering what.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Suggestion","has":"$hypnosis_traits.suggestion is 3","text":"\"Doctor Harper told you to do something, but you can't remember what.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Suggestion","has":"$hypnosis_traits.suggestion is 4","text":"\"Doctor Harper told you to do something, but your mind is blank.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Suggestion","has":"$hypnosis_traits.suggestion is 5","text":"\"Doctor Harper told you to do something, but you can't remember anything at all.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Yearning","has":"$hypnosis_traits.scream is 1","text":"\"May beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Yearning","has":"$hypnosis_traits.scream is 2","text":"\"Will sometimes beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Yearning","has":"$hypnosis_traits.scream is 3","text":"\"Will usually beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Yearning","has":"$hypnosis_traits.scream is 4","text":"\"Will often beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Yearning","has":"$hypnosis_traits.scream is 5","text":"\"Will beg for rougher treatment instead of screaming.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Flaunting","has":"$hypnosis_traits.cover is 1","text":"\"May flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Flaunting","has":"$hypnosis_traits.cover is 2","text":"\"Will sometimes flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Flaunting","has":"$hypnosis_traits.cover is 3","text":"\"Will usually flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Flaunting","has":"$hypnosis_traits.cover is 4","text":"\"Will often flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Flaunting","has":"$hypnosis_traits.cover is 5","text":"\"Will flaunt your body parts instead of covering them.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Deviancy","has":"$hypnosis_traits.deviancy is 1","text":"\"May provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched Deviancy","has":"$hypnosis_traits.deviancy is 2","text":"\"Will sometimes provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Beguiled Deviancy","has":"$hypnosis_traits.deviancy is 3","text":"\"Will usually provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Mesmeric Deviancy","has":"$hypnosis_traits.deviancy is 4","text":"\"Will often provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Sublime Deviancy","has":"$hypnosis_traits.deviancy is 5","text":"\"Will provoke beasts at the start of encounters.\""},
  {"cat":"Hypnosis Traits","name":"Bewitched","has":"$hc?.bewitched","text":"\"Your Angel.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Hypnotic Devotion／Hypnotic Curiosity","has":"V.hypnosis_traits.devotion === 1","text":"\"You find your mind wandering to the forest every now and then. Gwylan's requests feel strangely compelling.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Bewitched Devotion／Bewitched Curiosity","has":"V.hypnosis_traits.devotion === 2","text":"\"Gwylan's presence makes you feel safe. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are hard to resist. Beneficial hypnosis traits last longer.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Beguiled Devotion／Beguiled Curiosity","has":"V.hypnosis_traits.devotion === 3","text":"\"Gwylan's presence is comforting. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are harder to resist. Beneficial hypnosis traits last longer. School grades do not decay.\""},
  {"cat":"Hypnosis Traits","name":"familiar collar／Mesmeric Devotion／Mesmeric Curiosity","has":"V.hypnosis_traits.devotion === 4","text":"\"Gwylan's presence makes you feel warm. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are even harder to resist. Anyone else's attempts to hypnotise you might fail. Beneficial hypnosi"},
  {"cat":"Hypnosis Traits","name":"familiar collar／Sublime Devotion／Sublime Curiosity","has":"V.hypnosis_traits.devotion === 5","text":"\"Gwylan makes you feel whole. &lt;&lt;nnpc_His 'Gwylan'&gt;&gt; requests are &lt;span class='red'&gt;impossible&lt;/span&gt; to resist. Anyone else's attempts to hypnotise you will"},
  {"cat":"Hypnosis Traits","name":"familiar collar／Frenzied Devotion／Frenzied Curiosity","has":"V.hypnosis_traits.devotion &gt;= 6","text":"\"???\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Peace","has":"V.hypnosis_traits.peace gte 1","text":"\"You are at peace with your inner self. Hiding transformation parts no longer inflicts trauma.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Silence","has":"V.hypnosis_traits.silence gte 1","text":"\"Your thoughts are solitary and tranquil. Ear slimes are temporarily silenced.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Slumber","has":"V.hypnosis_traits.slumber gte 1","text":"\"Sleep is more restful when traumatised, and the 'insomnia' trait is suppressed, if present.\""},
  {"cat":"Hypnosis Traits","name":"Hypnotic Ignorance／Hypnotic Insight","has":"V.hypnosis_traits.insight gte 1","text":"\"High awareness no longer causes hallucinations. Low awareness causes hallucinations instead.\""},
  {"cat":"Acceptance Traits","name":"() =&gt; {\n\t\t\t\t\t\tconst penisSize = setup.penisSizes[$player.penissize].toUpperFirst();\n\t\t\t\t\t\treturn `Acceptance: ${penisSize} Penis`;\n\t\t\t\t\t}","has":"$acceptance_penis_small gte 1000 and $player.penissize lte 3","text":"\"You're proud of your small penis.\""},
  {"cat":"Acceptance Traits","name":"Acceptance: Tomgirl","has":"$acceptance_tomgirl gte 100 and $acceptance_penis_small gte 1000 and $player.penissize lte 2","text":"\"You're proud of becoming a tomgirl.\""},
  {"cat":"Acceptance Traits","name":"() =&gt; {\n\t\t\t\t\t\tconst penisSize = setup.penisSizes[$player.penissize].toUpperFirst();\n\t\t\t\t\t\treturn `Acceptance: ${penisSize} Penis`;\n\t\t\t\t\t}","has":"$acceptance_penis_big gte 1000 and $player.penissize gte 6","text":"\"You're proud of your enormous penis.\""},
  {"cat":"Acceptance Traits","name":"Acceptance: Flat Chest","has":"$acceptance_breasts_tiny gte 1000 and $player.breastsize lte 0 and $player.sex is \"f\"","text":"\"You're proud of your flat chest.\""},
  {"cat":"Acceptance Traits","name":" Breasts／Flat Chest","has":"$acceptance_breasts_small gte 1000 and between($player.breastsize","text":"\"You're proud of your small breasts.\""},
  {"cat":"Acceptance Traits","name":"() =&gt; {\n\t\t\t\t\t\tconst breastSize = setup.breastsizes[$player.breastsize].toUpperFirst();\n\t\t\t\t\t\treturn `Acceptance: ${breastSize} Breasts`;\n\t\t\t\t\t}","has":"$acceptance_breasts_big gte 1000 and $player.breastsize gte 8","text":"\"You're proud of your huge breasts.\""},
  {"cat":"Acceptance Traits","name":"Acceptance: Pregnant Belly／Acceptance: Pregnant Looking Belly","has":"$acceptance_pregnancy gte 1000 and playerBellySize() gte 8","text":"() =&gt; playerAwareTheyArePregnant() ? \"You're proud of your lifebearing belly.\" : \"You're proud of your large belly.\""},
  {"cat":"???","name":"Elk-scarred","has":"$auriga_scar is 1","text":"\"An invisible wound hangs over your heart. Trauma and awareness increase over time. Purity decreases over time.\""},
  {"cat":"???","name":"Elk-marked","has":"$auriga_scar is 2","text":"\"A crackling wound surrounds your heart. You're harder to notice, and to recognise as human.\""},
  {"cat":"???","name":"Elk-bitten","has":"$auriga_scar is 3","text":"\"A hole threatens to swallow your black heart. Something seeks to escape.\""},
  {"cat":"???","name":"Elk-ruptured","has":"$auriga_scar is 4","text":"\"A rupture severs your black, unbeating heart. Damnation is imminent.\""},
  {"cat":"???","name":"Elk-spawned","has":"$auriga_scar gte 5","text":"\"Damnation.\""},
];

/* ============ v1.8.0 特质管理（替代 v1.7.0 玩家属性/模组属性区）
   数据源：① VANILLA_TRAITS_RAW（本体 traits widget 提取：cat/name/has）
          ② discoverModTraits()（maplebirch.temporary.traitLists 运行时注入的模组特质，装了显示、没装隐藏）
   能力：拥有判定（has 表达式求值）／ 获取+移除（has 全部条件变量写满足，主变量写回不满足）／ 数值可改（数值比较变量）
   ============ */
var curPlayerFilter = "";
var TRAIT_ZH_CAT = {
	"General Traits": "一般特质", "Medicinal Traits": "药物特质", "Special Traits": "特殊特质",
	"School Traits": "学校特质", "Trauma Traits": "创伤特质", "NPC Traits": "NPC特质",
	"Hypnosis Traits": "催眠特质", "Acceptance Traits": "接纳特质", "???": "麋鹿印记"
};
var TRAIT_ZH = {
	"Virgin": "童贞", "Chastity Vow": "贞洁誓言", "Broken Vow": "破誓",
	"Rite of Promise": "承诺仪式", "Broken Promise": "破碎的承诺", "Temple Burden": "神殿之担",
	"Purity Boost": "纯洁增幅", "Impurity Boost": "污秽增幅", "Crossdresser": "异装癖",
	"Lustful": "色情脑", "Green Thumb": "园艺大师", "Dendrophile": "植物恋人",
	"Plant Lover": "植物爱好者", "Nectar Addict": "花蜜上瘾", "Hair Growth Formula": "生发配方",
	"Anti-Parasite Cream": "抗寄生虫霜", "Fertility booster": "生育促进剂", "Contraceptive": "避孕药",
	"Penis blocker pills": "阴茎阻断药", "Penis growth pills": "阴茎增大药", "Penis reduction pills": "阴茎缩小药",
	"Breast blocker pills": "胸部阻断药", "Breast growth pills": "胸部增大药", "Breast reduction pills": "胸部缩小药",
	"Bottom blocker pills": "臀部阻断药", "Bottom growth pills": "臀部增大药", "Bottom reduction pills": "臀部缩小药",
	"Hedonist": "享乐主义者", "Orgasm Addict": "高潮成瘾", "Asphyxiophilia": "窒息癖",
	"Cumoisseur": "精液鉴赏家", "Cum Dump": "精液容器", "Graceful": "优雅", "Plaything": "玩物",
	"Survivor": "幸存者", "Fucktoy": "性玩具", "Tamer": "驯兽师", "Bitch": "母狗",
	"Witch": "女巫", "Prey": "猎物", "Daredevil": "胆大妄为", "Tasty": "美味",
	"Milk Enthusiast": "乳汁爱好者", "Milk Addict": "乳汁成瘾",
	"Passable Science": "及格的科学成绩", "Decent Science": "尚可的科学成绩", "Good Science": "良好的科学成绩", "Excellent Science": "优异的科学成绩",
	"Passable Maths": "及格的数学成绩", "Decent Maths": "尚可的数学成绩", "Good Maths": "良好的数学成绩", "Excellent Maths": "优异的数学成绩",
	"Passable English": "及格的语文成绩", "Decent English": "尚可的语文成绩", "Good English": "良好的语文成绩", "Excellent English": "优异的语文成绩",
	"Passable History": "及格的历史成绩", "Decent History": "尚可的历史成绩", "Good History": "良好的历史成绩", "Excellent History": "优异的历史成绩",
	"Okay at school": "在校表现尚可", "Decent at school": "在校表现不错", "Good at school": "在校表现良好", "Excellent at school": "在校表现优秀",
	"Science Fair Winner": "科学博览会冠军", "Maths Competition Winner": "数学竞赛冠军", "Stage Play Performer": "舞台剧演员",
	"Suppressed Insomnia": "被压制的失眠", "Nightmares": "噩梦", "Controlled Nightmares": "受控的噩梦",
	"Anxiety Disorder": "焦虑症", "Controlled Anxiety": "受控的焦虑", "Controlled Anxiety Disorder": "受控的焦虑症",
	"Severe Anxiety Disorder": "严重焦虑症", "Controlled Severe Anxiety Disorder": "受控的严重焦虑症",
	"Controlled Severe Anxiety": "受控的严重焦虑", "Flashbacks": "闪回", "Controlled Flashbacks": "受控的闪回",
	"Panic Attacks": "惊恐发作", "Controlled Panic Attacks": "受控的惊恐发作", "Severe Panic Attacks": "严重惊恐发作",
	"Controlled Severe Panic": "受控的严重惊恐", "Controlled Severe Panic Attacks": "受控的严重惊恐发作",
	"Hallucinations": "幻觉", "Controlled Hallucinations": "受控的幻觉",
	"Severe Hallucinations": "严重幻觉", "Controlled Severe Hallucinations": "受控的严重幻觉",
	"Visibly Disturbed": "明显不安", "Dissociation": "解离", "Controlled Dissociation": "受控的解离",
	"Robin's Protector": "同舟共济：罗宾", "Stockholm Syndrome: Eden": "斯德哥尔摩综合征：伊甸",
	"Stockholm Syndrome: Kylar": "斯德哥尔摩综合征：凯拉尔", "Stockholm Syndrome: Wolves": "斯德哥尔摩综合征：狼群",
	"Stockholm Syndrome: Wolf People": "斯德哥尔摩综合征：狼人", "Stockholm Syndrome: Great Hawk": "斯德哥尔摩综合征：大鹰",
	"Avery's Saviour": "艾弗利的救星",
	"Hypnotic Suggestion": "催眠暗示", "Bewitched Suggestion": "蛊惑暗示", "Beguiled Suggestion": "迷惑暗示",
	"Mesmeric Suggestion": "催眠师暗示", "Sublime Suggestion": "崇高暗示",
	"Hypnotic Yearning": "催眠渴望", "Bewitched Yearning": "蛊惑渴望", "Beguiled Yearning": "迷惑渴望",
	"Mesmeric Yearning": "催眠师渴望", "Sublime Yearning": "崇高渴望",
	"Hypnotic Flaunting": "催眠炫耀", "Bewitched Flaunting": "蛊惑炫耀", "Beguiled Flaunting": "迷惑炫耀",
	"Mesmeric Flaunting": "催眠师炫耀", "Sublime Flaunting": "崇高炫耀",
	"Hypnotic Deviancy": "催眠异变", "Bewitched Deviancy": "蛊惑异变", "Beguiled Deviancy": "迷惑异变",
	"Mesmeric Deviancy": "催眠师异变", "Sublime Deviancy": "崇高异变",
	"Bewitched": "被蛊惑", "Hypnotic Peace": "催眠平静", "Hypnotic Silence": "催眠沉默",
	"Hypnotic Slumber": "催眠沉睡", "Hypnotic Ignorance": "催眠无知", "Hypnotic Insight": "催眠洞察",
	"Hypnotic Devotion": "催眠虔信", "Bewitched Devotion": "蛊惑虔信", "Beguiled Devotion": "迷惑虔信",
	"Mesmeric Devotion": "催眠师虔信", "Sublime Devotion": "崇高虔信", "Frenzied Devotion": "狂乱虔信",
	"Hypnotic Curiosity": "催眠好奇", "Bewitched Curiosity": "蛊惑好奇", "Beguiled Curiosity": "迷惑好奇",
	"Mesmeric Curiosity": "催眠师好奇", "Sublime Curiosity": "崇高好奇", "Frenzied Curiosity": "狂乱好奇",
	"familiar collar": "催眠项圈",
	"Acceptance: Tomgirl": "接纳：假小子", "Acceptance: Flat Chest": "接纳：平胸", "Acceptance: Pregnant": "接纳：怀孕",
	"Breasts": "胸部", "Flat Chest": "平胸", "Penis": "阴茎", "Pregnant Belly": "怀孕的肚子", "Pregnant Looking Belly": "看起来怀孕的肚子",
	"Acceptance: Pregnant Belly": "接纳：怀孕的肚子", "Acceptance: Pregnant Looking Belly": "接纳：看起来怀孕的肚子",
	"Elk-scarred": "麋鹿伤痕", "Elk-marked": "麋鹿印记", "Elk-bitten": "麋鹿撕咬", "Elk-ruptured": "麋鹿撕裂", "Elk-spawned": "麋鹿之嗣",
	"Wolf": "狼", "Cat": "猫", "Cow": "牛", "Harpy": "鸟妖", "Bird": "鸟", "Fox": "狐",
	"Fangs": "獠牙", "Sharp Eyes": "锐利双眼", "Heterochromia": "异色瞳", "Sturdy Horns": "坚固之角",
	"Mate For Life": "终身伴侣", "Pregnant": "怀孕", "First Time Mother": "初为人母", "Second Time Mother": "再次为人母",
	"Mother": "母亲", "Broodmother": "多产母亲", "Gaia": "盖亚", "Parasite Broodmother": "寄生多产母亲",
	"Parasite Mother": "寄生母亲", "Lactating": "哺乳期", "Milk Factory": "乳液狂飙", "Sperm Bank": "精子银行",
	"Possessed": "附身", "Insomnia": "失眠", "Controlled Insomnia": "受控的失眠",
	"Ear slime focus": "耳粘液专注", "Bull": "公牛", "Vixen": "狐女", "Incubus": "梦魔", "Succubus": "魅魔",
	"Strong Wings": "强健之翼", "Thoroughly Preened Wings": "焕然新羽",
	"Thrill of the Chase": "追逐的快感", "Fallen Angel": "堕落天使", "Iron Will": "铁意志",
	"Angel": "天使", "Radiant": "圣光璀璨", "Dark Horns": "暗黑之角", "Compound Horns": "复合之角", "Wings": "翅膀",
	"Meek": "温顺", "Submissive": "顺从", "Bratty": "叛逆", "Defiant": "反抗", "Innocent": "天真无邪",
	"Masochist": "受虐狂", "Guilty Masochist": "愧疚的受虐狂", "Hardened Masochist": "坚硬的受虐狂", "Drooling Masochist": "流口水的受虐狂",
	"Sadist": "施虐狂", "Guilty Sadist": "愧疚的施虐狂", "Hardened Sadist": "坚硬的施虐狂", "Vengeful Sadist": "复仇的施虐狂",
	"Farmer": "农夫",
	"Knowledge: Islander language": "知识：海岛语言", "Knowledge: Quicksand": "知识：流沙",
	"Ancient Arts": "上古技艺", "Mirror Madness": "镜中疯狂", "Eyes in the Night": "夜之眼"
};
/* 本体特质 has 表达式编译缓存（懒编译：判定函数 + 条件变量清单 + 可写数值清单） */
var VANILLA_TRAITS_CACHE = null;
function safeGetObj(root, path) {
	var cur = root, parts = String(path).split(".");
	for (var i = 0; i < parts.length; i++) {
		if (cur === null || cur === undefined) { return undefined; }
		cur = cur[parts[i]];
	}
	return cur;
}
/* v1.9.28：traitEval 编译函数缓存（键 = 正则替换链归一化后的 JS 代码；有界 512，超出整体清空重建）。
   同一表达式只 new Function 一次；判定函数每次调用实时读 V/C（无陈旧状态）。
   注意：VANILLA_TRAITS_CACHE 只缓存「编译后的特质清单」，不含判定函数，两者勿混。 */
var TRAIT_EVAL_FN_CACHE = Object.create(null);
var TRAIT_EVAL_FN_CACHE_N = 0;
function traitEval(V, C, expr) {
	try {
		if (!expr) { return false; }
		var js = String(expr)
			.replace(/\bisnot\b/g, "!==").replace(/\bis\b/g, "===")
			.replace(/\bgte\b/g, ">=").replace(/\bgt\b/g, ">")
			.replace(/\blte\b/g, "<=").replace(/\blt\b/g, "<")
			.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		/* $a.b.c → V.a.b.c（带可选链 ?. 的原样保留）。负向先行断言 (?!\() 防止把成员方法名吃掉：
		   此前 `$backgroundTraits.includes("X")` 的 `.includes` 被当成路径尾段，翻成
		   safeGet(V,"backgroundTraits.includes") → undefined 调用 → 表达式恒 false */
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\?\.)/g, 'safeGet(V,"$1")$2');
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?![\w(])/g, 'safeGet(V,"$1")');
		/* _pills 局部变量 = sexStats.pills.pills */
		js = js.replace(/_pills/g, 'safeGet(V,"sexStats.pills.pills")');
		/* C.npc.X.y */
		js = js.replace(/\bC\.npc\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g, 'safeGet(C,"npc.$1.$2")');
		/* 函数调用（playerIsPregnant() 等全局函数）→ globalThis 兜底；排除已生成的 safeGet/globalThis，
		   以及「.includes(...) / .indexOf(...)」这类成员方法调用（v2.0.6：此前会把 .includes 也改成
		   globalThis["includes"]( 使表达式语法错误 → 含 includes 的特质恒判未获得） */
		js = js.replace(/(^|[^.\w$])([A-Za-z_]\w*)\s*\(/g, function (m0, pre, name) {
			if (name === "safeGet" || name === "globalThis") { return m0; }
			return pre + 'globalThis["' + name + '"](';
		});
		var fn = TRAIT_EVAL_FN_CACHE[js];
		if (!fn) {
			fn = new Function("V", "C", "safeGet", "return (" + js + ");");
			if (TRAIT_EVAL_FN_CACHE_N >= 512) { TRAIT_EVAL_FN_CACHE = Object.create(null); TRAIT_EVAL_FN_CACHE_N = 0; }
			TRAIT_EVAL_FN_CACHE[js] = fn;
			TRAIT_EVAL_FN_CACHE_N += 1;
		}
		return !!fn(V, C, safeGetObj);
	} catch (e) { return false; }
}
/* 解析 has 表达式：找出所有 "$var op value" 比较段与 includes 段 */
function parseTraitHas(expr) {
	/** @type {{vars: Array<{path: string, op: string, val: string}>, includes: string|null, complex: boolean}} */
	var out = { vars: [], includes: null, complex: false };
	if (!expr) { return out; }
	var re = /\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+(gte|gt|lte|lt|is|isnot)\s+(true|false|undefined|"[^"]*"|'[^']*'|\d+)/g;
	var m;
	while ((m = re.exec(expr)) !== null) {
		out.vars.push({ path: m[1], op: m[2], val: m[3] });
	}
	var mi = expr.match(/includes\(\s*"([^"]+)"\s*\)/);
	if (mi) { out.includes = mi[1]; }
	if (/playerIsPregnant|playerAwareTheyArePregnant|playerNormalPregnancyTotal|playerBellySize|between\(|toUpperFirst/.test(expr)) {
		out.complex = true;
	}
	return out;
}
function zhTraitName(en) {
	if (TRAIT_ZH[en]) { return TRAIT_ZH[en]; }
	var s = String(en);
	/* 函数源码型 name（traits widget 里 name 为函数文本）：提取 return 模板再映射 */
	if (/^\s*\(\s*\)\s*=>/.test(s) || /^\s*function\b/.test(s)) {
		var m = s.match(/return\s*`([^`]*)`/);
		if (m) { s = m[1]; } else { return "（函数型特质）"; }
	}
	/* 模板插值关键词：Acceptance 系列函数名 "${penisSize}/${breastSize}"（不依赖前缀键） */
	if (/\$\{penisSize\}/.test(s)) { return "接纳：阴茎"; }
	if (/\$\{breastSize\}/.test(s)) { return "接纳：胸部"; }
	/* A/B 多段（全角／与半角/ 分隔，同格并存的两个特质名）逐段映射 */
	var parts = s.split(/[／\/]/);
	if (parts.length > 1) {
		var zh = [];
		parts.forEach(function (p) {
			var t = String(p).trim();
			if (t) { zh.push(zhTraitName(t)); }
		});
		return zh.join(" / ");
	}
	/* ":" 前缀 + 插值名："Temple Burden: $temple_burden%" / "Rite of Promise: ..." */
	var i = s.indexOf(":");
	if (i > 0) {
		var head = s.slice(0, i).trim();
		var tail = s.slice(i + 1).trim();
		if (TRAIT_ZH[head]) {
			return TRAIT_ZH[head] + (tail ? "：" + zhTraitName(tail) : "");
		}
	}
	if (TRAIT_ZH[s]) { return TRAIT_ZH[s]; }
	return s;
}
/* 动态显示名：name 字符串内 $var 替换为当前值；函数表达式取候选英文名转中文 */
function traitDisplayName(t, V) {
	var nm = t.name;
	if (typeof nm === "function") {
		try { nm = nm(); } catch (e) { nm = String(t.name); }
	}
	nm = String(nm);
	nm = nm.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g, function (_, p) {
		var v = safeGetObj(V, p);
		return (v === undefined || v === null) ? "?" : String(v);
	});
	/* 拆出候选英文名做中文映射：形如 "A/B" 或 "A - B" 的取两端 */
	var out = zhTraitName(nm);
	return out;
}
/* 强制获得标记（v1.8.3）：has 无可写条件变量的特质（复杂表达式/函数判定）无法通过写变量满足，
   点「获取」时直接记入 V.mbCE_forcedTraits，面板内视为已获得；可移除（从标记列表删除）。 */
function forcedTraitKey(t) {
	return (t.cat ? String(t.cat) : "?") + "\u0001" + String(t.name || "");
}
function isForcedTrait(V, t) {
	try {
		var fl = V.mbCE_forcedTraits;
		return Array.isArray(fl) && fl.indexOf(forcedTraitKey(t)) !== -1;
	} catch (e) { return false; }
}
function traitOwned(t, V, C) {
	if (isForcedTrait(V, t)) { return true; }
	if (t.hasFn) { try { return !!t.hasFn(); } catch (e) { return false; } }
	return traitEval(V, C, t.has);
}
/* 获取特质：has 全部比较变量写满足值；includes 目标 push 进数组；无可写条件 → 强制获得标记 */
function grantTrait(t, V, C) {
	var info = parseTraitHas(t.has);
	var wrote = [];
	if (info.includes) {
		var arr = safeGetObj(V, "backgroundTraits");
		if (!Array.isArray(arr)) {
			try { V.backgroundTraits = []; arr = V.backgroundTraits; } catch (e) { arr = null; }
		}
		if (arr && arr.indexOf(info.includes) === -1) { arr.push(info.includes); wrote.push("backgroundTraits+" + info.includes); }
	}
	info.vars.forEach(function (v) {
		var vv = String(v.val).replace(/["']/g, "");
		/* isnot + 非布尔/数字字符串值（如 "none"/"prospective"）：无法推断满足值，跳过不写（防写坏） */
		if (v.op === "isnot" && vv !== "true" && vv !== "false" && vv !== "undefined" && isNaN(parseFloat(vv))) { return; }
		var w = traitWriteSatisfy(V, v.path, v.op, v.val);
		if (w) { wrote.push(w); }
	});
	/* 无可写条件（复杂表达式/函数判定/isnot 字符串值）→ 直接获得：记入强制标记 */
	if (!wrote.length) {
		try {
			if (!V.mbCE_forcedTraits || !Array.isArray(V.mbCE_forcedTraits)) { V.mbCE_forcedTraits = []; }
			var fk = forcedTraitKey(t);
			if (V.mbCE_forcedTraits.indexOf(fk) === -1) {
				V.mbCE_forcedTraits.push(fk);
				wrote.push("mbCE_forcedTraits+" + (t.name || fk));
			} else {
				wrote.push("mbCE_forcedTraits+" + (t.name || fk) + "(已有)");
			}
		} catch (e) { wrote.push("(强制获得失败) " + mbCEErr(e)); }
	}
	return wrote;
}
/* 移除特质：先清强制获得标记（若有）；再主变量（第一个比较变量）写回不满足值 */
function revokeTrait(t, V, C) {
	var info = parseTraitHas(t.has);
	var wrote = [];
	if (isForcedTrait(V, t)) {
		try {
			var fl = V.mbCE_forcedTraits;
			var idx = fl.indexOf(forcedTraitKey(t));
			if (idx !== -1) { fl.splice(idx, 1); wrote.push("mbCE_forcedTraits-" + (t.name || forcedTraitKey(t))); }
		} catch (e) {}
	}
	if (info.includes) {
		var arr = safeGetObj(V, "backgroundTraits");
		if (Array.isArray(arr)) {
			var idx2 = arr.indexOf(info.includes);
			if (idx2 !== -1) { arr.splice(idx2, 1); wrote.push("backgroundTraits-" + info.includes); }
		}
	}
	if (info.vars.length) {
		var v0 = info.vars[0];
		var w = traitWriteUnsatisfy(V, v0.path, v0.op, v0.val);
		if (w) { wrote.push(w); }
	}
	return wrote;
}
function traitWriteSatisfy(V, path, op, valRaw) {
	/** @type {any} */ var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	/* 十二巡修复：isnot 语义是「不等于」——满足 isnot true → 写 false；isnot false → 写 true；
	   isnot undefined → 写 1；isnot N → 写 N-1。此前与 is 共用分支导致布尔写反 */
	if (op === "isnot") {
		if (String(valRaw) === "true") { setPathVal(V, path, false); return path + "=false"; }
		if (String(valRaw) === "false") { setPathVal(V, path, true); return path + "=true"; }
		if (String(valRaw) === "undefined") { setPathVal(V, path, 1); return path + "=1"; }
		setPathVal(V, path, num - 1); return path + "=" + (num - 1);
	}
	if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
	if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "undefined") { return null; }
	if (isNaN(num)) { setPathVal(V, path, String(valRaw).replace(/["']/g, "")); return path + "=" + String(valRaw).replace(/["']/g, ""); }
	if (op === "lte") { setPathVal(V, path, num); return path + "=" + num; }
	if (op === "lt") { setPathVal(V, path, num - 1); return path + "=" + (num - 1); }
	/* 四巡自查修复：gt（严格大于）条件满足值必须是 num+1——此前与 gte/is 共用写 num，
	   写后 "x > num" 恒 false → 获取按钮显示已写但判定仍「未获得」
	   （原版受影响特质：Purity Boost $featsPurityBoost gt 0、Bratty $submissive lte 850 and gt 500） */
	if (op === "gt") { setPathVal(V, path, num + 1); return path + "=" + (num + 1); }
	setPathVal(V, path, num); return path + "=" + num;
}
function traitWriteUnsatisfy(V, path, op, valRaw) {
	/** @type {any} */ var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	/* 十二巡修复：移除时让 isnot 条件变 false——isnot true → 写 true；isnot false → 写 false；
	   isnot undefined → 写 undefined（属性值为 undefined 时 undefined !== undefined 为 false）；isnot N → 写 N */
	if (op === "isnot") {
		if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
		if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
		if (String(valRaw) === "undefined") { setPathVal(V, path, undefined); return path + "=undefined"; }
		/* v2.0.6：isnot 非布尔/非数字字符串值（"banned"/"none"）→ 写回该字符串本身，
		   使 `x !== "banned"` 为假；此前落 num-1 = NaN，会让面板显示的「已移除」失效 */
		if (isNaN(num)) { setPathVal(V, path, String(valRaw).replace(/["']/g, "")); return path + "=" + String(valRaw).replace(/["']/g, ""); }
		setPathVal(V, path, num); return path + "=" + num;
	}
	if (String(valRaw) === "true") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "false") { setPathVal(V, path, true); return path + "=true"; }
	if (isNaN(num)) { setPathVal(V, path, ""); return path + '=""'; }
	if (op === "lte") { setPathVal(V, path, num + 1); return path + "=" + (num + 1); }
	if (op === "lt") { setPathVal(V, path, num); return path + "=" + num; }
	setPathVal(V, path, 0); return path + "=0";
}
function setPathVal(V, path, val) {
	var parts = String(path).split(".");
	var cur = V;
	for (var i = 0; i < parts.length - 1; i++) {
		if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== "object") { cur[parts[i]] = {}; }
		cur = cur[parts[i]];
	}
	cur[parts[parts.length - 1]] = val;
}
/* 编译本体特质表（懒执行） */
function compileVanillaTraits() {
	if (VANILLA_TRAITS_CACHE) { return VANILLA_TRAITS_CACHE; }
	var out = [];
	VANILLA_TRAITS_RAW.forEach(function (t) {
		var info = parseTraitHas(t.has);
		var nm = String(t.name || "").replace(/^"|"$/g, "");
		/* 数值可改清单：数字比较变量（如 temple_burden / sciencetrait） */
		var values = [];
		info.vars.forEach(function (v) {
			var num = parseFloat(String(v.val).replace(/["']/g, ""));
			if (!isNaN(num) && (v.op === "gte" || v.op === "is" || v.op === "gt")) {
				/* 五巡自查：gt 满足值 = num+1，与 traitWriteSatisfy 一致（values 默认值即满足值） */
				values.push({ path: v.path, op: v.op, val: (v.op === "gt") ? num + 1 : num });
			}
		});
		out.push({ cat: t.cat, name: nm, has: t.has, parsed: info, values: values });
	});
	VANILLA_TRAITS_CACHE = out;
	return out;
}
/* 运行时发现模组特质：maplebirch.temporary.traitLists（MLI traits.inject 解析后的注入表） */
function discoverModTraits() {
	var out = [];
	try {
		var mb = resolveMB();
		var lists = mb && mb.temporary && mb.temporary.traitLists;
		if (!Array.isArray(lists)) { return out; }
		lists.forEach(function (cat) {
			if (!cat || !Array.isArray(cat.traits)) { return; }
			cat.traits.forEach(function (t) {
				if (!t || !t.name) { return; }
				var hasStr = (typeof t.has === "string") ? t.has : "";
				var parsed = parseTraitHas(hasStr);
				/* 双巡优化①：模组特质数字比较变量同样生成「可改数值」清单（仿 compileVanillaTraits），
				   使模组注入特质的数字条件也能直接改数值/回退——数据层 traitWriteValue/undo 已通用 */
				var values = [];
				parsed.vars.forEach(function (v) {
					var num = parseFloat(String(v.val).replace(/["']/g, ""));
					if (!isNaN(num) && (v.op === "gte" || v.op === "is" || v.op === "gt")) {
						values.push({ path: v.path, op: v.op, val: (v.op === "gt") ? num + 1 : num });
					}
				});
				out.push({
					cat: String(cat.title || "模组特质"),
					name: (typeof t.name === "function") ? t.name() : String(t.name),
					text: (typeof t.text === "function") ? String(t.text()) : String(t.text || ""),
					/* v1.8.11：保留 has 字符串——字符串判定可复用 grant/revoke 写变量直接获得/移除；
					   函数判定保留 hasFn，走强制获得标记路径 */
					has: hasStr,
					hasFn: (typeof t.has === "function") ? t.has : null,
					parsed: parsed,
					values: values,
					mod: true
				});
			});
		});
	} catch (e) {}
	return out;
}
/* v1.8.3：同系列不同阶段特质合并（如受虐狂 4 档 / 施虐狂 4 档 / 各科成绩 4 档）——
   识别依据：同一分类下 has 表达式只含一个数字比较变量（is/gte/gt N），同变量归为一组，按阈值排序。
   渲染为「阶段下拉 + 应用 + 跳至最高 + 回退初始」，对齐 Mod作弊 子页阶段控件。 */
var TRAIT_SERIES_CN = {
	"masochism_level": "受虐狂", "sadism_level": "施虐狂",
	"sciencetrait": "科学成绩", "mathstrait": "数学成绩", "englishtrait": "语文成绩",
	"historytrait": "历史成绩", "schooltrait": "在校表现"
};
function groupTraitSeries(vanilla) {
	var groups = {};
	vanilla.forEach(function (t) {
		var v = t.parsed && t.parsed.vars;
		if (!v || v.length !== 1) { return; }
		var v0 = v[0];
		if ((v0.op !== "is" && v0.op !== "gte" && v0.op !== "gt") || isNaN(parseFloat(String(v0.val).replace(/["']/g, "")))) { return; }
		var key = t.cat + "\u0001" + v0.path;
		(groups[key] = groups[key] || []).push({ t: t, path: v0.path, val: parseFloat(String(v0.val).replace(/["']/g, "")) });
	});
	var out = [];
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		if (g.length >= 2) {
			g.sort(function (a, b) { return a.val - b.val; });
			out.push({ cat: g[0].t.cat, path: g[0].path, series: g });
		}
	});
	out.sort(function (a, b) { return a.series[0].val - b.series[0].val; });
	return out;
}
function traitSeriesName(series) {
	var base = TRAIT_SERIES_CN[series.path];
	if (base) { return base; }
	return traitDisplayName(series.series[0].t, getV());
}
/* 系列行渲染：系列名 + 阶段下拉（无/各档位）+ 应用 + 跳至最高 + 回退初始 */
function renderTraitSeriesRow(body, series, V) {
	var V2 = V || getV();
	var seriesName = traitSeriesName(series);
	var cur = safeGetObj(V2, series.path);
	var curNum = (typeof cur === "number" && isFinite(cur)) ? cur : null;
	var curTier = -1, i;
	for (i = 0; i < series.series.length; i++) {
		if (series.series[i].val === curNum) { curTier = i; break; }
	}
	var sel = el("select", "mce-sel");
	/* 注意：HTMLSelectElement.type 是只读 getter，不能赋值（赋了真实浏览器抛
	   "Cannot set property type of #<HTMLSelectElement>"）；select 也不需要 type */
	var opt0 = el("option", "", "无（未获得）");
	opt0.value = "0";
	sel.appendChild(opt0);
	series.series.forEach(function (item, idx) {
		var o = el("option", "", traitDisplayName(item.t, V2) + "（" + item.val + "）");
		o.value = String(item.val);
		sel.appendChild(o);
	});
	sel.value = String(curTier >= 0 ? series.series[curTier].val : 0);
	var lbl = el("span", "mce-row-lbl", seriesName + "（当前 " + (curTier >= 0 ? traitDisplayName(series.series[curTier].t, V2) : "无") + "）");
	var bApp = el("button", "", "应用"); bApp.type = "button";
	bApp.addEventListener("click", function () {
		var v = parseFloat(sel.value);
		if (isNaN(v)) { v = 0; }
		var res = traitWriteValue(series.series[0].t, V2, series.path, String(v));
		actPlayer(res);
	});
	var bMax = el("button", "", "跳至最高"); bMax.type = "button";
	bMax.addEventListener("click", function () {
		var v = series.series[series.series.length - 1].val;
		var res = traitWriteValue(series.series[0].t, V2, series.path, String(v));
		actPlayer(res);
	});
	var bInit = el("button", "", "回退初始"); bInit.type = "button";
	bInit.addEventListener("click", function () {
		/* 回退初始 = 写 0（无阶段），不依赖留痕（保证从未改过也能回退） */
		var res = traitWriteValue(series.series[0].t, V2, series.path, "0");
		actPlayer(res);
	});
	var row = el("div", "mce-row");
	row.appendChild(lbl); row.appendChild(sel); row.appendChild(bApp); row.appendChild(bMax); row.appendChild(bInit);
	body.appendChild(row);
}
/* 特质管理区渲染：原版分类（静态表）+ 模组特质分类（运行时发现） */
function renderTraitsSection(pane, V, C) {
	var wrap = el("div", "mce-grp");
	wrap.appendChild(el("div", "mce-grp-t", "★ 特质管理：可直接获取/移除，有数值的可直接更改（含其他模组注入的特质，自动发现）。已按分类折叠，点击分类标题展开；行首 ☆ 点击可收藏置顶"));
	var vanilla = compileVanillaTraits();
	var modTraits = discoverModTraits();
	var q = (curPlayerFilter || "").toLowerCase();
	var seenV = {}, seenM = {}, groups = {};
	/* v1.8.12 收藏置顶组：收藏的特质优先显示在最前（含模组特质） */
	var FAV_CAT = "★ 已收藏";
	/* v1.8.12 功能13：收藏集合局部缓存——一次扫描替代逐行 indexOf 查询（几十个特质行的重复数组查找） */
	var favCache = getFavTraits(V).slice();
	function isFav(t) {
		var k = favTraitKey(t);
		return favCache.indexOf(k) !== -1;
	}
	/* 可折叠分类组：标题可点，body 默认收起（data-collapsed=1，CSS 隐藏） */
	/* v1.8.15 九巡：懒渲染——初始收起的组不建行（行闭包进 g.pending），展开才建行，面板开合/切页显著减 DOM */
	function buildLazyRows(g) {
		if (!g || !g.pending || g.pending.length === 0) { return; }
		var pend = g.pending;
		g.pending = [];
		pend.forEach(function (fn) { try { fn(); } catch (e) {} });
	}
	function bodyFor(zhCat, note) {
		if (groups[zhCat]) { return groups[zhCat]; }
		var grp = el("div", "mce-grp");
		grp.setAttribute("data-tcat", zhCat);
		/* 恢复展开时箭头同步 ▾（bodyFor 内读取 mbCEUiState，head 文案一次成型） */
		var restoreOpen = mbCEUiState.collapsed[zhCat] === 0;
		var head = el("div", "mce-grp-t mce-collapse-head", (restoreOpen ? "▾ " : "▸ ") + zhCat);
		var body = el("div", "mce-grp-body");
		/* v1.8.12 持久化：恢复上次折叠状态（0=展开，1=收起；未记录默认收起）；箭头同步 ▸/▾ */
		var collapsedNow = mbCEUiState.collapsed[zhCat] === 0 ? false : true;
		body.setAttribute("data-collapsed", collapsedNow ? "1" : "0");
		head.addEventListener("click", function () {
			var open = body.getAttribute("data-collapsed") !== "1";
			body.setAttribute("data-collapsed", open ? "1" : "0");
			head.textContent = (open ? "▸ " : "▾ ") + zhCat + (groups[zhCat].count > 0 ? "（" + groups[zhCat].count + "）" : "") + groups[zhCat].note;
			/* 懒渲染：展开瞬间补建行（open=点击前展开态，点击前收起(!open) → 点击后展开 → 补建） */
			if (!open) { buildLazyRows(groups[zhCat]); }
			/* v1.8.12 持久化：记录点击后状态（点击后展开 = !open） */
			mbCEUiCollapsed(zhCat, !open);
		});
		grp.appendChild(head);
		grp.appendChild(body);
		if (zhCat === FAV_CAT && wrap.firstChild) {
			/* 收藏组置顶：插到头部工具行之后（工具行常驻最顶） */
			wrap.insertBefore(grp, wrap.firstChild.nextSibling);
		}
		else { wrap.appendChild(grp); }
		var g = { head: head, body: body, count: 0, note: note || "", pending: [] };
		groups[zhCat] = g;
		return g;
	}
	/* v1.8.12 二轮优化：折叠工具行——全部展开 / 全部收起（点击时 groups 已渲染完成） */
	var toolRow = el("div", "mce-row");
	toolRow.appendChild(el("span", "mce-row-lbl", "折叠工具："));
	var bAllOpen = el("button", "", "全部展开"); bAllOpen.type = "button";
	bAllOpen.title = "展开特质管理区全部分类";
	bAllOpen.addEventListener("click", function () {
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			g.body.setAttribute("data-collapsed", "0");
			g.head.textContent = "▾ " + k + "（" + g.count + "）" + g.note;
			buildLazyRows(g); /* 懒渲染：全部展开时补建所有行 */
			mbCEUiCollapsed(k, true);
		});
	});
	var bAllClose = el("button", "", "全部收起"); bAllClose.type = "button";
	bAllClose.title = "收起特质管理区全部分类";
	bAllClose.addEventListener("click", function () {
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			g.body.setAttribute("data-collapsed", "1");
			g.head.textContent = "▸ " + k + "（" + g.count + "）" + g.note;
			mbCEUiCollapsed(k, false);
		});
	});
	toolRow.appendChild(bAllOpen);
	toolRow.appendChild(bAllClose);
	wrap.appendChild(toolRow);
	/* 系列识别：同变量多档位特质 → 合并为一行（阶段下拉），不再逐条平铺 */
	var seriesGroups = groupTraitSeries(vanilla);
	var seriesKeys = {};
	seriesGroups.forEach(function (s) {
		s.series.forEach(function (item) { seriesKeys[item.t.cat + "\u0001" + String(item.t.name || "")] = true; });
	});
	/* 原版按分类分组渲染（同分类同中文名去重：原版 widget 多段/函数名同语义只显示一行） */
	vanilla.forEach(function (t) {
		if (seriesKeys[t.cat + "\u0001" + String(t.name || "")]) { return; }
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && String(t.name || "").toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenV[key]) { return; }
		seenV[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] || t.cat;
		var g = bodyFor(isFav(t) ? FAV_CAT : zhCat, isFav(t) ? " · 收藏置顶（点击☆取消）" : "");
		g.count++;
		g.pending.push(function () { renderTraitRow(g.body, t, V, C, false); }); /* 懒渲染：收起组只记账不建行 */
	});
	/* 系列行渲染（放入所属分类组；搜索时按系列名过滤） */
	seriesGroups.forEach(function (s) {
		var seriesName = traitSeriesName(s);
		if (q && seriesName.toLowerCase().indexOf(q) === -1) { return; }
		var zhCat = TRAIT_ZH_CAT[s.cat] || s.cat;
		var g = bodyFor(zhCat, "");
		g.count++;
		g.pending.push(function () { renderTraitSeriesRow(g.body, s, V); }); /* 懒渲染 */
	});
	/* 模组特质分类（按 title 分组，同分类同中文名去重） */
	modTraits.forEach(function (t) {
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && t.cat.toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenM[key]) { return; }
		seenM[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] ? TRAIT_ZH_CAT[t.cat] + "（模组）" : (t.cat + "（模组）");
		var g = bodyFor(isFav(t) ? FAV_CAT : zhCat, isFav(t) ? " · 收藏置顶（点击☆取消）" : " · 模组注入（自动发现，可直接获取/移除）");
		g.count++;
		g.pending.push(function () { renderTraitRow(g.body, t, V, C, true); }); /* 懒渲染 */
	});
	/* 组标题统一补数量（箭头按当前展开状态：0=展开 ▾，1=收起 ▸；持久化恢复时保持一致性） */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		var open = g.body.getAttribute("data-collapsed") !== "1";
		g.head.textContent = (open ? "▾ " : "▸ ") + k + "（" + g.count + "）" + g.note;
	});
	/* 懒渲染：展开状态的分组初始即建行（收起的组保持空，等点击展开才建）。
	   搜索态（q 非空）下强制所有组展开并建行——否则匹配行落在收起组里不可见（搜索结果丢失）。
	   仅改 DOM 收起标记，不写入持久化折叠状态，搜索结束后恢复默认收起 */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		if (q) {
			g.body.setAttribute("data-collapsed", "0");
			g.head.textContent = "▾ " + k + "（" + g.count + "）" + g.note;
		}
		if (q || g.body.getAttribute("data-collapsed") !== "1") { buildLazyRows(g); }
	});
	/* v1.8.12 二轮优化：折叠状态残留键清理（仅全量渲染时——搜索过滤下未显示分类会被误删） */
	if (!q) {
		var alive = {};
		Object.keys(groups).forEach(function (k) { alive[k] = true; });
		var stale = false;
		Object.keys(mbCEUiState.collapsed).forEach(function (k) {
			if (!alive[k]) { delete mbCEUiState.collapsed[k]; stale = true; }
		});
		if (stale) { mbCEUiSave({ collapsed: mbCEUiState.collapsed }); }
	}
	pane.appendChild(wrap);
}
function renderTraitRow(grp, t, V, C, isMod) {
	var owned = traitOwned(t, V, C);
	var nameZh = traitDisplayName(t, V);
	var row = el("div", "mce-row");
	/* v1.8.12 收藏置顶：☆ 收藏 / ★ 已收藏（数据存 V.mbCE_favTraits，CSS 类渲染兼容无 DOM 环境） */
	var favNow = isFavTrait(t, V);
	var bF = el("button", "mce-favstar" + (favNow ? " mce-fav" : ""), favNow ? "★" : "☆");
	bF.type = "button";
	bF.title = favNow ? "取消收藏（该特质不再置顶）" : "收藏（该特质置顶到「★ 已收藏」组）";
	bF.addEventListener("click", function () {
		var res = toggleFavTrait(t, V);
		actPlayer(res);
	});
	row.appendChild(bF);
	row.appendChild(el("span", "mce-row-lbl", (owned ? "● " : "○ ") + nameZh + (isMod ? "（模组）" : "")));
	/* 描述（函数/模板源码型描述不展示，避免源码泄漏） */
	var desc = isMod ? t.text : String(t.text || "");
	desc = String(desc || "");
	if (/^\s*\(?\s*\)\s*=>/.test(desc) || /^\s*function\b/.test(desc) || (desc.length > 300 && desc.indexOf("`") !== -1)) { desc = ""; }
	if (desc) {
		row.appendChild(el("span", "mce-hint", String(desc).slice(0, 90) + (String(desc).length > 90 ? "…" : "")));
	}
	/* 获取 / 移除：原版与模组注入特质均可（v1.8.11 模组特质不再只读——
	   字符串判定写变量直接获得/移除，函数判定走强制获得标记） */
	var bG = el("button", "", owned ? "移除" : "获取");
	bG.type = "button";
	bG.addEventListener("click", function () {
		var res;
		if (owned) {
			var w = revokeTrait(t, V, C);
			res = { ok: w.length > 0, message: w.length ? "已移除「" + nameZh + "」：" + w.join("、") : "该特质无可移除的条件变量" };
		} else {
			var w2 = grantTrait(t, V, C);
			res = { ok: w2.length > 0, message: w2.length ? "已获取「" + nameZh + "」：" + w2.join("、") : "该特质无可写条件（只读展示）" };
		}
		actPlayer(res);
	});
	row.appendChild(bG);
	/* 数值可改（数字比较变量）：写入走 player-self 留痕通道 + 回退
	   （原版与模组注入特质均可用——discoverModTraits 已为模组特质生成 values 清单） */
	t.values.forEach(function (v) {
		var cur = safeGetObj(V, v.path);
		var num = (typeof cur === "number") ? cur : 0;
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(num);
		inp.placeholder = "+N / -N 相对";
		inp.title = "支持相对调整：+100 / -20；直接输入数字为绝对值";
		var bS = el("button", "", "改数值"); bS.type = "button";
		bS.addEventListener("click", function () {
			var res = traitWriteValue(t, V, v.path, inp.value);
			actPlayer(res);
		});
		var bU = el("button", "", "回退"); bU.type = "button";
		bU.addEventListener("click", function () {
			var res = undoCheatModValue("player-self", "trait:" + v.path);
			actPlayer(res);
		});
		row.appendChild(inp); row.appendChild(bS); row.appendChild(bU);
	});
	grp.appendChild(row);
}
/* v1.8.12 特质收藏（数据层）：V.mbCE_favTraits 数组，key=cat\u0001name，收藏项渲染置顶 */
function favTraitKey(t) {
	return String(t && (t.cat || t.kind || "")) + "\u0001" + String(t && (t.name || ""));
}
function getFavTraits(V) {
	try {
		var v = V || getV();
		if (v && Array.isArray(v.mbCE_favTraits)) { return v.mbCE_favTraits; }
	} catch (e) {}
	return [];
}
function isFavTrait(t, V) {
	try { return getFavTraits(V).indexOf(favTraitKey(t)) !== -1; } catch (e) { return false; }
}
function toggleFavTrait(t, V) {
	try {
		var v = V || getV();
		if (!v) { return { ok: false, message: "存档变量不可用" }; }
		if (!Array.isArray(v.mbCE_favTraits)) { v.mbCE_favTraits = []; }
		var k = favTraitKey(t);
		var idx = v.mbCE_favTraits.indexOf(k);
		if (idx !== -1) { v.mbCE_favTraits.splice(idx, 1); return { ok: true, fav: false, message: "已取消收藏" }; }
		v.mbCE_favTraits.push(k);
		return { ok: true, fav: true, message: "已收藏（置顶显示）" };
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}

function traitWriteValue(t, V, path, raw) {
	var num = parseFloat(raw);
	if (isNaN(num)) { return { ok: false, message: "请输入数字（当前值 " + (safeGetObj(V, path) === undefined ? "?" : safeGetObj(V, path)) + "）" }; }
	var before = safeGetObj(V, path);
	/* v1.8.12：保留原始字符串传给 cheatWriteValue，使 +N / -N 相对语法生效（parseFloat 仅作合法性校验） */
	var res = cheatWriteValue("player-self", "trait:" + path, "value_set", path, raw, "number");
	if (!res || !res.ok) { return { ok: false, message: "写入失败：" + (res && res.message ? res.message : "未知错误") }; }
	var after = safeGetObj(V, path);
	return { ok: true, message: "「" + traitDisplayName(t, V) + "」数值 " + path + "：" + (before === undefined ? "?" : before) + " → " + after + "（可回退）" };
}
/* 兼容导出（v1.7.x 老 API 保留，UI 已迁移至特质管理）：模组属性判定（数据层） */
function isModOnlyRoot(k) {
	if (!k) { return false; }
	if (k.indexOf("mbCE_") === 0) { return false; }
	if (ORIGINAL_V_ROOT_KEYS.indexOf(k) !== -1) { return false; }
	if (CHEAT_VANILLA_ROOTS.indexOf(k) !== -1) { return false; }
	return true;
}
/* 性别切换（v1.9.1 新功能：玩家自己页）——原版权威键实证（0.5.12.13 源码，自查轮补全）：
   七键：V.player.sex（"m"/"f"/"h"=herm，生殖器性别权威键，isGenitalMismatch/crossdressing/成就 Being a Boy 均读它）
         V.player.gender（社会性别，"m"/"f"/"h"，新游戏预设 herm=gender"h"）
         V.player.gender_body（身体外观，"m"/"f"/"a"，bimbo/pimp 事件改写；herm 预设为 "a"）
         V.player.penisExist / V.player.vaginaExist / V.player.penissize（0-6，0=N/A；sex=m 时大阴茎阈值 6，否则 4）
         V.player.ballsExist（新游戏预设：男/女 false，双性 true）
   引擎 genderappearancecheck 会由 sex 定期重算 gender_appearance，无需手写。 */
var GENDER_CN = { m: "男", f: "女", h: "双性", a: "双性", unknown: "未知" };
function getPlayerGender(V) {
	try {
		var pl = V.player || {};
		if (pl.sex === "m") { return "m"; }
		if (pl.sex === "f") { return "f"; }
		if (pl.sex === "h") { return "a"; }
		var pe = !!pl.penisExist, ve = !!pl.vaginaExist;
		if (pe && ve) { return "a"; }
		if (pe) { return "m"; }
		if (ve) { return "f"; }
		return "unknown";
	} catch (e) { return "unknown"; }
}
function applyPlayerGender(V, g) {
	try {
		if (!V || typeof V !== "object") { return "FAIL: 存档变量不可用"; }
		if (!V.player || typeof V.player !== "object") { V.player = {}; }
		var out = [];
		if (g === "m") {
			V.player.penisExist = true;
			if (typeof V.player.penissize !== "number" || V.player.penissize < 1) { V.player.penissize = 1; }
			V.player.vaginaExist = false;
			V.player.gender = "m";
			V.player.gender_body = "m";
			V.player.sex = "m";
			V.player.ballsExist = false;
			out.push("penisExist=true", "penissize=" + V.player.penissize, "vaginaExist=false", "gender=m", "gender_body=m", "sex=m", "ballsExist=false");
		} else if (g === "f") {
			V.player.vaginaExist = true;
			V.player.penisExist = false;
			V.player.penissize = 0;
			V.player.gender = "f";
			V.player.gender_body = "f";
			V.player.sex = "f";
			V.player.ballsExist = false;
			out.push("vaginaExist=true", "penisExist=false", "penissize=0", "gender=f", "gender_body=f", "sex=f", "ballsExist=false");
		} else if (g === "a") {
			V.player.penisExist = true;
			if (typeof V.player.penissize !== "number" || V.player.penissize < 1) { V.player.penissize = 1; }
			V.player.vaginaExist = true;
			V.player.gender = "h";
			V.player.gender_body = "a";
			V.player.sex = "h";
			V.player.ballsExist = true;
			out.push("penisExist=true", "penissize=" + V.player.penissize, "vaginaExist=true", "gender=h", "gender_body=a", "sex=h", "ballsExist=true");
		} else {
			return "FAIL: 未知性别 " + g;
		}
		/* 引擎收敛（实测路径=测试路径修复）：原版 gender_appearance 由 exposure()→exposedcheck()
		   在场景更新时重算；切性别后立即触发一次（alwaysRun=true 战斗内也收敛），同场景外观性别立即生效，
		   避免下一场景前 UI/服装分型读到旧值。环境无引擎函数（单测沙箱）时静默跳过，不影响七键结果。 */
		try {
			if (typeof window !== "undefined" && typeof window.exposedcheck === "function") { window.exposedcheck(true); }
		} catch (e) {}
		return out.join(",");
	} catch (e) { return "FAIL: " + mbCEErr(e); }
}
function renderGenderBox(pane, V) {
	var g = getPlayerGender(V);
	var box = el("div", "mce-grp");
	box.setAttribute("data-mce-gender", g);
	box.appendChild(el("div", "mce-grp-t", "★ 性别切换（原版键 sex/gender/gender_body/penisExist/vaginaExist/penissize/ballsExist）当前：" + (GENDER_CN[g] || g)));
	var brow = el("div", "mce-row");
	["m", "f", "a"].forEach(function (gv) {
		var b = el("button", g === gv ? "mce-btn-active" : "", (GENDER_CN[gv] || gv) + (g === gv ? " ✓" : ""));
		b.type = "button";
		b.setAttribute("data-gender", gv);
		b.addEventListener("click", function () {
			var res = applyPlayerGender(V, gv);
			var isFail = typeof res === "string" && res.indexOf("FAIL") === 0;
			setStatus(isFail ? res : "性别已切换为「" + (GENDER_CN[gv] || gv) + "」", isFail ? "mce-err" : "mce-ok");
			renderPlayerEdit();
		});
		brow.appendChild(b);
	});
	box.appendChild(brow);
	pane.appendChild(box);
}
function renderPlayerEdit() {
	/* 十巡：渲染时从持久化状态恢复搜索词（搜索框 input 事件已写入 mbCEUiState.filter；
	   此前只写不读，刷新/重开面板后搜索词丢失） */
	curPlayerFilter = (typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.filter) ? String(mbCEUiState.filter) : "";
	var pane = root.querySelector('[data-pane="mods"]');
	if (!pane) { return; }
	var st = pane.scrollTop; /* 五巡：重建后保持滚动位置（快速面板/特质区长列表操作不跳顶） */
	pane.textContent = "";
	var back = el("button", "", "← 返回模组列表");
	back.type = "button";
	back.addEventListener("click", function () { renderModCheats(); });
	pane.appendChild(back);
	pane.appendChild(el("div", "mce-hint", "【玩家自己 · 属性与特质】游戏属性面板数值快捷编辑 + 全部特质管理（含其他模组注入的特质，自动发现）。中文键名仅用于显示，写入仍用原键名。"));
	var frow = el("div", "mce-row");
	frow.appendChild(el("span", "mce-row-lbl", "关键词过滤："));
	var finp = el("input", "mce-inp");
	finp.type = "text";
	finp.value = curPlayerFilter || "";
	finp.addEventListener("input", function () {
		curPlayerFilter = finp.value;
		mbCEUiSave({ filter: finp.value });
		/* v1.8.12 功能13：搜索输入 250ms 防抖，避免逐键全量重建特质区 */
		mceSchedule(renderPlayerEdit, 250, "search");
	});
	frow.appendChild(finp);
	pane.appendChild(frow);
	var qwrap = el("div", "mce-grp");
	qwrap.appendChild(el("div", "mce-grp-t", "★ 游戏属性面板（颜色分级）快捷编辑：直接改面板显示的核心属性/技能/性技能/成绩/武器"));
	renderQuickPanel(qwrap);
	pane.appendChild(qwrap);
	var V = getV();
	if (!V) { pane.appendChild(el("div", "mce-err", "存档变量不可用。")); return; }
	var C = null;
	try { if (typeof C !== "undefined" && C) { C = window.C || C; } } catch (e) {}
	renderGenderBox(pane, V);
	renderTraitsSection(pane, V, C);
	pane.scrollTop = st; /* 五巡：恢复滚动位置 */
}


	/* ============ UI：右侧常驻黑色悬浮侧边面板（CE 样式，双层标签） ============ */
	var root = null;
	var toggleBtn = null;
	var openFlag = false;
	var curName = "";
	var curInnerTab = "romance";
	var initialized = false;
	var mbCETheme = "gold"; /* v1.9.29 主题：gold 黑金 / starry 星空蓝 */

	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) { node.className = cls; }
		if (text !== undefined && text !== null) { node.textContent = String(text); }
		return node;
	}

	/* ============ v2.0.2 按键排版helper：区块编号 / 二级分组 / 按钮网格 / 说明折叠 ============
	   设计口径（解决"功能越加越多、面板越堆越乱"）：
	     ① 同页区块统一编号（mceNewSec），玩家一眼知道一页有几块、当前在第几块；
	     ② 语义相近的区块收进二级分组（mceNewGroup），组名一句话说明"这一组在干什么"；
	     ③ 同构按钮走 2 列网格（mceBtnGrid），不再每行一个把纵向拉长；
	     ④ 长说明默认折叠成 2 行（mceFoldHint），点击展开，避免每块 2~3 行密文占屏。
	   全部返回普通 DOM 节点，调用方后续 appendChild 逻辑不变（替换点最小）。 */
	var mceSecNo = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯"];
	/* 编号映射：idx<=0 / 非数字 → 空串（真正“不编号”）；超出字表 → 阿拉伯数字。
	   旧实现 mceSecMark(0) 返回 "0"、mceSecMark(undefined) 返回 "undefined" 文本，与“idx=0 不编号”的约定不符。 */
	function mceSecMark(idx) {
		var n = Number(idx);
		if (!isFinite(n) || n <= 0) { return ""; }
		return mceSecNo[n - 1] || String(n);
	}
	/* 说明折叠：默认 2 行截断，点击整块切换展开/收起（data-open=1/0 供测试断言） */
	function mceFoldHint(text) {
		var h = el("div", "mce-hint mce-fold", text);
		h.setAttribute("data-open", "0");
		h.title = "点击展开 / 收起完整说明";
		h.addEventListener("click", function () {
			h.setAttribute("data-open", h.getAttribute("data-open") === "0" ? "1" : "0");
		});
		return h;
	}
	/* v2.0.10 折叠分组：区块标题行即开关，整块默认收起，点击展开；展开态按「序号|标题」存
	   localStorage（不写存档）。返回 body 容器 —— 调用方 `var sec = mceNewSec(...)` 后继续
	   appendChild，内容自动落进 body，29 处调用点零改动。玩家要求：全局页太长，按序号收在一起。 */
	var MCE_SEC_FOLD_KEY = "mbCE_seccollapse";
	var mceSecFoldMap = null;
	function mceSecFold(key, open) {
		try {
			if (!mceSecFoldMap) {
				var raw = window.localStorage ? window.localStorage.getItem(MCE_SEC_FOLD_KEY) : null;
				mceSecFoldMap = raw ? (JSON.parse(raw) || {}) : {};
			}
		} catch (e) { mceSecFoldMap = {}; }
		if (open === undefined) { return mceSecFoldMap[key] === 1; } /* 缺省 = 收起 */
		mceSecFoldMap[key] = open ? 1 : 0;
		try { if (window.localStorage) { window.localStorage.setItem(MCE_SEC_FOLD_KEY, JSON.stringify(mceSecFoldMap)); } } catch (e) {}
		return open;
	}
	/* 带编号区块（可折叠）：返回区块的 body 容器，后续照旧 sec.appendChild(...) */
	function mceNewSec(parent, idx, title, hint) {
		var sec = el("div", "mce-block mce-blockfold"), n = Number(idx);
		var key = (isFinite(n) ? String(n) : "0") + "|" + String(title || "");
		var open = mceSecFold(key);
		sec.setAttribute("data-open", open ? "1" : "0");
		sec.setAttribute("data-secidx", isFinite(n) ? String(n) : "0");
		var head = el("div", "mce-sec-title mce-sec-head");
		head.setAttribute("role", "button");
		head.setAttribute("tabindex", "0");
		head.title = open ? "点击收起本组" : "点击展开本组";
		head.appendChild(el("span", "mce-sec-n", mceSecMark(idx)));
		head.appendChild(el("span", "mce-sec-t", title));
		var arrow = el("span", "mce-sec-arrow", open ? "▾" : "▸");
		head.appendChild(arrow);
		var body = el("div", "mce-sec-body");
		sec.appendChild(head);
		sec.appendChild(body);
		if (hint) { body.appendChild(mceFoldHint(hint)); }
		function toggle() {
			var nowOpen = sec.getAttribute("data-open") !== "1";
			sec.setAttribute("data-open", nowOpen ? "1" : "0");
			arrow.textContent = nowOpen ? "▾" : "▸";
			head.title = nowOpen ? "点击收起本组" : "点击展开本组";
			mceSecFold(key, nowOpen);
		}
		head.addEventListener("click", toggle);
		head.addEventListener("keydown", function (ev) {
			if (ev.key === "Enter" || ev.key === " " || ev.keyCode === 13 || ev.keyCode === 32) {
				ev.preventDefault();
				toggle();
			}
		});
		if (parent) { parent.appendChild(sec); }
		return body;
	}
	/* 二级分组：返回组内 body 容器（组名 + 右侧副标） */
	function mceNewGroup(parent, title, sub) {
		var g = el("div", "mce-group");
		var head = el("div", "mce-group-h");
		head.appendChild(el("span", "", title));
		if (sub) { head.appendChild(el("span", "mce-group-n", sub)); }
		g.appendChild(head);
		var body = el("div", "mce-group-b");
		g.appendChild(body);
		if (parent) { parent.appendChild(g); }
		return body;
	}
	/* 2 列按钮网格容器 */
	function mceBtnGrid(parent) {
		var g = el("div", "mce-btn-grid");
		if (parent) { parent.appendChild(g); }
		return g;
	}

	/* v1.9.14 效果2：写入成功闪烁——目标行/按钮加 .mce-flash（金底 0.6s→透明）；同一 timer 统一清理全部 flash 节点（连点不堆积；强制 reflow 保证同一节点动画重放） */
	var mbCEFlashTimer = null;
	function mbCEFlash(node) {
		try {
			if (!node || !node.classList || !node.classList.add) { return; }
			node.classList.remove("mce-flash");
			void node.offsetWidth; /* 强制 reflow：同节点连闪时重放动画 */
			node.classList.add("mce-flash");
			if (mbCEFlashTimer) { clearTimeout(mbCEFlashTimer); }
			mbCEFlashTimer = setTimeout(function () {
				mbCEFlashTimer = null;
				var els = root ? root.querySelectorAll(".mce-flash") : [];
				for (var i = 0; i < els.length; i++) { els[i].classList.remove("mce-flash"); }
			}, 650);
		} catch (e) {}
	}
	function mbCEFlashRow(btnOrEl) {
		try {
			var n = btnOrEl && btnOrEl.closest ? btnOrEl.closest(".mce-row, .mce-statrow, .mce-stage") : null;
			mbCEFlash(n || btnOrEl);
		} catch (e) {}
	}
	/* v1.9.14 效果2：全量重建页（renderPlaces 等）重渲染后按 data-stagekey 定位新行闪烁——render 同步执行完 DOM 已建 */
	function mbCEFlashAfterRender(stageKey) {
		try {
			if (!stageKey) { return; }
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape(stageKey) : String(stageKey).replace(/["\\]/g, "\\$&");
			var row = root ? root.querySelector('[data-stagekey="' + esc + '"]') : null;
			if (row) { mbCEFlash(row); }
		} catch (e) {}
	}

	var MB_CSS = "" +
		/* ===== v1.9.18 排版 token 化：改主题/字号只动 :root 变量 ===== */
		":root{" +
		"--mce-accent:#d4a73c;--mce-accent-hover:#e0b44a;--mce-accent-dark:#b38a2a;--mce-accent-55:rgba(212,167,60,.55);" +
		"--mce-gold-soft:#f0d070;--mce-gold-note:#8a6d3b;--mce-gold-bg:#2a2208;--mce-gold-txt:#f0d98c;" +
		"--mce-bg-panel:rgba(5,5,5,.92);--mce-bg-deep:#0d0d0d;--mce-bg-base:#1a1a1a;--mce-bg-card:#111;--mce-bg-block:#0f0f0f;" +
		"--mce-bg-stage:#101010;--mce-bg-detail:#141414;--mce-bg-ctl:#181818;--mce-bg-btn:#222;--mce-bg-hover:#333;--mce-bg-sel:#18150c;" +
		"--mce-red:#ff6b6b;--mce-red-soft:#ff9c9c;--mce-red-deep:#c0392b;--mce-red-bg:#5a2323;--mce-red-bg-h:#6e2b2b;--mce-red-bg-b:#7a3030;" +
		"--mce-red-badge:#3a1c1c;--mce-red-badge-b:#5a2e2e;--mce-red-row:#170d0d;--mce-red-err:#2a1515;--mce-red-err-txt:#ffd0d0;--mce-red-err-src:#a07070;--mce-red-err-soft:#ffb0b0;--mce-red-errbox:#150b0b;" +
		"--mce-green:#7ed89a;--mce-green-deep:#2e9e52;--mce-green-badge:#1c3a24;--mce-green-badge-b:#2e5a3c;--mce-green-row:#0d1710;" +
		"--mce-border:#3c3c3c;--mce-border-soft:#333;--mce-border-dim:#2a2a2a;--mce-border-ctl:#3a3a3a;--mce-border-stage:#555;" +
		"--mce-txt:#f2f2f2;--mce-txt-bright:#fff;--mce-txt-on-accent:#111;--mce-txt-hi:#e6e6e6;--mce-txt-label:#d8d8d8;--mce-txt-strong:#eee;" +
		"--mce-txt-mid:#ccc;--mce-txt-dim:#b9b9b9;--mce-txt-faint:#aaa;--mce-txt-muted:#9c9c9c;--mce-txt-weak:#8a8a8a;--mce-txt-star:#666;" +
		"--mce-fs-xl:16px;--mce-fs-lg:15px;--mce-fs-tab:14px;--mce-fs-base:13px;--mce-fs-btn:12px;--mce-fs-sm:11px;--mce-fs-xs:10px;" +
		"--mce-radius:4px;--mce-radius-sm:2px;--mce-radius-pill:8px;" +
		"--mce-space:8px;--mce-space-md:6px;--mce-space-sm:4px;--mce-h-header:42px;--mce-panel-w:430px;--mce-panel-r:8px;--mce-row-h:34px;--mce-tab-h:36px;--mce-border-quiet:rgba(255,255,255,.08);--mce-scroll:8px;" +
		"}" +
		"#mce-root{display:none;position:fixed;top:8px;right:0;bottom:8px;width:var(--mce-panel-w);max-width:96vw;max-height:calc(100vh - 16px);z-index:2147483000;" +
		"background:var(--mce-bg-panel);border:1px solid var(--mce-border-quiet);border-right:none;border-radius:var(--mce-panel-r) 0 0 var(--mce-panel-r);box-shadow:0 10px 28px rgba(0,0,0,.55);" +
		"color:var(--mce-txt);flex-direction:column;overflow:hidden;" +
		"font-family:'Noto Serif SC','Source Han Serif SC','Microsoft YaHei',serif;font-size:var(--mce-fs-base);line-height:1.5}" +
		"#mce-root.mce-open{display:flex;animation:mce-pop-in .15s ease-out}" +
		"#mce-root.mce-closing{animation:mce-pop-out .12s ease-in forwards}" +
		"#mce-toggle{position:fixed;right:14px;bottom:14px;z-index:2147482999;width:52px;height:52px;border-radius:50%;" +
		"background:var(--mce-accent);color:var(--mce-txt-on-accent);border:2px solid var(--mce-accent-dark);font-size:var(--mce-fs-lg);font-weight:700;cursor:pointer;" +
		"box-shadow:0 4px 14px rgba(0,0,0,.6);font-family:inherit;touch-action:none;" +
		"user-select:none;-webkit-user-select:none;transition:background .12s ease,transform .12s ease,box-shadow .12s ease}" +
		"#mce-toggle:hover{background:var(--mce-accent-hover)}" +
		"#mce-toggle:active{transform:scale(.94)}" +
		"#mce-toggle.mce-dragging{cursor:grabbing!important;background:var(--mce-accent-hover);transform:none!important}" +
		".mce-header{display:flex;align-items:center;height:var(--mce-h-header);padding:0 10px;background:var(--mce-bg-base);" +
		"border-bottom:1px solid var(--mce-border-quiet);color:var(--mce-accent);font-weight:700;font-size:var(--mce-fs-lg)}" +
		".mce-header .mce-title{flex:1;text-align:center}" +
		".mce-header button{background:transparent;border:none;color:var(--mce-txt-mid);font-size:var(--mce-fs-xl);cursor:pointer;padding:0 7px}" +
		".mce-header button:hover{color:var(--mce-txt-bright)}" +
		".mce-tabs{display:flex;background:var(--mce-bg-deep);border-bottom:1px solid var(--mce-border-quiet);overflow-x:auto}" +
		/* v2.0.0.006 页签增至 7 个：改 flex:1 0 auto + nowrap + 横向滚动，避免「Mod作弊」被压窄换行 */
		".mce-tabs button{flex:1 0 auto;background:transparent;border:none;border-bottom:2px solid transparent;white-space:nowrap;" +
		"color:var(--mce-txt-dim);padding:8px 6px;min-height:var(--mce-tab-h);cursor:pointer;font-size:var(--mce-fs-tab);font-family:inherit}" +
		".mce-tabs button.mce-active{color:var(--mce-accent);border-bottom-color:var(--mce-accent)}" +
		".mce-body{flex:1;overflow-y:auto;padding:10px;min-height:120px;overscroll-behavior:contain}" +
		/* v1.9.18 容器自适应：面板内滚动条统一（金色系，随 token 主题）+ 分页 sticky 页头（header/tabs 为 flex 固定行，明确防压缩） */
		".mce-header,.mce-tabs{flex:none}" +
		"#mce-root ::-webkit-scrollbar{width:var(--mce-scroll);height:var(--mce-scroll)}" +
		"#mce-root ::-webkit-scrollbar-thumb{background:var(--mce-border-ctl);border-radius:var(--mce-radius-pill)}" +
		"#mce-root ::-webkit-scrollbar-thumb:hover{background:var(--mce-border)}" +
		"#mce-root ::-webkit-scrollbar-track{background:transparent}" +
		"#mce-root{scrollbar-width:thin;scrollbar-color:var(--mce-border-ctl) transparent}" +
		".mce-pane{display:none}.mce-pane.mce-active{display:block}" +
		/* 角色卡片 */
		".mce-cards{display:grid;grid-template-columns:1fr 1fr;gap:var(--mce-space)}" +
		".mce-card{background:var(--mce-bg-card);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius);padding:8px;cursor:pointer}" +
		".mce-card:hover{border-color:var(--mce-accent)}" +
		".mce-card.mce-sel{border-color:var(--mce-accent);background:var(--mce-bg-sel)}" +
		".mce-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:8px}" +
		".mce-card-name{flex:1 1 auto;min-width:0;color:var(--mce-txt-bright);font-weight:700;font-size:var(--mce-fs-base);white-space:normal;line-height:1.4;word-break:break-word}" +
		".mce-badge{font-size:var(--mce-fs-xs);padding:1px 6px;border-radius:var(--mce-radius-pill);white-space:nowrap}" +
		".mce-badge.mce-on{background:var(--mce-green-badge);color:var(--mce-green);border:1px solid var(--mce-green-badge-b)}" +
		".mce-badge.mce-off{background:var(--mce-red-badge);color:var(--mce-red);border:1px solid var(--mce-red-badge-b)}" +
		".mce-card-stats{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:var(--mce-fs-sm);color:var(--mce-txt-muted)}" +
		".mce-card-stats b{color:var(--mce-accent)}" +
		/* 数据卡 */
		/* v1.9.22 自查补：角色数据卡（07c-stage 角色数据卡，此前裸样式无容器视觉） */
		".mce-data-card{background:var(--mce-bg-card);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius);padding:8px;margin:var(--mce-space) 0}" +
		".mce-section{font-size:var(--mce-fs-btn);color:var(--mce-txt-muted);border-bottom:1px solid var(--mce-border-quiet);padding:2px 0 4px;margin:10px 0 6px}" +
		".mce-statrow{display:flex;align-items:center;gap:var(--mce-space-md);margin:5px 0;min-height:var(--mce-row-h);flex-wrap:wrap}" +
		".mce-statrow:hover .mce-label{color:var(--mce-accent)}" +
		".mce-label{color:var(--mce-txt-label);min-width:56px}" +
		".mce-value{color:var(--mce-accent);font-weight:700;min-width:44px;text-align:right}" +
		".mce-btn{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border:1px solid var(--mce-border);border-radius:var(--mce-radius);padding:3px 9px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit;" +
		"transition:background .12s ease,transform .12s ease,box-shadow .12s ease}" +
		".mce-btn:hover{background:var(--mce-bg-hover)}" +
		".mce-btn:active{transform:scale(.96)}" +
		".mce-btn.mce-gold{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent-dark);font-weight:700}" +
		".mce-btn.mce-gold:hover{background:var(--mce-accent-hover);transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.45)}" +
		".mce-btn.mce-gold:active{transform:scale(.96);box-shadow:none}" +
		".mce-btn.mce-red{background:var(--mce-red-bg);color:var(--mce-red-soft);border-color:var(--mce-red-bg-b)}" +
		".mce-btn.mce-red:hover{background:var(--mce-red-bg-h)}" +
		".mce-btn:disabled{opacity:.45;cursor:not-allowed}" +
		".mce-actions{display:flex;flex-wrap:wrap;gap:var(--mce-space-md);margin:var(--mce-space) 0}" +
		/* v2.0.2 按键排版：编号区块 / 二级分组 / 按钮网格 / 说明折叠 */
		".mce-block{margin:4px 0 10px}" +
		".mce-sec-title{display:flex;align-items:center;gap:6px;color:var(--mce-txt-strong);font-weight:700;font-size:var(--mce-fs-base);border-bottom:1px solid var(--mce-border-quiet);padding:2px 0 5px;margin:8px 0 6px}" +
		".mce-sec-n{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;border-radius:4px;background:var(--mce-accent);color:var(--mce-txt-on-accent);font-size:var(--mce-fs-sm);font-weight:700;padding:0 4px;flex:none}" +
		".mce-group{margin:8px 0 4px;padding:6px 8px 8px;background:var(--mce-bg-block);border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius);contain:content}" +
		".mce-group-h{display:flex;align-items:baseline;gap:6px;color:var(--mce-accent);font-weight:700;font-size:var(--mce-fs-btn);margin-bottom:2px}" +
		".mce-group-n{color:var(--mce-gold-soft);font-size:var(--mce-fs-sm);font-weight:400;opacity:.85}" +
		".mce-btn-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--mce-space-sm);margin:var(--mce-space-sm) 0 2px}" +
		".mce-btn-grid .mce-btn{width:100%;text-align:center;white-space:normal;line-height:1.35;padding:6px 8px}" +
		".mce-btn-grid .mce-btn:only-child{grid-column:1 / -1}" +
		".mce-hint.mce-fold{cursor:pointer;line-height:1.5}" +
		".mce-hint.mce-fold[data-open=\"0\"]{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
		".mce-hint.mce-fold:hover{color:var(--mce-txt-hi)}" +
		/* 折叠说明盒：收起时只留摘要行，展开后补出全部条目 */
		".mce-foldbox[data-open=\"0\"] .mce-hint:not(.mce-fold){display:none}" +
		".mce-foldbox[data-open=\"1\"] .mce-hint:not(.mce-fold){display:block;animation:mce-fade-in .2s ease-out}" +
		/* v2.0.10 区块折叠：标题行可点、箭头右对齐；收起时 body 不占位（整组收成一行） */
		".mce-sec-head{cursor:pointer;user-select:none;border-radius:var(--mce-radius-sm)}" +
		".mce-sec-head:hover{background:var(--mce-bg-hover)}" +
		".mce-sec-head:focus-visible{outline:1px solid var(--mce-accent)}" +
		".mce-sec-arrow{margin-left:auto;color:var(--mce-accent);font-size:var(--mce-fs-sm);line-height:1;padding-left:6px}" +
		".mce-sec-body{padding-top:2px}" +
		".mce-blockfold[data-open=\"0\"] .mce-sec-body{display:none}" +
		".mce-blockfold[data-open=\"1\"] .mce-sec-body{animation:mce-fade-in .2s ease-out}" +
		/* 内层标签 */
		".mce-inner{display:flex;gap:var(--mce-space-sm);margin:var(--mce-space) 0;border-bottom:1px solid var(--mce-border-quiet);padding-bottom:6px}" +
		".mce-inner button{background:var(--mce-bg-ctl);color:var(--mce-txt-faint);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius-sm);padding:3px 10px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit}" +
		".mce-inner button.mce-active{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent)}" +
		/* 阶段列表 */
		".mce-stages{display:flex;flex-direction:column;gap:var(--mce-space-md)}" +
		".mce-stage{border-left:3px solid var(--mce-border-stage);background:var(--mce-bg-stage);border-radius:var(--mce-radius-sm);padding:7px 9px}" +
		".mce-stage.mce-pass{border-left-color:var(--mce-green-deep);background:var(--mce-green-row)}" +
		".mce-stage.mce-fail{border-left-color:var(--mce-red-deep);background:var(--mce-red-row)}" +
		".mce-stage-head{display:flex;align-items:center;gap:var(--mce-space)}" +
		".mce-dot{width:9px;height:9px;border-radius:50%;flex:none}" +
		".mce-pass .mce-dot{background:var(--mce-green-deep)}" +
		".mce-fail .mce-dot{background:var(--mce-red-deep)}" +
		".mce-stage-name{color:var(--mce-txt-strong);font-weight:700;font-size:var(--mce-fs-base);flex:1}" +
		".mce-stage-txt{color:var(--mce-txt-dim);font-size:var(--mce-fs-sm);margin-top:4px;word-break:break-all;font-family:Consolas,Menlo,monospace}" +
		".mce-stage-note{color:var(--mce-gold-note);font-size:var(--mce-fs-sm);margin-top:3px}" +
		".mce-hint{color:var(--mce-txt-weak);font-size:var(--mce-fs-btn);margin:var(--mce-space-sm) 0}" +
		/* v1.9.22 自查补：剧情进度说明 note（07h-render，此前裸样式） */
		".mce-note{color:var(--mce-txt-dim);font-size:var(--mce-fs-sm);margin-top:3px;word-break:break-all}" +
		/* v1.5.2 使用提示（剧情页页首警示框） */
		".mce-warn{background:var(--mce-gold-bg);border:1px solid var(--mce-accent);color:var(--mce-gold-txt);font-size:var(--mce-fs-btn);margin:var(--mce-space-sm) 0;padding:8px 10px;border-radius:var(--mce-radius);line-height:1.6}" +
		".mce-err{color:var(--mce-red);font-size:var(--mce-fs-base)}" +
		".mce-ok{color:var(--mce-green);font-size:var(--mce-fs-base)}" +
		".mce-status{min-height:18px;padding:6px 10px;border-top:1px solid var(--mce-border-quiet);background:var(--mce-bg-deep);color:var(--mce-txt-muted);font-size:var(--mce-fs-btn)}" +
		/* v2.0.12 修特异性倒挂：.mce-ok/.mce-err 与 .mce-status 同为 (0,1,0) 且 .mce-status 定义在后 → 状态栏绿/红被灰色覆盖（146 处 setStatus 调用全无颜色）；组合选择器 (0,2,0) 拿优先权，面板内独立 .mce-ok/.mce-err 文本节点不受影响 */
		".mce-status.mce-ok{color:var(--mce-green)}.mce-status.mce-err{color:var(--mce-red)}" +
		/* v2.0.3 P4-2：写入前 diff 预览确认条（吸在面板底部不遮挡列表）；v2.0.7 D3：原先只有注释说「吸底」、CSS 无 sticky，实际挂在滚动内容最末尾玩家永远看不到 → 改 position:sticky + bottom:0（挂活动 pane 内，滚动容器 .mce-body）+ 顶部分隔阴影 */
		".mce-preview-bar{position:sticky;bottom:0;z-index:12;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-top:1px solid var(--mce-accent);background:var(--mce-gold-bg);color:var(--mce-gold-txt);font-size:var(--mce-fs-btn);box-shadow:0 -6px 14px rgba(0,0,0,.45)}" +
		".mce-preview-lbl{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
		/* P1：自定义锁定项的来源徽标（角色页 / Mod作弊 / 手动） */
		".mce-badge.mce-src{background:var(--mce-bg-ctl);color:var(--mce-txt-faint);border:1px solid var(--mce-border-soft);border-radius:var(--mce-radius-sm);padding:1px 6px;font-size:11px;white-space:nowrap}" +
		".mce-build{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:var(--mce-space-sm) 0}" +
		/* v1.4.0 Mod作弊页面 */
		/* v1.9.1（DoL-Game-UI 冲突排查）：.mce-grp 加 contain:content——限制组内重排/重绘范围，减少大列表（如枯木 28 数值项展开）对 DoL-Game-UI 每帧 rAF 全量扫描的主线程压力 */
		".mce-grp{border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius);margin:var(--mce-space) 0;padding:8px;background:var(--mce-bg-block);contain:content}" +
		".mce-grp-t{color:var(--mce-txt-strong);font-weight:700;font-size:var(--mce-fs-base);margin-bottom:6px}" +
		".mce-collapse-head{cursor:pointer;user-select:none}" +
		".mce-collapse-head:hover{color:var(--mce-gold-soft)}" +
		".mce-grp-body[data-collapsed=\"1\"]{display:none}" +
		/* v1.9.14 效果4：折叠组展开淡入（display:none→block 切换时动画自动重放，覆盖 Mod 作弊/特质/角色/剧情全部折叠组） */
		".mce-grp-body[data-collapsed=\"0\"]{animation:mce-fade-in .2s ease-out}" +
		".mce-row{display:flex;align-items:center;gap:var(--mce-space);flex-wrap:wrap;padding:6px 0;min-height:var(--mce-row-h);font-size:var(--mce-fs-btn)}" +
		".mce-row:hover .mce-row-lbl,.mce-row:hover .mce-row-name{color:var(--mce-accent)}" +
		".mce-row-lbl,.mce-row-name{color:var(--mce-txt-hi);flex:1;min-width:120px;word-break:break-all}" +
		/* v2.0.12：.mce-btn-active (0,1,0) 被 .mce-row button (0,1,1) 盖掉 → 行内按钮（性别切换）选中金底从没显示过（只剩文字里的 ✓）；抬到 #mce-root 层级 (1,1,0) */
		"#mce-root .mce-btn-active{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent);font-weight:700}" +
		".mce-row button{background:var(--mce-bg-ctl);color:var(--mce-txt-mid);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 8px;min-height:22px;cursor:pointer;font-size:var(--mce-fs-btn);font-family:inherit}" +
		".mce-row button:hover{border-color:var(--mce-accent);color:var(--mce-accent)}" +
		".mce-inp{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 6px;font-size:var(--mce-fs-btn);width:90px;font-family:Consolas,Menlo,monospace}" +
		".mce-search-inp{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 6px;font-size:var(--mce-fs-btn);width:220px;max-width:100%;font-family:Consolas,Menlo,monospace}" +
		/* v1.9.22 自查补：锁定页自由添加 varPath 输入框（宽 200px 曾直写 JS 内联样式，现回归 CSS） */
		".mce-inp.mce-path{width:200px;max-width:100%}" +
		".mce-sel{background:var(--mce-bg-deep);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);border-radius:var(--mce-radius);padding:3px 4px;font-size:var(--mce-fs-btn);font-family:inherit;max-width:170px;flex:0 1 auto}" +
		".mce-inp:focus,.mce-search-inp:focus,.mce-sel:focus{outline:none;border-color:var(--mce-accent)}" +
		/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档） */
		".mce-ab-detail{margin-left:4px;font-size:var(--mce-fs-sm)}" +
		".mce-ab-sum{cursor:pointer;color:var(--mce-txt-weak);user-select:none;display:inline-block}" +
		".mce-ab-sum:hover{color:var(--mce-gold-soft)}" +
		".mce-ab-body{background:var(--mce-bg-detail);border:1px solid var(--mce-border-dim);border-radius:var(--mce-radius-sm);padding:5px 8px;margin-top:3px;color:var(--mce-txt-dim);line-height:1.7;min-width:220px}" +
		".mce-ab-note{color:var(--mce-gold-note);margin-top:2px}" +
		/* v1.8.12 特质收藏星标 */
		".mce-favstar{background:transparent;border:none;padding:0 5px;cursor:pointer;color:var(--mce-txt-star);font-size:var(--mce-fs-btn);line-height:1}" +
		".mce-favstar:hover{color:var(--mce-gold-soft)}" +
		".mce-favstar.mce-fav{color:var(--mce-accent)}" +
		/* v1.8.12 错误收集器 */
		".mce-errbtn{background:var(--mce-red-bg);color:var(--mce-red-soft);border:1px solid var(--mce-red-bg-b);border-radius:50%;" +
		"min-width:20px;height:20px;line-height:18px;font-size:var(--mce-fs-sm);font-weight:700;cursor:pointer;padding:0 4px;display:none}" +
		".mce-errbtn.mce-on{display:inline-block}" +
		".mce-errbox{display:none;background:var(--mce-red-errbox);border-bottom:1px solid var(--mce-border-quiet);max-height:40%;overflow-y:auto;padding:6px 8px}" +
		".mce-errbox.mce-on{display:block}" +
		".mce-errrow{border-top:1px solid var(--mce-red-err);padding:4px 0;font-size:var(--mce-fs-sm);color:var(--mce-red-err-soft);font-family:Consolas,Menlo,monospace;word-break:break-all}" +
		".mce-errrow .mce-err-msg{color:var(--mce-red-err-txt)}" +
		".mce-errrow .mce-err-src{color:var(--mce-red-err-src);font-size:var(--mce-fs-xs)}" +
		/* v1.9.14 UI 动效：面板内全部按钮统一按压反馈（缩放）与过渡；写入成功闪烁 + 面板开合/折叠淡入 keyframes */
		"#mce-root button{transition:background .12s ease,color .12s ease,transform .12s ease,box-shadow .12s ease}" +
		"#mce-root button:active{transform:scale(.96)}" +
		".mce-flash{animation:mce-flash .6s ease-out}" +
		"@keyframes mce-pop-in{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}" +
		"@keyframes mce-pop-out{from{opacity:1}to{opacity:0}}" +
		"@keyframes mce-fade-in{from{opacity:0}to{opacity:1}}" +
		"@keyframes mce-flash{0%{background:var(--mce-accent-55);box-shadow:0 0 0 1px var(--mce-accent)}100%{background:transparent;box-shadow:none}}" +
		/* v1.9.29 锚定确认条 token 化：此前内联米色/绿/灰（#f5f0e0/#7a9b4f/#888），与面板黑金 token 脱节——改走 CSS 类，换主题自动跟随 */
		".mce-anchor-prompt{position:fixed;top:0;left:0;right:0;z-index:2147483647;background:var(--mce-gold-bg);color:var(--mce-gold-txt);" +
		"border-bottom:2px solid var(--mce-accent);padding:8px 12px;font-size:14px;line-height:1.6;box-shadow:0 2px 8px rgba(0,0,0,.3);" +
		"display:flex;flex-wrap:wrap;align-items:center;gap:8px;animation:mce-prompt-in .18s ease-out}" +
		".mce-anchor-prompt button{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border:1px solid var(--mce-border-ctl);" +
		"border-radius:var(--mce-radius);padding:4px 12px;cursor:pointer;font-size:13px;font-family:inherit;transition:background .12s ease,transform .12s ease}" +
		".mce-anchor-prompt button:hover{background:var(--mce-bg-hover)}" +
		".mce-anchor-prompt button:active{transform:scale(.96)}" +
		".mce-anchor-prompt .mce-anchor-go{margin-left:auto;background:var(--mce-accent);color:var(--mce-txt-on-accent);" +
		"border-color:var(--mce-accent-dark);font-weight:700}" +
		".mce-anchor-prompt .mce-anchor-go:hover{background:var(--mce-accent-hover)}" +
		"@keyframes mce-prompt-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}" +
		/* v1.9.29 星空蓝主题：深蓝夜空 + 星辉（accent 星蓝、金保留为点缀）。token 化红利——换主题只覆盖变量，组件零改动 */
		"#mce-root.mce-theme-starry{--mce-accent:#8fb3ff;--mce-accent-hover:#a9c4ff;--mce-accent-dark:#5d82d9;--mce-accent-55:rgba(143,179,255,.55);" +
		"--mce-gold-soft:#ffd98a;--mce-gold-note:#8fa3d9;--mce-gold-bg:#1a2140;--mce-gold-txt:#c9d8ff;" +
		"--mce-bg-panel:rgba(6,8,20,.94);--mce-bg-deep:#0c1022;--mce-bg-base:#10142a;--mce-bg-card:#131a36;--mce-bg-block:#0e1326;" +
		"--mce-bg-stage:#111631;--mce-bg-detail:#141b3c;--mce-bg-ctl:#1a2142;--mce-bg-btn:#1e2750;--mce-bg-hover:#2a3768;--mce-bg-sel:#1a1f3d;" +
		"--mce-border:#3d4a80;--mce-border-soft:#333e6e;--mce-border-dim:#2a3360;--mce-border-ctl:#3d4a80;--mce-border-stage:#5d7fd9;" +
		"--mce-txt:#eef2ff;--mce-txt-bright:#fff;--mce-txt-on-accent:#0a0e20;--mce-txt-hi:#e8edff;--mce-txt-label:#d9e0ff;--mce-txt-strong:#f0f3ff;" +
		"--mce-txt-mid:#c3cbee;--mce-txt-dim:#aab4e0;--mce-txt-faint:#96a2d4;--mce-txt-muted:#8b97cc;--mce-txt-weak:#7c88bf;--mce-txt-star:#5a679e;" +
		"--mce-border-quiet:rgba(160,180,255,.12);" +
		"background:radial-gradient(1200px 600px at 85% -10%,rgba(90,130,255,.16),transparent 60%),radial-gradient(900px 500px at -10% 110%,rgba(150,100,255,.10),transparent 55%),var(--mce-bg-panel)}" +
		/* 星空氛围：内容区星点（径向渐变点阵，无图零请求） */
		"#mce-root.mce-theme-starry .mce-body{background-image:radial-gradient(1px 1px at 12% 20%,rgba(255,255,255,.55),transparent)," +
		"radial-gradient(1px 1px at 31% 64%,rgba(190,215,255,.35),transparent),radial-gradient(1.2px 1.2px at 57% 10%,rgba(255,255,255,.4),transparent)," +
		"radial-gradient(1px 1px at 76% 42%,rgba(190,215,255,.3),transparent),radial-gradient(1.3px 1.3px at 87% 76%,rgba(255,255,255,.45),transparent)," +
		"radial-gradient(1px 1px at 44% 92%,rgba(190,215,255,.3),transparent);background-color:transparent}" +
		/* 悬浮球星蓝渐变 + 星辉光晕呼吸（3.5s，不影响阅读） */
		"#mce-toggle.mce-theme-starry{background:linear-gradient(135deg,#2a3768,#5d82d9 55%,#8fb3ff);border-color:#8fb3ff;animation:mce-toggle-glow 3.5s ease-in-out infinite}" +
		"@keyframes mce-toggle-glow{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 8px rgba(143,179,255,.35)}50%{box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 18px rgba(143,179,255,.7)}}" +
		/* 锚定确认条跟随主题（条在 #story 内、root 外，不继承 root 星空变量——把星空 token 组定义在条自身元素上，子按钮经继承引用） */
		".mce-anchor-prompt.mce-theme-starry{--mce-gold-bg:#1a2140;--mce-gold-txt:#c9d8ff;--mce-accent:#8fb3ff;--mce-accent-hover:#a9c4ff;" +
		"--mce-accent-dark:#5d82d9;--mce-txt-on-accent:#0a0e20;--mce-bg-btn:#1e2750;--mce-txt-strong:#f0f3ff;--mce-border-ctl:#3d4a80;--mce-bg-hover:#2a3768;" +
		"background:var(--mce-gold-bg);color:var(--mce-gold-txt);border-bottom-color:var(--mce-accent)}" +
		".mce-anchor-prompt.mce-theme-starry button{background:var(--mce-bg-btn);color:var(--mce-txt-strong);border-color:var(--mce-border-ctl)}" +
		".mce-anchor-prompt.mce-theme-starry button:hover{background:var(--mce-bg-hover)}" +
		".mce-anchor-prompt.mce-theme-starry .mce-anchor-go{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent-dark)}" +
		".mce-anchor-prompt.mce-theme-starry .mce-anchor-go:hover{background:var(--mce-accent-hover)}" +
		/* v2.0.7 P5：窄屏（≤520px，手机竖屏 / 桌面分屏）控件拥挤——面板转全屏、行内 label 独占一行、
		   按钮网格单列、预览条说明换行，避免 84-90px 输入框 + 两个按钮挤在同一行而溢出错位 */
		"@media (max-width:520px){" +
		"#mce-root{top:0;right:0;bottom:0;left:0;width:100vw;max-width:100vw;max-height:100vh;border-radius:0;border:none}" +
		".mce-body{padding:8px}" +
		".mce-tabs button{padding:8px 5px}" +
		".mce-row{gap:var(--mce-space-sm)}" +
		".mce-row-lbl,.mce-row-name{flex:1 1 100%;min-width:0}" +
		".mce-inp{width:84px}" +
		".mce-search-inp{width:100%}" +
		".mce-inp.mce-path{width:100%}" +
		".mce-btn-grid{grid-template-columns:1fr}" +
		".mce-cards{grid-template-columns:1fr}" +
		".mce-preview-bar{gap:6px}" +
		".mce-preview-lbl{flex:1 1 100%;white-space:normal;overflow:visible}" +
		".mce-anchor-prompt{padding:6px 8px;font-size:13px}" +
		"}";

	function injectCSS() {
		if (document.getElementById("mce-style")) { return; }
		var style = el("style", "");
		style.id = "mce-style";
		style.textContent = MB_CSS;
		(document.head || document.documentElement).appendChild(style);
	}

	function setStatus(text, cls) {
		var st = root && root.querySelector(".mce-status");
		if (!st) { return; }
		st.textContent = text;
		st.className = "mce-status" + (cls ? " " + cls : "");
	}
/* 职责：面板外壳续 —— 外层页签分发（switchOuterTab）、页签状态持久化（mbCEUiLoad / mbCEUiSave / mbCEUiCollapsed）、主题切换 */
	function switchOuterTab(name) {
		var tabs = root.querySelectorAll(".mce-tabs button");
		var i;
		for (i = 0; i < tabs.length; i++) {
			tabs[i].classList.toggle("mce-active", tabs[i].getAttribute("data-tab") === name);
		}
		var panes = root.querySelectorAll(".mce-pane");
		for (i = 0; i < panes.length; i++) {
			panes[i].classList.toggle("mce-active", panes[i].getAttribute("data-pane") === name);
		}
		mbCEUiSave({ tab: name }); /* v1.8.12 持久化：记录当前页签 */
		if (name === "char") { renderCards(); }
		if (name === "stage") { renderStagePane(); }
		if (name === "scenes") { renderScenes(); }
		if (name === "places") { renderPlaces(); }
		if (name === "global") { renderGlobal(); }
		if (name === "mods") { renderModCheats(); }
		if (name === "yanling") { renderYanling(); } /* v2.0.0.006 言灵页（07i-yanling.js） */
	}

	/* ============ v1.8.12 面板状态持久化（localStorage：页签 / 特质搜索词 / 折叠状态 / 当前角色 / 内层页签） ============ */
	/** @type {any} */
	var mbCEUiState = { tab: "char", filter: "", collapsed: {}, curName: "", innerTab: "romance", placesTab: "direct", theme: "gold", charFilter: "", diffPreview: "0" };
	var mbCEUiStateKey = "mbCE_ui_state_v1";
	function mbCEUiLoad() {
		try {
			var raw = (typeof localStorage !== "undefined" && localStorage) ? localStorage.getItem(mbCEUiStateKey) : null;
			if (!raw) { return; }
			var obj = JSON.parse(raw);
			if (obj && typeof obj === "object") {
				if (typeof obj.tab === "string") { mbCEUiState.tab = obj.tab; }
				if (typeof obj.filter === "string") { mbCEUiState.filter = obj.filter; curPlayerFilter = obj.filter; }
				if (obj.collapsed && typeof obj.collapsed === "object") { mbCEUiState.collapsed = obj.collapsed; }
				/* v1.8.12 二轮优化：记住上次操作角色与角色页内层页签（切存档/重开面板免重新找） */
				if (typeof obj.curName === "string") { mbCEUiState.curName = obj.curName; }
				if (obj.innerTab === "romance" || obj.innerTab === "transform") { mbCEUiState.innerTab = obj.innerTab; curInnerTab = obj.innerTab; }
				/* v1.9.0 场景页子页签持久化（场景直达/地点） */
				if (obj.placesTab === "stage" || obj.placesTab === "direct") { mbCEUiState.placesTab = obj.placesTab; }
				/* v1.9.29 主题与角色页搜索词持久化 */
				if (obj.theme === "starry" || obj.theme === "gold") { mbCEUiState.theme = obj.theme; }
				if (typeof obj.charFilter === "string") { mbCEUiState.charFilter = obj.charFilter; charSearch = obj.charFilter; }
				/* v2.0.7：diff 预览开关持久化（此前 mbCEUiLoad 无此分支，刷新页面后开关丢失 →
				   玩家体感「预览没啥作用」）。只有明确存过 "1"/"0" 才恢复。 */
				if (obj.diffPreview === "1" || obj.diffPreview === "0" || obj.diffPreview === "true" || obj.diffPreview === "false") {
					mbCEUiState.diffPreview = (obj.diffPreview === "1" || obj.diffPreview === "true") ? "1" : "0";
				}
			}
		} catch (e) {}
	}
	function mbCEUiSave(partial) {
		try {
			if (partial) {
				if (typeof partial.tab === "string") { mbCEUiState.tab = partial.tab; }
				if (typeof partial.filter === "string") { mbCEUiState.filter = partial.filter; }
				if (partial.collapsed) { mbCEUiState.collapsed = partial.collapsed; }
				if (typeof partial.curName === "string") { mbCEUiState.curName = partial.curName; }
				if (partial.innerTab === "romance" || partial.innerTab === "transform") { mbCEUiState.innerTab = partial.innerTab; }
				if (partial.placesTab === "stage" || partial.placesTab === "direct") { mbCEUiState.placesTab = partial.placesTab; }
				if (partial.theme === "starry" || partial.theme === "gold") { mbCEUiState.theme = partial.theme; }
				if (typeof partial.charFilter === "string") { mbCEUiState.charFilter = partial.charFilter; }
				/* v2.0.7：diff 预览开关（"1"/"0"）与布尔入参都接受 */
				if (partial.diffPreview === "1" || partial.diffPreview === "0" || partial.diffPreview === "true" || partial.diffPreview === "false" ||
					partial.diffPreview === true || partial.diffPreview === false) {
					mbCEUiState.diffPreview = (partial.diffPreview === "1" || partial.diffPreview === "true" || partial.diffPreview === true) ? "1" : "0";
				}
			}
			if (typeof localStorage !== "undefined" && localStorage) {
				localStorage.setItem(mbCEUiStateKey, JSON.stringify(mbCEUiState));
			}
		} catch (e) {}
	}
	function mbCEUiCollapsed(tcat, open) {
		mbCEUiState.collapsed[tcat] = open ? 0 : 1;
		mbCEUiSave({ collapsed: mbCEUiState.collapsed });
	}

	/* ============ v1.9.29 双主题：黑金（gold）⇄ 星空蓝（starry） ============ */
	/* 切换只改 #mce-root 与悬浮球的主题类 + localStorage 持久化（token 覆盖在 07a-shell CSS 串）。
	   silent=true 用于初始化恢复（mbCEUiLoad 已持久化到 state，恢复时不重复写）。 */
	function setTheme(name, silent) {
		try {
			var t = name === "starry" ? "starry" : "gold";
			mbCETheme = t;
			if (root && root.classList) { root.classList.toggle("mce-theme-starry", t === "starry"); }
			if (toggleBtn && toggleBtn.classList) { toggleBtn.classList.toggle("mce-theme-starry", t === "starry"); }
			if (!silent) { mbCEUiSave({ theme: t }); }
			return t;
		} catch (e) { return "gold"; }
	}
	function getTheme() { return mbCETheme; }

	/* ============ v1.8.12 面板内错误收集器（window error + console.error → 红点 + 堆栈 + 一键复制） ============ */
	var mbCEErrors = [];
	var mbCEErrCap = 50;
	var mbCEHookDone = false;
	var mbCEErrBtn = null;
	var mbCEErrBox = null;
	var mbCEErrRows = null;
	/* v1.8.12 三巡优化：风暴熔断状态——同源 60 秒窗口合并计数，单源 ≥20 熔断 60 秒，全局 ≥200/分钟 全熔断 30 秒。
	   切断「第三方特效层每帧 console.error → 收集器高频 DOM 写」的放大循环（DoLGameUI 等每帧刷 spotlight/glow 报错时不再卡顿）。
	   四巡优化：byKey 有界（>500 丢弃最旧一半）+ 速率桶化（每分钟两桶 O(1)，替代时间戳数组）+ 面板关闭不写 badge DOM。 */
	var mbCEFuse = { byKey: {}, curCount: 0, prevCount: 0, minIdx: -1, pushCount: 0, fuseAllUntil: 0 };
	var mbCEBadgeTimer = null;
	function mbCEInFuseAll() { return Date.now() < mbCEFuse.fuseAllUntil; }
	function mbCEFuseClean() {
		try {
			var keys = Object.keys(mbCEFuse.byKey);
			if (keys.length <= 500) { return; }
			keys.sort(function (a, b) { return mbCEFuse.byKey[a].t - mbCEFuse.byKey[b].t; });
			var drop = Math.floor(keys.length / 2);
			for (var i = 0; i < drop; i++) { delete mbCEFuse.byKey[keys[i]]; }
		} catch (e) {}
	}
	function mbCEUpdateErrBadge(force) {
		/* 面板关闭时只记数据不写 DOM（省 CPU）；open() 时 force 刷新 */
		if (!openFlag && !force) { return; }
		/* force=true（清空/打开面板等明确操作）→ 同步立即写，不节流；普通 push 200ms 节流合并 */
		if (force) {
			if (mbCEBadgeTimer) { clearTimeout(mbCEBadgeTimer); mbCEBadgeTimer = null; }
			mbCEWriteErrBadge();
			return;
		}
		if (mbCEBadgeTimer) { return; }
		mbCEBadgeTimer = setTimeout(function () {
			mbCEBadgeTimer = null;
			mbCEWriteErrBadge();
		}, 200);
	}
	function mbCEWriteErrBadge() {
		try {
			if (!mbCEErrBtn) { return; }
			var n = mbCEErrors.length;
			mbCEErrBtn.textContent = n > 99 ? "99+" : String(n);
			if (mbCEErrBtn.classList) { mbCEErrBtn.classList.toggle("mce-on", n > 0); }
			else if (mbCEErrBtn.style) { mbCEErrBtn.style.display = n > 0 ? "inline-block" : "none"; }
			mbCEErrBtn.title = "面板内错误收集：" + n + " 条（点击查看 / 一键复制）" + (mbCEInFuseAll() ? " ⚠ 高频错误已熔断" : "");
		} catch (e) {}
	}
	function mbCEFmtTime(t) {
		var d = new Date(t || Date.now());
		function p(n) { return n < 10 ? "0" + n : String(n); }
		return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
	}
	function mbCEPushError(msg, src, stack) {
		try {
			var now = Date.now();
			var m = String(msg || "未知错误").slice(0, 400);
			/* 七巡/九巡：第三方噪音源归一化——DoLGameUI 特效层 4 种消息 + 其他已知第三方模组报错（DependenceChecker/
			   TweeReplacer/ReplacePatcher/ModOrderContainer），交替刷屏时各自独立成源绕过单源熔断，归一为同源后
			   命中「单源 ≥20 熔断」，不再以多源各刷十几条挤满收集器 */
			var noiseRules = [
				{ re: /^Error evaluating layer (spotlight|glow|linearGradient|flatColorOverlay) property src$/, label: "特效层(DoLGameUI)" },
				{ re: /^DependenceChecker\.check\(\) not found mod /, label: "DependenceChecker(DoLGameUI)" },
				{ re: /^\[TweeReplacer\] do_patch\(\)/, label: "TweeReplacer(第三方)" },
				{ re: /^\[ReplacePatcher\] patchInReplaceParamsItem\(\)/, label: "ReplacePatcher(Paperdoll+)" },
				{ re: /^ModOrderContainer getByNameOneWithAlias\(\) cannot find name\/alias\./, label: "ModOrderContainer(第三方)" },
				{ re: /^ModOrderContainer getByNameOne\(\) cannot find name\./, label: "ModOrderContainer(SimpleFrameworks)" }
			];
			for (var ni = 0; ni < noiseRules.length; ni++) {
				if (noiseRules[ni].re.test(m)) { m = "第三方噪音·" + noiseRules[ni].label; break; }
			}
			var s = String(src || "").slice(0, 200);
			var key = m + "|" + s;
			/* 风暴计数（60 秒窗口） */
			var st = mbCEFuse.byKey[key];
			if (!st || (now - st.t) > 60000) { st = { n: 0, t: now }; }
			st.n++;
			st.t = now;
			mbCEFuse.byKey[key] = st;
			/* 全局速率：每分钟滚动两桶 O(1) 计数（四巡：替代时间戳数组，错误风暴下内存恒定） */
			var minNow = Math.floor(now / 60000);
			if (mbCEFuse.minIdx !== minNow) {
				mbCEFuse.prevCount = mbCEFuse.curCount;
				mbCEFuse.curCount = 0;
				mbCEFuse.minIdx = minNow;
			}
			mbCEFuse.curCount++;
			if (mbCEFuse.curCount + mbCEFuse.prevCount >= 200) { mbCEFuse.fuseAllUntil = now + 30000; }
			/* 四巡：熔断计数表有界——每 64 次 push 检查一次，>500 键丢弃最旧一半（防御错误源键无限变化） */
			mbCEFuse.pushCount++;
			if (mbCEFuse.pushCount % 64 === 0) { mbCEFuseClean(); }
			/* 熔断判定：单源 ≥20 次（窗口内）或全局熔断期 → 忽略不占条目 */
			if (st.n > 20 || mbCEInFuseAll()) { mbCEUpdateErrBadge(); return; }
			/* 同源 60 秒内合并计数（×N） */
			var last = mbCEErrors.length ? mbCEErrors[mbCEErrors.length - 1] : null;
			if (last && last.msg === m && last.src === s && (now - last.t) < 60000) {
				last.n = (last.n || 1) + 1;
				last.t = now;
				mbCEUpdateErrBadge();
				return;
			}
			mbCEErrors.push({ t: now, msg: m, src: s, stack: String(stack || "").slice(0, 800), n: 1 });
			if (mbCEErrors.length > mbCEErrCap) { mbCEErrors.shift(); }
			mbCEUpdateErrBadge();
		} catch (e) {}
	}
	function mbCERenderErrBox() {
		if (!mbCEErrRows) { return; }
		mbCEErrRows.textContent = "";
		/* v1.8.12 三巡优化：熔断提示（高频第三方错误被忽略时告知用户） */
		if (mbCEInFuseAll()) {
			mbCEErrRows.appendChild(el("div", "mce-errrow mce-err-fuse", "⚠ 高频错误风暴已熔断（30 秒）：期间同类错误不再记录，避免刷屏卡顿。点击「清空」可复位。"));
		}
		if (!mbCEErrors.length) {
			mbCEErrRows.appendChild(el("div", "mce-errrow", "（无记录的错误）"));
		}
		var i;
		for (i = mbCEErrors.length - 1; i >= 0; i--) {
			var e = mbCEErrors[i];
			var row = el("div", "mce-errrow");
			row.appendChild(el("div", "mce-err-msg", "[" + mbCEFmtTime(e.t) + "] #" + (mbCEErrors.length - i) + " " + e.msg + (e.n > 1 ? " ×" + e.n : "")));
			if (e.src) { row.appendChild(el("div", "mce-err-src", e.src)); }
			if (e.stack) { row.appendChild(el("div", "mce-err-src", String(e.stack).split("\n").slice(0, 3).join(" ↲ "))); }
			mbCEErrRows.appendChild(row);
		}
	}
	function mbCEToggleErrBox() {
		if (!mbCEErrBox) { return; }
		var on = mbCEErrBox.classList.toggle("mce-on");
		if (on) { mbCERenderErrBox(); }
	}
	function mbCECopyErrors() {
		try {
			var text = mbCEErrors.map(function (e, i) { return "#" + (i + 1) + " " + e.msg + (e.n > 1 ? " ×" + e.n : "") + (e.src ? " @" + e.src : "") + (e.stack ? "\n" + e.stack : ""); }).join("\n\n");
			if (!text) { text = "（无错误记录）"; }
			if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(function () { setStatus("已复制 " + mbCEErrors.length + " 条错误到剪贴板", "mce-ok"); }, function () { setStatus("复制失败（浏览器限制），请手动选择", "mce-err"); });
			} else {
				setStatus("（共 " + mbCEErrors.length + " 条错误，详见上方列表）", "");
			}
		} catch (e) { setStatus("复制失败", "mce-err"); }
	}
	function mbCEHookErrors() {
		if (mbCEHookDone) { return; }
		mbCEHookDone = true;
		try {
			if (typeof window === "undefined") { return; }
			window.addEventListener("error", function (ev) {
				try {
					var e = ev && ev.error;
					mbCEPushError(ev && ev.message ? ev.message : "未知错误",
						ev && ev.filename ? ev.filename + (ev.lineno ? ":" + ev.lineno : "") : "",
						e && e.stack ? e.stack : "");
				} catch (e2) {}
			});
			/* v1.8.12 优化：Promise 拒绝（未捕获的 async/await 异常）同样进面板 */
			if (typeof window.addEventListener === "function") {
				window.addEventListener("unhandledrejection", function (ev) {
					try {
						var r = ev && ev.reason;
						mbCEPushError("未处理的 Promise 拒绝：" + (r && r.message ? r.message : (r ? String(r) : "未知原因")),
							"unhandledrejection",
							r && r.stack ? r.stack : "");
					} catch (e2) {}
				});
			}
			if (window.console && typeof window.console.error === "function") {
				var origErr = window.console.error;
				window.console.error = function () {
					try {
						var parts = [];
						for (var i = 0; i < arguments.length; i++) {
							var a = arguments[i];
							parts.push(a && a.stack ? a.stack : String(a));
						}
						mbCEPushError(parts.join(" | "), "console.error", "");
					} catch (e2) {}
					origErr.apply(this, /** @type {any} */ (arguments));
				};
			}
		} catch (e) {}
	}

	/* ---- 角色一览卡片（v1.9.0：按类型拆子页面，按钮展开/收起） ---- */
	/* v1.9.29 角色页搜索词（mbCEUiLoad 恢复时同步；input 实时过滤后重建卡片） */
	var charSearch = "";
	/* 分类顺序：模组角色 / 恋爱角色 / 普通角色 / 持久NPC（子页面名称按角色类型命名） */
	var CHAR_CATEGORIES = [
		{ cat: "mod", title: "模组角色", desc: "非原版角色池的角色（MOD 注入/框架注册）" },
		{ cat: "love", title: "恋爱角色", desc: "官方恋人清单 + 框架恋爱条件角色" },
		{ cat: "normal", title: "普通角色", desc: "原版普通命名 NPC" },
		{ cat: "pernpc", title: "持久NPC", desc: "经理/校医/黑客/主教/守卫/囚犯等持久特殊 NPC" }
	];
	function charSectionKey(cat) { return "角色:" + cat; }
	/* v1.9.2 自查：模组角色分区内细分「恋爱角色 / 普通角色」（按 isLoveCharacter 再判定） */
	function buildModSubGroups(body, members) {
		var loveM = [], normM = [];
		members.forEach(function (n) { (isLoveCharacter(n) ? loveM : normM).push(n); });
		function sub(title, list) {
			var subHead = el("div", "mce-stage-head mce-line-head", title + "（" + list.length + "）");
			body.appendChild(subHead);
			if (list.length) { buildCharCards(body, null, list); }
			else { body.appendChild(el("div", "mce-hint", "（暂无）")); }
		}
		sub("模组·恋爱角色", loveM);
		sub("模组·普通角色", normM);
	}
	/* v1.9.0 自查优化：分组卡片构建（懒渲染——收起组不建行，展开时补建；与九巡 mods 页特质区同款语义） */
	/* v1.9.2 自查：模组分区内细分（恋爱/普通），其余分类直接建卡片 */
	function buildGroupCards(body, group, members) {
		if (group.cat === "mod") { buildModSubGroups(body, members); }
		else { buildCharCards(body, group, members); }
	}
	function buildCharCards(body, group, members) {
		var grid = el("div", "mce-cards");
		members.forEach(function (name) {
			var npc = findNpcEx(name);
			var st = getNpcState(name);
			var active = st.state !== "dismissed";
			var card = el("div", "mce-card" + (name === curName ? " mce-sel" : ""));
			var top = el("div", "mce-card-top");
			top.appendChild(el("span", "mce-card-name", displayNameEx(name)));
			var badge = el("span", "mce-badge " + (active ? "mce-on" : "mce-off"), active ? "活跃" : "停用");
			badge.title = "state: " + st.state;
			top.appendChild(badge);
			card.appendChild(top);
			var stats = el("div", "mce-card-stats");
			stats.appendChild(el("span", "", "爱意 <b>" + statValue(npc, name, STAT_DEFS[0]) + "</b>"));
			stats.appendChild(el("span", "", "支配 <b>" + statValue(npc, name, STAT_DEFS[2]) + "</b>"));
			stats.appendChild(el("span", "", "情欲 <b>" + statValue(npc, name, STAT_DEFS[1]) + "</b>"));
			stats.appendChild(el("span", "", "警戒 <b>" + statValue(npc, name, STAT_DEFS[5]) + "</b>"));
			card.appendChild(stats);
			card.addEventListener("click", function () {
				curName = name;
				mbCEUiSave({ curName: name }); /* v1.8.12 二轮优化：记住当前操作角色 */
				switchOuterTab("stage");
			});
			grid.appendChild(card);
		});
		body.appendChild(grid);
	}
	function renderCards() {
		var pane = root.querySelector('[data-pane="char"]');
		var keepScroll = typeof pane.scrollTop === "number" ? pane.scrollTop : 0; /* 重建后保持滚动位置（五巡一致） */
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架（window.maplebirch / setup.MapleBirch）。"));
			return;
		}
		var charsAll = listCharacters();
		/* v2.0.0.002 需求③：FertilityExpansion「成年结算」的孩子会被写进 $NPCList（带 edenChildId 标记），
		   随机英文名让它们被判成模组角色混进角色页（玩家截图「多出一堆英文名」）。这里统一摘出去，
		   收进「模组作弊 → fertility-expansion → 孩子」页做数值调整。 */
		var charsKids = charsAll.filter(function (n) { return charCategory(n) === "edenChild"; });
		var chars = charsAll.filter(function (n) { return charCategory(n) !== "edenChild"; });
		if (!charsAll.length) {
			pane.appendChild(el("div", "mce-hint", "注册池为空：未枚举到任何角色。"));
			return;
		}
		/* v1.9.29 角色页搜索：与特质/Mod 数值搜索同款 .mce-search-inp；按原名/显示名实时过滤，词持久化 charFilter */
		var q = charSearch.toLowerCase();
		var searchRow = el("div", "mce-build");
		var sInp = el("input", "mce-search-inp mce-char-search");
		sInp.type = "search";
		sInp.placeholder = "搜索角色（原名/显示名）…";
		sInp.value = charSearch;
		sInp.addEventListener("input", function () {
			charSearch = sInp.value.replace(/^\s+|\s+$/g, "");
			mbCEUiSave({ charFilter: charSearch });
			renderCards();
			var ni = pane.querySelector(".mce-char-search");
			if (ni && document.activeElement !== ni) { try { ni.focus(); } catch (e2) {} }
		});
		searchRow.appendChild(sInp);
		pane.appendChild(searchRow);
		var hint = el("div", "mce-hint", "");
		pane.appendChild(hint);
		var matchCount = 0;
		CHAR_CATEGORIES.forEach(function (group) {
			var members = chars.filter(function (n) { return charCategory(n) === group.cat; });
			if (q) {
				members = members.filter(function (n) {
					return String(displayNameEx(n)).toLowerCase().indexOf(q) !== -1
						|| String(n).toLowerCase().indexOf(q) !== -1;
				});
			}
			matchCount += members.length;
			var block = el("div", "mce-grp");
			block.setAttribute("data-tcat", group.title);
			var head = el("div", "mce-grp-t mce-collapse-head");
			head.title = group.desc + "——点击展开/收起";
			var stored = mbCEUiState.collapsed && mbCEUiState.collapsed[charSectionKey(group.cat)] != null
				? Number(mbCEUiState.collapsed[charSectionKey(group.cat)]) : 1;
			var open = stored === 0;
			head.textContent = (open ? "▾ " : "▸ ") + group.title + "（" + members.length + "）";
			block.appendChild(head);
			var body = el("div", "mce-grp-body");
			body.setAttribute("data-collapsed", open ? "0" : "1");
			if (members.length) {
				/* v1.9.0 自查优化：懒渲染——默认收起的组不建卡片 DOM，展开时才补建（head 点击回调内） */
				if (open) { buildGroupCards(body, group, members); }
			} else {
				body.appendChild(el("div", "mce-hint", "（该分类暂无角色）"));
			}
			block.appendChild(body);
			head.addEventListener("click", function () {
				var nowOpen = body.getAttribute("data-collapsed") === "0";
				body.setAttribute("data-collapsed", nowOpen ? "1" : "0");
				head.textContent = (nowOpen ? "▸ " : "▾ ") + group.title + "（" + members.length + "）";
				/* 收起 → 展开：补建卡片（懒渲染）；open=点击前状态，点击后=!open */
				if (!nowOpen && members.length && !body.querySelector(".mce-cards")) {
					buildGroupCards(body, group, members);
				}
				mbCEUiState.collapsed = mbCEUiState.collapsed || {};
				mbCEUiState.collapsed[charSectionKey(group.cat)] = nowOpen ? 1 : 0;
				mbCEUiSave({ collapsed: mbCEUiState.collapsed });
			});
			pane.appendChild(block);
		});
		hint.textContent = "共 " + chars.length + " 个角色（自动枚举：本体 + 全部 MOD + 持久 NPC），按类型分组收起，点击分组标题展开"
			+ (q ? "；匹配 " + matchCount + " 个" : "") + "。"
			+ (charsKids.length ? "（另有 " + charsKids.length + " 个 FertilityExpansion 孩子已收进「模组作弊 → FertilityExpansion → 孩子」页，不在此列出）" : "");
		if (typeof pane.scrollTop === "number") { pane.scrollTop = keepScroll; }
	}
	/* ---- 阶段页：数据卡 + 双层内层标签 ---- */
	function renderStagePane() {
		var pane = root.querySelector('[data-pane="stage"]');
		pane.textContent = "";
		if (!curName) {
			var chars = listCharacters();
			curName = chars[0] || "";
		}
		if (!curName) {
			pane.appendChild(el("div", "mce-hint", "无角色可选。"));
			return;
		}
		var npc = findNpcEx(curName);
		var st = getNpcState(curName);
		var active = st.state !== "dismissed";

		/* 角色数据卡 */
		var card = el("div", "mce-data-card");
		var top = el("div", "mce-section", "角色：");
		card.appendChild(top);
		var head = el("div", "mce-stage-head");
		head.appendChild(el("span", "mce-stage-name", displayNameEx(curName)));
		var badge = el("span", "mce-badge " + (active ? "mce-on" : "mce-off"), active ? "活跃" : "停用");
		badge.title = "state: " + st.state;
		head.appendChild(badge);
		card.appendChild(head);
		if (st.found) { card.appendChild(el("div", "mce-hint", "游戏状态 state = " + stateCN(st.state))); }
		if (!npc) { card.appendChild(el("div", "mce-hint", "未在 V.NPCName / V.per_npc 中找到该角色的运行时对象（仅注册池存在）。")); }

		/* 数值行（含 ±10） */
		var defs = statDefsFor(curName);
		defs.forEach(function (def) {
			var row = el("div", "mce-statrow");
			row.appendChild(el("span", "mce-label", def.label));
			row.appendChild(el("span", "mce-value", String(statValue(npc, curName, def))));
			var m10 = el("button", "mce-btn", "-10");
			m10.type = "button";
			m10.addEventListener("click", function () {
				writeStat(npc, curName, def, statValue(npc, curName, def) - 10);
				renderStagePane();
			});
			var p10 = el("button", "mce-btn", "+10");
			p10.type = "button";
			p10.addEventListener("click", function () {
				writeStat(npc, curName, def, statValue(npc, curName, def) + 10);
				renderStagePane();
			});
			row.appendChild(m10);
			row.appendChild(p10);
			card.appendChild(row);
		});

		var actions = el("div", "mce-actions");
		var fillBtn = el("button", "mce-btn mce-gold", "一键补齐全部数值");
		fillBtn.type = "button";
		fillBtn.title = "爱意/情欲/支配/服从/信任 → 100，警戒/嫉妒 → 0（自定义属性取注册上限）";
		fillBtn.addEventListener("click", function () {
			var n = fillStats(npc, curName);
			renderStagePane();
			setStatus("已补齐「" + displayNameEx(curName) + "」" + n + " 项数值", "mce-ok");
		});
		var romBtn = el("button", "mce-btn mce-gold", "一键解锁全部恋爱阶段");
		romBtn.type = "button";
		romBtn.addEventListener("click", function () {
			var r = unlockAllRomance(curName);
			renderStagePane();
			setStatus("「" + displayNameEx(curName) + "」恋爱阶段：新解锁 " + r.fixed + " / " + r.total, r.fixed > 0 ? "mce-ok" : "mce-err");
		});
		var tfBtn = el("button", "mce-btn mce-gold", "一键解锁全部转化阶段");
		tfBtn.type = "button";
		tfBtn.addEventListener("click", function () {
			var n = unlockAllTransform(curName);
			renderStagePane();
			setStatus("「" + displayNameEx(curName) + "」转化阶段解锁 " + n + " 个类型", "mce-ok");
		});
		actions.appendChild(fillBtn);
		actions.appendChild(romBtn);
		actions.appendChild(tfBtn);
		card.appendChild(actions);
		pane.appendChild(card);

		/* 内层标签（第二层） */
		var inner = el("div", "mce-inner");
		var bRom = el("button", curInnerTab === "romance" ? "mce-active" : "", "恋爱阶段");
		bRom.type = "button";
		bRom.addEventListener("click", function () { curInnerTab = "romance"; mbCEUiSave({ innerTab: "romance" }); renderStagePane(); });
		var bTf = el("button", curInnerTab === "transform" ? "mce-active" : "", "转化阶段");
		bTf.type = "button";
		bTf.addEventListener("click", function () { curInnerTab = "transform"; mbCEUiSave({ innerTab: "transform" }); renderStagePane(); });
		inner.appendChild(bRom);
		inner.appendChild(bTf);
		pane.appendChild(inner);

		if (curInnerTab === "romance") { renderRomanceStages(pane); }
		else { renderTransformStages(pane); }
	}

	/* 条件中文说明（展示层：把引擎条件源码翻译成"达成了什么"，非硬编码角色数据） */
	var TERM_CN = {
		"robinromance": "罗宾·恋人关系",
		"whitneyromance": "惠特尼·恋人关系",
		"sydneyromance": "悉尼·恋人关系",
		"kylarenglish": "凯拉尔线剧情进度",
		"syndromeeden": "伊甸·专属综合征（已建立伊甸关系）",
		"syndromewolves": "黑狼·狼群综合征",
		"syndromebird": "巨鹰·鸟类综合征",
		"farm_stage": "艾利克斯·农场阶段",
		"alex_countdown": "艾利克斯·事件倒计时",
		"auriga_artefact": "御夫座神器（艾弗里线剧情节点）",
		"gwylanSeen": "格威岚·恋爱经历",
		"lunaSeen": "露娜·恋爱经历",
		"zephyrSeen": "泽菲尔·恋爱经历",
		"ravenStory": "渡鸦·剧情进度",
		"wraithsreflection": "怨灵·剧情进度",
		"adian_romance": "阿电·恋人关系",
		"deviancy": "变态（deviancy）技能",
		"love": "爱意", "dom": "支配", "lust": "情欲"
	};
	/* ============ 特殊场景直达（用户点名 5 大场景 + 主从嵌套）
	     不硬编码段落清单：按前缀/关键词在 Story 段落里动态枚举，MOD 新增段落自动收录；
	     组 = 主场景，组内各段落 = 子场景，main 段落排最前并标注「主」。============ */
	var PLACE_GROUPS = [
		{ id: "orphanage_loft", name: "孤儿院 · 阁楼", match: function (n) { return n.indexOf("Orphanage Loft") === 0; }, main: "Orphanage Loft", note: "孤儿院上方的阁楼（隐藏区域，Bailey 视线之外）" },
		{ id: "kylar_manor", name: "凯拉尔 · 庄园", match: function (n) { return n.indexOf("Manor ") === 0; }, main: "Manor Hall", note: "凯拉尔家族的庄园大宅（大厅/花园/实验室/秘密房间）" },
		{ id: "sydney_temple", name: "悉尼（Sydney）· 神殿居所", match: function (n) { return n.indexOf("Temple Sydney") === 0 || n.indexOf("Sydney Temple") === 0; }, main: "Temple Sydney", note: "神殿中悉尼的房间与祭坛场景（纯/堕两线都在此）" },
		{ id: "sirris_places", name: "西里斯（Sirris）· 学校与成人商店", match: function (n) { return /sirris/i.test(n) || n === "Sydney Ride Home" || n === "Sydney Ride Temple"; }, main: "Adult Shop Approach Sirris", note: "西里斯常驻的科学教室与成人商店，以及开车接送的车程场景（悉尼的家长）" },
		{ id: "avery_mansion", name: "艾弗里 · 庄园", match: function (n) { return n.indexOf("Mansion ") === 0; }, main: "Mansion Bed", note: "艾弗里的庄园豪宅（卧室/泳池/浴室/厨房/地牢/车库等套间）" },
		{ id: "gwylan_garden", name: "格威岚 · 花园与森林商店", match: function (n) { return /gwylan/i.test(n) || n.indexOf("Pregnancy Birth Forest Shop") === 0 || n.indexOf("Forest Shop") === 0; }, main: "Gwylan Ritual Start Garden", note: "格威岚的森林商店与花园（仪式/接生/幽会/恋爱各阶段场景均在此）" },
		/* v1.7.0：多伦公寓（Doren's flat，$location="flats"）+ 麋鹿街大院（Elk Compound，原版 73 段）。
		   多伦公寓实证：Doren Entrance（入口，"You climb to Doren's flat"）、Doren Talk/Cry、Doren Shower 系列均在公寓内；
		   Doren Loft 系列为孤儿院阁楼布置线（用户点名一并收录）；Doren Jog/Beach/School Infirmary 为户外/学校，不收。
		   麋鹿街大院实证：Elk Compound 为入口（"You are in the compound on Elk Street"），Interior/Underground/Central/
		   Wraith/Possessed/Station 等 70+ 子场景；Docks Compound 为码头大院，不收。 */
		{ id: "doren_flat", name: "多伦 · 公寓与阁楼", match: function (n) {
			return n === "Doren Entrance" || n === "Doren Talk" || n === "Doren Cry"
				|| n.indexOf("Doren Shower") === 0 || n.indexOf("Doren Loft") === 0;
		}, main: "Doren Entrance", note: "多伦的公寓（进入/闲聊/哭泣/淋浴各阶段）与孤儿院阁楼布置线（Doren Loft，用户点名一并收录）" },
		{ id: "elk_compound", name: "麋鹿街 · 大院", match: function (n) {
			return n.indexOf("Elk Compound") === 0;
		}, main: "Elk Compound", note: "麋鹿街大院（中央区/地下/怨灵线/附身线等 70+ 子场景）" },
		/* v1.9.13 场景直达补充 6 组（段落前缀均经本体 0.5.12.13 实证） */
		{ id: "asylum", name: "精神病院 · Asylum", match: function (n) {
			return n === "Asylum" || n.indexOf("Asylum ") === 0;
		}, main: "Asylum", note: "精神病院（评估/病房/深渊/镜像等线；$location=asylum）" },
		{ id: "police_prison", name: "警局与监狱 · Police/Prison", match: function (n) {
			return n.indexOf("Police ") === 0 || n.indexOf("Prison ") === 0;
		}, main: "Police Cell", note: "警局（羁押/社区服务）与监狱（囚犯线/Wren 线等）" },
		{ id: "docks", name: "码头 · Docks", match: function (n) {
			return n === "Docks" || n.indexOf("Docks_") === 0 || n.indexOf("Docks ") === 0;
		}, main: "Docks", note: "码头（$location=docks；罗宾码头线 Docks_Robin 系列在此）" },
		{ id: "lake", name: "湖畔 · Lake", match: function (n) {
			return n.indexOf("Lake ") === 0;
		}, main: "Lake Stroll", note: "湖畔（$location=lake；散步/昆虫/黄金/遗迹等线）" },
		{ id: "wolf_territory", name: "森林深处 · 狼群领地", match: function (n) {
			return n.indexOf("Wolf ") === 0 || n.indexOf("Forest Wolf") === 0;
		}, main: "Wolf Pack", note: "森林深处的狼群领地（Wolf Pack 遭遇/狼穴/狼孩线）" },
		{ id: "hospital", name: "医院 · Hospital", match: function (n) {
			return n.indexOf("Hospital ") === 0;
		}, main: "Hospital front", note: "医院（$location=hospital；前台/门禁卡/诊室等线）" },
		/* v2.0.0.007 好友实测补录（原版 0.5.12.13 段落名实证，非模组）：
		   Brothel 前缀 139 段（地下层 Brothel Basement 在内）；Livestock 前缀 310 段（雷米牧场牲口线）；
		   The Farm / Farmland 前缀 124 段（雷米农场本体与农场事件）。 */
		{ id: "brothel", name: "妓院 · 含地下层 Brothel", match: function (n) {
			return n.indexOf("Brothel") === 0;
		}, main: "Brothel Basement", note: "妓院（楼梯/后门/更衣室/舞台/私人房）与地下层（地下室/荣耀洞/机械维修）；主场景直接落到「地下妓院」" },
		{ id: "remy_livestock", name: "雷米牧场 · 牲口线 Livestock", match: function (n) {
			return n.indexOf("Livestock") === 0;
		}, main: "Livestock Intro", note: "雷米的牧场（被当作牲口的整条线：牛棚/牧场/劳动/挤奶/逃脱/冬歇）" },
		{ id: "remy_farm", name: "雷米农场 · The Farm", match: function (n) {
			return n === "The Farm" || n.indexOf("The Farm ") === 0 || n.indexOf("Farmland ") === 0;
		}, main: "The Farm", note: "雷米农场本体与农场事件（艾利克斯线/农作物/农场商店/暴露事件）" },
		/* v2.0.7 R3（玩家「有的地点都没了」「那小岛的作弊呢」）：原版 0.5.12.13 有 Island 海岛线
		   （setup.majorAreas 含 "Island"，setup.addlocation("island").parent("sea")，Widgets Text Island → "the nearby island"，
		   teleportCheater 有 case "Island" → island_end），但 CE 的 17 组地点直达里一直没有 → 玩家进不去。
		   Island 前缀段落：Island（hub）/ Island Explore / Island Sleep / Island Defeat / Island Build <档> <件> / Island Walnut 等。 */
		{ id: "island", name: "海岛 · Island", match: function (n) {
			return n === "Island" || n.indexOf("Island ") === 0;
		}, main: "Island", note: "海岛生存线（营地三选/探索六处/建造/隐蔽/语言；生存数值与营地作弊见「地点」子页签）" }
	];
	var PLACE_CN = {
		/* v1.9.23-实机修复：新 6 组主场景名中文化（主场景行 placeNameCN 子串映射） */
		"asylum": "精神病院", "police": "警局与监狱", "prison": "监狱", "docks": "码头",
		"lake": "湖畔", "wolf": "狼群", "hospital": "医院", "island": "海岛",
		"loft": "阁楼", "kitchen": "厨房", "reading nook": "阅读角", "bay window": "凸窗", "coffee pot": "咖啡壶",
		"spray": "喷漆", "hall": "大厅", "garden": "花园", "lab": "实验室", "parents room": "父母房间",
		"grounds": "庭院", "kylar room": "凯拉尔房间", "secret": "秘密", "bed": "卧室", "pool": "泳池",
		"bathroom": "浴室", "lounge": "客厅", "dining": "餐厅", "study": "书房", "dungeon": "地牢",
		"garage": "车库", "display": "陈列室", "wardrobe": "衣帽间", "breakfast": "早餐", "folder": "档案",
		"party": "宴会", "bathe": "沐浴", "chase": "追逐", "bedroom": "卧室", "corridor": "走廊",
		"stairs": "楼梯", "antiques": "古董", "mirror": "镜子", "intro": "初次进入", "vigil": "守夜",
		"pray": "祈祷", "wakeup": "醒来", "rescue": "营救", "confess": "忏悔", "pure": "纯洁线",
		"corrupt": "堕落线", "seduce": "引诱", "spank": "拍打", "sex": "性爱", "ritual": "仪式",
		"start": "开始", "pregnancy": "分娩", "birth": "接生", "forest": "森林", "shop": "商店",
		"compound": "大院", "central": "中央区", "underground": "地下", "interior": "室内", "station": "站台",
		"wraith": "怨灵", "possessed": "附身", "machine": "机械", "experiment": "实验", "tentacles": "触手",
		"crystal": "水晶", "sell": "出售", "bluff": "虚张声势", "fight": "战斗", "explore": "探索",
		"camera": "摄像头", "pipes": "管道", "smoke": "烟雾", "climb": "攀爬", "tower": "塔楼",
		"shower": "淋浴", "cry": "哭泣", "talk": "交谈", "hot chocolate": "热巧克力", "volleyball": "排球",
		/* v2.0.0.007：妓院/雷米牧场/农场主场景与子场景中文化 */
		"brothel": "妓院", "basement": "地下层", "gloryhole": "荣耀洞", "livestock": "牲口", "barn": "牛棚",
		"farm": "农场", "farmland": "农田", "plough": "犁地", "tie stall": "拴栏", "milking": "挤奶"
	};
	function placeNameCN(name) {
		var lower = String(name).toLowerCase();
		var parts = [];
		Object.keys(PLACE_CN).forEach(function (k) {
			if (lower.indexOf(k) !== -1) { parts.push(PLACE_CN[k]); }
		});
		if (!parts.length) { return ""; }
		// 去重保序
		var uniq = []; parts.forEach(function (p) { if (uniq.indexOf(p) === -1) { uniq.push(p); } });
		return "（" + uniq.join("·") + "）";
	}
	function passageExists(name) {
		try {
			if (typeof Story !== "undefined" && Story && typeof Story.has === "function") {
				return !!Story.has(name);
			}
			var ps = listAllPassages();
			for (var i = 0; i < ps.length; i++) { if (ps[i].name === name) { return true; } }
		} catch (e) {}
		return false;
	}
	/* ============ v2.0.10 直达到达校验（好友实测：湖畔直达落到 Bedroom 报
	   「The passage Bedroom has no usable links」，玩家卡在无链接页只能读档）============
	   机理：场景直达 = 直接 Engine.play(目标段落)，绕过正常入口对运行期状态的初始化；
	   目标段落若在 render 早期抛异常（或缺前置对象），它自身的收尾部分（含全部 <<link>>）
	   会被吞掉 → 页面成立但无任何可点链接 → SugarCube 报 no usable links。
	   判据只认「#passages 里一个可点链接都没有」——不猜错误面板（各版本 id 不一致），
	   且只在直达后 250ms 检查一次，正常游玩链路完全不受影响。
	   失败动作：退回直达前的段落（V.passage）+ 状态栏说明，玩家不会卡死。 */
	function mbCECurrentPassage() {
	/* 当前段落唯一真值来源：SugarCube 的 State.passage。$passage 是原版 widget 里
	   <<set $passage to ... passage()>> 写的存档变量，语义上也是段落名，但它在段落正文渲染
	   后才更新，直接拿它判「是否还停在目标段落」会滞后一帧；故 State 优先、$passage 兜底。 */
	try {
		var sc0 = (typeof window !== "undefined" && window) ? window.SugarCube : null;
		if (sc0 && sc0.State && typeof sc0.State.passage === "string" && sc0.State.passage) { return sc0.State.passage; }
	} catch (e) {}
	try { if (typeof State !== "undefined" && State && typeof State.passage === "string" && State.passage) { return State.passage; } } catch (e) {}
	try { if (typeof window !== "undefined" && window && window.State && typeof window.State.passage === "string" && window.State.passage) { return window.State.passage; } } catch (e) {}
	try { var Vcur = getV(); if (Vcur && typeof Vcur.passage === "string") { return Vcur.passage; } } catch (e) {}
	return "";
}
function mbCEHasUsableLinks() {
		try {
			var box = document.getElementById("passages");
			if (!box) { return true; }
			var n = box.querySelectorAll("a[data-passage], .link-internal, .link-broken, .mce-btn[data-passage]").length;
			return n > 0;
		} catch (e) { return true; }
	}
	function mbCEArrivalCheck(before, target) {
		try {
			window.setTimeout(function () {
				try {
					if (before === target) { return; }
					if (mbCEHasUsableLinks()) { return; }
					/* 只在确实停在目标段落时回退（玩家可能这 250ms 内自己点了别处） */
					var curP = mbCECurrentPassage(); if (curP && curP !== target) { return; }
					var ep = getEnginePlayFn();
					if (ep && before) { ep.play.call(ep.e, before, true); }
					setStatus("「" + target + "」直达失败：该段落没有可点链接（渲染期异常或前置状态缺失），已退回原处「" + before + "」。这个场景请从正常入口进入。", "mce-err");
				} catch (e) {}
			}, 250);
		} catch (e) {}
	}
	function getEnginePlayFn() {
		try { if (typeof window !== "undefined" && window && window.Engine && typeof window.Engine.play === "function") { return { e: window.Engine, play: window.Engine.play }; } } catch (e) {}
		try { if (typeof Engine !== "undefined" && Engine && typeof Engine.play === "function") { return { e: Engine, play: Engine.play }; } } catch (e) {}
		/* SugarCube 2.36.1：Engine 位于 window.SugarCube 命名空间（Object.defineProperty 密封对象），不在 window 顶层 */
		try {
			var sc = (typeof window !== "undefined" && window && window.SugarCube) ? window.SugarCube : null;
			if ((!sc || typeof sc !== "object") && typeof SugarCube !== "undefined" && SugarCube) { sc = SugarCube; }
			if (sc && sc.Engine && typeof sc.Engine.play === "function") { return { e: sc.Engine, play: sc.Engine.play }; }
		} catch (e) {}
		return null;
	}
	/* v2.0.1 收敛：直达前的原版状态兜底（好友点「一键到达」时通常是新档，目标场景的状态对象可能从未建立）。
   取证（本体 0.5.12.13 HTML 按行切片）：
   - prison_init（657865 起）首行 <<if !$prison>> 守卫，缺则建完整壳；但我方只在缺失时调用——
     该 widget 末尾（657931）有无条件 <<set $prison.morning to 1>>，已有进度时调会污染当日监狱流程。
   - effects_prison（658002）首行即 <<if $prison.work_check isnot 1 ...>> —— $prison 整体缺失时深链读抛 TypeError；
     而 Prison Cell 段只调 <<destination_prison>> + <<effects_prison>>，不调 prison_init → 新档直达监狱必然崩。
   - The Farm / Farmland 段自身只读 $molestationstart（不崩），但进入后的农场子段读 $farm.*；
     farm_init（487465）无守卫且 <<set $farm to {}>> 会抹掉已有进度，故不复用原版 widget，改走 ensureFarmState(true)（只补不覆盖）。
   - Brothel 无 $brothel 对象（扁平 $brothel_* 键）；Asylum 用扁平 $asylum_mirror / 数字 $asylum —— 均无需兜底。
   - $livestock 由本体变量初始化 widget（183372 整对象）随新档建立 → 无需兜底。 */
function ensureSceneStateFor(name) {
	try {
		var V2 = getV();
		if (!V2) { return; }
		var nm = String(name || "");
		if (/^Prison/.test(nm)) { /* 无 \b：PrisonScarredInmate 一类无空格段名也命中 */
			if (V2.prison && typeof V2.prison === "object") { return; } /* 已有进度：绝不调 init（避免 morning 被重置） */
			var sc = (typeof window !== "undefined" && window && window.SugarCube) ? window.SugarCube : null;
			var W = (sc && sc.Wikifier) ? sc.Wikifier : (typeof Wikifier !== "undefined" ? Wikifier : null);
			if (W) { new W(null, "<<prison_init>>"); }
			return;
		}
		if (nm.indexOf("The Farm") === 0 || nm.indexOf("Farmland") === 0) {
			if (V2.farm && typeof V2.farm === "object") { return; }
			var fs = Number(V2.farm_stage);
			ensureFarmState(!(fs >= 1)); /* 农场线未推进也补壳（只补不覆盖）：直达后子段落会读 $farm.* */
			return;
		}
		/* v2.0.10：湖畔 / 卧室的状态兜底（只补缺失、绝不覆盖进度） */
		if (nm === "Bedroom" || nm === "Bedroom Wardrobe" || nm === "Bedroom Chest") {
			if (typeof V2.location !== "string" || !V2.location) { V2.location = "home"; }
			if (V2.outside === undefined) { V2.outside = 0; }
			if (typeof V2.furniture !== "object" || V2.furniture === null) { V2.furniture = {}; }
			if (typeof V2.furniture.bedroom !== "object" || V2.furniture.bedroom === null) { V2.furniture.bedroom = {}; }
			/* 原版 StoryInit 的 V.furniture 结构是 bedroom:{bed,wardrobe,desk} 三件默认家具。
			   只补空壳会让 Furniture.get('bed') 返回 null（area 存在但 area[category] 是 undefined），
			   Bedroom 段 <<furnitureicon _bed.iconFile>> 直接空引用抛 TypeError → 整段正文不渲染，
			   PassageFooter 的 _link 因没有任何 <<link>> 执行成功而为假 → 报 "has no usable links"。 */
			var _br = V2.furniture.bedroom;
			if (!_br.bed) { _br.bed = { id: "bed" }; }
			if (!_br.wardrobe) { _br.wardrobe = { id: "wardrobe" }; }
			if (!_br.desk) { _br.desk = { id: "desk" }; }
			return;
		}
		/* 原版湖畔线读 $phase（0 湖岸 / 1 草丛 / 2 深水）；直达时若从未走过湖畔，
		   $phase 缺失会让分支判定落在 undefined 上，段落收尾的选项整段不渲染。 */
		if (nm === "Lake Stroll" || nm.indexOf("Lake ") === 0) {
			if (typeof V2.location !== "string" || !V2.location) { V2.location = "lake"; }
			if (V2.outside === undefined) { V2.outside = 1; }
			var ph = Number(V2.phase);
			if (!isFinite(ph) || ph < 0 || ph > 2) { V2.phase = 1; }
			return;
		}
		/* v2.0.7 R3：小岛直达前补齐 $island 壳（含三处营地对象）。
		   原版 Widgets Island 会初始化，但直达 hub 之前的部分段落已读 $island[$island.home].trap，
		   新档直接 play("Island") 有 undefined 下标风险；这里「缺失才建、不覆盖进度」。 */
		if (nm === "Island" || nm.indexOf("Island ") === 0) {
			if (typeof mbCEIslandV === "function") { mbCEIslandV(); }
		}
	} catch (e) {}
}
function mbCEPassageMacroWarn(name) {
	/* 直达前读目标段落「运行时文本」（含所有 MOD 改写与汉化插入）做宏配对预检。
	   已定量确证的典型场景：汉化 i18n 的 pos 按原版段落算，模组把段落改长后 pos 落进
	   <<tarkov_xxx_link>> 一类宏内部，译文（自带多个宏）被塞进宏中间 → if/elseif/else 被撕碎。
	   这里只提示、不阻止进入：即使宏坏了，玩家也可能想先进去看看。 */
	try {
		var st = (typeof Story !== "undefined" && Story) ? Story : ((typeof window !== "undefined" && window) ? window.Story : null);
		if (!st) { return ""; }
		var pg = null;
		try { pg = (typeof st.get === "function") ? st.get(name) : ((typeof st.passage === "function") ? st.passage(name) : null); } catch (e0) { pg = null; }
		if (!pg || typeof pg.text !== "string") { return ""; }
		var mText = String(pg.text).replace(/\/%[\s\S]*?%\//g, ""); /* 去 SugarCube 注释，避免注释里的示例宏假阳性 */
		var mPairs = [["if", /<<if\b/g, /<<\/if>>/g], ["switch", /<<switch\b/g, /<<\/switch>>/g], ["link", /<<link\b/g, /<<\/link>>/g],
			["widget", /<<widget\b/g, /<<\/widget>>/g], ["for", /<<for\b/g, /<<\/for>>/g], ["capture", /<<capture\b/g, /<<\/capture>>/g]];
		var bad = [];
		for (var mi = 0; mi < mPairs.length; mi++) {
			var mo = (mText.match(mPairs[mi][1]) || []).length, mc = (mText.match(mPairs[mi][2]) || []).length;
			if (mo !== mc) { bad.push(mPairs[mi][0] + " " + mo + "/" + mc); }
		}
		if (!bad.length) { return ""; }
		return "注意：「" + name + "」宏结构不配对（" + bad.join("、") + "），进入后可能出现红字报错（常见于模组补丁把段落改长、汉化锚点随之错位）。本页「段落体检」可列出全部异常段落。";
	} catch (e) { return ""; }
}
function teleportTo(name) {
		try {
			if (!passageExists(name)) {
				setStatus("段落不存在：「" + name + "」（可能未安装对应剧情 MOD）", "mce-err");
				return;
			}
			var ep = getEnginePlayFn();
			if (!ep) {
				var d1 = (typeof window !== "undefined" && window) ? (typeof window.Engine) : "no-window";
				var d2 = (typeof Engine);
				var d3 = (typeof $);
				var d4 = (typeof window !== "undefined" && window && window.SugarCube) ? (typeof window.SugarCube.Engine) : "no-sc";
				setStatus("Engine 不可用（Engine=" + d2 + "，window.Engine=" + d1 + "，$=" + d3 + "，SugarCube.Engine=" + d4 + "）——若非游戏页面请先进入游戏", "mce-err");
				return;
			}
			ensureAveryMansion(); /* 防崩：庄园状态对象可能延迟初始化，直达前兜底（缺失才建，不覆盖进度） */
			ensureFarmState(); /* 防崩：farm_stage 已推进但 $farm 缺失时补空壳（社交页读 $farm.beasts/aggro） */
			ensureSceneStateFor(name); /* v2.0.1：监狱/农场原版状态对象兜底（新档直达不崩） */
			if (name === "Scene Viewer passages") {
				/* 直达场景查看器入口：设 pending 让首次 case 播放，剧情结束链回时不再重播；
				   同时设 replayScene（原版 default 退出分支需要 $replayScene.exitpassage 才能给出 Back 链接） */
				var Vp = getV();
				if (Vp) {
					Vp.mbCE_replayOnce = true;
					Vp.mbCE_replayPending = true;
					Vp.replayScene = { name: "场景直达", startPassage: "Scene Viewer passages", passages: [], exitpassage: (typeof Vp.passage === "string" ? Vp.passage : "") };
				}
			}
			var beforeP = "";
			try { beforeP = mbCECurrentPassage(); } catch (e0) {}
			ep.play.call(ep.e, name, true);
			setStatus("已传送至「" + name + "」", "mce-ok");
			mbCEArrivalCheck(beforeP, name); /* v2.0.10：无可用链接 → 自动退回原处，不把玩家卡死 */
			var gidT = placeIdForPassage(name, name);
			if (gidT) { applyWorldUnlock(gidT); setStatus("已传送至「" + name + "」并已解锁世界入口", "mce-ok"); }
			/* v2.0.10-e：宏结构预检（只提示，不阻止；刻意放在成功文案之后，避免被覆盖） */
			try { var mbW = mbCEPassageMacroWarn(name); if (mbW) { setStatus(mbW, "mce-err"); } } catch (e1) {}
		} catch (e) { setStatus("传送失败：" + mbCEErr(e), "mce-err"); }
	}
	function listPlaceGroups() {
		var ps = listAllPassages();
		var seen = {};
		return PLACE_GROUPS.map(function (g) {
			var items = [];
			for (var j = 0; j < ps.length; j++) {
				var n = ps[j].name;
				if (seen[n]) { continue; }
				if (g.match(n)) { seen[n] = true; items.push(n); }
			}
			items.sort(function (a, b) {
				var am = a === g.main ? 0 : 1, bm = b === g.main ? 0 : 1;
				if (am !== bm) { return am - bm; }
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});
			return { group: g, items: items };
		});
	}
	/* ============ v1.9.0 场景页双层子界面：场景直达 / 地点（地点阶段任务作弊区） ============ */
	function renderPlaces() {
		var pane = root.querySelector('[data-pane="places"]');
		var keepScroll = typeof pane.scrollTop === "number" ? pane.scrollTop : 0; /* 重建后保持滚动位置（五巡一致） */
		pane.textContent = "";
		var inner = el("div", "mce-inner");
		var bDirect = el("button", mbCEUiState.placesTab !== "stage" ? "mce-active" : "", "场景直达");
		bDirect.type = "button";
		bDirect.setAttribute("data-place", "direct");
		bDirect.title = "特殊场景一键直达（阁楼/庄园/神殿/公寓等）";
		bDirect.addEventListener("click", function () {
			mbCEUiState.placesTab = "direct";
			mbCEUiSave({ placesTab: "direct" });
			renderPlaces();
		});
		var bStage = el("button", mbCEUiState.placesTab === "stage" ? "mce-active" : "", "地点");
		bStage.type = "button";
		bStage.setAttribute("data-place", "stage");
		bStage.title = "地点阶段任务作弊（市政改造/农场/公寓/机构等原版阶段变量直改，全部留痕可回退）";
		bStage.addEventListener("click", function () {
			mbCEUiState.placesTab = "stage";
			mbCEUiSave({ placesTab: "stage" });
			renderPlaces();
		});
		inner.appendChild(bDirect);
		inner.appendChild(bStage);
		pane.appendChild(inner);
		if (mbCEUiState.placesTab === "stage") { renderPlacesStage(pane); }
		else { renderPlacesDirect(pane); }
		if (typeof pane.scrollTop === "number") { pane.scrollTop = keepScroll; }
	}

	/* ---- 地点阶段任务数据表（max 来自 DoL 0.5.12.13 原版阈值实证扫描；town_projects 为嵌套宿主） ---- */
	var PLACE_STAGE_GROUPS = [
		{ name: "市政改造（市政府 town_projects）", note: "原版路过事件自动升级；此处可一键推进各项目阶段（0-5）", items: [
			{ key: "road", name: "道路", path: "town_projects.road", max: 5, note: "市政道路工程（≥4 解锁森林深路/回城快速路）" },
			{ key: "diving", name: "潜水考古", path: "town_projects.diving", max: 5, note: "潜水考古项目（≥3 关联博物馆项链，≥4 解锁 Winter 考古营地）" },
			{ key: "thicket", name: "灌木丛", path: "town_projects.thicket", max: 5, note: "灌木丛清理工程（改变触手森林场景）" },
			{ key: "bridge", name: "桥梁", path: "town_projects.bridge", max: 5, note: "桥梁工程（≥4 解锁穿桥去 Flats 公寓区）" },
			{ key: "green", name: "绿地", path: "town_projects.green", max: 5, note: "绿地工程（≥4 解锁绿地社交场景）" }
		]},
		{ name: "农场（艾利克斯线）", note: "艾利克斯农场主线阶段系统", items: [
			{ key: "farm_stage", name: "农场阶段", path: "farm_stage", max: 12, note: "艾利克斯农场主线阶段（≥7 满足恋人条件）" },
			{ key: "farm_phase", name: "农场进程", path: "farm_phase", max: 1, note: "农场当季进程（0/1 二态）" }
		]},
		{ name: "城市与公寓", note: "公寓区/商店/阁楼/妓院地点阶段", items: [
			{ key: "flats", name: "公寓区进度", path: "flats_progress", max: 2, note: "Flats 公寓区进度（与市政桥梁工程联动解锁）" },
			{ key: "adultshop", name: "成人用品店", path: "adultshopprogress", max: 22, note: "成人用品店性玩具区解锁进度" },
			{ key: "loft", name: "阁楼升级", path: "loft_upgrade", max: 7, note: "孤儿院阁楼房间升级计数（原版无硬性阈值，每次房间升级 +1）" },
			{ key: "brothel", name: "妓院机械维修", path: "brothel_machine_repair", max: 4, note: "妓院地下机械维修进度" }
		]},
		{ name: "机构与学校", note: "修道院/精神病院/学校地点阶段", items: [
			{ key: "temple_cloister", name: "修道院回廊", path: "temple_cloister_progress", max: 1, note: "修道院回廊进度（0/1 二态）" },
			{ key: "temple_arcade", name: "修道院街机线", path: "temple_arcade_phase", max: 4, note: "修道院街机线阶段（0-4）" },
			{ key: "asylum", name: "精神病院评估", path: "asylumassessmentprogress", max: 4, note: "精神病院评估进度（0-4）" },
			{ key: "asylum_puzzle", name: "精神病院谜题", path: "asylumPuzzleProgress", max: 5, note: "精神病院谜题进度（0-5）" },
			{ key: "science", name: "学校科学项目", path: "scienceprogression", max: 4, note: "学校科学项目进度（0-4）" },
			{ key: "terrarium", name: "学校生态箱", path: "scienceterrariumprogression", max: 4, note: "学校生态箱进度（0-4）" },
			{ key: "asylum_mirror", name: "精神病院镜像", path: "asylum_mirror", max: 5, note: "镜像线进度（0-5，原版 gte 5 判定触发深层镜像场景）" }
		]},
		/* v2.0.0.007 好友实测补录：监狱与雷米牧场的原版档位数（键名/取值形态均经 0.5.12.13 赋值实证） */
		/* v2.0.3 修正：原 `prison.protection` 声明为数字 0-10 是错的——它是枚举字符串（657114 等 14 处 `set to "scarred"`、
		   650845/651145/658072 用 `is "scarred"` / `is "tattooed"` 判定），本页写入通道强制 Number + clamp，
		   会写出「两个 is 都不匹配、但 !protection 为假」的半失效态。故从本页移除，改由言灵页 ⑨「监狱庇护」按字符串直写；
		   这里换成两个真正的数字键（均经 0.5.12.13 实证）：scarred_level 0-5（281352-281376 五档 + 657030 switch 判定）、
		   tattooed 0-100（651161/651179/653267 按 gte 80 / gte 20 分档）。 */
		{ name: "监狱（原版 Prison）", note: "狱中关注度 / 疤痕狱友等级 / 纹身狱友声望 / 当日劳动时数（$prison.* 对象键，宿主由原版初始化）", items: [
			{ key: "prison_attention", name: "监狱关注度", path: "prison.attention_level", max: 3, note: "狱中关注度档位（实证 to 2/3；越高越容易被狱霸盯上）" },
			{ key: "prison_scarred_level", name: "疤痕狱友等级", path: "prison.scarred_level", max: 5, note: "疤痕狱友线推进档位 0-5（657030 switch 判定；3 档「Molestation」、4 档为高危档）" },
			{ key: "prison_tattooed", name: "纹身狱友声望", path: "prison.tattooed", max: 100, note: "纹身狱友声望 0-100（≥20 进中档文案、≥80 进高档；651161/651179/653267 实证）" },
			{ key: "prison_hours", name: "监狱劳动时数", path: "prison.hours_worked", max: 12, note: "当日已劳动时数（原版按 Time.hour-7 计，0-12）" }
		]},
		{ name: "雷米牧场（原版 Livestock）", note: "牲口线服从度 / 产奶量 / 产精量 / 自尊（$livestock.* 对象键）", items: [
			{ key: "lv_obey", name: "服从度", path: "livestock.obey", max: 100, note: "牲口服从度（默认 50；越高越顺从，反抗选项减少）" },
			{ key: "lv_milk", name: "产奶量", path: "livestock.milk", max: 1000, note: "累计产奶量（number，挤奶事件累加）" },
			{ key: "lv_semen", name: "产精量", path: "livestock.semen", max: 1000, note: "累计产精量（number，同步挤取事件累加）" },
			{ key: "lv_pride", name: "自尊残留", path: "livestock.pride", max: 1, note: "0/1 二态（1=仍有自尊，会反抗）" }
		]}
	];
	/* 地点阶段读取（safe：任何层级缺失 → 0） */
/* 职责：地点页阶段读写 —— placeStageRead / placeStageWrite / placeStageUndo，阶段区与直达区渲染 */
	function placeStageRead(path) {
		try {
			var Vp = getV();
			var parts = String(path || "").split(".");
			var cur = Vp;
			for (var i = 0; i < parts.length; i++) {
				if (cur == null) { return 0; }
				cur = cur[parts[i]];
			}
			var n = Number(cur);
			return Number.isFinite(n) ? Math.round(n) : 0;
		} catch (e) { return 0; }
	}
	/* 地点阶段写入：绕过原版变量黑名单直接写（五面板专用通道），保留 before 留痕可回退。
	   嵌套宿主：仅 town_projects 允许自动建壳（原版事件直接读写各字段）；其余缺失宿主拒绝。 */
	function placeStageWrite(path, target, min, max, replay) {
		try {
			var Vp = getV();
			if (!Vp) { return { ok: false, message: "存档变量不可用" }; }
			var parts = String(path || "").split(".");
			if (!parts.length || !parts[0]) { return { ok: false, message: "路径无效" }; }
			var cur = Vp, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
					if (parts[i] === "town_projects") { cur[parts[i]] = {}; }
					else { return { ok: false, message: "宿主不存在（" + parts.slice(0, i + 1).join(".") + "），请先推进剧情或检查版本" }; }
				}
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			var before = cur[leaf];
			var prev = Vp.mbCE_wrote && Vp.mbCE_wrote["place:" + path];
			/* 留痕语义：before 始终保留「首次写入前」状态（含 undefined=原本无字段）——
			   用 in 判断，避免二次写入把 before 覆盖成当前值，导致回退丢失"删除字段"语义 */
			if (prev && "before" in prev) { before = prev.before; }
			var lo = Number.isFinite(Number(min)) ? Number(min) : 0;
			var hi = Number.isFinite(Number(max)) ? Number(max) : Infinity;
			/* 地点页是阶段/档位语义：钳制到 [lo, hi]（用户澄清：仅"直接填数值"放开上限，阶段保留） */
			var final = Math.max(lo, Math.min(hi, Math.round(Number(target) || 0)));
			/* v2.0.7 D1：地点阶段 / 世界入口（阶段表 + 岛屿 + 地下）写入原先完全绕过 diff 预览 */
			if (!replay && typeof mbCEPreviewGate === "function" &&
				mbCEPreviewGate(path, cur[leaf], final,
					function () { return placeStageWrite(path, target, min, max, true); })) {
				return { ok: false, pending: true, message: "待确认写入：" + path };
			}
			cur[leaf] = final;
			if (!Vp.mbCE_wrote || typeof Vp.mbCE_wrote !== "object") { Vp.mbCE_wrote = {}; }
			Vp.mbCE_wrote["place:" + path] = { type: "place", path: path, before: before, after: final, t: Date.now() };
			mbCEWroteTrim(Vp);
			return { ok: true, message: "已写入 " + path + " = " + final, before: before, after: final };
		} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
	}
	/* 地点阶段回退：还原首次写入前状态（before 为 undefined → 删除字段） */
	function placeStageUndo(path) {
		try {
			var Vp = getV();
			if (!Vp || !Vp.mbCE_wrote || !Vp.mbCE_wrote["place:" + path]) { return { ok: false, message: "无该写入留痕（不可回退）" }; }
			var rec = Vp.mbCE_wrote["place:" + path];
			var parts = String(path || "").split(".");
			var cur = Vp, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") { return { ok: false, message: "宿主已被清除，无法回退" }; }
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			if (rec.before === undefined) { delete cur[leaf]; }
			else { cur[leaf] = rec.before; }
			delete Vp.mbCE_wrote["place:" + path];
			return { ok: true, message: "已回退 " + path + " 到写入前状态" };
		} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
	}
	function renderPlacesStage(pane) {
		pane.appendChild(el("div", "mce-hint", "地点阶段任务（原版 $变量 直改，全部留痕可回退）："));
		PLACE_STAGE_GROUPS.forEach(function (g) {
			var block = el("div", "mce-grp");
			var head = el("div", "mce-grp-t", g.name);
			head.title = g.note;
			block.appendChild(head);
			block.appendChild(el("div", "mce-stage-note", g.note));
			g.items.forEach(function (it) {
				var cur = placeStageRead(it.path);
				var row = el("div", "mce-row");
				row.setAttribute("data-stagekey", it.key);
				row.title = it.note + "（当前 " + cur + " / 上限 " + it.max + "；阶段档位，写入钳制在上限内）";
				var lbl = el("span", "mce-row-lbl", it.name + "　");
				var val = el("span", "mce-value", cur + " / " + it.max);
				lbl.appendChild(val);
				row.appendChild(lbl);
				var mDec = el("button", "mce-btn", "−1");
				mDec.type = "button";
				mDec.setAttribute("data-op", "dec");
				mDec.addEventListener("click", function () {
					var r = placeStageWrite(it.path, placeStageRead(it.path) - 1, 0, it.max);
					renderPlaces();
					if (r && r.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(r && r.message ? r.message : "写入失败", "mce-err"); }
				});
				var mInc = el("button", "mce-btn", "+1");
				mInc.type = "button";
				mInc.setAttribute("data-op", "inc");
				mInc.addEventListener("click", function () {
					/* +1 是档位微调：钳到 [0, it.max]（阶段档位语义，防点出不存在档位） */
					var nx = placeStageRead(it.path) + 1;
					if (nx > it.max) { nx = it.max; }
					var rInc = placeStageWrite(it.path, nx, 0, it.max);
					renderPlaces();
					if (rInc && rInc.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(rInc && rInc.message ? rInc.message : "写入失败", "mce-err"); }
				});
				var mMax = el("button", "mce-btn mce-gold", "拉满");
				mMax.type = "button";
				mMax.setAttribute("data-op", "max");
				mMax.addEventListener("click", function () {
					var rMax = placeStageWrite(it.path, it.max, 0, it.max);
					renderPlaces();
					if (rMax && rMax.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(rMax && rMax.message ? rMax.message : "写入失败", "mce-err"); }
				});
				row.appendChild(mDec);
				row.appendChild(mInc);
				row.appendChild(mMax);
				/* 有留痕才显示回退（还原首次写入前状态） */
				try {
					var Vp = getV();
					if (Vp && Vp.mbCE_wrote && Vp.mbCE_wrote["place:" + it.path]) {
						var mUndo = el("button", "mce-btn mce-red", "回退");
						mUndo.type = "button";
						mUndo.setAttribute("data-op", "undo");
						mUndo.addEventListener("click", function () {
							var r = placeStageUndo(it.path);
							renderPlaces();
							setStatus(r.message || "", r.ok ? "mce-ok" : "mce-err");
							if (r && r.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2 */
						});
						row.appendChild(mUndo);
					}
				} catch (e) {}
				block.appendChild(row);
			});
			pane.appendChild(block);
		});
		pane.appendChild(el("div", "mce-hint", "拉满 = 置为原版上限值；「−1/+1」逐步推进；写入记录在 V.mbCE_wrote（place: 前缀）可回退。"));
		/* v2.0.7：R3 小岛生存作弊 + R4 地下妓院角色（07k-island-npc.js）挂在本子页签末尾 */
		if (typeof renderIslandSec === "function") { renderIslandSec(pane); }
		if (typeof renderNpcUndergroundSec === "function") { renderNpcUndergroundSec(pane); }
	}

	function renderPlacesDirect(pane) {
		var groups = listPlaceGroups();
		var total = 0;
		var V = getV();
		var unlocked = (V && V.mbCE_unlockedPlaces && typeof V.mbCE_unlockedPlaces === "object") ? V.mbCE_unlockedPlaces : {};
		groups.forEach(function (entry) {
			var g = entry.group;
			total += entry.items.length;
			var block = el("div", "mce-stage");
			var head = el("div", "mce-stage-head");
			head.appendChild(el("span", "mce-dot", ""));
			head.appendChild(el("span", "mce-stage-name", "■ " + g.name + "　（" + entry.items.length + " 个段落）"));
			block.appendChild(head);
			block.appendChild(el("div", "mce-stage-note", g.note));
			var uc = unlocked[g.id];
			if (uc && uc.startPassage) {
				/* 已解锁（剧情固定触发联动）→ 直接可用 */
				var rowU = el("div", "mce-stage mce-place-row mce-pass");
				var shU = el("div", "mce-stage-head");
				shU.appendChild(el("span", "mce-dot", ""));
				shU.appendChild(el("span", "mce-stage-name", "已解锁 ★ " + g.name + "　（触发「" + (uc.name || uc.key || "") + "」后联动解锁）"));
				var entryHint = (typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS[g.id] && WORLD_UNLOCKS[g.id].entry) ? WORLD_UNLOCKS[g.id].entry : "";
				if (entryHint) { shU.appendChild(el("div", "mce-stage-txt", "世界入口：已在游戏内解锁 → " + entryHint)); }
				var btnU = el("button", "mce-btn mce-gold", "直达");
				btnU.type = "button";
				btnU.title = "跳转到：" + uc.startPassage;
				(function (target) {
					btnU.addEventListener("click", function () { teleportTo(target); });
				})(uc.startPassage);
				shU.appendChild(btnU);
				rowU.appendChild(shU);
				block.appendChild(rowU);
			} else if (entry.items.indexOf(g.main) !== -1) {
				/* 只显示主场景（v1.2 精简：副场景段落不逐条列出） */
				var rowM = el("div", "mce-stage mce-place-row");
				var shM = el("div", "mce-stage-head");
				shM.appendChild(el("span", "mce-dot", ""));
				shM.appendChild(el("span", "mce-stage-name", "主场景　" + g.main + " ★　" + placeNameCN(g.main)));
				var btnM = el("button", "mce-btn mce-gold", "直达");
				btnM.type = "button";
				btnM.title = "跳转到段落：" + g.main;
				(function (target) {
					btnM.addEventListener("click", function () { teleportTo(target); });
				})(g.main);
				shM.appendChild(btnM);
				rowM.appendChild(shM);
				block.appendChild(rowM);
			} else {
				block.appendChild(el("div", "mce-stage-txt", "未匹配到主场景段落（未安装对应 MOD 或版本差异）。"));
			}
			pane.appendChild(block);
		});
		pane.appendChild(el("div", "mce-hint", "共枚举 " + total + " 个可直达段落（已按组精简，仅显示主场景；副场景段落计入统计不逐条列出）。点击「直达」立即跳转，不打断存档。"));
		/* v2.0.10：原版调试报告开关 —— 好友实测「雷米农场野兽战 ERROR: Unexpected $$NPCList[0].pronoun」
		   取证（本体 0.5.12.13 三个 widget 段落逐字核对）：
		     Widgets State Man @rel1196、Widgets Combat Man-Combat @rel160511、Widgets Text @rel51459。
		   原文形态是 `<<elseif $options.debugdisable is "f">> <span class="red">ERROR: Unexpected $$NPCList[0].pronoun: [$NPCList[0].pronoun]</span>`，
		   即「只在玩家把调试报告打开（debugdisable=f）时显示」的开发向诊断行，紧跟着就是原版自己的兜底
		   `<<if $enemytype is "beast" and $monster is 0>> <<set $pronoun to "i">> <</if>>` ——
		   野兽战（beast）本来没有 $NPCList[0]，原版先查再兜底，所以红字必然出现一次，但**不影响结算**。
		   这里给一个开关把它关掉（写 $options.debugdisable="t"），想排查原版逻辑时可再打开。 */
		var dbgSec = mceNewSec(pane, 1, "原版调试报告（$options.debugdisable）",
			"关掉后战斗/状态块不再打印原版开发向诊断（如野兽战的「ERROR: Unexpected $$NPCList[0].pronoun」）。这是设置项，不进留痕；游戏内「设置 → 调试报告」也能手动改回。");
		var dbgRow = el("div", "mce-row");
		var dbgNow = (V && V.options && V.options.debugdisable !== undefined) ? String(V.options.debugdisable) : "（未设置）";
		dbgRow.appendChild(el("span", "mce-row-lbl", "当前值：" + dbgNow + "（t = 关闭诊断，f = 显示诊断）"));
		var dbgWrite = function (val, label) {
			var Vd = getV();
			if (!Vd) { setStatus("尚未进入游戏，无法写入设置", "mce-err"); return; }
			if (typeof Vd.options !== "object" || Vd.options === null) { Vd.options = {}; }
			Vd.options.debugdisable = val;
			setStatus("原版调试报告已" + label + "（$options.debugdisable=" + val + "）", "mce-ok");
			renderPlaces();
		};
		var bDbgOff = el("button", "mce-btn mce-gold", "关闭调试报告");
		bDbgOff.type = "button";
		bDbgOff.addEventListener("click", function () { dbgWrite("t", "关闭"); });
		var bDbgOn = el("button", "mce-btn", "打开（排查用）");
		bDbgOn.type = "button";
		bDbgOn.addEventListener("click", function () { dbgWrite("f", "打开"); });
		dbgRow.appendChild(bDbgOff);
		dbgRow.appendChild(bDbgOn);
		dbgSec.appendChild(dbgRow);
		/* v2.0.10 段落体检：好友报的「(:: Mer Street): cannot find a closing tag for macro <<if>>」三连报，
		   离线复原（把全部包 boot.json 的 passage 规则 + replaceFile 正文逐条套到原版段落）后 Mer Street
		   与 Bedroom 的宏计数完全平衡（Mer Street if 15/15、Bedroom 53/53、link 37/37），
		   说明改写不在 TweeReplacer 层，而在脚本层（启动前直接改 tw-passagedata 的 textContent）。
		   磁盘上的包文本查不出这种改写，只有运行时 Story 文本才是真值 —— 所以把体检做进面板：
		   遍历全部段落（含所有 MOD 改写后的运行时文本），列宏不配对的段落名，供一键复制回传。 */
	function mbCEPassageLint(text) {
		try {
			var s = String(text || "").replace(/\/%[\s\S]*?%\//g, ""); /* 去 SugarCube 注释，避免注释里的示例宏造成假阳性 */
			var defs = [
				{ k: "if", o: /<<if\b/g, c: /<<\/if>>/g },
				{ k: "switch", o: /<<switch\b/g, c: /<<\/switch>>/g },
				{ k: "link", o: /<<link\b/g, c: /<<\/link>>/g },
				{ k: "widget", o: /<<widget\b/g, c: /<<\/widget>>/g },
				{ k: "for", o: /<<for\b/g, c: /<<\/for>>/g },
				{ k: "capture", o: /<<capture\b/g, c: /<<\/capture>>/g }
			];
			var bad = [];
			for (var i = 0; i < defs.length; i++) {
				var o = (s.match(defs[i].o) || []).length;
				var c = (s.match(defs[i].c) || []).length;
				if (o !== c) { bad.push(defs[i].k + " " + o + "/" + c); }
			}
			return bad;
		} catch (e) { return []; }
	}
		var lintSec = mceNewSec(pane, 2, "段落体检（宏结构）",
			"只读扫描：遍历全部段落（含所有 MOD 改写后的运行时文本），统计 if / switch / link / widget / for / capture 的开闭配对，列出不配对的段落。用于定位「cannot find a closing tag for macro <<if>>」「child tag <<elseif>> outside parent」「no usable links」这类只在运行时才出现的段落损坏。不改任何文本、不动存档。");
		var lintRow = el("div", "mce-row");
		var bLint = el("button", "mce-btn mce-gold", "开始体检");
		bLint.type = "button";
		var lintCopy = el("button", "mce-btn", "复制结果");
		lintCopy.type = "button";
		var lintDesc = el("div", "mce-stage-txt", "点「开始体检」后在此列出结果。");
		var lintBody = el("div", "");
		var lintCache = "";
		bLint.addEventListener("click", function () {
			try {
				var ps = listAllPassages();
				var bad = [];
				for (var i = 0; i < ps.length; i++) {
					var r = mbCEPassageLint(ps[i].text);
					if (r.length) { bad.push({ name: ps[i].name, msg: r.join("；"), len: (ps[i].text || "").length }); }
				}
				lintBody.textContent = "";
				lintDesc.textContent = "共扫描 " + ps.length + " 段，宏不配对 " + bad.length + " 段" + (bad.length ? "（其余段落配对正常）" : "（未发现异常）") + "。";
				lintCache = "段落体检 " + new Date().toLocaleString() + "\n共 " + ps.length + " 段，异常 " + bad.length + " 段\n";
				var maxShow = 60;
				for (var j = 0; j < bad.length; j++) {
					var line = bad[j].name + " :: " + bad[j].msg + " :: len=" + bad[j].len;
					lintCache = lintCache + line + "\n";
					if (j < maxShow) {
						var row = el("div", "mce-row");
						row.appendChild(el("span", "mce-row-lbl", line));
						lintBody.appendChild(row);
					}
				}
				if (bad.length > maxShow) {
					lintBody.appendChild(el("div", "mce-hint", "（仅显示前 " + maxShow + " 条，完整结果请点「复制结果」）"));
				}
				setStatus("段落体检完成：异常 " + bad.length + " 段", bad.length ? "mce-err" : "mce-ok");
			} catch (e) { setStatus("体检失败：" + mbCEErr(e), "mce-err"); }
		});
		lintCopy.addEventListener("click", function () {
			try {
				if (!lintCache) { setStatus("请先点「开始体检」", "mce-err"); return; }
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(lintCache).then(function () { setStatus("结果已复制到剪贴板", "mce-ok"); }, function () { setStatus("复制失败，请手动选中文本", "mce-err"); });
				} else { setStatus("当前环境不支持剪贴板，请手动选中文本", "mce-err"); }
			} catch (e) { setStatus("复制失败：" + mbCEErr(e), "mce-err"); }
		});
		lintRow.appendChild(bLint);
		lintRow.appendChild(lintCopy);
		lintSec.appendChild(lintRow);
		lintSec.appendChild(lintDesc);
		lintSec.appendChild(lintBody);
		/* v2.0.3 回退语义补齐：世界入口解锁留痕可见 + 逐项撤回（记录 key = world:<gid>:<path>） */
		var wRows = [];
		if (V && V.mbCE_wrote && typeof V.mbCE_wrote === "object") {
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				if (k.indexOf("world:") !== 0) { return; }
				var rec = V.mbCE_wrote[k];
				if (!rec || !rec.gid) { return; }
				for (var wi = 0; wi < wRows.length; wi++) {
					if (wRows[wi] && wRows[wi].gid === rec.gid) { return; }
				}
				wRows.push({ gid: rec.gid, path: rec.path, before: rec.before, after: rec.after });
			});
		}
		if (wRows.length) {
			var wsec = el("div", "mce-stage");
			var whead = el("div", "mce-stage-head");
			whead.appendChild(el("span", "mce-dot", ""));
			whead.appendChild(el("span", "mce-stage-name", "■ 世界入口解锁记录　（" + wRows.length + " 项，可撤回）"));
			wsec.appendChild(whead);
			wsec.appendChild(el("div", "mce-stage-note", "「直达」会自动把该场景的世界入口条件写进存档（如 Elk Street 的大院入口）。以下为写入留痕；撤回 = 还原到首次写入前状态（原本无该字段则删除）。"));
			wRows.forEach(function (w) {
				var gname = "";
				if (typeof PLACE_GROUPS !== "undefined" && Array.isArray(PLACE_GROUPS)) {
					for (var gi = 0; gi < PLACE_GROUPS.length; gi++) {
						if (PLACE_GROUPS[gi] && PLACE_GROUPS[gi].id === w.gid) { gname = PLACE_GROUPS[gi].name; }
					}
				}
				var entry = (typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS[w.gid] && WORLD_UNLOCKS[w.gid].entry) ? WORLD_UNLOCKS[w.gid].entry : "";
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", (gname || w.gid) + "　" + w.path + "：" + (w.before === undefined ? "（原本无）" : String(w.before)) + " → " + String(w.after) + (entry ? "　（" + entry + "）" : "")));
				var ubtn = el("button", "mce-btn mce-red", "撤回");
				ubtn.type = "button";
				ubtn.setAttribute("data-op", "world-undo");
				(function (gid) {
					ubtn.addEventListener("click", function () {
						var ru = mbCEWorldUndo(gid);
						setStatus(ru.msg, ru.ok ? "mce-ok" : "mce-err");
						if (ru.ok) { renderPlaces(); }
					});
				})(w.gid);
				row.appendChild(ubtn);
				wsec.appendChild(row);
			});
			pane.appendChild(wsec);
		}
	}
	function describeCondition(text, name) {
		try {
			var t = String(text || "");
			var mState = t.match(/"([^"]+)"\s*!==\s*rv\.characters\.npc\.([A-Za-z ]+)\.state/);
			if (mState) { return "角色「" + displayName(mState[2]) + "」当前状态不是「" + (STATE_CN[mState[1]] || mState[1]) + "」（关系未中断）"; }
			var mState2 = t.match(/rv\.characters\.npc\.([A-Za-z ]+)\.state\s*!==\s*"([^"]+)"/);
			if (mState2) { return "角色「" + displayName(mState2[1]) + "」当前状态不是「" + (STATE_CN[mState2[2]] || mState2[2]) + "」（关系未中断）"; }
			var mInc = t.match(/([A-Za-z0-9_]+Seen)\??\.includes\("([^"]+)"\)/);
			if (mInc) {
				var seenLabel = { "ritual_sex": "完成仪式性爱", "yearning": "渴望（收信后）", "partners": "确立恋人关系", "romance": "步入永远关系" }[mInc[2]] || mInc[2];
				return "「" + displayName(name) + "」经历中已记录「" + seenLabel + "」";
			}
			var mBare = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*$/);
			if (mBare) { return TERM_CN[String(mBare[1]).toLowerCase()] ? "已获得/触发「" + TERM_CN[String(mBare[1]).toLowerCase()] + "」" : "变量 " + mBare[1] + " 已为真"; }
			var mEq = t.match(/1\s*===\s*rv\.variables\.([A-Za-z0-9_]+)/);
			if (mEq) { return TERM_CN[String(mEq[1]).toLowerCase()] ? "「" + TERM_CN[String(mEq[1]).toLowerCase()] + "」已成立（=1）" : "变量 " + mEq[1] + " 已置 1"; }
			var mEq2 = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*===\s*1/);
			if (mEq2) { return TERM_CN[String(mEq2[1]).toLowerCase()] ? "「" + TERM_CN[String(mEq2[1]).toLowerCase()] + "」已成立（=1）" : "变量 " + mEq2[1] + " 已置 1"; }
			var mLi = t.match(/rv\.variables\.loveInterest\.includes\("([^"]+)"\)/);
			if (mLi) { return "「" + displayName(mLi[1]) + "」已确立恋人关系（角色出现在恋人槽位）"; }
			var mGe = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*>=\s*(\d+)/);
			if (mGe) { return TERM_CN[String(mGe[1]).toLowerCase()] ? "「" + TERM_CN[String(mGe[1]).toLowerCase()] + "」≥ " + mGe[2] : "变量 " + mGe[1] + " ≥ " + mGe[2]; }
			var mUndef = t.match(/undefined\s*===\s*rv\.variables\.([A-Za-z0-9_]+)/);
			if (mUndef) { return TERM_CN[String(mUndef[1]).toLowerCase()] ? "「" + TERM_CN[String(mUndef[1]).toLowerCase()] + "」未触发（事件未开始）" : "变量 " + mUndef[1] + " 未触发"; }
			return "";
		} catch (e) { return ""; }
	}

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
	/* v1.9.28：evalSceneExpr 编译缓存（同表达式只 new Function 一次，判定函数每次调用实时读 V）。
	   注意：V.scenePassages=[] 兜底初始化是场景求值语义的一部分（存档/流程缺失该 story 变量时防
	   undefined.includes 崩溃），每次调用仍执行，不缓存；仅缓存编译后的判定函数。 */
	var sceneExprFnCache = Object.create(null);
	var sceneExprFnCacheN = 0;
	function evalSceneExpr(expr) {
		var s = String(expr || "").trim();
		if (!s) { return true; }
		var code = tweeToJS(s);
		var V = getV();
		if (!V) { return undefined; }
		/* v1.4.4：原版 scenes 的 unlocked 全部依赖 $scenePassages.includes(...)（已看段落表），
		   该 story 变量在部分存档/流程下缺失 → 兜底初始化为空数组，避免 undefined.includes 崩溃导致状态未知 */
		if (!Array.isArray(V.scenePassages)) { V.scenePassages = V.scenePassages || []; }
		var fn = sceneExprFnCache[code];
		if (!fn) {
			fn = new Function("V", "return (" + code + ");");
			if (sceneExprFnCacheN >= 512) { sceneExprFnCache = Object.create(null); sceneExprFnCacheN = 0; }
			sceneExprFnCache[code] = fn;
			sceneExprFnCacheN += 1;
		}
		return fn(V);
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
	/* 场景注册表：优先解析 Story 原文（实时求值 unlocked）→ Story 全文恢复 → V.scenes 缓存。
	   v1.9.28：新增模块级缓存（键 = Story 对象引用 + size + passages 数组引用/长度 三重信号）——
	   Story 被替换、passages 数组被原地替换/增删（测试与热重载场景）即失效重建，
	   避免每次渲染全量扫描全部段落（07h:45 折叠懒渲染 / 07f 锚定 166/180/194 高频调用）。
	   真机 SugarCube Story 静态不变 → 恒命中；缓存只存「widget 解析结果 / Story 恢复结果」，
	   V.scenes 运行时注入每次调用实时合并（不缓存，防陈旧）。 */
	var scenesDefsCache = null; /* { ref, size, passRef, passLen, parsed, recovered } */
	function getScenesDefs() {
		var V = getV();
		var st = (typeof Story !== "undefined" && Story) ? Story : null;
		var stSize = (st && typeof st.size === "number") ? st.size : -1;
		var stPass = (st && Array.isArray(st.passages)) ? st.passages : null;
		var stPassLen = stPass ? stPass.length : -1;
		if (!(scenesDefsCache && scenesDefsCache.ref === st && scenesDefsCache.size === stSize
			&& scenesDefsCache.passRef === stPass && scenesDefsCache.passLen === stPassLen)) {
			var parsed = null, recovered = null;
			try {
				var widget = findScenesWidgetText();
				parsed = widget ? parseScenesFromText(widget) : null;
				if (!parsed) { recovered = recoverSceneDefsFromStory(); }
			} catch (e) { parsed = null; recovered = null; }
			scenesDefsCache = { ref: st, size: stSize, passRef: stPass, passLen: stPassLen, parsed: parsed, recovered: recovered };
		}
		var parsedC = scenesDefsCache.parsed;
		if (parsedC) {
			var merged = {};
			Object.keys(parsedC).forEach(function (k) { merged[k] = parsedC[k]; });
			/* v1.9.2 自查：MOD 运行时注入（Object.assign($scenes, {...}) / 框架注册）的键只在
			   V.scenes 存档缓存、不在 widget 原文——合并进解析结果，确保 MOD 区显示运行时新增场景 */
			var sc2 = V && V.scenes;
			if (sc2 && typeof sc2 === "object") {
				Object.keys(sc2).forEach(function (k) {
					if (merged[k]) { return; }
					var s = sc2[k];
					if (!s || typeof s !== "object") { return; }
					merged[k] = {
						name: s.name, startPassage: s.startPassage, passages: Array.isArray(s.passages) ? s.passages.slice() : [],
						manualVariableChanges: s.manualVariableChanges,
						unlockedExpr: typeof s.unlocked === "string" ? s.unlocked : "",
						lockedExpr: typeof s.lockedMessage === "string" ? s.lockedMessage : "",
						lockedCache: s.lockedMessage, unlockedCache: s.unlocked
					};
				});
			}
			return { defs: merged, live: true };
		}
		/* v1.4.8：widget 段落定位失败 → Story 全文恢复（汉化/段落名变体兜底） */
		var recoveredC = scenesDefsCache.recovered;
		if (recoveredC) {
			var out2 = {};
			Object.keys(recoveredC).forEach(function (k) { out2[k] = recoveredC[k]; });
			return { defs: out2, live: true };
		}
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

/* ============================================================
 * 07f-lock.js — 数值固定（Lock Values）
 * 需求实证（玩家反馈 + 模组对照源码核对 dw257）：
 *  - 枯木逢春渡鸦转化 maplebirch.transformation.raven.build：未戴「渡鸦羽毛项链」时
 *    每日衰减（Raven.ts decayConditions: build≥1 && 项链≠raven feather necklace）
 *  - 原版天使转化 angel：无三位一体（VanillaPlus.divineTransformations.trinity）时
 *    成长点数仍会减少（Trinity 特质说明 "their development points no longer decrease"）
 *  - 堕天使每日纯洁流失 / 恶魔高于最低纯洁结束日压力（VanillaPlus 特质文本）
 *  - 亡灵转化 maplebirch.transformation.undead.level：诅咒每游戏小时 Psyche -2 + 压力
 *    （Undead.ts regTimeEvent onSec deadwood-undead-curse），来源为金币洞穴诅咒
 * 机制：锁定向存 V.mbCE_lock（[{path,target}]，存档内持久，读档自动恢复）；
 *      常驻 1s 定时器遍历写回（v2.0.7 P4：写回前先落 `lock:<path>` 留痕，回退中心可「取消锁定+还原原值」；
 *      同 path 复用一条，before 恒为首次覆盖前的真实值，不影响 400 条留痕窗口）；
 *      无锁定向空转直接返回。UI 挂「全局」页 renderGlobal 末尾（mbCERenderLock）。
 * ============================================================ */

/* 预设推荐项：真实键名全部来自 CE 适配器声明/模组对照源码（dw257）与 DoL 原版转化键 */
var MB_CE_LOCK_PRESETS = [
	{ path: "maplebirch.transformation.raven.build", name: "渡鸦转化点数", note: "未戴渡鸦羽毛项链时每日衰减" },
	{ path: "maplebirch.transformation.horse.build", name: "马转化点数", note: "build≥1 后模组自带停止衰减，可锁" },
	{ path: "maplebirch.transformation.whale.build", name: "鲸转化点数", note: "" },
	{ path: "maplebirch.transformation.undead.level", name: "亡灵转化等级", note: "锁 0 解除亡灵诅咒（每游戏小时扣 Psyche/涨压力）" },
	{ path: "angel", name: "天使转化等级", note: "无三位一体时成长点数会减少/失贞掉级" },
	{ path: "fallenangel", name: "堕落天使等级", note: "≥4 堕天使判定；每日纯洁流失" },
	{ path: "demon", name: "恶魔转化等级", note: "" },
	{ path: "purity", name: "纯洁（0-2000 内部）", note: "面板显示 0-100%，内部 0-2000" }
];

/* 锁定向：V.mbCE_lock = [{ path, target }]（target 恒 number，0/1 也按 number 写，防 ===1 语义破坏） */
function mbCELockData() {
	var Vp = getV();
	if (!Vp || typeof Vp !== "object") { return null; }
	if (!Array.isArray(Vp.mbCE_lock)) { Vp.mbCE_lock = []; }
	return Vp.mbCE_lock;
}
/* v2.0.1：锁定相关文案一律走中文名（原先直接拼 path，状态栏出现「已锁定 history = 1000」这种英文裸 key）。
   取值顺序：快速面板索引的中文 label → 全局键名映射 zhKey → 原 path（三级回落，任何一级缺失都不会显示空串） */
function mbCELockLabel(path) {
	try {
		if (typeof ensureQuickIndex === "function") {
			var it = ensureQuickIndex()[path];
			if (it && it.label) { return it.label; }
		}
	} catch (e) {}
	try {
		if (typeof zhKey === "function") {
			var z = zhKey(path);
			if (z && z !== path) { return z; }
			var leafParts = String(path).split(".");
			var leaf = leafParts[leafParts.length - 1];
			var z2 = zhKey(leaf);
			if (z2 && z2 !== leaf) { return z2; }
		}
	} catch (e2) {}
	return String(path);
}
/* v2.0.8：判定类接口一律**只读**，不经 mbCELockData 建空表——
   此前 mbCELurkerState（只读查询）经 mbCELockHas → mbCELockData 会把 V.mbCE_lock 就地创建出来，
   等于「查一次就改存档」。建表只留给 mbCELockSet/mbCERenderLock 这类明确要写的地方。 */
function mbCELockListRO() {
	try {
		var Vp = getV();
		return (Vp && Array.isArray(Vp.mbCE_lock)) ? Vp.mbCE_lock : null;
	} catch (e) { return null; }
}
function mbCELockHas(path) {
	var list = mbCELockListRO();
	if (!list) { return false; }
	for (var i = 0; i < list.length; i++) { if (list[i] && list[i].path === path) { return true; } }
	return false;
}
function mbCELockTarget(path) {
	var list = mbCELockListRO();
	if (!list) { return undefined; }
	for (var i = 0; i < list.length; i++) { if (list[i] && list[i].path === path) { return list[i].target; } }
	return undefined;
}
/* replay=true：由 08d 的「确认写入」回调重放，跳过预览门控（防递归） */
function mbCELockSet(path, target, replay) {
	var Vp = getV();
	if (!Vp || !path) { return { ok: false, message: "存档变量不可用或路径为空" }; }
	/* 路径段校验：拒绝空段（"a..b"）与纯点串，防建脏键 */
	var pParts = String(path).split(".");
	for (var pi = 0; pi < pParts.length; pi++) { if (!pParts[pi]) { return { ok: false, message: "路径格式无效（存在空段）：" + path }; } }
	var num = Number(target);
	if (!isFinite(num)) { return { ok: false, message: "锁定目标必须是有限数值" }; }
	/* v2.0.7（D4）：锁定同样走 diff 预览——此前 mbCELockSet 直写 setPathVal + 写锁表，完全绕过 gate，
	   导致「锁定」这类最常在面板里做的写入，开预览时反而看不到确认条。 */
	if (!replay && typeof mbCEPreviewGate === "function") {
		var curNow = mbCELockRead(Vp, path);
		if (mbCEPreviewGate(path, curNow === undefined ? "（无此字段）" : curNow, num,
			function () { return mbCELockSet(path, target, true); })) {
			return { ok: false, pending: true, message: "待确认锁定：" + mbCELockLabel(path) + " = " + num };
		}
	}
	var list = mbCELockData();
	if (!list) { return { ok: false, message: "存档变量不可用" }; }
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].path === path) { list[i].target = num; mbCELockEnsureTimer(); mbCELockTick(); return { ok: true, message: "已更新锁定 " + mbCELockLabel(path) + " = " + num }; }
	}
	list.push({ path: path, target: num });
	mbCELockEnsureTimer();
	mbCELockTick(); /* 立即生效：点击即改值，不等下个 1s tick（不存在的键仍跳过，不凭空创建） */
	return { ok: true, message: "已锁定 " + mbCELockLabel(path) + " = " + num };
}
function mbCELockRemove(path) {
	var Vp = getV();
	var list = Vp && Vp.mbCE_lock;
	if (!list) { return { ok: false, message: "无锁定记录" }; }
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].path === path) { list.splice(i, 1); mbCELockEnsureTimer(); return { ok: true, message: "已取消锁定 " + mbCELockLabel(path) }; }
	}
	return { ok: false, message: "该路径未锁定" };
}

/* 深路径读取（只读不建壳；宿主缺失返回 undefined） */
function mbCELockRead(V, path) {
	var parts = String(path).split(".");
	var cur = V;
	for (var i = 0; i < parts.length; i++) {
		if (cur == null || typeof cur !== "object") { return undefined; }
		cur = cur[parts[i]];
	}
	return cur;
}

/* P4（v2.0.7）：锁定写回留痕——同 path 只留一条 `lock:<path>`，before 恒为「第一次被锁定覆盖前的真实值」，
   之后每 1 秒只更新 after/t，不会把 400 条留痕窗口冲掉。回退中心据此可以「取消锁定 + 还原锁定前值」，
   否则玩家在回退中心看不到任何锁定写入（旧实现是直写 setPathVal、完全不留痕）。 */
function mbCELockTrace(Vp, path, before, after) {
	try {
		if (!Vp || !path) { return; }
		if (!Vp.mbCE_wrote || typeof Vp.mbCE_wrote !== "object") { Vp.mbCE_wrote = {}; }
		var key = "lock:" + path;
		var prev = Vp.mbCE_wrote[key];
		if (prev && prev.type === "lock" && typeof prev === "object") {
			/* 原地更新：t 保留首次落痕时间（不然每秒刷新会把这条顶到回退中心最前、挤掉真的一次性写入），
			   last 记最近一次写回，before 只在缺失时补 */
			if (prev.before === undefined) { prev.before = before; }
			prev.after = after;
			prev.last = Date.now();
			return;
		}
		Vp.mbCE_wrote[key] = { type: "lock", path: path, before: before, after: after, t: Date.now(), last: Date.now() };
	} catch (e) {}
}

/* 强制写回：当前值 ≠ 锁定目标 → 先记留痕（mbCELockTrace）再写回。
   安全边界：当前值不存在（undefined）时跳过——只固定「已存在」的值，
   绝不因锁定而 setPathVal 凭空创建字段（防把未触发的转化/未开的键造出来）。 */
function mbCELockTick() {
	var Vp = getV();
	var list = Vp && Vp.mbCE_lock;
	if (!Vp || !Array.isArray(list) || !list.length) { return; }
	var wrote = 0;
	for (var i = 0; i < list.length; i++) {
		var it = list[i];
		if (!it || !it.path) { continue; }
		var cur = mbCELockRead(Vp, it.path);
		if (cur === undefined) { continue; }
		var tgt = Number(it.target);
		/* v2.0.8 形态兜底：旧判据 `Number(cur) !== Number(it.target)` 有两个真缺陷——
		   ① Number(null)===0，让「空值 + 锁 0」被判为已达标、永不写回；
		   ② 字符串键（如 hookah.drink="wine"）被 Number() 成 NaN 后仍走写回，把原值写成数字。
		   现判据：number 严格比；null 视为空值写回；可解析有限数的字符串（"5"）形态归一为数字
		   （模组按 `<<if $X is 5>>` 判，字符串恒假）；其余（布尔 / 对象 / 不可解析字符串 / 空白串）跳过不覆盖。 */
		var need = false;
		if (typeof cur === "number") { need = (cur !== tgt); }
		else if (cur === null) { need = true; }
		else if (typeof cur === "string" && cur.trim() !== "" && isFinite(Number(cur))) { need = true; }
		if (!need) { continue; }
		mbCELockTrace(Vp, it.path, cur, tgt);
		setPathVal(Vp, it.path, tgt);
		wrote++;
	}
	/* 锁定条数多时（每个 path 一条留痕）仍要守住 400 条窗口，走同一套 trim */
	if (wrote && typeof mbCEWroteTrim === "function") {
		try { mbCEWroteTrim(Vp); } catch (eTrim) {}
	}
}

/* 惰性定时器：有锁定向才启动 1s 写回（无锁定向不空转——防 jsdom/测试进程被挂起句柄拖住），
   启动时机：mbCELockSet/Remove 成功后、renderGlobal 渲染锁定区块时、模块加载时兜底（读档恢复） */
var mbCELockTimer = null;
function mbCELockEnsureTimer() {
	try {
		var Vp = getV();
		var list = Vp && Vp.mbCE_lock;
		var has = Array.isArray(list) && list.length > 0;
		if (has && !mbCELockTimer) {
			mbCELockTimer = setInterval(function () { try { mbCELockTick(); } catch (e) {} }, 1000);
		} else if (!has && mbCELockTimer) {
			clearInterval(mbCELockTimer);
			mbCELockTimer = null;
		}
	} catch (e) {}
}

/* v2.0.10：锁定恢复统一入口——翻页（:passagedisplay）、初始化、外部刷新时调用。
   修「明明已经锁定，数值却会变化」：脚本注入阶段 State 尚未就绪，模块加载期的 ensure 拿到空 V、
   定时器根本没起；此后原先只有打开 CE 面板（mbCERenderLock）才补，玩家不打开面板就全程不写回
   （实测：意志被游戏 V.willpower *= 0.99 衰减到 99 就一直停在 99）。
   这里 ensure + 立即 tick 一轮，游戏刚改的值当场纠回，不必等 1s 间隔。 */
function mbCELockResume() {
	try { mbCELockEnsureTimer(); } catch (e0) {}
	try { mbCELockTick(); } catch (e1) {}
}

/* v2.0.10：所有「按需 1s 定时器」的统一恢复入口。
   同一类缺陷不止锁定一处：潜伏者自动搬运（mbCELurkerEnsureTimer）、转化隐藏校验（mbCEHideEnsureTimer）、
   态度维持（mbCEAttitudeEnsureTimer）原先都只在「点过开关 / 打开对应页」时起表，而脚本注入早于读档，
   注入期 ensure 一律拿不到 V → 刷新后不打开对应页面就全程不生效（与言灵页 v2.0.0.006 修法同构）。
   翻页（:passagedisplay）与 init() 都走这里，保证「不打开面板也生效」。 */
function mbCEResumeTimers() {
	try { mbCELockResume(); } catch (eA) {}
	try { mbCELurkerEnsureTimer(); } catch (eB) {}
	try { mbCEHideEnsureTimer(); } catch (eC) {}
	try { mbCEAttitudeEnsureTimer(); } catch (eD) {}
	try { mbCEYanlingEnsureTimer(); } catch (eE) {}
}

/* 锁定来源判定（P1：自定义锁定项默认收进折叠组，这里给每行标出「谁锁的」）：
   ① 命中快速面板索引 → 角色页锁的；② 留痕里同 path 的 cheat 记录 → Mod作弊页锁的；③ 其余 → 手动自由添加 */
function mbCELockSource(path) {
	try {
		if (typeof ensureQuickIndex === "function") {
			var idx = ensureQuickIndex();
			if (idx && idx[path]) { return "角色页"; }
		}
	} catch (e) {}
	try {
		var w = getV() && getV().mbCE_wrote;
		if (w) {
			var ks = Object.keys(w);
			for (var i = 0; i < ks.length; i++) {
				var rec = w[ks[i]];
				if (rec && rec.type === "cheat" && rec.path === path) { return "Mod作弊"; }
			}
		}
	} catch (e2) {}
	return "手动";
}

/* 全局页区块渲染（由 renderGlobal 在末尾调用；pane = [data-pane="global"] 容器） */
function mbCERenderLock(pane) {
	if (!pane) { return; }
	mbCELockEnsureTimer(); /* 开面板兜底：读档后已有锁定向时恢复写回 */
	var sec = mceNewSec(pane, 8, "数值固定", "锁定后每 1 秒强制写回目标值，直到手动取消；锁定表存于存档 V.mbCE_lock，读档自动恢复。预设为模组实证键：渡鸦转化未戴羽毛项链会每日衰减、天使无三位一体成长点会减少、堕天使每日纯洁流失、亡灵诅咒每秒扣 Psyche/涨压力——锁目标值即可防这些机制改值。注意软上限：意志/体能/容貌等属性在原版受 $willpowermax / $physiquemax / $beautymax 约束（游戏每次结算走 Math.clamp 钳到上限），锁超过上限的值会被拉回；要真突破上限，把对应 *max 键一起锁定。");
	var Vg = getV();
	var presetPaths = {};
	MB_CE_LOCK_PRESETS.forEach(function (p) { presetPaths[p.path] = true; });
	var makeRow = function (it, locked, parent) {
		var row = el("div", "mce-row");
		row.setAttribute("data-lockpath", it.path);
		var lbl = el("span", "mce-row-lbl", it.name + "（" + it.path + "）当前 ");
		var val = el("span", "mce-value", String(mbCELockRead(Vg, it.path) === undefined ? "—" : mbCELockRead(Vg, it.path)));
		lbl.appendChild(val);
		if (it.note) { lbl.appendChild(el("span", "mce-ab-note", " " + it.note)); }
		/* v2.0.8：锁了但当前值不是数值形态 → tick 会跳过（不覆盖原值），这里必须明示，不能静默失效 */
		if (locked) {
			var cv0 = mbCELockRead(Vg, it.path);
			var cvNumOk = (cv0 === null) || (typeof cv0 === "number")
				|| (typeof cv0 === "string" && cv0.trim() !== "" && isFinite(Number(cv0)));
			if (!cvNumOk && cv0 !== undefined) { lbl.appendChild(el("span", "mce-ab-note", " 当前值非数值，锁定不会写回")); }
		}
		row.appendChild(lbl);
		/* P1：自定义项标注来源，让玩家一眼看出这条不是预设、是被哪个页面锁上的 */
		if (it.source) { row.appendChild(el("span", "mce-badge mce-src", it.source)); }
		var inp = el("input", "mce-inp");
		inp.type = "number";
		inp.value = String(locked ? it.target : (Number(mbCELockRead(Vg, it.path)) || 0));
		inp.placeholder = "目标值";
		row.appendChild(inp);
		var btn = el("button", "mce-btn" + (locked ? " mce-gold" : ""), locked ? "更新目标" : "锁定");
		btn.type = "button";
		btn.addEventListener("click", function () {
			var r = mbCELockSet(it.path, Number(inp.value));
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			if (r.ok) { renderGlobal(); }
		});
		/* v1.9.15 输入框回车即提交（等价点击按钮） */
		inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { btn.click(); } });
		row.appendChild(btn);
		if (locked) {
			var ub = el("button", "mce-btn mce-red", "取消");
			ub.type = "button";
			ub.addEventListener("click", function () {
				var r = mbCELockRemove(it.path);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) { renderGlobal(); }
			});
			row.appendChild(ub);
		}
		(parent || sec).appendChild(row);
	};
	/* 预设行：未锁定 → 「锁定」；已锁定 → 「更新目标/取消」 */
	MB_CE_LOCK_PRESETS.forEach(function (p) { makeRow(p, mbCELockHas(p.path)); });
	/* P1（玩家图 3/图 4）：自定义锁定项**不再平铺在「⑧数值固定」列表里**——
	   属性页能锁的 beauty/physique/willpower/skulduggery/danceskill/swimmingskill/athletics
	   全不是预设，原先会被无条件追加成 7 行，把全局页撑成一张「锁定数值清单」。
	   现在收进默认收起的折叠组，并逐行标注来源（角色页 / Mod作弊 / 手动）。 */
	var list = mbCELockListRO();
	var customs = [];
	if (list) {
		for (var i = 0; i < list.length; i++) {
			var li = list[i];
			if (!li || !li.path || presetPaths[li.path]) { continue; }
			customs.push(li);
		}
	}
	if (customs.length) {
		var ckey = "lock:custom";
		var openC = !!(typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.collapsed && mbCEUiState.collapsed[ckey] === 0);
		var grp = el("div", "mce-grp");
		var head = el("div", "mce-grp-t mce-collapse-head", (openC ? "▾ " : "▸ ") + "其他已锁定（来自角色页 / Mod作弊页）　" + customs.length + " 条");
		var body = el("div", "mce-grp-body");
		body.setAttribute("data-collapsed", openC ? "0" : "1");
		head.addEventListener("click", function () {
			var open = body.getAttribute("data-collapsed") !== "1";
			body.setAttribute("data-collapsed", open ? "1" : "0");
			head.textContent = (open ? "▸ " : "▾ ") + "其他已锁定（来自角色页 / Mod作弊页）　" + customs.length + " 条";
			if (typeof mbCEUiCollapsed === "function") { mbCEUiCollapsed(ckey, !open); }
		});
		grp.appendChild(head);
		grp.appendChild(body);
		body.appendChild(el("div", "mce-hint", "这些不是预设项，是你在角色页（快速面板 / 转化）或 Mod 作弊页点过「锁定」后落到 $V.mbCE_lock 的；默认收起，展开可改目标值或取消。"));
		customs.forEach(function (li) {
			makeRow({ path: li.path, name: mbCELockLabel(li.path), note: "", source: mbCELockSource(li.path) }, true, body);
		});
		sec.appendChild(grp);
	}
	/* 自由添加 */
	var addRow = el("div", "mce-row");
	addRow.appendChild(el("span", "mce-row-lbl", "自由添加（任意 varPath，按数值写回）："));
	var addPath = el("input", "mce-inp mce-path");
	addPath.type = "text";
	addPath.value = "";
	addPath.placeholder = "如 more_love_interests.x.love";
	addRow.appendChild(addPath);
	var addVal = el("input", "mce-inp");
	addVal.type = "number";
	addVal.value = "0";
	addVal.placeholder = "目标值";
	addRow.appendChild(addVal);
	var addBtn = el("button", "mce-btn mce-gold", "添加");
	addBtn.type = "button";
	addBtn.addEventListener("click", function () {
		var p = String(addPath.value || "").trim();
		if (!p) { setStatus("请填写要固定的 varPath", "mce-err"); return; }
		var r = mbCELockSet(p, Number(addVal.value));
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		if (r.ok) { renderGlobal(); }
	});
	/* v1.9.15 自由添加输入框回车即提交 */
	var submitAdd = function (e) { if (e.key === "Enter") { addBtn.click(); } };
	addPath.addEventListener("keydown", submitAdd);
	addVal.addEventListener("keydown", submitAdd);
	addRow.appendChild(addBtn);
	sec.appendChild(addRow);
}

/* 模块加载兜底：读档后 V 已有锁定向时恢复写回（V 未就绪时静默跳过，开面板时 mbCERenderLock 再补） */
mbCELockEnsureTimer();
/* ============ v2.0.0.002 需求⑥：潜伏者捕捉狂（无上限）+ 水烟馆冰箱（无上限） ============
   原版取证见同批次 07f-lurker0-patch.js 头部（逐字取自 DoL 0.5.12.13）：
     捕捉门控 5 处 `$farm_stage gte 10 and $lurkers_held lt 1`；
     冰箱门控 `$lurkers_held gte 1 and $hookah.lurkers lt 5` + `<<switch $hookah.lurkers>>` 只映射 1–5；
     成功结算 `$lurkers_held += 1` 本身无上界。
   本文件的两条语义：
     ① 无上限 —— 由 07f-lurker0-patch 在 SugarCube 启动前改 passage 文本解除门控，手持/冰箱都能累积到任意只；
     ② 保底 —— 补丁未命中时（版本差异/加载顺序），可开"自动搬运"把抓到的转入冰箱与蒸馏笼，
        手上常空使 `lt 1` 恒成立，等价"可以无限次捕捉"（但手持不累积，UI 会如实标注）。
   旧口径（`hookah.lurkers` 一律钳 0–5）已作废：那是把显示缺陷当成上限。 */
var mbCELurkerTimer = null;
var MB_CE_LURKER_MAX = 9999; /* 数值写入上限（原版无上界，这里只做防呆） */
var MB_CE_LURKER_FRIDGE_MAX = MB_CE_LURKER_MAX; /* 兼容旧符号：冰箱不再钳 5 */
function mbCELurkerV() {
	try { return (typeof getV === "function") ? getV() : null; } catch (e) { return null; }
}
/* v2.0.8：存档类型漂移兜底——hookah.lurkers / lurkers_stored 若是字符串 "5"（导入存档、模组直接 <<set>> 常见），
   旧写法 `typeof === "number" ? v : 0` 会把「0 + held」写上去，原有的 5 只直接消失。凡能解析成有限数的都按数用。
   读值给面板用（非数值形态返回 null，「—」比伪造成 0 更诚实）；累加用 mbCELurkerNum（无法解析才按 0 起算）。 */
function mbCELurkerReadable(v) {
	if (typeof v === "number" && isFinite(v)) { return v; }
	if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))) { return Number(v); }
	return null;
}
function mbCELurkerNum(v) {
	var n = mbCELurkerReadable(v);
	return (n === null) ? 0 : n;
}
function mbCELurkerState() {
	var V = mbCELurkerV();
	if (!V) { return { ok: false, message: "存档变量不可用" }; }
	var patch = (typeof mbCELurkerPatchReport === "function") ? mbCELurkerPatchReport() : null;
	return {
		ok: true,
		held: mbCELurkerReadable(V.lurkers_held),
		fridge: (V.hookah && typeof V.hookah === "object") ? mbCELurkerReadable(V.hookah.lurkers) : null,
		juice: (V.hookah && typeof V.hookah === "object" && typeof V.hookah.juice === "number") ? V.hookah.juice : null,
		stored: mbCELurkerReadable(V.lurkers_stored),
		captured: (typeof V.stat_lurkers_captured === "number") ? V.stat_lurkers_captured : null,
		farmStage: (typeof V.farm_stage === "number") ? V.farm_stage : null,
		auto: !!(V.mbCE_lurkerAuto),
		lockHeld: mbCELurkerLocked("lurkers_held"),
		lockFridge: mbCELurkerLocked("hookah.lurkers"),
		lockStored: mbCELurkerLocked("lurkers_stored"),
		patch: patch
	};
}
function mbCELurkerSet(path, val) {
	return cheatWriteValue("player-self", "p:lurker:" + path, "value_set", path, val, "number", 0, MB_CE_LURKER_MAX);
}
/* P3（v2.0.7）：三处写入目标都可能被「数值固定」锁住。锁定优先——被锁的键不由自动搬运抢写，
   否则 1 秒 tick 立刻把值写回目标，搬运结果玩家根本看不到，还会来回抖动。 */
function mbCELurkerLocked(path) {
	try { return (typeof mbCELockHas === "function") && !!mbCELockHas(path); } catch (e) { return false; }
}
/* 自动搬运一轮：held → 冰箱 → 农场笼；返回搬运只数（仅在补丁未生效时由玩家手动开启）
   锁优先细则：held 被锁 → 整轮不搬；冰箱被锁 → 跳过冰箱这站（继续尝试笼）；笼被锁 → 跳过笼；
   两站都被锁则原地保留 held（等价「只搬运到还有空位的目标」），不丢不重。 */
function mbCELurkerAutoTick() {
	try {
		var V = mbCELurkerV();
		if (!V || !V.mbCE_lurkerAuto) { return 0; }
		var held = mbCELurkerNum(V.lurkers_held);
		if (held < 1) { return 0; }
		if (mbCELurkerLocked("lurkers_held")) { return 0; }
		var moved = 0;
		if (V.hookah && typeof V.hookah === "object" && !mbCELurkerLocked("hookah.lurkers")) {
			var hl = mbCELurkerNum(V.hookah.lurkers);
			/* 补丁生效后冰箱无上限，直接全搬；未生效时也照搬（消耗/pluralise 按真实值走，仅文案显示降级） */
			V.hookah.lurkers = hl + held;
			moved += held; held = 0;
		}
		if (held > 0 && !mbCELurkerLocked("lurkers_stored")) {
			V.lurkers_stored = mbCELurkerNum(V.lurkers_stored) + held;
			moved += held; held = 0;
		}
		V.lurkers_held = held;
		if (moved) { V.mbCE_lurkerMoved = ((typeof V.mbCE_lurkerMoved === "number") ? V.mbCE_lurkerMoved : 0) + moved; }
		return moved;
	} catch (e) { return 0; }
}
function mbCELurkerEnsureTimer() {
	try {
		var V = mbCELurkerV();
		var on = !!(V && V.mbCE_lurkerAuto);
		if (on && !mbCELurkerTimer) {
			mbCELurkerTimer = setInterval(function () {
				var moved = mbCELurkerAutoTick();
				if (moved && typeof renderGlobal === "function" && root.querySelector('[data-pane="global"]')) { renderGlobal(); }
			}, 500);
		} else if (!on && mbCELurkerTimer) {
			clearInterval(mbCELurkerTimer); mbCELurkerTimer = null;
		}
	} catch (e) { /* 面板未就绪时静默 */ }
}
function mbCELurkerSetAuto(on) {
	var V = mbCELurkerV();
	if (!V) { return { ok: false, message: "存档变量不可用" }; }
	V.mbCE_lurkerAuto = !!on;
	mbCELurkerEnsureTimer();
	return {
		ok: true,
		message: on
			? "已开启自动搬运（保底模式）：抓到即刻转入冰箱与农场笼，手上常空 → 捕捉链永不被上限卡住"
			: "已关闭自动搬运：手持可累积（解限补丁生效时正常无上限）"
	};
}
function mbCELurkerPatchLabel(st) {
	if (st && st.patch && st.patch.ok) {
		var extra = "";
		if (st.patch.kept) { extra += " · 长度守恒 " + st.patch.kept; }
		if (st.patch.skipped) { extra += " · 汉化在场保留 switch " + st.patch.skipped; }
		return "解限补丁：已生效（" + st.patch.hits + " 处" + extra + "）";
	}
	return "解限补丁：未命中";
}
function mbCERenderLurker(pane) {
	if (!pane) { return; }
	mbCELurkerEnsureTimer();
	var st = mbCELurkerState();
	var sec = mceNewSec(pane, 9, "潜伏者", "原版上限来自 twee 门控（不是数值上限）：捕捉 `$farm_stage gte 10 and $lurkers_held lt 1`（5 处）、存冰箱 `$lurkers_held gte 1 and $hookah.lurkers lt 5`、冰箱文案只映射 1–5。CE 在 SugarCube 启动前改这些 passage 文本（不动磁盘上的任何模组包），手持与冰箱都可累积到任意只。改法为「等长替换」（右补空格，字符总数不变）——汉化包按字符偏移逐条匹配译文，长度一变就会整段落回英文（v2.0.4 修复）。汉化在场时冰箱 switch 原文保留（>5 只原版文案显示 no，真实数量看本面板数值），否则改写成真实数值。未命中时可用下方「自动搬运」保底：手上常空，等价无限次捕捉。");
	if (!st.ok) { sec.appendChild(el("div", "mce-err", st.message)); return; }
	var rows = [
		{ path: "lurkers_held", name: "手持潜伏者（无上限）", cur: st.held, note: "原版 ≥1 即不再出网；解限后不再受限" },
		{ path: "hookah.lurkers", name: "水烟馆冰箱（无上限）", cur: st.fridge, note: "≥1 可消耗换 50 juice；未装汉化时显示真实数量，装汉化时 >5 保留原版 no（真实数量看本行数值）" },
		{ path: "lurkers_stored", name: "农场蒸馏笼", cur: st.stored, note: "farm_stage ≥9 时每 7 天 1 只 → 1 瓶" }
	];
	rows.forEach(function (r) {
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", r.name + "（当前 " + (r.cur == null ? "—" : r.cur) + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = (r.cur == null) ? "0" : String(r.cur);
		inp.title = r.note;
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () {
			var raw = String(inp.value || "").trim();
			if (!/^-?\d+(?:\.\d+)?$/.test(raw)) { setStatus("请输入数字", "mce-err"); return; }
			var res = mbCELurkerSet(r.path, Number(raw));
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderGlobal();
		});
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () {
			var res = undoCheatModValue("player-self", "p:lurker:" + r.path);
			setStatus(res.message, res.ok ? "mce-ok" : "mce-err");
			renderGlobal();
		});
		row.appendChild(inp); row.appendChild(b); row.appendChild(und);
		sec.appendChild(row);
	});
	var actRow = el("div", "mce-row");
	var rep = el("button", "mce-btn mce-gold", "重新应用解限补丁"); rep.type = "button";
	rep.title = "DOM 通道已过时点时改 Story 文本重试（普通剧情入口有效，widget 定义无法覆盖）";
	rep.addEventListener("click", function () {
		var r = mbCELurkerRepatch();
		setStatus(r.message, r.ok ? "mce-ok" : "mce-warn");
		renderGlobal();
	});
	var sw = el("button", st.auto ? "mce-btn mce-gold" : "mce-btn", st.auto ? "自动搬运：开" : "自动搬运：关");
	sw.type = "button";
	sw.title = "补丁未命中时的保底：每 0.5 秒把手持潜伏者转入冰箱/蒸馏笼，手上常空 → 捕捉不再被 1 只卡住";
	sw.addEventListener("click", function () {
		var r = mbCELurkerSetAuto(!st.auto);
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		renderGlobal();
	});
	actRow.appendChild(rep); actRow.appendChild(sw);
	sec.appendChild(actRow);
	var lockNote = "";
	if (st.lockHeld) { lockNote += " · 手持已锁定（自动搬运整轮暂停）"; }
	if (st.lockFridge) { lockNote += " · 冰箱已锁定（跳过冰箱这站）"; }
	if (st.lockStored) { lockNote += " · 蒸馏笼已锁定（跳过笼这站）"; }
	sec.appendChild(el("div", "mce-hint",
		mbCELurkerPatchLabel(st) + "；累计捕获 " + (st.captured == null ? "—" : st.captured) + " 只；自动搬运累计 " + mbCELurkerMovedText() + " 只" + lockNote));
}
/* v2.0.0.005 清理：原 mbCELurkerAutoLabel() 删除（拆分期遗留死代码）——上方「自动搬运：开/关」
   按钮渲染一直用内联三元，该函数全仓零引用。 */
function mbCELurkerMovedText() {
	var V = mbCELurkerV();
	return (V && typeof V.mbCE_lurkerMoved === "number") ? V.mbCE_lurkerMoved : 0;
}
/* ============ v2.0.0.002 需求⑥：潜伏者捕捉上限 / 水烟馆冰箱上限 —— 文本解限引擎 ============
   原版硬约束（逐字取证自 DoL 0.5.12.13 的 Degrees of Lewdity.html）：
   A. 捕捉门控 5 处，同一形态：<<if $farm_stage gte 10 and $lurkers_held lt 1>> 包裹 "Hurl net"
      分布：Widgets Struggle（widget "struggle"，2 处）、Farm Yard（1）、Farm Tending Lurker Work（1）、
            Farm Tending Lurker Alex Fail（1）。手上已有 1 只就不再出网 → 这就是"上限 1"的真身。
   B. 冰箱上限 5 的真身两处（Widgets Flats 的 widget "hookah_juice"）：
      B1 <<if $lurkers_held gte 1 and $hookah.lurkers lt 5>> 包裹 "Store a lurker in the fridge"
      B2 <<switch $hookah.lurkers>> 只映射 5/4/3/2/1，<<default>> 输出 "no" → 写 >5 显示 "no lurker"
   C. 成功结算本身无上界：<<set $lurkers_held += 1>><<<set $stat_lurkers_captured += 1>>（Farm Yard
      Hurl net / Farm Tending Lurker Hurl net 两处）→ 去掉门控即可无限累积。
   D. 为何必须改文本而非改数值：门控写在 twee 里，靠"抓到即清零"只能绕成"手上永远 0 只"，
      不是"可持有无限只"。widget 定义在 SugarCube 启动时一次性注册，运行期再执行 <<widget>> 会报
      `cannot clobber existing definition "..."`（本版内核源码含此判定）→ 只能在 SugarCube.start
      之前改 DOM 里的 <tw-passagedata>。CE 走 scriptFileList_inject_early（脚本在 <head> 执行），
      body 尚未解析，因此注册捕获阶段的 DOMContentLoaded 先于正文末尾 SugarCube 的启动回调。
   兜底：DOM 未命中时改 Story.get(name).text（普通 passage 每次渲染重新 wikify，有效；widget 无效，
      此时 UI 会明示"仅普通剧情入口生效"，并由自动搬运保底"可以无限抓"）。

   【拼接顺序（v2.0.0.006 更名）】本片原名为 07f-lurker-patch.js：build_js.js 按文件名 sort 拼接，
   "-" 的排序码 0x2D 小于 "." 的 0x2E，旧名会让"补丁片"排在 07f-lurker.js（本体片）之前 —— 反直觉。
   现更名 07f-lurker0-patch.js（"0" = 0x30 大于 "." = 0x2E），实际顺序变为 07f-lurker.js → 本片，
   即"本体在前、补丁在后"。原先「本片不得在模块顶层读写 07f-lurker.js 的模块级 var」这条约束
   （MB_CE_LURKER_MAX / MB_CE_LURKER_FRIDGE_MAX / mbCELurkerTimer 等）随顺序调整自然解除：
   本片执行时本体片的模块级 var 已赋值。双向依赖（本体调本片的 mbCELurkerPatchReport /
   mbCELurkerRepatch）仍靠函数声明提升到整个产物顶部，且调用点带 typeof 守卫，安全。 */
var MB_CE_LURKER_PATCHES = [
	{ name: "Farm Yard", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Farm Tending Lurker Work", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Farm Tending Lurker Alex Fail", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Widgets Struggle", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Widgets Flats", find: "$lurkers_held gte 1 and $hookah.lurkers lt 5", repl: "$lurkers_held gte 1" },
	{ name: "Widgets Flats", find: "<<switch $hookah.lurkers>>", repl: "", regex: true }
];
/* v2.0.4 修复「潜伏者遭遇整段变英文」：门控替换必须长度守恒。
   汉化包（ModI18N）的译文条目带 pos 偏移锚点，逐条按 <from, pos> 在 passage 原文里定位；
   任何一条定位失败 → 整段 passage 放弃翻译、直接回显英文原文。CE 原先把门控串删短
   （-41/-25 字符），后续条目 pos 全下移 → 第一处不匹配即 anchor-error → 5 个 passage 全段落译。
   办法：把 repl 右补空格补到与 find 等长（<<if>> 表达式里尾随空格无副作用），偏移原地不动。 */
function mbCELurkerPadTo(find, repl) {
	var n = String(find).length - String(repl).length, pad = "";
	if (n <= 0) { return String(repl); }
	while (n-- > 0) { pad += " "; }
	return String(repl) + pad;
}
/* 汉化层在场时：switch 整块替换 = 物理删掉 6 条 span 译文锚点（补空格也救不回），必须原样保留。
   window.modI18N 由汉化包 earlyload（ModLoader 注入 <head>）挂载，早于 DOMContentLoaded，此处可判。 */
function mbCELurkerCjkI18n() {
	try {
		if (window.modI18N) { return true; }
		var d = window.modSC2DataManager;
		if (d && typeof d.getLanguageManager === "function") {
			var lm = d.getLanguageManager();
			if (lm && (lm.mainLanguage === "zh" || lm.language === "zh")) { return true; }
		}
	} catch (e) { /* 无 ModLoader / 无汉化 */ }
	return false;
}
/* 冰箱显示：把只映射 1–5 的 switch 段整体换成真实数值（>5 不再落到 <<default>> 显示 "no"） */
var MB_CE_LURKER_SWITCH_RE = /<<switch \$hookah\.lurkers>>[\s\S]*?<<\/switch>>/;
var MB_CE_LURKER_SWITCH_TO = '<<= $hookah.lurkers gt 0 ? $hookah.lurkers : "no">>';
/* 纯函数：对单个 passage 文本做全套替换，返回 { text, hits, kept, skipped }（幂等：已替换的文本再跑 hits=0）
   kept = 长度守恒替换处数；skipped = 因汉化在场而主动放弃的整块替换数（switch） */
function mbCELurkerPatchText(name, text) {
	var out = String(text == null ? "" : text), hits = 0, kept = 0, skipped = 0, i, p;
	for (i = 0; i < MB_CE_LURKER_PATCHES.length; i++) {
		p = MB_CE_LURKER_PATCHES[i];
		if (p.name !== name) { continue; }
		if (p.regex) {
			if (MB_CE_LURKER_SWITCH_RE.test(out)) {
				/* 汉化在场：整块替换会删掉 span 译文锚点 → 放弃（>5 只显示原版 "no"，数量见面板） */
				if (mbCELurkerCjkI18n()) { skipped++; continue; }
				out = out.replace(MB_CE_LURKER_SWITCH_RE, MB_CE_LURKER_SWITCH_TO);
				hits++;
			}
			continue;
		}
		if (out.indexOf(p.find) >= 0) {
			out = out.split(p.find).join(mbCELurkerPadTo(p.find, p.repl));
			hits++;
			kept++;
		}
	}
	return { text: out, hits: hits, kept: kept, skipped: skipped };
}
function mbCELurkerPatchNames() {
	var names = [], i;
	for (i = 0; i < MB_CE_LURKER_PATCHES.length; i++) {
		if (names.indexOf(MB_CE_LURKER_PATCHES[i].name) < 0) { names.push(MB_CE_LURKER_PATCHES[i].name); }
	}
	return names;
}
/* ① 启动前改 DOM（唯一能改到 widget 定义的通道） */
function mbCELurkerPatchDom() {
	/** @type {any} */
	var report = { ok: false, hits: 0, kept: 0, skipped: 0, nodes: 0, missed: mbCELurkerPatchNames(), channel: "dom" };
	try {
		if (typeof document === "undefined" || !document.getElementsByTagName) { return report; }
		var nodes = document.getElementsByTagName("tw-passagedata");
		var names = mbCELurkerPatchNames(), done = {}, i, n;
		report.nodes = nodes.length;
		for (i = 0; i < nodes.length; i++) {
			n = nodes[i];
			var nm = n.getAttribute ? n.getAttribute("name") : "";
			if (!nm || names.indexOf(nm) < 0 || done[nm]) { continue; }
			var before = n.textContent || "";
			var res = mbCELurkerPatchText(nm, before);
			if (!res.hits && !res.skipped) { continue; }
			/* textContent 写回由浏览器重新转义，SugarCube 读到的就是替换后的源码 */
			if (res.hits) { n.textContent = res.text; }
			done[nm] = true;
			report.hits += res.hits;
			report.kept += res.kept;
			report.skipped += res.skipped;
		}
		report.missed = names.filter(function (x) { return !done[x]; });
		report.ok = report.hits > 0;
	} catch (e) { report.error = String(mbCEErr(e)); }
	window.mbCELurkerPatchReport = report;
	return report;
}
/* 运行期 passage 文本入口：moli 实测（DoL 0.5.12.13 内嵌 ModLoader）页面全局既无 Story 也无 Macro，
   SugarCube 未把 State/Story 挂到 window → 优先 Story，其次 SugarCube.State.passages，都没有则返回 null。 */
function mbCELurkerPassageAccess() {
	try {
		if (typeof Story !== "undefined" && Story && typeof Story.get === "function") {
			return { get: function (n) { return Story.get(n); }, channel: "Story" };
		}
	} catch (e) { /* 落到下一条 */ }
	try {
		var P = window.SugarCube && window.SugarCube.State && window.SugarCube.State.passages;
		if (P && typeof P === "object") {
			return { get: function (n) { return P[n] || null; }, channel: "SugarCube.State.passages" };
		}
	} catch (e) { /* 无通道 */ }
	return null;
}
/* ② 运行期兜底：改 passage 文本（普通 passage 每次渲染重新 wikify 有效；已注册的 widget 定义无效） */
function mbCELurkerPatchStory() {
	/** @type {any} */
	var report = { ok: false, hits: 0, kept: 0, skipped: 0, missed: mbCELurkerPatchNames(), channel: "story", access: null };
	try {
		var access = mbCELurkerPassageAccess();
		if (!access) { report.access = "none"; return report; }
		report.access = access.channel;
		var names = mbCELurkerPatchNames(), done = {}, i;
		for (i = 0; i < names.length; i++) {
			var p = null;
			try { p = access.get(names[i]); } catch (e) { p = null; }
			if (!p || typeof p.text !== "string") { continue; }
			var res = mbCELurkerPatchText(names[i], p.text);
			if (!res.hits) { done[names[i]] = true; continue; }
			p.text = res.text;
			done[names[i]] = true;
			report.hits += res.hits;
			report.kept += res.kept;
			report.skipped += res.skipped;
		}
		report.missed = names.filter(function (x) { return !done[x]; });
		report.ok = report.hits > 0;
	} catch (e) { report.error = String(mbCEErr(e)); }
	var prev = window.mbCELurkerPatchReport;
	window.mbCELurkerPatchReport = {
		ok: report.ok || !!(prev && prev.ok),
		hits: (prev && prev.hits ? prev.hits : 0) + report.hits,
		kept: (prev && prev.kept ? prev.kept : 0) + report.kept,
		skipped: (prev && prev.skipped ? prev.skipped : 0) + report.skipped,
		dom: prev && prev.channel === "dom" ? prev : null,
		story: report,
		channel: prev && prev.ok ? "dom" : report.channel,
		missed: report.missed
	};
	return report;
}
/* ③ 安装：CE 在 <head> 执行时 body 未解析 → 用捕获阶段 DOMContentLoaded 抢在 SugarCube.start 之前 */
function mbCELurkerInstallEarly() {
	try {
		if (typeof document === "undefined") { return; }
		var fire = function () {
			mbCELurkerPatchDom();
			/* 同一事件里再补一次 Story 兜底（此时 Story 可能尚未构建，失败也无害） */
			mbCELurkerPatchStory();
		};
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", fire, true);
		} else {
			fire();
		}
	} catch (e) { /* 无 DOM 环境（Node 测试）时静默 */ }
}
function mbCELurkerPatchReport() {
	return window.mbCELurkerPatchReport || null;
}
/* 面板/命令：手动重新尝试补丁（自动搬运之外的第二道保险） */
function mbCELurkerRepatch() {
	var dom = mbCELurkerPatchDom();
	var story = mbCELurkerPatchStory();
	var r = mbCELurkerPatchReport();
	return {
		ok: !!(r && r.ok),
		message: r && r.ok
			? "解限补丁已生效（累计替换 " + r.hits + " 处，其中长度守恒 " + (r.kept || 0) + " 处" +
				(r.skipped ? "；汉化在场保留 switch " + r.skipped + " 处（>5 只原版文案显示 no，真实数量见上方数值）" : "") +
				"；未命中：" + ((r.missed && r.missed.length) ? r.missed.join(" / ") : "无") + "）"
			: "解限补丁未命中（可能页面已启动或版本差异）——自动搬运仍可保底「无限次捕捉」；详情：" + JSON.stringify({ dom: dom.hits, story: story.hits })
	};
}
mbCELurkerInstallEarly();
	/* ============ 锚定触发（v1.9.23）：把某个剧情锚定到其发生地点，走到该地点交互时
	     弹确认条（含地点/时间/前置说明），确认后复用原版 $replayScene 重放通道播放
	     （startPassage/passages 内段落正常播放，离开场景自动回原位）；播放完标
	     「已完成 ✓」并移出队列，可再自由锚定。旧「固定触发（任意推进即触发）」已移除。
	     存储于 V.mbCE_queue（存档持久）+ V.mbCE_completedScenes（已完成记录）；
	     重放期间原版自动禁存 + 冻结属性，零副作用。 ============ */
	/* 锚定触发队列（v1.9.23）：V.mbCE_queue 数组按锚定顺序存储。队首未 used 项若带
	     地点元数据（anchor.location）→ 走到该地点时（:passageend 判定 V.location）弹
	     确认条，确认后经原版 $replayScene 重放；「暂不触发」保留待下次（60s 冷却防打扰）。
	     无地点元数据项（旧档迁移：v1.1 旧单固定 mbCE_pinned 自动并入队列视为已触发过、
	     v1.2-1.9.22 旧队列项）保持旧段落跳转语义直至触发完，不破坏存档。
	     重放结束（Scene Viewer End / 链回 / exitpassage 返回 / Farm Work / unfreeze 钩子）
	     时把该场景记入 V.mbCE_completedScenes（「已完成 ✓」）并移出队列。
	     场景联动解锁（unlockPlaceForScene / applyWorldUnlockForScene）保留。 */
	/* ============ 场景地点元数据（v1.9.23 第一批，全部实证） ============
	   来源分级：
	     [reg]  = 本体 $scenes 注册表 manualVariableChanges 内 <<set $location to '...'>>（extract_scene_locs.js 实证）
	     [reg-w]= 本体注册表 manualVariableChanges 内 <<location '...'>> widget（同上）
	     [pas]  = 本体剧情段落实证（入口段落开头 <<set $location>> / <<location>> / 段落文本）
	     [同区] = 同一条线相邻段落实证（如罗宾地下系列）
	     [名]   = 场景名/入口段落名语义（值域与相邻段落佐证）
	   timeNote 仅展示、不参与触发判定；无 timeNote 时确认条省略时间说明。 */
var SCENE_LOCATIONS = {
		/* 罗宾 */
		"RobinIntro1": { loc: "home", src: "pas: Orphanage 段落实证 $location=home" },
		"RobinIntro2": { loc: "shopping_centre", src: "名: startPassage=Shopping Centre（值域实证）" },
		"RobinIntro3": { loc: "school", src: "pas: Canteen 段落实证 $location=school" },
		"RobinCrossdressing1": { loc: "home", src: "pas: Robin Caught CD SV Start $location=home" },
		"RobinCrossdressing2": { loc: "home", time: "16:00", src: "pas: Robin CD Door SV Start $location=home + Time.setTime(16)" },
		"RobinCrossdressing3": { loc: "home", src: "pas: Robin CD Socialise SV Start $location=home" },
		"RobinCrossdressing6": { loc: "school", time: "12:00", src: "pas: Canteen Lunch Robin CD 1 $location=school + setTime(12,0)" },
		"RobinCrossdressing6I": { loc: "school", time: "12:00", src: "pas: School Infirmary Robin CD Intro $location=school + setTime(12,0)" },
		"RobinDocks": { loc: "docks", src: "pas: Docks_Robin 段落实证 $location=docks" },
		"RobinLandfill": { loc: "landfill", src: "pas: Robin Mist Intro 段落实证 $location=landfill" },
		"RobinPilloryIntro": { loc: "home", src: "pas: Robin Pillory Intro 段落实证 $location=home" },
		"RobinPillory": { loc: "town", src: "pas: Robin Pillory Watch 段落实证 $location=town" },
		"RobinUndergroundDice": { loc: "underground", src: "同区: Underground Robin 系列（Stage Intro 段落实证 $location=underground）" },
		"RobinUndergroundMachine": { loc: "underground", src: "同区: 同上" },
		"RobinUndergroundKiss": { loc: "underground", src: "同区: 同上" },
		"RobinUndergroundStage": { loc: "underground", src: "pas: Underground Robin Stage Intro $location=underground" },
		"RobinUndergroundHunt": { loc: "forest", src: "pas: Underground Robin Hunt Intro <<location 'forest'>>" },
		"RobinUndergroundEscape": { loc: "forest", src: "名: undergroundEscapeForestRobin widget 名实证" },
		"RentFirstRobinFight": { loc: "orphanage", src: "pas: Rent First Robin SV 段落文本 'main hall of the orphanage'" },
		/* 惠特尼 */
		"WhitneySchoolBully1": { loc: "school", src: "名: 校园欺凌剧情（schoolbully widget；school 值域实证）" },
		"WhitneySchoolBully2": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBully3": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBully4": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullyChastity": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullyPanty": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullySkirt": { loc: "school", src: "名: 同上" },
		"WhitneySchoolBullySwimwear": { loc: "school", src: "名: 同上" },
		"WhitneyOrphanageLoft": { loc: "orphanage", src: "名: 孤儿院阁楼场景（Bird Loft 1 段落实证 $location=orphanage）" },
		"WhitneyOrphanageVisit": { loc: "orphanage", src: "名: SV Street Bully Orphanage Go（孤儿院）" },
		"WhitneyShoppingCentreClothes": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		"WhitneyShoppingCentreCosmetics": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		"WhitneyShoppingCentreHairDressers": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		/* 艾弗里 */
		"AveryHelicopter": { loc: "town", src: "reg: manualVariableChanges $location=town" },
		"AveryParkIntroduction": { loc: "park", src: "pas: Park Lichen 段落实证 $location=park" },
		/* 凯拉尔 */
		"KylarAbduction": { loc: "kylarmanor", src: "pas: Kylar Abduction Intro <<location 'kylarmanor'>>" },
		"KylarBasement": { loc: "school", src: "pas: Kylar Basement 段落实证 $location=school" },
		"KylarManorSecret": { loc: "kylarmanor", src: "reg-w: manualVariableChanges <<location 'kylarmanor'>>" },
		"KylarManorSleep": { loc: "kylarmanor", src: "reg-w: manualVariableChanges <<location 'kylarmanor'>>" },
		"KylarMonstranceAsk": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"KylarMonstranceAccost": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		/* 神殿（悉尼） */
		"TempleConfessorIntro": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleVigil": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleSydneyCorrupt": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleSydneyPunish": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		"TempleSydneyPureRitual": { loc: "temple", src: "reg: manualVariableChanges $location=temple" },
		/* 艾利克斯农场 */
		"TheFarm": { loc: "farm", src: "名: 被卖至农场（farm 值域实证）" },
		"AlexFarmWorkStage03": { loc: "farm", src: "名: 农场工作剧情（sceneViewSwitch farmStage3；farm 值域实证）" },
		"AlexFarmWorkStage04": { loc: "farm", src: "名: 同上（farmStage4）" },
		"AlexFarmWorkStage05": { loc: "farm", src: "名: 同上（farmStage5）" },
		"AlexFarmWorkStage06": { loc: "farm", src: "名: 同上（farmStage6）" },
		"AlexFarmWorkStage07": { loc: "farm", src: "名: 同上（farmStage7）" },
		"AlexFarmWorkStage08": { loc: "farm", src: "名: 同上（farmStage8）" },
		"AlexFarmWorkStage09": { loc: "farm", src: "名: 同上（farmStage9）" },
		"AlexFarmWorkStage10": { loc: "farm", src: "名: 同上（farmStage10）" },
		"AlexFarmWorkStage11": { loc: "farm", src: "名: 同上（farmStage11）" },
		"AlexFarmWorkStage12": { loc: "farm", src: "名: 同上（farmStage12）" },
		/* 其他注册表实证 */
		"AdultShopIntro": { loc: "dilapidated_shop", src: "reg: manualVariableChanges $location" },
		"AdultShopOpening": { loc: "adult_shop", src: "reg: manualVariableChanges $location" },
		"EdenIntro": { loc: "forest", src: "reg: manualVariableChanges $location" },
		"BlackWolfIntro": { loc: "forest", src: "reg: manualVariableChanges $location" },
		"FreeTheBlackDog": { loc: "town", src: "reg: manualVariableChanges $location" },
		"IslandCastle": { loc: "island", src: "reg: manualVariableChanges $location" },
		"MoorFlower": { loc: "moor", src: "reg: manualVariableChanges $location" },
		"HookahPlot1": { loc: "tentworld", src: "reg: manualVariableChanges $location" },
		"HookahPlot2": { loc: "town", src: "reg: manualVariableChanges $location" },
		"Schism": { loc: "lake_ruin", src: "reg: manualVariableChanges $location" },
		"MickeyOrphanageHacker": { loc: "home", src: "reg: manualVariableChanges $location" },
		"MickeyPubFameIntro": { loc: "pub", src: "reg: manualVariableChanges $location" },
		"PrisonSpirePrecipice": { loc: "prison", src: "reg: manualVariableChanges $location" },
		"PrisonYardLocket": { loc: "prison", src: "reg: manualVariableChanges $location" },
		"PrisonScarredInmate": { loc: "prison", src: "reg: manualVariableChanges $location" }
	};
	/* 跨线前置映射（v1.9.23 第一批）：剧情有关联性时的显式前置。
	   线内前置（数字后缀聚线）由 pendingPreconds 自动推导、零维护；
	   此处只放跨线剧情顺序明确的保守映射。前置缺失不禁止锚定，仅提示。 */
	var SCENE_PRECONDITIONS = {
		"RobinCrossdressing1": ["RobinIntro1"],
		"RobinCrossdressing2": ["RobinIntro1"],
		"RobinCrossdressing3": ["RobinIntro1"],
		"RobinCrossdressing6": ["RobinIntro1"],
		"RobinCrossdressing6I": ["RobinIntro1"],
		"RobinDocks": ["RobinIntro1"],
		"RobinLandfill": ["RobinIntro1"],
		"RentFirstRobinFight": ["RobinIntro1"],
		"RobinUndergroundDice": ["RobinDocks"],
		"RobinUndergroundMachine": ["RobinDocks"],
		"RobinUndergroundKiss": ["RobinDocks"],
		"RobinUndergroundStage": ["RobinDocks"],
		"RobinUndergroundHunt": ["RobinDocks"],
		"RobinUndergroundEscape": ["RobinDocks"],
		"WhitneyShoppingCentreClothes": ["WhitneySchoolBully1"],
		"WhitneyShoppingCentreCosmetics": ["WhitneySchoolBully1"],
		"WhitneyShoppingCentreHairDressers": ["WhitneySchoolBully1"],
		"WhitneyOrphanageLoft": ["WhitneySchoolBully1"],
		"WhitneyOrphanageVisit": ["WhitneySchoolBully1"],
		"AveryHelicopter": ["AveryParkIntroduction"],
		"KylarManorSecret": ["KylarAbduction"],
		"KylarManorSleep": ["KylarAbduction"],
		"KylarMonstranceAsk": ["KylarAbduction"],
		"KylarMonstranceAccost": ["KylarAbduction"]
	};
	/* 地点值域 → 中文显示名（锚定提示/确认条用；未知值原样显示） */
	var LOCATION_LABELS = {
		"home": "孤儿院（家）", "orphanage": "孤儿院（阁楼/公共区）", "school": "学校", "school_rear_courtyard": "学校后院",
		"town": "城镇（街道）", "docks": "码头", "landfill": "垃圾场", "park": "公园", "forest": "森林", "forest_shop": "森林商店",
		"temple": "神殿", "old_temple": "旧神殿", "kylarmanor": "凯拉尔庄园", "avery_mansion": "艾弗里庄园", "avery_skyscraper": "艾弗里大厦",
		"farm": "艾利克斯农场", "alex_cottage": "艾利克斯小屋", "alex_farm": "农场", "farm_manors": "农庄",
		"underground": "地下（罗宾地下）", "brothel": "妓院", "island": "岛", "lake": "湖", "lake_ruin": "湖畔遗迹",
		"moor": "荒野", "tentworld": "帐篷世界", "pub": "酒吧", "prison": "监狱", "shopping_centre": "购物中心",
		"adult_shop": "成人商店", "dilapidated_shop": "破旧商店", "beach": "海滩", "sewers": "下水道", "police_station": "警察局",
		"hospital": "医院", "hotel": "旅馆", "cafe": "咖啡馆", "office": "办公室", "industrial": "工业区", "alley": "小巷",
		"arcade": "游戏厅", "asylum": "疯人院", "bog": "沼泽", "cabin": "小屋", "castle": "城堡", "chalets": "小屋群",
		"compound": "大院", "dance_studio": "舞蹈室", "drain": "排水沟", "estate": "庄园", "factory": "工厂", "flats": "公寓",
		"market": "市场", "meadow": "草地", "mer_pier": "美人鱼码头", "museum": "博物馆", "night_monster_lair": "夜魔巢穴",
		"oak": "橡树", "pirate_ship": "海盗船", "pool": "泳池", "promenade": "海滨大道", "riding_school": "马术学校",
		"sea": "海", "spa": "水疗馆", "strip_club": "脱衣舞俱乐部", "studio": "工作室", "tower": "塔", "wolf_cave": "狼穴",
		"banner": "旗地", "blitz": "闪电区"
	};
/* 职责：锚定触发元数据 —— 地点标签（locLabel）、场景锚定信息、前置达成判定、确认条状态（anchorPromptActive） */
	function locLabel(loc) { return LOCATION_LABELS[loc] || loc || "（未标注）"; }
	/* 场景 key → 锚定元数据（表内命中；旧队列项无元数据 → null，保持旧段落跳转语义） */
	function sceneAnchorMeta(key, def) {
		try {
			var s = SCENE_LOCATIONS[key];
			if (!s && /^AlexFarmWorkStage\d+$/.test(key || "")) {
				/* 兼容一位/两位数字位宽：真实注册表 key 为两位（03..12），部分来源为一位 */
				var nn = (/^AlexFarmWorkStage(\d+)$/.exec(key) || [])[1];
				s = SCENE_LOCATIONS["AlexFarmWorkStage" + (nn.length === 1 ? "0" + nn : nn)];
			}
			if (s) { return { location: s.loc, timeNote: s.time || "" }; }
			/* v1.9.26：静态表未命中时，从 manualVariableChanges 提取 $location
			   （大量场景 mvc 含 <<set $location to '...'>> / <<location '...'>>，覆盖静态表未收录的场景，
			   免手工实证补全；def 由调用方传入免调 getScenesDefs 重解析，def 缺失才 fallback getScenesDefs；
			   timeNote 仅静态表有，mvc 来源无时间提示） */
			var mvc = def && def.manualVariableChanges;
			if (!mvc) {
				var defs = getScenesDefs();
				var d2 = defs && defs.defs && defs.defs[key];
				mvc = d2 && d2.manualVariableChanges;
			}
			if (mvc) {
				var lm = mvc.match(/\$location\s+to\s+['"]([^'"]+)['"]/) || mvc.match(/<<\s*location\s+['"]([^'"]+)['"]/);
				if (lm && lm[1]) { return { location: lm[1], timeNote: "" }; }
			}
		} catch (e) {}
		return null;
	}
	/* 前置是否已完成：scenePassages 达成（绿标）或锚定播放完成（mbCE_completedScenes）任一即算 */
	function precondDone(key) {
		try {
			var defs = getScenesDefs();
			var def = defs.defs[key];
			if (def && sceneStatus(def).state === "pass") { return true; }
		} catch (e) {}
		try {
			var V = getV();
			if (V && V.mbCE_completedScenes && V.mbCE_completedScenes[key]) { return true; }
		} catch (e) {}
		return false;
	}
	/* 锚定某场景的未完成前置列表（显示名）：跨线显式映射 + 线内数字后缀自动推导 */
	function pendingPreconds(key) {
		var names = [];
		try {
			var defs = getScenesDefs();
			var nm = function (k2) { var d = defs.defs[k2]; return (d && d.name) || k2; };
			var pre = SCENE_PRECONDITIONS[key];
			if (Array.isArray(pre)) {
				for (var i = 0; i < pre.length; i++) {
					var k3 = pre[i];
					if (!precondDone(k3)) { names.push(nm(k3)); }
				}
			}
			/* 线内前置：同前缀、数字更小的未完成阶段（数字后缀聚线自动推导，零维护） */
			var m = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/.exec(key);
			if (m) {
				var prefix = m[1], num = parseInt(m[2], 10), suffix = m[3];
				Object.keys(defs.defs).forEach(function (k4) {
					var m4 = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/.exec(k4);
					if (m4 && m4[1] === prefix && m4[3] === suffix && parseInt(m4[2], 10) < num && !precondDone(k4)) { names.push(nm(k4)); }
				});
			}
		} catch (e) {}
		var seen = {}, out = [];
		for (var j = 0; j < names.length; j++) {
			if (!seen[names[j]]) { seen[names[j]] = true; out.push(names[j]); }
		}
		return out;
	}
	/* ============ 锚定确认条与手动触发（v1.9.23） ============ */
	var mbCE_anchorPrompt = null;      /* 内存态：当前展示中的确认条 { key, t } */
	var mbCE_anchorCooldown = {};      /* key -> Date.now()：暂不触发后 60s 冷却，防同地点反复弹（v1.9.23-实机修复五轮 60s→1h；用户拍板 1h→60s） */
	var mbCE_anchorPromptEl = null;
	function anchorPromptActive(key) {
		if (mbCE_anchorPrompt && mbCE_anchorPrompt.key === key) { return true; }
		var cd = mbCE_anchorCooldown[key];
		if (cd && (Date.now() - cd) < 60000) { return true; } /* 60s 冷却（用户拍板 1h→60s） */
		return false;
	}
	/* 确认「立即触发」：与原固定触发的重放启动通道一致（manualVariableChanges → freeze → replayScene → 跳转入口） */
	function startAnchoredReplay(P) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档不可用，无法触发" }; }
			if (!P || !P.startPassage) { return { ok: false, message: "缺少入口段落，无法触发" }; }
			/* v1.9.23-实机修复：SV 注册场景（startPassage 以 "SV " 开头的查看器预览页，如 "SV Adult Shop Opening"）
			   锚定触发不再播放预览页（角色卡+Start 的「剧情播放器」样式）→ 直接进入剧情第一段。
			   判据：预览页段落源码含 <<link [[Start|剧情入口>>（label 恰为 Start）；
			   SV 链形态（如 SV Temple Confess Purge → Start → SV Temple Confess Purge 2）递归跳过；
			   剧情本体类（如 SV Pub Fame Intro 含场景初始化、无 Start 链接）→ 保持原入口。 */
			var entry = P.startPassage;
			if (String(P.startPassage).indexOf("SV ") === 0) {
				var hop = P.startPassage;
				for (var depth = 0; depth < 10; depth++) {
					var svSrc = "";
					try {
						if (typeof Story !== "undefined" && Story) {
							if (typeof Story.get === "function") {
								var svTpl = Story.get(hop);
								if (svTpl && (svTpl.source || svTpl.text)) { svSrc = svTpl.source || svTpl.text; }
							}
							if (!svSrc && typeof Story.lookupWith === "function") {
								var svHits = Story.lookupWith(function (p) { return p && p.name === hop; });
								if (svHits && svHits.length && (svHits[0].source || svHits[0].text)) {
									svSrc = svHits[0].source || svHits[0].text;
								}
							}
						}
					} catch (e) {}
					var svM = /\[\[Start\|([^\]|]+)/.exec(svSrc);
					if (!svM || !svM[1]) { entry = hop; break; }   /* 无 Start 链接：当前段即入口（保留其初始化） */
					var svNext = String(svM[1]).trim();
					if (svNext.indexOf("SV ") === 0) { hop = svNext; continue; }  /* SV 预览链 → 递归下一跳 */
					entry = svNext; break;  /* 直达剧情入口 */
				}
			}
			/* v1.9.23-自检：防重入——重放进行中（确认条双击/重复调用）再次触发会覆盖 exitpassage
			   为播放器段落导致返回错位甚至被困播放器 → 拒绝并提示等待 */
			if (V.replayScene) { return { ok: false, message: "已有重放在进行中（" + ((V.replayScene.name) || "") + "），请先等播放完成" }; }
			if (isFarmDependentScene(P) && !farmStateReady()) {
				return { ok: false, message: "「" + P.name + "」依赖农场系统状态（$farm 未初始化）：请先推进到艾利克斯农场线后再触发" };
			}
			ensureAveryMansion();
			ensureFarmState();
			/* v2.0.1：剧情触发（SV 预览链已解析为真实入口）同样兜底监狱/农场原版状态，
			   避免新档触达 Prison* / Farm* 剧情段时深链读 $prison.* / $farm.* 抛 TypeError */
			ensureSceneStateFor(String(entry));
			if (Array.isArray(P.passages)) { for (var pz = 0; pz < P.passages.length; pz++) { ensureSceneStateFor(String(P.passages[pz])); } }
			var ep = getEnginePlayFn();
			if (!ep) { return { ok: false, message: "游戏引擎不可用，无法触发（请刷新页面重试）" }; }
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			/* v1.9.23-实机修复六轮：P.used=true 必须在本重放 freezePlayerStats 之前写入——
			   原版 freezePlayerStats widget 深拷贝整个 State.variables 冻结快照（mbCE_queue 不在其
			   skipKeysOnFreeze 排除表，used:false 被冻结），播完原版 unfreezePlayerStats 用 strict-replace
			   恢复快照会把 used 还原为 false（队列项复活 → 确认条循环弹；实机 F12 铁证：live=true / frozen=false）。
			   先置 used=true 使冻结快照含 true，恢复后保持 true，配合 mbCEOnPassageEnd 残留清理闭环。 */
			P.used = true;
			/* v1.9.30-实机修复：直达触发（P.direct）不冻结数值——直达语义 = 剧情真实生效
			   （剧情 effects 产生的数值变化播放后保留，"走完正常发展"），冻结仅用于锚定/固定触发的
			   纯观看重放（unfreeze 用冻结快照 strict-replace 恢复，会把剧情效果一并抹掉）。 */
			if (!P.direct) {
				try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			}
			V.replayScene = {
				name: P.name,
				startPassage: entry,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName(),
				mbCE_direct: !!P.direct
			};
			V.mbCE_replayOnce = true;  /* 本重放由锚定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			V.mbCE_replayPending = (entry === "Scene Viewer passages");
			unlockPlaceForScene(P);  /* 联动解锁：触发即解锁所在场景组 */
			applyWorldUnlockForScene(P);
			hideAnchorPrompt();
			try { ep.play.call(ep.e, entry, true); } catch (e) {
				/* 跳转失败：回滚 used（保留队列项）+ 清重放状态，避免卡死 */
				try { P.used = false; } catch (e2) {}
				mbCEClearReplay(true);
				return { ok: false, message: "跳转失败：" + mbCEErr(e) };
			}
			return { ok: true, message: "已开始触发「" + P.name + "」" };
		} catch (e) { return { ok: false, message: "触发失败：" + mbCEErr(e) }; }
	}
	/* v1.9.30 剧情直达触发：从场景 def 构造临时 P 并直接开始锚定重放。
	   与「锚定」的区别：跳过地点判定/确认条/队列——点即触发；不写 mbCE_queue，
	   不干扰锚定状态机（cleanupUsedPins 只清队列 used 项，直达无队列项无操作）；
	   播完走 startAnchoredReplay 既有出口清理（回原位 + 记「已完成 ✓」），即"走完正常发展"。 */
	function directTriggerScene(key) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档不可用，无法直达" }; }
			if (V.replayScene) { return { ok: false, message: "已有剧情播放中，请先结束当前播放" }; }
			var gd = typeof getScenesDefs === "function" ? getScenesDefs() : null;
			var defs = gd && gd.defs ? gd.defs : gd; /* getScenesDefs 返回 {defs,live} 包装，兼容裸对象 */
			var def = defs && defs[key];
			if (!def) { return { ok: false, message: "未找到剧情「" + key + "」（未注册或未解析）" }; }
			if (!def.startPassage) { return { ok: false, message: "「" + (def.name || key) + "」无入口段落，无法直达" }; }
			var P = {
				key: key,
				name: def.name || key,
				startPassage: def.startPassage,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || null,
				direct: true /* v1.9.30-实机修复：直达 = 不冻结数值 + 不走白名单中断（onPassageOverride mbCE_direct 分支） */
			};
			var r = startAnchoredReplay(P);
			if (!r.ok) { return r; }
			return { ok: true, message: r.message, scene: P };
		} catch (e) { return { ok: false, message: "直达失败：" + mbCEErr(e) }; }
	}
	/* 挂载确认条（页面顶部，非阻断式） */
	function showAnchorPrompt(P, meta) {
		try {
			mbCE_anchorPrompt = { key: P.key, t: Date.now() };
			if (mbCE_anchorPromptEl && mbCE_anchorPromptEl.parentNode) { mbCE_anchorPromptEl.parentNode.removeChild(mbCE_anchorPromptEl); }
			var box = document.createElement("div");
			box.className = "mce-anchor-prompt";
			/* v1.9.29 确认条 token 化：样式全部移入 07a-shell CSS 类（此前内联 #f5f0e0 米色/绿/灰，与面板黑金脱节；
			   现走 --mce-gold-* token，换主题自动跟随） */
			if (getTheme() === "starry") { box.classList.add("mce-theme-starry"); }
			var txt = document.createElement("span");
			var timeTxt = meta.timeNote ? "｜时间 " + meta.timeNote : "";
			var pre = pendingPreconds(P.key);
			/* v1.9.23-自查优化：无前置要求时不再显示「前置均已达成」——该文案与面板完成状态
			   「要求：未达成（条件未满足）」同屏自相矛盾（触发前置 ≠ 完成条件，13_17 截图实证）；
			   改为「触发前置：无」，明确这是触发条件而非完成状态。 */
			var preTxt = pre.length ? "｜触发前置未完成：" + pre.join("、") : "｜触发前置：无";
			txt.textContent = "检测到锚定剧情「" + P.name + "」：触发地点「" + locLabel(meta.location) + "」" + timeTxt + preTxt + "，是否立即触发？";
			box.appendChild(txt);
			var go = document.createElement("button");
			go.type = "button";
			go.textContent = "立即触发★";
			go.className = "mce-anchor-go";
			go.addEventListener("click", function () {
				var r = startAnchoredReplay(P);
				if (!r.ok) { setStatus(r.message, "mce-err"); }
				hideAnchorPrompt();
			});
			var skip = document.createElement("button");
			skip.type = "button";
			skip.textContent = "暂不触发";
			skip.addEventListener("click", function () {
				mbCE_anchorCooldown[P.key] = Date.now(); /* 60s 冷却：同地点不再反复弹，保留队列待下次（用户拍板 1h→60s） */
				hideAnchorPrompt();
			});
			box.appendChild(go);
			box.appendChild(skip);
			var host = document.getElementById("story") || document.body;
			host.insertBefore(box, host.firstChild);
			mbCE_anchorPromptEl = box;
		} catch (e) {}
	}
	function hideAnchorPrompt() {
		try {
			mbCE_anchorPrompt = null;
			if (mbCE_anchorPromptEl) {
				if (mbCE_anchorPromptEl.parentNode) { mbCE_anchorPromptEl.parentNode.removeChild(mbCE_anchorPromptEl); }
				mbCE_anchorPromptEl = null;
			}
		} catch (e) {}
	}
	/* :passageend 钩子：锚定触发判定——段落渲染完成后 V.location 已更新为当前段落地点，
	   队首未用未完成项带地点元数据且与当前地点匹配 → 弹确认条（确认触发 / 暂不待下次）。
	   重放中（V.replayScene）不弹；旧档无元数据项不走此通道（passageoverride 旧语义）。 */
	function mbCEOnPassageEnd() {
		try {
			var V = getV();
			if (!V) { return; }
			if (V.replayScene) { return; }
			/* v1.9.23-实机修复六轮：段落后清理残留 used 项——原版 unfreezePlayerStats strict-replace 恢复
			   冻结快照会把已移除/已标记的队列项复活（used 被还原 → 确认条循环弹）。此处幂等清理：
			   已触发（used）项写「已完成 ✓」并移出队列，复活项在下一段落被清，确认条不再循环弹。 */
			cleanupUsedPins();
			var q = getPinQueue();
			if (!q) { return; }
			/* v1.9.23-实机修复五轮：残留确认条清理——弹条后未点按钮直接离开触发地点（如酒吧→麋鹿街），
			   fixed 条会跨段残留（玩家反馈「取消锚定之后立即触发并没有消失」的画面证据：麋鹿街挂着酒吧条）。
			   当前展示条对应地点已非当前段落 → 自动收起。 */
			if (mbCE_anchorPrompt && mbCE_anchorPrompt.key) {
				var pk = mbCE_anchorPrompt.key;
				var curMeta = null;
				for (var k = 0; k < q.length; k++) {
					if (q[k] && q[k].key === pk) { curMeta = q[k].anchor || sceneAnchorMeta(q[k].key); break; }
				}
				if (curMeta && curMeta.location && (typeof V.location !== "string" || V.location !== curMeta.location)) {
					hideAnchorPrompt();
				}
			}
			/* 遍历队列找「当前地点匹配」的锚定项。旧实现只取队首、location 不匹配即 return，
			   队首「米奇酒吧知名度初见」（酒吧）在玩家到其他地点时拦截了后续所有锚定
			   （玩家反馈「暂不触发之后再去选其他锚定，其他锚定的立即触发也不会出现」根因）。 */
			var P = null;
			for (var i = 0; i < q.length; i++) {
				var it = q[i];
				if (it && it.active !== false && !it.used && it.startPassage) {
					var m = it.anchor || sceneAnchorMeta(it.key);
					if (m && m.location) {
						if (typeof V.location === "string" && V.location === m.location) {
							/* v1.9.23-自查优化：原实现 break 后在下方 anchorPromptActive(P.key) return——
							   同地点多锚定时，A 暂不触发（1h 冷却）或正展示中 → B（同地点）被拦截永不弹
							   （「暂不触发后其他锚定不弹」的同地点残余路径）。改为冷却/展示中的项 continue
							   继续找下一个同地点匹配项，全部不可用才不弹。 */
							if (anchorPromptActive(it.key)) { continue; }
							P = it; break;
						}
					}
					/* 无元数据旧档项：保留旧 passageoverride 语义，不在此通道处理 */
				}
			}
			if (!P) { return; }
			var meta = P.anchor || sceneAnchorMeta(P.key);
			if (!meta || !meta.location) { return; } /* 旧档无元数据项 → 保持旧段落跳转语义 */
			showAnchorPrompt(P, meta);
		} catch (e) {}
	}
	function hookPassageEnd() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageend.mbceAnchor").on(":passageend.mbceAnchor", function () {
				try { mbCEOnPassageEnd(); } catch (e) {}
			});
		} catch (e) {}
	}
	function getPinQueue() {
		try {
			var V = getV();
			if (!V) { return null; }
			var q = V.mbCE_queue;
			if (!Array.isArray(q)) { q = []; V.mbCE_queue = q; }
			/* 旧版兼容迁移（幂等）：v1.1 单固定 mbCE_pinned → 并入队列并标记 used（已触发过，不再重复触发） */
			var old = V.mbCE_pinned;
			if (old && typeof old === "object" && old.active && old.startPassage) {
				var dup = false;
				for (var i = 0; i < q.length; i++) {
					if (q[i] && q[i].key === old.key) { dup = true; break; }
				}
				if (!dup) {
					q.push({ key: old.key, name: old.name, startPassage: old.startPassage, passages: Array.isArray(old.passages) ? old.passages.slice() : [], manualVariableChanges: old.manualVariableChanges || "", used: true });
				}
				try { delete V.mbCE_pinned; } catch (e) { V.mbCE_pinned = undefined; }
			}
			return q;
		} catch (e) { return null; }
	}
	/* 队列中未触发的固定项（UI 横幅/条目用） */
	function getPinnedScene() {
		try {
			var q = getPinQueue();
			if (!q) { return []; }
			return q.filter(function (p) { return p && p.active !== false && !p.used && p.startPassage; });
		} catch (e) { return []; }
	}
	/* 固定项在队列中的序号（0 起，未固定返回 -1） */
	function pinQueueIndex(key) {
		try {
			var q = getPinQueue();
			if (!q) { return -1; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === key && q[i].active !== false && !q[i].used) { return i; }
			}
		} catch (e) {}
		return -1;
	}
	/* 农场依赖剧情检测：startPassage=Scene Viewer passages 且 manualVariableChanges 执行 farm_work_update
	   （其内部 V.farm.clearing -= 1，$farm 未初始化时直接崩场景查看器 → "setting 'clearing'"） */
	function isFarmDependentScene(P) {
		if (!P || !P.startPassage || P.startPassage !== "Scene Viewer passages") { return false; }
		var mvc = P.manualVariableChanges || "";
		return /farm_work_update/i.test(mvc);
	}
	function farmStateReady() {
		try {
			var V = getV();
			if (!V) { return false; }
			return typeof V.farm === "object" && V.farm !== null;
		} catch (e) { return false; }
	}
	/* 艾弗里庄园状态兜底：$avery_mansion 由本体 avery_mansion_init 初始化，但该初始化被延迟到"进入艾弗里线"才触发；
	   新档/未开线时直达庄园段落或固定触发艾弗里剧情会因 $avery_mansion 缺失而崩
	   （reading 'schedule'/'jobs'/'party_state'/'folder'/'study_unlocked'/'landry' 等，均为 V.avery_mansion 子键；
	   reading 'stage' 来自 $avery_tower）。
	   此处按本体 init widget 的纯字面量结构建空壳（跳过服装/antiques 子 widget，避免副作用与依赖），
	   仅当对象缺失时写入，绝不覆盖已有进度。 */
	/* 农场状态兜底（v1.3.1）：本体社交页在 $farm_stage gte 2 时无条件读 $farm.beasts（马/猪/牛/狗敬重值）与 $farm.aggro，
	   若存档里 farm_stage 已推进但 $farm 整体缺失（早期版本触发农场剧情置高 farm_stage 但未走本体农场线初始化），
	   孤儿院/多瑙河街等含 <<social>> 的段落直接崩（reading 'beasts'/'aggro'）。
	   v1.3.4：睡眠/跨午夜结算（本体 dailyFarmEvents 与农场库存显示）读 $farm.stock.truffles/eggs/milk/cream，
	   该结构仅由本体 <<farm_stock_init>> 在"共享农场"剧情节点初始化——一键置高 farm_stage 后同样缺失 → 睡觉崩（reading 'truffles'），
	   故空壳与残缺分支同步补齐 stock 四字段。
	   按本体农场线初始化结构补空壳：仅当 farm_stage >= 1 且 $farm 缺失/结构残缺时补，绝不覆盖已有进度。 */
	function ensureFarmState(force) {
		try {
			var V = getV();
			if (!V) { return; }
			var fs = Number(V.farm_stage);
			if (!(fs >= 1) && !force) { return; } /* 农场线未推进且未强制 → 本体社交页有 $farm_stage gte 2 条件，不读 $farm */
			if (typeof V.farm !== "object" || V.farm === null) {
				V.farm = {
					beasts: { horses: 0, pigs: 0, cattle: 0, dogs: 0 },
					wage: 15,
					clearing: 100,
					milking: { caught: false, alexNightEvent: false, catchChance: 0, dayMilking: false },
					build_finished: [],
					stock: { truffles: 0, eggs: 0, milk: 0, cream: 0 }
				};
				return;
			}
			/* 已存在但结构残缺 → 只补缺失字段，不覆盖已有值 */
			if (typeof V.farm.beasts !== "object" || V.farm.beasts === null) { V.farm.beasts = {}; }
			var b = V.farm.beasts;
			if (typeof b.horses !== "number") { b.horses = 0; }
			if (typeof b.pigs !== "number") { b.pigs = 0; }
			if (typeof b.cattle !== "number") { b.cattle = 0; }
			if (typeof b.dogs !== "number") { b.dogs = 0; }
			if (typeof V.farm.wage !== "number") { V.farm.wage = 15; }
			if (typeof V.farm.clearing !== "number") { V.farm.clearing = 100; }
			if (typeof V.farm.milking !== "object" || V.farm.milking === null) { V.farm.milking = { caught: false, alexNightEvent: false, catchChance: 0, dayMilking: false }; }
			if (typeof V.farm.milking.catchChance !== "number" || V.farm.milking.catchChance !== V.farm.milking.catchChance) { V.farm.milking.catchChance = 0; }
			if (V.farm.build_finished === undefined || V.farm.build_finished === 0 || V.farm.build_finished === null) { V.farm.build_finished = []; }
			/* v1.3.4：farm_stock 结算防崩——本体只由 <<farm_stock_init>> 建 stock 四字段，缺失时读/累加即崩 */
			if (typeof V.farm.stock !== "object" || V.farm.stock === null) {
				V.farm.stock = { truffles: 0, eggs: 0, milk: 0, cream: 0 };
			}
			var st = V.farm.stock;
			if (typeof st.truffles !== "number") { st.truffles = 0; }
			if (typeof st.eggs !== "number") { st.eggs = 0; }
			if (typeof st.milk !== "number") { st.milk = 0; }
			if (typeof st.cream !== "number") { st.cream = 0; }
		} catch (e) {}
	}
	function ensureAveryMansion() {
		try {
			var V = getV();
			if (!V) { return; }
			if (typeof V.avery_mansion !== "object" || V.avery_mansion === null) {
				V.avery_mansion = {
					version: 5,
					pool: 0, kitchen: 0, lounge: 0, display: 0, bedroom: 0, bathroom: 0,
					dining: 0, garden: 0, study: 0, garage: 0,
					jobs: [],
					schedule: "home",
					state: "normal",
					days: 0, days_absent: 0, walk_cycle: 0, display_antiques: 0,
					food: "hamburger", food_last: "none", date_ready: false,
					rage: { work: false, apologetic: false, dinner_missed: 0, dinner_done: 0, dinner_wrong: false, assess: 0, timer: 0 },
					fox: { progress: 0, known: false },
					date_seen: false,
					party_state: "waiting",
					guest: "Bailey",
					landry: 0, vault_progress: 0,
					study_unlocked: 0, folder: 0, folder_gone: false,
					kitchen_made: 0, recipe: [],
					attend: {}
				};
			}
			if (typeof V.avery_tower !== "object" || V.avery_tower === null) {
				V.avery_tower = { progress: 0, effects: [], stage: 0, intro: 0 };
			}
			/* daily.avery 结构兜底（v1.3.3 → v1.5.1 强化）：本体 0.5.5.5 后 $daily.avery 由艾弗里线入口建为 {}，
			   talk/ask 子对象仅在 avery_mansion_init / 0.5.7.1 版本迁移时创建；直达、重放、固定触发或新档未开
			   艾弗里线时进入 Mansion 系段落（Mansion Talk 调 avery_daily_talk 读 $daily.avery.talk.chat、
			   正文读 .ignore/.limit）会因 $daily.avery.talk 缺失而崩（TypeError reading 'chat'/'ignore'）
			   → 逐层补齐 + 逐字段补齐，绝不覆盖已有值 */
			if (typeof V.daily !== "object" || V.daily === null) {
				/* 防御：$daily 缺失（理论上游戏启动即有）时建最小壳，避免后续读崩 */
				V.daily = {};
			}
			if (typeof V.daily.avery !== "object" || V.daily.avery === null) {
				V.daily.avery = {
					talk: { ignore: false, limit: false, flirt: false, seduce: false, annoyed: 0, chat: 0, chat_limit: 3 },
					ask: { science: false, maths: false, play: false },
					housekeeping_events: {}
				};
			} else {
				var dav = V.daily.avery;
				if (typeof dav.talk !== "object" || dav.talk === null) {
					dav.talk = { ignore: false, limit: false, flirt: false, seduce: false, annoyed: 0, chat: 0, chat_limit: 3 };
				} else {
					/* 对象已存在但个别字段缺失（旧档/异常路径）：逐字段补默认，绝不覆盖已有值 */
					if (typeof dav.talk.ignore !== "boolean") { dav.talk.ignore = false; }
					if (typeof dav.talk.limit !== "boolean") { dav.talk.limit = false; }
					if (typeof dav.talk.flirt !== "boolean") { dav.talk.flirt = false; }
					if (typeof dav.talk.seduce !== "boolean") { dav.talk.seduce = false; }
					if (typeof dav.talk.annoyed !== "number") { dav.talk.annoyed = 0; }
					if (typeof dav.talk.chat !== "number") { dav.talk.chat = 0; }
					if (typeof dav.talk.chat_limit !== "number") {
						var wd = 0;
						try {
							var t = (typeof Time !== "undefined" && Time && typeof Time.weekDay === "number") ? Time.weekDay : 0;
							wd = t;
						} catch (e2) {}
						dav.talk.chat_limit = (wd === 1 || wd === 7) ? 6 : 3;
					}
				}
				if (typeof dav.ask !== "object" || dav.ask === null) {
					dav.ask = { science: false, maths: false, play: false };
				} else {
					if (typeof dav.ask.science !== "boolean") { dav.ask.science = false; }
					if (typeof dav.ask.maths !== "boolean") { dav.ask.maths = false; }
					if (typeof dav.ask.play !== "boolean") { dav.ask.play = false; }
				}
				if (typeof dav.housekeeping_events !== "object" || dav.housekeeping_events === null) {
					dav.housekeeping_events = {};
				}
			}
		} catch (e) {}
	}
	function pinScene(it) {
		try {
			var def = it && it.def;
			if (!def) { return { ok: false, message: "无场景定义，无法锚定" }; }
			var start = def.startPassage || (Array.isArray(def.passages) && def.passages[0]) || "";
			if (!start) { return { ok: false, message: "该剧情缺少入口段落（startPassage 为空），无法锚定" }; }
			/* v1.9.23：锚定必须有地点元数据（走到该地点交互时触发）；无元数据 → 禁止锚定（旧固定触发已移除） */
			var meta = sceneAnchorMeta(it.key, def);
			if (!meta || !meta.location) { return { ok: false, message: "「" + (def.name || it.key) + "」未标注触发地点（第一批元数据未覆盖该场景），暂不可锚定" }; }
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法锚定" }; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === it.key && q[i].active !== false && !q[i].used) {
					return { ok: false, message: "该剧情已在锚定队列中（第 " + (i + 1) + " 位，走到触发地点时弹确认条）" };
				}
			}
			/* 防崩：农场依赖剧情需 $farm 已初始化（本体 farm_work_update 内 V.farm.clearing -= 1，未初始化直接崩） */
			if (isFarmDependentScene({ startPassage: start, manualVariableChanges: def.manualVariableChanges || "" }) && !farmStateReady()) {
				return { ok: false, message: "「" + (def.name || it.key) + "」依赖农场系统状态（$farm 未初始化）：直接播放会触发本体 farm_work_update 崩溃。请先推进游戏到艾利克斯农场线后再锚定" };
			}
			q.push({
				key: it.key,
				name: def.name || it.key,
				startPassage: start,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || "",
				used: false,
				anchor: { location: meta.location, timeNote: meta.timeNote || "" }
			});
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			/* 锚定提示：地点/时间 + 未完成前置（已完成的不提示；前置缺失不禁止锚定） */
			var pre = pendingPreconds(it.key);
			var msg = "已锚定「" + (def.name || it.key) + "」（队列第 " + pending + " 位）：触发地点「" + locLabel(meta.location) + "」";
			if (meta.timeNote) { msg += "｜时间 " + meta.timeNote; }
			msg += pre.length ? "｜前置未完成：" + pre.join("、") : "｜前置均已达成";
			msg += "。走到该地点交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
			return { ok: true, message: msg };
		} catch (e) {
			return { ok: false, message: "锚定失败：" + mbCEErr(e) };
		}
	}
	/* 锚定整条剧情线（v1.9.23）：把线内已标注触发地点的全部阶段按顺序加入锚定队列，
	   走到各阶段发生地点交互时依次触发，触发完自动完成；无地点元数据的阶段跳过并提示 */
	function pinSceneLine(line) {
		try {
			if (!line || !Array.isArray(line.items) || !line.items.length) { return { ok: false, message: "无阶段可锚定" }; }
			var added = 0, noMeta = 0, dup = 0, farm = 0, other = 0;
			for (var i = 0; i < line.items.length; i++) {
				var it = line.items[i];
				if (!it || !it.def) { continue; }
				var r = pinScene(it);
				if (r.ok) { added++; continue; }
				if (r.message.indexOf("未标注触发地点") >= 0) { noMeta++; }
				else if (r.message.indexOf("已在锚定队列") >= 0) { dup++; }
				else if (r.message.indexOf("依赖农场系统状态") >= 0) { farm++; }
				else { other++; }
			}
			var nm = (line.items[0].def && line.items[0].def.name) || line.prefix || "";
			if (added > 0) {
				var skipParts = [];
				if (noMeta) { skipParts.push(noMeta + " 个未标注触发地点"); }
				if (dup) { skipParts.push(dup + " 个已在队列"); }
				if (farm) { skipParts.push(farm + " 个依赖农场线未开启"); }
				if (other) { skipParts.push(other + " 个缺少入口段落"); }
				return { ok: true, message: "已锚定整线「" + nm + "」系列（" + added + " 个阶段入队：走到各阶段发生地点交互时弹确认条，触发完自动完成）" + (skipParts.length ? "；跳过 " + skipParts.join("、") : "") };
			}
			var reason = noMeta ? "：这些阶段均未标注触发地点（第一批元数据未覆盖），暂不可锚定" : (dup ? "：已在锚定队列中" : (farm ? "：依赖农场线未开启" : ""));
			return { ok: false, message: "没有可锚定的阶段" + reason };
		} catch (e) { return { ok: false, message: "锚定失败：" + mbCEErr(e) }; }
	}
	/* 回退：取消指定剧情（key 省略=清空队列）的固定；若正在重放固定场景，立即解冻并返回原位 */
/* 职责：锚定队列与解锁 —— 取消锚定（unpinScene）、passage→地点映射、场景世界入口解锁（applyWorldUnlock） */
	function unpinScene(key) {
		var V = getV();
		var back = "";
		var changed = false;
		try {
			/* v1.9.23-实机修复五轮：取消锚定（指定 key 或清空）时，若该 key 正展示确认条 → 一并收起
			   （玩家反馈「取消锚定之后立即触发并没有消失」） */
			if (mbCE_anchorPrompt && (key === undefined || key === null || key === "" || mbCE_anchorPrompt.key === key)) {
				hideAnchorPrompt();
			}
			var q = getPinQueue();
			if (q && q.length) {
				if (key === undefined || key === null || key === "") {
					q.length = 0; changed = true;
				} else {
					for (var i = q.length - 1; i >= 0; i--) {
						if (q[i] && q[i].key === key) { q.splice(i, 1); changed = true; }
					}
				}
			}
			if (V && V.replayScene) {
				changed = true;
				/* v1.8.19 防困播放器重构（用户实测：手动取消后仍被困场景播放器）+ v1.9.4 根治：
				   根因一：back = exitpassage || currentPassageName() 的兜底会让"玩家正处于播放器段落
				   时取消"变成原地跳转（跳去当前播放器段落），且随后删 replayScene → 播放器 default 分支
				   的 Back 链接无源 → 退出按钮消失 → 被困。
				   根因二：先调 unfreezePlayerStats（wikifier）会经 mbCEUnfreezeHook 提前删掉 replayScene，
				   跳转目标若恰为播放器段落同样导致 Back 无源。
				   v1.9.4：合并 inPlayer 分支——重放中取消固定，一律 Engine.play(back) 强制跳回原位再清理，
				   不再区分"是否原版 Scene Viewer 播放器段落"。覆盖用户实测的模组恋爱播放器场景
				   （播放器停在第 N 张图、手动取消后仍被困）：back 有效即强制脱离任何播放器/中间段落。
				   play(back) 触发 :passageoverride（dest=back → 489 行 Back 返回原位分支）自然清理
				   used 队列项；随后手动清 replayScene/标记兜底（幂等）。 */
				back = (V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				/* 先清 sceneViewSwitch 为无效值 → Scene Viewer passages 的 switch 走 default（顺序不可反） */
				V.sceneViewSwitch = "MB_CE_END";
				if (back) {
					var ep = getEnginePlayFn();
					if (ep) {
						/* v1.9.5-自检：跳转可用才清理——若 Engine 不可用（极端），保留 replayScene/标记，
						   播放器 Back 链接仍有源，避免重蹈「删 replayScene → Back 无源 → 被困」覆辙 */
						try { ep.play.call(ep.e, back, true); } catch (e) {}
						mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					}
				}
				/* back 为空：保留 replayScene/标记
				   （播放器 default 的 Back 链接依赖它），不主动跳转——玩家经 Back 退出
				   （489 行路径清理）或播放器自身退出调用 unfreeze → mbCEUnfreezeHook 兜底清理。 */
			}
		} catch (e) {}
		return changed;
	}
	/* 剧情入口段落/剧情名 → 匹配的场景组 id（联动解锁用）；
	   兼容 Maplebirch 场景查看器入口前缀（SV xxx / Scene Viewer xxx） */
	function placeIdForPassage(startPassage, sceneName) {
		try {
			var cands = [];
			if (startPassage) {
				cands.push(startPassage);
				if (startPassage.indexOf("SV ") === 0) { cands.push(startPassage.slice(3)); }
				if (startPassage.indexOf("Scene Viewer ") === 0) { cands.push(startPassage.slice(13)); }
			}
			if (sceneName) { cands.push(sceneName); }
			for (var i = 0; i < PLACE_GROUPS.length; i++) {
				var g = PLACE_GROUPS[i];
				if (!g || typeof g.match !== "function") { continue; }
				for (var j = 0; j < cands.length; j++) {
					if (cands[j] && g.match(cands[j])) { return g.id; }
				}
			}
		} catch (e) {}
		return null;
	}
	/* 场景联动解锁：剧情触发完成 → 记录对应场景组解锁（场景页显示已解锁并可直接直达） */
	function unlockPlaceForScene(P) {
		try {
			var V = getV();
			if (!V || !P || !P.startPassage) { return; }
			if (!V.mbCE_unlockedPlaces || typeof V.mbCE_unlockedPlaces !== "object") { V.mbCE_unlockedPlaces = {}; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			/* 入口为 SV 前缀等特殊形态时，用剧情包含段落兜底匹配（如 "Manor Kylar Room" 在 passages 中） */
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) {
				V.mbCE_unlockedPlaces[gid] = { key: P.key, name: P.name, startPassage: P.startPassage, t: Date.now() };
			}
		} catch (e) {}
	}
	/* 世界入口解锁表（v1.3）：各组场景在游戏世界里的原版进入条件（已从本体源码实证）：
	   - kylar_manor：多瑙河街 → "Kylar's manor" 链接，条件 $syndromekylar gte 1
	   - orphanage_loft：孤儿院大厅 → "Loft" 链接，条件 $loft_known is 1
	   - avery_mansion：多瑙河街 → "Avery's mansion" 链接，条件 $avery_mansion 存在且 fate 非 fallen/kicked（v1.2.1 兜底已自动满足）
	   - sirris_places：成人商店 → "Approach Sirris" 链接，条件 $adultshopstate 非 "closed"（营业时间仍受原版控制）
	   - elk_compound（v1.7.0）：Elk Street → "Approach the compound" 链接，条件 $compound.allowed 为 true
	     （未允许时仅显示 "Sneak into the compound" 潜入链接，crimeUp 30 trespassing——已从本体源码实证）
	   - doren_flat / sydney_temple / gwylan_garden：无持久世界入口（剧情/时间触发或动态位置）→ 不写入 */
	var WORLD_UNLOCKS = {
		"kylar_manor": { var: "syndromekylar", set: 1, entry: "多瑙河街 → Kylar's manor（庄园花园）" },
		"orphanage_loft": { var: "loft_known", set: 1, entry: "孤儿院大厅 → Loft（阁楼）" },
		"avery_mansion": { entry: "多瑙河街 → Avery's mansion（已由庄园状态兜底自动解锁）" },
		"sirris_places": { var: "adultshopstate", set: "open", entry: "成人商店 → 接近西里斯（营业时段可见）" },
		"elk_compound": { path: "compound.allowed", set: true, entry: "Elk Street → Approach the compound（需 $compound.allowed）" }
	};
	/* v2.0.3 回退语义补齐：世界入口解锁原为裸写（V[path]=value 无痕迹，误点后无法撤回）。
	   现统一走 mbCEWorldWrite：逐层补壳 + 仅值变化时写 + 首次 before 留痕（key=world:<gid>:<path>）；
	   回退 mbCEWorldUndo(gid) 还原首次写入前状态（before=undefined → 删字段）。 */
	function mbCEWorldResolve(path, create) {
		var V = getV();
		var parts = String(path || "").split(".");
		if (!V || !parts.length || !parts[0]) { return null; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") {
				if (!create) { return null; }
				cur[parts[i]] = {}; /* 父级缺失则逐层补空对象壳（防 undefined 写入） */
			}
			cur = cur[parts[i]];
		}
		return { root: V, parent: cur, leaf: parts[parts.length - 1] };
	}
	function mbCEWorldWrite(gid, path, value) {
		try {
			var r = mbCEWorldResolve(path, true);
			if (!r || !gid) { return false; }
			if (r.parent[r.leaf] === value) { return false; } /* 幂等：值已到位不写、不新增留痕 */
			var V = r.root;
			var before = r.parent[r.leaf];
			var key = "world:" + gid + ":" + path;
			var prev = V.mbCE_wrote && V.mbCE_wrote[key];
			/* before 始终保留「首次写入前」状态（含 undefined=原本无字段），用 in 判断避免覆盖 */
			if (prev && "before" in prev) { before = prev.before; }
			r.parent[r.leaf] = value;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote[key] = { type: "world", gid: gid, path: path, before: before, after: value, t: Date.now() };
			mbCEWroteTrim(V);
			return true;
		} catch (e) { return false; }
	}
	function mbCEWorldUndo(gid) {
		try {
			var V = getV(), n = 0, prefix = "world:" + gid + ":";
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return { ok: false, n: 0, msg: "无世界入口写入留痕" }; }
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				if (k.indexOf(prefix) !== 0) { return; }
				var rec = V.mbCE_wrote[k];
				var r = mbCEWorldResolve(rec.path, false);
				if (r) {
					if (rec.before === undefined) { try { delete r.parent[r.leaf]; } catch (e) { r.parent[r.leaf] = undefined; } }
					else { r.parent[r.leaf] = rec.before; }
				}
				try { delete V.mbCE_wrote[k]; } catch (e) { V.mbCE_wrote[k] = undefined; }
				n += 1;
			});
			return { ok: n > 0, n: n, msg: n > 0 ? "已撤回 " + n + " 项世界入口解锁" : "无该地点的世界入口留痕" };
		} catch (e) { return { ok: false, n: 0, msg: "回退异常：" + mbCEErr(e) }; }
	}
	/* 幂等写入世界入口条件：已有更高/相同值不覆盖，只补缺失或更低值（v1.7.0 支持子路径 path 型，如 compound.allowed） */
	function applyWorldUnlock(gid) {
		try {
			var V = getV();
			if (!V || !gid || !WORLD_UNLOCKS[gid]) { return; }
			var w = WORLD_UNLOCKS[gid];
			if (w.path !== undefined) {
				mbCEWorldWrite(gid, w.path, w.set);
				/* 顺带补 discovered（Elk Street 逻辑：discovered 才显示大院入口判定） */
				if (gid === "elk_compound" && (!V.compound || V.compound.discovered !== true)) { mbCEWorldWrite(gid, "compound.discovered", true); }
				return;
			}
			if (w.var === undefined) { return; }
			if (typeof w.set === "number") {
				var cur2 = typeof V[w.var] === "number" ? V[w.var] : 0;
				if (cur2 < w.set) { mbCEWorldWrite(gid, w.var, w.set); }
			} else if (V[w.var] === undefined || V[w.var] === null || V[w.var] === "") {
				mbCEWorldWrite(gid, w.var, w.set);
			}
		} catch (e) {}
	}
	/* 剧情 → 其场景组的世界入口解锁（联动解锁时一并调用） */
	function applyWorldUnlockForScene(P) {
		try {
			if (!P || !P.startPassage) { return; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) { applyWorldUnlock(gid); }
		} catch (e) {}
	}
	/* 执行场景初始变量（manualVariableChanges，与场景查看器点「重放」一致） */
	function execTweeMacros(str) {
		try {
			if (typeof str !== "string" || !str || typeof document === "undefined" || typeof Wikifier === "undefined") { return; }
			var holder = document.createElement("span");
			holder.style.display = "none";
			document.body.appendChild(holder);
			try { new Wikifier(holder, str); }
			finally { if (holder.parentNode) { holder.parentNode.removeChild(holder); } }
		} catch (e) {}
	}
	/* 当前段落名：SugarCube 全局 passage() 优先，V.passage 兜底（真实环境可靠取到"返回原位"目标） */
	function currentPassageName() {
		try { if (typeof passage === "function") { var p = passage(); if (typeof p === "string" && p) { return p; } } } catch (e) {}
		try { var V2 = getV(); if (V2 && typeof V2.passage === "string" && V2.passage) { return V2.passage; } } catch (e) {}
		return "";
	}
	/* v1.4.8：清理队列中已触发（used）的固定项并联动解锁（三个重放终点共用）；
	   v1.9.23：播放完 → 记入 mbCE_completedScenes（「已完成 ✓」，剧情页条目显示，可再自由锚定） */
	function cleanupUsedPins() {
		try {
			var Vq = getV();
			if (!Vq) { return; }
			var qc = Vq.mbCE_queue;
			if (Array.isArray(qc)) {
				for (var i2 = 0; i2 < qc.length; i2++) {
					if (qc[i2] && qc[i2].used) {
						unlockPlaceForScene(qc[i2]);
						applyWorldUnlockForScene(qc[i2]);
						if (qc[i2].key) {
							if (typeof Vq.mbCE_completedScenes !== "object" || Vq.mbCE_completedScenes === null) { Vq.mbCE_completedScenes = {}; }
							Vq.mbCE_completedScenes[qc[i2].key] = { name: qc[i2].name, t: Date.now() };
							/* v1.9.23-实机修复六轮：同步冻结快照——原版 unfreezePlayerStats 用 frozenValues
							   strict-replace 覆盖 State.variables，不同步则刚写入的「已完成 ✓」记录被恢复撤销
							   （实机：播完后面板仍无「已完成 ✓」、按钮仍可锚定）。 */
							try { if (Vq.frozenValues && typeof Vq.frozenValues === "object") { Vq.frozenValues.mbCE_completedScenes = Vq.mbCE_completedScenes; } } catch (e) {}
						}
					}
				}
				for (var i3 = qc.length - 1; i3 >= 0; i3--) {
					if (qc[i3] && qc[i3].used) { qc.splice(i3, 1); }
				}
			}
		} catch (e) {}
	}
	/* v1.9.5-自检：清重放残留的统一入口（unpinScene / onPassageOverride 各终点共用，消除 5 处分叉不一致）。
	   顺序固定：先清 replayScene/标记，再 unfreeze（避免 mbCEUnfreezeHook 在清理前重复走 cleanup）；
	   skipUnfreeze=true 时不调 unfreeze（原版手动重放场景不干预原版流程）。 */
	function mbCEClearReplay(skipUnfreeze) {
		var Vr = getV();
		/* v1.9.30-实机修复：直达触发未冻结数值（startAnchoredReplay 对 P.direct 跳过 freeze），
		   清理时若再 unfreeze 会误恢复冻结快照/报错 → 仅对冻结过的重放（非 direct）执行 unfreeze。 */
		var wasDirect = !!(Vr && Vr.replayScene && Vr.replayScene.mbCE_direct);
		try { Vr.replayScene = undefined; } catch (e) { Vr.replayScene = undefined; }
		try { Vr.mbCE_replayOnce = undefined; Vr.mbCE_replayPending = undefined; } catch (e) {}
		if (!skipUnfreeze && !wasDirect) {
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
		}
	}
	/* ============ 出口“结束信号”判据（v1.9.30.005：字面 → 字面 + 一层 widget 展开）
	   背景：SugarCube 的 <<widget>> 是运行时展开，段内写 <<endcombat>> 时源码看不到 <<endevent；
	   只判字面会把 94 条 depth=1 出口段（BlackWolfIntro / EdenIntro / FreeTheBlackDog /
	   PrisonScarredInmate / MoorFlower … 段名多带 Finish）误判为「剧情未结束」→ 出口段被当分支
	   push 并入白名单 → 剧情播完仍残留 replayScene → 剧情页直达按钮永久禁用。
	   做法：惰性构建「定义体内直接含 <<endevent / <<badEndTrackingEnd>> 的 widget 名表」（排除 endevent
	   自身），段内任一次 <<name 调用命中即视为含结束信号。深度只做 1 层（对齐矩阵 depth=1 定案；
	   depth≥2 已取证定案不做：14 条候选中 3 条是 loadNPC→checkEventNPC 伪信号（其实体里的信号在
	   HTML 注释内），其余 11 条都落在 <<if !$replayScene>> / <<if $frozenValues>> 等条件分支内，
	  「调用 A」不保证「执行到信号」，展开会引入误判；证据见 tests/data/direct_exit_matrix.meta.txt）。
	   取不到段落 / 构建异常 → 退化为字面判据，绝不阻断直达。
	   注释排除：HTML 注释与块注释（斜杠星号对）里的 <<endevent 不算信号（原文 4 段仅注释含信号：
	   Bus Station Livestock / Elk Compound Station Badge / Mines Intro / Pirate Deck；1 个 widget
	   checkEventNPC 同理），否则会提前判定剧情已结束、把还剩可选链接的段直接清锁。
	   一致性约束：build 侧独立实现 tools/gen_direct_exit_matrix.py::end_signal_widgets 与此逐条一致；
   任一侧改判据必须两侧同改 → 重生成矩阵 → 重跑全链（19.17 穷举会立即暴露分歧）。 */
	var mbCE_widgetEndTbl = null; /* null = 未构建；对象 = 已构建（键为命中 widget 名） */
	/* 去掉两类注释后的源码（判据只在有效代码上生效） */
	function mbCEStripComments(src) {
		if (!src) { return ""; }
		return src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
	}
	function mbCEWidgetEndTable() {
		if (mbCE_widgetEndTbl !== null) { return mbCE_widgetEndTbl; }
		var out = {};
		try {
			var ps = (typeof listAllPassages === "function") ? listAllPassages() : [];
			for (var i = 0; i < ps.length; i++) {
				var s = ps[i] && ps[i].text;
				if (!s || s.indexOf("<<widget") === -1) { continue; }
				var reW = /<<widget\s+"([^"]+)"\s*>>([\s\S]*?)<<\/widget>>/g, mm;
				while ((mm = reW.exec(s)) !== null) {
					var nm = mm[1], body = mbCEStripComments(mm[2]);
					if (nm === "endevent") { continue; }
					if (body.indexOf("<<endevent") !== -1 || body.indexOf("<<badEndTrackingEnd") !== -1) { out[nm] = true; }
				}
			}
		} catch (e) { out = {}; }
		mbCE_widgetEndTbl = out;
		return out;
	}
	function mbCESrcHasEndSignal(src) {
		if (!src) { return false; }
		src = mbCEStripComments(src);
		if (src.indexOf("<<endevent") !== -1 || src.indexOf("<<badEndTrackingEnd") !== -1) { return true; }
		var tbl = mbCEWidgetEndTable();
		var reC = /<<([A-Za-z_][A-Za-z0-9_]*)/g, mm;
		while ((mm = reC.exec(src)) !== null) {
			if (tbl[mm[1]] === true) { return true; }
		}
		return false;
	}
	/* :passageoverride 钩子：固定触发判定（在 SugarCube 原版 redirect 之前改 passageArgs.name） */
	function onPassageOverride(passageArgs) {
		try {
			var V = getV();
			if (!V) { return; }
			var dest = passageArgs && passageArgs.name;
			/* v1.5.1：Mansion 系段落兜底——无论以何种方式进入艾弗里庄园段落（场景直达、场景查看器重放、
			   固定触发、第二天正常日常），只要 $daily.avery.talk 缺失，avery_daily_talk / Mansion Talk 正文
			   都会 TypeError（reading 'chat'/'ignore'）；在固定触发判定前无条件兜底（缺失才建，不覆盖进度） */
			if (typeof dest === "string" && dest.length > 0 &&
				(dest.indexOf("Mansion") === 0 || dest.indexOf("Avery") === 0 || dest.indexOf("Avery's") === 0)) {
				ensureAveryMansion();
			}
			/* 原版重放结束（Scene Viewer End 且正处于重放）→ 记录场景解锁 + 清理已触发项 */
			if (dest === "Scene Viewer End" && V.replayScene) {
				cleanupUsedPins();
				/* v1.4.8：MOD 固定触发的重放播放完（到 Scene Viewer End）→ 自动返回原位（exitpassage）
				   并解除固定；跳过 End 段落（原版 End 显示 "Exit scene" 需手动点、且回的是场景查看器列表）。
				   原版手动重放保持原版行为：End → Exit scene 回场景查看器。 */
				var wasMod = !!V.mbCE_replayOnce;
				var backTo = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				mbCEClearReplay(!wasMod); /* v1.9.5-自检：统一清理入口（原版手动重放不 unfreeze） */
				if (wasMod && backTo && passageArgs) { passageArgs.name = backTo; }
				return;
			}
			if (V.replayScene) {
				/* 原版手动重放（非 MOD 固定触发）→ 交给原版处理，不干预 */
				if (!V.mbCE_replayOnce) { return; }
				/* v1.9.23-实机修复二轮（锚定触发播放完不清队列/被困 Scene Viewer End 死循环的根治）：
				   MOD 锚定/固定触发直接播剧情段（不经场景查看器播放器容器）——剧情出口段（dest 不在
				   replayScene.passages）会被原版 redirect（31697-31698）改写为 "Scene Viewer End"，
				   而本钩子已在同一轮 :passageoverride 事件内执行过（只看到旧 dest），下方 823 的
				   "Scene Viewer End" 分支永远收不到改写后的 dest → 播完不清理、队列残留、返回地点再弹；
				   玩家点「退出场景」（End 段汉化链接 target=Scene Viewer）又被 redirect 打回 End → 死循环被困。
				   修复：在本轮事件内直接接管剧情出口——清理队列 + 改 passageArgs.name 回原位（exitpassage），
				   原版 31683 检测 name 已变 → return 新 dest，redirect 不再执行。 */
				var rpExit = V.replayScene.passages;
				var exitDest = V.replayScene.exitpassage || "";
				var inChain = Array.isArray(rpExit) && rpExit.indexOf(dest) !== -1;
				var isEndUi = (dest === "Scene Viewer End" || dest === "Scene Viewer passages" || dest === "Scene Viewer End 2");
				/* v1.9.30-实机修复：直达触发（mbCE_direct）不走白名单中断——
				   直达语义 = 无条件开播、剧情自然流转、结束自然回主循环。
				   实机 bug 根因：凯拉尔绑架等大剧情不在场景注册表显式 passages（getScenesDefs 走
				   recover 兜底，白名单残缺），玩家选任意选项 → dest 不在白名单 → 下方「链外出口」
				   判定/原版 redirect（DoL L31697：!passages.includes(dest) → "Scene Viewer End"）
				   把剧情分支段当出口 → 清 replayScene + 改 dest 回触发点 → 「选选项跳回原地点」。
				   修复：① 剧情内分支段动态并入白名单（redirect 判 dest ∈ passages → 放行，剧情不打断）；
				   ② 剧情出口特征（当前段「含结束信号」——字面 <<endevent>>/<<badEndTrackingEnd>>，或 v1.9.30.005 起
				   段内调用的 widget 定义体内部含之（<<endcombat>> 等运行时展开才可见），玩家点 Next 跳普通段）
				   → 剧情已结束 → 清理重放状态但保留 dest（剧情自身引导回主循环 = 走完正常发展）。 */
				if (V.replayScene.mbCE_direct) {
					if (dest === "Scene Viewer" || isEndUi) {
						/* 直达不应落到场景查看器 UI（原版 redirect 兜底）：清理 + 回原位 */
						cleanupUsedPins();
						mbCEClearReplay();
						if (exitDest && passageArgs) { passageArgs.name = exitDest; }
						return;
					}
					var curSrc = "";
					try {
						if (typeof State !== "undefined" && State && typeof State.passage === "string") {
							var curTpl = (typeof Story !== "undefined" && Story && typeof Story.get === "function") ? Story.get(State.passage) : null;
							if (curTpl && (curTpl.source || curTpl.text)) { curSrc = curTpl.source || curTpl.text; }
						}
					} catch (e) {}
					if (curSrc && mbCESrcHasEndSignal(curSrc) &&
						!(Array.isArray(rpExit) && rpExit.indexOf(dest) !== -1)) {
						/* 出口段点击（当前段「含结束信号」= 字面 <<endevent>>/<<badEndTrackingEnd>>，
						   或 v1.9.30.005 起：段内直接调用的 widget 定义体内部含之——<<endcombat>> /
						   <<girlfriend>> / <<nightmareEnd>> 等 94 条 depth=1，widget 运行时展开才可见）：
						   剧情已结束 → 清理重放状态，保留 dest 让剧情自然回主循环（走完正常发展）。
						   v1.9.30.002-实机修复：移除「dest !== startPassage」排除——学校检查剧情
						   （SchoolInspection Breast/Penis/Pussy）出口段 "Breast Inspection End" 含 <<endevent>>
						   且 Next 回 startPassage "Science Lesson"（原版场景回环设计，Science Lesson ∉ 白名单），
						   旧排除把它当「剧情未结束」→ replayScene 残留 → 剧情页全部「直达触发」按钮
						   永久禁用（title 正在播放剧情）。现改为：出口段一律判定剧情结束——
						   dest 仍在本剧情白名单内（出口段通往剧情内段 = 中间事件结束/剧情回环，
						   如 19.12a 凯拉尔 Release 4→Abduction）→ 由 rpExit 排除保护，不清理放行；
						   dest=startPassage（∉ 白名单）/exitDest 触发点/剧情外段 → 清理，玩家随 dest 落主循环。
						   v1.9.30.003-迭代优化：同时移除「dest !== exitDest」排除——出口段 Next 回触发点
						   （玩家在 Danube Street 触发凯拉尔绑架直达，出口段 Release 4 回 Danube Street=exitDest；
						   全量实证 110 场景/16087 段：含 endevent 链内段 Next 离链均为主循环段/触发点，语义即剧情结束）
						   旧排除同样制造残留 → 全部直达按钮禁用；出口段一律以「当前段含结束信号」为准，
						   与下方 dest===exitDest 清理分支共同覆盖所有返回触发点路径（对齐非 direct 分支 L1012 语义）。 */
						cleanupUsedPins();
						mbCEClearReplay();
						return;
					}
					/* v1.9.30.003-迭代优化：玩家回到触发点（exitpassage）——剧情退出（中途返回/出口段回原位）
					   → 清理重放状态（对齐非 direct 分支对 exitpassage 的清理语义，防残留致按钮永久禁用）；
					   必须在并入白名单之前判定（exitDest 是触发时所在段，非剧情链段，不应被并入）。 */
					if (dest === exitDest) {
						cleanupUsedPins();
						mbCEClearReplay();
						return;
					}
					/* 剧情分支段：并入白名单防原版 redirect 改写为 Scene Viewer End，放行 */
					if (Array.isArray(rpExit) && rpExit.indexOf(dest) === -1) {
						try { rpExit.push(dest); } catch (e) {}
					}
					return;
				}
				if (dest === "Scene Viewer" || (!isEndUi && dest !== "Farm Work" && dest !== V.replayScene.startPassage && !inChain && dest !== exitDest)) {
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (exitDest && passageArgs) { passageArgs.name = exitDest; }
					return;
				}
				/* v1.4.8：MOD 固定触发的 case 场景播放完链回 Scene Viewer passages（非首次进入）→
				   自动返回原位并解除固定（跳过原版 default 的 "Error occurred" + 手动 Back 步） */
				if (dest === "Scene Viewer passages" && !V.mbCE_replayPending) {
					cleanupUsedPins();
					var backS = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (backS && passageArgs) { passageArgs.name = backS; }
					return;
				}
				/* v1.4.5：原版重放经 Back 正常返回原位（exitpassage）→ 清理残留（replayScene/标记/已用队列项），
				   避免残留导致后续取消固定误判"正在重放"、以及再次重放时被残留干扰 */
				if (dest === (V.replayScene.exitpassage || "")) {
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					return;
				}
				/* MOD 固定触发的重放：仅已知确定性逃逸终点到达时清理残留（农场剧情结束直接去 Farm Work 而非回 Scene Viewer），
				   否则一律视为仍在重放（含剧情中间段落不在注册表列表的情况）→ 不干预、不触发 */
				if (dest === "Farm Work") {
					/* 农场剧情确定性终点：结束即清理残留（unfreeze + 清标记），并移除已触发项（同 Scene Viewer End） */
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
				} else {
					/* v1.9.23-实机修复三轮：重放链内段判定——dest 在 replayScene.passages 内（inChain 恒 true），
					   二轮「链外出口」接管覆盖不到。两类播完信号：
					   ① 剧情线性走完：到达剧情末段（passages 最后一段）且前置链内段均已访问 → 剧情播完（落地点，
					      如「米奇酒吧知名度初见」Pub Fame Intro 4 为酒吧主段，实机 $pubfame 已存在走 else 选项、
					      无循环出口）→ 清理 + 回原位；分支型场景（如 Avery 各分支段）前置未全访问 → 不触发不误伤。
					   ② 剧情链循环回点：已访问段再次到达且非 startPassage/exitpassage（如 4 段剧情分支 Next 回
					      Pub Fame Intro）→ 剧情播完进入循环 → 清理 + 回原位。 */
					var visArr = V.replayScene.mbCE_visited;
					if (!Array.isArray(visArr)) { visArr = V.replayScene.mbCE_visited = []; }
					var wasVisited = visArr.indexOf(dest) !== -1;
					if (!wasVisited) { visArr.push(dest); }
					var isLastSeg = rpExit.length > 0 && dest === rpExit[rpExit.length - 1];
					if (isLastSeg) {
						var allPrevVisited = true;
						for (var pi = 0; pi < rpExit.length - 1; pi++) {
							if (visArr.indexOf(rpExit[pi]) === -1) { allPrevVisited = false; break; }
						}
						if (allPrevVisited) {
							cleanupUsedPins(); /* 线性播完：解锁 + 已完成记录 + 移除 */
							mbCEClearReplay();
							if (exitDest && passageArgs) { passageArgs.name = exitDest; }
							return;
						}
					}
					if (!wasVisited) { return; } /* 首次访问（含分支场景首次到末段）→ 不清理 */
					if (dest !== V.replayScene.startPassage && dest !== exitDest) {
						/* 非首次访问（循环回点）→ 播完清理 */
						cleanupUsedPins();
						mbCEClearReplay();
						if (exitDest && passageArgs) { passageArgs.name = exitDest; }
					}
					return; /* startPassage / exitpassage 重访 → 不触发 */
				}
			}
			var q = getPinQueue();
			if (!q) { return; }
			var P = null;
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].active !== false && !q[i].used && q[i].startPassage) { P = q[i]; break; }
			}
			if (!P) { return; }
			/* v1.9.23：带地点元数据的锚定项由 :passageend 弹确认条触发（走到该地点交互时），
			   段落跳转本身不再自动触发；旧档无元数据项保持旧「任意推进即触发」语义直至触发完 */
			var anchorMeta = P.anchor || sceneAnchorMeta(P.key);
			if (anchorMeta && anchorMeta.location) { return; }
			if (!dest || dest === P.startPassage || dest === "Scene Viewer End") { return; }
			if (Array.isArray(P.passages) && P.passages.indexOf(dest) !== -1) { return; }
			/* 防崩：农场依赖剧情且 $farm 未初始化 → 本次不触发（保留队列项，待农场线开启后自动可触发） */
			if (isFarmDependentScene(P) && !farmStateReady()) { return; }
			/* 防崩：艾弗里庄园/森林商店等段落依赖 $avery_mansion（可能延迟初始化）→ 触发前兜底 */
			ensureAveryMansion();
			/* 防崩：农场依赖剧情需 $farm 结构存在（触发前兜底，缺失才补，不覆盖已有进度） */
			ensureFarmState();
			/* 启动原版重放：先执行场景初始变量 → 冻结属性 → 设 $replayScene → 重定向入口 */
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			V.replayScene = {
				name: P.name,
				startPassage: P.startPassage,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName()
			};
			V.mbCE_replayOnce = true;  /* 本重放由 MOD 固定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			/* v1.4.8：仅当场景入口是 Scene Viewer passages 才需"首次保留 sceneViewSwitch"；
			   直入剧情段落的场景（如孤儿院 SV Street Bully Orphanage Go）不设 pending，
			   避免链回 Scene Viewer passages 时被误判为首次 → 无法自动回原位 */
			V.mbCE_replayPending = (P.startPassage === "Scene Viewer passages");
			passageArgs.name = P.startPassage;
			P.used = true; /* 一次性：触发后不再重复触发 */
			unlockPlaceForScene(P); /* 联动解锁：触发即解锁所在场景组（如凯拉尔剧情 → 庄园可直达） */
			applyWorldUnlockForScene(P); /* 世界入口解锁：写入原版进入条件（多瑙河街→庄园等） */
		} catch (e) {}
	}
	function hookPassageOverride() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			/* SugarCube 自定义事件系统（jQLite）：与 DoL 本体 $(document).one(':passageend',…) 一致。
			   四巡：命名空间防重——重载/重复注入时先 off 再 on，避免 jQuery handler 无限累积 */
			$(document).off(":passageoverride.mbce").on(":passageoverride.mbce", function (ev, passageArgs) {
				onPassageOverride(passageArgs);
			});
		} catch (e) {}
	}
	/* 场景查看器段落初始化拦截（防"播放完又播放"无限循环）：
	   本体的 Scene Viewer passages 段落在 <<switch $sceneViewSwitch>> 里无条件播放 case 剧情，
	   剧情 widget 结束若链回该段落会再次命中 case → 无限循环（且 replayScene 只在 default/End 清理）。
	   机制：固定触发跳转前设 mbCE_replayPending；首次进入该段落（pending=true）→ 消费标记、保留
	   sceneViewSwitch（case 正常播放）；剧情结束链回（pending=false 且处于我们的重放）→ 清
	   sceneViewSwitch 为无效值 → switch 走 default → 原版给出 Back 链接返回原位，不再重播。 */
	function mbCEOnPassageInit(title) {
		try {
			/* v1.3.5：格威岚场景临时变量全局兜底——每次进入任意段落都先确保
			   T.gwylanStatus / T.gwylanTF 已初始化（缺失才补，已有绝不覆盖）。
			   本体 Gwylan Ritual Start Garden 等段落靠 <<run statusCheck("Gwylan")>>
			   初始化这两个临时变量，但 statusCheck 仅在 C.npc.Gwylan.init === 1 时才调用
			   gwylanStatusCheck()（新存档未见过格威岚即不调用）；且 gwylanStatusCheck()
			   在 V.gwylanTalked/V.gwylanSeen/V.gwylan 缺失时早退，只设 T.gwylanStatus=[]、
			   不设 T.gwylanTF。新存档场景直达/固定触发格威岚段落 → 读 _gwylanStatus/
			   _gwylanTF 即崩（reading 'includesAny' / 'tail'）。全局兜底可覆盖任何段落名
			   （含框架改段落名/宿主段落内嵌格威岚内容的渲染路径）。 */
			ensureGwylanSceneState();
			/* v1.9.x 庄园自动维护每日调度：任意段落进入时检查游戏日变化，
			   执行已开启的自动维护项（AutoClean 模式，见 03-global.js mcAutoMaintainTick） */
			try { mcAutoMaintainTick(); } catch (e) {}
			if (title !== "Scene Viewer passages") { return; }
			var V = getV();
			if (!V) { return; }
			if (V.mbCE_replayPending) { V.mbCE_replayPending = false; return; }
			if (V.replayScene && V.mbCE_replayOnce) { V.sceneViewSwitch = "MB_CE_END"; }
		} catch (e) {}
	}
	function hookPassageInit() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageinit.mbce").on(":passageinit.mbce", function (ev, passage) {
				try {
					var t = (passage && passage.title) ? passage.title : "";
					mbCEOnPassageInit(t);
				} catch (e) {}
			});
		} catch (e) {}
	}
	/* v1.8.19：播放结束自动清理——包装 window.unfreezePlayerStats。
	   背景（用户实测）：固定 MOD 剧情播放完一次后不自动取消、仍重新播放；手动取消后仍被困播放器。
	   根因：结束判定只认 4 个硬编码段落名（Scene Viewer End / Scene Viewer passages / exitpassage /
	   Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景，结束段落为框架自有名，
	   不走原版 Scene Viewer 通道）的结束段落不被识别 → 队列 used 项永不清理 + replayScene 残留 →
	   下次推进剧情再次触发（循环）或拦截后续固定。
	   修复：任何合法 unfreezePlayerStats 调用（原版 Scene Viewer 退出 / 框架播放器结束 / mod 播放器
	   结束都会解冻）都视为"场景播放结束"→ 清理队列 used 项 + 清 replayScene/标记。不再依赖段落名。 */
	function hookUnfreezePlayerStats() {
		try {
			if (typeof window === "undefined" || !window) { return; }
			var orig = window.unfreezePlayerStats;
			if (typeof orig !== "function" || window.__mbCEUnfreezeHooked) { return; }
			window.__mbCEUnfreezeHooked = true;
			window.unfreezePlayerStats = function () {
				try {
					var V = getV();
					if (V && V.replayScene && V.mbCE_replayOnce) {
						/* MOD 固定触发的重放中收到 unfreeze = 播放结束 → 清理已触发项 + 重放状态 */
						cleanupUsedPins();
						try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
						try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
					}
				} catch (e) {}
				try { return orig.apply(window, arguments); } catch (e) {}
			};
		} catch (e) {}
	}

/* 职责：恋爱 / 转化阶段页渲染（renderRomanceStages / renderTransformStages） */
	function renderRomanceStages(pane) {
		/* v1.4.5：非恋爱候选角色不显示恋爱阶段（角色本身保留在角色一览）——
		   只有能进恋人卡槽的角色才展示恋爱阶段与"恋人卡槽"条件 */
		if (!isLoveCandidate(curName)) {
			pane.appendChild(el("div", "mce-hint", "「" + displayNameEx(curName) + "」不是可确立恋人关系的角色，无可解锁的恋爱阶段。"));
			return;
		}
		var stages = getRomanceStages(curName);
		if (stages.length) {
			/* v2.0.3：单区块页统一编号（原为裸 mce-section，与全局页 / 言灵页的 ①②③ 编号体系不一致） */
			var sRom = mceNewSec(pane, 1, "框架恋爱条件", "框架（Maplebirch）注册的恋爱阶段条件，来自各模组 romanceConditions；「一键完成」先补数值再置位，可由「回退」撤销面板写入的标记。");
			var box = el("div", "mce-stages");
			stages.forEach(function (stg) {
				var row = el("div", "mce-stage " + (stg.ok ? "mce-pass" : "mce-fail"));
				var head = el("div", "mce-stage-head");
				head.appendChild(el("span", "mce-dot", ""));
				head.appendChild(el("span", "mce-stage-name", stg.ok ? "已达成" : "未达成"));
				if (!stg.ok) {
					var btn = el("button", "mce-btn mce-gold", "一键完成");
					btn.type = "button";
					btn.addEventListener("click", function () {
						var r = completeRomanceStage(curName, stg);
						renderStagePane();
						setStatus(r.ok ? "恋爱阶段已解锁" : (r.fixed ? "已写入，但条件仍为未达成" : "该条件依赖运行时逻辑，无法自动完成"), r.ok ? "mce-ok" : "mce-err");
					});
					head.appendChild(btn);
				} else {
					head.appendChild(el("span", "mce-badge mce-on", "通过"));
					/* 回退（v1.2）：仅撤销面板写入的标记，真实达成拒绝回退 */
					var undBtn = el("button", "mce-btn mce-red", "回退");
					undBtn.type = "button";
					undBtn.title = "撤销面板写入的标记（不动真实属性）；真实达成的阶段会拒绝回退";
					(function (stg2) {
						undBtn.addEventListener("click", function () {
							var u = undoRomanceStage(curName, stg2);
							renderStagePane();
							setStatus(u ? "已回退：撤销「" + displayName(curName) + "」该阶段的标记写入" : "该阶段不可回退（真实达成或关系状态类）", u ? "mce-ok" : "mce-err");
						});
					})(stg);
					head.appendChild(undBtn);
				}
				row.appendChild(head);
				row.appendChild(el("div", "mce-stage-txt", "条件：" + stg.text));
				var desc = describeCondition(stg.text, curName);
				if (desc) {
					row.appendChild(el("div", "mce-stage-note", (stg.ok ? "已达成：" : "要求：") + desc));
				}
				if (!stg.ok && !parseCondition(stg.text, curName)) {
					row.appendChild(el("div", "mce-stage-note", "注：该条件读取运行时函数/变量，无法自动补齐，请手动达成。"));
				}
				box.appendChild(row);
			});
			sRom.appendChild(box);
		} else {
			pane.appendChild(el("div", "mce-hint", "该角色未注册框架恋爱剧情条件（romanceConditions 为空）。"));
		}

		/* 原版恋爱阶段（格威岚 7 阶段，来自游戏原版 gwylanStatusCheck 体系） */
		var vanilla = getVanillaStages(curName);
		if (vanilla.length) {
			var sVan = mceNewSec(pane, 2, "原版恋爱阶段（" + displayNameEx(curName) + "）", "原版 gwylanStatusCheck 体系的原生阶段判定（不依赖模组）；「一键完成」先补到官方门槛再置位，规避原版自动校验把阶段重置。");
			var vbox = el("div", "mce-stages");
			vanilla.forEach(function (s) {
				var row = el("div", "mce-stage " + (s.ok ? "mce-pass" : "mce-fail"));
				var head = el("div", "mce-stage-head");
				head.appendChild(el("span", "mce-dot", ""));
				head.appendChild(el("span", "mce-stage-name", s.ok ? "已达成" : "未达成"));
				if (!s.ok) {
					var vbtn = el("button", "mce-btn mce-gold", "一键完成");
					vbtn.type = "button";
					vbtn.title = "先补齐数值到官方门槛，再激活阶段（规避自动校验重置）";
					vbtn.addEventListener("click", function () {
						var r = completeVanillaStage(curName, s.key);
						renderStagePane();
						setStatus(r.ok ? "「" + displayNameEx(curName) + "」" + s.label + " 已达成" : r.message, r.ok ? "mce-ok" : "mce-err");
					});
					head.appendChild(vbtn);
				} else {
					head.appendChild(el("span", "mce-badge mce-on", "通过"));
					/* 回退（v1.2）：仅撤销面板写入的经历标记，真实达成拒绝回退 */
					var vund = el("button", "mce-btn mce-red", "回退");
					vund.type = "button";
					vund.title = "撤销面板写入的经历标记（不动爱意/支配/情欲等真实属性）；真实达成的阶段会拒绝回退";
					(function (s2) {
						vund.addEventListener("click", function () {
							var u = undoVanillaStage(curName, s2.key);
							renderStagePane();
							setStatus(u.ok ? u.message : (u.message || "该阶段不可回退"), u.ok ? "mce-ok" : "mce-err");
						});
					})(s);
					head.appendChild(vund);
				}
				row.appendChild(head);
				row.appendChild(el("div", "mce-stage-txt", "门槛：" + s.desc));
				vbox.appendChild(row);
			});
			sVan.appendChild(vbox);
		}
	}

	function renderTransformStages(pane) {
		var types = listStageTypes(curName);
		var exts = listExtTransforms();
		if (!types.size && !exts.length) {
			pane.appendChild(el("div", "mce-hint", "该角色未注册转化阶段。"));
			/* v2.0.7：外观隐藏是 PC 全局部件，不依赖选中角色是否注册转化阶段 */
			if (typeof renderTransformHideSec === "function") { renderTransformHideSec(pane); }
			return;
		}
		/* v2.0.3：转化页统一编号（原为无标题卡片堆） */
		var sTr = mceNewSec(pane, 1, "转化阶段", "每张卡片对应一个转化系（原版 / 玩家扩展）；「一键解锁全部阶段」= 先补成长值到门槛再逐级置位，扩展转化直接调 MOD 公共 API setup.myTFSet。");
		types.forEach(function (levels, type) {
			var st = readTransformState(curName, type);
			var max = levels.length;
			var block = el("div", "mce-stage" + (st.level >= max ? " mce-pass" : " mce-fail"));
			var head = el("div", "mce-stage-head");
			head.appendChild(el("span", "mce-dot", ""));
			head.appendChild(el("span", "mce-stage-name", typeCN(type) + "　成长 " + st.build + " / 阶段 " + st.level + " / " + max));
			block.appendChild(head);
			var build = el("div", "mce-build");
			var m10 = el("button", "mce-btn", "-10");
			m10.type = "button";
			m10.addEventListener("click", function () { adjustTransform(curName, type, -10); renderStagePane(); });
			var p10 = el("button", "mce-btn", "+10");
			p10.type = "button";
			p10.addEventListener("click", function () { adjustTransform(curName, type, 10); renderStagePane(); });
			var unlock = el("button", "mce-btn mce-gold", "一键解锁全部阶段");
			unlock.type = "button";
			unlock.addEventListener("click", function () {
				completeTransformStage(curName, type, max);
				renderStagePane();
				setStatus("「" + displayName(curName) + "」" + typeCN(type) + " 已解锁至最高阶段", "mce-ok");
			});
			build.appendChild(m10);
			build.appendChild(p10);
			build.appendChild(unlock);
			block.appendChild(build);
			/* 单阶段按钮 + 门槛文本 */
			var stages = el("div", "mce-stages");
			for (var i = 1; i <= max; i++) {
				(function (lv) {
					var srow = el("div", "mce-stage " + (st.level >= lv ? "mce-pass" : "mce-fail"));
					var sh = el("div", "mce-stage-head");
					sh.appendChild(el("span", "mce-dot", ""));
					sh.appendChild(el("span", "mce-stage-name", "阶段 " + lv + "（" + (lv === 1 ? "起始" : "上一阶段达成") + "）"));
					if (st.level < lv) {
						var btn = el("button", "mce-btn mce-gold", "一键完成");
						btn.type = "button";
						btn.title = "先补成长值到门槛 " + levels[lv - 1] + "，再置位阶段";
						btn.addEventListener("click", function () {
							completeTransformStage(curName, type, lv);
							renderStagePane();
						});
						sh.appendChild(btn);
					} else {
						sh.appendChild(el("span", "mce-badge mce-on", "已达成"));
					}
					srow.appendChild(sh);
					srow.appendChild(el("div", "mce-stage-txt", "门槛：成长值 ≥ " + levels[lv - 1]));
					stages.appendChild(srow);
				})(i);
			}
			block.appendChild(stages);
			sTr.appendChild(block);
		});
		/* 扩展转化（MOD 独立系统：玩家全局，与选中角色无关） */
		exts.forEach(function (k) {
			var stg = Number(getV()[k]) || 0;
			var bld = Number(getV()[k + "build"]) || 0;
			var nm = EXT_TF_CN[k] || k;
			var block = el("div", "mce-stage" + (stg >= 3 ? " mce-pass" : " mce-fail"));
			var head = el("div", "mce-stage-head");
			head.appendChild(el("span", "mce-dot", ""));
			head.appendChild(el("span", "mce-stage-name", nm + "（玩家扩展转化）　成长 " + bld + " / 阶段 " + stg + " / 3"));
			block.appendChild(head);
			var srow = el("div", "mce-stage " + (stg >= 3 ? "mce-pass" : "mce-fail"));
			var sh = el("div", "mce-stage-head");
			sh.appendChild(el("span", "mce-dot", ""));
			sh.appendChild(el("span", "mce-stage-name", nm + "　阶段 " + stg + " / 3"));
			if (stg < 3) {
				var btn = el("button", "mce-btn mce-gold", "一键完成");
				btn.type = "button";
				btn.title = "调用 MOD 公共 API setup.myTFSet 直接置为最高阶段";
				btn.addEventListener("click", function () {
					if (completeExtTransform(k)) {
						setStatus("「" + nm + "」扩展转化已解锁至阶段 3", "mce-ok");
					} else {
						setStatus("「" + nm + "」扩展转化完成失败（MOD 未加载或 API 缺失）", "mce-err");
					}
					renderStagePane();
				});
				sh.appendChild(btn);
			} else {
				sh.appendChild(el("span", "mce-badge mce-on", "已达成"));
			}
			srow.appendChild(sh);
			srow.appendChild(el("div", "mce-stage-txt", "门槛：成长值 30 / 60 / 90 对应阶段 1 / 2 / 3"));
			block.appendChild(srow);
			sTr.appendChild(block);
		});
		/* v2.0.7：R1/R2 外观隐藏区块（07j-transform-hide.js）——三项开关 + 无惩罚 + 强制保持 */
		if (typeof renderTransformHideSec === "function") { renderTransformHideSec(pane); }
	}

	/* v1.9.23：锚定播放完成记录（mbCE_completedScenes）→ 剧情页条目显示「已完成 ✓」 */
	function isSceneCompleted(key) {
		try { var V = getV(); return !!(V && V.mbCE_completedScenes && V.mbCE_completedScenes[key]); } catch (e) { return false; }
	}
	/* ---- 特殊剧情页（$scenes 场景注册表动态枚举） ---- */
	var sHeadGuardTimer = null; /* v1.9.5-自检：乱码兜底单定时器——renderScenes 频繁重建时清旧设新，防 800ms 闭包堆积扫描旧 pane */
	/* v2.0.0.002（C3 拆分回归修复）：sceneSectionKey / sceneStored / sceneSet 原本是 renderScenes() 的局部函数，
	   而 renderSceneRegion 已拆到 07h-render3.js，跨文件调用会报 ReferenceError: sceneStored is not defined。
	   三者只依赖模块级 mbCEUiState / mbCEUiSave，故提升到模块级供两处共用（语义与实现未变）。 */
	function sceneSectionKey(role) { return "剧情:" + role; }
	function sceneStored(role) {
		return mbCEUiState.collapsed && mbCEUiState.collapsed[sceneSectionKey(role)] != null
			? Number(mbCEUiState.collapsed[sceneSectionKey(role)]) : 1;
	}
	function sceneSet(role, val) {
		mbCEUiState.collapsed = mbCEUiState.collapsed || {};
		mbCEUiState.collapsed[sceneSectionKey(role)] = val;
		mbCEUiSave({ collapsed: mbCEUiState.collapsed });
	}
	function renderRolePlots(plots) {
		var block = el("div", "mce-stage mce-plots");
		var head = el("div", "mce-stage-head mce-line-head");
		head.appendChild(el("span", "mce-dot", ""));
		head.appendChild(el("span", "mce-stage-name", "剧情进度（非场景事件状态）"));
		block.appendChild(head);
		var body = el("div", "mce-grp-body");
		body.appendChild(el("div", "mce-hint", plots.intro));
		plots.items.forEach(function (it) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-name", it.name));
			var curBadge = el("span", "mce-badge mce-on", "");
			var refreshCur = function () {
				var cv = getDotPath(it.varPath);
				curBadge.textContent = "当前: " + (cv === undefined ? "未设置" : cv);
			};
			refreshCur();
			row.appendChild(curBadge);
			if (it.type === "range" || it.type === "select") {
				var ctrl;
				if (it.type === "range") {
					var inp = el("input", "mce-inp");
					inp.type = "number"; inp.min = String(it.min); inp.max = String(it.max); inp.step = String(it.step || 1); /* 剧情进度是进度档位：钳制在 [min,max]（用户澄清：仅"直接填数值"放开上限，进度保留） */
					var apply = el("button", "mce-btn", "应用");
					apply.type = "button";
					apply.addEventListener("click", function () {
						var v = parseFloat(inp.value);
						if (isNaN(v)) { v = 0; }
						if (v < it.min) { v = it.min; } if (v > it.max) { v = it.max; } /* 进度档位语义，钳制在上限内 */
						setDotPath(it.varPath, v);
						refreshCur();
						setStatus(it.name + " → " + v, "mce-ok");
					});
					row.appendChild(inp); row.appendChild(apply);
				} else {
					var sel = el("select");
					(it.options || []).forEach(function (o) {
						var op = el("option"); op.value = String(o[0]); op.textContent = o[1];
						var cv = getDotPath(it.varPath);
						if (String(cv) === String(o[0])) { op.selected = true; }
						sel.appendChild(op);
					});
					var applyS = el("button", "mce-btn", "应用");
					applyS.type = "button";
					applyS.addEventListener("click", function () {
						var v = parseInt(sel.value, 10);
						setDotPath(it.varPath, v);
						refreshCur();
						setStatus(it.name + " → " + sel.value, "mce-ok");
					});
					row.appendChild(sel); row.appendChild(applyS);
				}
			} else if (it.type === "action") {
				var act = el("button", "mce-btn mce-gold", it.name);
				act.type = "button";
				act.addEventListener("click", function () {
					setStatus(applyRolePlotAction(it.action), "mce-ok");
					if (it.action === "kylarSeen") {
						var cv = getDotPath("kylarSeen");
						curBadge.textContent = "当前: " + (Array.isArray(cv) ? cv.length + " 项标记" : "未设置");
					}
				});
				row.appendChild(act);
			} else if (it.type === "info") {
				row.appendChild(el("span", "mce-note", it.note));
			}
			body.appendChild(row);
			body.appendChild(el("div", "mce-note", it.note));
		});
		block.appendChild(body);
		return block;
	}
	function renderSceneCluster(container, keys2, defs) {
		var replaying = !!(getV() && getV().replayScene); /* v1.9.30 直达触发：播放中禁用 */
		var defsSub = {};
		keys2.forEach(function (k) { defsSub[k] = defs[k]; });
		var cluster = listSceneLines(defsSub);
		var lineTotal = cluster.lines.length, singleTotal = cluster.singles.length;
		var lineDone = 0;
		cluster.lines.forEach(function (line) {
			var done = line.items.filter(function (it) { return sceneStatus(it.def).state === "pass"; }).length;
			lineDone += done;
			var block = el("div", "mce-stage");
			var head = el("div", "mce-stage-head mce-line-head");
			head.appendChild(el("span", "mce-dot", ""));
			var stages = el("div", "mce-stages");
			stages.style.display = "none"; /* v1.3：剧情线默认收起（合在一起不展开），点线头展开 */
			head.appendChild(el("span", "mce-stage-name", "剧情线「" + (line.items[0].def.name || line.prefix) + "」系列　已达成 " + done + " / " + line.items.length + "　（" + line.items.length + " 个阶段，收起）"));
			/* 锚定整线（v1.9.23）：已标注触发地点的阶段按顺序入队，走到地点交互时依次触发，触发完自动完成 */
			var linePin = el("button", "mce-btn", "锚定整线");
			linePin.type = "button";
			linePin.title = "把本系列全部阶段按顺序锚定：走到各阶段发生地点交互时弹确认条，触发完自动完成";
			(function (line2) {
				linePin.addEventListener("click", function () {
					var pr = pinSceneLine(line2);
					setStatus(pr.message, pr.ok ? "mce-ok" : "mce-err");
					renderScenes();
				});
			})(line);
			head.appendChild(linePin);
			/* 展开/收起切换 */
			var tog = el("button", "mce-btn mce-gold", "展开各阶段");
			tog.type = "button";
			tog.title = "展开查看本线各阶段，可对单阶段锚定/取消锚定/一键完成";
			tog.addEventListener("click", function () {
				var open = stages.style.display === "none";
				stages.style.display = open ? "" : "none";
				tog.textContent = open ? "收起各阶段" : "展开各阶段";
				var nm = head.querySelector(".mce-stage-name");
				if (nm) { nm.textContent = "剧情线「" + (line.items[0].def.name || line.prefix) + "」系列　已达成 " + done + " / " + line.items.length + "　（" + line.items.length + " 个阶段，" + (open ? "展开" : "收起") + "）"; }
			});
			head.appendChild(tog);
			block.appendChild(head);
			line.items.forEach(function (it) {
				var st = sceneStatus(it.def);
				var completed = isSceneCompleted(it.key);
				var done = st.state === "pass" || completed;
				var srow = el("div", "mce-stage " + (done ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
				var sh = el("div", "mce-stage-head");
				sh.appendChild(el("span", "mce-dot", ""));
				var nm = it.def.name || it.key;
				sh.appendChild(el("span", "mce-stage-name", "阶段 " + it.num + "　" + nm));
				/* 锚定触发 / 取消锚定（v1.9.23）：走到地点交互时弹确认条；无地点元数据暂不可锚定 */
				var pi = pinQueueIndex(it.key);
				var anchorMeta = sceneAnchorMeta(it.key, it.def);
				if (pi >= 0) {
					sh.appendChild(el("span", "mce-badge mce-on", "已锚定 第" + (pi + 1) + "位"));
					var unpinB = el("button", "mce-btn mce-red", "取消锚定");
					unpinB.type = "button";
					unpinB.title = "取消该剧情的锚定，恢复原版随机触发";
					(function (it2) {
						unpinB.addEventListener("click", function () {
							var was = unpinScene(it2.key);
							setStatus(was ? "已取消锚定：「" + (it2.def.name || it2.key) + "」" : "该剧情不在锚定队列中", "mce-ok");
							renderScenes();
						});
					})(it);
					sh.appendChild(unpinB);
				} else {
					var pinB = el("button", "mce-btn", "锚定");
					pinB.type = "button";
					if (anchorMeta && anchorMeta.location) {
						pinB.title = "锚定此剧情：走到触发地点「" + locLabel(anchorMeta.location) + "」" + (anchorMeta.timeNote ? "（时间 " + anchorMeta.timeNote + "）" : "") + "并交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
					} else {
						pinB.disabled = true;
						pinB.title = "该剧情未标注触发地点，暂不可锚定";
					}
					(function (it2) {
						pinB.addEventListener("click", function () {
							var pr = pinScene(it2);
							setStatus(pr.message, pr.ok ? "mce-ok" : "mce-err");
							renderScenes();
						});
					})(it);
					sh.appendChild(pinB);
				}
				if (st.state === "pass") {
					sh.appendChild(el("span", "mce-badge mce-on", "已达成"));
				} else if (completed) {
					sh.appendChild(el("span", "mce-badge mce-on", "已完成 ✓"));
				} else {
					var btn = el("button", "mce-btn mce-gold", "一键完成");
					btn.type = "button";
					btn.title = "把该场景所有段落与解锁条件写入经历表（scenePassages）";
					(function (it2, st2) {
						btn.addEventListener("click", function () {
							var res = completeScene(it2.def);
							setStatus("「" + (it2.def.name || it2.key) + "」" + (res.ok ? "已解锁" : "未解锁：" + res.note), res.ok ? "mce-ok" : "mce-err");
							renderScenes();
						});
					})(it, st);
					sh.appendChild(btn);
				}
				/* v1.9.30 直达触发：跳过地点判定/确认条，点即开始播放（复用 startAnchoredReplay 出口清理） */
				var dtB = el("button", "mce-btn", "直达触发");
				dtB.type = "button";
				if (replaying) {
					dtB.disabled = true;
					dtB.title = "正在播放剧情，请先结束当前播放";
				} else if (!it.def.startPassage) {
					dtB.disabled = true;
					dtB.title = "该剧情无入口段落，无法直达";
				} else {
					dtB.title = "直达触发此剧情：立即开始播放，播完自动回原位并标「已完成 ✓」（不改写剧情达成标记）";
				}
				(function (it2) {
					dtB.addEventListener("click", function () {
						var r = directTriggerScene(it2.key);
						setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
						renderScenes();
					});
				})(it);
				sh.appendChild(dtB);
				srow.appendChild(sh);
				var note = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
				srow.appendChild(el("div", "mce-stage-txt", note + (st.note || "（无说明）")));
				srow.appendChild(el("div", "mce-stage-note", "段落数 " + (it.def.passages || []).length + (it.def.startPassage ? "　入口 " + it.def.startPassage : "") + "　键 " + it.key));
				/* v1.9.26：已锚定时在条目下方直接显示触发地点提示（手机版无 hover，tooltip 看不了） */
				if (pi >= 0 && anchorMeta && anchorMeta.location) {
					srow.appendChild(el("div", "mce-stage-note", "▸ 触发地点：「" + locLabel(anchorMeta.location) + "」" + (anchorMeta.timeNote ? "（时间 " + anchorMeta.timeNote + "）" : "") + "　走到该地点交互时弹确认条"));
				}
				stages.appendChild(srow);
			});
			block.appendChild(stages);
			container.appendChild(block);
		});
		if (singleTotal) {
			var sblock = el("div", "mce-stage");
			var sHead = el("div", "mce-stage-head");
			/* v1.9.4-自检：sHead 曾只挂一个 span（mce-stage-name），实测被第三方 UI 模组
			   改写为文本 [object HTMLSpanElement]；改为「mce-dot + mce-stage-name」双 span 后
			   新包实测仍被改写（16 处）——外部脚本非按子元素数量判断。
			   现改为纯文本（head 无子元素，外部脚本无元素可对象化），并辅以渲染后延迟兜底修复。 */
			sHead.textContent = "独立场景（未聚合成线）";
			sblock.appendChild(sHead);
			var sstages = el("div", "mce-stages");
			cluster.singles.forEach(function (it) {
				var st = sceneStatus(it.def);
				var srow = el("div", "mce-stage " + (st.state === "pass" ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
				var sh = el("div", "mce-stage-head");
				sh.appendChild(el("span", "mce-dot", ""));
				sh.appendChild(el("span", "mce-stage-name", it.def.name || it.key));
				/* 锚定触发 / 取消锚定（v1.9.23）：走到地点交互时弹确认条；无地点元数据暂不可锚定 */
				var piS = pinQueueIndex(it.key);
				if (piS >= 0) {
					sh.appendChild(el("span", "mce-badge mce-on", "已锚定 第" + (piS + 1) + "位"));
					var unpinS = el("button", "mce-btn mce-red", "取消锚定");
					unpinS.type = "button";
					unpinS.title = "取消该剧情的锚定，恢复原版随机触发";
					(function (it2) {
						unpinS.addEventListener("click", function () {
							var was = unpinScene(it2.key);
							setStatus(was ? "已取消锚定：「" + (it2.def.name || it2.key) + "」" : "该剧情不在锚定队列中", "mce-ok");
							renderScenes();
						});
					})(it);
					sh.appendChild(unpinS);
				} else {
					var anchorMetaS = sceneAnchorMeta(it.key, it.def);
					var pinS = el("button", "mce-btn", "锚定");
					pinS.type = "button";
					if (anchorMetaS && anchorMetaS.location) {
						pinS.title = "锚定此剧情：走到触发地点「" + locLabel(anchorMetaS.location) + "」" + (anchorMetaS.timeNote ? "（时间 " + anchorMetaS.timeNote + "）" : "") + "并交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
					} else {
						pinS.disabled = true;
						pinS.title = "该剧情未标注触发地点（第一批元数据未覆盖），暂不可锚定";
					}
					(function (it2) {
						pinS.addEventListener("click", function () {
							var pr = pinScene(it2);
							setStatus(pr.message, pr.ok ? "mce-ok" : "mce-err");
							renderScenes();
						});
					})(it);
					sh.appendChild(pinS);
				}
				if (st.state === "pass") {
					sh.appendChild(el("span", "mce-badge mce-on", "已达成"));
				} else {
					var b2 = el("button", "mce-btn mce-gold", "一键完成");
					b2.type = "button";
					(function (it2) {
						b2.addEventListener("click", function () {
							var res = completeScene(it2.def);
							setStatus("「" + (it2.def.name || it2.key) + "」" + (res.ok ? "已解锁" : "未解锁：" + res.note), res.ok ? "mce-ok" : "mce-err");
							renderScenes();
						});
					})(it);
					sh.appendChild(b2);
				}
				/* v1.9.30 直达触发：跳过地点判定/确认条，点即开始播放（复用 startAnchoredReplay 出口清理） */
				var dtS = el("button", "mce-btn", "直达触发");
				dtS.type = "button";
				if (replaying) {
					dtS.disabled = true;
					dtS.title = "正在播放剧情，请先结束当前播放";
				} else if (!it.def.startPassage) {
					dtS.disabled = true;
					dtS.title = "该剧情无入口段落，无法直达";
				} else {
					dtS.title = "直达触发此剧情：立即开始播放，播完自动回原位并标「已完成 ✓」（不改写剧情达成标记）";
				}
				(function (it2) {
					dtS.addEventListener("click", function () {
						var r = directTriggerScene(it2.key);
						setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
						renderScenes();
					});
				})(it);
				sh.appendChild(dtS);
				/* v1.9.23：锚定播放完成 → 「已完成 ✓」（区别于 scenePassages 达成绿标；可再自由锚定） */
				if (isSceneCompleted(it.key)) { sh.appendChild(el("span", "mce-badge mce-on", "已完成 ✓")); }
				srow.appendChild(sh);
				var note2 = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
				srow.appendChild(el("div", "mce-stage-txt", note2 + (st.note || "（无说明）")));
				sstages.appendChild(srow);
			});
			sblock.appendChild(sstages);
			container.appendChild(sblock);
		}
		if (!cluster.lines.length && !cluster.singles.length) {
			container.appendChild(el("div", "mce-hint", "本分组无场景。"));
		} else {
			container.appendChild(el("div", "mce-hint", "剧情线 " + lineTotal + " 条（已达成 " + lineDone + "），独立场景 " + singleTotal + " 个。"));
		}
	}
	function renderScenes() {
		var pane = root.querySelector('[data-pane="scenes"]');
		var keepScroll = typeof pane.scrollTop === "number" ? pane.scrollTop : 0; /* v1.9.4：重建后保持滚动位置（锚定/取消锚定/一键完成后不跳回顶部） */
		pane.textContent = "";
		/* v1.9.4：折叠组展开状态键「剧情:<组名>」（与角色页「角色:<cat>」同语义、互不冲突），
		   展开状态持久化到 mbCEUiState.collapsed——操作后 renderScenes() 重建不再全部收回去 */
		/* 使用提示（v1.9.4-自检）：与修复后行为一致（触发一次自动停止、退出场景返回原位，不再被困） */
		pane.appendChild(el("div", "mce-warn", "使用提示：锚定剧情后，走到该剧情发生地点并交互时会弹确认条（含地点/时间/前置说明），确认后触发、播放完标「已完成 ✓」；「暂不触发」保留待下次。旧「固定触发」已移除，「一键完成」「场景直达」保留；若需恢复原版随机触发，点顶部横幅「清空队列」即可。"));
		/* 锚定触发状态横幅（v1.9.23：队列，显示全部未触发项） */
		var pinnedBanner = getPinnedScene();
		if (pinnedBanner && pinnedBanner.length) {
			var banner = el("div", "mce-stage mce-pass");
			var bh = el("div", "mce-stage-head");
			bh.appendChild(el("span", "mce-dot", ""));
			var names = pinnedBanner.map(function (p) { return "「" + p.name + "」"; }).join("、");
			bh.appendChild(el("span", "mce-stage-name", "锚定触发队列（" + pinnedBanner.length + "）：" + names + " —— 到对应地点交互时弹确认条触发，触发完自动完成"));
			var unBtn = el("button", "mce-btn mce-red", "清空队列（取消全部锚定）");
			unBtn.type = "button";
			unBtn.title = "取消全部锚定触发，恢复原版随机触发；若正在重放则立即解冻并返回原位";
			unBtn.addEventListener("click", function () {
				var was = unpinScene();
				setStatus(was ? "已回退：清空锚定触发队列，恢复原版随机触发" : "未处于锚定触发状态", "mce-ok");
				renderScenes();
			});
			bh.appendChild(unBtn);
			banner.appendChild(bh);
			pane.appendChild(banner);
		}
		var r = getScenesDefs();
		if (!Object.keys(r.defs).length) {
			pane.appendChild(el("div", "mce-err", "未读取到场景注册表（$scenes）。"));
			pane.appendChild(el("div", "mce-hint", "说明：本页读取游戏「场景查看器（Scene Viewer）」的注册表。请先在游戏菜单打开一次「场景」页面后返回；MOD 通过场景系统注册的剧情会随注册表自动出现。"));
			return;
		}
		pane.appendChild(el("div", "mce-hint", "已读取场景注册表 " + Object.keys(r.defs).length + " 条" + (r.live ? "（实时求值解锁条件）" : "（读取存档缓存值）") + "。原版剧情按角色分组，MOD 注册剧情单独一组。绿色=已达成，红色=未达成，黄色=锁定/互斥提示。"));
		var allKeys = Object.keys(r.defs);
		var vanillaKeys = allKeys.filter(function (k) { return isVanillaSceneKey(k); });
		var modKeys = allKeys.filter(function (k) { return !isVanillaSceneKey(k); });
		renderSceneRegion(pane, "原版剧情（游戏本体注册，" + vanillaKeys.length + " 场景）", vanillaKeys, r.defs, true);
		renderSceneRegion(pane, "MOD 剧情（第三方模组注册，" + modKeys.length + " 场景）", modKeys, r.defs, false);
		/* 分区渲染：原版按角色分组（sceneRoleOf），MOD 单组 */
		/* v2.0.0.002：renderSceneRegion 已拆到 07h-render3.js（C3 全库单文件 ≤400 行）。 */
		/* 剧情进度控制块（任务三）：渲染 EXTRA_ROLE_PLOTS 条目，行内应用不重建整组 */
		
		
		if (typeof pane.scrollTop === "number") { pane.scrollTop = keepScroll; } /* v1.9.4：重建后保持滚动位置 */
		/* v1.9.4-自检：防御第三方 UI 模组在 CE 渲染后对「无按钮纯文本 head」的对象化改写
		   （实测 sHead 被改成 [object HTMLSpanElement]，双 span 结构亦未能幸免）。
		   延迟校验：仅修复「文本为对象化串且无按钮」的 head（即 sHead，line/sh 均有按钮不命中）。
		   v1.9.5-自检：单定时器（清旧设新）——渲染频繁重建时旧闭包不再扫描已脱离的旧 pane。 */
		if (sHeadGuardTimer) { clearTimeout(sHeadGuardTimer); }
		sHeadGuardTimer = setTimeout(function () {
			var bad = pane.querySelectorAll(".mce-stage-head");
			for (var bi = 0; bi < bad.length; bi++) {
				var bt = bad[bi].textContent || "";
				/* v1.9.5-自检：覆盖对象化文本全形态（HTMLSpanElement 实测 16 处；HTMLDivElement/HTMLHeadingElement/HTMLButtonElement/Object 同源防御） */
				if (/^\[object (HTMLSpanElement|HTMLDivElement|HTMLHeadingElement|HTMLButtonElement|Object)\]$/.test(bt.trim()) && !bad[bi].querySelector("button")) {
					bad[bi].textContent = "独立场景（未聚合成线）";
				}
			}
		}, 800);
	}

	/* ---- 全局页 ---- */
/* 职责：剧情页分区渲染（renderSceneRegion） */
	function renderSceneRegion(pane2, title, keys, defs, byRole) {
		if (!keys.length) { return; }
		pane2.appendChild(el("div", "mce-section", title));
		var sub = {};
		keys.forEach(function (k) { var role = byRole ? sceneRoleOf(k) : "全部 MOD 场景"; (sub[role] = sub[role] || []).push(k); });
		Object.keys(sub).sort().forEach(function (role) {
			if (byRole) {
				/* v1.9.4：角色/地点分组默认收起 + 懒渲染——收起只建组标题，展开才补建该组全部场景
				   与剧情进度块（用户要求：按角色/地点所属合在一起，不要全部平铺太长）；展开状态持久化 */
				var g = el("div", "mce-grp");
				g.setAttribute("data-tcat", role);
				var gh = el("div", "mce-grp-t mce-collapse-head");
				gh.title = "点击展开/收起该分组场景（懒渲染：展开时才构建场景控件）";
				var open0 = sceneStored(role) === 0;
				gh.textContent = (open0 ? "▾" : "▸") + role + "（" + sub[role].length + " 场景）";
				g.appendChild(gh);
				var gb = el("div", "mce-grp-body");
				gb.setAttribute("data-collapsed", open0 ? "0" : "1");
				if (open0) {
					renderSceneCluster(gb, sub[role], defs);
					/* 任务三（v1.9.2）：非场景注册表的剧情进度控制，按角色收纳在本组尾部 */
					var plots = getRolePlots(role);
					if (plots) { gb.appendChild(renderRolePlots(plots)); }
				}
				gh.addEventListener("click", function () {
					var nowOpen = gb.getAttribute("data-collapsed") === "0";
					gb.setAttribute("data-collapsed", nowOpen ? "1" : "0");
					gh.textContent = (nowOpen ? "▸" : "▾") + role + "（" + sub[role].length + " 场景）";
					if (!nowOpen && !gb.querySelector(".mce-stage")) {
						renderSceneCluster(gb, sub[role], defs);
						var plots = getRolePlots(role);
						if (plots) { gb.appendChild(renderRolePlots(plots)); }
					}
					sceneSet(role, nowOpen ? 1 : 0);
				});
				g.appendChild(gb);
				pane2.appendChild(g);
			} else {
				/* v1.9.2 自查：MOD 场景区懒渲染折叠——收起只建标题，展开才补建全部 MOD 场景，
				   避免 MOD 场景多时每次切剧情页全量建 DOM 卡顿（用户历史痛点：展开过多卡住/闪退）；
				   v1.9.4：展开状态持久化 */
				var mWrap = el("div", "mce-grp");
				mWrap.setAttribute("data-tcat", "MOD 场景");
				var mHead = el("div", "mce-grp-t mce-collapse-head");
				mHead.title = "点击展开/收起全部 MOD 场景（懒渲染：展开时才构建场景控件）";
				var mOpen0 = sceneStored("MOD") === 0;
				mHead.textContent = (mOpen0 ? "▾" : "▸") + " 全部 MOD 场景（" + sub[role].length + "）";
				mWrap.appendChild(mHead);
				var mBody = el("div", "mce-grp-body");
				mBody.setAttribute("data-collapsed", mOpen0 ? "0" : "1");
				if (mOpen0) { renderSceneCluster(mBody, sub[role], defs); }
				mHead.addEventListener("click", function () {
					var open = mBody.getAttribute("data-collapsed") === "0";
					mBody.setAttribute("data-collapsed", open ? "1" : "0");
					mHead.textContent = (open ? "▸" : "▾") + " 全部 MOD 场景（" + sub[role].length + "）";
					if (!open && !mBody.querySelector(".mce-stage")) { renderSceneCluster(mBody, sub[role], defs); }
					sceneSet("MOD", open ? 1 : 0);
				});
				mWrap.appendChild(mBody);
				pane2.appendChild(mWrap);
			}
		});
	}
	/* 职责：言灵页（07i）核心 —— 存档状态读写 / window.isCrossdressing 钩子装卸 / 三项存量净化 / 开关与 1s 守卫定时器。渲染见 07i-yanling-page.js，一键动作见 07i-yanling-actions.js。 */
	/* ============ 言灵页（v2.0.0.006）：NPC 无视着装性别 / 异装残留净化 / 负面名声清零 ============
	   诉求（好友走全正面线）：给 PC 穿好看的异性服装，不触发异装判定、不涨异装癖、不产生学校异装负面名声。

	   实现依据（DoL 0.5.12.13 逐行取证，均可复跑核对）：
	     ① 判定入口 isCrossdressing() 72520-72536：
	        getVisibleClothesList().some(item => ["f","m"].includes(item.gender) && item.gender !== V.player.sex
	        && item.gender === V.player.gender_appearance) && !isGenitalMismatch()
	        末尾 `window.isCrossdressing = isCrossdressing;` → 本页据此做运行期覆盖（幂等、可重装、可卸载）。
	        作用域实证：声明位于 SugarCube <script>（twine-user-script，最近 <script> 起点 68457）编译域内，
	        函数声明不泄漏到全局词法作用域，所以两处调用路径都必须经 window 才够得着本函数。
	        全文 49 行命中 isCrossdressing：twee 侧 45 处 `<<if / <<elseif isCrossdressing()>>`、
	        JS 内裸调用仅 1 处（isHermOrCrossdresser 72548）、其余 3 行为声明与注释。
	        （314549 / 314554 的「裸调用」其实是 <<switch>> 内事件文本里的 SugarCube `is` 语法，不是 JS 调用。）
	        覆盖 window 即覆盖 45 处 twee 判定；72548 保持原版 herm / 外观语义（见下 ④ 与面板边界 ①）。
	     ② 唯一总开关是 $crossdressing 变量，写入点 crossdressing_check 242916-242924：
	        penisExist && vaginaExist → 2；elseif isCrossdressing() → 1；else → 0。
	     ③ 下游全部读 $crossdressing，拦截 isCrossdressing() 使其恒为 0 即全链断开：
	        - 战斗 man widget 243068-243069：$crossdressing gte 1 → exposedcheck + schoolrep_naked
	        - schoolrep_naked 346684-346700：isCrossdressing() → schoolrep crossdress 1（学校负面名声）
	        - 异装癖累积 243201-243208：crossdress 分支内 $crossdressingTrait += 1，满 100 pushUnique("crossdresser")
	        - 换衣间 changingRoomFeelings 668274-668300「You feel naughty.」等 twee 侧 45 处判定点全部经 window 求值
	     ④ 与压力循环解耦：77866-77870 用本地 const isCrossdressing（源码注释明确「不复用函数」，
	        因压力增减不该随 NudeGenderDC 变），故本页拦截不改变 stress 语义。
	     ⑤ 学校名声存量：schoolrep 346656-346682（仅 crossdress / herm 两键）
	        + 文案 V.school_crossdress_message 163371-163391 + 提示 77378 → 清零需一并删文案。
	     ⑥ 城镇名声：V.fame 键取自 306912-306928（sex / prostitution / rape / bestiality / pregnancy /
	        impreg / exhibitionism / scrap / good / business / social / model，另注释保留 pimp），
	        V.fameDecay / V.fameDecayTimer 为衰减队列（77558-77564），清零须同步删队列项。

	   CheatExtend 1.1.3 的「言灵」是 TweeReplacer 对原版 Cheats 面板 widget 的**整块文本替换**，
	   原版文案一改 findString 即失效（用户「时间太久了、有些已不适用」的根因）。
	   本页改为 JS 层运行期钩子 + 变量直写，不依赖任何原版文案，版本升级不会静默失效。 */

	var mbCEYanlingFameNeg = ["sex", "prostitution", "rape", "bestiality", "pregnancy", "impreg", "exhibitionism", "pimp"];

	function mbCEYanlingState() {
		try {
			var V = getV();
			if (!V) { return null; }
			if (!V.mbCE_yanling || typeof V.mbCE_yanling !== "object") {
				V.mbCE_yanling = { noCross: false, noTrait: false };
			}
			V.mbCE_yanling.noCross = V.mbCE_yanling.noCross === true;
			V.mbCE_yanling.noTrait = V.mbCE_yanling.noTrait === true;
			return V.mbCE_yanling;
		} catch (e) { return null; }
	}
	/* 只读状态：isCrossdressing() 每秒被高频调用，绝不能在未启用时创建存档变量 */
	function mbCEYanlingRead() {
		try {
			var V = getV();
			if (!V || !V.mbCE_yanling || typeof V.mbCE_yanling !== "object") { return null; }
			return V.mbCE_yanling;
		} catch (e) { return null; }
	}
	function mbCEYanlingNoCross() {
		var s = mbCEYanlingRead();
		/* 严格比较：手改存档写进字符串 "false" 时不能被真值判定当成开启 */
		return !!(s && s.noCross === true);
	}
	function mbCEYanlingTrace(op, before, after) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["yanling:" + op] = { type: "yanling", modId: "vanilla", op: op, before: before, after: after, t: Date.now() };
		} catch (e) {}
	}

	/* 运行期覆盖 window.isCrossdressing（幂等）：已装则跳过；被第三方重包则以新函数为上游重新包裹。
	   钩子内部每次调用都现读 V.mbCE_yanling.noCross —— 读档前装、读档后同样生效。
	   上游函数单独保存：关闭开关时可原样还原（见 mbCEYanlingUninstall）。 */
	var mbCEYanlingHookFn = null;
	var mbCEYanlingUpstream = null;
	function mbCEYanlingInstall() {
		try {
			if (typeof window === "undefined") { return false; }
			var cur = window.isCrossdressing;
			if (typeof cur !== "function") { return false; }
			if (cur === mbCEYanlingHookFn) { return true; }
			var upstream = cur;
			mbCEYanlingUpstream = upstream;
			/** @this {any} */
			mbCEYanlingHookFn = function () {
				try {
					if (mbCEYanlingNoCross()) { return false; }
				} catch (e) {}
				return upstream.apply(/** @type {any} */ (this), /** @type {any} */ (arguments));
			};
			window.isCrossdressing = mbCEYanlingHookFn;
			return true;
		} catch (e) { return false; }
	}
	/* 卸载：只在 window 上仍是本页钩子时还原上游，绝不覆盖已被第三方替换的函数。
	   意义有二：① 关闭开关后不留无谓包装层；② 若第三方把本页钩子当上游包进自己的链，
	   关闭时拆掉最外层即可断开，避免「我方→第三方→我方」无限递归。 */
	function mbCEYanlingUninstall() {
		try {
			if (typeof window === "undefined") { return false; }
			if (!mbCEYanlingHookFn) { return true; }
			if (window.isCrossdressing === mbCEYanlingHookFn && typeof mbCEYanlingUpstream === "function") {
				window.isCrossdressing = mbCEYanlingUpstream;
			}
			mbCEYanlingHookFn = null;
			mbCEYanlingUpstream = null;
			return true;
		} catch (e) { return false; }
	}
	/* 按开关状态同步钩子：开 → 挂，关 → 卸载。所有自动路径（tick / 定时器 / 面板）只用它，
	   不直接调 Install，否则「关闭状态也挂着钩子」，与 Uninstall 语义冲突。 */
	function mbCEYanlingSync() {
		if (mbCEYanlingNoCross()) { return mbCEYanlingInstall(); }
		mbCEYanlingUninstall();
		return true;
	}

	/* 存量净化：$crossdressing / 学校异装名声 / 学校异装文案 */
	function mbCEYanlingPurgeCross() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = {
				crossdressing: V.crossdressing,
				schoolrep: (V.schoolrep && typeof V.schoolrep === "object") ? V.schoolrep.crossdress : undefined,
				message: V.school_crossdress_message
			};
			if (typeof V.crossdressing === "number" && V.crossdressing !== 0) { V.crossdressing = 0; }
			if (V.schoolrep && typeof V.schoolrep === "object" && V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; }
			if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			mbCEYanlingTrace("purge_cross", before, { crossdressing: 0, schoolrep: 0, message: null });
			return { ok: true, msg: "已清空异装判定与学校异装名声" };
		} catch (e) { return { ok: false, msg: "净化异常：" + mbCEErr(e) }; }
	}
	/* 存量净化：异装癖进度 + crossdresser 背景特质 */
	function mbCEYanlingPurgeTrait() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { trait: V.crossdressingTrait, has: false };
			var arr = V.backgroundTraits;
			if (arr && typeof arr.indexOf === "function") { before.has = arr.indexOf("crossdresser") !== -1; }
			if (typeof V.crossdressingTrait === "number" && V.crossdressingTrait !== 0) { V.crossdressingTrait = 0; }
			if (arr && typeof arr.indexOf === "function") {
				var i = arr.indexOf("crossdresser");
				while (i !== -1) { arr.splice(i, 1); i = arr.indexOf("crossdresser"); }
			} else if (arr && typeof arr.delete === "function") {
				arr.delete("crossdresser");
			}
			mbCEYanlingTrace("purge_trait", before, { trait: 0, has: false });
			return { ok: true, msg: "已清空异装癖进度并移除 Crossdresser 特质" };
		} catch (e) { return { ok: false, msg: "净化异常：" + mbCEErr(e) }; }
	}
	/* 负面名声清零：学校 crossdress / herm 双键 + 学校文案 + 城镇 fame 负面项与衰减队列 */
	function mbCEYanlingPurgeFame() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { schoolrep: {}, fame: {} }, n = 0, ns = 0, k;
			if (V.schoolrep && typeof V.schoolrep === "object") {
				before.schoolrep = { crossdress: V.schoolrep.crossdress, herm: V.schoolrep.herm };
				if (V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; ns++; }
				if (V.schoolrep.herm !== 0) { V.schoolrep.herm = 0; ns++; }
			}
			if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			if (V.school_herm_message !== undefined) { delete V.school_herm_message; }
			for (var i = 0; i < mbCEYanlingFameNeg.length; i++) {
				k = mbCEYanlingFameNeg[i];
				if (V.fame && typeof V.fame === "object" && typeof V.fame[k] === "number" && V.fame[k] !== 0) {
					before.fame[k] = V.fame[k];
					V.fame[k] = 0;
					n++;
				}
				if (V.fameDecay && typeof V.fameDecay === "object" && V.fameDecay[k] !== undefined) { delete V.fameDecay[k]; }
				if (V.fameDecayTimer && typeof V.fameDecayTimer === "object" && V.fameDecayTimer[k] !== undefined) { delete V.fameDecayTimer[k]; }
			}
			mbCEYanlingTrace("purge_fame", before, { cleared: n });
			return { ok: true, msg: "负面名声已清零（学校 " + ns + " 项 + 城镇 " + n + " 项）" };
		} catch (e) { return { ok: false, msg: "净化异常：" + mbCEErr(e) }; }
	}

	/* 正面名声拉满（v2.0.3）：V.fame 的正面 5 项各写 2000。
	   0.5.12.13 实证上限：290894 / 290895 对 good / business 用 `Math.clamp($fame.x, 0, 2000)`；
	   306924-306928 原版设置页 numberStepper 也把 Combat(scrap) / Kindness(good) / Business / Socialite(social) / Model 的 max 定为 2000。
	   pregnancy 不写：其上限是动态的 `Math.clamp(playerNormalPregnancyTotal(),1,8) * 250`（306916），写死会造出与实孕不符的名声。 */
	var mbCEYanlingFamePos = ["good", "business", "scrap", "social", "model"];
	function mbCEYanlingMaxFame() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			if (!V.fame || typeof V.fame !== "object") { return { ok: false, msg: "本存档无 $fame 对象（原版 182504-182518 初始化）" }; }
			var before = {}, n = 0;
			for (var i = 0; i < mbCEYanlingFamePos.length; i++) {
				var k = mbCEYanlingFamePos[i];
				before[k] = V.fame[k];
				if (V.fame[k] !== 2000) { V.fame[k] = 2000; n++; }
			}
			mbCEYanlingTrace("max_fame", before, { good: 2000, business: 2000, scrap: 2000, social: 2000, model: 2000 });
			return { ok: true, msg: "正面名声已拉满（good / business / scrap / social / model 各 2000，实际改写 " + n + " 项）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 守卫：开关开启期间每秒把存量压回 0（防读档后残留、防战斗/舞蹈中途恢复判定）。
	   全部包在 try 内 —— 回调里的任何异常都不能每秒抛一次（见 ui-tick-refresh-scope-guard）。 */
	function mbCEYanlingTick() {
		try {
			var st = mbCEYanlingRead();
			if (!st || (st.noCross !== true && st.noTrait !== true)) {
				/* 两个开关都未开启：立即停表。守卫定时器不该在没人用时空转
				   （Node/jsdom 里常驻 interval 会阻止进程退出，冒烟测试将永远不返回）。 */
				if (mbCEYanlingTimer) { clearInterval(mbCEYanlingTimer); mbCEYanlingTimer = null; }
				return;
			}
			mbCEYanlingSync();
			var V = getV();
			if (!V) { return; }
			if (st.noCross === true) {
				if (typeof V.crossdressing === "number" && V.crossdressing !== 0) { V.crossdressing = 0; }
				if (V.schoolrep && typeof V.schoolrep === "object" && typeof V.schoolrep.crossdress === "number" && V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; }
				if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			}
			if (st.noTrait === true) {
				if (typeof V.crossdressingTrait === "number" && V.crossdressingTrait !== 0) { V.crossdressingTrait = 0; }
				var arr = V.backgroundTraits;
				if (arr && typeof arr.indexOf === "function" && arr.indexOf("crossdresser") !== -1) { arr.splice(arr.indexOf("crossdresser"), 1); }
			}
		} catch (e) {}
	}
	/** @type {any} 浏览器里是 number，Node/jsdom 里是 Timeout（带 unref） */
	var mbCEYanlingTimer = null;
	function mbCEYanlingEnsureTimer() {
		try {
			/* 只有开关真的开着才起表：没人用时不占事件循环（浏览器里也省一个空转 1s 定时器） */
			var st = mbCEYanlingRead();
			mbCEYanlingSync();
			if (!st || (st.noCross !== true && st.noTrait !== true)) { return; }
			if (mbCEYanlingTimer || typeof setInterval !== "function") { return; }
			mbCEYanlingTimer = setInterval(mbCEYanlingTick, 1000);
			/* Node/jsdom：unref 让守卫定时器不阻止进程退出（浏览器 interval 是数字，没有 unref） */
			try { if (mbCEYanlingTimer && typeof mbCEYanlingTimer.unref === "function") { mbCEYanlingTimer.unref(); } } catch (eU) {}
		} catch (e) {}
	}

	/* 开关动作（写状态 + 立即执行一次 + 留痕） */
	function mbCEYanlingToggle(field) {
		try {
			/* 白名单：本函数对外暴露在 mountApi 上，控制台误传字段会往存档里写垃圾键 */
			if (field !== "noCross" && field !== "noTrait") { return { ok: false, msg: "未知开关：" + String(field) }; }
			var st = mbCEYanlingState();
			if (!st) { return { ok: false, msg: "存档变量不可用" }; }
			var on = !st[field];
			st[field] = on;
			mbCEYanlingEnsureTimer();
			if (field === "noCross") {
				mbCEYanlingSync();
				if (on) { mbCEYanlingPurgeCross(); }
			}
			if (field === "noTrait" && on) { mbCEYanlingPurgeTrait(); }
			mbCEYanlingTrace("toggle_" + field, !on, on);
			var label = field === "noCross" ? "无视着装性别" : "压制异装癖";
			return { ok: true, msg: label + (on ? " 已开启" : " 已关闭") };
		} catch (e) { return { ok: false, msg: "切换异常：" + mbCEErr(e) }; }
	}

	/* 职责：言灵页（07i）一键动作 —— 衣物湿度与耐久 / 体液与精神 / 数值快补 / 天气 / NPC state 层（按原版语义直写）。 */
	/* ==================== 扩容轮：一次性写入动作（对照 CheatExtend 1.1.3「快捷言灵」逐条取证后补入） ====================
	   取证口径（DoL 0.5.12.13 原版 HTML，行号可复跑）：
	     · 衣物湿度 $upperwet/$lowerwet/$underupperwet/$underlowerwet 初始化 182261-182267、debug 写 60670-60682
	     · 衣物耐久 $worn.{upper,lower,under_upper,under_lower}.integrity（debug 60670-60698；上限由 clothingData(slot,item,"integrity_max") 给出，163772）
	     · 精液 $semen_volume/$semen_amount 初始化 183097-183101（默认 90）
	     · 控制 $control（0=被夺舍，满 1000）、幻觉 $hallucinogen 初始化 182681
	     · 施虐/受虐 $sadism/$masochism 初始化 182086-182088，钳制 0-1000（290866）
	     · 奶量 $milk_volume/$milk_max 初始化 182101-182102（30/3000），每日钳制 [24, milk_max]（290800）
	     · 成就 $feats.locked 原版为布尔 true=锁定（182929 / 191755 判定 isnot true）
	     · 天气 0.5 起迁到 $weatherObj：旧 $weather 是兼容旧档的一次性变量（190009-190032 读完即 unset），
	       本页改写 window.setWeather(type, true)（定义 87136-87167，类型表 85185-85407 共 7 档）
	     · 农场 $farm.clearing（0=已清完，305858；清场写 0 见 305874）、堆肥 $fertiliser.current（105354 ++）
	     · 种子 window.unlockAllSeeds()（定义 76431）、罗宾存款 $robinmoney（初始 300）、
	       艾弗里约会 $averydate（59740 约会日置 1）、校长办公室密码 $headpasswordknown（674077）
	     · 角色状态 C.npc.X.state 实为 V.NPCName[V.NPCNameList.indexOf("X")] 的别名（initCNPC 55579-55595），
	       故本页统一走 V.NPCName[index]，不依赖全局 C。
	   键存活结论（原版实测）：上述键全部命中；另有两个 CheatExtend 条目在本版是死键，**不实现**——
	     $NPCName[28].lust（全库 0 命中，CE 原文写 += 0 等于空转）、世扩转化 6 条（$ghost/$slime/$transformationParts.* 全库 0 命中，属第三方世扩模组键）。 */

	function mbCEYanlingErr(e) { return (e && e.message) ? e.message : String(e); }

	/* 数字写：键不存在（undefined）时按"该档无此键"跳过，绝不硬建存档垃圾键 */
	function mbCEYanlingSetNum(obj, key, val) {
		if (!obj || typeof obj !== "object") { return false; }
		if (obj[key] === undefined) { return false; }
		if (typeof obj[key] !== "number") { return false; }
		if (obj[key] === val) { return false; }
		obj[key] = val;
		return true;
	}

	/* 一键烘干：4 项湿度归零 */
	function mbCEYanlingDryClothes() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var keys = ["upperwet", "lowerwet", "underupperwet", "underlowerwet"], before = {}, n = 0, i, k;
			for (i = 0; i < keys.length; i++) {
				k = keys[i];
				before[k] = V[k];
				if (V[k] === undefined) { V[k] = 0; n++; }
				else if (typeof V[k] === "number" && V[k] !== 0) { V[k] = 0; n++; }
			}
			mbCEYanlingTrace("dry_clothes", before, { wet: 0 });
			return { ok: true, msg: "已烘干（" + n + " 项湿度归零）" };
		} catch (e) { return { ok: false, msg: "烘干异常：" + mbCEYanlingErr(e) }; }
	}

	/* 单件衣物耐久上限：优先衣着对象自带 integrity_max，其次 clothingData，再退回"当前 +1000" */
	function mbCEYanlingWornMax(slot, w) {
		if (w && typeof w.integrity_max === "number" && w.integrity_max > 0) { return w.integrity_max; }
		try {
			if (typeof window !== "undefined" && typeof window.clothingData === "function") {
				var m = window.clothingData(slot, w, "integrity_max");
				if (typeof m === "number" && m > 0) { return m; }
			}
		} catch (e) {}
		return null;
	}
	function mbCEYanlingRepairClothes() {
		try {
			var V = getV();
			if (!V || !V.worn || typeof V.worn !== "object") { return { ok: false, msg: "存档变量不可用" }; }
			var slots = ["upper", "lower", "under_upper", "under_lower"], before = {}, n = 0, i, slot, w, cur, max, target;
			for (i = 0; i < slots.length; i++) {
				slot = slots[i];
				w = V.worn[slot];
				if (!w || typeof w !== "object" || !w.name || w.name === "naked") { continue; }
				cur = Number(w.integrity);
				if (!isFinite(cur)) { cur = 0; }
				max = mbCEYanlingWornMax(slot, w);
				target = (max !== null) ? max : (cur + 1000);
				before[slot] = { name: w.name, integrity: cur, max: max };
				if (target !== cur) { w.integrity = target; n++; }
			}
			mbCEYanlingTrace("repair_clothes", before, { repaired: n });
			return { ok: true, msg: "衣物加固完成（" + n + " 件耐久回满；穿着的 naked 槽跳过）" };
		} catch (e) { return { ok: false, msg: "加固异常：" + mbCEYanlingErr(e) }; }
	}

	/* 精液量：与原版 CheatExtend 同序（先补满 amount，再抬 volume） */
	function mbCEYanlingSemen() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var vol = (typeof V.semen_volume === "number") ? V.semen_volume : null;
			var amt = (typeof V.semen_amount === "number") ? V.semen_amount : null;
			if (vol === null || amt === null) { return { ok: false, msg: "本存档无 $semen_volume / $semen_amount 键（不是男性生理档）" }; }
			var before = { volume: vol, amount: amt };
			V.semen_amount = vol;
			V.semen_volume = vol + 1000;
			mbCEYanlingTrace("semen", before, { volume: V.semen_volume, amount: V.semen_amount });
			return { ok: true, msg: "精液量已补满（volume " + before.volume + " → " + V.semen_volume + "，amount → " + V.semen_amount + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 精神：控制拉满 + 幻觉清零 */
	function mbCEYanlingMind() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { control: V.control, hallucinogen: V.hallucinogen }, n = 0;
			if (mbCEYanlingSetNum(V, "control", 1000)) { n++; }
			if (mbCEYanlingSetNum(V, "hallucinogen", 0)) { n++; }
			mbCEYanlingTrace("mind", before, { control: V.control, hallucinogen: V.hallucinogen });
			return { ok: true, msg: "精神状态已恢复（control " + String(before.control) + " → 1000，hallucinogen → 0；改动 " + n + " 项）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 施虐 / 受虐：0-1000（原版 290866 钳制同上限） */
	function mbCEYanlingSadism() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { sadism: V.sadism, masochism: V.masochism }, n = 0;
			if (mbCEYanlingSetNum(V, "sadism", 1000)) { n++; }
			if (mbCEYanlingSetNum(V, "masochism", 1000)) { n++; }
			mbCEYanlingTrace("sadomasochism", before, { sadism: V.sadism, masochism: V.masochism });
			return { ok: true, msg: "施虐 / 受虐已拉满至 1000（改动 " + n + " 项）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 集齐所有种子：走原版 window.unlockAllSeeds()（76431 定义），不自造数据表 */
	function mbCEYanlingSeeds() {
		try {
			if (typeof window === "undefined" || typeof window.unlockAllSeeds !== "function") {
				return { ok: false, msg: "本局未提供 unlockAllSeeds()（游戏脚本未就绪或版本已移除）" };
			}
			window.unlockAllSeeds();
			mbCEYanlingTrace("seeds", null, { called: "unlockAllSeeds" });
			return { ok: true, msg: "已集齐所有种子" };
		} catch (e) { return { ok: false, msg: "调用异常：" + mbCEYanlingErr(e) }; }
	}

	/* 罗宾存款清零 */
	function mbCEYanlingRobinMoney() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			if (typeof V.robinmoney !== "number") { return { ok: false, msg: "本存档无 $robinmoney 键" }; }
			var before = V.robinmoney;
			V.robinmoney = 0;
			mbCEYanlingTrace("robin_money", before, 0);
			return { ok: true, msg: "罗宾存款已清零（原 " + before + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 今晚被艾弗里约：$averydate = 1（原版 308105 判定 is 1 且 hour lte 21） */
	function mbCEYanlingAveryDate() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = V.averydate;
			V.averydate = 1;
			mbCEYanlingTrace("avery_date", before, 1);
			return { ok: true, msg: "已设为今晚艾弗里来约（21 点前到宅邸触发；原 " + String(before) + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 校长办公室密码 */
	function mbCEYanlingHeadPassword() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = V.headpasswordknown;
			V.headpasswordknown = 1;
			mbCEYanlingTrace("head_password", before, 1);
			return { ok: true, msg: "已获知校长办公室密码（原 " + String(before) + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 成就限制解除：原版 $feats.locked 布尔，true=锁定（191755 以 isnot true 判"已解锁"） */
	function mbCEYanlingFeats() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var feats = V.feats;
			if (!feats || typeof feats !== "object") { return { ok: false, msg: "本存档无 $feats 对象" }; }
			var before = feats.locked;
			feats.locked = false;
			mbCEYanlingTrace("feats_locked", before, false);
			return { ok: true, msg: "成就限制已解除（feats.locked " + String(before) + " → false）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 农场：清场 + 堆肥 +5 */
	function mbCEYanlingFarm() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var farm = V.farm, before = { clearing: farm ? farm.clearing : undefined, fertiliser: (V.fertiliser ? V.fertiliser.current : undefined) }, n = 0;
			if (farm && typeof farm === "object" && typeof farm.clearing === "number") {
				if (farm.clearing !== 0) { farm.clearing = 0; n++; }
			}
			if (V.fertiliser && typeof V.fertiliser === "object" && typeof V.fertiliser.current === "number") {
				V.fertiliser.current = V.fertiliser.current + 5; n++;
			}
			mbCEYanlingTrace("farm", before, { clearing: farm ? farm.clearing : null, fertiliser: V.fertiliser ? V.fertiliser.current : null });
			return { ok: true, msg: "农田已清理并补 5 袋堆肥（改动 " + n + " 项；无农场进度时为空转）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 奶量：先抬上限再写当前值（原版 290800 每日钳制到 [24, milk_max]） */
	function mbCEYanlingMilk() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			if (typeof V.milk_max !== "number" || typeof V.milk_volume !== "number") { return { ok: false, msg: "本存档无 $milk_volume / $milk_max 键" }; }
			var before = { volume: V.milk_volume, max: V.milk_max };
			V.milk_max = 10000;
			V.milk_volume = 5000;
			mbCEYanlingTrace("milk", before, { volume: V.milk_volume, max: V.milk_max });
			return { ok: true, msg: "奶量 5000 / 上限 10000（原 " + before.volume + " / " + before.max + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 天气：0.5 起走 window.setWeather（旧 $weather 已被 190032 unset，写它无效） */
	var mbCEYanlingWeatherMap = {
		clear: "晴",
		heavyClouds: "阴云",
		heavyPrecipitation: "大雨 / 大雪",
		thunderstorm: "雷暴"
	};
	function mbCEYanlingWeather(type) {
		try {
			if (typeof window === "undefined" || typeof window.setWeather !== "function") {
				return { ok: false, msg: "本局未提供 setWeather()（0.5 以下旧版或脚本未就绪）" };
			}
			if (!mbCEYanlingWeatherMap[type]) { return { ok: false, msg: "未知天气类型：" + String(type) }; }
			window.setWeather(type, true);
			mbCEYanlingTrace("weather", null, type);
			return { ok: true, msg: "天气已切换为「" + mbCEYanlingWeatherMap[type] + "」" };
		} catch (e) { return { ok: false, msg: "切换异常：" + mbCEYanlingErr(e) }; }
	}

	/* 角色对象：V.NPCName[V.NPCNameList.indexOf(name)]（与 C.npc.X 同一对象，见 initCNPC 55579-55595） */
	function mbCEYanlingNpc(name) {
		try {
			var V = getV();
			if (!V || !V.NPCName || !V.NPCNameList || typeof V.NPCNameList.indexOf !== "function") { return null; }
			var i = V.NPCNameList.indexOf(name);
			if (i === -1) { return null; }
			return V.NPCName[i] || null;
		} catch (e) { return null; }
	}
	/* 游戏内"今天 + N 天"的时间戳：优先 SugarCube DateTime（与原版 new DateTime(Time.date).addDays(n).timeStamp 等价） */
	function mbCEYanlingDaysLater(days) {
		try {
			var TD = null;
			if (typeof window !== "undefined") {
				if (typeof window.DateTime === "function") { TD = window.DateTime; }
				else if (window.SugarCube && typeof window.SugarCube.DateTime === "function") { TD = window.SugarCube.DateTime; }
			}
			if (TD && typeof Time !== "undefined" && Time && Time.date) {
				return new TD(Time.date).addDays(days).timeStamp;
			}
			if (typeof Time !== "undefined" && Time && Time.date && typeof Time.date.timeStamp === "number") {
				return Time.date.timeStamp + days * 86400;
			}
		} catch (e) {}
		return null;
	}

	/* 格威岚 · 放逐：原版 Gwylan Ritual Sex Scorned 402967-402970 逐句对齐
	   <<npcset Gwylan state "scorned">> + $daily.gwylan.preventProgress=true + $gwylan.timer.scorned = +9 天
	   后果（原版实证）：森林/森林商店/咖啡馆/学校接送/酒馆全线事件跳过（338148/406843/548612/663254 等），
	   状态栏显示「has scorned your affections」（300687）；到期日 78390-78393 自动 delete timer 恢复。 */
	function mbCEYanlingGwylanBanish() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var npc = mbCEYanlingNpc("Gwylan");
			if (!npc || typeof npc !== "object") { return { ok: false, msg: "本存档无格威岚槽位" }; }
			if (npc.init === 0) { return { ok: false, msg: "格威岚尚未初始化（未相遇），无从放逐" }; }
			var ts = mbCEYanlingDaysLater(9);
			if (ts === null) { return { ok: false, msg: "无法计算游戏内时间戳（DateTime / Time.date 不可用）" }; }
			var before = { state: npc.state, scorned: (V.gwylan && V.gwylan.timer) ? V.gwylan.timer.scorned : undefined };
			npc.state = "scorned";
			if (!V.gwylan || typeof V.gwylan !== "object") { V.gwylan = {}; }
			if (!V.gwylan.timer || typeof V.gwylan.timer !== "object") { V.gwylan.timer = {}; }
			V.gwylan.timer.scorned = ts;
			if (!V.daily || typeof V.daily !== "object") { V.daily = {}; }
			if (!V.daily.gwylan || typeof V.daily.gwylan !== "object") { V.daily.gwylan = {}; }
			V.daily.gwylan.preventProgress = true;
			mbCEYanlingTrace("gwylan_banish", before, { state: "scorned", scorned: ts });
			return { ok: true, msg: "格威岚已被放逐（9 天内森林商店 / 咖啡馆 / 接送全线不触发；到期自动解除）" };
		} catch (e) { return { ok: false, msg: "放逐异常：" + mbCEYanlingErr(e) }; }
	}
	/* 格威岚 · 召回：原版无「直接清 state」的正规入口（正常线靠道歉 +3/-3 天缩短 timer，385338/385392），
	   这里做等价收敛：state 回 active + 清 timer.scorned / timer.nobody + 解除当日进度锁。
	   timer.nobody 是通用「人不在场」倒计时（gwylanNobody widget 416528-416537，默认 9 天），一并清掉才真正召回。 */
	function mbCEYanlingGwylanRecall() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var npc = mbCEYanlingNpc("Gwylan");
			if (!npc || typeof npc !== "object") { return { ok: false, msg: "本存档无格威岚槽位" }; }
			var before = { state: npc.state, scorned: (V.gwylan && V.gwylan.timer) ? V.gwylan.timer.scorned : undefined, nobody: (V.gwylan && V.gwylan.timer) ? V.gwylan.timer.nobody : undefined };
			npc.state = "active";
			if (V.gwylan && V.gwylan.timer && typeof V.gwylan.timer === "object") {
				delete V.gwylan.timer.scorned;
				delete V.gwylan.timer.nobody;
			}
			if (V.daily && V.daily.gwylan && typeof V.daily.gwylan === "object") { V.daily.gwylan.preventProgress = false; }
			mbCEYanlingTrace("gwylan_recall", before, { state: "active" });
			return { ok: true, msg: "格威岚已召回（state=active，放逐 / 缺席倒计时均已清除）" };
		} catch (e) { return { ok: false, msg: "召回异常：" + mbCEYanlingErr(e) }; }
	}

	/* 凯拉尔 · 送监狱：原版合法值 "active" / "" / "prison" / 0（654113 起监狱专属线按 state is "prison" 触发） */
	function mbCEYanlingKylar(prison) {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var npc = mbCEYanlingNpc("Kylar");
			if (!npc || typeof npc !== "object") { return { ok: false, msg: "本存档无凯拉尔槽位" }; }
			if (npc.init === 0) { return { ok: false, msg: "凯拉尔尚未初始化（未相遇）" }; }
			var before = npc.state, target = prison ? "prison" : "active";
			npc.state = target;
			mbCEYanlingTrace("kylar_state", before, target);
			return { ok: true, msg: "凯拉尔已" + (prison ? "送进监狱（state=prison）" : "捞回（state=active）") + "（原 " + String(before) + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 惠特尼 · 送地牢：原版合法值 "active" / "dungeon" / "pillory" / "rescued"（188671-188677）
	   只做 dungeon ↔ active：pillory 由 $pillory_tenant 联动（188675 判定承租人姓名为 Whitney），单写 state 会出现"人不在枷锁却在示众"的错位，故不提供。 */
	function mbCEYanlingWhitney(dungeon) {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var npc = mbCEYanlingNpc("Whitney");
			if (!npc || typeof npc !== "object") { return { ok: false, msg: "本存档无惠特尼槽位" }; }
			if (npc.init === 0) { return { ok: false, msg: "惠特尼尚未初始化（未相遇）" }; }
			var before = npc.state, target = dungeon ? "dungeon" : "active";
			npc.state = target;
			mbCEYanlingTrace("whitney_state", before, target);
			return { ok: true, msg: "惠特尼已" + (dungeon ? "关进地牢（state=dungeon）" : "放回（state=active）") + "（原 " + String(before) + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 监狱庇护：原版 $prison.protection 是**枚举字符串**，不是数字档位（DoL 0.5.12.13 实证）
	   · 赋值：657114 / 657139 / 657210 / 657294 / 657501 / 657850 … 全部为 <<set $prison.protection to "scarred">>
	   · 判定：650845 `is "scarred"`、651145 / 658072 `is "tattooed"`（SugarCube 的 is 等价 ===）
	   · 空值判定：654586 `$prison.attention_level gte 1 and !$prison.protection` → 空串为假值 = 无庇护
	   写数字的后果：两个 is 全部不匹配（庇护线文案与分支不走），而 !protection 因数字为真值而不成立（attention 事件也不再触发）
	   → 面板显示写入成功、游戏侧静默半失效。本组按原版枚举语义直写字符串，与「场景 · 地点」页的数字键分开。 */
	function mbCEYanlingPrisonProtect(val) {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			if (!V.prison || typeof V.prison !== "object") {
				return { ok: false, msg: "本存档无监狱对象（尚未进过监狱时原版不初始化 $prison；进一次监狱后即可使用）" };
			}
			var before = V.prison.protection;
			V.prison.protection = val;
			mbCEYanlingTrace("prison_protection", before, val);
			var label = val === "scarred" ? "疤痕狱友庇护" : (val === "tattooed" ? "纹身狱友庇护" : "无庇护");
			return { ok: true, msg: "监狱庇护已设为「" + label + "」（原 " + (before === undefined ? "未设置" : JSON.stringify(before)) + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 职责：言灵页（07i）渲染 —— A/B/C 三组九个区块 + 页尾说明折叠块 + 加载即起守卫。 */
	/* 渲染：言灵页（7 号外层页签） */
	function renderYanling() {
		try {
			mbCEYanlingEnsureTimer();
			var pane = root ? root.querySelector('[data-pane="yanling"]') : null;
			if (!pane) { return; }
			/* 重建面板前记住滚动位置：点开关后整页重渲染，不能让玩家每点一次都跳回顶端 */
			var scroller = null, keepTop = 0;
			try { scroller = pane.closest ? pane.closest(".mce-body") : null; keepTop = scroller ? scroller.scrollTop : 0; } catch (eS) {}
			pane.textContent = "";
			var V = getV();
			var st = mbCEYanlingState();
			var hooked = !!(mbCEYanlingHookFn && typeof window !== "undefined" && window.isCrossdressing === mbCEYanlingHookFn);

			var mkStatus = function (sec, on, onText, offText) {
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", "当前状态："));
				row.appendChild(el("span", "mce-value", on ? onText : offText));
				sec.appendChild(row);
			};
			var mkBtn = function (sec, text, cls, fn, tip) {
				var isGrid = !!(sec && sec.classList && sec.classList.contains("mce-btn-grid"));
				var b = el("button", "mce-btn " + (cls || ""), text);
				b.type = "button";
				if (tip) { b.title = tip; }
				b.addEventListener("click", function () {
					var r = fn();
					if (r && r.msg) { setStatus(r.msg, r.ok ? "mce-ok" : "mce-err"); }
					mbCEFlashRow(b);
					renderYanling();
				});
				if (isGrid) {
					/* v2.0.2 按键排版：网格容器内不再套一层 mce-row（每格直接一个按钮） */
					sec.appendChild(b);
				} else {
					var row = el("div", "mce-row");
					row.appendChild(b);
					sec.appendChild(row);
				}
				return b;
			};

			/* ==== v2.0.2 按键重排：8 个平铺区块 → 3 个语义分组 + 统一编号（①~⑧）+ 2 列按钮网格 ====
			   旧版把"说明与边界"塞在第 4 位却排在最后、区块顺序 s1→s2→s3→s5→s6→s7→s8→s4，编号与文案里的 ①②③ 完全脱节；
			   现在按「玩家要解决什么问题」分组：着装与名声（想穿什么就穿什么）/ 身体与数值（把状态拉回舒服）/
			   角色状态（把碍事的 NPC 挪开），说明统一收进最底折叠块。 */
			var gA = mceNewGroup(pane, "A · 着装与名声", "异装判定 / 性癖特质 / 负面名声");
			var gB = mceNewGroup(pane, "B · 身体与数值", "衣物湿度与耐久 / 体液与精神 / 快补数值 / 天气");
			var gC = mceNewGroup(pane, "C · 角色状态", "放逐 / 囚禁（原版 state 层）");

			/* ① 核心：无性别着装 */
			var s1 = mceNewSec(gA, 1, "无视着装性别", "开启后 NPC 不再按服装标注性别判定异装：穿异性服装不触发异装判定、不涨异装癖、不产生学校异装名声，换衣间也不再出现「naughty」类文案。判定在 JS 层覆盖 isCrossdressing()，$crossdressing 恒为 0，版本升级不会像文本替换那样静默失效。");
			mkStatus(s1, st && st.noCross, "已开启", "未开启");
			var row1 = el("div", "mce-row");
			var b1 = el("button", "mce-btn " + (st && st.noCross ? "mce-red" : "mce-gold"), st && st.noCross ? "关闭（恢复原版判定）" : "开启");
			b1.type = "button";
			b1.addEventListener("click", function () {
				var r = mbCEYanlingToggle("noCross");
				setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
				mbCEFlashRow(b1);
				renderYanling();
			});
			row1.appendChild(b1);
			s1.appendChild(row1);
			var diag = el("div", "mce-row");
			diag.appendChild(el("span", "mce-row-lbl", "运行时诊断："));
			var hookedTxt = hooked ? "钩子已挂载" : ((st && st.noCross === true) ? "钩子未挂载（游戏脚本未就绪或已被重载）" : "未启用（开关关闭时不挂钩子）");
			diag.appendChild(el("span", "mce-value", hookedTxt + " ｜ $crossdressing = " + (V && V.crossdressing !== undefined ? String(V.crossdressing) : "—")));
			s1.appendChild(diag);

			/* ② 异装癖（crossdresser 特质） */
			var s2 = mceNewSec(gA, 2, "异装癖压制", "异装癖累积点在异装分支内（243201-243208：$crossdressingTrait 满 100 → 背景特质 crossdresser）。开启「无视着装性别」后不再累积；本组额外把存量进度与已获得的特质清掉，并可按秒压制（读档后同样生效）。");
			var hasTrait = false;
			try {
				var bt = V && V.backgroundTraits;
				hasTrait = !!(bt && typeof bt.indexOf === "function" && bt.indexOf("crossdresser") !== -1);
			} catch (e0) {}
			var tRow = el("div", "mce-row");
			tRow.appendChild(el("span", "mce-row-lbl", "当前：进度 " + (V && typeof V.crossdressingTrait === "number" ? String(V.crossdressingTrait) : "0") + "/100，特质 "));
			tRow.appendChild(el("span", "mce-value", hasTrait ? "已获得（可按下方按钮移除）" : "未获得"));
			s2.appendChild(tRow);
			mkStatus(s2, st && st.noTrait, "压制中（每秒压回 0）", "未压制");
			mkBtn(s2, "立即清空进度 + 移除特质", "mce-gold", mbCEYanlingPurgeTrait, "清空 $crossdressingTrait 并从 $backgroundTraits 移除 crossdresser");
			var rowT = el("div", "mce-row");
			var bT = el("button", "mce-btn " + (st && st.noTrait ? "mce-red" : ""), st && st.noTrait ? "停止压制" : "开启持续压制");
			bT.type = "button";
			bT.addEventListener("click", function () {
				var r = mbCEYanlingToggle("noTrait");
				setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
				mbCEFlashRow(bT);
				renderYanling();
			});
			rowT.appendChild(bT);
			s2.appendChild(rowT);

			/* ③ 负面名声清零 */
			var s3 = mceNewSec(gA, 3, "负面名声清零", "学校名声仅 crossdress / herm 两键（schoolrep 346656-346682）；城镇名声取 V.fame 负面 8 项（sex / prostitution / rape / bestiality / pregnancy / impreg / exhibitionism / pimp），并同步删除 V.fameDecay / V.fameDecayTimer 的衰减队列项，避免清零后又被队列改回。正面项（scrap / good / business / social / model）由本区块第二个按钮单独拉满到 2000（290894-290895 clamp 与 306924-306928 numberStepper max 双实证）。");
			var schTxt = "—";
			try {
				if (V && V.schoolrep && typeof V.schoolrep === "object") {
					schTxt = "crossdress=" + String(V.schoolrep.crossdress === undefined ? 0 : V.schoolrep.crossdress) + "，herm=" + String(V.schoolrep.herm === undefined ? 0 : V.schoolrep.herm);
				}
			} catch (e1) {}
			var fRow = el("div", "mce-row");
			fRow.appendChild(el("span", "mce-row-lbl", "学校名声：" + schTxt + " ｜ 城镇负面合计 " + (function () {
				try {
					var tot = 0, V1 = getV();
					for (var j = 0; j < mbCEYanlingFameNeg.length; j++) {
						var kk = mbCEYanlingFameNeg[j];
						if (V1 && V1.fame && typeof V1.fame[kk] === "number") { tot += V1.fame[kk]; }
					}
					return String(tot);
				} catch (e2) { return "—"; }
			})() + " 点"));
			s3.appendChild(fRow);
			var s3g = mceBtnGrid(s3);
			mkBtn(s3g, "一键清零：学校异装名声", "mce-gold", mbCEYanlingPurgeCross, "清 $schoolrep.crossdress 并删 $school_crossdress_message");
			mkBtn(s3g, "一键清零：全部负面名声", "mce-gold", mbCEYanlingPurgeFame, "学校 crossdress/herm + 城镇 fame 负面 8 项 + 衰减队列");
			mkBtn(s3g, "一键拉满：正面名声", "mce-gold", mbCEYanlingMaxFame, "fame.good / business / scrap / social / model 各写 2000（实证 clamp 上限 2000；pregnancy 上限动态不写）");

			/* ④ 身体与衣物（对照 CheatExtend 1.1.3「快捷言灵」补入；v2.0.2 拆出 ⑤ 精神与体液） */
			var s4 = mceNewSec(gB, 4, "身体与衣物", "一键烘干：$upperwet / $lowerwet / $underupperwet / $underlowerwet（原版初始化 182261-182267，debug 直写 60670-60682）。衣物加固：$worn.{upper,lower,under_upper,under_lower}.integrity 按该件 integrity_max 写满（上限取自 clothingData(slot,item,\"integrity_max\")，163772；不照抄 CE 的 +1000，避免超上限导致耐久显示破表）。");
			var wetTxt = "—", durTxt = "—";
			try {
				var Vw = getV();
				if (Vw) {
					wetTxt = ["upperwet", "lowerwet", "underupperwet", "underlowerwet"].map(function (k) { return (typeof Vw[k] === "number") ? String(Vw[k]) : "—"; }).join(" / ");
					durTxt = ["upper", "lower", "under_upper", "under_lower"].map(function (sl) {
						var w = Vw.worn ? Vw.worn[sl] : null;
						if (!w || !w.name || w.name === "naked") { return sl + "：空"; }
						return sl + "：" + String(w.integrity);
					}).join(" ｜ ");
				}
			} catch (eW) {}
			var wRow = el("div", "mce-row");
			wRow.appendChild(el("span", "mce-row-lbl", "湿度（上 / 下 / 内上 / 内下）："));
			wRow.appendChild(el("span", "mce-value", wetTxt));
			s4.appendChild(wRow);
			s4.appendChild(el("div", "mce-hint", "耐久 " + durTxt));
			var s4g = mceBtnGrid(s4);
			mkBtn(s4g, "一键烘干衣服", "mce-gold", mbCEYanlingDryClothes, "4 项衣物湿度归零");
			mkBtn(s4g, "衣物加固（耐久回满）", "mce-gold", mbCEYanlingRepairClothes, "4 主槽按各自 integrity_max 写满；穿着的 naked 槽自动跳过");

			/* ⑤ 精神与体液（v2.0.2 从「身体与衣物」拆出：这两项不碰衣物，混在一起让玩家以为都是衣服相关） */
			var s5 = mceNewSec(gB, 5, "精神与体液", "精液补满：$semen_volume / $semen_amount（183097-183101 默认 90，同序写：先 amount 补到当前 volume，再把 volume +1000）。精神恢复：$control 拉满 1000（59989 的原版初值 0，不是上限）、$hallucinogen 归零（182681）。");
			var s5g = mceBtnGrid(s5);
			mkBtn(s5g, "精液补满", "mce-gold", mbCEYanlingSemen, "$semen_amount 补到当前 volume，并把 volume +1000（与原版 CheatExtend 同序）");
			mkBtn(s5g, "精神恢复（控制拉满 + 幻觉清零）", "mce-gold", mbCEYanlingMind, "$control=1000、$hallucinogen=0");

			/* ⑥ 数值快补 */
			var s6 = mceNewSec(gB, 6, "数值快补", "补 CE 快速面板没有入口的原版数值：施虐 / 受虐（$sadism / $masochism，钳制 0-1000，290866）、奶量（$milk_volume / $milk_max，每日钳到 [24, milk_max]，290800）、成就限制（$feats.locked 原版是布尔 true=锁定）、罗宾存款（$robinmoney）、艾弗里约会（$averydate is 1 且 21 点前，308105）、校长办公室密码（$headpasswordknown）、种子（window.unlockAllSeeds，76431）、农田（$farm.clearing=0 见 305874 / $fertiliser.current ++ 见 105354）。");
			var s6g = mceBtnGrid(s6);
			mkBtn(s6g, "施虐 / 受虐拉满（1000）", "mce-gold", mbCEYanlingSadism, "$sadism / $masochism = 1000");
			mkBtn(s6g, "奶量 5000 / 上限 10000", "mce-gold", mbCEYanlingMilk, "先抬 milk_max 再写 milk_volume，避免被每日钳制卡回");
			mkBtn(s6g, "解除成就限制", "mce-gold", mbCEYanlingFeats, "$feats.locked = false（原版以 isnot true 判已解锁）");
			mkBtn(s6g, "罗宾存款清零", "mce-gold", mbCEYanlingRobinMoney, "$robinmoney = 0");
			mkBtn(s6g, "今晚艾弗里来约", "mce-gold", mbCEYanlingAveryDate, "$averydate = 1（21 点前到宅邸触发）");
			mkBtn(s6g, "获知校长办公室密码", "mce-gold", mbCEYanlingHeadPassword, "$headpasswordknown = 1");
			mkBtn(s6g, "集齐所有种子", "mce-gold", mbCEYanlingSeeds, "调原版 window.unlockAllSeeds()，不自造种子表");
			mkBtn(s6g, "清理农田 + 补 5 袋堆肥", "mce-gold", mbCEYanlingFarm, "$farm.clearing = 0、$fertiliser.current += 5");

			/* ⑦ 天气 */
			var s7 = mceNewSec(gB, 7, "天气", "0.5 起天气迁到 $weatherObj，旧 $weather 只在旧档迁移分支读一次随即 unset（190009-190032）——老式写 $weather=\"rain\" 在本版完全无效（CE 的「祈雨术」即此条）。本页直调原版 window.setWeather(type, true)（定义 87136-87167），合法类型表 85185-85407 共 7 档，此处给常用 4 档（雨 / 雪由气温决定，不单列）。");
			var s7g = mceBtnGrid(s7);
			["clear", "heavyClouds", "heavyPrecipitation", "thunderstorm"].forEach(function (wt) {
				mkBtn(s7g, "切到「" + mbCEYanlingWeatherMap[wt] + "」", "", function () { return mbCEYanlingWeather(wt); }, "setWeather(\"" + wt + "\", true)");
			});

			/* ⑧ 角色放逐 */
			var s8 = mceNewSec(gC, 8, "角色放逐", "原版「放逐」不是通用机制：跨角色只有格威岚走 scorned 线（Gwylan Ritual Sex Scorned 402967-402970 = state=scorned + 当日进度锁 + 9 天倒计时；到期由 78390-78393 自动 delete timer 恢复），凯拉尔 / 惠特尼 的「离场」在原版是 state 切换（prison / dungeon）。顺手核实：CheatExtend 1.1.3 全目录 grep「放逐 / banish / exile / 驱逐」零命中——本组口径来自原版，不是照抄 CE。");
			var npcTxt = "—";
			try {
				var statList = [];
				["Gwylan", "Kylar", "Whitney"].forEach(function (nm) {
					var p = mbCEYanlingNpc(nm);
					statList.push(nm + "=" + (p ? String(p.state) : "无槽位"));
				});
				npcTxt = statList.join(" ｜ ");
			} catch (eN) {}
			s8.appendChild(el("div", "mce-hint", "当前 NPC 状态：" + npcTxt));
			var s8g = mceBtnGrid(s8);
			mkBtn(s8g, "格威岚 · 放逐 9 天", "mce-red", mbCEYanlingGwylanBanish, "state=scorned + $daily.gwylan.preventProgress=true + $gwylan.timer.scorned=+9 天");
			mkBtn(s8g, "格威岚 · 立即召回", "mce-gold", mbCEYanlingGwylanRecall, "state=active + 清 timer.scorned / timer.nobody（等价于道歉线 addDays(-3) 提前解禁）");
			mkBtn(s8g, "凯拉尔 · 送进监狱", "mce-red", function () { return mbCEYanlingKylar(true); }, "state=prison（原版监狱专属线按此值触发）");
			mkBtn(s8g, "凯拉尔 · 捞回", "mce-gold", function () { return mbCEYanlingKylar(false); }, "state=active");
			mkBtn(s8g, "惠特尼 · 关进地牢", "mce-red", function () { return mbCEYanlingWhitney(true); }, "state=dungeon（188677 四处地牢事件按此值触发）");
			mkBtn(s8g, "惠特尼 · 放回", "mce-gold", function () { return mbCEYanlingWhitney(false); }, "state=active");
			s8.appendChild(el("div", "mce-hint", "惠特尼不提供「枷锁示众」：pillory 由 $pillory_tenant 联动（188675 按承租人姓名判定），只写 state 会出现「人不在枷锁却显示示众」的错位。凯拉尔亦同：其 prison 线除 state 还要 $prison.kylar 等配套键，本组只做 state 层（与原版 npcset 等价），不伪造监狱进度。"));

			/* ⑨ 监狱庇护（v2.0.3 新增：原 $prison.protection 是枚举字符串，数字档位在半失效，见上方 mbCEYanlingPrisonProtect 注释） */
			var s9 = mceNewSec(gC, 9, "监狱庇护", "原版 $prison.protection **不是数字**：657114 等 14 处 `set to \"scarred\"`，650845 / 651145 / 658072 用 `is \"scarred\"` / `is \"tattooed\"` 判定（is 等价 ===），654586 用 `!$prison.protection` 判空。所以只有「有某种庇护 / 无庇护」两态——写 scarred 或 tattooed 都等价屏蔽狱中 attention 事件，只是走不同狱友的早餐 / 午餐分支。");
			var protTxt = "—";
			try {
				var pv = (V && V.prison) ? V.prison.protection : undefined;
				protTxt = (V && V.prison) ? (pv === "" ? "无庇护（空串）" : (pv === undefined ? "未设置（字段缺省，等价无庇护）" : JSON.stringify(pv))) : "本存档无监狱对象（尚未进过监狱）";
			} catch (eP) {}
			s9.appendChild(el("div", "mce-hint", "当前：$prison.protection = " + protTxt));
			var s9g = mceBtnGrid(s9);
			mkBtn(s9g, "疤痕狱友庇护", "mce-gold", function () { return mbCEYanlingPrisonProtect("scarred"); }, "prison.protection = \"scarred\"（原版 14 处同值；早餐 / 午餐走 scarred 狱友分支）");
			mkBtn(s9g, "纹身狱友庇护", "mce-gold", function () { return mbCEYanlingPrisonProtect("tattooed"); }, "prison.protection = \"tattooed\"（651145 / 658072 有对应判定分支）");
			mkBtn(s9g, "清除庇护", "", function () { return mbCEYanlingPrisonProtect(""); }, "prison.protection = \"\"（空串为假值，恢复 attention 事件的随机遭遇）");
			s9.appendChild(el("div", "mce-hint", "注意：$prison.scarred_level（0-5）与 $prison.tattooed（0-100）是另外两个**数字**键（狱友线声望档位），在「场景 → 地点」页的监狱组里调，与本组不是同一个变量。"));

			/* v2.0.2 按键重排：说明与边界不再伪装成"第 4 个区块"，改为页尾折叠块（不占编号，默认 2 行） */
			var sInfo = el("div", "mce-block");
			var sInfoh = el("div", "mce-sec-title");
			sInfoh.appendChild(el("span", "", "说明与边界（点开查看）"));
			sInfo.appendChild(sInfoh);
			var sInfobody = el("div", "mce-foldbox");
			sInfobody.setAttribute("data-open", "0");
			var sInfotoggle = el("div", "mce-hint mce-fold", "① 只拦「服装性别」链；② 压力循环不受影响；③ 不依赖原版文案，仅依赖 6 个变量键；④ 全部动作按 mbCE_wrote 留痕可回退；⑤ 关闭开关立即卸载钩子；⑥ 性别认知残留属正常。");
			sInfotoggle.setAttribute("data-open", "0");
			sInfotoggle.addEventListener("click", function () {
				var now = sInfobody.getAttribute("data-open") === "0" ? "1" : "0";
				sInfobody.setAttribute("data-open", now);
				sInfotoggle.setAttribute("data-open", "0"); /* body 收起时摘要保持 2 行 */
			});
			sInfobody.appendChild(sInfotoggle);
			sInfobody.appendChild(el("div", "mce-hint", "① 只拦「服装性别」链，不改玩家性别、生殖器、外观性别（isGenitalMismatch 与原版 herm 链保持原样；双生殖器仍会按原版进 herm 分支，如需一并消掉请用上面的名声清零）。"));
			sInfobody.appendChild(el("div", "mce-hint", "② 压力循环不受影响：77866-77870 用本地 const 判定（源码注释明确不复用函数），本页只覆盖函数不改语义。"));
			sInfobody.appendChild(el("div", "mce-hint", "③ 不依赖任何原版文案：老式「言灵」模组靠文本替换原版 Cheats 面板，原版一更新即整块失效；本页全部为运行期钩子与变量直写，仅依赖 6 个变量键（$crossdressing / $schoolrep / $school_crossdress_message / $crossdressingTrait / $backgroundTraits / $fame）。"));
			sInfobody.appendChild(el("div", "mce-hint", "④ 所有净化动作按 mbCE_wrote[\"yanling:op\"] 留痕（含 before/after/t），可在全局页留痕区核对。"));
			sInfobody.appendChild(el("div", "mce-hint", "⑤ 关闭开关会立即卸载钩子（window.isCrossdressing 还原为原版函数），不留空包装层；钩子被第三方模组重包时，开关开启期间每秒自动以新函数为上游重新包裹。"));
			sInfobody.appendChild(el("div", "mce-hint", "⑥ 性别认知残留属正常：学校异装名声升到 5 时原版会把 9 名 NPC 写进 $genderknown（schoolrep widget 的 pushUnique）。本页清零名声不撤销这些认知——它们只代表「NPC 已知道你的性别」，不是负面名声，撤销反而让 NPC 忘记已有认知。"));
			sInfo.appendChild(sInfobody);
			pane.appendChild(sInfo);
			/* 恢复滚动位置（见上方 keepTop） */
			if (scroller && keepTop) { try { scroller.scrollTop = keepTop; } catch (eR) {} }
		} catch (e) { /* 渲染失败不抛到 UI 主链 */ }
	}

	/* 模块加载即起守卫：存档里已开启的开关无需打开面板也持续生效（V 未就绪时 tick 内静默跳过） */
	mbCEYanlingEnsureTimer();
/* ============================================================
 * 07j-transform-hide.js — R1/R2 转化部件「隐藏」作弊（外观层，纯原版字段）
 *
 * 原版取证（DoL 0.5.12.13 tw-passagedata，passage = "Transformation Widgets"）：
 *   1) 隐藏惩罚的唯一来源：
 *      <<if _value is "hidden" and _key isnot "traits" and !["pubes","pits","cheeks"].includes(_label)
 *            and !(_label is "wings" and _excludeWings is true)>>
 *        <<if $panicattacks gte 2>>   → 强制取消隐藏（写回 "default"，_hidingFailed）
 *        <<else>>                     → <<trauma 15>>
 *      即：每次「重新隐藏」重组时，非 traits / 非 pubes / 非 pits / 非 cheeks 的隐藏部件各 +15 创伤；
 *      panicattacks ≥ 2 时原版会直接把部件打回 "default"（隐藏失败）。
 *   2) 翅膀豁免：_excludeWings 在「鸟翼 + 任一天使/堕落天使/恶魔翼同时隐藏」时为 false，
 *      否则为 true → 此时隐藏 wings 不进惩罚分支。翅膀属独立部件，隐藏不影响其它部位判定。
 *   3) $transformationParts 为 { 物种: { 部件: "default"|"hidden"|"disabled" } }；
 *      大量原版场景用 `isnot "hidden"` 决定 NPC 是否看见/反应（Traits / Avery / History Lesson / Temple / Mirror）。
 *
 * 因此本页做三件事（全部只写原版字段，不 patch 段落）：
 *   · 隐藏内在（traits.*：尖牙/锐眼/追逐/炫耀/终身伴侣）
 *   · 隐藏翅膀（bird / angel / fallenAngel / demon 的 wings，独立开关）
 *   · 隐藏无惩罚：① 锁 $trauma = 0（复用 07f-lock 的 1s 写回，压掉 +15）
 *                 ② 强制保持隐藏：1s 校验，被原版打回 "default" 立即写回 "hidden"
 * ============================================================ */

var MB_CE_HIDE_WINGS_SPECIES = ["bird", "angel", "fallenAngel", "demon"];
var mbCEHideTimer = null;

function mbCEHideState() {
	var V = getV();
	if (!V || typeof V !== "object") { return null; }
	if (!V.mbCE_hide || typeof V.mbCE_hide !== "object") { V.mbCE_hide = {}; }
	return V.mbCE_hide;
}
/* 目标部件清单：kind = "inner"（traits 全部）| "wings"（四系翅膀） */
function mbCEHideTargets(parts, kind) {
	var out = [];
	if (!parts || typeof parts !== "object") { return out; }
	if (kind === "wings") {
		MB_CE_HIDE_WINGS_SPECIES.forEach(function (sp) {
			var c = parts[sp];
			if (c && typeof c === "object" && typeof c.wings === "string") { out.push([sp, "wings"]); }
		});
		return out;
	}
	var tr = parts.traits;
	if (tr && typeof tr === "object") {
		Object.keys(tr).forEach(function (k) {
			if (typeof tr[k] === "string") { out.push(["traits", k]); }
		});
	}
	return out;
}
/* 首次改动前存一份整体快照：任一开关回退都还原到这份快照（一次开关=一次可回退动作） */
function mbCEHideSnap(V) {
	try {
		if (!V.mbCE_hideSnap || typeof V.mbCE_hideSnap !== "object") {
			V.mbCE_hideSnap = JSON.parse(JSON.stringify(V.transformationParts));
		}
	} catch (e) { /* 快照失败则放弃回退留痕，不影响本次写入 */ }
}
/* 切换：on=true → 全部设 "hidden"（保留 "disabled" 不动）；on=false → 把 "hidden" 还原 "default" */
function mbCEHideApply(kind, on) {
	try {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var parts = V.transformationParts;
		if (!parts || typeof parts !== "object") { return { ok: false, message: "转化数据尚未建立（先在游戏内触发任一转化，部件表才会生成）" }; }
		var targets = mbCEHideTargets(parts, kind);
		if (!targets.length) { return { ok: false, message: "未找到对应部件（" + (kind === "wings" ? "四系翅膀" : "traits 内在") + "）" }; }
		mbCEHideSnap(V);
		var n = 0;
		targets.forEach(function (t) {
			var c = parts[t[0]][t[1]];
			if (on) {
				if (c !== "disabled" && c !== "hidden") { parts[t[0]][t[1]] = "hidden"; n++; }
			} else {
				if (c === "hidden") { parts[t[0]][t[1]] = "default"; n++; }
			}
		});
		var hs = mbCEHideState();
		if (hs) { hs[kind] = !!on; }
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		V.mbCE_wrote["part:" + kind] = { type: "part", path: kind, kind: kind, on: !!on, before: true, after: !!on, t: Date.now() };
		mbCEWroteTrim(V);
		mbCEHideEnsureTimer();
		var label = kind === "wings" ? "翅膀" : "内在（traits）";
		return {
			ok: true,
			message: (on ? "已隐藏" : "已取消隐藏") + label + "（变更 " + n + " 个部件" + (n === 0 ? "，本来就是这个状态" : "") + "）" +
				(on && kind === "inner" ? "；内在隐藏不改造 NPC 反应，但原版每次重组隐藏会 +15 创伤 → 用下方「隐藏无惩罚」压掉" : "")
		};
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 强制保持隐藏：1s 校验，凡属已开启类别且被写成非 hidden/disabled 的，写回 "hidden" */
function mbCEHideTick() {
	try {
		var V = getV();
		var hs = V && V.mbCE_hide;
		if (!V || !hs || typeof hs !== "object" || !hs.force) { return 0; }
		var parts = V.transformationParts;
		if (!parts || typeof parts !== "object") { return 0; }
		var fixed = 0;
		["inner", "wings"].forEach(function (kind) {
			if (!hs[kind]) { return; }
			mbCEHideTargets(parts, kind).forEach(function (t) {
				var c = parts[t[0]][t[1]];
				if (c !== "disabled" && c !== "hidden") { parts[t[0]][t[1]] = "hidden"; fixed++; }
			});
		});
		return fixed;
	} catch (e) { return 0; }
}
function mbCEHideEnsureTimer() {
	try {
		var V = getV();
		var hs = V && V.mbCE_hide;
		var on = !!(hs && typeof hs === "object" && hs.force);
		if (on && !mbCEHideTimer) {
			mbCEHideTimer = setInterval(function () { try { mbCEHideTick(); } catch (e) {} }, 1000);
		} else if (!on && mbCEHideTimer) {
			clearInterval(mbCEHideTimer); mbCEHideTimer = null;
		}
	} catch (e) {}
}
/* 隐藏无惩罚：锁 $trauma = 0（原版 +15 会被 1s 写回压回 0）；关闭时解除这条锁定 */
function mbCEHideNoPenalty(on) {
	try {
		if (typeof mbCELockSet !== "function" || typeof mbCELockHas !== "function") {
			return { ok: false, message: "锁定模块未加载（07f-lock.js）" };
		}
		if (on) {
			if (mbCELockHas("trauma")) { return { ok: true, message: "创伤已处于锁定 0（无惩罚已生效）" }; }
			var r = mbCELockSet("trauma", 0, true);
			return (r && r.ok) ? { ok: true, message: "隐藏无惩罚已开启：创伤锁定 0（每 1 秒写回，原版 +15 压不住时也不会累积）" } : (r || { ok: false, message: "锁定失败" });
		}
		if (!mbCELockHas("trauma")) { return { ok: true, message: "创伤当前未锁定，无惩罚已是关闭态" }; }
		var r2 = mbCELockRemove("trauma");
		return (r2 && r2.ok) ? { ok: true, message: "隐藏无惩罚已关闭：已解除创伤锁定" } : (r2 || { ok: false, message: "解绑失败" });
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 强制保持隐藏开关 */
function mbCEHideForce(on) {
	try {
		var hs = mbCEHideState();
		if (!hs) { return { ok: false, message: "存档变量不可用" }; }
		hs.force = !!on;
		mbCEHideEnsureTimer();
		if (on) { mbCEHideTick(); }
		return {
			ok: true,
			message: on
				? "已开启「强制保持隐藏」：每秒校验，被原版打回默认（如 panicattacks ≥ 2 的隐藏失败）会立即写回隐藏"
				: "已关闭「强制保持隐藏」：原版可以自行取消你的隐藏"
		};
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 回退（08c 统一回退中心 type="part" 分支调用）：整体还原首次开关前的部件表 */
function mbCEHideUndo(key) {
	try {
		var V = getV();
		if (!V) { return { ok: false, msg: "存档变量不可用" }; }
		var hs = V.mbCE_hideSnap;
		if (!hs || typeof hs !== "object") { return { ok: false, msg: "没有可还原的外观快照（可能已回退或超出保留窗口）" }; }
		V.transformationParts = JSON.parse(JSON.stringify(hs));
		try { delete V.mbCE_hideSnap; } catch (e) { V.mbCE_hideSnap = undefined; }
		if (V.mbCE_hide && typeof V.mbCE_hide === "object") {
			V.mbCE_hide.inner = false; V.mbCE_hide.wings = false; V.mbCE_hide.force = false;
		}
		mbCEHideEnsureTimer();
		if (V.mbCE_wrote) { try { delete V.mbCE_wrote[key]; } catch (e2) {} }
		return { ok: true, msg: "已还原外观（转化部件回到首次隐藏前的状态）" };
	} catch (e) { return { ok: false, msg: "回退异常：" + mbCEErr(e) }; }
}

/* 阶段页「转化阶段」内层页签的区块（renderTransformStages 末尾/早退前调用） */
function renderTransformHideSec(pane) {
	if (!pane) { return; }
	var V = getV();
	var parts = V && V.transformationParts;
	var sec = mceNewSec(pane, 2, "外观隐藏（转化部件 · 原版字段）",
		"原版 $transformationParts 是三态字符串（default / hidden / disabled）。" +
		"「隐藏内在」= traits.*（尖牙/锐眼/追逐/炫耀/终身伴侣）；「隐藏翅膀」= 鸟/天使/堕落天使/恶魔的 wings（独立开关，互不影响）。" +
		"实证：隐藏后原版大量场景的 `isnot \"hidden\"` 判定不再触发（NPC 看不见翅膀、不因尖牙发怵），但每次「重新隐藏」时非 traits 部件各 +15 创伤、panicattacks ≥ 2 会强制取消隐藏 —— 用「隐藏无惩罚」压掉。");
	if (!parts || typeof parts !== "object") {
		sec.appendChild(el("div", "mce-hint", "当前存档还没有转化部件表：先在游戏内触发任一转化（天使/恶魔/狼/猫/牛/狐/鸟/树精等），或直接在「阶段」页解锁一个转化阶段后再回来。"));
		return;
	}
	var innerN = 0, hiddenInner = 0, wingsN = 0, hiddenWings = 0;
	mbCEHideTargets(parts, "inner").forEach(function (t) {
		innerN++; if (parts[t[0]][t[1]] === "hidden") { hiddenInner++; }
	});
	mbCEHideTargets(parts, "wings").forEach(function (t) {
		wingsN++; if (parts[t[0]][t[1]] === "hidden") { hiddenWings++; }
	});
	var hs = (V.mbCE_hide && typeof V.mbCE_hide === "object") ? V.mbCE_hide : {};

	var mk = function (title, kind, total, hidden, note) {
		var row = el("div", "mce-row");
		var lbl = el("span", "mce-row-lbl", title + "（" + hidden + " / " + total + " 个部件处于隐藏）");
		lbl.title = note;
		row.appendChild(lbl);
		var on = el("button", "mce-btn mce-gold", "全部隐藏");
		on.type = "button";
		on.addEventListener("click", function () { var r = mbCEHideApply(kind, true); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
		var off = el("button", "mce-btn", "全部取消隐藏");
		off.type = "button";
		off.addEventListener("click", function () { var r = mbCEHideApply(kind, false); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
		row.appendChild(on); row.appendChild(off);
		if (hs[kind]) { row.appendChild(el("span", "mce-badge mce-on", "已开启")); }
		sec.appendChild(row);
	};
	mk("隐藏内在（traits：尖牙/锐眼/追逐/炫耀/终身伴侣）", "inner", innerN, hiddenInner, "内在隐藏后 NPC 不会再因尖牙/锐眼等对你产生对应反应");
	if (wingsN) { mk("隐藏翅膀（鸟 / 天使 / 堕落天使 / 恶魔）", "wings", wingsN, hiddenWings, "独立开关：只藏翅膀，不动其它部位；原版对翅膀隐藏有惩罚豁免"); }
	else { sec.appendChild(el("div", "mce-hint", "翅膀：当前存档四系翅膀字段均未生成（还没有鸟类/天使/恶魔转化）。")); }

	/* 隐藏无惩罚 */
	var npRow = el("div", "mce-row");
	npRow.appendChild(el("span", "mce-row-lbl", "隐藏无惩罚（锁创伤 0）"));
	var npOn = (typeof mbCELockHas === "function") && mbCELockHas("trauma");
	var npBtn = el("button", "mce-btn" + (npOn ? " mce-gold" : ""), npOn ? "无惩罚：已开启（点此关闭）" : "开启隐藏无惩罚");
	npBtn.type = "button";
	npBtn.addEventListener("click", function () { var r = mbCEHideNoPenalty(!npOn); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
	npRow.appendChild(npBtn);
	sec.appendChild(npRow);

	var fcRow = el("div", "mce-row");
	fcRow.appendChild(el("span", "mce-row-lbl", "强制保持隐藏（防原版打回）"));
	var fcBtn = el("button", "mce-btn" + (hs.force ? " mce-gold" : ""), hs.force ? "强制保持：已开启（点此关闭）" : "开启强制保持");
	fcBtn.type = "button";
	fcBtn.title = "每秒校验一次：已被开启的类别若被原版写回 default（panicattacks ≥ 2 的隐藏失败），立即写回 hidden";
	fcBtn.addEventListener("click", function () { var r = mbCEHideForce(!hs.force); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); renderStagePane(); });
	fcRow.appendChild(fcBtn);
	sec.appendChild(fcRow);
	sec.appendChild(el("div", "mce-hint", "组合用法：先点「全部隐藏」→ 再开「隐藏无惩罚」→ 若角色有恐慌发作（panicattacks ≥ 2）再开「强制保持隐藏」。三项都在本页，随存档保存；改动在「全局」页回退中心可整体还原。"));
}
/* ============================================================
 * 07k-island-npc.js — R3 小岛生存/营地作弊 + R4 地下妓院「角色送进去」（原版字段）
 *
 * 原版取证（DoL 0.5.12.13 tw-passagedata）：
 *   【小岛】$island 字段（unique 37 / 引用 606）：
 *     .hide(27) .explore(24) .home(23) .walnut(23) .wood(20) .space(8) .raft(8)
 *     .tide(8) .explore_count(8) .chair(8) .tide_distance(7) .defeat(4) .walk(4) .kneel(4)
 *     $island[$island.home].trap(16) .decoration(15) .camouflage(10) .curtains(10)
 *     .decor(10) .bird_feeder(10) .space_used(2)
 *   · Widgets Island 初始化：explore_locations=[] / wood=0 / tide=0 / tide_distance=0 /
 *     hide=1 / hunger=0 / explore="none"；$islander_language 缺省 0。
 *   · $island.home 三值：rocky_hillock / waterfall / gulch（Island hub 三段文案）。
 *   · explore_locations 六值：bay / shore / wood / battleground / plain / castle
 *     （pushUnique + includes 各 3 次，枚举一致；Island Build 用 includes("bay") 解锁 raft）。
 *   · 食物：Island Walnut Eat → hunger −200、walnut −1；Walnut Gather → hunger −600、walnut −3；
 *     拾取 walnut += 1（Punch/Climb/visiting bird）、wood +=1（偷窃）/ +2（Wood Swim）/ +3（Wood Ask）。
 *   · Island Explore（1:00）：<<physique 6>><<island_pass 60>><<set $island.explore_count += 1>>
 *   · $island.hide：初始 1；Island Sleep 被抓 +1；Hide 1/2/3/Trapped 被识破 −3；
 *     Island Defeat 里 Math.clamp(hide, 0, 30) 决定藏匿成功率 → 取值域 0..30。
 *   · $islander_language 0..100：Traits 里 gte 100 → 「知识：海岛语言」；战斗中岛民 lt 100 听不懂你。
 *   · 建造件值档：simple / basic / advanced（passage 成系列 Island Build <档> <件>）。
 *
 *   【地下妓院】$undergroundbrothel（unique 12 / 引用 117）：
 *     .robin(27) .water(20) .escape(17) .robinSpoke(10) .time(9) .timepass(7) .robinTalk(4)
 *     .robinTopics(3) .robinGone(2) .active(1)
 *   · 关键结论：地下妓院 Cell **只关押 Robin**（108 个 underground 段落，npc 仅 Robin）；
 *     惠特妮/凯拉尔/贝利走的是**越狱后的重逢场景**标记，不是被关：
 *       Widgets Underground 的 dungeonescape：
 *         $baileySold            → $baileyReunionScene  "dungeon"
 *         $whitneyromance is 1   → $whitneyReunionScene "dungeon"
 *         C.npc.Kylar.love gte 50→ $kylarReunionScene   "dungeon"
 *         C.npc.Robin.init is 1 且 ($hoursGoneFromHome gte 4 and !$undergroundbrothel.robin)→ "dungeon"
 *                                       或 $undergroundbrothel.robinGone → "dungeonRobin"
 *       最后：<<set $undergroundbrothelescaped to true>>
 *   · undergroundCellOptions：escape gte 19（或按体型 16/17/18）出现「Escape | Underground Escape」，
 *     否则「Dig (1:00)」；Rest(1:00) → tiredness −1000；$undergroundbrothel.robin 且 !robinSpoke → Talk to Robin。
 *   · livestockescape（雷米牧场越狱）同构：$whitneyromance is 1 → $whitneyReunionScene "farm"。
 *
 * 设计原则：只写原版真实字段，不伪造 passage；「送进地下妓院」对非 Robin 角色走原版的重逢标记，
 * 对 Robin 走 $undergroundbrothel.robin（唯一真实"被关"槽），并在文案里明确说清区别。
 * ============================================================ */

var MB_CE_ISLAND_NUMS = [
	{ path: "island.hide", name: "隐蔽度", max: 30, note: "0–30：Island Sleep 被抓 +1、被识破 −3；Defeat 时决定藏匿是否成功" },
	{ path: "island.walnut", name: "核桃", max: 999, note: "吃 1 个 −200 饥饿；Island Walnut Gather 一次消耗 3" },
	{ path: "island.walnut_dried", name: "干核桃", max: 999, note: "晒干储备" },
	{ path: "island.wood", name: "木材", max: 999, note: "Wood Swim +2、Wood Ask +3；建造消耗" },
	{ path: "island.raft", name: "木筏", max: 1, note: "0/1 二态（Island Build Raft；需 explore_locations 含 bay）" },
	{ path: "island.explore_count", name: "探索次数", max: 999, note: "Island Explore 每次 +1（1:00，需 physique 6）" },
	{ path: "islander_language", name: "海岛语言", max: 100, note: "0–100：≥100 触发「知识：海岛语言」，岛民战斗中能听懂你" },
	{ path: "islander_mask", name: "岛民面具", max: 100, note: "原版 specialClothes「islander」解锁条件 = 100" }
];
var MB_CE_ISLAND_HOMES = [
	{ v: "rocky_hillock", n: "岩石小丘" },
	{ v: "waterfall", n: "瀑布" },
	{ v: "gulch", n: "峡谷" }
];
var MB_CE_ISLAND_LOCS = [
	{ v: "bay", n: "海湾" },
	{ v: "shore", n: "海岸" },
	{ v: "wood", n: "林地" },
	{ v: "battleground", n: "古战场" },
	{ v: "plain", n: "平原" },
	{ v: "castle", n: "城堡" }
];
var MB_CE_ISLAND_BUILDS = [
	{ part: "trap", n: "陷阱" },
	{ part: "curtains", n: "帘幕" },
	{ part: "camouflage", n: "伪装" },
	{ part: "bird_feeder", n: "喂鸟器" },
	{ part: "chair", n: "座椅" }
];
var MB_CE_ISLAND_BUILD_LV = [
	{ v: "", n: "无" },
	{ v: "simple", n: "简易" },
	{ v: "basic", n: "基础" },
	{ v: "advanced", n: "高级" }
];

/* 取/建 $island 壳：原版 Widgets Island 会初始化全部字段，但玩家可能还没上过岛。
   建壳时补齐 home 与三个营地子对象，避免 $island[$island.home].trap 读到 undefined 抛错。 */
function mbCEIslandV() {
	var V = getV();
	if (!V || typeof V !== "object") { return null; }
	var made = false;
	if (!V.island || typeof V.island !== "object") {
		V.island = { home: "rocky_hillock", explore_locations: [], wood: 0, hide: 1, hunger: 0, explore: "none", tide: 0, tide_distance: 0, explore_count: 0, walnut: 0, walnut_dried: 0, raft: 0 };
		made = true;
	}
	var isl = V.island;
	if (!isl.home || isl.home === "undefined") { isl.home = "rocky_hillock"; made = true; }
	if (!Array.isArray(isl.explore_locations)) { isl.explore_locations = []; made = true; }
	MB_CE_ISLAND_HOMES.forEach(function (h) {
		if (!isl[h.v] || typeof isl[h.v] !== "object") {
			isl[h.v] = { trap: "", curtains: "", camouflage: "", bird_feeder: "", chair: "", decor: 0, decoration: "", space: 0 };
			made = true;
		}
	});
	return made ? getV() : V;
}
/* 通用原样写入（字符串/布尔/数组都用它）：保留「首次写入前」留痕，回退走 placeStageUndo。
   replay=true 时跳过预览门控（由 08d 的确认动作回调）。 */
function mbCEPlaceWriteRaw(path, value, replay) {
	try {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var parts = String(path || "").split(".");
		if (!parts.length || !parts[0]) { return { ok: false, message: "路径无效" }; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") { return { ok: false, message: "宿主不存在（" + parts.slice(0, i + 1).join(".") + "）" }; }
			cur = cur[parts[i]];
		}
		var leaf = parts[parts.length - 1];
		var now = cur[leaf];
		if (JSON.stringify(now) === JSON.stringify(value)) { return { ok: true, message: "值未变化（" + path + " 已是目标值）" }; }
		if (!replay && typeof mbCEPreviewGate === "function" &&
			mbCEPreviewGate(path, now, value, function () { return mbCEPlaceWriteRaw(path, value, true); })) {
			return { ok: false, pending: true, message: "待确认写入：" + path };
		}
		var before = now;
		var prev = V.mbCE_wrote && V.mbCE_wrote["place:" + path];
		if (prev && "before" in prev) { before = prev.before; }
		cur[leaf] = value;
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		V.mbCE_wrote["place:" + path] = { type: "place", path: path, before: before, after: value, t: Date.now() };
		mbCEWroteTrim(V);
		return { ok: true, message: "已写入 " + path + " = " + (typeof value === "string" ? value : JSON.stringify(value)) };
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}

function mbCEIslandLocToggle(loc, on) {
	try {
		var V = mbCEIslandV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var arr = V.island.explore_locations.slice();
		var at = arr.indexOf(loc);
		if (on && at === -1) { arr.push(loc); }
		if (!on && at !== -1) { arr.splice(at, 1); }
		if (arr.length === V.island.explore_locations.length && ((on && at !== -1) || (!on && at === -1))) {
			return { ok: true, message: "未变化（" + loc + " 已是当前状态）" };
		}
		return mbCEPlaceWriteRaw("island.explore_locations", arr, false);
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 数值行：钳制到 [0, max] + 留痕 place:（复用地点阶段通道） */
function mbCEIslandNumWrite(it, val) {
	if (typeof placeStageWrite === "function") { return placeStageWrite(it.path, val, 0, it.max); }
	return mbCEPlaceWriteRaw(it.path, Number(val) || 0, false);
}

/* 地点页「地点阶段」子页签末尾的 R3 区块 */
function renderIslandSec(pane) {
	if (!pane) { return; }
	var V = getV();
	var isl = (V && V.island && typeof V.island === "object") ? V.island : null;
	var sec = mceNewSec(pane, 2, "小岛（Island）· 生存与营地",
		"原版 $island 全套字段直改：隐蔽度/食物储备/木材/木筏/探索次数/海岛语言/岛民面具 + 营地位置 + 已探索地点 + 五件建造物档位。" +
		"注意：$island.home 与建造物是**字符串档位**（rocky_hillock|waterfall|gulch、\"\"|simple|basic|advanced），其它是数字；" +
		"tide / tide_distance / explore(\"none\"/…) 是瞬时探索态，不做直写以免打断正在进行的事件。");
	if (!isl) {
		sec.appendChild(el("div", "mce-hint", "当前存档还没有 $island（没上过岛）：点下面任一「写入」会自动建壳并补齐三处营地对象，之后再进岛不会报错。"));
	} else {
		sec.appendChild(el("div", "mce-hint", "当前：营地 " + ((isl.home === "waterfall") ? "瀑布" : (isl.home === "gulch") ? "峡谷" : "岩石小丘") +
			" ｜ 隐蔽 " + (isl.hide == null ? "—" : isl.hide) + " ｜ 核桃 " + (isl.walnut == null ? "—" : isl.walnut) +
			" ｜ 木材 " + (isl.wood == null ? "—" : isl.wood) + " ｜ 已探索 " + (Array.isArray(isl.explore_locations) ? isl.explore_locations.length : 0) + " / 6"));
	}

	/* 1) 数值 */
	var gNum = mceNewGroup(sec, "生存数值", "钳制在原版取值域内");
	MB_CE_ISLAND_NUMS.forEach(function (it) {
		var cur = 0;
		try {
			var seg = it.path.split(".");
			var c = V;
			seg.forEach(function (k) { c = (c == null) ? undefined : c[k]; });
			cur = (typeof c === "number") ? c : 0;
		} catch (e) { cur = 0; }
		var row = el("div", "mce-row");
		row.setAttribute("data-islandkey", it.path);
		var lbl = el("span", "mce-row-lbl", it.name + "（当前 " + cur + " / 上限 " + it.max + "）　");
		lbl.title = it.note;
		row.appendChild(lbl);
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(cur);
		inp.placeholder = "目标值";
		inp.title = it.note;
		var btn = el("button", "mce-btn", "写入"); btn.type = "button";
		btn.addEventListener("click", function () {
			var r = mbCEIslandNumWrite(it, inp.value);
			renderPlaces();
			setStatus(r && r.message ? r.message : "写入失败", r && r.ok ? "mce-ok" : "mce-err");
		});
		var maxB = el("button", "mce-btn mce-gold", "拉满"); maxB.type = "button";
		maxB.title = "置为原版上限 " + it.max;
		maxB.addEventListener("click", function () {
			var r = mbCEIslandNumWrite(it, it.max);
			renderPlaces();
			setStatus(r && r.message ? r.message : "写入失败", r && r.ok ? "mce-ok" : "mce-err");
		});
		row.appendChild(inp); row.appendChild(btn); row.appendChild(maxB);
		try {
			if (V && V.mbCE_wrote && V.mbCE_wrote["place:" + it.path]) {
				var un = el("button", "mce-btn mce-red", "回退"); un.type = "button";
				un.addEventListener("click", function () { var r = placeStageUndo(it.path); renderPlaces(); setStatus(r.message || "", r.ok ? "mce-ok" : "mce-err"); });
				row.appendChild(un);
			}
		} catch (e) {}
		gNum.appendChild(row);
	});

	/* 2) 营地位置 */
	var gHome = mceNewGroup(sec, "营地位置（$island.home）", "原版三选，直接改主场景文案与建造父键");
	MB_CE_ISLAND_HOMES.forEach(function (h) {
		var b = el("button", "mce-btn" + ((isl && isl.home === h.v) ? " mce-gold" : ""), h.n + (isl && isl.home === h.v ? "（当前）" : ""));
		b.type = "button";
		b.addEventListener("click", function () { var r = mbCEPlaceWriteRaw("island.home", h.v, false); renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); });
		gHome.appendChild(b);
	});

	/* 3) 已探索地点 */
	var gLoc = mceNewGroup(sec, "已探索地点（$island.explore_locations）", "原版六值；含 bay 才能出现木筏建造");
	MB_CE_ISLAND_LOCS.forEach(function (l) {
		var has = !!(isl && Array.isArray(isl.explore_locations) && isl.explore_locations.indexOf(l.v) !== -1);
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", l.n + "（" + l.v + "）"));
		var on = el("button", "mce-btn" + (has ? " mce-gold" : ""), has ? "已解锁（点此移除）" : "解锁"); on.type = "button";
		on.addEventListener("click", function () { var r = mbCEIslandLocToggle(l.v, !has); renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); });
		row.appendChild(on);
		gLoc.appendChild(row);
	});
	var allLoc = el("button", "mce-btn mce-gold", "六处全解锁");
	allLoc.type = "button";
	allLoc.addEventListener("click", function () {
		var r = mbCEPlaceWriteRaw("island.explore_locations", MB_CE_ISLAND_LOCS.map(function (x) { return x.v; }), false);
		renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
	});
	gLoc.appendChild(allLoc);

	/* 4) 建造物档位 */
	var curHome = (isl && isl.home) ? isl.home : "rocky_hillock";
	var gBuild = mceNewGroup(sec, "建造物档位（$island[" + (curHome === "waterfall" ? "瀑布" : curHome === "gulch" ? "峡谷" : "岩石小丘") + "].*）",
		"原版三档 simple / basic / advanced；写的是当前营地那一份，切营地后各自独立");
	MB_CE_ISLAND_BUILDS.forEach(function (b) {
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", b.n));
		MB_CE_ISLAND_BUILD_LV.forEach(function (lv) {
			var path = "island." + curHome + "." + b.part;
			var curV = "";
			try { curV = (V.island[curHome] && typeof V.island[curHome][b.part] === "string") ? V.island[curHome][b.part] : ""; } catch (e) { curV = ""; }
			var btn = el("button", "mce-btn" + (curV === lv.v ? " mce-gold" : ""), lv.n);
			btn.type = "button";
			btn.addEventListener("click", function () {
				mbCEIslandV();
				var r = mbCEPlaceWriteRaw(path, lv.v, false);
				renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			});
			row.appendChild(btn);
		});
		gBuild.appendChild(row);
	});
	gBuild.appendChild(el("div", "mce-hint", "建造物直接置档等价于「已建成该档」：原版 Island Build 只读档位决定可用选项与心情/隐蔽加成，不做额外前置校验。写完后进岛营地页即可看到对应选项。"));

	/* 5) 岛民面具解锁快捷 */
	var gMask = mceNewGroup(sec, "岛民套装解锁", "原版 specialClothes「islander」= $islander_mask is 100");
	var bMask = el("button", "mce-btn mce-gold", "解锁岛民面具套装"); bMask.type = "button";
	bMask.addEventListener("click", function () {
		var r = mbCEPlaceWriteRaw("islander_mask", 100, false);
		renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
	});
	gMask.appendChild(bMask);
}

/* ---------- R4：地下妓院 ---------- */
var MB_CE_NPC_REUNION = [
	{ key: "whitneyReunionScene", name: "惠特妮", need: "原版条件 $whitneyromance is 1（本操作会一并置 1）", extra: { path: "whitneyromance", val: 1 } },
	{ key: "kylarReunionScene", name: "凯拉尔", need: "原版条件 C.npc.Kylar.love ≥ 50（请在角色页把 love 拉高后再点，否则文字线不走）" },
	{ key: "baileyReunionScene", name: "贝利", need: "原版条件 $baileySold（被卖掉后才有这段重逢）" },
	{ key: "robinReunionScene", name: "罗宾", need: "原版条件 C.npc.Robin.init is 1 且离家 ≥ 4 小时或 robinGone；Robin 是唯一真被关进牢房的角色" }
];
function renderNpcUndergroundSec(pane) {
	if (!pane) { return; }
	var V = getV();
	var ub = (V && V.undergroundbrothel && typeof V.undergroundbrothel === "object") ? V.undergroundbrothel : null;
	var sec = mceNewSec(pane, 3, "地下妓院 · 角色与越狱（原版字段）",
		"原版取证结论：地下妓院牢房（Underground Cell）**只关押 Robin** —— 108 个 underground 段落里 npc 只有 Robin，" +
		"$undergroundbrothel 的 12 个字段中 robin/robinSpoke/robinTalk/robinTopics/robinGone 全部是 Robin 专用。" +
		"惠特妮 / 凯拉尔 / 贝利 不是被关，而是**越狱后**由 Widgets Underground 的 dungeonescape 按条件设置 *ReunionScene = \"dungeon\" 触发地下重逢。" +
		"所以这里对非 Robin 角色写的是原版真实的重逢标记（等价于「把 TA 也安排进地下剧情」），Robin 则可用 robin 槽直接关进牢房。");
	if (!ub) {
		sec.appendChild(el("div", "mce-hint", "当前存档还没有 $undergroundbrothel（没进过地下）：点任一写入会自动建壳（escape=0 / robin=false），进地下不会报错。"));
	} else {
		sec.appendChild(el("div", "mce-hint", "当前：越狱进度 " + (ub.escape == null ? "—" : ub.escape) + " / 19 ｜ Robin 在牢房 " + (ub.robin ? "是" : "否") + " ｜ 已逃出 " + (V.undergroundbrothelescaped ? "是" : "否")));
	}
	function ensureUb() {
		var Vx = getV();
		if (!Vx.undergroundbrothel || typeof Vx.undergroundbrothel !== "object") {
			Vx.undergroundbrothel = { escape: 0, robin: false, robinSpoke: false, robinTalk: 0, robinTopics: [], robinGone: false, time: 0, timepass: 0, water: 0, active: false };
		}
		return Vx;
	}
	var gRe = mceNewGroup(sec, "地下重逢场景（*ReunionScene = \"dungeon\"）", "越狱后原版会按这些标记播放对应角色的地下重逢");
	MB_CE_NPC_REUNION.forEach(function (n) {
		var row = el("div", "mce-row");
		var cur = (V && typeof V[n.key] === "string") ? V[n.key] : "";
		var lbl = el("span", "mce-row-lbl", n.name + (cur ? "（当前 " + cur + "）" : "（未设置）"));
		lbl.title = n.need;
		row.appendChild(lbl);
		var b = el("button", "mce-btn mce-gold", cur === "dungeon" ? "已设置（点此清除）" : "设为地下重逢");
		b.type = "button";
		b.addEventListener("click", function () {
			var r;
			if (cur === "dungeon") {
				r = mbCEPlaceWriteRaw(n.key, "", false);
			} else {
				if (n.extra) { mbCEPlaceWriteRaw(n.extra.path, n.extra.val, false); }
				r = mbCEPlaceWriteRaw(n.key, "dungeon", false);
			}
			renderPlaces(); setStatus(r.message + (r.ok && n.need ? "；" + n.need : ""), r.ok ? "mce-ok" : "mce-err");
		});
		row.appendChild(b);
		gRe.appendChild(row);
	});
	gRe.appendChild(el("div", "mce-hint", "提示：这些标记只决定「越狱后播放谁的重逢」，不会把角色放进牢房（原版没有这个能力）。若只想看那段剧情，设完标记后从下方「越狱进度」置 19 并在游戏内点 Escape。"));
	if (typeof getV === "function") {
		var V2 = getV();
		if (V2 && typeof V2.whitneyromance !== "undefined" && V2.whitneyromance !== 1) {
			gRe.appendChild(el("div", "mce-hint", "惠特妮：当前 $whitneyromance = " + V2.whitneyromance + "（不是 1），点上面的按钮时会自动置 1。"));
		}
	}

	var gUb = mceNewGroup(sec, "牢房与越狱（$undergroundbrothel.*）", "Robin 专用槽 + 越狱进度");
	var ubNum = [
		{ path: "undergroundbrothel.escape", name: "越狱进度", max: 19, note: "≥19（或按体型 16/17/18）地下 Cell 才会出现 Escape 选项；否则只有 Dig" },
		{ path: "undergroundbrothel.robinTalk", name: "Robin 对话次数", max: 99, note: "undergroundCellOptions 的 Talk to Robin（0:10）" }
	];
	ubNum.forEach(function (it) {
		var cur = 0;
		try { var seg = it.path.split("."); var c = V; seg.forEach(function (k) { c = (c == null) ? undefined : c[k]; }); cur = (typeof c === "number") ? c : 0; } catch (e) { cur = 0; }
		var row = el("div", "mce-row");
		var lbl = el("span", "mce-row-lbl", it.name + "（当前 " + cur + " / " + it.max + "）");
		lbl.title = it.note;
		row.appendChild(lbl);
		var inp = el("input", "mce-inp"); inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(cur); inp.title = it.note;
		var b = el("button", "mce-btn", "写入"); b.type = "button";
		b.addEventListener("click", function () { ensureUb(); var r = placeStageWrite(it.path, inp.value, 0, it.max, false); renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); });
		var mx = el("button", "mce-btn mce-gold", "拉满"); mx.type = "button";
		mx.addEventListener("click", function () { ensureUb(); var r = placeStageWrite(it.path, it.max, 0, it.max, false); renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); });
		row.appendChild(inp); row.appendChild(b); row.appendChild(mx);
		gUb.appendChild(row);
	});
	var rowRobin = el("div", "mce-row");
	rowRobin.appendChild(el("span", "mce-row-lbl", "把 Robin 关进地下牢房（$undergroundbrothel.robin，原版唯一真实牢房槽）"));
	var hasRobin = !!(ub && ub.robin);
	var bRobin = el("button", "mce-btn" + (hasRobin ? " mce-gold" : ""), hasRobin ? "已在牢房（点此放走）" : "关进去");
	bRobin.type = "button";
	bRobin.addEventListener("click", function () {
		ensureUb();
		var r = mbCEPlaceWriteRaw("undergroundbrothel.robin", !hasRobin, false);
		renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
	});
	rowRobin.appendChild(bRobin);
	gUb.appendChild(rowRobin);
	var rowEsc = el("div", "mce-row");
	rowEsc.appendChild(el("span", "mce-row-lbl", "标记「已逃出地下妓院」（$undergroundbrothelescaped，解锁 underground_brothel 套装条件）"));
	var bEsc = el("button", "mce-btn mce-gold", "置为已逃出"); bEsc.type = "button";
	bEsc.addEventListener("click", function () { var r = mbCEPlaceWriteRaw("undergroundbrothelescaped", true, false); renderPlaces(); setStatus(r.message, r.ok ? "mce-ok" : "mce-err"); });
	rowEsc.appendChild(bEsc);
	gUb.appendChild(rowEsc);
	gUb.appendChild(el("div", "mce-hint", "「关进去」只写 robin 槽：游戏内进入地下牢房还需要从 Bailey 的出售/抓捕剧情走；本功能用于补测地下线剧情与套装条件。"));
}
/* 职责：全局页 ⑧「原版档案 · 收藏 · 头衔」——朋友要的三项原版作弊直写通道
   （②犯罪不留历史记录 ③一键收集古董（只收集不上交，成就一并解锁）④飞升线也能拿「雷米 疤面」）。

   原版事实（实测行号，DoL 0.5.12.13 单行 HTML）：
   - 原版自己的清犯罪 widget（L342350–L342366）写 C.crime[type] / [type+"Count"] / [type+"Daily"] + clearEvents(type)，
     **不动 history / countHistory** —— 这两项才是「案底/历史记录」，也正是本功能要补的缺口。
   - C.crime[type+"History"] / [type+"CountHistory"] 是无 clamp 的纯赋值访问器（L55598–L55650），可直接写。
   - `Count` 的 setter 带联动（count===0 且 current>0 → count=1），所以**必须直改 $crime[type] 对象字段**而不是走访问器，
     否则先置 count 再置 current 会被联动改回 1。
   - 古董状态机 museumAntiqueStatus（L608803–L608813）只接受 notFound→found / found→talk / talk→museum / 任意→stolen|recovered /
     found|talk→notFound；**只有 museum 才 museumCount++**。成就判定是 museumCount == maxCount（L104893）。
   - earnFeat（L104772–L104782）在 `V.cheatsEnabled === true` / V.debug / soft 模式 / statFreeze / allureModifier<1 时**直接 return**
     —— 作弊模式下 by design 不记成就。所以「成就一并解锁」必须直写 `V.feats.currentSave[feat] = new Date()`。
   - 头衔：飞升线写 high elk；疤面只在 `$avery_fate isnot "ascended"` 分支（L190871–L190873）。
     该段的幂等守卫是 `C.npc.Harper.title isnot "silver fox"`，所以只写 Remy 会被下一次执行覆盖回 high elk
     —— 写入时按需补 Harper / Avery 关掉回滚分支。
   - `C.npc.X` 与 `V.NPCName[setup.NPCNameList.indexOf(X)]` 是同一对象引用（initCNPC，L55584–L55590）。 */

	var MCE_VANILLA_FEAT_MUSEUM = "It Belongs in a Museum";
	/* 头衔英文 key → 中文展示（与汉化层同口径；未收录的原样输出） */
	var MCE_VANILLA_TITLE_ZH = {
		"scarred": "疤面",
		"high elk": "高麋鹿",
		"crimson hound": "猩红猎犬",
		"silver fox": "银狐狸",
		"priest": "神父",
		"priestess": "修女",
		"headmaster": "校长",
		"headmistress": "女校长",
		"hunter": "猎手",
		"huntress": "女猎手",
		"businessman": "商人",
		"businesswoman": "女商人"
	};
	/* setup.crimeNames 缺失时的兜底清单（原版 setup.crimeNames 实证 10 类） */
	var MCE_VANILLA_CRIME_FALLBACK = [
		"assault", "coercion", "destruction", "exposure", "obstruction",
		"prostitution", "resisting", "thievery", "petty", "trespassing"
	];

	function mbCEVanillaTitleZh(t) {
		if (t === undefined || t === null || t === "") { return "（空）"; }
		return MCE_VANILLA_TITLE_ZH[String(t)] || String(t);
	}

	function mbCEVanillaClone(o) {
		try {
			if (o === undefined) { return undefined; }
			return JSON.parse(JSON.stringify(o));
		} catch (e) { return undefined; }
	}

	/* 留痕：type "vcore"，key = vcore:<id>，before 为「首次写入前」整块快照（与 04b 的 before 语义一致） */
	function mbCEVanillaTrace(id, before, path, note) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = "vcore:" + id;
			var prev = V.mbCE_wrote[key];
			if (!prev || !("before" in prev)) {
				V.mbCE_wrote[key] = { type: "vcore", id: id, path: path || "", before: before, t: Date.now(), note: note || "" };
			} else {
				prev.t = Date.now();
			}
			if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
		} catch (e) {}
	}

	function mbCEVanillaCrimeTypes() {
		var names = [];
		try {
			if (typeof setup !== "undefined" && setup && setup.crimeNames) { names = Object.keys(setup.crimeNames); }
		} catch (e) {}
		if (!names.length) { names = MCE_VANILLA_CRIME_FALLBACK.slice(); }
		return names;
	}


	/* ① 犯罪记录全清：current / count / daily / history / countHistory + 事件日志
	   直改 $crime[type] 字段，绕开 C.crime[type+"Count"] 的 setter 联动（先清 count 会被联动置 1）。 */
	function mbCEVanillaCrimeClear() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		if (!V.crime || typeof V.crime !== "object") { return { ok: false, message: "未找到 $crime（该存档没有犯罪记录结构）" }; }
		var before = {
			kind: "crime",
			crime: {},
			events: mbCEVanillaClone(V.crime.events)
		};
		var types = mbCEVanillaCrimeTypes();
		types.forEach(function (t) {
			var c = V.crime[t];
			if (c && typeof c === "object") {
				before.crime[t] = {
					current: c.current, history: c.history, daily: c.daily, count: c.count, countHistory: c.countHistory
				};
			}
		});
		var touched = 0;
		types.forEach(function (t) {
			var c = V.crime[t];
			if (!c || typeof c !== "object") {
				/* 结构缺失时补一份零值，避免后续读取 undefined 崩 */
				V.crime[t] = { current: 0, history: 0, daily: 0, count: 0, countHistory: 0 };
			} else {
				c.current = 0;
				c.count = 0;
				c.daily = 0;
				c.history = 0;
				c.countHistory = 0;
			}
			touched++;
		});
		V.crime.events = {};
		mbCEVanillaTrace("crime", before, "crime", "清空全部犯罪记录（含 history / countHistory / 事件日志）");
		return {
			ok: true,
			touched: touched,
			message: "已清空 " + touched + " 类犯罪记录：current / count / daily / history / countHistory 全归零，事件日志清空（原版作弊页只能清前四项，案底清不掉）"
		};
	}

	function mbCEVanillaAntiqueState() {
		var V = getV();
		var ma = V && V.museumAntiques;
		if (!ma || typeof ma !== "object" || !ma.antiques || typeof ma.antiques !== "object") { return null; }
		return ma;
	}


	/* ② 古董：一次性「收集」（状态写 found = 已找到未上交），不写 museum（不结算奖金、不动 museumCount）；
	   成就直写 V.feats.currentSave（earnFeat 在作弊模式被门控，等不到原版结算）。 */
	function mbCEVanillaAntiqueCollect() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var ma = mbCEVanillaAntiqueState();
		if (!ma) { return { ok: false, message: "未找到 $museumAntiques（该存档还没进入博物馆线）" }; }
		var before = {
			kind: "antique",
			antiques: mbCEVanillaClone(ma.antiques),
			paintings: mbCEVanillaClone(ma.paintings),
			museumCount: ma.museumCount,
			stolenCount: ma.stolenCount,
			recoveredCount: ma.recoveredCount,
			maxCount: ma.maxCount,
			hints: mbCEVanillaClone(V.museumAntiqueJournalHints),
			hadFeat: false
		};
		try {
			before.hadFeat = !!(V.feats && V.feats.currentSave && V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] !== undefined);
		} catch (eB) {}

		var got = 0;
		Object.keys(ma.antiques).forEach(function (k) {
			if (ma.antiques[k] !== "found") { ma.antiques[k] = "found"; got++; }
		});
		/* 画作：museumPaintingGet 只认 notFound→found，写 found 即「已发现未上交」 */
		if (ma.paintings && typeof ma.paintings === "object") {
			Object.keys(ma.paintings).forEach(function (k) {
				if (ma.paintings[k] !== "found") { ma.paintings[k] = "found"; got++; }
			});
		}
		/* maxCount 兜底：原版由一个 always-run widget 每次补，存档里可能还没跑过 */
		if (!(Number(ma.maxCount) > 0)) { ma.maxCount = Object.keys(ma.antiques).length; }
		/* 期刊提示指向「未发现位置」，全部 found 后失去意义（原版 found 迁移时也会逐条清） */
		try { V.museumAntiqueJournalHints = []; } catch (eH) {}

		var featOk = false;
		var featNew = false;
		try {
			if (V.feats && typeof V.feats === "object") {
				if (!V.feats.currentSave || typeof V.feats.currentSave !== "object") { V.feats.currentSave = {}; }
				if (V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] === undefined) {
					V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] = new Date();
					featNew = true;
				}
				featOk = true;
			}
		} catch (eFeat) { featOk = false; }

		mbCEVanillaTrace("antique", before, "museumAntiques", "博物馆古董一次性收集（found，不上交）+ 成就直写");
		var msg = got > 0
			? "已收齐 " + got + " 件（古董 " + Object.keys(ma.antiques).length + " + 画作 " + (before.paintings ? Object.keys(before.paintings).length : 0) + "），状态为「已发现未上交」——不会结算博物馆奖金。"
			: "古董已是全部「已发现未上交」状态，未重复写入。";
		if (featNew) { msg += " 成就「It Belongs in a Museum」已解锁。"; }
		else if (featOk) { msg += " 成就「It Belongs in a Museum」此前已解锁。" ; }
		else { msg += " 成就写入失败：该存档缺少 $feats 结构。"; }
		return { ok: true, got: got, feat: featNew, message: msg };
	}

	function mbCEVanillaNpcIdx(name) {
		try {
			if (typeof setup !== "undefined" && setup && Array.isArray(setup.NPCNameList)) { return setup.NPCNameList.indexOf(name); }
		} catch (e) {}
		return -1;
	}

	function mbCEVanillaNpcObj(V, name) {
		try {
			var i = mbCEVanillaNpcIdx(name);
			if (i < 0 || !Array.isArray(V.NPCName) || !V.NPCName[i] || typeof V.NPCName[i] !== "object") { return null; }
			return V.NPCName[i];
			/* 说明：C.npc.X 与 V.NPCName[idx] 是同一引用（initCNPC L55584–L55590），改一处即落档 */
		} catch (e) { return null; }
	}


	/* ③ 雷米头衔写「疤面」；飞升线按需补 Harper / Avery，关掉原版幂等回滚分支 */
	function mbCEVanillaRemyScar() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var remy = mbCEVanillaNpcObj(V, "Remy");
		if (!remy) { return { ok: false, message: "未找到 Remy（$NPCName 缺少该角色，可能不是标准存档）" }; }
		var harper = mbCEVanillaNpcObj(V, "Harper");
		var avery = mbCEVanillaNpcObj(V, "Avery");
		var before = {
			kind: "title",
			remy: remy.title,
			harper: harper ? harper.title : undefined,
			avery: avery ? avery.title : undefined,
			fate: V.avery_fate
		};
		remy.title = "scarred";
		var guard = false;
		var guardMiss = false;
		if (V.avery_fate === "ascended") {
			if (harper && harper.title !== "silver fox") { harper.title = "silver fox"; guard = true; }
			if (avery && avery.title !== "crimson hound") { avery.title = "crimson hound"; guard = true; }
			if (!harper || !avery) { guardMiss = true; }
		}
		mbCEVanillaTrace("title", before, "NPCName", "雷米头衔改为疤面（scarred）");
		var msg = "雷米头衔已写为「疤面」（scarred）";
		if (V.avery_fate === "ascended") {
			msg += guard
				? "；飞升线：已同步补 Harper=银狐狸、Avery=猩红猎犬，原版结算不会再把它改回高麋鹿"
				: "；飞升线：Harper/Avery 已在位，原版结算不会覆盖";
			if (guardMiss) { msg += "（注意：Harper 或 Avery 不在 $NPCName 中，回滚守卫可能失效）"; }
		} else {
			msg += "；当前不是飞升线（$avery_fate=" + (V.avery_fate || "空") + "），原版本就写疤面";
		}
		return { ok: true, guard: guard, message: msg };
	}

	function mbCEVanillaExtState() {
		return {
			crime: mbCEVanillaCrimeStats(),
			antique: mbCEVanillaAntiqueStats(),
			title: mbCEVanillaTitleStats()
		};
	}

	/* 回退：按 id 还原整块快照（vcore 类型由 08c 统一回退中心分发） */
	function mbCEVanillaExtUndo(id) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var key = "vcore:" + id;
		var rec = V.mbCE_wrote && V.mbCE_wrote[key];
		if (!rec || !rec.before || typeof rec.before !== "object") {
			return { ok: false, message: "该留痕已不存在（可能已回退或超出保留窗口）" };
		}
		var b = rec.before;
		try {
			if (b.kind === "crime") {
				if (!V.crime || typeof V.crime !== "object") { return { ok: false, message: "犯罪结构已不在，无法回退" }; }
				var types = mbCEVanillaCrimeTypes();
				types.forEach(function (t) {
					var snap = b.crime ? b.crime[t] : undefined;
					if (!snap) {
						/* 首次写入前该类型不存在 → 回退即删除 */
						try { delete V.crime[t]; } catch (eD) {}
						return;
					}
					var c = V.crime[t];
					if (!c || typeof c !== "object") { c = {}; V.crime[t] = c; }
					c.current = snap.current;
					c.history = snap.history;
					c.daily = snap.daily;
					c.count = snap.count;
					c.countHistory = snap.countHistory;
				});
				V.crime.events = b.events || {};
				delete V.mbCE_wrote[key];
				return { ok: true, message: "已还原犯罪记录（current / history / daily / count / countHistory 与事件日志）" };
			}
			if (b.kind === "antique") {
				var ma = mbCEVanillaAntiqueState();
				if (!ma) { return { ok: false, message: "博物馆结构已不在，无法回退" }; }
				if (b.antiques && typeof b.antiques === "object") {
					Object.keys(ma.antiques).forEach(function (k) {
						ma.antiques[k] = (b.antiques[k] !== undefined) ? b.antiques[k] : "notFound";
					});
				}
				if (ma.paintings && typeof ma.paintings === "object") {
					Object.keys(ma.paintings).forEach(function (k) {
						if (b.paintings && b.paintings[k] !== undefined) { ma.paintings[k] = b.paintings[k]; }
					});
				}
				ma.museumCount = b.museumCount;
				ma.stolenCount = b.stolenCount;
				ma.recoveredCount = b.recoveredCount;
				if (b.maxCount !== undefined) { ma.maxCount = b.maxCount; }
				try { V.museumAntiqueJournalHints = b.hints || []; } catch (eH2) {}
				try {
					if (V.feats && V.feats.currentSave) {
						if (b.hadFeat) {
							if (V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] === undefined) { V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] = new Date(); }
						} else {
							delete V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM];
						}
					}
				} catch (eF2) {}
				delete V.mbCE_wrote[key];
				return { ok: true, message: "已还原古董状态与成就标记" };
			}
			if (b.kind === "title") {
				var remy = mbCEVanillaNpcObj(V, "Remy");
				if (!remy) { return { ok: false, message: "Remy 已不在 $NPCName，无法回退" }; }
				remy.title = b.remy;
				var harper2 = mbCEVanillaNpcObj(V, "Harper");
				if (harper2 && b.harper !== undefined) { harper2.title = b.harper; }
				var avery2 = mbCEVanillaNpcObj(V, "Avery");
				if (avery2 && b.avery !== undefined) { avery2.title = b.avery; }
				delete V.mbCE_wrote[key];
				return { ok: true, message: "已还原 Remy 头衔为「" + mbCEVanillaTitleZh(b.remy) + "」" };
			}
			return { ok: false, message: "未知的留痕类型：" + String(b.kind) };
		} catch (eUndo) {
			var eMsg = String(eUndo);
			if (eUndo && typeof eUndo === "object" && "message" in eUndo) { eMsg = String(eUndo.message); }
			return { ok: false, message: "回退异常：" + eMsg };
		}
	}

	function mbCEVanillaHasTrace(id) {
		try {
			var V = getV();
			return !!(V && V.mbCE_wrote && V.mbCE_wrote["vcore:" + id]);
		} catch (e) { return false; }
	}

/* 职责：全局页 ⑧「原版档案 · 收藏 · 头衔」的统计快照与区块渲染（07l-vanilla-ext.js 的视图层）。
   数据层（清犯罪 / 收古董 / 写头衔 / 回退）在同名主段；本段只读状态、不写存档。
   拆段原因：结构门禁 S1（单段 400 行上限）。 */

	/* 犯罪统计：各类 current / history / countHistory 合计 + 事件日志条数 */
	function mbCEVanillaCrimeStats() {
		var V = getV();
		var out = { ok: false, types: 0, current: 0, history: 0, countHistory: 0, events: 0, has: false };
		if (!V || !V.crime || typeof V.crime !== "object") { return out; }
		out.has = true;
		var types = mbCEVanillaCrimeTypes();
		out.types = types.length;
		types.forEach(function (t) {
			var c = V.crime[t];
			if (!c || typeof c !== "object") { return; }
			out.current += Number(c.current) || 0;
			out.history += Number(c.history) || 0;
			out.countHistory += Number(c.countHistory) || 0;
		});
		try {
			if (V.crime.events && typeof V.crime.events === "object") {
				Object.keys(V.crime.events).forEach(function (k) {
					var arr = V.crime.events[k];
					out.events += Array.isArray(arr) ? arr.length : 0;
				});
			}
		} catch (eEv) {}
		out.ok = true;
		return out;
	}
	function mbCEVanillaAntiqueStats() {
		var V = getV();
		var out = { ok: false, total: 0, found: 0, museum: 0, maxCount: 0, paintings: 0, paintingsFound: 0, feat: false, has: false };
		var ma = mbCEVanillaAntiqueState();
		if (!ma) { return out; }
		out.has = true;
		var keys = Object.keys(ma.antiques);
		out.total = keys.length;
		keys.forEach(function (k) { if (ma.antiques[k] === "found") { out.found++; } });
		out.museum = Number(ma.museumCount) || 0;
		out.maxCount = Number(ma.maxCount) || 0;
		if (ma.paintings && typeof ma.paintings === "object") {
			Object.keys(ma.paintings).forEach(function (k) {
				out.paintings++;
				if (ma.paintings[k] === "found") { out.paintingsFound++; }
			});
		}
		try {
			out.feat = !!(V && V.feats && V.feats.currentSave && V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] !== undefined);
		} catch (eF) {}
		out.ok = true;
		return out;
	}
	function mbCEVanillaTitleStats() {
		var V = getV();
		var out = { ok: false, exists: false, remy: "", remyZh: "", harper: "", avery: "", fate: "" };
		if (!V) { return out; }
		var remy = mbCEVanillaNpcObj(V, "Remy");
		if (!remy) { return out; }
		out.exists = true;
		out.remy = String(remy.title === undefined ? "" : remy.title);
		out.remyZh = mbCEVanillaTitleZh(out.remy);
		var harper = mbCEVanillaNpcObj(V, "Harper");
		var avery = mbCEVanillaNpcObj(V, "Avery");
		out.harper = harper ? String(harper.title === undefined ? "" : harper.title) : "";
		out.avery = avery ? String(avery.title === undefined ? "" : avery.title) : "";
		out.fate = String(V.avery_fate === undefined ? "" : V.avery_fate);
		out.ok = true;
		return out;
	}
	/* 全局页 ⑧ 区块 */
	function mbCERenderVanillaExt(pane) {
		var sec = mceNewSec(pane, 10, "原版档案 · 收藏 · 头衔",
			"朋友三项原版作弊的直写通道：① 犯罪记录连案底一起清；② 博物馆古董一次性收齐（只收集不上交，成就同步解锁）；③ 雷米头衔写「疤面」。全部写入留痕可在「统一回退中心」逐条还原。");
		var V = getV();
		if (!V) {
			sec.appendChild(el("div", "mce-hint", "游戏尚未就绪，暂不可写。"));
			return;
		}

		function makeBody(groupTitle, subTitle) {
			var g = mceNewGroup(sec, groupTitle, subTitle);
			var body = el("div", "mce-vcore-body");
			g.appendChild(body);
			return body;
		}

		function clearBody(body) {
			while (body.firstChild) { body.removeChild(body.firstChild); }
		}

		function undoBtn(body, id, redraw) {
			if (!mbCEVanillaHasTrace(id)) { return; }
			var ub = el("button", "mce-btn mce-red", "回退");
			ub.type = "button";
			ub.title = "还原到首次写入前状态";
			ub.addEventListener("click", function () {
				var ru = mbCEVanillaExtUndo(id);
				setStatus(ru.message, ru.ok ? "mce-ok" : "mce-err");
				if (ru.ok) { redraw(); }
			});
			body.appendChild(ub);
		}

		/* ⑧-1 犯罪档案 */
		var cBody = makeBody("犯罪档案", "原版 $crime：10 类 × current / count / daily / history / countHistory + 事件日志（$crime.events）");
		var redrawCrime = function () {
			clearBody(cBody);
			var st = mbCEVanillaCrimeStats();
			if (!st.has) {
				cBody.appendChild(el("div", "mce-hint", "未找到 $crime（该存档没有犯罪记录结构）。"));
				return;
			}
			cBody.appendChild(el("div", "mce-hint",
				"当前：现存罪值合计 " + st.current + " · 案底合计 " + st.history + " · 案底次数合计 " + st.countHistory + " · 事件日志 " + st.events + " 条"));
			var grid = mceBtnGrid(cBody);
			var b = el("button", "mce-btn mce-gold", "一键清空全部犯罪记录（含案底）");
			b.type = "button";
			b.title = "current / count / daily / history / countHistory 全归零，事件日志清空";
			b.addEventListener("click", function () {
				var r = mbCEVanillaCrimeClear();
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) { redrawCrime(); }
			});
			grid.appendChild(b);
			cBody.appendChild(mceFoldHint("原版自己的清犯罪按钮只写 current / count / daily + clearEvents，history 与 countHistory 清不掉——那两项就是警方看到的「案底」。本项补齐后，犯罪界面与案底判定都归零。"));
			undoBtn(cBody, "crime", redrawCrime);
		};
		redrawCrime();

		/* ⑧-2 博物馆收藏 */
		var aBody = makeBody("博物馆收藏", "原版 $museumAntiques：64 件古董 + 2 幅画作；写成「已发现未上交」不结算奖金");
		var redrawAntique = function () {
			clearBody(aBody);
			var st = mbCEVanillaAntiqueStats();
			if (!st.has) {
				aBody.appendChild(el("div", "mce-hint", "未找到 $museumAntiques（该存档还没进入博物馆线）。"));
				return;
			}
			aBody.appendChild(el("div", "mce-hint",
				"当前：古董已发现 " + st.found + "/" + st.total + " · 已上交 " + st.museum + "/" + st.maxCount
				+ " · 画作已发现 " + st.paintingsFound + "/" + st.paintings
				+ " · 成就「It Belongs in a Museum」" + (st.feat ? "已解锁" : "未解锁")));
			var grid2 = mceBtnGrid(aBody);
			var b2 = el("button", "mce-btn mce-gold", "一键收齐古董（只收集，不上交）");
			b2.type = "button";
			b2.title = "全部写成 found 态；不动 museumCount、不结算奖金；同时直写「It Belongs in a Museum」成就";
			b2.addEventListener("click", function () {
				var r = mbCEVanillaAntiqueCollect();
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) { redrawAntique(); }
			});
			grid2.appendChild(b2);
			aBody.appendChild(mceFoldHint("写成 found = 已发现未上交：博物馆柜子仍空、不结算金币，之后你愿意上交时再逐件走「上交」流程即可。成就在作弊模式下会被原版 earnFeat 门控拦掉（V.cheatsEnabled === true 直接 return），所以这里直接写进成就表。"));
			undoBtn(aBody, "antique", redrawAntique);
		};
		redrawAntique();

		/* ⑧-3 NPC 头衔 */
		var tBody = makeBody("NPC 头衔", "雷米 Remy · 疤面（scarred）；飞升线会连带补 Harper / Avery 防回滚");
		var redrawTitle = function () {
			clearBody(tBody);
			var st = mbCEVanillaTitleStats();
			if (!st.exists) {
				tBody.appendChild(el("div", "mce-hint", "未找到 Remy（$NPCName 缺少该角色）。"));
				return;
			}
			tBody.appendChild(el("div", "mce-hint",
				"当前：雷米「" + st.remyZh + "」（" + (st.remy || "空") + "）"
				+ (st.fate ? " · $avery_fate=" + st.fate : "")
				+ (st.harper ? " · Harper「" + mbCEVanillaTitleZh(st.harper) + "」" : "")
				+ (st.avery ? " · Avery「" + mbCEVanillaTitleZh(st.avery) + "」" : "")));
			var grid3 = mceBtnGrid(tBody);
			var b3 = el("button", "mce-btn mce-gold", "雷米头衔 → 疤面");
			b3.type = "button";
			b3.title = "写 C.npc.Remy.title = \"scarred\"；飞升线同时补 Harper=silver fox、Avery=crimson hound";
			b3.addEventListener("click", function () {
				var r = mbCEVanillaRemyScar();
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) { redrawTitle(); }
			});
			grid3.appendChild(b3);
			tBody.appendChild(mceFoldHint("原版飞升线给 Remy 写 high elk，疤面只在「非飞升」分支。而且那段结算是幂等守卫（Harper 不是银狐狸就重跑），所以只写 Remy 会在下次结算被改回去——本项按需连 Harper / Avery 一起补齐，让守卫条件不成立。"));
			undoBtn(tBody, "title", redrawTitle);
		};
		redrawTitle();
	}
	/* ============ v1.5.0 誓言修复 + NPC 特质获取（对应游戏「特质」页 · 一般/NPC 特质分组） ============ */
	// NPC 特质：原版 0.5.12.13 Traits widget「NPC Traits」分组逐项照抄 has 条件与文案（汉化名）
	var NPC_TRAITS = [
		{ key: "robin_protector", name: "同舟共济—罗宾", en: "Robin's Protector", desc: "罗宾依赖着你，你需要变强。增加每日创伤恢复。",
			owned: function () { return getV().robinpaid >= 1; },
			grant: function () { getV().robinpaid = 1; return { ok: true, message: "已满足「同舟共济—罗宾」条件（robinpaid = 1）" }; } },
		{ key: "stockholm_eden", name: "斯德哥尔摩综合征：伊甸", en: "Stockholm Syndrome: Eden", desc: "孤身一人住在树林里的滋味一定不好受。",
			owned: function () { return getV().syndromeeden >= 1; },
			grant: function () { getV().syndromeeden = 1; return { ok: true, message: "已满足「斯德哥尔摩综合征：伊甸」条件（syndromeeden = 1）" }; } },
		{ key: "stockholm_kylar", name: "斯德哥尔摩综合征：凯拉尔", en: "Stockholm Syndrome: Kylar", desc: "每个人都需要一个朋友。",
			owned: function () { return getV().syndromekylar >= 1; },
			grant: function () {
				getV().syndromekylar = 1;
				var extra = "";
				try {
					if (typeof C !== "undefined" && C && C.npc && C.npc.Kylar && C.npc.Kylar.state === "prison" && getV().location !== "prison") {
						extra = "（凯拉尔当前在监狱，特质页暂不显示——NPC 状态不改）";
					}
				} catch (e) {}
				return { ok: true, message: "已满足「斯德哥尔摩综合征：凯拉尔」条件（syndromekylar = 1）" + extra };
			} },
		{ key: "stockholm_wolves", name: "斯德哥尔摩综合征：狼群", en: "Stockholm Syndrome: Wolves", desc: "它们只是可爱的动物（或怪物）。",
			owned: function () { return getV().syndromewolves >= 1; },
			grant: function () { getV().syndromewolves = 1; return { ok: true, message: "已满足「斯德哥尔摩综合征：狼群」条件（syndromewolves = 1）" }; } },
		{ key: "stockholm_hawk", name: "斯德哥尔摩综合征：巨鹰", en: "Stockholm Syndrome: Great Hawk", desc: "它只是想要一个伴侣。",
			owned: function () { return getV().syndromebird >= 1; },
			grant: function () { getV().syndromebird = 1; return { ok: true, message: "已满足「斯德哥尔摩综合征：巨鹰」条件（syndromebird = 1）" }; } },
		{ key: "avery_saviour", name: "艾弗里的救星", en: "Avery's Saviour", desc: "你救了艾弗里的命。愤怒每日衰减。",
			owned: function () { return getV().avery_fate === "saved" || getV().mceAveryShelter === true; },
			grant: function (mode) {
				var v = getV();
				var m = mode || "saved";
				if (m === "shelter") {
					/* 庇护模式：只挂 MCE 标记，不改 avery_fate——大楼/高塔保留正常建造进度，不走原版救星结局线 */
					if (!v.mceAveryShelter) {
						v.mceAveryShelter = true;
						v.mceAveryFateSnapshot = (v.avery_fate === undefined) ? "undefined" : v.avery_fate;
					}
					return { ok: true, message: "庇护模式已启用：获得「艾弗里的救星」效果（愤怒每日衰减），avery_fate 未改动——大楼/高塔保留建造进度，不走原版救星结局线。" };
				}
				/* 原版线：avery_fate = saved（高塔转烧毁态，与原版 Save Avery 结局一致） */
				if (v.avery_fate !== "saved") {
					v.mceAveryFateSnapshot = (v.avery_fate === undefined) ? "undefined" : v.avery_fate;
				}
				v.avery_fate = "saved";
				return { ok: true, message: "已满足「艾弗里的救星」条件（avery_fate = saved，原版救星线：高塔转为烧毁态）" };
			},
			revert: function () {
				var v = getV();
				var wasShelter = !!v.mceAveryShelter;
				var snap = v.mceAveryFateSnapshot;
				var wasSaved = v.avery_fate === "saved";
				delete v.mceAveryShelter;
				delete v.mceAveryFateSnapshot;
				var msg;
				if (wasSaved && snap !== undefined) {
					if (snap === "undefined") { delete v.avery_fate; msg = "avery_fate 已还原为操作前状态（未定义）"; }
					else { v.avery_fate = snap; msg = "avery_fate 已还原为 " + snap; }
				} else {
					msg = "avery_fate 保持原状（" + (v.avery_fate === undefined ? "未定义" : v.avery_fate) + "）";
				}
				return { ok: true, message: "已撤回「艾弗里的救星」" + (wasShelter ? "（庇护标记已清除；" : "（") + msg + "）——大楼/高塔恢复操作前状态" };
			} }
	];
	// 神殿誓言状态（原版 Traits widget 一般特质分组：Chastity Vow / Broken Vow / Rite of Promise / Broken Promise）
	function getVowStatus() {
		var v = getV();
		var temple = (v.player && v.player.virginity) ? v.player.virginity.temple : undefined;
		return {
			temple: temple,
			templePromised: v.templePromised || "",
			templeRank: v.temple_rank,
			templeBurden: v.temple_burden || 0,
			brokenVowCount: (v.brokenVowCount && typeof v.brokenVowCount === "object") ? v.brokenVowCount : {}
		};
	}
	// 一键修复誓言：恢复 player.virginity.temple=true（原版破坏点写 NPC 名/false），清空各角色破誓计数；承诺对象保留（恢复后显示 Rite of Promise）
	function fixVows() {
		var v = getV();
		var before = getVowStatus();
		if (!v.player) { v.player = {}; }
		if (!v.player.virginity) { v.player.virginity = {}; }
		v.player.virginity.temple = true;
		var bvc = v.brokenVowCount;
		if (bvc && typeof bvc === "object") {
			Object.keys(bvc).forEach(function (k) { bvc[k] = 0; });
		}
		var after = getVowStatus();
		return {
			ok: true, before: before, after: after,
			message: "誓言已修复：Temple Vow = 未破" + (before.templePromised ? "（承诺对象「" + before.templePromised + "」保留，显示为 Rite of Promise）" : "；破誓计数已清零")
		};
	}
	// 特质列表（渲染用：含是否已拥有）
	function listNpcTraits() {
		return NPC_TRAITS.map(function (t) {
			return { key: t.key, name: t.name, en: t.en, desc: t.desc, owned: !!t.owned() };
		});
	}
	// 获取指定 NPC 特质：条件不满足时直接把条件变量改为满足；mode 可选（avery_saviour 支持 shelter 庇护模式）
	function grantNpcTrait(key, mode) {
		var t = null, i;
		for (i = 0; i < NPC_TRAITS.length; i++) { if (NPC_TRAITS[i].key === key) { t = NPC_TRAITS[i]; break; } }
		if (!t) { return { ok: false, message: "未知特质 " + key }; }
		return t.grant(mode);
	}
	// 撤回指定 NPC 特质：恢复操作前状态（目前 avery_saviour 支持快照回退）
	function revertNpcTrait(key) {
		var t = null, i;
		for (i = 0; i < NPC_TRAITS.length; i++) { if (NPC_TRAITS[i].key === key) { t = NPC_TRAITS[i]; break; } }
		if (!t) { return { ok: false, message: "未知特质 " + key }; }
		if (typeof t.revert !== "function") { return { ok: false, message: "该特质不支持撤回" }; }
		return t.revert();
	}

	/* v1.9.13 时间调节（全局页）：DoL 0.5.12.13 时间系统 = 全局 Time 对象（非 V.timer 行动点）：
	   Time.set(V.timeStamp + delta*60) 快进（V.timeStamp 为秒级存档键）、
	   Time.setTime(h, m) 跳指定时分（日期/星期随引擎联动）。
	   直接改全局时间、不写 V 存档键 → 不进 mbCE_wrote 留痕，即时生效、无需回退。 */
	function mcTimeNow() {
		try {
			if (typeof Time === "undefined" || !Time) { return null; }
			return {
				hour: typeof Time.hour === "number" ? Time.hour : 0,
				minute: typeof Time.minute === "number" ? Time.minute : 0,
				weekDay: typeof Time.weekDay === "number" ? Time.weekDay : 0
			};
		} catch (e) { return null; }
	}
	function mcTimeAdvance(minutes) {
		try {
			var V = getV();
			if (!V || typeof Time === "undefined" || !Time || typeof Time.set !== "function") {
				return { ok: false, message: "时间系统不可用（需在游戏内运行）" };
			}
			var delta = Math.max(0, Number(minutes) || 0);
			var ts = Number(V.timeStamp);
			if (!Number.isFinite(ts)) { ts = 0; }
			Time.set(ts + delta * 60);
			return { ok: true, message: "时间已前进 " + delta + " 分钟" };
		} catch (e) {
			return { ok: false, message: "时间前进失败：" + mbCEErr(e) };
		}
	}
	function mcTimeJump(hour, minute) {
		try {
			if (typeof Time === "undefined" || !Time || typeof Time.setTime !== "function") {
				return { ok: false, message: "时间系统不可用（Time.setTime 缺失）" };
			}
			var h = Number(hour) || 0, m = Number(minute) || 0;
			Time.setTime(h, m);
			return { ok: true, message: "时间已设为 " + h + ":" + (m < 10 ? "0" : "") + m };
		} catch (e) {
			return { ok: false, message: "时间调整失败：" + mbCEErr(e) };
		}
	}
/* 职责：全局页渲染（renderGlobal）—— 批量操作 / 世界数值 / 原版态度 / 庄园维护等分组 */
	function renderGlobal() {
		var pane = root.querySelector('[data-pane="global"]');
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架。"));
			return;
		}
		/* v1.9.11+：悬浮入口固定按钮（锁定/解锁右下角金色「解锁」球的拖动；
		   悬浮球是面板唯一入口，不提供隐藏——隐藏即死锁） */
		var fabLocked = !!(toggleBtn && toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1");
		var fabWrap = el("div", "mce-row");
		var fabBtn = el("button", "mce-btn", fabLocked ? "解锁悬浮球拖动" : "锁定悬浮球拖动");
		fabBtn.type = "button";
		fabBtn.title = fabLocked
			? "悬浮球拖动已锁定（点击仍可开关面板）；点此解锁后可再次拖动"
			: "点此锁定悬浮球拖动（固定不动，不再误拖/挡操作）；点击悬浮球本身仍可开关面板";
		fabBtn.addEventListener("click", function () {
			if (!toggleBtn) { return; }
			var nowLocked = !!(toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1");
			toggleBtn.dataset.mceLocked = nowLocked ? "0" : "1";
			toggleBtn.title = nowLocked
				? "Maplebirch CE 剧情条件解锁面板（可拖动：按住移到任意位置，位置自动记忆）"
				: "Maplebirch CE 剧情条件解锁面板（拖动已锁定：点击开关面板，到「全局」页解锁拖动）";
			try {
				if (typeof localStorage !== "undefined" && localStorage) {
					localStorage.setItem("mbCE_toggle_lock_v1", nowLocked ? "0" : "1");
				}
			} catch (e) {}
			renderGlobal();
		});
		fabWrap.appendChild(fabBtn);
		/* v2.0.2 按键重排：原先"悬浮球行 + 一句提示 + 6 个金色按钮裸堆"占了整屏第一屏、且按钮语义混杂；
		   现在把面板设置收进不编号的分组，批量按钮按「速成 / 收集」拆两块并走 2 列网格。 */
		var fabGroup = mceNewGroup(pane, "面板设置", "悬浮入口 · 不占区块编号");
		fabGroup.appendChild(el("div", "mce-row-lbl", "面板悬浮入口（右下角金色「解锁」球）"));
		fabGroup.appendChild(fabWrap);
		var chars = listCharacters();
		fabGroup.appendChild(el("div", "mce-hint", "自动枚举角色 " + chars.length + " 个（本体 + 全部 MOD）。以下操作对全部角色生效。"));

		/* ① 批量速成（全角色） */
		var bsec = mceNewSec(pane, 1, "批量速成（全角色）", "对枚举到的全部角色（本体 + 全部 MOD）一次性补齐：数值 / 恋爱阶段 / 转化阶段 / 玩家扩展转化。扩展转化在 MOD 未加载时自动跳过并给出提示，不会报错。");
		var bgrid = mceBtnGrid(bsec);
		var b1 = el("button", "mce-btn mce-gold", "全部角色：一键补齐全部数值");
		b1.type = "button";
		b1.addEventListener("click", function () {
			var r = globalFill();
			setStatus("已补齐 " + r.characters + " 个角色共 " + r.stats + " 项数值", "mce-ok");
		});
		var b2 = el("button", "mce-btn mce-gold", "全部角色：一键解锁全部恋爱阶段");
		b2.type = "button";
		b2.addEventListener("click", function () {
			var r = globalRomance();
			setStatus("恋爱阶段：" + r.fixed + " / " + r.total + " 已自动解锁", r.fixed > 0 ? "mce-ok" : "mce-err");
		});
		var b3 = el("button", "mce-btn mce-gold", "全部角色：一键解锁全部转化阶段");
		b3.type = "button";
		b3.addEventListener("click", function () {
			var r = globalTransform();
			setStatus("已解锁 " + r.characters + " 个角色的 " + r.stages + " 个转化类型", "mce-ok");
		});
		var b4 = el("button", "mce-btn mce-gold", "一键完成玩家扩展转化（兔子/人鱼等）");
		b4.type = "button";
		b4.addEventListener("click", function () {
			var n = 0;
			listExtTransforms().forEach(function (k) { if (completeExtTransform(k)) { n += 1; } });
			setStatus(n > 0 ? "扩展转化已全部解锁（" + n + " 项）" : "未检测到扩展转化（MOD 未加载）", n > 0 ? "mce-ok" : "mce-err");
		});
		bgrid.appendChild(b1);
		bgrid.appendChild(b2);
		bgrid.appendChild(b3);
		bgrid.appendChild(b4);

		/* ② 收集解锁 */
		var csec = mceNewSec(pane, 2, "收集解锁", "特殊服装（含对应故事）与食谱按原版解锁条件直写；未解锁项数量随 MOD 变化，点击后状态栏会报实际解锁件数。");
		var cgrid = mceBtnGrid(csec);
		var bc1 = el("button", "mce-btn mce-gold", "一键解锁所有特殊服装（含对应故事）");
		bc1.type = "button";
		bc1.addEventListener("click", function () {
			var r = globalUnlockClothes();
			setStatus("特殊服装：" + r.unlocked + " 件已解锁" + (r.stories > 0 ? "（补足对应故事 " + r.stories + " 项）" : ""), r.unlocked > 0 ? "mce-ok" : "mce-err");
		});
		var bc2 = el("button", "mce-btn mce-gold", "一键解锁所有食谱");
		bc2.type = "button";
		bc2.addEventListener("click", function () {
			var r = globalUnlockRecipes();
			setStatus("食谱：" + r.unlocked + " 个已解锁", r.unlocked > 0 ? "mce-ok" : "mce-err");
		});
		cgrid.appendChild(bc1);
		cgrid.appendChild(bc2);

		/* v1.9.13 时间调节区：快进即时生效，跳时段把时分设到指定点（日期/星期由引擎联动） */
		var tsec = mceNewSec(pane, 3, "时间调节", "直接改游戏时钟、即时生效、不进留痕；快进按钮即时前进，跳时段按钮把时分设到指定点（日期 / 星期由引擎联动）。");
		var tnow = mcTimeNow();
		var tInfo = tnow
			? ("当前 " + tnow.hour + ":" + (tnow.minute < 10 ? "0" : "") + tnow.minute + (tnow.weekDay ? " · 周" + tnow.weekDay : ""))
			: "时间系统不可用（需在游戏内运行）";
		tsec.appendChild(mceFoldHint(tInfo + "；快进按钮即时前进，跳时段按钮把时分设到指定点。直接改全局时钟、不进留痕。"));
		var tAdv = mceBtnGrid(tsec);
		[{ n: "+1 小时", v: 60 }, { n: "+3 小时", v: 180 }, { n: "+8 小时", v: 480 }, { n: "+1 天", v: 1440 }, { n: "+3 天", v: 4320 }].forEach(function (d) {
			var b = el("button", "mce-btn mce-gold", d.n); b.type = "button";
			b.addEventListener("click", function () {
				var r = mcTimeAdvance(d.v);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			tAdv.appendChild(b);
		});
		tsec.appendChild(tAdv);
		var tJump = mceBtnGrid(tsec);
		[{ n: "早 8:00", h: 8, m: 0 }, { n: "午 12:00", h: 12, m: 0 }, { n: "傍晚 18:00", h: 18, m: 0 }, { n: "夜 22:00", h: 22, m: 0 }, { n: "深 2:00", h: 2, m: 0 }].forEach(function (d) {
			var b = el("button", "mce-btn", d.n); b.type = "button";
			b.addEventListener("click", function () {
				var r = mcTimeJump(d.h, d.m);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			tJump.appendChild(b);
		});
		tsec.appendChild(tJump);
		/* v1.5.0：誓言修复 + NPC 特质获取（游戏「特质」页对应分组） */
		var vsec = mceNewSec(pane, 4, "誓言修复 · NPC 特质", "誓言修复把神殿誓言（Temple Vow）与相关承诺状态按原版语义还原；NPC 特质获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。「艾弗里的救星」支持两条线：原版线（高塔转烧毁）与庇护模式（不碰 avery_fate、保留大楼建造进度），且均可撤回。");
		var vst = getVowStatus();
		var vowTxt = "神殿誓言（Temple Vow）：" + (vst.temple === true ? "未破" : "已破（" + (vst.temple === false ? "未知" : String(vst.temple)) + "）");
		if (vst.templePromised) { vowTxt += "；承诺对象：" + vst.templePromised; }
		if (vst.templeRank) { vowTxt += "；神殿等级：" + vst.templeRank; }
		var vrow = el("div", "mce-row");
		vrow.appendChild(el("span", "mce-row-lbl", vowTxt));
		var vbtn = el("button", "mce-btn mce-gold", "一键修复誓言");
		vbtn.type = "button";
		vbtn.addEventListener("click", function () {
			var r = fixVows();
			setStatus(r.message, "mce-ok");
			renderGlobal();
		});
		vrow.appendChild(vbtn);
		vsec.appendChild(vrow);
		var traits = listNpcTraits();
		vsec.appendChild(mceFoldHint("NPC 特质 " + traits.length + " 项：获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。「艾弗里的救星」支持庇护模式与撤回。"));
		var tbox = el("div", "");
		traits.forEach(function (t) {
			if (t.key === "avery_saviour") {
				/* v1.9.2：救星特质双模式 + 撤回（庇护模式不碰 avery_fate，大楼保留） */
				var v2 = getV();
				var shelterOn = v2.mceAveryShelter === true;
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", (t.owned ? "✓ " : "") + t.name + "（" + t.en + "）——" + t.desc + (shelterOn ? "　【庇护模式生效中：大楼保留建造进度】" : (t.owned ? "　【原版线：高塔烧毁】" : ""))));
				if (t.owned) {
					var rbtn = el("button", "mce-btn mce-red", "撤回（恢复操作前状态）");
					rbtn.type = "button";
					rbtn.title = "移除救星标记/庇护标记，并按操作前快照还原 avery_fate，大楼/高塔恢复原状";
					(function (t2) {
						rbtn.addEventListener("click", function () {
							var r = revertNpcTrait(t2.key);
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(rbtn);
				} else {
					var b1 = el("button", "mce-btn mce-gold", "获取（原版线）");
					b1.type = "button";
					b1.title = "avery_fate = saved，高塔转烧毁态（原版 Save Avery 结局线）";
					(function (t2) {
						b1.addEventListener("click", function () {
							var r = grantNpcTrait(t2.key, "saved");
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(b1);
					var b2 = el("button", "mce-btn mce-gold", "获取（庇护模式）");
					b2.type = "button";
					b2.title = "不碰 avery_fate，保留大楼/高塔建造进度，只获得救星效果（不走救星结局线）";
					(function (t2) {
						b2.addEventListener("click", function () {
							var r = grantNpcTrait(t2.key, "shelter");
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(b2);
				}
				tbox.appendChild(row);
				return;
			}
			/* v2.0.12 自查：avery_saviour 分支（上文 L146）已在同一 forEach 回调内 var row，
			   此处再 var 属重复声明（ESLint no-redeclare）；var 不受块作用域约束，改用赋值复用。 */
			row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", (t.owned ? "✓ " : "") + t.name + "（" + t.en + "）——" + t.desc));
			var btn = el("button", "mce-btn" + (t.owned ? "" : " mce-gold"), t.owned ? "已拥有" : "获取");
			btn.type = "button";
			btn.disabled = t.owned;
			btn.addEventListener("click", function () {
				var r = grantNpcTrait(t.key);
				setStatus(r.ok ? r.message : r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			row.appendChild(btn);
			tbox.appendChild(row);
		});
		vsec.appendChild(tbox);

		/* v1.8.8：战斗终结（学 CombatTerminator 0.1：8 个战斗内一键按钮，直接写原版战斗值）。
		   原模组为 TweeReplacer 注入到战斗 widget；此处为 MCE 全局页即时按钮，等价写入。
		    v1.8.9：动作定义下沉至 03-global.js（COMBAT_ACTIONS/mcCombatAction），UI 只负责渲染。 */
		var btsec = mceNewSec(pane, 5, "战斗终结", "学 CombatTerminator 0.1：以下按钮直接写原版战斗值，建议战斗中生效；「结束集群」在战斗外会把游戏时钟拨回当日 0 点，请勿误点。");
		COMBAT_ACTIONS.forEach(function (d) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", d.desc));
			var btn = el("button", "mce-btn mce-gold", d.name);
			btn.type = "button";
			btn.addEventListener("click", function () {
				var r = mcCombatAction(d.key);
				setStatus(r.ok ? "已执行「" + r.name + "」" : r.message, r.ok ? "mce-ok" : "mce-err");
			});
			row.appendChild(btn);
			btsec.appendChild(row);
		});

		/* v1.8.8：庄园自动维护（学 AutoClean 0.1.5）
		   v1.9.x：一键按钮 → 自动开关。点击开关切换开启/关闭；开启即立即执行一次（即时生效），
		   此后每日（Time.days 变化）由 mbCEOnPassageInit 自动执行。开关持久化 localStorage
		   （mbCE_auto），不写 V → 不污染存档、新档不继承。 */
		var acsec = mceNewSec(pane, 6, "庄园自动维护", "学 AutoClean 0.1.5：每个开关独立，点击即切换开/关并立即执行一次（即时生效），此后每日（Time.days 变化）自动执行。开关状态持久化在 localStorage（mbCE_auto），不写存档、新档不继承。艾弗里未达喂食阶段（关系未确立）时投喂自动跳过。");
		var acItems = [
			{ key: "feed", name: "自动投喂艾弗里", desc: "按喜好 → 牛排/舒芙蕾/扁意面 → 最高难度菜谱；未达喂食阶段（关系未确立）不操作" },
			{ key: "farm", name: "自动农场维护", desc: "塔卫在岗且技能≥1000 锁四畜 30 / 清 agro；库存收获为食物并清零（cream 仅清理）" },
			{ key: "temple", name: "自动神殿维护", desc: "housekeeping≥1000 时宿舍=100，tending≥1000 时花园=100（原版顶层技能判定）" },
			{ key: "eden", name: "自动伊甸维护", desc: "伊甸菜地/菇桶/泉水锁 4" },
			{ key: "restock", name: "自动补给", desc: "肥皂/药膏不足 10 时补 10；鹰塔火坑≥3 且木材不足 10 时补 10" },
			{ key: "clean", name: "自动庄园打扫", desc: "艾弗里关系确立后：全部房间计数归零 + days_absent 归零" }
		];
		acItems.forEach(function (it) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", it.desc));
			var btn = el("button", "mce-btn mce-gold", it.name + "（关）");
			btn.type = "button";
			var refresh = function () {
				btn.textContent = it.name + (mcAutoIsOn(it.key) ? "（开）" : "（关）");
			};
			btn.addEventListener("click", function () {
				var on = !mcAutoIsOn(it.key);
				mcAutoSet(it.key, on);
				if (on) {
					var r = /** @type {any} */ (mcAutoRunOnce(it.key));
					var msg;
					if (r.error) { msg = it.name + "执行失败：" + r.error; }
					else if (r.skipped) { msg = it.name + "已开启（本次跳过：艾弗里关系未确立）"; }
					else if (it.key === "feed") { msg = r.missed ? it.name + "已开启，本次无菜可喂（dinner_missed+1）" : it.name + "已开启，本次已喂食：" + r.fed; }
					else if (it.key === "farm") { msg = it.name + "已开启，本次锁满 " + r.beasts + " 只、收获 " + r.harvested + " 类库存"; }
					else if (it.key === "temple") { msg = it.name + "已开启，本次宿舍" + (r.quarters ? "=100" : "未达标跳过") + "、花园" + (r.garden ? "=100" : "未达标跳过"); }
					else if (it.key === "eden") { msg = it.name + "已开启，本次锁定 " + r.locked + " 项为 4"; }
					else if (it.key === "restock") { msg = it.name + "已开启，本次肥皂" + (r.soap ? "=10" : "跳过") + "、药膏" + (r.salve ? "=10" : "跳过") + "、鹰塔木材" + (r.wood ? "=10" : "跳过"); }
					else { msg = it.name + "已开启，本次执行完成"; }
					setStatus(msg, r.error ? "mce-err" : "mce-ok");
				} else {
					setStatus(it.name + "已关闭", "mce-err");
				}
				refresh();
			});
			refresh();
			row.appendChild(btn);
			acsec.appendChild(row);
		});

		/* v2.0.3 回退语义补齐：维护写入留痕可见 + 一键回退（key = maint:<点号路径>，
	   before 保留「首次写入前」状态；写入前无该字段 → 回退即删除）。
	   只覆盖纯数值覆盖型维护（神殿/伊甸/补给/农场锁值/庄园打扫）；投喂与农场收获属状态机推进，不回退。 */
		var mtKeys = [];
		(function () {
			var Vt = getV();
			if (Vt && Vt.mbCE_wrote && typeof Vt.mbCE_wrote === "object") {
				Object.keys(Vt.mbCE_wrote).forEach(function (k) { if (k.indexOf("maint:") === 0) { mtKeys.push(k.slice(6)); } });
			}
		})();
		var mtRow = el("div", "mce-row");
		var mtLbl = el("span", "mce-row-lbl", mtKeys.length
			? ("已记录 " + mtKeys.length + " 项维护写入：" + mtKeys.slice(0, 6).join(" / ") + (mtKeys.length > 6 ? " …" : ""))
			: "暂无维护写入记录（开启任一维护项并实际改动数值后，在此显示并可回退）");
		mtRow.appendChild(mtLbl);
		if (mtKeys.length) {
			var mtUndoAll = el("button", "mce-btn mce-red", "撤回全部维护写入");
			mtUndoAll.type = "button";
			mtUndoAll.setAttribute("data-op", "maint-undo-all");
			mtUndoAll.title = "每项还原到维护写入前状态（写入前无该字段的直接删除）";
			mtUndoAll.addEventListener("click", function () {
				var ru = mbCEMaintUndoAll();
				setStatus(ru.msg, ru.ok ? "mce-ok" : "mce-err");
				if (ru.ok) { mtLbl.textContent = "已回退 " + ru.n + " 项维护写入（记录已清除）"; }
			});
			mtRow.appendChild(mtUndoAll);
		}
		acsec.appendChild(mtRow);

		/* v1.9.12：世界腐化（原版 World Corruption）数值调整
		   原版键：V.world_corruption_hard（世界硬腐化，罪孽/净化计数，原版宏 worldCorruption("hard",n) 钳 -30~30，初始 2）
		          V.world_corruption_soft（世界软腐化，世界异变程度，原版宏钳 0~100，初始 0）
		   语义（原版宏）：soft ≥30 增加怨灵聚合几率，≥70 触发校园衣物记忆；hard 负值走净化，净化量累计 world_corruption_reduced。
		   CE 直写 V 不经过原版 clamp：上限不钳制（数值填多少就是多少，原版事件驱动由游戏自身负责）；
		   下限按原版语义保留（hard ≥ -30，soft ≥ 0），防负值破坏。复用 placeStageWrite/placeStageUndo（原版顶层键直写 + 留痕回退）。 */
		var wcsec = mceNewSec(pane, 7, "世界腐化", "世界硬腐化 world_corruption_hard（罪孽/净化计数，原版 -30~30 初始 2）；世界软腐化 world_corruption_soft（世界异变程度，原版 0~100 初始 0，≥30 增加怨灵聚合几率、≥70 触发校园衣物记忆）。直接填数值：上限不钳制，下限按原版语义保留；净化总量记录于 world_corruption_reduced。");
		var Vg = getV();
		var makeWcUndo = function (row, it, val, inp) {
			var ub = el("button", "mce-btn mce-red", "回退");
			ub.type = "button";
			ub.title = "还原到首次写入前状态（写入前无该字段时直接删除）";
			ub.setAttribute("data-op", "wc-undo");
			ub.addEventListener("click", function () {
				var ru = placeStageUndo(it.key);
				setStatus(ru.message, ru.ok ? "mce-ok" : "mce-err");
				if (ru.ok) {
					var back = Number(getV() && getV()[it.key]) || 0;
					val.textContent = String(back);
					inp.value = String(back);
					var bb = row.querySelector('[data-op="wc-undo"]');
					if (bb && bb.parentNode) { bb.parentNode.removeChild(bb); }
				}
			});
			return ub;
		};
		[
			{ key: "world_corruption_hard", name: "世界硬腐化", min: -30 },
			{ key: "world_corruption_soft", name: "世界软腐化", min: 0 }
		].forEach(function (it) {
			var row = el("div", "mce-row");
			row.setAttribute("data-wckey", it.key);
			var cur = Number(Vg && Vg[it.key]) || 0;
			var lbl = el("span", "mce-row-lbl", it.name + "（" + it.key + "）当前 ");
			var val = el("span", "mce-value", String(cur));
			lbl.appendChild(val);
			row.appendChild(lbl);
			var inp = el("input", "mce-inp");
			inp.type = "number";
			inp.value = String(cur);
			inp.placeholder = String(cur);
			row.appendChild(inp);
			var apply = el("button", "mce-btn mce-gold", "应用");
			apply.type = "button";
			apply.addEventListener("click", function () {
				var r = placeStageWrite(it.key, Number(inp.value), it.min, Infinity);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) {
					val.textContent = String(r.after);
					inp.value = String(r.after);
					if (!row.querySelector('[data-op="wc-undo"]')) {
						row.appendChild(makeWcUndo(row, it, val, inp));
					}
				}
			});
			row.appendChild(apply);
			/* 已有写入留痕 → 初始即显示回退 */
			try {
				if (Vg && Vg.mbCE_wrote && Vg.mbCE_wrote["place:" + it.key]) {
					row.appendChild(makeWcUndo(row, it, val, inp));
				}
			} catch (e) {}
			wcsec.appendChild(row);
		});

		/* v2.0.9 需求②③④：原版档案 · 收藏 · 头衔（07l-vanilla-ext.js）
		   犯罪连案底一起清 / 古董只收集 + 成就 / 雷米疤面头衔 —— 三项各走独立 vcore 留痕，可在回退中心逐条还原 */
		mbCERenderVanillaExt(pane);

		/* v1.9.15 数值固定（07f-lock.js）：预设推荐 + 自定义 varPath 锁定向，1s 强制写回 */
		mbCERenderLock(pane);
		/* v2.0.0.002 潜伏者（07f-lurker.js）：捕捉上限等价解除 + 水烟馆冰箱（0–5）+ 农场蒸馏笼 */
		mbCERenderLurker(pane);
		/* v2.0.0.003 需求②：原版「你对什么感到不安?」直写（$uncomfortable，绕开 attitudesControl 重算门控） */
		renderAttitudesGroup(pane);
		/* v2.0.3 P4-1：统一回退中心（08c-undo-center.js）——收敛全部留痕回退入口 */
		mbCEUndoCenterRender(pane);
	}
	/* ============ v2.0.0.003 需求②：原版「你对什么感到不安?」直写 ============
	   对照 DoL 0.5.12.13 本体逐行实证（game\Degrees of Lewdity.html）：
	     · 默认值块 182418-182424：<<set $uncomfortable to {underwear:true, nude:true, prostituting:true, lewd:true, hypnosis:true}>>
	     · cheat 设置页渲染段 283966-284017：「What makes you feel uncomfortable?」
	       每项形如 <<if $attitudesControl.unlockXxx or $uncomfortable.xxx is false>> ... <<else>> disabled 灰勾 + 蓝字门槛 <</if>>
	     · 重算覆盖点 284869-284895 <<widget "attitudesControlCheck">>：
	         unlockExhibitionismUnderwear = V.exhibitionism >= 55
	         unlockExhibitionismNude      = V.exhibitionism >= 95
	         unlockProstitution           = V.soldCount >= 1 || V.docksrobinintro === 1
	         unlockLewd                   = V.exhibitionism >= 35 || V.promiscuity >= 35 || V.deviancy >= 35
	         unlockHypnosis               = Object.keys(V.hypnosis_traits).length >= 1
	   结论：写 $attitudesControl.unlock* 无效（每次刷新都被重算覆盖），
	   真正决定「这一项能不能改」的是 $uncomfortable.* 本身——它才是全游戏读取的最终生效值
	   （110132-110133 遮体判据 / 77312 露骨值衰减 / 202829+ 催眠接受判据）。
	   所以本面板直接写 $uncomfortable.*，不看门槛；门槛只作为说明展示。 ============ */
var MB_CE_ATTITUDE_ITEMS = [
	{ key: "underwear", gate: "unlockExhibitionismUnderwear", need: "exhibitionism>=55", name: "把内衣暴露出来",
		effect: "取消后，暴露 1 档（只走光）不再自动遮掩（本体 110132-110133：underwear && exposed>=1）" },
	{ key: "nude", gate: "unlockExhibitionismNude", need: "exhibitionism>=95", name: "在别人面前赤身裸体",
		effect: "取消后，暴露 2 档（全裸）不再自动遮掩（本体 110132-110133：nude && exposed>=2）" },
	{ key: "prostituting", gate: "unlockProstitution", need: "soldCount>=1 或 docksrobinintro===1", name: "出卖自己的身体以免受贝利的折磨",
		effect: "取消后，promiscuity 不够时也会多出「勉强顺从 / 开价接活」这类走投无路选项（本体 41 处 'is false' 分支，置 _desperateaction）" },
	{ key: "lewd", gate: "unlockLewd", need: "exhibitionism/promiscuity/deviancy 任一>=35（hard 模式不显示该项）", name: "反思你施加和承受过的折磨",
		effect: "取消后，三项不再每日 -1（本体 77312：gamemode !== hard 且 lewd 为真时各减 1；hard 模式本来就不衰减）" },
	{ key: "hypnosis", gate: "unlockHypnosis", need: "hypnosis_traits 非空（至少中过一次催眠）", name: "被催眠着做爱",
		effect: "取消后，催眠遮蔽效果直接判为 accepted（本体 202829：跳过 willpower 意志判定）" }
];
/* 门槛只作展示：返回该门的原版真实解锁状态 + 需要的数值条件（便于玩家自己判断要不要顺手抬数值） */
function mbCEAttitudeGate(gateKey) {
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	/** @type {any} forEach 内赋值，TS 无法收窄，显式声明避免 "never" 误判 */
	var item = null;
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) { if (it.gate === gateKey) { item = it; } });
	if (!item) { return null; }
	var unlocked = false;
	try { unlocked = !!(V && V.attitudesControl && V.attitudesControl[gateKey]); } catch (e2) { unlocked = false; }
	return { key: gateKey, need: item.need, ok: unlocked };
}
function mbCEAttitudeItem(key) {
	var hit = null;
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) { if (it.key === key) { hit = it; } });
	return hit;
}
function mbCEAttitudeGet(key) {
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	try { return (V && V.uncomfortable) ? V.uncomfortable[key] : undefined; } catch (e2) { return undefined; }
}
/* 直写最终生效值，复用 04b 的通用写入器 → 自动获得类型校验 + 首次 before 留痕 + 回退能力。
   modId 固定 vanilla-attitudes，留痕键 cheat:vanilla-attitudes:<key>，回退走 undoCheatModValue。 */
function mbCEAttitudeSet(key, val) {
	var item = mbCEAttitudeItem(key);
	if (!item) { return { ok: false, message: "未知不安项：" + key + "（可选 " + MB_CE_ATTITUDE_ITEMS.map(function (x) { return x.key; }).join(" / ") + "）" }; }
	if (val !== true && val !== false) { return { ok: false, message: "值必须是 true / false（布尔）" }; }
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	if (!V) { return { ok: false, message: "存档变量不可用" }; }
	if (!V.uncomfortable || typeof V.uncomfortable !== "object") { V.uncomfortable = {}; }
	return cheatWriteValue("vanilla-attitudes", key, "set", "uncomfortable." + key, val, "boolean");
}
function mbCEAttitudeSetAll(val) {
	if (val !== true && val !== false) { return { ok: false, message: "值必须是 true / false（布尔）" }; }
	var fails = [];
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) {
		var r = mbCEAttitudeSet(it.key, val);
		if (!r || !r.ok) { fails.push(it.key); }
	});
	if (fails.length) { return { ok: false, message: "部分失败：" + fails.join(" / ") }; }
	return { ok: true, message: "已把 5 项不安全部" + (val ? "恢复（重新勾选）" : "解除（取消勾选）") };
}
function mbCEAttitudeUndo(key) { return undoCheatModValue("vanilla-attitudes", key); }
function mbCEAttitudeHasTrace(key) {
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	try { return !!(V && V.mbCE_wrote && V.mbCE_wrote["cheat:vanilla-attitudes:" + key]); } catch (e2) { return false; }
}
/* 全局页分组：5 项逐条开关 + 一键全解除/全恢复 + 逐条回退 */
function renderAttitudesGroup(pane) {
	if (!pane) { return; }
	var box = el("div", "mce-grp");
	box.appendChild(el("div", "mce-row-lbl", "原版态度：你对什么感到不安?（$uncomfortable，等价原版 cheat 面板同一屏）"));
	box.appendChild(el("div", "mce-hint",
		"直接写最终生效值 $uncomfortable.*，不看 $attitudesControl.unlock* 门控——那组 unlock 每次刷新都会被原版 attitudesControlCheck 按真实数值重算覆盖，写它无效。门控条件只作说明展示。"));
	var V = null;
	try { V = getV(); } catch (e) { V = null; }
	if (!V || !V.uncomfortable || typeof V.uncomfortable !== "object") {
		box.appendChild(el("div", "mce-err", "存档里没有 $uncomfortable（请先读档；原版初始化后该对象才会存在）"));
		pane.appendChild(box);
		return;
	}
	/* 局部刷新：点击只改本行 DOM，不整页 renderGlobal()（全局页分组多，整页重建会丢滚动位置且卡帧） */
	var painters = [];
	function paintAttitudeRow(parts) {
		var val = mbCEAttitudeGet(parts.it.key);
		var state = (val === true) ? "不安（勾选）" : (val === false) ? "已解除（不勾选）" : "未初始化";
		var g = mbCEAttitudeGate(parts.it.gate);
		parts.lbl.textContent = parts.it.name + "：" + state;
		parts.lbl.title = parts.it.effect + "\n原版门槛：" + parts.it.need + (g && g.ok ? "（当前已满足）" : "（当前未满足，本面板照样能改）");
		parts.tog.textContent = (val === true) ? "解除不安" : "恢复不安";
		parts.tog.className = (val === true) ? "mce-btn mce-gold" : "mce-btn";
		var needUndo = mbCEAttitudeHasTrace(parts.it.key);
		if (needUndo && !parts.undo) {
			parts.undo = el("button", "mce-btn", "回退");
			parts.undo.type = "button";
			parts.undo.title = "还原为面板首次写入前的状态";
			parts.undo.addEventListener("click", function () {
				var r = mbCEAttitudeUndo(parts.it.key);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				paintAttitudeRow(parts);
			});
			parts.row.appendChild(parts.undo);
		} else if (!needUndo && parts.undo) {
			try { parts.row.removeChild(parts.undo); } catch (e2) { /* 已被整组重建移除 */ }
			parts.undo = null;
		}
	}
	MB_CE_ATTITUDE_ITEMS.forEach(function (it) {
		var parts = { it: it, row: el("div", "mce-row"), lbl: el("span", "mce-row-lbl", ""), tog: el("button", "mce-btn", ""), undo: null };
		parts.tog.type = "button";
		parts.tog.title = it.effect;
		parts.tog.addEventListener("click", function () {
			var now = mbCEAttitudeGet(it.key) === true;
			var r = mbCEAttitudeSet(it.key, !now);
			setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
			paintAttitudeRow(parts);
		});
		parts.row.appendChild(parts.lbl);
		parts.row.appendChild(parts.tog);
		paintAttitudeRow(parts);
		painters.push(function () { paintAttitudeRow(parts); });
		box.appendChild(parts.row);
	});
	var bulk = el("div", "mce-row");
	var offAll = el("button", "mce-btn mce-gold", "全部解除不安（5 项取消勾选）");
	offAll.type = "button";
	offAll.addEventListener("click", function () {
		var r = mbCEAttitudeSetAll(false);
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		painters.forEach(function (f) { try { f(); } catch (e2) { /* 单行刷新失败不影响其余 */ } });
	});
	bulk.appendChild(offAll);
	var onAll = el("button", "mce-btn", "全部恢复不安（5 项勾选）");
	onAll.type = "button";
	onAll.addEventListener("click", function () {
		var r = mbCEAttitudeSetAll(true);
		setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
		painters.forEach(function (f) { try { f(); } catch (e2) { /* 单行刷新失败不影响其余 */ } });
	});
	bulk.appendChild(onAll);
	box.appendChild(bulk);
	box.appendChild(el("div", "mce-hint",
		"注意：这 5 项是原版的「态度」设定，改的是你自己对这些事的接受度；写入即改 $uncomfortable 本身，重开原版 cheat 页那一屏会按当前值显示（读的是同一个变量）。"));
	pane.appendChild(box);
}
/* 职责：统一回退中心（v2.0.3 P4-1）——把散落各处的回退入口收敛为「全局」页一个区块。
   数据源唯一：存档内 V.mbCE_wrote 留痕。类型覆盖 cheat / world / maint / place / native / vanilla /
   set / clear / append / state / batch / yanling / part / vcore / lock；回退业务逻辑复用既有实现（undoCheatModValue /
   mbCEWorldUndo / mbCEMaintUndo / placeStageUndo / undoRomanceStage / undoVanillaStage），本文件只做
   归一化分发与展示。不可逐条回退的类型（batch 审计 / yanling 页内撤销 / state 关系状态）显式禁用按钮并说明原因。 */

	var MCE_UNDO_LABELS = {		cheat: "作弊项写入",
		world: "世界入口解锁",
		maint: "庄园维护写入",
		place: "地点阶段任务",
		native: "恋爱（恋人卡槽）",
		vanilla: "原版恋爱阶段",
		set: "框架恋爱条件·置位",
		clear: "框架恋爱条件·清零",
		append: "框架恋爱条件·追加",
		state: "框架恋爱条件·关系状态",
		batch: "批量操作（仅审计）",
		yanling: "言灵改写（页内撤销）",
		part: "外观隐藏（转化部件）",
		vcore: "原版档案 · 收藏 · 头衔",
		lock: "数值锁定写回"
	};
	function mbCEUndoLabel(type) {
		if (!type) { return "未知类型"; }
		return MCE_UNDO_LABELS[type] || String(type);
	}
	/* 不可回退原因（空串 = 可回退） */
	function mbCEUndoBlocked(type) {
		if (type === "batch") { return "批量操作只记录受影响条数，无法逐条还原"; }
		if (type === "yanling") { return "言灵改写在「言灵」页对应开关处撤销"; }
		if (type === "state") { return "关系状态由原版实时判定，回退会破坏真实关系"; }
		return "";
	}
	function mbCEUndoList() {
		var out = [];
		try {
			var V = getV();
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return out; }
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				var rec = V.mbCE_wrote[k];
				if (!rec || typeof rec !== "object") { return; }
				out.push({ key: k, type: String(rec.type || ""), path: rec.path || "", t: (typeof rec.t === "number" ? rec.t : 0) });
			});
			out.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
		} catch (e) {}
		return out;
	}
	/* 单条回退：key 形如 <ns>:<...>，按 rec.type 分发到既有实现 */
	function mbCEUndoOne(key) {
		try {
			var V = getV();
			if (!V || !V.mbCE_wrote || !V.mbCE_wrote[key]) { return { ok: false, msg: "该留痕已不存在（可能已回退或超出保留窗口）" }; }
			var rec = V.mbCE_wrote[key];
			var type = String(rec.type || "");
			var blocked = mbCEUndoBlocked(type);
			if (blocked) { return { ok: false, msg: blocked }; }
			if (type === "cheat") {
				var rest = key.indexOf("cheat:") === 0 ? key.slice(6) : key;
				var sep = rest.indexOf(":");
				var modId = sep === -1 ? rest : rest.slice(0, sep);
				var itemKey = sep === -1 ? "" : rest.slice(sep + 1);
				var r1 = /** @type {any} */ (undoCheatModValue(modId, itemKey));
				/* P2（玩家图 7「回退无效且仍显示已锁定」）：留痕里就带 rec.path，
				   回退必须**连带解除该路径的锁定** —— 否则 07f-lock 的 1s tick 立刻把值写回，
				   留痕没了、值还锁着，玩家再点回退只会看到「没有留痕」。分组回退 / 全部回退都走本函数，同口生效。 */
				var lockPath = String(rec.path || "");
				var lockOff = false;
				var lockedNow = false;
				try {
					if (lockPath && typeof mbCELockHas === "function") { lockedNow = !!mbCELockHas(lockPath); }
					if (lockedNow && typeof mbCELockRemove === "function") {
						var lr = /** @type {any} */ (mbCELockRemove(lockPath));
						lockOff = !!(lr && lr.ok);
					}
				} catch (eLock) { lockOff = false; }
				var baseMsg = /** @type {any} */ (r1 && (r1.message || r1.msg)) || "作弊项回退失败";
				if (r1 && r1.ok && lockOff) {
					var lockName = (typeof mbCELockLabel === "function") ? mbCELockLabel(lockPath) : lockPath;
					baseMsg = "已回退 " + lockName + "，并已同步解除锁定";
				} else if (r1 && r1.ok && lockedNow && !lockOff) {
					baseMsg = baseMsg + "（注意：该路径仍在锁定，值会被 1 秒写回，请到「全局 → 数值固定」手动取消）";
				}
				return { ok: !!(r1 && r1.ok), msg: baseMsg, unlocked: lockOff, locked: lockedNow };
			}
			if (type === "part") {
				var r6 = /** @type {any} */ (mbCEHideUndo(key));
				return { ok: !!(r6 && r6.ok), msg: (r6 && r6.msg) || "外观回退失败" };
			}
			/* P4（v2.0.7）：锁定写回留痕。顺序必须是「先解除锁定、再还原原值」——
			   反过来的话 07f-lock 下一秒 tick 又会把值写回目标，玩家以为回退没生效。 */
			if (type === "lock") {
				var lp = String(rec.path || key.replace(/^lock:/, ""));
				var hadLock = false;
				try { if (typeof mbCELockHas === "function") { hadLock = !!mbCELockHas(lp); } } catch (eL0) {}
				var offOk = !hadLock;
				if (hadLock && typeof mbCELockRemove === "function") {
					var lr3 = /** @type {any} */ (mbCELockRemove(lp));
					offOk = !!(lr3 && lr3.ok);
				}
				var restored = true;
				if (rec.before !== undefined) {
					try { setPathVal(V, lp, rec.before); } catch (eL1) { restored = false; }
				}
				/* 还原异常时保留留痕，玩家可以再点一次重试；只有真还原成功才删记录 */
				if (restored) { try { delete V.mbCE_wrote[key]; } catch (eL2) {} }
				var lName = (typeof mbCELockLabel === "function") ? mbCELockLabel(lp) : lp;
				var head = hadLock ? (offOk ? "已取消锁定 " : "已还原原值，但锁定未能解除 ") : "锁定已不在，仅还原 ";
				return {
					ok: restored && (!hadLock || offOk),
					msg: head + lName + (rec.before !== undefined ? " = " + String(rec.before) : "") + (restored ? "" : "（还原异常，见状态栏）")
				};
			}
			if (type === "world") {
				var gid = key.indexOf("world:") === 0 ? key.slice(6) : key;
				var sepW = gid.indexOf(":");
				if (sepW !== -1) { gid = gid.slice(0, sepW); }
				var r2 = /** @type {any} */ (mbCEWorldUndo(gid));
				return { ok: !!(r2 && r2.ok), msg: (r2 && (r2.message || r2.msg)) || "世界入口回退失败" };
			}
			if (type === "maint") {
				var r3 = mbCEMaintUndo(rec.path || key.replace(/^maint:/, ""));
				return { ok: !!(r3 && r3.ok), msg: (r3 && r3.msg) || "维护写入回退失败" };
			}
			if (type === "place") {
				var r4 = /** @type {any} */ (placeStageUndo(rec.path || key.replace(/^place:/, "")));
				return { ok: !!(r4 && r4.ok), msg: (r4 && (r4.message || r4.msg)) || "地点阶段回退失败" };
			}
			if (type === "native") {
				var nm = key.replace(/^romance:native:/, "");
				var okN = undoRomanceStage(nm, { native: true });
				return { ok: !!okN, msg: okN ? "已从恋人卡槽移除「" + nm + "」" : "回退未生效（恋爱状态可能已被原版改写）" };
			}
			if (type === "vanilla") {
				var vk = rec.key || key.replace(/^vanilla:/, "");
				var r5 = /** @type {any} */ (undoVanillaStage(rec.npc || "Gwylan", vk));
				return { ok: !!(r5 && r5.ok), msg: (r5 && (r5.message || r5.msg)) || "原版阶段回退失败" };
			}
			/* v2.0.9 需求②③④：原版档案 / 收藏 / 头衔三项整块写入（07l-vanilla-ext.js）
			   id in {crime, antique, title}；before 为「首次写入前」整块快照，由 mbCEVanillaExtUndo 按 kind 还原 */
			if (type === "vcore") {
				var vid = String(rec.id || key.replace(/^vcore:/, ""));
				var rv = /** @type {any} */ (mbCEVanillaExtUndo(vid));
				return { ok: !!(rv && rv.ok), msg: (rv && (rv.message || rv.msg)) || "原版档案回退失败" };
			}
			/* 框架恋爱条件三类：留痕里已存 path / value，可直接还原（与 undoRomanceStage 同口径） */
			if (type === "set") {
				if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
				try { delete V[rec.path]; } catch (e) { V[rec.path] = undefined; }
				try { delete V.mbCE_wrote[key]; } catch (e) {}
				return { ok: true, msg: "已撤销置位（" + rec.path + "）" };
			}
			if (type === "clear") {
				if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
				V[rec.path] = 1;
				try { delete V.mbCE_wrote[key]; } catch (e) {}
				return { ok: true, msg: "已恢复原值 1（" + rec.path + "）" };
			}
			if (type === "append") {
				if (!rec.path) { return { ok: false, msg: "留痕缺少 path，无法回退" }; }
				var arr = V[rec.path];
				var changed = false;
				if (Array.isArray(arr)) {
					var idx = arr.indexOf(rec.value);
					if (idx !== -1) { arr.splice(idx, 1); changed = true; }
				} else if (arr && typeof arr === "object") {
					Object.keys(arr).forEach(function (k) {
						if (arr[k] === rec.value) { delete arr[k]; changed = true; }
					});
				}
				if (!changed) { return { ok: false, msg: "目标集合里已找不到「" + rec.value + "」，可能已被原版改写" }; }
				try { delete V.mbCE_wrote[key]; } catch (e) {}
				return { ok: true, msg: "已从 " + rec.path + " 移除「" + rec.value + "」" };
			}
			return { ok: false, msg: "未知留痕类型：" + (type || "(空)") };
		} catch (e) {
			return { ok: false, msg: "回退异常：" + mbCEErr(e) };
		}
	}
	/* 按类型分组回退 */
	function mbCEUndoGroup(type) {
		var list = mbCEUndoList().filter(function (it) { return it.type === type; });
		if (!list.length) { return { ok: false, n: 0, fail: 0, msg: "该分组没有留痕" }; }
		var blocked = mbCEUndoBlocked(type);
		if (blocked) { return { ok: false, n: 0, fail: list.length, msg: blocked }; }
		var ok = 0, fail = 0;
		list.forEach(function (it) {
			var r = mbCEUndoOne(it.key);
			if (r.ok) { ok++; } else { fail++; }
		});
		return { ok: ok > 0, n: ok, fail: fail, msg: "「" + mbCEUndoLabel(type) + "」已回退 " + ok + " 项" + (fail ? "，" + fail + " 项未能回退" : "") };
	}
	/* 全部可回退项（按时间倒序，最新优先） */
	function mbCEUndoAll() {
		var all = mbCEUndoList();
		if (!all.length) { return { ok: false, n: 0, fail: 0, skip: 0, msg: "没有任何面板写入留痕" }; }
		var ok = 0, fail = 0, skip = 0;
		all.forEach(function (it) {
			if (mbCEUndoBlocked(it.type)) { skip++; return; }
			var r = mbCEUndoOne(it.key);
			if (r.ok) { ok++; } else { fail++; }
		});
		return {
			ok: ok > 0, n: ok, fail: fail, skip: skip,
			msg: "已回退 " + ok + " 项" + (fail ? "，" + fail + " 项未能回退" : "") + (skip ? "，" + skip + " 项仅审计不可回退" : "")
		};
	}
	function mbCEUndoFmtTime(t) {
		if (!t) { return "—"; }
		try {
			var d = new Date(t);
			var p = function (n) { return (n < 10 ? "0" : "") + n; };
			return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		} catch (e) { return "—"; }
	}
	/* 全局页区块渲染（renderGlobal 末尾调用，pane = [data-pane="global"]） */
	function mbCEUndoCenterRender(pane) {
		if (!pane) { return; }
		var sec = mceNewSec(pane, 0, "统一回退中心（v2.0.3）",
			"全部面板写入的留痕都在这里，一条一处：单条回退 / 按类型分组回退 / 全部回退。" +
			"回退只还原「面板写入前」的状态，玩家真实进度（原版达成的恋爱阶段、关系状态）一律不动；" +
			"批量操作与言灵改写只保留审计记录，需在对应页面撤销。");
		var list = mbCEUndoList();
		var undoable = list.filter(function (it) { return !mbCEUndoBlocked(it.type); }).length;
		/* v2.0.3 P4-2：写入前 diff 预览开关（门控在 04b 执行器，见 08d-diff-preview.js） */
		var pvRow = el("div", "mce-row");
		var pvOn = mbCEPreviewEnabled();
		var pvBtn = el("button", "mce-btn" + (pvOn ? " mce-gold" : ""), pvOn ? "写入前 diff 预览：已开启" : "写入前 diff 预览：已关闭");
		pvBtn.type = "button";
		pvBtn.title = pvOn
			? "当前每次写入都会先弹出「键 旧值 → 新值」确认条，点「确认写入」才落档；点此关闭直接写入"
			: "开启后每次写入先显示「键 旧值 → 新值」确认条，确认才落档（防手滑改错数值）";
		pvBtn.addEventListener("click", function () {
			mbCEUiState.diffPreview = pvOn ? "0" : "1";
			try { mbCEUiSave({ diffPreview: mbCEUiState.diffPreview }); } catch (e) {}
			setStatus("写入前 diff 预览已" + (pvOn ? "关闭（恢复直接写入）" : "开启（写入前先确认）"), "mce-ok");
			renderGlobal();
		});
		pvRow.appendChild(pvBtn);
		sec.appendChild(pvRow);
		var top = mceBtnGrid(sec);
		var allBtn = el("button", "mce-btn mce-gold", "全部回退（" + undoable + " 项可回退）");
		allBtn.type = "button";
		allBtn.title = "按时间倒序回退所有可回退的留痕；审计类（批量 / 言灵 / 关系状态）自动跳过";
		allBtn.addEventListener("click", function () {
			var r = mbCEUndoAll();
			setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
			renderGlobal();
		});
		top.appendChild(allBtn);
		var refreshBtn = el("button", "mce-btn", "刷新清单");
		refreshBtn.type = "button";
		refreshBtn.addEventListener("click", function () {
			setStatus("留痕清单已刷新：" + mbCEUndoList().length + " 条", "mce-ok");
			renderGlobal();
		});
		top.appendChild(refreshBtn);
		sec.appendChild(el("div", "mce-hint", "当前留痕 " + list.length + " 条，其中可回退 " + undoable + " 条。留痕上限 400 条，超出按时间升序删最旧一半（旧操作的回退窗口随之关闭）。"));
		if (!list.length) {
			sec.appendChild(el("div", "mce-hint", "暂无写入留痕：面板还没有写过任何东西，或已全部回退。"));
			return;
		}
		/* 按类型分组（组内按时间倒序，组按条数降序） */
		var groups = {};
		list.forEach(function (it) {
			var t = it.type || "(空)";
			if (!groups[t]) { groups[t] = []; }
			groups[t].push(it);
		});
		var order = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
		order.forEach(function (type) {
			var items = groups[type];
			var blocked = mbCEUndoBlocked(type);
			var body = mceNewGroup(sec, mbCEUndoLabel(type), items.length + " 条" + (blocked ? " · 仅审计" : ""));
			if (blocked) {
				body.appendChild(el("div", "mce-hint", blocked));
			} else {
				if (type === "lock") {
					body.appendChild(el("div", "mce-hint", "回退 = 取消该数值的锁定 + 还原锁定前原值（只还原值不解除锁定，1 秒 tick 会立刻写回目标）。"));
				}
				var gBtn = el("button", "mce-btn", "回退本组 " + items.length + " 项");
				gBtn.type = "button";
				gBtn.addEventListener("click", function () {
					var r = mbCEUndoGroup(type);
					setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
					renderGlobal();
				});
				body.appendChild(gBtn);
			}
			items.slice(0, 24).forEach(function (it) {
				var row = el("div", "mce-row");
				/* 展示中文名（08e-undo-labels 解析），原始键留在 label 的 tooltip 里便于排障 */
				var nm = mbCEUndoItemName(it.key, it);
				var lbl = el("span", "mce-row-lbl", nm.length > 58 ? nm.slice(0, 58) + "…" : nm);
				lbl.title = it.key;
				row.appendChild(lbl);
				row.appendChild(el("span", "mce-hint", mbCEUndoFmtTime(it.t)));
				if (blocked) {
					row.appendChild(el("span", "mce-badge", "不可回退"));
				} else {
					var b = el("button", "mce-btn", "回退");
					b.type = "button";
					b.title = "还原「" + nm + "」为面板写入前状态（原始键 " + it.key + "）";
					b.addEventListener("click", function () {
						var r = mbCEUndoOne(it.key);
						setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
						renderGlobal();
					});
					row.appendChild(b);
				}
				body.appendChild(row);
			});
			if (items.length > 24) {
				body.appendChild(el("div", "mce-hint", "（本组共 " + items.length + " 条，仅列出最近 24 条；「回退本组」会处理全部）"));
			}
		});
	}
/* 职责：写入前 diff 预览（v2.0.3 P4-2）——面板写入执行前先给出「键 / 旧值 → 新值」，
	   玩家点「确认写入」才真正落档。默认关闭（与旧行为完全一致），开关在「全局」页 统一回退中心 上方。
	   v2.0.7 修 A（玩家：「df 预览似乎没啥作用」）——六条缺陷一次收口：
	   D1 覆盖不全：gate 原来只挂在 cheatWriteValue。现在 cheatWriteListValue（列表写入）、
	      placeStageWrite（地点阶段/世界入口）、mbCELockSet（锁定）、mbCEPlaceWriteRaw（岛屿/地下字符串写入）
	     全部走同一个 mbCEPreviewGate，任何面板写入都能被预览拦下。
	   D2 单槽覆盖：`var mbCEPendingPreview = null` 直接覆盖，连续两次写入第一笔的 run 闭包被顶掉、
	      既不落档也不提示。改为队列 mbCEPendingQueue（最多 8 项，超出丢最旧并在条上提示）。
	   D3 确认条在滚动内容最底部（root.appendChild，无 sticky）→ 改为挂到**当前活动 pane** 内并 sticky 贴底。
	   D4 锁定绕开预览 → mbCELockSet 加 replay 参数并接 gate。
	   D5 确认后只刷 Mod作弊页 → mbCEPaneRefresh() 按当前活动页签重渲染。
	   D6 条上显示英文裸 varPath → 复用 mbCELockLabel 的三级中文回落，中文名 + 小字 path。
	   另：mbCEUiState.diffPreview 的持久化缺口（mbCEUiLoad 无此白名单分支）在 07a-shell2.js 一并补。
	   实现要点：
	   - 待确认记录只存内存（含重放闭包），刷新页面即失效——避免把函数塞进存档；
	   - 确认时置 mbCEPreviewReplay=true 重放，避免二次触发门控。 */

	var mbCEPendingQueue = [];
	var mbCEPendingPreview = null; /* 兼容旧引用：始终等于队首（不再作为唯一存储） */
	var mbCEPreviewReplay = false;
	var mbCEPreviewBarId = "mce-preview-bar";
	var MB_CE_PREVIEW_MAX = 8;

	function mbCEPreviewEnabled() {
		try { return !!(mbCEUiState && mbCEUiState.diffPreview === "1"); } catch (e) { return false; }
	}
	function mbCEPreviewFmt(v) {
		if (v === undefined) { return "（无此字段）"; }
		if (v === null) { return "null"; }
		try {
			var s = JSON.stringify(v);
			if (s === undefined) { return String(v); }
			return s.length > 48 ? s.slice(0, 48) + "…" : s;
		} catch (e) { return String(v); }
	}
	/* 中文名：复用 07f-lock 的三级回落（快速面板索引 label → zhKey(path) → zhKey(leaf) → path 原文） */
	function mbCEPreviewLabel(path) {
		try {
			if (typeof mbCELockLabel === "function") { return mbCELockLabel(path); }
		} catch (e) {}
		return String(path);
	}
	/* 返回 true = 本次被拦下（已入队待确认），false = 放行 */
	function mbCEPreviewGate(path, beforeVal, afterVal, run) {
		if (mbCEPreviewReplay || !mbCEPreviewEnabled()) { return false; }
		if (beforeVal === afterVal) { return false; }
		mbCEPendingQueue.push({ path: path, before: beforeVal, after: afterVal, run: run, t: Date.now() });
		if (mbCEPendingQueue.length > MB_CE_PREVIEW_MAX) { mbCEPendingQueue.shift(); }
		mbCEPendingPreview = mbCEPendingQueue[0];
		mbCEPreviewShow();
		return true;
	}
	function mbCEPreviewCount() { return mbCEPendingQueue.length; }
	/* 确认队首（逐条） */
	function mbCEPreviewConfirm() {
		if (!mbCEPendingQueue.length) { mbCEPreviewHide(); return { ok: false, message: "没有待确认的写入" }; }
		var p = mbCEPendingQueue.shift();
		mbCEPendingPreview = mbCEPendingQueue[0];
		mbCEPreviewReplay = true;
		var r;
		try { r = p.run(); } finally { mbCEPreviewReplay = false; }
		mbCEPreviewShow();
		if (r && typeof r === "object") { return r; }
		return { ok: true, message: "已写入 " + mbCEPreviewLabel(p.path) };
	}
	/* 全部确认（玩家诉求②） */
	function mbCEPreviewConfirmAll() {
		if (!mbCEPendingQueue.length) { mbCEPreviewHide(); return { ok: false, message: "没有待确认的写入" }; }
		var okN = 0, failN = 0;
		mbCEPreviewReplay = true;
		try {
			while (mbCEPendingQueue.length) {
				var p = mbCEPendingQueue.shift();
				if (!p || typeof p.run !== "function") { failN++; continue; }
				try {
					var r = p.run();
					if (r && r.ok === false) { failN++; } else { okN++; }
				} catch (e) { failN++; }
			}
		} finally { mbCEPreviewReplay = false; }
		mbCEPendingPreview = null;
		mbCEPreviewHide();
		return {
			ok: okN > 0,
			message: "已确认写入 " + okN + " 项" + (failN ? "，失败 " + failN + " 项（详见状态栏/控制台）" : "")
		};
	}
	/* 取消：清空整个待确认队列（存档未改动） */
	function mbCEPreviewCancel() {
		var had = mbCEPendingQueue.length;
		mbCEPendingQueue = [];
		mbCEPendingPreview = null;
		mbCEPreviewHide();
		return { ok: had > 0, message: had > 0 ? ("已取消 " + had + " 笔待确认写入（存档未改动）") : "没有待确认的写入" };
	}
	function mbCEPreviewHide() {
		try {
			var b = document.getElementById(mbCEPreviewBarId);
			if (b && b.parentNode) { b.parentNode.removeChild(b); }
		} catch (e) {}
	}
	/* 确认/撤销后按「当前活动页签」重渲染（D5：原先只 renderModCheats，在角色/地点/全局页确认完看不到变化） */
	function mbCEPaneRefresh() {
		var name = "";
		try {
			var pane = root && root.querySelector(".mce-pane.mce-active");
			name = pane ? (pane.getAttribute("data-pane") || "") : "";
			if (name === "mods") { renderModCheats(); }
			else if (name === "global") { renderGlobal(); }
			else if (name === "places") { renderPlaces(); }
			else if (name === "stage") { renderStagePane(); }
			else if (name === "scenes") { renderScenes(); }
			else if (name === "char") { renderCards(); }
			else if (name === "yanling") { renderYanling(); }
			else { renderModCheats(); }
		} catch (e) {}
		return name;
	}
	/* 面板底部确认条（sticky 贴底，挂在当前活动 pane 内）：确认队首 / 全部确认 / 取消全部 */
	function mbCEPreviewShow() {
		try {
			mbCEPreviewHide();
			if (!mbCEPendingQueue.length || !root) { return; }
			var p = mbCEPendingQueue[0];
			var n = mbCEPendingQueue.length;
			var host = root.querySelector(".mce-pane.mce-active") || root;
			var bar = el("div", "mce-preview-bar");
			bar.id = mbCEPreviewBarId;
			var lbl = el("span", "mce-preview-lbl",
				"待确认" + (n > 1 ? "（共 " + n + " 项，下方为第 1 项）" : "") + "：" +
				mbCEPreviewLabel(p.path) + "　" + mbCEPreviewFmt(p.before) + " → " + mbCEPreviewFmt(p.after));
			lbl.title = "varPath：" + p.path + "\n旧值：" + mbCEPreviewFmt(p.before) + "\n新值：" + mbCEPreviewFmt(p.after) +
				(n > 1 ? "\n队列：" + mbCEPendingQueue.map(function (x) { return x.path; }).join(" ｜ ") : "");
			bar.appendChild(lbl);
			var okBtn = el("button", "mce-btn mce-gold", "确认写入");
			okBtn.type = "button";
			okBtn.title = "确认后按此 diff 落档（同时保留回退留痕）";
			okBtn.addEventListener("click", function () {
				var r = mbCEPreviewConfirm();
				setStatus(r && r.message ? r.message : "已写入", (r && r.ok) ? "mce-ok" : "mce-err");
				mbCEPaneRefresh();
			});
			bar.appendChild(okBtn);
			if (n > 1) {
				var allBtn = el("button", "mce-btn mce-gold", "全部确认（" + n + "）");
				allBtn.type = "button";
				allBtn.title = "按队列顺序一次性落档全部待确认写入（每一项仍各自留痕、可单独回退）";
				allBtn.addEventListener("click", function () {
					var r = mbCEPreviewConfirmAll();
					setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
					mbCEPaneRefresh();
				});
				bar.appendChild(allBtn);
			}
			var cancelBtn = el("button", "mce-btn", n > 1 ? "全部取消" : "取消");
			cancelBtn.type = "button";
			cancelBtn.addEventListener("click", function () {
				var r = mbCEPreviewCancel();
				setStatus(r.message, "mce-ok");
			});
			bar.appendChild(cancelBtn);
			host.appendChild(bar);
		} catch (e) {}
	}
/* 职责：回退中心的「留痕键 → 中文名」解析层（v2.0.4）。
   回退中心原先直接渲染原始键（cheat:player-self:p:prof.spray / place:town_projects.green /
   maint:temple_quarters / yanling:purge_cross …），玩家看不懂。本段只做展示层翻译，不改键本身、
   不改回退逻辑（回退仍按原始 key 精确分发）。解析顺序：专用词表 → 注册表（适配器 entry / 地点分组 /
   世界入口分组 / 汉化键表 ZH_KEYS）→ 兜底（原键去命名空间 + 中文动作前缀）。
   词表与数据源同源：适配器 entry 的 name 字段、07d 的 PLACE_STAGE_GROUPS.item.name、
   PLACE_GROUPS.name、03d 的 ZH_KEYS（zhKey）。新增写入点若没中文名，兜底会退回原键，不会崩。 */

	/* 写入动作（键前缀）→ 中文动作名；空串表示「路径本身就是项名」，不额外加前缀 */
	var MB_CE_UNDO_OPS = {
		p: "",
		trait: "特质",
		ability_set: "能力",
		scene_skip: "剧情跳过",
		scene_force: "剧情完成",
		scene_reset: "剧情进度",
		task_skip: "任务跳过",
		task_complete: "任务完成",
		stage_set: "阶段",
		value_set: "数值",
		fert_child_aff: "孩子好感"
	};
	/* 玩家自身（modId=player-self）常见写入路径的中文名：与面板行名同源，zhKey 兜不到的在此补齐 */
	var MB_CE_UNDO_PLAYER = {
		"speech_attitude": "说话态度",
		"submissive": "顺从度",
		"spraymax": "防狼喷雾容量上限",
		"spray": "防狼喷雾余量",
		"baton": "短棍",
		"whip": "鞭子",
		"net": "网",
		"pickaxe": "镐",
		"lurkers_held": "手持潜伏者",
		"lurker:lurkers_held": "手持潜伏者",
		"lurker:hookah.lurkers": "水烟馆冰箱潜伏者",
		"lurker:hookah.juice": "水烟壶汁液",
		"lurker:lurkers_stored": "农场蒸馏笼潜伏者",
		"lurker:farm_stage": "农场阶段",
		"lurker:stat_lurkers_captured": "累计捕获潜伏者"
	};
	/* 庄园维护写入的变量名 → 中文（03b mcMaintain* 的写入面） */
	var MB_CE_UNDO_MAINT = {
		temple_quarters: "神殿宿舍清洁",
		temple_garden: "神殿花园打理",
		edengarden: "伊甸菜地",
		edenshrooms: "伊甸菇桶",
		edenspring: "伊甸泉水",
		soap: "肥皂补给",
		salve: "药膏补给",
		"bird.materials.wood": "鹰塔木材补给",
		"eden.children": "伊甸孩子",
		farm: "农场投喂"
	};
	/* 言灵改写 op → 中文（07i-yanling-core 的 mbCEYanlingTrace 三处） */
	var MB_CE_UNDO_YANLING = {
		purge_cross: "异装与校规记录清除",
		purge_trait: "特质清除",
		purge_fame: "名声清除"
	};
	/* 键拆分：<ns>:<rest> */
	function mbCEUndoSplitKey(key) {
		var s = String(key == null ? "" : key), i = s.indexOf(":");
		if (i < 0) { return { ns: "", rest: s }; }
		return { ns: s.slice(0, i), rest: s.slice(i + 1) };
	}
	function mbCEUndoZh(table, k) {
		if (!table || !k) { return ""; }
		return (typeof table[k] === "string") ? table[k] : "";
	}
	/* 适配器 entry 里按 itemKey / varPath / path 反查中文行名（tasks/stages/values/abilities/scenes … 全量扫） */
	function mbCEUndoAdapterItemName(entry, itemKey, op, recPath) {
		if (!entry || typeof entry !== "object") { return ""; }
		var fields = Object.keys(entry), i, j, arr, it;
		var wantOp = op ? (op + ":" + itemKey) : itemKey;
		for (i = 0; i < fields.length; i++) {
			arr = entry[fields[i]];
			if (!Array.isArray(arr)) { continue; }
			for (j = 0; j < arr.length; j++) {
				it = arr[j];
				if (!it || typeof it !== "object" || typeof it.name !== "string") { continue; }
				if (it.key === wantOp || it.key === itemKey) { return it.name; }
				if (recPath && (it.varPath === recPath || it.path === recPath || it.skipVar === recPath ||
					it.completeVar === recPath || it.progressVar === recPath)) { return it.name; }
			}
		}
		return "";
	}
	/* cheat:<modId>:<op|路径> */
	function mbCEUndoCheatName(rest, rec) {
		var i = rest.indexOf(":"), modId = (i < 0 ? rest : rest.slice(0, i)), itemKey = (i < 0 ? "" : rest.slice(i + 1));
		var op = "", m = /^([a-z][a-z_0-9]*):(.+)$/.exec(itemKey);
		if (m && MB_CE_UNDO_OPS[m[1]] !== undefined) { op = m[1]; itemKey = m[2]; }
		var recPath = (rec && typeof rec.path === "string") ? rec.path : "";
		var name = mbCEUndoAdapterItemName((typeof CHEAT_ADAPTERS === "object" && CHEAT_ADAPTERS) ? (CHEAT_ADAPTERS[modId] || {}).entry : null, itemKey, op, recPath);
		if (!name && modId === "player-self") { name = mbCEUndoZh(MB_CE_UNDO_PLAYER, itemKey) || mbCEUndoZh(MB_CE_UNDO_PLAYER, (op ? op + ":" : "") + itemKey); }
		if (!name) {
			try { if (typeof zhKey === "function") { name = zhKey(recPath || itemKey); } } catch (e) { name = ""; }
		}
		if (!name && recPath && recPath.indexOf(".") > 0) { name = recPath; }
		if (!name) { name = itemKey; }
		var opName = MB_CE_UNDO_OPS[op];
		return opName ? (opName + " · " + name) : name;
	}
	/* place:<path> → 「分组 · 项名」（07d PLACE_STAGE_GROUPS 同源） */
	function mbCEUndoPlaceName(rest) {
		try {
			if (typeof PLACE_STAGE_GROUPS === "object" && Array.isArray(PLACE_STAGE_GROUPS)) {
				for (var gi = 0; gi < PLACE_STAGE_GROUPS.length; gi++) {
					var g = PLACE_STAGE_GROUPS[gi];
					if (!g || !Array.isArray(g.items)) { continue; }
					for (var ii = 0; ii < g.items.length; ii++) {
						var it = g.items[ii];
						if (it && it.path === rest) { return (g.name ? String(g.name).replace(/（.*?）/g, "") + " · " : "") + it.name; }
					}
				}
			}
		} catch (e) { /* 数据表未加载时走兜底 */ }
		return "";
	}
	/* world:<gid>:<path> → 「地点分组名 · 路径中文」 */
	function mbCEUndoWorldName(rest, rec) {
		var gid = rest, path = (rec && typeof rec.path === "string") ? rec.path : "";
		var cut = rest.indexOf(":");
		if (cut >= 0) { gid = rest.slice(0, cut); path = rest.slice(cut + 1); }
		var gname = "";
		try {
			if (typeof PLACE_GROUPS === "object" && Array.isArray(PLACE_GROUPS)) {
				for (var i = 0; i < PLACE_GROUPS.length; i++) {
					if (PLACE_GROUPS[i] && PLACE_GROUPS[i].id === gid) { gname = PLACE_GROUPS[i].name || ""; }
				}
			}
			if (!gname && typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS && WORLD_UNLOCKS[gid] && WORLD_UNLOCKS[gid].name) {
				gname = WORLD_UNLOCKS[gid].name;
			}
		} catch (e) { gname = ""; }
		if (!path) { return gname || gid; }
		var pn = mbCEUndoZh(MB_CE_UNDO_MAINT, path) || path;
		return gname ? (gname + " · " + pn) : pn;
	}
	/* 统一入口：返回展示用中文名（解析不出时原样退回键体，绝不返回空串） */
	function mbCEUndoItemName(key, rec) {
		var sp = mbCEUndoSplitKey(key), ns = sp.ns, rest = sp.rest, name = "";
		try {
			if (ns === "cheat") { name = mbCEUndoCheatName(rest, rec); }
			else if (ns === "place") { name = mbCEUndoPlaceName(rest); }
			else if (ns === "maint") { name = mbCEUndoZh(MB_CE_UNDO_MAINT, rest); }
			else if (ns === "yanling") { name = mbCEUndoZh(MB_CE_UNDO_YANLING, rest); }
			else if (ns === "world") { name = mbCEUndoWorldName(rest, rec); }
			/* P4（v2.0.7）：lock:<path> 用锁定页同一套中文名（快速面板标签 → zhKey → 原 path 三级回落） */
			else if (ns === "lock") {
				name = "";
				try { if (typeof mbCELockLabel === "function") { name = mbCELockLabel(rest); } } catch (eL) { name = ""; }
				if (!name || name === rest) {
					try { if (typeof zhKey === "function" && zhKey(rest) !== rest) { name = zhKey(rest); } } catch (eL2) { name = ""; }
				}
				if (!name) { name = rest; }
			}
			else if (ns === "romance" || ns === "vanilla" || ns === "native") {
				var tail = rest.replace(/^native:/, "");
				try { if (typeof displayName === "function") { name = displayName(tail); } } catch (e) { name = ""; }
				if (!name || name === tail) {
					try { if (typeof zhKey === "function") { name = zhKey(tail) === tail ? "" : zhKey(tail); } } catch (e2) { name = ""; }
				}
				if (!name) { name = tail; }
			}
		} catch (e) { name = ""; }
		name = String(name || "").trim();
		if (!name) { name = rest || String(key); }
		return name;
	}
/* 职责：面板 API 与页签注册表 —— render / open / close / toggle、names / panes / paneRenders 七页签、setup.mbStageCE 导出 */

	function render() {
		if (!root) { return; }
		if (!frameworkReady()) {
			setStatus("未检测到 Maplebirch 框架", "mce-err");
			return;
		}
		var pane = root.querySelector('[data-pane="char"]');
		var chars = listCharacters();
		if (!chars.length) {
			setStatus("注册池为空：未枚举到角色", "mce-err");
			return;
		}
		var prev = (curName || mbCEUiState.curName || "").toLowerCase();
		var keep = false;
		chars.forEach(function (n) { if (n.toLowerCase() === prev) { keep = true; } });
		if (!keep) { curName = chars[0]; mbCEUiSave({ curName: curName }); /* v1.8.12 二轮优化：角色记忆失效时回落到第一个角色并同步 */ }
		else if (!curName) { curName = mbCEUiState.curName; } /* v1.8.12 二轮优化：恢复上次操作角色 */
		/* 刷新当前可见页 */
		var activeTab = null;
		var tabs = root.querySelectorAll(".mce-tabs button");
		var i;
		for (i = 0; i < tabs.length; i++) {
			if (tabs[i].classList.contains("mce-active")) { activeTab = tabs[i].getAttribute("data-tab"); }
		}
		/* 表驱动分发（v1.8.6 review：替代 6 分支 if 链） */
		var paneRenders = {
			char: renderCards, stage: renderStagePane, scenes: renderScenes,
			places: renderPlaces, global: renderGlobal, mods: renderModCheats, yanling: renderYanling
		};
		var doRender = paneRenders[activeTab];
		if (doRender) { doRender(); }
		setStatus("就绪：" + chars.length + " 个角色", "mce-ok");
	}

	/* v1.9.14 效果6：关闭淡出定时器（open 复位时清掉，防关闭动画残留） */
	var mceCloseTimer = null;
	function open() {
		openFlag = true;
		if (root) {
			if (mceCloseTimer) { clearTimeout(mceCloseTimer); mceCloseTimer = null; }
			root.classList.remove("mce-closing");
			root.classList.add("mce-open"); /* v1.9.14 效果6：display:none→flex 重放 pop-in 缩放淡入 */
		}
		mbCEUpdateErrBadge(true); /* 四巡：面板打开时立即刷新错误徽标（关闭期只记数据不写 DOM） */
		render();
	}
	function close() {
		openFlag = false;
		if (root) {
			/* v1.9.14 效果6：先播 0.12s 淡出，再移除 mce-open（display:none）；打开复位见 open() */
			root.classList.add("mce-closing");
			if (mceCloseTimer) { clearTimeout(mceCloseTimer); }
			mceCloseTimer = setTimeout(function () {
				mceCloseTimer = null;
				root.classList.remove("mce-open");
				root.classList.remove("mce-closing");
			}, 130);
		}
	}
	function toggle() {
		if (openFlag) { close(); } else { open(); }
	}

	function ensureDom() {
		if (root && document.body && document.body.contains(root)) { return; }
		injectCSS();

		toggleBtn = (document.getElementById && document.getElementById("mce-toggle")) || el("button", "", "解锁");
		toggleBtn.id = "mce-toggle";
		toggleBtn.type = "button";
		toggleBtn.title = "Maplebirch CE 剧情条件解锁面板（可拖动：按住移到任意位置，位置自动记忆）";
		if (!toggleBtn.isConnected && document.body) { document.body.appendChild(toggleBtn); }
		/* v1.9.11+：悬浮球可拖动（pointer 拖拽，rAF 节流，位置持久化 localStorage）+ 拖动锁；
		   拖动后吞掉本次 click（区分「点击开关」与「拖动挪位」）。
		   悬浮球是面板唯一入口，废除「隐藏」功能（隐藏即死锁）——清旧键并强制恢复显示。 */
		var tgSt = toggleBtn.style || {};
		/* v2.0.12 悬浮球坐标钳制：坐标是「上次拖拽当时的视口」写下的，换窄窗口 / 缩放 / 换显示器后
		   原坐标可能整个落在视口外；面板已废除「隐藏」功能，球是唯一入口，跑出去等于面板打不开。
		   位置恢复与窗口 resize 都走这里（拖动过程中的钳位另在 pointermove 内，同一套边界）。 */
		function tgClampPos() {
			try {
				var w = (typeof window !== "undefined" && window.innerWidth) || 1280;
				var h = (typeof window !== "undefined" && window.innerHeight) || 720;
				var r = toggleBtn.getBoundingClientRect ? toggleBtn.getBoundingClientRect() : null;
				var bw = (r && r.width) || 56, bh = (r && r.height) || 56;
				var l = parseInt(tgSt.left, 10), t = parseInt(tgSt.top, 10);
				if (!isFinite(l) || !isFinite(t)) { return; } /* 从未拖过（right/bottom 定位）→ 不动 */
				tgSt.left = Math.max(0, Math.min(w - bw - 4, l)) + "px";
				tgSt.top = Math.max(0, Math.min(h - bh - 4, t)) + "px";
				tgSt.right = "auto";
				tgSt.bottom = "auto";
			} catch (e) {}
		}
		try {
			if (typeof localStorage !== "undefined" && localStorage) {
				if (localStorage.getItem("mbCE_toggle_hidden_v1") !== null) {
					localStorage.removeItem("mbCE_toggle_hidden_v1");
				}
				tgSt.display = "";
				var tpRaw = localStorage.getItem("mbCE_toggle_pos_v1");
				if (tpRaw) {
					var tpj = JSON.parse(tpRaw);
					if (tpj && typeof tpj.left === "number" && typeof tpj.top === "number") {
						tgSt.left = tpj.left + "px";
						tgSt.top = tpj.top + "px";
					}
					/* v2.0.12：恢复后立即按当前视口钳回内区（历史坐标可能来自更宽的窗口，原样照写会把唯一入口送出屏幕） */
					tgClampPos();
				}
				/* 拖动锁：mbCE_toggle_lock_v1 = "1" 时禁拖动（点击仍正常开关面板） */
				toggleBtn.dataset.mceLocked = (localStorage.getItem("mbCE_toggle_lock_v1") === "1") ? "1" : "0";
				if (toggleBtn.dataset.mceLocked === "1") {
					toggleBtn.title = "Maplebirch CE 剧情条件解锁面板（拖动已锁定：点击开关面板，到「全局」页解锁拖动）";
				}
			}
		} catch (e) {}
		var drag = { on: false, moved: false, sx: 0, sy: 0, l: 0, t: 0, bw: 56, bh: 56, nx: 0, ny: 0, raf: 0 };
		/* v1.9.11+ 自查：绑定守卫——ModLoader 热重载复用同一 #mce-toggle 时跳过重复 addEventListener，
		   否则 click 监听堆叠会导致一次点击多次开关面板 */
		if (!toggleBtn.__mbCEBound) {
		toggleBtn.addEventListener("pointerdown", function (ev) {
			if (toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1") { return; }
			drag.on = true; drag.moved = false;
			drag.sx = ev.clientX; drag.sy = ev.clientY;
			var r = toggleBtn.getBoundingClientRect ? toggleBtn.getBoundingClientRect() : { left: 0, top: 0, width: 56, height: 56 };
			drag.l = r.left; drag.t = r.top;
			drag.bw = r.width || 56; drag.bh = r.height || 56;
			try { toggleBtn.classList.add("mce-dragging"); } catch (e2) {}
			try { toggleBtn.setPointerCapture(ev.pointerId); } catch (e2) {}
			try { ev.preventDefault(); } catch (e2) {}
		});
		toggleBtn.addEventListener("pointermove", function (ev) {
			if (!drag.on) { return; }
			var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
			if (Math.abs(dx) < 3 && Math.abs(dy) < 3) { return; }
			drag.moved = true;
			drag.nx = drag.l + dx; drag.ny = drag.t + dy;
			if (!drag.raf) {
				drag.raf = (typeof window !== "undefined" && window.requestAnimationFrame) ? window.requestAnimationFrame(function () {
					drag.raf = 0;
					if (!drag.on && !drag.moved) { return; }
					var w = (typeof window !== "undefined" && window.innerWidth) || 1280;
					var h = (typeof window !== "undefined" && window.innerHeight) || 720;
					var nl = Math.max(0, Math.min(w - (drag.bw || 56) - 4, drag.nx));
					var nt = Math.max(0, Math.min(h - (drag.bh || 56) - 4, drag.ny));
					tgSt.left = nl + "px";
					tgSt.top = nt + "px";
					tgSt.right = "auto";
					tgSt.bottom = "auto";
				}) : 0;
			}
		});
		function tgDragEnd(ev) {
			if (!drag.on) { return; }
			drag.on = false;
			try { toggleBtn.classList.remove("mce-dragging"); } catch (e2) {}
			try { toggleBtn.releasePointerCapture(ev.pointerId); } catch (e2) {}
			if (drag.moved) {
				var w = (typeof window !== "undefined" && window.innerWidth) || 1280;
				var h = (typeof window !== "undefined" && window.innerHeight) || 720;
				var nl = Math.max(0, Math.min(w - (drag.bw || 56) - 4, drag.nx));
				var nt = Math.max(0, Math.min(h - (drag.bh || 56) - 4, drag.ny));
				tgSt.left = nl + "px";
				tgSt.top = nt + "px";
				tgSt.right = "auto";
				tgSt.bottom = "auto";
				try {
					if (typeof localStorage !== "undefined" && localStorage) {
						localStorage.setItem("mbCE_toggle_pos_v1", JSON.stringify({ left: nl, top: nt }));
					}
				} catch (e2) {}
			}
		}
		toggleBtn.addEventListener("pointerup", tgDragEnd);
		toggleBtn.addEventListener("pointercancel", tgDragEnd);
		toggleBtn.addEventListener("click", function () {
			if (drag.moved) { drag.moved = false; return; }
			toggle();
		});
		/* v2.0.12：窗口缩放 / 屏幕旋转后重新钳位——拖拽只在那一次 move 内钳，之后窗口变小球就留在视口外 */
		if (!toggleBtn.__mbCEPosBound) {
			try { window.addEventListener("resize", tgClampPos); toggleBtn.__mbCEPosBound = true; } catch (e2) {}
		}
		try { toggleBtn.__mbCEBound = true; } catch (e2) {}
		}

		root = el("div", "mce-root");
		root.id = "mce-root";

		var header = el("div", "mce-header");
		header.appendChild(el("span", "mce-title", "剧情条件解锁面板 v" + MCE_VERSION));
		/* v1.9.29 主题切换按钮（✦ 星星图标）：黑金 ⇄ 星空蓝 循环，持久化 localStorage */
		var themeBtn = el("button", "mce-theme-btn", "✦");
		themeBtn.type = "button";
		themeBtn.title = "切换主题：黑金 / 星空蓝";
		themeBtn.addEventListener("click", function () {
			var next = getTheme() === "starry" ? "gold" : "starry";
			setTheme(next);
			setStatus(next === "starry" ? "已切换：星空蓝 ✦ 愿星光指引你" : "已切换：黑金", "mce-ok");
		});
		header.appendChild(themeBtn);
		/* v1.8.12 错误收集红点（数量徽标，点击展开错误列表） */
		var errBtn = el("button", "mce-errbtn", "0");
		errBtn.type = "button";
		errBtn.addEventListener("click", mbCEToggleErrBox);
		header.appendChild(errBtn);
		var closeBtn = el("button", "mce-close", "关闭");
		closeBtn.type = "button";
		closeBtn.title = "关闭";
		header.appendChild(closeBtn);

		var tabs = el("div", "mce-tabs");
		var names = [["char", "角色"], ["stage", "阶段"], ["scenes", "剧情"], ["places", "场景"], ["global", "全局"], ["mods", "Mod作弊"], ["yanling", "言灵"]];
		names.forEach(function (pair) {
			var b = el("button", pair[0] === mbCEUiState.tab ? "mce-active" : "", pair[1]);
			b.type = "button";
			b.setAttribute("data-tab", pair[0]);
			tabs.appendChild(b);
		});

		var body = el("div", "mce-body");
		var panes = [["char", "mce-pane mce-active"], ["stage", "mce-pane"], ["scenes", "mce-pane"],
			["places", "mce-pane"], ["global", "mce-pane"], ["mods", "mce-pane"], ["yanling", "mce-pane"]];
		panes.forEach(function (pair) {
			var p = el("div", pair[0] === mbCEUiState.tab ? "mce-pane mce-active" : "mce-pane");
			p.setAttribute("data-pane", pair[0]);
			body.appendChild(p);
		});

		var status = el("div", "mce-status", "就绪");

		root.appendChild(header);
		root.appendChild(tabs);
		root.appendChild(body);
		root.appendChild(status);
		document.body.appendChild(root);

		/* v1.8.12 错误列表箱（header 红点下方） + 复制全部 */
		var errBox = el("div", "mce-errbox");
		var errTools = el("div", "mce-row");
		var copyBtn = el("button", "", "复制全部错误"); copyBtn.type = "button";
		copyBtn.addEventListener("click", mbCECopyErrors);
		var clearBtn = el("button", "", "清空"); clearBtn.type = "button";
		clearBtn.addEventListener("click", function () { mbCEErrors = []; mbCEUpdateErrBadge(true); mbCERenderErrBox(); });
		errTools.appendChild(copyBtn);
		errTools.appendChild(clearBtn);
		var errRows = el("div", "mce-errrows");
		errBox.appendChild(errTools);
		errBox.appendChild(errRows);
		if (body.insertBefore) { body.insertBefore(errBox, body.firstChild); }
		else { body.appendChild(errBox); }
		mbCEErrBtn = errBtn;
		mbCEErrBox = errBox;
		mbCEErrRows = errRows;
		mbCEUpdateErrBadge();

		/* v1.9.29 主题恢复：mbCEUiLoad 已把持久化主题读入 state，ensureDom 后应用类（silent 不重复写） */
		setTheme(mbCEUiState.theme === "starry" ? "starry" : "gold", true);

		closeBtn.addEventListener("click", close);
		tabs.addEventListener("click", function (e) {
			var b = e.target && e.target.closest ? e.target.closest("button[data-tab]") : null;
			if (!b) { return; }
			switchOuterTab(b.getAttribute("data-tab"));
		});
	}

	/* v1.8.12 功能13：渲染节流工具——高频触发合并为一次执行（面板打开期间 passage 切换/搜索输入均适用） */
	var mceRenderTimer = null;
	var mceSearchTimer = null;
	function mceSchedule(fn, ms, bucket) {
		var t = bucket === "search" ? mceSearchTimer : mceRenderTimer;
		if (t) { clearTimeout(t); }
		t = setTimeout(function () {
			if (bucket === "search") { mceSearchTimer = null; } else { mceRenderTimer = null; }
			try { fn(); } catch (e) {}
		}, ms || 60);
		if (bucket === "search") { mceSearchTimer = t; } else { mceRenderTimer = t; }
	}
/* 职责：v2.0.9 原版档案 / 收藏 / 头衔（vcore 六键）导出。
   09-exports2.js 的 mountApi() 会把主导出表挂到 setup.mbStageCE；此处在 mountApi 之后补齐 vcore 键
   （拆段原因：结构门禁 S1 单段 400 行上限；语义化文件名，不用 X2/X3 挤排序）。 */
	function mbCEExportVcore() {
		try {
			var s = getSetup();
			if (!s || !s.mbStageCE) { return; }
			var a = s.mbStageCE;
			a.mbCEVanillaCrimeClear = mbCEVanillaCrimeClear;
			a.mbCEVanillaAntiqueCollect = mbCEVanillaAntiqueCollect;
			a.mbCEVanillaRemyScar = mbCEVanillaRemyScar;
			a.mbCEVanillaExtState = mbCEVanillaExtState;
			a.mbCEVanillaExtUndo = mbCEVanillaExtUndo;
			a.mbCERenderVanillaExt = mbCERenderVanillaExt;
		} catch (e) {}
	}
/* 职责：初始化与刷新钩子 —— hookRefresh（:passagedisplay）、init()、mountApi() 导出 */
	function hookRefresh() {
		var mb = resolveMB();
		if (mb && typeof mb.on === "function") {
			try {
				mb.on(":passagedisplay", function () {
					/* v2.0.0.006：言灵守卫按需起表——只有存档里开关真的开着才起 1s 定时器，
					   翻页即补齐（读档时机晚于模块加载，靠这里保证「不打开面板也生效」） */
					try { mbCEResumeTimers(); } catch (eY) {}
					/* v1.8.12 功能13：节流合并同一帧内的多次触发，避免面板打开时每 passage 全量重建。
					   四巡：Mod作弊 页数据只由用户点击改变——passage 自动刷新跳过该页，长时间停在该页不再被每 passage 重建拖累（第三方特效层 DOM 扫描是卡顿/闪退主因之一） */
					if (openFlag && root && document.body.contains(root)) {
						var at = root.querySelector(".mce-tabs button.mce-active");
						if (at && (at.getAttribute("data-tab") === "mods" || at.getAttribute("data-tab") === "yanling")) { return; }
						mceSchedule(render, 300);
					}
				}, "mbStageCE:refresh");
			} catch (e) {}
		}
	}

	function init() {
		if (initialized) { return; }
		initialized = true;
		if (typeof document === "undefined") { return; }
		mountApi();
	mbCEExportVcore();
		hookPassageOverride();
		hookPassageInit();
		hookPassageEnd(); /* v1.9.23：锚定触发判定（走到锚定地点交互时弹确认条） */
		hookUnfreezePlayerStats(); /* v1.8.19：播放结束自动清理（unfreeze = 场景播放结束，覆盖框架播放器） */
		ensureFarmState(); /* 启动兜底：存档 farm_stage 已推进但 $farm 缺失 → 补空壳，社交页不再崩 */
		ensureAveryMansion(); /* 启动兜底：$avery_mansion / $avery_tower / daily.avery.talk 缺失或残缺 → 补空壳（Mansion 段落防崩） */
		mbCEUiLoad(); /* v1.8.12 持久化：恢复上次页签/搜索词/折叠状态 */
		try { mbCEResumeTimers(); } catch (eY0) {} /* v2.0.0.006：已开启言灵开关的存档，注入后即生效 */
		mbCEHookErrors(); /* v1.8.12 错误收集器：window error + console.error 进面板 */
		if (document.body) {
			ensureDom();
			hookRefresh();
		} else {
			document.addEventListener("DOMContentLoaded", function () {
				ensureDom();
				hookRefresh();
			});
		}
	}

	/* 注册到游戏菜单（框架 Cheats 区域；widget 段落编译成功才注册），失败不影响悬浮按钮 */
	try {
		var mb0 = resolveMB();
		if (mb0 && mb0.tool && typeof mb0.tool.addTo === "function"
			&& typeof Story !== "undefined" && typeof Story.has === "function" && Story.has("MBStageCELink")) {
			mb0.tool.addTo("Cheats", "MBStageCELink");
		}
	} catch (e) {}

	/* 对外 API（立即挂载；init 时补挂，覆盖注入阶段 setup 未就绪的情形） */
	function mountApi() {
		try {
			getSetup().mbStageCE = {
				toggle: toggle,
				open: open,
				close: close,
				refresh: render,
				listCharacters: listCharacters,
				findNpc: findNpc,
				/* v1.9.0 角色分类 + 持久NPC */
				charCategory: charCategory,
				isVanillaNPC: isVanillaNPC,
				isVanillaLoveInterest: isVanillaLoveInterest,
				isPerNpcRole: isPerNpcRole,
				isLoveCharacter: isLoveCharacter,
				perNpcDisplayName: perNpcDisplayName,
				displayNameEx: displayNameEx,
				findNpcEx: findNpcEx,
				CHAR_CATEGORIES: CHAR_CATEGORIES,
				renderCards: renderCards,
				/* v1.9.0 场景页地点子界面 */
				renderPlaces: renderPlaces,
				PLACE_STAGE_GROUPS: PLACE_STAGE_GROUPS,
				placeStageRead: placeStageRead,
				placeStageWrite: placeStageWrite,
				placeStageUndo: placeStageUndo,
				getRomanceStages: getRomanceStages,
				completeRomanceStage: completeRomanceStage,
				unlockAllRomance: unlockAllRomance,
				displayName: displayName,
				getVanillaStages: getVanillaStages,
				completeVanillaStage: completeVanillaStage,
				unlockVanillaAll: unlockVanillaAll,
				describeCondition: describeCondition,
				listStageTypes: listStageTypes,
				/* v2.0.3 P4-1 统一回退中心 */
				undoList: mbCEUndoList,
				undoOne: mbCEUndoOne,
				undoGroup: mbCEUndoGroup,
				undoAll: mbCEUndoAll,
				undoLabel: mbCEUndoLabel,
				undoItemName: mbCEUndoItemName,
				readTransformState: readTransformState,
				adjustTransform: adjustTransform,
				completeTransformStage: completeTransformStage,
				unlockAllTransform: unlockAllTransform,
				listExtTransforms: listExtTransforms,
				completeExtTransform: completeExtTransform,
				getScenesDefs: getScenesDefs,
				/* v2.0.0.006 言灵页 API（异装拦截 / 残留净化 / 负面名声清零） */
				renderYanling: renderYanling,
				yanlingState: mbCEYanlingState,
				yanlingInstall: mbCEYanlingInstall,
				yanlingUninstall: mbCEYanlingUninstall,
				yanlingSync: mbCEYanlingSync,
				yanlingTick: mbCEYanlingTick,
				yanlingToggle: mbCEYanlingToggle,
				yanlingPurgeCross: mbCEYanlingPurgeCross,
				yanlingPurgeTrait: mbCEYanlingPurgeTrait,
				yanlingPurgeFame: mbCEYanlingPurgeFame,
				YANLING_FAME_NEG: mbCEYanlingFameNeg,
				/* v2.0.3：正面名声拉满 + 监狱庇护枚举直写（$prison.protection 是字符串，数字档位会静默半失效） */
				yanlingMaxFame: mbCEYanlingMaxFame,
				yanlingPrisonProtect: mbCEYanlingPrisonProtect,
				/* v2.0.2 言灵扩容：一次性写入动作（衣物 / 数值 / 天气 / 角色放逐） */
				yanlingDryClothes: mbCEYanlingDryClothes,
				yanlingRepairClothes: mbCEYanlingRepairClothes,
				yanlingSemen: mbCEYanlingSemen,
				yanlingMind: mbCEYanlingMind,
				yanlingSadism: mbCEYanlingSadism,
				yanlingSeeds: mbCEYanlingSeeds,
				yanlingRobinMoney: mbCEYanlingRobinMoney,
				yanlingAveryDate: mbCEYanlingAveryDate,
				yanlingHeadPassword: mbCEYanlingHeadPassword,
				yanlingFeats: mbCEYanlingFeats,
				yanlingFarm: mbCEYanlingFarm,
				yanlingMilk: mbCEYanlingMilk,
				yanlingWeather: mbCEYanlingWeather,
				yanlingGwylanBanish: mbCEYanlingGwylanBanish,
				yanlingGwylanRecall: mbCEYanlingGwylanRecall,
				yanlingKylar: mbCEYanlingKylar,
				yanlingWhitney: mbCEYanlingWhitney,
				YANLING_WEATHER: mbCEYanlingWeatherMap,
				sceneStatus: sceneStatus,
				completeScene: completeScene,
				listSceneLines: listSceneLines,
				/* v1.9.2 剧情页分区：原版场景键索引 + 角色映射 */
				VANILLA_SCENE_KEYS: VANILLA_SCENE_KEYS,
				isVanillaSceneKey: isVanillaSceneKey,
				sceneRoleOf: sceneRoleOf,
				/* v1.9.2 任务三：非场景剧情进度控制（按角色） */
				getRolePlots: getRolePlots,
				getDotPath: getDotPath,
				setDotPath: setDotPath,
				applyRolePlotAction: applyRolePlotAction,
				listPlaceGroups: listPlaceGroups,
				placeNameCN: placeNameCN,
				teleportTo: teleportTo, mbCECurrentPassage: mbCECurrentPassage, mbCEPassageMacroWarn: mbCEPassageMacroWarn,
				listAllPassages: listAllPassages,
				getPinnedScene: getPinnedScene,
				pinQueueIndex: pinQueueIndex,
				pinScene: pinScene,
				pinSceneLine: pinSceneLine,
				unpinScene: unpinScene,
				applyWorldUnlock: applyWorldUnlock,
				applyWorldUnlockForScene: applyWorldUnlockForScene,
				worldUndo: mbCEWorldUndo,
				ensureFarmState: ensureFarmState,
				ensureAveryMansion: ensureAveryMansion,
				ensureGwylanSceneState: ensureGwylanSceneState,
				isGwylanGardenPassage: isGwylanGardenPassage,
				/* v1.4.0 Mod作弊 */
				getCheatMods: getCheatMods,
				renderModCheats: renderModCheats,
				renderModCheatDetail: renderModCheatDetail,
				applyCheatModValue: applyCheatModValue,
				cheatReadSafe: cheatReadSafe,
				undoCheatModValue: undoCheatModValue,
				skipCheatTask: skipCheatTask,
				completeCheatTask: completeCheatTask,
				setCheatStage: setCheatStage,
				jumpCheatStageMax: jumpCheatStageMax,
				resetCheatStage: resetCheatStage,
				toggleCheatAbility: toggleCheatAbility,
				cheatSceneAction: cheatSceneAction,
				cheatWriteValue: cheatWriteValue,
				/* v2.0.4 治理：列表型写入导出，供声明矩阵测试走真实数组通道（内部实现未改） */
				cheatWriteListValue: cheatWriteListValue,
				/* v2.0.0.002 快速面板：数值锁定（复用 07f-lock）+ 武器直接获得 */
				quickTargetValue: quickTargetValue,
				grantWeapon: grantWeapon,
				grantAllWeapons: grantAllWeapons,
				/* v2.0.0.002 说话态度：原版三档（meek/neutral/bratty）+ 选定后永久维持
				   （旧口径"把 $submissive 写进 851–1149 交集"已按用户纠偏作废，符号保留供兼容） */
				attitudeState: attitudeState,
				applyAttitude: applyAttitude,
				readAttitude: readAttitude,
				FSA_FREE_MID: FSA_FREE_MID,
				MB_CE_ATTITUDE_TIERS: MB_CE_ATTITUDE_TIERS,
				mbCEAttitudeState: mbCEAttitudeState,
				mbCEAttitudeApply: mbCEAttitudeApply,
				mbCEAttitudeHold: mbCEAttitudeHold,
				mbCEAttitudeRelease: mbCEAttitudeRelease,
				mbCEAttitudeTick: mbCEAttitudeTick,
				/* v2.0.0.002 潜伏者：捕捉/冰箱无上限（启动前文本解限 + 自动搬运保底） */
				mbCELurkerState: mbCELurkerState,
				mbCELurkerSet: mbCELurkerSet,
				mbCELurkerAutoTick: mbCELurkerAutoTick,
				mbCELurkerSetAuto: mbCELurkerSetAuto,
				MB_CE_LURKER_MAX: MB_CE_LURKER_MAX,
				MB_CE_LURKER_FRIDGE_MAX: MB_CE_LURKER_FRIDGE_MAX,
				mbCELurkerPatchText: mbCELurkerPatchText,
				mbCELurkerPatchDom: mbCELurkerPatchDom,
				mbCELurkerPatchStory: mbCELurkerPatchStory,
				mbCELurkerPatchReport: mbCELurkerPatchReport,
				mbCELurkerRepatch: mbCELurkerRepatch,
				/* v2.0.0.002 FertilityExpansion 自带作弊等价（10 项，直连 window.EdenCheats） */
				mbCEFertRun: mbCEFertRun,
				mbCEFertChildren: mbCEFertChildren,
				mbCEFertReady: mbCEFertReady,
				MB_CE_FERT_ACTIONS: MB_CE_FERT_ACTIONS,
				/* v2.0.0.002 需求①③：孩子页（好感/定向发送/随叫随到/一键长大）+ 角色页孩子拦截 */
				mbCEFertKidPairs: mbCEFertKidPairs,
				mbCEFertKidInfo: mbCEFertKidInfo,
				mbCEFertKidAlive: mbCEFertKidAlive,
				mbCEFertKidSetAffection: mbCEFertKidSetAffection,
				mbCEFertKidSetLocation: mbCEFertKidSetLocation,
				mbCEFertKidCallToMe: mbCEFertKidCallToMe,
				mbCEFertKidGrowUp: mbCEFertKidGrowUp,
				mbCEFertRenderChildren: mbCEFertRenderChildren,
				MB_CE_FERT_KID_LOCS: MB_CE_FERT_KID_LOCS,
				/* v2.0.0.002 收敛轮：养育四项 / 先天四项写入（补齐四项后调模组 API，缺失则兜底直写） */
				mbCEFertKidSaveSkills: mbCEFertKidSaveSkills,
				mbCEFertKidSaveInnate: mbCEFertKidSaveInnate,
				mbCEFertKidCurSkills: mbCEFertKidCurSkills,
				mbCEFertKidCurInnate: mbCEFertKidCurInnate,
				MB_CE_FERT_KID_SKILLS: MB_CE_FERT_KID_SKILLS,
				MB_CE_FERT_KID_INNATE: MB_CE_FERT_KID_INNATE,
				mbCEFertKidVars: mbCEFertKidVars,
				/* v2.0.0.003 需求②：原版「你对什么感到不安?」直写（$uncomfortable，5 项） */
				mbCEAttitudeSet: mbCEAttitudeSet,
				mbCEAttitudeSetAll: mbCEAttitudeSetAll,
				mbCEAttitudeUndo: mbCEAttitudeUndo,
				mbCEAttitudeGet: mbCEAttitudeGet,
				mbCEAttitudeGate: mbCEAttitudeGate,
				MB_CE_ATTITUDE_ITEMS: MB_CE_ATTITUDE_ITEMS,
				mbCEEdenChildIdOf: mbCEEdenChildIdOf,
				mbCEOnPassageInit: mbCEOnPassageInit,
				undoRomanceStage: undoRomanceStage,
				undoVanillaStage: undoVanillaStage,
				onPassageOverride: onPassageOverride,
				/* v1.9.23 锚定触发：地点判定 / 确认条触发 / 元数据 / 前置提示 */
				mbCEOnPassageEnd: mbCEOnPassageEnd,
				startAnchoredReplay: startAnchoredReplay,
				/* v1.9.30 剧情直达触发：从场景 def 直接开播（跳过地点判定/确认条/队列） */
				directTriggerScene: directTriggerScene,
				/* v1.9.30.005 出口判据升级：widget 结束信号表为惰性缓存（首次判定构建一次）。
				   游戏内段落集合固定，正常运行不会重建；测试注入 mock 段落后需显式重置。 */
				resetWidgetEndSignalCache: function () { mbCE_widgetEndTbl = null; },
				/* v1.9.30.005 判据自检口：注释被剔除后的纯函数级判定（供 smoke 直接断言，
				   不必构造 Story 段落实例；判据改动必须能在这里被单测抓到） */
				srcHasEndSignal: function (src) { return mbCESrcHasEndSignal(src); },
				sceneAnchorMeta: sceneAnchorMeta,
				pendingPreconds: pendingPreconds,
				precondDone: precondDone,
				fillStats: fillStats,
				statDefsFor: statDefsFor,
				globalFill: globalFill,
				globalRomance: globalRomance,
				globalTransform: globalTransform,
				/* v1.9.28：全局页批量解锁（供外部自动化/测试调用，返回解锁计数） */
				globalUnlockClothes: globalUnlockClothes,
				globalUnlockRecipes: globalUnlockRecipes,
				/* v1.8.8 庄园自动维护（学 AutoClean 0.1.5 原功能） */
				mcFeedAvery: mcFeedAvery,
				mcMaintainFarm: mcMaintainFarm,
				/* v1.8.10 庄园自动维护扩展（神殿/伊甸/补给/打扫） */
				mcMaintainTemple: mcMaintainTemple,
				mcMaintainEden: mcMaintainEden,
				mcRestockSupplies: mcRestockSupplies,
				mcCleanMansion: mcCleanMansion,
				/* v2.0.3 维护写入留痕回退 */
				maintUndo: mbCEMaintUndo,
				maintUndoAll: mbCEMaintUndoAll,
				maintWrite: mbCEMaintWrite,
				/* v1.9.x 庄园自动维护：每日全自动调度（AutoClean 模式） */
				AUTO_MAINTAIN_ITEMS: AUTO_MAINTAIN_ITEMS,
				mcAutoState: mcAutoState,
				mcAutoIsOn: mcAutoIsOn,
				mcAutoSet: mcAutoSet,
				mcAutoRunOnce: mcAutoRunOnce,
				mcAutoMaintainTick: mcAutoMaintainTick,
				/* v1.8.9 战斗终结（学 CombatTerminator 0.1 原功能，数据层动作） */
				COMBAT_ACTIONS: COMBAT_ACTIONS,
				mcCombatAction: mcCombatAction,
				/* v1.4.5 角色一览恋爱候选过滤 */
				isLoveCandidate: isLoveCandidate,
				addLoveInterest: addLoveInterest,
				/* v1.5.0 誓言修复 + NPC 特质获取 */
				getVowStatus: getVowStatus,
				fixVows: fixVows,
				listNpcTraits: listNpcTraits,
				grantNpcTrait: grantNpcTrait,
				revertNpcTrait: revertNpcTrait,
				/* v1.8.0 玩家属性与特质管理 */
				renderPlayerEdit: renderPlayerEdit,
				compileVanillaTraits: compileVanillaTraits,
				groupTraitSeries: groupTraitSeries, traitSeriesName: traitSeriesName,
				discoverModTraits: discoverModTraits,
				traitOwned: traitOwned,
				grantTrait: grantTrait,
				revokeTrait: revokeTrait,
				traitWriteValue: traitWriteValue,
				traitDisplayName: traitDisplayName,
				traitEval: traitEval,
				/* v1.8.12 特质收藏 */
				favTraitKey: favTraitKey,
				getFavTraits: getFavTraits,
				isFavTrait: isFavTrait,
				toggleFavTrait: toggleFavTrait,
				VANILLA_TRAITS_RAW: VANILLA_TRAITS_RAW,
				/* v1.9.28：特质分类中文组标题映射（与 RAW 配套，供外部校验覆盖完整性） */
				TRAIT_ZH_CAT: TRAIT_ZH_CAT,
				/* v1.9.15 数值固定（07f-lock.js）：锁定向/强制写回/取消 */
				mbCELockSet: mbCELockSet,
				mbCELockRemove: mbCELockRemove,
				mbCELockHas: mbCELockHas,
				mbCELockTick: mbCELockTick,
				mbCELockRead: mbCELockRead, mbCELockResume: mbCELockResume, mbCEResumeTimers: mbCEResumeTimers,
				MB_CE_LOCK_PRESETS: MB_CE_LOCK_PRESETS,
				/* v2.0.1 收敛：锁定文案中文名 + 直达前原版状态兜底（供测试与外部校验） */
				mbCELockLabel: mbCELockLabel,
				ensureSceneStateFor: ensureSceneStateFor,
				/* v2.0.7 P1/P2/D4/D6：锁定来源判定 + 回退连带解锁 + 预览队列/全部确认 */
				mbCELockSource: mbCELockSource,
				mbCEPreviewCount: mbCEPreviewCount,
				mbCEPreviewConfirm: mbCEPreviewConfirm,
				mbCEPreviewConfirmAll: mbCEPreviewConfirmAll,
				mbCEPreviewCancel: mbCEPreviewCancel,
				mbCEPreviewGate: mbCEPreviewGate, mbCEAdapterAction: mbCEAdapterAction, hasV: hasV, CHEAT_ADAPTERS: CHEAT_ADAPTERS,
				mbCEPaneRefresh: mbCEPaneRefresh,
				/* v2.0.7 R1/R2/R3/R4：外观隐藏 + 小岛生存 + 地下妓院（07j / 07k） */
				mbCEHideApply: mbCEHideApply,
				mbCEHideUndo: mbCEHideUndo,
				mbCEHideTargets: mbCEHideTargets,
				mbCEHideTick: mbCEHideTick,
				mbCEHideForce: mbCEHideForce,
				mbCEHideNoPenalty: mbCEHideNoPenalty,
				MB_CE_HIDE_WINGS_SPECIES: MB_CE_HIDE_WINGS_SPECIES,
				mbCEIslandV: mbCEIslandV,
				mbCEPlaceWriteRaw: mbCEPlaceWriteRaw,
				mbCEIslandLocToggle: mbCEIslandLocToggle,
				mbCEIslandNumWrite: mbCEIslandNumWrite,
				MB_CE_ISLAND_NUMS: MB_CE_ISLAND_NUMS,
				MB_CE_ISLAND_LOCS: MB_CE_ISLAND_LOCS,
				MB_CE_ISLAND_BUILDS: MB_CE_ISLAND_BUILDS,
				MB_CE_NPC_REUNION: MB_CE_NPC_REUNION,
				renderTransformHideSec: renderTransformHideSec, renderIslandSec: renderIslandSec, renderNpcUndergroundSec: renderNpcUndergroundSec,
				/* 兼容导出（v1.7.x 保留） */
				isModOnlyRoot: isModOnlyRoot,
				ORIGINAL_V_ROOT_KEYS: ORIGINAL_V_ROOT_KEYS,
				cheatWriteValuePlayer: function (path, raw, type) {
					return cheatWriteValue("player-self", "p:" + path, type === "string" ? "stage_set" : "value_set", path, raw, type);
				},
				undoPlayerValue: function (path) { return undoCheatModValue("player-self", "p:" + path); },
				zhKey: zhKey, zhPath: zhPath, zhType: zhType, ZH_KEYS: ZH_KEYS,
				/* v1.7.2 游戏属性面板快捷编辑 */
				PANEL_QUICK_GROUPS: PANEL_QUICK_GROUPS,
				quickReadValue: quickReadValue,
				quickWrite: quickWrite,
				ensureProfShell: ensureProfShell,
				/* v1.9.13 预设模板 / 时间调节 / 数值搜索（全局页 + 玩家自己页 + Mod 作弊页） */
				applyQuickPreset: applyQuickPreset,
				mcTimeNow: mcTimeNow, mcTimeAdvance: mcTimeAdvance, mcTimeJump: mcTimeJump,
				setModValueFilter: setModValueFilter, cheatValueMatches: cheatValueMatches, renderCheatValues: renderCheatValues,
				/* v1.9.0 性别切换（玩家自己页）：原版键 penisExist/vaginaExist/penissize/gender_body */
				getPlayerGender: getPlayerGender,
				applyPlayerGender: applyPlayerGender,
				/* v1.8.12 错误收集器 + 面板状态持久化 */
				mbCEPushError: mbCEPushError,
				mbCEErrors: function () { return mbCEErrors.slice(); },
				/* v1.8.15 九巡：留痕有界化（测试与诊断用） */
				mbCEWroteTrim: mbCEWroteTrim,
				mbCEUiState: function () { return JSON.parse(JSON.stringify(mbCEUiState)); },
				mbCEUiSave: mbCEUiSave,
				mbCEUiLoad: mbCEUiLoad,
				mbCEUiCollapsed: mbCEUiCollapsed,
				/* v1.9.29 双主题：setTheme 切主题（starry/gold，自动持久化）；showAnchorPrompt 供外部/测试触发锚定确认条 */
				setTheme: setTheme,
				getTheme: getTheme,
				showAnchorPrompt: showAnchorPrompt,
				hideAnchorPrompt: hideAnchorPrompt,
				/* v1.8.12 功能12：适配器工作流审计 */
				auditAdapters: auditAdapters
			};
		} catch (e) {}
	}
	mountApi();

	init();
})();

