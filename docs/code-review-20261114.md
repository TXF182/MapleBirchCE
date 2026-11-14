# MapleBirchCE 四维审查（架构 / 可维护性 / 可读性 / 性能）

- 审查对象：`javascript/src`（79 分片 / 17,153 行 / 1,072,471 B）+ 产物 `javascript/maplebirchce.js`（79 段 / 1,072,471 B / SHA256 `BA87AE8B9CB393BCDEBA2E1075393B9396259783EAAE70E08A4DAE3BF8C45183`）
- 版本：v2.1.4（commit `7bad339`）
- 审查日期：2026-11-14
- 性质：**只读审查，未改任何源码**。下文所有数字均为本轮实测，命令附在各节。

## 0. 方法与工具（全部可复跑）

| 用途 | 工具 | 命令 |
|---|---|---|
| 规模与分片分布 | PowerShell | `Get-ChildItem javascript\src -Filter *.js \| % { $_.Name, (Get-Content $_).Count, $_.Length }` |
| 函数长度 / var 占比 / typeof / try / 重复字面量 | python 静态扫描 | `python %TEMP%\mce_src_audit.py` |
| 命名空间合规 / 遮蔽 | python | `python %TEMP%\mce_namespace_audit.py` |
| 监听器 / 定时器 / DOM 重建计数 | python | `python %TEMP%\mce_runtime_audit.py` |
| 注释密度 / 分片头注 | python | `python %TEMP%\mce_comment_audit.py` |
| 存量缺陷规模（门禁外规则） | ESLint 10.14.0 + 临时配置 | `npx eslint -c %TEMP%\eslint_probe.mjs javascript\maplebirchce.js -f json`（**不替换项目 eslint.config.js**） |
| 真实段落数据源 | 本体 HTML 正则导出 | `python %TEMP%\mce_dump_all.py "…\game\Degrees of Lewdity.html" %TEMP%\mce_all_passages.json` |
| 场景直达性能 | jsdom + 真实 16,087 段 | `node tools\_tmp_bench_places.js javascript\maplebirchce.js %TEMP%\mce_all_passages.json` |
| 成本拆解 | 同上，只读实验 | `node tools\_tmp_bench_split.js %TEMP%\mce_all_passages.json javascript\maplebirchce.js` |
| 基线门禁 | 项目全链 | `.\tools\run_all.ps1` → **12/12 ALL CHECKS PASSED**（覆盖率 96.94 / 81.4 / 97.84；拼接 SHA == 产物 SHA；键注册表 425 条 / 12 适配器） |

> 判据边界：本节全部为**测量**，不是判定。代码缺陷的最终确认仍需配套测试（见第 5 节）。

## 1. 结论总览

| 维度 | 有缺陷？ | 性质 | 最硬证据 |
|---|---|---|---|
| 代码架构 | **是**（中） | 分片容量耗尽 + 无模块边界，非设计错误 | 3 个分片正好 400 行（门禁上限）；559 函数仅 47.6% 带前缀 |
| 可维护性 | **是**（中） | 缺少自动化护栏，存量本身较干净 | 门禁只有 10 条规则；`complexity>10` 158 个函数零告警；`no-shadow` 20 处遮蔽顶层 `open()` |
| 可读性 | **局部是** | 注释质量好，但巨型函数与硬编码类名 | 注释密度 17.5%（好）；6 个函数 >200 行；`mce-err` 硬编码 122 次 |
| 性能优化 | **是**（高） | 1 个真实热点，且现有压测看不见它 | `listPlaceGroups()` 133~193 ms/次，97% 花在匹配循环 |

## 2. 代码架构

### 2.1 分片容量已耗尽（真实约束，会持续扭曲设计）

`tools\structure-baseline.json`：`maxLines: 400`、`lineAllowlist: {}`（零豁免）。

| 分片 | 行数 | 占上限 |
|---|---|---|
| `07a-shell.js` | 400 | 100% |
| `07d-places4.js` | 400 | 100% |
| `09-exports2.js` | 400 | 100% |
| `07d-places.js` | 399 | 99.8% |
| `01-core.js` | 393 | 98.3% |
| `05b-modcheat-player.js` | 392 | 98.0% |
| `07d-places2.js` | 391 | 97.8% |

**已产生实际后果（源码自证）**：`07d-places3.js:167` 原文注释 ——

> 「放本分片而不是 07d-places4.js：4.js 已到结构门禁 400 行上限（S1），3.js 尚有余量」

