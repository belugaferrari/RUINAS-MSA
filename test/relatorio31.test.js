// Respostas do autor em 31/10: arremesso pela regra do livro, vantagem em Intuição, ataque de oportunidade e disparada
// (o app só avisa — o mapa não é obrigatório e o mestre interpreta).
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
const minhaVez = (c, p) => { const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === p.id); };
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}

test('arremesso (livro): errou com ND → desvio de 1,5 m a cada 5 pontos; DS 9–10 danifica; Arremesso preciso: a cada 10', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  const r = comDados(0.01, () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.arremessar', nd: 70 }, ctxM));
  const falta = 70 - r.total;
  assert.match(r.texto, new RegExp(`desvia ${String(Math.floor(falta / 5) * 1.5).replace('.', ',')} m`));
  const r2 = comDados(0.95, () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.arremessar', nd: 70 }, ctxM));
  assert.match(r2.texto || '', /danificado/);
  const cl = mss.classes.find(x => x.nome === 'Soldado');
  (eu.vantagens ||= []).push(`${cl.id}/${cl.vantagens.find(v => v.nome === 'Arremesso preciso').id}`);
  const r3 = comDados(0.01, () => executar(c, 'rolar', { id: eu.id, acaoRef: 'sub:esportes.arremessar', nd: 70 }, ctxM));
  assert.match(r3.texto, new RegExp(`desvia ${String(Math.floor((70 - r3.total) / 10) * 1.5).replace('.', ',')} m`));
});

test('Intuição: a vantagem da Avaliação de Cenário vale no teste com a caixa "Intuição" do rolador', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  eu.marcas = [{ id: 'x', nome: 'Avaliação de Cenário', vantagem: ['armadilhas.encontrar', 'intuicao'], cena: true }];
  const sem = executar(c, 'rolar', { id: eu.id, acaoRef: 'per:sentidos', nd: 70 }, ctxM);
  const com = executar(c, 'rolar', { id: eu.id, acaoRef: 'per:sentidos', nd: 70, intuicao: true }, ctxM);
  assert.ok(!sem.modo);
  assert.equal(com.modo, 'vantagem');
});

test('ataque de oportunidade: sair da zona de ameaça só AVISA quem controla o inimigo; aceitar ataca com a reação', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.tipo = 'pj';
  c.mapa = { ...(c.mapa || {}), pecas: { [eu.id]: { col: 5, lin: 5 }, [ele.id]: { col: 6, lin: 5 } } };
  minhaVez(c, eu);
  executar(c, 'mapa.mover', { id: eu.id, col: 3, lin: 5 }, ctxM);
  const of = (c.salas.batalha.ofertas || []).find(o => o.tipo === 'oportunidade');
  assert.ok(of, 'avisou');
  assert.equal(of.personagem, ele.id);
  assert.equal(eu.pv.atual, eu.pv.max, 'não atacou sozinho');
  comDados(0.99, () => executar(c, 'combate.oferta', { id: of.id, aceitar: true }, ctxM));
  assert.equal(c.salas.batalha.combate.gasto[ele.id].reacao, 1);
  // Um passo dentro da zona não gera aviso.
  c.salas.batalha.ofertas = [];
  c.mapa.pecas[eu.id] = { col: 5, lin: 5 };
  executar(c, 'mapa.mover', { id: eu.id, col: 5, lin: 6 }, ctxM);
  assert.ok(!(c.salas.batalha.ofertas || []).some(o => o.tipo === 'oportunidade'));
});

test('Disparada: ação principal e deslocamento em dobro; Extração de emergência +1,5 m e +50% contra ataque de oportunidade', () => {
  const { c, ps: [eu, ele] } = campo();
  const base = R.derivados(eu, mss).deslocamento;
  minhaVez(c, eu);
  executar(c, 'combate.disparada', { id: eu.id }, ctxM);
  assert.equal(R.derivados(eu, mss).deslocamento, base * 2);
  assert.throws(() => executar(c, 'combate.disparada', { id: eu.id }, ctxM), /principal/);
  comClasse(eu, 'Soldado', 'OPERAÇÕES', 15);
  assert.equal(R.derivados(eu, mss).deslocamento, base * 2 + 1.5);
  minhaVez(c, ele);
  const pend = executar(c, 'combate.atacar', { atacante: ele.id, alvo: eu.id, opcoes: { oportunidade: true } }, ctxM);
  const r = comDados(0.5, () => executar(c, 'combate.defender', { id: pend.id, defesa: 'nenhuma' }, ctxM));
  assert.match(r.detalhe, /Extração de emergência 50/);
});
