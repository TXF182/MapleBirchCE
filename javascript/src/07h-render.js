	/* v1.9.23：锚定播放完成记录（mbCE_completedScenes）→ 剧情页条目显示「已完成 ✓」 */
	function isSceneCompleted(key) {
		try { var V = getV(); return !!(V && V.mbCE_completedScenes && V.mbCE_completedScenes[key]); } catch (e) { return false; }
	}
	/* ---- 特殊剧情页（$scenes 场景注册表动态枚举） ---- */
	var sHeadGuardTimer = null; /* v1.9.5-自检：乱码兜底单定时器——renderScenes 频繁重建时清旧设新，防 800ms 闭包堆积扫描旧 pane */
	function renderScenes() {
		var pane = root.querySelector('[data-pane="scenes"]');
		var keepScroll = typeof pane.scrollTop === "number" ? pane.scrollTop : 0; /* v1.9.4：重建后保持滚动位置（锚定/取消锚定/一键完成后不跳回顶部） */
		pane.textContent = "";
		/* v1.9.4：折叠组展开状态键「剧情:<组名>」（与角色页「角色:<cat>」同语义、互不冲突），
		   展开状态持久化到 mbCEUiState.collapsed——操作后 renderScenes() 重建不再全部收回去 */
		function sceneSectionKey(role) { return "剧情:" + role; }
		function sceneStored(role) {
			return mbCEUiState.collapsed && mbCEUiState.collapsed[sceneSectionKey(role)] != null
				? Number(mbCEUiState.collapsed[sceneSectionKey(role)]) : 1;
		}
		function sceneSet(role, val) {
			mbCEUiState.collapsed = mbCEUiState.collapsed || {};
			mbCEUiState.collapsed[sceneSectionKey(role)] = val;
			mbCEUiSave({ collapsed: mbCEUiState.collapsed });
		}
		/* 使用提示（v1.9.4-自检）：与修复后行为一致（触发一次自动停止、退出场景返回原位，不再被困） */
		pane.appendChild(el("div", "mce-warn", "使用提示：锚定剧情后，走到该剧情发生地点并交互时会弹确认条（含地点/时间/前置说明），确认后触发、播放完标「已完成 ✓」；「暂不触发」保留待下次。旧「固定触发」已移除，「一键完成」「场景直达」保留；若需恢复原版随机触发，点顶部横幅「清空队列」即可。"));
		/* 锚定触发状态横幅（v1.9.23：队列，显示全部未触发项） */
		var pinnedBanner = getPinnedScene();
		if (pinnedBanner && pinnedBanner.length) {
			var banner = el("div", "mce-stage mce-pass");
			var bh = el("div", "mce-stage-head");
			bh.appendChild(el("span", "mce-dot", ""));
			var names = pinnedBanner.map(function (p) { return "「" + p.name + "」"; }).join("、");
			bh.appendChild(el("span", "mce-stage-name", "锚定触发队列（" + pinnedBanner.length + "）：" + names + " —— 到对应地点交互时弹确认条触发，触发完自动完成"));
			var unBtn = el("button", "mce-btn mce-red", "清空队列（取消全部锚定）");
			unBtn.type = "button";
			unBtn.title = "取消全部锚定触发，恢复原版随机触发；若正在重放则立即解冻并返回原位";
			unBtn.addEventListener("click", function () {
				var was = unpinScene();
				setStatus(was ? "已回退：清空锚定触发队列，恢复原版随机触发" : "未处于锚定触发状态", "mce-ok");
				renderScenes();
			});
			bh.appendChild(unBtn);
			banner.appendChild(bh);
			pane.appendChild(banner);
		}
		var r = getScenesDefs();
		if (!Object.keys(r.defs).length) {
			pane.appendChild(el("div", "mce-err", "未读取到场景注册表（$scenes）。"));
			pane.appendChild(el("div", "mce-hint", "说明：本页读取游戏「场景查看器（Scene Viewer）」的注册表。请先在游戏菜单打开一次「场景」页面后返回；MOD 通过场景系统注册的剧情会随注册表自动出现。"));
			return;
		}
		pane.appendChild(el("div", "mce-hint", "已读取场景注册表 " + Object.keys(r.defs).length + " 条" + (r.live ? "（实时求值解锁条件）" : "（读取存档缓存值）") + "。原版剧情按角色分组，MOD 注册剧情单独一组。绿色=已达成，红色=未达成，黄色=锁定/互斥提示。"));
		var allKeys = Object.keys(r.defs);
		var vanillaKeys = allKeys.filter(function (k) { return isVanillaSceneKey(k); });
		var modKeys = allKeys.filter(function (k) { return !isVanillaSceneKey(k); });
		renderSceneRegion(pane, "原版剧情（游戏本体注册，" + vanillaKeys.length + " 场景）", vanillaKeys, r.defs, true);
		renderSceneRegion(pane, "MOD 剧情（第三方模组注册，" + modKeys.length + " 场景）", modKeys, r.defs, false);
		/* 分区渲染：原版按角色分组（sceneRoleOf），MOD 单组 */
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
		/* 剧情进度控制块（任务三）：渲染 EXTRA_ROLE_PLOTS 条目，行内应用不重建整组 */
		function renderRolePlots(plots) {
			var block = el("div", "mce-stage mce-plots");
			var head = el("div", "mce-stage-head mce-line-head");
			head.appendChild(el("span", "mce-dot", ""));
			head.appendChild(el("span", "mce-stage-name", "剧情进度（非场景事件状态）"));
			block.appendChild(head);
			var body = el("div", "mce-grp-body");
			body.appendChild(el("div", "mce-hint", plots.intro));
			plots.items.forEach(function (it) {
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-name", it.name));
				var curBadge = el("span", "mce-badge mce-on", "");
				var refreshCur = function () {
					var cv = getDotPath(it.varPath);
					curBadge.textContent = "当前: " + (cv === undefined ? "未设置" : cv);
				};
				refreshCur();
				row.appendChild(curBadge);
				if (it.type === "range" || it.type === "select") {
					var ctrl;
					if (it.type === "range") {
						var inp = el("input", "mce-inp");
						inp.type = "number"; inp.min = String(it.min); inp.max = String(it.max); inp.step = String(it.step || 1); /* 剧情进度是进度档位：钳制在 [min,max]（用户澄清：仅"直接填数值"放开上限，进度保留） */
						var apply = el("button", "mce-btn", "应用");
						apply.type = "button";
						apply.addEventListener("click", function () {
							var v = parseFloat(inp.value);
							if (isNaN(v)) { v = 0; }
							if (v < it.min) { v = it.min; } if (v > it.max) { v = it.max; } /* 进度档位语义，钳制在上限内 */
							setDotPath(it.varPath, v);
							refreshCur();
							setStatus(it.name + " → " + v, "mce-ok");
						});
						row.appendChild(inp); row.appendChild(apply);
					} else {
						var sel = el("select");
						(it.options || []).forEach(function (o) {
							var op = el("option"); op.value = String(o[0]); op.textContent = o[1];
							var cv = getDotPath(it.varPath);
							if (String(cv) === String(o[0])) { op.selected = true; }
							sel.appendChild(op);
						});
						var applyS = el("button", "mce-btn", "应用");
						applyS.type = "button";
						applyS.addEventListener("click", function () {
							var v = parseInt(sel.value, 10);
							setDotPath(it.varPath, v);
							refreshCur();
							setStatus(it.name + " → " + sel.value, "mce-ok");
						});
						row.appendChild(sel); row.appendChild(applyS);
					}
				} else if (it.type === "action") {
					var act = el("button", "mce-btn mce-gold", it.name);
					act.type = "button";
					act.addEventListener("click", function () {
						setStatus(applyRolePlotAction(it.action), "mce-ok");
						if (it.action === "kylarSeen") {
							var cv = getDotPath("kylarSeen");
							curBadge.textContent = "当前: " + (Array.isArray(cv) ? cv.length + " 项标记" : "未设置");
						}
					});
					row.appendChild(act);
				} else if (it.type === "info") {
					row.appendChild(el("span", "mce-note", it.note));
				}
				body.appendChild(row);
				body.appendChild(el("div", "mce-note", it.note));
			});
			block.appendChild(body);
			return block;
		}
		function renderSceneCluster(container, keys2, defs) {
			var defsSub = {};
			keys2.forEach(function (k) { defsSub[k] = defs[k]; });
			var cluster = listSceneLines(defsSub);
			var lineTotal = cluster.lines.length, singleTotal = cluster.singles.length;
			var lineDone = 0;
			cluster.lines.forEach(function (line) {
				var done = line.items.filter(function (it) { return sceneStatus(it.def).state === "pass"; }).length;
				lineDone += done;
				var block = el("div", "mce-stage");
				var head = el("div", "mce-stage-head mce-line-head");
				head.appendChild(el("span", "mce-dot", ""));
				var stages = el("div", "mce-stages");
				stages.style.display = "none"; /* v1.3：剧情线默认收起（合在一起不展开），点线头展开 */
				head.appendChild(el("span", "mce-stage-name", "剧情线「" + (line.items[0].def.name || line.prefix) + "」系列　已达成 " + done + " / " + line.items.length + "　（" + line.items.length + " 个阶段，收起）"));
				/* 锚定整线（v1.9.23）：已标注触发地点的阶段按顺序入队，走到地点交互时依次触发，触发完自动完成 */
				var linePin = el("button", "mce-btn", "锚定整线");
				linePin.type = "button";
				linePin.title = "把本系列全部阶段按顺序锚定：走到各阶段发生地点交互时弹确认条，触发完自动完成";
				(function (line2) {
					linePin.addEventListener("click", function () {
						var pr = pinSceneLine(line2);
						setStatus(pr.message, pr.ok ? "mce-ok" : "mce-err");
						renderScenes();
					});
				})(line);
				head.appendChild(linePin);
				/* 展开/收起切换 */
				var tog = el("button", "mce-btn mce-gold", "展开各阶段");
				tog.type = "button";
				tog.title = "展开查看本线各阶段，可对单阶段锚定/取消锚定/一键完成";
				tog.addEventListener("click", function () {
					var open = stages.style.display === "none";
					stages.style.display = open ? "" : "none";
					tog.textContent = open ? "收起各阶段" : "展开各阶段";
					var nm = head.querySelector(".mce-stage-name");
					if (nm) { nm.textContent = "剧情线「" + (line.items[0].def.name || line.prefix) + "」系列　已达成 " + done + " / " + line.items.length + "　（" + line.items.length + " 个阶段，" + (open ? "展开" : "收起") + "）"; }
				});
				head.appendChild(tog);
				block.appendChild(head);
				line.items.forEach(function (it) {
					var st = sceneStatus(it.def);
					var srow = el("div", "mce-stage " + (st.state === "pass" ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
					var sh = el("div", "mce-stage-head");
					sh.appendChild(el("span", "mce-dot", ""));
					var nm = it.def.name || it.key;
					sh.appendChild(el("span", "mce-stage-name", "阶段 " + it.num + "　" + nm));
					/* 锚定触发 / 取消锚定（v1.9.23）：走到地点交互时弹确认条；无地点元数据暂不可锚定 */
					var pi = pinQueueIndex(it.key);
					if (pi >= 0) {
						sh.appendChild(el("span", "mce-badge mce-on", "已锚定 第" + (pi + 1) + "位"));
						var unpinB = el("button", "mce-btn mce-red", "取消锚定");
						unpinB.type = "button";
						unpinB.title = "取消该剧情的锚定，恢复原版随机触发";
						(function (it2) {
							unpinB.addEventListener("click", function () {
								var was = unpinScene(it2.key);
								setStatus(was ? "已取消锚定：「" + (it2.def.name || it2.key) + "」" : "该剧情不在锚定队列中", "mce-ok");
								renderScenes();
							});
						})(it);
						sh.appendChild(unpinB);
					} else {
						var anchorMeta = sceneAnchorMeta(it.key);
						var pinB = el("button", "mce-btn", "锚定");
						pinB.type = "button";
						if (anchorMeta && anchorMeta.location) {
							pinB.title = "锚定此剧情：走到触发地点「" + locLabel(anchorMeta.location) + "」" + (anchorMeta.timeNote ? "（时间 " + anchorMeta.timeNote + "）" : "") + "并交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
						} else {
							pinB.disabled = true;
							pinB.title = "该剧情未标注触发地点（第一批元数据未覆盖），暂不可锚定";
						}
						(function (it2) {
							pinB.addEventListener("click", function () {
								var pr = pinScene(it2);
								setStatus(pr.message, pr.ok ? "mce-ok" : "mce-err");
								renderScenes();
							});
						})(it);
						sh.appendChild(pinB);
					}
					if (st.state === "pass") {
						sh.appendChild(el("span", "mce-badge mce-on", "已达成"));
					} else {
						var btn = el("button", "mce-btn mce-gold", "一键完成");
						btn.type = "button";
						btn.title = "把该场景所有段落与解锁条件写入经历表（scenePassages）";
						(function (it2, st2) {
							btn.addEventListener("click", function () {
								var res = completeScene(it2.def);
								setStatus("「" + (it2.def.name || it2.key) + "」" + (res.ok ? "已解锁" : "未解锁：" + res.note), res.ok ? "mce-ok" : "mce-err");
								renderScenes();
							});
						})(it, st);
						sh.appendChild(btn);
					}
					/* v1.9.23：锚定播放完成 → 「已完成 ✓」（区别于 scenePassages 达成绿标；可再自由锚定） */
					if (isSceneCompleted(it.key)) { sh.appendChild(el("span", "mce-badge mce-on", "已完成 ✓")); }
					srow.appendChild(sh);
					var note = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
					srow.appendChild(el("div", "mce-stage-txt", note + (st.note || "（无说明）")));
					srow.appendChild(el("div", "mce-stage-note", "段落数 " + (it.def.passages || []).length + (it.def.startPassage ? "　入口 " + it.def.startPassage : "") + "　键 " + it.key));
					stages.appendChild(srow);
				});
				block.appendChild(stages);
				container.appendChild(block);
			});
			if (singleTotal) {
				var sblock = el("div", "mce-stage");
				var sHead = el("div", "mce-stage-head");
				/* v1.9.4-自检：sHead 曾只挂一个 span（mce-stage-name），实测被第三方 UI 模组
				   改写为文本 [object HTMLSpanElement]；改为「mce-dot + mce-stage-name」双 span 后
				   新包实测仍被改写（16 处）——外部脚本非按子元素数量判断。
				   现改为纯文本（head 无子元素，外部脚本无元素可对象化），并辅以渲染后延迟兜底修复。 */
				sHead.textContent = "独立场景（未聚合成线）";
				sblock.appendChild(sHead);
				var sstages = el("div", "mce-stages");
				cluster.singles.forEach(function (it) {
					var st = sceneStatus(it.def);
					var srow = el("div", "mce-stage " + (st.state === "pass" ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
					var sh = el("div", "mce-stage-head");
					sh.appendChild(el("span", "mce-dot", ""));
					sh.appendChild(el("span", "mce-stage-name", it.def.name || it.key));
					/* 锚定触发 / 取消锚定（v1.9.23）：走到地点交互时弹确认条；无地点元数据暂不可锚定 */
					var piS = pinQueueIndex(it.key);
					if (piS >= 0) {
						sh.appendChild(el("span", "mce-badge mce-on", "已锚定 第" + (piS + 1) + "位"));
						var unpinS = el("button", "mce-btn mce-red", "取消锚定");
						unpinS.type = "button";
						unpinS.title = "取消该剧情的锚定，恢复原版随机触发";
						(function (it2) {
							unpinS.addEventListener("click", function () {
								var was = unpinScene(it2.key);
								setStatus(was ? "已取消锚定：「" + (it2.def.name || it2.key) + "」" : "该剧情不在锚定队列中", "mce-ok");
								renderScenes();
							});
						})(it);
						sh.appendChild(unpinS);
					} else {
						var anchorMetaS = sceneAnchorMeta(it.key);
						var pinS = el("button", "mce-btn", "锚定");
						pinS.type = "button";
						if (anchorMetaS && anchorMetaS.location) {
							pinS.title = "锚定此剧情：走到触发地点「" + locLabel(anchorMetaS.location) + "」" + (anchorMetaS.timeNote ? "（时间 " + anchorMetaS.timeNote + "）" : "") + "并交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
						} else {
							pinS.disabled = true;
							pinS.title = "该剧情未标注触发地点（第一批元数据未覆盖），暂不可锚定";
						}
						(function (it2) {
							pinS.addEventListener("click", function () {
								var pr = pinScene(it2);
								setStatus(pr.message, pr.ok ? "mce-ok" : "mce-err");
								renderScenes();
							});
						})(it);
						sh.appendChild(pinS);
					}
					if (st.state === "pass") {
						sh.appendChild(el("span", "mce-badge mce-on", "已达成"));
					} else {
						var b2 = el("button", "mce-btn mce-gold", "一键完成");
						b2.type = "button";
						(function (it2) {
							b2.addEventListener("click", function () {
								var res = completeScene(it2.def);
								setStatus("「" + (it2.def.name || it2.key) + "」" + (res.ok ? "已解锁" : "未解锁：" + res.note), res.ok ? "mce-ok" : "mce-err");
								renderScenes();
							});
						})(it);
						sh.appendChild(b2);
					}
					/* v1.9.23：锚定播放完成 → 「已完成 ✓」（区别于 scenePassages 达成绿标；可再自由锚定） */
					if (isSceneCompleted(it.key)) { sh.appendChild(el("span", "mce-badge mce-on", "已完成 ✓")); }
					srow.appendChild(sh);
					var note2 = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
					srow.appendChild(el("div", "mce-stage-txt", note2 + (st.note || "（无说明）")));
					sstages.appendChild(srow);
				});
				sblock.appendChild(sstages);
				container.appendChild(sblock);
			}
			if (!cluster.lines.length && !cluster.singles.length) {
				container.appendChild(el("div", "mce-hint", "本分组无场景。"));
			} else {
				container.appendChild(el("div", "mce-hint", "剧情线 " + lineTotal + " 条（已达成 " + lineDone + "），独立场景 " + singleTotal + " 个。"));
			}
		}
		if (typeof pane.scrollTop === "number") { pane.scrollTop = keepScroll; } /* v1.9.4：重建后保持滚动位置 */
		/* v1.9.4-自检：防御第三方 UI 模组在 CE 渲染后对「无按钮纯文本 head」的对象化改写
		   （实测 sHead 被改成 [object HTMLSpanElement]，双 span 结构亦未能幸免）。
		   延迟校验：仅修复「文本为对象化串且无按钮」的 head（即 sHead，line/sh 均有按钮不命中）。
		   v1.9.5-自检：单定时器（清旧设新）——渲染频繁重建时旧闭包不再扫描已脱离的旧 pane。 */
		if (sHeadGuardTimer) { clearTimeout(sHeadGuardTimer); }
		sHeadGuardTimer = setTimeout(function () {
			var bad = pane.querySelectorAll(".mce-stage-head");
			for (var bi = 0; bi < bad.length; bi++) {
				var bt = bad[bi].textContent || "";
				/* v1.9.5-自检：覆盖对象化文本全形态（HTMLSpanElement 实测 16 处；HTMLDivElement/HTMLHeadingElement/HTMLButtonElement/Object 同源防御） */
				if (/^\[object (HTMLSpanElement|HTMLDivElement|HTMLHeadingElement|HTMLButtonElement|Object)\]$/.test(bt.trim()) && !bad[bi].querySelector("button")) {
					bad[bi].textContent = "独立场景（未聚合成线）";
				}
			}
		}, 800);
	}

	/* ---- 全局页 ---- */
