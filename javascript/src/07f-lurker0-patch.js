/* ============ v2.0.0.002 需求⑥：潜伏者捕捉上限 / 水烟馆冰箱上限 —— 文本解限引擎 ============
   原版硬约束（逐字取证自 DoL 0.5.12.13 的 Degrees of Lewdity.html）：
   A. 捕捉门控 5 处，同一形态：<<if $farm_stage gte 10 and $lurkers_held lt 1>> 包裹 "Hurl net"
      分布：Widgets Struggle（widget "struggle"，2 处）、Farm Yard（1）、Farm Tending Lurker Work（1）、
            Farm Tending Lurker Alex Fail（1）。手上已有 1 只就不再出网 → 这就是"上限 1"的真身。
   B. 冰箱上限 5 的真身两处（Widgets Flats 的 widget "hookah_juice"）：
      B1 <<if $lurkers_held gte 1 and $hookah.lurkers lt 5>> 包裹 "Store a lurker in the fridge"
      B2 <<switch $hookah.lurkers>> 只映射 5/4/3/2/1，<<default>> 输出 "no" → 写 >5 显示 "no lurker"
   C. 成功结算本身无上界：<<set $lurkers_held += 1>><<<set $stat_lurkers_captured += 1>>（Farm Yard
      Hurl net / Farm Tending Lurker Hurl net 两处）→ 去掉门控即可无限累积。
   D. 为何必须改文本而非改数值：门控写在 twee 里，靠"抓到即清零"只能绕成"手上永远 0 只"，
      不是"可持有无限只"。widget 定义在 SugarCube 启动时一次性注册，运行期再执行 <<widget>> 会报
      `cannot clobber existing definition "..."`（本版内核源码含此判定）→ 只能在 SugarCube.start
      之前改 DOM 里的 <tw-passagedata>。CE 走 scriptFileList_inject_early（脚本在 <head> 执行），
      body 尚未解析，因此注册捕获阶段的 DOMContentLoaded 先于正文末尾 SugarCube 的启动回调。
   兜底：DOM 未命中时改 Story.get(name).text（普通 passage 每次渲染重新 wikify，有效；widget 无效，
      此时 UI 会明示"仅普通剧情入口生效"，并由自动搬运保底"可以无限抓"）。

   【拼接顺序（v2.0.0.006 更名）】本片原名为 07f-lurker-patch.js：build_js.js 按文件名 sort 拼接，
   "-" 的排序码 0x2D 小于 "." 的 0x2E，旧名会让"补丁片"排在 07f-lurker.js（本体片）之前 —— 反直觉。
   现更名 07f-lurker0-patch.js（"0" = 0x30 大于 "." = 0x2E），实际顺序变为 07f-lurker.js → 本片，
   即"本体在前、补丁在后"。原先「本片不得在模块顶层读写 07f-lurker.js 的模块级 var」这条约束
   （MB_CE_LURKER_MAX / MB_CE_LURKER_FRIDGE_MAX / mbCELurkerTimer 等）随顺序调整自然解除：
   本片执行时本体片的模块级 var 已赋值。双向依赖（本体调本片的 mbCELurkerPatchReport /
   mbCELurkerRepatch）仍靠函数声明提升到整个产物顶部，且调用点带 typeof 守卫，安全。 */
