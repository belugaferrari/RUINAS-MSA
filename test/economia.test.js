// Itens e economia pelo livro (Bloco 5): negociação com comerciante, moedas, encontro de itens e auras de Criação e manutenção.
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
function campo() {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [a, b] = ['Eu', 'Ele'].map(nome => { const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id; return c.personagens.find(p => p.id === id); });
  a.tipo = 'pj';
  return { c, a, b };
}
function comDados(valor, fn) { const antes = Math.random; Math.random = () => valor; try { return fn(); } finally { Math.random = antes; } }

test('preços do comerciante: vende pelo base e compra pela metade; negociação passiva 1/4 (até 25%) — exemplo do livro', () => {
  assert.deepEqual(R.precosComerciante({ preco: 100 }, 15), { compra: 85, venda: 65 });
  assert.deepEqual(R.precosComerciante({ preco: 100 }, 0), { compra: 100, venda: 50 });
  assert.equal(R.MOEDAS.find(m => m.id === 'Au').valor, 500);
});

test('comprar com negociação ativa: passou 25% mais barato; vender: metade', () => {
  const { c, a } = campo();
  const it = mss.itens.find(i => i.preco >= 40);
  a.dinheiro = 1000;
  const r = comDados(0.99, () => executar(c, 'item.comprar', { id: a.id, itemId: it.id, negociar: true }, ctxM));
  assert.equal(r.preco, Math.round(it.preco * 0.75));
  const v = executar(c, 'item.vender', { id: a.id, uid: a.itens.at(-1).uid }, ctxM);
  assert.equal(v.valor, R.precosComerciante(it, R.bonusNegociacao(a, mss)).venda);
});

test('encontro de itens: 1 por descanso longo; numa Ruína também no curto; o mestre sorteia', () => {
  const { c, a } = campo();
  const ctxJ = { user: { id: 'j' }, mestre: false };
  a.donoId = 'j';
  assert.throws(() => executar(c, 'item.procurar', { id: a.id }, ctxJ), /descanso/);
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [a.id] }, ctxM);
  executar(c, 'item.procurar', { id: a.id }, ctxJ);
  assert.throws(() => executar(c, 'item.procurar', { id: a.id }, ctxJ), /esperando|usou/);
  const antes = a.itens.length;
  const r = executar(c, 'item.encontro', { pedido: c.pedidosItem[0].id, complexidade: 'complexo' }, ctxM);
  assert.equal(a.itens.length, antes + 1);
  assert.match(r.texto, /encontrou/);
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [a.id] }, ctxM);
  assert.ok(!(a.procuraItem > 0), 'fora da Ruína o curto não dá procura');
  executar(c, 'campanha.ruina', { emRuina: true }, ctxM);
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [a.id] }, ctxM);
  assert.equal(a.procuraItem, 1);
});

test('auras de Criação e manutenção: Afiado +1 de dano; Melhorado +5%; Sortudo rerola o erro e se gasta', () => {
  const { a, b } = campo();
  a.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo', aura: { id: 'afiado', nome: 'Afiado' } }];
  const r = comDados(0.9, () => C.resolverAtaque(a, b, mss, { armaUid: 'f', surpresa: true }));
  assert.ok(r.danoPartes.some(x => /Afiado/.test(x.nome)));
  a.itens[0].aura = { id: 'melhorado', nome: 'Melhorado' };
  assert.ok(C.resolverAtaque(a, b, mss, { armaUid: 'f' }).mods.some(m => /Melhorado/.test(m.nome) && m.valor === 5));
  a.itens[0].aura = { id: 'sortudo', nome: 'Sortudo' };
  const seq = [0.03, 0.5, 0.99, 0.5];
  let i = 0;
  const s = C.resolverAtaque(a, b, mss, { armaUid: 'f' }, 'nenhuma', () => seq[Math.min(i++, seq.length - 1)]);
  assert.ok(s.sortudo);
  assert.equal(a.itens[0].aura, undefined);
});
