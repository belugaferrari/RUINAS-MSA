// Livro dos Monstros por planilha (.xlsx): abas Monstros, Ataques e Habilidades (uma linha por ataque/habilidade).
// O mestre baixa a planilha atual, edita e envia de volta; o catálogo fica em data/catalogo-monstros.json e vale
// para todas as campanhas deste PC (como o catálogo de itens). Sem catálogo enviado, valem os exemplos do base.json.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { DATA_DIR } from './db.js';
import { TIPOS_DESLOCAMENTO, deslocamentosDoTexto, estagiosDoTexto } from '../shared/monstros.js';

export const ARQ_MONSTROS = path.join(DATA_DIR, 'catalogo-monstros.json');

const sem = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const SIGLAS = ['FOR', 'CONS', 'AGI', 'DES', 'INT', 'PER', 'CAR', 'WILL'];
// Tamanhos (a planilha do autor usa também Miúdo e Imenso; ordem provisória).
export const TAMANHOS = ['Diminuto', 'Miúdo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Imenso', 'Colossal'];
const MODOS = ['sempre', 'ligar', 'ativar', 'lembrete'];
// Afinidade elementar (até duas por criatura): a 1ª é a principal — o monstro recebe metade do dano dos tipos ligados a ela
// (base.json "afinidadesElementais"). Não existe elemento oposto. Afinidade nova da planilha é aceita (sem relação ainda).
const elementosDe = sis => (sis.afinidadesElementais || []).map(a => a.nome);

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
  ['Afinidade elementar 1 (principal)', 'afinidade1', 16, 'Afinidade principal: o monstro recebe metade do dano dos tipos ligados a ela. Lista na aba Listas (pode escrever uma nova).'],
  ['Afinidade elementar 2', 'afinidade2', 14, 'Opcional (até duas afinidades)'],
  ['Resistências', 'resistencias', 20, 'Tipos de dano que sofrem metade (separe por ;)'],
  ['Imunidades', 'imunidades', 20, 'Tipos de dano (dano zero) ou efeitos (Dor, Sangramento…)'],
  ['Vulnerabilidades', 'vulnerabilidades', 20, 'Tipos de dano que sofrem o dobro'],
  ['Andar (m)', 'deslocamento', 9, 'Deslocamento em terreno padrão. Sem os outros tipos preenchidos, o monstro só anda.'],
  ...TIPOS_DESLOCAMENTO.filter(t => t.id !== 'andar').map(t => [`${t.nome} (m)`, `desl:${t.id}`, 9, `Deslocamento ${t.nome.toLowerCase()} em metros (em branco: não tem)`]),
  ['Deslocamentos (observações)', 'outrosDeslocamentos', 26, 'O que não cabe nas colunas: "Natação em lava", "incapaz de andar em terra", "Disparada 30 m"…'],
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
  ['Estágios', 'estagios', 10, 'Em branco: em todos. Ex.: 2 (só no estágio 2); 2; 3 ou 2-4'],
];
const COL_HABILIDADES = [
  ['Monstro', 'monstro', 24, null],
  ['Habilidade', 'nome', 24, null],
  ['Modo', 'modo', 12, 'sempre (aplica sozinho) / ligar / ativar / lembrete'],
  ['Única (sim/não)', 'unica', 10, 'Habilidade única: não pode ser copiada (Mutante, Transmorfo…) nem revelada por testes como Zoologia'],
  ['Efeitos no app', 'efeitos', 36, 'Formato do lápis do mestre. Ex.: +1 IP geral; vantagem: ataque; imune: Dor; Furtividade +10%'],
  ['Descrição', 'descricao', 60, null],
  ['Estágios', 'estagios', 10, 'Em branco: em todos. Ex.: 2 (só no estágio 2); 2; 3 ou 2-4'],
];
// Estágios: o mesmo monstro mudando/crescendo. Uma linha por estágio; só preencha o que muda (em branco = igual ao da
// aba Monstros). Ataques e habilidades de um estágio só: coluna "Estágios" nas abas Ataques e Habilidades.
const COL_ESTAGIOS = [
  ['Monstro', 'monstro', 24, 'Mesmo nome da aba Monstros'],
  ['Estágio (nº)', 'numero', 9, '1, 2, 3…'],
  ['Nome do estágio', 'nome', 18, 'Ex.: Filhote, Adulto, Ancião (opcional)'],
  ['O que muda', 'descricao', 50, 'Resumo para o mestre'],
  ['Tamanho', 'tamanho', 12, null],
  ['Nível', 'nivel', 8, null],
  ['Dificuldade (encontros)', 'dificuldade', 12, null],
  ['XP', 'xp', 8, null],
  ['PV', 'pv', 8, null],
  ['IP geral', 'ipGeral', 9, null],
  ...SIGLAS.map(s => [s, `atr:${s}`, 7, null]),
  ...TIPOS_DESLOCAMENTO.map(t => [`${t.nome} (m)`, `desl:${t.id}`, 9, null]),
  ['Resistências (a mais)', 'resistencias', 18, 'Somam às da aba Monstros'],
  ['Imunidades (a mais)', 'imunidades', 18, null],
  ['Vulnerabilidades (a mais)', 'vulnerabilidades', 18, null],
  ['Sentidos', 'sentidos', 20, null],
  ['Comportamento', 'comportamento', 40, null],
  ['Imagem (link)', 'imagem', 30, 'Opcional: imagem própria do estágio'],
];
// Títulos antigos que ainda valem na leitura.
const APELIDOS = { 'deslocamento (m)': 'deslocamento', 'outros deslocamentos': 'outrosDeslocamentos' };

