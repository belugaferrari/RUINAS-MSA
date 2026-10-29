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
const { acoesDaHabilidade, listaHabilidades, dadosDaHabilidade } = R;
const { sincronizarEfeitos, passarTurnoEfeitos } = await import('../shared/efeitos.js');
const C = await import('../shared/combate.js');

const mss = sistema('mss');
const mestre = { id: 'm', name: 'Mestre' };
const ana = { id: 'a', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
const ctxA = { user: ana, mestre: false };

test('tempo das habilidades vem do texto do livro (Despertar: bônus; Predador Apex: reação) e do lápis do mestre', () => {
  const cl = mss.classes.find(c => c.nome === 'Transmorfo');
  const esp = cl.especializacoes.find(e => /LICANT/.test(e.nome));
  const f = { classe: cl.id, especializacao: esp.id, nivel: 20, atributos: {} };
  const hs = listaHabilidades(f, mss);
  const de = n => hs.find(x => x.nome === n);
  assert.deepEqual(acoesDaHabilidade(f, mss, de('Despertar')).slice(0, 2), ['bonus', 'livre']);
  assert.equal(acoesDaHabilidade(f, mss, de('Predador Apex'))[0], 'reacao');
  assert.deepEqual(dadosDaHabilidade(de('Predador Apex')), ['1d8']);
  f.ajustesHabilidades = { [de('Licantropia').id]: 'ação: completa' };
  assert.deepEqual(acoesDaHabilidade(f, mss, de('Licantropia')), ['completa']);
});

test('economia do turno: o ataque gasta a principal; o 2º ataque avisa; o próximo turno devolve; fora do turno é reação', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Lia', 'Vaz'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const cb = c.salas.batalha.combate;
  const vez = cb.ordem[cb.vez].id, outro = ids.find(x => x !== vez);
  const r1 = executar(c, 'combate.atacar', { atacante: vez, alvo: outro, opcoes: { surpresa: true } }, ctxM);
  assert.ok(!r1.excesso);
  // O 2º ataque no mesmo turno é recusado (autor, 29/10) e nada muda.
  const antes = JSON.stringify(c.salas.batalha.log.length);
  assert.throws(() => executar(c, 'combate.atacar', { atacante: vez, alvo: outro, opcoes: { surpresa: true } }, ctxM), /já usou a ação principal/);
  assert.equal(JSON.stringify(c.salas.batalha.log.length), antes);
  // O outro ataca fora do turno: gasta a reação (1 por rodada).
  executar(c, 'combate.atacar', { atacante: outro, alvo: vez, opcoes: { surpresa: true } }, ctxM);
  assert.equal(cb.gasto[outro].reacao, 1);
  assert.throws(() => executar(c, 'combate.acao', { id: vez, tipo: 'completa', rotulo: 'teste' }, ctxM), /principal/);
  executar(c, 'combate.proximo', {}, ctxM);
  executar(c, 'combate.proximo', {}, ctxM);
  assert.ok(!cb.gasto[vez].principal, 'novo turno devolve a principal');
});

test('Sangramento: perde 1 PV já no 1º turno do afetado; depois a cada 1d4 turnos', () => {
  const p = { id: 'x', nome: 'X', pv: { max: 20, atual: 20 }, marcadores: ['Sangramento'] };
  sincronizarEfeitos(p, mss, { rng: () => 0.99 });
  const id = Object.keys(p.efeitos)[0];
  assert.equal(p.efeitos[id].turnos, 1);
  const notas = passarTurnoEfeitos(p, mss, () => 0.99);
  assert.equal(p.pv.atual, 19);
  assert.match(notas[0], /próxima perda em 4/);
});

test('só o mestre cancela efeitos', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const id = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Lia' } }, ctxM).id;
  const lia = c.personagens.find(p => p.id === id);
  Object.assign(lia, { donoId: ana.id, tipo: 'pj', marcadores: ['Sangramento'] });
  const ef = mss.condicoes.find(x => x.nome === 'Sangramento').id;
  assert.throws(() => executar(c, 'efeito.turnos', { id, efeito: ef, turnos: 0 }, ctxA));
  executar(c, 'efeito.turnos', { id, efeito: ef, turnos: 0 }, ctxM);
  assert.ok(!lia.marcadores.includes('Sangramento'));
});

