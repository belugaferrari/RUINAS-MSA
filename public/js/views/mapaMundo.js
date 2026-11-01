// Mapas ligados e fog (autor, 01/11): os vizinhos colados nas bordas do mapa ativo (arraste o mapa para ver), as
// passagens que levam a outro mapa, a fog absoluta (o que nenhum PJ viu fica preto) e a fog pessoal (o cone de visão
// de cada personagem; o resto do que já foi visto fica escurecido). O mestre vê tudo, com a fog meio transparente.
import { h, botao, selecao, aviso, icone, janela, pedirTexto } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { DIRECOES, LADOS, linhasDoMapa, colunasDoMapa } from '/shared/visao.js';
import { ladoNoMapa } from '/shared/monstros.js';
import { tipoObjeto, regrasObjeto, tamanhoObjeto } from '/shared/objetosMapa.js';
import { EFEITOS_CLIMA, sugestaoDoClima } from './climaMapa.js';

const NOME_LADO = { norte: 'Norte', sul: 'Sul', leste: 'Leste', oeste: 'Oeste' };

// ---------- Fog ----------
// Uma tela (canvas) de 1 pixel por quadrado, esticada sobre a grade (com uma borda de 1 quadrado). Preto = nunca visto;
// escurecido = já visto (lembra), mas fora da visão agora; limpo = à vista.
export function camadaFog(m, mestre) {
  const f = m.fog;
  if (!f || (!f.absoluta && !f.pessoal)) return null;
  const cols = colunasDoMapa(m), lins = linhasDoMapa(m);
  const tela = h('canvas', { class: `mapa-fog ${mestre ? 'do-mestre' : ''}`, width: cols + 2, height: lins + 2, 'aria-hidden': 'true',
    style: { '--fc': cols + 2, '--fl': lins + 2 } });
  const ctx = tela.getContext('2d');
  if (!ctx) return tela;
  const visto = new Set(f.explorado || []);
  const agora = new Set(f.visivel || []);
  const escuro = mestre ? 0.55 : 1;
  const lembra = mestre ? 0.25 : 0.62;
  for (let i = -1; i <= cols; i++) {
    for (let j = -1; j <= lins; j++) {
      const k = `${Math.max(0, Math.min(cols - 1, i))}:${Math.max(0, Math.min(lins - 1, j))}`;
      let a = 0;
      if (f.pessoal && !agora.has(k)) a = lembra;
      if (f.absoluta && !visto.has(k) && !agora.has(k)) a = escuro;
      if (!a) continue;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(i + 1, j + 1, 1, 1);
    }
  }
  return tela;
}

// ---------- Vizinhos ----------
// Cada vizinho é desenhado ao lado do ativo, na mesma escala (o mesmo tamanho de quadrado), com os peões, objetos,
// passagens e a fog dele. Os peões dele também se arrastam (o servidor recebe as coordenadas do mundo).
export function vizinhosEls(mapa, mestre, desenharPeao) {
  return (mapa.vizinhosLista || []).map(v => {
    const g = v.grade || {};
    return h('div', {
      class: `mapa-vizinho ${g.visivel !== false && mapa.grade.visivel ? 'com-grade' : ''}`, 'data-lado': v.lado,
      style: { '--dc': v.dc, '--dl': v.dl, '--vox': g.ox || 0, '--voy': g.oy || 0, '--vcols': colunasDoMapa(v), '--vlins': linhasDoMapa(v) },
      title: `${v.nome} (${NOME_LADO[v.lado]})`,
    },
      v.midia ? (v.midia.tipo === 'video'
        ? h('video', { src: v.midia.url, class: 'mapa-midia', autoplay: true, loop: true, muted: true, playsinline: true })
        : h('img', { src: v.midia.url, class: 'mapa-midia', alt: v.midia.titulo || v.nome, draggable: 'false' })) : h('div', { class: 'mapa-vizinho-vazio' }, v.nome),
      h('div', { class: 'mapa-grade', 'aria-hidden': 'true' }),
      (v.objetos || []).map(o => objetoEstatico(o, mestre)),
      (v.passagens || []).map(ps => passagemEl(ps, mestre, v)),
      camadaFog(v, mestre),
      Object.entries(v.pecas || {}).map(([id, pos]) => ({ p: personagemPorId(id), ...pos, dc: v.dc, dl: v.dl })).filter(x => x.p).map(desenharPeao),
      h('span', { class: 'mapa-vizinho-nome' }, `${v.nome}`));
  });
}
function objetoEstatico(o, mestre) {
  const r = regrasObjeto(o);
  const { l, a } = tamanhoObjeto(o);
  return h('span', { class: `objeto-mapa estatico obj-${o.tipo} ${o.oculto ? 'oculto' : ''}`, style: { '--col': o.col, '--lin': o.lin, '--l': l, '--a': a }, title: `${r.nome}${o.nome && o.nome !== r.nome ? `: ${o.nome}` : ''}`, 'aria-hidden': mestre ? null : 'true' },
    icone(tipoObjeto(o.tipo).icone || 'box'));
}

