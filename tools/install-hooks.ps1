# 安装 git hooks：把 core.hooksPath 指向仓库内 githooks/ 目录
# 用法：.\tools\install-hooks.ps1
# 效果：此后每次 git commit 自动先跑 .\tools\run_all.ps1，失败则阻止提交。
# 说明：githooks/ 随仓库提交；新 clone 后只需跑一次本脚本即可生效。
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
git config core.hooksPath githooks
if ($LASTEXITCODE -ne 0) { Write-Host "设置 core.hooksPath 失败" -ForegroundColor Red; exit 1 }
Write-Host "已设置 core.hooksPath → githooks/（本仓库的 git commit 将自动跑一键验证链）" -ForegroundColor Green
