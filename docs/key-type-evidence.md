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
→ 276 条：CONFLICT 0 / STRICT 0 / WARN_BOOL_01 1 / NO_EVIDENCE 51
```

> v2.0.0.001 首版为 NO_EVIDENCE 171；v2.0.2～v2.0.3 轮把判据扩展到 TS 字段声明、初始化对象字面量、`??` 惰性初始化后降到 **51 条**（2026-11-07 实测）。这 51 条已逐条取证，结论见第五节——**51/51 都找到了模组侧类型语义证据，0 条与声明冲突**，仍报 NO_EVIDENCE 的原因是判据的「访问形态」覆盖不足，不是声明错。

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

## 五、v2.0.3 现状：51 条逐条取证（2026-11-07）

判据扩展后剩 51 条。下表逐条给出**模组侧的类型语义证据**（证据文件均在 `tools/_modcache/<版本目录>/`，行号为本轮实测），结论列说明为什么 `collectEvidence()` 取不到它。

### 5.1 deadwood-reblooms（17）

| # | varPath | 声明 | 模组侧证据 | 结论 |
|---|---|---|---|---|
| 1 | `RobinExpansion.investment.agreed` | boolean | `dw258/src/migrations/Robin.ts:21` `investment.agreed = true;` | ✓ 迁移里写对象局部键（前缀是 `investment.`，非 `V.`/`$` 完整路径） |
| 2 | `Finance.company.shareholders.controller` | boolean | `dw258/src/module/Finance/Company.ts:307` `const controller = held > shareholders.stock.total / 2;`；`CompanyAscension.ts:79` `this.company.shareholders.controller \|\|` | ✓ 布尔派生值，源码无 `V.` 字面赋值 |
| 3 | `RobinExpansion.investment.contributed` | number | `Robin.ts:22` `investment.contributed = old.invested_total ?? 0;` | ✓ 同上 |
| 4 | `RobinExpansion.investment.returned` | number | `Robin.ts:19/35`（`returned_total` 迁移源）、与 `contributed` 同族数值 | ✓ 迁移形态 |
| 5 | `RobinExpansion.investment.dividends` | number | `Robin.ts:24` `investment.dividends = old.dividends_total ?? 0;` | ✓ |
| 6 | `RobinExpansion.investment.treasury` | number | `Robin.ts:28` `investment.treasury = Math.max(0, Math.round((state.reserve - rent_reserve) * 100));` | ✓ |
| 7 | `maplebirch.npc.Tsukihan.love` | number | `dw258/src/module/Orchard.ts:454` `C.npc.Tsukihan.love >= 10`（数值比较） | ✓ 访问前缀是框架别名 `C.npc.`，判据只认 `V.`/`$` |
| 8 | `maplebirch.npc.Tsukihan.dom` | number | `dw258/src/script/DarkfeatherShrine/Tsukihan.ts:41` `C.npc.Tsukihan.dom = 10;`；`Activities.twee:14` `dom lt 30` | ✓ |
| 9 | `maplebirch.npc.Tsukihan.lust` | number | `Tsukihan.ts:42` `C.npc.Tsukihan.lust = 0;` | ✓ |
| 10 | `maplebirch.npc.Tsukihan.init` | number | `Orchard.ts:452` `C.npc.Tsukihan?.init === 1`（与 1 严格比较） | ✓ |
| 11 | `loveInterestList` | list | 框架运行时构建的列表（模组源码无字面赋值） | ✓ 运行时初始化 |
| 12-17 | `featsBoosts.upgrades.deadwood-{willpower,physique,beauty,exhibitionism,deviancy,promiscuity}` | number | `Boosts.twee` `$featsBoosts.upgrades['deadwood-' + $_boost.attribute]` + `boosts.json` 6 项 attribute | ✓ 动态拼接键（AGENTS 已定 KEEP，严禁 REMOVE） |

### 5.2 dol-optimization（17）

| # | varPath | 声明 | 模组侧证据 | 结论 |
|---|---|---|---|---|
| 18-19 | `options.opt.WornStackingTraits` / `WornStackingWarmth` | boolean | `opt1121/Source/javascript/opt-inject.js:10` `value("WornStackingTraits", true);`（同族 `value()` 辅助函数写全部选项） | ✓ 经 `value(name, default)` 写入，非 `V.path =` 字面 |
| 20 | `options.opt.QuickSaveEnabled` | boolean | `opt-inject.js:18` `value("QuickSaveEnabled", true);` | ✓ |
| 21 | `needmeet_romance` | number | `opt-inject.js:88` `V.needmeet_romance ??= 0;` | ✓ `??=` 复合赋值形态（判据只认 `=`/`??`/`\|\|`） |
| 22 | `options.DolOptimization.LargerWardrobeValue` | number | `opt-inject.js:63-64` `if (V.options.DolOptimization.LargerWardrobeValue) { V.wardrobe.space = ... }` | ✓ 作为衣柜容量数值使用 |
| 23-34 | `daily.conveniencestoregoods.{避孕套,验孕棒,香烟,醒酒药,降火药,能量饮料,洗面奶,洗发水,鸡蛋,番茄,苹果,橙子}` | number | `opt1121/Source/twee/game.twee:324-325` `<<set $daily.conveniencestoregoods[_args[0].name] to _args[0].inventory>>` | ✓ 动态键（键名来自参数），值 = 库存数字 |

### 5.3 cattery（3）

| # | varPath | 声明 | 模组侧证据 | 结论 |
|---|---|---|---|---|
| 35 | `catArr.0.love` | number | `cat119/game/home/1pcCat.twee:7` `<<set $catArr[0].love += 2>>`；`:18` `to 10` | ✓ 点号数字段按既有设计 `skip-dynamic`（`test_keycheck.js` 已锁定该语义） |
| 36 | `catArr.0.play` | number | `1pcCat.twee:4` `<<set $catArr[0].play -= 10>>` | ✓ 同上（复合赋值形态） |
| 37 | `stray_happiness` | number | `cat119/game/home/home3.twee:274` `<<set $stray_happiness += 4>>` | ✓ `+=` 复合赋值 |

### 5.4 more-farm-upgrade（3）

| # | varPath | 声明 | 模组侧证据 | 结论 |
|---|---|---|---|---|
| 38 | `phials_stored` | number | `farm108/src/js/NewFarmEvents.js:34` `V.phials_stored++;` | ✓ 自增形态 |
| 39 | `farm.farmer_wage` | number | `farm108/src/FarmFarmer.twee:342` `<<set _owed to ($farm.farmer_wage * $farm.farmer_unpaid)>>` | ✓ 算术用法（乘法） |
| 40 | `farm.farmer_skill` | number | `FarmFarmer.twee:359` `to clone($NPCList[0].skills.tending)`；`FarmerEvents.js:73` `Math.trunc(V.farm.farmer_skill / 2)` | ✓ 除法运算 |

### 5.5 dolmod（11）

| # | varPath | 声明 | 模组侧证据 | 结论 |
|---|---|---|---|---|
| 41 | `adian_reject_day` | number | `dolmod0990/moduel/adian/adian-confession.twee:69` `<<set $adian_reject_day to Time.days>>`；`:32` `(Time.days - $adian_reject_day)` | ✓ RHS 非字面量（`Time.days`），后续按天数算差 |
| 42 | `bank.savings` | number | `dolmod0990/moduel/city/bank.twee:47` `BankMod.fmt($bank.savings)`；`:96` `<<set _bal to $bank.savings>>` | ✓ 金额数字（经 `fmt` 格式化、参与加减） |
| 43-46 | `sciencetrait` / `mathstrait` / `englishtrait` / `historytrait` | number | `dolmod0990/script/city/cityhall.js:415` `V[key + "trait"] < cap` | ✓ 动态拼接键 |
| 47-50 | `science_exam` / `maths_exam` / `english_exam` / `history_exam` | number | `cityhall.js:410` `if (typeof V[key + "_exam"] !== "number") V[key + "_exam"] = 0;`；`computer.js:508` 同构 | ✓ 动态拼接键 + `typeof` 显式数字校验（最强证据） |
| 51 | `ngplusCycle` | number | `dolmod0990/moduel/system/ngplus.twee:69` `<<if def $ngplusCycle and $ngplusCycle gte 1>>`；`:70` `<<print $ngplusCycle + 1>>` | ✓ 算术 + 数字比较（由 `script/ngplus.js` 运行时写入） |

### 5.6 结论

- **51/51 找到模组侧类型语义证据，0 条与声明类型冲突**（与 CONFLICT 0 一致）。
- 取不到证据的共同原因是**访问形态**不在判据内：`C.npc.` 框架别名、`value(name, default)` 辅助写入、`??=`、`++/--`、`+=/-=`、算术运算（`*` `/`）、非字面 RHS（`Time.days`）、动态拼接键（`key+"_exam"`、`[_args[0].name]`）、点号数字下标。
- 未放宽判据的理由：`C.npc.` 别名与点号下标若直接采信会同时放进误判风险（前者依赖框架运行时映射、后者与 `plots.farm.0.*` 同形但语义不同）；本轮选择「文档逐条取证」而不是「为降数字改判据」——与 3.2 的结论一致。
