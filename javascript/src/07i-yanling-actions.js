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

