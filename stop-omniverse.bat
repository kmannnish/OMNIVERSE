@echo off
title Stopping OMNIVERSE...
color 0C

echo.
echo  ========================================================================
echo    ✦ Shutting Down OMNIVERSE Containers ✦
echo  ========================================================================
echo.

cd /d "%~dp0"
docker compose down

echo.
echo [OK] All OMNIVERSE containers have been stopped cleanly.
timeout /t 3 >nul