// ---------- Passagens ----------
export function passagemEl(ps, mestre, vizinho = null) {
  return h('button', {
    type: 'button', class: `passagem-mapa ${ps.oculta ? 'oculta' : ''}`, style: { '--col': ps.col, '--lin': ps.lin },
    title: `${ps.nome} → ${ps.paraNome}`, 'aria-label': `Passagem: ${ps.nome}, leva a ${ps.paraNome}`,
    onclick: e => {
      if (estado.sel.areaAtaque) return;
      e.stopPropagation();
      const sel = estado.sel.mapaSel ? personagemPorId(estado.sel.mapaSel) : null;
      const acoes = [];
      if (mestre && !vizinho && sel) acoes.push([`Levar ${sel.nome}`, () => acao('mapa.atravessar', { id: sel.id, passagem: ps.id }).then(r => aviso(r.texto))]);
      if (mestre) acoes.push([`Abrir ${ps.paraNome}`, () => acao('mapa.abrir', { id: ps.para })]);
      if (mestre && !vizinho) acoes.push(['Remover passagem', () => acao('mapa.passagemRemover', { id: ps.id }), 'perigo']);
      acoes.push(['Fechar', () => true]);
      janela(ps.nome, h('div', {},
        h('p', {}, icone('door-open'), ` Leva a ${ps.paraNome}${ps.destino ? ` (chega na coluna ${ps.destino.col + 1}, linha ${ps.destino.lin + 1})` : ''}.`),
        h('p', { class: 'dica' }, 'Um peão que para neste quadrado atravessa sozinho.'),
        mestre && !vizinho && !sel ? h('p', { class: 'dica' }, 'Para levar alguém daqui, escolha o peão na lista "No mapa" e abra a passagem de novo.') : null), acoes);
    },
  }, icone('door-open'));
}

// ---------- Direção do olhar ----------
export function setaOlhar(x) {
  if (x.olhar == null) return null;
  return h('span', { class: 'peao-olhar', style: { '--olhar': `${x.olhar}deg` }, 'aria-hidden': 'true' });
}
// Rosa dos ventos: escolher para onde o personagem olha. Resolve true (escolheu), false (manteve) ou null (cancelou).
export function escolherOlhar(id, { titulo = null, manter = true } = {}) {
  const p = personagemPorId(id);
  const atual = acharPeca(id)?.olhar;
  return new Promise(ok => {
    let fechar = null;
    const rosa = h('div', { class: 'rosa-olhar' }, [315, 0, 45, 270, null, 90, 225, 180, 135].map(g => (g == null
      ? h('span', { class: 'rosa-centro' }, p?.nome?.slice(0, 1) || '?')
      : h('button', { type: 'button', class: `rosa-dir ${atual === g ? 'ativa' : ''}`, title: DIRECOES.find(d => d.g === g).nome,
        onclick: async () => { try { await acao('mapa.olhar', { id, direcao: g }); fechar?.(); ok(true); } catch (e) { aviso(e.message, 'erro'); } } },
        DIRECOES.find(d => d.g === g).seta))));
    fechar = janela(titulo || `Para onde ${p?.nome || 'o personagem'} está olhando?`, h('div', {},
      rosa, h('p', { class: 'dica' }, 'A fog pessoal mostra o que ele vê nessa direção (cone de visão); o resto do que já viu fica escurecido.')),
    [...(manter ? [[atual != null ? `Manter (${DIRECOES.find(d => d.g === atual)?.nome})` : 'Pular', () => ok(false)]] : []), ['Cancelar', () => ok(null)]]);
  });
}
// Onde está o peão (no ativo ou num vizinho).
export function acharPeca(id) {
  const m = estado.campanha?.mapa;
  if (!m) return null;
  if (m.pecas?.[id]) return m.pecas[id];
  for (const v of m.vizinhosLista || []) if (v.pecas?.[id]) return v.pecas[id];
  return null;
}

