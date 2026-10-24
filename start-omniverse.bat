@echo off
setlocal EnableDelayedExpansion
title OMNIVERSE - Luminous Media Conduit
color 0E

echo.
echo  ========================================================================
echo    ✦ OMNIVERSE  -  Luminous Media Conduit (Boundless Streams) ✦
echo  ========================================================================
echo.

cd /d "%~dp0"

:: 1. Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Docker is not installed or not in PATH!
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

:: 2. Check if Docker Daemon is running
echo [*] Checking Docker daemon status...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] Docker engine is not currently running.
    echo [*] Starting Docker Desktop in the background...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo [!] Please start Docker Desktop manually.
    )

    echo [*] Waiting for Docker daemon to become ready (this may take 20-30 seconds)...
    :WAIT_DOCKER
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo     ...still waiting for Docker daemon...
        goto WAIT_DOCKER
    )
    echo [OK] Docker daemon is active!
)

:: 3. Launch Docker Compose Stack
echo.
echo [*] Launching OMNIVERSE distributed media containers...
docker compose up -d

if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Failed to start Docker Compose containers.
    pause
    exit /b 1
)

:: 4. Healthcheck: Wait for Frontend (Port 3000) to respond
echo.
echo [*] Waiting for OMNIVERSE interface to ignite on http://localhost:3000...
:WAIT_WEB
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    timeout /t 2 /nobreak >nul
    goto WAIT_WEB
)

:: 5. Detect Local Wi-Fi / LAN IP Address
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Docker' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"`) do (
    set "LAN_IP=%%i"
)

:: 6. Detect Tailscale Status and IP
set "TAILSCALE_STATUS=Inactive"
set "TAILSCALE_IP="
where tailscale >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "(tailscale ip -4 2>$null)"`) do (
        set "TAILSCALE_IP=%%i"
        set "TAILSCALE_STATUS=Active"
    )
)

:: 7. Open Default Web Browser
echo [OK] OMNIVERSE is live! Opening browser...
start http://localhost:3000

:: 8. Display Access Dashboard
cls
color 0B
echo.
echo  ========================================================================
echo    ✦ OMNIVERSE  -  LUMINOUS MEDIA CONDUIT IS ACTIVE ✦
echo  ========================================================================
echo.
echo   [PC Browser]          http://localhost:3000
if defined LAN_IP (
echo   [Same Wi-Fi / LAN]    http://!LAN_IP!:3000
)
if defined TAILSCALE_IP (
echo   [Tailscale Network]   http://!TAILSCALE_IP!:3000
) else (
echo   [Tailscale Network]   Run "tailscale up" to enable secure remote access
)
echo.
echo  ------------------------------------------------------------------------
echo   * Phone / iPad / Laptop Access (Same Wi-Fi):
if defined LAN_IP (
echo     Open http://!LAN_IP!:3000 on your phone browser.
) else (
echo     Open http://^<YOUR-PC-IP^>:3000 on your phone browser.
)
echo.
echo   * Global Internet Access (Tailscale Funnel):
echo     Run "scripts\enable-tailscale-funnel.bat" to get a public HTTPS link!
echo.
echo   * To Stop All Containers:
echo     Run "stop-omniverse.bat" or press Ctrl+C.
echo  ========================================================================
echo.
echo   (Press any key to close this terminal; OMNIVERSE will keep running in background)
pause >nul