test('reações e ações livres aparecem como ataque especial momentâneo para o alvo (Predador Apex só quando o ataque erra)', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const cl = mss.classes.find(x => x.nome === 'Transmorfo');
  const esp = cl.especializacoes.find(e => /LICANT/.test(e.nome));
  const ids = ['Lobo', 'Bandido'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const lobo = c.personagens.find(p => p.id === ids[0]);
  Object.assign(lobo, { classe: cl.id, especializacao: esp.id, nivel: 20 });
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const s = c.salas.batalha;
  const rnd = Math.random;
  try {
    Math.random = () => 0.02; // o ataque do Bandido erra (erro crítico)
    executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0], opcoes: { surpresa: true } }, ctxM);
  } finally { Math.random = rnd; }
  const nomes = s.ofertas.filter(o => o.personagem === lobo.id).map(o => o.habilidade);
  assert.ok(nomes.includes('Predador Apex'), nomes.join(','));
  assert.ok(nomes.includes('Despertar'));
  const apex = s.ofertas.find(o => o.habilidade === 'Predador Apex');
  assert.equal(apex.acao, 'reacao');
  assert.ok(apex.ataque);
  const r = executar(c, 'combate.oferta', { id: apex.id, aceitar: true, alvo: ids[1] }, ctxM);
  assert.ok(r.tipo === 'ataque' || r.id);
  s.ofertas = [];
  try {
    Math.random = () => 0.97; // agora acerta: Predador Apex não aparece
    delete c.salas.batalha.combate.gasto; // novo turno (cada ataque gasta a ação)
    executar(c, 'combate.atacar', { atacante: ids[1], alvo: ids[0], opcoes: { surpresa: true } }, ctxM);
  } finally { Math.random = rnd; }
  assert.ok(!s.ofertas.some(o => o.habilidade === 'Predador Apex'));
});

test('ataque contra vários alvos: uma ação e uma munição, resolvido contra cada alvo', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Atiradora', 'A', 'B', 'C'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const at = c.personagens.find(p => p.id === ids[0]);
  at.itens = [{ uid: 'g', nome: 'Granada', tipo: 'arma', dano: '2d6', tipoDano: 'Concussão', equipado: true, alcance: 'distancia', pericia: 'armas-de-fogo.pistolas', capacidade: 3, carregada: 3 }];
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.findIndex(o => o.id === ids[0]);
  const r = executar(c, 'combate.atacarVarios', { atacante: ids[0], alvos: ids.slice(1), opcoes: { armaUid: 'g', area: true } }, ctxM);
  assert.equal(r.resultados.length, 3);
  assert.equal(at.itens[0].carregada, 2, 'uma munição só');
  assert.equal(cb.gasto[ids[0]].principal, 1, 'uma ação só');
  assert.throws(() => executar(c, 'combate.atacarVarios', { atacante: ids[0], alvos: [ids[1]], opcoes: { armaUid: 'g' } }, ctxM), /dois alvos/);
});

