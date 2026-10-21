// Livro dos Monstros por planilha (.xlsx): abas Monstros, Ataques e Habilidades (uma linha por ataque/habilidade).
// O mestre baixa a planilha atual, edita e envia de volta; o catálogo fica em data/catalogo-monstros.json e vale
// para todas as campanhas deste PC (como o catálogo de itens). Sem catálogo enviado, valem os exemplos do base.json.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { DATA_DIR } from './db.js';

export const ARQ_MONSTROS = path.join(DATA_DIR, 'catalogo-monstros.json');

const sem = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const SIGLAS = ['FOR', 'CONS', 'AGI', 'DES', 'INT', 'PER', 'CAR', 'WILL'];
export const TAMANHOS = ['Diminuto', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'];
const MODOS = ['sempre', 'ligar', 'ativar', 'lembrete'];
// Afinidade elementar (até duas por criatura). Elemental no livro: Elétrico, Calor e Frio.
export const ELEMENTOS = ['Elétrico', 'Calor', 'Frio'];

// [título na planilha, chave, largura, dica]
const COL_MONSTROS = [
  ['Nome', 'nome', 24, 'Obrigatório'],
  ['Raça', 'raca', 18, 'Quebra-Hordas usa este campo (ex.: Cão das Ruínas)'],
  ['Tipo de criatura', 'tipoCriatura', 16, 'Lista na aba Listas'],
  ['Tamanho', 'tamanho', 12, 'Lista na aba Listas'],
  ['Nível', 'nivel', 8, null],
  ['Dificuldade (encontros)', 'dificuldade', 12, 'Soma usada pelo gerador de encontros'],
  ['XP', 'xp', 8, 'XP que o grupo ganha ao vencer'],
  ['PV', 'pv', 8, 'Em branco: calculado como no personagem (FOR + CONS + 5 por nível depois do 1º)'],
  ...SIGLAS.map(s => [s, `atr:${s}`, 7, s === 'AGI' ? 'Iniciativa = AGI + 1d10' : null]),
  ['Perícias (pontos; separe por ;)', 'pericias', 30, 'Igual ao personagem. Ex.: Briga 4; Sentidos 3. A defesa sai daqui (Esquiva = Briga + subperícia + 50).'],
  ['Subperícias (pontos; separe por ;)', 'subpericias', 30, 'Ex.: Esquiva 3; Ataque desarmado 2; Briga › Defesa desarmada 1'],
  ['IP geral', 'ipGeral', 9, null],
  ['IP por tipo', 'ipTipos', 20, 'Ex.: Corte 2; Frio 1'],
  ['Afinidade elementar 1', 'afinidade1', 14, 'Até duas afinidades elementares (Elétrico, Calor, Frio)'],
  ['Afinidade elementar 2', 'afinidade2', 14, null],
  ['Resistências', 'resistencias', 20, 'Tipos de dano que sofrem metade (separe por ;)'],
  ['Imunidades', 'imunidades', 20, 'Tipos de dano (dano zero) ou efeitos (Dor, Sangramento…)'],
  ['Vulnerabilidades', 'vulnerabilidades', 20, 'Tipos de dano que sofrem o dobro'],
  ['Deslocamento (m)', 'deslocamento', 11, null],
  ['Outros deslocamentos', 'outrosDeslocamentos', 22, 'Ex.: Natação 9 m; Voo 12 m'],
  ['Sentidos', 'sentidos', 22, 'Ex.: Visão no escuro 18 m; Faro'],
  ['Comportamento', 'comportamento', 50, 'Como o monstro age: o que caça, quando ataca, quando foge, como reage a fogo/barulho…'],
  ['Onde aparece (ilha, região)', 'habitat', 22, null],
  ['Saque (itens; separe por ;)', 'saque', 26, 'Nomes ou códigos do catálogo de itens: vão para o inventário do monstro'],
  ['Imagem (link do Drive ou da internet)', 'imagem', 40, 'Opcional. Link do Google Drive (Qualquer pessoa com o link) ou endereço de uma imagem. Para usar um arquivo, envie no app: Livro dos Monstros > Enviar imagem.'],
  ['Descrição', 'descricao', 50, null],
];
const COL_ATAQUES = [
  ['Monstro', 'monstro', 24, 'Mesmo nome da aba Monstros'],
  ['Ataque', 'nome', 22, null],
  ['Perícia do ataque', 'pericia', 24, 'Ex.: Briga › Ataque desarmado (padrão), Arma Branca › Lâmina. O acerto sai daqui, como no personagem.'],
  ['Acerto % (opcional)', 'acerto', 10, 'Se preenchido, substitui o valor da perícia'],
  ['Dano', 'dano', 10, 'Ex.: 1d8+2 (a FOR entra sozinha no corpo a corpo, como no personagem)'],
  ['Tipo de dano', 'tipoDano', 14, 'Lista na aba Listas'],
  ['Alcance', 'alcance', 11, 'corpo ou distância'],
  ['Alcance (m)', 'alcanceM', 10, 'Só para distância'],
  ['Cadência', 'cadencia', 9, 'Ataques por ação (padrão 1)'],
  ['Chance de efeito (DS ≤)', 'efeitoDano', 12, 'Ex.: 3 = o efeito do tipo de dano acontece com DS 1–3'],
  ['Penetração', 'penetracao', 10, 'Ignora este tanto de IP'],
  ['Observações', 'obs', 40, null],
];
const COL_HABILIDADES = [
  ['Monstro', 'monstro', 24, null],
  ['Habilidade', 'nome', 24, null],
  ['Modo', 'modo', 12, 'sempre (aplica sozinho) / ligar / ativar / lembrete'],
  ['Única (sim/não)', 'unica', 10, 'Habilidade única: não pode ser copiada (Mutante, Transmorfo…) nem revelada por testes como Zoologia'],
  ['Efeitos no app', 'efeitos', 36, 'Formato do lápis do mestre. Ex.: +1 IP geral; vantagem: ataque; imune: Dor; Furtividade +10%'],
  ['Descrição', 'descricao', 60, null],
];

const texto = v => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.text ?? v.result ?? (v.richText ? v.richText.map(r => r.text).join('') : v.hyperlink ?? '')).trim();
  return String(v).trim();
};
const numero = v => { const n = parseFloat(texto(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const lista = v => texto(v).split(';').map(s => s.trim()).filter(Boolean);

// Catálogo em uso: o enviado pelo mestre, ou null (o sistema usa os exemplos do base.json).
export function catalogoMonstros() {
  if (!fs.existsSync(ARQ_MONSTROS)) return null;
  return JSON.parse(fs.readFileSync(ARQ_MONSTROS, 'utf8'));
}
export function salvarCatalogoMonstros(monstros, arquivo) {
  fs.writeFileSync(ARQ_MONSTROS, JSON.stringify({ atualizadoEm: Date.now(), arquivo, monstros }));
}
export function voltarMonstrosPadrao() {
  if (fs.existsSync(ARQ_MONSTROS)) fs.unlinkSync(ARQ_MONSTROS);
}

function nomesPericias(sis) {
  const per = new Map(), sub = new Map();
  for (const p of sis.pericias) {
    per.set(sem(p.nome), p.id);
    for (const s of p.subpericias) {
      sub.set(`${sem(p.nome)} › ${sem(s.nome)}`, s.id);
      if (!sub.has(sem(s.nome))) sub.set(sem(s.nome), s.id);
    }
  }
  return { per, sub };
}
// "Briga › Esquiva", "Briga[Esquiva]", "Briga > Esquiva" ou só "Esquiva".
const chaveSub = t => sem(t).replace(/\s*(?:›|>|\[)\s*/g, ' › ').replace(/\]\s*$/, '').trim();
const pontos = t => { const m = /^(.*?)[\s:=]+([+-]?\d+)\s*%?$/.exec(t.trim()); return m ? [m[1].trim(), parseInt(m[2], 10)] : [t.trim(), null]; };

// Lê a planilha e devolve { monstros, avisos }.
export async function lerPlanilhaMonstros(buffer, sis) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const aba = nome => wb.worksheets.find(w => sem(w.name) === sem(nome));
  const linhas = (ws, cols) => {
    if (!ws) return [];
    const mapa = Object.fromEntries(cols.map(([t, k]) => [sem(t), k]));
    const idx = {};
    ws.getRow(1).eachCell((cel, col) => { const k = mapa[sem(texto(cel.value))]; if (k) idx[k] = col; });
    const out = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const o = {};
      for (const [k, col] of Object.entries(idx)) o[k] = row.getCell(col).value;
      out.push(o);
    });
    return out;
  };
  const wsM = aba('Monstros') || wb.worksheets.find(w => sem(texto(w.getRow(1).getCell(1).value)) === 'nome');
  if (!wsM) throw new Error('Aba "Monstros" não encontrada. Use o modelo baixado pelo app.');
  const avisos = [];
  const { per, sub } = nomesPericias(sis);
  const tipos = sis.tiposCriatura || [];
  const tiposDano = sis.tiposDano || [];
  const tipoDe = t => tipos.find(x => sem(x.nome) === sem(t) || x.id === sem(t))?.id || null;
  const danoDe = t => tiposDano.find(x => sem(x) === sem(t)) || (t ? texto(t) : null);

  const monstros = [];
  for (const l of linhas(wsM, COL_MONSTROS)) {
    const nome = texto(l.nome);
    if (!nome) continue;
    const m = { nome };
    for (const k of ['raca', 'outrosDeslocamentos', 'sentidos', 'comportamento', 'habitat', 'imagem', 'descricao']) { const t = texto(l[k]); if (t) m[k] = t; }
    const tipo = texto(l.tipoCriatura);
    if (tipo) { m.tipoCriatura = tipoDe(tipo); if (!m.tipoCriatura) avisos.push(`${nome}: tipo de criatura "${tipo}" não existe (ficou Monstro).`); }
    const afinidades = [];
    for (const k of ['afinidade1', 'afinidade2']) {
      const t = texto(l[k]);
      if (!t) continue;
      const el = ELEMENTOS.find(x => sem(x) === sem(t));
      if (el && !afinidades.includes(el)) afinidades.push(el); else if (!el) avisos.push(`${nome}: afinidade elementar "${t}" não existe (use Elétrico, Calor ou Frio).`);
    }
    if (afinidades.length) m.afinidades = afinidades;
    const tam = TAMANHOS.find(t => sem(t) === sem(l.tamanho));
    if (tam) m.tamanho = tam;
    for (const k of ['nivel', 'dificuldade', 'xp', 'pv', 'ipGeral', 'deslocamento']) { const n = numero(l[k]); if (n != null) m[k] = n; }
    const atributos = {};
    for (const s of SIGLAS) { const n = numero(l[`atr:${s}`]); if (n != null) atributos[s] = n; }
    if (Object.keys(atributos).length) m.atributos = atributos;
    const pers = {}, subs = {};
    for (const t of lista(l.pericias)) {
      const [n, v] = pontos(t);
      const id = per.get(sem(n));
      if (id && v != null) pers[id] = v; else avisos.push(`${nome}: perícia "${t}" não reconhecida.`);
    }
    for (const t of lista(l.subpericias)) {
      const [n, v] = pontos(t);
      const id = sub.get(chaveSub(n));
      if (id && v != null) subs[id] = v; else avisos.push(`${nome}: subperícia "${t}" não reconhecida.`);
    }
    if (Object.keys(pers).length) m.pericias = pers;
    if (Object.keys(subs).length) m.subpericias = subs;
    const ipTipos = {};
    for (const t of lista(l.ipTipos)) { const [n, v] = pontos(t); if (v != null) ipTipos[danoDe(n)] = v; }
    if (Object.keys(ipTipos).length) m.ipTipos = ipTipos;
    for (const k of ['resistencias', 'imunidades', 'vulnerabilidades', 'saque']) { const xs = lista(l[k]); if (xs.length) m[k] = k === 'saque' ? xs : xs.map(danoDe); }
    m.ataques = []; m.habilidades = [];
    monstros.push(m);
  }
  const porNome = new Map(monstros.map(m => [sem(m.nome), m]));
  for (const l of linhas(aba('Ataques'), COL_ATAQUES)) {
    const m = porNome.get(sem(l.monstro));
    const nome = texto(l.nome);
    if (!nome) continue;
    if (!m) { avisos.push(`Ataque "${nome}": monstro "${texto(l.monstro)}" não está na aba Monstros.`); continue; }
    const a = { nome, dano: texto(l.dano) || '1d4' };
    const p = texto(l.pericia);
    if (p) { const id = sub.get(chaveSub(p)); if (id) a.pericia = id; else avisos.push(`${m.nome} › ${nome}: perícia "${p}" não reconhecida (usa Ataque desarmado).`); }
    const acerto = numero(l.acerto); if (acerto != null) a.acerto = acerto;
    const td = texto(l.tipoDano); if (td) a.tipoDano = danoDe(td);
    a.alcance = /dist/i.test(sem(l.alcance)) ? 'distancia' : 'corpo';
    for (const k of ['alcanceM', 'cadencia', 'efeitoDano', 'penetracao']) { const n = numero(l[k]); if (n != null) a[k] = n; }
    const obs = texto(l.obs); if (obs) a.obs = obs;
    m.ataques.push(a);
  }
  for (const l of linhas(aba('Habilidades'), COL_HABILIDADES)) {
    const m = porNome.get(sem(l.monstro));
    const nome = texto(l.nome);
    if (!nome) continue;
    if (!m) { avisos.push(`Habilidade "${nome}": monstro "${texto(l.monstro)}" não está na aba Monstros.`); continue; }
    const modo = MODOS.find(x => x === sem(l.modo)) || 'lembrete';
    m.habilidades.push({ nome, modo, efeitos: texto(l.efeitos), descricao: texto(l.descricao), ...(/^(s|sim|x|1|única|unica)$/i.test(texto(l.unica)) ? { unica: true } : {}) });
  }
  return { monstros, avisos };
}

