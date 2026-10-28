// Palco do combate (autor, 28/10): logo abaixo da faixa de turnos, todos veem de quem é a vez e o que está acontecendo —
// quem ataca, com que arma e quem é o alvo (ou o teste que está fazendo). Acertou: "ACERTO!" com o dano bruto subindo
// como um "hit point" de jogo, e o som da arma (gerado no navegador, sem arquivos). Cada aparelho pode desligar o som.
import { h, icone } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { ICONE_ARMA } from './fx.js';

const NOME_ARMA = { desarmado: 'golpe desarmado', lamina: 'lâmina', machado: 'machado', martelo: 'arma de impacto', arco: 'projétil', fogo: 'arma de fogo' };
// Com os dados aparecendo na tela, o resultado espera eles pararem (~1,3 s) para não estragar a surpresa.
const ESPERA_DADOS = 1400;

const inicioDe = new Map(); // id da entrada → quando o resultado aparece (para a animação continuar de onde estava)
let vistos = null;
let campanhaVista = null;

function semMovimento() {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function somDesligado() {
  try { return localStorage.getItem('msa.semSom') === '1'; } catch { return false; }
}
function alternarSom() {
  try { localStorage.setItem('msa.semSom', somDesligado() ? '0' : '1'); } catch { /* sem armazenamento: fica como está */ }
  render();
}
const dadosNaTela = c => c.dadosNaTela !== false && (() => { try { return localStorage.getItem('msa.semAnimacaoDados') !== '1'; } catch { return true; } })();

// Chamada a cada estado novo da campanha: ataques e testes novos ganham a animação e o som (uma vez).
export function observarPalco(c) {
  const log = c?.salas?.batalha?.log || [];
  if (campanhaVista !== c?.id || !vistos) {
    campanhaVista = c?.id;
    vistos = new Set(log.map(e => e.id));
    return;
  }
  for (const e of log) {
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    if (!['ataque', 'dmil'].includes(e.tipo) || e.secreta) continue;
    const espera = dadosNaTela(c) && e.dp != null && !semMovimento() ? ESPERA_DADOS : 0;
    inicioDe.set(e.id, Date.now() + espera);
    setTimeout(() => { if (e.tipo === 'ataque') somDoAtaque(e); render(); }, espera);
    setTimeout(render, espera + 2600);
  }
}

// O palco em si (no Campo de Batalha, para todos).
export function palcoCombate() {
  const s = estado.campanha?.salas?.batalha;
  const cb = s?.combate;
  if (!cb) return null;
  const atual = personagemPorId(cb.ordem[cb.vez]?.id);
  const pend = (s.pendentes || []).at(-1);
  // Ataques antigos (de antes do palco) não dizem quem atacou: ficam de fora.
  const ultimo = [...(s.log || [])].reverse().find(e => (e.tipo === 'ataque' ? e.atacanteId : e.tipo === 'dmil') && !e.secreta);
  // A ação mostrada: o ataque esperando defesa; senão o último ataque/teste deste turno; senão "aguardando".
  const doTurno = ultimo && (!cb.turnoDesde || ultimo.em >= cb.turnoDesde) ? ultimo : null;
  return h('section', { class: 'palco-combate', 'aria-live': 'polite', 'aria-label': 'O que está acontecendo no combate' },
    h('div', { class: 'palco-vez' },
      rosto(atual, 'grande'),
      h('div', {}, h('small', {}, `Rodada ${cb.rodada} · vez de`), h('strong', {}, atual?.nome || '—'))),
    h('div', { class: 'palco-acao' },
      pend ? cenaAtaque({ atacanteId: pend.atacante, alvoId: pend.alvo, arma: pend.arma, armaTipo: pend.armaTipo }, null)
        : doTurno?.tipo === 'ataque' ? cenaAtaque(doTurno, doTurno)
          : doTurno ? cenaTeste(doTurno)
            : h('p', { class: 'palco-espera' }, icone('hourglass'), ` Aguardando a ação de ${atual?.nome || '…'}`)),
    h('button', { type: 'button', class: 'palco-som so-icone', onclick: alternarSom, title: somDesligado() ? 'Ligar o som das armas neste aparelho' : 'Desligar o som das armas neste aparelho',
      'aria-label': somDesligado() ? 'Ligar o som' : 'Desligar o som', 'aria-pressed': !somDesligado() }, icone(somDesligado() ? 'volume-x' : 'volume-2')));
}

function rosto(p, extra = '') {
  return h('span', { class: `avatar palco-rosto ${extra}`, 'data-pid': p?.id || '' }, p?.foto ? h('img', { src: p.foto, alt: '' }) : (p?.nome || '?').slice(0, 1));
}

// Atacante → arma → alvo; embaixo o resultado (ou "aguardando a defesa").
function cenaAtaque(e, resultado) {
  const a = personagemPorId(e.atacanteId);
  const b = personagemPorId(e.alvoId);
  const agora = Date.now();
  const inicio = resultado ? inicioDe.get(resultado.id) ?? 0 : 0;
  // A animação usa atraso negativo para continuar de onde estava a cada redesenho; positivo enquanto os dados rolam.
  const atraso = { animationDelay: `${inicio - agora}ms` };
  const acertou = resultado?.sucesso || resultado?.dano > 0;
  const rotulo = !resultado ? 'aguardando a defesa' : resultado.critico === 'acerto' ? 'CRÍTICO!' : resultado.sucesso ? 'ACERTO!' : resultado.dano ? 'DEFENDEU EM PARTE' : (resultado.texto || '').startsWith('Errou') ? 'ERROU' : 'DEFENDEU';
  const classe = !resultado ? 'espera' : resultado.critico === 'acerto' ? 'critico' : acertou ? 'acerto' : 'defesa';
  return h('div', { class: `palco-cena ${classe}` },
    h('div', { class: 'palco-lado' }, rosto(a), h('strong', {}, a?.nome || '?')),
    h('div', { class: 'palco-arma', title: NOME_ARMA[e.armaTipo] || '' },
      h('span', { class: 'palco-arma-icone' }, icone(ICONE_ARMA[e.armaTipo] || 'swords')),
      h('small', {}, e.arma || NOME_ARMA[e.armaTipo] || 'ataque'), icone('move-right')),
    h('div', { class: 'palco-lado alvo' }, rosto(b), h('strong', {}, `${b?.nome || '?'}${resultado?.local ? ` (${resultado.local})` : ''}`),
      // O número do dano sobe por cima do alvo, como num jogo.
      resultado && acertou && resultado.danoBruto ? h('span', { class: 'palco-hit', style: atraso, 'aria-hidden': 'true' }, `−${resultado.danoBruto}`) : null),
    h('div', { class: 'palco-resultado', style: resultado ? atraso : null },
      h('span', { class: 'palco-rotulo' }, icone(!resultado ? 'hourglass' : acertou ? 'swords' : 'shield-check'), ` ${rotulo}`),
      resultado && acertou ? h('span', { class: 'palco-dano' }, h('strong', {}, String(resultado.danoBruto || resultado.dano || 0)), h('small', {}, ' de dano bruto'),
        resultado.dano !== resultado.danoBruto ? h('small', { class: 'palco-tomou' }, ` · tomou ${resultado.dano}`) : null) : null));
}

// Teste no Campo de Batalha (perícia, atributo…): quem testa, o quê e o resultado.
function cenaTeste(e) {
  const p = personagemPorId(e.personagemId) || (estado.campanha.personagens || []).find(x => x.nome === e.autor);
  const inicio = inicioDe.get(e.id) ?? 0;
  const atraso = { animationDelay: `${inicio - Date.now()}ms` };
  const res = e.sucesso == null ? `total ${e.total}` : e.sucesso ? 'SUCESSO' : 'FALHA';
  return h('div', { class: `palco-cena teste ${e.sucesso ? 'acerto' : e.sucesso === false ? 'defesa' : ''}` },
    h('div', { class: 'palco-lado' }, rosto(p), h('strong', {}, e.autor)),
    h('div', { class: 'palco-arma' }, h('span', { class: 'palco-arma-icone' }, icone('dices')), h('small', {}, e.rotulo || 'Teste')),
    h('div', { class: 'palco-resultado', style: atraso },
      h('span', { class: 'palco-rotulo' }, ` ${res}`), e.nd != null ? h('small', {}, ` ${e.total} contra ${e.nd}`) : null));
}

// ---------- Som das armas (Web Audio, sintetizado) ----------
let ctxAudio = null;
function audio() {
  if (somDesligado()) return null;
  try {
    ctxAudio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    return ctxAudio;
  } catch { return null; }
}
// O navegador só toca som depois de um clique: o primeiro clique na página destrava.
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => { if (!somDesligado()) audio(); }, { once: true });

