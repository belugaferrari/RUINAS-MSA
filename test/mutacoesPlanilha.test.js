// Tabela de mutações por planilha (autor, 29/10): ida e volta sem perder nada; a planilha do mestre vale no lugar da do autor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const P = await import('../server/mutacoesPlanilha.js');
const R = await import('../shared/regras.js');

test('mutações: exportar e ler de volta dá a mesma tabela', async () => {
  const original = sistema('mss').mutacoes;
  const { mutacoes, avisos } = await P.lerPlanilhaMutacoes(Buffer.from(await P.planilhaMutacoes(original)));
  assert.deepEqual(avisos, []);
  assert.deepEqual(mutacoes, original);
});

test('mutações: mudar o benefício na planilha muda o app (MSA e MSS); número repetido vira aviso; voltar desfaz', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await P.planilhaMutacoes(sistema('mss').mutacoes)));
  const ws = wb.getWorksheet('Mutações');
  ws.getRow(2).getCell(4).value = 'Manipulação +20%';
  ws.addRow([1, 'Repetida', 'x']);
  const { mutacoes, avisos } = await P.lerPlanilhaMutacoes(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.ok(avisos.some(a => /Repetida/.test(a)));
  P.salvarCatalogoMutacoes(mutacoes, 'teste.xlsx');
  for (const id of ['msa', 'mss']) assert.equal(R.mutacaoDaTabela(sistema(id), 1).beneficio, 'Manipulação +20%');
  P.voltarMutacoesPadrao();
  assert.equal(R.mutacaoDaTabela(sistema('mss'), 1).beneficio, 'Manipulação +10%');
});
