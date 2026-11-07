/* gen_adapter_matrix.js —— 从适配器声明自动生成「写入回读矩阵」（架构治理 P2）
 *
 * 动机：53 个 varPath 里有 3 个适配器（morefarm / dolopt / domrobin）在整个 tests/ 目录零命中——
 * 新适配器只要作者忘了写测试，就永远没人验证它写进去的值能不能读回来。断言不该靠人记，
 * 应该由声明直接推导：声明里有 min/max、有 levels、有 sync，就必然有可推导的期望值。
 *
 * 产物：tests/data/adapter_matrix.json（确定性输出：无时间戳、按 manifest/IR 顺序）
 *   items[] = { modId, section, key, varPath, kind, probes[{label, write, expect}], sync }
 *   kind：number / boolean / string / list / stage-string / stage-number / ability-boolean
 *
 * 用法：
 *   node tools/gen_adapter_matrix.js            # 写文件
 *   node tools/gen_adapter_matrix.js --check    # 只比对，漂移则 exit 1（挂门禁用）
 *   node tools/gen_adapter_matrix.js --stdout   # 打印到标准输出，不落盘
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ir = require("./lib/adapter_ir.js");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = process.env.MCE_SRC_DIR ? path.resolve(process.env.MCE_SRC_DIR) : path.join(ROOT, "javascript", "src");
const OUT_PATH = process.env.MCE_MATRIX_OUT
  ? path.resolve(process.env.MCE_MATRIX_OUT)
  : path.join(ROOT, "tests", "data", "adapter_matrix.json");

const argv = process.argv.slice(2);
const checkOnly = argv.indexOf("--check") !== -1;
const toStdout = argv.indexOf("--stdout") !== -1;

/* sync 的 value 允许是函数（按当前 V 计算）；矩阵里只保留「是否函数」+ 可读的替身，运行时再判定 */
function serSyncValue(v) {
  if (typeof v === "function") return { fn: true };
  if (v === null || typeof v === "number" || typeof v === "boolean" || typeof v === "string") return { fn: false, value: v };
  return { fn: false, value: JSON.stringify(v), note: "non-primitive" };
}

function serSync(sync) {
  if (!sync || typeof sync !== "object") return null;
  const out = {};
  if (Array.isArray(sync.clear)) out.clear = sync.clear.slice();
  if (Array.isArray(sync.set)) {
    out.set = sync.set.map(s => {
      const o = { path: s.path, ...serSyncValue(s.value) };
      if (s.if) o.if = { min: s.if.min, max: s.if.max };
      if (s.ifMissing !== undefined) o.ifMissing = !!s.ifMissing;
      return o;
    });
  }
  if (sync.copyMax && sync.copyMax.path) out.copyMax = { path: sync.copyMax.path, order: (sync.copyMax.order || []).slice() };
  return Object.keys(out).length ? out : null;
}

/* 每个条目可推导的写入探针：值来自声明自身（levels / min / max / type），不靠人工补 */
function probesOf(section, it) {
  if (section === "stages") {
    const numeric = it.levels.every(v => typeof v === "number");
    return {
      kind: numeric ? "stage-number" : "stage-string",
      probes: it.levels.map((lv, i) => ({ label: "level" + i + " (" + String(lv) + ")", write: lv, expect: lv }))
    };
  }
  if (section === "abilities") {
    if (it.numeric === true) {
      const lo = typeof it.min === "number" ? it.min : 0;
      const hi = typeof it.max === "number" ? it.max : 1;
      return {
        kind: "number",
        probes: [
          { label: "min(" + lo + ")", write: lo, expect: lo },
          { label: "max(" + hi + ")", write: hi, expect: hi }
        ]
      };
    }
    return {
      kind: "boolean",
      probes: [
        { label: "true", write: true, expect: true },
        { label: "false", write: false, expect: false }
      ]
    };
  }
  /* values */
  const t = it.type;
  if (t === "number") {
    return {
      kind: "number",
      probes: [
        { label: "min(" + it.min + ")", write: it.min, expect: it.min },
        { label: "max(" + it.max + ")", write: it.max, expect: it.max }
      ]
    };
  }
  if (t === "boolean") {
    return { kind: "boolean", probes: [{ label: "true", write: true, expect: true }, { label: "false", write: false, expect: false }] };
  }
  if (t === "list") {
    return { kind: "list", probes: [{ label: "push(" + it.options[0] + ")", write: it.options[0], expect: it.options[0] }] };
  }
  return { kind: "string", probes: [{ label: "probe", write: "mce-probe", expect: "mce-probe" }] };
}

const R = ir.loadAdapters(SRC_DIR);
if (R.errors.length) {
  for (const e of R.errors) console.error("FATAL: " + e.file + " 执行失败：" + e.message);
  process.exit(1);
}

const items = [];
let probeCount = 0;
for (const id of R.ids) {
  const e = R.entryOf(id);
  for (const sec of ["stages", "abilities", "values"]) {
    const arr = Array.isArray(e[sec]) ? e[sec] : [];
    arr.forEach((it, i) => {
      const p = probesOf(sec, it);
      probeCount += p.probes.length;
      items.push({
        modId: id,
        section: sec,
        index: i,
        key: it.key,
        varPath: it.varPath,
        kind: p.kind,
        type: it.type === undefined ? (sec === "abilities" ? "boolean" : sec === "stages" ? "string" : null) : it.type,
        min: typeof it.min === "number" ? it.min : null,
        max: typeof it.max === "number" ? it.max : null,
        levels: Array.isArray(it.levels) ? it.levels.slice() : null,
        probes: p.probes,
        sync: serSync(it.sync)
      });
    });
  }
}

const matrix = {
  version: 1,
  note: "由 tools/gen_adapter_matrix.js 从声明自动生成，勿手改；改声明后重跑生成器。",
  source: "javascript/src/04a-*.js（段序取自 manifest.json）",
  adapterCount: R.ids.length,
  itemCount: items.length,
  probeCount,
  items
};

const text = JSON.stringify(matrix, null, 2) + "\n";

if (toStdout) {
  process.stdout.write(text);
  process.exit(0);
}

if (checkOnly) {
  if (!fs.existsSync(OUT_PATH)) { console.error("FATAL: 矩阵缺失 " + OUT_PATH + "（先跑 node tools/gen_adapter_matrix.js）"); process.exit(1); }
  const old = fs.readFileSync(OUT_PATH, "utf8");
  if (old === text) {
    console.log("矩阵与声明一致（" + items.length + " 条 / " + probeCount + " 探针）");
    process.exit(0);
  }
  console.error("FATAL: 矩阵与声明漂移（改过 04a-*.js 后须重跑 node tools/gen_adapter_matrix.js）");
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, text);
console.log("已生成 " + OUT_PATH + "：" + items.length + " 条 / " + probeCount + " 探针 / " + R.ids.length + " 适配器");
