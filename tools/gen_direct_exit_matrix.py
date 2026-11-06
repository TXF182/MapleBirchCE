# -*- coding: utf-8 -*-
"""MapleBirchCE 剧情直达「地点 x 出口」穷举矩阵生成器

从原版 DoL HTML 解析场景注册表（$scenes）与全部 tw-passagedata，
对每个场景白名单内段、其 Next 目标，生成「结束判定」期望矩阵：

    tests/data/direct_exit_matrix.json     （smoke_dom.js 块 19.17 消费）
    tests/data/direct_exit_matrix.meta.txt （人类可读摘要 + 证据来源）

判定规则（v1.9.30.003 需求语义，本函数独立于 javascript/src/07f-pins.js 的
实现，用于双实现交叉验证；规则变更必须两边同步并重跑全链）：

    R1 当前段含结束信号 (<<endevent>> / <<badEndTrackingEnd>>)，dest 不在剧情白名单 → clear
    R2 当前段含结束信号，dest 在剧情白名单                                        → keep（rpExit 保护）
    R3 当前段无结束信号，dest == 触发点槽位 «EXIT»                                → clear
    R4 当前段无结束信号，dest 在剧情白名单                                        → keep
    R5 当前段无结束信号，dest 不在白名单且非触发点                                → push（并入白名单放行）
    R6 dest 是场景查看器 UI（Scene Viewer / Scene Viewer End / passages / End 2）  → clear_return

用法：
    python tools/gen_direct_exit_matrix.py [--html <path>] [--out <dir>]
    HTML 缺省读消费端 game/Degrees of Lewdity.html；缺失时退出码 2（不静默跳过）。
"""
import argparse
import hashlib
import json
import os
import re
import sys
import io
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# HTML 定位（v1.9.30.004-P2：去掉单一硬编码绝对路径，换机/协作者可直接跑）
# 顺序：环境变量 MCE_DOL_HTML → 当前目录 game/ 相对位置 → 本机既有绝对路径 → 显式报错（exit 2）
_ENV_HTML = os.environ.get("MCE_DOL_HTML", "").strip()
_HTML_CANDIDATES = [
    Path(_ENV_HTML) if _ENV_HTML else None,
    Path.cwd() / "game" / "Degrees of Lewdity.html",
    Path(r"C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project\game\Degrees of Lewdity.html"),
]
_DEFAULT_HTML = next((p for p in _HTML_CANDIDATES if p and p.exists()), _HTML_CANDIDATES[2])
DEFAULT_HTML = _DEFAULT_HTML
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "tests" / "data"

EXIT_SLOT = "\u00abEXIT\u00bb"  # 触发点槽位哨兵：运行时的 exitpassage，非真实段名
UI_DESTS = {"Scene Viewer", "Scene Viewer End", "Scene Viewer passages", "Scene Viewer End 2"}


def unesc(s):
    return (s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
             .replace("&#39;", "'").replace("&amp;", "&"))


def extract_next_targets(src):
    """提取段内「下一段」目标：[[Next|X]] 形态（含 label 含 next 的 [[label|X]]）。"""
    targets = []
    for mm in re.finditer(r"\[\[\s*Next\s*\|\s*([^\]|]+)", src):
        t = mm.group(1).strip()
        if t and t not in targets:
            targets.append(t)
    for mm in re.finditer(r"\[\[\s*([^\]]*?)\s*\]\]", src):
        t = mm.group(1).strip()
        if "|" in t:
            label, dest = t.split("|", 1)
            if "next" in label.lower():
                d = dest.strip()
                if d and d not in targets:
                    targets.append(d)
    return targets


def parse_widgets(blocks):
    """解析 <<widget "name">>…<</widget>> 定义体（用于识别间接结束信号）。"""
    w = {}
    for _name, body in blocks:
        for mm in re.finditer(r'<<widget\s+"([^"]+)"\s*>>([\s\S]*?)<</widget>>', body):
            w[mm.group(1)] = mm.group(2)
    return w


