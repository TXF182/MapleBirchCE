/*
 * 适配器一条龙：工具契约与输出结构
 *
 * 只测「编排」这一层，不重复测 audit/resolve 自身的判定（那两个已有各自的门禁与断言）：
 *   1) 缺参数 → exit 2（不能被当成核查失败，否则调用方无法区分用法错误与结论失败）
 *   2) 真跑枯木 2.5.8 → stdout 是单段可解析 JSON，字段齐全（declared/verdicts/regen/testStatus…）
 *   3) 草案落盘且含三个分区标题（建议删除 / 需人工复核 / 新增候选）
 *   4) --strict 在「已知动态键盲区（featsBoosts 6 键 SOURCE_MISMATCH）」下不误红（exit 0）
 *
 * 用法：node tests/tools_adapter_pipeline.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = path.join(__dirname, "..");
const TOOL = path.join(ROOT, "tools", "adapter_pipeline.js");
const DW = path.join(ROOT, "tools", "_modcache", "dw258");
let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

function run(args) {
  const r = cp.spawnSync(process.execPath, [TOOL].concat(args), { cwd: ROOT, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
}

/* ---------- 1. 用法错误 ---------- */
{
  const r = run([]);
  assert(r.status === 2, "缺参数：exit 2（与核查失败的 exit 1 区分开）");
  assert(r.stderr.indexOf("用法") !== -1, "缺参数：stderr 输出用法");
  const r2 = run(["--id", "x"]);
  assert(r2.status === 2, "只给 --id 不给源码：同样 exit 2");
}

/* ---------- 2. 真实跑枯木 2.5.8（dry + 跳过矩阵测试，避免测试里再套测试） ---------- */
if (!fs.existsSync(DW)) {
  console.log("SKIP: tools/_modcache/dw258 不存在，跳过真实跑（对照源码未下载时属正常）");
} else {
  const draft = path.join(process.env.TEMP || ROOT, "mce_pipeline_test_draft.md");
  const r = run(["--id", "deadwood-reblooms", "--src", DW, "--skip-test", "--json", "--draft-out", draft]);
  assert(r.status === 0, "真实跑：exit 0（dry 模式、无 REMOVE）");
  let j = null;
  try { j = JSON.parse(r.stdout); } catch (e) { j = null; }
  assert(j !== null, "stdout 是单段可解析 JSON（日志已静默）");
  if (j) {
    assert(j.ok === true && j.adapter === "deadwood-reblooms", "JSON：ok=true 且 adapter 正确");
    assert(j.declared === 140, "JSON：声明条数取 audit 原始输出（140）");
    assert(j.verdicts && j.verdicts.KEEP > 0, "JSON：verdicts 含 KEEP 计数");
    assert(Array.isArray(j.remove) && j.remove.length === 0, "JSON：remove 为空数组（枯木 2.5.8 零删失）");
    assert(Array.isArray(j.regen) && j.regen.length === 2, "JSON：regen 两项（矩阵 + 键注册表）");
    assert(j.regen.every(function (s) { return s.drift === false; }), "JSON：矩阵/注册表均一致（未 apply 也不该有漂移）");
    assert(j.testStatus === null, "JSON：--skip-test 时 testStatus 为 null");
  }
  assert(fs.existsSync(draft), "草案已落盘到 --draft-out 指定路径");
  if (fs.existsSync(draft)) {
    const t = fs.readFileSync(draft, "utf8");
    assert(t.indexOf("## 建议删除") !== -1, "草案含「建议删除」分区");
    assert(t.indexOf("## 需人工复核") !== -1, "草案含「需人工复核」分区");
    assert(t.indexOf("## 新增候选") !== -1, "草案含「新增候选」分区");
    assert(t.indexOf("未做二次推断") !== -1, "草案声明判据来自工具原始输出");
  }

  /* ---------- 3. strict 不把已知盲区判死 ---------- */
  const s = run(["--id", "deadwood-reblooms", "--src", DW, "--skip-test", "--strict", "--json", "--draft-out", draft]);
  assert(s.status === 0, "strict：SOURCE_MISMATCH（featsBoosts 6 键动态盲区）存在时仍 exit 0（告警不是删除信号）");
  let sj = null;
  try { sj = JSON.parse(s.stdout); } catch (e) {}
  assert(sj && sj.sourceMismatch && sj.sourceMismatch.length === 6, "strict：6 条 SOURCE_MISMATCH 如实列出（可见但不判死）");
  assert(sj && sj.strictFail === false, "strict：strictFail=false");
}

if (failures) {
  console.error("\n" + failures + " 项失败");
  process.exit(1);
}
console.log("\n全部通过");
