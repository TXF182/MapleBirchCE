# 消费端模组包清单（风险敞口台账）

> 采集时间：2026-11-06 ｜ 采集方式：`Get-ChildItem game\*.zip,*.modpack` + 逐个打开 zip 读 `boot.json`
> 采集对象：`C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project\game`
> 补装轮：2026-11-06 追加枯木逢春 v2.5.8 三个附属包（audio / fem-goose / mysterious），包数 15 → 18。
> 补装轮 2（2026-11-07）：追加 `FertilityExpansion-v1.7.0-Visual.mod.zip`（36,247,181 B，SHA256 `89E01574…290C` 与 GitHub asset digest 一致），包数 18 → 19；同一轮 `MapleBirchCE.mod.zip` 由 v2.0.0.001（250,989 B）更新为 v2.0.3（326,544 B / `86B531D7…475C`）。
> 校准轮（2026-11-08）：按 `Get-ChildItem` 实测补录此前台账遗漏的两个 `decorations` 素材包（地点图包 1.7.2 / 前景背景 5.12），包数 19 → **21**；`MapleBirchCE.mod.zip` 更新为 **v2.0.8**（286,204 B / SHA256 `015C0DE59F6A0127806B1C9A4F4D0FC19746C40CC185C191B83497100C7D3F92`）。同轮重跑 `mce-e2e\idb_audit.ps1`，IDB 三档改为 **已装载 9 / 无法确证 9 / 确定未装载 3**（leveldb 已由 3.9 MB 增长到 7.07 MB，判据随之变化）。
> 用途：把「装了哪些包、哪些包有已知风险、哪些适配器没有对应包」写成可核对台账，替代靠记忆判断。

## 一、game 内 21 个包（实测字节数，2026-11-08 复核）

| # | 包名 | 字节 | boot.json version | 对应适配器 | 状态 |
|---|---|---|---|---|---|
| 1 | `1_Cattery-1.1.9-fixed-icons.1.zip` | 893,436 | 1.1.9 | `cattery` | 正式版 |
| 2 | `deadwood-reblooms-0.5.12.13-v2.5.8.modpack` | 3,966,280 | 无 boot.json | `deadwood-reblooms` | 正式版 v2.5.8 |
| 3 | `Dol-Optimization-v1.1.2.1.mod.zip` | 8,537,423 | 1.1.2.1 | `dol-optimization` | 正式版 |
| 4 | `DolMod-0.1.990.mod.zip` | 803,610 | 0.1.990 | `dolmod` | **测试版 tag `1.9.9测试`** |
| 5 | `DoLSims.mod.zip` | 1,015,049 | 0.8.1.7 | `dolsims` | 正式版 |
| 6 | `DomRobin.mod.zip` | 7,155,903 | 0.0.8-for-dol-0.5.12.13 | `dom_robin` | 正式版 |
| 7 | `GameOriginalImagePack.mod.zip` | 52,984,102 | 1.100.0 | —（素材包） | 正式版 |
| 8 | `maplebirch-0.5.12.13-v5.6.2.mod.zip` | 388,498 | 5.6.2 | `maplebirch-framework`（declOverride） | 正式版 |
| 9 | `MapleBirchCE.mod.zip` | 286,204 | 2.0.8 | —（本 mod） | 产物，与仓库同字节（`015C0DE5…7D3F92`） |
| 10 | `ModI18N-0.5.12.13-chs-1.0.1a.mod.zip` | 13,917,526 | 1.0.1a | —（汉化） | 正式版 |
| 11 | `More.Love.Interests.Mod.mod.zip` | 10,534 | 0.1.8.0 | `more_love_interests` | 正式版 |
| 12 | `MoreFarmUpgrade.mod.1.08.zip` | 41,309 | 1.0.8 | `more-farm-upgrade` | 正式版 |
| 13 | `revelation-the-book-of-return-v1.4.6.modpack` | 750,920 | 无 boot.json | `revelation-the-book-of-return` | 正式版 v1.4.6 |
| 14 | `SmartPhone.Alpha-v0.3.91.1.mod.zip` | 3,791,189 | 0.3.91.1 | `smartphone` | 正式版 |
| 15 | `Wraith.sReflection.mod.zip` | 62,155 | 1.3.4 | `wraiths-reflection` | 正式版 |
| 16 | `deadwood-reblooms-audio-0.5.12.13-v2.5.8.modpack` | 33,192,776 | 无 boot.json | `deadwood-reblooms`（附属） | 正式版 v2.5.8 语音素材包 |
| 17 | `deadwood-reblooms-fem-goose-0.5.12.13-v2.5.8.modpack` | 258,632 | 无 boot.json | `deadwood-reblooms`（附属） | 正式版 v2.5.8 内容扩展 |
| 18 | `deadwood-reblooms-mysterious-0.5.12.13-v2.5.8.modpack` | 222,152 | 无 boot.json | `deadwood-reblooms`（附属） | 正式版 v2.5.8 内容扩展 |
| 19 | `FertilityExpansion-v1.7.0-Visual.mod.zip` | 36,247,181 | 1.7.0 | `fertility-expansion` | 正式版 v1.7.0 视觉包（81 条目，SHA256 与官方 digest 一致） |
| 20 | `decorations前景背景5.12.zip` | 23,958 | 5.12 | —（素材包，`前景背景模组`） | 正式版（2026-11-08 补录台账） |
| 21 | `decorations地點圖包.zip` | 7,823,189 | 1.7.2 | —（素材包，`前景背景模组-地點圖包`） | 正式版（2026-11-08 补录台账） |

