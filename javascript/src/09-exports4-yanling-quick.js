/* 职责：言灵补丁（原帖 52 条）导出 —— 数据表 / 执行 / 逐条撤销 / 整页撤销 / 选项卡状态。
   09-exports2.js 的 mountApi() 会把主导出表挂到 setup.mbStageCE；此处在 mountApi 之后补齐
   （拆段原因：09-exports2.js 已 399 行，触及单段 400 行门禁）。 */
function mbCEExportYanlingQuick() {
	try {
		var s = getSetup();
		if (!s || !s.mbStageCE) { return; }
		var a = s.mbStageCE;
		a.renderYanlingQuick = renderYanlingQuick;
		a.yanlingQuickRun = mbCEYanlingQuickRun;
		a.yanlingQuickUndo = mbCEYanlingQuickUndo;
		a.yanlingQuickUndoTab = mbCEYanlingQuickUndoTab;
		a.yanlingQuickTab = mbCEYanlingQuickTabGet;
		a.yanlingQuickTabSet = mbCEYanlingQuickTabSet;
		a.YANLING_QUICK = MCE_YANLING_QUICK;
		a.YANLING_QUICK_TABS = MCE_YANLING_QUICK_TABS;
	} catch (e) {}
}
