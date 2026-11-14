/* 职责：场景直达组枚举（缓存版 listPlaceGroups + 三重指纹失效） */
	/* ============ v2.1.5 场景直达组枚举（从 07d-places.js 迁出 + 加结果缓存）============
	   为什么迁出：07d-places.js 当时 399 行（结构门禁上限 400，零豁免），缓存改造需要净增行；
	   迁出后该片回落到 376 行，本片独立承载枚举与缓存。

	   性能依据（2026-11-14 实测，本体 0.5.12.13 / 16,087 段 / 24 组）：
	     node tools\_tmp_bench_places.js → listPlaceGroups 单次 133~193 ms（首次 193.3，后续均值 137.3）
	     node tools\_tmp_bench_split.js  → 其中「枚举 16,087 段构造 {name,text}」仅 4 ms（3%），
	                                       「24 组 × 16,087 段的 g.match 循环」131 ms（97%）
	   即：缓存 listAllPassages 的数组只能省 3%，必须缓存**组枚举结果**本身。

	   触发频率：listPlaceGroups 全项目只有 1 个调用点（07d-places2.js 的 renderPlacesDirect 首行），
	   但 renderPlaces（07d-places.js）有 14+ 处调用点（页签切换 / 每个直达按钮回调 / 小岛写后刷新），
	   每次都会重建整个 pane → 等于玩家每点一次地点相关按钮就付一次 137 ms 主线程阻塞。

	   失效判据（三重，全部 O(1)）：
	     ① 段落数 ps.length —— MOD 增删段落必变；
	     ② Story.size —— SugarCube 自己的段落计数（不可用时记 -1，不参与比较）；
	     ③ 首段名 / 中位段名 / 末段名 —— 段数不变但整包换内容的常见形态会被捕获；
	     ④ PLACE_GROUPS.length —— 运行时 push/splice 过组表（07d-places3.js 的 IIFE）后强制重算。
	   已知盲区：段数、Story.size、首/中/末名、组数全不变而中间段落整体替换 —— 捕获不到；
	   但 ModLoader 换包是整页重载（缓存随页面销毁），实测不存在该场景。真遇到时清空
	   mbCEPlaceGroupsCache 即可（不引入 force 参数，避免调用方滥用）。 */
	var mbCEPlaceGroupsCache = null;
	function mbCEPlaceFingerprint(ps) {
		var n = ps.length;
		if (!n) { return "0|-1"; }
		var sz = (typeof Story !== "undefined" && Story && typeof Story.size === "number") ? Story.size : -1;
		return n + "|" + sz + "|" + PLACE_GROUPS.length + "|"
			+ ps[0].name + "|" + ps[Math.floor(n / 2)].name + "|" + ps[n - 1].name;
	}
	function listPlaceGroups() {
		var ps = listAllPassages();
		var fp = mbCEPlaceFingerprint(ps);
		if (mbCEPlaceGroupsCache && mbCEPlaceGroupsCache.fp === fp) { return mbCEPlaceGroupsCache.groups; }
		var seen = {};
		var out = PLACE_GROUPS.map(function (g) {
			var items = [];
			for (var j = 0; j < ps.length; j++) {
				var n = ps[j].name;
				if (seen[n]) { continue; }
				if (!g.match(n)) { continue; }
				/* 不可安全直达的段不入组、也不占 seen —— 留给后面能匹配它的原组
				   （例：「Kylar Halloween Start」是 widget 定义段，排最前的节日组不该抢） */
				if (g.exclude && g.exclude(n, mbCEPassageText(n))) { continue; }
				seen[n] = true;
				items.push(n);
			}
			items.sort(function (a, b) {
				var am = a === g.main ? 0 : 1, bm = b === g.main ? 0 : 1;
				if (am !== bm) { return am - bm; }
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});
			return { group: g, items: items };
		});
		mbCEPlaceGroupsCache = { fp: fp, groups: out };
		return out;
	}
