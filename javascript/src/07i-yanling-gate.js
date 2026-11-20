	/* 职责：言灵页（07i）剧情闸门与系统开关 —— 艾弗里办公室标记补开（含撤销）/ 作弊模式强制开关（含撤销），全部按原版写入语义直写并留痕。 */
	/* ==================== 剧情闸门（玩家给的 SugarCube 言灵片段，逐行取证后落地为按钮） ====================
	   原始片段：[[开启艾弗里办公室·补|$passage][$averySeen = ($averySeen ? $averySeen : new Array()).concat(String.fromCharCode(111,102,102,105,99,101))]]
	   （111,102,102,105,99,101 = "office"；语法层面 $x 一律展开成 State.variables.x、裸 = 原样保留，故该 setter 合法，
	     但 concat 不去重 —— 重复点会不断累积同值元素，本页改用原版的 pushUnique 语义。）

	   原版取证（DoL 0.5.12.13，行号可复跑）：
	     · $averySeen 初始化 <<set $averySeen to []>>（190600 / 299285）；原版唯一写入方式是
	       <<set $averySeen.pushUnique("office")>>（791859，Avery Office Manager 信件交付线结尾）
	       与 pushUnique("officeAssistant")（791914）。
	     · 读取闸门一：71279 `const workAvailable = V.averySeen?.includes("office") && !V.avery_injury;`
	       命中即 71280 `T.avery_available = "office"`（Avery 排班把 PC 当可打工对象）。
	     · 读取闸门二：623696 / 623857 办公室板块
	       `$averySeen?.includes("office") and C.npc.Avery.state isnot "dismissed"` → 623698
	       [[Work as Avery's Personal Assistant|Avery Office Assistant]]。623852 的「便利贴」分支只在**未**解锁时出现，
	       补标记后自然不再刷。
	     · 仍不伪造的前置：71275 averySchedule 首行 `if (C.npc.Avery.init !== 1 || state === "dismissed") return;`
	       —— Avery 必须已 init、未被驱逐；$avery_injury 为真时打工入口同样不出现。
	     · 语义结论：只补 "office" 一项即等价于走完信件交付线，够开「个人助理」打工入口。 */

	/* 读 averySeen 数组形态：undefined → 视为空；非数组 → 视为存档异常（调用方需拒绝写入） */
	function mbCEYanlingAveryArr(V, create) {
		var cur = V.averySeen;
		if (cur === undefined || cur === null) {
			if (!create) { return null; }
			V.averySeen = [];
			return V.averySeen;
		}
		if (typeof cur !== "object" || typeof cur.indexOf !== "function" || typeof cur.splice !== "function") { return null; }
		return cur;
	}

	function mbCEYanlingAveryOffice() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var cur = V.averySeen;
			if (cur !== undefined && cur !== null && mbCEYanlingAveryArr(V, false) === null) {
				return { ok: false, msg: "$averySeen 不是数组（存档结构异常），拒绝写入" };
			}
			var before = { averySeen: mbCEYanlingAveryArr(V, false) ? V.averySeen.slice() : cur };
			var arr = mbCEYanlingAveryArr(V, true);
			var added = 0;
			if (arr.indexOf("office") === -1) { arr.push("office"); added = 1; }
			/* 留痕只记首次：重复点「补上标记」不覆盖最初原态，撤销总能回到「没补之前」 */
			mbCEYanlingTraceKeep("avery_office", before, { averySeen: arr.slice(), added: added });
			return { ok: true, msg: added ? "已补上「办公室」标记（艾弗里个人助理的打工入口已开）" : "「办公室」标记已存在，无需重复写入" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	/* 撤销：优先按留痕还原（原本不存在 → delete 而非写空数组）；无留痕时只移除 office 标记 */
	function mbCEYanlingAveryOfficeRevert() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var rec = V.mbCE_wrote ? V.mbCE_wrote["yanling:avery_office"] : null;
			var b = rec ? rec.before : null;
			if (b) {
				if (b.averySeen === undefined) {
					mbCEYanlingRestoreKey(V, "averySeen", undefined);
					return { ok: true, msg: "已撤销：$averySeen 原本不存在，已删除该键" };
				}
				V.averySeen = (typeof b.averySeen.slice === "function") ? b.averySeen.slice() : b.averySeen;
				return { ok: true, msg: "已撤销：$averySeen 已还原为点击前的状态" };
			}
			var arr = mbCEYanlingAveryArr(V, false);
			if (arr && arr.indexOf("office") !== -1) {
				arr.splice(arr.indexOf("office"), 1);
				return { ok: true, msg: "没有留痕，已按移除「办公室」标记处理" };
			}
			return { ok: false, msg: "既无留痕也没有「办公室」标记，无需撤销" };
		} catch (e) { return { ok: false, msg: "撤销异常：" + mbCEYanlingErr(e) }; }
	}

	/* ==================== 作弊模式（无副作用开启） ====================
	   原版取证（DoL 0.5.12.13 编译后 HTML，字符偏移可复跑）：
	     · 总开关 $cheatsEnabled：16643707 在存档 schema 里；181705（选项页）`<<if $cheatsEnabled is true>>` 才出现作弊面板；
	       20092753-20092972 特殊衣物 `V.settings && !V.settings?.cheatsEnabled` 走作弊解锁分支。
	     · 成就被禁的真正原因只有两处 JS：17711597 `earnFeat()`、17713441 `earnHourlyFeats()` 首行
	       `if (... V.feats.locked || V.cheatsEnabled === true ...) return;` —— 与 $feats.locked 无关。
	     · 三处 Twee 会把 $feats.locked 写成 true：19883946（新角色页）、19994082（旧档迁移）、28096917（选项页退出链），
	       三处都以 `$cheatsEnabled is true` 为条件，所以「不写 locked」不够，换页后必须复原。
	   本页开启 = $cheatsEnabled=true + 不写 $feats.locked + 给两个 earn* 装豁免钩子（调用期间临时把 cheatsEnabled
	   视为 false，结束后原样还原）+ 换页兜底把 locked 复原为 false。关闭 = 按留痕还原并关掉钩子开关；
   包装函数保留但空转，不覆盖别家 mod 的包装。旧档兼容键 $cheatdisable 只在迁移时读一次并随即 delete，本页不写。 */
	/* 成就对象取用：$feats 必须是对象（数组视为异常），统一在一处判定，避免各按钮重复三重条件 */
	function mbCEYanlingFeatsObj(V) {
		var f = V.feats;
		if (!f || typeof f !== "object" || Array.isArray(f)) { return null; }
		return f;
	}

	/* 豁免执行：原函数调用期间屏蔽 cheatsEnabled / locked 两个门槛，结束后按原值还原（同步执行，不落档）。
	   原版两个 earn* 都是全局函数、不依赖 this，这里以 null 作接收者调用，避免 checkJs 的隐式 this 类型债。 */
	function mbCEYanlingFeatPass(V, orig, args) {
		var f = mbCEYanlingFeatsObj(V);
		var savedC = V.cheatsEnabled;
		var savedL = f ? f.locked : undefined;
		V.cheatsEnabled = false;
		if (f) { f.locked = false; }
		try { return orig.apply(null, args); }
		finally {
			V.cheatsEnabled = savedC;
			if (f) { mbCEYanlingRestoreKey(f, "locked", savedL); }
		}
	}

	/* 包装只装一次：已在豁免态则直通原函数，未开启豁免则空转，避免覆盖别家 mod 的同类包装 */
	function mbCEYanlingFeatWrap(w, key) {
		if (!w || typeof w[key] !== "function" || w[key].__mceGuard === true) { return false; }
		var orig = w[key];
		/** @type {any} */
		var wrapped = function () {
			var V = getV();
			if (!V || V.mbCE_cheatGuard !== true) { return orig.apply(null, arguments); }
			return mbCEYanlingFeatPass(V, orig, arguments);
		};
		wrapped.__mceGuard = true;
		w[key] = wrapped;
		return true;
	}

	/* 换页兜底：三处原版 Twee 在 cheatsEnabled 为真时会把 locked 写 true，这里每次换页复原 */
	function mbCEYanlingCheatTick() {
		try {
			var V = getV();
			if (!V || V.mbCE_cheatGuard !== true) { return; }
			var f = mbCEYanlingFeatsObj(V);
			if (f && f.locked === true) { f.locked = false; }
		} catch (e) { void e; }
	}

	function mbCEYanlingFeatGuardOn() {
		var ok = false;
		try {
			var w = (typeof window !== "undefined") ? window : null;
			ok = mbCEYanlingFeatWrap(w, "earnFeat") || ok;
			mbCEYanlingFeatWrap(w, "earnHourlyFeats");
		} catch (e) { void e; }
		try {
			if (typeof $ === "function" && typeof document !== "undefined") {
				$(document).off(":passageend.mceCheatGuard").on(":passageend.mceCheatGuard", mbCEYanlingCheatTick);
			}
		} catch (e) { void e; }
		return ok;
	}

	function mbCEYanlingFeatGuardOff() {
		try {
			if (typeof $ === "function" && typeof document !== "undefined") { $(document).off(":passageend.mceCheatGuard"); }
		} catch (e) { void e; }
	}

	/* 读档 / 刷新后恢复豁免：改的是存档标记 V.mbCE_cheatGuard，钩子本身不落档，必须每次启动重装 */
	function mbCEYanlingCheatBoot() {
		try {
			var V = getV();
			if (!V || V.mbCE_cheatGuard !== true) { return false; }
			mbCEYanlingCheatTick();
			mbCEYanlingFeatGuardOn();
			return true;
		} catch (e) { return false; }
	}

	function mbCEYanlingCheatOn() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var feats = mbCEYanlingFeatsObj(V);
			var before = { cheatsEnabled: V.cheatsEnabled, hasFeats: !!feats, featsLocked: feats ? feats.locked : undefined };
			V.cheatsEnabled = true;
			V.mbCE_cheatGuard = true;
			var f = mbCEYanlingFeatsObj(V);
			if (f && f.locked === true) { f.locked = false; }
			mbCEYanlingFeatGuardOn();
			mbCEYanlingTraceKeep("cheat_on", before, { cheatsEnabled: true, featsLocked: f ? f.locked : null, guard: true });
			return { ok: true, msg: "作弊已开启（无副作用）：作弊面板解锁、特殊衣物进作弊解锁分支，成就照常可拿" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	function mbCEYanlingCheatOff() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var rec = V.mbCE_wrote ? V.mbCE_wrote["yanling:cheat_on"] : null;
			var b = rec ? rec.before : null;
			mbCEYanlingRestoreKey(V, "mbCE_cheatGuard", undefined);
			mbCEYanlingFeatGuardOff();
			if (!b) {
				V.cheatsEnabled = false;
				return { ok: true, msg: "没有留痕，已按关闭作弊处理（成就豁免同步停用）" };
			}
			mbCEYanlingRestoreKey(V, "cheatsEnabled", b.cheatsEnabled);
			if (b.hasFeats) {
				var featsB = mbCEYanlingFeatsObj(V);
				if (featsB) { mbCEYanlingRestoreKey(featsB, "locked", b.featsLocked); }
			}
			return { ok: true, msg: "已撤销：作弊开关与成就锁按点击前原态还原" };
		} catch (e) { return { ok: false, msg: "撤销异常：" + mbCEYanlingErr(e) }; }
	}


