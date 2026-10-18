// Animação dos dados na tela de todos: quando alguém rola um D-MIL (teste, ataque ou manipulação),
// aparecem o DP (2 d10 brancos: dezena e unidade), o DS (d10 vermelho) e, no ataque, os dados de dano.
// O mestre pode desligar na aba Campanha ("Mostrar as rolagens na tela de todos"). Rolagens secretas nunca aparecem.
import { h, icone } from '../ui.js';
import { SANGUE } from './fx.js';

const TIPOS = new Set(['dmil', 'ataque', 'manipulacao']);
const vistos = new Set();
let campanhaVista = null;
const fila = [];
let mostrando = false;

// Opção deste aparelho (ex.: telão sem animação): localStorage "msa.semAnimacaoDados" = "1".
function desligadoAqui() {
  try { return localStorage.getItem('msa.semAnimacaoDados') === '1'; } catch { return false; }
}

function entradas(c) {
  return [...(c.log || []), ...Object.values(c.salas || {}).flatMap(s => s.log || [])];
}

// Chamada a cada estado novo da campanha. Na primeira vez só memoriza o que já existia.
export function observarRolagens(c) {
  if (!c) return;
  const lista = entradas(c);
  if (campanhaVista !== c.id) {
    campanhaVista = c.id;
    vistos.clear();
    for (const e of lista) vistos.add(e.id);
    return;
  }
  for (const e of lista) {
    if (vistos.has(e.id)) continue;
    vistos.add(e.id);
    if (c.dadosNaTela === false || desligadoAqui() || e.secreta || !TIPOS.has(e.tipo) || e.dp == null) continue;
    fila.push(e);
  }
  if (!mostrando) proxima();
}

function proxima() {
  const e = fila.shift();
  if (!e) { mostrando = false; return; }
  mostrando = true;
  const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // DP = 2 d10 brancos (dezena e unidade: 00 + 0 = 100); DS = 1 d10 vermelho.
  const dezena = d10('dp', 0);
  const unidade = d10('dp', 90);
  const ds = d10('ds', 160);
  const rotuloDp = h('small', {}, 'DP · 2d10');
  const extrasDp = (e.dados || []).length > 1 ? h('small', { class: 'dado-extra' }, `rolou ${e.dados.join(' e ')}`) : null;
  const dano = (e.danoDados || []).flatMap(x => x.dados.map(v => h('div', { class: 'dado dano', title: x.nome, 'aria-hidden': 'true' }, h('span', {}, String(v)))));
  // No ataque, só "Acertou" (com o dano tomado) ou "Defendeu".
  const resultado = e.tipo === 'ataque'
    ? (e.sucesso ? `ACERTOU${e.dano ? ` · ${e.alvo || 'alvo'} tomou ${e.dano} de dano` : ''}` : e.dano ? `DEFENDEU EM PARTE · ${e.dano} de dano` : 'DEFENDEU')
    : e.sucesso == null ? `Total ${e.total}` : `${e.total}${e.nd != null ? ` × ${e.nd}` : ''} — ${e.sucesso ? 'SUCESSO' : 'FALHA'}`;
  const resumo = h('p', { class: `dados-resultado ${e.sucesso === true ? 'ok' : e.sucesso === false ? 'perigo' : ''}` }, resultado,
    e.critico ? h('small', {}, ` (crítico de ${e.critico})`) : null);
  let fechado = false;
  const fechar = () => { if (fechado) return; fechado = true; caixa.remove(); clearTimeout(t); proxima(); };
  // Não bloqueia a tela: o cartão some sozinho (ou no "Fechar").
  const caixa = h('div', { class: 'dados-na-tela', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'dados-cartao' },
      h('p', { class: 'dados-quem' }, h('strong', {}, e.autor), ` — ${e.rotulo}`),
      h('div', { class: 'dados-linha' },
        h('div', { class: 'dado-rotulo' }, h('div', { class: 'par-d10' }, dezena, unidade), rotuloDp, extrasDp),
        h('div', { class: 'dado-rotulo' }, ds, h('small', {}, 'DS · d10')),
        dano.length ? h('div', { class: 'dado-rotulo' }, h('div', { class: 'dados-dano' }, dano), h('small', {}, 'dano')) : null),
      resumo,
      h('button', { type: 'button', class: 'pequeno', onclick: ev => { ev.stopPropagation(); fechar(); } }, icone('x'), 'Fechar')));
  document.body.append(caixa);
  // Ataque que acertou: sangue escorre do alto do cartão; defendido: borda azul de escudo.
  if (e.tipo === 'ataque') {
    const cartao = caixa.querySelector('.dados-cartao');
    if (e.sucesso || e.dano) setTimeout(() => cartao.insertAdjacentHTML('afterbegin', SANGUE), reduzido ? 0 : 1300);
    else cartao.classList.add('defendeu');
  }
  // Os números giram por um instante e param no resultado.
  const fim = () => {
    mostrarDp(dezena, unidade, e.dp);
    escrever(ds, e.ds);
    rotuloDp.textContent = `DP · 2d10 = ${e.dp}`;
    caixa.classList.add('parou');
  };
  if (reduzido) fim();
  else {
    let n = 0;
    const giro = setInterval(() => {
      mostrarDp(dezena, unidade, 1 + Math.floor(Math.random() * 100));
      escrever(ds, 1 + Math.floor(Math.random() * 10));
      if (++n >= 16) { clearInterval(giro); fim(); }
    }, 75);
  }
  const t = setTimeout(fechar, 8000);
}

