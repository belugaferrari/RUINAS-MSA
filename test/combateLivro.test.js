// Combate pelo livro (autor, 31/10: "o que está no livro e o app não faz, pode pôr"): Investida para todos, manobras
// (Deslocar, Desarmar, Imobilizar), Entrepor, 5 PV e o Medo, dano não letal, Vibração, queda e combate montado.
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

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };
function campo(nomes = ['Eu', 'Ele', 'Aliado']) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 3, nivel: 1, sistema: 'mss' });
  const ids = nomes.map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  return { c, ps: ids.map(id => c.personagens.find(p => p.id === id)) };
}
const minhaVez = (c, p) => { const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === p.id); if (cb.gasto) delete cb.gasto[p.id]; };
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}
const faca = uid => ({ uid, nome: 'Faca', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo' });

test('Investida (qualquer um): Briga › Investida, +1d4, alvo testa FOR para não cair; ataques contra quem investiu têm vantagem', () => {
  const { c, ps: [eu, ele] } = campo(['Eu', 'Ele']);
  eu.itens = [faca('f')];
  minhaVez(c, eu);
  const r = comDados(0.9, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'f', investida: 4, surpresa: true } }, ctxM));
  assert.match(r.texto, /\(1d4 Investida\)/);
  assert.match(r.texto, /Investida: FOR/);
  assert.equal(comDados(0.5, () => C.resolverAtaque(eu, ele, mss, { armaUid: 'f', investida: 4 })).pericia, 'briga.investida');
  const contra = C.resolverAtaque(ele, eu, mss, { surpresa: true });
  assert.ok(contra.motivosVantagem.some(m => /Investida/.test(m)));
});

test('Deslocar: contra a defesa; passou → 1 de dano e o alvo vai 1,5 m para longe', () => {
  const { c, ps: [eu, ele] } = campo(['Eu', 'Ele']);
  c.mapa = { ...(c.mapa || {}), pecas: { [eu.id]: { col: 5, lin: 5 }, [ele.id]: { col: 6, lin: 5 } } };
  minhaVez(c, eu);
  const pv = ele.pv.atual;
  comDados(0.99, () => executar(c, 'combate.manobra', { id: eu.id, alvo: ele.id, tipo: 'deslocar' }, ctxM));
  assert.equal(ele.pv.atual, pv - 1);
  assert.deepEqual([c.mapa.pecas[ele.id].col, c.mapa.pecas[ele.id].lin], [7, 5]);
});

test('Desarmar: disputa (ninguém ataca com a arma); 2ª fase contra FOR% + 70 → a arma cai', () => {
  const { c, ps: [eu, ele] } = campo(['Eu', 'Ele']);
  ele.itens = [faca('fe')];
  minhaVez(c, eu);
  comDados(0.99, () => executar(c, 'combate.manobra', { id: eu.id, alvo: ele.id, tipo: 'desarmar' }, ctxM));
  assert.equal(eu.disputa?.item, 'fe');
  minhaVez(c, ele);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: ele.id, alvo: eu.id, opcoes: { armaUid: 'fe' } }, ctxM), /disputa/);
  minhaVez(c, eu);
  comDados(0.99, () => executar(c, 'combate.manobra', { id: eu.id, tipo: 'desarmar' }, ctxM));
  assert.equal(ele.itens[0].equipado, false);
  assert.ok(!eu.disputa && !ele.disputa);
});

