# tests/fixtures —— 原版取证片段（测试专用，不进发布包）

| 文件 | 内容 | 消费者 | 体积 |
|---|---|---|---|
| `scenes-widget.twee` | 原版 `Scene Viewer Widgets` 里的 `$scenes` 元数据（外包一层 `<<widget "scenes">>`） | `tests/smoke_dom.js` 第 15 / 19 节 | 68028 B |
| `dol-gender-funcs.js` | 原版 `isGenitalMismatch` / `isCrossdressing` / `isHermOrCrossdresser` | `tests/integration_gender.js` | 1089 B |

来历：由 `node tools/gen_test_fixture.js` 从本机原版 `Degrees of Lewdity.html` 抽取，只保留测试真正读取的片段；
目的：让 CI / 干净克隆在没有 64 MB 原版 HTML 时跑同一批断言，而不是 SKIP。

重生成：`node tools/gen_test_fixture.js`（可用 `MCE_DOL_HTML` 指定原版路径）；
校验：`node tools/gen_test_fixture.js --check`（存在性 + 可解析，CI/pre-commit 可挂）。

**不进发布包**：`tools/pack.ps1` 只打 `boot.json` / `javascript/maplebirchce.js` / `twee/*.twee`。
若原版升级导致场景数变化，重跑生成器并同步更新 smoke 断言里的数据口径。