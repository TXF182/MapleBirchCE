# MapleBirchCE 仓库（开发生产端）AI 协作纪律

> 工作区速览。完整权威纪律见消费端 `C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project\AGENTS.md`，冲突时以消费端为准。

## 目录职责（单文件夹闭环，零搬动）

- **本目录（生产端）**：源码 `javascript\src\*.js`、测试 `tests\`、工具 `tools\`（pack/release/push/audit/resolve/snap/核查）、对照源码 `tools\_modcache\`、版本双源（`01-core.js:3` MCE_VERSION + `boot.json:7` version）、git、CHANGELOG/README。
- **消费端（物理位置不变）**：`C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project` —— `game\` 游戏本体、`real_smoke.ps1`（moli 实机冒烟）、旧桥接 `dev.ps1`。
- 完整闭环入口（本目录即可跑完，消费端仅作脚本外部目标）：
  - `.\tools\run_all.ps1`：全链 8 步（build / `node --check` / ESLint 四规则 / DOM 冒烟 / 全量回归 / E2E / 性别集成 / **适配器声明一致性**）→ 末尾自动 `codegraph sync`。第 8 步 = `check_claims.js`（结构自洽，命中即 fail）+ `check_key_types.js`（类型形态，仅在 `tools\_modcache\STATE.json` 存在时跑，缺失则 WARN 跳过）。
  - `.\dev.ps1`：单元测试 → 全链（内含上述 7 步）→ 打包 verifier 4/4 + SHA256 → 复制 zip 装进消费端 game\（`$env:MCE_DOL_PROJECT` 可覆盖消费端路径）。
  - `.\real_smoke.ps1`：包装调消费端 real_smoke.ps1。
  - 远端 CI：`.github/workflows/ci.yml`（push main / PR / 手动）在 ubuntu-latest + node 22 上跑 `npm ci` + 同口径验证（无 moli / 打包 / codegraph / 原版 HTML）。

## 硬约束

1. 只改 `javascript\src\*.js`，绝不手改 `javascript\maplebirchce.js`（打包产物，由构建生成）。
2. 版本双源必须同步：`01-core.js` MCE_VERSION 与 `boot.json` version 一致。
3. 打包必须走 `tools\pack.ps1`（zip 条目正斜杠、verifier 4/4、SHA256）。
4. **不升版本、不发布、不擅自清理用户文件**——三者均需用户明确指令。
5. 改码前先 `tools\snap.ps1` 存基线快照；出现异常优先回滚到基线。
6. 发布通道：`node tools\release.js [--version <v>] [--dry]`（先 --dry 预览 body 非空）→ `node tools\push_api.js`；token 经 git credential fill 仅内存（gho_ 前缀）；github.com:443 常断走 API 通道；发布后回读 SHA。发布动作不可逆，先列清单再执行。
7. 交付前必跑 `.\real_smoke.ps1`；交付汇报按三份清单（改动点补丁/验证层/玩家路径走查）。

## 已知边界（防盲区）

- **声明类型必须匹配模组判据（v2.0 起的核心核查维度）**：SugarCube 的 `is` 等价 `===`。模组写 `<<if $X is 1>>` / `$X is true` 时，CE 若把 `X` 声明成 `boolean`，写入的 `true` 在模组侧恒为假——面板显示成功、功能静默失效（最隐蔽的一类）。判据：模组用 `1/0` 严格比较或数字哨兵 → 声明必须带 `numeric: true`（`04b-modcheat-write.js:106` 走 number 路径写 1）；模组用真值判定（`<<if $X>>`、`!V.X`）→ boolean 正确。取证用 `tools\check_key_types.js`（`blockOf()` 取真正包住 varPath 的对象块，`EXTS` 必须含 `txt/json5/html`——判定常藏在这些扩展名里）。既有先例：`04a-01-revelation.js` 的 `nkl_retaken`。
- **结构自洽用 `tools\check_claims.js`**（D1 跨适配器同 varPath / D2 同适配器重复 / D3 同 key / D4 levels-labels 数量 / D5 min>max）。`SHARED_OK` 白名单只放**已取证为逐项增删语义**的键（当前仅 `loveInterestList`，list 走 `cheatWriteListValue`）——新增白名单条目必须先取证写入语义，不能因为"不报了"就加。
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
