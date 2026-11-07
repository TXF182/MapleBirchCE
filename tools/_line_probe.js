/* 探针：列出未覆盖分支的「产物行号 + miss/total + 该行源码文本」，只输出 total===1 的单向分支，
 * 这些覆盖后可 +1 覆盖数且分母不变（提升百分比最快）。用法：node tools/_line_probe.js [段名] */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "javascript/src/manifest.json"), "utf8"));
const cov = JSON.parse(fs.readFileSync(path.join(ROOT, "coverage/coverage-final.json"), "utf8"));
const d = cov[Object.keys(cov)[0]];
const prod = fs.readFileSync(path.join(ROOT, "javascript/maplebirchce.js"), "utf8").split("\n");

const segs = [];
let acc = 1;
manifest.segments.forEach(function (s) {
  const txt = fs.readFileSync(path.join(ROOT, "javascript/src", s.file), "utf8");
  const lines = txt.split("\n").length;
  segs.push({ file: s.file, start: acc, end: acc + lines - 1 });
  acc += lines;
});
function segOf(line) {
  for (const s of segs) { if (line >= s.start && line <= s.end) return s.file; }
  return "(段外)";
}
const only = process.argv[2] || "";
const rows = [];
Object.keys(d.branchMap).forEach(function (bid) {
  const counts = d.b[bid] || [];
  const bm = d.branchMap[bid];
  const line = (bm.loc && bm.loc.start && bm.loc.start.line) || 0;
  const miss = counts.reduce((a, c) => a + (c ? 0 : 1), 0);
  if (!miss || counts.length !== 1) return;
  const seg = segOf(line);
  if (only && seg.indexOf(only) === -1) return;
  rows.push({ seg: seg, line: line, text: (prod[line - 1] || "").trim().slice(0, 150) });
});
rows.sort(function (a, b) { return a.line - b.line; });
rows.forEach(function (r) { console.log(r.seg.replace(/\.js$/, "").padStart(4) + " " + r.line + " " + r.text); });
console.log("\n单向(1/1)未覆盖分支共 " + rows.length + " 条");
