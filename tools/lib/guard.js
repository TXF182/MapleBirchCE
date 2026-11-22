"use strict";
/* ============================================================================
 * guard.js — 版本双源门禁（fail-closed），供 push_api.js / release.js / 测试共用
 *
 * 为什么需要（2026-11-22 事故）：boot.json 与 javascript/src/01-core.js 在 commit 之后、
 * release 之前从工作区消失。整条发布链当时没有一处会因此停下 ——
 *   · push_api.js 读 index，工作区缺文件不影响它，可照样推；
 *   · release.js 直接读工作区取 MCE_VERSION，文件不在就原生 ENOENT（本次是这一层卡住的），
 *     若被「恢复成旧版」则更糟：会用旧版本号建 Release，而 zip 与其 SHA 都自洽，看不出错版。
 * 于是把「双源存在 + 可解析 + 双方一致 + 工作区与 HEAD 字节一致（发布还要求 README 标记一致）」
 * 收敛成一个前置断言，任何一条不满足即抛错，让流程停下来而不是带病继续。
 *
 * 判据全部来自磁盘与 git 对象，不读缓存、不猜默认版本：
 *   · 存在性：fs.existsSync
 *   · 可解析性：JSON.parse / MCE_VERSION 正则
 *   · 双源一致：boot.json.version === 01-core.js 的 MCE_VERSION
 *   · 工作区一致：git hash-object（应用 attributes 的 clean 语义后的 blob sha）
 *                  === git rev-parse HEAD:<path>
 *     —— 比 git status 文本判据更硬：既抓「工作区被删」，也抓「文件在但内容被换成别的版本」。
 * ========================================================================== */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BOOT_REL = "boot.json";
const CORE_REL = "javascript/src/01-core.js";
const README_REL = "README.md";

/* 与 push_api.js / release.js 保持同一默认（node 子进程 PATH 不含 git 是历史口径） */
const DEFAULT_GIT = process.env.GIT_EXE
  || (process.platform === "win32" ? "C:\\Users\\27352\\Git\\cmd\\git.exe" : "git");

function gitTry(git, root, args) {
  try {
    return String(execFileSync(git, args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    })).trim();
  } catch (e) {
    return null;
  }
}

function readBootVersion(root, errors) {
  const p = path.join(root, BOOT_REL);
  if (!fs.existsSync(p)) { errors.push(BOOT_REL + " 不存在（版本双源缺失）"); return null; }
  let obj;
  try { obj = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { errors.push(BOOT_REL + " JSON 解析失败：" + e.message); return null; }
  const v = obj && typeof obj.version === "string" ? obj.version.trim() : "";
  if (!v) { errors.push(BOOT_REL + " 缺少字符串字段 version"); return null; }
  return v;
}

function readCoreVersion(root, errors) {
  const p = path.join(root, CORE_REL);
  if (!fs.existsSync(p)) { errors.push(CORE_REL + " 不存在（版本双源缺失）"); return null; }
  let text = "";
  try { text = fs.readFileSync(p, "utf8"); }
  catch (e) { errors.push(CORE_REL + " 读取失败：" + e.message); return null; }
  const m = text.match(/MCE_VERSION\s*=\s*"([^"]+)"/);
  if (!m) { errors.push(CORE_REL + " 缺少 MCE_VERSION 声明"); return null; }
  return m[1].trim();
}

function readReadmeVersion(root) {
  const p = path.join(root, README_REL);
  if (!fs.existsSync(p)) { return null; }
  const m = fs.readFileSync(p, "utf8").match(/当前版本：\s*v?([0-9][0-9A-Za-z.\-]*)/);
  return m ? m[1].trim() : null;
}

/* 工作区两个文件必须与 HEAD 的 blob 字节一致（hash-object 会应用 .gitattributes 的 clean 规则，
   所以 CRLF 规范化不会造成假阳性；内容被替换或文件被删都必然不一致） */
function checkWorktreeMatchesHead(git, root, errors) {
  [BOOT_REL, CORE_REL].forEach(function (rel) {
    const head = gitTry(git, root, ["rev-parse", "HEAD:" + rel]);
    if (!head) {
      errors.push(rel + " 不在 HEAD 中（尚未提交，无法校验工作区一致性）");
      return;
    }
    const work = gitTry(git, root, ["hash-object", "--", rel]);
    if (!work) {
      errors.push(rel + " 工作区无法计算 blob（文件缺失或 git 不可用）→ 与 HEAD 不一致");
      return;
    }
    if (head !== work) {
      errors.push(rel + " 工作区与 HEAD 不一致（HEAD " + head.slice(0, 12) + " ≠ 工作区 " + work.slice(0, 12)
        + "）—— 可能被外部改动/恢复旧版，先 git checkout -- " + rel);
    }
  });
}

function checkVersionSources(root, opts) {
  const o = opts || {};
  const git = o.git || DEFAULT_GIT;
  const errors = [];
  const info = { bootVersion: null, coreVersion: null, readmeVersion: null, git: git };

  info.bootVersion = readBootVersion(root, errors);
  info.coreVersion = readCoreVersion(root, errors);
  if (info.bootVersion && info.coreVersion && info.bootVersion !== info.coreVersion) {
    errors.push("版本双源不一致：boot.json=" + info.bootVersion + " / 01-core.js=" + info.coreVersion);
  }

  if (o.requireWorktree !== false) {
    checkWorktreeMatchesHead(git, root, errors);
  }

  if (o.requireReadme) {
    info.readmeVersion = readReadmeVersion(root);
    if (!info.readmeVersion) {
      errors.push(README_REL + " 缺少版本标记「当前版本：vX.Y.Z」");
    } else if (info.bootVersion && info.readmeVersion !== info.bootVersion) {
      errors.push(README_REL + " 版本标记滞后：README=" + info.readmeVersion + " / 双源=" + info.bootVersion);
    }
  }

  return { ok: errors.length === 0, errors: errors, info: info };
}

function ensureVersionSources(root, opts) {
  const r = checkVersionSources(root, opts);
  if (!r.ok) {
    const err = new Error("版本双源门禁未通过：\n  - " + r.errors.join("\n  - "));
    err.guard = r;
    throw err;
  }
  return r;
}

module.exports = {
  checkVersionSources: checkVersionSources,
  ensureVersionSources: ensureVersionSources,
  readBootVersion: readBootVersion,
  readCoreVersion: readCoreVersion,
  readReadmeVersion: readReadmeVersion,
  BOOT_REL: BOOT_REL,
  CORE_REL: CORE_REL,
  README_REL: README_REL
};
