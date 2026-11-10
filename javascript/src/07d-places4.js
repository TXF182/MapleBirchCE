/* 场景直达 · 子入口表（用户「凯拉尔庄园 note 里列了 大厅/花园/实验室/秘密房间，
   却不给各自直达按钮」的诉求）—— 结构门禁 S1 拆段。
   本段只放「组 id → 子入口清单」与过滤函数；分组定义/主场景/note 仍在
   07d-places.js，渲染在 07d-places2.js，可玩性判据在 07d-places3.js。

   设计要点：
   ① 子入口是「快捷按钮」，不是新的分组元素 —— 不参与 listPlaceGroups 的 items 计数，
      所以组标题的「N 个段落」与 totalItems 断言口径完全不变。
   ② 每条子入口的 cn 是**显式中文标签**，不走 placeNameCN 的子串拼接：
      placeNameCN 是子串匹配（"show" 会命中 "Shower"），149 条叠加起来必然互相污染。
   ③ 渲染前逐条过三重判据：属于本组 items（存在 / 未被 exclude / 未被别组先占）
      + passageExists + mbCEIsUnplayableEntry。任何一条不成立就不显示该行，
      模组缺段或段落被改名时自动降级，不会点出一个空白页。
   ④ 取证：%TEMP%\mce_verify_sub.txt（150+ 候选段逐条三态）+ %TEMP%\mce_playable2.js
      （首个控制宏严判）。初选的 Sirris Classroom / Sirris Science / Sirris Adult Shop
      在原版 HTML 为 MISSING，已剔除；Wolf Pack / The Farm 首宏是
      if($molestationstart is 1)，属战斗中继段，改由 main 换掉（见 07d-places.js）。 */

/* 主场景名中文化词表（placeNameCN 的子串映射表；v2.0.16 起随子入口一起落在本段，
	   原在 07d-places.js，搬出是为了让该段回到结构门禁 400 行内。子入口不走这张表，各自带显式 cn） */
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
		"farm": "农场", "farmland": "农田", "plough": "犁地", "tie stall": "拴栏", "milking": "挤奶",
		/* v2.0.15：剧情入口四组的主场景中文词条 */
		"halloween": "万圣节", "valentines": "情人节", "christmas": "圣诞节", "ivory": "象牙",
		"bonfire": "篝火", "costume": "戏服", "trick": "捣蛋", "treat": "讨糖", "gift": "礼物",
		/* v2.0.16：主场景行「记得汉化」补齐 —— 此前 Temple Sydney / Adult Shop Approach Sirris /
		   Doren Entrance / Mansion Bed 等多组 placeNameCN 返回空串，主场景行只剩英文裸名。
		   子入口不走这张表（各自带显式 cn），这里只服务主场景行与既有组名。
		   逐条已核对子串污染：无「单字词条命中同族长名」的情况（如 show→Shower 那种）。 */
		"avery": "艾弗里", "orphanage": "孤儿院", "manor": "庄园", "temple": "神殿",
		"sydney": "悉尼", "adult shop": "成人商店", "sirris": "西里斯", "approach": "前往",
		"mansion": "宅邸", "gwylan": "格威岚", "doren": "多伦", "entrance": "入口",
		"cell": "拘押室", "stroll": "散步", "cave": "狼穴", "front": "前门", "cottage": "小屋",
		"foyer": "门厅", "dressing room": "更衣室", "brothel show": "舞台表演", "brothel private": "私人房"
	};

