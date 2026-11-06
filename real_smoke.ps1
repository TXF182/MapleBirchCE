# MapleBirchCE real_smoke 包装（单文件夹闭环入口，零搬动）
# 用法：.\real_smoke.ps1
# 作用：调消费端 DoL-Project\real_smoke.ps1（moli 实机冒烟：游戏+SugarCube+ModLoader+mod 数据 4 项启动级断言），透传退出码。
# 消费端默认本机路径；换机/协作者用 $env:MCE_DOL_PROJECT 覆盖即可，无需改脚本。
$ErrorActionPreference = "Stop"
$DOL = if ($env:MCE_DOL_PROJECT) { $env:MCE_DOL_PROJECT } else { "C:\Users\27352\Doubao\chats\2026-10-19\new-chat\DoL-Project" }
$TARGET = Join-Path $DOL "real_smoke.ps1"
if (-not (Test-Path -LiteralPath $TARGET)) { Write-Host "FAIL: 消费端 real_smoke.ps1 缺失 $TARGET" -ForegroundColor Red; exit 1 }
& $TARGET @args
exit $LASTEXITCODE
