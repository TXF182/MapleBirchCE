/*
 * 模组更新检测：对比 MapleBirchCE 适配器声明的第三方模组版本 vs GitHub 最新 Release。
 * 用法：node tools/check_mod_updates.js          # 只检测报告
 *       node tools/check_mod_updates.js --apply  # 检测到更新时，自动下载官方最新包并替换 game 内旧模组包
 * 输出：逐渠道报告（声明版本 / 最新 tag / 结论）+ 总结行 UPDATES: N（供定时任务判断）。
 * --apply 说明：仅替换"检测到更新"的渠道；资产下载走 api.github.com assets 端点（github.com 主域常断）；
 *   资产选择：优先 .modpack 主包（名字含 0.5.12.13-v 且非 audio/fem/mysterious），否则 .mod.zip，
 *   再兜底裸 .zip（Cattery 等仅发 .zip 资产的模组，排除 audio/fem/mysterious 子包）；
 *   替换动作为：删除 game 内匹配旧包 → 放入新包（文件名 = release 资产名）。
 * 说明：检测只改 --apply 模式才落盘；非 --apply 模式不改任何代码、不下载不替换。
 * 10 渠道：9 个适配模组（枯木逢春/归途之书/DomRobin/MLI/SmartPhone/Dol-Optimization/Wraith'sReflection/DoLSims/Cattery）+ 框架本体 maplebirch-framework。
 * 框架渠道声明版本来自 declOverride（实测兼容版本），升版前须跑 check_framework_api.js 核对。
 */
const https = require("https");
const fs = require("fs"), path = require("path");

/* game 目录（DoL-Project 游戏本体），--apply 时替换该目录内的模组包 */
const GAME_DIR = "C:\\Users\\27352\\Doubao\\chats\\2026-10-19\\new-chat\\DoL-Project\\game";
const DOWNLOAD_DIR = path.join(__dirname, "_modcache");

/* 适配器声明自 v1.9.13 起按模组拆分为 src/04a-00-core.js + 04a-01..09-*.js；
   此处读目录下全部 04a-*.js 拼接后解析（与 tools/build_js.js 的 sort 顺序一致） */
const ADAPTER_DIR = path.join(__dirname, "..", "javascript", "src");
const js = fs.readdirSync(ADAPTER_DIR).filter(f => /^04a-.*\.js$/.test(f)).sort()
  .map(f => fs.readFileSync(path.join(ADAPTER_DIR, f), "utf8")).join("\n");

/* 渠道表：适配器 modId → GitHub repo；extract 为从 modName 提取声明版本的匹配。
 * gameGlob：--apply 时在 game 目录匹配旧模组包的文件名模式（用于删除替换）。 */
const CHANNELS = [
  { modId: "deadwood-reblooms", repo: "MaplebirchLeaf/Deadwood-Reblooms",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "deadwood-reblooms-*.modpack" },
  { modId: "revelation-the-book-of-return", repo: "MaplebirchLeaf/Revelation-The-Book-of-Return",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "revelation-the-book-of-return-*.modpack" },
  { modId: "dom_robin", repo: "ZeroRing233/Degrees-of-Lewdity-RobinMod",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "DomRobin.mod.zip" },
  { modId: "more_love_interests", repo: "Nephthelana/DoL-More-Love-Interests-Mod",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "More.Love.Interests.Mod.mod.zip" },
  { modId: "smartphone", repo: "ANLINSTUDIO/Degrees-of-Lewdity-DolSmartPhone",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "SmartPhone.Alpha-*.mod.zip" },
  { modId: "dol-optimization", repo: "ANLINSTUDIO/Degrees-of-Lewdity-DolOptimization",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "Dol-Optimization-*.mod.zip" },
  { modId: "wraiths-reflection", repo: "Water2311/WraithsReflection",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "Wraith.sReflection.mod.zip" },
  { modId: "dolsims", repo: "MissedHeart/Degrees-of-Lewdity-DolSims",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "DoLSims.mod.zip" },
  { modId: "cattery", repo: "Maomaoi/Degrees-of-Lewdity-Cattery",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "Cattery*.zip" },
  { modId: "more-farm-upgrade", repo: "Qsx0391/DOL-More-Farm-Upgrade-Mod",
    extractDecl: /(\d+(?:\.\d+)+)/, gameGlob: "MoreFarmUpgrade*.zip" },
  { modId: "maplebirch-framework", repo: "MaplebirchLeaf/SCML-DOL-maplebirchFramework",
    /* 框架本体（非适配器）：declOverride = 本地实测兼容版本。升版前必须跑
       `node tools/check_framework_api.js <新版 inject_early.js>` 核对 CE 依赖的
       API（maplebirch.get / .npc / .temporary.traitLists / window.maplebirch）
       全部保留后再更新此值。5.5.6 已核对兼容（2026-10-25，治理收尾轮）：
       核心 8 项全过（window.maplebirch / get / npc(.data) / temporary / traitLists /
       define / frameworkNotice），setup.MapleBirch / maplebirch.patch 缺失均为
       非 CE 依赖（CE 0 次调用 patch；setup.MapleBirch 仅 01-core.js resolveMB()
       的兜底分支，window.maplebirch 主路径存在时永不触发），与 5.5.3/5.5.4/5.5.5
       核对结果一致，缺失无害。 */
    declOverride: "5.5.7", gameGlob: "maplebirch-*.mod.zip" }
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

/* GitHub token 获取：优先环境变量 GITHUB_TOKEN；否则从本机 GCM 取（git credential fill 通道，
 * tool-gotchas 实证：PS 下会交互挂起，Node execFileSync 通道正常）。仅内存使用，不落盘不外泄。 */
function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const cp = require("child_process");
    const out = cp.execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=api.github.com\n\n",
      encoding: "utf8", timeout: 10000, stdio: ["pipe", "pipe", "ignore"]
    });
    const m = out.match(/^password=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch (e) { return null; }
}

