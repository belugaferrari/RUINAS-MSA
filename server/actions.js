import { db, save, uid } from './db.js';
import { sistema, idSistema } from './sistema.js';
import { novaFicha, podeEquipar, rolarDado, rolarAtributosCriacao, testeDMil, gerarEncontro, derivados, problemasFicha, LIMITE_SALA } from '../shared/regras.js';

const GRUPO_ENCONTROS = 'encontros';
const MAX_LOG = 100;
const MAX_BACKUPS = 20;

export function erro(msg) {
  const e = new Error(msg);
  e.publico = true;
  return e;
}

export function novaCampanha(user, dados) {
  const nome = String(dados.nome || '').trim();
  if (!nome) throw erro('Dê um nome à campanha.');
  const maxJogadores = Math.max(1, Math.min(9, parseInt(dados.maxJogadores, 10) || 1));
  const nivel = dados.nivel === 'Variavel' ? 'Variavel' : Math.max(1, Math.min(20, parseInt(dados.nivel, 10) || 1));
  const padraoMSA = !!dados.padraoMSA;
  const pontos = padraoMSA ? null : {
    atributos: Math.max(0, parseInt(dados.pontos?.atributos, 10) || 0),
    vantagens: Math.max(0, parseInt(dados.pontos?.vantagens, 10) || 0),
    pericias: Math.max(0, parseInt(dados.pontos?.pericias, 10) || 0),
  };
  const c = {
    id: uid(), nome, mestreId: user.id, maxJogadores, nivel, padraoMSA, pontos, sistema: idSistema(dados.sistema),
    aberta: false, lojaAberta: false, criadaEm: Date.now(),
    jogadores: [],
    lore: { background: '', sessoes: [] },
    anotacoes: '', anotacoesResumo: '',
    grupos: [{ id: GRUPO_ENCONTROS, nome: 'Encontros aleatórios' }],
    personagens: [],
    relacoes: {},
    imagens: [],
    salas: { social: novaSala(), batalha: novaSala() },
    confrontos: [],
    log: [],
  };
  db.campaigns.push(c);
  save();
  return c;
}

function novaSala() {
  return { participantes: [], ativo: null, log: [] };
}

export function resumoCampanha(c) {
  const mestre = db.users.find(u => u.id === c.mestreId);
  return {
    id: c.id, nome: c.nome, aberta: c.aberta, nivel: c.nivel, maxJogadores: c.maxJogadores, sistema: idSistema(c.sistema),
    jogadores: c.jogadores.length, mestre: mestre?.name ?? '?', padraoMSA: c.padraoMSA,
  };
}

const nomeUsuario = id => db.users.find(u => u.id === id)?.name ?? null;

function fichaPublica(p) {
  return { id: p.id, tipo: p.tipo, nome: p.nome, classe: p.classe, especializacao: p.especializacao, profissao: p.profissao, nivel: p.nivel, foto: p.foto, donoId: p.donoId, dono: nomeUsuario(p.donoId) };
}

// O que cada pessoa enxerga da campanha. O mestre vê tudo; o jogador só o que é dele ou público.
export function visaoPara(c, user, area) {
  const comDono = p => ({ ...p, dono: nomeUsuario(p.donoId) });
  if (area === 'mestre') {
    return { ...c, sistema: idSistema(c.sistema), personagens: c.personagens.map(comDono), jogadoresNomes: c.jogadores.map(nomeUsuario), papel: 'mestre' };
  }
  const meus = new Set(c.personagens.filter(p => p.donoId === user.id).map(p => p.id));
  const emSala = new Set([...c.salas.social.participantes, ...c.salas.batalha.participantes]);
  const conhecidos = new Set();
  for (const id of meus) for (const alvo of Object.keys(c.relacoes[id] || {})) conhecidos.add(alvo);

  const personagens = c.personagens
    .filter(p => meus.has(p.id) || p.tipo === 'pj' || emSala.has(p.id) || conhecidos.has(p.id))
    .map(p => (meus.has(p.id) ? comDono(p) : fichaPublica(p)));

  return {
    id: c.id, nome: c.nome, nivel: c.nivel, padraoMSA: c.padraoMSA, pontos: c.pontos, aberta: c.aberta, sistema: idSistema(c.sistema),
    lojaAberta: c.lojaAberta, maxJogadores: c.maxJogadores, papel: 'jogador',
    lore: c.lore,
    personagens,
    relacoes: Object.fromEntries([...meus].map(id => [id, c.relacoes[id] || {}])),
    imagens: c.imagens.filter(i => i.mostrando),
    salas: Object.fromEntries(Object.entries(c.salas).map(([k, s]) => [k, { ...s, log: s.log.filter(e => !e.secreta) }])),
    log: c.log.filter(e => !e.secreta),
    confrontos: (c.confrontos || []).filter(x => !x.secreto),
  };
}

