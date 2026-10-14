// Regras compartilhadas entre servidor e navegador.
// Base: Livro do Jogador MSS (rev. 14/10/2026). O MSA pode mudar regras — as fórmulas ficam todas aqui.

export const LIMITE_SALA = 20;

export function rolarDado(expr, rng = Math.random) {
  if (/^\s*\d+\s*$/.test(expr || '')) return { expr: String(expr).trim(), dados: [], mod: parseInt(expr, 10), total: parseInt(expr, 10) };
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(expr || '');
  if (!m) throw new Error(`Dado inválido: ${expr}`);
  const qtd = Math.min(parseInt(m[1] || '1', 10), 100);
  const faces = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
  const dados = Array.from({ length: qtd }, () => 1 + Math.floor(rng() * faces));
  return { expr, dados, mod, total: dados.reduce((a, b) => a + b, 0) + mod };
}

// Teste D-MIL: AÇÃO% + 1d100 ≥ ND, com 1d10 de suporte (DS).
export function testeDMil(acao, nd, sistema, { metade = false, rng = Math.random } = {}) {
  const t = sistema.teste;
  const dp = 1 + Math.floor(rng() * 100);
  const ds = 1 + Math.floor(rng() * 10);
  const valor = metade ? Math.floor(acao / 2) : acao;
  const total = valor + dp;
  const critico = dp >= t.criticoAcerto ? 'acerto' : dp <= t.criticoErro ? 'erro' : null;
  const sucesso = nd == null ? null : critico === 'acerto' ? true : critico === 'erro' ? false : total >= nd;
  return { dp, ds, acao: valor, total, nd, sucesso, critico };
}

const regras = s => s.regras || {};

// Rolagem alternativa de atributos da criação (rerola o conjunto até a soma ficar dentro do limite).
export function rolarAtributosCriacao(sistema, rng = Math.random) {
  const cfg = regras(sistema).rolagemAtributos;
  let tentativas = 0;
  let valores;
  let soma;
  do {
    valores = cfg.dados.map(expr => ({ expr, ...rolarDado(expr, rng) }));
    soma = valores.reduce((s, v) => s + v.total, 0);
    tentativas++;
  } while ((soma < cfg.somaMin || soma > cfg.somaMax) && tentativas < 50);
  return { valores: valores.map(v => ({ expr: v.expr, dados: v.dados, total: v.total })), soma, rerolagens: tentativas - 1 };
}

export const ndPorNivel = (nivel, sistema) =>
  (sistema.teste?.ndPorNivel || []).map(x => ({ nome: x.nome, nd: x.base + x.porNivel * (nivel || 1) }));

export function novaFicha(sistema, campanha) {
  const r = regras(sistema);
  const nivel = typeof campanha?.nivel === 'number' ? campanha.nivel : 1;
  const ficha = {
    nivel,
    nome: '', idade: '', peso: '', altura: '', instinto: '', caracteristicas: '',
    origem: '', motivacao: '', familia: '',
    profissao: '', classe: '', especializacao: '', escolhasClasse: {},
    vantagens: [], defeitos: [],
    atributos: Object.fromEntries(sistema.atributos.map(a => [a.sigla, r.atributoInicial ?? 10])),
    pericias: {}, subpericias: {},
    itens: [],
    dinheiro: r.creditosIniciais ?? 0,
    marcadores: [],
    background: '', anotacoes: '', foto: null,
    xp: 0, backups: [],
  };
  const d = derivados(ficha, sistema);
  ficha.pv = { max: d.pvMax, atual: d.pvMax };
  ficha.sanidade = { max: d.sanidadeMax, atual: d.sanidadeMax };
  ficha.humanidade = { max: d.humanidadeMax, atual: d.humanidadeMax };
  return ficha;
}

