	/* ---- 角色一览卡片（v1.9.0：按类型拆子页面，按钮展开/收起） ---- */
	/* 分类顺序：模组角色 / 恋爱角色 / 普通角色 / 持久NPC（子页面名称按角色类型命名） */
	var CHAR_CATEGORIES = [
		{ cat: "mod", title: "模组角色", desc: "非原版角色池的角色（MOD 注入/框架注册）" },
		{ cat: "love", title: "恋爱角色", desc: "官方恋人清单 + 框架恋爱条件角色" },
		{ cat: "normal", title: "普通角色", desc: "原版普通命名 NPC" },
		{ cat: "pernpc", title: "持久NPC", desc: "经理/校医/黑客/主教/守卫/囚犯等持久特殊 NPC" }
	];
	function charSectionKey(cat) { return "角色:" + cat; }
	function renderCards() {
		var pane = root.querySelector('[data-pane="char"]');
		var keepScroll = typeof pane.scrollTop === "number" ? pane.scrollTop : 0; /* 重建后保持滚动位置（五巡一致） */
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架（window.maplebirch / setup.MapleBirch）。"));
			return;
		}
		var chars = listCharacters();
		if (!chars.length) {
			pane.appendChild(el("div", "mce-hint", "注册池为空：未枚举到任何角色。"));
			return;
		}
		pane.appendChild(el("div", "mce-hint", "共 " + chars.length + " 个角色（自动枚举：本体 + 全部 MOD + 持久 NPC），按类型分组收起，点击分组标题展开。"));
		CHAR_CATEGORIES.forEach(function (group) {
			var members = chars.filter(function (n) { return charCategory(n) === group.cat; });
			var block = el("div", "mce-grp");
			block.setAttribute("data-tcat", group.title);
			var head = el("div", "mce-grp-t mce-collapse-head");
			head.title = group.desc + "——点击展开/收起";
			var stored = mbCEUiState.collapsed && mbCEUiState.collapsed[charSectionKey(group.cat)] != null
				? Number(mbCEUiState.collapsed[charSectionKey(group.cat)]) : 1;
			var open = stored === 0;
			head.textContent = (open ? "▾ " : "▸ ") + group.title + "（" + members.length + "）";
			block.appendChild(head);
			var body = el("div", "mce-grp-body");
			body.setAttribute("data-collapsed", open ? "0" : "1");
			if (members.length) {
				var grid = el("div", "mce-cards");
				members.forEach(function (name) {
					var npc = findNpcEx(name);
					var st = getNpcState(name);
					var active = st.state !== "dismissed";
					var card = el("div", "mce-card" + (name === curName ? " mce-sel" : ""));
					var top = el("div", "mce-card-top");
					top.appendChild(el("span", "mce-card-name", displayNameEx(name)));
					var badge = el("span", "mce-badge " + (active ? "mce-on" : "mce-off"), active ? "活跃" : "停用");
					badge.title = "state: " + st.state;
					top.appendChild(badge);
					card.appendChild(top);
					var stats = el("div", "mce-card-stats");
					stats.appendChild(el("span", "", "爱意 <b>" + statValue(npc, name, STAT_DEFS[0]) + "</b>"));
					stats.appendChild(el("span", "", "支配 <b>" + statValue(npc, name, STAT_DEFS[2]) + "</b>"));
					stats.appendChild(el("span", "", "情欲 <b>" + statValue(npc, name, STAT_DEFS[1]) + "</b>"));
					stats.appendChild(el("span", "", "警戒 <b>" + statValue(npc, name, STAT_DEFS[5]) + "</b>"));
					card.appendChild(stats);
					card.addEventListener("click", function () {
						curName = name;
						mbCEUiSave({ curName: name }); /* v1.8.12 二轮优化：记住当前操作角色 */
						switchOuterTab("stage");
					});
					grid.appendChild(card);
				});
				body.appendChild(grid);
			} else {
				body.appendChild(el("div", "mce-hint", "（该分类暂无角色）"));
			}
			block.appendChild(body);
			head.addEventListener("click", function () {
				var nowOpen = body.getAttribute("data-collapsed") === "0";
				body.setAttribute("data-collapsed", nowOpen ? "1" : "0");
				head.textContent = (nowOpen ? "▸ " : "▾ ") + group.title + "（" + members.length + "）";
				mbCEUiState.collapsed = mbCEUiState.collapsed || {};
				mbCEUiState.collapsed[charSectionKey(group.cat)] = nowOpen ? 1 : 0;
				mbCEUiSave({ collapsed: mbCEUiState.collapsed });
			});
			pane.appendChild(block);
		});
		if (typeof pane.scrollTop === "number") { pane.scrollTop = keepScroll; }
	}
