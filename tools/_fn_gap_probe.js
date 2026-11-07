/* 探针：从 coverage-final.json 按「函数」粒度统计缺分支（istanbul 的 branchMap 是按函数下挂的）
 * 输出：未走全的分支数排序，带函数名与行号，便于精准补测。
 * 用法：node tools/_fn_gap_probe.js
 */
"use strict";
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, "..", "coverage", "coverage-final.json");
const cov = JSON.parse(fs.readFileSync(file, "utf8"));
const key = Object.keys(cov)[0];
const d = cov[key];

// 行号：从 statementMap 反查函数起止行不方便，直接用 branchMap.loc 的 start.line
const rows = [];
Object.keys(d.fnMap).forEach(function (fid) {
  const fn = d.fnMap[fid];
  const br = d.branchMap[fid] || {};
  const counts = d.b[fid] || [];
  const lines = (br.locations || []).map(l => l.start.line).join("/");
  const type = br.type || "-";
  const total = counts.length;
  const miss = counts.reduce((a, c) => a + (c ? 0 : 1), 0);
  rows.push({ name: fn.name, line: fn.loc.start.line, type: type, bLines: lines, total: total, miss: miss, fhit: d.f[fid] || 0 });
});
rows.sort((a, b) => b.miss - a.miss);
console.log("函数数 " + rows.length + "，分支总计 " + rows.reduce((a, r) => a + r.total, 0) + "，缺 " + rows.reduce((a, r) => a + r.miss, 0));
console.log("\n缺分支最多的函数（Top 40）：");
rows.slice(0, 40).forEach(function (r) {
  console.log("  " + String(r.miss).padStart(3) + "/" + String(r.total).padEnd(3) + "  " + (r.name || "<anonymous>").padEnd(28) + " L" + r.line + "  type=" + r.type + "  bLines=" + r.bLines + (r.fhit ? "" : "  [函数从未执行]"));
});
console.log("\n函数从未执行且带分支的：");
rows.filter(r => !r.fhit && r.total > 0).forEach(function (r) {
  console.log("  " + (r.name || "<anonymous>") + " L" + r.line + "  缺 " + r.miss + "/" + r.total);
});