// Pontos que o mestre liberou para a criação. Perícias "null" = fórmula do livro.
export function pontosCampanha(campanha, sistema) {
  const r = regras(sistema);
  if (campanha?.padraoMSA !== false) return { atributos: r.pontosAtributos, vantagens: r.pontosVantagem, pericias: null };
  const p = campanha.pontos || {};
  return { atributos: p.atributos || r.pontosAtributos, vantagens: p.vantagens ?? r.pontosVantagem, pericias: p.pericias || null };
}

export const atributoMax = (nivel, sistema) => {
  const r = regras(sistema);
  return Math.min(r.atributoMaxAbsoluto ?? 22, (r.atributoMaxNivel1 ?? 14) + (nivel || 1) - 1);
};
export const limitePericia = (nivel, sistema) => {
  const p = regras(sistema).pericias || {};
  return (p.limiteBase ?? 5) + (p.limitePorNivel ?? 5) * (nivel || 1);
};

export function pontosPericiaTotal(ficha, sistema, campanha) {
  const fixo = campanha ? pontosCampanha(campanha, sistema).pericias : null;
  if (fixo) return fixo;
  const p = regras(sistema).pericias || {};
  return (p.base ?? 70) + (p.porInt ?? 5) * (ficha.atributos?.INT ?? 0) + (p.porNivel ?? 20) * (ficha.nivel || 1);
}

export const custoPericiaBase = (pericia, sistema) => {
  const p = regras(sistema).pericias || {};
  return pericia.combate ? (p.custoBaseCombate ?? 6) : (p.custoBase ?? 3);
};

export function pontosGastos(ficha, sistema) {
  const atributos = sistema.atributos.reduce((s, a) => s + (ficha.atributos?.[a.sigla] ?? 0), 0);
  const vantagens = (ficha.vantagens || []).reduce((s, id) => s + (sistema.vantagens.find(v => v.id === id)?.custo ?? 1), 0);
  let pericias = 0;
  for (const p of sistema.pericias) {
    pericias += (ficha.pericias?.[p.id] ?? 0) * custoPericiaBase(p, sistema);
    for (const sub of p.subpericias) pericias += ficha.subpericias?.[sub.id] ?? 0;
  }
  return { atributos, vantagens, pericias };
}

// Defeitos normais dão +1 ponto de vantagem (no máximo 1 no total).
export function pontosVantagemExtra(ficha, sistema) {
  const r = regras(sistema);
  const normais = (ficha.defeitos || []).filter(id => sistema.defeitos?.find(d => d.id === id)?.tipo === 'normal').length;
  return Math.min(r.maxPontosPorDefeitos ?? 1, normais * (r.defeitoNormalDaPonto ?? 1));
}

export function slotsOcupados(ficha) {
  const uso = {};
  for (const it of ficha.itens || []) {
    if (it.equipado && it.slot) uso[it.slot] = (uso[it.slot] || 0) + (it.ocupa ?? 1);
  }
  return uso;
}

export function podeEquipar(ficha, item, sistema) {
  if (!item.slot) return { ok: false, motivo: 'Este item não é equipável.' };
  const slot = sistema.slots.find(s => s.id === item.slot);
  if (!slot) return { ok: false, motivo: `Slot desconhecido: ${item.slot}` };
  const usado = slotsOcupados(ficha)[item.slot] || 0;
  if (usado + (item.ocupa ?? 1) > slot.capacidade) {
    return { ok: false, motivo: `Sem espaço em "${slot.nome}" (${usado}/${slot.capacidade}). Desequipe algo antes.` };
  }
  return { ok: true };
}

// Soma bônus/ônus dos itens equipados. Chaves: sigla de atributo, id de perícia/subperícia ou "Defesa".
export function bonusEquipados(ficha) {
  const total = {};
  for (const it of ficha.itens || []) {
    if (!it.equipado) continue;
    for (const [k, v] of Object.entries(it.bonus || {})) total[k] = (total[k] || 0) + v;
  }
  return total;
}

