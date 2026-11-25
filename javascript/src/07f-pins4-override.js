/* 职责：passageoverride 钩子的判定主体（07f-pins4-hook 的 override 段）。
   v2.2.4 结构治理：原 onPassageOverride 圈复杂度 101 / 嵌套 6 / 207 行，一处承担「庄园兜底 + 重放终点 +
   直达态出口 + 非直达态出口 + 链内段播完 + 固定触发启动」六类判定。现按判定阶段拆成独立函数，
   onPassageOverride 只留顺序调度；钩子注册（hookPassageOverride / :passageinit / unfreeze 包装）
   仍在 07f-pins4-hook.js，两段同属一个构建作用域，函数声明可跨段引用。
   注：ESLint complexity 把 && / || / ?: 一并计数，故长布尔表达式也收敛为具名判定函数。 */

/* :passageoverride 钩子：固定触发判定（在 SugarCube 原版 redirect 之前改 passageArgs.name） */
function onPassageOverride(passageArgs) {
	try {
		var V = getV();
		if (!V) { return; }
		var dest = passageArgs && passageArgs.name;
		/* v1.5.1：Mansion 系段落兜底——无论以何种方式进入艾弗里庄园段落（场景直达、场景查看器重放、
		   固定触发、第二天正常日常），只要 $daily.avery.talk 缺失，avery_daily_talk / Mansion Talk 正文
		   都会 TypeError（reading 'chat'/'ignore'）；在固定触发判定前无条件兜底（缺失才建，不覆盖进度） */
		if (typeof dest === "string" && mbCEIsAveryPassage(dest)) {
			ensureAveryMansion();
		}
		if (mbCEHandleReplayOverride(dest, passageArgs, V)) { return; }
		mbCEHandlePinTrigger(dest, passageArgs, V);
	} catch (e) { /* 触发登记失败（存档只读/结构异常）→ 本次不写 used/联动解锁，不阻断段落跳转 */ }
}

/* 重放态拦截：true = 本次跳转已被处理（不再进入固定触发判定） */
function mbCEHandleReplayOverride(dest, passageArgs, V) {
	/* 原版重放结束（Scene Viewer End 且正处于重放）→ 记录场景解锁 + 清理已触发项 */
	if (dest === "Scene Viewer End" && V.replayScene) {
		mbCEFinishReplayAtEnd(passageArgs, V);
		return true;
	}
	if (!V.replayScene) { return false; }
	/* 原版手动重放（非 MOD 固定触发）→ 交给原版处理，不干预 */
	if (!V.mbCE_replayOnce) { return true; }
	if (V.replayScene.mbCE_direct) {
		mbCEHandleDirectReplay(dest, passageArgs, V);
		/* 直达分支原有每条路径都以 return 结束；这里统一视为已处理，等价原实现 */
		return true;
	}
	return mbCEHandleNormalReplay(dest, passageArgs, V);
}

/* v1.4.8：MOD 固定触发的重放播放完（到 Scene Viewer End）→ 自动返回原位（exitpassage）
   并解除固定；跳过 End 段落（原版 End 显示 "Exit scene" 需手动点、且回的是场景查看器列表）。
   原版手动重放保持原版行为：End → Exit scene 回场景查看器。 */
function mbCEFinishReplayAtEnd(passageArgs, V) {
	cleanupUsedPins();
	var wasMod = !!V.mbCE_replayOnce;
	var backTo = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
	mbCEClearReplay(!wasMod); /* v1.9.5-自检：统一清理入口（原版手动重放不 unfreeze） */
	if (wasMod && backTo && passageArgs) { passageArgs.name = backTo; }
}

/* 直达触发（mbCE_direct）分支：直达语义 = 无条件开播、剧情自然流转、结束自然回主循环。
   原 v1.9.30-实机修复：凯拉尔绑架等大剧情不在场景注册表显式 passages（getScenesDefs 走
   recover 兜底，白名单残缺），玩家选任意选项 → dest 不在白名单 → 原版「链外出口」判定/redirect
   （DoL L31697：!passages.includes(dest) → "Scene Viewer End"）把剧情分支段当出口 →
   清 replayScene + 改 dest 回触发点 → 「选选项跳回原地点」。由 ①② 两处修复兜住。 */
