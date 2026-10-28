// Autor, 27/10: fichas de teste sempre com itens (mesmo com catálogo do mestre sem preço/raridade padronizados) e o
// descanso mostrando os dados da recuperação e os testes dos marcadores, numa entrada por personagem (o dono vê).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, migrarCampanhas } = await import('../server/actions.js');
const { sistema } = await import('../server/sistema.js');
const { db } = await import('../server/db.js');
const { kitDeTeste, fichasDeTeste } = await import('../shared/fichasTeste.js');

const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const armaNoKit = kit => kit.some(i => i.tipo === 'arma' && i.slot === 'maos');

test('kit de teste: catálogo com raridade em minúscula e sem preço ainda dá armas', () => {
  const sis = sistema('mss');
  const baguncado = { ...sis, itens: sis.itens.map(i => ({ ...i, raridade: String(i.raridade || '').toLowerCase(), preco: undefined })) };
  const [f] = fichasDeTeste(baguncado, 6);
  assert.ok(armaNoKit(kitDeTeste(baguncado, f)));
  const semRaridade = { ...sis, itens: sis.itens.map(i => ({ ...i, raridade: '' })) };
  assert.ok(armaNoKit(kitDeTeste(semRaridade, f)));
});

test('ao atualizar, fichas de teste sem arma equipada recebem o kit (já equipado)', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  executar(c, 'teste.fichas', { nivel: 6 }, ctxM);
  const fichas = c.personagens.filter(p => p.fichaTeste);
  for (const p of fichas) p.itens = [];
  c.migracoes = ['fichas-teste-v3'];
  db.campaigns.push(c);
  migrarCampanhas();
  for (const p of fichas) assert.ok(p.itens.some(i => i.tipo === 'arma' && i.equipado), `${p.nome} sem arma equipada`);
});

test('descanso: os dados da recuperação e os testes dos marcadores, numa entrada por personagem', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Rui' } }, ctxM).id;
  const p = c.personagens.find(x => x.id === id);
  Object.assign(p, { tipo: 'pj', donoId: ana.id, nivel: 3, marcadores: ['Marcador de vulnerabilidade', 'Marcador genético'] });
  p.pv.atual = 1;
  if (p.sanidade) p.sanidade.atual = 1;
  const r = executar(c, 'descanso.fazer', { tipo: 'longo', ids: [p.id] }, ctxM);
  const e = c.log.filter(x => x.tipo === 'descanso').at(-1);
  assert.equal(e.personagemId, p.id);
  assert.equal(e.donoId, ana.id);
  const tudo = e.linhas.join(' | ');
  assert.match(tudo, /PV — 3d4 \[\d, \d, \d\] = \d+/);
  if (p.sanidade) assert.match(tudo, /Sanidade — 1d6 \[\d\]/);
  assert.match(tudo, /vulnerabilidade: teste de CONS%: d100 \d+ \+ \d+ = \d+ contra ND \d+/);
  assert.match(tudo, /genético\(s\): teste de CONS%: d100/);
  assert.deepEqual(r.porPersonagem[0].nome, 'Rui');
});

test('ao atualizar, as fichas de teste antigas ("Teste · …", repetidas) viram uma por especialização, sem duplicar', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const sis = sistema('mss');
  const antigas = fichasDeTeste(sis, 7).slice(0, 4).map((f, i) => ({ ...f, id: `old${i}`, nome: `Teste · ${i}`, fichaTeste: undefined, tipo: 'pj', itens: [] }));
  c.personagens.push(...antigas, ...antigas.map(p => ({ ...p, id: `${p.id}b` })));
  c.migracoes = [];
  db.campaigns.push(c);
  migrarCampanhas();
  const total = sis.classes.reduce((s, cl) => s + (cl.especializacoes?.length || 1), 0);
  assert.ok(!c.personagens.some(p => /^Teste · /.test(p.nome)));
  assert.equal(c.personagens.filter(p => p.fichaTeste).length, total);
  assert.ok(c.personagens.filter(p => p.fichaTeste).every(p => p.nivel === 7));
});
