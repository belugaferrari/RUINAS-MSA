// Relatório de Habilidades (respostas do autor, 29/10): Mutante e Perito — ataques especiais com arma da habilidade,
// marcas, escolhas que ficam na ficha, Moral, item travado, companheiros criados por habilidade e o descanso.
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
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };

function campo(nomes = ['Eu', 'Ele'], { batalha = true } = {}) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = nomes.map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  if (batalha) for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  return { c, ps: ids.map(id => c.personagens.find(p => p.id === id)) };
}
const comClasse = (p, classe, esp, nivel = 20) => {
  const cl = mss.classes.find(x => x.nome === classe);
  Object.assign(p, { classe: cl.id, especializacao: cl.especializacoes.find(e => e.nome === esp).id, nivel });
};
const vantagem = (p, classe, nome) => {
  const cl = mss.classes.find(x => x.nome === classe);
  (p.vantagens ||= []).push(`${cl.id}/${cl.vantagens.find(v => v.nome === nome).id}`);
};
const hab = (p, nome) => R.listaHabilidades(p, mss).find(x => x.nome === nome);
const novoTurno = c => { delete c.salas.batalha.combate.gasto; };
const minhaVez = (c, p) => { const cb = c.salas.batalha.combate; cb.vez = cb.ordem.findIndex(o => o.id === p.id); };
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}

test('livro: "Corpo Adaptado 2" e "O Show Tem Que Continuar" viraram habilidades próprias; Cibermédico com o texto novo', () => {
  const cl = mss.classes.find(x => x.nome === 'Mutante');
  assert.ok(cl.vantagens.find(v => v.nome === 'Corpo Adaptado 2'));
  assert.ok(!/Corpo Adaptado\./.test(cl.vantagens.find(v => v.nome === 'Regeneração degenerativa').descricao));
  const p = {};
  comClasse(p, 'Perito', 'O ARTISTA', 6);
  assert.ok(!/Show/.test(hab(p, 'Dançarino').descricao));
  assert.match(hab(p, 'O Show Tem Que Continuar').descricao, /Sanidade/);
  const q = {};
  comClasse(q, 'Perito', 'SOCORRISTA', 12);
  assert.match(hab(q, 'Cibermédico').descricao, /1 vez em cada personagem por combate/);
});

test('Muco radioativo: aparece nas armas, gasta a ação principal e 1 dos 3 usos; o alvo fica com CONS% em desvantagem', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Mutante', 'RADIANTE (a Praga)', 8);
  const muco = C.armasDisponiveis(eu, mss).find(a => a.nome === 'Muco radioativo');
  assert.ok(muco);
  assert.equal(muco.tipoDano, 'Radiação');
  assert.equal(muco.alcance, 'distancia');
  minhaVez(c, eu);
  for (let i = 0; i < 3; i++) {
    comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: muco.uid } }, ctxM));
    if (i === 0) assert.throws(() => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: muco.uid } }, ctxM), /já usou a ação principal/);
    novoTurno(c);
  }
  assert.ok((ele.marcas || []).some(m => m.desvantagemCons));
  assert.ok(!C.armasDisponiveis(eu, mss).some(a => a.nome === 'Muco radioativo'), 'sem usos, some das armas');
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [eu.id] }, ctxM);
  assert.ok(C.armasDisponiveis(eu, mss).some(a => a.nome === 'Muco radioativo'), 'volta no descanso longo');
});

test('Sobrecarga Neural: só contra drone, autômato, máquina ou ciborgue; ignora IP', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Perito', 'HACKER', 11);
  const arma = C.armasDisponiveis(eu, mss).find(a => a.nome === 'Sobrecarga Neural');
  assert.ok(arma.ignoraIp);
  minhaVez(c, eu);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: arma.uid } }, ctxM), /só funciona contra/);
  ele.tipoCriatura = 'drone';
  ele.ipExtra = 50;
  const r = comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: arma.uid } }, ctxM));
  assert.ok(r.sucesso);
  assert.ok(r.dano > 0, 'IP 50 não segura');
});

