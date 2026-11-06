# 安装 git hooks：把 core.hooksPath 指向仓库内 githooks/ 目录
# 用法：.\tools\install-hooks.ps1
# 效果：此后每次 git commit 自动先跑 .\tools\run_all.ps1，失败则阻止提交。
# 说明：githooks/ 随仓库提交；新 clone 后只需跑一次本脚本即可生效。
# 兼容：本机 git 可能不在 PATH（历史踩坑），优先用常见绝对路径，再回退 PATH 查找。
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$gitCmd = $null
foreach ($cand in @("C:\Users\$env:USERNAME\Git\cmd\git.exe", "C:\Program Files\Git\cmd\git.exe", "C:\Program Files (x86)\Git\cmd\git.exe")) {
  if (Test-Path -LiteralPath $cand) { $gitCmd = $cand; break }
}
if (-not $gitCmd) {
  $found = Get-Command git -ErrorAction SilentlyContinue
  if ($found) { $gitCmd = $found.Source }
}
if (-not $gitCmd) {
  Write-Host "FAIL: 未找到 git（PATH 与常见安装路径都未命中）。请安装 Git for Windows 或把 git 加入 PATH。" -ForegroundColor Red
  exit 1
}

& $gitCmd config core.hooksPath githooks
if ($LASTEXITCODE -ne 0) { Write-Host "设置 core.hooksPath 失败（git=$gitCmd）" -ForegroundColor Red; exit 1 }
$cur = (& $gitCmd config --get core.hooksPath).Trim()
if ($cur -ne "githooks") { Write-Host "FAIL: 回读 core.hooksPath=[$cur]，期望 githooks" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath (Join-Path $repo "githooks\pre-commit"))) {
  Write-Host "FAIL: githooks\pre-commit 缺失，钩子不会生效" -ForegroundColor Red; exit 1
}
Write-Host "已设置 core.hooksPath → githooks/（git=$gitCmd，回读=$cur，本仓库的 git commit 将自动跑一键验证链）" -ForegroundColor Green
