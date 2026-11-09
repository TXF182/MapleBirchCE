/*
 * 覆盖率聚合运行器（串行基线）：依次跑全部测试，供 c8 收集跨进程覆盖率。
 * 用法：npm run coverage
 *   = c8 --include=javascript/maplebirchce.js node tools/run_coverage.js
 * 任一测试非 0 退出 → 整体 exit 1（fail-closed，不因覆盖率好看而放过失败）。
 * 测试序列与逐项职责注释见 tools/coverage_tests.js（与并行版 run_coverage_par.js 共用同一真源）。
 * 说明：test_mce.js 用 eval 执行产物，已加 //# sourceURL 归因，否则 V8 覆盖率无法映射回文件。
 */
"use strict";
const path = require("path");
const { spawnSync } = require("child_process");
const { TESTS } = require("./coverage_tests");

const ROOT = path.join(__dirname, "..");

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
