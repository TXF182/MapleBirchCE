#!/usr/bin/env node
/* ============================================================================
 * release.js — MapleBirchCE 一键发布（参数化，替代 release_v*.js 逐版复制模板）
 * 用法：
 *   node tools/release.js [--version 1.9.17] [--dry]
 *   --version 缺省时自动读 javascript/src/01-core.js 的 MCE_VERSION
 *   --dry 只打印将执行的步骤与 body 预览，不调用任何 GitHub API
 * 流程：git credential fill 取 token（仅内存）→ 读 zip 的 SHA256/size →
 *       POST /releases（新 tag v<version>；中文 body 需 charset=utf-8）→
 *       Buffer 直发上传资产（禁止 JSON.stringify(Buffer)）→ 核对 asset.size →
 *       api.github.com assets 端点回读 SHA256 与本地一致。
 * 坑位（tool-gotchas）：github.com:443 被断时回读走 api.github.com assets 端点；
 *       运行前设 NODE_OPTIONS=--dns-result-order=ipv4first（IPv6 半通环境）。
 * 资产名沿用 MapleBirchCE.mod.zip（ModLoader 安装路径不变）。
 * ========================================================================== */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = "TXF182/MapleBirchCE";
const ASSET = "MapleBirchCE.mod.zip";
const ROOT = path.join(__dirname, "..");
const GIT = process.env.GIT_EXE || "C:\\Users\\27352\\Git\\cmd\\git.exe"; // 本机 git 绝对路径（node 子进程 PATH 不含 git）

/* ---------- 参数 ---------- */
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const vi = args.indexOf("--version");
const VERSION = vi >= 0 && args[vi + 1] ? args[vi + 1]
  : fs.readFileSync(path.join(ROOT, "javascript", "src", "01-core.js"), "utf8")
      .match(/MCE_VERSION = "([^"]+)"/)[1];
const TAG = "v" + VERSION;

const ZIP = path.join(ROOT, ASSET);
if (!fs.existsSync(ZIP)) { console.error("FAIL: 打包产物缺失 " + ZIP + "（先跑 tools/pack.ps1）"); process.exit(2); }
const LOCAL_SIZE = fs.statSync(ZIP).size;
const LOCAL_SHA = crypto.createHash("sha256").update(fs.readFileSync(ZIP)).digest("hex").toUpperCase();

/* ---------- Release body 自动取 CHANGELOG 对应版本章节 ---------- */
function extractBody(version) {
  const md = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
    const re = new RegExp("## v" + version.replace(/\./g, "\\.") + "[^\\n]*\\n([\\s\\S]*?)(?=\\n## v|$)");
  const m = re.exec(md);
  if (!m) { console.error("FAIL: CHANGELOG 无 ## v" + version + " 章节"); process.exit(2); }
  return "**MapleBirchCE v" + version + "**（" + new Date().toISOString().slice(0, 10) + "）\n\n" + m[1].trim();
}

function tokenFromGitCredential() {
  const input = "protocol=https\nhost=github.com\n\n";
  const out = execFileSync(GIT, ["credential", "fill"], { input, encoding: "utf8", cwd: ROOT });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error("git credential fill 未返回 password");
  return m[1].trim();
}

async function gh(token, method, urlPath, body, rawBody) {
  const res = await fetch("https://api.github.com" + urlPath, {
    method,
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      ...(rawBody ? {} : { "Content-Type": "application/json; charset=utf-8" }),
      "User-Agent": "MapleBirchCE-release"
    },
    body: rawBody || (body === undefined ? undefined : JSON.stringify(body))
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(method + " " + urlPath + " → " + res.status + ": " + txt.slice(0, 300));
  }
  return res.json();
}

(async () => {
  const body = extractBody(VERSION);
  console.log("版本 " + VERSION + " | 资产 " + LOCAL_SIZE + " B | SHA256=" + LOCAL_SHA);
  console.log("Release body 预览（前 3 行）：");
  console.log(body.split("\n").slice(0, 3).map(l => "  " + l).join("\n"));
  console.log("tag: " + TAG);
  if (DRY) { console.log("DRY RUN —— 未调用任何 API。"); process.exit(0); }

  const token = tokenFromGitCredential();
  console.log("token 获取成功（gho_ 前缀）");

  /* 1) 建 Release */
  const release = await gh(token, "POST", `/repos/${REPO}/releases`, {
    tag_name: TAG,
    name: "MapleBirchCE v" + VERSION,
    body
  });
  console.log("release 创建 → " + release.html_url);

  /* 2) 上传资产（Buffer 直发，禁止 JSON.stringify(Buffer)） */
  const upload = await fetch(release.upload_url.replace("{?name,label}", "?name=" + encodeURIComponent(ASSET)), {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/zip",
      "User-Agent": "MapleBirchCE-release"
    },
    body: fs.readFileSync(ZIP)
  });
  if (!upload.ok) { throw new Error("upload → " + upload.status + ": " + (await upload.text()).slice(0, 300)); }
  const asset = await upload.json();
  if (asset.size !== LOCAL_SIZE) {
    throw new Error("FAIL: asset.size " + asset.size + " ≠ 本地 " + LOCAL_SIZE + "（传输损坏）");
  }
  console.log("资产上传 ok size=" + asset.size + " B");

  /* 3) api.github.com assets 端点回读 SHA256 比对 */
  const dl = await fetch("https://api.github.com/repos/" + REPO + "/releases/assets/" + asset.id, {
    headers: { "Authorization": "Bearer " + token, "Accept": "application/octet-stream", "User-Agent": "MapleBirchCE-release" }
  });
  if (!dl.ok) { throw new Error("回读 → " + dl.status); }
  const buf = Buffer.from(await dl.arrayBuffer());
  const backSha = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
  console.log("回读 SHA256=" + backSha);
  if (backSha !== LOCAL_SHA) { throw new Error("FAIL: 回读 SHA 与本地不一致"); }
  console.log("SHA256 回读一致 ✓ | DONE_RELEASE");
})().catch(e => { console.error("FAIL: " + e.message); process.exit(1); });
