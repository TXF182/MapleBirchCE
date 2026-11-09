# plain 分支剩余欠账（2026-11-09 第三轮补测收口）

口径：`node tools/report_branch_gaps.js` 的 `classifyLine` 归因，`plain` = 普通 if-else 可补测欠账；
已从欠账里单独摘出的 `dead-guard`（不可达守卫）不计入本表。

实测（本轮收口）：`Branches 81.41%（5651/6941）`、`plain 131 条 / 45 文件`、归因合计 1290。
复现：`npm run coverage:gate` → `node tools/report_branch_gaps.js --top 12`；本表由当轮明细直接导出，行号为当轮源码行号。

## 汇总

| 文件 | plain | 形态分布 |
|---|---|---|
| `05a-modcheat-rows.js` | 11 | {"guard-no-assign":1,"non-guard other":6,"guard-reachable":2,"non-guard compare":1,"guard-maybe(*)":1} |
| `09-exports.js` | 7 | {"guard-no-assign":1,"guard-reachable":1,"guard-other":1,"non-guard other":4} |
| `08-npc-traits2.js` | 6 | {"non-guard other":5,"guard-no-assign":1} |
| `05b2-modcheat-attitude.js` | 5 | {"guard-maybe(*)":2,"guard-no-assign":2,"non-guard other":1} |
| `07a-shell2.js` | 5 | {"guard-no-assign":3,"non-guard other":2} |
| `07h-render2.js` | 5 | {"non-guard compare":1,"non-guard other":4} |
| `04b-modcheat-write.js` | 4 | {"non-guard other":3,"guard-other":1} |
| `05a2-modcheat-rows-build.js` | 4 | {"non-guard for":1,"non-guard other":3} |
| `05b-modcheat-player.js` | 4 | {"non-guard other":3,"guard-no-assign":1} |
| `07d-places2.js` | 4 | {"non-guard other":2,"non-guard compare":1,"non-guard for":1} |
| `07f-lock.js` | 4 | {"guard-maybe(*)":2,"non-guard other":1,"guard-no-assign":1} |
| `07f-lurker.js` | 4 | {"guard-maybe(*)":2,"guard-no-assign":1,"non-guard other":1} |
| `07f-pins3-queue.js` | 4 | {"guard-maybe(*)":1,"non-guard compare":1,"non-guard other":2} |
| `07f-pins3-queue2.js` | 4 | {"non-guard other":2,"guard-no-assign":2} |
| `01-core.js` | 3 | {"non-guard other":1,"guard-maybe(*)":1,"guard-no-assign":1} |
| `04a-14-fert-cheats.js` | 3 | {"guard-no-assign":1,"non-guard other":2} |
| `07a-shell.js` | 3 | {"non-guard for":1,"guard-no-assign":1,"non-guard other":1} |
| `07d-places.js` | 3 | {"non-guard other":2,"guard-reachable":1} |
| `07f-lurker0-patch.js` | 3 | {"non-guard compare":1,"non-guard for":1,"non-guard other":1} |
| `07f-pins2-anchor.js` | 3 | {"guard-maybe(*)":3} |
| `08c-undo-center.js` | 3 | {"non-guard other":2,"guard-no-assign":1} |
| `08e-undo-labels.js` | 3 | {"non-guard other":1,"guard-other":1,"guard-maybe(*)":1} |
| `02-romance.js` | 2 | {"non-guard other":2} |
| `03a-global-batch.js` | 2 | {"non-guard other":2} |
| `03c-global-combat.js` | 2 | {"non-guard other":2} |
| `03c-global-combat2.js` | 2 | {"non-guard other":2} |
| `04a-16-fert-children-ui.js` | 2 | {"guard-maybe(*)":1,"non-guard other":1} |
| `04a-17-dolonline.js` | 2 | {"non-guard other":2} |
| `05a3-modcheat-actions.js` | 2 | {"non-guard other":1,"guard-reachable":1} |
| `06c-traits-ui.js` | 2 | {"non-guard isNaN":1,"non-guard other":1} |
| `06d-traits-gender.js` | 2 | {"non-guard other":1,"guard-reachable":1} |
| `07e-scenes.js` | 2 | {"guard-maybe(*)":1,"non-guard compare":1} |
| `07l-vanilla-ext.js` | 2 | {"non-guard other":2} |
| `08b-attitude.js` | 2 | {"non-guard other":1,"guard-no-assign":1} |
| `09-exports2.js` | 2 | {"non-guard other":2} |
| `04a-15-fert-children.js` | 1 | {"non-guard other":1} |
| `07c-stage.js` | 1 | {"non-guard other":1} |
| `07e-scenes2.js` | 1 | {"guard-no-assign":1} |
| `07f-pins4-hook.js` | 1 | {"guard-maybe(*)":1} |
| `07g-romance.js` | 1 | {"non-guard other":1} |
| `07i-yanling-core.js` | 1 | {"guard-maybe(*)":1} |
| `07i-yanling-actions.js` | 1 | {"non-guard other":1} |
| `07i-yanling-page.js` | 1 | {"guard-reachable":1} |
| `07j-transform-hide.js` | 1 | {"guard-maybe(*)":1} |
| `07k-island-npc.js` | 1 | {"guard-maybe(*)":1} |
| **合计** | **131** | |

