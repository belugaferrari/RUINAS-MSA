// Habilidades por planilha (.xlsx), como itens e monstros (autor, 29/10): classes, especializações, progressão por nível,
// habilidades, vantagens, defeitos e capacidades — com o texto do livro e as colunas de regra do app (modo, ação, dano,
// alcance, usos, duração…). O mestre baixa, edita (ou liga a uma planilha do Google) e o app passa a usar a planilha.
// O catálogo fica em data/catalogo-habilidades.json e vale para todas as campanhas deste PC.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { sem, lista, numero, simNao, abrirPlanilha, aba, linhasDaAba, novaPlanilha, instrucoes, abaComDados, listasComValidacao } from './planilhaComum.js';
import { chaveHabilidade } from '../shared/regras.js';

export const ARQ_HABILIDADES = path.join(DATA_DIR, 'catalogo-habilidades.json');
export function catalogoHabilidades() {
  if (!fs.existsSync(ARQ_HABILIDADES)) return null;
  return JSON.parse(fs.readFileSync(ARQ_HABILIDADES, 'utf8'));
}
export function salvarCatalogoHabilidades(cat, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_HABILIDADES, JSON.stringify({ atualizadoEm: Date.now(), arquivo, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), ...cat }));
}
export function voltarHabilidadesPadrao() {
  if (fs.existsSync(ARQ_HABILIDADES)) fs.unlinkSync(ARQ_HABILIDADES);
}

const ORIGENS = {
  caracteristica: 'Característica de classe',
  vantagemClasse: 'Vantagem de classe',
  especializacao: 'Habilidade de especialização',
  geral: 'Vantagem geral',
  defeitoLeve: 'Defeito leve',
  defeitoNormal: 'Defeito normal',
  capacidade: 'Capacidade',
  regra: 'Só regra',
};
const origemDe = t => Object.keys(ORIGENS).find(k => sem(ORIGENS[k]) === sem(t)) || null;
const SISTEMAS = { ambos: 'MSA e MSS', msa: 'só MSA', mss: 'só MSS' };
const valeNo = (t, id) => { const s = sem(t); return !s || /msa e mss|ambos|todos/.test(s) || s.includes(id); };
const RECARGAS = { descanso: 'descanso (curto ou longo)', 'descanso-longo': 'descanso longo' };
const recargaDe = t => { const s = sem(t); return !s ? null : /longo/.test(s) && !/curto/.test(s) ? 'descanso-longo' : 'descanso'; };
const MODOS = ['sempre', 'ligar', 'ativar', 'lembrete'];
const ACOES = ['principal', 'movimento', 'bonus', 'completa', 'reacao', 'livre'];

