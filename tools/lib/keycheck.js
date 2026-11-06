"use strict";
/* ============================================================================
 * keycheck.js — 键名核对启发式（纯函数，无 I/O，可单测）
 *
 * 由来：audit_adapters.js 的"声明缺失"与 resolve_missing.js 的 REVIEW 本质是同一个
 * 问题——工具只能回答"有没有命中"，答不出"为什么没命中、这个'没命中'可不可信"。
 * 结果是 14 条 REVIEW 全靠人工翻源码定案（含 featsBoosts 6 条、Finance 2 条）。
 * 本模块把结论拆成可解释的等级与证据权重，供两个工具共用：
 *
 *   KEEP           强证据（字面/连写/属主归位/结构定义）
 *   KEEP_DYNAMIC   动态键闭合（前缀在代码 + 枚举值在数据文件，两侧都实证）
 *   SOURCE_MISMATCH root 在被测源码里零出现 —— 大概率核错源（如框架键拿模组源码核）
 *   REVIEW         中等证据（同词出现在父根邻近上下文）
 *   WEAK           弱证据（同词以字符串出现在远处，等于噪声，不足以 KEEP）
 *   MISSING        零证据
 *
 * 只有 KEEP / KEEP_DYNAMIC 可直接判定保留；WEAK 必须人工看，且不得计入覆盖率分子。
 * ========================================================================== */

/** 归一化键名：大小写、分隔符（_ - .）全部抹平，用于识别 snake/camel/kebab 变体 */
function normKey(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[_\-.]/g, "");
}

/** 带早停上限的 Levenshtein（超上限直接返回 max+1，避免长串全表计算） */
function levenshtein(a, b, max) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > (max == null ? Infinity : max)) return (max == null ? Infinity : max) + 1;
  let prev = new Array(lb + 1), cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (max != null && rowMin > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return prev[lb];
}

/** 相似度 0..1（按较长串长度归一化） */
function similarity(a, b) {
  const la = String(a).length, lb = String(b).length;
  const L = Math.max(la, lb);
  if (L === 0) return 1;
  return 1 - levenshtein(a, b, L) / L;
}

/**
 * 为一处未命中的声明路径找近似候选。
 * 收紧原则（v1.9.31 二稿）：短词、无共同父段、非唯一的长词一律不给候选——
 * 宁可漏报，也不把 timer/home/farm 这类常见词当成"疑似改名"喂给人看。
 * @param {string} vp          声明路径，如 Transport.repair_tools.motor
 * @param {string[]} allPaths  源码中实际扫描到的路径
 * @param {object} [opts]      { limit=5, minScore=0.6, maxEdit=1 }
 * @returns {{path:string, score:number, reason:string}[]} 按分数降序
 */
function findCandidates(vp, allPaths, opts) {
  const o = Object.assign({ limit: 5, minScore: 0.6, maxEdit: 1 }, opts || {});
  const parts = String(vp).split(".");
  const leaf = parts[parts.length - 1];
  const root = parts[0];
  const parentInner = parts.slice(1, -1);          // 去掉 root 与 leaf 的父段
  const parentAll = parts.slice(0, -1).join(".");

  /* 源码中每个 leaf 出现几次（判断"长且唯一"用） */
  const leafCount = new Map();
  for (const p of allPaths) {
    const l = String(p).split(".").pop();
    leafCount.set(l, (leafCount.get(l) || 0) + 1);
  }

  const out = [];
  for (const p of allPaths) {
    if (p === vp) continue;
    const pp = String(p).split(".");
    const pleaf = pp[pp.length - 1];
    const pparent = pp.slice(0, -1).join(".");
    const pInner = pp.slice(1, -1);
    const sharedSeg = parentInner.some((s) => pInner.includes(s));
    const leafUnique = (leafCount.get(leaf) || 0) === 1;
    let score = 0, reason = "";

    if (normKey(p) === normKey(vp)) {
      score = 0.95; reason = "normalized-equal";                 // snake/camel/kebab 变体
    } else if (pleaf === leaf && sharedSeg) {
      score = 0.85; reason = "same-parent-tail";                 // 换了 root 但父段相同
    } else if (pleaf === leaf && leaf.length >= 8 && leafUnique) {
      score = 0.75; reason = "leaf-unique";                      // 长词且全库唯一（多半是改名搬家）
    } else if (pparent === parentAll && leaf.length >= 5 && similarity(pleaf, leaf) >= 0.8) {
      score = 0.6; reason = "same-parent-near";                  // 同父段下的近名字段
    } else if (!sharedSeg && leaf.length >= 8 && leafUnique && similarity(pleaf, leaf) >= 0.8) {
      score = 0.65; reason = "leaf-near-unique";                 // 长且唯一的拼写近
    }
    if (score >= o.minScore) out.push({ path: p, score: Number(score.toFixed(2)), reason });
  }
  out.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1));
  return out.slice(0, o.limit);
}

/**
 * 判定一条"前缀 + 运行时变量"的动态键是否被两侧闭合。
 * 代码侧：出现过 ['<prefix>' + ...] 这类拼接
 * 数据侧：<余下部分> 在枚举数据里真实存在（如 boosts.json 的 attribute 值）
 * @returns {{prefix:string, rest:string, closed:boolean}|null}
 */
