#!/usr/bin/env node
/* ============================================================================
 * push_api.js — github.com:443 直连被断时的 Git Data API 推送通道
 *
 * 用法：
 *   node tools/push_api.js --dry   # 只做本地门禁校验：不联网、不上传、不建 commit
 *   node tools/push_api.js         # 真实推送（fast-forward，force=false）
 *
 * 流程：
 *   git credential fill 取 token（仅内存，不落盘、不打印）
 *   → git ls-files -s（读 **index** 的 mode + blob sha，绝不读工作区）
 *   → GET refs/heads/main 取 parent → GET parent commit 的 tree(recursive) 拿远端已有 blob
 *   → 缺失 blob 用 git cat-file blob 取**原始字节** → POST blobs（回读 sha 必须一致）
 *   → POST tree → 校验 tree sha 必须等于本地 HEAD tree（不等即 fail-closed，不提交）
 *   → POST commit（parent = 远端 HEAD）→ PATCH refs/heads/main（force=false）
 *
 * 为什么读 index 而不是工作区（ERR-20261106-012）：
 *   旧版用 fs.readFileSync(工作区) 建 blob。工作区一旦与 index 不一致（CRLF 转换、
 *   未提交改动），推上去的内容就与本地 commit 不同；且旧版没有任何 sha 校验，
 *   错误会静默进远端。现改为直接复用 index 的 blob sha，并对每个上传 blob 回读比对。
 *
 * 历史说明：API 重建的 commit SHA 与本地不同（内容树相同）。网络恢复后
 *   git fetch 成功才可 git reset --hard origin/main 对齐；fetch 非 0 时禁止 reset
 *   （ERR-20261029-003）。Node fetch 默认 IPv6 优先会判 api.github.com 失败 →
 *   设 NODE_OPTIONS=--dns-result-order=ipv4first。
 * ========================================================================== */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path");

const REPO = "TXF182/MapleBirchCE";
const BRANCH = "main";
const ROOT = path.join(__dirname, "..");
const GIT = process.env.GIT_EXE || "C:\\Users\\27352\\Git\\cmd\\git.exe"; // node 子进程 PATH 不含 git
const DRY = process.argv.includes("--dry");

function git(args, opts) {
  return execFileSync(GIT, args, Object.assign({ cwd: ROOT }, opts || {}));
}

function gitText(args) {
  return String(git(args, { encoding: "utf8" })).trim();
}

function tokenFromGitCredential() {
  const input = "protocol=https\nhost=github.com\n\n";
  const out = git(["credential", "fill"], { input, encoding: "utf8" });
  const m = String(out).match(/^password=(.+)$/m);
  if (!m) throw new Error("git credential fill 未返回 password");
  return m[1].trim();
}

async function gh(token, method, urlPath, body) {
  const res = await fetch("https://api.github.com" + urlPath, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
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

/* 读 index：mode + blob sha + path。工作区内容一概不参与 */
function readIndex() {
  const raw = String(git(["ls-files", "-s", "-z"], { encoding: "utf8" }));
  const rows = raw.split("\0").filter(Boolean).map(line => {
    const m = line.match(/^(\d{6}) ([0-9a-f]{40}) (\d)\t(.+)$/);
    if (!m) throw new Error("ls-files 行无法解析: " + line.slice(0, 80));
    return { mode: m[1], sha: m[2], stage: m[3], path: m[4] };
  });
  const unmerged = rows.filter(r => r.stage !== "0");
  if (unmerged.length) {
    throw new Error("index 存在未合并条目（stage≠0），先解决冲突：" + unmerged.map(r => r.path).join(", "));
  }
  return rows.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

(async () => {
  const rows = readIndex();
  const headTree = gitText(["rev-parse", "HEAD^{tree}"]);
  const indexTree = gitText(["write-tree"]); // 只写对象，不改 index

  const indexMatchesHead = indexTree === headTree;
  console.log("index 条目 = " + rows.length);
  console.log("HEAD tree  = " + headTree);
  console.log("index tree = " + indexTree + " / 一致=" + indexMatchesHead);

  if (!indexMatchesHead) {
    throw new Error("index 与 HEAD 不一致（有未提交改动）——先 git add && git commit，再推送");
  }

  if (DRY) {
    console.log("[dry] 门禁通过：index == HEAD，可安全推送（未联网、未上传、未建 commit）");
    console.log("DONE_DRY");
    return;
  }

  const token = tokenFromGitCredential();
  console.log("token 获取成功");

  const ref = await gh(token, "GET", `/repos/${REPO}/git/refs/heads/${BRANCH}`);
  const parent = ref.object.sha;
  console.log("远端 HEAD = " + parent);

  // 远端当前 tree 的全部 blob sha：已有的不再重复上传（truncated 时保守全量上传）
  const parentCommit = await gh(token, "GET", `/repos/${REPO}/git/commits/${parent}`);
  const remoteTree = await gh(token, "GET", `/repos/${REPO}/git/trees/${parentCommit.tree.sha}?recursive=1`);
  const truncated = !!remoteTree.truncated;
  const existing = truncated ? new Set() : new Set((remoteTree.tree || []).map(e => e.sha));
  if (truncated) console.log("远端 tree 列表被截断 → 全量上传");

  let skipped = 0;
  let uploaded = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (existing.has(r.sha)) { skipped++; continue; }
    const buf = git(["cat-file", "blob", r.sha], { maxBuffer: 256 * 1024 * 1024 }); // Buffer，不经编码转换
    const blob = await gh(token, "POST", `/repos/${REPO}/git/blobs`, { content: buf.toString("base64"), encoding: "base64" });
    if (blob.sha !== r.sha) {
      throw new Error("blob sha 不一致: " + r.path + " 本地 " + r.sha + " 远端 " + blob.sha);
    }
    uploaded++;
    if (uploaded % 20 === 0) console.log("  blob 上传 " + uploaded);
  }
  console.log("blob 处理完成：复用 " + skipped + " / 上传 " + uploaded);

  const entries = rows.map(r => ({ path: r.path, mode: r.mode, type: "blob", sha: r.sha }));
  const tree = await gh(token, "POST", `/repos/${REPO}/git/trees`, { tree: entries });
  const treeMatchesHead = tree.sha === headTree;
  console.log("tree = " + tree.sha + " / 本地 HEAD tree = " + headTree + " / 一致=" + treeMatchesHead);
  if (!treeMatchesHead) {
    throw new Error("tree sha 不一致：远端 " + tree.sha + " ≠ 本地 HEAD tree " + headTree + "（拒绝提交）");
  }

  const localMsg = gitText(["log", "-1", "--format=%B", "HEAD"]);
  const MSG = localMsg + "\n\n（通道：Git Data API —— github.com:443 直连失败；内容树 = 本地 HEAD tree，逐 blob sha 校验一致）";
  const commit = await gh(token, "POST", `/repos/${REPO}/git/commits`, {
    message: MSG,
    tree: tree.sha,
    parents: [parent]
  });
  console.log("commit = " + commit.sha);

  const upd = await gh(token, "PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
  console.log("REF_UPDATED " + upd.object.sha + " TREE " + tree.sha);
  console.log("DONE_PUSH");
})().catch(e => { console.error("FAIL: " + e.message); process.exit(1); });
