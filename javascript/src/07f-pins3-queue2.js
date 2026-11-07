/* 职责：锚定队列与解锁 —— 取消锚定（unpinScene）、passage→地点映射、场景世界入口解锁（applyWorldUnlock） */
	function unpinScene(key) {
		var V = getV();
		var back = "";
		var changed = false;
		try {
			/* v1.9.23-实机修复五轮：取消锚定（指定 key 或清空）时，若该 key 正展示确认条 → 一并收起
			   （玩家反馈「取消锚定之后立即触发并没有消失」） */
			if (mbCE_anchorPrompt && (key === undefined || key === null || key === "" || mbCE_anchorPrompt.key === key)) {
				hideAnchorPrompt();
			}
			var q = getPinQueue();
			if (q && q.length) {
				if (key === undefined || key === null || key === "") {
					q.length = 0; changed = true;
				} else {
					for (var i = q.length - 1; i >= 0; i--) {
						if (q[i] && q[i].key === key) { q.splice(i, 1); changed = true; }
					}
				}
			}
			if (V && V.replayScene) {
				changed = true;
				/* v1.8.19 防困播放器重构（用户实测：手动取消后仍被困场景播放器）+ v1.9.4 根治：
				   根因一：back = exitpassage || currentPassageName() 的兜底会让"玩家正处于播放器段落
				   时取消"变成原地跳转（跳去当前播放器段落），且随后删 replayScene → 播放器 default 分支
				   的 Back 链接无源 → 退出按钮消失 → 被困。
				   根因二：先调 unfreezePlayerStats（wikifier）会经 mbCEUnfreezeHook 提前删掉 replayScene，
				   跳转目标若恰为播放器段落同样导致 Back 无源。
				   v1.9.4：合并 inPlayer 分支——重放中取消固定，一律 Engine.play(back) 强制跳回原位再清理，
				   不再区分"是否原版 Scene Viewer 播放器段落"。覆盖用户实测的模组恋爱播放器场景
				   （播放器停在第 N 张图、手动取消后仍被困）：back 有效即强制脱离任何播放器/中间段落。
				   play(back) 触发 :passageoverride（dest=back → 489 行 Back 返回原位分支）自然清理
				   used 队列项；随后手动清 replayScene/标记兜底（幂等）。 */
				back = (V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				/* 先清 sceneViewSwitch 为无效值 → Scene Viewer passages 的 switch 走 default（顺序不可反） */
				V.sceneViewSwitch = "MB_CE_END";
				if (back) {
					var ep = getEnginePlayFn();
					if (ep) {
						/* v1.9.5-自检：跳转可用才清理——若 Engine 不可用（极端），保留 replayScene/标记，
						   播放器 Back 链接仍有源，避免重蹈「删 replayScene → Back 无源 → 被困」覆辙 */
						try { ep.play.call(ep.e, back, true); } catch (e) {}
						mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					}
				}
				/* back 为空：保留 replayScene/标记
				   （播放器 default 的 Back 链接依赖它），不主动跳转——玩家经 Back 退出
				   （489 行路径清理）或播放器自身退出调用 unfreeze → mbCEUnfreezeHook 兜底清理。 */
			}
		} catch (e) {}
		return changed;
	}
	/* 剧情入口段落/剧情名 → 匹配的场景组 id（联动解锁用）；
	   兼容 Maplebirch 场景查看器入口前缀（SV xxx / Scene Viewer xxx） */
	function placeIdForPassage(startPassage, sceneName) {
		try {
			var cands = [];
			if (startPassage) {
				cands.push(startPassage);
				if (startPassage.indexOf("SV ") === 0) { cands.push(startPassage.slice(3)); }
				if (startPassage.indexOf("Scene Viewer ") === 0) { cands.push(startPassage.slice(13)); }
			}
			if (sceneName) { cands.push(sceneName); }
			for (var i = 0; i < PLACE_GROUPS.length; i++) {
				var g = PLACE_GROUPS[i];
				if (!g || typeof g.match !== "function") { continue; }
				for (var j = 0; j < cands.length; j++) {
					if (cands[j] && g.match(cands[j])) { return g.id; }
				}
			}
		} catch (e) {}
		return null;
	}
	/* 场景联动解锁：剧情触发完成 → 记录对应场景组解锁（场景页显示已解锁并可直接直达） */
	function unlockPlaceForScene(P) {
		try {
			var V = getV();
			if (!V || !P || !P.startPassage) { return; }
			if (!V.mbCE_unlockedPlaces || typeof V.mbCE_unlockedPlaces !== "object") { V.mbCE_unlockedPlaces = {}; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			/* 入口为 SV 前缀等特殊形态时，用剧情包含段落兜底匹配（如 "Manor Kylar Room" 在 passages 中） */
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) {
				V.mbCE_unlockedPlaces[gid] = { key: P.key, name: P.name, startPassage: P.startPassage, t: Date.now() };
			}
		} catch (e) {}
	}
	/* 世界入口解锁表（v1.3）：各组场景在游戏世界里的原版进入条件（已从本体源码实证）：
	   - kylar_manor：多瑙河街 → "Kylar's manor" 链接，条件 $syndromekylar gte 1
	   - orphanage_loft：孤儿院大厅 → "Loft" 链接，条件 $loft_known is 1
	   - avery_mansion：多瑙河街 → "Avery's mansion" 链接，条件 $avery_mansion 存在且 fate 非 fallen/kicked（v1.2.1 兜底已自动满足）
	   - sirris_places：成人商店 → "Approach Sirris" 链接，条件 $adultshopstate 非 "closed"（营业时间仍受原版控制）
	   - elk_compound（v1.7.0）：Elk Street → "Approach the compound" 链接，条件 $compound.allowed 为 true
	     （未允许时仅显示 "Sneak into the compound" 潜入链接，crimeUp 30 trespassing——已从本体源码实证）
	   - doren_flat / sydney_temple / gwylan_garden：无持久世界入口（剧情/时间触发或动态位置）→ 不写入 */
	var WORLD_UNLOCKS = {
		"kylar_manor": { var: "syndromekylar", set: 1, entry: "多瑙河街 → Kylar's manor（庄园花园）" },
		"orphanage_loft": { var: "loft_known", set: 1, entry: "孤儿院大厅 → Loft（阁楼）" },
		"avery_mansion": { entry: "多瑙河街 → Avery's mansion（已由庄园状态兜底自动解锁）" },
		"sirris_places": { var: "adultshopstate", set: "open", entry: "成人商店 → 接近西里斯（营业时段可见）" },
		"elk_compound": { path: "compound.allowed", set: true, entry: "Elk Street → Approach the compound（需 $compound.allowed）" }
	};
	/* v2.0.3 回退语义补齐：世界入口解锁原为裸写（V[path]=value 无痕迹，误点后无法撤回）。
	   现统一走 mbCEWorldWrite：逐层补壳 + 仅值变化时写 + 首次 before 留痕（key=world:<gid>:<path>）；
	   回退 mbCEWorldUndo(gid) 还原首次写入前状态（before=undefined → 删字段）。 */
	function mbCEWorldResolve(path, create) {
		var V = getV();
		var parts = String(path || "").split(".");
		if (!V || !parts.length || !parts[0]) { return null; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] === null || typeof cur[parts[i]] !== "object") {
				if (!create) { return null; }
				cur[parts[i]] = {}; /* 父级缺失则逐层补空对象壳（防 undefined 写入） */
			}
			cur = cur[parts[i]];
		}
		return { root: V, parent: cur, leaf: parts[parts.length - 1] };
	}
	function mbCEWorldWrite(gid, path, value) {
		try {
			var r = mbCEWorldResolve(path, true);
			if (!r || !gid) { return false; }
			if (r.parent[r.leaf] === value) { return false; } /* 幂等：值已到位不写、不新增留痕 */
			var V = r.root;
			var before = r.parent[r.leaf];
			var key = "world:" + gid + ":" + path;
			var prev = V.mbCE_wrote && V.mbCE_wrote[key];
			/* before 始终保留「首次写入前」状态（含 undefined=原本无字段），用 in 判断避免覆盖 */
			if (prev && "before" in prev) { before = prev.before; }
			r.parent[r.leaf] = value;
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			V.mbCE_wrote[key] = { type: "world", gid: gid, path: path, before: before, after: value, t: Date.now() };
			mbCEWroteTrim(V);
			return true;
		} catch (e) { return false; }
	}
	function mbCEWorldUndo(gid) {
		try {
			var V = getV(), n = 0, prefix = "world:" + gid + ":";
			if (!V || !V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { return { ok: false, n: 0, msg: "无世界入口写入留痕" }; }
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				if (k.indexOf(prefix) !== 0) { return; }
				var rec = V.mbCE_wrote[k];
				var r = mbCEWorldResolve(rec.path, false);
				if (r) {
					if (rec.before === undefined) { try { delete r.parent[r.leaf]; } catch (e) { r.parent[r.leaf] = undefined; } }
					else { r.parent[r.leaf] = rec.before; }
				}
				try { delete V.mbCE_wrote[k]; } catch (e) { V.mbCE_wrote[k] = undefined; }
				n += 1;
			});
			return { ok: n > 0, n: n, msg: n > 0 ? "已撤回 " + n + " 项世界入口解锁" : "无该地点的世界入口留痕" };
		} catch (e) { return { ok: false, n: 0, msg: "回退异常：" + (e && e.message ? e.message : e) }; }
	}
	/* 幂等写入世界入口条件：已有更高/相同值不覆盖，只补缺失或更低值（v1.7.0 支持子路径 path 型，如 compound.allowed） */
	function applyWorldUnlock(gid) {
		try {
			var V = getV();
			if (!V || !gid || !WORLD_UNLOCKS[gid]) { return; }
			var w = WORLD_UNLOCKS[gid];
			if (w.path !== undefined) {
				mbCEWorldWrite(gid, w.path, w.set);
				/* 顺带补 discovered（Elk Street 逻辑：discovered 才显示大院入口判定） */
				if (gid === "elk_compound" && (!V.compound || V.compound.discovered !== true)) { mbCEWorldWrite(gid, "compound.discovered", true); }
				return;
			}
			if (w.var === undefined) { return; }
			if (typeof w.set === "number") {
				var cur2 = typeof V[w.var] === "number" ? V[w.var] : 0;
				if (cur2 < w.set) { mbCEWorldWrite(gid, w.var, w.set); }
			} else if (V[w.var] === undefined || V[w.var] === null || V[w.var] === "") {
				mbCEWorldWrite(gid, w.var, w.set);
			}
		} catch (e) {}
	}
	/* 剧情 → 其场景组的世界入口解锁（联动解锁时一并调用） */
	function applyWorldUnlockForScene(P) {
		try {
			if (!P || !P.startPassage) { return; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) { applyWorldUnlock(gid); }
		} catch (e) {}
	}
	/* 执行场景初始变量（manualVariableChanges，与场景查看器点「重放」一致） */
	function execTweeMacros(str) {
		try {
			if (typeof str !== "string" || !str || typeof document === "undefined" || typeof Wikifier === "undefined") { return; }
			var holder = document.createElement("span");
			holder.style.display = "none";
			document.body.appendChild(holder);
			try { new Wikifier(holder, str); }
			finally { if (holder.parentNode) { holder.parentNode.removeChild(holder); } }
		} catch (e) {}
	}
	/* 当前段落名：SugarCube 全局 passage() 优先，V.passage 兜底（真实环境可靠取到"返回原位"目标） */
	function currentPassageName() {
		try { if (typeof passage === "function") { var p = passage(); if (typeof p === "string" && p) { return p; } } } catch (e) {}
		try { var V2 = getV(); if (V2 && typeof V2.passage === "string" && V2.passage) { return V2.passage; } } catch (e) {}
		return "";
	}
	/* v1.4.8：清理队列中已触发（used）的固定项并联动解锁（三个重放终点共用）；
	   v1.9.23：播放完 → 记入 mbCE_completedScenes（「已完成 ✓」，剧情页条目显示，可再自由锚定） */
	function cleanupUsedPins() {
		try {
			var Vq = getV();
			if (!Vq) { return; }
			var qc = Vq.mbCE_queue;
			if (Array.isArray(qc)) {
				for (var i2 = 0; i2 < qc.length; i2++) {
					if (qc[i2] && qc[i2].used) {
						unlockPlaceForScene(qc[i2]);
						applyWorldUnlockForScene(qc[i2]);
						if (qc[i2].key) {
							if (typeof Vq.mbCE_completedScenes !== "object" || Vq.mbCE_completedScenes === null) { Vq.mbCE_completedScenes = {}; }
							Vq.mbCE_completedScenes[qc[i2].key] = { name: qc[i2].name, t: Date.now() };
							/* v1.9.23-实机修复六轮：同步冻结快照——原版 unfreezePlayerStats 用 frozenValues
							   strict-replace 覆盖 State.variables，不同步则刚写入的「已完成 ✓」记录被恢复撤销
							   （实机：播完后面板仍无「已完成 ✓」、按钮仍可锚定）。 */
							try { if (Vq.frozenValues && typeof Vq.frozenValues === "object") { Vq.frozenValues.mbCE_completedScenes = Vq.mbCE_completedScenes; } } catch (e) {}
						}
					}
				}
				for (var i3 = qc.length - 1; i3 >= 0; i3--) {
					if (qc[i3] && qc[i3].used) { qc.splice(i3, 1); }
				}
			}
		} catch (e) {}
	}
	/* v1.9.5-自检：清重放残留的统一入口（unpinScene / onPassageOverride 各终点共用，消除 5 处分叉不一致）。
	   顺序固定：先清 replayScene/标记，再 unfreeze（避免 mbCEUnfreezeHook 在清理前重复走 cleanup）；
	   skipUnfreeze=true 时不调 unfreeze（原版手动重放场景不干预原版流程）。 */
	function mbCEClearReplay(skipUnfreeze) {
		var Vr = getV();
		/* v1.9.30-实机修复：直达触发未冻结数值（startAnchoredReplay 对 P.direct 跳过 freeze），
		   清理时若再 unfreeze 会误恢复冻结快照/报错 → 仅对冻结过的重放（非 direct）执行 unfreeze。 */
		var wasDirect = !!(Vr && Vr.replayScene && Vr.replayScene.mbCE_direct);
		try { Vr.replayScene = undefined; } catch (e) { Vr.replayScene = undefined; }
		try { Vr.mbCE_replayOnce = undefined; Vr.mbCE_replayPending = undefined; } catch (e) {}
		if (!skipUnfreeze && !wasDirect) {
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
		}
	}
	/* ============ 出口“结束信号”判据（v1.9.30.005：字面 → 字面 + 一层 widget 展开）
	   背景：SugarCube 的 <<widget>> 是运行时展开，段内写 <<endcombat>> 时源码看不到 <<endevent；
	   只判字面会把 94 条 depth=1 出口段（BlackWolfIntro / EdenIntro / FreeTheBlackDog /
	   PrisonScarredInmate / MoorFlower … 段名多带 Finish）误判为「剧情未结束」→ 出口段被当分支
	   push 并入白名单 → 剧情播完仍残留 replayScene → 剧情页直达按钮永久禁用。
	   做法：惰性构建「定义体内直接含 <<endevent / <<badEndTrackingEnd>> 的 widget 名表」（排除 endevent
	   自身），段内任一次 <<name 调用命中即视为含结束信号。深度只做 1 层（对齐矩阵 depth=1 定案；
	   depth≥2 已取证定案不做：14 条候选中 3 条是 loadNPC→checkEventNPC 伪信号（其实体里的信号在
	   HTML 注释内），其余 11 条都落在 <<if !$replayScene>> / <<if $frozenValues>> 等条件分支内，
	  「调用 A」不保证「执行到信号」，展开会引入误判；证据见 tests/data/direct_exit_matrix.meta.txt）。
	   取不到段落 / 构建异常 → 退化为字面判据，绝不阻断直达。
	   注释排除：HTML 注释与块注释（斜杠星号对）里的 <<endevent 不算信号（原文 4 段仅注释含信号：
	   Bus Station Livestock / Elk Compound Station Badge / Mines Intro / Pirate Deck；1 个 widget
	   checkEventNPC 同理），否则会提前判定剧情已结束、把还剩可选链接的段直接清锁。
	   一致性约束：build 侧独立实现 tools/gen_direct_exit_matrix.py::end_signal_widgets 与此逐条一致；
   任一侧改判据必须两侧同改 → 重生成矩阵 → 重跑全链（19.17 穷举会立即暴露分歧）。 */
	var mbCE_widgetEndTbl = null; /* null = 未构建；对象 = 已构建（键为命中 widget 名） */
	/* 去掉两类注释后的源码（判据只在有效代码上生效） */
	function mbCEStripComments(src) {
		if (!src) { return ""; }
		return src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
	}
	function mbCEWidgetEndTable() {
		if (mbCE_widgetEndTbl !== null) { return mbCE_widgetEndTbl; }
		var out = {};
		try {
			var ps = (typeof listAllPassages === "function") ? listAllPassages() : [];
			for (var i = 0; i < ps.length; i++) {
				var s = ps[i] && ps[i].text;
				if (!s || s.indexOf("<<widget") === -1) { continue; }
				var reW = /<<widget\s+"([^"]+)"\s*>>([\s\S]*?)<<\/widget>>/g, mm;
				while ((mm = reW.exec(s)) !== null) {
					var nm = mm[1], body = mbCEStripComments(mm[2]);
					if (nm === "endevent") { continue; }
					if (body.indexOf("<<endevent") !== -1 || body.indexOf("<<badEndTrackingEnd") !== -1) { out[nm] = true; }
				}
			}
		} catch (e) { out = {}; }
		mbCE_widgetEndTbl = out;
		return out;
	}
	function mbCESrcHasEndSignal(src) {
		if (!src) { return false; }
		src = mbCEStripComments(src);
		if (src.indexOf("<<endevent") !== -1 || src.indexOf("<<badEndTrackingEnd") !== -1) { return true; }
		var tbl = mbCEWidgetEndTable();
		var reC = /<<([A-Za-z_][A-Za-z0-9_]*)/g, mm;
		while ((mm = reC.exec(src)) !== null) {
			if (tbl[mm[1]] === true) { return true; }
		}
		return false;
	}
