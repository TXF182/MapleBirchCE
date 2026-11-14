/* 职责：特殊古董清单 —— 全集状态中文 / 单件收集 / 状态清单 */
	/* 特殊古董单列（v2.1.2；结构门禁 S1：07l-vanilla-ext.js 加本表后 449 行超 400 上限，同 07l-vanilla-ext-view.js 先例）。
	   本段只放「特殊古董清单 + 状态中文 + 单件收集 + 状态清单」，一键收齐与留痕仍在 07l-vanilla-ext.js。
	   取证（DoL 0.5.12.13 单行 HTML）：
	   - `<<widget "updateMuseumAntiques">>` L609341–L609404 是 `$museumAntiques.antiques` 的**全集 63 件**，
	     不是 64 件（旧文案按 CE 的 58 件白名单加画作反推，已更正）。
	   - L188980 起的每次 passage 初始化块 `<<if $necklaceThief is undefined>>` 三分支里，
	     `antiqueivorynecklace isnot "notFound"` → `$necklaceThief = "player"`；
	     也就是项链一旦写成 found，原版会把 Wraith 项链回收线判定为「玩家已发现」。必须显式落地这个副作用。
	   - `antiquegoldchastitybelt` 全 HTML 只在博物馆价格表（L190320）出现，无剧情副作用。
	   - CE 1.20.4 的 changeLog 声明排除三件（黃金貞操帶 / 象牙項鍊 / 詛咒硬幣），
	     但其 58 件白名单实际只漏前两件；第三件「詛咒硬幣」在原版 63 件里**没有对应键**
	     （全 HTML 无 `antique*curse*` 键；`cursed` 是服装属性字段，不是古董）——不做假键。 */
	var MCE_VANILLA_SPECIAL_ANTIQUES = {
		antiquegoldchastitybelt: "黄金贞操带",
		antiqueivorynecklace: "象牙项链"
	};
	/* 古董状态的中文展示（原版 museumAntiqueStatus L608803–L608813 的状态机取值） */
	var MCE_VANILLA_ANTIQUE_STATE_ZH = {
		notFound: "未发现",
		found: "已发现未上交",
		talk: "已谈话未发展",
		museum: "已上交博物馆",
		stolen: "已上交（被盗）",
		recovered: "已上交（追回）"
	};
	function mbCEVanillaAntiqueStateZh(s) {
		var k = String(s === undefined ? "" : s);
		return MCE_VANILLA_ANTIQUE_STATE_ZH[k] || (k || "空");
	}

	/* 单件收集：只动目标键的 notFound → found；象牙项链顺带把 $necklaceThief 的隐含判定显式落地。
	   留痕 id 为 `antique-<key>`，与一键收齐的 `antique` 各自独立回退。 */
	function mbCEVanillaAntiqueCollectOne(key) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var ma = mbCEVanillaAntiqueState();
		if (!ma) { return { ok: false, message: "未找到 $museumAntiques（该存档还没进入博物馆线）" }; }
		var label = MCE_VANILLA_SPECIAL_ANTIQUES[key];
		if (!label) { return { ok: false, message: "未知的特殊古董键：" + String(key) }; }
		if (!Object.prototype.hasOwnProperty.call(ma.antiques, key)) {
			return { ok: false, message: "该存档的 $museumAntiques 里没有 " + key + "（旧存档未补全该键，进一次博物馆线会自动补）" };
		}
		var cur = ma.antiques[key];
		if (cur !== "notFound") {
			return { ok: true, changed: false, message: "「" + label + "」当前是「" + mbCEVanillaAntiqueStateZh(cur) + "」，不是未发现，未改写。" };
		}
		var before = mbCEVanillaAntiqueBefore(V, ma);
		ma.antiques[key] = "found";
		var note = "「" + label + "」已写成「已发现未上交」";
		if (key === "antiqueivorynecklace") {
			if (V.necklaceThief === undefined) {
				V.necklaceThief = "player";
				before.necklaceChanged = true;
				note += "；$necklaceThief 同步写为 player（原版 L188980 在项链非 notFound 时即按此判定，这里显式落地，避免下游 widget 再判一次时状态不确定）";
			} else {
				note += "；$necklaceThief 已是「" + String(V.necklaceThief) + "」，保留原值未覆盖";
			}
		}
		if (!(Number(ma.maxCount) > 0)) { ma.maxCount = Object.keys(ma.antiques).length; }
		mbCEVanillaTrace("antique-" + key, before, "museumAntiques.antiques." + key, "单件收集特殊古董：" + label);
		return { ok: true, changed: true, key: key, message: note + "。可在「统一回退中心」单独还原这一件。" };
	}

	/* 特殊古董状态清单（UI 三键的数据源）：两件真实键 + 第三件「诅咒硬币」占位（原版无此键，exists=false） */
	function mbCEVanillaAntiqueSpecials() {
		var ma = mbCEVanillaAntiqueState();
		var out = [];
		Object.keys(MCE_VANILLA_SPECIAL_ANTIQUES).forEach(function (k) {
			var exists = !!(ma && ma.antiques && Object.prototype.hasOwnProperty.call(ma.antiques, k));
			out.push({
				key: k,
				label: MCE_VANILLA_SPECIAL_ANTIQUES[k],
				exists: exists,
				status: exists ? String(ma.antiques[k]) : "",
				statusZh: exists ? mbCEVanillaAntiqueStateZh(ma.antiques[k]) : "该存档无此键"
			});
		});
		out.push({
			key: "",
			label: "诅咒硬币",
			exists: false,
			status: "",
			statusZh: "原版 63 件古董中无对应键",
			note: "CE 1.20.4 changeLog 声明排除此项，但其 58 件白名单里也无对应键；全 HTML 搜 antique*curse* 零命中"
		});
		return out;
	}
