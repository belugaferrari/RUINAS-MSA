// Mapas ligados, passagens e fogs (autor, 01/11).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { novaCampanha, executar, visaoPara } = await import('../server/actions.js');
const V = await import('../shared/visao.js');

const mestre = { id: 'm', name: 'Mestre' };
const jogador = { id: 'j', name: 'Ana' };
const ctxM = { user: mestre, mestre: true };
function campo() {
  const c = novaCampanha(mestre, { nome: 'T', maxJogadores: 2, nivel: 1, sistema: 'mss' });
  c.jogadores.push(jogador.id);
  executar(c, 'mapa.exemplos', {}, ctxM);
  const pj = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Lia' } }, ctxM).id;
  const npc = executar(c, 'personagem.criar', { tipo: 'npc', grupoId: 'encontros', ficha: { nome: 'Lobo' } }, ctxM).id;
  const p = c.personagens.find(x => x.id === pj);
  Object.assign(p, { tipo: 'pj', donoId: jogador.id });
  return { c, pj, npc };
}
const porNome = (c, nome) => [c.mapa, ...c.mapas].find(m => m.nome === nome);

test('mapas de teste: 5 mapas, a vila vira o ativo, com vizinhos nos três lados e passagens ruínas ↔ caverna', () => {
  const { c } = campo();
  assert.equal(c.mapa.nome, 'Teste — Vila');
  assert.equal([c.mapa, ...c.mapas].length, 6, '5 + o mapa do mundo');
  const v = visaoPara(c, mestre, 'mestre').mapa;
  assert.deepEqual(v.vizinhosLista.map(x => [x.lado, x.dc, x.dl]).sort(), [['leste', 24, 0], ['norte', 0, -14], ['oeste', -20, 0]]);
  assert.equal(porNome(c, 'Teste — Ruínas').passagens[0].paraNome, undefined);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public/img/mapas-teste/vila.svg')));
});

test('continuidade: passar da borda leste leva o peão para a praia; voltar traz para a vila', () => {
  const { c, pj } = campo();
  c.mapa.pecas[pj] = { col: 23, lin: 7 };
  const r = executar(c, 'mapa.mover', { id: pj, col: 25, lin: 7 }, ctxM);
  assert.match(r.texto, /Praia/);
  assert.ok(!c.mapa.pecas[pj]);
  assert.deepEqual([porNome(c, 'Teste — Praia').pecas[pj].col, porNome(c, 'Teste — Praia').pecas[pj].lin], [1, 7]);
  assert.equal(porNome(c, 'Teste — Praia').pecas[pj].olhar, 90, 'olha para onde andou (leste)');
  executar(c, 'mapa.mover', { id: pj, col: 22, lin: 7 }, ctxM);
  assert.ok(c.mapa.pecas[pj]);
  executar(c, 'mapa.mover', { id: pj, col: 30, lin: 30 }, ctxM);
  assert.deepEqual([c.mapa.pecas[pj].col, c.mapa.pecas[pj].lin], [23, 15], 'fora de tudo: fica na beirada do mapa ativo');
});

test('passagem: a escada das ruínas leva à caverna; sem PJ no mundo visível, o mapa ativo muda para todos', () => {
  const { c, pj } = campo();
  executar(c, 'mapa.abrir', { id: porNome(c, 'Teste — Ruínas').id }, ctxM);
  c.mapa.pecas[pj] = { col: 12, lin: 6 };
  const r = executar(c, 'mapa.mover', { id: pj, col: 12, lin: 4 }, ctxM);
  assert.equal(r.atravessou, 'Teste — Caverna');
  assert.equal(c.mapa.nome, 'Teste — Caverna');
  assert.deepEqual([c.mapa.pecas[pj].col, c.mapa.pecas[pj].lin], [3, 9]);
});

test('vizinhos recíprocos e apagar mapa limpa as ligações', () => {
  const { c } = campo();
  const novo = executar(c, 'mapa.criar', { nome: 'Pântano' }, ctxM).id;
  executar(c, 'mapa.vizinho', { lado: 'sul', id: novo }, ctxM);
  assert.equal(porNome(c, 'Pântano').vizinhos.norte, c.mapa.id);
  assert.throws(() => executar(c, 'mapa.apagar', { id: c.mapa.id }, ctxM), /Abra outro/);
  executar(c, 'mapa.apagar', { id: novo }, ctxM);
  assert.ok(!c.mapa.vizinhos.sul);
});

