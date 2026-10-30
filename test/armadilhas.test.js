// Armadilhas (Capítulo 8 e planilha do autor de 15/10): calculadora de ND igual ao exemplo do livro; planilha de ida e volta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const P = await import('../server/armadilhasPlanilha.js');
const { calcularArmadilha } = await import('../shared/armadilhas.js');

test('exemplo do livro: fio tensionado, explosão de 3 m (2 passos), 2D6, ácido → produzir 140; armar/encontrar/desarmar 60', () => {
  const r = calcularArmadilha(sistema('mss').armadilhas, { gatilho: 'Fio Tensionado (Tripwire)', area: 'explosao', passos: 2, dano: '2d6', efeitos: ['Queimadura por ácido'] });
  assert.deepEqual([r.criar, r.armar, r.encontrar, r.desarmar], [140, 60, 60, 60]);
  const manual = calcularArmadilha(sistema('mss').armadilhas, { gatilho: 'Ativação Manual', area: 'unico', dano: '1d4', efeitos: [] });
  assert.deepEqual([manual.criar, manual.encontrar, manual.desarmar], [50, 80, 30]);
});

test('planilha de armadilhas: ida e volta igual; mudar um gatilho muda a calculadora; voltar desfaz', async () => {
  const tab = sistema('mss').armadilhas;
  assert.equal(tab.prontas.length, 7);
  const buf = Buffer.from(await P.planilhaArmadilhas(tab));
  const { tabela, avisos } = await P.lerPlanilhaArmadilhas(buf, tab);
  assert.deepEqual(avisos, []);
  assert.deepEqual(tabela, tab);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  wb.getWorksheet('Gatilhos').getRow(3).getCell(2).value = 15; // Fio Tensionado: criar +15
  const r2 = await P.lerPlanilhaArmadilhas(Buffer.from(await wb.xlsx.writeBuffer()), tab);
  P.salvarCatalogoArmadilhas({ ...r2.tabela, total: r2.total }, 'teste.xlsx');
  const r = calcularArmadilha(sistema('mss').armadilhas, { gatilho: 'Fio Tensionado (Tripwire)', area: 'unico', dano: '1d4', efeitos: [] });
  assert.equal(r.criar, 65);
  P.voltarArmadilhasPadrao();
  assert.equal(calcularArmadilha(sistema('mss').armadilhas, { gatilho: 'Fio Tensionado (Tripwire)', area: 'unico', dano: '1d4', efeitos: [] }).criar, 60);
});
