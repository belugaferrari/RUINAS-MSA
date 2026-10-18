// Boneco do personagem: mostra o que está equipado em cada parte do corpo e deixa equipar/trocar ali mesmo.
import { h, botao, aviso, icone, titulo } from '../ui.js';
import { estado, render, mudar } from '../estado.js';
import { acao } from '../api.js';
import { podeEquipar } from '/shared/regras.js';

// Boneco: o personagem pintado (masculino ou feminino, pelo gênero da ficha) entre duas colunas de molduras,
// uma para cada parte do corpo. Parte ocupada: a moldura acende em azul de runa e um medalhão com o item
// brilha sobre aquela parte do corpo. Clicar na moldura ou no medalhão abre o painel para equipar/trocar.
const PARTES = [
  { id: 'cabeca', slot: 'cabeca', rotulo: 'Cabeça', icone: 'hard-hat', lado: 'esq' },
  { id: 'joia', slot: 'joia', rotulo: 'Joias', icone: 'gem', lado: 'dir' },
  { id: 'corpo', slot: 'corpo', rotulo: 'Corpo', icone: 'shield', lado: 'esq' },
  { id: 'costas', slot: 'costas', rotulo: 'Costas', icone: 'backpack', lado: 'dir' },
  { id: 'm0', slot: 'maos', mao: 0, rotulo: 'Mão direita', icone: 'hand', lado: 'esq' },
  { id: 'm1', slot: 'maos', mao: 1, rotulo: 'Mão esquerda', icone: 'hand', lado: 'dir' },
  { id: 'vestimenta', slot: 'vestimenta', rotulo: 'Vestimenta', icone: 'shirt', lado: 'esq' },
];
// Onde fica cada parte em cada figura (em % da imagem).
const FIGURAS = {
  masculino: { img: '/img/boneco-masculino.webp', pontos: { cabeca: [49, 3.5], joia: [50, 19], corpo: [50, 30], costas: [76, 21], m0: [12, 46], m1: [85, 46], vestimenta: [50, 62] } },
  feminino: { img: '/img/boneco-feminino.webp', pontos: { cabeca: [40, 6], joia: [41, 21], corpo: [44, 33], costas: [66, 25], m0: [12, 49], m1: [77, 49], vestimenta: [46, 63] } },
};
const ICONE_NA_MAO = { arma: 'sword', escudo: 'shield', item: 'package', duas: 'swords' };

// Que tipo de coisa está em cada mão: arma, escudo (proteção) ou um item qualquer.
const tipoNaMao = it => (it.tipo === 'arma' ? 'arma' : it.tipo === 'defesa' || /escudo/i.test(it.nome) ? 'escudo' : 'item');

// Partes que acabaram de ser ocupadas acendem com mais força por um instante ("equipado!").
const ocupacaoVista = new Map();
const recem = new Map();
function partesOcupadas(p) {
  const tem = slot => (p.itens || []).some(i => i.equipado && i.slot === slot);
  const ocupadas = ['cabeca', 'corpo', 'vestimenta', 'joia', 'costas'].filter(tem);
  if (naMao(p, 0)) ocupadas.push('m0');
  if (naMao(p, 1)) ocupadas.push('m1');
  const antes = ocupacaoVista.get(p.id);
  if (antes) for (const c of ocupadas) if (!antes.has(c)) { recem.set(`${p.id}:${c}`, Date.now()); setTimeout(render, 1700); }
  ocupacaoVista.set(p.id, new Set(ocupadas));
  return ocupadas;
}

