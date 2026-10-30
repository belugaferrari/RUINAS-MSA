// Boneco do personagem: mostra o que está equipado em cada parte do corpo e deixa equipar/trocar ali mesmo.
import { h, botao, aviso, icone, titulo, janela } from '../ui.js';
import { estado, render, mudar } from '../estado.js';
import { acao, enviarArquivo } from '../api.js';
import { podeEquipar, derivados, textoIp, textoBonus, tipoDaArma } from '/shared/regras.js';
import { ICONE_ARMA } from './fx.js';
import { ICONE_TIPO } from './ficha.js';
import { cartaoItem } from './inventarioExpandido.js';

// Painel de equipamento (no estilo das telas de inventário de jogo): o nome no alto, a imagem de corpo inteiro do
// personagem no meio sobre um pedestal (enviada pelo jogador ou pelo mestre; sem ela, a figura padrão pelo gênero) e,
// em volta, uma moldura para cada parte do corpo com o item equipado: ícone na cor da raridade, um número de destaque
// (IP, dano…) e o "i" para ver tudo do item. Clicar na moldura abre o painel para equipar/trocar.
const ESQUERDA = [
  { id: 'cabeca', slot: 'cabeca', rotulo: 'Cabeça', icone: 'hard-hat' },
  { id: 'costas', slot: 'costas', rotulo: 'Costas', icone: 'backpack' },
  { id: 'corpo', slot: 'corpo', rotulo: 'Corpo', icone: 'shield', alto: true },
  { id: 'vestimenta', slot: 'vestimenta', rotulo: 'Vestimenta', icone: 'shirt' },
];
const DIREITA = [
  { id: 'm0', slot: 'maos', mao: 0, rotulo: 'Mão direita', icone: 'hand', alto: true },
  { id: 'm1', slot: 'maos', mao: 1, rotulo: 'Mão esquerda', icone: 'hand' },
];
const FIGURA_PADRAO = { masculino: '/img/boneco-masculino.webp', feminino: '/img/boneco-feminino.webp' };
const COR_RARIDADE = { Mundano: '#9a948a', Comum: '#cfc8bb', Incomum: '#62d16e', Raro: '#4f9dff', 'Raríssimo': '#b06bff', 'Lendário': '#ffb02e', 'Único': '#ff6a3a', Ilegal: '#e0405a' };

// Que tipo de coisa está em cada mão: arma, escudo (proteção) ou um item qualquer.
const tipoNaMao = it => (it.tipo === 'arma' ? 'arma' : it.tipo === 'defesa' || /escudo/i.test(it.nome) ? 'escudo' : 'item');

// Partes que acabaram de ser ocupadas brilham por um instante ("equipado!").
const ocupacaoVista = new Map();
const recem = new Map();
function marcarNovos(p, ocupadas) {
  const antes = ocupacaoVista.get(p.id);
  if (antes) for (const c of ocupadas) if (!antes.has(c)) { recem.set(`${p.id}:${c}`, Date.now()); setTimeout(render, 1700); }
  ocupacaoVista.set(p.id, new Set(ocupadas));
}

// Número de destaque do item na moldura (como o "+12" do exemplo).
function destaque(i) {
  if (!i) return null;
  if (i.dano || i.danoTexto) return i.dano || i.danoTexto;
  const ip = textoIp(i);
  if (ip) return ip.split(' · ')[0];
  const b = textoBonus(i).split(' · ')[0];
  if (b) return b;
  return null;
}

