# MapleBirchCE 更新日志

版本线记录（v1.8.4 起；更早版本历史见会话存档）。版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 字段。

## v1.9.22（2026-10-30 · UI 视觉系统规格化：Apple 式精密 × 金色玻璃 · 已发布）

**UI 视觉系统规格化（延续 v1.9.18 排版 token 化）**

### ① 尺寸系统（dimensional-drawing 图纸规格映射）

- 新增 token：`--mce-panel-w:430px`（面板宽显式化）/ `--mce-panel-r:8px`（面板左侧圆角）/ `--mce-row-h:34px`（数值行高）/ `--mce-tab-h:36px`（页签高）/ `--mce-border-quiet:rgba(255,255,255,.08)`（低对比描边）；
- 控件圆角 `--mce-radius` 3px→4px，统一作用于卡片/折叠组/按钮/输入框/下拉。

### ② anti-slop 视觉规则（design-taste 应用屏约束）

- **accent 金唯一职责**：当前页签、主操作、数值高亮；折叠组标题由金色改 `--mce-txt-strong`，金色只出现在"当前状态 + 主操作"；
- **quiet borders**：面板 / 页头 / 页签 / 分区标题 / 状态栏描边全部改用低对比 `--mce-border-quiet`，分区虚线改实线；
- **去发丝分割线**：数值行移除 `border-top`，改间距分层 + 悬停标签金色反馈（行高 34px 统一）；
- **玻璃感微调**：面板底色 `.96→.92`（不引入 backdrop-filter，守住 DoL-Game-UI 每帧扫描的性能边界）；
- 面板阴影柔和化（0 12px 34px/.7 → 0 10px 28px/.55）；输入控件加金色聚焦描边。

### ③ 验证

- codegraph impact（07a-shell.js 自包含、零下游依赖）；全链 6 步验证见交付记录；已打包（223,296 B / SHA256 `BA9D29F7…`，verifier 4/4、zip 正斜杠 4/4）已装 game；已发布（Release v1.9.22，资产 SHA 回读一致）。

### ④ 自查补（2026-10-30 二次走查：全仓类名覆盖核查 + anti-slop 遗漏排查）

- **修 4 处裸样式（DOM 用类但 CSS 未定义，此前无视觉状态）**：`mce-btn-active`（性别切换选中态——原仅 ✓ 字符提示，现补金色选中态）/ `mce-data-card`（07c 角色数据卡——补卡片容器视觉，对齐 .mce-card）/ `mce-note`（07h 剧情进度说明——补弱色小字）/ `mce-row-name`（07h 剧情进度行名称——合并进 .mce-row-lbl 选择器）；
- **一致性**：`.mce-statrow`（全局页数值行）同步 `min-height:var(--mce-row-h)` + hover 标签金色，与 `.mce-row` 规格统一；操作件圆角统一——`.mce-btn`/`.mce-inp`/`.mce-search-inp` 由 2px 升 4px（chip/标签/阶段卡保持 2px 层级）；`.mce-search-inp` 补 `max-width:100%`（窄屏防溢出）；`.mce-errbox` 边框降 quiet；
- **清理死样式**：`.mce-type` 全仓零引用（仅 CSS 串自身），删除。

### ⑤ 审计补（2026-10-30 三轮走查：CSS 变量完整性 / 硬编码残留 / 内联样式，脚本化可复查）

- 新增审计脚本 `tools\selfcheck\ui_audit_css.js`（提取 `var CSS` 语句级全部 135 个片段 → {} 配平 + 引号状态机 + :root token 定义集 + var() 引用集差集 + 非 token 段 hex/rgba/px 硬编码扫描）；脚本自身修复两处提取 bug（续行片段以选择器开头过滤致丢段、token 前缀比较不一致）；
- **审计结论**：CSS 结构合法（配平 OK）；var() 引用 75 = :root 定义 75，**零失效样式、零死 token、零硬编码颜色**（hex=0、rgba 仅 3 处纯黑阴影透明度，属合理保留）；px 硬编码 24 项均为组件级几何参数（padding/width/min-height 局部值），不强行 token 化；
- **修 2 处**：死 token `--mce-border-faint`（全仓零消费）删除；`07f-lock.js` 自由添加 varPath 输入框宽度 `style.width="200px"` 内联硬编码 → 回归 CSS 类 `.mce-inp.mce-path`（200px + max-width:100% 防窄屏溢出）；
- DOM 内联样式全仓 7 处核查：6 处为功能态显隐（display none/""/inline-block 切换，非主题量），保留。

## v1.9.21（2026-10-29 · 新适配器：DolMod「人物附加与生活质量提升」· 已发布）

**新适配器：DolMod-（MyFirstMod v0.1.880，doctor55555-55555）**

### ① 新适配器第 12 个：`04a-11-dolmod.js`（modId `dolmod`）

- **官方汉化名核对（三源一致）**：「人物附加与生活质量提升」——仓库 README 标题 / zip 内 `boot.json` `name` / 仓库内直传 zip 文件名「人物附加与生活质量提升_v0.1.801.zip」；作者英文自称 MyFirstMod，repo 名 DolMod-；适配器显示名用官方中文；
- **声明结构**：阶段 1（阿电表白状态机 `adian_confession_state` 四态字符串：空/rejected/friend/lovers，走 setCheatStage 字符串通道，参照归途授职阶段先例）+ 能力 12 + 数值 17；
- **能力 12**：阿电已认识（`adian_met`）/ 恋爱中（`adian_romance`）/ 住院（`adian._inHospital`）/ 入狱（`adian._imprisoned`）/ 举报（`adian._reported`）/ 吃醋就绪（`adian._jealousReady`）/ 电脑满配（`computer.assembled`，sync 补 10 顶级部件 + `performance=91` + `location=bedroom`，部件名逐字取自 `ComputerMod.PartsCatalog`："全塔工作站机箱"…"RTX 5090""客制化机械键盘"；拆件 uninstallPart 回库存不崩）/ 全应用（`computerApps`，sync **clear 9 键置 null + set 9 键 true** 实现卸载语义）/ 异国小吃摊（`indianStall_found`）/ 海上平台（`seaPlatform_found`）/ 阁楼广播零件/装好（`adian._loftRadioParts`/`_loftRadioSet`）；
- **数值 17**：斯德哥尔摩值（`adian._stockholm` 0-100）/ **告白拒绝日（`adian_reject_day` Time.days 语义：拒绝当天写入 → 7 天房间冷处理，adian-confession.twee:70 + modscript.js:348-349 实证；填当天+状态 rejected=完整冷处理，留 0=无冷却）**/ **囚禁信任（`adian._captiveTrust` 0-100 主存，adiankidnap.twee:96/184/193 Math.clamp 实证；自由活动等级由信任派生 :321 trust≥80→3/≥50→2/≥20→1，同转化 stage 先例不暴露派生键，写 100=最高信任+3 级自由；宿主 adian 由 modscript.js:318 无条件兜底，父缺失拦截不触发，未囚禁写入不生效但无害，可先勾囚禁或先写信任再勾）**/ 银行活期（`bank.savings` 0-99999999，日息 0.0002 实证）/ 网课 8 键（科学/数学/英语/历史 × 等级 0-2 封顶 C+ + 进度 0-200 满触发本体 school_skill_up）/ 兔子+进度 / 人鱼+进度（阶段 0-3 阈值 [30,60,90]，写值需阶段与进度配套）/ NG+ 轮次（`ngplusCycle` 0-99）；
- **隔离与防线**：`NPCName`/`loveInterest`/`money`/`adian.love` 均不声明（阿电 love/rage 本体属性走角色面板/框架，适配器拒写原版根）；父级对象缺失（`V.computer`/`V.bank` 未初始化）CE 拒绝写入并提示先进过电脑店/银行（模组 ensure() 初始化）；告白状态与恋爱槽位分离（`adian_romance===1` 即恋爱中，槽位缺失只影响显示）；
- **探测防误命中**：首选 `window.ComputerMod/BankMod/NgPlus`（script 无条件挂载、装上即存在）；V 兜底用 `computerApps/computer/ngplusCycle` 或 `adian_met+adian_romance` **双键同时存在**；**不用** `rabbitbuild/mermaidbuild`（与本体转化键同名，会造成未装模组也误命中）与单键 `adian_*`（剧情触发前 undefined）。

### ② 回归隔离

- `test_mce.js` 新增 51 节 DolMod 段（51.1-51.8：探测/隔离/能力/阶段四态/满配拆机/全应用装删/银行转化网课 NG+/卸载消失）；
- 18.0b/24.0 清理段补 DolMod 探测根删除——13 节恋爱测试写入的 `adian_met/adian_romance` 不再干扰 18.x/24.x 计数断言（首轮回归 8 FAIL → 二次收敛后全绿）；
- `functional_e2e.js` B 段 9→10 适配器（真实断言 `mods.length === 10`）+ 关键词阵列加「人物附加与生活质量提升」。

### ③ 验证与纳入每日检测

- 全链 6 步（build→syntax→smoke→回归→E2E→性别集成）全绿（build 552039 B，SHA256 `9c0d67fc…`；回归 51 节含 51.7 拒绝日+囚禁信任）；未打包、未发布（等用户指令）。
- **纳入每日自动检测（渠道 11→12）**：`tools/check_mod_updates.js` CHANNELS 加 dolmod 渠道（第 11 项，框架第 12）；官方 release tag（如「1.9.4测试」）是作者内部版本号、与包内版本无关——新增 `useAssetVersion:true` 分支从 release 资产名（`_v0.1.880.zip` → 0.1.880）提取版本比较，无资产时回退 tag 并标注需人工确认；实测 12 渠道输出 `[dolmod] 0.1.880 / 1.9.4测试 → 无更新（均为 0.1.880）` 正确不误报。
- **自查优化（audit 对照定案 + 深度探查）**：`audit_adapters.js dolmod _modcache\dolmod0880` 声明 28→30 条；9 条「声明缺失」全部为**动态键盲区误报**——网课 8 键源码形态 `V[key + "_exam"]`/`V[key + "trait"]`（computer.js:508-533，key 遍历 science/maths/english/history）+ `computerApps.game_indie` 经 `V.computerApps[id]` 变量下标（computer.js:268，id 取 APPLICATIONS 表），audit 只扫 `V.` 字面故漏，实证源码全部存活 **KEEP 零删失**（同 featsBoosts/MoreFarm 温室下标动态键先例）；转化键复核：`_targetStage` 由 build 派生（transformation.js:105-106）、模组 `setStage` 会把 build 校准到阶段门槛（:193-194），适配器 note"阶段+进度配套写"语义正确；补 **dm_reject_day** + **dm_captive_trust**（见数值 17）。audit 盲区已记 `.learnings/ERRORS.md#ERR-20261029-002`。
- **深度探查（对 v0.1.880 对照源码全量甄别）**：逐类定案不补面——银行定期/理财（玩法系统，活期已覆盖资金作弊）、钓鱼（0.5.12+ 本体兼容层 `setup.vanillaFishingOn()` 实证，`$fishing` 原版键隔离）、售货机库存/抢劫冷却（`vending_robbed` 7 天/`vending_*_stock` 每日随机，瞬态玩法）、收音机（hedgefunds.twee 实为 `radioChannel`/`radios` 收听系统）、NG+ 触发标记（`ngplus_trigger` 坏结局门）、`robindebtevent`（boot.json:189 注入锚点只读）、`_freedomLevel`（信任派生值）；**值得补仅 1 键 `_captiveTrust` 囚禁信任**（见数值 17）。

## v1.9.20（2026-10-29 · 适配更新轮：枯木逢春 2.5.7 + 归途之书 1.4.5 + 框架 5.5.7 · 未发布）

**三渠道模组适配更新 + Mod 列表名称显示修复**

### ① 适配器版本号更新（对照新版源码审计，零删失）

- **枯木逢春 2.5.7**（`04a-04-deadwood.js` modName 2.5.5→2.5.7）：对照 `tools/_modcache/dw257` 审计，140 条 varPath 全存活——resolve 122 KEEP / 14 REVIEW（全部保留）/ 1 REMOVE（`RobinExpansion.investment.agreed`，静态盲区误报：`Finance\Adrian.twee:285` `$RobinExpansion?.investment.agreed` 可选链写法实证存活，证伪移除判定 → **保留**，与 2.5.5 轮判定一致）；
- **归途之书 1.4.5**（`04a-01-revelation.js` modName 1.4.4→1.4.5）：对照 `tools/_modcache/rv145` 审计，57/57 全覆盖 KEEP，零缺失零删除；官方更新为纯 bug 修复（语言切换人称/衣物、告解/祈祷重复状态、津贴只领一次、迷途羔羊梦境时间核对、象牙怨灵返回链接），无新功能键；
- **框架 5.5.7**（`check_mod_updates.js` declOverride 5.5.6→5.5.7）：`check_framework_api.js` 核对 5.5.7 `dist/inject_early.js`——CE 依赖 8 项核心 API（window.maplebirch / get / npc(.data) / temporary / traitLists / define / frameworkNotice）全保留；`setup.MapleBirch`（01-core 兜底分支，主路径存在不触发）/ `maplebirch.patch`（CE 0 次调用）缺失无害，与 5.5.3~5.5.6 历次结论一致；
- 其余 8 渠道无更新；检测渠道维持 11。

### ② Mod 列表名称显示修复（长度统一）

- `07a-shell.js` `.mce-card-name`：`flex:1 1 auto;min-width:0;white-space:normal;line-height:1.4;word-break:break-word`（去掉 `nowrap+ellipsis`），`.mce-card-top` 加 `gap:8px`——Mod 作弊页所有条目名称区宽度统一占满、徽标固定右对齐，长名称（`枯木逢春 · Deadwood Reblooms 2.5.7`、`Wraith'sReflection 1.3.4（幽灵的倒影）`等）完整显示自动换行，不再截断；角色页/场景页同款卡片同步受益。

### ③ 验证

- 全链 6 步（build→syntax→smoke→回归→E2E→性别集成）全绿 + codegraph sync；打包 verifier 4/4、zip 正斜杠 4/4、SHA 见交付记录；已装进 game 供实测（本次只升版适配，未发布）。

### ④ 全作弊项条件审查（2026-10-29 · 并入本版，未另行升版）

