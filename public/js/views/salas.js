import { liberdadeDeHumor } from '/shared/combate.js';
import { h, botao, selecao, aviso, confirmar, vazio, formatarData, icone, titulo, barraPv, numeroPv } from '../ui.js';
import { efeitosIcones, marcadoresLivres } from './efeitos.js';
import { estado, personagemPorId, meusPersonagens, render } from '../estado.js';
import { acao } from '../api.js';
import { LIMITE_SALA } from '/shared/regras.js';
import { linhaRolagem } from './ficha.js';
import { combateView, controleTurnos, nomeHumor, humorCartao, rodaDoHumor, ajustesMestre, xpDaSala, alvoMarcado, marcarAlvo } from './combate.js';
import { painelBatalha, ordemLateral } from './batalha.js';
import { painelSocial } from './social.js';
import { prepararTeste } from './dados.js';
import { buscarMonstros } from '/shared/monstros.js';
import { miniaturaMonstro, resumoAfinidades, filtroTipos, estagioInicial } from './livros.js';

const TITULOS = { social: 'Sala Social', batalha: 'Campo de Batalha' };
const ICONES_SALA = { social: 'drama', batalha: 'swords' };
export function salaView(nome) {
  const c = estado.campanha;
  const s = c.salas[nome];
  const mestre = c.papel === 'mestre';
  const participantes = s.participantes.map(personagemPorId).filter(Boolean);
  return h('div', { class: `sala sala-${nome}` },
    h('div', { class: 'barra' },
      titulo(TITULOS[nome], ICONES_SALA[nome], 'h2'),
      h('span', { class: 'selo' }, icone('users'), `${s.participantes.length}/${LIMITE_SALA}`),
      h('span', { class: 'espaco' }),
      adicionar(nome, s, mestre),
      mestre ? botao('Esvaziar sala', async () => {
        if (await confirmar(`Remover todos de ${TITULOS[nome]} e limpar o registro?`)) await acao('sala.limpar', { sala: nome });
      }, { class: 'perigo', icone: 'trash-2' }) : null),
    // Em cima, o painel do personagem que você controla (esboço do autor); embaixo, o turno, o campo e o registro.
    // Turnos numa linha, a faixa de avatares na ordem da iniciativa (fica presa no alto ao rolar), o painel de quem você controla.
    nome === 'batalha' ? controleTurnos(participantes, mestre) : null,
    nome === 'batalha'
      ? [ordemLateral(participantes, mestre), painelBatalha(participantes, mestre), combateView(participantes, mestre)]
      : painelSocial(participantes, mestre),
    mestre && nome === 'batalha' ? adicionarMonstro() : null,
    mestre && nome === 'batalha' ? encontroAleatorio() : null,
    nome === 'social' ? rodaDoHumor() : null,
    nome === 'social' && mestre ? h('div', { class: 'bloco' }, xpDaSala(participantes)) : null,
    h('div', { class: 'sala-grade' },
      // Na Sala Social o jogador já vê todos na mesa social; a lista detalhada fica só para o mestre.
      nome === 'social' && !mestre ? null : h('div', { class: 'participantes' },
        titulo(nome === 'batalha' ? 'No campo' : 'Na sala', 'users'),
        participantes.length ? participantes.map((p, i) => cartaoParticipante(nome, s, p, i, participantes.length, mestre, participantes)) : vazio('Ninguém na sala ainda.', ICONES_SALA[nome])),
      h('div', { class: 'registro' },
        participantes.some(p => mestre || p.donoId === estado.usuario.id) ? null : h('p', { class: 'dica' }, 'Entre na sala com um personagem para agir aqui.'),
        titulo('Registro', 'scroll'),
        registro(nome, s.log))));
}