test('Imobilizar: disputa → Imobilizado (ataques contra com vantagem); preso tenta voltar com FOR pura; só mesmo tamanho ou menor', () => {
  const { c, ps: [eu, ele] } = campo(['Eu', 'Ele']);
  minhaVez(c, eu);
  comDados(0.99, () => executar(c, 'combate.manobra', { id: eu.id, alvo: ele.id, tipo: 'imobilizar' }, ctxM));
  minhaVez(c, eu);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: {} }, ctxM), /disputa/);
  comDados(0.99, () => executar(c, 'combate.manobra', { id: eu.id, tipo: 'imobilizar' }, ctxM));
  assert.ok(ele.marcadores.includes('Imobilizado'));
  assert.ok(C.resolverAtaque(eu, ele, mss, {}).motivosVantagem.some(m => /imobilizado/.test(m)));
  minhaVez(c, ele);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: ele.id, alvo: eu.id, opcoes: {} }, ctxM), /disputa/);
  executar(c, 'combate.soltar', { id: ele.id }, ctxM);
  assert.ok(!ele.marcadores.includes('Imobilizado') && !eu.disputa);
  ele.tamanho = 'Grande';
  minhaVez(c, eu);
  assert.throws(() => executar(c, 'combate.manobra', { id: eu.id, alvo: ele.id, tipo: 'imobilizar' }, ctxM), /tamanho/);
});

test('concentrado não faz manobra', () => {
  const { c, ps: [eu, ele] } = campo(['Eu', 'Ele']);
  eu.marcas = [{ id: 'k', nome: 'Concentrado', concentrado: true }];
  minhaVez(c, eu);
  assert.throws(() => executar(c, 'combate.manobra', { id: eu.id, alvo: ele.id, tipo: 'deslocar' }, ctxM), /concentrado/);
});

test('Entrepor: passou em Salvaguardar → o ataque vai em quem se entrepôs, com vantagem', () => {
  const { c, ps: [eu, ele, aliado] } = campo();
  minhaVez(c, ele);
  const pend = executar(c, 'combate.atacar', { atacante: ele.id, alvo: eu.id, opcoes: {} }, ctxM);
  const r = comDados(0.99, () => executar(c, 'combate.entrepor', { id: aliado.id, pendente: pend.id }, ctxM));
  assert.ok(r.sucesso);
  const p2 = c.salas.batalha.pendentes.find(x => x.id === pend.id);
  assert.equal(p2.alvo, aliado.id);
  assert.equal(p2.opcoes.vantagem, true);
});

test('5 PV ou menos: teste Difícil de WILL contra o Medo; não letal desmaia e acorda com 1 PV depois de 2d4 turnos', () => {
  const { c, ps: [eu] } = campo(['Eu', 'Ele']);
  eu.pv.atual = 8;
  const notas = comDados(0.01, () => C.aplicarAtaque({ pv: { atual: 1 } }, eu, { sucesso: true, dano: 4 }, mss));
  assert.ok(notas.some(n => /Medo: WILL/.test(n)), notas.join(' | '));
  assert.equal(eu.humor, 'amedrontado');
  eu.pv.atual = 2;
  const n2 = comDados(0, () => C.aplicarAtaque({ pv: { atual: 1 } }, eu, { sucesso: true, dano: 3, naoLetal: true }, mss));
  assert.ok(n2.some(n => /acorda com 1 PV em 2 turnos/.test(n)), n2.join(' | '));
  assert.equal(C.sobrevida(eu, mss), null);
  assert.match(C.sobrevida(eu, mss), /acordou/);
  assert.equal(eu.pv.atual, 1);
  assert.ok(!eu.marcadores.includes('Desmaiado'));
});

test('queda: 1d6+1 a cada 3 m; Acrobacia até 3 m zera; IP de Impacto desconta', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  const pv = eu.pv.atual;
  const r = comDados(0.99, () => executar(c, 'dano.queda', { id: eu.id, metros: 3 }, ctxM));
  assert.equal(r.dano, 0, r.texto);
  assert.equal(eu.pv.atual, pv);
  const r2 = comDados(0.5, () => executar(c, 'dano.queda', { id: eu.id, metros: 12, acrobacia: false }, ctxM));
  assert.equal(r2.dano, 4 * 5, r2.texto);
});

test('combate montado: desvantagem no ataque', () => {
  const { ps: [eu, ele] } = campo(['Eu', 'Ele']);
  assert.ok(C.resolverAtaque(eu, ele, mss, { montado: true }).motivosDesvantagem.includes('combate montado'));
  assert.ok(R.derivados(eu, mss));
});
