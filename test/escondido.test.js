// NPC escondido (ghost, autor 01/11): entra no Campo de Batalha e na iniciativa sem os jogadores saberem; o teste para
// achá-lo (Camuflagem ou Furtividade contra a Percepção passiva) é silencioso quando falha.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, visaoPara } = await import('../server/actions.js');

const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'j', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
function campo() {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  c.jogadores.push(ana.id);
  const [lia, bruto, lobo] = ['Lia', 'Bruto', 'Lobo'].map(nome => {
    const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id;
    return c.personagens.find(p => p.id === id);
  });
  Object.assign(lia, { tipo: 'pj', donoId: ana.id });
  executar(c, 'sala.adicionar', { sala: 'batalha', id: lia.id }, ctxM);
  executar(c, 'sala.adicionar', { sala: 'batalha', id: bruto.id }, ctxM);
  executar(c, 'sala.adicionar', { sala: 'batalha', id: lobo.id, escondido: true }, ctxM);
  return { c, lia, bruto, lobo };
}
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}
const textoDoJogador = v => JSON.stringify(v);

test('entra escondido: está na iniciativa, mas a jogadora não vê nem o nome dele', () => {
  const { c, lobo } = campo();
  assert.ok(c.salas.batalha.combate.ordem.some(o => o.id === lobo.id));
  const v = visaoPara(c, ana, 'jogador');
  assert.ok(!v.salas.batalha.participantes.includes(lobo.id));
  assert.ok(!v.salas.batalha.combate.ordem.some(o => o.id === lobo.id));
  assert.ok(!v.personagens.some(p => p.id === lobo.id));
  assert.ok(!textoDoJogador(v).includes('Lobo'), 'nada fala do Lobo (registro, iniciativa…)');
  assert.ok(visaoPara(c, mestre, 'mestre').salas.batalha.participantes.includes(lobo.id));
  const lia = c.personagens.find(p => p.nome === 'Lia');
  executar(c, 'sala.remover', { sala: 'batalha', id: lia.id }, ctxM);
  assert.throws(() => executar(c, 'sala.adicionar', { sala: 'batalha', id: lia.id, escondido: true }, { user: ana, mestre: false }), /Só o mestre/);
});

test('na vez do escondido, a jogadora não vê ninguém agindo', () => {
  const { c, lobo } = campo();
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.findIndex(o => o.id === lobo.id);
  assert.equal(visaoPara(c, ana, 'jogador').salas.batalha.combate.vez, -1);
});

test('teste para achar: falhou → silencioso (só o mestre vê); passou → aparece para todos', () => {
  const { c, lobo } = campo();
  const r = comDados(0.99, () => executar(c, 'esconder.procurar', { id: lobo.id }, ctxM));
  assert.equal(r.achado, false);
  assert.match(r.texto, /Camuflagem|Furtividade/);
  assert.ok(c.salas.batalha.log.some(e => e.secreta && /Escondido — teste/.test(e.rotulo)));
  assert.ok(!textoDoJogador(visaoPara(c, ana, 'jogador')).includes('Lobo'));
  const r2 = comDados(0.06, () => executar(c, 'esconder.procurar', { id: lobo.id }, ctxM));
  assert.equal(r2.achado, true);
  assert.equal(r2.por, 'Lia');
  const v = visaoPara(c, ana, 'jogador');
  assert.ok(v.salas.batalha.participantes.includes(lobo.id));
  assert.ok(v.salas.batalha.log.some(e => /Lia encontrou Lobo/.test(e.texto)));
});

test('a cada rodada o app testa sozinho; atacar do esconderijo é surpresa e revela', () => {
  const { c, bruto, lobo } = campo();
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.length - 1;
  comDados(0.99, () => executar(c, 'combate.proximo', {}, ctxM));
  assert.ok(c.salas.batalha.log.some(e => e.secreta && /Escondido — teste/.test(e.rotulo)), 'testou na virada da rodada');
  assert.ok(lobo.escondido);
  cb.vez = cb.ordem.findIndex(o => o.id === lobo.id);
  comDados(0.5, () => executar(c, 'combate.atacar', { atacante: lobo.id, alvo: bruto.id, opcoes: {} }, ctxM));
  assert.ok(!lobo.escondido);
  assert.ok(c.salas.batalha.log.some(e => /sai do esconderijo/.test(e.texto || '')));
});

test('esconder e revelar pelo mestre', () => {
  const { c, bruto } = campo();
  executar(c, 'personagem.esconder', { id: bruto.id, escondido: true }, ctxM);
  assert.ok(!visaoPara(c, ana, 'jogador').salas.batalha.participantes.includes(bruto.id));
  executar(c, 'personagem.esconder', { id: bruto.id, escondido: false }, ctxM);
  assert.ok(visaoPara(c, ana, 'jogador').salas.batalha.participantes.includes(bruto.id));
});

test('sem pistas: o contador de turnos não conta a vez do escondido; com 1 PJ e o escondido, o combate não começa sozinho', () => {
  const { c, lobo } = campo();
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.length - 1;
  const v = visaoPara(c, ana, 'jogador').salas.batalha.combate;
  assert.equal(v.turno, 2, 'só as 2 vezes visíveis');
  const c2 = novaCampanha(mestre, { nome: 'T2', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [a, b] = ['Lia', 'Lobo'].map(nome => executar(c2, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  c2.personagens.find(p => p.id === a).tipo = 'pj';
  executar(c2, 'sala.adicionar', { sala: 'batalha', id: a }, ctxM);
  executar(c2, 'sala.adicionar', { sala: 'batalha', id: b, escondido: true }, ctxM);
  assert.ok(!c2.salas.batalha.combate);
  assert.ok(lobo);
});
