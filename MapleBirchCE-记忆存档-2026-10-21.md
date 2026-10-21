# MapleBirchCE 记忆存档（2026-10-21）

> 用途：跨会话恢复上下文快照。任何新会话先读本文件，即可从干净状态续接，无需回溯整条历史。
> 生成时间：2026-10-21（基于 git/版本/产物实况核对）；最后更新：v1.8.22 十六巡交付后

## 1. 一句话定位
DoL + Maplebirch 框架作弊面板模组，当前 **v1.8.22**，已适配 8 个第三方模组；近期主线："操作卡顿/闪退"治理（已收效）→ 实测反馈修复（钳制上限、错误噪音折叠）→ 5 属性无上限 → 三项优化（特质懒渲染/留痕有界化/噪音折叠扩展）→ 十巡搜索边界修复 → 十一巡资金项+留痕时间戳修复 → 十二巡全源码逐行自查至收敛（修 isnot 布尔写反真 bug + 过时提示文案）→ 十三巡实测 3 bug 修复（播放结束自动清理 unfreeze hook / 播放器内取消防困 / 体能无上限 / Seath·Alice·Liddell 译名）→ 十四巡按用户要求把剧情页「使用提示」文案还原（播放器机制不再修复）→ 十五巡 3 个第三方模组适配器跟随上游更新（枯木逢春 2.4.3 / 归途之书 1.3.9 / 框架 5.5.2）+ 检测脚本补 3 渠道（9 渠道）+ 修 dolsims 版本提取误报 → **十六巡自查收尾（README 版本表同步 + 条目文案去版本号 + 模组注册名实证）**。

## 2. 路径与入口（唯一权威源）
| 项 | 值 |
|---|---|
| 仓库根 | `C:\Users\27352\Doubao\chats\2026-10-13\new-chat-2\MapleBirchCE`（注意是 **new-chat-2**，不是当前会话目录） |
| 版本双源 | `javascript/src/01-core.js` 的 `MCE_VERSION` + `boot.json` `version`，均为 1.8.22 |
| 源码真相源 | `javascript/src/*.js`（17 段），构建产物 `javascript/maplebirchce.js` 以 src 为准 |
| 构建 | `node tools/build_js.js` |
| 全链验证 | `powershell -NoProfile -ExecutionPolicy Bypass -File <abs>\tools\pack.ps1`（build→node --check→smoke_dom→test_mce→functional_e2e→打包→分隔符→verifier→SHA256；超 15s 转后台任务需 TaskOutput block 等待） |
| 发布工具模板 | `tools/release_v1811.js`（可改造发布 v1.8.13） |
| 每日模组检测定时任务 | 已建（每天 21:15，含 SmartPhone 渠道 + 盲区防误删提示） |

