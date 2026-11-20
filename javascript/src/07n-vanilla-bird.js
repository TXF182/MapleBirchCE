/* 职责：全局页 ⑫「鹰塔工地（大鹰塔）」——原版 $bird 清洁度与八种材料直写，vcore-bird 留痕可回退。
   原版取证（DoL 0.5.12.13 单文件 HTML，game\Degrees of Lewdity.html，可复跑 Grep）：
     新档 L182150 `<<set $bird to {}>>` 只建空壳；materials 九键由 L189817–189839 段建（要 $bird.state 有值且 !$bird.hunts），
     所以**材料写入前必须判 materials 是否存在**——贴吧原版言灵直接 `$bird.materials.wood += 100` 在新档会 TypeError。
     clean 同段 L189819 初始化 0；清理动作后 clamp 0..30，仅巨鹰配偶态（$syndromebird）0..110（L452195–452199）；
     日结 L77668 clamp(clean - (10 - shelter), 0, 100) → 写 110 次日必跌回 100 以下；显示 L448061 gte 100 即最高档。
     材料消耗量级很小（wood 2–3 / sticks 3–5 / lurkers 1），故采用「只升不降补足到 100」，
     而不是贴吧那版的裸 `+= 100`（连点会累加成几百）。
   排版复用 07m-vanilla-econ-view.js 的 Ui* 助手（同一套 token，不重复造轮子）；拆段不拆语义，数据 + 视图同段。 */

	/* 八种材料（原版 L189829–189839 初始化顺序；valuables 是子对象，不碰） */
	var MCE_BIRD_MATERIALS = [
		{ key: "wood", zh: "木材" },
		{ key: "sticks", zh: "树枝" },
		{ key: "leaves", zh: "叶子" },
		{ key: "fabric", zh: "布料" },
		{ key: "lurkers", zh: "潜伏者" },
		{ key: "leather", zh: "皮革" },
		{ key: "feathers", zh: "羽毛" },
		{ key: "junk", zh: "亮晶晶杂物" }
	];
	var MCE_BIRD_TARGET = 100;
	/* 十二项设施与上限（原版 L456540–456760 建造菜单 switch：最后一个有 passage 的分支即满级；
	   镜子/工具/防水布/望远镜/衣柜是 0/1 布尔式，庇护/巢/火坑/炊具/晾架到 3，陷阱到 2，装饰到 5（第 5 档 = Decor Silver）） */
	var MCE_BIRD_UPGRADES = [
		{ key: "mirror", zh: "镜子", max: 1 },
		{ key: "tools", zh: "工具", max: 1 },
		{ key: "tarp", zh: "防水布", max: 1 },
		{ key: "telescope", zh: "望远镜", max: 1 },
		{ key: "shelter", zh: "庇护", max: 3 },
		{ key: "nest", zh: "巢", max: 3 },
		{ key: "firepit", zh: "火坑", max: 3 },
		{ key: "pot", zh: "炊具", max: 3 },
		{ key: "rack", zh: "晾架", max: 3 },
		{ key: "snare", zh: "陷阱", max: 2 },
		{ key: "decor", zh: "装饰", max: 5 },
		{ key: "wardrobe", zh: "衣柜", max: 1 }
	];

	/* 数值入口统一：空值走缺省，非数字返回 null（由调用方拒绝） */
	function mbCEVanillaBirdNum(v, dft) {
		if (v === undefined || v === null || v === "") { return dft; }
		var n = Number(v);
		if (!isFinite(n)) { return null; }
		return n;
	}
	/* 读值统一：非数字一律当 0（原版这些键都是数值；用 || 会多算复杂度，故单独收口） */
	function mbCEVanillaBirdNumOr0(v) {
		var n = Number(v);
		if (isFinite(n)) { return n; }
		return 0;
	}
	function mbCEVanillaBirdStr(v) {
		if (v === undefined) { return ""; }
		return String(v);
	}
	function mbCEVanillaBirdIsObj(o) {
		return !!o && typeof o === "object" && !Array.isArray(o);
	}

	function mbCEVanillaBirdState() {
		var out = {
			ok: false, has: false, hasMaterials: false, hasUpgrades: false, clean: 0, cleanRaw: undefined,
			syndrome: false, state: "", firepit: 0, shelter: 0, materials: {}, upgrades: {}
		};
		var sv = getV();
		if (!sv) { return out; }
		if (!mbCEVanillaBirdIsObj(sv.bird)) { return out; }
		out.has = true;
		out.ok = true;
		out.cleanRaw = sv.bird.clean;
		out.clean = mbCEVanillaBirdNumOr0(sv.bird.clean);
		out.syndrome = Number(sv.syndromebird) === 1;
		out.state = mbCEVanillaBirdStr(sv.bird.state);
		var up = sv.bird.upgrades;
		if (mbCEVanillaBirdIsObj(up)) {
			out.hasUpgrades = true;
			out.firepit = mbCEVanillaBirdNumOr0(up.firepit);
			out.shelter = mbCEVanillaBirdNumOr0(up.shelter);
			MCE_BIRD_UPGRADES.forEach(function (m) {
				out.upgrades[m.key] = mbCEVanillaBirdNumOr0(up[m.key]);
			});
		}
		if (mbCEVanillaBirdIsObj(sv.bird.materials)) {
			out.hasMaterials = true;
			MCE_BIRD_MATERIALS.forEach(function (m) {
				out.materials[m.key] = mbCEVanillaBirdNumOr0(sv.bird.materials[m.key]);
			});
		}
		return out;
	}

	function mbCEVanillaBirdCleanSet(target) {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		if (!sv.bird || typeof sv.bird !== "object") { return { ok: false, message: "还没遇到大鹰：鹰塔数据不存在，先推进到鹰塔再来" }; }
		var t = mbCEVanillaBirdNum(target, MCE_BIRD_TARGET);
		if (t === null) { return { ok: false, message: "清洁度必须是数字" }; }
		t = Math.max(0, Math.min(110, Math.round(t)));
		var before = { kind: "bird-clean", had: Object.prototype.hasOwnProperty.call(sv.bird, "clean"), clean: sv.bird.clean };
		sv.bird.clean = t;
		mbCEVanillaTrace("bird-clean", before, "bird.clean", "鹰塔清洁度直写", "vcore-bird");
		var msg = "鹰塔清洁度已写为 " + t;
		if (t >= 100) { msg += "（原版 gte 100 即最高档）"; }
		if (t > 100) { msg += "；日结会按「10 - 庇护等级」递减，次日必跌回 100 以下"; }
		if (!mbCEVanillaBirdState().syndrome) { msg += "；当前不是巨鹰配偶态，原版清理动作只会把清洁度钳在 0–30，这个数只由本项直接写入"; }
		return { ok: true, clean: t, message: msg };
	}

	function mbCEVanillaBirdMaterialsFill(target) {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		if (!sv.bird || typeof sv.bird !== "object") { return { ok: false, message: "还没遇到大鹰：鹰塔数据不存在，先推进到鹰塔再来" }; }
		/* 缺失即拒绝：此时写进去的键会在原版初始化段被整体覆盖成 0，等于白写 */
		if (!mbCEVanillaBirdState().hasMaterials) { return { ok: false, message: "鹰塔材料堆还没建立，先在鹰塔里走一段让原版初始化，再回来补" }; }
		var t = mbCEVanillaBirdNum(target, MCE_BIRD_TARGET);
		if (t === null) { return { ok: false, message: "材料目标值必须是数字" }; }
		t = Math.max(0, Math.min(9999, Math.round(t)));
		var mats = sv.bird.materials;
		var before = { kind: "bird-materials", mat: {}, had: {} };
		var changed = [];
		MCE_BIRD_MATERIALS.forEach(function (m) {
			before.mat[m.key] = mats[m.key];
			before.had[m.key] = Object.prototype.hasOwnProperty.call(mats, m.key);
			var cur = mats[m.key];
			if (typeof cur === "number" && cur >= t) { return; }
			mats[m.key] = t;
			changed.push(m.zh);
		});
		if (changed.length) { mbCEVanillaTrace("bird-materials", before, "bird.materials", "鹰塔材料补足", "vcore-bird"); }
		var msg = changed.length
			? "已补足的 " + changed.length + " 种材料 → " + t + "：" + changed.join("、")
			: "八种材料都不低于 " + t + "，未改动";
		return { ok: true, changed: changed.length, message: msg + "。原版升级单项只要 2–5 个，这些足够用很久。" };
	}

	/* 十二项设施一键满级：只升不降；上限取自原版建造菜单最后一级（L456540–456760 的 switch 分支） */
	function mbCEVanillaBirdUpgradesMax() {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		if (!mbCEVanillaBirdIsObj(sv.bird)) { return { ok: false, message: "还没遇到大鹰：鹰塔数据不存在，先推进到鹰塔再来" }; }
		if (!mbCEVanillaBirdIsObj(sv.bird.upgrades)) { return { ok: false, message: "鹰塔设施表还没建立，先进鹰塔走一段让原版初始化，再回来点满级" }; }
		var up = sv.bird.upgrades;
		var before = { kind: "bird-upgrades", lvl: {}, had: {} };
		var changed = [];
		MCE_BIRD_UPGRADES.forEach(function (m) {
			before.lvl[m.key] = up[m.key];
			before.had[m.key] = Object.prototype.hasOwnProperty.call(up, m.key);
			if (mbCEVanillaBirdNumOr0(up[m.key]) >= m.max) { return; }
			up[m.key] = m.max;
			changed.push(m.zh);
		});
		if (changed.length) { mbCEVanillaTrace("bird-upgrades", before, "bird.upgrades", "鹰塔设施一键满级", "vcore-bird"); }
		var msg = changed.length
			? "已满级 " + changed.length + " 项：" + changed.join("、")
			: "十二项设施都已在满级，未改动";
		return { ok: true, changed: changed.length, message: msg + "。只升不降；已满级的项在原版建造菜单里不再出现「Improve」。" };
	}


	/* 回退：kind 由 07l 的 mbCEVanillaExtUndo 委派过来；返回 null = 本段不认识 */
	function mbCEVanillaBirdUndoClean(b, key) {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用" }; }
		if (!mbCEVanillaBirdIsObj(sv.bird)) { return { ok: false, message: "鹰塔数据已不在，无法回退" }; }
		if (b.had) {
			sv.bird.clean = b.clean;
			delete sv.mbCE_wrote[key];
			return { ok: true, message: "已还原鹰塔清洁度为 " + String(b.clean) };
		}
		try { delete sv.bird.clean; } catch (eC) { void eC; }
		delete sv.mbCE_wrote[key];
		return { ok: true, message: "已撤销鹰塔清洁度（原档没有这个值）" };
	}
	function mbCEVanillaBirdUndoMats(b, key) {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用" }; }
		if (!mbCEVanillaBirdIsObj(sv.bird)) { return { ok: false, message: "鹰塔数据已不在，无法回退" }; }
		var mats = sv.bird.materials;
		if (!mbCEVanillaBirdIsObj(mats)) { return { ok: false, message: "鹰塔材料结构已不在，无法回退" }; }
		var had = mbCEVanillaBirdIsObj(b.had) ? b.had : {};
		var mat = mbCEVanillaBirdIsObj(b.mat) ? b.mat : {};
		MCE_BIRD_MATERIALS.forEach(function (m) {
			if (had[m.key]) { mats[m.key] = mat[m.key]; return; }
			try { delete mats[m.key]; } catch (eD) { void eD; }
		});
		delete sv.mbCE_wrote[key];
		return { ok: true, message: "已还原八种材料到首次写入前的数量" };
	}
	function mbCEVanillaBirdUndoUpg(b, key) {
		var sv = getV();
		if (!sv) { return { ok: false, message: "存档变量不可用" }; }
		if (!mbCEVanillaBirdIsObj(sv.bird)) { return { ok: false, message: "鹰塔数据已不在，无法回退" }; }
		var up = sv.bird.upgrades;
		if (!mbCEVanillaBirdIsObj(up)) { return { ok: false, message: "鹰塔设施结构已不在，无法回退" }; }
		var had = mbCEVanillaBirdIsObj(b.had) ? b.had : {};
		var lvl = mbCEVanillaBirdIsObj(b.lvl) ? b.lvl : {};
		MCE_BIRD_UPGRADES.forEach(function (m) {
			if (had[m.key]) { up[m.key] = lvl[m.key]; return; }
			try { delete up[m.key]; } catch (eU) { void eU; }
		});
		delete sv.mbCE_wrote[key];
		return { ok: true, message: "已还原十二项设施到首次写入前的等级" };
	}
	function mbCEVanillaBirdUndo(id, b, key) {
		if (!b) { return null; }
		if (typeof b !== "object") { return null; }
		if (b.kind === "bird-clean") { return mbCEVanillaBirdUndoClean(b, key); }
		if (b.kind === "bird-materials") { return mbCEVanillaBirdUndoMats(b, key); }
		if (b.kind === "bird-upgrades") { return mbCEVanillaBirdUndoUpg(b, key); }
		return null;
	}

	/* 集中委派：07l 的 mbCEVanillaExtUndo 只调这一个入口，避免每加一类都往 07l 里塞条件（lint 棘轮只减不增） */
	function mbCEVanillaKindUndo(id, b, key) {
		if (typeof mbCEVanillaEconUndo === "function") {
			var r1 = mbCEVanillaEconUndo(id, b, key);
			if (r1) { return r1; }
		}
		if (typeof mbCEVanillaBirdUndo === "function") {
			var r2 = mbCEVanillaBirdUndo(id, b, key);
			if (r2) { return r2; }
		}
		if (typeof mbCEVanillaLeightonUndo === "function") {
			var r3 = mbCEVanillaLeightonUndo(id, b, key);
			if (r3) { return r3; }
		}
		return null;
	}

	/* ---------- ⑫-1 清洁度 ---------- */
	function mbCEVanillaBirdSecClean(sec) {
		var body = mceNewGroup(sec, "清洁度", "原版 gte 100 = 最高档；日结按庇护等级递减");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var bst = mbCEVanillaBirdState();
			if (!bst.has) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没有鹰塔数据（未遇到大鹰），暂无清洁度可写。"));
				return;
			}
			var decay = 10 - bst.shelter;
			mbCEVanillaEconUiKv(body, [
				["当前清洁度", bst.clean],
				["鹰塔状态", bst.state || "未进入"],
				["日结衰减", decay + " / 天（庇护 " + bst.shelter + " 级）"],
				["是否配偶态", bst.syndrome ? "是（清理可到 110）" : "否（原版清理只到 30）"]
			]);
			var inp = mbCEVanillaEconUiNumRow(body, "目标清洁度", "0–110；100 即最高档，110 只有巨鹰配偶态能维持", bst.clean >= 100 ? bst.clean : 100);
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "写入目标值", "按上方数值写入（0–110）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaBirdCleanSet(inp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g, "清洁度写 100", "显示层最高档的稳妥值（不会次日被压）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaBirdCleanSet(100), redraw);
			});
			body.appendChild(mceFoldHint("原版清洁度每天结算会掉「10 - 庇护等级」点，且封顶 100；110 是巨鹰配偶态下清理动作的钳制上限，"
				+ "写 110 能撑到最高档，但次日结算会跌回 100 以下。想长期保持完美干净，优先升级庇护（upgrades.shelter）。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["bird-clean", "回退清洁度"]]);
		};
		redraw();
	}

	/* ---------- ⑫-2 材料堆 ---------- */
	function mbCEVanillaBirdSecMaterials(sec) {
		var body = mceNewGroup(sec, "材料堆", "木材 / 树枝 / 叶子 / 布料 / 潜伏者 / 皮革 / 羽毛 / 亮晶晶杂物");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var bst = mbCEVanillaBirdState();
			if (!bst.has) {
				body.appendChild(el("div", MCE_CLS.hint, "该存档还没有鹰塔数据（未遇到大鹰），暂无材料可写。"));
				return;
			}
			if (!bst.hasMaterials) {
				body.appendChild(el("div", MCE_CLS.hint, "鹰塔材料堆还没建立：先进鹰塔走一段让原版初始化（清洁度可先写，材料等初始化后再来）。"));
			} else {
				MCE_BIRD_MATERIALS.forEach(function (m) {
					mbCEVanillaEconUiKv(body, [["已有 " + m.zh, bst.materials[m.key]]]);
				});
			}
			var inp = mbCEVanillaEconUiNumRow(body, "目标数量", "不足的补到这个数，已超过的不动（只升不降）", MCE_BIRD_TARGET);
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "补足到 100", "八种材料不足 100 的补到 100（幂等，连点不会累加）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaBirdMaterialsFill(100), redraw);
			});
			mbCEVanillaEconUiBtn(g, "按上方数值补足", "按输入框数字补足（0–9999）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaBirdMaterialsFill(inp.value), redraw);
			});
			body.appendChild(mceFoldHint("原版升级与修理的消耗极小：木材 2–3、树枝 3–5、潜伏者 1，"
				+ "补到 100 已远远够用。贵重金属（valuables）是独立子对象，本组不碰。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["bird-materials", "回退八种材料"]]);
		};
		redraw();
	}

	/* ---------- ⑫-3 设施满级 ---------- */
	function mbCEVanillaBirdSecUpgrades(sec) {
		var body = mceNewGroup(sec, "设施满级", "十二项 0/1–5 级；一键写满，只升不降（不动炊具对象）");
		var redraw = function () {
			mbCEVanillaEconUiClear(body);
			var bst = mbCEVanillaBirdState();
			if (!bst.hasUpgrades) {
				body.appendChild(el("div", MCE_CLS.hint, "鹰塔设施表还没建立：先进鹰塔走一段让原版初始化（新档只有空的 bird 壳），再回来点满级。"));
				return;
			}
			for (var i = 0; i < MCE_BIRD_UPGRADES.length; i += 3) {
				var pairs = MCE_BIRD_UPGRADES.slice(i, i + 3).map(function (m) {
					var lv = bst.upgrades[m.key];
					return [m.zh + (lv >= m.max ? "（满级）" : ""), lv + " / " + m.max];
				});
				mbCEVanillaEconUiKv(body, pairs);
			}
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "一键满级", "十二项全部写到原版最高档（已满级的不动）", function () {
				mbCEVanillaEconUiRun(mbCEVanillaBirdUpgradesMax(), redraw);
			});
			body.appendChild(mceFoldHint("上限取自原版建造菜单最后一级：庇护 / 巢 / 火坑 / 炊具 / 晾架 3 级，陷阱 2 级，装饰 5 级（第 5 档是银饰），"
				+ "镜子 / 工具 / 防水布 / 望远镜 / 衣柜是 0/1。这里的「火坑等级」与同名的炊具对象不是一回事，本组只动等级、不碰炊具。"));
			mbCEVanillaEconUiUndoGrid(body, redraw, [["bird-upgrades", "回退全部设施"]]);
		};
		redraw();
	}

	function mbCERenderVanillaBird(pane) {
		var sec = mceNewSec(pane, 12, "鹰塔工地（大鹰塔）",
			"原版鹰塔的清洁度与八种材料直写。清洁度写 100 = 显示最高档；材料「只升不降」补足，避免连点累加成几百。两组各走独立留痕，可分别回退。");
		mbCEVanillaBirdSecClean(sec);
		mbCEVanillaBirdSecMaterials(sec);
		mbCEVanillaBirdSecUpgrades(sec);
	}
