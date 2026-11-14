/* 职责：灯台视觉层 —— 按压涟漪 / 动效开关 / 主题选择器 */
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

/* ================================================================ v2.0.23 四主题 token
 * 数值来源：MapleLantern v1.1.8 src/style.css（本地仓库 DoL-Project\MapleLantern\src\style.css）
 *   cyberpunk  L80-L119  --ml-* 令牌 + 6 层面板纹理 / 2 层正文 / 3 层卡片
 *   jade       L121-L150 青瓷釉色 + 7 层开片纹理（112° 高光条 / 118° 对角反光 / 66°·28°·-24° 三向细纹）
 *   star       L181-L224 银河 58° 流光带 + 10 个面板星点 + 3 个正文星点 + 2 个卡片星点 + 116°/64° 双流星线
 * 落地口径（照 MapleLantern 自己写在 L1052 的原则）：
 *   「只叠加颜色、描边、静态网格与光晕；布局尺寸沿用既有规格。」
 *   于是这里只做三件事：① 重声明 --mce-* 变量（组件零改动即换肤）；② 覆盖面板/正文的字面 background-image；
 *   ③ 头部分色条走 background-size 贴片（不新增伪元素、不改 flex 排版）。
 * 为什么追加在本段末尾：MB_CSS 是字符串累加，07a-shell.js 的原有规则在前，同特异度下后写生效，
 *   所以 07a-shell.js 那 400 行顶格文件一个字都不用动。
 * ---------------------------------------------------------------- */

