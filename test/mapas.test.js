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
  assert.equal([c.mapa, ...c.mapas].length, 5);
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
  assert.throws(() => executar(c, 'mapa.mover', { id: pj, col: 30, lin: 30 }, ctxM), /Fora do mapa/);
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
