// Aba Mapa: a imagem, GIF ou vídeo escolhido pelo mestre, centralizado, com a grade de RPG por cima
// (cada quadrado = 1,5 m) e os peões dos personagens. O mestre escolhe o mapa e ajusta a grade;
// mestre e Suporte arrastam os peões; os jogadores só veem.
import { h, botao, selecao, aviso, icone, titulo, vazio, passador, pedirTexto, janela } from '../ui.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { derivados } from '/shared/regras.js';
import { restricaoMovimento } from '/shared/efeitos.js';
import { categoriaDaImagem } from '/shared/imagens.js';

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
const aspectos = new Map();
function midiaEl(m) {
  const chave = `${m.tipo}:${m.url}`;
  if (!midias.has(chave)) {
    const el = m.tipo === 'video'
      ? h('video', { src: m.url, class: 'mapa-midia', autoplay: true, loop: true, playsinline: true, 'aria-label': m.titulo })
      : h('img', { src: m.url, class: 'mapa-midia', alt: m.titulo, draggable: 'false' });
    if (m.tipo === 'video') { el.muted = true; el.play?.().catch(() => {}); }
    // Proporção da mídia: na tela inteira o mapa cabe inteiro (largura ou altura, o que bater primeiro).
    const proporcao = () => {
      const w = el.naturalWidth || el.videoWidth;
      const hh = el.naturalHeight || el.videoHeight;
      if (w && hh) {
        aspectos.set(chave, w / hh);
        el.closest('.mapa-quadro')?.style.setProperty('--aspecto', w / hh);
        el.closest('.mapa-rolagem')?.style.setProperty('--aspecto', w / hh);
      }
    };
    el.addEventListener(m.tipo === 'video' ? 'loadedmetadata' : 'load', proporcao);
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
  // Modos de clique no mapa: mestre põe objeto; jogador arma uma armadilha do inventário.
  const pondo = estado.sel.mapaObjeto;
  const armando = estado.sel.mapaArmar;
  const clicavel = mover || !!armando;
  const quadro = mapa.midia ? h('div', {
    class: `mapa-quadro ${g.visivel ? 'com-grade' : ''} ${clicavel ? 'movel' : ''}`,
    style: { '--cols': g.colunas, '--ox': g.ox, '--oy': g.oy, '--aspecto': aspectos.get(`${mapa.midia.tipo}:${mapa.midia.url}`) || 1.5 },
    // Com um peão escolhido, clicar num quadrado leva ele para lá.
    // No modo "marcar" (só o mestre), clicar num quadrado cria uma marcação secreta.
    onclick: clicavel ? async e => {
      if (e.target.closest('.peao, .marca-mapa, .objeto-mapa')) return;
      const { col, lin } = quadradoDoPonto(e.currentTarget, g, e.clientX, e.clientY);
      if (armando) {
        await acao('mapa.armar', { id: armando.id, uid: armando.uid, col, lin }).catch(err => aviso(err.message, 'erro'));
        estado.sel.mapaArmar = null; render();
        return;
      }
      if (mestre && pondo) {
        await acao('mapa.objeto', { col, lin, ...pondo }).catch(err => aviso(err.message, 'erro'));
        return;
      }
      if (estado.sel.mapaMoverObjeto) {
        await acao('mapa.objetoMover', { id: estado.sel.mapaMoverObjeto, col, lin }).catch(err => aviso(err.message, 'erro'));
        estado.sel.mapaMoverObjeto = null; render();
        return;
      }
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
    (mapa.objetos || []).map(o => objetoMapa(o, mestre)),
    pecas.map(x => peao(x, g, mover, sel))) : vazio(mestre ? 'Escolha o mapa abaixo (envie imagens, GIFs ou vídeos na aba Imagens).' : 'O mestre ainda não escolheu um mapa.', 'map');

  return h('div', { class: 'mapa-tela' },
    mestre ? controlesMestre(mapa) : null,
    h('div', { class: 'mapa-grade-tela' },
      // Girar: na tela inteira (deita o mapa quando o aparelho está em pé) e também na tela normal (autor, 24/10).
      h('div', { class: `mapa-centro ${estado.sel.mapaCheia ? 'tela-cheia' : ''} ${(estado.sel.mapaCheia ? girarMapa() : estado.sel.mapaGirarNormal) ? 'girar' : ''}` },
        mapa.midia ? h('div', { class: 'mapa-barra-cheia' },
          estado.sel.mapaCheia
            ? [botao('', () => { estado.sel.mapaGirar = !girarMapa(); render(); }, { class: 'pequeno', icone: 'rotate-cw', title: 'Girar o mapa', 'aria-label': 'Girar o mapa' }),
              botao('Sair', sairTelaCheia, { class: 'pequeno', icone: 'minimize-2', title: 'Sair da tela inteira' })]
            : [botao('Girar', () => { estado.sel.mapaGirarNormal = !estado.sel.mapaGirarNormal; render(); }, { class: `pequeno ${estado.sel.mapaGirarNormal ? 'primario' : ''}`, icone: 'rotate-cw', title: 'Girar o mapa 90°', 'aria-pressed': !!estado.sel.mapaGirarNormal }),
              botao('Tela inteira', entrarTelaCheia, { class: 'pequeno', icone: 'maximize-2', title: 'Mapa em tela inteira, na horizontal' })]) : null,
        h('div', { class: 'mapa-rolagem', style: mapa.midia ? { '--aspecto': aspectos.get(`${mapa.midia.tipo}:${mapa.midia.url}`) || 1.5 } : null }, quadro),
        mover && mapa.midia ? h('p', { class: 'dica' }, icone('info'), ' Arraste os peões, ou escolha um na lista e clique no quadrado de destino. Cada quadrado = 1,5 m.') : null,
        mestre && mapa.midia ? h('div', { class: 'barra' },
          botao(estado.sel.mapaMarcar ? 'Marcando: clique no mapa (clique aqui para parar)' : 'Marcação secreta', () => { estado.sel.mapaMarcar = !estado.sel.mapaMarcar; render(); },
            { class: `pequeno ${estado.sel.mapaMarcar ? 'primario' : ''}`, icone: 'eye-off', 'aria-pressed': !!estado.sel.mapaMarcar, title: 'Marcações (armadilhas, gatilhos…) que só você vê' }),
          (mapa.marcas || []).length ? h('small', { class: 'dica' }, `${mapa.marcas.length} marcação(ões) secreta(s) — os jogadores e o Suporte não veem.`) : null) : null,
        mestre && mapa.midia ? porObjeto() : null,
        !mestre && mapa.midia ? armarArmadilha() : null),
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

// Objetos no mapa (armadilhas, coberturas, objetos, perigos, baús, portas). Os ocultos só o mestre vê (meio apagados).
const ICONE_OBJETO = { armadilha: 'triangle-alert', objeto: 'box', cobertura: 'shield', perigo: 'flame', bau: 'package', porta: 'door-closed' };
const NOME_OBJETO = { armadilha: 'Armadilha', objeto: 'Objeto', cobertura: 'Cobertura', perigo: 'Perigo', bau: 'Baú', porta: 'Porta' };
function objetoMapa(o, mestre) {
  const dono = o.dono ? personagemPorId(o.dono) : null;
  const meu = dono && dono.donoId === estado.usuario?.id;
  return h('button', {
    type: 'button', class: `objeto-mapa obj-${o.tipo} ${o.oculto ? 'oculto' : ''}`, style: { '--col': o.col, '--lin': o.lin },
    title: `${NOME_OBJETO[o.tipo] || 'Objeto'}: ${o.nome}${dono ? ` (armada por ${dono.nome})` : ''}${o.oculto ? ' — oculto' : ''}`, 'aria-label': `${NOME_OBJETO[o.tipo] || 'Objeto'}: ${o.nome}`,
    onclick: e => {
      e.stopPropagation();
      const acoesJ = [];
      if (mestre) {
        acoesJ.push([o.oculto ? 'Mostrar aos jogadores' : 'Ocultar', () => acao('mapa.objetoMover', { id: o.id, oculto: !o.oculto })]);
        acoesJ.push(['Mover (clique no destino)', () => { estado.sel.mapaMoverObjeto = o.id; render(); }]);
      }
      if (meu && o.item) acoesJ.push(['Recolher para o inventário', () => acao('mapa.objetoRemover', { id: o.id, recolher: true })]);
      if (mestre || meu) acoesJ.push(['Tirar do mapa', () => acao('mapa.objetoRemover', { id: o.id }), 'perigo']);
      acoesJ.push(['Fechar', () => true]);
      janela(`${NOME_OBJETO[o.tipo] || 'Objeto'}: ${o.nome}`, h('div', {},
        o.item?.descricao ? h('p', {}, o.item.descricao) : null,
        dono ? h('p', { class: 'meta' }, `Armada por ${dono.nome}.`) : null,
        o.oculto ? h('p', { class: 'dica' }, icone('eye-off'), ' Oculto: os jogadores não veem.') : null), acoesJ);
    },
  }, icone(ICONE_OBJETO[o.tipo] || 'box'));
}

// Mestre: escolher o tipo e o nome do objeto e clicar nos quadrados para pôr.
function porObjeto() {
  const f = (estado.sel.novoObjeto ||= { tipo: 'armadilha', nome: '', oculto: false });
  const ativo = !!estado.sel.mapaObjeto;
  return h('div', { class: 'barra' },
    selecao(Object.entries(NOME_OBJETO).map(([valor, rotulo]) => ({ valor, rotulo })), f.tipo, v => { f.tipo = v; if (ativo) estado.sel.mapaObjeto = { ...f }; }, { 'aria-label': 'Tipo de objeto' }),
    h('input', { class: 'curto', value: f.nome, placeholder: 'Nome (ex.: fosso, barril)', 'aria-label': 'Nome do objeto', oninput: e => { f.nome = e.target.value; if (ativo) estado.sel.mapaObjeto = { ...f }; } }),
    h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: f.oculto, onchange: e => { f.oculto = e.target.checked; if (ativo) estado.sel.mapaObjeto = { ...f }; } }), 'oculto'),
    botao(ativo ? 'Pondo: clique no mapa (clique aqui para parar)' : 'Pôr objeto', () => { estado.sel.mapaObjeto = ativo ? null : { ...f }; estado.sel.mapaMarcar = false; render(); },
      { class: `pequeno ${ativo ? 'primario' : ''}`, icone: 'box', 'aria-pressed': ativo, title: 'Armadilhas, coberturas, objetos, perigos, baús e portas (visíveis ou ocultos)' }));
}

// Jogador: armar uma armadilha que tem pronta no inventário (ela sai do inventário e aparece no mapa).
function armarArmadilha() {
  const opcoes = meusPersonagens().flatMap(p => (p.itens || []).filter(i => /armadilh/i.test(`${i.categoria || ''} ${i.nome || ''}`)).map(i => ({ p, i })));
  if (!opcoes.length) return null;
  const armando = estado.sel.mapaArmar;
  const chave = 'mapaArmarEscolha';
  if (!opcoes.some(x => `${x.p.id}:${x.i.uid}` === estado.sel[chave])) estado.sel[chave] = `${opcoes[0].p.id}:${opcoes[0].i.uid}`;
  return h('div', { class: 'barra' },
    selecao(opcoes.map(x => ({ valor: `${x.p.id}:${x.i.uid}`, rotulo: `${x.i.nome}${x.i.quantidade > 1 ? ` (${x.i.quantidade})` : ''} — ${x.p.nome}` })), estado.sel[chave], v => { estado.sel[chave] = v; }, { 'aria-label': 'Armadilha do inventário' }),
    botao(armando ? 'Armando: clique no quadrado (clique aqui para cancelar)' : 'Armar armadilha', () => {
      if (armando) { estado.sel.mapaArmar = null; render(); return; }
      const [id, uid] = estado.sel[chave].split(':');
      estado.sel.mapaArmar = { id, uid };
      render();
    }, { class: `pequeno ${armando ? 'primario' : ''}`, icone: 'triangle-alert', title: 'A armadilha sai do seu inventário e aparece no mapa' }));
}

// Marcação secreta: um losango no quadrado; clicar mostra o texto e deixa apagar.
function marca(m) {
  return h('button', {
    type: 'button', class: 'marca-mapa', style: { '--col': m.col, '--lin': m.lin }, title: m.texto, 'aria-label': `Marcação secreta: ${m.texto}`,
    onclick: e => {
      e.stopPropagation();
      janela('Marcação secreta', h('p', {}, icone('eye-off'), ` ${m.texto}`),
        [['Apagar', () => acao('mapa.desmarcar', { id: m.id }), 'perigo'], ['Fechar', () => true]]);
    },
  }, icone('triangle-alert'));
}

// Tela inteira: ocupa a tela toda e tenta deitar o celular (horizontal). Onde o navegador não deixa travar a tela
// deitada (iPhone), o mapa é girado 90° quando o aparelho está em pé — o botão "Girar" troca à mão.
async function entrarTelaCheia() {
  estado.sel.mapaCheia = true;
  estado.sel.mapaGirar = null;
  render();
  try { await document.documentElement.requestFullscreen?.(); } catch { /* sem tela cheia do navegador: fica a da página */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* não deixou travar: gira pelo CSS se estiver em pé */ }
  render();
}
function sairTelaCheia() {
  estado.sel.mapaCheia = false;
  try { screen.orientation?.unlock?.(); } catch { /* nada */ }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  render();
}
const emPe = () => window.innerHeight > window.innerWidth;
const girarMapa = () => (estado.sel.mapaGirar ?? emPe());
// Saiu da tela cheia do navegador (Esc, voltar do celular): sai do modo do mapa também; girou o aparelho: redesenha.
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && estado.sel.mapaCheia) sairTelaCheia(); });
window.addEventListener('resize', () => { if (estado.sel.mapaCheia && estado.sel.mapaGirar == null) render(); });

