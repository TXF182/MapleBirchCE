# DoLOnline 反作弊守卫（内置版）v1.0.0

> 给模组作者的源码级补丁：让外部作弊器无法再改写本模组的关键状态。
> **这是实时阻断，不是事后清理。**

## 一句话原理

作弊器（如 MapleBirchCE 的旧版 `dolonline` 适配器）写入存档时，最终执行的是**普通赋值**：

```js
r.parent[r.leaf] = val;      // 04b-modcheat-write.js:140
```

本补丁把这些状态的属性换成「getter + 受控 setter」。setter 在**非模组写入窗口**里主动抛 `TypeError`，作弊器的 `try/catch` 接住后，面板显示「操作异常」，**值不会落进存档**。

实测确认：拦截强度与作弊器是否开启严格模式**无关**——是守卫主动抛，不是靠"严格模式才报错"那套机制。

## 接入方式

### 方案 A（推荐，拦得住全部）

**最省事的路：跑一次补丁脚本，产出单文件直接替换。**

```bash
node patch_index.js <你的 index.js> index.patched.js
```

脚本做三件事：按行号把 26 处写入点换成 `DGAC.set` / `DGAC.write`（任何一条失配立即报错退出，不静默）、把守卫内联到产物顶部、`node --check` 校验语法。
产物 `index.patched.js` 直接当你的新 `index.js` 用即可。

手工接入的话：

1. 把 `dgac_inline.js` 放进包里，作为 `scriptFileList` 的一项（或直接粘到 `index.js` 最前面）。
2. 在模组启动处（`init` 或首个 `:passageinit`）调用 `DGAC.start()`。
3. **按下面第 3 节把 26 个写入点改掉。** 这一步不能省——守卫需要知道"这次写入是模组自己发的"，唯一可靠的办法是模组走白名单窗口。

> **为什么不能省**：模组的写入函数自带 `try { ... } catch (e) {}`（例如 `dgAdd` L7608-7612）。
> 如果某处写入没接白名单，守卫抛的错会被这段 catch 吞掉——不崩、不报错，**功能静默失效**。
> 已用真实片段验证过这一点（`tests/test_patched_integration.js`），别跳过。

### 方案 B（改动为零，但只能拦"不可能值"）

只在启动处调用 `DGAC.start()`，然后 `DGAC.setStrict(false)`。

- 能拦：`dgGold` 非 0、`dgInv` > 99 或负数、`mpDgLv` 越界、负数技能点。
- **拦不住**：恰好写成合法上限的值（例如 18 种物资各写成 99、法术全开成 1）。
- 适合"先上线观察、下一版再改造写入点"。

## 需要改的写入点（逐行，行号取自 5.34 源码 `index.js`）

统一约定：**凡是写 `dgGold` / `dgInv` / `mpSkill` / `mpSkillPts` / `mpDgLv` / `dgFloor` 的地方，都要进白名单窗口。**

