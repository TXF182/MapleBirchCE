# MapleBirchCE 更新日志

版本线记录（v1.8.4 起；更早版本历史见会话存档）。版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 字段。

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