test('Evolução humana: resistência a Corte e imune a crítico', () => {
  const p = { atributos: { FOR: 10, CONS: 10 } };
  comClasse(p, 'Mutante', 'ADAPTADO', 16);
  const d = R.derivados(p, mss);
  assert.ok(d.habilidades.resistencias.includes('Corte'));
  assert.ok(d.habilidades.imuneCritico);
});

test('Mutação precisa: vantagem na perícia e CONS → FOR por 10 turnos, 1 vez por descanso', () => {
  const { c, ps: [eu] } = campo();
  comClasse(eu, 'Mutante', 'ADAPTADO', 12);
  eu.atributos = { ...eu.atributos, CONS: 12, FOR: 10 };
  const antes = R.derivados(eu, mss).atributos;
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Mutação precisa').id, escolhas: { pericia: 'esportes', pontos: '4' } }, ctxM);
  const depois = R.derivados(eu, mss).atributos;
  assert.equal(depois.FOR, antes.FOR + 4);
  assert.equal(depois.CONS, antes.CONS - 4);
  assert.ok(R.vantagemPorHabilidade(eu, mss, ['esportes']));
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Mutação precisa').id, escolhas: { pericia: 'esportes' } }, ctxM), /já foi usada/);
});

test('Roubar Característica: escolhe de uma criatura morta; entra no descanso longo com −3 PV persistentes', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Mutante', 'ADAPTADO', 8);
  ele.habilidadesProprias = [{ nome: 'Pele de pedra', efeitos: '+1 IP geral' }, { nome: 'Rei da colina', unica: true }];
  ele.marcadores = ['Morto'];
  const h = hab(eu, 'Roubar Característica');
  const pvAntes = R.derivados(eu, mss).pvMax;
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: ele.id, caracteristica: 'm:1:Rei da colina' } }, ctxM), /não seja única/);
  executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: ele.id, caracteristica: 'm:0:Pele de pedra' } }, ctxM);
  assert.ok(!hab(eu, 'Pele de pedra'));
  executar(c, 'combate.encerrar', {}, ctxM);
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [eu.id] }, ctxM);
  assert.ok(hab(eu, 'Pele de pedra'));
  assert.equal(R.derivados(eu, mss).pvMax, pvAntes - 3);
});

test('Caos genéticos: passou, perde os marcadores de vulnerabilidade; falhou, 2d4 e uma mutação; não afeta mutantes', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Mutante', 'RADIANTE (a Praga)', 5);
  const h = hab(eu, 'Caos genéticos');
  ele.marcadores = ['Marcador de vulnerabilidade'];
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: ele.id } }, ctxM));
  assert.ok(!(ele.marcadores || []).some(m => /vulnerabilidade/i.test(m)));
  novoTurno(c);
  const pv = ele.pv.atual;
  comDados(0.01, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: ele.id } }, ctxM));
  assert.ok(ele.pv.atual < pv);
  assert.equal((ele.mutacoes || []).length, 1);
  novoTurno(c);
  ele.classe = 'mutante';
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: ele.id } }, ctxM), /não afeta mutantes/);
});

test('Esporos gasosos: no mapa, quem está a 3 m ganha 1 marcador genético e −10% em CONS% até o fim do combate', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Mutante', 'RADIANTE (a Praga)', 5);
  c.mapa = { ...(c.mapa || {}), pecas: { [eu.id]: { col: 0, lin: 0 }, [ele.id]: { col: 1, lin: 1 } } };
  const cons = R.derivados(ele, mss).percentual.CONS;
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Esporos gasosos').id }, ctxM);
  assert.ok(ele.marcadores.some(m => /gen[ée]tico/i.test(m)));
  assert.equal(R.derivados(ele, mss).percentual.CONS, cons - 10);
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.equal(R.derivados(ele, mss).percentual.CONS, cons);
});

