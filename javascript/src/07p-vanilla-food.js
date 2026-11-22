/* 职责：原版「食物库存 / 鱼获」直写（全局页 ⑬，vcore 留痕；回退挂 07m 的 MB_CE_ECON_UNDO["food"]）。

   原版事实（DoL 0.5.12.13 单文件 HTML 实证，勿凭印象改口径）：
   - setup.foodstuff 每键 { index, name, singular, plural, icon, category, kitchen_item_type_icon, prop_folder, ... }；
     category 实测含 seafood（12 种鱼）/ produce / mushroom / flower / dish 等。
   - 钓上来的鱼直接进 V.foodstuff[<fishKey>].amount —— 原版判断 `$foodstuff[...]?.amount gte 1`，
     所以「食物」与「钓鱼获取」是同一个系统，没有第二个鱼获仓库。
   - 原版没有食材数量上限：全库 foodstuff 相关的 (cap|max|limit) 命中只有 CSS class "cap"，
     写入只有 `amount +=`（6 处局部变量写法）。因此社区要的「食物材料上限」正确落点是
     「直接设定数量」，不存在需要解除的 cap —— 本区块不提供无效的「解除上限」开关。
   - V.foodstuff[key] 不存在时补 { amount: 0 }；带 recipe 的（料理）另补 knows_recipe:false，
     原版对 dish 读该字段（食材类不读）。
   - 不写 V.fishing.record：图鉴的 numCaught / largest 会触发原版成就（Wet Rod / Master Baiter），作弊不碰成就。
   - amount 归一为 0–999999 的整数；越界 / 非数一律拒绝，不静默截断。
*/

	var MCE_FOOD_CAT_ZH = {
		seafood: "鱼获 / 海鲜", produce: "农产", mushroom: "蘑菇", flower: "花卉",
		dish: "料理", ingredient: "食材", sweet: "甜点", drink: "饮品", meat: "肉"
	};
	/* 只收录已实证的中文名（12 鱼 + 下面四项），其余回退 setup.foodstuff[key].name（原版英文名），不臆造译名 */
	var MCE_FOOD_ZH = {
		haddock: "黑线鳕", salmon: "鲑鱼", trout: "鳟鱼", herring: "鲱鱼", whiting: "牙鳕", mackerel: "鲭鱼",
		flounder: "比目鱼", bass: "鲈鱼", roach: "欧鳊", perch: "河鲈", chub: "白鲑", grayling: "茴鱼",
		truffle: "松露", bottle_of_milk: "牛奶", chicken_egg: "鸡蛋", bottle_of_breast_milk: "母乳瓶"
	};
	var MCE_FOOD_FISH = ["haddock", "salmon", "trout", "herring", "whiting", "mackerel",
		"flounder", "bass", "roach", "perch", "chub", "grayling"];

	/* ---------- 数据层 ---------- */
	function mbCEFoodSetup() {
		try { return (typeof setup !== "undefined" && setup && setup.foodstuff) ? setup.foodstuff : null; } catch (e) { return null; }
	}
	function mbCEFoodKeys() {
		var s = mbCEFoodSetup();
		if (!s) { return []; }
		try { return Object.keys(s); } catch (e) { return []; }
	}
	function mbCEFoodDef(key) {
		var s = mbCEFoodSetup();
		return (s && Object.prototype.hasOwnProperty.call(s, key)) ? s[key] : null;
	}
	function mbCEFoodZh(key) {
		if (MCE_FOOD_ZH[key]) { return MCE_FOOD_ZH[key]; }
		var d = mbCEFoodDef(key);
		return (d && d.name) ? String(d.name) : String(key);
	}
	function mbCEFoodCatOf(key) {
		var d = mbCEFoodDef(key);
		return (d && d.category) ? String(d.category) : "";
	}
	function mbCEFoodIsFish(key) { return MCE_FOOD_FISH.indexOf(key) !== -1 || mbCEFoodCatOf(key) === "seafood"; }
	function mbCEFoodFishKeys() {
		var out = [];
		mbCEFoodKeys().forEach(function (k) { if (mbCEFoodIsFish(k)) { out.push(k); } });
		return out;
	}
	function mbCEFoodHas(key) {
		var V = getV();
		return !!(V && V.foodstuff && typeof V.foodstuff === "object"
			&& V.foodstuff[key] && typeof V.foodstuff[key] === "object");
	}
	function mbCEFoodAmount(key) {
		var V = getV();
		if (!V || !V.foodstuff || typeof V.foodstuff !== "object") { return 0; }
		var it = V.foodstuff[key];
		return (it && typeof it.amount === "number" && isFinite(it.amount)) ? it.amount : 0;
	}
	function mbCEFoodNum(raw, min, max) {
		var s = (raw === undefined || raw === null || raw === "") ? "" : String(raw).trim();
		if (!s) { return null; }
		var n = Number(s);
		if (!isFinite(n) || Math.floor(n) !== n) { return null; }
		if (n < min || n > max) { return null; }
		return n;
	}
	function mbCEFoodEnsure(V, key) {
		if (!V.foodstuff || typeof V.foodstuff !== "object") { V.foodstuff = {}; }
		var it = V.foodstuff[key];
		if (!it || typeof it !== "object") {
			it = { amount: 0 };
			if (mbCEFoodDef(key) && mbCEFoodDef(key).recipe) { it.knows_recipe = false; }
			V.foodstuff[key] = it;
		}
		return it;
	}
	/* 首次写入前快照：amounts 记数值、exists 记对象是否存在（回退时区分「删除」与「还原」） */
	function mbCEFoodSnap(keys) {
		var before = { kind: "food", amounts: {}, exists: {} };
		keys.forEach(function (k) { before.exists[k] = mbCEFoodHas(k); before.amounts[k] = mbCEFoodAmount(k); });
		return before;
	}

	function mbCEFoodSet(key, raw) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		if (!mbCEFoodDef(key)) { return { ok: false, message: "未知食物：" + String(key) + "（不在 setup.foodstuff 里）" }; }
		var n = mbCEFoodNum(raw, 0, 999999);
		if (n === null) { return { ok: false, message: "数量必须是 0–999999 的整数" }; }
		mbCEVanillaTrace("food-" + key, mbCEFoodSnap([key]), "foodstuff." + key + ".amount",
			"食物库存直写（" + mbCEFoodZh(key) + "）", "vcore");
		mbCEFoodEnsure(V, key).amount = n;
		return { ok: true, message: mbCEFoodZh(key) + " 库存 → " + n, id: "food-" + key };
	}
	function mbCEFoodAddList(keys, add, id, text) {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }
		var list = (keys || []).filter(function (k) { return !!mbCEFoodDef(k); });
		if (!list.length) { return { ok: false, message: "没有可写入的食物项（setup.foodstuff 不含这些键）" }; }
		var step = Number(add);
		if (!isFinite(step) || Math.floor(step) !== step) { return { ok: false, message: "批量增量必须是整数" }; }
		mbCEVanillaTrace(id, mbCEFoodSnap(list), "foodstuff.*.amount", text, "vcore");
		list.forEach(function (k) {
			var it = mbCEFoodEnsure(V, k);
			var cur = (typeof it.amount === "number" && isFinite(it.amount)) ? it.amount : 0;
			var next = cur + step;
			it.amount = next < 0 ? 0 : (next > 999999 ? 999999 : next);
		});
		return { ok: true, message: text + "（" + list.length + " 项）", id: id };
	}
	function mbCEFoodAddFish(add) {
		var ks = mbCEFoodFishKeys();
		return mbCEFoodAddList(ks, add, "food-fish", ks.length + " 种鱼获各 " + (add >= 0 ? "+" : "") + add);
	}
	function mbCEFoodAddAll(add) { return mbCEFoodAddList(mbCEFoodKeys(), add, "food-all", "全部食物各 " + (add >= 0 ? "+" : "") + add); }

	/* 回退处理器：统一回退中心 → 08c vcore 分支 → mbCEVanillaExtUndo → mbCEVanillaEconUndo → 这里 */
	function mbCEFoodUndoKind(V, b, key) {
		if (!V.foodstuff || typeof V.foodstuff !== "object") { return { ok: false, message: "食物数据已不在，无法回退" }; }
		var amounts = b.amounts || {}, exists = b.exists || {}, n = 0;
		Object.keys(amounts).forEach(function (k) {
			if (exists[k] === false) {
				try { delete V.foodstuff[k]; } catch (eD) { void eD; }
			} else {
				var it = V.foodstuff[k];
				if (!it || typeof it !== "object") { it = { amount: 0 }; V.foodstuff[k] = it; }
				it.amount = Number(amounts[k]) || 0;
			}
			n += 1;
		});
		delete V.mbCE_wrote[key];
		return { ok: true, message: "已还原 " + n + " 项食物库存" };
	}
	/* 注册到 07m 的 kind 表（字面量对象的类型没有 food 键，用索引表断言避免 tsc 债务） */
	var MCE_FOOD_UNDO_REG = /** @type {Object<string, any>} */ (MB_CE_ECON_UNDO);
	if (MCE_FOOD_UNDO_REG) { MCE_FOOD_UNDO_REG.food = mbCEFoodUndoKind; }

	/* ---------- 视图层 ---------- */
	function mbCEFoodStats() {
		var keys = mbCEFoodKeys(), fish = 0, fishN = 0, other = 0;
		keys.forEach(function (k) {
			var a = mbCEFoodAmount(k);
			if (mbCEFoodIsFish(k)) { fish += a; if (a > 0) { fishN += 1; } } else { other += a; }
		});
		return { keys: keys.length, fishAll: mbCEFoodFishKeys().length, fishKeys: fishN, fishTotal: fish, otherTotal: other };
	}
	function mbCEFoodRun(res, redraw) {
		setStatus(res.message, res.ok ? MCE_CLS.ok : MCE_CLS.err);
		if (res.ok) { redraw(); }
	}
	function mbCEFoodSecOverview(sec) {
		var body = mceNewGroup(sec, "库存总览与批量", "全部数据来自原版 setup.foodstuff；未收录的键不会出现在这里");
		var redraw = function () {
			while (body.firstChild) { body.removeChild(body.firstChild); }
			var st = mbCEFoodStats();
			var kv = el("div", "mce-statrow");
			[["鱼获总量", st.fishTotal + " 份"], ["已解锁鱼种", st.fishKeys + " / " + st.fishAll],
				["食物种类", st.keys + " 种"], ["其余食材总量", st.otherTotal + " 份"]].forEach(function (p, i) {
				if (i) { kv.appendChild(el("span", "mce-kv-sep", "｜")); }
				kv.appendChild(el("span", MCE_CLS.rowLbl, p[0]));
				kv.appendChild(el("span", "mce-value", p[1]));
			});
			body.appendChild(kv);
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "鱼获 +10", "12 种鱼各 +10（等价钓到 10 条，直接进原版食物库存）", function () {
				mbCEFoodRun(mbCEFoodAddFish(10), redraw);
			});
			mbCEVanillaEconUiBtn(g, "鱼获 +100", "12 种鱼各 +100", function () {
				mbCEFoodRun(mbCEFoodAddFish(100), redraw);
			});
			mbCEVanillaEconUiBtn(g, "全部食物 +50", "含鱼、农产、蘑菇、花卉、料理全部 +50", function () {
				mbCEFoodRun(mbCEFoodAddAll(50), redraw);
			});
			body.appendChild(mceFoldHint("原版没有食物数量上限：源码里 foodstuff 相关的 cap / max / limit 命中只有 CSS 类名 \"cap\"，"
				+ "所有写入都是 amount +=。所以社区问的「食物材料上限」不需要解除开关——直接在这里写数量就能超过任何获取节奏。"
				+ "钓到的鱼正是写进同一个 $foodstuff，两类需求是同一处落点。"));
		};
		redraw();
	}
	function mbCEFoodGroups() {
		var groups = [], map = {};
		mbCEFoodKeys().forEach(function (k) {
			var cat = mbCEFoodCatOf(k) || "other";
			if (!map[cat]) { map[cat] = { grp: MCE_FOOD_CAT_ZH[cat] || ("其他（" + cat + "）"), items: [] }; groups.push(map[cat]); }
			map[cat].items.push([k, mbCEFoodZh(k)]);
		});
		return groups;
	}
	function mbCEFoodSecEdit(sec) {
		var body = mceNewGroup(sec, "单项设定", "按原版分类分组；数量 0–999999 的整数");
		var redraw = function () {
			while (body.firstChild) { body.removeChild(body.firstChild); }
			var sel = mbCEVanillaEconUiSelectGrouped(body, "选择食物", mbCEFoodGroups(), "按 setup.foodstuff 的 category 分组");
			var inp = mbCEVanillaEconUiNumRow(body, "数量", "0–999999；原版无上限", mbCEFoodAmount(sel.value));
			sel.addEventListener("change", function () { inp.value = String(mbCEFoodAmount(sel.value)); });
			var g = mceBtnGrid(body);
			mbCEVanillaEconUiBtn(g, "设为该数量", "把选中的食物库存写成上方数值", function () {
				mbCEFoodRun(mbCEFoodSet(sel.value, inp.value), redraw);
			});
			mbCEVanillaEconUiBtn(g, "+99", "在当前库存基础上 +99", function () {
				mbCEFoodRun(mbCEFoodSet(sel.value, mbCEFoodAmount(sel.value) + 99), redraw);
			});
			mbCEVanillaEconUiBtn(g, "归零", "把选中的食物库存清 0（留痕可回退）", function () {
				mbCEFoodRun(mbCEFoodSet(sel.value, 0), redraw);
			});
			body.appendChild(el("div", MCE_CLS.hint, "当前选中：" + mbCEFoodZh(sel.value) + " = " + mbCEFoodAmount(sel.value) + " 份"));
		};
		redraw();
	}
	function mbCEFoodSecUndo(sec) {
		var body = mceNewGroup(sec, "回退", "只还原本区块写过的库存，图鉴与成就一律不动");
		var redraw = function () {
			while (body.firstChild) { body.removeChild(body.firstChild); }
			var ids = [];
			try {
				var V = getV(), w = (V && V.mbCE_wrote) || {};
				Object.keys(w).forEach(function (k) { if (k.indexOf("vcore:food-") === 0) { ids.push(k.slice(6)); } });
			} catch (e) { void e; }
			if (!ids.length) { body.appendChild(el("div", MCE_CLS.hint, "本区块还没有写入记录。")); return; }
			var items = ids.slice(0, 8).map(function (id) { return [id, "回退 " + id.replace(/^food-/, "")]; });
			mbCEVanillaEconUiUndoGrid(body, redraw, items);
			if (ids.length > 8) { body.appendChild(el("div", MCE_CLS.hint, "另有 " + (ids.length - 8) + " 条较早的留痕，可在「统一回退中心」按条回退。")); }
		};
		redraw();
	}
	function mbCERenderVanillaFood(pane) {
		if (!pane) { return; }
		var sec = mceNewSec(pane, 0, "食物与鱼获（原版库存）",
			"钓上来的鱼、农场收获、商店食材都在同一处（$foodstuff）；原版没有数量上限，这里直接写数量。");
		if (!mbCEFoodKeys().length) {
			sec.appendChild(el("div", MCE_CLS.hint, "未检测到 setup.foodstuff（游戏尚未就绪，或该版本没有食物系统）。"));
			return;
		}
		mbCEFoodSecOverview(sec);
		mbCEFoodSecEdit(sec);
		mbCEFoodSecUndo(sec);
	}