// ---------- Arrastar a vista (para ver os vizinhos) ----------
// Arrastar o fundo do mapa (fora dos peões) desloca a vista; as setas nas bordas levam até o vizinho.
export function panDoMapa(mapa) {
  const pan = (estado.sel.mapaPan ||= {});
  if (pan.id !== mapa.id) Object.assign(pan, { id: mapa.id, x: 0, y: 0 });
  return pan;
}
export function ligarPan(rolagem, mapa) {
  if (!(mapa.vizinhosLista || []).length && !mapa.continental) return;
  const pan = panDoMapa(mapa);
  const quadro = rolagem.querySelector('.mapa-quadro');
  let ini = null;
  rolagem.addEventListener('pointerdown', e => {
    if (e.target.closest('.peao, .objeto-mapa:not(.estatico), .passagem-mapa, .marca-mapa, button') || estado.sel.areaAtaque || estado.sel.mapaObjeto || estado.sel.mapaFogPincel) return;
    ini = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moveu: false };
  });
  rolagem.addEventListener('pointermove', e => {
    if (!ini) return;
    const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
    if (!ini.moveu && Math.hypot(dx, dy) < 8) return;
    if (!ini.moveu) { ini.moveu = true; try { rolagem.setPointerCapture(e.pointerId); } catch { /* ok */ } }
    pan.x = ini.px + dx; pan.y = ini.py + dy;
    quadro.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
  });
  const fim = () => {
    const moveu = ini?.moveu;
    ini = null;
    if (moveu) { quadro.dataset.panou = '1'; setTimeout(() => { delete quadro.dataset.panou; render(); }, 50); }
  };
  rolagem.addEventListener('pointerup', fim);
  rolagem.addEventListener('pointercancel', fim);
}
// Setas nas bordas com o nome do vizinho: levam a vista até ele (e o "centro" volta ao mapa ativo).
export function setasVizinhos(mapa) {
  const lista = mapa.vizinhosLista || [];
  if (!lista.length) return null;
  const pan = panDoMapa(mapa);
  const ir = lado => {
    const q = document.querySelector('.mapa-quadro');
    const w = q?.offsetWidth || 800, hh = q?.offsetHeight || 500;
    const passo = { leste: [-w * 0.7, 0], oeste: [w * 0.7, 0], norte: [0, hh * 0.7], sul: [0, -hh * 0.7] }[lado];
    pan.x += passo[0]; pan.y += passo[1];
    render();
  };
  return h('div', { class: 'setas-vizinhos' },
    lista.map(v => botao(`${{ norte: '↑', sul: '↓', leste: '→', oeste: '←' }[v.lado]} ${v.nome}`, () => ir(v.lado), { class: `pequeno seta-${v.lado}`, title: `Ver ${v.nome} (${NOME_LADO[v.lado]})` })),
    pan.x || pan.y ? botao('Centralizar', () => { pan.x = 0; pan.y = 0; render(); }, { class: 'pequeno', icone: 'crosshair' }) : null);
}