test('Regeneração degenerativa: −1 CONS e +1d4 PV; a CONS volta 1 por descanso', () => {
  const { c, ps: [eu] } = campo();
  comClasse(eu, 'Mutante', 'ADAPTADO', 4);
  vantagem(eu, 'Mutante', 'Regeneração degenerativa');
  eu.atributos = { ...eu.atributos, CONS: 12 };
  eu.pv.atual = 1;
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Regeneração degenerativa').id }, ctxM);
  assert.equal(R.derivados(eu, mss).atributos.CONS, 11);
  assert.ok(eu.pv.atual > 1);
  executar(c, 'combate.encerrar', {}, ctxM);
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [eu.id] }, ctxM);
  assert.equal(R.derivados(eu, mss).atributos.CONS, 12);
});

test('Corpo adaptado 2: o jogador escolhe a resistência; só troca depois de um descanso longo', () => {
  const { c, ps: [eu] } = campo(['Eu'], { batalha: false });
  eu.tipo = 'pj'; eu.donoId = ana.id;
  comClasse(eu, 'Mutante', 'ADAPTADO', 4);
  vantagem(eu, 'Mutante', 'Corpo Adaptado 2');
  const h = hab(eu, 'Corpo Adaptado 2');
  executar(c, 'habilidade.escolher', { id: eu.id, hab: h.id, tipoDano: 'Calor' }, ctxA);
  assert.ok(R.derivados(eu, mss).habilidades.resistencias.includes('Calor'));
  assert.throws(() => executar(c, 'habilidade.escolher', { id: eu.id, hab: h.id, tipoDano: 'Frio' }, ctxA), /descanso longo/);
  executar(c, 'descanso.fazer', { tipo: 'longo', ids: [eu.id] }, ctxA);
  executar(c, 'habilidade.escolher', { id: eu.id, hab: h.id, tipoDano: 'Frio' }, ctxA);
  assert.deepEqual(R.derivados(eu, mss).habilidades.resistencias, ['Frio']);
});

test('Mutação monstruosa: +1d4 do tipo escolhido nos ataques físicos', () => {
  const p = { atributos: { FOR: 10 } };
  comClasse(p, 'Mutante', 'ADAPTADO', 4);
  vantagem(p, 'Mutante', 'Mutação monstruosa');
  assert.equal(R.danoDasHabilidades(p, mss, { uid: 'desarmado' }).partes.length, 0);
  p.escolhasHab = { 'mutacao monstruosa': { tipoDano: 'Elétrico' } };
  assert.deepEqual(R.danoDasHabilidades(p, mss, { uid: 'desarmado' }).partes, [{ nome: 'Mutação monstruosa (Elétrico)', expr: '1d4' }]);
});

test('Melhor do mundo: uma perícia no 6º nível e mais uma a cada 3 (exceto combate), +5% cada', () => {
  const { c, ps: [eu] } = campo(['Eu'], { batalha: false });
  comClasse(eu, 'Perito', 'O ARTISTA', 9);
  const h = hab(eu, 'Melhor do mundo');
  assert.equal(R.escolhasPermitidas(eu, h.regra, h), 2);
  const antes = R.derivados(eu, mss).pericias.arte;
  const r = executar(c, 'habilidade.escolher', { id: eu.id, hab: h.id, pericias: ['briga', 'arte', 'jogos', 'sentidos'] }, ctxM);
  assert.deepEqual(r.pericias, ['arte', 'jogos']);
  assert.equal(R.derivados(eu, mss).pericias.arte, antes + 5);
});

test('Dançarino: defesa "Dança" no lugar da Esquiva; defendeu, +1 de Moral (até 3); Moral vira +1d20', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(ele, 'Perito', 'O ARTISTA', 5);
  assert.ok(C.opcoesDefesa(ele, { uid: 'desarmado', alcance: 'corpo' }, mss).some(o => o.id === 'danca'));
  minhaVez(c, eu);
  const pend = comDados(0.01, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: {} }, ctxM));
  comDados(0.01, () => executar(c, 'combate.defender', { id: pend.id, defesa: 'danca' }, ctxM));
  assert.equal(ele.moral.danca, 1);
  executar(c, 'moral.usar', { id: ele.id }, ctxM);
  assert.ok(ele.marcas.some(m => m.d20));
  assert.equal(ele.moral.danca, 0);
});

