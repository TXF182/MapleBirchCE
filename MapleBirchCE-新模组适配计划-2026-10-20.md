# MapleBirchCE 新模组适配计划（2026-10-20）

> **任务范围**：为 MapleBirchCE（DoL 作弊面板模组，MCE）分析 5 个新第三方模组，产出适配计划供用户选择每个模组适配到哪些位置。**本计划只做分析与设计，未修改 MCE 任何源码、未打包、未运行 `tools\run_all.ps1`**。
>
> **输入模组**（均已解压到临时目录逐个分析，分析后清理）：
> 1. `CombatTerminator.zip` → CombatTerminator v0.1
> 2. `AutoClean.zip` → AutoClean v0.1.5
> 3. `DoLSims.mod.zip` → DoLSims v0.8.1.7
> 4. `Wraith.sReflection.mod.zip` → Wraith'sReflection v1.3.4
> 5. `Dol-Optimization-v1.1.2.mod.zip` → 原版优化 Dol-Optimization v1.1.2
>
> **分析基准**：MCE 仓库 `C:\Users\27352\Doubao\chats\2026-10-13\new-chat-2\MapleBirchCE`；适配器模式以 `javascript\src\04-modcheat.js` 的 `CHEAT_ADAPTERS`（现 5 个：归途之书 / More Love Interests / DomRobin / 枯木逢春 / SmartPhone）为准；原版键判断以 `javascript\src\03-global.js` 的 `ORIGINAL_V_ROOT_KEYS`（**实测 186 条**）为准；变量分析用只读扫描器 `node tools\scan_mod_vars.js`。
> **写入防线**：`cheatResolvePath` 对「原版根」与「父级对象缺失」直接拒绝写入（返回提示、不崩溃）——本计划所有建议暴露项的根均不得为原版键，宿主缺失时须表现为拒绝写入。

---

## 一、汇总对比表

| 模组 | 版本 | 建议探测键 | 建议方案 | 主要风险 | 工作量 |
|---|---|---|---|---|---|
| CombatTerminator（战斗终结者） | 0.1 | 无自有键；如走 A 需 `window.modUtils.getMod("CombatTerminator")`（实机可靠性待确认） | **C（推荐）** 不适配仅文档 | 原版战斗值双重写入（低）；纯补丁锚点可能被他模覆盖；无公开仓库 | 小（≈0，仅文档一行） |
| AutoClean（自动清洁/庄园维护） | 0.1.5 | `window.AutoCleanFarm` 或 `window.modUtils.getMod("AutoClean")` | **C（推荐）** 仅文档；可选加被动识别条目 | 每日 0 点强制覆写原版键（用户手动改值会被复位）；补丁静默失效；与 Dol-Optimization 花园功能重叠 | 小 |
| DoLSims（类模拟人生大扩展） | 0.8.1.7 | `window.MirrorHypnoVariableRefresh`（函数存在） | **A（推荐）** 新建独立适配器（精选 40–50 项） | 250 散根易误伤原版键；版本快速迭代；更新追踪盲区 | 大 |
| Dol-Optimization（原版优化） | 1.1.2 | `!!window.DolOptimization`（inject_early 无条件挂载） | **A（推荐，B 兜底）** 独立适配器 6–8 项 | `V.options` 原版根缝隙写入（options 不在原版根清单，属边界地带）；设置页 rv() 重建覆盖边角 | 小 |
| Wraith'sReflection（幽灵的倒影） | 1.3.4 | V 自有根并集（`WraithsReflection/HelpAsk/necklaceWR/...` 任一存在） | **A（推荐）** 新建独立适配器（约 10 项） | 模组自身 `"rreturn"` 双 r 拼写 bug；`$wraith.state="forgive"` 原版根新枚举不可暴露；状态机一致性 | 小 |

**探测键冲突检查**：以上 5 个建议探测键与现有 5 适配器探测键（`window.maplebirch.get("RobinTemple"/"TempleChoir"/"DeadwoodReblooms")`、`setup.foodPreference`、`window.modUtils.getMod("DomRobin")`、`V.Phone`）逐一比对，**零碰撞**。

---

## 二、各模组独立章节

---

## CombatTerminator（战斗终结者）

### 1. 是什么
- **boot.json 实证**：name = `CombatTerminator`，version = `0.1`；scriptFileList / tweeFileList / styleFileList / imgFileList 全部为空，包内仅 `boot.json`（2129 B）+ `readme.md`（449 B）两个文件。
- **功能一句话识别**：战斗内一键终结/强行结束各类战斗的纯补丁作弊模组——在 DoL 原版战斗界面（State Man 行动菜单、挣扎、触手、集群四个 widget）注入共 8 个 `<a onclick>` 快捷按钮：自我了断（`V.pain=1000`）、英雄不屈（`V.pain=10, V.arousal=0, V.stress=0`）、延长战斗（`V.enemyarousal-=500`）、息事宁人（`V.enemyarousal=V.enemyarousalmax`）、一拳打飞（`V.enemyhealth=0`）、结束挣扎（`V.struggle.done = V.struggle.number + 1`）、结束触手（`V.tentacles.active = 0`）、结束集群（`V.timer=0, V.vorestage=0, V.swimdistance=0`）。readme 注明「按过按钮之后下一轮才会生效，PC 需至少撑住一轮」。
- **作者与渠道**：readme.md 署名作者 **FungiEggroll**，包内无任何仓库/下载链接。已用网络搜索（关键词 `CombatTerminator Degrees of Lewdity mod FungiEggroll`、`"CombatTerminator" DoL mod github 战斗终结者`、`FungiEggroll github Degrees Lewdity`）检索，**未找到公开 GitHub/GitLab/itch.io 仓库**。结论：**无法自动检测更新**，后续版本迭代只能依赖用户手动重新安装包，MCE 侧无更新追踪锚点。

### 2. 源码结构概览
- **twee / js / ts 文件数**：0 / 0 / 0（包内没有任何可执行源码）。
- **挂载方式**：纯 TweeReplacer 补丁。boot.json 的 `addonPlugin` 含两项：
  - `TweeReplacerAddon`（modVersion 1.0.0）：4 条 params，分别对 `Widgets State Man`（锚点 `<<unset $speechcamerapose>>`）、`Widgets Struggle`（锚点 `<<struggle_actions>>`）、`Widgets Tentacles`（findRegex 抓 `statetentacles` widget）、`Widgets Swarm`（findRegex 抓 `swarm` widget）做替换注入；
  - `ReplacePatcherAddon`（modVersion 1.0.0）：`js` 数组为空，实际无任何注入。
- **无 JS 入口、无 window 全局对象、无自建 V 顶层键**。
- **核心状态宿主对象**：不存在；模组本身零状态，全部行为是对 DoL 原版战斗变量的即时赋值。
- **依赖**：`dependenceInfo` 仅声明 TweeReplacer `^1.0.0`。

### 3. 变量根清单
- **scan_mod_vars.js 实测结果**（适配器 id=combatterminator）：
  ```
  文件数: 0 | 引用根数: 0
  [已声明] 0 个根
  [未声明·候选补录] 0 个根
  [声明但源码未见] 0 条
  ```
  空扫描结果本身即结论：纯补丁模组，没有任何可被扫描器抓到的变量引用。
- **手工核对 boot.json 补丁文本中被写的键，逐键与 ORIGINAL_V_ROOT_KEYS（186 键清单）对照**：

  | 补丁写入的键 | 在 186 键清单内？ | 判定 |
  |---|---|---|
  | `pain` | 是 | 原版键 |
  | `stress` | 是 | 原版键 |
  | `enemyarousal` | 是 | 原版键 |
  | `enemyhealth` | 是 | 原版键 |
  | `timer` | 是 | 原版键 |
  | `vorestage` | 是 | 原版键 |
  | `arousal` | 否（清单仅有 `arousalmax`） | 确属 DoL 原版 PC 兴奋值，按规则仍属原版键 |
  | `enemyarousalmax` | 否 | 原版敌人兴奋上限，原版键 |
  | `struggle`（`.done`/`.number`） | 否（清单仅有 `struggle_start`） | 原版挣扎小游戏状态对象，原版键 |
  | `tentacles`（`.active`） | 否（清单仅有 `tentaclerapestat`/`tentacletrait`） | 原版触手战斗状态对象，原版键 |
  | `swimdistance` | 否 | 原版集群/吞食战位移状态，原版键 |

