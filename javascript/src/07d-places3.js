/* 剧情入口四组（用户拍板 A 象牙怨灵 + B 节日三线）—— 结构门禁 S1 拆段。
   本片段只放「四组登记 + 节日/怨灵状态保底」；分组与渲染主逻辑仍在
   07d-places.js（PLACE_GROUPS / ensureSceneStateFor）与 07d-places2.js（renderPlacesDirect）。

   取证（本体 0.5.12.13 单行 HTML，逐条实测，非摘要转述）：
   A 象牙怨灵 —— 原版 $passageData 的测试直跳表里自带
       { link: ["Summon the Wraith", "Wraith Test Start"],
         widgets: [<<endcombat>>,
                   <<run Time.timeTravel(new DateTime(Time.year, Time.month, Time.lastDayOfMonth, 21, 0))>>,
                   <<set $moonstate to "evening">>] }
     → Wraith Test Start 首行 <<set $outside to 0>><<set $location to "home">> + <<generateWraith 1 true>>，
       自带 NPC 生成与退出链接（"I'm going to jump out my window now, bye." → Domus Street，
       带 <<endWraith>><<clearWraith>><<set $eventskip to 1>>），不需要任何外部前置。
       68 段怨灵剧情里只有它是可安全直达的入口：其余 59 段是战斗中继段
       （Wraith Stalk 依赖 $molestationstart、Wraith Caught 依赖 $struggle_start，硬跳必崩）。
   B 节日三线 —— 原版不按段落判日期，而由 Time 的每日例程按月份置存档旗标：
       if (Time.monthName === "February" && monthDay 6..14)  { V.valentines = 1; ... }
       if (Time.monthName === "October"  && monthDay >= 21)  { V.halloween  = 1; ... }
       if (Time.monthName === "December" && monthDay 18..25) { V.christmas  = 1; ... }
     每个节日都配 else if (V.<fest>) 清理分支：离开窗口就 delete 主旗标，并连带删子旗标
     （halloween_lake / halloweenWolves / halloween_kylar / halloween_robin_costume /
       valentines_eden* / christmas_gift* / christmas_kylar / christmas_whitney …）。
     ⇒ 只置 $halloween = 1 之类标志，过一天就被原版清掉；正确做法是用 Time.timeTravel 把日期
       推进到节日窗口内，让原版自己的例程置旗标并保持。这条日期通道与 A 用的是同一条。

   精度轮（三条结构性修正，均有断言覆盖；版本号仍 2.0.14，未升版）：
   ① 谓词统一：四组的 match 与状态注入原先各写一套判据（match 用宽正则 /halloween/i，
      注入用 indexOf("Christmas ") === 0），会出现「组里列出这段、点进去却没保底」的裂缝。
      现抽成 mbCEIsWraithPassage / Halloween / Valentines / Christmas 四个谓词，两处共用。
   ② 跨组抢段收窄：/halloween/i 命中「Gwylan Talk Clothes Halloween」（格威兰换装线，
      归 gwylan_garden 组），/christmas/i 命中「Bedroom Robin Christmas Wrap」（归 bedroom 组）。
      四组排最前会先占先得抢走它们 —— 现在按段名前缀显式排除，原组不再掉段。
   ③ 时间通道按窗口判，不再按同月比较：原守卫只比 curM === targetM && curD >= targetD，
      导致「3 月点圣诞」「11 月点万圣节」这类跨月场合无脑回拨，而「10 月 25 日点万圣节」
      （窗口 21~31，本就在窗口内）又被推去 28 日。现改为 window(dayFrom..dayTo) 判定：
      已在窗口内 → 完全不动；不在窗口内 → 推到窗口内的代表日（跨月即回拨到同年窗口，
      这是作弊器的功能本意，note 里已写明）。 */

/* ============ 四组段落谓词（match 与状态注入共用同一判据） ============ */
/* 象牙怨灵：只有「Wraith 前缀 / Ivory Wraith / Nightmare Wraith」三类原版段落；
   刻意不匹配 WraithsReflection 等第三方 mod 段（同前缀会混入非本体剧情）。 */
