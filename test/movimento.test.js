// Custo do movimento no mapa (livro, Movimentação): caído 4,5 m por quadrado; terreno acidentado em dobro; atravessar aliado +1,5 m.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');
const V = await import('../shared/visao.js');

const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };

test('custo do trecho: normal, caído, mato (natural) e mesa; atravessar aliado', () => {
  const mapa = { objetos: [{ tipo: 'arbusto', col: 2, lin: 0 }, { tipo: 'mesa', col: 4, lin: 0, l: 1, a: 1 }] };
  assert.equal(V.custoDoTrecho({}, { col: 0, lin: 0 }, { col: 3, lin: 3 }), 4.5, 'diagonal conta 1 quadrado');
  assert.equal(V.custoDoTrecho({}, { col: 0, lin: 0 }, { col: 2, lin: 0 }, { caido: true }), 9);
  assert.equal(V.custoDoTrecho(mapa, { col: 0, lin: 0 }, { col: 5, lin: 0 }), 1.5 * 5 + 1.5 + 1.5);
  assert.equal(V.custoDoTrecho(mapa, { col: 0, lin: 0 }, { col: 5, lin: 0 }, { ignoraNatural: true }), 1.5 * 5 + 1.5, 'Explorador dos Ermos: mato não pesa; mesa sim');
  assert.equal(V.custoDoTrecho({}, { col: 0, lin: 0 }, { col: 3, lin: 0 }, { aliados: new Set(['1:0']) }), 6);
});

test('contador do turno soma o caminho feito (caído)', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [a, b] = ['Eu', 'Ele'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  c.mapa.imagemId = null;
  c.mapa.pecas = { [a]: { col: 0, lin: 0 }, [b]: { col: 10, lin: 10 } };
  for (const id of [a, b]) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.findIndex(o => o.id === a);
  c.personagens.find(p => p.id === a).marcadores = ['Caído'];
  executar(c, 'mapa.mover', { id: a, col: 1, lin: 0 }, ctxM);
  executar(c, 'mapa.mover', { id: a, col: 2, lin: 1 }, ctxM);
  assert.deepEqual(cb.andado, { id: a, metros: 9 });
});
