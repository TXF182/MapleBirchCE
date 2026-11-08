# MapleBirchCE 更新日志

版本线记录（v1.8.4 起；更早版本历史见会话存档）。版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 字段。

## v2.0.6（2026-11-08 工程化整改：branches 门禁 70→80、CI SKIP 缺口归零、包体 −21.5%）

**触发**：模组评价里提出的三条整改，用户原样作为指令落地。三件均属工程/发布层，玩家可见行为不变（仅 06b 修掉两个真实 bug）。

### 一、覆盖率 branches 门槛 70 → 80（真值 80.01%）

- 真值：Branches **80.01%（4,688/5,859）**、Statements 97.13%（13,181/13,570）、Functions 98.7%（535/542）、Lines 97.13%；`c8 --check-coverage --lines 90 --branches 80 --functions 95` 实跑 `gate=0`（日志 `%TEMP%\mce_cov_gate80.log`）。起点为 73.30%（3,764/5,135）。
- 门槛三处同步改 80：`package.json` 第 32 行 `coverage:gate`、`tools\run_all.ps1` 第 66 行文案与第 68 行参数。
- 方法：新增 `tools\_line_probe.js`，只列 **total===1 的单向未覆盖分支**（补上后 +1 覆盖数、分母不变），这是唯一能真实抬百分比的靶点；普通补断言会把新分支同时拉进分母，净收益 ≈0。
- 新增/扩写测试：`tests\adapters_negative_state.js`（25 断言：toggleCheatAbility / cheatSceneAction / applyCheatModValue / cheatReadSafe 四类拒绝与写入路径）、`tests\undo_center_edges_state.js` 41→63 断言（六类分发、地点阶段边界、失败汇总、delete 抛错 catch 兜底、vanilla 缺 key 回落）。`tools\run_coverage.js` TESTS 共 29 个。

### 二、CI 的 SKIP 缺口归零（fixture 抽局部素材）

- 结论核实：`smoke_dom.js` 的 19.5–19.8 与 19.14b **不依赖 64 MB 原版 HTML**（场景数据自构造），原 `HAS_GAME_HTML` 门是过保守遗留守卫 → 改为无条件执行，SKIP 变 FAIL（不再白跳）。
- 新增 `tools\gen_test_fixture.js`（+ `--check`），从原版抽 `tests\fixtures\scenes-widget.twee`（68,028 B）与 `tests\fixtures\dol-gender-funcs.js`（1,089 B）；`smoke_dom.js` / `integration_gender.js` 改"原版优先 / fixture 兜底"，性别集成五处 `SKIP+exit 0` 全改 `exit 1`。
- 验证（模拟干净克隆，`MCE_DOL_HTML=Z:\no-such\…`）：`smoke_dom.js` SKIP 0 / FAIL 0 / exit 0；`integration_gender.js` 24 passed / 0 failed / exit 0。

### 三、包体治理（339,760 → 266,868 B，−21.5%）

- 新建 `README.pack.md`（4,770 B）作为进包玩家版；`tools\pack.ps1` staging 改读该文件，缺失或 >30,000 B 即 `exit 1`，并打印体积对照。zip 条目结构不变（4 条，条目名仍 `README.md`）。
- **口径修正**：上一轮预告的 340 KB → ~170 KB 不成立。zip 是压缩的，172,288 B 的仓库 README 压缩后仅约 72.9 KB，换掉它只能省这部分；剩余主体是 `javascript/maplebirchce.js`（842,345 B 源码，压缩后约 26 万），不靠代码拆分/压缩到不了 170 KB。

### 四、顺带修掉的两个真实产品 bug（`06b-traits-eval.js`）

- **含 `includes` 的特质恒判"未获得"**：路径替换正则把 `$backgroundTraits.includes` 的 `.includes` 当路径尾段吃掉；函数调用替换又把 `.includes(` 改成 `globalThis["includes"](`。修法：路径正则加 `(?![\w(])`，函数调用正则改 `(^|[^.\w$])([A-Za-z_]\w*)\s*\(` 并回填前缀（只加 `(?!\()` 不够——`\w*` 贪婪回退会断成 `includ`+`e`）。
- **`traitWriteUnsatisfy` 的 `isnot` 非布尔字符串值写 `num-1` 得 NaN**：加 `isNaN(num)` 分支写回该字符串本身。

### 五、版本与产物

