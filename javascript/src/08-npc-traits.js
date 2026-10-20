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
			owned: function () { return getV().avery_fate === "saved"; },
			grant: function () { getV().avery_fate = "saved"; return { ok: true, message: "已满足「艾弗里的救星」条件（avery_fate = saved）" }; } }
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
	// 获取指定 NPC 特质：条件不满足时直接把条件变量改为满足
	function grantNpcTrait(key) {
		var t = null, i;
		for (i = 0; i < NPC_TRAITS.length; i++) { if (NPC_TRAITS[i].key === key) { t = NPC_TRAITS[i]; break; } }
		if (!t) { return { ok: false, message: "未知特质 " + key }; }
		return t.grant();
	}

	function renderGlobal() {
		var pane = root.querySelector('[data-pane="global"]');
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架。"));
			return;
		}
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
		pane.appendChild(el("div", "mce-hint", "NPC 特质 " + traits.length + " 项：获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。"));
		var tbox = el("div", "");
		traits.forEach(function (t) {
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

		/* v1.8.8：庄园自动维护（学 AutoClean 0.1.5：即时执行原模组每日 0 点的维护逻辑）
		   v1.8.9：按钮改为 mce-row 结构（说明 + 按钮），与战斗终结区样式一致；投喂未达喂食阶段提示 skipped */
		var acsec = el("div", "mce-section", "庄园自动维护（学 AutoClean 0.1.5：即时执行投喂/农场/神殿/伊甸/补给/打扫）");
		pane.appendChild(acsec);
		var a1row = el("div", "mce-row");
		a1row.appendChild(el("span", "mce-row-lbl", "按喜好 → 牛排/舒芙蕾/扁意面 → 最高难度菜谱；未达喂食阶段（关系未确立）不操作"));
		var a1 = el("button", "mce-btn mce-gold", "一键投喂艾弗里");
		a1.type = "button";
		a1.addEventListener("click", function () {
			var r = mcFeedAvery();
			if (r.error) { setStatus("投喂失败：" + r.error, "mce-err"); return; }
			if (r.skipped) { setStatus("未达喂食阶段（艾弗里关系未到 saved/ascended），未操作", "mce-err"); return; }
			setStatus(r.missed ? "无菜可喂，dinner_missed +1" : "已喂食：" + r.fed, r.missed ? "mce-err" : "mce-ok");
		});
		a1row.appendChild(a1);
		var a2row = el("div", "mce-row");
		a2row.appendChild(el("span", "mce-row-lbl", "塔卫≥1000 锁四畜 30 / 清 agro / 库存收获并清零（与 AutoClean 每日 0 点逻辑一致）"));
		var a2 = el("button", "mce-btn mce-gold", "一键农场维护");
		a2.type = "button";
		a2.addEventListener("click", function () {
			var r = mcMaintainFarm();
			if (r.error) { setStatus("维护失败：" + r.error, "mce-err"); return; }
			setStatus("动物锁满 " + r.beasts + " 只" + (r.aggro ? "，agro 已清零" : "") + "，收获 " + r.harvested + " 类库存", "mce-ok");
		});
		a2row.appendChild(a2);
		acsec.appendChild(a1row);
		acsec.appendChild(a2row);
		/* v1.8.10：补全 AutoClean 维护面（神殿/伊甸/补给/打扫），保持 mce-row 结构 */
		var a3row = el("div", "mce-row");
		a3row.appendChild(el("span", "mce-row-lbl", "神殿防衰减：housekeeping≥1000 时宿舍=100，tending≥1000 时花园=100（对齐 AutoClean 条件锁值）"));
		var a3 = el("button", "mce-btn mce-gold", "一键神殿维护");
		a3.type = "button";
		a3.addEventListener("click", function () {
			var r = mcMaintainTemple();
			if (r.error) { setStatus("神殿维护失败：" + r.error, "mce-err"); return; }
			setStatus((r.quarters || r.garden) ? "神殿维护完成：宿舍" + (r.quarters ? "=100" : "未达标跳过") + "、花园" + (r.garden ? "=100" : "未达标跳过") : "技能未达标（housekeeping/tending 需≥1000），未操作", (r.quarters || r.garden) ? "mce-ok" : "mce-err");
		});
		a3row.appendChild(a3);
		var a4row = el("div", "mce-row");
		a4row.appendChild(el("span", "mce-row-lbl", "伊甸菜地/菇桶/泉水锁 4（与 AutoClean 每日 0 点无条件锁值一致）"));
		var a4 = el("button", "mce-btn mce-gold", "一键伊甸维护");
		a4.type = "button";
		a4.addEventListener("click", function () {
			var r = mcMaintainEden();
			if (r.error) { setStatus("伊甸维护失败：" + r.error, "mce-err"); return; }
			setStatus("伊甸维护完成：锁定 " + r.locked + " 项为 4", "mce-ok");
		});
		a4row.appendChild(a4);
		var a5row = el("div", "mce-row");
		a5row.appendChild(el("span", "mce-row-lbl", "肥皂/药膏补 10，鹰塔木材补 10（与 AutoClean 每日 0 点补货一致）"));
		var a5 = el("button", "mce-btn mce-gold", "一键补给");
		a5.type = "button";
		a5.addEventListener("click", function () {
			var r = mcRestockSupplies();
			if (r.error) { setStatus("补给失败：" + r.error, "mce-err"); return; }
			setStatus("补给完成：肥皂" + (r.soap ? "=10" : "跳过") + "、药膏" + (r.salve ? "=10" : "跳过") + "、鹰塔木材" + (r.wood ? "=10" : "跳过"), "mce-ok");
		});
		a5row.appendChild(a5);
		var a6row = el("div", "mce-row");
		a6row.appendChild(el("span", "mce-row-lbl", "艾弗里豪宅全部房间清理 + days_absent 归零（动态枚举房间，适配原版结构变化）"));
		var a6 = el("button", "mce-btn mce-gold", "一键庄园打扫");
		a6.type = "button";
		a6.addEventListener("click", function () {
			var r = mcCleanMansion();
			if (r.error) { setStatus("庄园打扫失败：" + r.error, "mce-err"); return; }
			setStatus("庄园打扫完成：清理 " + r.rooms + " 间房" + (r.days ? "，days_absent 归零" : ""), "mce-ok");
		});
		a6row.appendChild(a6);
		acsec.appendChild(a3row);
		acsec.appendChild(a4row);
		acsec.appendChild(a5row);
		acsec.appendChild(a6row);
	}
