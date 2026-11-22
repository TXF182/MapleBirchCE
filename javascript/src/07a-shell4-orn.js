/* 职责：面板装饰层与行为精修 —— 主题边饰 / 外观三开关 / 按压语义修正 / 滚动摘模糊 / 无障碍（aria + roving tabindex + Esc）
 * 07a-shell4-orn：P0–P2 灯台学习落地（2026-11-22，参考 MapleLantern 1.5.1 原文）
 *   - 边饰：DoL-Project\MapleLantern\src\ornaments.css（4 套 SVG 帧原样取形，颜色对齐 CE 四主题 accent；
 *     零 DOM 节点、零动画、pointer-events:none；≤600px 收细 8px、≤420px 帧关）
 *   - 按压语义修正：MapleLantern 1.4.22「只缩放不下沉」——覆盖 07a-shell.js 的 translateY(1px) 下沉
 *   - 底部抽屉（2026-11-22 撤除）：作弊项多、六成屏高的抽屉要滚很长才能摸到底 → 窄屏回归全屏铺满；
 *     原 MapleLantern ≤560px / 高度≤520px 自动抽屉的先例不再沿用，悬浮球让位（快照/恢复）协议一并删除
 *   - 滚动摘 backdrop-filter：MapleLantern KNOWLEDGE 1.3.7（160ms 恢复），仅在窄屏媒体查询内生效
 *   - 外观三开关：MapleLantern「逐项开关 + data-* gate + 结构约束常开」——fx/tex/orn 三档只动装饰层，
 *     面板几何/排版（结构约束）不随开关变化
 *   - 无障碍：面板是常驻非模态侧栏 → role=complementary（不抄灯台 aria-modal——语义不符会误导辅助技术）；
 *     页签 roving tabindex（←/→/Home/End）+ aria-selected；Esc 关闭；aria-expanded 同步
 * 为什么独立成段：07a-shell.js 顶到 400 行门禁、07a-host-compat/shell2/shell3 各有职责且余量不足；
 * 全部追加逻辑经 MB_CSS += / 新函数落地，manifest 段序在 07a-shell3-fx.js 之后（后写覆盖按压旧规则）。 */

/* ---- 主题边饰：4 套 64×64 SVG 帧（data: URL 承载，DoL CSP 只允许 data:）+ 应用层 ----
 * gold 用 :root 默认值（gold 无主题类，历史兼容）；starry/cyberpunk/jade 由主题类覆盖。
 * ::before 边框压在面板内容之上（z-index:6，pointer-events:none 不拦点击），root 同步加
 * padding 补偿（box-sizing:border-box 保持 430px 几何不变）——对照灯台「::before 边框 +
 * 内容 padding-inline 补偿」的同款结构。 */
