# Atualiza o app a partir do GitHub antes de abrir (chamado pelo iniciar.ps1).
# Baixa so quando ha versao nova. Nunca mexe na pasta "data" (contas, campanhas, fichas, imagens).
# Saida: 10 = atualizou (o .bat reinstala as dependencias); 0 = nada a fazer ou sem internet.
$ErrorActionPreference = 'Stop'
$pasta = $PSScriptRoot
$repo = 'belugaferrari/RUINAS-MSA'
$cab = @{ 'User-Agent' = 'ilhas-das-ruinas' }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Copia instalada com o Git: basta puxar as novidades.
if ((Test-Path (Join-Path $pasta '.git')) -and (Get-Command git -ErrorAction SilentlyContinue)) {
  try {
    $ErrorActionPreference = 'Continue'
    $antes = git -C $pasta rev-parse HEAD
    git -C $pasta pull --ff-only --quiet
    $depois = git -C $pasta rev-parse HEAD
    if ($antes -ne $depois) { Write-Host ' Atualizado!'; exit 10 }
    Write-Host ' O app ja esta na versao mais nova.'
  } catch {
    Write-Host ' Nao foi possivel atualizar pelo Git agora. Abrindo a versao que ja esta no PC.'
  }
  exit 0
}

try {
  $sha = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/commits/HEAD" -Headers ($cab + @{ Accept = 'application/vnd.github.sha' }) -TimeoutSec 20
  $sha = "$sha".Trim()
} catch {
  Write-Host ' Sem conexao com o GitHub: abrindo a versao que ja esta no PC.'
  exit 0
}
$arqVersao = Join-Path $pasta 'versao.txt'
$atual = if (Test-Path $arqVersao) { (Get-Content $arqVersao -Raw).Trim() } else { '' }
if ($atual -eq $sha) { Write-Host ' O app ja esta na versao mais nova.'; exit 0 }

try {
  Write-Host ' Baixando a versao nova...'
  $tmp = Join-Path $env:TEMP "ilhas-atualizacao"
  $zip = "$tmp.zip"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Invoke-WebRequest -Uri "https://api.github.com/repos/$repo/zipball" -Headers $cab -OutFile $zip -UseBasicParsing -TimeoutSec 300
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $raiz = Get-ChildItem $tmp -Directory | Select-Object -First 1
  # Copia por cima, sem tocar em data, node_modules e no .bat (que esta rodando agora e nao muda).
  robocopy $raiz.FullName $pasta /E /XD data node_modules .git /XF iniciar-windows.bat /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy falhou ($LASTEXITCODE)" }
  Set-Content -Path $arqVersao -Value $sha
  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host ' Atualizado!'
  exit 10
} catch {
  Write-Host " Nao foi possivel atualizar agora ($($_.Exception.Message)). Abrindo a versao que ja esta no PC."
  exit 0
}
