# plain 分支剩余欠账（2026-11-09 第三轮补测收口）

> **2026-11-09 第四轮补测（本段为后续进展；下方表格是第三轮快照，保留作对照）**
>
> 结果：`Branches 81.59%（5694/6978）`，`run_all.ps1` 12/12 绿。已清分支的断言全在
> `tests/plain_branches.js` 第 7–10 段，可直接复核。
>
> | 文件 | 行 | 覆盖方式 | 提交 |
> |---|---|---|---|
> | `09-exports.js` | L18 / L19 | 注入 `maplebirch.npc.NPCNameList` 造「框架有角色」夹具（此前 `npc:{}` 使 `listCharacters()` 恒空 → render 永远早退，这是该文件覆盖率全仓最低的机制性原因） | `d521937` |
> | `05a-modcheat-rows.js` | L118 / L268 | 注入 `setup.mbCE_modCheats` 两条注册项；空声明模组走 renderModCheatDetail 四组全空提示 | `4819cbd` |
> | `08-npc-traits2.js` | L125 / L126 / L255 / L257 | 注入 `V.templePromised` / `V.temple_rank` 后点全局页签；`acItems` 六 key 里 `clean` 无专属 else-if ⇒ 首次开启落 L255 兜底，再点关闭走 L257 | `f45908d` |
> | `07a-shell2.js` | L202 / L235 | 压 210 条 `mbCEPushError` 触发「1 分钟 ≥200 条」全局熔断（阈值 07a-shell2.js:179），再点开 `.mce-errbtn` 渲染熔断提示；`open()` 内调 `mbCEHookErrors()`（09-exports2.js:36），二次 open 即命中幂等闸 | `25e9d73` |
>
> **已判结构性不可达并删除（取证写进断言，不伪造输入）**
> - `05a:115 if (!m.declared)`：`normalizeCheatMod` 强制 `declared: true`（04c-modcheat-util.js:4），而唯一写 `declared:false` 的 `CHEAT_PASSIVE_PROBES`（03d-global-modzh.js:122）建空数组后全仓无任何 push ⇒ `declared:false` 输入域为空。**已删除**守卫（未声明项只展示提示 / 已声明项绑点击），改为直接绑点击，原地留注释写明「若被动探针被填充必须恢复该守卫」；`tests/plain_branches.js` 保留 `getCheatMods()` 全体 `declared===true` 的输入域取证断言作为删除前提（断言变红即说明必须回滚该删除），标题同步改口径。
> - `05a:252 if (pend.length <= MOD_ROW_BATCH)`：分片入口条件是 `pend.length > MOD_ROW_BATCH_LIMIT(60)`，`<= 40` 永不成立。**已删除**（连同其内的 failed 提示块）：首批与后续分片失败统一由 `modRowStep:30` 按 `t.failed` 提示，提示语义与文案不变；删除后 `Branches 81.6%（5693/6976）`、产物 978,507 B / `E18A1981…`。
> - `actCheat`（05a 内）两层恒真判定：原 `if (modId && key) { …… return; }` 包住整块局部刷新，其后 `if (modId) { renderModCheatDetail(modId); }`。取证双向：① 13 个调用点（`05a2-modcheat-rows-build.js:85/87/113/115/117/127/157/159/161/185/192/218/222`）一律传 `m.modId` 与 `"tasks:"+t.key` 这类带前缀字面拼接（`key` 至少含前缀故恒非空）；② `m.modId` 由 `getCheatMods` 三源过滤空 id 保证（`05a2:8` 注册项 / `05a2:22` 被动探针 / 适配器 entry 经 `04c normalizeCheatMod` 透传）。**已删除**两层判定：`pane` 提升到函数体、末尾无条件 `renderModCheatDetail(modId)`，原地留注释写明恢复条件（出现无 modId 或无 key 的调用形态时须恢复）。等价性由 `tests/modcheat_ui_state.js` 第 3 节新增断言守护：摘掉 `tasks:t1` 行后点其「跳过任务」→ 不抛且仍停在子页（即 `refreshModRow` 落空后走兜底重建），该断言在**旧码即绿**（证明等价），改后仍绿。删除后 `Branches 81.65%（5699/6979）`、产物 **979,581 B / `6C90D3155C1B0B12`**、zip **313,942 B / `4BB613E2…`**。
> - **口径校正（重要）**：c8 的 branches 分母**不是纯静态**——未被执行的函数其分支条目不进入统计（`npx c8 --include=javascript/maplebirchce.js node tests/test_mce.js` 单测只得 `3010/4506`）。故本轮 `6975 → 6979` 不能与「删了 4 个判定点」直接对消，也不能据此判断覆盖率升降；跨轮比较只应看两件事：源码 diff 里判定点确已消失、`report_branch_gaps.js` 里该分片未覆盖数不升（本轮 05a 已不在未覆盖 top 15）。
>
> **剩余未补的三类（本轮停在这里的原因：每条只值 1 分支，构造与验证成本高）**
> 1. **时序类**：`05b2-modcheat-attitude.js:133/L135` 只在 `setInterval(1000ms)` 回调里命中；测试须真等 1 秒并观察定时器对 DOM 的副作用，拖慢门禁且引入时序脆弱性。
> 2. **未导出入口**：`07d-places.js:130/L139`（`mbCEHasUsableLinks` / `mbCEArrivalCheck` 只在直达后 250ms `setTimeout` 内被调用）、`renderGlobal`、`mbCEHookErrors` 等无导出，只能经页签/二次 open 一类间接路径，其余无稳定路径。
> 3. **null 变量类**：`07a-shell2.js:132/L199/L219`、`08-npc-traits2.js:19`、`09-exports.js:4`——被检查的 DOM 引用与模块变量都在 `ensureDom()` 里赋值，`close()` 只移除节点不清变量，且 `ensureDom` 在 `root` 仍挂 body 时不重建被移除的子 pane（09-exports.js:67）⇒ 测试无法把已赋值的变量重新置空。
>
> 复现本轮数字：`npx c8 --include=javascript/maplebirchce.js --reporter=text-summary --check-coverage --lines 90 --branches 80 --functions 95 node tools/run_coverage_par.js --groups auto`。

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