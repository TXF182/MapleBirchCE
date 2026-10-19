# 一键验证链：build → 语法 → DOM 冒烟 → 全量回归
# 用法：.\tools\run_all.ps1 [-Pkg <打包源目录>]    （-Pkg 提供时 build 后顺手同步 JS 到打包源）
param(
    [string]$Pkg = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/4] build_js"
$buildArgs = @("tools/build_js.js")
if ($Pkg) { $buildArgs += @("--sync-pkg", $Pkg) }
node @buildArgs
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: build" -ForegroundColor Red; exit 1 }

Write-Host "[2/4] node --check"
node --check javascript/maplebirchce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: syntax" -ForegroundColor Red; exit 1 }

Write-Host "[3/4] DOM 冒烟 (jsdom)"
node tests/smoke_dom.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: smoke" -ForegroundColor Red; exit 1 }

Write-Host "[4/4] 全量回归"
node tests/test_mce.js
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: regression" -ForegroundColor Red; exit 1 }

Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
