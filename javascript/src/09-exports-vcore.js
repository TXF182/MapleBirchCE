/* 职责：v2.0.9 原版档案 / 收藏 / 头衔（vcore 六键）导出。
   09-exports2.js 的 mountApi() 会把主导出表挂到 setup.mbStageCE；此处在 mountApi 之后补齐 vcore 键
   （拆段原因：结构门禁 S1 单段 400 行上限；语义化文件名，不用 X2/X3 挤排序）。 */
	function mbCEExportVcore() {
		try {
			var s = getSetup();
			if (!s || !s.mbStageCE) { return; }
			var a = s.mbStageCE;
			a.mbCEVanillaCrimeClear = mbCEVanillaCrimeClear;
			a.mbCEVanillaAntiqueCollect = mbCEVanillaAntiqueCollect;
			a.mbCEVanillaAntiqueCollectOne = mbCEVanillaAntiqueCollectOne;
			a.mbCEVanillaAntiqueSpecials = mbCEVanillaAntiqueSpecials;
			a.MCE_VANILLA_SPECIAL_ANTIQUES = MCE_VANILLA_SPECIAL_ANTIQUES;
			a.mbCEVanillaRemyScar = mbCEVanillaRemyScar;
			a.mbCEVanillaExtState = mbCEVanillaExtState;
			a.mbCEVanillaExtUndo = mbCEVanillaExtUndo;
			a.mbCERenderVanillaExt = mbCERenderVanillaExt;
			/* v2.1.2 自检钩子：框架闸门与调度守卫无面板入口，导出供 tests/ 断言与实机探针复用 */
			a.mbCEFrameworkGate = mbCEFrameworkGate;
			a.mbCECompareVersion = mbCECompareVersion;
			a.mceSchedule = mceSchedule;
		} catch (e) {}
	}