## 逐条明细

### `05a-modcheat-rows.js`（plain=11）

| 行 | branch/源码片段 |
|---|---|
| L15 | `[branch] if (!n) { return; }` |
| L30 | `[branch] if (t.failed) { t.body.appendChild(el("div", "mce-hint", "有 " + t.failed + " 行加载失败（适配器数据异常），已跳过。")); }` |
| L35 | `[branch] if (modRowQueue.length) { modRowBatchTimer = setTimeout(modRowStep, 0); }` |
| L115 | `[branch] if (!m.declared) {` |
| L268 | `[branch] if (!any) {   ⟵ any = true` |
| L209 | `[branch] if (groups[gkey]) { return groups[gkey]; }` |
| L242 | `[branch] if (failed) {` |
| L252 | `[branch] if (pend.length <= MOD_ROW_BATCH) {` |
| L315 | `[branch] if (!row) { return false; }   ⟵ row = pane.querySelector('[data-mce-key="' + esc + '"]')` |
| L317 | `[branch] if (!m) { return false; }   ⟵ m = findCheatMod(modId)` |

### `09-exports.js`（plain=7）

| 行 | branch/源码片段 |
|---|---|
| L4 | `[branch] if (!root) { return; }` |
| L18 | `[branch] if (!keep) { curName = chars[0]; mbCEUiSave({ curName: curName }); /* v1.8.12 二轮优化：角色记忆失效时回落到第一个角色并同步 */ }   ⟵ keep = true` |
| L19 | `[branch] else if (!curName) { curName = mbCEUiState.curName; } /* v1.8.12 二轮优化：恢复上次操作角色 */   ⟵ curName = chars[0]` |
| L152 | `[branch] }) : 0;` |
| L275 | `[branch] if (t) { clearTimeout(t); }` |
| L280 | `[branch] if (bucket === "search") { mceSearchTimer = t; } else { mceRenderTimer = t; }` |
| L277 | `[branch] if (bucket === "search") { mceSearchTimer = null; } else { mceRenderTimer = null; }` |

### `08-npc-traits2.js`（plain=6）

| 行 | branch/源码片段 |
|---|---|
| L125 | `[branch] if (vst.templePromised) { vowTxt += "；承诺对象：" + vst.templePromised; }` |
| L126 | `[branch] if (vst.templeRank) { vowTxt += "；神殿等级：" + vst.templeRank; }` |
| L19 | `[branch] if (!toggleBtn) { return; }` |
| L246 | `[branch] if (r.error) { msg = it.name + "执行失败：" + r.error; }` |
| L255 | `[branch] } else {` |

### `05b2-modcheat-attitude.js`（plain=5）

| 行 | branch/源码片段 |
|---|---|
| L106 | `[branch] if (!t) { return 0; }   ⟵ t = mbCEAttitudeTier(st.value)` |
| L119 | `[branch] if (!st) { st = mbCEAttitudeState(); }` |
| L133 | `[branch] if (!n) { return; }   ⟵ n = mbCEAttitudeTick()` |
| L135 | `[branch] if (line) { line.textContent = mbCEAttitudeStatusLine(); }` |
| L157 | `[branch] if (!pane) { return; }` |

