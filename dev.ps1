# MapleBirchCE 一键开发工作流（单文件夹闭环入口，零搬动）
# 用法：.\dev.ps1
# 作用：跑全链验证（单元/unit → build/syntax/smoke/regression/E2E/gender）→ 打包 .mod.zip → 自动装进消费端 game 目录 → 输出 SHA。
# 本脚本替代 DoL-Project\dev.ps1 作为仓库侧等价入口；消费端物理位置不变。
# 游戏内 ModLoader 刷新页面即可加载新版本（mod zip 直接放游戏根目录，ModLoader 旁加载扫描）。
$ErrorActionPreference = "Stop"

$MCE = $PSScriptRoot
# 消费端（游戏+实机脚本）默认本机路径；换机/协作者用 $env:MCE_DOL_PROJECT 覆盖即可，无需改脚本
$DOL = if ($env:MCE_DOL_PROJECT) { $env:MCE_DOL_PROJECT } else { "C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project" }
$GAME = Join-Path $DOL "game"
$UNIT_TEST = Join-Path $DOL "tools\unit-write-test.js"
if (-not (Test-Path -LiteralPath $MCE)) { Write-Host "FAIL: 开发仓库不存在 $MCE" -ForegroundColor Red; exit 1 }
if (-not (Test-Path -LiteralPath "$GAME\Degrees of Lewdity.html")) { Write-Host "FAIL: 游戏本体不存在 $GAME" -ForegroundColor Red; exit 1 }

Write-Host "[1/3] MapleBirchCE 写入逻辑单元测试（node，秒级）" -ForegroundColor Cyan
if (Test-Path -LiteralPath $UNIT_TEST) {
  node $UNIT_TEST
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: unit-write-test.js" -ForegroundColor Red; exit 1 }
} else {
  Write-Host "WARN: unit-write-test.js 缺失，跳过" -ForegroundColor Yellow
}

Write-Host "[2/3] MapleBirchCE 全链验证 + 打包（内含 verifier 4/4 + SHA256）" -ForegroundColor Cyan
Push-Location $MCE
try {
  & (Join-Path $MCE "tools\pack.ps1")
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: pack.ps1" -ForegroundColor Red; exit 1 }
} finally { Pop-Location }

$zip = Join-Path $MCE "MapleBirchCE.mod.zip"
if (-not (Test-Path -LiteralPath $zip)) { Write-Host "FAIL: 打包产物缺失 $zip" -ForegroundColor Red; exit 1 }

Write-Host "[3/3] 装进游戏目录 game\" -ForegroundColor Cyan
Copy-Item -LiteralPath $zip -Destination "$GAME\MapleBirchCE.mod.zip" -Force
$size = (Get-Item -LiteralPath "$GAME\MapleBirchCE.mod.zip").Length
$sha = (Get-FileHash -LiteralPath "$GAME\MapleBirchCE.mod.zip" -Algorithm SHA256).Hash
Write-Host "已装进: $GAME\MapleBirchCE.mod.zip ($size B, SHA256=$sha)" -ForegroundColor Green
Write-Host "完成。游戏内 ModLoader → 刷新页面 → 右下角金色 CE 按钮即新版本。" -ForegroundColor Green