_RE_HTML_COMMENT = re.compile(r"<!--[\s\S]*?-->")
_RE_BLOCK_COMMENT = re.compile(r"/\*[\s\S]*?\*/")


def strip_comments(s):
    """去掉 <!-- --> 与 /* */ 两类注释。判据只在有效代码上生效：
    原文有 4 段（Bus Station Livestock / Elk Compound Station Badge / Mines Intro / Pirate Deck）
    的 <<endevent 只存在于 /* */ 注释里，1 个 widget（checkEventNPC）的信号只在 <!-- --> 里；
    不剔除会把「注释掉的结束调用」当成真信号 → 提前清锁（与 07f-pins.js::mbCEStripComments 同一口径）。"""
    if not s:
        return ""
    return _RE_BLOCK_COMMENT.sub("", _RE_HTML_COMMENT.sub("", s))


def end_signal_widgets(widgets):
    """定义体内直接含 <<endevent>>/<<badEndTrackingEnd>> 的 widget 集合（depth=1，不含 endevent 自身）。

    v1.9.30.004：本集合已成为 expect() 的判定输入（不再只是审计标注）——
    段内直接调用这些 widget 即视为「段含结束信号」，与 07f-pins.js::mbCESrcHasEndSignal 逐条一致。
    只做 1 层展开；depth>=2 已取证定案不做（14 条候选中 3 条是 loadNPC→checkEventNPC 伪信号，
    其余 11 条信号落在 <<if !$replayScene>> 等条件分支内，展开会引入误判），证据见 meta.txt。
    """
    out = set()
    for n, body in widgets.items():
        if n == "endevent":
            continue
        body = strip_comments(body)
        if ("<<endevent" in body) or ("<<badEndTrackingEnd" in body):
            out.add(n)
    return out


def indirect_end_via(src, end_w):
    """段内直接调用了内部含结束信号的 widget → 返回命中的 widget 名（按出现顺序去重）。"""
    hit = []
    for mm in re.finditer(r"<<([A-Za-z_][A-Za-z0-9_]*)", strip_comments(src)):
        w = mm.group(1)
        if w in end_w and w not in hit:
            hit.append(w)
    return hit


def expect(cur_has_end, dest, dest_in_chain, dest_is_exit_slot):
    """规则判定器（R1-R6），与 JS 实现相互独立。

    cur_has_end 语义（v1.9.30.004）= 「有效结束信号」= 段源码字面含信号 OR 段内直接调用
    定义体内含信号的 widget（depth=1）。JS 侧同一语义由 07f-pins.js::mbCESrcHasEndSignal 实现。
    返回 (expect, rule_id)。
    """
    if dest in UI_DESTS:
        return "clear_return", "R6"
    if cur_has_end and not dest_in_chain:
        return "clear", "R1"
    if cur_has_end and dest_in_chain:
        return "keep", "R2"
    if dest_is_exit_slot:
        return "clear", "R3"
    if dest_in_chain:
        return "keep", "R4"
    return "push", "R5"


