param(
    [string]$ShortcutName = "Claude 새소식 가져오기",
    [string]$TargetBat    = "run-once.bat",
    [string]$IconResource = "%SystemRoot%\System32\shell32.dll,167",
    [string]$Description  = "Anthropic 새 소식을 한국어로 WAAT에 자동 게시 (1회 실행)"
)
$ProjectDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetPath   = Join-Path $ProjectDir $TargetBat
$Desktop      = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "$ShortcutName.lnk"
if (-not (Test-Path $TargetPath)) {
    Write-Error "Target .bat not found: $TargetPath"; exit 1
}
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = $TargetPath
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.IconLocation     = $IconResource
$Shortcut.Description      = $Description
$Shortcut.Save()
if (Test-Path $ShortcutPath) { Write-Host "OK: $ShortcutPath" } else { Write-Error "Failed"; exit 1 }