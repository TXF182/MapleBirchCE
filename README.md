# Maplebirch CE · 全局全自动剧情条件解锁（v1.5.0 · 全局页新增誓言修复 + NPC 特质获取 · 纯 JS 加载版 · 界面全中文 · 完整恋爱阶段 · 条件中文说明）

基于 Maplebirch 框架注册池的全局调试面板。对标官方 CE 调试器：右侧常驻黑色悬浮面板、双层标签、角色数据卡片、恋爱/转化阶段一键完成、剧情解锁、场景直达（永久解锁+世界入口）、第三方模组扩展内容作弊控制。

## 版本说明

- **v1.5.0（2026-10-16 · 全局页新增「誓言修复 + NPC 特质获取」）**：
  - **背景**：用户要求在全局页面添加：①一键修复誓言；②继续获得 NPC 特质（可指定获取哪一项），获取时不满足的条件直接改为满足；
  - **誓言修复**：对照游戏 0.5.12.13 原版 Traits widget「一般特质」分组的誓言相关特质逐项落实——`player.virginity.temple`（Temple Vow 未破=true / 被破=破坏者名或 false）、`templePromised`（承诺对象，保留不覆盖）、`temple_rank`（神殿等级）、`temple_burden`（神殿之担）、`brokenVowCount`（各角色破誓计数）。「一键修复誓言」：`temple` 恢复 true（Chastity Vow 恢复、Broken Vow / Broken Promise 特质自动消失）+ 破誓计数清零 + 承诺对象保留（恢复显示 Rite of Promise）；全局页实时显示当前誓言状态（未破/被谁破/承诺对象/神殿等级）；
  - **NPC 特质获取**：对照原版「NPC Traits」分组 6 项逐项收录（条件照抄源码 has 表达式）：同舟共济—罗宾（`robinpaid>=1`）、斯德哥尔摩综合征：伊甸（`syndromeeden>=1`）、凯拉尔（`syndromekylar>=1`，凯拉尔在监狱且玩家不在监狱时提示暂不显示——NPC 状态不改）、狼群（`syndromewolves>=1`）、巨鹰（`syndromebird>=1`）、艾弗里的救星（`avery_fate="saved"`）。每项显示中文名+原文名+效果+当前状态，点「获取」直接把条件变量改为满足值，游戏「特质」页立即显示；已拥有项置灰；
  - **验证**：全量断言 407 项全过（新增第 27 节 16 条：誓言状态读取 / 修复后 temple=true+计数清零+承诺保留 / 特质 6 项与汉化名 / 初始未拥有 / 逐项获取后 owned=true / 凯拉尔监狱提示不改 NPC 状态 / 未知特质拒绝）。
- **v1.4.9（2026-10-16 · Mod作弊 适配器重校验补录：枯木逢春值勤/着装规范 + 归途之书医院阶段等）**：
  - **背景**：用户实测发现"有些 mod 的阶段没收录进去"（枯木逢春学生会面板截图佐证：已完成值勤 29 / 着装规范·自由着装），要求重新校验已适配的四个内容模组。用户上传三份可读源码：Deadwood-Reblooms-2.2.0.zip / DomRobin.mod.zip / Revelation-The-Book-of-Return-1.3.1.zip，逐一解包与适配器声明比对；
  - **核对结论**：①MLI（more_love_interests）：11 个候选角色与 `loveInterestList` 重建机制全匹配，**无缺口**；②DomRobin：21 项声明（直播周数/反抗链/共同战斗/还债/直播/新商品）全部源码实证，**无缺口**；③枯木逢春：对照 `School.ts` 的 `SchoolState` 接口实证缺 **`duties.completed`（已完成值勤次数，截图"已完成值勤：29"）** 与 **`dress.active`（着装规范，截图"自由着装"）**；④归途之书：对照 `constants/robin-temple.ts` 实证缺医院阶段等一批字段；
  - **枯木逢春补录**：stages +2（`dress.active` 着装规范 6 档 uniform→mandatoryNudity / `dress.highest` 保住过的最高政策）；values +3（`duties.completed` 值勤次数 0-999 / `pc_loan` 罗宾欠款 / `weekly_income` 上周收入）；abilities +1（`clothesStored` 校服已存放）；
  - **归途之书补录**：stages +4（`hospital_stage` 医院阶段 6 档 / `secret.followup` 后日谈 / `night_scene` 夜访场景 / `transformation_kind` 变身形态 8 种）；abilities +6（医院陪伴 / 评估之火 / 守夜进行中 / 与罗宾同守夜 / 已放弃路线 / 仪式已完成）；values +3（同席连续次数 / 亲密累计次数 / 评估分数）；
  - **验证**：全量断言全过（新增 19.11 归途之书 15 条 + 21.9 枯木逢春 8 条：新字段写入读回/越界拒绝/能力勾选/数值钳制）。
- **v1.4.8（2026-10-16 · 一键完成兜底 + 固定触发播放完自动回原位）**：
  - **背景**：用户实测仍报三大症状——①剧情页惠特尼等场景「一键完成」仍显示「未达成（条件未满足）」；②固定触发场景播放完仍被困场景播放器；③固定触发后不能自动解除。
  - **① 一键完成根因与修复**：原版场景定义里无 `lockedMessage` 的场景（惠特尼孤儿院 `includes("Street Bully Orphanage Go")`、贞操装置/泳装复用裙子标记 `includes("WhitneySchoolBullySkirt")` 等）在键块解析时 `unlocked` 表达式提取失败（解析块为 slice 出的键块、不含结尾 `}`，原正则匹配不到块尾）→ 一键完成写不进解锁标记 → 复检恒「未达成」。修复：`unlocked` 正则补块尾分支；并加三层兜底——`findScenesWidgetText` 定位不到 widget 段落时改找 `$scenes to {` 段落（汉化/段落名变体）、`getScenesDefs` 新增 Story 全文恢复（遍历段落键块扫描、只收 `scenePassages.includes` 解锁定义）、`V.scenes` 缓存里 `unlocked` 为表达式字符串时提升为 `unlockedExpr`；一键完成复检改为「includes 解锁标记已写入即达成」（缓存静态布尔不再卡死）。
  - **②③ 播放器/自动解除根因与修复**：固定触发的重放结束时（Scene Viewer End，或 case 场景播放完链回 Scene Viewer passages）此前只能停在原版「Exit scene / Error occurred + Back」手动步 → 表现为被困播放器、固定不自动解除。修复：`onPassageOverride` 在两个重放终点对 MOD 固定触发（`mbCE_replayOnce`）一律自动改 `passageArgs.name` 回原位（exitpassage）并补 `unfreezePlayerStats`，跳过手动步；原版手动重放保持原版行为不干预。触发处 `mbCE_replayPending` 改为仅入口为 `Scene Viewer passages` 时设置（直入剧情段落的场景如孤儿院链回 passages 不会被误判首次而拦不下）。
  - **验证**：338 项断言全过（新增第 25 节 16 条：全文恢复解析惠特尼场景 / 孤儿院·贞操装置一键完成 / 缓存 unlocked 字符串一键完成 / Scene Viewer End 自动回原位 / 原版手动重放不干预 / 链回 passages 自动回原位 / 首次不拦截 / 触发 pending 条件化）。
