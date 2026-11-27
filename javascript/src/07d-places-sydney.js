/* 职责：场景直达续段（v2.1.10 自 07d-places.js 迁出悉尼三组 + 西里斯组 + 拆出三组子入口白名单；
   结构门禁 S1 拆段：07d-places.js / 07d-places4.js 均逼近单段上限 400 行）
   四组用 unshift 插到 PLACE_GROUPS 最前，只为一件事：sydney_defile / sydney_canteen 必须排在 sydney_temple 之前
   —— listPlaceGroups 靠 seen 先占先得，否则 sydney_temple 的 "Sydney Temple" 前缀会把 Corrupt 全系列 42 段一起
   吃进去，玩家只能在大列表里翻。四组匹配前缀互不重叠（Sydney Temple Corrupt / Sydney Canteen /
   Temple Sydney·Sydney Temple / sirris），提前判定不改变任何其他组的归属。
   艾弗里庄园（"Mansion "）与格威岚花园（gwylan / Forest Shop）有与 kylar_manor / forest_shop 的先占先得依赖，
   仍留在 07d-places.js 原位 —— 挪到最前会抢走 forest_shop 的段落，tests/forest_shop_direct.js 直接 FAIL（v2.1.10 实证）。 */
	(function () {
		var groups = [
			{ id: "sydney_defile", name: "悉尼 · 亵渎仪式（神殿夜行）", match: function (n) { return n.indexOf("Sydney Temple Corrupt") === 0; }, exclude: mbCEIsUnplayableEntry, main: "Sydney Temple Corrupt", note: "亵渎仪式 42 段：夜里潜入神殿 → 搜柜找铜钥匙 → 撬锁/破门 → 取贞操带 → 祈祷室 → Sirris 接人。前置：悉尼 corrupt、贞操带 origin=temple、rank ≥ initiate、21 点后，不满足给提示；战斗段已排除。" },
			{ id: "sydney_canteen", name: "悉尼 · 食堂线（身上写字）", match: function (n) { return n.indexOf("Sydney Canteen") === 0; }, exclude: mbCEIsUnplayableEntry, main: "Sydney Canteen Bodywriting Allow", note: "食堂线 7 段：悉尼在手臂/肩背写固定短语（Sinner / Purest Love / Lusty Sinners 等）。含写字（主）/ 拒绝 / 鼓励 / 打岔 / 介入；战斗段已排除。" },
			{ id: "sydney_temple", name: "悉尼（Sydney）· 神殿居所", match: function (n) { return n.indexOf("Temple Sydney") === 0 || n.indexOf("Sydney Temple") === 0; }, main: "Temple Sydney", note: "神殿中悉尼的房间与祭坛场景（纯/堕两线都在此）。亵渎仪式（Corrupt 全链）与食堂写字段已拆到上面两组独立直达" },
			{ id: "sirris_places", name: "西里斯（Sirris）· 学校与成人商店", match: function (n) { return /sirris/i.test(n) || n === "Sydney Ride Home" || n === "Sydney Ride Temple"; }, main: "Adult Shop Approach Sirris", note: "西里斯常驻的科学教室与成人商店，以及开车接送的车程场景（悉尼的家长）" },
		];
		for (var i = groups.length - 1; i >= 0; i--) { PLACE_GROUPS.unshift(groups[i]); }
	})();
	/* 子入口白名单续写：PLACE_EXTRA_ENTRIES 在 07d-places4.js 定义，键序不影响 items 顺序（items 直接取数组）。
	   主场景不出现在子入口里（避免同段两个按钮）；战斗中继段由 mbCEIsUnplayableEntry 自动过滤。 */
	/* v2.1.10 悉尼亵渎仪式全链子入口（按剧情顺序排列，玩家一路点下去） */
	PLACE_EXTRA_ENTRIES.sydney_defile = [
		{ name: "Sydney Temple Corrupt 2", cn: "潜入禁地" },
		{ name: "Sydney Temple Corrupt Lock", cn: "上锁的门" },
		{ name: "Sydney Temple Corrupt Pick", cn: "撬锁 / 破门" },
		{ name: "Sydney Temple Corrupt Search", cn: "搜柜找钥匙" },
		{ name: "Sydney Temple Corrupt Fight Finish", cn: "打斗结算" },
		{ name: "Sydney Temple Corrupt Sex", cn: "祈祷室" },
		{ name: "Sydney Temple Corrupt Sex Finish", cn: "高潮结算" },
		{ name: "Sydney Temple Corrupt End", cn: "事后醒来" },
		{ name: "Sydney Temple Corrupt End Final", cn: "结束（Sirris 接人）" }
	];
	/* v2.1.10 食堂线（身上写字）—— 主场景即写字段 Bodywriting Allow，其余是三个反应分支 */
	PLACE_EXTRA_ENTRIES.sydney_canteen = [
		{ name: "Sydney Canteen Bodywriting Stop", cn: "拒绝写字" },
		{ name: "Sydney Canteen Encourage", cn: "鼓励" },
		{ name: "Sydney Canteen Break", cn: "打岔" },
		{ name: "Sydney Canteen Intervene", cn: "介入" }
	];
	/* 悉尼神殿居所子入口（自 07d-places4.js 迁出，内容不变） */
	PLACE_EXTRA_ENTRIES.sydney_temple = [
		{ name: "Sydney Temple Pure", cn: "纯洁线" },
		{ name: "Sydney Temple Corrupt", cn: "堕落线" },
		{ name: "Temple Sydney Pray", cn: "祈祷" },
		{ name: "Sydney Temple Garden", cn: "神殿花园" },
		{ name: "Temple Sydney Rosary", cn: "念珠" },
		{ name: "Temple Sydney Wakeup", cn: "醒来" },
		{ name: "Sydney Temple Punish", cn: "惩戒" },
		{ name: "Temple Sydney Ask", cn: "询问" },
		{ name: "Temple Sydney Walk", cn: "散步" }
	];
