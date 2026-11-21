@echo off
rem Убирает мост из автозагрузки (сам мост и данные не трогает).
chcp 65001 >nul
powershell -NoProfile -Command "Remove-Item -LiteralPath ([Environment]::GetFolderPath('Startup')+'\Pain Bridge.lnk') -ErrorAction SilentlyContinue"
echo Убрано из автозагрузки. Чтобы остановить уже запущенный мост — перезагрузи ПК или заверши node.exe в диспетчере задач.
pause
