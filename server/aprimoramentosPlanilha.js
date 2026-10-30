// Aprimoramentos de itens por planilha (autor, 30/10): a lista do livro (Capítulo 4) e os que o autor criar. "Para" diz a
// que itens servem (arma, defesa, armadilha… — os de armadilha não são necessariamente os mesmos dos outros itens).
// As colunas de efeito dizem o que o app aplica no item; o resto fica como texto. Fica em data/catalogo-aprimoramentos.json.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { sem, numero, simNao, abrirPlanilha, aba, linhasDaAba, novaPlanilha, instrucoes, abaComDados, listasComValidacao } from './planilhaComum.js';

export const ARQ_APRIMORAMENTOS = path.join(DATA_DIR, 'catalogo-aprimoramentos.json');
export function catalogoAprimoramentos() {
  if (!fs.existsSync(ARQ_APRIMORAMENTOS)) return null;
  return JSON.parse(fs.readFileSync(ARQ_APRIMORAMENTOS, 'utf8'));
}
export function salvarCatalogoAprimoramentos(lista, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_APRIMORAMENTOS, JSON.stringify({ atualizadoEm: Date.now(), arquivo, total: lista.length, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), aprimoramentos: lista }));
}
export function voltarAprimoramentosPadrao() {
  if (fs.existsSync(ARQ_APRIMORAMENTOS)) fs.unlinkSync(ARQ_APRIMORAMENTOS);
}

// Campos numéricos de efeito (o que o app vai aplicar no item aprimorado).
const NUMEROS = ['testes', 'dano', 'passos', 'durabilidade', 'peso', 'deslocamento', 'moral', 'outros'];
const COLUNAS = [
  ['Código', 'id', 16, 'Nova: deixe em branco'],
  ['Aprimoramento', 'nome', 20, 'Obrigatório'],
  ['Para (tipos de item; separe por ;)', 'para', 22, 'Ex.: arma; defesa; armadilha. Em branco: qualquer item. Os de armadilha não precisam ser os mesmos dos outros itens.'],
  ['Efeito (texto)', 'efeito', 60, 'O texto do livro'],
  ['Testes (+%)', 'testes', 9, 'Ex.: Melhorado +5'],
  ['Dano (+)', 'dano', 8, 'Ex.: Afiado +1'],
  ['Passos de dano', 'passos', 9, 'Ex.: Mortal 1 (D6 → D8)'],
  ['Dano extra (dados)', 'danoExtra', 10, 'Ex.: 1d4'],
  ['Tipo do dano extra', 'tipoExtra', 12, 'Ex.: Elétrico, Calor'],
  ['Durabilidade (+)', 'durabilidade', 10, 'Ex.: Alta qualidade +1'],
  ['Peso (%)', 'peso', 8, 'Ex.: Leve 70 (= 70% do peso)'],
  ['Deslocamento (+m)', 'deslocamento', 10, 'Ex.: Veloz 1,5'],
  ['Moral por descanso longo', 'moral', 10, 'Ex.: Cravejado 1'],
  ['Para outros usarem (%)', 'outros', 10, 'Ex.: Segredo −10'],
  ['Repetível (sim/não)', 'repetivel', 9, 'Pode ser posto mais de uma vez no mesmo item (padrão: sim)'],
  ['Materiais', 'materiais', 30, 'Itens ou matérias-primas consumidos (regra a definir pelo autor)'],
  ['Observações', 'obs', 30, null],
];

export async function planilhaAprimoramentos(lista) {
  const wb = novaPlanilha();
  instrucoes(wb, [
    'Aprimoramentos de itens — planilha do app',
    '',
    '• Uma linha por aprimoramento. "Aprimoramento" é obrigatório.',
    '• "Para": a que tipos de item serve (arma; defesa; armadilha; ferramenta…). Em branco = qualquer item.',
    '  Os aprimoramentos de armadilha não são necessariamente os mesmos dos outros itens: faça linhas próprias com "Para" = armadilha.',
    '• Colunas de efeito (Testes, Dano, Passos de dano, Dano extra, Durabilidade, Peso, Deslocamento, Moral, Para outros usarem): o que o app aplica no item.',
    '  O que não cabe nelas fica no "Efeito (texto)" e o mestre aplica.',
    '• Repetível: o mesmo aprimoramento pode ir mais de uma vez no item (padrão sim), a não ser que a descrição diga o contrário.',
    '• Vale no MSA e no MSS e para todas as campanhas deste PC. Ligada ao Google Planilhas, o app puxa sozinho ao abrir e a cada 30 minutos.',
  ]);
  const ws = abaComDados(wb, 'Aprimoramentos', COLUNAS, lista.map(a => ({ ...a, repetivel: a.repetivel === false ? 'não' : 'sim' })));
  listasComValidacao(wb, [['Sim/não', ['sim', 'não'], [[ws, COLUNAS, 'repetivel']]]]);
  return wb.xlsx.writeBuffer();
}

const slug = t => sem(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export async function lerPlanilhaAprimoramentos(buffer) {
  const wb = await abrirPlanilha(buffer);
  const ws = aba(wb, 'Aprimoramentos');
  if (!ws) throw new Error('Aba "Aprimoramentos" não encontrada. Use a planilha baixada pelo app.');
  const avisos = [];
  const vistos = new Set();
  const lista = [];
  for (const l of linhasDaAba(ws, COLUNAS)) {
    if (!l.nome) { avisos.push(`Linha ${l._linha}: sem nome — ignorada.`); continue; }
    const id = l.id || slug(l.nome);
    if (vistos.has(id)) { avisos.push(`Linha ${l._linha} (${l.nome}): código repetido — ignorada.`); continue; }
    vistos.add(id);
    const a = { id, nome: l.nome, para: l.para || '', efeito: l.efeito || '' };
    for (const k of NUMEROS) { const n = numero(String(l[k] ?? '').replace('−', '-')); if (n != null) a[k] = n; }
    if (l.danoExtra) a.danoExtra = l.danoExtra.toLowerCase();
    if (l.tipoExtra) a.tipoExtra = l.tipoExtra;
    a.repetivel = l.repetivel ? simNao(l.repetivel) : true;
    if (l.materiais) a.materiais = l.materiais;
    if (l.obs) a.obs = l.obs;
    lista.push(a);
  }
  return { aprimoramentos: lista, avisos };
}
