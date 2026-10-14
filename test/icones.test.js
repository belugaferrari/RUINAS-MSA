import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ICONES } from '../public/js/icones.js';

const raiz = new URL('..', import.meta.url).pathname;

function arquivosJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? arquivosJs(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('todo ícone da lista existe no pacote Lucide', () => {
  for (const nome of ICONES) assert.ok(fs.existsSync(path.join(raiz, 'node_modules/lucide-static/icons', `${nome}.svg`)), nome);
});

test('todo ícone usado no código está na lista', () => {
  const usados = new Set();
  for (const arq of arquivosJs(path.join(raiz, 'public/js'))) {
    const src = fs.readFileSync(arq, 'utf8');
    for (const m of src.matchAll(/(?:icone\(|icone: |titulo\([^,]+, )'([a-z0-9-]+)'/g)) usados.add(m[1]);
    for (const m of src.matchAll(/\[\s*'[a-z]+',\s*'[A-ZÁ-Ú][^']*',\s*'([a-z0-9-]+)'\s*\]/g)) usados.add(m[1]);
  }
  assert.ok(usados.size > 40);
  for (const nome of usados) assert.ok(ICONES.includes(nome), `ícone "${nome}" fora de public/js/icones.js`);
});