export function derivados(ficha, sistema) {
  const r = regras(sistema);
  const bonus = bonusEquipados(ficha);
  const racial = sistema.raca?.modificadores || {};
  const atributos = {}, percentual = {}, bonusPericial = {}, mod = {};
  for (const a of sistema.atributos) {
    const v = (ficha.atributos?.[a.sigla] ?? 0) + (bonus[a.sigla] || 0);
    atributos[a.sigla] = v;
    percentual[a.sigla] = 4 * v;
    bonusPericial[a.sigla] = Math.max(0, 2 * (v - 5));
    mod[a.sigla] = Math.floor((v - 10) / 2) + (racial[a.sigla] || 0);
  }
  const profissao = sistema.profissoes?.find(p => p.id === ficha.profissao);
  const bonusProfissao = Object.fromEntries((profissao?.subpericias || []).map(id => [id, profissao.bonus ?? 5]));

  const pericias = {}, subpericias = {};
  for (const p of sistema.pericias || []) {
    const base = ficha.pericias?.[p.id] ?? 0;
    const bp = bonusPericial[p.atributo] ?? 0;
    pericias[p.id] = base + bp + (bonus[p.id] || 0);
    for (const s of p.subpericias) {
      subpericias[s.id] = base + (ficha.subpericias?.[s.id] ?? 0) + bp + (bonusProfissao[s.id] || 0) + (bonus[p.id] || 0) + (bonus[s.id] || 0);
    }
  }
  const nivel = ficha.nivel || 1;
  const pvMax = 5 + 5 * nivel + Math.floor(((ficha.atributos?.FOR ?? 0) + (ficha.atributos?.CONS ?? 0)) / 2) + (profissao?.extras?.pv || 0);
  const sanidadeMax = (ficha.atributos?.INT ?? 0) + (ficha.atributos?.WILL ?? 0) + 10;
  const san = ficha.sanidade?.atual ?? sanidadeMax;
  const estadoSanidade = [...(sistema.sanidade?.estados || [])].reverse().find(e => san < e.abaixoDe)?.nome || 'Lúcido';
  // MSA: Humanidade calculada. MSS: valor anotado à mão (o livro ainda não define).
  const humanidadeMax = sistema.humanidade?.calculo
    ? Math.min(100, 50 + 2 * (ficha.atributos?.CAR ?? 0) + 2 * (ficha.atributos?.PER ?? 0))
    : Math.max(0, Math.min(100, ficha.humanidade?.max ?? sistema.humanidade?.inicial ?? 50));
  const hum = ficha.humanidade?.atual ?? humanidadeMax;
  const estagioHumanidade = (sistema.humanidade?.estagios || []).find(e => hum >= e.min && hum <= e.max) || null;
  const equipados = (ficha.itens || []).filter(i => i.equipado);
  return {
    bonus, atributos, percentual, bonusPericial, mod, pericias, subpericias, bonusProfissao,
    pvMax, sanidadeMax, estadoSanidade, humanidadeMax, estagioHumanidade,
    iniciativa: atributos.AGI ?? 0,
    linguasExtras: Math.max(0, mod.INT ?? 0),
    defesa: equipados.reduce((s, i) => s + (i.defesa || 0), 0) + (bonus.Defesa || 0),
    carga: (ficha.itens || []).reduce((s, i) => s + (i.peso || 0), 0),
    limitePericia: limitePericia(nivel, sistema),
    atributoMax: atributoMax(nivel, sistema),
    temClasse: nivel >= (r.nivelClasse ?? 3),
    temEspecializacao: nivel >= (r.nivelEspecializacao ?? 5),
  };
}

