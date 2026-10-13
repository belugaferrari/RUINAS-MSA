// Regras compartilhadas entre servidor e navegador.
// Tudo aqui é PROVISÓRIO: as fórmulas reais do MSA entram aqui quando as regras chegarem.

export const LIMITE_SALA = 20;

export function rolarDado(expr, rng = Math.random) {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(expr || '');
  if (!m) throw new Error(`Dado inválido: ${expr}`);
  const qtd = Math.min(parseInt(m[1] || '1', 10), 100);
  const faces = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0;
  const dados = Array.from({ length: qtd }, () => 1 + Math.floor(rng() * faces));
  return { expr, dados, mod, total: dados.reduce((a, b) => a + b, 0) + mod };
}

export function novaFicha(sistema, campanha) {
  const ini = sistema.inicio || {};
  return {
    nivel: typeof campanha?.nivel === 'number' ? campanha.nivel : 1,
    nome: '', idade: '', peso: '', altura: '', instinto: '', caracteristicas: '',
    classe: 'Sem classe', escolhasClasse: {},
    vantagens: [],
    atributos: Object.fromEntries(sistema.atributos.map(a => [a.nome, a.min ?? 0])),
    pericias: Object.fromEntries(sistema.pericias.map(p => [p.nome, 0])),
    itens: [],
    dinheiro: ini.dinheiro ?? 0,
    pv: { max: ini.pvBase ?? 10, atual: ini.pvBase ?? 10 },
    sanidade: { max: ini.sanidadeMax ?? 10, atual: ini.sanidade ?? 10 },
    humanidade: { max: ini.humanidadeMax ?? 10, atual: ini.humanidade ?? 10 },
    marcadores: [],
    background: '', anotacoes: '', foto: null,
    xp: 0, backups: [],
  };
}

// Pontos disponíveis na criação, conforme a campanha.
export function pontosCampanha(campanha, sistema) {
  return campanha.padraoMSA ? { ...sistema.padraoMSA } : { ...campanha.pontos };
}

export function pontosGastos(ficha, sistema) {
  const atributos = sistema.atributos.reduce((s, a) => s + ((ficha.atributos?.[a.nome] ?? 0) - (a.min ?? 0)), 0);
  const pericias = sistema.pericias.reduce((s, p) => s + (ficha.pericias?.[p.nome] ?? 0), 0);
  const vantagens = (ficha.vantagens || []).reduce((s, nome) => {
    const v = sistema.vantagens.find(x => x.nome === nome);
    return s + (v ? v.custo : 0);
  }, 0);
  return { atributos, vantagens, pericias };
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

// Soma bônus/ônus dos itens equipados (atributos, perícias ou qualquer chave).
export function bonusEquipados(ficha) {
  const total = {};
  for (const it of ficha.itens || []) {
    if (!it.equipado) continue;
    for (const [k, v] of Object.entries(it.bonus || {})) total[k] = (total[k] || 0) + v;
  }
  return total;
}

export function derivados(ficha, sistema) {
  const bonus = bonusEquipados(ficha);
  const atributos = Object.fromEntries(sistema.atributos.map(a => [a.nome, (ficha.atributos?.[a.nome] ?? 0) + (bonus[a.nome] || 0)]));
  const pericias = Object.fromEntries(sistema.pericias.map(p => [p.nome, (ficha.pericias?.[p.nome] ?? 0) + (bonus[p.nome] || 0)]));
  const equipados = (ficha.itens || []).filter(i => i.equipado);
  const defesa = equipados.reduce((s, i) => s + (i.defesa || 0), 0) + (bonus.Defesa || 0);
  const carga = (ficha.itens || []).reduce((s, i) => s + (i.peso || 0), 0);
  return { bonus, atributos, pericias, defesa, carga };
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
