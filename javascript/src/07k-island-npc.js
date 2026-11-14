/* 职责：小岛生存 / 营地作弊 + 地下妓院角色送入 */
/* ============================================================
 * 07k-island-npc.js — R3 小岛生存/营地作弊 + R4 地下妓院「角色送进去」（原版字段）
 *
 * 原版取证（DoL 0.5.12.13 tw-passagedata）：
 *   【小岛】$island 字段（unique 37 / 引用 606）：
 *     .hide(27) .explore(24) .home(23) .walnut(23) .wood(20) .space(8) .raft(8)
 *     .tide(8) .explore_count(8) .chair(8) .tide_distance(7) .defeat(4) .walk(4) .kneel(4)
 *     $island[$island.home].trap(16) .decoration(15) .camouflage(10) .curtains(10)
 *     .decor(10) .bird_feeder(10) .space_used(2)
 *   · Widgets Island 初始化：explore_locations=[] / wood=0 / tide=0 / tide_distance=0 /
 *     hide=1 / hunger=0 / explore="none"；$islander_language 缺省 0。
 *   · $island.home 三值：rocky_hillock / waterfall / gulch（Island hub 三段文案）。
 *   · explore_locations 六值：bay / shore / wood / battleground / plain / castle
 *     （pushUnique + includes 各 3 次，枚举一致；Island Build 用 includes("bay") 解锁 raft）。
 *   · 食物：Island Walnut Eat → hunger −200、walnut −1；Walnut Gather → hunger −600、walnut −3；
 *     拾取 walnut += 1（Punch/Climb/visiting bird）、wood +=1（偷窃）/ +2（Wood Swim）/ +3（Wood Ask）。
 *   · Island Explore（1:00）：<<physique 6>><<island_pass 60>><<set $island.explore_count += 1>>
 *   · $island.hide：初始 1；Island Sleep 被抓 +1；Hide 1/2/3/Trapped 被识破 −3；
 *     Island Defeat 里 Math.clamp(hide, 0, 30) 决定藏匿成功率 → 取值域 0..30。
 *   · $islander_language 0..100：Traits 里 gte 100 → 「知识：海岛语言」；战斗中岛民 lt 100 听不懂你。
 *   · 建造件值档：simple / basic / advanced（passage 成系列 Island Build <档> <件>）。
 *
 *   【地下妓院】$undergroundbrothel（unique 12 / 引用 117）：
 *     .robin(27) .water(20) .escape(17) .robinSpoke(10) .time(9) .timepass(7) .robinTalk(4)
 *     .robinTopics(3) .robinGone(2) .active(1)
 *   · 关键结论：地下妓院 Cell **只关押 Robin**（108 个 underground 段落，npc 仅 Robin）；
 *     惠特妮/凯拉尔/贝利走的是**越狱后的重逢场景**标记，不是被关：
 *       Widgets Underground 的 dungeonescape：
 *         $baileySold            → $baileyReunionScene  "dungeon"
 *         $whitneyromance is 1   → $whitneyReunionScene "dungeon"
 *         C.npc.Kylar.love gte 50→ $kylarReunionScene   "dungeon"
 *         C.npc.Robin.init is 1 且 ($hoursGoneFromHome gte 4 and !$undergroundbrothel.robin)→ "dungeon"
 *                                       或 $undergroundbrothel.robinGone → "dungeonRobin"
 *       最后：<<set $undergroundbrothelescaped to true>>
 *   · undergroundCellOptions：escape gte 19（或按体型 16/17/18）出现「Escape | Underground Escape」，
 *     否则「Dig (1:00)」；Rest(1:00) → tiredness −1000；$undergroundbrothel.robin 且 !robinSpoke → Talk to Robin。
 *   · livestockescape（雷米牧场越狱）同构：$whitneyromance is 1 → $whitneyReunionScene "farm"。
 *
 * 设计原则：只写原版真实字段，不伪造 passage；「送进地下妓院」对非 Robin 角色走原版的重逢标记，
 * 对 Robin 走 $undergroundbrothel.robin（唯一真实"被关"槽），并在文案里明确说清区别。
 * ============================================================ */