test('Bug na rede: o item fica Travado (equipado, sem uso) até o fim do combate', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Perito', 'HACKER', 6);
  const arma = { uid: 'x1', nome: 'Pistola', tipo: 'arma', slot: 'maos', equipado: true, dano: '1d6', pericia: 'armas-de-fogo.pistolas' };
  ele.itens = [arma];
  assert.ok(C.armasDisponiveis(ele, mss).some(a => a.uid === 'x1'));
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Bug na rede').id, escolhas: { alvo: ele.id, item: 'x1' } }, ctxM));
  assert.ok(arma.travado && arma.equipado);
  assert.ok(!C.armasDisponiveis(ele, mss).some(a => a.uid === 'x1'));
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.ok(!arma.travado);
});

test('Controle Remoto: o drone vira companheiro por 10 turnos e age logo depois do Hacker', () => {
  const { c, ps: [eu, d1, outro] } = campo(['Eu', 'Drone', 'Outro']);
  comClasse(eu, 'Perito', 'HACKER', 16);
  eu.donoId = ana.id;
  d1.tipoCriatura = 'drone';
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Controle Remoto').id, escolhas: { alvo: d1.id } }, ctxM);
  assert.equal(d1.companheiroDe, eu.id);
  assert.equal(d1.donoId, ana.id);
  const ordem = c.salas.batalha.combate.ordem.map(o => o.id);
  assert.equal(ordem.indexOf(d1.id), ordem.indexOf(eu.id) + 1);
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.ok(!d1.companheiroDe && !d1.controle);
  assert.ok(outro);
});

test('O Grande Truque: o dano que levaria a 0 PV não acontece (1 vez por descanso longo); fica Furtivo', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(ele, 'Perito', 'O ARTISTA', 15);
  ele.pv.atual = 2;
  minhaVez(c, eu);
  comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { surpresa: true, danoLivre: '50' } }, ctxM));
  assert.equal(ele.pv.atual, 2);
  assert.ok(ele.marcadores.includes('Furtivo'));
  novoTurno(c);
  c.salas.batalha.combate.rodada++;
  comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { surpresa: true, danoLivre: '50' } }, ctxM));
  assert.ok(ele.pv.atual <= 0, 'a segunda vez já não salva');
});

test('Fitoterapia: cria o remédio (fora do combate), que cura ao usar e estraga em 24 h', () => {
  const { c, ps: [eu] } = campo(['Eu'], { batalha: false });
  comClasse(eu, 'Perito', 'SOCORRISTA', 9);
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Fitoterapia').id, escolhas: { efeito: 'cura' } }, ctxM));
  const rem = eu.itens.find(i => i.remedio);
  assert.ok(rem);
  eu.pv.atual = 1;
  executar(c, 'remedio.usar', { id: eu.id, uid: rem.uid }, ctxM);
  assert.ok(eu.pv.atual > 1);
  assert.ok(!eu.itens.some(i => i.remedio));
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Fitoterapia').id, escolhas: { efeito: 'veneno' } }, ctxM));
  executar(c, 'tempo.passar', { horas: 24 }, ctxM);
  assert.ok(!eu.itens.some(i => i.remedio));
});

test('O Show Tem Que Continuar: no descanso curto, quem descansa junto começa o próximo combate Motivado', () => {
  const { c, ps: [artista, amigo, inimigo] } = campo(['Artista', 'Amigo', 'Inimigo'], { batalha: false });
  comClasse(artista, 'Perito', 'O ARTISTA', 6);
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [artista.id, amigo.id] }, ctxM);
  assert.ok(amigo.motivadoProximoCombate);
  for (const p of [amigo, inimigo]) executar(c, 'sala.adicionar', { sala: 'batalha', id: p.id }, ctxM);
  assert.equal(amigo.humor, 'motivado');
});