### `07a-shell2.js`（plain=5）

| 行 | branch/源码片段 |
|---|---|
| L132 | `[branch] if (!mbCEErrBtn) { return; }` |
| L199 | `[branch] if (!mbCEErrRows) { return; }` |
| L202 | `[branch] if (mbCEInFuseAll()) {` |
| L219 | `[branch] if (!mbCEErrBox) { return; }` |
| L235 | `[branch] if (mbCEHookDone) { return; }` |

### `07h-render2.js`（plain=5）

| 行 | branch/源码片段 |
|---|---|
| L42 | `[branch] if (v < it.min) { v = it.min; } if (v > it.max) { v = it.max; } /* 进度档位语义，钳制在上限内 */` |
| L170 | `[branch] if (st.state === "pass") {` |
| L172 | `[branch] } else if (completed) {` |
| L193 | `[branch] } else if (!it.def.startPassage) {` |
| L305 | `[branch] if (isSceneCompleted(it.key)) { sh.appendChild(el("span", "mce-badge mce-on", "已完成 ✓")); }` |

### `04b-modcheat-write.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L19 | `[branch] if (!Object.prototype.hasOwnProperty.call(CHEAT_ADAPTERS, mid)) { continue; }` |
| L21 | `[branch] if (!e) { continue; }   ⟵ e = CHEAT_ADAPTERS[mid] && CHEAT_ADAPTERS[mid].entry` |
| L24 | `[branch] if (!Array.isArray(arr)) { continue; }` |
| L158 | `[branch] if (r.reason === "vanilla") {` |

### `05a2-modcheat-rows-build.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L20 | `[branch] for (i = 0; i < CHEAT_PASSIVE_PROBES.length; i++) {` |
| L50 | `[branch] if (!t.completeVar) { return { ok: false, message: "「" + t.name + "」未声明完成标记变量（completeVar），无法直接完成" }; }` |
| L56 | `[branch] if (!s.varPath) { return { ok: false, message: "「" + s.name + "」未声明阶段变量（varPath），无法修改" }; }` |
| L175 | `[branch] if (!opts.length) {` |

### `05b-modcheat-player.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L170 | `[branch] if (!es.ok) { return es; }` |
| L205 | `[branch] if (r.ok) { done++; } else { fails.push(WEAPON_LABEL[w]); }` |
| L215 | `[branch] if (!es.ok) { return es; }` |
| L229 | `[branch] if (!row) { return; }` |

### `07d-places2.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L44 | `[branch] function () { return placeStageWrite(path, target, min, max, true); })) {` |
| L181 | `[branch] } else if (entry.items.indexOf(g.main) !== -1) {` |
| L289 | `[branch] if (bad.length > maxShow) {` |
| L315 | `[branch] for (var wi = 0; wi < wRows.length; wi++) {` |

### `07f-lock.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L74 | `[branch] if (!list) { return undefined; }   ⟵ list = mbCELockListRO()` |
| L97 | `[branch] if (!list) { return { ok: false, message: "存档变量不可用" }; }   ⟵ list = mbCELockData()` |
| L246 | `[branch] if (!pane) { return; }` |

### `07f-lurker.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L31 | `[branch] if (!V) { return { ok: false, message: "存档变量不可用" }; }   ⟵ V = mbCELurkerV()` |
| L98 | `[branch] if (!V) { return { ok: false, message: "存档变量不可用" }; }   ⟵ V = mbCELurkerV()` |
| L118 | `[branch] if (!pane) { return; }` |
| L122 | `[branch] if (!st.ok) { sec.appendChild(el("div", "mce-err", st.message)); return; }` |

### `07f-pins3-queue.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L155 | `[branch] if (!q) { return { ok: false, message: "存档不可用，无法锚定" }; }   ⟵ q = getPinQueue()` |
| L207 | `[branch] if (farm) { skipParts.push(farm + " 个依赖农场线未开启"); }` |
| L208 | `[branch] if (other) { skipParts.push(other + " 个缺少入口段落"); }` |

