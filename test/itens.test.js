import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const { converterLinha, lerPlanilhaItens, planilhaDoCatalogo } = await import('../server/itens.js');
const { rolarDado } = await import('../shared/regras.js');
const sis = sistema('mss');

const linha = extra => ({
  'num ctrl': '1206', Item: 'Taser de Longo Alcance', 'Peso (kg)': '0.5', 'Preço (créditos)': '600', Descrição: 'Dispara dardos.', Finalidade: 'Armamento',
  Categoria: 'Armas de Fogo', Qualidade: 'Boa', Durabilidade: '4', Raridade: 'Incomum', 'Pericia Base': 'Armas de Fogo', 'Pericia - Subgrupo': 'Pistolas',
  MAESTRIA: '1', Efeitos: 'Atordoar', Dano: '1d6', 'tipo de dano': 'Elétrico', ...extra,
});

test('planilha de itens: arma de fogo vira item do app', () => {
  const it = converterLinha(linha(), sis);
  assert.equal(it.id, 'i1206');
  assert.equal(it.tipo, 'arma');
  assert.equal(it.slot, 'maos');
  assert.equal(it.pericia, 'armas-de-fogo.pistolas');
  assert.equal(it.alcance, 'distancia');
  assert.equal(it.venda, 300);
  assert.equal(it.tipoDano, 'Elétrico');
});

test('planilha de itens: nomes antigos, proteção, bônus e colunas App', () => {
  assert.equal(converterLinha(linha({ 'Pericia Base': 'Combate', 'Pericia - Subgrupo': 'Haste' }), sis).pericia, 'arma-branca.lanca');
  const colete = converterLinha({ 'num ctrl': '7', Item: 'Armadura de Refugo', Finalidade: 'Proteção', Categoria: 'Armadura', Efeitos: 'Defesa +3', 'observação Efeitos': 'Penalidade AGI -1', Durabilidade: '3' }, sis);
  assert.equal(colete.tipo, 'defesa');
  assert.equal(colete.slot, 'corpo');
  assert.equal(colete.defesa, 3);
  assert.deepEqual(colete.bonus, { AGI: -1 });
  const ajustado = converterLinha(linha({ 'App: capacidade (balas)': '6', 'App: munição (tipo)': 'dardo', 'App: em revisão': 'sim' }), sis);
  assert.equal(ajustado.capacidade, 6);
  assert.equal(ajustado.municao, 'dardo');
  assert.equal(ajustado.revisao, true);
  assert.equal(converterLinha(linha({ Dano: '1d6+1d4' }), sis).dano, '1d6+1d4');
  assert.equal(converterLinha(linha({ Dano: '1d8+FOR' }), sis).dano, '1d8');
  assert.equal(converterLinha(linha({ Dano: 'Variável' }), sis).dano, undefined);
});

test('dados com soma de termos', () => {
  const r = rolarDado('1d6+1d4+2', () => 0.99);
  assert.deepEqual(r.dados, [6, 4]);
  assert.equal(r.total, 12);
  assert.throws(() => rolarDado('1d6+abc'), /inválido/);
});

test('planilha de itens: ida e volta pelo Excel', async () => {
  const itens = [converterLinha(linha(), sis), converterLinha(linha({ 'num ctrl': '1207', Item: 'Outro' }), sis)];
  const buffer = Buffer.from(await planilhaDoCatalogo(itens));
  const lidos = await lerPlanilhaItens(buffer, sis);
  assert.deepEqual(lidos.map(i => i.id), ['i1206', 'i1207']);
  assert.equal(lidos[0].pericia, 'armas-de-fogo.pistolas');
  const vazia = Buffer.from(await planilhaDoCatalogo([]));
  const semCabecalho = await lerPlanilhaItens(vazia, sis);
  assert.deepEqual(semCabecalho, [], 'planilha só com cabeçalho');
});

test('catálogo real carregado das planilhas do autor', () => {
  assert.ok(sis.itens.length > 1000, 'catálogo grande');
  assert.ok(sis.itens.every(i => !i.planilha), 'colunas originais não vão para o navegador');
  for (const i of sis.itens.filter(x => x.dano)) assert.doesNotThrow(() => rolarDado(i.dano), i.nome);
});

test('visibilidade: jogador vê só Mundano/Comum/Incomum, o resto só liberado', async () => {
  const { itemVisivel } = await import('../shared/regras.js');
  const raro = { id: 'r1', raridade: 'Raro' };
  assert.equal(itemVisivel({ raridade: 'Incomum' }, {}), true);
  assert.equal(itemVisivel({ raridade: 'Mundano' }, {}), true);
  assert.equal(itemVisivel(raro, {}), false);
  assert.equal(itemVisivel(raro, { itensLiberados: ['r1'] }), true);
  assert.equal(itemVisivel({ id: 'x', raridade: 'Lendário' }, { itensRarosVisiveis: true }), true);
  // No servidor: o jogador não compra item escondido; depois de liberado, compra.
  const { novaCampanha, executar, entrarNaCampanha } = await import('../server/actions.js');
  const m = { id: 'mv', name: 'Mestre V' }; const j = { id: 'jv', name: 'Jo' };
  const c = novaCampanha(m, { nome: 'Vis', maxJogadores: 1, nivel: 1, padraoMSA: true });
  executar(c, 'campanha.atualizar', { aberta: true, lojaAberta: true }, { user: m, mestre: true });
  entrarNaCampanha(c, j, 'jogador');
  const { id } = executar(c, 'personagem.criar', { tipo: 'pj', ficha: { nome: 'Jo' } }, { user: m, mestre: true });
  c.personagens.find(p => p.id === id).donoId = j.id;
  c.personagens.find(p => p.id === id).dinheiro = 1e9;
  const item = sis.itens.find(i => i.raridade === 'Raro');
  assert.throws(() => executar(c, 'item.comprar', { id, itemId: item.id }, { user: j, mestre: false }), /não está à venda/);
  executar(c, 'item.liberar', { itemId: item.id, liberar: true }, { user: m, mestre: true });
  executar(c, 'item.comprar', { id, itemId: item.id }, { user: j, mestre: false });
});
