// Inventário expandido: tela cheia com um cartão por item mostrando tudo o que importa —
// durabilidade, peso, preço e venda, maestria, slot, dano/defesa, alcance, munição, efeitos, bônus, requisitos,
// produção… Filtra (todos, equipados, guardados), ordena e busca. Abre por cima da ficha e acompanha as mudanças.
import { h, botao, icone, confirmar, aviso } from '../ui.js';
import { estado, render } from '../estado.js';
import { acao } from '../api.js';
import { derivados, slotsOcupados } from '/shared/regras.js';
import { ICONE_TIPO, cargaView } from './ficha.js';
import { maoDoItem } from './boneco.js';

const COR_RARIDADE = { Mundano: '#9a948a', Comum: '#cfc8bb', Incomum: '#62d16e', Raro: '#4f9dff', 'Raríssimo': '#b06bff', 'Lendário': '#ffb02e', 'Único': '#ff6a3a', Ilegal: '#e0405a' };
const NOME_TIPO = {
  arma: 'Arma', defesa: 'Defesa', vestimenta: 'Vestimenta', joia: 'Joia', armadilha: 'Armadilha', geral: 'Geral', municao: 'Munição', cibernetico: 'Cibernético',
  ferramenta: 'Ferramenta', alimento: 'Alimento', boticario: 'Boticário', transporte: 'Transporte', materia: 'Matéria-prima', energia: 'Energia',
};
const ORDENS = [
  ['nome', 'Nome', (a, b) => a.nome.localeCompare(b.nome)],
  ['peso', 'Peso', (a, b) => (b.peso || 0) - (a.peso || 0)],
  ['venda', 'Valor de venda', (a, b) => (b.venda || 0) - (a.venda || 0)],
  ['durabilidade', 'Durabilidade', (a, b) => fracDur(a) - fracDur(b)],
  ['raridade', 'Raridade', (a, b) => Object.keys(COR_RARIDADE).indexOf(b.raridade) - Object.keys(COR_RARIDADE).indexOf(a.raridade)],
];
const fracDur = i => (i.durabilidade ? (i.durabilidadeAtual ?? i.durabilidade) / i.durabilidade : 1);

export const abrirInventario = p => { estado.sel.invExpandido = p.id; render(); };
const fechar = () => { estado.sel.invExpandido = null; render(); };

export function botaoExpandir(p) {
  return botao('Ver expandido', () => abrirInventario(p), { class: 'pequeno', icone: 'maximize-2', title: `Ver todos os detalhes dos itens de ${p.nome}` });
}