export function bonecoView(p, { mestre = false, linkGuardados = true, compacto = false } = {}) {
  const sis = estado.sistema;
  const chave = `boneco:${p.id}`;
  const aberto = estado.sel[chave] || null;
  const fig = FIGURAS[p.genero === 'feminino' ? 'feminino' : 'masculino'];
  const ocupadas = new Set(partesOcupadas(p));
  const agora = Date.now();
  const novo = id => agora - (recem.get(`${p.id}:${id}`) || 0) < 1600;
  const partes = PARTES.filter(pt => sis.slots.some(s => s.id === pt.slot)).map(pt => {
    const itens = pt.slot === 'maos' ? (naMao(p, pt.mao) ? [naMao(p, pt.mao)] : []) : (p.itens || []).filter(i => i.equipado && i.slot === pt.slot);
    const id = pt.mao != null ? `maos:${pt.mao}` : pt.slot;
    const duas = itens[0] && pt.slot === 'maos' && (itens[0].ocupa ?? 1) >= 2;
    const simbolo = pt.slot === 'maos' && itens[0] ? ICONE_NA_MAO[duas ? 'duas' : tipoNaMao(itens[0])] : pt.icone;
    const nomes = itens.map(i => i.nome).join(', ');
    const habil = pt.mao != null && maoHabil(p) === pt.mao;
    return { ...pt, itens, chaveAberta: id, simbolo, nomes, habil, cheio: ocupadas.has(pt.id), novo: novo(pt.id),
      abrir: () => { estado.sel[chave] = aberto === id ? null : id; render(); } };
  });
  const classe = x => `parte-${x.id} ${x.cheio ? 'cheio' : ''} ${x.novo ? 'novo' : ''} ${aberto === x.chaveAberta ? 'aberto' : ''}`;
  const moldura = x => h('button', {
    type: 'button', class: `boneco-moldura ${classe(x)}`, 'aria-expanded': aberto === x.chaveAberta,
    title: `${x.rotulo}: ${x.nomes || 'vazio'}`, onclick: x.abrir,
  },
    h('span', { class: 'moldura-icone' }, icone(x.simbolo)),
    h('span', { class: 'moldura-texto' }, h('small', {}, x.rotulo, x.habil ? ' ★' : ''), h('span', {}, x.nomes || 'vazio')));
  const pontos = fig.pontos;
  const medalhao = x => h('button', {
    type: 'button', class: `boneco-medalhao ${classe(x)}`, style: { left: `${pontos[x.id][0]}%`, top: `${pontos[x.id][1]}%` },
    title: `${x.rotulo}: ${x.nomes || 'vazio'}`, 'aria-label': `${x.rotulo}: ${x.nomes || 'vazio'}`, tabindex: compacto ? 0 : -1, onclick: x.abrir,
  }, h('span', { class: 'selo' }, h('span', { class: 'aura' }), icone(x.simbolo)));
  const guardados = (p.itens || []).filter(i => !i.equipado);
  return h('div', { class: `boneco ${compacto ? 'compacto' : ''}` },
    h('div', { class: 'boneco-palco' },
      compacto ? null : h('div', { class: 'boneco-coluna esq' }, partes.filter(x => x.lado === 'esq').map(moldura)),
      h('div', { class: 'boneco-figura' },
        h('img', { src: fig.img, alt: '', class: 'boneco-arte', draggable: 'false' }),
        partes.map(medalhao)),
      compacto ? null : h('div', { class: 'boneco-coluna dir' }, partes.filter(x => x.lado === 'dir').map(moldura))),
    aberto ? painelSlot(p, aberto, mestre) : compacto ? null : h('p', { class: 'dica' }, icone('info'), ' Toque numa moldura (ou no corpo) para ver, equipar ou trocar.'),
    linkGuardados ? h('p', { class: 'boneco-guardados' }, icone('backpack'), ` Guardados: ${guardados.length} ${guardados.length === 1 ? 'item' : 'itens'} `,
      botao('Ver inventário', () => irParaInventario(mestre), { class: 'pequeno link', icone: 'backpack' })) : null);
}

function irParaInventario(mestre) {
  if (!mestre && estado.campanha.papel !== 'mestre') return mudar({ aba: 'itens' });
  document.getElementById('equipamento')?.scrollIntoView({ behavior: 'smooth' });
}

