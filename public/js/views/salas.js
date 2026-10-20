import { h, botao, selecao, aviso, confirmar, vazio, formatarData, icone, titulo } from '../ui.js';
import { efeitosIcones, marcadoresLivres } from './efeitos.js';
import { estado, personagemPorId, meusPersonagens, render } from '../estado.js';
import { acao } from '../api.js';
import { LIMITE_SALA } from '/shared/regras.js';
import { linhaRolagem } from './ficha.js';
import { combateView, controleTurnos, humorCartao, rodaDoHumor, ajustesMestre, xpDaSala, alvoMarcado, marcarAlvo } from './combate.js';
import { painelBatalha, ordemLateral } from './batalha.js';
import { painelSocial } from './social.js';
import { prepararTeste } from './dados.js';

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
    nome === 'batalha' ? controleTurnos(participantes, mestre) : null,
    nome === 'batalha'
      ? h('div', { class: 'campo-com-ordem' }, ordemLateral(participantes, mestre),
        h('div', { class: 'campo-conteudo' }, painelBatalha(participantes, mestre), combateView(participantes, mestre)))
      : painelSocial(participantes, mestre),
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
        h('ol', { class: 'log', 'data-rolagem': `log-${nome}` }, [...s.log].reverse().map(e => h('li', {}, h('small', {}, formatarData(e.em)), ' ', linhaRolagem(e)))))));
}

function adicionar(nome, s, mestre) {
  const c = estado.campanha;
  const candidatos = (mestre ? c.personagens : meusPersonagens()).filter(p => !s.participantes.includes(p.id));
  if (!candidatos.length) return null;
  // Jogador: um botão "Entrar" (com o nome, se tiver mais de um personagem). Só o mestre escolhe numa lista.
  if (!mestre) {
    const entrar = p => acao('sala.adicionar', { sala: nome, id: p.id }).catch(e => aviso(e.message, 'erro'));
    return h('div', { class: 'barra' }, candidatos.map(p => botao(candidatos.length > 1 || meusPersonagens().length > 1 ? `Entrar com ${p.nome}` : 'Entrar',
      () => entrar(p), { class: 'primario', icone: 'log-in', title: `${p.nome} entra em ${TITULOS[nome]}` })));
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
  return h('div', {
    class: `participante ${s.ativo === p.id ? 'ativo' : ''} ${p.tipo} ${alvo ? 'alvo' : ''} ${marcavel ? 'marcavel' : ''} ${p.semPv || (p.pv && p.pv.atual <= 0) ? 'sem-pv' : ''}`,
    onclick: marcavel ? e => { if (!e.target.closest('button, select, input, label, a, summary')) marcarAlvo(nome, p.id); } : null,
  },
    h('div', { class: 'avatar', 'data-pid': p.id }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
    h('div', { class: 'info' },
      h('strong', {}, p.nome), s.ativo === p.id ? h('span', { class: 'selo ok' }, mestre ? 'acionado' : 'em cena') : null,
      h('div', { class: 'meta' }, p.tipo === 'pj' ? `PJ${p.dono ? ` · ${p.dono}` : ''}` : 'NPC'),
      veStats && p.pv ? h('div', { class: 'barra-pv', title: `PV ${p.pv.atual}/${p.pv.max}` },
        h('i', { style: { width: `${Math.max(0, Math.min(100, (100 * p.pv.atual) / (p.pv.max || 1)))}%` } })) : null,
      veStats && p.pv ? h('div', { class: 'meta icones-meta' },
        h('span', {}, icone('heart'), `${p.pv.atual}/${p.pv.max}`),
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

const caido = p => (p.marcadores || []).includes('Caído');
function alternarCaido(p) {
  const marcadores = caido(p) ? p.marcadores.filter(m => m !== 'Caído') : [...(p.marcadores || []), 'Caído'];
  return acao('personagem.atualizar', { id: p.id, patch: { marcadores } });
}
