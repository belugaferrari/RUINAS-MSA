// Tabela de mutações do autor (26/10): controlada só com o benefício; descontrolada e temporária com benefício e ônus;
// sorteio da mutação temporária quando falha o teste dos marcadores genéticos; o Mutante escolhe as dele; DS 10 da descontrolada.
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

const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}
function umPersonagem(sis = 'mss') {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: sis });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Rui' } }, ctxM).id;
  const p = c.personagens.find(x => x.id === id);
  p.donoId = ana.id;
  return { c, p };
}

test('a tabela tem as 100 mutações (MSA e MSS); benefício e ônus leem no formato do app', () => {
  for (const id of ['msa', 'mss']) {
    const s = sistema(id);
    assert.equal(s.mutacoes.length, 100);
    assert.deepEqual(s.mutacoes.map(m => m.n), Array.from({ length: 100 }, (_, i) => i + 1));
  }
});

test('controlada aplica só o benefício; descontrolada aplica benefício e ônus (Cabeça de mosca)', () => {
  const { c, p } = umPersonagem();
  const sis = sistema('mss');
  const antes = R.derivados(p, sis).atributos;
  executar(c, 'mutacao.adicionar', { id: p.id, n: 13, tipo: 'controlada' }, ctxM);
  let d = R.derivados(p, sis).atributos;
  assert.equal(d.PER, antes.PER + 2);
  assert.equal(d.INT, antes.INT);
  executar(c, 'mutacao.tipo', { id: p.id, mutacao: p.mutacoes[0].id, tipo: 'descontrolada' }, ctxM);
  d = R.derivados(p, sis).atributos;
  assert.equal(d.PER, antes.PER + 2);
  assert.equal(d.INT, antes.INT - 2);
  assert.equal(d.CAR, antes.CAR - 2);
  executar(c, 'mutacao.remover', { id: p.id, mutacao: p.mutacoes[0].id }, ctxM);
  assert.equal(R.derivados(p, sis).atributos.INT, antes.INT);
});

test('falhou no teste dos marcadores genéticos: a mutação temporária é sorteada na tabela', () => {
  const { c, p } = umPersonagem();
  p.tipo = 'pj';
  p.marcadores = ['Marcador genético', 'Marcador genético'];
  const r = comDados(0, () => executar(c, 'descanso.fazer', { tipo: 'longo', ids: [p.id] }, ctxM));
  assert.match(r.linhas[0], /MUTAÇÃO TEMPORÁRIA: 1\. Antena de Peixe-Lanterna/);
  assert.deepEqual(p.mutacoes.map(x => [x.n, x.tipo]), [[1, 'temporaria']]);
  assert.equal(p.mutacoesSofridas, 1);
});

test('o Mutante (nível 3+) escolhe 1 controlada e 1 descontrolada; quem não é Mutante não escolhe', () => {
  const { c, p } = umPersonagem();
  assert.throws(() => executar(c, 'mutacao.adicionar', { id: p.id, n: 5, tipo: 'controlada' }, ctxA), /Mutante/);
  const cl = sistema('mss').classes.find(x => x.nome === 'Mutante');
  Object.assign(p, { classe: cl.id, nivel: 3 });
  executar(c, 'mutacao.adicionar', { id: p.id, n: 5, tipo: 'controlada' }, ctxA);
  executar(c, 'mutacao.adicionar', { id: p.id, n: 42, tipo: 'descontrolada' }, ctxA);
  assert.throws(() => executar(c, 'mutacao.adicionar', { id: p.id, n: 7, tipo: 'controlada' }, ctxA), /já tem/);
  assert.throws(() => executar(c, 'mutacao.adicionar', { id: p.id, tipo: 'temporaria' }, ctxA));
  assert.ok(R.listaHabilidades(p, sistema('mss')).some(x => x.nome === 'Músculos Infláveis' && x.mutacao.tipo === 'descontrolada'));
});

test('mutação descontrolada: DS 10 num teste deixa o próximo teste com desvantagem', () => {
  const { c, p } = umPersonagem();
  executar(c, 'mutacao.adicionar', { id: p.id, n: 42, tipo: 'descontrolada' }, ctxM);
  comDados(0.95, () => executar(c, 'rolar', { id: p.id, acaoRef: 'sub:esportes.corrida', nd: 70 }, ctxM));
  assert.ok(p.marcas.some(m => m.desvantagem));
  const t = executar(c, 'rolar', { id: p.id, acaoRef: 'sub:esportes.corrida', nd: 70 }, ctxM);
  assert.match(t.rotulo, /desvantagem — mutação descontrolada/);
});

test('fora do combate, a desvantagem da mutação descontrolada vale só no teste seguinte', () => {
  const { c, p } = umPersonagem();
  executar(c, 'mutacao.adicionar', { id: p.id, n: 42, tipo: 'descontrolada' }, ctxM);
  comDados(0.95, () => executar(c, 'rolar', { id: p.id, acaoRef: 'sub:esportes.corrida', nd: 70 }, ctxM));
  comDados(0.5, () => executar(c, 'rolar', { id: p.id, acaoRef: 'sub:esportes.corrida', nd: 70 }, ctxM));
  assert.ok(!(p.marcas || []).some(m => m.desvantagem));
});
