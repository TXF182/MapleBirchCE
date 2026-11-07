/*
 * 分支覆盖归因报告：把 c8 对「拼接产物」的覆盖率按 src 分片拆开，列出未覆盖分支所在分片与行号。
 * 背景：c8 只认 javascript/maplebirchce.js 一个 key，而该产物是 64 个分片纯拼接，
 *       因此不重建「产物行号 → 源文件行号」映射就无法回答"73% 分支缺口在哪"。
 * 用法：
 *   node tools/report_branch_gaps.js            # 人读表格
 *   node tools/report_branch_gaps.js --md       # 输出 README 用 Markdown 表
 *   node tools/report_branch_gaps.js --top 15   # 只看缺口最大的 N 个分片（默认 15）
 * 前置：coverage/coverage-final.json 必须存在（run_all 第 10 步 / npm run coverage 生成）。
 */
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "javascript", "src");
const COV = path.join(ROOT, "coverage", "coverage-final.json");

function lineMap() {
  const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".js")).sort();
  const rows = [];
  let line = 1;
  for (const f of files) {
    let t = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
    if (!t.endsWith("\n")) t += "\n";
    const n = (t.match(/\n/g) || []).length;
    rows.push({ file: f, start: line, end: line + n - 1 });
    line += n;
  }
  return rows;
}

function fileOf(rows, l) {
  for (const r of rows) { if (l >= r.start && l <= r.end) return { file: r.file, srcLine: l - r.start + 1 }; }
  return { file: "(超出产物范围)", srcLine: l };
}

/* 未覆盖分支按源码行文归类（istanbul 的 branchMap.type 在本项目产物上统一是 "branch"，无法细分，
 * 所以按行文归因）。注意：这只回答"缺口长什么样"，不宣称"不可测"——
 * plain 一类是没写断言的普通 if/else，属可补测欠账，写进 README 时据此如实计数。 */
function classifyLine(file, srcLine) {
  if (!file || file.startsWith("(")) return "plain";
  const p = path.join(SRC_DIR, file);
  if (!fs.existsSync(p)) return "plain";
  const lines = fs.readFileSync(p, "utf8").split("\n");
  const t = lines[srcLine - 1] || "";
  const prev = (lines[srcLine - 2] || "").trim();
  if (/\bcatch\s*(\(|\{)/.test(t) || /^\}\s*catch/.test(t.trim())) return "catch";
  if (/typeof/.test(t)) return "env-guard";
  if (/&&|\|\||\?\.|\?\?/.test(t)) return "shortcircuit";
  if (/\?/.test(t)) return "ternary";
  return "plain";
}

function main() {
  const argv = process.argv.slice(2);
  const top = Number((argv.includes("--top") ? argv[argv.indexOf("--top") + 1] : 15)) || 15;
  const md = argv.includes("--md");

  if (!fs.existsSync(COV)) { console.error("FAIL: 缺少 " + COV + "（先跑 npm run coverage 或 run_all.ps1 第 10 步）"); return 2; }
  const cov = JSON.parse(fs.readFileSync(COV, "utf8"));
  const key = Object.keys(cov)[0];
  const d = cov[key];
  if (!d || !d.branchMap || !d.b) { console.error("FAIL: coverage-final.json 缺 branchMap/b（不是 c8 json 产物？）"); return 2; }

  const rows = lineMap();
  const per = {};
  const byType = {};
  let tb = 0, th = 0;
  Object.keys(d.branchMap).forEach(id => {
    const bm = d.branchMap[id], counts = d.b[id] || [];
    const line = (bm.loc && bm.loc.start && bm.loc.start.line) || bm.line || 0;
    const hit = counts.filter(c => c > 0).length;
    tb += counts.length; th += hit;
    const loc = fileOf(rows, line);
    if (!per[loc.file]) per[loc.file] = { total: 0, hit: 0, lines: new Set(), byType: {} };
    per[loc.file].total += counts.length;
    per[loc.file].hit += hit;
    const miss = counts.length - hit;
    if (miss > 0) {
      const kind = classifyLine(loc.file, loc.srcLine);
      byType[kind] = (byType[kind] || 0) + miss;
      per[loc.file].byType[kind] = (per[loc.file].byType[kind] || 0) + miss;
      if (loc.srcLine > 0) per[loc.file].lines.add(loc.srcLine);
    }
  });

  const list = Object.keys(per).map(f => ({
    file: f, total: per[f].total, hit: per[f].hit, miss: per[f].total - per[f].hit,
    pct: per[f].total ? (per[f].hit * 100 / per[f].total) : 100,
    lines: Array.from(per[f].lines).sort((a, b) => a - b),
    mainType: Object.keys(per[f].byType).sort((a, b) => per[f].byType[b] - per[f].byType[a])[0] || "-"
  })).filter(r => r.miss > 0).sort((a, b) => b.miss - a.miss);

  console.log("分支总覆盖 " + (th * 100 / tb).toFixed(2) + "%（" + th + "/" + tb + "）· 有缺口分片 " + list.length + " 个");
  console.log("未覆盖分支按行文归因：" + Object.keys(byType).sort((a, b) => byType[b] - byType[a]).map(k => k + "=" + byType[k]).join("  ") + "（合计 " + (tb - th) + "）");
  console.log("  catch=防御性异常分支 / env-guard=typeof 环境守卫 / shortcircuit=&& || 短路兜底 / ternary=三元 / plain=普通 if-else（可补测欠账）");
  if (md) {
    console.log("");
    console.log("| 分片 | 分支覆盖 | 未覆盖分支 | 典型行号 |");
    console.log("|---|---|---|---|");
    list.slice(0, top).forEach(r => {
      const shown = r.lines.slice(0, 6).join(" / ") + (r.lines.length > 6 ? " …" : "");
      console.log("| `" + r.file + "` | " + r.pct.toFixed(1) + "%（" + r.hit + "/" + r.total + "） | " + r.miss + " | " + (shown || "—") + " |");
    });
  } else {
    list.slice(0, top).forEach(r => {
      console.log(r.file.padEnd(30, " ") + " " + r.pct.toFixed(1).padStart(5) + "%  miss=" + String(r.miss).padStart(3) + "  lines=" + r.lines.slice(0, 12).join(",") + (r.lines.length > 12 ? ",…" : ""));
    });
  }
  return 0;
}

process.exit(main());
