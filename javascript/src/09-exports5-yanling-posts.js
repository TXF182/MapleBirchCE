/* 职责：言灵页第二批动作导出（贴吧森林商店帖 87 / 90 / 92 楼：项圈锁 / 绝望轮回全结局 / 清除好奇）。
   仿 09-exports4-yanling-quick 的模式：mountApi 之后补齐，init 与顶层各调一次（幂等）。
   拆段原因：09-exports2.js 已 399 行，触及单段 400 行门禁。 */
function mbCEExportYanlingPosts() {
	try {
		var s = getSetup();
		if (!s || !s.mbStageCE) { return; }
		var a = s.mbStageCE;
		a.yanlingCollarLock = mbCEYanlingCollarLock;
		a.yanlingHopelessEndings = mbCEYanlingHopelessEndings;
		a.yanlingClearCuriosity = mbCEYanlingClearCuriosity;
		a.yanlingGwylanRitualReady = mbCEYanlingGwylanRitualReady;
		a.yanlingGwylanRitualDelay = mbCEYanlingGwylanRitualDelay;
		a.yanlingGwylanDesire = mbCEYanlingGwylanDesire;
		a.yanlingGwylanRequestDone = mbCEYanlingGwylanRequestDone;
		a.yanlingGwylanPetBed = mbCEYanlingGwylanPetBed;
		a.yanlingGwylanSea = mbCEYanlingGwylanSea;
		a.yanlingGwylanSex = mbCEYanlingGwylanSex;
		a.yanlingHypnoCd = mbCEYanlingHypnoCd;
		a.yanlingHypnoDaily = mbCEYanlingHypnoDaily;
		a.yanlingArcadeCount = mbCEYanlingArcadeCount;
		a.yanlingCollarBreak = mbCEYanlingCollarBreak;
	} catch (e) {}
}
