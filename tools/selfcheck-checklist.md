# MapleBirchCE 交付前自检清单（每次改码交付照此填写）

> 2026-10-28 固化。用法：本次改动的清单填好后随交付汇报；未执行项必须标注原因。
> 模板出处：DoL-Project/AGENTS.md 补充纪律（逐项补丁 / 逐层自检 / 玩家路径走查 / 快照回滚 / 排障索引）。

## 0. 基线快照（改码前必做）
- [ ] `git status` 干净或已知基线记录
- [ ] 涉及文件 SHA256 快照（`tools/selfcheck/` 或会话记录）：
  - 文件列表：____
- [ ] 改动范围（codegraph impact 结果）：____

## 1. 改动点补丁清单（本次改了什么，逐项 ✓/✗）
| # | 文件/功能/键 | 改动内容 | 状态 | 备注 |
|---|---|---|---|---|
| 1 | ____ | ____ | ☐ | ____ |
| 2 | ____ | ____ | ☐ | ____ |

- [ ] 版本双源一致（01-core.js MCE_VERSION == boot.json version）：____
- [ ] 适配器 modName/版本号与官方最新一致：____
- [ ] 新键全部经过 audit/resolve（KEEP/REVIEW 保留、REMOVE 复核）：____

## 2. 验证层清单（逐层状态，禁止"全绿"带过）
- [ ] build_js：____
- [ ] node --check（语法）：____
- [ ] ESLint 四规则（no-dupe-keys / no-unreachable / no-func-assign / eqeqeq）：____
- [ ] DOM 冒烟（jsdom）：____
- [ ] 全量回归（test_mce，断言数 ____/____ 通过，FAIL 条目逐一说明）：____
- [ ] 功能级 E2E（____ 区块）：____
- [ ] 性别集成（passed/failed）：____
- [ ] codegraph sync：____
- [ ] 打包 verifier 4/4：____
- [ ] zip 正斜杠 4/4：____
- [ ] SHA256（本地 / game / Release 回读一致）：____
- [ ] 远端 CI 等价（本机 Node ≥22.22.2 / CI 同为 22；`$env:MCE_DOL_HTML` 指向不存在路径跑 `npm ci` + smoke，SKIP 数 ____，并在 GitHub Actions 上确认一次 success）：____
- [ ] 产物确定性（`git config core.autocrlf` = false；`node tools/build_js.js` 的 SHA256 与 CI `[1/6] 构建拼接产物` 日志输出逐字节一致，基准 615126 B / 2e0e0052…）：____

## 3. 玩家路径走查（本次改动所有用户入口，逐条实机/模拟）
| # | 用户入口（怎么进/怎么点/触发什么） | 走查方式 | 结果 |
|---|---|---|---|
| 1 | ____ | moli 实机 / 模拟 | ☐ |
| 2 | ____ | moli 实机 / 模拟 | ☐ |

- [ ] 关键路径覆盖"玩家实际走的路径"（不止测试路径）
- [ ] 失败入口已修复并回到第 2 节重跑

## 4. 文档与排障索引（交付说明附）
- [ ] README / CHANGELOG 版本条目更新（含本次改动）
- [ ] 已知坑位链接：`.learnings/ERRORS.md` / tool-gotchas（涉及本次改动时）
- [ ] 反馈入口（用户实测发现问题找谁/怎么报）：____
