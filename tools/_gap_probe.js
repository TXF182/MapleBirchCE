/* 输出：未执行函数清单（fnMap count=0）+ 按文件的分支缺口（基于 coverage-final.json 真值） */
const fs = require("fs"), path = require("path");
const p = path.join(__dirname, "..", "coverage", "coverage-final.json");
const raw = JSON.parse(fs.readFileSync(p, "utf8"));
const keys = Object.keys(raw);
let out = [];
keys.forEach(function (file) {
  const d = raw[file];
  const branchTot = Object.keys(d.b).reduce(function (a, k) {
    const arr = d.b[k];
    const n = Array.isArray(arr) ? arr.length : 0;
    const hit = Array.isArray(arr) ? arr.filter(function (c) { return c > 0; }).length : 0;
    a.t += n; a.h += hit; return a;
  }, { t: 0, h: 0 });
  const fnMiss = [];
  Object.keys(d.f).forEach(function (k) {
    if (d.f[k] === 0) { fnMiss.push(d.fnMap[k].name); }
  });
  out.push({ file: path.basename(file), bt: branchTot.t, bh: branchTot.h, miss: branchTot.t - branchTot.h, fnMiss: fnMiss });
});
out.sort(function (a, b) { return b.miss - a.miss; });
const total = out.reduce(function (a, o) { a.t += o.bt; a.h += o.bh; return a; }, { t: 0, h: 0 });
console.log("总计分支 " + total.h + "/" + total.t + " = " + (total.h / total.t * 100).toFixed(2) + "%");
console.log("\n未执行函数（共 " + out.reduce(function (a, o) { return a + o.fnMiss.length; }, 0) + " 个）：");
out.forEach(function (o) { if (o.fnMiss.length) { console.log("  " + o.file + " → " + o.fnMiss.join(", ")); } });
console.log("\n分支缺口 Top 20：");
out.slice(0, 20).forEach(function (o) {
  console.log("  " + o.file + "  " + (o.bh / o.bt * 100).toFixed(1) + "%  缺 " + o.miss + " / " + o.bt);
});
