
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
	var MCE_VERSION = "1.8.7";
	function getV() {
		try { if (typeof V !== "undefined" && V && typeof V === "object") { return V; } } catch (e) {}
		try { if (typeof State !== "undefined" && State.variables) { return State.variables; } } catch (e) {}
		return {};
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

	/* ============ 数值定义（通用标准，非角色硬编码） ============ */
	var STAT_DEFS = [
		{ key: "love",      label: "爱意", fill: 100, max: 100 },
		{ key: "lust",      label: "情欲", fill: 100, max: 100 },
		{ key: "dom",       label: "支配", fill: 100, max: 100 },
		{ key: "obedience", label: "服从", fill: 100, max: 100 },
		{ key: "trust",     label: "信任", fill: 100, max: 100 },
		{ key: "wary",      label: "警戒", fill: 0,   max: 100 },
		{ key: "jealousy",  label: "嫉妒", fill: 0,   max: 100 }
	];

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
		"tsukihan": "月半", "rowan": "罗文", "adrian": "阿德里安", "marlow": "马洛",
		"grant": "格兰特", "needmeet": "尼德米特", "feng": "老冯"
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
		return names;
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
						out.push({ key: k, label: k, fill: Number(c.max), max: Number(c.max), min: min, custom: true });
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
		var min = def.min != null ? def.min : 0;
		var max = def.max != null ? def.max : 100;
		npc[def.key] = Math.max(min, Math.min(max, Math.round(Number(val) || 0)));
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
			V.mbCE_wrote["romance:native:" + String(name).toLowerCase()] = { type: "native", path: "loveInterest", value: name, name: name };
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
				/* 一键完成亚历克斯农场阶段会把 $farm_stage 直接置高（绕过本体农场线初始化），
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
		ensureFarmState(); /* 一键完成后兜底：若写入了 farm_stage（亚历克斯农场阶段），立即补 $farm 空壳防社交页崩 */
		return { characters: chars.length, total: total, fixed: fixed };
	}
	function globalTransform() {
		var chars = listCharacters();
		var fixed = 0;
		chars.forEach(function (name) { fixed += unlockAllTransform(name); });
		return { characters: chars.length, stages: fixed };
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
		} catch (e) {}
	}
	function recordVanillaWrite(key) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["vanilla:" + key] = { type: "vanilla", key: key, npc: "Gwylan", t: Date.now() };
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
			return { ok: false, message: "执行异常：" + (e && e.message ? e.message : e) };
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
			var parsed = parseCondition(stage.text, name);
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
			return { ok: false, message: "回退异常：" + (e && e.message ? e.message : e) };
		}
	}

	/* ============ v1.4.0 Mod作弊：第三方模组扩展内容操控（第 6 主页面）
	       边界：完全不处理 DoL 原版变量（过滤清单 CHEAT_VANILLA_ROOTS）；
	       只操作注册表 / 内置适配器 / 被动探测声明出的模组专属变量。
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
		"mbCE_queue", "mbCE_wrote", "mbCE_replayOnce", "mbCE_replayPending", "mbCE_unlockedPlaces"
	];
	/* v1.7.0：DoL 原版 V 顶层键清单（从本体 0.5.12.13 HTML 宏上下文实证提取，183 键）。
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
		"arousal": "兴奋", "pain": "疼痛", "control": "控制", "deviancy": "堕落", "promiscuity": "滥交",
		"fame": "名声", "reputation": "声誉", "dominance": "支配欲", "confidence": "自信", "sanity": "理智",
		"health": "健康", "willpower": "意志", "swim": "游泳", "tenderness": "温柔", "sensitivity": "敏感",
		"familiarity": "熟悉度", "pheromones": "信息素", "sass": "傲慢", "beauty": "美貌",
		"paraphilia": "性癖", "weirdness": "怪诞", "addiction": "上瘾", "corruption": "腐化",
		"whoring": "卖淫", "exhibitionism": "裸露癖", "submissive": "顺从", "submissiveness": "顺从度",
		"tolerances": "耐受", "tolerance": "耐受", "spunk": "精液", "life": "生命", "dead": "死亡",
		"physique": "体格", "purity": "纯洁", "drugged": "药物影响", "tiredness": "疲劳",
		"history": "经历", "inventory": "物品栏", "map": "地图", "position": "姿势", "target": "目标",
		"state": "状态", "seen": "已被看见", "action": "动作", "hide": "隐藏", "beastRut": "兽性发情",
		"reputation_fame": "声名", "reputation_rep": "声誉值",
		/* 技能（常见派生键） */
		"skulduggery": "开锁技巧", "english": "英语", "maths": "数学", "science": "科学",
		"historytrait": "历史才能", "english_exam": "英语考试", "maths_exam": "数学考试",
		"science_exam": "科学考试", "history_exam": "历史考试",
		"handskill": "手部技巧", "oralskill": "口部技巧", "penileskill": "阴茎技巧",
		"vaginalskill": "阴道技巧", "analSkill": "肛部技巧", "analskill": "肛部技巧",
		"thighskill": "腿部技巧", "feetskill": "足部技巧", "chestskill": "胸部技巧",
		"bottomskill": "臀部技巧", "swimmingskill": "游泳技巧", "seductionskill": "诱惑技巧",
		"danceskill": "舞蹈技巧", "feetuse": "足交使用", "neckuse": "颈部使用",
		/* 模组键 */
		"RobinTemple": "罗宾神殿", "TempleChoir": "神殿唱诗班", "LostLamb": "迷途羔羊",
		"TempleDuties": "神殿职责", "DeadwoodReblooms": "枯木逢春", "DeadwoodRebloomsAttitudes": "枯木逢春·态度",
		"Phone": "智能手机", "VPhone": "智能手机", "SmartPhone": "智能手机", "GameUI": "游戏界面",
		"SoftWet": "SoftWet 湿润系统", "ModHub": "模组中心", "DomRobin": "DomRobin", "MLI": "MLI 恋爱扩展",
		"stage": "阶段", "secret": "秘密", "rite_stage": "仪式阶段", "followup": "后续", "allowed": "允许",
		"discovered": "已发现",
		/* 游戏属性面板（颜色分级）快捷编辑 */
		"purity": "纯洁", "beauty": "容貌", "physique": "体能", "awareness": "意识",
		"promiscuity": "淫乱", "exhibitionism": "暴露癖", "deviancy": "异种癖",
		"skulduggery": "诡术", "danceskill": "舞蹈", "swimmingskill": "游泳", "athletics": "运动",
		"tending": "护理", "housekeeping": "家务",
		"seductionskill": "魅惑", "chestskill": "胸部", "handskill": "手部", "bottomskill": "臀部",
		"penileskill": "阴茎", "vaginalskill": "小穴", "analskill": "后庭", "thighskill": "大腿",
		"feetskill": "足部", "science": "科学", "maths": "数学", "history": "历史",
		"spray": "防狼喷雾", "baton": "短棍", "whip": "鞭子", "net": "网", "pickaxe": "镐", "prof": "武器技能"
	};
	var ZH_TYPES = { "number": "数值", "boolean": "布尔", "string": "文本", "object": "对象", "function": "函数", "undefined": "未定义", "null": "空" };
	function zhKey(k) { return ZH_KEYS[k] || String(k); }
	function zhPath(p) { return String(p).split(".").map(zhKey).join("."); }
	function zhType(t) { return ZH_TYPES[t] || t; }
	var CHEAT_ADAPTERS = {};      /* modId -> { detect: fn, entry: {...} }（内置适配器按需填充） */
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
	/* 动态发现：注册制 + 内置适配器（探测命中即合并）+ 被动识别占位；每次调用重扫。 */
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
			return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, levels[idxStr], "string", 0, levels.length - 1);
		}
		return cheatWriteValue(modId, "stage_set:" + key, "stage_set", s.varPath, Number(level), "number", levels[0], levels[levels.length - 1]);
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
	function toggleCheatAbility(modId, key, enabled) {
		var m = findCheatMod(modId), a = m && findCheatItem(m.abilities, key);
		if (!a) { return { ok: false, message: "能力不存在或该模组未注册" }; }
		if (!a.varPath) { return { ok: false, message: "「" + a.name + "」未声明能力变量（varPath），无法切换" }; }
		return cheatWriteValue(modId, "ability_set:" + key, "ability_set", a.varPath, !!enabled, "boolean");
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
		return cheatWriteValue(modId, "value_set:" + key, "value_set", it.varPath, raw, it.type === "boolean" ? "boolean" : "number", it.min, it.max);
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
	function renderModCheatDetail(modId) {
		var pane = root.querySelector('[data-pane="mods"]');
		if (!pane) { return; }
		var m = findCheatMod(modId);
		pane.textContent = "";
		if (!m) {
			pane.appendChild(el("div", "mce-err", "模组未识别（可能已卸载），请返回列表。"));
			return;
		}
		var back = el("button", "", "← 返回模组列表");
		back.type = "button";
		back.addEventListener("click", function () { curCheatModId = ""; renderModCheats(); });
		pane.appendChild(back);
		pane.appendChild(el("div", "mce-hint", "【" + m.modName + "】作弊控制"));
		pane.appendChild(el("div", "mce-hint", "所有操作仅作用于 " + m.modName + " 的新增内容，不会改动游戏本体与其他模组数据。"));
		var any = false;
		if (m.tasks.length) { any = true; renderCheatTasks(pane, m); }
		if (m.stages.length || m.abilities.length) { any = true; renderCheatStages(pane, m); }
		if (m.scenes.length) { any = true; renderCheatScenes(pane, m); }
		if (m.values.length) { any = true; renderCheatValues(pane, m); }
		if (!any) {
			pane.appendChild(el("div", "mce-hint", "该模组已识别但未声明可操控项（任务/阶段/剧情/数值均为空）。"));
		}
	}
	function renderCheatTasks(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "1. 模组新增任务"));
		m.tasks.forEach(function (t) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", t.name || t.key));
			var b1 = el("button", "", "跳过任务"); b1.type = "button";
			b1.addEventListener("click", function () { actCheat(skipCheatTask(m.modId, t.key), m.modId); });
			var b2 = el("button", "", "直接完成任务"); b2.type = "button";
			b2.addEventListener("click", function () { actCheat(completeCheatTask(m.modId, t.key), m.modId); });
			row.appendChild(b1); row.appendChild(b2);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function renderCheatStages(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "2. 模组新增阶段 & 能力"));
		m.stages.forEach(function (s) {
			var levels = Array.isArray(s.levels) && s.levels.length ? s.levels : [0];
			var labels = Array.isArray(s.labels) && s.labels.length ? s.labels : levels.map(function (lv) { return String(lv); });
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", "阶段 · " + (s.name || s.key)));
			var sel = el("select", "mce-sel");
			levels.forEach(function (lv, i) {
				var opt = el("option", "", labels[i] !== undefined ? labels[i] : String(lv));
				opt.value = String(lv);
				sel.appendChild(opt);
			});
			/* v1.4.4：回显当前阶段值（字符串枚举/数字枚举均按值匹配），应用后重渲染立即可见生效 */
			var curStage = cheatReadSafe(m.modId, s.varPath);
			if (curStage !== undefined && curStage !== null) {
				var curStr = String(curStage);
				for (var si = 0; si < levels.length; si++) {
					if (String(levels[si]) === curStr) { sel.selectedIndex = si; break; }
				}
			}
			var bSet = el("button", "", "应用"); bSet.type = "button";
			bSet.addEventListener("click", function () { actCheat(setCheatStage(m.modId, s.key, sel.value), m.modId); });
			var bMax = el("button", "", "跳至最高"); bMax.type = "button";
			bMax.addEventListener("click", function () { actCheat(jumpCheatStageMax(m.modId, s.key), m.modId); });
			var bMin = el("button", "", "回退初始"); bMin.type = "button";
			bMin.addEventListener("click", function () { actCheat(resetCheatStage(m.modId, s.key), m.modId); });
			row.appendChild(sel); row.appendChild(bSet); row.appendChild(bMax); row.appendChild(bMin);
			g.appendChild(row);
		});
		m.abilities.forEach(function (a) {
			var row = el("div", "mce-row");
			var box = el("input", "");
			box.type = "checkbox";
			box.checked = !!cheatReadSafe(m.modId, a.varPath);
			box.addEventListener("change", function () { actCheat(toggleCheatAbility(m.modId, a.key, box.checked), m.modId); });
			row.appendChild(box);
			row.appendChild(el("span", "mce-row-lbl", "能力 · " + (a.name || a.key) + (a.varPath ? "（" + a.varPath + "）" : "")));
			/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
			var det = el("details", "mce-ab-detail");
			det.appendChild(el("summary", "mce-ab-sum", "说明"));
			var body = el("div", "mce-ab-body");
			if (a.varPath) { body.appendChild(el("div", "", "写入路径：" + a.varPath)); }
			body.appendChild(el("div", "", "类型：" + (a.type || "boolean")));
			if (a.type === "number" && (a.min !== undefined || a.max !== undefined)) {
				body.appendChild(el("div", "", "钳制范围：" + (a.min !== undefined ? a.min : "-∞") + " ~ " + (a.max !== undefined ? a.max : "∞")));
			}
			if (a.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + a.note)); }
			det.appendChild(body);
			row.appendChild(det);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function renderCheatScenes(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "3. 模组自定义剧情"));
		m.scenes.forEach(function (s) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", s.name || s.key));
			var b1 = el("button", "", "跳过此段剧情"); b1.type = "button";
			b1.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_skip"), m.modId); });
			var b2 = el("button", "", "强制完成剧情"); b2.type = "button";
			b2.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_force"), m.modId); });
			var b3 = el("button", "", "重置剧情进度"); b3.type = "button";
			b3.addEventListener("click", function () { actCheat(cheatSceneAction(m.modId, s.key, "scene_reset"), m.modId); });
			row.appendChild(b1); row.appendChild(b2); row.appendChild(b3);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function renderCheatValues(pane, m) {
		var g = el("div", "mce-grp");
		g.appendChild(el("div", "mce-grp-t", "4. 自定义数值修改"));
		m.values.forEach(function (it) {
			if (it.type === "list") {
				var opts = Array.isArray(it.options) ? it.options : [];
				var curArr = cheatReadSafe(m.modId, it.varPath);
				var arr = Array.isArray(curArr) ? curArr : [];
				if (!opts.length) {
					g.appendChild(el("div", "mce-hint", (it.name || it.key) + "：未声明候选值（options 为空）。"));
				}
				opts.forEach(function (opt) {
					var brow = el("div", "mce-row");
					var box = el("input", "");
					box.type = "checkbox";
					box.checked = arr.indexOf(opt) !== -1;
					box.addEventListener("change", function () {
						actCheat(applyCheatModValue(m.modId, it.key, { value: opt, on: box.checked }), m.modId);
					});
					brow.appendChild(box);
					brow.appendChild(el("span", "mce-row-lbl", (it.name || it.key) + " · " + opt + "（" + it.varPath + "）"));
					var und = el("button", "", "回退"); und.type = "button";
					und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key + ":" + opt), m.modId); });
					brow.appendChild(und);
					g.appendChild(brow);
				});
				return;
			}
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", (it.name || it.key) + "（" + it.varPath + "）"));
			var inp = el("input", "mce-inp");
			inp.type = it.type === "boolean" ? "checkbox" : "number";
			if (it.type !== "boolean") {
				if (typeof it.min === "number") { inp.min = String(it.min); }
				if (typeof it.max === "number") { inp.max = String(it.max); }
				inp.step = "1";
			}
			var cur = cheatReadSafe(m.modId, it.varPath);
			if (it.type === "boolean") { inp.checked = !!cur; }
			else if (cur !== undefined && cur !== null) { inp.value = String(cur); }
			var b = el("button", "", "应用修改"); b.type = "button";
			b.addEventListener("click", function () {
				var raw = it.type === "boolean" ? inp.checked : inp.value;
				actCheat(applyCheatModValue(m.modId, it.key, raw), m.modId);
			});
			row.appendChild(inp); row.appendChild(b);
			var und = el("button", "", "回退"); und.type = "button";
			und.addEventListener("click", function () { actCheat(undoCheatModValue(m.modId, "value_set:" + it.key), m.modId); });
			row.appendChild(und);
			/* v1.8.7 数值项说明折叠（学 CE 逐项数值文档）：写入路径/类型/钳制/手写说明 */
			var det = el("details", "mce-ab-detail");
			det.appendChild(el("summary", "mce-ab-sum", "说明"));
			var body = el("div", "mce-ab-body");
			if (it.varPath) { body.appendChild(el("div", "", "写入路径：" + it.varPath)); }
			body.appendChild(el("div", "", "类型：" + (it.type || "number")));
			if (typeof it.min === "number" || typeof it.max === "number") {
				body.appendChild(el("div", "", "钳制范围：" + (typeof it.min === "number" ? it.min : "-∞") + " ~ " + (typeof it.max === "number" ? it.max : "∞")));
			}
			if (it.note) { body.appendChild(el("div", "mce-ab-note", "说明：" + it.note)); }
			det.appendChild(body);
			row.appendChild(det);
			g.appendChild(row);
		});
		pane.appendChild(g);
	}
	function actCheat(res, modId) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		if (modId) { renderModCheatDetail(modId); }
	}

	/* ============ v1.7.0 玩家属性全量编辑（Mod作弊 主容器页「玩家自己」入口）
	       数据源：① V.player 全量（递归限深 3，循环引用防崩）；② 模组属性 = 运行时 V 顶层键
	       - ORIGINAL_V_ROOT_KEYS - CHEAT_VANILLA_ROOTS - mbCE_*（与原版比对，只添加没有的）。
	       可改：number（数字输入）/ boolean（勾选）/ 短字符串阶段（≤24 字符且无空白 → 文本输入）；
	       只读：长字符串 / 函数 / undefined / null / 深度超限 / 循环引用。
	       写入：复用 cheatWriteValue（modId="player-self"，root=player 或模组键不在原版黑名单），
	       mbCE_wrote 留痕 + 每项回退按钮。 ============ */
	var curPlayerFilter = "";
	var curPlayerSection = "player";
	function actPlayer(res) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		renderPlayerEdit();
	}
	/* v1.7.2：游戏属性面板（颜色分级）快捷编辑——直接改游戏面板显示的原版数值键
	   （purity/physique 等顶层键 + prof.* 武器键；实证自本体 currentSkillValue 体系与 $prof 对象；
	     歌唱/驾驶无原版变量（GameUI 自定义/未解锁），不收录；不安感无数值显示，不收录）。 */
	var PANEL_QUICK_GROUPS = [
		{ title: "核心属性", items: [["purity", "纯洁"], ["beauty", "容貌"], ["physique", "体能"], ["willpower", "意志"], ["awareness", "意识"], ["promiscuity", "淫乱"], ["exhibitionism", "暴露癖"], ["deviancy", "异种癖"]] },
		{ title: "基础技能", items: [["skulduggery", "诡术"], ["danceskill", "舞蹈"], ["swimmingskill", "游泳"], ["athletics", "运动"], ["tending", "护理"], ["housekeeping", "家务"]] },
		{ title: "性技能", items: [["seductionskill", "魅惑"], ["oralskill", "口部"], ["chestskill", "胸部"], ["handskill", "手部"], ["bottomskill", "臀部"], ["penileskill", "阴茎"], ["vaginalskill", "小穴"], ["analskill", "后庭"], ["thighskill", "大腿"], ["feetskill", "足部"]] },
		{ title: "学校成绩", items: [["science", "科学"], ["maths", "数学"], ["english", "语文"], ["history", "历史"]] },
		{ title: "武器技能", items: [["prof.spray", "防狼喷雾"], ["prof.baton", "短棍"], ["prof.whip", "鞭子"], ["prof.net", "网"], ["prof.pickaxe", "镐"]] }
	];
	function quickReadValue(path) {
		try {
			var V2 = getV();
			if (!V2) { return null; }
			if (String(path).indexOf("prof.") === 0) {
				var leaf = String(path).split(".")[1];
				return (V2.prof && typeof V2.prof === "object") ? V2.prof[leaf] : undefined;
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
	function quickWrite(path, raw) {
		if (String(path).indexOf("prof.") === 0) {
			var es = ensureProfShell();
			if (!es.ok) { return es; }
		}
		return cheatWriteValue("player-self", "p:" + path, "value_set", path, raw, "number");
	}
	function renderQuickRow(pane, path, label) {
		var cur = quickReadValue(path);
		var row = el("div", "mce-row");
		row.appendChild(el("span", "mce-row-lbl", label + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "number"; inp.step = "1"; inp.value = (typeof cur === "number") ? String(cur) : "0";
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () { actPlayer(quickWrite(path, inp.value)); });
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actPlayer(undoCheatModValue("player-self", "p:" + path)); });
		row.appendChild(inp); row.appendChild(b); row.appendChild(und);
		pane.appendChild(row);
	}
	function renderQuickPanel(pane) {
		PANEL_QUICK_GROUPS.forEach(function (g) {
			var box = el("div", "mce-grp");
			box.appendChild(el("div", "mce-grp-t", g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）"));
			g.items.forEach(function (it) { renderQuickRow(box, it[0], it[1]); });
			pane.appendChild(box);
		});
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
function traitEval(V, C, expr) {
	try {
		if (!expr) { return false; }
		var js = String(expr)
			.replace(/\bisnot\b/g, "!==").replace(/\bis\b/g, "===")
			.replace(/\bgte\b/g, ">=").replace(/\bgt\b/g, ">")
			.replace(/\blte\b/g, "<=").replace(/\blt\b/g, "<")
			.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
		/* $a.b.c → V.a.b.c（带可选链 ?. 的原样保留） */
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\?\.)/g, 'safeGet(V,"$1")$2');
		js = js.replace(/\$([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g, 'safeGet(V,"$1")');
		/* _pills 局部变量 = sexStats.pills.pills */
		js = js.replace(/_pills/g, 'safeGet(V,"sexStats.pills.pills")');
		/* C.npc.X.y */
		js = js.replace(/\bC\.npc\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g, 'safeGet(C,"npc.$1.$2")');
		/* 函数调用（playerIsPregnant() 等全局函数）→ globalThis 兜底；排除已生成的 safeGet/globalThis */
		js = js.replace(/([A-Za-z_]\w*)\s*\(/g, function (m0, name) {
			if (name === "safeGet" || name === "globalThis") { return m0; }
			return 'globalThis["' + name + '"](';
		});
		var fn = new Function("V", "C", "safeGet", "return (" + js + ");");
		return !!fn(V, C, safeGetObj);
	} catch (e) { return false; }
}
/* 解析 has 表达式：找出所有 "$var op value" 比较段与 includes 段 */
function parseTraitHas(expr) {
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
		} catch (e) { wrote.push("(强制获得失败) " + (e && e.message ? e.message : e)); }
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
	var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
	if (String(valRaw) === "true") { setPathVal(V, path, true); return path + "=true"; }
	if (String(valRaw) === "false") { setPathVal(V, path, false); return path + "=false"; }
	if (String(valRaw) === "undefined") { return null; }
	if (isNaN(num)) { setPathVal(V, path, String(valRaw).replace(/["']/g, "")); return path + "=" + String(valRaw).replace(/["']/g, ""); }
	if (op === "lte") { setPathVal(V, path, num); return path + "=" + num; }
	if (op === "lt") { setPathVal(V, path, num - 1); return path + "=" + (num - 1); }
	setPathVal(V, path, num); return path + "=" + num;
}
function traitWriteUnsatisfy(V, path, op, valRaw) {
	var num = (String(valRaw) === "true" || String(valRaw) === "false") ? null : parseFloat(String(valRaw).replace(/["']/g, ""));
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
				values.push({ path: v.path, op: v.op, val: num });
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
				out.push({
					cat: String(cat.title || "模组特质"),
					name: (typeof t.name === "function") ? t.name() : String(t.name),
					text: (typeof t.text === "function") ? String(t.text()) : String(t.text || ""),
					hasFn: (typeof t.has === "function") ? t.has : null,
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
	wrap.appendChild(el("div", "mce-grp-t", "★ 特质管理：可直接获取/移除，有数值的可直接更改（含其他模组注入的特质，自动发现）。已按分类折叠，点击分类标题展开"));
	var vanilla = compileVanillaTraits();
	var modTraits = discoverModTraits();
	var q = (curPlayerFilter || "").toLowerCase();
	var seenV = {}, seenM = {}, groups = {};
	/* 可折叠分类组：标题可点，body 默认收起（data-collapsed=1，CSS 隐藏） */
	function bodyFor(zhCat, note) {
		if (groups[zhCat]) { return groups[zhCat]; }
		var grp = el("div", "mce-grp");
		grp.setAttribute("data-tcat", zhCat);
		var head = el("div", "mce-grp-t mce-collapse-head", "▸ " + zhCat);
		var body = el("div", "mce-grp-body");
		body.setAttribute("data-collapsed", "1");
		head.addEventListener("click", function () {
			var open = body.getAttribute("data-collapsed") !== "1";
			body.setAttribute("data-collapsed", open ? "1" : "0");
			head.textContent = (open ? "▸ " : "▾ ") + zhCat + (groups[zhCat].count > 0 ? "（" + groups[zhCat].count + "）" : "") + groups[zhCat].note;
		});
		grp.appendChild(head);
		grp.appendChild(body);
		wrap.appendChild(grp);
		var g = { head: head, body: body, count: 0, note: note || "" };
		groups[zhCat] = g;
		return g;
	}
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
		var g = bodyFor(zhCat, "");
		g.count++;
		renderTraitRow(g.body, t, V, C, false);
	});
	/* 系列行渲染（放入所属分类组；搜索时按系列名过滤） */
	seriesGroups.forEach(function (s) {
		var seriesName = traitSeriesName(s);
		if (q && seriesName.toLowerCase().indexOf(q) === -1) { return; }
		var zhCat = TRAIT_ZH_CAT[s.cat] || s.cat;
		var g = bodyFor(zhCat, "");
		g.count++;
		renderTraitSeriesRow(g.body, s, V);
	});
	/* 模组特质分类（按 title 分组，同分类同中文名去重） */
	modTraits.forEach(function (t) {
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && t.cat.toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenM[key]) { return; }
		seenM[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] ? TRAIT_ZH_CAT[t.cat] + "（模组）" : (t.cat + "（模组）");
		var g = bodyFor(zhCat, " · 模组注入（只读展示，可在模组自身页操作）");
		g.count++;
		renderTraitRow(g.body, t, V, C, true);
	});
	/* 组标题统一补数量（默认收起） */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		g.head.textContent = "▸ " + k + "（" + g.count + "）" + g.note;
	});
	pane.appendChild(wrap);
}
function renderTraitRow(grp, t, V, C, isMod) {
	var owned = traitOwned(t, V, C);
	var nameZh = traitDisplayName(t, V);
	var row = el("div", "mce-row");
	row.appendChild(el("span", "mce-row-lbl", (owned ? "● " : "○ ") + nameZh + (isMod ? "（模组）" : "")));
	/* 描述（函数/模板源码型描述不展示，避免源码泄漏） */
	var desc = isMod ? t.text : String(t.text || "");
	desc = String(desc || "");
	if (/^\s*\(?\s*\)\s*=>/.test(desc) || /^\s*function\b/.test(desc) || (desc.length > 300 && desc.indexOf("`") !== -1)) { desc = ""; }
	if (desc) {
		row.appendChild(el("span", "mce-hint", String(desc).slice(0, 90) + (String(desc).length > 90 ? "…" : "")));
	}
	if (!isMod) {
		/* 获取 / 移除 */
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
		/* 数值可改（数字比较变量）：写入走 player-self 留痕通道 + 回退 */
		t.values.forEach(function (v) {
			var cur = safeGetObj(V, v.path);
			var num = (typeof cur === "number") ? cur : 0;
			var inp = el("input", "mce-inp");
			inp.type = "number"; inp.step = "1"; inp.value = String(num);
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
	}
	grp.appendChild(row);
}
function traitWriteValue(t, V, path, raw) {
	var num = parseFloat(raw);
	if (isNaN(num)) { return { ok: false, message: "请输入数字（当前值 " + (safeGetObj(V, path) === undefined ? "?" : safeGetObj(V, path)) + "）" }; }
	var before = safeGetObj(V, path);
	var res = cheatWriteValue("player-self", "trait:" + path, "value_set", path, String(num), "number");
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
function renderPlayerEdit() {
	var pane = root.querySelector('[data-pane="mods"]');
	if (!pane) { return; }
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
	finp.addEventListener("input", function () { curPlayerFilter = finp.value; renderPlayerEdit(); });
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
	renderTraitsSection(pane, V, C);
}


	/* ============ UI：右侧常驻黑色悬浮侧边面板（CE 样式，双层标签） ============ */
	var root = null;
	var toggleBtn = null;
	var openFlag = false;
	var curName = "";
	var curInnerTab = "romance";
	var initialized = false;

	function el(tag, cls, text) {
		var node = document.createElement(tag);
		if (cls) { node.className = cls; }
		if (text !== undefined && text !== null) { node.textContent = String(text); }
		return node;
	}

	var CSS = "" +
		"#mce-root{display:none;position:fixed;top:8px;right:0;bottom:8px;width:430px;max-width:96vw;z-index:2147483000;" +
		"background:rgba(5,5,5,.96);border:1px solid #3c3c3c;border-right:none;box-shadow:0 12px 34px rgba(0,0,0,.7);" +
		"color:#f2f2f2;flex-direction:column;overflow:hidden;" +
		"font-family:'Noto Serif SC','Source Han Serif SC','Microsoft YaHei',serif;font-size:13px;line-height:1.5}" +
		"#mce-root.mce-open{display:flex}" +
		"#mce-toggle{position:fixed;right:14px;bottom:14px;z-index:2147482999;width:52px;height:52px;border-radius:50%;" +
		"background:#d4a73c;color:#111;border:2px solid #b38a2a;font-size:15px;font-weight:700;cursor:pointer;" +
		"box-shadow:0 4px 14px rgba(0,0,0,.6);font-family:inherit}" +
		"#mce-toggle:hover{background:#e0b44a}" +
		".mce-header{display:flex;align-items:center;height:42px;padding:0 10px;background:#1a1a1a;" +
		"border-bottom:1px solid #3c3c3c;color:#d4a73c;font-weight:700;font-size:15px}" +
		".mce-header .mce-title{flex:1;text-align:center}" +
		".mce-header button{background:transparent;border:none;color:#ccc;font-size:16px;cursor:pointer;padding:0 7px}" +
		".mce-header button:hover{color:#fff}" +
		".mce-tabs{display:flex;background:#0d0d0d;border-bottom:1px solid #3c3c3c}" +
		".mce-tabs button{flex:1;background:transparent;border:none;border-bottom:2px solid transparent;" +
		"color:#b9b9b9;padding:9px 0;cursor:pointer;font-size:14px;font-family:inherit}" +
		".mce-tabs button.mce-active{color:#d4a73c;border-bottom-color:#d4a73c}" +
		".mce-body{flex:1;overflow-y:auto;padding:10px;min-height:120px}" +
		".mce-pane{display:none}.mce-pane.mce-active{display:block}" +
		/* 角色卡片 */
		".mce-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
		".mce-card{background:#111;border:1px solid #333;border-radius:3px;padding:8px;cursor:pointer}" +
		".mce-card:hover{border-color:#d4a73c}" +
		".mce-card.mce-sel{border-color:#d4a73c;background:#18150c}" +
		".mce-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}" +
		".mce-card-name{color:#fff;font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
		".mce-badge{font-size:10px;padding:1px 6px;border-radius:8px;white-space:nowrap}" +
		".mce-badge.mce-on{background:#1c3a24;color:#7ed89a;border:1px solid #2e5a3c}" +
		".mce-badge.mce-off{background:#3a1c1c;color:#ff6b6b;border:1px solid #5a2e2e}" +
		".mce-card-stats{display:flex;flex-wrap:wrap;gap:2px 8px;font-size:11px;color:#9c9c9c}" +
		".mce-card-stats b{color:#d4a73c}" +
		/* 数据卡 */
		".mce-section{font-size:12px;color:#9c9c9c;border-bottom:1px dashed #333;padding:2px 0 4px;margin:10px 0 6px}" +
		".mce-statrow{display:flex;align-items:center;gap:6px;margin:5px 0;flex-wrap:wrap}" +
		".mce-label{color:#d8d8d8;min-width:56px}" +
		".mce-value{color:#d4a73c;font-weight:700;min-width:44px;text-align:right}" +
		".mce-btn{background:#222;color:#eee;border:1px solid #3c3c3c;border-radius:2px;padding:3px 9px;cursor:pointer;font-size:12px;font-family:inherit}" +
		".mce-btn:hover{background:#333}" +
		".mce-btn.mce-gold{background:#d4a73c;color:#111;border-color:#b38a2a;font-weight:700}" +
		".mce-btn.mce-gold:hover{background:#e0b44a}" +
		".mce-btn.mce-red{background:#5a2323;color:#ff9c9c;border-color:#7a3030}" +
		".mce-btn.mce-red:hover{background:#6e2b2b}" +
		".mce-btn:disabled{opacity:.45;cursor:not-allowed}" +
		".mce-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}" +
		/* 内层标签 */
		".mce-inner{display:flex;gap:4px;margin:8px 0;border-bottom:1px solid #2a2a2a;padding-bottom:6px}" +
		".mce-inner button{background:#181818;color:#aaa;border:1px solid #333;border-radius:2px;padding:3px 10px;cursor:pointer;font-size:12px;font-family:inherit}" +
		".mce-inner button.mce-active{background:#d4a73c;color:#111;border-color:#d4a73c}" +
		/* 阶段列表 */
		".mce-stages{display:flex;flex-direction:column;gap:6px}" +
		".mce-stage{border-left:3px solid #555;background:#101010;border-radius:2px;padding:7px 9px}" +
		".mce-stage.mce-pass{border-left-color:#2e9e52;background:#0d1710}" +
		".mce-stage.mce-fail{border-left-color:#c0392b;background:#170d0d}" +
		".mce-stage-head{display:flex;align-items:center;gap:8px}" +
		".mce-dot{width:9px;height:9px;border-radius:50%;flex:none}" +
		".mce-pass .mce-dot{background:#2e9e52}" +
		".mce-fail .mce-dot{background:#c0392b}" +
		".mce-stage-name{color:#eee;font-weight:700;font-size:13px;flex:1}" +
		".mce-stage-txt{color:#b9b9b9;font-size:11px;margin-top:4px;word-break:break-all;font-family:Consolas,Menlo,monospace}" +
		".mce-stage-note{color:#8a6d3b;font-size:11px;margin-top:3px}" +
		".mce-hint{color:#8a8a8a;font-size:12px;margin:4px 0}" +
		/* v1.5.2 使用提示（剧情页页首警示框） */
		".mce-warn{background:#2a2208;border:1px solid #d4a73c;color:#f0d98c;font-size:12px;margin:4px 0;padding:8px 10px;border-radius:3px;line-height:1.6}" +
		".mce-err{color:#ff6b6b;font-size:13px}" +
		".mce-ok{color:#7ed89a;font-size:13px}" +
		".mce-status{min-height:18px;padding:6px 10px;border-top:1px solid #3c3c3c;background:#0d0d0d;color:#9c9c9c;font-size:12px}" +
		".mce-type{display:inline-block;background:#1a1a1a;color:#ccc;border:1px solid #3c3c3c;border-radius:2px;padding:2px 8px;font-size:11px;margin:2px}" +
		".mce-build{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:4px 0}" +
		/* v1.4.0 Mod作弊页面 */
		".mce-grp{border:1px solid #2a2a2a;border-radius:3px;margin:8px 0;padding:8px;background:#0f0f0f}" +
		".mce-grp-t{color:#d4a73c;font-weight:700;font-size:13px;margin-bottom:6px}" +
		".mce-collapse-head{cursor:pointer;user-select:none}" +
		".mce-collapse-head:hover{color:#f0d070}" +
		".mce-grp-body[data-collapsed=\"1\"]{display:none}" +
		".mce-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0;border-top:1px solid #1f1f1f;font-size:12px}" +
		".mce-row-lbl{color:#e6e6e6;flex:1;min-width:120px;word-break:break-all}" +
		".mce-row button{background:#181818;color:#ccc;border:1px solid #3a3a3a;border-radius:2px;padding:3px 8px;cursor:pointer;font-size:12px;font-family:inherit}" +
		".mce-row button:hover{border-color:#d4a73c;color:#d4a73c}" +
		".mce-inp{background:#0d0d0d;color:#eee;border:1px solid #3a3a3a;border-radius:2px;padding:3px 6px;font-size:12px;width:90px;font-family:Consolas,Menlo,monospace}" +
		".mce-sel{background:#0d0d0d;color:#eee;border:1px solid #3a3a3a;border-radius:2px;padding:3px 4px;font-size:12px;font-family:inherit}" +
		/* v1.8.7 能力项说明折叠（学 CE 逐项数值文档） */
		".mce-ab-detail{margin-left:4px;font-size:11px}" +
		".mce-ab-sum{cursor:pointer;color:#8a8a8a;user-select:none;display:inline-block}" +
		".mce-ab-sum:hover{color:#f0d070}" +
		".mce-ab-body{background:#141414;border:1px solid #2a2a2a;border-radius:2px;padding:5px 8px;margin-top:3px;color:#b9b9b9;line-height:1.7;min-width:220px}" +
		".mce-ab-note{color:#8a6d3b;margin-top:2px}";

	function injectCSS() {
		if (document.getElementById("mce-style")) { return; }
		var style = el("style", "");
		style.id = "mce-style";
		style.textContent = CSS;
		(document.head || document.documentElement).appendChild(style);
	}

	function setStatus(text, cls) {
		var st = root && root.querySelector(".mce-status");
		if (!st) { return; }
		st.textContent = text;
		st.className = "mce-status" + (cls ? " " + cls : "");
	}

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
		if (name === "char") { renderCards(); }
		if (name === "stage") { renderStagePane(); }
		if (name === "scenes") { renderScenes(); }
		if (name === "places") { renderPlaces(); }
		if (name === "global") { renderGlobal(); }
		if (name === "mods") { renderModCheats(); }
	}

	/* ---- 角色一览卡片 ---- */
	function renderCards() {
		var pane = root.querySelector('[data-pane="char"]');
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架（window.maplebirch / setup.MapleBirch）。"));
			return;
		}
		var chars = listCharacters();
		if (!chars.length) {
			pane.appendChild(el("div", "mce-hint", "注册池为空：未枚举到任何角色。"));
			return;
		}
		var grid = el("div", "mce-cards");
		chars.forEach(function (name) {
			var npc = findNpc(name);
			var st = getNpcState(name);
			var active = st.state !== "dismissed";
			var card = el("div", "mce-card" + (name === curName ? " mce-sel" : ""));
			var top = el("div", "mce-card-top");
			top.appendChild(el("span", "mce-card-name", displayName(name)));
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
				switchOuterTab("stage");
			});
			grid.appendChild(card);
		});
		pane.appendChild(grid);
		pane.appendChild(el("div", "mce-hint", "共 " + chars.length + " 个角色（自动枚举：本体 + 全部 MOD），点击卡片查看阶段。"));
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
		var npc = findNpc(curName);
		var st = getNpcState(curName);
		var active = st.state !== "dismissed";

		/* 角色数据卡 */
		var card = el("div", "mce-data-card");
		var top = el("div", "mce-section", "角色：");
		card.appendChild(top);
		var head = el("div", "mce-stage-head");
		head.appendChild(el("span", "mce-stage-name", displayName(curName)));
		var badge = el("span", "mce-badge " + (active ? "mce-on" : "mce-off"), active ? "活跃" : "停用");
		badge.title = "state: " + st.state;
		head.appendChild(badge);
		card.appendChild(head);
		if (st.found) { card.appendChild(el("div", "mce-hint", "游戏状态 state = " + stateCN(st.state))); }
		if (!npc) { card.appendChild(el("div", "mce-hint", "未在 V.NPCName 中找到该角色的运行时对象（仅注册池存在）。")); }

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
			setStatus("已补齐「" + displayName(curName) + "」" + n + " 项数值", "mce-ok");
		});
		var romBtn = el("button", "mce-btn mce-gold", "一键解锁全部恋爱阶段");
		romBtn.type = "button";
		romBtn.addEventListener("click", function () {
			var r = unlockAllRomance(curName);
			renderStagePane();
			setStatus("「" + displayName(curName) + "」恋爱阶段：新解锁 " + r.fixed + " / " + r.total, r.fixed > 0 ? "mce-ok" : "mce-err");
		});
		var tfBtn = el("button", "mce-btn mce-gold", "一键解锁全部转化阶段");
		tfBtn.type = "button";
		tfBtn.addEventListener("click", function () {
			var n = unlockAllTransform(curName);
			renderStagePane();
			setStatus("「" + displayName(curName) + "」转化阶段解锁 " + n + " 个类型", "mce-ok");
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
		bRom.addEventListener("click", function () { curInnerTab = "romance"; renderStagePane(); });
		var bTf = el("button", curInnerTab === "transform" ? "mce-active" : "", "转化阶段");
		bTf.type = "button";
		bTf.addEventListener("click", function () { curInnerTab = "transform"; renderStagePane(); });
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
		"farm_stage": "亚历克斯·农场阶段",
		"alex_countdown": "亚历克斯·事件倒计时",
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
		}, main: "Elk Compound", note: "麋鹿街大院（中央区/地下/怨灵线/附身线等 70+ 子场景）" }
	];
	var PLACE_CN = {
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
		"shower": "淋浴", "cry": "哭泣", "talk": "交谈", "hot chocolate": "热巧克力", "volleyball": "排球"
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
			ep.play.call(ep.e, name, true);
			setStatus("已传送至「" + name + "」", "mce-ok");
			var gidT = placeIdForPassage(name, name);
			if (gidT) { applyWorldUnlock(gidT); setStatus("已传送至「" + name + "」并已解锁世界入口", "mce-ok"); }
		} catch (e) { setStatus("传送失败：" + (e && e.message ? e.message : e), "mce-err"); }
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
	function renderPlaces() {
		var pane = root.querySelector('[data-pane="places"]');
		pane.textContent = "";
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
		if (parsed) { return { defs: parsed, live: true }; }
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

	/* ============ 固定触发（v1.1）：把某个剧情钉住，下次推进剧情（遇见角色）自动重放
	     复用原版 $replayScene 重放通道（Scene viewer redirect）：startPassage/passages
	     内段落正常播放，离开场景自动回 Scene Viewer End 并返回原位；「回退」即取消。
	     存储于 V.mbCE_pinned（存档持久）；重放期间原版自动禁存 + 冻结属性，零副作用。 ============ */
	/* 固定触发队列（v1.2）：V.mbCE_queue 数组按固定顺序存储；每次段落跳转触发
	     队首未 used 项 → 启动原版 $replayScene 重放 → 立即标记 used（一次性，触发
	     后不再重复）；重放结束（跳向 Scene Viewer End）时移除已 used 项，并把该
	     剧情所在场景组记录进 V.mbCE_unlockedPlaces（场景联动解锁）。
	     兼容迁移：v1.1 旧单固定 mbCE_pinned 自动并入队列（视为已触发过）。 */
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
	function ensureFarmState() {
		try {
			var V = getV();
			if (!V) { return; }
			var fs = Number(V.farm_stage);
			if (!(fs >= 1)) { return; } /* 农场线未推进 → 本体社交页有 $farm_stage gte 2 条件，不读 $farm */
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
			if (!def) { return { ok: false, message: "无场景定义，无法固定触发" }; }
			var start = def.startPassage || (Array.isArray(def.passages) && def.passages[0]) || "";
			if (!start) { return { ok: false, message: "该剧情缺少入口段落（startPassage 为空），无法固定触发" }; }
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法固定触发" }; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === it.key && q[i].active !== false && !q[i].used) {
					return { ok: false, message: "该剧情已在固定队列中（第 " + (i + 1) + " 位，按顺序触发）" };
				}
			}
			/* 防崩：农场依赖剧情需 $farm 已初始化（本体 farm_work_update 内 V.farm.clearing -= 1，未初始化直接崩） */
			if (isFarmDependentScene({ startPassage: start, manualVariableChanges: def.manualVariableChanges || "" }) && !farmStateReady()) {
				return { ok: false, message: "「" + (def.name || it.key) + "」依赖农场系统状态（$farm 未初始化）：直接播放会触发本体 farm_work_update 崩溃。请先推进游戏到亚历克斯农场线后再固定" };
			}
			q.push({
				key: it.key,
				name: def.name || it.key,
				startPassage: start,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || "",
				used: false
			});
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			return { ok: true, message: "已固定「" + (def.name || it.key) + "」（队列第 " + pending + " 位）：下次推进剧情即触发，触发一次后自动停止" };
		} catch (e) {
			return { ok: false, message: "固定失败：" + (e && e.message ? e.message : e) };
		}
	}
	/* 固定整条剧情线（v1.3）：把线内全部阶段按顺序加入固定队列，依次触发，触发完自动停止 */
	function pinSceneLine(line) {
		try {
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法固定触发" }; }
			if (!line || !Array.isArray(line.items) || !line.items.length) { return { ok: false, message: "无阶段可固定" }; }
			var added = 0, skipped = 0;
			for (var i = 0; i < line.items.length; i++) {
				var it = line.items[i];
				if (!it || !it.def) { continue; }
				var start = it.def.startPassage || (Array.isArray(it.def.passages) && it.def.passages[0]) || "";
				if (!start) { skipped++; continue; }
				if (isFarmDependentScene({ startPassage: start, manualVariableChanges: it.def.manualVariableChanges || "" }) && !farmStateReady()) { skipped++; continue; }
				var dup = false;
				for (var j = 0; j < q.length; j++) {
					if (q[j] && q[j].key === it.key && q[j].active !== false && !q[j].used) { dup = true; break; }
				}
				if (dup) { skipped++; continue; }
				q.push({
					key: it.key,
					name: it.def.name || it.key,
					startPassage: start,
					passages: Array.isArray(it.def.passages) ? it.def.passages.slice() : [],
					manualVariableChanges: it.def.manualVariableChanges || "",
					used: false
				});
				added++;
			}
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			var nm = (line.items[0].def && line.items[0].def.name) || line.prefix || "";
			if (added > 0) {
				return { ok: true, message: "已固定整线「" + nm + "」系列（" + added + " 个阶段，队列第 " + pending + " 位起，按顺序依次触发，触发完自动停止）" + (skipped ? "；跳过 " + skipped + " 个（已在队列或农场线未开启）" : "") };
			}
			return { ok: false, message: "没有可固定的阶段" + (skipped ? "（" + skipped + " 个被跳过：已在队列或依赖农场线未开启）" : "") };
		} catch (e) { return { ok: false, message: "固定失败：" + (e && e.message ? e.message : e) }; }
	}
	/* 回退：取消指定剧情（key 省略=清空队列）的固定；若正在重放固定场景，立即解冻并返回原位 */
	function unpinScene(key) {
		var V = getV();
		var back = "";
		var changed = false;
		try {
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
				back = V.replayScene.exitpassage || currentPassageName();
				try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
				/* v1.4.5 防被困播放器（顺序不可反）：
				   1) 先清 sceneViewSwitch 为无效值 → Scene Viewer passages 的 switch 走 default；
				   2) 再跳转——原版 default 退出分支的 Back 链接依赖 $replayScene.exitpassage，
				      若先删 replayScene 再跳（且目标恰为 Scene Viewer passages）→ Back 无源 →
				      退出按钮消失 → 被困场景播放器；
				   3) 跳转完成（同步渲染）后再清理 replayScene / 重放标记。
				   back 为空时：不跳转也不删 replayScene——保留 default 的 Back 链接，玩家可手动点 Back 退出。 */
				V.sceneViewSwitch = "MB_CE_END";
				if (back) {
					var ep = getEnginePlayFn();
					if (ep) { try { ep.play.call(ep.e, back, true); } catch (e) {} }
					/* 跳转成功（拿到有效 back）后才清理 replayScene/标记；back 为空时保留
					   replayScene —— 播放器 default 分支的 Back 链接仍可用，玩家可手动退出 */
					try { delete V.replayScene; } catch (e) { V.replayScene = undefined; }
					try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
				}
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
	/* 幂等写入世界入口条件：已有更高/相同值不覆盖，只补缺失或更低值（v1.7.0 支持子路径 path 型，如 compound.allowed） */
	function applyWorldUnlock(gid) {
		try {
			var V = getV();
			if (!V || !gid || !WORLD_UNLOCKS[gid]) { return; }
			var w = WORLD_UNLOCKS[gid];
			if (w.path !== undefined) {
				var segs = String(w.path).split(".");
				var cur = V, i;
				for (i = 0; i < segs.length - 1; i++) {
					if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") {
						/* 父级缺失则逐层补空对象壳（防 undefined 写入） */
						cur[segs[i]] = {};
					}
					cur = cur[segs[i]];
				}
				if (cur[segs[segs.length - 1]] !== w.set) { cur[segs[segs.length - 1]] = w.set; }
				/* 顺带补 discovered（Elk Street 逻辑：discovered 才显示大院入口判定） */
				if (gid === "elk_compound" && V.compound && V.compound.discovered !== true) { V.compound.discovered = true; }
				return;
			}
			if (w.var === undefined) { return; }
			if (typeof w.set === "number") {
				var cur2 = typeof V[w.var] === "number" ? V[w.var] : 0;
				if (cur2 < w.set) { V[w.var] = w.set; }
			} else if (V[w.var] === undefined || V[w.var] === null || V[w.var] === "") {
				V[w.var] = w.set;
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
	/* v1.4.8：清理队列中已触发（used）的固定项并联动解锁（三个重放终点共用） */
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
					}
				}
				for (var i3 = qc.length - 1; i3 >= 0; i3--) {
					if (qc[i3] && qc[i3].used) { qc.splice(i3, 1); }
				}
			}
		} catch (e) {}
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
				try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
				try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
				if (wasMod) {
					try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
					if (backTo && passageArgs) { passageArgs.name = backTo; }
				}
				return;
			}
			if (V.replayScene) {
				/* 原版手动重放（非 MOD 固定触发）→ 交给原版处理，不干预 */
				if (!V.mbCE_replayOnce) { return; }
				/* v1.4.8：MOD 固定触发的 case 场景播放完链回 Scene Viewer passages（非首次进入）→
				   自动返回原位并解除固定（跳过原版 default 的 "Error occurred" + 手动 Back 步） */
				if (dest === "Scene Viewer passages" && !V.mbCE_replayPending) {
					cleanupUsedPins();
					var backS = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
					try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
					try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
					try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
					if (backS && passageArgs) { passageArgs.name = backS; }
					return;
				}
				/* v1.4.5：原版重放经 Back 正常返回原位（exitpassage）→ 清理残留（replayScene/标记/已用队列项），
				   避免残留导致后续取消固定误判"正在重放"、以及再次重放时被残留干扰 */
				if (dest === (V.replayScene.exitpassage || "")) {
					try {
						var qe = V.mbCE_queue;
						if (Array.isArray(qe)) {
							for (var ie = qe.length - 1; ie >= 0; ie--) {
								if (qe[ie] && qe[ie].used) {
									unlockPlaceForScene(qe[ie]);
									applyWorldUnlockForScene(qe[ie]);
									qe.splice(ie, 1);
								}
							}
						}
					} catch (e) {}
					try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
					try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
					try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
					return;
				}
				/* MOD 固定触发的重放：仅已知确定性逃逸终点到达时清理残留（农场剧情结束直接去 Farm Work 而非回 Scene Viewer），
				   否则一律视为仍在重放（含剧情中间段落不在注册表列表的情况）→ 不干预、不触发 */
				if (dest === "Farm Work") {
					/* 农场剧情确定性终点：结束即清理残留（unfreeze + 清标记），并移除已触发项（同 Scene Viewer End） */
					try {
						var qf = V.mbCE_queue;
						if (Array.isArray(qf)) {
							for (var if2 = qf.length - 1; if2 >= 0; if2--) {
								if (qf[if2] && qf[if2].used) {
									unlockPlaceForScene(qf[if2]);
									applyWorldUnlockForScene(qf[if2]);
									qf.splice(if2, 1);
								}
							}
						}
					} catch (e) {}
					try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
					try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
					try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
				} else {
					return; /* 仍在重放链内 → 不触发 */
				}
			}
			var q = getPinQueue();
			if (!q) { return; }
			var P = null;
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].active !== false && !q[i].used && q[i].startPassage) { P = q[i]; break; }
			}
			if (!P) { return; }
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
			/* SugarCube 自定义事件系统（jQLite）：与 DoL 本体 $(document).one(':passageend',…) 一致 */
			$(document).on(":passageoverride", function (ev, passageArgs) {
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
			$(document).on(":passageinit", function (ev, passage) {
				try {
					var t = (passage && passage.title) ? passage.title : "";
					mbCEOnPassageInit(t);
				} catch (e) {}
			});
		} catch (e) {}
	}

	function renderRomanceStages(pane) {
		/* v1.4.5：非恋爱候选角色不显示恋爱阶段（角色本身保留在角色一览）——
		   只有能进恋人卡槽的角色才展示恋爱阶段与"恋人卡槽"条件 */
		if (!isLoveCandidate(curName)) {
			pane.appendChild(el("div", "mce-hint", "「" + displayName(curName) + "」不是可确立恋人关系的角色，无可解锁的恋爱阶段。"));
			return;
		}
		var stages = getRomanceStages(curName);
		if (stages.length) {
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
			pane.appendChild(box);
		} else {
			pane.appendChild(el("div", "mce-hint", "该角色未注册框架恋爱剧情条件（romanceConditions 为空）。"));
		}

		/* 原版恋爱阶段（格威岚 7 阶段，来自游戏原版 gwylanStatusCheck 体系） */
		var vanilla = getVanillaStages(curName);
		if (vanilla.length) {
			pane.appendChild(el("div", "mce-section", "原版恋爱阶段（" + displayName(curName) + "）"));
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
						setStatus(r.ok ? "「" + displayName(curName) + "」" + s.label + " 已达成" : r.message, r.ok ? "mce-ok" : "mce-err");
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
			pane.appendChild(vbox);
		}
	}

	function renderTransformStages(pane) {
		var types = listStageTypes(curName);
		var exts = listExtTransforms();
		if (!types.size && !exts.length) {
			pane.appendChild(el("div", "mce-hint", "该角色未注册转化阶段。"));
			return;
		}
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
			pane.appendChild(block);
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
			pane.appendChild(block);
		});
	}

	/* ---- 特殊剧情页（$scenes 场景注册表动态枚举） ---- */
	function renderScenes() {
		var pane = root.querySelector('[data-pane="scenes"]');
		pane.textContent = "";
		/* 使用提示（v1.5.2）：固定触发注意事项，页首常驻 */
		pane.appendChild(el("div", "mce-warn", "使用提示：当你使用固定触发后，会一直循环。当出现退出场景时，回到此页面取消队列。之后你会被困在场景播放器中，请使用场景直达退出去。"));
		/* 固定触发状态横幅（v1.2：队列，显示全部未触发项） */
		var pinnedBanner = getPinnedScene();
		if (pinnedBanner && pinnedBanner.length) {
			var banner = el("div", "mce-stage mce-pass");
			var bh = el("div", "mce-stage-head");
			bh.appendChild(el("span", "mce-dot", ""));
			var names = pinnedBanner.map(function (p) { return "「" + p.name + "」"; }).join("、");
			bh.appendChild(el("span", "mce-stage-name", "固定触发队列（" + pinnedBanner.length + "）：" + names + " —— 按顺序触发，触发一次后自动停止"));
			var unBtn = el("button", "mce-btn mce-red", "清空队列（取消全部固定）");
			unBtn.type = "button";
			unBtn.title = "取消全部固定触发，恢复原版随机触发；若正在重放则立即解冻并返回原位";
			unBtn.addEventListener("click", function () {
				var was = unpinScene();
				setStatus(was ? "已回退：清空固定触发队列，恢复原版随机触发" : "未处于固定触发状态", "mce-ok");
				renderScenes();
			});
			bh.appendChild(unBtn);
			banner.appendChild(bh);
			pane.appendChild(banner);
		}
		var r = getScenesDefs();
		if (!Object.keys(r.defs).length) {
			pane.appendChild(el("div", "mce-err", "未读取到场景注册表（$scenes）。"));
			pane.appendChild(el("div", "mce-hint", "说明：本页读取游戏「场景查看器（Scene Viewer）」的注册表。请先在游戏菜单打开一次「场景」页面后返回；MOD 通过场景系统注册的剧情（如启示录 MOD 的罗宾神殿剧情）会随注册表自动出现。"));
			return;
		}
		pane.appendChild(el("div", "mce-hint", "已读取场景注册表 " + Object.keys(r.defs).length + " 条" + (r.live ? "（实时求值解锁条件，含 MOD 场景）" : "（读取存档缓存值）") + "。绿色=已达成，红色=未达成，黄色=锁定/互斥提示。"));
		var cluster = listSceneLines(r.defs);
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
			/* 固定整线：全部阶段按顺序入队，依次触发，触发完自动停止 */
			var linePin = el("button", "mce-btn", "固定整线");
			linePin.type = "button";
			linePin.title = "把本系列全部阶段按顺序加入固定触发队列，依次触发，触发完自动停止";
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
			tog.title = "展开查看本线各阶段，可对单阶段固定/回退/一键完成";
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
				var srow = el("div", "mce-stage " + (st.state === "pass" ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
				var sh = el("div", "mce-stage-head");
				sh.appendChild(el("span", "mce-dot", ""));
				var nm = it.def.name || it.key;
				sh.appendChild(el("span", "mce-stage-name", "阶段 " + it.num + "　" + nm));
				/* 固定触发 / 回退（v1.2：队列） */
				var pi = pinQueueIndex(it.key);
				if (pi >= 0) {
					sh.appendChild(el("span", "mce-badge mce-on", "已固定 第" + (pi + 1) + "位"));
					var unpinB = el("button", "mce-btn mce-red", "回退");
					unpinB.type = "button";
					unpinB.title = "取消该剧情的固定触发，恢复原版随机触发";
					(function (it2) {
						unpinB.addEventListener("click", function () {
							var was = unpinScene(it2.key);
							setStatus(was ? "已回退：「" + (it2.def.name || it2.key) + "」取消固定触发" : "该剧情不在固定队列中", "mce-ok");
							renderScenes();
						});
					})(it);
					sh.appendChild(unpinB);
				} else {
					var pinB = el("button", "mce-btn", "固定触发");
					pinB.type = "button";
					pinB.title = "固定此剧情：按顺序排队触发，触发一次后自动停止；顶部横幅或「回退」恢复原版触发";
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
				srow.appendChild(sh);
				var note = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
				srow.appendChild(el("div", "mce-stage-txt", note + (st.note || "（无说明）")));
				srow.appendChild(el("div", "mce-stage-note", "段落数 " + (it.def.passages || []).length + (it.def.startPassage ? "　入口 " + it.def.startPassage : "") + "　键 " + it.key));
				stages.appendChild(srow);
			});
			block.appendChild(stages);
			pane.appendChild(block);
		});
		if (singleTotal) {
			var sblock = el("div", "mce-stage");
			sblock.appendChild(el("div", "mce-stage-head", el("span", "mce-stage-name", "独立场景（未聚合成线）")));
			var sstages = el("div", "mce-stages");
			cluster.singles.forEach(function (it) {
				var st = sceneStatus(it.def);
				var srow = el("div", "mce-stage " + (st.state === "pass" ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
				var sh = el("div", "mce-stage-head");
				sh.appendChild(el("span", "mce-dot", ""));
				sh.appendChild(el("span", "mce-stage-name", it.def.name || it.key));
				/* 固定触发 / 回退（v1.2：队列） */
				var piS = pinQueueIndex(it.key);
				if (piS >= 0) {
					sh.appendChild(el("span", "mce-badge mce-on", "已固定 第" + (piS + 1) + "位"));
					var unpinS = el("button", "mce-btn mce-red", "回退");
					unpinS.type = "button";
					unpinS.title = "取消该剧情的固定触发，恢复原版随机触发";
					(function (it2) {
						unpinS.addEventListener("click", function () {
							var was = unpinScene(it2.key);
							setStatus(was ? "已回退：「" + (it2.def.name || it2.key) + "」取消固定触发" : "该剧情不在固定队列中", "mce-ok");
							renderScenes();
						});
					})(it);
					sh.appendChild(unpinS);
				} else {
					var pinS = el("button", "mce-btn", "固定触发");
					pinS.type = "button";
					pinS.title = "固定此剧情：按顺序排队触发，触发一次后自动停止；顶部横幅或「回退」恢复原版触发";
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
				srow.appendChild(sh);
				var note2 = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
				srow.appendChild(el("div", "mce-stage-txt", note2 + (st.note || "（无说明）")));
				sstages.appendChild(srow);
			});
			sblock.appendChild(sstages);
			pane.appendChild(sblock);
		}
		if (!cluster.lines.length && !cluster.singles.length) {
			pane.appendChild(el("div", "mce-hint", "注册表为空（场景查看器未初始化或未注册任何场景）。"));
		} else {
			pane.appendChild(el("div", "mce-hint", "剧情线 " + lineTotal + " 条（已达成 " + lineDone + "/" + lineTotal + " 条线末段），独立场景 " + singleTotal + " 个。"));
		}
	}

	/* ---- 全局页 ---- */
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
			owned: function () { return getV().avery_fate === "saved"; },
			grant: function () { getV().avery_fate = "saved"; return { ok: true, message: "已满足「艾弗里的救星」条件（avery_fate = saved）" }; } }
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
	// 获取指定 NPC 特质：条件不满足时直接把条件变量改为满足
	function grantNpcTrait(key) {
		var t = null, i;
		for (i = 0; i < NPC_TRAITS.length; i++) { if (NPC_TRAITS[i].key === key) { t = NPC_TRAITS[i]; break; } }
		if (!t) { return { ok: false, message: "未知特质 " + key }; }
		return t.grant();
	}

	function renderGlobal() {
		var pane = root.querySelector('[data-pane="global"]');
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架。"));
			return;
		}
		var chars = listCharacters();
		pane.appendChild(el("div", "mce-hint", "自动枚举角色 " + chars.length + " 个（本体 + 全部 MOD）。以下操作对全部角色生效。"));
		var actions = el("div", "mce-actions");
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
		actions.appendChild(b1);
		actions.appendChild(b2);
		actions.appendChild(b3);
		actions.appendChild(b4);
		pane.appendChild(actions);
		/* v1.5.0：誓言修复 + NPC 特质获取（游戏「特质」页对应分组） */
		var vsec = el("div", "mce-section", "誓言修复 · NPC 特质（对应游戏「特质」页）");
		pane.appendChild(vsec);
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
		pane.appendChild(vrow);
		var traits = listNpcTraits();
		pane.appendChild(el("div", "mce-hint", "NPC 特质 " + traits.length + " 项：获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。"));
		var tbox = el("div", "");
		traits.forEach(function (t) {
			var row = el("div", "mce-row");
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
		pane.appendChild(tbox);
	}

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
		var prev = curName ? curName.toLowerCase() : "";
		var keep = false;
		chars.forEach(function (n) { if (n.toLowerCase() === prev) { keep = true; } });
		if (!keep) { curName = chars[0]; }
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
			places: renderPlaces, global: renderGlobal, mods: renderModCheats
		};
		var doRender = paneRenders[activeTab];
		if (doRender) { doRender(); }
		setStatus("就绪：" + chars.length + " 个角色", "mce-ok");
	}

	function open() {
		openFlag = true;
		if (root) { root.classList.add("mce-open"); }
		render();
	}
	function close() {
		openFlag = false;
		if (root) { root.classList.remove("mce-open"); }
	}
	function toggle() {
		if (openFlag) { close(); } else { open(); }
	}

	function ensureDom() {
		if (root && document.body && document.body.contains(root)) { return; }
		injectCSS();

		toggleBtn = el("button", "", "解锁");
		toggleBtn.id = "mce-toggle";
		toggleBtn.type = "button";
		toggleBtn.title = "Maplebirch CE 剧情条件解锁面板";
		toggleBtn.addEventListener("click", toggle);
		document.body.appendChild(toggleBtn);

		root = el("div", "mce-root");
		root.id = "mce-root";

		var header = el("div", "mce-header");
		header.appendChild(el("span", "mce-title", "剧情条件解锁面板 v" + MCE_VERSION));
		var minBtn = el("button", "mce-min", "收起");
		minBtn.type = "button";
		minBtn.title = "收起";
		var closeBtn = el("button", "mce-close", "关闭");
		closeBtn.type = "button";
		closeBtn.title = "关闭";
		header.appendChild(minBtn);
		header.appendChild(closeBtn);

		var tabs = el("div", "mce-tabs");
		var names = [["char", "角色"], ["stage", "阶段"], ["scenes", "剧情"], ["places", "场景"], ["global", "全局"], ["mods", "Mod作弊"]];
		names.forEach(function (pair) {
			var b = el("button", pair[0] === "char" ? "mce-active" : "", pair[1]);
			b.type = "button";
			b.setAttribute("data-tab", pair[0]);
			tabs.appendChild(b);
		});

		var body = el("div", "mce-body");
		var panes = [["char", "mce-pane mce-active"], ["stage", "mce-pane"], ["scenes", "mce-pane"],
			["places", "mce-pane"], ["global", "mce-pane"], ["mods", "mce-pane"]];
		panes.forEach(function (pair) {
			var p = el("div", pair[1]);
			p.setAttribute("data-pane", pair[0]);
			body.appendChild(p);
		});

		var status = el("div", "mce-status", "就绪");

		root.appendChild(header);
		root.appendChild(tabs);
		root.appendChild(body);
		root.appendChild(status);
		document.body.appendChild(root);

		minBtn.addEventListener("click", function () {
			openFlag = false;
			root.classList.remove("mce-open");
		});
		closeBtn.addEventListener("click", close);
		tabs.addEventListener("click", function (e) {
			var b = e.target && e.target.closest ? e.target.closest("button[data-tab]") : null;
			if (!b) { return; }
			switchOuterTab(b.getAttribute("data-tab"));
		});
	}

	function hookRefresh() {
		var mb = resolveMB();
		if (mb && typeof mb.on === "function") {
			try {
				mb.on(":passagedisplay", function () {
					if (openFlag && root && document.body.contains(root)) { render(); }
				}, "mbStageCE:refresh");
			} catch (e) {}
		}
	}

	function init() {
		if (initialized) { return; }
		initialized = true;
		if (typeof document === "undefined") { return; }
		mountApi();
		hookPassageOverride();
		hookPassageInit();
		ensureFarmState(); /* 启动兜底：存档 farm_stage 已推进但 $farm 缺失 → 补空壳，社交页不再崩 */
		ensureAveryMansion(); /* 启动兜底：$avery_mansion / $avery_tower / daily.avery.talk 缺失或残缺 → 补空壳（Mansion 段落防崩） */
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
				getRomanceStages: getRomanceStages,
				completeRomanceStage: completeRomanceStage,
				unlockAllRomance: unlockAllRomance,
				displayName: displayName,
				getVanillaStages: getVanillaStages,
				completeVanillaStage: completeVanillaStage,
				unlockVanillaAll: unlockVanillaAll,
				describeCondition: describeCondition,
				listStageTypes: listStageTypes,
				readTransformState: readTransformState,
				adjustTransform: adjustTransform,
				completeTransformStage: completeTransformStage,
				unlockAllTransform: unlockAllTransform,
				listExtTransforms: listExtTransforms,
				completeExtTransform: completeExtTransform,
				getScenesDefs: getScenesDefs,
				sceneStatus: sceneStatus,
				completeScene: completeScene,
				listSceneLines: listSceneLines,
				listPlaceGroups: listPlaceGroups,
				placeNameCN: placeNameCN,
				teleportTo: teleportTo,
				listAllPassages: listAllPassages,
				getPinnedScene: getPinnedScene,
				pinQueueIndex: pinQueueIndex,
				pinScene: pinScene,
				pinSceneLine: pinSceneLine,
				unpinScene: unpinScene,
				applyWorldUnlock: applyWorldUnlock,
				applyWorldUnlockForScene: applyWorldUnlockForScene,
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
				mbCEOnPassageInit: mbCEOnPassageInit,
				undoRomanceStage: undoRomanceStage,
				undoVanillaStage: undoVanillaStage,
				onPassageOverride: onPassageOverride,
				fillStats: fillStats,
				globalFill: globalFill,
				globalRomance: globalRomance,
				globalTransform: globalTransform,
				/* v1.4.5 角色一览恋爱候选过滤 */
				isLoveCandidate: isLoveCandidate,
				addLoveInterest: addLoveInterest,
				/* v1.5.0 誓言修复 + NPC 特质获取 */
				getVowStatus: getVowStatus,
				fixVows: fixVows,
				listNpcTraits: listNpcTraits,
				grantNpcTrait: grantNpcTrait,
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
				VANILLA_TRAITS_RAW: VANILLA_TRAITS_RAW,
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
				ensureProfShell: ensureProfShell
			};
		} catch (e) {}
	}
	mountApi();

	init();
})();

