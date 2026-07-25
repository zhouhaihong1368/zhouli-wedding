@echo off
chcp 65001 >nul
echo ========================================
echo   周礼婚礼管家 - 智能启动
echo   (自动检测隧道地址 + 更新前端)
echo ========================================
echo.

cd /d "C:\Users\周海红\WorkBuddy\Claw"

"C:\Users\周海红\.workbuddy\binaries\node\versions\22.22.2\node.exe" 启动.js

pause
