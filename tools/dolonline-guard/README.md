# DoLOnline Guard — 地下城作弊残留拦截

给「DoL 联机&地下城（DoLOnline）」用的旁加载补丁包，专门拦截**旧版 MapleBirchCE
dolonline 适配器**写进存档的作弊值，避免玩家凭作弊数值进入联机交易 / 地下城进度。

## 为什么需要它

Dolonline 具备联机交易与跨世界市场，作弊值会影响其他玩家公平性。
MapleBirchCE 曾提供过 dolonline 适配器（已在 v2.1.0 撤除），但**旧版 CE 写入的
存档键不会因为撤除适配器而消失**，仍会让 `dgUnlocked()` 判定为已解锁。

## 判据（全部来自源码实证，不做启发式猜测）

> 判据 v1.1.0（2026-11-12 逐键回归源码后重订）。v1.0.0 的 F3 带了恒真条件、
> F4 建在死键上会误伤合法玩家，已修正。

| 编号 | 判据 | 源码依据 | 处理 |
|---|---|---|---|
| F1 | `$mbCE_wrote` 中 `modId === "dolonline"` 的留痕 | CE `04b-modcheat-write.js` L141-142 无条件留痕 | 按 `before` 快照精确还原（等同 CE 自带 undo 语义） |
| F2 | `$dgInv` 的 18 个物品键**全部恰好 99**，**且 `$mpDgLv` 仍为 1** | 旧适配器 `dl_fill_inv` 写死 99；模组 `dgAdd`(index.js:9010) 是 `inv[item] += n`，**无上限 clamp**，长期玩家可合法堆到 99 —— 故必须加等级佐证：等级 1 却有 18 样同时精确 99，而物资只在层内掉落、掉落伴随经验 | 18 键归 0 |
| F3 | `$dgGold === 9999` | 旧适配器 `dl_refill_run` 写死 9999；模组**全库 `dgGold` 唯一写入是「进本置 0」**(index.js:9523)，合法态恒为 0 | `dgGold` 归 0 |
| F4 | `$mpSkill` 的 **9 个法术键全部为 1**，**且 `$mpDgLv < 12`** | 旧适配器 `dl_all_spells` 一次把 9 键全置 1 且不扣点。合法达到「9 键全 1」需 `mpDgLv >= 12`（`auto: 3/5/7/9/12` 五个节点全白送）再花 14 点买 4 个无 auto 节点；等级不足 12 时要额外花 14 点买 auto 节点，合计 28 点 | 删除 9 键，并按各节点 `cost` **退回点数**（只退未被等级白送的），误伤可逆 |

判据常量（与 `index.js` 对齐）：法术 cost 为
`fireWall:2 iceSpike:2 shadowBolt:3 thunderStorm:3 meteor:4 uBurst:4 uChain:4 uDesp:3 uBlood:3`，合计 28；
`auto` 白送等级为 `fireWall:3 iceSpike:5 shadowBolt:7 thunderStorm:9 meteor:12`。

## 有意不做的判定（避免误伤）

- **不**把 `$mpDgUnlocked === 1` 单独判为作弊：模组自带管理员 `[data-cheat=unlock]`
  按钮（`index.js:1454-1455`）只写这一个键，形态与 CE 相同。
- **不**用 `exp / lv` 一致性判定：`gainExp` 是扣减制，0 经验本身合法。
- **不**用 `$dgKills` / `$dgFloor` 作判据或豁免条件：5.34 全库**不写**这两个键
  （`dgKills` 只在 `dgUnlocked()` 的「老存档兼容」分支 L5662 被读；`dgFloor` 只有
  初始化 L9522 和模组管理员按钮 L1455/L1460 写），读到的是默认值，判据会恒真。
- **不**用 `$mpSkillPts` 余额作 F4 豁免：CE 不写 pts，作弊者余额可任意；而合法玩家
  花光点后余额同样是 0，两者不可区分。
- **不**按「某个节点越过 `auto` 等级」判：`index.js:8835` 在 `autoOn === false` 时
  仍渲染「解锁」按钮，玩家可以花点提前买该节点，不是严格矛盾。
- **不**动原版变量：留痕 `path` 必须落在 `mp*` / `dg*` / `npcAff` 命名空间内，否则跳过。

## 巡检时机

1. 游戏就绪后立即一次；
2. 每次 passage 切换（`:passagestart`）；
3. 30 秒定时兜底（覆盖 CE 面板中途写入后玩家直接进本的情况）。

## 回退可追溯

`$dolguard_log`（最近 20 条）记录每次回退的规则 / 路径 / 原值 / 新值，
`$dolguard_count` 累计次数。控制台会打印 `[DoLOnlineGuard] 已回退 N 项作弊残留`。

手动审计（只读，不改存档）：

```js
window.DoLOnlineGuard.audit(State.variables)
```

## 覆盖边界（如实声明）

- F1 依赖 CE 的留痕。CE 留痕有界化规则：条目数 > 400 时按时间戳删最旧一半
  （`01b-wrote-trim.js` L8）。**若某次写入的留痕已被裁剪，F1 不再命中**；
  此时仅剩 F2/F3/F4 三道形态判据，它们只覆盖旧适配器的 3 个批量动作，
  不覆盖逐项数值写入（等级、经验、攻防等）。
- **F2/F3 的置信度高于 F4**：F3 是严格矛盾（`dgGold` 合法恒 0）；F2 在加了
  「等级仍为 1」佐证后也近乎严格矛盾。F4 是**高置信度指纹而非严格矛盾**——
  理论上存在「等级 < 12 却攒够 28 点并买了全部 9 个法术」的合法路径，
  因此 F4 删除时按 `cost` 退回点数，使误伤可逆（玩家可重新购买）。
- F4 只按「9 键全 1」整组判，不做逐键判。逐键判会误伤「花点提前买 auto 节点」
  的合法玩家（`index.js:8835` 允许 `autoOn === false` 时仍显示解锁按钮）。
- 本包不改变模组自身的联机/交易逻辑，也不拦截模组管理员面板（`canCheat()`）的写入。

## 安装

游戏内按 `Alt+M` → 「添加/移除Mod」→ 选 `DoLOnline-Guard.mod.zip` → 「添加旁加载Mod」→ 刷新页面。

也可用 `game\mce-mod-import.html` 导入到 IndexedDB（与其它 mod 同一通道）。