/* 组 id → 子入口白名单（顺序即面板显示顺序：按空间/行为就近排列，不排序） */
var PLACE_EXTRA_ENTRIES = {
	orphanage_loft: [
		{ name: "Orphanage Loft Intro", cn: "阁楼入口" },
		{ name: "Orphanage Loft Kitchen", cn: "阁楼厨房" },
		{ name: "Orphanage Loft Spray", cn: "阁楼喷漆" }
	],
	kylar_manor: [
		{ name: "Manor Garden", cn: "花园" },
		{ name: "Manor Lab", cn: "实验室" },
		{ name: "Manor Parents Room", cn: "父母房间" },
		{ name: "Manor Kitchen", cn: "厨房" },
		{ name: "Manor Kylar Room", cn: "凯拉尔房间" },
		{ name: "Manor Grounds", cn: "庭院" }
	],
	sydney_temple: [
		{ name: "Sydney Temple Pure", cn: "纯洁线" },
		{ name: "Sydney Temple Corrupt", cn: "堕落线" },
		{ name: "Temple Sydney Pray", cn: "祈祷" },
		{ name: "Sydney Temple Garden", cn: "神殿花园" },
		{ name: "Temple Sydney Rosary", cn: "念珠" },
		{ name: "Temple Sydney Wakeup", cn: "醒来" },
		{ name: "Sydney Temple Punish", cn: "惩戒" },
		{ name: "Temple Sydney Ask", cn: "询问" },
		{ name: "Temple Sydney Walk", cn: "散步" }
	],
	sirris_places: [
		{ name: "Sydney Ride Home", cn: "送回家（车程）" },
		{ name: "Sydney Ride Temple", cn: "送往神殿（车程）" }
	],
	avery_mansion: [
		{ name: "Mansion Pool", cn: "泳池" },
		{ name: "Mansion Bathroom", cn: "浴室" },
		{ name: "Mansion Bedroom", cn: "卧室" },
		{ name: "Mansion Display", cn: "陈列室" },
		{ name: "Mansion Folder", cn: "档案" },
		{ name: "Mansion Dungeon Intro", cn: "地牢入口" },
		{ name: "Mansion Bathe", cn: "沐浴" },
		{ name: "Mansion Talk", cn: "交谈" },
		{ name: "Mansion Skyscraper Rise", cn: "摩天楼" }
	],
	gwylan_garden: [
		{ name: "Gwylan Gifts List", cn: "礼物清单" },
		{ name: "Forest Gwylan Lure", cn: "森林引诱" },
		{ name: "Nightmare Gwylan", cn: "梦魇" }
	],
	doren_flat: [
		{ name: "Doren Talk", cn: "交谈" },
		{ name: "Doren Cry", cn: "哭泣" },
		{ name: "Doren Shower", cn: "淋浴" },
		{ name: "Doren Shower Ask", cn: "求淋浴" },
		{ name: "Doren Loft", cn: "阁楼布置" }
	],
	elk_compound: [
		{ name: "Elk Compound Interior", cn: "室内" },
		{ name: "Elk Compound Central", cn: "中央区" },
		{ name: "Elk Compound Underground", cn: "地下" },
		{ name: "Elk Compound Station", cn: "站台" },
		{ name: "Elk Compound Crystal", cn: "水晶" },
		{ name: "Elk Compound Pipes", cn: "管道" },
		{ name: "Elk Compound Camera", cn: "摄像头" },
		{ name: "Elk Compound Possessed", cn: "附身" },
		{ name: "Elk Compound Experiment", cn: "实验" },
		{ name: "Elk Compound Explore", cn: "探索" },
		{ name: "Elk Compound Sell", cn: "出售" }
	],
	asylum: [
		{ name: "Asylum Depths Intro", cn: "深渊入口" },
		{ name: "Asylum Room", cn: "病房" },
		{ name: "Asylum Shower", cn: "淋浴" },
		{ name: "Asylum Study", cn: "书房" },
		{ name: "Asylum Machine", cn: "机械" },
		{ name: "Asylum Pill Sit", cn: "服药静坐" },
		{ name: "Asylum Button Press", cn: "按按钮" },
		{ name: "Asylum Hypnosis Trance", cn: "催眠恍惚" },
		{ name: "Asylum Mirror Meek", cn: "镜中怯弱" }
	],
	police_prison: [
		{ name: "Police Station Cover", cn: "警局掩护" },
		{ name: "Prison Yard", cn: "操场" },
		{ name: "Prison Laundry", cn: "洗衣房" },
		{ name: "Prison Medical", cn: "医务室" },
		{ name: "Prison Spire Hole", cn: "尖塔洞" },
		{ name: "Prison Breakfast", cn: "早餐" },
		{ name: "Prison Dinner", cn: "晚餐" },
		{ name: "Prison Beach", cn: "狱中海滩" },
		{ name: "Prison Attention Quiet", cn: "低调应对" }
	],
	docks: [
		{ name: "Docks Pub Crawl", cn: "酒吧巡游" },
		{ name: "Docks Lunch", cn: "午餐" },
		{ name: "Docks Catsuit", cn: "猫装" },
		{ name: "Docks Compound", cn: "码头大院" },
		{ name: "Docks Gold", cn: "黄金" },
		{ name: "Docks Start Early", cn: "提早开工" },
		{ name: "Docks Tourist Return", cn: "游客归来" }
	],
	lake: [
		{ name: "Lake Campsite", cn: "营地" },
		{ name: "Lake Shore", cn: "湖岸" },
		{ name: "Lake Office", cn: "办公室" },
		{ name: "Lake Mermaid", cn: "美人鱼" },
		{ name: "Lake Ritual", cn: "仪式" },
		{ name: "Lake Fishing Rock", cn: "垂钓石" },
		{ name: "Lake Skate", cn: "滑冰" },
		{ name: "Lake Underwater", cn: "水下" },
		{ name: "Lake Depths", cn: "深处" },
		{ name: "Lake Ruin Prison", cn: "遗迹囚牢" },
		{ name: "Lake Mason Intro", cn: "石匠入口" }
	],
	wolf_territory: [
		{ name: "Wolf Cave Help", cn: "狼穴求助" },
		{ name: "Wolf Cave Clearing", cn: "狼穴空地" },
		{ name: "Wolf Cave Bed", cn: "狼穴巢床" },
		{ name: "Wolf Hunters", cn: "猎人" },
		{ name: "Wolf Carrion", cn: "腐肉" },
		{ name: "Wolf Bear", cn: "熊" },
		{ name: "Wolf River", cn: "河流" },
		{ name: "Wolf Patrol Intro", cn: "巡逻入口" }
	],
	hospital: [
		{ name: "Hospital Foyer", cn: "门厅" },
		{ name: "Hospital Bed", cn: "病床" },
		{ name: "Hospital Keycard Receptionist", cn: "门禁卡前台" },
		{ name: "Hospital cupboard", cn: "储物柜" },
		{ name: "Hospital Tattoo Removal", cn: "洗纹身" },
		{ name: "Hospital Paternity Test", cn: "亲子鉴定" },
		{ name: "Hospital Breast Reduction", cn: "缩胸" },
		{ name: "Hospital Penis Reduction", cn: "缩阴" },
		{ name: "Hospital Parasite", cn: "寄生虫" }
	],
	brothel: [
		{ name: "Brothel Stage", cn: "舞台" },
		{ name: "Brothel Wardrobe", cn: "衣柜" },
		{ name: "Brothel Dressing Room", cn: "更衣室" },
		{ name: "Brothel Gloryhole", cn: "荣耀洞" },
		{ name: "Brothel Private", cn: "私人房" },
		{ name: "Brothel Show", cn: "表演" },
		{ name: "Brothel Shower", cn: "淋浴" },
		{ name: "Brothel Intro", cn: "初次进入" }
	],
	remy_livestock: [
		{ name: "Livestock Barn", cn: "牛棚" },
		{ name: "Livestock Field", cn: "牧场" },
		{ name: "Livestock Cell", cn: "栏笼" },
		{ name: "Livestock Plough", cn: "犁地" },
		{ name: "Livestock Milking Obey", cn: "顺从挤奶" },
		{ name: "Livestock Escape", cn: "逃脱" },
		{ name: "Livestock Lock Examine", cn: "检视锁" },
		{ name: "Livestock Return", cn: "返回" }
	],
	remy_farm: [
		{ name: "Farm Bedroom", cn: "小屋卧室" },
		{ name: "Farm Bed", cn: "小屋床铺" },
		{ name: "Farm Breakfast", cn: "小屋早餐" },
		{ name: "Farmland Event Wheat", cn: "麦田事件" }
	],
	island: [
		{ name: "Island Build", cn: "建造" },
		{ name: "Island Sleep", cn: "睡眠" },
		{ name: "Island Castle", cn: "城堡" },
		{ name: "Island Beach", cn: "海滩" },
		{ name: "Island Treeline", cn: "林线" },
		{ name: "Island Rope", cn: "绳索" },
		{ name: "Island Plumeria", cn: "鸡蛋花" },
		{ name: "Island Walnut Punch", cn: "砸核桃" },
		{ name: "Island Wood Ask", cn: "讨木头" }
	],
	/* v2.0.15 剧情入口四组：note 里点名的「各角色线」在这里各给一个入口 */
	wraith: [],
	halloween: [
		{ name: "Wolf Halloween", cn: "狼群万圣夜" },
		{ name: "Kylar Halloween", cn: "凯拉尔万圣夜" },
		{ name: "Eden Halloween", cn: "伊甸万圣夜" },
		{ name: "Orphanage Ward Halloween Enter", cn: "孤儿院病栋入口" },
		{ name: "Lake Halloween Invite Inquire", cn: "湖畔受邀询问" },
		{ name: "Shop Eden Halloween", cn: "伊甸商店" }
	],
	valentines: [
		{ name: "Eden Valentines Bath", cn: "伊甸浴" },
		{ name: "Home Valentines Approach", cn: "家中上前" },
		{ name: "Robin Gifts Valentines Yes", cn: "罗宾礼物·答应" },
		{ name: "Kylar Gifts Valentines Calm", cn: "凯拉尔礼物·安抚" },
		{ name: "Whitney Gifts Valentines Allow", cn: "惠特尼礼物·允许" },
		{ name: "Alex Gifts Valentines Kiss", cn: "亚历克斯礼物·亲吻" },
		{ name: "Avery Valentines Missed Intro", cn: "艾弗里·错过入场" },
		{ name: "Orphanage Sneaky Valentines", cn: "孤儿院偷情" },
		{ name: "Shopping Centre Valentines Ask", cn: "购物中心询问" }
	],
	christmas: [
		{ name: "Eden Christmas Meal", cn: "伊甸圣诞晚餐" },
		{ name: "Orphanage Christmas", cn: "孤儿院圣诞" },
		{ name: "Kylar Christmas", cn: "凯拉尔圣诞" },
		{ name: "Forest Christmas Robin", cn: "森林罗宾圣诞" },
		{ name: "Shop Robin Christmas", cn: "罗宾商店圣诞" },
		{ name: "Bleeding Ward Home Christmas", cn: "病栋回家圣诞" }
	]
};