function mbCEHandleDirectReplay(dest, passageArgs, V) {
	var rp = V.replayScene;
	var rpExit = rp.passages;
	var exitDest = rp.exitpassage || "";
	if (dest === "Scene Viewer" || mbCEIsSceneViewerEndUi(dest)) {
		/* 直达不应落到场景查看器 UI（原版 redirect 兜底）：清理 + 回原位 */
		mbCEFinishReplayAndReturn(exitDest, passageArgs);
		return;
	}
	if (mbCEIsDirectSceneExit(dest, rpExit)) {
		/* 出口段点击（当前段「含结束信号」= 剧情已结束）→ 清理重放状态但保留 dest
		   （剧情自身引导回主循环 = 走完正常发展） */
		cleanupUsedPins();
		mbCEClearReplay();
		return;
	}
	if (dest === exitDest) {
		/* v1.9.30.003-迭代优化：玩家回到触发点（exitpassage）——剧情退出（中途返回/出口段回原位）
		   → 清理重放状态（对齐非 direct 分支对 exitpassage 的清理语义，防残留致按钮永久禁用）；
		   必须在并入白名单之前判定（exitDest 是触发时所在段，非剧情链段，不应被并入）。 */
		cleanupUsedPins();
		mbCEClearReplay();
		return;
	}
	/* 剧情分支段：并入白名单防原版 redirect 改写为 Scene Viewer End，放行 */
	mbCEAppendSceneChain(dest, rpExit);
}

/* 直达态出口判定：当前段「含结束信号」且 dest 不在本剧情白名单内。
   出口特征 = 字面 <<endevent>>/<<badEndTrackingEnd>>，或 v1.9.30.005 起：段内直接调用的 widget
   定义体内部含之（<<endcombat>> / <<girlfriend>> / <<nightmareEnd>> 等 94 条 depth=1，
   widget 运行时展开才可见），玩家点 Next 跳普通段。
   v1.9.30.002/003-实机修复：移除 dest !== startPassage / exitDest 的排除——出口段一律以
   「当前段含结束信号」为准（全量实证 110 场景/16087 段：含 endevent 链内段 Next 离链均为主循环段/
   触发点，语义即剧情结束），旧排除会制造 replayScene 残留 → 剧情页全部「直达触发」按钮永久禁用。 */
function mbCEIsDirectSceneExit(dest, rpExit) {
	var curSrc = mbCECurrentPassageSource();
	return !!(curSrc && mbCESrcHasEndSignal(curSrc) && !mbCEIsInSceneChain(dest, rpExit));
}

/* 非直达重放（原版 Scene Viewer 通道）分支：true = 已处理；false = Farm Work 落出（继续走固定触发判定）。
   原实现 Farm Work 分支末尾不 return，直落后续队列判定 —— 这里用返回值显式表达同一语义。 */
function mbCEHandleNormalReplay(dest, passageArgs, V) {
	var rp = V.replayScene;
	var exitDest = rp.exitpassage || "";
	if (mbCEIsOutsideSceneChain(dest, rp, exitDest)) {
		/* v1.9.23：统一清理（解锁 + 已完成记录 + 移除）；含原 v1.4.5「原版经 Back 返回原位」的同一收尾 */
		mbCEFinishReplayAndReturn(exitDest, passageArgs);
		return true;
	}
	/* v1.4.8：MOD 固定触发的 case 场景播放完链回 Scene Viewer passages（非首次进入）→
	   自动返回原位并解除固定（跳过原版 default 的 "Error occurred" + 手动 Back 步） */
	if (mbCEIsChainBackToViewer(dest, V)) {
		mbCEFinishReplayAndReturn(exitDest, passageArgs);
		return true;
	}
	/* v1.4.5：原版重放经 Back 正常返回原位（exitpassage）→ 清理残留（replayScene/标记/已用队列项），
	   避免残留导致后续取消固定误判"正在重放"、以及再次重放时被残留干扰 */
	if (dest === exitDest) {
		mbCEFinishReplayAndReturn("", passageArgs);
		return true;
	}
	/* MOD 固定触发的重放：仅已知确定性逃逸终点到达时清理残留（农场剧情结束直接去 Farm Work 而非回 Scene Viewer），
	   否则一律视为仍在重放（含剧情中间段落不在注册表列表的情况）→ 不干预、不触发 */
	if (dest === "Farm Work") {
		/* 农场剧情确定性终点：结束即清理残留（unfreeze + 清标记），并移除已触发项（同 Scene Viewer End） */
		mbCEFinishReplayAndReturn("", passageArgs);
		return false;
	}
	mbCEHandleChainVisit(dest, passageArgs, V, rp.passages, exitDest);
	return true;
}