// Registro: só as últimas entradas; o resto abre num botão.
const NO_REGISTRO = 6;
function registro(nome, log) {
  const tudo = !!estado.sel[`log:${nome}`];
  const lista = [...log].reverse();
  return [
    h('ol', { class: 'log', 'data-rolagem': `log-${nome}` }, (tudo ? lista : lista.slice(0, NO_REGISTRO)).map(e => h('li', {}, h('small', {}, formatarData(e.em)), ' ', linhaRolagem(e)))),
    lista.length > NO_REGISTRO ? botao(tudo ? 'Mostrar só as últimas' : `Ver tudo (${lista.length})`, () => { estado.sel[`log:${nome}`] = !tudo; render(); }, { class: 'pequeno', icone: tudo ? 'chevron-up' : 'chevron-down' }) : null,
  ];
}

function adicionar(nome, s, mestre) {
  const c = estado.campanha;
  const candidatos = (mestre ? c.personagens : meusPersonagens()).filter(p => !s.participantes.includes(p.id));
  if (!candidatos.length) return null;
  // Jogador: um botão "Entrar" (com o nome, se tiver mais de um personagem). Só o mestre escolhe numa lista.
  if (!mestre) {
    const entrar = p => acao('sala.adicionar', { sala: nome, id: p.id }).catch(e => aviso(e.message, 'erro'));
    // Sala Social: o humor é escolhido antes de entrar (lá dentro só muda por manipulação ou empatia natural).
    const humorAntes = p => nome === 'social' && estado.sistema.modulos?.social && p.atributos
      ? selecao(liberdadeDeHumor(p, estado.sistema).humores.map(x => ({ valor: x.id, rotulo: `Entrar ${x.nome.toLowerCase()}` })).concat(
        liberdadeDeHumor(p, estado.sistema).humores.some(x => x.id === (p.humor || 'neutro')) ? [] : [{ valor: p.humor, rotulo: `Entrar ${nomeHumor(p.humor).toLowerCase()} (atual)` }]),
      p.humor || 'neutro', async v => {
        if (p.humorImposto && v !== p.humor && !(await confirmar(`${nomeHumor(p.humor)} foi imposto. Agir contra ele (dissonância) custa ${estado.sistema.social?.dissonancia?.dano || '1d6'} de Sanidade. Mudar mesmo assim?`))) return render();
        acao('humor.definir', { id: p.id, humor: v }).catch(e => aviso(e.message, 'erro'));
      },
      { 'aria-label': `Humor de ${p.nome} ao entrar`, title: 'O humor só pode ser escolhido antes de entrar na sala' })
      : null;
    return h('div', { class: 'barra' }, candidatos.map(p => [humorAntes(p), botao(candidatos.length > 1 || meusPersonagens().length > 1 ? `Entrar com ${p.nome}` : 'Entrar',
      () => entrar(p), { class: 'primario', icone: 'log-in', title: `${p.nome} entra em ${TITULOS[nome]}` })]));
  }
  const grupos = Object.fromEntries((c.grupos || []).map(g => [g.id, g.nome]));
  const opcoes = [{ valor: '', rotulo: mestre ? '+ colocar na sala…' : '+ entrar com…' },
    ...candidatos.map(p => ({ valor: p.id, rotulo: p.tipo === 'pj' ? `${p.nome} (PJ${p.dono ? ` de ${p.dono}` : ''})` : `${p.nome} (NPC · ${grupos[p.grupoId] || ''})` }))];
  return selecao(opcoes, '', v => v && acao('sala.adicionar', { sala: nome, id: v }).catch(e => aviso(e.message, 'erro')));
}

