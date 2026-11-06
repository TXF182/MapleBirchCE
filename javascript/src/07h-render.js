	/* v1.9.23：锚定播放完成记录（mbCE_completedScenes）→ 剧情页条目显示「已完成 ✓」 */
	function isSceneCompleted(key) {
		try { var V = getV(); return !!(V && V.mbCE_completedScenes && V.mbCE_completedScenes[key]); } catch (e) { return false; }
	}
	/* ---- 特殊剧情页（$scenes 场景注册表动态枚举） ---- */
	var sHeadGuardTimer = null; /* v1.9.5-自检：乱码兜底单定时器——renderScenes 频繁重建时清旧设新，防 800ms 闭包堆积扫描旧 pane */
