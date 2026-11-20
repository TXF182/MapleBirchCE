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

	/* ==================== 作弊模式强制开启 ====================
	   原版取证（DoL 0.5.12.13）：
	     · 总开关 $cheatsEnabled：29886 `V.debug || V.cheatsEnabled === true`、181705 `<<if $cheatsEnabled is true>>`、
	       324728 重置设置写 false；设置页字段 73894 `cheatsEnabled: { bool: true, displayName: "Cheat mode:" }`，
	       映射 73287 `cheatdisabletoggle: { key: "cheatsEnabledToggle", invert: true }`。
	     · 设置页退出链 325164-325171：`$cheatsEnabled to $settings.cheatsEnabledToggle` → 若为 true 则 `$feats.locked to true`
	       → `<<unset $settings.cheatsEnabledToggle>>`（该键是页面级临时量，不落档，所以本页不写它）。
	     · 副作用实证：325048「Enabled cheats: disables all feats.」、104773 / 104843 `earnFeat` 在
	       `V.cheatsEnabled === true` 时直接 return —— 作弊与成就是互斥的，本页照此同步锁成就；
	       想继续拿成就用同页「解除成就限制」单独放开，两个按钮互不覆盖。
	     · 旧档兼容键 $cheatdisable 只在迁移时读一次并随即 delete（188395-188398），不再写它。 */
	/* 成就对象取用：$feats 必须是对象（数组视为异常），统一在一处判定，避免各按钮重复三重条件 */
	function mbCEYanlingFeatsObj(V) {
		var f = V.feats;
		if (!f || typeof f !== "object" || Array.isArray(f)) { return null; }
		return f;
	}

	function mbCEYanlingCheatOn() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var feats = mbCEYanlingFeatsObj(V);
			var before = { cheatsEnabled: V.cheatsEnabled, hasFeats: !!feats, featsLocked: feats ? feats.locked : undefined };
			V.cheatsEnabled = true;
			if (feats && feats.locked !== true) { feats.locked = true; }
			mbCEYanlingTraceKeep("cheat_on", before, { cheatsEnabled: true, featsLocked: feats ? feats.locked : null });
			return { ok: true, msg: "作弊模式已强制开启（原版作弊面板解锁；成就已按原版语义锁定，可用「解除成就限制」放开）" };
		} catch (e) { return { ok: false, msg: "写入异常：" + mbCEYanlingErr(e) }; }
	}

	function mbCEYanlingCheatOff() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var rec = V.mbCE_wrote ? V.mbCE_wrote["yanling:cheat_on"] : null;
			var b = rec ? rec.before : null;
			if (!b) {
				V.cheatsEnabled = false;
				var featsA = mbCEYanlingFeatsObj(V);
				if (featsA) { featsA.locked = false; }
				return { ok: true, msg: "没有留痕，已按关闭作弊 + 解除成就锁处理" };
			}
			mbCEYanlingRestoreKey(V, "cheatsEnabled", b.cheatsEnabled);
			if (b.hasFeats) {
				var featsB = mbCEYanlingFeatsObj(V);
				if (featsB) { mbCEYanlingRestoreKey(featsB, "locked", b.featsLocked); }
			}
			return { ok: true, msg: "已撤销：作弊模式按原态还原，成就锁同步还原" };
		} catch (e) { return { ok: false, msg: "撤销异常：" + mbCEYanlingErr(e) }; }
	}


