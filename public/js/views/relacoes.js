import { h, campo, selecao, botao, vazio, tabela, titulo, icone } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';

export const CORES = { Aliado: '#4caf50', 'Amigável': '#8bc34a', Neutro: '#9e9e9e', Rival: '#ff9800', Inimigo: '#e53935' };
const SVGNS = 'http://www.w3.org/2000/svg';

function s(tag, attrs, ...filhos) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...filhos);
  return el;
}

// Grafo circular: cada seta vai de quem enxerga para quem é enxergado, na cor da relação.
function grafo(personagens, relacoes, aoClicar, selecionado) {
  const n = personagens.length;
  const tam = 520;
  const raio = n > 1 ? tam / 2 - 60 : 0;
  const pos = Object.fromEntries(personagens.map((p, i) => {
    const ang = (2 * Math.PI * i) / n - Math.PI / 2;
    return [p.id, { x: tam / 2 + raio * Math.cos(ang), y: tam / 2 + raio * Math.sin(ang) }];
  }));
  const defs = s('defs', {}, ...Object.entries(CORES).map(([tipo, cor]) =>
    s('marker', { id: `seta-${tipo}`, viewBox: '0 0 10 10', refX: 22, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      s('path', { d: 'M0,0 L10,5 L0,10 z', fill: cor }))));
  const linhas = [];
  for (const [de, alvos] of Object.entries(relacoes)) {
    for (const [para, r] of Object.entries(alvos)) {
      if (!pos[de] || !pos[para] || !r.tipo) continue;
      const a = pos[de];
      const b = pos[para];
      // Curva leve para separar A→B de B→A.
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12;
      const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
      const esmaecida = selecionado && de !== selecionado && para !== selecionado;
      linhas.push(s('path', { d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`, fill: 'none', stroke: CORES[r.tipo], 'stroke-width': 2.5, opacity: esmaecida ? 0.12 : 0.9, 'marker-end': `url(#seta-${r.tipo})` },
        s('title', {}, `${personagemPorId(de)?.nome} vê ${personagemPorId(para)?.nome} como ${r.tipo}`)));
    }
  }
  const nos = personagens.map(p => {
    const { x, y } = pos[p.id];
    const g = s('g', { class: `no ${p.id === selecionado ? 'sel' : ''}`, transform: `translate(${x},${y})`, tabindex: 0 },
      s('circle', { r: 16, class: p.tipo }),
      s('text', { y: 32, 'text-anchor': 'middle' }, p.nome.length > 16 ? `${p.nome.slice(0, 15)}…` : p.nome));
    g.addEventListener('click', () => aoClicar(p.id));
    return g;
  });
  return s('svg', { viewBox: `0 0 ${tam} ${tam}`, class: 'grafo', role: 'img', 'aria-label': 'Mapa de relacionamentos' }, defs, ...linhas, ...nos);
}

function legenda() {
  return h('div', { class: 'legenda' }, Object.entries(CORES).map(([t, cor]) => h('span', {}, h('i', { style: { background: cor } }), t)));
}

function editorRelacoes(de, alvos) {
  const rel = estado.campanha.relacoes[de.id] || {};
  const tipos = estado.sistema.relacoes;
  const conhecidos = alvos.filter(p => rel[p.id]);
  const outros = alvos.filter(p => !rel[p.id]);
  return h('div', {},
    conhecidos.length ? tabela(['Personagem', `Como ${de.nome} o(a) vê`, 'Anotações', ''], conhecidos.map(p => [
      h('span', { class: 'item-nome' }, p.foto ? h('img', { class: 'mini-foto', src: p.foto, alt: '' }) : icone(p.tipo === 'npc' ? 'ghost' : 'user'), p.nome, h('small', {}, p.tipo === 'npc' ? ' (NPC)' : ' (PJ)')),
      selecao(tipos.map(t => ({ valor: t, rotulo: t })), rel[p.id].tipo, v => acao('relacao.definir', { de: de.id, para: p.id, tipo: v }),
        { style: { borderColor: CORES[rel[p.id].tipo], borderLeftWidth: '6px' }, 'aria-label': `Relação com ${p.nome}` }),
      campo(`rel:${de.id}:${p.id}`, rel[p.id].nota, v => acao('relacao.definir', { de: de.id, para: p.id, nota: v }), { multilinha: true, rows: 2, 'aria-label': `Anotações sobre ${p.nome}` }),
      botao('', () => acao('relacao.remover', { de: de.id, para: p.id }), { class: 'pequeno perigo', icone: 'trash-2', title: `Remover ${p.nome}` }),
    ]), 'relacoes-tabela') : vazio('Nenhuma relação registrada.', 'network'),
    outros.length ? selecao([{ valor: '', rotulo: '+ adicionar personagem conhecido' }, ...outros.map(p => ({ valor: p.id, rotulo: p.nome }))], '',
      v => v && acao('relacao.definir', { de: de.id, para: v, tipo: 'Neutro' })) : null);
}

// Mestre: mapa completo + edição de qualquer personagem.
export function mapaRelacoesView() {
  const c = estado.campanha;
  const todos = c.personagens.filter(p => p.grupoId !== 'encontros');
  const selId = estado.sel.relDe && personagemPorId(estado.sel.relDe) ? estado.sel.relDe : null;
  const sel = selId && personagemPorId(selId);
  return h('div', { class: 'relacoes' },
    h('div', {},
      legenda(),
      todos.length ? grafo(todos, c.relacoes, id => { estado.sel.relDe = id; render(); }, selId) : vazio('Crie personagens para montar o mapa.')),
    h('div', {},
      h('label', {}, 'Personagem', selecao([{ valor: '', rotulo: 'Escolha (ou clique no mapa)…' }, ...todos.map(p => ({ valor: p.id, rotulo: p.nome }))], selId || '', v => { estado.sel.relDe = v; render(); })),
      sel ? editorRelacoes(sel, todos.filter(p => p.id !== sel.id)) : h('p', { class: 'dica' }, 'Escolha um personagem para ver e editar como ele enxerga os outros.')));
}

// Jogador: como o próprio personagem enxerga os outros.
export function redesSociaisView(p) {
  const c = estado.campanha;
  const visiveis = c.personagens.filter(x => x.id !== p.id);
  const rel = c.relacoes[p.id] || {};
  const conhecidos = [p, ...visiveis.filter(x => rel[x.id])];
  return h('div', { class: 'relacoes' },
    h('div', {}, legenda(), grafo(conhecidos, { [p.id]: rel }, () => {}, p.id)),
    h('div', {}, titulo(`Redes sociais de ${p.nome}`, 'network', 'h2'), editorRelacoes(p, visiveis)));
}