const COL_CLASSES = [
  ['Código', 'id', 14, 'Não mude o código de uma classe que já existe (as fichas guardam o código)'],
  ['Classe', 'nome', 18, null],
  ['Descrição', 'descricao', 70, null],
  ['Marca do Destino', 'marca', 60, null],
  ['Regras extras (texto)', 'extras', 60, 'Texto longo da classe (ex.: regras gerais da Invenção!). Aceita títulos com ###.'],
  ['Em revisão (notas; separe por ;)', 'revisao', 40, 'Notas do autor sobre o que ainda falta ajustar'],
];
const COL_ESPECIALIZACOES = [
  ['Classe', 'classe', 18, 'Mesmo nome da aba Classes'],
  ['Código', 'id', 22, 'Não mude o código de uma especialização que já existe'],
  ['Especialização', 'nome', 28, null],
  ['Descrição', 'descricao', 70, null],
];
const COL_PROGRESSAO = [
  ['Classe', 'classe', 18, null],
  ['Especialização', 'especializacao', 28, 'Mesmo nome da aba Especializações'],
  ['Nível', 'nivel', 8, null],
  ['Ganhos (separe por ;)', 'ganhos', 60, 'Nomes das habilidades (como na aba Habilidades) ou "Vantagem Extra"'],
];
const COL_HABILIDADES = [
  ['Origem', 'origem', 22, 'Lista na aba Listas: característica/vantagem de classe, habilidade de especialização, vantagem geral, defeito, capacidade'],
  ['Classe', 'classe', 14, 'Só para as de classe'],
  ['Especialização', 'especializacao', 24, 'Só para as habilidades de especialização'],
  ['Nível', 'nivel', 7, 'Nível em que a especialização ganha a habilidade'],
  ['Código', 'id', 22, 'Vantagens, defeitos e capacidades: não mude o código de uma que já existe (as fichas guardam o código). Nova: deixe em branco.'],
  ['Nome', 'nome', 26, 'Obrigatório. A regra do app é ligada pelo nome.'],
  ['Requisito', 'requisito', 18, 'Vantagens gerais e defeitos'],
  ['Custo', 'custo', 7, 'Vantagens gerais (pontos)'],
  ['Atributo', 'atributo', 8, 'Capacidades: FOR, CONS, AGI…'],
  ['Descrição (texto do livro)', 'descricao', 70, 'O app também lê números simples do texto ("+10% em Furtividade", "+1d6 de dano") quando não há regra.'],
  ['Em revisão (sim/não)', 'revisao', 9, null],
  ['Sistema', 'sistema', 11, 'MSA e MSS (padrão), só MSA ou só MSS'],
  ['Modo no app', 'modo', 10, 'sempre (o app aplica sozinho) · ligar (botão liga/desliga) · ativar (botão com custo, usos ou duração) · lembrete (só texto). Em branco: o app decide pelo texto.'],
  ['Ação', 'acao', 11, 'principal, movimento, bonus, completa, reacao ou livre. Em branco no "ativar": ação principal.'],
  ['Efeitos no app', 'efeitos', 30, 'Formato do lápis do mestre. Ex.: +10% em Furtividade; +1 IP geral; vantagem: ataque; imune: Dor'],
  ['Especial (comportamento do app)', 'especial', 18, 'Nome do comportamento programado no app (ex.: humorForcado, caosGenetico). Não invente: só os que já existem.'],
  ['Dano', 'dano', 10, 'Ex.: 2d6, 2d6+MOD INT. Ataque próprio da habilidade (com Tipo, Perícia e Alcance) ou dano do efeito especial.'],
  ['Tipo de dano', 'tipoDano', 12, 'Preencha só para ataque próprio da habilidade (aparece nas armas do Campo de Batalha)'],
  ['Perícia do ataque', 'pericia', 24, 'Ex.: Armas de Fogo › Projéteis'],
  ['Alcance (m)', 'alcance', 9, null],
  ['Usos', 'usos', 7, 'Quantas vezes até recarregar'],
  ['Recarga', 'recarga', 16, 'descanso (curto ou longo) ou descanso longo'],
  ['Duração', 'duracao', 12, 'combate, descanso ou "N turnos"'],
  ['Escolhas ao ativar (;)', 'escolhas', 18, 'O que o jogador escolhe (alvo, aliado, perícia, item…). Mesmos nomes já usados.'],
  ['Texto no app (resumo)', 'texto', 50, 'Resumo do que o app faz, mostrado no botão'],
  ['Regra avançada (não mexa sem saber)', 'avancado', 40, 'O resto da regra, no formato do app (JSON). Deixe como veio.'],
];
// Campos da regra que viram colunas (o resto fica em "Regra avançada").
const CAMPOS_REGRA = ['modo', 'acao', 'efeitos', 'especial', 'escolhas', 'texto', 'duracao'];

const duracaoTexto = d => (!d ? '' : d.turnos ? `${d.turnos} turnos` : String(d));
const duracaoDe = t => { const s = sem(t); if (!s) return null; const n = /(\d+)\s*turno/.exec(s); return n ? { turnos: Number(n[1]) } : /descanso/.test(s) ? 'descanso' : 'combate'; };

