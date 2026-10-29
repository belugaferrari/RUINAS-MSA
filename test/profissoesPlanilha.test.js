// Profissões por planilha (autor, 29/10): ida e volta igual ao livro (MSA sem Defesa desarmada); mudança vale no app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const P = await import('../server/profissoesPlanilha.js');
const R = await import('../shared/regras.js');

const gerar = async () => Buffer.from(await P.planilhaProfissoes(sistema('msa'), sistema('mss')));

test('profissões: exportar e ler de volta dá as mesmas do MSA e do MSS', async () => {
  const { catalogo, total, avisos } = await P.lerPlanilhaProfissoes(await gerar(), sistema('msa'), sistema('mss'));
  assert.deepEqual(avisos, []);
  assert.equal(total, sistema('mss').profissoes.length);
  for (const id of ['msa', 'mss']) assert.deepEqual(catalogo.sistemas[id], sistema(id).profissoes);
  assert.ok(!catalogo.sistemas.msa.find(p => p.id === 'protetor').subpericias.includes('briga.defesa-desarmada'));
});

test('profissões: mudar o bônus na planilha muda a ficha; subperícia inexistente vira aviso; voltar desfaz', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await gerar());
  const ws = wb.getWorksheet('Profissões');
  ws.eachRow((row, n) => { if (n > 1 && row.getCell(1).value === 'sobrevivente') { row.getCell(5).value = 10; row.getCell(6).value = `${row.getCell(6).value}; Briga/Inventada`; } });
  const { catalogo, total, avisos } = await P.lerPlanilhaProfissoes(Buffer.from(await wb.xlsx.writeBuffer()), sistema('msa'), sistema('mss'));
  assert.ok(avisos.some(a => /Inventada/.test(a)));
  P.salvarCatalogoProfissoes({ ...catalogo, total }, 'teste.xlsx');
  const ficha = { atributos: {}, profissao: 'sobrevivente' };
  assert.equal(R.derivados(ficha, sistema('mss')).bonusProfissao['esportes.escalada'], 10);
  P.voltarProfissoesPadrao();
  assert.equal(R.derivados(ficha, sistema('mss')).bonusProfissao['esportes.escalada'], 5);
});