MB_CSS +=
	":root{--mce-orn-frame:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%23E3B25F' stroke-width='1.4'%3E%3Cpath d='M3 21c0-10 8-18 18-18'/%3E%3Cpath d='M3 14c0-6 5-11 11-11'/%3E%3Cpath d='M28 0v6M36 0v6'/%3E%3Cg transform='rotate(90 32 32)'%3E%3Cpath d='M3 21c0-10 8-18 18-18'/%3E%3Cpath d='M3 14c0-6 5-11 11-11'/%3E%3Cpath d='M28 0v6M36 0v6'/%3E%3C/g%3E%3Cg transform='rotate(180 32 32)'%3E%3Cpath d='M3 21c0-10 8-18 18-18'/%3E%3Cpath d='M3 14c0-6 5-11 11-11'/%3E%3Cpath d='M28 0v6M36 0v6'/%3E%3C/g%3E%3Cg transform='rotate(270 32 32)'%3E%3Cpath d='M3 21c0-10 8-18 18-18'/%3E%3Cpath d='M3 14c0-6 5-11 11-11'/%3E%3Cpath d='M28 0v6M36 0v6'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\");--mce-orn-a:.34;--mce-orn-thick:12px;--mce-orn-pad:12px}" +
	"#mce-root.mce-theme-starry{--mce-orn-frame:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%238FA6FF' stroke-width='1'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M28 0v5M36 0v5'/%3E%3Cg transform='rotate(90 32 32)'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M28 0v5M36 0v5'/%3E%3C/g%3E%3Cg transform='rotate(180 32 32)'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M28 0v5M36 0v5'/%3E%3C/g%3E%3Cg transform='rotate(270 32 32)'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M28 0v5M36 0v5'/%3E%3C/g%3E%3C/g%3E%3Cg fill='%238FA6FF'%3E%3Cpath d='M32 0l2 4 4 2-4 2-2 4-2-4-4-2 4-2z'/%3E%3C/g%3E%3C/svg%3E\");--mce-orn-a:.34}" +
	"#mce-root.mce-theme-cyberpunk{--mce-orn-frame:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%2300E5FF' stroke-width='1.5'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M32 0v9M29 7l3 3 3-3'/%3E%3Cg transform='rotate(90 32 32)'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M32 0v9M29 7l3 3 3-3'/%3E%3C/g%3E%3Cg transform='rotate(180 32 32)'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M32 0v9M29 7l3 3 3-3'/%3E%3C/g%3E%3Cg transform='rotate(270 32 32)'%3E%3Cpath d='M3 21V3h18'/%3E%3Cpath d='M32 0v9M29 7l3 3 3-3'/%3E%3C/g%3E%3C/g%3E%3Cg fill='%23FF3D9A'%3E%3Ccircle cx='6' cy='6' r='1.6'/%3E%3Cg transform='rotate(180 32 32)'%3E%3Ccircle cx='6' cy='6' r='1.6'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\");--mce-orn-a:.30}" +
	"#mce-root.mce-theme-jade{--mce-orn-frame:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%237FD6C5' stroke-width='1.2'%3E%3Cpath d='M3 21c0-11 9-18 18-18c-7 2-12 7-13 14'/%3E%3Cpath d='M26 0c2 4 6 6 12 6'/%3E%3Cg transform='rotate(90 32 32)'%3E%3Cpath d='M3 21c0-11 9-18 18-18c-7 2-12 7-13 14'/%3E%3Cpath d='M26 0c2 4 6 6 12 6'/%3E%3C/g%3E%3Cg transform='rotate(180 32 32)'%3E%3Cpath d='M3 21c0-11 9-18 18-18c-7 2-12 7-13 14'/%3E%3Cpath d='M26 0c2 4 6 6 12 6'/%3E%3C/g%3E%3Cg transform='rotate(270 32 32)'%3E%3Cpath d='M3 21c0-11 9-18 18-18c-7 2-12 7-13 14'/%3E%3Cpath d='M26 0c2 4 6 6 12 6'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\");--mce-orn-a:.30}" +
	"#mce-root::before{content:\"\";position:absolute;inset:0;z-index:6;pointer-events:none;" +
	"border:var(--mce-orn-thick) solid transparent;border-image-source:var(--mce-orn-frame);" +
	"border-image-slice:24;border-image-repeat:repeat;opacity:var(--mce-orn-a)}" +
	"html[data-mce-orn=\"1\"] #mce-root{box-sizing:border-box;padding:var(--mce-orn-pad) var(--mce-orn-pad) var(--mce-orn-pad) calc(var(--mce-orn-pad) + 1px)}" +
	"html[data-mce-orn=\"off\"] #mce-root::before{display:none}" +
	"html[data-mce-orn=\"off\"] #mce-root{padding:0}" +
	"@media (max-width:600px){:root{--mce-orn-thick:8px;--mce-orn-pad:8px}}" +
	"@media (max-width:420px){#mce-root::before{display:none}html[data-mce-orn=\"1\"] #mce-root{padding:0}}";

/* ---- 外观三开关 gate（结构约束常开：只动装饰层，面板几何/排版不吃开关） ---- */
MB_CSS +=
	"html[data-mce-fx=\"off\"] #mce-root,html[data-mce-fx=\"off\"] #mce-root *," +
	"html[data-mce-fx=\"off\"] #mce-toggle,html[data-mce-fx=\"off\"] .mce-anchor-prompt," +
	"html[data-mce-fx=\"off\"] .mce-anchor-prompt *{animation:none!important;transition:none!important}" +
	"html[data-mce-fx=\"off\"] #mce-press-ring{display:none!important}" +
	"html[data-mce-tex=\"off\"] #mce-root,html[data-mce-tex=\"off\"] .mce-body," +
	"html[data-mce-tex=\"off\"] .mce-group,html[data-mce-tex=\"off\"] .mce-card," +
	"html[data-mce-tex=\"off\"] .mce-data-card{background-image:none!important}";

/* ---- 按压反馈只缩放不下沉（灯台 1.4.22 语义修正；本段后写，同特异度覆盖 07a 旧规则的 translateY） ---- */
MB_CSS +=
	"#mce-root .mce-btn:active{transform:scale(.96)}";

/* ---- 滚动摘 backdrop-filter + 星空手机降载（窄屏媒体块；2026-11-22 撤底部抽屉，几何见 07a-shell.js 全屏段） ---- */
MB_CSS +=
	"@media (max-width:560px){" +
	"#mce-root[data-mce-scroll=\"1\"]{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}" +
	"#mce-root.mce-theme-starry{--mce-tex-panel:radial-gradient(90% 65% at 18% 0%,rgba(111,90,255,.18),transparent 58%)," +
	"radial-gradient(1.5px 1.5px at 20% 12%,rgba(255,255,255,.55) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 74% 26%,rgba(196,208,255,.45) 0,rgba(196,208,255,0) 2px)}" +
	"#mce-root.mce-theme-starry .mce-body{background-image:none}" +
	"}";

