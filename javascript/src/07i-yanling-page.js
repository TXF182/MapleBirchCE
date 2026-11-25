	/* 职责：言灵页（07i）渲染骨架 —— 定位 pane / 建 A~E 分组 / 调分组调度 / 恢复滚动。
	   分组调度与读数 helper 见 07i-yanling-page-groups.js；区块实现见 07i-yanling-page-sections.js；
	   E 组（原帖 52 条补丁）见 07i-yanling-quick.js。 */

	/* 滚动快照（原 renderYanling 内联 try：面板在 .mce-body 里时记住 scrollTop，重渲染后还原） */
	function mbCEYanlingScrollSnapshot(pane) {
		var scroller = null, keepTop = 0;
		try { scroller = pane.closest ? pane.closest(".mce-body") : null; keepTop = scroller ? scroller.scrollTop : 0; } catch (eS) { void eS; }
		return { scroller: scroller, keepTop: keepTop };
	}

	/* 滚动还原（原内联 try：点开关后整页重渲染，不能让玩家每点一次都跳回顶端） */
	function mbCEYanlingScrollRestore(sc) {
		if (sc && sc.scroller && sc.keepTop) { try { sc.scroller.scrollTop = sc.keepTop; } catch (eR) { void eR; } }
	}

	/* 钩子是否为本页挂载（原内联表达式） */
	function mbCEYanlingIsHooked() {
		return !!(mbCEYanlingHookFn && typeof window !== "undefined" && window.isCrossdressing === mbCEYanlingHookFn);
	}

	/* 渲染：言灵页（7 号外层页签） */
	function renderYanling() {
		try {
			mbCEYanlingEnsureTimer();
			var pane = root ? root.querySelector('[data-pane="yanling"]') : null;
			if (!pane) { return; }
			var sc = mbCEYanlingScrollSnapshot(pane);
			pane.textContent = "";
			var ctx = { V: getV(), st: mbCEYanlingState(), hooked: mbCEYanlingIsHooked() };

			/* ==== v2.0.2 按键重排：8 个平铺区块 → 3 个语义分组 + 统一编号（①~⑧）+ 2 列按钮网格 ====
			   旧版把"说明与边界"塞在第 4 位却排在最后、区块顺序 s1→s2→s3→s5→s6→s7→s8→s4，编号与文案里的 ①②③ 完全脱节；
			   现在按「玩家要解决什么问题」分组：着装与名声（想穿什么就穿什么）/ 身体与数值（把状态拉回舒服）/
			   角色状态（把碍事的 NPC 挪开），说明统一收进最底折叠块。 */
			var gA = mceNewGroup(pane, "A · 着装与名声", "异装判定 / 性癖特质 / 负面名声 / 枝叶变装", true);
			var gB = mceNewGroup(pane, "B · 身体与数值", "衣物湿度与耐久 / 体液与精神 / 快补数值 / 天气", true);
			var gC = mceNewGroup(pane, "C · 角色状态", "放逐 / 监狱 / 格威岚 / 绝望轮回", true);
			var gD = mceNewGroup(pane, "D · 剧情与系统", "艾弗里办公室补开 / 作弊模式（无副作用）", true);
			/* v2.1.17 原帖 52 条补丁：独立 E 组 + 4 个页内选项卡（同类型合并），不挤进 A~D 的开关语义。
			   v2.2.x 排版：A~E 五组默认收起（点组头展开），长页只留 5 行组头，点开再看区块。 */
			var gE = mceNewGroup(pane, "E · 言灵补丁（原帖 52 条）", "52 条 · 4 类选项卡", true);

			mbCEYanlingRenderGroupA(gA, ctx);
			mbCEYanlingRenderGroupB(gB, ctx);
			mbCEYanlingRenderGroupC(gC, ctx);
			mbCEYanlingRenderGroupD(gD, ctx);

			/* E 组：52 条补丁（数据见 07i-yanling-quick-data.js，执行与回退见 07i-yanling-quick.js） */
			renderYanlingQuick(gE);

			mbCEYanlingRenderInfo(pane, ctx);

			/* 恢复滚动位置（见上方滚动快照） */
			mbCEYanlingScrollRestore(sc);
		} catch (e) { /* 渲染失败不抛到 UI 主链 */ }
	}

	/* 模块加载即起守卫：存档里已开启的开关无需打开面板也持续生效（V 未就绪时 tick 内静默跳过） */
	mbCEYanlingEnsureTimer();
