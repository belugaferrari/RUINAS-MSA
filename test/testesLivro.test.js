// Regras de testes do livro (autor, 31/10: "o que está no livro e o app não faz, pode pôr"):
// DS com e sem item, auras de Perícias equipadas, Concentração, Confuso, visibilidade, auxílio/conjunta e Sanidade.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const R = await import('../shared/regras.js');

const msa = sistema('msa');
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };
function campo(nomes = ['Eu', 'Ele']) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'msa' });
  const ids = nomes.map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  return { c, ps: ids.map(id => c.personagens.find(p => p.id === id)) };
}
// Sequência de "dados": cada chamada de Math.random devolve o próximo valor (o último se repete).
function comDados(valores, fn) {
  const antes = Math.random;
  const v = [].concat(valores);
  let i = 0;
  Math.random = () => v[Math.min(i++, v.length - 1)];
  try { return fn(); } finally { Math.random = antes; }
}
const D100 = n => (n - 0.5) / 100; // valor de Math.random que dá n no d100
const D10 = n => (n - 0.5) / 10;

test('sem item, falhou e DS maior que a dezena da ação: mental → Confuso (desvantagem no próximo teste mental, que o tira)', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  const r = comDados([D100(10), D10(9)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'per:ciencia', nd: 100 }, ctxM));
  assert.equal(r.sucesso, false);
  assert.ok(eu.marcadores.includes('Confuso'), r.texto);
  const r2 = executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:INT', nd: 50 }, ctxM);
  assert.equal(r2.modo, 'desvantagem');
  assert.ok(!eu.marcadores.includes('Confuso'));
});

test('sem item, teste de movimento: danifica uma roupa vestida', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  eu.itens = [{ uid: 'cam', nome: 'Camisa', tipo: 'vestimenta', slot: 'tronco', equipado: true, durabilidade: 3, durabilidadeAtual: 3 }];
  const r = comDados([D100(5), D10(10), 0], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:espionagem.furtividade', nd: 100 }, ctxM));
  assert.match(r.texto, /Camisa danificada \(2\/3\)/);
  assert.ok(!(eu.marcadores || []).includes('Confuso'));
});

test('com item: falhou e DS maior que a durabilidade tira 1; passou com DS bom → aura (Familiaridade +5); a aura some ao perder durabilidade', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  eu.itens = [{ uid: 'kit', nome: 'Kit de Escalada', tipo: 'equipamento', durabilidade: 3, durabilidadeAtual: 3 }];
  const f = comDados([D100(5), D10(8)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.escalada', nd: 100, itemUid: 'kit' }, ctxM));
  assert.match(f.texto, /perdeu 1 de durabilidade/);
  assert.equal(eu.itens[0].durabilidadeAtual, 2);
  const ok = comDados([D100(99), D10(1)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.escalada', nd: 50, itemUid: 'kit' }, ctxM));
  assert.equal(ok.aura?.uid, 'kit');
  executar(c, 'item.aura', { id: eu.id, uid: 'kit', aura: 'familiaridade' }, ctxM);
  assert.throws(() => executar(c, 'item.aura', { id: eu.id, uid: 'kit', aura: 'cuidadoso' }, ctxM), /não tem aura/);
  const com = comDados([D100(50), D10(5)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.escalada', nd: 50, itemUid: 'kit' }, ctxM));
  const sem = comDados([D100(50), D10(5)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.escalada', nd: 50 }, ctxM));
  assert.equal(com.total - sem.total, 5);
  comDados([D100(5), D10(10)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.escalada', nd: 100, itemUid: 'kit' }, ctxM));
  assert.equal(eu.itens[0].aura, undefined);
});

test('Cuidadoso: DS que tiraria durabilidade é rerolado uma vez', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  eu.itens = [{ uid: 'k', nome: 'Gazua', durabilidade: 3, durabilidadeAtual: 3, aura: { id: 'cuidadoso', nome: 'Cuidadoso' } }];
  const r = comDados([D100(5), D10(9), D10(2)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:avaliacao-de-objetos.abrir-fechadura', nd: 100, itemUid: 'k' }, ctxM));
  assert.match(r.texto, /Cuidadoso: DS rerolado \(9 → 2\)/);
  assert.equal(eu.itens[0].durabilidadeAtual, 3);
});

test('Concentração: soma dos atributos mentais, ND 100 (Foco absoluto: 70); passou → concentrado; dano quebra e dá −30% no próximo teste', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  const k = R.valorConcentracao(eu, msa);
  const d = R.derivados(eu, msa);
  assert.equal(k.base, d.atributos.INT + d.atributos.CAR + d.atributos.PER + d.atributos.WILL);
  const r = comDados([D100(95), D10(5)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'conc', nd: 50 }, ctxM));
  assert.equal(r.nd, 100);
  assert.equal(r.sucesso, true);
  assert.ok(R.concentrado(eu));
  executar(c, 'pv.alterar', { id: eu.id, delta: -1 }, ctxM);
  assert.ok(!R.concentrado(eu));
  const a = comDados([D100(50), D10(5)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:INT', nd: 50 }, ctxM));
  const b = comDados([D100(50), D10(5)], () => executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:INT', nd: 50 }, ctxM));
  assert.equal(b.total - a.total, 30, 'o −30% vale só para o próximo teste');
});

test('visibilidade: penumbra → Percepção em desvantagem; outros testes não', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  assert.equal(executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:sentidos.visao', nd: 70, luz: 'penumbra' }, ctxM).modo, 'desvantagem');
  assert.ok(!executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:FOR', nd: 70, luz: 'penumbra' }, ctxM).modo);
  assert.match(executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:FOR', nd: 70, luz: 'escuro' }, ctxM).texto, /Cego/);
});

test('auxílio: vantagem só se o ajudante tiver 10% a mais; conjunta: joga o maior, com vantagem', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.atributos.INT = 5; ele.atributos.INT = 12;
  const aux = executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:INT', ajudante: ele.id }, ctxM);
  assert.equal(aux.modo, 'vantagem');
  const inv = executar(c, 'rolar', { id: ele.id, acaoRef: 'atr:INT', ajudante: eu.id }, ctxM);
  assert.ok(!inv.modo);
  const conj = executar(c, 'rolar', { id: eu.id, acaoRef: 'atr:INT', ajudante: ele.id, ajuda: 'conjunta' }, ctxM);
  assert.equal(conj.modo, 'vantagem');
  assert.equal(conj.acao, R.derivados(ele, msa).percentual.INT);
});

test('Sanidade: Jogar pede teste Normal e só vale uma vez por dia', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  eu.sanidade = { max: 30, atual: 10 };
  const falhou = comDados([D100(1), D10(5)], () => executar(c, 'sanidade.recuperar', { id: eu.id, forma: 'jogar' }, ctxM));
  assert.equal(falhou.recuperou, 0);
  eu.marcadores = []; // a falha com DS alto deixou Confuso (teste mental)
  const ok = comDados([D100(99), D10(5), 0.99], () => executar(c, 'sanidade.recuperar', { id: eu.id, forma: 'jogar', acaoRef: 'sub:jogos.cartas' }, ctxM));
  assert.equal(ok.recuperou, 4);
  assert.equal(eu.sanidade.atual, 14);
  assert.throws(() => executar(c, 'sanidade.recuperar', { id: eu.id, forma: 'jogar' }, ctxM), /hoje/);
  assert.equal(executar(c, 'sanidade.recuperar', { id: eu.id, forma: 'consumir-artes' }, ctxM).recuperou, 1);
});
