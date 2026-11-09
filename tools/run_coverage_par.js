/*
 * 覆盖率分组并行运行器（方案② 试跑版）。
 *
 * 原理：c8 通过 NODE_V8_COVERAGE 让 node 在退出时落 coverage-<pid>-<seq>.json；
 *      多个子进程共用同一目录不会互相覆盖（文件名带 pid），c8 report 一次读全部并合并。
 *      所以「分组并行」不需要自实现合并逻辑，只要各子进程都继承外层 env（env: process.env）即可。
 * 语义：任一测试非 0 退出 → 整体 exit 1（fail-closed，不因并行而放过失败）。
 * 用法：
 *   node tools/run_coverage_par.js --serial      串行对照（等价旧 run_coverage.js，多逐项计时）
 *   node tools/run_coverage_par.js [--groups N|auto]
 *                                                并行 N 组；缺省 auto = 逻辑核数折半、上限 4
 * 前置：外层必须是 c8（`npm run coverage:gate` 会带），否则只跑测试、不产覆盖率。
 * 日志：每组落 %TEMP%\mce_cov_par_<组>.log，终端只打摘要（避免两组输出交错）。
 */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { TESTS } = require("./coverage_tests");

const ROOT = path.join(__dirname, "..");
const TMP = process.env.TEMP || process.env.TMPDIR || os.tmpdir();

/* 逐测试实测耗时（2026-11-09 本机 Intel Core Ultra 5 125H / 18 逻辑核，带 MCE_DOL_HTML，
   由 --serial 模式跑出来）。含每进程启动 + V8 flush 开销（约 +0.5 s/测试），用于 LPT 相对均衡足够。
   机器换了要重测：node tools/run_coverage_par.js --serial 会打印新表。 */
const EST_MS = {
  "tests/smoke_dom.js": 33950,
  "tests/test_keycheck.js": 9360,
  "tests/functional_e2e.js": 8311,
  "tests/coverage_negative_noframework.js": 5163,
  "tests/coverage_negative.js": 4936,
  "tests/stability_loop.js": 4855,
  "tests/lock_resume.js": 3759,
  "tests/traits_ui_state.js": 3682,
  "tests/pins_state_machine.js": 3043,
  "tests/scenes_page_state.js": 2767,
  "tests/lock_panel_state.js": 2632,
  "tests/attitude_state.js": 2625,
  "tests/undo_center_state.js": 2507,
  "tests/places_stage_state.js": 2485,
  "tests/quick_panel_state.js": 2468,
  "tests/undo_center_edges_state.js": 2444,
  "tests/yanling_state.js": 2395,
  "tests/fert_kids_state.js": 2380,
  "tests/modcheat_ui_state.js": 2373,
  "tests/pins_hook_state.js": 2348,
  "tests/yanling_actions_state.js": 2329,
  "tests/mod_actions_batch_state.js": 2327,
  "tests/maintain_state.js": 2313,
  "tests/combat_transform_state.js": 2289,
  "tests/adapter_actions.js": 2281,
  "tests/adapters_negative_state.js": 2262,
  "tests/traits_eval_state.js": 2249,
  "tests/romance_stage_state.js": 2246,
  "tests/test_mce.js": 709,
  "tests/integration_gender.js": 643,
  "tests/test_adapter_matrix.js": 373
};

function parseArgs(argv) {
  /* groups=0 表示 auto：按逻辑核数折半取组数、上限 4（本机 18 逻辑核 → 4 组）；
     2 核 CI runner → 2 组；单核 → 1 组（退化为串行）。避免固定 4 组在 2 核上 CPU 超订。 */
  const a = { serial: false, groups: 0 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--serial") a.serial = true;
    else if (argv[i] === "--groups") {
      const v = argv[++i];
      a.groups = v === "auto" ? 0 : Math.max(1, Number(v) || 1);
    }
  }
  if (a.serial) a.groups = 1;
  if (a.groups === 0) a.groups = Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)));
  return a;
}