- **审查面**：11 个适配器 376 个作弊项逐项盘点（15 个带联动 sync / 7 个带 if 条件 / 156 个带 note 说明）；15 个 sync 联动块 + 写入执行器机制（`applyCheatSync` 的 ifMissing / if.min / copyMax）+ 场景页/全局页原版键 + note 前置键全部对照 `tools/_modcache` 源码判定链核实；
- **核实通过（无缺漏）**：Cattery 3 项（领养补 catArr/品种枚举 "橘猫" 有效、loveMax 触发链 love≥40、特质判定 pchaveCat+loveMax 双键）；MoreFarm 3 项（雇佣链 5 许可 + 崩溃级 farmerPlantable=[] + still/compost 计时双保险）；deadwood 8 项（dress 状态机 proposal/trialUntil/highest 全命中、gym expires_at 精确防 onDay 重置、神社 feeds/raven.met/Tsukihan.init 前提、金融 opened+debit_card 判定、投资线入口 agreed 唯一门控）；写入执行器父宿主检查（undefined 对象拒绝）与 sync 条件实现正确；场景页原版剧情键自洽无联动需求；
- **修复 1 处真实缺漏**：`cm_zephyr`（冷月港·泽菲尔线）写阶段原本只写 `zephyr.stage`——模组入口（`ColdmoonHarbour/Zephyr.twee:5-6`）判定缺 `harbour.ship` 或 `C.npc.Zephyr.init` 即 exit，写满阶段白写；stage 3 交箱读 `zephyr.fee`（未设显示 0），stage 4 交付段落要求 `scene='zephyrPaid'`。补 sync 联动：写 1+ 自动补 `ship=true` + `npc.Zephyr.init=1`；写 2+ 补默认酬金 `fee=8000/12000`（海盗 rank 1，`ifMissing` 不覆盖谈判价）；写 4 补 `scene='zephyrPaid'`；写 0 重置不联动；
- **设计性选择（note 已明示，不改）**：`cat_rent` 交租标记 `daily.rentingahouse_1`（未设=下月照常交租，语义正确）；`wr_gate` 恋爱闸门与项链阶段（`wr_necklace` 单独可设，note 建议配合）；便利店库存首次进店初始化（父缺失 CE 拒绝并提示）；科学课演示条件（delinquency/衣着为玩家状态，note 明示）；featsBoosts 成就前置（未解锁写 60 无效，note 明示）；
- **新增断言**：21.10b 泽菲尔线 4 项联动（ship/init/fee/scene）+ 写 0 不撤销联动。

## v1.9.19（2026-10-28 · More Farm Upgrade 适配轮 + 三轮自查优化 · 已发布）

**新适配器：More Farm Upgrade（DOL-More-Farm-Upgrade-Mod v1.0.8，Qsx0391）**

### 适配内容（对照 `tools/_modcache/farm108` 官方源码实证）

- **新适配器第 10 个**：`04a-10-morefarm.js`，modId `more-farm-upgrade`，注册进 CHEAT_ADAPTERS；
- **数值 21 项**：
  - 设施 11：耕地机 0-2（2=量子温室可用）/ 播种机 0-2 / 收割机 0-3（3=智能监控稳定高产）/ 施工机械 0-1（缩短建造）/ 温室大棚 0-9（逐块田覆盖）/ 实验室 0-1（花→催情剂）/ 冷藏库 0-1（库存 ×1.25）/ 堆肥 0-1（周产 1 袋肥）/ 农舍 0-1（可雇农夫）/ 坦克 0-1（袭击火力支援）/ 地下室 0-1（性爱机器）——等级由模组 `new_farm_build_day` 竣工写入（`cultivator/seeder/harvester` 用 `++` 逐级升），作弊直写等价"秒建"；
  - 资源 5：诡异花储量 `flowers_stored`（1000/瓶）/ 催情剂药瓶 `phials_stored` / 肥料袋 `fertiliser_stored` / 堆肥周期 `compost_timer` / 蒸馏计时 `farm.still_timer`（实验室 1 天）；
  - 农夫 5：欠薪 `farm.farmer_unpaid` / 耐心 `farm.farmer_patience`（每周一归 0、安抚置 1，boot.json `isnot 1` 触发催薪线——写 1 免催薪）/ 周薪 `farm.farmer_wage` / 耕作技能 `farm.farmer_skill` / 自动售货计时 `farmerSellTimer`；
- **能力 16 项**：温室田 1-9 覆盖（`plots.farm.N.greenhouse`，模组 `is true` 严格布尔→布尔通道）+ 农夫在岗（`farm.farmer` numeric 0/1，辞退写 0 联动补 `farmer_can_hire=true`）+ 可雇许可（`farm.farmer_can_hire`）+ **农夫自动干活许可 5 项**（`farmerCanWater`/`farmerCanTill`/`farmerCanPlant`/`farmerCanHarvest`/`farmerCanSell`——FarmerEvents.js farmerTendingDay/farmerSell 实证：许可缺一即跳过对应动作，**雇佣链联动默认 water/till/plant=true、harvest/sell=false**，PubFarmer.twee:132-137）；
- **联动初始化（自查优化轮补）**：直写建堆肥（compost=1）自动补 `compost_timer=7` + `fertiliser_stored=0`（竣工语义 :324-325；compost 段模组无兜底，每日事件 `--undefined`=NaN 卡死不产肥）；直写建实验室（laboratory=1）自动补 `still_timer=1`（模组有页面级 FarmLaboratory:20 + boot.json patch 兜底，CE 预置 1 双保险立即蒸馏）；**写农夫在岗=1 自动补雇佣链**（water/till/plant=true、harvest/sell=false、sellTimer=7、**farmerPlantable=[]**——第三轮核查实证：`getPlantableList()` 对 `V.farmerPlantable.forEach` 无条件执行（FarmerEvents.js:153），undefined 时每日 farmerTendingDay 一运行即 TypeError 崩，此键为崩溃级必需）；均 `ifMissing` 不覆盖已有进度、`if.min:1` 门控保证拆除/辞退（写 0）不误补；
- **隔离纪律**：不声明原版既有键（`farm.build` 施工中 / `farm.stock` 原版库存 / `plots.farm` 原版田本体）；瞬态战斗/收割标记（`$isInTank` / `$more_by_harvester`）不作弊；`farmersProduce` 农贸对象结构复杂不作弊直接写；
- **检测渠道接入**：`check_mod_updates.js` 渠道 10→**11**（+ `more-farm-upgrade`：Qsx0391/DOL-More-Farm-Upgrade-Mod，gameGlob `MoreFarmUpgrade*.zip`），每日检测自动覆盖；
- **对照源码**：`tools/_modcache/farm108`（v1.0.8，codeload zip 31 条目：3 js + 16 twee + boot.json + 图 + README/LICENSE）；`_dl_farm.py` 保留作可复现下载，`_probe_farm.py` 一次性探查已随本轮弃用；
- **核对结论**：audit 22/31 字面 KEEP + 9 条 greenhouse 误报 REMOVE（`$plots.farm[$farm.field_greenhouse-1].greenhouse` 动态下标盲区，同 featsBoosts 先例）→ **31/31 全存活 KEEP，零删失**；自查优化轮补 `farmer_patience`（FarmFarmer.twee:316/NewFarmEvents.js:9/boot.json:54 三处实证）+ **5 许可键（farmerCanWater/Till/Plant/Harvest/Sell，第二轮自查：雇佣链实证，初版漏声明会导致雇农夫不干活）** → **37 条 varPath（数值 21 + 能力 16）**；
- **测试**：test_mce 新增 50.x 章节 16 组断言（探测命中/隔离原版键/数值写读回/下限钳制/温室布尔通道/农夫在岗+辞退联动/资源直写/温室等级联动语义/农夫耐心写回/堆肥联动补周期+防覆盖+拆除门控/实验室联动补计时+防覆盖/雇佣链补许可+防覆盖+辞退门控/许可独立开关）；42.5 适配器数断言改版本无关（9→≥9）；
- **验证**：run_all.ps1 6 步全绿 + codegraph sync；dev.ps1 打包 verifier 4/4、zip 正斜杠、装进 game；已发布（Release v1.9.19，资产 SHA 回读一致，见文末发布记录）。

## v1.9.18（2026-10-28 · 适配轮 + 自查优化 · 已发布）

**四项 UI/测试优化 + 双模组适配更新：枯木逢春 2.5.5 + 归途之书 1.4.4（2026-10-28）**

### ① 作弊面板 CSS 排版 token 化

- 面板唯一 CSS 注入点（`07a-shell.js` 的 `injectCSS`）全部颜色/字号/圆角/间距改为 `var(--mce-*)`，`:root` 定义块含完整 71 个 token（含 `--mce-fs-*`、`--mce-radius-*`、`--mce-space*`）；多义色逐处拆分（`#111`→前景/卡片底色、`#333`→边框/悬停底、`#0f0f0f`→区块底、`#150b0b`→红框、`#ffb0b0`→红柔色）；54 个字面量色全部位于 `:root` 定义内（脚本实证 0 残留正文）；**自查修复**：`.mce-header` 高度 `42px` 字面量漏网 → `var(--mce-h-header)`（smoke_dom 补断言防回归）。

### ② 面板容器自适应（sticky 页头 + 独立滚动）

- `#mce-root` 加 `max-height:calc(100vh - 16px)`（防御 DoL-Game-UI 滚动截断历史坑）；`.mce-header,.mce-tabs{flex:none}` 固定页头；注入统一样式滚动条；smoke_dom 新增 8 条断言全 PASS。

### ③ 适配器盲区收口（audit 29 条 + td_watch 定案）

- **deadwood**：audit 重跑报 29 条"声明缺失" → resolve_missing 定案 **120 KEEP / 15 REVIEW / 1 REMOVE**；REVIEW 15 条实证复核：board/ascension/raven.met/treasure.coins/museumCoins/crewCoins/Tsukihan.dom/Tsukihan.init 8 条命中 KEEP、featsBoosts 6 条动态键既定案 KEEP（严禁 REMOVE）、**`Psyche.fear` 零命中 → 移除**（2.5.4 心智系统无 fear 字段，源码实证 `Psyche.ts` 仅 sanity/dread/fascination/mood；恐惧语义由 `Psyche.mood` 负数承担）；`RobinExpansion.investment.agreed` 的 REMOVE 判定经实证证伪（`Finance\Adrian.twee:285` `$RobinExpansion?.investment.agreed` 可选链写法真实存在）→ **保留**。净改动：**移除 1 键（ps_fear）**。
- **revelation**：57 键 resolve 全 KEEP + REVIEW 仅 `TempleDuties.watch.phase`（td_watch）→ **定案移除**：1.4.3 对照源码零证据（TempleDuties twee/ts 均无 watch 字段；`phase` 15 处全在 RobinTemple 模块、`watch` 16 处全在 LostLamb），1.4.3 守夜线已重构为 `RobinTemple.vigil_*`（vigil_result/vigil_attending/vigil_with_robin 已有作弊项覆盖）。净改动：**移除 1 键（td_watch）**。
- 测试同步：test_mce 19.1 阶段 17→16、31.1/31.5/31.8 守夜相关断言移除、21.11 fear 断言移除。

### ④ 测试 mock 盲区闭环（核查结论）

- 43.x 节已实现"显式调用被包装函数"真实链路：43.1 独立 eval 注册 hook（window 含真实原版函数）、43.2 播放结束清理 + 原版函数调用计数验证、43.3 手动重放不越权——`window.unfreezePlayerStats` 真实行为已被测试覆盖；11.x 节的 wikifier 记录 mock 仅覆盖"回退触发原版调用"契约，二者互补。**无需新增测试**，盲区已闭环。

### ⑤ 适配轮：枯木 2.5.5 + 归途 1.4.4（2026-10-28 每日检测定时任务）

- **检测**：deadwood-reblooms v2.5.5、revelation-the-book-of-return v1.4.4 有更新；框架 5.5.6（declOverride）及其余渠道（DomRobin/MLI/SmartPhone/DolOpt/Wraith/DoLSims/Cattery）全部无更新。
- **核对（audit + resolve_missing）**：
  - 枯木 2.5.5：140 条声明中 30 条非动态键"缺失" → 定案 **118 KEEP / 14 REVIEW / 1 REMOVE（证伪保留）**；`Transport.repair_tools.motor → SydneyExpansion` 疑似改名经源码证伪（`transport.state.repair_tools.motor` 别名访问存活于 `Transport.ts:49` + TravelEvents/Repairs 多处）→ **零真删失、零新功能键**。
  - 归途 1.4.4：56 条声明 **100% 存活（0 缺失）**；新增候选 177 条以瞬态调度变量为主，仅补 1 条高价值核心键。
- **改动**：deadwood `modName` 2.5.4→2.5.5（仅版本号）；revelation `modName` 1.4.3→1.4.4 + **新增 `td_ordination_stage`（神殿值勤·授职阶段，1.4.4 晋铎线核心，13 档 prepare→…→aftercare→withdrawn/complete，源码实证含善后期；complete 置末保证"跳最高"落完成而非退出）**（56→**57 键**）。
- **测试**：19.1 阶段 16→17；新增 19.5b 断言（写入生效 / 非法值拒绝 / 善后期 aftercare 合法写入 / 跳最高落 complete / 回退初始，含宿主未初始化拒绝语义模拟）。

### ⑥ 自查优化：授职阶段值域补档（aftercare 善后）

- **发现 bug**：`td_ordination_stage` 初版值域 12 档漏 `aftercare`（善后）——`Ordination.twee:49` 的 `stage isnot 'aftercare'` 善后期特判实证该档存在，漏档后果：玩家在善后期无法经作弊器推进（枚举校验拒绝）。
- **修复**：值域 12 档→**13 档**（补 `aftercare`；`complete` 置末保证"跳最高"落完成授职而非 `withdrawn` 退出），零通用函数改动；测试 19.5b 增强 2 条（善后期合法写入 + 跳最高落 complete 防回归）；AGENTS.md/CHANGELOG 档数表述同步。

### 验证与发布

- **验证**：run_all.ps1 6 步全绿（build → node --check → DOM 冒烟 → 全量回归 → E2E → 性别集成 24/24）+ codegraph sync；dev.ps1 打包 verifier 4/4、zip 正斜杠 4/4（boot.json / javascript/maplebirchce.js / README.md / twee/maplebirchce-widget.twee）。
- **产物**：打包 SHA256 `417D900CA7EBBF30A4BCAFB91F90BC9963A7890529BC4CA03467557B51AC0C22`（208322 B），已装 game；已发布（Release v1.9.18，资产 SHA 回读一致）。

## v1.9.17（2026-10-28 · 适配轮 · 已发布）

**双模组适配更新：枯木逢春 2.5.4 + Cattery 1.1.9（2026-10-28）**

### 适配器更新

- **枯木逢春 2.5.3 → 2.5.4**：新增 **成就加成系统（featsBoosts）** 作弊项 6 个——意志力/体格/美貌/暴露癖/变态癖/淫荡（`featsBoosts.upgrades.deadwood-<attr>`，0-60，写满即购买对应 VanillaPlus 特质，前置=对应成就已解锁）；2.5.4 源码新增 `boosts.json` + `Boosts.twee` 两文件、26 文件变更，V 路径零删失（135 对账完成：此前 133 为口径差，135 为实际声明数）；
- **Cattery 1.1.8.2 → 1.1.9**：官方为纯 5 处 bug 修复（图标破图/动作图标/无效地点 pchouse/枯木罗宾拓展冲突致租房入口消失/猫咖日记条目被吞），**无新功能键**，适配器仅版本号同步；47 条声明在 1.1.9 源码 0 缺失；
- **键存活核对**：枯木 audit 99/135（73%，TS 动态键盲区，resolve_missing 按规则保留）；Cattery 47/47（100%）。

### 验证

- 全链 6 步全绿（build → syntax → smoke → 回归 → E2E → 性别集成 24/24）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；
- 打包 SHA 见交付说明；game 内旧模组包已替换为官方 2.5.4 / 1.1.9 版。

## v1.9.16（2026-10-28 · 已发布）

**双模组适配更新：枯木逢春 2.5.3 + 归途之书 1.4.3（2026-10-28）**

### 适配器更新

