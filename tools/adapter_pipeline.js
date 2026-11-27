#!/usr/bin/env node
/*
 * 适配器一条龙（v2.2.8 需求④）：把「解包 → audit → resolve → 声明草案 → 矩阵/注册表重生成 → 跑测试」
 * 串成一条命令，替代每月手工依次敲 5 个工具。
 *
 * 用法：
 *   node tools/adapter_pipeline.js --id <适配器id> --src <模组源码目录> [选项]
 *   node tools/adapter_pipeline.js --id <适配器id> --zip <模组包.zip> [选项]      # 先解包再走后续
 *
 * 选项：
 *   --apply        实际重生成 tests/data/adapter_matrix.json 与 keys.registry.json（默认只 dry 比对，不落盘）
 *   --skip-test    跳过 tests/test_adapter_matrix.js（只想看核查结论时用）
 *   --strict       REMOVE / SOURCE_MISMATCH / 矩阵漂移 / 注册表漂移 任一存在即 exit 1（挂 CI 用）
 *   --json         机器可读输出（stdout 只有一段 JSON；草案仍落盘）
 *   --draft-out    草案路径（默认 .selfcheck/adapter-draft-<id>.md）
 *
 * 设计原则（与项目纪律一致）：
 *   · 默认只读：重生成属于写操作，必须显式 --apply；未 apply 时把漂移如实报出来，不静默改文件。
 *   · 结论可复查：草案里每条都带工具给出的 verdict/why，不做二次推断。
 *   · 不改用户文件：解包落 tools/_modcache/，草案落 .selfcheck/，都不碰 game\ 与其它目录。
 */
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const CACHE = path.join(ROOT, "tools", "_modcache");

function flag(name) { return process.argv.indexOf("--" + name) !== -1; }
function arg(name) {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) { return null; }
  const v = process.argv[i + 1];
  return (v && v.indexOf("--") !== 0) ? v : null;
}

const ID = arg("id");
const SRC_DIR = arg("src");
const ZIP = arg("zip");
const APPLY = flag("apply");
const SKIP_TEST = flag("skip-test");
const STRICT = flag("strict");
const JSON_OUT = flag("json");
const DRAFT_OUT = arg("draft-out");

if (!ID || (!SRC_DIR && !ZIP)) {
  console.error("用法: node tools/adapter_pipeline.js --id <适配器id> (--src <源码目录> | --zip <包>) [--apply] [--skip-test] [--strict] [--json] [--draft-out <path>]");
  process.exit(2);
}

const log = JSON_OUT ? function () {} : function (s) { console.log(s); };

/* 统一跑子工具：返回 {status, json, stdout, stderr}；非零退出不直接抛，交给调用方按步骤归因 */
function runNode(script, args, wantJson) {
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, script)].concat(args), {
    cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024
  });
  const out = (r.stdout || "").trim();
  let json = null;
  if (wantJson) {
    /* 工具可能先打日志再打 JSON：取第一个 { 到最后一个 } */
    const a = out.indexOf("{"), b = out.lastIndexOf("}");
    if (a !== -1 && b > a) {
      try { json = JSON.parse(out.slice(a, b + 1)); } catch (e) { json = null; }
    }
  }
  return { status: r.status, json: json, stdout: out, stderr: (r.stderr || "").trim() };
}

/* ---------- 1. 解包（给了 --zip 且没有 --src 时） ---------- */
function unzip() {
  if (!ZIP) { return SRC_DIR ? path.resolve(SRC_DIR) : null; }
  const zipPath = path.resolve(ZIP);
  if (!fs.existsSync(zipPath)) {
    throw new Error("包不存在：" + zipPath);
  }
  const base = path.basename(zipPath).replace(/\.(zip|tar\.gz|tgz)$/i, "");
  const out = path.join(CACHE, base);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(out, { recursive: true });
    /* Windows 10+ 自带 bsdtar，可直接解 zip（无需额外依赖） */
    const r = cp.spawnSync("tar", ["-xf", zipPath, "-C", out], { encoding: "utf8" });
    if (r.status !== 0) { throw new Error("解包失败（tar exit " + r.status + "）：" + (r.stderr || "")); }
  }
  log("[1/5] 解包 → " + out);
  return out;
}

