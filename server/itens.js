// Catálogo de itens a partir da planilha do autor ("Sistema MSS - itens").
// A planilha é a fonte: o app lê as 27 colunas originais e deduz o que precisa (tipo, slot, IP, bônus…).
// Colunas extras "App: …" (opcionais) permitem corrigir a dedução item a item sem mexer nas colunas originais.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { DATA_DIR } from './db.js';
import { CONTEUDO } from './sistema.js';

export const COLUNAS = [
  'num ctrl', 'ex', 'Item', 'Peso (kg)', 'Preço (créditos)', 'Descrição', 'Aparência', 'Região', 'Finalidade', 'Categoria', 'Subcategoria',
  'Qualidade', 'Durabilidade', 'Raridade', 'Pericia Base', 'Pericia - Subgrupo', 'MAESTRIA', 'Pré requisitos', 'Efeitos', 'observação Efeitos',
  'Dano', 'tipo de dano', 'Observações', 'identificar ND', 'Produção - Pericia', 'Produção - ND', 'Produção - OBSERVAÇÕES',
];
// Colunas do app (opcionais). Em branco = o app deduz das colunas originais.
export const COLUNAS_APP = [
  ['App: tipo', 'tipo'], ['App: slot', 'slot'], ['App: mãos/espaços', 'ocupa'], ['App: IP', 'defesa'], ['App: bônus', 'bonus'],
  ['App: alcance', 'alcance'], ['App: capacidade (balas)', 'capacidade'], ['App: munição (tipo)', 'municao'], ['App: quantidade', 'quantidade'],
  ['App: efeito de dano (DS ≤)', 'efeitoDano'], ['App: em revisão', 'revisao'],
];

export const ARQ_PADRAO = path.join(CONTEUDO, 'sistemas', 'itens.json');
export const ARQ_MESTRE = path.join(DATA_DIR, 'catalogo-itens.json');

const sem = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const vazio = v => v == null || ['', '-', '—', 'a definir'].includes(sem(v));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; };
const txt = v => (vazio(v) ? '' : String(v).trim());

const ATRIBUTOS = { FOR: ['for', 'forca'], CONS: ['cons', 'con', 'constituicao'], AGI: ['agi', 'agilidade'], DES: ['des', 'destreza'], INT: ['int', 'inteligencia'], PER: ['per', 'percepcao'], CAR: ['car', 'carisma'], WILL: ['will', 'vontade'] };
const TIPOS_DANO = {
  perfurante: 'Perfuração', perfuracao: 'Perfuração', fogo: 'Calor', 'fogo (calor)': 'Calor', 'fogo (rad)': 'Calor', calor: 'Calor', gelo: 'Frio', frio: 'Frio',
  eletrico: 'Elétrico', veneno: 'Venenoso', venenoso: 'Venenoso', magico: 'Energia (Mágico)', energia: 'Energia (Mágico)', sonoro: 'Vibração', vibracao: 'Vibração',
  acido: 'Ácido', corte: 'Corte', concussao: 'Concussão', impacto: 'Impacto', radiacao: 'Radiação', nuclear: 'Radiação', psiquico: 'Psíquico',
};
const SUBGRUPO_ALIAS = { fazer: 'faser' };
// Nomes antigos (planilha original) → subperícia do livro.
const PERICIA_ALIAS = {
  'combate/briga': 'briga.ataque-desarmado', 'combate/haste': 'arma-branca.lanca', 'combate/martelo': 'arma-branca.martelo',
  'combate/machado': 'arma-branca.machado', 'combate/pesada': 'arma-branca.martelo', 'combate/espada': 'arma-branca.laminas-longas',
  'combate/faca': 'arma-branca.laminas-curtas', 'armas brancas/faca': 'arma-branca.laminas-curtas', 'combate/armas brancas': 'arma-branca.improvisada',
  'esportes/arremesso': 'esportes.arremessar', 'armas de fogo/arremesso': 'esportes.arremessar', 'armas de fogo/rifle': 'armas-de-fogo.rifle-de-assalto',
  'armas de fogo/automatica': 'armas-de-fogo.rifle-de-assalto', 'armas de fogo/sniper': 'armas-de-fogo.rifle-de-precisao',
  'armas de fogo/lanca-chamas': 'armas-de-fogo.jato', 'armas de fogo/energia': 'armas-de-fogo.faser', 'armas de fogo/lanca-granadas': 'armas-de-fogo.artilharia',
  'engenharia/artilharia': 'armas-de-fogo.artilharia', 'engenharia/cerco': 'armas-de-fogo.artilharia',
};

