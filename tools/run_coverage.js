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
  "tests/stability_loop.js"
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
