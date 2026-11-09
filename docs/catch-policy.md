# 空 catch 处置口径（v2.0.12）

## 背景

全仓 `javascript/src` 共 **206 处**行内空 catch（`catch (e) {}` / `catch (e2) {}` 形态，2026-11-09 全量统计）。

它们不是同一种东西：一部分是**能力嗅探降级**（失败即走降级分支，属设计意图），另一部分是**状态写入失败**（失败会让玩家看到的面板状态与实际存档不一致）。把它们一律"加日志"，等于在一个本来就靠静默降级跑通的系统里灌噪声——缺框架、缺模组、未读档这些**正常场景**都会触发嗅探失败，错误池会被挤满，真正的写入失败反而被埋掉。

## 分级判据

| 级 | 判据 | 处置 |
|---|---|---|
| A | catch 包住**存档写入 / 留痕 / 回退 / 持久化**；失败后玩家状态与面板显示会不一致 | 必须接错误池 `mbCECatch(where, e)` |
| B | catch 包住 **DOM 渲染 / 局部刷新**；失败只是局部空白或样式缺失，不碰存档 | 接池（便于定位 UI 缺项），优先级低于 A |
| C | 能力嗅探（`typeof X === "function"`、`window.Y && ...`）与预期内降级 | **保持静默**，接入只会刷屏 |

判断只看一件事：**这个 catch 吞掉的错误，会不会让玩家以为某件事成功/存在，而实际没有。** 会 → A/B；不会 → C。

## 错误池

实现在 `01-core.js`：`mbCECatch(where, e)` / `mbCEErrPoolDump()`。

- 只进内存，**不进存档**（不污染存档体积、不参与写入留痕、不参与 `mbCE_wrote` 裁剪）；
- 上限 48 条，环形丢弃最旧；
- 同时挂 `window.__mceErrPool`，实机探针（moli）可直接读，不必进 passage 开面板；
- 记录器自身失败静默（`catch (eIgnored) {}`），避免级联成二次错误。

读取方式：

```js
window.__mceErrPool        // [{where, msg, t}, ...]
mbCEErrPoolDump()          // 返回副本，不暴露内部数组
```

## 本轮已接入（3 处，均为 A 类）

| 位置 | `where` | 为什么是 A 类 |
|---|---|---|
| `01-core.js` `mbCEWroteTrim` | `mbCEWroteTrim` | 留痕裁剪失败 → 留痕超限不清或清理后状态不一致，直接削弱「回退」能力；静默时玩家点回退"没反应"且无任何解释 |
| `03c-global-combat.js` 森林商店批量解锁 | `combat:forestClothesUnlock` | 批量写 `$specialClothes` 失败 → 面板显示已解锁、存档里没写进去（典型"显示成功、实机无效"） |
| `07d-places2.js` 地点行渲染 | `places2:rowRender` | 单行渲染异常被吞后仍执行 `block.appendChild(row)` → 地点页少一行，玩家误以为该地点无作弊项 |

## 未接入与理由

- **探测类（C）**：`getV()` / `getSetup()` / 各种 `typeof` 嗅探。缺引擎、缺框架、缺模组时它们必然失败且属正常，接入会刷满错误池。
- **其余 A/B 类候选**：**尚未逐处评估**。本文件不宣称"206 处已全部定级"——只给出判据与已接入的 3 处。逐处定级是独立工作轮（见"未完成项"）。

## 复查命令

```powershell
cd C:\Users\27352\Doubao\chats\2026-10-13\new-chat-2\MapleBirchCE

# 1) 全仓行内空 catch 计数
Select-String -Path javascript\src\*.js -Pattern 'catch\s*\([^)]*\)\s*\{\s*\}' | Measure-Object

# 2) 已接入错误池的位置（应恰为 3 处 + 1 处记录器自身）
Select-String -Path javascript\src\*.js -Pattern 'mbCECatch\('
```

## 未完成项（明确记录，不掩盖）

1. 206 处 → 逐处 A/B/C 定级（当前仅 3 处 A 类接入）。
2. B 类（UI 渲染层）系统性接池。
3. 错误池的面板可视入口（当前只有 `window.__mceErrPool` 与函数出口，面板内无展示）。