// Ponto da tela → quadrado. Com o mapa girado 90° (horário), o x da tela vira o y do mapa e vice-versa.
function quadradoDoPonto(quadro, g, x, y) {
  const r = quadro.getBoundingClientRect();
  const girado = !!quadro.closest('.girar');
  const largura = girado ? r.height : r.width;
  const lx = girado ? y - r.top : x - r.left;
  const ly = girado ? r.right - x : y - r.top;
  const cel = largura / g.colunas;
  return {
    col: Math.max(0, Math.floor(lx / cel - g.ox)),
    lin: Math.max(0, Math.floor(ly / cel - g.oy)),
  };
}

function peao(x, g, mover, sel) {
  const { p } = x;
  const semPv = p.semPv || (p.pv && p.pv.atual <= 0);
  // Movimento limitado por efeito (ou carga, para quem vê os itens): círculo em volta do peão para lembrar.
  const d = p.itens && p.atributos ? derivados(p, estado.sistema) : null;
  const mov = restricaoMovimento(p, estado.sistema, d);
  const avisoMov = (mov.nivel ? ` — ${mov.nivel === 'preso' ? 'não pode se mover' : 'movimento limitado'}: ${mov.motivos.join(', ')}` : '')
    + (d ? ` · deslocamento ${String(d.deslocamento).replace('.', ',')} m (${d.deslocamentoQuadrados} quadrados)` : '');
  // Quem só vê (jogadores) recebe uma figura, não um botão.
  const el = h(mover ? 'button' : 'span', {
    type: mover ? 'button' : null, role: mover ? null : 'img', class: `peao ${p.tipo} ${sel === p.id ? 'escolhido' : ''} ${semPv ? 'sem-pv' : ''} ${x.oculto ? 'oculto' : ''} ${mov.nivel ? `mov-${mov.nivel}` : ''}`,
    'data-pid': p.id, style: { '--col': x.col, '--lin': x.lin }, title: `${p.nome}${x.oculto ? ' (invisível para os jogadores)' : ''}${avisoMov}`, 'aria-label': `${p.nome} (coluna ${x.col + 1}, linha ${x.lin + 1})${avisoMov}`,
    onclick: mover ? e => {
      e.stopPropagation();
      if (e.currentTarget.dataset.arrastou) { delete e.currentTarget.dataset.arrastou; return; }
      estado.sel.mapaSel = sel === p.id ? null : p.id;
      render();
    } : null,
  }, mov.nivel ? h('span', { class: 'peao-restricao', 'aria-hidden': 'true' }, h('span', { class: 'cadeado' }, icone(mov.nivel === 'preso' ? 'lock' : 'footprints'))) : null,
    h('span', { class: 'rosto' }, p.foto ? h('img', { src: p.foto, alt: '', draggable: 'false' }) : p.nome.slice(0, 1)),
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
    // Mapa girado: o arrasto da tela vira o deslocamento no mapa (x da tela = y do mapa).
    el.style.transform = el.closest('.girar') ? `translate(${dy}px, ${-dx}px)` : `translate(${dx}px, ${dy}px)`;
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
      selecao([{ valor: '', rotulo: midias.length ? 'Escolha o mapa…' : 'Envie imagens na aba Imagens' },
        // As da divisão "Mapas" primeiro; as outras aparecem com a divisão entre colchetes.
        ...[...midias].sort((a, b) => (categoriaDaImagem(b) === 'Mapas') - (categoriaDaImagem(a) === 'Mapas'))
          .map(i => ({ valor: i.id, rotulo: `${categoriaDaImagem(i) === 'Mapas' ? '' : `[${categoriaDaImagem(i)}] `}${i.titulo}${i.tipo === 'video' ? ' (vídeo)' : ''}` }))],
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
