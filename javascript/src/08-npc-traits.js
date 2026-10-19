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
	}
