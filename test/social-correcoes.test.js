import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const { resolverManipulacao, humorAparente } = await import('../shared/combate.js');
const { novaFicha } = await import('../shared/regras.js');

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };

function montar() {
  const c = novaCampanha(mestre, { nome: 'S', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Lia', 'Vaz'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const lia = c.personagens.find(p => p.id === ids[0]);
  Object.assign(lia, { donoId: ana.id, tipo: 'pj' });
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'social', id }, ctxM);
  return { c, lia, vaz: c.personagens.find(p => p.id === ids[1]) };
}

test('manipulação oculta: quem testou recebe os dados (número), não o resultado; afinidade trava depois do 1º teste', () => {
  const { c, lia, vaz } = montar();
  executar(c, 'relacao.definir', { de: lia.id, para: vaz.id, tipo: 'Aliado' }, ctxA);
  const r = executar(c, 'social.manipular', { autor: lia.id, alvo: vaz.id, sub: 'manipulacao.labia', humor: mss.social.manipulacoes['manipulacao.labia'].causa.find(x => x !== 'ler') }, ctxA);
  assert.equal(r.oculto, true);
  assert.equal(r.dp, undefined, 'sem número para o jogador');
  assert.equal(r.sucesso, undefined);
  assert.equal(r.nd, undefined);
  assert.throws(() => executar(c, 'relacao.definir', { de: lia.id, para: vaz.id, tipo: 'Rival' }, ctxA), /antes do primeiro teste/);
  executar(c, 'relacao.definir', { de: lia.id, para: vaz.id, tipo: 'Rival' }, ctxM); // o mestre pode
  // Saiu e voltou: libera de novo.
  executar(c, 'sala.remover', { sala: 'social', id: lia.id }, ctxA);
  executar(c, 'sala.adicionar', { sala: 'social', id: lia.id }, ctxA);
  executar(c, 'relacao.definir', { de: lia.id, para: vaz.id, tipo: 'Aliado' }, ctxA);
});

test('Intuir humor não tem rebote', () => {
  const a = { ...novaFicha(mss), id: 'a', nome: 'A', humor: 'neutro' };
  const b = { ...novaFicha(mss), id: 'b', nome: 'B', humor: 'neutro' };
  for (let i = 0; i < 20; i++) {
    const r = resolverManipulacao(a, b, 'manipulacao.empatia', 'ler', mss, { rng: () => 0.05 });
    assert.equal(r.sucesso, false);
    assert.equal(r.rebote, null);
    assert.deepEqual(r.opcoesRebote, []);
  }
});

test('humor aparente: padrão Neutro, pode ser igual ao real e não muda quando o real muda', () => {
  const { c, lia } = montar();
  assert.equal(humorAparente(lia), 'neutro');
  executar(c, 'humor.definir', { id: lia.id, humor: 'amigavel', camada: 'aparente' }, ctxA);
  assert.equal(lia.humorAparente, 'amigavel');
  executar(c, 'humor.definir', { id: lia.id, humor: 'amigavel' }, ctxM); // real igual ao aparente: continua com o aparente
  assert.equal(lia.humorAparente, 'amigavel');
  executar(c, 'humor.definir', { id: lia.id, humor: 'raivoso' }, ctxM); // o real muda; a sala continua vendo Amigável
  assert.equal(humorAparente(lia), 'amigavel');
  const log = c.salas.social.log.filter(e => /Humor de Lia/.test(e.rotulo));
  assert.ok(log.every(e => e.privadoPara), 'a mudança do humor real não vai para o registro público');
});

test('Reparar item: ND 60 + 10 por ponto perdido; 3 falhas seguidas viram sucata', async () => {
  const { c, lia } = montar();
  lia.itens = [{ uid: 'f1', nome: 'Faca', tipo: 'arma', durabilidade: 5, durabilidadeAtual: 3, reparavel: true }];
  const rnd = Math.random;
  try {
    Math.random = () => 0.5; // d100 51 + ação baixa < ND 200: falha (sem crítico)
    for (let i = 0; i < 3; i++) executar(c, 'item.repararTeste', { id: lia.id, uid: 'f1', sub: 'engenharia.mecanica' }, ctxA);
  } finally { Math.random = rnd; }
  assert.equal(lia.itens[0].sucata, true);
  assert.throws(() => executar(c, 'item.repararTeste', { id: lia.id, uid: 'f1', sub: 'engenharia.mecanica', nd: 70 }, ctxA), /sucata/);
  lia.itens.push({ uid: 'f2', nome: 'Machado', tipo: 'arma', durabilidade: 5, durabilidadeAtual: 3, reparavel: true });
  try {
    Math.random = () => 0.97; // crítico de acerto
    const r = executar(c, 'item.repararTeste', { id: lia.id, uid: 'f2', sub: 'engenharia.mecanica', nd: 70 }, ctxA);
    assert.ok(r.sucesso);
  } finally { Math.random = rnd; }
  assert.equal(lia.itens[1].durabilidadeAtual, 4);
  const { ndReparo } = await import('../server/actions.js');
  assert.equal(ndReparo({ durabilidade: 5, durabilidadeAtual: 3 }), 80);
  assert.equal(ndReparo({ durabilidade: 5, durabilidadeAtual: 0 }), 110);
});

test('Intuir humor: falhou → o aparente; passou → o real; a frase é igual e o jogador não sabe se falhou', () => {
  const { c, lia, vaz } = montar();
  vaz.humor = 'raivoso';
  vaz.humorAparente = 'amigavel';
  const rnd = Math.random;
  try {
    Math.random = () => 0.02; // erro crítico: falha
    const falha = executar(c, 'social.manipular', { autor: lia.id, alvo: vaz.id, sub: 'manipulacao.empatia', humor: 'ler' }, ctxA);
    Math.random = () => 0.97; // crítico: sucesso
    const passou = executar(c, 'social.manipular', { autor: lia.id, alvo: vaz.id, sub: 'manipulacao.empatia', humor: 'ler' }, ctxA);
    assert.match(falha.percebido, /^Você percebe que Vaz está Amigável\.$/);
    assert.match(passou.percebido, /Raivoso/);
    assert.equal(falha.sucesso, undefined);
    assert.equal(passou.sucesso, undefined);
  } finally { Math.random = rnd; }
  assert.equal(vaz.humor, 'raivoso', 'intuir não muda o humor');
  assert.ok(c.salas.social.log.some(e => e.privadoPara === ana.id && /Intuir humor/.test(e.rotulo)));
});

test('humor nos testes: Atraído rola Percepção em desvantagem (2d100 e 2 DS, fica com o menor)', () => {
  const { c, lia } = montar();
  lia.humor = 'atraido';
  const r = executar(c, 'rolar', { id: lia.id, acaoRef: 'atr:PER', nd: 70 }, ctxM);
  assert.equal(r.modo, 'desvantagem');
  assert.equal(r.dados.length, 2);
  assert.equal(r.dsDados.length, 2);
  assert.equal(r.dp, Math.min(...r.dados));
  assert.equal(r.ds, Math.min(...r.dsDados));
  assert.match(r.rotulo, /humor Atraído/);
  const outro = executar(c, 'rolar', { id: lia.id, acaoRef: 'atr:FOR', nd: 70 }, ctxM);
  assert.ok(!outro.modo);
  lia.humor = 'amedrontado';
  const v = executar(c, 'rolar', { id: lia.id, acaoRef: 'atr:PER', nd: 70, modo: '' }, ctxM);
  assert.equal(v.modo, 'vantagem');
  assert.equal(v.ds, Math.max(...v.dsDados));
});