// Um d10 desenhado (trapezoedro visto de frente), com luz vindo de cima à esquerda, brilho e número gravado.
// Cada dado tem os próprios gradientes (ids únicos), uma sombra na "mesa" e um corpo que tomba enquanto rola.
let nDado = 0;
function desenhoD10() {
  const k = `d10g${++nDado}`;
  return `<svg viewBox="0 0 100 110" aria-hidden="true">
  <defs>
    <linearGradient id="${k}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--d-claro)"/><stop offset=".55" stop-color="var(--d-meio)"/><stop offset="1" stop-color="var(--d-lado)"/></linearGradient>
    <linearGradient id="${k}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--d-meio)"/><stop offset="1" stop-color="var(--d-lado)"/></linearGradient>
    <linearGradient id="${k}d" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--d-lado)"/><stop offset="1" stop-color="var(--d-baixo)"/></linearGradient>
    <linearGradient id="${k}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--d-lado)"/><stop offset="1" stop-color="var(--d-baixo)"/></linearGradient>
    <radialGradient id="${k}s" cx=".35" cy=".25" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <path fill="url(#${k}e)" d="M50 3 L22 52 L3 45 Z"/>
  <path fill="url(#${k}d)" d="M50 3 L78 52 L97 45 Z"/>
  <path fill="url(#${k}e)" d="M3 45 L22 52 L12 72 Z"/>
  <path fill="url(#${k}b)" d="M97 45 L78 52 L88 72 Z"/>
  <path fill="url(#${k}e)" d="M22 52 L50 72 L50 107 L12 72 Z"/>
  <path fill="url(#${k}b)" d="M78 52 L50 72 L50 107 L88 72 Z"/>
  <path fill="url(#${k}m)" d="M50 3 L78 52 L50 72 L22 52 Z"/>
  <path fill="url(#${k}s)" d="M50 3 L78 52 L50 72 L22 52 Z"/>
  <path class="f-borda" d="M50 3 L97 45 L88 72 L50 107 L12 72 L3 45 Z M22 52 L50 72 L78 52 M50 72 L50 107 M3 45 L22 52 L12 72 M97 45 L78 52 L88 72 M50 3 L22 52 M50 3 L78 52"/>
  <path class="f-luz" d="M50 6 L24 50"/>
</svg>`;
}

function d10(tipo, atraso = 0) {
  const corpo = h('div', { class: 'corpo' }, h('span', {}, '0'));
  corpo.insertAdjacentHTML('afterbegin', desenhoD10());
  return h('div', { class: `dado d10 ${tipo}`, 'aria-hidden': 'true', style: { animationDelay: `${atraso}ms` } }, h('div', { class: 'sombra' }), corpo);
}

const escrever = (el, v) => { el.querySelector('span').textContent = String(v); };

// 1–100 nos dois d10: dezena "00"–"90" e unidade "0"–"9" (00 + 0 = 100).
function mostrarDp(dezena, unidade, v) {
  const n = v % 100;
  escrever(dezena, String(Math.floor(n / 10) * 10).padStart(2, '0'));
  escrever(unidade, n % 10);
}
