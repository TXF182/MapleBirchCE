# 验证缓存：记录"当前这棵树已经被全链验证过"的证据，供 pre-commit 判定是否重复跑 run_all
#
# 背景：pack.ps1 第 [1/5] 步会跑 run_all 全链（实测 297.7 s），随后 git commit 又触发
#       pre-commit 里的同一份 run_all —— 同一份代码验证两遍。本脚本把"验过什么"落成指纹，
#       commit 时比对指纹即可跳过重复验证。
#
# 用法：
#   .\tools\verify_cache.ps1 -Write   # 全链通过后写缓存（pack.ps1 末尾自动调用）
#   .\tools\verify_cache.ps1 -Check   # pre-commit 判定
#
# -Check 退出码（pre-commit 据此分流）：
#   0 = 指纹命中，当前代码已全链验证且未改动 → 跳过 run_all
#   2 = 本次提交只动了纯文档（docs/ .learnings/ CHANGELOG LICENSE CONTRIBUTING README.md）
#       → 不可能破坏产物，跳过 run_all
#   1 = 需要跑全链（无缓存 / 指纹不符 / 有未暂存改动 / 任何异常）
#
# 判据原则：只认「文件内容 SHA256」，不认 mtime；拿不准一律 exit 1（fail-safe → 跑全链）。
param(
  [switch]$Write,
  [switch]$Check
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cachePath = Join-Path $root ".mce_verify_cache.json"
$artifactRel = "javascript/maplebirchce.js"

# 参与验证判定的路径集合：改动其中任一项，都可能改变全链的结论。
# 刻意不含 docs/、.learnings/、README.md（全量 181 KB 说明，不进 zip）：它们改坏了也影响不到产物。
$verifyPaths = @(
  "javascript/src",
  "javascript/maplebirchce.js",
  "twee",
  "boot.json",
  "README.pack.md",
  "tools",
  "tests",
  "schemas",
  "types",
  "eslint.config.js",
  "package.json",
  "tsconfig.json",
  "tsconfig.src.json",
  ".gitattributes",
  ".github/workflows/ci.yml",
  "githooks/pre-commit"
)

# 目录内不参与判定的子树（大体积缓存 / 旧归档 / 本脚本自己的输出 / 不参与构建的工具页副本）
$excludePrefixes = @(
  "tools/_modcache",
  "tools/_archive_releases",
  "tools/_legacy",
  "tools/selfcheck",
  "tools/game-pages",
  "tools/_srctypes",
  "tests/node_modules",
  "javascript/src/node_modules"
)

function Get-GitExe {
  $c = Get-Command git -ErrorAction SilentlyContinue
  if ($c -and $c.Source) { return $c.Source }
  # 本机 git 不在 PATH 时的既有落点（本项目历史口径）
  $known = "C:\Users\27352\Git\cmd\git.exe"
  if (Test-Path -LiteralPath $known) { return $known }
  return $null
}

function Get-Fingerprint {
  $lines = New-Object 'System.Collections.Generic.List[string]'
  $rootLen = $root.Length + 1
  foreach ($rel in $verifyPaths) {
    $full = Join-Path $root $rel
    if (-not (Test-Path -LiteralPath $full)) { continue }
    if (Test-Path -LiteralPath $full -PathType Container) {
      $files = @(Get-ChildItem -LiteralPath $full -Recurse -File -Force)
    } else {
      $files = @(Get-Item -LiteralPath $full -Force)
    }
    foreach ($f in $files) {
      $rp = $f.FullName.Substring($rootLen) -replace '\\', '/'
      $skip = $false
      foreach ($ep in $excludePrefixes) {
        if ($rp -eq $ep -or $rp.StartsWith($ep + "/")) { $skip = $true; break }
      }
      if ($skip) { continue }
      $h = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
      $lines.Add($rp + " " + $h)
    }
  }
  $joined = (($lines | Sort-Object) -join "`n")
  $sha = [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes($joined))
  return (@($sha | ForEach-Object { $_.ToString("x2") }) -join "")
}

function Test-DocOnly([string[]]$paths) {
  if (-not $paths -or $paths.Count -eq 0) { return $false }
  foreach ($p in $paths) {
    $p = $p -replace '\\', '/'
    if ($p -match '^(docs/|\.learnings/|\.github/ISSUE_TEMPLATE/|\.github/PULL_REQUEST_TEMPLATE\.md)') { continue }
    if ($p -match '^(CHANGELOG\.md|LICENSE|CONTRIBUTING\.md|README\.md)$') { continue }
    return $false
  }
  return $true
}

if ($Write) {
  $art = Join-Path $root $artifactRel
  if (-not (Test-Path -LiteralPath $art)) {
    Write-Host "[verify-cache] FAIL: 产物不存在，拒绝写缓存（$artifactRel）"
    exit 1
  }
  $git = Get-GitExe
  $head = ""
  if ($git) {
    $out = & $git rev-parse HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and $out) { $head = "$out".Trim() }
  }
  $fp = Get-Fingerprint
  $obj = [ordered]@{
    schema        = 1
    fingerprint   = $fp
    artifact      = $artifactRel
    artifactSha   = (Get-FileHash -LiteralPath $art -Algorithm SHA256).Hash
    artifactBytes = (Get-Item -LiteralPath $art).Length
    head          = $head
    writtenAt     = (Get-Date).ToString("o")
  }
  $json = $obj | ConvertTo-Json -Depth 3
  [System.IO.File]::WriteAllText($cachePath, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ("[verify-cache] 已记录验证指纹 {0}…（产物 {1} / {2} B）" -f `
      $fp.Substring(0, 16), $obj.artifactSha.Substring(0, 16), $obj.artifactBytes)
  exit 0
}

if ($Check) {
  $git = Get-GitExe
  if (-not $git) {
    Write-Host "[verify-cache] 未找到 git，无法判定暂存状态 → 跑全链"
    exit 1
  }

  # 工作区必须与暂存区一致，否则"打包时验的"和"要提交的"不是同一份内容
  $unstaged = @(& $git -c core.quotepath=false diff --name-only 2>$null)
  if ($unstaged.Count -gt 0) {
    Write-Host ("[verify-cache] 存在 {0} 个未暂存改动，缓存不可信 → 跑全链" -f $unstaged.Count)
    exit 1
  }

  $staged = @(& $git -c core.quotepath=false diff --cached --name-only 2>$null)
  if (Test-DocOnly $staged) {
    Write-Host ("[verify-cache] 纯文档变更 {0} 个（{1}）→ 跳过全链" -f $staged.Count, ($staged -join ", "))
    exit 2
  }

  if (-not (Test-Path -LiteralPath $cachePath)) {
    Write-Host "[verify-cache] 无验证缓存 → 跑全链"
    exit 1
  }
  try {
    $cache = Get-Content -LiteralPath $cachePath -Raw -Encoding utf8 | ConvertFrom-Json
  } catch {
    Write-Host "[verify-cache] 缓存文件损坏 → 跑全链"
    exit 1
  }
  if (-not $cache.fingerprint -or -not $cache.artifactSha) {
    Write-Host "[verify-cache] 缓存字段缺失 → 跑全链"
    exit 1
  }

  $art = Join-Path $root $artifactRel
  if (-not (Test-Path -LiteralPath $art)) {
    Write-Host "[verify-cache] 产物缺失 → 跑全链"
    exit 1
  }
  $artSha = (Get-FileHash -LiteralPath $art -Algorithm SHA256).Hash
  if ($artSha -ne $cache.artifactSha) {
    Write-Host "[verify-cache] 产物 SHA 与缓存不符 → 跑全链"
    exit 1
  }

  $cur = Get-Fingerprint
  if ($cur -ne $cache.fingerprint) {
    Write-Host ("[verify-cache] 验证输入已变更（{0}… → {1}…）→ 跑全链" -f `
        $cache.fingerprint.Substring(0, 16), $cur.Substring(0, 16))
    exit 1
  }

  Write-Host ("[verify-cache] 命中：指纹 {0}… / 产物 {1}… / 记录于 {2}" -f `
      $cur.Substring(0, 16), $cache.artifactSha.Substring(0, 16), $cache.writtenAt)
  exit 0
}

Write-Host "用法: .\tools\verify_cache.ps1 -Write   (全链通过后写缓存)"
Write-Host "      .\tools\verify_cache.ps1 -Check   (pre-commit 判定，exit 0/2=跳过 1=跑全链)"
exit 1
