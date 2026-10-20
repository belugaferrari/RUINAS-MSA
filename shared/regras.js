import { efeitosDoTexto, somarEfeitos, efeitosDaRegra } from './habilidades.js';
// Regras compartilhadas entre servidor e navegador.
// Base: Livro do Jogador MSS (rev. 14/10/2026). O MSA pode mudar regras — as fórmulas ficam todas aqui.

export const LIMITE_SALA = 20;

// Os jogadores veem abertamente só itens Mundanos, Comuns e Incomuns; os outros, só se o mestre liberar
// (todos de uma vez na campanha, ou item a item).
const RARIDADES_ABERTAS = ['', 'mundano', 'comum', 'incomum'];
const semAcento = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const itemAberto = item => RARIDADES_ABERTAS.includes(semAcento(item?.raridade));
export const itemVisivel = (item, campanha) => itemAberto(item) || !!campanha?.itensRarosVisiveis || (campanha?.itensLiberados || []).includes(item?.id);

// Aceita "2d6", "1d8+2", "1d6+1d4", "+1d4", "3" (somas e subtrações de dados e números).
export function rolarDado(expr, rng = Math.random) {
  const limpo = String(expr ?? '').replace(/\s/g, '').toLowerCase();
  const termos = limpo.match(/[+-]?[^+-]+/g);
  if (!limpo || !termos || termos.join('') !== limpo) throw new Error(`Dado inválido: ${expr}`);
  let dados = [], mod = 0, total = 0;
  for (const t of termos) {
    const sinal = t.startsWith('-') ? -1 : 1;
    const corpo = t.replace(/^[+-]/, '');
    const m = /^(\d*)d(\d+)$/.exec(corpo);
    if (m) {
      const qtd = Math.min(parseInt(m[1] || '1', 10), 100);
      const faces = parseInt(m[2], 10);
      if (!faces) throw new Error(`Dado inválido: ${expr}`);
      const rol = Array.from({ length: qtd }, () => 1 + Math.floor(rng() * faces));
      dados = dados.concat(rol);
      total += sinal * rol.reduce((a, b) => a + b, 0);
    } else if (/^\d+$/.test(corpo)) {
      mod += sinal * parseInt(corpo, 10);
      total += sinal * parseInt(corpo, 10);
    } else throw new Error(`Dado inválido: ${expr}`);
  }
  return { expr, dados, mod, total };
}

// Teste D-MIL: AÇÃO% + 1d100 ≥ ND, com 1d10 de suporte (DS).
// modo: 'vantagem' (rola 2d100 e fica com o maior) ou 'desvantagem' (o menor).
export function testeDMil(acao, nd, sistema, { metade = false, rng = Math.random, modo = null } = {}) {
  const t = sistema.teste;
  const dados = [1 + Math.floor(rng() * 100)];
  if (modo === 'vantagem' || modo === 'desvantagem') dados.push(1 + Math.floor(rng() * 100));
  const dp = modo === 'desvantagem' ? Math.min(...dados) : Math.max(...dados);
  const ds = 1 + Math.floor(rng() * 10);
  const valor = metade ? Math.floor(acao / 2) : acao;
  const total = valor + dp;
  const critico = dp >= t.criticoAcerto ? 'acerto' : dp <= t.criticoErro ? 'erro' : null;
  const sucesso = nd == null ? null : critico === 'acerto' ? true : critico === 'erro' ? false : total >= nd;
  return { dp, ds, acao: valor, total, nd, sucesso, critico, ...(dados.length > 1 ? { dados, modo } : {}) };
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
    maoHabil: 'direita',
    genero: '',
    background: '', anotacoes: '', foto: null,
    xp: 0, backups: [],
  };
  const d = derivados(ficha, sistema);
  ficha.pv = { max: d.pvMax, atual: d.pvMax };
  ficha.sanidade = { max: d.sanidadeMax, atual: d.sanidadeMax };
  ficha.humanidade = { max: d.humanidadeMax, atual: d.humanidadeLimite };
  return ficha;
}

// Pontos que o mestre liberou para a criação. Perícias "null" = fórmula do livro.
export function pontosCampanha(campanha, sistema) {
  const r = regras(sistema);
  if (campanha?.padraoMSA !== false) return { atributos: r.pontosAtributos, vantagens: r.pontosVantagem, pericias: null };
  const p = campanha.pontos || {};
  return { atributos: p.atributos || r.pontosAtributos, vantagens: p.vantagens ?? r.pontosVantagem, pericias: p.pericias || null };
}

