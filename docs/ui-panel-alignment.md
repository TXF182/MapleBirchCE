# CE 面板 × DoL-Game-UI 4.2 对齐清单

> **这份文件回答一个问题**：装了 DoL-Game-UI 4.2 之后，CE 面板里哪些部分该跟着主 UI 变、哪些必须保持原生。
> **它存在的理由**：后续所有视觉改动都要有个锚点。没有锚点，每一轮改样式都在重新猜"这里会不会被主 UI 撞上"。
>
> 取证日期 2026-11-11｜对象：MapleBirchCE `javascript/src/07*.js` × DoLGameUI 4.2.0（`DoLGameUI-4.2.0.mod.zip`，sha256 `e29b5306…b502dc8`）
>
> **取证方法（可复现，非二手转述）**
> - CE 侧：`Read` 逐文件读 `07a-shell.js` / `07a-shell2.js` / `07h-render.js` / `07h-render2.js` / `07h-render3.js`；`python` 批量抽 29 个 07 文件的头部职责注释；`Grep` 扫 `#story|document.body|DoLGameUI|SoftWet` 全部命中。
> - 主 UI 侧：解包 `DoLGameUI-4.2.0.mod.zip` → `python` 对 441,973 B 的单行压缩 `style.css` 做规则块拆分（2,943 块）+ 精确选择器提取；`index.js`（686,696 B）按关键字定位 `toggleAttribute` 的真实调用点。
> - 不采信：截图推断、文档描述、历史对话记忆。凡本文件写下的数字与选择器，均可按上面的命令重跑复现。

---

## 一、结论先行

三句话：

1. **CE 面板的绝大部分必须保留原生。** 它不是"能不能交给主 UI 渲染"的问题，而是"交出去会丢掉懒渲染、7 页签状态机、sticky 吸底，以及被第三方脚本改写 DOM 的防御"。
2. **真正需要跟随主 UI 的只有一处结构性位置**：锚定确认条——它长在 `#story` 里，却**自己写死了 `font-size:14px`**，于是既不被主 UI 缩放、也不跟随：正文放大到 24px 时它仍是 14px，紧贴在一起一小一大（moli 实测）。另有一条**条件性**的按钮尺寸污染：`.mce-btn` 完全没有 `min-height`，被主 UI 撑到 66px。
3. **默认配置下零冲突。** 主 UI 的字号/按钮缩放是**开关式**的——玩家不把缩放调离 100%，`html` 上就不会挂 `data-dgu-*-scaled`，CE 面板完全不受影响。冲突只在"玩家调过缩放"时出现，所以验收按参数分两档（属性不挂 / 属性挂）即可，不必穷举。

---

## 二、CE 的 DOM 归属地图（实测，非推测）

CE 界面由 **5 类节点**组成，分散在 3 个不同的宿主里。这是整份清单的地基——**节点挂在哪，决定了它归谁管**。

| # | 元素 | 挂载宿主 | 证据 | 定位 | z-index |
|---|---|---|---|---|---|
| 1 | `#mce-root`（七页签主面板） | `document.body` | `09-exports.js:238` | `fixed; top:8px; right:0; bottom:8px; width:430px; max-width:96vw` | **2147483000** |
| 2 | `#mce-toggle`（52px 悬浮球） | `document.body` | `09-exports.js:74` | `fixed; right:14px; bottom:14px; 52×52px` | **2147482999** |
| 3 | `.mce-anchor-prompt`（锚定确认条） | **`#story` 首个子元素** | `07f-pins2-anchor.js:231-232` | `fixed; top:0; left:0; right:0` | **2147483647** |
| 4 | Wikifier 临时 holder | `document.body` | `07f-pins3-queue2.js:195-199` | `display:none`，`finally` 里立即移除 | 无 |
| 5 | `#mce-style`（唯一样式表） | `document.head` | `07a-shell.js:392` | — | — |

两张图看懂第 1、3 条的区别：

```
document.body
├── #mce-root      ← body 直属。主 UI 的 page-shell 管不到这里
├── #mce-toggle    ← body 直属
└── #passages      ← 主 UI 的地盘（html[data-dgu-font-scaled] 管这里）
    └── #story
        └── .mce-anchor-prompt   ← 唯一的"跨边界"元素：CE 的 DOM，主 UI 的地界
```

**第 3 条是整份清单的核心。** `07a-shell.js:361` 的注释本身就写着这件事：

> 锚定确认条跟随主题（条在 `#story` 内、root 外，不继承 root 星空变量——把星空 token 组定义在条自身元素上）

写出这段注释的人当时只考虑了"主题变量继承"，没考虑"主 UI 的字号缩放会顺着 `#passages` 爬到这条上"。

---

## 三、主 UI 的侵入面（实测三条，附精确选择器）

读完 441,973 B 的 `style.css`（2,943 条规则块）后，与 CE 面板真正相关的只有三条。其余 2,900 多条都被作用域锁在主 UI 自己的容器里。

**规则分布实测**：806 条以 `html[data-stone-free]` 开头｜599 条其他 `html[...]` 开头｜**1,329 条无 `html` 前缀**（但这批绝大多数是 `.dgs-*` / `#dol-*` 自带命名空间的，只有下面第 1 条是真全局）｜207 条 at-rule｜2 条 `:root`。

### 侵入 1：全局按钮尺寸（**条件性，会命中 CE 全面板**）

```css
html[data-dgu-buttons-scaled] :is(button,input[type=button],input[type=submit]):not(#ui-bar *):not([data-overlay=modloader] *){
  padding:calc(.5em * var(--dgu-button-scale,1)) calc(.75em * var(--dgu-button-scale,1))!important;
  min-height:max(36px,calc(44px * var(--dgu-button-scale,1)));
  box-sizing:border-box;max-width:100%;white-space:normal;overflow-wrap:anywhere
}
```

