import { h, botao, selecao, aviso, vazio, icone, titulo, tabela, abas, seloRevisao } from '../ui.js';
import { ICONE_TIPO } from './ficha.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { marked } from '/vendor/marked.js';

const cacheLivros = {};

// HTML cru escrito no texto aparece como texto (evita scripts injetados no Lore).
const escapar = t => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
marked.use({ renderer: { html: token => escapar(typeof token === 'string' ? token : token.text) } });
// ==texto== = trecho grifado no livro (ainda em revisão).
marked.use({
  extensions: [{
    name: 'grifo', level: 'inline',
    start: src => src.indexOf('=='),
    tokenizer(src) {
      const m = /^==([^=\n]+?)==/.exec(src);
      if (m) return { type: 'grifo', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
      return undefined;
    },
    renderer(token) { return `<mark class="revisao" title="Grifado no livro: ainda pode mudar">${this.parser.parseInline(token.tokens)}</mark>`; },
  }],
});

// Livros grandes: o HTML convertido fica em cache por texto.
const cacheHtml = new Map();

function filtroBusca(chave, placeholder) {
  return h('input', {
    type: 'search', placeholder, 'data-key': `busca:${chave}`, value: estado.sel[`busca:${chave}`] || '',
    oninput: e => { estado.sel[`busca:${chave}`] = e.target.value; render(); },
  });
}

const busca = chave => (estado.sel[`busca:${chave}`] || '').toLowerCase().trim();

export function markdown(texto) {
  const div = h('div', { class: 'texto-livro' });
  let html = cacheHtml.get(texto);
  if (html == null) {
    html = marked.parse(texto || '');
    if ((texto || '').length > 5000) cacheHtml.set(texto, html);
  }
  div.innerHTML = html;
  for (const a of div.querySelectorAll('a[href]')) {
    if (!/^(https?:|#|\/)/i.test(a.getAttribute('href'))) a.removeAttribute('href');
    else if (/^https?:/i.test(a.getAttribute('href'))) a.target = '_blank';
  }
  for (const img of div.querySelectorAll('img[src]')) if (!/^(https?:|\/)/i.test(img.getAttribute('src'))) img.remove();
  return div;
}

export function livroView(nome, nomeLivro) {
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
  // No celular o índice começa recolhido para o texto aparecer logo.
  const chaveIndice = `indice:${nome}`;
  if (!(chaveIndice in estado.sel)) estado.sel[chaveIndice] = !matchMedia('(max-width: 860px)').matches;
  return h('div', { class: 'livro' },
    h('aside', { class: 'indice' },
      titulo(nomeLivro, nome === 'mestre' ? 'library' : 'book-open'),
      h('label', { class: 'busca' }, icone('search'), filtroBusca(nome, 'Buscar no livro…')),
      h('details', { open: estado.sel[chaveIndice], ontoggle: e => { estado.sel[chaveIndice] = e.target.open; } },
        h('summary', {}, icone('bookmark'), 'Índice'),
        h('ul', {}, titulos.filter(t => !t.closest('[hidden]') && !t.hidden).map(t => h('li', { class: t.tagName.toLowerCase() },
        h('a', { href: `#${t.id}`, onclick: e => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }); } }, t.textContent)))))),
    corpo);
}

export function monstrosView() {
  const mestre = estado.campanha.papel === 'mestre';
  const q = busca('monstros');
  const lista = estado.sistema.monstros.filter(m => !q || JSON.stringify(m).toLowerCase().includes(q));
  return h('div', {},
    h('div', { class: 'barra' }, titulo('Livro dos Monstros', 'skull', 'h2'), h('span', { class: 'espaco' }), h('label', { class: 'busca' }, icone('search'), filtroBusca('monstros', 'Buscar criatura…'))),
    lista.length ? h('div', { class: 'cartoes' }, lista.map(m => h('div', { class: 'cartao monstro' },
      titulo(m.nome, 'skull'),
      h('p', { class: 'meta icones-meta' },
        h('span', { title: 'Dificuldade' }, icone('flame'), `Dif. ${m.dificuldade}`),
        h('span', { title: 'Pontos de vida' }, icone('heart'), `PV ${m.pv}`),
        h('span', { title: 'Defesa' }, icone('shield'), `Def ${m.defesa}`)),
      h('p', {}, icone('sword'), h('strong', {}, ' Ataque: '), m.ataque),
      h('p', {}, m.descricao),
      mestre ? botao('Colocar no Campo de Batalha', async () => {
        await acao('monstro.adicionar', { nome: m.nome });
        aviso(`${m.nome} entrou no Campo de Batalha.`);
      }, { class: 'pequeno', icone: 'swords' }) : null))) : vazio('Nenhuma criatura encontrada.', 'search'));
}

