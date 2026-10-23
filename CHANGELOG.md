# MapleBirchCE 更新日志

版本线记录（v1.8.4 起；更早版本历史见会话存档）。版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 字段。

## v1.9.0（2026-10-22）

**新功能：角色页按类型拆子页面（模组/恋爱/普通/持久NPC）+ 场景页新增「地点」子界面（地点阶段任务作弊区）+ 持久 NPC 收录（经理/校医/守卫囚犯等）**

- **角色页精细化（按类型命名子页面，全部按钮展开/收起，默认收起）**：模组角色 / 恋爱角色 / 普通角色 / 持久NPC 四组折叠区块（标题带数量，▸/▾ 点击展开收起，状态记忆持久化）。分类依据：持久NPC > 模组 > 恋爱 > 普通——持久 NPC 按 `allowed_npcs` 注册表实证判定（精确键或 `xxx_guard`/`xxx_inmate`/`saddled_steed` 角色族变体，"guardian" 前缀不误判）；原版命名 NPC 取 `setup.NPCNameList` 运行时清单（兜底内置 DoL 0.5.12.13 实证 32 人）；恋爱角色 = 官方恋人清单 `setup.loveInterestNpc`（10 人）+ 框架恋爱条件 + 框架 loveInterest 标记
- **持久 NPC 收录**：V.per_npc 实证枚举（只在存档已生成时出现）——经理（随机名显示"经理（Helen）"）、校医、黑客·米奇（name_known=1 用 V.mickeyName）、主教/左右侍、守卫四变体、囚犯、黑狗、皮奇、坐骑、内衣贼、艾利克斯父母、惠特尼姑/叔、惠特尼父母公寓；卡片显示爱意/支配/情欲/警戒（findNpcEx 直读 per_npc），阶段页数值 ±10/一键补齐走 per_npc 对象
- **场景页双层子界面**：「场景直达」/「地点」内层页签（状态持久化）。「地点」= 地点阶段任务作弊区，17 项原版阶段变量直改（max 全部来自 0.5.12.13 原版阈值实证扫描）：
  - 市政改造 5 项：town_projects.{road,diving,thicket,bridge,green}（0-5，宿主缺失自动建壳）
  - 农场：farm_stage（0-12，≥7 满足亚历克斯恋人条件）/ farm_phase（0-1）
  - 城市与公寓：flats_progress（0-2）/ adultshopprogress（0-22）/ loft_upgrade（0-7）/ brothel_machine_repair（0-4）
  - 机构与学校：temple_cloister_progress（0-1）/ temple_arcade_phase（0-4）/ asylumassessmentprogress（0-4）/ asylumPuzzleProgress（0-5）/ scienceprogression（0-4）/ scienceterrariumprogression（0-4）
  - 每行 −1 / +1 / 拉满（钳制 min/max），写入留痕 `V.mbCE_wrote["place:<path>"]` 可回退（还原首次写入前状态，before 为 undefined 则删字段）
- **数据层**：`placeStageWrite` 为五面板专用通道，绕过原版变量黑名单直写原版阶段键（farm_stage 等），嵌套宿主仅 town_projects 允许自动建壳
- **对外 API 新增**：charCategory / isVanillaNPC / isVanillaLoveInterest / isPerNpcRole / isLoveCharacter / perNpcDisplayName / displayNameEx / findNpcEx / renderCards / renderPlaces / PLACE_STAGE_GROUPS / placeStageRead / placeStageWrite / placeStageUndo
- **测试扩展（第 44 节 44.1-44.5）**：分类纯函数、持久 NPC 枚举、地点写入（建壳/钳制/黑名单绕过/留痕/回退）、DOM 四区块默认收起+点击展开+经理卡、场景页双层页签+道路拉满=5；同步修正 mkNode mock 的 textContent 语义（真实 DOM：设置 textContent 替换全部子节点）
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED、功能 E2E 全 PASS、zip 正斜杠、verifier 4/4；安装包与 SHA 见交付
- **（同日自查优化，不升版本）**：① 修复留痕语义 bug——`placeStageWrite` 二次写入把 before 覆盖为当前值，导致「建壳字段多次写入后回退」还原成上次值而非删除字段；改用 `"before" in prev` 保留首次写入前状态（44.7 新增断言覆盖：两次 +1 后 undo 删字段、既有值 3→5 后 undo 还原 3）；② 滚动保持补齐——renderCards/renderPlaces 重建后恢复 pane.scrollTop（对齐五巡 mods/特质区行为，长列表点击不跳顶）；③ 持久 NPC 变体键（saddled_steed/stray_guard）显示族中文名（坐骑/守卫），不再裸显英文键名；④ 测试补盲 44.6（地点步进 +1/−1 钳制、建壳回退删字段、placesTab localStorage 持久化恢复、变体名、空档不枚举 per_npc）+ jsdom 冒烟补角色页折叠/场景页双层页签真实 DOM 语义断言（按钮重渲染后重新查询，修正旧引用断言）
- **（第二轮自查优化，不升版本）**：⑤ 修复 cheatWriteValue/cheatWriteListValue 留痕语义——与地点通道同源的 before 覆盖 bug（叶子字段原本不存在时，二次写入把 before 覆盖成当前值，回退残留而非删除）；统一改为 `"before" in prev` 保留首次面板写入前状态（traitWriteValue 通道同源受益）；18.8 旧断言原依赖 bug 行为（score 首次不存在却期望还原 5）→ 修正为正确语义并补 18.8b 既有值还原；新增 44.8 测试覆盖 cheat 通道两次写入后 undo 删字段 + 既有值还原。17 个源码文件全量精读一遍，全链 5/5 绿
- **（第三轮自查优化，不升版本）**：⑥ 角色页收起组懒渲染——收起的分组不再全量渲染角色卡片 DOM（buildCharCards 收起不建卡片、展开补建、防重复补建），长角色列表收起状态下 DOM 开销归零；⑦ 模组特质数值可改——discoverModTraits 为字符串 has 模组特质生成 values（数字比较变量 gte/is/gt 非 NaN，仿原版编译逻辑），renderTraitRow 放开 isMod 限制，模组注入特质行同样渲染「改数值 / 回退」控件（写入走 player-self 留痕通道，traitWriteValue/undoCheatModValue 数据层零改动）；⑧ tools 目录卫生——55 个临时日志（_*.log / _head_blob*）清理不入库，scan_dol_vanilla 系列 / debug_dom44 / release_v190 / push_api_v190 共 19 个工具脚本按惯例归档进 git
- **测试扩展（第三轮）**：37.3c 数据层断言（模组特质 values 生成 / 数值写入 2000 / undo 还原 1000 / 相对值 +500 → 1500 再还原）+ E2E D3 点击级断言（模组特质行改数值按钮 / 输入框 / 点击写入 / 回退还原）；全链 build→syntax→smoke→regression→E2E 5/5 绿
- **（第四轮自查优化，不升版本）**：⑨ 修复 gt（严格大于）条件特质「获取后判定未获得」——traitWriteSatisfy 对 gt 与 gte/is 共用分支写 num，写后 `x > num` 恒 false，获取按钮显示已写但 traitOwned 仍 false（原版受影响：Purity Boost `$featsPurityBoost gt 0`、Bratty `$submissive lte 850 and gt 500`）；改为 gt 写 num+1 满足严格大于。新增 37.3d 断言（Purity Boost 获取写 1 + 判定已拥有 / 移除写 0 + 判定未获得 / Bratty 复合条件获取后已拥有）；全链 5/5 绿。另：git fetch 被断（github.com:443 网络波动），3 个本地 commit 仍未推送，待网络窗口

