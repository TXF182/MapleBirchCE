/*
 * 分支覆盖归因报告：把 c8 对「拼接产物」的覆盖率按 src 分片拆开，列出未覆盖分支所在分片与行号。
 * 背景：c8 只认 javascript/maplebirchce.js 一个 key，而该产物是 src 按 manifest 段序的纯拼接，
 *       因此不重建「产物行号 → 源文件行号」映射就无法回答"73% 分支缺口在哪"。
 * 段序真源是 javascript/src/manifest.json（层 preamble→core→adapter→write→ui→export），
 *       **不是文件名字典序**——两者有 3 对文件互换（07i-yanling-core/-actions、07l-vanilla-ext/-view、
 *       09-exports/-vcore），按字典序会把缺口算到错的分片上。
 * 用法：
 *   node tools/report_branch_gaps.js            # 人读表格
 *   node tools/report_branch_gaps.js --md       # 输出 README 用 Markdown 表
 *   node tools/report_branch_gaps.js --top 15   # 只看缺口最大的 N 个分片（默认 15）
 * 前置：coverage/coverage-final.json 必须存在（run_all 第 10 步 / npm run coverage 生成）。
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "javascript", "src");
const COV = path.join(ROOT, "coverage", "coverage-final.json");
const MANIFEST = path.join(SRC_DIR, "manifest.json");
const PRODUCT = path.join(ROOT, "javascript", "maplebirchce.js");

/* 段序取自 manifest.json（与 build_js.js 同一真源），并校验它与 src 目录的文件集合一致：
 * 集合不一致说明有人加了/删了分片却没登记，行号映射必然错位 —— 直接 fail-closed。 */
function segmentOrder() {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const segs = (m.segments || []).map(s => (typeof s === "string" ? s : s.file));
  const onDisk = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".js"));
  const missing = segs.filter(f => !onDisk.includes(f));
  const unlisted = onDisk.filter(f => !segs.includes(f));
  if (!segs.length || missing.length || unlisted.length) {
    console.error("FAIL: manifest 段序与 src 目录不一致（行号映射不可信）"
      + (missing.length ? " 缺段=" + missing.join(",") : "")
      + (unlisted.length ? " 未登记=" + unlisted.join(",") : ""));
    process.exit(2);
  }
  return segs;
}

function lineMap() {
  const rows = [];
  let line = 1;
  for (const f of segmentOrder()) {
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

  if (!fs.existsSync(COV)) { console.error("FAIL: 缺少 " + COV + "（先跑 npm run coverage:gate 或 run_all.ps1 第 10 步）"); return 2; }
  /* 新鲜度护栏：json 只是「某一次跑完」的快照，产物一重建它就过期。过期数据同样是合法 JSON、
   * 同样是 6843 个分支，只是少覆盖若干条 —— 静默给出错误缺口最难查，所以这里显式比 mtime，过期即 exit 2。 */
  const covT = fs.statSync(COV).mtimeMs;
  const prodT = fs.existsSync(PRODUCT) ? fs.statSync(PRODUCT).mtimeMs : 0;
  if (covT < prodT) {
    console.error("FAIL: coverage-final.json 早于产物（" + new Date(covT).toISOString() + " < " + new Date(prodT).toISOString()
      + "），数据已过期，先跑 npm run coverage:gate");
    return 2;
  }
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

  const prodSha = fs.existsSync(PRODUCT) ? crypto.createHash("sha256").update(fs.readFileSync(PRODUCT)).digest("hex") : "";
  console.log("数据 " + new Date(covT).toISOString() + " · 产物 " + (prodSha ? prodSha.slice(0, 12) : "(缺失)") + " · 段序取 manifest（" + rows.length + " 段）");
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