**为什么这条会打到 CE**：它的主语是 `:is(button,...)`——**不限容器**，只排除了 `#ui-bar` 内和 modloader 浮层内。`#mce-root` 里的每个按钮都在射程内。CE 的 `.mce-btn` 是 `padding:3px 9px`，**自己没有 `min-height`**——主 UI 的 `min-height:max(36px,44px*scale)` 没有任何对手，直接接管。

**moli 1.1.22（Chromium 内核）实测**，`--dgu-button-scale:1.5`、13px 字号基准：

| 状态 | padding | min-height | 盒子 |
|---|---|---|---|
| 属性不挂（默认） | 3px 9px | **0px** | 100×20 |
| 属性挂上 | **9.75px 14.625px** | **66px** | 100×66 |

一个 20px 高的紧凑按钮被撑成 66px 起。七页签的密集布局正是这种按钮堆出来的，**整体崩高成立**。

**什么时候触发**（`index.js` 实测原文）：

```js
document.documentElement.toggleAttribute("data-dgu-buttons-scaled", et() && ce !== 100);
document.documentElement.toggleAttribute("data-dgu-font-scaled",   et() && ne !== 100);
```

`et()` = 主 UI 已启用；`ce` = 玩家设的按钮缩放；`ne` = 字号缩放。**玩家不动设置 → 属性不存在 → 规则不生效 → CE 零污染。**

**反制手段（这一节此前写错了，已按实测校正）**：不能靠 `#mce-root button`。主 UI 那条的真实特异性是 **(1,3,2)**，不是看上去的 (0,0,1)：

- `:is(button,input[type=button],input[type=submit])` 取括号内**最高**的那个，即 `input[type=button]` = **(0,1,1)**（不是 `button` 的 (0,0,1)）
- `:not(#ui-bar *)` 贡献一个 **ID** = (1,0,0)
- 合计 = 类型 2（`html` / `input`）+ 属性 3 + ID 1 = **(1,3,2)**

moli 四组对照实测（同一 DOM，只换反制规则）：

| 反制规则 | 特异性 | padding | min-height |
|---|---|---|---|
| 无 | — | 9.75 / 14.625 | 66px |
| `#mce-root button{…!important}` | (1,0,1) | **9.75 / 14.625（输）** | 0px（赢） |
| `#mce-root .mce-btn{…!important}` | (1,1,0) | **9.75 / 14.625（输）** | 0px（赢） |
| `#mce-root#mce-root button{…!important}` | **(2,0,1)** | **3px 9px（赢）** | 0px（赢） |
| 按钮内联 `style="…!important"` | 内联 | 3px 9px（赢） | 0px（赢） |

**两个属性的胜负判据不一样**，因为 `!important` 在这条规则里**只跟在 `padding` 后面**：

- `min-height`：普通声明，任何带 `!important` 的反制都赢
- `padding`：带 `!important` 且特异性 (1,3,2)，必须 ID 计数 ≥2（或内联 important）才能赢

所以纯 CSS 的确定写法是双 ID `#mce-root#mce-root`——写法不漂亮但语义合法（复合选择器重复同一 ID 是允许的）。若不接受这个写法，就只能放弃 `padding` 只夺回 `min-height`：那按钮会停在 39.5px（padding 撑起来的），仍是原 20px 的两倍。**要真恢复紧凑，两个都得夺，双 ID 不可回避。**

### 侵入 2：正文字号（**面板不受影响，锚定条也不受缩放——但它因此脱节**）

```css
html[data-dgu-font-scaled] :is(#passages,#customOverlay:not([data-overlay=modloader]),#ui-dialog-body){
  font-size:calc(1rem * var(--dgu-font-scale,1))
}
```

容器锁死在 `#passages` / `#customOverlay` / `#ui-dialog-body` 三者内。
- `#mce-root`（body 直属）→ **不在射程**
- `.mce-anchor-prompt`（`#story` ⊂ `#passages`）→ 宿主**在**射程，**但它自己声明了 `font-size:14px`**

**moli 实测**，`--dgu-font-scale:1.5`：

| 元素 | 基线 | 字号 150% |
|---|---|---|
| `#passages` | 16px | **24px** |
| `#story` | 16px | **24px** |
| `.mce-anchor-prompt` | 14px | **14px（不变）** |
| `.mce-anchor-prompt` 内按钮 | 13px | **13px（不变）** |

绝对值声明截断了继承链，缩放**到不了**这条。所以结论要反过来：**污染不存在，脱节才存在**。玩家把正文调到 24px 时，紧贴在正文上方的确认条仍是 14px、按钮 13px，一小一大。

### 侵入 3：右下角两个 52px 球撞在一起

| | CE `#mce-toggle` | 主 UI `.dsf-ball` |
|---|---|---|
| 尺寸 | **52×52px** | **52×52px**（`width:52px;height:52px;min-height:52px;border-radius:50%`） |
| 容器 | body 直属 | `#dol-stone-free-floating{position:fixed;inset:0;pointer-events:none;z-index:350}` |
| 层级 | **2147482999** | 350（但内部另有元素用到 2147482101） |
| 可拖 | 是（`.mce-dragging`, `touch-action:none`） | 是（`.dsf-dragging`） |

**两个球同尺寸、同角落、都可拖。CE 的层级高 2147482649，会盖在主 UI 球上面。** 这不是审美问题，是**入口被挡**。

注意 z-index 的绝对值：CE 面板 2147483000 / 主 UI 最高 2147482101 —— **CE 整体压着主 UI 100 层**。后果是：玩家开着 CE 面板时，主 UI 弹 modal/drawer/inspector 会被 CE 面板遮住。

---

## 四、清单 A：该跟随主 UI 的部分

判据不是"好不好看"，是三条硬条件任一成立：① 节点落在主 UI 的容器里｜② 玩家在阅读剧情时会同时在视野里看到它｜③ 主 UI 提供了对应语义（token / 角色）。

