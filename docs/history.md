# 历史记录（v1.x → v2.x）

> 从 README.md 拆分（2026-11-09）。定位是**追溯用**，不是当前用法：当前功能与用法以 README 正文为准，逐版本改动看 CHANGELOG.md。
> 历史条目里出现的「当前版本」字样都是当时快照，不代表现在。


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

- **角色页**：动态枚举 Maplebirch 注册池（本体 + 全部 MOD 角色 + 持久 NPC），v1.9.0 起按类型拆为 **模组角色 / 恋爱角色 / 普通角色 / 持久NPC** 四个子页面（默认收起、点击标题按钮展开，状态记忆）；持久 NPC 收录经理（随机名）/ 校医 / 黑客·米奇 / 主教与左右侍 / 守卫囚犯 / 黑狗 / 皮奇 / 坐骑 / 内衣贼 / 艾利克斯父母 / 惠特尼姑叔等；卡片显示爱意/支配/情欲/警戒，点击进入阶段页。
- **阶段页**：恋爱条件逐条求值（绿=已达成 / 红=未达成，附中文条件说明）；一键完成 + 数值 ±10 + 留痕回退。
- **剧情页**：实时解析场景注册表，剧情线分阶段 + 一键完成 + 固定触发（队列一次性）。
- **场景页**：双层子界面——**场景直达**（8 组特殊场景直达：孤儿院阁楼 / 凯拉尔庄园 / 悉尼神殿 / 西里斯学校与商店 / 艾弗里庄园 / 格威岚花园与森林商店 / 多伦公寓与阁楼 / 麋鹿街大院，永久解锁 + 世界入口写入）+ **地点**（v1.9.0 新增：地点阶段任务作弊区，17 项原版阶段变量直改——市政改造 5 项目 / 农场 farm_stage+farm_phase / 公寓区 / 成人用品店 / 阁楼 / 妓院机械 / 修道院 / 精神病院 / 学校科学项目等，−1/+1/拉满 + 留痕回退）。
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
│   ├── src/                       # 开发源，按功能域拆 67 段（改代码改这里）
│   │   ├── manifest.json          # 段序唯一真源：67 段有序清单 + 层标签（段序即依赖序，不再靠文件名字典序）
│   │   ├── 00-preamble.js         # 顶部版本注释 + IIFE 头
│   │   ├── 01-core.js             # 基础：版本号/框架解析/数值/中文/角色枚举/数值读写
│   │   ├── 02-romance.js          # 恋爱剧情阶段 + 转化阶段
│   │   ├── 03-global.js           # 全局批量（格威岚防崩/属性中英映射）
│   │   ├── 04a-00-core.js          # Mod作弊适配器注册表容器（var CHEAT_ADAPTERS = {}，须最先拼接）
│   │   ├── 04a-01-revelation.js    # 适配器：归途之书（v1.9.13 将原 04a-modcheat-adapters.js 按模组拆分）
│   │   ├── 04a-02-mli.js           # 适配器：More Love Interests
│   │   ├── 04a-03-domrobin.js      # 适配器：DomRobin
│   │   ├── 04a-04-deadwood.js      # 适配器：枯木逢春（最大块）
│   │   ├── 04a-05-smartphone.js    # 适配器：SmartPhone
│   │   ├── 04a-06-dolopt.js        # 适配器：Dol-Optimization
│   │   ├── 04a-07-wraiths.js       # 适配器：Wraith's Reflection
│   │   ├── 04a-08-dolsims.js       # 适配器：DoLSims
│   │   ├── 04a-09-cattery.js       # 适配器：Cattery
│   │   ├── 04a-10-morefarm.js      # 适配器：More Farm Upgrade（农场 11 设施/资源/农夫）
│   │   ├── 04a-11~16-*.js          # 后续新增段（本清单未逐条展开）：dolmod 适配器 / 预言者声明(04a-13) / 十项动作(04a-14) / 孩子页数据层(04a-15) + 数值写入层(04a-15b：养育四项/先天四项) + UI(04a-16)
│   │   ├── 04b-modcheat-write.js  # 通用写入执行器 + 回退
│   │   ├── 04c-modcheat-util.js   # 适配器标准化/审计工具
│   │   ├── 05-modcheat-ui.js      # Mod作弊动态发现 + 渲染 + 玩家属性编辑
│   │   ├── 06a-traits-data.js     # 特质静态表/中文翻译（原名 06-traits.js 数据段）
│   │   ├── 06b-traits-eval.js     # 特质求值/写入链
│   │   ├── 06c-traits-ui.js       # 特质/系列渲染 + 收藏 + 数值编辑
│   │   ├── 06d-traits-gender.js   # 性别切换（七键联动）
│   │   ├── 07a-shell.js           # 面板基础：CSS/el/injectCSS/setStatus/标签切换
│   │   ├── 07b-char.js            # 角色一览卡片
│   │   ├── 07c-stage.js           # 阶段页数据卡 + 内层标签
│   │   ├── 07d-places.js          # 特殊场景直达（8 组）
│   │   ├── 07e-scenes.js          # 剧情数据层：场景注册表解析/求值/一键完成
│   │   ├── 07f-pins.js            # 固定触发 + 段落钩子 + 农场/庄园/格威岚防崩兜底
│   │   ├── 07g-romance.js         # 恋爱/转化阶段渲染
│   │   ├── 07h-render.js          # 剧情页渲染 + 全局页
│   │   ├── 07i-yanling-core.js    # 言灵页策略层：存档状态读写 / isCrossdressing 钩子装卸 / 三项存量净化 / 开关与 1s 守卫（原 07i-yanling.js 1-262 行）
│   │   ├── 07i-yanling-actions.js # 言灵页动作层：12 组一键动作（衣物湿度耐久 / 体液精神 / 数值快补 / 天气 / NPC state 层）+ 角色与放逐（原 263-623 行）
│   │   ├── 07i-yanling-page.js    # 言灵页渲染层：A/B/C 三组九区块 + 页尾说明折叠块 + 加载即起守卫（原 624-856 行）
│   │   ├── 08-npc-traits.js       # NPC 特质表与获取
│   │   └── 09-exports.js          # render/init/mountApi + 导出区 + IIFE 尾
│   └── maplebirchce.js            # 构建产物（build 生成，勿手改）
├── tools/
│   ├── build_js.js                # 拼接 src → 单文件（读 src/manifest.json 定段序；--check 只校验不写 / --write-manifest 登记新段 / --sync-pkg <打包源> 顺手同步）
│   ├── check_structure.js         # 结构门禁：段长预算（默认 400 行，超出预算即 fail）/ 续号命名 / 注册表容器重复声明（WARN）
│   ├── structure-baseline.json    # 结构门禁基线：maxLines 400 + lineAllowlist（现为空，07i 拆分后无豁免）+ 续号白名单 9 项
│   ├── check_src_types.js         # src 侧类型分账：manifest 拼联合文件 → strict:true → 错误按行区间映射回 src 文件 → 与基线棘轮（同时硬校验 src/产物 SHA 同步）
│   ├── src-types-baseline.json    # src 类型债务基线：26 文件 / 169 条真债务（隐式 any 家族 1019 条不计账）
│   ├── lib/adapter_ir.js          # 适配器 IR 装载器：vm 沙箱按 manifest 段序跑 04a-*.js，取回 13 个适配器的真实 entry
│   ├── validate_adapters.js       # 声明 schema 校验：字段白名单 / 必填 / 类型枚举 / 数值域 / levels-labels / sync / varPath 形状 / modId 一致 / detect 缺失
│   ├── gen_adapter_matrix.js      # 声明驱动矩阵生成：442 条 / 1006 探针（--check 漂移检测 / --stdout）
│   ├── audit_adapters.js          # 模组升级核对：扫描第三方模组源码 V 路径 vs 适配器声明
│   ├── resolve_missing.js         # 缺失条目自动定案：对 audit 报告的每项自动判 KEEP/REVIEW/REMOVE（见下）
│   ├── check_framework_api.js     # 框架兼容性核对：框架新版 inject_early.js 中 CE 依赖的 API 是否保留
│   ├── check_mod_updates.js       # 模组更新检测+自动替换：GitHub Releases 最新版 vs 适配器声明；--apply 自动下载官方包替换 game 旧包（每日定时任务调用）
│   ├── gen_direct_exit_matrix.py  # 剧情直达穷举矩阵：解析原版 HTML（110 场景/16000+ 段）→ 独立 R1-R6 规则判定 → tests/data/direct_exit_matrix.json（原版 HTML 更新后必须重跑，19.18 会校验 SHA256 同步）
│   ├── gen_key_registry.js        # 键注册表生成/校验：扫描 04a-*.js 的 key+varPath → keys.registry.json（--write / --list / 无参校验）
│   ├── report_branch_gaps.js      # 分支覆盖归因：c8 JSON → 产物行号回落到 src 分片（--md / --top N）
│   ├── run_all.ps1                # 一键验证链（见下）
│   └── install-hooks.ps1          # 安装 pre-commit 钩子（core.hooksPath → githooks/）
├── keys.registry.json             # 442 条 varPath 单一真源（13 适配器；gen_key_registry.js 生成，勿手改）
├── tsconfig.json                  # tsc 类型闸门配置（allowJs+checkJs，检查拼接产物；不参与打包）
├── types/
│   └── sugarcube-ambient.d.ts     # SugarCube/DoL 运行时全局声明（仅供 tsc，不打包）
├── githooks/
│   └── pre-commit                 # 提交前自动跑一键验证链，失败阻止提交
├── .github/
│   └── workflows/
│       └── ci.yml                 # 远端 CI（push main / PR / 手动）：npm ci + 同一键链的 11 步（无 moli/打包/codegraph/原版 HTML）
├── tests/
│   ├── smoke_dom.js               # jsdom 浏览器级 DOM 冒烟（19.17 地点×出口穷举 / 19.18 SHA256 同步 / 19.19 间接结束信号审计 / 19.20 多跳序列 / 19.21 注释信号剔除 / 19.22 直达态出口玩家路径）
│   ├── data/
│   │   ├── direct_exit_matrix.json # 地点×出口组合矩阵：2158 条 (场景,当前段,Next目标) + 110 场景白名单（gen_direct_exit_matrix.py 产物，勿手改）
│   │   └── direct_exit_matrix.meta.txt # 生成摘要（路径/bytes/srcHash/规模/规则分布/冲突数/间接结束信号审计）
│   │   └── adapter_matrix.json    # 适配器声明矩阵：442 条 / 1006 探针 / 13 适配器（gen_adapter_matrix.js 产物，勿手改）
│   ├── test_mce.js                # 全量回归（1,548 个 assert 调用；运行输出 PASS 计数 1,658，两者口径不同勿混用；读 git 源构建产物，可用 MCE_PKG_JS 覆盖）
│   ├── test_adapter_matrix.js     # 声明矩阵回读（6,049 断言：写入→回读→留痕路径→sync 条件→undo 还原；可用 MCE_MATRIX / MCE_SRC_DIR 覆盖）
│   └── package.json               # 历史遗留的测试依赖声明（jsdom 已提升到根 package.json devDependencies，CI 走根 npm ci）
└── README.md
```

**一键验证**（日常改完代码只需一条命令）：

```powershell
.\tools\run_all.ps1            # build（manifest 段序 + 结构门禁）→ 语法 → ESLint → DOM 冒烟 → 全量回归 + 声明矩阵 → E2E → 性别集成 → 声明 schema 校验 + 矩阵幂等 + 声明一致性 → 原版档位 → 覆盖率 → tsc → 键注册表（12 步）
.\tools\run_all.ps1 -Pkg <打包源目录>   # 额外把构建产物同步到打包源
```

**提交前自动验证**（推荐）：跑一次安装脚本，此后每次 `git commit` 自动先执行一键链，失败则阻止提交：

```powershell
.\tools\install-hooks.ps1      # 设置 core.hooksPath → githooks/（本地配置，新 clone 后需重跑一次）
```

`githooks/pre-commit` 随仓库提交，且为 **fail-closed**：优先 `powershell.exe`，其次 `pwsh`，两者都没有则**阻止提交**（不再静默跳过整条验证链）。紧急绕过可用 `git commit --no-verify`（不推荐，自担风险）。

**远端 CI**：`.github/workflows/ci.yml` 在 push 到 `main` / PR / 手动触发时跑与 `run_all.ps1` 同口径的 12 步（`npm ci` → build + 结构门禁 → `node --check` → ESLint 八规则 → 适配器声明门禁（schema + 矩阵幂等）→ DOM 冒烟 → 全量回归 + 声明矩阵 → E2E + 性别集成 → 面板开关稳定性循环 → 覆盖率门禁 90/80/95 → tsc → 键注册表一致性），跑在 `ubuntu-latest` + **node 22** 上（node 20 会让 jsdom@30 的传递依赖 `undici@8` 在 `require` 阶段报 `Cannot read properties of undefined (reading 'bind')`，见 `.learnings/ERRORS.md#ERR-20261106-011`）。原版 64MB HTML 不入库，因此依赖它的用例在 CI 上**按设计 SKIP**：smoke 的 19.5-19.8（剧情页 UI）与 19.14b、以及性别集成测试；矩阵（`tests/data/direct_exit_matrix.json`）随仓库走，19.17/19.19/19.20/19.21/19.22 等判据断言在 CI 上照常强制。**CI 口径覆盖率略低于本地**（缺原版 HTML 时这些用例 SKIP、不计覆盖），具体数值以该次 Actions 日志的 Coverage summary 为准。

