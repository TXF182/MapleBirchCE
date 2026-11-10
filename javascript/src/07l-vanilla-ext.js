/* 职责：全局页 ⑧「原版档案 · 收藏 · 头衔」——朋友要的三项原版作弊直写通道
   （②犯罪不留历史记录 ③一键收集古董（只收集不上交，成就一并解锁）④飞升线也能拿「雷米 疤面」）。

   原版事实（实测行号，DoL 0.5.12.13 单行 HTML）：
   - 原版自己的清犯罪 widget（L342350–L342366）写 C.crime[type] / [type+"Count"] / [type+"Daily"] + clearEvents(type)，
     **不动 history / countHistory** —— 这两项才是「案底/历史记录」，也正是本功能要补的缺口。
   - C.crime[type+"History"] / [type+"CountHistory"] 是无 clamp 的纯赋值访问器（L55598–L55650），可直接写。
   - `Count` 的 setter 带联动（count===0 且 current>0 → count=1），所以**必须直改 $crime[type] 对象字段**而不是走访问器，
     否则先置 count 再置 current 会被联动改回 1。
   - 古董状态机 museumAntiqueStatus（L608803–L608813）只接受 notFound→found / found→talk / talk→museum / 任意→stolen|recovered /
     found|talk→notFound；**只有 museum 才 museumCount++**。成就判定是 museumCount == maxCount（L104893）。
   - earnFeat（L104772–L104782）在 `V.cheatsEnabled === true` / V.debug / soft 模式 / statFreeze / allureModifier<1 时**直接 return**
     —— 作弊模式下 by design 不记成就。所以「成就一并解锁」必须直写 `V.feats.currentSave[feat] = new Date()`。
   - 头衔：飞升线写 high elk；疤面只在 `$avery_fate isnot "ascended"` 分支（L190871–L190873）。
     该段的幂等守卫是 `C.npc.Harper.title isnot "silver fox"`，所以只写 Remy 会被下一次执行覆盖回 high elk
     —— 写入时按需补 Harper / Avery 关掉回滚分支。
   - `C.npc.X` 与 `V.NPCName[setup.NPCNameList.indexOf(X)]` 是同一对象引用（initCNPC，L55584–L55590）。 */

	var MCE_VANILLA_FEAT_MUSEUM = "It Belongs in a Museum";
	/* 头衔英文 key → 中文展示（与汉化层同口径；未收录的原样输出） */
	var MCE_VANILLA_TITLE_ZH = {
		"scarred": "疤面",
		"high elk": "高麋鹿",
		"crimson hound": "猩红猎犬",
		"silver fox": "银狐狸",
		"priest": "神父",
		"priestess": "修女",
		"headmaster": "校长",
		"headmistress": "女校长",
		"hunter": "猎手",
		"huntress": "女猎手",
		"businessman": "商人",
		"businesswoman": "女商人"
	};
	/* setup.crimeNames 缺失时的兜底清单（原版 setup.crimeNames 实证 10 类） */
	var MCE_VANILLA_CRIME_FALLBACK = [
		"assault", "coercion", "destruction", "exposure", "obstruction",
		"prostitution", "resisting", "thievery", "petty", "trespassing"
	];

	function mbCEVanillaTitleZh(t) {
		if (t === undefined || t === null || t === "") { return "（空）"; }
		return MCE_VANILLA_TITLE_ZH[String(t)] || String(t);
	}

	function mbCEVanillaClone(o) {
		try {
			if (o === undefined) { return undefined; }
			return JSON.parse(JSON.stringify(o));
		} catch (e) { return undefined; }
	}

	/* 留痕：type "vcore"，key = vcore:<id>，before 为「首次写入前」整块快照（与 04b 的 before 语义一致） */
	function mbCEVanillaTrace(id, before, path, note) {
		try {
			var V = getV();
			if (!V) { return; }
			if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
			var key = "vcore:" + id;
			var prev = V.mbCE_wrote[key];
			if (!prev || !("before" in prev)) {
				V.mbCE_wrote[key] = { type: "vcore", id: id, path: path || "", before: before, t: Date.now(), note: note || "" };
			} else {
				prev.t = Date.now();
			}
			if (typeof mbCEWroteTrim === "function") { mbCEWroteTrim(V); }
		} catch (e) { /* 留痕失败不影响本次原版写入结果（留痕仅供回退参考） */ }
	}

	function mbCEVanillaCrimeTypes() {
		var names = [];
		try {
			if (typeof setup !== "undefined" && setup && setup.crimeNames) { names = Object.keys(setup.crimeNames); }
		} catch (e) {}
		if (!names.length) { names = MCE_VANILLA_CRIME_FALLBACK.slice(); }
		return names;
	}


	/* ① 犯罪记录全清：current / count / daily / history / countHistory + 事件日志
	   直改 $crime[type] 字段，绕开 C.crime[type+"Count"] 的 setter 联动（先清 count 会被联动置 1）。 */
	function mbCEVanillaCrimeClear() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		if (!V.crime || typeof V.crime !== "object") { return { ok: false, message: "未找到 $crime（该存档没有犯罪记录结构）" }; }
		var before = {
			kind: "crime",
			crime: {},
			events: mbCEVanillaClone(V.crime.events)
		};
		var types = mbCEVanillaCrimeTypes();
		types.forEach(function (t) {
			var c = V.crime[t];
			if (c && typeof c === "object") {
				before.crime[t] = {
					current: c.current, history: c.history, daily: c.daily, count: c.count, countHistory: c.countHistory
				};
			}
		});
		var touched = 0;
		types.forEach(function (t) {
			var c = V.crime[t];
			if (!c || typeof c !== "object") {
				/* 结构缺失时补一份零值，避免后续读取 undefined 崩 */
				V.crime[t] = { current: 0, history: 0, daily: 0, count: 0, countHistory: 0 };
			} else {
				c.current = 0;
				c.count = 0;
				c.daily = 0;
				c.history = 0;
				c.countHistory = 0;
			}
			touched++;
		});
		V.crime.events = {};
		mbCEVanillaTrace("crime", before, "crime", "清空全部犯罪记录（含 history / countHistory / 事件日志）");
		return {
			ok: true,
			touched: touched,
			message: "已清空 " + touched + " 类犯罪记录：current / count / daily / history / countHistory 全归零，事件日志清空（原版作弊页只能清前四项，案底清不掉）"
		};
	}

	function mbCEVanillaAntiqueState() {
		var V = getV();
		var ma = V && V.museumAntiques;
		if (!ma || typeof ma !== "object" || !ma.antiques || typeof ma.antiques !== "object") { return null; }
		return ma;
	}


	/* ② 古董：一次性「收集」（状态写 found = 已找到未上交），不写 museum（不结算奖金、不动 museumCount）；
	   成就直写 V.feats.currentSave（earnFeat 在作弊模式被门控，等不到原版结算）。 */
	function mbCEVanillaAntiqueCollect() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var ma = mbCEVanillaAntiqueState();
		if (!ma) { return { ok: false, message: "未找到 $museumAntiques（该存档还没进入博物馆线）" }; }
		var before = {
			kind: "antique",
			antiques: mbCEVanillaClone(ma.antiques),
			paintings: mbCEVanillaClone(ma.paintings),
			museumCount: ma.museumCount,
			stolenCount: ma.stolenCount,
			recoveredCount: ma.recoveredCount,
			maxCount: ma.maxCount,
			hints: mbCEVanillaClone(V.museumAntiqueJournalHints),
			hadFeat: false
		};
		try {
			before.hadFeat = !!(V.feats && V.feats.currentSave && V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] !== undefined);
		} catch (eB) {}

		var got = 0;
		Object.keys(ma.antiques).forEach(function (k) {
			if (ma.antiques[k] !== "found") { ma.antiques[k] = "found"; got++; }
		});
		/* 画作：museumPaintingGet 只认 notFound→found，写 found 即「已发现未上交」 */
		if (ma.paintings && typeof ma.paintings === "object") {
			Object.keys(ma.paintings).forEach(function (k) {
				if (ma.paintings[k] !== "found") { ma.paintings[k] = "found"; got++; }
			});
		}
		/* maxCount 兜底：原版由一个 always-run widget 每次补，存档里可能还没跑过 */
		if (!(Number(ma.maxCount) > 0)) { ma.maxCount = Object.keys(ma.antiques).length; }
		/* 期刊提示指向「未发现位置」，全部 found 后失去意义（原版 found 迁移时也会逐条清） */
		try { V.museumAntiqueJournalHints = []; } catch (eH) { /* 清期刊提示失败 → 保留旧提示（仅展示冗余，不影响古董状态） */ }

		var featOk = false;
		var featNew = false;
		try {
			if (V.feats && typeof V.feats === "object") {
				if (!V.feats.currentSave || typeof V.feats.currentSave !== "object") { V.feats.currentSave = {}; }
				if (V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] === undefined) {
					V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] = new Date();
					featNew = true;
				}
				featOk = true;
			}
		} catch (eFeat) { featOk = false; }

		mbCEVanillaTrace("antique", before, "museumAntiques", "博物馆古董一次性收集（found，不上交）+ 成就直写");
		var msg = got > 0
			? "已收齐 " + got + " 件（古董 " + Object.keys(ma.antiques).length + " + 画作 " + (before.paintings ? Object.keys(before.paintings).length : 0) + "），状态为「已发现未上交」——不会结算博物馆奖金。"
			: "古董已是全部「已发现未上交」状态，未重复写入。";
		if (featNew) { msg += " 成就「It Belongs in a Museum」已解锁。"; }
		else if (featOk) { msg += " 成就「It Belongs in a Museum」此前已解锁。" ; }
		else { msg += " 成就写入失败：该存档缺少 $feats 结构。"; }
		return { ok: true, got: got, feat: featNew, message: msg };
	}

	function mbCEVanillaNpcIdx(name) {
		try {
			if (typeof setup !== "undefined" && setup && Array.isArray(setup.NPCNameList)) { return setup.NPCNameList.indexOf(name); }
		} catch (e) {}
		return -1;
	}

	function mbCEVanillaNpcObj(V, name) {
		try {
			var i = mbCEVanillaNpcIdx(name);
			if (i < 0 || !Array.isArray(V.NPCName) || !V.NPCName[i] || typeof V.NPCName[i] !== "object") { return null; }
			return V.NPCName[i];
			/* 说明：C.npc.X 与 V.NPCName[idx] 是同一引用（initCNPC L55584–L55590），改一处即落档 */
		} catch (e) { return null; }
	}


	/* ③ 雷米头衔写「疤面」；飞升线按需补 Harper / Avery，关掉原版幂等回滚分支 */
	function mbCEVanillaRemyScar() {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var remy = mbCEVanillaNpcObj(V, "Remy");
		if (!remy) { return { ok: false, message: "未找到 Remy（$NPCName 缺少该角色，可能不是标准存档）" }; }
		var harper = mbCEVanillaNpcObj(V, "Harper");
		var avery = mbCEVanillaNpcObj(V, "Avery");
		var before = {
			kind: "title",
			remy: remy.title,
			harper: harper ? harper.title : undefined,
			avery: avery ? avery.title : undefined,
			fate: V.avery_fate
		};
		remy.title = "scarred";
		var guard = false;
		var guardMiss = false;
		if (V.avery_fate === "ascended") {
			if (harper && harper.title !== "silver fox") { harper.title = "silver fox"; guard = true; }
			if (avery && avery.title !== "crimson hound") { avery.title = "crimson hound"; guard = true; }
			if (!harper || !avery) { guardMiss = true; }
		}
		mbCEVanillaTrace("title", before, "NPCName", "雷米头衔改为疤面（scarred）");
		var msg = "雷米头衔已写为「疤面」（scarred）";
		if (V.avery_fate === "ascended") {
			msg += guard
				? "；飞升线：已同步补 Harper=银狐狸、Avery=猩红猎犬，原版结算不会再把它改回高麋鹿"
				: "；飞升线：Harper/Avery 已在位，原版结算不会覆盖";
			if (guardMiss) { msg += "（注意：Harper 或 Avery 不在 $NPCName 中，回滚守卫可能失效）"; }
		} else {
			msg += "；当前不是飞升线（$avery_fate=" + (V.avery_fate || "空") + "），原版本就写疤面";
		}
		return { ok: true, guard: guard, message: msg };
	}

	function mbCEVanillaExtState() {
		return {
			crime: mbCEVanillaCrimeStats(),
			antique: mbCEVanillaAntiqueStats(),
			title: mbCEVanillaTitleStats()
		};
	}

	/* 回退：按 id 还原整块快照（vcore 类型由 08c 统一回退中心分发） */
	function mbCEVanillaExtUndo(id) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var key = "vcore:" + id;
		var rec = V.mbCE_wrote && V.mbCE_wrote[key];
		if (!rec || !rec.before || typeof rec.before !== "object") {
			return { ok: false, message: "该留痕已不存在（可能已回退或超出保留窗口）" };
		}
		var b = rec.before;
		try {
			if (b.kind === "crime") {
				if (!V.crime || typeof V.crime !== "object") { return { ok: false, message: "犯罪结构已不在，无法回退" }; }
				var types = mbCEVanillaCrimeTypes();
				types.forEach(function (t) {
					var snap = b.crime ? b.crime[t] : undefined;
					if (!snap) {
						/* 首次写入前该类型不存在 → 回退即删除 */
						try { delete V.crime[t]; } catch (eD) {}
						return;
					}
					var c = V.crime[t];
					if (!c || typeof c !== "object") { c = {}; V.crime[t] = c; }
					c.current = snap.current;
					c.history = snap.history;
					c.daily = snap.daily;
					c.count = snap.count;
					c.countHistory = snap.countHistory;
				});
				V.crime.events = b.events || {};
				delete V.mbCE_wrote[key];
				return { ok: true, message: "已还原犯罪记录（current / history / daily / count / countHistory 与事件日志）" };
			}
			if (b.kind === "antique") {
				var ma = mbCEVanillaAntiqueState();
				if (!ma) { return { ok: false, message: "博物馆结构已不在，无法回退" }; }
				if (b.antiques && typeof b.antiques === "object") {
					Object.keys(ma.antiques).forEach(function (k) {
						ma.antiques[k] = (b.antiques[k] !== undefined) ? b.antiques[k] : "notFound";
					});
				}
				if (ma.paintings && typeof ma.paintings === "object") {
					Object.keys(ma.paintings).forEach(function (k) {
						if (b.paintings && b.paintings[k] !== undefined) { ma.paintings[k] = b.paintings[k]; }
					});
				}
				ma.museumCount = b.museumCount;
				ma.stolenCount = b.stolenCount;
				ma.recoveredCount = b.recoveredCount;
				if (b.maxCount !== undefined) { ma.maxCount = b.maxCount; }
				try { V.museumAntiqueJournalHints = b.hints || []; } catch (eH2) { /* 恢复期刊提示失败 → 提示保持现值（不影响古董与成就还原） */ }
				try {
					if (V.feats && V.feats.currentSave) {
						if (b.hadFeat) {
							if (V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] === undefined) { V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] = new Date(); }
						} else {
							delete V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM];
						}
					}
				} catch (eF2) { /* 成就标记还原失败 → 保留现值（仅成就显示差异，不影响古董数据） */ }
				delete V.mbCE_wrote[key];
				return { ok: true, message: "已还原古董状态与成就标记" };
			}
			if (b.kind === "title") {
				var remy = mbCEVanillaNpcObj(V, "Remy");
				if (!remy) { return { ok: false, message: "Remy 已不在 $NPCName，无法回退" }; }
				remy.title = b.remy;
				var harper2 = mbCEVanillaNpcObj(V, "Harper");
				if (harper2 && b.harper !== undefined) { harper2.title = b.harper; }
				var avery2 = mbCEVanillaNpcObj(V, "Avery");
				if (avery2 && b.avery !== undefined) { avery2.title = b.avery; }
				delete V.mbCE_wrote[key];
				return { ok: true, message: "已还原 Remy 头衔为「" + mbCEVanillaTitleZh(b.remy) + "」" };
			}
			return { ok: false, message: "未知的留痕类型：" + String(b.kind) };
		} catch (eUndo) {
			var eMsg = String(eUndo);
			if (eUndo && typeof eUndo === "object" && "message" in eUndo) { eMsg = String(eUndo.message); }
			return { ok: false, message: "回退异常：" + eMsg };
		}
	}

	function mbCEVanillaHasTrace(id) {
		try {
			var V = getV();
			return !!(V && V.mbCE_wrote && V.mbCE_wrote["vcore:" + id]);
		} catch (e) { return false; }
	}