## 3. 交付线（当前最新 = 十六巡）
| 轮次 | 内容 | zip | SHA256 |
|---|---|---|---|
| 三巡 | 错误风暴熔断（mbCEFuse） | 140,918 B | 5C4C1D70... |
| 四巡 | 熔断表有界 + badge 解耦 + 防重绑定 + mods 页跳刷新 | 141,563 B | 8400F9BC... |
| 五巡 | Mod作弊页局部行更新 + 滚动保持 + badge force | 142,542 B | 9C5F0422... |
| 六巡 | 快速面板局部更新 + smoke 13 节 + 修 CSS.escape 兜底漏前缀 | 142,821 B | A36644B17B5309649115BDE427A135C0D6A07299B7AEF0BC23FC47A020A29D1E |
| 七巡 | 钳制上限修正（核心属性+模组数值）+ 特效层错误归一化折叠 | 143,109 B | BBB6801296F11ADD98222D29996D18562B3323B225EE50896C6D1B214B7FF893 |
| 八巡 | 5 属性无上限（willpower/awareness/promiscuity/exhibitionism/deviancy → 999999）+ 整体数值核查 | 143,113 B | 752D889DC41426C29848C9AA516892AB9CC39E172E4261E06797142FCB76FC11 |
| 九巡 | 三项优化：①特质区收起组懒渲染（展开才建行）②mbCE_wrote 留痕有界化（>400 删最旧一半）③第三方噪音折叠扩展（+5 种噪音源） | 144,171 B | CAB3AD0B3E18077452D23BB092C837CDDB75B3E225BFF992859877BA942DA6CB |
| 十巡 | 自查修复懒渲染搜索边界（1.8.15 引入：搜索命中但分类收起→行不可见；搜索态强制展开+建行）+ 搜索词持久化恢复缺口（renderPlayerEdit 从 mbCEUiState.filter 恢复） | 144,383 B | B8C0019C4B6E5EB74B14203E46D848E26C234C9F6DA4A77F0B0025FD927EAAF5 |
| 十一巡 | 快速面板新增资金项（V.money，0-100万）+ 修复留痕条目缺 t 时间戳（trim 排序兜底 0 永远优先裁剪恋爱对象条目） | 144,478 B | B124B769957D62374973F741C3C26ADDB97579C7259AC653C1F1C60A621A1518 |
| 十二巡 | 全源码逐行自查至收敛：修特质 isnot 布尔满足/不满足值写反（原版 Broken Vow 直接命中，满足 isnot true 写 false/移除写 true）+ 修剧情页固定触发过时提示文案 + 注释键数 183→186；test_mce 新增 42.6 八断言 | 144,713 B | 59712A2C9673259C9A87B309B56C13969F4E12EDB518443403E6FF5DB59234E2 |
| 十三巡 | 实测 3 bug：①播放结束自动清理——新增 hookUnfreezePlayerStats 包装 window.unfreezePlayerStats，任何合法 unfreeze（原版/框架播放器/mod 播放器退出）即清理队列 used 项+replayScene（根因：框架播放器结束段落非硬编码 4 名，残留导致循环/拦截）；②unpinScene 防困重构——播放器内取消改跳回原位 exitpassage、back 空保留 replayScene（原 back=currentPassageName 兜底导致原地跳+无源 Back）；③physique max 100→999999 + Seath/Alice/Liddell 译名；test_mce 新增 43 节 17 断言 | 145,666 B | 3FC9537ED2420D646C166B3997282682C50853D1CC75ED1B036AF49C8730D07C |
| 十四巡 | 按用户要求把剧情页页首「使用提示」还原为固定触发原始说明全文（播放器机制用户已放弃，不再修复）；同步 test_mce 第 30 节 WARN_TXT + 30.1 断言；v1.8.19 机制改动全部保留不回滚；升 1.8.20 | 145,662 B | 6E566F9A5DA5736DEDA4AEA3690784D26E1C7895BBB1354FDAA4637F79BCDF06 |
| 十五巡 | 3 模组适配器跟随上游更新：归途之书 modName v1.3.8→v1.3.9、枯木逢春 2.4.2→2.4.3（59+43 条 varPath 全量键存活校验，无删改）；框架 5.5.2 API 核对（核心 8 项全过，setup.MapleBirch/patch 缺失无害）→ declOverride 5.5.1→5.5.2；check_mod_updates.js 补 3 渠道（dol-optimization/wraiths-reflection/dolsims）6→9 渠道 + 修声明/tag 版本提取正则不一致（dolsims 0.8.1.7 误报"有更新"）；新版内容甄别（DarkfeatherShrine 拆包不改键、ResidentBath 复杂对象/ParkBench 无键/Savings 已覆盖/Garden 日期戳，均不新增作弊项）；test_mce 31.1/32.1 同步；升 1.8.21 | 145,662 B | D0D335E5E49AAC093814CE5ED6E2181D93B4443ED453CCF6945C70BC626F21D4 |
| 十六巡 | 自查收尾：README 版本表同步（框架 5.5.2 / 枯木逢春 2.4.3 / 归途之书 1.3.9 / 9 渠道全覆盖声明）；f_avery_refused 条目文案去版本号依赖（2.4.2 新增→模组新增/模组 2.4.2 起提供）；模组注册名实证（dw243 main.ts get('DeadwoodReblooms')、rv139 main.ts get('RobinTemple'/'TempleChoir'/'TempleDuties') 均保留，detect 探测键在新版全部成立）；升 1.8.22 | 145,654 B | D3AFC885693A6983BEC8D3A0401A701EDB9B1E17611F2D6477E1B2A7D334B437 |

## 4. git 状态（未提交 = v1.8.12 + v1.8.13 + ... + v1.8.22 全部内容）
- HEAD = `e883b43`（v1.8.11 发布提交）
- 未提交：CHANGELOG.md / README.md / boot.json / javascript/maplebirchce.js / src 的 01-core·02-romance·03-global·04-modcheat·05-modcheat-ui·06-traits·07a-shell·07b-char·07c-stage·07d-places·07e-scenes·07f-pins·07g-romance·07h-render·08-npc-traits·09-exports / tests/smoke_dom.js / tests/test_mce.js / tests/functional_e2e.js / tools/check_mod_updates.js / 记忆存档本文件
- 远端 `https://github.com/TXF182/MapleBirchCE.git`；发布 v1.8.22 需先提交，参考 release_v1811.js

## 5. 架构速览
- 17 段 src 按面板分区拆分：01-core（版本/探测/API）/ 04-modcheat（适配器数据+通用写入执行器 cheatWriteValue）/ 05-modcheat-ui（渲染+局部行更新+PANEL_QUICK_GROUPS 数据表）/ 06-traits（特质区+滚动保持）/ 07a-shell（root/错误收集器 mbCEPushError+badge 同步写+熔断 mbCEFuse）/ 07b-char / 07c-stage / 07f-pins（命名空间防重绑定）/ 09-exports（open force + mods 页跳刷新 + mbCEPushError/mbCEErrors API）
- 已实现的优化/功能：特质搜索+收藏、面板内错误收集器、面板状态持久化、能力项数据驱动重构、数值相对值修改、性能节流防抖、角色记忆/内层页签记忆、错误去重合并+时间戳、全部展开收起、折叠状态自清理、错误风暴熔断、局部行更新

