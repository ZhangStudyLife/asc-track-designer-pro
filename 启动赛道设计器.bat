@echo off
chcp 65001 >nul 2>&1
cls

echo ═══════════════════════════════════════════════════════════
echo       🏁 ASC 智能车赛道设计器 - Windows 版本
echo ═══════════════════════════════════════════════════════════
echo.
echo [INFO] 正在启动服务器...
echo.

REM 启动服务器（在后台运行）
start "ASC赛道设计器服务" /MIN trackd.exe --port 8080

REM 等待服务器启动
timeout /t 2 /nobreak >nul

echo [SUCCESS] 服务器已启动在端口 8080
echo [INFO] 正在打开浏览器...
echo.

REM 打开浏览器
start "" http://localhost:8080

echo ═══════════════════════════════════════════════════════════
echo   🌐 浏览器已打开: http://localhost:8080
echo
echo   📖 使用说明:
echo      - 点击左侧按钮添加赛道元件
echo      - 拖拽元件进行布局
echo      - Tab 键旋转选中元件 15°
echo      - Delete 键删除选中元件
echo      - Ctrl+Z/Y 撤销/重做
echo      - Ctrl+C/V 复制/粘贴
echo.
echo   ⚠️  关闭此窗口将停止服务器
echo ═══════════════════════════════════════════════════════════
echo.
echo 按任意键关闭服务器...
pause >nul

REM 关闭服务器
taskkill /FI "WINDOWTITLE eq ASC赛道设计器服务*" /T /F >nul 2>&1

echo.
echo [INFO] 服务器已关闭。感谢使用 ASC 赛道设计器！
timeout /t 2 /nobreak >nul
