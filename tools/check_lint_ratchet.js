#!/usr/bin/env node
/* 复杂度 / 遮蔽 / 未使用变量 的存量棘轮（v2.1.5 落地，对应 2026-11-14 四维审查「可维护性」缺口）
 *
 * 为什么要独立脚本而不是直接往 eslint.config.js 加规则：
 *   项目 eslint.config.js 只做 10 条确定性错误检查（注释明写不检风格），run_all 第 3 步直接调
 *   `eslint javascript/maplebirchce.js` 且不带 --max-warnings —— 若把那三条规则加进项目配置并设为
 *   warn，run_all 日志会平白多出 2,700+ 条告警（no-var 2,532 / complexity 158 / 其余），噪声淹没
 *   真正有意义的输出，且 warn 不阻断等于没门禁。
 *   本脚本用独立的 overrideConfig 单独统计四项存量，与基线比对，只减不增：存量固定（不要求也不
 *   允许本轮清存量，避免把风格迁移混进功能改动），新代码一旦让任一项上涨即 exit 1。
 *
 * 统计口径（与 2026-11-14 审查用的临时 probe 完全一致，保证数字可比）：
 *   complexity            > 10 的函数数
 *   no-shadow             同名遮蔽处数
 *   no-unused-vars        args:none / vars:all / caughtErrors:none（剔除 catch 参数误报，审查时 397 条）
 *   max-lines-per-function > 120 行的函数数
 *
 * 用法：
 *   node tools/check_lint_ratchet.js                  # 校验，超基线 exit 1
 *   node tools/check_lint_ratchet.js --write-baseline # 重写基线（须在评审中说明原因）
 *   node tools/check_lint_ratchet.js --json           # 只打印实测值（供人看）
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGET = "javascript/maplebirchce.js";
const BASELINE_FILE = path.join(__dirname, "lint-ratchet.json");

/* 与审查 probe 同口径；ecmaVersion 2018 / script 与项目产物形态一致 */
const CONFIG = {
  languageOptions: { ecmaVersion: 2018, sourceType: "script" },
  rules: {
    complexity: ["warn", 10],
    "no-shadow": "warn",
    "no-unused-vars": ["warn", { args: "none", vars: "all", caughtErrors: "none" }],
    "max-lines-per-function": ["warn", { max: 120 }]
  }
};

const KEYS = ["complexity", "no-shadow", "no-unused-vars", "max-lines-per-function"];

async function measure() {
  let ESLint;
  try {
    ESLint = require(path.join(ROOT, "node_modules", "eslint")).ESLint;
  } catch (e) {
    console.error("SKIP: eslint 未安装（npm install 后可启用棘轮）");
    process.exit(0);
  }
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: CONFIG, cwd: ROOT });
  const results = await eslint.lintFiles([TARGET]);
  const counts = {};
  KEYS.forEach(function (k) { counts[k] = 0; });
  const detail = {};
  results.forEach(function (r) {
    r.messages.forEach(function (m) {
      if (!m.ruleId || KEYS.indexOf(m.ruleId) === -1) { return; }
      counts[m.ruleId]++;
      if (!detail[m.ruleId]) { detail[m.ruleId] = []; }
      if (detail[m.ruleId].length < 5) { detail[m.ruleId].push(m.line + ":" + m.column + " " + m.message); }
    });
  });
  return { counts: counts, detail: detail };
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) { return null; }
  try { return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")); } catch (e) { return null; }
}

(async function main() {
  const args = process.argv.slice(2);
  const m = await measure();

  if (args.indexOf("--json") >= 0) {
    console.log(JSON.stringify(m.counts, null, 2));
    return;
  }

  if (args.indexOf("--write-baseline") >= 0) {
    const data = {
      note: "复杂度 / 遮蔽 / 未使用变量的存量基线（棘轮：只减不增）。由 tools/check_lint_ratchet.js --write-baseline 生成；上调必须在评审中说明原因。",
      updatedAt: new Date().toISOString().slice(0, 10),
      target: TARGET,
      baseline: m.counts
    };
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log("基线已写: " + BASELINE_FILE);
    KEYS.forEach(function (k) { console.log("  " + k + " = " + m.counts[k]); });
    return;
  }

  const base = readBaseline();
  if (!base || !base.baseline) {
    console.error("FAIL: " + BASELINE_FILE + " 缺失或格式不对；先跑 node tools/check_lint_ratchet.js --write-baseline");
    process.exit(1);
  }

  let fails = 0, warnings = 0;
  KEYS.forEach(function (k) {
    const cur = m.counts[k], ref = typeof base.baseline[k] === "number" ? base.baseline[k] : 0;
    if (cur > ref) {
      fails++;
      console.error("FAIL: " + k + " " + cur + " > 基线 " + ref + "（新增 " + (cur - ref) + " 处，棘轮只减不增）");
      (m.detail[k] || []).forEach(function (d) { console.error("    " + d); });
    } else if (cur < ref) {
      warnings++;
      console.log("WARN: " + k + " " + cur + " < 基线 " + ref + "（存量已下降，可跑 --write-baseline 下调基线）");
    } else {
      console.log("ok   " + k + " " + cur + " == 基线 " + ref);
    }
  });

  if (fails) {
    console.error("\n棘轮校验未通过：" + fails + " 项超基线。新代码请消除新增项，或确属必要改动时在评审中说明并下调存量。");
    process.exit(1);
  }
  console.log("\nOK: 复杂度/遮蔽/未使用变量 四项均未超基线" + (warnings ? "（" + warnings + " 项存量下降待下调）" : ""));
})();