export function entrarNaCampanha(c, user, area) {
  if (area === 'mestre') {
    if (c.mestreId !== user.id) throw erro('Você não é o mestre desta campanha.');
    return;
  }
  if (c.mestreId === user.id) throw erro('Você é o mestre desta campanha — entre pela Área do Mestre.');
  if (!c.aberta) throw erro('Esta campanha está fechada pelo mestre.');
  if (!c.jogadores.includes(user.id)) {
    if (c.jogadores.length >= c.maxJogadores) throw erro('A campanha já atingiu o número máximo de jogadores.');
    c.jogadores.push(user.id);
    save();
  }
}

// ---------- utilitários ----------

function personagem(c, id) {
  const p = c.personagens.find(x => x.id === id);
  if (!p) throw erro('Personagem não encontrado.');
  return p;
}

function exigirMestre(ctx) {
  if (!ctx.mestre) throw erro('Apenas o mestre pode fazer isso.');
}

function exigirDonoOuMestre(ctx, p) {
  if (!ctx.mestre && p.donoId !== ctx.user.id) throw erro('Este personagem não é seu.');
}

function sala(c, nome) {
  const s = c.salas[nome];
  if (!s) throw erro('Sala desconhecida.');
  return s;
}

function registrar(lista, entrada) {
  lista.push({ id: uid(), em: Date.now(), ...entrada });
  if (lista.length > MAX_LOG) lista.splice(0, lista.length - MAX_LOG);
}

function itemDoCatalogo(itemId, sis) {
  const it = sis.itens.find(i => i.id === itemId);
  if (!it) throw erro('Item não existe no catálogo.');
  return { ...structuredClone(it), uid: uid(), itemId: it.id, equipado: false, durabilidadeAtual: it.durabilidade };
}

// O jogador não pode passar dos limites definidos pelo mestre (as mesmas regras da tela de criação).
function validarCriacao(c, p, sis) {
  if (c.nivel !== 'Variavel') p.nivel = c.nivel;
  p.nivel = Math.max(1, Math.min(20, parseInt(p.nivel, 10) || 1));
  const problemas = problemasFicha(p, sis, c);
  if (problemas.length) throw erro(problemas[0]);
  // Itens, dinheiro, PV e Sanidade são recalculados aqui, nunca confiando no navegador.
  const ini = sis.regras?.creditosIniciais ?? 0;
  const itens = (p.itens || []).map(i => itemDoCatalogo(i.itemId || i.id, sis));
  const custo = itens.reduce((s, i) => s + (i.preco || 0), 0);
  if (custo > ini) throw erro(`Os itens custam mais que os ${ini} ${sis.moeda || 'créditos'} iniciais.`);
  p.itens = itens;
  p.dinheiro = ini - custo;
  const d = derivados(p, sis);
  p.pv = { max: d.pvMax, atual: d.pvMax };
  p.sanidade = { max: d.sanidadeMax, atual: d.sanidadeMax };
  p.humanidade = { max: d.humanidadeMax, atual: d.humanidadeMax };
  p.xp = 0;
  p.marcadores = [];
}