/* ---- 赛博朋克：青 #00E5FF 主调 + 品红 #FF3D9A 副调，网格与斜切光带 ---- */
MB_CSS +=
	"#mce-root.mce-theme-cyberpunk{--mce-accent:#00E5FF;--mce-accent-hover:#7DF9FF;--mce-accent-dark:#0089A8;--mce-accent-55:rgba(0,229,255,.55);" +
	"--mce-gold-soft:#FF8CC6;--mce-gold-note:#7A2C52;--mce-gold-bg:#160B22;--mce-gold-txt:#FFB8DA;" +
	"--mce-bg-panel:rgba(5,7,15,.94);--mce-bg-deep:#05070F;--mce-bg-base:#0B1020;--mce-bg-card:#0B1020;--mce-bg-block:#101830;" +
	"--mce-bg-stage:#0A1120;--mce-bg-detail:#0B1020;--mce-bg-ctl:#101830;--mce-bg-btn:#0A1120;--mce-bg-hover:#141F38;--mce-bg-sel:#0A1120;" +
	"--mce-border:rgba(0,229,255,.18);--mce-border-soft:rgba(0,229,255,.14);--mce-border-dim:rgba(0,229,255,.10);" +
	"--mce-border-ctl:rgba(0,229,255,.24);--mce-border-stage:rgba(0,229,255,.34);--mce-border-quiet:rgba(0,229,255,.10);" +
	"--mce-txt:#E6F7FF;--mce-txt-bright:#FFFFFF;--mce-txt-on-accent:#021014;--mce-txt-hi:#DFF6FF;--mce-txt-label:#CFEFFF;--mce-txt-strong:#E6F7FF;" +
	"--mce-txt-mid:#8AA4BE;--mce-txt-dim:#7E98B2;--mce-txt-faint:#5D7692;--mce-txt-muted:#8AA4BE;--mce-txt-weak:#4E6480;--mce-txt-star:#3D5875;" +
	"--mce-tex-panel:linear-gradient(132deg,transparent 42%,rgba(0,229,255,.03) 47%,transparent 52%,transparent 76%,rgba(255,61,154,.04) 82%,transparent 88%)," +
	"radial-gradient(120% 76% at 100% 0%,rgba(255,61,154,.17),transparent 54%),radial-gradient(80% 60% at 0% 100%,rgba(0,229,255,.12),transparent 62%)," +
	"repeating-linear-gradient(0deg,transparent 0 31px,rgba(0,229,255,.085) 31px 32px),repeating-linear-gradient(90deg,transparent 0 47px,rgba(255,61,154,.06) 47px 48px)," +
	"repeating-linear-gradient(135deg,transparent 0 9px,rgba(0,229,255,.03) 9px 10px);" +
	"--mce-tex-body:repeating-linear-gradient(0deg,transparent 0 23px,rgba(0,229,255,.026) 23px 24px)," +
	"linear-gradient(135deg,transparent 48%,rgba(255,61,154,.024) 49%,transparent 50%);" +
	"--mce-tex-card:linear-gradient(135deg,rgba(0,229,255,.09),transparent 48%),linear-gradient(315deg,rgba(255,61,154,.06),transparent 44%)," +
	"repeating-linear-gradient(0deg,rgba(0,229,255,.018) 0 1px,transparent 1px 4px);" +
	"--mce-press-glow:rgba(0,229,255,.56);--mce-press-ripple:rgba(125,249,255,.24);--mce-shadow-panel:0 24px 64px rgba(0,0,0,.62),0 0 0 1px rgba(255,61,154,.12),0 0 34px rgba(0,229,255,.12)}" +
	"#mce-root.mce-theme-cyberpunk{background-color:var(--mce-bg-panel);background-image:var(--mce-tex-panel);" +
	"border-color:rgba(0,229,255,.36);box-shadow:var(--mce-shadow-panel),inset 0 1px 0 rgba(214,255,255,.12),inset 0 0 32px rgba(0,229,255,.06),inset 0 0 0 1px rgba(255,61,154,.05)}" +
	"#mce-root.mce-theme-cyberpunk .mce-body{background-image:var(--mce-tex-body);background-attachment:local}" +
	"#mce-root.mce-theme-cyberpunk .mce-header{background-image:linear-gradient(90deg,#FF3D9A,#00E5FF 34%,#00E5FF 68%,#FF3D9A);" +
	"background-size:100% 2px;background-repeat:no-repeat;background-position:center bottom}" +
	"#mce-root.mce-theme-cyberpunk .mce-tabs button.mce-active::after{background:linear-gradient(90deg,#FF3D9A,#00E5FF);box-shadow:0 0 10px rgba(0,229,255,.42)}" +
	"#mce-root.mce-theme-cyberpunk .mce-title{letter-spacing:.12em;text-shadow:0 0 10px rgba(0,229,255,.22)}" +
	"#mce-toggle.mce-theme-cyberpunk{background:linear-gradient(135deg,#0B2330,#09101E 62%,#05070F);border-color:rgba(0,229,255,.5);" +
	"box-shadow:0 0 18px rgba(0,229,255,.26),0 10px 26px rgba(0,0,0,.58)}" +
	".mce-anchor-prompt.mce-theme-cyberpunk{background:#0A1120;color:#E6F7FF;border-bottom-color:#00E5FF}" +
	".mce-anchor-prompt.mce-theme-cyberpunk button{background:#0A1120;color:#E6F7FF;border-color:rgba(0,229,255,.28)}" +
	".mce-anchor-prompt.mce-theme-cyberpunk .mce-anchor-go{background:#00E5FF;color:#021014;border-color:#0089A8}" ;