export function classesView() {
  const sis = estado.sistema;
  const q = busca('classes');
  const lista = sis.classes.filter(c => !q || JSON.stringify(c).toLowerCase().includes(q));
  const sel = sis.classes.find(c => c.id === estado.sel.classeVista) || null;
  return h('div', {},
    h('div', { class: 'barra' }, titulo('Classes', 'shield', 'h2'), seloRevisao(true, 'base MSS — conferir para o MSA'), h('span', { class: 'espaco' }),
      h('label', { class: 'busca' }, icone('search'), filtroBusca('classes', 'Buscar classe ou habilidade…'))),
    h('p', { class: 'dica' }, `Os personagens recebem a classe no nível ${sis.regras.nivelClasse} e escolhem a especialização no nível ${sis.regras.nivelEspecializacao}.`),
    h('div', { class: 'cartoes classes' }, lista.map(c => h('button', {
      type: 'button', class: `cartao escolha ${sel?.id === c.id ? 'escolhido' : ''}`, 'aria-pressed': sel?.id === c.id,
      onclick: () => { estado.sel.classeVista = sel?.id === c.id ? null : c.id; estado.sel.espVista = null; render(); },
    }, titulo(c.nome, 'wand-sparkles'), h('p', {}, c.descricao.slice(0, 160) + (c.descricao.length > 160 ? '…' : '')),
    h('small', {}, c.especializacoes.map(e => e.nome).join(' · '))))),
    sel ? detalheClasse(sel) : null);
}

