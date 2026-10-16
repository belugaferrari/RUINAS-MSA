import { h, campo, botao, selecao, aviso, confirmar, pedirTexto, formatarData, vazio, icone, titulo, tabela, seloRevisao, escolhaComOutra, janela } from '../ui.js';
import { efeitosIcones } from './efeitos.js';
import { estado, render } from '../estado.js';
import { acao, enviarArquivo } from '../api.js';
import { derivados, slotsOcupados, ganhosDeClasse, pontosGastos, pontosPericiaTotal, vantagensDisponiveis, acharVantagem, xpParaSubir } from '/shared/regras.js';
import { painelPericias } from './pericias.js';
import { bonecoView } from './boneco.js';
import { prepararTeste } from './dados.js';

export const ICONE_TIPO = {
  arma: 'sword', defesa: 'shield', vestimenta: 'shirt', joia: 'gem', armadilha: 'crosshair', geral: 'backpack', municao: 'target', cibernetico: 'cpu',
  ferramenta: 'wrench', alimento: 'utensils', boticario: 'pill', transporte: 'car', materia: 'box', energia: 'battery-charging',
};

const atualizar = (p, patch) => acao('personagem.atualizar', { id: p.id, patch });

export const nomeProfissao = p => estado.sistema.profissoes.find(x => x.id === p.profissao)?.nome || '';
export function nomeClasse(p) {
  const c = estado.sistema.classes.find(x => x.id === p.classe);
  if (!c) return p.nivel >= (estado.sistema.regras?.nivelClasse ?? 3) ? 'Classe não escolhida' : 'Sem classe (nível < 3)';
  const e = c.especializacoes.find(x => x.id === p.especializacao);
  return e ? `${c.nome} · ${e.nome}` : c.nome;
}

export function fichaView(p, { mestre = false } = {}) {
  if (!mestre) return fichaJogador(p);
  const sis = estado.sistema;
  const d = derivados(p, sis);
  const rolar = (acaoRef, nome) => rolarTeste(p, acaoRef, nome);
  return h('div', { class: 'ficha' },
    cabecalho(p, mestre),
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco' }, titulo('Identidade', 'user'), identidade(p)),
      h('section', { class: 'bloco' }, titulo('Estado', 'heart-pulse'), trilhas(p, mestre)),
      h('section', { class: 'bloco duplo' }, titulo('Atributos', 'zap'), atributosView(p, d, mestre, rolar)),
      h('section', { class: 'bloco largo' }, titulo('Teste (D-MIL)', 'dices'), painelTeste(p, d)),
      h('section', { class: 'bloco largo' }, titulo(`Perícias · limite ${d.limitePericia} por perícia`, 'target'),
        h('p', { class: 'dica' }, `Pontos de perícia: ${pontosGastos(p, sis).pericias} gastos de ${pontosPericiaTotal(p, sis)}. Clique no dado para testar com a dificuldade escolhida acima.`),
        painelPericias(p, { d, rolar, chave: `ficha:${p.id}`, editar: mestre ? editorMestre(p) : null })),
      h('section', { class: 'bloco' }, titulo('Profissão e classe', 'shield'), profissaoClasse(p, mestre)),
      h('section', { class: 'bloco' }, titulo('Vantagens, defeitos e capacidades', 'sparkles'), vantagensView(p, d, mestre)),
      h('section', { class: 'bloco' }, titulo('Equipado no corpo', 'shirt'), bonecoView(p, { mestre })),
      h('section', { class: 'bloco largo', id: 'equipamento' }, titulo(`Equipamento · Defesa ${d.defesa} · Carga ${d.carga.toFixed(1)} kg`, 'backpack'), equipamento(p, mestre)),
      h('section', { class: 'bloco largo' }, titulo('Anotações', 'notebook-pen'),
        campo(`${p.id}:anotacoes`, p.anotacoes, v => atualizar(p, { anotacoes: v }), { multilinha: true, rows: 5, placeholder: 'Suas anotações…' })),
      h('section', { class: 'bloco largo' }, titulo('Background', 'scroll'),
        campo(`${p.id}:background`, p.background, v => atualizar(p, { background: v }), { multilinha: true, rows: 6 })),
      mestre ? h('section', { class: 'bloco largo' }, titulo('Controle do mestre', 'crown'), controleMestre(p)) : null));
}

// ---------- Ficha do jogador (enxuta) ----------
// Estado e atributos compactos, perícias base com as subperícias treinadas, identidade no fim.
// O teste D-MIL fica no rolador lateral: os botões de dado só preparam o teste lá.
function fichaJogador(p) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  const testar = ref => prepararTeste(p.id, ref);
  return h('div', { class: 'ficha ficha-jogador' },
    cabecalho(p, false),
    // Linha de cima: Estado, Atributos e o boneco do que está equipado, os três da mesma altura.
    h('div', { class: 'ficha-topo-tres' },
      h('section', { class: 'bloco' }, titulo('Estado', 'heart-pulse'), estadoCompacto(p, d)),
      h('section', { class: 'bloco' }, titulo('Atributos', 'zap'), atributosCompactos(p, d, testar)),
      h('section', { class: 'bloco boneco-compacto' }, titulo('Equipado', 'shirt'), bonecoView(p, { compacto: true }))),
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco largo' }, titulo(`Perícias · limite ${d.limitePericia}`, 'target'), periciasCompactas(p, d, testar)),
      h('section', { class: 'bloco largo', id: 'equipamento' }, titulo(`Equipamento · IP ${d.defesa} · Carga ${d.carga.toFixed(1)} kg`, 'backpack'), equipamento(p, false)),
      h('section', { class: 'bloco' }, titulo('Vantagens, defeitos e capacidades', 'sparkles'), vantagensView(p, d, false)),
      h('section', { class: 'bloco' }, titulo('Profissão e classe', 'shield'), profissaoClasse(p, false)),
      h('section', { class: 'bloco largo' }, titulo('Anotações', 'notebook-pen'),
        campo(`${p.id}:anotacoes`, p.anotacoes, v => atualizar(p, { anotacoes: v }), { multilinha: true, rows: 5, placeholder: 'Suas anotações…' })),
      h('section', { class: 'bloco largo' }, titulo('Background', 'scroll'),
        campo(`${p.id}:background`, p.background, v => atualizar(p, { background: v }), { multilinha: true, rows: 6 })),
      h('section', { class: 'bloco largo' }, titulo('Identidade', 'user'), identidade(p))));
}

