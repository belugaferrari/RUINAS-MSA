# Inicia o app no Windows: confere o Node.js, atualiza pelo GitHub, instala dependencias e abre o navegador.
# Chamado pelo iniciar-windows.bat (que fica sempre igual; toda a logica mora aqui e se atualiza sozinha).
$pasta = $PSScriptRoot
Set-Location $pasta
$Host.UI.RawUI.WindowTitle = 'Ilhas das Ruinas'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host ' O Node.js nao esta instalado.'
  Write-Host ' Baixe a versao LTS em https://nodejs.org , instale e abra o iniciar-windows.bat de novo.'
  Start-Process 'https://nodejs.org'
  exit 1
}

Write-Host ' Procurando atualizacoes...'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $pasta 'atualizar.ps1')
$atualizou = $LASTEXITCODE -eq 10

if ($atualizou -or -not (Test-Path (Join-Path $pasta 'node_modules'))) {
  Write-Host ' Instalando as dependencias, aguarde 1 a 2 minutos...'
  & npm.cmd install --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Host ' Nao foi possivel instalar. Confira a internet e tente de novo.'; exit 1 }
}

Write-Host ''
Write-Host ' Abrindo o navegador... Para desligar o app, feche esta janela.'
Start-Process cmd.exe -ArgumentList '/c timeout /t 3 >nul & start http://localhost:3000' -WindowStyle Hidden
& node server/index.js
