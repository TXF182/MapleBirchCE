# 一键发布链：run_all 全链验证 → 打包 .mod.zip → verifier 校验（严格三项取 AND：条目精确命中 + 集合相等 + CRC 全量；verifier-hub 缺失时后两项照常执行，判据不降级）→ SHA256
# 用法：.\tools\pack.ps1
# 说明：学习 Cheat Extended 的 pack.sh（模组根带打包脚本），把"打包"从手工命令升级为
#       验证链的一部分；发布前跑一次，全绿即可交付。
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "[1/5] 全链验证（run_all.ps1 12 步：build / syntax / eslint 十规则 / 纯函数单测 / smoke / regression / e2e / gender / 声明一致性 / 原版档位 / 覆盖率门禁 / tsc / 键注册表）"
& (Join-Path $PSScriptRoot "run_all.ps1")
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: run_all" -ForegroundColor Red; exit 1 }

Write-Host "[2/5] 打包 staging（boot.json + javascript + twee + 简版 README.pack.md→README.md）"
$staging = "_pack_staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path "$staging\javascript", "$staging\twee" -Force | Out-Null
Copy-Item boot.json "$staging\boot.json" -Force
Copy-Item javascript\maplebirchce.js "$staging\javascript\maplebirchce.js" -Force
Copy-Item twee\maplebirchce-widget.twee "$staging\twee\maplebirchce-widget.twee" -Force
# 包体治理（2026-11-07）：完整 README.md 172 KB 打进 zip 让玩家多下 170 KB，改为打包简版说明。
# 条目名仍是 README.md（boot.json 的 additionFile 契约不变），ModLoader 侧无需任何改动。
$packReadme = Join-Path $root "README.pack.md"
if (-not (Test-Path -LiteralPath $packReadme)) { Write-Host "FAIL: 缺少 README.pack.md（包内简版说明），拒绝回退到 172 KB 全量 README" -ForegroundColor Red; exit 1 }
if ((Get-Item -LiteralPath $packReadme).Length -gt 30000) { Write-Host "FAIL: README.pack.md 超过 30 KB 上限（$((Get-Item -LiteralPath $packReadme).Length) B），请精简" -ForegroundColor Red; exit 1 }
Copy-Item $packReadme "$staging\README.md" -Force
Write-Host "  README（包内）: $((Get-Item -LiteralPath $packReadme).Length) B（仓库全量 README.md: $((Get-Item -LiteralPath (Join-Path $root 'README.md')).Length) B，不进 zip）"

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

Write-Host "[4/5] verifier 校验（严格三项取 AND：条目精确命中 + 集合相等 + CRC 全量）"
# 三项判据各管一件事，缺一不可（2026-11-09 实测，勿简化为单一路径）：
#   ① verifier-hub `archive zip-check-entries --mode exact`：期望条目须以完整路径精确存在。
#      默认 contains 是子串匹配——期望 README.md、包里只有 docs/README.md 时仍判 passed=true（实测），故必须显式 --mode exact。
#   ② 内联集合相等 names == expected：--mode exact 只校验「期望被命中」，不禁止多余条目
#      （实测多塞 extra/stray.txt 仍 passed=true）。打包语义是「恰好这 N 个文件」，多一个就是打错包。
#   ③ 内联 zipfile.testzip()：verifier 的 zip-check-entries 不做 CRC，内容被篡改仍 passed=true（实测）。
# verifier-hub 缺失时 ②③ 照常执行，仅 ① 跳过并明示 WARN —— 判据不因缺工具而放宽。
# skill 根会换档：本机 Default 与 "Profile 1" 两套并存，verifier-hub 只装在后者，故候选必须通配 User Data\*（LRN-20261109-022）。
$expectedEntries = @("boot.json", "javascript/maplebirchce.js", "twee/maplebirchce-widget.twee", "README.md")
$verifierGlobs = @(
    (Join-Path $env:APPDATA "LarkShell\aha\users\*\doubao\.doubao\agent_mode\workspace\.skills\verifier-hub\bin\verifier"),
    (Join-Path $env:APPDATA "LarkShell\aha\users\*\doubao\.doubao\agent_mode\workspace\.user_skills\verifier-hub\bin\verifier"),
    (Join-Path $env:LOCALAPPDATA "Doubao\User Data\*\.doubao\agent_mode\workspace\.skills\verifier-hub\bin\verifier"),
    (Join-Path $env:LOCALAPPDATA "Doubao\User Data\*\.doubao\agent_mode\workspace\.user_skills\verifier-hub\bin\verifier")
)
$verifierCandidates = @()
foreach ($glob in $verifierGlobs) {
    $hit = Get-ChildItem -Path $glob -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { $verifierCandidates += $hit.FullName }
}
$verifier = $verifierCandidates | Select-Object -First 1