var MB_CE_ISLAND_NUMS = [
	{ path: "island.hide", name: "隐蔽度", max: 30, note: "0–30：Island Sleep 被抓 +1、被识破 −3；Defeat 时决定藏匿是否成功" },
	{ path: "island.walnut", name: "核桃", max: 999, note: "吃 1 个 −200 饥饿；Island Walnut Gather 一次消耗 3" },
	{ path: "island.walnut_dried", name: "干核桃", max: 999, note: "晒干储备" },
	{ path: "island.wood", name: "木材", max: 999, note: "Wood Swim +2、Wood Ask +3；建造消耗" },
	{ path: "island.raft", name: "木筏", max: 1, note: "0/1 二态（Island Build Raft；需 explore_locations 含 bay）" },
	{ path: "island.explore_count", name: "探索次数", max: 999, note: "Island Explore 每次 +1（1:00，需 physique 6）" },
	{ path: "islander_language", name: "海岛语言", max: 100, note: "0–100：≥100 触发「知识：海岛语言」，岛民战斗中能听懂你" },
	{ path: "islander_mask", name: "岛民面具", max: 100, note: "原版 specialClothes「islander」解锁条件 = 100" }
];
var MB_CE_ISLAND_HOMES = [
	{ v: "rocky_hillock", n: "岩石小丘" },
	{ v: "waterfall", n: "瀑布" },
	{ v: "gulch", n: "峡谷" }
];
var MB_CE_ISLAND_LOCS = [
	{ v: "bay", n: "海湾" },
	{ v: "shore", n: "海岸" },
	{ v: "wood", n: "林地" },
	{ v: "battleground", n: "古战场" },
	{ v: "plain", n: "平原" },
	{ v: "castle", n: "城堡" }
];
var MB_CE_ISLAND_BUILDS = [
	{ part: "trap", n: "陷阱" },
	{ part: "curtains", n: "帘幕" },
	{ part: "camouflage", n: "伪装" },
	{ part: "bird_feeder", n: "喂鸟器" },
	{ part: "chair", n: "座椅" }
];
var MB_CE_ISLAND_BUILD_LV = [
	{ v: "", n: "无" },
	{ v: "simple", n: "简易" },
	{ v: "basic", n: "基础" },
	{ v: "advanced", n: "高级" }
];

/* 取/建 $island 壳：原版 Widgets Island 会初始化全部字段，但玩家可能还没上过岛。
   建壳时补齐 home 与三个营地子对象，避免 $island[$island.home].trap 读到 undefined 抛错。 */
function mbCEIslandV() {
	var V = getV();
	if (!V || typeof V !== "object") { return null; }
	var made = false;
	if (!V.island || typeof V.island !== "object") {
		V.island = { home: "rocky_hillock", explore_locations: [], wood: 0, hide: 1, hunger: 0, explore: "none", tide: 0, tide_distance: 0, explore_count: 0, walnut: 0, walnut_dried: 0, raft: 0 };
		made = true;
	}
	var isl = V.island;
	if (!isl.home || isl.home === "undefined") { isl.home = "rocky_hillock"; made = true; }
	if (!Array.isArray(isl.explore_locations)) { isl.explore_locations = []; made = true; }
	MB_CE_ISLAND_HOMES.forEach(function (h) {
		if (!isl[h.v] || typeof isl[h.v] !== "object") {
			isl[h.v] = { trap: "", curtains: "", camouflage: "", bird_feeder: "", chair: "", decor: 0, decoration: "", space: 0 };
			made = true;
		}
	});
	return made ? getV() : V;
}
/* 通用原样写入（字符串/布尔/数组都用它）：保留「首次写入前」留痕，回退走 placeStageUndo。
   replay=true 时跳过预览门控（由 08d 的确认动作回调）。 */
