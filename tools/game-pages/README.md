# IndexedDB 工具页（DoL ModLoader 装载通道）

面向 `file://` origin 的 ModLoader IndexedDB（库/store 同名 `ModLoader_IndexDBLoader`）。
这些页面**只在玩家真实 origin 上有意义**：用 Edge 以 `file://` 打开 `DoL-Project\game\<页面>.html`，
不要用 http 起服务——`http://127.0.0.1` 与 `file://` 不共享 IndexedDB，看到的 mod 集不是玩家的。

## 用法

1. 把页面从本目录拷回 `DoL-Project\game\`（**本目录是版本控制存档，不是运行位置**）。
2. Edge 打开 `file:///…/game/mce-idb-clean-dup.html` 之类的地址。
3. 任何写操作都要「先只读读取现状 → 执行 → 回读断言」，不要凭页面显示判断成功。

## 页面清单（2026-11-07 状态）

| 文件 | 大小 | 状态 | 动作 |
|---|---|---|---|
| `mce-mod-import.html` | 11,878 B | 可用 | 选 zip 导入 IndexedDB；`?selftest=1` 自检写入/读回/回滚；「导出列表备份」可回滚 |
| `mce-idb-clean-dup.html` | 10,935 B | 可用（本轮主力） | 单事务：列表精确移除 + `delete` 包键；`tx.oncomplete` 后开只读事务回读五项断言 |
| `mce-idb-dropkey.html` | 10,999 B | 可用 | 只读列出全部包键与体积；单键两击删除 |
| `mce-idb-unlist.html` | 5,722 B | 已弃用 | 只改列表不删包键（不持久）；「重新读取」按钮两次无响应 |
| `mce-idb-inspect.html` | 3,189 B | 不可用 | 8 库全报 `Cannot read properties of undefined (reading 'slice')` |

## 必须记住的两条机制

1. **只删列表项不持久**：包键 `modDataIndexDBZip:<文件名>` 仍在时，ModHub 会把旧名重新 append 到列表队尾并**最后生效**（面板回退旧版本、页签数变化）。正确顺序是「包键 + 列表项同一事务一起清」。
2. **`verify()` 的包键判据必须拼前缀**：写成 `PREFIX + 'MapleBirchCE.mod.zip'`（`PREFIX = 'modDataIndexDBZip:'`）；漏前缀会假红（首跑踩过，五项断言最后一项误报）。

## 实测基线（v2.0.0.002 安装态）

- 清理后：`总键数=61 ｜ 包键数=26 ｜ 列表条目数=26`，一一对应。
- 唯一 CE 包键 `modDataIndexDBZip:MapleBirchCE.mod.zip`（281,963 B）。
- ModHub：`已加载 50 / 已启用 26 / 已禁用 0`、`已安装模组 共 26 个`、`显示 26/26`。
- 游戏页加载日志 `错误 32 / 警告 0`（32 条为历史既有 `Error evaluating layer spotlight/glow property src`）。

## 为什么不直接放 `game\`

消费端 `DoL-Project` 及其上级目录都不是 git 仓库（`rev-parse --show-toplevel` 报 not a git repository），
页面放在那里改坏了无法 diff、无法回滚。本目录是它们的版本控制副本，改动随生产端仓库的 pre-commit 全链验证。
