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
			return { ok: false, message: "时间前进失败：" + (e && e.message ? e.message : e) };
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
			return { ok: false, message: "时间调整失败：" + (e && e.message ? e.message : e) };
		}
	}
	function renderGlobal() {
		var pane = root.querySelector('[data-pane="global"]');
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架。"));
			return;
		}
		/* v1.9.11+：悬浮入口固定按钮（锁定/解锁右下角金色「解锁」球的拖动；
		   悬浮球是面板唯一入口，不提供隐藏——隐藏即死锁） */
		var fabLocked = !!(toggleBtn && toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1");
		var fabWrap = el("div", "mce-row");
		fabWrap.appendChild(el("span", "mce-row-lbl", "面板悬浮入口（右下角金色「解锁」球）"));
		var fabBtn = el("button", "mce-btn", fabLocked ? "解锁悬浮球拖动" : "锁定悬浮球拖动");
		fabBtn.type = "button";
		fabBtn.title = fabLocked
			? "悬浮球拖动已锁定（点击仍可开关面板）；点此解锁后可再次拖动"
			: "点此锁定悬浮球拖动（固定不动，不再误拖/挡操作）；点击悬浮球本身仍可开关面板";
		fabBtn.addEventListener("click", function () {
			if (!toggleBtn) { return; }
			var nowLocked = !!(toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1");
			toggleBtn.dataset.mceLocked = nowLocked ? "0" : "1";
			toggleBtn.title = nowLocked
				? "Maplebirch CE 剧情条件解锁面板（可拖动：按住移到任意位置，位置自动记忆）"
				: "Maplebirch CE 剧情条件解锁面板（拖动已锁定：点击开关面板，到「全局」页解锁拖动）";
			try {
				if (typeof localStorage !== "undefined" && localStorage) {
					localStorage.setItem("mbCE_toggle_lock_v1", nowLocked ? "0" : "1");
				}
			} catch (e) {}
			renderGlobal();
		});
		fabWrap.appendChild(fabBtn);
		pane.appendChild(fabWrap);
		var chars = listCharacters();
		pane.appendChild(el("div", "mce-hint", "自动枚举角色 " + chars.length + " 个（本体 + 全部 MOD）。以下操作对全部角色生效。"));
		var actions = el("div", "mce-actions");
		var b1 = el("button", "mce-btn mce-gold", "全部角色：一键补齐全部数值");
		b1.type = "button";
		b1.addEventListener("click", function () {
			var r = globalFill();
			setStatus("已补齐 " + r.characters + " 个角色共 " + r.stats + " 项数值", "mce-ok");
		});
		var b2 = el("button", "mce-btn mce-gold", "全部角色：一键解锁全部恋爱阶段");
		b2.type = "button";
		b2.addEventListener("click", function () {
			var r = globalRomance();
			setStatus("恋爱阶段：" + r.fixed + " / " + r.total + " 已自动解锁", r.fixed > 0 ? "mce-ok" : "mce-err");
		});
		var b3 = el("button", "mce-btn mce-gold", "全部角色：一键解锁全部转化阶段");
		b3.type = "button";
		b3.addEventListener("click", function () {
			var r = globalTransform();
			setStatus("已解锁 " + r.characters + " 个角色的 " + r.stages + " 个转化类型", "mce-ok");
		});
		var b4 = el("button", "mce-btn mce-gold", "一键完成玩家扩展转化（兔子/人鱼等）");
		b4.type = "button";
		b4.addEventListener("click", function () {
			var n = 0;
			listExtTransforms().forEach(function (k) { if (completeExtTransform(k)) { n += 1; } });
			setStatus(n > 0 ? "扩展转化已全部解锁（" + n + " 项）" : "未检测到扩展转化（MOD 未加载）", n > 0 ? "mce-ok" : "mce-err");
		});
		actions.appendChild(b1);
		actions.appendChild(b2);
		actions.appendChild(b3);
		actions.appendChild(b4);
		pane.appendChild(actions);
		/* v1.9.13 时间调节区：快进即时生效，跳时段把时分设到指定点（日期/星期由引擎联动） */
		var tsec = el("div", "mce-section", "时间调节（直接改游戏时钟，即时生效）");
		pane.appendChild(tsec);
		var tnow = mcTimeNow();
		var tInfo = tnow
			? ("当前 " + tnow.hour + ":" + (tnow.minute < 10 ? "0" : "") + tnow.minute + (tnow.weekDay ? " · 周" + tnow.weekDay : ""))
			: "时间系统不可用（需在游戏内运行）";
		tsec.appendChild(el("div", "mce-hint", tInfo + "；快进按钮即时前进，跳时段按钮把时分设到指定点。直接改全局时钟、不进留痕。"));
		var tAdv = el("div", "mce-row");
		[{ n: "+1 小时", v: 60 }, { n: "+3 小时", v: 180 }, { n: "+8 小时", v: 480 }, { n: "+1 天", v: 1440 }, { n: "+3 天", v: 4320 }].forEach(function (d) {
			var b = el("button", "mce-btn mce-gold", d.n); b.type = "button";
			b.addEventListener("click", function () {
				var r = mcTimeAdvance(d.v);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			tAdv.appendChild(b);
		});
		tsec.appendChild(tAdv);
		var tJump = el("div", "mce-row");
		[{ n: "早 8:00", h: 8, m: 0 }, { n: "午 12:00", h: 12, m: 0 }, { n: "傍晚 18:00", h: 18, m: 0 }, { n: "夜 22:00", h: 22, m: 0 }, { n: "深 2:00", h: 2, m: 0 }].forEach(function (d) {
			var b = el("button", "mce-btn", d.n); b.type = "button";
			b.addEventListener("click", function () {
				var r = mcTimeJump(d.h, d.m);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			tJump.appendChild(b);
		});
		tsec.appendChild(tJump);
		/* v1.5.0：誓言修复 + NPC 特质获取（游戏「特质」页对应分组） */
		var vsec = el("div", "mce-section", "誓言修复 · NPC 特质（对应游戏「特质」页）");
		pane.appendChild(vsec);
		var vst = getVowStatus();
		var vowTxt = "神殿誓言（Temple Vow）：" + (vst.temple === true ? "未破" : "已破（" + (vst.temple === false ? "未知" : String(vst.temple)) + "）");
		if (vst.templePromised) { vowTxt += "；承诺对象：" + vst.templePromised; }
		if (vst.templeRank) { vowTxt += "；神殿等级：" + vst.templeRank; }
		var vrow = el("div", "mce-row");
		vrow.appendChild(el("span", "mce-row-lbl", vowTxt));
		var vbtn = el("button", "mce-btn mce-gold", "一键修复誓言");
		vbtn.type = "button";
		vbtn.addEventListener("click", function () {
			var r = fixVows();
			setStatus(r.message, "mce-ok");
			renderGlobal();
		});
		vrow.appendChild(vbtn);
		pane.appendChild(vrow);
		var traits = listNpcTraits();
		pane.appendChild(el("div", "mce-hint", "NPC 特质 " + traits.length + " 项：获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。「艾弗里的救星」支持庇护模式与撤回。"));
		var tbox = el("div", "");
		traits.forEach(function (t) {
			if (t.key === "avery_saviour") {
				/* v1.9.2：救星特质双模式 + 撤回（庇护模式不碰 avery_fate，大楼保留） */
				var v2 = getV();
				var shelterOn = v2.mceAveryShelter === true;
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", (t.owned ? "✓ " : "") + t.name + "（" + t.en + "）——" + t.desc + (shelterOn ? "　【庇护模式生效中：大楼保留建造进度】" : (t.owned ? "　【原版线：高塔烧毁】" : ""))));
				if (t.owned) {
					var rbtn = el("button", "mce-btn mce-red", "撤回（恢复操作前状态）");
					rbtn.type = "button";
					rbtn.title = "移除救星标记/庇护标记，并按操作前快照还原 avery_fate，大楼/高塔恢复原状";
					(function (t2) {
						rbtn.addEventListener("click", function () {
							var r = revertNpcTrait(t2.key);
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(rbtn);
				} else {
					var b1 = el("button", "mce-btn mce-gold", "获取（原版线）");
					b1.type = "button";
					b1.title = "avery_fate = saved，高塔转烧毁态（原版 Save Avery 结局线）";
					(function (t2) {
						b1.addEventListener("click", function () {
							var r = grantNpcTrait(t2.key, "saved");
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(b1);
					var b2 = el("button", "mce-btn mce-gold", "获取（庇护模式）");
					b2.type = "button";
					b2.title = "不碰 avery_fate，保留大楼/高塔建造进度，只获得救星效果（不走救星结局线）";
					(function (t2) {
						b2.addEventListener("click", function () {
							var r = grantNpcTrait(t2.key, "shelter");
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(b2);
				}
				tbox.appendChild(row);
				return;
			}
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", (t.owned ? "✓ " : "") + t.name + "（" + t.en + "）——" + t.desc));
			var btn = el("button", "mce-btn" + (t.owned ? "" : " mce-gold"), t.owned ? "已拥有" : "获取");
			btn.type = "button";
			btn.disabled = t.owned;
			btn.addEventListener("click", function () {
				var r = grantNpcTrait(t.key);
				setStatus(r.ok ? r.message : r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			row.appendChild(btn);
			tbox.appendChild(row);
		});
		pane.appendChild(tbox);

		/* v1.8.8：战斗终结（学 CombatTerminator 0.1：8 个战斗内一键按钮，直接写原版战斗值）。
		   原模组为 TweeReplacer 注入到战斗 widget；此处为 MCE 全局页即时按钮，等价写入。
		   v1.8.9：动作定义下沉至 03-global.js（COMBAT_ACTIONS/mcCombatAction），UI 只负责渲染。 */
		var btsec = el("div", "mce-section", "战斗终结（学 CombatTerminator 0.1：战斗中可用，直接写原版战斗值）");
		pane.appendChild(btsec);
		btsec.appendChild(el("div", "mce-hint", "以下按钮直接写原版战斗值，建议战斗中生效；「结束集群」在战斗外会把游戏时钟拨回当日 0 点，请勿误点。"));
		COMBAT_ACTIONS.forEach(function (d) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", d.desc));
			var btn = el("button", "mce-btn mce-gold", d.name);
			btn.type = "button";
			btn.addEventListener("click", function () {
				var r = mcCombatAction(d.key);
				setStatus(r.ok ? "已执行「" + r.name + "」" : r.message, r.ok ? "mce-ok" : "mce-err");
			});
			row.appendChild(btn);
			btsec.appendChild(row);
		});

		/* v1.8.8：庄园自动维护（学 AutoClean 0.1.5）
		   v1.9.x：一键按钮 → 自动开关。点击开关切换开启/关闭；开启即立即执行一次（即时生效），
		   此后每日（Time.days 变化）由 mbCEOnPassageInit 自动执行。开关持久化 localStorage
		   （mbCE_auto），不写 V → 不污染存档、新档不继承。 */
		var acsec = el("div", "mce-section", "庄园自动维护（AutoClean 模式：开启后每天自动执行，无需手点）");
		pane.appendChild(acsec);
		var acItems = [
			{ key: "feed", name: "自动投喂艾弗里", desc: "按喜好 → 牛排/舒芙蕾/扁意面 → 最高难度菜谱；未达喂食阶段（关系未确立）不操作" },
			{ key: "farm", name: "自动农场维护", desc: "塔卫在岗且技能≥1000 锁四畜 30 / 清 agro；库存收获为食物并清零（cream 仅清理）" },
			{ key: "temple", name: "自动神殿维护", desc: "housekeeping≥1000 时宿舍=100，tending≥1000 时花园=100（原版顶层技能判定）" },
			{ key: "eden", name: "自动伊甸维护", desc: "伊甸菜地/菇桶/泉水锁 4" },
			{ key: "restock", name: "自动补给", desc: "肥皂/药膏不足 10 时补 10；鹰塔火坑≥3 且木材不足 10 时补 10" },
			{ key: "clean", name: "自动庄园打扫", desc: "艾弗里关系确立后：全部房间计数归零 + days_absent 归零" }
		];
		acItems.forEach(function (it) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", it.desc));
			var btn = el("button", "mce-btn mce-gold", it.name + "（关）");
			btn.type = "button";
			var refresh = function () {
				btn.textContent = it.name + (mcAutoIsOn(it.key) ? "（开）" : "（关）");
			};
			btn.addEventListener("click", function () {
				var on = !mcAutoIsOn(it.key);
				mcAutoSet(it.key, on);
				if (on) {
					var r = mcAutoRunOnce(it.key);
					var msg;
					if (r.error) { msg = it.name + "执行失败：" + r.error; }
					else if (r.skipped) { msg = it.name + "已开启（本次跳过：艾弗里关系未确立）"; }
					else if (it.key === "feed") { msg = r.missed ? it.name + "已开启，本次无菜可喂（dinner_missed+1）" : it.name + "已开启，本次已喂食：" + r.fed; }
					else if (it.key === "farm") { msg = it.name + "已开启，本次锁满 " + r.beasts + " 只、收获 " + r.harvested + " 类库存"; }
					else if (it.key === "temple") { msg = it.name + "已开启，本次宿舍" + (r.quarters ? "=100" : "未达标跳过") + "、花园" + (r.garden ? "=100" : "未达标跳过"); }
					else if (it.key === "eden") { msg = it.name + "已开启，本次锁定 " + r.locked + " 项为 4"; }
					else if (it.key === "restock") { msg = it.name + "已开启，本次肥皂" + (r.soap ? "=10" : "跳过") + "、药膏" + (r.salve ? "=10" : "跳过") + "、鹰塔木材" + (r.wood ? "=10" : "跳过"); }
					else { msg = it.name + "已开启，本次执行完成"; }
					setStatus(msg, r.error ? "mce-err" : "mce-ok");
				} else {
					setStatus(it.name + "已关闭", "mce-err");
				}
				refresh();
			});
			refresh();
			row.appendChild(btn);
			acsec.appendChild(row);
		});

		/* v1.9.12：世界腐化（原版 World Corruption）数值调整
		   原版键：V.world_corruption_hard（世界硬腐化，罪孽/净化计数，原版宏 worldCorruption("hard",n) 钳 -30~30，初始 2）
		          V.world_corruption_soft（世界软腐化，世界异变程度，原版宏钳 0~100，初始 0）
		   语义（原版宏）：soft ≥30 增加怨灵聚合几率，≥70 触发校园衣物记忆；hard 负值走净化，净化量累计 world_corruption_reduced。
		   CE 直写 V 不经过原版 clamp：上限不钳制（数值填多少就是多少，原版事件驱动由游戏自身负责）；
		   下限按原版语义保留（hard ≥ -30，soft ≥ 0），防负值破坏。复用 placeStageWrite/placeStageUndo（原版顶层键直写 + 留痕回退）。 */
		var wcsec = el("div", "mce-section", "世界腐化（原版 World Corruption）");
		pane.appendChild(wcsec);
		wcsec.appendChild(el("div", "mce-hint", "世界硬腐化 world_corruption_hard（罪孽/净化计数，原版 -30~30 初始 2）；世界软腐化 world_corruption_soft（世界异变程度，原版 0~100 初始 0，≥30 增加怨灵聚合几率、≥70 触发校园衣物记忆）。直接填数值：上限不钳制，下限按原版语义保留；净化总量记录于 world_corruption_reduced。"));
		var Vg = getV();
		var makeWcUndo = function (row, it, val, inp) {
			var ub = el("button", "mce-btn mce-red", "回退");
			ub.type = "button";
			ub.title = "还原到首次写入前状态（写入前无该字段时直接删除）";
			ub.setAttribute("data-op", "wc-undo");
			ub.addEventListener("click", function () {
				var ru = placeStageUndo(it.key);
				setStatus(ru.message, ru.ok ? "mce-ok" : "mce-err");
				if (ru.ok) {
					var back = Number(getV() && getV()[it.key]) || 0;
					val.textContent = String(back);
					inp.value = String(back);
					var bb = row.querySelector('[data-op="wc-undo"]');
					if (bb && bb.parentNode) { bb.parentNode.removeChild(bb); }
				}
			});
			return ub;
		};
		[
			{ key: "world_corruption_hard", name: "世界硬腐化", min: -30 },
			{ key: "world_corruption_soft", name: "世界软腐化", min: 0 }
		].forEach(function (it) {
			var row = el("div", "mce-row");
			row.setAttribute("data-wckey", it.key);
			var cur = Number(Vg && Vg[it.key]) || 0;
			var lbl = el("span", "mce-row-lbl", it.name + "（" + it.key + "）当前 ");
			var val = el("span", "mce-value", String(cur));
			lbl.appendChild(val);
			row.appendChild(lbl);
			var inp = el("input", "mce-inp");
			inp.type = "number";
			inp.value = String(cur);
			inp.placeholder = String(cur);
			row.appendChild(inp);
			var apply = el("button", "mce-btn mce-gold", "应用");
			apply.type = "button";
			apply.addEventListener("click", function () {
				var r = placeStageWrite(it.key, Number(inp.value), it.min, Infinity);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) {
					val.textContent = String(r.after);
					inp.value = String(r.after);
					if (!row.querySelector('[data-op="wc-undo"]')) {
						row.appendChild(makeWcUndo(row, it, val, inp));
					}
				}
			});
			row.appendChild(apply);
			/* 已有写入留痕 → 初始即显示回退 */
			try {
				if (Vg && Vg.mbCE_wrote && Vg.mbCE_wrote["place:" + it.key]) {
					row.appendChild(makeWcUndo(row, it, val, inp));
				}
			} catch (e) {}
			wcsec.appendChild(row);
		});

		/* v1.9.15 数值固定（07f-lock.js）：预设推荐 + 自定义 varPath 锁定向，1s 强制写回 */
		mbCERenderLock(pane);
	}