**IDB 装载实况（2026-11-08 `mce-e2e\idb_audit.ps1` 实测，21 包）**：已装载(blob) **9** / 明文在库 0 / 确定未装载 **3** / 无法确证 **9**；采样口径 blob 172 文件 / 299,234,547 B，leveldb 8 文件 / **7,065,793 B**。确定未装载的是 `deadwood-reblooms-audio`（33,192,776）、`FertilityExpansion-v1.7.0-Visual`（36,247,181）、`GameOriginalImagePack`（52,984,102）——base64 形态所需空间均超过整个 leveldb，物理上不可能在库；复制进 `game\` 不等于装载，须走 `game\mce-mod-import.html` 导入 IndexedDB 后才生效。**`MapleBirchCE.mod.zip`（286,204 B）本次落在「无法确证」档**：blob 中未见 +286～+30 B 的体积匹配文件，但 leveldb 装得下其 base64 形态，因此既不能判「已装载 v2.0.8」，也不能判「IDB 里一定是旧版」——要定论须在 `file://` 页面读列表键。

## 二、适配器覆盖对照（12/12 全部有对应包）

| 适配器 modId | 对应包 | 覆盖 |
|---|---|---|
| `cattery` | 1_Cattery-1.1.9 | ✓ |
| `deadwood-reblooms` | deadwood…v2.5.8.modpack | ✓ |
| `dol-optimization` | Dol-Optimization-v1.1.2.1 | ✓ |
| `dolmod` | DolMod-0.1.990 | ✓（测试版，见风险 R2） |
| `dolsims` | DoLSims.mod.zip | ✓ |
| `dom_robin` | DomRobin.mod.zip | ✓ |
| `fertility-expansion` | FertilityExpansion-v1.7.0-Visual.mod.zip | ✓（2026-11-07 补装） |
| `more_love_interests` | More.Love.Interests.Mod | ✓ |
| `more-farm-upgrade` | MoreFarmUpgrade.mod.1.08 | ✓ |
| `revelation-the-book-of-return` | revelation…v1.4.6.modpack | ✓ |
| `smartphone` | SmartPhone.Alpha-v0.3.91.1 | ✓ |
| `wraiths-reflection` | Wraith.sReflection.mod | ✓ |

结论：12 个适配器全部有实机宿主，不存在「适配器有声明、game 里没装包」的悬空项。

## 三、实测口径的两个纠正（避免误读）