/* 链外出口判定：非 Scene Viewer UI、非 Farm Work、非起始段、不在白名单、非触发点 → 视为链外出口 */
function mbCEIsOutsideSceneChain(dest, rp, exitDest) {
	if (dest === "Scene Viewer") { return true; }
	if (mbCEIsSceneViewerEndUi(dest)) { return false; }
	if (dest === "Farm Work") { return false; }
	if (dest === rp.startPassage) { return false; }
	if (mbCEIsInSceneChain(dest, rp.passages)) { return false; }
	return dest !== exitDest;
}

/* 固定触发链回 Scene Viewer passages（非首次进入）→ 应自动回原位 */
function mbCEIsChainBackToViewer(dest, V) {
	return dest === "Scene Viewer passages" && !V.mbCE_replayPending;
}

/* 统一收尾：清理队列 + 清重放态 + 可选改跳目标（原各分支内联的三步收尾，blank = 只清理不改跳） */
function mbCEFinishReplayAndReturn(backTo, passageArgs) {
	cleanupUsedPins();
	mbCEClearReplay();
	if (backTo && passageArgs) { passageArgs.name = backTo; }
}

/* v1.9.23-实机修复三轮：重放链内段判定——dest 在 replayScene.passages 内（inChain 恒 true），
   二轮「链外出口」接管覆盖不到。两类播完信号：
   ① 剧情线性走完：到达剧情末段（passages 最后一段）且前置链内段均已访问 → 剧情播完（落地点，
      如「米奇酒吧知名度初见」Pub Fame Intro 4 为酒吧主段，实机 $pubfame 已存在走 else 选项、
      无循环出口）→ 清理 + 回原位；分支型场景（如 Avery 各分支段）前置未全访问 → 不触发不误伤。
   ② 剧情链循环回点：已访问段再次到达且非 startPassage/exitpassage（如 4 段剧情分支 Next 回
      Pub Fame Intro）→ 剧情播完进入循环 → 清理 + 回原位。 */
function mbCEHandleChainVisit(dest, passageArgs, V, rpExit, exitDest) {
	var rp = V.replayScene;
	var visArr = mbCEVisitedList(rp);
	var wasVisited = visArr.indexOf(dest) !== -1;
	if (!wasVisited) { visArr.push(dest); }
	if (mbCEIsLastSceneSegment(dest, rpExit) && mbCEAllPrevSegmentsVisited(rpExit, visArr)) {
		mbCEFinishReplayAndReturn(exitDest, passageArgs); /* 线性播完：解锁 + 已完成记录 + 移除 */
		return;
	}
	if (!wasVisited) { return; } /* 首次访问（含分支场景首次到末段）→ 不清理 */
	if (mbCEIsReplayAnchorPassage(dest, rp, exitDest)) { return; } /* startPassage / exitpassage 重访 → 不触发 */
	mbCEFinishReplayAndReturn(exitDest, passageArgs); /* 非首次访问（循环回点）→ 播完清理 */
}

/* 已访问段落表（缺失时就地建表并回填到 rp，行为与旧实现一致） */
function mbCEVisitedList(rp) {
	var visArr = rp.mbCE_visited;
	if (!Array.isArray(visArr)) { visArr = rp.mbCE_visited = []; }
	return visArr;
}

/* dest 是否为剧情末段（passages 最后一项） */
function mbCEIsLastSceneSegment(dest, rpExit) {
	return rpExit.length > 0 && dest === rpExit[rpExit.length - 1];
}

/* dest 是剧情起始段或触发点（重访这两处不应触发播完清理） */
function mbCEIsReplayAnchorPassage(dest, rp, exitDest) {
	return dest === rp.startPassage || dest === exitDest;
}

/* 末段判定辅助：除末段外的链内段是否全部访问过（短路 AND，避免半程误判播完） */
function mbCEAllPrevSegmentsVisited(rpExit, visArr) {
	for (var pi = 0; pi < rpExit.length - 1; pi++) {
		if (visArr.indexOf(rpExit[pi]) === -1) { return false; }
	}
	return true;
}

/* 场景查看器 UI 段落集合（原 isEndUi 表达式原样收敛） */
function mbCEIsSceneViewerEndUi(dest) {
	return dest === "Scene Viewer End" || dest === "Scene Viewer passages" || dest === "Scene Viewer End 2";
}