const _TOKEN = getGitHubToken();

function getLatestTag(repo) {
  return new Promise(function (resolve) {
    const headers = { "User-Agent": "MapleBirchCE-mod-update-check", "Accept": "application/vnd.github+json" };
    /* 可选：GITHUB_TOKEN 环境变量或本机 GCM（仅内存使用，不落盘），规避未认证 API 速率限制（403） */
    if (_TOKEN) headers["Authorization"] = "token " + _TOKEN;
    https.get("https://api.github.com/repos/" + repo + "/releases/latest", { headers: headers }, function (res) {
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

/* 文件名通配匹配（仅 * 与 . ） */
function globMatch(name, pattern) {
  const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  return re.test(name);
}

/* --apply：从 release assets 中挑主包（.modpack 优先且非 audio/fem/mysterious 子包，否则 .mod.zip，再兜底裸 .zip） */
function pickAsset(assets) {
  if (!assets || !assets.length) return null;
  const mp = assets.filter(function (a) { return a.name.indexOf(".modpack") !== -1; });
  if (mp.length) {
    const main = mp.filter(function (a) {
      return /0\.5\.12\.13-v/.test(a.name) && !/audio|fem|mysterious/i.test(a.name);
    });
    if (main.length) return main[0];
    mp.sort(function (a, b) { return b.size - a.size; });
    return mp[0];
  }
  const z = assets.filter(function (a) { return a.name.indexOf(".mod.zip") !== -1; });
  if (z.length) {
    z.sort(function (a, b) { return b.size - a.size; });
    return z[0];
  }
  /* 兜底：Cattery 等仅发布裸 .zip 资产的模组（资产名常含版本/特性后缀） */
  const z2 = assets.filter(function (a) {
    return a.name.indexOf(".zip") !== -1 && !/audio|fem|mysterious/i.test(a.name);
  });
  if (!z2.length) return null;
  z2.sort(function (a, b) { return b.size - a.size; });
  return z2[0];
}

/* --apply：经 api.github.com assets 端点下载（github.com 主域常断）；GitHub 返回 302 时递归跟随重定向。
 * 落盘后校验文件大小与 release asset.size 一致，防止"假成功"（响应流中断但 finish 触发）。 */
function downloadAsset(repo, asset, destPath, depth) {
  depth = depth || 0;
  return new Promise(function (resolve) {
    const headers = { "User-Agent": "MapleBirchCE-mod-update-check", "Accept": "application/octet-stream" };
    /* 可选：GITHUB_TOKEN 环境变量或本机 GCM（仅内存使用，不落盘），规避未认证 API 速率限制（403） */
    if (_TOKEN && (depth === 0)) headers["Authorization"] = "token " + _TOKEN;
    const req = https.get("https://api.github.com/repos/" + repo + "/releases/assets/" + asset.id, {
      headers: headers
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); /* 丢弃重定向响应体 */
        if (depth >= 3) { resolve({ error: "重定向超过 3 次" }); return; }
        const req2 = https.get(res.headers.location, {
          headers: { "User-Agent": "MapleBirchCE-mod-update-check" }
        }, function (res2) {
          if (res2.statusCode !== 200) { resolve({ error: "HTTP " + res2.statusCode }); return; }
          const f = fs.createWriteStream(destPath);
          res2.pipe(f);
          f.on("finish", function () {
            f.close(function () {
              let size = -1;
              try { size = fs.statSync(destPath).size; } catch (e) {}
              if (size !== asset.size) {
                resolve({ error: "下载大小不符（期望 " + asset.size + "，实际 " + size + "）" });
              } else {
                resolve({ ok: true, size: size });
              }
            });
          });
          f.on("error", function (e) { resolve({ error: e.message }); });
        });
        req2.on("error", function (e) { resolve({ error: e.message }); });
        req2.setTimeout(60000, function () { req2.destroy(new Error("下载超时 60s")); });
        return;
      }
      if (res.statusCode !== 200) { resolve({ error: "HTTP " + res.statusCode }); return; }
      const f = fs.createWriteStream(destPath);
      res.pipe(f);
      f.on("finish", function () {
        f.close(function () {
          let size = -1;
          try { size = fs.statSync(destPath).size; } catch (e) {}
          if (size !== asset.size) {
            resolve({ error: "下载大小不符（期望 " + asset.size + "，实际 " + size + "）" });
          } else {
            resolve({ ok: true, size: size });
          }
        });
      });
      f.on("error", function (e) { resolve({ error: e.message }); });
    });
    req.on("error", function (e) { resolve({ error: e.message }); });
    req.setTimeout(30000, function () { req.destroy(new Error("API 请求超时 30s")); });
  });
}

/* --apply：删除 game 内匹配旧包（同名新文件不删），返回被移除的旧文件名 */
function replaceInGame(gameGlob, newFileName) {
  const removed = [];
  const names = fs.readdirSync(GAME_DIR);
  for (const f of names) {
    if (f === newFileName) continue;
    if (globMatch(f, gameGlob)) {
      fs.unlinkSync(path.join(GAME_DIR, f));
      removed.push(f);
    }
  }
  return removed;
}

(async function () {
  const APPLY = process.argv.indexOf("--apply") !== -1;
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
    if (c < 0) {
      row.note = "有更新（最新 " + tv + " > 声明 " + decl + "）";
      updates++;
      if (APPLY) {
        /* 框架渠道不自动替换：升版前必须人工跑 check_framework_api.js 核对 CE 依赖的 API 兼容 */
        if (ch.modId === "maplebirch-framework") {
          row.apply = "SKIP：框架升版需先跑 check_framework_api.js 核对 API 兼容，再人工替换";
        } else {
          const asset = pickAsset(rel.assets || []);
          if (!asset) { row.apply = "FAIL：release 无 .modpack/.mod.zip/.zip 资产，需人工下载"; }
          else {
            const destPath = path.join(DOWNLOAD_DIR, asset.name);
            const dl = await downloadAsset(ch.repo, asset, destPath);
            if (dl.error) { row.apply = "FAIL：下载失败 " + dl.error; }
            else {
              let removed = [];
              try { removed = replaceInGame(ch.gameGlob, asset.name); }
              catch (e) { row.apply = "FAIL：替换 game 旧包失败 " + e.message; continue; }
              fs.copyFileSync(destPath, path.join(GAME_DIR, asset.name));
              row.apply = "OK：已下载 " + asset.name + " 并替换 game 旧包" +
                (removed.length ? "（移除 " + removed.join(", ") + "）" : "（game 内无旧包）");
            }
          }
        }
      }
    }
    else if (c > 0) { row.note = "声明高于最新（声明 " + decl + " > 最新 " + tv + "）——可能声明超前，需人工核对"; }
    else { row.note = "无更新（均为 " + decl + "）"; }
    rows.push(row);
  }
  console.log("===== MapleBirchCE 适配模组更新检测 " + new Date().toISOString() + (APPLY ? " [--apply]" : "") + " =====");
  for (const r of rows) {
    console.log("[" + r.modId + "] " + (r.decl || "?") + " / " + (r.tag || "?") + " → " + r.note + (r.apply ? " | " + r.apply : ""));
  }
  console.log("UPDATES: " + updates);
})().catch(function (e) { console.error(e); process.exit(1); });