/* ---- 青瓷（jade）：青釉 #5FBFAC，七层开片纹理模拟瓷器冰裂 ---- */
MB_CSS +=
	"#mce-root.mce-theme-jade{--mce-accent:#5FBFAC;--mce-accent-hover:#7FD6C5;--mce-accent-dark:#2E7A6B;--mce-accent-55:rgba(95,191,172,.55);" +
	"--mce-gold-soft:#C8FFF2;--mce-gold-note:#3E6F63;--mce-gold-bg:#0E211C;--mce-gold-txt:#BFF2E4;" +
	"--mce-bg-panel:rgba(10,17,16,.94);--mce-bg-deep:#0A1110;--mce-bg-base:#111A18;--mce-bg-card:#111A18;--mce-bg-block:#141E1C;" +
	"--mce-bg-stage:#101A18;--mce-bg-detail:#111A18;--mce-bg-ctl:#182421;--mce-bg-btn:#141F1C;--mce-bg-hover:#1E2C28;--mce-bg-sel:#16221F;" +
	"--mce-border:rgba(95,191,172,.18);--mce-border-soft:rgba(95,191,172,.14);--mce-border-dim:rgba(95,191,172,.10);" +
	"--mce-border-ctl:rgba(95,191,172,.24);--mce-border-stage:rgba(95,191,172,.34);--mce-border-quiet:rgba(95,191,172,.10);" +
	"--mce-txt:#E6EEE9;--mce-txt-bright:#FFFFFF;--mce-txt-on-accent:#06130F;--mce-txt-hi:#DCEAE4;--mce-txt-label:#CFE0D8;--mce-txt-strong:#E6EEE9;" +
	"--mce-txt-mid:#A9BDB4;--mce-txt-dim:#9BAEA5;--mce-txt-faint:#7E958C;--mce-txt-muted:#A9BDB4;--mce-txt-weak:#6E8479;--mce-txt-star:#4F6359;" +
	"--mce-tex-panel:linear-gradient(112deg,transparent 28%,rgba(190,255,240,.06) 40%,rgba(190,255,240,.012) 50%,transparent 62%)," +
	"radial-gradient(110% 80% at 8% 0%,rgba(95,191,172,.2),transparent 58%),radial-gradient(80% 60% at 100% 100%,rgba(127,214,197,.1),transparent 62%)," +
	"linear-gradient(118deg,transparent 42%,rgba(255,255,255,.04) 43%,transparent 44%)," +
	"repeating-linear-gradient(66deg,rgba(127,214,197,.058) 0 1px,transparent 1px 10px)," +
	"repeating-linear-gradient(28deg,transparent 0 21px,rgba(233,255,249,.038) 21px 22px)," +
	"repeating-linear-gradient(-24deg,rgba(255,255,255,.028) 0 1px,transparent 1px 16px);" +
	"--mce-tex-body:radial-gradient(100% 70% at 50% 0%,rgba(95,191,172,.07),transparent 70%)," +
	"repeating-linear-gradient(66deg,rgba(127,214,197,.02) 0 1px,transparent 1px 9px)," +
	"repeating-linear-gradient(28deg,transparent 0 21px,rgba(233,255,249,.016) 21px 22px);" +
	"--mce-tex-card:linear-gradient(135deg,rgba(95,191,172,.1),transparent 58%),radial-gradient(120% 80% at 0% 0%,rgba(220,255,247,.05),transparent 55%)," +
	"repeating-linear-gradient(-24deg,rgba(255,255,255,.016) 0 1px,transparent 1px 9px);" +
	"--mce-press-glow:rgba(127,214,197,.5);--mce-press-ripple:rgba(200,255,242,.22);--mce-shadow-panel:0 24px 64px rgba(0,0,0,.55),0 0 0 1px rgba(95,191,172,.1),0 0 30px rgba(95,191,172,.08)}" +
	"#mce-root.mce-theme-jade{background-color:var(--mce-bg-panel);background-image:var(--mce-tex-panel);" +
	"border-color:rgba(95,191,172,.34);box-shadow:var(--mce-shadow-panel),inset 0 1px 0 rgba(220,255,247,.13),inset 0 0 32px rgba(95,191,172,.07),inset 0 0 0 1px rgba(95,191,172,.06)}" +
	"#mce-root.mce-theme-jade .mce-body{background-image:var(--mce-tex-body);background-attachment:local}" +
	"#mce-root.mce-theme-jade .mce-header{background-image:linear-gradient(90deg,rgba(95,191,172,.15),#5FBFAC 50%,rgba(95,191,172,.15));" +
	"background-size:100% 1px;background-repeat:no-repeat;background-position:center bottom}" +
	"#mce-root.mce-theme-jade .mce-tabs button.mce-active::after{background:linear-gradient(90deg,#5FBFAC,rgba(200,255,242,.5));box-shadow:0 0 8px rgba(127,214,197,.4)}" +
	"#mce-root.mce-theme-jade .mce-title{letter-spacing:.06em;text-shadow:0 0 8px rgba(95,191,172,.18)}" +
	"#mce-toggle.mce-theme-jade{background:linear-gradient(135deg,#182421,#111A18 58%,#0A1110);border-color:rgba(95,191,172,.45);" +
	"box-shadow:0 0 16px rgba(95,191,172,.2),0 10px 26px rgba(0,0,0,.55)}" +
	".mce-anchor-prompt.mce-theme-jade{background:#0E211C;color:#DCEAE4;border-bottom-color:#5FBFAC}" +
	".mce-anchor-prompt.mce-theme-jade button{background:#141F1C;color:#E6EEE9;border-color:rgba(95,191,172,.28)}" +
	".mce-anchor-prompt.mce-theme-jade .mce-anchor-go{background:#5FBFAC;color:#06130F;border-color:#2E7A6B}" ;

