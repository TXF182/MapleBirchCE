# Maplebirch CE · 全局全自动剧情条件解锁

> 对标官方 CE 调试器的全局调试面板：**六大面板**（角色 / 阶段 / 剧情 / 场景直达 / 全局 / Mod作弊）、恋爱与转化阶段一键完成、场景永久解锁+世界入口、**8 个第三方模组适配器**（枯木逢春 / 归途之书 / DomRobin / MLI / SmartPhone / Dol-Optimization / Wraith'sReflection / DoLSims）+ 玩家全属性编辑、**每日模组更新自动检测**。界面全中文、纯 JS 加载、特质全中文映射、原版 170 特质全收录、模组特质自动发现。**版本号以正文「当前版本」为准，完整版本线见 [CHANGELOG.md](CHANGELOG.md)。**

基于 Maplebirch 框架注册池的全局调试面板。对标官方 CE 调试器：右侧常驻黑色悬浮面板、双层标签、角色数据卡片、恋爱/转化阶段一键完成、剧情解锁、场景直达（永久解锁+世界入口）、第三方模组扩展内容作弊控制。

**当前版本：v1.8.23**（完整版本线见 [CHANGELOG.md](CHANGELOG.md)）

## 安装（快速开始）

1. **前置依赖**：
   - [SugarCube 2 ModLoader](https://github.com/Lyoko-Jeremie/sugarcube-2-ModLoader) ≥ 2.0.0
   - [maplebirchFramework](https://github.com/MaplebirchLeaf/SCML-DOL-maplebirchFramework) ≥ 5.4.2（实测兼容至 5.5.3）
   - 游戏本体 ≥ 0.5.12.13
2. 游戏内按 `Alt+M` 打开 ModLoader → 「添加 / 移除Mod」→ 选择 `MapleBirchCE.mod.zip` → 「添加旁加载Mod」→ 提示 Success 后**刷新页面**。
3. 若旧版 `MapleBirchCE`（v1）已在列表中：先「移除」再导入新版，避免同名单冲突。
4. 刷新后游戏右下角出现**金色圆形 CE 悬浮按钮**，点击即打开面板。

**自检（验证是否加载成功）**：游戏内 `F12` 打开控制台输入 `typeof setup.mbStageCE`，返回 `"object"` 即成功；返回 `"undefined"` 则打开 ModLoader 加载日志查看报错。

## 使用手册（六大面板）

面板顶部六个标签页，从上到下依次使用：

### 1. 角色页（人物一览）
- 自动枚举 Maplebirch 注册池的全部角色：游戏本体 + 全部已加载 MOD 角色（实测 16 个，零硬编码）。
- 每张卡片显示：爱意 / 支配 / 情欲 / 警戒 四项数值与活跃状态。
- 点击角色卡片进入该角色的「阶段页」。

### 2. 阶段页（恋爱 / 转化阶段）
- **恋爱条件逐条求值**：绿 = 已达成，红 = 未达成；每条下方附**中文说明**（达成后 = 达成了什么）。
- **一键完成**：自动先补齐数值到官方门槛，再激活阶段 Flag（规避框架自动校验重置）；数值 ±10 微调按钮。
- **回退**：只撤销本面板写入的标记（依据 `V.mbCE_wrote` 留痕）；玩家真实达成的进度拒绝回退，保护真实存档。
- 格威岚原版 7 阶段（仪式之约/渴望/欲望/恋人/永远/发情/孕育意愿）与 MOD 恋爱阶段同页管理；转化阶段（狼/哈比/狐/兔子/人鱼等）一键完成。

### 3. 剧情页（场景解锁）
- **实时解析** DoL 本体场景注册表（`$scenes`，从 Story 文本动态解析，非硬编码）——剧情 MOD 注册进场景系统后自动出现。
- 自动按数字后缀**聚类成剧情线分阶段**（如罗宾变装线 1~6 合成一条线），独立场景单列。
- **一键完成**：自动把解锁条件引用的场景键、入口段落、全部剧情段落写入 `$scenePassages` 经历表，再复检解锁状态。
- **固定触发**（核心功能）：固定后**下次推进剧情即自动进入该剧情**，触发一次自动停止（队列制，可多条按序触发）；重放期间自动禁存、结束自动返回原位。
- **注意**：固定触发若被困在场景播放器中，回到本页**取消固定队列**，再用「场景直达」退出（页首有黄色警示框提示）。

### 4. 场景直达页（特殊场景传送）
- **8 组场景**直达：孤儿院阁楼 / 凯拉尔庄园 / 悉尼神殿 / 西里斯学校与商店 / 艾弗里庄园 / 格威岚花园与森林商店 / 多伦公寓与阁楼 / 麋鹿街大院。
- 点「直达」= **永久解锁 + 世界入口写入**：凯拉尔庄园（`syndromekylar=1`）、阁楼（`loft_known=1`）、西里斯商店（`adultshopstate="open"`）、麋鹿街大院（`compound.allowed/discovered`）等，解锁后游戏世界里直接可进入。
- **防崩兜底**：直达/固定触发进入艾弗里庄园、农场线、格威岚剧情前自动补缺失状态对象（`$daily.avery.talk`、`$farm`、`T.gwylanStatus/TF`），**已有进度绝不覆盖**——新存档直接传送不炸档。

### 5. 全局页（批量操作）
- **一键补齐数值**：全部角色一键补齐（实测 120 项数值写入）。
- **一键解锁全部恋爱阶段 / 全部转化阶段**：全角色批量。
- **誓言修复**：一键恢复神殿誓言（`temple` 回 true + 破誓计数清零 + 承诺对象保留），实时显示当前誓言状态。
- **NPC 特质获取**：6 项逐项获取（同舟共济—罗宾 / 斯德哥尔摩综合征：伊甸·凯拉尔·狼群·巨鹰 / 艾弗里的救星），条件自动改满足，已拥有项置灰。

### 6. Mod作弊页（第三方模组扩展内容）
- **主容器页**：只展示已识别模组列表，点击进入子页面；顶部有「玩家自己」入口卡片。
- **子页面四分组**：① 模组任务（跳过/直接完成）② 模组阶段 & 能力（阶段下拉 + 跳最高/回初始；能力勾选启停，**每项带「说明」折叠**——写入路径 / 类型 / 钳制范围 / 手写判定与副作用）③ 模组自定义剧情（跳过/强制完成/重置）④ 自定义数值修改（带类型校验、越界钳制、回退留痕）。
- **玩家自己入口**：游戏属性面板（颜色分级）快捷编辑（核心属性/基础技能/性技能/学校成绩/武器，直接改游戏面板量纲）+ 全部特质管理（原版 170 条 / 9 分类折叠、系列行合并、无可写条件特质直接获得、模组注入特质自动发现）。
- **安全边界**：只处理第三方模组新增内容，**原版变量一律拒绝**（提示使用五大面板）；父级对象缺失拒绝写入（绝不写 undefined）；所有修改留痕可回退。

## Mod作弊 适配器一览（v1.8.23）

| 适配模组 | 声明版本 | 可操控面 | 探测键 |
|---|---|---|---|
| 枯木逢春 · Deadwood Reblooms | 2.4.4 | 阶段 9 / 能力 15 / 数值 20 | `maplebirch.get("DeadwoodReblooms")` |
| 归途之书 · Revelation | 1.3.10 | 阶段 17 / 能力 22 / 剧情 1 / 数值 18 | `maplebirch.get("RobinTemple"/"TempleChoir")` |
| DomRobin | 0.0.8 | 阶段 1 / 能力 12 / 数值 3 | `modUtils.get("DomRobin")` |
| More Love Interests | 0.1.8.0 | 扩容恋人列表（11 槽） | `setup.foodPreference` |
| SmartPhone · 万能智能手机 | 0.3.91 | 阶段 1 / 数值 7 | `V.Phone`（模组核心状态对象） |
| 原版优化 Dol-Optimization | 1.1.2 | 阶段 1 / 能力 4 / 数值 5 | `window.DolOptimization` |
| Wraith'sReflection · 幽灵的倒影 | 1.3.4 | 阶段 4 / 能力 4 / 数值 2 | `V` 自有根并集（WraithsReflection/HelpAsk/项链系） |
| DoLSims · 类模拟人生扩展 | 0.8.1.7 | 阶段 2 / 能力 18 / 数值 26 | `window.MirrorHypnoVariableRefresh` |
| maplebirch 框架本体 | 5.5.3 | 兼容性核对（API 8 项） | `window.maplebirch` |

> 适配器随模组版本更新**每日自动检测**（21:15 定时任务）：检出新版 → 下载源码 → audit 核对 → resolve_missing 定案 → 同步声明 → 全链测试，不打包不发版（需另行确认）。**9 渠道全覆盖**：8 个适配模组（枯木逢春/归途之书/DomRobin/MLI/SmartPhone/Dol-Optimization/Wraith'sReflection/DoLSims）+ 框架本体。

## 常见问题（FAQ）

- **面板不出现？** 先自检 `typeof setup.mbStageCE`；undefined 时看 ModLoader 加载日志（多半是框架版本不足或 mod 冲突）。
- **特质管理区整个消失？** 这是 v1.8.4 的已知 bug（`select.type` 只读属性赋值崩溃），升级到 v1.8.5+ 即可，当前版本已修复并加了防再犯测试。
- **固定触发后被困在场景播放器？** 剧情页页首黄色警示：取消固定队列 → 用场景直达退出；重放结束会自动返回原位。
- **点了「应用」但阶段没变？** 检查是否为原版变量（Mod作弊 只处理模组内容）或父级对象缺失（提示需先推进模组剧情初始化）；面板每个写入都有状态栏提示。
- **与 Cheat Extended 一起装会冲突吗？** 不会——命名空间隔离（`$mbCE_*` vs `$CE_*`），四层互测可共存。
- **适配的模组更新了怎么办？** 每日自动检测会检出并同步；也可手动 `node tools/scan_mod_vars.js <模组源码目录>` 正向扫描补录候选。
- **装了 AutoClean（自动清洁/庄园维护）会怎样？** AutoClean 每日 0 点会强制复位一批原版庄园/农场数值（艾弗里八房间清零、四畜锁 30、agro 清零、stock 清零、edengarden 等锁值）——**MCE 面板手动改的这些值次日会被它覆盖**，属模组本体行为，不崩溃但"改了又复原"；想临时压低这些数值做剧情请先卸载 AutoClean。MCE 全局页「庄园自动维护」按钮与其每日逻辑一致（即时执行，写的是同一批原版键）。
- **CombatTerminator 与 MCE 的战斗按钮有什么关系？** 原模组是 TweeReplacer 把按钮注入战斗 widget；MCE 全局页「战斗终结」是等价写入的即时按钮，二者并存无冲突（写同一批原版战斗值，效果相同）。「结束集群」建议仅在战斗中使用（战斗外 V.timer 是游戏钟，误点会把当日时钟拨回 0 点）。

## 兼容矩阵

| 依赖 | 最低要求 | 实测版本 |
|---|---|---|
| ModLoader | ≥ 2.0.0 | 2.101.1 |
| maplebirchFramework | ≥ 5.4.2 | 5.5.3 |
| 游戏本体 | ≥ 0.5.12.13 | 0.5.12.13 |
| Cheat Extended | 任意 | 1.20.3 共存实测无冲突 |

## 版本说明

- **v1.8.11（2026-10-20 · 模组特质可直接获取）**：
  - **模组注入特质不再只读**：特质管理区对 `maplebirch.temporary.traitLists` 自动发现的模组特质（如 MLI 注入表），字符串型 has 直接写满足变量获取/移除，函数判定型走强制获得标记（`mbCE_forcedTraits`）——与原版特质同等可操作；
  - **适配完整性**：8 个适配器功能面全部覆盖（归途之书/MLI/DomRobin/枯木逢春/SmartPhone/Dol-Optimization/Wraith'sReflection/DoLSims），特质类条目经 Mod作弊 页 abilities 勾选直接获得；
  - **验证**：全量回归 37.3b 断言（字符串型写变量 1000 / 函数型强制标记 / 双向移除）。
- **v1.8.10（2026-10-20 · 审查补全 AutoClean 维护面 + 点菜刷新对齐）**：
  - **庄园自动维护区扩为 6 按钮**（补全 AutoClean 0.1.5 每日 0 点全部维护面）：新增「一键神殿维护」（housekeeping≥1000 时宿舍=100、tending≥1000 时花园=100，条件锁值对齐原模组）、「一键伊甸维护」（菜地/菇桶/泉水无条件锁 4）、「一键补给」（肥皂/药膏补 10 + 鹰塔木材补 10）、「一键庄园打扫」（艾弗里豪宅全部房间清理 + days_absent 归零，运行时动态枚举房间对象，适配原版结构变化，不写死字段名）；
  - **投喂刷新点菜**：`mcFeedAvery()` 喂食后调用 `avery_food_select`（对齐 AutoClean 函数末尾逻辑，游戏中存在时生效）；
  - **验证**：全量回归新增 41.2c 断言（技能条件锁 / 无条件锁 / 补货 / 动态打扫四组行为）；冒烟 +4 断言（四新按钮存在且可点）；冒烟 + 全量回归 600+ 断言全绿。
- **v1.8.9（2026-10-20 · 审查优化：对齐 AutoClean 行为 + 数据层下沉 + 边界标注）**：
  - **农场收获对齐 AutoClean 0.1.5**：遍历 stock 直接把键名传给 `tending_give`（truffles/eggs/milk/cream 全覆盖，修复漏收货 cream；不再用可能不符原版的映射名）；
  - **投喂对齐 AutoClean**：仅艾弗里关系达 saved/ascended 才喂食；未达阶段不操作、不再计入 dinner_missed；
  - **战斗终结数据层下沉**：8 个动作定义移至 03-global.js（`COMBAT_ACTIONS`/`mcCombatAction`，导出 API），UI 只渲染；区级提示注明「建议战斗中生效、结束集群战斗外会拨回时钟」；
  - **庄园自动维护改 mce-row 结构**：说明 + 按钮分行，与战斗终结区样式一致；
  - **边界标注**：DoLSims 的恶魔化/天使化/堕落天使三项注明"复用原版转化键，会同时推进原版转化阶段"；wraiths-reflection 注释补全探测键 necklaceThiefWR；
  - **验证**：全量回归新增 41.2b 断言（含 cream 四类库存收获清零）、41.1 断言改为「未达喂食阶段不计数」；冒烟 + 全量回归 590+ 断言全绿。
- **v1.8.8（2026-10-20 · 5 模组适配落地）**：
  - **全局页同功能（学 CombatTerminator + AutoClean）**：新增「战斗终结」8 按钮（自我了断/英雄不屈/延长战斗/息事宁人/一拳打飞/结束挣扎/结束触手/结束集群，直接写原版战斗值）；新增「庄园自动维护」2 按钮（一键投喂艾弗里——按喜好→牛排/舒芙蕾/扁意面→最高难度菜谱；一键农场维护——塔卫≥1000 锁四畜 30、清 agro、非售卖期库存收获清零）。
  - **三新适配器**：DoLSims 0.8.1.7（阶段 2/能力 18/数值 26，探测 `window.MirrorHypnoVariableRefresh`）、Dol-Optimization 1.1.2（阶段 1/能力 4/数值 5，探测 `window.DolOptimization`）、Wraith'sReflection 1.3.4（阶段 4/能力 4/数值 2，探测 V 自有根并集；如实暴露模组 `rreturn` 双 r bug）。探测键与现有适配器零碰撞。
  - **测试**：冒烟 43 条 + 全量回归 590+ 断言全绿（含全局页两区渲染/点击生效、新适配器写入钳制/枚举拒绝/宿主缺失拒绝/卸载消失）。
- **v1.8.6（2026-10-19 · 适配器同步三个模组最新版 + 每日模组更新自动检测）**：
  - **适配器升级（2026-10-20 追加）**：枯木逢春 2.4.1→**2.4.2**、归途之书 v1.3.7→**v1.3.8**、框架 5.5.0→**5.5.1**（自动检测检出后手动同步：2.4.2/1.3.8 全量 audit + resolve_missing 定案 42/56 条全 KEEP，声明无删除；2.4.2 新增 `Finance.orphanage.avery_adoption_refused`（艾弗里收养拒绝标记，源码 `Finance/Orphanage.ts` 实证），补录为「孤儿院 · 已拒绝艾弗里收养」能力；框架 5.5.1 `check_framework_api.js` 核对核心 6 项 API 全过，`setup.MapleBirch`/`maplebirch.patch` 缺失均为非 CE 依赖（CE 0 次调用 patch））；
  - **适配器升级（首发）**：枯木逢春 2.2.7→**2.4.1**、归途之书 v1.3.4→**v1.3.7**、More Love Interests 0.1.7.0→**0.1.8.0**（GitHub Releases 最新版核对：2.4.1 下 `VanillaPlus.attitudes.ironWill/sadomasochist` 字面路径出现、与声明对上；1.3.7 缺失的 `faith_band/rite_round/candidates.*.agreed` 经源码实证均为 `this.state`/动态键别名盲区假报，声明无需改动；MLI 0.1.8.0 声明覆盖 100%）；
  - **移除过时声明**：枯木逢春 2.4.1 官方作弊面板已删除「校园秩序」字段（2.2.0 为 `{id:'order'}`，2.4.1 改为 studentSupport/staffSupport/corruption 三项，适配器早已声明）——删除 `LifeSimulation.school.order`，避免无效写入；
  - **自动检测机制**：`tools/check_mod_updates.js` 每日检测 **9 个渠道**（8 个适配模组：枯木逢春 / 归途之书 / DomRobin / More Love Interests / SmartPhone `ANLINSTUDIO/Degrees-of-Lewdity-DolSmartPhone` / Dol-Optimization / Wraith'sReflection / DoLSims + 框架本体 `MaplebirchLeaf/SCML-DOL-maplebirchFramework`），GitHub Releases 最新版 vs 适配器声明版本（框架渠道对比"实测兼容版本"）；检出更新→自动下载源码→audit 核对→缺失条目自动定案（resolve_missing.js）→更新适配器→全链测试→汇报（不打包不发版，需另行确认）；框架检出更新时先跑 `check_framework_api.js` 核对 CE 依赖的框架 API 全保留、确认兼容后才更新兼容版本记录；已创建每日 21:15 定时任务；
  - **验证**：全量回归通过（21.1 能力分组 14→15（2.4.2 补录拒绝收养）、31.1 声明 v1.3.8、32.1 声明 2.4.2、37.2 面板标题 v1.8.6）。

- **v1.8.5（2026-10-19 · 修复严重 bug：特质管理区整体消失）**：
  - **修复**：v1.8.4 系列行渲染对 `<select>` 元素赋值只读属性 `type`（`sel.type = ""`），真实浏览器抛 `Cannot set property type of #<HTMLSelectElement> which has only a getter`，导致 `renderTraitsSection` 中断、整个「特质管理」区不显示。删除该赋值（select 不需要 type），特质区恢复；
  - **验证**：全量回归通过（新增断言：渲染树中 select 元素不得携带 type 属性）。

- **v1.8.4（2026-10-19 · 三需求：同阶段特质合并 / 模组角色中文映射 / 无可写条件直接获得）**：
  - **同阶段特质合并为系列行**：受虐狂 / 施虐狂 各 4 档、科学 / 数学 / 语文 / 历史成绩 各 4 档、在校表现 4 档、催眠建议 / 催眠尖叫 / 催眠掩饰 / 催眠异常 5 档、创伤（焦虑 / 惊恐 / 幻觉 / 解离）等**同一变量不同阈值**的特质不再逐条平铺，自动识别并按分类合并为一行：`系列名（当前：X档）＋阶段下拉（无/各档位）＋应用＋跳至最高＋回退初始`（对齐 Mod作弊 子页阶段控件样式，参照【默示录：归途之书】阶段区）；
  - **模组角色英文名中文化**：角色一览页枚举到的模组角色（`Tsukihan`→月半、`Rowan`→罗文、`Adrian`→阿德里安、`Marlow`→马洛、`Grant`→格兰特、`Needmeet`→尼德米特、`Feng`→老冯）映射为中文显示；未收录角色名兜底原样；
  - **无可写条件特质直接获得**：has 为复杂表达式/函数判定（如 `playerIsPregnant() and ...`）、`isnot + 字符串值`（`"none"`/`"prospective"`）等**无法通过写变量满足**的特质，原先提示「该特质无可写条件（只读展示）」点「获取」无效果；现改为**直接获得**：点「获取」记入强制获得标记（面板内视为已获得），「移除」清除标记恢复原状；可写条件特质仍走变量写入，不受影响；
  - **验证**：全量回归通过（新增 37.5 节 5 条系列渲染断言 + 40 节 20 条角色映射/系列 API/强制获得断言）。

- **v1.8.3（2026-10-19 · 面板标题版本号动态化）**：
  - **修复遗留问题**：面板标题「剧情条件解锁面板 v1.2」为写死字符串，自 v1.2 后未随版本更新（用户看到的版本号始终是 v1.2）；
  - **修复**：新增 `MCE_VERSION` 常量（源码单一事实源），标题改为动态拼接 `剧情条件解锁面板 v + MCE_VERSION`，今后每次发布只需同步常量与 boot.json；
  - **验证**：全量回归通过（新增断言：面板标题包含当前版本号）。

- **v1.8.2（2026-10-18 · 特质按分类折叠收起，面板不再过长）**：
  - 用户反馈：170 条特质全部平铺太长。**特质管理区改为分类折叠**——同类型特质收在一起，每类只有一行标题（▸ 分类名＋数量，如「▸ 一般特质（65）」），默认收起；点击标题展开/收起（▾/▸ 切换），展开才显示该类全部特质行；
  - 原版 9 类 + 模组注入分类全部折叠；分类标题带数量；CSS 新增折叠规则（`.mce-grp-body[data-collapsed]{display:none}`）；标题 hover 高亮提示可点；
  - **验证**：全量回归通过（新增 37.2b 节 6 条：分组结构=标题+折叠体、默认收起、点击展开、箭头与数量显示）。

- **v1.8.1（2026-10-18 · 全部特质映射为游戏中文：补全 General 分类 + 函数/多段名中文化）**：
  - **修复用户反馈**：v1.8.0 特质管理区部分特质显示英文名（`Breasts/Flat Chest`、`familiar collar/Hypnotic Devotion/Hypnotic Curiosity`、`Acceptance: Pregnant Belly/...`）、个别显示**函数源码**（`()=> { const penisSize = ... }`）；
  - **根因**：本体 traits widget 的 name 字段含**条件表达式/函数/模板**（如 `$player.sex isnot $player.gender ? \`"Crossdresser"\` : "Crossdresser"`、`() => V.submissive <= 850 ? "Dendrophile" : "Plant Lover"`、`familiar collar／Hypnotic Devotion／Hypnotic Curiosity` 全角斜杠多段名），原提取脚本把函数源码整体抓成 name；且 **General 分类只提取到 9 条，其余全被压进一个巨型乱码条目**（哺乳期/乳液狂飙/精子银行/附身/狼/猫/牛/天使/圣光璀璨/翅膀/受虐狂系列等缺失）；
  - **修复**：①General 分类按本体 traits widget 原文重建为 **65 条完整**（童贞/贞洁誓言/神殿之担 + 异装癖/色情脑/园艺大师/植物恋人/花蜜上瘾 + 耳粘液专注 + 怀孕系列 8 档 + 哺乳期/乳液狂飙/精子银行 + 附身 + 狼/猫/牛/鸟妖/狐 兽化系列 + 獠牙/锐眼/异色瞳/坚固之角 + 追逐的快感/终身伴侣 + 堕落天使/铁意志/天使/梦魔魅魔/圣光璀璨/翅膀 + 温顺/顺从/叛逆/反抗 + 受虐狂/施虐狂 各 4 档 + 农夫 + 知识：海岛语言/流沙 + 上古技艺/镜中疯狂/夜之眼），全部 name 统一为**可读静态名**，has 保留原判定条件；②`zhTraitName` 支持 **A/B 多段（全角／半角/）逐段映射**（`Breasts／Flat Chest`→胸部 / 平胸、`familiar collar／Hypnotic Devotion／Hypnotic Curiosity`→催眠项圈 / 催眠虔信 / 催眠好奇、`Severe Panic Attacks／Controlled Severe Panic Attacks`→严重惊恐发作 / 受控的严重惊恐发作）、**函数源码型 name 提取 return 模板映射**（`${penisSize}`→接纳：阴茎、`${breastSize}`→接纳：胸部）；③函数源码型/超长模板型**描述不展示**（防源码泄漏）；④同分类同中文名**渲染去重**（原 widget 多段/函数名同语义只显示一行）；⑤获取时 `isnot + 字符串值`（如 `"none"`/`"prospective"`）无法推断满足值→**跳过不写**（防写坏条件，耳粘液专注等只读展示）；
  - **验证**：全部 **170 条**特质显示名中文化（未中文化 0 条、无函数源码、无乱码）+ 全量回归通过（新增 39.9 节 7 条：全表中文断言 + 函数源码/多段名/催眠项圈/圣光璀璨/知识映射）。

- **v1.8.0（2026-10-18 · 特质管理：删玩家属性/模组属性区，原位置全量特质管理 + 模组特质自动发现）**：
  - **删除**「玩家自己」页的 **玩家属性区**（player 对象全量递归）与 **模组属性区**（V 顶层键-原版清单），**只保留**游戏属性面板（颜色分级）快捷编辑区；原位置新增 **特质管理**区；
  - **原版特质全量收录（114 项 / 9 分类，自本体 traits widget 自动提取）**：一般（童贞/贞洁誓言/破誓/承诺仪式/神殿之担：%/纯洁增幅/异装癖/色情脑/园艺大师/花蜜上瘾/哺乳期/乳液狂飙/精子银行/狼/猫/牛/鸟妖/狐/獠牙/异色瞳…）、药物（生发配方/避孕药/各阻断增大缩小药）、特殊（享乐主义者/窒息癖/幸存者/女巫/驯兽师/猎物…）、学校（及格的科学/优异的科学…在校表现优秀/科学博览会冠军/数学竞赛冠军/舞台剧演员）、创伤（噩梦/焦虑症/幻觉/受控系列/解离）、NPC（同舟共济：罗宾/斯德哥尔摩系列/艾弗利的救星）、催眠（暗示/渴望/炫耀/异变 各 5 档/虔信/平静/沉默/沉睡/无知）、接纳（假小子/平胸/怀孕）、麋鹿印记（伤痕→之嗣 5 档）；
  - **每项特质可直接「获取」/「移除」**：解析 has 条件表达式（is/isnot/gte/gt/lte/lt/and/or/includes/嵌套/全局函数兜底），获取时**条件不满足自动写满足**（如童贞 → `player.virginity.vaginal+penile=true`；神殿之担 → `temple_burden=1`；异装癖 → `backgroundTraits` 追加），移除时主变量写回不满足（0/false/移除数组项）；
  - **有数值的特质可直接改数值**：has 中数字比较变量自动识别为可改项（神殿之担 `temple_burden`、学校成绩档位、催眠档位等），写入走 player-self 留痕通道 + 每项回退按钮；**动态显示名**实时插值（如「神殿之担：15%」随数值变化）；中文名映射 200+（未收录兜底英文原名）；
  - **模组特质自动发现**：运行时读取 `maplebirch.temporary.traitLists`（MLI 框架 `traits.inject` 注入后的特质表），战锤四神注视/无形之术/催眠系列等模组注入特质**自动收录**显示（拥有状态用注入的 has 函数判定），按注入分类分组、标记「模组」；装了显示、没装隐藏，不写死；
  - **兼容导出保留**：isModOnlyRoot / ORIGINAL_V_ROOT_KEYS / cheatWriteValuePlayer / undoPlayerValue 仍可用（数据层）；
  - **验证**：570 项断言全过（新增第 39 节 16 条：原版表 114 项/9 分类、拥有判定、获取/移除写条件、数值改+留痕回退、复杂表达式求值、中文名、模组特质发现与 has 判定；第 37/38 节渲染断言迁移至新 UI——玩家属性/模组属性区已删除、特质区+模组特质分类渲染、无英文残留）。

- **v1.7.2（2026-10-18 · 游戏属性面板（颜色分级）快捷编辑）**：
  - **玩家自己 · 全属性编辑页顶部新增「游戏属性面板（颜色分级）快捷编辑」区**：直接改游戏面板显示的核心属性/基础技能/性技能/学校成绩/武器技能（变量实证自本体 0.5.12.13：核心属性 purity/beauty/physique/willpower/awareness/promiscuity/exhibitionism/deviancy 顶层键；基础技能走 currentSkillValue 体系 skulduggery/danceskill/swimmingskill/athletics/tending/housekeeping；性技能 seductionskill/oralskill/chestskill/handskill/bottomskill/penileskill/vaginalskill/analskill/thighskill/feetskill；成绩 science/maths/english/history；武器技能 $prof 对象 spray/baton/whip/net/pickaxe）；
  - 每项显示**当前原始值** + 数字输入 + 应用 + 回退（留痕独立还原首次）；$prof 缺失自动补空壳（只建不覆盖，防崩）；全中文键名；
  - **不收录**：歌唱/驾驶（原版无对应变量，GameUI 自定义/未解锁）、不安感（面板无数值显示）；
  - **验证**：580 项断言全过（新增第 38 节 49 条：5 组清单覆盖 29 项中文名、顶层/武器写入、补壳、回退、当前值读取、DOM 渲染无英文残留、与玩家区共存）。
- **v1.7.1（2026-10-18 · 玩家编辑页全中文显示）**：
  - **玩家自己 · 全属性编辑页全面中文化**：玩家属性键名（金钱/姓名/童贞/神殿/有无阴茎 等 150+ 键）、类型（数值/布尔/文本/对象）、路径（玩家.童贞.神殿）全部中文显示；模组键（罗宾神殿/智能手机/枯木逢春 等）同步中文；未收录键兜底显示原名；**显示层翻译不影响数据层**——写入/回退/留痕始终用原键名，存档键名零污染；
  - **验证**：531 项断言全过（新增第 37 节 17 条渲染中文化：纯函数翻译 + DOM mock 渲染断言 + 双语切换 + 原键名写入隔离）。
- **v1.7.0（2026-10-18 · 场景直达新增多伦公寓/麋鹿街大院 + 玩家自己全属性编辑）**：
  - **场景直达 +2 组（共 8 组）**：
    - 多伦 · 公寓与阁楼（`Doren Entrance` 为主段落）：收录公寓内全部段落（`Doren Entrance` 进入 / `Doren Talk` 闲聊 / `Doren Cry` 哭泣 / `Doren Shower` 系列淋浴，均实证 `$location="flats"`）+ **孤儿院阁楼布置线 `Doren Loft` 系列**（用户点名一并收录）；排除户外/学校段落（Doren Jog / Beach Volleyball / School Infirmary / Hot Chocolate 等）；
    - 麋鹿街 · 大院（`Elk Compound` 为主段落）：原版 73 段前缀全量（Interior 室内 / Underground 地下 / Central 中央区 / Station 站台 / Wraith 怨灵线 / Possessed 附身线 / Machine / Experiment / Tentacles / Crystal / Bestiality / Fight 等）；`Docks Compound`（码头大院）不误入；
    - **世界入口**：麋鹿街大院传送后写 `$compound.allowed=true` + `$compound.discovered=true`（本体 Elk Street「Approach the compound」链接实证，幂等不覆盖）；多伦公寓为剧情/时间触发，无持久入口仅传送；
  - **玩家自己（Player）· 全属性编辑**（Mod作弊 主容器页顶部新增入口卡片）：
    - **玩家属性区**：`player` 对象全量动态枚举（不硬编码）——原版全部属性 + 模组运行时写入 player 的键（LostLamb 写 gender/penisExist 等、SmartPhone 写 gender、GameUI 写外观）全量呈现；数值（数字输入）/ 布尔（勾选）/ 阶段（短字符串 ≤24 字符无空白 → 文本输入）可更改，长文本/函数/undefined/null 只读；对象与数组递归展开（限深 3 层），循环引用自动只读防崩；
    - **模组属性区**：运行时 V 顶层键 **- 原版键清单（183 键，本体宏上下文实证）** - 面板自身键 = 只列出原版没有的模组键（用户口径：比较原版只添加没有的，原版有的不重复添加）；
    - **写入复用 Mod作弊 通道**（root=player/模组键均不在原版黑名单）：类型校验 + 父级缺失拒绝 + 留痕 `V.mbCE_wrote`（modId=player-self）+ 每项回退按钮；顶部关键词过滤 + 玩家区/模组区一键切换；
  - **验证**：514 项断言全过（新增第 34 节 9 条场景直达新组 + 第 35 节 15 条玩家编辑 + 第 36 节 18 条综合链路交叉校验；第 10 节分组计数同步 6→8）。综合链路校验结论：改数值/场景直达/改阶段三线交叉无冲突——场景直达后玩家数值保持、玩家编辑后模组阶段保持、同一路径双通道（Mod作弊 模组子页 / 玩家页）留痕独立互不干扰、错误路径（越界/宿主缺失/深层缺失/不存在段落）全部拒绝不崩、所有更改读回成功。
- **v1.6.0（2026-10-18 · 六模组更新适配 + 新模组兼容）**：
  - **归途之书 1.3.4 补录两大模块（1.3.1 起已注册但此前漏适配——"阶段没收录"根因闭环）**：LostLamb（迷途羔羊·悉尼童年梦境线，V.LostLamb）：阶段 2（talkVow 誓约 5 档 / ending 结局 4 档）+ 数值 3（疑虑/恐惧/觉察 0-100）+ 能力 5（recalled / active / known 主教·格威岚·御夫座秘密）；TempleDuties（神殿值勤系统，V.TempleDuties）：阶段 6（oath 誓言 3 档 / bishop 主教进展 5 档 / manor 庄园线 5 档 / declaration 宣言 2 档 / watch.phase 守夜 7 档 / case.stage 案件 3 档）+ 数值 4（duties 值勤 0-999 / archive 屋顶·书架·归档）+ 能力 4（enrolled / review / 罗宾·悉尼候选同意）；RobinTemple/TempleChoir 常量 1.3.1→1.3.4 无变化，旧声明全部保留；
  - **枯木逢春 2.2.7 核对（20 模块 define 全同、V 键名不变，super name 逐一实证）**：仅 vanilla-plus 结构迁移（beauty 清空为 {}、新增 attitudes 特质）——原声明全部兼容；新增能力 2 项：铁意志 ironWill / 受虐狂 sadomasochist（VanillaPlus.attitudes.*）；
  - **新增 SmartPhone Alpha 0.3.91 适配（万能的智能手机，V.Phone 48 键实证）**：阶段 1（老冯线 FengLine 0/1/2）+ 数值 7（摄影 photography 0-1000 / 危险任务模式 TaskDanger 0/1 / 初遇老冯 / 放弃老冯线 / 发现二手店 / 暴露场景计数 0-99 / 悉尼直播陪伴）；模组键全部为 0/1 数字语义（===1 判断），一律走 number 型 values（checkbox 布尔会写 true 破坏判断）；应用数据类（闹钟/备忘录/相册）为内容对象不提供数值作弊（防结构损坏）；
  - **环境包结论**：maplebirch 5.4.12 满足两内容模组新依赖（≥5.4.9 / ≥5.4.10）；SoftWet GameUI 2.7.0 / ModHub 1.7.6 为纯 UI 皮肤与管理工具（无状态键），确认不冲突、无需适配；
  - **验证**：470 项断言全过（新增第 31 节 21 条 LostLamb/TempleDuties + 第 32 节 6 条 attitudes/2.2.7 兼容 + 第 33 节 11 条 SmartPhone；19.1/21.1/21.2 分组计数更新）。
- **v1.5.2（2026-10-16 · 剧情页页首新增固定触发使用提示）**：
  - 按用户给定文案在「剧情」页（Mod作弊 · 剧情页）**最上边**常驻一条黄色警示提示：「当你使用固定触发后，会一直循环。当出现退出场景时，回到此页面取消队列。之后你会被困在场景播放器中，请使用场景直达退出去。」；
  - 位置在固定触发状态横幅之前，任何状态下都可见；新增 `mce-warn` 警示框样式（黄底金边）；
  - **验证**：432 项断言全过（新增第 30 节 3 条：用户文案全文已写入 / 提示位于 renderScenes 页首、固定触发横幅之前 / mce-warn 样式已注入）。
- **v1.5.1（2026-10-16 · 修复「直达艾弗里庄园后早上餐厅对话崩溃」）**：
  - **现象**：用户通过面板「场景直达」解锁艾弗里庄园后，早上在餐厅与艾弗里对话（Mansion Talk）报错三连——`<<avery_daily_talk>>` bad conditional expression（`TypeError: Cannot read properties of undefined (reading 'chat')`）、第二处同形（`reading 'ignore'`）、连锁「The passage Mansion Talk has no usable links」；
  - **根因（已实证本体 0.5.12.13 源码）**：`$daily.avery.talk` / `$daily.avery.ask` 对象**只在两个路径创建**——①`avery_mansion_init`（首次进入庄园的 Mansion Intro）；②0.5.7.1 版本迁移（`avery_mansion.version is 3`）。`$daily.avery` 本体在新档初始化时仅为 `{}`（183255 行）。而 `avery_daily_talk` widget 的"兜底"（`<<if $daily.avery.talk.chat is undefined>>`）在 `$daily.avery.talk` **整体缺失**时访问 `talk.chat` 直接抛 TypeError（SugarCube 逐层属性访问无空检查），Mansion Talk 正文读 `$daily.avery.talk.ignore/.limit` 同理——任何未经 Mansion Intro 初始化就进入 Mansion 系段落的路径（场景直达、场景查看器重放、固定触发、未开艾弗里线新档）都会崩；
  - **修复**：①`ensureAveryMansion()` 兜底强化为**逐层 + 逐字段补齐**——`$daily` 整体缺失时防御建最小壳；`talk`/`ask` 对象缺失时建完整默认结构（ignore/limit/flirt/seduce/annoyed/chat/chat_limit + science/maths/play）；对象已存在但个别字段缺失时逐字段补默认；**已有值绝不覆盖**（chat=2、ignore=true 等保留）；②`onPassageOverride`（`:passageoverride` 全局跳转钩子）在固定触发判定**之前**对 Mansion/Avery 开头段落无条件兜底——无论以何种方式进入（场景直达、重放、固定触发、第二天正常日常）都先确保 `$daily.avery.talk` 存在；
  - **验证**：429 项断言全过（新增第 29 节 9 条：talk 缺失补齐 / $daily 缺失防御建壳 / 已有值不覆盖 + 缺失字段补齐 / onPassageOverride 对 Mansion Talk 跳转前兜底 / 非庄园段落不触发 / Mansion Intro 与 Avery's Mansion 变体全覆盖）。

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
  - **内置适配器（首版）**：More Love Interests Mod 0.1.8.0——探测键 `setup.foodPreference`（模组无条件注入，卸载即消失），可操控项：扩容恋人列表 `$loveInterestList`（11 槽，勾选候选 NPC 加入/移出，模组自身的条件剔除逻辑如 Remy/Black Wolf/Avery 由模组 widget 照常执行）；`$loveInterest.primary..undecimal` 由模组 widget 从列表自动重建，面板不直接写；
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

六大面板（**完整操作手册见顶部「使用手册」章节**）：

- **角色页**：动态枚举 Maplebirch 注册池（本体 + 全部 MOD 角色，实测 16 个），显示爱意/支配/情欲/警戒，点击进入阶段页。
- **阶段页**：恋爱条件逐条求值（绿=已达成 / 红=未达成，附中文条件说明）；一键完成 + 数值 ±10 + 留痕回退。
- **剧情页**：实时解析场景注册表，剧情线分阶段 + 一键完成 + 固定触发（队列一次性）。
- **场景页**：8 组特殊场景直达（孤儿院阁楼 / 凯拉尔庄园 / 悉尼神殿 / 西里斯学校与商店 / 艾弗里庄园 / 格威岚花园与森林商店 / 多伦公寓与阁楼 / 麋鹿街大院），永久解锁 + 世界入口写入。
- **全局页**：全部角色一键补齐数值、一键解锁全部恋爱/转化阶段、誓言修复、NPC 特质获取。
- **Mod作弊页**：第三方模组扩展内容作弊控制（5 个适配器 + 玩家自己全属性编辑 + 特质管理）。

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

> 安装步骤与加载自检已并入顶部「安装（快速开始）」章节，此处保留历史版本入口说明：游戏内 `Alt+M` 添加旁加载 Mod 后刷新，右下角出现金色圆形 **CE** 悬浮按钮即成功；`typeof setup.mbStageCE` 返回 `"object"` 可确认加载。

## 文件结构

```
MapleBirchCE.mod.zip
├── boot.json                      # ModLoader 清单
├── javascript/maplebirchce.js     # 全部逻辑（scriptFileList_inject_early）
├── twee/maplebirchce-widget.twee  # Cheats 菜单入口（可选）
└── README.md
```

依赖声明（boot.json `dependenceInfo`）：`ModLoader >=2.0.0`、`GameVersion >=0.5.12.13`、`maplebirch >=5.4.2`。

## 开发与工程化（v1.9.0 工具链）

源码仓库采用**开发多文件 + 构建合并单文件**模式，交付物结构不变：

```
MapleBirchCE/（git 源码真相源）
├── javascript/
│   ├── src/                       # 开发源，按功能域拆 17 段（改代码改这里）
│   │   ├── 00-preamble.js         # 顶部版本注释 + IIFE 头
│   │   ├── 01-core.js             # 基础：版本号/框架解析/数值/中文/角色枚举/数值读写
│   │   ├── 02-romance.js          # 恋爱剧情阶段 + 转化阶段
│   │   ├── 03-global.js           # 全局批量（格威岚防崩/属性中英映射）
│   │   ├── 04-modcheat.js         # Mod作弊适配器 + 通用写入执行器 + 回退
│   │   ├── 05-modcheat-ui.js      # Mod作弊动态发现 + 渲染 + 玩家属性编辑
│   │   ├── 06-traits.js           # 特质管理：静态表/编译/系列合并/强制获得/渲染
│   │   ├── 07a-shell.js           # 面板基础：CSS/el/injectCSS/setStatus/标签切换
│   │   ├── 07b-char.js            # 角色一览卡片
│   │   ├── 07c-stage.js           # 阶段页数据卡 + 内层标签
│   │   ├── 07d-places.js          # 特殊场景直达（8 组）
│   │   ├── 07e-scenes.js          # 剧情数据层：场景注册表解析/求值/一键完成
│   │   ├── 07f-pins.js            # 固定触发 + 段落钩子 + 农场/庄园/格威岚防崩兜底
│   │   ├── 07g-romance.js         # 恋爱/转化阶段渲染
│   │   ├── 07h-render.js          # 剧情页渲染 + 全局页
│   │   ├── 08-npc-traits.js       # NPC 特质表与获取
│   │   └── 09-exports.js          # render/init/mountApi + 导出区 + IIFE 尾
│   └── maplebirchce.js            # 构建产物（build 生成，勿手改）
├── tools/
│   ├── build_js.js                # 拼接 src → 单文件（--sync-pkg <打包源> 顺手同步）
│   ├── split_js.js                # 全文件切分脚本（重建 SHA 自检；07 段再拆已并入 07a-07h）
│   ├── audit_adapters.js          # 模组升级核对：扫描第三方模组源码 V 路径 vs 适配器声明
│   ├── resolve_missing.js         # 缺失条目自动定案：对 audit 报告的每项自动判 KEEP/REVIEW/REMOVE（见下）
│   ├── check_framework_api.js     # 框架兼容性核对：框架新版 inject_early.js 中 CE 依赖的 API 是否保留
│   ├── check_mod_updates.js       # 模组更新检测：GitHub Releases 最新版 vs 适配器声明（每日定时任务调用）
│   ├── run_all.ps1                # 一键验证链（见下）
│   └── install-hooks.ps1          # 安装 pre-commit 钩子（core.hooksPath → githooks/）
├── githooks/
│   └── pre-commit                 # 提交前自动跑一键验证链，失败阻止提交
├── tests/
│   ├── smoke_dom.js               # jsdom 浏览器级 DOM 冒烟（真实 DOM 语义）
│   ├── test_mce.js                # 全量回归（570+ 断言，读 git 源构建产物，可用 MCE_PKG_JS 覆盖）
│   └── package.json               # jsdom 依赖
└── README.md
```

**一键验证**（日常改完代码只需一条命令）：

```powershell
.\tools\run_all.ps1            # build → 语法 → DOM 冒烟 → 全量回归
.\tools\run_all.ps1 -Pkg <打包源目录>   # 额外把构建产物同步到打包源
```

**提交前自动验证**（推荐）：跑一次安装脚本，此后每次 `git commit` 自动先执行一键链，失败则阻止提交：

```powershell
.\tools\install-hooks.ps1      # 设置 core.hooksPath → githooks/（本地配置，新 clone 后需重跑一次）
```

`githooks/pre-commit` 随仓库提交；紧急绕过可用 `git commit --no-verify`（不推荐）。非 Windows 环境无 `powershell.exe` 时钩子自动跳过，不阻塞提交。

**日常开发流程（LRN-003 五步升级版）**：改 `javascript/src/*.js` → 一键命令（或手动：build → check → smoke → 全量回归）→ 打包 `pack_v11.ps1` → `verify_v11.ps1`（boot 版本 + 包内 SHA == 构建产物）→ verifier 校验 → 交付。测试默认读 git 源构建产物（与打包源解耦）；需要核对打包源时设环境变量 `MCE_PKG_JS`。

**第三方模组升级核对（audit_adapters.js）**：模组发布新版后，运行
`node tools/audit_adapters.js <适配器id> <新源码目录>`，自动比对适配器声明的 varPath 与源码实际写入的 V 路径，输出缺失（改名/删除）/ 新增候选 / 覆盖率，辅助判断是否需要补适配。适配器 id：`revelation-the-book-of-return` / `dom_robin` / `deadwood-reblooms` / `more_love_interests` / `SmartPhone`。

**缺失条目自动定案（resolve_missing.js）**：`audit_adapters.js` 报出的"缺失"多为盲区假报（`this.state.xxx` 别名访问、twee 别名、动态键 `obj[_ordinand].leaf`），逐条人工 grep 验证很费时。运行
`node tools/resolve_missing.js <适配器id> <新源码目录>` 自动判定每条缺失为 **KEEP**（源码确实存在，audit 误报）/ **REVIEW**（疑似存在需复核）/ **REMOVE**（零证据真缺失，模组删字段）。证据链六类：字面 V/$root 路径、连写 parent.leaf、父根定义块 leaf 类型/默认值、`this.state.leaf` + state 绑定属主校验、叶子键字符串/动态键、零证据。判定原则：宁可"存在"不误删，REMOVE 只给零证据或"属主不符+模块目录零出现"。已对枯木逢春 2.4.1（42 条全 KEEP，含 duties.completed）/ 归途之书 1.3.7（56 条全 KEEP，含 rite_round/faith_band/动态键）/ MLI 0.1.8.0（1 条 KEEP）实测，与人工 grep 结论一致。

**框架兼容性核对（check_framework_api.js）**：maplebirchFramework 发布新版时，先下载新版 `.mod.zip` 解压出 `dist/inject_early.js`，运行
`node tools/check_framework_api.js <inject_early.js 路径>` 核对 CE 运行时依赖的框架 API（`window.maplebirch` / `maplebirch.get` / `maplebirch.npc(.data)` / `maplebirch.temporary.traitLists`）是否全部保留。核心 API 全保留才把 `tools/check_mod_updates.js` 框架渠道的 `declOverride` 更新为新版本。已核对 5.4.12→**5.5.0**（2026-10-19）：核心 6 项全过，`setup.MapleBirch` 回退缺失无害（5.5.0 走 `window.maplebirch` 主路径，回退仅老环境兜底）。

**v1.8.4 select.type 崩溃的防再犯体系**（三层）：
- 源码已删除对 `<select>` 赋值只读 `type` 的代码（留注释警示）；
- 单元测试 mock（`mkNode`）对 select 用 `Object.defineProperty` 复现只读 `type`（getter 返 "select-one"、setter 抛 TypeError），断言渲染树 select 只读；
- DOM 冒烟把 jsdom 的 `HTMLSelectElement.prototype.type` patch 为抛错 setter（jsdom 原生赋值静默忽略、与真实浏览器不同），渲染玩家页/Mod作弊页时任何对 select.type 的赋值都会像真实浏览器一样抛错中断。