| # | 对象 | 现状锚点 | 为什么跟随 | 怎么改 |
|---|---|---|---|---|
| **A1** | 锚定确认条 `.mce-anchor-prompt` 的**字号** | `07a-shell.js` 写死 `font-size:14px`（`@media(max-width:520px)` 再设 13px）；挂载 `07f-pins2-anchor.js:231-232` | **实测它不在主 UI 缩放射程内**——自设绝对值截断继承。真问题是它**完全不跟随**：正文 24px 时它仍 14px，紧贴一起一小一大 | **已实施**（2026-11-11，版本仍 2.0.18 未升）：两处改 `calc(Npx * var(--dgu-font-scale,1))`。该变量由主 UI 注入在 `html` 上、缺省值 1，所以无主 UI 时逐位等价于原值。**不要指望继承**——继承已被自声明挡住 |
| **A2** | 面板内**按钮的最小高度与内边距** | 六类按钮各有尺寸语义（`.mce-btn` `3px 9px` 无 min-height｜`.mce-btn-grid .mce-btn` `6px 8px`｜`.mce-inner button` `3px 10px`｜`.mce-row button` `3px 8px` + 22px｜`.mce-tabs button` `8px 6px` + `--mce-tab-h`｜`.mce-header button` `0 7px`）；窄屏页签 `8px 5px` | 实测 `scale=1.5` 时 `.mce-btn` padding→9.75/14.625、min-height→**66px**；20px 高的按钮被撑到 66px，七页签密集排版崩高 | **已实施**（2026-11-11）：**按类逐条封回，不是一刀切**。7 条规则落在新段 `07a-shell-css.js`（见 A2 落地细节）。一刀切 `#mce-root#mce-root button{padding:3px 9px!important;min-height:0!important}` 会把页签从 36px 压塌到 0、标题栏图标撑成 66px、行内 22px 归零——**上一轮定的改法是错的，已推翻**。**双 ID 不能省**：`(1,0,1)` 与 `(1,1,0)` 实测都输给主 UI 的 `(1,3,2)` |
| **A3** | 面板**主色 / 卡片色 / 边框 / 圆角** | `MB_CSS` 的 `:root{}` 约 70 个 `--mce-*` | 这是路径 B 的本来目的，也是唯一干净的对接面 | **已实施**（2026-11-11）：`getTheme().tokens` **4 键** → 指向 `--mce-accent / --mce-bg-card / --mce-border / --mce-radius`。**两处与原清单不同**：① `tokens` 不是色值，是**变量名映射表**（`ocean:"--dgu-accent"`），所以写 `var(--dgu-accent, CE默认)` 而不是抄色值；② CE 没有 `--mce-card-bg`，真实变量名是 `--mce-bg-card`。落地细节见下节 |
| **A4** | 面板**宽度与断点** | `#mce-root` 的 `430px` / `@media(max-width:520px)` 全屏 | 主 UI 有 `cap.layout`（mobile/tablet/desktop），玩家已按主 UI 的断点建立了预期；主 UI 在 ≤600px 已是移动布局，CE 若在 521–600px 仍悬停就会与它并存 | **已实施**（2026-11-11）：`cap.layout==='mobile'` → 给 `#mce-root` 挂 `mce-host-mobile` 走 100vw 全屏（**与现有 520 断点取并集，不改原断点**）；`tablet/desktop` 保持 430px。**必须自己监 `resize`**——主 UI 不把 `layout` 挂到 `html` 上（`attributeFilter` 只有 4 个 `data-*`），`cap` 只是调用瞬间的快照。代价：521–600px 比现状提前约 80px 全屏 |
| **A5** | **动效强度** | `MB_CSS` 的 `mce-pop-in .15s`、星空 `3.5s` 呼吸 | 系统级无障碍与主 UI 动效开关都该被尊重 | **已实施**（2026-11-11），**原写法前提是错的**：`setTheme` 管的是 `mce-theme-starry` 配色（B8 明确与"降动效"正交），拿它当动效开关是两回事。正解是**零 JS 的两条 CSS**：`@media (prefers-reduced-motion: reduce)` + `html[data-dol-midnight]:not([data-dgu-visualMotion])`，**故意不读 `cap.reducedMotion`**（它是 `matchMedia` 的镜像，读镜像等于多一个会过期的真相源） |

### A1 的落地细节（**已实施**，已离线验证，可复跑）

**状态**：2026-11-11 已改源码并交付（版本仍 `2.0.18` 未升、未发布）。全链 12 步 `ALL CHECKS PASSED`，产物 `0E804F29…B55974`（该包当日已被 A2 产物 `032773E7…C9527F` 覆盖装机）。

改的是 `javascript\src\07a-shell.js` 的 `MB_CSS` 里**两处**，不是一处：

| 位置 | 现状 | 改为 |
|---|---|---|
| 主规则（桌面） | `.mce-anchor-prompt{…font-size:14px;…}` | `…font-size:calc(14px * var(--dgu-font-scale,1));…` |
| `@media (max-width:520px)` | `.mce-anchor-prompt{padding:6px 8px;font-size:13px}` | `.mce-anchor-prompt{padding:6px 8px;font-size:calc(13px * var(--dgu-font-scale,1))}` |

`.mce-anchor-prompt button` 的 `font-size:13px` **本轮不动**——按钮字号属于控件尺寸，主 UI 那边是独立的 button scale，混进来会把 A1 变成两件事。

**变量位置已取证**（`index.js` 原文，不是我推断的）：

```js
document.documentElement.style.setProperty("--dgu-font-scale", String((et()?ne:100)/100));
```

设在 `documentElement`（`html`）上，且**无条件执行**——`et()` 为假（主 UI 未启用）时写入 `"1"`。所以三种情况：主 UI 没装（变量不存在，走 `var()` 第二参 1）/ 装了没调（`"1"`）/ 调过（`"1.5"`）。

**moli 实测三态**（`docs\probes\run-anchor-font-probe.ps1`，14 条断言）：

| 状态 | 正文 | 现状 | 修复后 |
|---|---|---|---|
| 无变量 | 16px | 14 / 13px | **14 / 13px（逐位相同）** |
| 变量 = 1 | 16px | 14 / 13px | **14 / 13px（逐位相同）** |
| 变量 = 1.5 | **24px** | 14 / 13px（**脱节**） | **21 / 19.5px（比例同步）** |