function cartaoParticipante(nome, s, p, i, total, mestre, participantes) {
  const meu = p.donoId === estado.usuario.id;
  const veStats = mestre || meu;
  const sis = estado.sistema;
  const automatico = nome === 'batalha' ? sis.modulos?.combate : sis.modulos?.social;
  // Clicar no cartão marca o personagem como alvo (o jogador não marca o próprio personagem).
  const marcavel = automatico && (mestre || (!meu && participantes.some(x => x.donoId === estado.usuario.id)));
  const alvo = alvoMarcado(nome) === p.id;
  if (nome === 'batalha') return linhaCampo(s, p, i, total, mestre, meu, veStats, marcavel, alvo);
  return h('div', {
    class: `participante ${s.ativo === p.id ? 'ativo' : ''} ${p.tipo} ${alvo ? 'alvo' : ''} ${marcavel ? 'marcavel' : ''} ${p.semPv || (p.pv && p.pv.atual <= 0) ? 'sem-pv' : ''}`,
    onclick: marcavel ? e => { if (!e.target.closest('button, select, input, label, a, summary')) marcarAlvo(nome, p.id); } : null,
  },
    h('div', { class: 'avatar', 'data-pid': p.id }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
    h('div', { class: 'info' },
      h('strong', {}, p.nome), s.ativo === p.id ? h('span', { class: 'selo ok' }, mestre ? 'acionado' : 'em cena') : null,
      h('div', { class: 'meta' }, p.tipo === 'pj' ? `PJ${p.dono ? ` · ${p.dono}` : ''}` : 'NPC'),
      veStats && p.pv ? barraPv(p) : null,
      veStats && p.pv ? h('div', { class: 'meta icones-meta' },
        h('span', {}, icone('heart'), numeroPv(p)),
        h('span', {}, icone('brain'), p.sanidade?.atual ?? '-'),
        h('span', {}, icone('hand-heart'), p.humanidade?.atual ?? '-')) : null,
      efeitosIcones(p, { mestre }),
      veStats && marcadoresLivres(p).length ? h('div', { class: 'marcadores' }, marcadoresLivres(p).map(m => h('span', { class: 'etiqueta' }, m))) : null,
      // Na sala o humor aparece como selo; as escolhas ficam no painel de cima (e o rebote, aqui, para quem escolhe).
      nome === 'social' ? humorCartao(p, (mestre || meu) && !!p.humorOpcoes?.length, mestre) : null,
      mestre ? ajustesMestre(p, nome) : null),
    h('div', { class: 'acoes' },
      marcavel ? botao(alvo ? 'Alvo' : '', () => marcarAlvo(nome, p.id), { class: `pequeno ${alvo ? 'perigo' : ''}`, icone: 'crosshair', title: alvo ? `Desmarcar ${p.nome} como alvo` : `Marcar ${p.nome} como alvo`, 'aria-pressed': alvo }) : null,
      veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: -1 }), { class: 'pequeno', icone: 'minus', title: `Tirar 1 PV de ${p.nome}`, 'aria-label': `Tirar 1 PV de ${p.nome}` }) : null,
      veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: 1 }), { class: 'pequeno', icone: 'plus', title: `Dar 1 PV a ${p.nome}`, 'aria-label': `Dar 1 PV a ${p.nome}` }) : null,
      veStats && p.atributos ? botao('Testar', () => prepararTeste(p.id, ''), { class: 'pequeno', icone: 'dices', title: `Rolar um teste de ${p.nome}` }) : null,
      nome === 'batalha' && veStats ? botao(caido(p) ? 'Levantar' : 'Caído', () => alternarCaido(p), { class: 'pequeno', icone: 'arrow-left-right', title: caido(p) ? `${p.nome} se levanta` : `${p.nome} fica caído` }) : null,
      mestre ? botao(s.ativo === p.id ? 'Desacionar' : 'Acionar', () => acao('sala.acionar', { sala: nome, id: p.id }), { class: 'pequeno primario', icone: 'zap' }) : null,
      mestre ? botao('', () => acao('sala.ordenar', { sala: nome, id: p.id, direcao: -1 }), { class: 'pequeno', icone: 'chevron-up', disabled: i === 0, title: `Subir ${p.nome} na ordem` }) : null,
      mestre ? botao('', () => acao('sala.ordenar', { sala: nome, id: p.id, direcao: 1 }), { class: 'pequeno', icone: 'chevron-down', disabled: i === total - 1, title: `Descer ${p.nome} na ordem` }) : null,
      mestre || meu ? botao('Tirar', () => acao('sala.remover', { sala: nome, id: p.id }), { class: 'pequeno perigo', icone: 'log-out', title: `Tirar ${p.nome} da sala` }) : null));
}