- **枯木逢春 2.5.2 → 2.5.3**：新增 **科学课系统** 作弊项——`scienceprogression`（0-4 档，控制科学课演示事件阶段，配合 delinquency 触发）；新增 **心智系统核心值** `Psyche.mood`（-1000~1000，负数=入迷/正数=恐惧，|值|>200 进极端态）；新增 `script/DeadwoodReblooms/Science.ts` + `twee/Science.twee` 两文件（84 文件变更）；
- **归途之书 1.4.2 → 1.4.3**：小修复版（29 文件内容变更、无新增/删除文件、无新增作弊键），适配器版本号同步；
- **键存活核对**：枯木 audit 97/133（73%，TS 动态键盲区），resolve_missing 汇总 122 KEEP + 9 REVIEW（按规则一律保留）；唯一 REMOVE 判定 `RobinExpansion.investment.agreed` 经人工复核证伪（源码 `Finance\Adrian.twee:285` 为 `$RobinExpansion?.investment.agreed` 可选链写法，静态正则盲区误报）→ **保留声明**；归途 audit 55/57（96%），KEEP 全量 + REVIEW `TempleDuties.watch.phase`（保留）。

### 验证

- 全链 6 步全绿（build → syntax → smoke → 回归 → E2E → 性别集成）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；
- 打包 SHA 见交付说明；game 内旧模组包已替换为官方 2.5.3 / 1.4.3 版。

## v1.9.15（2026-10-28 · 已发布）

**数值固定（Lock Values）+ UI 动效六项全量发布（2026-10-28）**

> 说明：v1.9.14（UI 动效）当时未发布，内容并入本版一并发布。

### 数值固定（新增，全局页新区块）

- **8 个预设推荐行** + 自由添加任意 varPath：锁定 / 更新目标 / 取消三态，输入框回车即提交；
- **写回机制**：锁定后每 1 秒强制写回目标值 + 锁定/更新时**立即生效**（不等 tick）；锁定表存存档 `V.mbCE_lock`，**读档自动恢复**；
- **安全边界（深层自查）**：当前值不存在时不凭空创建字段（不污染未触发的转化/未开的键）；路径空段（`a..b`）拒绝；定时器**惰性**——有锁定向才启动，无锁定向零空转（防 jsdom 测试进程挂起）；
- **预设实证键**：渡鸦 `maplebirch.transformation.raven.build`（未戴羽毛项链每日衰减）/ 马 build / 鲸 build / 亡灵 `undead.level`（锁 0 解除亡灵诅咒）/ 天使 `angel`（无三位一体成长点减少）/ 堕天使 `fallenangel`（每日纯洁流失）/ 恶魔 `demon` / 纯洁 `purity`（内部 0-2000）。

### UI 动效（v1.9.14 内容并入）

- **按压反馈**：全部按钮 `:active` 缩放 `scale(.96)`（悬浮球 `.94`）+ 12ms 过渡；
- **悬停微动效**：金色按钮上浮 + 阴影；红色按钮变亮；悬浮球 hover/拖动态高亮；
- **写入成功闪烁**：Mod 作弊 / 快捷面板 / 地点档位（−1/+1/拉满/回退）操作成功 → 目标行金底 `mce-flash` 0.6s（`mbCEFlash/mbCEFlashRow/mbCEFlashAfterRender` + 单一 timer 清理，连点不堆积；**失败不闪**——地点页 flash 失败分支修复）；
- **折叠组展开淡入**：`[data-collapsed="0"]` 0.2s `mce-fade-in`（覆盖全部折叠组）；
- **面板开合动画**：打开 pop-in 0.15s / 关闭淡出 0.12s 再隐藏（`mceCloseTimer` 复位防竞态）；
- 动画只用 `transform/opacity/background/box-shadow`，不碰布局属性。

### 测试与验证

- 三层断言全过：DOM 冒烟数值固定 3 条 + 回归 44.9 十二条（锁定/更新/取消/非法拒绝/不存在键不创建/空段拒绝/立即写回）+ E2E L 区块 9 条（真实点击链路）；
- 全链 6 步全绿（build → syntax → smoke → 回归 → E2E → 性别集成 24/24）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；
- **已发布**：Release v1.9.15（id 425752035，tag v1.9.15，url https://github.com/TXF182/MapleBirchCE/releases/tag/v1.9.15），资产 MapleBirchCE.mod.zip 206027 B；API 回读 SHA `B6CB5CA3E60F0AA44633E618614E032204AC00C0EA1C71578E7AEA9086F13D90` 与本地一致（SIZE_MATCH=1 / SHA_MATCH=1）；远端 main 已推送（commit 8a71afd8）；game 内已装同 SHA 包。

## v1.9.14（2026-10-27 · 随 v1.9.15 发布）

**UI 动效六项：按钮按压/悬停反馈 + 写入成功闪烁 + 折叠组展开淡入 + 面板开合动画（2026-10-27）**

### UI 动效

- **按压反馈**：面板内全部按钮统一 `:active` 按压缩放 `scale(.96)`（悬浮球 `scale(.94)`）+ 12ms 过渡——Mod 作弊/阶段/场景/剧情/全局/快捷面板/特质页全部按钮手感统一；
- **悬停微动效**（桌面端）：金色按钮 hover 上浮 `translateY(-1px)` + 阴影，按压时覆盖为缩放（`.mce-gold:active` 后置同特异性覆盖）；红色按钮 hover 变亮；悬浮球 hover/拖动态高亮；
- **写入成功闪烁**：Mod 作弊页（actCheat）与快捷面板（actPlayer）局部刷新行 + 地点档位（−1/+1/拉满/回退）重渲染后，目标行金底 `mce-flash` 0.6s 闪烁——新增 `mbCEFlash/mbCEFlashRow/mbCEFlashAfterRender` 三工具 + 单一 timer 统一清理（连点不堆积；强制 reflow 保证同一节点动画重放）；
- **折叠组展开淡入**：一条 CSS 规则覆盖全部折叠组（Mod 作弊/特质/角色/剧情页）——`[data-collapsed="0"]` 展开时 `mce-fade-in` 0.2s（display:none→block 切换自动重放，含初始展开组）；
- **面板开合动画**：打开 `mce-pop-in` 缩放淡入 0.15s；关闭先播 0.12s 淡出（`mce-closing` class）再 `display:none`——`mceCloseTimer` 复位防残留，open() 先清定时器防关闭动画竞态；
- **悬浮球**：加过渡 + 按压缩放；拖动中 `transform:none!important`（拖动不缩放）。

### 性能与兼容约束

- 动画只用 `transform/opacity/background/box-shadow`，不碰布局属性（防 DoL-Game-UI 式每帧 rAF 扫描叠加压力）；
- 不动 data-mce-key / 按钮文案 / DOM 结构，测试断言全兼容。

### 测试与验证

- DOM 冒烟补 CSS 效果断言（`.mce-btn:active` 缩放 / transition / `@keyframes` pop-in・pop-out・fade-in・flash / `.mce-flash` 规则存在）；
- E2E 补：Mod 作弊页数值应用 → 目标行含 `mce-flash` class；地点页 `+1` → 行闪烁；
- 全链 6 步全绿（build → syntax → DOM 冒烟 → 回归 → E2E → 性别集成）+ codegraph sync；zip 正斜杠 4/4、verifier 4/4；SHA256 见资产核对。

## v1.9.13（2026-10-27 · 已发布）

**8 项功能扩充 + 四轮自查优化 + Mod 作弊页排版优化（2026-10-27）**

### 功能扩充

- **全局页时间调节**：当前时间/日期显示 + 前进 1 小时/6 小时/1 天 + 跳转指定时刻（`mcTimeNow/mcTimeAdvance/mcTimeJump`，只用 `Time.set/setTime` 改游戏时钟，**绝不触碰 `V.timer` 行动点**）；
- **快捷面板补负面属性组**：紧张/创伤/痛苦/兴奋/疲劳/焦虑/违规/迷幻/醉酒 9 键（原版根键非黑名单，直写）；
- **Mod 自定义数值搜索框**：按名称/键名/写入路径实时过滤（`mce-search-inp` 独立 class，250ms 防抖重建，命中 `cheatValueMatches` 子串判定，搜索态强制展开）；
- **预设模板**：「全属性拉满」「经典开局」一键应用（快捷面板）；
- **场景直达补充 6 地点**：精神病院 Asylum / 警局牢房 Police Cell / 码头 Docks / 湖畔 Lake Stroll / 狼群领地 Wolf Pack / 医院前门 Hospital front（**入口段落名均对照本体 HTML 实证**，`Wolf Pack` pid=208 确认存在；地点页合计 14 组）；
- **04a 适配器按模组拆分**：`04a-modcheat-adapters.js` 拆为 `04a-00-core.js`（注册表容器）+ 01-09 九个模组块文件；行级等价性 `old 821 lines merged 821 identical: true`；工具脚本（check_mod_updates/audit_adapters/resolve_missing/_check_keys_mod/scan_mod_vars）统一改 src 目录扫描（`^04a-.*\.js$` sort 拼接，与 build 同序）；
- **翻译表收敛**：ZH_KEYS 单源（190 键无重复）+ PANEL 全部 49 处 label 动态化 `zhKey(path)` + 补负面/名声/器械键 + 断言 49.9。

### 自查优化（四轮）

- **第一轮 · 工具旧路径修复**：`_check_keys_mod.js`/`scan_mod_vars.js` 仍引用已删 `04a-modcheat-adapters.js` 的旧路径 → 改 src 目录扫描；实跑验证枯木 133 varPath 提取正常；
- **第二轮 · 翻译统一 + E2E 补盲**：`analSkill` 旧值"肛部技巧"→"后庭"（与 `analskill` 同值）；E2E 补 N 区块 5 断言（搜索框存在/不污染 `input.mce-inp`/过滤 2 行/清空恢复）；
- **第三轮 · 文档与稳定性**：README 补「地点页」小节（14 组 + 段落实证）与搜索框说明；build 稳定性验证（连续两次 SHA 一致）；SHA 差异定位为 pack.ps1 将 README 打进 zip（文档同步所致，预期）；
- **第四轮 · 无新缺陷确认**：时间函数只用 `Time` 不碰 `V.timer`、预设执行器组归属注释自警、搜索防抖 `mceSchedule` 定义在位、场景 6 新组 match/main 实证正确、04a 容器与 9 块注册表顺序正确；src 单文件语法检查 2 个 FAIL 均为设计使然——00-preamble 空壳占位、09-exports 跨文件 IIFE 片段，构建产物整体 `node --check` PASS。

### Mod 作弊页排版优化

- 能力行/数值行/list 行 label 去掉冗余 `（varPath）`：写入路径保留在「说明」折叠与悬停 title，行变短不挤压按钮区；
- 阶段下拉 select 限宽 `max-width:170px`：长枚举配合 flex-wrap 自动换行；
- 不碰 data-mce-key / 按钮文案 / input 类名，测试断言全兼容。

### 测试与验证

- 全链 6 步全绿（build→syntax→冒烟→回归→E2E 含 N/W 区块→性别集成 24/24）+ verifier 4/4 + zip 正斜杠 4/4 + codegraph sync 完成；
- 产物装入 game：200430 B，SHA `8BD6B306B294E01282E76552F233F5C3E8B26AB65428D881158AC34000491BC0`；
- **已发布**：Release v1.9.13（id 425609877，tag v1.9.13，url https://github.com/TXF182/MapleBirchCE/releases/tag/v1.9.13），资产 MapleBirchCE.mod.zip 200430 B；GitHub asset digest `sha256:8bd6b306…491bc0` 与本地 SHA 一致，下载回读 SHA 逐字节比对 MATCH=True。

## v1.9.12（2026-10-26 · 已发布）

**全局页新增「世界腐化（原版 World Corruption）」数值调整 + 自查优化（2026-10-26）**

### 功能

- **新增原版世界腐化数值调整区（全局页末尾，庄园自动维护之后）**：
  - **世界硬腐化 `world_corruption_hard`**：罪孽/净化计数，原版新档初始 2；原版宏 `worldCorruption("hard", n)` 硬钳 **[-30, 30]**（宏注释"Unclamp or adjust upper limit once world corruption effects are added"）；
  - **世界软腐化 `world_corruption_soft`**：世界异变程度，原版新档初始 0；原版宏硬钳 **[0, 100]**，≥30 增加怨灵聚合几率、≥70 触发校园衣物记忆；soft 负写入原版还会累计净化总量 `world_corruption_reduced`（CE 直写不经过宏不自动记账，UI hint 已注明为展示统计键）；
  - **写入通道**：复用地点页 `placeStageWrite/placeStageUndo`（绕过原版根键黑名单直写顶层键，留痕 `place:world_corruption_hard/soft`，before 保留首次写入前状态可回退删字段）；**上限不钳制**（传 max=Infinity，直填多少就是多少，对齐用户"上限是多少就是多少"口径；原版宏只在事件触发时 clamp 不钳存量）、**下限按原版语义保留**（hard min=-30 / soft min=0，防负值破坏）；
  - **UI**：两行各自 当前值 + 数值输入框（type=number 支持负值域）+ 应用 + 回退；应用/回退**局部刷新行内值，不重建整页不丢滚动**；已有写入留痕时初始即显示回退；回退按钮 title 标注"还原到首次写入前状态"；
  - **自查优化**：渲染读取 getV() 缓存一次（forEach 前取 `Vg`，不再逐行调两次）；回退按钮复用 `makeWcUndo` 工厂（应用与初始留痕两处共用，无重复代码）；
### 测试与验证（用户显式验收）

- **自行测试（用户显式验收）**：回归新增 §48 共 15 条（48.0 前置初始 2/0 → 48.1 直写绕过黑名单 + 留痕 → 48.2/48.3 上限不钳制 hard=50 / soft=150 原样 → 48.4 下限钳制 hard=-40→-30 / soft=-5→0 → 48.5 既有值回退还原 + 清留痕 → 48.6 无字段写入后回退删字段）；功能级 E2E 新增 W 区块共 11 条（区块渲染 → 两行 data-wckey → 输入框+应用按钮 → 初始无留痕不显示回退 → 应用 hard=50 写入+留痕+回退按钮出现 → 回退还原原值 2+清留痕 → 软腐化填 -5 钳 0）；DOM 冒烟补全局页世界腐化区断言（区块 + 初始值回显 2/0）；
### 升版与发布

- 升版 1.9.12 双源完成（src/01-core.js MCE_VERSION 与 boot.json version）；README/CHANGELOG 同步；全链 6 步全绿（build→syntax→冒烟→回归含 48.x→E2E 含 W→性别集成 24/24）+ codegraph sync；打包 verifier 4/4、zip 正斜杠 4/4 + 装入 game；**已发布**（Release v1.9.12 id 424375718，tag v1.9.12，资产 MapleBirchCE.mod.zip 190901 B，SHA256 `DA043171…AB5E0`，GitHub 资产 digest 回读一致）。

## v1.9.11（2026-10-26 · 已发布）

**悬浮球可拖动 + 全局页固定入口 + 自查优化（今晚改动归版 v1.9.11）**

### 功能

