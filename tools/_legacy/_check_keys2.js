/* 二次探测：对 _check_keys.js 报告的 MISS 路径做短键名/叶子名搜索，甄别"真删除"vs"引用形态差异" */
const fs = require("fs"), path = require("path");

const TARGETS = {
  "revelation-the-book-of-return": path.join(__dirname, "_modcache", "rv140", "Revelation-The-Book-of-Return-1.3.10", "src"),
  "deadwood-reblooms": path.join(__dirname, "_modcache", "dw244", "Deadwood-Reblooms-2.4.4", "src")
};

/* 每个 MISS 路径 → 候选短键（按精度从高到低） */
const PROBES = {
  "revelation-the-book-of-return": {
    "RobinTemple.faith_band": ["faith_band"],
    "TempleDuties.candidates.Robin.agreed": ["candidates", ".agreed"],
    "TempleDuties.candidates.Sydney.agreed": ["candidates", ".agreed"],
    "RobinTemple.secret.rite_round": ["rite_round"]
  },
  "deadwood-reblooms": {
    "RobinExpansion.fish_grill": ["fish_grill"],
    "RobinExpansion.balloon_wins": ["balloon_wins"],
    "RobinExpansion.doctor.count": ["doctor.count", ".count"],
    "StreetLife.races.wins": ["races", "races.wins", ".wins"],
    "StreetLife.races.completed": ["races", "races.completed", ".completed"],
    "LifeSimulation.school.duties.completed": ["school.duties", ".duties", "duties"]
  }
};

function searchInDir(dir, needle) {
  if (!fs.existsSync(dir)) return 0;
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "assets" && e.name !== "img" && e.name !== "node_modules") walk(p); }
      else if (/\.(twee|ts|js)$/.test(e.name)) files.push(p);
    }
  })(dir);
  let count = 0;
  for (const f of files) {
    try { if (fs.readFileSync(f, "utf8").includes(needle)) count++; } catch (e) {}
  }
  return count;
}

for (const modId of Object.keys(PROBES)) {
  console.log("===== " + modId + " MISS 二次探测 =====");
  for (const [p, probes] of Object.entries(PROBES[modId])) {
    const hits = probes.map(n => n + "=" + searchInDir(TARGETS[modId], n));
    console.log(p + "  ->  " + hits.join("  |  "));
  }
}
