	/* 职责：言灵页第二批动作（贴吧「言灵分享：森林商店相关（0.5.6+）」87 / 90 / 92 楼）——
	   ① 眷属项圈一键戴上并锁（穿上 familiar collar 且 cursed=1，之后原版禁止脱下）
	   ② 绝望轮回全结局 + Trials of Faith 成就（$hcEndings 补齐 A-F/S，成就直写 currentSave）
	   ③ 清除催眠·好奇（delete $hypnosis_traits.devotion / $hypnosisTimers.devotion）
	   拆段原因：07i-yanling-actions.js 385/400，再加 3 个动作会破单段 400 行门禁（S1）。
	   全部走变量直写 + mbCE_wrote 留痕（yanling: 前缀，回退可查），不依赖原版文案。 */

	/* ① 眷属项圈（原版取证 DoL 0.5.12.13）：
	   · 定义 @139392-139426：index 40 / slot "neck" / name "familiar collar" / variable "collarfamiliar"
	     / type ["eerie","curious","enchanting"] / collared 1 / integrity 1000
	   · 安装点 <<neckwear 40>> = generalWear("neck", 40,…)（widget "neckwear" @198057）
	   · 锁死判据：$worn.neck.name is "familiar collar" and $worn.neck.cursed is 1
	     —— 换衣/脱衣在 @169245、@169373 直接 return true / 100（原版拒绝脱下）
	   · 版主原言灵还有一层：已 cursed 时 <<set $worn.neck.type.push("broken")>> + <<neckruined true>>
	     （@198062-198065 leash widget 的破损处理）——本实现按「未穿 → 穿上并锁」的常规路径，
	     已穿时只补 cursed，不强行造破损态（破损会让项圈耐久/描述变化，非玩家本意）。
	   与 leaf 变装同口径：setup 件必须深拷贝进 $worn，否则 clothesIndex(@16566855) 按
	   variable/modder 匹配时会把存档对象当原型，后续原版读写会错位。
	   边界：当前 neck 已是其它诅咒衣物 → 拒绝（原版禁止脱下，硬覆盖等于绕过保护）；原普通颈饰入柜。 */

	/* 共用小工具：$worn 是否可用 / 取衣物名 / 对象判定 / 诅咒锁判定（控制各动作函数的分支数） */
	function mbCEYanlingWornOk(V) {
		return !!(V && V.worn && typeof V.worn === "object");
	}
	function mbCEYanlingNameOf(x) {
		return (x && typeof x === "object" && x.name) ? String(x.name) : "";
	}
	function mbCEYanlingObj(x) {
		return (x && typeof x === "object") ? x : null;
	}
	function mbCEYanlingIsLocked(x) {
		return !!(x && x.cursed === 1);
	}

	/* 原颈饰入柜（可入柜时返回名字，否则空串）；独立小函数，控住主流程复杂度 */
	function mbCEYanlingNeckStash(V, cur) {
		try {
			var nm = mbCEYanlingNameOf(cur);
			if (!nm || nm === "naked" || mbCEYanlingWardrobeSkip(nm)) { return ""; }
			var w = mbCEYanlingWardrobePick(V);
			var arr = w ? mbCEYanlingWardrobeSlot(w, "neck") : null;
			var put = arr ? mbCEYanlingDeep(cur) : null;
			if (!put) { return ""; }
			put.mbCE_collarStored = 1;
			arr.push(put);
			return nm;
		} catch (e) { return ""; }
	}

	/* 已穿项圈但未锁：只补 cursed，不重穿（保留玩家原本的颜色/耐久） */
	function mbCEYanlingCollarRelock(cur) {
		var b0 = { name: cur.name, cursed: cur.cursed };
		cur.cursed = 1;
		mbCEYanlingTrace("collar_lock", b0, { name: "familiar collar", cursed: 1 });
		return { ok: true, msg: "已补锁：项圈原已穿着（未锁 → cursed=1，现在脱不掉了）" };
	}

	function mbCEYanlingCollarLock() {
		try {
			var V = getV();
			if (!mbCEYanlingWornOk(V)) { return { ok: false, msg: "存档变量不可用" }; }
			var hit = mbCEYanlingClothFind("familiar collar");
			if (!hit) { return { ok: false, msg: "服装表缺少 familiar collar（游戏版本低于 0.5.6 或 setup.clothes 未初始化）" }; }
			var cur = V.worn.neck;
			var nm = mbCEYanlingNameOf(cur);
			var locked = mbCEYanlingIsLocked(cur);
			if (nm === "familiar collar") {
				if (locked) { return { ok: true, msg: "已锁：当前穿的就是眷属项圈（cursed=1，原版禁止脱下）" }; }
				return mbCEYanlingCollarRelock(cur);
			}
			if (locked) { return { ok: false, msg: "当前颈饰是其它诅咒衣物（" + nm + "），原版禁止脱下；请先处理它再上项圈" }; }
			var stored = mbCEYanlingNeckStash(V, cur);
			var item = mbCEYanlingDeep(hit.item);
			if (!item) { return { ok: false, msg: "项圈复制失败" }; }
			var before = { name: nm, cursed: locked ? 1 : 0, stored: stored };
			item.cursed = 1;
			V.worn.neck = item;
			mbCEYanlingTrace("collar_lock", before, { name: "familiar collar", cursed: 1, stored: stored });
			var msg = "已戴上眷属项圈并锁死（cursed=1，原版换衣/脱衣判定会拒绝；要取下只能改存档或用同页留痕撤销）";
			if (stored) { msg += "；原颈饰 " + stored + " 已进衣柜"; }
			return { ok: true, msg: msg };
		} catch (e) { return { ok: false, msg: "项圈写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* ② 绝望轮回（Hopeless Cycle）全结局 + 成就：
	   · 结局数组 $hcEndings 的值域 A/B/C/D/E/F/S（原版画廊 @309419 显示 `x/7 Endings`，S 单独标金）
	   · 锁子甲 chain_tunic 解锁需求就是 `V.hcEndings?.includes("S")`（@141965 单件 requirements）
	   · Trials of Faith 成就定义 @103326，真结局授予点 @621081（<<tearup>><<earnFeat "Trials of Faith">>）
	   · 成就在作弊模式下会被原版 earnFeat 门控（V.cheatsEnabled===true 直接 return，@104773），
	     所以按 CE 既有先例（07l-vanilla-ext：博物馆成就）直写 `V.feats.currentSave[feat] = new Date()`
	   —— 只补结局与成就，不伪造当前正在进行的轮回进度（$hopelessCycle 系列状态键不动）。 */
	function mbCEYanlingHcFill(V, keys) {
		if (!Array.isArray(V.hcEndings)) { V.hcEndings = []; }
		var added = [];
		keys.forEach(function (k) { if (V.hcEndings.indexOf(k) === -1) { V.hcEndings.push(k); added.push(k); } });
		return added;
	}

	function mbCEYanlingFeatGrant(V, feat) {
		if (!V.feats || typeof V.feats !== "object") { V.feats = {}; }
		if (!V.feats.currentSave || typeof V.feats.currentSave !== "object") { V.feats.currentSave = {}; }
		if (V.feats.currentSave[feat] !== undefined) { return false; }
		V.feats.currentSave[feat] = new Date();
		return true;
	}

	function mbCEYanlingHopelessEndings() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var KEYS = ["A", "B", "C", "D", "E", "F", "S"];
			var FEAT = "Trials of Faith";
			var hadEndings = Array.isArray(V.hcEndings) ? V.hcEndings.slice() : V.hcEndings;
			var hadFeat = !!(V.feats && V.feats.currentSave && V.feats.currentSave[FEAT] !== undefined);
			var added = mbCEYanlingHcFill(V, KEYS);
			var featNew = mbCEYanlingFeatGrant(V, FEAT);
			mbCEYanlingTrace("hopeless_endings", { hcEndings: hadEndings, feat: hadFeat }, { hcEndings: KEYS.slice(), feat: FEAT });
			var msg = "绝望轮回结局：" + V.hcEndings.length + "/7";
			msg += added.length ? "（新增 " + added.join("") + "）" : "（已齐，无新增）";
			msg += featNew ? "；成就 Trials of Faith 已写入" : "；成就 Trials of Faith 原本已有（保留原时间）";
			return { ok: true, msg: msg };
		} catch (e) { return { ok: false, msg: "结局写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* ③ 清除催眠·好奇：
	   · 原帖 92 楼排障言灵 `[[清除好奇|$passage][delete $hypnosis_traits.devotion, delete $hypnosisTimers.devotion]]`
	   · 判据 @78543：hypnosisTraits 遍历时 `key === "devotion"` 且非「项圈已锁」时生效——
	     即 devotion 就是「好奇」条目；$hypnosisTimers 是对应计时器桶
	   · 只删这两个键，不动 suggestion / scream / cover / deviancy 等其它催眠特质与其计时器。 */
	function mbCEYanlingDelKey(obj, key) {
		if (!obj || typeof obj !== "object" || !(key in obj)) { return false; }
		delete obj[key];
		return true;
	}

	function mbCEYanlingClearCuriosity() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var traits = mbCEYanlingObj(V.hypnosis_traits);
			if (!traits) { return { ok: false, msg: "无 $hypnosis_traits（本档从未中过催眠）" }; }
			var tmr = mbCEYanlingObj(V.hypnosisTimers);
			var before = { trait: traits.devotion, timer: tmr ? tmr.devotion : undefined };
			var n = 0;
			if (mbCEYanlingDelKey(traits, "devotion")) { n += 1; }
			if (mbCEYanlingDelKey(tmr, "devotion")) { n += 1; }
			if (n) { mbCEYanlingTrace("clear_curiosity", before, { trait: undefined, timer: undefined }); }
			return { ok: true, msg: "已清除好奇（" + n + " 项：" + "$hypnosis_traits.devotion" + (n > 1 ? " + $hypnosisTimers.devotion" : "") + " 已删除）" };
		} catch (e) { return { ok: false, msg: "清除异常：" + mbCEYanlingErr(e) }; }
	}

	/* 贴吧第二批共用小工具（控制单函数复杂度，lint 棘轮只减不增） */
	function mbCEYanlingEnsureDailyGwylan(V) {
		var d = mbCEYanlingObj(V.daily);
		if (!d) { d = {}; V.daily = d; }
		var g = mbCEYanlingObj(d.gwylan);
		if (!g) { g = {}; d.gwylan = g; }
		return g;
	}
	function mbCEYanlingDeepOrEmpty(x) {
		return mbCEYanlingDeep(x) || {};
	}

	/* ============ 第二批（截图补遗）：仪式 / 渴望 / 委托 / 宠物床 / 计数 / 催眠 cd ============
	   全部按 DoL 0.5.12.13 原版行号复核（可复跑），对应 dol吧森林商店帖 7L / 8L / 11L / 12L / 15L / 17L。
	   原则同前：只在原版键已存在的档上写（未开线的档明确拒绝），不硬造存档垃圾键。 */

	/* ④ 格威岚 · 仪式冷却（7L「无限仪式」「仪式延期」）：
	   · $gwylan.timer.ritual 是时间戳；到点判据 Time.date.dayDifference(...) <= 0
	     —— 414891-414892 显示「还需 N 天」，否则 414899-414904 出现仪式入口；
	   · 完成一次后原版写 +7 天（398721 / 405614 / 414894）。
	   故「无限仪式」= 设为当前时刻（dayDifference 归 0，立即可再来）；
	   「仪式延期」= +7 天（与完成后的冷却同值）。 */
	function mbCEYanlingGwylanRitualAt(days, tag, okMsg) {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var t = V.gwylan && V.gwylan.timer;
			if (!t || typeof t !== "object" || t.ritual === undefined) {
				return { ok: false, msg: "本档尚未开启仪式线（$gwylan.timer.ritual 不存在），无冷却可改" };
			}
			var ts = mbCEYanlingDaysLater(days);
			if (ts === null) { return { ok: false, msg: "无法计算游戏内时间戳（DateTime / Time.date 不可用）" }; }
			var before = t.ritual;
			t.ritual = ts;
			mbCEYanlingTrace(tag, { ritual: before }, { ritual: ts });
			return { ok: true, msg: okMsg };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}
	function mbCEYanlingGwylanRitualReady() {
		return mbCEYanlingGwylanRitualAt(0, "gwylan_ritual_ready", "仪式冷却已清零（dayDifference=0，进森林商店即可再来一次）");
	}
	function mbCEYanlingGwylanRitualDelay() {
		return mbCEYanlingGwylanRitualAt(7, "gwylan_ritual_delay", "仪式已延后 7 天（与原版完成一次仪式后的冷却同值）");
	}

	/* ⑤ 格威岚 · 渴望拉满（8L「无比渴望 `$NPCName[7].corr += 150`」）：
	   原帖键在 0.5.12.13 已不存在——全库 `\.corr\b` 0 命中（NPC 对象改由 corruption 承载，
	   且 Gwylan 的 status 判定只读 dom / lust：71494-71541），照抄等于写死键；
	   故按现行 clamp 语义给等价「拉满」：lust 0-100、dom -50-150（345281-345282）。
	   dom 拉满会同时满足 partners 线门槛（414728：love>=80 + dom>=75 + dateCount.GwylanSex>=5 + sea>=5），
	   属玩家主动作弊预期，不做二次拦截。 */
	function mbCEYanlingGwylanDesire() {
		try {
			var npc = mbCEYanlingNpc("Gwylan");
			if (!npc || typeof npc !== "object") { return { ok: false, msg: "本存档无格威岚槽位" }; }
			if (npc.init === 0) { return { ok: false, msg: "格威岚尚未初始化（未相遇）" }; }
			var before = { lust: npc.lust, dom: npc.dom };
			npc.lust = 100;
			npc.dom = 150;
			mbCEYanlingTrace("gwylan_desire", before, { lust: 100, dom: 150 });
			return { ok: true, msg: "格威岚渴望已拉满（lust 100 / dom 150，均为原版 clamp 上限）。注：原帖 `$NPCName[7].corr` 键在当前 0.5.12.13 已不存在（corr 全库 0 命中），此处按现行 dom/lust 语义等价实现" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 委托 seed 递增（widget 393057-393060：0.001 步进、0.25-0.99 环） */
	function mbCEYanlingGwylanSeed(g) {
		if (!g || typeof g.requestSeed !== "number") { return; }
		g.requestSeed = ((g.requestSeed - 0.25 + 0.001) % (0.99 - 0.25)) + 0.25;
	}

	/* ⑥ 格威岚 · 完成当前委托（11L「完成任务」= 原版 widget `<<gwylanRequestEnd>>`）：
	   widget 定义 392995-393061：requestDone=true、requestCount++、daily.gwylan.request=true、
	   给 `$gwylan.timer[当前 event]` 写 +14 天（防同一事件立刻重刷）、timer.requestLast=now、
	   requestLast=旧 request 快照、request={}、requestSeed 递增。
	   与帖主提醒一致：跳过「金首饰」这类前置任务后，原版靠 timer[event] 冷却 + 保险逻辑仍会把必要物品补回，
	   本按钮只走同一语义，不额外发放物品。 */
	function mbCEYanlingGwylanRequestDone() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var g = V.gwylan;
			var req = g && g.request;
			if (!req || !req.event) { return { ok: false, msg: "当前没有进行中的委托（$gwylan.request.event 为空）" }; }
			var ev = String(req.event);
			var before = { event: ev, requestDone: g.requestDone, requestCount: g.requestCount };
			g.requestDone = true;
			g.requestCount = (typeof g.requestCount === "number" ? g.requestCount : 0) + 1;
			mbCEYanlingEnsureDailyGwylan(V).request = true;
			var t = mbCEYanlingObj(g.timer);
			if (!t) { t = {}; g.timer = t; }
			var cool = mbCEYanlingDaysLater(14);
			if (cool !== null) { t[ev] = cool; }
			var now = mbCEYanlingDaysLater(0);
			if (now !== null) { t.requestLast = now; }
			g.requestLast = mbCEYanlingDeepOrEmpty(req);
			g.request = {};
			mbCEYanlingGwylanSeed(g);
			mbCEYanlingTrace("gwylan_request_done", before, { event: ev, requestCount: g.requestCount });
			return { ok: true, msg: "已完成格威岚的委托「" + ev + "」（requestCount=" + g.requestCount + "，同事件 14 天内不再刷出）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* ⑦ 格威岚 · 宠物床续期（17L「宠物床」）：
	   · 到期键 $gwylan.timer.petBed，过关即被日结删除（78396）；
	   · 原版首次放出 / 续期都写 +7 天（392612 / 392632 / 392635）。
	   门控按 415091：需已解锁 partners 线，未解锁不提供（避免面板显示成功但森林商店不放床）。 */
	function mbCEYanlingGwylanPetBed() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var gw = mbCEYanlingObj(V.gwylan);
			var t = gw ? mbCEYanlingObj(gw.timer) : null;
			if (!t) { return { ok: false, msg: "本档尚未开启格威岚线（$gwylan.timer 不存在）" }; }
			var seen = Array.isArray(V.gwylanSeen) ? V.gwylanSeen : null;
			if (!seen || seen.indexOf("partners") === -1) {
				return { ok: false, msg: "尚未解锁伴侣线（$gwylanSeen 无 partners），原版不会提供宠物床（415091 门控）" };
			}
			var ts = mbCEYanlingDaysLater(7);
			if (ts === null) { return { ok: false, msg: "无法计算游戏内时间戳（DateTime / Time.date 不可用）" }; }
			var before = t.petBed;
			t.petBed = ts;
			mbCEYanlingTrace("gwylan_petbed", { petBed: before }, { petBed: ts });
			return { ok: true, msg: "宠物床已续 7 天（" + (before === undefined ? "首次放出" : "原到期时间 " + String(before)) + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* ⑧ 格威岚 · 看海 / 亲密仪式计数（15L）：
	   $gwylan.sea（383946-383948 每日首见 +1、384741 事件 +1；>=5 / >=10 参与解锁判定）
	   $dateCount.GwylanSex（405620 每次仪式 ++；414728 partners 门槛 >=5）。
	   两者都是累计计数、无上限，只在键已存在（已走过对应线）时累加。 */
	function mbCEYanlingGwylanSea() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var g = mbCEYanlingObj(V.gwylan);
			if (!g || typeof g.sea !== "number") {
				return { ok: false, msg: "本档无 $gwylan.sea（尚未与格威岚看海，不硬建键）" };
			}
			var before = g.sea;
			g.sea = before + 20;
			mbCEYanlingTrace("gwylan_sea", { sea: before }, { sea: g.sea });
			return { ok: true, msg: "看海次数 " + before + " → " + g.sea + "（原版 384348 / 414728 按 >=5 判定解锁线）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}
	function mbCEYanlingGwylanSex() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var dc = mbCEYanlingObj(V.dateCount);
			if (!dc || typeof dc.GwylanSex !== "number") {
				return { ok: false, msg: "本档无 $dateCount.GwylanSex（尚未完成过亲密仪式，不硬建键）" };
			}
			var before = dc.GwylanSex;
			dc.GwylanSex = before + 5;
			mbCEYanlingTrace("gwylan_sex", { count: before }, { count: dc.GwylanSex });
			return { ok: true, msg: "亲密仪式次数 " + before + " → " + dc.GwylanSex + "（414728 partners 门槛为 >=5）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* ⑨ 催眠 cd / 当天次数（12L 问答）：
	   · cd：每日衰减 78539-78558，devotion 桶要降到 gwylanHypnoMax("value", devotion-1) 才「可再来一次」
	     （表 169336-169353：level1 15 / 2 35 / 3 55 / 4 75 / 5 95 / 6 100）；帖主口径「满值-10」。
	   · 当天次数：文案分支读 $daily.gwylan.hypnosis（386337），结束催眠时置 true 并 unset $hypnosis_potency（389060）。 */
	function mbCEYanlingHypnoMaxFor(level) {
		var t = [15, 35, 55, 75, 95, 100];
		if (typeof level === "number" && level >= 1 && level <= 6) { return t[level - 1]; }
		return 0;
	}
	function mbCEYanlingHypnoLevel(V) {
		var tr = V.hypnosis_traits;
		return (tr && typeof tr.devotion === "number") ? tr.devotion : 0;
	}
	function mbCEYanlingHypnoBucket(V) {
		var tm = mbCEYanlingObj(V.hypnosisTimers);
		var dev = tm ? mbCEYanlingObj(tm.devotion) : null;
		return (dev && typeof dev.time === "number") ? dev : null;
	}
	function mbCEYanlingHypnoCd() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var lvl = mbCEYanlingHypnoLevel(V);
			if (lvl < 1) { return { ok: false, msg: "本档没有好奇特质（$hypnosis_traits.devotion 为空或 <1），无需重置催眠 cd" }; }
			var dev = mbCEYanlingHypnoBucket(V);
			if (!dev) { return { ok: false, msg: "本档无 $hypnosisTimers.devotion 计时桶（尚未进入过催眠 cd 结算）" }; }
			var max = mbCEYanlingHypnoMaxFor(lvl - 1);
			var target = Math.max(0, max - 10);
			var before = dev.time;
			dev.time = target;
			mbCEYanlingTrace("hypno_cd", { time: before, max: max }, { time: target });
			return { ok: true, msg: "催眠 cd 已重置（" + before + " → " + target + "，阈值 " + max + "-10；下次找格威岚即可继续）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}
	function mbCEYanlingHypnoDaily() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var cleared = [];
			var d = mbCEYanlingObj(V.daily);
			var g = d ? mbCEYanlingObj(d.gwylan) : null;
			if (g && "hypnosis" in g) { delete g.hypnosis; cleared.push("$daily.gwylan.hypnosis"); }
			if (V.hypnosis_potency !== undefined) { delete V.hypnosis_potency; cleared.push("$hypnosis_potency"); }
			if (!cleared.length) { return { ok: true, msg: "当天催眠次数本就是可用状态（无需刷新）" }; }
			mbCEYanlingTrace("hypno_daily", null, { cleared: cleared });
			return { ok: true, msg: "当天催眠次数已刷新（已清 " + cleared.join(" / ") + "）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}
