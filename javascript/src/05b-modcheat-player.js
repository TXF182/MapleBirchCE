	/* ============ v1.7.0 玩家属性全量编辑（Mod作弊 主容器页「玩家自己」入口）
	       数据源：① V.player 全量（递归限深 3，循环引用防崩）；② 模组属性 = 运行时 V 顶层键
	       - ORIGINAL_V_ROOT_KEYS - CHEAT_VANILLA_ROOTS - mbCE_*（与原版比对，只添加没有的）。
	       可改：number（数字输入）/ boolean（勾选）/ 短字符串阶段（≤24 字符且无空白 → 文本输入）；
	       只读：长字符串 / 函数 / undefined / null / 深度超限 / 循环引用。
	       写入：复用 cheatWriteValue（modId="player-self"，root=player 或模组键不在原版黑名单），
	       mbCE_wrote 留痕 + 每项回退按钮。 ============ */
	var curPlayerSection = "player";
	function actPlayer(res, path) {
		setStatus(res && res.message ? res.message : "操作完成", res && res.ok ? "mce-ok" : "mce-err");
		/* 六巡：快速面板数值操作局部刷新该行（不再全量重建 33 行 + 特质区）；特质类操作无 path → 全量重建 */
		if (path) {
			var pane = root.querySelector('[data-pane="mods"]');
			/* 兜底分支必须带 "quick:" 前缀（与渲染 setAttribute 一致）；无 CSS.escape 时仅转义引号/反斜杠 */
			var esc = (typeof CSS !== "undefined" && typeof CSS.escape === "function") ? CSS.escape("quick:" + path) : String("quick:" + path).replace(/["\\]/g, "\\$&");
			var row = pane ? pane.querySelector('[data-mce-key="' + esc + '"]') : null;
			if (row) {
				/* v2.0.0.007 好友实测修复：局部刷新必须连按钮状态一起同步——
				   ① 点「锁定」后按钮要立刻变「已锁定」（原先只刷 input/label，得切页才变）
				   ② 行标签走 ensureQuickIndex 取中文 label（索引未建时退回英文路径 = 「点了变英文」根因） */
				mbCESyncQuickRow(row, path);
				/* v1.9.14 效果2：写入成功 → 该行金底闪烁 */
				if (res && res.ok) { mbCEFlash(row); }
				return;
			}
		}
		renderPlayerEdit();
	}
	/* v1.8.12 功能6：能力项数据驱动重构——数据表声明式（path/label/type/min/max/note），渲染与钳制统一走表数据。
	   口径：purity 内部 0-2000（UI 显示 %）；beauty/physique 及意志/意识/淫乱/暴露癖/异种癖按用户要求无硬上限
	   （999999 仅防误输入，非游戏上限；v1.8.19 体能 physique 由 0-100 提为无上限）；技能/性技能/成绩/武器 0-1000（百分比量纲）。 */
	var PANEL_QUICK_GROUPS = [
		{ title: "核心属性", items: [
			{ path: "purity", label: zhKey("purity"), min: 0, max: 2000, note: "面板显示 0-100%，内部 0-2000" },
			{ path: "beauty", label: zhKey("beauty"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "physique", label: zhKey("physique"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "willpower", label: zhKey("willpower"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "awareness", label: zhKey("awareness"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "promiscuity", label: zhKey("promiscuity"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "exhibitionism", label: zhKey("exhibitionism"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "deviancy", label: zhKey("deviancy"), min: 0, max: 999999, note: "无硬上限，仅防误输入" },
			{ path: "money", label: zhKey("money"), min: 0, max: 99999999, note: "单位 £，建议输入整数；上限已放开（防误输入）" }
		] },
		{ title: "基础技能", items: [
			{ path: "skulduggery", label: zhKey("skulduggery"), min: 0, max: 1000 },
			{ path: "danceskill", label: zhKey("danceskill"), min: 0, max: 1000 },
			{ path: "swimmingskill", label: zhKey("swimmingskill"), min: 0, max: 1000 },
			{ path: "athletics", label: zhKey("athletics"), min: 0, max: 1000 },
			{ path: "tending", label: zhKey("tending"), min: 0, max: 1000 },
			{ path: "housekeeping", label: zhKey("housekeeping"), min: 0, max: 1000 }
		] },
		{ title: "性技能", items: [
			{ path: "seductionskill", label: zhKey("seductionskill"), min: 0, max: 1000 },
			{ path: "oralskill", label: zhKey("oralskill"), min: 0, max: 1000 },
			{ path: "chestskill", label: zhKey("chestskill"), min: 0, max: 1000 },
			{ path: "handskill", label: zhKey("handskill"), min: 0, max: 1000 },
			{ path: "bottomskill", label: zhKey("bottomskill"), min: 0, max: 1000 },
			{ path: "penileskill", label: zhKey("penileskill"), min: 0, max: 1000 },
			{ path: "vaginalskill", label: zhKey("vaginalskill"), min: 0, max: 1000 },
			{ path: "analskill", label: zhKey("analskill"), min: 0, max: 1000 },
			{ path: "thighskill", label: zhKey("thighskill"), min: 0, max: 1000 },
			{ path: "feetskill", label: zhKey("feetskill"), min: 0, max: 1000 }
		] },
		{ title: "学校成绩", items: [
			{ path: "science", label: zhKey("science"), min: 0, max: 1000 },
			{ path: "maths", label: zhKey("maths"), min: 0, max: 1000 },
			{ path: "english", label: zhKey("english"), min: 0, max: 1000 },
			{ path: "history", label: zhKey("history"), min: 0, max: 1000 }
		] },
		{ title: "武器技能", items: [
			{ path: "prof.spray", label: zhKey("prof.spray"), min: 0, max: 1000 },
			{ path: "prof.baton", label: zhKey("prof.baton"), min: 0, max: 1000 },
			{ path: "prof.whip", label: zhKey("prof.whip"), min: 0, max: 1000 },
			{ path: "prof.net", label: zhKey("prof.net"), min: 0, max: 1000 },
			{ path: "prof.pickaxe", label: zhKey("prof.pickaxe"), min: 0, max: 1000 }
		] },
		/* v1.9.13 负面状态：原版 V 键实证存在（stress/trauma 等均不在原版黑名单，
		   玩家面板通道可直写；上限不钳制，下限 0 防负值破坏） */
		{ title: "负面状态", items: [
			{ path: "stress", label: zhKey("stress"), min: 0, max: 999999, note: "原版上限 V.stressmax（每日钳制），CE 直写不钳" },
			{ path: "trauma", label: zhKey("trauma"), min: 0, max: 999999, note: "原版上限 V.traumamax；≥1000 触发创伤安全屋线" },
			{ path: "pain", label: zhKey("pain"), min: 0, max: 999999, note: "原版伤害值（HP 相关），0 即满血" },
			{ path: "arousal", label: zhKey("arousal"), min: 0, max: 999999, note: "原版上限 V.arousalmax，面板显示为百分比" },
			{ path: "tiredness", label: zhKey("tiredness"), min: 0, max: 999999, note: "原版上限 C.tiredness.max；≥上限 75% 触发昏倒" },
			{ path: "anxiety", label: zhKey("anxiety"), min: 0, max: 999999, note: "原版档位 0-2（≥2 触发事件），直写不钳" },
			{ path: "delinquency", label: zhKey("delinquency"), min: -100, max: 999999, note: "品行值：≤0 老师宠儿、≥1000 老师噩梦（feat 阈值）" },
			{ path: "drugged", label: zhKey("drugged"), min: 0, max: 1000, note: "原版 0-1000，越高药效越强" },
			{ path: "drunk", label: zhKey("drunk"), min: 0, max: 999999, note: "≥240 判定醉酒；写 0 直接醒酒" }
		] },
		/* v1.9.13 名声：fame 为原版 V 对象（fame.prostitution 等子键实证存在，
		   玩家面板通道直写对象子键，父级 V.fame 存在即合法） */
		{ title: "名声（fame）", items: [
			{ path: "fame.prostitution", label: zhKey("fame.prostitution"), min: 0, max: 999999 },
			{ path: "fame.sex", label: zhKey("fame.sex"), min: 0, max: 999999 },
			{ path: "fame.rape", label: zhKey("fame.rape"), min: 0, max: 999999 },
			{ path: "fame.exhibitionism", label: zhKey("fame.exhibitionism"), min: 0, max: 999999 },
			{ path: "fame.bestiality", label: zhKey("fame.bestiality"), min: 0, max: 999999 },
			{ path: "fame.good", label: zhKey("fame.good"), min: 0, max: 999999, note: "善行积累（≥1000 触发 A Good Reputation 线）" }
		] }
	];
	/* v1.8.12 功能13：数据表路径索引（quickWrite 查 min/max 用，懒建）
	   v2.0.0.007：抽成 ensureQuickIndex()，局部刷新（actPlayer）也走它——已建索引才拿得到中文 label，
	   否则行标签退回英文路径（好友实测「点锁定后技能名变英文」的根因） */
	var PANEL_QUICK_PATH_INDEX = null;
	function ensureQuickIndex() {
		if (PANEL_QUICK_PATH_INDEX) { return PANEL_QUICK_PATH_INDEX; }
		PANEL_QUICK_PATH_INDEX = {};
		PANEL_QUICK_GROUPS.forEach(function (g) {
			g.items.forEach(function (it) { PANEL_QUICK_PATH_INDEX[it.path] = it; });
		});
		return PANEL_QUICK_PATH_INDEX;
	}
	function quickReadValue(path) {
		try {
			var V2 = getV();
			if (!V2) { return null; }
			/* v1.9.13：通用点路径读取（prof.spray / fame.prostitution 等对象子键，
			   逐级下探，父级不存在返回 undefined，不抛错） */
			var parts = String(path).split(".");
			if (parts.length > 1) {
				var cur = V2;
				for (var qi = 0; qi < parts.length - 1; qi++) {
					if (cur == null || typeof cur[parts[qi]] !== "object") { return undefined; }
					cur = cur[parts[qi]];
				}
				return cur[parts[parts.length - 1]];
			}
			return V2[path];
		} catch (e) { return null; }
	}
	/* 武器父级兜底：$prof 缺失时补空壳（只建不覆盖），使 prof.* 可安全写入 */
	function ensureProfShell() {
		try {
			var V2 = getV();
			if (!V2) { return { ok: false, message: "存档变量不可用" }; }
			if (!V2.prof || typeof V2.prof !== "object") {
				V2.prof = { spray: 0, baton: 0, whip: 0, net: 0, pickaxe: 0 };
				return { ok: true, created: true };
			}
			return { ok: true, created: false };
		} catch (e) { return { ok: false, message: "武器数据初始化失败" }; }
	}
	/* ===== v2.0.0.002 需求②：武器「直接获得」=====
	   原版武器持有语义实证（DoL 0.5.12.13 源码逐条取证）：
	   - 持有判定 = V.prof.<武器> 键存在。角色页特性栏 `<<if $prof.whip isnot undefined>>` 才显示该武器特性，
	     未定义时走 _hiddenConfig（截图里「网（当前 —）」「镐（当前 —）」即 undefined 的呈现）。
	     神殿开启战斗链 `<<set $prof.baton to 200>><<<set $prof.whip to 800>><<<set $temple_weapon to "whip">>`
	     就是"直接给武器"的原版写法，故 CB 侧等价实现 = 建 prof 键 + 给入门熟练度。
	   - 防狼喷雾还有独立物资：V.spray（弹药数）/ V.spraymax（容量）/ V.infinitespray。
	     `spray()` 内 `V.spray = Math.clamp(V.spray, 0, V.spraymax)`，spraymax=0 时有熟练度也打不出，
	     故获得喷雾必须同时给容量与弹药（否则面板显示"已获得"但实战无弹）。
	   - 镐的真身是道具 `<<wearProp "pickaxe">>`（矿山/废土派发），prof.pickaxe 的显示块在原版被注释块包裹，
	     写键只为对齐"非 undefined"判定，道具本身由 game 的 wearProp 管理，不在此伪造。 */
	var WEAPON_GRANT_BASE = 100; /* 入门档：原版武器四档 100/300/500/1000 */
	var WEAPON_LABEL = { spray: "防狼喷雾", baton: "短棍", whip: "鞭子", net: "网", pickaxe: "镐" };
	function quickTargetValue(raw, cur) {
		var s = String(raw == null ? "" : raw).trim();
		if (!s) { return null; }
		var rel = /^([+-])\s*(\d+(?:\.\d+)?)$/.exec(s);
		if (rel) {
			var base = (typeof cur === "number" ? cur : 0);
			return rel[1] === "+" ? base + Number(rel[2]) : base - Number(rel[2]);
		}
		return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
	}
	function grantWeapon(path, base) {
		var w = String(path || "").replace(/^prof\./, "");
		if (!w || !WEAPON_LABEL[w]) { return { ok: false, message: "未知武器键：" + w }; }
		var es = ensureProfShell();
		if (!es.ok) { return es; }
		var V2 = getV();
		if (!V2) { return { ok: false, message: "存档变量不可用" }; }
		var val = (typeof base === "number" && base > 0 ? base : WEAPON_GRANT_BASE);
		var msgs = [], allOk = true;
		/* 自检（测试 54.4 抓到）：原版持有判定是 `isnot undefined`，但值为 0 时武器已"在手"却毫无熟练度——
		   玩家点「获得」的预期是"拿到能用"，所以规则定为：值 ≥1 一律保持（不冲掉 722 这类已有熟练度），
		   值为 0 或键缺失才写入门档 100。 */
		var curProf = (typeof V2.prof[w] === "number") ? V2.prof[w] : null;
		if (curProf !== null && curProf >= 1) {
			msgs.push("已持有，保持现值 " + curProf);
		} else {
			var r1 = cheatWriteValue("player-self", "p:prof." + w, "value_set", "prof." + w, val, "number", 0, 1000);
			allOk = allOk && !!(r1 && r1.ok);
			msgs.push(r1 && r1.ok ? "熟练度 " + val : "熟练度写入失败");
		}
		if (w === "spray") {
			if (!((typeof V2.spraymax === "number" ? V2.spraymax : 0) >= 1)) {
				var r2 = cheatWriteValue("player-self", "p:spraymax", "value_set", "spraymax", 5, "number", 0, 8);
				allOk = allOk && !!(r2 && r2.ok);
				msgs.push(r2 && r2.ok ? "容量 5" : "容量写入失败");
			}
			if (!((typeof V2.spray === "number" ? V2.spray : 0) >= 1)) {
				var cap = ((typeof V2.spraymax === "number" && V2.spraymax >= 1) ? V2.spraymax : 5);
				var r3 = cheatWriteValue("player-self", "p:spray", "value_set", "spray", cap, "number", 0, 8);
				allOk = allOk && !!(r3 && r3.ok);
				msgs.push(r3 && r3.ok ? "弹药 " + cap : "弹药写入失败");
			}
		}
		return { ok: allOk, message: "已获得「" + WEAPON_LABEL[w] + "」：" + msgs.join("，") };
	}
	function grantAllWeapons() {
		var done = 0, fails = [];
		["spray", "baton", "whip", "net", "pickaxe"].forEach(function (w) {
			var r = grantWeapon("prof." + w);
			if (r.ok) { done++; } else { fails.push(WEAPON_LABEL[w]); }
		});
		return {
			ok: fails.length === 0,
			message: "已获得 " + done + " 件武器" + (fails.length ? "，失败：" + fails.join("、") : "（喷雾含容量/弹药）")
		};
	}
	function quickWrite(path, raw) {
		if (String(path).indexOf("prof.") === 0) {
			var es = ensureProfShell();
			if (!es.ok) { return es; }
		}
		/* v1.8.12 功能6：查数据表取该项 min/max，传给 cheatWriteValue 统一写入（上限不钳制）*/
		var meta = ensureQuickIndex()[path] || null;
		return cheatWriteValue("player-self", "p:" + path, "value_set", path, raw, "number",
			meta && typeof meta.min === "number" ? meta.min : undefined,
			meta && typeof meta.max === "number" ? meta.max : undefined);
	}
	/* v2.0.0.007：行内状态唯一真值路径——渲染（renderQuickRow）与局部刷新（actPlayer）都调它。
	   好友实测两个问题都出在「只有整页重渲染才更新」：
	   ① 点「锁定」后按钮文案不变成「已锁定」，必须切页签再回来才看到；
	   ② 点完后该行技能名变英文裸 key（skulduggery / athletics …），切页后恢复中文——
	      根因是局部刷新时 PANEL_QUICK_PATH_INDEX 尚未构建，label 回退成 path 原文。 */
	function mbCESyncQuickRow(row, path) {
		if (!row) { return; }
		var cur = quickReadValue(path);
		var meta = ensureQuickIndex()[path] || null;
		var inp = row.querySelector("input.mce-inp");
		if (inp) { inp.value = (typeof cur === "number") ? String(cur) : "0"; }
		var lbl = row.querySelector(".mce-row-lbl");
		if (lbl) { lbl.textContent = (meta ? meta.label : path) + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"; }
		var lk = row.querySelector('[data-mce-role="lock"]');
		if (lk) {
			var locked = (typeof mbCELockHas === "function") ? !!mbCELockHas(path) : false;
			if (lk.classList) { lk.classList.toggle("mce-gold", locked); } else { lk.className = locked ? "mce-btn mce-gold" : ""; }
			lk.textContent = locked ? "已锁定" : "锁定";
			lk.title = locked
				? "该值已锁定（每 1 秒强制写回目标 " + mbCELockTarget(path) + "）；点击取消锁定"
				: "锁定：输入框的数值（含 +N/-N 相对写法）成为目标值，每 1 秒强制写回，存存档";
		}
		var gr = row.querySelector('[data-mce-role="grant"]');
		if (gr) {
			/* 持有判定对齐 grantWeapon：prof 值为 number 且 ≥1 = 已在手（原版 isnot undefined 外还挡住 0 值） */
			var owned = (typeof cur === "number") && cur >= 1;
			if (gr.classList) { gr.classList.toggle("mce-gold", owned); } else { gr.className = owned ? "mce-btn mce-gold" : "mce-btn"; }
			gr.textContent = owned ? "已获得" : "获得";
			gr.title = owned
				? "该武器已持有（熟练度 " + cur + "）；点此仍会补齐喷雾的容量与弹药"
				: "直接获得该武器：写 prof 键（原版持有判定）+ 入门熟练度 100；喷雾同时补容量 5 与满弹药";
		}
	}
	function renderQuickRow(pane, it) {
		var path = it.path, label = it.label;
		var cur = quickReadValue(path);
		var row = el("div", "mce-row");
		/* 六巡：行带 data-mce-key——快速面板数值操作后 actPlayer 局部刷新该行，不再全量重建 33 行 + 特质区 */
		row.setAttribute("data-mce-key", "quick:" + path);
		row.appendChild(el("span", "mce-row-lbl", label + "（当前 " + (typeof cur === "number" ? cur : "—") + "）"));
		var inp = el("input", "mce-inp");
		inp.type = "text"; inp.inputmode = "decimal"; inp.value = (typeof cur === "number") ? String(cur) : "0";
		inp.placeholder = "+N / -N 相对";
		var rangeTxt = (typeof it.min === "number" && typeof it.max === "number") ? "；合理范围 " + it.min + "–" + it.max : "";
		inp.title = "支持相对调整：+100 / -20；直接输入数字为绝对值" + rangeTxt + (it.note ? "（" + it.note + "）" : "");
		var b = el("button", "", "应用"); b.type = "button";
		b.addEventListener("click", function () { actPlayer(quickWrite(path, inp.value), path); });
		var und = el("button", "", "回退"); und.type = "button";
		und.addEventListener("click", function () { actPlayer(undoCheatModValue("player-self", "p:" + path), path); });
		/* v2.0.0.002 需求①：数值锁定（复用 07f-lock.js 通道，每 1 秒强制写回，存存档）
		   v2.0.0.007：文案/样式交给 mbCESyncQuickRow，渲染与刷新共用一条真值路径 */
		var lk = el("button", "", "锁定");
		lk.type = "button";
		lk.setAttribute("data-mce-role", "lock");
		lk.addEventListener("click", function () {
			if (typeof mbCELockHas !== "function" || typeof mbCELockSet !== "function" || typeof mbCELockRemove !== "function") {
				setStatus("锁定模块未加载（07f-lock.js）", "mce-err"); return;
			}
			if (mbCELockHas(path)) { actPlayer(mbCELockRemove(path), path); return; }
			var tgt = quickTargetValue(inp.value, quickReadValue(path));
			if (tgt == null) { setStatus("锁定需要具体目标值（也支持 +N / -N 相对写法）", "mce-err"); return; }
			actPlayer(mbCELockSet(path, tgt), path);
		});
		row.appendChild(inp); row.appendChild(b); row.appendChild(und); row.appendChild(lk);
		/* v2.0.0.002 需求②：武器组每行加「获得」（非武器组不出现）
		   v2.0.0.007：已持有（prof ≥1）→ 文案变「已获得」（原先固定「获得」，好友截图四即此） */
		if (String(path).indexOf("prof.") === 0) {
			var gr = el("button", "mce-btn", "获得");
			gr.type = "button";
			gr.setAttribute("data-mce-role", "grant");
			gr.addEventListener("click", function () { actPlayer(grantWeapon(path), path); });
			row.appendChild(gr);
		}
		mbCESyncQuickRow(row, path);
		pane.appendChild(row);
	}
	function renderQuickPanel(pane) {
		/* v2.0.0.002 需求③：自由选择说话态度——放在本页最上方（用户指定位置）
		   v2.0.3：本页也是多区块页，传入本页编号 1（原先复用全局页写死的 ⑩，在本页是错号） */
		renderAttitudeFree(pane, 1);
		/* v1.9.13 预设模板：一键批量写入（逐项走 quickWrite 统一留痕，可单独回退）
		   v2.0.3：改 mceNewSec 统一区块样式与编号（本页第 2 区块） */
		var psec = mceNewSec(pane, 2, "一键方案（预设模板）", "整组批量写入（每个键各自留痕，可单独回退）；与下方各属性折叠组不冲突，预设只写固定档位。");
		var pWrap = el("div", "mce-row");
		var presets = [
			{ key: "max", name: "全属性拉满", desc: "全部核心/技能/性技能/成绩/武器写满 + 负面清零 + 名声清零" },
			{ key: "fresh", name: "经典开局", desc: "资金 5000 + 技能/成绩/武器 100 + 负面清零 + 名声清零" }
		];
		presets.forEach(function (p) {
			var b = el("button", "mce-btn mce-gold", p.name); b.type = "button";
			b.title = p.desc;
			b.addEventListener("click", function () {
				var r = applyQuickPreset(p.key);
				setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
				renderPlayerEdit();
			});
			pWrap.appendChild(b);
		});
		psec.appendChild(pWrap);
		psec.appendChild(el("div", "mce-hint", "预设为固定值批量写入，逐项留痕（「回退」可逐项还原）；如需微调请在各分组手动改。"));
		/* v2.0.3：mceNewSec 已把区块挂到 pane，无需再 append */
		PANEL_QUICK_GROUPS.forEach(function (g) {
			/* v1.9.16：属性分组改可折叠（学特质页 .mce-collapse-head 机制，mbCEUiCollapsed 持久化，默认收起） */
			var qkey = "quick:" + g.title;
			var restoreOpen = (typeof mbCEUiState !== "undefined" && mbCEUiState && mbCEUiState.collapsed && mbCEUiState.collapsed[qkey] === 0);
			var grp = el("div", "mce-grp");
			var headTxt = (restoreOpen ? "▾ " : "▸ ") + g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）";
			var head = el("div", "mce-grp-t mce-collapse-head", headTxt);
			var body = el("div", "mce-grp-body");
			body.setAttribute("data-collapsed", restoreOpen ? "0" : "1");
			head.addEventListener("click", function () {
				var open = body.getAttribute("data-collapsed") !== "1";
				body.setAttribute("data-collapsed", open ? "1" : "0");
				head.textContent = (open ? "▸ " : "▾ ") + g.title + "（当前值即游戏面板原始量纲，输入目标值后点应用）";
				mbCEUiCollapsed(qkey, !open);
			});
			grp.appendChild(head);
			grp.appendChild(body);
			g.items.forEach(function (it) { renderQuickRow(body, it); });
			if (g.title === "武器技能") {
				var allG = el("button", "mce-btn mce-gold", "全部获得（5 件武器）");
				allG.type = "button";
				allG.title = "一次获得 防狼喷雾/短棍/鞭子/网/镐（写 prof 键 = 原版持有判定）；喷雾同时补容量 5 与满弹药";
				allG.addEventListener("click", function () {
					var r = grantAllWeapons();
					setStatus(r.message, r.ok ? "mce-ok" : "mce-err");
					renderPlayerEdit();
				});
				body.appendChild(allG);
			}
			pane.appendChild(grp);
		});
	}
	/* v1.9.13 预设模板执行器：固定值表 × PANEL_QUICK_GROUPS 逐项写入（统一走 quickWrite 留痕）。
	   值语义：核心属性 max 写 999（无上限属性的“很高”量纲）/ purity 2000（满）/ 资金 999999；
	   技能/性技能/成绩/武器 fresh=100、max=1000；负面与名声一律清零。
	   组归属判断用组标题（面板文案），改名时需同步本函数。 */
	function applyQuickPreset(kind) {
		try {
			var V = getV();
			if (!V) { return { ok: false, message: "存档变量不可用" }; }
			var map = {};
			if (kind === "fresh") {
				map.money = 5000; map.purity = 2000;
			} else {
				map.purity = 2000; map.beauty = 999; map.physique = 999; map.willpower = 999; map.awareness = 999;
				map.promiscuity = 999; map.exhibitionism = 999; map.deviancy = 999; map.money = 999999;
			}
			var skillVal = kind === "fresh" ? 100 : 1000;
			PANEL_QUICK_GROUPS.forEach(function (g) {
				if (g.title === "负面状态" || g.title === "名声（fame）") { return; } /* 末尾统一清零 */
				g.items.forEach(function (it) {
					if (map[it.path] !== undefined) { return; }
					map[it.path] = skillVal;
				});
			});
			["stress", "trauma", "pain", "arousal", "tiredness", "anxiety", "delinquency", "drugged", "drunk",
			 "fame.prostitution", "fame.sex", "fame.rape", "fame.exhibitionism", "fame.bestiality", "fame.good"].forEach(function (p) {
				map[p] = 0;
			});
			var done = 0, fails = 0;
			Object.keys(map).forEach(function (path) {
				var r = quickWrite(path, map[path]);
				if (r && r.ok) { done++; } else { fails++; }
			});
			return { ok: fails === 0, message: "预设「" + (kind === "max" ? "全属性拉满" : "经典开局") + "」已写入 " + done + " 项" + (fails ? "，失败 " + fails + " 项" : "") };
		} catch (e) {
			return { ok: false, message: "预设执行异常：" + (e && e.message ? e.message : e) };
		}
	}