function detalheClasse(c) {
  const esp = c.especializacoes.find(e => e.id === estado.sel.espVista) || c.especializacoes[0];
  const descricoes = new Map([...c.caracteristicas, ...c.especializacoes.flatMap(e => e.habilidades)].map(x => [x.nome.toLowerCase().replace(/\s*\(.*|\s*\[.*/g, '').trim(), x.descricao]));
  const item = x => h('li', {}, h('strong', {}, x.nome), x.requisito ? h('small', {}, ` [${x.requisito}]`) : null, ': ', x.descricao);
  return h('article', { class: 'bloco detalhe-classe', id: `classe-${c.id}` },
    titulo(c.nome, 'wand-sparkles', 'h2'),
    h('p', {}, c.descricao),
    c.marca ? h('p', { class: 'cartao-mini' }, icone('target'), ' ', c.marca) : null,
    c.revisao?.length ? h('div', { class: 'alerta' }, icone('circle-alert'), ` Trechos grifados (em revisão): ${c.revisao.map(r => `“${r.slice(0, 60)}”`).join('; ')}`) : null,
    titulo('Características de classe', 'shield', 'h3'),
    h('ul', { class: 'lista-regras' }, c.caracteristicas.map(item)),
    c.extras?.trim() ? h('details', { class: 'bloco' }, h('summary', {}, icone('book-open'), 'Regras adicionais da classe'), markdown(c.extras)) : null,
    titulo('Especializações', 'sparkles', 'h3'),
    abas(c.especializacoes.map(e => [e.id, e.nome, 'sparkles']), esp.id, id => { estado.sel.espVista = id; render(); }),
    h('p', {}, esp.descricao),
    esp.progressao ? tabela(['Nível', 'Ganhos'], esp.progressao.map(l => [
      h('strong', {}, `${l.nivel}º`),
      h('span', { class: 'ganhos-nivel' }, l.ganhos.map(g => h('span', {
        class: `etiqueta ${g === 'Vantagem Extra' ? 'extra' : ''}`, title: descricoes.get(g.toLowerCase()) || (g === 'Vantagem Extra' ? 'Escolha uma vantagem geral ou da classe' : ''),
      }, g))),
    ]), 'tabela-progressao compacta') : null,
    h('ul', { class: 'lista-regras' }, esp.habilidades.map(x => h('li', {}, h('span', { class: 'selo' }, `nv ${x.nivel}`), ' ', h('strong', {}, x.nome), ': ', x.descricao))),
    titulo(`Vantagens de ${c.nome}`, 'gem', 'h3'),
    h('ul', { class: 'lista-regras' }, c.vantagens.map(item)));
}

// Vantagens, defeitos e capacidades (capítulo 4).
export function vantagensView() {
  const sis = estado.sistema;
  const q = busca('vantagens');
  const f = l => l.filter(x => !q || `${x.nome} ${x.descricao}`.toLowerCase().includes(q));
  const item = x => h('li', {}, h('strong', {}, x.nome), x.requisito ? h('small', {}, ` [${x.requisito}]`) : null, seloRevisao(x.revisao), ': ', x.descricao);
  return h('div', {},
    h('div', { class: 'barra' }, titulo('Vantagens e defeitos', 'sparkles', 'h2'), seloRevisao(true, 'base MSS — conferir para o MSA'), h('span', { class: 'espaco' }),
      h('label', { class: 'busca' }, icone('search'), filtroBusca('vantagens', 'Buscar…'))),
    h('p', { class: 'dica' }, `${sis.regras.pontosVantagem} pontos de vantagem no nível 1. Todo personagem tem ao menos ${sis.regras.defeitosMinimos} defeito; um defeito normal dá +1 ponto (máximo +${sis.regras.maxPontosPorDefeitos}).`),
    titulo('Vantagens gerais', 'sparkles', 'h3'), h('ul', { class: 'lista-regras' }, f(sis.vantagens).map(item)),
    titulo('Defeitos leves', 'skull', 'h3'), h('ul', { class: 'lista-regras' }, f(sis.defeitos.filter(d => d.tipo === 'leve')).map(item)),
    titulo('Defeitos normais (+1 ponto)', 'skull', 'h3'), h('ul', { class: 'lista-regras' }, f(sis.defeitos.filter(d => d.tipo === 'normal')).map(item)),
    titulo('Capacidades (usos por descanso longo = MOD do atributo)', 'zap', 'h3'),
    h('ul', { class: 'lista-regras' }, f(sis.capacidades).map(x => h('li', {}, h('span', { class: 'selo' }, x.atributo), ' ', item(x)))));
}

// Perícias e profissões (capítulo 2).
export function periciasView() {
  const sis = estado.sistema;
  const q = busca('periciasRef');
  const lista = sis.pericias.filter(p => !q || JSON.stringify(p).toLowerCase().includes(q));
  return h('div', {},
    h('div', { class: 'barra' }, titulo('Perícias e profissões', 'target', 'h2'), seloRevisao(true, 'base MSS — conferir para o MSA'), h('span', { class: 'espaco' }),
      h('label', { class: 'busca' }, icone('search'), filtroBusca('periciasRef', 'Buscar…'))),
    h('p', { class: 'dica' }, `${sis.regras.formulas.pontosPericia}. ${sis.regras.formulas.limitePericia}. Perícia base custa ${sis.regras.pericias.custoBase} PP por ponto (combate: ${sis.regras.pericias.custoBaseCombate}).`),
    titulo('Profissões', 'backpack', 'h3'),
    h('div', { class: 'cartoes' }, sis.profissoes.map(p => h('div', { class: 'cartao' }, titulo(p.nome, 'backpack'), h('p', {}, p.descricao), h('p', {}, h('strong', {}, 'Vantagem: '), p.vantagem), h('small', {}, `+${p.bonus}% em ${p.subpericiasLivro.join('; ')}`)))),
    titulo('Perícias', 'target', 'h3'),
    lista.map(p => h('details', { class: 'bloco', open: !!q },
      h('summary', {}, h('strong', {}, p.nome), h('span', { class: 'selo' }, p.atributo), p.combate ? h('span', { class: 'selo' }, 'combate') : null),
      h('p', {}, p.descricao),
      h('ul', { class: 'lista-regras' }, p.subpericias.map(s => h('li', {}, h('strong', {}, s.nome), seloRevisao(s.revisao), ': ', s.descricao))))));
}

const TIPOS = { arma: 'Arma', defesa: 'Defesa', vestimenta: 'Vestimenta', joia: 'Joia', armadilha: 'Armadilha', geral: 'Geral' };

// Catálogo de itens. Com "compra", mostra o botão de comprar para o personagem escolhido.
export function lojaView({ titulo: tituloLoja = 'Loja', tipos = null } = {}) {
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
      titulo(tituloLoja, 'store', 'h2'),
      mestre ? h('label', { class: 'linha interruptor' },
        h('input', { type: 'checkbox', checked: c.lojaAberta, onchange: e => acao('campanha.atualizar', { lojaAberta: e.target.checked }) }),
        icone(c.lojaAberta ? 'lock-open' : 'lock'), 'Loja liberada para os jogadores') : h('span', { class: `selo ${c.lojaAberta ? 'ok' : 'perigo'}` }, icone(c.lojaAberta ? 'lock-open' : 'lock'), c.lojaAberta ? 'Loja aberta' : 'Loja fechada pelo mestre'),
      h('span', { class: 'espaco' }),
      tipos ? null : selecao([{ valor: '', rotulo: 'Todos os tipos' }, ...Object.entries(TIPOS).map(([v, r]) => ({ valor: v, rotulo: r }))], tipoSel, v => { estado.sel.lojaTipo = v; render(); }),
      h('label', { class: 'busca' }, icone('search'), filtroBusca('loja', 'Buscar item…'))),
    compradores.length ? h('div', { class: 'barra' },
      h('span', {}, icone('user'), mestre ? ' Comprar/dar para:' : ' Comprar para:'),
      selecao(compradores.map(p => ({ valor: p.id, rotulo: p.nome })), compradorId, v => { estado.sel.comprador = v; render(); }),
      comprador ? h('span', { class: 'selo moeda' }, icone('coins'), `${comprador.dinheiro ?? 0}`) : null) : null,
    itens.length ? tabela(['Item', 'Tipo', 'Slot', 'Preço', 'Venda', 'Durab.', 'Peso', 'Dano/Def.', 'Bônus', ''], itens.map(i => [
      h('span', { class: 'item-nome' }, icone(ICONE_TIPO[i.tipo] || 'tag'), i.nome), TIPOS[i.tipo] || i.tipo, [slotNome(i.slot), i.ocupa > 1 ? ` (${i.ocupa})` : ''],
      h('span', { class: 'moeda' }, icone('coins'), i.preco), i.venda, i.durabilidade, i.peso,
      [i.dano, i.defesa ? `Def ${i.defesa}` : null].filter(Boolean).join(' · ') || '—',
      Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—',
      [
        podeComprar ? botao('Comprar', async () => {
          await acao('item.comprar', { id: comprador.id, itemId: i.id });
          aviso(`${i.nome} comprado para ${comprador.nome}.`);
        }, { class: 'pequeno primario', icone: 'coins' }) : null,
        mestre && comprador ? botao('Dar', async () => {
          await acao('item.adicionar', { id: comprador.id, itemId: i.id });
          aviso(`${i.nome} entregue a ${comprador.nome}.`);
        }, { class: 'pequeno', icone: 'gem' }) : null,
      ],
    ])) : vazio('Nenhum item encontrado.', 'search'));
}

// Consulta com sub-abas (Livro de Regras do jogador / Classes do mestre).
export function referenciaView(inicial, comLivro) {
  const opcoes = [
    ...(comLivro ? [['livro', 'Livro', 'book-open']] : []),
    ['classes', 'Classes', 'shield'], ['pericias', 'Perícias e profissões', 'target'], ['vantagens', 'Vantagens e defeitos', 'sparkles'],
  ];
  const chave = `ref:${comLivro ? 'livro' : 'classes'}`;
  const atual = estado.sel[chave] || inicial;
  const conteudo = { livro: () => livroView(estado.sistema.livro || 'regras-msa', `Livro de Regras · ${estado.sistema.nome}`), classes: classesView, pericias: periciasView, vantagens: vantagensView }[atual];
  return h('div', {}, abas(opcoes, atual, id => { estado.sel[chave] = id; render(); }), conteudo());
}
