/*
 * 版本双源门禁（tools/lib/guard.js）单元测试
 *
 * 背景（2026-11-22）：v2.2.0 发布当天，boot.json 与 javascript/src/01-core.js 在 commit 之后、
 * release 之前从工作区消失（根因未锁定，已排除仓库内全部脚本/git hook/Defender）。后果是
 * release.js 直接 ENOENT；更危险的是 push_api.js 读 index、release.js 读工作区，
 * 两者若被「恢复成旧版」，会静默推出/发布错误版本，而 release.js 只校验 zip 与本地 SHA 一致
 * （zip 本身不含双源，抓不到双源与产物版本对不上）。
 *
 * 做法：%TEMP% 下建一个真实 git 夹具（git init + commit），每个场景前用 checkout -f 复位，
 *       不碰仓库自身文件；逐场景构造「缺失 / 损坏 / 双源不一致 / 工作区与 HEAD 不一致 /
 *       README 滞后 / git 不可用」，断言 checkVersionSources 全部 fail-closed。
 *
 * 用法：node tests/tools_guard.js
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const GUARD = require(path.join(ROOT, "tools", "lib", "guard.js"));

const GIT = process.env.GIT_EXE || (process.platform === "win32"
  ? "C:\\Users\\27352\\Git\\cmd\\git.exe"
  : "git");

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS: " + msg); }
  else { failures++; console.error("FAIL: " + msg); }
}

const BOOT = "boot.json";
const CORE = path.join("javascript", "src", "01-core.js");
const README = "README.md";

function git(dir, args, opts) {
  return execFileSync(GIT, args, Object.assign({ cwd: dir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }, opts || {}));
}

function writeBoot(dir, version, name) {
  const obj = { name: name, version: version, scriptFileList_inject_early: ["javascript/maplebirchce.js"] };
  fs.writeFileSync(path.join(dir, BOOT), JSON.stringify(obj, null, 2) + "\n");
}

function writeCore(dir, version) {
  fs.writeFileSync(path.join(dir, CORE), '/* test fixture */\nvar MCE_VERSION = "' + version + '";\n');
}

/* 夹具只 init 一次（Windows 上 git init/commit 各约 1 s，13 个场景各建一次会拖慢全链），
   场景之间用 checkout -f + clean 复位到基线。 */
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mce-guard-"));
  fs.mkdirSync(path.join(dir, "javascript", "src"), { recursive: true });
  writeBoot(dir, "2.2.0", "MapleBirchCE");
  writeCore(dir, "2.2.0");
  fs.writeFileSync(path.join(dir, README), "# Maplebirch CE\n\n**当前版本：v2.2.0**（完整记录见 CHANGELOG.md）\n");
  git(dir, ["init", "-q"]);
  git(dir, ["config", "core.autocrlf", "false"]);   // 本机全局 autocrlf=true，会让「字节一致」的语义变模糊
  git(dir, ["config", "user.email", "guard-test@local"]);
  git(dir, ["config", "user.name", "guard-test"]);
  git(dir, ["add", "-A"]);
  git(dir, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "base"]);
  return dir;
}

function reset(dir) {
  git(dir, ["checkout", "-f", "-q", "HEAD"]);
  git(dir, ["clean", "-fdq"]);
}

function run(dir, opts) {
  try { return GUARD.checkVersionSources(dir, Object.assign({ git: GIT }, opts || {})); }
  catch (e) { return { ok: false, errors: ["THROWN: " + e.message], info: {} }; }
}

function hasError(result, needle) {
  return result.ok === false && result.errors.some(e => e.indexOf(needle) !== -1);
}

const FIX = fixture();

/* ---------- 1. 基线：双源齐备、版本一致、工作区与 HEAD 一致、README 一致 ---------- */
{
  reset(FIX);
  const r = run(FIX, { requireReadme: true });
  assert(r.ok === true && r.errors.length === 0, "1.1 基线全绿（无错误）");
  assert(r.info.bootVersion === "2.2.0", "1.2 boot.json 版本读取 = 2.2.0");
  assert(r.info.coreVersion === "2.2.0", "1.3 01-core.js MCE_VERSION = 2.2.0");
  assert(r.info.readmeVersion === "2.2.0", "1.4 README 版本标记解析 = 2.2.0");
}

/* ---------- 2. boot.json 被删（本次事故形态之一） ---------- */
{
  reset(FIX);
  fs.unlinkSync(path.join(FIX, BOOT));
  const r = run(FIX);
  assert(hasError(r, "boot.json"), "2.1 boot.json 缺失 → 报错且点名文件");
  assert(r.info.bootVersion === null, "2.2 缺失时 bootVersion 返回 null（不猜版本）");
}

/* ---------- 3. 01-core.js 被删（本次事故形态之二） ---------- */
{
  reset(FIX);
  fs.unlinkSync(path.join(FIX, CORE));
  const r = run(FIX);
  assert(hasError(r, "01-core.js"), "3.1 01-core.js 缺失 → 报错且点名文件");
}

/* ---------- 4. boot.json JSON 损坏：不能当成「有版本」 ---------- */
{
  reset(FIX);
  fs.writeFileSync(path.join(FIX, BOOT), "{ \"name\": \"x\", \"version\": ");
  const r = run(FIX);
  assert(hasError(r, "JSON"), "4.1 boot.json 非法 JSON → 报 JSON 解析失败");
}

/* ---------- 5. 01-core.js 丢了 MCE_VERSION ---------- */
{
  reset(FIX);
  fs.writeFileSync(path.join(FIX, CORE), "/* 版本行被删 */\nvar OTHER = 1;\n");
  const r = run(FIX);
  assert(hasError(r, "MCE_VERSION"), "5.1 01-core.js 无 MCE_VERSION → 报错（不返回 undefined）");
}