- **结论：被写键共 11 个根，全部为 DoL 原版键**（6 个在 186 键清单内，5 个清单未覆盖但确属原版）。**无任何可暴露的模组自有持久变量根**。

### 4. 可适配面
按 CHEAT_ADAPTERS 分组模型（tasks / stages / abilities / values）逐项梳理：
- **tasks（剧情任务进度）**：无——模组无剧情线、无进度键。
- **stages（阶段/枚举切换）**：无。
- **abilities（布尔解锁标记）**：无。
- **values（数值项）**：无自有值键——其全部「效果」就是直接写原版战斗变量。

**MCE 现有覆盖度对照（实证）**：PC 侧 `pain/arousal/stress` 不在快捷编辑组内（核心属性组仅 purity/beauty/physique/willpower/awareness/promiscuity/exhibitionism/deviancy 等 8 项）；敌方/战斗侧 `enemyarousal/enemyhealth/struggle/tentacles/timer/vorestage/swimdistance` 全 src grep 实证无任何面板入口覆盖。
**写入防线实证**：`cheatResolvePath` 对 `cheatIsVanillaRoot(parts[0])` 为真的路径直接拒绝，返回「目标「X」为 DoL 原版变量，拒绝操作」。即使为了「覆盖缺口」把 `pain`/`enemyhealth` 等写成适配器 varPath，**写入也会被防线拦下**——原版键禁止暴露在此不仅是规范，也是机制强制。
**最终判断：可适配面为空**。唯一可做的是「文档记录其存在与行为」。

### 5. 建议位置
- **方案 A：新建独立适配器进「Mod作弊」页** —— 探测键设计仿 dom_robin 模式 `window.modUtils.getMod("CombatTerminator")`（boot.json name 实证为 CombatTerminator），与现有 5 个探测键不撞。但 entry 四个分组只能全空——面板上只有一个模组标题、无可操作项，对用户零收益；且纯补丁模组在 ModLoader 注册表中是否被 `modUtils.getMod` 判为 truthy **待实机确认**。
- **方案 B：进玩家属性编辑区模组键区** —— **不适用**。模组无自有 V 顶层键，运行时差集为空。
- **方案 C（推荐）：不适配，仅文档记录**。理由：① 无自有状态可暴露；② 唯一可写面全部被原版写入防线机制性拒绝；③ 适配器化无任何用户收益。安装本模组对 MCE **无冲突影响**：它通过 TweeReplacer 往原版 widget 注入按钮，不改 MCE 注入点；两者是「同一批原版 V 值的两个独立写入方」。

### 6. 风险
- **原版键双重写入（低）**：模组按钮与 MCE 面板若同时操作同一批原版值（如 pain），无逻辑冲突（都是直接赋值），但 MCE 回退机制（`V.mbCE_wrote` 留痕、undo 还原）会把按钮刚写入的值覆盖回 before——可预期行为差异，文档提示即可。
- **探测键冲突（已规避）**：`getMod("CombatTerminator")` 与现有 5 个探测键无撞名。
- **宿主初始化依赖（待确认）**：TweeReplacer 未装时 4 条补丁不注入；`modUtils.getMod` 对「零 scriptFile 纯补丁模组」是否可靠探测 **待实机验证**——若返回 falsy，方案 A 的 detect 失灵。
- **补丁位点冲突（待确认）**：锚点 `<<unset $speechcamerapose>>` 位于 `Widgets State Man`，其他模组在同一锚点注入时可能互相覆盖。MCE 自身不打此锚点，对 MCE 无影响。
- **更新追踪盲区**：无公开仓库；当前 0.1 早期版，补丁 regex 随 DoL 本体改版可能失效，MCE 侧无预警渠道。

### 7. 工作量评估
- **推荐方案 C：小（≈0）**——仅在 MCE 适配清单/文档补一行记录，不写代码。
- 若仍决定上方案 A：**小（约半天）**——照 dom_robin 模式抄 detect + 全空 entry，无 varPath；但收益为零，不建议优先做。

---

## AutoClean（自动清洁/庄园维护）

### 1. 是什么
- **modName / version**：`AutoClean` **v0.1.5**（boot.json 实证）；scriptFileList 仅 `AutoClean_js.js`，tweeFileList 为空，包内 3 文件（AutoClean_js.js / boot.json / readme.md）。
- **功能一句话**：「每日 0 点自动维护」型 QoL 模组——神殿宿舍/花园防衰减、伊甸菜地/菇桶/泉水锁满、肥皂药膏自动补货、鹰塔清洁与木材补货、农场动物状态锁满与库存自动收获、艾弗里豪宅每日自动打扫 + 自动投喂。readme 自述适配游戏版本 0.5.10.12。
- **作者与渠道**：readme 署名 **FungiEggroll**（与 CombatTerminator 同作者），包内**无任何仓库/主页链接**。两次网络检索均未找到公开 GitHub/GitLab 仓库。结论：**无法自动检测更新**，推测为中文社区 QQ 群/社群私发分发。

### 2. 源码结构概览
通读 AutoClean_js.js 全文（约 70 行）：
- **函数清单（仅 2 个）**：
  - `AutoCleanFeedAvery()`（行 3–35）：若 `V.avery_fate` 为 saved/ascended，按「艾弗里点菜 > 牛排/舒芙蕾/扁意面 > 其余按难度降序」扣 `V.foodstuff.*.amount`；无菜可喂才 `dinner_missed++`；末尾 `wikifier("avery_food_select")`。
  - `AutoCleanFarm()`（行 42–67）：若 `V.farm.tower_guard_skill >= 1000`，把 horses/pigs/cattle/dogs 设 30、`farm_stage>=5` 时 `aggro=0`；随后遍历 `V.farm.stock` 调 `wikifier("tending_give",…)` 收货并清零——除非 `V.farmerCanSell` 为真（让位给「更多农场升级 mod」）。
- **window 挂载**：**有**——行 37 `window.AutoCleanFeedAvery`、行 68 `window.AutoCleanFarm`。挂的是**函数**，不是状态对象；不注册任何 `V.AutoClean*` 命名空间。
- **自有状态键**：**无**。JS 内读写的全部是原版键，连一个开关都没有；boot.json 的 addonPlugin 不带 params（无配置项可作弊）。
- **挂载方式**：ReplacePatcher 向 time.js / 02-temperature.js 注入 9 条 JS 字符串补丁（`tendingDay()` 前串接 `AutoCleanFarm()`、`dinner_missed++` 替换为 `AutoCleanFeedAvery()`、以及 edengarden/edenshrooms/edenspring/temple_quarters/temple_garden/bird/avery_mansion/soap/salve/bus 的直接赋值改写）+ TweeReplacer 替换 7 条 passage 文本。**核心状态宿主对象：无**——全部借用原版 `V.*` 对象。

### 3. 变量根清单（扫描器 + 人工核对）
`node tools/scan_mod_vars.js <解压目录>` 实证：文件数 1，候选根 4 个（已声明 0）。注意补丁文本在 boot.json 字符串里扫描器扫不到，以下已对 boot.json 人工复核：

| 候选根 | 引用次数 | 示例行 | 人工判定 |
|---|---|---|---|
| `avery_fate` | ×2 | `if (V.avery_fate === "saved" \|\| V.avery_fate === "ascended")` | **原版键**（艾弗里收养线结局状态；清单未收录但确属原版）→ 剔除 |
| `foodstuff` | ×11 | `V.foodstuff[V.avery_mansion.food].amount -= 1` | **原版键**（原版食物库存对象）→ 剔除 |
| `farm_attack_timer` | ×1 | `//V.farm_attack_timer = 30;` | 注释死代码，且为原版农场键 → 剔除 |
| `farmerCanSell` | ×1（只读） | `if(V.farm && V.farm.stock && !V.farmerCanSell)` | **第三方模组键**（「更多农场升级 mod」自动卖货开关），AutoClean 只读不写 → 剔除 |

boot.json 补丁中其余根：`temple_quarters/temple_garden/temple_rank/housekeeping/tending/grace/spear_vessel`（神殿线原版）、`edengarden/edenshrooms/edenspring/bus`（原版，已在清单内）、`bird`（鹰塔原版）、`soap/salve`（原版物品）、`avery_mansion`（原版根，`CHEAT_VANILLA_ROOTS` 已拦截）、`farm/farm_stage`（原版根，已拦截）。

**结论：AutoClean 无自有持久变量根（全部操作原版键）。** 依据：JS 全文 + boot.json 全部 16 条补丁逐行复核，未出现任何自建顶层 V 键；唯一"自有资产"是两个 window 函数（可调用逻辑而非可读写状态）。

