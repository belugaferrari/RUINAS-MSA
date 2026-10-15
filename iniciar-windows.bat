@echo off
rem Abre o Ilhas das Ruinas. Este arquivo nao muda: a cada abertura o app se atualiza sozinho pelo GitHub
rem (iniciar.ps1 e atualizar.ps1). Seus dados ficam na pasta "data" e nunca sao apagados.
title Ilhas das Ruinas
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1"
pause
