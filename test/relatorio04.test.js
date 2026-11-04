// Relatório de habilidades, 5ª parte (autor, 04/11): Soldado (vantagens), Sortudo (Filhos da Fortuna, Iluminados,
// Universais e vantagens) e Transmorfo (Despertar com usos, Coletor).
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
function campo(nomes = ['Eu', 'Ele']) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ps = nomes.map(nome => { const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id; return c.personagens.find(p => p.id === id); });
  for (const p of ps) executar(c, 'sala.adicionar', { sala: 'batalha', id: p.id }, ctxM);
  return { c, ps };
}
const comClasse = (p, classe, esp, nivel = 20) => {
  const cl = mss.classes.find(x => x.nome === classe);
  Object.assign(p, { classe: cl.id, especializacao: cl.especializacoes.find(e => e.nome.startsWith(esp)).id, nivel });
};
const vantagem = (p, classe, nome) => {
  const cl = mss.classes.find(x => x.nome === classe);
  (p.vantagens ||= []).push(`${cl.id}/${cl.vantagens.find(v => v.nome === nome).id}`);
};
const hab = (p, nome) => R.listaHabilidades(p, mss).find(x => x.nome === nome);
const ativar = (c, p, nome, escolhas = {}) => executar(c, 'habilidade.ativar', { id: p.id, hab: hab(p, nome).id, escolhas }, ctxM);
const minhaVez = (c, p) => { const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === p.id); if (cb.gasto) delete cb.gasto[p.id]; };
function comDados(valor, fn) { const antes = Math.random; Math.random = typeof valor === 'function' ? valor : () => valor; try { return fn(); } finally { Math.random = antes; } }

test('Moeda do Destino: o descanso longo joga Sorte/Azar e os Pontos de Fortuna (1D10 + MOD WILL); Fortuna abastada ataca na Sorte e protege no Azar', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Sortudo', 'FILHOS');
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [eu.id] }, ctxM);
  const r = C.recursoDe(eu, mss, 'fortuna');
  assert.ok(['sorte', 'azar'].includes(eu.diaFortuna));
  assert.equal(r.max, eu.recursosMax.fortuna);
  assert.ok(r.max >= 1 + R.derivados(eu, mss).mod.WILL);
  eu.diaFortuna = 'sorte';
  minhaVez(c, eu);
  const pv = ele.pv.atual;
  comDados(0.99, () => ativar(c, eu, 'Fortuna abastada', { alvo: ele.id }));
  assert.ok(ele.pv.atual < pv, 'acertou com a sorte');
  assert.equal(C.recursoDe(eu, mss, 'fortuna').restantes, r.max - 1);
  eu.diaFortuna = 'azar';
  minhaVez(c, eu);
  comDados(0.99, () => ativar(c, eu, 'Fortuna abastada', { alvo: ele.id }));
  assert.ok(ele.marcas.some(m => m.reducaoDano));
  const antes = ele.pv.atual;
  C.aplicarAtaque(eu, ele, { sucesso: true, dano: 3, efeito: null }, mss);
  assert.equal(ele.pv.atual, antes, 'a redução (1D10 + MOD WILL ≥ 3) engoliu o dano');
});

test('Sobrevivente: o dano que nocautearia é ignorado, cai e perde a ação principal; Sete Vidas: em vez de morrer, desmaia com −2 WILL', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Sortudo', 'FILHOS');
  const notas = C.aplicarAtaque(ele, eu, { sucesso: true, dano: eu.pv.atual + 5, efeito: null }, mss);
  assert.ok(notas.some(n => /Sobrevivente/.test(n)));
  assert.ok(eu.pv.atual > 0 && eu.marcadores.includes('Caído') && eu.perdeAcaoPrincipal);
  vantagem(ele, 'Sortudo', 'Sete Vidas');
  const will = ele.atributos.WILL;
  ele.pv.atual = -1;
  const n2 = C.aplicarAtaque(eu, ele, { sucesso: true, dano: 3, efeito: null }, mss);
  assert.ok(n2.some(n => /Sete Vidas/.test(n)), n2.join(' | '));
  assert.ok(!ele.marcadores.includes('Morto') && ele.marcadores.includes('Desmaiado'));
  assert.equal(ele.atributos.WILL, will - 2);
});

test('Caos e Ordem: começa em 0, ganha pelo botão e no descanso curto, gasta para recarregar um poder', () => {
  const { c, ps: [eu] } = campo(['Eu']);
  comClasse(eu, 'Sortudo', 'UNIVERSAIS');
  assert.equal(C.recursoDe(eu, mss, 'co').restantes, 0);
  ativar(c, eu, 'Caos e ordem', { opcao: 'ganhar' });
  assert.equal(C.recursoDe(eu, mss, 'co').restantes, 1);
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [eu.id] }, ctxM);
  assert.equal(C.recursoDe(eu, mss, 'co').restantes, Math.min(2, C.recursoDe(eu, mss, 'co').max));
  (eu.usos ||= {})['zona de desastre'] = 1;
  ativar(c, eu, 'Caos e ordem', { opcao: 'recarregar', poder: hab(eu, 'Zona de Desastre').id });
  assert.equal(eu.usos['zona de desastre'], 0);
});

