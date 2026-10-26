	/* ============ 固定触发（v1.1）：把某个剧情钉住，下次推进剧情（遇见角色）自动重放
	     复用原版 $replayScene 重放通道（Scene viewer redirect）：startPassage/passages
	     内段落正常播放，离开场景自动回 Scene Viewer End 并返回原位；「回退」即取消。
	     存储于 V.mbCE_pinned（存档持久）；重放期间原版自动禁存 + 冻结属性，零副作用。 ============ */
	/* 固定触发队列（v1.2）：V.mbCE_queue 数组按固定顺序存储；每次段落跳转触发
	     队首未 used 项 → 启动原版 $replayScene 重放 → 立即标记 used（一次性，触发
	     后不再重复）；重放结束（跳向 Scene Viewer End）时移除已 used 项，并把该
	     剧情所在场景组记录进 V.mbCE_unlockedPlaces（场景联动解锁）。
	     兼容迁移：v1.1 旧单固定 mbCE_pinned 自动并入队列（视为已触发过）。 */
	function getPinQueue() {
		try {
			var V = getV();
			if (!V) { return null; }
			var q = V.mbCE_queue;
			if (!Array.isArray(q)) { q = []; V.mbCE_queue = q; }
			/* 旧版兼容迁移（幂等）：v1.1 单固定 mbCE_pinned → 并入队列并标记 used（已触发过，不再重复触发） */
			var old = V.mbCE_pinned;
			if (old && typeof old === "object" && old.active && old.startPassage) {
				var dup = false;
				for (var i = 0; i < q.length; i++) {
					if (q[i] && q[i].key === old.key) { dup = true; break; }
				}
				if (!dup) {
					q.push({ key: old.key, name: old.name, startPassage: old.startPassage, passages: Array.isArray(old.passages) ? old.passages.slice() : [], manualVariableChanges: old.manualVariableChanges || "", used: true });
				}
				try { delete V.mbCE_pinned; } catch (e) { V.mbCE_pinned = undefined; }
			}
			return q;
		} catch (e) { return null; }
	}
	/* 队列中未触发的固定项（UI 横幅/条目用） */
	function getPinnedScene() {
		try {
			var q = getPinQueue();
			if (!q) { return []; }
			return q.filter(function (p) { return p && p.active !== false && !p.used && p.startPassage; });
		} catch (e) { return []; }
	}
	/* 固定项在队列中的序号（0 起，未固定返回 -1） */
	function pinQueueIndex(key) {
		try {
			var q = getPinQueue();
			if (!q) { return -1; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === key && q[i].active !== false && !q[i].used) { return i; }
			}
		} catch (e) {}
		return -1;
	}
	/* 农场依赖剧情检测：startPassage=Scene Viewer passages 且 manualVariableChanges 执行 farm_work_update
	   （其内部 V.farm.clearing -= 1，$farm 未初始化时直接崩场景查看器 → "setting 'clearing'"） */
	function isFarmDependentScene(P) {
		if (!P || !P.startPassage || P.startPassage !== "Scene Viewer passages") { return false; }
		var mvc = P.manualVariableChanges || "";
		return /farm_work_update/i.test(mvc);
	}
	function farmStateReady() {
		try {
			var V = getV();
			if (!V) { return false; }
			return typeof V.farm === "object" && V.farm !== null;
		} catch (e) { return false; }
	}
	/* 艾弗里庄园状态兜底：$avery_mansion 由本体 avery_mansion_init 初始化，但该初始化被延迟到"进入艾弗里线"才触发；
	   新档/未开线时直达庄园段落或固定触发艾弗里剧情会因 $avery_mansion 缺失而崩
	   （reading 'schedule'/'jobs'/'party_state'/'folder'/'study_unlocked'/'landry' 等，均为 V.avery_mansion 子键；
	   reading 'stage' 来自 $avery_tower）。
	   此处按本体 init widget 的纯字面量结构建空壳（跳过服装/antiques 子 widget，避免副作用与依赖），
	   仅当对象缺失时写入，绝不覆盖已有进度。 */
	/* 农场状态兜底（v1.3.1）：本体社交页在 $farm_stage gte 2 时无条件读 $farm.beasts（马/猪/牛/狗敬重值）与 $farm.aggro，
	   若存档里 farm_stage 已推进但 $farm 整体缺失（早期版本触发农场剧情置高 farm_stage 但未走本体农场线初始化），
	   孤儿院/多瑙河街等含 <<social>> 的段落直接崩（reading 'beasts'/'aggro'）。
	   v1.3.4：睡眠/跨午夜结算（本体 dailyFarmEvents 与农场库存显示）读 $farm.stock.truffles/eggs/milk/cream，
	   该结构仅由本体 <<farm_stock_init>> 在"共享农场"剧情节点初始化——一键置高 farm_stage 后同样缺失 → 睡觉崩（reading 'truffles'），
	   故空壳与残缺分支同步补齐 stock 四字段。
	   按本体农场线初始化结构补空壳：仅当 farm_stage >= 1 且 $farm 缺失/结构残缺时补，绝不覆盖已有进度。 */
	function ensureFarmState() {
		try {
			var V = getV();
			if (!V) { return; }
			var fs = Number(V.farm_stage);
			if (!(fs >= 1)) { return; } /* 农场线未推进 → 本体社交页有 $farm_stage gte 2 条件，不读 $farm */
			if (typeof V.farm !== "object" || V.farm === null) {
				V.farm = {
					beasts: { horses: 0, pigs: 0, cattle: 0, dogs: 0 },
					wage: 15,
					clearing: 100,
					milking: { caught: false, alexNightEvent: false, catchChance: 0, dayMilking: false },
					build_finished: [],
					stock: { truffles: 0, eggs: 0, milk: 0, cream: 0 }
				};
				return;
			}
			/* 已存在但结构残缺 → 只补缺失字段，不覆盖已有值 */
			if (typeof V.farm.beasts !== "object" || V.farm.beasts === null) { V.farm.beasts = {}; }
			var b = V.farm.beasts;
			if (typeof b.horses !== "number") { b.horses = 0; }
			if (typeof b.pigs !== "number") { b.pigs = 0; }
			if (typeof b.cattle !== "number") { b.cattle = 0; }
			if (typeof b.dogs !== "number") { b.dogs = 0; }
			if (typeof V.farm.wage !== "number") { V.farm.wage = 15; }
			if (typeof V.farm.clearing !== "number") { V.farm.clearing = 100; }
			if (typeof V.farm.milking !== "object" || V.farm.milking === null) { V.farm.milking = { caught: false, alexNightEvent: false, catchChance: 0, dayMilking: false }; }
			if (typeof V.farm.milking.catchChance !== "number" || V.farm.milking.catchChance !== V.farm.milking.catchChance) { V.farm.milking.catchChance = 0; }
			if (V.farm.build_finished === undefined || V.farm.build_finished === 0 || V.farm.build_finished === null) { V.farm.build_finished = []; }
			/* v1.3.4：farm_stock 结算防崩——本体只由 <<farm_stock_init>> 建 stock 四字段，缺失时读/累加即崩 */
			if (typeof V.farm.stock !== "object" || V.farm.stock === null) {
				V.farm.stock = { truffles: 0, eggs: 0, milk: 0, cream: 0 };
			}
			var st = V.farm.stock;
			if (typeof st.truffles !== "number") { st.truffles = 0; }
			if (typeof st.eggs !== "number") { st.eggs = 0; }
			if (typeof st.milk !== "number") { st.milk = 0; }
			if (typeof st.cream !== "number") { st.cream = 0; }
		} catch (e) {}
	}
	function ensureAveryMansion() {
		try {
			var V = getV();
			if (!V) { return; }
			if (typeof V.avery_mansion !== "object" || V.avery_mansion === null) {
				V.avery_mansion = {
					version: 5,
					pool: 0, kitchen: 0, lounge: 0, display: 0, bedroom: 0, bathroom: 0,
					dining: 0, garden: 0, study: 0, garage: 0,
					jobs: [],
					schedule: "home",
					state: "normal",
					days: 0, days_absent: 0, walk_cycle: 0, display_antiques: 0,
					food: "hamburger", food_last: "none", date_ready: false,
					rage: { work: false, apologetic: false, dinner_missed: 0, dinner_done: 0, dinner_wrong: false, assess: 0, timer: 0 },
					fox: { progress: 0, known: false },
					date_seen: false,
					party_state: "waiting",
					guest: "Bailey",
					landry: 0, vault_progress: 0,
					study_unlocked: 0, folder: 0, folder_gone: false,
					kitchen_made: 0, recipe: [],
					attend: {}
				};
			}
			if (typeof V.avery_tower !== "object" || V.avery_tower === null) {
				V.avery_tower = { progress: 0, effects: [], stage: 0, intro: 0 };
			}
			/* daily.avery 结构兜底（v1.3.3 → v1.5.1 强化）：本体 0.5.5.5 后 $daily.avery 由艾弗里线入口建为 {}，
			   talk/ask 子对象仅在 avery_mansion_init / 0.5.7.1 版本迁移时创建；直达、重放、固定触发或新档未开
			   艾弗里线时进入 Mansion 系段落（Mansion Talk 调 avery_daily_talk 读 $daily.avery.talk.chat、
			   正文读 .ignore/.limit）会因 $daily.avery.talk 缺失而崩（TypeError reading 'chat'/'ignore'）
			   → 逐层补齐 + 逐字段补齐，绝不覆盖已有值 */
			if (typeof V.daily !== "object" || V.daily === null) {
				/* 防御：$daily 缺失（理论上游戏启动即有）时建最小壳，避免后续读崩 */
				V.daily = {};
			}
			if (typeof V.daily.avery !== "object" || V.daily.avery === null) {
				V.daily.avery = {
					talk: { ignore: false, limit: false, flirt: false, seduce: false, annoyed: 0, chat: 0, chat_limit: 3 },
					ask: { science: false, maths: false, play: false },
					housekeeping_events: {}
				};
			} else {
				var dav = V.daily.avery;
				if (typeof dav.talk !== "object" || dav.talk === null) {
					dav.talk = { ignore: false, limit: false, flirt: false, seduce: false, annoyed: 0, chat: 0, chat_limit: 3 };
				} else {
					/* 对象已存在但个别字段缺失（旧档/异常路径）：逐字段补默认，绝不覆盖已有值 */
					if (typeof dav.talk.ignore !== "boolean") { dav.talk.ignore = false; }
					if (typeof dav.talk.limit !== "boolean") { dav.talk.limit = false; }
					if (typeof dav.talk.flirt !== "boolean") { dav.talk.flirt = false; }
					if (typeof dav.talk.seduce !== "boolean") { dav.talk.seduce = false; }
					if (typeof dav.talk.annoyed !== "number") { dav.talk.annoyed = 0; }
					if (typeof dav.talk.chat !== "number") { dav.talk.chat = 0; }
					if (typeof dav.talk.chat_limit !== "number") {
						var wd = 0;
						try {
							var t = (typeof Time !== "undefined" && Time && typeof Time.weekDay === "number") ? Time.weekDay : 0;
							wd = t;
						} catch (e2) {}
						dav.talk.chat_limit = (wd === 1 || wd === 7) ? 6 : 3;
					}
				}
				if (typeof dav.ask !== "object" || dav.ask === null) {
					dav.ask = { science: false, maths: false, play: false };
				} else {
					if (typeof dav.ask.science !== "boolean") { dav.ask.science = false; }
					if (typeof dav.ask.maths !== "boolean") { dav.ask.maths = false; }
					if (typeof dav.ask.play !== "boolean") { dav.ask.play = false; }
				}
				if (typeof dav.housekeeping_events !== "object" || dav.housekeeping_events === null) {
					dav.housekeeping_events = {};
				}
			}
		} catch (e) {}
	}
	function pinScene(it) {
		try {
			var def = it && it.def;
			if (!def) { return { ok: false, message: "无场景定义，无法固定触发" }; }
			var start = def.startPassage || (Array.isArray(def.passages) && def.passages[0]) || "";
			if (!start) { return { ok: false, message: "该剧情缺少入口段落（startPassage 为空），无法固定触发" }; }
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法固定触发" }; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === it.key && q[i].active !== false && !q[i].used) {
					return { ok: false, message: "该剧情已在固定队列中（第 " + (i + 1) + " 位，按顺序触发）" };
				}
			}
			/* 防崩：农场依赖剧情需 $farm 已初始化（本体 farm_work_update 内 V.farm.clearing -= 1，未初始化直接崩） */
			if (isFarmDependentScene({ startPassage: start, manualVariableChanges: def.manualVariableChanges || "" }) && !farmStateReady()) {
				return { ok: false, message: "「" + (def.name || it.key) + "」依赖农场系统状态（$farm 未初始化）：直接播放会触发本体 farm_work_update 崩溃。请先推进游戏到亚历克斯农场线后再固定" };
			}
			q.push({
				key: it.key,
				name: def.name || it.key,
				startPassage: start,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || "",
				used: false
			});
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			return { ok: true, message: "已固定「" + (def.name || it.key) + "」（队列第 " + pending + " 位）：下次推进剧情即触发，触发一次后自动停止" };
		} catch (e) {
			return { ok: false, message: "固定失败：" + (e && e.message ? e.message : e) };
		}
	}
	/* 固定整条剧情线（v1.3）：把线内全部阶段按顺序加入固定队列，依次触发，触发完自动停止 */
	function pinSceneLine(line) {
		try {
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法固定触发" }; }
			if (!line || !Array.isArray(line.items) || !line.items.length) { return { ok: false, message: "无阶段可固定" }; }
			var added = 0, skipped = 0;
			for (var i = 0; i < line.items.length; i++) {
				var it = line.items[i];
				if (!it || !it.def) { continue; }
				var start = it.def.startPassage || (Array.isArray(it.def.passages) && it.def.passages[0]) || "";
				if (!start) { skipped++; continue; }
				if (isFarmDependentScene({ startPassage: start, manualVariableChanges: it.def.manualVariableChanges || "" }) && !farmStateReady()) { skipped++; continue; }
				var dup = false;
				for (var j = 0; j < q.length; j++) {
					if (q[j] && q[j].key === it.key && q[j].active !== false && !q[j].used) { dup = true; break; }
				}
				if (dup) { skipped++; continue; }
				q.push({
					key: it.key,
					name: it.def.name || it.key,
					startPassage: start,
					passages: Array.isArray(it.def.passages) ? it.def.passages.slice() : [],
					manualVariableChanges: it.def.manualVariableChanges || "",
					used: false
				});
				added++;
			}
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			var nm = (line.items[0].def && line.items[0].def.name) || line.prefix || "";
			if (added > 0) {
				return { ok: true, message: "已固定整线「" + nm + "」系列（" + added + " 个阶段，队列第 " + pending + " 位起，按顺序依次触发，触发完自动停止）" + (skipped ? "；跳过 " + skipped + " 个（已在队列或农场线未开启）" : "") };
			}
			return { ok: false, message: "没有可固定的阶段" + (skipped ? "（" + skipped + " 个被跳过：已在队列或依赖农场线未开启）" : "") };
		} catch (e) { return { ok: false, message: "固定失败：" + (e && e.message ? e.message : e) }; }
	}
	/* 回退：取消指定剧情（key 省略=清空队列）的固定；若正在重放固定场景，立即解冻并返回原位 */
	function unpinScene(key) {
		var V = getV();
		var back = "";
		var changed = false;
		try {
			var q = getPinQueue();
			if (q && q.length) {
				if (key === undefined || key === null || key === "") {
					q.length = 0; changed = true;
				} else {
					for (var i = q.length - 1; i >= 0; i--) {
						if (q[i] && q[i].key === key) { q.splice(i, 1); changed = true; }
					}
				}
			}
			if (V && V.replayScene) {
				changed = true;
				/* v1.8.19 防困播放器重构（用户实测：手动取消后仍被困场景播放器）+ v1.9.4 根治：
				   根因一：back = exitpassage || currentPassageName() 的兜底会让"玩家正处于播放器段落
				   时取消"变成原地跳转（跳去当前播放器段落），且随后删 replayScene → 播放器 default 分支
				   的 Back 链接无源 → 退出按钮消失 → 被困。
				   根因二：先调 unfreezePlayerStats（wikifier）会经 mbCEUnfreezeHook 提前删掉 replayScene，
				   跳转目标若恰为播放器段落同样导致 Back 无源。
				   v1.9.4：合并 inPlayer 分支——重放中取消固定，一律 Engine.play(back) 强制跳回原位再清理，
				   不再区分"是否原版 Scene Viewer 播放器段落"。覆盖用户实测的模组恋爱播放器场景
				   （播放器停在第 N 张图、手动取消后仍被困）：back 有效即强制脱离任何播放器/中间段落。
				   play(back) 触发 :passageoverride（dest=back → 489 行 Back 返回原位分支）自然清理
				   used 队列项；随后手动清 replayScene/标记兜底（幂等）。 */
				back = (V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				/* 先清 sceneViewSwitch 为无效值 → Scene Viewer passages 的 switch 走 default（顺序不可反） */
				V.sceneViewSwitch = "MB_CE_END";
				if (back) {
					var ep = getEnginePlayFn();
					if (ep) {
						/* v1.9.5-自检：跳转可用才清理——若 Engine 不可用（极端），保留 replayScene/标记，
						   播放器 Back 链接仍有源，避免重蹈「删 replayScene → Back 无源 → 被困」覆辙 */
						try { ep.play.call(ep.e, back, true); } catch (e) {}
						mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					}
				}
				/* back 为空：保留 replayScene/标记
				   （播放器 default 的 Back 链接依赖它），不主动跳转——玩家经 Back 退出
				   （489 行路径清理）或播放器自身退出调用 unfreeze → mbCEUnfreezeHook 兜底清理。 */
			}
		} catch (e) {}
		return changed;
	}
	/* 剧情入口段落/剧情名 → 匹配的场景组 id（联动解锁用）；
	   兼容 Maplebirch 场景查看器入口前缀（SV xxx / Scene Viewer xxx） */
	function placeIdForPassage(startPassage, sceneName) {
		try {
			var cands = [];
			if (startPassage) {
				cands.push(startPassage);
				if (startPassage.indexOf("SV ") === 0) { cands.push(startPassage.slice(3)); }
				if (startPassage.indexOf("Scene Viewer ") === 0) { cands.push(startPassage.slice(13)); }
			}
			if (sceneName) { cands.push(sceneName); }
			for (var i = 0; i < PLACE_GROUPS.length; i++) {
				var g = PLACE_GROUPS[i];
				if (!g || typeof g.match !== "function") { continue; }
				for (var j = 0; j < cands.length; j++) {
					if (cands[j] && g.match(cands[j])) { return g.id; }
				}
			}
		} catch (e) {}
		return null;
	}
	/* 场景联动解锁：剧情触发完成 → 记录对应场景组解锁（场景页显示已解锁并可直接直达） */
	function unlockPlaceForScene(P) {
		try {
			var V = getV();
			if (!V || !P || !P.startPassage) { return; }
			if (!V.mbCE_unlockedPlaces || typeof V.mbCE_unlockedPlaces !== "object") { V.mbCE_unlockedPlaces = {}; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			/* 入口为 SV 前缀等特殊形态时，用剧情包含段落兜底匹配（如 "Manor Kylar Room" 在 passages 中） */
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) {
				V.mbCE_unlockedPlaces[gid] = { key: P.key, name: P.name, startPassage: P.startPassage, t: Date.now() };
			}
		} catch (e) {}
	}
	/* 世界入口解锁表（v1.3）：各组场景在游戏世界里的原版进入条件（已从本体源码实证）：
	   - kylar_manor：多瑙河街 → "Kylar's manor" 链接，条件 $syndromekylar gte 1
	   - orphanage_loft：孤儿院大厅 → "Loft" 链接，条件 $loft_known is 1
	   - avery_mansion：多瑙河街 → "Avery's mansion" 链接，条件 $avery_mansion 存在且 fate 非 fallen/kicked（v1.2.1 兜底已自动满足）
	   - sirris_places：成人商店 → "Approach Sirris" 链接，条件 $adultshopstate 非 "closed"（营业时间仍受原版控制）
	   - elk_compound（v1.7.0）：Elk Street → "Approach the compound" 链接，条件 $compound.allowed 为 true
	     （未允许时仅显示 "Sneak into the compound" 潜入链接，crimeUp 30 trespassing——已从本体源码实证）
	   - doren_flat / sydney_temple / gwylan_garden：无持久世界入口（剧情/时间触发或动态位置）→ 不写入 */
	var WORLD_UNLOCKS = {
		"kylar_manor": { var: "syndromekylar", set: 1, entry: "多瑙河街 → Kylar's manor（庄园花园）" },
		"orphanage_loft": { var: "loft_known", set: 1, entry: "孤儿院大厅 → Loft（阁楼）" },
		"avery_mansion": { entry: "多瑙河街 → Avery's mansion（已由庄园状态兜底自动解锁）" },
		"sirris_places": { var: "adultshopstate", set: "open", entry: "成人商店 → 接近西里斯（营业时段可见）" },
		"elk_compound": { path: "compound.allowed", set: true, entry: "Elk Street → Approach the compound（需 $compound.allowed）" }
	};
	/* 幂等写入世界入口条件：已有更高/相同值不覆盖，只补缺失或更低值（v1.7.0 支持子路径 path 型，如 compound.allowed） */
	function applyWorldUnlock(gid) {
		try {
			var V = getV();
			if (!V || !gid || !WORLD_UNLOCKS[gid]) { return; }
			var w = WORLD_UNLOCKS[gid];
			if (w.path !== undefined) {
				var segs = String(w.path).split(".");
				var cur = V, i;
				for (i = 0; i < segs.length - 1; i++) {
					if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") {
						/* 父级缺失则逐层补空对象壳（防 undefined 写入） */
						cur[segs[i]] = {};
					}
					cur = cur[segs[i]];
				}
				if (cur[segs[segs.length - 1]] !== w.set) { cur[segs[segs.length - 1]] = w.set; }
				/* 顺带补 discovered（Elk Street 逻辑：discovered 才显示大院入口判定） */
				if (gid === "elk_compound" && V.compound && V.compound.discovered !== true) { V.compound.discovered = true; }
				return;
			}
			if (w.var === undefined) { return; }
			if (typeof w.set === "number") {
				var cur2 = typeof V[w.var] === "number" ? V[w.var] : 0;
				if (cur2 < w.set) { V[w.var] = w.set; }
			} else if (V[w.var] === undefined || V[w.var] === null || V[w.var] === "") {
				V[w.var] = w.set;
			}
		} catch (e) {}
	}
	/* 剧情 → 其场景组的世界入口解锁（联动解锁时一并调用） */
	function applyWorldUnlockForScene(P) {
		try {
			if (!P || !P.startPassage) { return; }
			var gid = placeIdForPassage(P.startPassage, P.name);
			if (!gid && Array.isArray(P.passages)) {
				for (var i = 0; i < P.passages.length && !gid; i++) { gid = placeIdForPassage(P.passages[i], P.name); }
			}
			if (gid) { applyWorldUnlock(gid); }
		} catch (e) {}
	}
	/* 执行场景初始变量（manualVariableChanges，与场景查看器点「重放」一致） */
	function execTweeMacros(str) {
		try {
			if (typeof str !== "string" || !str || typeof document === "undefined" || typeof Wikifier === "undefined") { return; }
			var holder = document.createElement("span");
			holder.style.display = "none";
			document.body.appendChild(holder);
			try { new Wikifier(holder, str); }
			finally { if (holder.parentNode) { holder.parentNode.removeChild(holder); } }
		} catch (e) {}
	}
	/* 当前段落名：SugarCube 全局 passage() 优先，V.passage 兜底（真实环境可靠取到"返回原位"目标） */
	function currentPassageName() {
		try { if (typeof passage === "function") { var p = passage(); if (typeof p === "string" && p) { return p; } } } catch (e) {}
		try { var V2 = getV(); if (V2 && typeof V2.passage === "string" && V2.passage) { return V2.passage; } } catch (e) {}
		return "";
	}
	/* v1.4.8：清理队列中已触发（used）的固定项并联动解锁（三个重放终点共用） */
	function cleanupUsedPins() {
		try {
			var Vq = getV();
			if (!Vq) { return; }
			var qc = Vq.mbCE_queue;
			if (Array.isArray(qc)) {
				for (var i2 = 0; i2 < qc.length; i2++) {
					if (qc[i2] && qc[i2].used) {
						unlockPlaceForScene(qc[i2]);
						applyWorldUnlockForScene(qc[i2]);
					}
				}
				for (var i3 = qc.length - 1; i3 >= 0; i3--) {
					if (qc[i3] && qc[i3].used) { qc.splice(i3, 1); }
				}
			}
		} catch (e) {}
	}
	/* v1.9.5-自检：清重放残留的统一入口（unpinScene / onPassageOverride 各终点共用，消除 5 处分叉不一致）。
	   顺序固定：先清 replayScene/标记，再 unfreeze（避免 mbCEUnfreezeHook 在清理前重复走 cleanup）；
	   skipUnfreeze=true 时不调 unfreeze（原版手动重放场景不干预原版流程）。 */
	function mbCEClearReplay(skipUnfreeze) {
		var Vr = getV();
		try { Vr.replayScene = undefined; } catch (e) { Vr.replayScene = undefined; }
		try { Vr.mbCE_replayOnce = undefined; Vr.mbCE_replayPending = undefined; } catch (e) {}
		if (!skipUnfreeze) {
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("unfreezePlayerStats"); } } catch (e) {}
		}
	}
	/* :passageoverride 钩子：固定触发判定（在 SugarCube 原版 redirect 之前改 passageArgs.name） */
	function onPassageOverride(passageArgs) {
		try {
			var V = getV();
			if (!V) { return; }
			var dest = passageArgs && passageArgs.name;
			/* v1.5.1：Mansion 系段落兜底——无论以何种方式进入艾弗里庄园段落（场景直达、场景查看器重放、
			   固定触发、第二天正常日常），只要 $daily.avery.talk 缺失，avery_daily_talk / Mansion Talk 正文
			   都会 TypeError（reading 'chat'/'ignore'）；在固定触发判定前无条件兜底（缺失才建，不覆盖进度） */
			if (typeof dest === "string" && dest.length > 0 &&
				(dest.indexOf("Mansion") === 0 || dest.indexOf("Avery") === 0 || dest.indexOf("Avery's") === 0)) {
				ensureAveryMansion();
			}
			/* 原版重放结束（Scene Viewer End 且正处于重放）→ 记录场景解锁 + 清理已触发项 */
			if (dest === "Scene Viewer End" && V.replayScene) {
				cleanupUsedPins();
				/* v1.4.8：MOD 固定触发的重放播放完（到 Scene Viewer End）→ 自动返回原位（exitpassage）
				   并解除固定；跳过 End 段落（原版 End 显示 "Exit scene" 需手动点、且回的是场景查看器列表）。
				   原版手动重放保持原版行为：End → Exit scene 回场景查看器。 */
				var wasMod = !!V.mbCE_replayOnce;
				var backTo = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
				mbCEClearReplay(!wasMod); /* v1.9.5-自检：统一清理入口（原版手动重放不 unfreeze） */
				if (wasMod && backTo && passageArgs) { passageArgs.name = backTo; }
				return;
			}
			if (V.replayScene) {
				/* 原版手动重放（非 MOD 固定触发）→ 交给原版处理，不干预 */
				if (!V.mbCE_replayOnce) { return; }
				/* v1.4.8：MOD 固定触发的 case 场景播放完链回 Scene Viewer passages（非首次进入）→
				   自动返回原位并解除固定（跳过原版 default 的 "Error occurred" + 手动 Back 步） */
				if (dest === "Scene Viewer passages" && !V.mbCE_replayPending) {
					cleanupUsedPins();
					var backS = (V.replayScene && V.replayScene.exitpassage) ? V.replayScene.exitpassage : "";
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					if (backS && passageArgs) { passageArgs.name = backS; }
					return;
				}
				/* v1.4.5：原版重放经 Back 正常返回原位（exitpassage）→ 清理残留（replayScene/标记/已用队列项），
				   避免残留导致后续取消固定误判"正在重放"、以及再次重放时被残留干扰 */
				if (dest === (V.replayScene.exitpassage || "")) {
					try {
						var qe = V.mbCE_queue;
						if (Array.isArray(qe)) {
							for (var ie = qe.length - 1; ie >= 0; ie--) {
								if (qe[ie] && qe[ie].used) {
									unlockPlaceForScene(qe[ie]);
									applyWorldUnlockForScene(qe[ie]);
									qe.splice(ie, 1);
								}
							}
						}
					} catch (e) {}
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
					return;
				}
				/* MOD 固定触发的重放：仅已知确定性逃逸终点到达时清理残留（农场剧情结束直接去 Farm Work 而非回 Scene Viewer），
				   否则一律视为仍在重放（含剧情中间段落不在注册表列表的情况）→ 不干预、不触发 */
				if (dest === "Farm Work") {
					/* 农场剧情确定性终点：结束即清理残留（unfreeze + 清标记），并移除已触发项（同 Scene Viewer End） */
					try {
						var qf = V.mbCE_queue;
						if (Array.isArray(qf)) {
							for (var if2 = qf.length - 1; if2 >= 0; if2--) {
								if (qf[if2] && qf[if2].used) {
									unlockPlaceForScene(qf[if2]);
									applyWorldUnlockForScene(qf[if2]);
									qf.splice(if2, 1);
								}
							}
						}
					} catch (e) {}
					mbCEClearReplay(); /* v1.9.5-自检：统一清理入口 */
				} else {
					return; /* 仍在重放链内 → 不触发 */
				}
			}
			var q = getPinQueue();
			if (!q) { return; }
			var P = null;
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].active !== false && !q[i].used && q[i].startPassage) { P = q[i]; break; }
			}
			if (!P) { return; }
			if (!dest || dest === P.startPassage || dest === "Scene Viewer End") { return; }
			if (Array.isArray(P.passages) && P.passages.indexOf(dest) !== -1) { return; }
			/* 防崩：农场依赖剧情且 $farm 未初始化 → 本次不触发（保留队列项，待农场线开启后自动可触发） */
			if (isFarmDependentScene(P) && !farmStateReady()) { return; }
			/* 防崩：艾弗里庄园/森林商店等段落依赖 $avery_mansion（可能延迟初始化）→ 触发前兜底 */
			ensureAveryMansion();
			/* 防崩：农场依赖剧情需 $farm 结构存在（触发前兜底，缺失才补，不覆盖已有进度） */
			ensureFarmState();
			/* 启动原版重放：先执行场景初始变量 → 冻结属性 → 设 $replayScene → 重定向入口 */
			if (P.manualVariableChanges) { execTweeMacros(P.manualVariableChanges); }
			try { if (typeof window !== "undefined" && window.wikifier) { window.wikifier("freezePlayerStats"); } } catch (e) {}
			V.replayScene = {
				name: P.name,
				startPassage: P.startPassage,
				passages: Array.isArray(P.passages) ? P.passages.slice() : [],
				exitpassage: currentPassageName()
			};
			V.mbCE_replayOnce = true;  /* 本重放由 MOD 固定触发启动：Scene Viewer passages 结束后走 default 退出，不再重播 */
			/* v1.4.8：仅当场景入口是 Scene Viewer passages 才需"首次保留 sceneViewSwitch"；
			   直入剧情段落的场景（如孤儿院 SV Street Bully Orphanage Go）不设 pending，
			   避免链回 Scene Viewer passages 时被误判为首次 → 无法自动回原位 */
			V.mbCE_replayPending = (P.startPassage === "Scene Viewer passages");
			passageArgs.name = P.startPassage;
			P.used = true; /* 一次性：触发后不再重复触发 */
			unlockPlaceForScene(P); /* 联动解锁：触发即解锁所在场景组（如凯拉尔剧情 → 庄园可直达） */
			applyWorldUnlockForScene(P); /* 世界入口解锁：写入原版进入条件（多瑙河街→庄园等） */
		} catch (e) {}
	}
	function hookPassageOverride() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			/* SugarCube 自定义事件系统（jQLite）：与 DoL 本体 $(document).one(':passageend',…) 一致。
			   四巡：命名空间防重——重载/重复注入时先 off 再 on，避免 jQuery handler 无限累积 */
			$(document).off(":passageoverride.mbce").on(":passageoverride.mbce", function (ev, passageArgs) {
				onPassageOverride(passageArgs);
			});
		} catch (e) {}
	}
	/* 场景查看器段落初始化拦截（防"播放完又播放"无限循环）：
	   本体的 Scene Viewer passages 段落在 <<switch $sceneViewSwitch>> 里无条件播放 case 剧情，
	   剧情 widget 结束若链回该段落会再次命中 case → 无限循环（且 replayScene 只在 default/End 清理）。
	   机制：固定触发跳转前设 mbCE_replayPending；首次进入该段落（pending=true）→ 消费标记、保留
	   sceneViewSwitch（case 正常播放）；剧情结束链回（pending=false 且处于我们的重放）→ 清
	   sceneViewSwitch 为无效值 → switch 走 default → 原版给出 Back 链接返回原位，不再重播。 */
	function mbCEOnPassageInit(title) {
		try {
			/* v1.3.5：格威岚场景临时变量全局兜底——每次进入任意段落都先确保
			   T.gwylanStatus / T.gwylanTF 已初始化（缺失才补，已有绝不覆盖）。
			   本体 Gwylan Ritual Start Garden 等段落靠 <<run statusCheck("Gwylan")>>
			   初始化这两个临时变量，但 statusCheck 仅在 C.npc.Gwylan.init === 1 时才调用
			   gwylanStatusCheck()（新存档未见过格威岚即不调用）；且 gwylanStatusCheck()
			   在 V.gwylanTalked/V.gwylanSeen/V.gwylan 缺失时早退，只设 T.gwylanStatus=[]、
			   不设 T.gwylanTF。新存档场景直达/固定触发格威岚段落 → 读 _gwylanStatus/
			   _gwylanTF 即崩（reading 'includesAny' / 'tail'）。全局兜底可覆盖任何段落名
			   （含框架改段落名/宿主段落内嵌格威岚内容的渲染路径）。 */
			ensureGwylanSceneState();
			/* v1.9.x 庄园自动维护每日调度：任意段落进入时检查游戏日变化，
			   执行已开启的自动维护项（AutoClean 模式，见 03-global.js mcAutoMaintainTick） */
			try { mcAutoMaintainTick(); } catch (e) {}
			if (title !== "Scene Viewer passages") { return; }
			var V = getV();
			if (!V) { return; }
			if (V.mbCE_replayPending) { V.mbCE_replayPending = false; return; }
			if (V.replayScene && V.mbCE_replayOnce) { V.sceneViewSwitch = "MB_CE_END"; }
		} catch (e) {}
	}
	function hookPassageInit() {
		try {
			if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
			$(document).off(":passageinit.mbce").on(":passageinit.mbce", function (ev, passage) {
				try {
					var t = (passage && passage.title) ? passage.title : "";
					mbCEOnPassageInit(t);
				} catch (e) {}
			});
		} catch (e) {}
	}
	/* v1.8.19：播放结束自动清理——包装 window.unfreezePlayerStats。
	   背景（用户实测）：固定 MOD 剧情播放完一次后不自动取消、仍重新播放；手动取消后仍被困播放器。
	   根因：结束判定只认 4 个硬编码段落名（Scene Viewer End / Scene Viewer passages / exitpassage /
	   Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景，结束段落为框架自有名，
	   不走原版 Scene Viewer 通道）的结束段落不被识别 → 队列 used 项永不清理 + replayScene 残留 →
	   下次推进剧情再次触发（循环）或拦截后续固定。
	   修复：任何合法 unfreezePlayerStats 调用（原版 Scene Viewer 退出 / 框架播放器结束 / mod 播放器
	   结束都会解冻）都视为"场景播放结束"→ 清理队列 used 项 + 清 replayScene/标记。不再依赖段落名。 */
	function hookUnfreezePlayerStats() {
		try {
			if (typeof window === "undefined" || !window) { return; }
			var orig = window.unfreezePlayerStats;
			if (typeof orig !== "function" || window.__mbCEUnfreezeHooked) { return; }
			window.__mbCEUnfreezeHooked = true;
			window.unfreezePlayerStats = function () {
				try {
					var V = getV();
					if (V && V.replayScene && V.mbCE_replayOnce) {
						/* MOD 固定触发的重放中收到 unfreeze = 播放结束 → 清理已触发项 + 重放状态 */
						cleanupUsedPins();
						try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
						try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) {}
					}
				} catch (e) {}
				try { return orig.apply(window, arguments); } catch (e) {}
			};
		} catch (e) {}
	}

