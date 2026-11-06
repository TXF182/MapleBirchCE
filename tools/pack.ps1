# 一键发布链：run_all 全链验证 → 打包 .mod.zip → verifier 4/4 校验 → SHA256
# 用法：.\tools\pack.ps1
# 说明：学习 Cheat Extended 的 pack.sh（模组根带打包脚本），把"打包"从手工命令升级为
#       验证链的一部分；发布前跑一次，全绿即可交付。
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/5] 全链验证（build / syntax / eslint / smoke / regression / functional e2e / gender）"
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
# 用 ZipArchive 手动写条目（正斜杠分隔符）：
# Compress-Archive 在 Windows 上生成反斜杠条目路径（javascript\maplebirchce.js），
# 游戏 ModLoader 按 '/' 查找报 "cannot get scriptFileList_earlyload file from mod zip"（ERR-20261020-001）
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$arch = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
# 条目时间戳固定 + 按路径排序：否则每次打包写入当前时间、字节数相同但 SHA 每次都变，
# 发布说明里的 SHA256 就失去核对意义（ERR-20261106-013）
$FIXED_MTIME = [DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
$stagingRoot = (Resolve-Path $staging).Path
try {
  $packFiles = @(Get-ChildItem -LiteralPath $stagingRoot -Recurse -File | Sort-Object FullName)
  foreach ($f in $packFiles) {
    $rel = $f.FullName.Substring($stagingRoot.Length + 1) -replace '\\', '/'
    $entry = $arch.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $FIXED_MTIME
    $es = $entry.Open()
    try {
      $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
      $es.Write($bytes, 0, $bytes.Length)
    } finally { $es.Dispose() }
  }
} finally {
  $arch.Dispose()
  $fs.Dispose()
}
Remove-Item $staging -Recurse -Force
Write-Host "  -> $zip ($((Get-Item $zip).Length) B)"

Write-Host "[3/5] zip 条目分隔符校验（必须正斜杠 /，ModLoader 依赖）"
$zchk = [System.IO.Compression.ZipFile]::OpenRead($zip)
$badSep = @($zchk.Entries | Where-Object { $_.FullName -match '\\' })
$entryNames = $zchk.Entries | ForEach-Object { $_.FullName } | Sort-Object
$entryCount = $entryNames.Count
$zchk.Dispose()
if ($badSep.Count -gt 0) {
    Write-Host "FAIL: zip 条目含反斜杠分隔符: $($badSep -join ',')" -ForegroundColor Red
    exit 1
}
Write-Host "  全部 $entryCount 条正斜杠: $($entryNames -join ', ')"

Write-Host "[4/5] verifier 校验（4/4 条目匹配）"
# verifier-hub 入口：skill root 曾迁移（AppData\Local\Doubao\... → AppData\Roaming\LarkShell\aha\users\<id>\doubao\...），
# 此处遍历候选位置取第一个存在的 bin\verifier，避免再次硬编码失效（ERR-20261105-001）
$verifierCandidates = @()
$roamingVerifier = Get-ChildItem -Path (Join-Path $env:APPDATA "LarkShell\aha\users\*\doubao\.doubao\agent_mode\workspace\.skills\verifier-hub\bin\verifier") -ErrorAction SilentlyContinue | Select-Object -First 1
if ($roamingVerifier) { $verifierCandidates += $roamingVerifier.FullName }
$verifierCandidates += "C:\Users\27352\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.skills\verifier-hub\bin\verifier"
$verifier = $verifierCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $verifier) { Write-Host "FAIL: 未找到 verifier-hub 入口（请检查 skill 安装位置）" -ForegroundColor Red; exit 1 }
$check = python $verifier archive zip-check-entries $zip --expected boot.json javascript/maplebirchce.js twee/maplebirchce-widget.twee README.md
if ($check -notmatch '"passed": true') {
    Write-Host "FAIL: verifier" -ForegroundColor Red
    Write-Host $check
    exit 1
}
$quote = if ($check -match '"quote":\s*"([^"]+)"') { $matches[1] } else { "entries matched" }
Write-Host "  verifier: $quote"

Write-Host "[5/5] SHA256"
$hash = Get-FileHash $zip -Algorithm SHA256
Write-Host ("  SHA256=" + $hash.Hash)

Write-Host "完成: $zip ($((Get-Item $zip).Length) B)" -ForegroundColor Green
