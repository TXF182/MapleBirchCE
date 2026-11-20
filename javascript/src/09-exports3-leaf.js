/* 职责：v2.1.8 枝叶变装导出（yanlingLeafSuit / yanlingLeafRevert）。
   09-exports2.js 已顶到结构门禁 S1 的单段 400 行上限，故沿用 09-exports-vcore.js 的同一先例拆段：
   mountApi() 把主导出表挂到 setup.mbStageCE 之后，由 mbCEExportLeaf() 补齐这两个键
   （语义化文件名，不用 X2/X3 挤排序）。 */
	function mbCEExportLeaf() {
		try {
			var s = getSetup();
			if (!s || !s.mbStageCE) { return; }
			var a = s.mbStageCE;
			a.yanlingLeafSuit = mbCEYanlingLeafSuit;
			a.yanlingLeafRevert = mbCEYanlingLeafRevert;
			/* v2.1.14 经济 · 学业 · 农田 · 消耗品 · 纹身（07m-vanilla-econ-data.js） */
			a.vanillaEconStats = mbCEVanillaEconStats;
			a.vanillaEconRentDays = mbCEVanillaEconRentDays;
			a.vanillaEconRentDebt = mbCEVanillaEconRentDebt;
			a.vanillaEconClearDebt = mbCEVanillaEconClearDebt;
			a.vanillaEconAttend = mbCEVanillaEconAttend;
			a.vanillaEconAttendAll = mbCEVanillaEconAttendAll;
			a.vanillaEconMissedClear = mbCEVanillaEconMissedClear;
			a.vanillaEconRipen = mbCEVanillaEconRipen;
			a.vanillaEconRipenAll = mbCEVanillaEconRipenAll;
			a.vanillaEconCondoms = mbCEVanillaEconCondoms;
			a.vanillaEconCondomsAdd = mbCEVanillaEconCondomsAdd;
			a.vanillaEconTattooClear = mbCEVanillaEconTattooClear;
			a.vanillaEconTattooMark = mbCEVanillaEconTattooMark;
			a.vanillaEconTattooClearAll = mbCEVanillaEconTattooClearAll;
			/* 回退按 id 走统一分发：先查 vcore 留痕再按 kind 还原（测试与诊断直接调这一个入口） */
			a.vanillaEconUndo = function (id) { return mbCEVanillaExtUndo(String(id)); };
			a.renderVanillaEcon = mbCERenderVanillaEcon;
			/* v2.1.15 鹰塔（大鹰塔）清洁度与八种材料（07n-vanilla-bird.js） */
			a.vanillaBirdStats = mbCEVanillaBirdState;
			a.vanillaBirdClean = mbCEVanillaBirdCleanSet;
			a.vanillaBirdMaterials = mbCEVanillaBirdMaterialsFill;
			a.vanillaBirdUndo = function (id) { return mbCEVanillaExtUndo(String(id)); };
			a.renderVanillaBird = mbCERenderVanillaBird;
			a.vanillaBirdUpgrades = mbCEVanillaBirdUpgradesMax;
			/* v2.1.15 礼顿把柄（07o-vanilla-leighton.js） */
			a.vanillaLeightonStats = mbCEVanillaLeightonState;
			a.vanillaLeightonClear = mbCEVanillaLeightonClear;
			a.vanillaLeightonUndo = function (id) { return mbCEVanillaExtUndo(String(id)); };
			a.renderVanillaLeighton = mbCERenderVanillaLeighton;
			if (typeof mbCEUndoItemName === "function") { a.mbCEUndoItemName = mbCEUndoItemName; }
		} catch (e) { void e; }
	}
