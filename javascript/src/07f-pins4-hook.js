/* 职责：passageoverride / passageinit 钩子的注册与收尾（override 判定主体见 07f-pins4-override.js）。
   本段只做三件事：
   1) hookPassageOverride：把 :passageoverride 事件挂到 onPassageOverride（命名空间防重，重载/重复注入不累积 handler）；
   2) mbCEOnPassageInit / hookPassageInit：Scene Viewer passages 初始化拦截，防「播放完又播放」无限循环；
   3) hookUnfreezePlayerStats：包装 window.unfreezePlayerStats，任何合法解冻都视为「播放结束」→ 清理队列与重放态。
   v2.2.4 结构治理：原 onPassageOverride（圈复杂度 101 / 嵌套 6 / 207 行）已拆到 07f-pins4-override.js，
   两段同属一个构建作用域，函数声明可跨段引用。 */

function hookPassageOverride() {
	try {
		if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
		/* SugarCube 自定义事件系统（jQLite）：与 DoL 本体 $(document).one(':passageend',…) 一致。
		   四巡：命名空间防重——重载/重复注入时先 off 再 on，避免 jQuery handler 无限累积 */
		$(document).off(":passageoverride.mbce").on(":passageoverride.mbce", function (ev, passageArgs) {
			onPassageOverride(passageArgs);
		});
	} catch (e) {}
}
/* 场景查看器段落初始化拦截（防"播放完又播放"无限循环）：
   本体的 Scene Viewer passages 段落在 <<switch $sceneViewSwitch>> 里无条件播放 case 剧情，
   剧情 widget 结束若链回该段落会再次命中 case → 无限循环（且 replayScene 只在 default/End 清理）。
   机制：固定触发跳转前设 mbCE_replayPending；首次进入该段落（pending=true）→ 消费标记、保留
   sceneViewSwitch（case 正常播放）；剧情结束链回（pending=false 且处于我们的重放）→ 清
   sceneViewSwitch 为无效值 → switch 走 default → 原版给出 Back 链接返回原位，不再重播。 */