/* 子入口过滤：返回本组真正可渲染的 {name, cn} 清单（三重判据，任一不成立即剔除）。
   copy 出去而不是直接返回原数组元素，避免调用方误改 PLACE_EXTRA_ENTRIES。 */
function mbCEListPlaceEntries(entry) {
	var out = [];
	try {
		if (!entry || !entry.group || !entry.group.id) { return out; }
		var list = (typeof PLACE_EXTRA_ENTRIES === "object" && PLACE_EXTRA_ENTRIES) ? PLACE_EXTRA_ENTRIES[entry.group.id] : null;
		if (!list || !list.length || !Array.isArray(entry.items)) { return out; }
		for (var i = 0; i < list.length; i++) {
			var it = list[i] || {};
			var nm = String(it.name || "");
			if (!nm) { continue; }
			if (nm === entry.group.main) { continue; } /* 与主场景同一段 → 不重复列 */
			if (entry.items.indexOf(nm) === -1) { continue; } /* 不存在 / 被 exclude 剔除 / 被别组先占 */
			if (typeof mbCEIsUnplayableEntry === "function" && mbCEIsUnplayableEntry(nm, mbCEPassageText(nm))) { continue; }
			out.push({ name: nm, cn: String(it.cn || "") });
		}
	} catch (e) { /* 存档结构异常 → 退化为「无子入口」，不影响主场景按钮 */ }
	return out;
}