// Regra → colunas da linha.
function colunasDaRegra(regra, nomeSub) {
  if (!regra) return {};
  const { arma, usos, dano, ...resto } = regra;
  const r = {};
  for (const k of CAMPOS_REGRA) if (resto[k] != null) { r[k] = k === 'escolhas' ? resto[k].join('; ') : k === 'duracao' ? duracaoTexto(resto[k]) : resto[k]; delete resto[k]; }
  const avancado = { ...resto };
  if (arma) {
    const { dano: aDano, tipoDano, pericia, metros, usos: aUsos, ...aResto } = arma;
    Object.assign(r, { dano: aDano ?? '', tipoDano: tipoDano ?? '', pericia: pericia ? nomeSub(pericia) : '', alcance: metros ?? '', usos: aUsos?.max ?? '', recarga: aUsos ? RECARGAS[aUsos.recarga] || aUsos.recarga : '' });
    avancado.arma = aResto;
    if (usos) avancado.usos = usos;
    if (dano != null) avancado.dano = dano;
  } else {
    if (dano != null) r.dano = dano;
    if (usos) { r.usos = usos.max; r.recarga = RECARGAS[usos.recarga] || usos.recarga; }
  }
  if (Object.keys(avancado).length) r.avancado = JSON.stringify(avancado);
  return r;
}

// Colunas da linha → regra (null se a linha não tem regra).
function regraDasColunas(l, idSub, avisos) {
  const tem = ['modo', 'acao', 'efeitos', 'especial', 'dano', 'tipoDano', 'pericia', 'alcance', 'usos', 'recarga', 'duracao', 'escolhas', 'texto', 'avancado'].some(k => l[k]);
  if (!tem) return null;
  let r = {};
  if (l.avancado) {
    try { r = JSON.parse(l.avancado); } catch { avisos.push(`Linha ${l._linha} (${l.nome}): "Regra avançada" não é um texto válido — ignorada.`); r = {}; }
  }
  if (l.modo) { const m = sem(l.modo); if (MODOS.includes(m)) r.modo = m; else avisos.push(`Linha ${l._linha} (${l.nome}): modo "${l.modo}" desconhecido.`); }
  if (l.acao) { const a = sem(l.acao).replace('bônus', 'bonus').replace('reação', 'reacao'); if (ACOES.includes(a)) r.acao = a; else avisos.push(`Linha ${l._linha} (${l.nome}): ação "${l.acao}" desconhecida.`); }
  for (const k of ['efeitos', 'especial', 'texto']) if (l[k]) r[k] = l[k];
  if (l.escolhas) r.escolhas = lista(l.escolhas);
  if (l.duracao) r.duracao = duracaoDe(l.duracao);
  const usos = l.usos ? { max: numero(l.usos) || 1, recarga: recargaDe(l.recarga) || 'descanso-longo' } : null;
  const ataque = l.tipoDano || l.pericia || l.alcance || r.arma;
  if (ataque) {
    const arma = { ...(r.arma || {}) };
    if (l.dano) arma.dano = l.dano;
    if (l.tipoDano) arma.tipoDano = l.tipoDano;
    if (l.pericia) { const id = idSub(l.pericia); if (id) arma.pericia = id; else avisos.push(`Linha ${l._linha} (${l.nome}): perícia "${l.pericia}" não encontrada.`); }
    if (l.alcance) arma.metros = numero(l.alcance);
    if (usos) arma.usos = usos;
    // Ordem dos campos como no arquivo do app.
    const { nome, ...outros } = arma;
    r.arma = { ...(nome ? { nome } : {}), ...outros };
  } else {
    if (l.dano) r.dano = l.dano;
    if (usos) r.usos = usos;
  }
  if (!r.modo) r.modo = r.especial || r.usos || r.acao ? 'ativar' : 'sempre';
  return r;
}

