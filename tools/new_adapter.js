#!/usr/bin/env node
/*
 * 新增第三方模组适配器脚手架（借鉴 v2.0.0.001 类型核查轮的经验固化）
 *
 * 用法：
 *   node tools/new_adapter.js --id <modId> --name "<模组名+版本>" --short <文件名片段> --root <状态根> [--dry]
 * 例：
 *   node tools/new_adapter.js --id my-mod --name "我的模组 v1.0.0" --short mymod --root MyMod --dry
 *
 * 做三件事：
 *   1. 校验 modId 未被现有 04a-*.js 占用（重复注册会让后注册的静默覆盖先注册的）；
 *   2. 生成 javascript/src/04a-<NN>-<short>.js 骨架（编号取现有最大值 +1），结构必须满足
 *      audit_adapters.js / resolve_missing.js 的解析约定：tab 缩进、以 "\t};" 收尾；
 *   3. 打印后续必跑的三套核查 + 全链命令，避免「加了适配器忘了核查」。
 *
 * 只生成骨架，不改任何其它文件（不自动写 CHEAT_VAR_DECL / 文档 / 测试）——
 * 那些要按实际填充的键决定，交给作者与核查工具定案。
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "javascript", "src");

function arg(name) {
  const i = process.argv.indexOf("--" + name);
  if (i === -1) { return null; }
  const v = process.argv[i + 1];
  return (v && v.indexOf("--") !== 0) ? v : "__FLAG__";
}
const DRY = process.argv.indexOf("--dry") !== -1;
const ID = arg("id");
const NAME = arg("name");
const SHORT = arg("short") || (ID ? ID.replace(/[^a-z0-9]/gi, "") : null);
const ROOT = arg("root");

if (!ID || !NAME || !ROOT) {
  console.error("用法: node tools/new_adapter.js --id <modId> --name \"<模组名+版本>\" --short <文件名片段> --root <状态根> [--dry]");
  console.error("  --id    适配器键名（如 my-mod），必须与 boot.json/modId 一致");
  console.error("  --name  面板显示名（如 我的模组 v1.0.0）");
  console.error("  --short 文件名片段（如 mymod → 04a-12-mymod.js）");
  console.error("  --root  模组在 window.maplebirch 下的状态根（如 MyMod），detect 用它判存在");
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9._-]*$/i.test(ID)) {
  console.error("FATAL: --id 只允许字母数字点下划线连字符");
  process.exit(2);
}
if (!/^[a-z0-9][a-z0-9_-]*$/i.test(SHORT)) {
  console.error("FATAL: --short 只允许字母数字下划线连字符");
  process.exit(2);
}

/* ---------- 1. 现有适配器扫描：重复 id / 下一个编号 ---------- */
const files = fs.readdirSync(SRC).filter(f => /^04a-.*\.js$/.test(f)).sort();
const all = files.map(f => ({ name: f, text: fs.readFileSync(path.join(SRC, f), "utf8") }));
const dup = all.find(f => f.text.indexOf('CHEAT_ADAPTERS["' + ID + '"]') !== -1);
if (dup) {
  console.error("FATAL: 适配器 " + ID + " 已存在（" + dup.name + "），重复注册会让后者静默覆盖前者");
  process.exit(1);
}
let maxNo = 0;
for (const f of all) {
  const m = /^04a-(\d+)-/.exec(f.name);
  if (m) { maxNo = Math.max(maxNo, parseInt(m[1], 10)); }
}
const NN = String(maxNo + 1).padStart(2, "0");
const fileName = "04a-" + NN + "-" + SHORT + ".js";
const filePath = path.join(SRC, fileName);
if (fs.existsSync(filePath)) {
  console.error("FATAL: " + fileName + " 已存在");
  process.exit(1);
}

/* ---------- 2. 骨架（结构对齐 audit_adapters 的解析约定） ---------- */
const body = [
  '\tCHEAT_ADAPTERS["' + ID + '"] = {',
  '\t\tdetect: function () {',
  '\t\t\ttry {',
  '\t\t\t\tif (typeof window === "undefined" || !window.maplebirch || typeof window.maplebirch.get !== "function") { return false; }',
  '\t\t\t\treturn !!window.maplebirch.get("' + ROOT + '");',
  '\t\t\t} catch (e) { return false; }',
  '\t\t},',
  '\t\tentry: {',
  '\t\t\tmodId: "' + ID + '",',
  '\t\t\tmodName: "' + NAME + '",',
  '\t\t\t/* TODO 下面五类按对照源码填充；每类每条都必须带 varPath（或 levels 阶段枚举）。',
  '\t\t\t   填充纪律：',
  '\t\t\t   1) varPath 必须先在对照源码里实证存在，不允许猜测；',
  '\t\t\t   2) 模组用 `is 1` / `=== 1` 判定的键声明 type 时用 numeric: true（否则写 true 恒假）；',
  '\t\t\t   3) levels 与 labels 数量必须一致，且 levels 用源码里的真实取值；',
  '\t\t\t   4) 动态键拼接（前缀 + 数据枚举）属于静态盲区，走 resolve_missing 定案，不得直接删。 */',
  '\t\t\ttasks: [',
  '\t\t\t\t// { key: "' + SHORT + '_todo", name: "任务名", varPath: "' + ROOT + '.todo" }',
  '\t\t\t],',
  '\t\t\tstages: [',
  '\t\t\t\t// { key: "' + SHORT + '_stage", name: "阶段名", varPath: "' + ROOT + '.stage", levels: ["none", "done"], labels: ["未开始", "已完成"] }',
  '\t\t\t],',
  '\t\t\tabilities: [',
  '\t\t\t\t// { key: "' + SHORT + '_can", name: "能力名", varPath: "' + ROOT + '.can" }',
  '\t\t\t],',
  '\t\t\tscenes: [',
  '\t\t\t\t// { key: "' + SHORT + '_scene", name: "场景名", varPath: "' + ROOT + '.scene" }',
  '\t\t\t],',
  '\t\t\tvalues: [',
  '\t\t\t\t// { key: "' + SHORT + '_num", name: "数值名", varPath: "' + ROOT + '.num", min: 0, max: 100 }',
  '\t\t\t]',
  '\t\t}',
  '\t};',
  ''
].join("\n");

if (DRY) {
  console.log("=== DRY RUN（未写入） → " + fileName + " ===");
  console.log(body);
  console.log("=== 编号取现有最大 " + maxNo + " +1 ===");
  process.exit(0);
}

/* 写文件：必须与原产风格一致（UTF-8 无 BOM、LF） */
fs.writeFileSync(filePath, body, "utf8");
console.log("created " + filePath + "  (" + body.split("\n").length + " 行)");

console.log("\n下一步（顺序固定，缺一不得交付）：");
console.log("  1. 下载对照源码到 tools/_modcache/<版本>/（只留当前版本）");
console.log("  2. node tools/audit_adapters.js " + ID + " tools/_modcache/<版本>");
console.log("  3. node tools/resolve_missing.js " + ID + " tools/_modcache/<版本>");
console.log("  4. node tools/_check_keys_mod.js " + ID + " tools/_modcache/<版本> --list");
console.log("  5. node tools/check_claims.js && node tools/check_key_types.js");
console.log("  6. .\\tools\\run_all.ps1   （9 步全绿才算过）");
console.log("  7. 更新 AGENTS.md §5 适配器键数 + CHANGELOG");
