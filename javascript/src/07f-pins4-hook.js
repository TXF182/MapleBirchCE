/* 职责：passageoverride 与 passageinit 钩子 —— 锚定触发判定 / 解冻玩家属性 */
	/* :passageoverride 钩子：固定触发判定（在 SugarCube 原版 redirect 之前改 passageArgs.name） */
	function onPassageOverride(passageArgs) {
		try {
			var V = getV();
			if (!V) { return; }
			var dest = passageArgs && passageArgs.name;
			/* v1.5.1：Mansion 系段落兜底——无论以何种方式进入艾弗里庄园段落（场景直达、场景查看器重放、
			   固定触发、第二天正常日常），只要 $daily.avery.talk 缺失，avery_daily_talk / Mansion Talk 正文
			   都会 TypeError（reading 'chat'/'ignore'）；在固定触发判定前无条件兜底（缺失才建，不覆盖进度） */
			if (typeof dest === "string" && dest.length > 0 &&
				(dest.indexOf("Mansion") === 0 || dest.indexOf("Avery") === 0 || dest.indexOf("Avery's") === 0)) {
				ensureAveryMansion();
			}
			/* 原版重放结束（Scene Viewer End 且正处于重放）→ 记录场景解锁 + 清理已触发项 */
			if (dest === "Scene Viewer End" && V.replayScene) {
				cleanupUsedPins();
				/* v1.4.8：MOD 固定触发的重放播放完（到 Scene Viewer End）→ 自动返回原位（exitpassage）
				   并解除固定；跳过 End 段落（原版 End 显示 "Exit scene" 需手动点、且回的是场景查看器列表）。
				   原版手动重放保持原版行为：End → Exit scene 回场景查看器。 */
				var wasMod = !!V.mbCE_replayOnce;
				var backTo = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				mbCEClearReplay(!wasMod); /* v1.9.5-自检：统一清理入口（原版手动重放不 unfreeze） */
				if (wasMod && backTo && passageArgs) { passageArgs.name = backTo; }
				return;
			}
			if (V.replayScene) {
				/* 原版手动重放（非 MOD 固定触发）→ 交给原版处理，不干预 */
				if (!V.mbCE_replayOnce) { return; }
				/* v1.9.23-实机修复二轮（锚定触发播放完不清队列/被困 Scene Viewer End 死循环的根治）：
				   MOD 锚定/固定触发直接播剧情段（不经场景查看器播放器容器）——剧情出口段（dest 不在
				   replayScene.passages）会被原版 redirect（31697-31698）改写为 "Scene Viewer End"，
				   而本钩子已在同一轮 :passageoverride 事件内执行过（只看到旧 dest），下方 823 的
				   "Scene Viewer End" 分支永远收不到改写后的 dest → 播完不清理、队列残留、返回地点再弹；
				   玩家点「退出场景」（End 段汉化链接 target=Scene Viewer）又被 redirect 打回 End → 死循环被困。
				   修复：在本轮事件内直接接管剧情出口——清理队列 + 改 passageArgs.name 回原位（exitpassage），
				   原版 31683 检测 name 已变 → return 新 dest，redirect 不再执行。 */
				var rpExit = V.replayScene.passages;
				var exitDest = V.replayScene.exitpassage || "";
				var inChain = Array.isArray(rpExit) && rpExit.indexOf(dest) !== -1;
				var isEndUi = (dest === "Scene Viewer End" || dest === "Scene Viewer passages" || dest === "Scene Viewer End 2");
				/* v1.9.30-实机修复：直达触发（mbCE_direct）不走白名单中断——
				   直达语义 = 无条件开播、剧情自然流转、结束自然回主循环。
				   实机 bug 根因：凯拉尔绑架等大剧情不在场景注册表显式 passages（getScenesDefs 走
				   recover 兜底，白名单残缺），玩家选任意选项 → dest 不在白名单 → 下方「链外出口」
				   判定/原版 redirect（DoL L31697：!passages.includes(dest) → "Scene Viewer End"）
				   把剧情分支段当出口 → 清 replayScene + 改 dest 回触发点 → 「选选项跳回原地点」。
				   修复：① 剧情内分支段动态并入白名单（redirect 判 dest ∈ passages → 放行，剧情不打断）；
				   ② 剧情出口特征（当前段「含结束信号」——字面 <<endevent>>/<<badEndTrackingEnd>>，或 v1.9.30.005 起
				   段内调用的 widget 定义体内部含之（<<endcombat>> 等运行时展开才可见），玩家点 Next 跳普通段）
				   → 剧情已结束 → 清理重放状态但保留 dest（剧情自身引导回主循环 = 走完正常发展）。 */
				if (V.replayScene.mbCE_direct) {
					if (dest === "Scene Viewer" || isEndUi) {
						/* 直达不应落到场景查看器 UI（原版 redirect 兜底）：清理 + 回原位 */
						cleanupUsedPins();
						mbCEClearReplay();
						if (exitDest && passageArgs) { passageArgs.name = exitDest; }
						return;
					}
					var curSrc = "";
					try {
						if (typeof State !== "undefined" && State && typeof State.passage === "string") {
							var curTpl = (typeof Story !== "undefined" && Story && typeof Story.get === "function") ? Story.get(State.passage) : null;
							if (curTpl && (curTpl.source || curTpl.text)) { curSrc = curTpl.source || curTpl.text; }
						}
					} catch (e) {}
					if (curSrc && mbCESrcHasEndSignal(curSrc) &&
						!(Array.isArray(rpExit) && rpExit.indexOf(dest) !== -1)) {
						/* 出口段点击（当前段「含结束信号」= 字面 <<endevent>>/<<badEndTrackingEnd>>，
						   或 v1.9.30.005 起：段内直接调用的 widget 定义体内部含之——<<endcombat>> /
						   <<girlfriend>> / <<nightmareEnd>> 等 94 条 depth=1，widget 运行时展开才可见）：
						   剧情已结束 → 清理重放状态，保留 dest 让剧情自然回主循环（走完正常发展）。
						   v1.9.30.002-实机修复：移除「dest !== startPassage」排除——学校检查剧情
						   （SchoolInspection Breast/Penis/Pussy）出口段 "Breast Inspection End" 含 <<endevent>>
						   且 Next 回 startPassage "Science Lesson"（原版场景回环设计，Science Lesson ∉ 白名单），
						   旧排除把它当「剧情未结束」→ replayScene 残留 → 剧情页全部「直达触发」按钮
						   永久禁用（title 正在播放剧情）。现改为：出口段一律判定剧情结束——
						   dest 仍在本剧情白名单内（出口段通往剧情内段 = 中间事件结束/剧情回环，
						   如 19.12a 凯拉尔 Release 4→Abduction）→ 由 rpExit 排除保护，不清理放行；
						   dest=startPassage（∉ 白名单）/exitDest 触发点/剧情外段 → 清理，玩家随 dest 落主循环。
						   v1.9.30.003-迭代优化：同时移除「dest !== exitDest」排除——出口段 Next 回触发点
						   （玩家在 Danube Street 触发凯拉尔绑架直达，出口段 Release 4 回 Danube Street=exitDest；
						   全量实证 110 场景/16087 段：含 endevent 链内段 Next 离链均为主循环段/触发点，语义即剧情结束）
						   旧排除同样制造残留 → 全部直达按钮禁用；出口段一律以「当前段含结束信号」为准，
						   与下方 dest===exitDest 清理分支共同覆盖所有返回触发点路径（对齐非 direct 分支 L1012 语义）。 */
						cleanupUsedPins();
						mbCEClearReplay();
						return;
					}
					/* v1.9.30.003-迭代优化：玩家回到触发点（exitpassage）——剧情退出（中途返回/出口段回原位）
					   → 清理重放状态（对齐非 direct 分支对 exitpassage 的清理语义，防残留致按钮永久禁用）；
					   必须在并入白名单之前判定（exitDest 是触发时所在段，非剧情链段，不应被并入）。 */
					if (dest === exitDest) {
						cleanupUsedPins();
						mbCEClearReplay();
						return;
					}
					/* 剧情分支段：并入白名单防原版 redirect 改写为 Scene Viewer End，放行 */
					if (Array.isArray(rpExit) && rpExit.indexOf(dest) === -1) {
						try { rpExit.push(dest); } catch (e) {}
					}
					return;
				}
				if (dest === "Scene Viewer" || (!isEndUi && dest !== "Farm Work" && dest !== V.replayScene.startPassage && !inChain && dest !== exitDest)) {
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (exitDest && passageArgs) { passageArgs.name = exitDest; }
					return;
				}
				/* v1.4.8：MOD 固定触发的 case 场景播放完链回 Scene Viewer passages（非首次进入）→
				   自动返回原位并解除固定（跳过原版 default 的 "Error occurred" + 手动 Back 步） */
				if (dest === "Scene Viewer passages" && !V.mbCE_replayPending) {
					cleanupUsedPins();
					var backS = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (backS && passageArgs) { passageArgs.name = backS; }
					return;
				}
				/* v1.4.5：原版重放经 Back 正常返回原位（exitpassage）→ 清理残留（replayScene/标记/已用队列项），
				   避免残留导致后续取消固定误判"正在重放"、以及再次重放时被残留干扰 */
				if (dest === (V.replayScene.exitpassage || "")) {
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					return;
				}
				/* MOD 固定触发的重放：仅已知确定性逃逸终点到达时清理残留（农场剧情结束直接去 Farm Work 而非回 Scene Viewer），
				   否则一律视为仍在重放（含剧情中间段落不在注册表列表的情况）→ 不干预、不触发 */
				if (dest === "Farm Work") {
					/* 农场剧情确定性终点：结束即清理残留（unfreeze + 清标记），并移除已触发项（同 Scene Viewer End） */
					cleanupUsedPins(); /* v1.9.23：统一清理（解锁 + 已完成记录 + 移除） */
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
				} else {
					/* v1.9.23-实机修复三轮：重放链内段判定——dest 在 replayScene.passages 内（inChain 恒 true），
					   二轮「链外出口」接管覆盖不到。两类播完信号：
					   ① 剧情线性走完：到达剧情末段（passages 最后一段）且前置链内段均已访问 → 剧情播完（落地点，
					      如「米奇酒吧知名度初见」Pub Fame Intro 4 为酒吧主段，实机 $pubfame 已存在走 else 选项、
					      无循环出口）→ 清理 + 回原位；分支型场景（如 Avery 各分支段）前置未全访问 → 不触发不误伤。
					   ② 剧情链循环回点：已访问段再次到达且非 startPassage/exitpassage（如 4 段剧情分支 Next 回
					      Pub Fame Intro）→ 剧情播完进入循环 → 清理 + 回原位。 */
					var visArr = V.replayScene.mbCE_visited;
					if (!Array.isArray(visArr)) { visArr = V.replayScene.mbCE_visited = []; }
					var wasVisited = visArr.indexOf(dest) !== -1;
					if (!wasVisited) { visArr.push(dest); }
					var isLastSeg = rpExit.length > 0 && dest === rpExit[rpExit.length - 1];
					if (isLastSeg) {
						var allPrevVisited = true;
						for (var pi = 0; pi < rpExit.length - 1; pi++) {
							if (visArr.indexOf(rpExit[pi]) === -1) { allPrevVisited = false; break; }
						}
						if (allPrevVisited) {
							cleanupUsedPins(); /* 线性播完：解锁 + 已完成记录 + 移除 */
							mbCEClearReplay();
							if (exitDest && passageArgs) { passageArgs.name = exitDest; }
							return;
						}
					}
					if (!wasVisited) { return; } /* 首次访问（含分支场景首次到末段）→ 不清理 */
					if (dest !== V.replayScene.startPassage && dest !== exitDest) {
						/* 非首次访问（循环回点）→ 播完清理 */
						cleanupUsedPins();
						mbCEClearReplay();
						if (exitDest && passageArgs) { passageArgs.name = exitDest; }
					}
					return; /* startPassage / exitpassage 重访 → 不触发 */
				}
			}
			var q = getPinQueue();
			if (!q) { return; }
			var P = null;
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].active !== false && !q[i].used && q[i].startPassage) { P = q[i]; break; }
			}
			if (!P) { return; }
			/* v1.9.23：带地点元数据的锚定项由 :passageend 弹确认条触发（走到该地点交互时），
			   段落跳转本身不再自动触发；旧档无元数据项保持旧「任意推进即触发」语义直至触发完 */
			var anchorMeta = P.anchor || sceneAnchorMeta(P.key);
			if (anchorMeta && anchorMeta.location) { return; }
			if (!dest || dest === P.startPassage || dest === "Scene Viewer End") { return; }
			if (Array.isArray(P.passages) && P.passages.indexOf(dest) !== -1) { return; }
			/* 防崩：农场依赖剧情且 $farm 未初始化 → 本次不触发（保留队列项，待农场线开启后自动可触发） */
			if (isFarmDependentScene(P) && !farmStateReady()) { return; }
			/* 防崩：艾弗里庄园/森林商店等段落依赖 $avery_mansion（可能延迟初始化）→ 触发前兜底 */
			ensureAveryMansion();
			/* 防崩：农场依赖剧情需 $farm 结构存在（触发前兜底，缺失才补，不覆盖已有进度） */
			ensureFarmState();
			/* 启动原版重放：先执行场景初始变量 → 冻结属性 → 设 $replayScene → 重定向入口 */
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			V.replayScene = {
				name: P.name,
				startPassage: P.startPassage,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName()
			};
			V.mbCE_replayOnce = true;  /* 本重放由 MOD 固定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			/* v1.4.8：仅当场景入口是 Scene Viewer passages 才需"首次保留 sceneViewSwitch"；
			   直入剧情段落的场景（如孤儿院 SV Street Bully Orphanage Go）不设 pending，
			   避免链回 Scene Viewer passages 时被误判为首次 → 无法自动回原位 */
			V.mbCE_replayPending = (P.startPassage === "Scene Viewer passages");
			passageArgs.name = P.startPassage;
			P.used = true; /* 一次性：触发后不再重复触发 */
			unlockPlaceForScene(P); /* 联动解锁：触发即解锁所在场景组（如凯拉尔剧情 → 庄园可直达） */
			applyWorldUnlockForScene(P); /* 世界入口解锁：写入原版进入条件（多瑙河街→庄园等） */
		} catch (e) { /* 触发登记失败（存档只读/结构异常）→ 本次不写 used/联动解锁，不阻断段落跳转 */ }
	}
	function hookPassageOverride() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			/* SugarCube 自定义事件系统（jQLite）：与 DoL 本体 $(document).one(':passageend',…) 一致。
			   四巡：命名空间防重——重载/重复注入时先 off 再 on，避免 jQuery handler 无限累积 */
			$(document).off(":passageoverride.mbce").on(":passageoverride.mbce", function (ev, passageArgs) {
				onPassageOverride(passageArgs);
			});
		} catch (e) {}
	}
	/* 场景查看器段落初始化拦截（防"播放完又播放"无限循环）：
	   本体的 Scene Viewer passages 段落在 <<switch $sceneViewSwitch>> 里无条件播放 case 剧情，
	   剧情 widget 结束若链回该段落会再次命中 case → 无限循环（且 replayScene 只在 default/End 清理）。
	   机制：固定触发跳转前设 mbCE_replayPending；首次进入该段落（pending=true）→ 消费标记、保留
	   sceneViewSwitch（case 正常播放）；剧情结束链回（pending=false 且处于我们的重放）→ 清
	   sceneViewSwitch 为无效值 → switch 走 default → 原版给出 Back 链接返回原位，不再重播。 */
	function mbCEOnPassageInit(title) {
		try {
			/* v1.3.5：格威岚场景临时变量全局兜底——每次进入任意段落都先确保
			   T.gwylanStatus / T.gwylanTF 已初始化（缺失才补，已有绝不覆盖）。
			   本体 Gwylan Ritual Start Garden 等段落靠 <<run statusCheck("Gwylan")>>
			   初始化这两个临时变量，但 statusCheck 仅在 C.npc.Gwylan.init === 1 时才调用
			   gwylanStatusCheck()（新存档未见过格威岚即不调用）；且 gwylanStatusCheck()
			   在 V.gwylanTalked/V.gwylanSeen/V.gwylan 缺失时早退，只设 T.gwylanStatus=[]、
			   不设 T.gwylanTF。新存档场景直达/固定触发格威岚段落 → 读 _gwylanStatus/
			   _gwylanTF 即崩（reading 'includesAny' / 'tail'）。全局兜底可覆盖任何段落名
			   （含框架改段落名/宿主段落内嵌格威岚内容的渲染路径）。 */
			ensureGwylanSceneState();
			/* v1.9.x 庄园自动维护每日调度：任意段落进入时检查游戏日变化，
			   执行已开启的自动维护项（AutoClean 模式，见 03-global.js mcAutoMaintainTick） */
			try { mcAutoMaintainTick(); } catch (e) {}
			if (title !== "Scene Viewer passages") { return; }
			var V = getV();
			if (!V) { return; }
			if (V.mbCE_replayPending) { V.mbCE_replayPending = false; return; }
			if (V.replayScene && V.mbCE_replayOnce) { V.sceneViewSwitch = "MB_CE_END"; }
		} catch (e) { /* passage 收尾钩子失败必须静默，避免阻断原版段落流转 */ }
	}
	function hookPassageInit() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageinit.mbce").on(":passageinit.mbce", function (ev, passage) {
				try {
					var t = (passage && passage.title) ? passage.title : "";
					mbCEOnPassageInit(t);
				} catch (e) {}
			});
		} catch (e) {}
	}
	/* v1.8.19：播放结束自动清理——包装 window.unfreezePlayerStats。
	   背景（用户实测）：固定 MOD 剧情播放完一次后不自动取消、仍重新播放；手动取消后仍被困播放器。
	   根因：结束判定只认 4 个硬编码段落名（Scene Viewer End / Scene Viewer passages / exitpassage /
	   Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景，结束段落为框架自有名，
	   不走原版 Scene Viewer 通道）的结束段落不被识别 → 队列 used 项永不清理 + replayScene 残留 →
	   下次推进剧情再次触发（循环）或拦截后续固定。
	   修复：任何合法 unfreezePlayerStats 调用（原版 Scene Viewer 退出 / 框架播放器结束 / mod 播放器
	   结束都会解冻）都视为"场景播放结束"→ 清理队列 used 项 + 清 replayScene/标记。不再依赖段落名。 */
	function hookUnfreezePlayerStats() {
		try {
			if (typeof window === "undefined" || !window) { return; }
			var orig = window.unfreezePlayerStats;
			if (typeof orig !== "function" || window.__mbCEUnfreezeHooked) { return; }
			window.__mbCEUnfreezeHooked = true;
			window.unfreezePlayerStats = function () {
				try {
					var V = getV();
					if (V && V.replayScene && V.mbCE_replayOnce) {
						/* MOD 固定触发的重放中收到 unfreeze = 播放结束 → 清理已触发项 + 重放状态 */
						cleanupUsedPins();
						try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
						try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) { /* 重放一次性标记清理失败 → 保留原值，不影响本次播放结束流程 */ }
					}
				} catch (e) { /* 清理重放状态失败必须静默，避免遮蔽下方 orig 原函数调用 */ }
				try { return orig.apply(window, arguments); } catch (e) {}
			};
		} catch (e) { /* unfreeze 钩子安装失败不阻断面板加载（退化为不接管 unfreeze） */ }
	}