export function painelSlot(p, aberto, mestre) {
  const sis = estado.sistema;
  const slot = aberto.split(':')[0];
  const slotDef = sis.slots.find(s => s.id === slot);
  const noSlot = (p.itens || []).filter(i => i.equipado && i.slot === slot);
  const opcoes = (p.itens || []).filter(i => !i.equipado && i.slot === slot);
  const mao = aberto.includes(':') ? parseInt(aberto.split(':')[1], 10) : null;
  const equipar = async it => {
    // Na mão escolhida: tira o que estiver nela (ou a arma de duas mãos); sem espaço, tira o que estiver no caminho.
    if (slot === 'maos') {
      const ocupando = (it.ocupa ?? 1) >= 2 ? noSlot : noSlot.filter(x => (x.ocupa ?? 1) >= 2 || maoDoItem(p, x) === mao);
      for (const x of ocupando) await acao('item.equipar', { id: p.id, uid: x.uid, equipar: false });
    } else if (!podeEquipar(p, it, sis).ok) {
      let livre = slotDef.capacidade - noSlot.reduce((s, i) => s + (i.ocupa ?? 1), 0);
      for (const x of noSlot) {
        if (livre >= (it.ocupa ?? 1)) break;
        await acao('item.equipar', { id: p.id, uid: x.uid, equipar: false });
        livre += x.ocupa ?? 1;
      }
    }
    await acao('item.equipar', { id: p.id, uid: it.uid, equipar: true, mao });
    aviso(`${it.nome} equipado${slot === 'maos' && (it.ocupa ?? 1) < 2 ? ` na mão ${mao === 1 ? 'esquerda' : 'direita'}` : ''}.`);
  };
  return h('div', { class: 'boneco-painel' },
    titulo(`${slotDef.nome} (${noSlot.reduce((s, i) => s + (i.ocupa ?? 1), 0)}/${slotDef.capacidade})`, 'shirt', 'h4'),
    noSlot.length ? h('ul', { class: 'lista-inline' }, noSlot.map(i => h('li', {}, i.nome,
      i.capacidade ? h('small', {}, ` (${i.carregada || 0}/${i.capacidade})`) : null,
      botao('Guardar', () => acao('item.equipar', { id: p.id, uid: i.uid, equipar: false }), { class: 'pequeno', icone: 'backpack', title: `Guardar ${i.nome}` }))))
      : h('p', { class: 'dica' }, 'Nada equipado aqui.'),
    opcoes.length ? h('div', {}, h('small', {}, 'Guardados que servem aqui:'),
      h('ul', { class: 'lista-inline' }, opcoes.map(i => h('li', {}, i.nome, (i.ocupa ?? 1) > 1 ? h('small', {}, ` (${i.ocupa} mãos)`) : null,
        botao(noSlot.length >= slotDef.capacidade ? 'Trocar' : 'Equipar', () => equipar(i), { class: 'pequeno primario', icone: 'shirt', title: `Equipar ${i.nome}` })))))
      : h('p', { class: 'dica' }, 'Nenhum item guardado serve nesta parte.'));
}

// Mãos: 0 = direita, 1 = esquerda. Itens antigos (sem "mao") ocupam as mãos na ordem em que foram equipados.
export const maoHabil = p => (p.maoHabil === 'esquerda' ? 1 : 0);
export function maoDoItem(p, it) {
  if (it.mao === 0 || it.mao === 1) return it.mao;
  const semMao = (p.itens || []).filter(i => i.equipado && i.slot === 'maos' && i.mao !== 0 && i.mao !== 1 && (i.ocupa ?? 1) < 2);
  const usadas = new Set((p.itens || []).filter(i => i.equipado && i.slot === 'maos').map(i => i.mao));
  const livres = [0, 1].filter(m => !usadas.has(m));
  return livres[semMao.indexOf(it)] ?? 0;
}
export function naMao(p, n) {
  const maos = (p.itens || []).filter(i => i.equipado && i.slot === 'maos');
  return maos.find(i => (i.ocupa ?? 1) >= 2) || maos.find(i => maoDoItem(p, i) === n) || null;
}
