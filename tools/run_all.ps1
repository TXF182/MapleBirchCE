# 一键验证链：build → 语法 → ESLint 四规则 → DOM 冒烟 → 全量回归 → 功能级 E2E → 性别集成测试（原版引擎真实函数）
# 用法：.\tools\run_all.ps1 [-Pkg <打包源目录>]    （-Pkg 提供时 build 后顺手同步 JS 到打包源）
param(
    [string]$Pkg = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/7] build_js"
$buildArgs = @("tools/build_js.js")
if ($Pkg) { $buildArgs += @("--sync-pkg", $Pkg) }
node @buildArgs
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: build" -ForegroundColor Red; exit 1 }

Write-Host "[2/7] node --check"
node --check javascript/maplebirchce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: syntax" -ForegroundColor Red; exit 1 }

Write-Host "[3/7] ESLint 四规则（重复键/不可达/函数重赋值/松散相等）"
if (Test-Path -LiteralPath "node_modules\.bin\eslint.cmd") {
  & "node_modules\.bin\eslint.cmd" javascript/maplebirchce.js
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: eslint（先 npm install 后重跑；规则见 eslint.config.js）" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "    WARN: eslint 未安装（npm install 后可启用），本步跳过" -ForegroundColor Yellow
}

Write-Host "[4/7] DOM 冒烟 (jsdom)"
node tests/smoke_dom.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: smoke" -ForegroundColor Red; exit 1 }

Write-Host "[5/7] 全量回归"
node tests/test_mce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: regression" -ForegroundColor Red; exit 1 }

Write-Host "[6/7] 功能级 E2E（8 适配器全命中 + 模组特质获取/移除 + 全局页按钮真实点击）"
node tests/functional_e2e.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: functional e2e" -ForegroundColor Red; exit 1 }

Write-Host "[7/7] 性别集成测试（原版引擎真实函数，原版 HTML 缺失时 SKIP 不误报）"
node tests/integration_gender.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: integration_gender" -ForegroundColor Red; exit 1 }

Write-Host "ALL CHECKS PASSED" -ForegroundColor Green

# 全绿后自动同步 CodeGraph 图谱（辅助步骤，失败不阻塞交付）
if (Get-Command codegraph -ErrorAction SilentlyContinue) {
  Write-Host "[+] codegraph sync（图谱同步）"
  try { codegraph sync -q; Write-Host "    codegraph 图谱已同步" }
  catch { Write-Host "    WARN: codegraph sync 失败（图谱未更新，可稍后手动 codegraph sync）" -ForegroundColor Yellow }
} else {
  Write-Host "    WARN: codegraph 不在 PATH，跳过图谱同步" -ForegroundColor Yellow
}
