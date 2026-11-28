# MapleBirchCE 作弊功能矩阵

> 数据源：`tests/data/adapter_matrix.json`（12 适配器 / 430 条目 / 979 探针）+ `javascript/src/04a-*.js`（modId/modName）。
> 用途：改作弊功能、加适配器、排查「某某作弊在哪」时先查本表，再按「核心分片」定位源码。
> 重跑：适配器声明变更后先 `node tools/gen_adapter_matrix.js`，再 `node tools/gen_cheat_matrix.js`。

## 一、面板导航（8 大页签）

| 页签 id | 中文 | 核心分片 | 功能 |
|---|---|---|---|
| `char` | 角色 | 07b-char + 06a-c + 05b + 07g | 属性批量编辑（负面属性/预设模板）、170 原版特质 + 模组特质自动发现、中文特质映射、性别七键切换（留痕可回退）、恋爱对象/阶段、搜索过滤 |
| `stage` | 阶段 | 07c-stage | 原版剧情阶段一键完成/回退（留痕）、模组阶段（各适配器 stages） |
| `scenes` | 剧情 | 07e-scenes(+2) + 07f-pins* | 剧情直达：SV 预览链回放（replayScene+exitpassage）、节日/怨灵状态注射、锚定触发状态机 |
| `places` | 场景 | 07d-places(+sydney/2/3/4/5) + 07k | 场景直达：地点永久解锁+世界入口、26 条数字档位核对、悉尼线、小岛 NPC、艾弗里庄园开局解锁 |
| `global` | 全局 | 03a-c + 07j + 07l + 07m + 07n + 07o + 08b | 时间/时段/天气、世界硬软腐化、犯罪全清、古董收集+成就、雷米疤面头衔、转化隐藏、原版扩展（枝叶变装等）、原版经济（数值+撤销）、鸟/礼顿、态度锁定 |
| `mods` | Mod作弊 | 04a-00..16 + 05a(+2/3) + 04b/04c | 12 个第三方模组键级适配（见第三节表）、类型显示（numeric 显示 number(0/1)）、留痕+预览门控+单键回退、命令式动作（fert） |
| `yanling` | 言灵 | 07i-yanling-* | 言灵页 D 组（艾弗里办公室补/作弊模式）、E 组 4 页签 52 条（好友诉求等）、一键写入+撤销、作弊模式无副作用开启 |
| `calendar` | 日历 | 07x-calendar | 14 天事件窗口（租金到期/扣押标签）、纯数据推演、跳日探测、租金锁定入口 |

## 二、作弊子系统（跨页签基础设施）

| 子系统 | 分片 | 说明 |
|---|---|---|
| 留痕通道 | 01b-wrote-trim + 04b + 08c | 写入走 V.mbCE_wrote（key=cheat:<modId>:<itemKey>，before/after/t）；性别留痕 cheat:player-self:gender:<leaf>；统一撤销中心逐条回退 |
| 预览门控 | 08d-diff-preview | 开启「确认条」后写入先进队列；mbCEPreviewGate 比较 before/after（v2.1.20 起数组逐项比较），确认才重放 |
| 撤销中心 | 08c + 08e | 可撤销 N 项、单键回退（含锁定连带解除）、中文标签映射 |
| 锁定 | 07f-lock | mbCELockSet 键锁定，防原版覆盖/重算 |

## 三、模组适配器矩阵（12 个）

| modId | 显示名 | 条目分布 | 关键键示例 |
|---|---|---|---|
| `cattery` | 猫舍 Cattery v1.1.9（猫咖/出租屋/养宠/飞行） | stages=9 / abilities=3 / values=35 | `rentingahouse`、`pchaveCat`、`pcGardenupgrade`、`birdFly` |
| `deadwood-reblooms` | 枯木逢春 · Deadwood Reblooms 2.5.8 | stages=13 / abilities=65 / values=62 | `RobinExpansion.shop_stage`、`RobinExpansion.balloon`、`RobinExpansion.asylum.status`、`RobinExpansion.doctor.stage` |
| `dol-optimization` | 原版优化 Dol-Optimization v1.1.2.1 | stages=1 / abilities=4 / values=17 | `options.opt.UiBarToggle`、`options.opt.WornStacking`、`options.opt.WornStackingTraits`、`options.opt.WornStackingWarmth` |
| `dolmod` | 人物附加与生活质量提升（DolMod-/MyFirstMod v0.1.990） | stages=1 / abilities=12 / values=18 | `adian_confession_state`、`adian_met`、`adian_romance`、`adian._inHospital` |
| `dolsims` | 图书馆扩展 · 兼容入口（0.8.1.7） | stages=2 / abilities=23 / values=21 | `Library_Trouble`、`clearModSimsFuncDec_phase`、`MirrorHypnoSims_0`、`MirrorHypnoSims_1` |
| `dom_robin` | DomRobin 0.0.8（罗宾大型增强） | stages=1 / abilities=11 / values=2 | `liveStreamStage`、`robinFightTalked`、`robinFightTogether`、`robinPayBothTalked` |
| `fertility-expansion` | FertilityExpansion 1.7.0（伊甸子女/生育扩展） | stages=1 / abilities=11 / values=2 | `eden.schemaVersion`、`eden.facility.owned`、`eden.facility.expanded`、`eden.facility.baileyIntroduced` |
| `more-farm-upgrade` | 更多农场升级 More Farm Upgrade v1.0.8（农场 11 项新设施/资源/农夫） | abilities=16 / values=21 | `plots.farm.0.greenhouse`、`plots.farm.1.greenhouse`、`plots.farm.2.greenhouse`、`plots.farm.3.greenhouse` |
| `more_love_interests` | More Love Interests Mod 0.1.8.0 | values=3 | `loveInterestList`、`options.mateForLifeDebuff`、`dragMode` |
| `revelation-the-book-of-return` | 默示录：归途之书 v1.4.6 | stages=18 / abilities=24 / values=18 | `RobinTemple.stage`、`RobinTemple.secret.stage`、`RobinTemple.secret.rite_stage`、`RobinTemple.vigil_result` |
| `smartphone` | SmartPhone Alpha 0.3.91（万能智能手机） | stages=1 / values=7 | `Phone.FengLine`、`Phone.photography`、`Phone.TaskDanger`、`Phone.FengMeeet` |
| `wraiths-reflection` | Wraith'sReflection 1.3.4（幽灵的倒影） | stages=4 / abilities=3 / values=1 | `WraithsReflection`、`HelpAsk`、`necklaceWR`、`necklaceThief` |

## 四、查找速记

- 找「某模组作弊项在哪」→ 第三节 modId → 对应 `04a-XX-*.js` 适配器文件。
- 找「写值怎么留痕/回退」→ 第二节留痕通道；预览弹窗逻辑在 `08d-diff-preview.js`。
- 找「适配器声明数/探针」→ `node tools/validate_adapters.js`；矩阵幂等 `node tools/gen_adapter_matrix.js --check`。
- 找「面板某按钮」→ 第一节页签 → 核心分片列（如角色属性编辑 = `07b-char.js`）。