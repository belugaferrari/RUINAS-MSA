// Habilidades do Encantado e do Inventor (planilha do autor, 26/10): ataques especiais sociais, Inspirações,
// Armadura improvisada, Gambiarras, Invenção protetora, ataque localizado num item, Restaurador, troca de itens.
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

// Campanha com dois personagens no Campo de Batalha; o 1º recebe classe/vantagens.
function campo(nomes = ['Eu', 'Ele']) {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = nomes.map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  return { c, ps: ids.map(id => c.personagens.find(p => p.id === id)) };
}
const comClasse = (p, classe, esp, nivel = 20) => {
  const cl = mss.classes.find(x => x.nome === classe);
  Object.assign(p, { classe: cl.id, especializacao: cl.especializacoes.find(e => e.nome === esp).id, nivel });
  return cl;
};
const vantagem = (p, classe, nome) => {
  const cl = mss.classes.find(x => x.nome === classe);
  (p.vantagens ||= []).push(`${cl.id}/${cl.vantagens.find(v => v.nome === nome).id}`);
};
const hab = (p, nome) => R.listaHabilidades(p, mss).find(x => x.nome === nome);
// Dados fixos: 0.99 → d100 = 100 (acerto crítico).
function comDados(valor, fn) {
  const antes = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = antes; }
}

test('nomes: "Invenção! Protetora" e "Invenção protetora" são regras diferentes; o nível 6 do Diplomata é Inspiração motivacional', () => {
  assert.notEqual(R.chaveHabilidade('Invenção! Protetora'), R.chaveHabilidade('Invenção protetora'));
  assert.equal(R.regraDaHabilidade('Invenção! Protetora', mss).especial, 'absorverDano');
  assert.equal(R.regraDaHabilidade('Invenção protetora', mss).especial, 'reduzirDano');
  const p = {};
  comClasse(p, 'Encantado', 'O DIPLOMATA', 6);
  assert.ok(hab(p, 'Inspiração motivacional'));
  assert.ok(!hab(p, 'Inspiração'));
});

test('Titereiro: passou contra o WILL, o humor do alvo muda e fica preso; o jogador não troca; acaba depois dos turnos dele', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Encantado', 'O DIPLOMATA', 8);
  ele.donoId = ana.id;
  const h = hab(eu, 'Titereiro');
  const r = comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: ele.id, sub: 'manipulacao.labia', humor: 'amedrontado' } }, ctxM));
  assert.equal(r.sucesso, true);
  assert.equal(ele.humor, 'amedrontado');
  assert.ok(ele.humorForcado.turnos >= 1 && ele.humorForcado.turnos <= 4);
  assert.ok(!eu.habAtivas?.[h.id], 'não fica "ativa" no Encantado');
  assert.throws(() => executar(c, 'humor.definir', { id: ele.id, humor: 'neutro' }, ctxA), /preso/);
  // Passa os turnos do alvo até soltar.
  const cb = c.salas.batalha.combate;
  for (let i = 0; i < 10 && ele.humorForcado; i++) {
    cb.vez = cb.ordem.findIndex(o => o.id === ele.id);
    executar(c, 'combate.proximo', {}, ctxM);
  }
  assert.ok(!ele.humorForcado);
});