| # | 行 | 原写法 | 改成 |
|---|---|---|---|
| 1 | L7604 | `if (!v.dgInv \|\| typeof v.dgInv !== 'object') v.dgInv = {};` | `DGAC.write(function () { if (!v.dgInv \|\| typeof v.dgInv !== 'object') v.dgInv = {}; });` |
| 2 | L7610 | `inv[item] = (Number(inv[item]) \|\| 0) + (Number(n) \|\| 1);` | `DGAC.set(inv, item, (Number(inv[item]) \|\| 0) + (Number(n) \|\| 1));` |
| 3 | L7689 | `inv[invKey] = Number(inv[invKey]) - 1;` | `DGAC.set(inv, invKey, Number(inv[invKey]) - 1);` |
| 4 | L7713 | `for (var k2 in r.mats) inv[k2] = Number(inv[k2]) - r.mats[k2];` | `for (var k2 in r.mats) DGAC.set(inv, k2, Number(inv[k2]) - r.mats[k2]);` |
| 5 | L1448 | `v.mpSkillPts = (Number(v.mpSkillPts) \|\| 0) + 3;` | `DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) \|\| 0) + 3);` |
| 6 | L3087 | `v.mpSkillPts = (Number(v.mpSkillPts) \|\| 0) + 1;` | `DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) \|\| 0) + 1);` |
| 7 | L3088 | `v.mpSkillPts = (Number(v.mpSkillPts) \|\| 0) + 1;` | 同上 |
| 8 | L3891 | `v.mpSkillPts = (Number(v.mpSkillPts) \|\| 0) + n;` | `DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) \|\| 0) + n);` |
| 9 | L8849 | `v.mpSkillPts = skillPts() - cost;` | `DGAC.set(v, 'mpSkillPts', skillPts() - cost);` |
| 10 | L8873 | `v.mpSkillPts = (Number(v.mpSkillPts) \|\| 0) + refund;` | `DGAC.set(v, 'mpSkillPts', (Number(v.mpSkillPts) \|\| 0) + refund);` |
| 11 | L8807 | `if (!v.mpSkill) v.mpSkill = {};` | `DGAC.write(function () { if (!v.mpSkill) v.mpSkill = {}; });` |
| 12 | L8869 | `v.mpSkill = {};` | `DGAC.write(function () { v.mpSkill = {}; });` |
| 13 | L8828 | `if (autoOn && lv < 1) { v.mpSkill[nd.k] = 1; lv = 1; }` | `if (autoOn && lv < 1) { DGAC.set(v.mpSkill, nd.k, 1); lv = 1; }` |
| 14 | L8871 | `if (nd.auto && dgLv2 >= nd.auto) v.mpSkill[nd.k] = 1;` | `if (nd.auto && dgLv2 >= nd.auto) DGAC.set(v.mpSkill, nd.k, 1);` |
| 15 | L8848 | `v.mpSkill[k] = lv + 1;` | `DGAC.set(v.mpSkill, k, lv + 1);` |
| 16 | L1455 | `v.mpDgUnlocked = 1; v.dgFloor = (Number(v.dgFloor) \|\| 1);` | `DGAC.write(function () { v.mpDgUnlocked = 1; v.dgFloor = (Number(v.dgFloor) \|\| 1); });` |
| 17 | L1460 | `v.dgFloor = (Number(v.dgFloor) \|\| 1) + 1;` | `DGAC.set(v, 'dgFloor', (Number(v.dgFloor) \|\| 1) + 1);` |
| 18 | L5953/5961 | `v[lvKey] = 1` / `v[expKey] = Number(v[expKey]) + add;` / `v[lvKey] += 1;` / `v[spKey] = ... + 1;` | 整段 `while` 循环用 `DGAC.write(function () { ... })` 包住 |
| 19 | L9520 | `v.mpDLv = 1; v.mpDgLv = 1;` | `DGAC.write(function () { v.mpDLv = 1; v.mpDgLv = 1; });` |
| 20 | L9522 | `v.dgFloor = 1; v.dgHp = null; ...` | `DGAC.write(function () { v.dgFloor = 1; v.dgHp = null; ... });` |
| 21 | L9523 | `v.dgMana = ...; v.dgGold = 0;` | `DGAC.write(function () { v.dgMana = ...; v.dgGold = 0; });` |

> 注意 L8849 的 `skillPts()` 会读 `v.mpSkillPts`，用 `DGAC.set` 时读的是旧值，语义与原写法一致。

## 存档加载与重装

SugarCube 载入存档时会整体替换 `State.variables`，旧的守卫随旧对象一起失效。`DGAC.start()` 已经内置了：

- 每 500ms 重试，直到 `VV()` 可用（最多 60 次）；
- 挂 `:passageinit`，每次换页 `boot()` + `audit()`；
- 30 秒定时巡检。

如果你在别处替换了 `State.variables`，手动调一次 `DGAC.rearm()` 即可。

## 边界（如实声明）

