	/* ============ 特殊场景直达（用户点名 5 大场景 + 主从嵌套）
	     不硬编码段落清单：按前缀/关键词在 Story 段落里动态枚举，MOD 新增段落自动收录；
	     组 = 主场景，组内各段落 = 子场景，main 段落排最前并标注「主」。============ */
	var PLACE_GROUPS = [
		{ id: "orphanage_loft", name: "孤儿院 · 阁楼", match: function (n) { return n.indexOf("Orphanage Loft") === 0; }, main: "Orphanage Loft", note: "孤儿院上方的阁楼（隐藏区域，Bailey 视线之外）" },
		{ id: "kylar_manor", name: "凯拉尔 · 庄园", match: function (n) { return n.indexOf("Manor ") === 0; }, main: "Manor Hall", note: "凯拉尔家族的庄园大宅（大厅/花园/实验室/秘密房间）" },
		{ id: "sydney_temple", name: "悉尼（Sydney）· 神殿居所", match: function (n) { return n.indexOf("Temple Sydney") === 0 || n.indexOf("Sydney Temple") === 0; }, main: "Temple Sydney", note: "神殿中悉尼的房间与祭坛场景（纯/堕两线都在此）" },
		{ id: "sirris_places", name: "西里斯（Sirris）· 学校与成人商店", match: function (n) { return /sirris/i.test(n) || n === "Sydney Ride Home" || n === "Sydney Ride Temple"; }, main: "Adult Shop Approach Sirris", note: "西里斯常驻的科学教室与成人商店，以及开车接送的车程场景（悉尼的家长）" },
		{ id: "avery_mansion", name: "艾弗里 · 庄园", match: function (n) { return n.indexOf("Mansion ") === 0; }, main: "Mansion Bed", note: "艾弗里的庄园豪宅（卧室/泳池/浴室/厨房/地牢/车库等套间）" },
		{ id: "gwylan_garden", name: "格威岚 · 花园与森林商店", match: function (n) { return /gwylan/i.test(n) || n.indexOf("Pregnancy Birth Forest Shop") === 0 || n.indexOf("Forest Shop") === 0; }, main: "Gwylan Ritual Start Garden", note: "格威岚的森林商店与花园（仪式/接生/幽会/恋爱各阶段场景均在此）" },
		/* v1.7.0：多伦公寓（Doren's flat，$location="flats"）+ 麋鹿街大院（Elk Compound，原版 73 段）。
		   多伦公寓实证：Doren Entrance（入口，"You climb to Doren's flat"）、Doren Talk/Cry、Doren Shower 系列均在公寓内；
		   Doren Loft 系列为孤儿院阁楼布置线（用户点名一并收录）；Doren Jog/Beach/School Infirmary 为户外/学校，不收。
		   麋鹿街大院实证：Elk Compound 为入口（"You are in the compound on Elk Street"），Interior/Underground/Central/
		   Wraith/Possessed/Station 等 70+ 子场景；Docks Compound 为码头大院，不收。 */
		{ id: "doren_flat", name: "多伦 · 公寓与阁楼", match: function (n) {
			return n === "Doren Entrance" || n === "Doren Talk" || n === "Doren Cry"
				|| n.indexOf("Doren Shower") === 0 || n.indexOf("Doren Loft") === 0;
		}, main: "Doren Entrance", note: "多伦的公寓（进入/闲聊/哭泣/淋浴各阶段）与孤儿院阁楼布置线（Doren Loft，用户点名一并收录）" },
		{ id: "elk_compound", name: "麋鹿街 · 大院", match: function (n) {
			return n.indexOf("Elk Compound") === 0;
		}, main: "Elk Compound", note: "麋鹿街大院（中央区/地下/怨灵线/附身线等 70+ 子场景）" },
		/* v1.9.13 场景直达补充 6 组（段落前缀均经本体 0.5.12.13 实证） */
		{ id: "asylum", name: "精神病院 · Asylum", match: function (n) {
			return n === "Asylum" || n.indexOf("Asylum ") === 0;
		}, main: "Asylum", note: "精神病院（评估/病房/深渊/镜像等线；$location=asylum）" },
		{ id: "police_prison", name: "警局与监狱 · Police/Prison", match: function (n) {
			return n.indexOf("Police ") === 0 || n.indexOf("Prison ") === 0;
		}, main: "Police Cell", note: "警局（羁押/社区服务）与监狱（囚犯线/Wren 线等）" },
		{ id: "docks", name: "码头 · Docks", match: function (n) {
			return n === "Docks" || n.indexOf("Docks_") === 0 || n.indexOf("Docks ") === 0;
		}, main: "Docks", note: "码头（$location=docks；罗宾码头线 Docks_Robin 系列在此）" },
		{ id: "lake", name: "湖畔 · Lake", match: function (n) {
			return n.indexOf("Lake ") === 0;
		}, main: "Lake Stroll", note: "湖畔（$location=lake；散步/昆虫/黄金/遗迹等线）" },
		{ id: "wolf_territory", name: "森林深处 · 狼群领地", match: function (n) {
			return n.indexOf("Wolf ") === 0 || n.indexOf("Forest Wolf") === 0;
		}, main: "Wolf Pack", note: "森林深处的狼群领地（Wolf Pack 遭遇/狼穴/狼孩线）" },
		{ id: "hospital", name: "医院 · Hospital", match: function (n) {
			return n.indexOf("Hospital ") === 0;
		}, main: "Hospital front", note: "医院（$location=hospital；前台/门禁卡/诊室等线）" }
	];
	var PLACE_CN = {
		/* v1.9.23-实机修复：新 6 组主场景名中文化（主场景行 placeNameCN 子串映射） */
		"asylum": "精神病院", "police": "警局与监狱", "prison": "监狱", "docks": "码头",
		"lake": "湖畔", "wolf": "狼群", "hospital": "医院",
		"loft": "阁楼", "kitchen": "厨房", "reading nook": "阅读角", "bay window": "凸窗", "coffee pot": "咖啡壶",
		"spray": "喷漆", "hall": "大厅", "garden": "花园", "lab": "实验室", "parents room": "父母房间",
		"grounds": "庭院", "kylar room": "凯拉尔房间", "secret": "秘密", "bed": "卧室", "pool": "泳池",
		"bathroom": "浴室", "lounge": "客厅", "dining": "餐厅", "study": "书房", "dungeon": "地牢",
		"garage": "车库", "display": "陈列室", "wardrobe": "衣帽间", "breakfast": "早餐", "folder": "档案",
		"party": "宴会", "bathe": "沐浴", "chase": "追逐", "bedroom": "卧室", "corridor": "走廊",
		"stairs": "楼梯", "antiques": "古董", "mirror": "镜子", "intro": "初次进入", "vigil": "守夜",
		"pray": "祈祷", "wakeup": "醒来", "rescue": "营救", "confess": "忏悔", "pure": "纯洁线",
		"corrupt": "堕落线", "seduce": "引诱", "spank": "拍打", "sex": "性爱", "ritual": "仪式",
		"start": "开始", "pregnancy": "分娩", "birth": "接生", "forest": "森林", "shop": "商店",
		"compound": "大院", "central": "中央区", "underground": "地下", "interior": "室内", "station": "站台",
		"wraith": "怨灵", "possessed": "附身", "machine": "机械", "experiment": "实验", "tentacles": "触手",
		"crystal": "水晶", "sell": "出售", "bluff": "虚张声势", "fight": "战斗", "explore": "探索",
		"camera": "摄像头", "pipes": "管道", "smoke": "烟雾", "climb": "攀爬", "tower": "塔楼",
		"shower": "淋浴", "cry": "哭泣", "talk": "交谈", "hot chocolate": "热巧克力", "volleyball": "排球"
	};
	function placeNameCN(name) {
		var lower = String(name).toLowerCase();
		var parts = [];
		Object.keys(PLACE_CN).forEach(function (k) {
			if (lower.indexOf(k) !== -1) { parts.push(PLACE_CN[k]); }
		});
		if (!parts.length) { return ""; }
		// 去重保序
		var uniq = []; parts.forEach(function (p) { if (uniq.indexOf(p) === -1) { uniq.push(p); } });
		return "（" + uniq.join("·") + "）";
	}
	function passageExists(name) {
		try {
			if (typeof Story !== "undefined" && Story && typeof Story.has === "function") {
				return !!Story.has(name);
			}
			var ps = listAllPassages();
			for (var i = 0; i < ps.length; i++) { if (ps[i].name === name) { return true; } }
		} catch (e) {}
		return false;
	}
	function getEnginePlayFn() {
		try { if (typeof window !== "undefined" && window && window.Engine && typeof window.Engine.play === "function") { return { e: window.Engine, play: window.Engine.play }; } } catch (e) {}
		try { if (typeof Engine !== "undefined" && Engine && typeof Engine.play === "function") { return { e: Engine, play: Engine.play }; } } catch (e) {}
		/* SugarCube 2.36.1：Engine 位于 window.SugarCube 命名空间（Object.defineProperty 密封对象），不在 window 顶层 */
		try {
			var sc = (typeof window !== "undefined" && window && window.SugarCube) ? window.SugarCube : null;
			if ((!sc || typeof sc !== "object") && typeof SugarCube !== "undefined" && SugarCube) { sc = SugarCube; }
			if (sc && sc.Engine && typeof sc.Engine.play === "function") { return { e: sc.Engine, play: sc.Engine.play }; }
		} catch (e) {}
		return null;
	}
	function teleportTo(name) {
		try {
			if (!passageExists(name)) {
				setStatus("段落不存在：「" + name + "」（可能未安装对应剧情 MOD）", "mce-err");
				return;
			}
			var ep = getEnginePlayFn();
			if (!ep) {
				var d1 = (typeof window !== "undefined" && window) ? (typeof window.Engine) : "no-window";
				var d2 = (typeof Engine);
				var d3 = (typeof $);
				var d4 = (typeof window !== "undefined" && window && window.SugarCube) ? (typeof window.SugarCube.Engine) : "no-sc";
				setStatus("Engine 不可用（Engine=" + d2 + "，window.Engine=" + d1 + "，$=" + d3 + "，SugarCube.Engine=" + d4 + "）——若非游戏页面请先进入游戏", "mce-err");
				return;
			}
			ensureAveryMansion(); /* 防崩：庄园状态对象可能延迟初始化，直达前兜底（缺失才建，不覆盖进度） */
			ensureFarmState(); /* 防崩：farm_stage 已推进但 $farm 缺失时补空壳（社交页读 $farm.beasts/aggro） */
			if (name === "Scene Viewer passages") {
				/* 直达场景查看器入口：设 pending 让首次 case 播放，剧情结束链回时不再重播；
				   同时设 replayScene（原版 default 退出分支需要 $replayScene.exitpassage 才能给出 Back 链接） */
				var Vp = getV();
				if (Vp) {
					Vp.mbCE_replayOnce = true;
					Vp.mbCE_replayPending = true;
					Vp.replayScene = { name: "场景直达", startPassage: "Scene Viewer passages", passages: [], exitpassage: (typeof Vp.passage === "string" ? Vp.passage : "") };
				}
			}
			ep.play.call(ep.e, name, true);
			setStatus("已传送至「" + name + "」", "mce-ok");
			var gidT = placeIdForPassage(name, name);
			if (gidT) { applyWorldUnlock(gidT); setStatus("已传送至「" + name + "」并已解锁世界入口", "mce-ok"); }
		} catch (e) { setStatus("传送失败：" + (e && e.message ? e.message : e), "mce-err"); }
	}
	function listPlaceGroups() {
		var ps = listAllPassages();
		var seen = {};
		return PLACE_GROUPS.map(function (g) {
			var items = [];
			for (var j = 0; j < ps.length; j++) {
				var n = ps[j].name;
				if (seen[n]) { continue; }
				if (g.match(n)) { seen[n] = true; items.push(n); }
			}
			items.sort(function (a, b) {
				var am = a === g.main ? 0 : 1, bm = b === g.main ? 0 : 1;
				if (am !== bm) { return am - bm; }
				return a.toLowerCase().localeCompare(b.toLowerCase());
			});
			return { group: g, items: items };
		});
	}
	/* ============ v1.9.0 场景页双层子界面：场景直达 / 地点（地点阶段任务作弊区） ============ */
	function renderPlaces() {
		var pane = root.querySelector('[data-pane="places"]');
		var keepScroll = typeof pane.scrollTop === "number" ? pane.scrollTop : 0; /* 重建后保持滚动位置（五巡一致） */
		pane.textContent = "";
		var inner = el("div", "mce-inner");
		var bDirect = el("button", mbCEUiState.placesTab !== "stage" ? "mce-active" : "", "场景直达");
		bDirect.type = "button";
		bDirect.setAttribute("data-place", "direct");
		bDirect.title = "特殊场景一键直达（阁楼/庄园/神殿/公寓等）";
		bDirect.addEventListener("click", function () {
			mbCEUiState.placesTab = "direct";
			mbCEUiSave({ placesTab: "direct" });
			renderPlaces();
		});
		var bStage = el("button", mbCEUiState.placesTab === "stage" ? "mce-active" : "", "地点");
		bStage.type = "button";
		bStage.setAttribute("data-place", "stage");
		bStage.title = "地点阶段任务作弊（市政改造/农场/公寓/机构等原版阶段变量直改，全部留痕可回退）";
		bStage.addEventListener("click", function () {
			mbCEUiState.placesTab = "stage";
			mbCEUiSave({ placesTab: "stage" });
			renderPlaces();
		});
		inner.appendChild(bDirect);
		inner.appendChild(bStage);
		pane.appendChild(inner);
		if (mbCEUiState.placesTab === "stage") { renderPlacesStage(pane); }
		else { renderPlacesDirect(pane); }
		if (typeof pane.scrollTop === "number") { pane.scrollTop = keepScroll; }
	}

	/* ---- 地点阶段任务数据表（max 来自 DoL 0.5.12.13 原版阈值实证扫描；town_projects 为嵌套宿主） ---- */
	var PLACE_STAGE_GROUPS = [
		{ name: "市政改造（市政府 town_projects）", note: "原版路过事件自动升级；此处可一键推进各项目阶段（0-5）", items: [
			{ key: "road", name: "道路", path: "town_projects.road", max: 5, note: "市政道路工程（≥4 解锁森林深路/回城快速路）" },
			{ key: "diving", name: "潜水考古", path: "town_projects.diving", max: 5, note: "潜水考古项目（≥3 关联博物馆项链，≥4 解锁 Winter 考古营地）" },
			{ key: "thicket", name: "灌木丛", path: "town_projects.thicket", max: 5, note: "灌木丛清理工程（改变触手森林场景）" },
			{ key: "bridge", name: "桥梁", path: "town_projects.bridge", max: 5, note: "桥梁工程（≥4 解锁穿桥去 Flats 公寓区）" },
			{ key: "green", name: "绿地", path: "town_projects.green", max: 5, note: "绿地工程（≥4 解锁绿地社交场景）" }
		]},
		{ name: "农场（艾利克斯线）", note: "艾利克斯农场主线阶段系统", items: [
			{ key: "farm_stage", name: "农场阶段", path: "farm_stage", max: 12, note: "艾利克斯农场主线阶段（≥7 满足恋人条件）" },
			{ key: "farm_phase", name: "农场进程", path: "farm_phase", max: 1, note: "农场当季进程（0/1 二态）" }
		]},
		{ name: "城市与公寓", note: "公寓区/商店/阁楼/妓院地点阶段", items: [
			{ key: "flats", name: "公寓区进度", path: "flats_progress", max: 2, note: "Flats 公寓区进度（与市政桥梁工程联动解锁）" },
			{ key: "adultshop", name: "成人用品店", path: "adultshopprogress", max: 22, note: "成人用品店性玩具区解锁进度" },
			{ key: "loft", name: "阁楼升级", path: "loft_upgrade", max: 7, note: "孤儿院阁楼房间升级计数（原版无硬性阈值，每次房间升级 +1）" },
			{ key: "brothel", name: "妓院机械维修", path: "brothel_machine_repair", max: 4, note: "妓院地下机械维修进度" }
		]},
		{ name: "机构与学校", note: "修道院/精神病院/学校地点阶段", items: [
			{ key: "temple_cloister", name: "修道院回廊", path: "temple_cloister_progress", max: 1, note: "修道院回廊进度（0/1 二态）" },
			{ key: "temple_arcade", name: "修道院街机线", path: "temple_arcade_phase", max: 4, note: "修道院街机线阶段（0-4）" },
			{ key: "asylum", name: "精神病院评估", path: "asylumassessmentprogress", max: 4, note: "精神病院评估进度（0-4）" },
			{ key: "asylum_puzzle", name: "精神病院谜题", path: "asylumPuzzleProgress", max: 5, note: "精神病院谜题进度（0-5）" },
			{ key: "science", name: "学校科学项目", path: "scienceprogression", max: 4, note: "学校科学项目进度（0-4）" },
			{ key: "terrarium", name: "学校生态箱", path: "scienceterrariumprogression", max: 4, note: "学校生态箱进度（0-4）" }
		]}
	];
	/* 地点阶段读取（safe：任何层级缺失 → 0） */
	function placeStageRead(path) {
		try {
			var Vp = getV();
			var parts = String(path || "").split(".");
			var cur = Vp;
			for (var i = 0; i < parts.length; i++) {
				if (cur == null) { return 0; }
				cur = cur[parts[i]];
			}
			var n = Number(cur);
			return Number.isFinite(n) ? Math.round(n) : 0;
		} catch (e) { return 0; }
	}
	/* 地点阶段写入：绕过原版变量黑名单直接写（五面板专用通道），保留 before 留痕可回退。
	   嵌套宿主：仅 town_projects 允许自动建壳（原版事件直接读写各字段）；其余缺失宿主拒绝。 */
	function placeStageWrite(path, target, min, max) {
		try {
			var Vp = getV();
			if (!Vp) { return { ok: false, message: "存档变量不可用" }; }
			var parts = String(path || "").split(".");
			if (!parts.length || !parts[0]) { return { ok: false, message: "路径无效" }; }
			var cur = Vp, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") {
					if (parts[i] === "town_projects") { cur[parts[i]] = {}; }
					else { return { ok: false, message: "宿主不存在（" + parts.slice(0, i + 1).join(".") + "），请先推进剧情或检查版本" }; }
				}
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			var before = cur[leaf];
			var prev = Vp.mbCE_wrote && Vp.mbCE_wrote["place:" + path];
			/* 留痕语义：before 始终保留「首次写入前」状态（含 undefined=原本无字段）——
			   用 in 判断，避免二次写入把 before 覆盖成当前值，导致回退丢失"删除字段"语义 */
			if (prev && "before" in prev) { before = prev.before; }
			var lo = Number.isFinite(Number(min)) ? Number(min) : 0;
			var hi = Number.isFinite(Number(max)) ? Number(max) : Infinity;
			/* 地点页是阶段/档位语义：钳制到 [lo, hi]（用户澄清：仅"直接填数值"放开上限，阶段保留） */
			var final = Math.max(lo, Math.min(hi, Math.round(Number(target) || 0)));
			cur[leaf] = final;
			if (!Vp.mbCE_wrote || typeof Vp.mbCE_wrote !== "object") { Vp.mbCE_wrote = {}; }
			Vp.mbCE_wrote["place:" + path] = { type: "place", path: path, before: before, after: final, t: Date.now() };
			mbCEWroteTrim(Vp);
			return { ok: true, message: "已写入 " + path + " = " + final, before: before, after: final };
		} catch (e) { return { ok: false, message: "操作异常：" + (e && e.message ? e.message : e) }; }
	}
	/* 地点阶段回退：还原首次写入前状态（before 为 undefined → 删除字段） */
	function placeStageUndo(path) {
		try {
			var Vp = getV();
			if (!Vp || !Vp.mbCE_wrote || !Vp.mbCE_wrote["place:" + path]) { return { ok: false, message: "无该写入留痕（不可回退）" }; }
			var rec = Vp.mbCE_wrote["place:" + path];
			var parts = String(path || "").split(".");
			var cur = Vp, i;
			for (i = 0; i < parts.length - 1; i++) {
				if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") { return { ok: false, message: "宿主已被清除，无法回退" }; }
				cur = cur[parts[i]];
			}
			var leaf = parts[parts.length - 1];
			if (rec.before === undefined) { delete cur[leaf]; }
			else { cur[leaf] = rec.before; }
			delete Vp.mbCE_wrote["place:" + path];
			return { ok: true, message: "已回退 " + path + " 到写入前状态" };
		} catch (e) { return { ok: false, message: "操作异常：" + (e && e.message ? e.message : e) }; }
	}
	function renderPlacesStage(pane) {
		pane.appendChild(el("div", "mce-hint", "地点阶段任务（原版 $变量 直改，全部留痕可回退）："));
		PLACE_STAGE_GROUPS.forEach(function (g) {
			var block = el("div", "mce-grp");
			var head = el("div", "mce-grp-t", g.name);
			head.title = g.note;
			block.appendChild(head);
			block.appendChild(el("div", "mce-stage-note", g.note));
			g.items.forEach(function (it) {
				var cur = placeStageRead(it.path);
				var row = el("div", "mce-row");
				row.setAttribute("data-stagekey", it.key);
				row.title = it.note + "（当前 " + cur + " / 上限 " + it.max + "；阶段档位，写入钳制在上限内）";
				var lbl = el("span", "mce-row-lbl", it.name + "　");
				var val = el("span", "mce-value", cur + " / " + it.max);
				lbl.appendChild(val);
				row.appendChild(lbl);
				var mDec = el("button", "mce-btn", "−1");
				mDec.type = "button";
				mDec.setAttribute("data-op", "dec");
				mDec.addEventListener("click", function () {
					var r = placeStageWrite(it.path, placeStageRead(it.path) - 1, 0, it.max);
					renderPlaces();
					if (r && r.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(r && r.message ? r.message : "写入失败", "mce-err"); }
				});
				var mInc = el("button", "mce-btn", "+1");
				mInc.type = "button";
				mInc.setAttribute("data-op", "inc");
				mInc.addEventListener("click", function () {
					/* +1 是档位微调：钳到 [0, it.max]（阶段档位语义，防点出不存在档位） */
					var nx = placeStageRead(it.path) + 1;
					if (nx > it.max) { nx = it.max; }
					var rInc = placeStageWrite(it.path, nx, 0, it.max);
					renderPlaces();
					if (rInc && rInc.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(rInc && rInc.message ? rInc.message : "写入失败", "mce-err"); }
				});
				var mMax = el("button", "mce-btn mce-gold", "拉满");
				mMax.type = "button";
				mMax.setAttribute("data-op", "max");
				mMax.addEventListener("click", function () {
					var rMax = placeStageWrite(it.path, it.max, 0, it.max);
					renderPlaces();
					if (rMax && rMax.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2：成功才闪 */
					else { setStatus(rMax && rMax.message ? rMax.message : "写入失败", "mce-err"); }
				});
				row.appendChild(mDec);
				row.appendChild(mInc);
				row.appendChild(mMax);
				/* 有留痕才显示回退（还原首次写入前状态） */
				try {
					var Vp = getV();
					if (Vp && Vp.mbCE_wrote && Vp.mbCE_wrote["place:" + it.path]) {
						var mUndo = el("button", "mce-btn mce-red", "回退");
						mUndo.type = "button";
						mUndo.setAttribute("data-op", "undo");
						mUndo.addEventListener("click", function () {
							var r = placeStageUndo(it.path);
							renderPlaces();
							setStatus(r.message || "", r.ok ? "mce-ok" : "mce-err");
							if (r && r.ok) { mbCEFlashAfterRender(it.key); } /* v1.9.14 效果2 */
						});
						row.appendChild(mUndo);
					}
				} catch (e) {}
				block.appendChild(row);
			});
			pane.appendChild(block);
		});
		pane.appendChild(el("div", "mce-hint", "拉满 = 置为原版上限值；「−1/+1」逐步推进；写入记录在 V.mbCE_wrote（place: 前缀）可回退。"));
	}

	function renderPlacesDirect(pane) {
		var groups = listPlaceGroups();
		var total = 0;
		var V = getV();
		var unlocked = (V && V.mbCE_unlockedPlaces && typeof V.mbCE_unlockedPlaces === "object") ? V.mbCE_unlockedPlaces : {};
		groups.forEach(function (entry) {
			var g = entry.group;
			total += entry.items.length;
			var block = el("div", "mce-stage");
			var head = el("div", "mce-stage-head");
			head.appendChild(el("span", "mce-dot", ""));
			head.appendChild(el("span", "mce-stage-name", "■ " + g.name + "　（" + entry.items.length + " 个段落）"));
			block.appendChild(head);
			block.appendChild(el("div", "mce-stage-note", g.note));
			var uc = unlocked[g.id];
			if (uc && uc.startPassage) {
				/* 已解锁（剧情固定触发联动）→ 直接可用 */
				var rowU = el("div", "mce-stage mce-place-row mce-pass");
				var shU = el("div", "mce-stage-head");
				shU.appendChild(el("span", "mce-dot", ""));
				shU.appendChild(el("span", "mce-stage-name", "已解锁 ★ " + g.name + "　（触发「" + (uc.name || uc.key || "") + "」后联动解锁）"));
				var entryHint = (typeof WORLD_UNLOCKS === "object" && WORLD_UNLOCKS[g.id] && WORLD_UNLOCKS[g.id].entry) ? WORLD_UNLOCKS[g.id].entry : "";
				if (entryHint) { shU.appendChild(el("div", "mce-stage-txt", "世界入口：已在游戏内解锁 → " + entryHint)); }
				var btnU = el("button", "mce-btn mce-gold", "直达");
				btnU.type = "button";
				btnU.title = "跳转到：" + uc.startPassage;
				(function (target) {
					btnU.addEventListener("click", function () { teleportTo(target); });
				})(uc.startPassage);
				shU.appendChild(btnU);
				rowU.appendChild(shU);
				block.appendChild(rowU);
			} else if (entry.items.indexOf(g.main) !== -1) {
				/* 只显示主场景（v1.2 精简：副场景段落不逐条列出） */
				var rowM = el("div", "mce-stage mce-place-row");
				var shM = el("div", "mce-stage-head");
				shM.appendChild(el("span", "mce-dot", ""));
				shM.appendChild(el("span", "mce-stage-name", "主场景　" + g.main + " ★　" + placeNameCN(g.main)));
				var btnM = el("button", "mce-btn mce-gold", "直达");
				btnM.type = "button";
				btnM.title = "跳转到段落：" + g.main;
				(function (target) {
					btnM.addEventListener("click", function () { teleportTo(target); });
				})(g.main);
				shM.appendChild(btnM);
				rowM.appendChild(shM);
				block.appendChild(rowM);
			} else {
				block.appendChild(el("div", "mce-stage-txt", "未匹配到主场景段落（未安装对应 MOD 或版本差异）。"));
			}
			pane.appendChild(block);
		});
		pane.appendChild(el("div", "mce-hint", "共枚举 " + total + " 个可直达段落（已按组精简，仅显示主场景；副场景段落计入统计不逐条列出）。点击「直达」立即跳转，不打断存档。"));
	}
	function describeCondition(text, name) {
		try {
			var t = String(text || "");
			var mState = t.match(/"([^"]+)"\s*!==\s*rv\.characters\.npc\.([A-Za-z ]+)\.state/);
			if (mState) { return "角色「" + displayName(mState[2]) + "」当前状态不是「" + (STATE_CN[mState[1]] || mState[1]) + "」（关系未中断）"; }
			var mState2 = t.match(/rv\.characters\.npc\.([A-Za-z ]+)\.state\s*!==\s*"([^"]+)"/);
			if (mState2) { return "角色「" + displayName(mState2[1]) + "」当前状态不是「" + (STATE_CN[mState2[2]] || mState2[2]) + "」（关系未中断）"; }
			var mInc = t.match(/([A-Za-z0-9_]+Seen)\??\.includes\("([^"]+)"\)/);
			if (mInc) {
				var seenLabel = { "ritual_sex": "完成仪式性爱", "yearning": "渴望（收信后）", "partners": "确立恋人关系", "romance": "步入永远关系" }[mInc[2]] || mInc[2];
				return "「" + displayName(name) + "」经历中已记录「" + seenLabel + "」";
			}
			var mBare = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*$/);
			if (mBare) { return TERM_CN[String(mBare[1]).toLowerCase()] ? "已获得/触发「" + TERM_CN[String(mBare[1]).toLowerCase()] + "」" : "变量 " + mBare[1] + " 已为真"; }
			var mEq = t.match(/1\s*===\s*rv\.variables\.([A-Za-z0-9_]+)/);
			if (mEq) { return TERM_CN[String(mEq[1]).toLowerCase()] ? "「" + TERM_CN[String(mEq[1]).toLowerCase()] + "」已成立（=1）" : "变量 " + mEq[1] + " 已置 1"; }
			var mEq2 = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*===\s*1/);
			if (mEq2) { return TERM_CN[String(mEq2[1]).toLowerCase()] ? "「" + TERM_CN[String(mEq2[1]).toLowerCase()] + "」已成立（=1）" : "变量 " + mEq2[1] + " 已置 1"; }
			var mLi = t.match(/rv\.variables\.loveInterest\.includes\("([^"]+)"\)/);
			if (mLi) { return "「" + displayName(mLi[1]) + "」已确立恋人关系（角色出现在恋人槽位）"; }
			var mGe = t.match(/rv\.variables\.([A-Za-z0-9_]+)\s*>=\s*(\d+)/);
			if (mGe) { return TERM_CN[String(mGe[1]).toLowerCase()] ? "「" + TERM_CN[String(mGe[1]).toLowerCase()] + "」≥ " + mGe[2] : "变量 " + mGe[1] + " ≥ " + mGe[2]; }
			var mUndef = t.match(/undefined\s*===\s*rv\.variables\.([A-Za-z0-9_]+)/);
			if (mUndef) { return TERM_CN[String(mUndef[1]).toLowerCase()] ? "「" + TERM_CN[String(mUndef[1]).toLowerCase()] + "」未触发（事件未开始）" : "变量 " + mUndef[1] + " 未触发"; }
			return "";
		} catch (e) { return ""; }
	}

