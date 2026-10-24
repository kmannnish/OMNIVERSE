@echo off
setlocal
title Creating Desktop Shortcut...
color 0A

set "TARGET_DIR=%~dp0.."
pushd "%TARGET_DIR%"
set "PROJECT_ROOT=%CD%"
popd

set "TARGET_BAT=%PROJECT_ROOT%\start-omniverse.bat"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\OMNIVERSE.lnk"

echo [*] Creating Desktop Shortcut for OMNIVERSE...

powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
    "$s.TargetPath = '%TARGET_BAT%'; " ^
    "$s.WorkingDirectory = '%PROJECT_ROOT%'; " ^
    "$s.Description = 'OMNIVERSE - Boundless Streams within One Luminous Core'; " ^
    "$s.IconLocation = 'shell32.dll,14'; " ^
    "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo  ========================================================================
    echo   [OK] Desktop Shortcut successfully created!
    echo   Location: %SHORTCUT_PATH%
    echo   You can now double-click "OMNIVERSE" on your Desktop anytime to launch!
    echo  ========================================================================
) else (
    echo [!] Could not create shortcut on Desktop.
)

timeout /t 4 >nul
