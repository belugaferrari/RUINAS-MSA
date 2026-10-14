import { h, botao, selecao, aviso, confirmar, vazio, formatarData, icone, titulo } from '../ui.js';
import { estado, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { derivados, LIMITE_SALA } from '/shared/regras.js';
import { linhaRolagem } from './ficha.js';

const TITULOS = { social: 'Sala Social', batalha: 'Campo de Batalha' };
const ICONES_SALA = { social: 'drama', batalha: 'swords' };
// Sugestões de teste rápido por sala (provisório até as regras chegarem).
const SUGESTOES = { social: ['Carisma', 'Manipulação', 'Persuasão', 'Lábia', 'Intimidação'], batalha: ['Destreza', 'Força', 'Briga', 'Armas brancas', 'Armas de fogo'] };

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
    h('div', { class: 'sala-grade' },
      h('div', { class: 'participantes' },
        participantes.length ? participantes.map((p, i) => cartaoParticipante(nome, s, p, i, participantes.length, mestre)) : vazio('Ninguém na sala ainda.', ICONES_SALA[nome])),
      h('div', { class: 'registro' },
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

function cartaoParticipante(nome, s, p, i, total, mestre) {
  const meu = p.donoId === estado.usuario.id;
  const veStats = mestre || meu;
  return h('div', { class: `participante ${s.ativo === p.id ? 'ativo' : ''} ${p.tipo}` },
    h('div', { class: 'avatar' }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
    h('div', { class: 'info' },
      h('strong', {}, p.nome), s.ativo === p.id ? h('span', { class: 'selo ok' }, mestre ? 'acionado' : 'em cena') : null,
      h('div', { class: 'meta' }, p.tipo === 'pj' ? `PJ${p.dono ? ` · ${p.dono}` : ''}` : 'NPC'),
      veStats && p.pv ? h('div', { class: 'barra-pv', title: `PV ${p.pv.atual}/${p.pv.max}` },
        h('i', { style: { width: `${Math.max(0, Math.min(100, (100 * p.pv.atual) / (p.pv.max || 1)))}%` } })) : null,
      veStats && p.pv ? h('div', { class: 'meta icones-meta' },
        h('span', {}, icone('heart'), `${p.pv.atual}/${p.pv.max}`),
        h('span', {}, icone('brain'), p.sanidade?.atual ?? '-'),
        h('span', {}, icone('hand-heart'), p.humanidade?.atual ?? '-')) : null),
    h('div', { class: 'acoes' },
      veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: -1 }), { class: 'pequeno', icone: 'minus', title: `Tirar 1 PV de ${p.nome}`, 'aria-label': `Tirar 1 PV de ${p.nome}` }) : null,
      veStats && p.pv ? botao('PV', () => acao('pv.alterar', { id: p.id, delta: 1 }), { class: 'pequeno', icone: 'plus', title: `Dar 1 PV a ${p.nome}`, 'aria-label': `Dar 1 PV a ${p.nome}` }) : null,
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
  const sel = estado.sel[chaveSel] ||= { quem: !mestre && meus.length === 1 ? meus[0].id : '', a: '', b: '' };
  const nomes = [...sis.atributos, ...sis.pericias].map(x => x.nome);
  const sugeridos = SUGESTOES[nome].filter(n => nomes.includes(n));
  const lista = [...sugeridos, ...nomes.filter(n => !sugeridos.includes(n))];
  const secreta = h('input', { type: 'checkbox' });
  return h('div', { class: 'bloco' },
    titulo('Rolar teste', 'dices'),
    h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: mestre ? 'Mestre (sem ficha)' : 'Escolha o personagem' }, ...meus.map(p => ({ valor: p.id, rotulo: p.nome }))], sel.quem, v => { sel.quem = v; }),
      selecao([{ valor: '', rotulo: '— valor 1 —' }, ...lista], sel.a, v => { sel.a = v; }),
      selecao([{ valor: '', rotulo: '— valor 2 —' }, ...lista], sel.b, v => { sel.b = v; }),
      mestre ? h('label', { class: 'linha' }, secreta, 'secreta') : null,
      botao('Rolar', async () => {
        const p = sel.quem && personagemPorId(sel.quem);
        if (!p && !mestre) throw new Error('Escolha o personagem.');
        const d = p?.atributos ? derivados(p, sis) : null;
        const componentes = [sel.a, sel.b].filter(Boolean).map(n => ({ nome: n, valor: d ? (d.atributos[n] ?? d.pericias[n] ?? 0) : 0 }));
        const r = await acao('rolar', { sala: nome, id: p?.id || null, rotulo: componentes.map(x => x.nome).join(' + ') || 'Teste', componentes, secreta: secreta.checked });
        aviso(`${r.autor}: ${r.total}`);
      }, { class: 'primario', icone: 'dices' })));
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
