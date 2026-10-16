// Animação dos dados na tela de todos: quando alguém rola um D-MIL (teste, ataque ou manipulação),
// aparecem o DP (2 d10 brancos: dezena e unidade), o DS (d10 vermelho) e, no ataque, os dados de dano.
// O mestre pode desligar na aba Campanha ("Mostrar as rolagens na tela de todos"). Rolagens secretas nunca aparecem.
import { h, icone } from '../ui.js';

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
  const dezena = d10('dp');
  const unidade = d10('dp');
  const ds = d10('ds');
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
      if (++n >= 14) { clearInterval(giro); fim(); }
    }, 60);
  }
  const t = setTimeout(fechar, 8000);
}

// Um d10 desenhado (trapezoedro visto de frente), com o número na face do meio.
const FACES_D10 = `<svg viewBox="0 0 100 110" aria-hidden="true">
  <path class="f-lado" d="M50 3 L22 52 L3 45 Z M50 3 L78 52 L97 45 Z"/>
  <path class="f-baixo" d="M3 45 L22 52 L12 72 Z M97 45 L78 52 L88 72 Z M22 52 L50 72 L50 107 L12 72 Z M78 52 L50 72 L50 107 L88 72 Z"/>
  <path class="f-meio" d="M50 3 L78 52 L50 72 L22 52 Z"/>
  <path class="f-borda" d="M50 3 L97 45 L88 72 L50 107 L12 72 L3 45 Z M22 52 L50 72 L78 52 M50 72 L50 107 M3 45 L22 52 L12 72 M97 45 L78 52 L88 72"/>
</svg>`;

function d10(tipo) {
  const el = h('div', { class: `dado d10 ${tipo}`, 'aria-hidden': 'true' }, h('span', {}, '0'));
  el.insertAdjacentHTML('afterbegin', FACES_D10);
  return el;
}

const escrever = (el, v) => { el.querySelector('span').textContent = String(v); };

// 1–100 nos dois d10: dezena "00"–"90" e unidade "0"–"9" (00 + 0 = 100).
function mostrarDp(dezena, unidade, v) {
  const n = v % 100;
  escrever(dezena, String(Math.floor(n / 10) * 10).padStart(2, '0'));
  escrever(unidade, n % 10);
}