// Chamada dentro do inventário: se a tela expandida deste personagem estiver aberta, desenha por cima de tudo.
export function inventarioExpandido(p, mestre) {
  if (estado.sel.invExpandido !== p.id) return null;
  const sis = estado.sistema;
  const f = (estado.sel.invFiltro ||= { ver: 'todos', ordem: 'nome', busca: '' });
  const d = derivados(p, sis);
  const uso = slotsOcupados(p);
  const todos = p.itens || [];
  const busca = f.busca.trim().toLowerCase();
  const lista = todos
    .filter(i => (f.ver === 'todos' || (f.ver === 'equipados') === !!i.equipado))
    .filter(i => !busca || [i.nome, i.descricao, i.efeitos, i.categoria, i.raridade, i.qualidade].some(x => String(x || '').toLowerCase().includes(busca)))
    .sort((ORDENS.find(o => o[0] === f.ordem) || ORDENS[0])[2]);
  const total = (k, l = todos) => l.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  const filtroBotao = (id, rotulo, n) => botao(`${rotulo} (${n})`, () => { f.ver = id; render(); }, { class: `pequeno ${f.ver === id ? 'primario' : ''}`, 'aria-pressed': f.ver === id });
  const tela = h('div', { class: 'inv-xl-fundo', onclick: e => e.target === e.currentTarget && fechar() },
    h('div', { class: 'inv-xl', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Inventário de ${p.nome}` },
      h('header', { class: 'inv-xl-topo' },
        h('div', { class: 'inv-xl-titulo' },
          h('h2', {}, icone('backpack'), ` Inventário de ${p.nome}`),
          h('span', { class: 'selo moeda' }, icone('coins'), ` ${p.dinheiro ?? 0} ${sis.moeda || 'créditos'}`),
          h('span', { class: 'espaco' }),
          botao('', fechar, { class: 'so-icone', icone: 'x', 'aria-label': 'Fechar', title: 'Fechar (Esc)' })),
        cargaView(d),
        h('div', { class: 'slots' }, sis.slots.map(s => h('span', { class: `selo ${(uso[s.id] || 0) >= s.capacidade ? 'cheio' : ''}` }, `${s.nome} ${uso[s.id] || 0}/${s.capacidade}`))),
        h('div', { class: 'inv-xl-ferramentas' },
          h('div', { class: 'barra', role: 'group', 'aria-label': 'Mostrar' },
            filtroBotao('todos', 'Todos', todos.length), filtroBotao('equipados', 'Equipados', todos.filter(i => i.equipado).length), filtroBotao('guardados', 'Guardados', todos.filter(i => !i.equipado).length)),
          h('label', { class: 'mini' }, 'Ordenar',
            h('select', { 'aria-label': 'Ordenar por', onchange: e => { f.ordem = e.target.value; render(); } },
              ORDENS.map(([id, rot]) => h('option', { value: id, selected: f.ordem === id }, rot)))),
          h('input', { type: 'search', class: 'inv-xl-busca', placeholder: 'Buscar item, efeito, raridade…', value: f.busca, 'aria-label': 'Buscar no inventário', 'data-key': `inv-busca:${p.id}`,
            oninput: e => { f.busca = e.target.value; render(); } }))),
      h('div', { class: 'inv-xl-grade' },
        lista.length ? lista.map(i => cartaoItem(p, i, mestre)) : h('p', { class: 'dica' }, todos.length ? 'Nenhum item com esse filtro.' : 'Nenhum item.')),
      h('footer', { class: 'inv-xl-rodape' },
        h('span', {}, icone('package'), ` ${lista.length} de ${todos.length} itens`),
        h('span', {}, icone('weight'), ` ${total('peso', lista).toFixed(1)} kg`),
        h('span', {}, icone('coins'), ` venda ${total('venda', lista)} · preço ${total('preco', lista)}`))));
  return tela;
}

function cartaoItem(p, i, mestre) {
  const sis = estado.sistema;
  const cor = COR_RARIDADE[i.raridade] || '#8a7a62';
  const durAtual = i.durabilidadeAtual ?? i.durabilidade;
  const fr = fracDur(i);
  const slot = sis.slots.find(s => s.id === i.slot);
  const onde = i.equipado
    ? (i.slot === 'maos' ? ((i.ocupa ?? 1) >= 2 ? 'Nas duas mãos' : maoDoItem(p, i) === 1 ? 'Na mão esquerda' : 'Na mão direita') : `Em: ${slot?.nome || i.slot}`)
    : 'Guardado';
  const pericia = i.pericia ? nomePericia(i.pericia, sis) : null;
  const atributo = (rotulo, valor, ic, extra = null) => (valor === undefined || valor === null || valor === '' ? null
    : h('div', { class: 'inv-attr' }, h('small', {}, icone(ic), ` ${rotulo}`), h('strong', {}, valor), extra));
  const texto = (rotulo, valor, ic) => (valor ? h('div', { class: 'inv-texto' }, h('small', {}, icone(ic), ` ${rotulo}`), h('p', {}, valor)) : null);
  const bonus = Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ');
  const producao = i.producao && (i.producao.pericia || i.producao.nd || i.producao.obs)
    ? [i.producao.pericia, i.producao.nd ? `ND ${i.producao.nd}` : null, i.producao.obs].filter(Boolean).join(' · ') : null;
  return h('article', { class: `inv-cartao ${i.equipado ? 'equipado' : ''}`, style: { '--rar': cor } },
    h('header', {},
      h('span', { class: 'inv-icone' }, icone(ICONE_TIPO[i.tipo] || 'tag')),
      h('div', { class: 'inv-nome' },
        h('strong', {}, i.nome),
        h('small', {}, [NOME_TIPO[i.tipo] || i.tipo, i.categoria, i.subcategoria].filter(Boolean).join(' · '))),
      h('div', { class: 'inv-selos' },
        i.raridade ? h('span', { class: 'inv-raridade' }, i.raridade) : null,
        i.qualidade ? h('span', { class: 'selo' }, i.qualidade) : null)),
    h('p', { class: `inv-onde ${i.equipado ? 'ok' : ''}` }, icone(i.equipado ? 'shirt' : 'backpack'), ` ${onde}`),
    i.durabilidade ? h('div', { class: 'inv-dur', title: `Durabilidade ${durAtual}/${i.durabilidade}` },
      h('small', {}, icone('shield-half'), ' Durabilidade'),
      h('div', { class: `inv-dur-barra ${fr <= .25 ? 'baixa' : fr <= .5 ? 'media' : ''}` }, h('span', { style: { width: `${Math.max(0, Math.min(100, fr * 100))}%` } })),
      h('strong', {}, `${durAtual}/${i.durabilidade}`),
      mestre ? h('span', { class: 'inv-dur-botoes' },
        botao('', () => acao('item.durabilidade', { id: p.id, uid: i.uid, valor: Math.max(0, durAtual - 1) }), { class: 'pequeno', icone: 'minus', title: `Gastar 1 de durabilidade de ${i.nome}` }),
        botao('', () => acao('item.durabilidade', { id: p.id, uid: i.uid, valor: Math.min(i.durabilidade, durAtual + 1) }), { class: 'pequeno', icone: 'plus', title: `Consertar 1 de durabilidade de ${i.nome}` })) : null) : null,
    h('div', { class: 'inv-attrs' },
      atributo('Peso', i.peso != null ? `${i.peso} kg` : null, 'weight'),
      atributo('Preço', i.preco, 'tag'),
      atributo('Venda', i.venda, 'coins'),
      atributo('Maestria', i.maestria != null ? String(i.maestria) : null, 'graduation-cap'),
      atributo('Slot', slot ? `${slot.nome}${(i.ocupa ?? 1) > 1 ? ` (${i.ocupa})` : ''}` : null, 'shirt'),
      atributo('Dano', i.dano || i.danoTexto ? `${i.dano || i.danoTexto}${i.tipoDano ? ` ${i.tipoDano}` : ''}` : null, 'swords'),
      atributo('Defesa', i.defesa ? `IP ${i.defesa}` : null, 'shield'),
      atributo('Alcance', i.alcance ? (i.alcance === 'corpo' ? 'Corpo a corpo' : i.alcance) : null, 'ruler'),
      atributo('Penetração', i.penetracao, 'crosshair'),
      atributo('Munição', i.capacidade ? `${i.carregada || 0}/${i.capacidade}` : i.tipo === 'municao' ? `${i.quantidade || 0} (${i.municao})` : null, 'target'),
      atributo('Perícia', pericia, 'dumbbell'),
      mestre ? atributo('ND identificar', i.ndIdentificar, 'search') : null),
    texto('Efeitos', [i.efeitos, i.efeitosObs].filter(Boolean).join(' — '), 'sparkles'),
    texto('Bônus', bonus, 'trending-up'),
    texto('Requisitos', i.requisitos, 'lock'),
    texto('Observações', i.observacoes, 'info'),
    texto('Descrição', i.descricao, 'book-open'),
    texto('Aparência', i.aparencia, 'eye'),
    texto('Produção', producao, 'hammer'),
    h('footer', { class: 'barra' },
      i.slot ? botao(i.equipado ? 'Desequipar' : 'Equipar', () => acao('item.equipar', { id: p.id, uid: i.uid, equipar: !i.equipado }), { class: i.equipado ? 'pequeno' : 'primario pequeno', icone: i.equipado ? 'x' : 'shirt' }) : null,
      (mestre || estado.campanha.lojaAberta) ? botao('Vender', async () => {
        if (await confirmar(`Vender ${i.nome} por ${i.venda ?? 0}?`)) await acao('item.vender', { id: p.id, uid: i.uid });
      }, { class: 'pequeno', icone: 'coins' }) : null,
      botao('Descartar', async () => {
        if (await confirmar(`Descartar ${i.nome}?`)) { await acao('item.remover', { id: p.id, uid: i.uid }); aviso(`${i.nome} descartado.`); }
      }, { class: 'pequeno perigo', icone: 'trash-2' })));
}

function nomePericia(id, sis) {
  for (const p of sis.pericias || []) {
    if (p.id === id) return p.nome;
    const s = (p.subpericias || []).find(x => x.id === id);
    if (s) return `${p.nome} · ${s.nome}`;
  }
  return id;
}

// Esc fecha a tela expandida.
document.addEventListener('keydown', e => { if (e.key === 'Escape' && estado.sel.invExpandido && !document.querySelector('#janela .fundo')) fechar(); });
