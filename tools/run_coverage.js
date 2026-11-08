/*
 * 覆盖率聚合运行器：依次跑全部测试，供 c8 收集跨进程覆盖率。
 * 用法：npm run coverage
 *   = c8 --include=javascript/maplebirchce.js node tools/run_coverage.js
 * 任一测试非 0 退出 → 整体 exit 1（fail-closed，不因覆盖率好看而放过失败）。
 * 说明：test_mce.js 用 eval 执行产物，已加 //# sourceURL 归因，否则 V8 覆盖率无法映射回文件。
 */
"use strict";
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TESTS = [
  "tests/smoke_dom.js",
  "tests/test_mce.js",
  "tests/functional_e2e.js",
  "tests/integration_gender.js",
  /* 2026-11-06 新增：面板开关循环回归（单例 / 节点不增长 / 淡出收敛 / 事件不重复绑定），
     挂在覆盖率序列而不是加全链步号，避免步号全量重排 */
  "tests/stability_loop.js",
  /* 2026-11-07 新增：键名核对启发式单测（lib/keycheck.js 的纯函数层）。
     原先是孤儿测试——run_all 12 步、覆盖率序列、CI 三处都不跑它，而 check_claims /
     check_key_types / check_coverage 三个工具共用这层内核，坏了没人发现。
     放在覆盖率序列里只会多跑几百毫秒，且不加载产物，不影响覆盖率数字。 */
  "tests/test_keycheck.js",
  /* 2026-11-07 新增：声明驱动矩阵回读（423 条 / 965 探针自动派生断言）。
     这一步是唯一真跑"写入→回读→undo"的执行器：morefarm / dolopt / domrobin 三个
     适配器在 tests/ 里零命中，靠它才有覆盖。 */
  "tests/test_adapter_matrix.js",
  /* 2026-11-07 新增（branches 门槛 70→80 整改轮）：负向路径专项。
     前 7 个测试几乎只走"正常路径"，未覆盖的 1,300+ 分支大多是 IF 的 else 侧，
     即「宿主缺失 / 数据缺失 / 非法入参」的拒绝分支。这两个测试专喂坏数据，
     断言"不抛 + 明确拒绝"，也是"UI 拒绝路径 / 适配器负向分支"的可执行形态。 */
  "tests/coverage_negative.js",
  /* 框架缺失：resolveMB() 会缓存框架对象，必须在全新实例里验（故独立文件） */
  "tests/coverage_negative_noframework.js",
  /* 锚定触发状态机（07f-pins*）：入队拒绝/去重/整线混合、确认条冷却与跨地点残留、
     立即触发的防重入与 used 落盘、段末清理记已完成、取消锚定、旧键迁移、直达触发。
     同时充当任务 #165「锚定触发状态机」的自动化验收面。 */
  "tests/pins_state_machine.js",
  /* FertilityExpansion 孩子页（04a-14/15/15b）：孩子列表三种形态、存活判定两道通道、phase 兜底语义、
     好感/地点/长大写入与留痕、养育/先天四项钳制、模组自带作弊 10 项执行。整改依据同 branches 门槛轮。 */
  "tests/fert_kids_state.js",
  /* 统一回退中心（08c）：12 类留痕的分发与三条「只审计不可回退」的显式拒绝、分组/全部回退计数、
     面板区块的真实点击（全部回退 / 回退本组 / 行级 / 刷新 / diff 预览开关）、空态与 24 条上限。 */
  "tests/undo_center_state.js",
  /* 恋爱/转化阶段（02-romance）：条件源码九种形态的静态解析、写入后复检、原生恋人卡槽三种形态、
     转化档位 build 差额补偿与超限钳制。 */
  "tests/romance_stage_state.js",
  /* 庄园自动维护（03b-global-maint）：幂等写入 + 首次 before 留痕、单键/全量回退、六个维护动作的门控
     （艾弗里关系 / 塔卫技能 / 技能 1000 / 火坑升级 / 房间计数）、每日调度的 localStorage 状态机。 */
  "tests/maintain_state.js",
  /* 特质求值（06b-traits-eval）：traitEval 九类表达式翻译、traitDisplayName 模板、compileVanillaTraits
     缓存、四类方向写入经 grantTrait 反证、revokeTrait 移除后复检、强制标记与收藏。本套测试同时钉住
     两个 06b 真实缺陷的回归面（includes 表达式被路径正则吃掉、isnot 字符串值写 NaN）。 */
  "tests/traits_eval_state.js",
  /* 地点阶段（07d-places2）：placeStageRead 容错、placeStageWrite 钳制/宿主拒绝/town_projects 建壳/
     首次 before 留痕、placeStageUndo 还原与删字段、阶段区 −1/+1/拉满/回退四条真实按钮路径、
     teleportTo 的段落不存在拒绝。 */
  "tests/places_stage_state.js",
  /* Mod 作弊页（05a / 05a2 / 05a3）：模组查询归一化、任务/阶段/能力/剧情/数值四组控件的真实点击与
     拒绝文案（未声明 skipVar / 无 varPath / 未知操作）、numeric 能力写 1/0 语义、搜索过滤与折叠工具。 */
  "tests/modcheat_ui_state.js",
  /* 言灵页核心（07i-yanling-core）：状态读写容错、window.isCrossdressing 钩子装卸与幂等、
     三项存量净化（数组与 Set 两种背景特质形态）、正面名声拉满幂等、1s 守卫 tick 的压回与自停、
     开关白名单与留痕 before/after。 */
  "tests/yanling_state.js",
  /* 原版态度五项直写（08b）+ 说话态度三档维持（05b2）：未知项/非法值/无 $uncomfortable 拒绝与自动建壳、
     一键全解除与全恢复、逐条回退、全局页与快速面板真实按钮路径、维持锁 prev 语义、tick 修正计数与
     暂停后不再复位、解除维持（保留 / 还原）、旧数字入口按最近锚值映射。 */
  "tests/attitude_state.js",
  /* 言灵页一键动作（07i-yanling-actions）：每条动作的「可写 / 键缺失 / 类型不对 / 前置未就绪」三态，
     NPC 槽位解析与 Gwylan / Kylar / Whitney 状态写入、Time.date 降级口径、监狱庇护枚举空串语义。 */
  "tests/yanling_actions_state.js",
  /* 剧情页（07h-render2/3）：真实 $scenes 注册表（fixture）驱动的分区/懒渲染/展开收起/锚定/一键完成/
     直达触发禁用态/空注册表说明 —— UI 拒绝路径必须真走到。 */
  "tests/scenes_page_state.js",
  /* 模组页「命令式动作」组（05a3）+ 全局批量解锁（03a-global-batch）：动作行三条拒绝路径
     （未实现 / 抛异常 / 面板渲染失败）、衣物全解锁三种 op 与坏条目守卫、食谱全解锁与重建条目。 */
  "tests/mod_actions_batch_state.js",
  /* 数值固定（07f-lock）：锁定/更新/取消、空路径与空段与非有限值三条拒绝、不存在当前值绝不造键、
     tick 强制写回与坏条目跳过、全局页面板真实点击与输入框回车提交、自定义锁定项回显。 */
  "tests/lock_panel_state.js",
  /* 战斗终结 + 扩展转化 + 格威岚花园兜底（03c-global-combat / combat2）：8 个战斗动作的写入语义
     与「对象缺失不造键」、未知 key / 动作抛错两条拒绝、扩展转化三级来源与回读判定、
     格威岚状态兜底与段名前缀判定。 */
  "tests/combat_transform_state.js",
  /* 角色页快速面板（05b-modcheat-player）：折叠组开合、$prof 缺失补壳、逐件/全部获得武器
     （喷雾补容量弹药、已持有保持现值）、应用/相对写法/回退、锁定目标非数值拒绝与取消锁定、
     一键方案（经典开局 / 全属性拉满）整组写入。 */
  "tests/quick_panel_state.js",
  /* 特质管理区（06c-traits-ui / 06d）：关键词过滤（搜索态强开组、只留匹配行）、折叠工具
     全部展开/收起、系列行阶段下拉 应用/跳至最高/回退初始、收藏置顶 ☆→★ 与取消、
     单条特质 获取/移除、数值 改数值（相对写法）/非数字拒绝/回退。 */
  "tests/traits_ui_state.js",
  /* :passageoverride / :passageinit / unfreeze 钩子（07f-pins4-hook）：庄园兜底、MOD 重放清理、
     直达出口/回触发点/分支并链、链外出口、Farm Work、链内末段线性播完与循环回点、
     队列触发（锚定项等待确认条 / 旧档项任意推进触发）、pending 消费、unfreeze 包装。 */
  "tests/pins_hook_state.js",
  /* 回退中心边界（08c-undo-center）+ 展示名解析（08e-undo-labels）：不可回退类型拒绝、
     单条分发（set/clear/append 成功与缺 path/异常）、分组与全部回退统计、区块渲染（空清单 /
     24 条上限 / 审计徽标 / 刷新 / diff 预览），以及留痕键→中文名各命名空间与兜底。 */
  "tests/undo_center_edges_state.js",
  /* 适配器负向分支（05a）：能力切换 / 剧情操作 / 数值写入的拒绝路径（模组未注册、条目缺
     varPath|skipVar|completeVar|progressVar、未知操作码、原版根拦截、parent 缺失），以及
     list / string / boolean 三条写入通道与 cheatReadSafe 异常兜底。 */
  "tests/adapters_negative_state.js",
  /* Dolonline 适配器（04a-17）+ 动作直调通道（05a3）+ 存档就绪判据 hasV（01-core）：
     detect 三种在场形态、两个动作的幂等与 ifMissing 语义、动作错误四分支、hasV 的
     window.V / State 两条来源组合。补齐该适配器的覆盖率缺口，与 run_all 第 5 步同源。 */
  "tests/adapter_actions.js"
];

let failed = 0;
for (const t of TESTS) {
  console.log("\n=== coverage runner: " + t + " ===");
  const r = spawnSync(process.execPath, [path.join(ROOT, t)], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (r.status !== 0) {
    failed++;
    console.error("FAIL " + t + " exit=" + (r.status === null ? r.signal : r.status));
  }
}

if (failed) {
  console.error("\nCOVERAGE RUN FAILED: " + failed + " 个测试未通过");
  process.exit(1);
}
console.log("\nCOVERAGE RUN: ALL TESTS PASSED");
