// Tabela de mutações (d100) por planilha (autor, 29/10): uma planilha por frente do jogo. O mestre baixa, edita (ou liga
// a uma planilha do Google) e o app passa a usar a dele. Fica em data/catalogo-mutacoes.json; vale no MSA e no MSS.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { numero, abrirPlanilha, aba, linhasDaAba, novaPlanilha, instrucoes, abaComDados } from './planilhaComum.js';

export const ARQ_MUTACOES = path.join(DATA_DIR, 'catalogo-mutacoes.json');
export function catalogoMutacoes() {
  if (!fs.existsSync(ARQ_MUTACOES)) return null;
  return JSON.parse(fs.readFileSync(ARQ_MUTACOES, 'utf8'));
}
export function salvarCatalogoMutacoes(mutacoes, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_MUTACOES, JSON.stringify({ atualizadoEm: Date.now(), arquivo, total: mutacoes.length, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), mutacoes }));
}
export function voltarMutacoesPadrao() {
  if (fs.existsSync(ARQ_MUTACOES)) fs.unlinkSync(ARQ_MUTACOES);
}

const COLUNAS = [
  ['Nº (d100)', 'n', 9, 'Número no d100 (1 a 100). Não repita.'],
  ['Mutação', 'nome', 28, 'Obrigatório'],
  ['Efeito (texto)', 'efeito', 80, 'O texto completo, como no livro'],
  ['Benefício no app', 'beneficio', 30, 'O que o app aplica sozinho, no formato do lápis do mestre. Ex.: Manipulação +10%; +1 IP geral; vantagem: Sentidos'],
  ['Ônus no app', 'onus', 30, 'Idem, para o lado ruim. Controlada: só o benefício; descontrolada e temporária: benefício e ônus.'],
  ['Observações', 'obs', 30, null],
];

export async function planilhaMutacoes(mutacoes) {
  const wb = novaPlanilha();
  instrucoes(wb, [
    'Mutações (tabela d100) — planilha do app',
    '',
    '• Uma linha por mutação. "Nº (d100)" é o número sorteado no d100 (1 a 100); "Mutação" é obrigatório.',
    '• "Efeito (texto)" é o texto do livro. "Benefício no app" e "Ônus no app" dizem o que o app aplica sozinho, no formato do lápis do mestre',
    '  (ex.: Manipulação +10%; +1 IP geral; vantagem: Sentidos; imune: Dor). Em branco: o efeito fica só como texto (o mestre aplica).',
    '• Mutação controlada: só o benefício. Descontrolada e temporária: benefício e ônus.',
    '• As fichas guardam o número da mutação: mudar o número de uma mutação muda a de quem já a tem.',
    '• Vale no MSA e no MSS e para todas as campanhas deste PC. Ligada ao Google Planilhas, o app puxa sozinho ao abrir e a cada 30 minutos.',
  ]);
  abaComDados(wb, 'Mutações', COLUNAS, mutacoes);
  return wb.xlsx.writeBuffer();
}

export async function lerPlanilhaMutacoes(buffer) {
  const wb = await abrirPlanilha(buffer);
  const ws = aba(wb, 'Mutações') || aba(wb, 'Mutacoes') || wb.worksheets.find(w => w.name !== 'Instruções');
  if (!ws) throw new Error('Aba "Mutações" não encontrada. Use a planilha baixada pelo app.');
  const avisos = [];
  const vistos = new Set();
  const mutacoes = [];
  for (const l of linhasDaAba(ws, COLUNAS)) {
    if (!l.nome) { avisos.push(`Linha ${l._linha}: sem nome — ignorada.`); continue; }
    const n = numero(l.n);
    if (!Number.isInteger(n) || n < 1) { avisos.push(`Linha ${l._linha} (${l.nome}): número do d100 inválido — ignorada.`); continue; }
    if (vistos.has(n)) { avisos.push(`Linha ${l._linha} (${l.nome}): o número ${n} já foi usado — ignorada.`); continue; }
    vistos.add(n);
    mutacoes.push({ n, nome: l.nome, efeito: l.efeito || '', ...(l.beneficio ? { beneficio: l.beneficio } : {}), ...(l.onus ? { onus: l.onus } : {}), ...(l.obs ? { obs: l.obs } : {}) });
  }
  const faltam = Array.from({ length: 100 }, (_, i) => i + 1).filter(i => !vistos.has(i));
  if (mutacoes.length && faltam.length && faltam.length < 100) avisos.push(`Números do d100 sem mutação: ${faltam.slice(0, 20).join(', ')}${faltam.length > 20 ? '…' : ''} (sorteio neles não dá mutação; o mestre escolhe).`);
  return { mutacoes: mutacoes.sort((a, b) => a.n - b.n), avisos };
}