14:16 = 21:24、13:16 = 19.5:24 —— 两条比例都保持，所以玩家看到的相对大小与正文一致。

**这条改动的前提是"没调字号时必须一模一样"**，上表前两行就是为它准备的：只要有一处不等（哪怕 13.5px 这种），这行 `calc()` 就是一次静默视觉回归。

**仍未被覆盖**：条的高度与换行。字号放大到 21px 后，`padding:8px 12px` + `flex-wrap:wrap` 是否够放、会不会把正文再往下压——这是布局，探针给不出，只能看实机。

复跑：`.\docs\probes\run-anchor-font-probe.ps1`（三态 14 条断言，全过 exit 0）。

### A2 的落地细节（**已实施**，已离线验证，可复跑）

**状态**：2026-11-11 改源码并装机（版本仍 `2.0.18` 未升、未发布）。全链 12 步 `ALL CHECKS PASSED`，产物 `032773E7…C9527F`（330,657 B，verifier 严格三项全过），已复制进 `game\MapleBirchCE.mod.zip`。

**上一轮的改法是错的，本轮推翻**。原定"一刀切 `#mce-root#mce-root button{padding:3px 9px!important;min-height:0!important}`"会同时压塌三类尺寸语义。`#mce-root` 内不是只有 `.mce-btn` 一类按钮，实测六类各有各的原值：

| 类 | 原 padding | 原 min-height | 一刀切后果 |
|---|---|---|---|
| `.mce-header button`（标题栏图标） | `0 7px` | 无 | 撑成 66px 高 |
| `.mce-tabs button`（七页签） | `8px 6px`（窄屏 `8px 5px`） | `var(--mce-tab-h)` = 36px | **压塌到 0** |
| `.mce-btn`（通用） | `3px 9px` | 无 | 正确 |
| `.mce-btn-grid .mce-btn`（网格块状） | `6px 8px` | 无 | 变薄，块感丢失 |
| `.mce-inner button` | `3px 10px` | 无 | 左右内距少 1px |
| `.mce-row button`（行内） | `3px 8px` | 22px | **归零** |

因此改为**按类逐条封回原值**，7 条（6 条主规则 + 1 条窄屏页签），全部带前导 `html[data-dgu-buttons-scaled]` —— **未装主 UI 时这段根本不匹配，零侵入**。

**为什么拆到新段而不是留在 `07a-shell.js`**：该文件基线正好 **400/400 行**（A1 只改内容所以没撞），A2 的 13 行无处安放，`run_all.ps1` 第 1 步结构门禁 S1 直接失败。项目已有同款先例——`01b-wrote-trim.js` 的 manifest note 原文："v2.0.12 写入留痕有界化 mbCEWroteTrim（**结构门禁拆段：01-core 加错误池后 415 行超 400 上限**）"。故按同一做法拆出 `07a-shell-css.js`（manifest layer `ui`，序在 `07a-shell.js` 之后），用 `MB_CSS +=` 追加（`injectCSS()` 运行时才读 `MB_CSS`，顺序安全）。**注：该段在 A3 轮已改名为 `07a-host-compat.js`**（职责从纯 CSS 扩为 CSS+JS 共存层，见下节）。**压行绕门禁不是选项**——400 行上限存在的意义就是防单段膨胀。

**断言**：`tests\smoke_dom.js` 的 `18.2c` 段 8 条（六类各一条 + "禁止一刀切 `#mce-root#mce-root button`" + "窄屏页签内距也封回"），全 PASS。本轮未按序跑红（断言与改码同轮完成），补了可追溯证据：在 A1 基线备份 `07a-shell.js.bak`（33,186 B）里搜 `data-dgu-buttons-scaled`，**命中 0**，即 8 条断言在改前必然全 FAIL。

**仍未被覆盖**：`--dgu-button-scale:1.5` 下封回后按钮**是否真的紧凑够用**。离线断言只能证明"值被写进去了"，证明不了"看起来舒服"——紧凑按钮在 1.5 倍字号正文旁边可能偏小。这是设计取舍，得看画面。

复跑：`.\docs\probes\run-ce-align-probe.ps1`（4 组 18 条断言，全过 exit 0）。

### A3 的落地细节（**已实施**，含两处清单笔误纠正）

**状态**：2026-11-11 改源码并装机（版本仍 `2.0.18` 未升、未发布）。全链 12 步 `ALL CHECKS PASSED`，产物 `E5F9CD…5137`（331,949 B，verifier 严格三项全过），已复制进 `game\MapleBirchCE.mod.zip`（10:51:40）。

**取证推翻了清单的原始理解**（对 `DoL-Game-UI 4.2.0` 原始 `index.js` / `style.css` 直接提取，非二手转述）：

| 事实 | 原文证据 |
|---|---|
| `tokens` 不是色值，是**变量名映射表** | `index.js`：`const Cm = Object.freeze({neutral:"--dgu-surface", card:"--dgu-card", ocean:"--dgu-accent", mist:"--dgu-secondary", text:"--dgu-text", danger:"--dgu-danger", radius:"--dgu-radius", cardRadius:"--dgu-card-radius"})` |
| 定义域在 html 层，`#mce-root` 可继承 | `style.css` **按规则块切分**（该文件是压缩单行，不能按行 grep）：`--dgu-accent` / `--dgu-secondary` / `--dgu-radius`(12px) / `--dgu-card-radius`(16px) 在 `:root`；`--dgu-card` 在 `html[data-stone-free]` |
| Api 挂载点与就绪事件 | `index.js`：`Ve.DoLGameUI = {...}` → `Ve.DoLGameUI.ui = i.api` → `document.dispatchEvent(new Event("dol-ui-runtime-ready"))` |
| **清单笔误** | CE 没有 `--mce-card-bg`，实际变量名是 `--mce-bg-card`（`07a-shell.js:151`）；`getTheme().tokens` 是 8 **个键名**，不是 8 个色值 |

