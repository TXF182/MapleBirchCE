/* v1.8.3：同系列不同阶段特质合并（如受虐狂 4 档 / 施虐狂 4 档 / 各科成绩 4 档）——
   识别依据：同一分类下 has 表达式只含一个数字比较变量（is/gte/gt N），同变量归为一组，按阈值排序。
   渲染为「阶段下拉 + 应用 + 跳至最高 + 回退初始」，对齐 Mod作弊 子页阶段控件。 */
var TRAIT_SERIES_CN = {
	"masochism_level": "受虐狂", "sadism_level": "施虐狂",
	"sciencetrait": "科学成绩", "mathstrait": "数学成绩", "englishtrait": "语文成绩",
	"historytrait": "历史成绩", "schooltrait": "在校表现"
};
function groupTraitSeries(vanilla) {
	var groups = {};
	vanilla.forEach(function (t) {
		var v = t.parsed && t.parsed.vars;
		if (!v || v.length !== 1) { return; }
		var v0 = v[0];
		if ((v0.op !== "is" && v0.op !== "gte" && v0.op !== "gt") || isNaN(parseFloat(String(v0.val).replace(/["']/g, "")))) { return; }
		var key = t.cat + "\u0001" + v0.path;
		(groups[key] = groups[key] || []).push({ t: t, path: v0.path, val: parseFloat(String(v0.val).replace(/["']/g, "")) });
	});
	var out = [];
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		if (g.length >= 2) {
			g.sort(function (a, b) { return a.val - b.val; });
			out.push({ cat: g[0].t.cat, path: g[0].path, series: g });
		}
	});
	out.sort(function (a, b) { return a.series[0].val - b.series[0].val; });
	return out;
}
function traitSeriesName(series) {
	var base = TRAIT_SERIES_CN[series.path];
	if (base) { return base; }
	return traitDisplayName(series.series[0].t, getV());
}
/* 系列行渲染：系列名 + 阶段下拉（无/各档位）+ 应用 + 跳至最高 + 回退初始 */
function renderTraitSeriesRow(body, series, V) {
	var V2 = V || getV();
	var seriesName = traitSeriesName(series);
	var cur = safeGetObj(V2, series.path);
	var curNum = (typeof cur === "number" && isFinite(cur)) ? cur : null;
	var curTier = -1, i;
	for (i = 0; i < series.series.length; i++) {
		if (series.series[i].val === curNum) { curTier = i; break; }
	}
	var sel = el("select", "mce-sel");
	/* 注意：HTMLSelectElement.type 是只读 getter，不能赋值（赋了真实浏览器抛
	   "Cannot set property type of #<HTMLSelectElement>"）；select 也不需要 type */
	var opt0 = el("option", "", "无（未获得）");
	opt0.value = "0";
	sel.appendChild(opt0);
	series.series.forEach(function (item, idx) {
		var o = el("option", "", traitDisplayName(item.t, V2) + "（" + item.val + "）");
		o.value = String(item.val);
		sel.appendChild(o);
	});
	sel.value = String(curTier >= 0 ? series.series[curTier].val : 0);
	var lbl = el("span", "mce-row-lbl", seriesName + "（当前 " + (curTier >= 0 ? traitDisplayName(series.series[curTier].t, V2) : "无") + "）");
	var bApp = el("button", "", "应用"); bApp.type = "button";
	bApp.addEventListener("click", function () {
		var v = parseFloat(sel.value);
		if (isNaN(v)) { v = 0; }
		var res = traitWriteValue(series.series[0].t, V2, series.path, String(v));
		actPlayer(res);
	});
	var bMax = el("button", "", "跳至最高"); bMax.type = "button";
	bMax.addEventListener("click", function () {
		var v = series.series[series.series.length - 1].val;
		var res = traitWriteValue(series.series[0].t, V2, series.path, String(v));
		actPlayer(res);
	});
	var bInit = el("button", "", "回退初始"); bInit.type = "button";
	bInit.addEventListener("click", function () {
		/* 回退初始 = 写 0（无阶段），不依赖留痕（保证从未改过也能回退） */
		var res = traitWriteValue(series.series[0].t, V2, series.path, "0");
		actPlayer(res);
	});
	var row = el("div", "mce-row");
	row.appendChild(lbl); row.appendChild(sel); row.appendChild(bApp); row.appendChild(bMax); row.appendChild(bInit);
	body.appendChild(row);
}
/* 特质管理区渲染：原版分类（静态表）+ 模组特质分类（运行时发现） */
function renderTraitsSection(pane, V, C) {
	var wrap = el("div", "mce-grp");
	wrap.appendChild(el("div", "mce-grp-t", "★ 特质管理：可直接获取/移除，有数值的可直接更改（含其他模组注入的特质，自动发现）。已按分类折叠，点击分类标题展开；行首 ☆ 点击可收藏置顶"));
	var vanilla = compileVanillaTraits();
	var modTraits = discoverModTraits();
	var q = (curPlayerFilter || "").toLowerCase();
	var seenV = {}, seenM = {}, groups = {};
	/* v1.8.12 收藏置顶组：收藏的特质优先显示在最前（含模组特质） */
	var FAV_CAT = "★ 已收藏";
	/* v1.8.12 功能13：收藏集合局部缓存——一次扫描替代逐行 indexOf 查询（几十个特质行的重复数组查找） */
	var favCache = getFavTraits(V).slice();
	function isFav(t) {
		var k = favTraitKey(t);
		return favCache.indexOf(k) !== -1;
	}
	/* 可折叠分类组：标题可点，body 默认收起（data-collapsed=1，CSS 隐藏） */
	/* v1.8.15 九巡：懒渲染——初始收起的组不建行（行闭包进 g.pending），展开才建行，面板开合/切页显著减 DOM */
	function buildLazyRows(g) {
		if (!g || !g.pending || g.pending.length === 0) { return; }
		var pend = g.pending;
		g.pending = [];
		pend.forEach(function (fn) { try { fn(); } catch (e) {} });
	}
	function bodyFor(zhCat, note) {
		if (groups[zhCat]) { return groups[zhCat]; }
		var grp = el("div", "mce-grp");
		grp.setAttribute("data-tcat", zhCat);
		/* 恢复展开时箭头同步 ▾（bodyFor 内读取 mbCEUiState，head 文案一次成型） */
		var restoreOpen = mbCEUiState.collapsed[zhCat] === 0;
		var head = el("div", "mce-grp-t mce-collapse-head", (restoreOpen ? "▾ " : "▸ ") + zhCat);
		var body = el("div", "mce-grp-body");
		/* v1.8.12 持久化：恢复上次折叠状态（0=展开，1=收起；未记录默认收起）；箭头同步 ▸/▾ */
		var collapsedNow = mbCEUiState.collapsed[zhCat] === 0 ? false : true;
		body.setAttribute("data-collapsed", collapsedNow ? "1" : "0");
		head.addEventListener("click", function () {
			var open = body.getAttribute("data-collapsed") !== "1";
			body.setAttribute("data-collapsed", open ? "1" : "0");
			head.textContent = (open ? "▸ " : "▾ ") + zhCat + (groups[zhCat].count > 0 ? "（" + groups[zhCat].count + "）" : "") + groups[zhCat].note;
			/* 懒渲染：展开瞬间补建行（open=点击前展开态，点击前收起(!open) → 点击后展开 → 补建） */
			if (!open) { buildLazyRows(groups[zhCat]); }
			/* v1.8.12 持久化：记录点击后状态（点击后展开 = !open） */
			mbCEUiCollapsed(zhCat, !open);
		});
		grp.appendChild(head);
		grp.appendChild(body);
		if (zhCat === FAV_CAT && wrap.firstChild) {
			/* 收藏组置顶：插到头部工具行之后（工具行常驻最顶） */
			wrap.insertBefore(grp, wrap.firstChild.nextSibling);
		}
		else { wrap.appendChild(grp); }
		var g = { head: head, body: body, count: 0, note: note || "", pending: [] };
		groups[zhCat] = g;
		return g;
	}
	/* v1.8.12 二轮优化：折叠工具行——全部展开 / 全部收起（点击时 groups 已渲染完成） */
	var toolRow = el("div", "mce-row");
	toolRow.appendChild(el("span", "mce-row-lbl", "折叠工具："));
	var bAllOpen = el("button", "", "全部展开"); bAllOpen.type = "button";
	bAllOpen.title = "展开特质管理区全部分类";
	bAllOpen.addEventListener("click", function () {
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			g.body.setAttribute("data-collapsed", "0");
			g.head.textContent = "▾ " + k + "（" + g.count + "）" + g.note;
			buildLazyRows(g); /* 懒渲染：全部展开时补建所有行 */
			mbCEUiCollapsed(k, true);
		});
	});
	var bAllClose = el("button", "", "全部收起"); bAllClose.type = "button";
	bAllClose.title = "收起特质管理区全部分类";
	bAllClose.addEventListener("click", function () {
		Object.keys(groups).forEach(function (k) {
			var g = groups[k];
			g.body.setAttribute("data-collapsed", "1");
			g.head.textContent = "▸ " + k + "（" + g.count + "）" + g.note;
			mbCEUiCollapsed(k, false);
		});
	});
	toolRow.appendChild(bAllOpen);
	toolRow.appendChild(bAllClose);
	wrap.appendChild(toolRow);
	/* 系列识别：同变量多档位特质 → 合并为一行（阶段下拉），不再逐条平铺 */
	var seriesGroups = groupTraitSeries(vanilla);
	var seriesKeys = {};
	seriesGroups.forEach(function (s) {
		s.series.forEach(function (item) { seriesKeys[item.t.cat + "\u0001" + String(item.t.name || "")] = true; });
	});
	/* 原版按分类分组渲染（同分类同中文名去重：原版 widget 多段/函数名同语义只显示一行） */
	vanilla.forEach(function (t) {
		if (seriesKeys[t.cat + "\u0001" + String(t.name || "")]) { return; }
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && String(t.name || "").toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenV[key]) { return; }
		seenV[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] || t.cat;
		var g = bodyFor(isFav(t) ? FAV_CAT : zhCat, isFav(t) ? " · 收藏置顶（点击☆取消）" : "");
		g.count++;
		g.pending.push(function () { renderTraitRow(g.body, t, V, C, false); }); /* 懒渲染：收起组只记账不建行 */
	});
	/* 系列行渲染（放入所属分类组；搜索时按系列名过滤） */
	seriesGroups.forEach(function (s) {
		var seriesName = traitSeriesName(s);
		if (q && seriesName.toLowerCase().indexOf(q) === -1) { return; }
		var zhCat = TRAIT_ZH_CAT[s.cat] || s.cat;
		var g = bodyFor(zhCat, "");
		g.count++;
		g.pending.push(function () { renderTraitSeriesRow(g.body, s, V); }); /* 懒渲染 */
	});
	/* 模组特质分类（按 title 分组，同分类同中文名去重） */
	modTraits.forEach(function (t) {
		var nameZh = traitDisplayName(t, V);
		if (q && nameZh.toLowerCase().indexOf(q) === -1 && t.cat.toLowerCase().indexOf(q) === -1) { return; }
		var key = t.cat + "\u0001" + nameZh;
		if (seenM[key]) { return; }
		seenM[key] = true;
		var zhCat = TRAIT_ZH_CAT[t.cat] ? TRAIT_ZH_CAT[t.cat] + "（模组）" : (t.cat + "（模组）");
		var g = bodyFor(isFav(t) ? FAV_CAT : zhCat, isFav(t) ? " · 收藏置顶（点击☆取消）" : " · 模组注入（自动发现，可直接获取/移除）");
		g.count++;
		g.pending.push(function () { renderTraitRow(g.body, t, V, C, true); }); /* 懒渲染 */
	});
	/* 组标题统一补数量（箭头按当前展开状态：0=展开 ▾，1=收起 ▸；持久化恢复时保持一致性） */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		var open = g.body.getAttribute("data-collapsed") !== "1";
		g.head.textContent = (open ? "▾ " : "▸ ") + k + "（" + g.count + "）" + g.note;
	});
	/* 懒渲染：展开状态的分组初始即建行（收起的组保持空，等点击展开才建）。
	   搜索态（q 非空）下强制所有组展开并建行——否则匹配行落在收起组里不可见（搜索结果丢失）。
	   仅改 DOM 收起标记，不写入持久化折叠状态，搜索结束后恢复默认收起 */
	Object.keys(groups).forEach(function (k) {
		var g = groups[k];
		if (q) {
			g.body.setAttribute("data-collapsed", "0");
			g.head.textContent = "▾ " + k + "（" + g.count + "）" + g.note;
		}
		if (q || g.body.getAttribute("data-collapsed") !== "1") { buildLazyRows(g); }
	});
	/* v1.8.12 二轮优化：折叠状态残留键清理（仅全量渲染时——搜索过滤下未显示分类会被误删） */
	if (!q) {
		var alive = {};
		Object.keys(groups).forEach(function (k) { alive[k] = true; });
		var stale = false;
		Object.keys(mbCEUiState.collapsed).forEach(function (k) {
			if (!alive[k]) { delete mbCEUiState.collapsed[k]; stale = true; }
		});
		if (stale) { mbCEUiSave({ collapsed: mbCEUiState.collapsed }); }
	}
	pane.appendChild(wrap);
}
function renderTraitRow(grp, t, V, C, isMod) {
	var owned = traitOwned(t, V, C);
	var nameZh = traitDisplayName(t, V);
	var row = el("div", "mce-row");
	/* v1.8.12 收藏置顶：☆ 收藏 / ★ 已收藏（数据存 V.mbCE_favTraits，CSS 类渲染兼容无 DOM 环境） */
	var favNow = isFavTrait(t, V);
	var bF = el("button", "mce-favstar" + (favNow ? " mce-fav" : ""), favNow ? "★" : "☆");
	bF.type = "button";
	bF.title = favNow ? "取消收藏（该特质不再置顶）" : "收藏（该特质置顶到「★ 已收藏」组）";
	bF.addEventListener("click", function () {
		var res = toggleFavTrait(t, V);
		actPlayer(res);
	});
	row.appendChild(bF);
	row.appendChild(el("span", "mce-row-lbl", (owned ? "● " : "○ ") + nameZh + (isMod ? "（模组）" : "")));
	/* 描述（函数/模板源码型描述不展示，避免源码泄漏） */
	var desc = isMod ? t.text : String(t.text || "");
	desc = String(desc || "");
	if (/^\s*\(?\s*\)\s*=>/.test(desc) || /^\s*function\b/.test(desc) || (desc.length > 300 && desc.indexOf("`") !== -1)) { desc = ""; }
	if (desc) {
		row.appendChild(el("span", "mce-hint", String(desc).slice(0, 90) + (String(desc).length > 90 ? "…" : "")));
	}
	/* 获取 / 移除：原版与模组注入特质均可（v1.8.11 模组特质不再只读——
	   字符串判定写变量直接获得/移除，函数判定走强制获得标记） */
	var bG = el("button", "", owned ? "移除" : "获取");
	bG.type = "button";
	bG.addEventListener("click", function () {
		var res;
		if (owned) {
			var w = revokeTrait(t, V, C);
			res = { ok: w.length > 0, message: w.length ? "已移除「" + nameZh + "」：" + w.join("、") : "该特质无可移除的条件变量" };
		} else {
			var w2 = grantTrait(t, V, C);
			res = { ok: w2.length > 0, message: w2.length ? "已获取「" + nameZh + "」：" + w2.join("、") : "该特质无可写条件（只读展示）" };
		}
		actPlayer(res);
	});
	row.appendChild(bG);
	/* 数值可改（数字比较变量）：写入走 player-self 留痕通道 + 回退
	   （原版与模组注入特质均可用——discoverModTraits 已为模组特质生成 values 清单） */
	t.values.forEach(function (v) {
		var cur = safeGetObj(V, v.path);
		var num = (typeof cur === "number") ? cur : 0;
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(num);
		inp.placeholder = "+N / -N 相对";
		inp.title = "支持相对调整：+100 / -20；直接输入数字为绝对值";
		var bS = el("button", "", "改数值"); bS.type = "button";
		bS.addEventListener("click", function () {
			var res = traitWriteValue(t, V, v.path, inp.value);
			actPlayer(res);
		});
		var bU = el("button", "", "回退"); bU.type = "button";
		bU.addEventListener("click", function () {
			var res = undoCheatModValue("player-self", "trait:" + v.path);
			actPlayer(res);
		});
		row.appendChild(inp); row.appendChild(bS); row.appendChild(bU);
	});
	grp.appendChild(row);
}
/* v1.8.12 特质收藏（数据层）：V.mbCE_favTraits 数组，key=cat\u0001name，收藏项渲染置顶 */
function favTraitKey(t) {
	return String(t && (t.cat || t.kind || "")) + "\u0001" + String(t && (t.name || ""));
}
function getFavTraits(V) {
	try {
		var v = V || getV();
		if (v && Array.isArray(v.mbCE_favTraits)) { return v.mbCE_favTraits; }
	} catch (e) {}
	return [];
}
function isFavTrait(t, V) {
	try { return getFavTraits(V).indexOf(favTraitKey(t)) !== -1; } catch (e) { return false; }
}
function toggleFavTrait(t, V) {
	try {
		var v = V || getV();
		if (!v) { return { ok: false, message: "存档变量不可用" }; }
		if (!Array.isArray(v.mbCE_favTraits)) { v.mbCE_favTraits = []; }
		var k = favTraitKey(t);
		var idx = v.mbCE_favTraits.indexOf(k);
		if (idx !== -1) { v.mbCE_favTraits.splice(idx, 1); return { ok: true, fav: false, message: "已取消收藏" }; }
		v.mbCE_favTraits.push(k);
		return { ok: true, fav: true, message: "已收藏（置顶显示）" };
	} catch (e) { return { ok: false, message: "操作异常：" + (e && e.message ? e.message : e) }; }
}

function traitWriteValue(t, V, path, raw) {
	var num = parseFloat(raw);
	if (isNaN(num)) { return { ok: false, message: "请输入数字（当前值 " + (safeGetObj(V, path) === undefined ? "?" : safeGetObj(V, path)) + "）" }; }
	var before = safeGetObj(V, path);
	/* v1.8.12：保留原始字符串传给 cheatWriteValue，使 +N / -N 相对语法生效（parseFloat 仅作合法性校验） */
	var res = cheatWriteValue("player-self", "trait:" + path, "value_set", path, raw, "number");
	if (!res || !res.ok) { return { ok: false, message: "写入失败：" + (res && res.message ? res.message : "未知错误") }; }
	var after = safeGetObj(V, path);
	return { ok: true, message: "「" + traitDisplayName(t, V) + "」数值 " + path + "：" + (before === undefined ? "?" : before) + " → " + after + "（可回退）" };
}
/* 兼容导出（v1.7.x 老 API 保留，UI 已迁移至特质管理）：模组属性判定（数据层） */
function isModOnlyRoot(k) {
	if (!k) { return false; }
	if (k.indexOf("mbCE_") === 0) { return false; }
	if (ORIGINAL_V_ROOT_KEYS.indexOf(k) !== -1) { return false; }
	if (CHEAT_VANILLA_ROOTS.indexOf(k) !== -1) { return false; }
	return true;
}
