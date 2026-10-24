@echo off
title Uninstall OMNIVERSE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\uninstall.ps1"
pause
