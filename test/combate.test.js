import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, visaoPara } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const { resolverAtaque, aplicarAtaque, d6Atual, modoRolagem, rolarDP, defesaDoAlvo, opcoesDefesa, ipDe, resistenciaManipulacao, resolverManipulacao, sobrevida } = await import('../shared/combate.js');
const { novaFicha } = await import('../shared/regras.js');

const mss = sistema('mss');
const msa = sistema('msa');
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };
const ana = { id: 'a', name: 'Ana' };

// rng que devolve a sequência dada (valores de 1..faces viram frações).
const seq = (...fracoes) => { let i = 0; return () => fracoes[i++ % fracoes.length]; };
const d100 = n => (n - 0.5) / 100;
const d10 = n => (n - 0.5) / 10;

function lutador(nome, extra = {}) {
  const p = { ...novaFicha(mss, { nivel: 1 }), id: nome, nome, tipo: 'pj', ...extra };
  p.pv = { max: 20, atual: 20 };
  return p;
}

test('vantagem e desvantagem se anulam e escolhem o d100', () => {
  assert.equal(modoRolagem(true, true), null);
  assert.equal(modoRolagem(true, false), 'vantagem');
  assert.equal(rolarDP('vantagem', seq(d100(10), d100(80))).dp, 80);
  assert.equal(rolarDP('desvantagem', seq(d100(10), d100(80))).dp, 10);
});

test('D6 de vida atual (Sacrifício)', () => {
  assert.equal(d6Atual(5), 0);
  assert.equal(d6Atual(6), 1);
  assert.equal(d6Atual(15), 4);
  assert.equal(d6Atual(17), 6);
});

test('defesa escolhida pelo defensor: o que vale contra cada ataque', () => {
  const alvo = lutador('B', { subpericias: { 'briga.esquiva': 10 } });
  const soco = { uid: 'desarmado', alcance: 'corpo' };
  const faca = { uid: 'x', alcance: 'corpo', pericia: 'arma-branca.laminas-curtas' };
  const tiro = { uid: 'y', alcance: 'distancia', pericia: 'armas-de-fogo.pistolas' };
  const ids = (arma, o) => opcoesDefesa(alvo, arma, mss, o).map(x => x.id);
  assert.deepEqual(ids(soco), ['esquiva', 'defesa-desarmada', 'nenhuma']);
  assert.deepEqual(ids(faca), ['esquiva', 'nenhuma'], 'defesa desarmada só contra Briga');
  assert.deepEqual(ids(tiro), ['nenhuma'], 'esquiva não vale contra tiro');
  assert.deepEqual(ids(tiro, { area: true }), ['evasao', 'nenhuma']);
  const esquiva = 10 + 2 * (10 - 5); // pontos + bônus pericial de AGI 10
  assert.equal(defesaDoAlvo(alvo, faca, mss, { escolha: 'esquiva' }).total, esquiva + 50);
  assert.equal(defesaDoAlvo(alvo, faca, mss, { escolha: 'esquiva', cobertura: true }).total, esquiva + 50, 'cobertura só contra distância');
  assert.equal(defesaDoAlvo(alvo, tiro, mss, { cobertura: true }).total, 80);
  assert.throws(() => defesaDoAlvo(alvo, tiro, mss, { escolha: 'esquiva' }), /não vale/);
});

test('IP soma itens e habilidades', () => {
  const b = lutador('B', { ipExtra: 3 });
  b.itens = [{ uid: 'g', nome: 'Gibão', tipo: 'defesa', equipado: true, defesa: 2 }];
  assert.equal(ipDe(b, mss), 5);
});

test('Evasão bem-sucedida contra ataque em área: metade do dano', () => {
  const a = lutador('A');
  const b = lutador('B');
  const r = resolverAtaque(a, b, mss, { area: true }, 'evasao', seq(d100(10), d10(5), 0.99));
  assert.equal(r.sucesso, false);
  assert.ok(r.metadeEvasao);
  assert.equal(r.dano, Math.floor(Math.max(1, r.danoBruto - r.ip) / 2));
});