- **右下角金色「解锁」悬浮球改可拖动**：pointer 拖拽全链（pointerdown/move/up/cancel），3px 阈值区分「点击开关」与「拖动挪位」，拖动后吞掉本次 click 防误触；位置 clamp 在视口内（按按钮实际尺寸减 4px 边距，不再硬编码 64）；**rAF 节流**写入 style（拖动不再逐事件直写主线程）；位置持久化 `mbCE_toggle_pos_v1`、**拖动锁持久化 `mbCE_toggle_lock_v1`**；CSS 加 `touch-action/user-select` 防拖动误选文本，拖动态 `mce-dragging` 类显示 grabbing 光标；
- **全局页（global）顶部新增固定按钮「面板悬浮入口」**：按当前锁定态切换「锁定悬浮球拖动/解锁悬浮球拖动」，点击写 `mbCE_toggle_lock_v1` 并即时重渲染——**锁定后悬浮球固定不动（不再误拖/挡操作），点击悬浮球本身仍可正常开关面板**；悬浮球是面板唯一入口，**废除「隐藏」功能（隐藏即死锁，无法再进面板）**——自动清理旧 `mbCE_toggle_hidden_v1` 键并强制恢复显示；锁定/解锁时悬浮球 title 同步提示；
### 健壮性

- **健壮性**：`ensureDom` 对已存在 `#mce-toggle` 复用（ModLoader 重载不产生第二个按钮）+ **`__mbCEBound` 绑定守卫**（复用同一按钮时跳过重复 addEventListener，防 click 监听堆叠导致一次点击多次开关面板）；`isConnected` 判空后才 append；位置恢复 JSON 解析容错；
### 自查优化

- **自查优化**：拖拽 rAF 节流（pointermove 不再逐事件直写 style，主线程更顺滑）；限位改按按钮实际渲染尺寸（不再硬编码 64px，任何尺寸/缩放下不出界）；拖动态 `mce-dragging` 光标（grabbing + 高亮）；
### 升版与发布

- **升版 1.9.11 双源完成**（src/01-core.js MCE_VERSION 与 boot.json version）；README/CHANGELOG 同步；全链 6 步全绿 + codegraph sync；打包 verifier 4/4 + 装入 game；已发布（Release v1.9.11，资产 SHA 见核对）。

## v1.9.10（2026-10-26 · 已发布）

**猫舍 Cattery 兼容适配（第 9 个适配器）+ 枯木逢春 2.5.1 / 归途之书 1.4.1 适配（2026-10-26）**

**Cattery 猫舍 v1.1.8.2 兼容适配（第 9 个适配器）**

- **新增「猫舍 Cattery」适配器**（repo `Maomaoi/Degrees-of-Lewdity-Cattery`，对照源码 `tools/_modcache/cat1182`，40 文件无根对象、全顶层标量）：**9 阶段 + 39 数值、全数字通道**（模组全部 `is 1`/`gte 1` 严格比较判定，禁 boolean）；探测 `window.createCafePC`（函数）或 V 顶层键兜底（cattery_time/pcfood_cake/rentingahouse/pchaveCat）；
- **出租屋线**：`rentingahouse` 阶段键（每月 1 日交租、养宠减清洁，源码 home1.twee 实证）；
- **养猫线**：`pchaveCat` 领养键 + **sync 联动**（写 1 自动补 `firstCat_variety="橘猫"` + `catArr=[{name:"咪咪",love:0,play:0}]`，防模组 `catArr[0]` 读取崩溃）；`cat_love`/`cat_play` = `catArr.0.love`/`catArr.0.play`（0-40，未领养时父级缺失拒绝写入防崩）；12 种品种键；
- **菜品/食材**：11 个菜品计数键（地三鲜/酸辣土豆丝/茄香鸡柳/青椒肉丝/奶香茄子煲/椒盐土豆/白菜炖鸡脯/土豆炒肉片/宫保鸡丁/清炒白菜/自创，0-99）+ 13 个食材键（pc_food/pcfood_cake/pc_cabbages/pc_aubergine/pc_potato/pc_green_pepper/pc_fillet/pc_chicken_breast/pc_Sichuan_pepper/pc_cream/pc_cake_flour/pc_cocoa_powder/pc_milk）；
- **飞行/花园/书房/清洁**：`birdFly` 飞行解锁 + 训练 `pcfly` 0-6 + 目的地 `flycattery`；`pcGardenupgrade` 花园 0/1；`pcHouseBook1-5` 书房藏书 0/1；`pcHome_clean` 清洁 0-40（源码 clamp 锁死上限）；`pcEntranceFront_clean`/`pcEntranceAfter_clean` 0-3；`pchouse_drawing` 0-100；
- **测试同步**：新增 §47 测试（探测命中 → 租屋/养猫阶段写入 → sync 联动补 catArr/品种 → 写 0 不联动 → 好感/玩力写入与 40 上限钳制 → 飞行/书房数字语义 → 食材/菜品写入与 99 钳制 → catArr 缺失拒绝防崩 → 回退 → 卸载后探测消失）；E2E 适配器断言 8→9（mock 补 cattery_time/pcfood_cake 探测根 + 关键词补 Cattery）；42.5 审计断言 8→9。

**枯木逢春 2.5.1 / 归途之书 1.4.1 适配（每日更新检测检出）**

- **枯木逢春 `2.5.0 → 2.5.1`**（对照 `tools/_modcache/dw251` 源码工程）：文件级 diff 仅 7 个文件变更（StreetLife.ts 读取方式重构、Intimacy/PropertyLife 互动细节补 Robin trauma/Kylar rage/Whitney dom 结算、School/OrphanDoctor/Stories 文案与 capture 修复）——**零 varPath 变更**，仅升声明版本；audit 35 条"缺失"经 resolve_missing 定案 KEEP（含 investment.agreed——`$RobinExpansion?.investment.agreed` 可选链访问致静态扫描盲区，Adrian.twee 实证存活，不删）+ REVIEW 8 条全保留（raven.met/Tsukihan dom·init/treasure 三键/Finance.company 两键，动态键形态，复核保留）；**REMOVE 0 条**；
- **归途之书 `v1.4.0 → v1.4.1`**（对照 `tools/_modcache/rv141` 源码工程）：覆盖 55/57、resolve KEEP 55 + REVIEW 1（TempleDuties.watch.phase）——**零 varPath 变更**，仅升声明版本；
- **更新检测渠道扩容**：`tools/check_mod_updates.js` 渠道表新增第 10 渠道 `cattery`（repo `Maomaoi/Degrees-of-Lewdity-Cattery`，pickAsset 补裸 `.zip` 资产兜底——该模组只发 `.zip` 不认 `.modpack`/`.mod.zip`）；
- 升版 1.9.10 双源完成（src/01-core.js MCE_VERSION 与 boot.json version）；全链 6 步全绿 + codegraph sync；打包 + 装入 game。

**庄园维护全自动改造 + v1.9.10 核查优化（2026-10-26 追加，并入 v1.9.10）**

- **庄园维护修复与全自动改造**（AutoClean 0.1.5 对照 + 原版 64.6MB 实证）：神殿技能判断路径修复——旧判 `V.skill.*`（原版 0 处，恒 false 根因），改为顶层 `V.housekeeping/V.tending`（0-1000，`earnFeat("Majordomo")` 判 `housekeeping>=1000`）；农场/补给/打扫对齐 AutoClean 实证语义（`farm_stock_init` stock 键 truffles/eggs/milk/cream vs 原版食物键、`temple_quarters/garden` 入 0/每日-10/clamp 0-100、`$soap/$salve` Twee 顶层消耗键、`avery_mansion` 十房间全 `to 0`）；6 键 UI 改**自动开关**（自动维护/自动投喂），**每日全自动调度器**（`mcAutoState/mcAutoSave` localStorage `mbCE_auto` + `Time.days` 日锚，不写 V 不污染存档、新档不继承；`07f-pins` passage 钩子 try/catch 调用）；投喂修复 2 处：`avery_food_select` 移出"最高难度菜谱"分支、喂食后无条件刷新（艾弗里不再永远吃同一种菜），开启当日 `lastDay=当日` 去重（按钮开启已即时执行一次，防投喂双扣食材）；维护键实证核查（`$soap/$salve` 伊甸小屋消耗、`V.eden_soap/eden_salve` 仅只读映射、`cream` 原版 479 处无食物键、`avery_food_select` widget 存在、`Time.days` 开档总天数）；
- **Cattery 适配器核查优化**（对照 cat1182 源码逐键实证）：45 键全部存活（catArr {name,love,play} 结构与 `setup.firstCat` 一致、love/play `Math.clamp(0,40)`、pcHome_clean 顶层宿主 30/35/40、门口/后院 clamp 0-3、绘画 0-100、藏书 1-5、cookok 系列、birdFly/flycattery 73 处地点编号）；**修复真实缺陷**：模组「金牌饲养员」特质触发链 = love≥40 且 `firstCat_loveMax≠1` 时置 loveMax=1（Cathave_speciality widget 实证），CE 此前只写 love 不写 loveMax → 特质永不出现——`cat_love` 加 sync 联动（写 ≥40 自动补 `firstCat_loveMax=1`，写低值不撤销，对齐模组"仅电脑降级归 0"）；note 修正（cat_rent 清洁度 35→30/35/40 实证）；测试补 47.5b 两条联动断言；
- **Cattery 本体包就位 + 对照源码清理**：`game\Cattery-1.1.8.2-fixed-jumping_rope-icons.zip` 缺 `.mod` 后缀不会被 ModLoader 扫描 → 改名 `Cattery.mod.zip`（893,790 B，createCafePC/birdFly/flycattery 符号实证）；`tools\_modcache` 删旧对照 dw250/rv140/deadwood-2.4.7/revelation-1.3.13（只保留当前 dw251/rv141/fw556/mli0180/opt1121/sp0391/wr134/cat1182）；tools 未跟踪残留清零（_deadwood_probe/_revelation_src/_tmp_v199_* 共 13 项）；git 未跟踪归零；
- **发布前核验**：全链 6 步全绿（build → syntax → DOM 冒烟 → 回归含 47.5b → E2E 9 适配器 → 性别集成）+ codegraph sync；打包 verifier 4/4、zip 正斜杠 4/4；SHA256 见资产核对。

## v1.9.9（2026-10-26 · 已发布）

**枯木逢春 2.5.0 说明页内容补全作弊项 + 月羽译名更正（2026-10-26）**

### 功能

- **心智系统**：新增 `Psyche.sanity`（理智，-500~1000 初始 1000）与 `Psyche.fear`（恐惧，0~1000 初始 0）两个数值键——8 档状态（混乱/迷乱/心乱/恍惚/动摇/安定/清醒/专注）与学习收益（60%~120%）由理智自动结算（源码 `src/module/Psyche.ts` 实证）；
- **PC 动物转化**：新增马/鲸/渡鸦三个转化点数键（`maplebirch.transformation.horse/whale/raven.build`，0-100）——各六阶段、进度在角色属性页、外观在镜子里选择，build≥1 停止衰减（隐藏部位不失去能力）；
- **黯羽神社线**：新增 `MoreTransformations.shrine.stage` 阶段键（0 未开始 / 1 已收信 / 2 已获指路与鸦羽项链 / 3 已到访认识月羽）与喂鸦次数键（`shrine.feeds`）；**sync 联动（v1.9.9 扩展 sync.set 支持条件 `if`）**：写 1+ 自动补喂鸦 3 次 + 已遇见渡鸦 `raven.met=true`（模组收信前置=feeds≥3 且 raven.met，源码 `DarkfeatherShrine/Entry.twee` 实证），写 3 自动补月羽已认识 `init=1`；喂鸦次数键写 1+ 同样自动补已遇见（模组喂鸦前提）；写 0 重置不联动；
- **月羽（Tsukihan）**：新增好感/任性/欲望数值键 + 已认识（init）数值键 + 恋人列表键（`loveInterestList`，list 型追加/移除 Tsukihan）——小屋门禁=神社线完成（stage 3）+已认识（init=1）+NPC 活跃（源码 `DarkfeatherShrine/HomeWidgets.twee` 实证），好感档位作用于互动（≥20 聊天/亲密、≥30 受邀文案、≥50 独处）；敲门 07-09/12-13/18-22、同睡/洗澡 20:00-20:30 雨中 18:00、潜入诡术 500/300；
- **果园计数**：新增订单/合同/销售收入/常客到访 4 键（`Orchard.orders_completed/contracts_completed/sales_income/regular_visits`）；
- **译名更正**：`tsukihan` 由「月半」改为「月羽」（枯木 2.5.0 官方中文译名，`src/script/DarkfeatherShrine/Tsukihan.ts` 的 CN 映射实证）；
### 测试与验证

- **测试同步**：21.1 分组断言更新（≥13/≥65/≥55）；40.1 译名断言 月半→月羽；新增 21.11-21.13（新键写入/钳制/sync 条件联动含 raven.met 补全/恋人列表追加移除）；枯木声明 阶段 12→13 / 能力 64→65 / 数值 40→55；
### 升版与发布前自查

- 升版 1.9.9 双源完成（src/01-core.js MCE_VERSION 与 boot.json version）；发布前全面自查：心智/转化/神社/月羽/果园/便利店/遇欲/投资/归途键逐一对照 dw250/opt1121/rv140 源码核验存活与判定，修复神社线阶段联动缺口（raven.met 补全）与 3 处说明文案，测试补 3 条联动断言，全链 6 步全绿 + codegraph sync。

## v1.9.8（2026-10-26 · 未发布）

**枯木逢春 2.5.0 / 归途之书 1.4.0 适配 + 便利店"遇欲"补全 + 面板按钮合并（2026-10-26）**

### 功能

- **模组更新适配**：枯木逢春 `2.4.7 → 2.5.0`（对照 `_modcache/dw250` 替换 dw247，audit 56 键 10 REVIEW 全部核实保留）：投资键重构——`RobinExpansion.investment.share` / `.valuation` 两键已删（2.5.0 移除，删除作弊项），`invested_total/returned_total/dividends_total` 改指新键 `contributed/returned/dividends`（键名改造，同条目换 varPath），新增 `treasury`（店铺周转金，2.5.0 新键）；`r_invest_agreed` 勾选联动由"补 share 10%"改为**联动四门店开启**（shop/shop_flowers/shop_popcorn/shop_balloons，对齐 2.5.0 投资=店铺扩张语义）；枯木 values 41 → 40；
- 归途之书 `v1.3.13 → v1.4.0`（对照 `_modcache/rv140` 替换 rv1313，56 键 55 存活 + 1 动态键零删，仅升声明）；
- **便利店"遇欲"补全（Dol-Optimization）**：全 8 适配器排查确认"遇欲便利店"非独立模组、属 Dol-Optimization；`opt_needmeet` 显示名改"遇欲（Needmeet）· 好感"并富化说明（≥80 解锁恋爱线）；新增 **12 个便利店库存键**（`daily.conveniencestoregoods.中文键`：避孕套/验孕棒/香烟/醒酒药/降火药/能量饮料/洗面奶/洗发水/鸡蛋/番茄/苹果/橙子，0-99），note 注明需存档已进过便利店（`daily.conveniencestoregoods` 初始化）否则写入拒绝；
- **面板按钮合并**：右上角「收起」与「关闭」行为完全一致（均收起面板、由右下角解锁按钮重开），删除「收起」只留「关闭」（用户实测确认无区别）；
### 测试与验证