function mbCEPlaceWriteRaw(path, value, replay) {
	try {
		var V = getV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var parts = String(path || "").split(".");
		if (!parts.length || !parts[0]) { return { ok: false, message: "路径无效" }; }
		var cur = V, i;
		for (i = 0; i < parts.length - 1; i++) {
			if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") { return { ok: false, message: "宿主不存在（" + parts.slice(0, i + 1).join(".") + "）" }; }
			cur = cur[parts[i]];
		}
		var leaf = parts[parts.length - 1];
		var now = cur[leaf];
		if (JSON.stringify(now) === JSON.stringify(value)) { return { ok: true, message: "值未变化（" + path + " 已是目标值）" }; }
		if (!replay && typeof mbCEPreviewGate === "function" &&
			mbCEPreviewGate(path, now, value, function () { return mbCEPlaceWriteRaw(path, value, true); })) {
			return { ok: false, pending: true, message: "待确认写入：" + path };
		}
		var before = now;
		var prev = V.mbCE_wrote && V.mbCE_wrote["place:" + path];
		if (prev && "before" in prev) { before = prev.before; }
		cur[leaf] = value;
		if (!V.mbCE_wrote || typeof V.mbCE_wrote !== "object") { V.mbCE_wrote = {}; }
		V.mbCE_wrote["place:" + path] = { type: "place", path: path, before: before, after: value, t: Date.now() };
		mbCEWroteTrim(V);
		return { ok: true, message: "已写入 " + path + " = " + (typeof value === "string" ? value : JSON.stringify(value)) };
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}

function mbCEIslandLocToggle(loc, on) {
	try {
		var V = mbCEIslandV();
		if (!V) { return { ok: false, message: "存档变量不可用" }; }
		var arr = V.island.explore_locations.slice();
		var at = arr.indexOf(loc);
		if (on && at === -1) { arr.push(loc); }
		if (!on && at !== -1) { arr.splice(at, 1); }
		if (arr.length === V.island.explore_locations.length && ((on && at !== -1) || (!on && at === -1))) {
			return { ok: true, message: "未变化（" + loc + " 已是当前状态）" };
		}
		return mbCEPlaceWriteRaw("island.explore_locations", arr, false);
	} catch (e) { return { ok: false, message: "操作异常：" + mbCEErr(e) }; }
}
/* 数值行：钳制到 [0, max] + 留痕 place:（复用地点阶段通道） */
function mbCEIslandNumWrite(it, val) {
	if (typeof placeStageWrite === "function") { return placeStageWrite(it.path, val, 0, it.max); }
	return mbCEPlaceWriteRaw(it.path, Number(val) || 0, false);
}

/* 地点页「地点阶段」子页签末尾的 R3 区块 */
function renderIslandSec(pane) {
	if (!pane) { return; }
	var V = getV();
	var isl = (V && V.island && typeof V.island === "object") ? V.island : null;
	var sec = mceNewSec(pane, 2, "小岛（Island）· 生存与营地",
		"原版 $island 全套字段直改：隐蔽度/食物储备/木材/木筏/探索次数/海岛语言/岛民面具 + 营地位置 + 已探索地点 + 五件建造物档位。" +
		"注意：$island.home 与建造物是**字符串档位**（rocky_hillock|waterfall|gulch、\"\"|simple|basic|advanced），其它是数字；" +
		"tide / tide_distance / explore(\"none\"/…) 是瞬时探索态，不做直写以免打断正在进行的事件。");
	if (!isl) {
		sec.appendChild(el("div", MCE_CLS.hint, "当前存档还没有 $island（没上过岛）：点下面任一「写入」会自动建壳并补齐三处营地对象，之后再进岛不会报错。"));
	} else {
		sec.appendChild(el("div", MCE_CLS.hint, "当前：营地 " + ((isl.home === "waterfall") ? "瀑布" : (isl.home === "gulch") ? "峡谷" : "岩石小丘") +
			" ｜ 隐蔽 " + (isl.hide == null ? "—" : isl.hide) + " ｜ 核桃 " + (isl.walnut == null ? "—" : isl.walnut) +
			" ｜ 木材 " + (isl.wood == null ? "—" : isl.wood) + " ｜ 已探索 " + (Array.isArray(isl.explore_locations) ? isl.explore_locations.length : 0) + " / 6"));
	}

	/* 1) 数值 */
	var gNum = mceNewGroup(sec, "生存数值", "钳制在原版取值域内");
	MB_CE_ISLAND_NUMS.forEach(function (it) {
		var cur = 0;
		try {
			var seg = it.path.split(".");
			var c = V;
			seg.forEach(function (k) { c = (c == null) ? undefined : c[k]; });
			cur = (typeof c === "number") ? c : 0;
		} catch (e) { cur = 0; }
		var row = el("div", MCE_CLS.row);
		row.setAttribute("data-islandkey", it.path);
		var lbl = el("span", MCE_CLS.rowLbl, it.name + "（当前 " + cur + " / 上限 " + it.max + "）　");
		lbl.title = it.note;
		row.appendChild(lbl);
		var inp = el("input", MCE_CLS.inp);
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(cur);
		inp.placeholder = "目标值";
		inp.title = it.note;
		var btn = el("button", MCE_CLS.btn, "写入"); btn.type = "button";
		btn.addEventListener("click", function () {
			var r = mbCEIslandNumWrite(it, inp.value);
			renderPlaces();
			setStatus(r && r.message ? r.message : "写入失败", r && r.ok ? MCE_CLS.ok : MCE_CLS.err);
		});
		var maxB = el("button", "mce-btn mce-gold", "拉满"); maxB.type = "button";
		maxB.title = "置为原版上限 " + it.max;
		maxB.addEventListener("click", function () {
			var r = mbCEIslandNumWrite(it, it.max);
			renderPlaces();
			setStatus(r && r.message ? r.message : "写入失败", r && r.ok ? MCE_CLS.ok : MCE_CLS.err);
		});
		row.appendChild(inp); row.appendChild(btn); row.appendChild(maxB);
		try {
			if (V && V.mbCE_wrote && V.mbCE_wrote["place:" + it.path]) {
				var un = el("button", "mce-btn mce-red", "回退"); un.type = "button";
				un.addEventListener("click", function () { var r = placeStageUndo(it.path); renderPlaces(); setStatus(r.message || "", r.ok ? MCE_CLS.ok : MCE_CLS.err); });
				row.appendChild(un);
			}
		} catch (e) {}
		gNum.appendChild(row);
	});

	/* 2) 营地位置 */
	var gHome = mceNewGroup(sec, "营地位置（$island.home）", "原版三选，直接改主场景文案与建造父键");
	MB_CE_ISLAND_HOMES.forEach(function (h) {
		var b = el("button", MCE_CLS.btn + ((isl && isl.home === h.v) ? " mce-gold" : ""), h.n + (isl && isl.home === h.v ? "（当前）" : ""));
		b.type = "button";
		b.addEventListener("click", function () { var r = mbCEPlaceWriteRaw("island.home", h.v, false); renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err); });
		gHome.appendChild(b);
	});

	/* 3) 已探索地点 */
	var gLoc = mceNewGroup(sec, "已探索地点（$island.explore_locations）", "原版六值；含 bay 才能出现木筏建造");
	MB_CE_ISLAND_LOCS.forEach(function (l) {
		var has = !!(isl && Array.isArray(isl.explore_locations) && isl.explore_locations.indexOf(l.v) !== -1);
		var row = el("div", MCE_CLS.row);
		row.appendChild(el("span", MCE_CLS.rowLbl, l.n + "（" + l.v + "）"));
		var on = el("button", MCE_CLS.btn + (has ? " mce-gold" : ""), has ? "已解锁（点此移除）" : "解锁"); on.type = "button";
		on.addEventListener("click", function () { var r = mbCEIslandLocToggle(l.v, !has); renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err); });
		row.appendChild(on);
		gLoc.appendChild(row);
	});
	var allLoc = el("button", "mce-btn mce-gold", "六处全解锁");
	allLoc.type = "button";
	allLoc.addEventListener("click", function () {
		var r = mbCEPlaceWriteRaw("island.explore_locations", MB_CE_ISLAND_LOCS.map(function (x) { return x.v; }), false);
		renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
	});
	gLoc.appendChild(allLoc);

	/* 4) 建造物档位 */
	var curHome = (isl && isl.home) ? isl.home : "rocky_hillock";
	var gBuild = mceNewGroup(sec, "建造物档位（$island[" + (curHome === "waterfall" ? "瀑布" : curHome === "gulch" ? "峡谷" : "岩石小丘") + "].*）",
		"原版三档 simple / basic / advanced；写的是当前营地那一份，切营地后各自独立");
	MB_CE_ISLAND_BUILDS.forEach(function (b) {
		var row = el("div", MCE_CLS.row);
		row.appendChild(el("span", MCE_CLS.rowLbl, b.n));
		MB_CE_ISLAND_BUILD_LV.forEach(function (lv) {
			var path = "island." + curHome + "." + b.part;
			var curV = "";
			try { curV = (V.island[curHome] && typeof V.island[curHome][b.part] === "string") ? V.island[curHome][b.part] : ""; } catch (e) { curV = ""; }
			var btn = el("button", MCE_CLS.btn + (curV === lv.v ? " mce-gold" : ""), lv.n);
			btn.type = "button";
			btn.addEventListener("click", function () {
				mbCEIslandV();
				var r = mbCEPlaceWriteRaw(path, lv.v, false);
				renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
			});
			row.appendChild(btn);
		});
		gBuild.appendChild(row);
	});
	gBuild.appendChild(el("div", MCE_CLS.hint, "建造物直接置档等价于「已建成该档」：原版 Island Build 只读档位决定可用选项与心情/隐蔽加成，不做额外前置校验。写完后进岛营地页即可看到对应选项。"));

	/* 5) 岛民面具解锁快捷 */
	var gMask = mceNewGroup(sec, "岛民套装解锁", "原版 specialClothes「islander」= $islander_mask is 100");
	var bMask = el("button", "mce-btn mce-gold", "解锁岛民面具套装"); bMask.type = "button";
	bMask.addEventListener("click", function () {
		var r = mbCEPlaceWriteRaw("islander_mask", 100, false);
		renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
	});
	gMask.appendChild(bMask);
}

