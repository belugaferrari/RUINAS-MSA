// Boneco do personagem: mostra o que está equipado em cada parte do corpo e deixa equipar/trocar ali mesmo.
import { h, botao, aviso, icone, titulo } from '../ui.js';
import { estado, render, mudar } from '../estado.js';
import { acao } from '../api.js';
import { podeEquipar } from '/shared/regras.js';
import { desenhoBoneco } from './bonecoArte.js';

// Posição de cada slot sobre o desenho (em % da figura). "maos" vira duas mãos.
const PONTOS = [
  { slot: 'cabeca', rotulo: 'Cabeça', x: 50, y: 4 },
  { slot: 'joia', rotulo: 'Joias', x: 79, y: 19 },
  { slot: 'costas', rotulo: 'Costas', x: 21, y: 19 },
  { slot: 'corpo', rotulo: 'Corpo', x: 50, y: 34 },
  { slot: 'maos', mao: 0, rotulo: 'Mão direita', x: 17, y: 60 },
  { slot: 'maos', mao: 1, rotulo: 'Mão esquerda', x: 83, y: 60 },
  { slot: 'vestimenta', rotulo: 'Vestimenta', x: 50, y: 70 },
];

// Que desenho vai em cada mão: arma, escudo (proteção) ou um item qualquer.
const tipoNaMao = it => (it.tipo === 'arma' ? 'arma' : it.tipo === 'defesa' || /escudo/i.test(it.nome) ? 'escudo' : 'item');

// Partes que acabaram de ser ocupadas brilham por um instante ("equipado!").
const ocupacaoVista = new Map();
const recem = new Map();
function camadasOcupadas(p) {
  const tem = slot => (p.itens || []).some(i => i.equipado && i.slot === slot);
  const camadas = ['cabeca', 'corpo', 'vestimenta', 'joia', 'costas'].filter(tem);
  const duas = (p.itens || []).find(i => i.equipado && i.slot === 'maos' && (i.ocupa ?? 1) >= 2);
  if (duas) camadas.push('duas');
  else for (const n of [0, 1]) { const it = naMao(p, n); if (it) camadas.push(`m${n}-${tipoNaMao(it)}`); }
  const antes = ocupacaoVista.get(p.id);
  if (antes) for (const c of camadas) if (!antes.has(c)) { recem.set(`${p.id}:${c}`, Date.now()); setTimeout(render, 1700); }
  ocupacaoVista.set(p.id, new Set(camadas));
  return camadas;
}

export function bonecoView(p, { mestre = false, linkGuardados = true, compacto = false } = {}) {
  const sis = estado.sistema;
  const equipados = slot => (p.itens || []).filter(i => i.equipado && i.slot === slot);
  const chave = `boneco:${p.id}`;
  const aberto = estado.sel[chave] || null;
  const camadas = camadasOcupadas(p);
  const agora = Date.now();
  const novas = camadas.filter(c => agora - (recem.get(`${p.id}:${c}`) || 0) < 1600);
  const figura = h('div', { class: `boneco-figura ${camadas.map(c => `c-${c}`).join(' ')} ${novas.map(c => `novo-${c}`).join(' ')}` });
  // Figura masculina ou feminina, conforme o gênero da ficha (sem gênero: masculina).
  figura.innerHTML = desenhoBoneco(p.genero);
  for (const pt of PONTOS) {
    const slotDef = sis.slots.find(s => s.id === pt.slot);
    if (!slotDef) continue;
    const lista = equipados(pt.slot);
    // Mãos: um item de duas mãos aparece nas duas.
    let itens = lista;
    if (pt.slot === 'maos') itens = naMao(p, pt.mao) ? [naMao(p, pt.mao)] : [];
    const id = pt.mao != null ? `maos:${pt.mao}` : pt.slot;
    figura.append(h('button', {
      type: 'button', class: `boneco-ponto ${itens.length ? 'cheio' : ''} ${aberto === id ? 'aberto' : ''}`,
      style: { left: `${pt.x}%`, top: `${pt.y}%` }, 'aria-expanded': aberto === id,
      title: `${pt.rotulo}: ${itens.map(i => i.nome).join(', ') || 'vazio'}`,
      onclick: () => { estado.sel[chave] = aberto === id ? null : id; render(); },
    }, h('small', {}, pt.rotulo, pt.mao != null && maoHabil(p) === pt.mao ? ' ★' : ''), h('span', {}, itens.map(i => i.nome).join(', ') || '—')));
  }
  const guardados = (p.itens || []).filter(i => !i.equipado);
  return h('div', { class: `boneco ${compacto ? 'compacto' : ''}` },
    figura,
    aberto ? painelSlot(p, aberto, mestre) : compacto ? null : h('p', { class: 'dica' }, icone('info'), ' Toque numa parte do corpo para ver, equipar ou trocar.'),
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
