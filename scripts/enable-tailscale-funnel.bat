@echo off
setlocal
title OMNIVERSE - Tailscale Remote Access & Funnel
color 0B

echo.
echo  ========================================================================
echo    ✦ OMNIVERSE  -  Tailscale Remote & Funnel Access Configuration ✦
echo  ========================================================================
echo.

where tailscale >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Tailscale CLI is not found in PATH!
    echo Please install Tailscale from: https://tailscale.com/download
    echo.
    pause
    exit /b 1
)

echo [*] Checking Tailscale status...
tailscale status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] Tailscale is not currently logged in or connected.
    echo [*] Starting Tailscale login...
    tailscale up
)

echo.
echo  Please choose your remote access mode:
echo.
echo   [1] Private Tailnet Only (Accessible only by your logged-in phone/laptop/devices)
echo       Command: tailscale serve --bg 3000
echo.
echo   [2] Public Internet Funnel (Accessible by ANYONE worldwide with a public HTTPS link)
echo       Command: tailscale funnel --bg 3000
echo.
echo   [3] Check Current Remote Status
echo       Command: tailscale funnel status
echo.
echo   [4] Turn Off / Reset Tailscale Funnel and Serve
echo       Command: tailscale funnel reset
echo.
set /p "CHOICE=Enter option (1, 2, 3, or 4): "

if "%CHOICE%"=="1" (
    echo.
    echo [*] Enabling private Tailnet serve on port 3000...
    tailscale serve --bg 3000
    echo.
    tailscale serve status
    echo.
    echo [OK] Private Tailnet serve enabled!
) else if "%CHOICE%"=="2" (
    echo.
    echo [*] Enabling Public Internet Funnel on port 3000...
    tailscale funnel --bg 3000
    echo.
    tailscale funnel status
    echo.
    echo [OK] Public Funnel enabled! Share your HTTPS URL with any device.
) else if "%CHOICE%"=="3" (
    echo.
    echo [*] Current Tailscale Funnel / Serve Status:
    tailscale funnel status
) else if "%CHOICE%"=="4" (
    echo.
    echo [*] Resetting and disabling Funnel / Serve...
    tailscale funnel reset
    tailscale serve reset
    echo [OK] Remote access disabled.
) else (
    echo [!] Invalid selection.
)

echo.
echo Press any key to exit.
pause >nul
