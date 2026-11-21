@echo off
rem Запуск моста с видимым окном — удобно, чтобы посмотреть ошибки.
chcp 65001 >nul
cd /d "%~dp0"
node server.js
pause
