import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1'; // testes usam a lista curta de itens de exemplo
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, visaoPara } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const { resolverAtaque, aplicarAtaque, d6Atual, modoRolagem, rolarDP, defesaDoAlvo, opcoesDefesa, ipDe, espectroDe, resistenciaManipulacao, resolverManipulacao, sobrevida } = await import('../shared/combate.js');
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
  assert.deepEqual(ids(tiro), ['nenhuma'], 'não há defesa contra tiro');
  assert.deepEqual(ids(tiro, { area: true }), ['evasao', 'nenhuma']);
  const esquiva = 10 + 2 * (10 - 5); // pontos + bônus pericial de AGI 10
  assert.equal(defesaDoAlvo(alvo, faca, mss, { escolha: 'esquiva' }).total, esquiva + 50);
  alvo.nivel = 3;
  assert.equal(defesaDoAlvo(alvo, tiro, mss).total, 50 + 5 * 3, 'tiro: 50 + 5 × nível do alvo');
  alvo.marcadores = ['Caído'];
  assert.equal(defesaDoAlvo(alvo, tiro, mss).total, 50 + 15 + 30, 'caído: cobertura parcial contra tiro');
  alvo.marcadores = [];
  assert.throws(() => defesaDoAlvo(alvo, tiro, mss, { escolha: 'esquiva' }), /não vale/);
});

