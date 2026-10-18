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

// Boneco desenhado (manequim de bronze, com luz e sombra) e uma camada para cada parte do corpo.
// Cada camada só aparece quando a parte está ocupada: capacete, armadura, roupa, capa/mochila, colar e o que está em cada mão.
// (No futuro dá para trocar o desenho genérico por um do próprio item.)
const DESENHO = `<svg viewBox="0 0 200 300" aria-hidden="true" class="silhueta">
  <defs>
    <radialGradient id="bnPele" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#d9b98c"/><stop offset=".6" stop-color="#a77d4f"/><stop offset="1" stop-color="#6e4e2c"/></radialGradient>
    <linearGradient id="bnMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f5f8"/><stop offset=".45" stop-color="#a7adb8"/><stop offset="1" stop-color="#5b616c"/></linearGradient>
    <linearGradient id="bnPano" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5c7fa3"/><stop offset="1" stop-color="#26394f"/></linearGradient>
    <linearGradient id="bnCapa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e2b22"/><stop offset="1" stop-color="#4a120d"/></linearGradient>
    <linearGradient id="bnOuro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#d4a640"/><stop offset="1" stop-color="#7a5615"/></linearGradient>
    <linearGradient id="bnLamina" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c9d2de"/><stop offset="1" stop-color="#7f8a99"/></linearGradient>
    <radialGradient id="bnBrilho" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#d4a640" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="286" rx="58" ry="8" fill="rgba(0,0,0,.45)"/>
  <!-- Costas: capa (atrás do corpo) -->
  <g class="camada camada-costas">
    <path d="M66 70 Q100 60 134 70 L156 232 Q128 246 100 240 Q72 246 44 232 Z" fill="url(#bnCapa)" stroke="#2a0805" stroke-width="1.5"/>
    <path d="M58 122 Q52 170 60 214 M142 122 Q148 170 140 214" stroke="#2a0805" stroke-width="1.2" fill="none" opacity=".6"/>
  </g>
  <!-- Corpo base -->
  <g class="corpo-base" fill="url(#bnPele)" stroke="#3b2814" stroke-width="1.6" stroke-linejoin="round">
    <path d="M62 72 Q48 96 40 140 L30 176 Q32 184 40 180 L52 146 L68 104 Z"/>
    <path d="M138 72 Q152 96 160 140 L170 176 Q168 184 160 180 L148 146 L132 104 Z"/>
    <path d="M60 150 L70 282 Q82 288 94 282 L98 172 L102 172 L106 282 Q118 288 130 282 L140 150 Q100 162 60 150 Z"/>
    <path d="M62 70 Q100 58 138 70 Q146 110 146 150 Q100 164 54 150 Q54 110 62 70 Z"/>
    <rect x="90" y="52" width="20" height="14" rx="5"/>
    <ellipse cx="100" cy="32" rx="21" ry="24"/>
    <circle cx="35" cy="180" r="6"/><circle cx="165" cy="180" r="6"/>
  </g>
  <g fill="none" stroke="#3b2814" stroke-width="1" opacity=".45">
    <path d="M100 76 L100 146 M76 96 Q88 104 100 98 Q112 104 124 96 M82 122 Q100 128 118 122"/>
  </g>
  <!-- Vestimenta: calça e casaco curto com cinto -->
  <g class="camada camada-vestimenta" stroke="#16222f" stroke-width="1.5" stroke-linejoin="round">
    <path d="M58 146 L69 280 Q82 286 95 280 L98 176 L102 176 L105 280 Q118 286 131 280 L142 146 Q100 160 58 146 Z" fill="url(#bnPano)"/>
    <path d="M56 140 Q100 154 144 140 L145 152 Q100 166 55 152 Z" fill="#3a2a18"/>
    <rect x="94" y="144" width="12" height="10" rx="2" fill="url(#bnOuro)" stroke="#5a3d0c"/>
  </g>
  <!-- Armadura: peitoral e ombreiras -->
  <g class="camada camada-corpo" stroke="#2f343c" stroke-width="1.6" stroke-linejoin="round">
    <path d="M60 72 Q100 60 140 72 Q148 108 146 142 Q100 156 54 142 Q52 108 60 72 Z" fill="url(#bnMetal)"/>
    <path d="M100 66 L100 150" stroke="#5b616c" stroke-width="1.2"/>
    <path d="M70 104 Q100 114 130 104 M68 124 Q100 134 132 124" fill="none" stroke="#5b616c" stroke-width="1.2"/>
    <ellipse cx="60" cy="80" rx="15" ry="11" fill="url(#bnMetal)"/>
    <ellipse cx="140" cy="80" rx="15" ry="11" fill="url(#bnMetal)"/>
  </g>
  <!-- Joias: colar com pedra -->
  <g class="camada camada-joia">
    <path d="M86 60 Q100 82 114 60" fill="none" stroke="url(#bnOuro)" stroke-width="3"/>
    <circle cx="100" cy="76" r="9" fill="url(#bnBrilho)"/>
    <path d="M100 70 L106 77 L100 84 L94 77 Z" fill="#3fb6c9" stroke="#7a5615" stroke-width="1.5"/>
  </g>
  <!-- Cabeça: capacete com viseira e crista -->
  <g class="camada camada-cabeca" stroke="#2f343c" stroke-width="1.6" stroke-linejoin="round">
    <path d="M76 38 Q74 6 100 6 Q126 6 124 38 L124 46 Q100 40 76 46 Z" fill="url(#bnMetal)"/>
    <path d="M78 30 L122 30 L122 36 L78 36 Z" fill="#2f343c"/>
    <path d="M96 6 Q100 -6 104 6 L102 24 L98 24 Z" fill="#8e2b22" stroke="#4a120d"/>
  </g>
  <!-- Mão direita (à esquerda da tela): arma, escudo ou item -->
  <g class="camada camada-m0-arma" stroke="#2f343c" stroke-width="1.4" stroke-linejoin="round">
    <path d="M33 186 L14 262 L20 266 L39 188 Z" fill="url(#bnLamina)"/>
    <path d="M24 176 L46 186 L44 191 L22 181 Z" fill="url(#bnOuro)"/>
    <rect x="31" y="166" width="8" height="14" rx="2" fill="#3a2a18" transform="rotate(14 35 173)"/>
  </g>
  <g class="camada camada-m0-escudo" stroke="#2f343c" stroke-width="1.6">
    <path d="M14 160 L56 160 L54 196 Q35 216 16 196 Z" fill="url(#bnMetal)"/>
    <path d="M35 164 L35 206 M18 178 L52 178" stroke="#8e2b22" stroke-width="4"/>
  </g>
  <g class="camada camada-m0-item"><circle cx="35" cy="186" r="9" fill="url(#bnBrilho)"/><rect x="29" y="182" width="12" height="12" rx="3" fill="#7a5a32" stroke="#3a2a18" stroke-width="1.4"/></g>
  <!-- Mão esquerda (à direita da tela) -->
  <g class="camada camada-m1-arma" stroke="#2f343c" stroke-width="1.4" stroke-linejoin="round">
    <path d="M167 186 L186 262 L180 266 L161 188 Z" fill="url(#bnLamina)"/>
    <path d="M176 176 L154 186 L156 191 L178 181 Z" fill="url(#bnOuro)"/>
    <rect x="161" y="166" width="8" height="14" rx="2" fill="#3a2a18" transform="rotate(-14 165 173)"/>
  </g>
  <g class="camada camada-m1-escudo" stroke="#2f343c" stroke-width="1.6">
    <path d="M144 160 L186 160 L184 196 Q165 216 146 196 Z" fill="url(#bnMetal)"/>
    <path d="M165 164 L165 206 M148 178 L182 178" stroke="#8e2b22" stroke-width="4"/>
  </g>
  <g class="camada camada-m1-item"><circle cx="165" cy="186" r="9" fill="url(#bnBrilho)"/><rect x="159" y="182" width="12" height="12" rx="3" fill="#7a5a32" stroke="#3a2a18" stroke-width="1.4"/></g>
  <!-- Arma de duas mãos: atravessada na frente do corpo -->
  <g class="camada camada-duas" stroke="#2f343c" stroke-width="1.4" stroke-linejoin="round">
    <path d="M28 196 L170 52 L176 58 L34 202 Z" fill="#5a3d1e"/>
    <path d="M166 56 L190 30 L184 24 L160 48 Z" fill="url(#bnLamina)"/>
    <path d="M150 52 L172 74 L176 70 L154 48 Z" fill="url(#bnOuro)"/>
  </g>
</svg>`;

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
  figura.innerHTML = DESENHO;
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
