/* 07a-shell3-fx：v2.0.21 灯台视觉层（设计参考 MapleLantern v1.1.7 src/style.css 原文）。
   为什么独立成段，而不是补进 07a-shell.js：
   ① 07a-shell.js 已顶到 tools/build_js.js 结构门禁 S1 的单段 400 行上限；另行开段，不给自己开 structure-baseline 豁免；
   ② 原有 MB_CSS 的末尾一段是 @media (max-width:520px) 窄屏适配块（v2.0.7 P5）。把特效塞在那里面，
      结果是「桌面全屏看不见涟漪、只有手机竖屏能看到」—— 属于最难复现的那类 bug，本轮已实测踩到并修掉。
   CSS 用 MB_CSS += 追加（与 07a-host-compat.js / 07d-places4.js 同一机制）；
   manifest 段序保证本段排在 07a-shell.js 之后（var MB_CSS 已初始化、el() 已可用）。 */

/* ---- 纸纹（纯 CSS 多层渐变，零贴图、零网络请求）+ 按压辉光 + 玻璃参数 ----
   :root 可以重复声明，这里追加的 7 个 token 与 07a-shell.js 里的 :root 无属性冲突。 */
MB_CSS +=
	":root{" +
	"--mce-tex-panel:radial-gradient(120% 80% at 10% 0%,rgba(227,178,95,.20),transparent 58%),radial-gradient(90% 60% at 100% 100%,rgba(198,84,73,.09),transparent 62%),radial-gradient(70% 35% at 50% 100%,rgba(120,66,28,.10),transparent 72%),repeating-linear-gradient(92deg,rgba(255,255,255,.024) 0 1px,transparent 1px 4px),repeating-linear-gradient(2deg,rgba(227,178,95,.032) 0 1px,transparent 1px 7px);" +
	"--mce-tex-body:radial-gradient(100% 70% at 50% 0%,rgba(227,178,95,.075),transparent 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.018) 0 1px,transparent 1px 6px);" +
	"--mce-tex-card:linear-gradient(135deg,rgba(227,178,95,.10),transparent 58%),radial-gradient(120% 80% at 10% 0%,rgba(255,235,200,.06),transparent 60%),repeating-linear-gradient(0deg,rgba(255,255,255,.014) 0 1px,transparent 1px 5px);" +
	"--mce-press-glow:rgba(227,178,95,.50);--mce-press-ripple:rgba(255,228,180,.22);--mce-blur:20px;" +
	"--mce-shadow-panel:0 24px 64px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.35)}" ;

/* ---- 页签激活下划线：从左生长（transform-origin:left + scaleX .2→1，0.16s） ----
   依赖 07a-shell.js 里给 .mce-tabs button 加的 position:relative 作为定位父级。 */
MB_CSS +=
	".mce-tabs button.mce-active::after{content:\"\";position:absolute;left:0;right:0;bottom:-2px;height:2px;transform-origin:left center;" +
	"background:linear-gradient(90deg,var(--mce-accent),var(--mce-press-ripple));box-shadow:0 0 10px var(--mce-press-glow);" +
	"animation:mce-tabline .16s ease both}" ;

/* ---- 玻璃 / 点击涟漪 / 呼吸 / 熔断 ----
   玻璃：@supports 双写守卫，不支持就完全不声明（否则得到「半透明但没模糊」的脏底）。
   涟漪：20px 圆环 scale .45→1.9→3.4，0.46s 灯台曲线，screen 混合只提亮不压暗；
   挂 fixed + body 顶层，是因为 CE 有三层裁剪（#mce-root overflow:hidden / .mce-body overflow-y:auto / .mce-tabs overflow-x:auto）。
   呼吸：只动 box-shadow 不动 transform —— 悬浮球要能被拖动，动 transform 会和拖拽位移打架。 */
MB_CSS +=
	"@supports ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))){" +
	"#mce-root{-webkit-backdrop-filter:blur(var(--mce-blur)) saturate(1.1);backdrop-filter:blur(var(--mce-blur)) saturate(1.1)}}" +
	".mce-body{background-image:var(--mce-tex-body);background-attachment:local}" +
	".mce-group{background-image:var(--mce-tex-card)}" +
	"#mce-press-ring{position:fixed;left:0;top:0;width:20px;height:20px;border-radius:50%;border:2px solid var(--mce-press-glow);" +
	"background:transparent;box-shadow:0 0 0 1px var(--mce-press-ripple),0 0 26px var(--mce-press-glow),inset 0 0 12px var(--mce-press-ripple);" +
	"pointer-events:none;z-index:2147483001;mix-blend-mode:screen;transform:translate(-50%,-50%) scale(.45);opacity:.95;" +
	"animation:mce-press-ripple .46s cubic-bezier(.2,.8,.25,1) forwards}" +
	"@keyframes mce-press-ripple{0%{opacity:.95;transform:translate(-50%,-50%) scale(.45)}55%{opacity:.9;transform:translate(-50%,-50%) scale(1.9)}100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)}}" +
	"@keyframes mce-tabline{from{transform:scaleX(.2);opacity:0}to{transform:scaleX(1);opacity:1}}" +
	"@keyframes mce-breathe{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 10px var(--mce-press-glow)}50%{box-shadow:0 4px 14px rgba(0,0,0,.6),0 0 22px var(--mce-press-glow)}}" +
	"#mce-toggle{animation:mce-breathe 4.2s ease-in-out infinite}" +
	"#mce-toggle:active{transform:scale(.94);box-shadow:0 0 0 4px var(--mce-press-glow),0 18px 38px rgba(0,0,0,.5)}" +
	/* 涟漪挂在 body 层，不在 #mce-root 的后代里 —— 07a-host-compat.js 那三条 animation:none 够不到它，必须自带熔断 */
	"@media (prefers-reduced-motion:reduce){#mce-press-ring{animation:none!important;opacity:0!important}}" ;

/* ---- 点击特效 JS：捕获阶段 pointerdown，只加视觉、不拦事件 ----
   熔断判据与 07a-host-compat.js 的两条严格一致（系统级 reduced-motion / 主 UI 关了 data-dgu-visualMotion）。 */
function mbCEAnimOff() {
	try {
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return true; }
		var de = document.documentElement;
		return !!(de && de.hasAttribute("data-dol-midnight") && !de.hasAttribute("data-dgu-visualMotion"));
	} catch (e) { return false; }
}

var MCE_PRESS_SEL = ".mce-btn,.mce-tabs button,.mce-card,.mce-data-card,.mce-seg-btn,.mce-chip,.mce-fold-btn,.mce-icon,.mce-anchor-go";

function mbCEPressRing(ev) {
	try {
		if (!ev || ev.button > 0) { return; }
		if (mbCEAnimOff()) { return; }
		var t = ev.target;
		if (!t || !t.closest || !t.closest(MCE_PRESS_SEL)) { return; }
		var d = el("div", "");
		d.className = "mce-press-ring";
		d.setAttribute("aria-hidden", "true");
		d.style.left = ev.clientX + "px";
		d.style.top = ev.clientY + "px";
		(document.body || document.documentElement).appendChild(d);
		setTimeout(function () { if (d.parentNode) { d.parentNode.removeChild(d); } }, 520);
	} catch (e) {}
}

if (typeof document !== "undefined" && document && document.addEventListener) {
	document.addEventListener("pointerdown", mbCEPressRing, true);
}
