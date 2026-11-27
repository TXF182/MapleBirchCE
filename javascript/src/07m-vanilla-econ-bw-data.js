/* 职责：原版「身体涂鸦 bodywriting」直写通道（全局页 ⑪ 数据层，替代原纹身样式自选区）。
   事实依据（DoL 0.5.12.13 单文件 HTML 实证，不抄二手结论）：
   - setup.bodywriting 全量 206 条（@284979 起）；每条 {index, writing, type, special, lewd, sprites}，
     汉化包在运行时给每条注入 writ_cn（i18n 替换 `writing: "X",` → `writing: "X",writ_cn: "…",`）。
   - 原版镜子菜单 _bodyWritingOptions（@296546）静态全量 9 组 118 条（General 15 / Promiscuity 16 /
     Prostitution 10 / Exhibitionism 6 / Deviancy 5 / Masochism 4 / Submission 11 / Pregnancy 5 /
     Love Interests 46）；菜单按玩家属性条件解锁，这里按全量列出。
   - 原版写入通道 add_bodywriting（@287369）：`clone(setup.bodywriting[key])` 写进 $skin[part]，
     pen 由调用方置 "pen"（涂鸦）/ "tattoo"（纹身）；本段固定 "pen"。
   - 非菜单 88 条（NPC/剧情专属）：Sydney 17（含十六字真言）、bestiality 9、criminal 7、rape 9、
     impreg 8、cattle 6、combat 5、islander 3、pregnancy 3、violence 3、esoteric/holy 各 1、none 16。
   - 十六字真言 stupid_little_fucking_sextease_bitch_fucker（special Sydney，汉化「操他妈的只会色诱的白痴脑瘫小婊子」）
     单独一键入口，仍归属涂鸦区块。
   回退：kind=bodywriting（单部位，had=false 时删除）/ bodywriting-all（整份皮肤）/
   bodywriting-images（图像开关）；旧 tattoo / tattoo-all 留痕仍由 undo 段兼容。 */

	var MCE_ECON_BW_MENU = [
		{ grp: "General", zh: "通用", keys: [
			"cute_boy", "cute_girl", "orphan", "handsome", "pretty", "stud",
			"beauty", "beautiful", "daddy_issues", "mummy_issues", "trashy", "worthless",
			"oh_no", "dumb_bitch", "hot"
		] },
		{ grp: "Promiscuity", zh: "淫乱", keys: [
			"slut", "promiscuous", "wanton", "dtf", "insatiable_slut", "free_sex",
			"town_bicycle", "size_queen", "sex_addict", "make_me_cum", "fuck_me", "cocksucker",
			"cum_dump", "public_slut", "buttslut", "anal_whore"
		] },
		{ grp: "Prostitution", zh: "卖淫", keys: [
			"its_not_rape_if_you_pay_me", "five_pound_whore", "ten_pound_a_pop", "slut_for_hire", "twenty_five_pound_per_fuck", "one_hundred_pound",
			"body_for_sale", "stupid_whore", "whore", "prostitute"
		] },
		{ grp: "Exhibitionism", zh: "暴露", keys: [
			"pervert", "attention_whore", "flaunter", "object", "strip_me", "ask_to_see_me_naked"
		] },
		{ grp: "Deviancy", zh: "异种", keys: [
			"doggy_slut", "animal", "beast_fucker", "breedable", "deviant"
		] },
		{ grp: "Masochism", zh: "受虐", keys: [
			"hit_me", "hurt_me", "treat_me_bad", "make_me_squeal"
		] },
		{ grp: "Submission", zh: "顺从", keys: [
			"submissive", "pet", "public_pet", "free_use", "use_me", "slave",
			"enslave_me", "cum_rag", "fuckdoll", "fucktoy", "walking_dildo"
		] },
		{ grp: "Pregnancy", zh: "怀孕", keys: [
			"brood_mother", "inseminate_me", "impregnate_me", "pregnancy_slut", "breeding_ground"
		] },
		{ grp: "Love Interests", zh: "恋爱对象", keys: [
			"robins_protector", "robin_and_i", "the_orphan_lover", "robins_boyfriend", "robins_girlfriend", "whitneys_pet",
			"property_of_whitney", "whitneys_toy", "whitneys_boyslut", "whitneys_slut", "kylars_obsession", "love_kylar_forever",
			"reserved_for_kylar", "just_kylar", "edens_companion", "hunter_and_prey", "its_lonely_in_the_woods", "something_is_hunting_you",
			"averys_trophy", "endearing", "uptown_boy", "uptown_girl", "averys_monopoly", "alexs_partner",
			"sunrise_to_sunset", "hay_baler", "cowboy", "cowgirl", "sydneys_savior", "bound_to_sydney",
			"sydney_makes_me_smile", "purest_love", "lusty_sinners", "black_wolfs_bitch", "all_for_my_alpha", "leader_of_the_pack",
			"runs_with_wolves", "great_hawks_spouse", "soaring_with_love", "terrors_mate", "free_bird", "witchs_ward",
			"witchs_familiar", "gwylans_treasure", "gwylans_apprentice", "forever_yearning"
		] }
	];
	/* 特殊涂鸦分组显示名（按原版 special 标签 = 写入来源；none 再按 type 拆纹样 / 杂项） */
	var MCE_ECON_BW_SPECIAL_ZH = {
		Sydney: "悉尼", cattle: "雷米牧场", bestiality: "兽交", criminal: "犯罪", rape: "强暴",
		impreg: "受孕", pregnancy: "怀孕", violence: "暴力", combat: "战斗", islander: "海岛",
		esoteric: "秘教", holy: "神圣", pattern: "纹样符号", misc: "杂项"
	};
	var MCE_ECON_BW_SPECIAL_ORDER = ["Sydney", "cattle", "bestiality", "rape", "criminal", "impreg",
		"pregnancy", "violence", "combat", "islander", "esoteric", "holy", "pattern", "misc"];
	var MCE_ECON_BW_TRUTH_KEY = "stupid_little_fucking_sextease_bitch_fucker";

	function mbCEVanillaEconBwHost() {
		try {
			var s = getSetup();
			return (s && s.bodywriting && typeof s.bodywriting === "object") ? s.bodywriting : null;
		} catch (eBw) { return null; }
	}
	function mbCEVanillaEconBwZhOf(key, design) {
		return (design && (design.writ_cn || design.writing)) || key;
	}
	function mbCEVanillaEconBwMenuSet() {
		var set = {};
		MCE_ECON_BW_MENU.forEach(function (g) { g.keys.forEach(function (k) { set[k] = 1; }); });
		return set;
	}
	/* 菜单分类（9 组）：宿主有该键时补中文，宿主缺键仍列出（写入时由 BwWrite 拒绝） */
	function mbCEVanillaEconBwMenu() {
		var host = mbCEVanillaEconBwHost();
		return MCE_ECON_BW_MENU.map(function (g) {
			return {
				grp: g.grp,
				zh: g.zh,
				items: g.keys.map(function (k) {
					var d = host ? host[k] : null;
					return { key: k, zh: mbCEVanillaEconBwZhOf(k, d), type: d ? d.type : "text" };
				})
			};
		});
	}
	/* 特殊涂鸦：宿主全量 - 菜单 118 - 十六字真言，按 special 归组（none 按 type 拆 pattern / misc） */
	function mbCEVanillaEconBwSpecial() {
		var host = mbCEVanillaEconBwHost();
		if (!host) { return []; }
		var menuSet = mbCEVanillaEconBwMenuSet();
		var buckets = {};
		Object.keys(host).forEach(function (k) {
			if (menuSet[k] || k === MCE_ECON_BW_TRUTH_KEY) { return; }
			var d = host[k] || {};
			var sp = d.special || "none";
			if (sp === "none") { sp = d.type === "object" ? "pattern" : "misc"; }
			if (!buckets[sp]) { buckets[sp] = []; }
			buckets[sp].push({ key: k, zh: mbCEVanillaEconBwZhOf(k, d), type: d.type });
		});
		return MCE_ECON_BW_SPECIAL_ORDER.filter(function (sp) {
			return buckets[sp] && buckets[sp].length;
		}).map(function (sp) {
			return { grp: sp, zh: MCE_ECON_BW_SPECIAL_ZH[sp] || sp, items: buckets[sp] };
		});
	}

	/* 写入：等价原版 add_bodywriting 的 clone + pen 通道（pen 固定 "pen" = 涂鸦） */
	function mbCEVanillaEconBwWrite(part, key) {
		var V = getV();
		var skin = V && V.skin;
		if (!skin || typeof skin !== "object") { return { ok: false, message: "该存档没有皮肤数据，进游戏刷新一次再回来" }; }
		if (!part) { return { ok: false, message: "先选一个部位" }; }
		var host = mbCEVanillaEconBwHost();
		if (!host) { return { ok: false, message: "原版涂鸦数据不在（原版数据缺失），拒绝凭空造对象" }; }
		var d = host[key];
		if (!d || typeof d !== "object") { return { ok: false, message: "这个涂鸦不在原版数据表里（拒绝写入未知键）" }; }
		var design = mbCEVanillaEconClone(d);
		if (!design) { return { ok: false, message: "涂鸦数据无法复制（结构异常）" }; }
		var obj = skin[part];
		var before = { kind: "bodywriting", part: part, value: mbCEVanillaEconClone(obj), had: !!(obj && typeof obj === "object") };
		design.pen = "pen";
		skin[part] = design;
		mbCEVanillaTrace("bodywriting-" + part, before, "skin." + part, "写入涂鸦（" + mbCEVanillaEconBwZhOf(key, d) + "）", "vcore-econ");
		return { ok: true, message: "已在「" + mbCEVanillaEconBodyZh(part) + "」写上「" + mbCEVanillaEconBwZhOf(key, d) + "」（原版涂鸦写入通道，可回退）" };
	}
	/* 清除：原版 bodywriting_clear 语义 = skin[part] 整块重置；涂鸦与纹身都清 */
	function mbCEVanillaEconBwClear(part) {
		var V = getV();
		var skin = V && V.skin;
		if (!skin || typeof skin !== "object") { return { ok: false, message: "该存档没有皮肤数据" }; }
		var obj = skin[part];
		if (!obj || typeof obj !== "object") { return { ok: false, message: "该部位没有皮肤数据" }; }
		if (!obj.pen) { return { ok: false, message: "该部位没有涂鸦或纹身" }; }
		var before = { kind: "bodywriting", part: part, value: mbCEVanillaEconClone(obj), had: true };
		skin[part] = {};
		mbCEVanillaTrace("bodywriting-" + part, before, "skin." + part, "清除该部位涂写", "vcore-econ");
		return { ok: true, message: "已清除「" + mbCEVanillaEconBodyZh(part) + "」上的涂写（整部位重置，等价原版擦除涂写）" };
	}
	function mbCEVanillaEconBwClearAll() {
		var V = getV();
		var skin = V && V.skin;
		if (!skin || typeof skin !== "object") { return { ok: false, message: "该存档没有皮肤数据" }; }
		var keys = Object.keys(skin).filter(function (k) {
			return skin[k] && typeof skin[k] === "object" && skin[k].pen;
		});
		if (!keys.length) { return { ok: false, message: "当前没有任何涂鸦或纹身" }; }
		var before = { kind: "bodywriting-all", skin: mbCEVanillaEconClone(skin) };
		keys.forEach(function (k) { skin[k] = {}; });
		mbCEVanillaTrace("bodywriting-all", before, "skin", "一键清除全部涂写", "vcore-econ");
		return { ok: true, message: "已清除 " + keys.length + " 处涂鸦 / 纹身", cleared: keys.length };
	}
	/* 图像开关：原版设置项 $options.bodywritingImages 直写（勾上才画涂鸦图像） */
	function mbCEVanillaEconBwImages(on) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		if (!V.options || typeof V.options !== "object") { V.options = {}; }
		var before = { kind: "bodywriting-images", value: V.options.bodywritingImages };
		V.options.bodywritingImages = on ? 1 : 0;
		mbCEVanillaTrace("bodywriting-images", before, "options.bodywritingImages", "身体涂鸦图像开关", "vcore-econ");
		return { ok: true, message: "已" + (on ? "启用" : "关闭") + "身体涂鸦图像显示" };
	}
