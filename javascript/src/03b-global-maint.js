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

