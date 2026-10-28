// Artes de combate por cima dos avatares (barra de turnos, cartões, mapa e Sala Social):
// · enquanto alguém está sendo atacado: o desenho da arma sobre o alvo;
// · acertou: sangue escorrendo e o dano subindo; defendeu: escudo faiscando; crítico: explosão dourada;
// · morreu: caveira; recuperou PV: brilho verde; o SEU personagem ferido: bordas da tela em vermelho com sangue no topo.
// Os elementos marcados com data-pid recebem as artes depois de cada redesenho (a animação continua de onde estava).
import { h, icone } from '../ui.js';
import { estado, render } from '../estado.js';

export const ICONE_ARMA = { desarmado: 'hand-fist', lamina: 'sword', machado: 'axe', martelo: 'hammer', arco: 'bow-arrow', fogo: 'crosshair' };
const DURACAO = { acerto: 2800, defesa: 1800, critico: 2400, morte: 3600, cura: 2000, golpe: 1400 };

const ativos = []; // { pid, tipo, inicio, dur, dano, arma }
let vistos = null;
let campanhaVista = null;
const pvVisto = new Map();

function semMovimento() {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function disparar(pid, tipo, extra = {}) {
  const dur = DURACAO[tipo] || 2000;
  ativos.push({ pid, tipo, inicio: Date.now(), dur, ...extra });
  setTimeout(render, dur + 60);
}

// Chamada a cada estado novo da campanha: descobre ataques novos e mudanças de PV.
export function observarFx(c) {
  if (!c) return;
  const log = c.salas?.batalha?.log || [];
  if (campanhaVista !== c.id || !vistos) {
    campanhaVista = c.id;
    vistos = new Set(log.map(e => e.id));
    pvVisto.clear();
    for (const p of c.personagens || []) if (p.pv) pvVisto.set(p.id, p.pv.atual);
    return;
  }
  const meus = new Set((c.personagens || []).filter(p => p.donoId && p.donoId === estado.usuario?.id).map(p => p.id));
  for (const e of log) {
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    if (e.tipo !== 'ataque' || !e.alvoId || semMovimento()) continue;
    disparar(e.alvoId, 'golpe', { arma: e.armaTipo });
    if (e.sucesso) {
      disparar(e.alvoId, 'acerto', { dano: e.dano });
      if (e.critico === 'acerto') disparar(e.alvoId, 'critico');
      if (meus.has(e.alvoId)) telaFerida(e.dano);
    } else if (e.dano) {
      disparar(e.alvoId, 'acerto', { dano: e.dano });
      disparar(e.alvoId, 'defesa');
    } else disparar(e.alvoId, 'defesa');
    if (e.morto) disparar(e.alvoId, 'morte');
  }
  // PV que subiu (cura, descanso): brilho verde. Só nos personagens cujo PV a pessoa enxerga.
  for (const p of c.personagens || []) {
    if (!p.pv) continue;
    const antes = pvVisto.get(p.id);
    if (antes != null && p.pv.atual > antes && !semMovimento()) disparar(p.id, 'cura', { dano: p.pv.atual - antes });
    pvVisto.set(p.id, p.pv.atual);
  }
}

// Depois de cada redesenho: põe as artes nos elementos de cada personagem.
export function aplicarFx(raiz = document) {
  const agora = Date.now();
  for (let i = ativos.length - 1; i >= 0; i--) if (agora - ativos[i].inicio > ativos[i].dur) ativos.splice(i, 1);
  const pendentes = estado.campanha?.salas?.batalha?.pendentes || [];
  if (!ativos.length && !pendentes.length) return;
  for (const el of raiz.querySelectorAll('[data-pid]')) {
    const pid = el.dataset.pid;
    // Ataque esperando a defesa: o desenho da arma fica sobre o alvo até ele se defender.
    const pend = pendentes.find(x => x.alvo === pid);
    if (pend) el.append(arte({ tipo: 'ameaca', arma: pend.armaTipo, inicio: agora, dur: 0 }));
    for (const fx of ativos) if (fx.pid === pid) el.append(arte(fx, agora));
  }
}

function arte(fx, agora = Date.now()) {
  const atraso = { animationDelay: `-${Math.max(0, agora - fx.inicio)}ms` };
  const base = { class: `fx fx-${fx.tipo}`, 'aria-hidden': 'true', style: atraso };
  switch (fx.tipo) {
    case 'ameaca':
    case 'golpe':
      return h('span', base, h('span', { class: 'fx-arma' }, icone(ICONE_ARMA[fx.arma] || 'swords')));
    case 'acerto': {
      const el = h('span', base, fx.dano ? h('span', { class: 'fx-numero' }, `−${fx.dano}`) : null);
      el.insertAdjacentHTML('afterbegin', SANGUE);
      return el;
    }
    case 'defesa':
      return h('span', base, h('span', { class: 'fx-escudo' }, icone('shield')), h('span', { class: 'fx-faiscas' }));
    case 'critico':
      return h('span', base, h('span', { class: 'fx-explosao' }), h('span', { class: 'fx-texto' }, 'CRÍTICO!'));
    case 'morte':
      return h('span', base, h('span', { class: 'fx-caveira' }, icone('skull')));
    case 'cura':
      return h('span', base, h('span', { class: 'fx-numero verde' }, `+${fx.dano}`), ...[0, 1, 2, 3, 4].map(n => h('i', { class: `fx-mais m${n}` }, '+')));
    default:
      return h('span', base);
  }
}

// Sangue escorrendo do alto: uma faixa irregular com gotas que descem e uma que pinga.
export const SANGUE = `<svg class="fx-sangue" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  <defs><linearGradient id="fxSangue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e01b24"/><stop offset=".6" stop-color="#9b0f16"/><stop offset="1" stop-color="#5e070b"/></linearGradient></defs>
  <path class="escorre" fill="url(#fxSangue)" d="M0 0 H100 V10 C97 12 95 10 93 11 C91 30 88 44 85 12 C80 14 76 10 72 12 C70 52 66 70 62 12 C56 15 51 10 46 13 C44 32 41 40 38 12 C31 15 26 10 21 12 C19 46 15 58 12 13 C8 15 4 10 0 12 Z"/>
  <ellipse class="gota g1" cx="64" cy="70" rx="3.2" ry="4.4" fill="#9b0f16"/>
  <ellipse class="gota g2" cx="13.5" cy="58" rx="2.6" ry="3.6" fill="#9b0f16"/>
</svg>`;

// O seu personagem foi ferido: a tela pulsa em vermelho nas bordas e escorre sangue do topo.
function telaFerida(dano) {
  const forte = Math.min(1, 0.35 + (dano || 0) / 12);
  const el = h('div', { class: 'fx-tela', style: { '--forca': forte }, 'aria-hidden': 'true' });
  el.insertAdjacentHTML('beforeend', SANGUE);
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
