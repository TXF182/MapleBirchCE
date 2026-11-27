#!/usr/bin/env node
/* gen_arch_data.js —— 架构图谱数据生成器（codegraph CLI 缺失后的替代数据源）
 * 产物：.codegraph/arch-data.json（节点/边/统计，供架构文档与可交互架构页共用）
 * 数据源：javascript/src/manifest.json、keys.registry.json、tests/data/adapter_matrix.json、
 *        boot.json、javascript/src/*.js、tools/*、skills 目录的 SKILL.md
 * 用法：node tools/gen_arch_data.js [--out <path>]
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "javascript", "src");
const SKILLS = process.env.MCE_SKILLS_DIR || "C:/Users/27352/Doubao/skills";
const OUT = (() => {
  const i = process.argv.indexOf("--out");
  return i > 0 ? path.resolve(ROOT, process.argv[i + 1]) : path.join(ROOT, ".codegraph", "arch-data.json");
})();

const j = p => JSON.parse(fs.readFileSync(p, "utf8"));
const manifest = j(path.join(SRC, "manifest.json"));
const registry = j(path.join(ROOT, "keys.registry.json"));
const matrix = j(path.join(ROOT, "tests", "data", "adapter_matrix.json"));
const boot = j(path.join(ROOT, "boot.json"));

const segments = manifest.segments.map(s => {
  const p = path.join(SRC, s.file);
  const txt = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const lines = txt ? txt.split("\n").length - (txt.endsWith("\n") ? 1 : 0) : 0;
  return { file: s.file, layer: s.layer, lines, bytes: txt ? Buffer.byteLength(txt) : 0 };
});

const adapterSeg = {};
for (const s of manifest.segments) {
  if (!/^04a-/.test(s.file)) continue;
  const p = path.join(SRC, s.file);
  if (!fs.existsSync(p)) continue;
  const m = fs.readFileSync(p, "utf8").match(/modId\s*:\s*["']([A-Za-z0-9_\-]+)["']/);
  if (m) (adapterSeg[m[1]] = adapterSeg[m[1]] || []).push(s.file);
}

const byMod = {};
const byKey = {};
for (const it of matrix.items) {
  byKey[it.modId + ":" + it.key] = { kind: it.kind, probes: (it.probes || []).length, section: it.section, varPath: it.varPath };
  const a = byMod[it.modId] = byMod[it.modId] || { keys: 0, probes: 0, kinds: {}, sections: {} };
  a.keys += 1;
  a.probes += (it.probes || []).length;
  a.kinds[it.kind] = (a.kinds[it.kind] || 0) + 1;
  a.sections[it.section] = (a.sections[it.section] || 0) + 1;
}

const adapters = Object.keys(registry.adapters).map(id => {
  const keys = registry.adapters[id] || [];
  const agg = byMod[id] || { keys: 0, probes: 0, kinds: {}, sections: {} };
  const detail = keys.map(k => Object.assign({ key: k.key, varPath: k.varPath, kind: "", probes: 0, section: "" }, byKey[id + ":" + k.key] || {}));
  return { modId: id, keyCount: keys.length, matrixKeys: agg.keys, probes: agg.probes, kinds: agg.kinds, sections: agg.sections, segments: adapterSeg[id] || [], items: detail };
}).sort((a, b) => b.keyCount - a.keyCount);

const TOOL_GROUP = {
  build: ["build_js.js","check_structure.js"],
  gate: ["run_all.ps1","pack.ps1","verify_cache.ps1","snap.ps1","install-hooks.ps1"],
  verify: ["validate_adapters.js","check_claims.js","check_key_types.js","check_src_types.js","check_vanilla_types.js","check_lint_ratchet.js","check_coverage.js","check_framework_api.js","check_dolonline_guard.js"],
  matrix: ["gen_adapter_matrix.js","gen_cheat_matrix.js","gen_key_registry.js","gen_direct_exit_matrix.py"],
  adapt: ["check_mod_updates.js","audit_adapters.js","resolve_missing.js","_check_keys_mod.js","_check_char_names.py","scan_mod_vars.js","modcache_state.js","new_adapter.js"],
  release: ["push_api.js","release.js","_check_release_1912.js"],
  debug: ["find_def.js","bench_places.js","bench_split.js","perf_probe.js","theme_preview.js","report_branch_gaps.js","gen_test_fixture.js","_seg_bounds.js","coverage_tests.js","run_coverage.js","run_coverage_par.js","codegraph_sync_light.py","gen_arch_data.js","gen_arch_html.js"]
};
const groupOf = {};
for (const g of Object.keys(TOOL_GROUP)) for (const f of TOOL_GROUP[g]) groupOf[f] = g;

function toolDesc(file) {
  const p = path.join(ROOT, "tools", file);
  const lines = fs.readFileSync(p, "utf8").split("\n").slice(0, 10);
  for (const l of lines) {
    if (/^\s*(\/\*+|\/\/|#)\s*\S/.test(l) && !/coding:|usr\/bin/i.test(l)) {
      return l.replace(/^\s*(\/\*+|\/\/|#)\s*/, "").replace(/=+$/, "").trim();
    }
  }
  return "";
}
const tools = fs.readdirSync(path.join(ROOT, "tools"))
  .filter(f => /\.(js|ps1|py)$/.test(f)).sort()
  .map(f => ({ name: f, group: groupOf[f] || "other", bytes: fs.statSync(path.join(ROOT, "tools", f)).size, desc: toolDesc(f) }));

