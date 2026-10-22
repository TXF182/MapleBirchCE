/*
 * 模组更新检测：对比 MapleBirchCE 适配器声明的第三方模组版本 vs GitHub 最新 Release。
 * 用法：node tools/check_mod_updates.js
 * 输出：逐渠道报告（声明版本 / 最新 tag / 结论）+ 总结行 UPDATES: N（供定时任务判断）。
 * 说明：只检测报告，不改任何代码；更新动作由定时任务中的工作流执行
 * （下载新源码 → audit_adapters 核对 → resolve_missing 自动定案 → 补适配器声明 → 全链测试）。
 * 9 渠道：8 个适配模组（枯木逢春/归途之书/DomRobin/MLI/SmartPhone/Dol-Optimization/Wraith'sReflection/DoLSims）+ 框架本体 maplebirch-framework。
 * 框架渠道声明版本来自 declOverride（实测兼容版本），升版前须跑 check_framework_api.js 核对。
 */
const https = require("https");
const fs = require("fs"), path = require("path");

const SRC = path.join(__dirname, "..", "javascript", "src", "04-modcheat.js");
const js = fs.readFileSync(SRC, "utf8");

/* 渠道表：适配器 modId → GitHub repo；extract 为从 modName 提取声明版本的匹配。
 * declOverride：非适配器渠道（如框架本体 maplebirchFramework）不在 CHEAT_ADAPTERS 里，
 * 声明版本 = 本地实测兼容版本（来源见注释），框架更新需确认 CE 引用的框架 API 兼容后再更新此值。 */
const CHANNELS = [
  { modId: "deadwood-reblooms", repo: "MaplebirchLeaf/Deadwood-Reblooms",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "revelation-the-book-of-return", repo: "MaplebirchLeaf/Revelation-The-Book-of-Return",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "dom_robin", repo: "ZeroRing233/Degrees-of-Lewdity-RobinMod",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "more_love_interests", repo: "Nephthelana/DoL-More-Love-Interests-Mod",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "smartphone", repo: "ANLINSTUDIO/Degrees-of-Lewdity-DolSmartPhone",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "dol-optimization", repo: "ANLINSTUDIO/Degrees-of-Lewdity-DolOptimization",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "wraiths-reflection", repo: "Water2311/WraithsReflection",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "dolsims", repo: "MissedHeart/Degrees-of-Lewdity-DolSims",
    extractDecl: /(\d+(?:\.\d+)+)/ },
  { modId: "maplebirch-framework", repo: "MaplebirchLeaf/SCML-DOL-maplebirchFramework",
    /* 框架本体（非适配器）：declOverride = 本地实测兼容版本。升版前必须跑
       `node tools/check_framework_api.js <新版 inject_early.js>` 核对 CE 依赖的
       API（maplebirch.get / .npc / .temporary.traitLists / window.maplebirch）
       全部保留后再更新此值。5.5.3 已核对兼容（2026-10-22，v1.8.23 十七巡）：
       核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists /
       define / frameworkNotice），setup.MapleBirch / maplebirch.patch 缺失均为
       非 CE 依赖（CE 0 次调用 patch；setup.MapleBirch 仅 01-core.js resolveMB()
       的兜底分支，window.maplebirch 主路径存在时永不触发），缺失无害。 */
    declOverride: "5.5.3" }
];

