# MapleBirchCE 更新日志

版本线记录（v1.8.4 起；更早版本历史见会话存档）。版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 字段。

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