// Valor da ação calculado no servidor a partir da ficha: "sub:<id>", "per:<id>" ou "atr:<sigla>".
function valorAcao(p, ref, sis) {
  const d = derivados(p, sis);
  const [tipo, id] = String(ref || '').split(/:(.*)/s);
  if (tipo === 'sub' && id in d.subpericias) {
    const per = sis.pericias.find(x => x.subpericias.some(y => y.id === id));
    return { valor: d.subpericias[id], nome: `${per.nome} › ${per.subpericias.find(y => y.id === id).nome}` };
  }
  if (tipo === 'per' && id in d.pericias) return { valor: d.pericias[id], nome: sis.pericias.find(x => x.id === id).nome };
  if (tipo === 'atr' && id in d.percentual) return { valor: d.percentual[id], nome: `${sis.atributos.find(a => a.sigla === id).nome}%` };
  throw erro('Escolha o que vai testar.');
}

function npcDeMonstro(c, m) {
  return {
    ...novaFicha(sistema(c.sistema), c), id: uid(), tipo: 'npc', grupoId: GRUPO_ENCONTROS, donoId: null,
    nome: m.nome, dificuldade: m.dificuldade, pv: { max: m.pv, atual: m.pv },
    anotacoes: `Ataque: ${m.ataque}\nDefesa: ${m.defesa}\n${m.descricao}`,
  };
}

const nomeStr = v => String(v ?? '').slice(0, 20000);

// Campos que um jogador pode alterar diretamente na própria ficha (o resto passa pelo mestre ou por ações específicas).
const CAMPOS_JOGADOR = new Set([
  'nome', 'idade', 'peso', 'altura', 'instinto', 'caracteristicas', 'background', 'anotacoes', 'origem', 'motivacao', 'familia',
  'foto', 'pv', 'sanidade', 'humanidade', 'marcadores',
]);
const CAMPOS_PROTEGIDOS = new Set(['id', 'tipo', 'donoId', 'backups']);

// ---------- ações ----------