- **v1.4.7（2026-10-16 · Mod作弊 数值/阶段全链路自动化测试）**：
  - **背景**：用户要求"对 mod作弊 中的数值阶段进行更改，并查看是否更改完成、能否正常运行，在代码中进行测试"——在 `test_mce.js` 新增第 24 节 19 条自动化测试，注册测试模组（任务/字符串阶段/数字阶段/能力/自定义场景/数值/布尔/列表）跑全链路；
  - **覆盖**：24.1 模组注册识别；24.2 数值更改写入 + `cheatReadSafe` 读回确认（面板回显依据）；24.3 越界钳制（999→max 100）；24.4 布尔写入；24.5/24.6 列表追加与移除；24.7 字符串枚举阶段写入 + 读回确认（下拉回显依据）；24.8 阶段越界拒绝且原值不变；24.9 数字阶段写入；24.10 跳至最高；24.11 回退初始；24.12 能力勾选；24.13 父级缺失拒绝（不写 undefined 对象）；24.14 vanilla 根拒绝（loveInterest）；24.15/24.16 任务跳过/完成标记；24.17-24.19 再次更改 → 回退还原首次 before（数值 5 / 阶段 started）；
  - **API 增强**：`cheatReadSafe` 加入 api 导出（面板回显读取逻辑，供外部验证"更改是否完成"）；
  - **验证**：323 项断言全过（304 + 第 24 节 19 条）。
- **v1.4.6（2026-10-16 · 角色过滤方向修正：不踢角色，恋爱阶段区过滤 + 一键完成入卡槽）**：
  - **背景**：v1.4.5 的角色过滤实现被否决——用户明确"不是让你直接把他在角色里面踢出去"：角色一览**必须保留全部角色**；只有"不能成为恋人"的 PC 才**不显示其恋爱阶段/恋爱条件**；能进恋人卡槽的角色显示恋爱条件，且该条件一键完成后**真正把角色加入恋人卡槽**；
  - **修复 1（撤销踢人）**：角色一览卡片与阶段页默认角色恢复全量 `listCharacters()`，不再按恋爱候选过滤——所有角色都保留在一览；
  - **修复 2（恋爱阶段区过滤）**：`renderRomanceStages` 对非恋爱候选角色显示提示「不是可确立恋人关系的角色，无可解锁的恋爱阶段」；`checkNativeLove` 收紧为仅 `npcConfig.loveInterest === true`（`important` 重要 NPC 不再误判为恋爱候选，避免非恋爱角色在恋爱区出现）；
  - **修复 3（一键完成 = 加入恋人卡槽）**：新增 `addLoveInterest`——恋爱阶段兜底条件 `loveInterest.includes("X")` 的一键完成现在真正把角色写入 `V.loveInterest`（数组 push / 对象首个空槽 / 空对象写 primary 主槽 / 槽位全满且存在 MLI 扩容列表时写 `loveInterestList` 由模组 widget 自动重建槽位），**绝不覆盖已有恋人**；`undoRomanceStage` 支持 native 回退（移除卡槽 + 清痕迹）；
  - **验证**：304 项断言全过（23.11-23.16：兜底条件一键完成入数组卡槽/对象空槽/MLI 列表留痕/非恋爱候选恋爱区排除；12.3 原生恋爱一键完成+回退同步更新为新语义）。
- **v1.4.5（2026-10-16 · 场景播放器退出修复）**：
  - **背景**：用户实测反馈 ①固定触发/场景直达后"取消固定队列退出场景"会被困在场景播放器中、退出按钮消失（**该修复在 v1.4.6 保持有效**）；②角色一览里不能成为恋人的 NPC 不应显示（**该方向在 v1.4.6 已按用户澄清修正，见上**）；
  - **根因 1（被困播放器）**：`unpinScene` 原先"先删 `$replayScene` 再跳转返回原位"——原版 Scene Viewer passages 的 default 退出分支（Back 链接）依赖 `$replayScene.exitpassage`；若跳转目标恰为 Scene Viewer passages（或返回后再次命中播放器），replayScene 已删 → Back 链接无源 → 退出按钮消失 → 被困；
  - **修复 1**：`unpinScene` 改为"先清 sceneViewSwitch 无效值 → 跳转（此时 replayScene 仍在，default 分支能渲染 Back）→ 跳转完成后再清理 replayScene/标记"；back 无效（exitpassage 空且当前段落读不到）时不删 replayScene——播放器 default 的 Back 链接保留，玩家可手动退出。另新增 `onPassageOverride` 的 `dest === exitpassage`（Back 正常返回原位）清理分支：原版重放经 Back 退出时清掉 replayScene/重放标记/已用队列项，杜绝残留干扰后续重放与取消固定；
  - **验证**：298 项断言回归全过（新增第 23 节 10 条：unpinScene 先跳后清 / back 无效保留 replayScene / Back 正常退出清理 / 恋爱候选判定四路命中与路人排除）。
- **v1.4.4（2026-10-16 · 场景状态与阶段回显修复）**：
  - **背景**：用户实测反馈「Mod作弊 阶段应用看着没效果（数值/勾选正常）」「剧情页大量剧情显示 状态：未知，一键完成后仍显示 未解锁：未知」；
  - **根因 1（阶段不回显）**：Mod作弊 子页面阶段下拉创建时未按当前存档值回显，应用成功后写入有效（留痕提示正常）但下拉仍显示第一项 → 用户误以为没生效；
  - **根因 2（剧情未知）**：DoL 原版 `$scenes` 全部场景的 `unlocked` 均为 `$scenePassages.includes("段落")`（已看段落表），部分存档/流程下 `V.scenePassages` 从未初始化 → `undefined.includes` 抛异常被 catch → 状态解析为 undefined → 全部显示「状态：未知」；一键完成虽已初始化 scenePassages，但渲染层复检同样被同一问题吞掉；
  - **修复**：① `evalSceneExpr` 求值前若 `V.scenePassages` 非数组则兜底初始化为 `[]`（与 DoL 自身初始化一致，无害）；② `sceneStatus` 语义收紧为「非 true 一律未达成」（false/0/undefined/求值异常 → 未达成 + 锁定原因，不再出现「未知」）；③ `renderCheatStages` 阶段下拉按当前存档值回显（字符串/数字枚举均按值匹配）；
  - **验证**：288 项断言回归全过（新增第 22 节 6 条：scenePassages 缺失兜底 / 未达成而非未知 / 段落写入后达成 / 一键完成复检 / 0 与 false 归未达成）。
