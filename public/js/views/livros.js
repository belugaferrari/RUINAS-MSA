import { h, botao, selecao, aviso, vazio } from '../ui.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { marked } from '/vendor/marked.js';

const cacheLivros = {};

// HTML cru escrito no texto aparece como texto (evita scripts injetados no Lore).
const escapar = t => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
marked.use({ renderer: { html: token => escapar(typeof token === 'string' ? token : token.text) } });

function filtroBusca(chave, placeholder) {
  return h('input', {
    type: 'search', placeholder, 'data-key': `busca:${chave}`, value: estado.sel[`busca:${chave}`] || '',
    oninput: e => { estado.sel[`busca:${chave}`] = e.target.value; render(); },
  });
}

const busca = chave => (estado.sel[`busca:${chave}`] || '').toLowerCase().trim();

export function markdown(texto) {
  const div = h('div', { class: 'texto-livro' });
  div.innerHTML = marked.parse(texto || '');
  for (const a of div.querySelectorAll('a[href]')) {
    if (!/^(https?:|#|\/)/i.test(a.getAttribute('href'))) a.removeAttribute('href');
    else if (/^https?:/i.test(a.getAttribute('href'))) a.target = '_blank';
  }
  for (const img of div.querySelectorAll('img[src]')) if (!/^(https?:|\/)/i.test(img.getAttribute('src'))) img.remove();
  return div;
}

export function livroView(nome, titulo) {
  if (!(nome in cacheLivros)) {
    cacheLivros[nome] = null;
    fetch(`/api/livro/${nome}`).then(r => r.text()).then(t => { cacheLivros[nome] = t; render(); })
      .catch(() => { cacheLivros[nome] = '# Erro\nNão foi possível carregar o livro.'; render(); });
  }
  const texto = cacheLivros[nome];
  if (texto == null) return h('p', {}, 'Carregando…');

  const corpo = markdown(texto);
  const q = busca(nome);
  // Índice a partir dos títulos; a busca esconde as seções que não têm o termo.
  const titulos = [...corpo.querySelectorAll('h1, h2, h3')];
  titulos.forEach((t, i) => { t.id = `${nome}-${i}`; });
  if (q) {
    let secao = [];
    const secoes = [];
    for (const el of [...corpo.children]) {
      if (/^H[12]$/.test(el.tagName) && secao.length) { secoes.push(secao); secao = []; }
      secao.push(el);
    }
    secoes.push(secao);
    for (const s of secoes) if (!s.some(el => el.textContent.toLowerCase().includes(q))) s.forEach(el => { el.hidden = true; });
  }
  return h('div', { class: 'livro' },
    h('aside', { class: 'indice' },
      h('h3', {}, titulo),
      filtroBusca(nome, 'Buscar no livro…'),
      h('ul', {}, titulos.filter(t => !t.closest('[hidden]') && !t.hidden).map(t => h('li', { class: t.tagName.toLowerCase() },
        h('a', { href: `#${t.id}`, onclick: e => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }); } }, t.textContent))))),
    corpo);
}

export function monstrosView() {
  const mestre = estado.campanha.papel === 'mestre';
  const q = busca('monstros');
  const lista = estado.sistema.monstros.filter(m => !q || JSON.stringify(m).toLowerCase().includes(q));
  return h('div', {},
    h('div', { class: 'barra' }, h('h2', {}, 'Livro dos Monstros'), h('span', { class: 'espaco' }), filtroBusca('monstros', 'Buscar criatura…')),
    lista.length ? h('div', { class: 'cartoes' }, lista.map(m => h('div', { class: 'cartao' },
      h('h3', {}, m.nome),
      h('p', { class: 'meta' }, `Dificuldade ${m.dificuldade} · PV ${m.pv} · Defesa ${m.defesa}`),
      h('p', {}, h('strong', {}, 'Ataque: '), m.ataque),
      h('p', {}, m.descricao),
      mestre ? botao('Colocar no Campo de Batalha', async () => {
        await acao('monstro.adicionar', { nome: m.nome });
        aviso(`${m.nome} entrou no Campo de Batalha.`);
      }, { class: 'pequeno' }) : null))) : vazio('Nenhuma criatura encontrada.'));
}

