@echo off
title Vida Moderna News - Servidor de Midia Indoor e Sincronizacao Automatica Wi-Fi
echo Iniciando o sistema Vida Moderna News na porta 8080...
start "" "http://localhost:8080/admin.html"
start "" "http://localhost:8080/index.html"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080
pause
