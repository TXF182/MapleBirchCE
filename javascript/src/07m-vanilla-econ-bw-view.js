/* 职责：全局页 ⑪-5「身体涂鸦」区块（原版镜子菜单样式：9 分类按钮 + 条目/部位下拉 + 确认 + 图像开关；
   另加「特殊涂鸦」子分组入口与「悉尼十六字真言」独立按钮）。数据层见 07m-vanilla-econ-bw-data.js。
   排版复用 07m-vanilla-econ-view.js 的 Ui* 助手（同一套 token，不另起风格）。
   拆段原因：结构门禁 S1 单段 400 行；本段只放涂鸦视图，主渲染段保持原样。 */

	function mbCEVanillaEconBwPartList(skin) {
		var parts = Object.keys(skin).filter(function (k) { return skin[k] && typeof skin[k] === "object"; });
		return parts.length ? parts : ["forehead"];
	}
	function mbCEVanillaEconBwStatusText(obj) {
		if (!obj || typeof obj !== "object" || !obj.pen) { return "空"; }
		return (obj.pen === "tattoo" ? "纹身：" : "涂鸦：") + (obj.writ_cn || obj.writing || "图案");
	}
	function mbCEVanillaEconBwItems(ui) {
		var list;
		if (ui.special) {
			list = mbCEVanillaEconBwSpecial();
			var hit = list.filter(function (g) { return g.grp === ui.sp; })[0];
			if (!hit && list.length) { ui.sp = list[0].grp; hit = list[0]; }
			return hit ? hit.items : [];
		}
		list = mbCEVanillaEconBwMenu();
		var g = list.filter(function (x) { return x.grp === ui.cat; })[0];
		return g ? g.items : [];
	}
	function mbCEVanillaEconBwCatGrid(body, ui, redraw) {
		var g = mceBtnGrid(body);
		mbCEVanillaEconBwMenu().forEach(function (x) {
			mbCEVanillaEconUiBtn(g, x.zh, "原版菜单分类：" + x.zh + "（" + x.items.length + " 条）", function () {
				ui.cat = x.grp;
				ui.special = false;
				redraw();
			});
		});
	}
	function mbCEVanillaEconBwSpecialEntry(body, ui, redraw) {
		var g = mceBtnGrid(body);
		mbCEVanillaEconUiBtn(g, "特殊涂鸦", "镜子菜单未收录的 NPC / 剧情专属涂鸦，按写入来源分组", function () {
			ui.special = true;
			redraw();
		});
		mbCEVanillaEconUiBtn(g, "悉尼十六字真言", "直接写当前部位：操他妈的只会色诱的白痴脑瘫小婊子（原版悉尼专属）", function () {
			mbCEVanillaEconUiRun(mbCEVanillaEconBwWrite(ui.part, MCE_ECON_BW_TRUTH_KEY), redraw);
		});
		if (!ui.special) { return; }
		var groups = mbCEVanillaEconBwSpecial();
		if (!groups.length) {
			body.appendChild(el("div", MCE_CLS.hint, "原版涂鸦数据缺失或为空，暂无可用的特殊涂鸦。"));
			return;
		}
		var sg = mceBtnGrid(body);
		groups.forEach(function (x) {
			mbCEVanillaEconUiBtn(sg, x.zh, x.zh + " 组（" + x.items.length + " 条）", function () {
				ui.sp = x.grp;
				redraw();
			});
		});
	}
	function mbCEVanillaEconBwWriteRow(body, ui, redraw, items, parts) {
		if (!items.length) { return; }
		var sel = mbCEVanillaEconUiSelect(body, "涂鸦",
			items.map(function (it) { return [it.key, it.zh]; }),
			"原版条目；装了汉化包时显示中文名，否则显示原文");
		var partSel = mbCEVanillaEconUiSelect(body, "部位",
			parts.map(function (k) { return [k, mbCEVanillaEconBodyZh(k)]; }),
			"原版可见部位（含该存档已有的皮肤键）");
		partSel.value = ui.part;
		partSel.addEventListener("change", function () { ui.part = partSel.value; redraw(); });
		var g = mceBtnGrid(body);
		mbCEVanillaEconUiBtn(g, "写入涂鸦", "把所选条目复制成原版对象写到所选部位（判为涂鸦，可回退）", function () {
			if (!sel.value) { setStatus("该分组没有可写条目", MCE_CLS.err); return; }
			mbCEVanillaEconUiRun(mbCEVanillaEconBwWrite(ui.part, sel.value), redraw);
		});
	}
	function mbCEVanillaEconBwClearRow(body, ui, redraw, V) {
		var g = mceBtnGrid(body);
		mbCEVanillaEconUiBtn(g, "清除该部位", "整部位重置（等价原版 bodywriting_clear，涂鸦与纹身都清）", function () {
			mbCEVanillaEconUiRun(mbCEVanillaEconBwClear(ui.part), redraw);
		});
		mbCEVanillaEconUiBtn(g, "清除全部涂写", "所有已写涂鸦 / 纹身的部位一次重置（其他皮肤字段不动）", function () {
			mbCEVanillaEconUiRun(mbCEVanillaEconBwClearAll(), redraw);
		});
		var row = el("div", MCE_CLS.row);
		var lbl = el("label", MCE_CLS.rowLbl, "");
		lbl.title = "原版设置项：勾上才会画涂鸦图像";
		var chk = el("input");
		chk.type = "checkbox";
		chk.checked = !!(V.options && V.options.bodywritingImages);
		chk.addEventListener("change", function () {
			mbCEVanillaEconUiRun(mbCEVanillaEconBwImages(chk.checked), redraw);
		});
		lbl.appendChild(chk);
		lbl.appendChild(document.createTextNode(" 启用身体涂鸦图像"));
		row.appendChild(lbl);
		body.appendChild(row);
	}

	function mbCEVanillaEconSecBodywriting(sec) {
		var body = mbCEVanillaEconUiBody(sec, "身体涂鸦", "9 类原版菜单 · 特殊涂鸦 · 悉尼十六字真言");
		var ui = { cat: "General", special: false, sp: "Sydney", part: "forehead" };
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var V = getV();
			var skin = V && V.skin;
			if (!skin || typeof skin !== "object") {
				body.appendChild(el("div", MCE_CLS.hint, "该存档没有皮肤数据，进游戏刷新一次再回来。"));
				return;
			}
			var parts = mbCEVanillaEconBwPartList(skin);
			if (parts.indexOf(ui.part) < 0) { ui.part = parts[0]; }
			var groups = mbCEVanillaEconBwSpecial();
			var catZh = mbCEVanillaEconBwMenu().filter(function (x) { return x.grp === ui.cat; })[0];
			var spZh = groups.filter(function (x) { return x.grp === ui.sp; })[0];
			mbCEVanillaEconUiKv(body, [
				["当前部位", mbCEVanillaEconBodyZh(ui.part)],
				["当前内容", mbCEVanillaEconBwStatusText(skin[ui.part])],
				["当前分类", ui.special ? "特殊涂鸦 · " + (spZh ? spZh.zh : "无") : (catZh ? catZh.zh : ui.cat)]
			]);
			mbCEVanillaEconBwCatGrid(body, ui, redraw);
			mbCEVanillaEconBwSpecialEntry(body, ui, redraw);
			var items = mbCEVanillaEconBwItems(ui);
			if (!items.length) {
				body.appendChild(el("div", MCE_CLS.hint, ui.special ? "该特殊分组暂无可写涂鸦。" : "该分类暂无可写涂鸦（宿主未提供这些键）。"));
			}
			mbCEVanillaEconBwWriteRow(body, ui, redraw, items, parts);
			mbCEVanillaEconBwClearRow(body, ui, redraw, V);
			body.appendChild(mceFoldHint("原版 206 条涂鸦里，镜子菜单只开放 118 条（按属性 / 好感条件解锁，这里按全量列出）；"
				+ "其余 88 条是 NPC / 剧情专属，统一收进「特殊涂鸦」按来源分组。十六字真言单独按钮，直接写当前部位。"
				+ "所有写入走原版涂鸦通道（笔迹判为涂鸦），与纹身互不覆盖，逐条可回退。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [
				["bodywriting-" + ui.part, "回退 " + mbCEVanillaEconBodyZh(ui.part)],
				["bodywriting-all", "回退全部涂写"],
				["bodywriting-images", "回退图像开关"]
			]);
		};
		redraw();
	}
