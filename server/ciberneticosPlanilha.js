// Cibernéticos por planilha (autor, 30/10): completa os implantes do catálogo de itens (tipo, local no corpo, Humanidade,
// se substitui membro, cirurgia, rejeição), a lista de funções adicionais dos membros do Ciborgue e as regras gerais.
// Fica em data/catalogo-ciberneticos.json; vale no MSA e no MSS.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { numero, simNao, texto, abrirPlanilha, aba, linhasDaAba, novaPlanilha, instrucoes, abaComDados, listasComValidacao } from './planilhaComum.js';
import { implantesDoCatalogo } from '../shared/ciberneticos.js';

export const ARQ_CIBERNETICOS = path.join(DATA_DIR, 'catalogo-ciberneticos.json');
export function catalogoCiberneticos() {
  if (!fs.existsSync(ARQ_CIBERNETICOS)) return null;
  return JSON.parse(fs.readFileSync(ARQ_CIBERNETICOS, 'utf8'));
}
export function salvarCatalogoCiberneticos(tab, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_CIBERNETICOS, JSON.stringify({ atualizadoEm: Date.now(), arquivo, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), ...tab }));
}
export function voltarCiberneticosPadrao() {
  if (fs.existsSync(ARQ_CIBERNETICOS)) fs.unlinkSync(ARQ_CIBERNETICOS);
}

const TIPOS = ['Membro', 'Órgão', 'Periférico'];
const COL_IMPLANTES = [
  ['Código do item', 'item', 12, 'Código do implante no catálogo de itens (não mude). Implante novo: crie primeiro na planilha de itens.'],
  ['Implante', 'nome', 30, 'Só para conferência: o nome vem do catálogo de itens'],
  ['Tipo', 'tipo', 12, 'Membro, Órgão ou Periférico'],
  ['Local no corpo', 'local', 16, 'Ex.: Braço, Perna, Olhos, Cabeça, Tronco, Pele, Órgão interno'],
  ['Humanidade', 'humanidade', 11, 'Quanto a Humanidade cai ao implantar (provisório: −10)'],
  ['Substitui membro (sim/não)', 'substitui', 11, 'Implante de reposição de um membro perdido'],
  ['ND da cirurgia', 'ndCirurgia', 10, null],
  ['Perícia da cirurgia', 'periciaCirurgia', 22, 'Ex.: Medicina › Cibernética'],
  ['Rejeição', 'rejeicao', 30, 'Como funciona a rejeição para quem não é ciborgue (teste, ND…)'],
  ['Observações', 'obs', 30, null],
];
const COL_FUNCOES = [
  ['Função adicional', 'nome', 26, 'Obrigatório'],
  ['Para (local ou tipo)', 'para', 18, 'Ex.: Braço; Perna; Membro'],
  ['Efeito', 'efeito', 60, null],
  ['Observações', 'obs', 30, null],
];
const COL_REGRAS = [['Regra', 'chave', 24, null], ['Valor', 'valor', 10, null], ['Explicação', 'texto', 90, null]];
const EXPLICA = {
  humanidadePorImplante: 'Humanidade perdida por implante quando a linha do implante está em branco (provisório: −10)',
  limiteNormal: 'Implantes que qualquer personagem pode ter (de reposição de membro ou qualquer outro)',
  ciborgueNoNivel3: 'Implantes do Ciborgue no nível 3',
  ciborgueACadaNiveis: 'O Ciborgue ganha +1 implante a cada este tanto de níveis depois do 3º',
  ciborgueMaximo: 'Máximo de implantes do Ciborgue',
};