function ruido(ac, { t = 0, dur = 0.2, vol = 0.5, filtro = 'lowpass', freq = 1000, freqFim = null, q = 1 } = {}) {
  const n = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = filtro; f.Q.value = q;
  const t0 = ac.currentTime + t;
  f.frequency.setValueAtTime(freq, t0);
  if (freqFim) f.frequency.exponentialRampToValueAtTime(freqFim, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}
function tom(ac, { t = 0, dur = 0.2, vol = 0.4, tipo = 'sine', freq = 200, freqFim = null } = {}) {
  const o = ac.createOscillator();
  o.type = tipo;
  const t0 = ac.currentTime + t;
  o.frequency.setValueAtTime(freq, t0);
  if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// Cada tipo de arma tem o seu som; acertou soa o impacto, defendeu soa o bloqueio (metal).
export function somDoAtaque(e) {
  const ac = audio();
  if (!ac) return;
  const acertou = e.sucesso || e.dano > 0;
  const forte = e.critico === 'acerto' ? 1.4 : 1;
  switch (e.armaTipo) {
    case 'fogo':
      ruido(ac, { dur: 0.35, vol: 0.9 * forte, filtro: 'lowpass', freq: 4000, freqFim: 300 });
      tom(ac, { dur: 0.25, vol: 0.7, freq: 150, freqFim: 40 });
      break;
    case 'arco':
      tom(ac, { dur: 0.15, vol: 0.35, tipo: 'triangle', freq: 320, freqFim: 180 });
      ruido(ac, { t: 0.05, dur: 0.3, vol: 0.3, filtro: 'bandpass', freq: 1200, freqFim: 4000, q: 2 });
      break;
    case 'machado':
    case 'martelo':
      ruido(ac, { dur: 0.25, vol: 0.25, filtro: 'bandpass', freq: 400, freqFim: 1200, q: 1.5 });
      break;
    case 'lamina':
      ruido(ac, { dur: 0.22, vol: 0.35, filtro: 'bandpass', freq: 900, freqFim: 3500, q: 3 });
      break;
    default: // desarmado: só o deslocamento de ar antes do soco
      ruido(ac, { dur: 0.12, vol: 0.2, filtro: 'bandpass', freq: 600, freqFim: 1500, q: 1.5 });
  }
  const t = e.armaTipo === 'fogo' ? 0.05 : 0.2;
  if (!acertou) {
    // Bloqueio: tinido metálico curto.
    tom(ac, { t, dur: 0.18, vol: 0.25, tipo: 'square', freq: 900, freqFim: 700 });
    tom(ac, { t, dur: 0.3, vol: 0.15, freq: 2400, freqFim: 2000 });
    return;
  }
  if (e.armaTipo === 'lamina') {
    ruido(ac, { t, dur: 0.12, vol: 0.5 * forte, filtro: 'highpass', freq: 2500 });
    tom(ac, { t, dur: 0.25, vol: 0.12, freq: 3200, freqFim: 2600 });
  } else if (e.armaTipo === 'machado' || e.armaTipo === 'martelo') {
    tom(ac, { t, dur: 0.35, vol: 0.9 * forte, freq: 110, freqFim: 35 });
    ruido(ac, { t, dur: 0.2, vol: 0.6 * forte, filtro: 'lowpass', freq: 900 });
  } else if (e.armaTipo === 'arco') {
    tom(ac, { t: 0.3, dur: 0.15, vol: 0.6, freq: 180, freqFim: 70 });
  } else if (e.armaTipo !== 'fogo') {
    tom(ac, { t, dur: 0.2, vol: 0.8 * forte, freq: 160, freqFim: 50 });
    ruido(ac, { t, dur: 0.1, vol: 0.5 * forte, filtro: 'lowpass', freq: 500 });
  }
  if (e.critico === 'acerto') tom(ac, { t: t + 0.1, dur: 0.5, vol: 0.2, tipo: 'triangle', freq: 660, freqFim: 990 });
}
