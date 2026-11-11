# run-anchor-font-probe.ps1 — A1（锚定条字号跟随主 UI）的等价性断言
#
# 要证的事：
#   把 07a-shell.js 里 .mce-anchor-prompt 的 font-size:14px / 13px
#   改成 calc(14px * var(--dgu-font-scale,1)) / calc(13px * ...) 之后：
#     ① 主 UI 没装、或装了没调字号 → 结果与现状逐位相同（不是"差不多"）
#     ② 玩家调过字号 → 条按同一比例放大，与正文不再一大一小
#
# 为什么必须先证 ①：
#   --dgu-font-scale 由主 UI 无条件写在 documentElement 上（et()?ne:100 → 未启用时写 "1"），
#   所以它可能是"1"、可能是"1.5"、也可能根本不存在（主 UI 没装）。三种情况都必须在
#   没调字号时得到同一个 14px，否则这行 calc 就是一次静默的视觉回归。
#
# 判据（任一不满足即 exit 1）：
#   T0 无变量     → .now=.fix=14px，.now-m=.fix-m=13px，正文 16px
#   T1 变量=1     → 同上
#   T2 变量=1.5   → 正文 24px；.now 仍 14px（现状脱节证据）；.fix=21px，.fix-m=19.5px
#
# Source: 2026-11-11 会话实测；结论落在 docs/ui-panel-alignment.md 第四节 A1。

[CmdletBinding()]
param(
  [string]$MoliPath = 'C:\Users\27352\AppData\Local\moli\moli-v1.1.22-x86_64-pc-windows-msvc\moli.exe',
  [int]$Port = 18741
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path -LiteralPath $MoliPath)) { Write-Host "FAIL: moli.exe 缺失 $MoliPath"; exit 2 }
$html = Join-Path $here 'anchor-font-probe.html'
$evalJs = Join-Path $here 'anchor-font-probe.eval.js'
foreach ($f in @($html, $evalJs)) {
  if (-not (Test-Path -LiteralPath $f)) { Write-Host "FAIL: 缺文件 $f"; exit 2 }
}
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { Write-Host 'FAIL: 找不到 python'; exit 2 }

$prof = Join-Path $env:TEMP 'moli_ce_probe_prof'
$job = Start-Job -ScriptBlock {
  param($d, $p, $exe)
  Set-Location -LiteralPath $d
  & $exe -m http.server $p --bind 127.0.0.1
} -ArgumentList $here, $Port, $py

try {
  Start-Sleep -Seconds 2
  $raw = & $MoliPath fetch --profile-dir $prof --eval-file $evalJs --wait load --timeout 60000 "http://127.0.0.1:$Port/anchor-font-probe.html" 2>&1
  $json = ($raw -join "`n") | ConvertFrom-Json
} finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}

$fails = @()
function Chk([string]$name, [bool]$ok, [string]$detail) {
  if ($ok) { Write-Host "  PASS  $name" } else { Write-Host "  FAIL  $name — $detail"; $script:fails += $name }
}

foreach ($t in @('T0_无变量', 'T1_变量为1')) {
  $s = $json.$t
  Chk "$t 正文=16px"        ($s.passages -eq '16px') "实际 $($s.passages)"
  Chk "$t 现状桌面=14px"     ($s.'.now' -eq '14px')   "实际 $($s.'.now')"
  Chk "$t 现状移动=13px"     ($s.'.now-m' -eq '13px') "实际 $($s.'.now-m')"
  Chk "$t 修复桌面=14px 等价" ($s.'.fix' -eq '14px')   "实际 $($s.'.fix')"
  Chk "$t 修复移动=13px 等价" ($s.'.fix-m' -eq '13px') "实际 $($s.'.fix-m')"
}

$s2 = $json.'T2_变量1p5_正文缩放'
Chk 'T2 正文被缩放到 24px'        ($s2.passages -eq '24px')  "实际 $($s2.passages)"
Chk 'T2 现状桌面仍 14px（脱节）'   ($s2.'.now' -eq '14px')    "实际 $($s2.'.now')"
Chk 'T2 修复桌面=21px（1.5 倍）'   ($s2.'.fix' -eq '21px')    "实际 $($s2.'.fix')"
Chk 'T2 修复移动=19.5px（1.5 倍）' ($s2.'.fix-m' -eq '19.5px') "实际 $($s2.'.fix-m')"

Write-Host ''
if ($fails.Count -gt 0) {
  Write-Host "RESULT: FAIL ($($fails.Count) 项) — $($fails -join ' / ')"
  exit 1
}
Write-Host 'RESULT: PASS（三态 14 条断言全通过：两种无变化状态与现状逐位相同，缩放时按比例跟随）'
Write-Host '注：本探针只判计算字号，不判条的可用高度/换行是否够放放大后的文字。'
