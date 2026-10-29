// Profissões por planilha (autor, 29/10): uma planilha por frente do jogo. Uma linha por profissão; as subperícias são
// escritas como no livro ("Briga/Escudo") e cada sistema fica só com as que existem nele (Defesa desarmada só no MSS).
// Fica em data/catalogo-profissoes.json e vale para todas as campanhas deste PC.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { sem, lista, numero, abrirPlanilha, aba, linhasDaAba, novaPlanilha, instrucoes, abaComDados, listasComValidacao } from './planilhaComum.js';

export const ARQ_PROFISSOES = path.join(DATA_DIR, 'catalogo-profissoes.json');
export function catalogoProfissoes() {
  if (!fs.existsSync(ARQ_PROFISSOES)) return null;
  return JSON.parse(fs.readFileSync(ARQ_PROFISSOES, 'utf8'));
}
export function salvarCatalogoProfissoes(cat, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_PROFISSOES, JSON.stringify({ atualizadoEm: Date.now(), arquivo, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), ...cat }));
}
export function voltarProfissoesPadrao() {
  if (fs.existsSync(ARQ_PROFISSOES)) fs.unlinkSync(ARQ_PROFISSOES);
}

const COLUNAS = [
  ['Código', 'id', 16, 'As fichas guardam o código: não mude o de uma profissão que já existe. Nova: deixe em branco.'],
  ['Profissão', 'nome', 20, 'Obrigatório'],
  ['Descrição', 'descricao', 60, null],
  ['Vantagem (texto)', 'vantagem', 60, 'A vantagem da profissão, como no livro'],
  ['Bônus %', 'bonus', 8, 'Bônus nas subperícias da profissão (padrão 5)'],
  ['Subperícias (como no livro; separe por ;)', 'subpericias', 50, 'Ex.: Briga/Escudo; Esportes/Natação. Cada sistema usa só as que existem nele.'],
  ['PV a mais', 'pv', 9, 'PV somados ao personagem (ex.: Sobrevivente +5)'],
  ['Sistema', 'sistema', 11, 'MSA e MSS (padrão), só MSA ou só MSS'],
];
const SISTEMAS = ['MSA e MSS', 'só MSA', 'só MSS'];
const valeNo = (t, id) => { const s = sem(t); return !s || /msa e mss|ambos|todos/.test(s) || s.includes(id); };

// "Briga/Escudo" → id da subperícia no sistema (null se não existe nele).
function idSubpericia(sis, t) {
  const [per, sub] = String(t).split(/\s*[/›>]\s*/);
  const p = sis.pericias.find(x => sem(x.nome) === sem(per) || x.id === sem(per));
  return p?.subpericias.find(s => sem(s.nome) === sem(sub) || s.id === sem(sub))?.id || null;
}

export async function planilhaProfissoes(msa, mss) {
  const linhas = [];
  // Mesma profissão nos dois sistemas: uma linha. A lista do livro é a mesma; cada sistema filtra as que tem.
  for (const b of mss.profissoes) {
    const a = msa.profissoes.find(x => x.id === b.id);
    const comum = p => ({ id: p.id, nome: p.nome, descricao: p.descricao, vantagem: p.vantagem, bonus: p.bonus ?? 5, subpericias: (p.subpericiasLivro || []).join('; '), pv: p.extras?.pv ?? '' });
    if (a && JSON.stringify(comum(a)) === JSON.stringify(comum(b))) linhas.push({ ...comum(b), sistema: SISTEMAS[0] });
    else { if (a) linhas.push({ ...comum(a), sistema: SISTEMAS[1] }); linhas.push({ ...comum(b), sistema: SISTEMAS[2] }); }
  }
  for (const a of msa.profissoes) if (!mss.profissoes.some(x => x.id === a.id)) linhas.push({ id: a.id, nome: a.nome, descricao: a.descricao, vantagem: a.vantagem, bonus: a.bonus ?? 5, subpericias: (a.subpericiasLivro || []).join('; '), pv: a.extras?.pv ?? '', sistema: SISTEMAS[1] });
  const wb = novaPlanilha();
  instrucoes(wb, [
    'Profissões — planilha do app',
    '',
    '• Uma linha por profissão. "Profissão" é obrigatório.',
    '• Subperícias: escreva como no livro, "Perícia/Subperícia", separadas por ; (ex.: Briga/Escudo; Esportes/Natação). Elas recebem o "Bônus %".',
    '  Cada sistema usa só as subperícias que existem nele (ex.: Briga/Defesa Desarmada só existe no MSS).',
    '• "PV a mais": PV somados ao personagem com essa profissão (Sobrevivente: 5).',
    '• A "Vantagem (texto)" aparece no livro; o mestre aplica o que não for número de perícia ou PV.',
    '• Códigos: as fichas guardam o código da profissão. Não mude o de uma que já existe; numa nova, deixe em branco.',
    '• Vale para todas as campanhas deste PC. Ligada ao Google Planilhas, o app puxa sozinho ao abrir e a cada 30 minutos.',
  ]);
  const ws = abaComDados(wb, 'Profissões', COLUNAS, linhas);
  listasComValidacao(wb, [['Sistema', SISTEMAS, [[ws, COLUNAS, 'sistema']]], ['Subperícias', mss.pericias.flatMap(p => p.subpericias.map(s => `${p.nome}/${s.nome}`)), []]]);
  return wb.xlsx.writeBuffer();
}

const slug = t => sem(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function lerPlanilhaProfissoes(buffer, msa, mss) {
  const wb = await abrirPlanilha(buffer);
  const ws = aba(wb, 'Profissões') || aba(wb, 'Profissoes');
  if (!ws) throw new Error('Aba "Profissões" não encontrada. Use a planilha baixada pelo app.');
  const avisos = [];
  const ls = linhasDaAba(ws, COLUNAS).filter(l => {
    if (!l.nome) avisos.push(`Linha ${l._linha}: sem nome — ignorada.`);
    return !!l.nome;
  });
  for (const l of ls) for (const t of lista(l.subpericias)) {
    if (!idSubpericia(msa, t) && !idSubpericia(mss, t)) avisos.push(`Linha ${l._linha} (${l.nome}): subperícia "${t}" não existe — ignorada.`);
  }
  const montar = (sis, id) => ls.filter(l => valeNo(l.sistema, id)).map(l => {
    const livro = lista(l.subpericias);
    return {
      id: l.id || slug(l.nome), nome: l.nome, descricao: l.descricao || '', vantagem: l.vantagem || '', bonus: numero(l.bonus) ?? 5,
      subpericias: livro.map(t => idSubpericia(sis, t)).filter(Boolean), subpericiasLivro: livro,
      extras: numero(l.pv) ? { pv: numero(l.pv) } : {},
    };
  });
  return { catalogo: { sistemas: { msa: montar(msa, 'msa'), mss: montar(mss, 'mss') } }, total: ls.length, avisos };
}