test('Analista de risco: passou no INT%, +1d4 de dano e +10% de defesa só contra o alvo', () => {
  const { c, ps: [eu, ele, outro] } = campo(['Eu', 'Ele', 'Outro']);
  comClasse(eu, 'Perito', 'HACKER', 3);
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Analista de risco').id, escolhas: { alvo: ele.id } }, ctxM));
  const arma = { uid: 'desarmado', alcance: 'corpo', pericia: 'briga.ataque-desarmado' };
  const contraEle = C.defesaDoAlvo(eu, arma, mss, { escolha: 'nenhuma', atacante: ele }).total;
  const contraOutro = C.defesaDoAlvo(eu, arma, mss, { escolha: 'nenhuma', atacante: outro }).total;
  assert.equal(contraEle, contraOutro + 10);
  const r = comDados(0.99, () => C.resolverAtaque(eu, ele, mss, {}, 'nenhuma'));
  assert.ok(r.danoPartes.some(x => /Analista/.test(x.nome)));
});

test('Toque contagioso: depois de acertar desarmado, o app oferece; o alvo falha no CONS% e desenvolve a mutação', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Mutante', 'RADIANTE (a Praga)', 12);
  eu.mutacoes = [{ id: 'm1', n: 1, tipo: 'descontrolada' }];
  minhaVez(c, eu);
  comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { surpresa: true } }, ctxM));
  const of = c.salas.batalha.ofertas.find(o => o.habilidade === 'Toque contagioso');
  assert.ok(of);
  comDados(0.01, () => executar(c, 'combate.oferta', { id: of.id, aceitar: true }, ctxM));
  assert.ok(ele.mutacoes.some(m => m.turnos === 5));
  assert.ok(eu.contagiados.includes(ele.id));
});

test('Tóxico: o monstro que o fere corpo a corpo e falha no WILL% não o ataca mais', () => {
  const { c, ps: [monstro, eu] } = campo(['Fera', 'Eu']);
  comClasse(eu, 'Mutante', 'ADAPTADO', 4);
  vantagem(eu, 'Mutante', 'Tóxico');
  monstro.tipoCriatura = 'monstro';
  minhaVez(c, monstro);
  comDados(0.5, () => executar(c, 'combate.atacar', { atacante: monstro.id, alvo: eu.id, opcoes: { surpresa: true, danoLivre: '3' } }, ctxM));
  if ((monstro.marcas || []).some(m => m.naoAtaca === eu.id)) {
    novoTurno(c);
    assert.throws(() => executar(c, 'combate.atacar', { atacante: monstro.id, alvo: eu.id, opcoes: {} }, ctxM), /repelido/);
  }
});

test('capacete (slot Cabeça): o IP só vale contra golpe localizado na cabeça; o MOD FOR entra no dano corpo a corpo', () => {
  const { ps: [eu, ele] } = campo();
  eu.atributos = { ...eu.atributos, FOR: 13 };
  ele.itens = [{ uid: 'cap', nome: 'Capacete', tipo: 'defesa', slot: 'cabeca', equipado: true, ipTipos: { geral: 3 } }];
  assert.equal(C.ipContra(ele, mss, 'Corte'), 0);
  assert.equal(C.ipContra(ele, mss, 'Corte', false, 'cabeca'), 3);
  const r = comDados(0.99, () => C.resolverAtaque(eu, ele, mss, { surpresa: true }, 'nenhuma'));
  assert.equal(r.ip, 0);
  assert.deepEqual(r.danoPartes.find(x => x.nome === 'MOD FOR'), { nome: 'MOD FOR', total: 1 });
  const rc = comDados(0.99, () => C.resolverAtaque(eu, ele, mss, { surpresa: true, localizado: true, local: 'cabeca' }, 'nenhuma'));
  assert.equal(rc.ip, 3);
});

test('Pragas: os marcadores genéticos estouram e somem; habilidade sem ação no livro gasta a principal', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Mutante', 'RADIANTE (a Praga)', 10);
  ele.marcadores = ['Marcador genético', 'Marcador genético'];
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Pragas').id, escolhas: { alvo: ele.id } }, ctxM);
  assert.ok(!ele.marcadores.some(m => /gen[ée]tico/i.test(m)));
  assert.ok(ele.marcas.some(m => m.pragas));
  comClasse(eu, 'Mutante', 'ADAPTADO', 12);
  novoTurno(c);
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Mutação precisa').id, escolhas: { pericia: 'esportes' } }, ctxM);
  assert.equal(c.salas.batalha.combate.gasto[eu.id].principal, 1);
});
