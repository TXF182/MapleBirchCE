#!/usr/bin/env node
/* ============================================================================
 * push_api_v1823.js — github.com:443 被断时的 Git Data API 推送通道（v1.8.23）
 *
 * 流程（tool-gotchas ERR-20261019-009 实证通道）：
 *   1. git credential fill 从 GCM 取 OAuth token（gho_ 前缀，仅内存不落盘）
 *   2. GET   /repos/{o}/{r}/git/refs/heads/main → 远端 HEAD sha
 *   3. git ls-files 全量跟踪文件 → POST /git/blobs（每个文件一个 blob）
 *   4. POST  /git/trees（一次嵌套路径条目，目录自动建）
 *   5. POST  /git/commits（parent = 远端 HEAD，fast-forward）
 *   6. PATCH /git/refs/heads/main → 远端 main 指向新 commit
 *
 * 注意：API 重建的 commit SHA 与本地不同（内容树相同）；网络恢复后
 * 需 git fetch + git reset --hard origin/main 对齐本地。
 * ========================================================================== */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "TXF182/MapleBirchCE";
const BRANCH = "main";
const ROOT = path.join(__dirname, "..");
const MSG = "v1.8.23 十七巡：3 模组适配器跟进新版（枯木逢春 2.4.4 / 归途之书 1.3.10 / 框架 5.5.3）+ 补录冷月港·泽菲尔线阶段与怨灵·项链已归还";

function tokenFromGitCredential() {
  const input = "protocol=https\nhost=github.com\n\n";
  const out = execFileSync("git", ["credential", "fill"], { input, encoding: "utf8", cwd: ROOT });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error("git credential fill 未返回 password");
  return m[1].trim();
}

async function gh(token, method, urlPath, body) {
  const res = await fetch("https://api.github.com" + urlPath, {
    method,
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "MapleBirchCE-push"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(method + " " + urlPath + " → " + res.status + ": " + txt.slice(0, 300));
  }
  return res.json();
}

(async () => {
  const token = tokenFromGitCredential();
  console.log("token 获取成功（gho_ 前缀）");

  // 1) 远端 HEAD
  const ref = await gh(token, "GET", `/repos/${REPO}/git/refs/heads/${BRANCH}`);
  const parentSha = ref.object.sha;
  console.log("远端 HEAD = " + parentSha);

  // 2) 全量跟踪文件 → blobs（-z NUL 分隔，避免含空格文件名被引号转义）
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", cwd: ROOT })
    .split("\0").filter(Boolean).sort();
  console.log("跟踪文件数 = " + files.length);
  const entries = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(ROOT, f));
    const blob = await gh(token, "POST", `/repos/${REPO}/git/blobs`, { content: content.toString("base64"), encoding: "base64" });
    entries.push({ path: f, mode: "100644", type: "blob", sha: blob.sha });
    if (entries.length % 20 === 0) console.log("  blob " + entries.length + "/" + files.length);
  }
  console.log("blobs 完成");

  // 3) tree
  const tree = await gh(token, "POST", `/repos/${REPO}/git/trees`, { tree: entries });
  console.log("tree = " + tree.sha);

  // 4) commit
  const commit = await gh(token, "POST", `/repos/${REPO}/git/commits`, {
    message: MSG,
    tree: tree.sha,
    parents: [parentSha]
  });
  console.log("commit = " + commit.sha);

  // 5) update ref
  const upd = await gh(token, "PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  console.log("ref 更新成功 → " + upd.object.sha);
  console.log("DONE_PUSH");
})().catch(e => { console.error("FAIL: " + e.message); process.exit(1); });
