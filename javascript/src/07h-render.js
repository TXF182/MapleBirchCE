	/* ---- 特殊剧情页（$scenes 场景注册表动态枚举） ---- */
	function renderScenes() {
		var pane = root.querySelector('[data-pane="scenes"]');
		pane.textContent = "";
		/* 使用提示（v1.5.2）：固定触发注意事项，页首常驻 */
		pane.appendChild(el("div", "mce-warn", "使用提示：当你使用固定触发后，会一直循环。当出现退出场景时，回到此页面取消队列。之后你会被困在场景播放器中，请使用场景直达退出去。"));
		/* 固定触发状态横幅（v1.2：队列，显示全部未触发项） */
		var pinnedBanner = getPinnedScene();
		if (pinnedBanner && pinnedBanner.length) {
			var banner = el("div", "mce-stage mce-pass");
			var bh = el("div", "mce-stage-head");
			bh.appendChild(el("span", "mce-dot", ""));
			var names = pinnedBanner.map(function (p) { return "「" + p.name + "」"; }).join("、");
			bh.appendChild(el("span", "mce-stage-name", "固定触发队列（" + pinnedBanner.length + "）：" + names + " —— 按顺序触发，触发一次后自动停止"));
			var unBtn = el("button", "mce-btn mce-red", "清空队列（取消全部固定）");
			unBtn.type = "button";
			unBtn.title = "取消全部固定触发，恢复原版随机触发；若正在重放则立即解冻并返回原位";
			unBtn.addEventListener("click", function () {
				var was = unpinScene();
				setStatus(was ? "已回退：清空固定触发队列，恢复原版随机触发" : "未处于固定触发状态", "mce-ok");
				renderScenes();
			});
			bh.appendChild(unBtn);
			banner.appendChild(bh);
			pane.appendChild(banner);
		}
		var r = getScenesDefs();
		if (!Object.keys(r.defs).length) {
			pane.appendChild(el("div", "mce-err", "未读取到场景注册表（$scenes）。"));
			pane.appendChild(el("div", "mce-hint", "说明：本页读取游戏「场景查看器（Scene Viewer）」的注册表。请先在游戏菜单打开一次「场景」页面后返回；MOD 通过场景系统注册的剧情（如启示录 MOD 的罗宾神殿剧情）会随注册表自动出现。"));
			return;
		}
		pane.appendChild(el("div", "mce-hint", "已读取场景注册表 " + Object.keys(r.defs).length + " 条" + (r.live ? "（实时求值解锁条件，含 MOD 场景）" : "（读取存档缓存值）") + "。绿色=已达成，红色=未达成，黄色=锁定/互斥提示。"));
		var cluster = listSceneLines(r.defs);
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
			/* 固定整线：全部阶段按顺序入队，依次触发，触发完自动停止 */
			var linePin = el("button", "mce-btn", "固定整线");
			linePin.type = "button";
			linePin.title = "把本系列全部阶段按顺序加入固定触发队列，依次触发，触发完自动停止";
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
			tog.title = "展开查看本线各阶段，可对单阶段固定/回退/一键完成";
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
				/* 固定触发 / 回退（v1.2：队列） */
				var pi = pinQueueIndex(it.key);
				if (pi >= 0) {
					sh.appendChild(el("span", "mce-badge mce-on", "已固定 第" + (pi + 1) + "位"));
					var unpinB = el("button", "mce-btn mce-red", "回退");
					unpinB.type = "button";
					unpinB.title = "取消该剧情的固定触发，恢复原版随机触发";
					(function (it2) {
						unpinB.addEventListener("click", function () {
							var was = unpinScene(it2.key);
							setStatus(was ? "已回退：「" + (it2.def.name || it2.key) + "」取消固定触发" : "该剧情不在固定队列中", "mce-ok");
							renderScenes();
						});
					})(it);
					sh.appendChild(unpinB);
				} else {
					var pinB = el("button", "mce-btn", "固定触发");
					pinB.type = "button";
					pinB.title = "固定此剧情：按顺序排队触发，触发一次后自动停止；顶部横幅或「回退」恢复原版触发";
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
				srow.appendChild(sh);
				var note = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
				srow.appendChild(el("div", "mce-stage-txt", note + (st.note || "（无说明）")));
				srow.appendChild(el("div", "mce-stage-note", "段落数 " + (it.def.passages || []).length + (it.def.startPassage ? "　入口 " + it.def.startPassage : "") + "　键 " + it.key));
				stages.appendChild(srow);
			});
			block.appendChild(stages);
			pane.appendChild(block);
		});
		if (singleTotal) {
			var sblock = el("div", "mce-stage");
			sblock.appendChild(el("div", "mce-stage-head", el("span", "mce-stage-name", "独立场景（未聚合成线）")));
			var sstages = el("div", "mce-stages");
			cluster.singles.forEach(function (it) {
				var st = sceneStatus(it.def);
				var srow = el("div", "mce-stage " + (st.state === "pass" ? "mce-pass" : st.state === "fail" ? "mce-fail" : ""));
				var sh = el("div", "mce-stage-head");
				sh.appendChild(el("span", "mce-dot", ""));
				sh.appendChild(el("span", "mce-stage-name", it.def.name || it.key));
				/* 固定触发 / 回退（v1.2：队列） */
				var piS = pinQueueIndex(it.key);
				if (piS >= 0) {
					sh.appendChild(el("span", "mce-badge mce-on", "已固定 第" + (piS + 1) + "位"));
					var unpinS = el("button", "mce-btn mce-red", "回退");
					unpinS.type = "button";
					unpinS.title = "取消该剧情的固定触发，恢复原版随机触发";
					(function (it2) {
						unpinS.addEventListener("click", function () {
							var was = unpinScene(it2.key);
							setStatus(was ? "已回退：「" + (it2.def.name || it2.key) + "」取消固定触发" : "该剧情不在固定队列中", "mce-ok");
							renderScenes();
						});
					})(it);
					sh.appendChild(unpinS);
				} else {
					var pinS = el("button", "mce-btn", "固定触发");
					pinS.type = "button";
					pinS.title = "固定此剧情：按顺序排队触发，触发一次后自动停止；顶部横幅或「回退」恢复原版触发";
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
				srow.appendChild(sh);
				var note2 = st.state === "pass" ? "已达成：" : st.state === "fail" ? "要求：" : "状态：";
				srow.appendChild(el("div", "mce-stage-txt", note2 + (st.note || "（无说明）")));
				sstages.appendChild(srow);
			});
			sblock.appendChild(sstages);
			pane.appendChild(sblock);
		}
		if (!cluster.lines.length && !cluster.singles.length) {
			pane.appendChild(el("div", "mce-hint", "注册表为空（场景查看器未初始化或未注册任何场景）。"));
		} else {
			pane.appendChild(el("div", "mce-hint", "剧情线 " + lineTotal + " 条（已达成 " + lineDone + "/" + lineTotal + " 条线末段），独立场景 " + singleTotal + " 个。"));
		}
	}

	/* ---- 全局页 ---- */
