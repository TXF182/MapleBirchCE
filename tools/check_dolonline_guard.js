/*
 * DoLOnline 拦截集成体检
 *
 * 目的：回答一个可证伪的问题——「作者发的新包里，dgac 拦截是否真的装进去了、真的覆盖了写入点」。
 * 只收附件不入包、或只把 dgac_inline.js 塞进 additionFile（不执行），都会在这里判 FAIL。
 *
 * 用法：
 *   node tools/check_dolonline_guard.js <包路径 .zip 或解压目录>   # 体检指定包
 *   node tools/check_dolonline_guard.js --file <index.js>          # 体检单个 js（作者自查用）
 *   node tools/check_dolonline_guard.js --latest                   # 查 lmzgls/Dolonline 最新 Release，有新版则下载并体检
 *
 * 判据（四项，全部可证伪；DoLOnline 5.34 原版实测 0 / 0 / 0 / 0）：
 *   1 守卫本体在包内   `dolonlineGuard`  >= 1
 *   2 守卫已启动       `DGAC.start(`     >= 1
 *   3 写入点已包裹     `DGAC.set(` + `DGAC.write(` >= 26（5.34 版 patch_index.js 的 RULES 条数）
 *   4 有拦截日志       `拒绝外部写入`    >= 1
 *
 * 注意：不能用 `[DoLOnline]` 当判据——该 TAG 是模组自身的日志前缀，原版 index.js 里本来就有 2 处。
 *
 * 退出码：0 四项全过 / 1 有未通过项 / 2 输入非法或读不到包
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const REPO = 'lmzgls/Dolonline';
const BASELINE = '5.34'; // 本地对照版本（tools/_modcache/dolonline534）
const WRITE_MIN = 26;    // patch_index.js 的 RULES 条数（5.34 标定）

const CHECKS = [
  { label: '守卫本体在包内', re: /dolonlineGuard/g, min: 1 },
  { label: '守卫已启动', re: /DGAC\.start\(/g, min: 1 },
  { label: '写入点已包裹', re: /DGAC\.(?:set|write)\(/g, min: WRITE_MIN },
  { label: '有拦截日志', re: /拒绝外部写入/g, min: 1 }
];

function countAll(text) {
  const out = [];
  for (const c of CHECKS) {
    const n = (text.match(c.re) || []).length;
    out.push({ label: c.label, n: n, min: c.min, pass: n >= c.min });
  }
  return out;
}

/* 只统计 boot.json 真正加载的脚本：additionFile 里的东西不会执行，必须排除 */
function collectExecutedJs(rootDir) {
  const bootPath = path.join(rootDir, 'boot.json');
  if (!fs.existsSync(bootPath)) throw new Error('缺 boot.json（ModLoader 唯一加载依据）');
  // JSON5 容错：去掉注释与尾逗号后再解析
  let raw = fs.readFileSync(bootPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  let boot;
  try { boot = JSON.parse(raw); } catch (e) { throw new Error('boot.json 解析失败: ' + e.message); }

  const keys = ['scriptFileList_inject_early', 'scriptFileList_earlyload', 'scriptFileList_preload', 'scriptFileList'];
  const files = [];
  for (const k of keys) {
    const arr = boot[k];
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      if (typeof f !== 'string' || !f) continue;
      const rel = f.replace(/\\/g, '/');
      if (!/\.js$/.test(rel)) continue;
      files.push({ key: k, rel: rel });
    }
  }
  return { boot, files };
}

function loadExecuted(rootDir) {
  const { boot, files } = collectExecutedJs(rootDir);
  if (!files.length) throw new Error('boot.json 未加载任何 .js 脚本');
  const parts = [];
  const missing = [];
  const seen = new Set();
  for (const f of files) {
    if (seen.has(f.rel)) continue;
    seen.add(f.rel);
    const p = path.join(rootDir, f.rel.split('/').join(path.sep));
    if (!fs.existsSync(p)) { missing.push(f.rel); continue; }
    parts.push(fs.readFileSync(p, 'utf8'));
  }
  return { boot, files, text: parts.join('\n'), missing };
}

function unpackZip(zipPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dgac-check-'));
  const ps = "Expand-Archive -LiteralPath '" + zipPath.replace(/'/g, "''") + "' -DestinationPath '" + dir.replace(/'/g, "''") + "' -Force";
  cp.execFileSync('pwsh', ['-NoProfile', '-Command', ps], { stdio: 'pipe' });
  // 若外层套了一层目录，且根目录无 boot.json，则向下找一层
  if (!fs.existsSync(path.join(dir, 'boot.json'))) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory());
    if (entries.length === 1 && fs.existsSync(path.join(dir, entries[0].name, 'boot.json'))) {
      return path.join(dir, entries[0].name);
    }
  }
  return dir;
}