由此决策：**不抄色值、抄变量名**。抄色值要监听主题切换，且主 UI 改版即失效；写 `var(--dgu-accent, #d4a73c)` 则主 UI 换主题自动跟随，未装主 UI 时语法合法并退化到 CE 原值。

| CE 变量 | token 键 | 主 UI 变量 | CE 默认 |
|---|---|---|---|
| `--mce-accent` | `ocean` | `--dgu-accent` | `#d4a73c` |
| `--mce-bg-card` | `card` | `--dgu-card` | `#111` |
| `--mce-border` | `mist` | `--dgu-secondary` | `#3c3c3c` |
| `--mce-radius` | `radius` | `--dgu-radius` | `4px` |

未映射的 4 键及理由：`neutral`（CE `--mce-bg-panel` 语义不同）｜`text`（CE 有 12 个 `--mce-txt-*` 层级）｜`danger`（CE 有 14 个 `--mce-red-*`）｜`cardRadius`（CE 无对应，`--mce-panel-r` 是面板外角不是卡片）。

**段位置**：`07a-shell.js` 已顶满 400/400 行，A2 又用掉新段名额，故把该段**改名升级**为 `07a-host-compat.js`（原 `07a-shell-css.js` 职责已从"纯 CSS"扩为"CSS+JS 共存层"，旧名名不副实）。改名不触发结构门禁 S2——续号判据是 `X2.js` 剥掉末位数字等于另一已存在段（`07a-shell2` ↔ `07a-shell`），`07a-host-compat` 不含该形态。

**实现要点**（`07a-host-compat.js`，4,917 B）：
- `window.DoLGameUI && window.DoLGameUI.ui` 取 api，无则 `return 0`；
- 写入走 `root.style.setProperty(...)`——inline style 优先级高于任何外部样式表，**不受 `head` 里 CE 与主 UI CSS 先后顺序影响**；
- 全程 `try/catch` **返回 0 不抛错**；
- 三重时序：`dol-ui-runtime-ready` 监听 + `setTimeout(0)` + `setTimeout(1200)`——主 UI 晚于 CE 加载时靠事件、已先加载时靠定时兜。

**断言 17 条**（TDD 红先拿到：8 FAIL / 1 PASS，PASS 那条是防误伤，`catch (e) { return 0; }` 串在旧产物里已存在）：

| 段 | 条数 | 性质 |
|---|---|---|
| `18.2d` | 9 | 字符串断言：映射表 / 4 键 / `var()` 写法 / 事件监听 / Api 挂载点 / `try-catch` |
| `18.2e` | 8 | **行为断言**：真派发 `dol-ui-runtime-ready` 后验 `#mce-root` 的 inline 值 |

`18.2e` 四条关键断言挡的是什么：

| 断言 | 它挡住什么 |
|---|---|
| `ocean → var(--dgu-accent, #d4a73c)` 实际写入 | 写错变量名或写错语法 → 静默无效 |
| `--mce-tab-h` 仍为空 | 映射表扩容时误伤布局 token |
| 主 UI 改名 `--renamed-accent` 后跟随 | 把变量名写死（那就退化成抄色值） |
| `getTheme()` 抛错不冒泡 | 一次异常废掉整个常驻面板 |

**仍未被覆盖**：`var(--dgu-accent, …)` 的继承与退化**在 jsdom 里解析不出 computedStyle**（jsdom 不做布局、不算层叠）。moli 能验"属性写进去了"，验不了"颜色真的变了"。要判视觉须装主 UI 实机看一次，或写一个只读 `getComputedStyle(root).getPropertyValue("--mce-accent")` 的 moli 探针间接证明属性生效。

### A4 / A5 的落地细节（**均已实施**）

两处都追加在同一个段 `javascript\src\07a-host-compat.js`（A2/A3 的落点），段从 73 行增至 145 行，远低于 400 上限，不触发结构门禁拆段。

#### A5：原写法的前提是错的，正解是零 JS

清单原文写「已有 `setTheme` 切类，加一条 `reducedMotion → 不挂动画类` 即可」。**这个前提不成立**：`setTheme` 管的是 `mce-theme-starry`（金色/星空两套配色），B8 已明确它与"降动效"正交；拿配色开关当动效开关是把两件事混在一起。

真正的判据要从主 UI 原文取。`getCapabilities()` 函数体里三行：

```js
P = d("(prefers-reduced-motion: reduce)")                                  // reducedMotion
b = !i && documentElement.hasAttribute("data-dol-midnight")               // enabled
motion: b && !P && documentElement.hasAttribute("data-dgu-visualMotion")  // motion
```

即 **`cap.reducedMotion` 只是 `matchMedia` 的镜像**。读它等于抄一份会过期的副本，还得自己监听 media query 变化才知道它变了；而 `matchMedia` 与 `data-dgu-visualMotion` 本来就是浏览器/主 UI 自己维护的活状态。所以 A5 落成**两条纯 CSS，一行 JS 都不写**：

```css
@media (prefers-reduced-motion: reduce){ /* ① 系统级无障碍，与主 UI 装不装无关 */
  #mce-root,#mce-root *{animation:none!important;transition:none!important}
  #mce-toggle{animation:none!important;transition:none!important}
  .mce-anchor-prompt{animation:none!important;transition:none!important}
  .mce-anchor-prompt *{animation:none!important;transition:none!important}
}
html[data-dol-midnight]:not([data-dgu-visualMotion]) #mce-root,…        /* ② 主 UI 启用但玩家关了动效 */
```

**为什么必须逐宿主写**：动画声明散在三处宿主——`#mce-root`（面板本体，`mce-open`/`mce-closing`/4 个 fade 入口/`mce-flash`/`mce-prompt-in` 共 8 处 `animation`）、`#mce-toggle`（悬浮球，body 直属，星空主题下 `3.5s` **无限呼吸**）、`.mce-anchor-prompt`（锚定条，`#story` 首个子元素，**既不在 `#mce-root` 里也不是 body 直属**）。后代选择器够不到第三个宿主。