function declaredVersion(modId) {
  const ch = CHANNELS.find(function (c) { return c.modId === modId; });
  if (!ch) return null;
  if (ch.declOverride) return ch.declOverride; /* 非适配器渠道：直接取当前兼容版本 */
  /* 适配器渠道：在 CHEAT_ADAPTERS[modId] 块内找 modName 并提取版本。
     v1.8.6 review：括号配对提取完整块（替代固定 4000 字符截断，块超长时不会漏） */
  const i = js.indexOf('CHEAT_ADAPTERS["' + modId + '"]');
  if (i === -1) return null;
  let start = js.indexOf("{", i), depth = 0, end = -1;
  for (let j = start; j < js.length && end === -1; j++) {
    if (js[j] === "{") depth++;
    else if (js[j] === "}") { depth--; if (depth === 0) end = j; }
  }
  const seg = end !== -1 ? js.slice(i, end + 1) : js.slice(i, i + 4000);
  const m = seg.match(/modName:\s*"([^"]+)"/);
  if (!m) return null;
  const v = m[1].match(ch.extractDecl);
  return v ? v[1] : null;
}

function getLatestTag(repo) {
  return new Promise(function (resolve) {
    https.get("https://api.github.com/repos/" + repo + "/releases/latest", {
      headers: { "User-Agent": "MapleBirchCE-mod-update-check", "Accept": "application/vnd.github+json" }
    }, function (res) {
      let body = "";
      res.on("data", function (c) { body += c; });
      res.on("end", function () {
        if (res.statusCode !== 200) { resolve({ error: "HTTP " + res.statusCode }); return; }
        try { resolve(JSON.parse(body)); } catch (e) { resolve({ error: "JSON 解析失败" }); }
      });
    }).on("error", function (e) { resolve({ error: e.message }); });
  });
}

/* 版本比较：返回 -1（旧）/ 0（同）/ 1（新）。DomRobin 特例：0.0.8 == 官方 0.08 */
function compareVersions(decl, tagVer) {
  if (!decl || !tagVer) return null;
  const d = (decl.match(/\d+(?:\.\d+)+/) || [""])[0].split(".").map(Number);
  const t = (tagVer.match(/\d+(?:\.\d+)+/) || [""])[0].split(".").map(Number);
  /* DomRobin：声明 0.0.X == tag 0.0X（取声明第三段 vs tag 第二段） */
  if (decl.indexOf("0.0.") === 0 && tagVer.match(/^\d+\.\d+(?:-|$)/)) {
    const dx = d[2] || 0, tx = t[1] || 0;
    return dx === tx ? 0 : (dx > tx ? 1 : -1);
  }
  const len = Math.max(d.length, t.length);
  for (let i = 0; i < len; i++) {
    const dv = d[i] || 0, tv = t[i] || 0;
    if (dv !== tv) return dv > tv ? 1 : -1;
  }
  return 0;
}

(async function () {
  let updates = 0;
  const rows = [];
  for (const ch of CHANNELS) {
    const decl = declaredVersion(ch.modId);
    const rel = await getLatestTag(ch.repo);
    let row = { modId: ch.modId, repo: ch.repo, decl: decl };
    if (rel.error) { row.note = "API 错误：" + rel.error; rows.push(row); continue; }
    const tag = rel.tag_name || "?";
    row.tag = tag;
    const tv = (tag.match(/\d+(?:\.\d+)+/) || [""])[0];
    if (!tv) { row.note = "最新 tag 无法提取版本号，需人工确认：\"" + tag + "\""; rows.push(row); continue; }
    const c = compareVersions(decl, tv);
    if (c === null) { row.note = "声明版本无法提取，需人工确认"; rows.push(row); continue; }
    if (c < 0) { row.note = "有更新（最新 " + tv + " > 声明 " + decl + "）"; updates++; }
    else if (c > 0) { row.note = "声明高于最新（声明 " + decl + " > 最新 " + tv + "）——可能声明超前，需人工核对"; }
    else { row.note = "无更新（均为 " + decl + "）"; }
    rows.push(row);
  }
  console.log("===== MapleBirchCE 适配模组更新检测 " + new Date().toISOString() + " =====");
  for (const r of rows) {
    console.log("[" + r.modId + "] " + (r.decl || "?") + " / " + (r.tag || "?") + " → " + r.note);
  }
  console.log("UPDATES: " + updates);
})().catch(function (e) { console.error(e); process.exit(1); });