test('Ataque Desarmado Treinado: automático, +1 só no ataque desarmado, não acumula; a conta do dano aparece', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Lutador', 'Alvo'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const lut = c.personagens.find(p => p.id === ids[0]);
  const v = mss.vantagens.find(x => x.nome === 'Ataque Desarmado Treinado');
  lut.vantagens = [v.id];
  lut.itens = [{ uid: 'f', nome: 'Faca', tipo: 'arma', dano: '1d4', tipoDano: 'Corte', equipado: true, alcance: 'corpo', pericia: 'arma-branca.laminas-curtas' }];
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const hab = listaHabilidades(lut, mss).find(x => x.nome === v.nome);
  const { modoHabilidade, danoDasHabilidades, ehAtaqueEspecial } = R;
  assert.equal(modoHabilidade(lut, mss, hab), 'sempre');
  assert.ok(!ehAtaqueEspecial(hab), 'é bônus passivo, não ataque especial');
  const desarmado = { uid: 'desarmado', alcance: 'corpo', pericia: 'briga.ataque-desarmado' };
  assert.deepEqual(danoDasHabilidades(lut, mss, desarmado).partes, [{ nome: v.nome, fixo: 1 }]);
  assert.deepEqual(danoDasHabilidades(lut, mss, { uid: 'f', alcance: 'corpo', pericia: 'arma-branca.laminas-curtas' }).partes, []);
  // Ligar/desligar várias vezes não acumula.
  for (let i = 0; i < 4; i++) executar(c, 'personagem.atualizar', { id: lut.id, patch: { ativas: i % 2 ? [] : [hab.id] } }, ctxM);
  assert.equal(danoDasHabilidades(lut, mss, desarmado).partes.length, 1);
  const rnd = Math.random;
  try {
    Math.random = () => 0.97;
    const r = executar(c, 'combate.atacar', { atacante: ids[0], alvo: ids[1], opcoes: { surpresa: true, armaUid: 'desarmado' } }, ctxM);
    assert.match(r.texto, /\(Ataque Desarmado Treinado\)/);
    assert.match(r.texto, /tomou \d+ de dano = /);
    delete c.salas.batalha.combate.gasto; // novo turno (cada ataque gasta a ação)
    const r2 = executar(c, 'combate.atacar', { atacante: ids[0], alvo: ids[1], opcoes: { surpresa: true, armaUid: 'f' } }, ctxM);
    assert.ok(!/Ataque Desarmado Treinado/.test(r2.texto), 'não soma no ataque armado');
  } finally { Math.random = rnd; }
});

test('ataque especial ataca de verdade, soma o bônus uma vez e gasta a ação dele (principal se o livro não diz)', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Soldado', 'Alvo'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const sol = c.personagens.find(p => p.id === ids[0]);
  const cl = mss.classes.find(x => x.nome === 'Transmorfo');
  Object.assign(sol, { classe: cl.id, especializacao: cl.especializacoes.find(e => /LICANT/.test(e.nome)).id, nivel: 20 });
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const apex = listaHabilidades(sol, mss).find(x => x.nome === 'Predador Apex');
  assert.ok(R.ehAtaqueEspecial(apex));
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.findIndex(o => o.id === ids[0]);
  const rnd = Math.random;
  try {
    Math.random = () => 0.97;
    const r = executar(c, 'combate.atacar', { atacante: ids[0], alvo: ids[1], opcoes: { surpresa: true, especial: apex.id } }, ctxM);
    assert.equal((r.texto.match(/Predador Apex/g) || []).length, 1, r.texto);
    assert.match(r.rotulo, /Predador Apex/);
  } finally { Math.random = rnd; }
  assert.equal(cb.gasto[ids[0]].reacao, 1, 'Predador Apex é reação');
});

test('duas armas: hábil sem ônus, inábil −20%; dois ataques (um com cada mão) −20%/−40% numa ação só; Ambidestria muda', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Bal', 'Alvo'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const bal = c.personagens.find(p => p.id === ids[0]);
  const faca = (uid, mao) => ({ uid, nome: `Faca ${uid}`, tipo: 'arma', slot: 'maos', mao, dano: '1d4', tipoDano: 'Corte', equipado: true, alcance: 'corpo', pericia: 'arma-branca.laminas-curtas' });
  bal.itens = [faca('d', 0), faca('e', 1)];
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.findIndex(o => o.id === ids[0]);
  const ataque = (uid, extra = {}) => executar(c, 'combate.atacar', { atacante: ids[0], alvo: ids[1], opcoes: { surpresa: true, armaUid: uid, ...extra } }, ctxM);
  const mod = r => ((JSON.stringify(r).match(/(mão inábil|dois ataques \(mão [^)]+\)|segundo ataque \(Ambidestria\)) [−-]\d+/) || [''])[0]).replace('−', '-').replace(/%$/, '');
  const novoTurno = () => { cb.gasto = {}; };
  assert.equal(mod(ataque('d')), '');
  novoTurno();
  assert.equal(mod(ataque('e')), 'mão inábil -20');
  novoTurno();
  assert.equal(mod(ataque('d', { doisAtaques: true })), 'dois ataques (mão hábil) -20');
  const r2 = ataque('e');
  assert.equal(mod(r2), 'dois ataques (mão inábil) -40');
  assert.ok(!r2.excesso, 'o segundo ataque gasta a ação bônus (sem passar do limite)');
  assert.equal(cb.gasto[ids[0]].principal, 1);
  assert.equal(cb.gasto[ids[0]].bonus, 1);
  // Ambidestria: sem mão inábil; nos dois ataques, só o segundo tem −20%.
  bal.vantagens = [mss.vantagens.find(x => x.nome === 'Ambidestria').id];
  novoTurno();
  assert.equal(mod(ataque('e')), '');
  novoTurno();
  assert.equal(mod(ataque('e', { doisAtaques: true })), '');
  assert.equal(mod(ataque('d')), 'segundo ataque (Ambidestria) -20');
});