**② 的前导 `html[data-dol-midnight]` 不能省**：它保证未装主 UI 时零匹配（该属性是 `enabled` 的准确标志，已取证 `b = !i && h.hasAttribute("data-dol-midnight")`），否则"没装主 UI"会被误判成"玩家关了动效"，把所有人默认的动画都关掉。

| 断言（`18.2f`，6 条） | 挡的是什么 |
|---|---|
| 含 `@media (prefers-reduced-motion: reduce)` | 挡"用 JS 读 cap 快照"的退化实现 |
| `animation:none!important` / `transition:none!important` | 挡只关一种、或漏 `!important` 以致输给 `#mce-root.mce-open` |
| 含 `html[data-dol-midnight]:not([data-dgu-visualMotion])` | 挡漏掉主 UI 动效开关这一路 |
| `#mce-toggle{animation:…}` 单列 | 挡只覆盖 `#mce-root`、星空球继续无限呼吸 |
| `.mce-anchor-prompt{animation:…}` 单列 | 挡只覆盖面板、锚定条继续播 `mce-prompt-in` |

#### A4：cap 是快照，必须自己监 resize

主 UI 原文的断点：`layout = innerWidth<=600 ? "mobile" : innerWidth<=899 ? "tablet" : "desktop"`。

**关键限制**（这条决定了 A4 不能只写 CSS）：主 UI **不把 `layout` 挂到 `html` 上**——它自己的 `MutationObserver` 的 `attributeFilter` 只有 `["data-dol-midnight","data-dgu-visual","data-dgu-visualGlass","data-dgu-visualMotion"]`，没有任何 layout 属性。所以 `cap.layout` 只是 `getCapabilities()` 调用那一瞬的快照，旋转屏幕/拖窗口都不会自动更新。**不自己监 `resize` 重算，面板就会停在旧断点上。**

落地形态：

| 项 | 取值 | 理由 |
|---|---|---|
| 触发条件 | 只 `capabilities.layout === "mobile"` | CE 的 430px 浮动面板在 601–899px 里本来够用，跟着 tablet 改几何没有收益，只多一条可变的几何来源 |
| 动作 | 挂/摘 `#mce-root.mce-host-mobile` | 与现有 `@media(max-width:520px)` 分支**取并集**，不改原断点；对无主 UI 用户零影响（不挂类） |
| 几何规则 | `top/right/bottom/left:0;width, max-width:100vw;max-height:100vh;border-radius:0;border:none` | 与 520 分支的 `#mce-root{…}` 那条逐项对齐 |
| 刷新时机 | `resize`（节流 150ms）+ `dol-ui-runtime-ready` + `setTimeout(0)` + `setTimeout(1200)` | 节流因为 `getCapabilities()` 内部要跑 `CSS.supports()` 两三次，拖动窗口每帧调会卡 |
| 抛错 | `try/catch` 返回 0 且**不动 class** | `getCapabilities` 抛错时保持现状，比按"非 mobile"误摘更安全 |

**不复制 520 分支排版补偿的理由**：那份补偿（行内 label 独占一行、`.mce-inp` 84px→100%、按钮网格单列）是为**430px 面板宽**设计的（`07a-shell.js` 注释原文「避免 84-90px 输入框 + 两个按钮挤在同一行而溢出错位」）。521–600px 全屏后可用宽度 ≥521px，拥挤前提已消失，补偿不必跟着走。

**代价（必须让玩家能对照）**：521–600px 区间比现状（520px 才全屏）**提前约 80px 全屏**。这是"跟随主 UI 移动布局"的必要取舍——主 UI 在 ≤600px 已是移动布局，CE 若在这个区间仍悬停就会与它并存。

| 断言（`18.2g`，8 条） | 挡的是什么 |
|---|---|
| 含 `mce-host-mobile` / `capabilities.layout === "mobile"` | 挡"只改 CSS、根本没读 cap" |
| 含 `"resize"` | 挡漏 resize → 旋转后停在旧断点 |
| 含 `#mce-root.mce-host-mobile` 的几何规则 | 挡挂了类却没定义几何（挂个空类等于没做） |
| 行为：`layout=mobile` → 类真的挂上 | 挡字符串在、逻辑不通 |
| 行为：`layout=desktop` → 类被**摘掉** | 挡"只挂不摘"（窗口拉大后面板不会复原） |
| 行为：`getCapabilities` 抛错不冒泡 | 挡一次异常废掉整个面板 |
| 行为：无 `DoLGameUI` → 不挂类 | 挡把"没装主 UI"误判成 mobile |

**仍未被覆盖**：jsdom 不算层叠、不解析媒体查询，所以 `@media (prefers-reduced-motion)` 与 `html:not([data-dgu-visualMotion])` 这两条**是否真的压住了 `#mce-root.mce-open` 的 animation**，只有字符串与行为断言，没有 computedStyle 证据。要判须装主 UI + 开系统"减少动态效果"实机看一次，或用 moli 读 `getComputedStyle` 间接证明。



---

## 五、清单 B：必须保留原生的部分

判据：① 节点有独立宿主与层级，主 UI 管不到｜② 依赖 SugarCube / 自身滚动容器 / 自身状态机｜③ **已知会被外部脚本改写**。

