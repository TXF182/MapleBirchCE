#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""codegraph 轻量增量同步器（CLI 缺失时的兜底工具）

背景：codegraph CLI 从本机消失后（2026-11-21 实测 PATH/npm 全局均无），
.codegraph/codegraph.db 停在 indexed_at_commit=cff619de。本脚本直接操作
SQLite 做增量同步：删符号 / 加符号 / 更新 files 表 / 更新 metadata，
nodes_fts 由库内触发器（nodes_ai/ad/au）自动同步，无需手工维护。

用法：
  python tools/codegraph_sync_light.py \
    --commit <40hex> \
    --removed Name1,Name2 \
    --added "function:mbCEPreviewSame:javascript/src/08d-diff-preview.js:38:60" \
    --files javascript/src/01-core.js ...

约定：
  - 节点 id = <kind>:<md5(file_path:name) 前 32 hex>，仅保证唯一与格式一致；
    原 CLI 的 id 算法不可考，图谱查询一律以 name/qualified_name 为准。
  - 不重建调用边（calls/references 边仍按旧索引），仅保证：符号存在性正确、
    被删符号的悬挂边被清除、files 表指纹与当前源码一致。
"""
import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".codegraph", "codegraph.db")


def md5id(kind, file_path, name):
    h = hashlib.md5((file_path + ":" + name).encode("utf-8")).hexdigest()
    return "%s:%s" % (kind, h)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", help="40 位 hex：写入 project_metadata.indexed_at_commit")
    ap.add_argument("--removed", default="", help="逗号分隔：按 name 精确删除的节点")
    ap.add_argument("--added", action="append", default=[],
                    help="新增节点 kind:name:file:start:end，可重复")
    ap.add_argument("--files", nargs="*", default=[], help="更新 files 表指纹的路径（相对仓库根）")
    args = ap.parse_args()

    db = os.path.abspath(DB)
    if not os.path.exists(db):
        print("FATAL: db 不存在", db)
        sys.exit(1)
    conn = sqlite3.connect(db)
    c = conn.cursor()

    print("== 1) 删除符号 ==")
    for name in [n.strip() for n in args.removed.split(",") if n.strip()]:
        rows = c.execute("select id, kind, file_path, start_line from nodes where name=?", (name,)).fetchall()
        if not rows:
            print("  [skip] 未找到节点:", name)
            continue
        for nid, kind, fp, sl in rows:
            e1 = c.execute("select count(*) from edges where source=? or target=?", (nid, nid)).fetchone()[0]
            c.execute("delete from edges where source=? or target=?", (nid, nid))
            c.execute("delete from nodes where id=?", (nid,))
            print("  [del] %s %s (%s:%s), 悬挂边清理 %d 条" % (kind, name, fp, sl, e1))

    print("== 2) 新增符号 ==")
    for spec in args.added:
        try:
            kind, name, fp, start, end = spec.split(":")
        except ValueError:
            print("  [bad] 格式应为 kind:name:file:start:end ->", spec)
            continue
        nid = md5id(kind, fp, name)
        exists = c.execute("select count(*) from nodes where id=?", (nid,)).fetchone()[0]
        if exists:
            print("  [skip] id 已存在:", nid)
            continue
        c.execute(
            "insert into nodes (id, kind, name, qualified_name, file_path, language, start_line, end_line, "
            "start_column, end_column, updated_at) "
            "values (?,?,?,?,?,?,?,?,0,0,?)",
            (nid, kind, name, name, fp, "javascript", int(start), int(end), int(time.time() * 1000)))
        c.execute("insert into edges (source, target, kind, metadata) values (?,?,?,?)",
                  ("file:" + fp, nid, "contains", json.dumps({"light_sync": True})))
        print("  [add] %s %s (%s:%s-%s) id=%s" % (kind, name, fp, start, end, nid))

    print("== 3) files 表指纹 ==")
    for fp in args.files:
        disk = os.path.join(os.path.dirname(DB), "..", fp.replace("/", os.sep))
        if not os.path.exists(disk):
            print("  [skip] 文件不存在:", fp)
            continue
        data = open(disk, "rb").read()
        h = hashlib.sha256(data).hexdigest()
        n = c.execute("select count(*) from nodes where file_path=?", (fp,)).fetchone()[0]
        c.execute("update files set content_hash=?, size=?, node_count=?, modified_at=?, indexed_at=? "
                  "where path=?",
                  (h, len(data), n, int(time.time() * 1000), int(time.time() * 1000), fp))
        print("  [upd] %s hash=%s… size=%d nodes=%d" % (fp, h[:12], len(data), n))

    print("== 4) metadata ==")
    if args.commit:
        c.execute("insert or replace into project_metadata (key, value, updated_at) values (?,?,?)",
                  ("indexed_at_commit", args.commit, int(time.time() * 1000)))
        c.execute("insert or replace into project_metadata (key, value, updated_at) values (?,?,?)",
                  ("indexed_dirty_paths", json.dumps({"commit": args.commit, "paths": []}),
                   int(time.time() * 1000)))
        print("  indexed_at_commit ->", args.commit)

    conn.commit()
    print("== 完成，校验 ==")
    print("  nodes:", c.execute("select count(*) from nodes").fetchone()[0],
          "edges:", c.execute("select count(*) from edges").fetchone()[0])
    print("  悬挂边:", c.execute(
        "select count(*) from edges where source not in (select id from nodes) "
        "or target not in (select id from nodes)").fetchone()[0])
    conn.close()


if __name__ == "__main__":
    main()