### `07f-pins3-queue2.js`（plain=4）

| 行 | branch/源码片段 |
|---|---|
| L269 | `[branch] if (!src) { return ""; }` |
| L283 | `[branch] if (nm === "endevent") { continue; }` |
| L292 | `[branch] if (!src) { return false; }` |

### `01-core.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L55 | `[branch] else if (getSetup().MapleBirch) { MB = getSetup().MapleBirch; }` |
| L255 | `[branch] if (!key) { return null; }   ⟵ key = String(name).trim()` |
| L384 | `[branch] if (!npc) { return 0; }` |

### `04a-14-fert-cheats.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L115 | `[branch] if (!container) { return; }` |
| L128 | `[branch] : "你已经开着原版作弊页；即便不开，CE 也会在调用期间临时满足该前置，用完还原。"));` |
| L136 | `[branch] if (!list.length) { container.appendChild(el("div", "mce-hint", "当前没有已出生的孩子：先天/养成/重置/成年/删除需要先有孩子。")); }` |

### `07a-shell.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L126 | `[branch] for (var i = 0; i < els.length; i++) { els[i].classList.remove("mce-flash"); }` |
| L139 | `[branch] if (!stageKey) { return; }` |
| L388 | `[branch] if (document.getElementById("mce-style")) { return; }` |

### `07d-places.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L130 | `[branch] if (!box) { return true; }   ⟵ box = document.getElementById("passages")` |
| L139 | `[branch] if (before === target) { return; }` |

### `07f-lurker0-patch.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L41 | `[branch] if (n <= 0) { return String(repl); }` |
| L101 | `[branch] for (i = 0; i < nodes.length; i++) {` |
| L151 | `[branch] if (!res.hits) { done[names[i]] = true; continue; }` |

### `07f-pins2-anchor.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L258 | `[branch] if (!q) { return; }   ⟵ q = getPinQueue()` |
| L332 | `[branch] if (!q) { return []; }   ⟵ q = getPinQueue()` |
| L340 | `[branch] if (!q) { return -1; }   ⟵ q = getPinQueue()` |

### `08c-undo-center.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L85 | `[branch] if (type === "part") {` |
| L140 | `[branch] if (type === "vcore") {` |
| L217 | `[branch] if (!pane) { return; }` |

### `08e-undo-labels.js`（plain=3）

| 行 | branch/源码片段 |
|---|---|
| L100 | `[branch] if (!name) { name = itemKey; }   ⟵ name = recPath` |
| L156 | `[branch] if (!name) { name = rest; }   ⟵ name = zhKey(rest)` |

### `02-romance.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L162 | `[branch] if (m) { m = [m[0], m[2], m[1]]; }` |
| L266 | `[branch] if (r.ok) { n += 1; }` |

### `03a-global-batch.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L106 | `[branch] if (c.op === "set") {` |
| L109 | `[branch] if (!Array.isArray(V[c.key])) { V[c.key] = []; }` |

### `03c-global-combat.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L73 | `[branch] if (!Array.isArray(V.gwylanSeen)) { V.gwylanSeen = []; }` |
| L166 | `[branch] if (V.gwylanSeen.indexOf("yearning") === -1) { out.push("aroused"); }` |

### `03c-global-combat2.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L151 | `[branch] } else if (parsed.type === "clear") {` |
| L204 | `[branch] if (ok) { return { ok: false, message: "回退未生效：该阶段仍由原版数值/事件驱动，已达成状态无法仅靠撤销标记回落" }; }` |

### `04a-16-fert-children-ui.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L214 | `[branch] if (!info) {   ⟵ info = mbCEFertKidInfo(p[0])` |
| L232 | `[branch] if (base.__mbCEHasKids) { return; }` |

### `04a-17-dolonline.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L94 | `[branch] if (v.dgHp === undefined) {` |
| L119 | `[branch] if (!hasV()) { return { ok: false, message: "存档变量不可用（游戏尚未就绪）" }; }` |

### `05a3-modcheat-actions.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L33 | `[branch] if (!reg) { return { ok: false, message: "适配器注册表不可用" }; }   ⟵ reg = (typeof CHEAT_ADAPTERS === "object" && CHEAT_ADAPTERS) ? CHEAT_ADAPTERS : null` |

