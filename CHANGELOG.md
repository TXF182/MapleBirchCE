# MapleBirchCE 更新日志

版本线记录（v1.8.4 起；更早版本历史见会话存档）。版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 字段。

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