- **v1.4.3（2026-10-16 · 枯木逢春适配）**：
  - **背景**：用户提供 `Deadwood-Reblooms-2.2.0.zip`（枯木逢春 · Deadwood Reblooms 2.2.0，作者楓樺葉）要求适配；这是基于 maplebirch 框架的**20 模块大型内容模组**（Sydney/Robin/Whitney/Kylar/LifeSimulation/Orchard/BirdTower/Transport/StreetLife/Finance/VanillaPlus/CelestialAnomalies/MoreTransformations 等）；
  - **探查**：解压至 `_deadwood_probe\`，通读 package.json（依赖 maplebirch≥5.4.3）、README（模块总表）、Module.ts（通用状态机制：preInit 挂 `:variable` 钩子 → `V[模块名] ??= {}` + migration fill）、main.ts（20 模块 `maplebirch.define` 注册）、各模块类 super 构造 name（逐一实证 V 键名）、constants/（robin/life-simulation/bird-tower/celestial-anomalies 默认状态）、StreetLife.ts + Races.ts（公路赛 v2.2.0）、School.ts（校园职务/竞选数值）；
  - **状态键（已实证）**：人物模块 `V.RobinExpansion`/`V.SydneyExpansion`/`V.WhitneyExpansion`/`V.KylarExpansion`，系统模块 `V.LifeSimulation`/`V.StreetLife`/`V.BirdTower`/`V.Finance`/`V.Transport`/`V.Orchard`/`V.VanillaPlus`/`V.CelestialAnomalies`；
  - **边界隔离（关键）**：全量 grep 实证模组**从不读写原版顶层** `V.rebellion`/`V.victories`/`V.self_rent`/`V.both_rent`/`V.rent_separated`（这些同名键只作为 `V.RobinExpansion` 内的模组自建副本）——适配器声明路径一律以模组模块根开头，绝不落到原版顶层键；测试 21.2 双断言（根键白名单 + 无原版同名根键/一级路径）；
  - **适配器**：`CHEAT_ADAPTERS["deadwood-reblooms"]`，探测点 `maplebirch.get("DeadwoodReblooms")`（框架根模块，关闭即停用全部子模块）；
  - **可操控项**：阶段 6（罗宾店铺开办 6 档/气球支线 4 档/收容所 3 档/医生游戏 0-2/校园职务 student-prefect-president/历史课题 4 档）+ 能力 11（反抗贝利路线/同盟/团结结局/贝利击败/店铺开张/家教开办/鲜鱼料理/便携烤架/免听凭证/贝利签署/鹰崽哺乳）+ 数值 18（摊位改造等级×2/反抗胜场/储备金/照护基金/气球胜场/家教课时/医生次数/店铺库存/雇员/街头口碑/公路赛胜场/完赛/金戒指 0-2/校园秩序/学生支持/教职支持/腐败值，均带钳制）；
  - **验证**：282 项断言调用回归全过（新增第 21 节 21 条：探测/分组/根键隔离/字符串枚举写入与越界拒绝/跳最高回退/数字阶段/能力/数值钳制/宿主缺失防崩/留痕回退）。
- **v1.4.2（2026-10-15 · DomRobin 适配）**：
  - **背景**：用户提供 `DomRobin.mod.zip`（DomRobin 0.0.8-for-dol-0.5.12.13，罗宾大型增强模组：约会/战斗/特质/工作/直播/摄影/送鱼/孤院海报等）要求适配 Mod作弊；
  - **探查**：解压至 `_domrobin_probe\`，通读 boot.json（name=DomRobin, version=0.0.8-for-dol-0.5.12.13）、robinModInject_early.js、robinModUtil.js、robinModSettings.js、robinTraitEffects.js、DomRobin_maplebirch_leaf.js/.twee、balloonStand.js、liveStream.js、widgets.twee 等，盘点全部 `V.`/`$` 状态键归属；
  - **边界隔离（关键）**：DomRobin **大量复用 DoL 原版罗宾线变量**（robinpaid/renttime_fight/robinShouldPayBack/lemonadeUpgraded/chocolateUpgraded/robinPayBothNote/robinPaySelfNote/robinCouldPayBoth/robinCouldPaySelf/robinSoldConsole/robinfirstrentfight/robinconsole/robinconsolelost 等）——适配器**一律不声明**这些键，只暴露确凿模组自建键，杜绝把原版数据渲染到 Mod作弊 页；
  - **适配器**：`CHEAT_ADAPTERS["dom_robin"]`，探测点 `window.modUtils.getMod("DomRobin")`（ModLoader 已加载模组注册表，模组卸载即消失）；
  - **可操控项**：阶段 1（直播周数 `$liveStreamStage` 0–6，作者在模组言灵提示中明示可改）+ 能力 12（反抗战斗谈话/共同战斗完成/共同还债谈话/自还债谈话/花环谈话/直播同意准备/谈过一起直播/一起直播 + 4 项还钱进度：柠檬水摊/直播设备/巧克力摊升级/巧克力摊改造，均 boolean）+ 数值 3（反抗链打赢次数 0–99、直播开关 0/1、柠檬水摊新商品列表 popcorn/snack/balloon/flower）；
  - **验证**：261 项断言调用回归全过（新增第 20 节 18 条：探测/分组/原版罗宾线隔离/数字阶段写入跳最高回退/能力布尔/数值钳制/列表追加移除（on:false）/留痕回退删除叶子/无 modUtils 不出现）。
- **v1.4.1（2026-10-15 · 归途之书（默示录）适配）**：
  - **背景**：用户实测 Mod作弊 时加载「默示录：归途之书 v1.3.1」modpack 未识别到内容——该 modpack 为 **dol-mod-protection-tools 加密**（auth-loader + .crypt，明文不可读）；用户随后提供源码包 `Revelation-The-Book-of-Return-1.3.1.zip`，据源码静态分析补内置适配器（不做任何解密）；
  - **适配器**：`CHEAT_ADAPTERS["revelation-the-book-of-return"]`，探测点 `maplebirch.get('RobinTemple'/'TempleChoir')`（框架模块注册，模组卸载即消失）；状态键 `V.RobinTemple`（罗宾神殿路线）、`V.TempleChoir`（唱诗班），均由 Module.preInit 的 `:variable` 钩子写入默认状态（已实证源码）；
  - **可操控项**：阶段 5 项（路线 stage 七档字符串枚举：未开始/受邀/已预约/失败/成员/已批准/已承诺；秘密誓言调查阶段；亵渎仪式 0–7 数字阶段；守夜结果；信仰带）+ 能力 6 项（唱诗入团/领唱资格/挂坠/第二份誓约/评估通过/圣带装备）+ 剧情 1 项（祷告事件：跳过=resolved / 强制完成=done / 重置进度）+ 数值 8 项（歌唱熟练度 0–1000、弥撒/练习次数、待领津贴、服务贡献、恩典 0–100、守贞计时 0–30、评估加分 0–15，均带钳制）；
  - **执行器扩展（v1.4.1）**：`setCheatStage` 支持**字符串枚举阶段**（levels 元素为字符串时写枚举值，越界拒绝保持幂等），数字阶段行为不变；渲染层下拉已通用无需改动；
  - **隔离**：适配器只声明模组自建键（`RobinTemple.*`/`TempleChoir.*`），绝不暴露原版神殿变量 `temple_rank`/`templePromised`/`temple_chastity_timer` 等；
  - 243 项断言调用回归全过（新增第 19 节 21 条：探测/分组/原版隔离/字符串枚举写入与越界拒绝/跳最高回退初始/数字阶段/能力/数值钳制/祷告剧情三动作/宿主缺失防崩/留痕回退）。
- **v1.4.0（2026-10-15 · 新增第 6 主页面「Mod作弊」）**：
  - **定位**：顶部导航新增与「角色/阶段/剧情/场景/全局」平级的第 6 个入口「Mod作弊」，专控**第三方模组新增内容**；DoL 原版全部内容依旧走原有五大面板，本模块**完全不处理原版变量**（内置原版一级键过滤清单，命中即拒）；
  - **页面结构**：主容器页只展示已识别模组列表（`▶ 模组名`），点击进入该模组独立子页面；子页面标题标注来源模组名，四分组控件——① 模组新增任务（跳过/直接完成）② 模组新增阶段&能力（阶段等级下拉/跳最高/回初始、能力勾选启停）③ 模组自定义剧情（跳过/强制完成/重置进度）④ 自定义数值修改（变量名+输入框+应用，含类型校验与越界钳制）；无可用模组时兜底提示「⚠ 暂未识别到可控制的第三方模组拓展内容，请加载对应模组后重试。」；
  - **动态发现三通道**：注册制 `setup.mbCE_modCheats = [...]`（外部模组按约定格式自注册可操控项）→ 内置适配器 `CHEAT_ADAPTERS`（内建 detect 探测）→ 被动探测 `CHEAT_PASSIVE_PROBES`；每次渲染面板/切换时重扫，新增模组自动出现，无需硬编码；
  - **防崩与幂等**：写入前校验父级对象链（缺失即拒，绝不写 undefined）；数字校验 isFinite + min/max 钳制、布尔归一化、字符串数组列表型（list）追加/移除；原版变量/未声明项一律拒绝并页面提示；
  - **操作留痕**：所有修改记入 `V.mbCE_wrote`（key=`cheat:模组ID:操作:条目`，含 modId/op/path/before/after/t），每项控件带「回退」按钮，还原首次面板写入前状态，二次回退拒绝；
  - **内置适配器（首版）**：More Love Interests Mod 0.1.7.0——探测键 `setup.foodPreference`（模组无条件注入，卸载即消失），可操控项：扩容恋人列表 `$loveInterestList`（11 槽，勾选候选 NPC 加入/移出，模组自身的条件剔除逻辑如 Remy/Black Wolf/Avery 由模组 widget 照常执行）；`$loveInterest.primary..undecimal` 由模组 widget 从列表自动重建，面板不直接写；
  - 222 项断言调用回归全过（新增第 18 节 35 条：动态扫描/标准化/子页面隔离/父级缺失防崩/原版过滤/数值钳制/布尔归一/留痕结构/回退/任务跳过完成/阶段钳制跳级回退/能力启停/剧情三动作/列表追加移除回退/适配器探测与写入/重扫）。
- **v1.3.5（2026-10-15 · 格威岚场景直达崩溃闭环）**：
  - **现象**：新存档（只装框架 + 本 MOD）在场景直达页点「格威岚 · 花园与森林商店」直达后，多瑙河街/花园段落报 `<<if>>: bad conditional expression ... reading 'includesAny'`（`<<if _gwylanStatus.includesAny("wounded", "scarred")>>`）与 `reading 'tail'`（`<<if ... _gwylanTF.tail isnot "revealed">>`）；
  - **根因（已实证本体源码）**：`Gwylan Ritual Start Garden` 等格威岚段落开头靠 `<<run statusCheck("Gwylan")>>` 初始化临时变量 `T.gwylanStatus`/`T.gwylanTF`（即 Twee 里的 `_gwylanStatus`/`_gwylanTF`）；但本体 `statusCheck` 仅在 `C.npc.Gwylan.init === 1` 时才调用 `gwylanStatusCheck()`——新存档未见过格威岚时 init 为 0 → 两个临时变量**完全不初始化**；且 `gwylanStatusCheck()` 在 `V.gwylanTalked/V.gwylanSeen/V.gwylan` 缺失时早退，**只设 `T.gwylanStatus=[]`、不设 `T.gwylanTF`** → 段落无条件读 `_gwylanStatus.includesAny(...)` / `_gwylanTF.tail` 即崩；
  - **修复**：新增 `ensureGwylanSceneState()` 幂等兜底——`T.gwylanStatus` 缺失时用本体公式刷新（本体 `gwylanStatusCheck` 优先，缺失时内置公式副本兜底），`T.gwylanTF` 缺失时补默认隐藏态四字段（`ears/tail/fangs/known`），**已有值绝不覆盖**；挂在 `:passageinit` 全局钩子（`mbCEOnPassageInit`）上，任意段落进入时先行补齐，覆盖场景直达/固定触发/场景查看器等全部入口（含框架改段落名、宿主段落内嵌格威岚内容的渲染路径）；导出 `api.ensureGwylanSceneState` / `api.isGwylanGardenPassage`；
  - 新增断言：新存档兜底补 status 数组 + TF 默认四字段、已有值不覆盖幂等、模拟段落 `includesAny`/`tail` 读取不再崩、任意段落（Danube Street）经 passageinit 兜底、场景查看器段落逻辑不回归。
- **v1.3.4（2026-10-14 · 睡觉 farm_stock 结算崩溃闭环）**：
  - **现象**：孤儿院（Deadwood Reblooms）等场景睡觉时报 `<<farm_stock>>: errors within widget code (<<set>>: bad evaluation: TypeError: Cannot read properties of undefined (reading 'truffles'))`，报错链 `<<sleep>> → <<sleephour>> → <<pass>> → <<farm_stock>>`；
  - **根因（已实证本体源码）**：`$farm.stock`（truffles/eggs/milk/cream 四字段）**仅由本体 `<<farm_stock_init>>` 在"共享农场"剧情节点（Farm Fight End Accept/Refuse）初始化**；一键解锁恋爱阶段把 `$farm_stage` 直接置高后 `$farm` 未走本体农场线初始化，v1.3.1 起的 `ensureFarmState()` 空壳覆盖了 beasts/wage/clearing/milking/build_finished，**漏了 `stock`** → 睡觉跨午夜本体 `dailyFarmEvents` 等路径调 `<<farm_stock>>`（`$farm.stock[_args[0]] += n`）读 undefined → 崩；报错 `reading 'truffles'` 而非 `'stock'` 印证 `$farm` 存在但缺 `stock`；
  - **修复**：`ensureFarmState()` 空壳与残缺分支同步补齐 `stock: { truffles: 0, eggs: 0, milk: 0, cream: 0 }`（对齐本体 `farm_stock_init` 结构，已有值绝不覆盖）；写入 farm_stage / globalRomance / 启动兜底等全部 5 个调用点自动生效；
  - 179 项断言调用回归全过（新增：空壳含 stock 四字段、缺 stock 补全且不覆盖已有值、模拟 `<<farm_stock>>` 累加路径不抛错）。
- **v1.3.3（2026-10-14 · 艾弗里庄园聊天崩溃闭环）**：
  - **现象**：场景直达解锁艾弗里庄园后，与艾弗里聊天（`Mansion Talk`）崩：`<<avery_daily_talk>>` 报 `reading 'chat'`、`reading 'ignore'`，连锁「The passage Mansion Talk has no usable links」；
  - **根因（已实证本体源码）**：本体 0.5.5.5 后 `$daily.avery` 由艾弗里线入口建为 `{}`，`talk`/`ask` 子对象在**使用点**才初始化（`avery_daily_talk` 只检查 `$daily.avery.talk.chat is undefined`——`talk` 整体缺失时访问 `talk.chat` 即崩，`Mansion Talk` 读 `$daily.avery.talk.ignore` 同理）；MOD 直达前空壳仅覆盖「`daily.avery` 整体缺失」，**未补 `talk` 子对象残缺** → 直达/世界入口进庄园即崩；
  - **修复**：`ensureAveryMansion()` 改为**逐层补齐**——`daily.avery` 缺失时建完整结构，已存在但 `talk`/`ask`/`housekeeping_events` 缺失时逐个补齐（含 ignore/limit/flirt/seduce/annoyed/chat/chat_limit 完整字段），绝不覆盖已有值；`init()` 启动兜底新增 `ensureAveryMansion()`（世界入口进庄园、不经过直达/触发的路径也覆盖）；导出 `api.ensureAveryMansion`；
  - 176 项断言调用回归全过（新增：`daily.avery` 存在但 `talk` 缺失 → 补全 talk、talk/ask 已有值不覆盖幂等断言）。
- **v1.3.2（2026-10-13 · 社交崩溃根因闭环）**：
  - **根因实证**：社交界面崩溃（孤儿院/多瑙河街 `reading 'beasts'/'aggro'/'states'`）的直接触发路径确认为**「全局页（或角色页）一键解锁恋爱阶段」**——MOD 按 Maplebirch 注册的条件源码解析并写入变量，亚历克斯（Alex）的农场阶段条件会把 `$farm_stage` 直接置高（绕过本体农场线入口初始化），但 `$farm` 对象不会随之建立 → 之后进任何含 `<<social>>` 的段落即崩；
  - **修复**：`applyRomanceFix` 在写入 `farm_stage` 的瞬间立即调用 `ensureFarmState()` 补 `$farm` 空壳（同会话内点按钮后不再崩）；`globalRomance` 一键完成后再次兜底（双保险）；
  - 174 项断言调用回归全过（新增：一键完成亚历克斯农场阶段后 `$farm` 自动建空壳、`globalRomance` 全角色一键后 `$farm` 兜底断言）。
- **v1.3.1（2026-10-13 · 实测修正）**：
  - **修复社交界面崩溃（孤儿院/多瑙河街等含 `<<social>>` 的段落报 `reading 'beasts'/'aggro'/'states'`）**：实证本体社交页在 `$farm_stage gte 2` 时无条件读 `$farm.beasts`（马/猪/牛/狗敬重值）与 `$farm.aggro`（雷米入侵度）；旧存档若 `farm_stage` 已推进但 `$farm` 整体缺失（早期版本触发农场剧情置高 `farm_stage` 但未走本体农场线初始化），进社交界面即崩。新增 `ensureFarmState()` 幂等兜底：按本体农场线初始化结构（beasts 四类 / wage / clearing / milking / build_finished）在 **`farm_stage >= 1` 且 `$farm` 缺失/结构残缺时**补空壳，绝不覆盖已有进度；启动、场景直达、固定触发前均调用；
  - 172 项断言调用回归全过（新增农场兜底建壳/幂等/缺字段修补/未推进不建/传送联动断言）。
- **v1.3.0（2026-10-13）**：
  - **场景直达 = 永久解锁 + 世界内可进入**：点「直达」即解锁对应场景组，并写入原版世界入口条件（已实证本体源码）——凯拉尔庄园 `syndromekylar=1`（多瑙河街出现 "Kylar's manor" 入口）、孤儿院阁楼 `loft_known=1`（孤儿院大厅出现阁楼入口）、艾弗里庄园由庄园状态兜底自动解锁（多瑙河街出现 "Avery's mansion"）、西里斯成人商店 `adultshopstate="open"`（营业时段可接近）；固定触发联动解锁同步写入世界入口；场景页显示入口位置提示；
  - **格威岚场景扩充**：场景页格威岚组由"花园"扩展为"花园与森林商店"，纳入全部格威岚段落（恋爱/仪式/接生各阶段）；
  - **剧情页线合并**：剧情线默认收起（如亚历克斯农场工作 3–12 阶段合成一行），点「固定整线」把全线按顺序入队依次触发、触发完自动停止；点「展开各阶段」可查看/操作单阶段；
  - **修复固定触发无限循环**：本体 `Scene Viewer passages` 段落的 `<<switch $sceneViewSwitch>>` 无条件播放 case，剧情结束链回会再次命中 → 循环。现固定触发通过 `mbCE_replayOnce/Pending` 标记 + 段落初始化拦截：首次进入正常播放，剧情结束链回时清 `sceneViewSwitch` 走原版 default 退出通道，不再重播；
  - **修复取消固定后被困播放器**：取消固定（含正在重放时）同步清 `replayScene` 与 `sceneViewSwitch` 并返回原位，不再卡在剧情播放器；
  - 167 项断言调用回归全过（新增世界解锁写入/幂等、重放循环拦截、取消防困、固定整线、农场连续推进、格威岚扩展断言）。
- **v1.2.1（2026-10-13 · 实测修正）**：
  - **场景直达/传送修复**：实测确认 SugarCube 2.36.1 的 `Engine` 位于 `window.SugarCube` 命名空间（`Object.defineProperty(window,"SugarCube",{value:...Engine:Engine...})` 密封对象），**不在 `window` 顶层**——直达改为三通道探测（`window.Engine` → 全局 `Engine` → `window.SugarCube.Engine`），页面内直达恢复可用；
  - **农场剧情防崩**：亚历克斯农场剧情（`Scene Viewer passages` 入口 + `<<farm_work_update>>` 初始变量）在 `$farm` 未初始化时播放会触发本体 `farm_work_update` 内 `V.farm.clearing -= 1` 崩溃（游戏弹 `setting 'clearing'` 报错）。现固定/触发前检查 `$farm` 状态：未初始化 → 拒绝固定（明确提示先推进到农场线）；已固定项在触发时同样拦截，不再崩游戏；
  - **艾弗里庄园/森林商店防崩**：实测直达/固定触发进入 `Mansion Bedroom`、`Forest Shop Entrance` 等段落时，因 `$avery_mansion`（艾弗里庄园状态对象）被本体**延迟初始化**（进入艾弗里线才建）而在新档缺失，本体 widget 无空检查直接读 `V.avery_mansion.schedule/jobs/party_state/folder/study_unlocked/landry` 及 `$avery_tower.stage` → 大量 `reading '...'` 崩溃。现按本体 `avery_mansion_init` 的纯字面量结构，在直达/触发前做**幂等空壳兜底**（仅对象缺失时写入，绝不覆盖已有进度，跳过服装/古董子 widget 避免副作用）；
  - 166 项断言回归全过（新增 SugarCube.Engine 通道、农场防崩固定/触发拦截、艾弗里庄园兜底与幂等断言）。
- **v1.2（2026-10-13）**：
  - **固定触发重做为「队列 + 一次性」**：可固定多条剧情，按固定顺序依次触发；触发完成后自动停止，不再无限重复；旧版单固定（v1.1 `mbCE_pinned`）存档自动迁移（视为已触发过，不再触发）；
  - **场景联动解锁**：触发某角色剧情完成后，其所在场景组自动解锁（如触发凯拉尔剧情 → 凯拉尔庄园解锁可直接直达）；
  - **场景页精简**：每组只显示主场景一条（副场景段落计入统计不逐条列出），直达按钮保留；
  - **场景直达修复**：`Engine.play` 双通道探测（`window.Engine` → `Engine`），失败时报含诊断信息；
  - **阶段回退**：阶段页已达成条目新增「回退」按钮，只撤销面板写入的标记（依据写入痕迹），真实达成的进度拒绝回退；
  - 158 项断言回归全过（新增队列/一次性/解锁/精简渲染/回退断言）。
- **v1.1（2026-10-13）**：
  - **修复段落枚举**：SugarCube 2.36.1 已移除 `Story.passages` → 统一走 `listAllPassages()`（`Story.lookupWith` 主路径 + 旧版 `Story.passages` 兼容）。修复后「场景」页 6 组场景全部恢复直达，「剧情」页恢复读取 Scene Viewer 场景注册表；
  - **剧情文本实体反转义**：`&lt;&lt;...&gt;&gt;` 转义形态的 widget 文本同样可解析（对应本体 HTML 实际存储形态）；
  - **新增「固定触发」**：剧情页每条剧情（含 MOD 注册场景，如罗宾神殿剧情）新增「固定触发」按钮——下次推进剧情（遇见该角色）时自动进入该剧情；顶部横幅或条目「回退」恢复原版随机触发。复用原版 `$replayScene` 重放通道 + `freezePlayerStats`，重放期间自动禁存、结束时自动解冻返回原位，零副作用；
  - 97 项断言回归 + 15 项新增断言全过。
- v1.0 为**正式发布版**（此前 v2.4→v2.7.1 为迭代开发版）。本次仅将版本号规范为 1.0，并完成下列安全核验（结论见下）。
- 功能全集：角色一览 / 恋爱阶段（含格威岚原版 7 阶段）/ 扩展转化 / 剧情（场景查看器注册表）/ 场景直达 / 全局一键。

## 安全核验（v1.1，逐项实测）

| 检验项 | 方法 | 结果 |
|---|---|---|
| boot.json 结构 | 对照官方 ModBootJson 规范逐字段核验（含 `scriptFileList_inject_early` 阶段字段） | ✅ 通过 |
| 包内条目存在性 | 解压回读：boot.json / README.md / javascript/maplebirchce.js / twee/maplebirchce-widget.twee 全部存在，条目路径为正斜杠 | ✅ 通过 |
| 依赖满足 | ModLoader ≥2.0.0（用户框架 2.101.1 ✓）、GameVersion ≥0.5.12.13（本体 ✓）、maplebirch ≥5.4.2（框架 ✓） | ✅ 通过 |
| JS 语法与自检 | `node --check` + 112 项单元断言（含框架缺失容错、重复执行幂等、超上限钳制、段落枚举修复、固定触发链路） | ✅ 全过 |
| 加载无副作用 | 整个脚本为 IIFE 闭包；加载时仅：读取框架引用、挂载 `setup.mbStageCE` 新键（不覆盖任何本体 setup 键）、构建悬浮按钮 DOM；**不写任何存档变量** | ✅ 通过 |
| 不覆盖本体 | 无 `Macro.add` / 无 `eval` / 无 `saveGame` 覆盖 / 无 localStorage 写入；仅调用本体现成函数（`gwylanStatusCheck`、`Engine.play`、`Story.has`，均带存在性保护） | ✅ 通过 |
| 变量写入边界 | 所有存档写入（恋爱 flag、`$scenes` 经历、跳转位置）都发生在**用户点击按钮时**，且均为本体现成键；加载与页面刷新路径零写入 | ✅ 通过 |
| 与本体 0.5.12.13 兼容 | 6 个场景组前缀在 0.5.12.13 段落中全部实证匹配；`robinromance`/`gwylanStatusCheck`/`scenePassages`/`setup.locations` 等键本体存在；MOD 专属键（lunaSeen 等）本体缺失时功能自动降级，不误触本体 | ✅ 通过 |
| 异常路径 | 框架未加载、角色缺失、段落不存在、条件不可解析 → 仅提示不抛错，不炸档、不阻断游戏 | ✅ 通过 |

## 功能总览

- **角色页**：动态枚举 Maplebirch 注册池（本体 + 全部 MOD 角色），显示爱意/支配/情欲/警戒与活跃状态，点击进入阶段页。
- **阶段页**：恋爱条件逐条求值（绿=已达成 / 红=未达成，附中文条件说明）；一键完成=先补齐数值到门槛再激活阶段 Flag，规避框架自动校验重置；内置数值 ±10 调整。
- **剧情页**：实时解析 Scene Viewer 场景注册表（`$scenes`），自动按数字后缀聚类成剧情线分阶段，绿/红/黄状态 + 一键完成；**每条剧情可「固定触发」**（下次推进剧情即自动进入该剧情）+「回退」恢复原版触发。
- **场景页**：6 组特殊场景直达（孤儿院阁楼 / 凯拉尔庄园 / 悉尼神殿 / 西里斯学校与商店 / 艾弗里庄园 / 格威岚花园），按前缀动态枚举段落、主从分组、中文语义提示、一键跳转。
- **全局页**：全部角色一键补齐数值、一键解锁全部恋爱阶段、一键解锁全部转化阶段。

## 本版变更（v1.2 · 固定触发队列 + 场景联动解锁 + 阶段回退）

- **固定触发重做（队列 + 一次性）**：剧情页「固定触发」现可连续固定多条剧情（`V.mbCE_queue` 队列），按固定顺序依次触发（先固定先触发）；触发一次后该剧情标记 `used` 并自动移出队列，**不再无限重复**。重放结束（进入 `Scene Viewer End`）自动清理已触发项并推进到下一固定项；
- **兼容迁移**：v1.1 旧存档中的单固定 `mbCE_pinned` 自动并入队列并标记为已触发（不再重复触发），无需手动处理；
- **场景联动解锁**：固定剧情触发完成后，自动把剧情所在场景组写入 `V.mbCE_unlockedPlaces`（存档持久）——如触发凯拉尔剧情 → 凯拉尔庄园组解锁；场景页对应组显示「已解锁 ★」并可直接「直达」；入口段落为 Maplebirch `SV xxx` 形态时自动剥离前缀匹配，剧情包含段落兜底匹配；
- **场景页精简**：每组只显示**主场景一条**（含直达按钮），副场景段落只计入组头段落统计、不再逐条列出（此前全量列出 1073 条）；
- **场景直达修复**：`Engine.play` 双通道探测（`window.Engine` → 全局 `Engine`，带诊断报错），页面内直达不再报「Engine 不可用」；
- **阶段回退**：阶段页恋爱阶段（框架恋爱 + 格威岚原版 7 阶段）已达成条目新增「回退」按钮——只撤销面板写入的标记（写入痕迹记录在 `V.mbCE_wrote`，set→删除变量、append→数组/槽位移除、原版经历→`gwylanSeen` 移除对应标记、state 关系状态类不回退）；**玩家真实达成的阶段（无面板写入痕迹）拒绝回退**，保护真实进度；
- **回退安全边界**：回退仅作用于面板「一键完成」写入过的键，`loveInterest` 恋人槽位、`gwylanSeen` 经历标记等均按痕迹精确撤销；爱意/支配/情欲等真实数值属性不回退；原版**状态型**阶段（欲望/发情/孕育意愿）由原版状态机实时计算，回退会连带删真实前置进度，一律拒绝（可先回退前置 seen 型阶段使其自然回落）。

## 本版变更（v1.1 · 段落枚举修复 + 固定触发）

- **修复「场景」页 0 段落**：SugarCube 2.36.1 已移除 `Story.passages` 属性（返回 undefined → 枚举静默为空）。统一改为 `listAllPassages()`：优先 `Story.lookupWith` 全量枚举，旧版 `Story.passages` 仍兼容。修复后 6 组场景（孤儿院阁楼 / 凯拉尔庄园 / 悉尼神殿 / 西里斯 / 艾弗里庄园 / 格威岚花园）按前缀恢复全部段落与「直达」；
- **修复「剧情」页注册表读取**：同一段落枚举修复 + 新增 Twee 文本实体反转义（`&lt;&lt;widget "scenes"&gt;&gt;` 转义形态同样解析），`$scenes` 注册表恢复实时解析——**MOD 场景（含《默示录：归途之书》罗宾神殿剧情，若注册进场景系统）自动出现**；
- **新增「固定触发」**：剧情页每条剧情（剧情线各阶段 + 独立场景）新增「固定触发」按钮——设置后下次推进剧情（遇见该角色）即自动进入该剧情并重放；页面顶部显示固定状态横幅；「回退」取消固定、若正在重放则立即解冻返回原位；
- 实现完全复用原版 `$replayScene` 重放通道（`<<setupReplayScene>>` 同款：先执行场景初始变量 `manualVariableChanges` → `freezePlayerStats` 冻结 → 设 `$replayScene` → 重定向入口段落），场景内段落正常播放、离开场景自动结束并返回原位；重放期间原版自动禁存（`Config.saves.isAllowed`），零副作用、不覆盖任何本体键；
- 钩子挂载：`:passageoverride` 事件（与本体 Scene viewer redirect 同一事件链，优先级一致），仅在**已固定且未在重放中**时干预；
- **角色译名按 ModI18N 汉化补齐/统一**：新增 Morgan→摩根、River→瑞沃、Sirris→西里斯、Night Monster→夜魔；统一 Alex→艾利克斯、Jordan→约旦、Leighton→礼顿、Wren→伦恩、Briar→布莱尔、Sam→萨姆、Charlie→查里、Quinn→奎恩、Niki→尼奇（与游戏内汉化一致）。

## 本版变更（v2.6 · 特殊剧情页）

- **新增「剧情」标签页**：读取 DoL 游戏本体的**场景注册表**（Scene Viewer / `$scenes`）——不是硬编码，是从 Story 文本实时解析 `<<widget "scenes">>` 的注册表（MOD 经 TweeReplacer / ReplacePatcher 改写的场景同样自动解析到）；
- **自动分阶段**：场景键带数字后缀的剧情线自动聚类（如罗宾变装线 `RobinCrossdressing1~6` → 一条剧情线 6 个阶段；亚历克斯农场线 `AlexFarmWorkStage3~12` → 一条线逐阶段），每个阶段单独显示绿（已达成）/红（未达成）/提示；独立场景单列；
- **解锁条件实时求值**：每个场景的 `unlocked` 表达式（`$scenePassages.includes(...)`、比较、三元等 twee 语法自动翻译）按当前存档实时判定，不受 `$scenes` 惰性缓存影响；
- **一键完成**：自动把解锁条件引用的场景键、入口段落、全部剧情段落写入 `$scenePassages` 经历表，再复检解锁状态；互斥/依赖运行时状态（如 `lockedMessage` 的互斥提示）会如实显示原因；
- 说明：若剧情 MOD（如启示录《默示录》）把剧情注册进场景系统，装好后本页自动出现；若它是纯独立变量剧情（未注册场景），则不在本页（也无法预读加密包）——可后续按需做变量级适配。

## 本版变更（v2.5 · 5 个剧情 MOD 逐一适配）

针对你上传的 5 个剧情 MOD 逐包分析后的适配（未硬编码任何角色，全部走通用机制）：

- **Wraith'sReflection（怨灵）**：该 MOD 用 Maplebirch 注册角色「Ivory Wraith」，恋爱条件为**变量在左的反向比较** `V.WraithsReflection === 1`——条件解析器已覆盖该形态，一键完成会写入该剧情 Flag；译名「怨灵」。
- **人物附加与生活质量提升（阿电）**：阿电走 **DOL 原生 NPC 注册**（`V.NPCName`），不在 Maplebirch 池内。新增**原生恋爱 NPC 兜底**：框架无条件时，对有恋爱标记（`setup.loveAlias` / `T.npcConfig.loveInterest` / 已出现在 `V.loveInterest` 槽位）的角色自动生成通用「恋人（loveInterest 槽位）」条件，一键完成写入恋人槽（数组/对象槽位均兼容）；译名「阿电」。
- **兔子/人鱼扩展转化（同 MOD）**：该 MOD 的转化系统不注册 `setup.transformations`。新增**扩展转化检测**：检测到公共 API `setup.myTFSet` 时，自动读取 `V.transformationParts` 中非原版注册键的转化（兔子/人鱼），显示成长值/阶段并支持一键完成（调用 `setup.myTFSet(name,3)`，内部同步部件与 build）。
- **MuYuNi（牧场与你相识的故事）**：纯牧场玩法 MOD，无 Maplebirch 恋爱角色，无需适配（面板自动不受影响）。
- **默示录：归途之书 / 枯木逢春**：**Maplebirch 授权加密包**（`maplebirch-auth-loader.js` + `.crypt` 运行时解密）。内容无法（也不应）预读，但面板是方案A动态枚举——**装进游戏后注册池里出现即自动识别**，无需预先适配。

## 本版变更（v2.4 · 条件中文说明）

- 每条恋爱条件下方自动附**中文说明**，直接告诉你"已达成 = 达成了什么"（如 `auriga_artefact` → 已获得/触发「御夫座神器（艾弗里线剧情节点）」；`"dismissed"!==...state` → 角色「艾弗里」当前状态不是「已辞退」）；
- 支持常见条件形态：裸真值变量、`=1` 置位、`≥N` 数值门槛、`state` 状态比较、`xxxSeen.includes(...)` 事件经历、`undefined===` 事件未触发、**反向 `var === 1`**、**`loveInterest.includes("角色")` 恋人槽位**；状态值/角色名/变量名全部中文；
- 展示层翻译（TERM_CN 词典 + 模式解析），未识别到的条件仍显示原始引擎代码，不影响任何逻辑。

## 本版变更（v2.3 · 原版公式内置兜底）

- 原版恋爱阶段不再依赖 `window.gwylanStatusCheck` 是否存在：检测条件放宽（角色为格威岚且有 `V.gwylanSeen`/`V.gwylan`/运行时对象即启用）；
- **内置原版公式副本**：原版函数存在时优先调用，缺失时按游戏 0.5.12.13 同一公式自算 lust/heat/wantsPregnancy（含怀孕判定容错），任何环境下 7 阶段都能显示与一键完成。

## 本版变更（v2.2 · 完整恋爱阶段）

- **新增原版恋爱阶段系统（格威岚 7 阶段）**：完全对齐游戏原版 0.5.12.13 的 `gwylanStatusCheck` 源码——
  ① 仪式之约（完成一次仪式性爱）
  ② 渴望 Yearning（爱意≥65% + 支配≥20 + 情欲≥40，非警戒 → 收信）
  ③ 欲望 Lust（爱意≥75% + 支配≥50 + 情欲≥30 + 支配+情欲≥90）
  ④ 恋人（成为恋人）⑤ 永远（步入永远）
  ⑥ 发情 Heat（恋人 + 支配≥100 + 情欲≥40 + 支配+情欲≥160）
  ⑦ 孕育意愿（爱意≥90% + 支配≥140 + 发情，双方未怀孕）
- 每个阶段一键完成 = 先补齐数值到官方门槛（格威岚爱意按原版自动重算：解锁森林套装 + 补「已聊」）→ 再激活阶段事件（`V.gwylanSeen`）→ 调用原版 `gwylanStatusCheck()` 刷新实时状态（规避自动校验重置）；
- 角色译名修正：格威岚（Gwylan），并补全常用角色中文名（未收录的 MOD 角色自动显示原名）。

## 本版变更（v2.1 · 界面中文化）

- 角色人名全部显示中文（罗宾、惠特尼、凯拉尔、悉尼、伊甸、艾弗里、黑狼、巨鹰、亚历克斯、格维兰…未收录的 MOD 角色自动显示原名）；
- 界面符号中文化：右下角入口「解锁」（原 CE）、收起/关闭（原 −/×）、状态占位「就绪」、游戏状态中文（地牢/监狱/已辞退/稳定…）、转化类型中文（狼/哈比/狐/触手…）；
- 条件原文仍显示引擎变量源码（变量名无法翻译，仅供对照）。

## 本版变更（v2）

v1 用 `tweeFileList` 同时携带 `[script]` 与 `[widget]` 段落；部分 ModLoader 版本对 `.twee` 中 `[script]` 段落的编译不生效，导致面板不出现。v2 改为：

- 全部逻辑 → `javascript/maplebirchce.js`，经 `scriptFileList_inject_early` 加载（与 maplebirchFramework 本体 `dist/inject_early.js` 同一条加载链，最可靠）；
- Cheats 菜单入口 → `twee/maplebirchce-widget.twee`（`[widget]` 段落，保留可选入口；编译不成功也不影响右下角悬浮按钮）；
- 主入口始终是**右下角金色圆形 CE 悬浮按钮**（纯 JS 创建，不依赖 twee 编译）。

## 功能

- **方案A 全自动角色识别**：读取框架全局注册池（`maplebirch.npc`），自动枚举游戏本体全部角色 + 全部已加载 MOD 角色，零硬编码。
- **恋爱阶段自动解析**：逐条解析原生 `romanceConditions` / `Config.romance` 条件（数值比较 / 状态 / includes / 裸真值 / `[X+"Seen"]` 动态键），绿色已达成 / 红色未达成，显示条件原文。
- **一键完成**：先补齐数值至门槛 → 再激活阶段 Flag（规避框架 `sc()` 自动校验重置）。
- **数值 ±10**、角色级一键补齐数值 / 解锁全部恋爱与转化阶段、全局页全部角色批量操作。
- **容错**：框架未加载 / 角色缺失 / 条件不可解析（如 `hasSexStat`）时仅提示，不抛错、不炸档。

## 安装

1. 前置：已安装 [SugarCube 2 ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader)（≥2.0.0）、[maplebirchFramework](https://github.com/MaplebirchLeaf/SCML-DOL-maplebirchFramework)（≥5.4.2）、游戏版本 ≥ 0.5.12.13。
2. 游戏内按 `Alt+M` 打开 ModLoader → 「添加 / 移除Mod」→ 选择本文件 `MapleBirchCE.mod.zip` → 「添加旁加载Mod」→ 提示 Success 后**刷新页面**。
3. 若旧版 `MapleBirchCE`（v1）已在列表中：先「移除」它再导入 v2，避免同名单冲突。
4. 刷新后游戏右下角出现金色圆形 **CE** 悬浮按钮。

## 自检（验证是否加载成功）

游戏内按 `F12` 打开控制台输入：

```
typeof setup.mbStageCE
```

- 返回 `"object"` → 加载成功，按钮应在右下角；
- 返回 `"undefined"` → 未加载，打开 ModLoader 加载日志查看 error。

## 文件结构

```
MapleBirchCE.mod.zip
├── boot.json                      # ModLoader 清单
├── javascript/maplebirchce.js     # 全部逻辑（scriptFileList_inject_early）
├── twee/maplebirchce-widget.twee  # Cheats 菜单入口（可选）
└── README.md
```

依赖声明（boot.json `dependenceInfo`）：`ModLoader >=2.0.0`、`GameVersion >=0.5.12.13`、`maplebirch >=5.4.2`。
