/* 职责：玩家的游戏 · 页面渲染（顶层页签 player）。
   结构：总览 hero → 工具条（全开/全关/恢复默认/被动/模式/搜索）→ 预设条 → 七个分组卡片。
   口径：打开页面/搜索/收藏不授予特质；只有切开关、一键、预设、切模式才授予。 */
	function mbCEPGSetStatusSafe(r) {
		try { setStatus((r && r.message) || "", (r && r.ok) ? MCE_CLS.ok : MCE_CLS.err); } catch (e) {}
	}
	function mbCEPGSubOpen(id) {
		try {
			var v = (mbCEUiState && mbCEUiState.collapsed) ? mbCEUiState.collapsed["pgsub:" + id] : null;
			return v === 0;
		} catch (e) { return false; }
	}
	function mbCEPGToggleSubOpen(id, expanded, btn, panel) {
		panel.setAttribute("data-collapsed", expanded ? "0" : "1");
		btn.textContent = (expanded ? "▾ " : "▸ ") + "子开关";
		try {
			mbCEUiState.collapsed = mbCEUiState.collapsed || {};
			mbCEUiState.collapsed["pgsub:" + id] = expanded ? 0 : 1;
			mbCEUiSave({ collapsed: mbCEUiState.collapsed });
		} catch (e) {}
	}
	function mbCEPGMakeSwitch(on, labelOn, labelOff, handler) {
		var b = el("button", "mce-pg-sw" + (on ? " on" : ""), on ? (labelOn || "开") : (labelOff || "关"));
		b.type = "button";
		b.setAttribute("aria-pressed", on ? "true" : "false");
		b.title = on ? "点击关闭" : "点击开启";
		b.addEventListener("click", handler);
		return b;
	}
	function mbCEPGMakeTags(entry, card) {
		if (!entry.tags || !entry.tags.length) { return; }
		var tags = el("div", "mce-pg-tags");
		entry.tags.forEach(function (t) { tags.appendChild(el("span", "mce-pg-tag", t)); });
		card.appendChild(tags);
	}
	function mbCEPGMakeSubs(entry, st, card) {
		if (!entry.subs || !entry.subs.length) { return; }
		var subWrap = el("div", "mce-pg-subwrap");
		var subBtn = el("button", "mce-pg-subtog", "");
		subBtn.type = "button";
		var panel = el("div", "mce-pg-subs");
		var expanded = mbCEPGSubOpen(entry.id);
		panel.setAttribute("data-collapsed", expanded ? "0" : "1");
		subBtn.textContent = (expanded ? "▾ " : "▸ ") + "子开关（" + entry.subs.length + "）";
		subBtn.addEventListener("click", function () {
			var now = panel.getAttribute("data-collapsed") !== "0";
			mbCEPGToggleSubOpen(entry.id, now, subBtn, panel);
		});
		entry.subs.forEach(function (s) {
			var son = mbCEPGSubOn(entry.id, s.id, st);
			var row = el("div", "mce-pg-subrow");
			row.appendChild(el("span", "mce-pg-subname", s.name));
			row.appendChild(mbCEPGMakeSwitch(son, "开", "关", function () {
				mbCEPGSetStatusSafe(mbCEPGSetSub(entry.id, s.id, !mbCEPGSubOn(entry.id, s.id, st)));
				renderPlayerGame();
			}));
			panel.appendChild(row);
		});
		subWrap.appendChild(subBtn);
		subWrap.appendChild(panel);
		card.appendChild(subWrap);
	}
	function mbCEPGMakeCard(entry, st) {
		var on = st.on[entry.id] === 1;
		var card = el("div", "mce-pg-card" + (on ? " on" : ""));
		card.setAttribute("data-pg-id", entry.id);
		card.setAttribute("data-search", (entry.name + " " + entry.desc + " " + (entry.tags || []).join(" ")).toLowerCase());
		var head = el("div", "mce-pg-card-h");
		head.appendChild(el("span", "mce-pg-ico mce-pg-ico-" + entry.group, entry.icon));
		head.appendChild(el("span", "mce-pg-name", entry.name));
		var fav = el("button", "mce-pg-fav", (st.fav && st.fav[entry.id] === 1) ? "★" : "☆");
		fav.type = "button";
		fav.title = "收藏 / 取消收藏（不授予特质）";
		fav.addEventListener("click", function () {
			mbCEPGFav(entry.id);
			renderPlayerGame();
		});
		head.appendChild(fav);
		head.appendChild(mbCEPGMakeSwitch(on, "开", "关", function () {
			mbCEPGSetStatusSafe(mbCEPGSet(entry.id, !(st.on[entry.id] === 1)));
			renderPlayerGame();
		}));
		card.appendChild(head);
		card.appendChild(el("div", "mce-pg-desc", entry.desc));
		mbCEPGMakeTags(entry, card);
		mbCEPGMakeSubs(entry, st, card);
		return card;
	}
	function mbCEPlayerGameFilter(pane, q) {
		var hits = 0;
		var needle = String(q || "").trim().toLowerCase();
		var groups = pane.querySelectorAll(".mce-group");
		var cards = pane.querySelectorAll(".mce-pg-card");
		cards.forEach(function (card) {
			var hit = !needle || (card.getAttribute("data-search") || "").indexOf(needle) !== -1;
			card.style.display = hit ? "" : "none";
			if (hit) { hits++; }
		});
		groups.forEach(function (g) {
			var body = g.querySelector(".mce-group-b");
			if (!body) { return; }
			var visible = body.querySelectorAll(".mce-pg-card:not([style*='display: none'])").length;
			g.style.display = visible ? "" : "none";
			if (needle && visible) { body.setAttribute("data-collapsed", "0"); }
		});
		var c = pane.querySelector(".mce-pg-count");
		if (c) { c.textContent = needle ? ("匹配 " + hits + " / 62") : ("已启用 " + mbCEPGStatus().on + " / 62"); }
	}
	function mbCEPGRenderToolbar(sec, st, pane) {
		var bar = el("div", "mce-pg-toolbar");
		var act = el("div", "mce-pg-actions");
		var bOn = el("button", "mce-btn mce-gold", "一键全开");
		bOn.type = "button"; bOn.title = "62 项 + 特质被动全开；不改变爽玩/原版模式";
		bOn.addEventListener("click", function () { mbCEPGSetStatusSafe(mbCEPGAll(true)); renderPlayerGame(); });
		var bOff = el("button", "mce-btn mce-red", "一键全关");
		bOff.type = "button"; bOff.title = "62 项 + 特质被动全关；特质保留";
		bOff.addEventListener("click", function () { mbCEPGSetStatusSafe(mbCEPGAll(false)); renderPlayerGame(); });
		var bReset = el("button", "mce-btn", "恢复默认");
		bReset.type = "button"; bReset.title = "62 项关 + 特质被动开 + 爽玩；特质保留";
		bReset.addEventListener("click", function () { mbCEPGSetStatusSafe(mbCEPGReset()); renderPlayerGame(); });
		var bPass = el("button", "mce-btn" + (st.passive ? " mce-btn-active" : ""), "特质被动" + (st.passive ? "：开" : "：关"));
		bPass.type = "button"; bPass.title = "特质被动：全属性 +10%，可单独关；特质本体永久保留";
		bPass.addEventListener("click", function () { mbCEPGSetStatusSafe(mbCEPGSetPassive(!st.passive)); renderPlayerGame(); });
		[bOn, bOff, bReset, bPass].forEach(function (b) { act.appendChild(b); });
		bar.appendChild(act);
		var mode = el("div", "mce-pg-mode");
		[["fun", "爽玩"], ["vanilla", "原版"]].forEach(function (p) {
			var mb = el("button", "mce-btn" + (st.mode === p[0] ? " mce-gold" : ""), p[1]);
			mb.type = "button";
			mb.addEventListener("click", function () { mbCEPGSetStatusSafe(mbCEPGSetMode(p[0])); renderPlayerGame(); });
			mode.appendChild(mb);
		});
		bar.appendChild(mode);
		var search = el("input", "mce-search-inp mce-pg-search");
		search.type = "search";
		search.placeholder = "搜索能力 / 效果 / 标签…";
		search.value = st.filter || "";
		search.addEventListener("input", function () {
			var cur = mbCEPGState();
			cur.filter = String(search.value || "");
			mbCEPlayerGameFilter(pane, cur.filter);
		});
		bar.appendChild(search);
		sec.appendChild(bar);
	}
	function mbCEPGRenderPresets(sec, st) {
		if (st.on.presets !== 1) { return; }
		var pre = el("div", "mce-pg-presets");
		pre.appendChild(el("span", "mce-pg-pre-label", "预设方案："));
		[["full", "全开"], ["library", "图书馆"], ["battle", "战斗"], ["life", "生活"]].forEach(function (p) {
			var pb = el("button", "mce-btn", p[1]);
			pb.type = "button";
			pb.addEventListener("click", function () { mbCEPGSetStatusSafe(mbCEPGPreset(p[0])); renderPlayerGame(); });
			pre.appendChild(pb);
		});
		sec.appendChild(pre);
	}
	function mbCEPGRenderGroups(sec, st) {
		MB_CE_PG_GROUPS.forEach(function (g) {
			var items = MB_CE_PG_REGISTRY.filter(function (e) { return e.group === g.id; });
			if (!items.length) { return; }
			var gbody = mceNewGroup(sec, g.title, g.sub + " · " + items.length + " 项", false);
			var grid = el("div", "mce-pg-grid");
			items.forEach(function (e) { grid.appendChild(mbCEPGMakeCard(e, st)); });
			gbody.appendChild(grid);
		});
	}
	function renderPlayerGame() {
		var pane = root ? root.querySelector('[data-pane="player"]') : null;
		if (!pane) { return; }
		var bodyEl = root ? root.querySelector(".mce-body") : null;
		var keepTop = (bodyEl && pane.classList.contains("mce-active")) ? bodyEl.scrollTop : 0;
		pane.textContent = "";
		var st = mbCEPGState();
		var sec = mceNewSec(pane, 1, "总览", "62 项纯增益 · 每项独立开关 · 不依赖任何外部模组");
		var hero = el("div", "mce-pg-hero");
		if (typeof MB_CE_PG_ART === "string" && MB_CE_PG_ART) {
			hero.setAttribute("data-art", "embedded");
			hero.style.backgroundImage = "linear-gradient(115deg,rgba(8,8,10,.94) 0%,rgba(26,20,8,.82) 46%,rgba(8,8,10,.96) 100%),url(\"" + MB_CE_PG_ART + "\")";
		}
		var heroText = el("div", "mce-pg-hero-text");
		heroText.appendChild(el("div", "mce-pg-kicker", "PLAYER'S GAME"));
		heroText.appendChild(el("div", "mce-pg-title", "玩家的游戏"));
		heroText.appendChild(el("div", "mce-pg-sub", "把整座图书馆的权柄收进一个页签；打开任一项，特质「玩家的游戏」永久到手。"));
		var badges = el("div", "mce-pg-badges");
		badges.appendChild(el("span", "mce-pg-badge", "已启用 " + mbCEPGStatus().on + " / 62"));
		badges.appendChild(el("span", "mce-pg-badge", st.trait === 1 ? "特质：已授予" : "特质：待首次启用"));
		badges.appendChild(el("span", "mce-pg-badge", "模式：" + (st.mode === "fun" ? "爽玩" : "原版")));
		heroText.appendChild(badges);
		hero.appendChild(el("div", "mce-pg-hero-mark", "玩"));
		hero.appendChild(heroText);
		sec.appendChild(hero);

		mbCEPGRenderToolbar(sec, st, pane);
		mbCEPGRenderPresets(sec, st);
		sec.appendChild(el("div", "mce-hint", "默认 62 项全关；打开任一项即授予特质。主开关关闭时子开关逻辑关闭但状态保留；单独点子开关会自动打开主开关。"));
		mbCEPGRenderGroups(sec, st);
		var count = el("div", "mce-pg-count");
		count.textContent = "已启用 " + mbCEPGStatus().on + " / 62";
		pane.appendChild(count);
		mbCEPlayerGameFilter(pane, st.filter);
		mceRestoreScroll(bodyEl, keepTop);
	}
	function mbCEPlayerGameRenderEntry(host) {
		if (!host) { return; }
		var st = mbCEPGState();
		var n = mbCEPGStatus().on;
		var card = el("div", "mce-pg-entry");
		var left = el("div", "mce-pg-entry-l");
		left.appendChild(el("span", "mce-pg-entry-ico", "玩"));
		var txt = el("div", "mce-pg-entry-t");
		txt.appendChild(el("div", "mce-pg-entry-name", "玩家的游戏"));
		txt.appendChild(el("div", "mce-pg-entry-sub", "62 项纯增益 · 每项独立开关 · 不依赖外部模组"));
		left.appendChild(txt);
		card.appendChild(left);
		var right = el("div", "mce-pg-entry-r");
		right.appendChild(el("span", "mce-pg-badge", n + " / 62 已开"));
		right.appendChild(el("span", "mce-pg-badge", st.trait === 1 ? "特质已授予" : "待首次启用"));
		var openBtn = el("button", "mce-btn mce-gold", "打开玩家的游戏 →");
		openBtn.type = "button";
		openBtn.addEventListener("click", function () { switchOuterTab("player"); });
		right.appendChild(openBtn);
		card.appendChild(right);
		host.appendChild(card);
	}