// Dano temporário de Sanidade/Humanidade e o teste de Consciência (WILL%, ND 100) no descanso longo.
function temporarios(p) {
  const san = p.sanidade?.temporario || 0;
  const hum = p.humanidade?.temporario || 0;
  if (!san && !hum) return null;
  return h('div', { class: 'temporarios' },
    h('span', {}, icone('hourglass'), ` Temporário: ${[san ? `−${san} Sanidade` : null, hum ? `−${hum} Humanidade` : null].filter(Boolean).join(' · ')}`),
    botao('Teste de Consciência', async () => {
      if (!(await confirmar('Teste de Consciência (WILL%, ND 100), feito no descanso longo. Sucesso recupera o temporário; falha deixa a perda permanente. Rolar agora?'))) return;
      const r = await acao('consciencia.testar', { id: p.id });
      aviso(`Consciência: ${r.total} contra ND 100 — ${r.sucesso ? 'SUCESSO' : 'FALHA'} (${r.consciencia})`, r.sucesso ? 'ok' : 'erro');
    }, { class: 'pequeno', icone: 'brain', title: 'Recuperar Sanidade e Humanidade temporárias' }));
}

// Título em cima (nome e estado), barra embaixo com o valor no centro, entre − e +.
function trilhaCompacta(p, chave, rotulo, ic, extra = null) {
  const t = p[chave] || { max: 0, atual: 0 };
  const pct = Math.max(0, Math.min(100, (100 * t.atual) / (t.max || 1)));
  return h('div', { class: `trilha-compacta ${chave}` },
    h('div', { class: 'cabeca' }, h('span', { class: 'rotulo' }, icone(ic), rotulo), extra ? h('small', { class: 'extra' }, ` · ${extra}`) : null),
    h('div', { class: 'linha' },
      botao('', () => atualizar(p, { [chave]: { ...t, atual: t.atual - 1 } }), { class: 'pequeno', icone: 'minus', title: `Diminuir ${rotulo}` }),
      h('div', { class: 'barra-trilha', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': t.max, 'aria-valuenow': t.atual, 'aria-label': rotulo },
        h('i', { style: { width: `${pct}%` } }), h('span', { class: `valor ${t.atual <= 0 ? 'perigo' : ''}` }, `${t.atual} / ${t.max}`)),
      botao('', () => atualizar(p, { [chave]: { ...t, atual: Math.min(t.max, t.atual + 1) } }), { class: 'pequeno', icone: 'plus', title: `Aumentar ${rotulo}` })));
}

// Lista de condições do livro para marcar no personagem; os efeitos entram sozinhos nas estatísticas.
export function escolherCondicao(p) {
  const sis = estado.sistema;
  const grupos = [...new Set((sis.condicoes || []).map(c => c.grupo))];
  const ativas = new Set((p.marcadores || []).map(m => m.toLowerCase()));
  let fechar = () => {};
  const adicionar = async nome => { await atualizar(p, { marcadores: [...(p.marcadores || []), nome] }); fechar(); };
  const outro = h('input', { placeholder: 'Outro marcador (texto livre)', 'aria-label': 'Outro marcador' });
  fechar = janela(`Condições de ${p.nome}`, h('div', { class: 'lista-condicoes' },
    h('div', { class: 'barra' }, outro, botao('Adicionar', () => { const t = outro.value.trim(); if (t) adicionar(t); }, { icone: 'plus' })),
    grupos.map(g => h('section', {},
      h('h4', {}, g),
      h('ul', {}, (sis.condicoes || []).filter(c => c.grupo === g).map(c => {
        const tem = ativas.has(c.nome.toLowerCase());
        const qtd = (p.marcadores || []).filter(m => m.toLowerCase() === c.nome.toLowerCase()).length;
        const cheio = c.maxAcumulo && qtd >= c.maxAcumulo;
        return h('li', {},
          botao(cheio ? 'No máximo' : tem && !c.acumula ? 'Já marcada' : c.acumula && tem ? '+1' : 'Marcar', () => adicionar(c.nome), { class: 'pequeno primario', disabled: (tem && !c.acumula) || cheio, title: `Marcar ${c.nome}` }),
          h('div', {}, h('strong', {}, c.nome), c.acumula ? h('small', { class: 'selo' }, 'acumula') : null, h('small', { class: 'bloco-texto' }, c.efeitos)));
      }))))));
}

// Condições ativas com o resumo do efeito; o x tira um marcador.
function condicoesView(p, d) {
  const marcadores = p.marcadores || [];
  const efeito = c => [
    ...Object.entries(c.atributos || {}).map(([k, v]) => `${k} ${v * c.qtd > 0 ? '+' : ''}${v * c.qtd}`),
    c.testes ? `${c.testes * c.qtd > 0 ? '+' : ''}${c.testes * c.qtd}% testes` : null,
    ...Object.entries(c.testesAtributos || {}).map(([k, v]) => `${k}% ${v > 0 ? '+' : ''}${v}`),
  ].filter(Boolean).join(', ');
  const doMarcador = m => d.condicoes.find(c => m.toLowerCase().startsWith(c.nome.toLowerCase()));
  const vistos = new Set();
  return h('div', { class: 'marcadores' },
    marcadores.map((m, i) => {
      const c = doMarcador(m);
      if (c && vistos.has(c.id)) return null;
      if (c) vistos.add(c.id);
      return h('span', { class: `etiqueta ${c && efeito(c) ? 'com-efeito' : ''}`, title: c?.efeitos || m },
        c ? `${c.nome}${c.qtd > 1 ? ` ×${c.qtd}` : ''}` : m, c && efeito(c) ? h('small', {}, ` ${efeito(c)}`) : null,
        botao('', () => atualizar(p, { marcadores: marcadores.filter((_, j) => j !== i) }), { class: 'x', icone: 'x', title: `Tirar ${c?.nome || m}` }));
    }),
    botao('Marcador', () => escolherCondicao(p), { class: 'pequeno', icone: 'tag', title: 'Escolher uma condição' }));
}

function estadoCompacto(p, d) {
  return h('div', { class: 'estado-compacto' },
    trilhaCompacta(p, 'pv', 'PV', 'heart'),
    trilhaCompacta(p, 'sanidade', 'Sanidade', 'brain', d.estadoSanidade),
    trilhaCompacta(p, 'humanidade', 'Humanidade', 'hand-heart', d.estagioHumanidade?.nome || ''),
    p.humanidade && p.humanidade.atual < 1 ? h('p', { class: 'alerta perigo' }, icone('circle-alert'), ' Humanidade abaixo de 1: só o mestre controla este personagem.') : null,
    efeitosIcones(p, { grande: true }),
    temporarios(p),
    condicoesView(p, d));
}

function atributosCompactos(p, d, testar) {
  const sis = estado.sistema;
  return h('div', {},
    tabela(['', 'Base', '%', ''], sis.atributos.map(a => {
      const item = d.bonus[a.sigla] || 0;
      return [
        h('strong', { title: a.nome }, a.sigla),
        [p.atributos?.[a.sigla] ?? 0, item ? h('span', { class: `bonus ${item > 0 ? 'ok' : 'perigo'}`, title: 'Itens equipados' }, ` ${item > 0 ? '+' : ''}${item}`) : null],
        h('strong', { class: 'valor-final' }, `${d.percentual[a.sigla]}%`),
        botao('', () => testar(`atr:${a.sigla}`), { class: 'pequeno', icone: 'dices', title: `Testar ${a.nome}` }),
      ];
    }), 'tabela-atributos compacta mini'),
    h('p', { class: 'meta' }, icone('zap'), ` Iniciativa: AGI ${d.iniciativa} + 1d10`));
}

// Perícias base (nome, %, testar) e uma seta que abre só as subperícias treinadas.
function periciasCompactas(p, d, testar) {
  const sis = estado.sistema;
  return h('ul', { class: 'pericias-compactas' }, sis.pericias.map(per => {
    const treinadas = per.subpericias.filter(s => (p.subpericias?.[s.id] ?? 0) > 0);
    const chave = `pc:${p.id}:${per.id}`;
    const aberto = !!estado.sel[chave];
    return h('li', { class: (p.pericias?.[per.id] ?? 0) > 0 || treinadas.length ? 'treinada' : '' },
      h('div', { class: 'linha-pericia' },
        treinadas.length
          ? h('button', { type: 'button', class: 'so-icone pequeno seta', 'aria-expanded': aberto, title: aberto ? 'Esconder subperícias treinadas' : 'Mostrar subperícias treinadas',
            'aria-label': `${aberto ? 'Esconder' : 'Mostrar'} subperícias treinadas de ${per.nome}`, onclick: () => { estado.sel[chave] = !aberto; render(); } }, icone(aberto ? 'chevron-down' : 'chevron-up'))
          : h('span', { class: 'seta-vazia' }),
        h('span', { class: 'nome', title: per.descricao }, per.nome, h('small', {}, ` ${per.atributo}`), treinadas.length ? h('small', { class: 'selo' }, `${treinadas.length}`) : null),
        h('strong', { class: 'valor-final' }, `${d.pericias[per.id]}%`),
        botao('', () => testar(`per:${per.id}`), { class: 'pequeno', icone: 'dices', title: `Testar ${per.nome}` })),
      aberto ? h('ul', { class: 'subs-treinadas' }, treinadas.map(s => h('li', { title: s.descricao },
        h('span', { class: 'nome' }, s.nome, d.bonusProfissao[s.id] ? h('small', { class: 'selo ok' }, `+${d.bonusProfissao[s.id]} prof.`) : null),
        h('strong', { class: 'valor-final' }, `${d.subpericias[s.id]}%`),
        botao('', () => testar(`sub:${s.id}`), { class: 'pequeno', icone: 'dices', title: `Testar ${s.nome}` })))) : null);
  }));
}

// O mestre ajusta pontos de perícia direto na ficha. Ficha de jogador segue os limites do nível
// (o servidor confere também), a não ser com a "edição livre" ligada na aba Campanha.
function editorMestre(p) {
  const sis = estado.sistema;
  const livre = p.tipo !== 'pj' || estado.campanha.edicaoLivre;
  return {
    limite: livre ? 99 : derivados(p, sis).limitePericia,
    maxRestante: () => (livre ? 99 : pontosPericiaTotal(p, sis, estado.campanha) - pontosGastos(p, sis).pericias),
    base: (id, v) => atualizar(p, { pericias: { ...p.pericias, [id]: v } }),
    sub: (id, v) => atualizar(p, { subpericias: { ...p.subpericias, [id]: v } }),
  };
}

function cabecalho(p, mestre) {
  const arquivo = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      const form = new FormData();
      form.append('arquivo', f);
      try {
        await enviarArquivo(`/api/campanhas/${estado.campanha.id}/personagens/${p.id}/foto`, form);
        aviso('Foto atualizada.');
      } catch (err) {
        aviso(err.message, 'erro');
      }
    },
  });
  return h('header', { class: 'ficha-topo' },
    h('button', { class: 'foto', title: 'Trocar foto', onclick: () => arquivo.click() },
      p.foto ? h('img', { src: p.foto, alt: p.nome }) : h('span', { class: 'foto-vazia' }, icone('camera'), h('small', {}, 'Foto'))),
    arquivo,
    h('div', { class: 'ficha-titulo' },
      campo(`${p.id}:nome`, p.nome, v => atualizar(p, { nome: v }), { class: 'nome-grande' }),
      h('p', { class: 'meta' },
        `${p.tipo === 'npc' ? 'NPC' : 'Personagem-jogador'} · ${nomeProfissao(p) || 'Sem profissão'} · ${nomeClasse(p)} · Nível ${p.nivel} · ${p.dinheiro ?? 0} ${estado.sistema.moeda || 'créditos'}`,
        p.tipo === 'pj' ? ` · Jogador: ${p.dono || 'livre'}` : null),
      p.tipo === 'pj' ? barraXp(p) : null),
    mestre ? h('label', { class: 'mini' }, 'Nível',
      campo(`${p.id}:nivel`, p.nivel, v => atualizar(p, { nivel: v }), { tipo: 'number', min: 1, max: 20 })) : null);
}