test('Foco de Atenção: o Galante soma o CAR na defesa contra o alvo; Terror Psicológico: −30% no ataque do alvo', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Encantado', 'GALANTE', 20);
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Foco de Atenção').id, escolhas: { alvo: ele.id, sub: 'manipulacao.seducao', humor: 'enojado' } }, ctxM));
  const car = R.derivados(eu, mss).atributos.CAR;
  const foco = eu.marcas.find(m => m.contra === ele.id);
  assert.equal(foco.defesa, car);
  const arma = C.armasDisponiveis(ele, mss)[0];
  const def = C.defesaDoAlvo(eu, arma, mss, { atacante: ele });
  assert.ok(def.partes.some(x => x.valor === car && /Foco/.test(x.nome)));
  // Terror (outro Encantado, Sussurrante).
  const { c: c2, ps: [s, alvo] } = campo();
  comClasse(s, 'Encantado', 'SUSSURRANTE', 20);
  comDados(0.99, () => executar(c2, 'habilidade.ativar', { id: s.id, hab: hab(s, 'Terror Psicológico').id, escolhas: { alvo: alvo.id } }, ctxM));
  assert.equal(alvo.humor, 'amedrontado');
  assert.equal(alvo.marcas.find(m => m.nome === 'Trauma momentâneo').acerto, -30);
  const r = C.resolverAtaque(alvo, s, mss, { armaUid: 'desarmado' }, 'nenhuma', () => 0.5);
  assert.ok(r.mods.some(m => m.nome === 'Trauma momentâneo' && m.valor === -30));
});

test('Inspiração motivacional: vantagem na perícia escolhida para você e os aliados; Inspiração: +1d20 no próximo teste', () => {
  const { c, ps: [eu, aliado, inimigo] } = campo(['Eu', 'Aliado', 'Inimigo']);
  eu.tipo = 'pj'; aliado.tipo = 'pj';
  comClasse(eu, 'Encantado', 'O DIPLOMATA', 20);
  const r = comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Inspiração motivacional').id, escolhas: { pericia: 'esportes' } }, ctxM));
  assert.equal(r.sucesso, true);
  assert.ok(R.vantagemPorHabilidade(aliado, mss, ['esportes.corrida', 'esportes']));
  assert.ok(R.vantagemPorHabilidade(eu, mss, ['esportes']));
  assert.ok(!R.vantagemPorHabilidade(inimigo, mss, ['esportes']));
  // 1 vez por descanso (curto ou longo).
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Inspiração motivacional').id, escolhas: { pericia: 'esportes' } }, ctxM), /já foi usada/);
  executar(c, 'descanso.fazer', { tipo: 'curto', ids: [eu.id] }, ctxM);
  assert.ok(!eu.usos?.['inspiracao motivacional']);
  // Inspiração (vantagem do Encantado): o aliado ganha +1d20 no próximo teste, que gasta a marca.
  vantagem(eu, 'Encantado', 'Inspiração');
  const rec = C.recursoDe(eu, mss, 'inspiracao');
  assert.ok(rec.max >= 1);
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Inspiração').id, escolhas: { alvo: aliado.id } }, ctxM);
  assert.equal(C.recursoDe(eu, mss, 'inspiracao').restantes, rec.max - 1);
  const t = executar(c, 'rolar', { id: aliado.id, acaoRef: 'sub:esportes.corrida' }, ctxM);
  assert.match(t.rotulo, /Inspiração \+\d+/);
  assert.ok(!aliado.marcas.some(m => m.d20));
});

test('Armadura improvisada: +1 de IP por uso, até +2 geral ou +4 de um tipo; some no fim do combate', () => {
  const { c, ps: [eu] } = campo();
  comClasse(eu, 'Inventor', 'O ARMEIRO', 20);
  const h = hab(eu, 'Armadura improvisada');
  const ip0 = R.derivados(eu, mss).ip.geral;
  executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: eu.id, tipoIp: 'geral' } }, ctxM);
  // 1 por turno (ação bônus): no mesmo turno é recusado.
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: eu.id, tipoIp: 'geral' } }, ctxM), /bônus/);
  delete c.salas.batalha.combate.gasto; // novo turno (cada ataque gasta a ação)
  executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: eu.id, tipoIp: 'geral' } }, ctxM);
  assert.equal(R.derivados(eu, mss).ip.geral, ip0 + 2);
  delete c.salas.batalha.combate.gasto; // novo turno (cada ataque gasta a ação)
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: eu.id, tipoIp: 'geral' } }, ctxM), /máximo/);
  assert.throws(() => executar(c, 'habilidade.ativar', { id: eu.id, hab: h.id, escolhas: { alvo: eu.id, tipoIp: 'Corte' } }, ctxM), /geral/);
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.ok(!eu.ipTemp);
});