function spawnTest(t, logPath) {
  return new Promise((resolve) => {
    const fd = fs.openSync(logPath, "a");
    fs.writeSync(fd, "\n=== " + t + " ===\n");
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join(ROOT, t)], {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", fd, fd]
    });
    p.on("exit", (code, signal) => {
      try { fs.closeSync(fd); } catch (e) { /* 已关闭 */ }
      resolve({ t, code, signal, ms: Date.now() - t0 });
    });
  });
}

async function runGroup(label, tests) {
  const logPath = path.join(TMP, "mce_cov_par_" + label + ".log");
  fs.writeFileSync(logPath, "");
  const rows = [];
  for (const t of tests) {
    rows.push(await spawnTest(t, logPath));
  }
  return { label, rows, logPath };
}

/* LPT（最长处理时间优先）贪心装箱：先把最慢的测试放进当前最空的一组。
   无耗时数据时退化为轮转（i % n），保证分布不退化成一堆一组。 */
function splitGroups(n, tests, est) {
  if (n === 1) return [tests];
  const haveEst = tests.some((t) => est[t] > 0);
  if (!haveEst) {
    const bins = Array.from({ length: n }, () => []);
    tests.forEach((t, i) => bins[i % n].push(t));
    return bins;
  }
  const bins = Array.from({ length: n }, () => ({ tot: 0, tests: [] }));
  [...tests].sort((a, b) => (est[b] || 0) - (est[a] || 0)).forEach((t) => {
    bins.sort((x, y) => x.tot - y.tot);
    bins[0].tests.push(t);
    bins[0].tot += est[t] || 0;
  });
  return bins.map((b) => b.tests);
}

function fmt(ms) {
  return (ms / 1000).toFixed(1) + "s";
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const bins = splitGroups(args.groups, TESTS, EST_MS);
  const labels = bins.map((_, i) => String.fromCharCode(65 + i));

  console.log("覆盖率分组运行器： " + TESTS.length + " 个测试 / " + args.groups + " 组"
    + (args.serial ? "（串行对照）" : ""));
  const t0 = Date.now();

  const results = await Promise.all(bins.map((tests, i) => runGroup(labels[i], tests)));
  const wall = Date.now() - t0;

  let failedTotal = 0;
  const serialSum = [];
  for (const r of results) {
    const fail = r.rows.filter((x) => x.code !== 0);
    failedTotal += fail.length;
    const wallMs = r.rows.reduce((s, x) => s + x.ms, 0);
    serialSum.push(wallMs);
    console.log("\n--- [" + r.label + "] " + r.rows.length + " 个测试 / 失败 " + fail.length
      + " / 组内合计 " + fmt(wallMs) + " / 日志 " + r.logPath + " ---");
    for (const x of r.rows) {
      const tag = x.code === 0 ? "OK  " : "FAIL(" + (x.code === null ? x.signal : x.code) + ")";
      console.log("  " + tag + " " + String(x.ms).padStart(7) + " ms  " + x.t);
      if (args.serial) serialSum.push("");
    }
  }

  const sumAll = serialSum.filter((x) => typeof x === "number").reduce((a, b) => a + b, 0);
  console.log("\n=== 汇总 ===");
  console.log("串行合计（各测试耗时相加）: " + fmt(sumAll));
  console.log("并行墙钟: " + fmt(wall) + (args.groups > 1 ? "  → 加速 " + (sumAll / wall).toFixed(2) + "x" : ""));

  if (args.serial) {
    console.log("\n--- 耗时表（可直接粘进 EST_MS） ---");
    console.log("{");
    for (const r of results) {
      for (const x of r.rows) console.log("  \"" + x.t + "\": " + x.ms + ",");
    }
    console.log("}");
  }

  if (failedTotal) {
    console.error("\nCOVERAGE PAR RUN FAILED: " + failedTotal + " 个测试未通过（详见各组日志）");
    process.exit(1);
  }
  console.log("\nCOVERAGE PAR RUN: ALL TESTS PASSED");
})();