// Pontos até o nível (Tabela de Progressão por Nível): +2 de atributo por nível e +1 vantagem nos níveis pares.
// As perícias seguem a fórmula 70 + 5×INT + 20×nível (ver pontosPericiaTotal).
// Com a classe escolhida, as vantagens da Tabela de Progressão param de contar: daí em diante valem só as
// "Vantagem Extra" da tabela da classe (não acumulam). Passe a ficha para considerar a classe.
export function pontosDoNivel(nivel, sistema, campanha, ficha = null) {
  const base = pontosCampanha(campanha, sistema);
  const r = regras(sistema);
  const pn = r.progressao?.porNivel || {};
  const n = Math.max(1, nivel || 1);
  const nivelClasse = r.nivelClasse ?? 3;
  let vantagens = base.vantagens + (pn.vantagemNiveisPares ?? 0) * Math.floor(n / 2);
  if (ficha?.classe && n >= nivelClasse) {
    const extras = ganhosDeClasse({ ...ficha, nivel: n }, sistema).filter(g => /vantagem extra/i.test(g.nome)).length;
    vantagens = base.vantagens + (pn.vantagemNiveisPares ?? 0) * Math.floor((nivelClasse - 1) / 2) + extras;
  }
  return {
    atributos: base.atributos + (pn.atributos ?? 0) * (n - 1),
    vantagens,
    pericias: base.pericias,
  };
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

// Vantagens que a ficha pode escolher: as gerais e, depois de escolher a classe (nível 3), as da própria classe.
// As de classe usam o id "<classe>/<vantagem>" para não colidir com as gerais.
export function vantagensDisponiveis(ficha, sistema) {
  const gerais = sistema.vantagens.map(v => ({ ...v, origem: 'Geral' }));
  const classe = sistema.classes?.find(c => c.id === ficha.classe);
  if (!classe || (ficha.nivel || 1) < (regras(sistema).nivelClasse ?? 3)) return gerais;
  return [...gerais, ...(classe.vantagens || []).map(v => ({ ...v, id: `${classe.id}/${v.id}`, custo: v.custo ?? 1, origem: classe.nome }))];
}

// Acha uma vantagem (geral ou de classe) pelo id, mesmo que a ficha não possa mais escolhê-la.
export function acharVantagem(id, sistema) {
  const geral = sistema.vantagens.find(v => v.id === id);
  if (geral) return { ...geral, origem: 'Geral' };
  const [cid, vid] = String(id).split('/');
  const classe = sistema.classes?.find(c => c.id === cid);
  const v = classe?.vantagens?.find(x => x.id === vid);
  return v ? { ...v, id, custo: v.custo ?? 1, origem: classe.nome } : null;
}

// XP para subir do nível n para n+1: regras.xp.porNivel (100 por nível); "crescente" multiplica pelo nível; "tabela" define nível a nível.
export function xpParaSubir(nivel, sistema) {
  const x = regras(sistema).xp || {};
  if (Array.isArray(x.tabela) && x.tabela[nivel - 1] != null) return x.tabela[nivel - 1];
  return (x.porNivel ?? 100) * (x.crescente ? (nivel || 1) : 1);
}

export function pontosGastos(ficha, sistema) {
  const atributos = sistema.atributos.reduce((s, a) => s + (ficha.atributos?.[a.sigla] ?? 0), 0);
  const vantagens = (ficha.vantagens || []).reduce((s, id) => s + (acharVantagem(id, sistema)?.custo ?? 1), 0);
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

// Condições ativas (marcadores com o nome de uma condição do sistema). As que acumulam contam cada marcador.
export function condicoesAtivas(ficha, sistema) {
  const ativas = new Map();
  for (const m of ficha.marcadores || []) {
    const s = semAcento(m);
    const c = (sistema.condicoes || []).find(x => s === semAcento(x.nome) || s.startsWith(semAcento(x.nome)));
    if (!c) continue;
    const atual = ativas.get(c.id) || { ...c, qtd: 0 };
    atual.qtd = c.acumula ? atual.qtd + 1 : 1;
    ativas.set(c.id, atual);
  }
  return [...ativas.values()];
}

// Habilidades que o personagem pode ativar no combate: vantagens, ganhos da classe e a habilidade única da raça.
// Ganho que se repete na tabela da classe (Ataque afiado nos níveis 6, 10, 14…) aparece uma vez, com "vezes".
// "regra" é a regra própria da habilidade (conteudo/sistemas/habilidades-regras.json), quando existe.
export function listaHabilidades(ficha, sistema) {
  const ganhos = new Map();
  for (const g of ganhosDeClasse(ficha, sistema).filter(g => g.descricao)) {
    const atual = ganhos.get(g.nome);
    if (atual) atual.vezes++;
    else ganhos.set(g.nome, { id: `c:${g.nome}`, nome: g.nome, descricao: g.descricao, tipo: `Nível ${g.nivel}`, vezes: 1 });
  }
  return [
    ...(ficha.vantagens || []).map(id => acharVantagem(id, sistema)).filter(Boolean).map(v => ({ id: `v:${v.id}`, nome: v.nome, descricao: v.descricao, tipo: v.origem === 'Geral' ? 'Vantagem' : `Classe · ${v.origem}`, vezes: 1 })),
    ...ganhos.values(),
    sistema.raca?.habilidadeUnica ? { id: 'raca', nome: sistema.raca.habilidadeUnica.nome, descricao: sistema.raca.habilidadeUnica.descricao, tipo: sistema.raca.nome, vezes: 1 } : null,
  ].filter(Boolean).map(x => ({ ...x, regra: regraDaHabilidade(x.nome, sistema) }));
}

// Regra própria da habilidade, pelo nome (sem acento, maiúsculas nem o que vem entre parênteses).
export const chaveHabilidade = nome => semAcento(nome).replace(/\s*[([].*$/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export function regraDaHabilidade(nome, sistema) {
  return sistema.habilidadesRegras?.[chaveHabilidade(nome)] || null;
}
export const temHabilidade = (ficha, sistema, nome) => listaHabilidades(ficha, sistema).find(x => chaveHabilidade(x.nome) === chaveHabilidade(nome)) || null;

// Subperícias que o personagem vê: as que exigem habilidade (Sentidos › Ondas) só para quem a tem.
export const subpericiasDe = (pericia, ficha, sistema) => pericia.subpericias.filter(s => !s.exige || listaHabilidades(ficha || {}, sistema).some(x => chaveHabilidade(x.nome) === s.exige));

// Tipo de criatura (para habilidades que valem só contra drones, animais…): o da ficha, ou humanoide / monstro.
export const tipoCriatura = p => p?.tipoCriatura || (p?.criatura ? 'monstro' : 'humanoide');
const rotulosEfeitos = sistema => ({
  tipos: Object.fromEntries((sistema.tiposCriatura || []).map(t => [t.id, t.nome])),
  sub: id => (sistema.pericias || []).flatMap(p => p.subpericias.map(s => [s.id, `${p.nome} › ${s.nome}`])).find(x => x[0] === id)?.[1],
});

// O que uma habilidade faz no app: o ajuste do mestre (se houver); senão a regra própria; senão o que o app leu do texto do livro.
export function efeitosHabilidade(ficha, sistema, hab) {
  const regra = hab.regra === undefined ? regraDaHabilidade(hab.nome, sistema) : hab.regra;
  const texto = ficha.ajustesHabilidades?.[hab.id] ?? (regra ? regra.efeitos || '' : hab.descricao);
  const r = efeitosDoTexto(texto, sistema, { tipoIp });
  return regra ? efeitosDaRegra(regra, r, sistema, rotulosEfeitos(sistema)) : r;
}

// Como a habilidade funciona no app: "sempre" (aplicada sozinha), "ligar" (botão liga/desliga), "ativar" (botão com custo/duração)
// ou "lembrete" (sem efeito no app). Sem regra própria: liga/desliga se o app achou números no texto.
export function modoHabilidade(ficha, sistema, hab) {
  if (ficha.ajustesHabilidades?.[hab.id]) return hab.regra?.modo === 'sempre' ? 'sempre' : 'ligar';
  if (hab.regra?.modo) return hab.regra.modo;
  return efeitosHabilidade(ficha, sistema, hab).notas.length ? 'ligar' : 'lembrete';
}

export function bonusHabilidades(ficha, sistema) {
  const ativas = new Set(ficha.ativas || []);
  const lista = listaHabilidades(ficha, sistema).filter(x => ativas.has(x.id) || x.regra?.modo === 'sempre');
  return somarEfeitos(lista.map(x => efeitosHabilidade(ficha, sistema, x)));
}

// Vantagem por habilidade: alvo = 'ataque' | 'iniciativa' | 'testes' | id de perícia/subperícia. "contra" = tipos de criatura do oponente.
export function vantagemPorHabilidade(ficha, sistema, alvos, oponentes = null) {
  const lista = Array.isArray(alvos) ? alvos : [alvos];
  const tipos = oponentes ? oponentes.map(tipoCriatura) : null;
  return bonusHabilidades(ficha, sistema).vantagens.some(v => (lista.includes(v.alvo) || v.alvo === 'testes')
    && (!v.contra || (tipos && v.contra.some(t => tipos.includes(t)))));
}

// Progressão dos dados de dano (livro, criação de armadilhas): D4 > D6 > D8 > D10 > D12 > 2D6 > 2D8 > 2D10 > 2D12 > 3D10 > 3D12 > 2D20.
export const PROGRESSAO_DANO = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d8', '2d10', '2d12', '3d10', '3d12', '2d20'];
// Sobe (ou desce) n passos o dado de uma expressão de dano ("1d6+2" → "1d8+2"). Dado fora da tabela: usa o de média mais próxima.
export function subirPassos(expr, n) {
  if (!n) return expr;
  const m = /^\s*(\d*)d(\d+)(.*)$/i.exec(String(expr || ''));
  if (!m) return expr;
  const qtd = parseInt(m[1] || '1', 10), faces = parseInt(m[2], 10);
  const media = e => { const [a, b] = e.split('d').map(Number); return (a * (b + 1)) / 2; };
  let i = PROGRESSAO_DANO.indexOf(`${qtd}d${faces}`);
  if (i < 0) {
    const alvo = (qtd * (faces + 1)) / 2;
    i = PROGRESSAO_DANO.reduce((melhor, e, k) => (Math.abs(media(e) - alvo) < Math.abs(media(PROGRESSAO_DANO[melhor]) - alvo) ? k : melhor), 0);
  }
  const j = Math.max(0, Math.min(PROGRESSAO_DANO.length - 1, i + n));
  return `${PROGRESSAO_DANO[j]}${m[3]}`;
}

export function derivados(ficha, sistema) {
  const r = regras(sistema);
  const bonus = bonusEquipados(ficha);
  const hab = bonusHabilidades(ficha, sistema);
  const racial = sistema.raca?.modificadores || {};
  // Condições (Fome, Cansado, Sono…): mudam atributos e somam/subtraem % nos testes.
  // Durante o combate os efeitos das Necessidades (Fome, Sede, Sono, Doença, Friagem) ficam suspensos (livro).
  const condicoes = condicoesAtivas(ficha, sistema).filter(c => !(ficha.emCombate && c.grupo === 'Necessidades'));
  const condAtr = {}, condTesteAtr = {}, condPericia = {};
  let condTestes = 0;
  for (const c of condicoes) {
    for (const [k, v] of Object.entries(c.atributos || {})) condAtr[k] = (condAtr[k] || 0) + v * c.qtd;
    for (const [k, v] of Object.entries(c.testesAtributos || {})) condTesteAtr[k] = (condTesteAtr[k] || 0) + v * c.qtd;
    for (const [k, v] of Object.entries(c.testesPericias || {})) condPericia[k] = (condPericia[k] || 0) + v * c.qtd;
    condTestes += (c.testes || 0) * c.qtd;
  }
  const atributos = {}, percentual = {}, bonusPericial = {}, mod = {};
  for (const a of sistema.atributos) {
    let v = (ficha.atributos?.[a.sigla] ?? 0) + (bonus[a.sigla] || 0) + (condAtr[a.sigla] || 0) + (hab.atributos[a.sigla] || 0);
    // Essência monstruosa: até o fim do combate, o atributo mais alto do monstro abatido vira o do personagem.
    if (ficha.essencia?.sigla === a.sigla) v = Math.max(v, ficha.essencia.valor);
    atributos[a.sigla] = v;
    percentual[a.sigla] = 4 * v + condTestes + hab.testes + (condTesteAtr[a.sigla] || 0);
    bonusPericial[a.sigla] = Math.max(0, 2 * (v - 5));
    mod[a.sigla] = Math.floor((v - 10) / 2) + (racial[a.sigla] || 0);
  }
  const profissao = sistema.profissoes?.find(p => p.id === ficha.profissao);
  const bonusProfissao = Object.fromEntries((profissao?.subpericias || []).map(id => [id, profissao.bonus ?? 5]));

  const pericias = {}, subpericias = {};
  for (const p of sistema.pericias || []) {
    const base = ficha.pericias?.[p.id] ?? 0;
    const bp = bonusPericial[p.atributo] ?? 0;
    const cond = condTestes + (condTesteAtr[p.atributo] || 0) + (condPericia[p.id] || 0) + hab.testes + (hab.pericias[p.id] || 0);
    pericias[p.id] = base + bp + (bonus[p.id] || 0) + cond;
    for (const s of p.subpericias) {
      subpericias[s.id] = base + (ficha.subpericias?.[s.id] ?? 0) + bp + (bonusProfissao[s.id] || 0) + (bonus[p.id] || 0) + (bonus[s.id] || 0) + cond + (hab.subpericias[s.id] || 0);
    }
  }
  const nivel = ficha.nivel || 1;
  // PV (livro, Passo 6, sem o "+1" — confirmado pelo autor): FOR + CONS no 1º nível e +5 a cada nível depois.
  // Usa os atributos da ficha: condições que baixam a CONS não diminuem o PV total.
  const pvBase = (ficha.atributos?.FOR ?? 0) + (ficha.atributos?.CONS ?? 0) + 5 * (nivel - 1) + (profissao?.extras?.pv || 0) + hab.pv;
  // PV persistentes (perdidos até o efeito acabar) e permanentes (nunca voltam) baixam o máximo.
  const pvPersistente = Math.max(0, ficha.pv?.persistente || 0);
  const pvPermanente = Math.max(0, ficha.pv?.permanente || 0);
  const pvMax = Math.max(1, pvBase - pvPersistente - pvPermanente);
  const sanidadeMax = (ficha.atributos?.INT ?? 0) + (ficha.atributos?.WILL ?? 0) + 10;
  const san = ficha.sanidade?.atual ?? sanidadeMax;
  const estadoSanidade = [...(sistema.sanidade?.estados || [])].reverse().find(e => san < e.abaixoDe)?.nome || 'Lúcido';
  // Humanidade vai de 1 a 100 (abaixo de 1 o jogador perde o controle do personagem).
  // Limite inicial = 50 + 2×CAR + 2×PER: o personagem novo começa com um valor de 51 até esse limite, à escolha do jogador.
  // Habilidades podem baixar a Humanidade máxima (Alma de ciborgue: −10 permanentes).
  const humanidadeMax = (sistema.humanidade?.maximo ?? 100) + hab.humanidadeMax;
  const humanidadeLimite = Math.min(humanidadeMax, 50 + 2 * (ficha.atributos?.CAR ?? 0) + 2 * (ficha.atributos?.PER ?? 0));
  const humanidadeMinInicial = Math.min(humanidadeLimite, sistema.humanidade?.minimoInicial ?? 51);
  const hum = ficha.humanidade?.atual ?? humanidadeLimite;
  const estagioHumanidade = (sistema.humanidade?.estagios || []).find(e => hum >= e.min && hum <= e.max) || null;
  const equipados = (ficha.itens || []).filter(i => i.equipado);
  const carga = estadoCarga((ficha.itens || []).reduce((s, i) => s + (i.peso || 0), 0), atributos.FOR ?? 10);
  return {
    bonus, atributos, percentual, bonusPericial, mod, pericias, subpericias, bonusProfissao,
    condicoes, condAtr, condTestes, condTesteAtr,
    pvMax, pvBase, pvPersistente, pvPermanente, sanidadeMax, estadoSanidade, humanidadeMax, humanidadeLimite, humanidadeMinInicial, estagioHumanidade,
    iniciativa: atributos.AGI ?? 0,
    linguasExtras: Math.max(0, mod.INT ?? 0),
    defesa: equipados.reduce((s, i) => s + ipDoItem(i).geral, 0) + (bonus.Defesa || 0),
    ip: ipPorTipo(ficha, equipados, bonus, hab),
    habilidades: hab,
    carga: (ficha.itens || []).reduce((s, i) => s + (i.peso || 0), 0),
    ...carga,
    ...deslocamento(sistema, condicoes, carga.cargaNivel),
    limitePericia: limitePericia(nivel, sistema),
    atributoMax: atributoMax(nivel, sistema),
    temClasse: nivel >= (r.nivelClasse ?? 3),
    temEspecializacao: nivel >= (r.nivelEspecializacao ?? 5),
  };
}

// Deslocamento por turno (planilha de regras gerais): humano 9 m = 6 quadrados de 1,5 m.
// Preso (Paralisado, Enraizado, Imobilizado, Desmaiado, Esmagado) = 0; Dano a membros inferiores −3 m cada;
// Sobrecarregado −4,5 m; Supercarregado só 1 passo (1,5 m).
export function deslocamento(sistema, condicoes, cargaNivel) {
  const base = parseFloat(String(sistema.raca?.deslocamento || '9').replace(',', '.')) || 9;
  const motivos = [];
  let m = base;
  if (condicoes.some(c => c.movimento === 'preso')) {
    motivos.push(...condicoes.filter(c => c.movimento === 'preso').map(c => c.nome));
    m = 0;
  } else {
    const pernas = condicoes.find(c => c.id === 'membros-inferiores');
    if (pernas) { m -= 3 * pernas.qtd; motivos.push(`${pernas.nome} −${3 * pernas.qtd} m`); }
    if (cargaNivel === 'sobrecarregado') { m -= 4.5; motivos.push('Sobrecarregado −4,5 m'); }
    if (cargaNivel === 'supercarregado') { m = Math.min(m, 1.5); motivos.push('Supercarregado: só 1 passo'); }
  }
  m = Math.max(0, m);
  return { deslocamentoBase: base, deslocamento: m, deslocamentoQuadrados: Math.floor(m / 1.5), deslocamentoMotivos: motivos };
}

// Ganhos de classe até o nível atual, pela tabela de progressão.
export function ganhosDeClasse(ficha, sistema) {
  const classe = sistema.classes?.find(c => c.id === ficha.classe);
  if (!classe) return [];
  const esp = classe.especializacoes.find(e => e.id === ficha.especializacao);
  const ref = esp || classe.especializacoes[0];
  const limite = esp ? ficha.nivel : Math.min(ficha.nivel, (regras(sistema).nivelEspecializacao ?? 5) - 1);
  // Acha o texto de cada ganho sem ligar para acento, maiúsculas ou o que vem entre parênteses/colchetes;
  // procura nas características, nas habilidades das especializações e nas vantagens da classe.
  const chave = nome => semAcento(nome).replace(/\s*[([].*$/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const descricoes = new Map();
  for (const x of [...classe.caracteristicas, ...(esp?.habilidades || []), ...classe.especializacoes.flatMap(e => e.habilidades), ...(classe.vantagens || [])]) {
    if (x.descricao && !descricoes.has(chave(x.nome))) descricoes.set(chave(x.nome), x.descricao);
  }
  // Alguns ganhos estão no livro dentro do texto de outra habilidade ("… Nível 6: O Show Tem Que Continuar. texto …").
  const todoTexto = [...classe.caracteristicas, ...classe.especializacoes.flatMap(e => e.habilidades), ...(classe.vantagens || [])].map(x => x.descricao || '').join(' ') + ' ' + (classe.extras || '');
  const dentroDeOutro = nome => {
    const esc = nome.replace(/\s*[([].*$/, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp(`N[íi]vel\\s*\\d+\\s*[:.]?\\s*${esc}\\s*[.:]\\s*(.+?)(?=\\s*N[íi]vel\\s*\\d+\\s*[:.]|$)`, 'i').exec(todoTexto);
    return m ? m[1].trim() : '';
  };
  // O livro às vezes escreve o nome diferente da tabela da classe ("Artificie"/"Artífice", "Gerigonça"/"Geringonça"):
  // sem achar o nome exato, aceita o nome mais parecido com até 2 letras de diferença.
  const parecido = nome => {
    const k = chave(nome);
    if (k.length < 8) return '';
    let melhor = null;
    for (const [outra, desc] of descricoes) {
      const d = distancia(k, outra);
      if (d <= 2 && (!melhor || d < melhor.d)) melhor = { d, desc };
    }
    return melhor?.desc || '';
  };
  return (ref?.progressao || []).filter(l => l.nivel <= limite).flatMap(l => l.ganhos.map(nome => ({
    nivel: l.nivel, nome, descricao: descricoes.get(chave(nome)) || dentroDeOutro(nome) || parecido(nome),
  })));
}

// Distância de edição (quantas letras trocar, pôr ou tirar para uma palavra virar a outra).
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = atual;
  }
  return ant[b.length];
}

// Validação da ficha conforme os limites (usada na criação, no servidor e na tela).
// apenasPontos: confere só atributos, perícias e vantagens (usado ao evoluir).
export function problemasFicha(ficha, sistema, campanha, { apenasPontos = false } = {}) {
  const r = regras(sistema);
  const lista = [];
  const pts = pontosDoNivel(ficha.nivel, sistema, campanha, ficha);
  const g = pontosGastos(ficha, sistema);
  const max = atributoMax(ficha.nivel, sistema);
  if (!apenasPontos && !String(ficha.nome || '').trim()) lista.push('Falta o nome do personagem.');
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
  if (apenasPontos) return lista;
  if ((ficha.defeitos || []).length < (r.defeitosMinimos ?? 0)) lista.push(`Escolha ao menos ${r.defeitosMinimos} defeito.`);
  if (!ficha.profissao) lista.push('Escolha uma profissão.');
  if (!ficha.genero) lista.push('Escolha o gênero do personagem (passo Identidade).');
  if (ficha.classe && ficha.nivel < (r.nivelClasse ?? 3)) lista.push(`Classe só a partir do nível ${r.nivelClasse}.`);
  if (ficha.especializacao && ficha.nivel < (r.nivelEspecializacao ?? 5)) lista.push(`Especialização só a partir do nível ${r.nivelEspecializacao}.`);
  const disp = new Set(vantagensDisponiveis(ficha, sistema).map(v => v.id));
  for (const id of ficha.vantagens || []) if (!disp.has(id)) lista.push(`A vantagem "${acharVantagem(id, sistema)?.nome || id}" não está disponível para esta ficha.`);
  const d = derivados(ficha, sistema);
  const hum = ficha.humanidade?.atual;
  if (hum != null && (hum < d.humanidadeMinInicial || hum > d.humanidadeLimite)) {
    lista.push(`Humanidade inicial deve ficar entre ${d.humanidadeMinInicial} e ${d.humanidadeLimite} (50 + 2×CAR + 2×PER).`);
  }
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

// ---------- IP (Índice de Proteção) por tipo de dano ----------
// Livro: Corte; Perfuração; Concussão; Elétrico; Calor; Energia (Mágico); Radiação; Vibração; Onda de Choque; Ácido;
// Venenoso; Impacto*; Físico*; A distância*; Elemental*; Químico*; Psíquico. Os com * agrupam outros tipos.
// O IP "geral" vale contra tudo; o de um tipo só contra aquele dano (e o de um grupo, contra os tipos do grupo).
export const TIPOS_IP = ['Corte', 'Perfuração', 'Concussão', 'Elétrico', 'Calor', 'Frio', 'Energia', 'Radiação', 'Vibração', 'Onda de Choque',
  'Ácido', 'Venenoso', 'Psíquico', 'Impacto', 'Físico', 'A distância', 'Elemental', 'Químico'];
export const GRUPOS_IP = {
  'Físico': ['Corte', 'Perfuração', 'Concussão', 'Impacto', 'Não letal'],
  'Impacto': ['Concussão', 'Onda de Choque', 'Vibração'],
  'Elemental': ['Elétrico', 'Calor', 'Frio'],
  'Químico': ['Ácido', 'Venenoso'],
};
const SINONIMOS_IP = {
  corte: 'Corte', laminas: 'Corte', perf: 'Perfuração', perfuracao: 'Perfuração', perfurante: 'Perfuração', mordida: 'Perfuração',
  concussao: 'Concussão', impacto: 'Impacto', queda: 'Concussão', eletrico: 'Elétrico', eletricidade: 'Elétrico', choque: 'Elétrico',
  calor: 'Calor', fogo: 'Calor', termico: 'Calor', frio: 'Frio', gelo: 'Frio', energia: 'Energia', magico: 'Energia', espectral: 'Energia', mistico: 'Energia',
  radiacao: 'Radiação', vibracao: 'Vibração', 'onda de choque': 'Onda de Choque', explosao: 'Onda de Choque', acido: 'Ácido',
  venenoso: 'Venenoso', veneno: 'Venenoso', toxico: 'Venenoso', psiquico: 'Psíquico', mental: 'Psíquico', fisico: 'Físico',
  balistico: 'A distância', bala: 'A distância', balas: 'A distância', tiro: 'A distância', 'a distancia': 'A distância', distancia: 'A distância',
  elemental: 'Elemental', quimico: 'Químico',
};
export const tipoIp = nome => SINONIMOS_IP[semAcento(nome).replace(/\s*\(.*$/, '')] || null;

// IP de um item: { geral, tipos }. Usa "ipTipos" do catálogo ou lê o texto ("IP 3 (Corte) IP 1 (Outros)", "IP 2 (Corte/Perf)").
// Parte do corpo entre parênteses (Cabeça, Pernas…) ou "Outros" contam como geral.
export function ipDoItem(i) {
  if (i.ipTipos) return { geral: i.ipTipos.geral || 0, tipos: Object.fromEntries(Object.entries(i.ipTipos).filter(([k]) => k !== 'geral')) };
  const texto = [i.efeitos, i.efeitosObs, i.observacoes].filter(Boolean).join(' ');
  const r = { geral: 0, tipos: {} };
  let achou = false;
  for (const m of texto.matchAll(/\bIP\s*\+?(\d+)\s*(?:\(([^)]*)\))?/gi)) {
    achou = true;
    const v = parseInt(m[1], 10) || 0;
    const tipos = (m[2] || '').split(/[\/,;]| e /).map(tipoIp).filter(Boolean);
    if (!tipos.length) r.geral += v;
    for (const t of tipos) r.tipos[t] = (r.tipos[t] || 0) + v;
  }
  if (!achou) r.geral = i.defesa || 0;
  return r;
}

function ipPorTipo(ficha, equipados, bonus, hab) {
  const tipos = { ...hab.ip.tipos };
  let geral = (bonus.Defesa || 0) + (parseInt(ficha.ipExtra, 10) || 0) + hab.ip.geral;
  for (const i of equipados) {
    const x = ipDoItem(i);
    geral += x.geral;
    for (const [t, v] of Object.entries(x.tipos)) tipos[t] = (tipos[t] || 0) + v;
  }
  for (const [k, v] of Object.entries(bonus)) {
    const t = k.startsWith('IP ') ? tipoIp(k.slice(3)) : null;
    if (t) tipos[t] = (tipos[t] || 0) + v;
  }
  return { geral, tipos };
}

// IP que vale contra um dano: geral + o do tipo + o dos grupos que contêm o tipo (+ "A distância" contra tiros).
export function ipContraDano(ip, tipoDano, distancia = false) {
  const t = tipoIp(tipoDano || '') || tipoDano;
  let total = ip.geral + (ip.tipos[t] || 0);
  for (const [g, membros] of Object.entries(GRUPOS_IP)) if (g !== t && membros.includes(t)) total += ip.tipos[g] || 0;
  if (distancia && t !== 'A distância') total += ip.tipos['A distância'] || 0;
  return total;
}

// Carga (livro, "Barra de carga"): carregamento de 40 kg com FOR 10, dobrando a cada 6 pontos de FOR;
// levantamento = o dobro. Até o carregamento: normal. Até o levantamento: Sobrecarregado. Acima: Supercarregado.
export function estadoCarga(peso, FOR) {
  const capacidade = Math.round(40 * 2 ** ((FOR - 10) / 6));
  const levantamento = capacidade * 2;
  const nivel = peso <= capacidade ? 'normal' : peso <= levantamento ? 'sobrecarregado' : 'supercarregado';
  const efeito = {
    normal: 'Sem ônus.',
    sobrecarregado: 'Sobrecarregado: deslocamento −4,5 m. Se correr (duas ações de movimento), teste de CONS difícil para não ficar Cansado.',
    supercarregado: 'Supercarregado: só 1 passo (1,5 m) por turno e não corre. A cada turno, teste de FOR muito difícil; se falhar, solta o peso que puder ou fica Esmagado (1 PV por 20 kg excedentes por turno).',
  }[nivel];
  return { cargaCapacidade: capacidade, cargaLevantamento: levantamento, cargaNivel: nivel, cargaEfeito: efeito };
}

// Gênero do personagem e por quais gêneros ele se atrai (Sedução só funciona em quem se atrai pelo gênero de quem seduz).
// atracao: lista de gêneros; [] = não se atrai por ninguém; sem o campo = ainda não definido (não limita).
export const GENEROS = [{ id: 'masculino', nome: 'Masculino', plural: 'Homens' }, { id: 'feminino', nome: 'Feminino', plural: 'Mulheres' }, { id: 'outro', nome: 'Outro', plural: 'Outros gêneros' }];
// Opções de "Se atrai por" (uma só): Homens, Mulheres ou Ambos os gêneros.
export const ATRACOES = [
  { id: 'homens', nome: 'Homens', generos: ['masculino'] },
  { id: 'mulheres', nome: 'Mulheres', generos: ['feminino'] },
  { id: 'ambos', nome: 'Ambos os gêneros', generos: ['masculino', 'feminino', 'outro'] },
];
export function atracaoDe(lista) {
  if (!Array.isArray(lista)) return null;
  const s = new Set(lista);
  if (s.has('masculino') && s.has('feminino')) return ATRACOES[2];
  if (s.has('masculino')) return ATRACOES[0];
  if (s.has('feminino')) return ATRACOES[1];
  return null;
}
export function podeSeduzir(autor, alvo) {
  if (!Array.isArray(alvo?.atracao) || !autor?.genero) return { ok: true };
  if (alvo.atracao.includes(autor.genero)) return { ok: true };
  return { ok: false, motivo: `${alvo.nome} não se atrai por ${GENEROS.find(g => g.id === autor.genero)?.plural.toLowerCase() || 'esse gênero'}: Sedução não funciona.` };
}

// ---------- Durabilidade (livro, cap. 5) ----------
// Falhou num teste usando o item: se o DS for MAIOR que a durabilidade atual, perde 1 (sem os pré-requisitos, qualquer falha
// desgasta). Em 0, quebra. Reparo (Engenharia): +1, nunca acima da original e nunca dois seguidos — depois de reparar,
// só repara de novo depois de um novo desgaste (caiu 3, sobe só 1; habilidades podem mudar isso).
// "C" = consumível (some ao usar); "AC" = autoconsumível (estraga sozinho com o tempo) — esses não têm contagem.
export function durabilidadeDe(i) {
  if (i.consumivel) return { tipo: 'consumivel', texto: 'Consumível' };
  if (i.autoConsumivel) return { tipo: 'auto', texto: 'Autoconsumível' };
  if (i.durabilidade == null) return { tipo: 'sem', texto: '—' };
  const atual = i.durabilidadeAtual ?? i.durabilidade;
  return { tipo: 'normal', atual, max: i.durabilidade, quebrado: atual <= 0, reparavel: !!i.reparavel && atual < i.durabilidade, texto: `${atual}/${i.durabilidade}` };
}

export function desgastarItem(i, ds, { semPrerequisito = false } = {}) {
  const d = durabilidadeDe(i);
  if (d.tipo !== 'normal' || d.quebrado) return null;
  if (!semPrerequisito && !(ds > d.atual)) return null;
  i.durabilidadeAtual = d.atual - 1;
  i.reparavel = true;
  return i.durabilidadeAtual <= 0 ? `${i.nome} quebrou (durabilidade 0)` : `${i.nome} perdeu 1 de durabilidade (DS ${ds} > ${d.atual}): ${i.durabilidadeAtual}/${i.durabilidade}`;
}

export function repararItem(i) {
  const d = durabilidadeDe(i);
  if (d.tipo !== 'normal') throw new Error(`${i.nome} não tem durabilidade para reparar.`);
  if (d.atual >= d.max) throw new Error(`${i.nome} já está com a durabilidade original.`);
  if (!d.reparavel) throw new Error(`${i.nome}: não dá para reparar duas vezes seguidas — só depois de um novo desgaste.`);
  i.durabilidadeAtual = d.atual + 1;
  i.reparavel = false;
  return `${i.nome} reparado: ${i.durabilidadeAtual}/${i.durabilidade}`;
}