/* ---- 外观三开关：状态存取 + data 属性应用 ---- */
var MCE_UI_OPTS = ["fx", "tex", "orn"];
function mbCEUiOpt(kind) {
	try {
		return (mbCEUiState && (mbCEUiState[kind] === "0" || mbCEUiState[kind] === "1")) ? mbCEUiState[kind] : "1";
	} catch (e) { return "1"; }
}
function mbCEApplyUiOpts() {
	try {
		var de = document.documentElement;
		if (!de) { return; }
		for (var i = 0; i < MCE_UI_OPTS.length; i++) {
			var k = MCE_UI_OPTS[i];
			de.setAttribute("data-mce-" + k, mbCEUiOpt(k) === "1" ? "1" : "off");
		}
	} catch (e) { /* 无 DOM 环境（纯逻辑测试）静默 */ }
}
function mbCEUiOptToggle(kind) {
	try {
		if (MCE_UI_OPTS.indexOf(kind) === -1) { return null; }
		mbCEUiState[kind] = mbCEUiOpt(kind) === "1" ? "0" : "1";
		mbCEApplyUiOpts();
		mbCEUiSave({});
		return mbCEUiState[kind];
	} catch (e) { return null; }
}

/* ---- 开关渲染：全局页主题组下方三颗 chip（点哪颗切哪颗，只翻转自身高亮不重绘整页） ---- */
var MCE_UI_OPT_LABEL = {
	fx: ["动效", "涟漪 / 呼吸 / 闪烁 / 开合动画"],
	tex: ["纹理", "面板 / 正文 / 卡片的纸纹与星点"],
	orn: ["边饰", "四边主题花边（随主题换纹样）"]
};
MB_CSS +=
	".mce-opt-row{display:flex;gap:6px;flex-wrap:wrap}" +
	".mce-opt-chip{flex:1 1 0;min-width:64px;padding:5px 8px;cursor:pointer;font-family:inherit;text-align:center;" +
	"font-size:var(--mce-fs-sm);border-radius:var(--mce-radius-pill);border:1px solid var(--mce-border);" +
	"background:var(--mce-bg-btn);color:var(--mce-txt-dim);transition:background .18s,color .18s,border-color .18s}" +
	".mce-opt-chip:hover{border-color:var(--mce-accent);color:var(--mce-txt-strong)}" +
	".mce-opt-chip.mce-on{border-color:var(--mce-accent);color:var(--mce-accent);background:var(--mce-bg-sel)}";
function mceRenderUiOpts(pane) {
	if (!pane) { return null; }
	var body = mceNewGroup(pane, "面板特效", "三档开关 · 只影响外观，不动布局");
	var row = el("div", "mce-opt-row");
	MCE_UI_OPTS.forEach(function (kind) {
		var on = mbCEUiOpt(kind) === "1";
		var b = el("button", "mce-opt-chip" + (on ? " mce-on" : ""), MCE_UI_OPT_LABEL[kind][0]);
		b.type = "button";
		b.setAttribute("data-opt", kind);
		b.title = (on ? "开 · " : "关 · ") + MCE_UI_OPT_LABEL[kind][1];
		b.addEventListener("click", function () {
			var nv = mbCEUiOptToggle(kind);
			if (nv !== null) {
				b.classList.toggle("mce-on", nv === "1");
				b.title = (nv === "1" ? "开 · " : "关 · ") + MCE_UI_OPT_LABEL[kind][1];
			}
		});
		row.appendChild(b);
	});
	body.appendChild(row);
	return row;
}

/* ---- 滚动摘 backdrop-filter（160ms 恢复；属性常设，CSS 只在窄屏媒体查询内生效） ---- */
var mbCEScrollTimer = 0;
function mbCEOnBodyScroll() {
	try {
		if (!root || !root.setAttribute) { return; }
		root.setAttribute("data-mce-scroll", "1");
		if (mbCEScrollTimer) { clearTimeout(mbCEScrollTimer); }
		mbCEScrollTimer = setTimeout(function () {
			mbCEScrollTimer = 0;
			try { if (root) { root.removeAttribute("data-mce-scroll"); } } catch (e2) { /* 面板已卸载 */ }
		}, 160);
	} catch (e) { /* 滚动监听自身失败静默 */ }
}

/* ---- 无障碍：complementary 语义 + 页签 roving tabindex + Esc 关闭 ----
 * 面板是非模态常驻侧栏（打开时游戏正文仍可交互），用 role=complementary 而非 dialog+aria-modal；
 * aria-expanded 由 open/close 维护（09-exports.js）。 */
