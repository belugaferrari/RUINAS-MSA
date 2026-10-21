import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const { novaCampanha, executar } = await import('../server/actions.js');
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

// ---------- Habilidades de ativar, cargas e ofertas (servidor) ----------
const mestre = { id: 'm', name: 'Mestre' };
const ctxM = { user: mestre, mestre: true };
function campanhaCom(...fichas) {
  const c = novaCampanha(mestre, { nome: 'Teste', maxJogadores: 2, nivel: 1, padraoMSA: true, sistema: 'mss' });
  const ids = fichas.map(f => {
    const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: f.nome } }, ctxM).id;
    const p = c.personagens.find(x => x.id === id);
    const { id: _ignora, ...resto } = f;
    Object.assign(p, resto);
    return id;
  });
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  return { c, ids, p: id => c.personagens.find(x => x.id === id) };
}

test('Núcleo energético: cargas = 3 + MOD CONS, gastas no ataque e na Aceleração Sináptica; voltam no descanso longo', () => {
  const f = comGanho('Aceleração Sináptica');
  f.atributos.CONS = 14; // MOD +2 → 5 cargas
  f.coracaoArtificial = true;
  const { c, ids, p } = campanhaCom(f, alvoSimples({ nome: 'Alvo' }));
  const eu = p(ids[0]);
  const hab = listaHabilidades(eu, mss).find(x => x.nome === 'Aceleração Sináptica');
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab.id }, ctxM);
  assert.equal(eu.recursos.nucleo, 2);
  assert.ok(eu.ativas.includes(hab.id));
  assert.equal(derivados(eu, mss).atributos.FOR, (eu.atributos.FOR ?? 0) + 2);
  assert.ok(vantagemPorHabilidade(eu, mss, ['sentidos.visao']));
  // 3 turnos dele: no fim do 3º acaba e toma 2d4.
  const pv = eu.pv.atual;
  for (let i = 0; i < 6; i++) {
    const cb = c.salas.batalha.combate;
    if (cb.ordem[cb.vez].id !== eu.id) executar(c, 'combate.proximo', {}, ctxM);
    else executar(c, 'combate.proximo', {}, ctxM);
  }
  assert.ok(!eu.ativas.includes(hab.id));
  assert.ok(eu.pv.atual <= pv - 2 && eu.pv.atual >= pv - 8);
  executar(c, 'habilidade.recurso', { id: eu.id, recurso: 'nucleo' }, ctxM);
  assert.equal(eu.recursos.nucleo, 3);
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [eu.id] }, ctxM);
  assert.ok(!eu.recursos?.nucleo);
});

test('Carga de Emergência: precisa de bateria, 1 vez por descanso longo, PV temporários absorvem dano e somem no fim do combate', () => {
  const f = alvoSimples({ nome: 'Ciborgue', classe: mss.classes.find(x => x.nome === 'Ciborgue').id, nivel: 3 });
  const v = mss.classes.find(x => x.nome === 'Ciborgue').vantagens.find(x => x.nome === 'Carga de Emergência');
  f.vantagens = [`${f.classe}/${v.id}`];
  const { c, ids, p } = campanhaCom(f, alvoSimples({ nome: 'Alvo' }));
  const eu = p(ids[0]);
  const hab = listaHabilidades(eu, mss).find(x => x.nome === 'Carga de Emergência');
  assert.ok(hab, 'vantagem de classe na lista');
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab.id }, ctxM), /bateria/);
  eu.itens = [{ uid: 'b1', nome: 'Bateria pequena', tipo: 'diverso' }];
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab.id }, ctxM);
  assert.ok(eu.pvTemp >= 2 && eu.pvTemp <= 12);
  const temp = eu.pvTemp, pv = eu.pv.atual;
  aplicarAtaque(p(ids[1]), eu, { sucesso: true, dano: temp + 1 }, mss);
  assert.equal(eu.pv.atual, pv - 1);
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab.id }, ctxM); // desativa
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab.id }, ctxM), /já foi usada/);
});