### 4. 可适配面
- **tasks / stages / abilities / scenes / values：全部为空。** 模组是「自动维护执行器」，没有阶段、没有能力开关、没有可推进的场景进度；其"效果"（锁值/补货/投喂）是对原版键的每日覆写，而原版键**一律禁止作为模组键暴露**（且 `farm`/`avery_mansion` 根在 `CHEAT_VANILLA_ROOTS` 内，cheatResolvePath 本就会拒绝写入）。
- **自有开关/配置键**：无。想做"启用/停用 AutoClean"面板开关，技术上不存在目标 varPath（只能靠装卸模组实现）。
- **与现有适配器/其他模组的功能重叠（分析判断）**：
  - **枯木逢春 DeadwoodReblooms**：其 Orchard（果园农业经营）/ Finance（经济，含艾弗里孤儿院收养线）与本模组同处"农业+艾弗里经济"场景，可能同读写 `farm.*`/`avery_mansion.*` 原版键；机制不同（枯木是新增内容线，AutoClean 是原版状态锁值），数值方向不冲突（都倾向"维持满值"）。
  - **Dol-Optimization 原版优化**：其花园自动化（催熟肥/自动灌溉机/农资店）与本模组的 `edengarden/edenshrooms/edenspring` 锁 4、除草上限改写**功能直接重叠**——二者都在改伊甸园花园维护逻辑，同时安装时以后加载者的注入结果为准（ReplacePatcher/TweeReplacer 均为字符串替换，**双补丁对同一段 time.js 文本的匹配可能互相错位，待实测**）。
  - **「更多农场升级 mod」**：本模组显式兼容（读 `farmerCanSell` 让位自动卖货），无冲突。

### 5. 建议位置
- **方案 A：新建独立适配器进「Mod作弊」页** —— **不可行**。零自有持久键，entry 五个分组只能全空，徒增空壳适配器与探测开销。
- **方案 B：进玩家属性编辑区「模组键」区** —— **不适用**。该区 = 运行时 V 顶层键 − ORIGINAL_V_ROOT_KEYS；本模组从不写入新顶层键。
- **方案 C：不适配，仅文档记录** —— **推荐**。理由：① 无可暴露 varPath（写原版键会被防线双重禁止）；② 模组效果即"每日自动把原版值维护好"，MCE 用户改这些值时次日会被模组覆写——这是模组本体行为，不是 MCE 适配缺口。**安装本模组对 MCE 无结构性冲突**；唯一需文档提醒的是"数值会被每日自动复位"。
- **可选低成本增强（不做也行）**：在 `CHEAT_PASSIVE_PROBES` 加一条被动探测 `{ modId:"autoclean", modName:"AutoClean 0.1.5（自动清洁·无操控项）", detect: !!window.AutoCleanFarm }`，让 Mod作弊 页显示"已识别本模组，全自动维护型，无可调参数"。约 10 行 JS。

### 6. 风险
1. **原版键互相覆盖（主要实际影响）**：每日 0 点强制覆写——`temple_quarters=100`（housekeeping≥1000 时）、`temple_garden=100`（tending≥1000 时）、`edengarden/edenshrooms/edenspring=4`（**无条件锁值**）、`soap/salve=10`、`bird.materials.wood=10`、`avery_mansion` 八房间清零 + `days_absent=0`、`farm` 四动物=30 + `aggro=0` + `stock` 清零。**用户经 MCE 原版面板手动改这些值后，次日 0 点会被自动钳位回去**——不崩溃，但"改了又复原"。文档应提醒：想临时压低这些数值做剧情时，先卸本模组。
2. **探测键冲突**：拟用 `window.AutoCleanFarm`（或 `window.modUtils.getMod("AutoClean")`），与现有 5 个探测键均无碰撞。
3. **宿主初始化依赖**：TweeReplacer + ReplacePatcher 未装时补丁不生效（但脚本仍加载，`window.AutoCleanFarm` 探测仍为真）——**探测为真 ≠ 功能生效**，文档需注明依赖两个补丁框架。
4. **版本漂移盲区**：readme 适配游戏 0.5.10.12，MCE 基准 0.5.12.13；ReplacePatcher 靠**字符串精确匹配** time.js，游戏升级后匹配串若变动，补丁**静默失效、无报错**。
5. **更新追踪盲区**：无公开仓库，无法自动检测更新。

### 7. 工作量评估
- **推荐方案 C：小**。纯文档记录（本章节 + Mod作弊 帮助区一行提醒"装了 AutoClean 原版数值每日 0 点自动复位"），零代码风险；若顺手加被动探测条目，约 10 行 JS。

---

## DoLSims

### 1. 是什么
- **modName / version**：boot.json 实证 `name=DoLSims`，`version=0.8.1.7`（中文作者出品的大型玩法扩展模组，本体体量 265 文件）。
- **功能一句话识别**：「类模拟人生」式玩法大扩展——市立图书馆（新 NPC「希斯 Seath」）、校内电脑房（直播打赏/社交媒体账号/弹幕）、风纪委员（Judgement）系统、学校订单换装（SchoolOrder）、图书馆读书解锁特质/属性、催眠体系（镜中催眠/神殿催眠）、健身房、纹身、市场自行车、酒吧喷雾枪、寄生生物战斗扩展、原版 passage 的 TweeReplacer/ReplacePatcher 文本补丁。README 自述入口为「游戏内 选项-模拟人生 或侧边栏」。
- **作者/仓库渠道**：包内 README 仅写「下载位置：点击右侧的 releases」「作者经常不查看 github」，**未包含任何 URL**；boot.json/源码注释中无仓库链接（仅 timeHookSims.js 注释引用依赖项 DoLTimeWrapperAddon 的 github.com/Lyoko-Jeremie/DoLTimeWrapperAddonMod）。已做两次网络搜索，**未定位到公开仓库**——标注：「无法自动检测更新」。
- **依赖实证（boot.json dependenceInfo）**：ModLoader>=2.5.2、GameVersion>=0.5.8.9、ImageLoaderHook>=2.3.0、DoLTimeWrapperAddon、TweeReplacer、ReplacePatcher、ModdedFeatsAddon（后者挂载 1 个 feat「Dust Sealed Sims · 尘封：进入了市立图书馆的三楼」）。

### 2. 源码结构概览
- **文件比例**：twee 19 个 + js 2 个（`funcSims.js` 1246 行 / `timeHookSims.js` 372 行）+ css 2 个。modules/ 目录仅存 CSS。
- **目录结构**：`game/03-JavaScript/`（2 JS）、`game/base-system/overlays/`（特征页/设置页覆盖）、`game/base-combat/`（寄生战斗）、`game/overworld-town/`（市立图书馆/健身/酒馆/市场/神殿/商店/学校各 event、家中、街头、农贸市场）、`game/feats/`，以及根级 `StartOnly Sims.txt`（开局初始化 passage）与 `Updates Sims.txt`（旧存档迁移 passage）。
- **挂载方式（源码实证）**：① JS 函数直接挂 `window.*`（funcSims.js 末尾 30+ 个）；② 时间推进 hook 经 **DoLTimeWrapperAddon**（`window.addonDoLTimeWrapperAddon.addFunctionHook`，五组 hook 表）；③ TweeReplacer/ReplacePatcher 原版 passage 替换；④ 游戏内入口「选项-模拟人生」设置覆盖层（挂 V.options 子键）。
- **核心状态宿主**：**没有统一 umbrella 对象**。全部持久态散挂 V 顶层，命名约定 `*Sims` 后缀 + 少量无前缀新根（`SchoolOrder`、`Seath_*`、`citylibrarybook*`、`AccountNormal*`、`danmakuSystem`、`hypnosis_traits`、`world_corruption_soft`、`demon/angel/fallenangel` 等）。

### 3. 变量根清单（scan_mod_vars 输出 306 引用根，已核对 ORIGINAL_V_ROOT_KEYS 186 键后筛选）
**已剔除（原版键/非模组键，禁止暴露）**：`options`（设置子键全在它名下，按写入防线不可暴露）、`NPCName`、`weekly`、`brothelshowdata`、`kylarenglish`（原版恋人进度）、`stress/stressmax/arousal/arousalmax/exposed/athletics/tending/housekeeping/backgroundTraits/money/rentmoney/babyRent/lock/speech_attitude`、`passage`（SugarCube 运行时键）、`test` 等。
**清单未覆盖、疑似第三方/原版新增键（待确认，设计时跳过）**：`birdbuild`、`masochism/sadism` 及 `*SavedSims` 镜像、`adultshopintro/adultshopunlocked/adultshopprogress/adultshopcontribution`、`alarmTextSims1/2/3`、`NPCNameList`（功能性数组）、`phase2/phase3`（极通用名，可能撞其他模组——待确认）。

