// Relatório de Habilidades (respostas do autor em 30/10, linhas 104–121): Perito (vantagens) e Soldado.
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
const C = await import('../shared/combate.js');
const { requisitosQueFaltam } = await import('../shared/requisitos.js');

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };

function campo(nomes = ['Eu', 'Ele']) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = nomes.map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  return { c, ps: ids.map(id => c.personagens.find(p => p.id === id)) };
}
const comClasse = (p, classe, esp, nivel = 20) => {
  const cl = mss.classes.find(x => x.nome === classe);
  Object.assign(p, { classe: cl.id, especializacao: cl.especializacoes.find(e => e.nome.startsWith(esp)).id, nivel });
};
const vantagem = (p, classe, nome) => {
  const cl = mss.classes.find(x => x.nome === classe);
  (p.vantagens ||= []).push(`${cl.id}/${cl.vantagens.find(v => v.nome === nome).id}`);
};
const hab = (p, nome) => R.listaHabilidades(p, mss).find(x => x.nome === nome);
const minhaVez = (c, p) => { const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === p.id); };
const novoTurno = c => { delete c.salas.batalha.combate.gasto; };
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}
const pistola = (extra = {}) => ({ uid: 'pst', nome: 'Pistola velha', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d6', tipoDano: 'Perfuração', pericia: 'armas-de-fogo.pistolas', alcance: 'distancia', ...extra });

test('pré-requisitos: aviso ao equipar; −30% e sem crítico; errou, a arma trava; Mestre de Armas: −15% e não trava', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.atributos = { ...eu.atributos, DES: 10 };
  eu.itens = [{ ...pistola({ requisitos: 'DES 14' }), equipado: false }];
  assert.deepEqual(requisitosQueFaltam(eu, mss, eu.itens[0]), ['DES 14']);
  const r = executar(c, 'item.equipar', { id: eu.id, uid: 'pst', equipar: true }, ctxM);
  assert.match(r.aviso, /pré-requisitos/);
  const ataque = comDados(0.5, () => C.resolverAtaque(eu, ele, mss, { armaUid: 'pst' }));
  assert.ok(ataque.mods.some(m => m.valor === -30 && /pré-requisito/.test(m.nome)));
  minhaVez(c, eu);
  comDados(0.02, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'pst' } }, ctxM));
  assert.ok(eu.itens[0].travado, 'errou sem pré-requisito: travou');
  comClasse(eu, 'Soldado', 'COMANDANTE', 3);
  delete eu.itens[0].travado;
  const m = comDados(0.5, () => C.resolverAtaque(eu, ele, mss, { armaUid: 'pst' }));
  assert.ok(m.mods.some(x => x.valor === -15));
  assert.equal(m.travaSeErrar, false);
});

test('Defesa Total: ação principal, +20% nas defesas (não contra surpresa); Movimento Preditivo +10% e imune a crítico', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(ele, 'Perito', 'O ARTISTA', 3);
  vantagem(ele, 'Perito', 'Movimento Preditivo');
  minhaVez(c, ele);
  const arma = { uid: 'desarmado', alcance: 'corpo', pericia: 'briga.ataque-desarmado' };
  const antes = C.defesaDoAlvo(ele, arma, mss, { escolha: 'nenhuma', atacante: eu }).total;
  executar(c, 'combate.defesaTotal', { id: ele.id }, ctxM);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: ele.id, alvo: eu.id, opcoes: {} }, ctxM), /principal/);
  assert.equal(C.defesaDoAlvo(ele, arma, mss, { escolha: 'nenhuma', atacante: eu }).total, antes + 30);
  const surp = C.defesaDoAlvo(ele, arma, mss, { escolha: 'nenhuma', atacante: eu, surpresa: true });
  assert.ok(!surp.partes.some(p => /Defesa Total|Preditivo/.test(p.nome)));
  const r = comDados(0.99, () => C.resolverAtaque(eu, ele, mss, { surpresa: true }));
  assert.ok(r.semCritico);
});

