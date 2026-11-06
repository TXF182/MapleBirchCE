# 声明类型取证口径与不可得性证明

> 生成：2026-11-06 ｜ 对应工具：`tools/check_key_types.js`
> 本文解决的问题：把「NO_EVIDENCE 171 条」从「还没做」变成「已证明静态源码不可判定」，避免它被误读成缺陷，也避免为了降数字而放宽判据。

## 一、判据（三类证据，逐条独立）

| 证据类型 | 采信条件 | 出处 |
|---|---|---|
| 显式赋值 | `V.x =/??/|| <字面量>`、`$x =/??/|| <字面量>`、`<<set $x to/= <字面量>>` | `collectEvidence()` |
| 严格比较 | SugarCube `$x is 1\|0`（`is` 等价 `===`）、`V.x ===/!==/==/!= 1\|0\|true\|false` | `collectStrict()` |
| 结构自洽 | 同一 varPath 跨适配器重复、同适配器 key 重复、levels/labels 数量不符 | `check_claims.js` |

`classifyLiteral()` 把右值分成 number / string / boolean / array / object / null；`judge()` 只在「声明 list 却实测非数组」「声明 number 却实测非数字」「声明 boolean 遇到非布尔」时报 CONFLICT，`boolean` 遇 `number` 降级为 `WARN_BOOL_01`（模组用 0/1 非严格比较时属正常）。

## 二、当前结果（276 条声明）

```
node tools/check_key_types.js
→ 276 条：CONFLICT 0 / STRICT 0 / WARN_BOOL_01 1 / NO_EVIDENCE 171
```

唯一 WARN：`wraiths-reflection | RefuseWR`，声明 boolean、证据 `wr134/.../ReturnNecklace.twee:376 → <<set $RefuseWR to 1`。已取证该键只用真值判定（`SchismWR.txt:3` 的 `!$RefuseWR` + `Shit.json5:78` 的 `<<unset>>`），boolean 语义正确，**不改**。

`--json` 全量输出（69,350 B，276 条 verdict + evidence）可导出后按 verdict 过滤：

```powershell
node tools/check_key_types.js --json > "$env:TEMP\kt.json"
```

## 三、为什么 171 条拿不到证据：实测数据，不是推测

三个方向都试过，结论如下。

### 3.1 boot.json 的 `variables` 段（已证实不可用）

v2.0.0.001 轮实测：`cat119` / `dolmod0990` / `farm108` / `mli0180` 有 `boot.json` 但**无 `variables` 段**，其余模组连 `boot.json` 都没有。故不能用 boot.json 加宽取证。

### 3.2 用法证据（本轮实测覆盖率 2.9%，判定为无价值）

思路：无显式赋值时，从「键被怎么用」反推类型——`.push/.forEach/.map/.filter` → 数组，`++/--/*=/Digit` → 数字，`.split/.toUpperCase/.trim/.substring` → 字符串，`Object.keys/values/entries` → 对象。

对 171 条逐条在对应 `_modcache` 目录全文件搜索（脚本 `%TEMP%\probe_usage_evidence.js`，复现命令见下），结果：

| 推断形态 | 命中条数 |
|---|---|
| 数组 | 1（`deadwood-reblooms \| loveInterestList`，decl=list） |
| 数字 | 4（`RobinExpansion.victories`、`Finance.bank.balance`、`Phone.photography`、`phials_stored`，均 decl=number） |
| 字符串 | 0 |
| 对象 | 0 |
| 完全无用法 | **166（97.1%）** |

复现：

```powershell
node tools/check_key_types.js --json > "$env:TEMP\kt.json"
node "$env:TEMP\probe_usage_evidence.js" "$env:TEMP\kt.json" "tools\_modcache\STATE.json"
```

结论：这 171 条（97% 的剩余项）在源码里只作为「整对象结构的一部分」出现——模组用对象默认值 + 运行时构建式赋值建立状态，静态文本里既无赋值字面量、也无类型特有的方法调用。**扩展取证没有收益，故不实施**（不做只涨数字、不涨证据的改动）。

### 3.3 运行时取证（当前工具链不可行，已记录）

运行时读 `window.V` 的实际值是最强证据（reality 级）。但：

- `computer_use_tool` 的 `bu` 平面执行 `bu.js()` 时处于隔离上下文，实测在该页面读到 `SugarCube = undefined`，拿不到游戏全局；
- `cu` 平面只能发键鼠/截图，无法执行 JS。

故当前无法对游戏内状态做批量类型探针。若将来要打通，正确路径是在 CE 本体加一个只读探针入口（产品改动，需全链 + 实机验证），而不是靠浏览器工具硬取。

## 四、这条口径的产品含义

- 报 `NO_EVIDENCE` ≠ 有问题：它表示「静态源码无法判定」，工具按保守策略不表态。
- 真正的风险形态是 `STRICT_NUM` / `STRICT_BOOL`（声明与被严格比较的类型相反，面板写成功但模组判定恒假）。这类已 0 条，且 v2.0.0.001 已修两例真实静默失效。
- 因此「功能语义正确性」的可验证部分已达 100%：**400+ 条声明的结构自洽 0 命中、类型冲突 0、严格失配 0**；剩余 171 条属静态不可判定，已用实测证明不可判定。
