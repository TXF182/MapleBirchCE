
/*
 * ============================================================
 * Maplebirch CE 全局全自动剧情条件解锁面板（Twee MOD）
 * - 适配：SugarCube 2 + Degrees of Lewdity（本地 HTML / 网页版）+ maplebirchFramework v5.x
 * - 方案A：读取框架全局注册池（maplebirch.npc），自动扫描
 *   游戏本体全部角色 + 全部已加载 MOD 角色；零硬编码角色数据。
 * - 自动解析：原生恋爱剧情条件（romanceConditions / Config.romance）、
 *   转化阶段（Transformation build/level/levels 门槛）、
 *   角色数值（爱意 love / 支配 dom / 情欲 lust / 警戒 wary 等）。
 * - 阶段判定：条件求值 → 绿色已达成 / 红色未达成，逐条显示条件原文。
 * - 一键完成：先补齐数值至门槛 → 再激活阶段 Flag（规避框架自动校验重置）。
 * - 容错：框架未加载 / 角色缺失 / 条件不可解析时仅提示，不抛错、不炸档。
 *
 * v1.1（2026-10-13）：
 *  - 修复 SugarCube 2.36.1 段落枚举：Story.passages 已移除 → 统一走
 *    listAllPassages()（Story.passages 兼容 + Story.lookupWith 主路径），
 *    场景页「场景直达」与剧情页「$scenes 注册表」恢复可用；
 *  - 剧情文本实体反转义（&lt;&lt;→<<），兼容 HTML 转义形态的 widget 文本；
 *  - 新增「固定触发」：剧情页把任一剧情（含 MOD 注册场景，如罗宾神殿剧情）
 *    固定为下次推进剧情（遇见角色）即自动重放；「回退」恢复原版随机触发。
 *    复用原版 $replayScene 重放通道 + freezePlayerStats，零副作用。
 * v1.3.5（2026-10-15）：格威岚场景直达崩溃闭环——ensureGwylanSceneState()
 *  幂等补齐 T.gwylanStatus/T.gwylanTF（statusCheck 仅 init===1 才初始化），
 *  挂 :passageinit 全局钩子（mbCEOnPassageInit），任意入口先行补齐。
 * v1.4.0（2026-10-15）：新增第 6 主页面「Mod作弊」——第三方模组扩展内容
 *  作弊控制（主容器页展示模组列表 + 每模组独立子页面，四分组：模组新增任务/
 *  阶段&能力/自定义剧情/自定义数值修改）；注册制 setup.mbCE_modCheats +
 *  内置适配器 CHEAT_ADAPTERS + 被动探测 CHEAT_PASSIVE_PROBES 三通道动态发现；
 *  CHEAT_VANILLA_ROOTS 原版一级键过滤（loveInterest 拒、loveInterestList 可）；
 *  写入前父级链校验防 undefined、number isFinite+min/max 钳制、boolean 归一、
 *  list 型数组追加/移除（More Love Interests Mod 0.1.7.0 内置适配器）；
 *  全部修改留痕 V.mbCE_wrote（key=cheat:modId:op:item，含 before/after），
 *  每控件带「回退」按钮还原首次写入前状态。
 * v1.4.1（2026-10-15）：归途之书（默示录）适配——CHEAT_ADAPTERS
 *  ["revelation-the-book-of-return"] 探测 maplebirch.get('RobinTemple'/'TempleChoir')，
 *  状态键 V.RobinTemple（罗宾神殿路线）/V.TempleChoir（唱诗班），
 *  阶段 5（含字符串枚举：stage 七档/vigil_result/faith_band，setCheatStage 越界拒绝）、
 *  能力 6、剧情 1（祷告事件）、数值 8（0-1000 熟练度等钳制）；
 *  不暴露原版神殿变量 temple_rank/templePromised/temple_chastity_timer。
 * v1.4.2（2026-10-15）：DomRobin 适配——CHEAT_ADAPTERS["dom_robin"] 探测
 *  window.modUtils.getMod("DomRobin")（ModLoader 注册表，boot name=DomRobin）；
 *  边界隔离：DomRobin 大量复用原版罗宾线变量（robinpaid/renttime_fight/
 *  robinShouldPayBack/lemonadeUpgraded/robinPayBothNote/robinCouldPayBoth/
 *  robinSoldConsole 等一律不声明），只暴露模组自建键——
 *  阶段 1（直播周数 liveStreamStage 0-6，作者言灵明示可改）、能力 12
 *  （反抗战斗谈话/共同战斗/还债谈话/花环/直播准备/一起直播/4 项还钱进度）、
 *  数值 3（反抗链打赢次数 0-99、直播开关 0/1、柠檬水摊新商品列表）。
 * v1.4.3（2026-10-16）：枯木逢春适配——CHEAT_ADAPTERS["deadwood-reblooms"]
 *  探测 maplebirch.get("DeadwoodReblooms")（框架根模块，main.ts 注册）；
 *  状态键 V.RobinExpansion/V.LifeSimulation/V.StreetLife/V.BirdTower 等
 *  （Module.ts :variable 钩子 + super 构造 name 逐一实证）；
 *  阶段 6（店铺开办/气球支线/收容所/医生游戏/校园职务/历史课题，含字符串枚举）、
 *  能力 11、数值 18（摊位改造/反抗胜场/储备金/街头口碑/公路赛/金戒指/校园竞选值）；
 *  全量 grep 实证模组不读写原版顶层 rebellion/victories/self_rent 等，
 *  声明路径一律以模组模块根开头，绝不落到原版顶层键。
 * v1.4.5（2026-10-16）：实测反馈修复——①固定触发/场景直达后取消固定可能被困
 *  场景播放器且退出按钮消失：unpinScene 原先"先删 $replayScene 再跳转"，若跳转目标
 *  恰为 Scene Viewer passages，default 退出分支的 Back 链接依赖 $replayScene.exitpassage
 *  → Back 无源 → 退出按钮消失；改为"先清 sceneViewSwitch 无效值 → 跳转 → 再清理"，
 *  back 无效时保留 replayScene（播放器仍可手动 Back 退出）；onPassageOverride 新增
 *  dest===exitpassage（Back 正常返回原位）清理分支，杜绝残留。
 *  ②角色一览只显示能进恋人卡槽的角色：新增 isLoveCandidate（框架恋爱条件/原版恋爱
 *  阶段/恋爱标记 loveAlias·npcConfig·loveInterest/MLI 扩容恋人列表），非恋爱 NPC 不再展示。
 * v1.4.6（2026-10-16）：角色过滤方向修正——用户澄清：不要从角色一览"踢人"。
 *  ①撤销角色一览/阶段页默认角色的 isLoveCandidate 过滤：角色一览保留全部角色；
 *  ②非恋爱候选角色仅在恋爱阶段区不显示恋爱阶段（"不是恋爱角色的不显示"）；
 *  ③恋爱阶段兜底条件（loveInterest.includes("X")）一键完成 = 真正把角色加入恋人卡槽：
 *  新增 addLoveInterest——数组 push / 对象首个空槽（空对象写 primary）/ 槽位全满且存在
 *  MLI 扩容列表时写 loveInterestList（由模组 widget 自动重建槽位），绝不覆盖已有恋人；
 *  undoRomanceStage 支持 native 回退（移除卡槽 + 清痕迹）；checkNativeLove 收紧为仅
 *  npcConfig.loveInterest===true（important 重要 NPC 不再误判为恋爱候选）。
 * v1.4.7（2026-10-16）：Mod作弊 全链路自动化测试（test_mce.js 第 24 节 19 条）——
 *  数值/阶段更改→读回确认、越界钳制与拒绝、宿主缺失/vanilla 根保护、列表增删、
 *  任务跳过/完成、回退还原首次 before；API 导出补 cheatReadSafe（面板回显读取，供外部验证）。
 * v1.4.8（2026-10-16）：三大实测症状修复——
 *  ①剧情页「一键完成」对无 lockedMessage 的场景（惠特尼孤儿院/贞操装置等）失效：
 *    parseSceneBlocks 的 block 为 slice 出的键块（不含结尾 }），原 unlocked 正则 ",?\s*\}"
 *    匹配不到块尾 → unlockedExpr 提取失败 → 一键完成写不进解锁标记 → 复检恒「未达成」。
 *    补块尾 $ 分支；另加三层兜底：findScenesWidgetText 找不到 widget "scenes" 段落时
 *    找 "$scenes to {" 段落（汉化/段落名变体）、getScenesDefs 增加 Story 全文恢复
 *    （recoverSceneDefsFromStory 遍历段落键块扫描收 scenePassages.includes 解锁定义）、
 *    V.scenes 缓存里 unlocked 为表达式字符串时提升为 unlockedExpr；
 *    一键完成复检：includes 解锁标记已写入即达成（缓存静态布尔不再卡死）。
 *  ②固定触发场景播放完仍被困播放器/固定后不能自动解除：onPassageOverride 在
 *    Scene Viewer End 与「重放中链回 Scene Viewer passages」两个终点，MOD 固定触发
 *    （mbCE_replayOnce）一律自动改 passageArgs.name 回 exitpassage（原位）并补
 *    unfreezePlayerStats，跳过原版「Error occurred / Exit scene」手动步；原版手动
 *    重放保持原版行为不干预。触发处 mbCE_replayPending 改为仅 startPassage===
 *    "Scene Viewer passages" 时设置（直入剧情段落的场景链回 passages 时不被误判首次）。
 * v1.6.0（2026-10-18）：模组更新适配 + 新模组兼容（6 包源码实证）——
 *  ①归途之书 1.3.4 补录两大模块（1.3.1 起已注册但此前漏适配，用户反馈"阶段没收录"根因）：
 *   LostLamb（迷途羔羊·悉尼童年梦境线，V.LostLamb：talkVow 誓约 5 档 / ending 结局 4 档 /
 *   疑虑·恐惧·觉察 0-100 / recalled·active·known 秘密 3 项）与
 *   TempleDuties（神殿值勤系统，V.TempleDuties：oath 誓约 3 档 / bishop 主教进展 5 档 /
 *   manor 庄园线 5 档 / declaration 宣言 2 档 / watch.phase 守夜 7 档 / case.stage 案件 3 档 /
 *   duties 值勤 0-999 / archive 归档 3 值 / enrolled·review·候选同意 3 项）；
 *   RobinTemple/TempleChoir 常量 1.3.1→1.3.4 无变化，旧声明全部保留。
 *  ②枯木逢春 2.2.7 核对：20 模块 define 全同、V 键名不变（super name 逐一实证），
 *   仅 vanilla-plus 结构迁移（beauty 清空、新增 attitudes 特质）——原声明不受影响，
 *   新增能力 2 项：铁意志 ironWill / 受虐狂 sadomasochist（VanillaPlus.attitudes.*）。
 *  ③新增 SmartPhone Alpha 0.3.91 适配（万能的智能手机，V.Phone 实证 48 键）：
 *   stages 1（老冯线 FengLine 0/1/2）、values 7（摄影 photography 0-1000 /
 *   危险任务模式 TaskDanger 0/1 / 初遇老冯 FengMeeet / 放弃老冯线 MetFengGiveup /
 *   发现二手店 SecondShopKnown / 暴露场景计数 FengAcceptExposed 0-99 /
 *   悉尼直播陪伴 SydneySexLiveCompanion）；模组键全部为 0/1 数字语义（===1 判断），
 *   故一律走 number 型 values（checkbox 布尔会写 true 破坏 ===1 判断）。
 * ④框架 maplebirch 5.4.12 满足两内容模组新依赖（≥5.4.9 / ≥5.4.10）；SoftWet GameUI 2.7.0
 *  与 ModHub 1.7.6 为纯 UI/管理工具（无状态键），确认不冲突、无需适配。
 * ============================================================
 */
(function () {
	"use strict";

