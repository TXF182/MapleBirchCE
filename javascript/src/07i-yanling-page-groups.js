	/* 职责：言灵页（07i）调度与渲染工具 —— 状态行 / 操作按钮 / 读数文本 helper + A~D 四组按视觉顺序调用区块函数
	   （区块实现见 07i-yanling-page-sections.js；面板骨架见 07i-yanling-page.js）。
	   分层原因：renderYanling 原为 365 行单函数（圈复杂度 132，Archify COMP-fa47d1743fa9，2026-11-25 体检）；
	   组粒度仍留 4 个 >10 函数（复杂度棘轮 158→161），区块粒度再留 6 个（161→163），故把读数拼串也逐个抽成
	   小函数（每个 ≤10）——渲染函数只做「建块 + 顺序调用」，复杂度落到各 helper 自身。
	   行为契约：smoke_dom.js「言灵页结构指纹」三断言（分组标题+副标 / 区块编号+标题 / 按钮数+文案哈希），拆分前后必须一字不差。 */

	/* 状态行（原 renderYanling 内联闭包 mkStatus：无外部状态，直接提到模块级） */
	function mbCEYanlingRenderStatus(sec, on, onText, offText) {
		var row = el("div", MCE_CLS.row);
		row.appendChild(el("span", MCE_CLS.rowLbl, "当前状态："));
		row.appendChild(el("span", "mce-value", on ? onText : offText));
		sec.appendChild(row);
	}

	/* 操作按钮（原内联闭包 mkBtn：网格容器内直接 append，否则套一层 mce-row；点击后闪烁 + 整页重渲染） */
	function mbCEYanlingRenderBtn(sec, text, cls, fn, tip) {
		var isGrid = !!(sec && sec.classList && sec.classList.contains("mce-btn-grid"));
		var b = el("button", "mce-btn " + (cls || ""), text);
		b.type = "button";
		if (tip) { b.title = tip; }
		b.addEventListener("click", function () {
			var r = fn();
			if (r && r.msg) { setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err); }
			mbCEFlashRow(b);
			renderYanling();
		});
		if (isGrid) {
			/* v2.0.2 按键排版：网格容器内不再套一层 mce-row（每格直接一个按钮） */
			sec.appendChild(b);
		} else {
			var row = el("div", MCE_CLS.row);
			row.appendChild(b);
			sec.appendChild(row);
		}
		return b;
	}

	/* ① 运行时诊断行（原 SecCrossdress 内联：钩子挂载态 + $crossdressing 现值） */
	function mbCEYanlingCrossdressDiag(s1, st, V, hooked) {
		var diag = el("div", MCE_CLS.row);
		diag.appendChild(el("span", MCE_CLS.rowLbl, "运行时诊断："));
		var hookedTxt = hooked ? "钩子已挂载" : ((st && st.noCross === true) ? "钩子未挂载（游戏脚本未就绪或已被重载）" : "未启用（开关关闭时不挂钩子）");
		diag.appendChild(el("span", "mce-value", hookedTxt + " ｜ $crossdressing = " + (V && V.crossdressing !== undefined ? String(V.crossdressing) : "—")));
		s1.appendChild(diag);
	}

	/* ② 异装癖特质检测（原 SecTrait 内联 try：$backgroundTraits 是否含 crossdresser） */
	function mbCEYanlingHasCrossTrait(V) {
		try {
			var bt = V && V.backgroundTraits;
			return !!(bt && typeof bt.indexOf === "function" && bt.indexOf("crossdresser") !== -1);
		} catch (e0) { return false; }
	}

	/* ⑩ 躯干槽文本（原 SecLeaf 内联：over_upper / over_lower / upper / lower 四槽现值） */
	function mbCEYanlingLeafWornText(Vl) {
		if (!(Vl && Vl.worn)) { return "—"; }
		return ["over_upper", "over_lower", "upper", "lower"].map(function (sl) {
			var w1 = Vl.worn[sl];
			return sl + "：" + ((w1 && w1.name) ? String(w1.name) : "空");
		}).join(" ｜ ");
	}

	/* ⑩ 变装记录文本（原 SecLeaf 内联：$mbCE_yanling.leaf 的 stored / copied 件数） */
	function mbCEYanlingLeafRecText(Vl) {
		var lrec = (Vl && Vl.mbCE_yanling && Vl.mbCE_yanling.leaf && typeof Vl.mbCE_yanling.leaf === "object") ? Vl.mbCE_yanling.leaf : null;
		if (!lrec) { return "无记录"; }
		return "已变装（原衣 " + (Array.isArray(lrec.stored) ? lrec.stored.length : 0) + " 件在衣柜，枝叶副本 " + (Array.isArray(lrec.copied) ? lrec.copied.length : 0) + " 件）";
	}

	/* ⑩ 两行状态一起取（原 SecLeaf 的 try/catch 边界：读数失败整组降级为占位符） */
	function mbCEYanlingLeafStatusText() {
		try {
			var Vl = getV();
			return [mbCEYanlingLeafWornText(Vl), mbCEYanlingLeafRecText(Vl)];
		} catch (eL) { return ["—", "无记录"]; }
	}

	/* ⑫ 作弊开关状态文本（原 SecCheat 内联：已开启（无副作用）/ 已开启 / 未开启） */
	function mbCEYanlingCheatOnState(Vc, gOn) {
		return (Vc && Vc.cheatsEnabled === true) ? (gOn ? "已开启（无副作用）" : "已开启") : "未开启";
	}

	/* ⑫ 成就状态文本（原 SecCheat 内联：豁免生效时成就照常可拿，否则看 $feats.locked） */
	function mbCEYanlingCheatFeatState(Vc, gOn) {
		return gOn ? "成就照常可拿" : ((Vc && Vc.feats && typeof Vc.feats === "object") ? (Vc.feats.locked === true ? "成就已锁" : "成就未锁") : "无成就对象");
	}

	/* ⑬ 格威岚 · 今日对话（原 SecGwylan 内联：clothesTalk/3 + 当日锁标记） */
	function mbCEYanlingGwTalkText(Vs) {
		var gt = (Vs && Vs.daily && Vs.daily.gwylan && typeof Vs.daily.gwylan === "object") ? Vs.daily.gwylan : {};
		return "话 " + (typeof gt.clothesTalk === "number" ? String(gt.clothesTalk) : "—") + "/3" + (gt.enoughTalk === true ? "（今日已锁）" : "");
	}

	/* ⑬ 仪式到期（原 SecGwylan 内联） */
	function mbCEYanlingGwRitualText(Vs) {
		var gws = (Vs && Vs.gwylan && typeof Vs.gwylan === "object") ? Vs.gwylan : {};
		var tt = (gws.timer && typeof gws.timer === "object") ? gws.timer : {};
		return (typeof tt.ritual === "number") ? "仪式到期 " + String(tt.ritual) : "未开仪式线";
	}

	/* ⑬ 当前委托（原 SecGwylan 内联） */
	function mbCEYanlingGwRequestText(Vs) {
		var gws = (Vs && Vs.gwylan && typeof Vs.gwylan === "object") ? Vs.gwylan : {};
		return (gws.request && gws.request.event) ? String(gws.request.event) : "无委托";
	}

	/* ⑬ 宠物床（原 SecGwylan 内联） */
	function mbCEYanlingGwPetBedText(Vs) {
		var gws = (Vs && Vs.gwylan && typeof Vs.gwylan === "object") ? Vs.gwylan : {};
		var tt = (gws.timer && typeof gws.timer === "object") ? gws.timer : {};
		return (typeof tt.petBed === "number") ? "床 " + String(tt.petBed) : "无床";
	}

	/* ⑬ 看海次数（原 SecGwylan 内联） */
	function mbCEYanlingGwSeaText(Vs) {
		var gws = (Vs && Vs.gwylan && typeof Vs.gwylan === "object") ? Vs.gwylan : {};
		return (typeof gws.sea === "number") ? String(gws.sea) : "—";
	}

	/* ⑬ 亲密仪式次数（原 SecGwylan 内联） */
	function mbCEYanlingGwSexText(Vs) {
		return (Vs && Vs.dateCount && typeof Vs.dateCount.GwylanSex === "number") ? String(Vs.dateCount.GwylanSex) : "—";
	}

	/* ⑬ 街机计数（原 SecGwylan 内联） */
	function mbCEYanlingGwArcText(Vs) {
		return (typeof Vs.tenyclusPlayCount === "number") ? String(Vs.tenyclusPlayCount) : "0";
	}

	/* ⑬ 催眠冷却（原 SecGwylan 内联） */
	function mbCEYanlingGwCdText(Vs) {
		var devS = Vs && Vs.hypnosisTimers && Vs.hypnosisTimers.devotion;
		return (devS && typeof devS.time === "number") ? String(devS.time) : "—";
	}

	/* ⑬ 项圈（原 SecGwylan 内联：name + 锁死/破损标记） */
	function mbCEYanlingGwCollarText(Vs) {
		var nkS = (Vs && Vs.worn && Vs.worn.neck && typeof Vs.worn.neck === "object") ? Vs.worn.neck : null;
		if (!nkS) { return "—"; }
		var base = nkS.name || "naked";
		if (nkS.cursed !== 1) { return base; }
		var broken = (Array.isArray(nkS.type) && nkS.type.indexOf("broken") !== -1) ? "·破损" : "";
		return base + "（已锁" + broken + "）";
	}

	/* A 组：① 无视着装性别 / ② 异装癖压制 / ③ 负面名声清零 / ⑩ 枝叶变装 */
	function mbCEYanlingRenderGroupA(g, ctx) {
		mbCEYanlingSecCrossdress(g, ctx);
		mbCEYanlingSecTrait(g, ctx);
		mbCEYanlingSecFame(g, ctx);
		mbCEYanlingSecLeaf(g, ctx);
	}

	/* B 组：④ 身体与衣物 / ⑤ 精神与体液 / ⑥ 数值快补 / ⑦ 天气 */
	function mbCEYanlingRenderGroupB(g, ctx) {
		mbCEYanlingSecCloth(g, ctx);
		mbCEYanlingSecMind(g, ctx);
		mbCEYanlingSecStats(g, ctx);
		mbCEYanlingSecWeather(g, ctx);
	}

	/* C 组：⑧ 角色放逐 / ⑨ 监狱庇护 / ⑬ 格威岚 · 森林商店 / ⑭ 绝望轮回 · 结局与成就 */
	function mbCEYanlingRenderGroupC(g, ctx) {
		mbCEYanlingSecBanish(g, ctx);
		mbCEYanlingSecPrison(g, ctx);
		mbCEYanlingSecGwylan(g, ctx);
		mbCEYanlingSecEndings(g, ctx);
	}

	/* D 组：⑪ 艾弗里办公室（补） / ⑫ 作弊模式（无副作用开启） */
	function mbCEYanlingRenderGroupD(g, ctx) {
		mbCEYanlingSecAvery(g, ctx);
		mbCEYanlingSecCheat(g, ctx);
	}
