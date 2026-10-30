// Cibernéticos (classe Ciborgue e autor, 30/10): limite de implantes, Humanidade −10 provisória, planilha de ida e volta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const P = await import('../server/ciberneticosPlanilha.js');
const { implantesDoCatalogo, limiteImplantes } = await import('../shared/ciberneticos.js');

test('limite de implantes: 1 para qualquer um; Ciborgue 2 no nível 3 e +1 a cada 4 níveis, até 6 no 19', () => {
  const s = sistema('mss');
  const cib = s.classes.find(c => c.nome === 'Ciborgue').id;
  assert.deepEqual([1, 3, 7, 11, 15, 19, 20].map(n => limiteImplantes({ classe: cib, nivel: n }, s)), [1, 2, 3, 4, 5, 6, 6]);
  assert.equal(limiteImplantes({ classe: s.classes.find(c => c.nome === 'Perito').id, nivel: 20 }, s), 1);
});

test('implantes do catálogo com Humanidade −10; planilha de ida e volta; mudança vale no app; voltar desfaz', async () => {
  const s = sistema('mss');
  const lista = implantesDoCatalogo(s);
  assert.ok(lista.length > 40 && lista.every(x => x.humanidade === -10));
  const buf = Buffer.from(await P.planilhaCiberneticos(s));
  const { tabela, avisos } = await P.lerPlanilhaCiberneticos(buf, s);
  assert.deepEqual(avisos, []);
  assert.deepEqual(tabela.regras, s.ciberneticos.regras);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Implantes');
  ws.getRow(2).getCell(3).value = 'Membro';
  ws.getRow(2).getCell(5).value = -15;
  const r = await P.lerPlanilhaCiberneticos(Buffer.from(await wb.xlsx.writeBuffer()), s);
  P.salvarCatalogoCiberneticos({ ...r.tabela, total: r.total }, 'teste.xlsx');
  const x = implantesDoCatalogo(sistema('mss')).find(i => i.item === ws.getRow(2).getCell(1).value);
  assert.deepEqual([x.tipo, x.humanidade], ['Membro', -15]);
  P.voltarCiberneticosPadrao();
  assert.equal(implantesDoCatalogo(sistema('mss')).find(i => i.item === x.item).humanidade, -10);
});