1. **只保护本模组的单机状态键**（`dgGold` / `dgInv` / `mpSkill` / `mpSkillPts` / `mpDgLv` / `dgFloor`）。其他键不设防。
2. **不防"合法值作弊"**：`audit()` 只能拦不可能值（金币 9999、物资 > 99、负点数）。把物资写成恰好 99 属于合法上限，自检无权清——这类只能靠方案 A 的实时阻断挡。
3. **不管玩家直接改存档文件**。那是另一层问题（服务端校验才治本）。
4. **不覆盖你自己的 `canCheat()` 管理员面板**——它走的是你写的代码路径，只要按第 3 节接好白名单，管理员功能照常用。
5. **老运行环境无 `Proxy` 时降级**：`dgInv` / `mpSkill` 只能防整体替换，逐键写入不设防（`ARM` 会记录，但拦不住）。Android WebView 5.0+ 都有 `Proxy`，实际极少触发。

## 自测

解压后在**本目录**直接跑（路径已改成包内相对路径，不用改任何东西）：

```bash
node tests/test_dgac_inline.js                    # 33 条：守卫本身
node tests/test_patched_integration.js            # 15 条：默认拿包内 index.patched.js 验
node tests/test_patched_integration.js <你的产物>   # 15 条：验你自己打出来的
```

**第一层**（33 条）覆盖：复刻 CE 的真实写入路径（`cheatResolvePath` + `r.parent[r.leaf] = val`）被拦、模组自身写入不误伤、存档序列化不被 Proxy 破坏、历史坏档自检、幂等重装。其中 `【1】1.1` 是**反证**：不装守卫时 CE 能写进去——证明测试复现的是真实写入路径，不是自说自话。

**第二层**（15 条）从**打过补丁的真实源码**里切出 `ensureDgInv` + `dgAdd` 原函数跑：确认守卫装上后 `dgAdd` 仍能正常加物资（不静默失效），同时 CE 的写入被挡。另有：

- 三条补丁完整性扫描：模组本体里不再残留 `v.dgGold =` / `v.mpSkillPts =` / `inv[...] =` 的裸写入
- 四条**内联段可跑性**：把产物里的守卫段抽出来，在模拟的 `window.State.variables` 环境里完整执行，确认 `window.DGAC` 挂上、走存档回退路径也能拦住写入、`DGAC.start()` 在缺 jQuery 的环境里不抛（守卫自身失败绝不影响模组本体）

## 目录内容

```
DoLOnline-DGAC-Inline-v1.0.0/
├─ 快速上手.txt        一页纸，先看这个
├─ 使用说明.md          本文件
├─ dgac_inline.js      守卫本体（8,987 B）
├─ patch_index.js      一键补丁脚本（26 条规则）
├─ index.patched.js    仅 5.34 的参考成品（759,399 B）
└─ tests/
   ├─ test_dgac_inline.js          33 条，守卫本身
   └─ test_patched_integration.js  15 条，真实源码片段 + 内联段可跑
```

> **警告：不要拿 `index.patched.js` 覆盖你自己版本的 `index.js`。**
> 它是基于 **5.34** 源码生成的，只用来给你对照"改完长什么样"。
> 你的版本若不是 5.34，直接覆盖会丢掉你自己的改动。
> 正确做法：**对你的 index.js 跑一次 `patch_index.js`**。

解压后在本目录直接跑：

```bash
node tests/test_dgac_inline.js                    # 33 条，验守卫本身
node tests/test_patched_integration.js            # 15 条，默认用包内 index.patched.js
node tests/test_patched_integration.js <你的产物>   # 15 条，验你自己打出来的产物
```

两条使用常识：

- **脚本是幂等安全的**：已经打过补丁的文件再跑一次，26 条规则会全部失配并报错退出（因为原文已变），不会重复包裹、不会产生半截产物。
- **换版本后行号会漂移**：脚本会一次性列出全部失配项，照"期望"那一列原文重新定位行号即可，不必重新推导机制。
