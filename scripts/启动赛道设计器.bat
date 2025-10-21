@echo off
chcp 65001 >nul 2>&1
title ASC 赛道设计器
color 0A

echo.
echo ============================================
echo   ASC 智能车赛道设计器 - 启动中...
echo ============================================
echo.

REM 检查是否存在 trackd.exe
if exist trackd.exe (
    echo [√] 找到 trackd.exe
    start "" trackd.exe --port 8080
    timeout /t 2 /nobreak >nul
    start "" http://localhost:8080
    echo.
    echo [√] 服务已启动！
    echo [√] 浏览器将自动打开 http://localhost:8080
    echo.
    echo 按任意键退出此窗口...
    pause >nul
) else (
    echo [×] 未找到 trackd.exe
    echo.
    echo 请先构建项目：
    echo   1. 进入项目目录
    echo   2. 运行: go build -o trackd.exe cmd/trackd/main.go
    echo.
    pause
)