// Acha a subperícia do sistema pelo nome da perícia base e do subgrupo da planilha.
function acharPericia(base, subgrupo, sis) {
  if (vazio(base) || vazio(subgrupo)) return null;
  const alias = PERICIA_ALIAS[`${sem(base)}/${sem(subgrupo)}`];
  if (alias && sis.pericias.some(p => p.subpericias.some(x => x.id === alias))) return alias;
  const b = sem(base).replace(/s$/, '');
  const per = sis.pericias.find(p => sem(p.nome).replace(/s$/, '') === b) || sis.pericias.find(p => sem(p.nome).startsWith(b.slice(0, 5)));
  if (!per) return null;
  const sg = SUBGRUPO_ALIAS[sem(subgrupo)] || sem(subgrupo);
  return per.subpericias.find(s => sem(s.nome) === sg || sem(s.nome).replace(/s$/, '') === sg.replace(/s$/, ''))?.id || null;
}

// "CAR +1", "Carisma +2", "Penalidade AGI -2" → { CAR: 1, AGI: -2 }
function bonusDeTexto(texto) {
  const bonus = {};
  for (const [sigla, nomes] of Object.entries(ATRIBUTOS)) {
    const re = new RegExp(`\\b(?:${nomes.join('|')})\\b\\s*([+-]\\s*\\d+)`, 'i');
    const m = re.exec(sem(texto));
    if (m) bonus[sigla] = parseInt(m[1].replace(/\s/g, ''), 10);
  }
  return bonus;
}

function lerBonus(v) {
  // Formato da coluna "App: bônus": "CAR +1; espionagem.furtividade +5"
  const out = {};
  for (const parte of String(v || '').split(/[;,]/)) {
    const m = /^\s*([\w.\-À-ú]+)\s*([+-]\s*\d+)\s*$/.exec(parte);
    if (m) out[m[1].toUpperCase() in ATRIBUTOS ? m[1].toUpperCase() : m[1]] = parseInt(m[2].replace(/\s/g, ''), 10);
  }
  return out;
}

function deduzirTipo(f, c) {
  const fin = sem(f); const cat = sem(c);
  if (cat === 'municao' || fin === 'municao') return 'municao';
  if (fin === 'armamento') return 'arma';
  if (fin === 'protecao' || cat === 'armadura' || cat === 'defesa') return 'defesa';
  if (fin === 'vestuario') return cat === 'acessorio' ? 'joia' : 'vestimenta';
  if (fin === 'cibernetico') return 'cibernetico';
  if (fin === 'ferramental') return 'ferramenta';
  if (fin === 'alimentacao') return 'alimento';
  if (fin === 'boticario') return 'boticario';
  if (fin === 'transporte') return 'transporte';
  if (fin.startsWith('materia')) return 'materia';
  if (fin === 'fonte de energia') return 'energia';
  return 'geral';
}

function deduzirSlot(tipo, nome, cat, subcat) {
  const n = sem(nome); const c = sem(cat); const s = sem(subcat);
  if (tipo === 'arma') return 'maos';
  if (tipo === 'defesa') {
    if (/escudo/.test(n)) return 'maos';
    if (/capacete|elmo|mascara|helmet/.test(n) || ['cabeca', 'rosto'].includes(s)) return 'cabeca';
    return 'corpo';
  }
  if (tipo === 'vestimenta') return ['cabeca', 'rosto', 'olhos'].includes(s) || /chapeu|capuz|oculos|mascara/.test(n) ? 'cabeca' : 'vestimenta';
  if (tipo === 'joia') return /mochila|bolsa|alforje/.test(n) ? 'costas' : 'joia';
  if (/mochila/.test(n) || c === 'mochila') return 'costas';
  return null;
}

