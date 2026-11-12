# 场景覆盖差集复核 v2.0.22（2026-11-12）

回答两个问题：

1. 「凯拉尔那条剧情」（v2.0.20 只做了「一键获得被凯拉尔监视」）+「还有没有其他这样的剧情没收录进模组」
2. 「没有剧情的场景直达 / 我想去森林商店 / 但是都有剧情 / 我不知道为什么找不到商店」

**结论先行**：剧情条目**零遗漏**（本体真实 110 条，模组 111 键与注册表逐键相等，差异 0）；森林商店的「找不到」不是遗漏，是**分组归属错**，已在本版修正。

本文全部数字来自对本体的字符串级抽取与逐段核对，不取自任何二手摘要。复现脚本见文末。

---

## 一、剧情条目差集：本体 `$scenes` 注册表 vs 模组

### 1.1 抽取方法（可复现）

| 步 | 动作 |
|---|---|
| 1 | 定位 `Degrees of Lewdity.html` **第 279900 行** `\t\t<<set $scenes to {`，向下拼接到最近的 `</tw-passagedata>`（76,844 字符） |
| 2 | 反转义 Twee 实体（`&quot;` → `"` 等） |
| 3 | 做**字符串感知**的括号配对（跳过 `"` 内的 `{`/`}`，否则嵌套的 `passages` 数组会提前闭合） |
| 4 | 按 `"Key":{` 取顶层键 —— 冒号后**无空格**、缩进**三 Tab**。旧正则 `\n\t\t"Key"\s*:\s*\{` 因这两个细节必然 MISS |

> 第 280730 行的 `<<set _scenes to {}>>` 是局部变量（下划线前缀），与注册表无关，不得混入。

### 1.2 结果

| 口径 | 数量 |
|---|---|
| 注册表顶层键 | **111** |
| 其中 `placeHolder` | 1 条，被 `/* … */` 注释掉的模板样本（`name:""`、`startPassage:""`）→ 非真实场景 |
| **真实场景** | **110** |
| 模组 `VANILLA_SCENE_KEYS` | 111 键 |
| **逐键差集** | **差异 0**（模组全部命中，本体无多余） |

模组侧不存段落清单，运行时从 `Story` 动态解析 `$scenes` 定义（`07e-scenes.js` 的 `parseSceneBlocks` + `evalSceneExpr`），所以本体任何新增剧情会**自动出现**，不需要手工补表。

### 1.3 副产物修复

`parseSceneBlocks` 的键块扫描不剥 `/* */` 注释 → `placeHolder` 会被当成一条真场景塞进剧情列表（空名、空 startPassage，点了没反应）。
本版起丢弃 `name` 为空的定义（`07e-scenes.js`），UI 的原版区计数因此从 111 变为 **110**（与「真实场景」口径一致）。

### 1.4 「凯拉尔」这条是否已收录

- 本体注册表里的凯拉尔相关键（`Kylar*` / `HalloweenKylar` 等）全部在 111 键内 → 模组**已收录**，可在剧情页按角色分组看到。
- v2.0.20 额外补的 `KylarStalkingReversal`（`EXTRA_SCENES` 唯一一条）是**手工聚合线**，不在本体注册表里：它把「凯拉尔跟踪 → 发现 → 对峙」串成一条，`startPassage = Kylar Stalking Reversal Hide Confront`，15 段，手动变量 `<<set $location to 'town'>>`。本版过滤逻辑已加断言锁死「不误伤这条 EXTRA」。

---

## 二、地点元数据缺口（不是剧情遗漏）

注册表 111 键里，有 **10 条**在模组的 `SCENE_LOCATIONS`（100 条，`07f-pins1-data.js`）中**没有地点/时段元数据**：

| 键 | startPassage | 段内 `<<set $location>>` |
|---|---|---|
| `Tutorial` | `SV Tutorial` | 无 |
| `HalloweenWhitney` | `Scene Viewer passages` | 无 |
| `HalloweenKylar` | `Scene Viewer passages` | 无 |
| `AlexFarmSelfMilkingCaught` | `Farm Barn Caught` | 无 |
| `RobinCrossdressing4` | `Robin's Stand CD SV Intro` | 无 |
| `RobinCrossdressing5` | `Robin School CD SV Intro` | 无 |
| `EdenRadioIntro` | `Eden Radio Intro` | 无 |
| `Pinch` | `Olive Book 1` | 无 |
| `RaulAndJanet` | `ScarletBook1` | 无 |
| `PrisonScarredInmate` | `SV Prison Scarred` | 无 |

逐段实证：这 10 条的 startPassage **段内均无** `<<set $location>>` —— 它们是 SV（Scene Viewer）调试段或纯文本段，重放时沿用玩家当前 location。

**处置**：无证据不臆造，保持运行时回退（不写死地点）。缺的只是「地点标签」，不是「这条剧情进不了模组」。

---

## 三、SV 场景查看器体系：orphan 0

另一层核查：本体里全 **23 个** `SV ` 段落名，与注册表 1,252 条 `passages` 做差集 → **orphan 0 条**。

含义：SV 调试体系里没有「注册表之外还能重放」的剧情，本体的场景查看器与模组读的是同一份全集。

---

## 四、森林商店「找不到」的根因（本版修复）

### 4.1 取证