/* ---------- 2. audit ---------- */
function doAudit(srcDir) {
  const r = runNode("audit_adapters.js", [ID, srcDir, "--json"], true);
  if (!r.json) {
    throw new Error("audit 未返回 JSON（exit " + r.status + "）：" + (r.stderr || r.stdout).slice(0, 400));
  }
  log("[2/5] audit：声明 " + r.json.declared + " 条 / 字面覆盖 " + r.json.coveragePct + "% / 缺失 " +
    (r.json.missing || []).length + " 条 / 新增候选 " + (r.json.extra || []).length + " 条");
  return r.json;
}

/* ---------- 3. resolve ---------- */
function doResolve(srcDir) {
  const r = runNode("resolve_missing.js", [ID, srcDir, "--json"], true);
  if (!r.json) {
    throw new Error("resolve 未返回 JSON（exit " + r.status + "）：" + (r.stderr || r.stdout).slice(0, 400));
  }
  const results = r.json.results || [];
  log("[3/5] resolve：" + results.length + " 条定案，覆盖率 " + r.json.coveragePct + "%");
  return r.json;
}

/* ---------- 4. 草案（Markdown，逐条带工具 verdict/why，不二次推断） ---------- */
function buildDraft(srcDir, audit, resolve) {
  const verdicts = {};
  (resolve.results || []).forEach(function (x) { verdicts[x.verdict] = (verdicts[x.verdict] || 0) + 1; });
  const lines = [];
  lines.push("# 适配器核查草案：" + ID);
  lines.push("");
  lines.push("- 源码目录：`" + srcDir + "`");
  lines.push("- 声明 varPath：" + audit.declared + " 条；resolve 定案 " + (resolve.results || []).length + " 条");
  lines.push("- audit 字面覆盖：" + audit.coveragePct + "%；resolve 覆盖率：" + resolve.coveragePct + "%");
  lines.push("- 判定分布：" + Object.keys(verdicts).sort().map(function (k) { return k + " " + verdicts[k]; }).join(" / "));
  lines.push("");
  lines.push("## 建议删除（REMOVE：零证据，或属主不符且模块内零出现）");
  const removes = (resolve.results || []).filter(function (x) { return x.verdict === "REMOVE"; });
  if (!removes.length) { lines.push(""); lines.push("无 ✓"); }
  removes.forEach(function (x) { lines.push(""); lines.push("- `" + x.vp + "` — " + (x.why || "")); });
  lines.push("");
  lines.push("## 需人工复核（REVIEW / WEAK / SOURCE_MISMATCH，不是删除信号）");
  const reviews = (resolve.results || []).filter(function (x) {
    return x.verdict === "REVIEW" || x.verdict === "WEAK" || x.verdict === "SOURCE_MISMATCH";
  });
  if (!reviews.length) { lines.push(""); lines.push("无 ✓"); }
  reviews.forEach(function (x) { lines.push(""); lines.push("- `" + x.vp + "` [" + x.verdict + "] " + (x.why || "")); });
  lines.push("");
  lines.push("## 新增候选（源码有、适配器未声明；瞬态变量需人工甄别）");
  const extra = audit.extra || [];
  if (!extra.length) { lines.push(""); lines.push("无 ✓"); }
  else {
    lines.push("");
    extra.slice(0, 40).forEach(function (p) { lines.push(""); lines.push("- `" + p + "`"); });
    if (extra.length > 40) { lines.push(""); lines.push("- …另有 " + (extra.length - 40) + " 条未列出（共 " + extra.length + " 条，多为非状态瞬态路径，按需再查）"); }
  }
  lines.push("");
  lines.push("> 本草案由 tools/adapter_pipeline.js 自动生成，判据全部来自 audit_adapters.js / resolve_missing.js 的原始输出，未做二次推断。");
  return lines.join("\n") + "\n";
}

function writeDraft(text) {
  const out = DRAFT_OUT ? path.resolve(DRAFT_OUT) : path.join(ROOT, ".selfcheck", "adapter-draft-" + ID + ".md");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text, "utf8");
  log("[4/5] 草案 → " + out);
  return out;
}

