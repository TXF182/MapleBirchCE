/*
 * 键注册表生成器 / 校验器：把 04a-*.js 里散落的 423 条 varPath 声明收敛成单一常量表 keys.registry.json。
 * 用法：
 *   node tools/gen_key_registry.js            # 校验模式：源码与注册表不一致即 exit 1（可挂验证链）
 *   node tools/gen_key_registry.js --write    # 生成/更新注册表
 *   node tools/gen_key_registry.js --list     # 打印逐适配器条目数
 * 判据：一个条目 = 同一个对象字面量内 `key: "..."` 后跟 `varPath: "..."`（按出现顺序配对）。
 *   04a-14 / 04a-15 的 actionPanel 型 key 没有 varPath，计入 keysWithoutVarPath，不进注册表。
 * 有了它，「某个键改名」会在注册表 diff 里显形为 RENAMED（同 key 不同 varPath）并被验证链拦住，
 * 而不是靠人肉逐条比 140 条 path。
 */
const fs = require("fs"), path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "javascript", "src");
const REG_PATH = path.join(ROOT, "keys.registry.json");

function readAdapters() {
  const files = fs.readdirSync(SRC_DIR).filter(f => /^04a-.*\.js$/.test(f)).sort();
  const out = {}, skipped = {};
  for (const f of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, f), "utf8");
    const blockRe = /CHEAT_ADAPTERS\["([^"]+)"\]\s*=\s*\{/g;
    let bm, blocks = [];
    while ((bm = blockRe.exec(text))) { blocks.push({ id: bm[1], start: bm.index + bm[0].length }); }
    for (let bi = 0; bi < blocks.length; bi++) {
      const id = blocks[bi].id;
      const seg = text.slice(blocks[bi].start, bi + 1 < blocks.length ? blocks[bi + 1].start : text.length);
      const keyRe = /key:\s*"([^"]+)"/g;
      const hits = [];
      let km;
      while ((km = keyRe.exec(seg))) { hits.push({ key: km[1], at: km.index }); }
      if (!out[id]) out[id] = [];
      for (let i = 0; i < hits.length; i++) {
        const part = seg.slice(hits[i].at, i + 1 < hits.length ? hits[i + 1].at : seg.length);
        const vm = /varPath:\s*"([^"]+)"/.exec(part);
        if (vm) { out[id].push({ key: hits[i].key, varPath: vm[1] }); }
        else { skipped[id] = (skipped[id] || 0) + 1; }
      }
    }
  }
  /* 适配器顺序固定按 modId 排序，条目顺序保持源码顺序（便于 diff 定位） */
  const ordered = {};
  Object.keys(out).sort().forEach(k => { ordered[k] = out[k]; });
  const entries = Object.keys(ordered).reduce((n, k) => n + ordered[k].length, 0);
  const unknown = Object.keys(skipped).reduce((n, k) => n + skipped[k], 0);
  return {
    generatedBy: "tools/gen_key_registry.js",
    source: "javascript/src/04a-*.js",
    note: "单一键常量表：条目按 key 配对，varPath 为上游真实变量路径。改适配器后跑 node tools/gen_key_registry.js --write 再提交。",
    adapters: ordered,
    keysWithoutVarPath: skipped,
    totals: { adapters: Object.keys(ordered).filter(k => ordered[k].length > 0).length, entries: entries, keysWithoutVarPath: unknown }
  };
}

function flatten(reg) {
  const rows = [];
  Object.keys(reg.adapters).forEach(a => reg.adapters[a].forEach(e => rows.push({ adapter: a, key: e.key, varPath: e.varPath })));
  return rows;
}

function diff(oldReg, newReg) {
  const o = flatten(oldReg), n = flatten(newReg), changes = [];
  const byKey = new Map(o.map(r => [r.adapter + "\u0000" + r.key, r]));
  const seen = new Set();
  n.forEach(r => {
    const id = r.adapter + "\u0000" + r.key;
    seen.add(id);
    const prev = byKey.get(id);
    if (!prev) { changes.push("ADDED   " + r.adapter + " / " + r.key + " -> " + r.varPath); return; }
    if (prev.varPath !== r.varPath) { changes.push("RENAMED " + r.adapter + " / " + r.key + ": " + prev.varPath + " -> " + r.varPath); }
  });
  o.forEach(r => {
    if (!seen.has(r.adapter + "\u0000" + r.key)) { changes.push("REMOVED " + r.adapter + " / " + r.key + " (" + r.varPath + ")"); }
  });
  return changes;
}

function main() {
  const argv = process.argv.slice(2);
  const reg = readAdapters();
  const body = JSON.stringify(reg, null, 2) + "\n";

  if (argv.includes("--list")) {
    Object.keys(reg.adapters).forEach(a => { if (reg.adapters[a].length) console.log(a + ": " + reg.adapters[a].length); });
    console.log("total entries=" + reg.totals.entries + " adapters=" + reg.totals.adapters + " keysWithoutVarPath=" + reg.totals.keysWithoutVarPath);
    return 0;
  }

  if (argv.includes("--write")) {
    fs.writeFileSync(REG_PATH, body);
    console.log("wrote " + REG_PATH + "  (" + reg.totals.adapters + " adapters / " + reg.totals.entries + " entries)");
    return 0;
  }

  if (!fs.existsSync(REG_PATH)) {
    console.error("FAIL: 缺少 " + REG_PATH + "（先跑 node tools/gen_key_registry.js --write）");
    return 1;
  }
  const oldReg = JSON.parse(fs.readFileSync(REG_PATH, "utf8"));
  const changes = diff(oldReg, reg);
  if (changes.length === 0) { console.log("OK: 键注册表与源码一致（" + reg.totals.entries + " 条 / " + reg.totals.adapters + " 个适配器）"); return 0; }
  console.error("FAIL: 键注册表与 04a-*.js 不一致（" + changes.length + " 处）");
  changes.slice(0, 40).forEach(c => console.error("  " + c));
  if (changes.length > 40) console.error("  … 其余 " + (changes.length - 40) + " 处省略");
  console.error("修复：确认改动是有意的 → node tools/gen_key_registry.js --write 并提交注册表");
  return 1;
}

process.exit(main());
