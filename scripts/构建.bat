@echo off
chcp 65001 >nul 2>&1
title 构建 ASC 赛道设计器
color 0B

echo.
echo ============================================
echo   ASC 赛道设计器 - 完整构建流程
echo ============================================
echo.

REM 1. 构建前端
echo [1/3] 构建前端...
cd web
if not exist node_modules (
    echo   [*] 安装前端依赖...
    call npm install
    if errorlevel 1 (
        echo   [×] 前端依赖安装失败
        pause
        exit /b 1
    )
)

echo   [*] 编译前端资源...
call npm run build
if errorlevel 1 (
    echo   [×] 前端构建失败
    pause
    exit /b 1
)
echo   [√] 前端构建完成
cd ..

REM 2. 构建后端
echo.
echo [2/3] 构建后端...
echo   [*] 编译 Go 程序...
go build -ldflags="-s -w" -o trackd.exe cmd/trackd/main.go
if errorlevel 1 (
    echo   [×] 后端构建失败
    pause
    exit /b 1
)
echo   [√] 后端构建完成

REM 3. 完成
echo.
echo [3/3] 构建完成！
echo.
echo ============================================
echo   生成的文件:
echo   - trackd.exe (单文件服务器)
echo.
echo   使用方法:
echo   1. 双击 scripts\启动赛道设计器.bat
echo   2. 或运行: trackd.exe --port 8080
echo ============================================
echo.
pause
