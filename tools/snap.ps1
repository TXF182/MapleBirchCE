# MapleBirchCE 基线快照脚本（落地 AGENTS.md 纪律第 2 条：改码前快照，改完可回滚核对）
# 用法：
#   .\tools\snap.ps1                  # 快照全部 git 已修改文件（未跟踪文件也纳入）
#   .\tools\snap.ps1 src\01-core.js src\04a-04-deadwood.js   # 快照指定文件
# 输出：仓库根 tools\selfcheck\<UTC时间戳>-snapshot.txt（git status + 每文件 SHA256）
# 2026-11-07 修两处缺陷：
#   ① 原 `git status --porcelain` 正行解析漏掉 ` M path`（首列空格的已跟踪修改），改为 -z NUL 分隔 + 逐块解析；
#   ② 原 Get-FileHash 对未跟踪目录（如 types\）直接抛 "Could not find a part of the path"，改为先判
#      Leaf / Container：文件按行哈希，目录递归列出每个文件单独哈希。
$ErrorActionPreference = "Stop"

$MCE = "C:\Users\27352\Doubao\chats\2026-10-13\new-chat-2\MapleBirchCE"
$GIT = "C:\Users\27352\Git\cmd\git.exe"
if (-not (Test-Path -LiteralPath $MCE)) { Write-Host "FAIL: 开发仓库不存在 $MCE" -ForegroundColor Red; exit 1 }

Push-Location $MCE
try {
  $outDir = Join-Path $MCE "tools\selfcheck"
  if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $out = Join-Path $outDir "$stamp-snapshot.txt"

  $lines = @()
  $lines += "== MapleBirchCE 基线快照 $stamp =="
  $lines += ""

  # 1) git status
  $lines += "[1] git status"
  $status = & $GIT status --short 2>&1
  if ($LASTEXITCODE -ne 0) { $status = "git status 失败: $status" }
  $lines += ($status | ForEach-Object { "  " + $_ })
  $lines += ""

  # 2) 指定文件优先；未指定时取 git 全部改动（修改 / 新增 / 删除 / 重命名）
  #    -z: NUL 分隔 + 不转义，避免空格、中文、引号把路径解析切坏
  $targets = @($args)
  if ($targets.Count -eq 0) {
    $modified = @()
    $raw = & $GIT -c core.quotepath=false status --porcelain -z 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "WARN: git status --porcelain -z 失败：$raw" -ForegroundColor Yellow }
    if ($raw) {
      $chunks = $raw -split "`0"
      for ($i = 0; $i -lt $chunks.Count; $i++) {
        $entry = $chunks[$i]
        if ([string]::IsNullOrEmpty($entry) -or $entry.Length -lt 4) { continue }
        $xy = $entry.Substring(0, 2)
        $path = $entry.Substring(3)
        if ($xy -match "^(R|C)" -and ($i + 1) -lt $chunks.Count) {
          # 重命名/复制条目：下一块是原路径（无 XY 前缀），跳过，只记新路径
          $i++
        }
        $modified += $path
      }
    }
    $targets = @($modified)
  }

  $lines += "[2] 涉及文件 SHA256（$(($targets | Measure-Object).Count) 个）"
  foreach ($t in $targets) {
    $full = Join-Path $MCE $t
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $sha = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
      $lines += ("  {0}  {1}" -f $sha, $t)
    } elseif (Test-Path -LiteralPath $full -PathType Container) {
      # 未跟踪目录：逐个文件哈希（否则 Get-FileHash 对目录条目直接抛错）
      $inner = Get-ChildItem -LiteralPath $full -File -Recurse -Force | Sort-Object FullName
      $lines += ("  (目录) {0}  共 {1} 个文件" -f $t, $inner.Count)
      foreach ($f in $inner) {
        $rel = $f.FullName.Substring($MCE.Length + 1) -replace "\\", "/"
        $sha = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
        $lines += ("  {0}  {1}" -f $sha, $rel)
      }
    } else {
      $lines += "  (缺失) $t"
    }
  }

  $lines += ""
  $lines += "回滚方式：git checkout -- <文件>（已跟踪）；未跟踪文件删除即弃"
  [IO.File]::WriteAllLines($out, $lines)
  Write-Host "快照已写: $out" -ForegroundColor Green
  Write-Host "git 改动 $(($targets | Measure-Object).Count) 个文件已纳入 SHA256。"
} finally { Pop-Location }
