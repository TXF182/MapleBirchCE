/* test_adapter_matrix.js —— 声明驱动矩阵的运行时验证（架构治理 P2）
 *
 * 与 tests/test_mce.js 的分工：
 *   test_mce.js        手写断言（面板 API / 角色池 / 剧情线）；新适配器不写断言就永远零覆盖
 *   本文件              从 tests/data/adapter_matrix.json 自动派生断言：每条声明可推导的取值都真写一遍
 *                       （走产品自身 cheatWriteValue / cheatWriteListValue），回读比对 + 核对留痕路径 + undo 还原
 *
 * 断言口径：
 *   每探针 4~5 条 —— 写入 ok / 回读等于期望 / 留痕 path 正确 / sync 落地符合 if 条件 / undo 还原到写入前
 *   （list 型走数组通道，且 cheatWriteListValue 不触发 sync，故该型只断言 4 条）
 *
 * 环境变量：MCE_PKG_JS（产物）、MCE_MATRIX（矩阵）、MCE_SRC_DIR（声明目录，取真实 sync 对象）
 * 退出码：0 全过；1 有 FAIL
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const jsPath = process.env.MCE_PKG_JS || path.join(ROOT, "javascript", "maplebirchce.js");
const matrixPath = process.env.MCE_MATRIX || path.join(__dirname, "data", "adapter_matrix.json");
const srcDir = process.env.MCE_SRC_DIR ? path.resolve(process.env.MCE_SRC_DIR) : path.join(ROOT, "javascript", "src");

const rawJs = fs.readFileSync(jsPath, "utf8");
/* c8 归因：eval 的产物没有统一脚本 URL，不补这行覆盖率记成 0/0 */
const js = rawJs + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/");

global.V = {};
global.State = { variables: global.V };
global.setup = {};
global.rv = { variables: global.V, characters: {} };
global.window = global;

eval(js);
const api = global.setup.mbStageCE;
if (!api || typeof api.cheatWriteValue !== "function") {
  console.log("FAIL: 产物未导出 cheatWriteValue（setup.mbStageCE 缺失）");
  process.exit(1);
}

/* 真实 sync 对象（含 value 为函数的条目）从声明侧取；矩阵只存元信息 */
const ir = require("../tools/lib/adapter_ir.js");
const R = ir.loadAdapters(srcDir);
const liveIndex = {};
for (const id of R.ids) {
  const e = R.entryOf(id);
  for (const sec of ["stages", "abilities", "values"]) {
    for (const it of (Array.isArray(e[sec]) ? e[sec] : [])) liveIndex[id + "|" + sec + "|" + it.key] = it;
  }
}
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; return true; }
  fail++;
  console.log("FAIL: " + msg);
  return false;
}

function splitPath(p) { return String(p).split("."); }
function readPath(V, p) {
  let cur = V;
  for (const seg of splitPath(p)) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[seg];
  }
  return cur;
}
/* 建父链（数字段索引数组），可选设初值；返回叶子父对象 */
function seed(V, p, initialValue) {
  const parts = splitPath(p);
  let cur = V;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    const nextIsIdx = /^\d+$/.test(parts[i + 1]);
    let v = cur[seg];
    if (v === undefined || v === null || typeof v !== "object") {
      v = nextIsIdx ? [] : {};
      cur[seg] = v;
    }
    cur = v;
  }
  const leaf = parts[parts.length - 1];
  if (initialValue !== undefined) cur[leaf] = initialValue;
  return { parent: cur, leaf };
}
function same(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return false;
}
function writeType(item) {
  if (item.kind === "number" || item.kind === "stage-number") return "number";
  if (item.kind === "boolean") return "boolean";
  if (item.kind === "list") return "list";
  return "string";
}
/* 写入前初值：刻意与待写值不同，才能证明 undo 是「回到写入前」而非「回到上一次」 */
function initialFor(item, probe) {
  if (item.kind === "number" || item.kind === "stage-number") {
    const base = typeof item.min === "number" ? item.min : 0;
    return (base + 7 === probe.write ? base + 11 : base + 7);
  }
  if (item.kind === "boolean") return !probe.write;
  if (item.kind === "list") return ["mce-before"];
  return "mce-before";
}
/* sync.set 的 if 语义：按主写入后的新值判定（applyCheatSync 实现如此） */
function ifSatisfied(s, val) {
  if (!s.if) return true;
  const n = Number(val);
  if (!isFinite(n)) return false;
  if (typeof s.if.min === "number" && n < s.if.min) return false;
  if (typeof s.if.max === "number" && n > s.if.max) return false;
  return true;
}

