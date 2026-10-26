import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sincronizarEfeitos, passarTurnoEfeitos, efeitosAoAgir, efeitosVisiveis } from '../shared/efeitos.js';
import { ICONES } from '../public/js/icones.js';

const base = JSON.parse(fs.readFileSync(new URL('../conteudo/sistemas/base.json', import.meta.url)));
const sis = { condicoes: base.condicoes };
const fixo = v => () => v; // rng
const pj = marcadores => ({ nome: 'Lia', pv: { atual: 20, max: 20 }, marcadores });

test('toda condição tem ícone da lista', () => {
  for (const c of base.condicoes) assert.ok(ICONES.includes(c.icone), `${c.id}: ${c.icone}`);
});

test('Aturdido dura 1 turno e sai no fim do turno', () => {
  const p = pj(['Aturdido']);
  sincronizarEfeitos(p, sis);
  assert.equal(p.efeitos.aturdido.turnos, 1);
  const notas = passarTurnoEfeitos(p, sis);
  assert.deepEqual(p.marcadores, []);
  assert.equal(p.efeitos, undefined);
  assert.match(notas[0], /Aturdido terminou/);
});

test('Dor dura 1D4 turnos', () => {
  const p = pj(['Dor']);
  sincronizarEfeitos(p, sis, { rng: fixo(0.99) }); // 4
  assert.equal(p.efeitos.dor.turnos, 4);
  for (let i = 0; i < 3; i++) passarTurnoEfeitos(p, sis);
  assert.deepEqual(p.marcadores, ['Dor']);
  passarTurnoEfeitos(p, sis);
  assert.deepEqual(p.marcadores, []);
});

test('Sangramento: 1 PV a cada 1D4 turnos, até 6 PV; novo Corte reinicia', () => {
  const p = pj(['Sangramento']);
  sincronizarEfeitos(p, sis, { rng: fixo(0) }); // intervalo 1
  passarTurnoEfeitos(p, sis, fixo(0));
  assert.equal(p.pv.atual, 19);
  assert.equal(p.efeitos.sangramento.perdidos, 1);
  sincronizarEfeitos(p, sis, { reiniciar: ['sangramento'], rng: fixo(0) });
  assert.equal(p.efeitos.sangramento.perdidos, 0);
  for (let i = 0; i < 6; i++) passarTurnoEfeitos(p, sis, fixo(0));
  assert.equal(p.pv.atual, 13);
  assert.deepEqual(p.marcadores, []);
});

test('Ferida aberta tira 1 PV ao agir e dura 4 turnos (autor, 26/10)', () => {
  const p = pj(['Ferida aberta']);
  sincronizarEfeitos(p, sis);
  assert.equal(p.efeitos['ferida-aberta'].turnos, 4);
  efeitosAoAgir(p, sis);
  assert.equal(p.pv.atual, 19);
  const v = efeitosVisiveis(p, sis);
  assert.equal(v[0].icone, 'bandage');
  assert.equal(v[0].turnos, 4);
});

test('contador manual vale para efeito sem duração e tirar o marcador apaga o contador', () => {
  const p = pj(['Paralisado']);
  p.efeitos = { paralisado: { qtd: 1, turnos: 2 } };
  sincronizarEfeitos(p, sis);
  assert.equal(p.efeitos.paralisado.turnos, 2);
  passarTurnoEfeitos(p, sis);
  passarTurnoEfeitos(p, sis);
  assert.deepEqual(p.marcadores, []);
  p.marcadores = ['Aturdido']; p.efeitos = { aturdido: { turnos: 1 } };
  p.marcadores = [];
  sincronizarEfeitos(p, sis);
  assert.equal(p.efeitos, undefined);
});
