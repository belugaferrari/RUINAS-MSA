import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const { resolverAtaque, aplicarAtaque, defesaDoAlvo, resistenciaManipulacao, armasDisponiveis, rolarIniciativa } = await import('../shared/combate.js');
const { novaFicha, derivados, listaHabilidades, modoHabilidade, vantagemPorHabilidade, subirPassos, subpericiasDe, testeDMil } = await import('../shared/regras.js');

const mss = sistema('mss');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

// Personagem com a classe e a especialização que dão a habilidade no nível pedido.
function comGanho(nomeGanho, nivelMin = 1) {
  for (const c of mss.classes) for (const e of c.especializacoes) for (const l of e.progressao || []) {
    if (l.nivel >= nivelMin && l.ganhos.some(g => g.toLowerCase().startsWith(nomeGanho.toLowerCase()))) {
      const f = novaFicha(mss);
      Object.assign(f, { id: nomeGanho, nome: nomeGanho, classe: c.id, especializacao: e.id, nivel: l.nivel, pv: { max: 30, atual: 30 } });
      return f;
    }
  }
  throw new Error(`sem ${nomeGanho}`);
}
const alvoSimples = (extra = {}) => Object.assign(novaFicha(mss), { id: 'b', nome: 'B', pv: { max: 30, atual: 30 }, ...extra });

test('Alma de ciborgue: automática, R.MNP +20, imune a Dor, Humanidade máxima −10', () => {
  const p = comGanho('Alma de ciborgue');
  const hab = listaHabilidades(p, mss).find(x => x.nome === 'Alma de ciborgue');
  assert.equal(modoHabilidade(p, mss, hab), 'sempre');
  const d = derivados(p, mss);
  assert.equal(d.habilidades.rmnp, 20);
  assert.deepEqual(d.habilidades.imune, ['Dor']);
  assert.equal(d.humanidadeMax, (mss.humanidade?.maximo ?? 100) - 10);
  const sem = { ...p, classe: null };
  assert.equal(resistenciaManipulacao(p, mss) - resistenciaManipulacao(sem, mss), 20);
});

test('Mente cibernética: vantagem e +15% de defesa só contra drones e autômatos', () => {
  const p = comGanho('Mente cibernética');
  const drone = alvoSimples({ tipoCriatura: 'drone' });
  const humano = alvoSimples();
  assert.ok(vantagemPorHabilidade(p, mss, 'ataque', [drone]));
  assert.ok(!vantagemPorHabilidade(p, mss, 'ataque', [humano]));
  const r = resolverAtaque(p, drone, mss, {}, 'nenhuma', seq(0.5));
  assert.ok(r.motivosVantagem.includes('habilidade'));
  const arma = armasDisponiveis(drone, mss)[0];
  const contraDrone = defesaDoAlvo(p, arma, mss, { escolha: 'esquiva', atacante: drone }).total;
  const contraHumano = defesaDoAlvo(p, arma, mss, { escolha: 'esquiva', atacante: humano }).total;
  assert.equal(contraDrone - contraHumano, 15);
  // Iniciativa com vantagem quando há drone no campo: rola dois d10.
  assert.equal(rolarIniciativa(p, mss, seq(0.1, 0.9), [drone]).dados.length, 2);
  assert.equal(rolarIniciativa(p, mss, seq(0.1, 0.9), [humano]).dados.length, 1);
});

test('Juggernaut: a 1ª vez que o PV ficaria abaixo de 0 fica com 1 PV; depois não', () => {
  const p = comGanho('Juggernaut');
  const atk = alvoSimples();
  aplicarAtaque(atk, p, { sucesso: true, dano: 40 }, mss);
  assert.equal(p.pv.atual, 1);
  p.pv.atual = 5;
  aplicarAtaque(atk, p, { sucesso: true, dano: 40 }, mss);
  assert.equal(p.pv.atual, -35);
});

test('Imune: o efeito de dano Dor não marca quem tem Alma de ciborgue', () => {
  const p = comGanho('Alma de ciborgue');
  const notas = aplicarAtaque(alvoSimples(), p, { sucesso: true, dano: 1, efeito: 'Dor' }, mss);
  assert.ok(!(p.marcadores || []).includes('Dor'));
  assert.ok(notas.some(n => /imune/.test(n)));
});

test('Progressão de dano e arma afiada (só para quem afiou)', () => {
  assert.equal(subirPassos('1d6+2', 1), '1d8+2');
  assert.equal(subirPassos('1d12', 1), '2d6');
  assert.equal(subirPassos('2d20', 3), '2d20');
  const p = comGanho('Ataque afiado', 10);
  const arma = { uid: 'a1', nome: 'Faca', tipo: 'arma', dano: '1d4', pericia: 'arma-branca.lamina', equipado: true, alcance: 'corpo', melhorias: [{ id: 'afiada', nome: 'Afiada', nivel: 2, dono: p.id }] };
  p.itens = [arma];
  assert.equal(armasDisponiveis(p, mss).find(a => a.uid === 'a1').dano, '1d8');
  const outro = alvoSimples({ itens: [arma] });
  assert.equal(armasDisponiveis(outro, mss).find(a => a.uid === 'a1').dano, '1d4');
  assert.equal(listaHabilidades(p, mss).find(x => x.nome === 'Ataque afiado').vezes, 2);
});

test('Zona de Abate ligada: vantagem em Briga › Deslocar', () => {
  const p = comGanho('Zona de Abate');
  const hab = listaHabilidades(p, mss).find(x => x.nome === 'Zona de Abate');
  assert.ok(!vantagemPorHabilidade(p, mss, ['briga.deslocar']));
  p.ativas = [hab.id];
  assert.ok(vantagemPorHabilidade(p, mss, ['briga.deslocar']));
});

test('Receptor Neural libera Sentidos › Ondas só para quem tem', () => {
  const sentidos = mss.pericias.find(x => x.id === 'sentidos');
  const p = comGanho('Receptor Neural');
  assert.ok(subpericiasDe(sentidos, p, mss).some(s => s.id === 'sentidos.ondas'));
  assert.ok(!subpericiasDe(sentidos, alvoSimples(), mss).some(s => s.id === 'sentidos.ondas'));
});

test('Teste D-MIL com vantagem fica com o maior d100', () => {
  const r = testeDMil(40, 70, mss, { modo: 'vantagem', rng: seq(0.1, 0.5, 0.8) });
  assert.deepEqual(r.dados, [11, 51]);
  assert.equal(r.dp, 51);
});
