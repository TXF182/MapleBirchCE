#!/usr/bin/env node
/* ============================================================================
 * check_framework_api.js — 框架更新兼容性核对
 *
 * 用法：node tools/check_framework_api.js <框架 inject_early.js 路径>
 *
 * 干什么：maplebirchFramework 发布新版时，核对 MapleBirchCE 运行时依赖的框架
 * API 是否全部保留（不兼容就不能把"当前兼容版本"记录更新上去）。
 * 核对项 = 04-modcheat.js / 01-core.js / 02-romance.js / 06-traits.js 里实际用到的
 * 框架接口（见 APIS 数组注释的源码出处）。打包产物是压缩单行，用子串/正则
 * 匹配（变量名被压缩，属性访问路径如 .temporary.traitLists 保留原样）。
 *
 * 输出：逐项 [有]/[缺] + 汇总；缺失项需人工确认是否为行为变化。
 * ========================================================================== */
"use strict";

const fs = require("fs");

const f = process.argv[2];
if (!f || !fs.existsSync(f)) { console.error("用法：node tools/check_framework_api.js <inject_early.js 路径>"); process.exit(1); }
const t = fs.readFileSync(f, "utf8");

/* CE 依赖的框架 API 清单（源码出处注释） */
const APIS = [
  /* 01-core.js:19 框架解析：window.maplebirch 全局对象（主路径） */
  ["window.maplebirch 全局导出", /window\.maplebirch\s*=|maplebirch\s*=\s*\{|globalThis\.maplebirch|\.maplebirch=/],
  /* 04-modcheat.js:4/205 探测键：window.maplebirch.get("RobinTemple"/"DeadwoodReblooms"/"TempleChoir") */
  ["maplebirch.get 模块状态读取", /maplebirch\.get\s*=|\.get\s*=\s*function|get\(\s*["']?[A-Za-z_]/],
  /* 02-romance.js:16/288/305 maplebirch.npc 注册池（.data 为 Map / 按名索引） */
  ["maplebirch.npc 注册池", /maplebirch\.npc|\.npc\s*=|npc:\s*\{/],
  ["npc.data Map 结构", /\.npc\.data|npc\.data|\.data\s*=\s*new Map/],
  /* 06-traits.js:476 运行时模组特质：maplebirch.temporary.traitLists（压缩后属性路径保留） */
  ["maplebirch.temporary 命名空间", /\.temporary\.traitLists|temporary:\s*\{|\.temporary\s*=/],
  ["traitLists 注入表", /traitLists/],
  /* 01-core.js:19 回退：setup.MapleBirch（老框架兜底，5.5.0 确认无，缺失不阻塞主路径） */
  ["setup.MapleBirch 回退", /setup\.MapleBirch/],
  /* 框架内部常用 API（仅供参考，CE 未直接调用） */
  ["maplebirch.define 模块注册", /\.define\s*=\s*function|define\(\s*["']/],
  ["maplebirch.patch 修补", /maplebirch\.patch|\.patch\s*=\s*function|patch\(\s*["']/],
  ["maplebirchFrameworkNotice 框架标识", /maplebirchFrameworkNotice/]
];

console.log("===== MapleBirchCE 框架 API 兼容性核对：" + f + " =====");
let pass = 0, fail = 0;
for (const [name, re] of APIS) {
  const ok = re.test(t);
  if (ok) pass++; else fail++;
  console.log((ok ? "[有] " : "[缺] ") + name + (ok ? "" : "  ← 需人工确认"));
}
console.log("核对完成：" + pass + " 项存在 / " + fail + " 项缺失");
console.log("结论：" + (fail === 0 ? "核心 API 全部保留，兼容" : "存在缺失项，先人工确认再更新 declOverride"));