function mbCEIsWraithPassage(n) {
	if (n === "Wraith Test Start") { return true; }
	if (/^Wraith( |$)/.test(n)) { return true; }
	if (n.indexOf("Ivory Wraith") === 0) { return true; }
	if (n.indexOf("Nightmare Wraith") === 0) { return true; }
	return false;
}
/* 万圣节：含 halloween 的段落，但排除格威兰换装线（gwylan_garden 组的地盘）。 */
function mbCEIsHalloweenPassage(n) {
	if (!/halloween/i.test(n)) { return false; }
	if (n.indexOf("Gwylan Talk") === 0) { return false; }
	return true;
}
/* 情人节：原版该族段落一律带 Valentines 字样（实测 116 段）。 */
function mbCEIsValentinesPassage(n) { return /valentines/i.test(n); }
/* 圣诞：含 christmas 的段落，但排除「别人的地盘」——Bedroom Robin Christmas Wrap（bedroom 组）
   与 Gwylan Talk Clothes Christmas（gwylan_garden 组）。
   注意不能只收「Christmas 」前缀：38 段里 Eden Christmas Meal/Kylar Christmas/Forest Christmas Robin/
   Orphanage Christmas 等都以角色名为前缀（实测清单，见 %TEMP%\mce_fest_christmas.txt）。 */
function mbCEIsChristmasPassage(n) {
	if (!/christmas/i.test(n)) { return false; }
	if (n.indexOf("Bedroom ") === 0) { return false; }
	if (n.indexOf("Gwylan Talk") === 0) { return false; }
	return true;
}

/* 取段落正文（用于可玩性判定）。拿不到就返回空串 —— 空串一律当「可玩」，避免误杀。 */
function mbCEPassageText(nm) {
	try {
		var S = (typeof Story !== "undefined" && Story) ? Story : null;
		if (!S || typeof S.get !== "function") { return ""; }
		var p = S.get(nm);
		return (p && typeof p.text === "string") ? p.text : "";
	} catch (e) { return ""; }
}

/* 不可安全直达的段落判定（实测口径，%TEMP%\mce_playability.txt 对四组 127 段逐段扫描）：
   ① 段首就是 <<widget "xxx">> —— widget 定义段，play 它只会重新注册 widget，正文空白且无链接；
   ② 段首第一个控制宏是 <<if $molestationstart / $struggle_start / $fightstart / $sexstart …>>
      —— 整段被「战斗/遭遇中继状态」包住，硬跳进去条件为假、正文空白、链接全灭。
   不能只看「段落里出现过 $molestationstart」：Wolf Halloween 7 / Avery Valentines End 的首宏
   分别是 $phase / <<avery_injury_check>>，属正常入口，一刀切会误杀（实测已逐段枚举）。
   判定：顺序扫 <<...>> 宏；链接类 / else / endif / switch 出现即说明正文已开始 → 可玩；
   第一个 if 之前只允许不产正文的设置类宏（set / run / pass / npc / person / effects …）。 */
function mbCEIsUnplayableEntry(nm, text) {
	var t = String(text || "");
	if (!t) { return false; }
	if (/^<<widget/.test(t.trim())) { return true; }
	var SETUP = /^(set|run|unset|pass|passage|npc|person|gettarget|wearprop|effects|endevent|encounter|caption|parse|seenpassage|strip|wash|upperstrip|underupper|handholdingvirginitywarning|generatewraith|rainwraith|endcombat|clearwraith|control)$/;
	var BODYSTART = /^(link|linkappend|linkprepend|linkreplacer|linkreplace|else|elseif|endif|switch|case|break|default|for|while|print)$/;
	var re = /<<([a-zA-Z_]+)\s?([^>]*)>>/g;
	var m;
	while ((m = re.exec(t)) !== null) {
		var macro = String(m[1] || "").toLowerCase();
		var body = String(m[2] || "");
		if (BODYSTART.test(macro)) { return false; }
		if (macro === "if") {
			if (/\$(molestationstart|struggle_start|fightstart|sexstart)\b/.test(body)) { return true; }
			return false;
		}
		if (!SETUP.test(macro)) { return false; } /* 未知/产出型宏 → 正文已开始，按可玩处理 */
	}
	return false;
}

/* 四组用 unshift 插到 PLACE_GROUPS 最前：listPlaceGroups 靠 seen 先占先得，
   「Lake Halloween Party」同时匹配 lake 组的 "Lake " 前缀 —— 排后会被 lake 组吃掉主场景，
   UI 就会报「未匹配到主场景段落」（renderPlacesDirect 的兜底文案）。 */
