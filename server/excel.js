import ExcelJS from 'exceljs';
import { sistema } from './sistema.js';
import { uid } from './db.js';
import { novaFicha, derivados } from '../shared/regras.js';

const BASICAS = [
  ['Nome', 'nome'], ['Grupo', 'grupo'], ['Nível', 'nivel'], ['Dificuldade', 'dificuldade'], ['Profissão', 'profissao'], ['Classe', 'classe'], ['Especialização', 'especializacao'],
  ['Idade', 'idade'], ['Peso', 'peso'], ['Altura', 'altura'], ['Instinto', 'instinto'],
  ['PV', 'pv'], ['Sanidade', 'sanidade'], ['Humanidade', 'humanidade'], ['Dinheiro', 'dinheiro'],
];
const FINAIS = [['Vantagens (separe por ;)', 'vantagens'], ['Defeitos (separe por ;)', 'defeitos'], ['Itens (ids ou nomes, separe por ;)', 'itens'], ['Características', 'caracteristicas'], ['Background', 'background'], ['Anotações', 'anotacoes']];

function colunas(sis) {
  return [
    ...BASICAS,
    ...sis.atributos.map(a => [`Atr: ${a.sigla}`, `atr:${a.sigla}`]),
    ...sis.pericias.map(p => [`Per: ${p.nome}`, `per:${p.id}`]),
    ...FINAIS,
  ];
}

export async function modeloNpcs(idSistema) {
  const sis = sistema(idSistema);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('NPCs');
  const cols = colunas(sis);
  ws.columns = cols.map(([titulo]) => ({ header: titulo, width: Math.max(12, titulo.length + 2) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A29' } };
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  const exemplo = { nome: 'Capitão Vaz', grupo: 'Piratas', nivel: 3, dificuldade: 3, profissao: sis.profissoes[0]?.nome, classe: sis.classes[0]?.nome, pv: 25, sanidade: 30, humanidade: 10, dinheiro: 50, vantagens: sis.vantagens[0]?.nome, defeitos: sis.defeitos[0]?.nome, itens: 'faca; capa', background: 'Exemplo — apague esta linha.' };
  for (const a of sis.atributos) exemplo[`atr:${a.sigla}`] = 10;
  for (const p of sis.pericias) exemplo[`per:${p.id}`] = 2;
  ws.addRow(cols.map(([, chave]) => exemplo[chave] ?? ''));

  const ins = wb.addWorksheet('Instruções');
  ins.getColumn(1).width = 110;
  [
    'Como preencher:',
    '• Uma linha por NPC. Só a coluna "Nome" é obrigatória.',
    '• "Grupo": se o grupo não existir na campanha, ele é criado na importação.',
    '• Colunas "Atr:" são atributos (FOR, CONS, AGI, DES, INT, PER, CAR, WILL) e "Per:" são pontos gastos na perícia base — use números.',
    '• PV e Sanidade em branco são calculados pelas regras. Subperícias específicas podem ser ajustadas na ficha depois.',
    '• Profissão, Classe, Especialização, Vantagens, Defeitos e Itens: use os nomes da aba Listas. Separe listas por ponto e vírgula (;).',
    '• Não mude os títulos da primeira linha. Se as regras mudarem, baixe o modelo de novo pelo app.',
  ].forEach(t => ins.addRow([t]));

  const lst = wb.addWorksheet('Listas');
  const especs = sis.classes.flatMap(c => c.especializacoes.map(e => `${e.nome} (${c.nome})`));
  const listas = [['Profissões', sis.profissoes.map(p => p.nome)], ['Classes', sis.classes.map(c => c.nome)], ['Especializações', especs],
    ['Vantagens', sis.vantagens.map(v => v.nome)], ['Defeitos', sis.defeitos.map(d => `${d.nome}`)], ['Item (id)', sis.itens.map(i => i.id)], ['Item (nome)', sis.itens.map(i => i.nome)]];
  lst.columns = listas.map(([h]) => ({ header: h, width: 30 }));
  lst.getRow(1).font = { bold: true };
  const n = Math.max(...listas.map(([, l]) => l.length));
  for (let i = 0; i < n; i++) lst.addRow(listas.map(([, l]) => l[i] ?? ''));

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
  const sis = sistema(campanha?.sistema);
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
    const porNome = (lista, v) => lista.find(x => x.nome.toLowerCase() === String(v).trim().toLowerCase().replace(/\s*\(.*$/, ''))?.id || '';
    f.profissao = porNome(sis.profissoes, texto(val('profissao')));
    f.classe = porNome(sis.classes, texto(val('classe')));
    const classe = sis.classes.find(c => c.id === f.classe);
    f.especializacao = classe ? porNome(classe.especializacoes, texto(val('especializacao'))) : '';
    for (const k of ['idade', 'peso', 'altura', 'instinto', 'caracteristicas', 'background', 'anotacoes']) {
      const t = texto(val(k));
      if (t) f[k] = t;
    }
    for (const k of ['pv', 'sanidade', 'humanidade']) {
      const v = numero(val(k), null);
      if (v != null) f[k] = { max: v, atual: v };
    }
    f.dinheiro = numero(val('dinheiro'), f.dinheiro);
    for (const a of sis.atributos) f.atributos[a.sigla] = numero(val(`atr:${a.sigla}`), f.atributos[a.sigla]);
    for (const p of sis.pericias) {
      const v = numero(val(`per:${p.id}`), 0);
      if (v) f.pericias[p.id] = v;
    }
    const d = derivados(f, sis);
    if (numero(val('pv'), null) == null) f.pv = { max: d.pvMax, atual: d.pvMax };
    if (numero(val('sanidade'), null) == null) f.sanidade = { max: d.sanidadeMax, atual: d.sanidadeMax };
    const lista = k => texto(val(k)).split(';').map(s => s.trim()).filter(Boolean);
    f.vantagens = lista('vantagens').map(v => porNome(sis.vantagens, v)).filter(Boolean);
    f.defeitos = lista('defeitos').map(v => porNome(sis.defeitos, v)).filter(Boolean);
    f.itens = lista('itens').map(ref => sis.itens.find(i => i.id === ref || i.nome.toLowerCase() === ref.toLowerCase())).filter(Boolean)
      .map(it => ({ ...structuredClone(it), uid: uid(), itemId: it.id, equipado: false, durabilidadeAtual: it.durabilidade }));
    saida.push({ grupo: texto(val('grupo')) || 'Importados', ficha: f });
  });
  return saida;
}
