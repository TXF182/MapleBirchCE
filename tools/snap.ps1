# MapleBirchCE 基线快照脚本（落地 AGENTS.md 纪律第 2 条：改码前快照，改完可回滚核对）
# 用法：
#   .\tools\snap.ps1                  # 快照全部 git 已修改文件（未跟踪文件也纳入）
#   .\tools\snap.ps1 src\01-core.js src\04a-04-deadwood.js   # 快照指定文件
# 输出：仓库根 tools\selfcheck\<UTC时间戳>-snapshot.txt（git status + 每文件 SHA256）
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

  # 2) 指定文件优先；未指定时取 git 修改/新增文件
  $targets = @($args)
  if ($targets.Count -eq 0) {
    $modified = & $GIT status --porcelain 2>$null | ForEach-Object {
      if ($_ -match "^(M|A|\?\?) (.+)$") { $Matches[2] }
    }
    $targets = @($modified | Where-Object { $_ })
  }

  $lines += "[2] 涉及文件 SHA256（$(($targets | Measure-Object).Count) 个）"
  foreach ($t in $targets) {
    $full = Join-Path $MCE $t
    if (Test-Path -LiteralPath $full) {
      $sha = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
      $lines += ("  {0}  {1}" -f $sha, $t)
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
