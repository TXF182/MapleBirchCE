/* 职责：锚定触发元数据 —— 地点标签（locLabel）、场景锚定信息、前置达成判定、确认条状态（anchorPromptActive） */
	function locLabel(loc) { return LOCATION_LABELS[loc] || loc || "（未标注）"; }
	/* 场景 key → 锚定元数据（表内命中；旧队列项无元数据 → null，保持旧段落跳转语义） */
	function sceneAnchorMeta(key, def) {
		try {
			var s = SCENE_LOCATIONS[key];
			if (!s && /^AlexFarmWorkStage\d+$/.test(key || "")) {
				/* 兼容一位/两位数字位宽：真实注册表 key 为两位（03..12），部分来源为一位 */
				var nn = (/^AlexFarmWorkStage(\d+)$/.exec(key) || [])[1];
				s = SCENE_LOCATIONS["AlexFarmWorkStage" + (nn.length === 1 ? "0" + nn : nn)];
			}
			if (s) { return { location: s.loc, timeNote: s.time || "" }; }
			/* v1.9.26：静态表未命中时，从 manualVariableChanges 提取 $location
			   （大量场景 mvc 含 <<set $location to '...'>> / <<location '...'>>，覆盖静态表未收录的场景，
			   免手工实证补全；def 由调用方传入免调 getScenesDefs 重解析，def 缺失才 fallback getScenesDefs；
			   timeNote 仅静态表有，mvc 来源无时间提示） */
			var mvc = def && def.manualVariableChanges;
			if (!mvc) {
				var defs = getScenesDefs();
				var d2 = defs && defs.defs && defs.defs[key];
				mvc = d2 && d2.manualVariableChanges;
			}
			if (mvc) {
				var lm = mvc.match(/\$location\s+to\s+['"]([^'"]+)['"]/) || mvc.match(/<<\s*location\s+['"]([^'"]+)['"]/);
				if (lm && lm[1]) { return { location: lm[1], timeNote: "" }; }
			}
		} catch (e) {}
		return null;
	}
	/* 前置是否已完成：scenePassages 达成（绿标）或锚定播放完成（mbCE_completedScenes）任一即算 */
	function precondDone(key) {
		try {
			var defs = getScenesDefs();
			var def = defs.defs[key];
			if (def && sceneStatus(def).state === "pass") { return true; }
		} catch (e) {}
		try {
			var V = getV();
			if (V && V.mbCE_completedScenes && V.mbCE_completedScenes[key]) { return true; }
		} catch (e) {}
		return false;
	}
	/* 锚定某场景的未完成前置列表（显示名）：跨线显式映射 + 线内数字后缀自动推导 */
	function pendingPreconds(key) {
		var names = [];
		try {
			var defs = getScenesDefs();
			var nm = function (k2) { var d = defs.defs[k2]; return (d && d.name) || k2; };
			var pre = SCENE_PRECONDITIONS[key];
			if (Array.isArray(pre)) {
				for (var i = 0; i < pre.length; i++) {
					var k3 = pre[i];
					if (!precondDone(k3)) { names.push(nm(k3)); }
				}
			}
			/* 线内前置：同前缀、数字更小的未完成阶段（数字后缀聚线自动推导，零维护） */
			var m = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/.exec(key);
			if (m) {
				var prefix = m[1], num = parseInt(m[2], 10), suffix = m[3];
				Object.keys(defs.defs).forEach(function (k4) {
					var m4 = /^([A-Za-z]+)(\d+)([A-Za-z]*)$/.exec(k4);
					if (m4 && m4[1] === prefix && m4[3] === suffix && parseInt(m4[2], 10) < num && !precondDone(k4)) { names.push(nm(k4)); }
				});
			}
		} catch (e) {}
		var seen = {}, out = [];
		for (var j = 0; j < names.length; j++) {
			if (!seen[names[j]]) { seen[names[j]] = true; out.push(names[j]); }
		}
		return out;
	}
	/* ============ 锚定确认条与手动触发（v1.9.23） ============ */
	var mbCE_anchorPrompt = null;      /* 内存态：当前展示中的确认条 { key, t } */
	var mbCE_anchorCooldown = {};      /* key -> Date.now()：暂不触发后 60s 冷却，防同地点反复弹（v1.9.23-实机修复五轮 60s→1h；用户拍板 1h→60s） */
	var mbCE_anchorPromptEl = null;
	function anchorPromptActive(key) {
		if (mbCE_anchorPrompt && mbCE_anchorPrompt.key === key) { return true; }
		var cd = mbCE_anchorCooldown[key];
		if (cd && (Date.now() - cd) < 60000) { return true; } /* 60s 冷却（用户拍板 1h→60s） */
		return false;
	}
	/* 确认「立即触发」：与原固定触发的重放启动通道一致（manualVariableChanges → freeze → replayScene → 跳转入口） */
	function startAnchoredReplay(P) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档不可用，无法触发" }; }
			if (!P || !P.startPassage) { return { ok: false, message: "缺少入口段落，无法触发" }; }
			/* v1.9.23-实机修复：SV 注册场景（startPassage 以 "SV " 开头的查看器预览页，如 "SV Adult Shop Opening"）
			   锚定触发不再播放预览页（角色卡+Start 的「剧情播放器」样式）→ 直接进入剧情第一段。
			   判据：预览页段落源码含 <<link [[Start|剧情入口>>（label 恰为 Start）；
			   SV 链形态（如 SV Temple Confess Purge → Start → SV Temple Confess Purge 2）递归跳过；
			   剧情本体类（如 SV Pub Fame Intro 含场景初始化、无 Start 链接）→ 保持原入口。 */
			var entry = P.startPassage;
			if (String(P.startPassage).indexOf("SV ") === 0) {
				var hop = P.startPassage;
				for (var depth = 0; depth < 10; depth++) {
					var svSrc = "";
					try {
						if (typeof Story !== "undefined" && Story) {
							if (typeof Story.get === "function") {
								var svTpl = Story.get(hop);
								if (svTpl && (svTpl.source || svTpl.text)) { svSrc = svTpl.source || svTpl.text; }
							}
							if (!svSrc && typeof Story.lookupWith === "function") {
								var svHits = Story.lookupWith(function (p) { return p && p.name === hop; });
								if (svHits && svHits.length && (svHits[0].source || svHits[0].text)) {
									svSrc = svHits[0].source || svHits[0].text;
								}
							}
						}
					} catch (e) {}
					var svM = /\[\[Start\|([^\]|]+)/.exec(svSrc);
					if (!svM || !svM[1]) { entry = hop; break; }   /* 无 Start 链接：当前段即入口（保留其初始化） */
					var svNext = String(svM[1]).trim();
					if (svNext.indexOf("SV ") === 0) { hop = svNext; continue; }  /* SV 预览链 → 递归下一跳 */
					entry = svNext; break;  /* 直达剧情入口 */
				}
			}
			/* v1.9.23-自检：防重入——重放进行中（确认条双击/重复调用）再次触发会覆盖 exitpassage
			   为播放器段落导致返回错位甚至被困播放器 → 拒绝并提示等待 */
			if (V.replayScene) { return { ok: false, message: "已有重放在进行中（" + ((V.replayScene.name) || "") + "），请先等播放完成" }; }
			if (isFarmDependentScene(P) && !farmStateReady()) {
				return { ok: false, message: "「" + P.name + "」依赖农场系统状态（$farm 未初始化）：请先推进到艾利克斯农场线后再触发" };
			}
			ensureAveryMansion();
			ensureFarmState();
			/* v2.0.1：剧情触发（SV 预览链已解析为真实入口）同样兜底监狱/农场原版状态，
			   避免新档触达 Prison* / Farm* 剧情段时深链读 $prison.* / $farm.* 抛 TypeError */
			ensureSceneStateFor(String(entry));
			if (Array.isArray(P.passages)) { for (var pz = 0; pz < P.passages.length; pz++) { ensureSceneStateFor(String(P.passages[pz])); } }
			var ep = getEnginePlayFn();
			if (!ep) { return { ok: false, message: "游戏引擎不可用，无法触发（请刷新页面重试）" }; }
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			/* v1.9.23-实机修复六轮：P.used=true 必须在本重放 freezePlayerStats 之前写入——
			   原版 freezePlayerStats widget 深拷贝整个 State.variables 冻结快照（mbCE_queue 不在其
			   skipKeysOnFreeze 排除表，used:false 被冻结），播完原版 unfreezePlayerStats 用 strict-replace
			   恢复快照会把 used 还原为 false（队列项复活 → 确认条循环弹；实机 F12 铁证：live=true / frozen=false）。
			   先置 used=true 使冻结快照含 true，恢复后保持 true，配合 mbCEOnPassageEnd 残留清理闭环。 */
			P.used = true;
			/* v1.9.30-实机修复：直达触发（P.direct）不冻结数值——直达语义 = 剧情真实生效
			   （剧情 effects 产生的数值变化播放后保留，"走完正常发展"），冻结仅用于锚定/固定触发的
			   纯观看重放（unfreeze 用冻结快照 strict-replace 恢复，会把剧情效果一并抹掉）。 */
			if (!P.direct) {
				try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			}
			V.replayScene = {
				name: P.name,
				startPassage: entry,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName(),
				mbCE_direct: !!P.direct
			};
			V.mbCE_replayOnce = true;  /* 本重放由锚定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			V.mbCE_replayPending = (entry === "Scene Viewer passages");
			unlockPlaceForScene(P);  /* 联动解锁：触发即解锁所在场景组 */
			applyWorldUnlockForScene(P);
			hideAnchorPrompt();
			try { ep.play.call(ep.e, entry, true); } catch (e) {
				/* 跳转失败：回滚 used（保留队列项）+ 清重放状态，避免卡死 */
				try { P.used = false; } catch (e2) {}
				mbCEClearReplay(true);
				return { ok: false, message: "跳转失败：" + mbCEErr(e) };
			}
			return { ok: true, message: "已开始触发「" + P.name + "」" };
		} catch (e) { return { ok: false, message: "触发失败：" + mbCEErr(e) }; }
	}
	/* v1.9.30 剧情直达触发：从场景 def 构造临时 P 并直接开始锚定重放。
	   与「锚定」的区别：跳过地点判定/确认条/队列——点即触发；不写 mbCE_queue，
	   不干扰锚定状态机（cleanupUsedPins 只清队列 used 项，直达无队列项无操作）；
	   播完走 startAnchoredReplay 既有出口清理（回原位 + 记「已完成 ✓」），即"走完正常发展"。 */
	function directTriggerScene(key) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档不可用，无法直达" }; }
			if (V.replayScene) { return { ok: false, message: "已有剧情播放中，请先结束当前播放" }; }
			var gd = typeof getScenesDefs === "function" ? getScenesDefs() : null;
			var defs = gd && gd.defs ? gd.defs : gd; /* getScenesDefs 返回 {defs,live} 包装，兼容裸对象 */
			var def = defs && defs[key];
			if (!def) { return { ok: false, message: "未找到剧情「" + key + "」（未注册或未解析）" }; }
			if (!def.startPassage) { return { ok: false, message: "「" + (def.name || key) + "」无入口段落，无法直达" }; }
			var P = {
				key: key,
				name: def.name || key,
				startPassage: def.startPassage,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || null,
				direct: true /* v1.9.30-实机修复：直达 = 不冻结数值 + 不走白名单中断（onPassageOverride mbCE_direct 分支） */
			};
			var r = startAnchoredReplay(P);
			if (!r.ok) { return r; }
			return { ok: true, message: r.message, scene: P };
		} catch (e) { return { ok: false, message: "直达失败：" + mbCEErr(e) }; }
	}
	/* 挂载确认条（页面顶部，非阻断式） */
	function showAnchorPrompt(P, meta) {
		try {
			mbCE_anchorPrompt = { key: P.key, t: Date.now() };
			if (mbCE_anchorPromptEl && mbCE_anchorPromptEl.parentNode) { mbCE_anchorPromptEl.parentNode.removeChild(mbCE_anchorPromptEl); }
			var box = document.createElement("div");
			box.className = "mce-anchor-prompt";
			/* v1.9.29 确认条 token 化：样式全部移入 07a-shell CSS 类（此前内联 #f5f0e0 米色/绿/灰，与面板黑金脱节；
			   现走 --mce-gold-* token，换主题自动跟随） */
			if (getTheme() === "starry") { box.classList.add("mce-theme-starry"); }
			var txt = document.createElement("span");
			var timeTxt = meta.timeNote ? "｜时间 " + meta.timeNote : "";
			var pre = pendingPreconds(P.key);
			/* v1.9.23-自查优化：无前置要求时不再显示「前置均已达成」——该文案与面板完成状态
			   「要求：未达成（条件未满足）」同屏自相矛盾（触发前置 ≠ 完成条件，13_17 截图实证）；
			   改为「触发前置：无」，明确这是触发条件而非完成状态。 */
			var preTxt = pre.length ? "｜触发前置未完成：" + pre.join("、") : "｜触发前置：无";
			txt.textContent = "检测到锚定剧情「" + P.name + "」：触发地点「" + locLabel(meta.location) + "」" + timeTxt + preTxt + "，是否立即触发？";
			box.appendChild(txt);
			var go = document.createElement("button");
			go.type = "button";
			go.textContent = "立即触发★";
			go.className = "mce-anchor-go";
			go.addEventListener("click", function () {
				var r = startAnchoredReplay(P);
				if (!r.ok) { setStatus(r.message, "mce-err"); }
				hideAnchorPrompt();
			});
			var skip = document.createElement("button");
			skip.type = "button";
			skip.textContent = "暂不触发";
			skip.addEventListener("click", function () {
				mbCE_anchorCooldown[P.key] = Date.now(); /* 60s 冷却：同地点不再反复弹，保留队列待下次（用户拍板 1h→60s） */
				hideAnchorPrompt();
			});
			box.appendChild(go);
			box.appendChild(skip);
			var host = document.getElementById("story") || document.body;
			host.insertBefore(box, host.firstChild);
			mbCE_anchorPromptEl = box;
		} catch (e) {}
	}
	function hideAnchorPrompt() {
		try {
			mbCE_anchorPrompt = null;
			if (mbCE_anchorPromptEl) {
				if (mbCE_anchorPromptEl.parentNode) { mbCE_anchorPromptEl.parentNode.removeChild(mbCE_anchorPromptEl); }
				mbCE_anchorPromptEl = null;
			}
		} catch (e) {}
	}
	/* :passageend 钩子：锚定触发判定——段落渲染完成后 V.location 已更新为当前段落地点，
	   队首未用未完成项带地点元数据且与当前地点匹配 → 弹确认条（确认触发 / 暂不待下次）。
	   重放中（V.replayScene）不弹；旧档无元数据项不走此通道（passageoverride 旧语义）。 */
	function mbCEOnPassageEnd() {
		try {
			var V = getV();
			if (!V) { return; }
			if (V.replayScene) { return; }
			/* v1.9.23-实机修复六轮：段落后清理残留 used 项——原版 unfreezePlayerStats strict-replace 恢复
			   冻结快照会把已移除/已标记的队列项复活（used 被还原 → 确认条循环弹）。此处幂等清理：
			   已触发（used）项写「已完成 ✓」并移出队列，复活项在下一段落被清，确认条不再循环弹。 */
			cleanupUsedPins();
			var q = getPinQueue();
			if (!q) { return; }
			/* v1.9.23-实机修复五轮：残留确认条清理——弹条后未点按钮直接离开触发地点（如酒吧→麋鹿街），
			   fixed 条会跨段残留（玩家反馈「取消锚定之后立即触发并没有消失」的画面证据：麋鹿街挂着酒吧条）。
			   当前展示条对应地点已非当前段落 → 自动收起。 */
			if (mbCE_anchorPrompt && mbCE_anchorPrompt.key) {
				var pk = mbCE_anchorPrompt.key;
				var curMeta = null;
				for (var k = 0; k < q.length; k++) {
					if (q[k] && q[k].key === pk) { curMeta = q[k].anchor || sceneAnchorMeta(q[k].key); break; }
				}
				if (curMeta && curMeta.location && (typeof V.location !== "string" || V.location !== curMeta.location)) {
					hideAnchorPrompt();
				}
			}
			/* 遍历队列找「当前地点匹配」的锚定项。旧实现只取队首、location 不匹配即 return，
			   队首「米奇酒吧知名度初见」（酒吧）在玩家到其他地点时拦截了后续所有锚定
			   （玩家反馈「暂不触发之后再去选其他锚定，其他锚定的立即触发也不会出现」根因）。 */
			var P = null;
			for (var i = 0; i < q.length; i++) {
				var it = q[i];
				if (it && it.active !== false && !it.used && it.startPassage) {
					var m = it.anchor || sceneAnchorMeta(it.key);
					if (m && m.location) {
						if (typeof V.location === "string" && V.location === m.location) {
							/* v1.9.23-自查优化：原实现 break 后在下方 anchorPromptActive(P.key) return——
							   同地点多锚定时，A 暂不触发（1h 冷却）或正展示中 → B（同地点）被拦截永不弹
							   （「暂不触发后其他锚定不弹」的同地点残余路径）。改为冷却/展示中的项 continue
							   继续找下一个同地点匹配项，全部不可用才不弹。 */
							if (anchorPromptActive(it.key)) { continue; }
							P = it; break;
						}
					}
					/* 无元数据旧档项：保留旧 passageoverride 语义，不在此通道处理 */
				}
			}
			if (!P) { return; }
			var meta = P.anchor || sceneAnchorMeta(P.key);
			if (!meta || !meta.location) { return; } /* 旧档无元数据项 → 保持旧段落跳转语义 */
			showAnchorPrompt(P, meta);
		} catch (e) {}
	}
	function hookPassageEnd() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageend.mbceAnchor").on(":passageend.mbceAnchor", function () {
				try { mbCEOnPassageEnd(); } catch (e) {}
			});
		} catch (e) {}
	}
	function getPinQueue() {
		try {
			var V = getV();
			if (!V) { return null; }
			var q = V.mbCE_queue;
			if (!Array.isArray(q)) { q = []; V.mbCE_queue = q; }
			/* 旧版兼容迁移（幂等）：v1.1 单固定 mbCE_pinned → 并入队列并标记 used（已触发过，不再重复触发） */
			var old = V.mbCE_pinned;
			if (old && typeof old === "object" && old.active && old.startPassage) {
				var dup = false;
				for (var i = 0; i < q.length; i++) {
					if (q[i] && q[i].key === old.key) { dup = true; break; }
				}
				if (!dup) {
					q.push({ key: old.key, name: old.name, startPassage: old.startPassage, passages: Array.isArray(old.passages) ? old.passages.slice() : [], manualVariableChanges: old.manualVariableChanges || "", used: true });
				}
				try { delete V.mbCE_pinned; } catch (e) { V.mbCE_pinned = undefined; }
			}
			return q;
		} catch (e) { return null; }
	}
	/* 队列中未触发的固定项（UI 横幅/条目用） */
	function getPinnedScene() {
		try {
			var q = getPinQueue();
			if (!q) { return []; }
			return q.filter(function (p) { return p && p.active !== false && !p.used && p.startPassage; });
		} catch (e) { return []; }
	}
	/* 固定项在队列中的序号（0 起，未固定返回 -1） */
	function pinQueueIndex(key) {
		try {
			var q = getPinQueue();
			if (!q) { return -1; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === key && q[i].active !== false && !q[i].used) { return i; }
			}
		} catch (e) {}
		return -1;
	}