// Campo de Batalha: uma linha por personagem — avatar, nome, PV (de quem você vê), efeitos e o alvo.
// As outras ações (PV, testar, caído, acionar, ordem, tirar) ficam no menu "⋯".
function linhaCampo(s, p, i, total, mestre, meu, veStats, marcavel, alvo) {
  const semPv = p.semPv || (p.pv && p.pv.atual <= 0);
  const acoes = [
    veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: -1 }), { class: 'pequeno', icone: 'minus', title: `Tirar 1 PV de ${p.nome}`, 'aria-label': `Tirar 1 PV de ${p.nome}` }) : null,
    veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: 1 }), { class: 'pequeno', icone: 'plus', title: `Dar 1 PV a ${p.nome}`, 'aria-label': `Dar 1 PV a ${p.nome}` }) : null,
    veStats && p.atributos ? botao('Testar', () => prepararTeste(p.id, ''), { class: 'pequeno', icone: 'dices', title: `Rolar um teste de ${p.nome}` }) : null,
    veStats ? botao(caido(p) ? 'Levantar' : 'Caído', () => alternarCaido(p), { class: 'pequeno', icone: 'arrow-left-right', title: caido(p) ? `${p.nome} se levanta` : `${p.nome} fica caído` }) : null,
    mestre ? botao(s.ativo === p.id ? 'Desacionar' : 'Acionar', () => acao('sala.acionar', { sala: 'batalha', id: p.id }), { class: 'pequeno primario', icone: 'zap' }) : null,
    mestre ? botao('', () => acao('sala.ordenar', { sala: 'batalha', id: p.id, direcao: -1 }), { class: 'pequeno', icone: 'chevron-up', disabled: i === 0, title: `Subir ${p.nome} na lista` }) : null,
    mestre ? botao('', () => acao('sala.ordenar', { sala: 'batalha', id: p.id, direcao: 1 }), { class: 'pequeno', icone: 'chevron-down', disabled: i === total - 1, title: `Descer ${p.nome} na lista` }) : null,
    mestre || meu ? botao('Tirar', () => acao('sala.remover', { sala: 'batalha', id: p.id }), { class: 'pequeno perigo', icone: 'log-out', title: `Tirar ${p.nome} da sala` }) : null,
    mestre ? seletorEstagio(p) : null,
    mestre ? ajustesMestre(p, 'batalha') : null,
  ].filter(Boolean);
  const chave = `menu:${p.id}`;
  return h('div', {
    class: `participante compacto ${s.ativo === p.id ? 'ativo' : ''} ${p.tipo} ${alvo ? 'alvo' : ''} ${marcavel ? 'marcavel' : ''} ${semPv ? 'sem-pv' : ''}`,
    onclick: marcavel ? e => { if (!e.target.closest('button, select, input, label, a, summary, details')) marcarAlvo('batalha', p.id); } : null,
  },
    h('div', { class: 'avatar', 'data-pid': p.id }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
    h('div', { class: 'info' },
      h('div', { class: 'linha-nome' },
        h('strong', {}, p.nome),
        h('small', { class: 'meta' }, p.tipo === 'pj' ? `PJ${p.dono ? ` · ${p.dono}` : ''}` : 'NPC'),
        p.monstro?.estagio != null && mestre ? h('span', { class: 'selo', title: 'Estágio do monstro' }, p.monstro.nomeEstagio || `Estágio ${p.monstro.estagio}`) : null,
        s.ativo === p.id ? h('span', { class: 'selo ok' }, mestre ? 'acionado' : 'em cena') : null,
        semPv ? h('span', { class: 'selo perigo' }, 'fora de combate') : null),
      veStats && p.pv ? h('div', { class: 'linha-stats' },
        barraPv(p),
        h('span', { class: 'meta icones-meta' },
          h('span', {}, icone('heart'), numeroPv(p)),
          h('span', {}, icone('brain'), p.sanidade?.atual ?? '-'),
          h('span', {}, icone('hand-heart'), p.humanidade?.atual ?? '-'))) : null),
    h('div', { class: 'lado' },
      efeitosIcones(p, { mestre }),
      veStats && marcadoresLivres(p).length ? h('div', { class: 'marcadores' }, marcadoresLivres(p).map(m => h('span', { class: 'etiqueta' }, m))) : null,
      marcavel ? botao(alvo ? 'Alvo' : '', () => marcarAlvo('batalha', p.id), { class: `pequeno ${alvo ? 'perigo' : ''}`, icone: 'crosshair', title: alvo ? `Desmarcar ${p.nome} como alvo` : `Marcar ${p.nome} como alvo`, 'aria-pressed': alvo }) : null,
      acoes.length ? h('details', { class: 'menu-acoes', open: !!estado.sel[chave], ontoggle: e => { estado.sel[chave] = e.target.open; } },
        h('summary', { title: `Ações de ${p.nome}`, 'aria-label': `Ações de ${p.nome}` }, icone('ellipsis')),
        h('div', { class: 'menu-corpo' }, acoes)) : null));
}

