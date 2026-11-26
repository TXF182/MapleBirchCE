	/* 职责：言灵页（07i）枝叶变装 —— 当前上/下装换成 leaf shirt + leaf skirt，被替换的衣物进衣柜，可一键还原。 */
	/* ============ 枝叶变装（玩家诉求：衣柜里没有枝叶上衣和裙子、没得卖、枝叶衣服没法进柜子） ============
	   原版取证（DoL 0.5.12.13，字符偏移可复跑，全 64,515,269 字符 HTML 逐字节扫描）：
	     · leaf shirt @19019946 定义 { name: "leaf shirt", integrity_max: 100, word: "a", action: "pull" }
	       同块另有 leaf corset @19020040 / pine top / plant top / sundress
	     · leaf skirt @19028864 定义 { name: "leaf skirt", integrity_max: 100, word: "a", action: "lift" }
	       同块另有 evergreen dress / plant skirt / kimono bottoms
	     · 这两件在原版是植物人 NPC 的 outfit 部件，分配走
	       npcAssignClothesToSet("leaf shirt", "lotus skirt") @19048603、
	       npcAssignClothesToSet("leaf corset", "leaf skirt") @19048771，
	     **玩家侧没有任何售卖渠道** → 衣柜/商店永远取不到，这是玩家三句抱怨的共同成因。
	     · setup.wardrobeSkip @19938481 = ["naked","towel top","large towel","towel skirt",
	       "large towel bottom","plant skirt","plant top"] —— **不含 leaf shirt / leaf skirt**。
	       所以「枝叶衣服没法进柜子」的成因不是被跳过名单挡住（被挡的是 plant top / plant skirt，不是 leaf），
	       而是根本没有获取途径。入柜判据沿用原版 `if (!setup.wardrobeSkip.includes(name)) push(...)`，不自己发明规则。
	     · V.wardrobe 在 clothingArrays() @19004551 对全部 setup.clothes_all_slots（@19003398，15 槽）初始化：
	       V.wardrobe = { space: 20 } 之后 forEach 写 V.wardrobe[slot] = [] → **槽数组必然已存在**。
	     · 衣柜选择走 window.selectWardrobe()（@16556351 定义，末尾 window.selectWardrobe = selectWardrobe）：
	       关闭 multipleWardrobes 时直接返回 V.wardrobe，开启时返回 V.wardrobes[V.wardrobe_location]。
	     · clothesDataTrimmer @16559186 是**固定白名单删除**（只删 name_cap / iconFile / cost 等已知键），
	       不清自定义字段 → 本页 mbCE_leafStored / mbCE_leafCopy 标记能在存档里长期存活。
	     · 装备槽语义：V.worn[slot] 是对象，裸装 = clone(setup.clothes[slot][0])（@19006097 givestartclothing），
	       换装必须深拷贝，不能把 setup 原型对象直接挂到存档上。
	   设计（对应用户给的方案：替换的衣服进衣柜，回退把替换掉的衣服换回来）：
	     1) 变装：把 4 个躯干槽（over_upper / over_lower / upper / lower）原有的非 naked 衣物
	        **逐件复制一份进衣柜**（带 mbCE_leafStored 标记，回退时按标记 + 同名回收），
	        然后上装槽写 leaf shirt、下装槽写 leaf skirt，其余槽置 naked。
	        —— 外套层必须一起收：只换 upper/lower 时玩家穿着外套会完全看不见枝叶，只会再报一次「没效果」。
	        —— 顺手把枝叶本体也放一份进衣柜（带 mbCE_leafCopy 标记，按 name 防重复），
	           以后不点本按钮也能从衣柜面板自由再穿，正面回应「枝叶衣服没法进柜子」。
	     2) 回退：按 V.mbCE_yanling.leaf.slots 记录把 4 槽还原（原为 naked 的槽置回 naked），
	        并从衣柜回收带 mbCE_leafStored 的同名项；枝叶副本保留（玩家本来就想要它）。
	     3) 留痕：两段动作写 V.mbCE_wrote["yanling:leaf_suit" / "yanling:leaf_revert"]，
	        before/after 只存名字摘要（不塞整件衣物对象，避免留痕区被撑爆）。
	   边界：诅咒衣物（cursed is 1）拒绝变装 —— 直写 V.worn 会绕过 generalUndress 的 $_cursedPrevent 保护。 */

	var MB_CE_LEAF_UP = "leaf shirt";
	var MB_CE_LEAF_LO = "leaf skirt";
	var MB_CE_LEAF_SLOTS = ["over_upper", "over_lower", "upper", "lower"];

	/* 原版 setup：SugarCube 的 setup 在同一编译域可见，同时挂在 window 兜底 */
	function mbCEYanlingSetupObj() {
		try {
			if (typeof setup !== "undefined" && setup && setup.clothes) { return setup; }
		} catch (e) { void e; }
		try {
			if (typeof window !== "undefined" && window.setup && window.setup.clothes) { return window.setup; }
		} catch (e2) { void e2; }
		return null;
	}

	/* 深拷贝：优先 SugarCube 的 clone（原版换装一律用它），退回 JSON 往返 */
	function mbCEYanlingDeep(obj) {
		if (!obj || typeof obj !== "object") { return null; }
		try {
			if (typeof clone === "function") { return clone(obj); }
		} catch (e) { void e; }
		try {
			if (typeof window !== "undefined" && typeof window.clone === "function") { return window.clone(obj); }
		} catch (e2) { void e2; }
		try { return JSON.parse(JSON.stringify(obj)); } catch (e3) { void e3; }
		return null;
	}

	/* 按 name 在 setup.clothes 全槽数组里找（不靠偏移猜槽位，leaf 归属按数组 find 才稳） */
	function mbCEYanlingClothFind(name) {
		var s = mbCEYanlingSetupObj();
		if (!s || !s.clothes) { return null; }
		var slots = Array.isArray(s.clothes_all_slots) ? s.clothes_all_slots : Object.keys(s.clothes);
		var i, j, arr;
		for (i = 0; i < slots.length; i++) {
			arr = s.clothes[slots[i]];
			if (!Array.isArray(arr)) { continue; }
			for (j = 0; j < arr.length; j++) {
				if (arr[j] && arr[j].name === name) { return { slot: slots[i], item: arr[j] }; }
			}
		}
		return null;
	}

	/* ============ 关键修正（v2.1.8 复核发现）：玩家衣物表里根本没有 leaf shirt / leaf skirt ============
	   原版取证：全 64,515,269 字符 HTML 里 "leaf shirt" / "leaf skirt" 各只有 3 处 ——
	     ① T.npcClothesItems.upper / .lower 定义（initNpcClothes，字段仅 name + integrity_max + word + action）
	     ② npcAssignClothesToSet("leaf shirt","lotus skirt") / ("leaf corset","leaf skirt") 给植物人 NPC 套装。
	   setup.clothes（玩家表，clothingDataInit 用 initUpper/initLower 的 new ClothesItem({...}) 构建）
	   **一件都没有**。所以不能"在 setup.clothes 里按 name 找 leaf"，那条路在真实环境恒返回 null
	   （第一版测试用 mock 把 leaf 直接塞进 setup.clothes，属于测试路径≠实机路径的假绿）。
	   为什么必须真注入、不能只写 V.worn：clothesIndex(slot, item)（@16566855）按
	     item.variable === itemToIndex.variable && item.modder === itemToIndex.modder 匹配；
	   leaf 在 NPC 表里连 variable 都没有 → 写入 worn 后 clothesIndex 走 Errors.report 并 return 0，
	   原版大量 `setup.clothes.slot[clothesIndex(...)].xxx` 读到裸装项，表现就是「点了没效果」。
	   做法：借用同为植物系的 plant top（upper）/ plant skirt（lower）当字段模板（type/state/reveal/
	   combat/integrity 语义最贴合枝叶），clone 后只改 name / name_cap / variable / index，push 进 setup.clothes。
	   · variable 必须唯一（leafshirt / leafskirt），否则 clothesIndex 与 plant 系撞车；
	   · index 必须等于 push 后的数组下标（clothingDataInit 的断言口径，虽然只在初始化跑一次）；
	   · 幂等：已存在直接复用，绝不重复 push（重复会派生两份同名项、衣柜出现重影）；
	   · 只改内存 setup（Setup 每局重建，不进存档、不进 V）→ 每次加载重跑一次即恢复。 */
	/* 严格只借同一槽里的植物系原件（plant top / plant skirt，原版 @18705737 / @18214396 必备），
	   借不到就失败并给出明确提示——不拿别的衣物凑字段（那会带出错误的 type/state 语义）。 */
	function mbCEYanlingLeafTemplate(slot, preferred) {
		var hit = mbCEYanlingClothFind(preferred);
		return (hit && hit.slot === slot) ? hit.item : null;
	}

	function mbCEYanlingLeafInject(slot, name, variableIgnore, preferred) {
		var s = mbCEYanlingSetupObj();
		if (!s || !s.clothes || !Array.isArray(s.clothes[slot])) { return null; }
		var hit = mbCEYanlingClothFind(name);
		if (hit) { return hit.item; }
		var tpl = mbCEYanlingLeafTemplate(slot, preferred);
		if (!tpl) { return null; }
		var item = mbCEYanlingDeep(tpl);
		if (!item) { return null; }
		item.name = name;
		item.name_cap = name.charAt(0).toUpperCase() + name.slice(1);
		/* v2.2.8 立绘修复（原版 HTML 实证）：
		   genlayer_clothing_breasts(99546) / clothing_main(99323) 的图路径 = img/clothes/<slot>/<setup.variable>/<图>.png，
		   DoL 官方没有 leafshirt/leafskirt 目录（全 game 目录 *leaf* 命中 0），自带 variable 必然 404 → 只剩文字穿在身上。
		   故 variable 保留模板的 plant（upper 有 0.png/3.png、lower 有 frayed/full/tattered/torn.png），立绘立刻可见；
		   modder 打成唯一标记，保证 clothesIndex(66895) 的 variable+modder 双键匹配不与植物装原件撞车。 */
		item.variable = String((tpl && tpl.variable) || item.variable || "plant");
		item.modder = "MapleBirchCE";
		item.index = s.clothes[slot].length;
		item.mbCE_leafSynth = 1;
		s.clothes[slot].push(item);
		return item;
	}

	/* 幂等补齐两件（找不到模板就返回 null，让上层给出明确提示而不是硬塞半成品） */
	function mbCEYanlingLeafEnsure() {
		var up = mbCEYanlingLeafInject("upper", MB_CE_LEAF_UP, "leafshirt", "plant top");
		var lo = mbCEYanlingLeafInject("lower", MB_CE_LEAF_LO, "leafskirt", "plant skirt");
		return (up && lo) ? { up: up, lo: lo } : null;
	}

	/* 先查、查不到再注入：所有取件入口统一走这里 */
	function mbCEYanlingLeafCloth(name) {
		var hit = mbCEYanlingClothFind(name);
		if (hit) { return hit; }
		mbCEYanlingLeafEnsure();
		return mbCEYanlingClothFind(name);
	}


	/* 某槽的原版裸装实例（setup.clothes[slot][0]，clothingArrays 即用它初始化） */
	function mbCEYanlingNakedItem(slot) {
		var s = mbCEYanlingSetupObj();
		try {
			if (s && Array.isArray(s.clothes[slot]) && s.clothes[slot][0]) { return mbCEYanlingDeep(s.clothes[slot][0]); }
		} catch (e) { void e; }
		return null;
	}

	/* 当前生效的衣柜（跟随 $wardrobe_location；multipleWardrobes 关闭时就是 V.wardrobe） */
	function mbCEYanlingWardrobePick(V) {
		try {
			if (typeof window !== "undefined" && typeof window.selectWardrobe === "function") {
				var w = window.selectWardrobe();
				if (w && typeof w === "object") { return w; }
			}
		} catch (e) { void e; }
		if (V && V.wardrobe && typeof V.wardrobe === "object") { return V.wardrobe; }
		return null;
	}

	/* 取衣柜某槽数组；原版 guaranteed 已建（clothingArrays），这里只做防御 */
	function mbCEYanlingWardrobeSlot(w, slot) {
		if (!w || typeof w !== "object") { return null; }
		if (!Array.isArray(w[slot])) { w[slot] = []; }
		return w[slot];
	}

	/* 原版入柜判据：setup.wardrobeSkip 命中则不入柜（与 generalUndress 同口径） */
	function mbCEYanlingWardrobeSkip(name) {
		var s = mbCEYanlingSetupObj();
		try {
			if (s && Array.isArray(s.wardrobeSkip)) { return s.wardrobeSkip.indexOf(name) !== -1; }
		} catch (e) { void e; }
		return false;
	}

	/* 变装：4 躯干槽原衣入柜 → 上/下装换 leaf → 其余槽置 naked → 枝叶副本入柜 */
	function mbCEYanlingLeafSuit() {
		try {
			var V = getV();
			if (!V || !V.worn || typeof V.worn !== "object") { return { ok: false, msg: "存档变量不可用" }; }
			var st = mbCEYanlingState();
			if (!st) { return { ok: false, msg: "存档变量不可用" }; }
			if (st.leaf && typeof st.leaf === "object") {
				return { ok: false, msg: "已经变装过一次；请先点「还原：换回原服装」再重复操作（避免衣柜里堆出多份原衣）" };
			}
			var up = mbCEYanlingLeafCloth(MB_CE_LEAF_UP);
			var lo = mbCEYanlingLeafCloth(MB_CE_LEAF_LO);
			if (!up || !lo) { return { ok: false, msg: "服装表缺少可用的植物系模板（plant top / plant skirt），无法合成 " + MB_CE_LEAF_UP + " / " + MB_CE_LEAF_LO + "；请确认游戏版本与 setup.clothes 已初始化" }; }
			var w = mbCEYanlingWardrobePick(V);
			if (!w) { return { ok: false, msg: "衣柜对象不可用（$wardrobe 未初始化）" }; }
			/* v2.2.8：原衣与枝叶副本统一写主衣柜 V.wardrobe —— 玩家开多衣柜时 selectWardrobe 返回的是当前地点的
			   专属衣柜，写进去在主衣柜面板看不到，正是「变装了但衣柜里什么都没有」的成因之一 */
			if (V.wardrobe && typeof V.wardrobe === "object") { w = V.wardrobe; }
			var backup = {}, stored = [], beforeNames = {};
			var i, slot, cur, nm, save, put, arr;
			/* 1) 先记录 + 入柜（含即将被替换的 upper / lower 原衣） */
			for (i = 0; i < MB_CE_LEAF_SLOTS.length; i++) {
				slot = MB_CE_LEAF_SLOTS[i];
				cur = V.worn[slot];
				if (!cur || typeof cur !== "object") { backup[slot] = null; continue; }
				nm = cur.name || "";
				if (cur.cursed === 1) {
					return { ok: false, msg: "当前 " + slot + " 穿着诅咒衣物（" + nm + "），原版禁止脱下；请先处理诅咒再变装" };
				}
				if (nm === "naked" || !nm) { backup[slot] = null; continue; }
				save = mbCEYanlingDeep(cur);
				if (!save) { return { ok: false, msg: "衣物复制失败（" + slot + "：" + nm + "）" }; }
				backup[slot] = save;
				beforeNames[slot] = nm;
				if (mbCEYanlingWardrobeSkip(nm)) { continue; }
				arr = mbCEYanlingWardrobeSlot(w, slot);
				if (!arr) { continue; }
				put = mbCEYanlingDeep(cur);
				if (!put) { continue; }
				put.mbCE_leafStored = 1;
				arr.push(put);
				stored.push(slot + ":" + nm);
			}
			/* 2) 换上身 */
			var newUp = mbCEYanlingDeep(up.item), newLo = mbCEYanlingDeep(lo.item);
			if (!newUp || !newLo) { return { ok: false, msg: "枝叶服装复制失败" }; }
			V.worn[up.slot] = newUp;
			V.worn[lo.slot] = newLo;
			/* 3) 其余躯干槽置 naked（外套层不收会把枝叶完全遮住，玩家会再报「没效果」） */
			var nk;
			for (i = 0; i < MB_CE_LEAF_SLOTS.length; i++) {
				slot = MB_CE_LEAF_SLOTS[i];
				if (slot === up.slot || slot === lo.slot) { continue; }
				nk = mbCEYanlingNakedItem(slot);
				if (nk) { V.worn[slot] = nk; }
			}
			/* 4) 枝叶本体也放一份进衣柜（按 name 防重复，回退不回收） */
			var copied = [], cUpArr, cLoArr, hasUp, hasLo, c1, c2;
			cUpArr = mbCEYanlingWardrobeSlot(w, up.slot);
			if (cUpArr) {
				hasUp = false;
				for (i = 0; i < cUpArr.length; i++) { if (cUpArr[i] && cUpArr[i].name === MB_CE_LEAF_UP) { hasUp = true; break; } }
				if (!hasUp && !mbCEYanlingWardrobeSkip(MB_CE_LEAF_UP)) {
					c1 = mbCEYanlingDeep(up.item);
					if (c1) { c1.mbCE_leafCopy = 1; cUpArr.push(c1); copied.push(MB_CE_LEAF_UP); }
				}
			}
			cLoArr = mbCEYanlingWardrobeSlot(w, lo.slot);
			if (cLoArr) {
				hasLo = false;
				for (i = 0; i < cLoArr.length; i++) { if (cLoArr[i] && cLoArr[i].name === MB_CE_LEAF_LO) { hasLo = true; break; } }
				if (!hasLo && !mbCEYanlingWardrobeSkip(MB_CE_LEAF_LO)) {
					c2 = mbCEYanlingDeep(lo.item);
					if (c2) { c2.mbCE_leafCopy = 1; cLoArr.push(c2); copied.push(MB_CE_LEAF_LO); }
				}
			}
			/* 3.5) 立刻校正 index（setup 若在本会话之前重建过，查到的既有项 index 可能已是旧值 → 立绘读越界不画） */
			mbCEYanlingLeafFixRefs(V, { up: up.item, lo: lo.item });
			/* 5) 记录（回退唯一依据）+ 留痕 */
			st.leaf = { slots: backup, stored: stored, copied: copied, ts: Date.now() };
			mbCEYanlingTrace("leaf_suit", { worn: beforeNames }, { worn: { upper: MB_CE_LEAF_UP, lower: MB_CE_LEAF_LO }, stored: stored.length, copied: copied.length });
			var msg = "已换上枝叶装（" + up.slot + " → " + MB_CE_LEAF_UP + "，" + lo.slot + " → " + MB_CE_LEAF_LO + "）";
			msg += "；原衣 " + stored.length + " 件已进主衣柜";
			msg += copied.length ? "；枝叶本体也已放入主衣柜（以后可直接从衣柜再穿）" : "；主衣柜里已有同名枝叶副本，未重复放入";
			msg += "。立绘在当前画面不会立刻重绘：走动一段、或刷新页面后即可看到枝叶装";
			return { ok: true, msg: msg };
		} catch (e) { return { ok: false, msg: "枝叶变装异常：" + mbCEYanlingErr(e) }; }
	}

	/* 回退：按记录还原 4 槽 + 回收当初入柜的原衣（枝叶副本保留，玩家本来就想拥有它） */
	function mbCEYanlingLeafRevert() {
		try {
			var V = getV();
			if (!V || !V.worn) { return { ok: false, msg: "存档变量不可用" }; }
			var st = mbCEYanlingState();
			if (!st || !st.leaf || typeof st.leaf !== "object") {
				return { ok: false, msg: "没有可回退的变装记录（本档没有用过「枝叶变装」，或已经还原过）" };
			}
			var rec = st.leaf;
			var restored = [], pulled = 0;
			var w = mbCEYanlingWardrobePick(V);
			var i, j, slot, b, cp, nk, token, p, sl, nm, arr;
			/* 先回收衣柜里的原衣副本（趁玩家还没把它穿走） */
			if (w && Array.isArray(rec.stored)) {
				for (i = 0; i < rec.stored.length; i++) {
					token = String(rec.stored[i]);
					p = token.indexOf(":");
					if (p < 0) { continue; }
					sl = token.substring(0, p);
					nm = token.substring(p + 1);
					arr = Array.isArray(w[sl]) ? w[sl] : null;
					if (!arr) { continue; }
					for (j = arr.length - 1; j >= 0; j--) {
						if (arr[j] && arr[j].mbCE_leafStored === 1 && arr[j].name === nm) { arr.splice(j, 1); pulled++; break; }
					}
				}
			}
			/* 还原穿着 */
			for (i = 0; i < MB_CE_LEAF_SLOTS.length; i++) {
				slot = MB_CE_LEAF_SLOTS[i];
				b = (rec.slots && rec.slots[slot]) ? rec.slots[slot] : null;
				if (b && typeof b === "object") {
					cp = mbCEYanlingDeep(b);
					if (cp) { V.worn[slot] = cp; restored.push(slot); }
				} else {
					nk = mbCEYanlingNakedItem(slot);
					if (nk) { V.worn[slot] = nk; }
				}
			}
			delete st.leaf;
			mbCEYanlingTrace("leaf_revert", { restored: restored, pulled: pulled }, { leaf: null });
			var rmsg = "已还原原服装（" + (restored.length ? restored.join(" / ") : "无") + "）；衣柜回收原衣 " + pulled + " 件（枝叶副本保留，可继续从衣柜穿）";
			if (!restored.length) { rmsg += "。你变装前 4 个躯干槽本来就没穿衣服（记录里全是空），所以视觉上不会有变化——这不是没生效"; }
			rmsg += "。立绘在当前画面不会立刻重绘：走动一段、或刷新页面后即可看到";
			return { ok: true, msg: rmsg };
		} catch (e) { return { ok: false, msg: "枝叶还原异常：" + mbCEYanlingErr(e) }; }
	}