$failReason = @()
$verifierQuote = ""

if ($verifier) {
    $vOut = (python $verifier archive zip-check-entries $zip --mode exact --expected @expectedEntries 2>&1) -join "`n"
    if ($vOut -match '"passed": true') {
        $verifierQuote = if ($vOut -match '"quote":\s*"([^"]+)"') { $matches[1] } else { "matched (exact)" }
        Write-Host "  ① verifier(--mode exact): $verifierQuote"
    } else {
        $failReason += "① verifier(--mode exact) 未通过：期望条目未精确命中"
        Write-Host "  verifier 输出：" -ForegroundColor Red
        Write-Host $vOut
    }
} else {
    Write-Host "  WARN: 未找到 verifier-hub 入口（已通配 AppData\Roaming\LarkShell\aha\users\* 与 AppData\Local\Doubao\User Data\*），①跳过；②③照常执行，判据不降级" -ForegroundColor Yellow
}

# ②③ 内联：条目集合精确相等 + CRC 全量（与 ① 无关，始终执行）
$pyCode = "import sys,json,zipfile; z=zipfile.ZipFile(sys.argv[1]); names=sorted(z.namelist()); exp=sorted(sys.argv[2:]); bad=z.testzip(); print(json.dumps({'set_equal': names==exp, 'names': names, 'expected': exp, 'crc_bad': bad, 'count': len(names)}))"
$inOut = (python -c $pyCode $zip @expectedEntries 2>&1) -join "`n"
if ($inOut -match '"set_equal": true') {
    if ($inOut -match '"count": (\d+)') { Write-Host "  ② 集合相等: $($matches[1]) 个条目与期望精确一致" }
} else {
    $failReason += "② 集合相等未通过：条目集合与期望不一致（多出或缺失）"
    Write-Host "  内联集合核对输出：" -ForegroundColor Red
    Write-Host $inOut
}
if ($inOut -match '"crc_bad": null') {
    Write-Host "  ③ CRC: 全量校验无异常条目"
} else {
    $failReason += "③ CRC 校验未通过：存在损坏条目或压缩包结构异常"
    Write-Host "  内联 CRC 核对输出：" -ForegroundColor Red
    Write-Host $inOut
}

if ($failReason.Count -gt 0) {
    foreach ($r in $failReason) { Write-Host "FAIL: $r" -ForegroundColor Red }
    Write-Host "  zip: $zip" -ForegroundColor Red
    exit 1
}
if ($verifier) {
    Write-Host "  verifier 严格三项（exact + 集合相等 + CRC）全部通过"
} else {
    Write-Host "  VERIFIER-FALLBACK（内置 ②③）：集合精确相等 + CRC 全量通过，4 个条目全部命中"
}

Write-Host "[5/5] SHA256"
$hash = Get-FileHash $zip -Algorithm SHA256
Write-Host ("  SHA256=" + $hash.Hash)

Write-Host "完成: $zip ($((Get-Item $zip).Length) B)" -ForegroundColor Green

# 记录验证指纹：紧接着的 git commit 若指纹未变，pre-commit 跳过重复全链
# （第 [1/5] 步刚跑过同一份 run_all，实测 297.7 s）。
# 写失败不影响交付——只是失去跳过机会，pre-commit 会照旧重跑全链。
$vcScript = Join-Path $PSScriptRoot "verify_cache.ps1"
if (Test-Path -LiteralPath $vcScript) {
    try {
        & $vcScript -Write
        if ($LASTEXITCODE -ne 0) { Write-Host "  WARN: 验证指纹写入失败（pre-commit 将重跑全链，不影响本次交付）" -ForegroundColor Yellow }
    } catch {
        Write-Host "  WARN: 验证指纹写入异常：$($_.Exception.Message)（pre-commit 将重跑全链）" -ForegroundColor Yellow
    }
} else {
    Write-Host "  WARN: tools\verify_cache.ps1 缺失，未记录验证指纹（pre-commit 将重跑全链）" -ForegroundColor Yellow
}