/* ---------- 6. 双源不一致（AGENTS.md 纪律：两处必须同步） ---------- */
{
  reset(FIX);
  writeBoot(FIX, "2.3.0", "MapleBirchCE");
  const r = run(FIX);
  assert(hasError(r, "不一致"), "6.1 boot.json 2.3.0 vs 01-core.js 2.2.0 → 报双源不一致");
}

/* ---------- 7. 工作区与 HEAD 不一致（被外部恢复成旧版 / 被改过） ---------- */
{
  reset(FIX);
  writeBoot(FIX, "2.2.0", "MapleBirchCE-EXTRA-FIELD");   // version 不变，内容变了
  const r = run(FIX);
  assert(hasError(r, "与 HEAD 不一致"), "7.1 工作区 boot.json 内容≠HEAD → 报工作区不一致");
}

{
  reset(FIX);
  fs.writeFileSync(path.join(FIX, CORE), '/* 外部追加 */\nvar MCE_VERSION = "2.2.0";\n');
  const r = run(FIX);
  assert(hasError(r, "与 HEAD 不一致"), "7.2 工作区 01-core.js 内容≠HEAD → 报工作区不一致");
}

/* ---------- 8. 工作区文件被删但 HEAD 里有（D 状态） ---------- */
{
  reset(FIX);
  fs.unlinkSync(path.join(FIX, CORE));
  const r = run(FIX);
  assert(hasError(r, "与 HEAD 不一致"), "8.1 HEAD 有该文件而工作区没有 → 报工作区不一致");
}

/* ---------- 9. README 版本标记 ---------- */
{
  reset(FIX);
  fs.writeFileSync(path.join(FIX, README), "# Maplebirch CE\n\n**当前版本：v2.1.9**（旧）\n");
  const r = run(FIX, { requireReadme: true });
  assert(hasError(r, "README"), "9.1 README 滞后 + requireReadme → 报错（发布门禁不能放行）");
  assert(r.info.readmeVersion === "2.1.9", "9.2 仍能读出 README 的实际版本（便于定位差在哪）");

  const r2 = run(FIX, { requireReadme: false });
  assert(r2.ok === true, "9.3 非发布场景（requireReadme=false）README 滞后不阻断");
}

{
  reset(FIX);
  fs.writeFileSync(path.join(FIX, README), "# Maplebirch CE\n\n没有版本标记的说明\n");
  const r = run(FIX, { requireReadme: true });
  assert(hasError(r, "README"), "9.4 README 无版本标记 → 报错（不能空过）");
}

/* ---------- 10. git 不可用：必须报错，不能静默降级成「只查存在性」 ---------- */
{
  reset(FIX);
  let r;
  try { r = GUARD.checkVersionSources(FIX, { git: "git-that-does-not-exist-12345", requireReadme: false }); }
  catch (e) { r = { ok: false, errors: ["git 不可用: " + e.message] }; }
  assert(r.ok === false, "10.1 git 不可用 → 整体不通过");
  assert(r.errors.some(e => e.indexOf("HEAD") !== -1 || e.indexOf("git") !== -1 || e.indexOf("blob") !== -1),
    "10.2 错误信息指向 HEAD/blob 校验失败（可定位）");
}

/* ---------- 11. ensureVersionSources：fail-closed 抛错并带可读原因 ---------- */
{
  reset(FIX);
  fs.unlinkSync(path.join(FIX, BOOT));
  let thrown = null;
  try { GUARD.ensureVersionSources(FIX, { git: GIT }); } catch (e) { thrown = e; }
  assert(!!thrown && thrown.message.indexOf("boot.json") !== -1, "11.1 ensureVersionSources 缺失即抛错并点名文件");

  reset(FIX);
  const r = GUARD.ensureVersionSources(FIX, { git: GIT, requireReadme: true });
  assert(r.ok === true, "11.2 齐备时 ensureVersionSources 正常返回（不误伤）");
}

/* ---------- 12. 真实仓库自检：双源与 README 必须一致 ---------- */
{
  // requireWorktree=false：升版的改动在 commit 之前本就与 HEAD 不同，那是发布前置条件（push/release
  // 各自用严格模式校验），不是双源错误。若这里要求真实仓库工作区等于 HEAD，每次升版都会误红，
  // 属于测试把「已提交」当断言。工作区≠HEAD 的 fail-closed 逻辑由 7.1/7.2/8.1 的临时夹具覆盖。
  const r = run(ROOT, { requireReadme: true, requireWorktree: false });
  assert(r.ok === true, "12.1 真实仓库双源/README 门禁通过（当前 " + r.info.bootVersion + "）");
  assert(r.info.bootVersion === r.info.coreVersion, "12.2 真实仓库双源版本一致");

  const strict = run(ROOT, { requireReadme: true, requireWorktree: true });
  if (!strict.ok) {
    assert(strict.errors.every(e => e.indexOf("HEAD") !== -1),
      "12.3 严格门禁若因未提交改动失败，错误只指向 HEAD 不一致（不误报双源/README）");
  } else {
    assert(true, "12.3 工作区与 HEAD 一致，严格门禁通过");
  }
}

try { fs.rmSync(FIX, { recursive: true, force: true }); } catch (e) { /* 临时目录，删不掉不影响断言 */ }

if (failures) { console.error("\n" + failures + " 项失败"); process.exit(1); }
console.log("\nALL GUARD CHECKS PASSED");
process.exit(0);
