// Peças comuns das planilhas do mestre (habilidades e as próximas frentes: profissões, mutações, armadilhas…):
// ler células, achar colunas pelo título, cabeçalho padrão e listas com validação.
import ExcelJS from 'exceljs';

export const sem = s => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const texto = v => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.text ?? v.result ?? (v.richText ? v.richText.map(r => r.text).join('') : v.hyperlink ?? '')).trim();
  return String(v).trim();
};
export const numero = v => {
  const n = parseFloat(texto(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const lista = v => texto(v).split(';').map(s => s.trim()).filter(Boolean);
export const simNao = v => /^(s|sim|x|1|true|verdadeiro)$/i.test(texto(v));

export async function abrirPlanilha(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}
export const aba = (wb, nome) => wb.worksheets.find(w => sem(w.name) === sem(nome)) || null;

// Linhas de uma aba como objetos, pelas colunas [título, chave, …] (acha a coluna pelo título, sem ligar para acento).
// Cada objeto guarda o número da linha em "_linha" (para os avisos).
export function linhasDaAba(ws, cols) {
  if (!ws) return [];
  const mapa = Object.fromEntries(cols.map(([t, k]) => [sem(t), k]));
  const idx = {};
  ws.getRow(1).eachCell((cel, col) => { const k = mapa[sem(texto(cel.value))]; if (k) idx[k] = col; });
  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = { _linha: n };
    for (const [k, col] of Object.entries(idx)) o[k] = texto(row.getCell(col).value);
    if (Object.entries(o).some(([k, v]) => k !== '_linha' && v !== '')) out.push(o);
  });
  return out;
}

export function novaPlanilha() { return new ExcelJS.Workbook(); }

// Aba de instruções (uma frase por linha).
export function instrucoes(wb, linhas) {
  const ins = wb.addWorksheet('Instruções');
  ins.getColumn(1).width = 130;
  linhas.forEach(t => ins.addRow([t]));
  ins.getRow(1).font = { bold: true, size: 13 };
  return ins;
}

// Aba com o cabeçalho do padrão do app (marrom, com as dicas como nota) e as linhas.
export function abaComDados(wb, nome, cols, linhas) {
  const ws = wb.addWorksheet(nome);
  ws.columns = cols.map(([t, , w]) => ({ header: t, width: w }));
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A29' } };
  r.alignment = { wrapText: true, vertical: 'middle' };
  r.height = 32;
  cols.forEach(([, , , dica], i) => { if (dica) r.getCell(i + 1).note = dica; });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  for (const l of linhas) ws.addRow(cols.map(([, k]) => l[k] ?? ''));
  return ws;
}

// Aba "Listas" e a validação (lista suspensa) nas colunas indicadas: [[nomeDaLista, valores, [[aba, cols, chave], …]], …].
export function listasComValidacao(wb, listas, linhasMax = 1500) {
  const lst = wb.addWorksheet('Listas');
  lst.columns = listas.map(([t]) => ({ header: t, width: 28 }));
  lst.getRow(1).font = { bold: true };
  const n = Math.max(0, ...listas.map(([, l]) => l.length));
  for (let i = 0; i < n; i++) lst.addRow(listas.map(([, l]) => l[i] ?? ''));
  const letra = i => String.fromCharCode(65 + i);
  listas.forEach(([, valores, alvos], i) => {
    for (const [ws, cols, chave] of alvos || []) {
      const c = cols.findIndex(([, k]) => k === chave) + 1;
      if (!c) continue;
      const total = Math.max(ws.rowCount + 200, linhasMax);
      for (let r = 2; r <= total; r++) ws.getCell(r, c).dataValidation = { type: 'list', allowBlank: true, formulae: [`Listas!$${letra(i)}$2:$${letra(i)}$${valores.length + 1}`] };
    }
  });
}