// O instinto guia o mestre quando o personagem perde o controle.
export function descInstinto(nome) {
  const i = (estado.sistema.instintos || []).find(x => x.nome === nome);
  return i?.descricao ? h('p', { class: 'dica' }, icone('info'), ` ${i.descricao}`) : null;
}

// XP acumulado × XP para o próximo nível (a evolução só libera o nível quando a barra enche).
export function barraXp(p) {
  const falta = xpParaSubir(p.nivel, estado.sistema);
  const xp = p.xp || 0;
  const pronto = xp >= falta && p.nivel < 20;
  return h('div', { class: `barra-xp ${pronto ? 'pronto' : ''}`, title: `XP para o nível ${p.nivel + 1}` },
    h('span', {}, icone('sparkles'), ` XP ${xp} / ${falta}`),
    h('div', { class: 'barra-trilha', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': falta, 'aria-valuenow': Math.min(xp, falta), 'aria-label': `XP de ${p.nome}` },
      h('i', { style: { width: `${Math.min(100, (100 * xp) / (falta || 1))}%` } })),
    pronto ? h('span', { class: 'selo ok' }, `pode subir para o nível ${p.nivel + 1}`) : null);
}

function identidade(p) {
  const sis = estado.sistema;
  const linha = (rot, k) => h('label', {}, rot, campo(`${p.id}:${k}`, p[k], v => atualizar(p, { [k]: v })));
  return h('div', { class: 'form' },
    h('div', { class: 'grade3' }, linha('Idade', 'idade'), linha('Peso', 'peso'), linha('Tamanho', 'altura')),
    h('div', { class: 'grade2' },
      h('label', {}, 'Origem', selecao([{ valor: '', rotulo: '—' }, ...sis.origens.map(o => o.nome)], p.origem, v => atualizar(p, { origem: v }))),
      h('label', {}, 'Motivação', escolhaComOutra(`${p.id}:motivacao`, sis.motivacoes, p.motivacao, v => atualizar(p, { motivacao: v }),
        { rotuloOutra: 'Outra…', placeholder: 'Qual a motivação?', props: { 'aria-label': 'Motivação' }, redesenhar: render }))),
    h('label', {}, 'Instinto', escolhaComOutra(`${p.id}:instinto`, (sis.instintos || []).map(x => x.nome), p.instinto, v => atualizar(p, { instinto: v }),
      { rotuloOutra: 'Outro…', placeholder: 'Qual o instinto?', props: { 'aria-label': 'Instinto' }, redesenhar: render })),
    descInstinto(p.instinto),
    h('label', {}, 'Características', campo(`${p.id}:caracteristicas`, p.caracteristicas, v => atualizar(p, { caracteristicas: v }), { multilinha: true, rows: 2 })));
}

function trilha(p, chave, rotulo) {
  const t = p[chave] || { max: 0, atual: 0 };
  const caixas = [];
  for (let i = 1; i <= Math.min(t.max, 40); i++) {
    caixas.push(h('button', {
      class: `caixa ${i <= t.atual ? 'cheia' : ''}`, title: `${rotulo}: ${i}`,
      onclick: () => atualizar(p, { [chave]: { ...t, atual: i === t.atual ? i - 1 : i } }).catch(e => aviso(e.message, 'erro')),
    }));
  }
  return h('div', { class: 'trilha' },
    h('div', { class: 'trilha-topo' },
      h('strong', {}, rotulo),
      botao('', () => atualizar(p, { [chave]: { ...t, atual: t.atual - 1 } }), { class: 'pequeno', icone: 'minus', title: `Diminuir ${rotulo}` }),
      h('span', { class: `valor ${t.atual <= 0 ? 'perigo' : ''}` }, `${t.atual} / ${t.max}`),
      botao('', () => atualizar(p, { [chave]: { ...t, atual: Math.min(t.max, t.atual + 1) } }), { class: 'pequeno', icone: 'plus', title: `Aumentar ${rotulo}` })),
    t.max > 40
      ? h('div', { class: 'barra-trilha', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': t.max, 'aria-valuenow': t.atual, 'aria-label': rotulo },
        h('i', { style: { width: `${Math.max(0, Math.min(100, (100 * t.atual) / (t.max || 1)))}%` } }))
      : h('div', { class: 'caixas' }, caixas));
}

function trilhas(p, mestre) {
  return h('div', {},
    trilha(p, 'pv', 'PV'),
    trilha(p, 'sanidade', 'Sanidade'),
    h('p', { class: 'meta' }, icone('brain'), ` Estado mental: ${derivados(p, estado.sistema).estadoSanidade}`),
    trilha(p, 'humanidade', 'Humanidade'),
    efeitosIcones(p, { mestre, grande: true }),
    temporarios(p),
    p.humanidade && p.humanidade.atual < 1 ? h('p', { class: 'alerta perigo' }, icone('circle-alert'), ' Humanidade abaixo de 1: o jogador perdeu o controle deste personagem (só o mestre age por ele).') : null,
    estagioHumanidade(p),
    mestre ? h('div', { class: 'grade3 mini' },
      ...['pv', 'sanidade'].map(k => h('label', {}, `${k === 'pv' ? 'PV' : k[0].toUpperCase() + k.slice(1)} máx.`,
        campo(`${p.id}:${k}:max`, p[k]?.max, v => atualizar(p, { [k]: { ...p[k], max: v } }), { tipo: 'number', min: 0 })))) : null,
    condicoesView(p, derivados(p, estado.sistema)));
}

function estagioHumanidade(p) {
  const sis = estado.sistema;
  const e = derivados(p, sis).estagioHumanidade;
  if (!e) return null;
  return h('details', { class: 'estagio-hum' },
    h('summary', {}, icone('hand-heart'), ` Humanidade: ${e.nome} (${e.min}–${e.max})`, seloRevisao(true)),
    h('p', {}, e.descricao),
    e.efeitos.length ? h('ul', {}, e.efeitos.map(x => h('li', {}, x))) : null,
    h('p', { class: 'dica' }, sis.humanidade.notaEfeitos),
    e.gatilhoPerda ? h('p', {}, h('strong', {}, 'Gatilho de perda: '), e.gatilhoPerda) : null);
}

function atributosView(p, d, mestre, rolar) {
  const sis = estado.sistema;
  return h('div', {},
    tabela(['Atributo', 'Base', '%', 'Bônus per.', 'MOD', ''], sis.atributos.map(a => {
      const item = d.bonus[a.sigla] || 0;
      return [
        h('span', { title: a.descricao }, h('strong', {}, a.sigla), ' ', h('small', {}, a.nome)),
        [mestre
          ? campo(`${p.id}:atr:${a.sigla}`, p.atributos?.[a.sigla] ?? 0, v => atualizar(p, { atributos: { ...p.atributos, [a.sigla]: v } }), { tipo: 'number', class: 'num', 'aria-label': `${a.nome} base` })
          : (p.atributos?.[a.sigla] ?? 0),
        item ? h('span', { class: `bonus ${item > 0 ? 'ok' : 'perigo'}`, title: 'Itens equipados' }, ` ${item > 0 ? '+' : ''}${item}`) : null],
        h('strong', { class: 'valor-final' }, `${d.percentual[a.sigla]}%`),
        `+${d.bonusPericial[a.sigla]}`,
        h('strong', {}, d.mod[a.sigla] >= 0 ? `+${d.mod[a.sigla]}` : d.mod[a.sigla]),
        botao('', () => rolar(`atr:${a.sigla}`, a.nome), { class: 'pequeno', icone: 'dices', title: `Testar ${a.nome}` }),
      ];
    }), 'tabela-atributos compacta'),
    h('div', { class: 'icones-meta' },
      h('span', { title: 'AGI + 1d10' }, icone('zap'), `Iniciativa: AGI ${d.iniciativa} + 1d10`),
      h('span', {}, icone('book'), `Línguas extras: ${d.linguasExtras}`),
      h('span', {}, icone('trending-up'), `Máx. de atributo no nível: ${d.atributoMax}`)),
    botao('Rolar iniciativa', async () => {
      const r = await acao('rolar', { id: p.id, tipo: 'iniciativa', sala: estado.sel.ondeRolar || null });
      aviso(`Iniciativa de ${p.nome}: ${r.total}`);
    }, { class: 'pequeno', icone: 'zap' }));
}

const DIFICULDADES = () => [...estado.sistema.teste.dificuldades.map((x, i) => ({ valor: String(i), rotulo: `${x.nome} (ND ${x.nd}${x.metade ? ', metade' : ''})` })),
  { valor: 'livre', rotulo: 'ND livre…' }, { valor: 'sem', rotulo: 'Sem ND (só ver o total)' }];

// Configuração do próximo teste (local a este aparelho).
const cfgTeste = () => (estado.sel.teste ||= { dif: '1', ndLivre: 70, mod: 0 });

async function rolarTeste(p, acaoRef, nome) {
  const cfg = cfgTeste();
  const dif = estado.sistema.teste.dificuldades[Number(cfg.dif)];
  const nd = cfg.dif === 'sem' ? null : cfg.dif === 'livre' ? cfg.ndLivre : dif?.nd;
  const r = await acao('rolar', { id: p.id, acaoRef, mod: cfg.mod, nd, metade: !!dif?.metade, sala: estado.sel.ondeRolar || null });
  aviso(`${nome}: ${r.total}${r.nd != null ? (r.sucesso ? ' — SUCESSO' : ' — FALHA') : ''}${r.critico ? ` (crítico de ${r.critico})` : ''} · DS ${r.ds}`, r.sucesso === false ? 'erro' : 'ok');
}

function painelTeste(p, d) {
  const sis = estado.sistema;
  const cfg = cfgTeste();
  const ondeOpcoes = [{ valor: '', rotulo: 'Rolagens gerais' }, { valor: 'social', rotulo: 'Sala Social' }, { valor: 'batalha', rotulo: 'Campo de Batalha' }];
  const opcoesAcao = [{ valor: '', rotulo: 'Escolha o que testar…' },
    ...sis.atributos.map(a => ({ valor: `atr:${a.sigla}`, rotulo: `${a.nome}% (${d.percentual[a.sigla]})` })),
    ...sis.pericias.flatMap(x => [{ valor: `per:${x.id}`, rotulo: `${x.nome} (${d.pericias[x.id]})` },
      ...x.subpericias.map(s => ({ valor: `sub:${s.id}`, rotulo: `  ${x.nome} › ${s.nome} (${d.subpericias[s.id]})` }))])];
  const ultimo = (estado.campanha.log || []).filter(e => e.autor === p.nome).at(-1);
  return h('div', {},
    h('p', { class: 'dica' }, sis.teste.descricao),
    h('div', { class: 'barra' },
      selecao(opcoesAcao, cfg.acao || '', v => { cfg.acao = v; }, { 'aria-label': 'O que testar' }),
      selecao(DIFICULDADES(), cfg.dif, v => { cfg.dif = v; render(); }, { 'aria-label': 'Dificuldade' }),
      cfg.dif === 'livre' ? h('input', { type: 'number', class: 'curto', value: cfg.ndLivre, 'aria-label': 'ND', onchange: e => { cfg.ndLivre = Number(e.target.value) || 0; } }) : null,
      h('label', { class: 'linha' }, 'Mod.', h('input', { type: 'number', class: 'curto', value: cfg.mod, step: 5, 'aria-label': 'Modificador', onchange: e => { cfg.mod = Number(e.target.value) || 0; } })),
      selecao(ondeOpcoes, estado.sel.ondeRolar || '', v => { estado.sel.ondeRolar = v; }, { 'aria-label': 'Onde registrar' }),
      botao('Rolar', async () => {
        if (!cfg.acao) throw new Error('Escolha o que testar.');
        const op = opcoesAcao.find(o => o.valor === cfg.acao);
        await rolarTeste(p, cfg.acao, op.rotulo.replace(/\s*\(.*$/, '').trim());
      }, { class: 'primario', icone: 'dices' })),
    ultimo ? h('p', {}, 'Último teste: ', linhaRolagem(ultimo)) : null);
}

export function linhaRolagem(e) {
  if (e.tipo === 'ataque' || e.tipo === 'manipulacao') {
    const res = e.sucesso ? 'sucesso' : 'falha';
    return h('span', { class: `rolagem ${res}` },
      h('strong', {}, `${e.autor} ${e.rotulo}: `),
      h('span', { class: `selo ${e.sucesso ? 'ok' : 'perigo'}` }, icone(e.tipo === 'ataque' ? 'swords' : 'drama'), e.texto),
      e.detalhe ? h('small', { class: 'detalhe' }, ` ${e.detalhe}`) : null);
  }
  if (e.texto) return h('span', {}, h('strong', {}, e.rotulo), ': ', e.texto);
  if (e.tipo === 'atributos') {
    return h('span', {}, h('strong', {}, `${e.autor} — ${e.rotulo}: `), h('span', { class: 'total' }, e.valores.map(v => v.total).join(' · ')),
      h('small', {}, ` (soma ${e.total}${e.rerolagens ? `, rerolado ${e.rerolagens}×` : ''})`), e.secreta ? h('span', { class: 'selo' }, 'secreta') : null);
  }
  if (e.tipo === 'dmil') {
    const res = e.nd == null ? '' : e.sucesso ? 'sucesso' : 'falha';
    return h('span', { class: `rolagem ${res}` },
      h('strong', {}, `${e.autor} — ${e.rotulo}: `),
      h('span', { class: 'total' }, e.total),
      e.nd != null ? h('span', { class: `selo ${e.sucesso ? 'ok' : 'perigo'}` }, icone(e.sucesso ? 'check' : 'x'), `${res} (ND ${e.nd})`) : null,
      e.critico ? h('span', { class: 'selo cheio' }, `crítico de ${e.critico}`) : null,
      h('small', {}, ` (d100 ${e.dp} + ação ${e.acao}${e.metade ? ' [metade]' : ''}${e.mod ? ` ${e.mod > 0 ? '+' : ''}${e.mod} já incluso` : ''} · DS ${e.ds})`),
      e.secreta ? h('span', { class: 'selo' }, 'secreta') : null);
  }
  const partes = [`${e.dado}: [${e.dados.join(', ')}]${e.mod ? (e.mod > 0 ? ` +${e.mod}` : ` ${e.mod}`) : ''}`, ...(e.componentes || []).map(c => `${c.nome} ${c.valor}`)];
  return h('span', {}, h('strong', {}, `${e.autor} — ${e.rotulo}: `), h('span', { class: 'total' }, e.total), h('small', {}, ` (${partes.join(' + ')})`), e.secreta ? h('span', { class: 'selo' }, 'secreta') : null);
}

function profissaoClasse(p, mestre) {
  const sis = estado.sistema;
  const prof = sis.profissoes.find(x => x.id === p.profissao);
  const classe = sis.classes.find(c => c.id === p.classe);
  const ganhos = ganhosDeClasse(p, sis);
  return h('div', {},
    mestre ? h('label', {}, 'Profissão', selecao([{ valor: '', rotulo: '—' }, ...sis.profissoes.map(x => ({ valor: x.id, rotulo: x.nome }))], p.profissao, v => atualizar(p, { profissao: v }))) : null,
    prof ? h('div', { class: 'cartao-mini' }, h('strong', {}, icone('backpack'), ` ${prof.nome}`), h('p', {}, prof.vantagem),
      h('small', {}, `+${prof.bonus}% em: ${prof.subpericiasLivro.join('; ')}`)) : vazio('Sem profissão.'),
    mestre ? h('div', { class: 'grade2' },
      h('label', {}, 'Classe', selecao([{ valor: '', rotulo: '—' }, ...sis.classes.map(c => ({ valor: c.id, rotulo: c.nome }))], p.classe, v => atualizar(p, { classe: v, especializacao: '' }))),
      h('label', {}, 'Especialização', selecao([{ valor: '', rotulo: '—' }, ...(classe?.especializacoes || []).map(e => ({ valor: e.id, rotulo: e.nome }))], p.especializacao, v => atualizar(p, { especializacao: v })))) : null,
    classe ? h('div', {},
      h('p', {}, h('strong', {}, nomeClasse(p))),
      ganhos.length ? h('ul', { class: 'ganhos' }, ganhos.map(g => h('li', { title: g.descricao },
        h('span', { class: 'selo' }, `nv ${g.nivel}`), ' ', h('strong', {}, g.nome), g.descricao ? h('small', {}, ` — ${g.descricao.slice(0, 140)}${g.descricao.length > 140 ? '…' : ''}`) : null))) : null)
      : h('p', { class: 'dica' }, `A classe chega no nível ${sis.regras.nivelClasse} e a especialização no nível ${sis.regras.nivelEspecializacao}.`));
}

function vantagensView(p, d, mestre) {
  const sis = estado.sistema;
  const item = (lista, id) => lista.find(x => x.id === id);
  const linhaItem = (x, campoLista) => h('li', { title: x.descricao },
    h('strong', {}, x.nome), x.origem && x.origem !== 'Geral' ? h('span', { class: 'selo ok' }, `classe: ${x.origem}`) : null, x.requisito ? h('small', {}, ` [${x.requisito}]`) : null, x.tipo ? h('span', { class: `selo ${x.tipo === 'normal' ? 'perigo' : ''}` }, x.tipo) : null, seloRevisao(x.revisao),
    h('small', { class: 'bloco-texto' }, x.descricao),
    mestre ? botao('', () => atualizar(p, { [campoLista]: p[campoLista].filter(y => y !== x.id) }), { class: 'x', icone: 'x', title: `Remover ${x.nome}` }) : null);
  const adicionar = (lista, campoLista, rot) => mestre ? selecao([{ valor: '', rotulo: `+ ${rot}` }, ...lista.filter(x => !(p[campoLista] || []).includes(x.id)).map(x => ({ valor: x.id, rotulo: x.nome + (x.tipo ? ` (${x.tipo})` : '') }))], '',
    v => v && atualizar(p, { [campoLista]: [...(p[campoLista] || []), v] })) : null;
  return h('div', {},
    titulo('Vantagens', 'sparkles', 'h4'),
    (p.vantagens || []).length ? h('ul', { class: 'lista-regras' }, p.vantagens.map(id => acharVantagem(id, sis)).filter(Boolean).map(x => linhaItem(x, 'vantagens'))) : vazio('Nenhuma.'),
    adicionar(vantagensDisponiveis(p, sis).map(v => ({ ...v, nome: v.origem === 'Geral' ? v.nome : `${v.nome} — ${v.origem}` })), 'vantagens', 'adicionar vantagem'),
    titulo('Defeitos', 'skull', 'h4'),
    (p.defeitos || []).length ? h('ul', { class: 'lista-regras' }, p.defeitos.map(id => item(sis.defeitos, id)).filter(Boolean).map(x => linhaItem(x, 'defeitos'))) : vazio('Nenhum.'),
    adicionar(sis.defeitos, 'defeitos', 'adicionar defeito'),
    h('details', { open: !!estado.sel.capAbertas, ontoggle: e => { estado.sel.capAbertas = e.target.open; } },
      h('summary', {}, icone('zap'), ` Capacidades (usos por descanso longo = MOD) · ${sis.capacidades.filter(c => (d.mod[c.atributo] ?? 0) > 0).length} disponíveis`),
      seloRevisao(true, 'regras das capacidades em revisão'),
      h('ul', { class: 'lista-regras' }, sis.capacidades.map(c => h('li', { title: c.descricao },
        h('span', { class: 'selo' }, c.atributo), ' ', h('strong', {}, c.nome), h('span', { class: 'selo ok' }, `${Math.max(0, d.mod[c.atributo] ?? 0)}×`),
        h('small', { class: 'bloco-texto' }, c.descricao))))),
    titulo(`Habilidade única (${sis.raca.nome})`, 'crown', 'h4'),
    h('p', {}, h('strong', {}, sis.raca.habilidadeUnica.nome), ': ', sis.raca.habilidadeUnica.descricao, seloRevisao(sis.raca.habilidadeUnica.revisao)));
}

export function equipamento(p, mestre, filtro = null) {
  const sis = estado.sistema;
  const uso = slotsOcupados(p);
  const itens = (p.itens || []).filter(i => !filtro || filtro(i));
  return h('div', {},
    filtro ? null : h('div', { class: 'slots' }, sis.slots.map(s => h('span', { class: `selo ${(uso[s.id] || 0) >= s.capacidade ? 'cheio' : ''}` }, `${s.nome} ${uso[s.id] || 0}/${s.capacidade}`))),
    itens.length ? tabela(['Item', 'Slot', 'Durab.', 'Dano/Def.', 'Bônus', 'Venda', ''], itens.map(i => ({
      class: i.equipado ? 'equipado' : null,
      celulas: [
        h('span', { class: 'item-nome' }, icone(ICONE_TIPO[i.tipo] || 'tag'), i.nome, i.equipado ? h('span', { class: 'selo ok' }, 'equipado') : null),
        [sis.slots.find(s => s.id === i.slot)?.nome || '—', i.ocupa > 1 ? ` (${i.ocupa})` : ''],
        mestre
          ? campo(`${p.id}:dur:${i.uid}`, i.durabilidadeAtual ?? i.durabilidade, v => acao('item.durabilidade', { id: p.id, uid: i.uid, valor: v }), { tipo: 'number', class: 'num', 'aria-label': `Durabilidade de ${i.nome}` })
          : `${i.durabilidadeAtual ?? i.durabilidade}/${i.durabilidade}`,
        [[i.dano, i.defesa ? `Def ${i.defesa}` : null].filter(Boolean).join(' · ') || '—', municaoView(p, i, mestre)],
        Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—',
        h('span', { class: 'moeda' }, icone('coins'), i.venda ?? '—'),
        [
          i.slot ? botao(i.equipado ? 'Desequipar' : 'Equipar', () => acao('item.equipar', { id: p.id, uid: i.uid, equipar: !i.equipado }), { class: i.equipado ? 'pequeno' : 'primario pequeno', icone: i.equipado ? 'x' : 'shirt' }) : null,
          (mestre || estado.campanha.lojaAberta) ? botao('Vender', async () => {
            if (await confirmar(`Vender ${i.nome} por ${i.venda ?? 0}?`)) await acao('item.vender', { id: p.id, uid: i.uid });
          }, { class: 'pequeno', icone: 'coins' }) : null,
          botao('', async () => {
            if (await confirmar(`Descartar ${i.nome}?`)) await acao('item.remover', { id: p.id, uid: i.uid });
          }, { class: 'pequeno perigo', icone: 'trash-2', title: `Descartar ${i.nome}` }),
        ],
      ],
    }))) : vazio('Nenhum item.', 'backpack'),
    mestre && !filtro ? selecao([{ valor: '', rotulo: '+ dar item do catálogo' }, ...sis.itens.map(i => ({ valor: i.id, rotulo: i.nome }))], '',
      v => v && acao('item.adicionar', { id: p.id, itemId: v }).catch(e => aviso(e.message, 'erro'))) : null);
}

// Munição: armas com "capacidade" mostram as balas carregadas; caixas de munição mostram a quantidade.
function municaoView(p, i, mestre) {
  if (i.capacidade) {
    const vazia = (i.carregada || 0) <= 0;
    return h('div', { class: 'municao' },
      h('span', { class: `selo ${vazia ? 'perigo' : ''}` }, `Munição ${i.carregada || 0}/${i.capacidade}`),
      botao('', () => acao('item.municao', { id: p.id, uid: i.uid, delta: -1 }), { class: 'pequeno', icone: 'minus', title: `Gastar 1 bala de ${i.nome}`, disabled: vazia }),
      mestre ? botao('', () => acao('item.municao', { id: p.id, uid: i.uid, delta: 1 }), { class: 'pequeno', icone: 'plus', title: `Pôr 1 bala em ${i.nome}` }) : null,
      botao('Recarregar', () => acao('item.recarregar', { id: p.id, uid: i.uid }).then(r => aviso(`${i.nome}: +${r.colocou} (${r.carregada}/${i.capacidade})`)),
        { class: 'pequeno', icone: 'refresh-cw', disabled: (i.carregada || 0) >= i.capacidade }));
  }
  if (i.tipo === 'municao') return h('span', { class: 'selo' }, `${i.quantidade || 0} balas (${i.municao})`);
  return null;
}

function controleMestre(p) {
  const xp = h('input', { type: 'number', value: 10, class: 'curto' });
  return h('div', {},
    h('div', { class: 'barra' },
      h('span', {}, 'Dar XP:'), xp, botao('Dar', () => acao('xp.dar', { id: p.id, qtd: xp.value }), { icone: 'sparkles' }),
      h('label', { class: 'mini' }, 'Dinheiro', campo(`${p.id}:dinheiro`, p.dinheiro, v => atualizar(p, { dinheiro: v }), { tipo: 'number', class: 'num' })),
      p.tipo === 'pj' && p.donoId ? botao('Liberar do jogador', async () => {
        if (await confirmar(`Tirar ${p.nome} do controle de ${p.dono}?`)) await acao('personagem.liberar', { id: p.id });
      }, { icone: 'user-round-x' }) : null,
      botao('Duplicar', () => acao('personagem.duplicar', { id: p.id }), { icone: 'copy' }),
      botao('Apagar ficha', async () => {
        if (await confirmar(`Apagar a ficha de ${p.nome}?`)) {
          await acao('personagem.remover', { id: p.id });
          estado.sel.personagem = null;
        }
      }, { class: 'perigo', icone: 'trash-2' })),
    titulo('Backups (feitos ao evoluir)', 'save', 'h4'),
    (p.backups || []).length
      ? h('ul', {}, [...p.backups].reverse().map(b => h('li', {}, `${formatarData(b.em)} — nível ${b.ficha.nivel}, XP ${b.ficha.xp} `,
        botao('Restaurar', async () => {
          if (await confirmar('Restaurar este backup? A ficha atual será substituída.')) await acao('backup.restaurar', { id: p.id, backupId: b.id });
        }, { class: 'pequeno', icone: 'refresh-cw' }))))
      : vazio('Nenhum backup ainda.', 'save'));
}
