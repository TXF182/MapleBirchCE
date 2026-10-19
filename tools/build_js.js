/*
 * 构建脚本：把 javascript/src/*.js 按文件名顺序拼接 → javascript/maplebirchce.js。
 * 用法：node tools/build_js.js [--sync-pkg <打包源目录>]
 *  - 无参：只生成单文件（git 源码真相源）
 *  - --sync-pkg：生成后同时复制到打包源（boot.json/README/twee 需另行同步）
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "javascript", "src");
const OUT = path.join(ROOT, "javascript", "maplebirchce.js");

if (!fs.existsSync(SRC_DIR)) {
  console.error("FATAL: " + SRC_DIR + " 不存在（请检查 javascript/src 开发源目录）");
  process.exit(1);
}
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".js")).sort();
let out = "";
for (const f of files) {
  out += fs.readFileSync(path.join(SRC_DIR, f), "utf8");
}
fs.writeFileSync(OUT, out);
const sha = crypto.createHash("sha256").update(out).digest("hex");
console.log("built " + OUT + "  (" + files.length + " 段, " + Buffer.byteLength(out, "utf8") + " B)");
console.log("SHA256 " + sha);

const idx = process.argv.indexOf("--sync-pkg");
if (idx !== -1 && process.argv[idx + 1]) {
  const pkg = process.argv[idx + 1];
  const dst = path.join(pkg, "javascript", "maplebirchce.js");
  fs.copyFileSync(OUT, dst);
  console.log("synced → " + dst);
}