function report(title, boot, text, missing) {
  console.log('=== ' + title + ' ===');
  if (boot) {
    console.log('  模组: ' + (boot.name || '(未命名)') + ' / 版本 ' + (boot.version || '(无)'));
  }
  if (missing && missing.length) console.log('  [WARN] boot.json 引用了不存在的脚本: ' + missing.join(', '));
  console.log('  执行脚本合计 ' + text.length + ' 字符');
  console.log('');
  const rows = countAll(text);
  for (const r of rows) {
    console.log('  ' + (r.pass ? '[PASS]' : '[FAIL]') + ' ' + r.label + '：' + r.n + '（需 >= ' + r.min + '）');
  }
  const allPass = rows.every(r => r.pass);
  console.log('');
  console.log(allPass
    ? '  结论: PASS —— 拦截已集成且覆盖写入点，旧版 CE 的 dolonline 适配器在此包上失效'
    : '  结论: FAIL —— 拦截未生效；旧版 CE 仍可作弊，需让作者按 index.patched.js 重新集成');
  return allPass;
}

function token() {
  const git = process.env.GIT_EXE || 'C:\\Users\\27352\\Git\\cmd\\git.exe';
  try {
    const out = cp.execFileSync(git, ['credential', 'fill'],
      { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const m = String(out).match(/^password=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch (e) { return null; }
}

function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

function ver(s) {
  const m = String(s || '').match(/(\d+(?:\.\d+)+)/);
  return m ? m[1] : null;
}

(async () => {
  const arg = process.argv[2];

  if (arg === '--file') {
    const p = process.argv[3];
    if (!p || !fs.existsSync(p)) { console.error('用法: node tools/check_dolonline_guard.js --file <index.js>'); process.exit(2); }
    const ok = report('单文件体检 ' + path.basename(p), null, fs.readFileSync(p, 'utf8'), null);
    process.exit(ok ? 0 : 1);
  }

  if (arg === '--latest') {
    const t = token();
    const H = { Accept: 'application/vnd.github+json', 'User-Agent': 'mce-dgac-check' };
    if (t) H.Authorization = 'Bearer ' + t;
    const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: H });
    if (!r.ok) { console.error('[FAIL] 取最新 Release 失败 HTTP ' + r.status); process.exit(2); }
    const rel = await r.json();
    const tag = rel.tag_name || '';
    const v = ver(tag) || ver(rel.name);
    console.log('远端最新: ' + tag + '（' + (rel.name || '') + '）/ ' + (rel.published_at || ''));
    console.log('本地对照: ' + BASELINE);
    if (!v) { console.log('  无法解析版本号，跳过体检'); process.exit(0); }
    if (cmpVer(v, BASELINE) <= 0) {
      console.log('  结论: 无新版（' + v + ' <= ' + BASELINE + '），无需体检');
      process.exit(0);
    }
    console.log('  结论: 有新版本 ' + v + ' > ' + BASELINE + '，开始下载并体检');
    const asset = (rel.assets || []).find(a => /\.(zip|mod\.zip)$/i.test(a.name));
    if (!asset) { console.error('  [FAIL] 新版无 zip 资产，无法体检'); process.exit(1); }
    const dl = await fetch('https://api.github.com/repos/' + REPO + '/releases/assets/' + asset.id, {
      headers: Object.assign({}, H, { Accept: 'application/octet-stream' })
    });
    if (!dl.ok) { console.error('  [FAIL] 下载资产失败 HTTP ' + dl.status); process.exit(1); }
    const buf = Buffer.from(await dl.arrayBuffer());
    const zipPath = path.join(os.tmpdir(), 'dgac-latest-' + asset.name.replace(/[^\w.-]/g, '_'));
    fs.writeFileSync(zipPath, buf);
    console.log('  下载 ' + asset.name + ' / ' + buf.length + ' B -> ' + zipPath);
    const dir = unpackZip(zipPath);
    let info;
    try { info = loadExecuted(dir); } catch (e) { console.error('  [FAIL] ' + e.message); process.exit(1); }
    const ok = report('新版体检 ' + v, info.boot, info.text, info.missing);
    process.exit(ok ? 0 : 1);
  }

  if (!arg) {
    console.error('用法: node tools/check_dolonline_guard.js <包路径|--file <js>|--latest>');
    process.exit(2);
  }

  let dir = arg;
  if (/\.zip$/i.test(arg)) {
    if (!fs.existsSync(arg)) { console.error('[FAIL] 包不存在: ' + arg); process.exit(2); }
    dir = unpackZip(arg);
  } else if (!fs.existsSync(dir)) {
    console.error('[FAIL] 路径不存在: ' + arg);
    process.exit(2);
  }
  let info;
  try { info = loadExecuted(dir); } catch (e) { console.error('[FAIL] ' + e.message); process.exit(2); }
  const ok = report('包体检 ' + path.basename(arg), info.boot, info.text, info.missing);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('[ERR] ' + e.message); process.exit(2); });