- **测试同步（5 处断言更新）**：31.1 归途 `/v1.3.\d+/ → /v1.4.\d+/`；32.1 枯木 `/2.4.\d+/ → /2.5.\d+/`；32.7.3 投资联动断言改四门店 + share 保持 0（2.5.0 无此键）；37.2 面板标题断言「收起」→「关闭」；全链 6 步全绿（build → 语法 → DOM 冒烟 → 回归 → E2E 8 适配器 → 性别集成 24/24）+ codegraph sync；
### 升版与对照清理

- **对照源码清理**：`_modcache` 删除 dw247/rv1313 旧对照（被 dw250/rv140 取代）；升版 1.9.8 双源完成（src/01-core.js MCE_VERSION 与 boot.json version）。

## v1.9.7（2026-10-25 · 已发布）

**1.9.6 发布后的全部变更：源码工程化（04/06 拆分）+ 适配器版本声明同步 + 框架 5.5.6 升级 + 对照源码清理（2026-10-25）**

**源码工程化：04/06 大文件拆分 + 验证链完善（2026-10-25 · 发布 1.9.6 后追加）**

- **按主题边界拆分两个超长源码文件**（可维护性整改，产物零变化）：`04-modcheat.js`（869 行）→ `04a-modcheat-adapters.js`（适配器数据 650 行）/ `04b-modcheat-write.js`（写入执行器 157 行）/ `04c-modcheat-util.js`（审计工具 53 行）；`06-traits.js`（994 行）→ `06a-traits-data.js`（254 行）/ `06b-traits-eval.js`（280 行）/ `06c-traits-ui.js`（336 行）/ `06d-traits-gender.js`（124 行）；src 由 17 段增至 22 段；
- **零变化实证**：拼接产物 SHA 与拆分前**字节级一致**（`ce47e3aa7176f0a88684652f7b05b3a06f920e9ddc4e00f89fca772534a87ec3`，444,192 B；首轮切分曾因 PowerShell `-split` 吞空行 `\r` 差 5 字节，改用按行单元整体切分后复算一致）；全链 6 步全绿，重打包 175,377 B SHA=`D719023B4D4DED214BB53F075C91BB64800AC08DA77D6DBA7EF38A0A0FD6664A`（与已发布 v1.9.6 资产内容一致，zip 时间戳不同）；
- **工具链同步**：`audit_adapters.js` / `check_mod_updates.js` / `resolve_missing.js` / `scan_mod_vars.js` / `_check_keys_mod.js` / `_check_char_names.py` 六工具的适配器源码路径全部改指 `04a-modcheat-adapters.js`（自查发现拆分后旧路径引用会挂，已修复并实跑验证）；README 目录树同步 22 段结构；
- **验证链完善**：`tools/run_all.ps1` 步骤编号 `[1/6]-[6/6]` 全程显示、全绿后自动 `codegraph sync -q` 同步图谱（不再手工跑）；`githooks/pre-commit` 文案与验证链同步；UI 非热路径加载后置评估落地（自查工程增量，性能优化细节见会话记录）。

**治理收尾：声明同步 + 框架 5.5.6 升级 + 对照源码清理（2026-10-25 · 发布 1.9.6 后追加）**

