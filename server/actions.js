import { db, save, uid } from './db.js';
import { imagemDeLink } from '../shared/imagens.js';
import { sistema, idSistema } from './sistema.js';
import { resolverAtaque, aplicarAtaque, armasDisponiveis, opcoesDefesa, sobrevida, rolarIniciativa, resolverManipulacao, modHumorTestes, humorDe, espectroDe, humorAparente, empatiaNatural, liberdadeDeHumor, modoRolagem, modoHumorTeste, recursoDe, gastarRecurso, racaDe, distanciaPecas, usosRestantes, gastarUso, testeContra, ipContra } from '../shared/combate.js';
import { sincronizarEfeitos, passarTurnoEfeitos, efeitosAoAgir, cargaNoTurno, descansar } from '../shared/efeitos.js';
import { fichasDeTeste, relatorioFicha, kitDeTeste, periciasDeTeste } from '../shared/fichasTeste.js';
import { monstroNoEstagio, textoDeslocamentos, textoND, ladoNoMapa } from '../shared/monstros.js';
import { sortearEncontro, cenarioSemIA } from '../shared/encontro.js';
import { FORMAS_AREA, quadradosDaArea, atingidosPelaArea } from '../shared/area.js';
import { TIPOS_OBJETO, tipoObjeto, coberturaPeloMapa, foraDaVisaoDosPJs, bloqueadoPorObjeto } from '../shared/objetosMapa.js';
import { passarNecessidades, comer, beber, dormir, rolarCaos, climaDoDia, descreverRelogio, fimDoCombate } from '../shared/tempo.js';
import { podeSeduzir, itemAberto, itemVisivel, xpParaSubir, novaFicha, podeEquipar, rolarDado, rolarAtributosCriacao, testeDMil, gerarEncontro, derivados, problemasFicha, LIMITE_SALA, desgastarItem, repararItem, durabilidadeDe, listaHabilidades, vantagemPorHabilidade, temHabilidade, regraDaHabilidade, tipoCriatura, chaveHabilidade, TIPOS_ACAO, nomeAcao, acoesDaHabilidade, dadosDaHabilidade, ehAtaqueEspecial, acaoDoAtaqueEspecial, perderPv, textoPv, duracaoDaHabilidade, podeRepetir, textoDuracao } from '../shared/regras.js';

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
    aberta: false, lojaAberta: false, dadosNaTela: true, criadaEm: Date.now(),
    jogadores: [],
    lore: { background: '', sessoes: [] },
    anotacoes: '', anotacoesResumo: '',
    grupos: [{ id: GRUPO_ENCONTROS, nome: 'Encontros aleatórios' }],
    personagens: [],
    relacoes: {},
    imagens: [],
    mapa: novoMapa(),
    suportes: [],
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

function fichaPublica(p, sis) {
  return { id: p.id, tipo: p.tipo, nome: p.nome, classe: p.classe, especializacao: p.especializacao, profissao: p.profissao, nivel: p.nivel, foto: p.foto, humor: humorAparente(p), criatura: !!p.criatura, donoId: p.donoId, dono: nomeUsuario(p.donoId), genero: p.genero || '', atracao: p.atracao,
    // Tamanho se vê de fora: o peão no mapa ocupa os quadrados dele (Grande 2×2…), também para jogadores e Suporte.
    tamanho: p.tamanho || '',
    // Efeitos que se veem de fora (sangrando, caído, aturdido…), com a contagem de turnos.
    semPv: !!p.pv && p.pv.atual <= 0,
    ...efeitosPublicos(p, sis) };
}

const GRUPOS_VISIVEIS = new Set(['Dano', 'Mobilidade', 'Estado']);
function efeitosPublicos(p, sis) {
  if (!sis || !(p.marcadores || []).length) return {};
  const visivel = m => (sis.condicoes || []).some(x => GRUPOS_VISIVEIS.has(x.grupo) && String(m).toLowerCase().startsWith(x.nome.toLowerCase()));
  const marcadores = p.marcadores.filter(visivel);
  return marcadores.length ? { marcadores, efeitos: p.efeitos } : {};
}

// O que cada pessoa enxerga da campanha. O mestre vê tudo; o jogador só o que é dele ou público.
export function visaoPara(c, user, area) {
  const comDono = p => ({ ...p, dono: nomeUsuario(p.donoId) });
  const mapa = mapaPublico(c, area);
  if (area === 'mestre') {
    return { ...c, mapa, sistema: idSistema(c.sistema), personagens: c.personagens.map(comDono), jogadoresNomes: c.jogadores.map(nomeUsuario),
      suportesNomes: (c.suportes || []).map(id => ({ id, nome: nomeUsuario(id) })), papel: 'mestre' };
  }
  // Suporte: só o que ele apresenta — o mapa (com os personagens que estão nele) e as imagens liberadas pelo mestre.
  if (area === 'suporte') {
    const noMapa = new Set(Object.keys(mapa.pecas));
    return {
      id: c.id, nome: c.nome, sistema: idSistema(c.sistema), aberta: c.aberta, papel: 'suporte', mapa,
      personagens: c.personagens.filter(p => noMapa.has(p.id)).map(p => fichaPublica(p, sistema(c.sistema))),
      imagens: c.imagens.filter(i => i.suporte), salas: { social: { participantes: [], log: [] }, batalha: { participantes: [], log: [] } }, log: [], relacoes: {},
    };
  }
  const meus = new Set(c.personagens.filter(p => p.donoId === user.id).map(p => p.id));
  const emSala = new Set([...c.salas.social.participantes, ...c.salas.batalha.participantes, ...Object.keys(mapa.pecas)]);
  const conhecidos = new Set();
  for (const id of meus) for (const alvo of Object.keys(c.relacoes[id] || {})) conhecidos.add(alvo);

  const personagens = c.personagens
    .filter(p => meus.has(p.id) || p.tipo === 'pj' || emSala.has(p.id) || conhecidos.has(p.id))
    .map(p => (meus.has(p.id) ? { ...comDono(p), humorOpcoes: [] } : fichaPublica(p, sistema(c.sistema))));

  return {
    id: c.id, nome: c.nome, nivel: c.nivel, padraoMSA: c.padraoMSA, pontos: c.pontos, aberta: c.aberta, sistema: idSistema(c.sistema),
    lojaAberta: c.lojaAberta, dadosNaTela: c.dadosNaTela !== false, itensRarosVisiveis: !!c.itensRarosVisiveis, itensLiberados: c.itensLiberados || [], maxJogadores: c.maxJogadores, papel: 'jogador',
    lore: c.lore,
    relogio: c.relogio || { horas: 0 }, clima: c.clima || null,
    personagens,
    relacoes: Object.fromEntries([...meus].map(id => [id, c.relacoes[id] || {}])),
    imagens: c.imagens.filter(i => i.mostrando),
    mapa,
    salas: Object.fromEntries(Object.entries(c.salas).map(([k, s]) => [k, { ...s, log: s.log.filter(e => !e.secreta && (!e.privadoPara || e.privadoPara === user.id)) }])),
    log: c.log.filter(e => !e.secreta),
    confrontos: (c.confrontos || []).filter(x => !x.secreto),
  };
}

export const podeSuporte = (c, user) => c.mestreId === user.id || (c.suportes || []).includes(user.id);

