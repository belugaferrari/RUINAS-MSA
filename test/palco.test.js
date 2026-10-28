// Palco do combate (autor, 28/10): o ataque registrado leva a arma e o dano bruto; o turno sabe quando começou;
// os testes no Campo de Batalha dizem de quem são.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');

const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };

test('ataque no registro: arma, dano bruto e tipo da arma; turno com a hora em que começou; teste com o personagem', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [a, b] = ['A', 'B'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of [a, b]) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const cb = c.salas.batalha.combate;
  assert.ok(cb.turnoDesde > 0);
  const antes = Date.now();
  const atacante = cb.ordem[cb.vez].id;
  const alvo = atacante === a ? b : a;
  const antes2 = Math.random;
  Math.random = () => 0.99;
  let r;
  try { r = executar(c, 'combate.atacar', { atacante, alvo, opcoes: { armaUid: 'desarmado', surpresa: true } }, ctxM); } finally { Math.random = antes2; }
  assert.equal(r.arma, 'Desarmado');
  assert.equal(r.armaTipo, 'desarmado');
  assert.ok(r.danoBruto >= r.dano);
  executar(c, 'combate.proximo', {}, ctxM);
  assert.ok(c.salas.batalha.combate.turnoDesde >= antes);
  const t = executar(c, 'rolar', { sala: 'batalha', id: a, acaoRef: 'sub:esportes.corrida', nd: 70 }, ctxM);
  assert.equal(t.personagemId, a);
});
