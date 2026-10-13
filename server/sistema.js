import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './db.js';

export const CONTEUDO = path.join(RAIZ, 'conteudo');
const ARQ = path.join(CONTEUDO, 'sistema.json');
let cache = null;
let mtime = 0;

// Relê conteudo/sistema.json sempre que o arquivo muda — dá pra editar as regras com o app rodando.
export function sistema() {
  const m = fs.statSync(ARQ).mtimeMs;
  if (!cache || m !== mtime) {
    cache = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
    mtime = m;
  }
  return cache;
}