// Mestre: pôr monstros do livro no campo — busca por palavra aproximada (ou a lista toda), estágio e quantidade.
function adicionarMonstro() {
  const sis = estado.sistema;
  const termo = estado.sel['busca:addMonstro'] || '';
  const todos = !!estado.sel.addMonstroTodos;
  const [filtro, lista] = termo.trim() || todos ? filtroTipos('campo', buscarMonstros(sis.monstros, termo)) : [null, []];
  const mostra = lista.slice(0, todos && !termo.trim() ? 200 : 12);
  const linha = m => {
    const chaveEst = `addMonstroEst:${m.nome}`, chaveQtd = `addMonstroQtd:${m.nome}`;
    return h('li', {},
      miniaturaMonstro(m, m.estagios?.[0] || null),
      h('span', { class: 'monstro-nome' }, h('strong', {}, m.nome), h('small', {}, ` ND ${m.dificuldade ?? '—'} · PV ${m.pv ?? 'calc.'} `), h('span', { class: 'afinidades' }, resumoAfinidades(m))),
      m.estagios?.length ? selecao([{ valor: '', rotulo: 'Base' }, ...m.estagios.map(e => ({ valor: String(e.numero), rotulo: `Estágio ${e.numero}${e.nome ? ` · ${e.nome}` : ''}` }))],
        estado.sel[chaveEst] ?? String(estagioInicial(m) ?? ''), v => { estado.sel[chaveEst] = v; }, { 'aria-label': `Estágio de ${m.nome}` }) : null,
      h('input', { type: 'number', min: 1, max: 20, class: 'curto', value: estado.sel[chaveQtd] || 1, 'aria-label': `Quantos ${m.nome}`, title: 'Quantos',
        onchange: e => { estado.sel[chaveQtd] = Math.max(1, parseInt(e.target.value, 10) || 1); } }),
      botao('Pôr no campo', async () => {
        const r = await acao('monstro.adicionar', { nome: m.nome, estagio: (estado.sel[chaveEst] ?? String(estagioInicial(m) ?? '')) || null, quantidade: estado.sel[chaveQtd] || 1 });
        aviso(`${r.ids.length > 1 ? `${r.ids.length}× ` : ''}${m.nome} no Campo de Batalha.`);
      }, { class: 'pequeno primario', icone: 'swords' }));
  };
  return h('details', { class: 'bloco', open: estado.sel.addMonstroAberto ?? true, ontoggle: e => { estado.sel.addMonstroAberto = e.target.open; } },
    h('summary', {}, icone('skull'), ' Adicionar monstro'),
    h('div', { class: 'barra' },
      h('label', { class: 'busca' }, icone('search'), h('input', { type: 'search', placeholder: 'Nome aproximado, raça, afinidade, lugar…', 'data-key': 'busca:addMonstro', value: termo,
        'aria-label': 'Buscar monstro', oninput: e => { estado.sel['busca:addMonstro'] = e.target.value; render(); } })),
      botao(todos ? 'Esconder a lista' : `Ver a lista (${sis.monstros.length})`, () => { estado.sel.addMonstroTodos = !todos; render(); }, { class: 'pequeno', icone: 'list-ordered' })),
    filtro,
    termo.trim() && !lista.length ? h('p', { class: 'dica' }, 'Nenhum monstro parecido. Tente outra palavra.') : null,
    mostra.length ? h('ul', { class: 'add-monstro-resultados' }, mostra.map(linha)) : null,
    lista.length > mostra.length ? h('p', { class: 'dica' }, `Mostrando ${mostra.length} de ${lista.length}. Digite mais para filtrar.`) : null);
}

