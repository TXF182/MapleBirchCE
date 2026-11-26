	/* 职责：言灵页（07i）区块渲染 —— 一个区块一个函数（①~⑭ + 页尾说明），由 07i-yanling-page-groups.js 的组调度按原顺序调用。
	   拆分原因：renderYanling 单函数 365 行 / 圈复杂度 132（Archify COMP-fa47d1743fa9，2026-11-25 代码体检）；
	   先按 A~E 组拆仍留下 4 个 >10 的组函数，触发复杂度棘轮（>10 函数数 158→161），故细到区块粒度。
	   行为契约：smoke_dom.js「言灵页结构指纹」三断言（分组标题+副标 / 区块编号+标题 / 按钮数+文案哈希），拆分前后必须一字不差。 */

	/* ① 核心：无性别着装 */
	function mbCEYanlingSecCrossdress(g, ctx) {
		var st = ctx.st, V = ctx.V, hooked = ctx.hooked;
		var s1 = mceNewSec(g, 1, "无视着装性别", "开启后 NPC 不再按服装标注性别判定异装：穿异性服装不触发异装判定、不涨异装癖、不产生学校异装名声，换衣间也不再出现「naughty」类文案。判定在 JS 层覆盖 isCrossdressing()，$crossdressing 恒为 0，版本升级不会像文本替换那样静默失效。");
		mbCEYanlingRenderStatus(s1, st && st.noCross, "已开启", "未开启");
		var row1 = el("div", MCE_CLS.row);
		var b1 = el("button", "mce-btn " + (st && st.noCross ? "mce-red" : MCE_CLS.gold), st && st.noCross ? "关闭（恢复原版判定）" : "开启");
		b1.type = "button";
		b1.addEventListener("click", function () {
			var r = mbCEYanlingToggle("noCross");
			setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
			mbCEFlashRow(b1);
			renderYanling();
		});
		row1.appendChild(b1);
		s1.appendChild(row1);
		mbCEYanlingCrossdressDiag(s1, st, V, hooked);
	}

	/* ② 异装癖（crossdresser 特质） */
	function mbCEYanlingSecTrait(g, ctx) {
		var st = ctx.st, V = ctx.V;
		var s2 = mceNewSec(g, 2, "异装癖压制", "异装癖累积点在异装分支内（243201-243208：$crossdressingTrait 满 100 → 背景特质 crossdresser）。开启「无视着装性别」后不再累积；本组额外把存量进度与已获得的特质清掉，并可按秒压制（读档后同样生效）。");
		var hasTrait = mbCEYanlingHasCrossTrait(V);
		var tRow = el("div", MCE_CLS.row);
		tRow.appendChild(el("span", MCE_CLS.rowLbl, "当前：进度 " + (V && typeof V.crossdressingTrait === "number" ? String(V.crossdressingTrait) : "0") + "/100，特质 "));
		tRow.appendChild(el("span", "mce-value", hasTrait ? "已获得（可按下方按钮移除）" : "未获得"));
		s2.appendChild(tRow);
		mbCEYanlingRenderStatus(s2, st && st.noTrait, "压制中（每秒压回 0）", "未压制");
		mbCEYanlingRenderBtn(s2, "立即清空进度 + 移除特质", MCE_CLS.gold, mbCEYanlingPurgeTrait, "清空 $crossdressingTrait 并从 $backgroundTraits 移除 crossdresser");
		var rowT = el("div", MCE_CLS.row);
		var bT = el("button", "mce-btn " + (st && st.noTrait ? "mce-red" : ""), st && st.noTrait ? "停止压制" : "开启持续压制");
		bT.type = "button";
		bT.addEventListener("click", function () {
			var r = mbCEYanlingToggle("noTrait");
			setStatus(r.msg, r.ok ? MCE_CLS.ok : MCE_CLS.err);
			mbCEFlashRow(bT);
			renderYanling();
		});
		rowT.appendChild(bT);
		s2.appendChild(rowT);
	}

	/* ③ 负面名声清零 */
	function mbCEYanlingSecFame(g, ctx) {
		var V = ctx.V;
		var s3 = mceNewSec(g, 3, "负面名声清零", "学校名声仅 crossdress / herm 两键（schoolrep 346656-346682）；城镇名声取 V.fame 负面 8 项（sex / prostitution / rape / bestiality / pregnancy / impreg / exhibitionism / pimp），并同步删除 V.fameDecay / V.fameDecayTimer 的衰减队列项，避免清零后又被队列改回。正面项（scrap / good / business / social / model）由「一键拉满：正面名声」按钮单独拉满到 2000（290894-290895 clamp 与 306924-306928 numberStepper max 双实证）；怀孕名声另有独立按钮，因为它的上限不是 2000，而是 clamp(总生育,1,8)*250 —— 只写名声会被 famepregnancy / fameclamp 当场压回，必须先抬 sexStats.vagina.pregnancy.totalBirthEvents。");
		var schTxt = "—";
		try {
			if (V && V.schoolrep && typeof V.schoolrep === "object") {
				schTxt = "crossdress=" + String(V.schoolrep.crossdress === undefined ? 0 : V.schoolrep.crossdress) + "，herm=" + String(V.schoolrep.herm === undefined ? 0 : V.schoolrep.herm);
			}
		} catch (e1) {}
		var fRow = el("div", MCE_CLS.row);
		fRow.appendChild(el("span", MCE_CLS.rowLbl, "学校名声：" + schTxt + " ｜ 城镇负面合计 " + (function () {
			try {
				var tot = 0, V1 = getV();
				for (var j = 0; j < mbCEYanlingFameNeg.length; j++) {
					var kk = mbCEYanlingFameNeg[j];
					if (V1 && V1.fame && typeof V1.fame[kk] === "number") { tot += V1.fame[kk]; }
				}
				return String(tot);
			} catch (e2) { return "—"; }
		})() + " 点"));
		s3.appendChild(fRow);
		var s3g = mceBtnGrid(s3);
		mbCEYanlingRenderBtn(s3g, "一键清零：学校异装名声", MCE_CLS.gold, mbCEYanlingPurgeCross, "清 $schoolrep.crossdress 并删 $school_crossdress_message");
		mbCEYanlingRenderBtn(s3g, "一键清零：全部负面名声", MCE_CLS.gold, mbCEYanlingPurgeFame, "学校 crossdress/herm + 城镇 fame 负面 8 项 + 衰减队列");
		mbCEYanlingRenderBtn(s3g, "一键拉满：怀孕名声（先抬上限）", MCE_CLS.gold, mbCEYanlingUncapPregnancyFame, "名声上限 = clamp(总生育,1,8)*250，只写名声会被 famepregnancy/fameclamp 当场压回；本按钮把 sexStats.vagina.pregnancy.totalBirthEvents 抬到 8（上限 2000）再写 fame.pregnancy=2000。副作用：生育次数显示 8、特质跳 Broodmother(8–19)、处女膜判定转 false、公开名声任务目标升到 2000；schism/scarlet 处女膜恢复会把计数清零，上限随之塌回 250。后庭计数不动（避免顺带解锁肛孕判定）。");
		mbCEYanlingRenderBtn(s3g, "撤销：怀孕名声上限", MCE_CLS.gold, mbCEYanlingRestorePregnancyFame, "按留痕 yanling:uncap_pregnancy_fame 的 before 还原 sexStats.vagina.pregnancy.totalBirthEvents 与 fame.pregnancy；原态是「键不存在」时走 delete（避免写 undefined 被 clamp 成 NaN）。留痕只记首次点击前，重复拉满不会覆盖最初原值，所以撤销总能回到「改之前」。全局撤销中心不解言灵类（08c-undo-center.js:30），回退入口只有这里。");
		mbCEYanlingRenderBtn(s3g, "一键拉满：正面名声", MCE_CLS.gold, mbCEYanlingMaxFame, "fame.good / business / scrap / social / model 各写 2000（实证 clamp 上限 2000；pregnancy 上限动态不写）");
	}

	/* ⑩ 枝叶变装（v2.1.8 玩家实测诉求：衣柜没有枝叶上衣和裙子、没得卖、「枝叶衣服没法进柜子」） */
	function mbCEYanlingSecLeaf(g, ctx) {
		void ctx;
		var s10 = mceNewSec(g, 10, "枝叶变装", "把当前上/下装换成原版 leaf shirt + leaf skirt（植物人 NPC 的枝叶上衣 / 枝叶裙，玩家侧无任何售卖渠道，所以衣柜与商店里永远刷不出来 —— 这是「衣柜又没有枝叶上衣和裙子」「没有卖的」「枝叶衣服没法进柜子」三句抱怨的共同成因）。被替换下来的原衣会逐件复制进衣柜，之后点「还原」把原衣换回身上并从衣柜回收那份副本。外套层（over_upper / over_lower）会一起收进衣柜：只换上/下装时外套会把枝叶完全遮住，看起来就像没生效。枝叶本体同时放一份进衣柜，以后不点本按钮也能直接从衣柜面板再穿。穿诅咒衣物时拒绝变装（原版禁止脱下）。");
		var leafTxt = mbCEYanlingLeafStatusText();
		s10.appendChild(el("div", MCE_CLS.hint, "当前躯干槽：" + leafTxt[0]));
		s10.appendChild(el("div", MCE_CLS.hint, "变装状态：" + leafTxt[1]));
		var s10g = mceBtnGrid(s10);
		mbCEYanlingRenderBtn(s10g, "变身：枝叶上衣 + 枝叶下衣", MCE_CLS.gold, mbCEYanlingLeafSuit, "4 躯干槽原衣进衣柜（带 mbCE_leafStored 标记）→ 上装写 leaf shirt、下装写 leaf skirt、外套层置裸；枝叶本体同时入柜（mbCE_leafCopy，按 name 防重复）");
		mbCEYanlingRenderBtn(s10g, "还原：换回原服装", "mce-red", mbCEYanlingLeafRevert, "按 $mbCE_yanling.leaf 记录还原 4 槽，并从衣柜回收带标记的原衣；枝叶副本保留可继续穿");
	}

	/* ④ 身体与衣物（对照 CheatExtend 1.1.3「快捷言灵」补入；v2.0.2 拆出 ⑤ 精神与体液） */
	function mbCEYanlingSecCloth(g, ctx) {
		void ctx;
		var s4 = mceNewSec(g, 4, "身体与衣物", "一键烘干：$upperwet / $lowerwet / $underupperwet / $underlowerwet（原版初始化 182261-182267，debug 直写 60670-60682）。衣物加固：$worn.{upper,lower,under_upper,under_lower}.integrity 按该件 integrity_max 写满（上限取自 clothingData(slot,item,\"integrity_max\")，163772；不照抄 CE 的 +1000，避免超上限导致耐久显示破表）。");
		var wetTxt = "—", durTxt = "—";
		try {
			var Vw = getV();
			if (Vw) {
				wetTxt = ["upperwet", "lowerwet", "underupperwet", "underlowerwet"].map(function (k) { return (typeof Vw[k] === "number") ? String(Vw[k]) : "—"; }).join(" / ");
				durTxt = ["upper", "lower", "under_upper", "under_lower"].map(function (sl) {
					var w = Vw.worn ? Vw.worn[sl] : null;
					if (!w || !w.name || w.name === "naked") { return sl + "：空"; }
					return sl + "：" + String(w.integrity);
				}).join(" ｜ ");
			}
		} catch (eW) {}
		var wRow = el("div", MCE_CLS.row);
		wRow.appendChild(el("span", MCE_CLS.rowLbl, "湿度（上 / 下 / 内上 / 内下）："));
		wRow.appendChild(el("span", "mce-value", wetTxt));
		s4.appendChild(wRow);
		s4.appendChild(el("div", MCE_CLS.hint, "耐久 " + durTxt));
		var s4g = mceBtnGrid(s4);
		mbCEYanlingRenderBtn(s4g, "一键烘干衣服", MCE_CLS.gold, mbCEYanlingDryClothes, "4 项衣物湿度归零");
		mbCEYanlingRenderBtn(s4g, "衣物加固（耐久回满）", MCE_CLS.gold, mbCEYanlingRepairClothes, "4 主槽按各自 integrity_max 写满；穿着的 naked 槽自动跳过");
	}

	/* ⑤ 精神与体液（v2.0.2 从「身体与衣物」拆出：这两项不碰衣物，混在一起让玩家以为都是衣服相关） */
	function mbCEYanlingSecMind(g, ctx) {
		void ctx;
		var s5 = mceNewSec(g, 5, "精神与体液", "精液补满：$semen_volume 是容量、$semen_amount 是当前量（183097-183101 默认 90），写入时容量抬到 $semen_max、当前量同步写满（原版满判据 amount >= volume，104935）。精神恢复：$control 拉满 1000（59989 的原版初值 0，不是上限）、$hallucinogen 归零（182681）。");
		var s5g = mceBtnGrid(s5);
		mbCEYanlingRenderBtn(s5g, "精液补满", MCE_CLS.gold, mbCEYanlingSemen, "容量（$semen_volume）抬到 $semen_max、当前量（$semen_amount）同步写满——原版满判据是 amount >= volume（L104935），旧写法只到「半满」");
		mbCEYanlingRenderBtn(s5g, "精神恢复（控制拉满 + 幻觉清零）", MCE_CLS.gold, mbCEYanlingMind, "$control=1000、$hallucinogen=0");
	}

	/* ⑥ 数值快补 */
	function mbCEYanlingSecStats(g, ctx) {
		void ctx;
		var s6 = mceNewSec(g, 6, "数值快补", "补 CE 快速面板没有入口的原版数值：施虐 / 受虐（$sadism / $masochism，钳制 0-1000，290866）、奶量（$milk_volume / $milk_max，每日钳到 [24, milk_max]，290800）、成就限制（$feats.locked 原版是布尔 true=锁定）、罗宾存款（$robinmoney）、艾弗里约会（$averydate is 1 且 21 点前，308105）、校长办公室密码（$headpasswordknown）、种子（window.unlockAllSeeds，76431）、农田（$farm.clearing=0 见 305874 / $fertiliser.current ++ 见 105354）。");
		var s6g = mceBtnGrid(s6);
		mbCEYanlingRenderBtn(s6g, "施虐 / 受虐拉满（1000）", MCE_CLS.gold, mbCEYanlingSadism, "$sadism / $masochism = 1000");
		mbCEYanlingRenderBtn(s6g, "奶量补满（上限 6000）", MCE_CLS.gold, mbCEYanlingMilk, "milk_max 归一到原版合法档 6000（3000/6000 两档），milk_volume 与 milk_amount 一起写满，避开每日 clamp 与「不满」假象");
		mbCEYanlingRenderBtn(s6g, "解除成就限制", MCE_CLS.gold, mbCEYanlingFeats, "$feats.locked = false（原版以 isnot true 判已解锁）");
		mbCEYanlingRenderBtn(s6g, "罗宾存款清零", MCE_CLS.gold, mbCEYanlingRobinMoney, "$robinmoney = 0");
		mbCEYanlingRenderBtn(s6g, "今晚艾弗里来约", MCE_CLS.gold, mbCEYanlingAveryDate, "$averydate = 1（21 点前到宅邸触发）");
		mbCEYanlingRenderBtn(s6g, "获知校长办公室密码", MCE_CLS.gold, mbCEYanlingHeadPassword, "$headpasswordknown = 1");
		mbCEYanlingRenderBtn(s6g, "集齐所有种子", MCE_CLS.gold, mbCEYanlingSeeds, "调原版 window.unlockAllSeeds()，不自造种子表");
		mbCEYanlingRenderBtn(s6g, "清理农田 + 补 5 袋堆肥", MCE_CLS.gold, mbCEYanlingFarm, "$farm.clearing = 0、$fertiliser.current += 5");
	}

	/* ⑦ 天气 */
	function mbCEYanlingSecWeather(g, ctx) {
		void ctx;
		var s7 = mceNewSec(g, 7, "天气", "0.5 起天气迁到 $weatherObj，旧 $weather 只在旧档迁移分支读一次随即 unset（190009-190032）——老式写 $weather=\"rain\" 在本版完全无效（CE 的「祈雨术」即此条）。本页直调原版 window.setWeather(type, true)（定义 87136-87167），合法类型表 85185-85407 共 7 档，此处给常用 4 档（雨 / 雪由气温决定，不单列）。");
		var s7g = mceBtnGrid(s7);
		["clear", "heavyClouds", "heavyPrecipitation", "thunderstorm"].forEach(function (wt) {
			mbCEYanlingRenderBtn(s7g, "切到「" + mbCEYanlingWeatherMap[wt] + "」", "", function () { return mbCEYanlingWeather(wt); }, "setWeather(\"" + wt + "\", true)");
		});
	}

	/* ⑧ 角色放逐 */
	function mbCEYanlingSecBanish(g, ctx) {
		void ctx;
		var s8 = mceNewSec(g, 8, "角色放逐", "原版「放逐」不是通用机制：跨角色只有格威岚走 scorned 线（Gwylan Ritual Sex Scorned 402967-402970 = state=scorned + 当日进度锁 + 9 天倒计时；到期由 78390-78393 自动 delete timer 恢复），凯拉尔 / 惠特尼 的「离场」在原版是 state 切换（prison / dungeon）。顺手核实：CheatExtend 1.1.3 全目录 grep「放逐 / banish / exile / 驱逐」零命中——本组口径来自原版，不是照抄 CE。");
		var npcTxt = "—";
		try {
			var statList = [];
			["Gwylan", "Kylar", "Whitney"].forEach(function (nm) {
				var p = mbCEYanlingNpc(nm);
				statList.push(nm + "=" + (p ? String(p.state) : "无槽位"));
			});
			npcTxt = statList.join(" ｜ ");
		} catch (eN) {}
		s8.appendChild(el("div", MCE_CLS.hint, "当前 NPC 状态：" + npcTxt));
		var s8g = mceBtnGrid(s8);
		mbCEYanlingRenderBtn(s8g, "格威岚 · 放逐 9 天", "mce-red", mbCEYanlingGwylanBanish, "state=scorned + $daily.gwylan.preventProgress=true + $gwylan.timer.scorned=+9 天");
		mbCEYanlingRenderBtn(s8g, "格威岚 · 立即召回", MCE_CLS.gold, mbCEYanlingGwylanRecall, "state=active + 清 timer.scorned / timer.nobody（等价于道歉线 addDays(-3) 提前解禁）");
		mbCEYanlingRenderBtn(s8g, "凯拉尔 · 送进监狱", "mce-red", function () { return mbCEYanlingKylar(true); }, "state=prison（原版监狱专属线按此值触发）");
		mbCEYanlingRenderBtn(s8g, "凯拉尔 · 捞回", MCE_CLS.gold, function () { return mbCEYanlingKylar(false); }, "state=active");
		mbCEYanlingRenderBtn(s8g, "惠特尼 · 关进地牢", "mce-red", function () { return mbCEYanlingWhitney(true); }, "state=dungeon（188677 四处地牢事件按此值触发）");
		mbCEYanlingRenderBtn(s8g, "惠特尼 · 放回", MCE_CLS.gold, function () { return mbCEYanlingWhitney(false); }, "state=active");
		s8.appendChild(mceFoldHint("惠特尼不提供「枷锁示众」：pillory 由原版承租人状态联动（188675 按承租人姓名判定），只写 state 会出现「人不在枷锁却显示示众」的错位。凯拉尔亦同：其监狱线除 state 还要配套键，本组只做 state 层（与原版 npcset 等价），不伪造监狱进度。"));
	}

	/* ⑨ 监狱庇护（v2.0.3 新增：原 $prison.protection 是枚举字符串，数字档位在半失效，见上方 mbCEYanlingPrisonProtect 注释） */
	function mbCEYanlingSecPrison(g, ctx) {
		var V = ctx.V;
		var s9 = mceNewSec(g, 9, "监狱庇护", "原版 $prison.protection **不是数字**：657114 等 14 处 `set to \"scarred\"`，650845 / 651145 / 658072 用 `is \"scarred\"` / `is \"tattooed\"` 判定（is 等价 ===），654586 用 `!$prison.protection` 判空。所以只有「有某种庇护 / 无庇护」两态——写 scarred 或 tattooed 都等价屏蔽狱中 attention 事件，只是走不同狱友的早餐 / 午餐分支。");
		var protTxt = "—";
		try {
			var pv = (V && V.prison) ? V.prison.protection : undefined;
			protTxt = (V && V.prison) ? (pv === "" ? "无庇护（空串）" : (pv === undefined ? "未设置（字段缺省，等价无庇护）" : JSON.stringify(pv))) : "本存档无监狱对象（尚未进过监狱）";
		} catch (eP) { /* 读数失败（存档冻结/结构异常）→ 面板展示降级为占位符，不影响按钮写入 */ }
		s9.appendChild(el("div", MCE_CLS.hint, "当前庇护 = " + protTxt));
		var s9g = mceBtnGrid(s9);
		mbCEYanlingRenderBtn(s9g, "疤痕狱友庇护", MCE_CLS.gold, function () { return mbCEYanlingPrisonProtect("scarred"); }, "prison.protection = \"scarred\"（原版 14 处同值；早餐 / 午餐走 scarred 狱友分支）");
		mbCEYanlingRenderBtn(s9g, "纹身狱友庇护", MCE_CLS.gold, function () { return mbCEYanlingPrisonProtect("tattooed"); }, "prison.protection = \"tattooed\"（651145 / 658072 有对应判定分支）");
		mbCEYanlingRenderBtn(s9g, "清除庇护", "", function () { return mbCEYanlingPrisonProtect(""); }, "prison.protection = \"\"（空串为假值，恢复 attention 事件的随机遭遇）");
		s9.appendChild(el("div", MCE_CLS.hint, "注意：狱友声望档位（0-5）与纹身程度（0-100）是另外两个**数字**档位（狱友线声望），在「场景 → 地点」页的监狱组里调，与本组不是同一个变量。"));
	}

	/* ⑬ 格威岚 · 森林商店（合并原 ⑬ / ⑭ 项圈 / ⑮ 三块：按主题收拢，按钮顺序 = 今日对话 → 仪式与委托 → 计数与渴望 → 催眠 → 项圈）
	   逐条对应 dol吧「言灵分享：森林商店相关」帖：4L 讲故事 / 6L 街机 / 7L 仪式 / 8L 渴望 / 11L 委托 / 12L 催眠 / 15L 计数 / 17L 宠物床 / 16-17L 项圈。
	   原版取证行号：414843-414859 / 141655 / 532472 / 414891 / 405614 / 392995-393061 / 345281-345282 / 78554 / 169336 / 384348 / 414728 / 405620 / 392612 / 415091 / 169245 / 169373 / 198062-198065 / 198496。 */
	function mbCEYanlingSecGwylan(g, ctx) {
		void ctx;
		var s13 = mceNewSec(g, 13, "格威岚 · 森林商店", "按主题收拢的格威岚全功能组：今日对话 / 仪式与委托 / 计数与渴望 / 催眠 / 项圈。每按钮 hint 标原版行号；只在原版键已存在的档上写，未开线明确拒绝。");
		var gTxt = "读取失败";
		try {
			var Vs = getV();
			gTxt = "故事 " + mbCEYanlingGwTalkText(Vs) + " ｜ " + mbCEYanlingGwRitualText(Vs) + " ｜ 委托：" + mbCEYanlingGwRequestText(Vs) + " ｜ " + mbCEYanlingGwPetBedText(Vs) + " ｜ 看海 " + mbCEYanlingGwSeaText(Vs) + " / 亲密 " + mbCEYanlingGwSexText(Vs) + " ｜ 街机 " + mbCEYanlingGwArcText(Vs) + " ｜ 催眠cd " + mbCEYanlingGwCdText(Vs) + " ｜ 项圈：" + mbCEYanlingGwCollarText(Vs);
		} catch (eS) { void eS; }
		s13.appendChild(el("div", MCE_CLS.hint, "当前：" + gTxt));

		s13.appendChild(el("div", MCE_CLS.hint, "▸ 今日对话"));
		var s13g = mceBtnGrid(s13);
		mbCEYanlingRenderBtn(s13g, "解除今日讲故事限制", MCE_CLS.gold, mbCEYanlingGwylanTalk, "clothesTalk=-1000、enoughTalk=false（414843-414859；只当日有效，跨日自动恢复 3 件限制）");

		s13.appendChild(el("div", MCE_CLS.hint, "▸ 仪式与委托"));
		var s13r = mceBtnGrid(s13);
		mbCEYanlingRenderBtn(s13r, "无限仪式（冷却清零）", MCE_CLS.gold, mbCEYanlingGwylanRitualReady, "$gwylan.timer.ritual=当前时刻（414891 判据 dayDifference<=0）");
		mbCEYanlingRenderBtn(s13r, "仪式延期 7 天", "", mbCEYanlingGwylanRitualDelay, "ritual=+7 天（同原版完成一次后的冷却 405614）");
		mbCEYanlingRenderBtn(s13r, "完成当前委托", MCE_CLS.gold, mbCEYanlingGwylanRequestDone, "等价 <<gwylanRequestEnd>>（392995-393061）：requestDone + count++ + timer[event]+14 天");
		mbCEYanlingRenderBtn(s13r, "宠物床续 7 天", "", mbCEYanlingGwylanPetBed, "timer.petBed=+7 天（392612；需已解锁 partners，415091）");

		s13.appendChild(el("div", MCE_CLS.hint, "▸ 计数与渴望"));
		var s13c = mceBtnGrid(s13);
		mbCEYanlingRenderBtn(s13c, "渴望拉满（lust/dom）", MCE_CLS.gold, mbCEYanlingGwylanDesire, "lust=100 / dom=150（clamp 345281-345282；原帖 $NPCName[7].corr 在本版 0 命中）");
		mbCEYanlingRenderBtn(s13c, "看海次数 +20", "", mbCEYanlingGwylanSea, "$gwylan.sea += 20（384348 / 414728 按 >=5 判定）");
		mbCEYanlingRenderBtn(s13c, "亲密仪式 +5", "", mbCEYanlingGwylanSex, "$dateCount.GwylanSex += 5（partners 门槛 >=5，414728）");
		mbCEYanlingRenderBtn(s13c, "街机计数设为 7", "", mbCEYanlingArcadeCount, "$tenyclusPlayCount=7（future_suit 需求 141655；gte 1 and lt 7 的 Play Tenyclus 入口随之关闭）");

		s13.appendChild(el("div", MCE_CLS.hint, "▸ 催眠"));
		var s13h = mceBtnGrid(s13);
		mbCEYanlingRenderBtn(s13h, "重置催眠 cd", "", mbCEYanlingHypnoCd, "$hypnosisTimers.devotion.time → 阶段满值-10（78554 阈值 + 169336 档位表）");
		mbCEYanlingRenderBtn(s13h, "刷新当天催眠次数", "", mbCEYanlingHypnoDaily, "delete $daily.gwylan.hypnosis + $hypnosis_potency（386337 / 389060）");
		mbCEYanlingRenderBtn(s13h, "清除好奇（催眠特质）", "mce-red", mbCEYanlingClearCuriosity, "delete $hypnosis_traits.devotion / $hypnosisTimers.devotion；其它催眠键不动");

		s13.appendChild(el("div", MCE_CLS.hint, "▸ 项圈（破损不可逆）"));
		var s13k = mceBtnGrid(s13);
		mbCEYanlingRenderBtn(s13k, "戴上眷属项圈并锁死", MCE_CLS.gold, mbCEYanlingCollarLock, "$worn.neck → familiar collar + cursed=1（169245 / 169373 锁死判据）；原颈饰进衣柜");
		mbCEYanlingRenderBtn(s13k, "标记项圈破损（broken）", "mce-red", mbCEYanlingCollarBreak, "type+broken + eventskipoverrule=1（198062-198065 / 198496 空分支：不脱、只改描述）");
	}

	/* ⑭ 绝望轮回 · 结局与成就（与格威岚无关，独立成块） */
	function mbCEYanlingSecEndings(g, ctx) {
		void ctx;
		var s14 = mceNewSec(g, 14, "绝望轮回 · 结局与成就", "贴吧 90L：$hcEndings 七项 A-F/S（画廊 309419 显示 x/7）+ Trials of Faith 成就（定义 103326，授予点 621081）。成就在作弊模式下被原版 earnFeat 门控（104773），故按 CE 既有先例直写 V.feats.currentSave。只补结局与成就，不伪造轮回进度键。");
		var endTxt = "读取失败";
		try {
			var Ve = getV();
			var ed0 = "—/7";
			if (Ve && Array.isArray(Ve.hcEndings)) {
				ed0 = Ve.hcEndings.length + "/7" + ((Ve.feats && Ve.feats.currentSave && Ve.feats.currentSave["Trials of Faith"] !== undefined) ? "（成就已有）" : "");
			}
			endTxt = "结局 " + ed0;
		} catch (eE) { void eE; }
		s14.appendChild(el("div", MCE_CLS.hint, "当前：" + endTxt));
		var s14g = mceBtnGrid(s14);
		mbCEYanlingRenderBtn(s14g, "绝望轮回：补齐七结局 + 成就", MCE_CLS.gold, mbCEYanlingHopelessEndings, "$hcEndings 补 A-F/S（锁子甲需求 141965）+ V.feats.currentSave[\"Trials of Faith\"] 直写");
	}

	/* ⑪ 艾弗里办公室（补）（v2.1.16：玩家给的 SugarCube setter 片段落地为按钮 + 撤销） */
	function mbCEYanlingSecAvery(g, ctx) {
		void ctx;
		var s11 = mceNewSec(g, 11, "艾弗里办公室（补）", "等价于原版信件交付线结尾的 `<<set $averySeen.pushUnique(\"office\")>>`（791859）：补上「办公室」标记后，办公室板块（623696 / 623857）直接出现「艾弗里 · 个人助理」打工入口，Avery 排班（71279-71280）也把他算作可打工对象。仍不伪造的部分：Avery 必须已登场（71275 首行判 init）、未被驱逐、且艾弗里未受伤（$avery_injury 为真时入口不出现）。重复点击不会累积（原版是 pushUnique，不是 concat 追加）。");
		var avState = "未开通", avNpc = "无槽位";
		try {
			var Va = getV();
			avState = (Va && Array.isArray(Va.averySeen) && Va.averySeen.indexOf("office") !== -1) ? "已开通" : "未开通";
			var pa = mbCEYanlingNpc("Avery");
			if (pa) { avNpc = "已登场（" + String(pa.state) + "）" + (pa.init === 1 ? "" : "，init 未完成"); }
		} catch (eA) { void eA; }
		var aRow = el("div", MCE_CLS.row);
		aRow.appendChild(el("span", MCE_CLS.rowLbl, "当前："));
		aRow.appendChild(el("span", "mce-value", avState + " ｜ 艾弗里：" + avNpc));
		s11.appendChild(aRow);
		var s11g = mceBtnGrid(s11);
		mbCEYanlingRenderBtn(s11g, "补上「办公室」标记", MCE_CLS.gold, mbCEYanlingAveryOffice, "把 office 写进 $averySeen（去重，等同原版 pushUnique）；只补这一项，不伪造登场 / 受伤等前置");
		mbCEYanlingRenderBtn(s11g, "撤销：移除「办公室」标记", "mce-red", mbCEYanlingAveryOfficeRevert, "按 yanling:avery_office 留痕还原；改前键不存在时走 delete（不留空数组）");
	}

	/* ⑫ 作弊模式（无副作用开启） */
	function mbCEYanlingSecCheat(g, ctx) {
		void ctx;
		var s12 = mceNewSec(g, 12, "作弊模式", "原版作弊总开关：开启后选项页出现作弊面板、特殊衣物走作弊解锁分支。本页按「无副作用」开启——只写 $cheatsEnabled，不碰 $feats.locked，并给 earnFeat / earnHourlyFeats 装豁免钩子（原版这两处在 $cheatsEnabled===true 时直接 return，是成就被禁的唯一原因）；原版三处 `<<set $feats.locked to true>>`（新角色页 19883946 / 旧档迁移 19994082 / 选项页退出链 28096917）由每次换页自动复原，实机不会再出现「成就已锁」。关闭按钮按留痕还原。旧档兼容键 $cheatdisable 已被原版迁移逻辑读取即删，本页不写它。");
		var chState = "未开启", chFeats = "—";
		try {
			var Vc = getV();
			var gOn = !!(Vc && Vc.mbCE_cheatGuard === true);
			chState = mbCEYanlingCheatOnState(Vc, gOn);
			chFeats = mbCEYanlingCheatFeatState(Vc, gOn);
		} catch (eC) { void eC; }
		var cRow = el("div", MCE_CLS.row);
		cRow.appendChild(el("span", MCE_CLS.rowLbl, "当前："));
		cRow.appendChild(el("span", "mce-value", chState + " ｜ " + chFeats));
		s12.appendChild(cRow);
		var s12g = mceBtnGrid(s12);
		mbCEYanlingRenderBtn(s12g, "开启作弊（无副作用）", MCE_CLS.gold, mbCEYanlingCheatOn, "$cheatsEnabled=true，不写 $feats.locked；成就豁免钩子保证 earnFeat / earnHourlyFeats 照常结算，换页也不再回锁");
		mbCEYanlingRenderBtn(s12g, "关闭作弊模式", "mce-red", mbCEYanlingCheatOff, "按 yanling:cheat_on 留痕还原 $cheatsEnabled 与 $feats.locked，并停用成就豁免");
	}

	/* 页尾说明折叠块（v2.0.2 按键重排：说明与边界不再伪装成"第 4 个区块"，改为页尾折叠块，不占编号，默认 2 行） */
	function mbCEYanlingRenderInfo(pane, ctx) {
		void ctx;
		var sInfo = el("div", "mce-block");
		var sInfoh = el("div", "mce-sec-title");
		sInfoh.appendChild(el("span", "", "说明与边界（点开查看）"));
		sInfo.appendChild(sInfoh);
		var sInfobody = el("div", "mce-foldbox");
		sInfobody.setAttribute("data-open", "0");
		var sInfotoggle = el("div", "mce-hint mce-fold", "① 只拦「服装性别」链；② 压力循环不受影响；③ 不依赖原版文案，仅依赖 6 个变量键；④ 全部动作按 mbCE_wrote 留痕可回退；⑤ 关闭开关立即卸载钩子；⑥ 性别认知残留属正常。");
		sInfotoggle.setAttribute("data-open", "0");
		sInfotoggle.setAttribute("role", "button");
		sInfotoggle.setAttribute("tabindex", "0");
		sInfotoggle.setAttribute("aria-expanded", "false");
		sInfotoggle.title = "点击展开 / 收起完整说明";
		function ylInfoFold() {
			var now = sInfobody.getAttribute("data-open") === "0" ? "1" : "0";
			sInfobody.setAttribute("data-open", now);
			sInfotoggle.setAttribute("data-open", "0"); /* body 收起时摘要保持 2 行 */
			sInfotoggle.setAttribute("aria-expanded", now === "1" ? "true" : "false");
		}
		sInfotoggle.addEventListener("click", ylInfoFold);
		sInfotoggle.addEventListener("keydown", function (ev) {
			if (ev.key === "Enter" || ev.key === " " || ev.keyCode === 13 || ev.keyCode === 32) { ev.preventDefault(); ylInfoFold(); }
		});
		sInfobody.appendChild(sInfotoggle);
		sInfobody.appendChild(el("div", MCE_CLS.hint, "① 只拦「服装性别」链，不改玩家性别、生殖器、外观性别（isGenitalMismatch 与原版 herm 链保持原样；双生殖器仍会按原版进 herm 分支，如需一并消掉请用上面的名声清零）。"));
		sInfobody.appendChild(el("div", MCE_CLS.hint, "② 压力循环不受影响：77866-77870 用本地 const 判定（源码注释明确不复用函数），本页只覆盖函数不改语义。"));
		sInfobody.appendChild(mceFoldHint("③ 不依赖任何原版文案：老式「言灵」模组靠文本替换原版 Cheats 面板，原版一更新即整块失效；本页全部为运行期钩子与变量直写，仅依赖 6 个变量键（$crossdressing / $schoolrep / $school_crossdress_message / $crossdressingTrait / $backgroundTraits / $fame）。"));
		sInfobody.appendChild(el("div", MCE_CLS.hint, "④ 所有净化动作按 mbCE_wrote[\"yanling:op\"] 留痕（含 before/after/t），可在全局页留痕区核对。"));
		sInfobody.appendChild(el("div", MCE_CLS.hint, "⑤ 关闭开关会立即卸载钩子（window.isCrossdressing 还原为原版函数），不留空包装层；钩子被第三方模组重包时，开关开启期间每秒自动以新函数为上游重新包裹。"));
		sInfobody.appendChild(mceFoldHint("⑥ 性别认知残留属正常：学校异装名声升到 5 时原版会把 9 名 NPC 写进 $genderknown（schoolrep widget 的 pushUnique）。本页清零名声不撤销这些认知——它们只代表「NPC 已知道你的性别」，不是负面名声，撤销反而让 NPC 忘记已有认知。"));
		sInfo.appendChild(sInfobody);
		pane.appendChild(sInfo);
	}