/* v2.2.7 进段补充钩子：五件事各自 self 兜底（异常一律静默，不阻断段落流转） */
function mbCEOnPassageInitTicks(title) {
	try { mbCEVanillaEconRentLockTick(); } catch (e1) {}
	try { mbCEKnowProbe(title); } catch (e2) {}
	try { mbCESamEnsureHook(); } catch (e3) {}
	try { mbCEGwylanStageRestoreTick(title); } catch (e4) {}
	try { mbCEAveryInjuryHoldTick(); } catch (e5) {}
	/* v2.2.8：①枝叶装引用自愈（原版 <<clothing_data>> 每次加载重建 setup.clothes，注入项与 index 会失效 → 立绘整层不画）
	   ②农场动物字段守卫（<<farm_gen>> 无条件读 $farm_work[..].monster_roll，缺失即 Farm Work 红屏） */
	try { mbCEYanlingLeafRepairTick(); } catch (e6) {}
	try { mbCEFarmWorkGuard(); } catch (e7) {}
	/* v2.2.7 贝利扣押拦截：原版脚本可能晚于 CE 注入，逐回合幂等补装（开关关时只保存原引用、不覆盖） */
	try { mbCEBaileySync(); } catch (e8) {}
	/* v2.3.0 玩家的游戏：已开启能力逐段复写 + 财神金钱钩子幂等补装（纯增益，不依赖外部模组） */
	try { mbCEPGTick(); } catch (e9) {}
}
function mbCEOnPassageInit(title) {
	try {
		/* v1.3.5：格威岚场景临时变量全局兜底——每次进入任意段落都先确保
		   T.gwylanStatus / T.gwylanTF 已初始化（缺失才补，已有绝不覆盖）。
		   本体 Gwylan Ritual Start Garden 等段落靠 <<run statusCheck("Gwylan")>>
		   初始化这两个临时变量，但 statusCheck 仅在 C.npc.Gwylan.init === 1 时才调用
		   gwylanStatusCheck()（新存档未见过格威岚即不调用）；且 gwylanStatusCheck()
		   在 V.gwylanTalked/V.gwylanSeen/V.gwylan 缺失时早退，只设 T.gwylanStatus=[]、
		   不设 T.gwylanTF。新存档场景直达/固定触发格威岚段落 → 读 _gwylanStatus/
		   _gwylanTF 即崩（reading 'includesAny' / 'tail'）。全局兜底可覆盖任何段落名
		   （含框架改段落名/宿主段落内嵌格威岚内容的渲染路径）。 */
		ensureGwylanSceneState();
		/* v1.9.x 庄园自动维护每日调度：任意段落进入时检查游戏日变化，
		   执行已开启的自动维护项（AutoClean 模式，见 03-global.js mcAutoMaintainTick） */
		try { mcAutoMaintainTick(); } catch (e) {}
		/* v2.2.7 需求③④⑤：租金锁纠正 / 认识探测 / Sam 钩子补装（各自 self 兜底，见下方 helper） */
		mbCEOnPassageInitTicks(title);
		if (title !== "Scene Viewer passages") { return; }
		var V = getV();
		if (!V) { return; }
		if (V.mbCE_replayPending) { V.mbCE_replayPending = false; return; }
		if (V.replayScene && V.mbCE_replayOnce) { V.sceneViewSwitch = "MB_CE_END"; }
	} catch (e) { /* passage 收尾钩子失败必须静默，避免阻断原版段落流转 */ }
}
function hookPassageInit() {	try {
		if (typeof document === "undefined" || !document || typeof $ === "undefined" || !$) { return; }
		$(document).off(":passageinit.mbce").on(":passageinit.mbce", function (ev, passage) {
			try {
				var t = (passage && passage.title) ? passage.title : "";
				mbCEOnPassageInit(t);
			} catch (e) {}
		});
	} catch (e) {}
}
/* v1.8.19：播放结束自动清理——包装 window.unfreezePlayerStats。
   背景（用户实测）：固定 MOD 剧情播放完一次后不自动取消、仍重新播放；手动取消后仍被困播放器。
   根因：结束判定只认 4 个硬编码段落名（Scene Viewer End / Scene Viewer passages / exitpassage /
   Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景，结束段落为框架自有名，
   不走原版 Scene Viewer 通道）的结束段落不被识别 → 队列 used 项永不清理 + replayScene 残留 →
   下次推进剧情再次触发（循环）或拦截后续固定。
   修复：任何合法 unfreezePlayerStats 调用（原版 Scene Viewer 退出 / 框架播放器结束 / mod 播放器
   结束都会解冻）都视为"场景播放结束"→ 清理队列 used 项 + 清 replayScene/标记。不再依赖段落名。 */
function hookUnfreezePlayerStats() {
	try {
		if (typeof window === "undefined" || !window) { return; }
		var orig = window.unfreezePlayerStats;
		if (typeof orig !== "function" || window.__mbCEUnfreezeHooked) { return; }
		window.__mbCEUnfreezeHooked = true;
		window.unfreezePlayerStats = function () {
			try {
				var V = getV();
				if (V && V.replayScene && V.mbCE_replayOnce) {
					/* MOD 固定触发的重放中收到 unfreeze = 播放结束 → 清理已触发项 + 重放状态 */
					cleanupUsedPins();
					try { V.replayScene = undefined; } catch (e) { V.replayScene = undefined; }
					try { V.mbCE_replayOnce = undefined; V.mbCE_replayPending = undefined; } catch (e) { /* 重放一次性标记清理失败 → 保留原值，不影响本次播放结束流程 */ }
				}
			} catch (e) { /* 清理重放状态失败必须静默，避免遮蔽下方 orig 原函数调用 */ }
			try { return orig.apply(window, arguments); } catch (e) {}
		};
	} catch (e) { /* unfreeze 钩子安装失败不阻断面板加载（退化为不接管 unfreeze） */ }
}