test('Esquiva contra arma: se for acertado, +2 de dano', () => {
  const a = lutador('A');
  a.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', tipoDano: 'Corte', efeitoDano: 3, alcance: 'corpo' }];
  const b = lutador('B');
  const rng = () => seq(d100(90), d10(9), 0.5);
  const esq = resolverAtaque(a, b, mss, { armaUid: 'f' }, 'esquiva', rng());
  const sem = resolverAtaque(a, b, mss, { armaUid: 'f' }, 'nenhuma', rng());
  assert.ok(esq.sucesso && sem.sucesso);
  assert.equal(esq.danoBruto, sem.danoBruto + 2);
  const soco = resolverAtaque(a, b, mss, {}, 'esquiva', rng());
  assert.ok(!soco.danoPartes.some(x => x.nome === 'esquiva contra arma'), 'contra Briga não tem o +2');
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

test('manipulação: R.MNP pelo humor, sucesso muda humor, falha dá o rebote do espectro', () => {
  const a = lutador('A', { subpericias: { 'manipulacao.intimidacao': 20 } });
  const b = lutador('B');
  const base = resistenciaManipulacao(b, mss);
  assert.equal(base, 2 * (10 - 5) + 50, 'R.MNP = perícia base Manipulação (só o bônus de CAR 10) + 50');
  b.pericias = { manipulacao: 6 };
  assert.equal(resistenciaManipulacao(b, mss), base + 6, 'cresce com os pontos na perícia');
  b.pericias = {};
  b.rmnpExtra = 5;
  assert.equal(resistenciaManipulacao(b, mss), base + 5);
  b.rmnpExtra = 0;
  b.humor = 'confiante';
  assert.equal(resistenciaManipulacao(b, mss), base - 30);
  b.humor = 'neutro';
  assert.throws(() => resolverManipulacao(a, b, 'manipulacao.intimidacao', 'atraido', mss), /não causa/);
  // Intimidação falhando: A → Indisposto/Apático, B → Desconfiado/Corajoso, C → Corajoso/Raivoso.
  // Com duas opções, o alvo escolhe (nada é sorteado).
  const rebote = esp => resolverManipulacao(a, b, 'manipulacao.intimidacao', 'amedrontado', mss, { espectro: esp, rng: seq(d100(10), d10(1)) });
  assert.deepEqual(rebote('A').opcoesRebote, ['indisposto', 'apatico']);
  assert.deepEqual(rebote('B').opcoesRebote, ['desconfiado', 'corajoso']);
  assert.deepEqual(rebote('C').opcoesRebote, ['corajoso', 'raivoso']);
  assert.equal(rebote('B').rebote, null);
  assert.equal(rebote('B').sucesso, false);
  assert.equal(resolverManipulacao(a, b, 'manipulacao.lideranca', 'sereno', mss, { espectro: 'A', rng: seq(d100(10), d10(1)) }).rebote, 'desmotivado');
  assert.equal(espectroDe('Inimigo', mss), 'C');
  assert.equal(espectroDe('Amigável', mss), 'A');
  assert.equal(espectroDe(undefined, mss), 'B');
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
  assert.match(r.texto, /Acertou|defendeu \(Esquiva\)/);
  assert.equal(c.salas.batalha.pendentes.length, 0);
  assert.ok(!/mestre/.test(r.detalhe), 'jogador não força vantagem');
  assert.throws(() => executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0] }, { user: ana, mestre: false }), /não é seu/);
  // Tiro não tem defesa: resolve na hora, sem esperar.
  const npc = c.personagens.find(p => p.id === ids[1]);
  npc.itens = [{ uid: 'rv', nome: 'Revólver', tipo: 'arma', equipado: true, dano: '2d6', pericia: 'armas-de-fogo.pistolas', tipoDano: 'Perfuração', alcance: 'distancia' }];
  const tiro = executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0], opcoes: { armaUid: 'rv' } }, ctxM);
  assert.equal(tiro.tipo, 'ataque');
  assert.match(tiro.detalhe, /nível 1 × 5/);
  assert.equal(c.salas.batalha.pendentes.length, 0);
  executar(c, 'sala.remover', { sala: 'batalha', id: ids[2] }, ctxM);
  assert.equal(cb.ordem.length, 2);
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.equal(c.salas.batalha.combate, null);

  // Humor: o jogador só escolhe Amigável, Neutro ou Indisposto (Apático e os outros vêm de manipulação ou do mestre).
  assert.throws(() => executar(c, 'humor.definir', { id: ids[0], humor: 'corajoso' }, { user: ana, mestre: false }), /só escolhe/);
  assert.throws(() => executar(c, 'humor.definir', { id: ids[0], humor: 'apatico' }, { user: ana, mestre: false }), /só escolhe/);
  const san = lia.sanidade.atual;
  // Apático (dado pelo mestre): resistir custa só Humanidade (temporária) — o caminho continua para quem tiver habilidade.
  executar(c, 'humor.definir', { id: ids[0], humor: 'apatico' }, ctxM);
  const hum0 = lia.humanidade.atual;
  // Dentro da Sala Social o jogador não troca o próprio humor.
  executar(c, 'sala.adicionar', { sala: 'social', id: ids[0] }, ctxM);
  assert.throws(() => executar(c, 'humor.definir', { id: ids[0], humor: 'amigavel' }, { user: ana, mestre: false }), /Dentro da Sala Social/);
  executar(c, 'sala.remover', { sala: 'social', id: ids[0] }, ctxM);
  executar(c, 'humor.definir', { id: ids[0], humor: 'amigavel' }, { user: ana, mestre: false });
  assert.equal(lia.humor, 'amigavel');
  assert.ok(lia.humanidade.atual <= hum0);
  executar(c, 'humor.definir', { id: ids[0], humor: 'apatico' }, ctxM);
  // Máscara: a sala vê o humor aparente; o real fica com o dono e o mestre.
  executar(c, 'humor.definir', { id: ids[0], humor: 'corajoso', camada: 'aparente' }, { user: ana, mestre: false });
  const outro = { id: 'x' };
  assert.equal(visaoPara(c, outro, 'jogador').personagens.find(p => p.id === ids[0]).humor, 'corajoso');
  assert.equal(visaoPara(c, ana, 'jogador').personagens.find(p => p.id === ids[0]).humor, 'apatico');
  assert.ok(!visaoPara(c, outro, 'jogador').salas.social.log.some(e => /Máscara/.test(e.rotulo)), 'a troca de máscara é privada');
  // Empatia "ler": revela o humor real só para quem testou.
  const rato = c.personagens.find(p => p.id === ids[1]);
  rato.subpericias = { 'manipulacao.empatia': 200 };
  let leitura;
  do {
    Object.assign(lia, { humor: 'apatico', humorAparente: 'corajoso', humorImposto: false }); // (um erro crítico daria rebote)
    leitura = executar(c, 'social.manipular', { autor: ids[1], alvo: ids[0], sub: 'manipulacao.empatia', humor: 'ler' }, ctxM);
  } while (!leitura.sucesso);
  assert.match(leitura.revelado, /^Você percebe que Lia está Apático\.$/, 'mesma frase da falha, sem entregar a máscara');
  // Toda manipulação é oculta: nenhum jogador vê o teste (nem quem é o alvo); o mestre vê tudo.
  assert.ok(!visaoPara(c, ana, 'jogador').salas.social.log.some(e => e.tipo === 'manipulacao'));
  assert.ok(visaoPara(c, { id: c.mestreId }, 'mestre').salas.social.log.some(e => e.tipo === 'manipulacao'));
  // Manipulação imposta + jogador quebrando o humor = dano de Sanidade (dissonância).
  executar(c, 'humor.definir', { id: ids[0], humor: 'motivado' }, ctxM);
  assert.equal(lia.humorImposto, true);
  executar(c, 'humor.definir', { id: ids[0], humor: 'neutro' }, { user: ana, mestre: false });
  assert.ok(lia.sanidade.atual < san, 'quebrar o humor imposto custa Sanidade');
  assert.equal(lia.sanidade.temporario, san - lia.sanidade.atual, 'dano temporário');
  // Teste de Consciência: sucesso devolve o temporário, falha torna permanente; zera o temporário.
  const cons = executar(c, 'consciencia.testar', { id: ids[0] }, { user: ana, mestre: false });
  assert.equal(lia.sanidade.temporario, 0);
  assert.equal(lia.humanidade.temporario, 0);
  if (cons.sucesso) assert.equal(lia.sanidade.atual, san);
  assert.throws(() => executar(c, 'consciencia.testar', { id: ids[0] }, { user: ana, mestre: false }), /Não há dano temporário/);
  // Rebote com duas opções: com o teste oculto, quem escolhe é o mestre (sem custo de dissonância); o jogador nem vê as opções.
  lia.humorOpcoes = ['indisposto', 'desconfiado'];
  const san2 = lia.sanidade.atual;
  assert.deepEqual(visaoPara(c, ana, 'jogador').personagens.find(p => p.id === ids[0]).humorOpcoes, []);
  assert.throws(() => executar(c, 'humor.definir', { id: ids[0], humor: 'desconfiado' }, { user: ana, mestre: false }), /só escolhe/);
  executar(c, 'humor.definir', { id: ids[0], humor: 'desconfiado' }, ctxM);
  assert.equal(lia.humor, 'desconfiado');
  assert.equal(lia.sanidade.atual, san2);
  assert.deepEqual(lia.humorOpcoes, []);
  // Rebote pelo relacionamento: Lia vê o Rato como Inimigo (espectro C).
  executar(c, 'relacao.definir', { de: ids[0], para: ids[1], tipo: 'Inimigo' }, ctxM);
  rato.subpericias = {};
  // (repete se sair acerto crítico, que sempre passa)
  let m;
  do m = executar(c, 'social.manipular', { autor: ids[1], alvo: ids[0], sub: 'manipulacao.empatia', humor: 'sereno', mod: -200 }, ctxM);
  while (m.sucesso);
  assert.equal(lia.humor, 'raivoso');
  assert.match(m.texto, /Rival \/ Inimigo/);
  // Agressão súbita: atacar um humano que está na conversa custa Humanidade (uma vez).
  executar(c, 'sala.adicionar', { sala: 'social', id: ids[0] }, ctxM);
  executar(c, 'sala.adicionar', { sala: 'social', id: ids[1] }, ctxM);
  const hum = rato.humanidade.atual;
  executar(c, 'social.agredir', { atacante: ids[1], alvo: ids[0] }, ctxM);
  assert.ok(rato.humanidade.atual < hum);
  const hum2 = rato.humanidade.atual;
  executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0] }, ctxM);
  assert.equal(rato.humanidade.atual, hum2, 'só cobra uma vez por cena');
  c.salas.batalha.pendentes = [];

  // No MSA o turno funciona, mas o ataque automático fica desligado.
  executar(c, 'campanha.atualizar', { sistema: 'msa' }, ctxM);
  executar(c, 'combate.iniciar', {}, ctxM);
  assert.equal(c.salas.batalha.combate.ordem.length, 2);
  executar(c, 'combate.proximo', {}, ctxM);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0] }, ctxM), /ainda não existem no MSA/);
  executar(c, 'combate.encerrar', {}, ctxM);
  // A Sala Social vale igual no MSA.
  assert.equal(executar(c, 'social.manipular', { autor: ids[1], alvo: ids[0], sub: 'manipulacao.labia', humor: 'confiante' }, ctxM).tipo, 'manipulacao');
  assert.equal(msa.modulos.combate, false);
  assert.equal(msa.modulos.social, true);
});

