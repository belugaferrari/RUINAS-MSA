import { h, botao, selecao, aviso, confirmar, vazio, formatarData, icone, titulo } from '../ui.js';
import { efeitosIcones, marcadoresLivres } from './efeitos.js';
import { estado, personagemPorId, meusPersonagens, render } from '../estado.js';
import { acao } from '../api.js';
import { derivados, LIMITE_SALA } from '/shared/regras.js';
import { linhaRolagem } from './ficha.js';
import { combateView, humorCartao, manipulacaoView, rodaDoHumor, ajustesMestre, xpDaSala, acoesCartaoBatalha, acoesCartaoSocial, alvoMarcado, marcarAlvo } from './combate.js';

const TITULOS = { social: 'Sala Social', batalha: 'Campo de Batalha' };
const ICONES_SALA = { social: 'drama', batalha: 'swords' };
// Sugestões de teste rápido por sala (provisório até as regras chegarem).
// Sugestões por sala (base do livro MSS): social usa Manipulação/Carisma; combate usa Briga e armas.
const SUGESTOES = {
  social: ['atr:CAR', 'sub:manipulacao.labia', 'sub:manipulacao.empatia', 'sub:manipulacao.seducao', 'sub:manipulacao.intimidacao', 'sub:manipulacao.lideranca', 'sub:manipulacao.impressionar'],
  batalha: ['sub:briga.ataque-desarmado', 'sub:briga.esquiva', 'sub:arma-branca.laminas-curtas', 'sub:arma-branca.laminas-longas', 'sub:armas-de-fogo.pistolas', 'sub:sentidos.visao'],
};

export function salaView(nome) {
  const c = estado.campanha;
  const s = c.salas[nome];
  const mestre = c.papel === 'mestre';
  const participantes = s.participantes.map(personagemPorId).filter(Boolean);
  return h('div', { class: 'sala' },
    h('div', { class: 'barra' },
      titulo(TITULOS[nome], ICONES_SALA[nome], 'h2'),
      h('span', { class: 'selo' }, icone('users'), `${s.participantes.length}/${LIMITE_SALA}`),
      h('span', { class: 'espaco' }),
      adicionar(nome, s, mestre),
      mestre ? botao('Esvaziar sala', async () => {
        if (await confirmar(`Remover todos de ${TITULOS[nome]} e limpar o registro?`)) await acao('sala.limpar', { sala: nome });
      }, { class: 'perigo', icone: 'trash-2' }) : null),
    mestre && nome === 'batalha' ? encontroAleatorio() : null,
    nome === 'batalha' ? combateView(participantes, mestre) : null,
    nome === 'social' ? rodaDoHumor() : null,
    nome === 'social' && mestre ? h('div', { class: 'bloco' }, xpDaSala(participantes)) : null,
    h('div', { class: 'sala-grade' },
      h('div', { class: 'participantes' },
        participantes.length ? participantes.map((p, i) => cartaoParticipante(nome, s, p, i, participantes.length, mestre, participantes)) : vazio('Ninguém na sala ainda.', ICONES_SALA[nome])),
      h('div', { class: 'registro' },
        nome === 'social' ? manipulacaoView(participantes, mestre) : null,
      rolagemRapida(nome, participantes, mestre),
        titulo('Registro', 'scroll'),
        h('ol', { class: 'log', 'data-rolagem': `log-${nome}` }, [...s.log].reverse().map(e => h('li', {}, h('small', {}, formatarData(e.em)), ' ', linhaRolagem(e)))))));
}

function adicionar(nome, s, mestre) {
  const c = estado.campanha;
  const candidatos = (mestre ? c.personagens : meusPersonagens()).filter(p => !s.participantes.includes(p.id));
  if (!candidatos.length) return null;
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
    class: `participante ${s.ativo === p.id ? 'ativo' : ''} ${p.tipo} ${alvo ? 'alvo' : ''} ${marcavel ? 'marcavel' : ''}`,
    onclick: marcavel ? e => { if (!e.target.closest('button, select, input, label, a, summary')) marcarAlvo(nome, p.id); } : null,
  },
    h('div', { class: 'avatar' }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
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
      nome === 'social' ? humorCartao(p, mestre || meu, mestre) : null,
      mestre ? ajustesMestre(p, nome) : null,
      nome === 'batalha' ? acoesCartaoBatalha(p, participantes, mestre) : acoesCartaoSocial(p, participantes, mestre)),
    h('div', { class: 'acoes' },
      marcavel ? botao(alvo ? 'Alvo' : '', () => marcarAlvo(nome, p.id), { class: `pequeno ${alvo ? 'perigo' : ''}`, icone: 'crosshair', title: alvo ? `Desmarcar ${p.nome} como alvo` : `Marcar ${p.nome} como alvo`, 'aria-pressed': alvo }) : null,
      veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: -1 }), { class: 'pequeno', icone: 'minus', title: `Tirar 1 PV de ${p.nome}`, 'aria-label': `Tirar 1 PV de ${p.nome}` }) : null,
      veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: 1 }), { class: 'pequeno', icone: 'plus', title: `Dar 1 PV a ${p.nome}`, 'aria-label': `Dar 1 PV a ${p.nome}` }) : null,
      veStats && p.atributos ? botao('Testar', () => {
        estado.sel[`rolar-${nome}`] = { ...(estado.sel[`rolar-${nome}`] || { dif: '1', valor: 50 }), quem: p.id, acao: '' };
        render();
        document.querySelector('[aria-label="O que testar"]')?.focus();
      }, { class: 'pequeno', icone: 'dices', title: `Rolar um teste de ${p.nome}` }) : null,
      nome === 'batalha' && veStats ? botao(caido(p) ? 'Levantar' : 'Caído', () => alternarCaido(p), { class: 'pequeno', icone: 'arrow-left-right', title: caido(p) ? `${p.nome} se levanta` : `${p.nome} fica caído` }) : null,
      mestre ? botao(s.ativo === p.id ? 'Desacionar' : 'Acionar', () => acao('sala.acionar', { sala: nome, id: p.id }), { class: 'pequeno primario', icone: 'zap' }) : null,
      mestre ? botao('', () => acao('sala.ordenar', { sala: nome, id: p.id, direcao: -1 }), { class: 'pequeno', icone: 'chevron-up', disabled: i === 0, title: `Subir ${p.nome} na ordem` }) : null,
      mestre ? botao('', () => acao('sala.ordenar', { sala: nome, id: p.id, direcao: 1 }), { class: 'pequeno', icone: 'chevron-down', disabled: i === total - 1, title: `Descer ${p.nome} na ordem` }) : null,
      mestre || meu ? botao('Tirar', () => acao('sala.remover', { sala: nome, id: p.id }), { class: 'pequeno perigo', icone: 'log-out', title: `Tirar ${p.nome} da sala` }) : null));
}