test('fog absoluta: só o que um PJ viu fica explorado; o jogador não recebe objetos nem NPCs no escuro', () => {
  const { c, pj, npc } = campo();
  c.mapa.pecas[npc] = { col: 22, lin: 14 };
  executar(c, 'mapa.mover', { id: pj, col: 1, lin: 8 }, ctxM);
  const exp = new Set(c.mapa.explorado);
  assert.ok(exp.has('1:8') && exp.size > 10);
  assert.ok(!exp.has('22:14'), 'longe e atrás das casas');
  const vj = visaoPara(c, jogador, 'jogador').mapa;
  assert.ok(!vj.pecas[npc], 'o Lobo está no escuro');
  assert.ok(vj.objetos.length < c.mapa.objetos.length);
  assert.ok(visaoPara(c, mestre, 'mestre').mapa.pecas[npc], 'o mestre vê');
  executar(c, 'mapa.revelar', { tudo: true }, ctxM);
  assert.equal(visaoPara(c, jogador, 'jogador').mapa.objetos.length, c.mapa.objetos.length);
});

test('fog pessoal: cone de 90° para onde olha; virar para o NPC faz ele aparecer; campo de visão maior pega mais', () => {
  const { c, pj, npc } = campo();
  executar(c, 'mapa.revelar', { tudo: true }, ctxM);
  c.mapa.pecas[pj] = { col: 11, lin: 9, olhar: 0 };
  c.mapa.pecas[npc] = { col: 11, lin: 13 };
  executar(c, 'mapa.olhar', { id: pj, direcao: 0 }, ctxM);
  assert.ok(!visaoPara(c, jogador, 'jogador').mapa.pecas[npc], 'olhando para o norte, o Lobo (ao sul) não aparece');
  executar(c, 'mapa.olhar', { id: pj, direcao: 180 }, { user: jogador, mestre: false });
  assert.ok(visaoPara(c, jogador, 'jogador').mapa.pecas[npc]);
  const partes = V.partesDoMundo(c.mapa, () => null);
  const estreito = V.quadradosVisiveis(partes, { col: 11, lin: 9 }, 1, { campo: 90, direcao: 0 });
  const largo = V.quadradosVisiveis(partes, { col: 11, lin: 9 }, 1, { campo: 180, direcao: 0 });
  assert.ok(largo.size > estreito.size);
});

test('visão: a parede esconde o que está atrás dela', () => {
  const m = { id: 'x', grade: { colunas: 10, proporcao: 1 }, objetos: [{ tipo: 'parede', col: 5, lin: 0, l: 1, a: 10 }], pecas: {} };
  const vis = V.quadradosVisiveis(V.partesDoMundo(m, () => null), { col: 2, lin: 5 }, 1);
  assert.ok(vis.has('5:5'), 'vê a parede');
  assert.ok(!vis.has('7:5'), 'não vê atrás');
  assert.ok(vis.has('3:5'));
});

test('mapa do mundo (continental): todos recebem; fog abre em volta do PJ; pins só do dono e do mestre; só o mestre move o grupo', () => {
  const { c, pj } = campo();
  const ana2 = { id: 'k', name: 'Bia' };
  const vj = visaoPara(c, jogador, 'jogador');
  assert.ok(vj.continental, 'a jogadora abre o mapa do mundo');
  assert.equal(vj.continental.fog.explorado.length, 0, 'começa todo coberto');
  const mundo = [c.mapa, ...c.mapas].find(m => m.continental);
  executar(c, 'mapa.mover', { id: pj, col: 14, lin: 12, mapaId: mundo.id }, ctxM);
  assert.ok(mundo.explorado.includes('14:12') && mundo.explorado.includes('16:12') && !mundo.explorado.includes('30:30'));
  executar(c, 'mapa.mover', { id: pj, col: 34, lin: 12, mapaId: mundo.id }, ctxM);
  assert.ok(mundo.explorado.includes('24:12'), 'abriu o caminho entre os dois pontos');
  assert.throws(() => executar(c, 'mapa.mover', { id: pj, col: 15, lin: 12, mapaId: mundo.id }, { user: jogador, mestre: false }), /mestre/);
  executar(c, 'mapa.pin', { x: 14.5, y: 12.5, texto: 'Acampamento' }, { user: jogador, mestre: false });
  executar(c, 'mapa.pin', { x: 20, y: 20, texto: 'Segredo do mestre' }, ctxM);
  assert.deepEqual(visaoPara(c, jogador, 'jogador').continental.pins.map(p => p.texto), ['Acampamento']);
  assert.equal(visaoPara(c, ana2, 'jogador').continental.pins.length, 0);
  assert.equal(visaoPara(c, mestre, 'mestre').continental.pins.length, 2);
  assert.throws(() => executar(c, 'mapa.pinEditar', { id: mundo.pins[0].id, remover: true }, { user: ana2, mestre: false }), /não é seu/);
});

