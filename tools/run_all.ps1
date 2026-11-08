# 一键验证链：build → 语法 → ESLint 八规则 → DOM 冒烟 → 全量回归 → 功能级 E2E → 性别集成测试（原版引擎真实函数）→ 适配器声明一致性 → 原版数字档位形态 → 覆盖率门禁 → tsc 类型检查 → 键注册表一致性
# 用法：.\tools\run_all.ps1 [-Pkg <打包源目录>]    （-Pkg 提供时 build 后顺手同步 JS 到打包源）
param(
    [string]$Pkg = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/12] build_js（manifest 段序校验 + 单段预算 / 续号命名结构门禁）"
$buildArgs = @("tools/build_js.js")
if ($Pkg) { $buildArgs += @("--sync-pkg", $Pkg) }
node @buildArgs
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: build（manifest 与目录不一致 / 段末缺换行，见上方 FATAL）" -ForegroundColor Red; exit 1 }
node tools/check_structure.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: structure（单段超预算或续号命名，见上方 S1/S2；豁免须写进 tools/structure-baseline.json）" -ForegroundColor Red; exit 1 }

Write-Host "[2/12] node --check"
node --check javascript/maplebirchce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: syntax" -ForegroundColor Red; exit 1 }

Write-Host "[3/12] ESLint 八规则（重复键/不可达/函数重赋值/松散相等/自赋值/恒定条件/不安全取反/贯穿）"
if (Test-Path -LiteralPath "node_modules\.bin\eslint.cmd") {
  & "node_modules\.bin\eslint.cmd" javascript/maplebirchce.js
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: eslint（先 npm install 后重跑；八规则见 eslint.config.js 头部）" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "    WARN: eslint 未安装（npm install 后可启用），本步跳过" -ForegroundColor Yellow
}

Write-Host "[4/12] DOM 冒烟 (jsdom)"
node tests/smoke_dom.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: smoke" -ForegroundColor Red; exit 1 }

Write-Host "[5/12] 全量回归 + 声明矩阵回读"
node tests/test_mce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: regression" -ForegroundColor Red; exit 1 }
node tests/test_adapter_matrix.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: adapter matrix（声明驱动的写入回读断言失败，见上方 FAIL 行；改过 04a-*.js 后须重跑 node tools/gen_adapter_matrix.js）" -ForegroundColor Red; exit 1 }
Write-Host "    锁定恢复真实路径（注入早于读档 → 翻页写回 + 面板全部可锁 path 批量核查）"
node tests/lock_resume.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: lock_resume（锁定在刷新/读档后未恢复，或某条可锁 path 写不回目标）" -ForegroundColor Red; exit 1 }
Write-Host "    适配器动作直调通道 + 存档就绪判据（未读档报错 / 就绪真写入 / detect 命中）"
node tests/adapter_actions.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: adapter_actions（动作直调通道或 hasV 判据回归）" -ForegroundColor Red; exit 1 }

Write-Host "[6/12] 功能级 E2E（8 适配器全命中 + 模组特质获取/移除 + 全局页按钮真实点击）"
node tests/functional_e2e.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: functional e2e" -ForegroundColor Red; exit 1 }

Write-Host "[7/12] 性别集成测试（原版引擎真实函数，原版 HTML 缺失时 SKIP 不误报）"
node tests/integration_gender.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: integration_gender" -ForegroundColor Red; exit 1 }

Write-Host "[8/12] 适配器声明一致性（schema 校验 + 矩阵幂等 + 结构自洽 + 类型形态）"
node tools/validate_adapters.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: validate_adapters（字段白名单/必填/类型枚举/数值域/levels-labels/sync/varPath 形状，见上方 FAIL 行）" -ForegroundColor Red; exit 1 }
node tools/gen_adapter_matrix.js --check
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: adapter matrix 漂移（改过 04a-*.js 后须重跑 node tools/gen_adapter_matrix.js 并提交 tests/data/adapter_matrix.json）" -ForegroundColor Red; exit 1 }
node tools/check_claims.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: check_claims（声明结构不自洽：重复键/重复路径/levels-labels 错位/min>max）" -ForegroundColor Red; exit 1 }
if (Test-Path -LiteralPath "tools\_modcache\STATE.json") {
  node tools/check_key_types.js
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: check_key_types（声明类型与模组源码形态冲突，见工具输出）" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "    WARN: tools\_modcache\STATE.json 缺失（未下载对照源码），类型形态核查跳过" -ForegroundColor Yellow
}

Write-Host "[9/12] 原版数字档位形态（07d-places PLACE_GROUPS 声明 vs 0.5.12.13 赋值形态；原版 HTML 缺失时 SKIP）"
node tools/check_vanilla_types.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: check_vanilla_types（声明数字档位但原版是字符串枚举 → 面板写入会静默半失效，见工具输出）" -ForegroundColor Red; exit 1 }

Write-Host "[10/12] 覆盖率门禁（c8：lines>=90 branches>=80 functions>=95，低于门槛即失败；序列含稳定性循环与键核单测）"
if (Test-Path -LiteralPath "node_modules\.bin\c8.cmd") {
  & "node_modules\.bin\c8.cmd" --include=javascript/maplebirchce.js --reporter=text-summary --check-coverage --lines 90 --branches 80 --functions 95 node tools/run_coverage.js
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: coverage gate（覆盖低于门槛，见上表）" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "    WARN: c8 未安装（npm install 后启用），覆盖门禁跳过" -ForegroundColor Yellow
}
Write-Host "[11/12] 类型检查（产物侧 tsc -p tsconfig.json：allowJs+checkJs，0 错误才过；缺全局声明时改 types\*.d.ts，不改源码引用）+ src 侧分账（tsconfig.src.json strict:true 按文件棘轮）"
if (Test-Path -LiteralPath "node_modules\.bin\tsc.cmd") {
  & "node_modules\.bin\tsc.cmd" -p tsconfig.json
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: tsc（类型错误/未声明标识符，见上方输出；勿删引用，先确认是否引擎全局）" -ForegroundColor Red; exit 1 }
  # src 侧：manifest 拼接联合文件 → strict:true → 错误按行区间映射回 src 文件 → 与 tools\src-types-baseline.json 做棘轮
  node tools/check_src_types.js
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: src 侧类型债务超出基线（修代码或按 --write-baseline 流程评审后收窄）" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "    WARN: typescript 未安装（npm install 后启用），类型检查跳过" -ForegroundColor Yellow
}

Write-Host "[12/12] 键注册表一致性（keys.registry.json vs 04a-*.js；改适配器后须 node tools/gen_key_registry.js --write）"
node tools/gen_key_registry.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: key registry（注册表与源码漂移，见上方 ADDED/REMOVED/RENAMED 行）" -ForegroundColor Red; exit 1 }

Write-Host "ALL CHECKS PASSED" -ForegroundColor Green

# 全绿后自动同步 CodeGraph 图谱（辅助步骤，失败不阻塞交付）
if (Get-Command codegraph -ErrorAction SilentlyContinue) {
  Write-Host "[+] codegraph sync（图谱同步）"
  try { codegraph sync -q; Write-Host "    codegraph 图谱已同步" }
  catch { Write-Host "    WARN: codegraph sync 失败（图谱未更新，可稍后手动 codegraph sync）" -ForegroundColor Yellow }
} else {
  Write-Host "    WARN: codegraph 不在 PATH，跳过图谱同步" -ForegroundColor Yellow
}
