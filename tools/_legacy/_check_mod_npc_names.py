# -*- coding: utf-8 -*-
"""模组注册 NPC 名 vs CE DISPLAY_NAMES 覆盖核查。
扫描模组源码中 maplebirch.npc.add / NPCNameList / registration 等注册点，
与 CE 01-core.js DISPLAY_NAMES 对照，输出未覆盖的注册角色名。
"""
import re, os

BASE = r"C:\Users\27352\Doubao\chats\2026-10-13\new-chat-2\MapleBirchCE"
core = open(os.path.join(BASE, "javascript", "src", "01-core.js"), encoding="utf-8").read()
dn = re.search(r"DISPLAY_NAMES\s*=\s*\{(.*?)\};", core, re.S).group(1)
mapping = {k.lower(): v for k, v in re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', dn)}

# 模组源码目录
MODS = [
    ("枯木逢春 2.4.5", r"tools\_modcache\dw245\src"),
    ("归途之书 1.3.11", r"tools\_modcache\rv1311\src"),
    ("Dol-Opt 1.1.2.1", r"tools\_modcache\opt1121"),
]

# 注册点模式：npc.add('X' / registerNPC('X' / 'X': {...} / addNamedNPC
REG_PAT = re.compile(r"""npc\.(?:add|register|registerNPC|addNamedNPC)\s*\(\s*['"]([^'"]+)['"]|addNamedNPC\s*\(\s*['"]([^'"]+)['"]|registerNPC\s*\(\s*['"]([^'"]+)['"]""", re.I)

for label, root in MODS:
    root = os.path.join(BASE, root)
    regs = set()
    for dp, _dn, fn in os.walk(root):
        for f in fn:
            if not f.endswith((".ts", ".twee", ".js", ".json")):
                continue
            p = os.path.join(dp, f)
            try:
                t = open(p, encoding="utf-8").read()
            except Exception:
                continue
            for m in REG_PAT.finditer(t):
                name = (m.group(1) or m.group(2) or m.group(3)).strip()
                if name and name not in ("Sydney", "Robin"):  # Sydney/Robin 另有注册在 vanilla
                    regs.add(name)
    uncovered = [n for n in sorted(regs) if n.lower() not in mapping]
    print("===== " + label + " 注册角色名:", len(regs), "====")
    for n in sorted(regs):
        hit = mapping.get(n.lower())
        print(("  [映射:%s] " % hit if hit else "  [未覆盖!] ") + n)