| 对象 | 事实 |
|---|---|
| passage `Forest Shop`（pid=1800） | `tags="exitCheckBypass"`，正文**仅 77 字符**：`<div id="clothingShop-div" class="main-shop-div">\n\t<<forestShop-main>>\n</div>` |
| `<<widget "forestShop-main">>` 首行 | `<<set $outside to 0>><<set $location to "forest_shop">><<effects>>`，随后 `$shopName="forest"`、`<<tryOnReset>>`、`$shopPage=0` → **段落自包含初始化，不依赖任何剧情进度** |
| passage `Forest Shop Entrance`（正门） | 9,259 字符，含 `_shopEvent`（Gwylan 登场判定）+ `$forest_shop_intro` → **这才是「都有剧情」的来源** |

### 4.2 三个叠加的失败点

1. **分组归属错**：旧 `gwylan_garden` 组 `main = Gwylan Ritual Start Garden`（仪式剧情段），`Forest Shop` 只作折叠子场景 → 面板上玩家永远先看到剧情段。
2. **`$tryOn` 缺失白屏**：widget 首段 `<<if $tryOn.autoReset isnot false>><<tryOnReset>><</if>>` —— 新档 `$tryOn` 不存在，读 `.autoReset` 抛 TypeError，整段正文不渲染。
3. **无出口**：尾部 `<<link [[Stop browsing clothes|Forest Shop Entrance]]>>` 只在 `<<elseif $tryOn.value is 0>>` 分支内 —— `$tryOn.value` 非 0 被判「试衣中」，一个可用链接都没有 → 触发 `mbCEArrivalCheck` 的 no usable links 回退。

### 4.3 修法

| 文件 | 改动 |
|---|---|
| `07d-places3.js` | 新增 `forest_shop` 组（`kind:"place"`、`main:"Forest Shop"`），`splice` 插到 `gwylan_garden` **之前**（`listPlaceGroups` 靠 `seen` 先占先得） |
| `07d-places4.js` | 新增 `mbCETryOnShell`：补原版 `<<tryOnInit>>` 同形轻量壳（`autoReset:true` / `value:0` / `showEquip` 三键 / `showUnderEquip` 两键），并补 `$location="forest_shop"`、`$outside=0`；**全部缺失才补** |
| `07d-places4.js` | `PLACE_EXTRA_ENTRIES.forest_shop = [{ name:"Forest Shop Entrance", cn:"正门（含格威岚登场）" }]` —— 要剧情时自选，不挡纯商店直达 |
| `07d-places.js` | `ensureSceneStateFor` 内调用 `mbCETryOnShell`（`mbCEEnsureEntryState` 之后、各地点分支之前） |
| `07d-places2.js` | 组名后加 `〔纯地点〕` 徽标（`kind==="place"`） |

**玩家侧结果**：地点页出现独立组「森林商店 · Gwylan Shop（纯商店）」，主按钮直达 `Forest Shop`（无剧情、不白屏、有出口）；折叠「更多入口（1）」里的正门按钮才走格威岚登场剧情。

---

## 五、验证

| 层 | 结果 |
|---|---|
| 新增断言 `tests/forest_shop_direct.js` | **29 PASS / 0 FAIL**（组序、主场景、子入口、widget 段排除、`$tryOn` 四态、`placeHolder` 过滤、EXTRA 不误伤） |
| 结构门禁 | 78 段，单段上限 400，豁免 0，续号白名单 11 → **通过** |
| `run_all.ps1` 12 步 | **ALL CHECKS PASSED**（含 tsc 0 错误、src strict 债务 0、键注册表 470 条一致） |
| 覆盖率 | lines 97.4% / branches 81.56% / functions 98.43%（门槛 90 / 80 / 95） |
| 打包 | 342,866 B / SHA256 `F6423E59D94526B7DB538E726FC914224D2F227C23F30A95F009C1FA85FF4820`；verifier exact 4/4 + 集合相等 + CRC 全量 |
| 装机 | `game\MapleBirchCE.mod.zip` 同 SHA；zip 内 `boot.json` version = `2.0.22` |
| 实机冒烟 `real_smoke.ps1` | A/B/C/D/E/G **PASS**，F **WARN**（moli 跑 `http://127.0.0.1` origin，与玩家 `file://` IndexedDB 不共享，CE 不在内置插件集 → 三件套 0/3，属工具局限） |

---

## 六、复现

```text
抽取注册表：%TEMP%\extract_scenes2.py  → %TEMP%\vanilla_scene_keys.json（111 键）
做差集：    %TEMP%\diff_scenes.py      → 输出 111 / 111 / 100、缺 11、幽灵 0
抽缺项字段：%TEMP%\probe_missing3.py   → 10 条键的 startPassage
SV 孤儿：   %TEMP%\probe_sv.py         → %TEMP%\sv_orphan.json（orphan 0）
森林商店：  本体 HTML 搜 name="Forest Shop" tags= / <<widget "forestShop-main">> / <<widget "tryOnInit">>
源码落点：  07d-places3.js（组）/ 07d-places4.js（补壳 + 子入口）/ 07d-places.js（调用）/ 07d-places2.js（徽标）
断言：      tests/forest_shop_direct.js（已登记进 tools/coverage_tests.js 序列）
```

## 七、仍未做（如实声明）

- `Forest Shop Entrance` 未提升为与主场景并列的主入口 —— 当前作为「更多入口」子按钮，是否并列未拍板。
- `VANILLA_SCENE_KEYS` 里的 `placeHolder` 键未从常量表移除（现仅 `isVanillaSceneKey` 标注用；defs 已过滤，功能无害）。
- 10 条缺地点元数据的键维持运行时回退，未强行推断地点。
