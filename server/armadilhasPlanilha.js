// Armadilhas por planilha (autor, 29/10): armadilhas prontas e as tabelas de montar (gatilho, área, efeitos) do Capítulo 8.
// Fica em data/catalogo-armadilhas.json; vale no MSA e no MSS e para todas as campanhas deste PC.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { sem, numero, abrirPlanilha, aba, linhasDaAba, novaPlanilha, instrucoes, abaComDados } from './planilhaComum.js';

export const ARQ_ARMADILHAS = path.join(DATA_DIR, 'catalogo-armadilhas.json');
export function catalogoArmadilhas() {
  if (!fs.existsSync(ARQ_ARMADILHAS)) return null;
  return JSON.parse(fs.readFileSync(ARQ_ARMADILHAS, 'utf8'));
}
export function salvarCatalogoArmadilhas(tab, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_ARMADILHAS, JSON.stringify({ atualizadoEm: Date.now(), arquivo, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), ...tab }));
}
export function voltarArmadilhasPadrao() {
  if (fs.existsSync(ARQ_ARMADILHAS)) fs.unlinkSync(ARQ_ARMADILHAS);
}

const COL_PRONTAS = [
  ['Código', 'id', 16, 'Nova: deixe em branco'],
  ['Armadilha', 'nome', 26, 'Obrigatório'],
  ['Materiais necessários', 'materiais', 40, null],
  ['Gatilho', 'gatilho', 22, null],
  ['Área afetada', 'area', 18, null],
  ['ND Improvisar', 'ndImprovisar', 9, null],
  ['ND Armar', 'ndArmar', 9, null],
  ['ND Desarmar', 'ndDesarmar', 9, null],
  ['ND Encontrar', 'ndEncontrar', 9, null],
  ['Dano', 'dano', 9, 'Ex.: 2d8 (em branco: sem dano)'],
  ['Tipo de dano', 'tipoDano', 14, null],
  ['Efeitos diversos', 'efeitos', 50, null],
  ['Observações', 'obs', 30, null],
];
const COL_GATILHOS = [
  ['Gatilho', 'nome', 30, 'Obrigatório'],
  ['ND Criar (+)', 'criar', 9, 'Soma no ND de criação (base 50)'],
  ['ND Armar (+)', 'armar', 9, null],
  ['ND Encontrar (+)', 'encontrar', 9, null],
  ['ND Desarmar (+)', 'desarmar', 9, 'Pode ser negativo (ex.: −20)'],
  ['Observações táticas e requisitos', 'obs', 70, null],
];
const COL_AREAS = [
  ['Código', 'id', 10, 'unico, linha, explosao, cone (a calculadora usa o código)'],
  ['Área afetada', 'nome', 34, null],
  ['ND Criar fixo (+)', 'modFixo', 10, 'Ex.: Cone +50'],
  ['ND Criar por passo (+)', 'modPorPasso', 10, 'Por passo de 1,5 m. Ex.: Linha +5, Explosão +10'],
  ['Máx. de passos', 'maxPassos', 9, '1 = alvo único; em branco = sem limite'],
  ['Custo material', 'custo', 16, null],
  ['Tempo de preparação', 'tempo', 24, null],
];
const COL_EFEITOS = [
  ['Efeito', 'nome', 28, 'Obrigatório'],
  ['ND Criar (+)', 'criar', 9, null],
  ['Material exigido', 'material', 40, null],
];
const COL_GERAL = [['Regra', 'chave', 30, null], ['Valor', 'valor', 12, null], ['Explicação', 'texto', 80, null]];