export const acoes = {
  'campanha.atualizar'(c, d, ctx) {
    exigirMestre(ctx);
    for (const k of ['aberta', 'lojaAberta']) if (k in d) c[k] = !!d[k];
    for (const k of ['anotacoes', 'anotacoesResumo']) if (k in d) c[k] = nomeStr(d[k]);
    if ('nome' in d && String(d.nome).trim()) c.nome = String(d.nome).trim();
    // Trocar o sistema no meio da campanha: as fichas continuam; cálculos e regras passam a seguir o novo sistema.
    if ('sistema' in d && idSistema(d.sistema) !== idSistema(c.sistema)) {
      c.sistema = idSistema(d.sistema);
      registrar(c.log, { autor: 'Mestre', rotulo: 'Sistema de regras', texto: `A campanha agora usa o ${sistema(c.sistema).nome} (${sistema(c.sistema).nomeCompleto}).` });
    }
    if ('maxJogadores' in d) c.maxJogadores = Math.max(c.jogadores.length, Math.min(9, parseInt(d.maxJogadores, 10) || 1));
  },

  'jogador.remover'(c, { userId }, ctx) {
    exigirMestre(ctx);
    c.jogadores = c.jogadores.filter(id => id !== userId);
    for (const p of c.personagens) if (p.donoId === userId) p.donoId = null;
  },

  'lore.atualizar'(c, { background }, ctx) {
    exigirMestre(ctx);
    c.lore.background = nomeStr(background);
  },

  'lore.sessao.salvar'(c, d, ctx) {
    exigirMestre(ctx);
    const dados = { titulo: nomeStr(d.titulo) || 'Sessão', data: nomeStr(d.data), texto: nomeStr(d.texto) };
    const s = d.id && c.lore.sessoes.find(x => x.id === d.id);
    if (s) Object.assign(s, dados);
    else c.lore.sessoes.push({ id: uid(), ...dados });
  },

  'lore.sessao.remover'(c, { id }, ctx) {
    exigirMestre(ctx);
    c.lore.sessoes = c.lore.sessoes.filter(s => s.id !== id);
  },

  'grupo.criar'(c, { nome }, ctx) {
    exigirMestre(ctx);
    const g = { id: uid(), nome: String(nome || '').trim() || 'Novo grupo' };
    c.grupos.push(g);
    return g;
  },

  'grupo.renomear'(c, { id, nome }, ctx) {
    exigirMestre(ctx);
    const g = c.grupos.find(x => x.id === id);
    if (g && String(nome).trim()) g.nome = String(nome).trim();
  },

  'grupo.remover'(c, { id }, ctx) {
    exigirMestre(ctx);
    if (c.personagens.some(p => p.grupoId === id)) throw erro('Mova ou apague os NPCs do grupo antes.');
    c.grupos = c.grupos.filter(g => g.id !== id);
  },

  'personagem.criar'(c, { tipo, grupoId, ficha }, ctx) {
    const sis = sistema(c.sistema);
    const base = novaFicha(sis, c);
    if (!ctx.mestre) tipo = 'pj';
    if (!['pj', 'npc'].includes(tipo)) throw erro('Tipo inválido.');
    if (tipo === 'npc' && !c.grupos.some(g => g.id === grupoId)) throw erro('Escolha um grupo para o NPC.');
    const limpa = Object.fromEntries(Object.entries(ficha || {}).filter(([k]) => !CAMPOS_PROTEGIDOS.has(k)));
    const p = {
      ...base, ...limpa,
      id: uid(), tipo, grupoId: tipo === 'npc' ? grupoId : null,
      donoId: ctx.mestre ? null : ctx.user.id,
      backups: [],
    };
    p.nome = String(p.nome || '').trim() || (tipo === 'npc' ? 'NPC sem nome' : 'Personagem sem nome');
    if (!ctx.mestre) validarCriacao(c, p, sis);
    // Itens vindos do catálogo ganham identificador próprio.
    p.itens = (p.itens || []).map(i => ({ ...i, uid: i.uid || uid(), equipado: false }));
    c.personagens.push(p);
    return { id: p.id };
  },

  'personagem.atualizar'(c, { id, patch }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    for (const [k, v] of Object.entries(patch || {})) {
      if (CAMPOS_PROTEGIDOS.has(k)) continue;
      if (!ctx.mestre && !CAMPOS_JOGADOR.has(k)) continue;
      p[k] = v;
    }
  },

  'personagem.duplicar'(c, { id }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    const copia = { ...structuredClone(p), id: uid(), nome: `${p.nome} (cópia)`, donoId: null, backups: [] };
    c.personagens.push(copia);
  },

  'personagem.remover'(c, { id }, ctx) {
    exigirMestre(ctx);
    c.personagens = c.personagens.filter(p => p.id !== id);
    delete c.relacoes[id];
    for (const r of Object.values(c.relacoes)) delete r[id];
    for (const s of Object.values(c.salas)) {
      s.participantes = s.participantes.filter(x => x !== id);
      if (s.ativo === id) s.ativo = null;
    }
  },

  'personagem.assumir'(c, { id }, ctx) {
    const p = personagem(c, id);
    if (p.tipo !== 'pj') throw erro('Só personagens-jogador podem ser assumidos.');
    if (p.donoId) throw erro('Este personagem já tem dono.');
    p.donoId = ctx.user.id;
  },

  'personagem.liberar'(c, { id }, ctx) {
    exigirMestre(ctx);
    personagem(c, id).donoId = null;
  },

  'xp.dar'(c, { id, qtd }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    p.xp = Math.max(0, (p.xp || 0) + (parseInt(qtd, 10) || 0));
  },

  // Evoluir: salva um backup da ficha antiga e aplica a nova.
  'personagem.evoluir'(c, { id, patch, xpGasto }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const gasto = Math.max(0, parseInt(xpGasto, 10) || 0);
    if (gasto > (p.xp || 0)) throw erro('XP insuficiente.');
    const { backups, ...semBackups } = p;
    p.backups = [...(backups || []), { id: uid(), em: Date.now(), ficha: structuredClone(semBackups) }].slice(-MAX_BACKUPS);
    for (const k of ['nivel', 'classe', 'especializacao', 'escolhasClasse', 'atributos', 'pericias', 'subpericias', 'vantagens', 'defeitos', 'pv', 'sanidade', 'humanidade']) {
      if (k in (patch || {})) p[k] = patch[k];
    }
    p.xp -= gasto;
  },

  'backup.restaurar'(c, { id, backupId }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    const b = p.backups.find(x => x.id === backupId);
    if (!b) throw erro('Backup não encontrado.');
    const backups = p.backups;
    Object.assign(p, structuredClone(b.ficha), { id: p.id, donoId: p.donoId, backups });
  },

  'item.adicionar'(c, { id, itemId }, ctx) {
    exigirMestre(ctx);
    personagem(c, id).itens.push(itemDoCatalogo(itemId, sistema(c.sistema)));
  },

  'item.remover'(c, { id, uid: itemUid }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    p.itens = p.itens.filter(i => i.uid !== itemUid);
  },

  'item.durabilidade'(c, { id, uid: itemUid, valor }, ctx) {
    exigirMestre(ctx);
    const it = personagem(c, id).itens.find(i => i.uid === itemUid);
    if (it) it.durabilidadeAtual = Math.max(0, parseInt(valor, 10) || 0);
  },

  'item.equipar'(c, { id, uid: itemUid, equipar }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const it = p.itens.find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    if (!equipar) { it.equipado = false; return; }
    if (it.equipado) return;
    const r = podeEquipar(p, it, sistema(c.sistema));
    if (!r.ok) throw erro(r.motivo);
    it.equipado = true;
  },

  'item.comprar'(c, { id, itemId }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    if (!ctx.mestre && !c.lojaAberta) throw erro('A loja está fechada pelo mestre.');
    const it = itemDoCatalogo(itemId, sistema(c.sistema));
    if ((p.dinheiro || 0) < it.preco) throw erro('Dinheiro insuficiente.');
    p.dinheiro -= it.preco;
    p.itens.push(it);
  },

  'item.vender'(c, { id, uid: itemUid }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    if (!ctx.mestre && !c.lojaAberta) throw erro('A loja está fechada pelo mestre.');
    const it = p.itens.find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    p.itens = p.itens.filter(i => i !== it);
    p.dinheiro = (p.dinheiro || 0) + (it.venda || 0);
  },

  'relacao.definir'(c, { de, para, tipo, nota }, ctx) {
    const p = personagem(c, de);
    exigirDonoOuMestre(ctx, p);
    personagem(c, para);
    if (de === para) throw erro('Escolha outro personagem.');
    const atual = (c.relacoes[de] ||= {})[para] || {};
    const tipos = sistema(c.sistema).relacoes;
    const novo = { tipo: tipo !== undefined ? tipo : atual.tipo, nota: nota !== undefined ? nomeStr(nota) : atual.nota || '' };
    if (novo.tipo && !tipos.includes(novo.tipo)) throw erro('Tipo de relação inválido.');
    c.relacoes[de][para] = novo;
  },

  'relacao.remover'(c, { de, para }, ctx) {
    exigirDonoOuMestre(ctx, personagem(c, de));
    if (c.relacoes[de]) delete c.relacoes[de][para];
  },

  'imagem.mostrar'(c, { id, mostrando }, ctx) {
    exigirMestre(ctx);
    const img = c.imagens.find(i => i.id === id);
    if (img) img.mostrando = !!mostrando;
  },

  'imagem.remover'(c, { id }, ctx) {
    exigirMestre(ctx);
    c.imagens = c.imagens.filter(i => i.id !== id);
  },

  'sala.adicionar'(c, { sala: nome, id }, ctx) {
    const s = sala(c, nome);
    const p = personagem(c, id);
    if (!ctx.mestre) exigirDonoOuMestre(ctx, p);
    if (s.participantes.includes(id)) return;
    if (s.participantes.length >= LIMITE_SALA) throw erro(`A sala já tem ${LIMITE_SALA} integrantes.`);
    s.participantes.push(id);
  },

  'sala.remover'(c, { sala: nome, id }, ctx) {
    const s = sala(c, nome);
    if (!ctx.mestre) exigirDonoOuMestre(ctx, personagem(c, id));
    s.participantes = s.participantes.filter(x => x !== id);
    if (s.ativo === id) s.ativo = null;
  },

  'sala.acionar'(c, { sala: nome, id }, ctx) {
    exigirMestre(ctx);
    const s = sala(c, nome);
    s.ativo = s.ativo === id ? null : id;
  },

  'sala.ordenar'(c, { sala: nome, id, direcao }, ctx) {
    exigirMestre(ctx);
    const s = sala(c, nome);
    const i = s.participantes.indexOf(id);
    const j = i + (direcao < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= s.participantes.length) return;
    [s.participantes[i], s.participantes[j]] = [s.participantes[j], s.participantes[i]];
  },

  'sala.limpar'(c, { sala: nome }, ctx) {
    exigirMestre(ctx);
    c.salas[nome] = novaSala();
  },

  'pv.alterar'(c, { id, delta }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    p.pv.atual = Math.min(p.pv.max, Math.max(-p.pv.max, p.pv.atual + (parseInt(delta, 10) || 0)));
  },

  // Rolagens acontecem no servidor para todos verem o mesmo resultado.
  // Rolagens acontecem no servidor para todos verem o mesmo resultado.
  // Teste D-MIL: { acaoRef | acao, mod, nd, metade }. Iniciativa: { tipo: 'iniciativa' }. Livre: { dado: '2d6' }.
  'rolar'(c, { sala: nome, id, rotulo, tipo, acaoRef, acao, mod, nd, metade, dado, secreta }, ctx) {
    const sis = sistema(c.sistema);
    let autor = ctx.mestre ? 'Mestre' : ctx.user.name;
    let p = null;
    if (id) {
      p = personagem(c, id);
      exigirDonoOuMestre(ctx, p);
      autor = p.nome;
    }
    const base = { autor, secreta: !!(ctx.mestre && secreta) };
    let entrada;
    if (tipo === 'iniciativa') {
      const r = rolarDado('1d10');
      const agi = p ? derivados(p, sis).iniciativa : 0;
      entrada = { ...base, tipo: 'iniciativa', rotulo: 'Iniciativa', dado: '1d10', dados: r.dados, mod: 0, componentes: [{ nome: 'AGI', valor: agi }], total: r.total + agi };
    } else if (tipo === 'atributos') {
      if (!sis.regras.rolagemAtributos) throw erro(`O ${sis.nome} não tem rolagem de atributos.`);
      const r = rolarAtributosCriacao(sis);
      entrada = { ...base, tipo: 'atributos', rotulo: 'Atributos (rolagem da criação)', valores: r.valores, total: r.soma, rerolagens: r.rerolagens };
    } else if (dado) {
      const r = rolarDado(dado);
      entrada = { ...base, rotulo: String(rotulo || dado).slice(0, 80), dado: r.expr, dados: r.dados, mod: r.mod, componentes: [], total: r.total };
    } else {
      const a = acaoRef && p ? valorAcao(p, acaoRef, sis) : { valor: parseInt(acao, 10) || 0, nome: String(rotulo || 'Teste').slice(0, 80) };
      const modificador = Math.max(-100, Math.min(100, parseInt(mod, 10) || 0));
      const ndNum = nd === '' || nd == null ? null : Math.max(0, parseInt(nd, 10) || 0);
      const r = testeDMil(a.valor + modificador, ndNum, sis, { metade: !!metade });
      entrada = { ...base, tipo: 'dmil', rotulo: String(rotulo || a.nome).slice(0, 80), acaoNome: a.nome, mod: modificador, metade: !!metade, ...r };
    }
    if (nome && c.salas[nome]) registrar(c.salas[nome].log, entrada);
    else registrar(c.log, entrada);
    return entrada;
  },

  // ---------- Confronto (Ação × Ação, fora do combate) ----------
  'confronto.criar'(c, { titulo, modo, a, b, secreto }, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    if (!['passiva', 'disputa'].includes(modo)) throw erro('Escolha o tipo de confronto.');
    const lado = (l, rotulo) => {
      const id = l?.personagemId || null;
      const p = id ? personagem(c, id) : null;
      if (p && !l.acaoRef) throw erro(`Escolha a ação do ${rotulo}.`);
      const acaoNome = p ? valorAcao(p, l.acaoRef, sis).nome : String(l?.acaoNome || 'Ação').slice(0, 60);
      return {
        personagemId: id, nome: p ? p.nome : String(l?.nome || rotulo).slice(0, 60), acaoRef: p ? l.acaoRef : null, acaoNome,
        valor: p ? null : Math.max(0, parseInt(l?.valor, 10) || 0), mod: Math.max(-100, Math.min(100, parseInt(l?.mod, 10) || 0)),
      };
    };
    const conf = {
      id: uid(), titulo: String(titulo || '').trim().slice(0, 80) || 'Confronto', modo, secreto: !!secreto,
      criadoEm: Date.now(), estado: 'aberto', lados: { a: lado(a, 'lado A'), b: lado(b, 'lado B') }, rolagens: { a: null, b: null }, resultado: null,
    };
    (c.confrontos ||= []).unshift(conf);
    if (c.confrontos.length > 50) c.confrontos.length = 50;
    return { id: conf.id };
  },

  'confronto.rolar'(c, { id, lado }, ctx) {
    const sis = sistema(c.sistema);
    const conf = (c.confrontos || []).find(x => x.id === id);
    if (!conf) throw erro('Confronto não encontrado.');
    if (conf.estado !== 'aberto') throw erro('Este confronto já foi resolvido.');
    if (!['a', 'b'].includes(lado)) throw erro('Lado inválido.');
    if (conf.modo === 'passiva' && lado === 'b') throw erro('No confronto contra ação passiva só o lado A rola.');
    if (conf.rolagens[lado]) throw erro('Esse lado já rolou.');
    const L = conf.lados[lado];
    const p = L.personagemId ? c.personagens.find(x => x.id === L.personagemId) : null;
    if (!ctx.mestre && (!p || p.donoId !== ctx.user.id)) throw erro('Só o dono do personagem (ou o mestre) rola este lado.');
    const valorDe = (Lx) => {
      const px = Lx.personagemId ? c.personagens.find(x => x.id === Lx.personagemId) : null;
      return (px ? valorAcao(px, Lx.acaoRef, sis).valor : Lx.valor) + (Lx.mod || 0);
    };
    let nd = null;
    if (conf.modo === 'passiva') nd = valorDe(conf.lados.b) + (sis.teste.passiva?.soma ?? 50);
    const r = testeDMil(valorDe(L), nd, sis);
    conf.rolagens[lado] = { ...r, em: Date.now() };
    // Resolve quando possível.
    const ra = conf.rolagens.a;
    const rb = conf.rolagens.b;
    if (conf.modo === 'passiva') {
      conf.resultado = { vencedor: ra.sucesso ? 'a' : 'b', texto: `${conf.lados.a.nome} ${ra.sucesso ? 'vence' : 'perde'} (${ra.total} contra passiva ${nd})${ra.critico ? ` — crítico de ${ra.critico}` : ''}` };
    } else if (ra && rb) {
      // Provisório: maior total vence; empate decide pela maior ação; persistindo, empate.
      let vencedor = ra.total > rb.total ? 'a' : rb.total > ra.total ? 'b' : ra.acao > rb.acao ? 'a' : rb.acao > ra.acao ? 'b' : 'empate';
      if (ra.critico === 'acerto' && rb.critico !== 'acerto') vencedor = 'a';
      else if (rb.critico === 'acerto' && ra.critico !== 'acerto') vencedor = 'b';
      conf.resultado = { vencedor, texto: vencedor === 'empate' ? `Empate (${ra.total} × ${rb.total})` : `${conf.lados[vencedor].nome} vence (${ra.total} × ${rb.total})` };
    }
    if (conf.resultado) {
      conf.estado = 'resolvido';
      registrar(c.log, { autor: 'Confronto', rotulo: conf.titulo, texto: conf.resultado.texto, secreta: conf.secreto });
    }
    return conf;
  },

  'confronto.reabrir'(c, { id }, ctx) {
    exigirMestre(ctx);
    const conf = (c.confrontos || []).find(x => x.id === id);
    if (conf) Object.assign(conf, { estado: 'aberto', rolagens: { a: null, b: null }, resultado: null });
  },

  'confronto.remover'(c, { id }, ctx) {
    exigirMestre(ctx);
    c.confrontos = (c.confrontos || []).filter(x => x.id !== id);
  },

  'monstro.adicionar'(c, { nome }, ctx) {
    exigirMestre(ctx);
    const m = sistema(c.sistema).monstros.find(x => x.nome === nome);
    if (!m) throw erro('Criatura não encontrada.');
    const s = c.salas.batalha;
    if (s.participantes.length >= LIMITE_SALA) throw erro('O Campo de Batalha está cheio.');
    const p = npcDeMonstro(c, m);
    c.personagens.push(p);
    s.participantes.push(p.id);
  },

  'encontro.gerar'(c, { limite, usarMonstros, grupos }, ctx) {
    exigirMestre(ctx);
    limite = Math.max(1, parseInt(limite, 10) || 1);
    const candidatos = [];
    if (usarMonstros) for (const m of sistema(c.sistema).monstros) candidatos.push({ origem: 'monstro', dificuldade: m.dificuldade, m });
    for (const p of c.personagens) {
      if (p.tipo === 'npc' && p.grupoId !== GRUPO_ENCONTROS && (grupos || []).includes(p.grupoId)) {
        candidatos.push({ origem: 'npc', dificuldade: p.dificuldade || p.nivel || 1, p });
      }
    }
    if (!candidatos.length) throw erro('Escolha o Livro dos Monstros e/ou algum grupo de NPCs.');
    const s = c.salas.batalha;
    const vagas = LIMITE_SALA - s.participantes.length;
    if (vagas <= 0) throw erro('O Campo de Batalha está cheio.');
    const { escolhidos, soma } = gerarEncontro(candidatos, limite, Math.random, vagas);
    if (!escolhidos.length) throw erro('Nenhuma criatura cabe nesse limite de dificuldade.');
    const nomes = [];
    for (const e of escolhidos) {
      let p;
      if (e.origem === 'npc') {
        p = { ...structuredClone(e.p), id: uid(), grupoId: GRUPO_ENCONTROS, backups: [] };
      } else {
        p = npcDeMonstro(c, e.m);
      }
      c.personagens.push(p);
      s.participantes.push(p.id);
      nomes.push(p.nome);
    }
    registrar(s.log, { autor: 'Mestre', rotulo: `Encontro aleatório (dificuldade ${soma}/${limite})`, texto: nomes.join(', ') });
    return { nomes, soma };
  },
};

export function executar(c, tipo, dados, ctx) {
  const fn = acoes[tipo];
  if (!fn) throw erro(`Ação desconhecida: ${tipo}`);
  const r = fn(c, dados || {}, ctx);
  save();
  return r;
}
