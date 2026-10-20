// Animação dos dados na tela de todos: quando alguém rola um D-MIL (teste, ataque ou manipulação),
// aparecem o DP (2 d10 brancos: dezena e unidade), o DS (d10 vermelho) e, no ataque, os dados de dano.
// O mestre pode desligar na aba Campanha ("Mostrar as rolagens na tela de todos"). Rolagens secretas nunca aparecem.
import { criarD10 } from './dado3d.js';
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
  // DP = 2 d10 marfim (dezena e unidade: 00 + 0 = 100); DS = 1 d10 vermelho (0 = 10). Dados 3D que rolam e param no valor.
  const dDezena = criarD10('dp', { dezena: true });
  const dUnidade = criarD10('dp');
  const dDs = criarD10('ds');
  const dezena = dDezena.el;
  const unidade = dUnidade.el;
  const ds = dDs.el;
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
  // Os dados rolam (tombam, quicam) e param com o resultado virado para cima.
  const n = (e.dp ?? 0) % 100;
  const fim = () => {
    rotuloDp.textContent = `DP · 2d10 = ${e.dp}`;
    caixa.classList.add('parou');
  };
  if (reduzido || e.dp == null) {
    dDezena.mostrar(Math.floor(n / 10) * 10); dUnidade.mostrar(n % 10); dDs.mostrar((e.ds ?? 0) % 10);
    fim();
  } else {
    Promise.all([
      dDezena.rolar(Math.floor(n / 10) * 10, { duracao: 1150 }),
      dUnidade.rolar(n % 10, { duracao: 1250, atraso: 90 }),
      dDs.rolar((e.ds ?? 0) % 10, { duracao: 1300, atraso: 160 }),
    ]).then(fim);
  }
  const t = setTimeout(fechar, 8000);
}

