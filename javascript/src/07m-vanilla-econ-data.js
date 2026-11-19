/* 职责：原版「房租/欠租 · 学校出勤 · 农场地块 · 避孕套 · 玩家纹身」五项直写通道（全局页 ⑪ 数据层）。
   写入全部走 07l 的 vcore 留痕（mbCEVanillaTrace 保留首次 before），回退由本段 mbCEVanillaEconUndo
   按 kind 还原；统一回退中心按 type==="vcore" 分发到 mbCEVanillaExtUndo，后者在未知 kind 处委派到本段
   （这样不必把 07l 主段撑过结构门禁 S1 的 400 行）。视图在同名 -view 段。

   原版事实（DoL 0.5.12.13 源码实证，勿凭印象改口径）：
   - 租：passRentTick() 走 V.renttime--；仅 `V.renttime < 0 and V.renttime % 7 === 0` 时才把
     V.rentmoney + (V.babyRent||0) 累进 V.baileyRefusedToPayTotal / baileyRefusedToPayTotalStat。
     所以 renttime 写 0 = 今天刚见过 Bailey；负数才是欠租计时，作弊层不接受手填负数。
   - 校：V.daily.school.attended.<6 科> 是当天出勤位；缺席时原版 `+= !Number(attended.x)` 累进
     V.schoolLessonsMissed 同名键（每日重置 attended，不清 missed）。
   - 田：V.plots 是以地点为键的对象（原版实证键 garden / farm），值是 plot 数组；
     tendingDay() 里 `plot.days += 1`，`days >= setup.foodstuff[plant].tending.growth_days*(stage+1)/5`
     才 stage += 1；stage >= 5 即原版可收获。stage 无上限判定，故催熟同时把 days 归 0。
     空格（stage 0）与未知作物（setup.foodstuff 无键）绝不能写 stage 5——tendingDay 会读
     setup.foodstuff[undefined] 直接抛 TypeError。
   - 套：V.condoms 是顶层计数键（侧栏 Total condoms: $condoms），侧栏仅在 condomLevel>=1 时显示，数值本身随时可写。
   - 纹：纹身不是 V.tattoos，而是 V.skin[<部位>].pen === "tattoo"；原版清除 widget bodywriting_clear 的语义就是
     `<<set $skin[_args[0]] to {}>>`（整部位重置）。原版「加纹身」依赖刺青店设计数据（$tattoo_parlour 的 clone），
     凭空造不出来，所以本段只做「清除」与「把已有涂写标记为纹身」两种合法动作。 */

	var MCE_ECON_SUBJECTS = [
		{ key: "science", zh: "科学" },
		{ key: "maths", zh: "数学" },
		{ key: "english", zh: "英语" },
		{ key: "history", zh: "历史" },
		{ key: "swimming", zh: "游泳" },
		{ key: "housekeeping", zh: "家政" }
	];
	var MCE_ECON_PLOT_ZH = { garden: "孤儿院花园", farm: "亚历克斯农场" };
	/* 部位中文名（原版 $skin 的键，覆盖纹身店会用到的主要部位；未收录的回退「其他部位」） */
	var MCE_ECON_BODY_ZH = {
		forehead: "额头", face: "脸", cheeks: "双颊", left_cheek: "左脸颊", right_cheek: "右脸颊",
		lips: "嘴唇", mouth: "嘴", nose: "鼻子", ears: "耳朵", neck: "脖子",
		chest: "胸口", breasts: "胸部", nipples: "乳头", tummy: "肚子", stomach: "腹部",
		back: "后背", shoulders: "肩", shoulder: "肩", hips: "胯", waist: "腰",
		pubic: "耻部", crotch: "裆部", buttocks: "臀", anus: "后穴", vagina: "私处", penis: "阴茎",
		leftarm: "左臂", rightarm: "右臂", left_arm: "左臂", right_arm: "右臂",
		left_hand: "左手", right_hand: "右手", left_thigh: "左大腿", right_thigh: "右大腿",
		thigh: "大腿", left_bottom: "左小腿", right_bottom: "右小腿", feet: "脚", foot: "脚"
	};

	function mbCEVanillaEconSubjectZh(key) {
		var hit = null;
		MCE_ECON_SUBJECTS.forEach(function (s) { if (s.key === key) { hit = s.zh; } });
		return hit || "其他科目";
	}
	function mbCEVanillaEconSubjectValid(key) {
		return MCE_ECON_SUBJECTS.some(function (s) { return s.key === key; });
	}
	function mbCEVanillaEconPlotZh(key) { return MCE_ECON_PLOT_ZH[key] || "其他地块"; }
	function mbCEVanillaEconBodyZh(key) { return MCE_ECON_BODY_ZH[key] || "其他部位"; }
	/* 整数解析：空串 / 非数字 / 小数 / 越界一律判 null（调用方转成拒绝文案，不静默钳制） */
	function mbCEVanillaEconNum(raw, min, max) {
		if (raw === "" || raw === null || raw === undefined) { return null; }
		var n = Number(raw);
		if (!isFinite(n) || Math.floor(n) !== n) { return null; }
		if (n < min || n > max) { return null; }
		return n;
	}
	function mbCEVanillaEconClone(o) {
		if (o === undefined) { return undefined; }
		try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; }
	}
	/* 作物校验：原版 tendingDay 读 setup.foodstuff[plant].tending.growth_days，缺这段就会崩 */
	function mbCEVanillaEconCropOk(plant) {
		if (!plant) { return false; }
		try {
			var s = getSetup();
			return !!(s && s.foodstuff && s.foodstuff[plant] && s.foodstuff[plant].tending);
		} catch (e) { return false; }
	}

	/* ---------- 只读快照的分域取数（供 mbCEVanillaEconStats 汇总；拆分只为压复杂度） ---------- */
	function mbCEVanillaEconRentSnap(V) {
		return {
			has: (V.renttime !== undefined) || (V.rentmoney !== undefined),
			renttime: Number(V.renttime) || 0,
			debt: Number(V.baileyRefusedToPayTotal) || 0,
			rentmoney: Number(V.rentmoney) || 0,
			babyRent: Number(V.babyRent) || 0
		};
	}
	function mbCEVanillaEconSchoolSnap(V) {
		var out = { has: false, attended: {}, attendedCount: 0, missed: {}, missedTotal: 0 };
		var att = V.daily && V.daily.school && V.daily.school.attended;
		if (!att || typeof att !== "object") { return out; }
		out.has = true;
		MCE_ECON_SUBJECTS.forEach(function (s) {
			var v = Number(att[s.key]) === 1 ? 1 : 0;
			out.attended[s.key] = v;
			out.attendedCount += v;
		});
		var miss = V.schoolLessonsMissed;
		if (miss && typeof miss === "object") {
			MCE_ECON_SUBJECTS.forEach(function (s) {
				var m = Number(miss[s.key]) || 0;
				out.missed[s.key] = m;
				out.missedTotal += m;
			});
		}
		return out;
	}
	function mbCEVanillaEconFarmSnap(V, locList) {
		var out = { has: false, locations: locList };
		if (!V.plots || typeof V.plots !== "object") { return out; }
		out.has = true;
		Object.keys(V.plots).forEach(function (k) {
			var arr = V.plots[k];
			if (!Array.isArray(arr)) { return; }
			var loc = { key: k, zh: mbCEVanillaEconPlotZh(k), total: arr.length, planted: 0, ripe: 0 };
			arr.forEach(function (p) {
				if (!p || typeof p !== "object") { return; }
				/* 已种 / 可收获只看 stage：原版收获判定就是满成熟度（不校验作物表），
				   作物表校验只拦「写成熟」，不能拿来过滤统计口径。 */
				if (Number(p.stage) >= 1) { loc.planted++; }
				if (Number(p.stage) >= 5) { loc.ripe++; }
			});
			locList.push(loc);
		});
		return out;
	}
	function mbCEVanillaEconSkinSnap(V, partList) {
		var out = { has: false, parts: partList, count: 0 };
		if (!V.skin || typeof V.skin !== "object") { return out; }
		out.has = true;
		Object.keys(V.skin).forEach(function (k) {
			var part = V.skin[k];
			if (!part || typeof part !== "object" || part.pen !== "tattoo") { return; }
			partList.push({ key: k, zh: mbCEVanillaEconBodyZh(k) });
		});
		out.count = partList.length;
		return out;
	}

	/* ---------- 只读快照（视图层渲染用） ---------- */
	function mbCEVanillaEconStats() {
		/* 数组元素类型显式声明：src 侧 strict 棘轮要求，避免 [] 被推断成 never[] 而让下游 .zh/.key 读不出来 */
		var locList = /** @type {Array<{key: string, zh: string, total: number, planted: number, ripe: number}>} */ ([]);
		var partList = /** @type {Array<{key: string, zh: string}>} */ ([]);
		var out = {
			ok: false,
			rent: { has: false, renttime: 0, debt: 0, rentmoney: 0, babyRent: 0 },
			school: { has: false, attended: {}, attendedCount: 0, missed: {}, missedTotal: 0 },
			farm: { has: false, locations: locList },
			condoms: { has: false, count: 0 },
			tattoo: { has: false, parts: partList, count: 0 }
		};
		var V = getV();
		if (!V) { return out; }
		try {
			out.rent = mbCEVanillaEconRentSnap(V);
			out.school = mbCEVanillaEconSchoolSnap(V);
			out.farm = mbCEVanillaEconFarmSnap(V, locList);
			out.condoms.has = V.condoms !== undefined;
			out.condoms.count = Number(V.condoms) || 0;
			out.tattoo = mbCEVanillaEconSkinSnap(V, partList);
			out.ok = true;
		} catch (e) { out.ok = false; }
		return out;
	}

	/* ---------- 房租 ---------- */
	function mbCEVanillaEconRentDays(raw) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var n = mbCEVanillaEconNum(raw, 0, 365);
		if (n === null) { return { ok: false, message: "租期天数需为 0–365 的整数（0 = 今天已见 Bailey，7 天内不催租）" }; }
		var before = { kind: "rent-days", renttime: V.renttime === undefined ? undefined : Number(V.renttime) };
		V.renttime = n;
		mbCEVanillaTrace("rent-days", before, "renttime", "租期倒计时直写", "vcore-econ");
		return { ok: true, message: "租期已设为 " + n + " 天" };
	}
	function mbCEVanillaEconRentDebt(raw) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var n = mbCEVanillaEconNum(raw, 0, 99999999);
		if (n === null) { return { ok: false, message: "欠租金额需为 0–99999999 的整数" }; }
		var before = { kind: "rent-debt", debt: Number(V.baileyRefusedToPayTotal) || 0 };
		V.baileyRefusedToPayTotal = n;
		mbCEVanillaTrace("rent-debt", before, "baileyRefusedToPayTotal", "欠租金额直写", "vcore-econ");
		return { ok: true, message: "欠租已设为 £" + n };
	}
	function mbCEVanillaEconClearDebt() { return mbCEVanillaEconRentDebt(0); }

	/* ---------- 学校出勤 ---------- */
	function mbCEVanillaEconSchoolTrace() {
		var V = getV();
		var att = V && V.daily && V.daily.school && V.daily.school.attended;
		var before = {
			kind: "school",
			attended: mbCEVanillaEconClone(att),
			missed: mbCEVanillaEconClone(V ? V.schoolLessonsMissed : undefined)
		};
		return before;
	}
	/* 今日出勤表取数 + 提示文案（拆分只为把单函数复杂度压在 10 以内） */
	function mbCEVanillaEconAttTable() {
		var V = getV();
		var d = V && V.daily, s = d && d.school, att = s && s.attended;
		return (att && typeof att === "object") ? att : null;
	}
	function mbCEVanillaEconAttMsg(key, on) {
		if (on) { return mbCEVanillaEconSubjectZh(key) + " 已设为出勤"; }
		return mbCEVanillaEconSubjectZh(key) + " 已设为缺席（缺席会自动累进旷课次数，交给原版结算）";
	}
	function mbCEVanillaEconAttend(key, on) {
		var att = mbCEVanillaEconAttTable();
		if (!att) {
			return { ok: false, message: "该存档还没有学校流程（今日出勤表未生成），先正常上一天学再回来" };
		}
		if (!mbCEVanillaEconSubjectValid(key)) { return { ok: false, message: "未知科目" }; }
		var val = on ? 1 : 0;
		if (Number(att[key]) === val) { return { ok: true, message: mbCEVanillaEconSubjectZh(key) + "已经是该状态，未重复写入" }; }
		var before = mbCEVanillaEconSchoolTrace();
		att[key] = val;
		mbCEVanillaTrace("school", before, "daily.school.attended", "今日出勤位直写", "vcore-econ");
		return { ok: true, message: mbCEVanillaEconAttMsg(key, on) };
	}
	function mbCEVanillaEconAttendAll(on) {
		var att = mbCEVanillaEconAttTable();
		if (!att) {
			return { ok: false, message: "该存档还没有学校流程（今日出勤表未生成），先正常上一天学再回来" };
		}
		var before = mbCEVanillaEconSchoolTrace();
		var n = 0;
		MCE_ECON_SUBJECTS.forEach(function (s) {
			if (!Object.prototype.hasOwnProperty.call(att, s.key)) { return; }
			var val = on ? 1 : 0;
			if (Number(att[s.key]) !== val) { att[s.key] = val; n++; }
		});
		if (!n) { return { ok: true, message: "今日六科已是该状态，未重复写入" }; }
		mbCEVanillaTrace("school", before, "daily.school.attended", "今日出勤位整体直写", "vcore-econ");
		return { ok: true, message: (on ? "今日六科已全部记为出勤" : "今日六科已全部记为缺席") + "（写入 " + n + " 科）" };
	}
	function mbCEVanillaEconMissedClear() {
		var V = getV();
		var miss = V && V.schoolLessonsMissed;
		if (!miss || typeof miss !== "object") { return { ok: false, message: "该存档还没有旷课计数" }; }
		var before = mbCEVanillaEconSchoolTrace();
		var n = 0;
		Object.keys(miss).forEach(function (k) {
			if (Number(miss[k]) !== 0) { miss[k] = 0; n++; }
		});
		if (!n) { return { ok: true, message: "旷课次数已经是 0，未重复写入" }; }
		mbCEVanillaTrace("school", before, "schoolLessonsMissed", "旷课计数清零", "vcore-econ");
		return { ok: true, message: "旷课次数已清零（" + n + " 科）" };
	}

	/* ---------- 农田催熟 ---------- */
	function mbCEVanillaEconRipen(loc) {
		var V = getV();
		if (!V || !V.plots || typeof V.plots !== "object") { return { ok: false, message: "该存档还没有农场地块" }; }
		var arr = V.plots[loc];
		if (!Array.isArray(arr)) { return { ok: false, message: "没有这个地块" }; }
		var before = { kind: "farm", loc: loc, plots: mbCEVanillaEconClone(arr) };
		var n = 0;
		arr.forEach(function (p) {
			if (!p || typeof p !== "object") { return; }
			if (Number(p.stage) < 1) { return; }
			if (!mbCEVanillaEconCropOk(p.plant)) { return; }
			if (Number(p.stage) >= 5 && Number(p.days) === 0) { return; }
			p.stage = 5;
			p.days = 0;
			n++;
		});
		if (!n) { return { ok: false, message: "该地块没有可催熟的作物（空格 / 未知作物不计）" }; }
		mbCEVanillaTrace("farm-" + loc, before, "plots." + loc, "地块作物催熟", "vcore-econ");
		return { ok: true, message: mbCEVanillaEconPlotZh(loc) + " 已催熟 " + n + " 块", ripened: n };
	}
	function mbCEVanillaEconRipenAll() {
		var V = getV();
		if (!V || !V.plots || typeof V.plots !== "object") { return { ok: false, message: "该存档还没有农场地块" }; }
		var total = 0, locs = 0, msgs = [];
		Object.keys(V.plots).forEach(function (k) {
			if (!Array.isArray(V.plots[k])) { return; }
			var r = mbCEVanillaEconRipen(k);
			if (r.ok) { total += Number(r.ripened) || 0; locs++; msgs.push(r.message); }
		});
		if (!total) { return { ok: false, message: "没有任何可催熟的作物（空格 / 未知作物不计）" }; }
		return { ok: true, message: "已催熟 " + locs + " 个地块（" + msgs.join("；") + "）", ripened: total };
	}

	/* ---------- 避孕套 ---------- */
	function mbCEVanillaEconCondoms(raw) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var n = mbCEVanillaEconNum(raw, 0, 999);
		if (n === null) { return { ok: false, message: "数量需为 0–999 的整数" }; }
		var before = { kind: "condoms", condoms: V.condoms === undefined ? undefined : Number(V.condoms) };
		V.condoms = n;
		mbCEVanillaTrace("condoms", before, "condoms", "避孕套数量直写", "vcore-econ");
		return { ok: true, message: "避孕套已设为 " + n + " 个" };
	}
	function mbCEVanillaEconCondomsAdd(delta) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var d = mbCEVanillaEconNum(delta, 1, 999);
		if (d === null) { return { ok: false, message: "追加数量需为 1–999 的整数" }; }
		var cur = Number(V.condoms) || 0;
		var target = cur + d;
		if (target > 999) { target = 999; }
		var before = { kind: "condoms", condoms: V.condoms === undefined ? undefined : cur };
		V.condoms = target;
		mbCEVanillaTrace("condoms", before, "condoms", "避孕套数量追加", "vcore-econ");
		return { ok: true, message: "避孕套 " + cur + " → " + target + " 个" };
	}

	/* ---------- 纹身 ---------- */
	function mbCEVanillaEconTattooClear(part) {
		var V = getV();
		var skin = V && V.skin;
		if (!skin || typeof skin !== "object") { return { ok: false, message: "该存档没有皮肤数据" }; }
		var obj = skin[part];
		if (!obj || typeof obj !== "object") { return { ok: false, message: "该部位没有皮肤数据" }; }
		if (obj.pen !== "tattoo") { return { ok: false, message: "该部位没有纹身（只有 pen 为纹身的部位才可清除）" }; }
		var before = { kind: "tattoo", part: part, value: mbCEVanillaEconClone(obj) };
		skin[part] = {};
		mbCEVanillaTrace("tattoo-" + part, before, "skin." + part, "清除该部位纹身", "vcore-econ");
		return { ok: true, message: "已清除「" + mbCEVanillaEconBodyZh(part) + "」的纹身（整部位重置，等价原版 bodywriting_clear）" };
	}
	function mbCEVanillaEconTattooMark(part) {
		var V = getV();
		var skin = V && V.skin;
		if (!skin || typeof skin !== "object") { return { ok: false, message: "该存档没有皮肤数据" }; }
		var obj = skin[part];
		if (!obj || typeof obj !== "object") { return { ok: false, message: "该部位没有皮肤数据" }; }
		if (obj.pen === "tattoo") { return { ok: false, message: "该部位已经是纹身" }; }
		if (!obj.type || !(obj.writing || obj.type === "image")) {
			return { ok: false, message: "该部位没有可转成纹身的图案或文字（原版纹身必须有刺青设计数据，凭空造不出来）" };
		}
		var before = { kind: "tattoo", part: part, value: mbCEVanillaEconClone(obj) };
		obj.pen = "tattoo";
		mbCEVanillaTrace("tattoo-" + part, before, "skin." + part, "标记为纹身", "vcore-econ");
		return { ok: true, message: "「" + mbCEVanillaEconBodyZh(part) + "」已标记为纹身" };
	}
	function mbCEVanillaEconTattooClearAll() {
		var V = getV();
		var skin = V && V.skin;
		if (!skin || typeof skin !== "object") { return { ok: false, message: "该存档没有皮肤数据" }; }
		var keys = Object.keys(skin).filter(function (k) {
			return skin[k] && typeof skin[k] === "object" && skin[k].pen === "tattoo";
		});
		if (!keys.length) { return { ok: false, message: "当前没有任何纹身" }; }
		var before = { kind: "tattoo-all", skin: mbCEVanillaEconClone(skin) };
		keys.forEach(function (k) { skin[k] = {}; });
		mbCEVanillaTrace("tattoo-all", before, "skin", "一键清除全部纹身", "vcore-econ");
		return { ok: true, message: "已清除 " + keys.length + " 处纹身", cleared: keys.length };
	}

	
