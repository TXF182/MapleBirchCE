/* 探针：把 coverage-final.json 的未覆盖分支按「产物行号 → src 段」聚合成模块级缺口表。
 * 段边界来自 manifest.json 的构建顺序 + src 文件行数（build_js 只做拼接，段内行号与 src 一一对应，
 * 段首偏移按前序段行数累加）。用法：node tools/_seg_gap_probe.js
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "javascript/src/manifest.json"), "utf8"));
const cov = JSON.parse(fs.readFileSync(path.join(ROOT, "coverage/coverage-final.json"), "utf8"));
const key = Object.keys(cov)[0];
const d = cov[key];

// 段边界：按 manifest 顺序累加每个 src 文件的行数（不含末尾换行差异，误差允许 ±2 行）
const segs = [];
let acc = 1;
manifest.segments.forEach(function (s) {
  const f = path.join(ROOT, "javascript/src", s.file);
  const txt = fs.readFileSync(f, "utf8");
  const lines = txt.split("\n").length;
  segs.push({ file: s.file, start: acc, end: acc + lines - 1 });
  acc += lines;
});
function segOf(line) {
  for (const s of segs) { if (line >= s.start && line <= s.end) return s.file; }
  return "(段外)";
}

const gap = {};
Object.keys(d.branchMap).forEach(function (bid) {
  const counts = d.b[bid] || [];
  const bm = d.branchMap[bid];
  const line = (bm.loc && bm.loc.start && bm.loc.start.line) || (bm.line) || 0;
  const miss = counts.reduce((a, c) => a + (c ? 0 : 1), 0);
  if (!miss) return;
  const s = segOf(line);
  if (!gap[s]) gap[s] = { miss: 0, total: 0, lines: [] };
  gap[s].miss += miss;
  gap[s].total += counts.length;
  gap[s].lines.push(line + "(" + miss + "/" + counts.length + ")");
});
const rows = Object.keys(gap).map(k => ({ file: k, miss: gap[k].miss, total: gap[k].total, lines: gap[k].lines }));
rows.sort((a, b) => b.miss - a.miss);
const sumMiss = rows.reduce((a, r) => a + r.miss, 0), sumTotal = rows.reduce((a, r) => a + r.total, 0);
console.log("未覆盖分支 " + sumMiss + "/" + sumTotal);
rows.forEach(function (r) {
  console.log("  " + String(r.miss).padStart(3) + " " + r.file + (process.argv[2] && r.file === process.argv[2] ? "  " + r.lines.join(" ") : ""));
});
