#!/bin/bash
# Duplo clique no Mac para iniciar o app (na primeira vez: botão direito > Abrir).
# A cada abertura confere se há versão nova no GitHub; a pasta "data" (seus dados) nunca é apagada.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não está instalado. Baixe a versão LTS em https://nodejs.org, instale e abra este arquivo de novo."
  open https://nodejs.org
  read -r -p "Enter para sair"
  exit 1
fi

REPO="belugaferrari/RUINAS-MSA"
atualizou=0
echo "Procurando atualizações..."
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  antes=$(git rev-parse HEAD); git pull --ff-only --quiet || true
  [ "$antes" != "$(git rev-parse HEAD)" ] && atualizou=1
elif sha=$(curl -fsS --max-time 20 -H "Accept: application/vnd.github.sha" "https://api.github.com/repos/$REPO/commits/HEAD"); then
  if [ "$sha" != "$(cat versao.txt 2>/dev/null)" ]; then
    echo "Baixando a versão nova..."
    tmp=$(mktemp -d)
    if curl -fsSL --max-time 300 -o "$tmp/app.zip" "https://api.github.com/repos/$REPO/zipball" && unzip -q "$tmp/app.zip" -d "$tmp"; then
      raiz=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -1)
      (cd "$raiz" && tar cf - --exclude=./data --exclude=./node_modules --exclude=./.git .) | tar xf -
      echo "$sha" > versao.txt
      atualizou=1
      echo "Atualizado!"
    else
      echo "Não foi possível atualizar agora. Abrindo a versão que já está no Mac."
    fi
    rm -rf "$tmp"
  else
    echo "O app já está na versão mais nova."
  fi
else
  echo "Sem conexão com o GitHub: abrindo a versão que já está no Mac."
fi

if [ "$atualizou" = 1 ] || [ ! -d node_modules ]; then
  echo "Instalando as dependências..."
  npm install --omit=dev --no-audit --no-fund || exit 1
fi
(sleep 3 && open http://localhost:3000) &
node server/index.js