// Planilha com o catálogo atual (ou só o modelo, com as listas) para o mestre editar.
export async function planilhaMonstros(sis, monstros) {
  const wb = new ExcelJS.Workbook();
  const nomesSub = Object.fromEntries(sis.pericias.flatMap(p => p.subpericias.map(s => [s.id, `${p.nome} › ${s.nome}`])));
  const nomesPer = Object.fromEntries(sis.pericias.map(p => [p.id, p.nome]));
  const tipoNome = id => (sis.tiposCriatura || []).find(t => t.id === id)?.nome || '';
  const ins = wb.addWorksheet('Instruções');
  ins.getColumn(1).width = 120;
  [
    'Livro dos Monstros — planilha do app',
    '',
    '• Aba Monstros: uma linha por criatura. Só "Nome" é obrigatório. Monstros não têm Sanidade nem Humanidade.',
    '• Defesas: calculadas como as do personagem — pelos atributos e pelas perícias/subperícias (Esquiva = Briga + Esquiva + 50), mais as habilidades.',
    '• Aba Ataques: uma linha por ataque (um monstro pode ter vários). O acerto vem da perícia do ataque, como no personagem; "Acerto %" substitui, se preenchido.',
    '• Afinidade elementar: até duas por criatura (Elétrico, Calor, Frio).',
    '• Aba Habilidades: poderes especiais. Marque "Única" nas habilidades únicas (não podem ser copiadas nem reveladas por testes como Zoologia).',
    '• Aba Habilidades (efeitos): "Efeitos no app" usa o formato do lápis do mestre (ex.: +1 IP geral; vantagem: ataque; imune: Dor; Furtividade +10%).',
    '• Listas separadas por ponto e vírgula (;). Ex.: Perícias = "Briga 4; Sentidos 3"; IP por tipo = "Corte 2; Frio 1".',
    '• Imagem: cole o link do Google Drive (Compartilhar > Qualquer pessoa com o link > Copiar link) ou o endereço de uma imagem.',
    '  Para usar um ARQUIVO, deixe em branco e envie no app: Livro dos Monstros > Enviar imagem.',
    '• Ao enviar no app: "Atualizar" troca os monstros de mesmo nome e mantém os outros; "Substituir" deixa só os da planilha.',
    '• O Livro dos Monstros vale para todas as campanhas deste PC. Monstros que já estão em campo não mudam.',
  ].forEach(t => ins.addRow([t]));
  ins.getRow(1).font = { bold: true, size: 13 };

  const cabec = (ws, cols) => {
    ws.columns = cols.map(([t, , w]) => ({ header: t, width: w }));
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A29' } };
    r.alignment = { wrapText: true, vertical: 'middle' };
    r.height = 32;
    cols.forEach(([, , , dica], i) => { if (dica) r.getCell(i + 1).note = dica; });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  };
  const wsM = wb.addWorksheet('Monstros'); cabec(wsM, COL_MONSTROS);
  const wsA = wb.addWorksheet('Ataques'); cabec(wsA, COL_ATAQUES);
  const wsH = wb.addWorksheet('Habilidades'); cabec(wsH, COL_HABILIDADES);
  const juntar = (obj, nome) => Object.entries(obj || {}).map(([k, v]) => `${nome(k)} ${v}`).join('; ');
  for (const m of monstros) {
    const v = {
      ...m, tipoCriatura: tipoNome(m.tipoCriatura), pericias: juntar(m.pericias, k => nomesPer[k] || k), subpericias: juntar(m.subpericias, k => nomesSub[k] || k),
      ipTipos: juntar(m.ipTipos, k => k), ...Object.fromEntries(['resistencias', 'imunidades', 'vulnerabilidades', 'saque'].map(k => [k, (m[k] || []).join('; ')])),
      ...Object.fromEntries(SIGLAS.map(s => [`atr:${s}`, m.atributos?.[s] ?? ''])),
      descricao: m.descricao || '', ipGeral: m.ipGeral ?? m.defesa ?? '', afinidade1: m.afinidades?.[0] || '', afinidade2: m.afinidades?.[1] || '',
    };
    wsM.addRow(COL_MONSTROS.map(([, k]) => v[k] ?? ''));
    const ataques = m.ataques?.length ? m.ataques : m.ataque ? [{ nome: m.ataque.replace(/\s*\d*d\d.*$/i, '') || 'Ataque', dano: /\d*d\d+(?:[+-]\d+)?/i.exec(m.ataque)?.[0] || '1d4' }] : [];
    for (const a of ataques) wsA.addRow(COL_ATAQUES.map(([, k]) => (k === 'monstro' ? m.nome : k === 'pericia' ? nomesSub[a.pericia] || '' : k === 'alcance' ? (a.alcance === 'distancia' ? 'distância' : 'corpo') : a[k] ?? '')));
    for (const hb of m.habilidades || []) wsH.addRow(COL_HABILIDADES.map(([, k]) => (k === 'monstro' ? m.nome : k === 'unica' ? (hb.unica ? 'sim' : 'não') : hb[k] ?? '')));
  }
  const lst = wb.addWorksheet('Listas');
  const listas = [
    ['Tipo de criatura', (sis.tiposCriatura || []).map(t => t.nome)], ['Tamanho', TAMANHOS], ['Tipo de dano', sis.tiposDano || []],
    ['Alcance', ['corpo', 'distância']], ['Modo', MODOS], ['Subperícias (ataque)', Object.values(nomesSub)], ['Perícias', Object.values(nomesPer)],
    ['Afinidade elementar', ELEMENTOS], ['Sim/não', ['sim', 'não']],
  ];
  lst.columns = listas.map(([h]) => ({ header: h, width: 26 }));
  lst.getRow(1).font = { bold: true };
  const n = Math.max(...listas.map(([, l]) => l.length));
  for (let i = 0; i < n; i++) lst.addRow(listas.map(([, l]) => l[i] ?? ''));
  const letra = i => String.fromCharCode(65 + i);
  const validar = (ws, chave, cols, iLista) => {
    const c = cols.findIndex(([, k]) => k === chave) + 1;
    if (!c) return;
    const fim = listas[iLista][1].length + 1;
    for (let r = 2; r <= 400; r++) ws.getCell(r, c).dataValidation = { type: 'list', allowBlank: true, formulae: [`Listas!$${letra(iLista)}$2:$${letra(iLista)}$${fim}`] };
  };
  validar(wsM, 'tipoCriatura', COL_MONSTROS, 0);
  validar(wsM, 'tamanho', COL_MONSTROS, 1);
  validar(wsA, 'tipoDano', COL_ATAQUES, 2);
  validar(wsA, 'alcance', COL_ATAQUES, 3);
  validar(wsA, 'pericia', COL_ATAQUES, 5);
  validar(wsH, 'modo', COL_HABILIDADES, 4);
  validar(wsM, 'afinidade1', COL_MONSTROS, 7);
  validar(wsM, 'afinidade2', COL_MONSTROS, 7);
  validar(wsH, 'unica', COL_HABILIDADES, 8);
  return wb.xlsx.writeBuffer();
}