## v1.8.23（2026-10-22）

**十七巡：3 个模组适配器跟进新版（枯木逢春 2.4.4 / 归途之书 1.3.10 / 框架 5.5.3）+ 新增内容甄别补录 2 项**

- **检测与下载**：9 渠道检测 → 3 个更新；codeload 下载解压（dw244.zip 24.8 MB / rv140.zip 865 KB / fw553.zip 890 KB）到 `tools\_modcache\`
- **键存活全量校验（`_check_keys.js`/`_check_keys2.js`）**：rv140 59 条 + dw244 43 条声明路径全部存活——初检 10 条 MISS 均为引用形态差异（分段 `$A.B.C`/get 链/类实例），二次短键探测 + 源码上下文确认：faith_band/candidates/rite_round、fish_grill/balloon_wins、`RobinExpansion.doctor.count`（2.4.4 constants/robin.ts doctor 结构实证）、`StreetLife.races.wins/completed`（Races.ts RacesState defaults 实证）、`LifeSimulation.school.duties.completed` 全部存活，**无删改**
- **目录 diff**：两模组均无文件删除。枯木逢春 2.4.4 新增 `compat/DoLX/{Boot,Finance,Passages}.ts` + `script/ColdmoonHarbour.ts` + `twee/ColdmoonHarbour/{Combat,Encounter,Main,Widgets,Zephyr}.twee`（冷月港区域线）；归途之书 1.3.10 新增 `twee/WraithAftercare.twee`（怨灵安抚线）+ `twee/WraithRecovery.twee`（怨灵项链取回线）
- **新增内容甄别 + 补录 2 项**（按既有标准：只收持久化、语义清晰、改动安全、有作弊价值的键）：
  - 枯木逢春补录**「冷月港 · 泽菲尔线阶段」**（`MoreTransformations.harbour.zephyr.stage`，数字阶段 0-4：未开始/已问起/已谈交易/已找回货物/已付酬完成）——冷月港区域主进度，干净数字枚举，一键推进 2.4.4 新剧情线；其余 harbour.scene/event/mist/voice/spoke/exchanged/fighting 为流程中间态/布尔标记不入面板；`harbour.relics`（打捞旧物数）语义弱不收；ResidentBath 类（用户已明确不做）不重提
  - 归途之书补录**「怨灵 · 项链已归还」**（`RBR.necklace.returned`，能力开关）——1.3.10 取回/安抚线主开关（RBR.necklace 为 1.3.9 已有对象，本次扩展为完整归还→取回→安抚循环）；aftercare/stage/attemptDay/confidants/dreamChoice/retaken 为流程状态机/日期戳/数组，写入易被条件重置，不收
- **框架 5.5.3 API 核对（check_framework_api.js）**：源码 zip 无 inject_early.js → 照 5.5.2 先例从 release 资产下载 mod zip（383,752 B，size 核对一致）解压 `dist/inject_early.js` 核对——核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists / define / frameworkNotice）；`setup.MapleBirch` / `maplebirch.patch` 缺失与 5.5.2 同因无害（CE 0 次调用 patch；setup.MapleBirch 仅 resolveMB() 兜底，主路径存在时不触发）→ declOverride 5.5.2 → 5.5.3
- **适配器声明**：归途之书 modName v1.3.9 → v1.3.10（abilities 21→22）；枯木逢春 modName 2.4.3 → 2.4.4（stages 8→9）；两处 note 标注新内容来源
- **（同日自查，不升版本）**：cm_zephyr note 文案修正——原「阶段 4 = 泽菲尔收到打捞货物并结清 8000/12000 酬金」经 2.4.4 源码实证不实（酬金在结算 passage 内发放，写 4 跳过发钱；泽菲尔对话入口需 `harbour.ship` 船 + `Zephyr.init` 前提）→ 改为「阶段 4 = 泽菲尔线完成态（对话与酬金结算需船 harbour.ship 与泽菲尔登场 Zephyr.init 前提，写 4 仅推进阶段、不代发酬金）」；21.10 注释「越界拒绝」→「越界钳制」（对齐断言实际语义）；21.2 注释补 Finance/MoreTransformations 根键；另核 nkl_returned 语义正确（等效原版 Wraith.twee:180 归还动作，梦线/倾诉线入口开放，`_ivorySafe` 前提与 CE 父级写入前提一致；1.3.10 五模块同捆注册，探测无盲区）
- **测试同步**：test_mce 19.1（能力 22）/21.1（阶段 9）/31.1（1.3.10）/32.1（2.4.4）+ 21.2 根键白名单 + MoreTransformations + 新增 21.10（泽菲尔阶段写入 4/越界钳制）/31.11（项链归还启用/禁用）断言
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED、功能 E2E 全 PASS、zip 正斜杠 4/4、verifier 4/4；安装包 145,944 B，SHA256=68F7DA825D59EED8A1BA105E3FB072AD11A64D0C94C1EBB79E438D00356B54A1

## v1.8.22（2026-10-21）

**十六巡：自查优化收尾（README 版本表同步 + 条目文案去版本号依赖 + 模组注册名实证）**

- **README.md 同步**：框架实测兼容 5.5.1→5.5.2；适配器一览表枯木逢春 2.4.2→2.4.3、归途之书 1.3.8→1.3.9、框架 5.5.1→5.5.2（API 6 项→8 项）；"其余适配模组无公开仓库，暂不纳入自动检测"（已过时）→"9 渠道全覆盖：8 个适配模组 + 框架本体"；兼容矩阵实测版本 5.5.1→5.5.2
- **条目文案去版本号依赖**：`f_avery_refused` name「孤儿院 · 已拒绝艾弗里收养（2.4.2 新增）」→「（模组新增）」、note「2.4.2 新增：」→「模组 2.4.2 起提供：」（避免每次模组升版都要改 UI 文案，符合"断言/文案不写死版本号"原则）
- **模组注册名实证（补十五巡验证盲区）**：枯木逢春 2.4.3 main.ts 确认 `maplebirch.get('DeadwoodReblooms')` 注册名保留；归途之书 1.3.9 main.ts 确认 `get('RobinTemple')/get('TempleChoir')/get('TempleDuties')` 保留——两适配器 detect 探测键在新版全部仍成立
- 全链验证：全量回归 ALL TESTS PASSED（31.1/32.1 适配器声明断言 PASS）、功能 E2E 全 PASS、zip 正斜杠、verifier 4/4；安装包 145,654 B，SHA256=D3AFC885693A6983BEC8D3A0401A701EDB9B1E17611F2D6477E1B2A7D334B437

## v1.8.21（2026-10-21）

**十五巡：3 个第三方模组适配器跟随上游更新（枯木逢春 2.4.3 / 归途之书 1.3.9 / 框架 5.5.2）+ 更新检测脚本补全**

- **适配器声明升版**：归途之书 modName v1.3.8 → v1.3.9；枯木逢春 modName 2.4.2 → 2.4.3
- **键存活全量校验**：对两个适配器全部 59+43 条 varPath/skipVar/completeVar/progressVar 在新版源码中逐一验证——全部存活，无需删改（初检 MISS 系引用形态差异：模组以 `$X.Y.Z`/分段 get 引用，二次短键名探测确认均存在）
- **新版内容甄别（不新增作弊键，理由实证）**：枯木逢春 2.4.3 将渡鸦神社/月羽从 MoreTransformations 拆为独立 DarkfeatherShrine 模块——存档键仍留在 `V.MoreTransformations.shrine.*`（stage/feeds/helped/donations/confessed 等 2.4.2 已有），拆包不改键；新增 Finance/ResidentBath（`real_estate.life.bath/days` 为复杂对象/字典，改坏易崩）、ParkBench（无持久键）、Robin/Savings（仅复用已有 reserve 键）；归途之书 1.3.9 新增 RobinTemple/Garden（`work_day` 为日期戳，非累计值，作弊语义混乱）。以上均不进面板
- **框架 5.5.2 API 核对（check_framework_api.js）**：核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists / define / frameworkNotice）；`setup.MapleBirch` 缺失无害（仅 01-core.js resolveMB() 兜底分支，window.maplebirch 主路径存在时永不触发）、`maplebirch.patch` CE 零调用 → declOverride 5.5.1 → 5.5.2
- **check_mod_updates.js 补 3 个缺失适配器渠道**：dol-optimization（ANLINSTUDIO/Degrees-of-Lewdity-DolOptimization）/ wraiths-reflection（Water2311/WraithsReflection）/ dolsims（MissedHeart/Degrees-of-Lewdity-DolSims）→ 6 渠道扩为 9 渠道；顺手修复版本提取正则不一致 bug（声明侧 `(\d+\.\d+(?:\.\d+)?)` 把 0.8.1.7 截成 0.8.1 导致 dolsims 误报"有更新"，统一为 `(\d+(?:\.\d+)+)` 与 tag 侧一致）
- 测试：test_mce 31.1/32.1 版本断言同步（1.3.9 / 2.4.3）；分组计数断言不变（未增删条目）
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED（含 31.1/32.1 新版断言、43.6 physique/43.7 译名回归）、功能 E2E 全 PASS；安装包 145,662 B，SHA256=D0D335E5E49AAC093814CE5ED6E2181D93B4443ED453CCF6945C70BC626F21D4
- 备注：更新检测实跑 9 渠道 8 个实测全对（枯木逢春/归途之书/DomRobin/MLI/SmartPhone/Dol-Optimization/Wraiths/DolSims 均无更新）；框架渠道当轮撞 GitHub API 60 次/小时限流（core 0/60，19:44 恢复），以本地 compareVersions 模拟确认 decl 5.5.2 == tag 5.5.2 判"无更新"，逻辑正确；定时任务每日 21:15 单次调用不撞限流

## v1.8.20（2026-10-21）

**十四巡：剧情页页首「使用提示」文案还原为固定触发原始说明全文（用户要求）**

- 用户实测反馈固定剧情播放器问题（播放完不自动取消、手动取消后仍被困场景播放器）在 v1.8.19 机制修复后仍未解决，用户明确放弃该方向（"不需要你解决了"），要求还原提示文案
- 还原：`renderScenes()` 页首 `mce-warn` 文本恢复为用户给定全文「使用提示：当你使用固定触发后，会一直循环。当出现退出场景时，回到此页面取消队列。之后你会被困在场景播放器中，请使用场景直达退出去。」
- 同步更新 test_mce 第 30 节 WARN_TXT 常量与 30.1 断言名（固定触发原始说明全文）
- 保留能力不动：v1.8.19 的 unfreeze hook 播放结束清理 / unpinScene 防困重构 / physique 无上限 / Seath·Alice·Liddell 译名，均不回滚
- 全链验证：DOM 冒烟全 PASS（剧情页渲染可见还原文案）、全量回归 ALL TESTS PASSED（含 30.1 还原断言）、功能 E2E 全 PASS；安装包 145,662 B，SHA256=6E566F9A5DA5736DEDA4AEA3690784D26E1C7895BBB1354FDAA4637F79BCDF06

## v1.8.19（2026-10-21）

**十三巡：用户实测 3 处 bug 修复（播放结束自动清理 / 播放器内取消防困 / 体能无上限 / 角色译名补齐）**

- **修复（真 bug）剧情播放完不自动取消、仍重新播放**：根因是结束判定只认 4 个硬编码段落名（Scene Viewer End / passages / exitpassage / Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景）结束段落是框架自有名、不走原版 Scene Viewer 通道 → 队列 used 项永不清理 + `replayScene` 残留 → 下次推进剧情再次触发（循环）或拦截后续固定。修复：新增 `hookUnfreezePlayerStats()` 包装 `window.unfreezePlayerStats`——任何合法 unfreeze 调用（原版退出/框架播放器结束/mod 播放器结束都会解冻）即视为「场景播放结束」→ 自动清理队列 used 项 + 清 `replayScene`/重放标记；仅 MOD 重放（`mbCE_replayOnce`）生效，原版手动重放保持原版行为
- **修复（真 bug）手动取消后仍被困场景播放器**：`unpinScene` 原逻辑 `back = exitpassage || currentPassageName()` 兜底会让「正处于播放器段落时取消」变成原地跳转（跳去当前播放器段落），且随后删 `replayScene` → 播放器 default 分支 Back 链接无源 → 退出按钮消失。重构为三分支：back 有效且不在播放器内 → 先删状态→解冻→跳回原位；back 有效且在播放器内 → 解冻→跳回原位（目标非播放器，安全）→删状态；back 为空（框架播放器）→ 保留 `replayScene` 不主动跳转（Back 链接可用，玩家手动退出后由 unfreeze hook 兜底清理）
- **修复（用户点名）体能上限解除**：`physique` max 100 → 999999（无硬上限仅防误输入，与意志/意识/淫乱/暴露癖/异种癖同口径）
- **修复（用户点名）角色页英文名中文化**：`DISPLAY_NAMES` 新增 Seath→希斯 / Alice→爱丽丝 / Liddell→利德尔（音译，可游戏内校对调整）
- 测试：test_mce 新增第 43 节 17 断言（unfreeze hook 安装/播放结束清理/原版手动重放不越权/播放器内取消跳回原位/back 空保留不跳转/physique 无上限/新译名）；同步 42.4 physique 断言、40.1 译名断言
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED、功能 E2E 全 PASS；安装包 145,666 B，SHA256=3FC9537ED2420D646C166B3997282682C50853D1CC75ED1B036AF49C8730D07C

## v1.8.18（2026-10-21）

**十二巡全源码深度自查（17 文件约 5500 行逐行审查至收敛，修复 3 处）**

- **修复（真 bug）**：特质获取/移除对 `$x isnot true/false/undefined` 条件的满足值写反——`grantTrait` 对 `isnot true` 此前写 `true`（条件仍不满足）、`revokeTrait` 写 `false`（条件仍满足）。原版「破誓（Broken Vow）」首条件 `$player.virginity.temple isnot true` 直接命中。修复：满足 `isnot true`→写 `false`、`isnot false`→写 `true`、`isnot undefined`→写 `1`、`isnot N`→写 `N-1`；移除时反向写回使条件不满足
- **修复（文案过时）**：剧情页顶部固定触发提示仍写「会一直循环/被困在场景播放器中」——与 v1.4.8 起的「一次性触发、播放完自动返回原位并停止」机制矛盾，误导用户。改为新机制说明（清空队列/单条回退恢复原版随机触发）
- **修复（文档）**：`ORIGINAL_V_ROOT_KEYS` 注释键数 183 → 186（实测）
- 其余 14 个文件逐行复核无问题（恋爱/转化/格威岚/场景直达/固定触发/Mod作弊 8 适配器/庄园维护/战斗终结/错误熔断/懒渲染/留痕裁剪/数值钳制 34 项/API 导出完整性）
- 测试：test_mce 新增 42.6 节 8 断言（Broken Vow isnot true 获取写 false/移除写 true、isnot undefined 写 1、isnot N 写 N-1、isnot false 写 true）

## v1.8.12（2026-10-21）

**七项能力升级：收藏 / 错误收集 / 状态持久化 / 数据驱动 / 相对值 / 适配器审计 / 性能**

- **功能1 特质搜索+收藏**：行首 ☆/★ 按钮一键收藏（数据存 `V.mbCE_favTraits`），收藏项置顶「★ 已收藏」组（原版+模组特质通用，key=`分类\u0001名称`）
- **功能3 面板内错误收集器**：window error + console.error 劫持进面板（上限 50 条环形缓冲），header 红点数量徽标，点击展开堆栈列表 + 一键复制全部 + 清空（不吞错、不干扰游戏）
- **功能5 面板状态持久化**：localStorage `mbCE_ui_state_v1` 记住页签 / 特质搜索词 / 各分类折叠状态，重启面板自动恢复
- **功能6 能力项数据驱动重构**：属性快捷区 33 项升级为声明式数据表（path/label/min/max/note），purity 0-2000（面板 0-100%）、核心四维 0-100、技能/成绩/武器 0-1000；写入统一按表钳制
- **功能9 数值相对值修改**：所有数值输入框支持 `+N / -N` 相对调整（相对当前值，钳制到合理范围后写入），placeholder/title 中文提示
- **功能12 适配器工作流工具**：新增 `auditAdapters()` 运行时审计——注册键=entry.modId、分类项 key/name/varPath 完整、scenes 项用 skipVar/completeVar/progressVar、无空适配器、detect 存在；8 适配器全部健康
- **功能13 面板性能优化**：passage 刷新节流（60ms 合并）、搜索输入防抖（250ms）、收藏集合局部缓存（一次扫描替代逐行 indexOf）
- 测试：test_mce 新增 42.1-42.5 五节（相对值 12 / 收藏 8 / 错误+持久化 11 / 数据驱动 8 / 审计 5 断言），smoke_dom 新增收藏 6 + 错误收集 7 + 持久化 2 断言，全链回归 + 冒烟全绿

**双轴审查后优化（同日）**：
- **修复**：三处数值输入框 `type=number` → `text` + `inputmode=decimal`——number 框会拒绝 `+` 号导致相对语法 UI 层不可输入（数据层早已支持）；现 `+N / -N` 可直接键入
- **修复**：特质分类折叠恢复时箭头文本不一致（渲染收尾统一补数量硬编码 `▸`，展开组也被重置）——现按 `data-collapsed` 实时定箭头 ▾/▸，持久化恢复与点击行为一致
- **增强**：错误收集器补 `unhandledrejection`（未处理的 Promise 拒绝进面板）
- **优化**：quickWrite 数据表路径索引（懒建一次，替代每次遍历 33 项）
- 测试：smoke_dom 新增第 9 节 6 断言（UI 相对输入 +5/-1 实际写入、数值框 text 化、折叠恢复箭头、Promise 拒绝入收集器）

**二轮体验优化（同日）**：
- **角色记忆**：记住上次操作的角色（curName），切存档/重开面板自动回到该角色，失效回落首个角色
- **内层页签记忆**：角色页「恋爱阶段/转化阶段」页签选择持久化恢复
- **错误收集器**：同源错误 30 秒内合并计数（×N，防渲染循环刷屏淹没面板）；每行加 [HH:MM:SS] 时间戳；复制全部带计数
- **折叠工具**：特质管理区新增「全部展开 / 全部收起」一键按钮（收藏组保持置顶在工具行之下）
- **折叠状态自清理**：全量渲染时删除已不存在的分类残留键（搜索过滤下不清理，避免误删隐藏分类状态）
- 测试：smoke_dom 新增第 10 节 5 断言（错误去重 ×3 / 全部展开收起 / 角色+内层页签往返 / 残留键清理 / 时间戳格式）

**三巡性能修复：卡顿/闪退根因（DoLGameUI 等第三方特效层刷屏）**：
- **错误风暴熔断**：同源错误 60 秒窗口合并计数（×N），单源 ≥20 次熔断忽略 60 秒；全局 ≥200 条/分钟全类熔断 30 秒——切断「第三方特效层每帧 console.error → 收集器高频 DOM 写 → 特效层再评估」的放大循环（DoLGameUI 的 spotlight/glow 每帧报错不再卡顿/闪退），熔断期红点提示 ⚠、错误列表显示熔断说明
- **badge 更新节流**：200ms 内多次错误只写一次 DOM（清空等明确操作立即刷新）
- **passage 自动刷新降频**：60ms → 300ms，降低面板打开时每 passage 全量重建对第三方特效层的触发频率
- 测试：smoke_dom 新增第 11 节（同源 30 连发合并 1 条 + 熔断、异源 200 连发受 50 上限 + 全熔断后不再新增、badge 节流最终一致 + ⚠ 提示）

**四巡内存/CPU 治理（"用多了闪退"累积根因）**：
- **Mod作弊 页免 passage 自动刷新**：该页数据只由用户点击改变——长时间停在 Mod作弊 操作不再被每 passage 全量重建拖累（第三方特效层 DOM 扫描是卡顿/闪退主因）
- **jQuery 事件绑定防重**：`:passageoverride` / `:passageinit` 改为命名空间 `.mbce` off+on——重载/重复注入不再累积 handler
- **熔断计数表有界**：byKey >500 键丢弃最旧一半（防御错误源键无限变化的内存泄漏）；速率计数改为每分钟两桶 O(1)（替代时间戳数组）
- **面板开关与 badge 写入解耦**：面板关闭时错误只记数据不写 DOM（省 CPU）；打开时立即刷新徽标
- 测试：smoke_dom 11.3 补面板开关验证（关闭不更新 badge/重开即刷新、异源 300 连发受 50 上限）

**五巡自查校验再优化**：
- **Mod作弊 页操作局部行更新**：按钮点击后只刷新目标行回显（阶段下拉/能力勾选/数值输入），不再全量重建整个模组页——高频操作下 DOM churn 减少 95%+，进一步降低卡顿/闪退累积
- **滚动位置保持**：模组详情页 / 玩家编辑页重建后恢复 pane.scrollTop——长列表底部操作不再跳回顶部
- **badge force 立即写**：打开面板/清空错误时徽标同步刷新（此前 force 仍走 200ms 节流，重开面板徽标延迟）
- 测试：smoke 12.1 移至非熔断期验证面板开关真实路径（关闭不写 badge / 重开立即刷新 3 vs 3）

**六巡自查再优化（快速面板局部更新 + 测试补盲 + 兜底 bug 修复）**：
- **快速面板局部行更新**：玩家编辑页数值操作只刷新目标行（输入框回显 + 当前值标签），不再全量重建 33 行 + 特质区；特质类操作（无 path）仍全量重建
- **CSS.escape 兜底 bug 修复**：无全局 CSS 环境（node/eval）走兜底时漏拼 "quick:" 前缀 → 行查找失败静默回退全量重建（优化失效）；修复后与主分支等价，此坑已入错题本
- 测试：smoke 第 13 节（mock 适配器局部行更新：阶段应用/能力勾选/数值相对修改后行数不变 + 回显更新）+ 13.2（快速面板 +10 局部回显）

**v1.8.13 七巡（实测反馈：核心属性/模组数值上限被钳 + DoLGameUI 特效层错误 50 条刷屏）**：
- **钳制上限修正**：核心属性数据表 max 配错（willpower/awareness/promiscuity/exhibitionism/deviancy 误配 100，应为内部值域 2000；beauty 误配 100，原版无硬上限 → 999999 防误输入）→ 应用大值不再被钳死
- **模组数值上限放宽**：LostLamb doubt/fear/notice 100→1000；TempleDuties archive.roof 99→100、shelves 99→999（实测当前值 108 超原上限）
- **错误噪音归一化**：DoLGameUI 特效层 4 种 layer 消息（spotlight/glow/linearGradient/flatColorOverlay）交替刷屏时各成独立源绕过单源熔断 → 归一为同一源，命中「单源 ≥20 熔断」；50 条风暴折叠为 0-1 条
- 测试：smoke 13.3（意志 2000 / 容貌 50000 写入）+ 13.4（24 条特效层错误折叠 ≤1）

**v1.8.14 八巡（用户指令：意志/意识/淫乱/暴露癖/异种癖改无上限 + 整体核查）**：
- **5 属性无上限**：willpower/awareness/promiscuity/exhibitionism/deviancy 钳制上限 2000 → 999999（仅防误输入，非游戏上限）；purity（原版内部 0-2000）、physique（0-100）保持不变
- **整体核查**：核心属性表 8 项 / 基础技能 6 项 / 性技能 10 项 / 成绩 4 项 / 武器 5 项 min-max 全表审计通过（技能与成绩 0-1000 百分比量纲）；8 适配器 80 处数值项审计通过（次数 999 / 进度 100 / 金钱 10 万+ / 开关 0-1，无异常钳制）
- 测试：smoke 13.3 扩展（5 属性写入 5000 验证无上限）

**v1.8.15 九巡（用户批准三项优化 1/2/3）**：
- **① 特质区收起组懒渲染**：折叠分组初始不再建行（行闭包进组 pending），点击展开/全部展开时才补建——面板开合与切页 DOM 显著减少（特质区 124 行中收起组不再占 DOM）
- **② 面板写入留痕有界化**：`V.mbCE_wrote` 条目数 > 400 时按时间戳升序裁剪最旧一半（5 个写入点统一调用 mbCEWroteTrim），防存档无限膨胀；被裁条目的回退窗口随之关闭
- **③ 第三方噪音源折叠扩展**：除 DoLGameUI 特效层外，新增 DependenceChecker / TweeReplacer / Paperdoll+ ReplacePatcher / Terraria Expand Mod / Simple Frameworks ModOrderContainer 归一化（各归一同源，命中单源熔断，不再独立刷屏）
- 测试：smoke 13.4b（5 种第三方噪音 25 条折叠 ≤6）+ 13.5（懒渲染：初始 33 行 <60、展开补建、全部展开 >100）+ 13.6（450 条留痕裁剪 ≤400 且保留最新）

**v1.8.16 十巡（自查修复：懒渲染搜索边界）**：
- **修复搜索被懒渲染吞掉**：搜索词命中但目标特质分类处于收起状态时，匹配行落在收起组里不可见（懒渲染 1.8.15 引入）。修复：搜索态（q 非空）强制所有组展开并建行（仅改 DOM 收起标记，不写持久化折叠状态，搜索结束恢复默认收起）
- 测试：smoke 13.7（全部收起 + 搜索「童贞」→ 匹配行可见）

**v1.8.17 十一巡（自查修复 + 快速面板补资金）**：
- **修复留痕排序失效**：恋爱对象留痕条目缺 `t` 时间戳，trim 裁剪按时间升序时兜底 0 导致该条目永远被当成最旧、优先裁剪。补 `t: Date.now()`
- **快速面板新增「资金」项**：V.money 直接读写（min 0 / max 100万，单位 £，建议整数），支持 +N/-N 相对调整与回退，走统一钳制与留痕
- 测试：test_mce 42.4 数据表 33→34（9+6+10+4+5）

## v1.8.11（2026-10-20）

**模组特质可直接获取：特质管理区对模组注入特质不再只读**

- `discoverModTraits()` 保留 has 字符串（此前只存函数型 hasFn，导致模组特质行只读展示）
- 特质管理区模组注入特质行现在有「获取/移除」按钮：
  - 字符串型 has（如 `$acceptance_penis_small gte 1000`）→ 复用 grant/revoke 写满足/不满足变量，直接获得/移除
  - 函数判定型 has → 走强制获得标记（`mbCE_forcedTraits`，与原版复杂表达式特质一致）
- 分类提示文案更新：「模组注入（自动发现，可直接获取/移除）」
- 测试：全量回归 37.3b 新增 8 断言（双型发现、字符串型写 1000/移除写 0、函数型强制标记/移除、拥有判定往返）
- 适配完整性核对结论：8 适配器功能面全覆盖，特质类条目（枯木逢春铁意志/受虐狂、DoLSims 14 号书 5 封印等）经 Mod作弊 页 abilities 勾选直接获得
- 打包修复 ERR-20261020-001：zip 条目正斜杠分隔符（Compress-Archive 反斜杠导致 ModLoader cannot get file → ZipArchive 手动写入 + 打包分隔符校验）

## v1.8.10（2026-10-20）

**审查补全：庄园自动维护扩至 AutoClean 全维护面 + 点菜刷新对齐**

- 「庄园自动维护」区由 2 按钮扩为 **6 按钮**（补齐 AutoClean 0.1.5 每日 0 点全部维护面）：
  - `mcMaintainTemple()`：神殿防衰减——housekeeping≥1000 时 `temple_quarters=100`，tending≥1000 时 `temple_garden=100`（对齐 AutoClean 条件锁值）
  - `mcMaintainEden()`：伊甸菜地/菇桶/泉水 `edengarden/edenshrooms/edenspring=4`（无条件锁值）
  - `mcRestockSupplies()`：肥皂/药膏补 10、鹰塔木材 `bird.materials.wood=10`
  - `mcCleanMansion()`：艾弗里豪宅全部房间清理 + `days_absent=0`——运行时动态枚举 `avery_mansion` 直接子键、对含布尔 `cleaned` 的对象置真（适配原版结构变化，不写死字段名）
- 投喂对齐：`mcFeedAvery()` 喂食后调用 `avery_food_select` 刷新点菜（AutoClean 函数末尾逻辑，游戏中存在时生效）
- 四函数经 09-exports.js 导出 API
- 测试：全量回归新增 41.2c 断言（技能条件锁 / 无条件锁 / 补货 / 动态打扫四组行为，实测 rooms=3 且 man 对象不动）；冒烟 +4 断言（四新按钮存在且点击不崩）
- 全链验证：冒烟 + 全量回归 600+ 断言全绿

## v1.8.9（2026-10-20）

**审查优化：对齐 AutoClean 行为 + 数据层下沉 + 边界标注**

- 农场收获对齐 AutoClean 0.1.5：`mcMaintainFarm()` 遍历 stock 直接把键名传给 `tending_give`（truffles/eggs/milk/cream 全覆盖，修复原映射漏收货 cream；不再用可能不符原版的映射名）
- 投喂对齐 AutoClean：`mcFeedAvery()` 仅艾弗里关系达 saved/ascended 才喂食；未达阶段返回 `skipped` 不操作、不再计入 `dinner_missed`
- 战斗终结数据层下沉：8 个动作定义从 08-npc-traits.js 移至 03-global.js（`COMBAT_ACTIONS`/`mcCombatAction`，经 09-exports.js 导出 API），UI 只负责渲染；区级提示注明「建议战斗中生效；结束集群战斗外会把游戏时钟拨回当日 0 点」
- 庄园自动维护改 mce-row 结构（说明 + 按钮分行），与战斗终结区样式一致；投喂未达喂食阶段显示中文提示
- 边界标注：DoLSims 适配器 恶魔化/天使化/堕落天使 三项补 note（复用原版转化键，会同时推进原版转化阶段）；wraiths-reflection 状态键注释补全 necklaceThiefWR（探测键与文档一致）
- 测试：全量回归新增 41.2b 断言（含 cream 四类库存全部收获并清零）；41.1 断言改为「未达喂食阶段不计数」；冒烟 + 全量回归 590+ 断言全绿

## v1.8.8（2026-10-20）

**5 模组适配落地：全局页同功能（学 CombatTerminator + AutoClean）+ 三新适配器（DoLSims / Dol-Optimization / Wraith'sReflection）**

- 全局页新增「战斗终结」（学 CombatTerminator 0.1，8 个按钮直接写原版战斗值：自我了断/英雄不屈/延长战斗/息事宁人/一拳打飞/结束挣扎/结束触手/结束集群）
- 全局页新增「庄园自动维护」（学 AutoClean 0.1.5，即时执行原模组每日逻辑）：
  - `mcFeedAvery()`：按艾弗里喜好 → 牛排/舒芙蕾/扁意面 → 最高难度菜谱，无菜 `dinner_missed+1`（与 AutoClean 判定一致）
  - `mcMaintainFarm()`：塔卫≥1000 锁四畜 30 + 清 agro；非售卖期库存收获并清零（SugarCube Wikifier 通道发货，失败降级仅清库存）
- 新增 DoLSims 0.8.1.7 适配器（探测 `window.MirrorHypnoVariableRefresh`，精选 42 项：阶段 2 / 能力 18 / 数值 26，值域按源码 clamp 实证；四维 `.value` 宿主缺失自动拒绝）
- 新增 Dol-Optimization 1.1.2 适配器（探测 `window.DolOptimization`，阶段 1 / 能力 4 / 数值 5；`options` 不在原版根拦截清单，属边界地带写入已注释标注）
- 新增 Wraith'sReflection 1.3.4 适配器（探测 V 自有根并集，阶段 4 / 能力 4 / 数值 2；如实暴露模组自身 `rreturn` 双 r bug 取值，写 `return` 覆盖面最全）
- 三新适配器探测键与现有 5 适配器零碰撞；卸载后自动消失
- 测试扩展：冒烟 +6 断言（全局页两区渲染、战斗按钮点击生效、三新适配器渲染）；全量回归新增第 41 节 21 断言（喂食/农场逻辑、写入钳制、枚举拒绝、宿主缺失拒绝、卸载消失）
- 全链验证：冒烟 43 条 + 全量回归 590+ 断言全绿

## v1.8.7（2026-10-20）

**学 CE 落地②**：模组变量探查器 + 能力项逐项数值文档

- 新增 `tools/scan_mod_vars.js` 模组变量引用扫描器（学 CE 变量搜索/快照差异，与 resolve_missing 逆向互补）
  - 正向扫描：模组源码目录 `.twee/.js/.ts` 的 `$xxx` / `V.xxx` / `setup.xxx` 引用 → 对比适配器声明 + 原版顶层键清单（183 键）→ 三分类输出
  - [已声明] 源码引用且声明命中 / [未声明·候选补录]（原版与 setup 键自动过滤）/ [声明但源码未见]（动态键/别名，指引 resolve_missing 复核）
  - 用法：`node tools/scan_mod_vars.js <模组源码目录> [适配器id]`
  - CE 1.20.3 源码实证：80 文件 / 440 引用根 / 三分类输出正常（setup.* 过滤后候选 305）
- 能力/数值项「说明」折叠（学 CE 逐项数值文档）：Mod作弊页每项作弊行新增 `<details>` 折叠，自动显示 写入路径 + 类型 + 钳制范围，可选手写 `note`（判定/副作用）
  - 能力项与数值项（number 型）均覆盖；补 note：归途之书 2 项 / 枯木逢春 3 项 / SmartPhone 2 项
  - 冒烟新增 3 断言：说明折叠渲染 / 含写入路径+类型 / note 手写说明渲染
- 全链验证：冒烟 37 条 + 全量回归 570+ 全绿

## v1.8.6（2026-10-20）

**发布**：SmartPhone 第 5 适配器 + 07 模块化拆分 + 自动更新检测

- 新增 SmartPhone Alpha 0.3.91（万能智能手机）适配器（探测键 `V.Phone`，8 个作弊项）
- 07 模块化拆分：22 个 src 文件（原 292KB 单文件）
- resolve_missing 三级定案（源码实证 / 别名盲区 / 动态键盲区）
- 框架 maplebirchframework 兼容升至 5.5.0
- 6 渠道每日模组更新检测定时任务（含 SmartPhone 渠道）
- 真实浏览器加载验证（游戏欢迎/年龄确认界面）

**适配器同步（2026-10-20 追加）**：

- 枯木逢春 2.4.1 → **2.4.2**：resolve_missing 42 条全 KEEP；新增能力「孤儿院 · 已拒绝艾弗里收养」（`Finance.orphanage.avery_adoption_refused`），能力 14→15
- 归途之书 1.3.7 → **1.3.8**：resolve_missing 56 条全 KEEP
- 框架 5.5.0 → **5.5.1**：check_framework_api 核心 6 项全过

## v1.8.5（2026-10-19）

**修复**：特质栏消失严重 bug

- 修复 `select.type` 只读 getter 赋值崩溃（Cannot set property type of #<HTMLSelectElement> which has only a getter）
- 错误编号 ERR-007 / ERR-008，已入错题本

## v1.8.4（2026-10-19）

**三需求**：

- 需求①：同阶段特质合并为系列下拉行（受虐狂/施虐狂各档、天真无邪、学校成绩系列）
- 需求②：模组角色英文名中文化（Tsukihan/Rowan/Adrian/Marlow/Grant/Needmeet/Feng 等）
- 需求③：无可写条件特质强制获得（`mbCE_forcedTraits` 只读展示 + 强制获得）