/* ---------- R4：地下妓院 ---------- */
var MB_CE_NPC_REUNION = [
	{ key: "whitneyReunionScene", name: "惠特妮", need: "原版条件 $whitneyromance is 1（本操作会一并置 1）", extra: { path: "whitneyromance", val: 1 } },
	{ key: "kylarReunionScene", name: "凯拉尔", need: "原版条件 C.npc.Kylar.love ≥ 50（请在角色页把 love 拉高后再点，否则文字线不走）" },
	{ key: "baileyReunionScene", name: "贝利", need: "原版条件 $baileySold（被卖掉后才有这段重逢）" },
	{ key: "robinReunionScene", name: "罗宾", need: "原版条件 C.npc.Robin.init is 1 且离家 ≥ 4 小时或 robinGone；Robin 是唯一真被关进牢房的角色" }
];
function renderNpcUndergroundSec(pane) {
	if (!pane) { return; }
	var V = getV();
	var ub = (V && V.undergroundbrothel && typeof V.undergroundbrothel === "object") ? V.undergroundbrothel : null;
	var sec = mceNewSec(pane, 3, "地下妓院 · 角色与越狱（原版字段）",
		"原版取证结论：地下妓院牢房（Underground Cell）**只关押 Robin** —— 108 个 underground 段落里 npc 只有 Robin，" +
		"$undergroundbrothel 的 12 个字段中 robin/robinSpoke/robinTalk/robinTopics/robinGone 全部是 Robin 专用。" +
		"惠特妮 / 凯拉尔 / 贝利 不是被关，而是**越狱后**由 Widgets Underground 的 dungeonescape 按条件设置 *ReunionScene = \"dungeon\" 触发地下重逢。" +
		"所以这里对非 Robin 角色写的是原版真实的重逢标记（等价于「把 TA 也安排进地下剧情」），Robin 则可用 robin 槽直接关进牢房。");
	if (!ub) {
		sec.appendChild(el("div", MCE_CLS.hint, "当前存档还没有 $undergroundbrothel（没进过地下）：点任一写入会自动建壳（escape=0 / robin=false），进地下不会报错。"));
	} else {
		sec.appendChild(el("div", MCE_CLS.hint, "当前：越狱进度 " + (ub.escape == null ? "—" : ub.escape) + " / 19 ｜ Robin 在牢房 " + (ub.robin ? "是" : "否") + " ｜ 已逃出 " + (V.undergroundbrothelescaped ? "是" : "否")));
	}
	function ensureUb() {
		var Vx = getV();
		if (!Vx.undergroundbrothel || typeof Vx.undergroundbrothel !== "object") {
			Vx.undergroundbrothel = { escape: 0, robin: false, robinSpoke: false, robinTalk: 0, robinTopics: [], robinGone: false, time: 0, timepass: 0, water: 0, active: false };
		}
		return Vx;
	}
	var gRe = mceNewGroup(sec, "地下重逢场景（*ReunionScene = \"dungeon\"）", "越狱后原版会按这些标记播放对应角色的地下重逢");
	MB_CE_NPC_REUNION.forEach(function (n) {
		var row = el("div", MCE_CLS.row);
		var cur = (V && typeof V[n.key] === "string") ? V[n.key] : "";
		var lbl = el("span", MCE_CLS.rowLbl, n.name + (cur ? "（当前 " + cur + "）" : "（未设置）"));
		lbl.title = n.need;
		row.appendChild(lbl);
		var b = el("button", "mce-btn mce-gold", cur === "dungeon" ? "已设置（点此清除）" : "设为地下重逢");
		b.type = "button";
		b.addEventListener("click", function () {
			var r;
			if (cur === "dungeon") {
				r = mbCEPlaceWriteRaw(n.key, "", false);
			} else {
				if (n.extra) { mbCEPlaceWriteRaw(n.extra.path, n.extra.val, false); }
				r = mbCEPlaceWriteRaw(n.key, "dungeon", false);
			}
			renderPlaces(); setStatus(r.message + (r.ok && n.need ? "；" + n.need : ""), r.ok ? MCE_CLS.ok : MCE_CLS.err);
		});
		row.appendChild(b);
		gRe.appendChild(row);
	});
	gRe.appendChild(el("div", MCE_CLS.hint, "提示：这些标记只决定「越狱后播放谁的重逢」，不会把角色放进牢房（原版没有这个能力）。若只想看那段剧情，设完标记后从下方「越狱进度」置 19 并在游戏内点 Escape。"));
	if (typeof getV === "function") {
		var V2 = getV();
		if (V2 && typeof V2.whitneyromance !== "undefined" && V2.whitneyromance !== 1) {
			gRe.appendChild(el("div", MCE_CLS.hint, "惠特妮：当前 $whitneyromance = " + V2.whitneyromance + "（不是 1），点上面的按钮时会自动置 1。"));
		}
	}

	var gUb = mceNewGroup(sec, "牢房与越狱（$undergroundbrothel.*）", "Robin 专用槽 + 越狱进度");
	var ubNum = [
		{ path: "undergroundbrothel.escape", name: "越狱进度", max: 19, note: "≥19（或按体型 16/17/18）地下 Cell 才会出现 Escape 选项；否则只有 Dig" },
		{ path: "undergroundbrothel.robinTalk", name: "Robin 对话次数", max: 99, note: "undergroundCellOptions 的 Talk to Robin（0:10）" }
	];
	ubNum.forEach(function (it) {
		var cur = 0;
		try { var seg = it.path.split("."); var c = V; seg.forEach(function (k) { c = (c == null) ? undefined : c[k]; }); cur = (typeof c === "number") ? c : 0; } catch (e) { cur = 0; }
		var row = el("div", MCE_CLS.row);
		var lbl = el("span", MCE_CLS.rowLbl, it.name + "（当前 " + cur + " / " + it.max + "）");
		lbl.title = it.note;
		row.appendChild(lbl);
		var inp = el("input", MCE_CLS.inp); inp.type = "text"; inp.inputmode = "decimal"; inp.value = String(cur); inp.title = it.note;
		var b = el("button", MCE_CLS.btn, "写入"); b.type = "button";
		b.addEventListener("click", function () { ensureUb(); var r = placeStageWrite(it.path, inp.value, 0, it.max, false); renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err); });
		var mx = el("button", "mce-btn mce-gold", "拉满"); mx.type = "button";
		mx.addEventListener("click", function () { ensureUb(); var r = placeStageWrite(it.path, it.max, 0, it.max, false); renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err); });
		row.appendChild(inp); row.appendChild(b); row.appendChild(mx);
		gUb.appendChild(row);
	});
	var rowRobin = el("div", MCE_CLS.row);
	rowRobin.appendChild(el("span", MCE_CLS.rowLbl, "把 Robin 关进地下牢房（$undergroundbrothel.robin，原版唯一真实牢房槽）"));
	var hasRobin = !!(ub && ub.robin);
	var bRobin = el("button", MCE_CLS.btn + (hasRobin ? " mce-gold" : ""), hasRobin ? "已在牢房（点此放走）" : "关进去");
	bRobin.type = "button";
	bRobin.addEventListener("click", function () {
		ensureUb();
		var r = mbCEPlaceWriteRaw("undergroundbrothel.robin", !hasRobin, false);
		renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err);
	});
	rowRobin.appendChild(bRobin);
	gUb.appendChild(rowRobin);
	var rowEsc = el("div", MCE_CLS.row);
	rowEsc.appendChild(el("span", MCE_CLS.rowLbl, "标记「已逃出地下妓院」（$undergroundbrothelescaped，解锁 underground_brothel 套装条件）"));
	var bEsc = el("button", "mce-btn mce-gold", "置为已逃出"); bEsc.type = "button";
	bEsc.addEventListener("click", function () { var r = mbCEPlaceWriteRaw("undergroundbrothelescaped", true, false); renderPlaces(); setStatus(r.message, r.ok ? MCE_CLS.ok : MCE_CLS.err); });
	rowEsc.appendChild(bEsc);
	gUb.appendChild(rowEsc);
	gUb.appendChild(el("div", MCE_CLS.hint, "「关进去」只写 robin 槽：游戏内进入地下牢房还需要从 Bailey 的出售/抓捕剧情走；本功能用于补测地下线剧情与套装条件。"));
}
