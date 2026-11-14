/* 职责：场景直达 —— PLACE_GROUPS 分组表 / 传送 / 到达校验 / 地点页渲染 */
	/* ============ 特殊场景直达（用户点名 5 大场景 + 主从嵌套）
	     不硬编码段落清单：按前缀/关键词在 Story 段落里动态枚举，MOD 新增段落自动收录；
	     组 = 主场景，组内各段落 = 子场景，main 段落排最前并标注「主」。============ */
	var PLACE_GROUPS = [
		/* v2.0.15 剧情入口四组（象牙怨灵 / 万圣节 / 情人节 / 圣诞）登记在 07d-places3.js：
		   用 unshift 插到本数组最前（listPlaceGroups 靠 seen 先占先得，"Lake Halloween Party" 否则会被 lake 组吃掉）。 */
		{ id: "orphanage_loft", name: "孤儿院 · 阁楼", match: function (n) { return n.indexOf("Orphanage Loft") === 0; }, main: "Orphanage Loft", note: "孤儿院上方的阁楼（隐藏区域，Bailey 视线之外）" },
		{ id: "kylar_manor", name: "凯拉尔 · 庄园", match: function (n) { return n.indexOf("Manor ") === 0; }, main: "Manor Hall", note: "凯拉尔家族的庄园大宅（大厅/花园/实验室/秘密房间）" },
		{ id: "sydney_temple", name: "悉尼（Sydney）· 神殿居所", match: function (n) { return n.indexOf("Temple Sydney") === 0 || n.indexOf("Sydney Temple") === 0; }, main: "Temple Sydney", note: "神殿中悉尼的房间与祭坛场景（纯/堕两线都在此）" },
		{ id: "sirris_places", name: "西里斯（Sirris）· 学校与成人商店", match: function (n) { return /sirris/i.test(n) || n === "Sydney Ride Home" || n === "Sydney Ride Temple"; }, main: "Adult Shop Approach Sirris", note: "西里斯常驻的科学教室与成人商店，以及开车接送的车程场景（悉尼的家长）" },
		{ id: "avery_mansion", name: "艾弗里 · 庄园", match: function (n) { return n.indexOf("Mansion ") === 0; }, exclude: mbCEIsUnplayableEntry, main: "Mansion Bed", note: "艾弗里的庄园豪宅（卧室/泳池/浴室/厨房/地牢/车库等套间）。Mansion 前缀实测 866 段，剔除 46 段战斗/性爱中继（Dungeon Fight/Flogger Sex、Chase Fight、Housework *Sex·Rape、Return *Fight·Rape·Sex、Party Jordan End *、Passout Pair * 等，首宏为 $fightstart/$sexstart/$molestationstart），留 820 段。" },
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
		}, exclude: mbCEIsUnplayableEntry, main: "Elk Compound",
		  note: "麋鹿街大院：Elk Compound 前缀段实测 70 段（中央区/地下/水晶/车站/附身线）。其中怨灵相关只有 4 段（Wraith Give / Resist / Fight / Fight Finish），怨灵主线其余 64 段不带此前缀、不归本组。widget 定义段（Elk Compound Widgets）与战斗起始段（首宏 $fightstart / $molestationstart，共 9 段）不入组。" },
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
		}, exclude: mbCEIsUnplayableEntry, main: "Wolf Cave",
		  note: "森林深处的狼群领地（狼穴 hub / 猎人 / 腐肉 / 河流 / 巡逻各线）。主场景取 Wolf Cave（狼穴入口，自带出口）；原主场景 Wolf Pack 的首个控制宏是 if($molestationstart is 1)，属战斗遭遇中继段，硬跳进去条件为假、正文空白、链接全灭（v2.0.15 未给本组挂 exclude，该缺陷一直在线，v2.0.16 修正）。" },
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
			/* v2.0.16 扩前缀：原 match 只认「The Farm / Farmland」，主场景换到 Farm Cottage 后
			   该段不在组内（渲染会报「未匹配到主场景段落」）。现补两种前缀：
			   "The Farm " 为农场本体族、"Farm " 为农场小屋族（Farm Cottage / Bedroom / Bed /
			   Breakfast / Alex / Assault / Wardrobe 等）、"Farmland " 为农田事件族。
			   战斗中继段由 exclude 剔除，不会进组。 */
			return n === "The Farm" || n === "Farm" || n.indexOf("The Farm ") === 0
				|| n.indexOf("Farm ") === 0 || n.indexOf("Farmland ") === 0;
		}, exclude: mbCEIsUnplayableEntry, main: "Farm Cottage",
		  note: "雷米农场本体与农场事件（艾利克斯线/农作物/农场商店/暴露事件）。主场景取 Farm Cottage（农场小屋，自带出口）；原主场景 The Farm 的首个控制宏是 if($molestationstart is 1)，属战斗遭遇中继段，硬跳会白屏（v2.0.15 未给本组挂 exclude，该缺陷一直在线，v2.0.16 修正）。" },
		/* v2.0.7 R3（玩家「有的地点都没了」「那小岛的作弊呢」）：原版 0.5.12.13 有 Island 海岛线
		   （setup.majorAreas 含 "Island"，setup.addlocation("island").parent("sea")，Widgets Text Island → "the nearby island"，
		   teleportCheater 有 case "Island" → island_end），但 CE 的 17 组地点直达里一直没有 → 玩家进不去。
		   Island 前缀段落：Island（hub）/ Island Explore / Island Sleep / Island Defeat / Island Build <档> <件> / Island Walnut 等。 */
		{ id: "island", name: "海岛 · Island", match: function (n) {
			return n === "Island" || n.indexOf("Island ") === 0;
		}, main: "Island", note: "海岛生存线（营地三选/探索六处/建造/隐蔽/语言；生存数值与营地作弊见「地点」子页签）" }
	];
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
					setStatus("「" + target + "」直达失败：该段落没有可点链接（渲染期异常或前置状态缺失），已退回原处「" + before + "」。这个场景请从正常入口进入。", MCE_CLS.err);
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
		/* v2.0.17：子入口专属状态兜底（$gwylan / $pubfame），实现落在 07d-places4.js。
		   先于各地点分支执行 —— 它只补缺失、不覆盖，且与被调地点不冲突。 */
		if (typeof mbCEEnsureEntryState === "function") { mbCEEnsureEntryState(nm, V2); }
		/* v2.0.22：森林商店本体直达补 $tryOn 壳（实现与取证见 07d-places4.js 的 mbCETryOnShell）。 */
		if (typeof mbCETryOnShell === "function" && mbCETryOnShell(nm, V2)) { return; }
		if (/^Prison/.test(nm)) { /* 无 \b：PrisonScarredInmate 一类无空格段名也命中 */
			if (V2.prison && typeof V2.prison === "object") { return; } /* 已有进度：绝不调 init（避免 morning 被重置） */
			var sc = (typeof window !== "undefined" && window && window.SugarCube) ? window.SugarCube : null;
			var W = (sc && sc.Wikifier) ? sc.Wikifier : (typeof Wikifier !== "undefined" ? Wikifier : null);
			if (W) { new W(null, "<<prison_init>>"); }
			return;
		}
		/* v2.0.16：判据从「The Farm / Farmland」放宽到「Farm 开头」——主场景已从 The Farm 换成 Farm Cottage
		   （前者首宏是 if($molestationstart is 1) 的战斗中继段），Farm Cottage 不以 "The Farm" 开头，旧判据下
		   新档直达农场小屋会丢掉 $farm 兜底。且不因「$farm 已是对象」早退：Farm Cottage 段首是
		   <<if $farm.build_finished.includes("nursery")>>，build_finished 缺失或非数组照样 TypeError；
		   ensureFarmState 只补缺失、不覆盖已有进度，故无条件调用安全。 */
		if (nm.indexOf("The Farm") === 0 || nm.indexOf("Farm") === 0 || nm.indexOf("Farmland") === 0) {
			ensureFarmState(true);
			return;
		}
		/* v2.0.16：狼穴 hub 的状态兜底。Wolf Cave 段首即
		      <<set $wolfpackharmony to Math.clamp($wolfpackharmony, 0, 22)>>
		   —— 这三个键在原版只在狼线各段内才被初始化（不在 StoryInit），新档直达时
		   $wolfpackharmony / $wolfpackferocity 为 undefined → Math.clamp 返回 NaN（不抛，但面板读数是 NaN、
		   wolfcavestate 分支判定失真）。按原版初始化值补 10；$wolfstate 补 "cave"、$wolfevent 补 0、
		   $wolfcavedig 补 0（等价「还没开挖」，仍走 Examine 分支）。全部「缺失才补」。 */
		if (nm === "Wolf Cave" || nm.indexOf("Wolf Cave") === 0) {
			if (typeof V2.wolfpackharmony !== "number" || !isFinite(V2.wolfpackharmony)) { V2.wolfpackharmony = 10; }
			if (typeof V2.wolfpackferocity !== "number" || !isFinite(V2.wolfpackferocity)) { V2.wolfpackferocity = 10; }
			if (typeof V2.wolfstate !== "string" || !V2.wolfstate) { V2.wolfstate = "cave"; }
			if (typeof V2.wolfevent !== "number") { V2.wolfevent = 0; }
			if (typeof V2.wolfcavedig !== "number") { V2.wolfcavedig = 0; }
			return;
		}
		/* v2.0.15 剧情入口四组（象牙怨灵 / 万圣节 / 情人节 / 圣诞）：状态保底与时间通道见 07d-places3.js。
		   必须排在下面「Lake 」前缀分支之前，否则 Lake Halloween Party 会被湖畔分支把 $phase 改成 1（草丛档）。 */
		if (mbCEFestivalEntryState(nm, V2)) { return; }
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
	} catch (e) { /* 直达前补壳失败（存档结构异常）→ 不阻断直达，由目标段落自身兜底 */ }
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
				setStatus("段落不存在：「" + name + "」（可能未安装对应剧情 MOD）", MCE_CLS.err);
				return;
			}
			var ep = getEnginePlayFn();
			if (!ep) {
				var d1 = (typeof window !== "undefined" && window) ? (typeof window.Engine) : "no-window";
				var d2 = (typeof Engine);
				var d3 = (typeof $);
				var d4 = (typeof window !== "undefined" && window && window.SugarCube) ? (typeof window.SugarCube.Engine) : "no-sc";
				setStatus("Engine 不可用（Engine=" + d2 + "，window.Engine=" + d1 + "，$=" + d3 + "，SugarCube.Engine=" + d4 + "）——若非游戏页面请先进入游戏", MCE_CLS.err);
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
			setStatus("已传送至「" + name + "」", MCE_CLS.ok);
			mbCEArrivalCheck(beforeP, name); /* v2.0.10：无可用链接 → 自动退回原处，不把玩家卡死 */
			var gidT = placeIdForPassage(name, name);
			if (gidT) { applyWorldUnlock(gidT); setStatus("已传送至「" + name + "」并已解锁世界入口", MCE_CLS.ok); }
			/* v2.0.10-e：宏结构预检（只提示，不阻止；刻意放在成功文案之后，避免被覆盖） */
			try { var mbW = mbCEPassageMacroWarn(name); if (mbW) { setStatus(mbW, MCE_CLS.err); } } catch (e1) {}
		} catch (e) { setStatus("传送失败：" + mbCEErr(e), MCE_CLS.err); }
	}
	/* listPlaceGroups 已迁到 07d-places5.js（本片原 399 行，缓存改造需净增行；迁出后回落至 376 行，
	   为 v2.1.4 那条「4.js 满 400 行才把惠特尼白名单塞进 3.js」的容量挤压留出余量） */
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
