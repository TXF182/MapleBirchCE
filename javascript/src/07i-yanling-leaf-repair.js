	/* 职责：言灵页（07i）枝叶变装续篇 —— 变装项在 setup.clothes 整表重建后的自愈：index 校正 / 模板缺失降级。 */

	/* ============ v2.2.8 持久化修复（实机：变装后只有文字写着枝叶、人物立绘不显示；刷新后更糟） ============
	   原版 <<clothing_data>>（变量静态段）注释实证 "it is run in variables-static every time game is loaded"：
	   每次加载都会 setup.clothes = {} 整表重建 → 本页注入的合成项消失，而存档里 V.worn[slot].index 仍是旧下标。
	   绘制链 genlayer_clothing_main(99323) 读 setup.clothes[slot][index] 得到 undefined → setupObj.variable 处
	   TypeError → 整层立绘不画（玩家看到的「文本有、人没有」）。修法：进段时重注入并把所有引用项的 index 校正。 */
	/* 某槽里 leaf 项的真实下标：优先按注入实例身份，其次按 name+modder 双键 */
	function mbCEYanlingLeafSameLeaf(it, item) {
		if (!it || !item) { return false; }
		return it.name === item.name && it.modder === "MapleBirchCE";
	}
	function mbCEYanlingLeafFindIndex(slot, item, made) {
		var s = mbCEYanlingSetupObj();
		if (!s || !Array.isArray(s.clothes[slot])) { return -1; }
		var i, it;
		for (i = 0; i < s.clothes[slot].length; i++) {
			it = s.clothes[slot][i];
			if (made && (made.up === it || made.lo === it)) { return i; }
			if (mbCEYanlingLeafSameLeaf(it, item)) { return i; }
		}
		return -1;
	}
	/* 对齐单个 leaf 项（index + modder）；返回是否改动 */
	function mbCEYanlingLeafFixOne(slot, item, made) {
		if (!item || typeof item !== "object") { return false; }
		if (item.name !== MB_CE_LEAF_UP && item.name !== MB_CE_LEAF_LO) { return false; }
		var idx = mbCEYanlingLeafFindIndex(slot, item, made);
		if (idx < 0) { return false; }
		var changed = false;
		if (item.index !== idx) { item.index = idx; changed = true; }
		if (item.modder !== "MapleBirchCE") { item.modder = "MapleBirchCE"; changed = true; }
		return changed;
	}
	/* 全量对齐：worn（参与立绘）+ carried + 主衣柜 + 多衣柜 */
	function mbCEYanlingLeafLists(V) {
		var lists = [];
		if (V.worn) { lists.push(V.worn); }
		if (V.carried) { lists.push(V.carried); }
		if (V.wardrobe) { lists.push(V.wardrobe); }
		var keys = (V.wardrobes && typeof V.wardrobes === "object") ? Object.keys(V.wardrobes) : [];
		var k;
		for (k = 0; k < keys.length; k++) {
			if (V.wardrobes[keys[k]]) { lists.push(V.wardrobes[keys[k]]); }
		}
		return lists;
	}
	/* 一个容器：worn/carried 每槽是单项，衣柜每槽是数组 */
	function mbCEYanlingLeafFixList(L, made) {
		var n = 0, k, j, slot, arr;
		for (k = 0; k < MB_CE_LEAF_SLOTS.length; k++) {
			slot = MB_CE_LEAF_SLOTS[k];
			arr = L[slot];
			if (Array.isArray(arr)) {
				for (j = 0; j < arr.length; j++) { if (mbCEYanlingLeafFixOne(slot, arr[j], made)) { n++; } }
				continue;
			}
			if (arr && mbCEYanlingLeafFixOne(slot, arr, made)) { n++; }
		}
		return n;
	}
	function mbCEYanlingLeafFixRefs(V, made) {
		var lists = mbCEYanlingLeafLists(V), n = 0, i;
		for (i = 0; i < lists.length; i++) { n += mbCEYanlingLeafFixList(lists[i], made); }
		return n;
	}
	/* 模板缺失时降级：worn 里的枝叶项退回裸装（衣柜副本不参与绘制，保留） */
	function mbCEYanlingLeafFallback(V) {
		var n = 0, i, slot, it, nk;
		for (i = 0; i < MB_CE_LEAF_SLOTS.length; i++) {
			slot = MB_CE_LEAF_SLOTS[i];
			it = V.worn ? V.worn[slot] : null;
			if (!it || (it.name !== MB_CE_LEAF_UP && it.name !== MB_CE_LEAF_LO)) { continue; }
			nk = mbCEYanlingNakedItem(slot);
			if (nk) { V.worn[slot] = nk; n++; }
		}
		return n;
	}
	function mbCEYanlingLeafRepair() {
		try {
			var V = getV();
			if (!V || !V.worn) { return { ok: false, msg: "存档变量不可用" }; }
			var made = mbCEYanlingLeafEnsure();
			if (!made) {
				var fb = mbCEYanlingLeafFallback(V);
				return { ok: false, msg: "服装表缺少植物系模板（plant top / plant skirt），无法合成枝叶装；已把 " + fb + " 处残留枝叶装退回裸装，避免立绘读取越界下标报错" };
			}
			var n = mbCEYanlingLeafFixRefs(V, made);
			return { ok: true, msg: "枝叶装已就绪" + (n ? "（校正 " + n + " 处引用）" : "") };
		} catch (e) { return { ok: false, msg: "枝叶装校正异常：" + mbCEYanlingErr(e) }; }
	}
	/* 进段钩子：只在真的用过枝叶变装时才跑（不为没碰过本功能的存档往 setup 里加东西） */
	function mbCEYanlingLeafRepairTick() {
		try {
			var V = getV();
			if (!V || !V.worn) { return; }
			var st = V.mbCE_yanling;
			var wearing = (V.worn.upper && V.worn.upper.name === MB_CE_LEAF_UP) || (V.worn.lower && V.worn.lower.name === MB_CE_LEAF_LO);
			if (!wearing && !(st && st.leaf)) { return; }
			mbCEYanlingLeafRepair();
		} catch (e) { void e; }
	}