test('Despertar: dura o combate, ícone de ativa, não ativa de novo; PV temporários e arma natural (perfuração, +1 por Corpo monstruoso)', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Lobo', 'Alvo'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  const lobo = c.personagens.find(p => p.id === ids[0]);
  const cl = mss.classes.find(x => x.nome === 'Transmorfo');
  Object.assign(lobo, { classe: cl.id, especializacao: cl.especializacoes.find(e => /LICANT/.test(e.nome)).id, nivel: 6 });
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const hab = listaHabilidades(lobo, mss).find(x => x.nome === 'Despertar');
  const corpo = listaHabilidades(lobo, mss).find(x => x.nome === 'Corpo monstruoso')?.vezes || 0;
  const { armasDisponiveis, imuneA } = C;
  assert.ok(!armasDisponiveis(lobo, mss).some(a => a.uid === 'natural'), 'sem despertar, sem garras');
  const pvAntes = lobo.pv.atual;
  executar(c, 'habilidade.usar', { id: lobo.id, hab: hab.id }, ctxM);
  assert.ok(lobo.habAtivas[hab.id].combate);
  assert.ok(lobo.pvTemp >= 1 + corpo && lobo.pvTemp <= 6 + corpo);
  assert.equal(lobo.humor, 'corajoso');
  assert.ok(imuneA(lobo, mss, 'Amedrontado'));
  assert.equal(R.textoPv(lobo), `${pvAntes}+${lobo.pvTemp}/${lobo.pv.max}`);
  const nat = armasDisponiveis(lobo, mss).find(a => a.uid === 'natural');
  assert.equal(nat.tipoDano, 'Perfuração');
  assert.equal(nat.dano, mss.combate.desarmado.dano);
  assert.deepEqual(nat.bonusNatural, [{ nome: 'Despertar', fixo: 1 + corpo }]);
  // O jogador não ativa de novo; o mestre encerra.
  lobo.donoId = ana.id;
  assert.throws(() => executar(c, 'habilidade.ativar', { id: lobo.id, hab: hab.id }, ctxA), /já está ativa/);
  assert.throws(() => executar(c, 'habilidade.usar', { id: lobo.id, hab: hab.id }, ctxA), /já está ativa/);
  assert.throws(() => executar(c, 'habilidade.encerrar', { id: lobo.id, hab: hab.id }, ctxA));
  executar(c, 'habilidade.encerrar', { id: lobo.id, hab: hab.id }, ctxM);
  assert.ok(!lobo.habAtivas[hab.id] && !lobo.pvTemp);
  assert.equal(lobo.humor, 'neutro');
});

test('PV temporários saem por último: o dano tira dos normais até 0, depois dos verdes', () => {
  const p = { pv: { max: 54, atual: 54 }, pvTemp: 3 };
  R.perderPv(p, 10);
  assert.deepEqual([p.pv.atual, p.pvTemp], [44, 3]);
  R.perderPv(p, 46);
  assert.deepEqual([p.pv.atual, p.pvTemp], [0, 1]);
  R.perderPv(p, 4);
  assert.equal(p.pv.atual, -3);
  assert.ok(!p.pvTemp);
});