/* dest 是否已在场景段落链内（动态并入后同样命中） */
function mbCEIsInSceneChain(dest, passages) {
	return Array.isArray(passages) && passages.indexOf(dest) !== -1;
}

/* 剧情分支段并入白名单（防原版 redirect 把它改写成 Scene Viewer End） */
function mbCEAppendSceneChain(dest, rpExit) {
	if (Array.isArray(rpExit) && rpExit.indexOf(dest) === -1) {
		try { rpExit.push(dest); } catch (e) { /* 段落表被冻结时并入失败 → 原版 redirect 兜底，不阻断跳转 */ }
	}
}

/* 当前段落模板源码（出口段「含结束信号」判定的输入；取不到返回空串） */
function mbCECurrentPassageSource() {
	var curSrc = "";
	try {
		var pname = mbCEStatePassageName();
		if (pname) { curSrc = mbCETemplateSource(mbCEStoryGet(pname)); }
	} catch (e) { /* Story/State 不可用（测试桩/早期启动）→ 返回空串，跳过出口段判定 */ }
	return curSrc;
}

/* State.passage 读取（只读；State 不存在时返回空串） */
function mbCEStatePassageName() {
	if (typeof State !== "undefined" && State && typeof State.passage === "string") { return State.passage; }
	return "";
}

/* Story.get 读取（只读；Story 不存在时返回 null） */
function mbCEStoryGet(name) {
	if (typeof Story !== "undefined" && Story && typeof Story.get === "function") { return Story.get(name); }
	return null;
}

/* 段落模板源码（source 优先，退回 text；无内容返回空串） */
function mbCETemplateSource(tpl) {
	if (!tpl) { return ""; }
	return tpl.source || tpl.text || "";
}

/* 固定触发判定：从队列取第一个可用项，条件满足则启动原版重放 */
function mbCEHandlePinTrigger(dest, passageArgs, V) {
	var q = getPinQueue();
	if (!q) { return; }
	var P = mbCEPinPickActive(q);
	if (!P) { return; }
	if (!mbCEPinCanTriggerNow(dest, P)) { return; }
	mbCEPinEnsureDeps(P);
	mbCEStartPinReplay(P, passageArgs, V);
}

/* 队列里第一个「启用 + 未触发 + 有入口段」的项 */
function mbCEPinPickActive(q) {
	for (var i = 0; i < q.length; i++) {
		if (q[i] && q[i].active !== false && !q[i].used && q[i].startPassage) { return q[i]; }
	}
	return null;
}

/* 本次跳转是否允许触发该固定场景（false = 本次不触发，队列项保留） */
function mbCEPinCanTriggerNow(dest, P) {
	/* v1.9.23：带地点元数据的锚定项由 :passageend 弹确认条触发（走到该地点交互时），
	   段落跳转本身不再自动触发；旧档无元数据项保持旧「任意推进即触发」语义直至触发完 */
	var anchorMeta = P.anchor || sceneAnchorMeta(P.key);
	if (anchorMeta && anchorMeta.location) { return false; }
	if (!dest || dest === P.startPassage || dest === "Scene Viewer End") { return false; }
	if (mbCEIsInSceneChain(dest, P.passages)) { return false; }
	/* 防崩：农场依赖剧情且 $farm 未初始化 → 本次不触发（保留队列项，待农场线开启后自动可触发） */
	if (isFarmDependentScene(P) && !farmStateReady()) { return false; }
	return true;
}

/* 触发前依赖兜底：庄园壳（仅剧情涉及庄园段落时）+ 农场结构 */
function mbCEPinEnsureDeps(P) {
	/* v2.1.10：仅在剧情涉及庄园段落时才兜底建壳 —— 原版以「$avery_mansion 对象存在」
	   判定已进入过庄园，无差别建壳会让新档提前解锁庄园衣柜 */
	var needAvery = mbCEIsAveryPassage(P.startPassage);
	if (!needAvery && Array.isArray(P.passages)) {
		for (var avz = 0; avz < P.passages.length && !needAvery; avz++) { needAvery = mbCEIsAveryPassage(P.passages[avz]); }
	}
	if (needAvery) { ensureAveryMansion(); }
	/* 防崩：农场依赖剧情需 $farm 结构存在（触发前兜底，缺失才补，不覆盖已有进度） */
	ensureFarmState();
}

/* 启动原版重放：先执行场景初始变量 → 冻结属性 → 设 $replayScene → 重定向入口 */
function mbCEStartPinReplay(P, passageArgs, V) {
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
}