1. **16 个 zip 的 `boot.json` 里 `modId` / `modName` 字段为空**（不是缺失文件）：ModLoader v2 按包内目录与文件名识别 mod，面板显示名来自包内其他元数据。因此「modId 空」不能作为包损坏的判据。（2026-11-08 复核：新增的两个 `decorations` 包 `boot.json` 顶层字段为 `name` / `version`（`前景背景模组` 5.12、`前景背景模组-地點圖包` 1.7.2），同样不含 `modId`。）
2. **5 个 `.modpack` 用 `System.IO.Compression.ZipFile.OpenRead` 读不到 `boot.json`**：`.modpack` 是 ModLoader 自有封装（非标准 zip 目录布局），不是文件损坏。原版 v2.5.8 / v1.4.6 均由 ModLoader 正常加载（ModHub 列表可见），不要据此判坏。

## 四、风险条目（按处置状态标注）

| 编号 | 风险 | 影响 | 当前处置 | 待决策 |
|---|---|---|---|---|
| R1 | ~~`deadwood` 三个附属包未安装~~ **目录已就位，但尚未装载** | 语音与衍生内容缺失（不报错） | **2026-11-06 已下载并逐字节校验**：audio 33,192,776 B / fem-goose 258,632 B / mysterious 222,152 B；`game\` 内共 **21 包**（2026-11-08 校准：追加 FertilityExpansion Visual 与两个 decorations 素材包）。**但实测加载通道是浏览器 IndexedDB（见第六节），复制到目录不等于安装**；audio 已确认未装载，另两包属「无法确证」 | 用 `game\mce-mod-import.html` 导入三包后刷新游戏（一次性动作，见第六节） |
| R2 | ~~`DolMod-0.1.990` 是测试版~~ **已核实无稳定版可退** | CE 适配器 31 键对 0.1.990 源码全存活 | **2026-11-06 复核 release 列表**：`1.9.9测试` / `1.9.4测试` / `1.9.3修复` / `电脑测试` / `测试` 全部 `prerelease=false`，该仓库从不发不带「测试」字样的 tag → 维持 0.1.990（退回只会更旧） | 无（已处置） |
| R3 | ModLoader 报 32 条 `TweeReplacer 补丁文本未匹配` + 6 条 `back-acc.png` 缺图 | 部分模组补丁未生效；缺图属素材问题 | 已确认 back-acc.png 与 CE 无关；TweeReplacer 归属未定位 | 需逐条对模组源码核实（非本 mod 责任，但影响玩家观感） |
| R4 | `cheat extended v1.20.3.1` 与本 mod 同时存在 | 双悬浮球/按钮可能互相遮挡 | 实机验证：本 mod 蓝球与 CE 面板均可正常操作 | 若用户反馈遮挡再调位置 |
| R5 | `file://` 与 `http://127.0.0.1:8768` origin 不共享 localStorage **与 IndexedDB** | 用本地 HTTP 服务验证看不到玩家真实存档，也看不到玩家真实 mod 集 | 已写入验证口径（实机走 `file://`）；moli/http 冒烟只能验证 HTML 内嵌那一批 mod，不能代表玩家环境（见第六节） | 无需决策，属口径 |

## 五、复现方式

```powershell
$game = 'C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project\game'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Get-ChildItem -LiteralPath $game -File | Where-Object { $_.Extension -in '.zip','.modpack' } |
  Sort-Object Name | ForEach-Object { "{0}  {1}" -f $_.Length, $_.Name }
```

字节数与本表逐行一致即可确认清单未漂移。

## 六、mod 的真实加载通道（2026-11-06 定因，重要）

**结论先行：`game\` 目录里的 `.zip / .modpack` 只是源包仓库，ModLoader 不从这里扫包；实机加载的是浏览器 `file://` origin 的 IndexedDB。往 `game\` 里放新包不会让游戏多加载一个 mod。**

### 6.1 证据链（逐条可复现）

