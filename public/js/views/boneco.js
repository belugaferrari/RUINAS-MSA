// Boneco do personagem: mostra o que está equipado em cada parte do corpo e deixa equipar/trocar ali mesmo.
import { h, botao, aviso, icone, titulo } from '../ui.js';
import { estado, render, mudar } from '../estado.js';
import { acao } from '../api.js';
import { podeEquipar } from '/shared/regras.js';

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

const DESENHO = `<svg viewBox="0 0 200 300" aria-hidden="true" class="silhueta">
  <circle cx="100" cy="34" r="22"/>
  <rect x="91" y="54" width="18" height="12" rx="4"/>
  <path d="M62 70 Q100 60 138 70 L146 150 Q100 162 54 150 Z"/>
  <path d="M62 72 L36 140 L28 176 L40 178 L50 146 L68 104 Z"/>
  <path d="M138 72 L164 140 L172 176 L160 178 L150 146 L132 104 Z"/>
  <path d="M60 150 L72 282 L94 282 L98 170 L102 170 L106 282 L128 282 L140 150 Q100 162 60 150 Z"/>
</svg>`;

export function bonecoView(p, { mestre = false, linkGuardados = true, compacto = false } = {}) {
  const sis = estado.sistema;
  const equipados = slot => (p.itens || []).filter(i => i.equipado && i.slot === slot);
  const chave = `boneco:${p.id}`;
  const aberto = estado.sel[chave] || null;
  const figura = h('div', { class: 'boneco-figura' });
  figura.innerHTML = DESENHO;
  for (const pt of PONTOS) {
    const slotDef = sis.slots.find(s => s.id === pt.slot);
    if (!slotDef) continue;
    const lista = equipados(pt.slot);
    // Mãos: um item de duas mãos aparece nas duas.
    let itens = lista;
    if (pt.slot === 'maos') {
      const duas = lista.find(i => (i.ocupa ?? 1) >= 2);
      itens = duas ? [duas] : lista[pt.mao] ? [lista[pt.mao]] : [];
    }
    const id = pt.mao != null ? `maos:${pt.mao}` : pt.slot;
    figura.append(h('button', {
      type: 'button', class: `boneco-ponto ${itens.length ? 'cheio' : ''} ${aberto === id ? 'aberto' : ''}`,
      style: { left: `${pt.x}%`, top: `${pt.y}%` }, 'aria-expanded': aberto === id,
      title: `${pt.rotulo}: ${itens.map(i => i.nome).join(', ') || 'vazio'}`,
      onclick: () => { estado.sel[chave] = aberto === id ? null : id; render(); },
    }, h('small', {}, pt.rotulo), h('span', {}, itens.map(i => i.nome).join(', ') || '—')));
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

function painelSlot(p, aberto, mestre) {
  const sis = estado.sistema;
  const slot = aberto.split(':')[0];
  const slotDef = sis.slots.find(s => s.id === slot);
  const noSlot = (p.itens || []).filter(i => i.equipado && i.slot === slot);
  const opcoes = (p.itens || []).filter(i => !i.equipado && i.slot === slot);
  const equipar = async it => {
    // Sem espaço: troca, tirando o que estiver no caminho (primeiro o da mão escolhida).
    const r = podeEquipar(p, it, sis);
    if (!r.ok) {
      const mao = aberto.includes(':') ? parseInt(aberto.split(':')[1], 10) : 0;
      const ordem = [...noSlot.slice(mao), ...noSlot.slice(0, mao)];
      let livre = slotDef.capacidade - noSlot.reduce((s, i) => s + (i.ocupa ?? 1), 0);
      for (const x of ordem) {
        if (livre >= (it.ocupa ?? 1)) break;
        await acao('item.equipar', { id: p.id, uid: x.uid, equipar: false });
        livre += x.ocupa ?? 1;
      }
    }
    await acao('item.equipar', { id: p.id, uid: it.uid, equipar: true });
    aviso(`${it.nome} equipado.`);
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
