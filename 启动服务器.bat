@echo off
chcp 65001 >nul
echo ========================================
echo   周礼婚礼管家 - 数据服务器启动
echo ========================================
echo.

cd /d "C:\Users\周海红\WorkBuddy\Claw"

echo [1/2] 启动数据服务器 (端口 3000)...
start "周礼婚礼管家-API" /B "C:\Users\周海红\.workbuddy\binaries\node\versions\22.22.2\node.exe" server.js
timeout /t 2 /nobreak >nul

echo [2/2] 启动外网隧道...
start "周礼婚礼管家-隧道" /B cmd /c "C:\Users\周海红\.workbuddy\binaries\node\versions\22.22.2\npx.cmd --yes localtunnel --port 3000"
timeout /t 8 /nobreak >nul

echo.
echo ========================================
echo   启动完成！
echo   分享链接: https://5e818174a720463e825ea3d39e812b2f.app.codebuddy.work
echo   注意: 隧道地址每次重启会变化
echo   如需查看当前隧道地址，请查看控制台输出
echo ========================================
echo.
echo 请勿关闭此窗口，保持服务器运行。
echo 客户提交数据后，刷新管家后台即可看到。
echo.
pause
