#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""DoLOnline-Guard 打包（可复现：固定条目时间戳 + 正斜杠 + UTF-8 无 BOM）。

    python tools/dolonline-guard/pack.py

产物：<仓库根>/DoLOnline-Guard.mod.zip
"""
from __future__ import print_function

import hashlib
import io
import os
import sys
import zipfile

FIXED_TS = (1980, 1, 1, 0, 0, 0)
ENTRIES = ["boot.json", "guard.js", "README.md"]

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(REPO, "DoLOnline-Guard.mod.zip")


def main():
    missing = [n for n in ENTRIES if not os.path.isfile(os.path.join(HERE, n))]
    if missing:
        print("[FAIL] 源文件缺失: " + ", ".join(missing))
        return 2

    if os.path.isfile(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in ENTRIES:
            src = os.path.join(HERE, name)
            # 读原始字节，保证不经任何编码转换
            with io.open(src, "rb") as fh:
                data = fh.read()
            info = zipfile.ZipInfo(name.replace("\\", "/"), date_time=FIXED_TS)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            zf.writestr(info, data)

    size = os.path.getsize(OUT)
    with io.open(OUT, "rb") as fh:
        sha = hashlib.sha256(fh.read()).hexdigest().upper()

    print("产物: " + OUT)
    print("大小: {0:,} B".format(size))
    print("SHA256: " + sha)

    # 回读自检
    with zipfile.ZipFile(OUT) as zf:
        names = zf.namelist()
        bad = [n for n in names if "\\" in n]
        print("条目: " + ", ".join(names))
        if bad:
            print("[FAIL] 存在反斜杠条目: " + repr(bad))
            return 1
        if "boot.json" not in names:
            print("[FAIL] boot.json 不在 zip 根目录")
            return 1
        boot = zf.read("boot.json").decode("utf-8")
        if u'"scriptFileList"' not in boot or u'guard.js' not in boot:
            print("[FAIL] boot.json 未指向 guard.js")
            return 1
    print("自检: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