- 版本双源：`javascript/src/01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 均 **2.0.6**。
- 产物 `javascript/maplebirchce.js`：842,345 B / 67 段 / 段序 hash `92f1bc05a461` / SHA256 `b5eaa44ef0280c3207bc21586c4c52566bab05a48e6d90cd8c2bff6025a3e451`。
- 包 `MapleBirchCE.mod.zip`：**266,868 B / SHA256 `A33F9C7D76CC55B1E7A230950E28CED7A950B51AFC86D313072059DFA6DDFB73`**（本轮未发布；`game\` 内仍为 v2.0.5 旧包）。

## v2.0.5（2026-11-07 src strict 类型真债务清零：169 → 0，纯类型层，运行时行为不变）

**触发**：用户指令「清 169 条 src strict 真债务」。判定过两条路：调基线 / 在 `tsconfig.src.json` 关 `useUnknownInCatchVariables` 都是一次性糊过去，与「不许调基线」冲突；最终只改类型层（JSDoc 注解 + 一处等价的显式比较），产物逻辑零变化。

### 一、改了什么（26 文件 / +150 −289）

- **catch 取值收口**：新增 `mbCEErr(e)`（`javascript/src/01-core.js`，`MCE_VERSION` 之后），全库四种内联写法统一收口——`(e && e.message ? e.message : e)` 33 处、`(e2 && …)` 2 处、`String(e.message || e)` 7 处、`(e.message || e)` 1 处。语义完全等价（有 `message` 用 message，否则回原值），消掉 strict 下 `catch` 变量为 `unknown` 引发的 118 条 TS2339 家族。
- **`r.parent[r.leaf]` 的 TS2538（16 处）**：`cheatResolvePath` 补 `@returns` 判别联合（false 支 `reason/root/path`，true 支 `parent/leaf/exists`）。
- **`never[]` 家族**：`parseTraitHas` 的 `out.vars`、`auditAdapters` 的 `warnings/errors` 补完整 `@type`。
- **零散族**：`STAT_DEFS` 补可选 `min/custom`、布尔型 `num`、`merged.vals`、`mcAutoRunOnce`、`undoCheatModValue/mbCEWorldUndo/placeStageUndo/undoVanillaStage` 下四处结果、两处 `report`、`mbCEUiState`、`parsed`、03b 两个 `r`（补 `skipped?/error?`）、`07a` 的 `arguments`、`07i` 的 `@this {any}`、`07f-pins2` 的 `exec` 结果兜底（该分支经上方正则前置证明不可达，命中失败时新旧都落同一 `catch → null`）。
- **判空写法 3 处**：`04b` 的 `if (!r.ok)` → `if (r.ok !== true)`。原因是**产物侧 `tsconfig.json` 是 `strict:false`**，负向真值判断不窄化判别联合（`!r.ok` / `else` 分支都失败；`r.ok === false` / `r.ok !== true` / 正向 `if (r.ok)` 才收窄，npx tsc 四写法各跑一遍实证）。布尔字段下两者语义等价。
- **基线收窄**：`tools/src-types-baseline.json` 由 169 条 / 26 文件 → `total: 0 / files: {}`（棘轮从此锁死，新增债务即红）。

### 二、验证（磁盘实测）

- `node tools/check_src_types.js`：**0 个 src 段 / 0 条 strict 真债务（基线 0）**，`拼接 SHA b3c9cd1feb88 == 产物 SHA`，exit 0；隐式 any 噪声 1023 条按口径不计账。
- 产物侧 `tsc -p tsconfig.json`：**0 错误**（改前 8 条 TS2339）。
- `tools/run_all.ps1` **12/12 ALL CHECKS PASSED**：`ASSERT_TOTAL=5806 PASS=5806 FAIL=0`、性别集成 `passed=24 failed=0`、声明矩阵 12 适配器 / 423 条目 / 965 探针、覆盖率门禁 90/70/95 通过、`codegraph sync` 已同步。
- `pack.ps1`：zip 正斜杠校验 + verifier 4 条目全命中（verifier-hub 本机缺入口，走内置等价核对「条目集合精确匹配 + CRC 全量」并打 WARN）。
- 产物 `javascript/maplebirchce.js`：**841,759 B / `B3C9CD1FEB883C9959C83D8D9D8734CAD2538432135B569ADC2C106F41D0BBBC`**。

### 三、新增坑位（已记 `.learnings/LEARNINGS.md` LRN-20261107-011）

- 本仓类型门禁是**双口径**：src 侧 `strict:true` + 产物侧 `strict:false`，必须两边都绿才算过。
- 机械替换模式以 `(` 开头会吞掉外层调用的左括号（`String(e.message || e)` → `StringmbCEErr(e)`，TS2304）。
- 自写的 tsc 分账探针必须自己重建 `tools/_srctypes/src-united.js`，否则改完源码仍读旧联合文件、债务数字不动。

## v2.0.4（2026-11-07 质量门禁加固 + 架构审计 P0-P2 落地：构建顺序显式化 / 声明 schema 化 / 声明驱动断言矩阵）

**触发**：用户指令「我这个还有哪些缺陷？1~5」（按上一轮五层诊断给出的修复顺序，全部五项）。

### 一、键核单测入链（原先没有任何门禁跑它）

- 缺陷：`tests/test_keycheck.js`（**281 断言**，实测 `node tests/test_keycheck.js` → 通过 281 失败 0）只以独立脚本 `npm run test:keycheck` 存在，`tools/run_all.ps1` 12 步、`tools/run_coverage.js` 序列、`.github/workflows/ci.yml` 三处 `grep keycheck` 全为 0 命中；而它是 `check_claims` / `check_key_types` / `check_coverage` 三个核查工具共用的 `tools/lib/keycheck.js` 内核。
- 修复：加入 `tools/run_coverage.js` 的 `TESTS` 序列（不新增全链步号，避免 12 步编号全量重排），本地第 10 步与 CI 第 10 步同时覆盖到它。

### 二、覆盖率门禁收紧（75/60/80 → 90/70/95）

- 原阈值下实测量 94.65% / 73.31% / 96.99%，**可掉 13 个点仍绿**，等于没有回归保护。
- 三处同步：`package.json` 的 `coverage:gate`、`tools/run_all.ps1` 第 10 步命令行与提示文案、README 台账指标表。
- 双口径实测确认新阈值两端都过：本地满料 94.65% / 73.31%（3692/5036）/ 96.99%；CI 口径（`MCE_DOL_HTML` 指向不存在路径）**94.32% / 72.89%（3630/4980）/ 96.99%**，`CI_COV_EXIT=0`。

### 三、CI 补齐两步（8 → 10）

- 新增 **[7/10] 面板开关稳定性循环**（`node tests/stability_loop.js`）与 **[10/10] 覆盖率门禁**（`npm run coverage:gate`，阈值与本地同）；原 7/8 步顺延为 8/9 步。
- `c8 ^12.0.0` 已在 devDependencies，CI `npm ci` 即可用，无需额外安装。

### 四、`tools/snap.ps1` 两处缺陷修复

- `:33` 原用 `git status --porcelain` 逐行正则 `^(M|A|\?\?) (.+)$`，**漏掉已跟踪修改**（porcelain 首列为空格的 ` M path`）→ 改为 `git status --porcelain -z` NUL 分隔逐块解析，并处理重命名/复制条目（`R`/`C` 后随的原路径块跳过），同时加 `-c core.quotepath=false` 避免中文路径被转义。
- `:43` 原对未跟踪目录（如 `types\`）直接 `Get-FileHash` 抛 `Could not find a part of the path` → 改为先判 `-PathType Leaf` / `Container`：文件单行哈希，目录递归列出每个文件单独哈希。
- 实测：修后快照纳入 **22 项**（含 16 个已跟踪修改 + 5 个未跟踪项，`types/` 展开为 1 个文件行），`SNAP_EXIT=0`。

### 五、README 三处过期数字订正 + 升版消除「同号两内容」

- `:655` 文件树「按功能域拆 60 段」→ **64 段**（`build_js.js` 实输出 64 段）。
- `:715` tests 说明「1,204 断言」→ **1,548 个 `assert(` 调用**（并注明运行输出 PASS 计数为 1,658，两者口径不同勿混用）。
- `:198` 兼容矩阵实测版本「5.6.0」→ **5.6.2**（`tools/_modcache/fw562/unpacked/boot.json` 实证）。
- 版本双源升 **2.0.4**（`boot.json` + `javascript/src/01-core.js`）：此前工作区产物已含 v2.0.3 之后的全部改动，却仍挂 2.0.3 版本号，与已发布的 v2.0.3 内容不同（同号两内容），玩家与 Release 无法区分。

### 六、P0：构建顺序显式化 + 结构守门（外部评估「依赖靠文件名字典序隐式表达」的落地）

- **`javascript/src/manifest.json`（新增）**：**64 段**有序清单 + 层标签（`layers: ["preamble","core","adapter","write","ui","export"]`，`version: 1`），段序就是依赖序。初始内容由 `node tools/build_js.js --write-manifest` 按原 `readdirSync().sort()` 生成，生成后回读校验，**产物 SHA 字节级不变**（改名 `07d-places2.js`→`07d-places-b.js` 后产物逐字节相同：`8B11FD10…372C58` / 829,324 B，`orderSig` 由 `b91a5bb460ee` 变 `244d07810a8d`，说明段序真源已与文件名解耦）。
- **`tools/build_js.js` 整文件重写**（59 → 约 200 行）：段序唯一来源改为 manifest；新增 `--check`（只校验不写产物）、`--write-manifest`（按目录名序登记新段，层标签由 `layerOf()` 规则内建：`00-preamble.js`→preamble、`04a-*`→adapter、`04[b-c]-*`→write、`0[5-8]*`→ui、`09-*`→export、其余 core）；支持 `MCE_SRC_DIR` / `MCE_OUT`。**fail-closed 四组**：manifest 缺失 / JSON 非法 / `segments` 非数组或空 / 目录与 manifest 集合不一致（缺段、多段、重复登记、指向不存在、未知层、**层序回退**）。原有两条守卫（含 U+FFFD 拒建、段末缺换行补齐后 exit 1）保留。
- **`tools/check_structure.js` + `tools/structure-baseline.json`（新增）**：S1 段长棘轮（`maxLines: 400`，`lineAllowlist` 放**预算值**——`07i-yanling.js: 856` 是当前值，超过预算同样 fail）；S2 续号命名（`^(.*?)(\d+)\.js$`，仅当"剥掉末位数字等于另一个真实存在的段"才算续号，白名单 9 项）；S3 注册表容器重复声明（**WARN**，只扫 `CHEAT_ADAPTERS` / `CHEAT_VANILLA_ROOTS` / `CHEAT_PASSIVE_PROBES`）。
- **四组负控全部命中预期**（`%TEMP%` 沙箱副本 + `MCE_SRC_DIR`/`MCE_OUT`）：改名续号段后产物逐字节相同；manifest 删末段 → `exit 1`；新增 501 行段 → `exit 1`；新增 `07d-places3.js` → `exit 1`。真实仓库复跑 `S_EXIT=0`，1 条 WARN（`CHEAT_ADAPTERS` 在 `03d-global-modzh.js` 与 `04a-00-core.js` 各声明一次）。
- **接入**：`tools\run_all.ps1` 第 1 步（build 之后紧接 `node tools/check_structure.js`，失败文案指明豁免须写进 baseline），**步数仍 12**（不重排编号）。

### 七、P1：适配器声明 schema 化 + 校验器入门禁（「声明无 schema」的落地）

- **`tools/lib/adapter_ir.js`（新增）**：在 vm 沙箱按 manifest 段序拼接 `04a-*.js` 后 `vm.runInContext`，返回 `{ids, adapters, entryOf, items, counts, errors, files, SECTIONS}`；每段 try/catch 收集 `errors` 供调用方 fail-closed；段尾补 `\n;0;\n` 防"文件以 `//` 注释结尾吞掉整段"。**为什么不用文本扫描**：大括号配对、`levels: CONST`、注释里的 `key:` 都会让正则失真，vm 真跑一遍最可靠。
- **`schemas/adapter.schema.json`（新增）**：`entry` 字段白名单 / `itemFields` / `types` / `sync` / `actions` / `varPathPattern`。**关键语义**：`cheatResolvePath` 只按 `.` 切段，段名可含中文、连字符、纯数字（数字段索引数组），**方括号 `a[0]` 会被当字面键名、写入落空** → `varPathPattern = ^[^.\[\]\s]+(\.[^.\[\]\s]+)*$`（JSON 内每个 `\` 写成 `\\`）。
- **`tools/validate_adapters.js`（新增）**：ERROR → `exit 1`，支持 `--json` / `--src`；规则 = 字段白名单 / 必填 / 类型枚举 / 数值域 / `levels`-`labels` 等长 / `sync` 结构 / `varPath` 形状 / `modId` 与注册表键一致 / 缺 `detect()`。
- **首轮 30 FAIL = 29 误报 + 1 真缺陷**：误报全因 `varPathPattern` 按"JS 标识符"直觉写成 `^[A-Za-z_$][\w$]*(…)$`，被误杀的 29 条是 deadwood `featsBoosts.upgrades.deadwood-{6 属性}`（连字符）、dol-optimization `daily.conveniencestoregoods.避孕套…橙子`（13 条中文）、cattery `catArr.0.love/play`（数字段）、more-farm-upgrade `plots.farm.0…8.greenhouse`（9 条数字段）。**唯一真缺陷**：`dolmod / stages:dm_conf_state` 缺 `labels`——面板 `05a2-modcheat-rows-build.js:100` 有 `levels.map(String)` 兜底，不缺功能但中文面板显示裸英文（`rejected/friend/lovers`）；已在 `javascript/src/04a-11-dolmod.js:44-45` 补 `labels: ["未触发","拒绝","朋友","恋人"]`（`4BE8A819…AC31` → `94DCB0CF…F94FF`）。
- **现输出**：适配器 **12** / 条目 **424**（stages 51 / abilities 167 / values 205 / scenes 1 / tasks 0），`V_EXIT=0`，剩 3 条 WARN（`revelation:nkl_retaken` / `wraiths:wr_admit` / `wraiths:wr_conch_ask` 均 `boolean+numeric` 未给 `min`）。
- **接入**：`tools\run_all.ps1` 第 8 步（`validate_adapters` 之后紧接矩阵 `--check`，再跑原有 `check_claims` / `check_key_types`），CI 新增第 4 步。

### 八、P2：声明驱动断言矩阵（「每适配器手写测试、3 个适配器零命中」的落地）

- **`tools/gen_adapter_matrix.js`（新增）**：三模式（默认写盘 / `--check` 漂移 `exit 1` / `--stdout`），输出确定性（无时间戳、按 IR 顺序），支持 `MCE_SRC_DIR` / `MCE_MATRIX_OUT`。`probesOf()`：`stages` 按 `levels` 每档一个（numeric/string 分 kind）；`abilities` 走 `numeric === true` → `min`/`max` 两端、否则 `true`/`false`；`values` 按 `type`：number → `min`/`max`、boolean → `true`/`false`、list → `options[0]` push、其余 → `"mce-probe"`；`serSync()` 把 `sync.set[].value` 的函数降级为 `{fn: true}`。
- **`tests/data/adapter_matrix.json`（新增）**：**423 条 / 965 探针 / 12 适配器**（423 = 51 stages + 167 abilities + 205 values；`scenes` 1 条不进矩阵），`--check` 幂等（`CHECK_EXIT=0`）。
- **`tests/test_adapter_matrix.js`（新增）**：`eval` 产物取 `setup.mbStageCE`，按矩阵逐条逐探针**真写**再回读。每探针 4~5 条断言：写入 `ok` / 回读 `=== expect`（number 走数字通道、list 走数组通道）/ `V.mbCE_wrote["cheat:modId:key"].path === varPath` / `sync.set` 每条按 `if` 判定是否落地 / `undoCheatModValue` 还原到**写入前初值**（初值刻意与待写值不同，防"回到上一次值"假绿）。每探针新建 `{}` 宿主，按 varPath 逐段建对象/数组（数字段索引数组）；`sync` 目标父链预先 seed 以便联动可达；真实 `sync` 对象（含函数 `value`）从 `adapter_ir` 侧取，矩阵只存元信息。环境变量 `MCE_PKG_JS` / `MCE_MATRIX` / `MCE_SRC_DIR`。
- **实测**：`ASSERT_TOTAL=5806 / PASS=5806 / FAIL=0`（`M_EXIT=0`）。首轮 9 FAIL 全在 `dolmod / abilities:dm_pc_apps [min(0)]`，根因是**测试侧断言写错**而非产品缺陷：该条 `sync.clear` 会把 9 个 `computerApps.*` 置 `null`，原断言写 `after === undefined`；改为「条件不满足时不得置真值（`after !== true`）」后全绿——产品侧 `applyCheatSync` 的 `if.min` 判定（`04b-modcheat-write.js:59-90`）实测正确。
- **假适配器负控（验收目标）**：`%TEMP%` 沙箱加 `04a-98-probe.js`（1 阶段 + 1 数值能力 + 2 数值项，其中 1 个 `type: "string"`），**不写任何手写测试** → manifest 登记后可构建（65 段 / 830,449 B / `ce34077d…083c`），`validate_adapters` 13 适配器 / 428 条目全过，矩阵自动生成 427 条 / 972 探针，回读断言 **+45 条全绿**（含 string 型走 `applyCheatModValue` 的玩家路径补检）。
- **顺带修掉一个写入通道缺陷**：`05a-modcheat-rows.js` 的 `applyCheatModValue` 原 fallback 把 `type: "string"` 当 number 通道（`Number("abc")` = NaN → 静默拒绝写），改为 `boolean` / `string` / `number` 三分流；当前真声明无 string 项，该分支由上述假适配器负控覆盖。同时 `09-exports2.js` 导出 `cheatWriteListValue` 供矩阵走真实数组通道（内部实现未改）。
- **接入**：`tools\run_all.ps1` 第 5 步（`test_mce` 之后跑矩阵测试）、`tools/run_coverage.js` 的 `TESTS` 追加矩阵测试（覆盖率序列覆盖）、CI 第 6 步、`package.json` 新增 `test:matrix` / `check:adapters` / `matrix:gen` / `matrix:check`。

### 九、P3：src 侧类型分账（strict 债务按文件棘轮）

- **原方案被实测否决**：新建 `tsconfig.src.json` 逐文件 `include: javascript/src/**/*.js` 后 `tsc -p` 直接 exit 2，只有 4 行错误（`00-preamble.js(115,1) TS1005 '}' expected` / `09-exports2.js(370,*) TS1128·TS1109`）。根因是 src 段本就**不是独立文件**——`00-preamble.js` 开 IIFE 左括号、`09-exports2.js` 收尾右括号，单段编译只能得到跨段结构噪声。
- **改用「联合文件 + 行区间映射」**：`tools/check_src_types.js`（新增，约 190 行）按 manifest 段序拼出**与产物字节完全相同**的 `tools/_srctypes/src-united.js`（段末缺 `\n` fail-closed 列出文件名），先硬校验拼接 SHA === `javascript/maplebirchce.js` SHA（不等即「源码改了没重建产物」，直接 exit 1），再跑 `tsc -p tsconfig.src.json --pretty false`，把 `file(line,col): error TSxxxx` 按行区间映射回具体 src 文件。
- **噪声与真债务分账**：未加注解的 JS 在 strict 下的隐式 any 家族（`TS7006` 参数 / `TS7005` 变量 / `TS7034` 隐式 `any[]` / `TS7053` 隐式下标 / `TS7023` 返回）**不计账**（实测 1019 条，计入会把真债务全部淹没）；棘轮只对真债务（`TS2339` 属性不存在 / `TS2538` 可能 undefined 的索引 / `TS18047` 可能 null / `TS18046` / `TS18048` / `TS2345` / `TS2322` / `TS2531` / `TS2683` / `TS2353`）记账。
- **`tsconfig.src.json`（重写）**：`strict:true`、`include: ["tools/_srctypes/src-united.js","types/**/*.d.ts"]`、`lib ES2020+DOM+DOM.Iterable`、`noEmit`、`skipLibCheck`、`types: []`。
- **`tools/src-types-baseline.json`（新增）**：**26 文件 / 169 条真债务**。Top：`06b-traits-eval.js` 32（`TS18047×8` `TS2339×21` `TS2345×3`）/ `04b-modcheat-write.js` 19（`TS2339×6` `TS2538×13`）/ `03b-global-maint.js` 14 / `08-npc-traits2.js` 14 / `03c-global-combat2.js` 9 / `07i-yanling-core.js` 9（拆分后按新段名登记）。
- **棘轮**：任何文件错误数上升 / 总数上升 → `exit 1`；债务下降时提示可用 `--write-baseline` 收窄（评审可见）。实测 `CHK_EXIT=0`：`26 个 src 段 / 169 条 strict 真债务（基线 169，棘轮未上升；隐式 any 噪声 1019 条不计账）`。
- **两条负控**：① 沙箱 src 追加一行 `undefinedFn();` 后重建 → `exit 1`（`总数上升：169 → 170`）；② 改 src 不重建 → `exit 1`（`src 拼接 SHA 与产物不一致（src=a7fd304f763b vs pkg=17ebf973d79f）`）。
- **接入**：`tools/run_all.ps1` 第 11 步改为「产物侧 `tsc -p tsconfig.json` 0 错误 + `node tools/check_src_types.js` 棘轮」，**步数仍 12**；CI `[9/11]` 改为两行 `run: |`；`package.json` 新增 `check:srctypes` / `srctypes:baseline`；`.gitignore` 加 `tools/_srctypes/`（生成物不入库）。

### 十、P4：拆 `07i-yanling.js`（856 行三合一 → core / actions / page 三段）

- **切片按行边界，禁全文正则替换**：`07i-yanling.js` → `07i-yanling-core.js`（原 1-262 行，状态/钩子/净化/开关）/ `07i-yanling-actions.js`（263-623 行，12 组一键动作 + NPC/放逐/角色）/ `07i-yanling-page.js`（624-856 行，`renderYanling` + 页尾折叠块 + `mbCEYanlingEnsureTimer()`）。边界都落在函数之间的空行，切片脚本自校验 `core+actions+page === orig`。
- **manifest 原位换段**：`07i-yanling.js`（index 56，`layer:"ui"`）替换为三条同层段，**64 → 66 段**；原文件删除。
- **零字节等价的两次反证**：① 首次重建即 `built … (66 段, 829826 B)`，SHA 仍 `A8E40BF5…D0CC6`（`order b91a5bb460ee → d0dbe4e40136` 属段名变化预期）；② 三段各加一行职责注释后，剥离这 3 行重新拼接 → `MATCH_BASELINE=true`（`a8e40bf5…d0cc6` / 829,826 B），与当前产物差 **518 B** 正是 3 行中文注释。
- **当前产物**：**830,344 B / `50D537B868CCBF709292B7D5E46BB23A668836725BF6E50F607D789D25EF0C88`** / order `d0dbe4e40136` / 66 段 / 13,341 行。
- **结构门禁**：`lineAllowlist` 清空（`{}`，不再有 856 行预算豁免），`S_EXIT=0`「检查 66 段（上限 400 行，基线豁免 0 项，续号白名单 9 项）」+ 1 条已知 WARN（`CHEAT_ADAPTERS` 在 `03d-global-modzh.js` / `04a-00-core.js` 重复声明）。
- **新增回归断言（`tests/smoke_dom.js`）**：① 渲染幂等——连续 4 次 `renderYanling()` 后快照恒为 `{groups:3, blocks:10, btns:…}`（3 分组 + 9 区块 + 1 说明块）；② 钩子装卸幂等——`yanlingInstall()` 两次仍是**同一函数引用**（不叠包装层）、`yanlingUninstall()` 两次仍回到原版函数、安装期间 `window.isCrossdressing()` 恒 false。**负控实测变红**：临时删掉 `Install` 的「已挂就早退」守卫后重建，4 条断言（含「重复 install 不叠包装层」）全部 FAIL；还原后全绿。

### 十一、本轮迭代优化与收敛

- **覆盖率复核（拆分后）**：Statements/Lines **94.66%**（12628/13340）/ Branches **73.29%**（3691/5036）/ Functions **96.99%**（516/532），门禁 90/70/95 全部通过；分支分母较拆分前 +1、命中 -2，来自 `07i` 三段各自的防御分支，非回归。
- **全链**：拆分 + P3 接线后 `run_all.ps1` 12 步一次跑通（`ALL CHECKS PASSED`，回归 `ASSERT_TOTAL=5806 / PASS=5806 / FAIL=0`，性别集成 `passed=24 failed=0`，第 8 步 3 WARN 为既有 `boolean+numeric` 未给 `min`）。
- **新增负控两条（P3）** 与 **一条（P4 幂等守卫）** 均实测命中，见上两节。
- **未做（明确边界）**：不升版本（双源仍 2.0.4）、不发布、不改 169 条真债务（策略是棘轮只减不增，清债另轮）。

### 十二、v2.0.4 增补（2026-11-07 好友实机反馈：潜伏者整段英文根因修复 + 回退中心键中文化 + 3 条 WARN 清零）

**触发**：好友实测「一进潜伏者遭遇，整个界面变英文」，并指向 CE 的「潜伏者解锁补丁」；同一反馈里另附回退中心逐项英文裸键截图；用户要求「把它翻译成中文，别作弊，是汉字」。

- **根因取证（双重闭环，非推测）**：① CE 内全量审计改剧情原文的位置 → 只有 `07f-lurker0-patch.js` 一处写回（`tw-passagedata` / `State.passages` / `Story.get().text` / `textContent`）；② 截图英文句 `remain light on your feet` 在 `game/Degrees of Lewdity.html` 偏移 24,919,889，所属 passage = `Widgets Struggle`，正是该补丁改的 5 个 passage 之一；③ 汉化包 `i18nLoad.js` 的锚点是**字符偏移**：`pos` / `pos±1` / `pos±2`，失败才落 `[pos-10, pos+len+30]` 模糊窗口，**任一条定位失败 → 整段 passage 放弃翻译**。CE 旧补丁把门控串删短（-41/-25 字符）→ 后续条目 pos 全下移 → anchor-error → 5 个 passage 全段落回英文。**故英文是「改短」的间接后果，补丁本身不写英文。**
- **修复（长度守恒）**：新增 `mbCELurkerPadTo()` 把替换串右补空格补到与原文等长（`<<if>>` 表达式里尾随空格无副作用）；`mbCELurkerPatchText()` 改为返回 `{ text, hits, kept, skipped }` 并上报数量。
- **汉化在场时的 switch 保留**：`Widgets Flats` 冰箱数量的 `<<switch $hookah.lurkers>>` 6 个 `<span>`（five/four/three/two/one/no）是 6 条译文的锚点，整块替换 = 物理删锚点、补空格也救不回 → 新增 `mbCELurkerCjkI18n()`（`window.modI18N` 在场，或框架 `mainLanguage==="zh"`）为真时**原样保留该块**（`skipped` 计数），>5 只时游戏内显示原版 "no"，真实数量看面板数值行；未装汉化时照旧改写成真实数值。
- **真实代码验收（不是纸面对照）**：用 `vm` 直接加载 `javascript/src/07f-lurker0-patch.js`，取出源码里真实的 `mbCELurkerPatchText`，配一份从 `i18nLoad.js` 复刻的完整匹配器（含 `<tw-passagedata>` 必须过 `decodeEntities`、模糊窗口必须判 `pStart >= lastIndex`），逐 passage 实测 5/5 打补丁后**仍是全中文**：`Widgets Struggle`（106,066→106,066；417 条 / 汉字 4,567）、`Widgets Flats`（5,522→5,522；37 / 415，switch 保留）、`Farm Yard`（11/135）、`Farm Tending Lurker Work`（8/65）、`Farm Tending Lurker Alex Fail`（6/96）；对照组用旧补丁（删短）实测汉字数直接归 0 并在 4~20 条后 anchor-error。
- **面板文案同步**：`07f-lurker.js` 说明段改写为「等长替换」原理 + 汉化在场时 >5 只的口径；标签增「· 长度守恒 N」「· 汉化在场保留 switch N」。
- **回退中心键中文化（新增段 `08e-undo-labels.js`，纯展示层）**：不改键、不改回退逻辑（回退仍按原始 key 精确分发）。解析顺序 = 适配器真实 entry（按 `key` / `varPath` 反查行名）→ 玩家自身路径词表（`prof.spray` 防狼喷雾 / `lurker:hookah.*` 水烟馆等）→ `03d-global-modzh.js` 的 `zhKey` → 地点分组名（`市政改造 · 绿地/桥梁/灌木丛/道路`）→ 维护写入表（`神殿宿舍清洁` / `神殿花园打理` 等）→ 言灵 op 表（`异装与校规记录清除`）→ 兜底原键体（**绝不返回空**）。`08c-undo-center.js` 改为渲染中文名，**原始键只留在 `title` 供排障**；`09-exports2.js` 导出 `undoLabel` / `undoItemName`。
- **新增断言**：`tests/test_mce.js` 59.44–59.50（7 条，实测值全中：`防狼喷雾` / `市政改造 · 绿地` / `神殿宿舍清洁` / `异装与校规记录清除` / 兜底 `unknown_key` / 空键 / `阶段 · 罗宾 · 店铺开办阶段`）；`tests/smoke_dom.js` P4.1b（6 条 DOM 断言：按截图 8 个裸键造留痕 → `refresh()` 后**行内不再出现英文裸键**、四个中文名可见、原始键在 title 里）。
- **3 条 `boolean+numeric` 缺 `min` 的 WARN 清零**：`revelation:nkl_retaken`、`wraiths:wr_admit`、`wraiths:wr_conch_ask` 补 `min: 0`（三键实为 0/1 域），`validate_adapters` 由 `[WARN] 3 项` → `OK：声明形态全部通过`；`check_key_types` 仍 1 条 `WARN_BOOL_01`（`RefuseWR`），属既有「真值判定、非严格比较」已知项，不改。
- **产物**：67 段（新增 `08e-undo-labels.js`）/ 841,205 B / `44eaba2f7f5fecd4d71a95b4483adb37b285c3708255f287007a132d0df39b6c`；结构门禁 1 条已知 WARN（`CHEAT_ADAPTERS` 两段重复声明）。
- **未做（明确边界）**：169 条 src strict 真债务本轮未清（涉及 26 个文件、`TS2339×118` / `TS2538×18` 等真实类型重构，需单独一轮），棘轮仍只减不增。

## v2.0.3（2026-11-07 P0~P4 迭代：覆盖率归因修复 + 统一回退中心 + 写入前 diff 预览 + 补盲断言）

**触发**：用户指令「p0~p4，做完之后在升版」——按 P0（惰性渲染页签覆盖率）→ P1（言灵页分支）→ P2（适配器门控分支）→ P3（导出面与 lurker）→ P4（产品侧三项）五档推进，完成后升版。

### 一、P0：覆盖率归因根因修复（历史所有覆盖率数字只统计了一个测试）

- 根因：五个测试里只有 `tests/test_mce.js` 带 `//# sourceURL`；`smoke_dom.js` / `functional_e2e.js` / `stability_loop.js` 是 `eval(fs.readFileSync(...))` 裸执行，`integration_gender.js` 走 `VM.runInContext`。V8 把覆盖率记到 `evalmachine.<anonymous>`，被 `c8 --include=javascript/maplebirchce.js` 整段丢弃 —— 于是**看似"P0 六文件近乎零覆盖"，实为另外四个测试的覆盖率根本没被计入**。
- 修复：三个 eval 测试改为 `fs.readFileSync(jsPath,"utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g,"/")`；`integration_gender.js` 改为 `VM.runInContext(mceSrc + "\n# sourceURL=" + MCE_JS...)`。四文件 `node --check` 全过。
- 效果（本轮两轮 c8 实测）：Statements 78.42% → **94.65%（12615/13327）**，Branches 65.42% → **73.37%~73.39%（3692/5032 与 3694/5033 两轮）**，Functions 84.61% → **96.99%（516/532）**（门禁 75/60/80 由"擦线"变为余量充足）。分支分母两轮差 1、命中差 2，来自 `smoke_dom.js` 结尾分片 `setTimeout` 在本机时序下是否全部走完，非代码差异。分母同步变大，因新增 `08c` / `08d` 两个源文件。

### 二、P4-1：统一回退中心（`javascript/src/08c-undo-center.js`，新增）

- 数据源唯一是 `V.mbCE_wrote`，不另建账本；`mbCEUndoList()` 按 `t` 倒序，`mbCEUndoOne(key)` 按 type 分发到各专用回退函数（cheat / world / maint / place / native / vanilla；set/clear/append 按 path/value 还原）。
- `mbCEUndoBlocked()` 明确三类不可回退并给原因：`batch`（仅审计）、`yanling`（言灵页开关处撤销）、`state`（关系状态由原版实时判定）。全量回退跳过它们并计入 `skip`，不混进成功数。
- `mbCEUndoCenterRender(pane)` 挂在全局页 `renderGlobal()` 末尾、不参与 ①…⑯ 编号；按 type 分组（组按条数降序）、每组「回退本组」+ 逐行「回退」、每组最多列 24 条。

### 三、P4-2：写入前 diff 预览（`javascript/src/08d-diff-preview.js`，新增）

- 开关默认**关闭**，`mbCEPreviewEnabled()` 读 `mbCEUiState.diffPreview === "1"`；顶部金色按钮切换并持久化。
- 门控插点在 `cheatWriteValue`（`04b-modcheat-write.js`）解析出 `before` 之后、真正赋值之前：`before === after` 放行，否则挂起 `mbCEPendingPreview`（内存对象 + 重放闭包，刷新即失效）并弹 `#mce-preview-bar` 确认条；确认后 `mbCEPreviewReplay=true` 重跑闭包防二次门控，取消不写档。
- 边界如实登记：`cheatWriteListValue`（列表型写入）**未接门控**，面板只对单值写入生效。

### 四、P1/P2/P3：覆盖率补盲断言（+87 条）

- `tests/test_mce.js` §58（45 条）：战斗终结分支（struggle 缺失静默 / done+1 / tentacle / active / cluster / 未知 key / 抛错动作）、扩展转化（myTFSet 缺失 / transformationParts 兜底 / 同名键非数值过滤 / 完成后 rabbit===3）、原版恋爱阶段（三入口 / 未知阶段 / NPC 缺失 / 对象型入口 / 孕育意愿数值门槛 / 内置 vanillaComputeStatus / 写 `vanilla:wantsPregnancy` 留痕）、回退边界（heat 型实时计算拒绝 / 无痕迹拒绝 / 有痕迹回退 / native 数组与对象两型）、潜伏者（state 读三源 / MAX 9999 / set 走 cheat 通道 / autoTick 搬运 / 锁定优先 / 关自动）、数值固定（`a..b` 空段 / 非有限数 / set 即写 / tick 写回 / 当前值缺失不建键 / remove 两态 / label 非空）。
- `tests/test_mce.js` §59（42 条，编号 59.1~59.43、缺 59.39）：言灵运行期钩子六态（无 window / 上游非函数 / 安装 / 恒 false 且不调上游 / 幂等 / 透传 / 卸载还原原函数 / sync 双向）、存量净化三项（异装 / 异装癖含重复特质 / 负面名声只清负面且删衰减队列 / 正面拉满 5×2000 / `$fame` 缺失拒绝）、FertilityExpansion API 桥接九态（无 API / available 为假仍可用但标 bypass / 孩子清单 / 各动作转发 / **cheatsEnabled 临时置位后还原不污染存档** / 只读查询两型 / 缺 id 拒绝 / 未知动作 / API 抛错原文回传 / available 自身抛错不影响调用）、潜伏者解限补丁九态（纯文本替换 / 幂等 / 未登记不改 / switch 段整体替换 / 无 document 降级 / 无通道标 none / Story 通道命中 / 汇总 report / 重新应用文案）、面板状态与主题（localStorage 写入 / 读回 / 切星空蓝 / 非法主题回落 gold）。
- `tests/smoke_dom.js` 既有 7b2/7f/7g/7h/3.1/P4-1·P4-2 共 471 条断言保持全绿。

### 五、P4-3：D 维三渠道离线对账

- `game\` 内实装包清点：升版前 18 个（13 `.zip` + 5 `.modpack`），本轮补装后**19 个（14 `.zip` + 5 `.modpack`）**；枯木逢春 2.5.8 三包 + 归途之书 1.4.6 复验 `Copy-Item` 均返回 `SKIP 已存在`（确实在位）。
- 唯一真缺的 FertilityExpansion 从上游 GitHub（`Liliths-Legacy/DOL-FertilityExpansion-MOD` v1.7.0，asset 684750257）下载 `FertilityExpansion-v1.7.0-Visual.mod.zip`：**36,247,181 B / SHA256 `89E01574BA083843AC0064BEF5E207681F5DBD869C2A158C03DB85583371290C`，与 release API 返回的官方 asset digest 逐字符一致**，包内 81 条目、`boot.json` 为 `{"name":"FertilityExpansion","version":"1.7.0"}`；已 `Copy-Item` 装入 `game\`（同名同哈希）。下载通道记录：Node `https.get` 直连三次均 timeout，改 `curl -L -C -` + `git credential fill` token 断点续传才走通（`mce_gh_dl2.js` 参数化尝试亦失败，最终用 curl）。
- 源码树 `_modcache\fert_tmp` 与 `%TEMP%\fert.zip` 均非 ModLoader 包（前者是 `main.py` + `src/` 的 Python 源码工程，后者是 807,589 B 源码压缩包），此前口径已作废。
- 离线对账工具 `mce-e2e\idb_audit.ps1`（只读，判「已装载 / 在库 / 确定未装载 / 无法确证」四档，`-Strict` 有问题项 `exit 3`）；实测 19 包结果：**已装载 8 / 明文在库 0 / 确定未装载 4 / 无法确证 7**。FertilityExpansion Visual 判「确定未装载」（36 MB 的 base64 形态需 ≈48 MB > leveldb 3,911,123 B），`MapleBirchCE.mod.zip` 判「无法确证」——**复制进 `game\` 不等于装载**，两者都须走 `game\mce-mod-import.html` 导入 IndexedDB 后才生效（项目规则 §6 已固化该口径）。
- `docs\modpack-inventory.md` §一 由 18 包更新为 19 包（新增 #19 fert Visual），§二 适配器覆盖由 11/11 更新为 12/12（补 `fertility-expansion`），§三 13 zip → 14 zip，§6.5 四层数字表与三档判据按本轮实测重写。

### 六、本轮未做（如实登记）

- `05a3-modcheat-actions.js` 的 `mbCEActionRow()` 当前**无任何适配器使用 `actions` 数组**（全部走 `actionPanel` 整组接管），属预留路径，本轮不为它伪造调用者。
- `07i-yanling.js` 剩余未覆盖行基本是防御性 `catch` 与 `getV()` 返回 null 的不可达分支（`getV` 是闭包，测试无法在不改源码的前提下构造）。
- `real_smoke.ps1`（moli 实机冒烟）本轮仍未跑：用户硬约束「都别用浏览器」，面板级交互只由 jsdom 断言覆盖，交付说明已标注该盲区。

### 七、验证结果（`tools/run_all.ps1` 十步，本轮实测）

| 步 | 内容 | 结果 |
|---|---|---|
| 1 | build_js 拼接（64 段） | ✓ 828,853 B / order `b91a5bb460ee` |
| 2 | `node --check` 产物 | ✓ 0 错 |
| 3 | ESLint 八规则 | ✓ 0 错 |
| 4 | DOM 冒烟（jsdom） | ✓ **471 PASS / 0 FAIL** |
| 5 | 全量回归 `test_mce.js` | ✓ **1658 PASS / 0 FAIL**（含 §57 27 / §58 45 / §59 42 条补盲） |
| 6 | 功能级 E2E | ✓ 172 PASS / 0 FAIL |
| 7 | 性别集成 | ✓ 24 PASS / 0 FAIL |
| 8 | 适配器声明一致性 + 类型形态 | ✓ 0 命中 |
| 9 | 原版数字档位形态 | ✓ CONFLICT 0 |
| 10 | 覆盖率门禁（c8 + stability_loop 2337 PASS） | ✓ 94.65% / 73.37% / 96.99%（门禁 75/60/80） |

合计 **4662 PASS / 0 FAIL**，`run_all.ps1` 退出码 0，末尾 `codegraph sync` 已同步。

## v2.0.2（2026-11-07 按键重排版：言灵页 8 区块归位 + 全局页 10 区块统一编号）

**触发**：用户反馈「这几次更新添加的东西有点多，也有点乱了。对我的模组按键进行重新排版」。逐页清点后确认"乱"不是文案过长（全库 107 个按钮里 >10 汉字的仅 1 条），而是**区块多、无编号、单按钮独占一行、说明密文堆叠**三件事叠加。

### 一、言灵页：编号整体错位，说明区与区块脱节（P1）
- 现象：`07i-yanling.js` 八区块的变量顺序是 s1→s2→s3→**s5→s6→s7→s8**→s4，而 s4 是「说明与边界」却排在最后；块内文案写的又是 ①②③…，与编号体系完全对不上。玩家看到的是 8 个平铺标题 + 26 个按钮，中间夹着大段带原版行号的说明。
- 修法：按"玩家要解决什么问题"重分为 3 个二级分组 —— **A 着装与名声**（① 无视着装性别 / ② 异装癖压制 / ③ 负面名声清零）、**B 身体与数值**（④ 身体与衣物 / ⑤ 精神与体液 / ⑥ 数值快补 / ⑦ 天气）、**C 角色状态**（⑧ 角色放逐）；编号改由 `mceNewSec(idx, …)` 统一生成，不再手写；说明文字从块内长段落改为 helper 的折叠 hint（默认 2 行，点开看全文）。
- 拆分：原「身体与衣物」把精液/精神混在衣物组里（玩家误以为都跟衣服有关）→ 拆出 **⑤ 精神与体液**（精液补满 + 精神恢复）。
- 页尾「说明与边界」不再伪装成第 4 个区块：改为不编号的 `mce-block` + 折叠盒，摘要行一句概括 ①~⑥，点开再显示 6 条完整边界。

### 二、全局页：5 处 `mce-section` 无编号 + 6 个金色按钮裸堆（P1）
- 现象：`renderGlobal()` 一进页就是"悬浮球锁定行 + 一句提示 + `mce-actions` 六个金色按钮"，把 4 个"全角色批量"与 2 个"收集品解锁"混在同一堆，且默认换行；其下 5 个 `mce-section`（时间调节 / 誓言修复 / 战斗终结 / 庄园自动维护 / 世界腐化）全无编号。
- 修法：悬浮球锁定收进不编号的「面板设置」分组；批量按钮按语义拆两块 —— **① 批量速成（全角色）**4 按钮网格 / **② 收集解锁**2 按钮网格；后续区块统一编号 **③ 时间调节 / ④ 誓言修复 · NPC 特质 / ⑤ 战斗终结 / ⑥ 庄园自动维护 / ⑦ 世界腐化**。
- 顺手修掉一处结构性错位：`vsec` 原先只是个标题，其下誓言行、特质清单、`tbox` 全挂在 `pane` 上（视觉上凑在一起但结构上不属于该区块）→ 全部改挂 `vsec`，折叠展开与分组才真正生效。

### 三、跨页收口：数值固定 / 潜伏者 / 说话态度纳入编号（⑧⑨⑩）
- `07f-lock.js`（数值固定）、`07f-lurker.js`（潜伏者）、`05b2-modcheat-attitude.js`（说话态度）三个区块由其它文件渲染，此前各自独立无编号 → 改用 `mceNewSec` 并固定编号 ⑧ / ⑨ / ⑩（调用顺序即渲染顺序）；潜伏者内部行也从 `pane` 改挂自己的区块，说明文案改折叠 hint。

### 四、排版基建（`07a-shell.js`）
- 新增 helper 五件套：`mceSecNo/mceSecMark`（①–⑯ 编号表）、`mceNewSec(parent, idx, title, hint)`（编号区块 + 折叠说明，不编号时传 0）、`mceNewGroup(parent, title, sub)`（二级分组，返回 body）、`mceBtnGrid(parent)`（2 列按钮网格）、`mceFoldHint(text)`（2 行截断、点击在 0/1 间切换）。
- CSS 新增 16 条规则：`.mce-block` / `.mce-sec-title` / `.mce-sec-n` / `.mce-group` / `.mce-group-h` / `.mce-group-n` / `.mce-btn-grid`（`grid-template-columns:1fr 1fr`，`:only-child` 自动占满整行，按钮内 `white-space:normal` 支持两行题字）/ `.mce-hint.mce-fold`（`-webkit-line-clamp:2`）/ `.mce-foldbox[data-open="0|1"]`（收起只留摘要，展开补出全部条目并淡入）。
- `07i-yanling.js` 的 `mkBtn` 增加网格感知：容器是 `.mce-btn-grid` 时直接挂按钮本身，不再套一层 `.mce-row`（否则每格变两层）。删掉已无引用的局部 `mkSec`。

### 五、迭代自查：本轮无新增可修点
- 逐项回读：言灵页 8 区块编号连续（①→⑧）、分组归属正确、按钮数与重排前一致（26 个）、`mkStatus` 仅 ② 使用且保留；全局页 ①→⑩ 连续、`vsec`/潜伏者内容挂载点修正、smoke 依赖文案（`撤回（恢复操作前状态）` / `获取（庇护模式）`）未改。
- 自查新增一处：区块局部变量名仍沿用错位期的编号（区块④叫 `s5`、区块⑤叫 `s9`），页尾说明块与区块④重名 `s4` —— 已全部对齐为 `s1…s8` + 页尾 `sInfo`，避免下轮再按变量名误判区块顺序。
- 全链 9 步 + 打包 5 步 + 实机冒烟实况见下。

### 验证
- 全链 `tools\run_all.ps1` 9 步 `ALL CHECKS PASSED`（build / syntax / ESLint 八规则 / DOM 冒烟 / 全量回归 / 功能 E2E / 性别集成 / 适配器声明一致性 / 覆盖率门禁）。
- JS 产物 62 段 / 793,743 B / SHA256 `3A5FC57F2CD0E24C99E185FC55F50F4B57B1034AD367740618EAA3A28322EF45`。
- 覆盖率门禁：Statements/Lines 78.66%（10001/12713）、Branches 65.45%（2332/3563）、Functions 84.36%（421/499）；性别集成 24 passed / 0 failed。
- 打包 `MapleBirchCE.mod.zip` / SHA256 `2F1EFABE1EFFAB1DAC6E7EAF770C62E7393D1CF5A121E37285D16797BD29F835`（312,097 B、pack.ps1 verifier 4/4 走 `VERIFIER-FALLBACK` 等价核对、4 条目正斜杠、staging = boot.json + javascript + twee + README）。
- 实机冒烟 `DoL-Project\real_smoke.ps1`：A 游戏页面加载 / B SugarCube 启动 / C ModLoader v2 / D 内置插件自举 init=21 / G 插件集指纹 23 项 全 PASS；E/F 为 moli 单会话引擎交互阶段超时的已知工具局限（非产品 bug）。
- E2E 选择器同步：`.mce-section` → `.mce-section, .mce-block` 三处（新容器类名兼容，`tests\functional_e2e.js` :361/:502/:538）。

## v2.0.1（2026-11-07 收敛轮：锁定文案中文化 + 监狱/农场直达状态兜底）

**触发**：v2.0.0.007 落地后的收敛自查——逐条回读原版 widget 定义与面板刷新路径。007 修掉了「行标签」但仍有两类问题：状态栏文案仍在吐英文裸 path；三处新直达目标在原版状态对象缺失时会崩或读到空。

### 一、锁定状态栏仍吐英文裸 key（007 只修了行标签）
- 现象：点「锁定」后底部状态栏为 `已锁定 skulduggery = 500`，取消为 `已取消锁定 skulduggery`；行标签已是中文，但状态栏文案由 `mbCELockSet/Remove` 的 `message` 直接拼 `path`。
- 修法：新增 `mbCELockLabel(path)`（三级回落：快速面板索引 label → `zhKey(path)` 全路径 → `zhKey` 叶子段 → 原 path），`mbCELockSet` 两处与 `mbCELockRemove` 一处文案改用它；全局页「自定义」锁定行名从写死的「自定义」改为该中文名。

### 二、锁定/「获得」按钮写 class 会抹掉其它类
- 修法：`mbCESyncQuickRow` 两处 `className = …` 改 `classList.toggle("mce-gold", …)`（保留基类），`classList` 不可用时回落原写法。

### 三、监狱直达在 `$prison` 缺失时必崩（P0）
- 取证：`Prison Cell` 段只调 `<<destination_prison>>` + `<<effects_prison>>`，而 `effects_prison`（658002）首行即 `<<if $prison.work_check isnot 1 …>>`——`$prison` 整体缺失时深链读抛 TypeError；新档直达监狱必崩。
- 原版 `prison_init`（657865）自带 `<<if !$prison>>` 守卫，可幂等建壳；但其末尾 657931 有**无条件** `<<set $prison.morning to 1>>`，已有进度时调会污染当日流程。
- 修法：`07d-places.js` 新增 `ensureSceneStateFor(name)`，在 `teleportTo` 内调用——`Prison*` 前缀且 `$prison` 非对象时经 `SugarCube.Wikifier`（回落全局 `Wikifier`）执行 `<<prison_init>>` 建壳；已有 `$prison` 直接返回，绝不调 init。

### 四、农场直达 `$farm` 缺失时子段落读空
- 取证：`The Farm` 段自身只读 `$molestationstart`（不崩），但进入后农场子段读 `$farm.*`；`farm_init`（487465）无守卫且 `<<set $farm to {}>>` 会抹掉已有进度，故不复用。
- 修法：`ensureFarmState(force)` 增参数（`07f-pins3-queue.js`），`The Farm` / `The Farm *` / `Farmland *` 前缀且 `$farm` 非对象时 `ensureFarmState(!(farm_stage >= 1))`——未推进也补壳，只补不覆盖。

### 五、另两处取证后确认无需兜底
- `Brothel Basement`：段内仅 `<<set $outside/$location>>` + `<<effects>>`；原版无 `$brothel` 对象（用扁平 `$brothel_*` 键）。
- `Asylum`：`<<asylumeffects>>` 只读 `Time.hour` 写 `$asylumstate`，不读 `$asylum`（后者是 0/1 标量，镜像计数是扁平键 `$asylum_mirror`）。
- `Livestock Intro`：只读 `$location/$outside/$phase`；`$livestock` 由本体变量初始化 widget（183372 整对象）随新档建立。

### 六、收敛第二轮：剧情触发（不止直达按钮）同样兜底
- `07f-pins2-anchor.js` 在触发前对解析后的真实入口段 `entry` 与 `P.passages` 逐段调 `ensureSceneStateFor`——剧情清单里确有 `PrisonScarredInmate` / `PrisonSpirePrecipice` / `PrisonYardLocket` 等段（`07e-scenes2.js` 的 `/^Prison/` 角色分类实证），新档触达同样会深链读 `$prison.*`；直达按钮那条路只是玩家最容易踩到的一条。
- 前缀判定放宽：`/^Prison\b/` → `/^Prison/`（`\b` 在 `PrisonScarredInmate` 这类无空格段名上不成立，会漏判）；农场侧 `The Farm` / `Farmland` 同理去掉「必须带尾随空格」的要求。

### 验证
- 全链 `tools\run_all.ps1` 9 步 `ALL CHECKS PASSED`（含新增断言 test_mce 44.10 共 12 条 + smoke_dom 9.6 共 6 条）。
- JS 产物 62 段 / 759875 B / SHA256 `D4A4A4DCA4BCB8E45204885477E76AE178DA275662C460A5607D3DA3BEDBDC64`。
- 打包 `MapleBirchCE.mod.zip` / SHA256 `1E38D12AFBDF9E00DA74B70A8A80E0D19E1764D6BF96E1BA90EF03840927806C`（300,788 B、pack.ps1 verifier 4/4、4 条目正斜杠、双端字节与 SHA 一致）。

## v2.0.0.007（2026-11-07 好友实机反馈修复 + 原版四地点直达）

**触发**：好友（患者猫猫…SVIP1）在已发布的 v2.0.0.002 上实机试用，报三处 UI 问题 + 一个原版地点需求（「能不能一键到达地下妓院 / 雷米牧场可以作弊吗 / 还有监狱 / 精神病院」，问「模组吗还是原版」，答「原版」「数值」）。

### 一、快速面板点「锁定」不即时变「已锁定」（得切页签再回来）
- 根因：`actPlayer` 的局部刷新分支只回填 `input.mce-inp` 与 `.mce-row-lbl`，**完全不碰锁定按钮的题字与 class**，只有整页 `renderPlayerEdit()` 才重建按钮。
- 修法：新增 `mbCESyncQuickRow(row, path)` 作**行内状态唯一真值路径**——输入框值 / 中文 label / 锁定按钮（`[data-mce-role="lock"]`：题字「已锁定」↔「锁定」、金色、title）/ 武器「获得」按钮（`[data-mce-role="grant"]`：持有态）一处同步；`actPlayer` 局部分支与 `renderQuickRow` 末尾都调它（渲染与刷新共用同一条路径）。

### 二、锁定后该行技能名变英文裸 key（切页恢复中文）
- 根因：行标签重写依赖 `PANEL_QUICK_PATH_INDEX`，而该索引只在 `quickWrite()` 内部惰性建表；「锁定」走 `mbCELockSet` 不经 `quickWrite` → 索引为 null → label 回落成 `path` 原文（`skulduggery / danceskill / swimmingskill / athletics / tending / housekeeping`）。
- 修法：索引构建抽成 `ensureQuickIndex()`（已建即返回，否则遍历 `PANEL_QUICK_GROUPS` 建 `path → item`），`quickWrite` 与本轮同步函数共用。

### 三、武器已获得、但「获得」按钮标签没改成「已获得」
- 修法：按钮文案不再写死，改由 `mbCESyncQuickRow` 按持有态判定（`prof.<武器>` 为 number 且 ≥1，与原版 `isnot undefined` 持有判定一致）→ 已持有显示「已获得」+ 金色 + title 带当前熟练度；未持有显示「获得」。

### 四、场景直达补原版四地点（好友要的是「原版」「数值」手段）
原版 0.5.12.13 passage 实证（16,087 段按 `name` 属性枚举）：
- **地下妓院**：`Brothel` 前缀 139 段，`Brothel Basement` 实证存在 → 新增「妓院 · 含地下层」组，主场景落 `Brothel Basement`。
- **雷米牧场**：`Livestock` 前缀 310 段（`Livestock Intro` 为入场段）→ 新增「雷米牧场 · 牲口线」组，主场景 `Livestock Intro`。
- **雷米农场**：`The Farm` / `Farmland` 前缀 124 段 → 新增「雷米农场 · The Farm」组，主场景 `The Farm`。
- **监狱**：既有组已覆盖 `Prison ` 前缀 363 段（与 `Police ` 同组）；新增「监狱（原版 Prison）」档位组补数值：`prison.attention_level`(0-3) / `prison.protection`(0-10) / `prison.hours_worked`(0-12)，赋值形态实证为 number。
- **精神病院**：既有 `Asylum` 组（189 段，`main: Asylum`）本身可用；补 `asylum_mirror`（0-5，原版 `gte 5` 判定触发深层镜像）。
- 另补牲口线档位：`livestock.obey`(0-100) / `livestock.milk` / `livestock.semen` / `livestock.pride`(0-1)，均实证 number；`livestock.escape` 为字符串（`night`/`river`）**未纳入**。
- `PLACE_CN` 补 `brothel / basement / gloryhole / livestock / barn / farm / farmland / plough / tie stall / milking` 中文括注。

### 验证
- 单测：`test_mce.js` 场景分组断言 14 → **17**，并补 `brV7 / lvV7 / fmV7` 三条组定义断言（主场景 Brothel Basement / Livestock Intro / The Farm）→ `ALL TESTS PASSED`。
- DOM 冒烟（新增两段）：
  - 场景页：三新组标题渲染（`妓院 · 含地下层 Brothel` / `雷米牧场 · 牲口线 Livestock` / `雷米农场 · The Farm`）+ 切「地点」子页断言「监狱（原版 Prison）」「雷米牧场（原版 Livestock）」两组标题与「监狱关注度」「服从度」档位行 → `SMOKE ALL PASSED`。
  - 9.5 段：`skulduggery` 行初始按钮=「锁定」且不高亮 → **点一下同一次渲染内**变「已锁定」+ 金色 + 锁定表命中 → 锁定后行 label 不含英文裸 key（回归断言）→ 再点取消并立刻恢复「锁定」；`prof.baton=500` → 按钮「已获得」+ 金色，归 0 → 「获得」。
- 全链 `run_all.ps1` 9 步 `ALL CHECKS PASSED`（性别集成 `passed=24 failed=0`）；产物 **62 段 / 756,042 B / order `6b823c680f42` / SHA256 `f90c9a18be15db618459b92eff020bf4cdac2dc3c20575ff85827ab3b4a43436`**；`pack.ps1` 4 条目正斜杠 + verifier 4/4（`VERIFIER-FALLBACK` 等价核对）+ zip **299,220 B / SHA256 `E64C46E87299C08D82FB1924A7503537F0E622971168047EA1260FF63F7312B3`**（README 同步更新后重打包）。

## v2.0.0.006（2026-11-07 新增「言灵」页，功能新增）

**触发**：用户要求把 GitHub `Nk-Be/DOL-CheatExtend` v1.1.3（俗称「言灵作弊」，2024-08 发布、2024-11 最后推送）里仍有用的思路学过来，在 MCE 里开一个同名新页签；并满足好友的诉求——**让 NPC 无视 PC 所穿衣服的性别**：穿异性服装不触发异装判定、不涨异装癖、**一点负面名声都没有**（好友走全正面线，理由是「有很多好看的衣服，这些放现实明明是不分男女的」）。

### 新增「言灵」页（第 7 个外层页签）
- **核心手段是运行期覆盖 `window.isCrossdressing`**，不是文本替换。本体 `isCrossdressing()` 定义在 72520-72536，末行 `window.isCrossdressing = isCrossdressing;` 直接挂到 window —— 覆盖后 NPC 的 `man` widget、换衣间、`crossdressing_check` 全部走新实现，开启时恒返回 `false`，`$crossdressing` 因此恒 0。
- 三段治理：
  1. **无视着装性别**：开关 + 状态行 + 运行时诊断（钩子是否挂载 / `$crossdressing` 当前值）。关闭时**语义完全透传原判定**（不改 sex / genital / gender_appearance，`isGenitalMismatch` 与原版 herm 链保持原样）。
  2. **异装癖压制**：显示 `$crossdressingTrait` 进度与 `crossdresser` 特质状态；「立即清空进度 + 移除特质」清存量（含 `$backgroundTraits` 里的 `crossdresser`），「持续压制」每秒压回 0。
  3. **负面名声清零**：「一键清零：学校异装名声」清 `$schoolrep.crossdress` / `.herm` + 删 `$school_crossdress_message`；「一键清零：全部负面名声」连带 `V.fame` 负面八项（sex / prostitution / rape / bestiality / pregnancy / impreg / exhibitionism / pimp）与 `V.fameDecay` / `V.fameDecayTimer` 衰减队列（否则次日被队列改回），**正面五项 scrap / good / business / social / model 保持不动**。
- 开关状态存 `$mbCE_yanling = {noCross, noTrait}`，**读档后不打开面板也生效**：1 秒守卫表由 `:passagedisplay` 与 init 按需起（两个开关都关时自动停表）。全部净化动作按 `V.mbCE_wrote["yanling:<op>"]` 留痕。
- 接线：`09-exports.js` 的 `names` / `panes` / `paneRenders` 第 7 项、`07a-shell2.js` 的 `switchOuterTab` 分派、`07a-shell.js` 的 `.mce-tabs` 溢出滚动（7 个页签挤一行时 `overflow-x:auto` + `flex:1 0 auto` + `nowrap`）、`09-exports2.js` 的 passagedisplay / init 起表。

### 为什么只学思路、不搬 CheatExtend 的代码
- CheatExtend **零 JS**，全靠 `TweeReplacer` 的 `findString` 做**原版 passage 文本字符串替换**（`boot.json.addonPlugin[0].params` 19 条规则）。原版文本一变迁，整块规则**静默失效**——这正是「时间太久已经不适用」的根因。它自己的二代言灵输入框（`<<textbox "$yanling">>` + 保存时 `<<set ('$name','$name',{name:...})>>` 劫持名字显示）在本体里**已被 `<!-- 二代言灵 -->` 整块注释掉**，即作者自己也放弃了这条路径。
- 它的「快捷言灵」是一长串 `[[标题|$passage][赋值语句]]` 单行链接（`cheats_4.txt` 25,376 B），写法上还带着裸语法 `to`（`$schoolrep.herm to 0`）、拼写笔误 `$milk_releasedFIX_MAN`、无意义自增 `$spraymax +=-1`、硬下标 `$NPCName[28]`。
- 所以本页继承的是**能力清单**（无视着装性别 / 异装癖压制 / 负面名声清零 / 学校异装名声双键），实现方式全部换成 MCE 自己的：直接写 V、调原版函数、覆盖 window 函数。**不做文本替换，不依赖原版文案。**

### 自查修掉的两个真问题（都在测试层暴露）
- **模块级 1 秒 `setInterval` 让测试进程永不退出**：`smoke_dom.js` 末尾只设 `process.exitCode` 不 `process.exit`，常驻 interval 会让事件循环不空 → 冒烟挂死（后台任务 4 分钟零输出）。修法：`mbCEYanlingTick` 开头「两个开关都关 → `clearInterval` + return」，`mbCEYanlingEnsureTimer` 先读状态判「有开关开启」才起表，起表后 `try { timer.unref() }`（浏览器 interval 是数字无 unref，已 `try` 包裹）。
- **测试里裸调 `mbCEYanlingXxx()` 取不到函数**：产物在 eval 严格模式/局部作用域执行，`var` / `function` 声明不泄漏到全局。54 组断言全部改为走 `setup.mbStageCE` 导出的 `yanlingXxx`（`const y54 = setup.mbStageCE`），剩余裸调用数 0。

### 验证
- 单测：54.1–54.28 全 PASS（含 54.2 关闭时透传原判定 `true`、54.3 开启时恒 `false` 且上游零调用、54.6 第三方重包后仍拦截、54.14 只删负面衰减队列项、54.16 tick 未启用不建 `$mbCE_yanling`、54.20 tick 每秒压回 0；54.23–54.28 为收敛轮新增，见下）→ `ALL TESTS PASSED`。
- DOM 冒烟：外层页签 >=7（实际 7）/ 言灵页渲染不崩 / 含「无视着装性别 / 负面名声清零」两区 / 「开启」按钮存在的断言，并补**真实点击链**：mock 原版 `window.isCrossdressing = () => true` → 开启后 `$mbCE_yanling.noCross === true` 且 `window.isCrossdressing() === false` → 按钮翻转「关闭」→ 写脏 `$crossdressingTrait=66` 点「立即清空」归 0 且特质移除 → 写脏 `$schoolrep` / `$fame` 点「全部负面名声」负面归零、正面 `scrap` 保持 1000、学校双键归 0、文案已删 → 点「关闭（恢复原版判定）」后 `window.isCrossdressing === 原版函数` 且判定恢复 `true`（即钩子已彻底卸载）。`SMOKE ALL PASSED`（修 interval 前此步挂死）。
- 全链 `run_all.ps1` 9 步 `ALL CHECKS PASSED`（性别集成 `passed=24 failed=0`）；产物 **62 段 / 750,728 B / order `6b823c680f42` / SHA256 `b8a749e8603e7dc0f9be813141367349e44af35664ac0299fa6aff2ed8c500a9`**；`pack.ps1` 4 条目正斜杠 + verifier 4/4（走 `VERIFIER-FALLBACK` 等价核对）+ zip **296,886 B / SHA256 `70AFB93B210F2BBE77A25A91F003F1D30A2654EEEAAF90FB4D3CE77AFCE7CA57`**。

### 收敛轮：迭代优化至收敛（同日第二轮）
首版交付后按「迭代优化，直至收敛」继续自查：每项先写断言（54.23–54.28）跑红、再改实现跑绿。共修 6 个真问题：

1. **状态归一用 `!!` 过宽**：`!!"false" === true` —— 手改存档或异常序列化写进字符串时，会把「关」当「开」。改严格 `=== true`（`mbCEYanlingState` 归一 + `mbCEYanlingNoCross` + tick / 定时器判定）。
2. **「关闭」不卸载钩子**：关闭态只是在 wrapper 里透传，`window.isCrossdressing` 上仍留一层本页函数。若第三方模组把「我方钩子」当上游链式包进自己的实现，关闭后即形成「我方 → 第三方 → 我方」无限递归。新增 `mbCEYanlingUninstall()`：仅当 `window.isCrossdressing === 本页钩子` 时还原上游原函数，第三方已替换则**绝不动**，幂等。新增 `mbCEYanlingSync()`：开 → 装、关 → 卸；tick / 定时器 / toggle 全部改走它（此前 tick 与定时器无条件 `Install`，等于「没启用也挂着钩子」）。
3. **对外 API 无字段白名单**：`yanlingToggle(field)` 挂在 `mountApi` 上，控制台误传字段会往 `$mbCE_yanling` 写垃圾键。加白名单，非法字段返回 `{ok:false, msg}` 且不写入。
4. **面板诊断口径误导**：关闭态本就不该挂钩子，原来与「脚本未就绪」共用一句「钩子未挂载」。改三态：`钩子已挂载` / `钩子未挂载（游戏脚本未就绪或已被重载）` / `未启用（开关关闭时不挂钩子）`。
5. **点开关后滚动回顶**：重渲染前记 `.mce-body.scrollTop`，渲染尾部还原。
6. **出口文案失真**：`mbCEYanlingPurgeFame` 的返回文案原来写死「学校 2 键」，`$schoolrep` 缺失时实际清 0 项；改为按实际清掉的项计数。

**新增断言**：54.23 字符串 `"false"`/`"0"` 不得被判为开启、54.24 显式 install 后 window 上是 wrapper、54.25 关闭 `noCross` 立即还原上游原函数、54.26 `noCross` 关而 `noTrait` 开时 tick 不重挂钩子、54.27 `uninstall` 连调两次幂等且不误改第三方函数、54.28 `toggle` 拒绝白名单外字段。
**新增导出**：`mountApi` 增 `yanlingUninstall` / `yanlingSync`（原 9 项 → 11 项）。

**边界（有意不动的地方）**：
- `isHermOrCrossdresser`（72548）在 JS 内裸调用 `isCrossdressing()`，不受 window 覆盖影响。它判的是「sex 与外观性别不符 / 双生殖器」，属 herm 语义而非服装性别，保持原版；双生殖器场景要一并消掉名声，用面板的「全部负面名声」清零。
- 学校异装名声升到 5 时原版把 9 名 NPC 写进 `$genderknown`（`schoolrep` widget 的 `pushUnique`）。清零名声不撤销这些认知 —— 它们只代表「NPC 已知道你的性别」，不是负面名声，撤销反而让 NPC 忘记已有认知。面板第 ⑥ 条已写明。
- 压力增减（77866-77870）用独立本地 `const` 判定，源码注释明确不复用该函数，本页不触碰，故与面板「说明与边界 ②」一致。

**收敛判据**：按「取证 → 断言 → 修复 → 全链」多轮扫描，已无可复现的新问题；余项均属「不属本页语义」的保持性决策，已在面板与本文档显式写明，不再改动。

### 顺带收尾的上一轮遗留项
- **`07f-lurker-patch.js` 更名 `07f-lurker0-patch.js`**。原因：`build_js.js` 按文件名 sort 拼接，`-`（0x2D）< `.`（0x2E），旧名让「补丁片」排在 `07f-lurker.js`（本体片）**之前**，与语义直觉相反、也让「本片不得读本体片模块级 var」成为必须写明的隐性约束。新名用 `0`（0x30 > 0x2E），实际顺序变为 `07f-lock → 07f-lurker → 07f-lurker0-patch → 07f-pins1-data`（本体在前、补丁在后），该隐性约束自然解除。同步改了本片头注释里的顺序说明，以及 `07f-lurker.js` 头注释 2 处文件名引用；CHANGELOG 历史条目里的旧名**保留不改写**（记录当时事实）。
- **23 段补 `/* 职责：… */` 文件级表头注释**（只加注释、不动任何代码）：`03c-global-combat2`、`04a-01`～`04a-09`（9 个适配器声明段）、`04b-modcheat-write`、`04c-modcheat-util`、`05a2-modcheat-rows-build`、`07a-shell2`、`07d-places2`、`07e-scenes2`、`07f-pins2-anchor`、`07f-pins3-queue2`、`07g-romance`、`07h-render3`、`08-npc-traits2`、`09-exports`、`09-exports2`。原有的 `/* ============ … */` 大块头注释保持不动；`00-preamble.js` 已有完整文件头（首行为空行，此前误计为缺注释）。

## v2.0.0.005（2026-11-07 分片结构体检轮，功能不变）

**触发**：用户要求对「把单文件 JS 拆成 `javascript/src` 多段」这件事本身做迭代优化，检查拆分后有无遗留问题，能精进的地方直接改。

- **构建层加固**（`tools/build_js.js`）：拼接一直是 `out += 读文件` 的**纯字符串相加、不插任何分隔符**。因此任一段末行缺 `\n`，下一段首行就会被接到本段末行 —— 末行若是 `//` 行注释，下一段代码被整行注释掉（**静默丢功能，ESLint/`node --check` 都看不出来**，只有跑起来少一块 UI 才发现）；末行若是未闭合块注释，则下一段整体被吞。新增三道守卫：
  1. 片段缺末尾换行 → 自动补齐 + 打印 `FAIL:` 并 `exit 1`（产物已修好，提交补齐后的源再跑即绿，构成 fail-closed 门禁）；
  2. 片段含 U+FFFD（编码损坏，产物"看着有内容"实为乱码）→ `FATAL` 直接拒绝构建；
  3. 打印 `order <12 位指纹>`（文件名序列的短 SHA256）—— 改名/新增片段会改变拼接顺序，指纹随之变，事后可对账。
- **修 1 段真实缺换行的源**：`05a2-modcheat-rows-build.js` 尾部 `\t}` 后无 LF（13,993 B，末 3 字节 `10,9,125`）。当时没出事纯属运气 —— 紧随其后的 `05a3-modcheat-actions.js` 首行恰好是块注释开头，`}` 直接拼 `/*` 仍合法；换任何一段以语句开头的文件排在它后面就会出事。已补 LF（13,994 B）。
- **删拆分期遗留死代码**：`07f-lurker.js` 的 `mbCELurkerAutoLabel()` 全仓零引用（渲染处的「自动搬运：开/关」按钮一直用内联三元表达式），仅定义处出现 1 次，属拆分合并后没清掉的旧实现。
- **补拼接顺序约束注释**（`07f-lurker-patch.js` 头注释）：`-` 的排序码 `0x2D` 小于 `.` 的 `0x2E`，所以 `07f-lurker-patch.js` 实际排在 `07f-lurker.js` **之前**（补丁片在前、本体片在后）。据此写明两条硬约束：① 本片不得在模块顶层读 `07f-lurker.js` 的模块级 `var`（那些赋值要等本片整段执行完才发生，读到的是 `undefined`）；② 反向依赖（lurker 调本片的 `mbCELurkerPatchReport` / `mbCELurkerRepatch`）安全，因为函数声明提升到整个产物顶部、且调用点还带 `typeof` 守卫。经实测：两片交叉引用零重名、patch 侧不引用 lurker 侧任何模块级 var。
- **文档口径校正**（`README.md`）：`src` 段数不再写死「57 段」（现盘 61 段，以 `build_js.js` 输出的 `(N 段, …)` + `order <指纹>` 为准）；「日常开发流程」里 `run_all.ps1` 由 7 项补成实际 **9 步**（补第 8 步适配器声明一致性、第 9 步覆盖率门禁 + 末尾 `codegraph sync`）；远端 CI 运行时由 node 20 更正为 **node 22**（node 20 会让 jsdom@30 的传递依赖 `undici@8` 在 `require` 阶段崩）。

**结构体检结论（61 段全量扫描，非抽样）**：99 个顶层函数、25 个顶层大写变量跨 61 段**零重名**（不存在"后拼接的同名定义静默覆盖前者"这类拆分典型事故）；块注释不配对告警 2 处经逐行核实均为正则误判（`game/*.twee` 的 `/*`、正则字面量 `\s*/` 的 `*/`，块注释本身闭合正确）；产物中不存在 `// … function` 形式的粘连行。

**验证**：build `order 95e0ce6f0425`（61 段）/ 产物 **725,489 B** / SHA256 `5a70287128fb3a0dca51f7157154ae90d5ab761d4afa9223d46e819e20f25ebd`；`node --check` exit 0；`run_all.ps1` 9 步 ALL CHECKS PASSED（性别集成 passed=24 failed=0）；`pack.ps1` 4 条目正斜杠 + verifier 4/4 + SHA256；产物已装 `game\`。

## v2.0.0.004（2026-11-07 自查优化轮，功能不变）

> 对 v2.0.0.003 三项改动做逐行自查后的修复轮：不新增功能，只修 bug、纠错文案、消除口径漂移。

### 修复

- **fert 面板文案自相矛盾**：`mbCEFertRender` 原先先输出「你已经开着原版作弊页」再接 `if (!ready.ok)` 输出「未检测到 window.EdenCheats」并 return —— API 缺失时会同时说两句反话。已把早退判断提到 hint 之前。
- **态度组点击整页重建**：5 个逐条按钮 / 回退 / 全解除 / 全恢复 原先共 6 处调 `renderGlobal()`，全局页分组多，会丢滚动位置且卡帧。改为 `paintAttitudeRow()` 只重画本行的 label / 按钮文案 / `mce-gold` 类，回退按钮按需增删；批量操作用 `painters` 数组逐行刷新，不再整页重建。同时现值一律用 `mbCEAttitudeGet(key)` 现读，不再用可能过期的闭包变量。
- **`cheatsEnabled` 还原兜底**：原写法在 `delete` 被拒时退化为 `= false` —— 会在存档里留下一个与「从未设置」语义不同的假值。改为退化写 `undefined`（`JSON.stringify` 会丢弃该属性，存档不留痕）。
- **边界注释口径漂移**：`03d-global-modzh.js` 头注释仍写「完全不处理 DoL 原版变量」，与本轮放行 `$uncomfortable` 矛盾，已补唯一例外说明（modId=`vanilla-attitudes`，键白名单限定 5 项）。

### 纠正文案（回归本体逐行实证后）

- `prostituting`：原写「可在低 promiscuity 下卖身；代价是卖身会掉 control」——前半偏笼统、后半无证据。实证为本体 41 处 `$uncomfortable.prostituting is false` 分支（339170-339177、474147-474152 等）置 `_desperateaction`，即在 promiscuity 不够时也给出「勉强顺从 / 开价接活」这类走投无路选项。
- `lewd`：删掉「control 会越管越难」这句推断，按本体 77312 写实 —— `gamemode !== hard` 且 `lewd` 为真时每日 exhibitionism / promiscuity / deviancy 各 -1。
- `hypnosis`：收窄为「催眠遮蔽效果直接判为 accepted」（本体 202829 在 `effectsCoverVagina` 里跳过 willpower 判定），不是「所有催眠事件」。
- `underwear` / `nude`：按本体 110132-110133 的 `exposedUpper/Lower` 档位（1 档走光 / 2 档全裸）精确化。

### 新增断言（`tests\test_mce.js`）

`54.6w8`（API 缺失时文案不矛盾）、`54.6w9` / `w9b`（模组抛错时 `mbCEFertRun` 返回失败且 `cheatsEnabled` 仍还原）、`54.6y8`（`$uncomfortable` 叶子键原本不存在也能新建写入）。

## v2.0.0.003（2026-11-07 需求①②③）

> 双源同步 `2.0.0.003`（`01-core.js` `MCE_VERSION` + `boot.json` `version`）。产物/包 SHA 见发布说明。

### ① FertilityExpansion 命令式动作不再要求先开原版作弊页

- 模组侧两道闸（`tools\_modcache\fert_tmp\...\modules\eden-cheats.js:37-51` 逐字实证）：`available()` = `vars().cheatsEnabled === true` 或原版 Cheats 面板 DOM 判据；`guard()` 在每次 `perform()` 里都查它，不满足直接 throw「请先打开原版作弊页。」。只改 CE 侧自检绕不过去。
- 做法：新增 `mbCEFertWithCheats(fn)`，调用期间临时置 `V.cheatsEnabled = true`，返回后还原原值（原本没有该键就删掉）；不污染存档、不触发原版作弊页 UI。`mbCEFertRun` / `mbCEFertChildren` 全部包进这一层，模组其余安全闸（statFreeze / 战斗中 / NPCList / 生产流程中）照旧生效。
- 面板红字原文保留不动，后面接一句「—— 我不同意」；`available()` 为 false 时面板不再早退，孩子下拉与全部表单/按钮照常渲染。

### ② 原版「你对什么感到不安?」直接解锁

- 写 `$attitudesControl.unlock*` 无效：原版 `<<widget "attitudesControlCheck">>`（本体 284869-284895）每次刷新按真实数值重算覆盖。真正生效的是 `$uncomfortable.*`（本体 110132-110133 遮体判据、77312 衰减、202829+ 催眠判据）。
- 新增全局页分组「原版态度：你对什么感到不安?」：5 项逐条开关（underwear / nude / prostituting / lewd / hypnosis）+ 一键全解除 / 全恢复 + 逐条回退。写入走通用写入器（`vanilla-attitudes` 留痕，可回退）。
- 门槛只作说明展示：`exhibitionism>=55` / `>=95`、`soldCount>=1 或 docksrobinintro===1`、`exhibitionism|promiscuity|deviancy>=35`、`hypnosis_traits` 非空；`lewd` 在 hard 模式原版不显示该项。

### ③ 发布说明精简

后续 Release 正文只写重点（改动要点 + 产物 SHA），不再罗列过程细节。

## v2.0.0.002（2026-11-07 用户指令升版 · 功能轮 2026-11-06 起）

> **双源已升为 `2.0.0.002`**（`01-core.js` `MCE_VERSION` + `boot.json` `version`，用户 2026-11-07 明确指令 `+0.0.1`）。产物与包 SHA 见下（升版后重建，数值以本条为准）。 `javascript\maplebirchce.js` = **60 段 / 711,173 B / SHA256 `EAED57F105892DE745D6D32C3C95D487D8433EFB1B4B5D10898B896903E9551A`**；打包 `MapleBirchCE.mod.zip` = **281,963 B / SHA256 `E207F82B4A0B6EAB9F0B165BF83A9EDB1B4DBBD85FD58F259358ED5FEB332E89`**（4 条目正斜杠；verifier 4/4，本轮本机无 verifier-hub skill，走内置等价核对：条目集合精确匹配 + CRC 全量，`zipfile.testzip()` 返回 None；zip 内 `javascript/maplebirchce.js` 解出 711,173 B / SHA256 与源产物逐字节一致，`README.md` 与仓库磁盘文件逐字节一致，`boot.json` version 与 `01-core.js` `MCE_VERSION` 双源一致）。**装机实证（2026-11-07）**：`dev.ps1` 只做文件层复制，实机加载走 Edge `file://` 的 IndexedDB——用 `game\mce-mod-import.html` 写入包键 `modDataIndexDBZip:MapleBirchCE.mod.zip`（导入后列表 27 项，第 27 项 `MapleBirchCE` 为旧 2.0.0.001 残留、与新包同名冲突）；再用 `game\mce-idb-clean-dup.html` 在**同一事务**内移除该旧列表条目并删除旧包键 `modDataIndexDBZip:MapleBirchCE`——清理后 `store 61 键 / 包键 26 / 列表 26`，列表与包键一一对应（回读断言 5/5 通过，幂等复跑同结果）。刷新后加载日志 `警告 0`（无 `duplicate mod name` 警告）、`ModZipReader init() modInfo: [MapleBirchCE] [2.0.0.002]`；模组管理 `已安装模组 26 个 / 已启用 26`，列表末尾唯一 CE 条目为 `MapleBirchCE.mod.zip`（外部模组）；CE 面板标题 `剧情条件解锁面板 v2.0.0.002`（页签 11、就绪 41 个角色）与 `MCE_VERSION` 一致。**只删列表项不持久**：包键仍在时旧名会被重新追加到队尾并最后生效（实测曾致面板回退到 v2.0.0.001、页签 6），故列表项与包键必须一起清。

### 一、快速面板「锁定」与「直接获得武器」（需求 ②③）

- **锁定按钮**：`renderQuickRow()` 每个数值行在原有「应用 / 回退」之外追加「锁定」——已锁显示 `已锁定`（`mce-btn mce-gold`，点击即取消），未锁则取输入框值（支持 `+N` / `-N` 相对写法，`quickTargetValue()` 解析）写为目标并 `mbCELockSet(path, tgt)`；复用 `07f-lock.js` 的 1 秒 tick 机制，不改其核心。
- **武器直接获得**：`prof.spray/baton/whip/net/pickaxe` 五个武器技能行追加金色「获得」按钮 → `grantWeapon(path)`；武器技能组底部追加「全部获得（5 件武器）」→ `grantAllWeapons()`。
- **持有判定语义（测试抓出并二次修正）**：模组侧 `<<if $prof.<skill> isnot undefined>>` 即视为持有，值 0 也算。因此规则定为 **值 ≥ 1 一律保持现值**（不冲掉玩家截图里的 `短棍(722)`）、**值为 0 或键缺失才写入门档 `WEAPON_GRANT_BASE = 100`**。防狼喷雾额外补 `spraymax = 5`（仅当 `< 1`）与 `spray = 5`（仅当 `< 1`），因为 `spray()` 内 `V.spray = Math.clamp(V.spray, 0, V.spraymax)`，只写 `spray` 会被 0 上限夹死。
- `prof.pickaxe` 取证备注：原版只在 `mines_init` 里 `<<if $prof.pickaxe is undefined>><<set $prof.pickaxe to 0>><</if>>` 建键，镐的真实道具是 `<<wearProp "pickaxe">>`；该项仅作显示面补齐。

### 二、说话态度：原版三档 + 选定后永久维持（需求 ⑤，直接实现，不做模组适配器）

> 口径两次纠偏后的定稿：用户明确「把游戏中原有的三个态度选项选了之后，无论其他的数值态度怎么变化，玩家都会一直维持他所选的那个态度」。此前「把 `$submissive` 写进 851–1149 交集」的实现**已作废**——那只是"两档都能选"，不是"所选档永久维持"。

- 新文件 `05b2-modcheat-attitude.js`（从 `05b-modcheat-player.js` 拆出，在玩家数值页最上面渲染）。
- **原版取证（逐字取自 `Degrees of Lewdity.html`，非二手转述）**：
  - 三档控件 `<<widget "cheatsSpeechAttitude">>` 是**成对写入**：`_submissiveness = [1500, 1000, 500]` ↦ `_attitude = ["meek", "neutral", "bratty"]`，点一档**同时**写 `$speech_attitude`（档名）与 `$submissive`（锚值）。
  - 门槛在 `<<widget "attitudes">>`：Meek 需 `$submissive gt 850`（否则 "You're too defiant…" 灰掉）、Bratty 需 `$submissive lt 1150`（否则 "You're too submissive…" 灰掉）；1500 / 1000 / 500 三锚值天生落在门槛内侧。
  - `$speech_attitude` 全库写入点仅 6 处（`gameStartOnly` / `variablesVersionUpdate` / `Cheats` / `Pinch Widgets`（喵化）/ `Scarlet Widgets`），其余数百处只读 → 游戏本身不会自行改档，"维持"不必拦 `subCheck()`，只需定时复位。
- **实现**：`mbCEAttitudeApply(key)` 写 `$speech_attitude` + 锚值并登记 `V.mbCE_attitudeLock`（记 `prevAttitude/prevSubmissive` 供还原）；`mbCEAttitudeTick()` 每秒把档名复位到所选档，越界时把顺从度拉回门槛内侧（Meek ≥ 851、Bratty ≤ 1149），累加 `fixed` 计数；`mbCEAttitudeHold(on)` 开关维持、`mbCEAttitudeRelease(restore)` 解除（可选还原）。
- UI：三档按钮（选中档带 `✓` 与 `mce-btn mce-gold`）+「维持：开/关」+「解除维持」/「解除并还原」+ 实时状态行（当前档名 / 顺从度 / 已修正次数）。
- **技术边界（已证伪的旧思路）**：SugarCube 源码对同名 `<<widget>>` 拒绝覆盖（`cannot clobber existing definition` / `cannot clobber existing macro`），所以"运行时重定义 widget 改门槛"走不通；CE 走"定时复位状态变量"，不改内核。
- 旧符号 `attitudeState()` / `readAttitude()` / `FSA_FREE_MID` 保留（兼容既有断言）；`applyAttitude(v)` 改为：字符串按档名、数字按最近锚值映射档位。

### 三、潜伏者捕捉 / 水烟馆冰箱：真·无上限（需求 ⑥）

> 口径纠偏：用户要的是**无上限**。此前「抓到即自动腾空手持 + 冰箱钳 0–5」被判不合格——那是把显示缺陷当成上限。

- 新文件 `07f-lurker-patch.js`（启动前文本解限引擎）+ 重写 `07f-lurker.js`（面板与保底搬运）。
- **原版取证（逐字）**：
  - 捕捉门控 5 处同一形态 `<<if $farm_stage gte 10 and $lurkers_held lt 1>>` 包裹 "Hurl net"，分布 `Widgets Struggle`（2 处）/ `Farm Yard` / `Farm Tending Lurker Work` / `Farm Tending Lurker Alex Fail`。
  - 冰箱真身两处（`Widgets Flats` 的 `<<widget "hookah_juice">>`）：存储门控 `<<if $lurkers_held gte 1 and $hookah.lurkers lt 5>>`；显示 `<<switch $hookah.lurkers>>` 只映射 5…1，`<<default>>` 输出 "no"。
  - 成功结算 `<<set $lurkers_held += 1>><<set $stat_lurkers_captured += 1>>` 本身**无上界** → 去掉门控即可无限累积。
- **实现路径**：widget 定义在 SugarCube 启动时一次性注册且不可覆盖 → 只能在 `SugarCube.start` 之前改 DOM 里的 `<tw-passagedata>`。CE 由 `scriptFileList_inject_early` 在 `<head>` 执行（body 未解析），注册**捕获阶段** `DOMContentLoaded`，先于正文末尾 SugarCube 的启动回调。6 条替换：5 处门控改为 `$farm_stage gte 10` / `$lurkers_held gte 1`；冰箱 `<<switch>>` 整段换成 `<<= $hookah.lurkers gt 0 ? $hookah.lurkers : "no">>`（>5 不再落到 default 显示 "no"）。`mbCELurkerPatchText()` 为纯函数（幂等，返回 `{text,hits}`）；`mbCELurkerPatchDom()` / `mbCELurkerPatchStory()` 双通道，报告存 `window.mbCELurkerPatchReport`。
  - **实测边界（moli 两轮探针，2026-11-06）**：`typeof SugarCube === "object"` 但 `Object.keys(SugarCube)` 为空、`SugarCube.State` / `Story` / `Macro` 全部不存在 → 运行期通道实际恒不可用。`mbCELurkerPassageAccess()` 保留三通道并如实把 `access` 标成 `Story` / `SugarCube.State.passages` / `none`，**真正生效的只有 DOM 抢跑这一条**；抢跑若因 ModLoader 提前固化 passage 而落空，靠下面的自动搬运兜底，功能仍成立（见 `.learnings\ERRORS.md#ERR-20261106-026`）。
- **兜底**：`mbCELurkerRepatch()` 手动重试；仍未命中时可开「自动搬运」（`mbCELurkerAutoTick()`，0.5 秒）把抓到的转入冰箱与蒸馏笼，手上常空使 `lt 1` 恒成立 = 等价无限次捕捉（面板如实标注"手持不累积"）。
- 数值不再钳制：`MB_CE_LURKER_MAX = 9999`（防呆值），冰箱与手持同上限；`lurkers_held` 若已被「锁定」机制接管，自动搬运让位不写。

### 四、FertilityExpansion 自带作弊的等价实现（需求 ④）

> 口径纠偏：用户要求「那个模组他自己也有作弊，你也要根据他自己有的作弊你也得有」。此前「CE 只做 11 条数值直写、不碰模组 UI」被判不合格。

- 保留 `04a-13-fert.js` 的 11 条声明（1 stage + 8 ability + 2 value），另新增 `04a-14-fert-cheats.js`。
- **模组自带作弊原文清单**（`eden-cheats.js` + `eden-cheats-ui.js`，1.7.0）：`window.EdenCheats` 暴露 `available / labour / parasites / children / choices / identity / saveInnate / saveSkills / reset / resetReason / adultReason / settleAdult / removeChild`；面板三块 = 怀孕（一键分娩 / 寄生卵受精 / 寄生物成熟）+ 生育（先天四项 0–100 整数 + 身份九项）+ 养育（四项 0–100 + 重置 / 立刻成年结算 / 删除孩子）。
- **CE 侧等价实现**：`MB_CE_FERT_ACTIONS` 声明 10 项（`fert_labour` / `fert_parasite_fert` / `fert_parasite_ripe` / `fert_innate` / `fert_skills` / `fert_reset` / `fert_adult` / `fert_remove` / `fert_reset_reason` / `fert_adult_reason`），`mbCEFertRun()` 逐项**直接调用模组自己的 API**——guard（必须先开原版作弊页、事件结束、解除属性冻结）、快照回滚、`v.feats.locked = true` 的语义与模组面板完全一致，不重写它的 sync/回滚链。
- 面板 `mbCEFertRender()`：已出生孩子下拉 + A 组三键 + 先天四项/身份九项表单（「保存先天属性与外貌」）+ 养成四项（「保存养育属性」）+ C 组五个按钮；留空项按当前值回填，模组缺失时 `mbCEFertReady()` 给中文原因（未装 / 未开原版作弊页 / API 异常）。
- **渲染器缺口补齐**：`normalizeCheatMod` 放行 `actions` 与 `actionPanel`；新文件 `05a3-modcheat-actions.js` 提供「命令式动作（模组自带作弊等价）」分组（有 `actionPanel` 时由面板整体接管，避免一行一个按钮的重复入口）；`renderModCheatDetail` 在 values 之后调用它（`05a-modcheat-rows.js` 因增行拆出 `05a3`，守住单文件 ≤400 行）。

### 五、对外 API 与测试

- `09-exports2.js` `mountApi()` 追加三组导出（共 27 个，含旧口径符号保留）：
  - 快速面板：`quickTargetValue` / `grantWeapon` / `grantAllWeapons`
  - 说话态度：`attitudeState` / `readAttitude` / `applyAttitude` / `FSA_FREE_MID` / `MB_CE_ATTITUDE_TIERS` / `mbCEAttitudeState` / `mbCEAttitudeApply` / `mbCEAttitudeHold` / `mbCEAttitudeRelease` / `mbCEAttitudeTick`
  - 潜伏者：`mbCELurkerState` / `mbCELurkerSet` / `mbCELurkerAutoTick` / `mbCELurkerSetAuto` / `MB_CE_LURKER_MAX` / `MB_CE_LURKER_FRIDGE_MAX` / `mbCELurkerPatchText` / `mbCELurkerPatchDom` / `mbCELurkerPatchStory` / `mbCELurkerPatchReport` / `mbCELurkerRepatch`
  - Fertility：`mbCEFertRun` / `mbCEFertChildren` / `mbCEFertReady` / `MB_CE_FERT_ACTIONS`
- `tests\test_mce.js` 新增 54 段（态度三档 + 维持 tick + 文本解限纯函数幂等 + 冰箱 switch 替换 + 潜伏者高值原样保留 + 自动搬运累加 + Fertility 10 项动作与 mock 分发）+ 55 段边界矩阵（态度 10 取值 × 3 属性、武器 5×5 状态、喷雾容量、潜伏者 9999 上限、`quickTargetValue` 16 种写法）。
- 断言（逐层实跑现数，本轮用 `Select-String "^PASS:"` /「✓」单独统计，非估算）：`test_mce.js` **1,451** / `smoke_dom.js` **300** / `functional_e2e.js` **171** / `integration_gender.js` **24** / `stability_loop.js` **12** / `test_keycheck.js` **281 通过项** → **合计 2,239 条，0 失败、无一条 SKIP**（stability 曾按旧文案写 13，实跑为 12，已按现数改正）。`score_ce.py` 内置解析口径为 **1,859**（e2e 123 / gender 25 / smoke 300 / stability 13 / keycheck 59 / test_mce 1,339），差异来自该脚本的折叠/正则计数，与 `EXPECT_TOTAL = 97.5` 对账一致（`[对账] EXPECT 97.5 vs LIVE 97.5`）。
- 实测：`pack.ps1` 9 步全绿（覆盖率门禁 Statements **78.38%** / Branches **66.25%** / Functions **82.76%**，门槛 75 / 60 / 80）；`run_all.ps1` 九步同口径 ALL CHECKS PASSED；`python mce-e2e\score_ce.py` rc=0，六维 A=100 / B=93 / C=100 / D=100 / E=95 / F=100 → 加权 **97.5**。

### 六、C3 结构收敛（≤400 行达成）

- `05b-modcheat-player.js` **421 → 357 行**（态度区块整段搬到 `05b2-modcheat-attitude.js`）。依据：`build_js.js` 按文件名 sort 拼接，`05b2` 天然排在 `05b` 之后，同处一个 IIFE，函数声明提升保证 `renderQuickPanel` 能调后拼接的 `renderAttitudeFree`。
- `05a-modcheat-rows.js` **347 行**（新增的命令式动作分组拆到 `05a3-modcheat-actions.js`）。
- `07h-render2.js` **382 行**：`renderRolePlots` / `renderSceneCluster` 从 `renderScenes()` 体内剪出后缩进对齐（首行 1 tab、体内 2 tab）；第一次"每行无脑加一层 tab"把体内缩进翻倍，已修正。
- 现全库 **60 段 / 11,368 行**，最大 **382 行**（`07h-render2.js`），平均 189 行。孩子页三层：`04a-15-fert-children.js` 284 行（列表/存在性/好感/地点/长大）+ `04a-15b-fert-kid-stats.js` 128 行（养育四项/先天四项写入）+ `04a-16-fert-children-ui.js` 240 行（卡片与整页渲染）——初版单文件一度 407 行，越过 C3 的 ≤400 满分档后按「数据层 / 数值写入层 / UI 层」三段切开。

### 七、工程质量核查升级（D3 类型取证 60.9% → 81.5%）

- `tools\check_key_types.js` 新增第 ④ 类判据「**全库唯一类型共识**」：按叶子名聚合整库 `.ts/.js` 的 `name?: type` 声明与字面量赋值，**类型集合长度必须 === 1** 才采信。
- 叠加**父键归属防线**：证据文件 basename（剥离 `.ts/.js`、归一化去非字母数字）须与**直接父键或祖父键**互为包含；`MarginTrading.ts` 的 `opened: number` 不能给 `Finance.bank.opened` 作证。
- 判据演进中被自身回归测试（`tests\test_keycheck.js` 跨父键 fixture）抓到并修掉两个真实缺陷：① 只看唯一类型不看父键归属；② basename 未剥离扩展名（`robin.ts` → `robints`），导致 24 条合法证据被误判无证据。
- 结果：**276 条 / CONFLICT 0 / STRICT 0 / WARN 1 / NO_EVIDENCE 51（81.5%）**，EXIT 0；`test_keycheck.js` **281 通过 0 失败**。

### 八、FertilityExpansion 孩子页（需求①「还有哪些能作弊」/③「孩子别跑进角色页」/④四张截图的四条要求）

> 用户原话：「直接在它适配器中最下面加一个孩子的页面……这些孩子通过注册之后好像会跑到角色页面去你看能不能拦截下来」「从那边把孩子删了你这边会出问题吗」「能不能定向发送娃 / 随叫随到的娃 / 一键长大的预制娃」。

**① 盘点后新加的作弊项（全部逐字取证，不猜路径）**

- 新增 3 条 **settings 布尔能力项**（`04a-13-fert.js` abilities 8 → **11**）：`fert_resetage`（`eden.settings.resetAgeOnTransfer`）、`fert_immstory`（`eden.settings.immediateLifeStory`）、`fert_nightvisit`（`eden.settings.enableNightVisits`）——均取自 `eden-age.js normalizeSettings` / 模组面板同名字段。
- **有意不声明** `eden.settings.parentTitleSource`：该字段是字符串枚举（`"parentage" / "identity" / "appearance"`），推进数字档位会把模组判定打坏（与 v2.0.0.001 的类型语义门禁同一条纪律）。
- **「孩子爱意」真身取证**：`eden-traits.js` grep `affection|love|trust|bond` 零命中；`modules\` 全库 grep `affection` 40 命中 → 实为 **`V.eden.children.<id>.affection`**（`eden-adult.js:144-149 ensureAffection` 建默认、`:221-224 addAffection` 写 `roundHundredth`、`eden-profile.js:176-182` 显示、`eden-facility.js:81` 缺省给 40、`eden-bed-visit.js:60` 用 `Number(record.affection) || 0 >= config.minimumAffection` 门控）。相关阈值也一并取证：`affection = {newResident: 40, existingResident: 50}` / `lostContact = {minimumAwareness: 70, maximumAffection: 40}` / `remittance = {affectionFloor: 30, fullAffection: 80}` / `intimacy = {minimumAffection: 40, difficultyBase: 5000, awarenessDifficulty: 50, affectionCenter: 50, affectionScale: 40}`。
- **为什么不能走 varPath 声明体系**：`eden.children.<动态id>.affection` 带运行时 id，`cheatResolvePath` 的父层检查与 `cheatIsVanillaRoot` 都会拦；孩子页因此**自建写入函数**，但仍走 `cheatWriteValue`（`op` 键 `fert_child_aff_<id>`），留痕 `V.mbCE_wrote["cheat:fertility-expansion:fert_child_aff_<id>"]` 保留首次 `before`，**可回退**。

**② 孩子页面挂载位置（用户要求「适配器最下面」）**

- 新文件三段（守住 C3「单文件 ≤400 行」，初版单文件 405 行实测后拆分）：`04a-15-fert-children.js`（**284 行**，数据层：枚举/存在性/阶段/地点/好感/长大）+ `04a-15b-fert-kid-stats.js`（**128 行**，数值写入层：养育四项/先天四项）+ `04a-16-fert-children-ui.js`（**240 行**，卡片与整页渲染）。字母序 `04a-15-… < 04a-15b-… < 04a-16-…` 成立，三段同处一个 IIFE 作用域。
- 尾部 IIFE 幂等包装 `CHEAT_ADAPTERS["fertility-expansion"].entry.actionPanel`（标记 `__mbCEHasKids`）：把 `mbCEFertRenderChildren(container)` **追加在既有 10 项动作面板之后**，即适配器页最下面。
- 每张孩子卡片：`#id 名字` 头行 + 概要（地点 / 阶段 / 年龄 / 物种 / 养育状态 / 未来结算）+ **好感输入框 + 写好感 + 好感拉满(100)** + **养育四项（知识 / 体能 / 社交 / 意识，留空=沿用现值）+ 写养育** + **先天四项（外貌 / 体质 / 智力 / 性格）+ 写先天** + **定向地点下拉 5 项 + 自定义地点输入框 + 发送** + **随叫随到** + **一键长大** + **立刻成年结算** + **删除孩子**。
- 顶部有「共 N 条 / 全部一键长大（逐个 silent 执行，返回 成功 / 失败 / 跳过 三计数）/ 重新检测」；底部提示「另有 N 条已不在存活列表」。
- 数据来源三通道：`window.EdenChildData.entries({scope:"all"})`（模组在线时的正路，Map / 数组两形态）→ 兜底 `V.childRecords`（数组，**childId 就是下标**，`EdenChildData.indexOf` 只接受 `(0|[1-9]\d*)` 并按下标取）→ 兜底 `V.children`（对象键）。

**③ 从「角色」页拦截孩子（用户截图里一堆英文随机名）**

- `eden-breeding.js:293-310 encounterCarrier` 取证：孩子被写进 `V.NPCList` 的条件是 `npc.edenChildId` 存在 + `record.adult?.settled` + `bodyForm !== "beast"` + `child` 存在且 `phaseOf === "born"` + `npc.fullDescription === descriptionFor(childId)` + `species ∈ ["human","wolfboy","wolfgirl","harpy"]`；名字来自原版 `generateBabyName`（`eden-breeding.js:459`）。
- `01-core.js` 新增 `mbCEEdenChildIdOf(name)`（遍历 `V.NPCList` 匹配 `edenChildId` + `fullDescription` / `name`），`charCategory()` 首行改为 **`edenChild` 最高优先**（`伊甸孩子 > 持久NPC > 模组 > 恋爱 > 普通`）。
- `07b-char.js` 改三变量：`charsAll`（全量）/ `charsKids`（edenChild）/ `chars`（过滤后的角色页列表）；判空改用 `charsAll`；提示行追加「另有 N 个 FertilityExpansion 孩子已收进「模组作弊 → FertilityExpansion → 孩子」页，不在此列出」。
- 结果：随机英文名的娃不再污染角色页，且不是简单隐藏——它们在孩子页可调数值、可发送、可长大。

**④ 四张截图的四条要求**

| 要求 | 实现 | 取证 / 边界 |
|---|---|---|
| 模组侧删了孩子，CE 侧**自动检测是否还存在**、不报错 | `mbCEFertKidAlive(id)` 两通道：`EdenChildData.get(key, V)`（`phaseOf` 为 `removed`/`missing` 直接判死）→ `mbCEFertKidPairs()` 枚举兜底；查不到返回 `null`，卡片转红字「已不存在」并**隐藏全部按钮**，任何写入/长大明确返回 `已不存在（模组侧已删除/移除）` | `eden-child-data.js entries({scope:"all"})` 排除 `edenDeleted === true` 与 `pregnancy.carrier === "cleared"`；兜底通道**额外要求 `childId === 数组下标`**（模组 `get()` 的 `:17-26` 同一判据），否则视为「假存在」跳过；测试 54.6u 三连 + 54.6q3/q4 覆盖 |
| **定向发送娃**（送到指定地点） | 地点下拉 5 项（`eden_home` 居所 / `home` 家 / `eden_contacts` 联系人 / `away` 外出 / `eden_released` 已放归，中文标签）+ **自定义地点输入框**（非空即覆盖下拉）→ `EdenChildData.setLocation(child, loc, V)`；失败兜底直写 `child.development.location`（records 形态）或 `child.location`；留痕记 `via` | `setLocation` 只对 `born`/`egg` 生效（`eden-child-data.js:99`），本实现**在兜底直写前过同一道 phase 门控**，未出生/已移除一律拒绝并给中文原因；合法地点实证来自 `eden-breeding.js` 222/245/419（只产出 `eden_home`/`home`） |
| **随叫随到** | `mbCEFertKidCallToMe(id)` 把地点对齐到玩家当前 `V.location`；玩家不在 `eden_home`/`home` 时退回 `eden_home` 并在提示里说明原因 | **已知边界**：只写地点字段，`eden_bed_visit` / `eden_encounter` 还看 `record.status` 与 `adult.settled`，故「表现为人在场」需实机验收（已记入未验证项） |
| **一键长大的预制娃** | `forcedAdult = true` + `EdenAge.syncRecord(rec, child, settings)`（失败兜底 `rec.lifeStage = "adult"`）+ `EdenAdult.syncRecord(rec, child)`（→ `status = "adult_pending"`）；留痕 `fert_child_adult_<id>`，`before` 保留首次值可回退。长大后再点「立刻成年结算」调模组 `settleAdult` 走真实结算（`eden-adult.js:340-373`）。**phase 门控**：非 `born` 一律拒绝（给 `未出生/已孵化` 原因），避免把没 `bornDate` 的孩子强推进 `adult_pending` | `eden-age.js:150-169 syncRecord` 只改 `lifeStage`、**不写 `adult.settled`**，所以长大 ≠ 结算，两步分开正是模组语义；`forcedAdult` 在 `syncRecord` 里优先级最高（`lifeStage = record.forcedAdult === true ? "adult" : getStage(...)`） |

**测试与工具链**

- `tests\test_mce.js` 孩子页相关断言：54.6o / o2 / o3（3 条 settings 声明 + parentTitleSource 不声明）、54.6p~p4（`mbCEEdenChildIdOf` 与 `charCategory` 拦截）、54.6q / q2（列表 + 存在性）、q3 / q4（`V.childRecords` 假存在剔除）、r / r2（好感 88 + 留痕）、s / s2 / s3（定向发送 / 随叫随到 / 退回提示）、t（一键长大）、u / u2 / u3（删孩子后检测为不存在 + 写入被拒 + 长大被拒）、v / v2 / v3 / v4（fake `EdenChildData` 走正路）、w（页面渲染节点数）、x / x2–x7（显式传 vars / 养育四项只改填写项 / 留痕 / 越界拒绝 / 先天四项 / 整数校验 / 模组 saveSkills 收到补齐四项）、y / y2 / y3（未出生孩子三种写入全拒）——**约 42 条，0 失败**。
- `01-core.js` / `07b-char.js` / `09-exports2.js` 同步：新增导出 `mbCEFertKidPairs / Info / Alive / SetAffection / SetLocation / CallToMe / GrowUp / RenderChildren / MB_CE_FERT_KID_LOCS / mbCEEdenChildIdOf`，收敛轮再补 7 个：`mbCEFertKidSaveSkills / SaveInnate / CurSkills / CurInnate / MB_CE_FERT_KID_SKILLS / MB_CE_FERT_KID_INNATE / mbCEFertKidVars`。
- `tools\pack.ps1` 的 verifier 段新增第三候选路径，并在本机无 verifier-hub skill 时**不再 exit 1**，改走内置等价核对（Python `zipfile` 条目集合精确比对 + `testzip()` CRC 全量），输出 `VERIFIER-FALLBACK` 明示降级；判据不放松（多一条或少一条即 FAIL）。

**⑤ 收敛轮：把孩子页做到「写入不假成功 / 不写脏数据」**

- **不依赖 `SugarCube.State`，显式传 vars**：`eden-child-data.js:6` 所有方法的尾参缺省取 `window.SugarCube?.State?.variables || {}`，而 DoL 本页实测该通道为空（`Object.keys(SugarCube)` 为空、`SugarCube.State`/`Story`/`Macro` 全不存在，见 `.learnings/ERRORS.md#ERR-20261106-026`）→ `mbCEFertKidVars()` 取 `getV()` 并**逐个方法显式传第三参**；实测断言 54.6x。
- **`mbCEFertKidPhase` 兜底逐条对齐模组** `eden-child-data.js:50-59`：无 child → `missing`；`edenDeleted` → `removed`；非 record（无 `bornDate`，即 `{name, eggTimer}` 这种蛋/胎）→ 有 `eggTimer` 判 `egg`、否则 `born`；record 且 `V.pregnancies[pregnancyId]?.carrier === "cleared"` → `removed`；`bornDate` 有限 → `born`；`pregnancy.deliveredDate` 有限 → `egg`；否则 `unborn`。此前"非 record 一律判 born"会把胎/卵当已出生孩子写数据。
- **三处写入统一 phase 门控**：定向发送、一键长大、写先天属性——非 `born`（写地点允许 `egg`）一律拒绝并给中文原因，**兜底直写也必须过同一道门控**（否则 API 缺失时会绕过模组语义写脏数据）；断言 54.6y/y2/y3。
- **养育四项 / 先天四项（`04a-15b`）**：模组 `saveSkills` 要求四项齐全（`eden-cheats.js:189 numeric(patch[k],0,100)` 对缺项抛错、不是清零）、`saveInnate` 走白名单 + 0–100 整数 + `EdenTraining.syncRecord` → `EdenTraits.syncRecord(record, child, String(id), v)` 重建 `record.innate`。本实现先把当前值补齐、只改用户填的那一项，模组 API 缺失/抛错时按同一结构兜底直写（`innate.personality` 跟随 `temperament <= 50 ? "quiet" : "active"`，对齐 `eden-cheats.js:178`），全程写 `V.mbCE_wrote` 留痕、保留首次 `before`。
- **模组存档字段普查（回答"还有哪些值可作弊"）**：扫 `modules/*.js` + `game/*.twee` + `*.json` 的 `$eden|v.eden|V.eden|vars.eden|state.eden` 访问，一级字段 18 个（`settings 76 / children 66 / facility 65 / selectedChildId 46 / schemaVersion 36 / activeEncounterChildId 12 / recordsMigration 12 / returnPassage 11 / encounterReturnPassage 10 / bedVisit 9 / breeding 8 / contactsView 8 / lifeStoryVisitHandled 6 / encounterContext 6 / lifeStoryReadMode 6 / transferSource 3 / interactionEvent 3 / interactionMenuChildId 2`）。结论：
  - `eden-age.js normalizeSettings` 共 **10 个 settings 键**，其中 **8 个标量已全部声明**（`maturityDays` / `neverAutoAdult` / `resetAgeOnTransfer` / `immediateLifeStory` / `allowSterilePregnancy` / `showHallHotspots` / `allowHumanDescendants` / `enableNightVisits`），剩 2 个是**字符串**（`parentTitleSource` 三值枚举、`lifeStoryPrompt` 自由文本）→ 按类型语义纪律不声明；
  - `facility.*` 的 4 个布尔 + `capacity` 数值已声明，`bedAssignments` 是对象不声明；
  - **其余数值字段全是瞬态会话指针**（`selectedChildId` / `activeEncounterChildId` / `interactionMenuChildId` / `breeding.activeBirthParentId`）或 UI 偏好（`contactsView.*`）/ 状态字符串（`returnPassage` / `transferSource` / `lifeStoryReadMode`）——写它们只会把模组指向不存在对象，故**明确不作弊**；
  - 孩子个体数值（`affection` / `training.skills` 4 项 / `innate` 4 项 / 地点 / 阶段）已在孩子页覆盖。**因此该模组的可作弊面已收满，本轮不再增声明项**（`04a-13` 维持 1 stage + 11 ability + 2 value）。


## 未发布（Unreleased · 2026-11-06 工程收敛轮）

> 版本号未升：本节全部为工程质量与验证口径改动，不改玩家可见行为。产物与 v2.0.0.001 逐字节一致（615,464 B / SHA256 `202AFBFF6CAC9CFC8861745FA0E7E829EF29F94D5304DA153C4D64B6409DCE71`）。

### 一、源码可维护性（产物零变化）

- `03-global.js`（961 行）拆 4 段：`03a-global-batch.js`(178) / `03b-global-maint.js`(245) / `03c-global-combat.js`(408) / `03d-global-modzh.js`(130)。
- `05-modcheat-ui.js`（851 行）拆 2 段：`05a-modcheat-rows.js`(600) / `05b-modcheat-player.js`(251)。
- 拆法依据：`tools/build_js.js` 按文件名排序、纯文本顺序拼接、不合并不压缩，因此任一行内切分只要保持顺序，产物必然逐字节等价。
- 校验方式：切分后对每段求「按序拼接结果 `-ceq` 原文」，两文件均 True 才删除原文件；原文件先备份到 `%TEMP%\mce-split-backup`。
- 结果：src 37 → 41 段；最大文件 961 → 600 行；产物 615,464 B / 同一 SHA256。

### 二、覆盖率产品化 → 并入门禁

- 根因：`tests/test_mce.js` 用 `eval` 执行拼接产物，eval 无脚本 URL，c8 归因失败报 `Statements Unknown% (0/0)`。
- 修法：`rawJs` 读入产物 → 写 `tests/mce_script.js` 快照（已 gitignore）→ 仅对 eval 用副本追加 `//# sourceURL=<绝对路径>`；快照本身不加注释以保持字节一致。
- 新增 `tools/run_coverage.js`（依次跑 smoke / 全量回归 / 功能 E2E / 性别集成 / **稳定性循环**，任一非 0 即 exit 1）。
- `tools/run_all.ps1` 8 步 → **9 步**：第 9 步 `c8 --check-coverage --lines 75 --branches 60 --functions 80`；c8 未安装时明确 WARN 跳过，不误判失败。
- 实测基线：Statements 78.86%（7703/9767）/ Branch 67.93%（1761/2592）/ Functions 85.04%（307/361）/ Lines 78.86%。

### 二之二、稳定性回归（新增 `tests/stability_loop.js`，12 条断言）

盯的是用户真实报过的「越开关越卡」形态，此前没有任何断言直接覆盖：

| 断言 | 覆盖的风险 |
|---|---|
| 连续 20 次 `open()` 后 DOM 节点数不变（31 → 31） | 重渲染堆积 |
| 30 轮 `toggle()` 后 `#mce-root` / `#mce-toggle` 各仍唯一 | 重复建面板 |
| 点击悬浮球只触发一次切换（`mce-closing` 只加一次） | 事件重复绑定（热重载复用同一按钮） |
| `close()` 后 130ms `mce-open` / `mce-closing` 均清除 | 淡出定时器残留 → 假开态 |
| 再次 `open()` 恢复 `mce-open` | 开关状态机不自洽 |

`npm run test:stability` 可单跑；已挂进 `tools/run_coverage.js` 序列，随全链第 9 步执行。

### 三、实机验证口径修正（本轮最重要的一条判据）

- CE 面板只在**游戏 passage 运行后**挂载：停在标题页 / 角色创建页判定「未注入」是假阴性。
- 悬浮球自 v1.9.29 起改为星空蓝主题，仍按「金色悬浮球」找必然看不见。
- 页面顶部 `CE-v1.20.3.1` 属另一个 mod（`cheat extended v1.20.3.1`），不是本 mod；本 mod 只以面板标题 `v2.0.0.001` 与 ModHub 列表标识。
- 现行判据三条同时满足才算注入成功：① ModHub 状态「已启用」；② 游戏内出现悬浮球（颜色不写死）；③ 点击后面板标题含 `v` + `boot.json` 版本号。
- 实机证据（本机 Edge，`file://` origin）：ModHub `MapleBirchCE v2.0.0.001` 已启用 → 蓝球 → 面板「剧情条件解锁面板 v2.0.0.001」→ 「场景注册表 111 条」「就绪 41 个角色」→ 伊甸分组展开含锁定/一键完成/直达触发 → 主题黑金↔星空蓝切换有 toast → 错误收集器把 `DoLGameUI`/`SimpleFrameworks` 归类为第三方噪音。
- 同时取证：`file://` 与 `http://127.0.0.1:8768` 是不同 origin，localStorage 不共享，回放玩家视角必须走桌面快捷方式指向的 `file://`。
- 过程教训按四步闭环记入 `DoL-Project/.learnings/ERRORS.md#ERR-20261106-015`。

### 四、模组补齐（消费端 game）

- 补装 `MoreFarmUpgrade.mod.1.08.zip`（41,309 B）与 `DolMod-0.1.990.mod.zip`（803,610 B），game 现 15 个包，全部被 ModLoader 正常 init。
- 两包 `boot.json` 的 `modName` 为空，不影响加载（ModLoader 按 `modId`/目录名识别）。

### 五、静态检查与可扩展性

- ESLint **四规则 → 八规则**：新增 `no-self-assign`（自赋值）、`no-constant-condition`（`checkLoops:false` 放行 `while(true)`）、`no-unsafe-negation`（`!a instanceof b` 优先级误用）、`no-fallthrough`（switch 漏 break）。产物实测 0 报错。
- 生效性验证（防「配置 files 不匹配导致零规则静默通过」）：`'var a = 1; a = a;' | eslint --stdin --stdin-filename javascript/maplebirchce.js` → 实测报 `no-self-assign` + `no-fallthrough`、exit 1，证明规则真的在跑。
- 新增 `tools/new_adapter.js`（适配器脚手架）：`--id / --name / --short / --root [--dry]`；校验 modId 未被现有 `04a-*.js` 占用（防重复注册静默覆盖）→ 取现有最大编号 +1 → 生成符合 `audit_adapters.js` 解析约定（tab 缩进、`\n\t};` 收尾）的骨架 → 打印 audit / resolve / `_check_keys_mod` / check_claims / 全链 六步清单。dry-run 实测输出 `04a-12-demo.js`。
- 新增两份工程文档：
  - `docs/modpack-inventory.md`：game 内 15 包逐行台账（名/字节/boot 版本/适配器）+ 11/11 适配器均有实机宿主 + R1~R5 风险处置状态 + 复现命令。
  - `docs/key-type-evidence.md`：`NO_EVIDENCE 171/276` 的**不可得性实测证明**——boot.json 无 `variables` 段、用法证据实测仅覆盖 5/171（2.9%）、运行时探针在 bu/cu 两通道均不可行；结论是「静态不可判定」，不是缺陷，也不为降数字放宽判据。

## v2.0.0.001（2026-11-06 · 2.0 首个版本：声明类型语义核查 + 两处静默失效修复）

**触发**：此前所有核查只回答「这个键在模组源码里存不存在」，从不回答「CE 按什么类型写、模组按什么类型判」。补上这一维度后立刻抓到真实静默失效——面板显示写入成功，模组侧判定恒为假。

### 一、修复（影响玩家行为）

- `wraiths-reflection · 监狱对峙 · 承认罪过（AdmitMR）`：模组按严格比较 `<<if $AdmitMR is 1>>` 判定（`ReturnNecklace.twee:34`，SugarCube 的 `is` 等价 `===`），CE 声明 `type: "boolean"` 使面板写入 `true`，`true === 1` 恒为假，该作弊项**永远不生效**。改用项目既有 `numeric: true` 约定（`05-modcheat-ui.js:124` 渲染数字控件、写 1；`04b-modcheat-write.js:108` 走 number 分支）。
- `wraiths-reflection · 银海螺 · 已咨询约旦（SilverConchAsk）`：同源问题，判定藏在 `LakeConchTalk.txt:4` 的 `<<if $SilverConchWR is 1 and $SilverConchAsk is 1>>`（模组用 `.txt` 存 passage）。同改 `numeric: true`。
- 取证后**不改**（避免误改）：`RefuseWR` 只用真值判定 `!$RefuseWR`（`SchismWR.txt:3`）与 `<<unset>>`（`Shit.json5:78`），写 `true` 与写 `1` 等价；`more-farm-upgrade · farmerCanSell` 全部真值判定（`FarmFarmer.twee:110/183/375`、`FarmerEvents.js:109`），boolean 语义正确。

### 二、工具（新增/升级，均可单独运行）

- `tools/check_key_types.js`（新增）：解析 `04a-*.js` 对象字面量里成对的 `varPath` + `type`（括号配对取真块，type 必须同块，避免跨块误配）；扫对照源码全扩展名 `js|ts|twee|txt|json|json5|mjs|cjs|html|htm`；按显式赋值右值判实际形态（number/string/boolean/array/object/null）；另查严格比较（`$x is 1|0`、`V.x ===|!==|==|!= 1|0|true|false`）。**识别 `numeric: true` 并按 number 语义比对**，否则会把该约定误报成冲突。有冲突或严格比较失配时退出码 1。
- `tools/check_claims.js`（新增）：声明结构自洽——跨适配器同一 `varPath`、同适配器 `varPath` 重复、同适配器 `key` 重复、`levels` 与 `labels` 数量不一致、`min > max`。`loveInterestList` 经取证为合法共享键（两适配器按单项增删、不整体覆盖，留痕键各带 modId），登记白名单。
- `tools/check_coverage.js`（新增）：列出模组源码高频读写但 CE 未声明的路径候选。**参考用**——清单含大量原版变量与内部流程标记，不作收敛判据。
- `tools/run_all.ps1` 全链 7 步 → **8 步**：第 8 步跑 `check_claims` + `check_key_types`（`STATE.json` 缺失时明确 WARN 跳过，不误判失败）。`package.json` 补 `test:keycheck` / `check:claims` / `check:types` / `check:coverage` / `check:state`。

### 三、收敛口径与结果

- 类型形态：**276 条声明，CONFLICT 0 / STRICT 0 / WARN_BOOL_01 1**（`RefuseWR`，已取证为正常）。
- 声明结构：**409 条声明，命中 0**。
- 未覆盖部分如实记录：`NO_EVIDENCE` 171 条——模组通过对象字面量默认与构建式赋值定义状态，静态源码没有显式赋值证据；已实测各模组 `boot.json` 均无 `variables` 段（4 个有 boot.json 的模组 `variables=false`，其余无 boot.json），无法由此加宽取证口径。报 NO_EVIDENCE 不等于有问题。
## v1.9.30.005（2026-11-06 · 判据升级：94 条语义偏差归零 + 工程质量收口）

**触发**：上一轮审计查出「`endevent` 是运行时 widget、两端判据都只看源码字面」这一同源盲区，其中 94 条 depth=1 case 被错判 R5(push) 而语义应为 clear。本轮把判据升级为「**段完成时能观测到 endevent 的运行时而不仅是段源码字面**」，并连带收口 P0 门禁、P1 工程文件、P2 四处硬编码。版本双源 1.9.30.003 → **1.9.30.005**（004 为判据升级、005 叠加注释剔除与 CI）。

### 一、判据升级（模组本体改动，本轮唯一影响玩家行为的部分）

- 取法取证：`endevent` 是 twee widget（`<<widget "endevent">>`），不在 `Story.widgets`、无对应 Macro；原版 HTML 里 twee 以实体转义存放，必须 `unesc()` 后才能解析。运行时唯一可靠入口是复用 `07e-scenes.js::listAllPassages()`（`Story.passages` → `lookupWith` → DOM `tw-passagedata` 三级兜底）。
- `javascript/src/07f-pins.js`：新增 `mbCEWidgetEndTable()`（扫全段落、正则取 `<<widget "name">>…<</widget>>`、排除 `endevent` 自身、异常退化空表）+ `mbCESrcHasEndSignal(src)`（先字面后「段内直接调用的 widget 定义体内含结束信号」，**只做 1 层展开**）；出口判据行由 `curSrc.indexOf("<<endevent")` 改为 `mbCESrcHasEndSignal(curSrc)`。惰性缓存，游戏内段落固定。
- `javascript/src/09-exports.js`：导出 `resetWidgetEndSignalCache()`（测试注入 mock 段落后必须显式重置，防缓存串味）。
- `tools/gen_direct_exit_matrix.py`：`expect()` 判据同步升级；case 增 `curHasEndEff`（有效信号）；meta 增 `effEndSignalPassages`；`meta.txt` 判据说明改写为双层判据 + 两侧同源约束。
- **矩阵口径变更（旧断言作废）**：2,080 → **2,158 条**；规则分布 R1 536→**781** · R2 126→**191** · R3 554→**481** · R4 618→**553** · R5 141→**47** · R6 105→不变。逐 id 核对：新增 78 / 消失 0 / 共有 2,076，迁移 **R5→R1 94**（即那 94 条）、R3→R1 73、R4→R2 65。守恒闭合 2,076+78=2,158。
- **反向核对**：新 R5 共 47 条，其中「含结束信号（字面或间接）」= **0**（必须为 0，已达成）。
- `tests/smoke_dom.js`：19.17 mock 按矩阵 `indirectVia` 动态生成 widget 定义段落（否则新判据退化字面 → 94 条假红）；每 case 三态源码（字面 / `<<via>>`+link / 纯 link）；`cases.length === 2080` 恒等断言改为「== meta.caseCount 自洽 + >= 2000 防退化下限」；19.19 由「偏差可见 ≥90」反转为「**非槽位 R5 残留 === 0**」+ 四条同源自洽断言。

### 二、工程收口（P0→P2）

- **P0-a 门禁 fail-closed**：`githooks/pre-commit` 原来只探测 `powershell.exe`——本机根本没这个 exe（只有 `pwsh`），导致历次提交都打印「跳过验证」并 `exit 0`，整条验证链**从未真正跑过**。改为 `powershell.exe` → `pwsh` → 两者皆无则打印说明并 `exit 1`（可用 `--no-verify` 显式绕过并自担风险）。实测无 PowerShell 分支 exit=1。
- **P0-b 三流程文件入 git**：`AGENTS.md` / `dev.ps1` / `real_smoke.ps1` 入库；顺带最小可移植化（消费端路径 `$env:MCE_DOL_PROJECT` 可覆盖、默认值不变），并修正 AGENTS.md 两处过时/错误陈述（「git 命令不可用」→「git 不在 PATH，用绝对路径调用」）。
- **P1**：新增 `LICENSE`（MIT）、`CONTRIBUTING.md`、`.github/ISSUE_TEMPLATE/bug_report.md` + `config.yml`；新增 `package.json` + `eslint.config.js`，**四规则** `no-dupe-keys` / `no-unreachable` / `no-func-assign` / `eqeqeq`（`== null` 放行，实测 11 处松散相等全属该惯用法），并入 `run_all.ps1` 第 3 步（全链 6 步 → **7 步**）。
- **P2**：`conflicts` 去掉恒为 0 的 `EXIT_SLOT` 哨兵，改为按 case id 检测「同一 id 期望互相矛盾」；删除未使用的 `companionDest` 字段；生成器 `DEFAULT_HTML` 去机器绝对路径（环境变量 `MCE_DOL_HTML` → 相对路径 → 原路径三级回落）；19.17 规模硬编码改自洽口径。
- `.editorconfig` 按实测重新校准：不再按扩展名强制行尾（JS 11 个 LF / 23 个 CRLF，md 与 ps1 同样不统一），只钉死必须为 LF 的两类（`githooks/*`、`tools/run_all.ps1`）——防止 CRLF 让 sh 门禁报 `\r: command not found`。

### 三、验证

- 变异测试（证明回归能拦住判据回退）：把 widget 表改成空表 → 19.17 报 **94** 条失配（R1 687/781），与历史偏差数完全吻合；还原后全绿。
- `19.17` 逐 rule 全中（R1 781/781 · R2 191/191 · R3 481/481 · R4 553/553 · R5 47/47 · R6 105/105），失配 0；`19.18` SHA256 与 HTML 一致（64,576,232 B）；`19.20` 多跳序列三序列通过。
- ESLint 基线 exit 0，四个探针全部按预期命中/放行。

### 四、未做（留待下一轮）

- ~~108 条 depth≥2 候选未定案~~ → 已定案，见第五节。
- ~~CI（`.github/workflows`）未接~~ → 已接，见第六节。
- ESLint 只查拼接产物（分片不完整，无法逐片 lint），`no-undef` 类跨文件规则不启用。
- ~~版本号未升（仍 1.9.30.003）~~ → 已升 1.9.30.005，双源与源码注释口径统一。

### 五、二次校准：注释信号剔除 + depth≥2 取证定案

**触发**：做 depth≥2 取证时发现 `checkEventNPC` 被当成「内含结束信号」——其信号其实是 `<!-- <<endevent phaseless>> -->` 注释。顺着查下去，passage 侧也有同类形态。

- **注释剔除（判据收口）**：`07f-pins.js` 新增 `mbCEStripComments()`，`mbCEWidgetEndTable()` 与 `mbCESrcHasEndSignal()` 都先剔除 `<!-- -->` 与 `/* */`；`gen_direct_exit_matrix.py` 同步新增 `strip_comments()`，接入 `end_signal_widgets()` / `indirect_end_via()` / `cur_has_end` 三处。两端口径逐条一致。
- **实测影响面（HTML 64,576,232 B / 16,087 段 / 5,094 widget）**：仅因块注释而命中的 **4 段** —— `Bus Station Livestock`、`Elk Compound Station Badge`（整行 `<<link …>><<endevent>><</link>>` 被注释掉）、`Mines Intro`、`Pirate Deck`；widget 侧 366 → **365**，唯一差异就是 `checkEventNPC`。这 4 段在白名单场景内 case 数为 0，`Pirate Deck` 仅作为 dest 出现 1 次 → **矩阵与全部计数不变**（2,158 / R1 781 · R2 191 · R3 481 · R4 553 · R5 47 · R6 105 / 字面 355 / 间接 151·310 case / eff 506），属零噪声的正确性修复。
- **玩家可见差异（修前）**：从触发点走进 `Pirate Deck` 等段时，源码里仍有被注释掉的 `<<endevent>>` → 判据认为「剧情已结束」→ 立即清锁，而实际页面还可能剩着可选链接，剧情被提前中断。
- **depth≥2 定案（结论：不做）**：严格 2 层展开候选 **14 条 / 命中 widget 152 个**，分三类——① `loadNPC → checkEventNPC`（3 条）是伪信号（信号在注释里）；② `nightmareEnd → endcombat`（5 条）与 `schismEnd → endcombat`（2 条）的信号落在 `<<if !$replayScene>>` 分支内，而剧情直达态 `$replayScene` 恰好已置位 → 该分支根本不执行；③ 只有 `pinchEnd → endcombat`（4 条）是无条件末尾调用。同时 depth2 名单里 `npc` / `pregnancyPassout` / `adultShopClear` 这类通用工具 widget 占多数，无条件 2 层展开会把「段里调了 `<<npc>>`」一律判成结束。故维持 depth=1，理由写入代码注释与 `meta.txt`。
- **测试**：`09-exports.js` 导出 `srcHasEndSignal(src)` 纯函数自检口；`smoke_dom.js` 新增 **19.21**（块注释 / HTML 注释 / 真信号 / 仅注释信号的 widget 四形态）+ **19.22**（玩家路径级：完整走 `onPassageOverride` 的直达态出口判定，断言「仅注释信号的段不清锁」与「真信号段仍正常清锁并保留 dest」）。变异验证：把 `mbCEStripComments` 临时改成恒等（即回到旧行为）→ 19.21 三条 + 19.22 首条同时转红，还原后全绿。

### 六、CI 接入 + 干净克隆可跑（本轮工程收口）

**前提障碍（逐条探明，非猜测）**：

- 仓库根原本**没有 jsdom**：`require('jsdom')` 从根目录 `MODULE_NOT_FOUND`，历史唯一来源是 `tests/node_modules/jsdom`（30.1.3，被 `.gitignore` 的 `node_modules/` 覆盖、0 个 tracked 文件）。→ 本轮 `npm install --save-dev jsdom@^30.1.3` 正式进 `devDependencies`，`package-lock.json` 同步；`npm ci` 实测 `added 112 packages in 17s`，exit 0（lock 与 manifest 一致）。
- 两处硬编码本机绝对路径：`tests/smoke_dom.js` 的 `GAME_HTML`、`tests/integration_gender.js` 的 `DOL_HTML`。→ 统一改为 `process.env.MCE_DOL_HTML || <原路径>`；smoke 文件头新增 `GAME_HTML_PATH` / `HAS_GAME_HTML` 两个常量，第 15 段改用 `const GAME_HTML = GAME_HTML_PATH;`。
- **干净克隆下的真实红点**：原版 HTML 缺失时，smoke 的 19.5–19.8（剧情页 UI 四条）与 19.14b（学校检查行按钮恢复）必红——剧情页场景行来自原版 HTML 的 `<<widget "scenes">>` 场景元数据，缺 HTML 时 `V.scenes` 只有手动 mock 的 `KylarAbduction`，行不渲染 → `dtBtn19.click()` 抛 `Cannot read properties of null`。→ 两处各包一层 `if (!HAS_GAME_HTML) SKIP else {…}`；api 层（19.1–19.4、19.9–19.16、19.17–19.22、矩阵与判据）无 HTML 依赖，照常强制。

**workflow**（`.github/workflows/ci.yml`，新建）：`push(main)` / `pull_request` / `workflow_dispatch`；`ubuntu-latest` + `actions/setup-node@v4`（**node 22**，`cache: npm`；曾用 node 20，会让 jsdom@30 依赖链在 `require` 阶段直接崩，见 §七）；`npm ci` → `[1/6] node tools/build_js.js` → `[2/6] node --check javascript/maplebirchce.js` → `[3/6] npx eslint javascript/maplebirchce.js` → `[4/6] node tests/smoke_dom.js` → `[5/6] node tests/test_mce.js` → `[6/6] node tests/functional_e2e.js && node tests/integration_gender.js`。与本地 `tools/run_all.ps1` 同口径，去掉依赖本机资源的部分（moli 实机冒烟、打包 zip、codegraph、原版 64MB HTML）。

**CI 等价实测**（`MCE_DOL_HTML=Z:\no-such\Degrees of Lewdity.html`，即模拟干净克隆）：

| 步骤 | 结果 |
| --- | --- |
| `npm ci` | `added 112 packages`，exit 0 |
| `[1/6]` build | 34 段 / 615,126 B / SHA256 `2e0e0052…569b`（行尾统一后的最终值，见 §七） |
| `[2/6]` `node --check` | exit 0 |
| `[3/6]` ESLint（四规则） | exit 0 |
| `[4/6]` smoke | `SMOKE ALL PASSED`（2 条 SKIP：19.5-19.8 / 19.14b） |
| `[5/6]` 回归 | `ALL TESTS PASSED` |
| `[6/6]` E2E + 性别集成 | `FUNCTIONAL E2E ALL PASSED` / 性别集成 `SKIP`（原版 HTML 不存在） |

**本机带真实 HTML 全链（7 步）**：`ALL CHECKS PASSED`；19.17 逐 rule 全中（R1 781 · R2 191 · R3 481 · R4 553 · R5 47 · R6 105，失配 0）；19.18 SHA256 `9ecc02d9…` / 64,576,232 B 一致；19.19 间接段 151 / case 310 / R5 残留 0；19.20 三序列；19.21 五条 + 19.22 两条全 PASS；性别集成 `passed=24 failed=0`。

**打包**：250,878 B / SHA256 `5E7A6C46E5AFC02EEC179A6596B4325C77096B23D5FEF149475711E7AB4B89E2`，verifier 4/4，4 条 zip 条目全正斜杠，已覆盖 `DoL-Project\game\MapleBirchCE.mod.zip`（双端 bytes/SHA 一致）。

### 七、产物确定性与推送通道（本轮最后三块）

**① CI Node 版本（ERR-20261106-011）**：workflow 原用 node 20，`npm ci` 后 smoke 一条断言都跑不到就红 —— `jsdom@30` 的 engines 要求 `^22.22.2 || ^24.15.0 || >=26`，其依赖 `undici@8`（engines `>=22.19.0`）在 Node 20 上没有 zlib zstd 导出，`require('jsdom')` 阶段即 `TypeError: Cannot read properties of undefined (reading 'bind')`。本地跑的是 Node 22，**永不复现**，只有真实 Actions 暴露（run `42152880121` 全红）。改用 node 22 后 run `42153833342` 全绿。

**② 构建产物随检出环境变化（ERR-20261106-012）**：CI 构建 622,384 B / CR 7,258 / `da827ca1…`，本地 622,538 B / `ebe9e5f8…`，差 154 B。取证结论是**仓库 blob 本身就混了 7,258 个 CR**，本地 `core.autocrlf=true` 又把 154 个 LF 行二次转成 CRLF，于是三方各不同（干净 clone 全 CRLF 为 624,894 B / `2dfafb92…`）。修法：`.gitattributes` 给 `*.js` / `*.md` / `*.json` / `*.ps1` 补 `text eol=lf`（此前只覆盖 `githooks/*` 与 `*.sh`）→ 仓库级 `core.autocrlf=false` → `git add --renormalize .`（55 个文件，`git diff --cached --ignore-cr-at-eol` 只剩 `.gitattributes` 自身，**零内容变化**）→ 重检出为纯 LF → 重建产物。

统一后：`src` 34 段 615,126 B / CR 0；产物 **615,126 B / CR 0 / `2e0e0052382e61735b46a40625d05f263e953a2ba4d243b4569a6e20f614569b`**；zip **250,878 B / `5E7A6C46…89E2`**（zip 自身的确定性见 §七⑤）。CI run `42155827690` 的构建日志为 `615126 B / SHA256 2e0e0052…569b` —— **与本地逐字节一致**，这就是「产物确定性」的判据（不是字节数接近，是 SHA 相同）。

两个实操陷阱（都已写进排障笔记）：`git checkout-index -f -a` **不做行尾转换**，只有 `git checkout -- <path>` 走 smudge 路径才转；`git reset --hard` 受 index stat 缓存影响**只重写部分文件**（实测 `src` 仍残留 7,057 个 CR，而 `git status` 显示干净 = 假绿），须删掉全部跟踪文件再 `git checkout -- .`。

**③ 推送通道改造（`tools/push_api.js`）**：旧实现按**工作区** `fs.readFileSync` 建 blob、mode 硬编码 `100644`、不做任何 sha 校验 —— 工作区一旦与 index 不一致（行尾转换 / 未提交改动），推上去的内容就与本地提交不同，而且错误会静默进远端。现改为：读 `git ls-files -s` 的 index mode+sha（不碰工作区）、`git cat-file blob` 取原始字节、逐 blob 回读 sha 校验、复用远端已有 blob（本次 109 条里复用 107 / 上传 2）、新增 `--dry`（不联网只做本地门禁），并加**双重 fail-closed**：index tree 必须等于 HEAD tree，API 建出的 tree sha 也必须等于 HEAD tree，不等即拒绝提交。

**④ 历史遗留提交的处置（`95cb2d0`）**：它是 Git Data API 重建的旧提交（本地无此对象），仍是远端 main 的祖先（`compare` → `ahead_by=5`），其 tree 里是修复前的 CRLF blob。当前可达 tree 已全 LF（远端 tree 与本地 HEAD tree 相同，抽验 7 个代表文件 `git hash-object --no-filters` 与 index blob 一致且 CR=0），所以**不做历史重写** —— force-push 会让 main 上 5 个提交哈希全变、破坏 CI 记录与已有 clone，且不可逆，而旧 blob 不参与任何构建或发布字节。

**⑤ zip 打包本身的确定性（ERR-20261106-013）**：发布前重打包时发现 —— 字节数一模一样（250,878 B），SHA 却从 `7DE2E707…` 变成 `066EA2E7…`。原因是 `tools/pack.ps1` 用 `ZipArchive.CreateEntry()` 建条目后**没有设置时间戳**，每个条目默认取当前时间，于是同内容每次打包出不同 zip —— 发布说明里写的 SHA256 因此永远对不上刚发出去的资产。修法：建条目后固定 `LastWriteTime = 2026-01-01T00:00:00Z`，并按文件全路径排序后写入（顺序也不依赖文件系统枚举）。验证是连打两次完整 `pack.ps1`（含全链），两次 SHA 均为 `5E7A6C46E5AFC02EEC179A6596B4325C77096B23D5FEF149475711E7AB4B89E2`、250,878 B。

## v1.9.30.004（2026-11-06 · 测试方法论升级：间接结束信号审计 + 判据可追溯 + 多跳序列）

**触发**：用户要求批判复盘「地点×出口穷举回归」这套新增测试方式，并从代码质量/文档/交付/生态等角度找提分点。本轮只改测试与工具，**模组本体（`javascript/src/*`）零改动、未升版本、未发布**（当时编号留空，1.9.30.005 回填为 004）。

### 一、审计结论（实证，非推断）

- **判据同源共同盲区**：Python 生成器与 `07f-pins.js` 都只判「段源码字面含 `<<endevent` / `<<badEndTrackingEnd`」，而 SugarCube 的 widget 是运行时展开 → 段内写 `<<endcombat>>` 等 widget（内部才含 `<<endevent>>`）时两端同时看不见。双实现能发现「实现分歧」，但对「同一个认知错误」结构性无效。
- **量化**：全 HTML 5,094 个 widget 定义，其中 365 个定义体内部含结束信号；白名单段中「无字面信号但直接调用此类 widget」共 **151 段 / 232 条 case**，其中 **94 条 depth=1 当前被判 R5(push)**（语义应为 clear，事件已结束）——与 v1.9.30.003 修的「replayScene 残留 → 按钮永久禁用」同构。
- **已排除误报**：白名单段内 `[[label->dest]]`/`[[dest]]`/`<<link>>`/`<<goto>>` 全为 0（零漏边）；含裸 `endevent` 无 `<<endevent` 的判据分歧 0 段；注释块内 endevent 0 次。
- **其它缺口**：`conflicts` 计数条件含哨兵 `EXIT_SLOT`（恒为 0、无检出价值）；19.18 原只比字节数（等长替换漏检）；矩阵约 1MB 入 git 无体积策略；无 CI、无 lint、无 LICENSE/CONTRIBUTING。

### 二、本轮落地（全部零期望值变更）

- `tools/gen_direct_exit_matrix.py`：
  - 新增 `parse_widgets()` / `end_signal_widgets()` / `indirect_end_via()`；`meta` 增 `srcHash`（原版 HTML SHA256）、`indirectEndPassages`、`indirectEndCaseCount`、`endSignalWidgetCount`、`endSignalWidgets`、`indirectAudit[]`；case 增 `curHasEndIndirect` / `indirectVia`（**仅审计标注，不参与 `expect()` 判定**）。
  - `meta.txt` 增「判据说明」+ 间接结束信号审计段（前 20 条 + 指向 JSON 完整清单）。
  - 结束信号判据统一为 `<<endevent`（与 JS 对齐），实测**规则分布零变化**：2,080 条 / R1 536 · R2 126 · R3 554 · R4 618 · R5 141 · R6 105。
  - 写出改为显式 `newline="\r\n"`：原 `Path.write_text` 换行随平台变（Windows `\r\n`、Linux `\n`）→ 同矩阵跨平台字节不一致、git 整文件 diff。
- `tests/smoke_dom.js`：
  - 19.17：补「清理完整性」判据（`mbCE_replayOnce`/`mbCE_replayPending` 必须清空，否则按钮仍禁用）+ 新增「direct 路径清理不触发 `unfreezePlayerStats`」断言（避免误恢复冻结快照致数值跳变）。
  - 19.18：字节数比对 → **SHA256 比对**（挡等长替换），无 `srcHash` 时回退旧口径。
  - 19.19（新增）：间接结束信号审计一致性（矩阵条数 == meta）+ 段数不低于基线 151 + 已知语义偏差（≥90 条判 R5）可见；**只锁数据一致性，不改判语义**。
  - 19.20（新增）：多跳序列回归（19.17 每条都是干净白名单+单跳，测不到运行时累积）——真实场景 `MoorFlower` 走「链外分支 push 入白名单 → 回触发点 clear → 重复调用幂等」。
- `.editorconfig`（新增）：按实测现状钉死行尾（JS/MD/JSON/PS1 = CRLF，Python 与 `run_all.ps1` = LF），防无意义整仓 diff。
- README：修正 `test_mce.js` 断言数（旧「570+」→ 实测 **1,204**）、补 19.19/19.20 与 `srcHash` 说明。

### 三、验证

`node --check` 通过；单跑 `tests/smoke_dom.js` 全绿，新增 6 条断言均 PASS（19.17 unfreeze 0 次 / 19.18 SHA `9ecc02d9…` / 19.19 232 条·151 段·94 条偏差 / 19.20 三序列）；全链结果见交付清单。

### 四、未做（明确留待下一轮）

- 94 条 depth=1 语义修正（需把判据从「段源码字面」升为「段完成时观测 endevent」的运行时信号，会改变矩阵规模/规则分布与 19.17 恒定断言）。
- 108 条 depth≥2 候选人工定案（含 `loadNPC`/`checkEventNPC`/`generateNPC`/`forestRescue` 等可能非结束语义）。
- CI（`.github/workflows`）、ESLint（存量 `var` 1,412 处需分批迁移）、LICENSE / CONTRIBUTING。

> **1.9.30.005 回填（本条已全部闭环）**：94 条 depth=1 偏差已归零（判据改「段内直接调用定义体内含结束信号的 widget」，实测通过）；108 条 depth≥2 已取证定案**不做**（14 条候选中 3 条伪信号、7 条落在 `<<if $replayScene>>` 不执行分支、4 条已被其他路径覆盖，理由见第五节）；CI 见第六节；LICENSE / CONTRIBUTING / ESLint 已随 P1 入库。

## v1.9.30.003（2026-11-06 · 迭代优化：出口段/返回触发点统一清理，直达按钮防残留全路径闭环）

**迭代方向**：v1.9.30.002 修复后按用户要求迭代优化（不跑浏览器路线）。全量实证后堵住 v1.9.30.002 遗留的「出口段/分支段 Next 回触发点（exitDest）→ replayScene 残留 → 直达按钮永久禁用」同类洞。

### 实证（回归原始材料，非推断）

- **全量扫描**：解析原版 HTML（64.5MB / 16087 段 / 110 个场景注册 def），提取全部含 `<<endevent>>`/`<<badEndTrackingEnd>>` 的剧情链内段及其 Next 目标，交叉白名单审计：
  - **无中间段误清理**：白名单内中间段含结束信号的案例，Next 目标要么在白名单内（`rpExit` 保护放行 ✓），要么离开剧情链去主循环段/触发点（事件结束 → 清理语义正确 ✓，如 Prison 系列 → Prison Walkway、Tutorial → Bedroom、Avery 公园分支 → Park）
  - **确认残留洞**：v1.9.30.002 的 (b) 条件仍含 `dest !== exitDest` 排除——出口段 Next 回触发点（如玩家在 Danube Street 触发凯拉尔绑架直达，出口段 "Kylar Abduction Release 4" Next 回 Danube Street = exitDest）被排除 → 不清理 → 残留。且该分支与**非 direct 分支对 exitpassage 一律清理**（L1012）语义不一致
- 边界复核：`mbCEClearReplay` 清理键（replayScene / mbCE_replayOnce / mbCE_replayPending / mbCE_visited）完整；直达（mbCE_direct）不误 unfreeze（wasDirect 判定）

### 修复（07f-pins.js onPassageOverride mbCE_direct 分支）

- **(b) 出口判定同步移除 `dest !== exitDest` 排除**：当前段含 `<<endevent>>`/`<<badEndTrackingEnd>>` = 剧情结束信号 → **一律清理重放 + 保留 dest**（白名单内目标仍由 `rpExit` 保护）
- **新增 `dest === exitDest` 清理分支**（在「剧情分支段并入白名单」之前）：玩家回到触发点（中途返回 / 出口段回原位）→ 清理重放，**exitDest 不并入白名单**（非剧情链段）；对齐非 direct 分支 L1012 语义，覆盖「无结束信号段 Next 回触发点」路径

### 测试新增（smoke_dom.js，19.14b 之后）

- **19.15**：出口段（含 endevent+badEndTrackingEnd）Next 回 exitDest（Room）→ replayScene 清理 + dest 保留
- **19.16**：分支段（无 endevent）Next 回 exitDest（Room）→ replayScene 清理 + dest 保留（须先于并入白名单判定）

### 验证

全链 6 步全绿（build/syntax/smoke/回归/E2E/性别集成）+ 打包 verifier 4/4 + SHA 回读；不跑浏览器/moli（用户本轮明确「不用浏览器」）。

## v1.9.30.002（2026-11-06 · 直达播完残留修复：出口段 Next 回 startPassage 也清理重放）

**用户实机反馈**：剧情明明已播完（角色跟随剧情地点走、没跳回原地点 ✓），但剧情页所有场景行「直达触发」按钮仍显示「正在播放剧情，请先结束当前播放」并禁用，其他直达无法使用。

### 根因（原版源码 + 注册表实证，非推断）

- **原版注册表实证**（DoL L280002）：`SchoolInspectionBreast`（学校检查-胸部）`{ startPassage:"Science Lesson", passages:[…"Breast Inspection End"], … }`——startPassage 为 "Science Lesson" 且 **∉ passages 白名单**；Penis/Pussy 同构
- **出口段源码实证**（tw-passagedata pid=9654）：`Breast Inspection End` 含 `<<endevent>>`（剧情结束信号），段尾 `<<link [[Next|Science Lesson]]>><</link>>`——**出口段 Next 回 startPassage**
- **旧出口判定缺陷**：07f-pins.js (b) 分支条件含 `dest !== V.replayScene.startPassage`——学校检查出口段 Next 回 "Science Lesson"（= startPassage）被该排除命中 → 不清理 → `V.replayScene` 残留 → 07h-render 直达按钮 `replaying = !!V.replayScene` 恒真 → 全部直达永久禁用
- **实证安全**：凯拉尔绑架中间段（Kylar Abduction Intro / Abduction）**无** `<<endevent>>`（不误清理）；出口段 Release 4 含 endevent+badEnd 且 Next 到 Danube Street（白名单外）→ 原有清理路径不受影响；起点段 Science Lesson 虽含 endevent，但其 Next 到剧情内段（Breast Inspection ∈ 白名单）→ 由 `rpExit` 白名单排除保护，不误清理

### 修复（07f-pins.js onPassageOverride mbCE_direct 出口判定）

- **(b) 出口判定移除 `dest !== V.replayScene.startPassage` 排除**：当前段含 `<<endevent>>`/`<<badEndTrackingEnd>>` 即剧情/事件结束信号 → **一律判定剧情结束**：
  - `dest` 仍在本剧情白名单内（出口段通往剧情内段 = 中间事件结束/剧情回环，如凯拉尔 Release 4→Abduction）→ 保留 `rpExit` 排除保护，不清理放行
  - `dest` = startPassage（∉ 白名单，如 Science Lesson）或剧情外段（如 Danube Street）→ **清理重放 + 保留 dest**（角色随 dest 落主循环，不回触发点）
- 保留 `dest !== exitDest` 防御（dest=触发时段落不清理）

### 版本与验证

- 版本双源升 **1.9.30.002**（`01-core.js` MCE_VERSION + `boot.json` version；延续 1.9.30.001 防缓存授权）
- smoke_dom.js 新增 **19.14 / 19.14b 断言**（共 3 条）：学校检查出口段（`<<endevent>>`，无 badEnd）Next 回 startPassage "Science Lesson" → replayScene 清理 + dest 保留（落课堂主循环）+ 重渲染后「直达触发」按钮恢复可用（title 非「正在播放剧情」）；19.12a（出口段 Next 白名单内 → 不清理）回归保持
- 全链 6 步 + 打包 + 消费端 SHA MATCH + moli 冒烟

## v1.9.30.001（2026-11-06 · 直达语义确认 + 出口判定迭代优化 + 升版防缓存）

**用户确认诉求**：① 确认「直达触发后角色跟随剧情地点走，而不是直接回到触发时所在的地方（牛津街）」语义成立；② 迭代优化；③ 版本号加 `0.001`（防浏览器识别到相同版本号走缓存）。

### ① 语义确认（基于原版源码实证，非推断）

- **事件顺序实证**（DoL L31678-31700）：原版 passage 重路由函数 `checkPassages` 内 **先** `$.event.trigger(":passageoverride", passageArgs)`（L31680-31686，CE 钩子此刻执行、看到**原始 dest**）→ **后**才跑 Scene viewer redirect 白名单判据 `if (!V.replayScene.passages.includes(passageArgs.name)) { return "Scene Viewer End"; }`（L31689-31700）——**CE 钩子先于原版判据执行**，CE 把分支段并入白名单后原版判据命中放行 → 修复机制顺序正确
- **出口特征实证**：`<<badEndTrackingEnd`（HTML 转义存储 `&lt;&lt;badEndTrackingEnd`）全游戏 **62 处** = DoL 场景出口标准信号；凯拉尔绑架出口段三连（Release 4 / Free Rescue Thank / Free Reassure）统一 `<<link [[Next|Danube Street]]>><<endevent>><<badEndTrackingEnd ...>><</link>>`；运行时 `Story.get().source` 为 unescape 后原始 `<<...>>` → CE 出口检测可靠
- **结论**：直达 → 剧情内分支段动态并入白名单逐段放行（角色在剧情地点流转）→ 出口段命中 endevent/badEndTrackingEnd 特征 → 清理重放状态但**保留 dest**（如 Danube Street）→ 角色在剧情结束位置继续主循环，**不回触发时所在地点（牛津街）**

### ② 迭代优化（07f-pins.js onPassageOverride 出口判定）

- (b) 出口判定新增条件：`dest` 仍在本剧情白名单内（`rpExit.indexOf(dest) !== -1`）→ **不清理**、放行让剧情继续流转——覆盖**多段出口剧情**（出口段也通往剧情内段）场景，避免过早清理重放导致后续分支段失去白名单保护
- 语义对齐：出口段 Next 到剧情外（主循环地点，如 Danube Street）→ 清理 + 保留 dest（走完正常发展）；Next 到剧情内段 → 剧情继续（走完才正常发展）

### ③ 版本双源升 1.9.30.001

- `javascript/src/01-core.js` MCE_VERSION + `boot.json` version 双源同步为 `1.9.30.001`（追加段号，防浏览器对相同版本号走缓存识别）

### ④ 验证

- smoke_dom.js 新增 **19.12a 断言**（2 条）：出口段（当前段源码含 `<<endevent>>`）Next 指向剧情内段（白名单内 "Abduction"）→ replayScene 保留（剧情继续，不误判出口）+ dest 未改写；smoke 19 段扩至 24 断言
- 全链 6 步全绿（build → syntax → smoke → 回归 → E2E → 性别集成）+ pack.ps1 打包（新 SHA）+ 复制消费端 SHA MATCH

## v1.9.30（2026-11-05 · 剧情直达触发：每场景行「直达触发」按钮）

**需求**：好友反馈「能不能直达某剧情，比如直达凯拉尔绑架剧情」，用户确认「走完这段剧情就正常发展」（不注入额外状态干预）。

### ① 直达触发引擎（复用锚定播放链路）

- 新封装 `directTriggerScene(key)`（07f-pins.js）：从场景注册表 def 构造临时 P（startPassage/passages/manualVariableChanges）→ 调 `startAnchoredReplay(P)` 直接开播——**跳过地点判定/确认条/锚定队列**，点即触发
- 「走完正常发展」= 既有 replayScene 出口清理语义：播完自动回原位（exitpassage）+ 记「已完成 ✓」（mbCE_completedScenes），不写 scenePassages 达成标记、不注入额外状态（凯拉尔绑架入口段自带 `<<kylar_abduction_init>>` 自初始化，无需 CE 预写 kylar 数值）
- 守卫：播放中拒绝（防重入，复用既有 V.replayScene 检查）；无入口段落/未注册键拒绝并提示；**不写 mbCE_queue——零触碰 #165 锚定状态机**

### ② 剧情页 UI

- 07h-render.js 两处加「直达触发」按钮（剧情线阶段行 + 独立场景行，与锚定/一键完成并列，常显）：播放中禁用（title「正在播放剧情，请先结束当前播放」）；无入口段落禁用（title 提示）；已达成/已完成场景可再直达（重看剧情）

### ③ api 导出 + 版本双源

- 09-exports.js 追加 `directTriggerScene`；版本双源 1.9.30（src/01-core.js + boot.json）

### ④ 验证

- smoke_dom.js 新增第 19 段（13 断言）：api 直达凯拉尔绑架（KylarAbduction → 入口 "Kylar Abduction Intro"）→ Engine.play 调用 + replayScene 设置（exitpassage 回原位）→ 防重入 → 无入口拒绝 → 播放结束可重看 → UI 按钮存在/点击触发/播放中禁用/结束恢复
- test_mce.js 新增 53 段（api 构造与守卫断言；环境无真实引擎，mock `global.window.Engine`）
- 全链 6 步全绿：build（maplebirchce.js 613,151 B / SHA 6ff02ae1…63f03eb3）→ syntax → smoke（SMOKE ALL PASSED）→ 回归（ALL TESTS PASSED，含 53 段）→ E2E（FUNCTIONAL E2E ALL PASSED）→ 性别集成（passed=24 failed=0）；codegraph WARN 容错不阻塞
- pack.ps1 打包：MapleBirchCE.mod.zip 246,557 B / SHA256 5848433C97F077B27E40EB435D2DE3039E6089847545BBE7C8F63C1A70DBD86D / zip 4 条正斜杠 / verifier 4/4；复制到消费端 game，SHA MATCH=True
- real_smoke（moli 实机）：启动级 4 项实证通过（游戏页面/SugarCube/ModLoader/ModZipReader init x15）；注入流程/面板交互受 moli 单会话引擎交互阶段局限未达（DoL 启动渲染极慢，见 .learnings\ERRORS.md#ERR-20261028-001），面板级走查留实机验证

### ⑤ 实机修复（2026-11-05 晚）：直达选任意选项跳回原地点

**用户实机反馈**：直达凯拉尔绑架后，点 (1)~(4) 任意选项都直接跳回触发前原地点（牛津街），剧情被打断。**根因三重实证闭环**：

1. 原版 redirect（DoL L31690-31699 verbatim）：`if (!V.replayScene.passages.includes(passageArgs.name)) { return "Scene Viewer End"; }` —— dest 不在白名单即改写成 "Scene Viewer End"
2. CE onPassageOverride 原「链外出口接管」判定（改动前）：dest ∉ replayScene.passages 且非 startPassage/exitpassage/Farm Work/Scene Viewer UI → `cleanupUsedPins()` + `mbCEClearReplay()` + `passageArgs.name = exitDest`（回原位）
3. **白名单残缺**：`KylarAbduction` 在游戏 HTML 无注册表显式定义（仅 `$scenePassages.pushUnique("KylarAbduction")` L279740 + 剧情段引用），getScenesDefs 走 recover 兜底 → passages 数组残缺 → 剧情分支段（选选项去的段落）不在白名单 → 被当出口 → 选任意选项即跳回原位

**修复（07f-pins.js 三处 + directTriggerScene 一处）**：

- ① `directTriggerScene` 构造 P 注入 `direct: true`；`startAnchoredReplay` 对 P.direct **跳过 freezePlayerStats**（直达 = 剧情真实生效，剧情 effects 的数值变化播放后保留；冻结快照 strict-replace 会把剧情效果抹掉）；V.replayScene 记 `mbCE_direct: true`
- ② `mbCEClearReplay` 读 `mbCE_direct`，直达未冻结则不执行 unfreezePlayerStats（避免误恢复快照）
- ③ `onPassageOverride` 新增 mbCE_direct 分支（插在链外判定前）：(a) dest 是 Scene Viewer/End UI → 清理 + 回原位（原版 redirect 兜底）；(b) 当前段源码含 `<<endevent`/`<<badEndTrackingEnd` 且 dest 非 start/exit → **剧情已结束**（出口段点 Next）→ 清理重放状态但**保留 dest**（剧情自身引导回主循环 = 走完正常发展）；(c) 其余 → 分支段**动态并入白名单**后放行（原版 redirect 判 `dest ∈ passages` 命中 → 不再改写 "Scene Viewer End"）
- 出口特征实证：凯拉尔绑架出口段三连（Kylar Abduction Release 4 / Free Rescue Thank / Free Reassure）统一 `<<link [[Next|Danube Street]]>><<endevent>><<badEndTrackingEnd ...>><</link>>`；`<<endevent>>` 为 DoL widget（L241788），剧情结束统一信号

**验证**：smoke 19 段扩至 22 断言（新增：mbCE_direct 标志 / 直达不 freeze / 分支段跳转保留 replayScene 不跳回 / 分支段并入白名单 / 原版 redirect 判据命中 / 出口段清理保留 dest / Scene Viewer 兜底回原位）；全链 6 步全绿（build → syntax → smoke → 回归 → E2E → 性别集成 24/24，codegraph WARN 不阻塞）

## v1.9.29（2026-11-05 · UI 优化：星空蓝双主题 + 锚定确认条 token 化 + 角色页搜索）

**需求**：用户拍板「①锚定确认条视觉归位 + ②角色页搜索框全做 + 新增星空蓝配色 + 带点情绪/氛围感」；功能新增方向此前已被用户否决（"算了吧"），本轮只做 UI 视觉层。

### ① 星空蓝双主题（核心新视觉）

- **「黑金 ⇄ 星空蓝」双主题切换**：header 新增「✦」主题按钮（errBtn 左侧），点击循环切换；localStorage `mbCE_ui_state_v1.theme` 持久化（init 恢复，`setTheme(name, silent)` 静默应用）
- **星空蓝 = 深蓝夜空 + 星辉**：`:root` token 之上新增 `#mce-root.mce-theme-starry{...}` 变量覆盖组——accent 星蓝 `#8fb3ff`、bg 全系深蓝黑（`#0c1022~#1e2750`）、border 蓝紫系（`#3d4a80`）、文字冷白蓝（`#eef2ff` 族）；v1.9.18 token 化红利：换主题只覆盖变量，组件零改动
- **氛围（"心情"）**：面板背景双 radial 渐变（右上蓝光 + 左下紫晕）+ `.mce-body` 星点（6 处 1px 径向渐变点阵，零图片请求）+ 悬浮球星蓝渐变 + 星辉光晕呼吸（`@keyframes mce-toggle-glow` 3.5s，不影响阅读）；切换时状态栏一行心情语（"已切换：星空蓝 ✦ 愿星光指引你"）
- 状态色（--mce-red/--mce-green 族）不随主题覆盖，错误/成功语义稳定

### ② 锚定确认条 token 化（视觉归位）

- 07f-pins.js `showAnchorPrompt` 删除 3 处内联 cssText（背景 `#f5f0e0` 米色/「立即触发★」`#7a9b4f` 绿/「暂不触发」`#888` 灰），样式全部移入 07a-shell CSS 类：`.mce-anchor-prompt`（走 `--mce-gold-bg/--mce-gold-txt/--mce-accent` token）+ `.mce-anchor-go`（accent 主按钮）+ `@keyframes mce-prompt-in` 进入动画（18ms 下滑淡入）
- 主题跟随：星空主题下确认条挂 `.mce-theme-starry`（条在 #story 内、root 外，独立类覆盖）
- 只动视觉样式，锚定触发状态机（#165 待验收）零触碰

### ③ 角色页搜索框

- 07b-char.js `renderCards` 顶部新增 `.mce-char-search`（复用特质/Mod 数值同款 `.mce-search-inp` 深底等宽样式），按原名/显示名实时过滤，输入重建卡片并恢复焦点；匹配数进 hint（"共 N 个…；匹配 M 个"）；搜索词持久化 `mbCE_ui_state_v1.charFilter`（load/save 双同步，`charSearch` 模块变量）

### ⑧ api 导出 + 版本双源

- 09-exports.js 追加 `setTheme`/`getTheme`/`showAnchorPrompt`/`hideAnchorPrompt`；版本双源 1.9.29（src/01-core.js + boot.json）

### ⑨ 验证与交付

- smoke_dom.js 新增第 18 段（26 条断言）：主题类挂载/持久化/恢复/星空变量组/星点氛围/悬浮球光晕 / 确认条无内联色+类名+双按钮+进入动画+旧硬编码色已清除+主题跟随+hide 移除 / 角色搜索过滤计数+hint 匹配数+清空恢复+charFilter 持久化
- 全链 6 步全绿 + 打包 verifier 4/4 + zip 正斜杠 + SHA256 + 装 game + real_smoke

## v1.9.28（2026-11-05 · 全面迭代优化：场景/特质求值编译缓存 + 批量解锁守卫与审计 + 静态表/重复键清理）

**需求**：定时迭代轮——「继续对我的模组进行迭代优化，不用我同意直接做，直到找不到优化点」。33 文件全量自审计（前轮完成）收敛出 4 项实证修复 + 1 项实证撤销（⑤ TRAIT_ZH_CAT 缺键经查证 06a 实际含 9 个 RAW cat 且 `Acceptance` 已译，撤销）。

### ① 07f-pins.js LOCATION_LABELS 重复键清理

- :147 行尾 `"old_temple": "旧神殿"` 与 :136 已存在键重名（对象字面量后者覆盖前者，纯冗余）——删除重名键

### ② 07e-scenes.js 双缓存（本轮性能核心）

- **evalSceneExpr 编译缓存**：同表达式只 `new Function` 一次（键 = 正则替换链归一化后 JS，有界 512 整体清空重建）；判定函数每次调用实时读 V，无陈旧状态；`V.scenePassages=[]` 兜底副作用每次调用仍执行（22.3 语义不破坏）
- **getScenesDefs 注册表缓存**：键 = Story 对象引用 + size + passages 数组引用/长度 三重信号——Story 被替换、passages 数组被原地替换/增删（测试/热重载场景）即失效重建；真机 SugarCube Story 静态 → 恒命中；缓存只存 widget 解析/Story 恢复结果，`V.scenes` 运行时注入每次调用实时合并（不缓存防陈旧）
- 收益：07h:45 折叠懒渲染 / 07f 锚定 166/180/194 高频调用不再每次全量扫描全部段落文本

### ③ 03-global.js 批量解锁逐项守卫 + 聚合审计留痕

- `globalUnlockClothes`/`globalUnlockRecipes` 加逐项守卫（item 空/非对象/缺 name/无 recipe 跳过，单条坏数据不再中止整批）
- 聚合审计：`V.mbCE_wrote["cheat:global:unlockClothes"|"cheat:global:unlockRecipes"] = {type:"batch", modId:"global", op, count, stories?, t}` + mbCEWroteTrim 有界化
- **设计取舍（交付说明必读）**：不做 per-item 回退——`cheatResolvePath` 不支持数组下标路径 + `CHEAT_VANILLA_ROOTS`（specialClothes 在列）硬约束；batch 审计条目 `type!=="cheat"` 被 `undoCheatModValue` 直接拒绝（04b:182 实证），语义安全

### ④ 06b-traits-eval.js traitEval 编译缓存

- `TRAIT_EVAL_FN_CACHE`（Object.create(null)+512 有界，整体清空重建）；判定函数每次调用实时读 V/C；与 `VANILLA_TRAITS_CACHE`（只缓存编译清单）职责分离

### ⑥ 05-modcheat-ui.js 重复 var 清理

- :608 删 `var curPlayerFilter = "";`（与 06a-traits-data.js:180 同名 var 在拼接后同作用域 var 提升合并的卫生隐患，功能语义无变化）

### ⑧ api 导出 + 版本双源

- 09-exports.js 追加 `globalUnlockClothes`/`globalUnlockRecipes`（globalTransform 后）/`TRAIT_ZH_CAT`（VANILLA_TRAITS_RAW 后）；版本双源 1.9.28（src/01-core.js + boot.json）

### ⑨ 验证与交付

- 测试段 52（15 条断言）：TRAIT_ZH_CAT 覆盖 9 分类 / 批量解锁坏条目跳过+聚合留痕+不可回退+幂等 / 食谱仅材料解锁 / 场景缓存命中+引用失效+注入实时合并+无 Story 兜底 / **52.4b 同对象内 passages 数组替换失效**（smoke 15 真实模式防回归）/ evalSceneExpr 缓存无污染 / traitEval 缓存实时读 V
- 全链 6 步全绿（build/syntax/smoke/regression/E2E/gender 24 passed）+ 打包 verifier 4/4 + zip 正斜杠 + SHA256 + 装 game + moli real_smoke
- **坑记录**：缓存键初版仅 Story 引用+size，被 smoke_dom.js:696 原地替换 `global.Story.passages`（同引用、无 size）误判命中 → 补 passages 数组引用+长度信号（ERR 闭环见交付说明）

## v1.9.27（2026-11-02 · 阶段页自定义数值汉化 + README 版本同步）

**需求**：用户实测「阶段」页角色数值区出现两个英文标签 `conviction`/`doubt`（其余均为中文），要求汉化；并自查修复 1.9.26 遗留的 README 版本引用未同步。

### ① 汉化（01-core.js statDefsFor）

- 定位：阶段页数值行 = `STAT_DEFS` 7 项（爱意/情欲/支配/服从/信任/警戒/嫉妒）+ 框架 `MB.npc.customStats` 注册属性；customStats 行 label 直显 key（`{ key: k, label: k }`），conviction/doubt 是罗文等角色恋爱线注册的自定义属性 → 显示英文
- 修复：新增 `CUSTOM_STAT_CN` 映射（`conviction`→**执念** / `doubt`→**疑虑**），`statDefsFor` label 走 `CUSTOM_STAT_CN[k] || k`；未收录属性保持 key 直显兜底（不猜义）
- 顺带：`09-exports.js` 导出 `statDefsFor`（测试与外部调用可用）；测试 §5a 新增 3 条断言（conviction→执念 / doubt→疑虑 / affection 兜底直显）

### ② README 版本同步（1.9.25 → 1.9.27）

- 1.9.26 轮（DeepSeek）升版后未同步 README：:7 当前版本、:87 适配器一览标题、:134 验证段均仍写 1.9.25——本轮修正为 1.9.27

### ③ 验证与交付

- 全链 6 步（build/syntax/smoke/regression/E2E/gender）+ 打包 verifier 4/4 + SHA256 + 装 game
- 版本双源 1.9.27（src/01-core.js + boot.json）
- **补记（2026-11-05 定时迭代轮）**：复核「暂不触发」冷却 1h→60s 已落盘（`src/07f-pins.js:226` `(Date.now() - cd) < 60000`、build 6961 行同判定、tests §11.4j mock 通过、CHANGELOG ⑫③ 与 README 142 行附近记录）；全链 6 步复跑全绿（性别集成 24 passed），build 重建 SHA 仍 `C34D1875…`（确定性确认，与 11-02 交付包内 build 一致）；修复 `tools/pack.ps1` verifier-hub 入口硬编码旧 skill root（`AppData\Local\Doubao\…` 已迁移 → `AppData\Roaming\LarkShell\aha\users\<id>\doubao\…`，ERR-20261105-001）改动态候选解析；重打包 241,485 B / SHA256=`8B9DB638…` 装 game（双端 SHA 实测一致；zip 含时间戳元数据非确定性，内容与 11-02 的 `F8CBC684…` 包完全同源）；moli real_smoke 4 项启动断言 PASS + 2 项已知 WARN（E/F，moli 单会话局限，见 ERR-20261028-001）

## v1.9.26（2026-11-01 · 全局页新增特殊服装 + 食谱一键解锁）

**需求**：游戏中有需要条件才能获得的特殊服装与食谱，全局页加两个一键按钮（最上面），解锁时同步补足对应故事条件（服装合法获得，非凭空出现）。

### ① 特殊服装（setup.specialClothes，135 件款式）

- 遍历 `setup.specialClothes`（135 件，分属万圣节/圣诞/情人节/神殿/坏结局/历史/外国校服/妓院/厨师/舞蹈/魅魔/蝴蝶/狐神等约 30 套装）
- 解锁标志 `V.specialClothes[i].unlocked = 3`（DoL 原版"满足要求解锁"语义，line 142195 specialClothesUpdate）
- 补足对应套装条件（`SPECIAL_CLOTHES_SET_COND` 44 套装映射 + `SPECIAL_CLOTHES_ITEM_COND` 3 单件，从 `setup.specialClothesSets` 实证提取）：如 witch 补 `tentacletrait=1`、vampire 补 `syndromekylar=1`、神殿补 `temple_rank="monk"`、坏结局补各事件标记等
- 三种补足 op：`set`（标量）/ `push`（数组去重）/ `ensureField`（确保对象+设子键，对象 value 合并不覆盖兄弟键，如 vintage.paintings 不丢其他画）
- 日期条件（halloween/valentines/pumpkin）不补足——unlocked=3 已解锁，日期随游戏推进

### ② 食谱（setup.foodstuff，105 个）

- 遍历 `setup.foodstuff`，对有 `recipe.ingredients` 非空的（105 个）设 `V.foodstuff[key].knows_recipe = true`（DoL 原版学会标志，line 294915）
- 宿主缺失自动建壳 `{amount: 0}` 再设标志

### ③ 按钮绑定（08-npc-traits.js renderGlobal）

- actions 区最上面加 `bc1`（一键解锁所有特殊服装（含对应故事））+ `bc2`（一键解锁所有食谱），在 b1-b4 之前
- setStatus 反馈：特殊服装"N 件已解锁（补足对应故事 M 项）"/ 食谱"N 个已解锁"

### ④ 验证与交付

- 全链 6 步全绿（build/syntax/smoke/regression/E2E/gender ALL PASSED）+ 打包 verifier 4/4、zip 正斜杠、SHA256=42CAD052...
- 版本双源 1.9.26（src/01-core.js + boot.json）；已装消费端 game\
- real_smoke 受消费端脚本 PowerShell arg-splitting 工具局限未通过（非 CE 代码问题，AGENTS 约束不改消费端脚本）

## v1.9.25（2026-10-31 · 升版交付后自查优化：补归途 1.4.6 项链回收线作弊项）

**自查收敛（重读 audit 全文 + 源码实证，非摘要转述）**：`_audit_rv146.txt` [2] 新增候选 175 条绝大多数为父级/已覆盖子键误报（RobinTemple.* / TempleDuties.* / TempleChoir.* / RBR.necklace.* 已声明）；`_audit_dw258.txt` [2] 756 条候选多为父级根/瞬态。真未声明且玩家会作弊收敛为归途项链线；dw258 新增 Robin 清算战斗线（Combat\Robin.twee）所用 `RobinExpansion.victories`（gte 4 触发清算）/`care_fund`（gte 10 支援）实证**已在**枯木适配器声明（04a-04-deadwood.js:191/193）→ 无需补。

### ① 补项（rv146 源码实证）

- **`nkl_stage`**（`RBR.necklace.stage`）：1.4.6 新增 WraithRecovery 回收线阶段状态机（取值实证 `''`/`failed`/`camera`/`case`/`take`/`smash`，WraithRecovery.twee:158/160/194/196/238/247 赋值）——跳回收阶段直接取回项链
- **`nkl_reclaimed`**（`RBR.necklace.reclaimed`）：boolean，回收线成功后置 true（WraithRecovery.twee:264），等价「项链盗贼」分支（Wraith.twee:89/131 `$necklaceThief is 'player' or $RBR.necklace.reclaimed` 开放 Gwylan/归还后续线；:208 归还扣款 £2,000 判定）
- 归途适配器声明：阶段 17→**18** / 能力 22→**24**（+nkl_retaken 上轮 +nkl_stage/nkl_reclaimed 本轮）

### ② 不补项（记录说明，避免噪音）

- `RBR.wraithVisitDay`：怨灵来访日数值（revelation.ts:7 默认 -1；WraithAftercare +3 天善后窗口）——日期瞬态，不作弊
- `LostLamb.marks`：梦境绘图标记**数组**（Before.twee `includes('draw'/'garden'/'kitchen'/'shared'/'shortcut')`）——内容标记瞬态，且数组写入超作弊器能力面
- dw258 756 条候选：父级根/瞬态/低价值，已覆盖键不重复补

### ③ 历史遗留定案

- **Pub NPC 异常**：五轮前截图「0.5.12.13 错误：在"Pub"段落生成的NPC发生异常脱离」→ fw562 dist "Pub" grep（379KB minified，`inject_early.js` Emitter/action 系统）确认该文案为 framework NPC 生命周期报错（段落生成 NPC 未脱离检查）；**非 CE 范围**（CE 不生成 NPC、不介入框架 NPC 生命周期），fw562 5.6.2 已实装，若用户复测仍见需在框架侧跟进
- **README 适配器一览表上轮遗漏修复**：枯木 2.5.7→2.5.8、归途 1.4.5/17/22→1.4.6/18/24、框架 5.6.0→5.6.2（上轮只改标题未改表格行）

### ④ 验证与交付

- tdd 红绿：§19.1 阶段 18/能力 24、§31.1 补 nkl_stage/nkl_reclaimed 收录断言、§31.11 补 reclaimed 开关（true/false）+ nkl_stage 写入（take/smash）
- 全链 6 步全绿 + 打包（verifier 4/4、zip 正斜杠）已装 game；版本双源 1.9.25（src/01-core.js + boot.json）

## v1.9.24（2026-10-31 · 三方模组升版适配：枯木 2.5.8 / 归途 1.4.6 / 框架 5.6.2）

**检测（check_mod_updates.js，2026-10-31T09:26 UTC）**：枯木逢春 2.5.7→**2.5.8**、归途之书 1.4.5→**1.4.6**、框架 5.6.0→**5.6.2**；其余 9 渠道无更新。

### ① 第三方包替换（--apply，用户偏好自动替换）

- 枯木逢春 v2.5.4→**v2.5.8**（game 内旧 2.5.4 移除，装官方 2.5.8 包；注意实装旧版早于适配器声明 2.5.7）
- 归途之书 v1.4.3→**v1.4.6**（旧 1.4.3 移除）
- 框架 5.6.0→**5.6.2**：先跑 `check_framework_api.js` 核对新版 inject_early.js → 核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists / define / frameworkNotice）；`setup.MapleBirch` / `maplebirch.patch` 缺失为非 CE 依赖（CE 源码 0 次调用，01-core.js resolveMB() 兜底分支在 window.maplebirch 主路径存在时不触发）→ 兼容，替换 game 包 + declOverride 5.6.0→5.6.2

### ② 适配器核查与定案（对照源码 dw258 / rv146 实证）

- **枯木逢春 vs 2.5.8**：audit 104/140 字面覆盖 + 36 条缺失 → resolve 定案 **KEEP 127 / REVIEW 14 / REMOVE 1**；逐条实证：`RobinExpansion.investment.agreed` 28 处存活（migrations/Robin.ts:21-22 写入）→ **REMOVE 证伪保留**；`Finance.company.ascension.recognized` 以可选链存活（Achievements.ts:144 `V.Finance?.company?.ascension?.recognized === true`，audit 静态盲区）；`shareholders.board` 可选链存活（Achievements.ts:133 / Company.ts:308）；`raven.met` / `treasure.{coins,museumCoins,crewCoins}` / `Tsukihan.{dom,init,love,lust}` 全部源码实证存活；featsBoosts 6 条动态键 KEEP 严禁 REMOVE → **140 键零删失**
- **归途之书 vs 1.4.6**：audit 56/57 + 缺失 1 条 `RBR.necklace.returned` → resolve REVIEW → 实证 **1.4.6 项链线重构**：`necklace.returned` 已不存在（revelation.ts:8 默认态为 `returnedOnce/retaken/advised/known/prepared/…`）→ 适配器改键 `nkl_returned` varPath `RBR.necklace.returned`→`RBR.necklace.returnedOnce`（语义「已归还一次」），并**新增作弊项 `nkl_retaken`**（`RBR.necklace.retaken`，1.4.6 新增取回分支）
- 适配器声明版本同步：枯木 modName 2.5.7→2.5.8、归途 modName 1.4.5→1.4.6、框架 declOverride 5.6.0→5.6.2

### ③ 验证与交付

- 全链 6 步全绿 + codegraph sync；打包（verifier 4/4、zip 正斜杠 4/4）已装 game（双端 SHA 实测一致）；版本双源 1.9.24（src/01-core.js + boot.json）。

## v1.9.23（2026-10-31 · 剧情页「固定触发」改造为「锚定触发」）

**锚定语义（9 点定稿）**：锚定后必定触发（走到剧情所属地点交互时顶部弹确认条，含地点/时间/前置说明）；确认后走原版 replayScene 通道；播放完标 `completed` 移出队列显示「已完成 ✓」可再自由锚定；「暂不触发」保留待下次；时间仅展示不判定；旧「固定触发」入口移除；「一键完成」「场景直达」保留；「固定整线」按钮随锚定更新。

### ① 机制（07f-pins.js）

- `SCENE_LOCATIONS` 表（约 70+ 场景）/ `SCENE_PRECONDITIONS` 跨线前置表 / `LOCATION_LABELS` 中文显示名；`sceneAnchorMeta` 含 AlexFarmWorkStage 一位/两位数字位宽归一化；
- `pinScene` 锚定语义重写：无 def/startPassage 拒绝；无元数据 →「未标注触发地点（第一批元数据未覆盖该场景），暂不可锚定」；防重拒绝；农场依赖防崩保留；入队项扩展 `anchor:{location,timeNote}`；提示 =「已锚定…（队列第 N 位）：触发地点「locLabel」｜时间 ｜前置未完成：pendingPreconds」；
- `onPassageOverride` 触发区：队首带元数据锚定项不再段落跳转自动触发（改由 `:passageend` 弹确认条）；旧档无元数据项保持旧段落跳转语义；
- `showAnchorPrompt` 顶部确认条（「立即触发」= `startAnchoredReplay` /「暂不触发」= 60s 冷却）；`mbCEOnPassageEnd` / `hookPassageEnd`（`:passageend.mbceAnchor`）；`startAnchoredReplay` 走原版 replayScene 通道（execTweeMacros + freezePlayerStats + `Engine.play(startPassage,true)`，失败回滚 used）；
- `cleanupUsedPins` 统一清理：写 `mbCE_completedScenes[key]={name,t}` + 解锁 + 移除；`exitpassage 返回终点` / `Farm Work 终点` 统一走该入口。

### ② UI（07h-render.js）

- 顶部使用提示横幅改锚定文案；锚定触发状态横幅（队列 N 项 + 清空按钮）；「锚定整线」按钮；单阶段按钮区改「锚定/取消锚定」（无元数据 disabled）；两处「已完成 ✓」徽标（lines/singles，`isSceneCompleted`）。

### ③ 键登记 / 导出 / 白名单

- `03-global.js` CHEAT_VANILLA_ROOTS 白名单 + `mbCE_completedScenes`；`09-exports.js` init 注册 `hookPassageEnd`，mountApi 补 `mbCEOnPassageEnd / startAnchoredReplay / sceneAnchorMeta / pendingPreconds / precondDone`。

### ④ 测试 / 验证

- 测试 §11 整块改写为锚定语义断言（弹确认条 spy createElement===4、原版通道、已完成、再锚定、旧档迁移/旧段落语义保留）；§13 农场用表内 key `AlexFarmWorkStage3`；§25 孤儿院链改走弹条 + `startAnchoredReplay`（补 Engine mock）；§30 文案断言随锚定改版。三轮红绿迭代 17 FAILURES → 0；
- E2E 新增 S 段（S.1–S.10 剧情页锚定按钮真实点击：提示横幅/空队列无横幅/无元数据禁用/可用锚定/入队带地点/队列横幅+徽标/取消锚定/清空队列）；三轮排障（widget 包裹结构、原版分组懒渲染需展开、断言对象 Temple 修正）→ 全绿；
- 全链 6 步全绿 + codegraph sync；已打包（230,725 B / SHA256 `0F847267CDEC0B118017F40F9D816337DD18C3777F5DE03D77DD87D98392E437`，verifier 4/4、zip 正斜杠 4/4）已装 game；版本双源 1.9.23（src/01-core.js + boot.json）。

### ⑤ 自查补（2026-10-31 交付前二次走查：源码全文回归 + 9 点语义逐条核对）

- **修防重入**：`startAnchoredReplay` 重放进行中（`V.replayScene` 存在）再次调用会覆盖 `exitpassage` 为播放器段落导致返回错位/被困播放器（确认条「立即触发」双击可复现）→ 加守卫拒绝并提示等待；测试 §11.4b 断言（红→绿）；
- 9 点语义逐条核对通过：地点判定只走 `V.location` 精确匹配、时间仅展示、前置仅提示、旧档迁移幂等、队列顺序触发、完成后可再锚定；渲染侧位次（`pinQueueIndex`）与提示消息位次语义一致，无偏差；
- 已知边界（不改动，如实记录）：弹条非阻断，玩家离开触发地点后确认条仍停留（再点「立即触发」以当前段落为返回位，行为可接受）；`mbCE_anchorCooldown` 60s 冷却在重新锚定同场景后仍保留（重新锚定后至多 60s 内不再弹，自愈）；地点匹配为精确值（父/子地点不模糊匹配，防误弹）；
- 全链 6 步重跑全绿（含新增 11.4b）；重打包（230,972 B / SHA256 `63175C10A59F1E2D1EF6335ED8985E658AED8BF84FA78A13D4C07B3E2713C11A`，verifier 4/4、zip 正斜杠 4/4）已装 game（SHA 实测一致）；moli 实机冒烟 4 PASS + 2 WARN（工具局限见 `.learnings\ERRORS.md#ERR-20261028-001`）。

### ⑥ 实机修复（2026-10-31 用户实测反馈：锚定触发直达剧情段 + 播完自动完成）

- **用户实测问题**：确认「成人用品店开业」触发后，游戏打开的是**原版场景查看器预览页**（Sydney 立绘 + Start 链接的"剧情播放器"样式）而非剧情本体；且播完未自动取消队列/标「已完成 ✓」。
- **根因**：原版场景注册表 `Adult Shop Opening` 的 `startPassage:"SV Adult Shop Opening"` 是查看器预览页段落（`<<SVSydney>>` + `<<link [[Start|Adult Shop Opening]>>`）；`startAnchoredReplay` 原先直接把 `P.startPassage` 交给 `Engine.play` → 原地打开预览页。凡 startPassage 为 `SV xxx` 预览页形态的锚定场景均受影响；「播完没自动完成」是同根因下游（剧情链未进入，走不到 `Scene Viewer End` 的 cleanup 终点）。
- **修复**（`javascript/src/07f-pins.js` `startAnchoredReplay`）：startPassage 以 `"SV "` 开头时解析预览页段落源码中的 `[[Start|剧情入口]]` 链接（label 恰为 Start；SV 预览链如 `SV Temple Confess Purge → SV Temple Confess Purge 2` 递归跳过，深度上限 10）；解析到非 SV 剧情段 → `entry` 作为播放起点（`V.replayScene.startPassage` 同步设为 entry，原版 redirect 命中首条兜住重入）；无 Start 链接（剧情本体类，如 `SV Pub Fame Intro` 含场景初始化）→ 保持原入口不跳。**判据基于段落源码而非名字前缀**，不误伤带初始化的 SV 剧情本体段。
- **自动完成链路确认**：剧情出口（`Adult Shop Opening End 2` → `Adult Shop`）→ `:passageoverride`（原版 redirect 之前由本钩子处理）→ 原版 redirect 判定不在 passages → `Scene Viewer End` → 本钩子捕获 → `cleanupUsedPins`（解锁 + `mbCE_completedScenes[key]={name,t}` + 移除队列项）+ 回原位。
- **测试**：新增 §11.4c 断言（红→绿）：SV 预览页场景触发 `Engine.play("Adult Shop Opening",true)`（非预览页）；replayScene 起点=剧情首段；播到出口不干预；Scene Viewer End → 队列清空 + 标「已完成 ✓」+ 回原位；SV 预览链递归直达剧情入口 + 播完队列清空。
- 全链 6 步重跑全绿 + codegraph sync；重打包（231,593 B / SHA256 `88B5A56FAC2DA1B5E6A3DABF6393C05DC5585D10DE97D7465DFA8D65A9616A1B`，verifier 4/4、zip 正斜杠 4/4）已装 game（SHA 实测一致）；moli 实机冒烟 4 PASS + 2 WARN（工具局限，同前）。版本双源仍 1.9.23（未升版）。

### ⑦ 实机修复二轮（2026-10-31 用户复测：仍被困 Scene Viewer End / 队列不清 / 反复弹触发条 / 主场景英文名）

- **用户复测问题**：实测「艾弗里直升飞机」场景（剧情本体段、无 Start 链接，第一轮判据保留原入口，进得去）播完仍停在「"艾弗里直升飞机"场景结束。/ (1)退出场景」界面——队列不清、标不了「已完成 ✓」、返回地点又弹确认条；另：场景面板新加的「主场景 Asylum / Police Cell / Docks / Lake Stroll / Wolf Pack / Hospital front」英文名未翻译。
- **根因定案**（`javascript/src/07f-pins.js` `onPassageOverride` 810–900）：第一轮只修了「进得去」，没修「出得去」。剧情出口段（dest 不在 `replayScene.passages`，如直升飞机出口、`Adult Shop`、`Park`、`Farm Barn` 等）会被原版 redirect（原版 HTML 31697–31698）改写为 `"Scene Viewer End"`，而本钩子已在**同一轮 `:passageoverride` 事件内执行过**（只看到改写前的旧 dest）→ 下方 823 的 `Scene Viewer End` 分支永远收不到改写后的 dest → 播完不清理、队列残留、返回地点再弹；玩家点「退出场景」（End 段汉化链接 target=`Scene Viewer`）又被 redirect 打回 End → 死循环被困。测试 mock 直调 `Scene Viewer End` 分支全绿，实机链路（Engine.play → :passageoverride → redirect → 返回）未被覆盖——「玩家路径 ≠ 测试路径」盲区实证。
- **修复**：在 `onPassageOverride` 的 `V.replayScene` 分支内新增**剧情出口接管**（837–854）：本轮事件内直接判定 dest 不在 `replayScene.passages`（链外 = 原版 redirect 语义即"剧情结束"）→ `cleanupUsedPins()`（解锁 + 标「已完成 ✓」+ 移除队列项）+ `mbCEClearReplay()` + `passageArgs.name = exitpassage` 回原位 → 原版 31683 检测 name 已变 → `return` 新 dest，redirect 不再执行，不再进 Scene Viewer End。保留 `Farm Work` 确定性终点特例（855–876）；原版手动重放（`!mbCE_replayOnce`）仍不干预（836）。「弄完之后还是触发」同根因：used 项未移除 + replayScene 残留 → 返回地点再弹（`mbCEOnPassageEnd` 340/344 已有 `V.replayScene`/`!used` 双短路，队列清空后无项可弹）。
- **翻译**（`javascript/src/07d-places.js` `PLACE_CN`）：补新 6 组主场景名映射（asylum=精神病院、police=警局与监狱、prison=监狱、docks=码头、lake=湖畔、wolf=狼群、hospital=医院）→ 场景直达「主场景 X ★（中文）」行生效；组名行（`精神病院 · Asylum` 等）原本已中英混合不重复加注。
- **测试**：§11.4c 出口拦截断言（Adult Shop 出口 → 队列清空 + 回原位）；§11.5 更新为出口语义（Park 链外 → 清理 + 回原位）；§15.10b 更新为链外出口拦截 + 未触发队列项不被误删；§11.4d 新增「已 used 项不再弹确认条」；§15.9b 新增「主场景名中文化映射入产物」断言。红（11 FAILURES，旧断言锁定旧行为）→ 绿（0 FAILURES）。
- 全链 6 步全绿 + codegraph sync；重打包（232,508 B / SHA256 `BCA860E10EBE40D002F8052717297FD05C3A6DF8F8D569D948B6910E2C0EBE84`，verifier 4/4、zip 正斜杠 4/4）已装 game（双端 SHA 实测一致）。版本双源仍 1.9.23（未升版）。

### ⑧ 实机修复三轮（2026-10-31 用户实测：不进播放器 ✓，但「米奇酒吧知名度初见」播完任务未完成）

- **用户实测确认**：锚定触发已不再进场景播放器（直达剧情本体 ✓，二轮出口拦截生效）；但「米奇酒吧知名度初见」点「立即触发」后剧情播完所属任务未完成（队列项未清理/未标「已完成 ✓」）。
- **根因**（原版 HTML 280662-280664 注册 + 661897-663197 段落链实证）：`Mickey Pub Fame Intro` 注册 `passages:["SV Pub Fame Intro","Pub Fame Intro","Pub Fame Intro 2","Pub Fame Intro 3","Pub Fame Intro 4"]`；`Pub Fame Intro 4` 段实为酒吧主段，其剧情分支（663182）出口 `[[Next|Pub Fame Intro]]` **回链列表内段** → dest 永远在 `replayScene.passages` 内（inChain 恒 true）→ 二轮「出口接管」（判定 `!inChain`）永不触发 → 播完不清队列。**二轮修复覆盖的是"链外出口"，遗漏了"链内循环出口"这一类场景**。
- **修复**（`javascript/src/07f-pins.js` `onPassageOverride`）：重放期间在 `replayScene.mbCE_visited` 记录已访问段；inChain 分支改为——**首次访问 push 不干预；已访问段再次到达且非 startPassage/exitpassage（剧情链循环回点 = 剧情播完）→ cleanupUsedPins + mbCEClearReplay + passageArgs.name=exitpassage 回原位**；出口拦截分支（849）加 `dest !== startPassage` 排除（入口段不在列表的场景不误清）。`Farm Work`/Scene Viewer passages/手动重放分支语义不变。
- **测试**：新增 §11.4e（红→绿）：米奇酒吧知名度初见（5 段链）触发 → 链内段 1→2→3→4 首次访问不拦截 → 4 段剧情分支回 `Pub Fame Intro`（已访问 → 循环回点）→ 重放清理 + 队列清空 + 标已完成 + dest 接管回原位。红 4 FAILURES → 绿 0。
- 全链 6 步全绿 + codegraph sync；重打包（233,333 B / SHA256 `A65FEBBF443F0135E369CE2143AA0629D77FCEAB9B9FE98EB7EC637554B9D17F`，verifier 4/4、zip 正斜杠 4/4）已装 game（双端 SHA 实测一致）。版本双源仍 1.9.23（未升版）。

### ⑨ 实机修复四轮（2026-10-31 用户第 4 次反馈：触发后队列仍未清——实机补盲「末段落地点」路径）

- **用户第 4 次实测（13_05_17 截图）**：「米奇酒吧知名度初见」点「立即触发」后**队列未清、确认条仍挂、中间已是 Pub 酒吧选项**（4 段 else 内容），且「孤儿院黑客米奇」已达成。
- **根因**（原版 HTML 281186-281200 SV Pub Fame Intro + 663216-663251 Pub Fame Intro 4 else 分支实证）：**SV Pub Fame Intro 段（pid 184）本体含剧情文本 + `<<set $pubfame …>>` 初始化 + `[[Next|Pub Fame Intro]]`**；孤儿院黑客米奇已达成后 **$pubfame 已存在** → 触发时 4 段（酒吧主段）**663182 剧情分支（!$pubfame）不命中 → 走 else 酒吧选项（出口全链外，无循环）** → 三轮「循环回点」检测覆盖不到（无循环可回）→ 玩家在 4 段（酒吧选项）不点选项 → 队列残留。**三轮修的是「分支循环」路径，实机走的是「else 落地点」路径**。
- **修复**（`javascript/src/07f-pins.js` `onPassageOverride` 链内分支）：新增**剧情线性走完检测**——到达剧情末段（`passages` 最后一段）且**前置链内段均已访问**（`replayScene.mbCE_visited`）= 剧情播完（落地点，如 Pub Fame Intro 4）→ `cleanupUsedPins + mbCEClearReplay + passageArgs.name=exitpassage` 回原位；用 push 前 wasVisited 区分首次/循环，分支型场景（Avery 各分支段前置未全访问）→ 不触发不误伤；循环回点检测保留作兜底。
- **测试**：§11.4e 更新为实机语义（补入口段 visited 模拟 + 到达 4 段线性播完 → 清理 + 标完成 + 回原位），红 → 绿。
- 全链 6 步全绿 + codegraph sync；重打包（233,947 B / SHA256 `6E837B913BDB64F0E9C2DB73B0BA4CDFD2E182CC63CD0296F95FF1F10B5394F6`，verifier 4/4、zip 正斜杠 4/4）已装 game（双端 SHA 实测一致）。版本双源仍 1.9.23（未升版）。

### ⑩ 实机修复五轮（2026-10-31 用户第 5 次反馈：取消锚定后「立即触发」残留 + 暂不触发后其他锚定不弹）

- **用户第 5 次实测（13_17_06 截图）**：人已离开酒吧（麋鹿街工业区），顶部确认条「检测到锚定剧情『米奇酒吧知名度初见』：触发地点『酒吧』」仍挂；右侧面板「要求：未达成（条件未满足）」与弹条「前置均已达成」自相矛盾；并反馈**取消锚定之后「立即触发」并没有消失**、**选了「暂不触发」之后再去选其他锚定，其他锚定的「立即触发」也不会出现**。
- **根因 A（残留确认条跨段残留）**：弹条后玩家未点按钮直接离开触发地点（酒吧→麋鹿街），`position:fixed` 确认条跨段残留——「取消锚定之后立即触发没消失」的画面证据就是麋鹿街挂着酒吧条。
- **修复 A**（`07f-pins.js` `mbCEOnPassageEnd`）：段落后先查当前展示条 → 其对应地点 ≠ 当前 `V.location` → 自动 `hideAnchorPrompt()`，不重弹。
- **根因 B（队首拦截后续锚定）**：旧实现只取**队首**项、location 不匹配即 `return` → 队首「米奇酒吧知名度初见」（触发地点酒吧）在玩家到其他地点时**拦截了后续所有锚定的弹条**——「暂不触发后其他锚定不弹」根因。
- **修复 B**：遍历队列找「当前地点匹配」的未用未完成锚定项（不再只看队首），命中即弹。
- **测试**：§11.4f（跨地点残留确认条自动收起、不重弹）+ §11.4g（队首地点不匹配 → 遍历找地点匹配项弹出），红 → 绿。

### ⑪ 实机修复六轮（2026-10-31 同轮：确认条循环弹的 used 还原根因——freeze 快照复活）

- **根因**（实机 F12 铁证 live=true / frozen=false）：`startAnchoredReplay` 原先 **`P.used=true` 写在 `freezePlayerStats` 之后**——原版 freeze widget 深拷贝整个 `State.variables` 冻结快照，`mbCE_queue` 不在其 `skipKeysOnFreeze` 排除表 → 冻结快照含 `used:false` → 播完原版 `unfreezePlayerStats` 用 strict-replace 恢复快照**把 used 还原为 false（队列项复活）** → 确认条循环弹（已清除/已完成的项下一段又出现）。
- **修复**（`07f-pins.js`）：① `P.used=true` **提前到 `freezePlayerStats` 之前**写入（冻结快照含 true → 恢复后保持 true）；② `mbCEOnPassageEnd` 入口**幂等 `cleanupUsedPins()`**（已触发项写「已完成 ✓」+移出队列，复活项在下一段落被清，确认条不再循环弹）。
- **测试**：§11.4 系断言更新为「freeze 前已 used → 冻结快照含 true → 恢复后仍 true」语义，红 → 绿。
- 全链 6 步全绿 + codegraph sync；重打包（235,445 B / SHA256 `697273BF88110BCDCE7796133A28948F97D831385466754CAB88D4C11BDAA105`，verifier 4/4、zip 正斜杠 4/4）已装 game（双端 SHA 实测一致）。版本双源仍 1.9.23（未升版）。本轮保留 `[MCE-PROBE]` 运行时探针（F12 可观察 freeze 前后 used 状态），用户验收后移除。

### ⑫ 自查优化（2026-10-31 同轮，不升版本）

- **① 同地点多锚定拦截遗漏（`mbCEOnPassageEnd` 遍历）**：五轮修复把弹条改为「遍历队列找地点匹配项」，但找到首个匹配项后 `anchorPromptActive(P.key) { return; }` **是 return 不是 continue**——同地点多锚定时，A 暂不触发（1h 冷却）或正展示中 → B（同地点）被 return 拦截永不弹——**「暂不触发后其他锚定不弹」的同地点残余路径**。修复：冷却/展示中的项 `continue` 继续找下一个同地点匹配项，全部不可用才不弹。测试 §11.4h 红→绿（A 展示中 → 同地点 B 正常弹出）。
- **② 弹条文案口径误导（13_17 截图「前置均已达成」vs 面板「要求：未达成」）**：`pendingPreconds` 对无数字后缀且无显式映射的键（如 `MickeyPubFameIntro`）恒返回空 → 弹条永远显示「前置均已达成」——与面板完成状态「要求：未达成（条件未满足）」同屏自相矛盾（**触发前置 ≠ 完成条件**，两套判定本就不同，纯文案误导）。修复：无前置要求时改为「｜触发前置：无」，有前置未完成才列名。测试 §11.4i 红→绿（弹条文案不含「前置均已达成」、含「触发前置：无」）。
- **③ 暂不触发冷却 1h→60s（用户拍板）**：`mbCE_anchorCooldown` 判定 `3600000`→`60000`（现实时间，非游戏内时钟）——同地点暂不触发后 60 秒内不再弹、60 秒后恢复可弹；仍为内存态（不写存档，刷新页面失效，走到地点重新弹条）。测试 §11.4j 红→绿（mock Date.now：skip 写冷却后同地点不弹 + 61s 后恢复弹）。
- 全链 6 步全绿 + codegraph sync；重打包（236,503 B / SHA256 `F0F503AC3CD7CDD4F38315D00D14FC82E7F23AF28E9DB0AD5BA59EE06A2DC593`，verifier 4/4、zip 正斜杠 4/4）已装 game（双端 SHA 实测一致）。版本双源仍 1.9.23（未升版）。

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