| # | 对象 | 证据 | 为什么不能外包 |
|---|---|---|---|
| **B1** | **`#mce-root` 面板本体（七页签 + 全部内容）** | `09-exports.js:238`；`07a-shell2.js` 的 `switchOuterTab` 7 页签懒渲染 | 主 UI 的 `ui.openDrawer` 只接 `content` HTMLElement，会把外壳换成主 UI 的 drawer。后果：① 7 页签分发失效 ② 懒渲染时机失控（现在"切到哪个页签才 render 哪个"）③ `mbCE_ui_state_v1`（`tab/filter/collapsed/curName/innerTab/placesTab/theme/charFilter/diffPreview/placeOpen`）无处安放 |
| **B2** | **`#mce-toggle` 52px 悬浮球** | `09-exports.js:74`；`MB_CSS` 的 `.mce-dragging` / `touch-action:none` | 层级 2147482999 > 主 UI 350，会挡住主 UI 的 `.dsf-ball`。**但结论是"保留原生 + 错位"，不是"交出去"**：CE 球的拖拽状态是自己存的，交出去就丢 |
| **B3** | **`.mce-preview-bar` 的 sticky 吸底** | `MB_CSS`：`position:sticky; bottom:0; z-index:12`，父容器是 `.mce-body` | sticky 语义绑死在"自己的滚动容器"上。主 UI 若提供外壳，`bottom:0` 的参照系变成主 UI 容器，吸底位置全错 |
| **B4** | **`.mce-anchor-prompt` 的定位与 token 继承** | `07a-shell.js:361` 注释原文：「条在 #story 内、root 外，不继承 root 星空变量——把星空 token 组定义在条自身元素上」 | 它的 `mce-theme-starry` 类是**挂在条自身**的（`07f-pins2-anchor.js:203`）。若把条改挂到主 UI 容器，这套 token 继承链断掉，星空主题下条会退回金主题 |
| **B5** | **`07f-pins3-queue2.js` 的 Wikifier 临时 holder** | `:195-199`：建 `span` → 挂 body → `new Wikifier(holder, str)` → `finally` 移除 | 它靠的是 SugarCube 的 `Wikifier` 处理 Twee 宏。**任何"统一接管 DOM"的层都会破坏它**——它需要真实、可被 Wikifier 写入的游离节点 |
| **B6** | **`.mce-grp` / `.mce-group` 的 `contain:content`** | `MB_CSS`，注释原文：「v1.9.1（DoL-Game-UI 冲突排查）……减少大列表对 DoL-Game-UI 每帧 rAF 全量扫描的主线程压力」 | **这条是历史上真的被主 UI 咬过的地方**。主 UI 会每帧 rAF 扫描 DOM；面板节点越多越慢。`contain:content` 是已经生效的对策，**任何改版都不能把它去掉** |
| **B7** | **错误熔断器 `mbCEFuse`** | `07a-shell2.js:106/154/158-159`：`noiseRules` 里两条专门标注 `特效层(DoLGameUI)` / `DependenceChecker(DoLGameUI)` | 主 UI 在 CE 面板存在期间**会持续抛错**（每帧刷 `spotlight/glow`）。CE 已建了熔断：单源 ≥20/60s、全局 ≥200/分钟 → 30s 全熔断。**联动后不得放大这个量** |
| **B8** | **`mce-theme-starry` 星空主题** | `07a-shell2.js` 的 `setTheme/getTheme` 只切类 | 它与"跟随主 UI 材质"是**两个正交维度**。并存时必须定优先级：**主 UI 的 accent 优先，星空作为第二维**（否则换主题时两套 accent 互相覆盖） |
| **B9** | **七页签 ≤ 7 且不压缩** | `MB_CSS` 注释：「v2.0.0.006 增至 7 个，为避免「Mod作弊」被压窄」；`.mce-tabs{flex:1 0 auto; white-space:nowrap}` | 主 UI 的 `cap.layout==='mobile'` 若被用来压窄页签，会重演历史 bug。页签必须保持横向滚动 |

**B1 还有一条比架构更硬的理由**（`07h-render2.js` 注释原文）：

> sHead 曾只挂一个 span，实测被第三方 UI 模组改写为文本 `[object HTMLSpanElement]`；改为「mce-dot + mce-stage-name」双 span 后**新包实测仍被改写（16 处）**——外部脚本非按子元素数量判断。现改为纯文本，并辅以渲染后 800ms 延迟兜底修复。

**某个第三方 UI 模组会把 CE 的子元素对象化成字符串，实测 16 处。** 这条直接封死了"把 CE 面板的 DOM 交给任何外部层渲染"的选项——不是"可能会坏"，是"已经被改坏过 16 次"。CE 至今的应对是"纯文本 + 延迟兜底"，这个防御必须原样保留。

---

## 六、DolDynamicest：它示范的是"不要模仿的那条路"

查这个仓库不是为了抄它的做法，是为了确认**哪条路 CE 绝不能走**。

**仓库真值**：`ANLINSTUDIO/Degrees-of-Lewdity-DolDynamicest`，38 stars / 0 forks / JS / 255 KB，`pushed 2026-10-17`，`default_branch: main`。

**实现手段**（`Source/boot.json`，v3.3，11,172 B，实测字段分布）：

- `addonPlugin` 2 项：`TweeReplacerAddon`（**31 条 params**）+ `BeautySelectorAddon`（1 项）
- 31 条的字段是 `passage/replace/findString/tip` —— **用的是内联 `replace`，不是 `replaceFile`**
- **passage 分布：`Widgets` 18 条、`mobileStats` 11 条、`overlayReplace` 1 条、`Widgets Wardrobe` 1 条**

它做的事：往上游状态条渲染里注入调用点。抽样原文：

```
passage: "Widgets"
findString: "<div @class=\"_statColor\" @style=\"'width:' + _percent + '%'\"></div>"
replace:    "<<run window.Dynamicest?.statChange()>> <div @class=\"_statColor\" ...>"
all: true
```

**这条路的性质**：**去改别人渲染的 `Widgets`**。而 DoLGameUI 自己也在替换上游渲染层（`#dol-status-preview` 等 5 个 `#dol-*` 容器）。两个模组对同一批 passage 做字节级替换，**必然互相踩**——`findString` 是字节级精确匹配，一方先改，另一方的 `findString` 就匹配不上，而且**匹配失败只写日志不报错**。

**对 CE 的意义**：CE 面板是 body 直属的自有 DOM，**不需要也不应该去改 `Widgets`**。这条边界划清了，CE 与主 UI 之间就没有"同一批 DOM 争所有权"的问题——只剩本清单 A/B 两组各自的调整。