// ---------- exportar ----------
function linhasDoSistema(sis) {
  const nomeSub = id => { const p = sis.pericias.find(x => id.startsWith(`${x.id}.`)); return p ? `${p.nome} › ${p.subpericias.find(s => s.id === id)?.nome || id}` : id; };
  const classes = [], esps = [], prog = [], habs = [];
  for (const c of sis.classes) {
    classes.push({ id: c.id, nome: c.nome, descricao: c.descricao, marca: c.marca, extras: c.extras || '', revisao: (c.revisao || []).join('; ') });
    for (const x of c.caracteristicas) habs.push({ origem: ORIGENS.caracteristica, classe: c.nome, nome: x.nome, descricao: x.descricao });
    for (const x of c.vantagens || []) habs.push({ origem: ORIGENS.vantagemClasse, classe: c.nome, id: x.id, nome: x.nome, descricao: x.descricao });
    for (const e of c.especializacoes) {
      esps.push({ classe: c.nome, id: e.id, nome: e.nome, descricao: e.descricao });
      for (const x of e.habilidades) habs.push({ origem: ORIGENS.especializacao, classe: c.nome, especializacao: e.nome, nivel: x.nivel, nome: x.nome, descricao: x.descricao });
      for (const l of e.progressao) prog.push({ classe: c.nome, especializacao: e.nome, nivel: l.nivel, ganhos: l.ganhos.join('; ') });
    }
  }
  const vant = (x, origem) => ({ origem, id: x.id, nome: x.nome, requisito: x.requisito || '', custo: x.custo ?? '', descricao: x.descricao, revisao: x.revisao ? 'sim' : 'não' });
  for (const x of sis.vantagens) habs.push(vant(x, ORIGENS.geral));
  for (const x of sis.defeitos) habs.push(vant(x, x.tipo === 'normal' ? ORIGENS.defeitoNormal : ORIGENS.defeitoLeve));
  for (const x of sis.capacidades) habs.push({ origem: ORIGENS.capacidade, id: x.id, atributo: x.atributo, nome: x.nome, descricao: x.descricao, revisao: x.revisao ? 'sim' : 'não' });
  return { classes, esps, prog, habs, nomeSub };
}

