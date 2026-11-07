/* adapter_ir.js —— 适配器声明 IR 装载器（架构治理 P1 的公共底座）
 *
 * 为什么不用正则：tools/check_claims.js 用「扫文本 + 反向配对大括号」抽 key/varPath/levels，
 * 对 `levels: SOME_CONST`、数组换行、注释里出现 `key:` 这类写法会失真。声明本身是 JS 对象字面量，
 * 最可靠的读法是让 VM 真跑一遍（detect 只是函数声明，不执行，无需 mock 运行时）。
 *
 * 做法：把 javascript/src 下 04a-*.js 按 manifest 段序逐段 runInContext 到同一个沙箱 →
 * 顶层 `var CHEAT_ADAPTERS` 落在沙箱全局 → 读回真正的对象图（含 sync.set[].value 这类函数值）。
 *
 * 返回：{ ids, adapters, items, counts, errors, files }
 *   items：扁平化后的条目数组（含 modId / section / index / 原始声明对象引用）
 *   errors：某一段执行失败（语法错误/顶层抛错）时会记账，调用方据此 fail-closed
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SECTIONS = ["stages", "abilities", "values", "scenes", "tasks"];

function listAdapterFiles(srcDir) {
  if (!fs.existsSync(srcDir)) throw new Error("源码目录不存在：" + srcDir);
  return fs.readdirSync(srcDir).filter(f => /^04a-.*\.js$/.test(f)).sort();
}

/* 段序优先取 manifest（同一份真源）；manifest 缺失/无对应段时回退字典序，保证工具可独立运行 */
function orderedAdapterFiles(srcDir) {
  const all = listAdapterFiles(srcDir);
  const mp = path.join(srcDir, "manifest.json");
  if (!fs.existsSync(mp)) return all;
  try {
    const mf = JSON.parse(fs.readFileSync(mp, "utf8"));
    const listed = (mf.segments || []).map(s => s.file).filter(f => /^04a-.*\.js$/.test(f));
    const rest = all.filter(f => listed.indexOf(f) === -1);
    return listed.concat(rest);
  } catch (e) {
    return all;
  }
}

function loadAdapters(srcDir) {
  const files = orderedAdapterFiles(srcDir);
  const sandbox = { console: console };
  vm.createContext(sandbox);
  const errors = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(srcDir, f), "utf8");
    try {
      /* 末尾加 ";0" 避免「文件以 // 注释结尾」把整段吞掉；执行结果不用 */
      vm.runInContext(text + "\n;0;\n", sandbox, { filename: f });
    } catch (e) {
      errors.push({ file: f, message: e && e.message ? e.message : String(e) });
    }
  }
  const A = sandbox.CHEAT_ADAPTERS || {};
  const ids = Object.keys(A);
  const items = [];
  const counts = {};
  for (const id of ids) {
    const ad = A[id] || {};
    const entry = ad.entry || {};
    const per = {};
    for (const sec of SECTIONS) {
      const arr = Array.isArray(entry[sec]) ? entry[sec] : [];
      per[sec] = arr.length;
      arr.forEach((it, i) => items.push({ modId: id, section: sec, index: i, item: it }));
    }
    counts[id] = per;
  }
  return { ids, adapters: A, entryOf: id => (A[id] && A[id].entry) || {}, items, counts, errors, files, SECTIONS };
}

module.exports = { loadAdapters, SECTIONS, listAdapterFiles, orderedAdapterFiles };
