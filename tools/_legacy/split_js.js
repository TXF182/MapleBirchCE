/*
 * 一次性切分脚本：把单文件 maplebirchce.js 按功能域切成 javascript/src/*.js。
 * 切分后必须满足「重建 == 原文件」（SHA 一致），否则退出非零。
 * 以后日常开发改 src/ 下的文件，用 build_js.js 拼接回单文件。
 */
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "javascript", "maplebirchce.js");
const SRC_DIR = path.join(ROOT, "javascript", "src");

const content = fs.readFileSync(FILE, "utf8");
const lines = content.split("\n");

/* 切点行号（1-based，含端点），来自源码分区注释；每个切点都在语句/注释边界 */
const cuts = [
  { start: 1, end: 114, name: "00-preamble.js", desc: "顶部版本注释 + IIFE 头 (function(){\"use strict\";)" },
  { start: 115, end: 312, name: "01-core.js", desc: "基础：版本号/框架解析/数值定义/中文显示层/角色枚举/数值读写" },
  { start: 313, end: 654, name: "02-romance.js", desc: "恋爱剧情阶段 + 转化阶段（原生条件自动解析）" },
  { start: 655, end: 1203, name: "03-global.js", desc: "全局批量（含格威岚防崩/属性中英映射）" },
  { start: 1204, end: 1649, name: "04-modcheat.js", desc: "Mod作弊适配器（归途之书/DomRobin/枯木逢春/SmartPhone/MLI）+ 通用写入执行器 + 回退" },
  { start: 1650, end: 2036, name: "05-modcheat-ui.js", desc: "Mod作弊动态发现 + 主容器/子页面渲染 + 玩家属性编辑" },
  { start: 2037, end: 2784, name: "06-traits.js", desc: "特质管理：静态表/编译/系列合并/强制获得/渲染 + 兼容导出" },
  { start: 2785, end: 4534, name: "07-ui.js", desc: "UI 右侧常驻悬浮侧边面板（六标签页渲染）" },
  { start: 4535, end: 4685, name: "08-npc-traits.js", desc: "NPC 特质表与获取" },
  { start: 4686, end: lines.length, name: "09-exports.js", desc: "render/init/mountApi + 导出区 + IIFE 尾" }
];

fs.mkdirSync(SRC_DIR, { recursive: true });
let rebuilt = "";
const parts = [];
for (let i = 0; i < cuts.length; i++) {
  const c = cuts[i];
  if (c.start > c.end || c.end > lines.length) {
    console.error("切点越界:", c.name, c.start, c.end, "lines=" + lines.length);
    process.exit(1);
  }
  let seg = lines.slice(c.start - 1, c.end).join("\n");
  if (i < cuts.length - 1) { seg += "\n"; }
  parts.push(seg);
  fs.writeFileSync(path.join(SRC_DIR, c.name), seg);
  console.log("  " + c.name + "  (行 " + c.start + "-" + c.end + ") " + c.desc);
}
rebuilt = parts.join("");

const origSha = crypto.createHash("sha256").update(content).digest("hex");
const newSha = crypto.createHash("sha256").update(rebuilt).digest("hex");
console.log("orig   SHA256 " + origSha);
console.log("rebuilt SHA256 " + newSha);
if (origSha !== newSha) {
  console.error("FATAL: 重建与原文件不一致（字节差异），请检查切点");
  process.exit(1);
}
console.log("OK: 切分完成且重建字节一致，" + cuts.length + " 个文件 → " + SRC_DIR);
