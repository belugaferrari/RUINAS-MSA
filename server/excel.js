import ExcelJS from 'exceljs';
import { sistema } from './sistema.js';
import { uid } from './db.js';
import { novaFicha } from '../shared/regras.js';

const BASICAS = [
  ['Nome', 'nome'], ['Grupo', 'grupo'], ['Nível', 'nivel'], ['Dificuldade', 'dificuldade'], ['Classe', 'classe'],
  ['Idade', 'idade'], ['Peso', 'peso'], ['Altura', 'altura'], ['Instinto', 'instinto'],
  ['PV', 'pv'], ['Sanidade', 'sanidade'], ['Humanidade', 'humanidade'], ['Dinheiro', 'dinheiro'],
];
const FINAIS = [['Vantagens (separe por ;)', 'vantagens'], ['Itens (ids ou nomes, separe por ;)', 'itens'], ['Características', 'caracteristicas'], ['Background', 'background'], ['Anotações', 'anotacoes']];

function colunas(sis) {
  return [
    ...BASICAS,
    ...sis.atributos.map(a => [`Atr: ${a.nome}`, `atr:${a.nome}`]),
    ...sis.pericias.map(p => [`Per: ${p.nome}`, `per:${p.nome}`]),
    ...FINAIS,
  ];
}

export async function modeloNpcs() {
  const sis = sistema();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('NPCs');
  const cols = colunas(sis);
  ws.columns = cols.map(([titulo]) => ({ header: titulo, width: Math.max(12, titulo.length + 2) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A29' } };
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  const exemplo = { nome: 'Capitão Vaz', grupo: 'Piratas', nivel: 3, dificuldade: 3, classe: 'Sem classe', pv: 15, sanidade: 8, humanidade: 6, dinheiro: 50, vantagens: 'Contatos', itens: 'faca; capa', background: 'Exemplo — apague esta linha.' };
  for (const a of sis.atributos) exemplo[`atr:${a.nome}`] = 3;
  for (const p of sis.pericias) exemplo[`per:${p.nome}`] = 1;
  ws.addRow(cols.map(([, chave]) => exemplo[chave] ?? ''));

  const ins = wb.addWorksheet('Instruções');
  ins.getColumn(1).width = 110;
  [
    'Como preencher:',
    '• Uma linha por NPC. Só a coluna "Nome" é obrigatória.',
    '• "Grupo": se o grupo não existir na campanha, ele é criado na importação.',
    '• Colunas "Atr:" são atributos e "Per:" são perícias — use números.',
    '• Vantagens e Itens: separe por ponto e vírgula (;). Itens podem ser o id ou o nome do catálogo (aba Listas).',
    '• Não mude os títulos da primeira linha. Se as regras mudarem, baixe o modelo de novo pelo app.',
  ].forEach(t => ins.addRow([t]));

  const lst = wb.addWorksheet('Listas');
  lst.columns = [{ header: 'Classes', width: 26 }, { header: 'Vantagens', width: 26 }, { header: 'Item (id)', width: 20 }, { header: 'Item (nome)', width: 30 }];
  lst.getRow(1).font = { bold: true };
  const n = Math.max(sis.classes.length, sis.vantagens.length, sis.itens.length);
  for (let i = 0; i < n; i++) lst.addRow([sis.classes[i]?.nome ?? '', sis.vantagens[i]?.nome ?? '', sis.itens[i]?.id ?? '', sis.itens[i]?.nome ?? '']);

  return wb.xlsx.writeBuffer();
}

function texto(v) {
  if (v == null) return '';
  if (typeof v === 'object') return v.text ?? v.result ?? (v.richText ? v.richText.map(r => r.text).join('') : String(v));
  return String(v).trim();
}

const numero = (v, padrao) => {
  const n = parseInt(texto(v), 10);
  return Number.isFinite(n) ? n : padrao;
};

// Lê uma planilha e devolve [{ grupo, ficha }] — a campanha decide onde salvar.
export async function lerNpcs(buffer, campanha) {
  const sis = sistema();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('NPCs') || wb.worksheets[0];
  if (!ws) throw new Error('Planilha vazia.');
  const mapa = Object.fromEntries(colunas(sis).map(([titulo, chave]) => [titulo.toLowerCase(), chave]));
  const indice = {};
  ws.getRow(1).eachCell((cel, col) => {
    const chave = mapa[texto(cel.value).toLowerCase()];
    if (chave) indice[chave] = col;
  });
  if (!indice.nome) throw new Error('Coluna "Nome" não encontrada. Use o modelo baixado pelo app.');

  const saida = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const val = chave => (indice[chave] ? row.getCell(indice[chave]).value : null);
    const nome = texto(val('nome'));
    if (!nome) return;
    const f = novaFicha(sis, campanha);
    f.nome = nome;
    f.nivel = numero(val('nivel'), f.nivel);
    const dif = numero(val('dificuldade'), null);
    if (dif != null) f.dificuldade = dif;
    for (const k of ['classe', 'idade', 'peso', 'altura', 'instinto', 'caracteristicas', 'background', 'anotacoes']) {
      const t = texto(val(k));
      if (t) f[k] = t;
    }
    for (const k of ['pv', 'sanidade', 'humanidade']) {
      const v = numero(val(k), null);
      if (v != null) f[k] = { max: v, atual: v };
    }
    f.dinheiro = numero(val('dinheiro'), f.dinheiro);
    for (const a of sis.atributos) f.atributos[a.nome] = numero(val(`atr:${a.nome}`), f.atributos[a.nome]);
    for (const p of sis.pericias) f.pericias[p.nome] = numero(val(`per:${p.nome}`), f.pericias[p.nome]);
    const lista = k => texto(val(k)).split(';').map(s => s.trim()).filter(Boolean);
    f.vantagens = lista('vantagens').filter(v => sis.vantagens.some(x => x.nome === v));
    f.itens = lista('itens').map(ref => sis.itens.find(i => i.id === ref || i.nome.toLowerCase() === ref.toLowerCase())).filter(Boolean)
      .map(it => ({ ...structuredClone(it), uid: uid(), itemId: it.id, equipado: false, durabilidadeAtual: it.durabilidade }));
    saida.push({ grupo: texto(val('grupo')) || 'Importados', ficha: f });
  });
  return saida;
}
