// Catálogo de itens a partir da planilha do autor ("Sistema MSS - itens").
// A planilha é a fonte: o app lê as 27 colunas originais e deduz o que precisa (tipo, slot, IP, bônus…).
// Colunas extras "App: …" (opcionais) permitem corrigir a dedução item a item sem mexer nas colunas originais.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { DATA_DIR } from './db.js';
import { CONTEUDO } from './sistema.js';
import { tipoIp, ipDoItem, textoBonus } from '../shared/regras.js';

export const COLUNAS = [
  'num ctrl', 'ex', 'Item', 'Peso (kg)', 'Preço (créditos)', 'Descrição', 'Aparência', 'Região', 'Finalidade', 'Categoria', 'Subcategoria',
  'Qualidade', 'Durabilidade', 'Raridade', 'Pericia Base', 'Pericia - Subgrupo', 'MAESTRIA', 'Pré requisitos', 'Efeitos', 'observação Efeitos',
  'Dano', 'tipo de dano', 'Observações', 'identificar ND', 'Produção - Pericia', 'Produção - ND', 'Produção - OBSERVAÇÕES',
];
// Colunas do app (opcionais). Em branco = o app deduz das colunas originais.
export const COLUNAS_APP = [
  ['App: tipo', 'tipo'], ['App: slot', 'slot'], ['App: mãos/espaços', 'ocupa'], ['App: IP', 'defesa'], ['App: bônus', 'bonus'],
  ['App: alcance', 'alcance'], ['App: capacidade (balas)', 'capacidade'], ['App: munição (tipo)', 'municao'], ['App: quantidade', 'quantidade'],
  ['App: efeito de dano (DS ≤)', 'efeitoDano'], ['App: cadência', 'cadencia'], ['App: dureza', 'dureza'], ['App: em revisão', 'revisao'],
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

// "CAR +1", "Carisma +2", "Penalidade AGI -2" → { CAR: 1, AGI: -2 } (pontos de atributo).
// Com "%" ("Percepção -30%", "Carisma -20%") é porcentagem nos testes do atributo e das perícias dele → { '%PER': -30 } (autor, 28/10).
function bonusDeTexto(texto) {
  const bonus = {};
  for (const [sigla, nomes] of Object.entries(ATRIBUTOS)) {
    const re = new RegExp(`\\b(?:${nomes.join('|')})\\b\\s*([+-]\\s*\\d+)\\s*(%)?`, 'i');
    const m = re.exec(sem(texto));
    if (m) bonus[m[2] ? `%${sigla}` : sigla] = parseInt(m[1].replace(/\s/g, ''), 10);
  }
  return bonus;
}

// Coluna "App: bônus": "PER -30%; FOR +2; Furtividade +10%; espionagem.furtividade +5".
// Atributo com % = porcentagem nos testes dele; atributo sem % = pontos; perícia/subperícia (nome ou id) = %.
export function lerBonus(v, sis = null) {
  const out = {};
  const pericias = sis ? sis.pericias.flatMap(p => [[sem(p.nome), p.id], [p.id, p.id], ...p.subpericias.flatMap(s => [[sem(s.nome), s.id], [s.id, s.id]])]) : [];
  for (const parte of String(v || '').split(/[;,]/)) {
    const m = /^\s*(.+?)\s*([+-−]\s*\d+)\s*(%)?\s*$/.exec(parte);
    if (!m) continue;
    const n = parseInt(m[2].replace(/\s/g, '').replace('−', '-'), 10);
    const chave = sem(m[1]);
    const sigla = Object.entries(ATRIBUTOS).find(([sg, nomes]) => sem(sg) === chave || nomes.includes(chave))?.[0];
    if (sigla) { out[m[3] ? `%${sigla}` : sigla] = n; continue; }
    const per = pericias.find(([nome]) => nome === chave)?.[1];
    out[per || m[1].trim()] = n;
  }
  return out;
}
// Coluna "App: IP": "geral 2; Físico 4; Corte 1" → { geral: 2, 'Físico': 4, Corte: 1 }. Só um número = IP geral.
export function lerIp(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return { geral: Number(t) };
  const out = {};
  for (const parte of t.split(/[;,]/)) {
    const m = /^\s*(.+?)\s*[:+]?\s*(\d+)\s*$/.exec(parte) || /^\s*(\d+)\s+(.+?)\s*$/.exec(parte)?.slice(0, 3).reverse();
    if (!m) continue;
    const [nome, n] = /^\d+$/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
    out[sem(nome) === 'geral' ? 'geral' : tipoIp(nome) || nome.trim().replace(/^./, c => c.toUpperCase())] = Number(n);
  }
  return Object.keys(out).length ? out : null;
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
    // Durabilidade (livro, cap. 5): número de 1 a 9+; "C" = consumível (some ao usar); "AC" = autoconsumível (estraga sozinho com o tempo).
    durabilidade: ['c', 'ac'].includes(sem(l.Durabilidade)) || num(l.Durabilidade) == null ? null : Math.max(1, Math.round(num(l.Durabilidade))),
    ...(sem(l.Durabilidade) === 'c' ? { consumivel: true } : sem(l.Durabilidade) === 'ac' ? { autoConsumivel: true } : {}),
    slot: app.slot ? sem(app.slot) : deduzirSlot(tipo, nome, l.Categoria, l.Subcategoria),
    ocupa: num(app.ocupa) ?? (tipo === 'arma' && maestria >= 2 ? 2 : 1),
    maestria, requisitos: txt(l['Pré requisitos']),
    efeitos: txt(l.Efeitos), efeitosObs: txt(l['observação Efeitos']), observacoes: txt(l.Observações),
    ndIdentificar: num(l['identificar ND']),
    producao: { pericia: txt(l['Produção - Pericia']), nd: num(l['Produção - ND']), obs: txt(l['Produção - OBSERVAÇÕES']) },
    bonus: app.bonus ? lerBonus(app.bonus, sis) : bonusDeTexto(efeitos),
    revisao: app.revisao ? !['nao', 'não', 'n', '0', 'false'].includes(sem(app.revisao)) : revisao,
    // A linha da planilha guardada como veio (inclusive "A definir" e "-"), para exportar de volta sem perder nada.
    planilha: Object.fromEntries([...COLUNAS, ...COLUNAS_APP.map(([c]) => c)].filter(c => l[c] != null && String(l[c]).trim() !== '').map(c => [c, l[c]])),
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
  // "App: IP" por tipo ("geral 2; Físico 4") vira ipTipos; sem a coluna, o app lê "IP 4 (Físico)" nos efeitos na hora.
  const ipTipos = lerIp(app.defesa);
  if (ipTipos) item.ipTipos = ipTipos;
  const ip = ipTipos ? ipTipos.geral || null : (tipo === 'defesa' || tipo === 'vestimenta' || tipo === 'cibernetico'
    ? num((/(?:\bIP|Defesa|RD|Prote[cç][aã]o)\s*[+:]?\s*(\d+)/i.exec(efeitos) || [])[1]) : null);
  if (ip) item.defesa = ip;
  if (num(app.capacidade)) { item.capacidade = num(app.capacidade); item.municao = app.municao ? String(app.municao).trim() : sem(l['Pericia - Subgrupo']); }
  if (tipo === 'municao') { item.municao = app.municao ? String(app.municao).trim() : sem(l['Pericia - Subgrupo'] || l.Item); item.quantidade = num(app.quantidade) ?? 1; }
  if (num(app.efeitoDano)) item.efeitoDano = num(app.efeitoDano);
  if (num(app.cadencia)) item.cadencia = num(app.cadencia);
  // Dureza X (itens muito fortes): dano até X não faz nada; acima de X, dano integral. "App: dureza" ou "Dureza N" nos efeitos.
  const dureza = num(app.dureza) ?? num((/dureza\s*"?\s*[:+]?\s*(\d+)/i.exec(efeitos) || [])[1]);
  if (dureza) item.dureza = dureza;
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

// O que o app usa hoje, no formato das colunas "App: …" (para o autor revisar item a item).
const sinal = v => (v > 0 ? `+${v}` : `${v}`);
export function colunasAppDoItem(it, sis = null) {
  const ip = ipDoItem(it);
  const nomePer = id => sis?.pericias?.flatMap(p => [[p.id, p.nome], ...p.subpericias.map(s => [s.id, s.nome])]).find(x => x[0] === id)?.[1] || id;
  const bonus = Object.entries(it.bonus || {}).map(([k, v]) => (k.startsWith('%') ? `${k.slice(1)} ${sinal(v)}%` : /^[A-Z]{3,4}$/.test(k) ? `${k} ${sinal(v)}` : `${nomePer(k)} ${sinal(v)}%`)).join('; ');
  return {
    'App: tipo': it.tipo || '', 'App: slot': it.slot || '', 'App: mãos/espaços': it.ocupa ?? '',
    'App: IP': [ip.geral ? `geral ${ip.geral}` : null, ...Object.entries(ip.tipos).filter(([, v]) => v).map(([t, v]) => `${t} ${v}`)].filter(Boolean).join('; '),
    'App: bônus': bonus, 'App: alcance': it.alcance || '', 'App: capacidade (balas)': it.capacidade ?? '', 'App: munição (tipo)': it.capacidade || it.tipo === 'municao' ? it.municao || '' : '',
    'App: quantidade': it.tipo === 'municao' ? it.quantidade ?? '' : '', 'App: efeito de dano (DS ≤)': it.efeitoDano ?? '', 'App: cadência': it.cadencia ?? '', 'App: dureza': it.dureza ?? '',
    'App: em revisão': it.revisao ? 'sim' : 'não',
  };
}
const LEIA_ME = [
  ['Planilha de itens do Ilhas das Ruínas'],
  [''],
  ['As colunas originais (num ctrl … Produção) são as do autor. As colunas "App: …" dizem o que o app usa; elas vêm preenchidas com o que o app entende hoje.'],
  ['Corrija nas colunas "App: …". Coluna "App" em branco = o app deduz das colunas originais.'],
  [''],
  ['App: IP', 'IP do item: "geral 2" ou por tipo de dano "Físico 4; Corte 1" (Físico, Corte, Perfuração, Concussão, Impacto, Elétrico, Calor, Frio, Energia, Radiação, Ácido, Venenoso, Psíquico, A distância…). Só um número = IP geral.'],
  ['App: bônus', 'Separados por ";". Atributo com % = porcentagem nos testes do atributo e das perícias dele ("PER -30%"). Atributo sem % = pontos no atributo ("FOR +2"). Perícia ou subperícia = % nos testes dela ("Furtividade +10%").'],
  ['MAESTRIA', 'Quantas mãos o item precisa (1 ou 2). "App: mãos/espaços" sobrepõe.'],
  ['App: tipo', 'arma, defesa, vestimenta, joia, cibernetico, ferramenta, alimento, boticario, municao, energia, transporte, materia, geral.'],
  ['App: slot', 'maos, cabeca, corpo, vestimenta, costas, joia (em branco = vai para a mochila).'],
  ['App: alcance', 'corpo ou distancia (armas).'],
  ['App: em revisão', 'sim = o app marca o item como "em revisão".'],
  [''],
  ['Google Planilhas', 'Arquivo > Importar > Enviar este arquivo > Substituir planilha. Depois: Compartilhar > "Qualquer pessoa com o link" (Leitor) e cole o link no app (Livros > Itens > Planilha). O app puxa sozinho ao abrir e a cada 30 minutos.'],
];

// Exporta o catálogo no mesmo formato (27 colunas originais + colunas "App: …" preenchidas com o que o app usa).
export async function planilhaDoCatalogo(itens, sis = null) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('itens');
  const cols = [...COLUNAS, ...COLUNAS_APP.map(([c]) => c)];
  ws.columns = cols.map(c => ({ header: c, key: c, width: Math.min(40, Math.max(10, c.length + 2)) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A29' } };
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }];
  // Na ordem do "num ctrl" (a ordem da planilha do autor).
  const ctrl = it => parseFloat(it.planilha?.['num ctrl'] ?? it.id.replace(/^i/, '')) || Infinity;
  for (const it of [...itens].sort((a, b) => ctrl(a) - ctrl(b))) {
    const p = it.planilha || {};
    ws.addRow({
      ...p,
      'num ctrl': p['num ctrl'] ?? it.id.replace(/^i/, ''), Item: p.Item ?? it.nome, 'Preço (créditos)': p['Preço (créditos)'] ?? it.preco, 'Peso (kg)': p['Peso (kg)'] ?? it.peso,
      ...colunasAppDoItem(it, sis),
    });
  }
  const leia = wb.addWorksheet('Leia-me');
  leia.columns = [{ width: 22 }, { width: 120 }];
  for (const l of LEIA_ME) leia.addRow(l);
  leia.getRow(1).font = { bold: true, size: 14 };
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
    return { origem: 'mestre', atualizadoEm: d.atualizadoEm, arquivo: d.arquivo, total: d.itens.length, googleSheets: d.googleSheets || null };
  }
  const d = fs.existsSync(ARQ_PADRAO) ? JSON.parse(fs.readFileSync(ARQ_PADRAO, 'utf8')) : { itens: [] };
  return { origem: 'padrao', atualizadoEm: d.atualizadoEm, total: d.itens.length };
}

export function salvarCatalogoMestre(itens, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_MESTRE, JSON.stringify({ atualizadoEm: Date.now(), arquivo, ...(extra.googleSheets ? { googleSheets: extra.googleSheets, modo: extra.modo || 'atualizar' } : {}), itens, versao: VERSAO_CATALOGO }));
}
export function linkGoogleItens() {
  if (!fs.existsSync(ARQ_MESTRE)) return null;
  const d = JSON.parse(fs.readFileSync(ARQ_MESTRE, 'utf8'));
  return d.googleSheets ? { link: d.googleSheets, modo: d.modo } : null;
}
// Versão da leitura da planilha: quando muda (28/10: bônus com % e IP por tipo), o catálogo é relido da planilha guardada.
export const VERSAO_CATALOGO = 2;
// Só o catálogo do mestre (data/): o padrão do app (conteudo/) já vem convertido no repositório.
export function reconverterCatalogos(sis, arquivos = [ARQ_MESTRE]) {
  for (const arq of arquivos) {
    if (!fs.existsSync(arq)) continue;
    const d = JSON.parse(fs.readFileSync(arq, 'utf8'));
    if ((d.versao || 1) >= VERSAO_CATALOGO) continue;
    // Muda só o que a leitura nova mudou (bônus com %, IP por tipo); id e o resto ficam como estavam.
    d.itens = d.itens.map(it => {
      if (!it.planilha) return it;
      const novo = converterLinha(it.planilha, sis, { revisao: it.revisao });
      return { ...it, bonus: novo.bonus, ...(novo.ipTipos ? { ipTipos: novo.ipTipos } : {}) };
    });
    d.versao = VERSAO_CATALOGO;
    fs.writeFileSync(arq, JSON.stringify(d));
  }
}

export function voltarCatalogoPadrao() {
  if (fs.existsSync(ARQ_MESTRE)) fs.unlinkSync(ARQ_MESTRE);
}