**DoLSims 自有持久变量根（精选）**：

| 根 | 类型 | 实证与钳制 | 所属玩法 |
|---|---|---|---|
| `sinSims` | 数值 | StartOnly 初始 1000，`clamp(0,1000)` | 罪恶值 |
| `hypnoSims` | 数值 | 0 起，门槛 100/300/500/1000 | 催眠熟练度 |
| `usedHypnoSims` / `storedHypnoSims` / `plusHypnoSims` | 数值 | 镜中催眠消耗/储存 | 催眠 |
| `SchoolHypnoPermissionSims` | 数值 | D+ 等级判定（>=1 可对自身） | 学校催眠权限 |
| `MirrorHypnoSims_0`..`_5` | 布尔 | 镜中催眠等级开关 6 档 | 催眠 |
| `DisciplineSims` / `PopularitySims` / `HorninessSims` / `InfluenceSims` | 对象 `.value` | 四处 `clamp(value, 0, 40.0)`，注释"目前锁死上限为40" | 风纪委员四维 |
| `SchoolOrder` | 对象 `{privacy, pantie, clothes}` | 字符串枚举 `normal/strict`（Updates Sims.txt 初始化） | 学校订单换装 |
| `Judgement_Init` | 数值 | `>=3` 激活风纪委员系统（×10） | 风纪委员 |
| `Judgement_Examine_Finished` | 数值 | 每日晨检锁（0/1） | 风纪委员 |
| `Seath_phase` / `Seath_Dialog` / `Seath_Allowed_Pass` / `Seath_Allowed_Pass_Anytime` | 数值/布尔 | 图书馆 NPC 阶段与放行 | 市立图书馆 |
| `Library_Trouble` | 数值 | 0/1/2 事件状态 | 市立图书馆 |
| `citylibrarybook_11..17` | 数值 | 读书进度，上限 1000 | 图书馆读书线 |
| `citylibrarybook_14_1..5` + `*_trait` | 数值/布尔 | 14 号书子阶段与特质解锁 | 图书馆特质线 |
| `hypnosis_traits` | 对象 | `.scream` 等子键 0-5（遗忘/解封） | 图书馆催眠特质 |
| `WDestinytrait` / `EXCombattrait` / `quantumtrait` / `intercalatetrait` | 布尔 | 命运之轮/无限制格斗/量子速读/置闰五行 | 图书馆特质 |
| `demon` / `angel` / `fallenangel` | 数值 | `demon>=6`、`fallenangel>=2` 判定 | 14 号书解锁属性 |
| `world_corruption_soft` | 数值 | `>=90` 触发、时间 hook 减 50 | 世界软腐化 |
| `gameskillSims / liveskillSims / programskillSims / createskillSims / searchskillSims / hypnosisskillSims` | 数值 | StartOnly 初始 0 | 电脑房技能 |
| `AccountNormal` / `AccountNormalFansNum` / `AccountNormalName` | 数值/字符串 | 社交账号等级/粉丝数/昵称 | 电脑房直播 |
| `livemode` / `liveAudienceNum` / `liveAdminWatch` / `liveTitle` / `liveContentText` / `liveAtmosphere` | 枚举/数值/布尔/字符串 | 直播系统 | 直播 |
| `danmakuSystem` / `customDanmakuPool` / `customSCTemplates` | 对象/数组 | `V.danmakuSystem = {normalPool: []}` | 弹幕系统 |
| `Gym_Card` | 数值 | `>=2` 判定、每日非周一 -1 | 健身卡 |
| `weaponSprayGunSims` / `weaponSprayGunSkillSims` / `pubSpraySims` / `pubSprayPerWeekSims` | 布尔/数值 | 喷雾枪及周锁 | 酒吧/学校 |
| `BicycleSims` | 布尔 | 已购自行车 £3000 | 市场 |
| `FreeToListen_Bailey` / `FreeToListen_Bailey_Init` / `FreeToListen_Bailey_Rent_Sims` / `FreeToListen_Leighton` / `FreeListenPermissionSims` | 数值/布尔 | 倾听权限系列 | 剧情线 |
| `head*`（headdrive/headnodetention/headmoney/headphotoshoot/headblackmailed） | 数值 | 多伦 blackmail 事件链 | 学校事件 |
| `kylar_abduction_today_Sims` / `kylar_mad` | 数值/布尔 | 凯拉尔每日一狙锁 | 街头事件 |
| `aliceLiddellAlreadySims` | 数值 | 爱丽丝相关标记 | 剧情线 |
| `creatureVaginaSims` / `creatureAnusSims` / `creaturePackedSims` | 数组 | 寄生生物战斗状态 | 寄生战斗 |
| `tattooSims_1..12` / `tattooSims_color_1..12` | 字符串 | 纹身槽位 | 纹身店 |
| `confessorQuestionsSims` / `confessorQuestionSims` / `TempleDreamKnewSims` / `temple_spear_mission` | 数组/字符串/布尔/数值 | 神殿催眠线 | 神殿 |
| `SSCAppliedSims` / `SSCAppliedSimsLast` / `SSCDailyAppliedSims` | 数值 | 防晒霜日锁 | 道具系统 |
| `uncomfortable_Sims_141/145` | 布尔 | 恐虐/帝皇注视封印开关 | 图书馆 |

### 4. 可适配面（按 CHEAT_ADAPTERS 分组模型）
- **stages（阶段枚举/数值）**：`Seath_phase`、`Library_Trouble`（0/1/2）、`Judgement_Init`（>=3 激活）、`SchoolHypnoPermissionSims`、`temple_spear_mission`、`clearModSimsFuncDec_phase`（0/1）、`aliceLiddellAlreadySims`（1/2）。
- **abilities（布尔开关）**：`MirrorHypnoSims_0..5`、`weaponSprayGunSims`、`BicycleSims`、`FreeListenPermissionSims`、`FreeToListen_Bailey`、`FreeToListen_Leighton`、`TempleDreamKnewSims`、`Seath_Allowed_Pass_Anytime`、`citylibrarybook_*_trait`（5 个封印开关）、`usedpraySims` / `usedNotPraySims`。
- **values（数值，含建议钳制）**：`sinSims` 0-1000；`hypnoSims` 0-1000；`DisciplineSims.value / PopularitySims.value / HorninessSims.value / InfluenceSims.value` 0-40（与源码 clamp 对齐）；`Gym_Card` 0-7；`liveAudienceNum` 0-999999；六个电脑技能 0-999；`citylibrarybook_11..17` 0-1000；`demon/angel/fallenangel` 0-10；`world_corruption_soft` 0-100；`AccountNormalFansNum` 0-999999；`weaponSprayGunSkillSims` 0-100；`headblackmailed` 0-1。
- **tasks（任务推进/日锁类）**：`Judgement_Examine_Finished`、`City_Library_3rd_trespassing`、`Seath_Noticed_Daily`、`kylar_abduction_today_Sims`、`pubSprayPerWeekSims`、`SSCDailyAppliedSims`——作弊价值低（每日自动重置），**不建议暴露**。
- **探测键建议**：`typeof window !== "undefined" && typeof window.MirrorHypnoVariableRefresh === "function"`（funcSims.js 无条件挂载，脚本加载即存在；与现有 5 个探测键零碰撞）。
- **与现有 5 适配器重叠点**：
  - **归途之书**：主题重叠（都涉神殿/催眠），但键完全不同（RobinTemple/TempleChoir vs confessor*Sims/TempleDreamKnewSims），命名空间不撞；面板需注明两者可共存。
  - **DomRobin**：DoLSims 源码有显式 `<<if $robinFightTogether is true>>/*dom罗宾的适配分支*/`——**只读** DomRobin 状态做兼容分支，不写；无变量冲突。
  - **SmartPhone**：自建电脑房 UI 与 V.Phone 完全独立，命名空间不撞。
  - **More Love Interests / 枯木逢春**：无交集。