/* ---- 星空升级：从 6 星点薄雾 → 银河带 + 15 星点 + 双流星线（数值全部取自 MapleLantern L181-L224） ---- */
MB_CSS +=
	"#mce-root.mce-theme-starry{--mce-accent:#8FA6FF;--mce-accent-hover:#A9C0FF;--mce-accent-dark:#5D74C9;--mce-accent-55:rgba(143,166,255,.55);" +
	"--mce-gold-soft:#FFE3B0;--mce-gold-note:#6E6A9A;--mce-gold-bg:#131A33;--mce-gold-txt:#C9D8FF;" +
	"--mce-bg-panel:rgba(7,10,20,.95);--mce-bg-deep:#070A14;--mce-bg-base:#0D1222;--mce-bg-card:#0D1222;--mce-bg-block:#111830;" +
	"--mce-bg-stage:#0D1222;--mce-bg-detail:#111830;--mce-bg-ctl:#151B31;--mce-bg-btn:#121A2E;--mce-bg-hover:#1C2544;--mce-bg-sel:#131A31;" +
	"--mce-border:rgba(143,166,255,.20);--mce-border-soft:rgba(143,166,255,.15);--mce-border-dim:rgba(143,166,255,.10);" +
	"--mce-border-ctl:rgba(143,166,255,.24);--mce-border-stage:rgba(143,166,255,.36);--mce-border-quiet:rgba(143,166,255,.10);" +
	"--mce-txt:#E5EAF8;--mce-txt-bright:#FFFFFF;--mce-txt-on-accent:#080C1A;--mce-txt-hi:#DFE5FA;--mce-txt-label:#D2D9F2;--mce-txt-strong:#E5EAF8;" +
	"--mce-txt-mid:#A2ACCB;--mce-txt-dim:#98A2C2;--mce-txt-faint:#7884A6;--mce-txt-muted:#A2ACCB;--mce-txt-weak:#6B7699;--mce-txt-star:#4E5877;" +
	"--mce-tex-panel:linear-gradient(58deg,transparent 24%,rgba(111,90,255,.05) 34%,rgba(190,205,255,.15) 48%,rgba(111,90,255,.04) 60%,transparent 72%)," +
	"radial-gradient(90% 65% at 18% 0%,rgba(111,90,255,.18),transparent 58%),radial-gradient(70% 55% at 84% 18%,rgba(143,166,255,.12),transparent 62%)," +
	"radial-gradient(100% 34% at 50% 100%,rgba(111,90,255,.13),transparent 72%)," +
	"radial-gradient(1.5px 1.5px at 12% 9%,rgba(255,255,255,.7) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 78% 16%,rgba(196,208,255,.6) 0,rgba(196,208,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 34% 6%,rgba(255,255,255,.5) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 92% 34%,rgba(143,166,255,.6) 0,rgba(143,166,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 22% 43%,rgba(255,255,255,.42) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 62% 58%,rgba(196,208,255,.44) 0,rgba(196,208,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 6% 62%,rgba(255,255,255,.42) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(2.5px 2.5px at 88% 72%,rgba(196,208,255,.55) 0,rgba(196,208,255,0) 3px)," +
	"radial-gradient(1.5px 1.5px at 44% 76%,rgba(255,255,255,.38) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 54% 88%,rgba(196,208,255,.36) 0,rgba(196,208,255,0) 2px)," +
	"linear-gradient(116deg,transparent 22%,rgba(143,166,255,.14) 22.2%,transparent 22.6%)," +
	"linear-gradient(64deg,transparent 68%,rgba(143,166,255,.1) 68.2%,transparent 68.6%);" +
	"--mce-tex-body:radial-gradient(80% 55% at 20% 0%,rgba(111,90,255,.09),transparent 62%),radial-gradient(90% 35% at 50% 100%,rgba(111,90,255,.07),transparent 72%)," +
	"radial-gradient(1.5px 1.5px at 16% 18%,rgba(255,255,255,.32) 0,rgba(255,255,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 72% 42%,rgba(196,208,255,.3) 0,rgba(196,208,255,0) 2px)," +
	"radial-gradient(1.5px 1.5px at 46% 84%,rgba(255,255,255,.26) 0,rgba(255,255,255,0) 2px);" +
	"--mce-tex-card:linear-gradient(135deg,rgba(143,166,255,.13),transparent 62%)," +
	"radial-gradient(1.5px 1.5px at 18% 22%,rgba(255,255,255,.26) 0,rgba(255,255,255,0) 1.8px)," +
	"radial-gradient(1.5px 1.5px at 72% 68%,rgba(196,208,255,.28) 0,rgba(196,208,255,0) 2px);" +
	"--mce-press-glow:rgba(143,166,255,.5);--mce-press-ripple:rgba(205,218,255,.22);" +
	"--mce-shadow-panel:0 24px 64px rgba(0,0,0,.6),0 0 0 1px rgba(143,166,255,.1),0 0 34px rgba(111,90,255,.12)}" +
	"#mce-root.mce-theme-starry{background-color:var(--mce-bg-panel);background-image:var(--mce-tex-panel);" +
	"border-color:rgba(143,166,255,.36);box-shadow:var(--mce-shadow-panel),inset 0 1px 0 rgba(215,226,255,.14),inset 0 0 40px rgba(111,90,255,.14)}" +
	"#mce-root.mce-theme-starry .mce-body{background-image:var(--mce-tex-body);background-attachment:local}" +
	"#mce-root.mce-theme-starry .mce-header{background-image:linear-gradient(90deg,rgba(111,90,255,.2),#8FA6FF 50%,rgba(111,90,255,.2));" +
	"background-size:100% 1px;background-repeat:no-repeat;background-position:center bottom}" +
	"#mce-root.mce-theme-starry .mce-tabs button.mce-active::after{background:linear-gradient(90deg,#8FA6FF,rgba(205,218,255,.6));box-shadow:0 0 10px rgba(143,166,255,.4)}" +
	"#mce-toggle.mce-theme-starry{background:linear-gradient(135deg,#151B31,#5D74C9 55%,#8FA6FF);border-color:#8FA6FF;" +
	"box-shadow:0 0 16px rgba(143,166,255,.3),0 10px 26px rgba(0,0,0,.55)}" +
	".mce-anchor-prompt.mce-theme-starry{background:#131A33;color:#C9D8FF;border-bottom-color:#8FA6FF}" +
	".mce-anchor-prompt.mce-theme-starry button{background:#121A2E;color:#E5EAF8;border-color:rgba(143,166,255,.24)}" +
	".mce-anchor-prompt.mce-theme-starry .mce-anchor-go{background:#8FA6FF;color:#080C1A;border-color:#5D74C9}" ;