def parse_scenes(body):
    scenes = {}
    pat = re.compile(
        r'"([A-Za-z0-9_]+)"\s*:\s*\{\s*name\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*startPassage\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*passages\s*:\s*\[([^\]]*)\]',
        re.S,
    )
    for mm in pat.finditer(body):
        key, name, start, pas = mm.groups()
        plist = [unesc(p.replace('\\"', '"').replace("\\\\", "\\"))
                 for p in re.findall(r'"((?:[^"\\]|\\.)*)"', pas)]
        scenes[key] = {"name": unesc(name.replace('\\"', '"')), "startPassage": unesc(start), "passages": plist}
    return scenes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default=str(DEFAULT_HTML))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    a = ap.parse_args()
    html_path = Path(a.html)
    if not html_path.exists():
        print("FATAL: HTML 不存在 -> " + str(html_path) + "（不静默跳过，退出 2）")
        sys.exit(2)

    raw = html_path.read_bytes()
    try:
        c = raw.decode("utf-8")
    except UnicodeDecodeError:
        c = raw.decode("utf-8", "replace")
    print("HTML bytes: %d" % len(raw))

    m = re.search(r"\$scenes to\s*(\{[\s\S]*?\})\s*>>", c)
    if not m:
        print("FATAL: $scenes widget 未找到")
        sys.exit(2)
    scenes = parse_scenes(m.group(1))
    print("场景 def 数: %d" % len(scenes))

    blocks = re.findall(r'<tw-passagedata[^>]*name="([^"]+)"[^>]*>(.*?)</tw-passagedata>', c, re.S)
    print("tw-passagedata 段数: %d" % len(blocks))
    blocks_u = [(unesc(n), unesc(t)) for n, t in blocks]
    tpl = dict(blocks_u)
    widgets = parse_widgets(blocks_u)
    end_w = end_signal_widgets(widgets)
    print("widget 定义数: %d（内部含结束信号 %d 个）" % (len(widgets), len(end_w)))

    cases = []
    stats = {"R1": 0, "R2": 0, "R3": 0, "R4": 0, "R5": 0, "R6": 0}
    conflicts = []                    # 真冲突检出：同一 (场景,当前段,dest) 出现互相矛盾的期望
    seen_expect = {}
    scenes_without_source = []        # 白名单段在 HTML 中找不到源码的场景
    chain_hits = 0                    # 字面含结束信号的链内段数（meta.chainEndSignalPassages）
    eff_hits = 0                      # 有效结束信号段数 = 字面 OR depth=1 间接（v1.9.30.004）
    indirect_passages = 0             # 无字面结束信号、但直接调用「内部含结束信号 widget」的段数

    for key, sc in sorted(scenes.items()):
        plist = sc["passages"]
        if not plist:
            continue
        missing = [p for p in plist if p not in tpl]
        if missing:
            scenes_without_source.append({"scene": key, "missing": missing})
        for i, p in enumerate(plist):
            src = tpl.get(p, "")
            if not src:
                continue
            cur_has_end = ("<<endevent" in strip_comments(src)) or ("<<badEndTrackingEnd" in strip_comments(src))
            if cur_has_end:
                chain_hits += 1
            ind_via = indirect_end_via(src, end_w) if not cur_has_end else []
            if ind_via:
                indirect_passages += 1
            # v1.9.30.004 判据升级：有效结束信号 = 字面 OR depth=1 间接（widget 定义体内部含信号）
            eff_has_end = bool(cur_has_end or ind_via)
            if eff_has_end:
                eff_hits += 1
            targets = extract_next_targets(src)
            if not targets and not eff_has_end:
                continue
            for d in targets:
                in_chain = d in plist
                e, rule = expect(eff_has_end, d, in_chain, False)
                stats[rule] += 1
                cs_obj = {
                    "id": "%s::%s->%s" % (key, p, d),
                    "scene": key,
                    "sceneName": sc["name"],
                    "startPassage": sc["startPassage"],
                    "curPassage": p,
                    "curIdx": i,
                    "curLen": len(plist),
                    "curHasEnd": cur_has_end,
                    "curHasEndIndirect": bool(ind_via),
                    "curHasEndEff": eff_has_end,
                    "indirectVia": ind_via[:3],
                    "dest": d,
                    "destInChain": in_chain,
                    "destIsStart": (d == sc["startPassage"]),
                    "destIsExitSlot": False,
                    "expect": e,
                    "rule": rule,
                }
                _prev_e = seen_expect.get(cs_obj["id"])
                if _prev_e is not None and _prev_e != e:
                    conflicts.append({"id": cs_obj["id"], "prev": _prev_e, "now": e})
                seen_expect[cs_obj["id"]] = e
                cases.append(cs_obj)
            # 触发点槽位组合：模拟玩家恰在剧情链内段触发直达（dest=exitpassage=cur 的同场景槽位）
            if eff_has_end or targets:
                for d2, is_slot in ((EXIT_SLOT, True),):
                    in_chain2 = d2 in plist  # 永远 False（哨兵非段名）
                    e2, rule2 = expect(eff_has_end, d2, in_chain2, is_slot)
                    stats[rule2] += 1
                    cases.append({
                        "id": "%s::%s->%s" % (key, p, d2),
                        "scene": key,
                        "sceneName": sc["name"],
                        "startPassage": sc["startPassage"],
                        "curPassage": p,
                        "curIdx": i,
                        "curLen": len(plist),
                        "curHasEnd": cur_has_end,
                        "curHasEndIndirect": bool(ind_via),
                        "curHasEndEff": eff_has_end,
                        "indirectVia": ind_via[:3],
                        "dest": d2,
                        "destInChain": in_chain2,
                        "destIsStart": False,
                        "destIsExitSlot": True,
                        "expect": e2,
                        "rule": rule2,
                    })

    # UI 兜底组合：每个场景一条（直达到场景查看器）
    for key, sc in sorted(scenes.items()):
        if not sc["passages"]:
            continue
        e3, rule3 = expect(False, "Scene Viewer End", False, False)
        stats[rule3] += 1
        cases.append({
            "id": "%s::*->Scene Viewer End" % key,
            "scene": key, "sceneName": sc["name"], "startPassage": sc["startPassage"],
            "curPassage": sc["startPassage"], "curIdx": -1, "curLen": len(sc["passages"]),
            "curHasEnd": False, "curHasEndIndirect": False, "curHasEndEff": False, "indirectVia": [],
            "dest": "Scene Viewer End", "destInChain": False,
            "destIsStart": False, "destIsExitSlot": False,
            "expect": e3, "rule": rule3,
        })

    tz = timezone(timedelta(hours=8))
    indirect_cases = [c for c in cases if c.get("curHasEndIndirect")]
    meta = {
        "source": str(html_path),
        "htmlBytes": len(raw),
        "srcHash": hashlib.sha256(raw).hexdigest(),
        "generatedAt": datetime.now(tz).isoformat(timespec="seconds"),
        "sceneDefs": len(scenes),
        "twPassages": len(blocks),
        "chainEndSignalPassages": chain_hits,
        "effEndSignalPassages": eff_hits,
        "caseCount": len(cases),
        "ruleCounts": stats,
        "exitSlot": EXIT_SLOT,
        "conflicts": conflicts,
        "scenesWithMissingSource": scenes_without_source,
        # v1.9.30.004：间接结束信号（depth=1）已作为 expect 判定输入；以下字段用于审计与断言锚点
        "indirectEndPassages": indirect_passages,
        "indirectEndCaseCount": len(indirect_cases),
        "endSignalWidgetCount": len(end_w),
        "endSignalWidgets": sorted(end_w)[:12],
        "indirectAudit": [
            {"scene": c["scene"], "cur": c["curPassage"], "dest": c["dest"],
             "via": c["indirectVia"], "rule": c["rule"], "expect": c["expect"]}
            for c in indirect_cases if not c["destIsExitSlot"]
        ],
    }

    # 场景表随矩阵一起落地：测试端需按 scene 复原真实白名单（passages）与 startPassage
    scene_table = {
        k: {"name": v["name"], "startPassage": v["startPassage"], "passages": v["passages"]}
        for k, v in scenes.items() if v["passages"]
    }

    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    # 显式 CRLF：Path.write_text 的换行由平台决定（Windows 写 \r\n、Linux 写 \n），会让同一份矩阵在
    # 不同机器上产出不同字节、git 出现整文件 diff。钉死 newline 保可复现（.editorconfig 同此口径）。
    matrix_txt = json.dumps({"meta": meta, "scenes": scene_table, "cases": cases}, ensure_ascii=False, indent=1)
    with open(out_dir / "direct_exit_matrix.json", "w", encoding="utf-8", newline="\r\n") as f:
        f.write(matrix_txt)

    lines = ["# direct_exit_matrix 生成摘要（证据来源留档）", ""]
    for k in ("source", "htmlBytes", "srcHash", "generatedAt", "sceneDefs", "twPassages",
              "chainEndSignalPassages", "effEndSignalPassages", "caseCount"):
        lines.append("- %s: %s" % (k, meta[k]))
    lines.append("- ruleCounts: %s" % json.dumps(stats, ensure_ascii=False))
    lines.append("- conflicts(同 id 期望矛盾): %d" % len(conflicts))
    lines.append("- scenesWithMissingSource: %d" % len(scenes_without_source))
    lines.append("- 判据说明（v1.9.30.004）：结束信号 = 段源码（**已剔除 <!-- --> 与 /* */ 注释**）字面含 "
                 "<<endevent / <<badEndTrackingEnd>>"
                 " OR 段内直接调用「定义体内含信号」的 widget（depth=1，运行时展开才可见，如 <<endcombat>>）。"
                 "双实现（本生成器 / 07f-pins.js::mbCESrcHasEndSignal）判据必须逐条一致；"
                 "规则组合与优先级仍各自独立实现（交叉验证的价值仅覆盖后者）")
    lines.append("- 注释排除（v1.9.30.004 二次校准）：原文 4 段（Bus Station Livestock / "
                 "Elk Compound Station Badge / Mines Intro / Pirate Deck）的 <<endevent 只存在于 /* */ 注释内，"
                 "1 个 widget（checkEventNPC）的信号只在 <!-- --> 注释内；不剔除会把「被注释掉的结束调用」当真信号 → "
                 "提前清锁。剔除后本矩阵 case / rule / 各计数全部不变（这 4 段不在白名单场景内）。")
    lines.append("- depth≥2 定案（v1.9.30.004 取证，结论：**不做**）：严格 2 层展开候选 14 条 / 命中 widget 152 个，"
                 "其中 3 条为 loadNPC→checkEventNPC 伪信号（信号在注释里）；"
                 "nightmareEnd→endcombat（5 条）与 schismEnd→endcombat（2 条）的信号位于 <<if !$replayScene>> 分支内"
                 "（剧情直达态 $replayScene 已置位 → 该分支根本不执行）；只有 pinchEnd→endcombat（4 条）是无条件末尾调用。"
                 "而 depth2 名单里 npc / pregnancyPassout / adultShopClear 等通用工具 widget 占多数，"
                 "无条件 2 层展开会把「段内调了 <<npc>>」一律判结束 → 维持 depth=1。")
    lines.append("- 间接结束信号（已纳入判定，depth=1）：%d 段 / %d 条 case；"
                 "内部含结束信号的 widget %d 个（如 %s）"
                 % (indirect_passages, len(indirect_cases), len(end_w), ", ".join(meta["endSignalWidgets"][:6])))
    audit = meta["indirectAudit"]
    if audit:
        lines.append("  以下条目为间接结束信号的判定结果（不再按 R5 push 放行）：")
        for a in audit[:20]:
            lines.append("    [%s] %s | %s -> %s  via %s" % (a["rule"], a["scene"], a["cur"], a["dest"], ",".join(a["via"])))
        if len(audit) > 20:
            lines.append("    …（共 %d 条，完整清单见 JSON meta.indirectAudit）" % len(audit))
    if scenes_without_source:
        for s in scenes_without_source[:10]:
            lines.append("  - %s missing %d: %s" % (s["scene"], len(s["missing"]), ", ".join(s["missing"][:6])))
    with open(out_dir / "direct_exit_matrix.meta.txt", "w", encoding="utf-8", newline="\r\n") as f:
        f.write("\n".join(lines) + "\n")

    print("cases=%d 规则分布=%s" % (len(cases), json.dumps(stats, ensure_ascii=False)))
    print("conflicts=%d scenesWithMissingSource=%d indirect=%d段/%d条 eff=%d段"
          % (len(conflicts), len(scenes_without_source), indirect_passages, len(indirect_cases), eff_hits))
    print("写出: " + str(out_dir / "direct_exit_matrix.json"))


if __name__ == "__main__":
    main()