test('munição: tiro gasta, recarrega da caixa, cancelar devolve', () => {
  const c = novaCampanha(mestre, { nome: 'Tiros', maxJogadores: 1, nivel: 1, padraoMSA: true, sistema: 'mss' });
  const [a, b] = ['Atiradora', 'Alvo'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of [a, b]) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  executar(c, 'item.adicionar', { id: a, itemId: 'revolver' }, ctxM);
  executar(c, 'item.adicionar', { id: a, itemId: 'municao_pistola' }, ctxM);
  const pa = c.personagens.find(p => p.id === a);
  const arma = pa.itens.find(i => i.itemId === 'revolver');
  assert.equal(arma.carregada, 6, 'vem carregada');
  executar(c, 'item.equipar', { id: a, uid: arma.uid, equipar: true }, ctxM);
  executar(c, 'combate.atacar', { atacante: a, alvo: b, opcoes: { armaUid: arma.uid } }, ctxM);
  assert.equal(arma.carregada, 5);
  // Ataque em área fica esperando a defesa; cancelar devolve a bala.
  const pend = executar(c, 'combate.atacar', { atacante: a, alvo: b, opcoes: { armaUid: arma.uid, area: true } }, ctxM);
  assert.equal(arma.carregada, 4);
  executar(c, 'combate.cancelar', { id: pend.id }, ctxM);
  assert.equal(arma.carregada, 5);
  arma.carregada = 0;
  assert.throws(() => executar(c, 'combate.atacar', { atacante: a, alvo: b, opcoes: { armaUid: arma.uid } }, ctxM), /sem munição/);
  const r = executar(c, 'item.recarregar', { id: a, uid: arma.uid }, ctxM);
  assert.equal(r.carregada, 6);
  assert.equal(pa.itens.find(i => i.tipo === 'municao').quantidade, 6);
  executar(c, 'item.municao', { id: a, uid: arma.uid, delta: -1 }, ctxM);
  assert.equal(arma.carregada, 5);
});