即 v2.1.4 的惠特尼白名单是被**行数预算**而不是语义归属推过去的。这是架构缺陷的典型形态：**门禁本意是防单文件过大，实际变成了"设计服从字数额度"**。

### 2.2 无模块边界：79 分片 = 一个平坦符号池

79 个分片拼接进**单一 IIFE**，因此：

- 函数声明 **559 个**，全部共享同一词法作用域；
- 顶层 `var` **460 个**（跨分片共享可变状态）；
- 带项目前缀（`mbCE`/`cheat`/`mce`/`mbC`）**266 个 → 合规率 47.6%**，293 个无前缀（`getV` / `findNpc` / `renderGlobal` / `open` / `toggle` / `push` …）。

没有文件级作用域，等于**没有任何东西阻止 A 分片直接调用 B 分片的内部函数**；分片编号（`01`…`09`）是唯一的事实架构。

> 补充核实：`push`（`01-core.js:127` / `07e-scenes2.js:29`）与 `toggle`（`07a-shell.js:78` / `09-exports.js:62`）各出现 2 次，但均位于**各自函数的闭包内**，不构成冲突 —— 此项**排除**，不算缺陷。

### 2.3 页面渲染「一函数一页」

| 函数 | 行数 | 位置 |
|---|---|---|
| `renderGlobal` | 375 | `08-npc-traits2.js:2` |
| `mountApi` | 338 | `09-exports2.js:58` |
| `renderSceneCluster` | 234 | `07h-render2.js:86` |
| `renderYanling` | 229 | `07i-yanling-page.js:3` |
| `renderPlacesDirect` | 215 | `07d-places2.js:149` |
| `onPassageOverride` | 203 | `07f-pins4-hook.js:2` |

`renderGlobal` 在单个函数体内依次内联构建 12+ 个分组（面板设置 / 批量速成 / 世界数值 / 态度 / 庄园维护 …），每个分组都是「建节点 + 绑监听 + 调 renderGlobal 重建」。**页面结构写死在函数体里，无法单独复用或局部刷新**。

## 3. 可维护性

### 3.1 护栏缺口（本维核心问题）

`eslint.config.js`（103 行）只有 10 条**确定性错误**规则，配置注释明写「只做确定性错误检查，不做风格检查」。用临时配置补测（不替换项目配置）：

| 规则 | 存量 | 说明 |
|---|---|---|
| `complexity > 10` | **158 个函数** | 无任何自动化复杂度守卫 |
| `max-lines-per-function > 120` | 13 个 | 与 2.3 的 6 个 >200 行互相印证 |
| `max-params > 4` | 9 个 | — |
| `no-shadow` | **20 处** | 见 3.2，有真实风险面 |
| `no-unused-vars` | **7 条**（已剔除 397 条 catch 参数） | 结论：**存量很干净**，不是问题 |
| `no-var` | 2,532 | 风格统一，非缺陷（ES2018 约束下的既定写法） |

**必须如实说明**：规则面窄 ≠ 代码烂。剔除 `catch (e)` 误报后，真正未使用的声明只有 7 条，说明项目的**手工自查是有效的**；缺的是「以后不被新代码悄悄拖回去」的守卫。

### 3.2 `no-shadow` 20 处：顶层 `open()` 被遮 14 次

产物 L16410 是面板打开函数：

```js
function open() { openFlag = true; if (root) { … } }
```

而 L4646、4696、5439、6370、6459、6763、6779、6794、7369、7976、10453、12555、12873 等 **14 处**在内部写 `var open = …`（折叠状态布尔）。

- 现状**不是 bug**：已核 L4645-4652 那处，回调体内用的是局部布尔，不调用顶层 `open()`。
- 但它是**靠"恰好没调用"活着**：任何人日后在那些回调里写一句 `open()`，拿到的就是布尔/`undefined`，报 TypeError 且 ESLint 不拦（现行规则无 `no-shadow`）。

同类：`root` 2 处（L7181/7252 遮蔽 L6718）、`b1`/`b2` 各 1 处（L15354/15365）、`toggle` 1 处。

### 3.3 状态与资源