1. **moli + 本地 HTTP 冒烟**：`Degrees of Lewdity.html` 下 `ModZipReader init` 稳定 **15 次**（两轮独立运行一致），与目录里的 21 包数量无关。
2. **HTML 内嵌数组 = ModLoader 自身内置插件集（2026-11-06 复测纠正）**：页面运行时 `window.modDataValueZipList.length = 23`，23 项全部 `PK` 头且**根目录都含 `boot.json`**；解析每项 zip 中央目录可见同一结构 `README.md + dist/ + dist/<功能模块>.js + boot.json`，插件名依次为 `preload.js`、`ConflictChecker`、`js/installLoaderHook`、`webpack_inject_early`、`dist_BeautySelectorAddon`、`CheckGameVersion.mod`、`CheckDoLCompressorDictionaries`、`TweeReplacerLinker`、`TweeReplacer`、`I18nTweeReplacer`、`I18nTweeList`、`I18nScriptList`、`ReplacePatch`、`TweePrefixPostfixAddon`、`Diff3WayMerge`、`DoLTimeWrapperAddon`、`ModdedClothesAddon`、`ModdedHairAddon`、`ModdedFeatsAddon`、`SweetAlert2Mod`、`ModuleCssReplacer`、`js/installDoLLinkButtonFilter`、`DoLLinkButtonFilter`（字节 6 KB～1,203 KB，合计约 7.33 MB）。
   **这 23 项不是玩家的 mod**——它们是 ModLoader 框架自带的插件（Twee 补丁器、i18n 列表、三路合并、CSS 替换器等），走 `LocalLoader` 内嵌通道自举，与 `game\` 的 21 个玩家包字节无任何对应关系。此条纠正 2026-11-06 早前的错误解读（曾误把这 23 项当成"候选 mod 集"）。

3. **零网络取包**：页面内包装 `fetch` / `XHR.open` 记不到任何包请求（`reqTotal:0`）；`python -m http.server` 访问日志只有 1 条 HTML 请求。
4. **ModLoader 契约（HTML 源码实证）**：
   - `LocalLoader` → 读 `window.modDataValueZipList`（内嵌 base64 数组）
   - `LocalStorageLoader` → 列表键 `modDataLocalStorageZipList`，每包键 `modDataLocalStorageZip:<名>`
   - `IndexDBLoader` → `dbName = 'ModLoader_IndexDBLoader'`、`storeName = 'ModLoader_IndexDBLoader'`、列表键 `modDataIndexDBZipList`、每包键 `modDataIndexDBZip:<名>`（`calcModNameKey`），值可为 base64 字符串或 Blob（JSZip 两者都吃）
   - 对外 API：`addModIndexDB(name, base64)` / `removeModIndexDB(name)` / `overwriteModIndexDBModList(list)` / `listModIndexDB()`
5. **Edge 侧实证（用户实际浏览器）**：
   - `…\Microsoft\Edge\User Data\Default\IndexedDB\file__0.indexeddb.leveldb` **3,851,543 B**（000028.ldb / 000029.ldb / 000026.log）
   - `…\file__0.indexeddb.blob` **316,091,527 B / 86 个 blob 文件**，明文命中 `MapleBirchCE`、`deadwood-reblooms`
   - blob 体积与目录包逐一对应（差值 28～30 B 为 Chromium blob 封装头）：`13,917,556` = ModI18N +30、`8,537,453` = Dol-Optimization +30、`3,966,310` = 枯木主包 +30、`7,155,933` = DomRobin +30、`893,464` = Cattery +28、`750,948` = 归途 +28、`388,526` = 框架 +28、`1,015,077` = DoLSims +28
   - 三附属包（33,192,776 / 258,632 / 222,152）在 blob 中**没有**对应项（最大只有 47 MB 级，且与三包字节均不吻合）
6. **「15 vs 23」已闭环（2026-11-06 复测）**：不是"8 项被过滤"，而是**采样时刻不同**。`mce_mod_probe8.ps1`（moli + `python http.server` 8769，固定等待 22 s）读出 `count=23 / hasBootCount=23 / inits=23`；早前两轮 `inits=15` 是 wait 条件 `init>=15` 一到即采样，ModLoader 尚未把 23 个插件全部 init 完。故「init 数」既不等于玩家 mod 数，也不适合当作固定门槛常量。

### 6.2 由此产生的口径修正

- **`real_smoke.ps1` 的 `init >= 15` 是静默假绿**：`moli` 跑的是 `http://127.0.0.1` origin，读不到玩家 `file://` 的 IndexedDB，只能看到 HTML 内嵌的 **ModLoader 内置插件**；21 包（玩家）/ 23 插件（内嵌）/ init 计数三者互不相干，固定 15 永远通过。
- **`init` 计数的正确语义是「ModLoader 自举完成度」**，不是「读到了几个 mod」。据此已改造 `real_smoke.ps1`：阈值改由 `mce-e2e\real_smoke_baseline.json` 驱动（`pluginCount=23`、`initMin=1`，文件缺失或字段非法即 `exit 2` 拒绝放行），wait 条件改为「抓到 `inject end` 证据 或 内置插件 init 数 ≥ 运行时 `pluginCount`−1 或 60 s 兜底」，并新增 G 断言比对内置插件集项数（数量变化即提示复核基线），结论判据收紧为「A/B/C 任一 WARN 即失败」（此前 `pass>=4` 会让 B/C 失败也能通过），输出里固定打印「本冒烟不覆盖玩家 file:// IndexedDB 的 mod 集」。
- **D 判「自举是否发生」而不是「进度多少」**：`init` 实测在 3～23 间波动（复用 profile 13 / 清空 profile 3 / 稳定期 22），百分比门槛会长期假 WARN。基线里 `initRatioMin=0.8` 只作输出参考线（`whyRatio` 字段记为历史口径），不参与判定。
- **冒烟末尾的截图（`%TEMP%\moli_real_smoke.png`）是真产物，不是可有可无的装饰**：`moli fetch --dump screenshot` 必须显式 `--wait load`（默认 `--wait done` 会把 `--timeout` 这个全阶段共享的绝对期限耗在 64MB 页面上），再加 `--delay-ms 15000` 等页面渲染（不加延迟会拍到全黑早期帧）；等待表达式不得复用依赖 `--document-start-script-file` 注入变量的条件（第二次 fetch 没有注入）；落盘必须走 `Start-Process -RedirectStandardOutput`——pwsh 的 `> file` 会把二进制按文本转码（PNG 头 0x89 → U+FFFD），文件看着有 14 KB 其实已损坏。失败时打印 moli 错误前 200 字符。2026-11-06 实测产出 530,559 B 合法 PNG，画面为 ModLoader 调试日志：23 个内置插件逐个 `modInjectEarlyLoad`，其中 1 个被 `[ModLoaderGui SafeMode]` 拦（`WARNING ... banned by [ModLoaderGui SafeMode]`），这正是 `init` 稳定落在 22/23 而非 23 的原因，与 `initMin=1` 的判据自洽——moli 侧的安全模式属环境行为，不是 CE 缺陷。
- **实机验证必须走 `file://`**：与玩家同一 origin 才有同一份 IndexedDB。