test('fichas de teste vêm com itens (até 3000 créditos) já equipados; "Dar itens" serve as antigas sem itens', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  executar(c, 'teste.fichas', { nivel: 6 }, ctxM);
  const fichas = c.personagens.filter(p => p.fichaTeste);
  assert.ok(fichas.length >= 5);
  for (const p of fichas) {
    const total = p.itens.reduce((s, i) => s + (i.preco || 0), 0);
    assert.ok(total <= 3000, `${p.nome}: ${total}`);
    if (p.itens.some(i => i.tipo === 'arma')) assert.ok(p.itens.some(i => i.tipo === 'arma' && i.equipado), `${p.nome} sem arma equipada: ${JSON.stringify(p.itens.map(i => [i.nome, i.slot, i.ocupa, i.equipado]))}`);
  }
  // Só as que estão sem itens recebem (no catálogo de exemplo, o kit pode sair vazio).
  for (const p of fichas) p.itens = [{ uid: 'x', nome: 'x', tipo: 'arma', equipado: true }];
  fichas[0].itens = [];
  const r = executar(c, 'teste.itens', {}, ctxM);
  assert.deepEqual(r.relatorio.map(x => x.nome), [fichas[0].nome]);
  // "Trocar": todas recebem o kit novo no lugar do que tinham.
  const r2 = executar(c, 'teste.itens', { trocar: true }, ctxM);
  assert.equal(r2.relatorio.length, fichas.length);
  assert.ok(fichas.every(p => !p.itens.some(i => i.uid === 'x')));
  assert.throws(() => executar(c, 'teste.itens', {}, ctxA));
});

test('ataque em área no mapa: o servidor recalcula a área, pega quem está dentro (aliados também) e cada um faz Evasão', () => {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const ids = ['Granadeira', 'A', 'B', 'Longe'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of ids) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const gr = c.personagens.find(p => p.id === ids[0]);
  gr.itens = [{ uid: 'g', nome: 'Granada', tipo: 'arma', dano: '2d6', tipoDano: 'Concussão', equipado: true, alcance: 'distancia', pericia: 'armas-de-fogo.pistolas', capacidade: 3, carregada: 3 }];
  c.mapa = { imagemId: 'x', grade: { colunas: 20, ox: 0, oy: 0, visivel: true }, pecas: { [ids[0]]: { col: 0, lin: 0 }, [ids[1]]: { col: 6, lin: 6 }, [ids[2]]: { col: 7, lin: 6 }, [ids[3]]: { col: 15, lin: 15 } } };
  const cb = c.salas.batalha.combate;
  cb.vez = cb.ordem.findIndex(o => o.id === ids[0]);
  const r = executar(c, 'combate.atacarArea', { atacante: ids[0], forma: 'circulo', metros: 3, ponto: { x: 6.5, y: 6.5 }, opcoes: { armaUid: 'g' } }, ctxM);
  assert.deepEqual(r.resultados.map(x => x.alvo).sort(), [ids[1], ids[2]].sort());
  assert.equal(gr.itens[0].carregada, 2, 'uma munição só');
  assert.equal(cb.gasto[ids[0]].principal, 1, 'uma ação só');
  // Defesa de área: Evasão está entre as opções de quem foi pego.
  const pend = c.salas.batalha.pendentes.find(x => x.alvo === ids[1]);
  if (pend) assert.ok(pend.area);
  assert.throws(() => executar(c, 'combate.atacarArea', { atacante: ids[0], forma: 'quadrado', metros: 3, ponto: { x: 1, y: 1 } }, ctxM), /forma/);
  delete c.mapa.pecas[ids[0]];
  assert.throws(() => executar(c, 'combate.atacarArea', { atacante: ids[0], forma: 'circulo', metros: 3, ponto: { x: 1, y: 1 } }, ctxM), /precisa estar no mapa/);
});

