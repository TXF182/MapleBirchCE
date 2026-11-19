/* 职责：全局页 ⑪「经济 · 学业 · 农田 · 消耗品 · 纹身」区块渲染（07m-vanilla-econ-data.js 的视图层）。
   设计约束（用户明确要求）：界面全中文、不出现裸键名；枚举项（科目 / 地块 / 身体部位）一律用下拉选择，
   数值项用输入框 + 「写入」按钮。所有写入留痕，区块内每个可回退动作都带「回退」按钮。
   拆段原因：结构门禁 S1 单段 400 行；另按 lint 棘轮把五个分组各拆成独立函数（单函数 ≤120 行 / 复杂度 ≤10）。 */

	function mbCEVanillaEconUiBody(sec, groupTitle, subTitle) {
		var g = mceNewGroup(sec, groupTitle, subTitle);
		var body = el("div", "mce-vcore-body");
		g.appendChild(body);
		return body;
	}
	function mbCEVanillaEconUiClear(body) {
		while (body.firstChild) { body.removeChild(body.firstChild); }
	}
	function mbCEVanillaEconUiUndo(body, id, redraw) {
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
		var sel = el("select", MCE_CLS.inp);
		pairs.forEach(function (p) {
			var op = el("option", "", p[1]);
			op.value = String(p[0]);
			sel.appendChild(op);
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

	/* ---------- ⑪-1 房租与欠租 ---------- */
	function mbCEVanillaEconSecRent(sec) {
		var body = mbCEVanillaEconUiBody(sec, "房租与欠租", "原版 passRentTick：租期倒计时每 7 天催一次；欠租按「周租 + 婴儿附加」累加");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			if (!st.rent.has) {
				body.appendChild(el("div", MCE_CLS.hint, "未找到房租结构（该存档还没进入租房线）。"));
				return;
			}
			body.appendChild(el("div", MCE_CLS.hint,
				"当前：距下次催租 " + st.rent.renttime + " 天 · 欠租 £" + st.rent.debt
				+ " · 每周租金 £" + st.rent.rentmoney
				+ (st.rent.babyRent ? "（含婴儿附加 £" + st.rent.babyRent + "）" : "")));
			var daysInp = mbCEVanillaEconUiNumRow(body, "租期天数", "0 = 今天刚见过 Bailey，7 天内不会累计欠租；数值越小越快被催", st.rent.renttime);
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "写入租期", "把租期倒计时写为上方数值（原版允许 0–365）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentDays(daysInp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "让 Bailey 今天来过", "等价租期 = 0：今天已收过租，接下来 7 天才会计欠", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentDays(0), redraw);
			});
			var debtInp = mbCEVanillaEconUiNumRow(body, "欠租金额（£）", "只写实际欠款；统计页那条历史累计数字不动", st.rent.debt);
			var g2 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g2, "写入欠租", "把欠租写为上方数值", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRentDebt(debtInp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g2, "清空欠租", "欠款归 0，Bailey 不再追这笔钱", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconClearDebt(), redraw);
			});
			body.appendChild(mceFoldHint("原版只在「租期倒计时跌破 0 且正好是 7 的倍数」那一刻累计欠租，且金额固定按当周周租算。"
				+ "所以把租期写 0 就是「今天已经交过」，写大数值则是把催租往后拖；欠租金额直写只改实际欠款，"
				+ "累计统计（统计页那条历史数字）保持真实。"));
			mbCEVanillaEconUiUndo(body, "rent-days", redraw);
			mbCEVanillaEconUiUndo(body, "rent-debt", redraw);
		};
		redraw();
	}

	/* ---------- ⑪-2 学校出勤 ---------- */
	function mbCEVanillaEconSecSchool(sec) {
		var body = mbCEVanillaEconUiBody(sec, "学校出勤", "原版六科出勤位 + 旷课累计（出勤每日重置、旷课不清零）");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			if (!st.school.has) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没有学校流程（今日出勤表未生成），先正常上一天学再回来。"));
				return;
			}
			var mList = MCE_ECON_SUBJECTS.map(function (s) {
				return s.zh + " " + (st.school.attended[s.key] ? "已出勤" : "未出勤") + " · 旷课 " + (st.school.missed[s.key] || 0);
			}).join("｜");
			body.appendChild(el("div", MCE_CLS.hint,
				"当前：今日已出勤 " + st.school.attendedCount + "/6 科 · 旷课累计 " + st.school.missedTotal + " 次"));
			body.appendChild(el("div", MCE_CLS.hint, mList));
			var pairs = MCE_ECON_SUBJECTS.map(function (s) { return [s.key, s.zh]; });
			var sel = mbCEVanillaEconUiSelect(body, "科目", pairs, "六科对应原版今日出勤表的同名科目");
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "设为已出勤", "把所选科目记为今天已上（绝不累进旷课）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconAttend(sel.value, 1), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "设为缺席", "把所选科目记为今天没上（旷课次数由原版结算累加）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconAttend(sel.value, 0), redraw);
			});
			var g2 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g2, "今日六科全出勤", "六科出勤位一次写满（不动旷课计数）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconAttendAll(1), redraw);
			});
			mbCEVanillaEconUiBtn(g2, "旷课次数清零", "六科旷课累计全部归 0（学校警告线立即回落）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconMissedClear(), redraw);
			});
			body.appendChild(mceFoldHint("出勤位每天重置，旷课计数不清。原版缺席时按「今天有没有记录出勤」补一次旷课——"
				+ "所以「设为已出勤」不会凭空加旷课，而「设为缺席」若正好踩在结算点会由原版补一次。"
				+ "要清学校警告，直接点「旷课次数清零」。"));
			mbCEVanillaEconUiUndo(body, "school", redraw);
		};
		redraw();
	}

	/* ---------- ⑪-3 农场地块 ---------- */
	function mbCEVanillaEconSecFarm(sec) {
		var body = mbCEVanillaEconUiBody(sec, "农场地块催熟", "原版农田按地点分块，成熟即可收获（催熟同时把生长天数归 0）");
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
			var sel = mbCEVanillaEconUiSelect(body, "地块", pairs, "地块名对应存档内的实际地点，逐块单独催熟");
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "该地块全部催熟", "所选地块里已种下的作物一律写到可收获（空格 / 未知作物跳过）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRipen(sel.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "全部地块催熟", "所有地块一次写满（仍跳过空格与未知作物）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconRipenAll(), redraw);
			});
			body.appendChild(mceFoldHint("催熟 = 成熟度写到满格、生长天数归 0。空格（还没播种）与「未收录作物」故意跳过："
				+ "原版每日结算会按作物表读生长参数，空格子或作物不在表里时强写成熟，结算会直接报错。"
				+ "写入后照常浇一次水走原版收获流程即可，别让已熟地块继续挂着（成熟度没有上限判定，长期挂会越涨越高）。"));
			st.farm.locations.forEach(function (loc) { mbCEVanillaEconUiUndo(body, "farm-" + loc.key, redraw); });
		};
		redraw();
	}

	/* ---------- ⑪-4 消耗品 ---------- */
	function mbCEVanillaEconSecItem(sec) {
		var body = mbCEVanillaEconUiBody(sec, "消耗品：避孕套", "原版侧栏「Total condoms」直接读这个数量");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var st = mbCEVanillaEconStats();
			body.appendChild(el("div", MCE_CLS.hint,
				"当前：避孕套 " + st.condoms.count + " 个" + (st.condoms.has ? "" : "（尚未初始化，写入会新建）")
				+ " · 侧栏条目需在设置里开启「避孕套显示」才可见"));
			var inp = mbCEVanillaEconUiNumRow(body, "数量", "0–999；0 个时原版会走无套分支", st.condoms.count);
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "写入数量", "把数量写为上方数值", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconCondoms(inp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "追加 10 个", "在当前数量上 +10（写满 999 封顶）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconCondomsAdd(10), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "清零", "写 0 个（等价用完）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconCondoms(0), redraw);
			});
			body.appendChild(mceFoldHint("避孕套是消耗品，数值随时可写，不受当周购买限制。同类的润滑液 / 避孕药在原版没有可直接写的数量键"
				+ "（润滑液只有显示设置，避孕药只有统计计数），所以本区只做避孕套。"));
			mbCEVanillaEconUiUndo(body, "condoms", redraw);
		};
		redraw();
	}

	/* ---------- ⑪-5 玩家纹身 ---------- */
	function mbCEVanillaEconSecTattoo(sec) {
		var body = mbCEVanillaEconUiBody(sec, "玩家纹身", "原版纹身按部位记录；清除等价原版「擦除涂写」（整部位重置）");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var V = getV();
			var st = mbCEVanillaEconStats();
			if (!st.tattoo.has) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没有皮肤数据，进游戏刷新一次再回来。"));
				return;
			}
			var names = st.tattoo.parts.map(function (p) { return p.zh; }).join("、");
			body.appendChild(el("div", MCE_CLS.hint, "当前纹身：" + (st.tattoo.count ? st.tattoo.count + " 处（" + names + "）" : "无")));
			var allParts = Object.keys(V.skin).filter(function (k) {
				return V.skin[k] && typeof V.skin[k] === "object";
			});
			var pairs = allParts.map(function (k) { return [k, mbCEVanillaEconBodyZh(k)]; });
			var sel = mbCEVanillaEconUiSelect(body, "部位", pairs, "只列该存档实际存在的皮肤部位，显示为中文名");
			/* 默认定位到已有纹身的第一个部位，省得玩家自己找 */
			if (st.tattoo.parts.length) { sel.value = String(st.tattoo.parts[0].key); }
			var g1 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g1, "清除该部位纹身", "只清所选部位（没有纹身的部位会被拒绝）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconTattooClear(sel.value), redraw);
			});
			mbCEVanillaEconUiBtn(g1, "标记为纹身", "把该部位已有的图案 / 文字改判为纹身（没有任何图案时拒绝）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconTattooMark(sel.value), redraw);
			});
			var g2 = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g2, "一键清除全部纹身", "所有带纹身的部位一次重置（其他部位不动）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaEconTattooClearAll(), redraw);
			});
			body.appendChild(mceFoldHint("原版「加纹身」不是写个数字就行：纹身店会先把刺青设计（clone 的部位对象）存一份刺青设计数据再标记，"
				+ "凭空造不出合法设计。所以这里提供两条真实可行的路：① 清除（等价原版「擦除涂写」，整部位重置）；"
				+ "② 标记——该部位已经有涂写 / 图案时，把呈现类型改成纹身，显示与判定都按纹身走。"));
			mbCEVanillaEconUiUndo(body, "tattoo-all", redraw);
			allParts.forEach(function (k) { mbCEVanillaEconUiUndo(body, "tattoo-" + k, redraw); });
		};
		redraw();
	}

	function mbCERenderVanillaEcon(pane) {
		var sec = mceNewSec(pane, 11, "经济 · 学业 · 农田 · 消耗品 · 纹身",
			"五组原版直写：① 房租与欠租（租期倒计时 / 欠租金额）；② 学校出勤（逐科或一键六科）；"
			+ "③ 农场地块催熟（按地块选，空地与未知作物会自动跳过）；④ 避孕套数量；⑤ 玩家纹身（清除 / 标记）。"
			+ "全部写入留痕，可在上方「统一回退中心」逐条回退。");
		var V = getV();
		if (!V) {
			sec.appendChild(el("div", MCE_CLS.hint, "游戏尚未就绪，暂不可写。"));
			return;
		}
		mbCEVanillaEconSecRent(sec);
		mbCEVanillaEconSecSchool(sec);
		mbCEVanillaEconSecFarm(sec);
		mbCEVanillaEconSecItem(sec);
		mbCEVanillaEconSecTattoo(sec);
	}