test('XP para vários personagens de uma vez', () => {
  const c = novaCampanha(mestre, { nome: 'XP', maxJogadores: 1, nivel: 1, padraoMSA: true });
  const ids = ['A', 'B'].map(nome => executar(c, 'personagem.criar', { tipo: 'pj', ficha: { nome } }, ctxM).id);
  executar(c, 'xp.dar', { ids, qtd: 150, motivo: 'sessão 1' }, ctxM);
  assert.deepEqual(c.personagens.map(p => p.xp), [150, 150]);
  assert.match(c.log.at(-1).rotulo, /\+150 XP \(sessão 1\)/);
});

test('cadência: Rifle de Assalto dispara 2 vezes (2 danos, cada um menos o IP)', () => {
  const a = lutador('A');
  a.itens = [{ uid: 'r', nome: 'Fuzil', tipo: 'arma', equipado: true, dano: '1d6', pericia: 'armas-de-fogo.rifle-de-assalto', tipoDano: 'Perfuração', alcance: 'distancia' }];
  const b = lutador('B');
  b.itens = [{ uid: 'g', nome: 'Colete', tipo: 'defesa', equipado: true, defesa: 2 }];
  const r = resolverAtaque(a, b, mss, { armaUid: 'r' }, 'nenhuma', seq(d100(90), d10(9), 0.99, 0.99));
  assert.equal(r.disparos.length, 2);
  assert.equal(r.dano, (6 - 2) * 2);
  const um = resolverAtaque(a, b, mss, { armaUid: 'r', disparos: 1 }, 'nenhuma', seq(d100(90), d10(9), 0.99));
  assert.equal(um.disparos.length, 1, 'com 1 bala só, 1 disparo');
});

