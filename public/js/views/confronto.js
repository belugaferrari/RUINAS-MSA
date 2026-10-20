import { h, botao, selecao, aviso, confirmar, icone, titulo, vazio, formatarData, seloRevisao } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados, subpericiasDe } from '/shared/regras.js';

// Confrontos fora do combate: Ação × Ação passiva (livro) ou disputa em que os dois rolam (provisório).
const MODOS = {
  passiva: { nome: 'Ação × Ação passiva', descricao: 'Regra do livro: o lado A rola AÇÃO% + 1d100 contra a passiva do lado B (AÇÃO% + 50). Ex.: Furtividade contra a Visão de um guarda.' },
  disputa: { nome: 'Disputa (os dois rolam)', descricao: 'Provisório para o MSA: cada lado rola AÇÃO% + 1d100; o maior total vence. Empate: vence a maior ação. Acerto crítico vence quem não tirou crítico.', provisorio: true },
};

// Exemplos rápidos tirados do livro e de situações comuns fora do combate.
const MODELOS = [
  { titulo: 'Esgueirar-se sem ser visto', modo: 'passiva', a: 'sub:espionagem.furtividade', b: 'sub:sentidos.visao' },
  { titulo: 'Esconder-se', modo: 'passiva', a: 'sub:espionagem.camuflagem', b: 'sub:sentidos.visao' },
  { titulo: 'Furtar sem ser notado', modo: 'passiva', a: 'sub:espionagem.furtar', b: 'sub:sentidos.visao' },
  { titulo: 'Disfarce', modo: 'passiva', a: 'sub:espionagem.disfarce', b: 'sub:sentidos.visao' },
  { titulo: 'Corrida', modo: 'disputa', a: 'sub:esportes.corrida', b: 'sub:esportes.corrida' },
  { titulo: 'Queda de braço', modo: 'disputa', a: 'atr:FOR', b: 'atr:FOR' },
  { titulo: 'Jogo de cartas', modo: 'disputa', a: 'sub:jogos.cartas', b: 'sub:jogos.cartas' },
  { titulo: 'Negociação', modo: 'disputa', a: 'sub:avaliacao-de-objetos.negociacao', b: 'sub:avaliacao-de-objetos.negociacao' },
];

const novo = () => (estado.sel.novoConfronto ||= { titulo: '', modo: 'passiva', secreto: false, a: { personagemId: '', acaoRef: '', valor: 40, mod: 0, nome: '' }, b: { personagemId: '', acaoRef: '', valor: 40, mod: 0, nome: '' } });

function opcoesAcao(p) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  return [{ valor: '', rotulo: 'Ação…' },
    ...sis.atributos.map(a => ({ valor: `atr:${a.sigla}`, rotulo: `${a.nome}% (${d.percentual[a.sigla]})` })),
    ...sis.pericias.flatMap(x => [{ valor: `per:${x.id}`, rotulo: `${x.nome} (${d.pericias[x.id]})` },
      ...subpericiasDe(x, p, sis).map(s => ({ valor: `sub:${s.id}`, rotulo: `· ${x.nome} › ${s.nome} (${d.subpericias[s.id]})` }))])];
}

function formLado(rotulo, l) {
  const c = estado.campanha;
  const p = l.personagemId && personagemPorId(l.personagemId);
  const numero = (rot, k) => h('label', { class: 'linha' }, rot, h('input', { type: 'number', class: 'curto', value: l[k], onchange: e => { l[k] = Number(e.target.value) || 0; } }));
  return h('fieldset', { class: 'lado-confronto' },
    h('legend', {}, rotulo),
    selecao([{ valor: '', rotulo: 'Sem ficha (valor livre)' }, ...c.personagens.filter(x => x.atributos && x.grupoId !== 'encontros').map(x => ({ valor: x.id, rotulo: `${x.nome}${x.tipo === 'npc' ? ' (NPC)' : ''}` }))],
      l.personagemId, v => { l.personagemId = v; render(); }, { 'aria-label': `Personagem do ${rotulo}` }),
    p ? selecao(opcoesAcao(p), l.acaoRef, v => { l.acaoRef = v; }, { 'aria-label': `Ação do ${rotulo}` })
      : h('div', { class: 'barra' },
        h('input', { placeholder: 'Nome (ex.: Guarda do portão)', value: l.nome, 'aria-label': `Nome do ${rotulo}`, oninput: e => { l.nome = e.target.value; } }),
        numero('Ação %', 'valor')),
    numero('Modificador', 'mod'));
}

