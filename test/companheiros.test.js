import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, visaoPara } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };

function montar() {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  c.jogadores = [ana.id];
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Lia' } }, ctxM).id;
  const lia = c.personagens.find(p => p.id === id);
  Object.assign(lia, { donoId: ana.id, tipo: 'pj' });
  return { c, lia };
}

test('companheiro: o jogador cria (em branco ou do Livro dos Monstros), controla no Campo de Batalha e remove', () => {
  const { c, lia } = montar();
  const { id } = executar(c, 'companheiro.criar', { de: lia.id, nome: 'Fumaça', tipo: 'animal' }, ctxA);
  const f = c.personagens.find(p => p.id === id);
  assert.equal(f.companheiroDe, lia.id);
  assert.equal(f.donoId, ana.id);
  assert.equal(f.tipoCriatura, 'animal');
  assert.ok(c.grupos.some(g => g.id === 'companheiros'));
  const monstro = mss.monstros[0];
  const r2 = executar(c, 'companheiro.criar', { de: lia.id, nome: '', tipo: 'montaria', monstro: monstro.nome }, ctxA);
  const m = c.personagens.find(p => p.id === r2.id);
  assert.equal(m.nome, monstro.nome);
  assert.equal(m.pv.max, monstro.pv);
  executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxA);
  assert.ok(c.salas.batalha.participantes.includes(id));
  executar(c, 'companheiro.remover', { id }, ctxA);
  assert.ok(!c.personagens.some(p => p.id === id));
  assert.ok(!c.salas.batalha.participantes.includes(id));
});

test('objetos no mapa: o mestre põe (os ocultos só ele vê); o jogador arma a armadilha do inventário e pode recolher', () => {
  const { c, lia } = montar();
  executar(c, 'mapa.objeto', { col: 2, lin: 3, nome: 'Fosso', tipo: 'armadilha', oculto: true }, ctxM);
  executar(c, 'mapa.objeto', { col: 4, lin: 1, nome: 'Barril', tipo: 'cobertura' }, ctxM);
  assert.equal(visaoPara(c, mestre, 'mestre').mapa.objetos.length, 2);
  assert.equal(visaoPara(c, ana, 'jogador').mapa.objetos.length, 1);
  lia.itens = [{ uid: 'k', nome: 'Armadilha de Passarinho', categoria: 'Armadilha', tipo: 'ferramenta', quantidade: 2 }];
  executar(c, 'mapa.armar', { id: lia.id, uid: 'k', col: 5, lin: 5 }, ctxA);
  assert.equal(lia.itens[0].quantidade, 1);
  const armada = c.mapa.objetos.find(o => o.dono === lia.id);
  assert.ok(armada && !armada.oculto);
  executar(c, 'mapa.objetoRemover', { id: armada.id, recolher: true }, ctxA);
  assert.equal(lia.itens.length, 2);
  const fosso = c.mapa.objetos.find(o => o.nome === 'Fosso');
  assert.throws(() => executar(c, 'mapa.objetoRemover', { id: fosso.id }, ctxA), /mestre/);
  assert.throws(() => executar(c, 'mapa.armar', { id: lia.id, uid: 'nada', col: 1, lin: 1 }, ctxA), /armadilha/);
});
