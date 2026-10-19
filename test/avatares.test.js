import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATARES, GRUPOS_AVATAR, svgAvatar } from '../shared/avatares.js';

test('avatares prontos: ~100, ids únicos, todos os grupos e SVG sem valores quebrados', () => {
  assert.ok(AVATARES.length >= 100);
  assert.equal(new Set(AVATARES.map(a => a.id)).size, AVATARES.length);
  for (const [g] of GRUPOS_AVATAR) assert.ok(AVATARES.some(a => a.grupo === g), `grupo sem avatar: ${g}`);
  for (const a of AVATARES) {
    const s = svgAvatar(a);
    assert.match(s, /^<svg [^>]*viewBox="0 0 128 128"/);
    assert.doesNotMatch(s, /NaN|undefined/, a.id);
  }
  assert.ok(AVATARES.some(a => a.genero === 'feminino') && AVATARES.some(a => a.genero === 'masculino'));
});

test('restrição de movimento: preso (deslocamento 0), restrito (anda menos) e carga', async () => {
  const { restricaoMovimento } = await import('../shared/efeitos.js');
  const sis = { condicoes: [{ id: 'paralisado', nome: 'Paralisado', movimento: 'preso' }, { id: 'caido', nome: 'Caído', movimento: 'restrito' }, { id: 'dor', nome: 'Dor' }] };
  assert.equal(restricaoMovimento({ marcadores: ['Dor'] }, sis).nivel, null);
  assert.deepEqual(restricaoMovimento({ marcadores: ['Caído'] }, sis), { nivel: 'restrito', motivos: ['Caído'] });
  assert.equal(restricaoMovimento({ marcadores: ['Caído', 'Paralisado'] }, sis).nivel, 'preso');
  assert.deepEqual(restricaoMovimento({ marcadores: [] }, sis, { cargaNivel: 'sobrecarregado' }), { nivel: 'restrito', motivos: ['Sobrecarregado'] });
});

test('regras gerais: deslocamento, PV persistentes/permanentes, descanso e Esmagado', async () => {
  const R = await import('../shared/regras.js');
  const { descansar, cargaNoTurno } = await import('../shared/efeitos.js');
  const sis = { raca: { deslocamento: '9m (6 quadrados)' }, condicoes: [
    { id: 'membros-inferiores', nome: 'Dano a membros inferiores', movimento: 'restrito' }, { id: 'paralisado', nome: 'Paralisado', movimento: 'preso' },
    { id: 'dor', nome: 'Dor', terminaNoDescanso: true }, { id: 'esmagado', nome: 'Esmagado', movimento: 'preso', esmagado: true }] };
  const cond = m => R.condicoesAtivas({ marcadores: m }, sis);
  assert.deepEqual([R.deslocamento(sis, [], 'normal').deslocamento, R.deslocamento(sis, [], 'normal').deslocamentoQuadrados], [9, 6]);
  assert.equal(R.deslocamento(sis, cond(['Dano a membros inferiores']), 'sobrecarregado').deslocamento, 1.5);
  assert.equal(R.deslocamento(sis, cond(['Paralisado']), 'normal').deslocamento, 0);
  assert.equal(R.deslocamento(sis, [], 'supercarregado').deslocamento, 1.5);
  // Descanso: longo = 1d4 × nível (com rng fixo: cada d4 = 4), sem passar do máximo; termina Dor; recarrega capacidades.
  const p = { nivel: 2, pv: { max: 20, atual: 5 }, sanidade: { max: 30, atual: 10 }, marcadores: ['Dor'], capacidadesUsadas: { x: 1 } };
  const notas = descansar(p, sis, 'longo', 20, () => 0.99);
  assert.equal(p.pv.atual, 13);
  assert.equal(p.sanidade.atual, 12);
  assert.deepEqual(p.marcadores, []);
  assert.deepEqual(p.capacidadesUsadas, {});
  assert.ok(notas.some(n => /Dor terminou/.test(n)));
  descansar(p, sis, 'curto', 14);
  assert.equal(p.pv.atual, 14);
  descansar(p, sis, 'curto', 14);
  assert.equal(p.pv.atual, 14, 'não passa do máximo (com PV persistentes)');
  // Esmagado: 1 PV a cada 20 kg acima do levantamento (mínimo 1).
  const q = { pv: { max: 20, atual: 20 } };
  cargaNoTurno(q, { condicoes: cond(['Esmagado']), carga: 150, cargaLevantamento: 80, cargaNivel: 'supercarregado' });
  assert.equal(q.pv.atual, 17);
  const r = {};
  assert.match(cargaNoTurno(r, { condicoes: [], carga: 100, cargaLevantamento: 80, cargaNivel: 'supercarregado' })[0], /teste de FOR muito difícil/);
  assert.match(cargaNoTurno(r, { condicoes: [], carga: 100, cargaLevantamento: 80, cargaNivel: 'supercarregado' })[0], /5% difícil/);
});