export async function planilhaCiberneticos(sis) {
  const tab = sis.ciberneticos || {};
  const wb = novaPlanilha();
  instrucoes(wb, [
    'Cibernéticos — planilha do app',
    '',
    '• Os implantes são itens do catálogo (planilha de itens, finalidade "Cibernético"): preço, peso, efeito e produção ficam lá.',
    '• Aba Implantes: o que é próprio de implante — tipo (Membro, Órgão, Periférico), local no corpo, Humanidade, se substitui membro, cirurgia e rejeição.',
    '  Uma linha por implante, ligada pelo "Código do item". Implante novo: crie na planilha de itens e ele aparece aqui na próxima vez.',
    '• Aba Funções adicionais: o que um implante de membro do Ciborgue pode ganhar (todo implante de membro do Ciborgue recebe uma).',
    '• Aba Regras: limite de implantes (normal: 1; Ciborgue: mais no nível 3 e +1 a cada 4 níveis, até 6) e a Humanidade padrão.',
    '• Vale no MSA e no MSS e para todas as campanhas deste PC. Ligada ao Google Planilhas, o app puxa sozinho ao abrir e a cada 30 minutos.',
  ]);
  const wsI = abaComDados(wb, 'Implantes', COL_IMPLANTES, implantesDoCatalogo(sis).map(x => ({ ...x, substitui: x.substitui == null ? '' : x.substitui ? 'sim' : 'não', ndCirurgia: x.ndCirurgia ?? '' })));
  abaComDados(wb, 'Funções adicionais', COL_FUNCOES, tab.funcoes || []);
  abaComDados(wb, 'Regras', COL_REGRAS, [
    ...Object.entries(tab.regras || {}).map(([chave, valor]) => ({ chave, valor, texto: EXPLICA[chave] || '' })),
    ...(tab.notas || []).map((t, i) => ({ chave: `nota${i + 1}`, valor: '', texto: t })),
  ]);
  listasComValidacao(wb, [['Tipo', TIPOS, [[wsI, COL_IMPLANTES, 'tipo']]], ['Sim/não', ['sim', 'não'], [[wsI, COL_IMPLANTES, 'substitui']]]]);
  return wb.xlsx.writeBuffer();
}

export async function lerPlanilhaCiberneticos(buffer, sis) {
  const wb = await abrirPlanilha(buffer);
  const wsI = aba(wb, 'Implantes');
  if (!wsI) throw new Error('Aba "Implantes" não encontrada. Use a planilha baixada pelo app.');
  const avisos = [];
  const doCatalogo = new Set((sis.itens || []).filter(i => i.tipo === 'cibernetico').map(i => i.id));
  const implantes = [];
  for (const l of linhasDaAba(wsI, COL_IMPLANTES)) {
    if (!l.item) { avisos.push(`Implantes, linha ${l._linha} (${l.nome || 'sem nome'}): sem código do item — ignorada.`); continue; }
    if (!doCatalogo.has(l.item)) avisos.push(`Implantes, linha ${l._linha}: o item "${l.item}" (${l.nome}) não é um implante do catálogo de itens — guardado mesmo assim.`);
    implantes.push({
      item: l.item, nome: l.nome || '', tipo: TIPOS.find(t => t.toLowerCase() === String(l.tipo).toLowerCase()) || l.tipo || '', local: l.local || '',
      humanidade: numero(String(l.humanidade || '').replace('−', '-')) ?? -10, substitui: l.substitui ? simNao(l.substitui) : null,
      ndCirurgia: numero(l.ndCirurgia), rejeicao: l.rejeicao || '', obs: l.obs || '', periciaCirurgia: l.periciaCirurgia || '',
    });
  }
  const funcoes = linhasDaAba(aba(wb, 'Funções adicionais') || aba(wb, 'Funcoes adicionais'), COL_FUNCOES)
    .filter(l => l.nome).map(l => ({ nome: l.nome, para: l.para || '', efeito: l.efeito || '', obs: l.obs || '' }));
  const regrasL = linhasDaAba(aba(wb, 'Regras'), COL_REGRAS);
  const regras = { ...(sis.ciberneticos?.regras || {}) };
  for (const l of regrasL) if (!/^nota/.test(l.chave) && l.chave) { const n = numero(String(texto(l.valor)).replace('−', '-')); if (n != null) regras[l.chave] = n; }
  const notas = regrasL.filter(l => /^nota/.test(l.chave)).map(l => l.texto).filter(Boolean);
  return { tabela: { regras, notas: notas.length ? notas : sis.ciberneticos?.notas || [], implantes, funcoes }, total: implantes.length + funcoes.length, avisos };
}