test('efeitos com tempo andam no fim do turno de quem sofre; o mestre ajusta os turnos', () => {
  const c = novaCampanha(mestre, { nome: 'Efeitos', maxJogadores: 2, nivel: 1, padraoMSA: true });
  const ids = ['Lia', 'Rato'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const [lia, rato] = ids.map(id => c.personagens.find(p => p.id === id));
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  executar(c, 'personagem.atualizar', { id: lia.id, patch: { marcadores: ['Aturdido'] } }, ctxM);
  assert.equal(lia.efeitos.aturdido.turnos, 1);
  executar(c, 'combate.iniciar', {}, ctxM);
  const cb = c.salas.batalha.combate;
  // Passa a vez até a Lia terminar o turno dela.
  while (cb.ordem[cb.vez].id !== lia.id) executar(c, 'combate.proximo', {}, ctxM);
  executar(c, 'combate.proximo', {}, ctxM);
  assert.deepEqual(lia.marcadores, []);
  assert.ok(c.salas.batalha.log.some(e => /Aturdido terminou/.test(e.texto)));

  executar(c, 'personagem.atualizar', { id: rato.id, patch: { marcadores: ['Paralisado'] } }, ctxM);
  assert.equal(rato.efeitos, undefined, 'sem duração no livro');
  executar(c, 'efeito.turnos', { id: rato.id, efeito: 'paralisado', turnos: 3 }, ctxM);
  assert.equal(rato.efeitos.paralisado.turnos, 3);
  assert.throws(() => executar(c, 'efeito.turnos', { id: rato.id, efeito: 'paralisado', turnos: 1 }, { user: ana, mestre: false }));
  executar(c, 'efeito.turnos', { id: rato.id, efeito: 'paralisado', turnos: 0 }, ctxM);
  assert.deepEqual(rato.marcadores, []);
  // Quem não é dono vê os efeitos visíveis de fora (com a contagem), não os outros marcadores.
  rato.marcadores = ['Sangramento', 'Fome'];
  rato.efeitos = { sangramento: { qtd: 1, turnos: 2, perdidos: 0 } };
  const visto = visaoPara(c, ana, 'jogador').personagens.find(p => p.id === rato.id);
  assert.deepEqual(visto.marcadores, ['Sangramento']);
  assert.equal(visto.efeitos.sangramento.turnos, 2);
});

test('defesa surpresa: só a base da Esquiva no corpo a corpo; só nível × 5 contra tiro', () => {
  const a = lutador('A');
  const b = lutador('B');
  b.nivel = 3;
  a.itens = [{ uid: 'p', nome: 'Pistola', tipo: 'arma', equipado: true, dano: '1d6', pericia: 'armas-de-fogo.pistolas', tipoDano: 'Perfuração', alcance: 'distancia' }];
  const corpo = resolverAtaque(a, b, mss, { armaUid: 'desarmado', surpresa: true }, 'nenhuma');
  assert.equal(corpo.nd, 50);
  const tiro = resolverAtaque(a, b, mss, { armaUid: 'p', surpresa: true }, 'nenhuma');
  assert.equal(tiro.nd, 15);
  assert.equal(defesaDoAlvo(b, { uid: 'p', alcance: 'distancia' }, mss).total, 50 + 15);
});

test('cobertura parcial: −30% no ataque a distância; Mira: +30%; Sacrifício só para humanos', () => {
  const a = lutador('Atirador');
  a.itens = [{ uid: 'p', nome: 'Pistola', tipo: 'arma', equipado: true, dano: '1d6', pericia: 'armas-de-fogo.pistolas', tipoDano: 'Perfuração', alcance: 'distancia' },
    { uid: 'f', nome: 'Faca', tipo: 'arma', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', tipoDano: 'Corte', alcance: 'corpo' }];
  const b = lutador('Alvo');
  const mod = (r, nome) => r.mods.find(m => m.nome === nome)?.valor ?? 0;
  const tiro = resolverAtaque(a, b, mss, { armaUid: 'p', cobertura: true, mira: true }, 'nenhuma', seq(0.5));
  assert.equal(mod(tiro, 'cobertura parcial do alvo'), -30);
  assert.equal(mod(tiro, 'Mira'), 30);
  assert.equal(mod(resolverAtaque(a, b, mss, { armaUid: 'f', cobertura: true }, 'nenhuma', seq(0.5)), 'cobertura parcial do alvo'), 0, 'cobertura só contra tiro');
  assert.equal(mod(resolverAtaque(a, b, mss, { armaUid: 'f', sacrificio: true }, 'nenhuma', seq(0.5)), 'Sacrifício'), 10);
  const fera = lutador('Fera', { criatura: true, tipoCriatura: 'besta' });
  fera.itens = a.itens;
  assert.equal(mod(resolverAtaque(fera, b, mss, { armaUid: 'f', sacrificio: true }, 'nenhuma', seq(0.5)), 'Sacrifício'), 0, 'não humano não usa Sacrifício');
});

test('ataque em área: círculo, cone (7 quadrados no cone de 4,5 m do livro) e linha; área tirada do texto da arma', async () => {
  const A = await import('../shared/area.js');
  const cone = A.quadradosDaArea({ forma: 'cone', metros: 4.5, origem: { col: 5, lin: 5, lado: 1 }, ponto: { x: 9.5, y: 5.5 } });
  assert.equal(cone.size, 7);
  assert.equal(A.quadradosDaArea({ forma: 'linha', metros: 9, origem: { col: 5, lin: 5, lado: 1 }, ponto: { x: 9.5, y: 5.5 } }).size, 6);
  assert.equal(A.quadradosDaArea({ forma: 'circulo', metros: 3, ponto: { x: 5.2, y: 5.7 } }).size, 13);
  // Criatura grande (2×2) é atingida se qualquer quadrado dela estiver na área.
  const pecas = { g: { col: 8, lin: 3 }, p: { col: 0, lin: 0 } };
  const pers = [{ id: 'g', tamanho: 'Grande' }, { id: 'p', tamanho: 'Médio' }];
  assert.deepEqual(A.atingidosPelaArea(cone, pecas, pers), ['g']);
  assert.deepEqual(A.areaDoTexto('Granada: explode em raio de 3m'), { forma: 'circulo', metros: 3 });
});

test('defesa desarmada vale contra arma natural; Ferida aberta dura 4 turnos e um novo acerto renova', async () => {
  const b = lutador('Alvo');
  const garra = { uid: 'g', alcance: 'corpo', natural: true };
  assert.ok(opcoesDefesa(b, garra, mss).some(o => o.id === 'defesa-desarmada'));
  assert.ok(!opcoesDefesa(b, { uid: 'f', alcance: 'corpo' }, mss).some(o => o.id === 'defesa-desarmada'), 'arma comum continua sem defesa desarmada');
  const { sincronizarEfeitos, passarTurnoEfeitos } = await import('../shared/efeitos.js');
  b.marcadores = ['Ferida aberta'];
  sincronizarEfeitos(b, mss);
  assert.equal(b.efeitos['ferida-aberta'].turnos, 4);
  passarTurnoEfeitos(b, mss); passarTurnoEfeitos(b, mss);
  assert.equal(b.efeitos['ferida-aberta'].turnos, 2);
  sincronizarEfeitos(b, mss, { reiniciar: ['ferida-aberta'] });
  assert.equal(b.efeitos['ferida-aberta'].turnos, 4, 'novo acerto renova');
  for (let i = 0; i < 4; i++) passarTurnoEfeitos(b, mss);
  assert.ok(!(b.marcadores || []).includes('Ferida aberta'), 'acaba depois de 4 turnos');
});
