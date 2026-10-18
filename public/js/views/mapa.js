// Aba Mapa: a imagem, GIF ou vídeo escolhido pelo mestre, centralizado, com a grade de RPG por cima
// (cada quadrado = 1,5 m) e os peões dos personagens. O mestre escolhe o mapa e ajusta a grade;
// mestre e Suporte arrastam os peões; os jogadores só veem.
import { h, botao, selecao, aviso, icone, titulo, vazio, passador, pedirTexto, janela } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';

export const METROS_POR_QUADRADO = 1.5;

// Distância entre dois personagens no mapa, em metros (diagonal conta como um passo), ou null se algum não estiver nele.
export function distanciaNoMapa(c, idA, idB) {
  const a = c.mapa?.pecas?.[idA];
  const b = c.mapa?.pecas?.[idB];
  if (!a || !b) return null;
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.lin - b.lin)) * METROS_POR_QUADRADO;
}

// O mesmo elemento de mídia é reaproveitado entre as atualizações, para o vídeo não recomeçar a cada mudança.
const midias = new Map();
function midiaEl(m) {
  const chave = `${m.tipo}:${m.url}`;
  if (!midias.has(chave)) {
    const el = m.tipo === 'video'
      ? h('video', { src: m.url, class: 'mapa-midia', autoplay: true, loop: true, playsinline: true, 'aria-label': m.titulo })
      : h('img', { src: m.url, class: 'mapa-midia', alt: m.titulo, draggable: 'false' });
    if (m.tipo === 'video') { el.muted = true; el.play?.().catch(() => {}); }
    midias.set(chave, el);
  }
  return midias.get(chave);
}

export function mapaView() {
  const c = estado.campanha;
  const mestre = c.papel === 'mestre';
  const mover = mestre || c.papel === 'suporte';
  const mapa = c.mapa || { grade: { colunas: 20, ox: 0, oy: 0, visivel: true }, pecas: {} };
  const g = mapa.grade;
  const pecas = Object.entries(mapa.pecas || {}).map(([id, pos]) => ({ p: personagemPorId(id), ...pos })).filter(x => x.p);
  const sel = estado.sel.mapaSel;
  const quadro = mapa.midia ? h('div', {
    class: `mapa-quadro ${g.visivel ? 'com-grade' : ''} ${mover ? 'movel' : ''}`,
    style: { '--cols': g.colunas, '--ox': g.ox, '--oy': g.oy },
    // Com um peão escolhido, clicar num quadrado leva ele para lá.
    // No modo "marcar" (só o mestre), clicar num quadrado cria uma marcação secreta.
    onclick: mover ? async e => {
      if (e.target.closest('.peao, .marca')) return;
      const { col, lin } = quadradoDoPonto(e.currentTarget, g, e.clientX, e.clientY);
      if (mestre && estado.sel.mapaMarcar) {
        const texto = await pedirTexto('Marcação secreta', 'O que tem aqui? (só você vê — ex.: Armadilha: fosso, ND 70)');
        if (texto) acao('mapa.marcar', { col, lin, texto }).catch(err => aviso(err.message, 'erro'));
        return;
      }
      if (!estado.sel.mapaSel) return;
      acao('mapa.mover', { id: estado.sel.mapaSel, col, lin }).catch(err => aviso(err.message, 'erro'));
    } : null,
  },
    midiaEl(mapa.midia),
    h('div', { class: 'mapa-grade', 'aria-hidden': 'true' }),
    mestre ? (mapa.marcas || []).map(marca) : null,
    pecas.map(x => peao(x, g, mover, sel))) : vazio(mestre ? 'Escolha o mapa abaixo (envie imagens, GIFs ou vídeos na aba Imagens).' : 'O mestre ainda não escolheu um mapa.', 'map');

  return h('div', { class: 'mapa-tela' },
    mestre ? controlesMestre(mapa) : null,
    h('div', { class: 'mapa-grade-tela' },
      h('div', { class: 'mapa-centro' }, h('div', { class: 'mapa-rolagem' }, quadro),
        mover && mapa.midia ? h('p', { class: 'dica' }, icone('info'), ' Arraste os peões, ou escolha um na lista e clique no quadrado de destino. Cada quadrado = 1,5 m.') : null,
        mestre && mapa.midia ? h('div', { class: 'barra' },
          botao(estado.sel.mapaMarcar ? 'Marcando: clique no mapa (clique aqui para parar)' : 'Marcação secreta', () => { estado.sel.mapaMarcar = !estado.sel.mapaMarcar; render(); },
            { class: `pequeno ${estado.sel.mapaMarcar ? 'primario' : ''}`, icone: 'eye-off', 'aria-pressed': !!estado.sel.mapaMarcar, title: 'Marcações (armadilhas, gatilhos…) que só você vê' }),
          (mapa.marcas || []).length ? h('small', { class: 'dica' }, `${mapa.marcas.length} marcação(ões) secreta(s) — os jogadores e o Suporte não veem.`) : null) : null),
      h('aside', { class: 'bloco mapa-lado' },
        titulo('No mapa', 'users', 'h3'),
        pecas.length ? h('ul', { class: 'mapa-lista' }, pecas.map(x => h('li', { class: sel === x.p.id ? 'escolhido' : '' },
          h('button', { type: 'button', class: 'link', disabled: !mover, 'aria-pressed': sel === x.p.id, title: mover ? `Escolher ${x.p.nome} para mover` : x.p.nome,
            onclick: () => { estado.sel.mapaSel = sel === x.p.id ? null : x.p.id; render(); } },
            h('span', { class: `rosto-mini ${x.p.tipo} ${x.p.semPv || (x.p.pv && x.p.pv.atual <= 0) ? 'sem-pv' : ''}` }, x.p.foto ? h('img', { src: x.p.foto, alt: '' }) : x.p.nome.slice(0, 1)),
            h('span', {}, x.p.nome)),
          mestre && x.p.tipo !== 'pj' ? botao('', () => acao('mapa.ocultar', { id: x.p.id, oculto: !x.oculto }), { class: `pequeno ${x.oculto ? 'primario' : ''}`, icone: x.oculto ? 'eye-off' : 'eye',
            'aria-pressed': !!x.oculto, title: x.oculto ? `${x.p.nome} está invisível para os jogadores (fantasma). Clique para mostrar` : `Deixar ${x.p.nome} invisível para os jogadores (fantasma)` }) : null,
          mover ? botao('', () => acao('mapa.tirar', { id: x.p.id }), { class: 'x', icone: 'x', title: `Tirar ${x.p.nome} do mapa` }) : null)))
          : vazio('Ninguém no mapa.', 'users'),
        mestre ? colocarNoMapa(mapa) : null)));
}

