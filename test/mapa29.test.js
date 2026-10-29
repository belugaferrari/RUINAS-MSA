// Mapa (autor, 29/10): o jogador move o próprio personagem na vez dele no Campo de Batalha; o app guarda onde o turno começou.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');

const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };

test('jogador move o próprio peão só na vez dele; o início do turno fica guardado', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [a, b] = ['Lia', 'Rato'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const lia = c.personagens.find(p => p.id === a);
  lia.donoId = ana.id;
  c.imagens.push({ id: 'i1', titulo: 'Ilha', url: '/uploads/a.png', tipo: 'imagem' });
  executar(c, 'mapa.definir', { imagemId: 'i1' }, ctxM);
  executar(c, 'mapa.mover', { id: a, col: 2, lin: 2 }, ctxM);
  executar(c, 'mapa.mover', { id: b, col: 8, lin: 8 }, ctxM);
  // Sem combate: não mexe.
  assert.throws(() => executar(c, 'mapa.mover', { id: a, col: 3, lin: 2 }, ctxA), /Só na vez/);
  for (const id of [a, b]) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const cb = c.salas.batalha.combate;
  // Vez do Rato: Ana não move a Lia nem o Rato.
  cb.vez = cb.ordem.findIndex(o => o.id === b);
  assert.throws(() => executar(c, 'mapa.mover', { id: a, col: 3, lin: 2 }, ctxA), /Só na vez/);
  assert.throws(() => executar(c, 'mapa.mover', { id: b, col: 7, lin: 8 }, ctxA), /seu personagem/);
  // Passa para a Lia: o início do turno é onde ela está; Ana move livremente.
  executar(c, 'combate.proximo', {}, ctxM);
  if (cb.ordem[cb.vez].id !== a) executar(c, 'combate.proximo', {}, ctxM);
  assert.deepEqual(cb.inicioTurno, { id: a, col: 2, lin: 2 });
  executar(c, 'mapa.mover', { id: a, col: 5, lin: 3 }, ctxA);
  executar(c, 'mapa.mover', { id: a, col: 6, lin: 4 }, ctxA);
  assert.deepEqual([c.mapa.pecas[a].col, c.mapa.pecas[a].lin], [6, 4]);
  assert.deepEqual(cb.inicioTurno, { id: a, col: 2, lin: 2 });
});