test('ataque: acerto, dano − IP (mínimo 1), crítico e efeito pelo DS', () => {
  const a = lutador('A', { atributos: { ...novaFicha(mss).atributos, FOR: 14 } });
  a.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', tipoDano: 'Corte', efeitoDano: 3, alcance: 'corpo' }];
  const b = lutador('B');
  b.itens = [{ uid: 'g', nome: 'Gibão', tipo: 'defesa', equipado: true, defesa: 2 }];
  // d100 = 99 (acerto crítico), DS = 2, faca 4, crítico 3.
  const r = resolverAtaque(a, b, mss, { armaUid: 'f' }, 'nenhuma', seq(d100(99), d10(2), 0.99, 0.6));
  assert.equal(r.critico, 'acerto');
  assert.ok(r.sucesso);
  assert.equal(r.danoBruto, 4 + 3 + 2); // + MOD FOR 2
  assert.equal(r.ip, 2);
  assert.equal(r.dano, 7);
  assert.equal(r.efeito, 'Sangramento');
  aplicarAtaque(a, b, r);
  assert.equal(b.pv.atual, 13);
  assert.ok(b.marcadores.includes('Sangramento'));

  // Erro crítico sempre erra.
  const e = resolverAtaque(a, b, mss, { armaUid: 'f', mod: 100 }, 'nenhuma', seq(d100(3), d10(5)));
  assert.equal(e.sucesso, false);

  // Dano mínimo 1 mesmo com IP alto; DS acima do efeito não aplica efeito.
  b.itens[0].defesa = 50;
  const m = resolverAtaque(a, b, mss, { armaUid: 'f', mod: 100 }, 'nenhuma', seq(d100(60), d10(9), 0.1));
  assert.equal(m.dano, 1);
  assert.equal(m.efeito, null);
});

test('ataque com vantagem contra alvo caído e localizado', () => {
  const a = lutador('A');
  const b = lutador('B', { marcadores: ['Caído'] });
  const r = resolverAtaque(a, b, mss, { localizado: true }, 'esquiva', seq(d100(20), d100(90), d10(5), 0.5, 0.5));
  assert.equal(r.modo, 'vantagem');
  assert.equal(r.dp, 90);
  assert.ok(r.mods.some(x => x.nome === 'localizado' && x.valor === -30));
  assert.ok(r.danoPartes.some(x => x.nome === 'localizado'));
});

test('desmaio, morte com PV negativo e sobrevida', () => {
  const a = lutador('A');
  const b = lutador('B');
  b.pv.atual = 1;
  aplicarAtaque(a, b, { sucesso: true, dano: 3, efeito: null, naoLetal: false });
  assert.ok(b.marcadores.includes('Desmaiado'));
  assert.match(sobrevida(b, mss), /perdeu 1 PV/);
  assert.equal(b.pv.atual, -3);
  aplicarAtaque(a, b, { sucesso: true, dano: 1, efeito: null, naoLetal: false });
  assert.ok(b.marcadores.includes('Morto'));
});

test('manipulação: R.MNP pelo humor, sucesso muda humor, falha dá opções', () => {
  const a = lutador('A', { subpericias: { 'manipulacao.intimidacao': 20 } });
  const b = lutador('B');
  const base = resistenciaManipulacao(b, mss);
  assert.equal(base, 4 * 10 + 50, 'R.MNP = CAR% + 50');
  b.rmnpExtra = 5;
  assert.equal(resistenciaManipulacao(b, mss), base + 5);
  b.rmnpExtra = 0;
  b.humor = 'confiante';
  assert.equal(resistenciaManipulacao(b, mss), base - 30);
  b.humor = 'neutro';
  assert.throws(() => resolverManipulacao(a, b, 'manipulacao.intimidacao', 'atraido', mss), /não causa/);
  const falha = resolverManipulacao(a, b, 'manipulacao.intimidacao', 'amedrontado', mss, { rng: seq(d100(10), d10(1)) });
  assert.equal(falha.sucesso, false);
  assert.deepEqual(falha.opcoesFalha, ['corajoso']);
  a.humor = 'apatico';
  assert.throws(() => resolverManipulacao(a, b, 'manipulacao.intimidacao', 'amedrontado', mss), /não pode manipular/);
});

