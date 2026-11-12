/* 职责：初始化与刷新钩子 —— hookRefresh（:passagedisplay）、init()、mountApi() 导出 */
	function hookRefresh() {
		var mb = resolveMB();
		if (mb && typeof mb.on === "function") {
			try {
				mb.on(":passagedisplay", function () {
					/* v2.0.0.006：言灵守卫按需起表——只有存档里开关真的开着才起 1s 定时器，
					   翻页即补齐（读档时机晚于模块加载，靠这里保证「不打开面板也生效」） */
					try { mbCEResumeTimers(); } catch (eY) {}
					/* v1.8.12 功能13：节流合并同一帧内的多次触发，避免面板打开时每 passage 全量重建。
					   四巡：Mod作弊 页数据只由用户点击改变——passage 自动刷新跳过该页，长时间停在该页不再被每 passage 重建拖累（第三方特效层 DOM 扫描是卡顿/闪退主因之一） */
					if (openFlag && root && document.body.contains(root)) {
						var at = root.querySelector(".mce-tabs button.mce-active");
						if (at && (at.getAttribute("data-tab") === "mods" || at.getAttribute("data-tab") === "yanling")) { return; }
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
	mbCEExportVcore();
		hookPassageOverride();
		hookPassageInit();
		hookPassageEnd(); /* v1.9.23：锚定触发判定（走到锚定地点交互时弹确认条） */
		hookUnfreezePlayerStats(); /* v1.8.19：播放结束自动清理（unfreeze = 场景播放结束，覆盖框架播放器） */
		ensureFarmState(); /* 启动兜底：存档 farm_stage 已推进但 $farm 缺失 → 补空壳，社交页不再崩 */
		ensureAveryMansion(); /* 启动兜底：$avery_mansion / $avery_tower / daily.avery.talk 缺失或残缺 → 补空壳（Mansion 段落防崩） */
		mbCEUiLoad(); /* v1.8.12 持久化：恢复上次页签/搜索词/折叠状态 */
		try { mbCEResumeTimers(); } catch (eY0) {} /* v2.0.0.006：已开启言灵开关的存档，注入后即生效 */
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
				/* v2.0.3 P4-1 统一回退中心 */
				undoList: mbCEUndoList,
				undoOne: mbCEUndoOne,
				undoGroup: mbCEUndoGroup,
				undoAll: mbCEUndoAll,
				undoLabel: mbCEUndoLabel,
				undoItemName: mbCEUndoItemName,
				readTransformState: readTransformState,
				adjustTransform: adjustTransform,
				completeTransformStage: completeTransformStage,
				unlockAllTransform: unlockAllTransform,
				listExtTransforms: listExtTransforms,
				completeExtTransform: completeExtTransform,
				getScenesDefs: getScenesDefs,
				/* v2.0.0.006 言灵页 API（异装拦截 / 残留净化 / 负面名声清零） */
				renderYanling: renderYanling,
				yanlingState: mbCEYanlingState,
				yanlingInstall: mbCEYanlingInstall,
				yanlingUninstall: mbCEYanlingUninstall,
				yanlingSync: mbCEYanlingSync,
				yanlingTick: mbCEYanlingTick,
				yanlingToggle: mbCEYanlingToggle,
				yanlingPurgeCross: mbCEYanlingPurgeCross,
				yanlingPurgeTrait: mbCEYanlingPurgeTrait,
				yanlingPurgeFame: mbCEYanlingPurgeFame,
				YANLING_FAME_NEG: mbCEYanlingFameNeg,
				/* v2.0.3：正面名声拉满 + 监狱庇护枚举直写（$prison.protection 是字符串，数字档位会静默半失效） */
				yanlingMaxFame: mbCEYanlingMaxFame,
				yanlingPrisonProtect: mbCEYanlingPrisonProtect,
				/* v2.0.2 言灵扩容：一次性写入动作（衣物 / 数值 / 天气 / 角色放逐） */
				yanlingDryClothes: mbCEYanlingDryClothes,
				yanlingRepairClothes: mbCEYanlingRepairClothes,
				yanlingSemen: mbCEYanlingSemen,
				yanlingMind: mbCEYanlingMind,
				yanlingSadism: mbCEYanlingSadism,
				yanlingSeeds: mbCEYanlingSeeds,
				yanlingRobinMoney: mbCEYanlingRobinMoney,
				yanlingAveryDate: mbCEYanlingAveryDate,
				yanlingHeadPassword: mbCEYanlingHeadPassword,
				yanlingFeats: mbCEYanlingFeats,
				yanlingFarm: mbCEYanlingFarm,
				yanlingMilk: mbCEYanlingMilk,
				yanlingWeather: mbCEYanlingWeather,
				yanlingGwylanBanish: mbCEYanlingGwylanBanish,
				yanlingGwylanRecall: mbCEYanlingGwylanRecall,
				yanlingKylar: mbCEYanlingKylar,
				yanlingWhitney: mbCEYanlingWhitney,
				YANLING_WEATHER: mbCEYanlingWeatherMap,
				sceneStatus: sceneStatus,
				completeScene: completeScene,
				listSceneLines: listSceneLines,
				/* v1.9.2 剧情页分区：原版场景键索引 + 角色映射 */
				VANILLA_SCENE_KEYS: VANILLA_SCENE_KEYS,
				isVanillaSceneKey: isVanillaSceneKey,
				sceneRoleOf: sceneRoleOf,
				/* v1.9.2 任务三：非场景剧情进度控制（按角色） */
				getRolePlots: getRolePlots,
				getDotPath: getDotPath,
				setDotPath: setDotPath,
				applyRolePlotAction: applyRolePlotAction,
				listPlaceGroups: listPlaceGroups,
				placeNameCN: placeNameCN,
				/* v2.0.16 场景直达子入口（测试/外部检查用） */ mbCEListPlaceEntries: (typeof mbCEListPlaceEntries === "function") ? mbCEListPlaceEntries : null, PLACE_EXTRA_ENTRIES: (typeof PLACE_EXTRA_ENTRIES === "object") ? PLACE_EXTRA_ENTRIES : null, mbCEEnsureEntryState: (typeof mbCEEnsureEntryState === "function") ? mbCEEnsureEntryState : null, mbCEFillShapeV: (typeof mbCEFillShapeV === "function") ? mbCEFillShapeV : null, /* 后两项 v2.0.17 子入口状态兜底 */
				teleportTo: teleportTo, mbCECurrentPassage: mbCECurrentPassage, mbCEPassageMacroWarn: mbCEPassageMacroWarn,
				listAllPassages: listAllPassages,
				getPinnedScene: getPinnedScene,
				pinQueueIndex: pinQueueIndex,
				pinScene: pinScene,
				pinSceneLine: pinSceneLine,
				unpinScene: unpinScene,
				applyWorldUnlock: applyWorldUnlock,
				applyWorldUnlockForScene: applyWorldUnlockForScene,
				worldUndo: mbCEWorldUndo,
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
				/* v2.0.4 治理：列表型写入导出，供声明矩阵测试走真实数组通道（内部实现未改） */
				cheatWriteListValue: cheatWriteListValue,
				/* v2.0.0.002 快速面板：数值锁定（复用 07f-lock）+ 武器直接获得 */
				quickTargetValue: quickTargetValue,
				grantWeapon: grantWeapon,
				grantAllWeapons: grantAllWeapons,
				/* v2.0.0.002 说话态度：原版三档（meek/neutral/bratty）+ 选定后永久维持
				   （旧口径"把 $submissive 写进 851–1149 交集"已按用户纠偏作废，符号保留供兼容） */
				attitudeState: attitudeState,
				applyAttitude: applyAttitude,
				readAttitude: readAttitude,
				FSA_FREE_MID: FSA_FREE_MID,
				MB_CE_ATTITUDE_TIERS: MB_CE_ATTITUDE_TIERS,
				mbCEAttitudeState: mbCEAttitudeState,
				mbCEAttitudeApply: mbCEAttitudeApply,
				mbCEAttitudeHold: mbCEAttitudeHold,
				mbCEAttitudeRelease: mbCEAttitudeRelease,
				mbCEAttitudeTick: mbCEAttitudeTick,
				/* v2.0.0.002 潜伏者：捕捉/冰箱无上限（启动前文本解限 + 自动搬运保底） */
				mbCELurkerState: mbCELurkerState,
				mbCELurkerSet: mbCELurkerSet,
				mbCELurkerAutoTick: mbCELurkerAutoTick,
				mbCELurkerSetAuto: mbCELurkerSetAuto,
				MB_CE_LURKER_MAX: MB_CE_LURKER_MAX,
				MB_CE_LURKER_FRIDGE_MAX: MB_CE_LURKER_FRIDGE_MAX,
				mbCELurkerPatchText: mbCELurkerPatchText,
				mbCELurkerPatchDom: mbCELurkerPatchDom,
				mbCELurkerPatchStory: mbCELurkerPatchStory,
				mbCELurkerPatchReport: mbCELurkerPatchReport,
				mbCELurkerRepatch: mbCELurkerRepatch,
				/* v2.0.0.002 FertilityExpansion 自带作弊等价（10 项，直连 window.EdenCheats） */
				mbCEFertRun: mbCEFertRun,
				mbCEFertChildren: mbCEFertChildren,
				mbCEFertReady: mbCEFertReady,
				MB_CE_FERT_ACTIONS: MB_CE_FERT_ACTIONS,
				/* v2.0.0.002 需求①③：孩子页（好感/定向发送/随叫随到/一键长大）+ 角色页孩子拦截 */
				mbCEFertKidPairs: mbCEFertKidPairs,
				mbCEFertKidInfo: mbCEFertKidInfo,
				mbCEFertKidAlive: mbCEFertKidAlive,
				mbCEFertKidSetAffection: mbCEFertKidSetAffection,
				mbCEFertKidSetLocation: mbCEFertKidSetLocation,
				mbCEFertKidCallToMe: mbCEFertKidCallToMe,
				mbCEFertKidGrowUp: mbCEFertKidGrowUp,
				mbCEFertRenderChildren: mbCEFertRenderChildren,
				MB_CE_FERT_KID_LOCS: MB_CE_FERT_KID_LOCS,
				/* v2.0.0.002 收敛轮：养育四项 / 先天四项写入（补齐四项后调模组 API，缺失则兜底直写） */
				mbCEFertKidSaveSkills: mbCEFertKidSaveSkills,
				mbCEFertKidSaveInnate: mbCEFertKidSaveInnate,
				mbCEFertKidCurSkills: mbCEFertKidCurSkills,
				mbCEFertKidCurInnate: mbCEFertKidCurInnate,
				MB_CE_FERT_KID_SKILLS: MB_CE_FERT_KID_SKILLS,
				MB_CE_FERT_KID_INNATE: MB_CE_FERT_KID_INNATE,
				mbCEFertKidVars: mbCEFertKidVars,
				/* v2.0.0.003 需求②：原版「你对什么感到不安?」直写（$uncomfortable，5 项） */
				mbCEAttitudeSet: mbCEAttitudeSet,
				mbCEAttitudeSetAll: mbCEAttitudeSetAll,
				mbCEAttitudeUndo: mbCEAttitudeUndo,
				mbCEAttitudeGet: mbCEAttitudeGet,
				mbCEAttitudeGate: mbCEAttitudeGate,
				MB_CE_ATTITUDE_ITEMS: MB_CE_ATTITUDE_ITEMS,
				mbCEEdenChildIdOf: mbCEEdenChildIdOf,
				mbCEOnPassageInit: mbCEOnPassageInit,
				undoRomanceStage: undoRomanceStage,
				undoVanillaStage: undoVanillaStage,
				onPassageOverride: onPassageOverride,
				/* v1.9.23 锚定触发：地点判定 / 确认条触发 / 元数据 / 前置提示 */
				mbCEOnPassageEnd: mbCEOnPassageEnd,
				startAnchoredReplay: startAnchoredReplay,
				/* v1.9.30 剧情直达触发：从场景 def 直接开播（跳过地点判定/确认条/队列） */
				directTriggerScene: directTriggerScene,
				/* v1.9.30.005 出口判据升级：widget 结束信号表为惰性缓存（首次判定构建一次）。
				   游戏内段落集合固定，正常运行不会重建；测试注入 mock 段落后需显式重置。 */
				resetWidgetEndSignalCache: function () { mbCE_widgetEndTbl = null; },
				/* v1.9.30.005 判据自检口：注释被剔除后的纯函数级判定（供 smoke 直接断言，
				   不必构造 Story 段落实例；判据改动必须能在这里被单测抓到） */
				srcHasEndSignal: function (src) { return mbCESrcHasEndSignal(src); },
				sceneAnchorMeta: sceneAnchorMeta,
				pendingPreconds: pendingPreconds,
				precondDone: precondDone,
				fillStats: fillStats,
				statDefsFor: statDefsFor,
				globalFill: globalFill,
				globalRomance: globalRomance,
				globalTransform: globalTransform,
				/* v1.9.28：全局页批量解锁（供外部自动化/测试调用，返回解锁计数） */
				globalUnlockClothes: globalUnlockClothes,
				globalUnlockRecipes: globalUnlockRecipes,
				/* v1.8.8 庄园自动维护（学 AutoClean 0.1.5 原功能） */
				mcFeedAvery: mcFeedAvery,
				mcMaintainFarm: mcMaintainFarm,
				/* v1.8.10 庄园自动维护扩展（神殿/伊甸/补给/打扫） */
				mcMaintainTemple: mcMaintainTemple,
				mcMaintainEden: mcMaintainEden,
				mcRestockSupplies: mcRestockSupplies,
				mcCleanMansion: mcCleanMansion,
				/* v2.0.3 维护写入留痕回退 */
				maintUndo: mbCEMaintUndo,
				maintUndoAll: mbCEMaintUndoAll,
				maintWrite: mbCEMaintWrite,
				/* v1.9.x 庄园自动维护：每日全自动调度（AutoClean 模式） */
				AUTO_MAINTAIN_ITEMS: AUTO_MAINTAIN_ITEMS,
				mcAutoState: mcAutoState,
				mcAutoIsOn: mcAutoIsOn,
				mcAutoSet: mcAutoSet,
				mcAutoRunOnce: mcAutoRunOnce,
				mcAutoMaintainTick: mcAutoMaintainTick,
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
				revertNpcTrait: revertNpcTrait,
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
				/* v1.9.28：特质分类中文组标题映射（与 RAW 配套，供外部校验覆盖完整性） */
				TRAIT_ZH_CAT: TRAIT_ZH_CAT,
				/* v1.9.15 数值固定（07f-lock.js）：锁定向/强制写回/取消 */
				mbCELockSet: mbCELockSet,
				mbCELockRemove: mbCELockRemove,
				mbCELockHas: mbCELockHas,
				mbCELockTick: mbCELockTick,
				mbCELockRead: mbCELockRead, mbCELockResume: mbCELockResume, mbCEResumeTimers: mbCEResumeTimers,
				MB_CE_LOCK_PRESETS: MB_CE_LOCK_PRESETS,
				/* v2.0.1 收敛：锁定文案中文名 + 直达前原版状态兜底（供测试与外部校验） */
				mbCELockLabel: mbCELockLabel,
				ensureSceneStateFor: ensureSceneStateFor,
				/* v2.0.7 P1/P2/D4/D6：锁定来源判定 + 回退连带解锁 + 预览队列/全部确认 */
				mbCELockSource: mbCELockSource,
				mbCEPreviewCount: mbCEPreviewCount,
				mbCEPreviewConfirm: mbCEPreviewConfirm,
				mbCEPreviewConfirmAll: mbCEPreviewConfirmAll,
				mbCEPreviewCancel: mbCEPreviewCancel,
				mbCEPreviewGate: mbCEPreviewGate, mbCEAdapterAction: mbCEAdapterAction, hasV: hasV, CHEAT_ADAPTERS: CHEAT_ADAPTERS,
				mbCEPaneRefresh: mbCEPaneRefresh,
				/* v2.0.7 R1/R2/R3/R4：外观隐藏 + 小岛生存 + 地下妓院（07j / 07k） */
				mbCEHideApply: mbCEHideApply,
				mbCEHideUndo: mbCEHideUndo,
				mbCEHideTargets: mbCEHideTargets,
				mbCEHideTick: mbCEHideTick,
				mbCEHideForce: mbCEHideForce,
				mbCEHideNoPenalty: mbCEHideNoPenalty,
				MB_CE_HIDE_WINGS_SPECIES: MB_CE_HIDE_WINGS_SPECIES,
				mbCEIslandV: mbCEIslandV,
				mbCEPlaceWriteRaw: mbCEPlaceWriteRaw,
				mbCEIslandLocToggle: mbCEIslandLocToggle,
				mbCEIslandNumWrite: mbCEIslandNumWrite,
				MB_CE_ISLAND_NUMS: MB_CE_ISLAND_NUMS,
				MB_CE_ISLAND_LOCS: MB_CE_ISLAND_LOCS,
				MB_CE_ISLAND_BUILDS: MB_CE_ISLAND_BUILDS,
				MB_CE_NPC_REUNION: MB_CE_NPC_REUNION,
				renderTransformHideSec: renderTransformHideSec, renderIslandSec: renderIslandSec, renderNpcUndergroundSec: renderNpcUndergroundSec,
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
				/* v1.9.13 预设模板 / 时间调节 / 数值搜索（全局页 + 玩家自己页 + Mod 作弊页） */
				applyQuickPreset: applyQuickPreset,
				mcTimeNow: mcTimeNow, mcTimeAdvance: mcTimeAdvance, mcTimeJump: mcTimeJump,
				setModValueFilter: setModValueFilter, cheatValueMatches: cheatValueMatches, renderCheatValues: renderCheatValues,
				/* v1.9.0 性别切换（玩家自己页）：原版键 penisExist/vaginaExist/penissize/gender_body */
				getPlayerGender: getPlayerGender,
				applyPlayerGender: applyPlayerGender,
				/* v1.8.12 错误收集器 + 面板状态持久化 */
				mbCEPushError: mbCEPushError,
				mbCEErrors: function () { return mbCEErrors.slice(); },
				/* v1.8.15 九巡：留痕有界化（测试与诊断用） */
				mbCEWroteTrim: mbCEWroteTrim,
				mbCEUiState: function () { return JSON.parse(JSON.stringify(mbCEUiState)); },
				mbCEUiSave: mbCEUiSave,
				mbCEUiLoad: mbCEUiLoad,
				mbCEUiCollapsed: mbCEUiCollapsed,
				/* v2.0.23 四主题：setTheme 直设 / cycleTheme 循环（gold→starry→cyberpunk→jade，自动持久化）；showAnchorPrompt 供测试触发确认条 */
				setTheme: setTheme, cycleTheme: cycleTheme, renderGlobal: renderGlobal,
				getTheme: getTheme,
				showAnchorPrompt: showAnchorPrompt,
				hideAnchorPrompt: hideAnchorPrompt,
				/* v1.8.12 功能12：适配器工作流审计 */
				auditAdapters: auditAdapters
			};
		} catch (e) {}
	}
	mountApi();

	init();
})();

