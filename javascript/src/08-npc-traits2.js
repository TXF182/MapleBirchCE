/* 职责：全局页渲染（renderGlobal）—— 批量操作 / 世界数值 / 原版态度 / 庄园维护等分组 */
	function renderGlobal() {
		var pane = root.querySelector('[data-pane="global"]');
		pane.textContent = "";
		if (!frameworkReady()) {
			pane.appendChild(el("div", "mce-err", "未检测到 Maplebirch 框架。"));
			return;
		}
		/* v2.1.0 外观主题四档选择器：全局页第一块（在悬浮球锁定等业务分组之前）——
		   换肤是玩家最想先做的动作，埋在中间要滚半天。 */
		mceRenderThemePicker(pane);
		/* v1.9.11+：悬浮入口固定按钮（锁定/解锁右下角金色「解锁」球的拖动；
		   悬浮球是面板唯一入口，不提供隐藏——隐藏即死锁） */
		var fabLocked = !!(toggleBtn && toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1");
		var fabWrap = el("div", "mce-row");
		var fabBtn = el("button", "mce-btn", fabLocked ? "解锁悬浮球拖动" : "锁定悬浮球拖动");
		fabBtn.type = "button";
		fabBtn.title = fabLocked
			? "悬浮球拖动已锁定（点击仍可开关面板）；点此解锁后可再次拖动"
			: "点此锁定悬浮球拖动（固定不动，不再误拖/挡操作）；点击悬浮球本身仍可开关面板";
		fabBtn.addEventListener("click", function () {
			if (!toggleBtn) { return; }
			var nowLocked = !!(toggleBtn.dataset && toggleBtn.dataset.mceLocked === "1");
			toggleBtn.dataset.mceLocked = nowLocked ? "0" : "1";
			toggleBtn.title = nowLocked
				? "Maplebirch CE 剧情条件解锁面板（可拖动：按住移到任意位置，位置自动记忆）"
				: "Maplebirch CE 剧情条件解锁面板（拖动已锁定：点击开关面板，到「全局」页解锁拖动）";
			try {
				if (typeof localStorage !== "undefined" && localStorage) {
					localStorage.setItem("mbCE_toggle_lock_v1", nowLocked ? "0" : "1");
				}
			} catch (e) { /* 拖动锁持久化失败（隐私模式/配额满）→ 锁定状态本次会话仍生效，仅刷新后丢失 */ }
			renderGlobal();
		});
		fabWrap.appendChild(fabBtn);
		/* v2.0.2 按键重排：原先"悬浮球行 + 一句提示 + 6 个金色按钮裸堆"占了整屏第一屏、且按钮语义混杂；
		   现在把面板设置收进不编号的分组，批量按钮按「速成 / 收集」拆两块并走 2 列网格。 */
		var fabGroup = mceNewGroup(pane, "面板设置", "悬浮入口 · 不占区块编号");
		fabGroup.appendChild(el("div", "mce-row-lbl", "面板悬浮入口（右下角金色「解锁」球）"));
		fabGroup.appendChild(fabWrap);
		var chars = listCharacters();
		fabGroup.appendChild(el("div", "mce-hint", "自动枚举角色 " + chars.length + " 个（本体 + 全部 MOD）。以下操作对全部角色生效。"));

		/* ① 批量速成（全角色） */
		var bsec = mceNewSec(pane, 1, "批量速成（全角色）", "对枚举到的全部角色（本体 + 全部 MOD）一次性补齐：数值 / 恋爱阶段 / 转化阶段 / 玩家扩展转化。扩展转化在 MOD 未加载时自动跳过并给出提示，不会报错。");
		var bgrid = mceBtnGrid(bsec);
		var b1 = el("button", "mce-btn mce-gold", "全部角色：一键补齐全部数值");
		b1.type = "button";
		b1.addEventListener("click", function () {
			var r = globalFill();
			setStatus("已补齐 " + r.characters + " 个角色共 " + r.stats + " 项数值", "mce-ok");
		});
		var b2 = el("button", "mce-btn mce-gold", "全部角色：一键解锁全部恋爱阶段");
		b2.type = "button";
		b2.addEventListener("click", function () {
			var r = globalRomance();
			setStatus("恋爱阶段：" + r.fixed + " / " + r.total + " 已自动解锁", r.fixed > 0 ? "mce-ok" : "mce-err");
		});
		var b3 = el("button", "mce-btn mce-gold", "全部角色：一键解锁全部转化阶段");
		b3.type = "button";
		b3.addEventListener("click", function () {
			var r = globalTransform();
			setStatus("已解锁 " + r.characters + " 个角色的 " + r.stages + " 个转化类型", "mce-ok");
		});
		var b4 = el("button", "mce-btn mce-gold", "一键完成玩家扩展转化（兔子/人鱼等）");
		b4.type = "button";
		b4.addEventListener("click", function () {
			var n = 0;
			listExtTransforms().forEach(function (k) { if (completeExtTransform(k)) { n += 1; } });
			setStatus(n > 0 ? "扩展转化已全部解锁（" + n + " 项）" : "未检测到扩展转化（MOD 未加载）", n > 0 ? "mce-ok" : "mce-err");
		});
		bgrid.appendChild(b1);
		bgrid.appendChild(b2);
		bgrid.appendChild(b3);
		bgrid.appendChild(b4);

		/* ② 收集解锁 */
		var csec = mceNewSec(pane, 2, "收集解锁", "特殊服装（含对应故事）与食谱按原版解锁条件直写；未解锁项数量随 MOD 变化，点击后状态栏会报实际解锁件数。");
		var cgrid = mceBtnGrid(csec);
		var bc1 = el("button", "mce-btn mce-gold", "一键解锁所有特殊服装（含对应故事）");
		bc1.type = "button";
		bc1.addEventListener("click", function () {
			var r = globalUnlockClothes();
			setStatus("特殊服装：" + r.unlocked + " 件已解锁" + (r.stories > 0 ? "（补足对应故事 " + r.stories + " 项）" : ""), r.unlocked > 0 ? "mce-ok" : "mce-err");
		});
		var bc2 = el("button", "mce-btn mce-gold", "一键解锁所有食谱");
		bc2.type = "button";
		bc2.addEventListener("click", function () {
			var r = globalUnlockRecipes();
			setStatus("食谱：" + r.unlocked + " 个已解锁", r.unlocked > 0 ? "mce-ok" : "mce-err");
		});
		cgrid.appendChild(bc1);
		cgrid.appendChild(bc2);

		/* v1.9.13 时间调节区：快进即时生效，跳时段把时分设到指定点（日期/星期由引擎联动） */
		var tsec = mceNewSec(pane, 3, "时间调节", "直接改游戏时钟、即时生效、不进留痕；快进按钮即时前进，跳时段按钮把时分设到指定点（日期 / 星期由引擎联动）。");
		var tnow = mcTimeNow();
		var tInfo = tnow
			? ("当前 " + tnow.hour + ":" + (tnow.minute < 10 ? "0" : "") + tnow.minute + (tnow.weekDay ? " · 周" + tnow.weekDay : ""))
			: "时间系统不可用（需在游戏内运行）";
		tsec.appendChild(mceFoldHint(tInfo + "；快进按钮即时前进，跳时段按钮把时分设到指定点。直接改全局时钟、不进留痕。"));
		var tAdv = mceBtnGrid(tsec);
		[{ n: "+1 小时", v: 60 }, { n: "+3 小时", v: 180 }, { n: "+8 小时", v: 480 }, { n: "+1 天", v: 1440 }, { n: "+3 天", v: 4320 }].forEach(function (d) {
			var b = el("button", "mce-btn mce-gold", d.n); b.type = "button";
			b.addEventListener("click", function () {
				var r = mcTimeAdvance(d.v);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			tAdv.appendChild(b);
		});
		tsec.appendChild(tAdv);
		var tJump = mceBtnGrid(tsec);
		[{ n: "早 8:00", h: 8, m: 0 }, { n: "午 12:00", h: 12, m: 0 }, { n: "傍晚 18:00", h: 18, m: 0 }, { n: "夜 22:00", h: 22, m: 0 }, { n: "深 2:00", h: 2, m: 0 }].forEach(function (d) {
			var b = el("button", "mce-btn", d.n); b.type = "button";
			b.addEventListener("click", function () {
				var r = mcTimeJump(d.h, d.m);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			tJump.appendChild(b);
		});
		tsec.appendChild(tJump);
		/* v1.5.0：誓言修复 + NPC 特质获取（游戏「特质」页对应分组） */
		var vsec = mceNewSec(pane, 4, "誓言修复 · NPC 特质", "誓言修复把神殿誓言（Temple Vow）与相关承诺状态按原版语义还原；NPC 特质获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。「艾弗里的救星」支持两条线：原版线（高塔转烧毁）与庇护模式（不碰 avery_fate、保留大楼建造进度），且均可撤回。");
		var vst = getVowStatus();
		var vowTxt = "神殿誓言（Temple Vow）：" + (vst.temple === true ? "未破" : "已破（" + (vst.temple === false ? "未知" : String(vst.temple)) + "）");
		if (vst.templePromised) { vowTxt += "；承诺对象：" + vst.templePromised; }
		if (vst.templeRank) { vowTxt += "；神殿等级：" + vst.templeRank; }
		var vrow = el("div", "mce-row");
		vrow.appendChild(el("span", "mce-row-lbl", vowTxt));
		var vbtn = el("button", "mce-btn mce-gold", "一键修复誓言");
		vbtn.type = "button";
		vbtn.addEventListener("click", function () {
			var r = fixVows();
			setStatus(r.message, "mce-ok");
			renderGlobal();
		});
		vrow.appendChild(vbtn);
		vsec.appendChild(vrow);
		var traits = listNpcTraits();
		vsec.appendChild(mceFoldHint("NPC 特质 " + traits.length + " 项：获取时若不满足条件，直接把条件改为满足（游戏「特质」页立即显示）。「艾弗里的救星」支持庇护模式与撤回。"));
		var tbox = el("div", "");
		traits.forEach(function (t) {
			if (t.key === "avery_saviour") {
				/* v1.9.2：救星特质双模式 + 撤回（庇护模式不碰 avery_fate，大楼保留） */
				var v2 = getV();
				var shelterOn = v2.mceAveryShelter === true;
				var row = el("div", "mce-row");
				row.appendChild(el("span", "mce-row-lbl", (t.owned ? "✓ " : "") + t.name + "（" + t.en + "）——" + t.desc + (shelterOn ? "　【庇护模式生效中：大楼保留建造进度】" : (t.owned ? "　【原版线：高塔烧毁】" : ""))));
				if (t.owned) {
					var rbtn = el("button", "mce-btn mce-red", "撤回（恢复操作前状态）");
					rbtn.type = "button";
					rbtn.title = "移除救星标记/庇护标记，并按操作前快照还原 avery_fate，大楼/高塔恢复原状";
					(function (t2) {
						rbtn.addEventListener("click", function () {
							var r = revertNpcTrait(t2.key);
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(rbtn);
				} else {
					var b1 = el("button", "mce-btn mce-gold", "获取（原版线）");
					b1.type = "button";
					b1.title = "avery_fate = saved，高塔转烧毁态（原版 Save Avery 结局线）";
					(function (t2) {
						b1.addEventListener("click", function () {
							var r = grantNpcTrait(t2.key, "saved");
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(b1);
					var b2 = el("button", "mce-btn mce-gold", "获取（庇护模式）");
					b2.type = "button";
					b2.title = "不碰 avery_fate，保留大楼/高塔建造进度，只获得救星效果（不走救星结局线）";
					(function (t2) {
						b2.addEventListener("click", function () {
							var r = grantNpcTrait(t2.key, "shelter");
							setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
							renderGlobal();
						});
					})(t);
					row.appendChild(b2);
				}
				tbox.appendChild(row);
				return;
			}
			/* v2.0.12 自查：avery_saviour 分支（上文 L146）已在同一 forEach 回调内 var row，
			   此处再 var 属重复声明（ESLint no-redeclare）；var 不受块作用域约束，改用赋值复用。 */
			row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", (t.owned ? "✓ " : "") + t.name + "（" + t.en + "）——" + t.desc));
			var btn = el("button", "mce-btn" + (t.owned ? "" : " mce-gold"), t.owned ? "已拥有" : "获取");
			btn.type = "button";
			btn.disabled = t.owned;
			btn.addEventListener("click", function () {
				var r = grantNpcTrait(t.key);
				setStatus(r.ok ? r.message : r.message, r.ok ? "mce-ok" : "mce-err");
				renderGlobal();
			});
			row.appendChild(btn);
			tbox.appendChild(row);
		});
		vsec.appendChild(tbox);

		/* v1.8.8：战斗终结（学 CombatTerminator 0.1：8 个战斗内一键按钮，直接写原版战斗值）。
		   原模组为 TweeReplacer 注入到战斗 widget；此处为 MCE 全局页即时按钮，等价写入。
		    v1.8.9：动作定义下沉至 03-global.js（COMBAT_ACTIONS/mcCombatAction），UI 只负责渲染。 */
		var btsec = mceNewSec(pane, 5, "战斗终结", "学 CombatTerminator 0.1：以下按钮直接写原版战斗值，建议战斗中生效；「结束集群」在战斗外会把游戏时钟拨回当日 0 点，请勿误点。");
		COMBAT_ACTIONS.forEach(function (d) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", d.desc));
			var btn = el("button", "mce-btn mce-gold", d.name);
			btn.type = "button";
			btn.addEventListener("click", function () {
				var r = mcCombatAction(d.key);
				setStatus(r.ok ? "已执行「" + r.name + "」" : r.message, r.ok ? "mce-ok" : "mce-err");
			});
			row.appendChild(btn);
			btsec.appendChild(row);
		});

		/* v1.8.8：庄园自动维护（学 AutoClean 0.1.5）
		   v1.9.x：一键按钮 → 自动开关。点击开关切换开启/关闭；开启即立即执行一次（即时生效），
		   此后每日（Time.days 变化）由 mbCEOnPassageInit 自动执行。开关持久化 localStorage
		   （mbCE_auto），不写 V → 不污染存档、新档不继承。 */
		var acsec = mceNewSec(pane, 6, "庄园自动维护", "学 AutoClean 0.1.5：每个开关独立，点击即切换开/关并立即执行一次（即时生效），此后每日（Time.days 变化）自动执行。开关状态持久化在 localStorage（mbCE_auto），不写存档、新档不继承。艾弗里未达喂食阶段（关系未确立）时投喂自动跳过。");
		var acItems = [
			{ key: "feed", name: "自动投喂艾弗里", desc: "按喜好 → 牛排/舒芙蕾/扁意面 → 最高难度菜谱；未达喂食阶段（关系未确立）不操作" },
			{ key: "farm", name: "自动农场维护", desc: "塔卫在岗且技能≥1000 锁四畜 30 / 清 agro；库存收获为食物并清零（cream 仅清理）" },
			{ key: "temple", name: "自动神殿维护", desc: "housekeeping≥1000 时宿舍=100，tending≥1000 时花园=100（原版顶层技能判定）" },
			{ key: "eden", name: "自动伊甸维护", desc: "伊甸菜地/菇桶/泉水锁 4" },
			{ key: "restock", name: "自动补给", desc: "肥皂/药膏不足 10 时补 10；鹰塔火坑≥3 且木材不足 10 时补 10" },
			{ key: "clean", name: "自动庄园打扫", desc: "艾弗里关系确立后：全部房间计数归零 + days_absent 归零" }
		];
		acItems.forEach(function (it) {
			var row = el("div", "mce-row");
			row.appendChild(el("span", "mce-row-lbl", it.desc));
			var btn = el("button", "mce-btn mce-gold", it.name + "（关）");
			btn.type = "button";
			var refresh = function () {
				btn.textContent = it.name + (mcAutoIsOn(it.key) ? "（开）" : "（关）");
			};
			btn.addEventListener("click", function () {
				var on = !mcAutoIsOn(it.key);
				mcAutoSet(it.key, on);
				if (on) {
					var r = /** @type {any} */ (mcAutoRunOnce(it.key));
					var msg;
					if (r.error) { msg = it.name + "执行失败：" + r.error; }
					else if (r.skipped) { msg = it.name + "已开启（本次跳过：艾弗里关系未确立）"; }
					else if (it.key === "feed") { msg = r.missed ? it.name + "已开启，本次无菜可喂（dinner_missed+1）" : it.name + "已开启，本次已喂食：" + r.fed; }
					else if (it.key === "farm") { msg = it.name + "已开启，本次锁满 " + r.beasts + " 只、收获 " + r.harvested + " 类库存"; }
					else if (it.key === "temple") { msg = it.name + "已开启，本次宿舍" + (r.quarters ? "=100" : "未达标跳过") + "、花园" + (r.garden ? "=100" : "未达标跳过"); }
					else if (it.key === "eden") { msg = it.name + "已开启，本次锁定 " + r.locked + " 项为 4"; }
					else if (it.key === "restock") { msg = it.name + "已开启，本次肥皂" + (r.soap ? "=10" : "跳过") + "、药膏" + (r.salve ? "=10" : "跳过") + "、鹰塔木材" + (r.wood ? "=10" : "跳过"); }
					else { msg = it.name + "已开启，本次执行完成"; }
					setStatus(msg, r.error ? "mce-err" : "mce-ok");
				} else {
					setStatus(it.name + "已关闭", "mce-err");
				}
				refresh();
			});
			refresh();
			row.appendChild(btn);
			acsec.appendChild(row);
		});

		/* v2.0.3 回退语义补齐：维护写入留痕可见 + 一键回退（key = maint:<点号路径>，
	   before 保留「首次写入前」状态；写入前无该字段 → 回退即删除）。
	   只覆盖纯数值覆盖型维护（神殿/伊甸/补给/农场锁值/庄园打扫）；投喂与农场收获属状态机推进，不回退。 */
		var mtKeys = [];
		(function () {
			var Vt = getV();
			if (Vt && Vt.mbCE_wrote && typeof Vt.mbCE_wrote === "object") {
				Object.keys(Vt.mbCE_wrote).forEach(function (k) { if (k.indexOf("maint:") === 0) { mtKeys.push(k.slice(6)); } });
			}
		})();
		var mtRow = el("div", "mce-row");
		var mtLbl = el("span", "mce-row-lbl", mtKeys.length
			? ("已记录 " + mtKeys.length + " 项维护写入：" + mtKeys.slice(0, 6).join(" / ") + (mtKeys.length > 6 ? " …" : ""))
			: "暂无维护写入记录（开启任一维护项并实际改动数值后，在此显示并可回退）");
		mtRow.appendChild(mtLbl);
		if (mtKeys.length) {
			var mtUndoAll = el("button", "mce-btn mce-red", "撤回全部维护写入");
			mtUndoAll.type = "button";
			mtUndoAll.setAttribute("data-op", "maint-undo-all");
			mtUndoAll.title = "每项还原到维护写入前状态（写入前无该字段的直接删除）";
			mtUndoAll.addEventListener("click", function () {
				var ru = mbCEMaintUndoAll();
				setStatus(ru.msg, ru.ok ? "mce-ok" : "mce-err");
				if (ru.ok) { mtLbl.textContent = "已回退 " + ru.n + " 项维护写入（记录已清除）"; }
			});
			mtRow.appendChild(mtUndoAll);
		}
		acsec.appendChild(mtRow);

		/* v1.9.12：世界腐化（原版 World Corruption）数值调整
		   原版键：V.world_corruption_hard（世界硬腐化，罪孽/净化计数，原版宏 worldCorruption("hard",n) 钳 -30~30，初始 2）
		          V.world_corruption_soft（世界软腐化，世界异变程度，原版宏钳 0~100，初始 0）
		   语义（原版宏）：soft ≥30 增加怨灵聚合几率，≥70 触发校园衣物记忆；hard 负值走净化，净化量累计 world_corruption_reduced。
		   CE 直写 V 不经过原版 clamp：上限不钳制（数值填多少就是多少，原版事件驱动由游戏自身负责）；
		   下限按原版语义保留（hard ≥ -30，soft ≥ 0），防负值破坏。复用 placeStageWrite/placeStageUndo（原版顶层键直写 + 留痕回退）。 */
		var wcsec = mceNewSec(pane, 7, "世界腐化", "世界硬腐化 world_corruption_hard（罪孽/净化计数，原版 -30~30 初始 2）；世界软腐化 world_corruption_soft（世界异变程度，原版 0~100 初始 0，≥30 增加怨灵聚合几率、≥70 触发校园衣物记忆）。直接填数值：上限不钳制，下限按原版语义保留；净化总量记录于 world_corruption_reduced。");
		var Vg = getV();
		var makeWcUndo = function (row, it, val, inp) {
			var ub = el("button", "mce-btn mce-red", "回退");
			ub.type = "button";
			ub.title = "还原到首次写入前状态（写入前无该字段时直接删除）";
			ub.setAttribute("data-op", "wc-undo");
			ub.addEventListener("click", function () {
				var ru = placeStageUndo(it.key);
				setStatus(ru.message, ru.ok ? "mce-ok" : "mce-err");
				if (ru.ok) {
					var back = Number(getV() && getV()[it.key]) || 0;
					val.textContent = String(back);
					inp.value = String(back);
					var bb = row.querySelector('[data-op="wc-undo"]');
					if (bb && bb.parentNode) { bb.parentNode.removeChild(bb); }
				}
			});
			return ub;
		};
		[
			{ key: "world_corruption_hard", name: "世界硬腐化", min: -30 },
			{ key: "world_corruption_soft", name: "世界软腐化", min: 0 }
		].forEach(function (it) {
			var row = el("div", "mce-row");
			row.setAttribute("data-wckey", it.key);
			var cur = Number(Vg && Vg[it.key]) || 0;
			var lbl = el("span", "mce-row-lbl", it.name + "（" + it.key + "）当前 ");
			var val = el("span", "mce-value", String(cur));
			lbl.appendChild(val);
			row.appendChild(lbl);
			var inp = el("input", "mce-inp");
			inp.type = "number";
			inp.value = String(cur);
			inp.placeholder = String(cur);
			row.appendChild(inp);
			var apply = el("button", "mce-btn mce-gold", "应用");
			apply.type = "button";
			apply.addEventListener("click", function () {
				var r = placeStageWrite(it.key, Number(inp.value), it.min, Infinity);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				if (r.ok) {
					val.textContent = String(r.after);
					inp.value = String(r.after);
					if (!row.querySelector('[data-op="wc-undo"]')) {
						row.appendChild(makeWcUndo(row, it, val, inp));
					}
				}
			});
			row.appendChild(apply);
			/* 已有写入留痕 → 初始即显示回退 */
			try {
				if (Vg && Vg.mbCE_wrote && Vg.mbCE_wrote["place:" + it.key]) {
					row.appendChild(makeWcUndo(row, it, val, inp));
				}
			} catch (e) {}
			wcsec.appendChild(row);
		});

		/* v2.0.9 需求②③④：原版档案 · 收藏 · 头衔（07l-vanilla-ext.js）
		   犯罪连案底一起清 / 古董只收集 + 成就 / 雷米疤面头衔 —— 三项各走独立 vcore 留痕，可在回退中心逐条还原 */
		mbCERenderVanillaExt(pane);

		/* v1.9.15 数值固定（07f-lock.js）：预设推荐 + 自定义 varPath 锁定向，1s 强制写回 */
		mbCERenderLock(pane);
		/* v2.0.0.002 潜伏者（07f-lurker.js）：捕捉上限等价解除 + 水烟馆冰箱（0–5）+ 农场蒸馏笼 */
		mbCERenderLurker(pane);
		/* v2.0.0.003 需求②：原版「你对什么感到不安?」直写（$uncomfortable，绕开 attitudesControl 重算门控） */
		renderAttitudesGroup(pane);
		/* v2.0.3 P4-1：统一回退中心（08c-undo-center.js）——收敛全部留痕回退入口 */
		mbCEUndoCenterRender(pane);
	}