- 顶层 `var` **460 个**跨分片共享，无单一状态容器约束（`mbCEUiState` 只是其中之一）。
- `addEventListener` **207 处 / `removeEventListener` 0 处**。判定：**不构成泄漏** —— 面板节点用 `pane.textContent=""` 丢弃后由 GC 回收；`window`/`document` 级 12 处均有单次绑定守卫（`09-exports.js:184` 的 `__mbCEPosBound`）或位于初始化路径。但「绑了不解」成为项目惯例，日后若把监听挂到长生命周期对象上即会累积。
- `setInterval 5 / clearInterval 5`（配平）、`setTimeout 15`（含 `mbCEArrivalCheck` 的 250 ms 到达校验，有回退兜底）。

## 4. 可读性

正向指标（先给好的，避免误判）：

- 注释密度 **17.5%**（2,507 注释行 / 14,303 代码行），属工程良好水平；
- **41.8%** 分片（33/79）以「职责：…」头部注释开头，跨分片可读性有基础；
- `console.log` 在源码中 **0 处**（调试输出已清干净）。

缺陷：

| 项 | 实测 | 影响 |
|---|---|---|
| 巨型函数 | 6 个 >200 行（最长 375） | 单次阅读超出一个屏幕数十倍，改动风险高 |
| CSS 类名硬编码 | `"mce-err"` 122 次、`"mce-ok"` 99、`"mce-hint"` 82、`"mce-row"` 68 | 无集中常量表，改名需全库替换 |
| 防御式噪声 | `typeof` 744 处（4.3/百行）、`try` 476 个（2.8/百行） | 业务逻辑与"宿主可能不存在"的能力探测交织，读起来要反复跳过防御壳 |
| `var` 99.9% | 2,546 vs `let+const` 2 | 风格统一是优点，但无块作用域，配合 `no-shadow` 缺失形成 3.2 的隐患 |
| 分片头注缺失 | 46/79 无「职责：」头注 | 打开一个 `07x` 分片，无法一眼确认它归哪页 |

## 5. 性能优化（最严重，且有实测闭环）

### 5.1 真实数据规模

`python %TEMP%\mce_dump_all.py` 从本体导出：**16,087 段 / 正文总量 32,034,516 B（约 32 MB）/ 单段最大 348,586 B**。

### 5.2 热点实测：`listPlaceGroups()`

`node tools\_tmp_bench_places.js`（jsdom + 真实 16,087 段 + 真实产物）：

```
组数=24  组内条目合计=4,748  单组最大=832
5 次耗时（ms）: 193.3 / 141.9 / 133.5 / 138.5 / 135.3
首次=193.3 ms  后续均值=137.3 ms
heapUsed=166.6 MB  rss=240.0 MB
```

**无缓存**：第 2~5 次仍是 137 ms 量级，说明每次调用都从头算。

### 5.3 成本构成（重要：推翻了直觉解法）

`node tools\_tmp_bench_split.js` 的只读实验：

```
仅枚举 16,087 段（构造 {name,text}）: 4.0 ms   ← 只占 3%
仅组匹配（复用同一 ps 数组）        : 131.3 ms  ← 占 97%
枚举 + 匹配（当前实现等价物）        : 129.0 ms
```

即：**给 `listAllPassages()` 加缓存只能省 4 ms（3%），真正的成本是 24 组 × 16,087 段 = 386,088 次 `g.match(n)`**。

`g.match` 的实现是前缀比较（`07d-places.js:7` `n.indexOf("Orphanage Loft") === 0`、`07d-places3.js:158` `n.indexOf("Whitney Home") === 0`）和少量正则（`:10` `/sirris/i.test(n)`、`:12` `/gwylan/i.test(n)`），单次 ~0.34 µs，386k 次合计 131 ms。

### 5.4 玩家侧触发频率

- `listPlaceGroups()` 全项目**只有 1 个调用点**：`07d-places2.js:150`（`renderPlacesDirect` 第一行）→ 改造面很窄，这是好消息。
- 但 `renderPlaces()`（`07d-places.js:321`，内含 `pane.textContent = ""` 全量重建）被 **14+ 处**调用：页签切换（`07d-places.js:333/342`）、每个直达按钮回调、`07k-island-npc.js` 10 处写后刷新、`07d-places2.js` 6 处、`07d-places4.js:305`。
- **结论**：玩家每点一次面板里的地点相关按钮，就付一次约 137 ms 的主线程阻塞。桌面尚可感；手机 WebView 按 3~5× 估约 **0.5~1 s**。

同类：`renderGlobal()`（375 行）被 **12+ 处**调用（`08-npc-traits2.js:33/108/119/137`、`07f-lock.js:279/290/352`、`07f-lurker.js:89/140/146/157/165`、`07a-shell3-fx.js:253`），每次全量重建 + `listCharacters()` 重跑。