### 5. 建议位置
- **A. 新建独立适配器进「Mod 作弊」页（推荐）**：modId 拟 `dolsims`，modName `DoLSims 0.8.1.7（类模拟人生大扩展）`，detect 用上述 window 函数探测；从 250 候选根中精选 40–50 个高价值项（stages/abilities/values 三类）。理由：无统一宿主对象，散根 250 个直接灌进玩家属性编辑区会淹没面板；独立适配器可做分组（风纪委员/图书馆/催眠/电脑直播/其他）并逐项标注钳制范围。写入防线天然成立：四维 `.value` 对象与 SchoolOrder 只在 `StartOnly Sims`/`Updates Sims` passage 执行后才存在，旧档/未推进档对应 root 为 undefined，cheatResolvePath 直接拒绝写入并提示"请先推进模组剧情初始化"，不崩溃。**注意：V.options 下的子键根是原版 options，一律不暴露**。
- **B. 只进玩家属性编辑区「模组键区」**：不推荐——该区是"运行时 V 顶层键 − 原版清单"自动推导，DoLSims 会灌入 head*/日锁/临时标记等上百个噪声键。
- **C. 不适配、仅文档记录**：保底方案（若版本漂移太快可先落此档）。

### 6. 风险
1. **原版键误伤**：候选中 `NPCName`、`kylarenglish`、`options` 子键、`weekly/brothelshowdata` 已剔除；`birdbuild`、`masochism/sadism`、`adultshop*`、`phase2/phase3` 等清单未覆盖、疑似第三方或原版新增键，设计时一律跳过，标「待确认」。
2. **探测键碰撞**：已逐一核对现有 5 个探测键，无碰撞；建议选带 Sims 后缀特征的 window 函数名，避免他模复用同名函数。
3. **宿主初始化依赖**：四维 .value 对象、SchoolOrder、danmakuSystem 等只在开局/迁移 passage 后存在；未装模组或存档未跑 Updates Sims 时 detect 虽命中但目标 root undefined——防线表现为拒绝写入，可接受；若要更严谨，detect 可追加 `&& State.variables.DisciplineSims !== undefined`。
4. **体量大 + 版本漂移**：19 twee / 265 文件 / 250 候选根 / 0.8.1.7 仍在快速迭代（待办事项.txt 显示「还没写完，暂时封印」的内容），每次更新都可能改键名/钳制。
5. **更新追踪盲区**：未定位到公开仓库 URL，无法自动版本比对；modName 硬编码版本号，升级后需人工核对。

### 7. 工作量评估
- **对推荐方案 A：大**。即使只精选 40–50 项，也需逐项回源码核对类型/钳制/剧情语义（尤其图书馆 14 号书特质线、风纪委员四维 clamp 边界），且无统一宿主、版本快速迭代，后续每次更新都要回归核对候选根清单。若资源紧张，可先落方案 C（文档记录）并把 detect 键与精选清单作为后续落地种子。

---

## Dol-Optimization（原版优化）

### 1. 是什么
- **modName / version**：boot.json 实证 `name=原版优化`，`version=1.1.2`，packName=`Dol-Optimization-v${version}`。建议 entry.modName 写作「原版优化 Dol-Optimization v1.1.2」。
- **功能一句话识别**：DoL 原版体验优化合集模组，33 个 TweeReplacer 补丁按版本号堆叠：大大大衣柜升级(1.0.3)、医院/剧烈运动处女膜修复(1.0.4)、理发店卖头发+发质系统(1.0.6)、花园催熟肥/自动灌溉机/农资店/浇水状态速览(1.0.7)、存档优化+图书馆清馆修正(1.0.8)、遇欲便利店+NPC Needmeet(1.0.9)、可用物品面板+叠穿侧栏刷新(1.1.1)、学校泳池练习+洗护用品+衣柜过滤(1.1.2)。另有运行时注入：导航栏开关美化、自定义字体(IndexedDB)、快速继续镜像按钮、侧边栏快速存档、棒棒糖脸部饰品。
- **作者与渠道**：署名 Needmeet；包内自带发布页 `https://github.com/ANLINSTUDIO/Degrees-of-Lewdity-DolOptimization`（settings.twee 第 48 行）、自架版本检测接口 `sb.alseece.top`、百度贴吧发布帖。**注意**：外部搜索未直接命中该 GitHub 仓库索引页，仓库实时可达性「待运行时确认」——不要把该 URL 当已验证结论；若发现仓库私有/404，更新追踪即标注「无法自动检测更新」。

### 2. 源码结构概览
- **文件构成**：7 个 JS + 2 个主 twee（settings/game）+ 33 个 `twee\replace\*.twee` 补丁 + 2 CSS。twee:js ≈ 35:7，补丁型模组，本体逻辑集中在 opt-main.js（82KB）。
- **挂载方式**：① `opt-early-inject.js`（inject_early）：**无条件 `window.DolOptimization = {}`** + 扩展 `window.AsAPI`——装上即存在，探测键可靠性最高；② `opt-tools.js`/`opt-inject.js`：设置读写核心（cv/nv/dv/rv 四函数）+ jQuery 段落钩子（:passagerender 同步数据）；③ TweeReplacer 补丁打原版 passage；ReplacePatcher 注册棒棒糖饰品；BeautySelectorAddon 图像包；④ **maplebirch >=2.0.0 为可选依赖**：缺失仅弹提示（opt-main-onframe.js），NPC Needmeet 注册（`maplebirch.npc.add`）不可用，其余功能不失效。
- **核心状态宿主（三处，必须区分）**：① `V.options.opt.*` —— 模组设置，与 localStorage（key=`opt`）双向镜像；② `V.options.DolOptimization.*` —— 跟随存档的扩展状态（衣柜扩容、自定义字体全局开关）；③ 顶层 `V.*` 模组键 —— 叠穿数据/便利店商品/灌溉机/Needmeet 好感等。非持久：`DolOptimization.data`（localStorage）、字体存 IndexedDB（`DolOptimizationDB`）。

### 3. 变量根清单（扫描器实证 + 手工核对）
扫描器输出：40 文件 / 95 引用根 / 候选 69。逐个核对后分类：

**A. 真正的模组持久变量根（可考虑暴露，均不在 186 键清单内）**

| 根/路径 | 类型 | 初始化出处 | 说明 |
|---|---|---|---|
| `needmeet_romance` | number 0-100 | `V.needmeet_romance ??= 0` | NPC Needmeet 好感；≥50「信赖」，≥80 解锁 loveInterest/恋爱线 |
| `hymenreconstructioncount` | number 天数 | 逐日递减，≤0 删除 | 处女膜修复剩余天数 |
| `hairtexture` | number 0-100 | `<<if $hairtexture is undefined>>=50`；每小时+0.05 | **疑似模组自建**（原版清单无），发质值 |
| `nicotine` | number 0-95 | `<<if $nicotine is undefined>>=0` | 香烟尼古丁依赖度 |
| `automaticirrigationmachines` | object `{location: 次数}` | 购买时每位置 20 次 | 自动灌溉机 |
| `fertiliserripening` | object `{current, used}` | `{current:0, used:0}` | 催熟肥持有/累计 |
| `shopClothingFilter` | object | `?? {}` | 衣柜过滤状态（结构复杂，不建议数值化） |
| `nextbuttonclosed` | string[] passage 名 | `??= []` | 用户长按关闭快速按钮的段落 |
| `conveniencestorestat` | number 0 | `= 0` | 便利店商店统计 |
| `cigarette / staysoberpill / stayfrigiditypill / energydrink / shampoo / mildywash` | number 计数 | owned 清单 | 便利店消耗品库存 |
| `foodstuff` | object `{chicken_egg:{amount}, tomato:{amount}…}` | 便利店 | 便利店食材库存 |
| `wornStacking` | object `{slot: itemNames}` | `??= {}` | 叠穿数据本体（复杂对象，不建议作弊） |
| `store.stacking` | object（V.store 下） | `??= {}` | 区域进入时的叠穿暂存（内部簿记） |

**B. `V.options.opt.*` 子键（扫描器按根「options」聚合被原版根过滤，不暴露，手工核对）**——opt-inject.js `loadData` 默认值实证：
`UiBarToggle="default"`（default/back/hide）、`ShowWaterState=true`、`ShowProcess=true`、`WornStacking=false`、`WornStackingTraits=true`、`WornStackingWarmth=true`、`NextButton=true`、`NextButtonBottom=30`(0-100%)、`NextButtonRules=null`、`NextButtonBlacklist=[]`、`QuickSaveEnabled=true`、`QuickSaveMax=5`(1-20)。