export async function planilhaHabilidades(msa, mss) {
  const A = linhasDoSistema(msa), B = linhasDoSistema(mss);
  // Linhas iguais nos dois sistemas viram uma só ("MSA e MSS"); as diferentes, uma para cada.
  const igual = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const habs = [];
  const usadasB = new Set();
  for (const a of A.habs) {
    const i = B.habs.findIndex((b, k) => !usadasB.has(k) && igual(a, b));
    if (i >= 0) { usadasB.add(i); habs.push({ ...a, sistema: SISTEMAS.ambos }); continue; }
    habs.push({ ...a, sistema: SISTEMAS.msa });
    // A versão do MSS da mesma linha (mesma origem e nome) logo abaixo.
    const j = B.habs.findIndex((b, k) => !usadasB.has(k) && b.origem === a.origem && b.nome === a.nome && b.classe === a.classe);
    if (j >= 0) { usadasB.add(j); habs.push({ ...B.habs[j], sistema: SISTEMAS.mss }); }
  }
  B.habs.forEach((b, k) => { if (!usadasB.has(k)) habs.push({ ...b, sistema: SISTEMAS.mss }); });
  // Regras do app: na primeira linha com o mesmo nome; as que não têm linha entram como "Só regra".
  const regras = { ...mss.habilidadesRegras };
  const usadas = new Set();
  for (const l of habs) {
    const k = chaveHabilidade(l.nome);
    if (!regras[k] || usadas.has(k)) continue;
    usadas.add(k);
    Object.assign(l, colunasDaRegra(regras[k], B.nomeSub));
  }
  for (const [k, r] of Object.entries(regras)) if (!usadas.has(k)) habs.push({ origem: ORIGENS.regra, nome: k, sistema: SISTEMAS.ambos, ...colunasDaRegra(r, B.nomeSub) });

  const wb = novaPlanilha();
  instrucoes(wb, [
    'Habilidades — planilha do app (classes, especializações, habilidades, vantagens, defeitos e capacidades)',
    '',
    '• Aba Habilidades: uma linha por habilidade, vantagem, defeito ou capacidade. "Origem" diz de onde vem (lista na aba Listas).',
    '• O texto do livro vai em "Descrição". As colunas de regra (Modo, Ação, Dano, Alcance, Usos, Recarga, Duração…) dizem o que o app faz.',
    '• Para mudar o dano de uma habilidade: mude a coluna "Dano" (ex.: 2d6 → 4d6). Mude também o texto, para o livro ficar igual.',
    '• Habilidade sem regra (colunas de regra em branco): o app lê os números simples do texto (+10% em Furtividade, +1d6 de dano) ou deixa como lembrete.',
    '• A regra é ligada pelo NOME. Se o mesmo nome aparece em mais de uma linha, a regra fica só na primeira.',
    '• Ataque próprio da habilidade (aparece nas armas do Campo de Batalha): preencha Dano, Tipo de dano, Perícia do ataque e Alcance (m).',
    '• "Especial" é um comportamento programado no app (ex.: humorForcado, caosGenetico). Só use nomes que já existem; para um novo, peça ao programador.',
    '• "Regra avançada" guarda o resto da regra no formato do app. Deixe como veio, a não ser que saiba o que está fazendo.',
    '• Códigos: as fichas guardam o código das classes, especializações, vantagens, defeitos e capacidades. Não mude o código de algo que já existe.',
    '• Aba Classes, Especializações e Progressão: o texto das classes e o que cada especialização ganha em cada nível ("Ganhos", separados por ;).',
    '• Sistema: "MSA e MSS" vale nos dois; "só MSA" ou "só MSS" quando o texto é diferente em cada um.',
    '• A planilha vale para todas as campanhas deste PC. Ligada ao Google Planilhas, o app puxa sozinho ao abrir e a cada 30 minutos.',
  ]);
  const wsH = abaComDados(wb, 'Habilidades', COL_HABILIDADES, habs);
  abaComDados(wb, 'Classes', COL_CLASSES, B.classes);
  abaComDados(wb, 'Especializações', COL_ESPECIALIZACOES, B.esps);
  abaComDados(wb, 'Progressão', COL_PROGRESSAO, B.prog);
  listasComValidacao(wb, [
    ['Origem', Object.values(ORIGENS), [[wsH, COL_HABILIDADES, 'origem']]],
    ['Sistema', Object.values(SISTEMAS), [[wsH, COL_HABILIDADES, 'sistema']]],
    ['Modo', MODOS, [[wsH, COL_HABILIDADES, 'modo']]],
    ['Ação', ACOES, [[wsH, COL_HABILIDADES, 'acao']]],
    ['Recarga', Object.values(RECARGAS), [[wsH, COL_HABILIDADES, 'recarga']]],
    ['Tipo de dano', mss.tiposDano || [], [[wsH, COL_HABILIDADES, 'tipoDano']]],
    ['Perícia do ataque', mss.pericias.flatMap(p => p.subpericias.map(s => `${p.nome} › ${s.nome}`)), [[wsH, COL_HABILIDADES, 'pericia']]],
    ['Sim/não', ['sim', 'não'], [[wsH, COL_HABILIDADES, 'revisao']]],
    ['Especial (já programados)', [...new Set(Object.values(regras).map(r => r.especial).filter(Boolean))].sort(), []],
  ]);
  return wb.xlsx.writeBuffer();
}