export function classesView() {
  const q = busca('classes');
  const lista = estado.sistema.classes.filter(c => !q || JSON.stringify(c).toLowerCase().includes(q));
  return h('div', {},
    h('div', { class: 'barra' }, h('h2', {}, 'Classes'), h('span', { class: 'espaco' }), filtroBusca('classes', 'Buscar classe…')),
    h('div', { class: 'cartoes' }, lista.map(c => h('div', { class: 'cartao' },
      h('h3', {}, c.nome),
      h('p', {}, c.descricao),
      c.escolhas?.length ? h('ul', {}, c.escolhas.map(e => h('li', {}, h('strong', {}, `${e.rotulo} (escolha ${e.quantidade}): `), e.opcoes.join(', ')))) : null))));
}

const TIPOS = { arma: 'Arma', defesa: 'Defesa', vestimenta: 'Vestimenta', joia: 'Joia', armadilha: 'Armadilha', geral: 'Geral' };

// Catálogo de itens. Com "compra", mostra o botão de comprar para o personagem escolhido.
export function lojaView({ titulo = 'Loja', tipos = null } = {}) {
  const c = estado.campanha;
  const sis = estado.sistema;
  const mestre = c.papel === 'mestre';
  const q = busca('loja');
  const tipoSel = estado.sel.lojaTipo || '';
  const itens = sis.itens.filter(i => (!tipos || tipos.includes(i.tipo)) && (!tipoSel || i.tipo === tipoSel) && (!q || i.nome.toLowerCase().includes(q)));
  const compradores = mestre ? c.personagens.filter(p => p.tipo === 'pj') : meusPersonagens();
  const compradorId = estado.sel.comprador || estado.sel.personagem || compradores[0]?.id || '';
  const comprador = personagemPorId(compradorId);
  const podeComprar = comprador && (mestre || c.lojaAberta);
  const slotNome = id => sis.slots.find(s => s.id === id)?.nome || '—';

  return h('div', {},
    h('div', { class: 'barra' },
      h('h2', {}, titulo),
      mestre ? h('label', { class: 'linha' },
        h('input', { type: 'checkbox', checked: c.lojaAberta, onchange: e => acao('campanha.atualizar', { lojaAberta: e.target.checked }) }),
        'Loja liberada para os jogadores') : h('span', { class: `selo ${c.lojaAberta ? 'ok' : 'perigo'}` }, c.lojaAberta ? 'Loja aberta' : 'Loja fechada pelo mestre'),
      h('span', { class: 'espaco' }),
      tipos ? null : selecao([{ valor: '', rotulo: 'Todos os tipos' }, ...Object.entries(TIPOS).map(([v, r]) => ({ valor: v, rotulo: r }))], tipoSel, v => { estado.sel.lojaTipo = v; render(); }),
      filtroBusca('loja', 'Buscar item…')),
    compradores.length ? h('div', { class: 'barra' },
      h('span', {}, mestre ? 'Comprar/dar para:' : 'Comprar para:'),
      selecao(compradores.map(p => ({ valor: p.id, rotulo: p.nome })), compradorId, v => { estado.sel.comprador = v; render(); }),
      comprador ? h('span', { class: 'selo' }, `Dinheiro: ${comprador.dinheiro ?? 0}`) : null) : null,
    h('table', { class: 'tabela' },
      h('thead', {}, h('tr', {}, ['Item', 'Tipo', 'Slot', 'Preço', 'Venda', 'Durab.', 'Peso', 'Dano/Def.', 'Bônus', ''].map(t => h('th', {}, t)))),
      h('tbody', {}, itens.map(i => h('tr', {},
        h('td', {}, i.nome), h('td', {}, TIPOS[i.tipo] || i.tipo), h('td', {}, slotNome(i.slot), i.ocupa > 1 ? ` (${i.ocupa})` : ''),
        h('td', {}, i.preco), h('td', {}, i.venda), h('td', {}, i.durabilidade), h('td', {}, i.peso),
        h('td', {}, [i.dano, i.defesa ? `Def ${i.defesa}` : null].filter(Boolean).join(' · ') || '—'),
        h('td', {}, Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—'),
        h('td', { class: 'acoes' },
          podeComprar ? botao('Comprar', async () => {
            await acao('item.comprar', { id: comprador.id, itemId: i.id });
            aviso(`${i.nome} comprado para ${comprador.nome}.`);
          }, { class: 'pequeno primario' }) : null,
          mestre && comprador ? botao('Dar', async () => {
            await acao('item.adicionar', { id: comprador.id, itemId: i.id });
            aviso(`${i.nome} entregue a ${comprador.nome}.`);
          }, { class: 'pequeno' }) : null))))));
}
