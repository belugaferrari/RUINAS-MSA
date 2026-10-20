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
  assert.equal(q3.pv.atual, 4, 'interrompido: 4d2 = 8, sem Conforto pela armadura: −4');
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

test('empatia natural (regra do app): influência contra R.MNP ajustado, contagem por espectro e passo pelo Neutro', async () => {
  const { empatiaNatural, espectroDoHumor } = await import('../shared/combate.js');
  const fs = await import('node:fs');
  const base = JSON.parse(fs.readFileSync(new URL('../conteudo/sistemas/base.json', import.meta.url)));
  const sis = { atributos: [{ sigla: 'CAR' }], pericias: [], condicoes: [], raca: {}, regras: {}, teste: { passiva: { soma: 50 } }, modulos: { social: true }, social: base.social };
  assert.equal(espectroDoHumor('confiante', sis), 'positivo');
  assert.equal(espectroDoHumor('raivoso', sis), 'negativo');
  assert.equal(espectroDoHumor('neutro', sis), 'neutro');
  const p = (id, car, humor, extra = {}) => ({ id, nome: id, atributos: { CAR: car }, humor, ...extra });
  // CAR 20 → CAR% 80; d100 fixo 50 → influência 130 (sem máscara). R.MNP = 0 + 50 = 50 → todos passam.
  const grupo = [p('a', 20, 'amigavel'), p('b', 20, 'amigavel'), p('c', 20, 'desconfiado'), p('x', 10, 'indisposto'), p('ap', 10, 'apatico'), p('fera', 30, 'raivoso', { criatura: true })];
  const r = empatiaNatural(grupo, sis, { rng: () => 0.495 });
  const de = id => r.resultados.find(y => y.p.id === id);
  assert.equal(de('x').para, 'neutro', 'indisposto (negativo) com 2 positivos × 1 negativo vai para o Neutro');
  assert.equal(de('c').para, 'neutro', 'desconfiado recebe 2 amigáveis: passa pelo Neutro');
  assert.equal(de('a').para, 'neutro', 'amigável recebe 1 positivo (b) e 2 negativos (c, x): o negativo vence, passa pelo Neutro');
  assert.equal(de('ap').mudou, false, 'apático não é afetado');
  assert.ok(!r.resultados.some(y => y.p.id === 'fera'), 'criaturas ficam de fora');
  // Neutro vai direto para o humor vencedor (o que teve mais sucessos: 2 amigáveis × 1 corajoso).
  const g2 = [p('n', 10, 'neutro'), p('a1', 20, 'amigavel'), p('a2', 20, 'amigavel'), p('co', 20, 'corajoso'), p('d', 20, 'desconfiado')];
  const r2 = empatiaNatural(g2, sis, { rng: () => 0.495 });
  assert.equal(r2.resultados.find(y => y.p.id === 'n').para, 'amigavel');
  // Mesmo espectro vencendo: vai direto para o humor vencedor (corajoso → amigável).
  assert.equal(r2.resultados.find(y => y.p.id === 'co').para, 'amigavel');
  // Máscara: emite o aparente com −20; rival +10 no R.MNP do receptor.
  const g3 = [p('m', 10, 'raivoso', { humorAparente: 'confiante' }), p('r', 10, 'neutro')];
  const r3 = empatiaNatural(g3, sis, { relacoes: { r: { m: { tipo: 'Rival' } } }, rng: () => 0.5 });
  const t = r3.resultados.find(y => y.p.id === 'r').testes[0];
  assert.equal(t.humor, 'confiante');
  assert.equal(t.nd, 60);
  assert.equal(t.total, 40 + 51 - 20);
  assert.throws(() => empatiaNatural([grupo[0]], sis));
});
