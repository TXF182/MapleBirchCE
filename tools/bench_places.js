// MapleBirchCE 面板场景直达性能基准（真实本体 16,087 段）
// 跑法: node tools_bench_places.js <maplebirchce.js> <all_passages.json>
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const [jsPath, dumpPath] = process.argv.slice(2);
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const rows = dump.rows;

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"story\"></div><div id=\"passages\"></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.Node = window.Node;
global.Element = window.Element;
global.HTMLElement = window.HTMLElement;
global.HTMLSelectElement = window.HTMLSelectElement;
global.localStorage = window.localStorage;

const V = { player: {}, scenes: {}, mbCE_wrote: {} };
global.V = V;
global.State = { variables: V, passage: "Room", temporary: {} };
global.setup = {};
global.passage = function () { return "Room"; };
window.maplebirch = { npc: {}, temporary: {} };

const byName = Object.create(null);
rows.forEach(function (p) { byName[p.name] = p; });
global.Story = {
  size: rows.length,
  passages: rows,
  has: function (n) { return Object.prototype.hasOwnProperty.call(byName, n); },
  get: function (n) { return byName[n] || null; },
  lookupWith: function (fn) { return rows.filter(function (p) { return fn(p); }); }
};

eval(fs.readFileSync(jsPath, "utf8") + "\n//# sourceURL=" + jsPath.replace(/\\/g, "/"));
const api = setup.mbStageCE;
if (!api || typeof api.listPlaceGroups !== "function") { console.error("API 不可用"); process.exit(2); }

const N = 5;
const times = [];
let totalItems = 0, maxItems = 0;
for (let i = 0; i < N; i++) {
  const t0 = process.hrtime.bigint();
  const lg = api.listPlaceGroups();
  const t1 = process.hrtime.bigint();
  times.push(Number(t1 - t0) / 1e6);
  if (i === 0) {
    totalItems = lg.reduce(function (a, x) { return a + x.items.length; }, 0);
    maxItems = lg.reduce(function (a, x) { return Math.max(a, x.items.length); }, 0);
    console.log("组数=" + lg.length + "  组内条目合计=" + totalItems + "  单组最大=" + maxItems);
  }
}
console.log("listPlaceGroups 5 次（ms）: " + times.map(function (x) { return x.toFixed(1); }).join(" / "));
const first = times[0], rest = times.slice(1);
console.log("首次=" + first.toFixed(1) + "ms  后续均值=" + (rest.reduce(function (a, b) { return a + b; }, 0) / rest.length).toFixed(1) + "ms  → 是否有缓存: " + (first / (rest.reduce(function (a, b) { return a + b; }, 0) / rest.length) > 2 ? "无" : "看不出来"));

// 子入口清单（面板「更多入口」展开路径）
const eW = api.listPlaceGroups().filter(function (x) { return x.group.id === "whitney_home"; })[0] || { items: [], group: {} };
const t2 = process.hrtime.bigint();
const subs = typeof api.mbCEListPlaceEntries === "function" ? api.mbCEListPlaceEntries(eW) : [];
const t3 = process.hrtime.bigint();
console.log("mbCEListPlaceEntries(whitney_home) = " + subs.length + " 条 / " + (Number(t3 - t2) / 1e6).toFixed(1) + "ms");
const stats = process.memoryUsage();
console.log("heapUsed=" + (stats.heapUsed / 1048576).toFixed(1) + "MB  rss=" + (stats.rss / 1048576).toFixed(1) + "MB");