test('Liderança inspiradora: aliado de pé dá +1d20 no acerto; caído, desvantagem; Salvaguarda com vantagem', () => {
  const { c, ps: [lider, aliado, inimigo] } = campo(['Líder', 'Aliado', 'Inimigo']);
  comClasse(lider, 'Soldado', 'COMANDANTE', 18);
  for (const x of [lider, aliado]) x.tipo = 'pj';
  minhaVez(c, aliado);
  const p1 = comDados(0.5, () => executar(c, 'combate.atacar', { atacante: aliado.id, alvo: inimigo.id, opcoes: { surpresa: true } }, ctxM));
  assert.ok(/Liderança inspiradora/.test(p1.detalhe));
  novoTurno(c);
  lider.pv.atual = 0; lider.marcadores = ['Desmaiado'];
  // Sem surpresa (a vantagem da surpresa anularia a desvantagem): o inimigo não se defende.
  const pend = executar(c, 'combate.atacar', { atacante: aliado.id, alvo: inimigo.id, opcoes: {} }, ctxM);
  const p2 = comDados(0.5, () => executar(c, 'combate.defender', { id: pend.id, defesa: 'nenhuma' }, ctxM));
  assert.ok(/desvantagem \(o líder/.test(p2.detalhe));
  lider.pv.atual = 10; lider.marcadores = [];
  const t = executar(c, 'rolar', { id: aliado.id, acaoRef: 'sub:briga.salvaguardar', nd: 70 }, ctxM);
  assert.equal(t.modo, 'vantagem');
});

test('Táticas de Esquadrão: o comandante e um aliado atacam o mesmo inimigo na rodada → DS com vantagem', () => {
  const { c, ps: [cmd, aliado, inimigo] } = campo(['Cmd', 'Aliado', 'Inimigo']);
  comClasse(cmd, 'Soldado', 'COMANDANTE', 8);
  for (const x of [cmd, aliado]) x.tipo = 'pj';
  minhaVez(c, cmd);
  const r1 = comDados(0.5, () => executar(c, 'combate.atacar', { atacante: cmd.id, alvo: inimigo.id, opcoes: { surpresa: true } }, ctxM));
  assert.ok(!/Táticas/.test(r1.texto));
  minhaVez(c, aliado);
  const r2 = comDados(0.5, () => executar(c, 'combate.atacar', { atacante: aliado.id, alvo: inimigo.id, opcoes: { surpresa: true } }, ctxM));
  assert.ok(/Táticas de Esquadrão/.test(r2.texto));
});

test('Tropa de elite: com o Comandante de pé, aliados +1,5 m; o Comandante caiu, perdem', () => {
  const { c, ps: [cmd, aliado] } = campo(['Cmd', 'Aliado']);
  comClasse(cmd, 'Soldado', 'COMANDANTE', 16);
  for (const x of [cmd, aliado]) x.tipo = 'pj';
  const base = R.derivados(aliado, mss).deslocamento;
  executar(c, 'combate.proximo', {}, ctxM);
  assert.equal(R.derivados(aliado, mss).deslocamento, base + 1.5);
  cmd.pv.atual = 0; cmd.marcadores = ['Desmaiado'];
  executar(c, 'combate.proximo', {}, ctxM);
  assert.equal(R.derivados(aliado, mss).deslocamento, base);
});

test('Último homem de pé (+1 IP; matou → +1d6 PV temporários), Diagnóstico Letal (+1d6 contra efeito negativo), Predador Invisível', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Soldado', 'GUERRILHEIRO', 15);
  assert.equal(R.derivados(eu, mss).ip.geral, R.derivados({ ...eu, classe: null, especializacao: null }, mss).ip.geral + 1);
  ele.pv.atual = -1;
  eu.itens = [{ uid: 'fc', nome: 'Faca', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d4', tipoDano: 'Corte', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo' }];
  minhaVez(c, eu);
  comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { surpresa: true, armaUid: 'fc' } }, ctxM));
  assert.ok(ele.marcadores.includes('Morto'));
  assert.ok(eu.pvTemp > 0);
  const p = {};
  comClasse(p, 'Perito', 'O ARTISTA', 3);
  vantagem(p, 'Perito', 'Diagnóstico Letal');
  const alvo = { ...ele, pv: { atual: 20, max: 20 }, marcadores: ['Aturdido'] };
  assert.ok(comDados(0.99, () => C.resolverAtaque(p, alvo, mss, { surpresa: true })).danoPartes.some(x => x.nome === 'Diagnóstico Letal'));
  const bo = {};
  comClasse(bo, 'Soldado', 'OPERAÇÕES', 18);
  assert.ok(comDados(0.99, () => C.resolverAtaque(bo, alvo, mss, { surpresa: true })).danoPartes.some(x => /Predador/.test(x.nome)));
});