function dynamicClosure(vp, prefixes, enumValues) {
  const leaf = String(vp).split(".").pop();
  const vals = enumValues instanceof Set ? enumValues : new Set(enumValues || []);
  let best = null;
  for (const pre of prefixes || []) {
    if (!pre || !leaf.startsWith(pre)) continue;
    const rest = leaf.slice(pre.length);
    if (!rest) continue;
    const closed = vals.has(rest) || vals.has(leaf);
    if (!best || rest.length < best.rest.length) best = { prefix: pre, rest, closed };
  }
  return best;
}

/** root 是否在被测源码中出现过（false = 很可能核错了源） */
function rootPresent(root, allPaths) {
  for (const p of allPaths) {
    if (p === root || p.startsWith(root + ".")) return true;
  }
  return false;
}

const KEEP = "KEEP", KEEP_DYNAMIC = "KEEP_DYNAMIC", SOURCE_MISMATCH = "SOURCE_MISMATCH",
  REVIEW = "REVIEW", WEAK = "WEAK", MISSING = "MISSING";

/**
 * 合成判定。证据按强度排列，先命中先返回。
 * @param {object} e
 *   vp            声明路径
 *   hasLiteral    字面完整路径命中
 *   hasConcat     连写（别名形态）命中
 *   ownerRelocated 属主归位命中（同文件 state 绑定属主 == root，且出现相对路径）
 *   leafDefined   父根定义块内存在 leaf: 类型/默认值
 *   dyn           dynamicClosure() 的返回
 *   stringNear    leaf 作为字符串出现，且同一行/邻近行含父段
 *   stringFar     leaf 作为字符串出现，但远离父段
 *   rootInSource  root 在源码里出现过
 * @returns {{verdict:string, confidence:number, why:string}}
 */
function classifyEvidence(e) {
  const vp = e.vp;
  if (e.hasLiteral) return { verdict: KEEP, confidence: 1.0, why: "字面命中：" + vp };
  if (e.hasConcat) return { verdict: KEEP, confidence: 0.95, why: "连写访问命中（别名形态）：" + vp };
  if (e.ownerRelocated) return { verdict: KEEP, confidence: 0.9, why: "属主归位命中：同文件 state 绑定属主即 " + String(vp).split(".")[0] + "，相对路径存在" };
  if (e.leafDefined) return { verdict: KEEP, confidence: 0.85, why: "状态结构定义存在（interface/type/对象字面量内含该字段）" };
  if (e.dyn && e.dyn.closed) {
    return { verdict: KEEP_DYNAMIC, confidence: 0.85, why: "动态键两侧闭合：代码有前缀 '" + e.dyn.prefix + "' 拼接，数据侧枚举含 '" + e.dyn.rest + "'" };
  }
  if (!e.rootInSource) {
    return { verdict: SOURCE_MISMATCH, confidence: 0.8, why: "根 " + String(vp).split(".")[0] + " 在被测源码中零出现——该键大概率不由本源维护（核错源），不可据此判定删除" };
  }
  if (e.dyn && !e.dyn.closed) {
    return { verdict: REVIEW, confidence: 0.6, why: "动态前缀 '" + e.dyn.prefix + "' 存在，但数据侧未找到枚举值 '" + e.dyn.rest + "'，需人工确认" };
  }
  if (e.stringNear) return { verdict: REVIEW, confidence: 0.55, why: "同名键以字符串形态出现在父段邻近上下文（中等证据）" };
  if (e.stringFar) return { verdict: WEAK, confidence: 0.25, why: "同名键仅以字符串形态出现在远处（常见词噪声，不足以判存活）" };
  return { verdict: MISSING, confidence: 0.0, why: "零证据：源码中未出现该键的任何形态" };
}

/** 覆盖率口径：KEEP + KEEP_DYNAMIC 计入存活，其余不计 */
function coverage(entries) {
  const total = entries.length;
  const alive = entries.filter((x) => x.verdict === KEEP || x.verdict === KEEP_DYNAMIC).length;
  return { total, alive, pct: total ? Math.round((alive / total) * 100) : 100 };
}

/* 数字下标段：声明路径 a.b.0.c 在源码里通常写作 a.b[0].c。
   不做这一步，farm108 温室 9 个田块会被判成「零证据 → REMOVE」，实际删的是真键。
   例：plots.farm.0.greenhouse → plots.farm[0].greenhouse */
function bracketize(vp) {
  return String(vp).replace(/\.(\d+)(?=\.|$)/g, "[$1]");
}

/* 数组下标段的下标值（仅中间段），用于判定「同族下标共用同一字段」 */
function indexSegments(vp) {
  const parts = String(vp).split(".");
  return parts.filter((s, i, a) => i > 0 && i < a.length - 1 && /^\d+$/.test(s));
}

module.exports = {
  normKey, levenshtein, similarity, findCandidates, dynamicClosure, rootPresent,
  classifyEvidence, coverage, bracketize, indexSegments,
  KEEP, KEEP_DYNAMIC, SOURCE_MISMATCH, REVIEW, WEAK, MISSING
};