**同时它暴露了我方工具的一个真缺陷**（见下节）。

---

## 七、这份清单同时暴露的工具缺陷（已修）

拿 DolDynamicest v3.3 真实包跑 `dol-ui-design/scripts/check_ui_mod.py`，结果 **12 PASS / 1 WARN / 32 FAIL，exit 1**。

**32 条 FAIL 全部是误报。** 根因：脚本只认 `addonPlugin[].params[].replaceFile`，而 TweeReplacer 有**两种合法替换方式**——`replaceFile`（指向 `twee/*.twee` 片段）和 `replace`（内联字符串）。DolDynamicest 用的全是后者。`BeautySelectorAddon` 的 `params` 还是 dict 而非 list，也被一并误判。

后果很具体：**这技能第一次对真实第三方 UI 模组使用，就会判"不通过"并劝退**。

已修（`check_ui_mod.py`）：`replaceFile` 与 `replace` 二者有其一即合法，只有**两者都缺**才 FAIL；`replaceFile` 存在时仍核对其文件是否真在包内（那才是静默失效的高发区）。

---

## 八、验收矩阵

因为侵入面是条件性的，不需要穷举组合。其中 **S3 / S4 的 CSS 部分已用离线断言证明**（moli + 最小 HTML，不碰游戏、不碰 IndexedDB），剩下的才是需要实机的部分。

| 场景 | 主 UI 状态 | 现状（实测/推断） | 修复后必须成立 |
|---|---|---|---|
| S1 | 主 UI **未装** | 面板能开、能滚、能点 | 同左（回归基线） |
| S2 | 主 UI 已装，**参数全 100%** | **推断零差异**（两条属性都不挂；`toggleAttribute(…, et() && ce !== 100)` 为假） | 与 S1 逐像素一致 |
| S3 | 字号 ≠ 100% | **已实测**：`#passages` 16→24px，锚定条 **仍 14px（脱节）** | 锚定条跟到 24px；`#mce-root` 不跟 |
| S4 | 按钮 ≠ 100% | **已实测**：`.mce-btn` padding 3/9→**9.75/14.625**，min-height 0→**66px** | 回到 3/9 + 0（双 ID 反制生效） |
| S5 | `reducedMotion` 为真 | 未验证 | 不播动效，全部操作可达 |

**S2 与 S1 必须逐像素一致**——这是本清单最重要的一条验收：默认配置下，装不装主 UI，CE 面板看起来应该一模一样。这一条**只能用实机**（像素级），但它的**前提（属性不挂 → 规则不生效）已由 S3/S4 的对照组间接证明**：同一份 DOM，属性不挂时 padding/min-height 全部是 CE 原值。

**S3 / S4 怎么复跑**：`.\docs\probes\run-ce-align-probe.ps1`（真 Chromium 跑最小 HTML，4 组 18 条断言；不装 mod、不碰游戏目录与 IndexedDB）。

**离线断言的边界**：它证明的是"CSS 级联与计算值"这一层，证明不了布局溢出、滚动条、触控命中区、视觉观感。真要判"面板崩没崩高"，还得看真实画面的 `#mce-root` 滚动容器高度。

---

## 九、本清单没有覆盖的部分（如实声明）

1. **29 个 07 文件里只精读了 5 个**（`07a-shell` / `07a-shell2` / `07h-render` / `07h-render2` / `07h-render3`）+ 2 处跨边界注入点。其余 24 个只读了头部职责注释，**没有逐行核对其内部是否有自己的 DOM 注入或 fixed 定位**。B 组结论对它们成立的前提是"它们都在 `#mce-root` 内部渲染"——这个假设尚未逐文件验证。
2. **`#dol-stone-free-floating` 内部的 `.dsf-layer` 初始位置未取**（由 JS 动态计算，`index.js` 686 KB 压缩后定位成本高）。所以 B2 的"错位"只给了方向，没给具体坐标。
3. **未实机验证**。CSS 级联部分已用 moli（Chromium 1.1.22）+ 最小 HTML 离线断言实测（S3/S4 的数字就是实测值）。探针已固化在 `docs\probes\`，复跑：

   ```powershell
   .\docs\probes\run-ce-align-probe.ps1        # A2：按钮尺寸 4 组 18 条断言，全过 exit 0
   .\docs\probes\run-anchor-font-probe.ps1     # A1：锚定条字号 三态 14 条断言，全过 exit 0
   ```

   **但 S1/S2/S5 与全部布局观感（溢出、滚动、触控命中）仍未实机跑**。按项目纪律，这不等于通过。
4. **`cap` 的取值路径未在真实运行时采过样**：`window.DoLGameUI?.ui.getCapabilities()` 在游戏里返回什么，仍是静态契约推断。
5. **离线断言是手工搭的最小 HTML**，不是从真实游戏抽的页面：它照抄了两边规则原文与关键 DOM 层级，但没有游戏自身的 `#passages` 字号设置、`body` 基线、其他模组的干扰规则。所以它证明的是"这两条规则在这套 DOM 下谁赢"，不是"游戏里一定如此"。
6. **A1 改完之后条的高度/换行未验证**：字号从 14px 变 21px 后，`padding:8px 12px` + `flex-wrap:wrap` 够不够放、会不会压住正文，探针判不了。

**下一步最省的验证**：S3 / S4 的 CSS 层已经闭环（上表数字即实测值），所以现在**不必为"证明污染存在"去装主 UI**。剩下真正需要实机的只有一件事——S2 的像素级等同，以及 A1/A2 改完之后面板有没有溢出、滚动条、触控命中区的退化。这两件事都得看真实画面，离线断言给不了。

**如果要在不改玩家 mod 集的前提下再进一步**：把 CE 的 `MB_CSS` 与主 UI 的 `style.css` 一起塞进同一份最小 HTML（现在是分开照抄两条规则），能测出"CE 与主 UI 规则在 head 里的先后顺序"对非 `!important` 属性的影响——这部分我还没测。
