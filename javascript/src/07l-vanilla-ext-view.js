/* 职责：全局页 ⑧「原版档案 · 收藏 · 头衔」的统计快照与区块渲染（07l-vanilla-ext.js 的视图层）。
   数据层（清犯罪 / 收古董 / 写头衔 / 回退）在同名主段；本段只读状态、不写存档。
   拆段原因：结构门禁 S1（单段 400 行上限）。 */

	/* 犯罪统计：各类 current / history / countHistory 合计 + 事件日志条数 */
	function mbCEVanillaCrimeStats() {
		var V = getV();
		var out = { ok: false, types: 0, current: 0, history: 0, countHistory: 0, events: 0, has: false };
		if (!V || !V.crime || typeof V.crime !== "object") { return out; }
		out.has = true;
		var types = mbCEVanillaCrimeTypes();
		out.types = types.length;
		types.forEach(function (t) {
			var c = V.crime[t];
			if (!c || typeof c !== "object") { return; }
			out.current += Number(c.current) || 0;
			out.history += Number(c.history) || 0;
			out.countHistory += Number(c.countHistory) || 0;
		});
		try {
			if (V.crime.events && typeof V.crime.events === "object") {
				Object.keys(V.crime.events).forEach(function (k) {
					var arr = V.crime.events[k];
					out.events += Array.isArray(arr) ? arr.length : 0;
				});
			}
		} catch (eEv) {}
		out.ok = true;
		return out;
	}
	function mbCEVanillaAntiqueStats() {
		var V = getV();
		var out = { ok: false, total: 0, found: 0, museum: 0, maxCount: 0, paintings: 0, paintingsFound: 0, feat: false, has: false };
		var ma = mbCEVanillaAntiqueState();
		if (!ma) { return out; }
		out.has = true;
		var keys = Object.keys(ma.antiques);
		out.total = keys.length;
		keys.forEach(function (k) { if (ma.antiques[k] === "found") { out.found++; } });
		out.museum = Number(ma.museumCount) || 0;
		out.maxCount = Number(ma.maxCount) || 0;
		if (ma.paintings && typeof ma.paintings === "object") {
			Object.keys(ma.paintings).forEach(function (k) {
				out.paintings++;
				if (ma.paintings[k] === "found") { out.paintingsFound++; }
			});
		}
		try {
			out.feat = !!(V && V.feats && V.feats.currentSave && V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] !== undefined);
		} catch (eF) {}
		out.ok = true;
		return out;
	}
	function mbCEVanillaTitleStats() {
		var V = getV();
		var out = { ok: false, exists: false, remy: "", remyZh: "", harper: "", avery: "", fate: "" };
		if (!V) { return out; }
		var remy = mbCEVanillaNpcObj(V, "Remy");
		if (!remy) { return out; }
		out.exists = true;
		out.remy = String(remy.title === undefined ? "" : remy.title);
		out.remyZh = mbCEVanillaTitleZh(out.remy);
		var harper = mbCEVanillaNpcObj(V, "Harper");
		var avery = mbCEVanillaNpcObj(V, "Avery");
		out.harper = harper ? String(harper.title === undefined ? "" : harper.title) : "";
		out.avery = avery ? String(avery.title === undefined ? "" : avery.title) : "";
		out.fate = String(V.avery_fate === undefined ? "" : V.avery_fate);
		out.ok = true;
		return out;
	}
	/* 全局页 ⑧ 区块 */
	function mbCERenderVanillaExt(pane) {
		var sec = mceNewSec(pane, 10, "原版档案 · 收藏 · 头衔",
			"朋友三项原版作弊的直写通道：① 犯罪记录连案底一起清；② 博物馆古董一次性收齐（只收集不上交，成就同步解锁）；③ 雷米头衔写「疤面」。全部写入留痕可在「统一回退中心」逐条还原。");
		var V = getV();
		if (!V) {
			sec.appendChild(el("div", MCE_CLS.hint, "游戏尚未就绪，暂不可写。"));
			return;
		}

		function makeBody(groupTitle, subTitle) {
			var g = mceNewGroup(sec, groupTitle, subTitle);
			var body = el("div", "mce-vcore-body");
			g.appendChild(body);
			return body;
		}

		function clearBody(body) {
			while (body.firstChild) { body.removeChild(body.firstChild); }
		}

		function undoBtn(body, id, redraw) {
			if (!mbCEVanillaHasTrace(id)) { return; }
			var ub = el("button", "mce-btn mce-red", "回退");
			ub.type = "button";
			ub.title = "还原到首次写入前状态";
			ub.addEventListener("click", function () {
				var ru = mbCEVanillaExtUndo(id);
				setStatus(ru.message, ru.ok ? MCE_CLS.ok : MCE_CLS.err);
				if (ru.ok) { redraw(); }
			});
			body.appendChild(ub);
		}

		/* ⑧-1 犯罪档案 */
		var cBody = makeBody("犯罪档案", "原版 $crime：10 类 × current / count / daily / history / countHistory + 事件日志（$crime.events）");
		var redrawCrime = function () {
			clearBody(cBody);
			var st = mbCEVanillaCrimeStats();
			if (!st.has) {
				cBody.appendChild(el("div", MCE_CLS.hint, "未找到 $crime（该存档没有犯罪记录结构）。"));
				return;
			}
			cBody.appendChild(el("div", MCE_CLS.hint,
				"当前：现存罪值合计 " + st.current + " · 案底合计 " + st.history + " · 案底次数合计 " + st.countHistory + " · 事件日志 " + st.events + " 条"));
			var grid = mceBtnGrid(cBody);
			var b = el("button", "mce-btn mce-gold", "一键清空全部犯罪记录（含案底）");
			b.type = "button";
			b.title = "current / count / daily / history / countHistory 全归零，事件日志清空";
			b.addEventListener("click", function () {
				var r = mbCEVanillaCrimeClear();
				setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
				if (r.ok) { redrawCrime(); }
			});
			grid.appendChild(b);
			cBody.appendChild(mceFoldHint("原版自己的清犯罪按钮只写 current / count / daily + clearEvents，history 与 countHistory 清不掉——那两项就是警方看到的「案底」。本项补齐后，犯罪界面与案底判定都归零。"));
			undoBtn(cBody, "crime", redrawCrime);
		};
		redrawCrime();

		/* ⑧-2 博物馆收藏 */
		var aBody = makeBody("博物馆收藏", "原版 $museumAntiques：63 件古董 + 2 幅画作；写成「已发现未上交」不结算奖金");
		var redrawAntique = function () {
			clearBody(aBody);
			var st = mbCEVanillaAntiqueStats();
			if (!st.has) {
				aBody.appendChild(el("div", MCE_CLS.hint, "未找到 $museumAntiques（该存档还没进入博物馆线）。"));
				return;
			}
			aBody.appendChild(el("div", MCE_CLS.hint,
				"当前：古董已发现 " + st.found + "/" + st.total + " · 已上交 " + st.museum + "/" + st.maxCount
				+ " · 画作已发现 " + st.paintingsFound + "/" + st.paintings
				+ " · 成就「It Belongs in a Museum」" + (st.feat ? "已解锁" : "未解锁")));
			var grid2 = mceBtnGrid(aBody);
			var b2 = el("button", "mce-btn mce-gold", "一键收齐古董（只收集，不上交）");
			b2.type = "button";
			b2.title = "全部写成 found 态；不动 museumCount、不结算奖金；同时直写「It Belongs in a Museum」成就";
			b2.addEventListener("click", function () {
				var r = mbCEVanillaAntiqueCollect();
				setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
				if (r.ok) { redrawAntique(); }
			});
			grid2.appendChild(b2);

			/* v2.1.2 特殊古董三键：不参与「一键收齐」，各自一个收集键（排在「一键收齐」下面） */
			aBody.appendChild(el("div", MCE_CLS.hint,
				"以下三件特殊古董不参与「一键收齐」，需单独收集：黄金贞操带、象牙项链在原版有剧情牵连"
				+ "（项链一旦写成已发现，原版 L188980 会把 $necklaceThief 判为 player）；"
				+ "「诅咒硬币」在原版 63 件古董里没有对应键（CE 的 changeLog 声明了它，但其白名单里也没有）。"));
			var gridSp = mceBtnGrid(aBody);
			mbCEVanillaAntiqueSpecials().forEach(function (it) {
				var sb;
				if (it.key && it.exists) {
					sb = el("button", MCE_CLS.btn, "收集" + it.label + "（" + it.statusZh + "）");
					sb.type = "button";
					sb.title = it.key === "antiqueivorynecklace"
						? "只把这一件写成「已发现未上交」；若 $necklaceThief 未定义，会同步写为 player（原版 L188980 的等价判定）"
						: "只把这一件写成「已发现未上交」；已上交 / 中间态不改写";
					sb.addEventListener("click", function () {
						var r = mbCEVanillaAntiqueCollectOne(it.key);
						setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
						if (r.ok && r.changed) { redrawAntique(); }
					});
					gridSp.appendChild(sb);
					if (mbCEVanillaHasTrace("antique-" + it.key)) {
						var ubSp = el("button", "mce-btn mce-red", "回退" + it.label);
						ubSp.type = "button";
						ubSp.title = "只还原这一件的收集（与其他件、与一键收齐互不影响）";
						ubSp.addEventListener("click", function () {
							var ru = mbCEVanillaExtUndo("antique-" + it.key);
							setStatus(ru.message, ru.ok ? MCE_CLS.ok : MCE_CLS.err);
							if (ru.ok) { redrawAntique(); }
						});
						gridSp.appendChild(ubSp);
					}
				} else {
					sb = el("button", MCE_CLS.btn, "收集" + it.label + "（原版无此键）");
					sb.type = "button";
					sb.title = "原版 63 件古董里没有「诅咒硬币」对应键；此键只作说明，不写存档";
					sb.addEventListener("click", function () {
						setStatus("「诅咒硬币」在原版 0.5.12.13 的 $museumAntiques.antiques 63 件全集里没有对应键"
							+ "（<<widget \"updateMuseumAntiques\">> L609341-609404），全 HTML 搜 antique*curse* 零命中；"
							+ "CE 1.20.4 的 changeLog 声明排除此项，但其 58 件白名单里也没有对应键。这不是漏做，是该键不存在。", MCE_CLS.err);
					});
					gridSp.appendChild(sb);
				}
			});

			aBody.appendChild(mceFoldHint("写成 found = 已发现未上交：博物馆柜子仍空、不结算金币，之后你愿意上交时再逐件走「上交」流程即可。成就在作弊模式下会被原版 earnFeat 门控拦掉（V.cheatsEnabled === true 直接 return），所以这里直接写进成就表。一键只写「未发现」的件，talk / museum / stolen / recovered 一律不改写。"));
			undoBtn(aBody, "antique", redrawAntique);
		};
		redrawAntique();

		/* ⑧-3 NPC 头衔 */
		var tBody = makeBody("NPC 头衔", "雷米 Remy · 疤面（scarred）；飞升线会连带补 Harper / Avery 防回滚");
		var redrawTitle = function () {
			clearBody(tBody);
			var st = mbCEVanillaTitleStats();
			if (!st.exists) {
				tBody.appendChild(el("div", MCE_CLS.hint, "未找到 Remy（$NPCName 缺少该角色）。"));
				return;
			}
			tBody.appendChild(el("div", MCE_CLS.hint,
				"当前：雷米「" + st.remyZh + "」（" + (st.remy || "空") + "）"
				+ (st.fate ? " · $avery_fate=" + st.fate : "")
				+ (st.harper ? " · Harper「" + mbCEVanillaTitleZh(st.harper) + "」" : "")
				+ (st.avery ? " · Avery「" + mbCEVanillaTitleZh(st.avery) + "」" : "")));
			var grid3 = mceBtnGrid(tBody);
			var b3 = el("button", "mce-btn mce-gold", "雷米头衔 → 疤面");
			b3.type = "button";
			b3.title = "写 C.npc.Remy.title = \"scarred\"；飞升线同时补 Harper=silver fox、Avery=crimson hound";
			b3.addEventListener("click", function () {
				var r = mbCEVanillaRemyScar();
				setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
				if (r.ok) { redrawTitle(); }
			});
			grid3.appendChild(b3);
			tBody.appendChild(mceFoldHint("原版飞升线给 Remy 写 high elk，疤面只在「非飞升」分支。而且那段结算是幂等守卫（Harper 不是银狐狸就重跑），所以只写 Remy 会在下次结算被改回去——本项按需连 Harper / Avery 一起补齐，让守卫条件不成立。"));
			undoBtn(tBody, "title", redrawTitle);
		};
		redrawTitle();
	}
