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
		} catch (e) { void e; }
	}