// ---------- ler ----------
const slug = t => sem(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function lerPlanilhaHabilidades(buffer, sis) {
  const wb = await abrirPlanilha(buffer);
  const avisos = [];
  const wsH = aba(wb, 'Habilidades');
  if (!wsH) throw new Error('Aba "Habilidades" não encontrada. Use a planilha baixada pelo app.');
  const subs = sis.pericias.flatMap(p => p.subpericias.map(s => ({ id: s.id, nomes: [`${p.nome} › ${s.nome}`, `${p.nome} ${s.nome}`, `${p.nome} [${s.nome}]`, s.id].map(sem) })));
  const idSub = t => subs.find(s => s.nomes.includes(sem(t).replace(/\s*[›>]\s*/g, ' › ')) || s.nomes.includes(sem(t)))?.id || null;

  const classesL = linhasDaAba(aba(wb, 'Classes'), COL_CLASSES).filter(l => l.nome);
  const espsL = linhasDaAba(aba(wb, 'Especializações'), COL_ESPECIALIZACOES).filter(l => l.nome);
  const progL = linhasDaAba(aba(wb, 'Progressão'), COL_PROGRESSAO);
  const habsL = linhasDaAba(wsH, COL_HABILIDADES);
  if (!classesL.length) avisos.push('Aba "Classes" vazia ou sem a coluna "Classe": as classes ficam as do livro do app.');

  // Regras (uma por nome).
  const regras = {};
  for (const l of habsL) {
    if (!l.nome) continue;
    const r = regraDasColunas(l, idSub, avisos);
    if (!r) continue;
    const k = chaveHabilidade(l.nome);
    if (regras[k]) { avisos.push(`Linha ${l._linha}: "${l.nome}" já tem regra numa linha anterior — esta foi ignorada.`); continue; }
    regras[k] = r;
  }

  const montar = idSis => {
    const linhas = habsL.filter(l => l.nome && valeNo(l.sistema, idSis));
    const classes = classesL.map(c => ({
      nome: c.nome, descricao: c.descricao, marca: c.marca, caracteristicas: [], especializacoes: [], vantagens: [],
      revisao: lista(c.revisao), extras: c.extras || '', id: c.id || slug(c.nome),
    }));
    const classe = nome => classes.find(c => sem(c.nome) === sem(nome) || c.id === sem(nome));
    for (const e of espsL) {
      const c = classe(e.classe);
      if (!c) { avisos.push(`Especializações, linha ${e._linha}: classe "${e.classe}" não existe na aba Classes.`); continue; }
      c.especializacoes.push({ nome: e.nome, descricao: e.descricao, habilidades: [], id: e.id || slug(e.nome), progressao: [] });
    }
    const esp = (c, nome) => c?.especializacoes.find(e => sem(e.nome) === sem(nome) || e.id === sem(nome));
    for (const p of progL) {
      const e = esp(classe(p.classe), p.especializacao);
      if (!e) { if (idSis === 'mss') avisos.push(`Progressão, linha ${p._linha}: especialização "${p.especializacao}" (${p.classe}) não encontrada.`); continue; }
      e.progressao.push({ nivel: numero(p.nivel) || 1, ganhos: lista(p.ganhos) });
    }
    const vantagens = { gerais: [], defeitosLeves: [], defeitosNormais: [], capacidades: [] };
    for (const l of linhas) {
      const o = origemDe(l.origem);
      const rev = simNao(l.revisao);
      const avisar = msg => { if (idSis === 'mss' || sem(l.sistema).includes('msa')) avisos.push(`Linha ${l._linha} (${l.nome}): ${msg}`); };
      if (!o) { avisar(`origem "${l.origem}" desconhecida — ignorada.`); continue; }
      if (o === 'regra') continue;
      if (['caracteristica', 'vantagemClasse', 'especializacao'].includes(o)) {
        const c = classe(l.classe);
        if (!c) { avisar(`classe "${l.classe}" não existe na aba Classes.`); continue; }
        if (o === 'caracteristica') c.caracteristicas.push({ nome: l.nome, descricao: l.descricao });
        else if (o === 'vantagemClasse') c.vantagens.push({ nome: l.nome, descricao: l.descricao, id: l.id || slug(l.nome) });
        else {
          const e = esp(c, l.especializacao);
          if (!e) { avisar(`especialização "${l.especializacao}" não existe na aba Especializações.`); continue; }
          e.habilidades.push({ nivel: numero(l.nivel) || 1, nome: l.nome, descricao: l.descricao });
        }
        continue;
      }
      if (o === 'capacidade') { vantagens.capacidades.push({ id: l.id || slug(l.nome), atributo: (l.atributo || '').toUpperCase(), nome: l.nome, descricao: l.descricao, revisao: rev }); continue; }
      const v = { nome: l.nome, requisito: l.requisito || '', descricao: l.descricao, revisao: rev, id: l.id || slug(l.nome) };
      if (o === 'geral') vantagens.gerais.push({ ...v, custo: numero(l.custo) ?? 1 });
      else if (o === 'defeitoLeve') vantagens.defeitosLeves.push({ ...v, tipo: 'leve' });
      else vantagens.defeitosNormais.push({ ...v, tipo: 'normal' });
    }
    return { classes: classesL.length ? classes : null, vantagens };
  };
  const total = habsL.filter(l => l.nome).length;
  return { catalogo: { sistemas: { msa: montar('msa'), mss: montar('mss') }, regras }, total, avisos };
}