/* ---- 按压涟漪随主题取色 ----
 * #mce-press-ring 挂在 body 顶层（不在 #mce-root 内），拿不到 root 的变量继承；
 * 主题名同时写到 documentElement 的 data-mce-theme，由这三条把辉光色递到 ring 上。
 * 兜底：属性缺失（未切过主题 / 老版本遗留）时仍用 :root 的暖金默认值。 */
MB_CSS +=
	':root[data-mce-theme="cyberpunk"]{--mce-press-glow:rgba(0,229,255,.56);--mce-press-ripple:rgba(125,249,255,.24)}' +
	':root[data-mce-theme="jade"]{--mce-press-glow:rgba(127,214,197,.5);--mce-press-ripple:rgba(200,255,242,.22)}' +
	':root[data-mce-theme="starry"]{--mce-press-glow:rgba(143,166,255,.5);--mce-press-ripple:rgba(205,218,255,.22)}' ;

/* ---- 减动效：新主题的悬浮球呼吸沿用 mce-breathe（已受 prefers-reduced-motion 熔断），
   这里只补一条「渐变光晕不许在减动效下继续闪」的兜底，避免新主题把旧熔断绕过去。 */

/* ---- v2.1.0 主题选择器：从面板头部搬到「全局」页最上面 ----
 * 旧形态是头部一颗按钮循环（gold→starry→cyberpunk→jade，想要青瓷得点三下），
 * 玩家看不出"现在是第几档、还有几档"。新形态是全局页顶部四档平铺：一档一颗，
 * 点哪个就立刻是哪个，当前档高亮，配一句气质文案做 title。
 * 位置由 renderGlobal() 决定（frameworkReady 之后、任何业务分组之前）——外观是面板自己的事，排最前。 */