test('Atirador perspicaz (+5% por erro no mesmo alvo, zera ao acertar) e Tiro Funcional (não letal; objeto pequeno −10%)', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Soldado', 'OPERAÇÕES', 8);
  vantagem(eu, 'Soldado', 'Atirador perspicaz');
  eu.itens = [pistola()];
  minhaVez(c, eu);
  comDados(0.02, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'pst' } }, ctxM));
  assert.equal(eu.perspicaz[ele.id], 5);
  novoTurno(c);
  comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'pst' } }, ctxM));
  assert.ok(!eu.perspicaz[ele.id]);
  const r = comDados(0.99, () => C.resolverAtaque(eu, ele, mss, { armaUid: 'pst', naoLetal: true }));
  assert.ok(r.naoLetal);
  ele.itens = [{ uid: 'lam', nome: 'Lampião', equipado: true }];
  const r2 = comDados(0.5, () => C.resolverAtaque(eu, ele, mss, { armaUid: 'pst', localizado: true, local: 'item:lam' }));
  assert.ok(r2.mods.some(m => /Tiro Funcional/.test(m.nome) && m.valor === -10));
});

test('Aprendizado Rápido (+10% na subperícia sem treino por 24 h), Capitão de Campo (+10% Liderança; ordem: ataque com vantagem), Avaliação de Cenário, Arremesso preciso', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Perito', 'O ARTISTA', 3);
  vantagem(eu, 'Perito', 'Aprendizado Rápido');
  const antes = R.derivados(eu, mss).subpericias['ciencia.ocultismo'];
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Aprendizado Rápido').id, escolhas: { sub: 'ciencia.ocultismo' } }, ctxM);
  assert.equal(R.derivados(eu, mss).subpericias['ciencia.ocultismo'], antes + 10);
  executar(c, 'combate.encerrar', {}, ctxM);
  executar(c, 'tempo.passar', { horas: 24 }, ctxM);
  assert.equal(R.derivados(eu, mss).subpericias['ciencia.ocultismo'], antes);

  const { c: c2, ps: [cap, al] } = campo(['Cap', 'Al']);
  const semCap = R.derivados(cap, mss).subpericias['manipulacao.lideranca'];
  comClasse(cap, 'Soldado', 'COMANDANTE', 5);
  assert.equal(R.derivados(cap, mss).subpericias['manipulacao.lideranca'], semCap + 10);
  executar(c2, 'habilidade.ativar', { id: cap.id, hab: hab(cap, 'Capitão de Campo').id, escolhas: { alvo: al.id, ordem: 'ataque' } }, ctxM);
  assert.ok(R.vantagemPorHabilidade(al, mss, ['ataque']));

  const bo = { ...ele, marcas: [] };
  comClasse(bo, 'Soldado', 'OPERAÇÕES', 5);
  c2.personagens.push(bo);
  comDados(0.99, () => executar(c2, 'habilidade.ativar', { id: bo.id, hab: hab(bo, 'Avaliação de Cenário').id }, ctxM));
  assert.ok(R.vantagemPorHabilidade(bo, mss, ['armadilhas.encontrar']));
  assert.ok(C.defesaDoAlvo(bo, { uid: 'desarmado', alcance: 'corpo' }, mss, { surpresa: true }).partes.some(p => p.valor === 20));

  const arr = {};
  comClasse(arr, 'Soldado', 'COMANDANTE', 3);
  const sem = R.derivados(arr, mss).subpericias['esportes.arremessar'];
  vantagem(arr, 'Soldado', 'Arremesso preciso');
  assert.equal(R.derivados(arr, mss).subpericias['esportes.arremessar'], sem + 10);
});
