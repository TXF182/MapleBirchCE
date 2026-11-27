/* 职责：全局页 ⑪「经济 · 学业 · 农田 · 消耗品 · 身体涂鸦」区块渲染（07m-vanilla-econ-data.js 的视图层；
   涂鸦视图拆到 07m-vanilla-econ-bw-view.js）。
   设计约束（用户明确要求）：界面全中文、不出现裸键名；枚举项（科目 / 地块 / 身体部位）一律用下拉选择，
   数值项用输入框 + 「写入」按钮。所有写入留痕，区块内每个可回退动作都带「回退」按钮。
   排版口径：分组标题短、状态行成对（标签 + 数值）、按钮动词开头、长说明收进折叠提示；
   拆段原因：结构门禁 S1 单段 400 行；另按 lint 棘轮把五个分组各拆成独立函数（单函数 ≤120 行 / 复杂度 ≤10）。 */

	/* 二级分组：直接用 mceNewGroup 的 body 容器（不再套空 div，间距/边框由 .mce-group 统一） */
	function mbCEVanillaEconUiBody(sec, title, sub) { return mceNewGroup(sec, title, sub); }
	function mbCEVanillaEconUiClear(body) {
		while (body.firstChild) { body.removeChild(body.firstChild); }
	}
	/* 状态行：标签 + 数值成对排布（复用 .mce-statrow / .mce-label / .mce-value，与其他分区同一排版） */
	function mbCEVanillaEconUiKv(body, pairs) {
		var row = el("div", "mce-statrow");
		pairs.forEach(function (p, i) {
			if (i) { row.appendChild(el("span", "mce-kv-sep", "｜")); }
			row.appendChild(el("span", "mce-label", p[0]));
			row.appendChild(el("span", "mce-value", p[1]));
		});
		body.appendChild(row);
	}
	function mbCEVanillaEconUiNumRow(parent, labelText, tip, initial) {
		var row = el("div", MCE_CLS.row);
		var lbl = el("span", MCE_CLS.rowLbl, labelText);
		lbl.title = tip || labelText;
		row.appendChild(lbl);
		var inp = el("input", MCE_CLS.inp);
		inp.type = "number";
		inp.inputmode = "numeric";
		inp.min = "0";
		inp.value = initial === undefined || initial === null ? "" : String(initial);
		inp.title = tip || labelText;
		row.appendChild(inp);
		parent.appendChild(row);
		return inp;
	}
	function mbCEVanillaEconUiSelect(parent, labelText, pairs, tip) {
		var row = el("div", MCE_CLS.row);
		var lbl = el("span", MCE_CLS.rowLbl, labelText);
		lbl.title = tip || labelText;
		row.appendChild(lbl);
		var sel = el("select", "mce-sel");
		pairs.forEach(function (p) {
			var op = el("option", "", p[1]);
			op.value = String(p[0]);
			sel.appendChild(op);
		});
		row.appendChild(sel);
		parent.appendChild(row);
		return sel;
	}
	/* v2.2.0 分组下拉（optgroup）：纹身样式按原版刺青店四组呈现；groups = [{grp, items:[[value, 中文]]}] */
	function mbCEVanillaEconUiSelectGrouped(parent, labelText, groups, tip) {
		var row = el("div", MCE_CLS.row);
		var lbl = el("span", MCE_CLS.rowLbl, labelText);
		lbl.title = tip || labelText;
		row.appendChild(lbl);
		var sel = el("select", "mce-sel");
		groups.forEach(function (g) {
			var og = el("optgroup");
			og.label = g.grp;
			g.items.forEach(function (p) {
				var op = el("option", "", p[1]);
				op.value = String(p[0]);
				og.appendChild(op);
			});
			sel.appendChild(og);
		});
		row.appendChild(sel);
		parent.appendChild(row);
		return sel;
	}
	function mbCEVanillaEconUiBtn(grid, text, tip, fn) {
		var b = el("button", MCE_CLS.btn, text);
		b.type = "button";
		if (tip) { b.title = tip; }
		b.addEventListener("click", fn);
		grid.appendChild(b);
		return b;
	}
	/* 写入结果统一落地：成功则刷新本组，失败只留状态条 */
	function mbCEVanillaEconUiRun(res, redraw) {
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		if (res.ok) { redraw(); }
	}
	/* 回退按钮：只在有留痕时出现，多条并列成网格（避免一条一大块把分组拉长） */
	function mbCEVanillaEconUiUndoGrid(body, redraw, items) {
		var alive = items.filter(function (it) { return mbCEVanillaHasTrace(it[0]); });
		if (!alive.length) { return; }
		var g = mceBtnGrid(body);
		alive.forEach(function (it) {
			var ub = el("button", "mce-btn mce-red", it[1]);
			ub.type = "button";
			ub.title = "还原到首次写入前的状态";
			ub.addEventListener("click", function () {
				var ru = mbCEVanillaExtUndo(it[0]);
				setStatus(ru.message, ru.ok ? MCE_CLS.ok : MCE_CLS.err);
				if (ru.ok) { redraw(); }
			});
			g.appendChild(ub);
		});
	}

	/* ---------- ⑪-1 房租与欠租 ---------- */
	function mbCEVanillaEconSecRent(sec) {
		var body = mbCEVanillaEconUiBody(sec, "房租与欠租", "租期倒计时 · 欠租金额");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			if (!st.rent.has) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没进入租房线，暂无房租数据。"));
				return;
			}
			var lock = mbCEVanillaEconRentLockRaw();
			mbCEVanillaEconUiKv(body, [
				["距下次催租", st.rent.renttime + " 天"],
				["欠租", mbCEVanillaEconFmt(st.rent.debt)],
				["每周租金", mbCEVanillaEconFmt(st.rent.rentmoney) + (st.rent.babyRent ? "（婴儿 " + mbCEVanillaEconFmt(st.rent.babyRent) + "）" : "")],
				["租金锁定", lock ? "已锁定 " + mbCEVanillaEconFmt(lock.money) : "未锁定"]
			]);
			var daysInp = mbCEVanillaEconUiNumRow(body, "租期天数", "0 = 今天已交，7 天内不催租；数值越小越早被催", st.rent.renttime);
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "写入租期", "把倒计时写成上方数值（0–365）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentDays(daysInp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "设为今天已交", "等价租期 0：今天收过租，接下来 7 天不计欠", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentDays(0), redraw);
			});
			var debtInp = mbCEVanillaEconUiNumRow(body, "欠租金额（£）", "只改实际欠款，统计页历史累计不动", st.rent.debt / 100);
			var g2 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g2, "写入欠租", "把欠租写成上方数值（£ 输入，内部存便士）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentDebt(debtInp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g2, "清空欠租", "欠款归 0，Bailey 不再追这笔钱", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconClearDebt(), redraw);
			});
			var rentInp = mbCEVanillaEconUiNumRow(body, "每周租金（£）", "按英镑输入（可带两位小数），内部按便士存 rentmoney", st.rent.rentmoney / 100);
			var g3 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g3, "写入每周租金", "覆盖原版周租；原版在初始化与每次交租时都会按倍率重算，建议配合锁定", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentMoney(rentInp.value), redraw);
			});
			if (lock) {
				mbCEVanillaEconUiBtn(g3, "解除租金锁定", "恢复正常重算（下次初始化 / 交租按档位与倍率重算）", function () {
					mbCEVanillaEconUiRun(mbCEVanillaEconRentLockOff(), redraw);
				});
			} else {
				mbCEVanillaEconUiBtn(g3, "锁定当前金额", "每次进入段落检查一次，被重算改写就写回锁值", function () {
					mbCEVanillaEconUiRun(mbCEVanillaEconRentLockOn(), redraw);
				});
			}
			body.appendChild(mceFoldHint("原版金额一律按便士存：£1 = 100 便士，档位表 £100 / £300 / £500 / £700 / £1000 / £1500 / £2000。"
				+ "锁定只纠正被重算改写的值；若开着租金倍率或替 Robin 代付，交租瞬间仍会乘一次，写入与锁定时都会有提示。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["rent-days", "回退租期"], ["rent-debt", "回退欠租"], ["rent-money", "回退周租"], ["rent-lock", "回退租金锁"]]);
		};
		redraw();
	}

	/* ---------- ⑪-2 学校出勤 ---------- */
	function mbCEVanillaEconSecSchool(sec) {
		var body = mbCEVanillaEconUiBody(sec, "学校出勤", "六科出勤位 · 旷课计数");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			if (!st.school.has) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没生成今日出勤表，先正常上一天学再回来。"));
				return;
			}
			mbCEVanillaEconUiKv(body, [["今日出勤", st.school.attendedCount + "/6 科"], ["旷课累计", st.school.missedTotal + " 次"]]);
			var sList = MCE_ECON_SUBJECTS.map(function (s) {
				return s.zh + " " + (st.school.attended[s.key] ? "已出勤" : "未出勤") + " · 旷课 " + (st.school.missed[s.key] || 0);
			}).join("｜");
			body.appendChild(el("div", MCE_CLS.hint, sList));
			var pairs = MCE_ECON_SUBJECTS.map(function (s) { return [s.key, s.zh]; });
			var sel = mbCEVanillaEconUiSelect(body, "科目", pairs, "六科对应原版今日出勤表的同名科目");
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "设为出勤", "所选科目记为今天已上（不会加旷课）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconAttend(sel.value, 1), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "设为缺席", "所选科目记为今天没上（旷课由原版结算累加）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconAttend(sel.value, 0), redraw);
			});
			var g2 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g2, "今日六科全出勤", "六科一次写满（不动旷课计数）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconAttendAll(1), redraw);
			});
			mbCEVanillaEconUiBtn(g2, "旷课次数清零", "六科旷课全部归 0（学校警告线立即回落）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconMissedClear(), redraw);
			});
			body.appendChild(mceFoldHint("出勤位每天重置，旷课计数不清。原版在结算时按「今天有没有记录出勤」补旷课，"
				+ "所以设为缺席若正好踩在结算点，会由原版补一次；要压学校警告，直接点「旷课次数清零」。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["school", "回退出勤"]]);
		};
		redraw();
	}

	/* ---------- ⑪-3 农场地块 ---------- */
	function mbCEVanillaEconSecFarm(sec) {
		var body = mbCEVanillaEconUiBody(sec, "农田催熟", "按地点选块 · 成熟即可收获");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			if (!st.farm.has || !st.farm.locations.length) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没有农场地块（或地块为空）。"));
				return;
			}
			var sum = { total: 0, planted: 0, ripe: 0 };
			st.farm.locations.forEach(function (loc) {
				sum.total += loc.total;
				sum.planted += loc.planted;
				sum.ripe += loc.ripe;
			});
			body.appendChild(el("div", MCE_CLS.hint,
				"汇总：" + st.farm.locations.length + " 个地点 · 共 " + sum.total + " 块 · 已种 " + sum.planted + " · 可收获 " + sum.ripe));
			st.farm.locations.forEach(function (loc) {
				body.appendChild(el("div", MCE_CLS.hint,
					loc.zh + "：共 " + loc.total + " 块 · 已种 " + loc.planted + " · 可收获 " + loc.ripe));
			});
			var pairs = st.farm.locations.map(function (loc) { return [loc.key, loc.zh]; });
			var sel = mbCEVanillaEconUiSelect(body, "地块", pairs, "按存档内实际地点逐块催熟");
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "该地块全部催熟", "所选地块已种作物一律写到可收获（空格 / 未知作物跳过）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRipen(sel.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "全部地块催熟", "所有地块一次写满（仍跳过空格与未知作物）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRipenAll(), redraw);
			});
			body.appendChild(mceFoldHint("催熟 = 成熟度写满、生长天数归 0。空格与未收录作物故意跳过："
				+ "原版每日结算要按作物表读生长参数，强写会让结算报错。成熟度没有上限判定，收获后别再挂着。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, st.farm.locations.map(function (loc) {
				return ["farm-" + loc.key, "回退 " + loc.zh];
			}));
		};
		redraw();
	}

	/* ---------- ⑪-4 消耗品 ---------- */
	function mbCEVanillaEconSecItem(sec) {
		var body = mbCEVanillaEconUiBody(sec, "避孕套", "消耗品数量");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			mbCEVanillaEconUiKv(body, [["当前数量", st.condoms.count + " 个"], ["存档字段", st.condoms.has ? "已存在" : "未初始化（写入会新建）"]]);
			var inp = mbCEVanillaEconUiNumRow(body, "数量", "0–999；0 个时原版走无套分支", st.condoms.count);
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "写入数量", "把数量写成上方数值", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconCondoms(inp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "追加 10 个", "在当前数量上 +10（999 封顶）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconCondomsAdd(10), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "清零", "写 0 个（等价用完）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconCondoms(0), redraw);
			});
			body.appendChild(mceFoldHint("侧栏「Total condoms」直接读这个数，需在设置里开启避孕套显示才可见。"
				+ "同类的润滑液 / 避孕药在原版没有可直接写的数量字段（只有显示设置与统计计数），所以本组只做避孕套。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["condoms", "回退数量"]]);
		};
		redraw();
	}

	/* ---------- ⑪-5 身体涂鸦：视图在 07m-vanilla-econ-bw-view.js（原版 9 分类 + 特殊涂鸦 + 十六字真言） ---------- */

	function mbCERenderVanillaEcon(pane) {
		var sec = mceNewSec(pane, 11, "经济 · 学业 · 农田 · 消耗品 · 身体涂鸦",
			"房租 / 出勤 / 农田 / 避孕套四项直写原版字段；身体涂鸦走原版 9 类菜单 + 特殊分组 + 悉尼十六字真言，逐条可回退。");
		var V = getV();
		if (!V) {
			sec.appendChild(el("div", MCE_CLS.hint, "游戏尚未就绪，暂不可写。"));
			return;
		}
		mbCEVanillaEconSecRent(sec);
		mbCEVanillaEconSecSchool(sec);
		mbCEVanillaEconSecFarm(sec);
		mbCEVanillaEconSecItem(sec);
		mbCEVanillaEconSecBodywriting(sec);
	}
