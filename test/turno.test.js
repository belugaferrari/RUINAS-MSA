import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const { acoesDaHabilidade, listaHabilidades, dadosDaHabilidade } = await import('../shared/regras.js');
const { sincronizarEfeitos, passarTurnoEfeitos } = await import('../shared/efeitos.js');

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };

test('tempo das habilidades vem do texto do livro (Despertar: bônus; Predador Apex: reação) e do lápis do mestre', () => {
  const cl = mss.classes.find(c => c.nome === 'Transmorfo');
  const esp = cl.especializacoes.find(e => /LICANT/.test(e.nome));
  const f = { classe: cl.id, especializacao: esp.id, nivel: 20, atributos: {} };
  const hs = listaHabilidades(f, mss);
  const de = n => hs.find(x => x.nome === n);
  assert.deepEqual(acoesDaHabilidade(f, mss, de('Despertar')).slice(0, 2), ['bonus', 'livre']);
  assert.equal(acoesDaHabilidade(f, mss, de('Predador Apex'))[0], 'reacao');
  assert.deepEqual(dadosDaHabilidade(de('Predador Apex')), ['1d8']);
  f.ajustesHabilidades = { [de('Licantropia').id]: 'ação: completa' };
  assert.deepEqual(acoesDaHabilidade(f, mss, de('Licantropia')), ['completa']);
});

test('economia do turno: o ataque gasta a principal; o 2º ataque avisa; o próximo turno devolve; fora do turno é reação', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Lia', 'Vaz'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const cb = c.salas.batalha.combate;
  const vez = cb.ordem[cb.vez].id, outro = ids.find(x => x !== vez);
  const r1 = executar(c, 'combate.atacar', { atacante: vez, alvo: outro, opcoes: { surpresa: true } }, ctxM);
  assert.ok(!r1.excesso);
  const r2 = executar(c, 'combate.atacar', { atacante: vez, alvo: outro, opcoes: { surpresa: true } }, ctxM);
  assert.match(r2.excesso, /já usou a ação principal/);
  // O outro ataca fora do turno: gasta a reação (1 por rodada).
  executar(c, 'combate.atacar', { atacante: outro, alvo: vez, opcoes: { surpresa: true } }, ctxM);
  assert.equal(cb.gasto[outro].reacao, 1);
  const mov = executar(c, 'combate.acao', { id: vez, tipo: 'completa', rotulo: 'teste' }, ctxM);
  assert.match(mov.excesso, /principal/);
  executar(c, 'combate.proximo', {}, ctxM);
  executar(c, 'combate.proximo', {}, ctxM);
  assert.ok(!cb.gasto[vez].principal, 'novo turno devolve a principal');
});

test('Sangramento: perde 1 PV já no 1º turno do afetado; depois a cada 1d4 turnos', () => {
  const p = { id: 'x', nome: 'X', pv: { max: 20, atual: 20 }, marcadores: ['Sangramento'] };
  sincronizarEfeitos(p, mss, { rng: () => 0.99 });
  const id = Object.keys(p.efeitos)[0];
  assert.equal(p.efeitos[id].turnos, 1);
  const notas = passarTurnoEfeitos(p, mss, () => 0.99);
  assert.equal(p.pv.atual, 19);
  assert.match(notas[0], /próxima perda em 4/);
});

test('só o mestre cancela efeitos', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Lia' } }, ctxM).id;
  const lia = c.personagens.find(p => p.id === id);
  Object.assign(lia, { donoId: ana.id, tipo: 'pj', marcadores: ['Sangramento'] });
  const ef = mss.condicoes.find(x => x.nome === 'Sangramento').id;
  assert.throws(() => executar(c, 'efeito.turnos', { id, efeito: ef, turnos: 0 }, ctxA));
  executar(c, 'efeito.turnos', { id, efeito: ef, turnos: 0 }, ctxM);
  assert.ok(!lia.marcadores.includes('Sangramento'));
});