/* 子入口折叠块渲染：在主场景行之后追加「▸/▾ 更多入口（N）」开关 + 展开后的逐行直达。
   放在本段而不是 07d-places2.js，是因为 places2 已接近结构门禁 400 行上限；
   依赖 el / mbCEUiState / mbCEUiSave / renderPlaces / teleportTo 全在同作用域。 */
function mbCERenderPlaceSubs(block, entry) {
	var subs = mbCEListPlaceEntries(entry);
	if (!subs.length) { return; } /* 无可直达子入口 → 不渲染开关，不留空壳 */
	var gid = String(entry.group.id);
	var opened = !!(mbCEUiState && mbCEUiState.placeOpen && mbCEUiState.placeOpen[gid] === 1);
	var bMore = el("button", "mce-btn mce-place-more", (opened ? "▾ " : "▸ ") + "更多入口（" + subs.length + "）");
	bMore.type = "button";
	bMore.title = opened ? "收起本组的子场景直达按钮" : "展开本组的子场景直达按钮";
	bMore.addEventListener("click", function () {
		if (!mbCEUiState.placeOpen || typeof mbCEUiState.placeOpen !== "object") { mbCEUiState.placeOpen = {}; }
		mbCEUiState.placeOpen[gid] = (mbCEUiState.placeOpen[gid] === 1) ? 0 : 1;
		mbCEUiSave({ placeOpen: mbCEUiState.placeOpen });
		renderPlaces();
	});
	block.appendChild(bMore);
	if (!opened) { return; }
	var box = el("div", "mce-place-subs");
	subs.forEach(function (s) {
		var row = el("div", "mce-stage mce-place-row");
		var head = el("div", "mce-stage-head");
		head.appendChild(el("span", "mce-dot", ""));
		head.appendChild(el("span", "mce-stage-name", s.name + (s.cn ? "　（" + s.cn + "）" : "")));
		var btn = el("button", "mce-btn", "直达");
		btn.type = "button";
		btn.title = "跳转到段落：" + s.name;
		(function (target) {
			btn.addEventListener("click", function () { teleportTo(target); });
		})(s.name);
		head.appendChild(btn);
		row.appendChild(head);
		box.appendChild(row);
	});
	block.appendChild(box);
}

