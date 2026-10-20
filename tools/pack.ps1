# 一键发布链：run_all 全链验证 → 打包 .mod.zip → verifier 4/4 校验 → SHA256
# 用法：.\tools\pack.ps1
# 说明：学习 Cheat Extended 的 pack.sh（模组根带打包脚本），把"打包"从手工命令升级为
#       验证链的一部分；发布前跑一次，全绿即可交付。
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/5] 全链验证（build / syntax / smoke / regression）"
& (Join-Path $PSScriptRoot "run_all.ps1")
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: run_all" -ForegroundColor Red; exit 1 }

Write-Host "[2/5] 打包 staging（boot.json + javascript + twee + README）"
$staging = "_pack_staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path "$staging\javascript", "$staging\twee" -Force | Out-Null
Copy-Item boot.json "$staging\boot.json" -Force
Copy-Item javascript\maplebirchce.js "$staging\javascript\maplebirchce.js" -Force
Copy-Item twee\maplebirchce-widget.twee "$staging\twee\maplebirchce-widget.twee" -Force
Copy-Item README.md "$staging\README.md" -Force

$zip = Join-Path $root "MapleBirchCE.mod.zip"
Push-Location $staging
Compress-Archive -Path boot.json, javascript, twee, README.md -DestinationPath $zip -Force
Pop-Location
Remove-Item $staging -Recurse -Force
Write-Host "  -> $zip ($((Get-Item $zip).Length) B)"

Write-Host "[3/5] verifier 校验（4/4 条目匹配）"
$verifier = "C:\Users\27352\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.skills\verifier-hub\bin\verifier"
$check = python $verifier archive zip-check-entries $zip --expected boot.json javascript/maplebirchce.js twee/maplebirchce-widget.twee README.md
if ($check -notmatch '"passed": true') {
    Write-Host "FAIL: verifier" -ForegroundColor Red
    Write-Host $check
    exit 1
}
$quote = if ($check -match '"quote":\s*"([^"]+)"') { $matches[1] } else { "entries matched" }
Write-Host "  verifier: $quote"

Write-Host "[4/5] SHA256"
$hash = Get-FileHash $zip -Algorithm SHA256
Write-Host ("  SHA256=" + $hash.Hash)

Write-Host "[5/5] 完成: $zip ($((Get-Item $zip).Length) B)" -ForegroundColor Green