var MB_CE_LURKER_PATCHES = [
	{ name: "Farm Yard", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Farm Tending Lurker Work", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Farm Tending Lurker Alex Fail", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Widgets Struggle", find: "$farm_stage gte 10 and $lurkers_held lt 1", repl: "$farm_stage gte 10" },
	{ name: "Widgets Flats", find: "$lurkers_held gte 1 and $hookah.lurkers lt 5", repl: "$lurkers_held gte 1" },
	{ name: "Widgets Flats", find: "<<switch $hookah.lurkers>>", repl: "", regex: true }
];
/* v2.0.4 修复「潜伏者遭遇整段变英文」：门控替换必须长度守恒。
   汉化包（ModI18N）的译文条目带 pos 偏移锚点，逐条按 <from, pos> 在 passage 原文里定位；
   任何一条定位失败 → 整段 passage 放弃翻译、直接回显英文原文。CE 原先把门控串删短
   （-41/-25 字符），后续条目 pos 全下移 → 第一处不匹配即 anchor-error → 5 个 passage 全段落译。
   办法：把 repl 右补空格补到与 find 等长（<<if>> 表达式里尾随空格无副作用），偏移原地不动。 */
function mbCELurkerPadTo(find, repl) {
	var n = String(find).length - String(repl).length, pad = "";
	if (n <= 0) { return String(repl); }
	while (n-- > 0) { pad += " "; }
	return String(repl) + pad;
}
/* 汉化层在场时：switch 整块替换 = 物理删掉 6 条 span 译文锚点（补空格也救不回），必须原样保留。
   window.modI18N 由汉化包 earlyload（ModLoader 注入 <head>）挂载，早于 DOMContentLoaded，此处可判。 */
function mbCELurkerCjkI18n() {
	try {
		if (window.modI18N) { return true; }
		var d = window.modSC2DataManager;
		if (d && typeof d.getLanguageManager === "function") {
			var lm = d.getLanguageManager();
			if (lm && (lm.mainLanguage === "zh" || lm.language === "zh")) { return true; }
		}
	} catch (e) { /* 无 ModLoader / 无汉化 */ }
	return false;
}
/* 冰箱显示：把只映射 1–5 的 switch 段整体换成真实数值（>5 不再落到 <<default>> 显示 "no"） */
var MB_CE_LURKER_SWITCH_RE = /<<switch \$hookah\.lurkers>>[\s\S]*?<<\/switch>>/;
var MB_CE_LURKER_SWITCH_TO = '<<= $hookah.lurkers gt 0 ? $hookah.lurkers : "no">>';
/* 纯函数：对单个 passage 文本做全套替换，返回 { text, hits, kept, skipped }（幂等：已替换的文本再跑 hits=0）
   kept = 长度守恒替换处数；skipped = 因汉化在场而主动放弃的整块替换数（switch） */
function mbCELurkerPatchText(name, text) {
	var out = String(text == null ? "" : text), hits = 0, kept = 0, skipped = 0, i, p;
	for (i = 0; i < MB_CE_LURKER_PATCHES.length; i++) {
		p = MB_CE_LURKER_PATCHES[i];
		if (p.name !== name) { continue; }
		if (p.regex) {
			if (MB_CE_LURKER_SWITCH_RE.test(out)) {
				/* 汉化在场：整块替换会删掉 span 译文锚点 → 放弃（>5 只显示原版 "no"，数量见面板） */
				if (mbCELurkerCjkI18n()) { skipped++; continue; }
				out = out.replace(MB_CE_LURKER_SWITCH_RE, MB_CE_LURKER_SWITCH_TO);
				hits++;
			}
			continue;
		}
		if (out.indexOf(p.find) >= 0) {
			out = out.split(p.find).join(mbCELurkerPadTo(p.find, p.repl));
			hits++;
			kept++;
		}
	}
	return { text: out, hits: hits, kept: kept, skipped: skipped };
}
function mbCELurkerPatchNames() {
	var names = [], i;
	for (i = 0; i < MB_CE_LURKER_PATCHES.length; i++) {
		if (names.indexOf(MB_CE_LURKER_PATCHES[i].name) < 0) { names.push(MB_CE_LURKER_PATCHES[i].name); }
	}
	return names;
}
/* ① 启动前改 DOM（唯一能改到 widget 定义的通道） */
function mbCELurkerPatchDom() {
	/** @type {any} */
	var report = { ok: false, hits: 0, kept: 0, skipped: 0, nodes: 0, missed: mbCELurkerPatchNames(), channel: "dom" };
	try {
		if (typeof document === "undefined" || !document.getElementsByTagName) { return report; }
		var nodes = document.getElementsByTagName("tw-passagedata");
		var names = mbCELurkerPatchNames(), done = {}, i, n;
		report.nodes = nodes.length;
		for (i = 0; i < nodes.length; i++) {
			n = nodes[i];
			var nm = n.getAttribute ? n.getAttribute("name") : "";
			if (!nm || names.indexOf(nm) < 0 || done[nm]) { continue; }
			var before = n.textContent || "";
			var res = mbCELurkerPatchText(nm, before);
			if (!res.hits && !res.skipped) { continue; }
			/* textContent 写回由浏览器重新转义，SugarCube 读到的就是替换后的源码 */
			if (res.hits) { n.textContent = res.text; }
			done[nm] = true;
			report.hits += res.hits;
			report.kept += res.kept;
			report.skipped += res.skipped;
		}
		report.missed = names.filter(function (x) { return !done[x]; });
		report.ok = report.hits > 0;
	} catch (e) { report.error = String(mbCEErr(e)); }
	window.mbCELurkerPatchReport = report;
	return report;
}
/* 运行期 passage 文本入口：moli 实测（DoL 0.5.12.13 内嵌 ModLoader）页面全局既无 Story 也无 Macro，
   SugarCube 未把 State/Story 挂到 window → 优先 Story，其次 SugarCube.State.passages，都没有则返回 null。 */
function mbCELurkerPassageAccess() {
	try {
		if (typeof Story !== "undefined" && Story && typeof Story.get === "function") {
			return { get: function (n) { return Story.get(n); }, channel: "Story" };
		}
	} catch (e) { /* 落到下一条 */ }
	try {
		var P = window.SugarCube && window.SugarCube.State && window.SugarCube.State.passages;
		if (P && typeof P === "object") {
			return { get: function (n) { return P[n] || null; }, channel: "SugarCube.State.passages" };
		}
	} catch (e) { /* 无通道 */ }
	return null;
}
/* ② 运行期兜底：改 passage 文本（普通 passage 每次渲染重新 wikify 有效；已注册的 widget 定义无效） */
function mbCELurkerPatchStory() {
	/** @type {any} */
	var report = { ok: false, hits: 0, kept: 0, skipped: 0, missed: mbCELurkerPatchNames(), channel: "story", access: null };
	try {
		var access = mbCELurkerPassageAccess();
		if (!access) { report.access = "none"; return report; }
		report.access = access.channel;
		var names = mbCELurkerPatchNames(), done = {}, i;
		for (i = 0; i < names.length; i++) {
			var p = null;
			try { p = access.get(names[i]); } catch (e) { p = null; }
			if (!p || typeof p.text !== "string") { continue; }
			var res = mbCELurkerPatchText(names[i], p.text);
			if (!res.hits) { done[names[i]] = true; continue; }
			p.text = res.text;
			done[names[i]] = true;
			report.hits += res.hits;
			report.kept += res.kept;
			report.skipped += res.skipped;
		}
		report.missed = names.filter(function (x) { return !done[x]; });
		report.ok = report.hits > 0;
	} catch (e) { report.error = String(mbCEErr(e)); }
	var prev = window.mbCELurkerPatchReport;
	window.mbCELurkerPatchReport = {
		ok: report.ok || !!(prev && prev.ok),
		hits: (prev && prev.hits ? prev.hits : 0) + report.hits,
		kept: (prev && prev.kept ? prev.kept : 0) + report.kept,
		skipped: (prev && prev.skipped ? prev.skipped : 0) + report.skipped,
		dom: prev && prev.channel === "dom" ? prev : null,
		story: report,
		channel: prev && prev.ok ? "dom" : report.channel,
		missed: report.missed
	};
	return report;
}
/* ③ 安装：CE 在 <head> 执行时 body 未解析 → 用捕获阶段 DOMContentLoaded 抢在 SugarCube.start 之前 */
function mbCELurkerInstallEarly() {
	try {
		if (typeof document === "undefined") { return; }
		var fire = function () {
			mbCELurkerPatchDom();
			/* 同一事件里再补一次 Story 兜底（此时 Story 可能尚未构建，失败也无害） */
			mbCELurkerPatchStory();
		};
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", fire, true);
		} else {
			fire();
		}
	} catch (e) { /* 无 DOM 环境（Node 测试）时静默 */ }
}
function mbCELurkerPatchReport() {
	return window.mbCELurkerPatchReport || null;
}
/* 面板/命令：手动重新尝试补丁（自动搬运之外的第二道保险） */
function mbCELurkerRepatch() {
	var dom = mbCELurkerPatchDom();
	var story = mbCELurkerPatchStory();
	var r = mbCELurkerPatchReport();
	return {
		ok: !!(r && r.ok),
		message: r && r.ok
			? "解限补丁已生效（累计替换 " + r.hits + " 处，其中长度守恒 " + (r.kept || 0) + " 处" +
				(r.skipped ? "；汉化在场保留 switch " + r.skipped + " 处（>5 只原版文案显示 no，真实数量见上方数值）" : "") +
				"；未命中：" + ((r.missed && r.missed.length) ? r.missed.join(" / ") : "无") + "）"
			: "解限补丁未命中（可能页面已启动或版本差异）——自动搬运仍可保底「无限次捕捉」；详情：" + JSON.stringify({ dom: dom.hits, story: story.hits })
	};
}
mbCELurkerInstallEarly();