- **适配器版本声明同步**：枯木逢春 modName `2.4.6 → 2.4.7`（04a 第 213 行）、归途之书 `v1.3.12 → v1.3.13`（第 10 行）——与已装 game 的官方包对齐；全文件 60+ 处 `2.4.6` 功能引入版本注释未动；更新检测 UPDATES 3 → 1；
- **对照源码同步 + 清理（2026-10-25）**：枯木对照 `dw246(2.4.6) → dw247(2.4.7)`（tarball v2.4.7，604 文件）、归途对照 `rv1312(1.3.12) → rv1313(1.3.13)`（89 文件）；`_check_keys_mod.js` 全量核查：枯木 117 条 varPath、归途 57 条**全部存活**；框架对照 `fw555mod(5.5.5) → fw556(5.5.6)`（release mod.zip + unpacked，inject_early.js 在 `fw556\unpacked\dist\`）；删除被取代的 `fw555mod/dw246/rv1312` 三个旧对照 + dr080/ds0817/DoL-Game-UI-main 历史对照（需用时从渠道重新下载）；DoL-Project 桥接层 README 对照表 / scan.ps1（modIds 映射 + fwapi/vars/keys 默认路径）同步新目录名与 fw556 结构；scan.ps1 语法解析通过；
- **框架 5.5.6 升级（check_framework_api 核对后人工替换）**：下载 `maplebirch-0.5.12.13-v5.5.6.mod.zip`（383,875 B，asset size 校验过）进 `tools\_modcache\fw556`；`check_framework_api.js` 核对 inject_early.js：核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists / define / frameworkNotice），`setup.MapleBirch` / `maplebirch.patch` 缺失与 5.5.3/5.5.4/5.5.5 一致（CE 非依赖，无害）→ 判兼容；`check_mod_updates.js` declOverride `5.5.5 → 5.5.6` + 核对注释更新；README 三处（依赖说明/适配器表/兼容矩阵）同步 5.5.6；game 框架包 `v5.5.0 → v5.5.6` 替换（旧包备份至 `DoL-Project\modpack-backup\`，可回滚）；
- **更新检测复核**：9 渠道全无更新（枯木 2.4.7 / 归途 1.3.13 对齐，框架 5.5.6 对齐，其余 6 适配器无更新）；全链 6 步全绿（build 444,192 B → smoke → 回归 → E2E 8 适配器 → 性别 24/24 → codegraph sync），重打包 176,006 B SHA=`C93157385DD9C76EBC2474F51812F58217E48533D36E5CA95F60657EF3263334` 已装 game；未 git 提交、未发布（该段随后并入 v1.9.7，2026-10-25 发布：commit `dac2bd1`，GitHub Release v1.9.7，资产 176,487 B SHA=`49FC41D7F3E90421913F18250F4310D5C069B149DA5947B24DEC5895BBB1936E`）。

## v1.9.6（2026-10-25 · 已发布）

**枯木逢春 2.4.6 作弊项全补 + 着装审批联动（2026-10-25）**

- **补 20 项作弊**：原版增强六项属性突破特质×7（意志/体能/容貌/暴露/变态/放纵 + 全能 `incorrigible`）→ `VanillaPlus.traits.*`；三位一体前置三接触（温暖/岩石/空无黑暗）→ `divineTransformations.prayer.*`；三位一体本体 → `divineTransformations.trinity`；诡异镜子×6（孤儿院/农场/高塔/神殿/西里斯/凯拉尔）→ `deviancy.mirrors.*`；健身房会员阶段（无/周卡/月卡/年卡/终身）→ `LifeSimulation.gym.membership`；赌场疑心值（0–100，≥60 可疑、≥100 拒服务）→ `LifeSimulation.casino.suspicion`；医务待审标记 → `LifeSimulation.medicine.review.pending`；
- **城镇堕落不加**：原版键 `world_corruption_soft` 已由 DoLSims 分区 `ds_corruption`（世界软腐化）覆盖，同键不重复；
- **新增联动写入机制（applyCheatSync）**：作弊条目可声明 `sync`（clear/set/copyMax 三型），主键写入成功后自动修正伴随键、不留痕、失败不影响主写入。首个用途——**着装规范 dress_active 写强制裸体时自动清待审批 `proposal`、同步最高政策 `highest`（只升不降）、清零试行期 `trialUntil`**，修复用户实测"已强制裸体但公告栏仍显示等待礼顿决定"的状态残留；第二个用途——**健身房会员写档自动给 `expires_at` 十年有效期**（自查发现的实测盲区：模组 `LifeSimulation.ts` onDay 结算 `expires_at<=now` 会把非 lifetime 会员重置为 none，只写 membership 必当天失效）；
- **测试**：test_mce 新增 §32.6（18 键声明收录 / 写入生效 / 着装联动 / 降级语义 / 中间档只升不降 / 会员十年期）；21.1 分组齐全断言版本无关化（阶段≥10/能力≥35/数值≥29）；**升版 1.9.6 双源完成**（src/01-core.js MCE_VERSION 与 boot.json version）；全链 6 步全绿；未 git 提交、未发布。

**枯木逢春 2.4.6 适配器全量自查优化（2026-10-25 追加，并入 v1.9.6）**

- **对照 2.4.6 源码逐模块扫漏，补齐 43 项**：
  - 原版增强 VanillaPlus（+7）：属性锁定×6（意志/体能/容貌/放纵/暴露/变态，`lock.*` 防衰减）+ 驱除已用标记（`divineTransformations.expungeUsed`）；三位一体判定核实为 `trinity===true` 直接生效，无需补 contact 联动；
  - 罗宾 RobinExpansion（+11）：投资线 6 键（`investment.agreed/share/valuation/invested_total/returned_total/dividends_total`，share 为百分比、估值英镑、投入/收回/分红以便士）+ 店铺设施 4 键（`shop_bank_supported/shop_flowers/shop_popcorn/shop_balloons`）+ 房租分担 3 键（`self_rent/both_rent/rent_separated`）；
  - 金融 Finance（+13）：银行开户/借记卡/信用卡（`bank.opened/debit_card/credit_card`）、银行档位阶段（`account_tier`：普通/优选/尊享）、银行余额（便士）、券商开户/现金（便士）、公司办公室/合作协议/董事会/控股/黑乌鸦认可（成就判定键）、已完成订单数、孤儿院双买断（`pc_bought_out/robin_bought_out`）；
  - 交通 Transport（+5）：头盔 + 维修工具×2 + 零件×2；
  - 街道 StreetLife（+2）：劫案阶段（`heist.stage` 8 档）、已结悬赏数（成就 First Bounty 判定）；
  - **跳过**（不适合直接写）：证券持仓 `holdings`/市场股价 `prices`/房产表 `owned`/车辆数组 `vehicles` 等复杂对象，每日标记/去重日期键（Sydney `*Day/*Year`），天文排期种子（`CelestialAnomalies.seed` 写坏会打乱日蚀/流星雨排期）；
- **测试**：test_mce 新增 §32.7（11 条声明收录 + 9 条抽样写入生效，覆盖锁定/投资/董事会/孤儿院买断/头盔/银行档位/劫案/余额/悬赏）；README 适配器表更新为 阶段 12 / 能力 64 / 数值 41；全链 6 步全绿；未 git 提交、未发布。

**枯木逢春 2.4.6 新键能力核查 + 联动补足（2026-10-25 再追加，并入 v1.9.6）**

- **能力核查结论**：43 键写入=读回全部正常（§32.7.2 九条抽样）；对照 dw246 源码逐键核实读取上下文，确认 4 处"键写了但功能不生效"的联动缺口并补齐（复用既有 applyCheatSync 机制，主键写入成功后自动修正伴随键、不留痕）：
  - 借记卡/信用卡勾选 → 自动联动开户 `bank.opened=true`（模组判定 `if (!bank.opened) return 'bank-required'`，只勾卡不开户必报错）；
  - 存款余额写入 → 自动联动开户 + 借记卡（模组可用资金判定 = `cashOnHand + (opened && debit_card ? balance : 0)`，只写余额钱存着但不可用）；
  - 罗宾投资协议勾选 → 联动股份比例（当前为 0 时补 10%，已有值不覆盖）——模组分红按 share 百分比结算，agreed 不带 share 收益恒 0；
  - 自己承担房租勾选 → 联动分开租房标记（对齐模组自身语义：Robin.ts `self_rent && !rent_separated` 时自动置 true）；
- **自足键确认（无需联动）**：孤儿院双买断（`pcFree/robinFree` 直读 `bought_out`）、四项成就（Board Seat / Controlling Stake / Black Raven / First Bounty 判定各只查单键）、银行档位（`ACCOUNT_TIERS` 直查即定额度）、属性锁定×6、驱除已用、容貌加成、花摊/爆米花/气球（直接参与收入结算）；
- **不自动补、note 已明示**：劫案阶段（筹备/判定数据复杂，note 警示"建议配合筹备逐步写"，跳写 closed 会按失败结算）；交通头盔/工具/零件（需存档已有对应车辆，车辆无作弊键，note 已补说明）；
- **测试**：§32.7.3 新增 6 条联动断言（借记卡联动开户 / 信用卡联动开户 / 余额联动开户+借记卡 / 已有股份不被联动覆盖 / 股份为 0 补 10% / 自租联动分开租房）；全链 6 步全绿（复核后重打包），打包 175,377 B，SHA=`6B794CE4F9138101353D5BC7EF650484A2D5C3E23934938584DE82F381AAFBCF`；未 git 提交、未发布。

## v1.9.5（2026-10-24 · 已发布）

**评分整改批次（10-24，前身归 v1.9.4 语义）：三项扣分点解决 + 乱码防御 + 文案一致性**

- **① 根治剧情播放器被困（评分扣分点 1，用户实测路径=测试路径盲区再修）**：此前 `unpinScene` 区分「是否原版 Scene Viewer 播放器段落」——用户实测的**模组恋爱播放器**（停在第 N 张图、手动取消后仍被困）走的是第三方恋爱模组图片播放段落，既不叫 `Scene Viewer passages` 也不走原版 unfreeze 通道，旧分支兜不到。v1.9.5 合并分支：重放中取消固定，只要 `back = replayScene.exitpassage` 有效，**一律先 `V.sceneViewSwitch="MB_CE_END"` → `Engine.play(back,true)` 强制跳回原位 → unfreeze → 删 replayScene/标记**，不再按播放器类型分流；`play(back)` 经 `onPassageOverride` 的 back 分支自然清理 used 队列项，后续手动清理幂等。back 为空仍保留 replayScene（依赖默认 Back 链接）。测试：test_mce 新增 23.17/23.18（`V.passage="MB Love Player"` 模拟模组播放器段落，fake Engine 断言 `Danube Street:true` 跳回 + replayScene/标记清理）；原有 15.7/23.1-23.4/43.4-43.5 兼容未改；
- **② DoL-Game-UI 长列表分片渲染（评分扣分点 2）**：`05-modcheat-ui.js` 超长组时间分片——首帧同步 40 行（MOD_ROW_BATCH）、其余逐帧 ≤40 行补建（单帧循环 ≤3 任务），`window.__mbCE_forceSyncRows` 强制全量开关（测试/极端场景用）；滚动流畅不再因 rAF 长任务卡顿截断；实测：归途之书子页 39 项全展开连续滚动无截断；
- **③ 适配器核对自动化（评分扣分点 3）**：`tools\resolve_missing.js` 升级——缺失条目输出证据行（file:line:源码摘录）、动态键读写对自动 KEEP、`--json` 机器可读输出；配合 audit_adapters 人工复核量进一步下降；
- **④ 剧情页 sHead 乱码防御（用户实测发现）**：剧情页「独立场景（未聚合成线）」标题实测被第三方 UI 模组改写为文本 `[object HTMLSpanElement]`（16 处/每角色组 1 处）。第一版（sHead 改双 span 绕过"单 span 扫描"）实测证伪；第二版（sHead 纯文本无子元素 + 渲染后 800ms 延迟兜底修复「无按钮且文本为对象化串」的 head）已打包（SHA `B2B6DB91...`），实测环境加载版本未确证、有效性待用户侧重载验证；已排除 CE 自身 textContent（全字符串）与汉化 mod（无 DOM 操作），DoL-Game-UI（`--dgu-*` 变量在运行）源码待网络恢复拉取核对；
- **⑤ 使用提示文案与新行为一致**：剧情页页首提示由旧版「之后你会被困在场景播放器中，请使用场景直达退出去」（与修复后行为矛盾）改为「触发一次自动停止、播放中随时可退出场景返回原位、清空队列恢复原版随机触发」；测试 30.1 断言同步更新为版本无关文案断言；
- **实测（用户真实路径，2026-10-24）**：播放器「结束自动清理+不重放」通过（荒原花朵→播放器→退出场景→返回段落、队列清空、无重放）；分片渲染通过；乱码防御第二版待用户侧确认（需 Mod 管理器重载 CE）；「退出回原位」精确性（退到播放器段内交互页 vs 直达前入口）待用户拍板；
- 全链 6 步全绿（build→syntax→smoke→regression→E2E→性别集成），`dev.ps1` 打包装进 game（167,602 B，SHA=`B2B6DB91817B71258AAE35FCD99A29B4934B7DA3B909A8A674258F9480296A61`）；未 git 提交、未发布。

**自查整改批次（2026-10-24 上午～下午，补记）：适配器核查盲区清零 + 零证据声明清理 + 工具链卫生**

- **补 5 个模组对照源码 + 键存活全量校验（消除核查盲区）**：下载 DomRobin 0.0.8 / More Love Interests 0.1.8.0 / SmartPhone 0.3.91 / Wraith'sReflection 1.3.4 / DoLSims 0.8.1.7 对应版本源码进 `tools\_modcache`（dr080/mli0180/sp0391/wr134/ds0817，对照目录 5→10）；此前这 5 个适配器声明从未被源码校验。校验结果：mli 1/1、smartphone 8/8 全活；dom_robin/wraiths/dolsims 共 8 条零证据缺失；
- **修复 resolve_missing.js Twee 形态误判（严重 bug，错题本 ERR-20261024-001）**：工具只认 JS `V.xxx` 形态，漏掉 Twee/SugarCube `$xxx`（`<<set $var>>`）形态，把 24 条真实存在的键误判 REMOVE——人工复核拦下后修复（litRe 单段键去双点 + 新增 tweeRe `$leaf`/`$parent.leaf` 证据类），修复后 3 适配器 REMOVE 收敛为「无」，删除集精确；约定「REMOVE 落地前必须二次复核：另一脚本 MISS + 人工 grep 0 命中」；
- **删除 9 条零证据声明**（两脚本 MISS + 人工 grep 0 命中三重一致）：dom_robin `liveStreamTogetherTalked`、`liveStream`（0.0.8 源码无 `$liveStream`/`V.liveStream`，仅话题字符串/CSS 类 liveStreamFans/Forbide/Delete）；wraiths `WRR`、`SilverConchWR`（探测逻辑/注释同步清）；dolsims `liveskillSims`/`programskillSims`/`createskillSims`/`searchskillSims`/`citylibrarybook_15`；REVIEW 复核后 dolsims `sinSims`/`BicycleSims` 实证真实变量（`<<set $sinSims to Math.clamp(...,0,1000)>>`、`<<set $BicycleSims to 1>>`）保留——REVIEW 收敛为 0；
- **测试断言同步**：20.1 分组齐全 能力 12→11、数值 3→2（dom_robin）；20.5 直播开关钳制断言删；41.5 银海螺（wr_conch/SilverConchWR）断言删；
- **文档/版本说明同步**：CHANGELOG v1.9.5 标「已发布」；v1.9.4 头部发布标记修正；README 适配器一览 DomRobin 能力 11/数值 2 + v1.4.2 探查段可操控项描述同步；
- **工具链卫生**：清理 11 个未跟踪 `_probe` 残留（tests 2 + tools 9，含整棵 `_probe_dolui\DoL-Game-UI-main` 重复对照树）；4 个过时工具（`_check_keys.js`/`_check_keys2.js`/`_check_mod_npc_names.py`/`_fw553_api.txt`，均指向旧对照路径 rv140/dw245）归档 `tools\_legacy\`（git rename 保留历史）；DoL-Project 桥接层 README/scan.ps1 对照版本同步为 dw246/rv1312/fw555mod（10 个对照目录）；
- 全链 5 步全绿（build→node --check→DOM 冒烟→全量回归→E2E+性别集成 24/24）；未 git 提交、未发布（打包与发布需用户另行确认）。

## v1.9.4（2026-10-24 · 已发布）

**今晚十点后批次（2026-10-23 22:00 后 ～ 10-24）：模组角色分区细分 + 剧情页 MOD 区懒渲染 + 注释/图谱一致性**

- **模组角色分区内细分**（10-23 深夜）：`buildModSubGroups` 按 `isLoveCharacter` 把模组角色拆为「模组·恋爱角色 / 模组·普通角色」两个子组（子标题 `mce-stage-head mce-line-head`，组内懒渲染复用 `buildCharCards`）；根因修复：`isVanillaNPC` 改读固定 32 NPC 清单、恋人固定 10 清单，不再读运行时 `setup.NPCNameList`（MOD 会扩展该清单导致模组角色被误判为原版）；测试：smoke 16 节 5 条 DOM 断言 + test_mce 27.13 数据层断言（恋爱细分因 MB 模块级缓存坑移入 smoke，见错题本 ERR-20261023-003）；
- **剧情页 MOD 场景区懒渲染折叠**：MOD 场景区默认收起只建标题，展开时才构建全部 MOD 场景控件（`mce-grp/mce-grp-t/mce-grp-body` 折叠语义）——MOD 场景多时不再每次切剧情页全量建 DOM（对应历史痛点：展开过多卡住/闪退）；原版区按角色分组不受影响；
- **注释一致性**：`01-core.js` 原版 32 NPC / 10 恋人清单注释由「运行时优先、此为兜底」修正为「固定清单」并注明 v1.9.2 污染根因；
- **图谱同步**：`codegraph sync` 已跑（15 变更文件 / 1076 节点），impact 确认 `vanillaNPCList`/`charCategory` 波及面仅角色页渲染链路；
- **测试同步**：smoke 13/15 节 MOD 断言改为「默认收起（data-collapsed=1 且场景键未渲染）→ 点击展开 → 断言渲染」，新增 4 条懒渲染断言（smoke 总计 169 PASS/0 FAIL）；
- **独立场景标题渲染 bug 修复（用户实测发现）**：`el()` 第三参数收到 element 时 `String(text)` 拼成 `[object HTMLSpanElement]`——剧情页「独立场景（未聚合成线）」标题整行变乱码；改为两段 append，并全仓搜索同类误用（仅此一处）；
- **剧情进度块汉化 + 剧情归属标注（用户实测要求）**：凯拉尔组行名汉化（爱意（kylar.timer.love）/ 被侵犯（kylar.raped）/ 谜题（kylar.riddle）/ 成名阶段（kylar.fameStage））；「已看剧情标记补全」的 8 个英文标记全部汉化并标注归属剧情——悉尼写作(sydneyWriting)·悉尼线 / 表白(saidLove)·主线 / 突击队(commando)·绑架线 / 冬季喷泉(fountainWinter)·冬季 / 喷泉初遇(fountainIntro)·初遇 / 聊天初遇(chatIntro)·初遇 / 食堂(canteen)·校园 / 地下室(basement)·绑架；
- **角色/地点分组默认收起 + 懒渲染（用户要求：按所属合在一起，不要全部平铺太长）**：剧情页原版区 16 个角色/地点组（亚历克斯/伊甸/哈珀/艾弗里/罗宾/惠特尼/凯拉尔/黑狼/神殿/监狱/学校/成人店/厨师/米奇/噩梦梦境/其他）全部改为默认收起只建组标题「▸ 名称（N 场景）」，点击展开才懒渲染该组场景与剧情进度块——剧情页不再整屏平铺；
- smoke 13/15 节断言适配折叠（stageOf 兼容 .mce-grp + expandGrp 展开后断言），新增折叠断言 → **smoke 总计 176 PASS/0 FAIL**；
- **折叠状态持久化 + 滚动保持（自查发现：剧情页每次操作后全量重建 → 展开状态丢失 + 滚动复位）**：折叠组展开/收起状态持久化到 `mbCEUiState.collapsed` 的「剧情:<组名>」键（与角色页「角色:<cat>」同语义、互不冲突），固定触发/回退/一键完成/切 tab 重建后展开的组保持展开、懒渲染内容仍在；`renderScenes()` 重建后恢复 `pane.scrollTop`，不再跳回页面顶部；smoke 新增「展开状态持久化：切 tab 重建后 MOD 区仍展开 + 懒渲染内容保留」断言；
- smoke 追加 5 条断言（无 [object HTMLSpanElement] / 独立场景标题正常 / 悉尼写作·悉尼线 / 被侵犯行名 / 表白+地下室归属）→ **smoke 总计 174 PASS/0 FAIL**；
- 全链 6 步全绿 + `dev.ps1` 打包装进 game（166,321 B，SHA=`01122542...`）；**已发布 v1.9.4（Release 422118616 + push 128e7e34，SHA 回读一致）**。

**评分整改批次（10-24，仍属 v1.9.4 语义，不升版不发布）：三项扣分点解决**

- **① 根治剧情播放器被困（评分扣分点 1，用户实测路径=测试路径盲区再修）**：此前 `unpinScene` 区分「是否原版 Scene Viewer 播放器段落」——用户实测的**模组恋爱播放器**（停在第 N 张图、手动取消后仍被困）走的是第三方恋爱模组图片播放段落，既不叫 `Scene Viewer passages` 也不走原版 unfreeze 通道，旧分支兜不到。v1.9.4 合并分支：重放中取消固定，只要 `back = replayScene.exitpassage` 有效，**一律先 `V.sceneViewSwitch="MB_CE_END"` → `Engine.play(back,true)` 强制跳回原位 → unfreeze → 删 replayScene/标记**，不再按播放器类型分流；`play(back)` 经 `onPassageOverride` 的 back 分支自然清理 used 队列项，后续手动清理幂等。back 为空仍保留 replayScene（依赖默认 Back 链接）。测试：test_mce 新增 23.17/23.18（`V.passage="MB Love Player"` 模拟模组播放器段落，fake Engine 断言 `Danube Street:true` 跳回 + replayScene/标记清理）；原有 15.7/23.1-23.4/43.4-43.5 兼容未改；
- **② DoL-Game-UI 长列表帧率风险根治（评分扣分点 2）**：Mod 子页「全部展开」一次性建数百行 = 单帧长任务，叠加 DoL-Game-UI 每帧 rAF 全量样式扫描抢主线程 → 滚动卡住/ANR 闪退（用户实测）。`buildModGrpRows` 增加分片：`pending > MOD_ROW_BATCH_LIMIT(60)` 时**首帧同步建 40 行（点击立即可见）→ 剩余入队逐帧 `setTimeout` 排空**（模块级 `modRowQueue/modRowBatchTimer/modRowStep` 跨渲染存活，单循环 3 任务 guard 防本帧过度），不砍任何作弊项；测试环境 `window.__mbCE_forceSyncRows=true` 强制同步（smoke 同步断言依赖），smoke 新增 16 节：70 行大模组展开首帧 45 行（40 数值+4 组+工具行）< 70 且 ≥40 → 排空后 75 行全量（含大数值0/69）；
- **③ 适配器核对自动化（评分扣分点 3，减少人工盲区）**：`tools/resolve_missing.js` 升级——(a) 证据行带 `file:line:源码摘录`（截断优先保留匹配词附近，人工一眼可判，不再重 grep）；(b) 动态键读写对自动 KEEP：`leaf` 字符串定义（配置/数组）与 `obj[var].leaf` 访问并存 → 键存活，不再一律 REVIEW；(c) 新增 `--json` 输出（verdict/vp/why/evidence），供自动化流水线消费。真实数据验证：deadwood-reblooms vs dw245 = 54 KEEP / 4 REVIEW（CoinCave coins 系字符串配置形态，真歧义留人工）/ 1 REMOVE（treasure.agreed）；revelation-the-book-of-return vs rv1311 = 55 全 KEEP；
- 全链 6 步全绿（build 424,960 B → syntax → smoke 176+3 断言 → regression 含 23.17/23.18 → E2E → 性别集成 24 项）；未 git 提交、未发布（等实测拍板）。

## v1.9.3（2026-10-23 · 未发布）

**性别切换盲区修复（实测路径=测试路径）+ 操作反馈 + 集成测试入全链**（10-23 22:00 前批次）

### 功能与修复

- **盲区修复**：`applyPlayerGender` 写完七键后立即触发原版引擎收敛 `exposedcheck(true)`——原版 `gender_appearance` 由 `exposure()`→`exposedcheck()` 在场景更新时重算，此前切完性别外观性别要等下一场景才同步；现同场景立即生效（战斗内也强制收敛；环境无引擎函数时静默跳过，不影响七键结果）；
- **测试补强**：`tests/integration_gender.js` 注入 fake `exposedcheck`，三态（男/女/双性）各加「立即触发收敛」断言；修正测试中原版 HTML 路径指向不存在的 `Desktop\DoL-ModLoader-...`（此前该集成测试永远 SKIP）→ 改为 `game\Degrees of Lewdity.html`；
- **集成测试入全链**：`tools/run_all.ps1` 新增 [6/6] 性别集成测试步骤（原版 HTML 缺失时 SKIP 不误报）；
- **操作反馈**：性别切换按钮点击后 `setStatus` 提示成功（「性别已切换为 X」）/失败原因（mce-err），不再静默无反馈；
- 全链 build→syntax→smoke→regression→E2E→integration_gender 全绿；未 git 提交、未发布（等实测拍板）。

## v1.9.2（2026-10-23 · 已发布）

**四模组适配跟进 + DoL-Game-UI 冲突修复**——本版全部内容见下（含 2026-10-23 发布后补充：list 链路测试 M 段 8 断言 + _modcache 旧对照清理）。发布提交：远端 main=`6870dfdb`（Git Data API 重建），资产 158,563 B SHA=`83476F98...`。


**四模组适配更新（枯木逢春 2.4.5 / 归途之书 1.3.11 / Dol-Optimization 1.1.2.1 / 框架 5.5.4）**

- **枯木逢春 2.4.5 甄别新增 12 个作弊项**（release 文件级 diff：625→640 文件，新增 3 系统）：
  - **金币洞穴 CoinCave**：`cc_found`（treasure.found，一键跳过岛屿探索 ≥100 次入口门槛）、`cc_appraised`/`cc_agreed`（跳过归还对话）；火把/携带金币/借展金币/船员金币/泽菲尔金币 5 数值（max 99，金币集齐 + 温特归还 + 泽菲尔收回 = 完成）；
  - **悉尼 NPC 转化（框架 5.5.4 `$maplebirch.npc.sydney.transformation.<type>.build` 实证）**：天使点数（max 50 = 满级 6 门槛 25-50）/ 堕天点数（max 31 = 满分 3 门槛 1/21/31）/ 恶魔点数（max 100 = 满级 6 门槛 5-30；≥6 且 ≥90 触发原版受孕强化判定）；
  - 寒月港船袭（harbour.raid.*）为随机事件、价值低，未加；
- **归途之书 1.3.11 / Dol-Optimization 1.1.2.1**：纯修复版（src 0 增删 / 快速存档+处女膜冲突修复），无新作弊点，仅版本声明同步；
- **框架 5.5.4**：declOverride 同步（check_framework_api 8/10，缺失 2 项 CE 均不依赖）；
- **精确性全量核查**：3 适配器 111 条 varPath 逐一在新版源码验证全部存活（枯木逢春 44 / 归途之书 57 / Dol-Opt 10）；新增通用校验脚本 `tools/_check_keys_mod.js`；
- **角色名中文化**：修复唯一不一致 Needmeet→尼德米特（04-modcheat.js 204 个 name 字段全量核对，新增脚本 `tools/_check_char_names.py`）；模组注册 NPC（月半/阿德里安/罗文/马洛/格威岚/尼德米特）与 CE 映射全部一致；

**DoL-Game-UI 冲突修复（滑动卡住截断 / 展开过多卡顿闪退）**

- **根因**：Mod作弊子页一次性全量建数百行 + DoL-Game-UI 每帧 rAF 全量样式扫描抢主线程 → 移动 WebView 滚动丢帧、长任务 ANR；
- **修复**：子页四分组默认收起（组头常驻、行闭包进 pending 点击展开才建，学 06-traits 九巡懒渲染）、展开态持久化（重建后恢复）、新增「全部展开/全部收起」折叠工具行；`.mce-grp` 加 `contain:content`（限制组内重排/重绘扩散）、`.mce-body` 加 `overscroll-behavior:contain`（防滚动链冒泡）；
- **自查补充**：行构建失败不再静默吞错——失败计数后组内显示「N 行加载失败（适配器数据异常）已跳过」提示；组头点击闭包修复（引用分组对象而非 DOM 节点）；
- **测试扩展**：test_mce 45.x 懒渲染回归段 8 断言（收起不建行/点击补建/计数/工具行/持久化恢复/不重复建行/contain 注入）+ smoke_dom/E2E 同步（进子页先展开分组再断言）；修 mock 选择器对 `data-mce-*` 连字符属性名的支持；
- 全链 build→syntax→smoke→regression→E2E 5/5 绿；zip 内 JS 与 build 产物 SHA 一致；未 git 提交、未发布（等实测拍板）

## v1.9.1（2026-10-22 · 已发布）

**新功能：玩家自己页「性别切换」（男 / 女 / 双性）+ 资金上限放开**

### 功能

- **性别切换**：玩家自己页快捷编辑区下方新增「性别切换」区——男 / 女 / 双性 三按钮一键切换，当前性别高亮 ✓。原版权威键实证（0.5.12.13 源码）：`V.player.penisExist` / `V.player.vaginaExist` / `V.player.penissize`（0-6，0=N/A）/ `V.player.gender_body`（"m"=男 "f"=女 "a"=双性外观）。男=阴茎保留+无阴道；女=无阴茎（penissize 置 0）+有阴道；双性=两者兼有；`V.player` 缺失时建壳兜底不崩，未知参数返回 FAIL 不写坏。导出 `getPlayerGender` / `applyPlayerGender`
- **（自查轮修复，同版本）**：性别切换首版只写 4 键，遗漏原版权威键——深查 0.5.12.13 实证玩家性别实际是 **7 键**体系：`V.player.sex`（"m"/"f"/"h"=herm，生殖器性别权威键，isGenitalMismatch/crossdressing 判定/服装分型/成就 "Being a Boy" 都读它）、`V.player.gender`（社会性别，新游戏预设 herm=gender"h"）、`V.player.ballsExist`（新游戏预设男/女 false、双性 true）。漏写后果：切女后 sex 仍 "m" → 原版 genital 显示错乱（`sex==="f"?parasite:...`）、`gender!==sex` 被误判 crossdressing、服装按男分型；切双性后无 herm 判定。现补全三态七键写入，对齐新游戏预设（男：gender=m/gender_body=m/sex=m/ballsExist=false；女：gender=f/gender_body=f/sex=f/ballsExist=false；双性：gender=h/gender_body=a/sex=h/ballsExist=true）；`getPlayerGender` 改为优先读 sex 推断；gender_appearance 由引擎 genderappearancecheck 按 sex 自动重算，不手写。37.4/D5 断言升级为七键校验，全链 5/5 绿
- **（集成测试，同版本）**：新增 `tests/integration_gender.js`——**不用 mock**：运行时从原版 Degrees of Lewdity.html 抽取真实性别判定函数（isGenitalMismatch / isCrossdressing / isHermOrCrossdresser / 服装分型 / 战斗性器官分型），注入构建产物的 applyPlayerGender/getPlayerGender，用切换后的玩家状态直接跑原版真实逻辑断言。21 条断言：三态七键写入 + 原版判定（切男/女/双性后 mismatch/crossdressing/herm 判定全部正确、服装分型 male/female 正确、双性 gender_body=a 时 breastsize≤3→male / ≥4→female、战斗性器官切女=parasite）+ 回归护栏（模拟旧实现只写四键 → 原版服装仍 male、性器官显示 herm，实证修复必要性）。原版文件缺失时显式 SKIP 不误报
- **资金上限放开**：快捷编辑区「资金」上限 1,000,000 → 99,999,999（仅防误输入，实际无上限；`cheatWriteValue` 对 max 非 number 不钳制，故保留极高上限兜底）
### 测试扩展

- **测试扩展**：37.4 数据层 12 条（三态七键写入 / getPlayerGender 推断 / 幂等不重置 penissize / V.player 缺壳兜底 / 未知性别 FAIL）+ E2E D5 点击级 8 条（性别区渲染 / 初始男高亮 / 点击女写七键 / 重渲染高亮 / 点击双性 / 点击男保留阴茎）；资金上限经 PANEL_QUICK_GROUPS 数据表核对（1000000→99999999）
- 全链 build→syntax→smoke→regression→E2E 5/5 绿；版本双源 `01-core.js` MCE_VERSION + `boot.json` version 同步 1.9.1；未发布（等用户实测拍板）
### 发布

- **（发布）**：已发布 v1.9.1 到 GitHub Release（2026-10-23，tag=v1.9.1，资产 `MapleBirchCE.mod.zip` 155,413 B / SHA256=7EAA5DDF...，下载回读比对一致）；git 经 Git Data API 推送（github.com:443 被断，远端 main=cb12625f，内容树与本地 80f14fa+813660f 一致，SHA 不同属预期，网络恢复后 fetch+reset 对齐）；归档 `tools/release_v191.js` + `tools/push_api_v191.js`；坑位沉淀 3 条（Node fetch IPv6 优先假象 / PowerShell git credential fill 交互挂起用 Node 通道 / here-string 中文 body PATCH 400）

## v1.9.0（2026-10-22 · 已发布）

**新功能：角色页按类型拆子页面（模组/恋爱/普通/持久NPC）+ 场景页新增「地点」子界面（地点阶段任务作弊区）+ 持久 NPC 收录（经理/校医/守卫囚犯等）**

### 功能

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
### 测试扩展

- **测试扩展（第 44 节 44.1-44.5）**：分类纯函数、持久 NPC 枚举、地点写入（建壳/钳制/黑名单绕过/留痕/回退）、DOM 四区块默认收起+点击展开+经理卡、场景页双层页签+道路拉满=5；同步修正 mkNode mock 的 textContent 语义（真实 DOM：设置 textContent 替换全部子节点）
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED、功能 E2E 全 PASS、zip 正斜杠、verifier 4/4；安装包与 SHA 见交付
### 自查优化（五轮，不升版本）

- **（同日自查优化，不升版本）**：① 修复留痕语义 bug——`placeStageWrite` 二次写入把 before 覆盖为当前值，导致「建壳字段多次写入后回退」还原成上次值而非删除字段；改用 `"before" in prev` 保留首次写入前状态（44.7 新增断言覆盖：两次 +1 后 undo 删字段、既有值 3→5 后 undo 还原 3）；② 滚动保持补齐——renderCards/renderPlaces 重建后恢复 pane.scrollTop（对齐五巡 mods/特质区行为，长列表点击不跳顶）；③ 持久 NPC 变体键（saddled_steed/stray_guard）显示族中文名（坐骑/守卫），不再裸显英文键名；④ 测试补盲 44.6（地点步进 +1/−1 钳制、建壳回退删字段、placesTab localStorage 持久化恢复、变体名、空档不枚举 per_npc）+ jsdom 冒烟补角色页折叠/场景页双层页签真实 DOM 语义断言（按钮重渲染后重新查询，修正旧引用断言）
- **（第二轮自查优化，不升版本）**：⑤ 修复 cheatWriteValue/cheatWriteListValue 留痕语义——与地点通道同源的 before 覆盖 bug（叶子字段原本不存在时，二次写入把 before 覆盖成当前值，回退残留而非删除）；统一改为 `"before" in prev` 保留首次面板写入前状态（traitWriteValue 通道同源受益）；18.8 旧断言原依赖 bug 行为（score 首次不存在却期望还原 5）→ 修正为正确语义并补 18.8b 既有值还原；新增 44.8 测试覆盖 cheat 通道两次写入后 undo 删字段 + 既有值还原。17 个源码文件全量精读一遍，全链 5/5 绿
- **（第三轮自查优化，不升版本）**：⑥ 角色页收起组懒渲染——收起的分组不再全量渲染角色卡片 DOM（buildCharCards 收起不建卡片、展开补建、防重复补建），长角色列表收起状态下 DOM 开销归零；⑦ 模组特质数值可改——discoverModTraits 为字符串 has 模组特质生成 values（数字比较变量 gte/is/gt 非 NaN，仿原版编译逻辑），renderTraitRow 放开 isMod 限制，模组注入特质行同样渲染「改数值 / 回退」控件（写入走 player-self 留痕通道，traitWriteValue/undoCheatModValue 数据层零改动）；⑧ tools 目录卫生——55 个临时日志（_*.log / _head_blob*）清理不入库，scan_dol_vanilla 系列 / debug_dom44 / release_v190 / push_api_v190 共 19 个工具脚本按惯例归档进 git
- **测试扩展（第三轮）**：37.3c 数据层断言（模组特质 values 生成 / 数值写入 2000 / undo 还原 1000 / 相对值 +500 → 1500 再还原）+ E2E D3 点击级断言（模组特质行改数值按钮 / 输入框 / 点击写入 / 回退还原）；全链 build→syntax→smoke→regression→E2E 5/5 绿
- **（第四轮自查优化，不升版本）**：⑨ 修复 gt（严格大于）条件特质「获取后判定未获得」——traitWriteSatisfy 对 gt 与 gte/is 共用分支写 num，写后 `x > num` 恒 false，获取按钮显示已写但 traitOwned 仍 false（原版受影响：Purity Boost `$featsPurityBoost gt 0`、Bratty `$submissive lte 850 and gt 500`）；改为 gt 写 num+1 满足严格大于。新增 37.3d 断言（Purity Boost 获取写 1 + 判定已拥有 / 移除写 0 + 判定未获得 / Bratty 复合条件获取后已拥有）；全链 5/5 绿。另：git fetch 被断（github.com:443 网络波动），3 个本地 commit 仍未推送，待网络窗口
- **（第五轮自查优化，不升版本）**：⑩ 修复 gt 条件「改数值」默认值与获取通道不一致——discoverModTraits/compileVanillaTraits 对 gt 生成 values.val=num（如 gt 0 → 0），与 traitWriteSatisfy 的 num+1 语义矛盾：改数值输入框默认 0，不输入直接点「改数值」写 0 恒不满足。统一 gt values.val=num+1。新增 E2E D4 点击级断言 11 条（模组 gt 特质「纯洁增幅（模组）」获取写 1 判定已拥有 / 改数值默认值=满足值 1 / 移除归 0）；全链 5/5 绿。同轮核对：快捷编辑区 6 项 999999 上限与实测截图一致、unfreezePlayerStats hook 幂等 guard 无重复包装

## v1.8.23（2026-10-22 · 已发布）

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

## v1.8.22（2026-10-21 · 已发布）

**十六巡：自查优化收尾（README 版本表同步 + 条目文案去版本号依赖 + 模组注册名实证）**

- **README.md 同步**：框架实测兼容 5.5.1→5.5.2；适配器一览表枯木逢春 2.4.2→2.4.3、归途之书 1.3.8→1.3.9、框架 5.5.1→5.5.2（API 6 项→8 项）；"其余适配模组无公开仓库，暂不纳入自动检测"（已过时）→"9 渠道全覆盖：8 个适配模组 + 框架本体"；兼容矩阵实测版本 5.5.1→5.5.2
- **条目文案去版本号依赖**：`f_avery_refused` name「孤儿院 · 已拒绝艾弗里收养（2.4.2 新增）」→「（模组新增）」、note「2.4.2 新增：」→「模组 2.4.2 起提供：」（避免每次模组升版都要改 UI 文案，符合"断言/文案不写死版本号"原则）
- **模组注册名实证（补十五巡验证盲区）**：枯木逢春 2.4.3 main.ts 确认 `maplebirch.get('DeadwoodReblooms')` 注册名保留；归途之书 1.3.9 main.ts 确认 `get('RobinTemple')/get('TempleChoir')/get('TempleDuties')` 保留——两适配器 detect 探测键在新版全部仍成立
- 全链验证：全量回归 ALL TESTS PASSED（31.1/32.1 适配器声明断言 PASS）、功能 E2E 全 PASS、zip 正斜杠、verifier 4/4；安装包 145,654 B，SHA256=D3AFC885693A6983BEC8D3A0401A701EDB9B1E17611F2D6477E1B2A7D334B437

## v1.8.21（2026-10-21 · 未发布）

**十五巡：3 个第三方模组适配器跟随上游更新（枯木逢春 2.4.3 / 归途之书 1.3.9 / 框架 5.5.2）+ 更新检测脚本补全**

- **适配器声明升版**：归途之书 modName v1.3.8 → v1.3.9；枯木逢春 modName 2.4.2 → 2.4.3
- **键存活全量校验**：对两个适配器全部 59+43 条 varPath/skipVar/completeVar/progressVar 在新版源码中逐一验证——全部存活，无需删改（初检 MISS 系引用形态差异：模组以 `$X.Y.Z`/分段 get 引用，二次短键名探测确认均存在）
- **新版内容甄别（不新增作弊键，理由实证）**：枯木逢春 2.4.3 将渡鸦神社/月羽从 MoreTransformations 拆为独立 DarkfeatherShrine 模块——存档键仍留在 `V.MoreTransformations.shrine.*`（stage/feeds/helped/donations/confessed 等 2.4.2 已有），拆包不改键；新增 Finance/ResidentBath（`real_estate.life.bath/days` 为复杂对象/字典，改坏易崩）、ParkBench（无持久键）、Robin/Savings（仅复用已有 reserve 键）；归途之书 1.3.9 新增 RobinTemple/Garden（`work_day` 为日期戳，非累计值，作弊语义混乱）。以上均不进面板
- **框架 5.5.2 API 核对（check_framework_api.js）**：核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists / define / frameworkNotice）；`setup.MapleBirch` 缺失无害（仅 01-core.js resolveMB() 兜底分支，window.maplebirch 主路径存在时永不触发）、`maplebirch.patch` CE 零调用 → declOverride 5.5.1 → 5.5.2
- **check_mod_updates.js 补 3 个缺失适配器渠道**：dol-optimization（ANLINSTUDIO/Degrees-of-Lewdity-DolOptimization）/ wraiths-reflection（Water2311/WraithsReflection）/ dolsims（MissedHeart/Degrees-of-Lewdity-DolSims）→ 6 渠道扩为 9 渠道；顺手修复版本提取正则不一致 bug（声明侧 `(\d+\.\d+(?:\.\d+)?)` 把 0.8.1.7 截成 0.8.1 导致 dolsims 误报"有更新"，统一为 `(\d+(?:\.\d+)+)` 与 tag 侧一致）
- 测试：test_mce 31.1/32.1 版本断言同步（1.3.9 / 2.4.3）；分组计数断言不变（未增删条目）
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED（含 31.1/32.1 新版断言、43.6 physique/43.7 译名回归）、功能 E2E 全 PASS；安装包 145,662 B，SHA256=D0D335E5E49AAC093814CE5ED6E2181D93B4443ED453CCF6945C70BC626F21D4
- 备注：更新检测实跑 9 渠道 8 个实测全对（枯木逢春/归途之书/DomRobin/MLI/SmartPhone/Dol-Optimization/Wraiths/DolSims 均无更新）；框架渠道当轮撞 GitHub API 60 次/小时限流（core 0/60，19:44 恢复），以本地 compareVersions 模拟确认 decl 5.5.2 == tag 5.5.2 判"无更新"，逻辑正确；定时任务每日 21:15 单次调用不撞限流

## v1.8.20（2026-10-21 · 未发布）

**十四巡：剧情页页首「使用提示」文案还原为固定触发原始说明全文（用户要求）**

- 用户实测反馈固定剧情播放器问题（播放完不自动取消、手动取消后仍被困场景播放器）在 v1.8.19 机制修复后仍未解决，用户明确放弃该方向（"不需要你解决了"），要求还原提示文案
- 还原：`renderScenes()` 页首 `mce-warn` 文本恢复为用户给定全文「使用提示：当你使用固定触发后，会一直循环。当出现退出场景时，回到此页面取消队列。之后你会被困在场景播放器中，请使用场景直达退出去。」
- 同步更新 test_mce 第 30 节 WARN_TXT 常量与 30.1 断言名（固定触发原始说明全文）
- 保留能力不动：v1.8.19 的 unfreeze hook 播放结束清理 / unpinScene 防困重构 / physique 无上限 / Seath·Alice·Liddell 译名，均不回滚
- 全链验证：DOM 冒烟全 PASS（剧情页渲染可见还原文案）、全量回归 ALL TESTS PASSED（含 30.1 还原断言）、功能 E2E 全 PASS；安装包 145,662 B，SHA256=6E566F9A5DA5736DEDA4AEA3690784D26E1C7895BBB1354FDAA4637F79BCDF06

## v1.8.19（2026-10-21 · 未发布）

**十三巡：用户实测 3 处 bug 修复（播放结束自动清理 / 播放器内取消防困 / 体能无上限 / 角色译名补齐）**

- **修复（真 bug）剧情播放完不自动取消、仍重新播放**：根因是结束判定只认 4 个硬编码段落名（Scene Viewer End / passages / exitpassage / Farm Work），而 Maplebirch 框架恋爱场景播放器（如「罗宾码头」场景）结束段落是框架自有名、不走原版 Scene Viewer 通道 → 队列 used 项永不清理 + `replayScene` 残留 → 下次推进剧情再次触发（循环）或拦截后续固定。修复：新增 `hookUnfreezePlayerStats()` 包装 `window.unfreezePlayerStats`——任何合法 unfreeze 调用（原版退出/框架播放器结束/mod 播放器结束都会解冻）即视为「场景播放结束」→ 自动清理队列 used 项 + 清 `replayScene`/重放标记；仅 MOD 重放（`mbCE_replayOnce`）生效，原版手动重放保持原版行为
- **修复（真 bug）手动取消后仍被困场景播放器**：`unpinScene` 原逻辑 `back = exitpassage || currentPassageName()` 兜底会让「正处于播放器段落时取消」变成原地跳转（跳去当前播放器段落），且随后删 `replayScene` → 播放器 default 分支 Back 链接无源 → 退出按钮消失。重构为三分支：back 有效且不在播放器内 → 先删状态→解冻→跳回原位；back 有效且在播放器内 → 解冻→跳回原位（目标非播放器，安全）→删状态；back 为空（框架播放器）→ 保留 `replayScene` 不主动跳转（Back 链接可用，玩家手动退出后由 unfreeze hook 兜底清理）
- **修复（用户点名）体能上限解除**：`physique` max 100 → 999999（无硬上限仅防误输入，与意志/意识/淫乱/暴露癖/异种癖同口径）
- **修复（用户点名）角色页英文名中文化**：`DISPLAY_NAMES` 新增 Seath→希斯 / Alice→爱丽丝 / Liddell→利德尔（音译，可游戏内校对调整）
- 测试：test_mce 新增第 43 节 17 断言（unfreeze hook 安装/播放结束清理/原版手动重放不越权/播放器内取消跳回原位/back 空保留不跳转/physique 无上限/新译名）；同步 42.4 physique 断言、40.1 译名断言
- 全链验证：DOM 冒烟全 PASS、全量回归 ALL TESTS PASSED、功能 E2E 全 PASS；安装包 145,666 B，SHA256=3FC9537ED2420D646C166B3997282682C50853D1CC75ED1B036AF49C8730D07C

## v1.8.18（2026-10-21 · 未发布）

**十二巡全源码深度自查（17 文件约 5500 行逐行审查至收敛，修复 3 处）**

- **修复（真 bug）**：特质获取/移除对 `$x isnot true/false/undefined` 条件的满足值写反——`grantTrait` 对 `isnot true` 此前写 `true`（条件仍不满足）、`revokeTrait` 写 `false`（条件仍满足）。原版「破誓（Broken Vow）」首条件 `$player.virginity.temple isnot true` 直接命中。修复：满足 `isnot true`→写 `false`、`isnot false`→写 `true`、`isnot undefined`→写 `1`、`isnot N`→写 `N-1`；移除时反向写回使条件不满足
- **修复（文案过时）**：剧情页顶部固定触发提示仍写「会一直循环/被困在场景播放器中」——与 v1.4.8 起的「一次性触发、播放完自动返回原位并停止」机制矛盾，误导用户。改为新机制说明（清空队列/单条回退恢复原版随机触发）
- **修复（文档）**：`ORIGINAL_V_ROOT_KEYS` 注释键数 183 → 186（实测）
- 其余 14 个文件逐行复核无问题（恋爱/转化/格威岚/场景直达/固定触发/Mod作弊 8 适配器/庄园维护/战斗终结/错误熔断/懒渲染/留痕裁剪/数值钳制 34 项/API 导出完整性）
- 测试：test_mce 新增 42.6 节 8 断言（Broken Vow isnot true 获取写 false/移除写 true、isnot undefined 写 1、isnot N 写 N-1、isnot false 写 true）

## v1.8.17（2026-10-21 · 未发布，并入 v1.8.22）

**十一巡：自查修复 + 快速面板补资金**

- **修复留痕排序失效**：恋爱对象留痕条目缺 `t` 时间戳，trim 裁剪按时间升序时兜底 0 导致该条目永远被当成最旧、优先裁剪。补 `t: Date.now()`；
- **快速面板新增「资金」项**：V.money 直接读写（min 0 / max 100万，单位 £，建议整数），支持 +N/-N 相对调整与回退，走统一钳制与留痕；
- 测试：test_mce 42.4 数据表 33→34（9+6+10+4+5）。

## v1.8.16（2026-10-21 · 未发布，并入 v1.8.22）

**十巡：自查修复（懒渲染搜索边界）**

- **修复搜索被懒渲染吞掉**：搜索词命中但目标特质分类处于收起状态时，匹配行落在收起组里不可见（懒渲染 1.8.15 引入）。修复：搜索态（q 非空）强制所有组展开并建行（仅改 DOM 收起标记，不写持久化折叠状态，搜索结束恢复默认收起）；
- 测试：smoke 13.7（全部收起 + 搜索「童贞」→ 匹配行可见）。

## v1.8.15（2026-10-21 · 未发布，并入 v1.8.22）

**九巡：用户批准三项优化 1/2/3**

- **① 特质区收起组懒渲染**：折叠分组初始不再建行（行闭包进组 pending），点击展开/全部展开时才补建——面板开合与切页 DOM 显著减少（特质区 124 行中收起组不再占 DOM）；
- **② 面板写入留痕有界化**：`V.mbCE_wrote` 条目数 > 400 时按时间戳升序裁剪最旧一半（5 个写入点统一调用 mbCEWroteTrim），防存档无限膨胀；被裁条目的回退窗口随之关闭；
- **③ 第三方噪音源折叠扩展**：除 DoLGameUI 特效层外，新增 DependenceChecker / TweeReplacer / Paperdoll+ ReplacePatcher / Terraria Expand Mod / Simple Frameworks ModOrderContainer 归一化（各归一同源，命中单源熔断，不再独立刷屏）；
- 测试：smoke 13.4b（5 种第三方噪音 25 条折叠 ≤6）+ 13.5（懒渲染：初始 33 行 <60、展开补建、全部展开 >100）+ 13.6（450 条留痕裁剪 ≤400 且保留最新）。

## v1.8.14（2026-10-21 · 未发布，并入 v1.8.22）

**八巡：用户指令（意志/意识/淫乱/暴露癖/异种癖改无上限 + 整体核查）**

- **5 属性无上限**：willpower/awareness/promiscuity/exhibitionism/deviancy 钳制上限 2000 → 999999（仅防误输入，非游戏上限）；purity（原版内部 0-2000）、physique（0-100）保持不变；
- **整体核查**：核心属性表 8 项 / 基础技能 6 项 / 性技能 10 项 / 成绩 4 项 / 武器 5 项 min-max 全表审计通过（技能与成绩 0-1000 百分比量纲）；8 适配器 80 处数值项审计通过（次数 999 / 进度 100 / 金钱 10 万+ / 开关 0-1，无异常钳制）；
- 测试：smoke 13.3 扩展（5 属性写入 5000 验证无上限）。

## v1.8.13（2026-10-21 · 未发布，并入 v1.8.22）

**七巡：实测反馈修复（核心属性/模组数值上限被钳 + DoLGameUI 特效层错误 50 条刷屏）**

- **钳制上限修正**：核心属性数据表 max 配错（willpower/awareness/promiscuity/exhibitionism/deviancy 误配 100，应为内部值域 2000；beauty 误配 100，原版无硬上限 → 999999 防误输入）→ 应用大值不再被钳死；
- **模组数值上限放宽**：LostLamb doubt/fear/notice 100→1000；TempleDuties archive.roof 99→100、shelves 99→999（实测当前值 108 超原上限）；
- **错误噪音归一化**：DoLGameUI 特效层 4 种 layer 消息（spotlight/glow/linearGradient/flatColorOverlay）交替刷屏时各成独立源绕过单源熔断 → 归一为同一源，命中「单源 ≥20 熔断」；50 条风暴折叠为 0-1 条；
- 测试：smoke 13.3（意志 2000 / 容貌 50000 写入）+ 13.4（24 条特效层错误折叠 ≤1）。

## v1.8.12（2026-10-21 · 未发布，并入 v1.8.22）

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

## v1.8.11（2026-10-20 · 已发布）

**模组特质可直接获取：特质管理区对模组注入特质不再只读**

- `discoverModTraits()` 保留 has 字符串（此前只存函数型 hasFn，导致模组特质行只读展示）
- 特质管理区模组注入特质行现在有「获取/移除」按钮：
  - 字符串型 has（如 `$acceptance_penis_small gte 1000`）→ 复用 grant/revoke 写满足/不满足变量，直接获得/移除
  - 函数判定型 has → 走强制获得标记（`mbCE_forcedTraits`，与原版复杂表达式特质一致）
- 分类提示文案更新：「模组注入（自动发现，可直接获取/移除）」
- 测试：全量回归 37.3b 新增 8 断言（双型发现、字符串型写 1000/移除写 0、函数型强制标记/移除、拥有判定往返）
- 适配完整性核对结论：8 适配器功能面全覆盖，特质类条目（枯木逢春铁意志/受虐狂、DoLSims 14 号书 5 封印等）经 Mod作弊 页 abilities 勾选直接获得
- 打包修复 ERR-20261020-001：zip 条目正斜杠分隔符（Compress-Archive 反斜杠导致 ModLoader cannot get file → ZipArchive 手动写入 + 打包分隔符校验）

## v1.8.10（2026-10-20 · 未发布，并入 v1.8.22）

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

## v1.8.9（2026-10-20 · 未发布，并入 v1.8.22）

**审查优化：对齐 AutoClean 行为 + 数据层下沉 + 边界标注**

- 农场收获对齐 AutoClean 0.1.5：`mcMaintainFarm()` 遍历 stock 直接把键名传给 `tending_give`（truffles/eggs/milk/cream 全覆盖，修复原映射漏收货 cream；不再用可能不符原版的映射名）
- 投喂对齐 AutoClean：`mcFeedAvery()` 仅艾弗里关系达 saved/ascended 才喂食；未达阶段返回 `skipped` 不操作、不再计入 `dinner_missed`
- 战斗终结数据层下沉：8 个动作定义从 08-npc-traits.js 移至 03-global.js（`COMBAT_ACTIONS`/`mcCombatAction`，经 09-exports.js 导出 API），UI 只负责渲染；区级提示注明「建议战斗中生效；结束集群战斗外会把游戏时钟拨回当日 0 点」
- 庄园自动维护改 mce-row 结构（说明 + 按钮分行），与战斗终结区样式一致；投喂未达喂食阶段显示中文提示
- 边界标注：DoLSims 适配器 恶魔化/天使化/堕落天使 三项补 note（复用原版转化键，会同时推进原版转化阶段）；wraiths-reflection 状态键注释补全 necklaceThiefWR（探测键与文档一致）
- 测试：全量回归新增 41.2b 断言（含 cream 四类库存全部收获并清零）；41.1 断言改为「未达喂食阶段不计数」；冒烟 + 全量回归 590+ 断言全绿

## v1.8.8（2026-10-20 · 未发布，并入 v1.8.22）

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

## v1.8.7（2026-10-20 · 未发布，并入 v1.8.22）

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

## v1.8.6（2026-10-20 · 已发布）

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

## v1.8.5（2026-10-19 · 未发布）

**修复**：特质栏消失严重 bug

- 修复 `select.type` 只读 getter 赋值崩溃（Cannot set property type of #<HTMLSelectElement> which has only a getter）
- 错误编号 ERR-007 / ERR-008，已入错题本

## v1.8.4（2026-10-19 · 未发布）

**三需求**：

- 需求①：同阶段特质合并为系列下拉行（受虐狂/施虐狂各档、天真无邪、学校成绩系列）
- 需求②：模组角色英文名中文化（Tsukihan/Rowan/Adrian/Marlow/Grant/Needmeet/Feng 等）
- 需求③：无可写条件特质强制获得（`mbCE_forcedTraits` 只读展示 + 强制获得）