MB_CSS +=
	".mce-theme-pick-row{display:flex;flex-wrap:wrap;gap:6px}" +
	".mce-theme-pick{flex:1 1 0;min-width:76px;min-height:34px;padding:6px 10px;cursor:pointer;font-family:inherit;text-align:center;" +
	"font-size:var(--mce-fs-btn);border-radius:var(--mce-radius);border:1px solid var(--mce-border);background:var(--mce-bg-btn);color:var(--mce-txt);" +
	"white-space:nowrap;transition:background .18s,color .18s,border-color .18s,box-shadow .18s}" +
	".mce-theme-pick:hover{background:var(--mce-bg-hover);color:var(--mce-txt-strong)}" +
	".mce-theme-pick.mce-on{background:var(--mce-accent);color:var(--mce-txt-on-accent);border-color:var(--mce-accent-dark);" +
	"font-weight:600;box-shadow:0 0 12px var(--mce-press-glow,rgba(0,0,0,0))}" +
	".mce-theme-pick.mce-on:hover{background:var(--mce-accent-hover);color:var(--mce-txt-on-accent)}" ;

/* 短名（按钮上只放这个，四档一行放得下）+ 长文案（title/状态条用）
   字形只用中易黑体/雅黑都有的几何符：✦(U+2726) 在雅黑下渲染成豆腐方块，实测换成 ◇/★/⚡/◆。 */
var MCE_THEME_NAME = { gold: "黑金", starry: "星空蓝", cyberpunk: "赛博朋克", jade: "青瓷" };
var MCE_THEME_TIP = { gold: "黑金 · 默认暖金材质", starry: "星空蓝 ✦ 愿星光指引你", cyberpunk: "赛博朋克 ⚡ 霓虹已通电", jade: "青瓷 · 温润如玉" };
var MCE_THEME_ICON = { gold: "◇", starry: "★", cyberpunk: "⚡", jade: "◆" };
/* 渲染四档选择器并插进 pane（renderGlobal 传入 [data-pane="global"]）。
   点击后整页重绘：高亮换到新档，标题栏的版本号/状态条一起刷新。 */
function mceRenderThemePicker(pane) {
	if (!pane) { return null; }
	var cur = getTheme();
	var body = mceNewGroup(pane, "外观主题", "四档 · 点一下立刻换，自动记住");
	var row = el("div", "mce-theme-pick-row");
	MCE_THEMES.forEach(function (name) {
		var b = el("button", "mce-theme-pick" + (name === cur ? " mce-on" : ""), (MCE_THEME_ICON[name] || "✦") + " " + (MCE_THEME_NAME[name] || name));
		b.type = "button";
		b.setAttribute("data-theme", name);
		b.title = MCE_THEME_TIP[name] || name;
		b.addEventListener("click", function () {
			if (getTheme() === name) { return; }
			setTheme(name);
			renderGlobal();
		});
		row.appendChild(b);
	});
	body.appendChild(row);
	return row;
}