// ---------- Controles do mestre ----------
export function controlesMundo(mapa) {
  const lista = mapa.mapas || [];
  const outros = lista.filter(m => !m.ativo);
  const f = mapa.fog || {};
  const pincel = estado.sel.mapaFogPincel;
  const pondoPassagem = estado.sel.mapaPassagem;
  const destino = (estado.sel.novaPassagem ||= { para: '', nome: '', destCol: 0, destLin: 0 });
  if (destino.para && !outros.some(m => m.id === destino.para)) destino.para = '';
  return h('div', { class: 'bloco mapa-mundo-controles' },
    h('div', { class: 'barra' },
      h('strong', {}, icone('map'), ` ${mapa.nome || 'Mapa'}`),
      botao('Renomear', async () => { const n = await pedirTexto('Nome do mapa', 'Nome', mapa.nome || ''); if (n) acao('mapa.renomear', { nome: n }); }, { class: 'pequeno', icone: 'pencil' }),
      selecao([{ valor: '', rotulo: outros.length ? `Abrir outro mapa (${outros.length})…` : 'Nenhum outro mapa' }, ...outros.map(m => ({ valor: m.id, rotulo: `${m.nome}${m.pecas ? ` · ${m.pecas} peão(ões)` : ''}` }))], '',
        v => v && acao('mapa.abrir', { id: v }), { 'aria-label': 'Abrir outro mapa' }),
      botao('Novo mapa', async () => { const n = await pedirTexto('Novo mapa', 'Nome do mapa (a imagem você escolhe depois de abrir)'); if (n) acao('mapa.criar', { nome: n }).then(() => aviso(`Mapa "${n}" criado. Abra-o na lista para escolher a imagem.`)); }, { class: 'pequeno', icone: 'plus' }),
      outros.length ? selecao([{ valor: '', rotulo: 'Apagar mapa…' }, ...outros.map(m => ({ valor: m.id, rotulo: m.nome }))], '', v => v && acao('mapa.apagar', { id: v }), { 'aria-label': 'Apagar mapa' }) : null,
      botao('Criar mapas de teste (5 + mundo)', () => acao('mapa.exemplos').then(r => aviso(`Criados: ${r.mapas.join(', ')}.`)), { class: 'pequeno', icone: 'sparkles', title: 'Vila no meio; Floresta a oeste, Praia a leste, Ruínas ao norte; Caverna pela escada das Ruínas. Com fog ligada.' })),
    h('div', { class: 'barra' },
      h('small', {}, 'Vizinhos (continuam pela borda):'),
      LADOS.map(lado => h('label', { class: 'linha' }, NOME_LADO[lado],
        selecao([{ valor: '', rotulo: '—' }, ...outros.map(m => ({ valor: m.id, rotulo: m.nome }))], mapa.vizinhos?.[lado] || '',
          v => acao('mapa.vizinho', { lado, id: v || null }), { 'aria-label': `Vizinho ao ${NOME_LADO[lado]}` })))),
    h('div', { class: 'barra' },
      h('small', {}, 'Passagem:'),
      selecao([{ valor: '', rotulo: 'para o mapa…' }, ...outros.map(m => ({ valor: m.id, rotulo: m.nome }))], destino.para, v => { destino.para = v; render(); }, { 'aria-label': 'Mapa de destino da passagem' }),
      h('input', { class: 'curto', placeholder: 'nome (porta, escada…)', value: destino.nome, oninput: e => { destino.nome = e.target.value; }, 'aria-label': 'Nome da passagem' }),
      h('label', { class: 'linha', title: 'Quadrado de chegada no mapa de destino (coluna e linha, contando de 1)' }, 'chega em',
        h('input', { type: 'number', class: 'curto', min: 1, value: destino.destCol + 1, 'aria-label': 'Coluna de chegada', onchange: e => { destino.destCol = Math.max(0, (parseInt(e.target.value, 10) || 1) - 1); } }), '×',
        h('input', { type: 'number', class: 'curto', min: 1, value: destino.destLin + 1, 'aria-label': 'Linha de chegada', onchange: e => { destino.destLin = Math.max(0, (parseInt(e.target.value, 10) || 1) - 1); } })),
      botao(pondoPassagem ? 'Clique no quadrado da passagem (clique aqui para parar)' : 'Pôr passagem', () => { estado.sel.mapaPassagem = pondoPassagem ? null : { ...destino }; estado.sel.mapaObjeto = null; estado.sel.mapaFogPincel = null; render(); },
        { class: `pequeno ${pondoPassagem ? 'primario' : ''}`, icone: 'door-open', disabled: !destino.para && !pondoPassagem })),
    h('div', { class: 'barra' },
      h('label', { class: 'linha', title: 'Mapa grande, sem combate: fog inicial que se abre em volta dos PJs, pins dos jogadores; todos abrem pelo botão "Mapa do mundo"' },
        h('input', { type: 'checkbox', checked: !!mapa.continental, onchange: e => acao('mapa.continental', { continental: e.target.checked }) }), 'Mapa continental (mapa do mundo)'),
      h('label', { class: 'linha', title: 'O que nenhum personagem jogador viu fica preto para os jogadores' }, h('input', { type: 'checkbox', checked: !!f.absoluta, onchange: e => acao('mapa.fog', { absoluta: e.target.checked }) }), 'Fog absoluta'),
      h('label', { class: 'linha', title: 'Cada personagem vê um cone (90°) para onde olha; o resto do que já viu fica escurecido' }, h('input', { type: 'checkbox', checked: !!f.pessoal, onchange: e => acao('mapa.fog', { pessoal: e.target.checked }) }), 'Fog pessoal'),
      h('label', { class: 'linha', title: 'Até onde a vista alcança (em quadrados de 1,5 m)' }, 'Alcance',
        h('input', { type: 'number', class: 'curto', min: 1, max: 100, value: f.alcance || 16, onchange: e => acao('mapa.fog', { alcance: e.target.value }) }), 'quadrados'),
      f.absoluta ? [
        botao(pincel === 'revelar' ? 'Revelando: arraste no mapa (parar)' : 'Revelar (pincel)', () => { estado.sel.mapaFogPincel = pincel === 'revelar' ? null : 'revelar'; estado.sel.mapaObjeto = null; render(); }, { class: `pequeno ${pincel === 'revelar' ? 'primario' : ''}`, icone: 'eye' }),
        botao(pincel === 'cobrir' ? 'Cobrindo: arraste no mapa (parar)' : 'Cobrir (pincel)', () => { estado.sel.mapaFogPincel = pincel === 'cobrir' ? null : 'cobrir'; estado.sel.mapaObjeto = null; render(); }, { class: `pequeno ${pincel === 'cobrir' ? 'primario' : ''}`, icone: 'eye-off' }),
        botao('Revelar tudo', () => acao('mapa.revelar', { tudo: true }), { class: 'pequeno' }),
        botao('Cobrir tudo', () => acao('mapa.revelar', { tudo: true, revelar: false }), { class: 'pequeno perigo' })] : null),
    climaDoMapa(mapa),
    h('p', { class: 'dica' }, 'Arraste o fundo do mapa (ou use as setas) para ver os vizinhos; um peão levado além da borda entra no vizinho. A fog aparece meio transparente para você; os jogadores veem preta.'));
}

