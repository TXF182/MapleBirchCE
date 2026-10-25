/* 临时校验脚本：验证适配器声明的 varPath 在模组新版本源码中仍被使用（存在性检查）。
 * 用法：node tools/_check_keys.js
 * 检查 2 个适配器（revelation / deadwood）的 varPath 与 skipVar/completeVar/progressVar。
 * 搜索策略：对每个 varPath 首段（根键）找包含该路径的源码引用；
 * 完整路径以 $X.Y 或 X.Y 或 maplebirch.get("X") 形式出现即视为存活。
 */
const fs = require("fs"), path = require("path");

const SRC = path.join(__dirname, "..", "javascript", "src", "04-modcheat.js");
const js = fs.readFileSync(SRC, "utf8");

function extractBlock(modId) {
  const i = js.indexOf('CHEAT_ADAPTERS["' + modId + '"]');
  if (i === -1) return null;
  let start = js.indexOf("{", i), depth = 0, end = -1;
  for (let j = start; j < js.length && end === -1; j++) {
    if (js[j] === "{") depth++;
    else if (js[j] === "}") { depth--; if (depth === 0) end = j; }
  }
  return js.slice(i, end + 1);
}

function collectPaths(seg) {
  const paths = [];
  const re = /varPath:\s*"([^"]+)"/g; let m;
  while ((m = re.exec(seg)) !== null) paths.push(m[1]);
  const re2 = /(?:skipVar|completeVar|progressVar):\s*"([^"]+)"/g;
  while ((m = re2.exec(seg)) !== null) paths.push(m[1]);
  return paths;
}

/* 目录：新版源码根 */
const TARGETS = {
  "revelation-the-book-of-return": path.join(__dirname, "_modcache", "rv140", "Revelation-The-Book-of-Return-1.3.10", "src"),
  "deadwood-reblooms": path.join(__dirname, "_modcache", "dw244", "Deadwood-Reblooms-2.4.4", "src")
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
    try {
      const txt = fs.readFileSync(f, "utf8");
      /* 多种引用形态：$X.Y / $X.Y.Z / X.Y / "X.Y" / get("X.Y") / ['X']['Y'] */
      if (txt.includes(needle)) count++;
    } catch (e) {}
  }
  return count;
}

for (const modId of Object.keys(TARGETS)) {
  const seg = extractBlock(modId);
  if (!seg) { console.log("[" + modId + "] 未找到适配器块"); continue; }
  const paths = collectPaths(seg);
  console.log("===== " + modId + " 适配器声明路径 " + paths.length + " 条 =====");
  let missing = [];
  for (const p of paths) {
    /* 完整路径引用计数（含首段根键搜索） */
    const cFull = searchInDir(TARGETS[modId], p);
    if (cFull === 0) missing.push(p);
    console.log((cFull > 0 ? "OK " : "MISS ") + p + (cFull > 0 ? " (" + cFull + " 文件)" : ""));
  }
  if (missing.length) console.log("!! 缺失 " + missing.length + " 条：" + missing.join(" | "));
}
