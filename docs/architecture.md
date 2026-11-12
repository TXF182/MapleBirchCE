# MapleBirchCE 架构说明

> 目的：填平 `docs/` 长期缺架构文档的缺口。回答四个问题——**代码怎么拼起来的、运行期从哪一步进入、写入一笔作弊值经过哪些关卡、改一处会波及谁**。
> 生成方式：全部结论来自仓库内源码与本轮实测（命令写在每节末尾，可复跑）。口径冲突时以源码为准，不以本文为准。

## 1. 构建形态：73 段片段拼接成单文件

- 源码在 `javascript/src/*.js`，共 **73 段**（`tools/manifest.json` 定序），产物是单文件 `javascript/maplebirchce.js`（v2.0.12 基线 958,218 B）。
- 段不是独立模块：`00-preamble.js` 只开括号/建命名空间，`09-exports.js` 收尾闭括号。**因此任何单段文件单独解析必然语法错误**——这是 ESLint 只 lint 产物、不 lint src 的原因。
- 段序号带后缀（`03c-global-combat2` / `07a-shell2` / `09-exports2`）是历史切分产物：一段超 400 行上限时追加续号段，**不是**按职责切的。当前结构门禁实测 0 违规（`continuationAllowlist` 9 项是历史豁免名单）。
- 构建脚本 `tools/build_js.js` 只做拼接 + 段末换行，**不做 normalize、不做语法校验**；所以 `node --check` 与 ESLint 是必经层，不能跳。

复跑：`node tools/build_js.js`；结构门禁 `node tools/check_structure.js`（上限 400 行）。

## 2. 段职责分层

| 层 | 段 | 职责 |
|---|---|---|
| 基座 | `00-preamble` / `01-core` | 版本号、`getV`/`getSetup`/`mbCEErr`、角色分类、数值读写、留痕裁剪 |
| 业务域 | `02-romance` / `03*`-global / `04a-*` 适配器 | 恋爱-转化阶段、全局一键（维护/战斗/时间）、13 个第三方模组适配器 |
| 写入执行器 | `04b-modcheat-write` / `04c-modcheat-util` | 所有「改存档值」的唯一通道（见第 4 节） |
| 作弊 UI | `05*` / `06*` / `07*` / `08*` | 页面行渲染、特质、场景直达、锁定、言灵、渲染分片 |
| 导出 | `09-exports{,-vcore,-2}` | 面板 API 与页签注册表；把主导出表挂到 `setup.mbStageCE` |

## 3. 运行期进入：注入 → 建壳 → 等宿主 → 挂导出

1. ModLoader 按 `boot.json` 的 `scriptFileList_inject_early` 注入 CE 脚本（日志为 `inject start/end: MapleBirchCE`）。
2. `09-exports.js` 的 `ensureDom` 建三件套：`#mce-style`（CSS）、`#mce-toggle`（唯一入口悬浮球）、`#mce-root`（面板容器）。**这三件套不依赖 SugarCube 引擎**，所以引擎没起也能建出来。
3. 导出挂载在 `09-exports2.js:60` 的 `getSetup().mbStageCE = {…}`，之后再由 `09-exports-vcore.js` 补 vcore 键。
   **→ 对外契约是 `setup.mbStageCE`，不是 `window.mbCE`。** 源码里 `window.mbCE` 一次都没出现过，`window` 级只有三个：`mbCELurkerPatchReport`（07f-lurker0-patch）、`__mbCEUnfreezeHooked`/`unfreezePlayerStats`（07f-pins4-hook）、`isCrossdressing`（07i-yanling-core）。
4. 依赖前置：`boot.json` 声明 `maplebirch >= 5.4.2`；框架自身还要 7 个插件（ModLoaderGui / ModSubUiAngularJs / ConflictChecker / BeautySelectorAddon / ReplacePatcher / TweeReplacer + ModLoader）。**任一缺失则框架起不来 → CE 的依赖检查失败 → 导出不挂**，但 DOM 三件套已经建好（玩家侧表现为「球在、点了没内容」）。

复跑：`grep -rn "mbStageCE" javascript/src`（6 处）；`grep -rn "window\.[A-Za-z0-9_$]+ =" javascript/src`（10 处，含注释）。

## 4. 写入链路（一笔作弊值要过 6 关）

`cheatWriteValue(modId, key, op, varPath, raw, type, min, max)`（`04b-modcheat-write.js` L95–149）：