const texto = v => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v.text ?? v.result ?? (v.richText ? v.richText.map(r => r.text).join('') : v.hyperlink ?? '')).trim();
  return String(v).trim();
};
const numero = v => { const n = parseFloat(texto(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const lista = v => texto(v).split(';').map(s => s.trim()).filter(Boolean);
// "2", "2; 3", "2-4", "Estágios 2 e 3" → [2, 3, 4]; em branco → null (todos).
const numerosEstagios = v => { const t = texto(v); return t ? estagiosDoTexto(/est/i.test(t) ? t : `Estágios ${t.replace(/;/g, ',')}`) : null; };

// Catálogo em uso: o enviado pelo mestre, ou null (o sistema usa os exemplos do base.json).
export function catalogoMonstros() {
  if (!fs.existsSync(ARQ_MONSTROS)) return null;
  return JSON.parse(fs.readFileSync(ARQ_MONSTROS, 'utf8'));
}
export function salvarCatalogoMonstros(monstros, arquivo, extra = {}) {
  fs.writeFileSync(ARQ_MONSTROS, JSON.stringify({ atualizadoEm: Date.now(), arquivo, ...(extra.googleSheets ? { googleSheets: extra.googleSheets } : {}), monstros }));
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
    const mapa = { ...APELIDOS, ...Object.fromEntries(cols.map(([t, k]) => [sem(t), k])) };
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
  // Subperícias com nome único no sistema (para corrigir "Perícia errada › Subperícia").
  const contagem = new Map();
  for (const p of sis.pericias) for (const s of p.subpericias) contagem.set(sem(s.nome), [...(contagem.get(sem(s.nome)) || []), s.id]);
  const subUnica = new Map([...contagem].filter(([, ids]) => ids.length === 1).map(([k, ids]) => [k, ids[0]]));
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
      // Afinidades da lista ficam com a grafia dela; uma nova é aceita como veio (avisa que ainda não tem relação de dano).
      const el = elementosDe(sis).find(x => sem(x) === sem(t) || sem(x).startsWith(`${sem(t)} `));
      if (!el) avisos.push(`${nome}: afinidade "${t}" ainda não está na lista (aceita, sem relação com tipo de dano).`);
      const valor = el || t;
      if (!afinidades.includes(valor)) afinidades.push(valor);
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
      let id = sub.get(chaveSub(n));
      // "Esportes › Esquiva": a perícia está errada, mas o nome da subperícia é único → usa a certa (e avisa).
      if (!id && chaveSub(n).includes(' › ')) { id = subUnica.get(chaveSub(n).split(' › ').pop()); if (id) avisos.push(`${nome}: "${t}" corrigido para ${id}.`); }
      if (id && v != null) subs[id] = v; else avisos.push(`${nome}: subperícia "${t}" não reconhecida.`);
    }
    if (Object.keys(pers).length) m.pericias = pers;
    if (Object.keys(subs).length) m.subpericias = subs;
    const ipTipos = {};
    for (const t of lista(l.ipTipos)) { const [n, v] = pontos(t); if (v != null) ipTipos[danoDe(n)] = v; }
    if (Object.keys(ipTipos).length) m.ipTipos = ipTipos;
    for (const k of ['resistencias', 'imunidades', 'vulnerabilidades', 'saque']) { const xs = lista(l[k]); if (xs.length) m[k] = k === 'saque' ? xs : xs.map(danoDe); }
    // Deslocamentos por tipo: as colunas; o que estiver só no texto (planilha antiga: "Natação 15 m; Voo (Estágio 2) 12 m")
    // também entra — o de um estágio vai para o estágio.
    const desl = {};
    if (m.deslocamento != null) desl.andar = m.deslocamento;
    for (const t of TIPOS_DESLOCAMENTO) { const n = numero(l[`desl:${t.id}`]); if (n != null) desl[t.id] = n; }
    if (m.outrosDeslocamentos) {
      const doTexto = deslocamentosDoTexto(m.outrosDeslocamentos);
      for (const [k, v] of Object.entries(doTexto.base)) if (desl[k] == null) desl[k] = v;
      if (Object.keys(doTexto.porEstagio).length) m.estagiosDoTexto = doTexto.porEstagio;
      // No texto fica só o que não virou número de coluna ("Natação em lava 12 m", "incapaz de andar em terra"…).
      if (doTexto.resto.length) m.outrosDeslocamentos = doTexto.resto.join('; '); else delete m.outrosDeslocamentos;
    }
    if (Object.keys(desl).length) m.deslocamentos = desl;
    m.ataques = []; m.habilidades = []; m.estagios = [];
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
    const est = numerosEstagios(l.estagios); if (est) a.estagios = est;
    m.ataques.push(a);
  }
  for (const l of linhas(aba('Habilidades'), COL_HABILIDADES)) {
    const m = porNome.get(sem(l.monstro));
    const nome = texto(l.nome);
    if (!nome) continue;
    if (!m) { avisos.push(`Habilidade "${nome}": monstro "${texto(l.monstro)}" não está na aba Monstros.`); continue; }
    const modo = MODOS.find(x => x === sem(l.modo)) || 'lembrete';
    const est = numerosEstagios(l.estagios);
    m.habilidades.push({ nome, modo, efeitos: texto(l.efeitos), descricao: texto(l.descricao), ...(/^(s|sim|x|1|única|unica)$/i.test(texto(l.unica)) ? { unica: true } : {}), ...(est ? { estagios: est } : {}) });
  }
  for (const l of linhas(aba('Estágios'), COL_ESTAGIOS)) {
    const numeroEst = numero(l.numero);
    if (numeroEst == null) continue;
    const m = porNome.get(sem(l.monstro));
    if (!m) { avisos.push(`Estágio ${numeroEst}: monstro "${texto(l.monstro)}" não está na aba Monstros.`); continue; }
    const e = { numero: numeroEst };
    for (const k of ['nome', 'descricao', 'sentidos', 'comportamento', 'imagem']) { const t = texto(l[k]); if (t) e[k] = t; }
    const tam = TAMANHOS.find(t => sem(t) === sem(l.tamanho)); if (tam) e.tamanho = tam;
    for (const k of ['nivel', 'dificuldade', 'xp', 'pv', 'ipGeral']) { const n = numero(l[k]); if (n != null) e[k] = n; }
    const atr = {}; for (const sg of SIGLAS) { const n = numero(l[`atr:${sg}`]); if (n != null) atr[sg] = n; }
    if (Object.keys(atr).length) e.atributos = atr;
    const desl = {}; for (const t of TIPOS_DESLOCAMENTO) { const n = numero(l[`desl:${t.id}`]); if (n != null) desl[t.id] = n; }
    if (Object.keys(desl).length) e.deslocamentos = desl;
    for (const k of ['resistencias', 'imunidades', 'vulnerabilidades']) { const xs = lista(l[k]); if (xs.length) e[k] = xs.map(danoDe); }
    m.estagios = [...m.estagios.filter(x => x.numero !== numeroEst), e];
  }
  // Deslocamento de estágio escrito só no texto (planilha antiga): vira o estágio, se a aba Estágios não preencheu.
  for (const m of monstros) {
    for (const [n, desl] of Object.entries(m.estagiosDoTexto || {})) {
      const e = m.estagios.find(x => x.numero === Number(n)) || (m.estagios.push({ numero: Number(n) }), m.estagios.at(-1));
      e.deslocamentos = { ...desl, ...(e.deslocamentos || {}) };
    }
    delete m.estagiosDoTexto;
    m.estagios.sort((a, b) => a.numero - b.numero);
    if (!m.estagios.length) delete m.estagios;
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
    '• Afinidade elementar: até duas por criatura (lista na aba Listas). A 1ª é a principal: o monstro recebe metade do dano dos tipos ligados a ela. Não existe elemento oposto.',
    '• Ataques elementais: um ataque só causa dano elemental se o "Tipo de dano" dele for o elemento (ex.: Sopro gelado = Frio; Mordida = Perfuração).',
    '• Aba Habilidades: poderes especiais. Marque "Única" nas habilidades únicas (não podem ser copiadas nem reveladas por testes como Zoologia).',
    '• Aba Habilidades (efeitos): "Efeitos no app" usa o formato do lápis do mestre (ex.: +1 IP geral; vantagem: ataque; imune: Dor; Furtividade +10%).',
    '• Deslocamentos: "Andar (m)" é o terreno padrão; preencha Nadar, Voar, Flutuar, Escalar, Escavar e Saltar só se o monstro tiver. Em branco = não tem. Detalhes ("em lava", "incapaz de andar em terra") vão em "Deslocamentos (observações)".',
    '• Aba Estágios: monstros que mudam ou crescem. Uma linha por estágio, preenchendo só o que muda (PV, tamanho, atributos, deslocamentos…); o resto fica igual ao da aba Monstros.',
    '  Ataques e habilidades de alguns estágios: coluna "Estágios" nas abas Ataques e Habilidades (ex.: 2 ou 2; 3 ou 2-4). Em branco = todos os estágios.',
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
  const wsE = wb.addWorksheet('Estágios'); cabec(wsE, COL_ESTAGIOS);
  const textoEst = xs => (xs?.length ? xs.join('; ') : '');
  const juntar = (obj, nome) => Object.entries(obj || {}).map(([k, v]) => `${nome(k)} ${v}`).join('; ');
  for (const m of monstros) {
    const v = {
      ...m, tipoCriatura: tipoNome(m.tipoCriatura), pericias: juntar(m.pericias, k => nomesPer[k] || k), subpericias: juntar(m.subpericias, k => nomesSub[k] || k),
      ipTipos: juntar(m.ipTipos, k => k), ...Object.fromEntries(['resistencias', 'imunidades', 'vulnerabilidades', 'saque'].map(k => [k, (m[k] || []).join('; ')])),
      ...Object.fromEntries(SIGLAS.map(s => [`atr:${s}`, m.atributos?.[s] ?? ''])),
      descricao: m.descricao || '', ipGeral: m.ipGeral ?? m.defesa ?? '', afinidade1: m.afinidades?.[0] || '', afinidade2: m.afinidades?.[1] || '',
      ...Object.fromEntries(TIPOS_DESLOCAMENTO.map(t => [`desl:${t.id}`, m.deslocamentos?.[t.id] ?? ''])),
      deslocamento: m.deslocamentos?.andar ?? m.deslocamento ?? '',
    };
    wsM.addRow(COL_MONSTROS.map(([, k]) => v[k] ?? ''));
    const ataques = m.ataques?.length ? m.ataques : m.ataque ? [{ nome: m.ataque.replace(/\s*\d*d\d.*$/i, '') || 'Ataque', dano: /\d*d\d+(?:[+-]\d+)?/i.exec(m.ataque)?.[0] || '1d4' }] : [];
    for (const a of ataques) wsA.addRow(COL_ATAQUES.map(([, k]) => (k === 'monstro' ? m.nome : k === 'pericia' ? nomesSub[a.pericia] || '' : k === 'alcance' ? (a.alcance === 'distancia' ? 'distância' : 'corpo') : k === 'estagios' ? textoEst(a.estagios) : a[k] ?? '')));
    for (const hb of m.habilidades || []) wsH.addRow(COL_HABILIDADES.map(([, k]) => (k === 'monstro' ? m.nome : k === 'unica' ? (hb.unica ? 'sim' : 'não') : k === 'estagios' ? textoEst(hb.estagios) : hb[k] ?? '')));
    for (const e of m.estagios || []) {
      const v = { ...e, monstro: m.nome, ...Object.fromEntries(SIGLAS.map(sg => [`atr:${sg}`, e.atributos?.[sg] ?? ''])),
        ...Object.fromEntries(TIPOS_DESLOCAMENTO.map(t => [`desl:${t.id}`, e.deslocamentos?.[t.id] ?? ''])),
        ...Object.fromEntries(['resistencias', 'imunidades', 'vulnerabilidades'].map(k => [k, (e[k] || []).join('; ')])) };
      wsE.addRow(COL_ESTAGIOS.map(([, k]) => v[k] ?? ''));
    }
  }
  const lst = wb.addWorksheet('Listas');
  const listas = [
    ['Tipo de criatura', (sis.tiposCriatura || []).map(t => t.nome)], ['Tamanho', TAMANHOS], ['Tipo de dano', sis.tiposDano || []],
    ['Alcance', ['corpo', 'distância']], ['Modo', MODOS], ['Subperícias (ataque)', Object.values(nomesSub)], ['Perícias', Object.values(nomesPer)],
    ['Afinidade elementar', elementosDe(sis)], ['Sim/não', ['sim', 'não']],
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
  validar(wsE, 'tamanho', COL_ESTAGIOS, 1);
  return wb.xlsx.writeBuffer();
}
