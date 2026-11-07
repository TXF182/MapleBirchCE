/* 职责：地点页阶段读写 —— placeStageRead / placeStageWrite / placeStageUndo，阶段区与直达区渲染 */
	function placeStageRead(path) {
		try {
			var Vp = getV();
			var parts = String(path || "").split(".");
			var cur = Vp;
			for (var i = 0; i < parts.length; i++) {
				if (cur == null) { return 0; }
				cur = cur[parts[i]];
			}
			var n = Number(cur);
			return Number.isFinite(n) ? Math.round(n) : 0;
		} catch (e) { return 0; }
	}
	/* 地点阶段写入：绕过原版变量黑名单直接写（五面板专用通道），保留 before 留痕可回退。
	   嵌套宿主：仅 town_projects 允许自动建壳（原版事件直接读写各字段）；其余缺失宿主拒绝。 */
	function placeStageWrite(path, target, min, max) {
		try {
			var Vp = getV();
			if (!Vp) { return { ok: false, message: "存档变量不可用" }; }
			var parts = String(path || "").split(".");
			if (!parts.length || !parts[0]) { return { ok: false, message: "路径无效" }; }
			var cur = Vp, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
					if (parts[i] === "town_projects") { cur[parts[i]] = {}; }
					else { return { ok: false, message: "宿主不存在（" + parts.slice(0, i + 1).join(".") + "），请先推进剧情或检查版本" }; }
				}
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			var before = cur[leaf];
			var prev = Vp.mbCE_wrote && Vp.mbCE_wrote["place:" + path];
			/* 留痕语义：before 始终保留「首次写入前」状态（含 undefined=原本无字段）——
			   用 in 判断，避免二次写入把 before 覆盖成当前值，导致回退丢失"删除字段"语义 */
			if (prev && "before" in prev) { before = prev.before; }
			var lo = Number.isFinite(Number(min)) ? Number(min) : 0;
			var hi = Number.isFinite(Number(max)) ? Number(max) : Infinity;
			/* 地点页是阶段/档位语义：钳制到 [lo, hi]（用户澄清：仅"直接填数值"放开上限，阶段保留） */
			var final = Math.max(lo, Math.min(hi, Math.round(Number(target) || 0)));
			cur[leaf] = final;
			if (!Vp.mbCE_wrote || typeof Vp.mbCE_wrote !== "object") { Vp.mbCE_wrote = {}; }
			Vp.mbCE_wrote["place:" + path] = { type: "place", path: path, before: before, after: final, t: Date.now() };
			mbCEWroteTrim(Vp);
			return { ok: true, message: "已写入 " + path + " = " + final, before: before, after: final };
		} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
	}
	/* 地点阶段回退：还原首次写入前状态（before 为 undefined → 删除字段） */
	function placeStageUndo(path) {
		try {
			var Vp = getV();
			if (!Vp || !Vp.mbCE_wrote || !Vp.mbCE_wrote["place:" + path]) { return { ok: false, message: "无该写入留痕（不可回退）" }; }
			var rec = Vp.mbCE_wrote["place:" + path];
			var parts = String(path || "").split(".");
			var cur = Vp, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") { return { ok: false, message: "宿主已被清除，无法回退" }; }
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			if (rec.before === undefined) { delete cur[leaf]; }
			else { cur[leaf] = rec.before; }
			delete Vp.mbCE_wrote["place:" + path];
			return { ok: true, message: "已回退 " + path + " 到写入前状态" };
		} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
	}
	function renderPlacesStage(pane) {
		pane.appendChild(el("div", "mce-hint", "地点阶段任务（原版 $变量 直改，全部留痕可回退）："));
		PLACE_STAGE_GROUPS.forEach(function (g) {
			var block = el("div", "mce-grp");
			var head = el("div", "mce-grp-t", g.name);
			head.title = g.note;
			block.appendChild(head);
			block.appendChild(el("div", "mce-stage-note", g.note));
			g.items.forEach(function (it) {
				var cur = placeStageRead(it.path);
				var row = el("div", "mce-row");
				row.setAttribute("data-stagekey", it.key);
				row.title = it.note + "（当前 " + cur + " / 上限 " + it.max + "；阶段档位，写入钳制在上限内）";
				var lbl = el("span", "mce-row-lbl", it.name + "　");
				var val = el("span", "mce-value", cur + " / " + it.max);
				lbl.appendChild(val);
				row.appendChild(lbl);
				var mDec = el("button", "mce-btn", "−1");
				mDec.type = "button";
				mDec.setAttribute("data-op", "dec");
				mDec.addEventListener("click", function () {
					var r = placeStageWrite(it.path, placeStageRead(it.path) - 1, 0, it.max);
					renderPlaces();
					if (r && r.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(r && r.message ? r.message : "写入失败", "mce-err"); }
				});
				var mInc = el("button", "mce-btn", "+1");
				mInc.type = "button";
				mInc.setAttribute("data-op", "inc");
				mInc.addEventListener("click", function () {
					/* +1 是档位微调：钳到 [0, it.max]（阶段档位语义，防点出不存在档位） */
					var nx = placeStageRead(it.path) + 1;
					if (nx > it.max) { nx = it.max; }
					var rInc = placeStageWrite(it.path, nx, 0, it.max);
					renderPlaces();
					if (rInc && rInc.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(rInc && rInc.message ? rInc.message : "写入失败", "mce-err"); }
				});
				var mMax = el("button", "mce-btn mce-gold", "拉满");
				mMax.type = "button";
				mMax.setAttribute("data-op", "max");
				mMax.addEventListener("click", function () {
					var rMax = placeStageWrite(it.path, it.max, 0, it.max);
					renderPlaces();
					if (rMax && rMax.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(rMax && rMax.message ? rMax.message : "写入失败", "mce-err"); }
				});
				row.appendChild(mDec);
				row.appendChild(mInc);
				row.appendChild(mMax);
				/* 有留痕才显示回退（还原首次写入前状态） */
				try {
					var Vp = getV();
					if (Vp && Vp.mbCE_wrote && Vp.mbCE_wrote["place:" + it.path]) {
						var mUndo = el("button", "mce-btn mce-red", "回退");
						mUndo.type = "button";
						mUndo.setAttribute("data-op", "undo");
						mUndo.addEventListener("click", function () {
							var r = placeStageUndo(it.path);
							renderPlaces();
							setStatus(r.message || "", r.ok ? "mce-ok" : "mce-err");
							if (r && r.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2 */
						});
						row.appendChild(mUndo);
					}
				} catch (e) {}
				block.appendChild(row);
			});
			pane.appendChild(block);
		});
		pane.appendChild(el("div", "mce-hint", "拉满 = 置为原版上限值；「−1/+1」逐步推进；写入记录在 V.mbCE_wrote（place: 前缀）可回退。"));
	}

	function renderPlacesDirect(pane) {
		var groups = listPlaceGroups();
		var total = 0;
		var V = getV();
		var unlocked = (V && V.mbCE_unlockedPlaces && typeof V.mbCE_unlockedPlaces === "object") ? V.mbCE_unlockedPlaces : {};
		groups.forEach(function (entry) {
			var g = entry.group;
			total += entry.items.length;
			var block = el("div", "mce-stage");
			var head = el("div", "mce-stage-head");
			head.appendChild(el("span", "mce-dot", ""));
			head.appendChild(el("span", "mce-stage-name", "■ " + g.name + "　（" + entry.items.length + " 个段落）"));
			block.appendChild(head);
			block.appendChild(el("div", "mce-stage-note", g.note));
			var uc = unlocked[g.id];
			if (uc && uc.startPassage) {
				/* 已解锁（剧情固定触发联动）→ 直接可用 */
				var rowU = el("div", "mce-stage mce-place-row mce-pass");
				var shU = el("div", "mce-stage-head");
				shU.appendChild(el("span", "mce-dot", ""));
				shU.appendChild(el("span", "mce-stage-name", "已解锁 ★ " + g.name + "　（触发「" + (uc.name || uc.key || "") + "」后联动解锁）"));
				var entryHint = (typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS[g.id] && WORLD_UNLOCKS[g.id].entry) ? WORLD_UNLOCKS[g.id].entry : "";
				if (entryHint) { shU.appendChild(el("div", "mce-stage-txt", "世界入口：已在游戏内解锁 → " + entryHint)); }
				var btnU = el("button", "mce-btn mce-gold", "直达");
				btnU.type = "button";
				btnU.title = "跳转到：" + uc.startPassage;
				(function (target) {
					btnU.addEventListener("click", function () { teleportTo(target); });
				})(uc.startPassage);
				shU.appendChild(btnU);
				rowU.appendChild(shU);
				block.appendChild(rowU);
			} else if (entry.items.indexOf(g.main) !== -1) {
				/* 只显示主场景（v1.2 精简：副场景段落不逐条列出） */
				var rowM = el("div", "mce-stage mce-place-row");
				var shM = el("div", "mce-stage-head");
				shM.appendChild(el("span", "mce-dot", ""));
				shM.appendChild(el("span", "mce-stage-name", "主场景　" + g.main + " ★　" + placeNameCN(g.main)));
				var btnM = el("button", "mce-btn mce-gold", "直达");
				btnM.type = "button";
				btnM.title = "跳转到段落：" + g.main;
				(function (target) {
					btnM.addEventListener("click", function () { teleportTo(target); });
				})(g.main);
				shM.appendChild(btnM);
				rowM.appendChild(shM);
				block.appendChild(rowM);
			} else {
				block.appendChild(el("div", "mce-stage-txt", "未匹配到主场景段落（未安装对应 MOD 或版本差异）。"));
			}
			pane.appendChild(block);
		});
		pane.appendChild(el("div", "mce-hint", "共枚举 " + total + " 个可直达段落（已按组精简，仅显示主场景；副场景段落计入统计不逐条列出）。点击「直达」立即跳转，不打断存档。"));
		/* v2.0.3 回退语义补齐：世界入口解锁留痕可见 + 逐项撤回（记录 key = world:<gid>:<path>） */
		var wRows = [];
		if (V && V.mbCE_wrote && typeof V.mbCE_wrote === "object") {
			Object.keys(V.mbCE_wrote).forEach(function (k) {
				if (k.indexOf("world:") !== 0) { return; }
				var rec = V.mbCE_wrote[k];
				if (!rec || !rec.gid) { return; }
				for (var wi = 0; wi < wRows.length; wi++) {
					if (wRows[wi] && wRows[wi].gid === rec.gid) { return; }
				}
				wRows.push({ gid: rec.gid, path: rec.path, before: rec.before, after: rec.after });
			});
		}
		if (wRows.length) {
			var wsec = el("div", "mce-stage");
			var whead = el("div", "mce-stage-head");
			whead.appendChild(el("span", "mce-dot", ""));
			whead.appendChild(el("span", "mce-stage-name", "■ 世界入口解锁记录　（" + wRows.length + " 项，可撤回）"));
			wsec.appendChild(whead);
			wsec.appendChild(el("div", "mce-stage-note", "「直达」会自动把该场景的世界入口条件写进存档（如 Elk Street 的大院入口）。以下为写入留痕；撤回 = 还原到首次写入前状态（原本无该字段则删除）。"));
			wRows.forEach(function (w) {
				var gname = "";
				if (typeof PLACE_GROUPS !== "undefined" && Array.isArray(PLACE_GROUPS)) {
					for (var gi = 0; gi < PLACE_GROUPS.length; gi++) {
						if (PLACE_GROUPS[gi] && PLACE_GROUPS[gi].id === w.gid) { gname = PLACE_GROUPS[gi].name; }
					}
				}
				var entry = (typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS[w.gid] && WORLD_UNLOCKS[w.gid].entry) ? WORLD_UNLOCKS[w.gid].entry : "";
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", (gname || w.gid) + "　" + w.path + "：" + (w.before === undefined ? "（原本无）" : String(w.before)) + " → " + String(w.after) + (entry ? "　（" + entry + "）" : "")));
				var ubtn = el("button", "mce-btn mce-red", "撤回");
				ubtn.type = "button";
				ubtn.setAttribute("data-op", "world-undo");
				(function (gid) {
					ubtn.addEventListener("click", function () {
						var ru = mbCEWorldUndo(gid);
						setStatus(ru.msg, ru.ok ? "mce-ok" : "mce-err");
						if (ru.ok) { renderPlaces(); }
					});
				})(w.gid);
				row.appendChild(ubtn);
				wsec.appendChild(row);
			});
			pane.appendChild(wsec);
		}
	}
	function describeCondition(text, name) {
		try {
			var t = String(text || "");
			var mState = t.match(/"([^"]+)"\s*!==\s*rv\.characters\.npc\.([A-Za-z ]+)\.state/);
			if (mState) { return "角色「" + displayName(mState[2]) + "」当前状态不是「" + (STATE_CN[mState[1]] || mState[1]) + "」（关系未中断）"; }
			var mState2 = t.match(/rv\.characters\.npc\.([A-Za-z ]+)\.state\s*!==\s*"([^"]+)"/);
			if (mState2) { return "角色「" + displayName(mState2[1]) + "」当前状态不是「" + (STATE_CN[mState2[2]] || mState2[2]) + "」（关系未中断）"; }
			var mInc = t.match(/([A-Za-z0-9_]+Seen)\??\.includes\("([^"]+)"\)/);
			if (mInc) {
				var seenLabel = { "ritual_sex": "完成仪式性爱", "yearning": "渴望（收信后）", "partners": "确立恋人关系", "romance": "步入永远关系" }[mInc[2]] || mInc[2];
				return "「" + displayName(name) + "」经历中已记录「" + seenLabel + "」";
			}
			var mBare = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*$/);
			if (mBare) { return TERM_CN[String(mBare[1]).toLowerCase()] ? "已获得/触发「" + TERM_CN[String(mBare[1]).toLowerCase()] + "」" : "变量 " + mBare[1] + " 已为真"; }
			var mEq = t.match(/1\s*===\s*rv\.variables\.([A-Za-z0-9_]+)/);
			if (mEq) { return TERM_CN[String(mEq[1]).toLowerCase()] ? "「" + TERM_CN[String(mEq[1]).toLowerCase()] + "」已成立（=1）" : "变量 " + mEq[1] + " 已置 1"; }
			var mEq2 = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*===\s*1/);
			if (mEq2) { return TERM_CN[String(mEq2[1]).toLowerCase()] ? "「" + TERM_CN[String(mEq2[1]).toLowerCase()] + "」已成立（=1）" : "变量 " + mEq2[1] + " 已置 1"; }
			var mLi = t.match(/rv\.variables\.loveInterest\.includes\("([^"]+)"\)/);
			if (mLi) { return "「" + displayName(mLi[1]) + "」已确立恋人关系（角色出现在恋人槽位）"; }
			var mGe = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*>=\s*(\d+)/);
			if (mGe) { return TERM_CN[String(mGe[1]).toLowerCase()] ? "「" + TERM_CN[String(mGe[1]).toLowerCase()] + "」≥ " + mGe[2] : "变量 " + mGe[1] + " ≥ " + mGe[2]; }
			var mUndef = t.match(/undefined\s*===\s*rv\.variables\.([A-Za-z0-9_]+)/);
			if (mUndef) { return TERM_CN[String(mUndef[1]).toLowerCase()] ? "「" + TERM_CN[String(mUndef[1]).toLowerCase()] + "」未触发（事件未开始）" : "变量 " + mUndef[1] + " 未触发"; }
			return "";
		} catch (e) { return ""; }
	}

