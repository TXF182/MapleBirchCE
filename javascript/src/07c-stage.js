	/* ---- 阶段页：数据卡 + 双层内层标签 ---- */
	function renderStagePane() {
		var pane = root.querySelector('[data-pane="stage"]');
		pane.textContent = "";
		if (!curName) {
			var chars = listCharacters();
			curName = chars[0] || "";
		}
		if (!curName) {
			pane.appendChild(el("div", "mce-hint", "无角色可选。"));
			return;
		}
		var npc = findNpc(curName);
		var st = getNpcState(curName);
		var active = st.state !== "dismissed";

		/* 角色数据卡 */
		var card = el("div", "mce-data-card");
		var top = el("div", "mce-section", "角色：");
		card.appendChild(top);
		var head = el("div", "mce-stage-head");
		head.appendChild(el("span", "mce-stage-name", displayName(curName)));
		var badge = el("span", "mce-badge " + (active ? "mce-on" : "mce-off"), active ? "活跃" : "停用");
		badge.title = "state: " + st.state;
		head.appendChild(badge);
		card.appendChild(head);
		if (st.found) { card.appendChild(el("div", "mce-hint", "游戏状态 state = " + stateCN(st.state))); }
		if (!npc) { card.appendChild(el("div", "mce-hint", "未在 V.NPCName 中找到该角色的运行时对象（仅注册池存在）。")); }

		/* 数值行（含 ±10） */
		var defs = statDefsFor(curName);
		defs.forEach(function (def) {
			var row = el("div", "mce-statrow");
			row.appendChild(el("span", "mce-label", def.label));
			row.appendChild(el("span", "mce-value", String(statValue(npc, curName, def))));
			var m10 = el("button", "mce-btn", "-10");
			m10.type = "button";
			m10.addEventListener("click", function () {
				writeStat(npc, curName, def, statValue(npc, curName, def) - 10);
				renderStagePane();
			});
			var p10 = el("button", "mce-btn", "+10");
			p10.type = "button";
			p10.addEventListener("click", function () {
				writeStat(npc, curName, def, statValue(npc, curName, def) + 10);
				renderStagePane();
			});
			row.appendChild(m10);
			row.appendChild(p10);
			card.appendChild(row);
		});

		var actions = el("div", "mce-actions");
		var fillBtn = el("button", "mce-btn mce-gold", "一键补齐全部数值");
		fillBtn.type = "button";
		fillBtn.title = "爱意/情欲/支配/服从/信任 → 100，警戒/嫉妒 → 0（自定义属性取注册上限）";
		fillBtn.addEventListener("click", function () {
			var n = fillStats(npc, curName);
			renderStagePane();
			setStatus("已补齐「" + displayName(curName) + "」" + n + " 项数值", "mce-ok");
		});
		var romBtn = el("button", "mce-btn mce-gold", "一键解锁全部恋爱阶段");
		romBtn.type = "button";
		romBtn.addEventListener("click", function () {
			var r = unlockAllRomance(curName);
			renderStagePane();
			setStatus("「" + displayName(curName) + "」恋爱阶段：新解锁 " + r.fixed + " / " + r.total, r.fixed > 0 ? "mce-ok" : "mce-err");
		});
		var tfBtn = el("button", "mce-btn mce-gold", "一键解锁全部转化阶段");
		tfBtn.type = "button";
		tfBtn.addEventListener("click", function () {
			var n = unlockAllTransform(curName);
			renderStagePane();
			setStatus("「" + displayName(curName) + "」转化阶段解锁 " + n + " 个类型", "mce-ok");
		});
		actions.appendChild(fillBtn);
		actions.appendChild(romBtn);
		actions.appendChild(tfBtn);
		card.appendChild(actions);
		pane.appendChild(card);

		/* 内层标签（第二层） */
		var inner = el("div", "mce-inner");
		var bRom = el("button", curInnerTab === "romance" ? "mce-active" : "", "恋爱阶段");
		bRom.type = "button";
		bRom.addEventListener("click", function () { curInnerTab = "romance"; mbCEUiSave({ innerTab: "romance" }); renderStagePane(); });
		var bTf = el("button", curInnerTab === "transform" ? "mce-active" : "", "转化阶段");
		bTf.type = "button";
		bTf.addEventListener("click", function () { curInnerTab = "transform"; mbCEUiSave({ innerTab: "transform" }); renderStagePane(); });
		inner.appendChild(bRom);
		inner.appendChild(bTf);
		pane.appendChild(inner);

		if (curInnerTab === "romance") { renderRomanceStages(pane); }
		else { renderTransformStages(pane); }
	}

	/* 条件中文说明（展示层：把引擎条件源码翻译成"达成了什么"，非硬编码角色数据） */
	var TERM_CN = {
		"robinromance": "罗宾·恋人关系",
		"whitneyromance": "惠特尼·恋人关系",
		"sydneyromance": "悉尼·恋人关系",
		"kylarenglish": "凯拉尔线剧情进度",
		"syndromeeden": "伊甸·专属综合征（已建立伊甸关系）",
		"syndromewolves": "黑狼·狼群综合征",
		"syndromebird": "巨鹰·鸟类综合征",
		"farm_stage": "亚历克斯·农场阶段",
		"alex_countdown": "亚历克斯·事件倒计时",
		"auriga_artefact": "御夫座神器（艾弗里线剧情节点）",
		"gwylanSeen": "格威岚·恋爱经历",
		"lunaSeen": "露娜·恋爱经历",
		"zephyrSeen": "泽菲尔·恋爱经历",
		"ravenStory": "渡鸦·剧情进度",
		"wraithsreflection": "怨灵·剧情进度",
		"adian_romance": "阿电·恋人关系",
		"deviancy": "变态（deviancy）技能",
		"love": "爱意", "dom": "支配", "lust": "情欲"
	};