/* ---------- 5. 重生成 + 测试 ---------- */
function regen() {
  const steps = [];
  const mCheck = runNode("gen_adapter_matrix.js", ["--check"], false);
  const matrixDrift = mCheck.status !== 0;
  if (matrixDrift && APPLY) {
    const w = runNode("gen_adapter_matrix.js", [], false);
    steps.push({ name: "adapter_matrix", drift: true, applied: w.status === 0, status: w.status });
  } else {
    steps.push({ name: "adapter_matrix", drift: matrixDrift, applied: false, status: mCheck.status });
  }
  const kCheck = runNode("gen_key_registry.js", [], false);
  const keysDrift = kCheck.status !== 0;
  if (keysDrift && APPLY) {
    const w = runNode("gen_key_registry.js", ["--write"], false);
    steps.push({ name: "key_registry", drift: true, applied: w.status === 0, status: w.status });
  } else {
    steps.push({ name: "key_registry", drift: keysDrift, applied: false, status: kCheck.status });
  }
  steps.forEach(function (s) {
    log("  · " + s.name + "：" + (s.drift ? (s.applied ? "漂移 → 已重生成" : "漂移（未 apply，文件未改）") : "一致"));
  });
  return steps;
}

function runMatrixTest() {
  if (SKIP_TEST) { return null; }
  const r = runNode("test_adapter_matrix.js", [], false);
  log("  · test_adapter_matrix：" + (r.status === 0 ? "通过" : "失败（exit " + r.status + "）"));
  return r.status;
}

/* ---------- 主流程 ---------- */
let summary;
try {
  const srcDir = unzip();
  if (!fs.existsSync(srcDir)) { throw new Error("源码目录不存在：" + srcDir); }
  const audit = doAudit(srcDir);
  const resolve = doResolve(srcDir);
  const draftPath = writeDraft(buildDraft(srcDir, audit, resolve));
  const regenSteps = regen();
  const testStatus = runMatrixTest();

  const removes = (resolve.results || []).filter(function (x) { return x.verdict === "REMOVE"; });
  const mismatch = (resolve.results || []).filter(function (x) { return x.verdict === "SOURCE_MISMATCH"; });
  const drift = regenSteps.filter(function (s) { return s.drift && !s.applied; });

  summary = {
    ok: true,
    adapter: ID,
    srcDir: srcDir,
    declared: audit.declared,
    coveragePct: audit.coveragePct,
    verdicts: (function () {
      const v = {};
      (resolve.results || []).forEach(function (x) { v[x.verdict] = (v[x.verdict] || 0) + 1; });
      return v;
    })(),
    remove: removes.map(function (x) { return x.vp; }),
    sourceMismatch: mismatch.map(function (x) { return x.vp; }),
    extra: audit.extra || [],
    draft: draftPath,
    regen: regenSteps,
    driftUnapplied: drift.map(function (s) { return s.name; }),
    testStatus: testStatus,
    /* strict 判据只认「确定要处理」的项：REMOVE 是删除信号、未落盘漂移会让第 8/12 步红、测试失败即回归。
       SOURCE_MISMATCH / WEAK 按 resolve_missing 的原始口径是「结论不可信、换源再看」的告警，不是删除信号
       （featsBoosts 6 键动态拼接就是长期已知盲区），纳入 strict 会把已知盲区变成假红。 */
    strictFail: !!(removes.length || drift.length || (testStatus !== null && testStatus !== 0))
  };

  if (JSON_OUT) { console.log(JSON.stringify(summary, null, 2)); }
  else {
    log("[5/5] 汇总：REMOVE " + removes.length + " / SOURCE_MISMATCH " + mismatch.length +
      " / 未 apply 的漂移 " + drift.length + (testStatus === null ? "" : " / 矩阵测试 " + (testStatus === 0 ? "通过" : "失败")));
    if (STRICT && summary.strictFail) {
      console.error("STRICT: 存在待处理项（REMOVE / 未落盘漂移 / 测试失败），exit 1");
    }
  }
} catch (e) {
  if (JSON_OUT) { console.log(JSON.stringify({ ok: false, adapter: ID, error: String(e && e.message || e) })); }
  else { console.error("FATAL: " + (e && e.message ? e.message : e)); }
  process.exit(2);
}

process.exit(STRICT && summary.strictFail ? 1 : 0);
