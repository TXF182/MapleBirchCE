# -*- coding: utf-8 -*-
"""角色名中文化核查：提取 04-modcheat.js 全部 name 字段中的角色名，
与 01-core.js DISPLAY_NAMES 映射 + 模组官方译名对照。
"""
import re, os, sys

BASE = r"C:\Users\27352\Doubao\chats\2026-10-13\new-chat-2\MapleBirchCE"
mcheat = open(os.path.join(BASE, "javascript", "src", "04-modcheat.js"), encoding="utf-8").read()
core = open(os.path.join(BASE, "javascript", "src", "01-core.js"), encoding="utf-8").read()

# DISPLAY_NAMES 映射（value=中文）
dn = re.search(r"DISPLAY_NAMES\s*=\s*\{(.*?)\};", core, re.S).group(1)
mapping = dict(re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', dn))
print("DISPLAY_NAMES 映射条数:", len(mapping))

# 全部 name 字段
names = re.findall(r'name: "([^"]+)"', mcheat)
print("name 字段总数:", len(names))

# 含英文字母的（潜在英文残留）
latin = [n for n in names if re.search(r"[A-Za-z]", n)]
print("\n--- 含英文字母的 name（潜在英文残留）---")
for n in latin:
    print(" ", n)

# 中文名里出现的角色名 token（前 2-4 字符，匹配映射值）
print("\n--- 中文名里与 DISPLAY_NAMES 映射值不一致的疑似角色名 ---")
cn_values = set(mapping.values())
for n in names:
    # 取 name 前缀（角色名一般在"xxx · "前）
    seg = n.split("·")[0].strip()
    # 只检查中文部分
    for tok in re.findall(r"[\u4e00-\u9fff]{2,4}", seg):
        if tok in ("未开始", "已问起", "未入门", "筹备", "已申请", "选址", "已验收", "已许可", "合作", "竞争",
                   "已收束", "在家", "已入院", "康复中", "已玩过", "未开始", "进行中", "已完成", "已获奖",
                   "未开始", "校服", "自由着装", "暴露着装", "可选裸体", "裸体日", "强制裸体", "学生", "风纪委员",
                   "学生会长", "在家", "已入院", "康复中", "无", "普通", "镶宝石", "已触发", "已拒绝", "已存放"):
            continue
        if tok not in cn_values:
            print("  疑似不一致:", repr(n), "-> token:", tok)