### 6.5 四层数字的正确对应（取代早前「映射未建立」的说法）

| 层 | 数字 | 来源 | 说明 |
|---|---|---|---|
| `game\` 目录 | 21 包 | 文件系统 | 只是源包仓库，不参与加载 |
| 玩家 IDB | 已装载 9 / 确定未装载 3 / 无法确证 9（列表项数读不出） | `mce-e2e\idb_audit.ps1`：blob 体积对账 + base64 空间约束 | 2026-11-08 实测（21 包，leveldb 7,065,793 B / blob 172 文件 299,234,547 B） |
| HTML 内嵌 | 23 项 | `window.modDataValueZipList` | ModLoader 自身插件，与玩家 mod 无关 |
| 运行时 init | 21~23（随采样时机） | `ModZipReader init` 日志计数 | ModLoader 自举完成度，非 mod 数 |

> **玩家 IDB 一格的判据（2026-11-08 复测）**：列表键 `modDataIndexDBZipList` 与包键在 leveldb 里被 Snappy 压缩，明文 0 命中，**读不到列表项数**；因此用两条物理约束判：
> a) blob 目录存在体积 = 包体积 + 28~30 B 的文件 → **已装载**（9 个：Cattery / 枯木主包 / decorations地點圖包 / Dol-Optimization / DoLSims / DomRobin / 框架 / ModI18N / 归途之书）；
> b) 无对应 blob，且 base64 形态所需 ≈1.33×包体积 已超过整个 leveldb（**7,065,793 B**）→ 物理上不可能以字符串形态在库 → **确定未装载**（audio 33,192,776、FertilityExpansion Visual 36,247,181、GameOriginalImagePack 52,984,102）；
> c) 无对应 blob，但 leveldb 装得下 base64 → **无法确证**（fem-goose 258,632、mysterious 222,152、decorations前景背景 23,958、DolMod 803,610、MapleBirchCE 286,204、MLI 10,534、MoreFarm 41,309、SmartPhone 3,791,189、Wraith 62,155）。注意 SmartPhone 3,791,189 随 leveldb 增长（3.9 MB → 7.07 MB）由上一轮的「确定未装载」转入 c 类，属判据变化不是装载状态变化。
> 要判 c 类，须用 Edge 以 `file://` 打开 `game\mce-mod-import.html` 读 `#current`（本机 moli 不支持 `file://`，Edge `--dump-dom` headless 亦无输出，两条自动化通道均不可用）。
> **`MapleBirchCE.mod.zip` 落在 c 类**：blob 中无 286,204（+28~30 B）对应项，但 leveldb 装得下其 base64 形态 → 只能判「无法确证」。**不能据此断言 IDB 内是旧版本**（旧台账此处写的「说明仍是旧版本」属过强推断，2026-11-08 已更正）：确定结论只有一条——要让 v2.0.8 生效，必须重新导入一次。

