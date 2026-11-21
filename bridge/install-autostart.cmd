@echo off
rem Добавляет мост в автозагрузку Windows и сразу запускает его.
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Pain Bridge.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='\"%~dp0start-hidden.vbs\"'; $s.WorkingDirectory='%~dp0'; $s.Save()"
wscript.exe "%~dp0start-hidden.vbs"
echo Готово: мост в автозагрузке и уже запущен. Пульт: http://localhost:3777/admin
pause