test('Ataque crítico: a margem soma 10% da chance de acerto; Sob pressão: +15% no tiro em desvantagem; Guarda de posto: +5% a distância', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d4', pericia: 'arma-branca.laminas-curtas', alcance: 'corpo', acerto: 67 },
    { uid: 'p', nome: 'Pistola', tipo: 'arma', slot: 'maos', equipado: true, mao: 1, dano: '1d6', pericia: 'armas-de-fogo.pistolas', alcance: 'distancia' }];
  vantagem(eu, 'Sortudo', 'Ataque crítico');
  const r = comDados(() => 0.905, () => C.resolverAtaque(eu, ele, mss, { armaUid: 'f' }));
  assert.equal(r.dp, 91);
  assert.equal(r.critico, 'acerto', 'acerto 67%: margem 5% + 6,7% = 11% → 90 a 100 é crítico');
  const sem = { ...eu, vantagens: [] };
  assert.equal(comDados(() => 0.905, () => C.resolverAtaque(sem, ele, mss, { armaUid: 'f' })).critico, null, 'sem a vantagem, 91 não é crítico');
  vantagem(eu, 'Soldado', 'Sob pressão');
  const sp = C.resolverAtaque(eu, ele, mss, { armaUid: 'p', desvantagem: true });
  assert.ok(sp.mods.some(m => m.nome === 'Sob pressão' && m.valor === 15));
  vantagem(eu, 'Soldado', 'Guarda de posto');
  ativar(c, eu, 'Guarda de posto');
  assert.ok(C.resolverAtaque(eu, ele, mss, { armaUid: 'p' }).mods.some(m => /Guarda de posto/.test(m.nome) && m.valor === 5));
  assert.ok(!C.resolverAtaque(eu, ele, mss, { armaUid: 'f' }).mods.some(m => /Guarda de posto/.test(m.nome)), 'só a distância');
});

test('Calor do combate congela os efeitos negativos; O Edito do Caos tira uma habilidade do alvo', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.marcadores = ['Cansado'];
  const comEfeito = R.derivados(eu, mss).percentual.FOR;
  vantagem(eu, 'Soldado', 'Calor do combate');
  ativar(c, eu, 'Calor do combate');
  const congelado = R.derivados(eu, mss).percentual.FOR;
  assert.ok(congelado >= comEfeito);
  comClasse(ele, 'Sortudo', 'UNIVERSAIS');
  comClasse(eu, 'Soldado', 'COMANDANTE');
  const alvoH = R.listaHabilidades(eu, mss)[0];
  minhaVez(c, ele);
  const seq = [0.99, 0.5, 0.01, 0.5];
  let i = 0;
  comDados(() => seq[i++] ?? 0.5, () => ativar(c, ele, 'O Edito do Caos', { alvo: eu.id, caracteristica: alvoH.id }));
  assert.ok(!R.listaHabilidades(eu, mss).some(x => x.id === alvoH.id), `${alvoH.nome} bloqueada`);
});

test('Iluminados: Desnortear atinge os inimigos; Vai ficar tudo bem cura; Mente poderosa tem MOD INT usos; Abalo mental vira oferta quando o inimigo erra', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Sortudo', 'ILUMINADOS');
  eu.tipo = 'pj';
  minhaVez(c, eu);
  const pv = ele.pv.atual;
  comDados(0.5, () => ativar(c, eu, 'Desnortear'));
  assert.ok(ele.pv.atual < pv);
  eu.pv.atual -= 4;
  minhaVez(c, eu);
  comDados(0.99, () => ativar(c, eu, 'Vai ficar tudo bem', { alvo: eu.id, opcao: 'cura' }));
  assert.ok(eu.pv.atual > eu.pv.max - 4);
  assert.equal(C.usosRestantes(eu, mss, 'mente poderosa'), Math.max(1, R.derivados(eu, mss).mod.INT || 0));
  minhaVez(c, ele);
  const pend = executar(c, 'combate.atacar', { atacante: ele.id, alvo: eu.id, opcoes: {} }, ctxM);
  comDados(0.01, () => executar(c, 'combate.defender', { id: pend.id, defesa: 'nenhuma' }, ctxM));
  assert.ok((c.salas.batalha.ofertas || []).some(o => o.habilidade === 'Abalo mental' && o.alvos.includes(ele.id)));
});

test('Inspiração do Sortudo usa MOD WILL + 1 (a do Encantado, MOD CAR + 1); Despertar: 1 + MOD CONS usos', () => {
  const { c, ps: [eu, ele] } = campo();
  vantagem(eu, 'Sortudo', 'Inspiração');
  const d = R.derivados(eu, mss);
  assert.equal(C.recursoDe(eu, mss, 'inspiracao').max, Math.max(1, 1 + (d.mod.WILL || 0)));
  comClasse(ele, 'Transmorfo', 'LICANTROPO', 6);
  assert.equal(C.usosRestantes(ele, mss, 'despertar'), Math.max(1, 1 + (R.derivados(ele, mss).mod.CONS || 0)));
  assert.ok(c);
});

test('Coletor: armazena a característica de uma criatura (pronta no descanso longo) e incorpora (1 PV), virando habilidade', () => {
  const { c, ps: [eu, bicho] } = campo(['Eu', 'Bicho']);
  comClasse(eu, 'Transmorfo', 'LICANTROPO', 6);
  bicho.habilidadesProprias = [{ nome: 'Couro grosso', efeitos: '+1 IP geral', modo: 'sempre' }];
  const car = R.listaHabilidades(bicho, mss).find(x => x.nome === 'Couro grosso');
  minhaVez(c, eu);
  ativar(c, eu, 'Coletor', { opcao: 'armazenar', alvo: bicho.id, caracteristica: car.id });
  assert.throws(() => { minhaVez(c, eu); ativar(c, eu, 'Coletor', { opcao: 'incorporar', coletada: eu.coletor.armazenadas[0].id }); }, /descanso longo/);
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [eu.id] }, ctxM);
  const pv = eu.pv.atual;
  minhaVez(c, eu);
  ativar(c, eu, 'Coletor', { opcao: 'incorporar', coletada: eu.coletor.armazenadas[0].id });
  assert.equal(eu.pv.atual, pv - 1);
  assert.ok(R.listaHabilidades(eu, mss).some(x => x.nome === 'Couro grosso'));
});
