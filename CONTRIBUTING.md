# 参与贡献 MapleBirchCE

本项目是 Degrees of Lewdity 的 ModLoader 模组（MapleBirch Framework 兼容作弊器）。
提 PR 前请先读 [`AGENTS.md`](AGENTS.md)——那里是硬约束清单，本文只讲怎么跑。

## 环境

- Windows + PowerShell 7（`pwsh`）；`node` 18+；`python` 3.10+（仅矩阵生成器需要）
- 首次拉仓库后执行一次 `npm install`（只装 ESLint，用于第 3 步 lint）
- `git` 不在 PATH 时用绝对路径调用（本机为 `C:\Users\27352\Git\cmd\git.exe`）

## 改码流程

```powershell
# 1) 改前存基线快照（含涉及文件 SHA256，落在 tools\selfcheck\）
.\tools\snap.ps1

# 2) 只改分片源码：javascript\src\*.js
#    绝不手改 javascript\maplebirchce.js —— 那是构建产物

# 3) 跑全链（9 步，1-3 分钟）
.\tools\run_all.ps1
#    build → node --check → ESLint 八规则 → DOM 冒烟 → 全量回归 → 功能级 E2E → 性别集成 → 适配器声明一致性 → 覆盖率门禁
#    任何一步红都不算完成；末尾自动 codegraph sync

# 4) 有 src 改动必须再跑实机冒烟（约 2-4 分钟）
.\real_smoke.ps1

# 5) 打包（zip 条目正斜杠 + verifier 4/4 + SHA256）
.\tools\pack.ps1
```

`.\dev.ps1` = 全链 + 打包 + 自动装进游戏目录，一次跑完。

## 硬约束（违反会被拒）

1. **只改 `javascript\src\*.js`**，构建产物 `javascript\maplebirchce.js` 由 build 生成。
2. **版本双源同步**：`javascript\src\01-core.js` 的 `MCE_VERSION` 与 `boot.json` 的 `version` 必须一致——但**升版本需维护者明确指令**，PR 里不要自行升版。
3. **判据两侧同源**：剧情直达的「出口结束信号」判据有两套实现——`javascript\src\07f-pins.js::mbCESrcHasEndSignal`（运行时）与 `tools\gen_direct_exit_matrix.py::end_signal_widgets`（矩阵生成）。任一侧改动必须两侧同改、重生成矩阵（`python tools\gen_direct_exit_matrix.py`）并重跑全链，否则 `tests\smoke_dom.js` 的 19.17 穷举会立即红。
4. **不擅自升版、不擅自发布、不擅自删用户文件**。
5. 新增测试断言要能真的拦住回退（改了实现就把断言一起改，别只改数据基线）。

## 提交

- 本地 `githooks/pre-commit` 会跑全链，失败即阻止提交（**fail-closed**：无 PowerShell 也会阻止，不会静默跳过）。请勿用 `--no-verify` 绕过。
- commit message 用 `area: 说明` 形式（如 `fix: 直达出口判据纳入间接结束信号`）。

## 报告问题

用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md)，务必带上：游戏版本、框架版本、其他已装模组、复现步骤、`F12` 控制台报错。没有复现步骤的问题很难定位。
