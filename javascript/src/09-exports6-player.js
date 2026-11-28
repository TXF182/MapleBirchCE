/* 职责：v2.3.0「玩家的游戏」19 键对外 API 补齐（09-exports2.js 触 400 行门禁后拆段）。
   仿 09-exports3/4/5 模式：mountApi 赋值后调用，幂等；函数声明与 09-exports2 同处顶层 IIFE。 */
function mbCEExportPlayerGame() {
	try {
		var s = getSetup();
		if (!s || !s.mbStageCE) { return; }
		var a = s.mbStageCE;
		a.mbCEPlayerGameRegistry = function () {
			return MB_CE_PG_REGISTRY.map(function (e) {
				return { id: e.id, group: e.group, name: e.name, desc: e.desc, subs: e.subs.slice() };
			});
		};
		a.mbCEPlayerGameGroups = function () {
			return MB_CE_PG_GROUPS.map(function (g) { return { id: g.id, title: g.title, sub: g.sub }; });
		};
		a.mbCEPlayerGameState = mbCEPGState;
		a.mbCEPlayerGameStatus = mbCEPGStatus;
		a.mbCEPlayerGameSet = mbCEPGSet;
		a.mbCEPlayerGameSetSub = mbCEPGSetSub;
		a.mbCEPlayerGameAll = mbCEPGAll;
		a.mbCEPlayerGameReset = mbCEPGReset;
		a.mbCEPlayerGamePreset = mbCEPGPreset;
		a.mbCEPlayerGameTick = mbCEPGTick;
		a.mbCEPlayerGameSetMode = mbCEPGSetMode;
		a.mbCEPlayerGameSetPassive = mbCEPGSetPassive;
		a.mbCEPlayerGameFav = mbCEPGFav;
		a.mbCEPlayerGameTraitConfig = mbCEPGTraitConfig;
		a.mbCEPlayerRegisterTrait = mbCEPGRegisterTrait;
		a.mbCEPlayerGameMoneyAmount = mbCEPGMoneyAmount;
		a.mbCEPlayerGameInstallMoneyHook = mbCEPGInstallMoneyHook;
		a.mbCEPlayerGameRenderEntry = mbCEPlayerGameRenderEntry;
		a.renderPlayerGame = renderPlayerGame;
	} catch (e) {}
}