test('Conhecimento acumulado soma no MOD INT; Ataque inesperado sobe o dano no ataque surpresa', () => {
  const p = { atributos: { FOR: 10, CONS: 10, AGI: 10, DES: 10, INT: 10, PER: 10, CAR: 14, WILL: 10 } };
  const semClasse = R.derivados(p, mss).mod.INT;
  comClasse(p, 'Inventor', 'O ARMEIRO', 20);
  const vezes = hab(p, 'Conhecimento acumulado').vezes;
  assert.equal(R.derivados(p, mss).mod.INT, semClasse + vezes);
  const { ps: [enc, alvo] } = campo();
  Object.assign(enc.atributos, { CAR: 14 });
  vantagem(enc, 'Encantado', 'Ataque inesperado');
  enc.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', dano: '1d4', tipoDano: 'Corte', equipado: true, slot: 'maos', alcance: 'corpo', pericia: 'arma-branca.laminas-curtas' }];
  const r = C.resolverAtaque(enc, alvo, mss, { armaUid: 'f', surpresa: true }, 'nenhuma', () => 0.99);
  assert.equal(r.danoPartes[0].expr, R.subirPassos('1d4', R.derivados(enc, mss).mod.CAR));
  assert.notEqual(r.danoPartes[0].expr, '1d4');
});

test('ataque localizado num item: o golpe vai no item; com Engenharia Reversa ele perde 1 de durabilidade', () => {
  const { c, ps: [eu, ele] } = campo();
  comClasse(eu, 'Inventor', 'O ENGENHEIRO DAS RUÍNAS', 20);
  ele.itens = [{ uid: 'esc', nome: 'Escudo', tipo: 'defesa', slot: 'maos', equipado: true, durabilidade: 5, durabilidadeAtual: 5 }];
  comDados(0.99, () => executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Engenharia Reversa').id, escolhas: { alvo: ele.id, item: 'esc' } }, ctxM));
  assert.ok(eu.marcas.some(m => m.item?.uid === 'esc'));
  delete c.salas.batalha.combate.gasto; // o ataque vem no turno seguinte (a Engenharia Reversa gastou a principal)
  const pv = ele.pv.atual;
  const r = comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'desarmado', localizado: true, local: 'item:esc', surpresa: true } }, ctxM));
  assert.equal(r.sucesso, true);
  assert.equal(ele.pv.atual, pv);
  assert.equal(ele.itens[0].durabilidadeAtual, 4);
  assert.match(r.rotulo, /\(Escudo\)/);
  // Local do corpo aparece no registro.
  delete c.salas.batalha.combate.gasto; // novo turno (cada ataque gasta a ação)
  const r2 = comDados(0.99, () => executar(c, 'combate.atacar', { atacante: eu.id, alvo: ele.id, opcoes: { armaUid: 'desarmado', localizado: true, local: 'cabeca', surpresa: true } }, ctxM));
  assert.match(r2.rotulo, /\(Cabeça\)/);
});

test('Invenção protetora: ao tomar dano, o app oferece a reação; gasta sucata e devolve até 1d6', () => {
  const { c, ps: [atq, inv] } = campo(['Atacante', 'Inventor']);
  vantagem(inv, 'Inventor', 'Invenção protetora');
  inv.itens = [{ uid: 's', nome: 'Sucata', tipo: 'geral', quantidade: 2 }];
  atq.itens = [{ uid: 'm', nome: 'Marreta', tipo: 'arma', dano: '2d6', tipoDano: 'Concussão', equipado: true, slot: 'maos', alcance: 'corpo', pericia: 'arma-branca.martelo' }];
  comDados(0.99, () => executar(c, 'combate.atacar', { atacante: atq.id, alvo: inv.id, opcoes: { armaUid: 'm', surpresa: true } }, ctxM));
  const of = c.salas.batalha.ofertas.find(o => o.habilidade === 'Invenção protetora');
  assert.ok(of, 'oferta da reação');
  const pv = inv.pv.atual;
  executar(c, 'combate.oferta', { id: of.id, aceitar: true }, ctxM);
  assert.ok(inv.pv.atual > pv && inv.pv.atual <= pv + Math.min(6, of.dano));
  assert.equal(inv.itens[0].quantidade, 1);
});