export function bonecoView(p, { mestre = false, linkGuardados = true, compacto = false } = {}) {
  const sis = estado.sistema;
  const chave = `boneco:${p.id}`;
  const aberto = estado.sel[chave] || null;
  const tem = slot => sis.slots.some(s => s.id === slot);
  const equipados = slot => (p.itens || []).filter(i => i.equipado && i.slot === slot);
  const ocupadas = [...ESQUERDA, ...DIREITA].filter(x => tem(x.slot) && (x.mao != null ? naMao(p, x.mao) : equipados(x.slot).length)).map(x => x.id);
  const joias = equipados('joia');
  if (joias.length) ocupadas.push('joia');
  marcarNovos(p, ocupadas);
  const agora = Date.now();
  const novo = id => agora - (recem.get(`${p.id}:${id}`) || 0) < 1600;
  const abrir = id => () => { estado.sel[chave] = aberto === id ? null : id; render(); };
  const info = i => ev => { ev.stopPropagation(); janela(i.nome, cartaoItem(p, i, mestre), [['Fechar', () => true]]); };

  // Uma moldura: item (ícone na cor da raridade, nome, destaque e "i") ou vazia (ícone apagado e o nome da parte).
  const moldura = (x, item, { pequena = false, extra = '' } = {}) => {
    const id = x.mao != null ? `maos:${x.mao}` : x.slot;
    const cor = item ? COR_RARIDADE[item.raridade] || '#c9a45c' : null;
    const duas = item && x.slot === 'maos' && (item.ocupa ?? 1) >= 2;
    // Na mão, o desenho segue o tipo da arma (lâmina, machado, martelo, arma de fogo, projétil, desarmado).
    const ic = item ? (x.slot === 'maos' ? (tipoNaMao(item) === 'arma' ? ICONE_ARMA[tipoDaArma(item)] || 'sword' : { escudo: 'shield', item: ICONE_TIPO[item.tipo] || 'package' }[tipoNaMao(item)]) : ICONE_TIPO[item.tipo] || x.icone) : x.icone;
    const hab = x.mao != null && maoHabil(p) === x.mao;
    const cls = `equip-slot ${x.alto ? 'alto' : ''} ${pequena ? 'pequena' : ''} ${item ? 'cheio' : 'vazio'} ${novo(x.id) ? 'novo' : ''} ${aberto === id ? 'aberto' : ''} ${extra}`;
    return h('div', { class: cls, style: cor ? { '--rar': cor } : null },
      h('button', {
        type: 'button', class: 'equip-botao', onclick: abrir(id),
        title: `${x.rotulo}${hab ? ' (mão hábil)' : ''}: ${item ? `${item.nome}${duas ? ' (duas mãos)' : ''}` : 'vazio'}`,
        'aria-label': `${x.rotulo}: ${item ? item.nome : 'vazio'}`,
      },
        h('span', { class: 'equip-icone' }, icone(ic)),
        destaque(item) ? h('span', { class: 'equip-destaque' }, destaque(item)) : null,
        pequena ? null : h('span', { class: 'equip-nome' }, item ? item.nome : x.rotulo),
        hab && !pequena ? h('span', { class: 'equip-habil', title: 'Mão hábil' }, '★') : null),
      item ? h('button', { type: 'button', class: 'equip-info', title: `Ver tudo de ${item.nome}`, 'aria-label': `Ver tudo de ${item.nome}`, onclick: info(item) }, 'i') : null);
  };
  const slotDe = x => {
    if (!tem(x.slot)) return null;
    const item = x.mao != null ? naMao(p, x.mao) : equipados(x.slot)[0];
    return moldura(x, item);
  };
  const capJoia = sis.slots.find(s => s.id === 'joia')?.capacidade || 0;
  const blocoJoias = capJoia ? h('div', { class: 'equip-joias', role: 'group', 'aria-label': 'Joias' },
    Array.from({ length: Math.min(4, capJoia) }, (_, k) => moldura({ id: 'joia', slot: 'joia', rotulo: `Joia ${k + 1}`, icone: 'gem' }, joias[k], { pequena: true }))) : null;

  const figuraUrl = p.imagemCorpo || FIGURA_PADRAO[p.genero === 'feminino' ? 'feminino' : 'masculino'];
  const podeEnviar = mestre || estado.campanha.papel === 'mestre' || p.donoId === estado.usuario.id;
  const arquivo = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async e => {
    const f = e.target.files[0];
    if (!f) return;
    const form = new FormData();
    form.append('arquivo', f);
    try { await enviarArquivo(`/api/campanhas/${estado.campanha.id}/personagens/${p.id}/corpo`, form); aviso('Imagem de corpo inteiro atualizada.'); } catch (err) { aviso(err.message, 'erro'); }
  } });
  const d = derivados(p, sis);
  const guardados = (p.itens || []).filter(i => !i.equipado);
  return h('div', { class: `boneco equip ${compacto ? 'compacto' : ''}` },
    h('div', { class: 'equip-painel' },
      h('div', { class: 'equip-titulo' },
        h('span', { class: 'equip-nivel', title: 'Nível' }, String(p.nivel || 1)),
        h('strong', {}, p.nome),
        h('span', { class: 'equip-stats' },
          h('span', { title: 'IP (proteção dos itens equipados)' }, icone('shield'), ` ${d.defesa}`),
          h('span', { title: `Carga ${d.carga.toFixed(1)} kg de ${d.cargaCapacidade} kg` }, icone('weight'), ` ${d.carga.toFixed(1)}`))),
      h('div', { class: 'equip-grade' },
        h('div', { class: 'equip-coluna' }, ESQUERDA.map(slotDe)),
        h('div', { class: 'equip-centro' },
          h('div', { class: 'equip-figura' }, h('img', { src: figuraUrl, alt: '', draggable: 'false', class: p.imagemCorpo ? 'propria' : 'padrao' })),
          h('div', { class: 'equip-pedestal', 'aria-hidden': 'true' }),
          podeEnviar ? [arquivo, botao('', () => arquivo.click(), { class: 'pequeno equip-enviar', icone: 'image', title: 'Enviar a imagem de corpo inteiro do personagem' })] : null),
        h('div', { class: 'equip-coluna' }, blocoJoias, DIREITA.map(slotDe)))),
    aberto ? painelSlot(p, aberto, mestre) : compacto ? null : h('p', { class: 'dica' }, icone('info'), ' Toque numa moldura para equipar ou trocar; no "i" para ver tudo do item.'),
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
    const r = await acao('item.equipar', { id: p.id, uid: it.uid, equipar: true, mao });
    if (r?.aviso) aviso(r.aviso, 'erro');
    aviso(`${it.nome} equipado${slot === 'maos' && (it.ocupa ?? 1) < 2 ? ` na mão ${mao === 1 ? 'esquerda' : 'direita'}` : ''}.`);
  };
  return h('div', { class: 'boneco-painel' },
    titulo(`${slotDef.nome} (${noSlot.reduce((s, i) => s + (i.ocupa ?? 1), 0)}/${slotDef.capacidade})`, 'shirt', 'h4'),
    noSlot.length ? h('ul', { class: 'lista-inline' }, noSlot.map(i => h('li', {}, i.nome,
      i.capacidade ? h('small', {}, ` (${i.carregada || 0}/${i.capacidade})`) : null,
      botao('', () => janela(i.nome, cartaoItem(p, i, mestre), [['Fechar', () => true]]), { class: 'pequeno', icone: 'info', title: `Ver tudo de ${i.nome}` }),
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
