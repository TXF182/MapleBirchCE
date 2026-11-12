	/* ============ UI 兼容层：与外部 UI 模组（DoL-Game-UI）共存 ============
	   结构门禁拆段：07a-shell.js 基线已顶到 400/400 行上限，本段承载 A2/A3 的共存逻辑。
	   先例同 01b-wrote-trim.js（01-core 加错误池后 415 行超限，同法拆出）。
	   本段五件事：① A2 按钮尺寸按类封回（全局规则 (1,3,2)，padding 带 !important）；
	   ② A3 主题变量指向主 UI token（card 走两级回退，见下方 2a）；③ A4 断点跟随 cap.layout（resize 自监听）；
	   ④ A5 动效零 JS（媒体查询 + 主 UI 属性判据）；⑤ token 兜底链本身 var(--a, var(--b, def))。
	   追加方式 MB_CSS +=，manifest 序在 07a-shell.js 之后；injectCSS() 运行时才读 MB_CSS，顺序安全。 */

	/* ---- A2（探针实测，docs\probes\run-ce-align-probe.ps1）----
	   主 UI 开按钮缩放时挂 html[data-dgu-buttons-scaled]，其规则
	     html[...buttons-scaled] :is(button,input[type=button],input[type=submit]):not(#ui-bar *):not([data-overlay=modloader] *)
	   特异性 (1,3,2)：padding 带 !important、min-height 不带。
	   → padding 必须 ID 计数 ≥2 且带 !important 才赢；min-height 任意 !important 即赢。
	   → 必须按按钮类逐条封回原值：一刀切 (padding:3px 9px;min-height:0) 会把页签(--mce-tab-h 36px)、
	     标题栏(0 7px)、网格(6px 8px)、行内(22px) 各自的尺寸语义一起压平。
	   → 前导 html[data-dgu-buttons-scaled] 保证未装主 UI 时这段零匹配（对无主 UI 用户零影响）。 */
	MB_CSS +=
		"html[data-dgu-buttons-scaled] #mce-root#mce-root .mce-btn{padding:3px 9px!important;min-height:0!important}" +
		"html[data-dgu-buttons-scaled] #mce-root#mce-root .mce-btn-grid .mce-btn{padding:6px 8px!important}" +
		"html[data-dgu-buttons-scaled] #mce-root#mce-root .mce-inner button{padding:3px 10px!important;min-height:0!important}" +
		"html[data-dgu-buttons-scaled] #mce-root#mce-root .mce-row button{padding:3px 8px!important;min-height:22px!important}" +
		"html[data-dgu-buttons-scaled] #mce-root#mce-root .mce-tabs button{padding:8px 6px!important;min-height:var(--mce-tab-h)!important}" +
		"html[data-dgu-buttons-scaled] #mce-root#mce-root .mce-header button{padding:0 7px!important;min-height:0!important}";

	/* ---- A3：主 UI 主题 token 跟随（路径 B 的本来目的）----
	   取证（DoL-Game-UI 4.2.0 原始源码，非二手转述）：
	     1. index.js 里 getTheme() 返回的 tokens 是【变量名映射表】不是色值：
	        Cm = {neutral:"--dgu-surface", card:"--dgu-card", ocean:"--dgu-accent", mist:"--dgu-secondary",
	              text:"--dgu-text", danger:"--dgu-danger", radius:"--dgu-radius", cardRadius:"--dgu-card-radius"}
	        → 所以只能把 CE 变量指向主 UI 的变量名，不能抄色值：抄色值要监听主题切换，且主 UI 改版即失效。
	     2. style.css 定义域（按规则块逐块提取，非按行 grep）：--dgu-accent / --dgu-secondary /
	        --dgu-panel / --dgu-radius(12px) / --dgu-card-radius(16px) 在 :root；--dgu-surface / --dgu-border 也在 :root。
	        --dgu-card **不在 :root**：全 8 处定义都在 html[data-stone-free] 与 :is(...) 窄作用域里。
	        html 层那几处可被 #mce-root 继承；主 UI 未启用时变量不存在，靠 var() 兜底链退化。
	     2a. 所以 card 必须两级回退：var(--dgu-card, var(--dgu-panel, #111))。
	        只写 var(--dgu-card, #111) 时，玩家没开 stone-free 就永远拿到 #111，卡片色与主 UI 脱节
	        （2026-11-11 复核发现并修掉的真缺陷）。三级语义链：
	          开 stone-free → --dgu-card = #272729（真卡片色）
	          未开          → 退 --dgu-panel = rgba(29,30,34,.72)
	          未装主 UI     → 再退 #111
	     2b. border 反向不要"修正"成 --dgu-border：:root 上它是 --kw-hairline = #ffffff0b（4.3% 白），
	        --mce-border 只用在 .mce-btn 边框与滚动条 hover，换成它会肉眼看不见；
	        --dgu-secondary = --sf-muted = #aaa9ad 是 :root 可达且可见的那个，mist 映射维持不变。
	     3. Api 挂载：index.js 内 `Ve.DoLGameUI.ui = i.api`，随后 dispatch "dol-ui-runtime-ready"。
	        → 主 UI 晚于 CE 加载时靠该事件补；已先加载时靠 setTimeout(0)/1200ms 兜。
	   只映射 4 个核心变量（清单 A3 口径：不试图一一对应 70 个 --mce-*）。
	   注意 CE 没有 --mce-card-bg，实际变量名是 --mce-bg-card（以源码为准，不照抄清单笔误）。 */

	var MCE_HOST_TOKEN_MAP = [
		{ mce: "--mce-accent", tok: "ocean", def: "#E3B25F" },
		{ mce: "--mce-bg-card", tok: "card", def: "var(--dgu-panel, #12151A)" },
		{ mce: "--mce-border", tok: "mist", def: "rgba(255,255,255,.16)" },
		{ mce: "--mce-radius", tok: "radius", def: "12px" }
	];

	/* 返回成功写入的条数（测试/诊断用）；任何异常吞掉并返回 0 —— CE 是常驻面板，一次抛错就白屏。
	   写入值形如 var(--dgu-accent, #d4a73c)：主 UI 变量存在则跟随，不存在时语法上仍合法并退化到 CE 原值。 */
	function syncHostTokens() {
		try {
			var api = window.DoLGameUI && window.DoLGameUI.ui;
			if (!api || typeof api.getTheme !== "function") { return 0; }
			var theme = api.getTheme();
			var tokens = theme && theme.tokens;
			if (!tokens) { return 0; }
			var root = document.getElementById("mce-root");
			if (!root) { return 0; }
			var n = 0;
			for (var i = 0; i < MCE_HOST_TOKEN_MAP.length; i++) {
				var m = MCE_HOST_TOKEN_MAP[i];
				var name = tokens[m.tok];
				if (typeof name !== "string" || name === "") { continue; }
				root.style.setProperty(m.mce, "var(" + name + ", " + m.def + ")");
				n++;
			}
			return n;
		} catch (e) { return 0; }
	}

	function scheduleHostTokenSync() {
		try { window.addEventListener("dol-ui-runtime-ready", syncHostTokens); } catch (e1) {}
		try { setTimeout(syncHostTokens, 0); } catch (e2) {}
		try { setTimeout(syncHostTokens, 1200); } catch (e3) {}
	}
	scheduleHostTokenSync();

	/* ---- A5：动效强度跟随系统设置与主 UI 动效开关（**零 JS**，故意不读 cap.reducedMotion）----
	   取证（DoL-Game-UI 4.2.0 index.js 原文，getCapabilities 函数体）：
	     P = d("(prefers-reduced-motion: reduce)")   →  reducedMotion: P
	     b = !i && documentElement.hasAttribute("data-dol-midnight")  →  enabled: b
	     motion: b && !P && documentElement.hasAttribute("data-dgu-visualMotion")
	   即 cap.reducedMotion 只是 matchMedia 的镜像，cap.motion 还夹着 enabled。
	   → 读镜像等于多一个会过期的真相源（还得自己监听 media query 变化）；matchMedia 与
	     data-dgu-visualMotion 本来就是浏览器/主 UI 自己维护的活状态，CSS 直接吃即可。
	   两条判据：
	     ① @media (prefers-reduced-motion: reduce) —— 系统级无障碍设置，与主 UI 装不装无关；
	     ② html[data-dol-midnight]:not([data-dgu-visualMotion]) —— 主 UI 已启用但玩家关了动效开关。
	        前导 data-dol-midnight 保证未装主 UI 时零匹配（该属性是主 UI 启用的准确标志）。
	   必须逐宿主写：动画声明分散在 #mce-root.mce-open / #mce-toggle.mce-theme-starry /
	   .mce-anchor-prompt 三处；.mce-anchor-prompt 挂在 #story 首个子元素下，既不在 #mce-root 里
	   也不是 body 直属，后代选择器够不到。 */
	MB_CSS +=
		"@media (prefers-reduced-motion: reduce){" +
		"#mce-root,#mce-root *{animation:none!important;transition:none!important}" +
		"#mce-toggle{animation:none!important;transition:none!important}" +
		".mce-anchor-prompt{animation:none!important;transition:none!important}" +
		".mce-anchor-prompt *{animation:none!important;transition:none!important}" +
		"}" +
		"html[data-dol-midnight]:not([data-dgu-visualMotion]) #mce-root," +
		"html[data-dol-midnight]:not([data-dgu-visualMotion]) #mce-root *{" +
		"animation:none!important;transition:none!important}" +
		"html[data-dol-midnight]:not([data-dgu-visualMotion]) #mce-toggle," +
		"html[data-dol-midnight]:not([data-dgu-visualMotion]) .mce-anchor-prompt," +
		"html[data-dol-midnight]:not([data-dgu-visualMotion]) .mce-anchor-prompt *{" +
		"animation:none!important;transition:none!important}";

	/* ---- A4：面板宽度/断点跟随主 UI 的 cap.layout ----
	   取证（index.js 原文）：layout = innerWidth<=600 ? "mobile" : innerWidth<=899 ? "tablet" : "desktop"。
	   必须写 JS 的原因：主 UI **不把 layout 挂到 html 上**——MutationObserver 的 attributeFilter 只有
	   ["data-dol-midnight","data-dgu-visual","data-dgu-visualGlass","data-dgu-visualMotion"]。
	   所以 layout 只是 getCapabilities() 调用瞬间的快照，旋转屏幕/拖窗口不会自动更新，必须自己
	   监 resize 重算，否则面板会停在旧断点。
	   与清单原写法的差异：只在 mobile 时全屏，tablet 不动——CE 的 430px 浮动面板在 601~899px 里本来
	   够用，跟着 tablet 改几何没有收益，只多一条可变的几何来源。
	   只改几何、不复制 @media(max-width:520px) 的排版补偿：那份补偿是为**430px 面板宽**设计的
	   （07a-shell.js 注释原文"避免 84-90px 输入框 + 两个按钮挤在同一行而溢出错位"）；521~600px 全屏后
	   可用宽度 ≥521px，拥挤前提已消失。
	   → 代价：521~600px 比现状（520 才全屏）提前约 80px 全屏。这是"跟随主 UI 移动布局"的必要取舍。
	   未装主 UI 时不挂类，对无主 UI 用户零影响。 */
	var MCE_HOST_MOBILE_CLASS = "mce-host-mobile";

	MB_CSS +=
		"#mce-root.mce-host-mobile{top:0;right:0;bottom:0;left:0;width:100vw;max-width:100vw;max-height:100vh;border-radius:0;border:none}";

	function syncHostLayout() {
		try {
			var root = document.getElementById("mce-root");
			if (!root) { return 0; }
			var api = window.DoLGameUI && window.DoLGameUI.ui;
			var mobile = false;
			if (api && typeof api.getCapabilities === "function") {
				var capabilities = api.getCapabilities();
				mobile = !!(capabilities && capabilities.layout === "mobile");
			}
			if (mobile) { root.classList.add(MCE_HOST_MOBILE_CLASS); }
			else { root.classList.remove(MCE_HOST_MOBILE_CLASS); }
			return mobile ? 1 : 0;
		} catch (e) { return 0; }
	}

	/* resize 节流 150ms：getCapabilities() 内部要跑 CSS.supports() 两三次，拖动窗口时每帧调会卡。
	   抛错路径故意不动 class —— getCapabilities 抛错时保持现状，比按"非 mobile"误摘更安全。 */
	var MCE_HOST_RESIZE_TIMER = 0;
	function onHostResize() {
		try {
			if (MCE_HOST_RESIZE_TIMER) { clearTimeout(MCE_HOST_RESIZE_TIMER); }
			MCE_HOST_RESIZE_TIMER = setTimeout(function () {
				MCE_HOST_RESIZE_TIMER = 0;
				syncHostLayout();
			}, 150);
		} catch (e) {}
	}

	function scheduleHostLayoutSync() {
		try { window.addEventListener("resize", onHostResize); } catch (e1) {}
		try { window.addEventListener("dol-ui-runtime-ready", syncHostLayout); } catch (e2) {}
		try { setTimeout(syncHostLayout, 0); } catch (e3) {}
		try { setTimeout(syncHostLayout, 1200); } catch (e4) {}
	}
	scheduleHostLayoutSync();
