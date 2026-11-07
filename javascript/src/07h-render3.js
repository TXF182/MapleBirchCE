/* 职责：剧情页分区渲染（renderSceneRegion） */
	function renderSceneRegion(pane2, title, keys, defs, byRole) {
		if (!keys.length) { return; }
		pane2.appendChild(el("div", "mce-section", title));
		var sub = {};
		keys.forEach(function (k) { var role = byRole ? sceneRoleOf(k) : "全部 MOD 场景"; (sub[role] = sub[role] || []).push(k); });
		Object.keys(sub).sort().forEach(function (role) {
			if (byRole) {
				/* v1.9.4：角色/地点分组默认收起 + 懒渲染——收起只建组标题，展开才补建该组全部场景
				   与剧情进度块（用户要求：按角色/地点所属合在一起，不要全部平铺太长）；展开状态持久化 */
				var g = el("div", "mce-grp");
				g.setAttribute("data-tcat", role);
				var gh = el("div", "mce-grp-t mce-collapse-head");
				gh.title = "点击展开/收起该分组场景（懒渲染：展开时才构建场景控件）";
				var open0 = sceneStored(role) === 0;
				gh.textContent = (open0 ? "▾" : "▸") + role + "（" + sub[role].length + " 场景）";
				g.appendChild(gh);
				var gb = el("div", "mce-grp-body");
				gb.setAttribute("data-collapsed", open0 ? "0" : "1");
				if (open0) {
					renderSceneCluster(gb, sub[role], defs);
					/* 任务三（v1.9.2）：非场景注册表的剧情进度控制，按角色收纳在本组尾部 */
					var plots = getRolePlots(role);
					if (plots) { gb.appendChild(renderRolePlots(plots)); }
				}
				gh.addEventListener("click", function () {
					var nowOpen = gb.getAttribute("data-collapsed") === "0";
					gb.setAttribute("data-collapsed", nowOpen ? "1" : "0");
					gh.textContent = (nowOpen ? "▸" : "▾") + role + "（" + sub[role].length + " 场景）";
					if (!nowOpen && !gb.querySelector(".mce-stage")) {
						renderSceneCluster(gb, sub[role], defs);
						var plots = getRolePlots(role);
						if (plots) { gb.appendChild(renderRolePlots(plots)); }
					}
					sceneSet(role, nowOpen ? 1 : 0);
				});
				g.appendChild(gb);
				pane2.appendChild(g);
			} else {
				/* v1.9.2 自查：MOD 场景区懒渲染折叠——收起只建标题，展开才补建全部 MOD 场景，
				   避免 MOD 场景多时每次切剧情页全量建 DOM 卡顿（用户历史痛点：展开过多卡住/闪退）；
				   v1.9.4：展开状态持久化 */
				var mWrap = el("div", "mce-grp");
				mWrap.setAttribute("data-tcat", "MOD 场景");
				var mHead = el("div", "mce-grp-t mce-collapse-head");
				mHead.title = "点击展开/收起全部 MOD 场景（懒渲染：展开时才构建场景控件）";
				var mOpen0 = sceneStored("MOD") === 0;
				mHead.textContent = (mOpen0 ? "▾" : "▸") + " 全部 MOD 场景（" + sub[role].length + "）";
				mWrap.appendChild(mHead);
				var mBody = el("div", "mce-grp-body");
				mBody.setAttribute("data-collapsed", mOpen0 ? "0" : "1");
				if (mOpen0) { renderSceneCluster(mBody, sub[role], defs); }
				mHead.addEventListener("click", function () {
					var open = mBody.getAttribute("data-collapsed") === "0";
					mBody.setAttribute("data-collapsed", open ? "1" : "0");
					mHead.textContent = (open ? "▸" : "▾") + " 全部 MOD 场景（" + sub[role].length + "）";
					if (!open && !mBody.querySelector(".mce-stage")) { renderSceneCluster(mBody, sub[role], defs); }
					sceneSet("MOD", open ? 1 : 0);
				});
				mWrap.appendChild(mBody);
				pane2.appendChild(mWrap);
			}
		});
	}
