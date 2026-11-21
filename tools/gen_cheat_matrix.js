#!/usr/bin/env node
/* gen_cheat_matrix.js —— 生成 docs/cheat-matrix.md 作弊功能矩阵
 * 数据源：tests/data/adapter_matrix.json（适配器声明）+ javascript/src/04a-*.js（modId/modName）
 * 用法：node tools/gen_cheat_matrix.js [--out docs/cheat-matrix.md]
 * 重跑条件：适配器声明改动后（先跑 node tools/gen_adapter_matrix.js），或本脚本面板元数据更新后。
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = process.argv.includes("--out")
  ? path.resolve(ROOT, process.argv[process.argv.indexOf("--out") + 1])
  : path.join(ROOT, "docs", "cheat-matrix.md");

/* ---------- 1. 适配器数据：adapter_matrix.json ---------- */
const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "data", "adapter_matrix.json"), "utf8"));
const byMod = {};
for (const it of matrix.items) {
  (byMod[it.modId] = byMod[it.modId] || {});
  (byMod[it.modId][it.section] = byMod[it.modId][it.section] || []).push(it);
}

/* ---------- 2. modId -> modName：解析 04a 注册 ---------- */
const DISPLAY = {};
const srcDir = path.join(ROOT, "javascript", "src");
for (const f of fs.readdirSync(srcDir).filter(n => /^04a-\d+.*\.js$/.test(n))) {
  const txt = fs.readFileSync(path.join(srcDir, f), "utf8");
  const mid = txt.match(/modId\s*:\s*"([^"]+)"/);
  const mname = txt.match(/modName\s*:\s*"([^"]+)"/);
  if (mid && mname) DISPLAY[mid[1]] = mname[1];
}

/* ---------- 3. 面板元数据（静态固化；改面板结构时同步此处） ---------- */
const TABS = [
  ["char", "角色", "07b-char + 06a-c + 05b + 07g",
    "属性批量编辑（负面属性/预设模板）、170 原版特质 + 模组特质自动发现、中文特质映射、性别七键切换（留痕可回退）、恋爱对象/阶段、搜索过滤"],
  ["stage", "阶段", "07c-stage",
    "原版剧情阶段一键完成/回退（留痕）、模组阶段（各适配器 stages）"],
  ["scenes", "剧情", "07e-scenes(+2) + 07f-pins*",
    "剧情直达：SV 预览链回放（replayScene+exitpassage）、节日/怨灵状态注射、锚定触发状态机"],
  ["places", "场景", "07d-places(+sydney/2/3/4/5) + 07k",
    "场景直达：地点永久解锁+世界入口、26 条数字档位核对、悉尼线、小岛 NPC、艾弗里庄园开局解锁"],
  ["global", "全局", "03a-c + 07j + 07l + 07m + 07n + 07o + 08b",
    "时间/时段/天气、世界硬软腐化、犯罪全清、古董收集+成就、雷米疤面头衔、转化隐藏、原版扩展（枝叶变装等）、原版经济（数值+撤销）、鸟/礼顿、态度锁定"],
  ["mods", "Mod作弊", "04a-00..16 + 05a(+2/3) + 04b/04c",
    "12 个第三方模组键级适配（见第三节表）、类型显示（numeric 显示 number(0/1)）、留痕+预览门控+单键回退、命令式动作（fert）"],
  ["yanling", "言灵", "07i-yanling-*",
    "言灵页 D 组（艾弗里办公室补/作弊模式）、E 组 4 页签 52 条（好友诉求等）、一键写入+撤销、作弊模式无副作用开启"],
];
const SYS = [
  ["留痕通道", "01b-wrote-trim + 04b + 08c",
    "写入走 V.mbCE_wrote（key=cheat:<modId>:<itemKey>，before/after/t）；性别留痕 cheat:player-self:gender:<leaf>；统一撤销中心逐条回退"],
  ["预览门控", "08d-diff-preview",
    "开启「确认条」后写入先进队列；mbCEPreviewGate 比较 before/after（v2.1.20 起数组逐项比较），确认才重放"],
  ["撤销中心", "08c + 08e",
    "可撤销 N 项、单键回退（含锁定连带解除）、中文标签映射"],
  ["锁定", "07f-lock",
    "mbCELockSet 键锁定，防原版覆盖/重算"],
];

/* ---------- 4. 组装 ---------- */
const secRow = secs => Object.entries(secs).map(([s, a]) => `${s}=${a.length}`).join(" / ");
const keySamples = secs => {
  const all = [].concat(...Object.values(secs));
  return all.slice(0, 4).map(x => "`" + x.varPath + "`").join("、") || "—";
};
const modIds = Object.keys(byMod).sort();

const md = [];
md.push("# MapleBirchCE 作弊功能矩阵");
md.push("");
md.push("> 数据源：`tests/data/adapter_matrix.json`（" + matrix.adapterCount + " 适配器 / " + matrix.itemCount
  + " 条目 / " + matrix.probeCount + " 探针）+ `javascript/src/04a-*.js`（modId/modName）。");
md.push("> 用途：改作弊功能、加适配器、排查「某某作弊在哪」时先查本表，再按「核心分片」定位源码。");
md.push("> 重跑：适配器声明变更后先 `node tools/gen_adapter_matrix.js`，再 `node tools/gen_cheat_matrix.js`。");
md.push("");
md.push("## 一、面板导航（七大页签）");
md.push("");
md.push("| 页签 id | 中文 | 核心分片 | 功能 |");
md.push("|---|---|---|---|");
for (const [id, zh, seg, fn] of TABS) md.push(`| \`${id}\` | ${zh} | ${seg} | ${fn} |`);
md.push("");
md.push("## 二、作弊子系统（跨页签基础设施）");
md.push("");
md.push("| 子系统 | 分片 | 说明 |");
md.push("|---|---|---|");
for (const [n, seg, d] of SYS) md.push(`| ${n} | ${seg} | ${d} |`);
md.push("");
md.push("## 三、模组适配器矩阵（" + modIds.length + " 个）");
md.push("");
md.push("| modId | 显示名 | 条目分布 | 关键键示例 |");
md.push("|---|---|---|---|");
for (const modId of modIds) {
  const secs = byMod[modId];
  md.push(`| \`${modId}\` | ${DISPLAY[modId] || "（04a 未取到）"} | ${secRow(secs)} | ${keySamples(secs)} |`);
}
md.push("");
md.push("## 四、查找速记");
md.push("");
md.push("- 找「某模组作弊项在哪」→ 第三节 modId → 对应 `04a-XX-*.js` 适配器文件。");
md.push("- 找「写值怎么留痕/回退」→ 第二节留痕通道；预览弹窗逻辑在 `08d-diff-preview.js`。");
md.push("- 找「适配器声明数/探针」→ `node tools/validate_adapters.js`；矩阵幂等 `node tools/gen_adapter_matrix.js --check`。");
md.push("- 找「面板某按钮」→ 第一节页签 → 核心分片列（如角色属性编辑 = `07b-char.js`）。");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md.join("\n"), "utf8");
console.log("written:", OUT, "bytes:", fs.statSync(OUT).size);
