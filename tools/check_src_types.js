#!/usr/bin/env node
/**
 * src 侧类型分账（P3）
 *
 * 为什么不能直接 tsc 每个 src 片段：src/*.js 是被 build_js.js 拼进同一个 IIFE 的片段
 * （00-preamble.js 开括号、09-exports2.js 收括号），单独编译必然出现跨片段的
 * "Cannot find name" 与括号不平衡，产出的是结构性噪声而非缺陷信号。
 *
 * 所以这里做的是「按 manifest 拼出一份与产物字节相同的联合文件 → 严格模式（strict:true）
 * 类型检查 → 把错误位置按行区间映射回具体 src 文件 → 与基线做棘轮」：
 *   - 产物侧 tsconfig.json 仍是 strict:false、0 错误（原有门禁不变）；
 *   - 本工具在 strict:true 下把已有的 141 条历史债务按文件记账，任何文件错误数上升
 *     （新代码引入 / 旧代码改坏）即 exit 1；只允许下降。
 *   - 顺带做一次「src 与产物同步」硬校验：拼接 SHA 必须等于 javascript/maplebirchce.js，
 *     否则说明源码改了没重建产物，先跑 node tools/build_js.js。
 *
 * 用法：
 *   node tools/check_src_types.js                  # 棘轮校验（门禁用）
 *   node tools/check_src_types.js --write-baseline  # 债务下降后收窄基线（评审可见）
 * 环境变量：MCE_SRC_DIR / MCE_PKG_JS / MCE_SRC_TS_BASELINE（仅供负控沙箱使用）
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = process.env.MCE_SRC_DIR || path.join(ROOT, "javascript", "src");
const PKG_JS = process.env.MCE_PKG_JS || path.join(ROOT, "javascript", "maplebirchce.js");
const BASELINE = process.env.MCE_SRC_TS_BASELINE || path.join(ROOT, "tools", "src-types-baseline.json");
const UNITED_DIR = path.join(ROOT, "tools", "_srctypes");
const UNITED = path.join(UNITED_DIR, "src-united.js");
const TSCONFIG = path.join(ROOT, "tsconfig.src.json");

function fail(msg) {
  console.error("FAIL: " + msg);
  process.exit(1);
}

/* ---------- 1. 按 manifest 拼接（与 build_js.js 同语义：纯字符串相加、段末必须有换行） ---------- */
const manifestPath = path.join(SRC_DIR, "manifest.json");
if (!fs.existsSync(manifestPath)) { fail(manifestPath + " 缺失，段序无真源；先跑 node tools/build_js.js --write-manifest"); }
let manifest;
try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch (e) { fail("manifest.json 非法 JSON：" + e.message); }
if (!manifest || !Array.isArray(manifest.segments) || !manifest.segments.length) { fail("manifest.segments 缺失或为空"); }

let out = "";
const ranges = [];
let line = 1;
const noNl = [];
const segs = manifest.segments.map((s) => s.file);
segs.forEach((f) => {
  const p = path.join(SRC_DIR, f);
  if (!fs.existsSync(p)) { fail("manifest 登记的段不存在：" + f); }
  let text = fs.readFileSync(p, "utf8");
  if (!text.endsWith("\n")) { text += "\n"; noNl.push(f); }
  const n = (text.match(/\n/g) || []).length;
  ranges.push({ file: f, start: line, end: line + n - 1 });
  line += n;
  out += text;
});
if (noNl.length) { fail("以下段缺末尾换行（拼接会吞掉下一段首行）：" + noNl.join(", ")); }

if (!fs.existsSync(PKG_JS)) { fail("产物不存在：" + PKG_JS + "，先跑 node tools/build_js.js"); }
const product = fs.readFileSync(PKG_JS, "utf8");
const srcSha = crypto.createHash("sha256").update(out).digest("hex");
const pkgSha = crypto.createHash("sha256").update(product).digest("hex");
if (srcSha !== pkgSha) {
  fail("src 拼接 SHA 与产物不一致（src=" + srcSha.slice(0, 12) + " pkg=" + pkgSha.slice(0, 12) + "）——源码改了没重建产物，先跑 node tools/build_js.js");
}

fs.mkdirSync(UNITED_DIR, { recursive: true });
fs.writeFileSync(UNITED, out, "utf8");

/* ---------- 2. tsc 严格模式检查 ---------- */
const tscBin = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
if (!fs.existsSync(tscBin)) {
  console.log("WARN: typescript 未安装（npm ci 后启用），src 类型分账跳过");
  process.exit(0);
}
const run = spawnSync(process.execPath, [tscBin, "-p", TSCONFIG, "--pretty", "false"], { cwd: ROOT, encoding: "utf8" });
const raw = (run.stdout || "") + (run.stderr || "");
const errs = [];
raw.split(/\r?\n/).forEach((l) => {
  const m = /^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(l.trim());
  if (m) { errs.push({ file: path.basename(m[1]), line: Number(m[2]), code: m[4], msg: m[5] }); }
});
if (run.status !== 0 && errs.length === 0) {
  fail("tsc 非 0 退出但未解析到错误行（配置/编译崩溃），原始输出：\n" + raw.slice(0, 4000));
}