test('Essência monstruosa: monstro abatido dá o atributo mais alto dele até o fim do combate', () => {
  const cl = mss.classes.find(x => x.nome === 'Caçador');
  const v = cl.vantagens.find(x => x.nome === 'Essência monstruosa');
  const f = alvoSimples({ nome: 'Caçador', classe: cl.id, nivel: 3, vantagens: [`${cl.id}/${v.id}`] });
  const monstro = alvoSimples({ nome: 'Fera', tipoCriatura: 'besta', pv: { max: 20, atual: 0 } });
  monstro.atributos = { ...monstro.atributos, CONS: 18 };
  f.atributos.CONS = 20; // iguala mesmo sendo menor (autor, 21/10)
  const { c, ids, p } = campanhaCom(f, monstro);
  const eu = p(ids[0]);
  const hab = listaHabilidades(eu, mss).find(x => x.nome === 'Essência monstruosa');
  const hum = eu.humanidade.atual;
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab.id, alvo: ids[1] }, ctxM);
  assert.equal(derivados(eu, mss).atributos.CONS, 18);
  assert.ok(eu.humanidade.atual < hum);
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.ok(!eu.essencia);
});

test('Quebra-Hordas oferece ataque extra contra outra criatura da mesma raça, uma vez por turno', () => {
  const cl = mss.classes.find(x => x.nome === 'Caçador');
  const v = cl.vantagens.find(x => x.nome === 'Quebra-Hordas');
  const f = alvoSimples({ nome: 'Caçadora', classe: cl.id, nivel: 3, vantagens: [`${cl.id}/${v.id}`] });
  f.atributos.FOR = 18;
  const caes = [1, 2].map(n => alvoSimples({ nome: `Cão das Ruínas ${n}`, tipoCriatura: 'animal', raca: 'Cão das Ruínas' }));
  caes.push(alvoSimples({ nome: 'Cão das Ruínas 3', tipoCriatura: 'animal' })); // sem raça na ficha: não entra
  const { c, ids } = campanhaCom(f, ...caes);
  const s = c.salas.batalha;
  let tentativas = 0;
  while (!(s.ofertas || []).length && tentativas++ < 40) {
    executar(c, 'combate.atacar', { atacante: ids[0], alvo: ids[1], opcoes: { surpresa: true } }, ctxM);
  }
  const of = s.ofertas[0];
  assert.equal(of.tipo, 'quebraHordas');
  assert.deepEqual(of.alvos, [ids[2]]);
  const r = executar(c, 'combate.oferta', { id: of.id, aceitar: true, alvo: ids[2] }, ctxM);
  assert.ok(r.id || r.tipo);
  assert.ok(!(s.ofertas || []).some(o => o.tipo === 'quebraHordas'));
});

test('Civilizados: atacar o Encantado sem ter sido atacado exige WILL% Difícil; quem passa fica com −10%', () => {
  const f = comGanho('Civilizados');
  const inimigo = alvoSimples({ nome: 'Bandido' });
  const { c, ids, p } = campanhaCom(f, inimigo);
  const enc = p(ids[0]), band = p(ids[1]);
  let barrou = 0, passou = false;
  for (let i = 0; i < 40 && !passou; i++) {
    const r = executar(c, 'combate.atacar', { atacante: band.id, alvo: enc.id, opcoes: { surpresa: true } }, ctxM);
    if (r.tipo === 'barrado') barrou++; else passou = true;
  }
  assert.ok(barrou > 0, 'WILL% baixo costuma falhar no Difícil');
  if (passou) assert.equal(derivados(band, mss).percentual.WILL, 4 * band.atributos.WILL - 10);
  // Depois que o Encantado ataca, o adversário ataca sem teste.
  const outro = p(executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Outro' } }, ctxM).id);
  Object.assign(outro, novaFicha(mss), { id: outro.id, nome: 'Outro', pv: { max: 30, atual: 30 } });
  executar(c, 'sala.adicionar', { sala: 'batalha', id: outro.id }, ctxM);
  executar(c, 'combate.atacar', { atacante: enc.id, alvo: outro.id, opcoes: { surpresa: true } }, ctxM);
  const r = executar(c, 'combate.atacar', { atacante: outro.id, alvo: enc.id, opcoes: { surpresa: true } }, ctxM);
  assert.notEqual(r.tipo, 'barrado');
  assert.ok(!outro.onusCivilizado);
});