// Uma linha da planilha (objeto { coluna: valor }) → item do catálogo.
export function converterLinha(l, sis, { revisao = false } = {}) {
  const nome = txt(l.Item);
  if (!nome) return null;
  const ctrl = txt(l['num ctrl']);
  const app = Object.fromEntries(COLUNAS_APP.map(([col, k]) => [k, l[col]]).filter(([, v]) => !vazio(v)));
  const tipo = app.tipo ? sem(app.tipo) : deduzirTipo(l.Finalidade, l.Categoria);
  const efeitos = `${txt(l.Efeitos)} ${txt(l['observação Efeitos'])} ${txt(l.Observações)}`;
  const maestria = num(l.MAESTRIA) ?? 0;
  const pericia = acharPericia(l['Pericia Base'], l['Pericia - Subgrupo'], sis);
  const preco = num(l['Preço (créditos)']) ?? 0;
  const item = {
    id: ctrl ? `i${ctrl}` : `i-${sem(nome).replace(/[^a-z0-9]+/g, '-')}`,
    nome, tipo,
    descricao: txt(l.Descrição), aparencia: txt(l.Aparência),
    finalidade: txt(l.Finalidade), categoria: txt(l.Categoria), subcategoria: txt(l.Subcategoria),
    qualidade: txt(l.Qualidade), raridade: txt(l.Raridade), regiao: txt(l.Região),
    preco, venda: Math.floor(preco / 2), peso: num(l['Peso (kg)']) ?? 0,
    durabilidade: Math.max(1, Math.round(num(l.Durabilidade) ?? 1)),
    slot: app.slot ? sem(app.slot) : deduzirSlot(tipo, nome, l.Categoria, l.Subcategoria),
    ocupa: num(app.ocupa) ?? (tipo === 'arma' && maestria >= 2 ? 2 : 1),
    maestria, requisitos: txt(l['Pré requisitos']),
    efeitos: txt(l.Efeitos), efeitosObs: txt(l['observação Efeitos']), observacoes: txt(l.Observações),
    ndIdentificar: num(l['identificar ND']),
    producao: { pericia: txt(l['Produção - Pericia']), nd: num(l['Produção - ND']), obs: txt(l['Produção - OBSERVAÇÕES']) },
    bonus: app.bonus ? lerBonus(app.bonus) : bonusDeTexto(efeitos),
    revisao: app.revisao ? !['nao', 'não', 'n', '0', 'false'].includes(sem(app.revisao)) : revisao,
    planilha: Object.fromEntries([...COLUNAS, ...COLUNAS_APP.map(([c]) => c)].filter(c => !vazio(l[c])).map(c => [c, l[c]])),
  };
  if (!vazio(l.Dano)) {
    // Guarda o texto original; para rolar, tira palavras como "+FOR" ou "+ven" (MOD FOR já entra no corpo a corpo).
    item.danoTexto = String(l.Dano).trim();
    const rolavel = sem(l.Dano).replace(/\s/g, '').replace(/[+-](?:[a-z]+)/g, '').replace(/^\+/, '');
    if (/^(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(rolavel)) item.dano = rolavel;
  }
  if (!vazio(l['tipo de dano'])) item.tipoDano = TIPOS_DANO[sem(l['tipo de dano'])] || txt(l['tipo de dano']);
  if (pericia) item.pericia = pericia;
  if (tipo === 'arma') item.alcance = app.alcance ? sem(app.alcance) : (pericia || '').startsWith('armas-de-fogo') || pericia === 'esportes.arremessar' || sem(l['Pericia Base']).startsWith('armas de fogo') ? 'distancia' : 'corpo';
  // Penetração: "Penetração N", "Ignora IP N" ou "Ignora RD N" (ignora até N pontos de IP do alvo).
  const pen = num((/(?:penetra[cç][aã]o|ignora\s+(?:ip|rd))\s*[:+]?\s*(\d+)/i.exec(efeitos) || [])[1]);
  if (pen) item.penetracao = pen;
  // IP: "App: IP" ou "IP +N" / "Defesa +N" / "RD N" nos efeitos de itens de proteção.
  const ip = num(app.defesa) ?? (tipo === 'defesa' || tipo === 'vestimenta' || tipo === 'cibernetico'
    ? num((/(?:\bIP|Defesa|RD|Prote[cç][aã]o)\s*[+:]?\s*(\d+)/i.exec(efeitos) || [])[1]) : null);
  if (ip) item.defesa = ip;
  if (num(app.capacidade)) { item.capacidade = num(app.capacidade); item.municao = app.municao ? String(app.municao).trim() : sem(l['Pericia - Subgrupo']); }
  if (tipo === 'municao') { item.municao = app.municao ? String(app.municao).trim() : sem(l['Pericia - Subgrupo'] || l.Item); item.quantidade = num(app.quantidade) ?? 1; }
  if (num(app.efeitoDano)) item.efeitoDano = num(app.efeitoDano);
  return item;
}

// Lê um .xlsx com uma ou mais abas no formato da planilha de itens. Linhas repetidas (mesmo "num ctrl"): vale a última.
export async function lerPlanilhaItens(buffer, sis, opcoes = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const itens = new Map();
  let abas = 0;
  wb.eachSheet(ws => {
    let cab = null;
    ws.eachRow((row, n) => {
      const valores = row.values.slice(1).map(v => (v && typeof v === 'object' ? (v.text ?? v.result ?? v.richText?.map(t => t.text).join('') ?? '') : v));
      if (!cab) {
        if (valores.some(v => sem(v) === 'item') && valores.some(v => sem(v) === 'num ctrl')) { cab = valores.map(v => String(v ?? '').trim()); abas++; }
        return;
      }
      const linha = Object.fromEntries(cab.map((c, i) => [c, valores[i]]));
      const it = converterLinha(linha, sis, opcoes);
      if (it) itens.set(it.id, it);
    });
  });
  if (!abas) throw new Error('Não achei o cabeçalho da planilha de itens (precisa das colunas "num ctrl" e "Item").');
  return [...itens.values()];
}

// Exporta o catálogo no mesmo formato (27 colunas originais + colunas "App: …").
export async function planilhaDoCatalogo(itens) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('itens');
  const cols = [...COLUNAS, ...COLUNAS_APP.map(([c]) => c)];
  ws.columns = cols.map(c => ({ header: c, key: c, width: Math.min(40, Math.max(10, c.length + 2)) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A29' } };
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];
  for (const it of itens) {
    const p = it.planilha || {};
    ws.addRow({
      ...p,
      'num ctrl': p['num ctrl'] ?? it.id.replace(/^i/, ''), Item: p.Item ?? it.nome, 'Preço (créditos)': p['Preço (créditos)'] ?? it.preco, 'Peso (kg)': p['Peso (kg)'] ?? it.peso,
      'App: em revisão': it.revisao ? 'sim' : 'não',
    });
  }
  return wb.xlsx.writeBuffer();
}

// Catálogo em uso: o enviado pelo mestre (data/catalogo-itens.json) ou o padrão do app (conteudo/sistemas/itens.json).
let cache = { chave: null, itens: null };
export function catalogoItens() {
  const arq = fs.existsSync(ARQ_MESTRE) ? ARQ_MESTRE : fs.existsSync(ARQ_PADRAO) ? ARQ_PADRAO : null;
  if (!arq) return null;
  const chave = `${arq}:${fs.statSync(arq).mtimeMs}`;
  if (cache.chave !== chave) cache = { chave, itens: JSON.parse(fs.readFileSync(arq, 'utf8')).itens };
  return cache.itens;
}

export function origemCatalogo() {
  if (fs.existsSync(ARQ_MESTRE)) {
    const d = JSON.parse(fs.readFileSync(ARQ_MESTRE, 'utf8'));
    return { origem: 'mestre', atualizadoEm: d.atualizadoEm, arquivo: d.arquivo, total: d.itens.length };
  }
  const d = fs.existsSync(ARQ_PADRAO) ? JSON.parse(fs.readFileSync(ARQ_PADRAO, 'utf8')) : { itens: [] };
  return { origem: 'padrao', atualizadoEm: d.atualizadoEm, total: d.itens.length };
}

export function salvarCatalogoMestre(itens, arquivo) {
  fs.writeFileSync(ARQ_MESTRE, JSON.stringify({ atualizadoEm: Date.now(), arquivo, itens }));
}

export function voltarCatalogoPadrao() {
  if (fs.existsSync(ARQ_MESTRE)) fs.unlinkSync(ARQ_MESTRE);
}