## 6. 适配器清单（8 个）
枯木逢春 / 归途之书 / MLI / DomRobin / SmartPhone / DoLSims / Dol-Optimization / Wraith'sReflection；另 CombatTerminator、AutoClean 为文档化（纯原版键补丁模组，无自有持久键）。探测键全部零碰撞。

## 7. 关键数值口径（v1.8.14 + v1.8.19 用户指令定稿，勿再配回旧值）
- **无硬上限（999999 仅防误输入）**：beauty + physique（v1.8.19 用户点名"体能的上限怎么还有"，由 0-100 提为无上限）+ willpower/awareness/promiscuity/exhibitionism/deviancy（用户明确要求"无上限"）
- **保持原版语义**：purity = 0-2000（UI 显示 %）
- **技能/性技能/成绩/武器** = 0-1000（百分比量纲，全表审计通过）
- 模组数值：LostLamb doubt/fear/notice max 1000；TempleDuties archive.roof max 100、shelves max 999；次数类 999、进度类 100、金钱类 10 万-100 万、开关 0-1（80 处数值项审计通过）
- 错误归一化：`Error evaluating layer (spotlight|glow|linearGradient|flatColorOverlay) property src` → 归一为同源「特效层:DoLGameUI」→ 命中单源 ≥20 熔断

## 8. 测试体系与关键环境事实
- smoke_dom.js：jsdom 真实 DOM，13 节（13.3 钳制行为、13.4 错误折叠；12.1 非熔断期）；收尾用 `process.exitCode`（禁用 `process.exit`，会截断 stdout）
- **环境事实（易踩坑）**：node/eval 作用域无全局 `CSS`（`typeof CSS === "undefined"`）→ `CSS.escape` 判断必须 `typeof CSS !== "undefined"` 且**兜底分支字符串必须与主分支完全等价**（含前缀）；jsdom 只读属性赋值静默忽略（select.type 不抛错）；smoke 里错误注入用 `api.mbCEPushError`/`api.mbCEErrors()`（09-exports 暴露），非全局函数；smoke 11.2 全局熔断 30 秒会覆盖后续 13.x 断言（设计断言须兼容熔断期）
- **test_mce.js 31.3**：LostLamb fear 钳制断言已随七巡更新（999 写入 / 9999 钳 1000）

## 9. 错题本（工具坑库）
`C:\Users\27352\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.user_skills\doubao-self-improvement\references\tool-gotchas.md`
已存：CSS.escape 兜底分支必须生成等价完整选择器（ERR-2026-10-21）；自定义 DOM mock 只读属性语义 / PowerShell 内嵌 node -e 转义 / jsdom 只读属性静默 / gh CLI 未登录→git credential+REST / 中文 body 需 charset=utf-8 / Buffer 直发上传 / Compress-Archive 反斜杠 / github.com:443 断→Git Data API。

## 10. 用户工作流偏好（开发相关）
- 全中文 UI/回复；要可直接运行的成品不要教程
- AGENTS.md：「输入代码时先自检是否正确」
- 错误/工具坑必须入错题本（tool-gotchas）
- 开发工作流遵循 `C:\Users\27352\Doubao\skills`（tdd 红绿循环 / code-review 双轴审查 / handoff）
- 浏览器优先 lexmount/moli 无头浏览器（CLI/CDP）
- 评分走六维雷达（doubao-visualization）；发布走 git credential + REST 成熟流程

## 11. 未决事项 / 候选
1. **待办**：git 提交 + 发布 v1.8.22（release_v1811.js 模板）——v1.8.12~v1.8.22 全部改动未提交（HEAD=e883b43）
2. **等用户实测**：v1.8.22 zip 已交付（README 同步 + 文案去版本号 + 注册名实证），等反馈
3. **剩余候选（未实施）**：README 深度使用说明（评分 8.8 短板）；时间/声望快捷项（键结构复杂，未确定键名不猜）
4. **错题本已记（十/十一巡新增）**：搜索态懒渲染边界；持久化 filter 只写不读恢复缺口；留痕条目缺 t 时间戳导致裁剪排序失效
5. **十五巡备注**：GitHub API 60 次/小时限额（无 token），当轮实跑 8/9 渠道、框架渠道以本地 compareVersions 模拟验证（decl 5.5.2 == tag 5.5.2 判无更新）；定时任务每日 21:15 单次调用不撞限流

## 12. 其他产物
- `MapleBirchCE-新模组适配计划-2026-10-20.md`（仓库根，5 模组计划书，纯分析）
- 本文件即当前记忆存档本体