(function () {
	var groups = [
		{ id: "wraith", name: "象牙怨灵 · Ivory Wraith", match: mbCEIsWraithPassage, exclude: mbCEIsUnplayableEntry, main: "Wraith Test Start",
		  note: "象牙怨灵 68 段（血月猎杀 / 项链 Schism / 附身 / 梦魇四套状态机）。主场景沿用原版自带的召唤入口（$passageData 测试直跳表的「Summon the Wraith」载入段，自设 home、自带 generateWraith 与退出链接）；直达前补 $wraith 八字段、月相 evening，并把日期推到当月最后一天 21:00（与主场景同口径）。其余 59 段是战斗/中继段（依赖 $molestationstart、$struggle_start 等战前状态），硬跳会崩，故只登记前缀段、详情顺正文分支走。" },
		{ id: "halloween", name: "万圣节 · Halloween", match: mbCEIsHalloweenPassage, exclude: mbCEIsUnplayableEntry, main: "Lake Halloween Party",
		  note: "万圣节 111 段（湖畔篝火派对 / 凯拉尔 / 惠特尼 / 伊甸 / 罗宾服装）。主场景是湖畔派对（段落自带 outside/location，只依赖 $phase 与 $cool）；直达前 $phase 补 0（湖岸篝火档，湖畔默认 1 会落到草丛分支）、$cool 补 240（原版 gte 240 是「欢呼」最高档，0 会读到「没人理你」），日期推进到 10 月 28 日让原版置 V.halloween。格威兰换装线（Gwylan Talk Clothes Halloween）留在原 gwylan_garden 组。" },
		{ id: "valentines", name: "情人节 · Valentines", match: mbCEIsValentinesPassage, exclude: mbCEIsUnplayableEntry, main: "Avery Valentines",
		  note: "情人节 116 段（艾弗里晚宴 / Alex / 伊甸 / Robin / Whitney / Kylar 送礼 / 格威兰）。主场景是艾弗里情人节晚宴；直达前推进到 2 月 10 日（原版窗口 6~14），并补 $avery_valentines 十七字段与 $foodstuff.valentines_chocolate（该段直接读 .amount，缺对象会 TypeError）。" },
		{ id: "christmas", name: "圣诞节 · Christmas", match: mbCEIsChristmasPassage, exclude: mbCEIsUnplayableEntry, main: "Christmas Mirror",
		  note: "圣诞 38 段（镜中人 12 段 / 孤儿院 / 伊甸晚餐 / Kylar / 罗宾礼物）。主场景是圣诞夜的「镜中人」（段落自带 outside/location，守卫 $wraith.seen gte 3 或 $wraithPrison）；直达前推进到 12 月 22 日（原版窗口 18~25）并把 $wraith.seen 抬到 3、$wraithPrison 补 false。Bedroom Robin Christmas Wrap 留在原 bedroom 组。" }
	];
	for (var i = groups.length - 1; i >= 0; i--) { PLACE_GROUPS.unshift(groups[i]); }
})();

/* 把存档日期推到节日窗口内（B 方案的时间通道）。
   为什么不直接置 $halloween = 1：原版每日例程是
     if (October && monthDay >= 21) { V.halloween = 1 } else if (V.halloween) { delete V.halloween; delete 一串子旗标 }
   —— 手动置的标志会在下一次跨日被 else 分支连子旗标一起删掉；推进日期则让原版自己置旗标，状态自洽。

   参数：month（1-12 或 "last"）、dayFrom/dayTo（该节日窗口的日号闭区间）、day（窗口内的代表日）、hour/minute。
   判据：当前已在窗口内（curM === month && dayFrom <= curD <= dayTo）→ 返回 false，完全不碰日期；
        否则 timeTravel 到 (Time.year, month, day, hour, minute)。跨月即回拨到同年窗口，是功能本意。
   "last" = 当月最后一天（原版 Summon the Wraith 的血月口径），此时窗口退化为单日。 */
function mbCETimeTravelTo(month, dayFrom, dayTo, day, hour, minute) {
	try {
		var T = (typeof Time !== "undefined" && Time) ? Time : ((typeof window !== "undefined" && window) ? window.Time : null);
		if (!T || typeof T.timeTravel !== "function") { return false; }
		var Ctor = (typeof DateTime !== "undefined" && DateTime) ? DateTime
			: ((typeof window !== "undefined" && window && window.DateTime) ? window.DateTime : null);
		if (!Ctor) { return false; }
		var y = Number(T.year);
		if (!isFinite(y)) { return false; }
		var isLast = (month === "last");
		var targetM = isLast ? Number(T.month) : Number(month);
		var targetD = isLast ? Number(T.lastDayOfMonth) : Number(day);
		var from = isLast ? targetD : Number(dayFrom);
		var to = isLast ? targetD : Number(dayTo);
		if (!isFinite(targetM) || targetM < 1 || targetM > 12) { return false; }
		if (!isFinite(targetD) || targetD < 1 || targetD > 31) { return false; }
		var curM = Number(T.month), curD = Number(T.monthDay);
		/* 已在窗口内：不动（不做「同月但日号更小就推」的无谓位移） */
		if (isFinite(curM) && isFinite(curD) && curM === targetM && curD >= from && curD <= to) { return false; }
		T.timeTravel(new Ctor(y, targetM, targetD, Number(hour) || 0, Number(minute) || 0));
		return true;
	} catch (e) { return false; } /* 存档结构异常 / 非游戏页面：不阻断直达 */
}