test('clima no mapa: o mestre escolhe o efeito, a intensidade e o vento', () => {
  const { c } = campo();
  executar(c, 'mapa.clima', { efeito: 'neve', intensidade: 3, vento: 95 }, ctxM);
  assert.deepEqual(c.mapa.clima, { efeito: 'neve', intensidade: 3, vento: 90 });
  assert.equal(visaoPara(c, jogador, 'jogador').mapa.clima.efeito, 'neve');
  assert.throws(() => executar(c, 'mapa.clima', { efeito: 'meteoro' }, ctxM), /desconhecido/);
});

const D = await import('../shared/desenhoMapa.js');
const { criarExtensao } = await import('../server/actions.js');

test('extensão com IA: o plano é conferido contra a grade, vira SVG e objetos de regra; o mapa novo nasce vizinho', () => {
  const plano = D.planoValido({
    nome: 'Posto abandonado', descricao: 'Um posto.', piso: 'terra',
    terrenos: [{ tipo: 'agua', caixa: [0, 0, 2, 1] }, { tipo: 'lava', caixa: [1, 1, 2, 2] }],
    caminhos: [{ tipo: 'rio', largura: 1, pontos: [[5, 0], [5, 3]] }, { tipo: 'asfalto', largura: 2, pontos: [[0, 7], [23, 7]] }],
    objetos: [{ tipo: 'parede', nome: 'Muro', col: 10, lin: 2, l: 5, a: 1 }, { tipo: 'dragao', col: 1, lin: 1 }, { tipo: 'arvore', col: 99, lin: 99 }],
  }, 24, 16);
  assert.equal(plano.terrenos.length, 1, 'tipo de terreno inválido fica de fora');
  assert.ok(plano.objetos.some(o => o.tipo === 'parede' && o.l === 5));
  assert.ok(!plano.objetos.some(o => o.tipo === 'dragao'));
  assert.ok(plano.objetos.some(o => o.tipo === 'arvore' && o.col === 23 && o.lin === 15), 'fora da grade é trazido para dentro');
  assert.ok(plano.objetos.filter(o => o.tipo === 'agua').length >= 5, 'água do terreno e do rio viram objetos');
  const svg = D.svgDoPlano(plano, 24, 16);
  assert.match(svg, /^<svg[^>]+width="1536" height="1024"/);
  const { c } = campo();
  const m = criarExtensao(c, { lado: 'sul', nome: plano.nome, url: '/uploads/x.svg', colunas: 24, linhas: 16, objetos: plano.objetos, descricao: plano.descricao });
  assert.equal(c.mapa.vizinhos.sul, m.id);
  assert.equal(m.vizinhos.norte, c.mapa.id);
  assert.equal(m.fog.absoluta, true);
  assert.ok(m.objetos.length > 3);
  assert.throws(() => criarExtensao(c, { lado: 'sul', nome: 'X', url: '/x', colunas: 24, linhas: 16 }), /já tem vizinho/);
  assert.match(D.pedidoExtensao({ lado: 'leste', diretrizes: 'posto', colunasAtual: 24, linhasAtual: 16, colunas: 24, linhas: 16 }), /borda esquerda \(oeste\)/);
});

test('mover: soltar além da borda sem vizinho fica na beirada; sem a proporção guardada, as linhas de baixo valem; a proporção vem de qualquer tela', () => {
  const { c, pj } = campo();
  executar(c, 'mapa.vizinho', { lado: 'sul', id: null }, ctxM);
  c.mapa.pecas[pj] = { col: 3, lin: 3 };
  executar(c, 'mapa.mover', { id: pj, col: 4, lin: 40 }, ctxM);
  assert.deepEqual([c.mapa.pecas[pj].col, c.mapa.pecas[pj].lin], [4, 15]);
  delete c.mapa.grade.proporcao;
  executar(c, 'mapa.mover', { id: pj, col: 4, lin: 30 }, ctxM);
  assert.equal(c.mapa.pecas[pj].lin, 30, 'sem proporção: não recusa');
  executar(c, 'mapa.proporcao', { id: c.mapa.id, proporcao: 1.5 }, { user: jogador, mestre: false });
  assert.equal(c.mapa.grade.proporcao, 1.5);
  executar(c, 'mapa.proporcao', { id: c.mapa.id, proporcao: 0.5 }, { user: jogador, mestre: false });
  assert.equal(c.mapa.grade.proporcao, 1.5, 'o jogador só preenche quando falta');
});