**架构门禁（v2.0.4 P0-P4，外部评估五条落地的对应物）**

- **段序显式化（P0）**：`javascript/src/manifest.json` 是构建顺序的唯一真源（现 **67 段**），`build_js.js` 只按它拼；`--check` 只校验不写，`--write-manifest` 按目录名序登记新段并自动打层标签。**fail-closed 六种不一致**：manifest 缺失 / JSON 非法 / `segments` 非数组或空 / 缺段 / 多段或重复登记 / 指向不存在的文件或未知层 / **层序回退**。产物末尾打印 `order <指纹>`（`sha256(segs.join("|"))` 前 12 位），改名段文件不再改变段序。
- **结构守门（P0）**：`tools/check_structure.js` 三条规则——S1 单段预算（默认 400 行，`structure-baseline.json` 的 `lineAllowlist` 是**预算制豁免**，现为空 `{}`：`07i` 拆三段后已无超长段）；S2 续号命名（剥掉末位数字后等于另一个真实段才算续号，白名单 9 项）；S3 注册表容器重复声明（WARN）。
- **声明 schema（P1）**：`schemas/adapter.schema.json` + `tools/validate_adapters.js`（`--json` / `--src`）。**`varPath` 形状必须遵守运行时语义**：`cheatResolvePath` 只按 `.` 切段，段名允许中文/连字符/纯数字（数字段索引数组），**方括号 `a[0]` 会被当字面键名导致写入落空** → `^[^.\[\]\s]+(\.[^.\[\]\s]+)*$`。首轮 30 FAIL 里 29 条是按"JS 标识符"直觉写规则造成的误报（连字符/中文/数字段），唯一真缺陷是 `dolmod / stages:dm_conf_state` 缺 `labels`（面板会显示裸英文 `rejected/friend/lovers`，已补中文）。
- **声明驱动矩阵（P2）**：`tools/gen_adapter_matrix.js` 从声明推导探针（stages 按 `levels` 每档一个；abilities 按 `numeric` 走 `min`/`max` 或 `true`/`false`；values 按 `type` 走 number/boolean/list/字符串），产物 `tests/data/adapter_matrix.json`（**442 条 / 1006 探针 / 13 适配器**），`--check` 做漂移检测。`tests/test_adapter_matrix.js` 逐个探针**真写→回读→核留痕路径→核 sync 条件→undo 还原**（**6,049 断言**），补上了 `morefarm` / `dolopt` / `domrobin` 三个此前在整个 `tests/` 里零命中的适配器。**新增适配器不需要手写测试**：假适配器负控（1 阶段 + 1 数值能力 + 2 数值项）不写任何手写断言，矩阵自动派生对应探针断言并全绿。
- **src 侧类型分账（P3）**：`tsconfig.src.json`（`strict:true`）不直接吃 `javascript/src/**`——src 段是同一 IIFE 的片段（`00-preamble.js` 开括号、`09-exports2.js` 收括号），逐文件编译只出结构噪声（实测 exit 2 / 4 行 `TS1005`·`TS1128`·`TS1109`）。改为 `tools/check_src_types.js` 按 manifest 拼出与产物字节相同的联合文件 → 先硬校验拼接 SHA === 产物 SHA（不等说明没重建产物）→ `tsc -p tsconfig.src.json` → 错误按行区间映射回具体 src 文件 → 与 `tools/src-types-baseline.json` 棘轮。基线 **26 文件 / 169 条真债务**；隐式 any 家族（`TS7006/7005/7034/7053/7023`，实测 1019 条）不计账，否则真债务会被淹没。债务上升即 exit 1，下降时提示可用 `--write-baseline` 收窄。
- **单段拆分（P4）**：原 `07i-yanling.js`（856 行三合一）按行边界拆为 `core`（状态/钩子/净化，1-262 行）/ `actions`（一键动作，263-623 行）/ `page`（渲染，624-856 行）三段，manifest 原位换段 **64 → 66 段**。**零字节等价已双重反证**：首建即同 SHA（829,826 B / `A8E40BF5…D0CC6`），剥掉后加的 3 行职责注释后重新拼接 `MATCH_BASELINE=true`。现产物 830,344 B / `50D537B8…0C88`。回归断言守住拆分语义：连续重渲染 DOM 计数不增长、重复 `install` 不叠包装层（负控实测：删掉「已挂就早退」守卫后 4 条断言全红）。