**C. `V.options.DolOptimization.*` 子键（存档跟随，手工核对）**：`LargerWardrobe`(bool)、`LargerWardrobeValue`(number 1+)、`LargerWardrobeExpandedValue`(number)、`OptimizationCustomFontGlobal`(bool)、`OptimizationCustomFont`(字体数据 blob，不建议暴露)。

**D. 剔除的原版键/伪候选**：`options`（原版设置根）、`wardrobe/wardrobes/plots/daily/arousal/arousalmax/combat/masturbating/mirrorMenu/outfit/pronoun/skin/makeup/sydneySeen/temple_rank/adultshop*`（原版）、`fertiliser`（原版花园肥料，仅 `fertiliserripening` 是模组）、`event/passage/timeStamp/saveName/ironmanmode`（原版/框架键）、`hairOption/currentEarn/fringeOption/dyeOption…`（理发店 passage 局部临时变量）、`lollipopUntil`（opt-main.js 中已整段注释，未启用）。

### 4. 可适配面（按 CHEAT_ADAPTERS 分组模型）
探测键建议：`!!window.DolOptimization`（inject_early 无条件挂载，装了就在，不撞现有 5 个探测键）。

| 分组 | 建议条目 | varPath | 类型/钳制 | 备注 |
|---|---|---|---|---|
| stages | 导航栏开关美化 | `options.opt.UiBarToggle` | levels default/back/hide | **挂在原版根 options 下，见风险 1** |
| abilities | 叠穿总开关 | `options.opt.WornStacking` | boolean | 默认 false，实验性功能 |
| abilities | 叠穿特质/保暖叠加 | `options.opt.WornStackingTraits`、`options.opt.WornStackingWarmth` | boolean | |
| abilities | 园艺大师浇水/进度显示 | `options.opt.ShowWaterState`、`options.opt.ShowProcess` | boolean | 纯显示开关 |
| abilities | 快速继续/快速存档开关 | `options.opt.NextButton`、`options.opt.QuickSaveEnabled` | boolean | |
| values | 快速按钮离底 % | `options.opt.NextButtonBottom` | number 0-100 | |
| values | 快速存档槽位 | `options.opt.QuickSaveMax` | number 1-20 | |
| values | Needmeet 好感 | `needmeet_romance` | number 0-100 | ≥80 解锁恋爱线，唯一「数值作弊」价值点 |
| values | 处女膜修复剩余天数 | `hymenreconstructioncount` | number 0-30 | 每日递减 |
| values | 发质 / 尼古丁依赖 | `hairtexture`(0-100)、`nicotine`(0-95) | number | 疑似模组自建键，标注待确认 |
| values | 衣柜扩容值 | `options.DolOptimization.LargerWardrobeValue` | number 1-9999 | 模组自身标注「(作弊)」 |
| scenes/tasks | — | 无 | — | 无任务/事件状态机，无场景跳过面 |

**与现有适配器重叠点**：枯木逢春 Orchard/Finance/Transport 与本模组花园优化无共享变量；AutoClean 庄园农业自动维护无共享；SmartPhone 内容面板无交集。唯一轻度语义重叠：`needmeet_romance` 是经 maplebirch.npc.add 注册的 NPC 好感，运行时副本在 `C.npc.Needmeet.love`（框架运行时对象，不写 V），面板改 V 侧即可。

### 5. 建议位置
- **方案 A：新建独立适配器进「Mod作弊」页（推荐）**。detect=`!!window.DolOptimization`，条目按上表约 12 项。**关键前置实证结论**：MCE `cheatResolvePath` 的原版根拒绝清单是 `CHEAT_VANILLA_ROOTS`（03-global.js 429 行起：farm/daily/settings/scenes/…），**其中不含 "options"**——所以 `options.opt.WornStacking` 这类路径当前事实上能写入（根未被拦，父级 V.options/V.options.opt 均存在）。但这是走在「清单缝隙」上：一旦 MCE 日后把 "options" 补进原版根清单，所有 options.* 条目会立即自动变为拒绝写入（不崩，返回提示）。建议：① 顶层模组键（needmeet_romance 等）优先走正常通道；② options.opt.* 条目在 entry 注释中标注「经 options 子键白名单写入，依赖 options 不在原版根清单」；③ 更稳的替代是经模组自身函数通道 `window.DolOptimization.nv(key)` + `saveSettings()` 写入（需适配器 schema 扩展自定义 write hook，**待确认**是否值得为此改框架）。
- **方案 B：只进玩家属性编辑区模组键区**。零代码——`wornStacking/needmeet_romance/hymenreconstructioncount/automaticirrigationmachines…` 本就是顶层 V 键，不在原版清单里，MCE 玩家属性页「模组属性」区会自动列出。缺点：开关类设置（options.opt）不会自动出现，且无分组无中文说明。
- **方案 C：不适配仅文档记录**。本模组 90% 是体验开关、无剧情状态机，作弊价值仅 needmeet_romance/衣柜扩容/处女膜倒计时三项。

**推荐 A（以 B 兜底）**：适配器只暴露真正有作弊价值的 6–8 项（needmeet_romance、hymenreconstructioncount、hairtexture、nicotine、WornStacking、NextButton、QuickSaveEnabled、LargerWardrobeValue），其余开关标注「模组自己的设置页可改，面板不重复」。宿主缺失判定：`window.DolOptimization` 不存在 → detect=false 整块不出现；V.options.opt 未初始化（老存档从未打开过模组设置）→ cheatResolvePath 父级检查拒绝写入，返回提示不崩，符合防线要求。

### 6. 风险
1. **V.options 原版根冲突（最大风险）**：`options` 是 DoL 原版设置根，模组把配置挂在 `V.options.opt` 子键下。MCE 写防线当前未拦 "options"（实证），但属边界模糊地带：写 options.opt.X 不会碰原版子键（enableArt 等），且模组自身 onPassageRender 会把 opt 镜像进 localStorage——面板写入能存活。**已知边角**：模组设置页打开时会执行 `rv()`（settings.twee 第 65 行），先 `V.options.opt = {}` 再从 data 重建——若面板写入后未经任何段落渲染就直接打开模组设置页，该写入会被重建覆盖丢失（正常游玩路径下 onPassageRender 每段落镜像一次，不会触发）。
2. **探测键冲突**：`window.DolOptimization` 与现有 5 个探测键零碰撞；inject_early 挂载时机最早，不可靠性最低。detect 内须 try/catch（依赖 modSC2DataManager 环境）。
3. **宿主初始化依赖**：maplebirch 框架缺失时 NPC Needmeet 功能不工作，但 `window.DolOptimization` 仍在、开关仍可用——探测不应以 maplebirch 存在为条件。
4. **键归属待确认项**：`hairtexture`/`nicotine` 不在原版 186 键清单且模组自初始化，判定为模组自建；若 DoL 新版原版新增同名键，暴露后会误改原版值——上线前建议对最新 DoL 版本复核一次。
5. **更新追踪盲区**：仓库链接为包内自报，外部搜索未直接命中索引页，版本更新追踪能力「待确认」。

### 7. 工作量评估
**小**。detect 一行、条目 6–8 个、全部照抄现有适配器 entry 结构；唯一需要实证验证的是 options 根写入路径（若方案 A 第③点 hook 要做则升到「中」）。

---

## Wraith'sReflection（幽灵的倒影）

> 分析基准：boot.json + 全部 10 个 twee、1 个 js、4 个 json5 补丁参数、26 个补丁文本 .txt 逐文件通读；变量扫描器已跑（11 文件 / 79 引用根）；原版键以 ORIGINAL_V_ROOT_KEYS（186 键清单）为准逐条人工甄别。

### 1. 是什么
- **模组名 / 版本**：`Wraith'sReflection` v1.3.4（boot.json 实证）。
- **功能一句话识别**：DoL 原版「象牙怨灵（Ivory Wraith）」的恋爱线扩展模组——以**偷/还博物馆象牙项链**为主轴（求助米奇→黑进奎恩电脑→市政厅偷项链→湖底监狱对峙→基座归还解锁恋爱线），并扩展约会系统（海滩/公园/市集/森林商店四场景）、银制海螺通灵支线、麋鹿公寓后续剧情、神殿忏悔分支、血月噩梦回收事件、钓鱼湖底杂物（paleBone/paleHair）、全 NPC 对「把怨灵当恋爱对象」的反应文本，以及一个「怨灵的倒影」特质。
- **作者 / 渠道**：包内 README 仅一段作者自述（无署名、无仓库链接）；boot.json/源码注释中无 URL。网络检索只命中 Tumblr 同人内容，**未发现公开 GitHub/分发仓库 → 标注：无法自动检测更新**（本计划基于 v1.3.4 单快照，后续版本变量名漂移需人工复核）。
- **依赖链**：ModLoader≥2.5.2、GameVersion≥0.5.5.9、ImageLoaderHook≥2.3.0、DoLTimeWrapperAddon≥1.0.0、TweeReplacer≥1.0.0（实际要求 ^1.7.0）、ReplacePatcher≥1.0.0（实际要求 ^1.3.0）、ModdedFeatsAddon≥1.0.0。

