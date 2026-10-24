$installDir = "$env:LOCALAPPDATA\Programs\Omniverse"
$desktopLnk = "$env:USERPROFILE\Desktop\OMNIVERSE.lnk"
$startLnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\OMNIVERSE.lnk"

if (Test-Path $desktopLnk) { Remove-Item -Force $desktopLnk }
if (Test-Path $startLnk) { Remove-Item -Force $startLnk }
if (Test-Path $installDir) { Remove-Item -Recurse -Force $installDir }

Write-Host "OMNIVERSE has been completely removed from your system." -ForegroundColor Green