/* ---------- 3. 按行区间映射回 src 文件 ---------- */
/* 噪声码：未加类型注解的 JS 在 strict 下的隐式 any 家族（TS7006 参数 / TS7005 变量 / TS7034 隐式 any[]
   / TS7053 隐式下标 / TS7023 返回隐式 any）。这些不是缺陷信号，全部计入基线只会把真债务淹没，
   所以只打印参考量，不参与棘轮；棘轮只对「真债务」（属性不存在、可能 undefined、类型不匹配等）记账。 */
const NOISE_CODES = ["TS7006", "TS7005", "TS7034", "TS7053", "TS7023"];
const byFile = {};
let unmapped = 0, noise = 0;
errs.forEach((e) => {
  if (NOISE_CODES.indexOf(e.code) !== -1) { noise++; return; }
  let owner = null;
  for (const r of ranges) { if (e.line >= r.start && e.line <= r.end) { owner = r.file; break; } }
  if (!owner) { owner = "(types)"; if (e.file.indexOf("types") === -1) { unmapped++; } }
  byFile[owner] = byFile[owner] || { total: 0, codes: {}, samples: [] };
  byFile[owner].total++;
  byFile[owner].codes[e.code] = (byFile[owner].codes[e.code] || 0) + 1;
  if (byFile[owner].samples.length < 3) {
    const off = e.line - (ranges.find((r) => r.file === owner) ? ranges.find((r) => r.file === owner).start : 0) + 1;
    byFile[owner].samples.push("L" + off + " " + e.code + " " + e.msg.slice(0, 90));
  }
});

/* ---------- 4. 基线棘轮 ---------- */
const sortedFiles = {};
Object.keys(byFile).sort().forEach((k) => { sortedFiles[k] = byFile[k]; });
const curTotal = Object.keys(sortedFiles).reduce((a, k) => a + sortedFiles[k].total, 0);
const snapshot = {
  version: 1,
  note: "src 侧 strict 模式「真债务」基线（棘轮：只减不增）。隐式 any 家族（TS7006/7005/7034/7053/7023）不计账。新增债务请修代码，不要直接改写本文件；确需调整时用 --write-baseline 并在评审中说明。",
  updatedAt: new Date().toISOString().slice(0, 10),
  strict: true,
  total: curTotal,
  noiseCodes: NOISE_CODES,
  files: {}
};
Object.keys(sortedFiles).forEach((k) => { snapshot.files[k] = { total: sortedFiles[k].total, codes: sortedFiles[k].codes }; });

const writeBaseline = process.argv.indexOf("--write-baseline") !== -1;
if (writeBaseline) {
  fs.writeFileSync(BASELINE, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log("baseline written: " + BASELINE + "  (" + Object.keys(sortedFiles).length + " 文件 / " + curTotal + " 条)");
  Object.keys(sortedFiles).sort((a, b) => sortedFiles[b].total - sortedFiles[a].total).forEach((k) => {
    console.log("  " + String(sortedFiles[k].total).padStart(4) + "  " + k + "  " + Object.keys(sortedFiles[k].codes).sort().map((c) => c + "×" + sortedFiles[k].codes[c]).join(" "));
  });
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) { fail(BASELINE + " 缺失；先跑 node tools/check_src_types.js --write-baseline 生成并提交"); }
let base;
try { base = JSON.parse(fs.readFileSync(BASELINE, "utf8")); } catch (e) { fail("基线 JSON 非法：" + e.message); }
const baseFiles = base.files || {};
const problems = [];

Object.keys(sortedFiles).forEach((k) => {
  const cur = sortedFiles[k].total;
  const old = baseFiles[k] ? baseFiles[k].total : 0;
  if (cur > old) {
    problems.push("+" + (cur - old) + " 条：" + k + "（基线 " + old + " → 现在 " + cur + "）" +
      (sortedFiles[k].samples.length ? "\n      " + sortedFiles[k].samples.join("\n      ") : ""));
  }
});
Object.keys(baseFiles).forEach((k) => { if (!sortedFiles[k]) { problems.push("债务下降：" + k + "（" + baseFiles[k].total + " → 0，可用 --write-baseline 收窄）"); } });
if (typeof base.total === "number" && curTotal > base.total) {
  problems.push("总数上升：" + base.total + " → " + curTotal);
}

if (problems.length) {
  problems.forEach((p) => console.error("  [债务上升] " + p));
  fail("src 侧 strict 类型债务超出基线（修代码，不要放宽基线）");
}

console.log("src 类型分账 OK: " + Object.keys(sortedFiles).length + " 个 src 段 / " + curTotal + " 条 strict 真债务（基线 " + (base.total || 0) + "，棘轮未上升；隐式 any 噪声 " + noise + " 条不计账）");
const top = Object.keys(sortedFiles).sort((a, b) => sortedFiles[b].total - sortedFiles[a].total).slice(0, 5);
top.forEach((k) => { console.log("  " + String(sortedFiles[k].total).padStart(4) + "  " + k); });
if (unmapped) { console.log("  注：另有 " + unmapped + " 条错误落在 types/ 或无法映射的行区间"); }
if (srcSha) { console.log("  拼接 SHA " + srcSha.slice(0, 12) + " == 产物 SHA（src/产物同步）"); }
process.exit(0);