export async function planilhaArmadilhas(tab) {
  const wb = novaPlanilha();
  instrucoes(wb, [
    'Armadilhas — planilha do app (Capítulo 8)',
    '',
    '• Aba Prontas: as armadilhas prontas (materiais, gatilho, área, NDs, dano e efeitos).',
    '• Abas Gatilhos, Áreas e Efeitos: as tabelas para montar armadilha. A calculadora do app (Livro > Armadilhas) usa estes números:',
    '  ND Criar = base + gatilho + área + tamanho do dano + efeitos; ND Armar/Encontrar/Desarmar = base + o do gatilho.',
    '• Tamanho do dano: cada salto na progressão (D4 > D6 > … > 2D20) soma "ND por salto de dano"; em área, conta de novo para cada passo (1,5 m).',
    '• Aba Geral: a base do ND (50) e o ND por salto de dano (5).',
    '• Vale no MSA e no MSS e para todas as campanhas deste PC. Ligada ao Google Planilhas, o app puxa sozinho ao abrir e a cada 30 minutos.',
  ]);
  abaComDados(wb, 'Prontas', COL_PRONTAS, tab.prontas || []);
  abaComDados(wb, 'Gatilhos', COL_GATILHOS, tab.gatilhos || []);
  abaComDados(wb, 'Áreas', COL_AREAS, (tab.areas || []).map(a => ({ ...a, maxPassos: a.maxPassos ?? '' })));
  abaComDados(wb, 'Efeitos', COL_EFEITOS, tab.efeitos || []);
  abaComDados(wb, 'Geral', COL_GERAL, [
    { chave: 'base', valor: tab.base ?? 50, texto: 'ND base de qualquer armadilha improvisada (Fácil)' },
    { chave: 'danoPorPasso', valor: tab.danoPorPasso ?? 5, texto: 'ND de criação por salto na progressão de dano' },
    ...(tab.notas || []).map((t, i) => ({ chave: `nota${i + 1}`, valor: '', texto: t })),
  ]);
  return wb.xlsx.writeBuffer();
}

const slug = t => sem(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = v => numero(String(v ?? '').replace('−', '-'));

export async function lerPlanilhaArmadilhas(buffer, padrao) {
  const wb = await abrirPlanilha(buffer);
  if (!aba(wb, 'Prontas') && !aba(wb, 'Gatilhos')) throw new Error('Abas "Prontas" e "Gatilhos" não encontradas. Use a planilha baixada pelo app.');
  const avisos = [];
  const com = (ws, cols) => linhasDaAba(ws, cols).filter(l => { if (!l.nome) avisos.push(`${ws.name}, linha ${l._linha}: sem nome — ignorada.`); return !!l.nome; });
  const prontas = com(aba(wb, 'Prontas'), COL_PRONTAS).map(l => ({
    id: l.id || slug(l.nome), nome: l.nome, materiais: l.materiais || '', gatilho: l.gatilho || '', area: l.area || '',
    ndImprovisar: num(l.ndImprovisar), ndArmar: num(l.ndArmar), ndDesarmar: num(l.ndDesarmar), ndEncontrar: num(l.ndEncontrar),
    dano: (l.dano || '').toLowerCase(), tipoDano: l.tipoDano || '', efeitos: l.efeitos || '', ...(l.obs ? { obs: l.obs } : {}),
  }));
  const gatilhos = com(aba(wb, 'Gatilhos'), COL_GATILHOS).map(l => ({ nome: l.nome, criar: num(l.criar) ?? 0, armar: num(l.armar) ?? 0, encontrar: num(l.encontrar) ?? 0, desarmar: num(l.desarmar) ?? 0, obs: l.obs || '' }));
  const areas = com(aba(wb, 'Áreas') || aba(wb, 'Areas'), COL_AREAS).map(l => ({
    id: l.id || slug(l.nome), nome: l.nome, modFixo: num(l.modFixo) ?? 0, modPorPasso: num(l.modPorPasso) ?? 0, maxPassos: num(l.maxPassos), custo: l.custo || '', tempo: l.tempo || '',
  }));
  const efeitos = com(aba(wb, 'Efeitos'), COL_EFEITOS).map(l => ({ nome: l.nome, criar: num(l.criar) ?? 0, material: l.material || '' }));
  const geral = Object.fromEntries(linhasDaAba(aba(wb, 'Geral'), COL_GERAL).map(l => [l.chave, l]));
  const notas = Object.entries(geral).filter(([k]) => /^nota/.test(k)).map(([, l]) => l.texto).filter(Boolean);
  const tab = {
    base: num(geral.base?.valor) ?? padrao?.base ?? 50, danoPorPasso: num(geral.danoPorPasso?.valor) ?? padrao?.danoPorPasso ?? 5,
    prontas, gatilhos: gatilhos.length ? gatilhos : padrao?.gatilhos || [], areas: areas.length ? areas : padrao?.areas || [], efeitos: efeitos.length ? efeitos : padrao?.efeitos || [],
    notas: notas.length ? notas : padrao?.notas || [],
  };
  if (!gatilhos.length) avisos.push('Aba "Gatilhos" vazia: ficaram os gatilhos do livro do autor.');
  return { tabela: tab, total: prontas.length + gatilhos.length + areas.length + efeitos.length, avisos };
}
