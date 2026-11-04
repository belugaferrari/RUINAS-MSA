import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');
const { folegoTurnos } = await import('../shared/regras.js');

const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };

test('asfixia: tabela de CONS do autor e dobra a cada 6 pontos', () => {
  const tabela = { 10: 11, 11: 12, 12: 14, 13: 16, 14: 18, 15: 20, 16: 22 };
  for (const [c, t] of Object.entries(tabela)) assert.equal(folegoTurnos(+c), t, `CONS ${c}`);
  assert.equal(folegoTurnos(17), 24);
  assert.equal(folegoTurnos(22), 44);
  assert.equal(folegoTurnos(28), 88);
  assert.equal(folegoTurnos(9), 10);
  assert.equal(folegoTurnos(4), 5);
});

test('asfixia: prender a respiração conta o fôlego no fim de cada turno', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ps = ['Eu', 'Ele'].map(nome => { const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id; return c.personagens.find(p => p.id === id); });
  ps[0].atributos.CONS = 10; ps[1].atributos.CONS = 10;
  for (const p of ps) executar(c, 'sala.adicionar', { sala: 'batalha', id: p.id }, ctxM);
  if (!c.salas.batalha.combate) executar(c, 'combate.iniciar', {}, ctxM);
  const eu = ps[0];
  executar(c, 'personagem.respirar', { id: eu.id }, ctxM);
  const m = () => eu.marcas.find(x => x.semAr);
  assert.equal(m().folego, 11);
  for (let i = 0; i < 4; i++) executar(c, 'combate.proximo', {}, ctxM);
  assert.equal(m().folego, 9);
  for (let i = 0; i < 30; i++) executar(c, 'combate.proximo', {}, ctxM);
  assert.equal(m().folego, 0);
  assert.equal(m().nome, 'Sem fôlego');
  executar(c, 'personagem.respirar', { id: eu.id }, ctxM);
  assert.equal(m(), undefined);
});