const rows = [];
for (const item of matrix.items) {
  const tag = item.modId + " / " + item.section + ":" + item.key;
  const live = liveIndex[item.modId + "|" + item.section + "|" + item.key];
  const row = { modId: item.modId, items: 0, probes: 0, asserts: 0 };
  rows.push(row);
  row.items++;

  assert(!!live, tag + " 声明里找不到该 key（矩阵过期，重跑 gen_adapter_matrix）");
  if (live) assert(live.varPath === item.varPath, tag + " varPath 漂移：矩阵 " + item.varPath + " ≠ 声明 " + live.varPath);

  const t = writeType(item);
  for (const probe of item.probes) {
    row.probes++;
    const before = pass + fail;
    const init = initialFor(item, probe);
    const V = {};
    seed(V, item.varPath, init);
    /* 先把 sync 目标的父链补好（叶子留空），否则 applyCheatSync 会因父级缺失拒绝联动 */
    const syncSet = (live && live.sync && Array.isArray(live.sync.set)) ? live.sync.set : [];
    if (t !== "list") for (const s of syncSet) seed(V, s.path);
    global.V = V;
    global.State.variables = V;

    const res = (t === "list")
      ? api.cheatWriteListValue(item.modId, item.key, "set", item.varPath, probe.write, true)
      : api.cheatWriteValue(item.modId, item.key, "set", item.varPath, probe.write, t,
        typeof item.min === "number" ? item.min : undefined,
        typeof item.max === "number" ? item.max : undefined,
        (live && live.sync) || undefined);

    const label = tag + " [" + probe.label + "]";
    assert(!!res && res.ok === true, label + " 写入失败：" + (res && res.message));
    const got = readPath(V, item.varPath);
    if (t === "list") assert(Array.isArray(got) && got.indexOf(probe.write) !== -1, label + " 回读不含写入项：" + JSON.stringify(got));
    else assert(same(got, probe.expect), label + " 回读不一致：期望 " + JSON.stringify(probe.expect) + "，实际 " + JSON.stringify(got));
    const rec = V.mbCE_wrote && V.mbCE_wrote["cheat:" + item.modId + ":" + item.key];
    assert(!!rec && rec.path === item.varPath, label + " 留痕路径不符：期望 " + item.varPath + "，实际 " + (rec && rec.path));

    if (t !== "list") {
      for (const s of syncSet) {
        const after = readPath(V, s.path);
        if (!ifSatisfied(s, probe.write)) {
          /* 条件不满足时不留置真值（clear 段会把目标置 null，未声明 clear 的则保持 undefined） */
          assert(after !== true, label + " 联动条件不满足却置位 " + s.path + "（if.min=" + (s.if && s.if.min) + "，实际 " + JSON.stringify(after) + "）");
        } else {
          assert(after !== undefined, label + " 联动未落地：" + s.path + "（声明 sync.set 应生效）");
        }
      }
    }

    const undo = api.undoCheatModValue(item.modId, item.key);
    const back = readPath(V, item.varPath);
    assert(!!undo && undo.ok === true, label + " 回退失败：" + (undo && undo.message));
    assert(same(back, init), label + " 回退未还原写入前状态：期望 " + JSON.stringify(init) + "，实际 " + JSON.stringify(back));
    row.asserts += (pass + fail) - before;
  }
}

/* 玩家路径补检：string 型数值若存在，必须能走 UI 层 applyCheatModValue 落地
   （v2.0.4 修过一处：string 曾 fallback 成 number 通道 → Number("abc")=NaN → 静默拒绝）。当前真声明无 string 项，
   由假适配器负控覆盖此分支。 */
let playerChecked = 0;
for (const item of matrix.items) {
  if (item.kind !== "string") continue;
  for (const probe of item.probes) {
    const V = {};
    seed(V, item.varPath, "mce-before");
    global.V = V;
    global.State.variables = V;
    const res = api.applyCheatModValue(item.modId, item.key, probe.write);
    assert(!!res && res.ok === true, item.modId + " / " + item.key + " [" + probe.label + "] 玩家路径写入失败：" + (res && res.message));
    assert(readPath(V, item.varPath) === probe.expect, item.modId + " / " + item.key + " [" + probe.label + "] 玩家路径回读不一致");
    playerChecked++;
  }
}
if (playerChecked) console.log("玩家路径补检：" + playerChecked + " 个 string 探针走 applyCheatModValue");

console.log("");
for (const r of rows) console.log("  " + r.modId + "：条目 " + r.items + " / 探针 " + r.probes + " / 断言 " + r.asserts);
console.log("矩阵：" + matrix.adapterCount + " 适配器 / " + matrix.itemCount + " 条目 / " + matrix.probeCount + " 探针");
console.log("ASSERT_TOTAL=" + (pass + fail) + "  PASS=" + pass + "  FAIL=" + fail);
if (fail) { console.log("MATRIX TEST FAILED"); process.exit(1); }
console.log("MATRIX TEST PASSED");