function mbCETabSyncA11y() {
	try {
		if (!root) { return; }
		var btns = root.querySelectorAll(".mce-tabs button[data-tab]");
		for (var i = 0; i < btns.length; i++) {
			var active = btns[i].classList.contains("mce-active");
			btns[i].setAttribute("aria-selected", active ? "true" : "false");
			btns[i].setAttribute("tabindex", active ? "0" : "-1");
		}
	} catch (e) { /* DOM 半成品状态静默 */ }
}
/* 键盘导航判定与目标计算抽纯函数（压 mbCETabsKey 复杂度） */
function mbCETabKeyValid(ev) {
	try {
		if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) { return ""; }
		var k = ev.key;
		if (k === "ArrowRight" || k === "ArrowLeft" || k === "Home" || k === "End") { return k; }
		return "";
	} catch (e) { return ""; }
}
function mbCETabNext(cur, total, key) {
	if (key === "ArrowRight") { return (cur + 1) % total; }
	if (key === "ArrowLeft") { return (cur - 1 + total) % total; }
	if (key === "Home") { return 0; }
	return total - 1;
}
function mbCETabsKey(ev) {
	try {
		var k = mbCETabKeyValid(ev);
		if (!k) { return; }
		if (!root) { return; }
		var btns = root.querySelectorAll(".mce-tabs button[data-tab]");
		if (!btns.length) { return; }
		var idx = 0;
		for (var i = 0; i < btns.length; i++) {
			if (btns[i].classList.contains("mce-active")) { idx = i; break; }
		}
		ev.preventDefault();
		var next = mbCETabNext(idx, btns.length, k);
		switchOuterTab(btns[next].getAttribute("data-tab"));
		mbCETabSyncA11y();
		try { btns[next].focus(); } catch (e2) { /* 无 focus 环境静默 */ }
	} catch (e) { /* 键盘导航失败不影响点击路径 */ }
}
/* 一次性初始化（init 链调用，热重载守卫） */
var mbCEShell4Bound = false;
var mbCEEscBound = false;
var mbCEScrollBound = false;
function mbCEShell4Init() {
	try {
		if (mbCEShell4Bound) { return; }
		mbCEShell4Bound = true;
		mbCEApplyUiOpts();
		if (root) {
			root.setAttribute("role", "complementary");
			root.setAttribute("aria-label", "Maplebirch CE 剧情条件解锁面板");
		}
		var tabsEl = root ? root.querySelector(".mce-tabs") : null;
		if (tabsEl) {
			tabsEl.setAttribute("role", "tablist");
			/* 点击路径也要同步 roving（click 切 tab 不走键盘分支） */
			tabsEl.addEventListener("click", mbCETabSyncA11y);
			tabsEl.addEventListener("keydown", mbCETabsKey);
			var btns = tabsEl.querySelectorAll("button[data-tab]");
			for (var i = 0; i < btns.length; i++) {
				btns[i].setAttribute("role", "tab");
				btns[i].id = "mce-tab-" + btns[i].getAttribute("data-tab");
			}
			var panes = root.querySelectorAll(".mce-pane");
			for (var j = 0; j < panes.length; j++) {
				panes[j].setAttribute("role", "tabpanel");
				var nm = panes[j].getAttribute("data-pane");
				if (nm) { panes[j].setAttribute("aria-labelledby", "mce-tab-" + nm); }
			}
			mbCETabSyncA11y();
		}
		if (toggleBtn && toggleBtn.setAttribute) {
			toggleBtn.setAttribute("aria-label", "开关 Maplebirch CE 剧情条件解锁面板");
			toggleBtn.setAttribute("aria-expanded", openFlag ? "true" : "false");
		}
		var bodyEl = root ? root.querySelector(".mce-body") : null;
		if (bodyEl && !mbCEScrollBound) {
			mbCEScrollBound = true;
			bodyEl.addEventListener("scroll", mbCEOnBodyScroll, { passive: true });
		}
		var doc = (typeof document !== "undefined" && document) ? document : null;
		if (doc && !mbCEEscBound) {
			mbCEEscBound = true;
			doc.addEventListener("keydown", function (ev) {
				try {
					if (!openFlag || !(ev.key === "Escape" || ev.keyCode === 27)) { return; }
					/* 灯台档案面板（#ml-panel，hidden 属性=关闭态）开着时让出 Esc：它自己会处理，
					 * 否则一次 Esc 会把 CE 与对方一起关掉（v2.2.0 共存修，2026-11-22） */
					if (doc && doc.querySelector("#ml-panel:not([hidden])")) { return; }
					ev.preventDefault(); close();
				} catch (e2) { /* Esc 处理失败不影响其他按键 */ }
			});
		}
	} catch (e) { /* 无障碍初始化失败不阻断面板 */ }
}