/* 象牙怨灵状态壳：字段对齐原版 checkWraith 的补全集（init/seen/days/defeated/evaded/nightmare/timer/hunt）。
   只补缺失、不覆盖已有进度；bumpSeen=true 时把 seen 抬到 3（Christmas Mirror 的守卫是 $wraith.seen gte 3）。 */
function mbCEWraithShell(V, bumpSeen) {
	if (!V) { return; }
	if (typeof V.wraith !== "object" || V.wraith === null) {
		V.wraith = { init: 1, seen: 0, days: 0, defeated: 0, evaded: 0, nightmare: 0, timer: 0, hunt: 0 };
	} else {
		var w = V.wraith;
		var WDEF = { init: 1, seen: 0, days: 0, defeated: 0, evaded: 0, nightmare: 0, timer: 0, hunt: 0 };
		Object.keys(WDEF).forEach(function (k) { if (w[k] === undefined) { w[k] = WDEF[k]; } });
	}
	if (typeof V.moonstate !== "string" || !V.moonstate) { V.moonstate = "evening"; }
	if (bumpSeen && !(Number(V.wraith.seen) >= 3)) { V.wraith.seen = 3; }
}

/* 四组的直达前状态保底。返回 true = 已接管该段落，ensureSceneStateFor 直接 return。
   ⚠ 调用点必须排在 07d-places.js 里「Lake 」前缀分支之前：「Lake Halloween Party」以 "Lake " 开头，
   会被湖畔分支截获并把 $phase 强制写成 1（草丛档），而派对主体是 $phase is 0 的湖岸篝火档。
   ⚠ 判据与上面四组的 match 逐字共用同一谓词 —— 否则会出现「组里列着这段、点进去没保底」。 */
function mbCEFestivalEntryState(nm, V) {
	if (!V) { return false; }
	var name = String(nm || "");
	if (mbCEIsWraithPassage(name)) {
		mbCEWraithShell(V, false);
		mbCETimeTravelTo("last", 0, 0, 0, 21, 0); /* 当月最后一天 21:00 —— 原版 Summon the Wraith 三件套口径 */
		return true;
	}
	if (mbCEIsHalloweenPassage(name)) {
		if (name === "Lake Halloween Party") {
			if (!isFinite(Number(V.phase))) { V.phase = 0; } /* 篝火档；湖畔默认的 1 会落到草丛分支 */
			if (!isFinite(Number(V.cool))) { V.cool = 240; } /* 原版 gte 240 = 欢呼（最高档）；0 会读到「没人理你」 */
		}
		mbCETimeTravelTo(10, 21, 31, 28, 20, 0); /* 落进 October && monthDay >= 21 → 原版置 V.halloween */
		return true;
	}
	if (mbCEIsValentinesPassage(name)) {
		if (typeof V.avery_valentines !== "object" || V.avery_valentines === null) {
			/* 逐字对齐原版每日例程的建壳（17 字段）。原版只在 V.avery_mansion 为真时建对象，
			   没买庄园的档这里是空的，而段落直接读 $avery_valentines.done / .invite → TypeError。 */
			V.avery_valentines = {
				intro: false, invite: false, ready: false, done: false, reservation: false,
				chocolate: false, chocolate_asked: false, opinion: "none", confess: false, food: "none",
				soften: false, talk: false, talk_count: 0, sex: "none", end: "none", end_talk: false,
				missed_approach: false
			};
		}
		if (typeof V.foodstuff !== "object" || V.foodstuff === null) { V.foodstuff = {}; }
		if (typeof V.foodstuff.valentines_chocolate !== "object" || V.foodstuff.valentines_chocolate === null) {
			V.foodstuff.valentines_chocolate = { amount: 0 }; /* 段落读 .amount gte 1；缺对象即 TypeError，0 = 没这盒 */
		}
		if (typeof V.foodstuff.valentines_chocolate.amount !== "number") { V.foodstuff.valentines_chocolate.amount = 0; }
		mbCETimeTravelTo(2, 6, 14, 10, 18, 0); /* 落进 February && monthDay 6~14 → 原版置 V.valentines */
		return true;
	}
	if (mbCEIsChristmasPassage(name)) {
		mbCEWraithShell(V, true); /* Christmas Mirror 守卫：$wraith.seen gte 3 或 $wraithPrison */
		if (V.wraithPrison === undefined) { V.wraithPrison = false; }
		mbCETimeTravelTo(12, 18, 25, 22, 20, 0); /* 落进 December && monthDay 18~25 → 原版置 V.christmas */
		return true;
	}
	return false;
}
