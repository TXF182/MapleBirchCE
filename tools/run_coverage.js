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
  "tests/test_adapter_matrix.js"
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
