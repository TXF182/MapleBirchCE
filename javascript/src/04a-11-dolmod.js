/* 适配器：人物附加与生活质量提升（DolMod-/MyFirstMod v0.1.880，doctor55555-55555/DolMod-）
   功能（boot.json TweeReplacer 注入 61 条规则 + script 源码实证）：原创恋爱 NPC 阿电（注册进本体
   恋爱 NPC 区，好感/信任/嫉妒/性欲四属性 + 告白/约会/周六打工/嫉妒暗线四阶段）＋生活质量系统：
   电脑（部件商店/组装/性能分/应用商店/接零活/网课学习，computer.js）、银行（活期+理财+定期，
   bank.js）、兔子/人鱼转化（transformation.js，阈值 30/60/90 三阶段）、海上平台、异国小吃摊、
   贩卖机、钓鱼、阁楼广播、NG+（ngplus.js）。
   ★模组自带作弊菜单（boot.json 规则 20：本体 Cheats passage 注入阿电控件走 setup.cheatAdian；
   规则 36：作弊器 Other 页签后注入 MyFirstMod 专属页）——CE 适配器与官方页同写同一键，无冲突。
   官方中文名核对：README 标题「MyFirstMod · 人物附加与生活质量提升」+ zip 文件名「人物附加与
   生活质量提升_v0.1.801.zip」+ boot.json name「人物附加与生活质量提升」三处一致 → 显示名用官方中文。
   键集：阿电状态 8（abilities 6 + values 2）+ 电脑 12（满配组合 1 + 全应用 1 + 学习 10）+
   银行 1 + 转化 4 + 杂项 4（ability）+ NG+ 1 = 30 键。 */
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
		modName: "人物附加与生活质量提升（DolMod-/MyFirstMod v0.1.880）",
		tasks: [],
		stages: [
			/* 阿电表白状态机：四态字符串（adian-confession.twee:14 实证：未触发(空)/rejected 拒绝/friend 朋友/lovers 恋人；
			   分手 passage 置 friend + romance=0 + 清 loveInterest 槽 + rage+20（adian-romance.twee:59-75）——CE 只写状态键，
			   完整分手联动由模组 passage 负责；恋人态建议配「恋爱中」能力一起写） */
			{ key: "dm_conf_state", name: "阿电 · 表白状态", varPath: "adian_confession_state",
			  levels: ["", "rejected", "friend", "lovers"] }
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
			  note: "二周目轮次计数（ngplus.js:28 实证，供 twee 读取；NG+ 触发生成 ngplusCarried 继承快照）；写 0=普通档" }
		]
		}
	};