1. **父宿主检查**：`cheatIsVanillaRoot` → `mbCEBuildAdapterPaths` → `mbCEIsDeclaredAdapterPath`，未声明的适配器路径直接拒绝（防写穿到原版根键）。
2. **路径解析**：`cheatResolvePath` 逐层取父对象，父缺失 → 优雅拒绝（不创建隐式结构）。
3. **类型收口**：数值 / 布尔 / 字符串按声明类型写，避免「写 true 到 `is 1` 判据前恒假」的静默失效（该缺陷曾在 wr134 上实证并修复）。
4. **相对值与下限**：支持 `+N` / `-N`；`min` 钳制下限；**上限不钳制**（`def.max` 只是 UI 参考，刻意保留）。
5. **留痕**：写前把「首写前状态」记进 `V.mbCE_wrote`（用 `"before" in prev` 判定，保证多次写只记第一次），供回退中心还原；`mbCEWroteTrim` 超 400 条裁剪一半，但 `type:"lock"` 条目豁免（它是取消锁定的唯一依据）。
6. **预览与联动**：`mbCEPreviewGate` 做 diff 预览，`applyCheatSync` 触发关联字段联动。

列表类写入走 `cheatWriteListValue`，回退走 `undoCheatModValue`。

## 5. 声明体系（防写穿）

- `keys.registry.json`：**425 条 varPath / 12 适配器**（`totals.entries` 口径；另有 `keysWithoutVarPath` 1 条只登记 key、无上游 varPath —— revelation 1），每条含 varPath、类型、门控语义；`tools/validate_adapters.js` 输出 **426 条**（与注册表差 1，口径差尚未查明，不当作结论）。
- varPath 分布（2026-11-12 撤下 Dolonline 后校准）：deadwood 140 / revelation 60 / cattery 47 / dolsims 41 / morefarm 37 / dolmod 31 / dolopt 22 / domrobin 14 / fert 14 / smartphone 8 / wraiths 8 / mli 3（合计 425）。
- 三类校验器：`check_claims.js`（结构自洽，425 条命中 0）、`check_key_types.js`（声明类型 vs 模组判据，278 条 / CONFLICT 0 / NO_EVIDENCE 53）、`check_coverage.js`（候选，仅人工参考）。
- **动态键盲区是已知口径**：`$featsBoosts.upgrades['deadwood-'+attr]`、`$plots.farm[$i].greenhouse` 这类拼接键静态扫不到，audit 会误报「声明缺失」，必须靠 `resolve_missing.js` 定案，KEEP 严禁删。

## 6. 渲染与性能

- 面板按页签注册表懒渲染：切到某页签才建该页 DOM（`09-exports.js` 的 `paneRenders`）。
- Mod 行分批：`05a-modcheat-rows.js` 首帧同步建 `MOD_ROW_BATCH=40` 行，超 `MOD_ROW_BATCH_LIMIT=60` 的剩余行用 `setTimeout(fn,0)` 逐帧排空，重建前 `clearTimeout`。
- 实测基线（本轮，moli 实机）：**外壳首帧同步渲染 1.2 ms / 27 节点**。注意这是**引擎未起时的空壳**指标（`State.passage` 为 null、`V` 仅 3 键），含内容的真实渲染未取到——moli 下 SugarCube 未启动，见第 7 节。

## 7. 实机链路（本轮 moli 实测，含两个旧口径的推翻）

- IDB 以 `scheme+host+port` 为键：**http origin 同样能导入 mod**，决定成败的是「与游戏同源」，不是页面自述的 `file://`。用 `game/mce-mod-import.html` 把包写进同一 origin 后，store 内出现 `modDataIndexDBZip:<文件名>` 若干键 + 一个列表键 `modDataIndexDBZipList`。
- **列表键才是加载目录，包键只是存储**：实测把框架包 blob 写进 store（388,498 B 在库）但列表键仍是 `["MapleBirchCE.mod.zip"]` 时，ModLoader 只认列表里的项——`IndexDBLoader load() list MapleBirchCE.mod.zip` 之后再无框架相关记录。判「包装上了没有」必须同时看 `modDataIndexDBZip:<名>` 键存在 **与** 列表键 JSON 里含该包名，只看 store 键数会得出错误结论。
- **依赖阻断的真实链路（2026-11-09 第二次实测，推翻上一轮「已装框架」的记录）**：
  1. `IndexDBLoader load() list MapleBirchCE.mod.zip` —— IDB 列表被读到；
  2. `error: DependenceChecker.checkFor() not found mod before MapleBirchCE` —— CE 声明依赖 `maplebirch>=5.4.2`，框架不在可用集合；
  3. 框架依赖的那批插件被 ModLoaderGui **SafeMode** 拦下：`canLoadThisMod() mod [TweeReplacer] be banned by [ModLoaderGui SafeMode]`，同批还有 `BeautySelectorAddon` / `ImageLoaderHook2BeautySelectorAddon` / `TweeReplacerLinker`；
  4. 结果：CE **完全未注入**——`#mce-style` / `#mce-toggle` / `#mce-root` 三件套全为 false，面板 0 节点，`inject start/end` 只覆盖内嵌的 ModLoaderGui / ConflictChecker / ModSubUiAngularJs。
