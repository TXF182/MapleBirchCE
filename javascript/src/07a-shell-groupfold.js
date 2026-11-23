	/* 职责：可折叠二级分组容器 mceNewGroup（从 07a-shell.js 拆出，S1 单段预算）。
	   组头可点折叠，复用全局 data-collapsed 约定 + mbCEUiState.collapsed 持久化（key="group:"+title）。
	   第 4 参 collapsed=true 表示「无记忆时默认收起」（言灵页 A~E、全局页顶层组用它把长页收起来）；
	   缺省 false 保持向后兼容（区块内二级分组仍默认展开）。 */

	/* 读折叠态：优先记忆，无记忆按 collapsed 兜底（记忆值为 0 表示展开）。 */
	function mceReadGroupFold(gkey, collapsed) {
		var saved = (mbCEUiState && mbCEUiState.collapsed && mbCEUiState.collapsed[gkey] != null)
			? mbCEUiState.collapsed[gkey] : null;
		if (saved != null) { return Number(saved) === 0; }
		return !collapsed;
	}

	/* 切换折叠态并落记忆（箭头文案随态翻转）。 */
	function mceToggleGroupFold(body, head, gkey) {
		var willClose = body.getAttribute("data-collapsed") === "0";
		body.setAttribute("data-collapsed", willClose ? "1" : "0");
		var arrowEl = head.querySelector(".mce-group-arrow");
		if (arrowEl) { arrowEl.textContent = willClose ? "▸" : "▾"; }
		if (mbCEUiState && typeof mbCEUiSave === "function") {
			mbCEUiState.collapsed = mbCEUiState.collapsed || {};
			mbCEUiState.collapsed[gkey] = willClose ? 1 : 0;
			mbCEUiSave({ collapsed: mbCEUiState.collapsed });
		}
	}

	/* 二级分组：返回组内 body 容器（组名 + 右侧副标 + 折叠箭头）。 */
	function mceNewGroup(parent, title, sub, collapsed) {
		var g = el("div", "mce-group");
		var gkey = "group:" + String(title || "");
		var isOpen = mceReadGroupFold(gkey, collapsed);
		var head = el("div", "mce-group-h mce-group-fold-head");
		head.setAttribute("role", "button");
		head.setAttribute("tabindex", "0");
		head.title = (sub ? sub + " · " : "") + "点击展开 / 收起";
		head.appendChild(el("span", "", title));
		if (sub) { head.appendChild(el("span", "mce-group-n", sub)); }
		head.appendChild(el("span", "mce-group-arrow", isOpen ? "▾" : "▸"));
		g.appendChild(head);
		var body = el("div", "mce-group-b");
		body.setAttribute("data-collapsed", isOpen ? "0" : "1");
		g.appendChild(body);
		var onFold = function () { mceToggleGroupFold(body, head, gkey); };
		head.addEventListener("click", onFold);
		head.addEventListener("keydown", function (ev) {
			if (ev.key === "Enter" || ev.key === " " || ev.keyCode === 13 || ev.keyCode === 32) {
				ev.preventDefault();
				onFold();
			}
		});
		if (parent) { parent.appendChild(g); }
		return body;
	}
