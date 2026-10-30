// Aprimoramentos de itens por planilha (autor, 30/10): lista do livro; ida e volta igual; linha nova e repetida.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const P = await import('../server/aprimoramentosPlanilha.js');

test('aprimoramentos: os 13 do livro; ida e volta igual (Radiante = Calor)', async () => {
  const lista = sistema('mss').aprimoramentos;
  assert.equal(lista.length, 13);
  assert.equal(lista.find(a => a.id === 'radiante').tipoExtra, 'Calor');
  const { aprimoramentos, avisos } = await P.lerPlanilhaAprimoramentos(Buffer.from(await P.planilhaAprimoramentos(lista)));
  assert.deepEqual(avisos, []);
  assert.deepEqual(aprimoramentos, lista);
});

test('aprimoramentos: linha nova de armadilha entra; código repetido vira aviso; voltar desfaz', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await P.planilhaAprimoramentos(sistema('mss').aprimoramentos)));
  const ws = wb.getWorksheet('Aprimoramentos');
  ws.addRow(['', 'Gatilho sensível', 'armadilha', 'ND Encontrar +10.', '', '', '', '', '', '', '', '', '', '', 'não']);
  ws.addRow(['afiado', 'Afiado de novo', '', 'x']);
  const { aprimoramentos, avisos } = await P.lerPlanilhaAprimoramentos(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.ok(avisos.some(a => /repetido/.test(a)));
  const novo = aprimoramentos.find(a => a.id === 'gatilho-sensivel');
  assert.deepEqual([novo.para, novo.repetivel], ['armadilha', false]);
  P.salvarCatalogoAprimoramentos(aprimoramentos, 'teste.xlsx');
  assert.equal(sistema('msa').aprimoramentos.length, 14);
  P.voltarAprimoramentosPadrao();
  assert.equal(sistema('msa').aprimoramentos.length, 13);
});