test('ações de combate e humor no servidor (MSS) e bloqueio no MSA', () => {
  const c = novaCampanha(mestre, { nome: 'Batalha', maxJogadores: 2, nivel: 1, padraoMSA: true, sistema: 'mss' });
  const ids = ['Lia', 'Rato', 'Cão'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const lia = c.personagens.find(p => p.id === ids[0]);
  lia.donoId = ana.id;
  lia.tipo = 'pj';
  for (const id of ids.slice(0, 2)) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  executar(c, 'combate.iniciar', {}, ctxM);
  const cb = c.salas.batalha.combate;
  assert.equal(cb.ordem.length, 2);
  assert.ok(cb.ordem[0].ini >= cb.ordem[1].ini);
  // Quem entra no meio rola iniciativa.
  executar(c, 'sala.adicionar', { sala: 'batalha', id: ids[2] }, ctxM);
  assert.equal(cb.ordem.length, 3);
  executar(c, 'combate.proximo', {}, ctxM);
  executar(c, 'combate.proximo', {}, ctxM);
  executar(c, 'combate.proximo', {}, ctxM);
  assert.equal(cb.rodada, 2);
  const pend = executar(c, 'combate.atacar', { atacante: ids[0], alvo: ids[1], opcoes: { vantagem: true } }, { user: ana, mestre: false });
  assert.equal(c.salas.batalha.pendentes.length, 1);
  assert.throws(() => executar(c, 'combate.defender', { id: pend.id, defesa: 'esquiva' }, { user: ana, mestre: false }), /controla o alvo/);
  const r = executar(c, 'combate.defender', { id: pend.id, defesa: 'esquiva' }, ctxM);
  assert.equal(r.tipo, 'ataque');
  assert.match(r.rotulo, /Esquiva/);
  assert.equal(c.salas.batalha.pendentes.length, 0);
  assert.ok(!/mestre/.test(r.detalhe), 'jogador não força vantagem');
  assert.throws(() => executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0] }, { user: ana, mestre: false }), /não é seu/);
  executar(c, 'sala.remover', { sala: 'batalha', id: ids[2] }, ctxM);
  assert.equal(cb.ordem.length, 2);
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.equal(c.salas.batalha.combate, null);

  // Humor: o jogador só escolhe os humores livres; Apático custa Humanidade.
  assert.throws(() => executar(c, 'humor.definir', { id: ids[0], humor: 'corajoso' }, { user: ana, mestre: false }), /só escolhe/);
  const hum = lia.humanidade.atual;
  executar(c, 'humor.definir', { id: ids[0], humor: 'apatico' }, { user: ana, mestre: false });
  assert.ok(lia.humanidade.atual < hum);
  assert.equal(visaoPara(c, { id: 'x' }, 'jogador').personagens.find(p => p.id === ids[0]).humor, 'apatico');
  executar(c, 'humor.definir', { id: ids[0], humor: 'neutro' }, { user: ana, mestre: false });
  const m = executar(c, 'social.manipular', { autor: ids[1], alvo: ids[0], sub: 'manipulacao.lideranca', humor: 'motivado' }, ctxM);
  assert.equal(m.tipo, 'manipulacao');
  if (!m.sucesso) assert.deepEqual(lia.humorOpcoes, ['desmotivado']);
  else assert.equal(lia.humor, 'motivado');

  // No MSA o combate automático fica desligado.
  executar(c, 'campanha.atualizar', { sistema: 'msa' }, ctxM);
  assert.throws(() => executar(c, 'combate.iniciar', {}, ctxM), /ainda não existem no MSA/);
  assert.throws(() => executar(c, 'social.manipular', { autor: ids[1], alvo: ids[0], sub: 'manipulacao.labia', humor: 'confiante' }, ctxM), /ainda não existem/);
  assert.equal(msa.modulos.combate, false);
});
