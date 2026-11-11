# run-ce-align-probe.ps1 — CE 面板 / DoL-Game-UI 4.2 的 CSS 级联离线断言
#
# 为什么需要它：
#   面板按钮被主 UI 撑高，是「谁的选择器赢」这件事，靠读 CSS 猜不准——
#   实际算错过两次：① 以为 .mce-btn 有 min-height:22px（实为零）；
#   ② 以为 #mce-root button (1,0,1) 能赢 :is(button) (0,0,1)，实际主 UI 是 (1,3,2)。
#   所以这里用真 Chromium（moli）跑最小 HTML，四组对照，把结论钉死。
#
# 它不做的事：不装 mod、不碰游戏目录、不碰 IndexedDB。只起一个临时 http server
#             服务 docs/probes 下的静态 HTML，跑完即撤。
#
# 用法：
#   .\run-ce-align-probe.ps1                       # 默认 moli 路径
#   .\run-ce-align-probe.ps1 -MoliPath <exe>       # 换 moli
#
# 判据（任一不满足即 exit 1）：
#   A. 不挂属性时，r0..r4 全部 padding=3px 9px、min-height=0px           （基线未被污染）
#   B. 挂属性+scale1.5 且无反制时，r0 padding=9.75/14.625、min-height=66px（污染确实存在）
#   C. 同状态下 r1(1,0,1) 与 r3(1,1,0) 的 padding 仍被覆盖                （证明低特异性无效）
#   D. 同状态下 r2(2,0,1) padding=3px 9px                                （证明双 ID 有效）
#
# Source: 2026-11-11 会话实测；结论落在 docs/ui-panel-alignment.md 第三节 / 第八节。

[CmdletBinding()]
param(
  [string]$MoliPath = 'C:\Users\27352\AppData\Local\moli\moli-v1.1.22-x86_64-pc-windows-msvc\moli.exe',
  [int]$Port = 18740
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path -LiteralPath $MoliPath)) { Write-Host "FAIL: moli.exe 缺失 $MoliPath"; exit 2 }
$html = Join-Path $here 'ce-align-probe.html'
$evalJs = Join-Path $here 'ce-align-probe.eval.js'
foreach ($f in @($html, $evalJs)) {
  if (-not (Test-Path -LiteralPath $f)) { Write-Host "FAIL: 缺文件 $f"; exit 2 }
}

# 找一个能用的 python（本机 python3/py 不存在，只有 python）
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
  $raw = & $MoliPath fetch --profile-dir $prof --eval-file $evalJs --wait load --timeout 60000 "http://127.0.0.1:$Port/ce-align-probe.html" 2>&1
  $json = ($raw -join "`n") | ConvertFrom-Json
} finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}

$fails = @()
function Chk([string]$name, [bool]$ok, [string]$detail) {
  if ($ok) { Write-Host "  PASS  $name" } else { Write-Host "  FAIL  $name — $detail"; $script:fails += $name }
}

Write-Host '== A 基线：属性不挂 =='
foreach ($k in @('r0', 'r1', 'r2', 'r3', 'r4')) {
  $s = $json.noAttr.$k
  Chk "noAttr $k padding=3px 9px" ($s.padding -eq '3px 9px') "实际 $($s.padding)"
  Chk "noAttr $k minHeight=0px"   ($s.minHeight -eq '0px')   "实际 $($s.minHeight)"
}

Write-Host '== B 污染：属性挂 + scale 1.5，无反制 (r0) =='
$r0 = $json.attr150.r0
Chk 'attr150 r0 padding 被改写'   ($r0.padding -eq '9.75px 14.625px') "实际 $($r0.padding)"
Chk 'attr150 r0 minHeight=66px'   ($r0.minHeight -eq '66px')          "实际 $($r0.minHeight)"

Write-Host '== C 低特异性反制无效 (r1 (1,0,1) / r3 (1,1,0)) =='
foreach ($k in @('r1', 'r3')) {
  $s = $json.attr150.$k
  Chk "attr150 $k padding 仍被覆盖" ($s.padding -eq '9.75px 14.625px') "实际 $($s.padding)"
  Chk "attr150 $k minHeight 已夺回" ($s.minHeight -eq '0px')            "实际 $($s.minHeight)"
}

Write-Host '== D 双 ID 反制有效 (r2 (2,0,1)) =='
$r2 = $json.attr150.r2
Chk 'attr150 r2 padding=3px 9px' ($r2.padding -eq '3px 9px') "实际 $($r2.padding)"
Chk 'attr150 r2 minHeight=0px'   ($r2.minHeight -eq '0px')   "实际 $($r2.minHeight)"

Write-Host ''
if ($fails.Count -gt 0) {
  Write-Host "RESULT: FAIL ($($fails.Count) 项) — $($fails -join ' / ')"
  exit 1
}
Write-Host 'RESULT: PASS（4 组 18 条断言全通过）'
Write-Host '注：本探针只判 CSS 级联与计算值，不判布局溢出 / 滚动条 / 触控命中。'