### `06c-traits-ui.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L61 | `[branch] if (isNaN(v)) { v = 0; }` |
| L196 | `[branch] if (seenM[key]) { return; }` |

### `06d-traits-gender.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L18 | `[branch] if (ve) { return "f"; }` |
| L92 | `[branch] if (!pane) { return; }   ⟵ pane = root.querySelector('[data-pane="mods"]')` |

### `07e-scenes.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L82 | `[branch] if (!s) { return true; }   ⟵ s = String(expr \|\| "").trim()` |
| L92 | `[branch] if (sceneExprFnCacheN >= 512) { sceneExprFnCache = Object.create(null); sceneExprFnCacheN = 0; }` |

### `07l-vanilla-ext.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L302 | `[branch] if (b.maxCount !== undefined) { ma.maxCount = b.maxCount; }` |
| L307 | `[branch] if (V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] === undefined) { V.feats.currentSave[MCE_VANILLA_FEAT_MUSEUM] = new Date(); }` |

### `08b-attitude.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L69 | `[branch] if (fails.length) { return { ok: false, message: "部分失败：" + fails.join(" / ") }; }` |
| L80 | `[branch] if (!pane) { return; }` |

### `09-exports2.js`（plain=2）

| 行 | branch/源码片段 |
|---|---|
| L23 | `[branch] if (initialized) { return; }` |
| L40 | `[branch] } else {` |

### `04a-15-fert-children.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L281 | `[branch] if (info.phase === "egg") { return "未孵化"; }` |

### `07c-stage.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L27 | `[branch] if (st.found) { card.appendChild(el("div", "mce-hint", "游戏状态 state = " + stateCN(st.state))); }` |

### `07e-scenes2.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L174 | `[branch] var V = getV(); if (!V) { return "状态对象不可用"; }` |

### `07f-pins4-hook.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L167 | `[branch] if (!q) { return; }   ⟵ q = getPinQueue()` |

### `07g-romance.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L188 | `[branch] } else {` |

### `07i-yanling-core.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L250 | `[branch] if (!st) { return { ok: false, msg: "存档变量不可用" }; }   ⟵ st = mbCEYanlingState()` |

### `07i-yanling-actions.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L334 | `[branch] if (npc.init === 0) { return { ok: false, msg: "惠特尼尚未初始化（未相遇）" }; }` |

### `07i-yanling-page.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L7 | `[branch] if (!pane) { return; }   ⟵ pane = root ? root.querySelector('[data-pane="yanling"]') : null` |

### `07j-transform-hide.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L144 | `[branch] if (!hs) { return { ok: false, message: "存档变量不可用" }; }   ⟵ hs = mbCEHideState()` |

### `07k-island-npc.js`（plain=1）

| 行 | branch/源码片段 |
|---|---|
| L135 | `[branch] if (!V) { return { ok: false, message: "存档变量不可用" }; }   ⟵ V = mbCEIslandV()` |

## 分类口径（本轮结论）

- **guard-maybe(*) / guard-no-assign（28 条）**：守卫变量在构造期必被赋值（`getV()` 恒返回对象、`root`/`pane`/函数内 `var` 先赋值后判空），true 侧要到达必须让构造函数返回 `null/undefined`，属结构性不可达；若要覆盖只能改产品语义，不在测试侧强造。
- **guard-reachable（6 条）**：守卫可达但需真实引擎交互（passage 切换、panel 生命周期），jsdom 静态驱动覆盖不到，交由 moli 实机冒烟覆盖。
- **non-guard other / compare / for / isNaN（约 97 条）**：多数是 UI 事件闭包（`addEventListener` 内的钳制、徽章分支、拖动三元）、未导出内部函数（`mceSchedule` / `refreshModRow` / `mbCEFertKidAgeText` 等），需真实点击或真实数据渲染；本轮已把能经导出 API + 状态注入抵达的部分补掉。

> 补测落点统一是 `tests/plain_branches.js`（覆盖率序列末位）。每批补完必须以「plain 明细差分」验证命中，
> 不能只看分支百分比——c8 分母会随新执行代码块变化（本轮 6888 → 6941）。