### 2. 源码结构概览
| 维度 | 实证 |
|---|---|
| 文件构成 | `game/WraithsReflectionTwee/` 10 个 .twee（DateWR 50KB 约会主线最大，ReturnNecklace 21KB 项链主线次之）+ `js/maplebirchAddon.js` 1 个注入脚本（27 行）；另有 `game/WraithsReflection{Replace,Social,Event,Actions}/` 共 26 个补丁文本 .txt + 4 个 Shit*.json5 |
| 挂载方式 | ① `scriptFileList_inject_early=[js/maplebirchAddon.js]`：有框架时 `:storyready` → `maplebirch.npc.add({nam:'Ivory Wraith'},{love:{maxValue:100}, important:true, loveInterest:true, romance:[()=>V.WraithsReflection===1]})`；无框架时降级覆写 `window.isPossibleLoveInterest`。② TweeReplacer：boot.json 内联 9 处 + 4 个 json5 约 30 处 passage 级文本替换。③ ReplacePatcher：patch 原版 `time.js`（每日重置时 `delete V.stealdailyMR`）与 `fish-config.js`（注入 paleBone/paleHair 战利品）。④ ModdedFeatsAddon/DoLTimeWrapperAddon：占位空 hooks |
| 核心状态宿主 | 全部为**散装 V 顶层键**（非集中对象）：`V.WraithsReflection`（恋爱闸门）/ `$HelpAsk`（米奇求助进程）/ `$necklaceWR`（项链持有阶段）/ `$necklaceThief`（偷窃责任归属枚举）/ `$stealdailyMR`（每日偷窃冷却）/ `$SilverConchWR`·`$SilverConchAsk`（银海螺）/ `$WRR`（麋鹿公寓&罗宾介绍标记）/ `$AdmitMR`·`$RefuseWR`（监狱分支选项） |
| 对原版的复用 | 重度复用原版 `$wraith`（state/type/offspring/seen 状态机，并**新增 state 枚举值 "forgive"**）、`$wraithPrison`、`$museumAntiques.antiques.antiqueivorynecklace`、`$pubfame`、`$temple_rank`、`$dateCount`、`$weekly`、`$daily`、`$confession`（写入值 "ThiefWR"）、`C.npc["Ivory Wraith"].love/lust` |

### 3. 变量根清单（扫描器 45 候选 → 人工甄别后）
**A. 模组自有持久根（可考虑暴露，根均不在原版清单内）**

| varPath 根 | 类型 | 引用次数 | 实证行（节选） | 语义 |
|---|---|---|---|---|
| `WraithsReflection` | 数值 0/1 布尔语义 | 扫描×5 + 补丁×3 | `ReturnNecklace.twee` `<<set $WraithsReflection to 1>>`；addon `V.WraithsReflection === 1` | 恋爱线总闸门：=1 后怨灵可设为恋爱对象、约会/海螺/特质解锁 |
| `HelpAsk` | 数值 0/1/2/3/4/5 | ×9 | `PubHelp.twee`：答应=1；找到 IP=2；汇报=3；翻到 IP=4；偷完离开=5 | 米奇求助线进程 |
| `necklaceWR` | 数值 0/1/2/3 | ×6 | 撬盒成功=1；监狱线推进=2；放回基座=3 | 项链持有阶段 |
| `necklaceThief` | 字符串枚举：未设/"player"/"diver"/"return"/"rreturn" | ×8 | `Return Necklace 2` `<<set $necklaceThief to "rreturn">>`（双 r 拼写）；`Return Necklace 9` `to "return"` | 偷窃责任归属，驱动忏悔/分裂/噩梦/麋鹿公寓分支 |
| `necklaceThiefWR` | 字符串枚举 "player"/"diver" | ×2 | 按原 necklaceThief 写入 | 分裂事件记录 |
| `stealdailyMR` | 数值 0/1 | ×2 | `set $stealdailyMR to 1`；每日 delete | 当日偷窃冷却 |
| `SilverConchWR` | 数值 0/1 | 直引×1 + 补丁×3 | 湖底罐子摸到海螺 `set $SilverConchWR to 1`（前提 $WraithsReflection） | 银海螺已获得 |
| `SilverConchAsk` | 数值 0/1 | ×2 | 问过约旦后 `set $SilverConchAsk to 1` | 银海螺已咨询约旦 |
| `WRR` | 数值 0/1 | ×23 | `<<if $WRR>>`；约会中罗宾介绍/合照 `set $WRR to 1` | 复用型标记：麋鹿公寓「说过话」与公园约会「罗宾已见过祂」共用 |
| `AdmitMR` | 数值 0/1 | ×2 | 承认罪过选项 `set $AdmitMR to 1` | 监狱对峙选择 |
| `RefuseWR` | 数值 0/1 | ×1 + 补丁×1 | `set $RefuseWR to 1`；分裂 passage `unset` | 分裂已拒绝标记 |
| `wraithCount` / `wraithMax` | 数值（战斗瞬态） | ×16 / ×14 | 防御式初始化 | 湖底/海滩战斗射精回合计数——**建议不暴露**（瞬态、改了无剧情收益） |

**B. 模组扩展的原版对象子键（根为原版，按写入防线不可暴露为模组键）**

| 子键 | 宿主根 | 判定 |
|---|---|---|
| `$weekly.wraithDate` / `$weekly.wraithMissDate` | `weekly`（清单内） | 每周约会进度/错过计数，**禁止暴露**（根原版） |
| `$dateCount.Wraith` | `dateCount`（原版对象，清单未收录——MCE 清单存在缺口，运行时可能被玩家属性页模组键区自动收录，属既有行为，勿手动加入适配器） | 约会统计计数 |
| `$daily.DateChatWR` | `daily`（在 CHEAT_VANILLA_ROOTS 黑名单内） | 当日湖畔搭话冷却 |
| `$confession` = "ThiefWR" | `confession`（原版） | 忏悔标记，根原版 |

**C. 已剔除的原版/无关根**（扫描候选误报）：`wraith`/`wraithPrison`/`temple_rank`/`speech_attitude`/`weekly`/`dateCount`/`exposed`/`combat`/`struggle`/`penisuse`·`penisstate`/`vaginause`·`vaginastate`/`tentacles`/`enemy*`/`robin*`（robinromance/robinnote/robinpaid/robinReunionScene/robinPostMortem/robinchocolateintro/robinmoney）/`harpy`/`earSlime`/`skulduggery*`/`fightstart`/`forcedBloodmoon`/`blackmoney`/`willingsex`/`forest_shop_intro`/`hypnosis_traits`/`settingsExitPassage` 等——全部为原版键，仅被模组读取或顺带赋值。
**D. setup 级（非 V 键，面板无法操作）**：`setup.loveInterestNpc`/`T.specialNPCs`/`T.importantNpcOrder` 补丁、`setup.fishing.lootTables` 的 paleBone/paleHair、`love:{maxValue:100}`、「怨灵的倒影」特质配置。

### 4. 可适配面（按 CHEAT_ADAPTERS 分组模型设计）
拟用适配器 id：**`wraiths-reflection`**（与现有 5 个 id 均不撞）。探测设计：模组**没有**向 `window.maplebirch` 注册具名模块（addon 只做 `npc.add` 与事件监听），故不能照抄枯木逢春的 `window.maplebirch.get("DeadwoodReblooms")` 模式；建议探测 = 任一模组自有根出现：

```js
detect: function () {
  try {
    var V = getV(); if (!V) return false;
    return (V.WraithsReflection !== undefined || V.HelpAsk !== undefined ||
            V.necklaceWR !== undefined || V.necklaceThief !== undefined ||
            V.necklaceThiefWR !== undefined || V.SilverConchWR !== undefined ||
            V.stealdailyMR !== undefined || V.WRR !== undefined);
  } catch (e) { return false; }
}
```