function skillMeta(dir) {
  const p = path.join(SKILLS, dir, "SKILL.md");
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, "utf8").split("\n");
  const meta = {};
  for (const l of lines) {
    const m = l.match(/^(name|description|version)\s*:\s*(.+)$/);
    if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    if (meta.name && meta.description && meta.version) break;
  }
  if (!meta.name) meta.name = dir;
  return { dir, name: meta.name, description: meta.description || "", version: meta.version || "", mtime: fs.statSync(p).mtime.toISOString().slice(0, 10) };
}
const skills = fs.existsSync(SKILLS)
  ? fs.readdirSync(SKILLS).map(d => skillMeta(d)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  : [];

const core = fs.readFileSync(path.join(SRC, "01-core.js"), "utf8");
const mceVersion = (core.match(/MCE_VERSION\s*=\s*"([0-9.]+)"/) || [])[1] || "";
const artifact = path.join(ROOT, "javascript", "maplebirchce.js");
const artifactBytes = fs.existsSync(artifact) ? fs.statSync(artifact).size : 0;
const tests = fs.existsSync(path.join(ROOT, "tests")) ? fs.readdirSync(path.join(ROOT, "tests")).filter(f => /\.js$/.test(f)).length : 0;

const nodes = [], edges = [];
for (const L of manifest.layers) nodes.push({ id: "layer:" + L, type: "layer", label: L });
for (const s of segments) {
  nodes.push({ id: "seg:" + s.file, type: "segment", label: s.file, layer: s.layer, lines: s.lines, bytes: s.bytes });
  edges.push({ from: "layer:" + s.layer, to: "seg:" + s.file, type: "contains" });
}
for (const a of adapters) {
  nodes.push({ id: "adapter:" + a.modId, type: "adapter", label: a.modId, keys: a.keyCount, probes: a.probes });
  for (const seg of a.segments) edges.push({ from: "seg:" + seg, to: "adapter:" + a.modId, type: "declares" });
  for (const k of (registry.adapters[a.modId] || [])) {
    const id = "key:" + a.modId + ":" + k.key;
    nodes.push({ id, type: "key", label: k.key, varPath: k.varPath, mod: a.modId });
    edges.push({ from: "adapter:" + a.modId, to: id, type: "key" });
  }
}

const data = {
  generatedAt: new Date().toISOString(),
  meta: {
    mceVersion, bootVersion: boot.version, artifactBytes,
    segments: segments.length, layers: manifest.layers, adapters: adapters.length,
    keys: registry.totals.entries, probes: matrix.items.reduce((n, it) => n + (it.probes || []).length, 0),
    tools: tools.length, tests, skills: skills.length,
    srcLines: segments.reduce((n, s) => n + s.lines, 0)
  },
  segments, adapters, tools, skills, nodes, edges
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(JSON.stringify({ out: OUT, nodes: nodes.length, edges: edges.length, meta: data.meta }, null, 2));