### 5.5 现有压测为何没抓到（验证体系缺陷）

`tests/bench_panel_render.js:74`：

```js
global.Story = { has: () => false, passages: [], size: 0, get: () => null };
```

`Story` 被 mock 成**空段落集**，`lookupWith` 也没有 → 压测里 `listPlaceGroups()` 遍历 0 段，places 页测得 2.1~11.6 ms（`docs\benchmarks.md` 基线表）。

**压测对真实段落规模（16,087 段）完全盲**，因此 137 ms 的绝对热点在基线表上不可见。这是本次审查最有价值的发现之一：**不是代码没测，而是测的数据规模不真实**。

`docs\benchmarks.md` 的口径段本身已警告「jsdom 不跑 CSS 布局，只量逻辑构建」，但没有警告「数据规模为 0」这一层。

## 6. 建议优先级（按证据强度排序，未执行任何改动）

| 优先级 | 事项 | 依据 | 预期收益 |
|---|---|---|---|
| **P0** | 缓存 `listPlaceGroups()` 结果（按段落集指纹失效：`Story.size` + 名称集合哈希，MOD 热插拔时重算） | 5.2/5.3：137 ms 且仅 1 个调用点 | 重复开面板 137 ms → ≈0 |
| **P0** | 修压测数据规模：`bench_panel_render.js` 的 `Story` mock 注入真实段落集（或至少 16k 量级的合成段落） | 5.5 | 让此类退化以后能被门禁外的压测拦住 |
| P1 | `renderPlaces` / `renderGlobal` 改局部更新（按钮回调只改受影响行，不全量 `textContent=""`） | 5.4 | 去掉 14+ / 12+ 处全量重建 |
| P1 | ESLint 补 `complexity` / `max-lines-per-function` / `no-shadow`，**棘轮式**（存量 warn、新代码 error，先不改存量） | 3.1/3.2 | 防新债；`open()` 遮蔽面收敛 |
| P2 | 拆 `renderGlobal` 为分组渲染器；CSS 类名抽常量表 | 2.3 / 4 | 可读性与复用 |
| P3 | 为 46/79 分片补「职责：」头注；分片容量策略重定（400 → 按职责边界 + 允许按语义续号） | 2.1 / 4 | 长期可维护性 |

**不建议做的**：把 `var` 全量迁 `let/const`。ES2018 + 全项目统一风格下这是纯风格改动，收益低、回归面极大，且 `package.json` 的 `ecmaVersion` 会连带影响产物兼容性。

## 7. 局限与未验证项（如实声明）

1. 本轮为**静态 + 离线基准**。性能数字来自 jsdom，**不含 CSS 布局/绘制/合成**，不能当首帧或帧率结论；手机端倍数为估算，未实机测。
2. `listPlaceGroups` 的 137 ms 在**真实浏览器**中是否同量级，未验证（jsdom 的 DOM 与 JS 引擎与 Edge 不同）。
3. 未验证「MOD 热插拔后段落集变化」的缓存失效方案细节（`Story.size` 是否可靠变化，未取证）。
4. 未验证 `renderPlaces` 全量重建在真实设备上的掉帧表现。
5. **未改任何源码**，因此没有「改后测试验证」；第 6 节全部是建议，不是已完成的修复。
6. 临时文件（`tools\_tmp_bench_places.js`、`tools\_tmp_bench_split.js`、`%TEMP%\mce_*.py`、`%TEMP%\eslint_probe.mjs`、`%TEMP%\mce_all_passages.json`）未提交 git、未清理，待用户决定。

## 8. 溯源索引

- 结构上限：`tools\structure-baseline.json`
- 门禁规则：`eslint.config.js`（10 条，含注释说明为何不检风格）
- 行数倒逼实证：`javascript\src\07d-places3.js:167`
- 热点实现：`javascript\src\07d-places.js:297-319`（`listPlaceGroups`）、`07e-scenes.js:10-40`（`listAllPassages`）
- 匹配实现：`07d-places.js:7-30`、`07d-places3.js:137/158`
- 重建入口：`07d-places.js:321-324`、`07d-places2.js:149-150`
- 遮蔽实证：产物 `javascript\maplebirchce.js:16410`（`function open()`）vs `:4646`（`var open`）
- 压测盲区：`tests\bench_panel_render.js:74`
- 既有基线：`docs\benchmarks.md`
