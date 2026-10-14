#!/bin/bash
# Duplo clique no Mac para iniciar o app (na primeira vez: botão direito > Abrir).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não está instalado. Baixe a versão LTS em https://nodejs.org, instale e abra este arquivo de novo."
  open https://nodejs.org
  read -r -p "Enter para sair"
  exit 1
fi
[ -d node_modules ] || { echo "Primeira vez: instalando as dependências..."; npm install --omit=dev || exit 1; }
(sleep 3 && open http://localhost:3000) &
node server/index.js