export function entrarNaCampanha(c, user, area) {
  if (area === 'mestre') {
    if (c.mestreId !== user.id) throw erro('Você não é o mestre desta campanha.');
    return;
  }
  if (area === 'suporte') {
    if (!podeSuporte(c, user)) throw erro('O mestre não liberou o Suporte desta campanha para a sua conta.');
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

// ---------- Mapa ----------
// Imagem, GIF ou vídeo escolhido pelo mestre, com a grade de 1,5 m por quadrado por cima e os peões dos personagens.
// grade.colunas = quantos quadrados cabem na largura do mapa (o mestre aumenta/diminui); ox/oy deslocam a grade (fração de quadrado).
function novoMapa() {
  return { imagemId: null, grade: { colunas: 20, ox: 0, oy: 0, visivel: true }, pecas: {} };
}

// Primeiro lugar livre no mapa para um peão de lado×lado quadrados (criatura grande ocupa 2×2 ou 3×3), linha a linha.
function lugarLivre(c, lado = 1, ignorar = null) {
  const ocupado = new Set();
  for (const [id, x] of Object.entries(c.mapa?.pecas || {})) {
    if (id === ignorar) continue;
    const l = ladoNoMapa(c.personagens.find(p => p.id === id));
    for (let i = 0; i < l; i++) for (let j = 0; j < l; j++) ocupado.add(`${x.col + i}:${x.lin + j}`);
  }
  const colunas = Math.max(lado, c.mapa?.grade?.colunas || 20);
  for (let lin = 0; lin < 999; lin++) {
    for (let col = 0; col + lado <= colunas; col++) {
      let cabe = true;
      for (let i = 0; i < lado && cabe; i++) for (let j = 0; j < lado && cabe; j++) if (ocupado.has(`${col + i}:${lin + j}`)) cabe = false;
      if (cabe) return { col, lin };
    }
  }
  return { col: 0, lin: 0 };
}
// Quem entra no Campo de Batalha vai sozinho para o mapa (se o mestre já escolheu um mapa), no primeiro lugar livre.
function porNoMapa(c, p) {
  if (!c.mapa?.imagemId || c.mapa.pecas?.[p.id]) return;
  c.mapa.pecas[p.id] = lugarLivre(c, ladoNoMapa(p));
}

// Só o mestre vê as marcações secretas (armadilhas…) e os peões ocultos (NPC fantasma); jogadores e Suporte não recebem nada deles.
function mapaPublico(c, area) {
  c.mapa ||= novoMapa();
  const mestre = area === 'mestre';
  const img = c.imagens.find(i => i.id === c.mapa.imagemId);
  const vivos = Object.fromEntries(Object.entries(c.mapa.pecas)
    .filter(([id, x]) => c.personagens.some(p => p.id === id) && (mestre || !x.oculto)));
  // Objetos no mapa (armadilhas, coberturas, objetos…): os ocultos só o mestre vê.
  return { ...c.mapa, pecas: vivos, marcas: mestre ? (c.mapa.marcas || []) : [], objetos: (c.mapa.objetos || []).filter(o => mestre || !o.oculto), midia: img ? { url: img.url, tipo: img.tipo || 'imagem', titulo: img.titulo } : null };
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
  // Humanidade abaixo de 1: o jogador perde o controle do personagem (só o mestre age por ele).
  if (!ctx.mestre && p.humanidade && p.humanidade.atual < 1) throw erro(`${p.nome} perdeu a Humanidade: agora só o mestre controla este personagem.`);
}

// PV, Sanidade e Humanidade máximos seguem as fórmulas; o valor atual acompanha a diferença (o dano sofrido continua).
const CAMPOS_FORMULA = ['atributos', 'nivel', 'profissao', 'itens'];
function recalcularMaximos(p, sis) {
  const d = derivados(p, sis);
  for (const [k, novo] of [['pv', d.pvMax], ['sanidade', d.sanidadeMax], ['humanidade', d.humanidadeMax]]) {
    const t = p[k];
    if (!t) { p[k] = { max: novo, atual: novo }; continue; }
    if (t.max === novo) continue;
    t.atual = k === 'humanidade' ? Math.min(novo, t.atual) : t.atual + (novo - t.max);
    t.max = novo;
  }
}

// Clima: um novo dia confere o caos meteorológico (1d6 enquanto estável; 1 = muda; acabou a estabilidade = relança).
const textoClima = k => `${k.nome}${k.intempere ? ' (intempérie)' : ''}: ${k.texto} Estável por ${k.dias} dia(s). [2d20: ${k.dados.join(', ')}]`;
function novoDiaClima(c) {
  if (!c.clima) return null;
  const r = climaDoDia(c.clima);
  c.clima = { ...r.clima, desde: r.mudou ? c.relogio.horas : c.clima.desde };
  registrar(c.log, { autor: 'Mestre', rotulo: `Clima — ${descreverRelogio(c.relogio.horas)}`,
    texto: r.mudou ? `${r.motivo}. ${textoClima(c.clima)}` : `1d6 = ${r.d6}: o tempo segue ${c.clima.nome.toLowerCase()} (mais ${c.clima.dias} dia(s)).` });
  return c.clima;
}

// Habilidades que mudam o descanso só em certas situações: o app lembra o mestre (as outras já são automáticas).
const LEMBRETES_DESCANSO = [
  [/habitat magn[ií]fico/i, 'Habitat magnífico: +2 PV por dado em terreno natural', 'longo'],
  [/liga[cç][aã]o natural/i, 'Ligação natural: avança o dado de regeneração dormindo na natureza', 'longo'],
];
function lembretesDescanso(p, sis, tipo) {
  const nomes = [...listaHabilidades(p, sis).map(x => x.nome), ...(p.defeitos || []).map(id => sis.defeitos?.find(d => d.id === id)?.nome || id)].join(' | ');
  return LEMBRETES_DESCANSO.filter(([re, , so]) => re.test(nomes) && (!so || so === tipo)).map(([, txt]) => `lembrete: ${txt}`);
}

// Ajustes de dados quando uma regra muda (cada um roda uma vez por campanha).
// pv-for-cons: o PV passou a ser FOR + CONS no 1º nível, +5 por nível. Mantém o dano já tomado.
// durabilidade-consumiveis: itens "C"/"AC" deixam de ter durabilidade 1.
export function migrarCampanhas() {
  let mudou = false;
  for (const c of db.campaigns) {
    c.migracoes ||= [];
    if (!c.migracoes.includes('pv-for-cons')) {
      const sis = sistema(c.sistema);
      for (const p of c.personagens) {
        if (!p.atributos || !p.pv) continue;
        const novo = derivados(p, sis).pvMax;
        if (novo === p.pv.max) continue;
        const delta = novo - p.pv.max;
        p.pv = { ...p.pv, max: novo, atual: p.pv.atual + delta };
      }
      c.migracoes.push('pv-for-cons');
      mudou = true;
    }
    // Durabilidade "C" (consumível) e "AC" (autoconsumível) tinham virado 1 nos itens dos personagens.
    if (!c.migracoes.includes('durabilidade-consumiveis')) {
      for (const p of c.personagens) for (const i of p.itens || []) {
        const v = String(i.planilha?.Durabilidade ?? '').trim().toUpperCase();
        if (v === 'C') Object.assign(i, { durabilidade: null, durabilidadeAtual: null, consumivel: true });
        else if (v === 'AC') Object.assign(i, { durabilidade: null, durabilidadeAtual: null, autoConsumivel: true });
      }
      c.migracoes.push('durabilidade-consumiveis');
      mudou = true;
    }
  }
  if (mudou) save();
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
  const novo = { ...structuredClone(it), uid: uid(), itemId: it.id, equipado: false, durabilidadeAtual: it.durabilidade };
  if (it.capacidade) novo.carregada = it.capacidade; // arma de fogo vem carregada
  return novo;
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
  // Créditos iniciais não compram itens raros ou mais (planilha de regras gerais).
  const raro = itens.find(i => !itemAberto(i));
  if (raro) throw erro(`${raro.nome} é ${raro.raridade.toLowerCase()}: não dá para comprar na criação.`);
  const custo = itens.reduce((s, i) => s + (i.preco || 0), 0);
  if (custo > ini) throw erro(`Os itens custam mais que os ${ini} ${sis.moeda || 'créditos'} iniciais.`);
  p.itens = itens;
  p.dinheiro = ini - custo;
  const d = derivados(p, sis);
  p.pv = { max: d.pvMax, atual: d.pvMax };
  p.sanidade = { max: d.sanidadeMax, atual: d.sanidadeMax };
  // Humanidade inicial escolhida pelo jogador entre 51 e o limite (já conferido em problemasFicha).
  const hum = parseInt(p.humanidade?.atual, 10);
  p.humanidade = { max: d.humanidadeMax, atual: Number.isFinite(hum) ? Math.max(d.humanidadeMinInicial, Math.min(d.humanidadeLimite, hum)) : d.humanidadeLimite };
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

// Imagem do monstro: a que o mestre pôs na campanha (arquivo enviado ou link) ou a da planilha (link).
export const imagemDoMonstro = (c, m) => (m.estagio != null ? imagemDeLink(m.imagem) : null) || c.imagensMonstros?.[m.nome] || imagemDeLink(m.imagem) || null;

// Monstro do Livro dos Monstros vira um NPC com ficha de combate: atributos e perícias (as defesas saem daí, como no
// personagem), ataques naturais (armas equipadas), IP, resistências, habilidades próprias e o saque no inventário.
// Monstro não tem Sanidade nem Humanidade.
// Com estágios, o monstro entra no estágio pedido (PV, atributos, deslocamentos, ataques e habilidades daquele estágio).
function npcDeMonstro(c, base, estagio = null) {
  const sis = sistema(c.sistema);
  const m = monstroNoEstagio(base, estagio);
  const f = novaFicha(sis, c);
  const p = {
    ...f, id: uid(), tipo: 'npc', grupoId: GRUPO_ENCONTROS, donoId: null, criatura: true,
    nome: m.nome, nivel: m.nivel || 1, dificuldade: m.dificuldade, xp: m.xp || 0, foto: imagemDoMonstro(c, m) || imagemDoMonstro(c, base) || '',
    monstro: { nome: base.nome, estagio: m.estagio ?? null, nomeEstagio: m.nomeEstagio || null }, deslocamentos: m.deslocamentos,
    raca: m.raca || '', tipoCriatura: m.tipoCriatura || 'monstro', tamanho: m.tamanho || '', afinidades: [...(m.afinidades || [])].slice(0, 2),
    atributos: { ...f.atributos, ...(m.atributos || {}) }, pericias: { ...(m.pericias || {}) }, subpericias: { ...(m.subpericias || {}) },
    ipExtra: m.ipGeral ?? m.defesa ?? 0, ipTipos: { ...(m.ipTipos || {}) },
    resistencias: [...(m.resistencias || [])], imunidades: [...(m.imunidades || [])], vulnerabilidades: [...(m.vulnerabilidades || [])],
    habilidadesProprias: (m.habilidades || []).map(x => ({ ...x })),
    ...(m.deslocamento ? { deslocamentoBase: m.deslocamento } : {}),
    anotacoes: [
      m.comportamento ? `Comportamento: ${m.comportamento}` : '', m.sentidos ? `Sentidos: ${m.sentidos}` : '',
      m.deslocamentos && Object.keys(m.deslocamentos).length ? `Deslocamentos: ${textoDeslocamentos(m.deslocamentos)}` : '',
      m.outrosDeslocamentos ? `Deslocamentos (obs.): ${m.outrosDeslocamentos}` : '', m.habitat ? `Onde aparece: ${m.habitat}` : '',
      m.descricaoEstagio ? `${m.nomeEstagio}: ${m.descricaoEstagio}` : '',
      !m.ataques?.length && m.ataque ? `Ataque: ${m.ataque}` : '', m.descricao || '',
    ].filter(Boolean).join('\n'),
  };
  delete p.sanidade;
  delete p.humanidade;
  const naturais = (m.ataques?.length ? m.ataques : m.ataque ? [{ nome: m.ataque.replace(/\s*\d*d\d.*$/i, '') || 'Ataque', dano: /\d*d\d+(?:[+-]\d+)?/i.exec(m.ataque)?.[0] || '1d4' }] : [])
    .map(a => ({ uid: uid(), nome: a.nome, tipo: 'arma', natural: true, equipado: true, dano: a.dano, pericia: a.pericia || 'briga.ataque-desarmado',
      ...(a.acerto != null ? { acerto: a.acerto } : {}), tipoDano: a.tipoDano || 'Físico', alcance: a.alcance || 'corpo',
      ...(a.alcanceM ? { alcanceM: a.alcanceM } : {}), ...(a.cadencia ? { cadencia: a.cadencia } : {}), ...(a.efeitoDano != null ? { efeitoDano: a.efeitoDano } : {}),
      ...(a.penetracao ? { penetracao: a.penetracao } : {}), ...(a.obs ? { descricao: a.obs } : {}) }));
  const saque = (m.saque || []).map(ref => sis.itens.find(i => i.id === ref || i.nome.toLowerCase() === String(ref).toLowerCase())).filter(Boolean)
    .map(it => ({ ...structuredClone(it), uid: uid(), itemId: it.id, equipado: false, durabilidadeAtual: it.durabilidade }));
  p.itens = [...naturais, ...saque];
  const pv = m.pv ?? derivados(p, sis).pvMax;
  p.pv = { max: pv, atual: pv };
  return p;
}

const nomeStr = v => String(v ?? '').slice(0, 20000);
// Endereço de imagem aceito: arquivo do app (/uploads, /img, avatares) ou link http(s) (Drive vira o endereço da imagem).
function imagemSegura(v) {
  const t = String(v ?? '').trim().slice(0, 2000);
  if (!t) return '';
  if (/^\/[\w./-]+$/.test(t) && !t.includes('..')) return t;
  const url = imagemDeLink(t);
  if (!url) throw erro('Imagem inválida: envie um arquivo ou cole um link https://');
  return url;
}

// Campos que um jogador pode alterar diretamente na própria ficha (o resto passa pelo mestre ou por ações específicas).
const CAMPOS_JOGADOR = new Set([
  'nome', 'idade', 'peso', 'altura', 'instinto', 'caracteristicas', 'background', 'anotacoes', 'origem', 'motivacao', 'familia',
  'foto', 'imagemCorpo', 'pv', 'sanidade', 'humanidade', 'marcadores', 'ativas',
]);
const CAMPOS_PROTEGIDOS = new Set(['id', 'tipo', 'donoId', 'backups']);

// ---------- combate (MSS) ----------

function exigirModulo(sis, modulo) {
  if (!sis.modulos?.[modulo]) {
    throw erro(`As regras ${modulo === 'combate' ? 'de combate' : 'sociais'} automáticas ainda não existem no ${sis.nome}. Use os testes livres.`);
  }
}

function ordenarIniciativa(cb) {
  cb.ordem.sort((a, b) => b.ini - a.ini || b.agi - a.agi);
}

// Quem está no campo além do personagem (para habilidades que dependem do tipo de criatura dos oponentes).
const oponentesDe = (c, s, p) => s.participantes.filter(id => id !== p.id).map(id => c.personagens.find(x => x.id === id)).filter(Boolean);

function entrarNoCombate(c, s, p) {
  if (s.combate.ordem.some(o => o.id === p.id)) return;
  const sis = sistema(c.sistema);
  const atual = s.combate.ordem[s.combate.vez]?.id;
  const r = rolarIniciativa(p, sis, Math.random, oponentesDe(c, s, p));
  s.combate.ordem.push({ id: p.id, ini: r.total, agi: r.agi });
  p.emCombate = true;
  ordenarIniciativa(s.combate);
  s.combate.vez = Math.max(0, s.combate.ordem.findIndex(o => o.id === atual));
  registrar(s.log, { autor: p.nome, rotulo: `${p.nome} entrou no combate`, texto: `iniciativa ${r.total}` });
}

// Fim do combate para um personagem: as Necessidades voltam e ele faz o teste de CONS difícil (livro).
// Habilidades ativadas que duram o combate (Essência monstruosa, PV temporários da Carga de Emergência…) acabam.
function encerrarAtivacoes(c, p, sis, soCombate = true) {
  if (!p) return;
  const fim = [];
  for (const [id, a] of Object.entries(p.habAtivas || {})) {
    if (soCombate && !a.combate && !a.turnos) continue;
    if (a.humorAntes && p.humor === a.humor) p.humor = a.humorAntes;
    delete p.habAtivas[id];
    p.ativas = (p.ativas || []).filter(x => x !== id);
    fim.push(a.nome || id);
  }
  if (p.essencia) { fim.push(`Essência (${p.essencia.sigla})`); delete p.essencia; }
  if (p.pvTemp) { delete p.pvTemp; fim.push('PV temporários'); }
  if (p.onusCivilizado) fim.push('ônus de Civilizados');
  for (const k of ['atacouNoCombate', 'passouCivilizado', 'onusCivilizado']) delete p[k];
  if (fim.length) registrar(c.salas.batalha.log, { autor: p.nome, rotulo: 'Fim das habilidades ativadas', texto: fim.join(', ') });
}

// Marca guardada em p.habAtivas: nome, turnos que faltam, se acaba no fim do combate ou no descanso.
function marcaDeDuracao(nome, dur) {
  return { nome, ...(dur?.turnos ? { turnos: dur.turnos } : {}), ...(dur === 'combate' ? { combate: true } : {}), ...(dur === 'descanso' ? { descanso: true } : {}) };
}
// Encerra uma habilidade ativa: tira o efeito ligado, a Essência e os PV temporários dela, e devolve o humor de antes.
function encerrarHabilidade(c, p, hab) {
  const a = p.habAtivas?.[hab.id];
  if (!a) return;
  delete p.habAtivas[hab.id];
  p.ativas = (p.ativas || []).filter(x => x !== hab.id);
  if (hab.regra?.especial === 'essencia') delete p.essencia;
  if (hab.regra?.especial === 'pvTemp') delete p.pvTemp;
  if (a.humorAntes && p.humor === a.humor) p.humor = a.humorAntes;
  registrar(c.salas.batalha.log, { autor: p.nome, rotulo: `${hab.nome} encerrada`, texto: '' });
}

// Ativa a habilidade (botão Ativar, ou a oferta de reação/ação livre, que diz a ação gasta).
function ativarHabilidade(c, p, sis, hab, { ctx, alvo = null, acao = null }) {
  const regra = hab.regra;
  const acaoUsada = acao || regra.acao || acoesDaHabilidade(p, sis, hab)[0] || null;

  // Já ativa: não ativa de novo enquanto durar (a não ser que o texto permita); o mestre pode encerrar antes.
  if ((p.habAtivas || {})[hab.id] && !podeRepetir(hab)) {
    if (!ctx.mestre) throw erro(`${hab.nome} já está ativa (${textoDuracao(regra.duracao) || 'até o mestre encerrar'}): não dá para ativar de novo.`);
    encerrarHabilidade(c, p, hab);
    return { desativou: true };
  }
  const chave = chaveHabilidade(hab.nome);
  if (usosRestantes(p, sis, chave) <= 0) throw erro(`${hab.nome} já foi usada (volta no descanso longo).`);
  if (regra.requerItem && !(p.itens || []).some(i => new RegExp(regra.requerItem, 'i').test(i.nome))) throw erro(`${hab.nome} precisa de um item: ${regra.requerItem.replace('|', ' ou ')}.`);
  const notas = [];
  let essencia = null;
  if (regra.especial === 'essencia') {
    const m = personagem(c, alvo);
    const abatido = m.semPv || (m.pv && m.pv.atual <= 0) || (m.marcadores || []).some(x => ['Morto', 'Desmaiado'].includes(x));
    if (!c.salas.batalha.participantes.includes(m.id) || !abatido || tipoCriatura(m) === 'humanoide') throw erro('Escolha um monstro abatido no Campo de Batalha.');
    if (!m.atributos) throw erro(`${m.nome} não tem atributos na ficha: o mestre precisa preencher.`);
    const [sigla, valor] = Object.entries(derivados(m, sis).atributos).sort((x, y) => y[1] - x[1])[0];
    essencia = { sigla, valor, de: m.nome };
    notas.push(`${sigla} ${valor} (de ${m.nome})`);
  }
  if (regra.custo?.recurso) {
    try { gastarRecurso(p, sis, regra.custo.recurso, regra.custo.qtd || 1); } catch (e) { throw erro(e.message); }
    notas.push(`gastou ${regra.custo.qtd || 1} carga(s)${cargaNoCoracao(p, regra.custo.qtd || 1)}`);
  }
  if (regra.custo?.hum && p.humanidade) {
    const d = rolarDado(regra.custo.hum);
    p.humanidade.atual = Math.max(0, p.humanidade.atual - d.total);
    notas.push(`perdeu ${d.total} HUM [${d.dados.join(', ')}]`);
  }
  if (regra.especial === 'pvTemp') {
    const d = rolarDado(regra.pvTemp);
    // Despertar: +1 por vez que pegou Corpo monstruoso.
    const mais = regra.pvTempMais ? (listaHabilidades(p, sis).find(x => chaveHabilidade(x.nome) === regra.pvTempMais)?.vezes || 0) : 0;
    p.pvTemp = Math.max(p.pvTemp || 0, d.total + mais);
    notas.push(`${d.total + mais} PV temporários [${d.dados.join(', ')}]${mais ? ` +${mais}` : ''}`);
  }
  let humorAntes;
  if (regra.humor && sis.social?.humores?.some(x => x.id === regra.humor)) {
    humorAntes = p.humor || 'neutro';
    p.humor = regra.humor;
    notas.push(`humor ${sis.social.humores.find(x => x.id === regra.humor).nome}`);
  }
  if (essencia) p.essencia = essencia;
  if (regra.usos) gastarUso(p, chave);
  (p.habAtivas ||= {})[hab.id] = { ...marcaDeDuracao(hab.nome, regra.duracao), ...(regra.fim ? { fim: regra.fim } : {}), ...(humorAntes ? { humorAntes, humor: regra.humor } : {}) };
  if (!(p.ativas || []).includes(hab.id)) p.ativas = [...(p.ativas || []), hab.id];
  const excesso = gastarAcao(c, p, acaoUsada);
  const duracao = textoDuracao(regra.duracao);
  const texto = [acaoUsada ? nomeAcao(acaoUsada) : '', duracao, ...notas].filter(Boolean).join(' · ');
  registrar(c.salas.batalha.log, { autor: p.nome, rotulo: `${hab.nome} ativada`, texto: `${texto}${excesso ? ` · atenção: ${excesso}` : ''}` });
  return { texto, excesso };
}

// Usa a habilidade (ver habilidade.usar); "acao" vem da oferta de reação/ação livre.
function usarHabilidade(c, p, sis, hab, acao = null) {
  const dur = duracaoDaHabilidade(hab);
  if (dur && p.habAtivas?.[hab.id] && !podeRepetir(hab)) throw erro(`${hab.nome} já está ativa (${textoDuracao(dur)}): não dá para usar de novo enquanto durar.`);
  if (dur) (p.habAtivas ||= {})[hab.id] = marcaDeDuracao(hab.nome, dur);
  const tipo = acao || acoesDaHabilidade(p, sis, hab)[0] || 'livre';
  const excesso = c.salas.batalha.combate ? gastarAcao(c, p, tipo) : null;
  const texto = [nomeAcao(tipo), textoDuracao(dur)].filter(Boolean).join(' · ');
  registrar(c.salas.batalha.log, { autor: p.nome, rotulo: `${p.nome} usa ${hab.nome}`, texto: `${texto}${excesso ? ` · atenção: ${excesso}` : ''}` });
  return { texto, excesso, ativa: !!dur };
}

// Kit da ficha de teste (até 3000 créditos do catálogo): entra na mochila e o que tem slot já vai equipado.
function darKitDeTeste(c, p, sis, ctx) {
  const nomes = [];
  for (const modelo of kitDeTeste(sis, p)) {
    const it = itemDoCatalogo(modelo.id, sis);
    (p.itens ||= []).push(it);
    nomes.push(it.nome);
    if (it.slot) try { acoes['item.equipar'](c, { id: p.id, uid: it.uid, equipar: true }, ctx); } catch { /* sem espaço: fica na mochila */ }
  }
  return nomes;
}

function terminarCombatePara(c, p) {
  if (!p?.emCombate) return;
  const sis = sistema(c.sistema);
  encerrarAtivacoes(c, p, sis);
  delete p.emCombate;
  const nota = fimDoCombate(p, sis, derivados(p, sis).percentual.CONS ?? 0);
  sincronizarEfeitos(p, sis);
  if (nota) registrar(c.salas.batalha.log, { autor: p.nome, rotulo: 'Fim do combate — Necessidades', texto: nota });
}

function sairDoCombate(s, id) {
  if (s.pendentes) s.pendentes = s.pendentes.filter(x => x.atacante !== id && x.alvo !== id);
  const cb = s.combate;
  if (!cb) return;
  const i = cb.ordem.findIndex(o => o.id === id);
  if (i < 0) return;
  cb.ordem.splice(i, 1);
  if (i < cb.vez) cb.vez--;
  if (cb.vez >= cb.ordem.length) cb.vez = 0;
  if (!cb.ordem.length) s.combate = null;
}

// Tipo de arma, para o desenho que aparece sobre o alvo (punho, lâmina, machado, martelo, arco, arma de fogo).
function tipoDaArma(arma) {
  const per = arma.pericia || '';
  if (arma.uid === 'desarmado' || per.startsWith('briga')) return 'desarmado';
  if (per === 'armas-de-fogo.projeteis') return 'arco';
  if (per.startsWith('armas-de-fogo')) return 'fogo';
  if (/machado/.test(per)) return 'machado';
  if (/martelo|bastao/.test(per)) return 'martelo';
  if (per.startsWith('arma-branca')) return 'lamina';
  return arma.alcance === 'distancia' ? 'fogo' : 'lamina';
}

// Iniciativa de todos (AGI + 1d10) e a ordem dos turnos, do maior para o menor.
function iniciarCombate(c) {
  const sis = sistema(c.sistema);
  const s = c.salas.batalha;
  const vivos = s.participantes.map(id => c.personagens.find(p => p.id === id)).filter(Boolean);
  const ordem = vivos.map(p => {
    const r = rolarIniciativa(p, sis, Math.random, vivos.filter(x => x.id !== p.id));
    return { id: p.id, ini: r.total, agi: r.agi, dados: r.dados };
  });
  s.combate = { rodada: 1, turno: 1, vez: 0, ordem };
  for (const p of vivos) p.emCombate = true;
  ordenarIniciativa(s.combate);
  s.ativo = s.combate.ordem[0].id;
  const nomes = s.combate.ordem.map(o => `${c.personagens.find(p => p.id === o.id).nome} ${o.ini}`);
  registrar(s.log, { autor: 'Mestre', rotulo: 'Combate iniciado — iniciativa', texto: nomes.join(' · ') });
}

// O sistema força a iniciativa: com dois ou mais no Campo de Batalha o combate começa sozinho,
// e quem chega depois entra na ordem com a própria iniciativa.
function garantirCombate(c) {
  const s = c.salas.batalha;
  if (!s.combate) {
    if (s.participantes.length >= 2) iniciarCombate(c);
    return;
  }
  for (const id of s.participantes) {
    const p = c.personagens.find(x => x.id === id);
    if (p) entrarNoCombate(c, s, p);
  }
}

// Resolve um ataque declarado com a defesa escolhida: rola, aplica o dano e registra.
function resolverPendente(c, s, pend, defesa, sis) {
  const a = personagem(c, pend.atacante);
  const b = personagem(c, pend.alvo);
  let r;
  try {
    r = resolverAtaque(a, b, sis, pend.opcoes, defesa || 'nenhuma');
  } catch (e) {
    throw erro(e.message);
  }
  s.pendentes = (s.pendentes || []).filter(x => x.id !== pend.id);
  const notas = aplicarAtaque(a, b, r, sis);
  criarOfertas(c, s, a, b, r, pend, sis);
  // Ataque que falhou: a arma usada pode perder durabilidade (DS maior que a durabilidade atual).
  if (!r.sucesso) {
    const usada = (a.itens || []).find(i => i.uid === pend.opcoes?.armaUid);
    const nota = usada && desgastarItem(usada, r.ds);
    if (nota) notas.push(nota);
  }
  // Efeito novo: Queimadura dá Vulnerabilidade; novo Corte reinicia a contagem do Sangramento.
  if (r.efeito === 'Queimadura') (b.marcadores ||= []).push('Vulnerabilidade');
  const condEfeito = r.efeito && (sis.condicoes || []).find(x => x.nome === r.efeito);
  sincronizarEfeitos(b, sis, { reiniciar: condEfeito ? [condEfeito.id] : [] });
  if (condEfeito && b.efeitos?.[condEfeito.id]) notas.push(`${r.efeito} por ${b.efeitos[condEfeito.id].turnos} turno(s)${condEfeito.sangra ? ' até a próxima perda de PV' : ''}`);
  const mods = r.mods.map(m => `${m.nome} ${fmtMod(m.valor)}`).join(', ');
  const modo = r.modo ? ` · ${r.modo} (${(r.modo === 'vantagem' ? r.motivosVantagem : r.motivosDesvantagem).join(', ')}) d100 [${r.dados.join(', ')}]` : '';
  const def = r.defesa.partes.map(x => `${x.nome} ${x.valor}`).join(' + ');
  const danoTxt = r.dano
    ? ` — dano ${r.dano}${r.metadeEvasao ? ' (metade pela Evasão)' : ''} (${r.danoPartes.map(x => `${x.nome} ${x.dados ? `[${x.dados.join(', ')}]` : ''}${x.total}`).join(' + ')}${r.ip ? ` − IP ${r.ip}` : ''}${r.queimadura ? ' +1 queimadura' : ''}) · ${b.nome} ${textoPv(b)} PV`
    : '';
  // Resultado curto para a mesa: Acertou (e o dano tomado) ou Defendeu. As contas ficam no "detalhe" (ver ao passar o mouse).
  const tiro = r.defesa.id === 'nenhuma';
  // A conta do dano, parte por parte: 2 (1d4 Faca) + 3 (MOD FOR) + 1 (Ataque Desarmado Treinado) − 1 (IP).
  const conta = r.danoPartes.length
    ? ` = ${r.danoPartes.map(x => `${x.total} (${x.expr ? `${x.expr} ${x.nome}` : x.nome})`).join(' + ')}${r.ip ? ` − ${r.ip} (IP)` : ''}${r.metadeEvasao ? ' ÷ 2 (Evasão)' : ''}${r.resistencia ? ` ÷ 2 (${r.porAfinidade ? `afinidade ${r.porAfinidade}` : `resistência a ${r.resistencia}`})` : ''}${r.vulnerabilidade ? ' × 2 (vulnerável)' : ''}`
    : '';
  const resumo = r.sucesso
    ? `Acertou! ${b.nome} tomou ${r.dano} de dano${conta} (${textoPv(b)} PV)`
    : r.dano ? `${b.nome} defendeu em parte (${r.defesa.nome}): tomou ${r.dano} de dano${conta} (${textoPv(b)} PV)`
      : tiro ? `Errou ${b.nome}` : `${b.nome} defendeu (${r.defesa.nome})`;
  const extras = [...notas, r.imune ? `${b.nome} é imune a ${r.imune}` : null, r.resistencia ? (r.porAfinidade ? `afinidade ${r.porAfinidade} contra ${r.resistencia}: metade do dano` : `resistência a ${r.resistencia}: metade do dano`) : null,
    r.vulnerabilidade ? `vulnerável a ${r.vulnerabilidade}: dano dobrado` : null, !r.sucesso && r.defesa.id === 'esquiva' ? `${b.nome} pode se deslocar até 1,5 m` : null, r.perdaSacrificio ? `Sacrifício: ${a.nome} perde ${r.perdaSacrificio} PV` : null].filter(Boolean);
  const entrada = {
    tipo: 'ataque', autor: a.nome, rotulo: `ataca ${b.nome} com ${r.arma}${r.especial ? ` — ${r.especial}` : ''}`, sucesso: r.sucesso, critico: r.critico, defendeu: !r.sucesso, alvo: b.nome,
    // Para as artes na tela: quem ataca, quem é o alvo, o tipo de arma e se o alvo caiu.
    atacanteId: a.id, alvoId: b.id, armaTipo: pend.armaTipo || 'desarmado', tipoDano: pend.tipoDano || null,
    morto: (b.marcadores || []).includes('Morto'), desmaiado: (b.marcadores || []).includes('Desmaiado'),
    texto: `${resumo}${r.critico ? ` · crítico de ${r.critico}` : ''}${extras.length ? ` · ${extras.join(' · ')}` : ''}`,
    detalhe: `d100 ${r.dp} + ação ${r.acao}${mods ? ` (${mods})` : ''} = ${r.total} contra defesa ${r.nd} (${def})${modo} · DS ${r.dsDados?.length > 1 ? `[${r.dsDados.join(', ')}] → ${r.ds}` : r.ds}${danoTxt}`,
    // Números dos dados para a animação na tela de todos.
    dp: r.dp, dados: r.dados, ds: r.ds, dsDados: r.dsDados, total: r.total, nd: r.nd, dano: r.dano, danoDados: r.danoPartes.filter(x => x.dados).map(x => ({ nome: x.nome, expr: x.expr, dados: x.dados })),
  };
  registrar(s.log, entrada);
  return entrada;
}

// Dificuldade do reparo (autor, 22/10): ND 60 + 10 × cada ponto de durabilidade perdido.
export const ndReparo = it => 60 + 10 * Math.max(0, (it.durabilidade ?? 0) - (it.durabilidadeAtual ?? it.durabilidade ?? 0));

// Economia do turno (livro): 1 ação principal, 1 de movimento e 1 bônus por turno, ações livres à vontade; a completa
// gasta a principal e a de movimento; a reação é 1 por rodada, fora do turno. O app anota o que foi gasto e AVISA quando
// passa do limite (não bloqueia: o mestre decide). Devolve o aviso, se houver.
const LIMITE_ACOES = { principal: 1, movimento: 1, bonus: 1, reacao: 1 };
function gastarAcao(c, p, tipo, { desfazer = false } = {}) {
  const cb = c.salas.batalha.combate;
  if (!cb || !p || !tipo || tipo === 'livre') return null;
  const g = ((cb.gasto ||= {})[p.id] ||= {});
  if (g.reacaoRodada !== cb.rodada) { g.reacao = 0; g.reacaoRodada = cb.rodada; }
  const partes = tipo === 'completa' ? ['principal', 'movimento'] : [tipo];
  const avisos = [];
  for (const k of partes) {
    if (desfazer) { g[k] = Math.max(0, (g[k] || 0) - 1); continue; }
    if ((g[k] || 0) >= (LIMITE_ACOES[k] ?? 1)) avisos.push(`${p.nome} já usou a ${nomeAcao(k).toLowerCase()} ${k === 'reacao' ? 'nesta rodada' : 'neste turno'}`);
    g[k] = (g[k] || 0) + 1;
  }
  return avisos.length ? avisos.join('; ') : null;
}

// Cobertura automática pelo mapa (autor, 25/10): os objetos entre quem atira e o alvo. O mestre pode ignorar
// ("ignorar cobertura do mapa"); habilidades mudam o efeito: Tiro preciso (atacante, armas de fogo) ignora a parcial;
// Combate de Trincheira (alvo) faz a parcial valer como total contra quem atira de mais de 9 m.
function coberturaDoAtaque(c, a, b, op, sis) {
  const arma = armasDisponiveis(a, sis).find(x => x.uid === (op.armaUid || 'desarmado'));
  if (!arma || arma.alcance !== 'distancia' || op.area || op.ignorarCoberturaMapa) return;
  let cob = coberturaPeloMapa(c, a.id, b.id);
  if (!cob) return;
  if (cob.nivel === 'parcial' && temHabilidade(b, sis, 'Combate de Trincheira') && (distanciaPecas(c, a.id, b.id) ?? 0) > 9) cob = { ...cob, nivel: 'total', objeto: `${cob.objeto}, Combate de Trincheira` };
  if (cob.nivel === 'parcial' && temHabilidade(a, sis, 'Tiro preciso') && String(arma.pericia || '').startsWith('armas-de-fogo')) return;
  if (cob.nivel === 'total') throw erro(`${b.nome} está atrás de cobertura total (${cob.objeto}): sem linha de tiro.`);
  op.cobertura = true;
  op.coberturaDoMapa = cob.objeto;
}

// Ônus das mãos no ataque (ver combate.atacar). Devolve true quando é o segundo ataque (o da outra mão).
function maosDoAtaque(c, a, op, sis) {
  const pedeDois = !!op.doisAtaques;
  delete op.doisAtaques; delete op.maos; delete op.duasArmas;
  const cfg = sis.combate?.maos || {};
  const nasMaos = (a.itens || []).filter(i => i.equipado && i.slot === 'maos' && i.tipo === 'arma' && (i.ocupa ?? 1) < 2);
  const usada = nasMaos.find(i => i.uid === op.armaUid);
  if (!usada || op.multiplo) return false;
  const mao = (usada.mao ?? 0) === (a.maoHabil === 'esquerda' ? 1 : 0) ? 'habil' : 'inabil';
  const ambi = temHabilidade(a, sis, 'Ambidestria');
  const s = c.salas.batalha;
  const g = s.combate ? ((s.combate.gasto ||= {})[a.id] ||= {}) : ((s.maosForaDeCombate ||= {})[a.id] ||= {});
  if (g.segundaMao && g.segundaMao.mao === mao && g.segundaMao.uid !== usada.uid) {
    delete g.segundaMao;
    op.maos = ambi ? { nome: 'segundo ataque (Ambidestria)', valor: cfg.ambidestria ?? -20 }
      : { nome: `dois ataques (mão ${mao === 'habil' ? 'hábil' : 'inábil'})`, valor: cfg.dois?.[mao] ?? (mao === 'habil' ? -20 : -40) };
    return true;
  }
  delete g.segundaMao;
  if (pedeDois && nasMaos.length >= 2) {
    g.segundaMao = { mao: mao === 'habil' ? 'inabil' : 'habil', uid: usada.uid };
    if (!ambi) op.maos = { nome: `dois ataques (mão ${mao === 'habil' ? 'hábil' : 'inábil'})`, valor: cfg.dois?.[mao] ?? (mao === 'habil' ? -20 : -40) };
    return false;
  }
  if (mao === 'inabil' && !ambi) op.maos = { nome: 'mão inábil', valor: cfg.inabil ?? -20 };
  return false;
}

export const TIPOS_OBJETO_MAPA = TIPOS_OBJETO.map(t => t.id);
const ehArmadilha = it => /armadilh/i.test(`${it.categoria || ''} ${it.nome || ''}`);
export const TIPOS_COMPANHEIRO = [
  { id: 'familiar', nome: 'Familiar' }, { id: 'animal', nome: 'Animal' }, { id: 'montaria', nome: 'Montaria' },
  { id: 'automato', nome: 'Autômato / drone' }, { id: 'invencao', nome: 'Invenção' }, { id: 'implante', nome: 'Implante' }, { id: 'outro', nome: 'Outro' },
];

// Núcleo energético com coração humano: cada carga usada causa 1d6 de dano (o mestre marca "coração artificial" na ficha).
function cargaNoCoracao(p, qtd = 1) {
  if (p.coracaoArtificial || !p.pv) return '';
  const d = rolarDado(`${qtd}d6`);
  perderPv(p, d.total);
  return ` · coração humano: ${d.total} de dano (${textoPv(p)} PV)`;
}

// Civilizados (Encantado, nível 12): os adversários precisam passar em WILL% Difícil para atacá-lo, a não ser que ele os
// tenha atacado primeiro. Quem passa e ataca primeiro fica com −10% em todos os testes até o fim da batalha.
// O teste vale uma vez por combate para cada adversário (Guerras diplomáticas devolve a situação de Civilizados).
function civilizados(c, a, b, sis) {
  if (temHabilidade(a, sis, 'Civilizados') && !(a.atacouNoCombate ||= []).includes(b.id)) a.atacouNoCombate.push(b.id);
  if (!temHabilidade(b, sis, 'Civilizados') || (b.atacouNoCombate || []).includes(a.id) || (a.passouCivilizado || []).includes(b.id)) return null;
  const dif = sis.teste.dificuldades.find(x => x.nome === 'Difícil') || { nome: 'Difícil', nd: 90 };
  const t = testeContra(derivados(a, sis).percentual.WILL ?? 0, dif.nd, sis);
  const conta = `WILL% ${t.total} (d100 ${t.dp} + ${t.acao}) contra ${dif.nome} ${dif.nd}`;
  const s = c.salas.batalha;
  if (!t.sucesso) {
    const texto = `${a.nome} não consegue atacar ${b.nome} (Civilizados): ${conta}`;
    registrar(s.log, { autor: a.nome, rotulo: `tenta atacar ${b.nome}`, texto, sucesso: false });
    return { tipo: 'barrado', texto };
  }
  (a.passouCivilizado ||= []).push(b.id);
  a.onusCivilizado = true;
  registrar(s.log, { autor: a.nome, rotulo: `ataca ${b.nome} primeiro (Civilizados)`, texto: `${conta}: passou; −10% em todos os testes até o fim da batalha` });
  return null;
}

// Fim do turno: habilidades ativadas por turnos descontam um; ao acabar, saem e aplicam o efeito final (Aceleração Sináptica: 2d4).
function passarTurnoHabilidades(p) {
  const notas = [];
  for (const [id, a] of Object.entries(p.habAtivas || {})) {
    if (!a.turnos) continue;
    a.turnos--;
    if (a.turnos > 0) { notas.push(`${a.nome}: falta${a.turnos > 1 ? 'm' : ''} ${a.turnos} turno${a.turnos > 1 ? 's' : ''}`); continue; }
    delete p.habAtivas[id];
    p.ativas = (p.ativas || []).filter(x => x !== id);
    let txt = `${a.nome} acabou`;
    if (a.fim?.dano && p.pv) {
      const d = rolarDado(a.fim.dano);
      perderPv(p, d.total);
      txt += ` — ${a.fim.nome || 'dano'}: ${d.total} [${d.dados.join(', ')}] (${textoPv(p)} PV)`;
    }
    notas.push(txt);
  }
  return notas;
}

// Depois de um ataque, habilidades que dão uma ação extra viram uma "oferta" para quem controla o atacante.
const TIPOS_HORDA = ['animal', 'besta', 'monstro', 'mutante'];
function criarOfertas(c, s, a, b, r, pend, sis) {
  s.ofertas ||= [];
  const cb = s.combate;
  const turno = cb ? `${cb.rodada}:${cb.turno}` : 'livre';
  // Quebra-Hordas: 1 vez por turno, ao acertar, ataque extra contra outra criatura da mesma raça a até 1,5 m do alvo.
  if (r.sucesso && !pend.opcoes?.extra && temHabilidade(a, sis, 'Quebra-Hordas') && a.quebraHordasEm !== turno && TIPOS_HORDA.includes(tipoCriatura(b))) {
    const candidatos = s.participantes.filter(id => id !== a.id && id !== b.id).map(id => personagem(c, id))
      .filter(x => x.pv && x.pv.atual > 0 && racaDe(b) && racaDe(x) === racaDe(b) && (distanciaPecas(c, b.id, x.id) ?? 0) <= 1.5);
    if (candidatos.length) {
      s.ofertas.push({ id: uid(), tipo: 'quebraHordas', habilidade: 'Quebra-Hordas', personagem: a.id, alvos: candidatos.map(x => x.id), armaUid: pend.opcoes?.armaUid || 'desarmado',
        texto: `${a.nome} acertou ${b.nome}: ataque extra (Quebra-Hordas) contra outra criatura da mesma raça a até 1,5 m${candidatos.some(x => distanciaPecas(c, b.id, x.id) == null) ? ' (confira a distância no mapa)' : ''}` });
    }
  }
  // Reações e ações livres do ALVO viram um "ataque especial momentâneo" (autor, 22/10): ao ser atacado, cada habilidade
  // dele que gasta reação ou ação livre aparece como oferta. O texto filtra o gatilho: "falhar … ataque" só quando o ataque
  // errou; "corpo-a-corpo" só contra ataque corpo a corpo. A reação é 1 por rodada.
  if (b.atributos && !pend.opcoes?.extra) {
    const cbR = s.combate;
    const g = cbR?.gasto?.[b.id];
    const reacaoUsada = g && g.reacaoRodada === cbR.rodada && (g.reacao || 0) >= 1;
    const semAc = t => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const hab of listaHabilidades(b, sis)) {
      const acoes = acoesDaHabilidade(b, sis, hab);
      const tipo = acoes.find(x => x === 'reacao' || x === 'livre');
      if (!tipo || (tipo === 'reacao' && reacaoUsada)) continue;
      if (b.habAtivas?.[hab.id] && !podeRepetir(hab)) continue;
      const t = semAc(hab.descricao);
      if (/falha\w*[^.]{0,40}ataque|ataque[^.]{0,40}falha/.test(t) && r.sucesso) continue;
      if (/corpo[- ]a[- ]corpo/.test(t) && pend.alcance === 'distancia') continue;
      s.ofertas = s.ofertas.filter(o => !(o.personagem === b.id && o.habilidade === hab.nome));
      s.ofertas.push({ id: uid(), tipo: 'reacao', habilidade: hab.nome, habId: hab.id, personagem: b.id, alvos: [a.id], acao: tipo, ataque: ehAtaqueEspecial(hab), dados: dadosDaHabilidade(hab),
        texto: `${b.nome} ${r.sucesso ? 'foi atingido' : 'escapou'} (ataque de ${a.nome}): pode usar ${hab.nome} como ${nomeAcao(tipo).toLowerCase()} agora` });
    }
  }
  // Guerras diplomáticas: ao causar dano, ação bônus de Intimidação contra WILL% + 30 do alvo para ele parar de atacar.
  if (r.dano > 0 && temHabilidade(a, sis, 'Guerras diplomaticas') && b.atributos) {
    s.ofertas.push({ id: uid(), tipo: 'guerrasDiplomaticas', habilidade: 'Guerras diplomáticas', personagem: a.id, alvos: [b.id],
      texto: `${a.nome} causou dano em ${b.nome}: ação bônus de Intimidação (contra WILL% + 30) para ${b.nome} parar de atacar` });
  }
}

// Dano temporário de Sanidade/Humanidade: sai do valor atual e fica anotado; no descanso longo,
// o teste de Consciência (WILL%, ND 100) devolve o que for temporário.
function danoTemporario(p, chave, n) {
  if (!p[chave] || !n) return;
  p[chave].atual = Math.max(0, p[chave].atual - n);
  p[chave].temporario = (p[chave].temporario || 0) + n;
}

// Agressão súbita (escalada): atacar um humano no meio do diálogo custa Humanidade (uma vez por cena, por agressor).
function agressaoSubita(c, a, b, sis) {
  const soc = c.salas.social;
  if (!soc.participantes.includes(a.id) || !soc.participantes.includes(b.id) || b.criatura || !a.humanidade) return null;
  soc.agressores ||= [];
  if (soc.agressores.includes(a.id)) return null;
  soc.agressores.push(a.id);
  const r = rolarDado(sis.social?.agressao?.dano || '1d6');
  danoTemporario(a, 'humanidade', r.total);
  const texto = `${a.nome} partiu para a agressão contra ${b.nome} no meio do diálogo: perde ${r.total} de Humanidade temporária (${a.humanidade.atual}).`;
  registrar(soc.log, { autor: a.nome, rotulo: 'Agressão súbita', texto });
  return texto;
}

const fmtMod = v => (v > 0 ? `+${v}` : `${v}`);

// ---------- ações ----------

export const acoes = {
  'campanha.atualizar'(c, d, ctx) {
    exigirMestre(ctx);
    for (const k of ['aberta', 'lojaAberta', 'edicaoLivre', 'dadosNaTela', 'itensRarosVisiveis']) if (k in d) c[k] = !!d[k];
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

  'personagem.criar'(c, { tipo, grupoId, ficha, validar }, ctx) {
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
    // Jogador sempre passa pelas travas; o mestre também, quando cria pelo assistente.
    if (!ctx.mestre || (tipo === 'pj' && validar)) validarCriacao(c, p, sis);
    else recalcularMaximos(p, sis);
    // Itens vindos do catálogo ganham identificador próprio.
    p.itens = (p.itens || []).map(i => ({ ...i, uid: i.uid || uid(), equipado: false }));
    c.personagens.push(p);
    return { id: p.id };
  },

  'personagem.atualizar'(c, { id, patch }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const antes = structuredClone(p);
    for (const [k, v] of Object.entries(patch || {})) {
      if (CAMPOS_PROTEGIDOS.has(k)) continue;
      if (!ctx.mestre && !CAMPOS_JOGADOR.has(k)) continue;
      // Foto por link (Google Drive ou internet): guarda o endereço da imagem; arquivos enviados ficam em /uploads.
      p[k] = k === 'nivel' ? Math.max(1, Math.min(20, parseInt(v, 10) || 1)) : ['foto', 'imagemCorpo'].includes(k) ? imagemSegura(v) : v;
    }
    // Ficha de jogador editada pelo mestre: mesmas travas de pontos da criação, a não ser na "edição livre" da campanha.
    if (ctx.mestre && p.tipo === 'pj' && !c.edicaoLivre) {
      const desfazer = msg => { Object.assign(p, antes); throw erro(msg); };
      if (p.nivel > antes.nivel && (antes.xp || 0) < xpParaSubir(antes.nivel, sis)) {
        desfazer(`Para subir de nível faltam XP (precisa de ${xpParaSubir(antes.nivel, sis)}). Dê XP e use "Evoluir", ou ligue a edição livre na aba Campanha.`);
      }
      if (p.nivel > antes.nivel + 1) desfazer('Suba um nível de cada vez.');
      const problemas = problemasFicha(p, sis, c, { apenasPontos: true });
      if (problemas.length && JSON.stringify(problemas) !== JSON.stringify(problemasFicha(antes, sis, c, { apenasPontos: true }))) desfazer(problemas[0]);
      if (p.nivel > antes.nivel) p.xp = (antes.xp || 0) - xpParaSubir(antes.nivel, sis);
    }
    if ('marcadores' in (patch || {})) sincronizarEfeitos(p, sis);
    // PV persistentes/permanentes só mudam pelo mestre (ação pv.perdas); o jogador mexe só no PV atual.
    if (p.pv && antes.pv) for (const k of ['persistente', 'permanente']) { if (antes.pv[k]) p.pv[k] = antes.pv[k]; else delete p.pv[k]; }
    // Habilidade ativada/desativada que muda o PV máximo: soma (ou tira) a diferença no máximo e no atual.
    if ('ativas' in (patch || {}) || 'ajustesHabilidades' in (patch || {})) {
      const delta = derivados(p, sis).habilidades.pv - derivados(antes, sis).habilidades.pv;
      if (delta && p.pv) p.pv = { ...p.pv, max: p.pv.max + delta, atual: p.pv.atual + delta };
    }
    // Habilidade que muda a Humanidade máxima (Alma de ciborgue −10) chegou ou saiu (nível, classe): ajusta o máximo e o atual.
    if (p.humanidade && !('humanidade' in (patch || {}))) {
      const dh = derivados(p, sis).habilidades.humanidadeMax - derivados(antes, sis).habilidades.humanidadeMax;
      if (dh) p.humanidade = { ...p.humanidade, max: Math.max(1, (p.humanidade.max ?? 100) + dh), atual: Math.min(p.humanidade.atual ?? 100, Math.max(1, (p.humanidade.max ?? 100) + dh)) };
    }
    // Explicitamente editado (ex.: "PV máx." pelo mestre) não é recalculado.
    const explicitos = new Set(Object.keys(patch || {}));
    if (CAMPOS_FORMULA.some(k => explicitos.has(k)) && !['pv', 'sanidade', 'humanidade'].some(k => explicitos.has(k))) recalcularMaximos(p, sis);
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
      sairDoCombate(s, id);
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

  // XP para um personagem ({ id }) ou vários ({ ids }), com registro no histórico da campanha.
  'xp.dar'(c, { id, ids, qtd, motivo }, ctx) {
    exigirMestre(ctx);
    const n = parseInt(qtd, 10) || 0;
    const alvos = (ids || [id]).filter(Boolean).map(x => personagem(c, x));
    if (!alvos.length || !n) throw erro('Escolha quem recebe e quanto XP.');
    for (const p of alvos) p.xp = Math.max(0, (p.xp || 0) + n);
    registrar(c.log, { autor: 'Mestre', rotulo: `${n > 0 ? '+' : ''}${n} XP${motivo ? ` (${String(motivo).slice(0, 60)})` : ''}`, texto: alvos.map(p => `${p.nome}: ${p.xp}`).join(' · ') });
  },

  // Evoluir: salva um backup da ficha antiga e aplica a nova.
  'personagem.evoluir'(c, { id, patch }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    // Subir de nível só com o XP necessário, um nível por vez; o XP é descontado aqui.
    const novoNivel = 'nivel' in (patch || {}) ? parseInt(patch.nivel, 10) || p.nivel : p.nivel;
    let gasto = 0;
    if (novoNivel > p.nivel) {
      if (novoNivel > p.nivel + 1) throw erro('Suba um nível de cada vez.');
      gasto = xpParaSubir(p.nivel, sis);
      if ((p.xp || 0) < gasto && !(ctx.mestre && c.edicaoLivre)) throw erro(`XP insuficiente: precisa de ${gasto} XP para o nível ${novoNivel} (tem ${p.xp || 0}).`);
      if ((p.xp || 0) < gasto) gasto = p.xp || 0;
    }
    // Jogador: confere os pontos do novo nível (Tabela de Progressão) antes de aplicar.
    if (!ctx.mestre) {
      const nova = { ...p, ...Object.fromEntries(Object.entries(patch || {}).filter(([k]) => ['nivel', 'atributos', 'pericias', 'subpericias', 'vantagens', 'defeitos'].includes(k))) };
      if (nova.nivel < p.nivel) throw erro('O nível não pode diminuir.');
      const problemas = problemasFicha(nova, sis, c, { apenasPontos: true });
      if (problemas.length) throw erro(problemas[0]);
    }
    const { backups, ...semBackups } = p;
    p.backups = [...(backups || []), { id: uid(), em: Date.now(), ficha: structuredClone(semBackups) }].slice(-MAX_BACKUPS);
    for (const k of ['nivel', 'classe', 'especializacao', 'escolhasClasse', 'atributos', 'pericias', 'subpericias', 'vantagens', 'defeitos', 'pv', 'sanidade', 'humanidade']) {
      if (k in (patch || {})) p[k] = patch[k];
    }
    recalcularMaximos(p, sis);
    p.xp = (p.xp || 0) - gasto;
    return { gasto };
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

  // Recarrega a arma com a munição do mesmo tipo que o personagem carrega (as caixas vazias somem).
  // Ataque afiado / Aperfeiçoamento do soldado: o personagem passa 2 h treinando com a arma e ela ganha a melhoria
  // (Afiada N / Aperfeiçoada N, N = quantas vezes recebeu a habilidade). Só vale para quem fez ("dono").
  'item.melhorar'(c, { id, uid: itemUid, habilidade }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const hab = temHabilidade(p, sis, habilidade || '');
    const m = hab?.regra?.melhoria;
    if (!m) throw erro(`${p.nome} não tem essa habilidade.`);
    const arma = (p.itens || []).find(i => i.uid === itemUid);
    if (!arma || arma.tipo !== 'arma' || !String(arma.pericia || '').startsWith(m.armas)) throw erro(`${hab.nome} vale só para ${m.armas === 'arma-branca' ? 'armas brancas' : 'armas de fogo'}.`);
    const nivel = hab.vezes || 1;
    arma.melhorias = [...(arma.melhorias || []).filter(x => !(x.id === m.id && x.dono === p.id)), { id: m.id, nome: m.nome, nivel, dono: p.id }];
    registrar(c.log, { autor: p.nome, rotulo: `${hab.nome}: ${arma.nome}`, texto: `${m.nome} ${nivel} (+${nivel} passo${nivel > 1 ? 's' : ''} no dano) após ${m.horas || 2} h de treino` });
    return { nome: m.nome, nivel };
  },

  'item.recarregar'(c, { id, uid: itemUid }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const arma = p.itens.find(i => i.uid === itemUid);
    if (!arma?.capacidade) throw erro('Esta arma não usa munição.');
    let falta = arma.capacidade - (arma.carregada || 0);
    if (falta <= 0) throw erro('A arma já está cheia.');
    const caixas = p.itens.filter(i => i.tipo === 'municao' && i.municao === arma.municao && (i.quantidade || 0) > 0);
    if (!caixas.length) throw erro(`Sem munição de ${arma.municao} no inventário.`);
    let colocou = 0;
    for (const cx of caixas) {
      const n = Math.min(falta, cx.quantidade);
      cx.quantidade -= n; falta -= n; colocou += n;
      if (!falta) break;
    }
    arma.carregada = (arma.carregada || 0) + colocou;
    p.itens = p.itens.filter(i => !(i.tipo === 'municao' && i.quantidade <= 0));
    return { colocou, carregada: arma.carregada };
  },

  // Ajuste manual: tiro fora do combate automático (−1) ou correção do mestre.
  'item.municao'(c, { id, uid: itemUid, delta }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const it = p.itens.find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    const n = parseInt(delta, 10) || 0;
    if (!ctx.mestre && n > 0) throw erro('Para pôr munição na arma, use Recarregar.');
    if (it.capacidade) it.carregada = Math.max(0, Math.min(it.capacidade, (it.carregada || 0) + n));
    else if (it.tipo === 'municao') it.quantidade = Math.max(0, (it.quantidade || 0) + n);
    else throw erro('Este item não usa munição.');
  },

  // Reparo (Engenharia, feito na mesa): +1 de durabilidade, no máximo 1 por desgaste e nunca acima da original.
  'item.reparar'(c, { id, uid: itemUid }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const it = p.itens.find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    let texto;
    try { texto = repararItem(it); } catch (e) { throw erro(e.message); }
    registrar(c.log, { autor: p.nome, rotulo: 'Reparo', texto });
    return { texto };
  },

  // Reparar item (livro, cap. 5): teste de manutenção (Engenharia/Computação), ND 60 + 10 × pontos de durabilidade perdidos
  // (autor, 22/10). Sucesso recupera 1 de durabilidade
  // (só 1 por desgaste). Erro crítico ou 3 falhas seguidas: o item vira sucata. Precisa do kit do tipo do item.
  'item.repararTeste'(c, { id, uid: itemUid, sub }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const it = (p.itens || []).find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    if (it.sucata) throw erro(`${it.nome} virou sucata: não dá mais para reparar.`);
    const dur = durabilidadeDe(it);
    if (dur.tipo !== 'normal' || dur.atual >= dur.max) throw erro(`${it.nome} não precisa de reparo.`);
    if (!dur.reparavel) throw erro(`${it.nome}: só dá para reparar 1 ponto por desgaste. Espere o próximo desgaste.`);
    const subs = sis.pericias.flatMap(x => x.subpericias.map(s => [s.id, `${x.nome} › ${s.nome}`]));
    const nomeSub = subs.find(x => x[0] === sub)?.[1];
    if (!nomeSub) throw erro('Escolha a perícia do reparo.');
    const d = derivados(p, sis);
    const ndNum = ndReparo(it);
    const alvosRef = [sub, sub.split('.')[0]];
    const modo = vantagemPorHabilidade(p, sis, alvosRef) ? 'vantagem' : null;
    const t = testeDMil(d.subpericias[sub] ?? 0, ndNum, sis, { modo });
    const kit = (p.itens || []).some(i => /kit|ferrament/i.test(i.nome));
    let texto;
    if (t.sucesso) {
      texto = repararItem(it);
      it.falhasReparo = 0;
    } else {
      it.falhasReparo = (it.falhasReparo || 0) + 1;
      if (t.critico === 'erro' || it.falhasReparo >= 3) {
        it.sucata = true;
        it.durabilidadeAtual = 0;
        texto = `${it.nome} virou SUCATA (${t.critico === 'erro' ? 'erro crítico' : '3 falhas seguidas'})`;
      } else texto = `falhou (${it.falhasReparo}ª falha seguida; na 3ª o item vira sucata)`;
    }
    const entrada = { tipo: 'dmil', autor: p.nome, rotulo: `Reparar ${it.nome} (${nomeSub})${modo ? ' (vantagem)' : ''}`, acaoNome: nomeSub, mod: 0, ...t,
      texto: `${texto}${kit ? '' : ' · sem kit de reparo no inventário (o mestre decide)'}` };
    registrar(c.log, entrada);
    return entrada;
  },

  // Falha num teste usando o item (fora do combate automático): o app compara o DS e desgasta se for o caso.
  'item.falha'(c, { id, uid: itemUid, ds, semPrerequisito }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const it = p.itens.find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    const n = Math.max(1, Math.min(10, parseInt(ds, 10) || 0));
    const texto = desgastarItem(it, n, { semPrerequisito: !!semPrerequisito }) || `${it.nome} aguentou (DS ${n} não passou da durabilidade).`;
    registrar(c.log, { autor: p.nome, rotulo: 'Durabilidade', texto });
    return { texto };
  },

  'item.durabilidade'(c, { id, uid: itemUid, valor }, ctx) {
    exigirMestre(ctx);
    const it = personagem(c, id).itens.find(i => i.uid === itemUid);
    if (it) it.durabilidadeAtual = Math.max(0, parseInt(valor, 10) || 0);
  },

  // mao: 0 = mão direita, 1 = mão esquerda (itens do slot "mãos"); sem mão escolhida, vai para a mão livre (a hábil primeiro).
  'item.equipar'(c, { id, uid: itemUid, equipar, mao }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const it = p.itens.find(i => i.uid === itemUid);
    if (!it) throw erro('Item não encontrado.');
    if (!equipar) { it.equipado = false; delete it.mao; return; }
    if (it.equipado) return;
    const r = podeEquipar(p, it, sistema(c.sistema));
    if (!r.ok) throw erro(r.motivo);
    it.equipado = true;
    if (it.slot === 'maos' && (it.ocupa ?? 1) < 2) {
      const ocupadas = new Set(p.itens.filter(i => i !== it && i.equipado && i.slot === 'maos').map(i => i.mao));
      const habil = p.maoHabil === 'esquerda' ? 1 : 0;
      const pedida = [0, 1].includes(Number(mao)) ? Number(mao) : null;
      it.mao = pedida ?? (!ocupadas.has(habil) ? habil : 1 - habil);
    } else delete it.mao;
  },

  'item.comprar'(c, { id, itemId }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    if (!ctx.mestre && !c.lojaAberta) throw erro('A loja está fechada pelo mestre.');
    const it = itemDoCatalogo(itemId, sistema(c.sistema));
    if (!ctx.mestre && !itemVisivel(it, c)) throw erro('Este item não está à venda para os jogadores.');
    if ((p.dinheiro || 0) < it.preco) throw erro('Dinheiro insuficiente.');
    p.dinheiro -= it.preco;
    p.itens.push(it);
  },

  // O mestre mostra (ou esconde) um item raro para os jogadores.
  'item.liberar'(c, { itemId, liberar }, ctx) {
    exigirMestre(ctx);
    const lista = new Set(c.itensLiberados || []);
    if (liberar) lista.add(String(itemId)); else lista.delete(String(itemId));
    c.itensLiberados = [...lista];
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
    // Na Sala Social, as afinidades só mudam antes do 1º teste do personagem (evita mexer para melhorar os testes).
    // Volta a liberar quando ele sai da sala ou o mestre esvazia a sala. O mestre sempre pode.
    if (!ctx.mestre && tipo !== undefined && (c.salas.social.testaram || []).includes(de) && c.salas.social.participantes.includes(de)) {
      throw erro('As afinidades só podem ser ajustadas antes do primeiro teste na Sala Social. Peça ao mestre.');
    }
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

  // Fichas de teste: um PJ livre (sem dono) por classe, no nível pedido, para testar as habilidades na mesa.
  'teste.fichas'(c, { nivel = 6 }, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    const n = Math.max(3, Math.min(20, parseInt(nivel, 10) || 6));
    const relatorio = [];
    for (const f of fichasDeTeste(sis, n, c)) {
      const p = { ...f, id: uid(), tipo: 'pj', donoId: null, backups: [], itens: [], dinheiro: sis.regras?.creditosIniciais ?? 0, xp: 0 };
      c.personagens.push(p);
      darKitDeTeste(c, p, sis, ctx);
      Object.assign(p, periciasDeTeste(sis, p, c));
      const r = relatorioFicha(p, sis, c);
      relatorio.push({ nome: p.nome, avisos: r.avisos, lembretes: r.lembretes.length, comEfeito: r.comEfeito, total: r.total });
    }
    return { relatorio };
  },

  // Itens das fichas de teste (até 3000 créditos cada, já equipados). Sem "trocar", só as que estão sem itens;
  // com "trocar", todas as fichas de teste recebem o kit novo no lugar dos itens que tinham.
  'teste.itens'(c, { trocar = false } = {}, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    const fichas = c.personagens.filter(p => p.tipo === 'pj' && /^Teste · /.test(p.nome) && (trocar || !(p.itens || []).length));
    if (!fichas.length) throw erro('Nenhuma ficha de teste sem itens.');
    // As armas mudam com o kit: as perícias acompanham.
    return { relatorio: fichas.map(p => { if (trocar) p.itens = []; const itens = darKitDeTeste(c, p, sis, ctx); Object.assign(p, periciasDeTeste(sis, p, c)); return { nome: p.nome, itens }; }) };
  },

  // Perícias das fichas de teste: as armas que elas têm equipadas, a Esquiva e o tema da classe (dentro do limite e dos pontos).
  'teste.pericias'(c, d, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    const fichas = c.personagens.filter(p => p.tipo === 'pj' && /^Teste · /.test(p.nome));
    if (!fichas.length) throw erro('Nenhuma ficha de teste na campanha.');
    return { relatorio: fichas.map(p => { Object.assign(p, periciasDeTeste(sis, p, c)); return { nome: p.nome, problemas: problemasFicha(p, sis, c, { apenasPontos: true }) }; }) };
  },

  'mapa.definir'(c, { imagemId }, ctx) {
    exigirMestre(ctx);
    c.mapa ||= novoMapa();
    if (imagemId && !c.imagens.some(i => i.id === imagemId)) throw erro('Imagem não encontrada.');
    c.mapa.imagemId = imagemId || null;
  },

  'mapa.grade'(c, { colunas, ox, oy, visivel }, ctx) {
    exigirMestre(ctx);
    c.mapa ||= novoMapa();
    const g = c.mapa.grade;
    if (colunas !== undefined) g.colunas = Math.max(2, Math.min(200, parseInt(colunas, 10) || 20));
    const frac = v => Math.max(0, Math.min(0.99, Number(v) || 0));
    if (ox !== undefined) g.ox = frac(ox);
    if (oy !== undefined) g.oy = frac(oy);
    if (visivel !== undefined) g.visivel = !!visivel;
  },

  // Mestre e Suporte colocam e movem os peões (col/lin = quadrado da grade).
  'mapa.mover'(c, { id, col, lin }, ctx) {
    if (!ctx.mestre && !ctx.suporte) throw erro('Só o mestre ou o Suporte mexem no mapa.');
    personagem(c, id);
    c.mapa ||= novoMapa();
    const antes = c.mapa.pecas[id];
    // O Suporte não enxerga peões ocultos, então também não mexe neles.
    if (antes?.oculto && !ctx.mestre) throw erro('Personagem não encontrado no mapa.');
    const novo = { col: Math.max(0, Math.min(999, parseInt(col, 10) || 0)), lin: Math.max(0, Math.min(999, parseInt(lin, 10) || 0)) };
    // Obstáculo (parede, árvore, veículo…) não deixa o peão entrar no quadrado.
    const bloq = bloqueadoPorObjeto(c.mapa.objetos, novo.col, novo.lin, ladoNoMapa(personagem(c, id)));
    if (bloq) throw erro(`${bloq.nome || tipoObjeto(bloq.tipo).nome} bloqueia esse quadrado.`);
    c.mapa.pecas[id] = { ...antes, ...novo };
  },

  // Mestre: põe no mapa, no primeiro lugar livre que caiba o tamanho de cada um ("Pôr no mapa", "Pôr os do Campo").
  'mapa.por'(c, { ids }, ctx) {
    exigirMestre(ctx);
    c.mapa ||= novoMapa();
    for (const id of [].concat(ids || []).slice(0, LIMITE_SALA * 3)) {
      const p = personagem(c, id);
      if (!c.mapa.pecas[id]) c.mapa.pecas[id] = lugarLivre(c, ladoNoMapa(p));
    }
  },

  // NPC fantasma: o peão some para jogadores e Suporte (o mestre continua vendo, meio transparente).
  'mapa.ocultar'(c, { id, oculto }, ctx) {
    exigirMestre(ctx);
    const x = c.mapa?.pecas?.[id];
    if (!x) throw erro('Esse personagem não está no mapa.');
    x.oculto = !!oculto;
  },

  // Marcações secretas do mestre (armadilhas, gatilhos…): só ele vê.
  'mapa.marcar'(c, { col, lin, texto }, ctx) {
    exigirMestre(ctx);
    c.mapa ||= novoMapa();
    (c.mapa.marcas ||= []).push({ id: uid(), col: Math.max(0, parseInt(col, 10) || 0), lin: Math.max(0, parseInt(lin, 10) || 0), texto: nomeStr(texto).slice(0, 300) || 'Marcação' });
  },

  // Objetos no mapa (autor, 24/10): o mestre põe armadilhas, coberturas, objetos e perigos (visíveis ou ocultos).
  // Objeto no mapa: tipo do catálogo (parede, árvore, mesa…), tamanho em quadrados (l × a) e nome.
  'mapa.objeto'(c, { col, lin, nome, tipo, oculto, l, a }, ctx) {
    exigirMestre(ctx);
    c.mapa ||= novoMapa();
    const t = tipoObjeto(TIPOS_OBJETO_MAPA.includes(tipo) ? tipo : 'objeto');
    const tam = v => Math.max(1, Math.min(20, parseInt(v, 10) || 0)) || null;
    (c.mapa.objetos ||= []).push({ id: uid(), tipo: t.id, nome: nomeStr(nome).slice(0, 80) || t.nome, col: Math.max(0, parseInt(col, 10) || 0), lin: Math.max(0, parseInt(lin, 10) || 0), oculto: !!oculto,
      ...(tam(l) && tam(l) !== (t.l || 1) ? { l: tam(l) } : t.l ? { l: t.l } : {}), ...(tam(a) && tam(a) !== (t.a || 1) ? { a: tam(a) } : t.a ? { a: t.a } : {}) });
  },

  // Pintar (parede, mato, água, entulho): um objeto de 1 quadrado em cada quadrado arrastado (sem repetir).
  'mapa.pintar'(c, { tipo, quadrados }, ctx) {
    exigirMestre(ctx);
    c.mapa ||= novoMapa();
    const t = tipoObjeto(tipo);
    if (!t.pintar) throw erro(`${t.nome} não se pinta: ponha com um clique.`);
    const ja = new Set((c.mapa.objetos || []).filter(o => o.tipo === t.id).map(o => `${o.col}:${o.lin}`));
    for (const q of [].concat(quadrados || []).slice(0, 2000)) {
      const col = Math.max(0, parseInt(q.col, 10) || 0), lin = Math.max(0, parseInt(q.lin, 10) || 0);
      if (ja.has(`${col}:${lin}`)) continue;
      ja.add(`${col}:${lin}`);
      (c.mapa.objetos ||= []).push({ id: uid(), tipo: t.id, nome: t.nome, col, lin, oculto: false });
    }
  },

  // O mestre muda as regras de um objeto (porta aberta, mesa virada = cobertura…) ou o tamanho.
  'mapa.objetoRegras'(c, { id, regras, l, a, nome }, ctx) {
    exigirMestre(ctx);
    const o = (c.mapa?.objetos || []).find(x => x.id === id);
    if (!o) throw erro('Objeto não encontrado.');
    if (regras) {
      const r = {};
      if (['nenhuma', 'parcial', 'total'].includes(regras.cobertura)) r.cobertura = regras.cobertura === 'nenhuma' ? null : regras.cobertura;
      for (const k of ['bloqueia', 'visao', 'dificil']) if (k in regras) r[k] = !!regras[k];
      o.regras = { ...(o.regras || {}), ...r };
    }
    if (l != null) o.l = Math.max(1, Math.min(20, parseInt(l, 10) || 1));
    if (a != null) o.a = Math.max(1, Math.min(20, parseInt(a, 10) || 1));
    if (nome != null) o.nome = nomeStr(nome).slice(0, 80) || o.nome;
  },

  // Modo fantasma: esconde dos jogadores os NPCs que estão fora da visão de todos os PJs (ou mostra todos de novo).
  'mapa.fantasmas'(c, { ocultar = true }, ctx) {
    exigirMestre(ctx);
    const pecas = c.mapa?.pecas || {};
    const ids = ocultar ? foraDaVisaoDosPJs(c) : Object.keys(pecas).filter(id => c.personagens.find(p => p.id === id)?.tipo === 'npc');
    for (const id of ids) if (pecas[id]) pecas[id].oculto = !!ocultar;
    return { ids };
  },

  // Jogador arma uma armadilha que tem pronta no inventário: ela sai do inventário e aparece no mapa (visível).
  'mapa.armar'(c, { id, uid: itemUid, col, lin }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const it = (p.itens || []).find(i => i.uid === itemUid);
    if (!it || !ehArmadilha(it)) throw erro('Escolha uma armadilha pronta no inventário.');
    if ((it.quantidade || 1) > 1) it.quantidade -= 1; else p.itens = p.itens.filter(i => i !== it);
    c.mapa ||= novoMapa();
    (c.mapa.objetos ||= []).push({ id: uid(), tipo: 'armadilha', nome: it.nome, col: Math.max(0, parseInt(col, 10) || 0), lin: Math.max(0, parseInt(lin, 10) || 0), oculto: false, dono: p.id,
      item: { ...it, quantidade: 1 } });
    registrar(c.salas.batalha.log, { autor: p.nome, rotulo: `armou ${it.nome}`, texto: `no mapa (coluna ${(parseInt(col, 10) || 0) + 1}, linha ${(parseInt(lin, 10) || 0) + 1})` });
  },

  // Tirar um objeto do mapa (mestre; ou quem armou a armadilha, que a recolhe de volta ao inventário).
  'mapa.objetoRemover'(c, { id, recolher }, ctx) {
    const o = (c.mapa?.objetos || []).find(x => x.id === id);
    if (!o) return;
    const dono = o.dono ? c.personagens.find(p => p.id === o.dono) : null;
    if (!ctx.mestre && !(dono && dono.donoId === ctx.user.id)) throw erro('Só o mestre (ou quem armou) tira este objeto.');
    if (recolher && dono && o.item) (dono.itens ||= []).push({ ...o.item, uid: uid() });
    c.mapa.objetos = c.mapa.objetos.filter(x => x.id !== id);
  },

  'mapa.objetoMover'(c, { id, col, lin, oculto }, ctx) {
    exigirMestre(ctx);
    const o = (c.mapa?.objetos || []).find(x => x.id === id);
    if (!o) throw erro('Objeto não encontrado.');
    if (col != null) o.col = Math.max(0, parseInt(col, 10) || 0);
    if (lin != null) o.lin = Math.max(0, parseInt(lin, 10) || 0);
    if (oculto != null) o.oculto = !!oculto;
  },

  // ---------- Companheiros (familiares, animais, autômatos, invenções, implantes, montarias) ----------
  // São personagens do jogador ligados a um personagem dele: entram no Campo de Batalha e no mapa como qualquer um,
  // e o dono os controla. Podem nascer do Livro dos Monstros (um animal, uma besta) ou em branco.
  'companheiro.criar'(c, { de, nome, tipo, monstro }, ctx) {
    const dono = personagem(c, de);
    exigirDonoOuMestre(ctx, dono);
    const sis = sistema(c.sistema);
    const t = TIPOS_COMPANHEIRO.find(x => x.id === tipo)?.id || 'outro';
    let p;
    if (monstro) {
      const m = sis.monstros.find(x => x.nome === monstro);
      if (!m) throw erro('Criatura não encontrada no Livro dos Monstros.');
      p = npcDeMonstro(c, m);
    } else {
      const f = novaFicha(sis, c);
      p = { ...f, id: uid(), tipo: 'npc', criatura: t !== 'outro', tipoCriatura: { animal: 'animal', montaria: 'animal', automato: 'automato', invencao: 'maquina', implante: 'maquina' }[t] || 'besta' };
      delete p.sanidade; delete p.humanidade;
    }
    if (!c.grupos.some(g => g.id === 'companheiros')) c.grupos.push({ id: 'companheiros', nome: 'Companheiros' });
    Object.assign(p, { nome: nomeStr(nome).slice(0, 80) || p.nome || 'Companheiro', grupoId: 'companheiros', donoId: dono.donoId || null, companheiroDe: dono.id, companheiroTipo: t });
    c.personagens.push(p);
    registrar(c.log, { autor: dono.nome, rotulo: 'Novo companheiro', texto: `${p.nome} (${TIPOS_COMPANHEIRO.find(x => x.id === t).nome})` });
    return { id: p.id };
  },

  'companheiro.remover'(c, { id }, ctx) {
    const p = personagem(c, id);
    if (!p.companheiroDe) throw erro('Esse personagem não é um companheiro.');
    exigirDonoOuMestre(ctx, p);
    acoes['personagem.remover'](c, { id }, { ...ctx, mestre: true });
    if (c.mapa?.pecas) delete c.mapa.pecas[id];
  },

  'mapa.desmarcar'(c, { id }, ctx) {
    exigirMestre(ctx);
    if (c.mapa) c.mapa.marcas = (c.mapa.marcas || []).filter(m => m.id !== id);
  },

  'mapa.tirar'(c, { id }, ctx) {
    if (!ctx.mestre && !ctx.suporte) throw erro('Só o mestre ou o Suporte mexem no mapa.');
    if (c.mapa) delete c.mapa.pecas[id];
  },

  'mapa.limpar'(c, d, ctx) {
    exigirMestre(ctx);
    if (c.mapa) c.mapa.pecas = {};
  },

  // O mestre libera imagens para o Suporte apresentar.
  'imagem.suporte'(c, { id, liberada }, ctx) {
    exigirMestre(ctx);
    const img = c.imagens.find(i => i.id === id);
    if (img) img.suporte = !!liberada;
  },

  // Contas que podem entrar como Suporte (além da do próprio mestre), pelo nome da conta.
  'suporte.adicionar'(c, { nome }, ctx) {
    exigirMestre(ctx);
    const alvo = db.users.find(u => u.name.toLowerCase() === String(nome || '').trim().toLowerCase());
    if (!alvo) throw erro('Nenhuma conta com esse nome. A pessoa precisa criar a conta antes.');
    c.suportes ||= [];
    if (!c.suportes.includes(alvo.id)) c.suportes.push(alvo.id);
  },

  'suporte.remover'(c, { userId }, ctx) {
    exigirMestre(ctx);
    c.suportes = (c.suportes || []).filter(x => x !== userId);
  },

  // Muda a divisão (Mapas, Cenas, Locais, Personagens, NPCs, Monstros, Itens…) de uma imagem.
  'imagem.categoria'(c, { id, categoria }, ctx) {
    exigirMestre(ctx);
    const img = c.imagens.find(i => i.id === id);
    if (!img) throw erro('Imagem não encontrada.');
    img.categoria = String(categoria || 'Outros').trim().slice(0, 40) || 'Outros';
  },

  'imagem.mostrar'(c, { id, mostrando }, ctx) {
    const img = c.imagens.find(i => i.id === id);
    if (!ctx.mestre && !(ctx.suporte && img?.suporte)) throw erro('Apenas o mestre pode fazer isso.');
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
    if (nome === 'social' && s.testaram) s.testaram = s.testaram.filter(x => x !== id);
    if (nome === 'batalha') { porNoMapa(c, p); garantirCombate(c); }
  },

  'sala.remover'(c, { sala: nome, id }, ctx) {
    const s = sala(c, nome);
    if (!ctx.mestre) exigirDonoOuMestre(ctx, personagem(c, id));
    s.participantes = s.participantes.filter(x => x !== id);
    if (s.ativo === id) s.ativo = null;
    if (s.testaram) s.testaram = s.testaram.filter(x => x !== id);
    sairDoCombate(s, id);
    const quem = c.personagens.find(p => p.id === id);
    terminarCombatePara(c, quem);
    if (nome === 'batalha') encerrarAtivacoes(c, quem, sistema(c.sistema));
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
    const n = parseInt(delta, 10) || 0;
    // Perder PV respeita os temporários (saem por último); curar só devolve os normais.
    if (n < 0) perderPv(p, -n);
    p.pv.atual = Math.min(p.pv.max, Math.max(-p.pv.max, p.pv.atual + Math.max(0, n)));
  },

  // Rolagens acontecem no servidor para todos verem o mesmo resultado.
  // Rolagens acontecem no servidor para todos verem o mesmo resultado.
  // Teste D-MIL: { acaoRef | acao, mod, nd, metade }. Iniciativa: { tipo: 'iniciativa' }. Livre: { dado: '2d6' }.
  'rolar'(c, { sala: nome, id, rotulo, tipo, acaoRef, acao, mod, nd, metade, dado, secreta, modo }, ctx) {
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
      const r = p ? rolarIniciativa(p, sis) : { dados: rolarDado('1d10').dados, agi: 0, vantagem: false };
      entrada = { ...base, tipo: 'iniciativa', rotulo: r.vantagem ? 'Iniciativa (vantagem)' : 'Iniciativa', dado: r.vantagem ? '2d10, maior' : '1d10', dados: r.dados, mod: 0,
        componentes: [{ nome: 'AGI', valor: r.agi }], total: r.agi + Math.max(...r.dados) };
    } else if (tipo === 'atributos') {
      if (!sis.regras.rolagemAtributos) throw erro(`O ${sis.nome} não tem rolagem de atributos.`);
      const r = rolarAtributosCriacao(sis);
      entrada = { ...base, tipo: 'atributos', rotulo: 'Atributos (rolagem da criação)', valores: r.valores, total: r.soma, rerolagens: r.rerolagens };
    } else if (dado) {
      const r = rolarDado(dado);
      entrada = { ...base, rotulo: String(rotulo || dado).slice(0, 80), dado: r.expr, dados: r.dados, mod: r.mod, componentes: [], total: r.total };
    } else {
      const a = acaoRef && p ? valorAcao(p, acaoRef, sis) : { valor: parseInt(acao, 10) || 0, nome: String(rotulo || 'Teste').slice(0, 80) };
      // No sistema com módulo social, o humor do personagem entra no modificador (ex.: Apático −5%).
      const modificador = Math.max(-100, Math.min(100, parseInt(mod, 10) || 0)) + (p ? modHumorTestes(p, sis) : 0);
      const ndNum = nd === '' || nd == null ? null : Math.max(0, parseInt(nd, 10) || 0);
      // Vantagem/desvantagem: escolhida no rolador, ou automática por habilidade ligada (ex.: Zona de Abate em Briga › Deslocar).
      const alvosRef = !acaoRef ? [] : acaoRef.startsWith('sub:') ? [acaoRef.slice(4), acaoRef.slice(4).split('.')[0]] : acaoRef.startsWith('per:') ? [acaoRef.slice(4)] : [];
      const porHabilidade = p && alvosRef.length && vantagemPorHabilidade(p, sis, alvosRef);
      const pedido = ['vantagem', 'desvantagem'].includes(modo) ? modo : null;
      // O humor também entra sozinho (ex.: Atraído → Percepção em desvantagem).
      const pelHumor = p ? modoHumorTeste(p, sis, acaoRef) : { vantagem: false, desvantagem: false };
      const modoFinal = modoRolagem(pedido === 'vantagem' || porHabilidade || pelHumor.vantagem, pedido === 'desvantagem' || pelHumor.desvantagem);
      const motivo = [porHabilidade && modoFinal === 'vantagem' ? 'habilidade' : null, (pelHumor.vantagem || pelHumor.desvantagem) && modoFinal ? `humor ${pelHumor.humor}` : null].filter(Boolean).join(', ');
      const r = testeDMil(a.valor + modificador, ndNum, sis, { metade: !!metade, modo: modoFinal });
      entrada = { ...base, tipo: 'dmil', rotulo: `${String(rotulo || a.nome).slice(0, 80)}${modoFinal ? ` (${modoFinal}${motivo ? ` — ${motivo}` : ''})` : ''}`, acaoNome: a.nome, mod: modificador, metade: !!metade, ...r };
    }
    if (nome && c.salas[nome]) registrar(c.salas[nome].log, entrada);
    else registrar(c.log, entrada);
    return entrada;
  },

  // ---------- Combate automático (MSS) ----------
  // Controle de turno (iniciativa, rodadas e vez) vale em qualquer sistema; o ataque automático só no MSS.
  'combate.iniciar'(c, d, ctx) {
    exigirMestre(ctx);
    if (c.salas.batalha.participantes.length < 2) throw erro('Coloque ao menos dois participantes no Campo de Batalha.');
    iniciarCombate(c);
  },

  // O mestre corrige a iniciativa de alguém; a ordem se refaz e a vez continua com quem estava.
  'combate.iniciativa'(c, { id, ini }, ctx) {
    exigirMestre(ctx);
    const cb = c.salas.batalha.combate;
    const o = cb?.ordem.find(x => x.id === id);
    if (!o) throw erro('Esse personagem não está na ordem de iniciativa.');
    const atual = cb.ordem[cb.vez]?.id;
    o.ini = Math.max(-99, Math.min(999, parseInt(ini, 10) || 0));
    ordenarIniciativa(cb);
    cb.vez = Math.max(0, cb.ordem.findIndex(x => x.id === atual));
  },

  'combate.proximo'(c, d, ctx) {
    const s = c.salas.batalha;
    const cb = s.combate;
    if (!cb) throw erro('Não há combate em andamento.');
    const atual = c.personagens.find(p => p.id === cb.ordem[cb.vez]?.id);
    if (!ctx.mestre && atual?.donoId !== ctx.user.id) throw erro('Só quem está no turno (ou o mestre) passa a vez.');
    const sis = sistema(c.sistema);
    // Fim do turno de quem estava agindo: os efeitos com tempo descontam um turno.
    if (atual) {
      const notasEfeitos = [...passarTurnoEfeitos(atual, sis), ...cargaNoTurno(atual, derivados(atual, sis)), ...passarTurnoHabilidades(atual)];
      if (notasEfeitos.length) registrar(s.log, { autor: atual.nome, rotulo: 'Efeitos', texto: notasEfeitos.join(' · ') });
    }
    // Ofertas de ação extra (Quebra-Hordas, Guerras diplomáticas) valem só no turno em que surgiram.
    s.ofertas = [];
    cb.vez++;
    cb.turno = (cb.turno || 1) + 1;
    if (cb.vez >= cb.ordem.length) {
      cb.vez = 0;
      cb.rodada++;
      registrar(s.log, { autor: 'Mestre', rotulo: `Rodada ${cb.rodada}`, texto: 'nova rodada' });
    }
    const p = c.personagens.find(x => x.id === cb.ordem[cb.vez].id);
    s.ativo = p.id;
    // Novo turno: ação principal, de movimento e bônus voltam (a reação volta a cada rodada).
    if (cb.gasto?.[p.id]) { const r = cb.gasto[p.id]; cb.gasto[p.id] = { reacao: r.reacao || 0, reacaoRodada: r.reacaoRodada }; }
    const nota = sobrevida(p, sis);
    if (nota) registrar(s.log, { autor: p.nome, rotulo: 'Sobrevida', texto: nota });
  },

  // Quantos turnos faltam num efeito (0 tira o efeito). O tempo varia: vem da regra ou da habilidade que causou.
  'efeito.turnos'(c, { id, efeito, turnos }, ctx) {
    const p = personagem(c, id);
    exigirMestre(ctx); // só o mestre cancela ou muda a duração dos efeitos
    const sis = sistema(c.sistema);
    const cond = (sis.condicoes || []).find(x => x.id === efeito);
    if (!cond) throw erro('Efeito desconhecido.');
    const n = Math.max(0, Math.min(99, parseInt(turnos, 10) || 0));
    if (!n) {
      p.marcadores = (p.marcadores || []).filter(m => !String(m).toLowerCase().startsWith(cond.nome.toLowerCase()));
      sincronizarEfeitos(p, sis);
      return;
    }
    sincronizarEfeitos(p, sis);
    p.efeitos ||= {};
    p.efeitos[cond.id] = { ...(p.efeitos[cond.id] || { qtd: 1, perdidos: 0 }), turnos: n };
  },

  'combate.ordenar'(c, { id, direcao }, ctx) {
    exigirMestre(ctx);
    const cb = c.salas.batalha.combate;
    if (!cb) return;
    const atual = cb.ordem[cb.vez]?.id;
    const i = cb.ordem.findIndex(o => o.id === id);
    const j = i + (direcao < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= cb.ordem.length) return;
    [cb.ordem[i], cb.ordem[j]] = [cb.ordem[j], cb.ordem[i]];
    cb.vez = cb.ordem.findIndex(o => o.id === atual);
  },

  'combate.encerrar'(c, d, ctx) {
    exigirMestre(ctx);
    const s = c.salas.batalha;
    if (!s.combate) return;
    registrar(s.log, { autor: 'Mestre', rotulo: 'Combate encerrado', texto: `após ${s.combate.rodada} rodada(s)` });
    const ids = s.combate.ordem.map(o => o.id);
    s.combate = null;
    for (const id of ids) terminarCombatePara(c, c.personagens.find(p => p.id === id));
    s.ativo = null;
  },

  // O atacante declara o ataque; ele fica esperando a defesa que o defensor (ou o mestre, nos NPCs) escolher.
  'combate.atacar'(c, { atacante, alvo, opcoes }, ctx) {
    const sis = sistema(c.sistema);
    exigirModulo(sis, 'combate');
    const s = c.salas.batalha;
    const a = personagem(c, atacante);
    const b = personagem(c, alvo);
    exigirDonoOuMestre(ctx, a);
    if (a.id === b.id) throw erro('Escolha outro alvo.');
    if (!s.participantes.includes(a.id) || !s.participantes.includes(b.id)) throw erro('Atacante e alvo precisam estar no Campo de Batalha.');
    if (!a.pv || !b.pv) throw erro('Os dois precisam ter PV na ficha.');
    const op = { ...(opcoes || {}) };
    if (!ctx.mestre) { delete op.vantagem; delete op.desvantagem; delete op.danoLivre; delete op.ignorarCoberturaMapa; }
    delete op.coberturaDoMapa;
    // Cobertura pelo mapa (ataque a distância, antes de gastar qualquer coisa): parcial = −30%; total = sem linha de tiro.
    if (!op.multiplo) coberturaDoAtaque(c, a, b, op, sis);
    // Mãos: a hábil ataca sem ônus e a inábil com −20%. Dois ataques no turno, um com cada mão ("Dois ataques" no
    // primeiro): hábil −20% e inábil −40%, e o segundo não gasta outra ação. Ambidestria: sem mão inábil, e nos dois
    // ataques só o segundo tem −20%.
    const segundaMao = maosDoAtaque(c, a, op, sis);
    // Civilizados (Encantado): quem ele não atacou precisa passar em WILL% Difícil para atacá-lo.
    const barrado = civilizados(c, a, b, sis);
    if (barrado) return barrado;
    // Economia do turno: o ataque gasta a ação principal; fora do próprio turno, é reação (ex.: ataque de oportunidade).
    // Ataque extra de habilidade (Quebra-Hordas) não gasta.
    const cbA = s.combate;
    // Ataque especial: gasta a ação dele (a do livro; sem ela, a principal). Fora do turno, a reação.
    let especial = null;
    if (op.especial) {
      especial = listaHabilidades(a, sis).find(x => x.id === op.especial);
      if (!especial) throw erro(`${a.nome} não tem essa habilidade.`);
    }
    const foraDoTurno = cbA && cbA.ordem[cbA.vez]?.id !== a.id;
    const tipoAcao = especial ? (foraDoTurno ? 'reacao' : acaoDoAtaqueEspecial(a, sis, especial)) : foraDoTurno ? 'reacao' : 'principal';
    // Mira: +30% neste ataque, gastando a ação de movimento. Instável (SAN abaixo de 16) não pode mirar (livro).
    if (op.mira && a.sanidade && a.sanidade.atual < 16) throw erro(`${a.nome} está Instável (SAN abaixo de 16): não pode mirar.`);
    let excesso = op.extra || op.multiplo || segundaMao ? null : gastarAcao(c, a, tipoAcao);
    if (op.mira && !op.multiplo) {
      const m = gastarAcao(c, a, 'movimento');
      if (m) excesso = [excesso, m].filter(Boolean).join('; ');
    }
    agressaoSubita(c, a, b, sis);
    const notasAgir = efeitosAoAgir(a, sis);
    if (notasAgir.length) registrar(s.log, { autor: a.nome, rotulo: 'Efeitos', texto: notasAgir.join(' · ') });
    const arma = armasDisponiveis(a, sis).find(x => x.uid === (op.armaUid || 'desarmado'));
    if (!arma) throw erro('Arma não equipada.');
    // Munição: cada ataque com arma de fogo gasta 1 (cadência natural).
    const itemArma = (a.itens || []).find(i => i.uid === arma.uid);
    // Cadência: a arma dispara "cadência" balas por ataque (com menos balas, dispara as que tiver).
    op.disparos = arma.cadencia || 1;
    // Vários alvos: a munição sai só no primeiro (é um único ataque).
    if (itemArma?.capacidade && !op.multiplo) {
      if ((itemArma.carregada || 0) < 1) throw erro(`${itemArma.nome} está sem munição. Recarregue antes de atirar.`);
      op.disparos = Math.min(op.disparos, itemArma.carregada);
      itemArma.carregada -= op.disparos;
    }
    if (op.danoLivre) {
      try { rolarDado(op.danoLivre); } catch { throw erro(`Dano inválido: ${op.danoLivre}`); }
    }
    if (op.investida != null && !temHabilidade(a, sis, 'Maquina Implacavel')) delete op.investida;
    // Carga do Núcleo: +2d6 elétrico neste ataque (gasta 1 carga; com coração humano, 1d6 de dano em quem usa).
    if (op.cargaNucleo) {
      try { gastarRecurso(a, sis, 'nucleo', 1); } catch (e) { throw erro(e.message); }
      registrar(s.log, { autor: a.nome, rotulo: 'Carga do Núcleo', texto: `+2d6 elétrico no ataque${cargaNoCoracao(a)}` });
    }
    const pend = { id: uid(), atacante: a.id, alvo: b.id, opcoes: op, arma: arma.nome, alcance: arma.alcance, area: !!op.area, em: Date.now(), municao: itemArma?.capacidade ? itemArma.uid : null,
      armaTipo: tipoDaArma(arma), tipoDano: arma.tipoDano || null };
    // Contra tiro, ou com o alvo pego de surpresa, não há defesa a escolher: resolve na hora.
    if (op.surpresa || opcoesDefesa(b, arma, sis, { area: pend.area }).length === 1) return { ...resolverPendente(c, s, pend, 'nenhuma', sis), excesso };
    (s.pendentes ||= []).push(pend);
    registrar(s.log, { autor: a.nome, rotulo: `${a.nome} ataca ${b.nome} com ${arma.nome}${op.area ? ' (área)' : ''}`, texto: `aguardando a defesa de ${b.nome}` });
    return { ...pend, excesso };
  },

  // Ataque contra vários alvos (em área ou não): um ataque só (uma ação, uma munição), resolvido contra cada alvo,
  // que se defende sozinho (em área, com Evasão: metade do dano se passar).
  'combate.atacarVarios'(c, { atacante, alvos, opcoes }, ctx) {
    const lista = [...new Set(Array.isArray(alvos) ? alvos : [])].filter(id => id && id !== atacante);
    if (lista.length < 2) throw erro('Escolha pelo menos dois alvos.');
    if (lista.length > LIMITE_SALA) throw erro('Alvos demais.');
    const resultados = [];
    lista.forEach((alvo, i) => {
      const r = acoes['combate.atacar'](c, { atacante, alvo, opcoes: { ...(opcoes || {}), ...(i > 0 ? { multiplo: true } : {}) } }, ctx);
      resultados.push({ alvo, ...r });
    });
    return { tipo: 'varios', resultados, excesso: resultados[0]?.excesso || null };
  },

  // Ataque em área marcado no mapa (círculo, cone, linha): o servidor recalcula os quadrados e ataca quem está dentro
  // (aliados também). Um ataque só (uma ação, uma munição); cada um se defende com Evasão (metade do dano).
  'combate.atacarArea'(c, { atacante, forma, metros, ponto, opcoes }, ctx) {
    const a = personagem(c, atacante);
    exigirDonoOuMestre(ctx, a);
    if (!FORMAS_AREA.some(f => f.id === forma)) throw erro('Escolha a forma da área (círculo, cone ou linha).');
    const m = Math.max(1.5, Math.min(60, Number(metros) || 0));
    const origem = c.mapa?.pecas?.[a.id];
    if (!c.mapa?.imagemId || !origem) throw erro(`${a.nome} precisa estar no mapa para marcar a área.`);
    const x = Number(ponto?.x), y = Number(ponto?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw erro('Marque a área no mapa.');
    const quadrados = quadradosDaArea({ forma, metros: m, origem: { ...origem, lado: ladoNoMapa(a) }, ponto: { x, y }, colunas: 999, linhas: 999 });
    const s = c.salas.batalha;
    const alvos = atingidosPelaArea(quadrados, c.mapa.pecas, c.personagens, [a.id]).filter(id => s.participantes.includes(id));
    const nomeForma = FORMAS_AREA.find(f => f.id === forma).nome.replace(/\s*\(.*$/, '').toLowerCase();
    registrar(s.log, { autor: a.nome, rotulo: `Ataque em área (${nomeForma} de ${String(m).replace('.', ',')} m)`,
      texto: alvos.length ? `pega ${alvos.map(id => personagem(c, id).nome).join(', ')}` : 'não pegou ninguém' });
    if (!alvos.length) {
      // Errou todo mundo: gasta a ação (e a munição) mesmo assim.
      const excesso = gastarAcao(c, a, c.salas.batalha.combate?.ordem[c.salas.batalha.combate.vez]?.id === a.id ? 'principal' : 'reacao');
      return { tipo: 'area', resultados: [], excesso };
    }
    const op = { ...(opcoes || {}), area: true };
    const resultados = alvos.map((alvo, i) => ({ alvo, ...acoes['combate.atacar'](c, { atacante: a.id, alvo, opcoes: { ...op, ...(i > 0 ? { multiplo: true } : {}) } }, ctx) }));
    return { tipo: 'area', resultados, excesso: resultados[0]?.excesso || null, quadrados: quadrados.size };
  },

  // Oferta de ação extra (Quebra-Hordas, Guerras diplomáticas): quem controla o atacante aceita (com o alvo) ou dispensa.
  'combate.oferta'(c, { id, aceitar, alvo }, ctx) {
    const sis = sistema(c.sistema);
    const s = c.salas.batalha;
    const of = (s.ofertas || []).find(x => x.id === id);
    if (!of) throw erro('Essa oferta já passou.');
    const a = personagem(c, of.personagem);
    exigirDonoOuMestre(ctx, a);
    s.ofertas = s.ofertas.filter(x => x.id !== id);
    if (!aceitar) return null;
    const b = personagem(c, alvo || of.alvos[0]);
    if (!of.alvos.includes(b.id)) throw erro('Esse alvo não vale para esta ação.');
    if (of.tipo === 'quebraHordas') {
      const cb = s.combate;
      a.quebraHordasEm = cb ? `${cb.rodada}:${cb.turno}` : 'livre';
      return acoes['combate.atacar'](c, { atacante: a.id, alvo: b.id, opcoes: { armaUid: of.armaUid, extra: 'Quebra-Hordas' } }, ctx);
    }
    if (of.tipo === 'reacao') {
      // Ataque especial de reação: ataca quem atacou (fora do turno gasta a reação; ação livre não gasta nada).
      if (of.ataque) {
        const arma = armasDisponiveis(a, sis).find(x => x.uid !== 'desarmado') || armasDisponiveis(a, sis)[0];
        const r = acoes['combate.atacar'](c, { atacante: a.id, alvo: b.id, opcoes: { armaUid: arma.uid, ...(of.acao === 'livre' ? { extra: of.habilidade } : {}) } }, ctx);
        registrar(s.log, { autor: a.nome, rotulo: `${of.habilidade} (${nomeAcao(of.acao)})`, texto: `contra ${b.nome}` });
        return r;
      }
      // Habilidade de ativar (Despertar quando atacado): ativa de verdade, gastando a ação da oferta (livre ou reação).
      const hab = listaHabilidades(a, sis).find(x => x.id === of.habId);
      if (hab?.regra?.modo === 'ativar') return ativarHabilidade(c, a, sis, hab, { ctx, acao: of.acao });
      if (hab && duracaoDaHabilidade(hab)) return usarHabilidade(c, a, sis, hab, of.acao);
      const excesso = gastarAcao(c, a, of.acao);
      registrar(s.log, { autor: a.nome, rotulo: `${a.nome} usa ${of.habilidade}`, texto: `${nomeAcao(of.acao)}${excesso ? ` · atenção: ${excesso}` : ''}` });
      return { texto: `${a.nome} usou ${of.habilidade} (${nomeAcao(of.acao)}).`, excesso };
    }
    if (of.tipo === 'guerrasDiplomaticas') {
      const da = derivados(a, sis), db = derivados(b, sis);
      const nd = (db.percentual.WILL ?? 0) + 30;
      const t = testeContra(da.subpericias['manipulacao.intimidacao'] ?? 0, nd, sis);
      // Passou: o adversário volta à situação dos Civilizados (para atacar de novo, precisa do teste de WILL% Difícil).
      if (t.sucesso) {
        a.atacouNoCombate = (a.atacouNoCombate || []).filter(x => x !== b.id);
        b.passouCivilizado = (b.passouCivilizado || []).filter(x => x !== a.id);
      }
      const texto = `Intimidação ${t.total} (d100 ${t.dp} + ${t.acao}) contra WILL% + 30 = ${nd}: ${t.sucesso ? `${b.nome} para de atacar e volta à situação dos Civilizados` : `${b.nome} continua lutando`}`;
      registrar(s.log, { autor: a.nome, rotulo: `Guerras diplomáticas contra ${b.nome}`, texto, sucesso: t.sucesso });
      return { texto, sucesso: t.sucesso };
    }
    throw erro('Oferta desconhecida.');
  },

  // Habilidade de "ativar": custo (HUM, cargas), usos por descanso, item exigido, duração (turnos ou o combate) e efeito especial.
  'habilidade.ativar'(c, { id, hab: habId, alvo }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const hab = listaHabilidades(p, sis).find(x => x.id === habId);
    if (!hab || hab.regra?.modo !== 'ativar') throw erro('Essa habilidade não é de ativar.');
    return ativarHabilidade(c, p, sis, hab, { ctx, alvo });
  },

  // Usar uma habilidade que gasta ação mas não tem regra própria. Se ela dura um tempo (Despertar, Adaptação corpórea…),
  // fica ativa (ícone no personagem) e não pode ser usada de novo enquanto durar, a não ser que o texto permita.
  'habilidade.usar'(c, { id, hab: habId }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const hab = listaHabilidades(p, sis).find(x => x.id === habId);
    if (!hab) throw erro(`${p.nome} não tem essa habilidade.`);
    if (hab.regra?.modo === 'ativar') return ativarHabilidade(c, p, sis, hab, { ctx });
    return usarHabilidade(c, p, sis, hab);
  },

  // O mestre encerra uma habilidade ativa antes do fim (clicando no ícone dela no personagem).
  'habilidade.encerrar'(c, { id, hab: habId }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    if (!p.habAtivas?.[habId]) throw erro('Essa habilidade não está ativa.');
    encerrarHabilidade(c, p, { id: habId, nome: p.habAtivas[habId].nome, regra: regraDaHabilidade(p.habAtivas[habId].nome, sistema(c.sistema)) });
    return null;
  },

  // Marcar (ou desmarcar) uma ação do turno: mover, sacar, usar uma habilidade… Anota no registro com o que foi feito.
  'combate.acao'(c, { id, tipo, rotulo, desfazer }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    if (!c.salas.batalha.combate) throw erro('Não há combate em andamento.');
    if (!TIPOS_ACAO.some(t => t.id === tipo)) throw erro('Tipo de ação desconhecido.');
    const excesso = gastarAcao(c, p, tipo, { desfazer: !!desfazer });
    if (rotulo && !desfazer) registrar(c.salas.batalha.log, { autor: p.nome, rotulo: String(rotulo).slice(0, 80), texto: `${nomeAcao(tipo)}${excesso ? ` · atenção: ${excesso}` : ''}` });
    return { excesso, gasto: c.salas.batalha.combate.gasto?.[p.id] || {} };
  },

  // Gastar 1 carga de um recurso fora do ataque (Núcleo energético servindo de bateria).
  'habilidade.recurso'(c, { id, recurso }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    let r;
    try { r = gastarRecurso(p, sis, recurso, 1); } catch (e) { throw erro(e.message); }
    const texto = `1 carga usada como bateria (restam ${r.restantes - 1})${cargaNoCoracao(p)}`;
    registrar(c.salas.batalha.log, { autor: p.nome, rotulo: r.nome, texto });
    return { texto };
  },

  // Dano ao sistema (Emissor Neural): Computação › Operacional, Normal contra drone/autômato/máquina, Difícil contra item na mão de alguém.
  'habilidade.danoSistema'(c, { id, alvo }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    if (!temHabilidade(p, sis, 'Dano ao sistema')) throw erro(`${p.nome} não tem Dano ao sistema.`);
    const b = personagem(c, alvo);
    const maquina = ['drone', 'automato', 'maquina'].includes(tipoCriatura(b));
    const dif = sis.teste.dificuldades.find(x => x.nome === (maquina ? 'Normal' : 'Difícil')) || { nome: maquina ? 'Normal' : 'Difícil', nd: maquina ? 70 : 90 };
    const d = derivados(p, sis);
    const t = testeContra(d.subpericias['computacao.operacional'] ?? 0, dif.nd, sis);
    let texto = `Computação › Operacional ${t.total} (d100 ${t.dp} + ${t.acao}) contra ${dif.nome} ${dif.nd}: `;
    if (!t.sucesso) texto += 'falhou';
    else {
      const regra = regraDaHabilidade('Dano ao sistema', sis);
      const rol = rolarDado(String(regra?.dano || '2d6').replace(/MOD\s*INT/i, String(d.mod.INT || 0)).replace('+-', '-'));
      if (maquina && b.pv) {
        const ip = ipContra(b, sis, 'Elétrico');
        const dano = Math.max(sis.combate?.danoMinimo ?? 0, rol.total - ip);
        perderPv(b, dano);
        texto += `${dano} de dano elétrico em ${b.nome} [${rol.dados.join(', ')}]${ip ? ` − IP ${ip}` : ''} (${textoPv(b)} PV)`;
      } else texto += `${rol.total} de dano elétrico num item de ${b.nome} [${rol.dados.join(', ')}] — o mestre aplica no item`;
    }
    registrar(c.salas.batalha.log, { autor: p.nome, rotulo: `Dano ao sistema em ${b.nome}`, texto, sucesso: t.sucesso });
    return { texto, sucesso: t.sucesso };
  },

  'combate.defender'(c, { id, defesa }, ctx) {
    const sis = sistema(c.sistema);
    exigirModulo(sis, 'combate');
    const s = c.salas.batalha;
    const pend = (s.pendentes || []).find(x => x.id === id);
    if (!pend) throw erro('Esse ataque já foi resolvido.');
    const b = personagem(c, pend.alvo);
    if (!ctx.mestre && b.donoId !== ctx.user.id) throw erro('Só quem controla o alvo (ou o mestre) escolhe a defesa.');
    return resolverPendente(c, s, pend, defesa, sis);
  },

  'combate.cancelar'(c, { id }, ctx) {
    const s = c.salas.batalha;
    const pend = (s.pendentes || []).find(x => x.id === id);
    if (!pend) return;
    const a = personagem(c, pend.atacante);
    if (!ctx.mestre && a.donoId !== ctx.user.id) throw erro('Só quem atacou (ou o mestre) cancela.');
    s.pendentes = s.pendentes.filter(x => x.id !== id);
    // Ataque cancelado devolve a bala.
    const arma = pend.municao && a.itens.find(i => i.uid === pend.municao);
    if (arma) arma.carregada = Math.min(arma.capacidade, (arma.carregada || 0) + (pend.opcoes?.disparos || 1));
  },

  'combate.ip'(c, { id, ipExtra, rmnpExtra }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    if (ipExtra !== undefined) p.ipExtra = Math.max(0, Math.min(99, parseInt(ipExtra, 10) || 0));
    if (rmnpExtra !== undefined) p.rmnpExtra = Math.max(-100, Math.min(100, parseInt(rmnpExtra, 10) || 0));
  },

  // ---------- Humor (Roda do Humor) e Máscara ----------
  // camada "real": o humor verdadeiro (dá os bônus e ônus). camada "aparente": a máscara que a sala vê (null = igual ao real).
  // Rebote nunca é obrigatório: o alvo pode não reagir e manter o humor que tinha.
  'humor.recusarRebote'(c, { id }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    if (!(p.humorOpcoes || []).length) return;
    p.humorOpcoes = [];
    const nome = sistema(c.sistema).social?.humores.find(x => x.id === (p.humor || 'neutro'))?.nome || 'Neutro';
    registrar(c.salas.social.log, { autor: p.nome, rotulo: 'Rebote', secreta: true, texto: `${p.nome} não reage e continua ${nome}.` });
  },

  'humor.definir'(c, { id, humor, camada = 'real' }, ctx) {
    const sis = sistema(c.sistema);
    exigirModulo(sis, 'social');
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const nomeH = hid => sis.social.humores.find(x => x.id === hid)?.nome || 'Neutro';
    if (camada === 'aparente') {
      if (humor && !sis.social.humores.some(x => x.id === humor)) throw erro('Humor desconhecido.');
      // Pode ser igual ao humor real (padrão: Neutro). A troca é segredo: o registro público não conta.
      p.humorAparente = humor || 'neutro';
      registrar(c.salas.social.log, { autor: p.nome, rotulo: `Humor aparente de ${p.nome}`, texto: `mostrando ${nomeH(p.humorAparente)}`, privadoPara: ctx.user.id });
      return;
    }
    const h = sis.social.humores.find(x => x.id === humor);
    if (!h) throw erro('Humor desconhecido.');
    // Rebote: o alvo escolhe entre as opções da matriz (sem custo; o humor fica imposto).
    // Com a manipulação oculta, só o mestre resolve o rebote.
    const doRebote = ctx.mestre && (p.humorOpcoes || []).includes(h.id);
    // O jogador escolhe o humor só ANTES de entrar na Sala Social, e só entre Amigável, Neutro e Indisposto
    // (habilidades como Irreverente liberam outros e a troca dentro da sala).
    if (!ctx.mestre && !doRebote) {
      const lib = liberdadeDeHumor(p, sis);
      if (!lib.humores.some(x => x.id === h.id)) throw erro('Você só escolhe Amigável, Neutro ou Indisposto; os outros humores vêm de manipulação, da empatia natural ou do mestre.');
      if (c.salas.social.participantes.includes(p.id) && !lib.naSala) throw erro('Dentro da Sala Social o humor só muda por manipulação ou pela empatia natural. Escolha o humor antes de entrar.');
    }
    if ((p.humor || 'neutro') === h.id && !doRebote) return;
    let texto = h.nome;
    if (doRebote) {
      texto += ' (rebote)';
    } else if (!ctx.mestre && h.id === 'apatico') {
      // Apático: resistir a um efeito social custa só Humanidade (temporária).
      const r = rolarDado(h.danoHumanidade || '1d6');
      danoTemporario(p, 'humanidade', r.total);
      texto += ` — perde ${r.total} de Humanidade temporária (${p.humanidade?.atual ?? '-'})`;
    } else if (!ctx.mestre && p.humorImposto && p.sanidade) {
      // Dissonância: agir contra o humor imposto — a mente racha: dano de Sanidade temporária.
      const r = rolarDado(sis.social.dissonancia?.dano || '1d6');
      danoTemporario(p, 'sanidade', r.total);
      texto += ` — quebrou o humor imposto (${nomeH(p.humor)}): perde ${r.total} de Sanidade temporária (${p.sanidade.atual})`;
    }
    p.humor = h.id;
    p.humorOpcoes = [];
    p.humorImposto = doRebote || (ctx.mestre && h.id !== 'neutro');
    // O humor real é íntimo: a sala só vê o aparente, então a mudança fica só para o dono (e o mestre).
    registrar(c.salas.social.log, { autor: p.nome, rotulo: `Humor de ${p.nome}`, texto: `${texto} (a sala vê ${nomeH(humorAparente(p))})`,
      privadoPara: p.donoId || ctx.user.id, secreta: doRebote || undefined });
  },

  // Descanso curto ou longo (mestre): regenera PV (e Sanidade no longo), testa os marcadores, recarrega capacidades.
  // Sem "ids", vale para todos os personagens-jogador da campanha.
  'descanso.fazer'(c, { tipo, ids, confortavel = true, abrigado = true, ergonomico = true, interrompido = false }, ctx) {
    if (!['curto', 'longo'].includes(tipo)) throw erro('Escolha descanso curto ou longo.');
    const sis = sistema(c.sistema);
    // Sem "ids": todos os personagens-jogador (só o mestre). O jogador descansa os próprios personagens,
    // no máximo 1 descanso longo e 2 curtos (refeições) por dia do relógio da campanha.
    if (!ctx.mestre && !ids?.length) throw erro('Escolha o personagem que vai descansar.');
    const alvos = (ids?.length ? ids.map(id => personagem(c, id)) : c.personagens.filter(p => p.tipo === 'pj'));
    if (!alvos.length) throw erro('Nenhum personagem para descansar.');
    for (const p of alvos) exigirDonoOuMestre(ctx, p);
    const dia = Math.floor((c.relogio?.horas || 0) / 24);
    if (!ctx.mestre) {
      for (const p of alvos) {
        const usos = p.descansosDoDia?.dia === dia ? p.descansosDoDia : { dia, curto: 0, longo: 0 };
        if (tipo === 'longo' && usos.longo >= 1) throw erro(`${p.nome} já fez o descanso longo de hoje. Peça ao mestre para passar o tempo.`);
        if (tipo === 'curto' && usos.curto >= 2) throw erro(`${p.nome} já fez as 2 refeições (descansos curtos) de hoje.`);
      }
    }
    const linhas = [];
    for (const p of alvos) {
      const notas = [];
      // Confortável: dorme sem armadura nem armas (são tiradas antes de dormir).
      if (tipo === 'longo' && confortavel) {
        const tirados = (p.itens || []).filter(i => i.equipado && (i.tipo === 'defesa' || i.tipo === 'arma'));
        for (const i of tirados) i.equipado = false;
        if (tirados.length) notas.push(`guardou para dormir: ${tirados.map(i => i.nome).join(', ')}`);
      }
      const d = derivados(p, sis);
      notas.push(...descansar(p, sis, tipo, d.pvMax, { confortavel, abrigado, ergonomico, interrompido, CAR: d.percentual.CAR ?? 0 }, d.percentual.CONS ?? 0));
      // Descanso curto é a refeição (meia ração); o longo, se não foi interrompido, tira o Sono.
      if (tipo === 'curto') notas.push(comer(p, sis));
      if (tipo === 'longo' && !interrompido) { const dormiu = dormir(p, sis); if (dormiu) notas.push(dormiu); else (p.necessidades ||= { comida: 0, agua: 0, sono: 0 }).sono = 0; }
      // Descansar encerra as habilidades que duram "até o próximo descanso" (Adaptação corpórea…).
      encerrarAtivacoes(c, p, sis, false);
      // Descanso longo recarrega os usos de habilidades "por descanso longo" (Juggernaut, Carga de Emergência…).
      if (tipo === 'longo' && !interrompido && p.usos) {
        for (const k of Object.keys(p.usos)) if (sis.habilidadesRegras?.[k]?.usos?.recarga === 'descanso-longo') delete p.usos[k];
      }
      // …e os recursos (Cargas do Núcleo).
      if (tipo === 'longo' && !interrompido && p.recursos) {
        const recarrega = new Set(Object.values(sis.habilidadesRegras || {}).filter(r => r.recurso?.recarga === 'descanso-longo').map(r => r.recurso.id));
        for (const k of Object.keys(p.recursos)) if (recarrega.has(k)) delete p.recursos[k];
      }
      sincronizarEfeitos(p, sis);
      notas.push(...lembretesDescanso(p, sis, tipo));
      const usos = p.descansosDoDia?.dia === dia ? p.descansosDoDia : { dia, curto: 0, longo: 0 };
      usos[tipo] += 1;
      p.descansosDoDia = usos;
      linhas.push(`${p.nome}: ${notas.filter(Boolean).join(', ') || 'nada a recuperar'}`);
    }
    const nome = tipo === 'longo' ? (interrompido ? 'Descanso longo interrompido' : 'Descanso longo') : 'Descanso curto';
    registrar(c.log, { autor: ctx.mestre ? 'Mestre' : alvos[0].nome, rotulo: nome, texto: linhas.join(' · ') });
    return { linhas };
  },

  // Relógio da campanha: o mestre passa o tempo de 6 em 6 horas. Cada personagem-jogador conta as horas sem comer,
  // sem beber e sem dormir (Fome, Sede, Sono). Virou o dia: confere o clima (caos meteorológico).
  'tempo.passar'(c, { horas = 6 }, ctx) {
    exigirMestre(ctx);
    const h = Math.max(1, Math.min(24, parseInt(horas, 10) || 6));
    const sis = sistema(c.sistema);
    c.relogio ||= { horas: 0 };
    const diaAntes = Math.floor(c.relogio.horas / 24);
    c.relogio.horas += h;
    const linhas = [];
    for (const p of c.personagens.filter(x => x.tipo === 'pj' && !(x.marcadores || []).includes('Morto'))) {
      const notas = passarNecessidades(p, sis, h, derivados(p, sis).percentual.CONS ?? 0);
      sincronizarEfeitos(p, sis);
      if (notas.length) linhas.push(`${p.nome}: ${notas.join(', ')}`);
    }
    registrar(c.log, { autor: 'Mestre', rotulo: `+${h} h — ${descreverRelogio(c.relogio.horas)}`, texto: linhas.join(' · ') || 'ninguém sofreu com fome, sede ou sono' });
    let clima = null;
    for (let d = diaAntes; d < Math.floor(c.relogio.horas / 24); d++) clima = novoDiaClima(c);
    return { relogio: c.relogio, linhas, clima };
  },

  // Caos meteorológico (2d20): o mestre lança quando quiser (ex.: no começo da campanha).
  'clima.caos'(c, d, ctx) {
    exigirMestre(ctx);
    c.clima = { ...rolarCaos(), desde: c.relogio?.horas || 0 };
    registrar(c.log, { autor: 'Mestre', rotulo: 'Caos meteorológico', texto: textoClima(c.clima) });
    return { clima: c.clima };
  },

  // Comer / beber fora do descanso.
  'necessidade.comer'(c, { id }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const texto = comer(p, sis);
    sincronizarEfeitos(p, sis);
    registrar(c.log, { autor: p.nome, rotulo: 'Refeição', texto: `${p.nome} ${texto}.` });
  },
  'necessidade.beber'(c, { id }, ctx) {
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const sis = sistema(c.sistema);
    const texto = beber(p, sis);
    sincronizarEfeitos(p, sis);
    registrar(c.log, { autor: p.nome, rotulo: 'Água', texto: `${p.nome} ${texto}.` });
  },

  // PV persistentes (perdidos até o efeito acabar) e permanentes (nunca voltam): baixam o PV máximo e o atual junto.
  'pv.perdas'(c, { id, persistente, permanente }, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    const p = personagem(c, id);
    const antes = { persistente: p.pv?.persistente || 0, permanente: p.pv?.permanente || 0 };
    p.pv ||= { max: derivados(p, sis).pvMax, atual: derivados(p, sis).pvMax };
    for (const [k, v] of [['persistente', persistente], ['permanente', permanente]]) {
      if (v === undefined) continue;
      const n = Math.max(0, parseInt(v, 10) || 0);
      if (n) p.pv[k] = n; else delete p.pv[k];
    }
    recalcularMaximos(p, sis);
    const partes = [['persistente', 'persistentes'], ['permanente', 'permanentes']].filter(([k]) => (p.pv[k] || 0) !== antes[k]).map(([k, nome]) => `${p.pv[k] || 0} PV ${nome}`);
    if (partes.length) registrar(c.log, { autor: 'Mestre', rotulo: 'PV', texto: `${p.nome}: ${partes.join(', ')} (máx. ${p.pv.max}).` });
  },

  // Capacidades dos atributos: usos por descanso longo = MOD do atributo.
  'capacidade.usar'(c, { id, nome, devolver }, ctx) {
    const sis = sistema(c.sistema);
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const cap = (sis.capacidades || []).find(x => x.nome === nome);
    if (!cap) throw erro('Capacidade não encontrada.');
    const total = Math.max(0, derivados(p, sis).mod[cap.atributo] ?? 0);
    p.capacidadesUsadas ||= {};
    const usados = p.capacidadesUsadas[nome] || 0;
    if (devolver) { p.capacidadesUsadas[nome] = Math.max(0, usados - 1); return; }
    if (usados >= total) throw erro(`${cap.nome}: sem usos até o próximo descanso longo (${total} por descanso).`);
    p.capacidadesUsadas[nome] = usados + 1;
    registrar(c.log, { autor: p.nome, rotulo: 'Capacidade', texto: `${p.nome} usa ${cap.nome} (${usados + 1}/${total}).` });
  },

  // Teste de Consciência (descanso longo): WILL% contra ND 100. Sucesso devolve a Sanidade e a Humanidade temporárias;
  // falha deixa a perda permanente. Uma tentativa por descanso.
  'consciencia.testar'(c, { id }, ctx) {
    const sis = sistema(c.sistema);
    const p = personagem(c, id);
    exigirDonoOuMestre(ctx, p);
    const san = p.sanidade?.temporario || 0;
    const hum = p.humanidade?.temporario || 0;
    if (!san && !hum) throw erro('Não há dano temporário de Sanidade ou Humanidade.');
    const r = testeDMil(derivados(p, sis).percentual.WILL ?? 0, 100, sis);
    const partes = [san ? `${san} de Sanidade` : null, hum ? `${hum} de Humanidade` : null].filter(Boolean).join(' e ');
    if (r.sucesso) {
      if (san) p.sanidade.atual = Math.min(p.sanidade.max, p.sanidade.atual + san);
      if (hum) p.humanidade.atual = Math.min(p.humanidade.max, p.humanidade.atual + hum);
    }
    if (p.sanidade) p.sanidade.temporario = 0;
    if (p.humanidade) p.humanidade.temporario = 0;
    const entrada = { tipo: 'dmil', autor: p.nome, rotulo: 'Teste de Consciência (WILL%)', acaoNome: 'Consciência', mod: 0, ...r,
      texto: undefined, consciencia: r.sucesso ? `recupera ${partes}` : `a perda de ${partes} fica permanente` };
    registrar(c.log, entrada);
    registrar(c.log, { autor: p.nome, rotulo: 'Consciência', texto: r.sucesso ? `${p.nome} recupera ${partes}.` : `${p.nome} não recupera: a perda de ${partes} fica permanente.` });
    return entrada;
  },

  // Da conversa para a briga: leva os dois ao Campo de Batalha e cobra a agressão súbita.
  'social.agredir'(c, { atacante, alvo }, ctx) {
    const sis = sistema(c.sistema);
    const a = personagem(c, atacante);
    const b = personagem(c, alvo);
    exigirDonoOuMestre(ctx, a);
    if (a.id === b.id) throw erro('Escolha outro alvo.');
    const bat = c.salas.batalha;
    for (const p of [a, b]) {
      if (bat.participantes.includes(p.id)) continue;
      if (bat.participantes.length >= LIMITE_SALA) throw erro('O Campo de Batalha está cheio.');
      bat.participantes.push(p.id);
    }
    garantirCombate(c);
    const texto = agressaoSubita(c, a, b, sis);
    registrar(bat.log, { autor: a.nome, rotulo: 'Escalada', texto: `${a.nome} parte para cima de ${b.nome} (vindo da Sala Social).` });
    return { texto };
  },

  'social.manipular'(c, { autor, alvo, sub, humor, mod }, ctx) {
    const sis = sistema(c.sistema);
    exigirModulo(sis, 'social');
    const a = personagem(c, autor);
    const b = personagem(c, alvo);
    exigirDonoOuMestre(ctx, a);
    if (a.id === b.id) throw erro('Escolha outro alvo.');
    // Sedução só funciona em quem se atrai pelo gênero de quem seduz.
    if (sub === 'manipulacao.seducao') { const ps = podeSeduzir(a, b); if (!ps.ok) throw erro(ps.motivo); }
    // Espectro: como o alvo enxerga quem manipula (mapa de relacionamento).
    const espectro = espectroDe(c.relacoes[b.id]?.[a.id]?.tipo, sis);
    let r;
    try {
      r = resolverManipulacao(a, b, sub, humor, sis, { mod: ctx.mestre ? mod : 0, espectro });
    } catch (e) {
      throw erro(e.message);
    }
    const nomeH = id => humorDe({ humor: id }, sis)?.nome || id;
    const per = sis.pericias.find(x => x.id === 'manipulacao');
    const nomeSub = per?.subpericias.find(x => x.id === sub)?.nome || sub;
    const nomeEsp = sis.social.espectros?.[espectro]?.nome || espectro;
    // O humor aparente (o que a sala vê) não muda junto: só o dono troca a máscara.
    const mudar = novo => { b.humor = novo; b.humorImposto = novo !== 'neutro'; b.humorOpcoes = []; };
    // Toda manipulação é OCULTA: só o mestre vê quem testou, a intenção e o resultado. Para os jogadores tudo acontece
    // em silêncio (o alvo só sente o humor mudar). Ler o humor (Empatia) dá a quem leu o que ele percebeu.
    let resultado;
    let percebido = null;
    if (r.ler) {
      const real = nomeH(b.humor || 'neutro');
      const visto = nomeH(humorAparente(b));
      const mascarado = humorAparente(b) !== (b.humor || 'neutro');
      // Falhou: percebe só o que a pessoa mostra — escrito igual, para não entregar a falha.
      // Mesma frase nos dois casos, para não entregar se passou.
      percebido = `Você percebe que ${b.nome} está ${r.sucesso ? real : visto}.`;
      // Intuir humor: o personagem não sabe se acertou — só o mestre vê e conta na mesa o que ele percebe.
      resultado = r.sucesso ? `SUCESSO — ${a.nome} intui ${b.nome}: ${mascarado ? `a máscara (${visto}) caiu, real ${real}` : `real ${real}`}` : `FALHOU — ${a.nome} só percebe ${visto}`;
    } else if (r.sucesso) {
      mudar(humor);
      resultado = `SUCESSO — ${b.nome} fica ${nomeH(humor)}`;
    } else if (r.rebote && r.rebote !== 'neutro') {
      mudar(r.rebote);
      resultado = `FALHOU — rebote (${nomeEsp}): ${b.nome} fica ${nomeH(r.rebote)}`;
    } else if (r.opcoesRebote.length) {
      // Duas opções: com o teste oculto, quem escolhe é o mestre (o humor fica pendente até a escolha).
      b.humorOpcoes = r.opcoesRebote;
      resultado = `FALHOU — rebote (${nomeEsp}): o mestre escolhe se ${b.nome} fica ${r.opcoesRebote.map(nomeH).join(' ou ')} (ou não reage)`;
    } else {
      resultado = 'FALHOU — sem efeito';
    }
    const mods = r.mods.map(m => `${m.nome} ${fmtMod(m.valor)}`).join(', ');
    const entrada = {
      tipo: 'manipulacao', secreta: true, autor: a.nome, rotulo: r.ler ? `Intuir humor de ${b.nome} (Empatia) — oculto` : `${nomeSub} em ${b.nome} (quer ${nomeH(humor)}) — oculto`, sucesso: r.sucesso, critico: r.critico,
      texto: `${resultado}${r.critico ? ` (crítico de ${r.critico})` : ''}`,
      detalhe: `d100 ${r.dp}${r.modo ? ` (vantagem [${r.dados.join(', ')}])` : ''} + ${r.acao}${mods ? ` (${mods})` : ''} = ${r.total} contra R.MNP ${r.nd} · espectro ${nomeEsp} · DS ${r.dsDados?.length > 1 ? `[${r.dsDados.join(', ')}] → ${r.ds}` : r.ds}`,
      dp: r.dp, dados: r.dados, ds: r.ds, dsDados: r.dsDados, total: r.total, nd: r.nd,
    };
    registrar(c.salas.social.log, entrada);
    (c.salas.social.testaram ||= []).includes(a.id) || c.salas.social.testaram.push(a.id);
    // Intuir humor: quem testou recebe o que percebeu, sempre com a mesma frase (falhou → o aparente; passou → o real),
    // então nunca sabe se falhou. Fica também no registro, só para ele.
    if (r.ler) registrar(c.salas.social.log, { autor: a.nome, rotulo: `Intuir humor de ${b.nome}`, texto: percebido, privadoPara: a.donoId || ctx.user.id });
    if (ctx.mestre) return { ...entrada, revelado: percebido };
    // Os outros testes não mostram número nem resultado: só que o teste foi feito (autor, 22/10).
    return { oculto: true, rotulo: r.ler ? `Intuir humor de ${b.nome}` : `${nomeSub} em ${b.nome}`, percebido };
  },

  // Empatia natural (mestre, regra do aplicativo): cada humano influencia os outros com o humor que mostra.
  // Só o mestre vê. O jogador não fica sabendo se o humor mudou por manipulação ou pela empatia natural.
  'social.empatiaNatural'(c, d, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    exigirModulo(sis, 'social');
    const participantes = c.salas.social.participantes.map(id => c.personagens.find(p => p.id === id)).filter(Boolean);
    let r;
    try { r = empatiaNatural(participantes, sis, { relacoes: c.relacoes || {} }); } catch (e) { throw erro(e.message); }
    const nomeH = id => sis.social.humores.find(x => x.id === id)?.nome || 'Neutro';
    const influencias = r.emissores.filter(e => e.emite).map(e => `${e.p.nome} (${nomeH(e.humor)}) ${e.total}`).join(' · ');
    const linhas = r.resultados.map(x => `${x.p.nome}: ${x.mudou ? `${nomeH(x.de)} → ${nomeH(x.para)}` : `fica ${nomeH(x.de)}`} (${x.motivo}; ${x.testes.filter(t => t.sucesso).length}/${x.testes.length} influências passaram do R.MNP ${x.rmnp}±)`);
    registrar(c.salas.social.log, { tipo: 'manipulacao', secreta: true, autor: 'Mestre', rotulo: 'Empatia natural — oculto', texto: `Influências: ${influencias || 'ninguém emitiu'}. ${linhas.join(' · ')}` });
    return { texto: linhas.join('\n'), linhas, mudaram: r.resultados.filter(y => y.mudou).length };
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

  // Imagem de um monstro do Livro dos Monstros nesta campanha: link (Drive ou internet). Vazio tira.
  // O envio de arquivo é pela rota /api/campanhas/:id/monstros/imagem.
  'monstro.imagem'(c, { nome, link }, ctx) {
    exigirMestre(ctx);
    if (!sistema(c.sistema).monstros.some(x => x.nome === nome)) throw erro('Criatura não encontrada.');
    const url = imagemSegura(link);
    c.imagensMonstros ||= {};
    if (url) c.imagensMonstros[nome] = url; else delete c.imagensMonstros[nome];
  },

  // Monstro do livro no Campo de Batalha (no estágio escolhido; "quantidade" põe vários de uma vez).
  'monstro.adicionar'(c, { nome, estagio = null, quantidade = 1 }, ctx) {
    exigirMestre(ctx);
    const m = sistema(c.sistema).monstros.find(x => x.nome === nome);
    if (!m) throw erro('Criatura não encontrada.');
    if (estagio != null && estagio !== '' && !(m.estagios || []).some(e => e.numero === Number(estagio))) throw erro(`${m.nome} não tem o estágio ${estagio}.`);
    const s = c.salas.batalha;
    const n = Math.max(1, Math.min(20, parseInt(quantidade, 10) || 1));
    if (s.participantes.length + n > LIMITE_SALA) throw erro('O Campo de Batalha está cheio.');
    const ids = [];
    for (let i = 0; i < n; i++) {
      const p = npcDeMonstro(c, m, estagio === '' ? null : estagio);
      // Vários iguais: numerados (Cão das Ruínas 1, 2…), para escolher o alvo.
      if (n > 1) p.nome = `${p.nome} ${i + 1}`;
      c.personagens.push(p);
      s.participantes.push(p.id);
      porNoMapa(c, p);
      ids.push(p.id);
    }
    garantirCombate(c);
    return { ids };
  },

  // Troca o estágio do monstro em campo: muda PV máximo (o dano já tomado continua), atributos, deslocamentos,
  // ataques e habilidades; efeitos, marcadores e o saque ficam.
  'monstro.estagio'(c, { id, estagio }, ctx) {
    exigirMestre(ctx);
    const p = personagem(c, id);
    const m = p.monstro && sistema(c.sistema).monstros.find(x => x.nome === p.monstro.nome);
    if (!m) throw erro('Este personagem não veio do Livro dos Monstros.');
    const n = estagio === '' || estagio == null ? null : Number(estagio);
    if (n != null && !(m.estagios || []).some(e => e.numero === n)) throw erro(`${m.nome} não tem o estágio ${n}.`);
    const novo = npcDeMonstro(c, m, n);
    const dano = Math.max(0, p.pv.max - p.pv.atual);
    for (const k of ['nivel', 'dificuldade', 'xp', 'tamanho', 'atributos', 'pericias', 'subpericias', 'ipExtra', 'ipTipos', 'resistencias', 'imunidades',
      'vulnerabilidades', 'habilidadesProprias', 'deslocamentos', 'monstro', 'anotacoes']) p[k] = novo[k];
    if (novo.deslocamentoBase != null) p.deslocamentoBase = novo.deslocamentoBase; else delete p.deslocamentoBase;
    if (novo.foto && novo.foto !== p.foto && m.estagios?.some(e => e.imagem)) p.foto = novo.foto;
    p.itens = [...novo.itens.filter(i => i.natural), ...(p.itens || []).filter(i => !i.natural)];
    p.pv = { max: novo.pv.max, atual: novo.pv.max - dano };
    // Cresceu (ou diminuiu): se o peão não cabe mais onde está, vai para o primeiro lugar livre do tamanho novo.
    const peca = c.mapa?.pecas?.[p.id];
    if (peca) {
      const l = ladoNoMapa(p);
      const ocupa = (x, lx) => { const q = new Set(); for (let i = 0; i < lx; i++) for (let j = 0; j < lx; j++) q.add(`${x.col + i}:${x.lin + j}`); return q; };
      const meu = ocupa(peca, l);
      const bate = Object.entries(c.mapa.pecas).some(([id, x]) => id !== p.id && [...ocupa(x, ladoNoMapa(c.personagens.find(o => o.id === id)))].some(k => meu.has(k)));
      if (bate) c.mapa.pecas[p.id] = { ...peca, ...lugarLivre(c, l, p.id) };
    }
    registrar(c.salas.batalha.log, { autor: p.nome, rotulo: `${p.nome} muda de estágio`, texto: `${p.monstro.nomeEstagio || 'estágio base'} · PV ${p.pv.atual}/${p.pv.max}` });
  },

  // Encontro por faixa de ND (só o mestre vê): sorteia, varia até 10% e escreve o cenário sem IA. A IA (se configurada)
  // reescreve o cenário pela rota /api/campanhas/:id/encontro/cenario. Nada entra no campo até o mestre colocar.
  'encontro.sortear'(c, { ndMin, ndMax, quantidade = 1, mesma = true, contexto = '' }, ctx) {
    exigirMestre(ctx);
    const sis = sistema(c.sistema);
    const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    const min = num(ndMin) ?? 0, max = num(ndMax) ?? 99;
    if (min > max) throw erro('O ND mínimo está maior que o máximo.');
    let criaturas;
    try { criaturas = sortearEncontro(sis.monstros, { ndMin: min, ndMax: max, quantidade, mesma: !!mesma }, sis); } catch (e) { throw erro(e.message); }
    const extra = String(contexto || '').slice(0, 500);
    const momento = { hora: c.relogio?.horas ?? null, clima: c.clima?.nome || null, extra };
    c.encontroGerado = { id: uid(), em: Date.now(), ndMin: min, ndMax: max, contexto: extra, criaturas,
      cenario: { texto: cenarioSemIA(criaturas, sis.monstros, momento), fonte: 'sem IA' } };
    return c.encontroGerado;
  },

  // Põe as criaturas sorteadas no Campo de Batalha (e no mapa), com a variação e o PV atual sorteados.
  'encontro.colocar'(c, d, ctx) {
    exigirMestre(ctx);
    const g = c.encontroGerado;
    if (!g) throw erro('Gere um encontro primeiro.');
    const sis = sistema(c.sistema);
    const s = c.salas.batalha;
    if (s.participantes.length + g.criaturas.length > LIMITE_SALA) throw erro('O Campo de Batalha não tem lugar para todos.');
    const repetidos = g.criaturas.length > 1;
    const ids = g.criaturas.map((cr, i) => {
      const m = sis.monstros.find(x => x.nome === cr.nome);
      if (!m) throw erro(`${cr.nome} não está mais no Livro dos Monstros.`);
      const p = npcDeMonstro(c, m, cr.estagio);
      // Variação de até 10% por cima da ficha do livro (o que não variou fica igual).
      for (const k of ['atributos', 'pericias', 'subpericias']) p[k] = { ...p[k], ...cr.variacao[k] };
      if (repetidos) p.nome = `${p.nome} ${i + 1}`;
      p.pv.atual = Math.max(1, Math.round(p.pv.max * cr.fracaoPv));
      c.personagens.push(p);
      s.participantes.push(p.id);
      porNoMapa(c, p);
      return p.id;
    });
    garantirCombate(c);
    registrar(s.log, { autor: 'Mestre', rotulo: 'Encontro', texto: g.criaturas.map(x => `${x.nome}${x.nomeEstagio ? ` (${x.nomeEstagio})` : ''}`).join(', '), secreta: true });
    g.colocado = true;
    return { ids };
  },

  // Lê o cenário para a mesa: vai para o registro do Campo de Batalha (todos veem).
  'encontro.mostrar'(c, d, ctx) {
    exigirMestre(ctx);
    const g = c.encontroGerado;
    if (!g?.cenario?.texto) throw erro('Gere um encontro primeiro.');
    registrar(c.salas.batalha.log, { autor: 'Mestre', rotulo: 'Cenário', texto: g.cenario.texto });
  },

  'encontro.descartar'(c, d, ctx) {
    exigirMestre(ctx);
    delete c.encontroGerado;
  },

  'encontro.gerar'(c, { limite, usarMonstros, grupos }, ctx) {
    exigirMestre(ctx);
    limite = Math.max(0.125, parseFloat(String(limite).replace(',', '.')) || 1);
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
        // Monstro com estágios entra no 1º estágio (como no Livro e no "Adicionar monstro").
        p = npcDeMonstro(c, e.m, e.m.estagios?.[0]?.numero ?? null);
      }
      c.personagens.push(p);
      s.participantes.push(p.id);
      porNoMapa(c, p);
      nomes.push(p.nome);
    }
    registrar(s.log, { autor: 'Mestre', rotulo: `Encontro aleatório (dificuldade ${textoND(soma)}/${textoND(limite)})`, texto: nomes.join(', ') });
    garantirCombate(c);
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