> 待确认：maplebirch 框架 `npc.add` 后是否提供公开的 NPC 注册表查询接口可反查 "Ivory Wraith" 注册态（源码内不可见，属框架内部）——若无则上述 V 根探测即可，且天然兼容「无框架降级」安装。代价：**剧情未启动的新档 detect=false，适配器不显示**——此时本无可作弊内容，可接受。

拟声明项（根均为 A 类自有根，leaf 缺失允许，宿主缺失即 detect 未命中或 parent 拒绝，不会崩）：
- **stages（阶段枚举）**：`WraithsReflection` [0,1]「未开启/已开启恋爱线」（note：=1 直接解锁恋爱对象资格/约会/海螺/倒影特质，但前置项链线未走时 UI 会「能恋爱但无记忆」，建议配合 necklaceWR/necklaceThief 一起设）；`HelpAsk` [1,2,3,4,5]；`necklaceWR` [0,1,2,3]「未偷/已偷出/监狱已推进/已归还基座」；`necklaceThief` ["","player","diver","return","rreturn"]（note：模组自身 `Return Necklace 2` 写入 "rreturn"（双 r），WraithWR.txt 两处拼写都认，但 Lake Ruin Plinth/Schism Wraith/Nightmare Wraith 3/Widgets Wraith/Containers/Elk Compound 约 6 处补丁只认 "return"——面板忠实列出两种取值，写入 "return" 覆盖面最全）。
- **abilities（布尔/0-1 旗标）**：`AdmitMR`、`RefuseWR`、`SilverConchAsk`、`WRR`。
- **values（数值钳制）**：`SilverConchWR` 0/1；`stealdailyMR` 0/1（清当日偷窃冷却）。
- **scenes / tasks**：留空（无集中剧情对象可跳）。
- **不暴露**：`weekly.wraithDate`、`dateCount.Wraith`、`daily.DateChatWR`、`wraith.state="forgive"`（根均为原版）、`wraithCount/wraithMax`（瞬态）。

**与现有适配器的重叠点**：变量命名空间零共享——归途之书（RobinTemple/TempleChoir/LostLamb/TempleDuties）、枯木逢春（RobinExpansion/LifeSimulation/BirdTower/StreetLife/Finance/VanillaPlus）、MLI（setup.foodPreference）、DomRobin（window.modUtils）、SmartPhone（V.Phone）均与本模组 A 类根无交集。功能层面：约会线与罗宾重逢/热可可摊场景交织（只读原版 `$robinReunionScene`/`$robinchocolateintro`），不写跨模组共享键；探测键也不撞。

### 5. 建议位置
- **方案 A（推荐）：新建独立适配器 `wraiths-reflection` 进「Mod 作弊」页**。理由：自有根 11 个、可声明项约 10 个，体量与已有 5 个适配器相当；探测函数简单稳定；用户价值高（跳项链主线+开恋爱闸门是最刚需的两个作弊点）。
- **方案 B：仅进玩家属性编辑区「模组键区」**——不可行为主：A 类根虽会自动出现，但 `necklaceThief` 是字符串枚举（手动填 "return"/"rreturn" 极易写错），`HelpAsk/necklaceWR` 无钳制易填出剧情真空值；且 `weekly.wraithDate` 这类原版根子键进不了模组键区。仅作不想加适配器时的兜底。
- **方案 C：不适配仅文档记录**——浪费，本模组状态链是「一步错步步错」型（没还项链就开恋爱闸门会剧情穿帮），面板提供带钳制的枚举比文档更能防错。

**宿主缺失表现**：`cheatResolvePath` 对 parent 缺失直接拒绝写入（不崩）；拟暴露项均为 V 直属根，parent=V 恒存在，leaf 缺失属正常初始化允许写入；真正的「宿主缺失」= 模组未安装 → detect=false → 适配器整组不渲染，符合防线要求。

### 6. 风险
1. **原版键隔离**：本模组重度改写原版 `$wraith` 状态机语义（"forgive" 新状态渗透进原版约 10 处补丁）。适配器不碰 `$wraith`/`$wraithPrison`/`$museumAntiques` 根，隔离干净；但**面板把 `necklaceThief` 写进 "return" 后，原版 `$wraith.state` 不会自动变成 "forgive"**——forgive 是模组剧情顺带写入的，跳过剧情直写键会留下状态机不一致（建议 note 提示用户 forgive 态需另经原版怨灵面板或读档后触发 WraithWR passage 刷新）。
2. **探测键冲突**：基于 V 自有根并集，与现有 5 个探测键无任何重叠。
3. **宿主初始化依赖**：新档未进项链线时 detect 不命中（已评估为可接受）；无框架降级分支下 `npc.add` 不执行，但 V 键语义不变，探测不受影响。
4. **模组自身 bug 传导**：`"rreturn"` 双 r 拼写分裂——面板只能如实暴露两种取值，无法修复模组内部不一致；`HelpAsk=4` 替代线在 UI 文案无对应入口，写 4 等于伪造该路径。
5. **更新追踪盲区**：无公开仓库，版本漂移只能靠重新解包扫描复核。

### 7. 工作量评估
**小**——新增一个 `CHEAT_ADAPTERS["wraiths-reflection"]` 条目（detect 5 行 + entry 约 10 项声明），纯数据声明无新机制，半天内完成；主要后续成本在「rreturn/forgive 态一致性」的用户侧文案打磨。

---

## 三、决策清单（请用户选择）

以下每个模组请各选一项（推荐项已标注 ⭐）；确认后进入实施阶段（实施时按所选方案修改 04-modcheat.js 并走全链验证）。

| # | 模组 | 选项 | 说明 |
|---|---|---|---|
| 1 | CombatTerminator 0.1 | ⭐ C. 不适配，仅文档记录 | 零收益空壳适配器无意义；文档记录其存在与「按钮改的是原版战斗值」即可。或坚持 A（空壳适配器，需实机验证 modUtils.getMod 探测）？ |
| 2 | AutoClean 0.1.5 | ⭐ C. 仅文档记录 | 无可作弊键；文档提醒「原版数值每日 0 点自动复位」。可选增强：加一条被动识别条目（Mod作弊 页显示"已识别 AutoClean，无可调参数"，约 10 行 JS）——要不要？ |
| 3 | DoLSims 0.8.1.7 | ⭐ A. 新建独立适配器（工作量大） | 精选 40–50 项，需逐项核对源码类型/钳制，后续每次版本更新需回归。若资源紧张：先落 C（文档记录）+ 保留 detect 键与精选清单作种子，再分批实施？ |
| 4 | Dol-Optimization 1.1.2 | ⭐ A. 独立适配器 6–8 项（B 兜底） | 接受「options 子键白名单写入」（options 不在原版根清单，属边界地带）；或选 B（零代码，模组键区自动出现顶层键，但开关类设置不出现）；或 C。 |
| 5 | Wraith'sReflection 1.3.4 | ⭐ A. 新建独立适配器（约 10 项） | 小工作量、用户价值高（跳项链主线+开恋爱闸门）；注意接受 "rreturn" 双 r 与 forgive 态一致性提示。或 B / C。 |

**实施顺序建议**（如全部选 A）：Wraith'sReflection（小）→ Dol-Optimization（小，先实证 options 写入路径）→ DoLSims（大，可单独一轮）；CombatTerminator 与 AutoClean 落文档记录（含被动识别条目，可选）。

**全局待确认事项汇总**（进入实施前需澄清或实机验证）：
1. CombatTerminator：`window.modUtils.getMod` 对零 scriptFile 纯补丁模组的探测可靠性（实机验证）。
2. Dol-Optimization：包内自报仓库 `github.com/ANLINSTUDIO/Degrees-of-Lewdity-DolOptimization` 可达性（运行时确认）；`hairtexture`/`nicotine` 与最新原版键名是否冲突（上线前对最新 DoL 复核）。
3. Dol-Optimization × AutoClean：两模组对同一段 time.js 的双补丁兼容性（实测）。
4. DoLSims：`birdbuild`、`masochism/sadism`、`adultshop*`、`phase2/phase3` 等键归属（待确认，设计时已跳过）。
5. Wraith'sReflection：maplebirch 框架 NPC 注册表查询接口是否存在（若存在可作为更稳探测键）。
6. 全部 5 个模组除 Dol-Optimization 外均无公开仓库，**无法自动检测更新**；Dol-Optimization 的仓库链接也需确认可达——版本追踪能力整体偏弱，适配器 modName 中的版本号需在每次模组更新后人工核对。

---

*本计划书由 MCE 适配分析任务产出：解压目录分析后已清理，MCE 仓库未做任何修改。*
