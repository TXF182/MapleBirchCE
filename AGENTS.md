# MapleBirchCE 仓库（开发生产端）AI 协作纪律

> 工作区速览。完整权威纪律见消费端 `C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project\AGENTS.md`，冲突时以消费端为准。

## 目录职责（单文件夹闭环，零搬动）

- **本目录（生产端）**：源码 `javascript\src\*.js`、测试 `tests\`、工具 `tools\`（pack/release/push/audit/resolve/snap/核查）、对照源码 `tools\_modcache\`、版本双源（`01-core.js:3` MCE_VERSION + `boot.json:7` version）、git、CHANGELOG/README。
- **消费端（物理位置不变）**：`C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project` —— `game\` 游戏本体、`real_smoke.ps1`（moli 实机冒烟）、旧桥接 `dev.ps1`。
- 完整闭环入口（本目录即可跑完，消费端仅作脚本外部目标）：
  - `.\tools\run_all.ps1`：全链 12 步（build + 结构门禁 / `node --check` / ESLint 八规则 / DOM 冒烟 / 全量回归 + 声明矩阵 / E2E / 性别集成 / **适配器声明 schema 校验 + 矩阵幂等 + 声明一致性** / **原版数字档位形态** / **覆盖率门禁** / **tsc 类型检查** / **键注册表一致性**）→ 末尾自动 `codegraph sync`。第 1 步 = `build_js.js`（段序唯一真源是 `javascript\src\manifest.json`，不一致即 fail；`--write-manifest` 登记新段）紧跟 `check_structure.js`（单段预算 400 行 / 续号命名 / 注册表容器重复声明 WARN，豁免写 `tools\structure-baseline.json` 的**预算值**）。第 5 步 = `test_mce.js` + `test_adapter_matrix.js`（声明驱动 5,806 断言）。第 8 步 = `validate_adapters.js`（`schemas\adapter.schema.json`）+ `gen_adapter_matrix.js --check`（漂移即 fail，须重跑生成器）+ `check_claims.js`（结构自洽）+ `check_key_types.js`（类型形态，仅在 `tools\_modcache\STATE.json` 存在时跑，缺失则 WARN 跳过）。第 9 步 = `check_vanilla_types.js`（07d-places PLACE_GROUPS 的数字档位声明 vs 原版 0.5.12.13 赋值形态：有 `is "…"` 字符串判定即 CONFLICT；原版 HTML 缺失时 SKIP）。第 11 步 = `tsc -p tsconfig.json`（allowJs+checkJs 查拼接产物，引擎全局声明在 `types\sugarcube-ambient.d.ts`，缺声明就补声明、不要删源码引用）。第 12 步 = `gen_key_registry.js`（`keys.registry.json` 423 条 vs `04a-*.js`，键改名报 `RENAMED` 并 fail；改完适配器先 `npm run keys:write`）。
  - `.\dev.ps1`：单元测试 → 全链（内含上述 12 步）→ 打包 verifier 校验（verifier-hub `zip-check-entries` 优先；本机无该包时自动走内置等价核对 = 条目集合精确匹配 + CRC 全量，判据相同，输出 `VERIFIER-FALLBACK` 明示）+ SHA256 → 复制 zip 装进消费端 game\（`$env:MCE_DOL_PROJECT` 可覆盖消费端路径）。
  - `.\real_smoke.ps1`：包装调消费端 real_smoke.ps1。
  - 远端 CI：`.github/workflows/ci.yml`（push main / PR / 手动）在 ubuntu-latest + node 22 上跑 `npm ci` + 同口径 11 步验证（build + 结构门禁 / syntax / ESLint / 适配器声明门禁（schema + 矩阵幂等）/ smoke / 回归 + 声明矩阵 / E2E+性别 / 稳定性循环 / tsc / 键注册表 / 覆盖率门禁 90/70/95），无 moli / 打包 / codegraph / 原版 HTML。

## 硬约束

1. 只改 `javascript\src\*.js`，绝不手改 `javascript\maplebirchce.js`（打包产物，由构建生成）。
2. 版本双源必须同步：`01-core.js` MCE_VERSION 与 `boot.json` version 一致。
3. 打包必须走 `tools\pack.ps1`（zip 条目正斜杠、verifier 校验（verifier-hub 优先 / 内置等价核对兜底，判据同为 4 条目全命中 + CRC）、SHA256）。
4. **不升版本、不发布、不擅自清理用户文件**——三者均需用户明确指令。
5. 改码前先 `tools\snap.ps1` 存基线快照；出现异常优先回滚到基线。
6. 发布通道：`node tools\release.js [--version <v>] [--dry]`（先 --dry 预览 body 非空）→ `node tools\push_api.js`；token 经 git credential fill 仅内存（gho_ 前缀）；github.com:443 常断走 API 通道；发布后回读 SHA。发布动作不可逆，先列清单再执行。
7. 交付前必跑 `.\real_smoke.ps1`；交付汇报按三份清单（改动点补丁/验证层/玩家路径走查）。

## 已知边界（防盲区）

- **声明类型必须匹配模组判据（v2.0 起的核心核查维度）**：SugarCube 的 `is` 等价 `===`。模组写 `<<if $X is 1>>` / `$X is true` 时，CE 若把 `X` 声明成 `boolean`，写入的 `true` 在模组侧恒为假——面板显示成功、功能静默失效（最隐蔽的一类）。判据：模组用 `1/0` 严格比较或数字哨兵 → 声明必须带 `numeric: true`（`04b-modcheat-write.js:106` 走 number 路径写 1）；模组用真值判定（`<<if $X>>`、`!V.X`）→ boolean 正确。取证用 `tools\check_key_types.js`（`blockOf()` 取真正包住 varPath 的对象块，`EXTS` 必须含 `txt/json5/html`——判定常藏在这些扩展名里）。既有先例：`04a-01-revelation.js` 的 `nkl_retaken`。
- **`check_key_types.js` 的四类判据与两条防线（v2.0.0.002 起，改判据前必读）**：① 显式赋值（`V.x =` / `$x =` / `<<set $x>>`）② `?? <字面量>` 惰性初始化 ③ TS 父键块内声明/字面量（`blockOf` 限定在真正包住 varPath 的对象块）④ **全库唯一类型共识**（按叶子名聚合整库 `.ts/.js` 的 `name?: type` 与字面量赋值，**类型集合必须唯一**才采信）。④ 必须叠加**父键归属防线**：证据文件 basename（**先剥 `.ts/.js` 再归一化去非字母数字**）要与**直接父键或祖父键**互为包含，否则 `MarginTrading.ts` 的 `opened: number` 会给 `Finance.bank.opened` 作证（`tests\test_keycheck.js` 有专门 fixture 拦这条）。基线：276 条 / CONFLICT 0 / STRICT 0 / WARN 1 / NO_EVIDENCE 51（81.5%）。**改进判据后必须同步跑 `node tests\test_keycheck.js`**——共识判据两次真实缺陷都是被这份 fixture 抓出来的。
- **两个临时对照目录（未按版本目录规范落位，已登记进 `STATE.json` 并标记「未映射」）**：`04a-13-fert.js` 的对照源码在 `tools\_modcache\fert_tmp\`（FertilityExpansion 1.7.0，适配器 id `fertility-expansion`）；`05b2-modcheat-attitude.js` 的态度门槛取证参考 `tools\_modcache\fsa_tmp\`（Free Speech Attitudes 1.0.0，无对应 CHEAT_ADAPTERS 适配器）。规范落位应为 `fert170` / `fsa100`，但在 `tools\modcache_state.js` 的 MAP 未登记前直接引用现值路径；`--check` 门禁已恢复绿（13 条目）。
- **声明 / 构建 / 断言 / 类型四处新门禁（v2.0.4 P0-P4，改它们前必读）**：① 段序真源 `javascript\src\manifest.json`（**66 段** + 层标签），新增段必须登记，否则 build fail；层序回退（如把 `04a-*` 排到 `05*` 之后）也 fail；单段超 400 行即 fail（`structure-baseline.json` 的 `lineAllowlist` 现为空，无豁免）。② `varPath` 形状判据必须按**运行时语义**来：`cheatResolvePath`（`04b-modcheat-write.js:39-53`）只按 `.` 切段，段名允许中文 / 连字符 / 纯数字（数字段索引数组），**方括号 `a[0]` 会被当字面键名导致写入落空** → schema 用 `^[^.\[\]\s]+(\.[^.\[\]\s]+)*$`；按"JS 标识符"写规则会把 deadwood `featsBoosts.upgrades.deadwood-*`、dolopt 中文键、cattery `catArr.0.*`、farm `plots.farm.0*` 全误判（首轮 30 FAIL 里 29 条就这么来的）。③ `tests\data\adapter_matrix.json` 是生成产物：改完 `04a-*.js` 必须跑 `node tools\gen_adapter_matrix.js` 并提交，否则第 8 步 `--check` 报漂移；矩阵测试的 `undo` 断言比的是**写入前初值**（不是上一次值），判定「条件不满足的 sync 不落地」用 `after !== true`（`sync.clear` 会把目标置 `null` 而非删除）。（D1 跨适配器同 varPath / D2 同适配器重复 / D3 同 key / D4 levels-labels 数量 / D5 min>max）。`SHARED_OK` 白名单只放**已取证为逐项增删语义**的键（当前仅 `loveInterestList`，list 走 `cheatWriteListValue`）——新增白名单条目必须先取证写入语义，不能因为"不报了"就加。④ **src 侧类型分账**：`tsconfig.src.json` 只吃 `tools/_srctypes/src-united.js`（`tools/check_src_types.js` 按 manifest 拼出的联合文件，**join 后 SHA 必须等于产物 SHA**，不等说明改了 src 没重建）。**不要**把 `include` 改回 `javascript/src/**/*.js`——src 段是同一 IIFE 的片段（`00-preamble.js` 开括号、`09-exports2.js` 收括号），逐文件编译只出 `TS1005/TS1128/TS1109` 结构噪声。基线 `tools/src-types-baseline.json`（26 文件 / 169 条真债务）是棘轮：**任何文件错误数上升即 fail，只准用 `--write-baseline` 在债务下降时收窄并在评审里说明**；隐式 any 家族（`TS7006/7005/7034/7053/7023`，实测 1019 条）不计账，别把它们塞进基线把真债务淹没。
- `tools\check_coverage.js` 只产出**人工参考候选**（有 NOISE 黑名单降噪），不作门禁；`tools\_modcache\` 只保留当前对照版本。**权威现状表 = `tools\_modcache\STATE.json`（由 `tools\modcache_state.js` 生成，勿手改）**：`node tools\modcache_state.js` 刷新盘上事实，加 `--keys` 附带键数定案（audit + resolve），加 `--check` 校验表是否已滞后（滞后 exit 1，可做门禁）。手写版本表（本文档旧版、消费端 AGENTS.md §5、技能文档）一律滞后，改版后以 STATE.json 为准。
- STATE.json 里 `versionConsistent=false`（目录名口径 vs 包内 boot.json 版本不一致）需人工确认哪个是当前对照版本；`keys` 的 `R/W/S/X` 分别是待复核/弱证据/换源核对/判删，**只有 `X`（REMOVE）是删除信号**。
- audit 标"声明缺失"多为动态键拼接盲区（如 `$featsBoosts.upgrades['deadwood-' + attr]`）——源码实证后走 `tools\resolve_missing.js` 定案；featsBoosts 类动态键 **KEEP 严禁 REMOVE**。
- 声明路径含数字下标（`plots.farm.0.greenhouse`）时，源码常写作 `$plots.farm[0].greenhouse` 或遍历元素 `_plantbed.greenhouse`；`resolve_missing.js` 的方括号改写与下标通配规则专门处理这两类，**不要因为它们"字面搜不到"就删声明**。
- git 不在 PATH：用绝对路径 `C:\Users\27352\Git\cmd\git.exe` 调用；发布/对齐仍走 Node 通道。
- `dev.ps1` / `real_smoke.ps1` 的消费端路径默认本机，换机用 `$env:MCE_DOL_PROJECT` 覆盖（**不要改脚本里的默认值**）。
- 测试里的原版游戏 HTML 路径用 `$env:MCE_DOL_HTML` 覆盖；该文件缺失时 smoke 的 19.5–19.8、19.14b 与性别集成显式 SKIP（api 层断言照常强制），**不得把 SKIP 当通过**。
- jsdom 在根 `package.json` devDependencies（`npm ci` 即装）；`tests/node_modules` 属历史残留，勿作为依赖来源。
- `githooks/pre-commit` 为 **fail-closed**：无 `powershell.exe` 时回落 `pwsh`，两者都没有则阻止提交（不再静默跳过整条验证链）。
- 测试路径与玩家实际路径不一致是历史最大盲区（框架恋爱播放器），自查必须覆盖玩家实走路径。