// Marcação secreta: um losango no quadrado; clicar mostra o texto e deixa apagar.
function marca(m) {
  return h('button', {
    type: 'button', class: 'marca', style: { '--col': m.col, '--lin': m.lin }, title: m.texto, 'aria-label': `Marcação secreta: ${m.texto}`,
    onclick: e => {
      e.stopPropagation();
      janela('Marcação secreta', h('p', {}, icone('eye-off'), ` ${m.texto}`),
        [['Apagar', () => acao('mapa.desmarcar', { id: m.id }), 'perigo'], ['Fechar', () => true]]);
    },
  }, icone('triangle-alert'));
}

function quadradoDoPonto(quadro, g, x, y) {
  const r = quadro.getBoundingClientRect();
  const cel = r.width / g.colunas;
  return {
    col: Math.max(0, Math.floor((x - r.left) / cel - g.ox)),
    lin: Math.max(0, Math.floor((y - r.top) / cel - g.oy)),
  };
}

function peao(x, g, mover, sel) {
  const { p } = x;
  const semPv = p.semPv || (p.pv && p.pv.atual <= 0);
  // Quem só vê (jogadores) recebe uma figura, não um botão.
  const el = h(mover ? 'button' : 'span', {
    type: mover ? 'button' : null, role: mover ? null : 'img', class: `peao ${p.tipo} ${sel === p.id ? 'escolhido' : ''} ${semPv ? 'sem-pv' : ''} ${x.oculto ? 'oculto' : ''}`,
    style: { '--col': x.col, '--lin': x.lin }, title: x.oculto ? `${p.nome} (invisível para os jogadores)` : p.nome, 'aria-label': `${p.nome} (coluna ${x.col + 1}, linha ${x.lin + 1})`,
    onclick: mover ? e => {
      e.stopPropagation();
      if (e.currentTarget.dataset.arrastou) { delete e.currentTarget.dataset.arrastou; return; }
      estado.sel.mapaSel = sel === p.id ? null : p.id;
      render();
    } : null,
  }, h('span', { class: 'rosto' }, p.foto ? h('img', { src: p.foto, alt: '', draggable: 'false' }) : p.nome.slice(0, 1)),
    h('small', { class: 'peao-nome' }, p.nome));
  if (mover) arrastavel(el, p, g);
  return el;
}

