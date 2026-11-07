	/* ============ 言灵页（v2.0.0.006）：NPC 无视着装性别 / 异装残留净化 / 负面名声清零 ============
	   诉求（好友走全正面线）：给 PC 穿好看的异性服装，不触发异装判定、不涨异装癖、不产生学校异装负面名声。

	   实现依据（DoL 0.5.12.13 逐行取证，均可复跑核对）：
	     ① 判定入口 isCrossdressing() 72520-72536：
	        getVisibleClothesList().some(item => ["f","m"].includes(item.gender) && item.gender !== V.player.sex
	        && item.gender === V.player.gender_appearance) && !isGenitalMismatch()
	        末尾 `window.isCrossdressing = isCrossdressing;` → 本页据此做运行期覆盖（幂等、可重装、可卸载）。
	        作用域实证：声明位于 SugarCube <script>（twine-user-script，最近 <script> 起点 68457）编译域内，
	        函数声明不泄漏到全局词法作用域，所以两处调用路径都必须经 window 才够得着本函数。
	        全文 49 行命中 isCrossdressing：twee 侧 45 处 `<<if / <<elseif isCrossdressing()>>`、
	        JS 内裸调用仅 1 处（isHermOrCrossdresser 72548）、其余 3 行为声明与注释。
	        （314549 / 314554 的「裸调用」其实是 <<switch>> 内事件文本里的 SugarCube `is` 语法，不是 JS 调用。）
	        覆盖 window 即覆盖 45 处 twee 判定；72548 保持原版 herm / 外观语义（见下 ④ 与面板边界 ①）。
	     ② 唯一总开关是 $crossdressing 变量，写入点 crossdressing_check 242916-242924：
	        penisExist && vaginaExist → 2；elseif isCrossdressing() → 1；else → 0。
	     ③ 下游全部读 $crossdressing，拦截 isCrossdressing() 使其恒为 0 即全链断开：
	        - 战斗 man widget 243068-243069：$crossdressing gte 1 → exposedcheck + schoolrep_naked
	        - schoolrep_naked 346684-346700：isCrossdressing() → schoolrep crossdress 1（学校负面名声）
	        - 异装癖累积 243201-243208：crossdress 分支内 $crossdressingTrait += 1，满 100 pushUnique("crossdresser")
	        - 换衣间 changingRoomFeelings 668274-668300「You feel naughty.」等 twee 侧 45 处判定点全部经 window 求值
	     ④ 与压力循环解耦：77866-77870 用本地 const isCrossdressing（源码注释明确「不复用函数」，
	        因压力增减不该随 NudeGenderDC 变），故本页拦截不改变 stress 语义。
	     ⑤ 学校名声存量：schoolrep 346656-346682（仅 crossdress / herm 两键）
	        + 文案 V.school_crossdress_message 163371-163391 + 提示 77378 → 清零需一并删文案。
	     ⑥ 城镇名声：V.fame 键取自 306912-306928（sex / prostitution / rape / bestiality / pregnancy /
	        impreg / exhibitionism / scrap / good / business / social / model，另注释保留 pimp），
	        V.fameDecay / V.fameDecayTimer 为衰减队列（77558-77564），清零须同步删队列项。

	   CheatExtend 1.1.3 的「言灵」是 TweeReplacer 对原版 Cheats 面板 widget 的**整块文本替换**，
	   原版文案一改 findString 即失效（用户「时间太久了、有些已不适用」的根因）。
	   本页改为 JS 层运行期钩子 + 变量直写，不依赖任何原版文案，版本升级不会静默失效。 */

	var mbCEYanlingFameNeg = ["sex", "prostitution", "rape", "bestiality", "pregnancy", "impreg", "exhibitionism", "pimp"];

	function mbCEYanlingState() {
		try {
			var V = getV();
			if (!V) { return null; }
			if (!V.mbCE_yanling || typeof V.mbCE_yanling !== "object") {
				V.mbCE_yanling = { noCross: false, noTrait: false };
			}
			V.mbCE_yanling.noCross = V.mbCE_yanling.noCross === true;
			V.mbCE_yanling.noTrait = V.mbCE_yanling.noTrait === true;
			return V.mbCE_yanling;
		} catch (e) { return null; }
	}
	/* 只读状态：isCrossdressing() 每秒被高频调用，绝不能在未启用时创建存档变量 */
	function mbCEYanlingRead() {
		try {
			var V = getV();
			if (!V || !V.mbCE_yanling || typeof V.mbCE_yanling !== "object") { return null; }
			return V.mbCE_yanling;
		} catch (e) { return null; }
	}
	function mbCEYanlingNoCross() {
		var s = mbCEYanlingRead();
		/* 严格比较：手改存档写进字符串 "false" 时不能被真值判定当成开启 */
		return !!(s && s.noCross === true);
	}
	function mbCEYanlingTrace(op, before, after) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote["yanling:" + op] = { type: "yanling", modId: "vanilla", op: op, before: before, after: after, t: Date.now() };
		} catch (e) {}
	}

	/* 运行期覆盖 window.isCrossdressing（幂等）：已装则跳过；被第三方重包则以新函数为上游重新包裹。
	   钩子内部每次调用都现读 V.mbCE_yanling.noCross —— 读档前装、读档后同样生效。
	   上游函数单独保存：关闭开关时可原样还原（见 mbCEYanlingUninstall）。 */
	var mbCEYanlingHookFn = null;
	var mbCEYanlingUpstream = null;
	function mbCEYanlingInstall() {
		try {
			if (typeof window === "undefined") { return false; }
			var cur = window.isCrossdressing;
			if (typeof cur !== "function") { return false; }
			if (cur === mbCEYanlingHookFn) { return true; }
			var upstream = cur;
			mbCEYanlingUpstream = upstream;
			mbCEYanlingHookFn = function () {
				try {
					if (mbCEYanlingNoCross()) { return false; }
				} catch (e) {}
				return upstream.apply(this, arguments);
			};
			window.isCrossdressing = mbCEYanlingHookFn;
			return true;
		} catch (e) { return false; }
	}
	/* 卸载：只在 window 上仍是本页钩子时还原上游，绝不覆盖已被第三方替换的函数。
	   意义有二：① 关闭开关后不留无谓包装层；② 若第三方把本页钩子当上游包进自己的链，
	   关闭时拆掉最外层即可断开，避免「我方→第三方→我方」无限递归。 */
	function mbCEYanlingUninstall() {
		try {
			if (typeof window === "undefined") { return false; }
			if (!mbCEYanlingHookFn) { return true; }
			if (window.isCrossdressing === mbCEYanlingHookFn && typeof mbCEYanlingUpstream === "function") {
				window.isCrossdressing = mbCEYanlingUpstream;
			}
			mbCEYanlingHookFn = null;
			mbCEYanlingUpstream = null;
			return true;
		} catch (e) { return false; }
	}
	/* 按开关状态同步钩子：开 → 挂，关 → 卸载。所有自动路径（tick / 定时器 / 面板）只用它，
	   不直接调 Install，否则「关闭状态也挂着钩子」，与 Uninstall 语义冲突。 */
	function mbCEYanlingSync() {
		if (mbCEYanlingNoCross()) { return mbCEYanlingInstall(); }
		mbCEYanlingUninstall();
		return true;
	}

	/* 存量净化：$crossdressing / 学校异装名声 / 学校异装文案 */
	function mbCEYanlingPurgeCross() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = {
				crossdressing: V.crossdressing,
				schoolrep: (V.schoolrep && typeof V.schoolrep === "object") ? V.schoolrep.crossdress : undefined,
				message: V.school_crossdress_message
			};
			if (typeof V.crossdressing === "number" && V.crossdressing !== 0) { V.crossdressing = 0; }
			if (V.schoolrep && typeof V.schoolrep === "object" && V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; }
			if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			mbCEYanlingTrace("purge_cross", before, { crossdressing: 0, schoolrep: 0, message: null });
			return { ok: true, msg: "已清空异装判定与学校异装名声" };
		} catch (e) { return { ok: false, msg: "净化异常：" + (e && e.message ? e.message : e) }; }
	}
	/* 存量净化：异装癖进度 + crossdresser 背景特质 */
	function mbCEYanlingPurgeTrait() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { trait: V.crossdressingTrait, has: false };
			var arr = V.backgroundTraits;
			if (arr && typeof arr.indexOf === "function") { before.has = arr.indexOf("crossdresser") !== -1; }
			if (typeof V.crossdressingTrait === "number" && V.crossdressingTrait !== 0) { V.crossdressingTrait = 0; }
			if (arr && typeof arr.indexOf === "function") {
				var i = arr.indexOf("crossdresser");
				while (i !== -1) { arr.splice(i, 1); i = arr.indexOf("crossdresser"); }
			} else if (arr && typeof arr.delete === "function") {
				arr.delete("crossdresser");
			}
			mbCEYanlingTrace("purge_trait", before, { trait: 0, has: false });
			return { ok: true, msg: "已清空异装癖进度并移除 Crossdresser 特质" };
		} catch (e) { return { ok: false, msg: "净化异常：" + (e && e.message ? e.message : e) }; }
	}
	/* 负面名声清零：学校 crossdress / herm 双键 + 学校文案 + 城镇 fame 负面项与衰减队列 */
	function mbCEYanlingPurgeFame() {
		try {
			var V = getV();
			if (!V) { return { ok: false, msg: "存档变量不可用" }; }
			var before = { schoolrep: {}, fame: {} }, n = 0, ns = 0, k;
			if (V.schoolrep && typeof V.schoolrep === "object") {
				before.schoolrep = { crossdress: V.schoolrep.crossdress, herm: V.schoolrep.herm };
				if (V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; ns++; }
				if (V.schoolrep.herm !== 0) { V.schoolrep.herm = 0; ns++; }
			}
			if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			if (V.school_herm_message !== undefined) { delete V.school_herm_message; }
			for (var i = 0; i < mbCEYanlingFameNeg.length; i++) {
				k = mbCEYanlingFameNeg[i];
				if (V.fame && typeof V.fame === "object" && typeof V.fame[k] === "number" && V.fame[k] !== 0) {
					before.fame[k] = V.fame[k];
					V.fame[k] = 0;
					n++;
				}
				if (V.fameDecay && typeof V.fameDecay === "object" && V.fameDecay[k] !== undefined) { delete V.fameDecay[k]; }
				if (V.fameDecayTimer && typeof V.fameDecayTimer === "object" && V.fameDecayTimer[k] !== undefined) { delete V.fameDecayTimer[k]; }
			}
			mbCEYanlingTrace("purge_fame", before, { cleared: n });
			return { ok: true, msg: "负面名声已清零（学校 " + ns + " 项 + 城镇 " + n + " 项）" };
		} catch (e) { return { ok: false, msg: "净化异常：" + (e && e.message ? e.message : e) }; }
	}

	/* 守卫：开关开启期间每秒把存量压回 0（防读档后残留、防战斗/舞蹈中途恢复判定）。
	   全部包在 try 内 —— 回调里的任何异常都不能每秒抛一次（见 ui-tick-refresh-scope-guard）。 */
	function mbCEYanlingTick() {
		try {
			var st = mbCEYanlingRead();
			if (!st || (st.noCross !== true && st.noTrait !== true)) {
				/* 两个开关都未开启：立即停表。守卫定时器不该在没人用时空转
				   （Node/jsdom 里常驻 interval 会阻止进程退出，冒烟测试将永远不返回）。 */
				if (mbCEYanlingTimer) { clearInterval(mbCEYanlingTimer); mbCEYanlingTimer = null; }
				return;
			}
			mbCEYanlingSync();
			var V = getV();
			if (!V) { return; }
			if (st.noCross === true) {
				if (typeof V.crossdressing === "number" && V.crossdressing !== 0) { V.crossdressing = 0; }
				if (V.schoolrep && typeof V.schoolrep === "object" && typeof V.schoolrep.crossdress === "number" && V.schoolrep.crossdress !== 0) { V.schoolrep.crossdress = 0; }
				if (V.school_crossdress_message !== undefined) { delete V.school_crossdress_message; }
			}
			if (st.noTrait === true) {
				if (typeof V.crossdressingTrait === "number" && V.crossdressingTrait !== 0) { V.crossdressingTrait = 0; }
				var arr = V.backgroundTraits;
				if (arr && typeof arr.indexOf === "function" && arr.indexOf("crossdresser") !== -1) { arr.splice(arr.indexOf("crossdresser"), 1); }
			}
		} catch (e) {}
	}
	var mbCEYanlingTimer = null;
	function mbCEYanlingEnsureTimer() {
		try {
			/* 只有开关真的开着才起表：没人用时不占事件循环（浏览器里也省一个空转 1s 定时器） */
			var st = mbCEYanlingRead();
			mbCEYanlingSync();
			if (!st || (st.noCross !== true && st.noTrait !== true)) { return; }
			if (mbCEYanlingTimer || typeof setInterval !== "function") { return; }
			mbCEYanlingTimer = setInterval(mbCEYanlingTick, 1000);
			/* Node/jsdom：unref 让守卫定时器不阻止进程退出（浏览器 interval 是数字，没有 unref） */
			try { if (mbCEYanlingTimer && typeof mbCEYanlingTimer.unref === "function") { mbCEYanlingTimer.unref(); } } catch (eU) {}
		} catch (e) {}
	}

	/* 开关动作（写状态 + 立即执行一次 + 留痕） */
	function mbCEYanlingToggle(field) {
		try {
			/* 白名单：本函数对外暴露在 mountApi 上，控制台误传字段会往存档里写垃圾键 */
			if (field !== "noCross" && field !== "noTrait") { return { ok: false, msg: "未知开关：" + String(field) }; }
			var st = mbCEYanlingState();
			if (!st) { return { ok: false, msg: "存档变量不可用" }; }
			var on = !st[field];
			st[field] = on;
			mbCEYanlingEnsureTimer();
			if (field === "noCross") {
				mbCEYanlingSync();
				if (on) { mbCEYanlingPurgeCross(); }
			}
			if (field === "noTrait" && on) { mbCEYanlingPurgeTrait(); }
			mbCEYanlingTrace("toggle_" + field, !on, on);
			var label = field === "noCross" ? "无视着装性别" : "压制异装癖";
			return { ok: true, msg: label + (on ? " 已开启" : " 已关闭") };
		} catch (e) { return { ok: false, msg: "切换异常：" + (e && e.message ? e.message : e) }; }
	}

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

	/* 渲染：言灵页（7 号外层页签） */
	function renderYanling() {
		try {
			mbCEYanlingEnsureTimer();
			var pane = root ? root.querySelector('[data-pane="yanling"]') : null;
			if (!pane) { return; }
			/* 重建面板前记住滚动位置：点开关后整页重渲染，不能让玩家每点一次都跳回顶端 */
			var scroller = null, keepTop = 0;
			try { scroller = pane.closest ? pane.closest(".mce-body") : null; keepTop = scroller ? scroller.scrollTop : 0; } catch (eS) {}
			pane.textContent = "";
			var V = getV();
			var st = mbCEYanlingState();
			var hooked = !!(mbCEYanlingHookFn && typeof window !== "undefined" && window.isCrossdressing === mbCEYanlingHookFn);

			var mkStatus = function (sec, on, onText, offText) {
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", "当前状态："));
				row.appendChild(el("span", "mce-value", on ? onText : offText));
				sec.appendChild(row);
			};
			var mkBtn = function (sec, text, cls, fn, tip) {
				var isGrid = !!(sec && sec.classList && sec.classList.contains("mce-btn-grid"));
				var b = el("button", "mce-btn " + (cls || ""), text);
				b.type = "button";
				if (tip) { b.title = tip; }
				b.addEventListener("click", function () {
					var r = fn();
					if (r && r.msg) { setStatus(r.msg, r.ok ? "mce-ok" : "mce-err"); }
					mbCEFlashRow(b);
					renderYanling();
				});
				if (isGrid) {
					/* v2.0.2 按键排版：网格容器内不再套一层 mce-row（每格直接一个按钮） */
					sec.appendChild(b);
				} else {
					var row = el("div", "mce-row");
					row.appendChild(b);
					sec.appendChild(row);
				}
				return b;
			};

			/* ==== v2.0.2 按键重排：8 个平铺区块 → 3 个语义分组 + 统一编号（①~⑧）+ 2 列按钮网格 ====
			   旧版把"说明与边界"塞在第 4 位却排在最后、区块顺序 s1→s2→s3→s5→s6→s7→s8→s4，编号与文案里的 ①②③ 完全脱节；
			   现在按「玩家要解决什么问题」分组：着装与名声（想穿什么就穿什么）/ 身体与数值（把状态拉回舒服）/
			   角色状态（把碍事的 NPC 挪开），说明统一收进最底折叠块。 */
			var gA = mceNewGroup(pane, "A · 着装与名声", "异装判定 / 性癖特质 / 负面名声");
			var gB = mceNewGroup(pane, "B · 身体与数值", "衣物湿度与耐久 / 体液与精神 / 快补数值 / 天气");
			var gC = mceNewGroup(pane, "C · 角色状态", "放逐 / 囚禁（原版 state 层）");

			/* ① 核心：无性别着装 */
			var s1 = mceNewSec(gA, 1, "无视着装性别", "开启后 NPC 不再按服装标注性别判定异装：穿异性服装不触发异装判定、不涨异装癖、不产生学校异装名声，换衣间也不再出现「naughty」类文案。判定在 JS 层覆盖 isCrossdressing()，$crossdressing 恒为 0，版本升级不会像文本替换那样静默失效。");
			mkStatus(s1, st && st.noCross, "已开启", "未开启");
			var row1 = el("div", "mce-row");
			var b1 = el("button", "mce-btn " + (st && st.noCross ? "mce-red" : "mce-gold"), st && st.noCross ? "关闭（恢复原版判定）" : "开启");
			b1.type = "button";
			b1.addEventListener("click", function () {
				var r = mbCEYanlingToggle("noCross");
				setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
				mbCEFlashRow(b1);
				renderYanling();
			});
			row1.appendChild(b1);
			s1.appendChild(row1);
			var diag = el("div", "mce-row");
			diag.appendChild(el("span", "mce-row-lbl", "运行时诊断："));
			var hookedTxt = hooked ? "钩子已挂载" : ((st && st.noCross === true) ? "钩子未挂载（游戏脚本未就绪或已被重载）" : "未启用（开关关闭时不挂钩子）");
			diag.appendChild(el("span", "mce-value", hookedTxt + " ｜ $crossdressing = " + (V && V.crossdressing !== undefined ? String(V.crossdressing) : "—")));
			s1.appendChild(diag);

			/* ② 异装癖（crossdresser 特质） */
			var s2 = mceNewSec(gA, 2, "异装癖压制", "异装癖累积点在异装分支内（243201-243208：$crossdressingTrait 满 100 → 背景特质 crossdresser）。开启「无视着装性别」后不再累积；本组额外把存量进度与已获得的特质清掉，并可按秒压制（读档后同样生效）。");
			var hasTrait = false;
			try {
				var bt = V && V.backgroundTraits;
				hasTrait = !!(bt && typeof bt.indexOf === "function" && bt.indexOf("crossdresser") !== -1);
			} catch (e0) {}
			var tRow = el("div", "mce-row");
			tRow.appendChild(el("span", "mce-row-lbl", "当前：进度 " + (V && typeof V.crossdressingTrait === "number" ? String(V.crossdressingTrait) : "0") + "/100，特质 "));
			tRow.appendChild(el("span", "mce-value", hasTrait ? "已获得（可按下方按钮移除）" : "未获得"));
			s2.appendChild(tRow);
			mkStatus(s2, st && st.noTrait, "压制中（每秒压回 0）", "未压制");
			mkBtn(s2, "立即清空进度 + 移除特质", "mce-gold", mbCEYanlingPurgeTrait, "清空 $crossdressingTrait 并从 $backgroundTraits 移除 crossdresser");
			var rowT = el("div", "mce-row");
			var bT = el("button", "mce-btn " + (st && st.noTrait ? "mce-red" : ""), st && st.noTrait ? "停止压制" : "开启持续压制");
			bT.type = "button";
			bT.addEventListener("click", function () {
				var r = mbCEYanlingToggle("noTrait");
				setStatus(r.msg, r.ok ? "mce-ok" : "mce-err");
				mbCEFlashRow(bT);
				renderYanling();
			});
			rowT.appendChild(bT);
			s2.appendChild(rowT);

			/* ③ 负面名声清零 */
			var s3 = mceNewSec(gA, 3, "负面名声清零", "学校名声仅 crossdress / herm 两键（schoolrep 346656-346682）；城镇名声取 V.fame 负面 8 项（sex / prostitution / rape / bestiality / pregnancy / impreg / exhibitionism / pimp），并同步删除 V.fameDecay / V.fameDecayTimer 的衰减队列项，避免清零后又被队列改回。正面项（scrap / good / business / social / model）保持不动。");
			var schTxt = "—";
			try {
				if (V && V.schoolrep && typeof V.schoolrep === "object") {
					schTxt = "crossdress=" + String(V.schoolrep.crossdress === undefined ? 0 : V.schoolrep.crossdress) + "，herm=" + String(V.schoolrep.herm === undefined ? 0 : V.schoolrep.herm);
				}
			} catch (e1) {}
			var fRow = el("div", "mce-row");
			fRow.appendChild(el("span", "mce-row-lbl", "学校名声：" + schTxt + " ｜ 城镇负面合计 " + (function () {
				try {
					var tot = 0, V1 = getV();
					for (var j = 0; j < mbCEYanlingFameNeg.length; j++) {
						var kk = mbCEYanlingFameNeg[j];
						if (V1 && V1.fame && typeof V1.fame[kk] === "number") { tot += V1.fame[kk]; }
					}
					return String(tot);
				} catch (e2) { return "—"; }
			})() + " 点"));
			s3.appendChild(fRow);
			var s3g = mceBtnGrid(s3);
			mkBtn(s3g, "一键清零：学校异装名声", "mce-gold", mbCEYanlingPurgeCross, "清 $schoolrep.crossdress 并删 $school_crossdress_message");
			mkBtn(s3g, "一键清零：全部负面名声", "mce-gold", mbCEYanlingPurgeFame, "学校 crossdress/herm + 城镇 fame 负面 8 项 + 衰减队列");

			/* ④ 身体与衣物（对照 CheatExtend 1.1.3「快捷言灵」补入；v2.0.2 拆出 ⑤ 精神与体液） */
			var s4 = mceNewSec(gB, 4, "身体与衣物", "一键烘干：$upperwet / $lowerwet / $underupperwet / $underlowerwet（原版初始化 182261-182267，debug 直写 60670-60682）。衣物加固：$worn.{upper,lower,under_upper,under_lower}.integrity 按该件 integrity_max 写满（上限取自 clothingData(slot,item,\"integrity_max\")，163772；不照抄 CE 的 +1000，避免超上限导致耐久显示破表）。");
			var wetTxt = "—", durTxt = "—";
			try {
				var Vw = getV();
				if (Vw) {
					wetTxt = ["upperwet", "lowerwet", "underupperwet", "underlowerwet"].map(function (k) { return (typeof Vw[k] === "number") ? String(Vw[k]) : "—"; }).join(" / ");
					durTxt = ["upper", "lower", "under_upper", "under_lower"].map(function (sl) {
						var w = Vw.worn ? Vw.worn[sl] : null;
						if (!w || !w.name || w.name === "naked") { return sl + "：空"; }
						return sl + "：" + String(w.integrity);
					}).join(" ｜ ");
				}
			} catch (eW) {}
			var wRow = el("div", "mce-row");
			wRow.appendChild(el("span", "mce-row-lbl", "湿度（上 / 下 / 内上 / 内下）："));
			wRow.appendChild(el("span", "mce-value", wetTxt));
			s4.appendChild(wRow);
			s4.appendChild(el("div", "mce-hint", "耐久 " + durTxt));
			var s4g = mceBtnGrid(s4);
			mkBtn(s4g, "一键烘干衣服", "mce-gold", mbCEYanlingDryClothes, "4 项衣物湿度归零");
			mkBtn(s4g, "衣物加固（耐久回满）", "mce-gold", mbCEYanlingRepairClothes, "4 主槽按各自 integrity_max 写满；穿着的 naked 槽自动跳过");

			/* ⑤ 精神与体液（v2.0.2 从「身体与衣物」拆出：这两项不碰衣物，混在一起让玩家以为都是衣服相关） */
			var s5 = mceNewSec(gB, 5, "精神与体液", "精液补满：$semen_volume / $semen_amount（183097-183101 默认 90，同序写：先 amount 补到当前 volume，再把 volume +1000）。精神恢复：$control 拉满 1000（59989 的原版初值 0，不是上限）、$hallucinogen 归零（182681）。");
			var s5g = mceBtnGrid(s5);
			mkBtn(s5g, "精液补满", "mce-gold", mbCEYanlingSemen, "$semen_amount 补到当前 volume，并把 volume +1000（与原版 CheatExtend 同序）");
			mkBtn(s5g, "精神恢复（控制拉满 + 幻觉清零）", "mce-gold", mbCEYanlingMind, "$control=1000、$hallucinogen=0");

			/* ⑥ 数值快补 */
			var s6 = mceNewSec(gB, 6, "数值快补", "补 CE 快速面板没有入口的原版数值：施虐 / 受虐（$sadism / $masochism，钳制 0-1000，290866）、奶量（$milk_volume / $milk_max，每日钳到 [24, milk_max]，290800）、成就限制（$feats.locked 原版是布尔 true=锁定）、罗宾存款（$robinmoney）、艾弗里约会（$averydate is 1 且 21 点前，308105）、校长办公室密码（$headpasswordknown）、种子（window.unlockAllSeeds，76431）、农田（$farm.clearing=0 见 305874 / $fertiliser.current ++ 见 105354）。");
			var s6g = mceBtnGrid(s6);
			mkBtn(s6g, "施虐 / 受虐拉满（1000）", "mce-gold", mbCEYanlingSadism, "$sadism / $masochism = 1000");
			mkBtn(s6g, "奶量 5000 / 上限 10000", "mce-gold", mbCEYanlingMilk, "先抬 milk_max 再写 milk_volume，避免被每日钳制卡回");
			mkBtn(s6g, "解除成就限制", "mce-gold", mbCEYanlingFeats, "$feats.locked = false（原版以 isnot true 判已解锁）");
			mkBtn(s6g, "罗宾存款清零", "mce-gold", mbCEYanlingRobinMoney, "$robinmoney = 0");
			mkBtn(s6g, "今晚艾弗里来约", "mce-gold", mbCEYanlingAveryDate, "$averydate = 1（21 点前到宅邸触发）");
			mkBtn(s6g, "获知校长办公室密码", "mce-gold", mbCEYanlingHeadPassword, "$headpasswordknown = 1");
			mkBtn(s6g, "集齐所有种子", "mce-gold", mbCEYanlingSeeds, "调原版 window.unlockAllSeeds()，不自造种子表");
			mkBtn(s6g, "清理农田 + 补 5 袋堆肥", "mce-gold", mbCEYanlingFarm, "$farm.clearing = 0、$fertiliser.current += 5");

			/* ⑦ 天气 */
			var s7 = mceNewSec(gB, 7, "天气", "0.5 起天气迁到 $weatherObj，旧 $weather 只在旧档迁移分支读一次随即 unset（190009-190032）——老式写 $weather=\"rain\" 在本版完全无效（CE 的「祈雨术」即此条）。本页直调原版 window.setWeather(type, true)（定义 87136-87167），合法类型表 85185-85407 共 7 档，此处给常用 4 档（雨 / 雪由气温决定，不单列）。");
			var s7g = mceBtnGrid(s7);
			["clear", "heavyClouds", "heavyPrecipitation", "thunderstorm"].forEach(function (wt) {
				mkBtn(s7g, "切到「" + mbCEYanlingWeatherMap[wt] + "」", "", function () { return mbCEYanlingWeather(wt); }, "setWeather(\"" + wt + "\", true)");
			});

			/* ⑧ 角色放逐 */
			var s8 = mceNewSec(gC, 8, "角色放逐", "原版「放逐」不是通用机制：跨角色只有格威岚走 scorned 线（Gwylan Ritual Sex Scorned 402967-402970 = state=scorned + 当日进度锁 + 9 天倒计时；到期由 78390-78393 自动 delete timer 恢复），凯拉尔 / 惠特尼 的「离场」在原版是 state 切换（prison / dungeon）。顺手核实：CheatExtend 1.1.3 全目录 grep「放逐 / banish / exile / 驱逐」零命中——本组口径来自原版，不是照抄 CE。");
			var npcTxt = "—";
			try {
				var statList = [];
				["Gwylan", "Kylar", "Whitney"].forEach(function (nm) {
					var p = mbCEYanlingNpc(nm);
					statList.push(nm + "=" + (p ? String(p.state) : "无槽位"));
				});
				npcTxt = statList.join(" ｜ ");
			} catch (eN) {}
			s8.appendChild(el("div", "mce-hint", "当前 NPC 状态：" + npcTxt));
			var s8g = mceBtnGrid(s8);
			mkBtn(s8g, "格威岚 · 放逐 9 天", "mce-red", mbCEYanlingGwylanBanish, "state=scorned + $daily.gwylan.preventProgress=true + $gwylan.timer.scorned=+9 天");
			mkBtn(s8g, "格威岚 · 立即召回", "mce-gold", mbCEYanlingGwylanRecall, "state=active + 清 timer.scorned / timer.nobody（等价于道歉线 addDays(-3) 提前解禁）");
			mkBtn(s8g, "凯拉尔 · 送进监狱", "mce-red", function () { return mbCEYanlingKylar(true); }, "state=prison（原版监狱专属线按此值触发）");
			mkBtn(s8g, "凯拉尔 · 捞回", "mce-gold", function () { return mbCEYanlingKylar(false); }, "state=active");
			mkBtn(s8g, "惠特尼 · 关进地牢", "mce-red", function () { return mbCEYanlingWhitney(true); }, "state=dungeon（188677 四处地牢事件按此值触发）");
			mkBtn(s8g, "惠特尼 · 放回", "mce-gold", function () { return mbCEYanlingWhitney(false); }, "state=active");
			s8.appendChild(el("div", "mce-hint", "惠特尼不提供「枷锁示众」：pillory 由 $pillory_tenant 联动（188675 按承租人姓名判定），只写 state 会出现「人不在枷锁却显示示众」的错位。凯拉尔亦同：其 prison 线除 state 还要 $prison.kylar 等配套键，本组只做 state 层（与原版 npcset 等价），不伪造监狱进度。"));

			/* v2.0.2 按键重排：说明与边界不再伪装成"第 4 个区块"，改为页尾折叠块（不占编号，默认 2 行） */
			var sInfo = el("div", "mce-block");
			var sInfoh = el("div", "mce-sec-title");
			sInfoh.appendChild(el("span", "", "说明与边界（点开查看）"));
			sInfo.appendChild(sInfoh);
			var sInfobody = el("div", "mce-foldbox");
			sInfobody.setAttribute("data-open", "0");
			var sInfotoggle = el("div", "mce-hint mce-fold", "① 只拦「服装性别」链；② 压力循环不受影响；③ 不依赖原版文案，仅依赖 6 个变量键；④ 全部动作按 mbCE_wrote 留痕可回退；⑤ 关闭开关立即卸载钩子；⑥ 性别认知残留属正常。");
			sInfotoggle.setAttribute("data-open", "0");
			sInfotoggle.addEventListener("click", function () {
				var now = sInfobody.getAttribute("data-open") === "0" ? "1" : "0";
				sInfobody.setAttribute("data-open", now);
				sInfotoggle.setAttribute("data-open", "0"); /* body 收起时摘要保持 2 行 */
			});
			sInfobody.appendChild(sInfotoggle);
			sInfobody.appendChild(el("div", "mce-hint", "① 只拦「服装性别」链，不改玩家性别、生殖器、外观性别（isGenitalMismatch 与原版 herm 链保持原样；双生殖器仍会按原版进 herm 分支，如需一并消掉请用上面的名声清零）。"));
			sInfobody.appendChild(el("div", "mce-hint", "② 压力循环不受影响：77866-77870 用本地 const 判定（源码注释明确不复用函数），本页只覆盖函数不改语义。"));
			sInfobody.appendChild(el("div", "mce-hint", "③ 不依赖任何原版文案：老式「言灵」模组靠文本替换原版 Cheats 面板，原版一更新即整块失效；本页全部为运行期钩子与变量直写，仅依赖 6 个变量键（$crossdressing / $schoolrep / $school_crossdress_message / $crossdressingTrait / $backgroundTraits / $fame）。"));
			sInfobody.appendChild(el("div", "mce-hint", "④ 所有净化动作按 mbCE_wrote[\"yanling:op\"] 留痕（含 before/after/t），可在全局页留痕区核对。"));
			sInfobody.appendChild(el("div", "mce-hint", "⑤ 关闭开关会立即卸载钩子（window.isCrossdressing 还原为原版函数），不留空包装层；钩子被第三方模组重包时，开关开启期间每秒自动以新函数为上游重新包裹。"));
			sInfobody.appendChild(el("div", "mce-hint", "⑥ 性别认知残留属正常：学校异装名声升到 5 时原版会把 9 名 NPC 写进 $genderknown（schoolrep widget 的 pushUnique）。本页清零名声不撤销这些认知——它们只代表「NPC 已知道你的性别」，不是负面名声，撤销反而让 NPC 忘记已有认知。"));
			sInfo.appendChild(sInfobody);
			pane.appendChild(sInfo);
			/* 恢复滚动位置（见上方 keepTop） */
			if (scroller && keepTop) { try { scroller.scrollTop = keepTop; } catch (eR) {} }
		} catch (e) { /* 渲染失败不抛到 UI 主链 */ }
	}

	/* 模块加载即起守卫：存档里已开启的开关无需打开面板也持续生效（V 未就绪时 tick 内静默跳过） */
	mbCEYanlingEnsureTimer();
