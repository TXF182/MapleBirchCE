#!/usr/bin/env node
/* ============================================================================
 * push_api_v1911.js — github.com:443 被断时的 Git Data API 推送通道（v1.9.11）
 * 流程：git credential fill 取 token（仅内存）→ 远端 refs/heads/main SHA →
 *       git ls-files 全量 → POST blobs → POST tree → POST commit（parent=远端 HEAD）
 *       → PATCH refs（fast-forward）
 * 注意：API 重建 commit SHA 与本地不同（内容树相同）；网络恢复后
 *       git fetch + git reset --hard origin/main 对齐本地。
 *       Node fetch 默认 IPv6 优先会把 api.github.com 判失败 → 设
 *       NODE_OPTIONS=--dns-result-order=ipv4first。
 * ========================================================================== */
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "TXF182/MapleBirchCE";
const BRANCH = "main";
const ROOT = path.join(__dirname, "..");
const MSG = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8", cwd: ROOT }).trim();

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

  const ref = await gh(token, "GET", `/repos/${REPO}/git/refs/heads/${BRANCH}`);
  const parentSha = ref.object.sha;
  console.log("远端 HEAD = " + parentSha);

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

  const tree = await gh(token, "POST", `/repos/${REPO}/git/trees`, { tree: entries });
  console.log("tree = " + tree.sha);

  const commit = await gh(token, "POST", `/repos/${REPO}/git/commits`, {
    message: MSG,
    tree: tree.sha,
    parents: [parentSha]
  });
  console.log("commit = " + commit.sha);

  const upd = await gh(token, "PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  console.log("ref 更新成功 → " + upd.object.sha);
  console.log("DONE_PUSH");
})().catch(e => { console.error("FAIL: " + e.message); process.exit(1); });
