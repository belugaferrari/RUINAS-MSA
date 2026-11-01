// Botões de ataque: trocar o item de uma mão (o que estava sai; item de duas mãos esvazia as duas).
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

test('trocar o item da mão: o antigo é guardado; o de duas mãos esvazia as duas; da outra mão, muda de mão', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Eu' } }, ctxM).id;
  const p = c.personagens.find(x => x.id === id);
  const arma = (uid, ocupa = 1) => ({ uid, nome: uid, tipo: 'arma', slot: 'maos', dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo', ocupa });
  p.itens = [{ ...arma('faca'), equipado: true, mao: 0 }, { ...arma('adaga'), equipado: true, mao: 1 }, arma('espada'), arma('lanca', 2)];
  executar(c, 'item.equipar', { id, uid: 'espada', equipar: true, mao: 0, sai: 'faca' }, ctxM);
  const por = u => p.itens.find(i => i.uid === u);
  assert.deepEqual([por('espada').equipado, por('espada').mao, por('faca').equipado, por('adaga').mao], [true, 0, false, 1]);
  executar(c, 'item.equipar', { id, uid: 'adaga', equipar: true, mao: 0, sai: 'espada' }, ctxM);
  assert.deepEqual([por('adaga').mao, por('espada').equipado], [0, false]);
  executar(c, 'item.equipar', { id, uid: 'lanca', equipar: true, mao: 1, sai: null }, ctxM);
  assert.deepEqual(p.itens.filter(i => i.equipado).map(i => i.uid), ['lanca']);
});

const R = await import('../shared/regras.js');
const { sistema } = await import('../server/sistema.js');
const C = await import('../shared/combate.js');
function campo2() {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [a, b] = ['Eu', 'Ele'].map(nome => { const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id; return c.personagens.find(p => p.id === id); });
  for (const p of [a, b]) executar(c, 'sala.adicionar', { sala: 'batalha', id: p.id }, ctxM);
  const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === a.id);
  return { c, a, b };
}

test('munição: o tiro gasta as balas da cadência da caixa do tipo da arma; sem balas não atira; munição especial soma o dano', () => {
  const { c, a, b } = campo2();
  a.itens = [{ uid: 'r', nome: 'Rifle', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d6', pericia: 'armas-de-fogo.rifle-de-assalto', alcance: 'distancia', municao: 'Rifles de Assalto', cadencia: 2, ocupa: 2 },
    { uid: 'cx', nome: 'Bala de Fogo (cx)', tipo: 'municao', municao: 'rifle de assalto', descricao: 'Caixa c/ 3', dano: '1d4' }];
  assert.equal(R.balasDaArma(a, a.itens[0]), 3);
  const r = executar(c, 'combate.atacar', { atacante: a.id, alvo: b.id, opcoes: { armaUid: 'r' } }, ctxM);
  assert.match(r.excesso, /2 balas.*restam 1/);
  assert.equal(R.balasDaArma(a, a.itens[0]), 1);
  c.salas.batalha.combate.gasto = {};
  executar(c, 'combate.atacar', { atacante: a.id, alvo: b.id, opcoes: { armaUid: 'r' } }, ctxM);
  assert.ok(!a.itens.some(i => i.uid === 'cx'), 'caixa vazia sai do inventário');
  c.salas.batalha.combate.gasto = {};
  assert.throws(() => executar(c, 'combate.atacar', { atacante: a.id, alvo: b.id, opcoes: { armaUid: 'r' } }, ctxM), /sem munição/);
  const antes = Math.random; Math.random = () => 0.9;
  try { assert.ok(C.resolverAtaque(a, b, sistema('mss'), { armaUid: 'r', surpresa: true, municaoExtra: { nome: 'Bala de Fogo', dano: '1d4' } }).danoPartes.some(x => x.nome === 'Bala de Fogo')); } finally { Math.random = antes; }
});

test('arremessar: teste de Arremessar e o item sai da mão (no chão); equipar de novo recolhe', () => {
  const { c, a } = campo2();
  a.itens = [{ uid: 'fa', nome: 'Faca', tipo: 'arma', slot: 'maos', equipado: true, mao: 0, dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo' }];
  const r = executar(c, 'item.arremessar', { id: a.id, uid: 'fa' }, ctxM);
  assert.match(r.texto, /saiu da mão/);
  assert.deepEqual([a.itens[0].equipado, a.itens[0].noChao], [false, true]);
  executar(c, 'item.equipar', { id: a.id, uid: 'fa', equipar: true }, ctxM);
  assert.ok(a.itens[0].equipado && !a.itens[0].noChao);
});

test('maestria 2 ocupa as duas mãos (catálogo); arma natural é ataque desarmado', () => {
  const sis = sistema('mss');
  assert.equal(R.ocupaMaos({ slot: 'maos', maestria: 2, ocupa: 1 }), 2);
  assert.equal(R.ocupaMaos({ slot: 'maos', maestria: 1 }), 1);
  const { a } = campo2();
  a.itens = [{ uid: 'g', nome: 'Garras', tipo: 'arma', natural: true, equipado: true, dano: '1d6', tipoDano: 'Corte', pericia: 'arma-branca.laminas-curtas' }];
  assert.equal(C.armasDisponiveis(a, sis).find(x => x.uid === 'g').pericia, 'briga.ataque-desarmado');
});