function encontroAleatorio() {
  const c = estado.campanha;
  const limite = h('input', { type: 'number', min: 1, value: 5, class: 'curto' });
  const monstros = h('input', { type: 'checkbox', checked: true });
  const grupos = c.grupos.filter(g => g.id !== 'encontros').map(g => ({ g, cb: h('input', { type: 'checkbox' }) }));
  return h('details', { class: 'bloco', open: !!estado.sel.encontroAberto, ontoggle: e => { estado.sel.encontroAberto = e.target.open; } },
    h('summary', {}, icone('skull'), 'Encontro aleatório'),
    h('p', { class: 'dica' }, 'Soma a "dificuldade" das criaturas sorteadas sem passar do limite. NPCs usam o campo Dificuldade (ou o nível). Regras definitivas virão depois.'),
    h('div', { class: 'barra' },
      h('label', { class: 'linha' }, 'Dificuldade máxima', limite),
      h('label', { class: 'linha' }, monstros, 'Livro dos Monstros'),
      grupos.map(({ g, cb }) => h('label', { class: 'linha' }, cb, g.nome)),
      botao('Gerar encontro', async () => {
        const r = await acao('encontro.gerar', { limite: limite.value, usarMonstros: monstros.checked, grupos: grupos.filter(x => x.cb.checked).map(x => x.g.id) });
        aviso(`Encontro: ${r.nomes.join(', ')} (dificuldade ${r.soma})`);
      }, { class: 'primario', icone: 'dices' })));
}

// Mestre: muda o estágio do monstro em campo (o dano tomado continua; muda PV máximo, atributos, ataques…).
function seletorEstagio(p) {
  const m = p.monstro && estado.sistema.monstros.find(x => x.nome === p.monstro.nome);
  if (!m?.estagios?.length) return null;
  return h('label', { class: 'linha', title: 'Estágio do monstro' }, icone('trending-up'),
    selecao([{ valor: '', rotulo: 'Estágio base' }, ...m.estagios.map(e => ({ valor: String(e.numero), rotulo: `Estágio ${e.numero}${e.nome ? ` · ${e.nome}` : ''}` }))],
      p.monstro.estagio == null ? '' : String(p.monstro.estagio),
      v => acao('monstro.estagio', { id: p.id, estagio: v }).then(() => aviso(`${p.nome}: ${v ? `estágio ${v}` : 'estágio base'}.`)).catch(e => aviso(e.message, 'erro')),
      { 'aria-label': `Estágio de ${p.nome}` }));
}

const caido = p => (p.marcadores || []).includes('Caído');
function alternarCaido(p) {
  const marcadores = caido(p) ? p.marcadores.filter(m => m !== 'Caído') : [...(p.marcadores || []), 'Caído'];
  return acao('personagem.atualizar', { id: p.id, patch: { marcadores } });
}
