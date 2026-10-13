import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rolarDado, novaFicha, pontosGastos, podeEquipar, derivados, gerarEncontro } from '../shared/regras.js';

const sistema = JSON.parse(fs.readFileSync(new URL('../conteudo/sistema.json', import.meta.url)));

test('rolarDado respeita quantidade, faces e modificador', () => {
  const r = rolarDado('3d6+2', () => 0.999);
  assert.deepEqual(r.dados, [6, 6, 6]);
  assert.equal(r.total, 20);
  assert.throws(() => rolarDado('abc'));
});

test('ficha nova não gasta pontos', () => {
  const f = novaFicha(sistema, { nivel: 3 });
  assert.equal(f.nivel, 3);
  assert.deepEqual(pontosGastos(f, sistema), { atributos: 0, vantagens: 0, pericias: 0 });
});

test('slots impedem sobreposição e itens de duas mãos ocupam duas vagas', () => {
  const f = novaFicha(sistema, {});
  const item = id => ({ ...sistema.itens.find(i => i.id === id), equipado: false });
  const machado = { ...item('machado'), equipado: true };
  f.itens = [machado];
  assert.equal(podeEquipar(f, item('faca'), sistema).ok, false);
  f.itens = [{ ...item('capacete'), equipado: true }];
  assert.equal(podeEquipar(f, item('capacete'), sistema).ok, false);
  assert.equal(podeEquipar(f, item('anel'), sistema).ok, true);
  assert.equal(podeEquipar(f, item('corda'), sistema).ok, false);
});

test('bônus de itens equipados entram nos valores finais', () => {
  const f = novaFicha(sistema, {});
  f.itens = [{ ...sistema.itens.find(i => i.id === 'anel'), equipado: true }, { ...sistema.itens.find(i => i.id === 'gibao'), equipado: true }];
  const d = derivados(f, sistema);
  assert.equal(d.atributos.Carisma, f.atributos.Carisma + 1);
  assert.equal(d.atributos.Destreza, f.atributos.Destreza - 1);
  assert.equal(d.defesa, 2);
});

test('encontro aleatório não passa do limite', () => {
  for (let i = 0; i < 50; i++) {
    const { soma } = gerarEncontro(sistema.monstros, 7);
    assert.ok(soma <= 7);
  }
});