test('objetos do mapa: cobertura automática no tiro (parcial −30%, total sem tiro, o mestre ignora), obstáculo no movimento, pintar e modo fantasma', async () => {
  const O = await import('../shared/objetosMapa.js');
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  const [atir, alvo] = ['Atiradora', 'Alvo'].map(nome => executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome } }, ctxM).id);
  for (const id of [atir, alvo]) executar(c, 'sala.adicionar', { sala: 'batalha', id }, ctxM);
  const a = c.personagens.find(p => p.id === atir);
  a.itens = [{ uid: 'p', nome: 'Pistola', tipo: 'arma', dano: '1d6', tipoDano: 'Perfuração', equipado: true, alcance: 'distancia', pericia: 'armas-de-fogo.pistolas' }];
  c.mapa = { imagemId: 'x', grade: { colunas: 20, ox: 0, oy: 0, visivel: true }, pecas: { [atir]: { col: 0, lin: 0 }, [alvo]: { col: 6, lin: 0 } }, objetos: [] };
  const cb = c.salas.batalha.combate;
  const atirar = (op = {}, ctx = ctxM) => { cb.vez = cb.ordem.findIndex(o => o.id === atir); cb.gasto = {}; return executar(c, 'combate.atacar', { atacante: atir, alvo, opcoes: { armaUid: 'p', surpresa: true, ...op } }, ctx); };
  // Mesa no caminho: cobertura parcial (−30% no acerto, com o nome do objeto).
  executar(c, 'mapa.objeto', { tipo: 'mesa', col: 3, lin: 0 }, ctxM);
  assert.deepEqual(O.coberturaPeloMapa(c, atir, alvo), { nivel: 'parcial', objeto: 'Mesa' });
  assert.match(JSON.stringify(atirar()), /cobertura parcial do alvo \(Mesa\)/);
  // Árvore (cobertura total, autor 25/10): sem linha de tiro; o mestre pode ignorar.
  executar(c, 'mapa.objeto', { tipo: 'arvore', col: 4, lin: 0 }, ctxM);
  assert.throws(() => atirar(), /cobertura total \(Árvore\)/);
  assert.ok(!/cobertura/.test(JSON.stringify(atirar({ ignorarCoberturaMapa: true }))), 'mestre ignora');
  // Árvore bloqueia a passagem e a visão.
  assert.throws(() => executar(c, 'mapa.mover', { id: alvo, col: 4, lin: 0 }, ctxM), /bloqueia/);
  assert.ok(!O.enxerga(c, atir, alvo));
  // Pintar parede: um pedaço por quadrado, sem repetir.
  executar(c, 'mapa.pintar', { tipo: 'parede', quadrados: [{ col: 10, lin: 0 }, { col: 10, lin: 1 }, { col: 10, lin: 1 }] }, ctxM);
  assert.equal(c.mapa.objetos.filter(o => o.tipo === 'parede').length, 2);
  assert.throws(() => executar(c, 'mapa.pintar', { tipo: 'mesa', quadrados: [{ col: 1, lin: 1 }] }, ctxM), /não se pinta/);
  // Porta aberta: o mestre tira a cobertura e o bloqueio.
  executar(c, 'mapa.objeto', { tipo: 'porta', col: 12, lin: 5 }, ctxM);
  const porta = c.mapa.objetos.at(-1);
  executar(c, 'mapa.objetoRegras', { id: porta.id, regras: { cobertura: 'nenhuma', bloqueia: false, visao: false } }, ctxM);
  assert.equal(O.regrasObjeto(porta).cobertura, null);
  // Modo fantasma: NPC fora da visão de todos os PJs fica invisível para os jogadores.
  const pj = executar(c, 'personagem.criar', { tipo: 'pj', ficha: { nome: 'Lia' } }, ctxM).id;
  c.mapa.pecas[pj] = { col: 0, lin: 2 };
  c.personagens.find(p => p.id === pj).tipo = 'pj';
  c.mapa.objetos.push({ id: 'muro', tipo: 'parede', col: 3, lin: 0, l: 1, a: 6 });
  assert.ok(O.foraDaVisaoDosPJs(c).includes(alvo), 'atrás do muro: nenhum PJ enxerga');
  executar(c, 'mapa.fantasmas', { ocultar: true }, ctxM);
  assert.ok(c.mapa.pecas[alvo].oculto);
  executar(c, 'mapa.fantasmas', { ocultar: false }, ctxM);
  assert.ok(!c.mapa.pecas[alvo].oculto);
  assert.throws(() => executar(c, 'mapa.fantasmas', {}, { user: { id: 'j' }, mestre: false }));
});
