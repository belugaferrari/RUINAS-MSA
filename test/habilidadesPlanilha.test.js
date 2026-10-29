// Habilidades por planilha (autor, 29/10): exportar e ler de volta sem perder nada; mudar a coluna "Dano" muda o ataque
// no app; a planilha do mestre passa a valer no lugar do livro do autor (e dá para voltar).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

process.env.ITENS_EXEMPLO = '1';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'msa-'));
const { sistema } = await import('../server/sistema.js');
const P = await import('../server/habilidadesPlanilha.js');
const R = await import('../shared/regras.js');
const C = await import('../shared/combate.js');

const limpa = o => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'string' ? v.trim() : v)));
const vantagensDe = s => ({ gerais: s.vantagens, defeitosLeves: s.defeitos.filter(d => d.tipo === 'leve'), defeitosNormais: s.defeitos.filter(d => d.tipo === 'normal'), capacidades: s.capacidades });

test('exportar e ler de volta: classes, vantagens e regras iguais às do livro do app (MSA e MSS)', async () => {
  const buf = Buffer.from(await P.planilhaHabilidades(sistema('msa'), sistema('mss')));
  const { catalogo, total, avisos } = await P.lerPlanilhaHabilidades(buf, sistema('mss'));
  assert.deepEqual(avisos, []);
  assert.ok(total > 400);
  for (const id of ['msa', 'mss']) {
    const s = sistema(id);
    assert.deepEqual(limpa(catalogo.sistemas[id].classes), limpa(s.classes));
    assert.deepEqual(limpa(catalogo.sistemas[id].vantagens), limpa(vantagensDe(s)));
  }
  assert.deepEqual(catalogo.regras, sistema('mss').habilidadesRegras);
});

test('mudar o Dano do Muco radioativo na planilha muda o ataque no app; voltar ao livro do autor desfaz', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await P.planilhaHabilidades(sistema('msa'), sistema('mss'))));
  const ws = wb.getWorksheet('Habilidades');
  const col = t => { let n = 0; ws.getRow(1).eachCell((c, i) => { if (c.value === t) n = i; }); return n; };
  let achou = false;
  ws.eachRow((row, n) => { if (n > 1 && row.getCell(col('Nome')).value === 'Muco radioativo') { row.getCell(col('Dano')).value = '4d6'; achou = true; } });
  assert.ok(achou);
  const { catalogo, total } = await P.lerPlanilhaHabilidades(Buffer.from(await wb.xlsx.writeBuffer()), sistema('mss'));
  P.salvarCatalogoHabilidades({ ...catalogo, total }, 'teste.xlsx');
  const mss = sistema('mss');
  assert.equal(mss.habilidadesRegras['muco radioativo'].arma.dano, '4d6');
  const cl = mss.classes.find(x => x.nome === 'Mutante');
  const p = { classe: cl.id, especializacao: cl.especializacoes.find(e => /RADIANTE/.test(e.nome)).id, nivel: 8 };
  assert.equal(C.armasDisponiveis(p, mss).find(a => a.nome === 'Muco radioativo').dano, '4d6');
  assert.ok(R.listaHabilidades(p, mss).some(x => x.nome === 'Muco radioativo'));
  P.voltarHabilidadesPadrao();
  assert.equal(sistema('mss').habilidadesRegras['muco radioativo'].arma.dano, '2d6');
});

test('linha nova: vantagem geral criada na planilha aparece no app; regra com JSON quebrado vira aviso', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await P.planilhaHabilidades(sistema('msa'), sistema('mss'))));
  const ws = wb.getWorksheet('Habilidades');
  const titulos = [];
  ws.getRow(1).eachCell((c, i) => { titulos[i] = c.value; });
  const linha = o => titulos.map(t => o[t] ?? '');
  ws.addRow(linha({ Origem: 'Vantagem geral', Nome: 'Pé de Pato', 'Descrição (texto do livro)': 'Nada bem.', 'Efeitos no app': '+10% em Esportes', Custo: 1 }));
  ws.addRow(linha({ Origem: 'Vantagem geral', Nome: 'Quebrada', 'Descrição (texto do livro)': 'x', 'Regra avançada (não mexa sem saber)': '{oops' }));
  const { catalogo, avisos } = await P.lerPlanilhaHabilidades(Buffer.from(await wb.xlsx.writeBuffer()), sistema('mss'));
  const v = catalogo.sistemas.mss.vantagens.gerais.find(x => x.nome === 'Pé de Pato');
  assert.equal(v.id, 'pe-de-pato');
  assert.equal(catalogo.regras['pe de pato'].efeitos, '+10% em Esportes');
  assert.ok(avisos.some(a => /Quebrada/.test(a)));
});
