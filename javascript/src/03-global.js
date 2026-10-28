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

	/* ============ v1.8.8：庄园自动维护（学 AutoClean 0.1.5 原功能，即时一键执行）
	     AutoClean 原实现：每日 0 点调 AutoCleanFeedAvery()（艾弗里优先吃想吃的菜）+ AutoCleanFarm()
	     （农场动物锁满/agro 清零/库存收获）。MCE 全局页提供同逻辑的即时按钮，数据逻辑与此处一致。 ============ */
	function mcFeedAvery() {
		var V = getV();
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
		} catch (e) { r.error = String(e.message || e); }
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
					if (b.horses !== undefined) { b.horses = 30; r.beasts += 1; }
					if (b.pigs !== undefined) { b.pigs = 30; r.beasts += 1; }
					if (b.cattle !== undefined) { b.cattle = 30; r.beasts += 1; }
					if (b.dogs !== undefined) { b.dogs = 30; r.beasts += 1; }
				}
				if (V.farm_stage >= 5 && f.aggro) { f.aggro = 0; r.aggro = true; }
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
		} catch (e) { r.error = String(e.message || e); }
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
				if (typeof V.temple_quarters === "number") { V.temple_quarters = 100; r.quarters = true; }
			}
			if (V.tending >= 1000) {
				if (typeof V.temple_garden === "number") { V.temple_garden = 100; r.garden = true; }
			}
		} catch (e) { r.error = String(e.message || e); }
		return r;
	}
	function mcMaintainEden() {
		var V = getV();
		var r = { locked: 0, error: "" };
		try {
			/* 对齐 AutoClean：伊甸菜地/菇桶/泉水无条件锁 4 */
			["edengarden", "edenshrooms", "edenspring"].forEach(function (k) {
				if (typeof V[k] === "number") { V[k] = 4; r.locked += 1; }
			});
		} catch (e) { r.error = String(e.message || e); }
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
			if (typeof V.soap === "number" && V.soap < 10) { V.soap = 10; r.soap = true; }
			if (typeof V.salve === "number" && V.salve < 10) { V.salve = 10; r.salve = true; }
			if (V.bird && V.bird.upgrades && V.bird.upgrades.firepit >= 3 &&
				V.bird.materials && typeof V.bird.materials.wood === "number" && V.bird.materials.wood < 10) {
				V.bird.materials.wood = 10; r.wood = true;
			}
		} catch (e) { r.error = String(e.message || e); }
		return r;
	}
	function mcCleanMansion() {
		var V = getV();
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
					if (typeof man[k] === "number") { man[k] = 0; r.rooms += 1; }
				});
				if (typeof man.days_absent === "number") { man.days_absent = 0; r.days = true; }
			}
		} catch (e) { r.error = String(e.message || e); }
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
		} catch (e) { return { error: String(e.message || e) }; }
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
		catch (e) { return { ok: false, message: "执行失败：" + (e.message || e) }; }
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