test('Gambiarras profissionais: item quebrado funciona por 2d4 turnos (gasta sucata) e quebra de novo; Restaurador repara 2', () => {
  const { c, ps: [eu] } = campo();
  comClasse(eu, 'Inventor', 'O ENGENHEIRO DAS RUÍNAS', 20);
  eu.itens = [{ uid: 'r', nome: 'Rádio', tipo: 'geral', durabilidade: 4, durabilidadeAtual: 0 }, { uid: 's', nome: 'Sucata', tipo: 'geral' }];
  executar(c, 'habilidade.ativar', { id: eu.id, hab: hab(eu, 'Gambiarras profissionais').id, escolhas: { item: 'r' } }, ctxM);
  const radio = eu.itens.find(i => i.uid === 'r');
  assert.equal(radio.durabilidadeAtual, 1);
  assert.ok(radio.gambiarra.turnos >= 2 && radio.gambiarra.turnos <= 8);
  assert.ok(!eu.itens.some(i => i.nome === 'Sucata'));
  executar(c, 'combate.encerrar', {}, ctxM);
  assert.equal(radio.durabilidadeAtual, 0);
  // Restaurador: o reparo devolve 2.
  vantagem(eu, 'Inventor', 'Restaurador');
  Object.assign(radio, { durabilidadeAtual: 1, reparavel: true });
  comDados(0.99, () => executar(c, 'item.repararTeste', { id: eu.id, uid: 'r', sub: 'engenharia.eletrica' }, ctxM));
  assert.equal(radio.durabilidadeAtual, 3);
});

test('item.dar: passa o item (desequipado) para outro personagem; com quantidade, passa quantos escolher', () => {
  const { c, ps: [eu, ele] } = campo();
  eu.donoId = ana.id;
  eu.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', equipado: true, slot: 'maos' }, { uid: 'b', nome: 'Bala', tipo: 'municao', quantidade: 10 }];
  executar(c, 'item.dar', { id: eu.id, uid: 'f', para: ele.id }, ctxA);
  assert.ok(!eu.itens.some(i => i.nome === 'Faca'));
  assert.equal(ele.itens.find(i => i.nome === 'Faca').equipado, false);
  executar(c, 'item.dar', { id: eu.id, uid: 'b', para: ele.id, quantidade: 4 }, ctxA);
  assert.equal(eu.itens.find(i => i.nome === 'Bala').quantidade, 6);
  assert.equal(ele.itens.find(i => i.nome === 'Bala').quantidade, 4);
  assert.throws(() => executar(c, 'item.dar', { id: ele.id, uid: ele.itens[0].uid, para: eu.id }, ctxA));
});

test('toda regra própria passa pelo motor de efeitos sem erro (MSA e MSS)', () => {
  for (const id of ['mss', 'msa']) {
    const s = sistema(id);
    for (const [k, regra] of Object.entries(s.habilidadesRegras)) {
      if (k.startsWith('_')) continue;
      assert.doesNotThrow(() => R.efeitosHabilidade({}, s, { id: k, nome: k, descricao: '', regra, vezes: 1 }), k);
      if (regra.contra) assert.ok(Array.isArray(regra.contra), `${k}: "contra" é lista de tipos de criatura`);
    }
  }
});