// Arrastar com o dedo ou o mouse: o peão segue o ponteiro e, ao soltar, vai para o quadrado embaixo dele.
function arrastavel(el, p, g) {
  let inicio = null;
  el.addEventListener('pointerdown', e => {
    inicio = { x: e.clientX, y: e.clientY, moveu: false };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (!inicio.moveu && Math.hypot(dx, dy) < 6) return;
    inicio.moveu = true;
    el.classList.add('arrastando');
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const soltar = e => {
    if (!inicio) return;
    const moveu = inicio.moveu;
    inicio = null;
    el.classList.remove('arrastando');
    if (!moveu) return;
    el.style.transform = '';
    const quadro = el.closest('.mapa-quadro');
    const { col, lin } = quadradoDoPonto(quadro, g, e.clientX, e.clientY);
    el.dataset.arrastou = '1';
    acao('mapa.mover', { id: p.id, col, lin }).catch(err => aviso(err.message, 'erro'));
  };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', () => { inicio = null; el.style.transform = ''; el.classList.remove('arrastando'); });
}

// Mestre: escolhe o mapa e ajusta a grade (quadrados na largura e o deslocamento para alinhar com o desenho).
function controlesMestre(mapa) {
  const c = estado.campanha;
  const g = mapa.grade;
  const midias = c.imagens || [];
  const desloc = (chave, rotulo) => h('label', { class: 'linha' }, rotulo,
    h('input', { type: 'range', min: 0, max: 0.95, step: 0.05, value: g[chave], 'aria-label': rotulo, onchange: e => acao('mapa.grade', { [chave]: e.target.value }) }));
  return h('div', { class: 'bloco mapa-controles' },
    titulo('Mapa e grade', 'map', 'h3'),
    h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: midias.length ? 'Escolha o mapa…' : 'Envie imagens na aba Imagens' }, ...midias.map(i => ({ valor: i.id, rotulo: `${i.titulo}${i.tipo === 'video' ? ' (vídeo)' : ''}` }))],
        mapa.imagemId || '', v => acao('mapa.definir', { imagemId: v || null }), { 'aria-label': 'Mapa' }),
      h('span', { class: 'linha' }, 'Quadrados na largura', passador(g.colunas, 2, 200, v => acao('mapa.grade', { colunas: v }), 'Quadrados na largura')),
      desloc('ox', 'Mover grade →'),
      desloc('oy', 'Mover grade ↓'),
      h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: g.visivel, onchange: e => acao('mapa.grade', { visivel: e.target.checked }) }), 'Mostrar a grade'),
      Object.keys(mapa.pecas || {}).length ? botao('Tirar todos', () => acao('mapa.limpar'), { class: 'pequeno perigo', icone: 'trash-2' }) : null),
    h('p', { class: 'dica' }, 'Mais quadrados na largura = quadrados menores. Ajuste até a grade bater com o desenho do mapa (1 quadrado = 1,5 m).'));
}

// Mestre: põe personagens no mapa (um a um ou todos do Campo de Batalha), no primeiro quadrado livre.
function colocarNoMapa(mapa) {
  const c = estado.campanha;
  const fora = c.personagens.filter(p => !mapa.pecas?.[p.id]);
  const ocupado = new Set(Object.values(mapa.pecas || {}).map(x => `${x.col}:${x.lin}`));
  const livre = () => {
    for (let lin = 0; ; lin++) for (let col = 0; col < mapa.grade.colunas; col++) {
      if (!ocupado.has(`${col}:${lin}`)) { ocupado.add(`${col}:${lin}`); return { col, lin }; }
    }
  };
  const por = id => acao('mapa.mover', { id, ...livre() });
  const doCampo = c.salas.batalha.participantes.filter(id => !mapa.pecas?.[id]);
  return h('div', { class: 'mapa-colocar' },
    fora.length ? selecao([{ valor: '', rotulo: '+ pôr no mapa…' }, ...fora.map(p => ({ valor: p.id, rotulo: `${p.nome}${p.tipo === 'npc' ? ' (NPC)' : ''}` }))], '',
      v => v && por(v).catch(e => aviso(e.message, 'erro')), { 'aria-label': 'Pôr personagem no mapa' }) : null,
    doCampo.length ? botao(`Pôr os ${doCampo.length} do Campo de Batalha`, async () => { for (const id of doCampo) await por(id); }, { class: 'pequeno', icone: 'swords' }) : null);
}