function formNovo() {
  const n = novo();
  return h('details', { class: 'bloco', open: estado.sel.confAberto !== false, ontoggle: e => { estado.sel.confAberto = e.target.open; } },
    h('summary', {}, icone('plus'), ' Novo confronto'),
    h('div', { class: 'barra' }, h('span', {}, 'Modelos:'),
      MODELOS.map(m => h('button', {
        type: 'button', class: 'pequeno',
        onclick: () => { Object.assign(n, { titulo: m.titulo, modo: m.modo }); n.a.acaoRef = m.a; n.b.acaoRef = m.b; render(); },
      }, m.titulo))),
    h('div', { class: 'form' },
      h('label', {}, 'Título', h('input', { value: n.titulo, placeholder: 'Ex.: Passar pelo guarda do mercado', 'data-key': 'conf:titulo', oninput: e => { n.titulo = e.target.value; } })),
      h('div', { class: 'cartoes' }, Object.entries(MODOS).map(([id, m]) => h('button', {
        type: 'button', class: `cartao escolha ${n.modo === id ? 'escolhido' : ''}`, 'aria-pressed': n.modo === id, onclick: () => { n.modo = id; render(); },
      }, h('strong', {}, m.nome), m.provisorio ? seloRevisao(true, 'provisório') : null, h('p', {}, m.descricao)))),
      h('div', { class: 'lados-confronto' }, formLado(n.modo === 'passiva' ? 'Lado A (rola)' : 'Lado A', n.a), h('div', { class: 'versus' }, icone('arrow-left-right')), formLado(n.modo === 'passiva' ? 'Lado B (passiva)' : 'Lado B', n.b)),
      h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: n.secreto, onchange: e => { n.secreto = e.target.checked; } }), 'Secreto (só o mestre vê)'),
      botao('Criar confronto', async () => {
        await acao('confronto.criar', { titulo: n.titulo, modo: n.modo, a: n.a, b: n.b, secreto: n.secreto });
        estado.sel.novoConfronto = null;
        aviso('Confronto criado.');
      }, { class: 'primario', icone: 'scale' })));
}

function ladoView(conf, ladoId, mestre) {
  const L = conf.lados[ladoId];
  const r = conf.rolagens[ladoId];
  const p = L.personagemId && personagemPorId(L.personagemId);
  const meu = p && p.donoId === estado.usuario.id;
  const rola = conf.modo === 'disputa' || ladoId === 'a';
  const venceu = conf.resultado?.vencedor === ladoId;
  return h('div', { class: `lado ${venceu ? 'vencedor' : ''}` },
    h('strong', {}, L.nome), h('small', {}, ` · ${L.acaoNome}${L.mod ? ` (${L.mod > 0 ? '+' : ''}${L.mod})` : ''}`),
    r ? h('div', { class: 'rolagem-lado' }, h('span', { class: 'total' }, r.total), h('small', {}, ` = d100 ${r.dp} + ação ${r.acao} · DS ${r.ds}`),
      r.critico ? h('span', { class: 'selo cheio' }, `crítico de ${r.critico}`) : null)
      : !rola ? h('p', { class: 'dica' }, 'Passiva (não rola)')
        : conf.estado === 'aberto' && (mestre || meu)
          ? botao(`Rolar ${L.nome}`, () => acao('confronto.rolar', { id: conf.id, lado: ladoId }), { class: 'primario pequeno', icone: 'dices' })
          : h('p', { class: 'dica' }, 'Aguardando rolagem…'),
    venceu ? h('span', { class: 'selo ok' }, icone('flag'), 'vencedor') : null);
}

function cartaoConfronto(conf, mestre) {
  const m = MODOS[conf.modo];
  return h('article', { class: `cartao confronto ${conf.estado}` },
    h('div', { class: 'barra' },
      titulo(conf.titulo, 'scale', 'h3'),
      h('span', { class: 'selo' }, m?.nome || conf.modo), conf.secreto ? h('span', { class: 'selo' }, icone('eye-off'), 'secreto') : null,
      h('span', { class: 'espaco' }),
      h('small', {}, formatarData(conf.criadoEm)),
      mestre && conf.estado === 'resolvido' ? botao('', () => acao('confronto.reabrir', { id: conf.id }), { class: 'pequeno', icone: 'refresh-cw', title: 'Repetir confronto' }) : null,
      mestre ? botao('', async () => { if (await confirmar(`Apagar o confronto "${conf.titulo}"?`)) await acao('confronto.remover', { id: conf.id }); }, { class: 'pequeno perigo', icone: 'trash-2', title: 'Apagar confronto' }) : null),
    h('div', { class: 'lados-confronto' }, ladoView(conf, 'a', mestre), h('div', { class: 'versus' }, 'vs'), ladoView(conf, 'b', mestre)),
    conf.resultado ? h('p', { class: `resultado-confronto ${conf.resultado.vencedor}` }, icone('flag'), ' ', conf.resultado.texto) : null);
}

export function confrontoView() {
  const c = estado.campanha;
  const mestre = c.papel === 'mestre';
  const lista = c.confrontos || [];
  const abertos = lista.filter(x => x.estado === 'aberto');
  const resolvidos = lista.filter(x => x.estado !== 'aberto');
  return h('div', { class: 'confrontos' },
    h('div', { class: 'barra' }, titulo('Confronto', 'scale', 'h2'), h('span', { class: 'selo' }, 'fora do combate')),
    h('p', { class: 'dica' }, 'Disputas de Ação × Ação: furtividade contra percepção, corridas, jogos, negociações. O resultado aparece para todos em tempo real; cada jogador rola o lado do próprio personagem.'),
    mestre ? formNovo() : null,
    titulo(`Em aberto (${abertos.length})`, 'hourglass'),
    abertos.length ? abertos.map(x => cartaoConfronto(x, mestre)) : vazio(mestre ? 'Crie um confronto acima.' : 'Nenhum confronto em aberto.', 'scale'),
    resolvidos.length ? titulo('Resolvidos recentemente', 'flag') : null,
    resolvidos.slice(0, 3).map(x => cartaoConfronto(x, mestre)),
    resolvidos.length > 3 ? h('details', { class: 'bloco', open: !!estado.sel.confResolvidos, ontoggle: e => { estado.sel.confResolvidos = e.target.open; } },
      h('summary', {}, icone('scroll'), ` Mais antigos (${resolvidos.length - 3})`),
      resolvidos.slice(3).map(x => cartaoConfronto(x, mestre))) : null);
}
