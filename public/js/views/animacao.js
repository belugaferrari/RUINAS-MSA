// Animação dos dados na tela de todos: quando alguém rola um D-MIL (teste, ataque ou manipulação),
// aparecem o DP (d100, branco), o DS (d10, vermelho) e, no ataque, os dados de dano.
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
  const dp = h('div', { class: 'dado dp', 'aria-hidden': 'true' }, h('span', {}, '00'));
  const ds = h('div', { class: 'dado ds', 'aria-hidden': 'true' }, h('span', {}, '0'));
  const extrasDp = (e.dados || []).length > 1 ? h('small', { class: 'dado-extra' }, `rolou ${e.dados.join(' e ')}`) : null;
  const dano = (e.danoDados || []).flatMap(x => x.dados.map(v => h('div', { class: 'dado dano', title: x.nome, 'aria-hidden': 'true' }, h('span', {}, String(v)))));
  const resultado = e.sucesso == null ? `Total ${e.total}` : `${e.total}${e.nd != null ? ` × ${e.nd}` : ''} — ${e.sucesso ? 'SUCESSO' : 'FALHA'}${e.critico ? ` (crítico de ${e.critico})` : ''}`;
  const resumo = h('p', { class: `dados-resultado ${e.sucesso === true ? 'ok' : e.sucesso === false ? 'perigo' : ''}` }, resultado,
    e.tipo === 'ataque' && e.dano ? h('span', { class: 'dano-total' }, ` · dano ${e.dano}`) : null);
  let fechado = false;
  const fechar = () => { if (fechado) return; fechado = true; caixa.remove(); clearTimeout(t); proxima(); };
  // Não bloqueia a tela: o cartão some sozinho (ou no "Fechar").
  const caixa = h('div', { class: 'dados-na-tela', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'dados-cartao' },
      h('p', { class: 'dados-quem' }, h('strong', {}, e.autor), ` — ${e.rotulo}`),
      h('div', { class: 'dados-linha' },
        h('div', { class: 'dado-rotulo' }, dp, h('small', {}, 'DP · d100'), extrasDp),
        h('div', { class: 'dado-rotulo' }, ds, h('small', {}, 'DS · d10')),
        dano.length ? h('div', { class: 'dado-rotulo' }, h('div', { class: 'dados-dano' }, dano), h('small', {}, 'dano')) : null),
      resumo,
      h('button', { type: 'button', class: 'pequeno', onclick: ev => { ev.stopPropagation(); fechar(); } }, icone('x'), 'Fechar')));
  document.body.append(caixa);
  // Os números giram por um instante e param no resultado.
  const fim = () => {
    dp.firstChild.textContent = String(e.dp).padStart(2, '0');
    ds.firstChild.textContent = String(e.ds);
    caixa.classList.add('parou');
  };
  if (reduzido) fim();
  else {
    let n = 0;
    const giro = setInterval(() => {
      dp.firstChild.textContent = String(1 + Math.floor(Math.random() * 100)).padStart(2, '0');
      ds.firstChild.textContent = String(1 + Math.floor(Math.random() * 10));
      if (++n >= 14) { clearInterval(giro); fim(); }
    }, 60);
  }
  const t = setTimeout(fechar, 4200);
}