- 因此上一轮记的「装框架后 `pluginCount 23 / injectCE true / 三件套齐 / 27 节点`」与本次可复现结果不一致：该轮框架包**没有进列表键**，三件套来源无法用当前证据链复现。本次结论以「列表 + 依赖检查 + SafeMode」三处日志为准。
- 未装框架时（含框架被 SafeMode 禁用时）：CE 完全不出现，玩家侧只看到一个没有金按钮的正常游戏，console 仅一行 `DependenceChecker.checkFor() not found mod before MapleBirchCE` → **真实产品风险 P1（静默无提示），不是测试环境噪音**。
- 装框架并真正加载后仍报 `TypeError: i.ctx.createGainNode is not a function`：该标识符在 CE 源码 **0 命中**，唯一来源是框架包 `dist/inject_early.js` 内 Howler 音效库的旧 API 兜底 → **框架侧问题，不计入 CE 缺陷**。
- **moli 的硬边界（两层，缺一不可）**：① ModLoaderGui 的 SafeMode 在 moli 新 profile 下会禁用框架依赖插件集，框架起不来；② 即使 mod 侧全部就绪，`typeof window.setup === "undefined"`、`State.passage === null`、`V` 仅 3 键——**SugarCube 引擎未进入剧情**。两层叠加意味着 `setup.mbStageCE` 在 moli 通道结构上不可验证，面板只能是空壳。
- 对应地，`real_smoke.ps1` 的 E 判据（在 `document.body.innerText` 找 `inject end`）与 F 判据（`typeof window.mbCE === "object"`）**都测错了对象**：前者日志走 console 捕获窗（`window.__logs`），后者该全局名在源码中不存在。两处已按本节证据改写：E 改读 `__logs` 命中数，F 改判 `setup.mbStageCE`，并新增 `mceDom`（三件套计数，区分「没注入」与「注入了但导出丢失」）、`depBlocked`、`idbListed`、`safeBanned` 四个诊断字段。

## 8. 门禁清单（改完必须全绿）

| 层 | 命令 | 判据 |
|---|---|---|
| 构建 | `node tools/build_js.js` | 产物生成 |
| 语法 | `node --check javascript/maplebirchce.js` | exit 0 |
| Lint | `npx eslint javascript/maplebirchce.js` | 10 条规则 0 error（含 no-redeclare / no-undef） |
| 纯函数单测 | `node tests/unit_core.js` | 全 PASS（01-core 中文映射/清单判定/数值读写，vm 直跑 src 片段） |
| 结构 | `node tools/check_structure.js` | 73 段 / ≤400 行 / 续号白名单 9 项 |
| 冒烟 | `node tests/smoke_dom.js` | 全 PASS |
| 回归 | `node tests/test_mce.js` | 全 PASS |
| 端到端 | `node tests/functional_e2e.js` | 全 PASS |
| 性别集成 | `node tests/integration_gender.js` | 全 PASS |
| 声明一致性 | `tools/validate_adapters.js` + `check_key_types.js` + `check_claims.js` | 无 CONFLICT / 无命中 |
| 覆盖率 | `npm run coverage:gate` | lines ≥90 / branches ≥80 / functions ≥95 |
| 打包 | `tools/pack.ps1` | verifier 4/4 + zip 正斜杠 + SHA256 |

## 9. 已知边界（别当缺陷报）

- `00-preamble.js` 是空壳，CodeGraph 索引里没有它的符号。
- jsdom 不做 CSS cascade：面板样式只能断言「规则文本存在」，不能断言渲染结果；视觉层要靠实机截图。
- 空 catch 共 206 处（精确口径 catch 447，46.1%），绝大多数是宿主探测/可选读，按「不改语义不加日志」原则保留。
- moli 单会话不能驱动引擎交互阶段：面板内容、真实渲染耗时必须在玩家环境或引擎已起的环境验证。