// Clima no mapa: efeito, intensidade e para onde o vento sopra. O clima do dia (aba Tempo) vira sugestão.
function climaDoMapa(mapa) {
  const cl = mapa.clima || {};
  const dia = estado.campanha.clima;
  const sug = sugestaoDoClima(dia);
  return h('div', { class: 'barra' },
    h('small', {}, icone('cloud-rain'), ' Clima no mapa:'),
    selecao(EFEITOS_CLIMA.map(e => ({ valor: e.id, rotulo: e.nome })), cl.efeito || '', v => acao('mapa.clima', { efeito: v }), { 'aria-label': 'Efeito de clima no mapa' }),
    cl.efeito ? selecao([1, 2, 3].map(n => ({ valor: String(n), rotulo: ['', 'fraco', 'médio', 'forte'][n] })), String(cl.intensidade || 2), v => acao('mapa.clima', { intensidade: v }), { 'aria-label': 'Intensidade' }) : null,
    cl.efeito && cl.efeito !== 'calor' ? selecao(DIRECOES.map(d => ({ valor: String(d.g), rotulo: `vento ${d.seta} ${d.nome.toLowerCase()}` })), String(cl.vento ?? 135), v => acao('mapa.clima', { vento: v }), { 'aria-label': 'Para onde o vento sopra' }) : null,
    dia ? h('small', { class: 'dica' }, `Clima do dia: ${dia.nome}${sug && sug !== cl.efeito ? ` (sugestão: ${EFEITOS_CLIMA.find(e => e.id === sug).nome.toLowerCase()})` : ''}`) : null,
    sug && sug !== cl.efeito ? botao('Usar a sugestão', () => acao('mapa.clima', { efeito: sug }), { class: 'pequeno' }) : null);
}

// Pincel da fog: arrastar pelo mapa revela ou cobre quadrados (o servidor recebe ao soltar).
let pincelando = null;
export function pincelFog(e, quadrado, modo) {
  if (e.type === 'pointerdown') pincelando = new Map();
  if (!pincelando || (e.type === 'pointermove' && !(e.buttons & 1))) return;
  const { col, lin } = quadrado;
  const k = `${col}:${lin}`;
  if (pincelando.has(k)) return;
  pincelando.set(k, { col, lin });
  e.currentTarget.append(h('span', { class: `fog-pincel ${modo}`, style: { '--col': col, '--lin': lin } }));
}
export function terminarPincel(modo) {
  if (!pincelando) return;
  const q = [...pincelando.values()];
  pincelando = null;
  if (q.length) acao('mapa.revelar', { quadrados: q, revelar: modo === 'revelar' }).catch(err => aviso(err.message, 'erro'));
}
export { ladoNoMapa };