/* v2.0.17 子入口状态兜底 —— 补 v2.0.16 的漏。
   取证（原版 HTML 解码后 16,087 段落）：
   - StoryInit 仅 355 B，只跑 <<variablesStatic>>，且注明「在故事变量载入前执行、每个 $ 都是 undefined」；
     新档真正的 $ 初始化入口是 Start → Start2 → <<variablesStart2>>（<<variablesStart>> 全库零调用者）。
   - 因此判据是「段落前 6 行内做 .属性 写入的键 ∩ 新档初始化集合（gameStartOnly + variablesStart2）的差集」，
     151 条子入口实测只剩两组真缺口（其余 .属性 读取属分支失真或已被既有分支覆盖）：
     1) $gwylan：Forest Gwylan Lure 第 3 行 <<set $gwylan.lureDistance -= 5>>；原版只在
        Widgets Named Npcs 里建壳，新档走不到 → undefined 上写入必 TypeError。
     2) $pubfame：Hospital Keycard Receptionist 首屏 <<set $pubfame.hospital to {}>>；
        原版只在 SV Pub Fame Intro 段建壳，新档走不到。
   已复核无需兜底：$compound/$docks/$livestock/$harper_appointments 均在 <<variablesStart2>> 内新档必建；
   $wraith 由 <<gameStartOnly>> 建壳（子键写入不崩，exit 等字段由 mbCEWraithShell 补齐）；
   $island/$prison/$farm（含 Brothel 两段的 $farm 读取）已由既有分支处理。
   一律「缺失才补、不覆盖已有进度」，字面量照抄原版。 */
function mbCEFillShapeV(dst, shape) {
	if (!dst || typeof dst !== "object" || Array.isArray(dst)) { return shape; }
	for (var k in shape) {
		if (!Object.prototype.hasOwnProperty.call(shape, k)) { continue; }
		var sv = shape[k];
		if (sv && typeof sv === "object" && !Array.isArray(sv)) {
			if (!dst[k] || typeof dst[k] !== "object" || Array.isArray(dst[k])) { dst[k] = sv; }
			else { mbCEFillShapeV(dst[k], sv); }
		} else if (dst[k] === undefined) { dst[k] = sv; }
	}
	return dst;
}

function mbCEEnsureEntryState(nm, V) {
	try {
		var n = String(nm || "");
		if (!V || typeof V !== "object") { return; }
		if (n === "Forest Gwylan Lure" || n === "Nightmare Gwylan" || n.indexOf("Gwylan ") === 0) {
			V.gwylan = mbCEFillShapeV(V.gwylan, {
				progress: 0, stage: 0, sea: 0, wary: 0, robin: 0, purged: 0,
				timer: {}, request: {}, requestCount: 0, requestDone: false,
			});
			if (V.gwylan.lureDistance === undefined) {
				/* 原版 Widgets Forest：<<set $gwylan.lureDistance to Math.clamp($forest, 15, 100)>> */
				var f = Number(V.forest);
				if (!isFinite(f)) { f = 15; }
				V.gwylan.lureDistance = (typeof Math.clamp === "function") ? Math.clamp(f, 15, 100) : Math.min(100, Math.max(15, f));
				if (V.gwylan.lureWill === undefined) { V.gwylan.lureWill = 0; }
			}
		}
		if (n === "Hospital Keycard Receptionist" || n.indexOf("Brothel ") === 0) {
			/* 原版 SV Pub Fame Intro：<<set $pubfame to {seen: [], tasksDone: []}>> */
			V.pubfame = mbCEFillShapeV(V.pubfame, { seen: [], tasksDone: [] });
		}
	} catch (e) { /* 兜底失败不阻断直达：段落自身仍按原版逻辑渲染 */ }
}

/* v2.0.16 子入口样式：折叠开关 + 展开后的缩进层级（默认收起，避免竖屏拉出上百行）。
   追加到 07a-shell.js 定义的 MB_CSS（同作用域、本段在其后执行），而不是写回 shell 段 ——
   shell 段已接近结构门禁 400 行上限，样式跟着功能走更好维护。 */
MB_CSS +=
	".mce-place-more{align-self:flex-start;margin-top:6px;font-size:var(--mce-fs-btn)}" +
	".mce-place-subs{display:flex;flex-direction:column;gap:5px;margin-top:6px;padding-left:10px;border-left:2px dashed var(--mce-border-quiet)}" +
	".mce-place-subs .mce-stage{padding:5px 8px}" +
	".mce-place-subs .mce-stage-name{font-size:var(--mce-fs-btn);font-weight:600}";

