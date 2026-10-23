# 一键验证链：build → 语法 → DOM 冒烟 → 全量回归 → 功能级 E2E → 性别集成测试（原版引擎真实函数）
# 用法：.\tools\run_all.ps1 [-Pkg <打包源目录>]    （-Pkg 提供时 build 后顺手同步 JS 到打包源）
param(
    [string]$Pkg = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/5] build_js"
$buildArgs = @("tools/build_js.js")
if ($Pkg) { $buildArgs += @("--sync-pkg", $Pkg) }
node @buildArgs
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: build" -ForegroundColor Red; exit 1 }

Write-Host "[2/5] node --check"
node --check javascript/maplebirchce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: syntax" -ForegroundColor Red; exit 1 }

Write-Host "[3/5] DOM 冒烟 (jsdom)"
node tests/smoke_dom.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: smoke" -ForegroundColor Red; exit 1 }

Write-Host "[4/5] 全量回归"
node tests/test_mce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: regression" -ForegroundColor Red; exit 1 }

Write-Host "[5/5] 功能级 E2E（8 适配器全命中 + 模组特质获取/移除 + 全局页按钮真实点击）"
node tests/functional_e2e.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: functional e2e" -ForegroundColor Red; exit 1 }

Write-Host "[6/6] 性别集成测试（原版引擎真实函数，原版 HTML 缺失时 SKIP 不误报）"
node tests/integration_gender.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: integration_gender" -ForegroundColor Red; exit 1 }

Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
