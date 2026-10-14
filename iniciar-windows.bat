@echo off
chcp 65001 >nul
title Ilhas das Ruinas
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Baixe a versao LTS em https://nodejs.org , instale e abra este arquivo de novo.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Primeira vez: instalando as dependencias, aguarde 1 a 2 minutos...
  call npm install --omit=dev
  if errorlevel 1 (
    echo  Nao foi possivel instalar. Confira a internet e tente de novo.
    pause
    exit /b 1
  )
)

echo  Abrindo o navegador... Para desligar o app, feche esta janela.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server/index.js
pause
