// Itens (autor, 28/10): bônus em % (Percepção −30% = −30% nos testes de PER e das perícias dele, não −30 no atributo),
// IP por tipo, maestria, planilha com as colunas "App: …" preenchidas e o desenho da arma na mão.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const R = await import('../shared/regras.js');
const I = await import('../server/itens.js');

const sis = sistema('mss');
const base = () => ({ ...R.novaFicha(sis, null), nivel: 3 });

test('Máscara de Solda Improvisada: −30% nos testes de Percepção (atributo e perícias de PER), o atributo não muda', () => {
  const mascara = sis.itens.find(i => i.nome === 'Máscara de Solda Improvisada');
  assert.deepEqual(mascara.bonus, { '%PER': -30 });
  const f = base();
  const antes = R.derivados(f, sis);
  f.itens = [{ ...mascara, equipado: true }];
  const d = R.derivados(f, sis);
  assert.equal(d.atributos.PER, antes.atributos.PER);
  assert.equal(d.percentual.PER, antes.percentual.PER - 30);
  const perPer = sis.pericias.find(p => p.atributo === 'PER');
  assert.equal(d.pericias[perPer.id], antes.pericias[perPer.id] - 30);
  assert.match(R.textoBonus(mascara), /PER −30%/);
});

test('coluna "App: bônus" e "App: IP": % de atributo, pontos de atributo, perícia por nome; IP por tipo', () => {
  assert.deepEqual(I.lerBonus('PER -30%; FOR +2; Furtividade +10%', sis), { '%PER': -30, FOR: 2, 'espionagem.furtividade': 10 });
  assert.deepEqual(I.lerIp('geral 1; físico 4'), { geral: 1, 'Físico': 4 });
  const item = { ipTipos: { geral: 1, 'Físico': 4 } };
  assert.equal(R.textoIp(item), 'IP 1 · IP 4 Físico');
  assert.equal(R.ipContraDano(R.ipDoItem(item), 'Corte'), 5);
});

test('planilha baixada: colunas "App: …" com o que o app usa e a aba Leia-me; volta igual ao ler', async () => {
  const itens = sis.itens.filter(i => ['Máscara de Solda Improvisada', 'Armadura Dérmica (Placas)'].includes(i.nome));
  const buf = await I.planilhaDoCatalogo(itens, sis);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  assert.ok(wb.getWorksheet('Leia-me'));
  const ws = wb.getWorksheet('itens');
  const cab = ws.getRow(1).values;
  const linha = ws.getRow(2).values;
  const col = n => linha[cab.indexOf(n)];
  assert.match(String(col('App: bônus')), /%$/);
  const lidos = await I.lerPlanilhaItens(Buffer.from(buf), sis);
  for (const it of itens) assert.deepEqual(lidos.find(x => x.nome === it.nome).bonus, it.bonus);
});

test('desenho da arma na mão pelo tipo: lâmina, machado, arma de fogo, projétil', () => {
  assert.equal(R.tipoDaArma({ pericia: 'arma-branca.machado' }), 'machado');
  assert.equal(R.tipoDaArma({ pericia: 'armas-de-fogo.pistolas' }), 'fogo');
  assert.equal(R.tipoDaArma({ pericia: 'armas-de-fogo.projeteis' }), 'arco');
  assert.equal(R.tipoDaArma({ pericia: 'arma-branca.laminas-curtas' }), 'lamina');
});