function rolagemRapida(nome, participantes, mestre) {
  const sis = estado.sistema;
  const meus = participantes.filter(p => mestre || p.donoId === estado.usuario.id);
  if (!meus.length && !mestre) return h('p', { class: 'dica' }, 'Entre na sala com um personagem para rolar testes aqui.');
  const chaveSel = `rolar-${nome}`;
  const sel = estado.sel[chaveSel] ||= { quem: !mestre && meus.length === 1 ? meus[0].id : '', acao: '', dif: '1', valor: 50 };
  const p = sel.quem && personagemPorId(sel.quem);
  const d = p?.atributos ? derivados(p, sis) : null;
  // Sugestões da sala aparecem primeiro.
  const sugestoes = SUGESTOES[nome].map(ref => {
    const [tipo, id] = ref.split(':');
    if (tipo === 'atr') { const a = sis.atributos.find(x => x.sigla === id); return a && { valor: ref, rotulo: `★ ${a.nome}%${d ? ` (${d.percentual[id]})` : ''}` }; }
    if (tipo === 'per') { const x = sis.pericias.find(y => y.id === id); return x && { valor: ref, rotulo: `★ ${x.nome}${d ? ` (${d.pericias[id]})` : ''}` }; }
    const per = sis.pericias.find(y => y.subpericias.some(z => z.id === id));
    const sub = per?.subpericias.find(z => z.id === id);
    return sub && { valor: ref, rotulo: `★ ${per.nome} › ${sub.nome}${d ? ` (${d.subpericias[id]})` : ''}` };
  }).filter(Boolean);
  const todas = d ? [...sis.atributos.map(a => ({ valor: `atr:${a.sigla}`, rotulo: `${a.nome}% (${d.percentual[a.sigla]})` })),
    ...sis.pericias.flatMap(x => x.subpericias.map(s => ({ valor: `sub:${s.id}`, rotulo: `${x.nome} › ${s.nome} (${d.subpericias[s.id]})` })))] : [];
  const difs = [...sis.teste.dificuldades.map((x, i) => ({ valor: String(i), rotulo: `${x.nome} (ND ${x.nd})` })), { valor: 'sem', rotulo: 'Sem ND' }];
  const secreta = h('input', { type: 'checkbox' });
  return h('div', { class: 'bloco' },
    titulo('Rolar teste (D-MIL)', 'dices'),
    h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: mestre ? 'Mestre (valor livre)' : 'Escolha o personagem' }, ...meus.map(x => ({ valor: x.id, rotulo: x.nome }))], sel.quem, v => { sel.quem = v; sel.acao = ''; render(); }, { 'aria-label': 'Quem rola' }),
      d ? selecao([{ valor: '', rotulo: 'O que testar…' }, ...sugestoes, ...todas], sel.acao, v => { sel.acao = v; }, { 'aria-label': 'O que testar' })
        : h('label', { class: 'linha' }, 'Ação %', h('input', { type: 'number', class: 'curto', value: sel.valor, onchange: e => { sel.valor = Number(e.target.value) || 0; } })),
      selecao(difs, sel.dif, v => { sel.dif = v; }, { 'aria-label': 'Dificuldade' }),
      mestre ? h('label', { class: 'linha' }, secreta, 'secreta') : null,
      botao('Rolar', async () => {
        if (!p && !mestre) throw new Error('Escolha o personagem.');
        if (d && !sel.acao) throw new Error('Escolha o que testar.');
        const dif = sis.teste.dificuldades[Number(sel.dif)];
        const r = await acao('rolar', {
          sala: nome, id: p?.id || null, acaoRef: d ? sel.acao : null, acao: d ? null : sel.valor, rotulo: d ? null : 'Teste do mestre',
          nd: sel.dif === 'sem' ? null : dif.nd, metade: !!dif?.metade, secreta: secreta.checked,
        });
        aviso(`${r.autor} — ${r.rotulo}: ${r.total}${r.nd != null ? (r.sucesso ? ' SUCESSO' : ' FALHA') : ''}`, r.sucesso === false ? 'erro' : 'ok');
      }, { class: 'primario', icone: 'dices' }),
      p ? botao('Iniciativa', async () => {
        const r = await acao('rolar', { sala: nome, id: p.id, tipo: 'iniciativa' });
        aviso(`Iniciativa de ${p.nome}: ${r.total}`);
      }, { icone: 'zap' }) : null));
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
