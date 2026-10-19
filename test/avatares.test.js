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
    { id: 'dor', nome: 'Dor' }, { id: 'esmagado', nome: 'Esmagado', movimento: 'preso', esmagado: true }] };
  const cond = m => R.condicoesAtivas({ marcadores: m }, sis);
  assert.deepEqual([R.deslocamento(sis, [], 'normal').deslocamento, R.deslocamento(sis, [], 'normal').deslocamentoQuadrados], [9, 6]);
  assert.equal(R.deslocamento(sis, cond(['Dano a membros inferiores']), 'sobrecarregado').deslocamento, 1.5);
  assert.equal(R.deslocamento(sis, cond(['Paralisado']), 'normal').deslocamento, 0);
  assert.equal(R.deslocamento(sis, [], 'supercarregado').deslocamento, 1.5);
  // Descanso (livro): longo = 1d4 por nível e 1d6 SAN; −1 PV por dado por critério que falta (mín. 1); marcadores zerados.
  const sisM = { ...sis, teste: { criticoAcerto: 5, criticoErro: 96 }, condicoes: [...sis.condicoes, { id: 'vulnerabilidade', nome: 'Marcador de vulnerabilidade', acumula: true }, { id: 'doenca', nome: 'Doença', acumula: true }] };
  const p = { nivel: 2, pv: { max: 20, atual: 5 }, sanidade: { max: 30, atual: 10 }, marcadores: ['Dor', 'Marcador de vulnerabilidade'], capacidadesUsadas: { x: 1 } };
  const notas = descansar(p, sisM, 'longo', 20, {}, 50, () => 0.99);
  assert.equal(p.pv.atual, 13, '2d4 com dados no máximo = 8');
  assert.equal(p.sanidade.atual, 16, '1d6 de Sanidade');
  assert.deepEqual(p.marcadores, ['Dor'], 'Dor não termina no descanso; marcadores zerados');
  assert.deepEqual(p.capacidadesUsadas, {});
  assert.ok(notas.some(n => /vulnerabilidade/.test(n)));
  const q2 = { nivel: 4, pv: { max: 40, atual: 0 }, itens: [] };
  descansar(q2, sisM, 'longo', 40, { abrigado: false, ergonomico: false }, 0, () => 0);
  assert.equal(q2.pv.atual, 1, '4d4 = 4, −2 por dado = −8: mínimo geral 1');
  const q3 = { nivel: 4, pv: { max: 40, atual: 0 }, itens: [{ tipo: 'defesa', slot: 'corpo', equipado: true }] };
  const n3 = descansar(q3, sisM, 'longo', 40, { interrompido: true }, 0, () => 0.99);
  assert.equal(q3.pv.atual, 6, 'interrompido: 2d4 = 8, sem Conforto pela armadura: −2');
  assert.ok(n3.some(x => /dormiu com proteção/.test(x)));
  descansar(p, sisM, 'curto', 14);
  assert.equal(p.pv.atual, 14);
  descansar(p, sisM, 'curto', 14);
  assert.equal(p.pv.atual, 14, 'não passa do máximo (com PV persistentes)');
  // Esmagado: 1 PV a cada 20 kg acima do levantamento (mínimo 1).
  const q = { pv: { max: 20, atual: 20 } };
  cargaNoTurno(q, { condicoes: cond(['Esmagado']), carga: 150, cargaLevantamento: 80, cargaNivel: 'supercarregado' });
  assert.equal(q.pv.atual, 17);
  const r = {};
  assert.match(cargaNoTurno(r, { condicoes: [], carga: 100, cargaLevantamento: 80, cargaNivel: 'supercarregado' })[0], /teste de FOR muito difícil/);
  assert.match(cargaNoTurno(r, { condicoes: [], carga: 100, cargaLevantamento: 80, cargaNivel: 'supercarregado' })[0], /5% difícil/);
});