三附属包 + FertilityExpansion 正确导入后，玩家侧期望变为：IDB 列表新增 4 项，blob 新增 `33,192,806 / 258,660 / 222,180 / 36,247,211`（±30 B 封装头）四条，`MapleBirchCE` 项体积由上一版变为 286,234 级。这只是**期望值**，不是当前实测值——当前 `audio` 与 `FertilityExpansion` 已确认未装载，其余属「无法确证」，须 file:// 页面读列表才能定论。

对账脚本：`mce-e2e\idb_audit.ps1`（只读、不锁浏览器文件，约 20 s）。默认 `exit 0` 只打印三档结论；加 `-Strict` 时存在「未装载 / 无法确证」项即 `exit 3`——**当前状态下必然 exit 3（3 项确定未装载、9 项无法确证）**，所以它适合作一次性核查或告警，不适合作「必须全绿」的常驻门禁。


### 6.3 补装附属包的正确做法（一次性）

1. 用 Edge 打开 `game\mce-mod-import.html`（**必须 `file://` 打开，与本页同源才能读写同一份 IndexedDB**）
2. 页面顶部显示当前已登记的包列表；点「选择要导入的包」选中三附属包 → 点「导入到 IndexedDB」
3. 同名包覆盖内容、位置不变；导入后列表键自动更新
4. 关闭本页，刷新 `Degrees of Lewdity.html` 生效
5. 页面带 `?selftest=1` 自检（写入 → 读回 → 回滚，不触碰真实包键），用于确认页面与 IDB 通道可用
6. 回滚：页面「导出列表备份」先存一份 `modDataIndexDBZipList` 原文；需要撤销时把原文写回列表键即可（包键可留着，不占加载）

### 6.4 日常更新的连带结论

改完 mod 后若只把 zip 复制进 `game\`，游戏**不会**加载它——必须同样走一次导入。这条同样适用于 `MapleBirchCE.mod.zip` 自身的更新。

