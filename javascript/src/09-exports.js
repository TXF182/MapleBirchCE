
	function render() {
		if (!root) { return; }
		if (!frameworkReady()) {
			setStatus("未检测到 Maplebirch 框架", "mce-err");
			return;
		}
		var pane = root.querySelector('[data-pane="char"]');
		var chars = listCharacters();
		if (!chars.length) {
			setStatus("注册池为空：未枚举到角色", "mce-err");
			return;
		}
		var prev = (curName || mbCEUiState.curName || "").toLowerCase();
		var keep = false;
		chars.forEach(function (n) { if (n.toLowerCase() === prev) { keep = true; } });
		if (!keep) { curName = chars[0]; mbCEUiSave({ curName: curName }); /* v1.8.12 二轮优化：角色记忆失效时回落到第一个角色并同步 */ }
		else if (!curName) { curName = mbCEUiState.curName; } /* v1.8.12 二轮优化：恢复上次操作角色 */
		/* 刷新当前可见页 */
		var activeTab = null;
		var tabs = root.querySelectorAll(".mce-tabs button");
		var i;
		for (i = 0; i < tabs.length; i++) {
			if (tabs[i].classList.contains("mce-active")) { activeTab = tabs[i].getAttribute("data-tab"); }
		}
		/* 表驱动分发（v1.8.6 review：替代 6 分支 if 链） */
		var paneRenders = {
			char: renderCards, stage: renderStagePane, scenes: renderScenes,
			places: renderPlaces, global: renderGlobal, mods: renderModCheats
		};
		var doRender = paneRenders[activeTab];
		if (doRender) { doRender(); }
		setStatus("就绪：" + chars.length + " 个角色", "mce-ok");
	}

	function open() {
		openFlag = true;
		if (root) { root.classList.add("mce-open"); }
		mbCEUpdateErrBadge(true); /* 四巡：面板打开时立即刷新错误徽标（关闭期只记数据不写 DOM） */
		render();
	}
	function close() {
		openFlag = false;
		if (root) { root.classList.remove("mce-open"); }
	}
	function toggle() {
		if (openFlag) { close(); } else { open(); }
	}

	function ensureDom() {
		if (root && document.body && document.body.contains(root)) { return; }
		injectCSS();

		toggleBtn = el("button", "", "解锁");
		toggleBtn.id = "mce-toggle";
		toggleBtn.type = "button";
		toggleBtn.title = "Maplebirch CE 剧情条件解锁面板";
		toggleBtn.addEventListener("click", toggle);
		document.body.appendChild(toggleBtn);

		root = el("div", "mce-root");
		root.id = "mce-root";

		var header = el("div", "mce-header");
		header.appendChild(el("span", "mce-title", "剧情条件解锁面板 v" + MCE_VERSION));
		/* v1.8.12 错误收集红点（数量徽标，点击展开错误列表） */
		var errBtn = el("button", "mce-errbtn", "0");
		errBtn.type = "button";
		errBtn.addEventListener("click", mbCEToggleErrBox);
		header.appendChild(errBtn);
		var minBtn = el("button", "mce-min", "收起");
		minBtn.type = "button";
		minBtn.title = "收起";
		var closeBtn = el("button", "mce-close", "关闭");
		closeBtn.type = "button";
		closeBtn.title = "关闭";
		header.appendChild(minBtn);
		header.appendChild(closeBtn);

		var tabs = el("div", "mce-tabs");
		var names = [["char", "角色"], ["stage", "阶段"], ["scenes", "剧情"], ["places", "场景"], ["global", "全局"], ["mods", "Mod作弊"]];
		names.forEach(function (pair) {
			var b = el("button", pair[0] === mbCEUiState.tab ? "mce-active" : "", pair[1]);
			b.type = "button";
			b.setAttribute("data-tab", pair[0]);
			tabs.appendChild(b);
		});

		var body = el("div", "mce-body");
		var panes = [["char", "mce-pane mce-active"], ["stage", "mce-pane"], ["scenes", "mce-pane"],
			["places", "mce-pane"], ["global", "mce-pane"], ["mods", "mce-pane"]];
		panes.forEach(function (pair) {
			var p = el("div", pair[0] === mbCEUiState.tab ? "mce-pane mce-active" : "mce-pane");
			p.setAttribute("data-pane", pair[0]);
			body.appendChild(p);
		});

		var status = el("div", "mce-status", "就绪");

		root.appendChild(header);
		root.appendChild(tabs);
		root.appendChild(body);
		root.appendChild(status);
		document.body.appendChild(root);

		/* v1.8.12 错误列表箱（header 红点下方） + 复制全部 */
		var errBox = el("div", "mce-errbox");
		var errTools = el("div", "mce-row");
		var copyBtn = el("button", "", "复制全部错误"); copyBtn.type = "button";
		copyBtn.addEventListener("click", mbCECopyErrors);
		var clearBtn = el("button", "", "清空"); clearBtn.type = "button";
		clearBtn.addEventListener("click", function () { mbCEErrors = []; mbCEUpdateErrBadge(true); mbCERenderErrBox(); });
		errTools.appendChild(copyBtn);
		errTools.appendChild(clearBtn);
		var errRows = el("div", "mce-errrows");
		errBox.appendChild(errTools);
		errBox.appendChild(errRows);
		if (body.insertBefore) { body.insertBefore(errBox, body.firstChild); }
		else { body.appendChild(errBox); }
		mbCEErrBtn = errBtn;
		mbCEErrBox = errBox;
		mbCEErrRows = errRows;
		mbCEUpdateErrBadge();

		minBtn.addEventListener("click", function () {
			openFlag = false;
			root.classList.remove("mce-open");
		});
		closeBtn.addEventListener("click", close);
		tabs.addEventListener("click", function (e) {
			var b = e.target && e.target.closest ? e.target.closest("button[data-tab]") : null;
			if (!b) { return; }
			switchOuterTab(b.getAttribute("data-tab"));
		});
	}

	/* v1.8.12 功能13：渲染节流工具——高频触发合并为一次执行（面板打开期间 passage 切换/搜索输入均适用） */
	var mceRenderTimer = null;
	var mceSearchTimer = null;
	function mceSchedule(fn, ms, bucket) {
		var t = bucket === "search" ? mceSearchTimer : mceRenderTimer;
		if (t) { clearTimeout(t); }
		t = setTimeout(function () {
			if (bucket === "search") { mceSearchTimer = null; } else { mceRenderTimer = null; }
			try { fn(); } catch (e) {}
		}, ms || 60);
		if (bucket === "search") { mceSearchTimer = t; } else { mceRenderTimer = t; }
	}

	function hookRefresh() {
		var mb = resolveMB();
		if (mb && typeof mb.on === "function") {
			try {
				mb.on(":passagedisplay", function () {
					/* v1.8.12 功能13：节流合并同一帧内的多次触发，避免面板打开时每 passage 全量重建。
					   四巡：Mod作弊 页数据只由用户点击改变——passage 自动刷新跳过该页，长时间停在该页不再被每 passage 重建拖累（第三方特效层 DOM 扫描是卡顿/闪退主因之一） */
					if (openFlag && root && document.body.contains(root)) {
						var at = root.querySelector(".mce-tabs button.mce-active");
						if (at && at.getAttribute("data-tab") === "mods") { return; }
						mceSchedule(render, 300);
					}
				}, "mbStageCE:refresh");
			} catch (e) {}
		}
	}

	function init() {
		if (initialized) { return; }
		initialized = true;
		if (typeof document === "undefined") { return; }
		mountApi();
		hookPassageOverride();
		hookPassageInit();
		hookUnfreezePlayerStats(); /* v1.8.19：播放结束自动清理（unfreeze = 场景播放结束，覆盖框架播放器） */
		ensureFarmState(); /* 启动兜底：存档 farm_stage 已推进但 $farm 缺失 → 补空壳，社交页不再崩 */
		ensureAveryMansion(); /* 启动兜底：$avery_mansion / $avery_tower / daily.avery.talk 缺失或残缺 → 补空壳（Mansion 段落防崩） */
		mbCEUiLoad(); /* v1.8.12 持久化：恢复上次页签/搜索词/折叠状态 */
		mbCEHookErrors(); /* v1.8.12 错误收集器：window error + console.error 进面板 */
		if (document.body) {
			ensureDom();
			hookRefresh();
		} else {
			document.addEventListener("DOMContentLoaded", function () {
				ensureDom();
				hookRefresh();
			});
		}
	}

	/* 注册到游戏菜单（框架 Cheats 区域；widget 段落编译成功才注册），失败不影响悬浮按钮 */
	try {
		var mb0 = resolveMB();
		if (mb0 && mb0.tool && typeof mb0.tool.addTo === "function"
			&& typeof Story !== "undefined" && typeof Story.has === "function" && Story.has("MBStageCELink")) {
			mb0.tool.addTo("Cheats", "MBStageCELink");
		}
	} catch (e) {}

	/* 对外 API（立即挂载；init 时补挂，覆盖注入阶段 setup 未就绪的情形） */
	function mountApi() {
		try {
			getSetup().mbStageCE = {
				toggle: toggle,
				open: open,
				close: close,
				refresh: render,
				listCharacters: listCharacters,
				findNpc: findNpc,
				/* v1.9.0 角色分类 + 持久NPC */
				charCategory: charCategory,
				isVanillaNPC: isVanillaNPC,
				isVanillaLoveInterest: isVanillaLoveInterest,
				isPerNpcRole: isPerNpcRole,
				isLoveCharacter: isLoveCharacter,
				perNpcDisplayName: perNpcDisplayName,
				displayNameEx: displayNameEx,
				findNpcEx: findNpcEx,
				CHAR_CATEGORIES: CHAR_CATEGORIES,
				renderCards: renderCards,
				/* v1.9.0 场景页地点子界面 */
				renderPlaces: renderPlaces,
				PLACE_STAGE_GROUPS: PLACE_STAGE_GROUPS,
				placeStageRead: placeStageRead,
				placeStageWrite: placeStageWrite,
				placeStageUndo: placeStageUndo,
				getRomanceStages: getRomanceStages,
				completeRomanceStage: completeRomanceStage,
				unlockAllRomance: unlockAllRomance,
				displayName: displayName,
				getVanillaStages: getVanillaStages,
				completeVanillaStage: completeVanillaStage,
				unlockVanillaAll: unlockVanillaAll,
				describeCondition: describeCondition,
				listStageTypes: listStageTypes,
				readTransformState: readTransformState,
				adjustTransform: adjustTransform,
				completeTransformStage: completeTransformStage,
				unlockAllTransform: unlockAllTransform,
				listExtTransforms: listExtTransforms,
				completeExtTransform: completeExtTransform,
				getScenesDefs: getScenesDefs,
				sceneStatus: sceneStatus,
				completeScene: completeScene,
				listSceneLines: listSceneLines,
				listPlaceGroups: listPlaceGroups,
				placeNameCN: placeNameCN,
				teleportTo: teleportTo,
				listAllPassages: listAllPassages,
				getPinnedScene: getPinnedScene,
				pinQueueIndex: pinQueueIndex,
				pinScene: pinScene,
				pinSceneLine: pinSceneLine,
				unpinScene: unpinScene,
				applyWorldUnlock: applyWorldUnlock,
				applyWorldUnlockForScene: applyWorldUnlockForScene,
				ensureFarmState: ensureFarmState,
				ensureAveryMansion: ensureAveryMansion,
				ensureGwylanSceneState: ensureGwylanSceneState,
				isGwylanGardenPassage: isGwylanGardenPassage,
				/* v1.4.0 Mod作弊 */
				getCheatMods: getCheatMods,
				renderModCheats: renderModCheats,
				renderModCheatDetail: renderModCheatDetail,
				applyCheatModValue: applyCheatModValue,
				cheatReadSafe: cheatReadSafe,
				undoCheatModValue: undoCheatModValue,
				skipCheatTask: skipCheatTask,
				completeCheatTask: completeCheatTask,
				setCheatStage: setCheatStage,
				jumpCheatStageMax: jumpCheatStageMax,
				resetCheatStage: resetCheatStage,
				toggleCheatAbility: toggleCheatAbility,
				cheatSceneAction: cheatSceneAction,
				cheatWriteValue: cheatWriteValue,
				mbCEOnPassageInit: mbCEOnPassageInit,
				undoRomanceStage: undoRomanceStage,
				undoVanillaStage: undoVanillaStage,
				onPassageOverride: onPassageOverride,
				fillStats: fillStats,
				globalFill: globalFill,
				globalRomance: globalRomance,
				globalTransform: globalTransform,
				/* v1.8.8 庄园自动维护（学 AutoClean 0.1.5 原功能） */
				mcFeedAvery: mcFeedAvery,
				mcMaintainFarm: mcMaintainFarm,
				/* v1.8.10 庄园自动维护扩展（神殿/伊甸/补给/打扫） */
				mcMaintainTemple: mcMaintainTemple,
				mcMaintainEden: mcMaintainEden,
				mcRestockSupplies: mcRestockSupplies,
				mcCleanMansion: mcCleanMansion,
				/* v1.8.9 战斗终结（学 CombatTerminator 0.1 原功能，数据层动作） */
				COMBAT_ACTIONS: COMBAT_ACTIONS,
				mcCombatAction: mcCombatAction,
				/* v1.4.5 角色一览恋爱候选过滤 */
				isLoveCandidate: isLoveCandidate,
				addLoveInterest: addLoveInterest,
				/* v1.5.0 誓言修复 + NPC 特质获取 */
				getVowStatus: getVowStatus,
				fixVows: fixVows,
				listNpcTraits: listNpcTraits,
				grantNpcTrait: grantNpcTrait,
				/* v1.8.0 玩家属性与特质管理 */
				renderPlayerEdit: renderPlayerEdit,
				compileVanillaTraits: compileVanillaTraits,
				groupTraitSeries: groupTraitSeries, traitSeriesName: traitSeriesName,
				discoverModTraits: discoverModTraits,
				traitOwned: traitOwned,
				grantTrait: grantTrait,
				revokeTrait: revokeTrait,
				traitWriteValue: traitWriteValue,
				traitDisplayName: traitDisplayName,
				traitEval: traitEval,
				/* v1.8.12 特质收藏 */
				favTraitKey: favTraitKey,
				getFavTraits: getFavTraits,
				isFavTrait: isFavTrait,
				toggleFavTrait: toggleFavTrait,
				VANILLA_TRAITS_RAW: VANILLA_TRAITS_RAW,
				/* 兼容导出（v1.7.x 保留） */
				isModOnlyRoot: isModOnlyRoot,
				ORIGINAL_V_ROOT_KEYS: ORIGINAL_V_ROOT_KEYS,
				cheatWriteValuePlayer: function (path, raw, type) {
					return cheatWriteValue("player-self", "p:" + path, type === "string" ? "stage_set" : "value_set", path, raw, type);
				},
				undoPlayerValue: function (path) { return undoCheatModValue("player-self", "p:" + path); },
				zhKey: zhKey, zhPath: zhPath, zhType: zhType, ZH_KEYS: ZH_KEYS,
				/* v1.7.2 游戏属性面板快捷编辑 */
				PANEL_QUICK_GROUPS: PANEL_QUICK_GROUPS,
				quickReadValue: quickReadValue,
				quickWrite: quickWrite,
				ensureProfShell: ensureProfShell,
				/* v1.8.12 错误收集器 + 面板状态持久化 */
				mbCEPushError: mbCEPushError,
				mbCEErrors: function () { return mbCEErrors.slice(); },
				/* v1.8.15 九巡：留痕有界化（测试与诊断用） */
				mbCEWroteTrim: mbCEWroteTrim,
				mbCEUiState: function () { return JSON.parse(JSON.stringify(mbCEUiState)); },
				mbCEUiSave: mbCEUiSave,
				mbCEUiLoad: mbCEUiLoad,
				mbCEUiCollapsed: mbCEUiCollapsed,
				/* v1.8.12 功能12：适配器工作流审计 */
				auditAdapters: auditAdapters
			};
		} catch (e) {}
	}
	mountApi();

	init();
})();

