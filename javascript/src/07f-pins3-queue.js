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
	function ensureFarmState(force) {
		try {
			var V = getV();
			if (!V) { return; }
			var fs = Number(V.farm_stage);
			if (!(fs >= 1) && !force) { return; } /* 农场线未推进且未强制 → 本体社交页有 $farm_stage gte 2 条件，不读 $farm */
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
			/* v2.0.20：农场袭击倒计时防 NaN —— 本体每日结算 `V.farm_attack_timer--`，
			   只在「共享农场」首次（to 30）与 Farm Assault 开场/结算（random(17,24)）初始化；
			   作弊直写 farm_stage >= 7 会绕过这些节点 -> undefined-- = NaN，
			   而 `NaN < 0` 恒假 -> farm_attack_auto 永不触发，雷米袭击线永久死锁，Journal 打出 [number NaN]。
			   仅农场线已推进（fs >= 1）时补，不凭空写。 */
			if (fs >= 1 && (typeof V.farm_attack_timer !== "number" || isNaN(V.farm_attack_timer))) {
				V.farm_attack_timer = 30;
			}
		} catch (e) { /* farm/stock 结构异常时跳过补齐（不凭空造 farm 根，交由上层拒绝） */ }
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
		} catch (e) { /* 艾弗里线结构兜底整体失败（存档只读/被冻结）→ 不阻断直达与重放，由目标段落自身兜底 */ }
	}
	function pinScene(it) {
		try {
			var def = it && it.def;
			if (!def) { return { ok: false, message: "无场景定义，无法锚定" }; }
			var start = def.startPassage || (Array.isArray(def.passages) && def.passages[0]) || "";
			if (!start) { return { ok: false, message: "该剧情缺少入口段落（startPassage 为空），无法锚定" }; }
			/* v1.9.23：锚定必须有地点元数据（走到该地点交互时触发）；无元数据 → 禁止锚定（旧固定触发已移除） */
			var meta = sceneAnchorMeta(it.key, def);
			if (!meta || !meta.location) { return { ok: false, message: "「" + (def.name || it.key) + "」未标注触发地点（第一批元数据未覆盖该场景），暂不可锚定" }; }
			var q = getPinQueue();
			if (!q) { return { ok: false, message: "存档不可用，无法锚定" }; }
			for (var i = 0; i < q.length; i++) {
				if (q[i] && q[i].key === it.key && q[i].active !== false && !q[i].used) {
					return { ok: false, message: "该剧情已在锚定队列中（第 " + (i + 1) + " 位，走到触发地点时弹确认条）" };
				}
			}
			/* 防崩：农场依赖剧情需 $farm 已初始化（本体 farm_work_update 内 V.farm.clearing -= 1，未初始化直接崩） */
			if (isFarmDependentScene({ startPassage: start, manualVariableChanges: def.manualVariableChanges || "" }) && !farmStateReady()) {
				return { ok: false, message: "「" + (def.name || it.key) + "」依赖农场系统状态（$farm 未初始化）：直接播放会触发本体 farm_work_update 崩溃。请先推进游戏到艾利克斯农场线后再锚定" };
			}
			q.push({
				key: it.key,
				name: def.name || it.key,
				startPassage: start,
				passages: Array.isArray(def.passages) ? def.passages.slice() : [],
				manualVariableChanges: def.manualVariableChanges || "",
				used: false,
				anchor: { location: meta.location, timeNote: meta.timeNote || "" }
			});
			var pending = q.filter(function (p) { return p.active !== false && !p.used; }).length;
			/* 锚定提示：地点/时间 + 未完成前置（已完成的不提示；前置缺失不禁止锚定） */
			var pre = pendingPreconds(it.key);
			var msg = "已锚定「" + (def.name || it.key) + "」（队列第 " + pending + " 位）：触发地点「" + locLabel(meta.location) + "」";
			if (meta.timeNote) { msg += "｜时间 " + meta.timeNote; }
			msg += pre.length ? "｜前置未完成：" + pre.join("、") : "｜前置均已达成";
			msg += "。走到该地点交互时弹确认条，确认后触发，播放完标「已完成 ✓」";
			return { ok: true, message: msg };
		} catch (e) {
			return { ok: false, message: "锚定失败：" + mbCEErr(e) };
		}
	}
	/* 锚定整条剧情线（v1.9.23）：把线内已标注触发地点的全部阶段按顺序加入锚定队列，
	   走到各阶段发生地点交互时依次触发，触发完自动完成；无地点元数据的阶段跳过并提示 */
	function pinSceneLine(line) {
		try {
			if (!line || !Array.isArray(line.items) || !line.items.length) { return { ok: false, message: "无阶段可锚定" }; }
			var added = 0, noMeta = 0, dup = 0, farm = 0, other = 0;
			for (var i = 0; i < line.items.length; i++) {
				var it = line.items[i];
				if (!it || !it.def) { continue; }
				var r = pinScene(it);
				if (r.ok) { added++; continue; }
				if (r.message.indexOf("未标注触发地点") >= 0) { noMeta++; }
				else if (r.message.indexOf("已在锚定队列") >= 0) { dup++; }
				else if (r.message.indexOf("依赖农场系统状态") >= 0) { farm++; }
				else { other++; }
			}
			var nm = (line.items[0].def && line.items[0].def.name) || line.prefix || "";
			if (added > 0) {
				var skipParts = [];
				if (noMeta) { skipParts.push(noMeta + " 个未标注触发地点"); }
				if (dup) { skipParts.push(dup + " 个已在队列"); }
				if (farm) { skipParts.push(farm + " 个依赖农场线未开启"); }
				if (other) { skipParts.push(other + " 个缺少入口段落"); }
				return { ok: true, message: "已锚定整线「" + nm + "」系列（" + added + " 个阶段入队：走到各阶段发生地点交互时弹确认条，触发完自动完成）" + (skipParts.length ? "；跳过 " + skipParts.join("、") : "") };
			}
			var reason = noMeta ? "：这些阶段均未标注触发地点（第一批元数据未覆盖），暂不可锚定" : (dup ? "：已在锚定队列中" : (farm ? "：依赖农场线未开启" : ""));
			return { ok: false, message: "没有可锚定的阶段" + reason };
		} catch (e) { return { ok: false, message: "锚定失败：" + mbCEErr(e) }; }
	}
	/* 回退：取消指定剧情（key 省略=清空队列）的固定；若正在重放固定场景，立即解冻并返回原位 */
