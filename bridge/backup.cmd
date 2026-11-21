@echo off
rem Бэкап ключей и копилок моста, сцен и профилей OBS в «Документы\Stream backup».
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
pause
