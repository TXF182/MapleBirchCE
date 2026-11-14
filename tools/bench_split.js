// 成本拆解：listAllPassages 的枚举开销 vs 组匹配开销（只读实验，不改源码）
// 跑法: node _tmp_bench_split.js <all_passages.json>
const fs = require("fs");
const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).rows;

// A. 复刻 listAllPassages 的构造行为（Story.lookupWith 主路径）
function buildAll() {
  const out = [];
  const arr = rows;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (!p || typeof p !== "object") continue;
    const nm = typeof p.name === "string" ? p.name : "";
    if (nm) out.push({ name: nm, text: typeof p.text === "string" ? p.text : "" });
  }
  return out;
}

// B. 复刻 listPlaceGroups 的匹配骨架（24 组 × N 段的双层循环）
function matchAll(ps, groups) {
  const seen = {};
  return groups.map(function (g) {
    const items = [];
    for (let j = 0; j < ps.length; j++) {
      const n = ps[j].name;
      if (seen[n]) continue;
      if (!g.match(n)) continue;
      seen[n] = true;
      items.push(n);
    }
    return { group: g, items: items };
  });
}

// 用产物里真实的 PLACE_GROUPS：借 eval 取出来
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost/" });
global.window = dom.window; global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.V = { mbCE_wrote: {} }; global.State = { variables: global.V, passage: "Room" };
global.setup = {}; global.passage = () => "Room";
const byName = Object.create(null); rows.forEach(p => byName[p.name] = p);
global.Story = { size: rows.length, passages: rows, has: n => n in byName, get: n => byName[n] || null, lookupWith: f => rows.filter(f) };
const apiSetup = global.setup;
eval(fs.readFileSync(process.argv[3], "utf8") + "\n//# sourceURL=bench");
const api = apiSetup.mbStageCE;
// 产物未导出 PLACE_GROUPS，则用 api.listPlaceGroups 一次拿组对象
const real = api.listPlaceGroups();
const groups = real.map(x => x.group);
console.log("组数=" + groups.length + " / 段落=" + rows.length);

function timeit(fn, n) { const t = []; for (let i = 0; i < n; i++) { const a = process.hrtime.bigint(); fn(); const b = process.hrtime.bigint(); t.push(Number(b - a) / 1e6); } return t; }

const tBuild = timeit(buildAll, 5);
const tMatch = timeit(() => matchAll(rows, groups), 5);
const tBoth = timeit(() => matchAll(buildAll(), groups), 5);
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log("仅枚举 16,087 段（构造 {name,text}）: " + avg(tBuild) + " ms  [" + tBuild.map(x => x.toFixed(1)).join("/") + "]");
console.log("仅组匹配（复用同一 ps 数组）   : " + avg(tMatch) + " ms  [" + tMatch.map(x => x.toFixed(1)).join("/") + "]");
console.log("枚举 + 匹配（当前实现等价物） : " + avg(tBoth) + " ms");
console.log("→ 枚举占比约 " + (100 * parseFloat(avg(tBuild)) / parseFloat(avg(tBoth))).toFixed(0) + "%；缓存后单次可降到约 " + avg(tMatch) + " ms");