**原版 HTML 路径可覆盖**：`tests/smoke_dom.js` 与 `tests/integration_gender.js` 都按 `MCE_DOL_HTML` 环境变量取原版游戏 HTML，未设时回退到本机默认路径；文件不存在则相关段落 SKIP（不误报）。CI / 他人机器无需修改源码即可指定，例：`$env:MCE_DOL_HTML="D:\games\Degrees of Lewdity.html"; node tests/smoke_dom.js`。

**代码检查（ESLint 八规则）**：`npm install` 后 `npm run lint`；检查对象是拼接产物 `javascript/maplebirchce.js`（`src/` 是不完整片段（段数随拆分变化，以 `build_js.js` 输出的 `(N 段, …)` 与 `order <指纹>` 为准），单文件解析必然失败）。八条规则只抓确定性错误：重复对象键 / 不可达代码 / 函数声明被重赋值 / 松散相等（`== null` 放行）/ 自赋值 / 恒定条件（`while(true)` 放行）/ 不安全取反 / switch 贯穿。配置见 `eslint.config.js`，已并入 `run_all.ps1` 第 3 步。

**日常开发流程（LRN-003 五步升级版）**：改 `javascript/src/*.js`（**新增段要先登记 `src/manifest.json`**，或跑 `node tools/build_js.js --write-manifest`）→ 改完适配器跑 `node tools/validate_adapters.js` 与 `node tools/gen_adapter_matrix.js`（后者会更新 `tests/data/adapter_matrix.json`，须一并提交，否则第 8 步 `--check` 报漂移）→ 一键命令 `.\tools\run_all.ps1`（12 步：build（段序 + 结构门禁）→ 语法 → ESLint → DOM 冒烟 → 全量回归 + 声明矩阵 → 功能 E2E → 性别集成 → 适配器声明 schema + 矩阵幂等 + 声明一致性 → 原版数字档位形态 → 覆盖率门禁 → **tsc 类型检查（产物侧 0 错误 + src 侧 strict 债务棘轮）** → **键注册表一致性**，末尾自动 `codegraph sync`）→ 打包 `.\tools\pack.ps1`（zip 正斜杠 + verifier 校验（verifier-hub 优先，本机无该包时自动走内置等价核对：条目集合精确匹配 + CRC 全量，判据相同）+ SHA256）→ 交付（`dev.ps1` 自动装进 `game\`）。测试默认读 git 源构建产物（与打包源解耦）；需要核对打包源时设环境变量 `MCE_PKG_JS`。

**第三方模组升级核对（audit_adapters.js）**：模组发布新版后，运行
`node tools/audit_adapters.js <适配器id> <新源码目录>`，自动比对适配器声明的 varPath 与源码实际写入的 V 路径，输出缺失（改名/删除）/ 新增候选 / 覆盖率，辅助判断是否需要补适配。适配器 id：`revelation-the-book-of-return` / `dom_robin` / `deadwood-reblooms` / `more_love_interests` / `smartphone` / `cattery` / `more-farm-upgrade`。

**缺失条目自动定案（resolve_missing.js）**：`audit_adapters.js` 报出的"缺失"多为盲区假报（`this.state.xxx` 别名访问、twee 别名、动态键 `obj[_ordinand].leaf`），逐条人工 grep 验证很费时。运行
`node tools/resolve_missing.js <适配器id> <新源码目录>` 自动判定每条缺失为 **KEEP**（源码确实存在，audit 误报）/ **REVIEW**（疑似存在需复核）/ **REMOVE**（零证据真缺失，模组删字段）。证据链六类：字面 V/$root 路径、连写 parent.leaf、父根定义块 leaf 类型/默认值、`this.state.leaf` + state 绑定属主校验、叶子键字符串/动态键、零证据。判定原则：宁可"存在"不误删，REMOVE 只给零证据或"属主不符+模块目录零出现"。已对枯木逢春 2.4.1（42 条全 KEEP，含 duties.completed）/ 归途之书 1.3.7（56 条全 KEEP，含 rite_round/faith_band/动态键）/ MLI 0.1.8.0（1 条 KEEP）实测，与人工 grep 结论一致。

**框架兼容性核对（check_framework_api.js）**：maplebirchFramework 发布新版时，先下载新版 `.mod.zip` 解压出 `dist/inject_early.js`，运行
`node tools/check_framework_api.js <inject_early.js 路径>` 核对 CE 运行时依赖的框架 API（`window.maplebirch` / `maplebirch.get` / `maplebirch.npc(.data)` / `maplebirch.temporary.traitLists`）是否全部保留。核心 API 全保留才把 `tools/check_mod_updates.js` 框架渠道的 `declOverride` 更新为新版本。已核对至 **5.6.2**（2026-11-07 复跑，对照 `fw562\unpacked\dist\inject_early.js`）：核心 8 项全有；`setup.MapleBirch` / `maplebirch.patch` 缺失均为非 CE 依赖（CE 0 次调用 patch），与 5.5.7 及历史各版结论一致 → 判兼容。

**v1.8.4 select.type 崩溃的防再犯体系**（三层）：
- 源码已删除对 `<select>` 赋值只读 `type` 的代码（留注释警示）；
- 单元测试 mock（`mkNode`）对 select 用 `Object.defineProperty` 复现只读 `type`（getter 返 "select-one"、setter 抛 TypeError），断言渲染树 select 只读；
- DOM 冒烟把 jsdom 的 `HTMLSelectElement.prototype.type` patch 为抛错 setter（jsdom 原生赋值静默忽略、与真实浏览器不同），渲染玩家页/Mod作弊页时任何对 select.type 的赋值都会像真实浏览器一样抛错中断。

## 质量闸门与已知缺口台账

> 本节回答三个问题：**类型错了会不会被拦住、键改名会不会被拦住、分支覆盖 80% 剩下约 20% 的缺口到底在哪**。台账化取代口头保证——所有数字都能在本机一条命令复现，命令写在每小节末尾。

### 1. 类型检查闸门（tsc `--noEmit`）

- **配置**：`tsconfig.json`（`allowJs` + `checkJs`、`noEmit`、`strict:false`、`types:[]`、`include: javascript/maplebirchce.js` + `types/**/*.d.ts`）。检查对象是**拼接产物**——`src/` 分片不是完整程序，直接对分片跑 `tsc` 必然满屏误报。
- **引擎全局声明**：`types/sugarcube-ambient.d.ts` 声明 SugarCube / DoL 运行时注入的全局（`V` `State` `setup` `Story` `Engine` `Time` `SugarCube` `Wikifier` `T` `C` `$` `clone` `passage` `variables` `gwylanStatusCheck` `npcIsPregnant` `playerIsPregnant`）+ `Window` 扩展。首跑 265 条错误里绝大多数是"未声明全局"（`Time`×41 `Story`×30 `setup`×29 `State`×13 `$`×10 …），**正确做法是补声明而不是删引用**——`maplebirchce.js:536` / `:11708` 等处本就是 `typeof T !== "undefined"` 守卫语义。该文件**不参与打包**（`build_js.js` 只读 `javascript/src`）。
- **接入点**：`run_all.ps1` 第 11 步、CI 第 8 步、`npm run check:tsc`；`package.json` devDependencies 增 `typescript ^5.9.3`（CI `npm ci` 自动带上）。**现状 0 错误**（`TSC_EXIT=0`）。

首跑 265 → 0 的过程中修掉的是**真实缺陷**，不是为过检查而改：

| 位置 | tsc 症状 | 实质 |
|---|---|---|
| `07a-shell.js:105` `var CSS = ...` | `CSS.escape` 属性不存在于 string | 变量遮蔽浏览器全局 `CSS`，使 `typeof CSS.escape === "function"` 兜底分支**恒不可达**（改名 `MB_CSS`） |
| `07f-lock.js:48` | string 不能赋给 string[] | 同一变量 `leaf` 先当数组再当字符串，语义混淆（拆成 `leafParts` / `leaf`） |
| `07i-yanling-core.js:228` | `unref` 不存在 | 浏览器是 number、Node/jsdom 是 Timeout，补 `@type {any}` 说明双形态 |
| `04a-00-core.js` / `05a-modcheat-rows.js` / `08b-attitude.js` | 联合类型缺字段 / `never` 误判 | 适配器 entry 有两类形态（有/无 `actionPanel`）、闭包内赋值 TS 不收窄 → JSDoc `any` 标注（运行时零改动） |

复现：`npx tsc -p tsconfig.json`

### 2. 键注册表（442 条 varPath 单一真源）

- **`keys.registry.json`**：13 个适配器 / **442 条** `{key, varPath}`，适配器按 modId 排序、条目保持源码顺序。逐适配器：cattery 47 / deadwood-reblooms 140 / dol-optimization 22 / dolmod 31 / dolonline 19 / dolsims 41 / dom_robin 14 / fertility-expansion 14 / more-farm-upgrade 37 / more_love_interests 1 / revelation-the-book-of-return 60 / smartphone 8 / wraiths-reflection 8。
- **工具** `tools/gen_key_registry.js`：`--write` 生成/更新、`--list` 打印逐适配器计数、无参校验。校验逐条对比，漂移即 `exit 1`，并按 `ADDED / REMOVED / RENAMED`（同 key 不同 varPath）分类打印——**"键改名"从人肉排查 140 条 path 变成构建期报错**。
- **接入点**：`run_all.ps1` 第 12 步、CI 第 9 步、`npm run check:keys`（改完适配器跑 `npm run keys:write` 再提交）。
- **口径边界**：`keysWithoutVarPath = 3`（revelation 1 / dolonline 2）——这 3 条只有 key 与类型、没有上游 `varPath`，因此不参与写入路径存活核查；13 个适配器**均未声明** `actions:` 数组（`05a3-modcheat-actions.js` 的 `actions` 渲染分支因此无真实调用者）。
- **同层单测已入链（v2.0.4）**：`tests/test_keycheck.js`（**281 断言**，覆盖 `tools/lib/keycheck.js` 的归一化 / 编辑距离 / 动态键两侧闭合 / 证据分级 / 覆盖率口径）此前是**孤儿测试**——`run_all.ps1`、`run_coverage.js`、`ci.yml` 三处零命中，而 `check_claims` / `check_key_types` / `check_coverage` 三个工具都共用这层内核。现随 `run_coverage.js` 序列在本地第 10 步与 CI 第 10 步执行（不新增全链步号）。

复现：`node tools/gen_key_registry.js`（校验）/ `--list`（计数）

### 3. 分支覆盖台账（80%，显式登记而非隐性欠账）

实测（`npm run coverage` → `coverage/coverage-final.json` → `node tools/report_branch_gaps.js`）：

| 指标 | 值 | 门禁 |
|---|---|---|
| Statements | 97.50%（15189/15578） | ≥90 |
| Branches | 81.41%（5651/6941） | ≥80 |
| Functions | 98.85%（606/613） | ≥95 |

（门禁原为 75/60/80，实测余量过大到"掉 13 个点仍绿"，2026-11-07 收紧到 90/80/95；CI 同阈值，缺原版 HTML 时数值以该次 Actions 日志为准。）

- **68 个分片存在分支缺口**。c8 只认产物一个 key，`tools/report_branch_gaps.js` 按 `javascript/src/manifest.json` 的段序（与 `build_js.js` 同一真源，**不是文件名字典序**——两者有 3 对文件互换，按字典序会把缺口算到错的分片）与补尾换行规则重建「产物行号 → 源分片行号」映射后逐条归因：`&& / || / ?.` 短路兜底 320、防御性 `catch` 417、普通 if-else 131、不可达守卫 64、`typeof` 环境守卫 170、三元 188（合计 1290 条未覆盖分支臂）。
- **测量抖动（实测，不是估算）**：同一口径两次跑得 80.19%（5487/6842）与 80.14%（5489/6849），分子 ±2、分母随新增分支变化（v2.0.12 的钳位新增 7 个分支点）；判「有没有丢覆盖」必须逐 branch 比对（`node %TEMP%\cov_diff.js A.json B.json`），只看总数会被 ±1 抖动骗过。
- **三类已知结构性缺口（登记在此，不再算隐性欠账）**：
  1. **防御性 `catch`（417 条）**——写入/渲染链兜底异常分支，正常路径永不触发；它们的价值是"上游崩了页面也不炸"，覆盖它等于制造人为崩坏输入。
  2. **`typeof` 环境守卫（170 条）**——`CSS.escape`、`Timer.unref`、`SugarCube.State.passages` 等；jsdom 与真引擎形态不同，两端都覆盖需要真浏览器（本项目禁用浏览器路线，`real_smoke.ps1` 属被禁通道），只能保留为已知盲区。
  3. **无调用者分支**——`05a3-modcheat-actions.js` 的 `actions` 渲染（没有任何适配器声明 `actions:`，Fertility 走 `actionPanel`）。不为它伪造调用。
- **剩余 131 条 plain 分支是"没写断言"，不是"不可测"**——这是可补测欠账，按下方 Top 表逐片补；把这类也归入"不可测"属于自我开脱，故单列。逐文件行号与形态分布已导出为 **[`docs/coverage-plain-remaining.md`](docs/coverage-plain-remaining.md)**（当轮 131 条 / 45 分片，按 §口径 每条带行号与源码片段，供下一轮直接接着补）。
- **另有 64 条「不可达守卫」（dead-guard）已从欠账里摘出**：形态是 `if (!V)` 而 `V = getV()`，而 `01-core.js` 的 `getV()` 在未读档时 `return {}`（空对象仍为 truthy），`!V` 恒 false，其 true 侧结构性走不到——把 `window.V` 与 `State.variables` 都清掉也只会落到 `{}` 兜底，不是"没测到"而是"测不到"。判定由 `report_branch_gaps.js` 的 `isDeadGuard()` 自动完成（只认 `if (!X)` 完全闭合形态，`if (!v.player)` 这类属性检查仍归于 plain）。这批原先混在 plain 254 里，口径修正后为 plain 190 → 首批补测后 181。
- **首批可补测欠账已落地**：`tests/plain_branches.js`（21 条断言，挂在覆盖率序列末位）专打 plain 里"正常路径永远走不到拒绝侧"的分支——diff 预览队列封顶与空队列拒绝（08d）、地点中文名无匹配（07d）、未知 NPC 特质撤回（08）、按活动页签的 mods/places 重渲染分发（08d）、面板容器缺失时的渲染早退（05a）。实测把 plain 从 190 压到 181、分支覆盖 80.14% → 80.30%（5508/6859；分母 +10 是新执行到的代码块被 c8 纳入统计，不是源码改动）。
- **第二批可补测欠账已落地（2026-11-09 第二轮，plain 181 → 154）**：同一文件扩到 **67 条断言**，新增七组——① 06b 特质写入的 `isnot true/false/undefined/N`、`is undefined` 强制获得、`is "非数字串"` 原串写回、`lt` 边界共 13 条（走的是面板「获取/移除」同一函数，原版特质表没有这些 has 组合所以从未被喂到），外加 520 次 `traitEval` 喂满 512 条判定函数缓存验证整体重建；② 04c `auditAdapters` 的拒绝面（临时注入 3 个畸形适配器，断言后立即删除还原）：缺 modId / modId 与注册键不一致 / 缺 key / 缺 name / 缺 varPath / 空适配器告警；③ 08d 预览值格式化 `null`（L29）与 `JSON.stringify` 返回 `undefined` 回落 `String(v)`（L32，**确认条只渲染队首，两次入队会让断言取错对象**），以及 stage/scenes/char/yanling/无活动页五条分发臂；④ 07d 湖畔兜底补 `V.outside=1`（L209）与 Story 全无时宏预检返回空串（L229）；⑤ 08-npc-traits 的 `V.player` / `V.player.virginity` 缺失自建（L81/L82）与 `timeStamp` 非有限数按 0 起算（L138）；⑥ 07f-lock 锁定留痕缺 `before` 时补记首次真实值（L139）；⑦ 07f-lurker 三条锁态提示（手持/冰箱/蒸馏笼，L170-172）。实测 plain 181 → 154、分支覆盖 80.30% → **80.87%（5570/6888）**，`node tests/plain_branches.js` 全断言通过、`run_all.ps1` 12 步全绿。
- **第三批可补测欠账已落地（2026-11-09 第三轮，plain 154 → 131）**：同一文件扩到 **96 条断言**，本轮五组——① 07e 场景注册表解析（widget 段落缺 `<<set $scenes to {`、大括号不闭合、Story 全文恢复块未闭合、`"rec1"` 定义整份返回、widget 与 V.scenes 同 key 不覆盖）；② 跨文件零散（06c `isModOnlyRoot("")`、07e-scenes2 未知动作）；③ 04b 列表写入门禁（原版根拒绝 / 宿主不存在拒绝 / 预览门控回调）；④ 07f-pins2 队列边界（播放中 passage end 不清理队列、旧版单固定同 key 去重、入口段落缺失直达回传失败）；⑤ 04a-15 孩子阶段/地点兜底（`edenDeleted` → removed、无 `development` 直写 `child.location`、只读 development 写不进 → 明确拒绝）与 03c 原版恋爱阶段回退（非 gwylan 返回 0、`seen` 未含该值仍回执、partners/romance 分支）。实测 plain 154 → **131**、分支覆盖 80.87% → **81.41%（5651/6941）**；差分工具确认消失 14 条、新增 0 条。**注意本轮分母 6888 → 6941（+53）**，净收益必须看 plain 明细差分而不是百分比。
`01-core.js` 76.4%（51）/ `07f-pins2-anchor.js` 75.3%（47）/ `08c-undo-center.js` 78.0%（45）/ `04a-15-fert-children.js` 80.8%（42）/ `07d-places2.js` 73.2%（42）/ `07i-yanling-actions.js` 81.4%（42）/ `09-exports.js` 63.8%（38）/ `07h-render2.js` 73.6%（38）/ `05b-modcheat-player.js` 77.2%（37）/ `07f-pins3-queue.js` 78.7%（36）。
- **口径提醒**：覆盖率数字随源码改动变化，本节数值对应**当前 HEAD 工作区**（2026-11-09 第三轮收口实测，分支总覆盖 81.41% = 5651/6941、Statements 97.50% = 15189/15578；同口径历史抖动 80.81% / 80.83% / 80.87%，分子 ±4 属已知抖动，判"有没有丢覆盖"必须逐 branch 比对）；`coverage/coverage-final.json` 由 `npm run coverage:gate` 每轮刷新，报告会拒绝早于产物的旧数据（exit 2），不会静默给过期数字；改码后请重跑 `npm run coverage:gate` 再看，不要引用本节旧数。

复现：`npm run coverage` && `node tools/report_branch_gaps.js --md --top 15`
