$ErrorActionPreference = "Stop"

$installDir = "$env:LOCALAPPDATA\Programs\Omniverse"
$sourceDir = "c:\Users\PRAPTI\Downloads\yt-download"

Write-Host "Installing OMNIVERSE to: $installDir" -ForegroundColor Cyan

# 1. Ensure directory exists
if (-not (Test-Path "$installDir\desktop")) {
    New-Item -ItemType Directory -Force -Path "$installDir\desktop" | Out-Null
}

# 2. Copy core files
Copy-Item "$sourceDir\OMNIVERSE.exe" "$installDir\OMNIVERSE.exe" -Force
Copy-Item "$sourceDir\omniverse.ico" "$installDir\omniverse.ico" -Force
Copy-Item "$sourceDir\desktop\server.js" "$installDir\desktop\server.js" -Force
Copy-Item "$sourceDir\desktop\engine.js" "$installDir\desktop\engine.js" -Force

# 3. Copy web public assets
if (Test-Path "$installDir\desktop\public") {
    Remove-Item -Recurse -Force "$installDir\desktop\public"
}
Copy-Item -Recurse "$sourceDir\desktop\public" "$installDir\desktop\public"

# 4. Remove old desktop leftovers
$oldDesktopExe = "$env:USERPROFILE\Desktop\OMNIVERSE.exe"
if (Test-Path $oldDesktopExe) {
    Remove-Item -Force $oldDesktopExe
}
$oldDesktopLnk = "$env:USERPROFILE\Desktop\OMNIVERSE.lnk"
if (Test-Path $oldDesktopLnk) {
    Remove-Item -Force $oldDesktopLnk
}

# 5. Create Desktop Shortcut with custom icon
$WshShell = New-Object -ComObject WScript.Shell
$desktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\OMNIVERSE.lnk")
$desktopShortcut.TargetPath = "$installDir\OMNIVERSE.exe"
$desktopShortcut.WorkingDirectory = "$installDir"
$desktopShortcut.IconLocation = "$installDir\omniverse.ico, 0"
$desktopShortcut.Description = "OMNIVERSE Video Stream Manifestor"
$desktopShortcut.Save()

# 6. Create Windows Start Menu Entry
$startMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$startShortcut = $WshShell.CreateShortcut("$startMenuDir\OMNIVERSE.lnk")
$startShortcut.TargetPath = "$installDir\OMNIVERSE.exe"
$startShortcut.WorkingDirectory = "$installDir"
$startShortcut.IconLocation = "$installDir\omniverse.ico, 0"
$startShortcut.Description = "OMNIVERSE Video Stream Manifestor"
$startShortcut.Save()

Write-Host "OMNIVERSE installed successfully with custom icon and Start Menu registration!" -ForegroundColor Green