// Ganhos de classe até o nível atual, pela tabela de progressão.
export function ganhosDeClasse(ficha, sistema) {
  const classe = sistema.classes?.find(c => c.id === ficha.classe);
  if (!classe) return [];
  const esp = classe.especializacoes.find(e => e.id === ficha.especializacao);
  const ref = esp || classe.especializacoes[0];
  const limite = esp ? ficha.nivel : Math.min(ficha.nivel, (regras(sistema).nivelEspecializacao ?? 5) - 1);
  const descricoes = new Map();
  for (const x of [...classe.caracteristicas, ...classe.especializacoes.flatMap(e => e.habilidades)]) {
    const chave = x.nome.toLowerCase().replace(/\s*\(.*|\s*\[.*/g, '').trim();
    if (!descricoes.has(chave)) descricoes.set(chave, x.descricao);
  }
  return (ref?.progressao || []).filter(l => l.nivel <= limite).flatMap(l => l.ganhos.map(nome => ({
    nivel: l.nivel, nome, descricao: descricoes.get(nome.toLowerCase()) || '',
  })));
}

// Validação da ficha conforme os limites (usada na criação, no servidor e na tela).
export function problemasFicha(ficha, sistema, campanha) {
  const r = regras(sistema);
  const lista = [];
  const pts = pontosCampanha(campanha, sistema);
  const g = pontosGastos(ficha, sistema);
  const max = atributoMax(ficha.nivel, sistema);
  if (!String(ficha.nome || '').trim()) lista.push('Falta o nome do personagem.');
  for (const a of sistema.atributos) {
    const v = ficha.atributos?.[a.sigla] ?? 0;
    if (v < (r.atributoMin ?? 0)) lista.push(`${a.nome} abaixo do mínimo (${r.atributoMin}).`);
    if (v > max) lista.push(`${a.nome} acima do máximo para o nível (${max}).`);
  }
  if (g.atributos > pts.atributos) lista.push(`Atributos: ${g.atributos} de ${pts.atributos} pontos.`);
  const pp = pontosPericiaTotal(ficha, sistema, campanha);
  if (g.pericias > pp) lista.push(`Perícias: ${g.pericias} de ${pp} pontos.`);
  const lim = limitePericia(ficha.nivel, sistema);
  for (const p of sistema.pericias) {
    const base = ficha.pericias?.[p.id] ?? 0;
    if (base > lim) lista.push(`${p.nome}: ${base} acima do limite (${lim}).`);
    for (const s of p.subpericias) {
      const total = base + (ficha.subpericias?.[s.id] ?? 0);
      if (total > lim) lista.push(`${p.nome} › ${s.nome}: ${total} acima do limite (${lim}, somando a perícia base).`);
    }
  }
  const vDisp = pts.vantagens + pontosVantagemExtra(ficha, sistema);
  if (g.vantagens > vDisp) lista.push(`Vantagens: ${g.vantagens} de ${vDisp} pontos.`);
  if ((ficha.defeitos || []).length < (r.defeitosMinimos ?? 0)) lista.push(`Escolha ao menos ${r.defeitosMinimos} defeito.`);
  if (!ficha.profissao) lista.push('Escolha uma profissão.');
  if (ficha.classe && ficha.nivel < (r.nivelClasse ?? 3)) lista.push(`Classe só a partir do nível ${r.nivelClasse}.`);
  if (ficha.especializacao && ficha.nivel < (r.nivelEspecializacao ?? 5)) lista.push(`Especialização só a partir do nível ${r.nivelEspecializacao}.`);
  return lista;
}

// Monta um encontro aleatório cuja soma de dificuldade não ultrapasse o limite.
export function gerarEncontro(candidatos, limite, rng = Math.random, maxCriaturas = 10) {
  const escolhidos = [];
  let soma = 0;
  for (let tentativas = 0; tentativas < 200 && escolhidos.length < maxCriaturas; tentativas++) {
    const cabem = candidatos.filter(c => (c.dificuldade || 1) + soma <= limite);
    if (!cabem.length) break;
    const c = cabem[Math.floor(rng() * cabem.length)];
    escolhidos.push(c);
    soma += c.dificuldade || 1;
  }
  return { escolhidos, soma };
}
