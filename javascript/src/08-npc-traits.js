	/* ============ v1.5.0 誓言修复 + NPC 特质获取（对应游戏「特质」页 · 一般/NPC 特质分组） ============ */
	// NPC 特质：原版 0.5.12.13 Traits widget「NPC Traits」分组逐项照抄 has 条件与文案（汉化名）
	var NPC_TRAITS = [
		{ key: "robin_protector", name: "同舟共济—罗宾", en: "Robin's Protector", desc: "罗宾依赖着你，你需要变强。增加每日创伤恢复。",
			owned: function () { return getV().robinpaid >= 1; },
			grant: function () { getV().robinpaid = 1; return { ok: true, message: "已满足「同舟共济—罗宾」条件（robinpaid = 1）" }; } },
		{ key: "stockholm_eden", name: "斯德哥尔摩综合征：伊甸", en: "Stockholm Syndrome: Eden", desc: "孤身一人住在树林里的滋味一定不好受。",
			owned: function () { return getV().syndromeeden >= 1; },
			grant: function () { getV().syndromeeden = 1; return { ok: true, message: "已满足「斯德哥尔摩综合征：伊甸」条件（syndromeeden = 1）" }; } },
		{ key: "stockholm_kylar", name: "斯德哥尔摩综合征：凯拉尔", en: "Stockholm Syndrome: Kylar", desc: "每个人都需要一个朋友。",
			owned: function () { return getV().syndromekylar >= 1; },
			grant: function () {
				getV().syndromekylar = 1;
				var extra = "";
				try {
					if (typeof C !== "undefined" && C && C.npc && C.npc.Kylar && C.npc.Kylar.state === "prison" && getV().location !== "prison") {
						extra = "（凯拉尔当前在监狱，特质页暂不显示——NPC 状态不改）";
					}
				} catch (e) {}
				return { ok: true, message: "已满足「斯德哥尔摩综合征：凯拉尔」条件（syndromekylar = 1）" + extra };
			} },
		{ key: "stockholm_wolves", name: "斯德哥尔摩综合征：狼群", en: "Stockholm Syndrome: Wolves", desc: "它们只是可爱的动物（或怪物）。",
			owned: function () { return getV().syndromewolves >= 1; },
			grant: function () { getV().syndromewolves = 1; return { ok: true, message: "已满足「斯德哥尔摩综合征：狼群」条件（syndromewolves = 1）" }; } },
		{ key: "stockholm_hawk", name: "斯德哥尔摩综合征：巨鹰", en: "Stockholm Syndrome: Great Hawk", desc: "它只是想要一个伴侣。",
			owned: function () { return getV().syndromebird >= 1; },
			grant: function () { getV().syndromebird = 1; return { ok: true, message: "已满足「斯德哥尔摩综合征：巨鹰」条件（syndromebird = 1）" }; } },
		{ key: "avery_saviour", name: "艾弗里的救星", en: "Avery's Saviour", desc: "你救了艾弗里的命。愤怒每日衰减。",
			owned: function () { return getV().avery_fate === "saved" || getV().mceAveryShelter === true; },
			grant: function (mode) {
				var v = getV();
				var m = mode || "saved";
				if (m === "shelter") {
					/* 庇护模式：只挂 MCE 标记，不改 avery_fate——大楼/高塔保留正常建造进度，不走原版救星结局线 */
					if (!v.mceAveryShelter) {
						v.mceAveryShelter = true;
						v.mceAveryFateSnapshot = (v.avery_fate === undefined) ? "undefined" : v.avery_fate;
					}
					return { ok: true, message: "庇护模式已启用：获得「艾弗里的救星」效果（愤怒每日衰减），avery_fate 未改动——大楼/高塔保留建造进度，不走原版救星结局线。" };
				}
				/* 原版线：avery_fate = saved（高塔转烧毁态，与原版 Save Avery 结局一致） */
				if (v.avery_fate !== "saved") {
					v.mceAveryFateSnapshot = (v.avery_fate === undefined) ? "undefined" : v.avery_fate;
				}
				v.avery_fate = "saved";
				return { ok: true, message: "已满足「艾弗里的救星」条件（avery_fate = saved，原版救星线：高塔转为烧毁态）" };
			},
			revert: function () {
				var v = getV();
				var wasShelter = !!v.mceAveryShelter;
				var snap = v.mceAveryFateSnapshot;
				var wasSaved = v.avery_fate === "saved";
				delete v.mceAveryShelter;
				delete v.mceAveryFateSnapshot;
				var msg;
				if (wasSaved && snap !== undefined) {
					if (snap === "undefined") { delete v.avery_fate; msg = "avery_fate 已还原为操作前状态（未定义）"; }
					else { v.avery_fate = snap; msg = "avery_fate 已还原为 " + snap; }
				} else {
					msg = "avery_fate 保持原状（" + (v.avery_fate === undefined ? "未定义" : v.avery_fate) + "）";
				}
				return { ok: true, message: "已撤回「艾弗里的救星」" + (wasShelter ? "（庇护标记已清除；" : "（") + msg + "）——大楼/高塔恢复操作前状态" };
			} }
	];
	// 神殿誓言状态（原版 Traits widget 一般特质分组：Chastity Vow / Broken Vow / Rite of Promise / Broken Promise）
	function getVowStatus() {
		var v = getV();
		var temple = (v.player && v.player.virginity) ? v.player.virginity.temple : undefined;
		return {
			temple: temple,
			templePromised: v.templePromised || "",
			templeRank: v.temple_rank,
			templeBurden: v.temple_burden || 0,
			brokenVowCount: (v.brokenVowCount && typeof v.brokenVowCount === "object") ? v.brokenVowCount : {}
		};
	}
	// 一键修复誓言：恢复 player.virginity.temple=true（原版破坏点写 NPC 名/false），清空各角色破誓计数；承诺对象保留（恢复后显示 Rite of Promise）
	function fixVows() {
		var v = getV();
		var before = getVowStatus();
		if (!v.player) { v.player = {}; }
		if (!v.player.virginity) { v.player.virginity = {}; }
		v.player.virginity.temple = true;
		var bvc = v.brokenVowCount;
		if (bvc && typeof bvc === "object") {
			Object.keys(bvc).forEach(function (k) { bvc[k] = 0; });
		}
		var after = getVowStatus();
		return {
			ok: true, before: before, after: after,
			message: "誓言已修复：Temple Vow = 未破" + (before.templePromised ? "（承诺对象「" + before.templePromised + "」保留，显示为 Rite of Promise）" : "；破誓计数已清零")
		};
	}
	// 特质列表（渲染用：含是否已拥有）
	function listNpcTraits() {
		return NPC_TRAITS.map(function (t) {
			return { key: t.key, name: t.name, en: t.en, desc: t.desc, owned: !!t.owned() };
		});
	}
	// 获取指定 NPC 特质：条件不满足时直接把条件变量改为满足；mode 可选（avery_saviour 支持 shelter 庇护模式）
	function grantNpcTrait(key, mode) {
		var t = null, i;
		for (i = 0; i < NPC_TRAITS.length; i++) { if (NPC_TRAITS[i].key === key) { t = NPC_TRAITS[i]; break; } }
		if (!t) { return { ok: false, message: "未知特质 " + key }; }
		return t.grant(mode);
	}
	// 撤回指定 NPC 特质：恢复操作前状态（目前 avery_saviour 支持快照回退）
	function revertNpcTrait(key) {
		var t = null, i;
		for (i = 0; i < NPC_TRAITS.length; i++) { if (NPC_TRAITS[i].key === key) { t = NPC_TRAITS[i]; break; } }
		if (!t) { return { ok: false, message: "未知特质 " + key }; }
		if (typeof t.revert !== "function") { return { ok: false, message: "该特质不支持撤回" }; }
		return t.revert();
	}

	/* v1.9.13 时间调节（全局页）：DoL 0.5.12.13 时间系统 = 全局 Time 对象（非 V.timer 行动点）：
	   Time.set(V.timeStamp + delta*60) 快进（V.timeStamp 为秒级存档键）、
	   Time.setTime(h, m) 跳指定时分（日期/星期随引擎联动）。
	   直接改全局时间、不写 V 存档键 → 不进 mbCE_wrote 留痕，即时生效、无需回退。 */
	function mcTimeNow() {
		try {
			if (typeof Time === "undefined" || !Time) { return null; }
			return {
				hour: typeof Time.hour === "number" ? Time.hour : 0,
				minute: typeof Time.minute === "number" ? Time.minute : 0,
				weekDay: typeof Time.weekDay === "number" ? Time.weekDay : 0
			};
		} catch (e) { return null; }
	}
	function mcTimeAdvance(minutes) {
		try {
			var V = getV();
			if (!V || typeof Time === "undefined" || !Time || typeof Time.set !== "function") {
				return { ok: false, message: "时间系统不可用（需在游戏内运行）" };
			}
			var delta = Math.max(0, Number(minutes) || 0);
			var ts = Number(V.timeStamp);
			if (!Number.isFinite(ts)) { ts = 0; }
			Time.set(ts + delta * 60);
			return { ok: true, message: "时间已前进 " + delta + " 分钟" };
		} catch (e) {
			return { ok: false, message: "时间前进失败：" + mbCEErr(e) };
		}
	}
	function mcTimeJump(hour, minute) {
		try {
			if (typeof Time === "undefined" || !Time || typeof Time.setTime !== "function") {
				return { ok: false, message: "时间系统不可用（Time.setTime 缺失）" };
			}
			var h = Number(hour) || 0, m = Number(minute) || 0;
			Time.setTime(h, m);
			return { ok: true, message: "时间已设为 " + h + ":" + (m < 10 ? "0" : "") + m };
		} catch (e) {
			return { ok: false, message: "时间调整失败：" + mbCEErr(e) };
		}
	}
