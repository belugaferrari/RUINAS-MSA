import { h, botao, selecao, aviso, vazio, icone, titulo, tabela, abas, seloRevisao, confirmar, formatarData, pedirTexto } from '../ui.js';
import { ICONE_TIPO } from './ficha.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao, get, enviarArquivo, baixarArquivo } from '../api.js';
import { itemVisivel, itemAberto } from '/shared/regras.js';
import { imagemDeLink } from '/shared/imagens.js';
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
  const sis = estado.sistema;
  const lista = sis.monstros.filter(m => !q || JSON.stringify(m).toLowerCase().includes(q));
  const tipoNome = id => (sis.tiposCriatura || []).find(t => t.id === id)?.nome || null;
  const subNome = id => sis.pericias.flatMap(p => p.subpericias.map(x => [x.id, x.nome])).find(x => x[0] === id)?.[1] || id;
  return h('div', {},
    h('div', { class: 'barra' }, titulo('Livro dos Monstros', 'skull', 'h2'), h('span', { class: 'espaco' }), h('label', { class: 'busca' }, icone('search'), filtroBusca('monstros', 'Buscar criatura…'))),
    mestre ? planilhaMonstrosMestre() : null,
    lista.length ? h('div', { class: 'cartoes' }, lista.map(m => {
      const [img, botoesImg] = imagemMonstro(m, mestre);
      const ataques = m.ataques?.length ? m.ataques : m.ataque ? [{ nome: m.ataque }] : [];
      const atr = m.atributos ? Object.entries(m.atributos).map(([k, v]) => `${k} ${v}`).join(' · ') : '';
      const extras = [
        m.resistencias?.length ? `Resiste: ${m.resistencias.join(', ')}` : null,
        m.imunidades?.length ? `Imune: ${m.imunidades.join(', ')}` : null,
        m.vulnerabilidades?.length ? `Vulnerável: ${m.vulnerabilidades.join(', ')}` : null,
      ].filter(Boolean);
      return h('div', { class: 'cartao monstro' },
        img,
        titulo(m.nome, 'skull'),
        h('p', { class: 'meta' }, [tipoNome(m.tipoCriatura), m.tamanho, m.raca && m.raca !== m.nome ? m.raca : null, m.nivel ? `nível ${m.nivel}` : null].filter(Boolean).join(' · ')),
        h('p', { class: 'meta icones-meta' },
          h('span', { title: 'Dificuldade' }, icone('flame'), `Dif. ${m.dificuldade ?? '—'}`),
          h('span', { title: 'Pontos de vida' }, icone('heart'), `PV ${m.pv ?? 'calc.'}`),
          h('span', { title: 'IP geral' }, icone('shield'), `IP ${m.ipGeral ?? m.defesa ?? 0}`),
          m.deslocamento ? h('span', { title: 'Deslocamento' }, icone('footprints'), `${m.deslocamento} m`) : null,
          m.xp ? h('span', { title: 'XP' }, icone('sparkles'), `${m.xp} XP`) : null),
        atr ? h('p', { class: 'meta' }, atr) : null,
        ataques.length ? h('ul', { class: 'lista-ataques-monstro' }, ataques.map(a => h('li', {}, icone('sword'), ' ', h('strong', {}, a.nome),
          a.dano ? ` ${a.dano}${a.tipoDano ? ` ${a.tipoDano}` : ''}${a.alcance === 'distancia' ? ` · ${a.alcanceM ? `${a.alcanceM} m` : 'distância'}` : ''}${a.acerto != null ? ` · ${a.acerto}%` : a.pericia ? ` · ${subNome(a.pericia)}` : ''}` : ''))) : null,
        m.afinidades?.length ? h('p', { class: 'meta' }, icone('flame'), ` Afinidade elementar: ${m.afinidades.join(', ')}`) : null,
        m.habilidades?.length ? h('p', {}, icone('sparkles'), ' ', m.habilidades.map(x => `${x.nome}${x.unica ? ' (única)' : ''}`).join(', ')) : null,
        extras.length ? h('p', { class: 'meta' }, extras.join(' · ')) : null,
        m.comportamento ? h('details', {}, h('summary', {}, 'Comportamento'), h('p', {}, m.comportamento)) : null,
        m.descricao ? h('p', {}, m.descricao) : null,
        botoesImg,
        mestre ? botao('Colocar no Campo de Batalha', async () => {
          await acao('monstro.adicionar', { nome: m.nome });
          aviso(`${m.nome} entrou no Campo de Batalha.`);
        }, { class: 'pequeno', icone: 'swords' }) : null);
    })) : vazio('Nenhuma criatura encontrada.', 'search'));
}

// Livro dos Monstros por planilha (só o mestre): baixar a planilha atual, enviar de volta ou voltar aos exemplos.
function planilhaMonstrosMestre() {
  const info = estado.sel.monstrosInfo;
  if (!info && !estado.sel.monstrosPedido) {
    estado.sel.monstrosPedido = true;
    get('/api/monstros/origem').then(r => { estado.sel.monstrosInfo = r; render(); }).catch(() => {});
  }
  const arquivo = h('input', { type: 'file', accept: '.xlsx', 'aria-label': 'Planilha de monstros (.xlsx)' });
  const modo = h('select', { 'aria-label': 'Como usar a planilha' },
    h('option', { value: 'atualizar' }, 'Atualizar: troca os monstros da planilha e mantém os outros'),
    h('option', { value: 'substituir' }, 'Substituir: o livro fica só com os monstros da planilha'));
  const recarregar = () => { estado.sel.monstrosInfo = null; estado.sel.monstrosPedido = false; };
  return h('details', { class: 'bloco', open: !!estado.sel.monstrosAberto, ontoggle: e => { estado.sel.monstrosAberto = e.target.open; } },
    h('summary', {}, icone('file-spreadsheet'), ' Livro dos Monstros (planilha)'),
    h('p', { class: 'dica' }, info ? `${info.total} criaturas · ${info.origem === 'mestre' ? `enviado por você${info.arquivo ? ` (${info.arquivo})` : ''}${info.atualizadoEm ? ` · ${formatarData(info.atualizadoEm)}` : ''}` : 'exemplos do app'}.` : 'Carregando…'),
    h('p', { class: 'dica' }, 'Baixe a planilha, preencha as abas Monstros, Ataques e Habilidades (instruções dentro dela) e envie de volta. Vale para todas as campanhas deste PC; monstros que já estão em campo não mudam.'),
    h('div', { class: 'barra' },
      botao('Baixar planilha', () => baixarArquivo(`/api/monstros.xlsx?sistema=${estado.campanha.sistema || 'mss'}`, 'monstros-ilhas-das-ruinas.xlsx'), { icone: 'download' }),
      arquivo, modo,
      botao('Enviar planilha', async () => {
        if (!arquivo.files[0]) throw new Error('Escolha a planilha .xlsx.');
        const form = new FormData();
        form.append('arquivo', arquivo.files[0]);
        form.append('modo', modo.value);
        const r = await enviarArquivo('/api/monstros', form);
        recarregar();
        aviso(`${r.recebidos} monstros lidos; o livro tem ${r.total}.${r.avisos?.length ? ` Atenção: ${r.avisos.join(' ')}` : ''}`, r.avisos?.length ? 'erro' : 'ok');
      }, { class: 'primario', icone: 'upload' }),
      info?.origem === 'mestre' ? botao('Voltar aos exemplos', async () => {
        if (!(await confirmar('Apagar o Livro dos Monstros enviado e voltar aos exemplos do app?'))) return;
        await enviarArquivo('/api/monstros/padrao', new FormData());
        recarregar();
      }, { class: 'perigo', icone: 'refresh-cw' }) : null));
}

// Imagem do monstro: arquivo enviado pelo mestre ou link (Google Drive compartilhado ou endereço na internet).
function imagemMonstro(m, mestre) {
  const url = estado.campanha.imagensMonstros?.[m.nome] || imagemDeLink(m.imagem);
  const arquivo = h('input', {
    type: 'file', accept: 'image/*', hidden: true,
    onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      const form = new FormData();
      form.append('nome', m.nome);
      form.append('arquivo', f);
      try { await enviarArquivo(`/api/campanhas/${estado.campanha.id}/monstros/imagem`, form); aviso(`Imagem de ${m.nome} atualizada.`); } catch (err) { aviso(err.message, 'erro'); }
    },
  });
  const colar = async () => {
    const link = await pedirTexto(`Imagem de ${m.nome}`, 'Cole o link do Google Drive (Qualquer pessoa com o link) ou o endereço da imagem', '');
    if (link == null) return;
    if (!imagemDeLink(link)) return aviso('Link inválido: cole um endereço que comece com https://', 'erro');
    await acao('monstro.imagem', { nome: m.nome, link });
  };
  return [
    url ? h('img', { class: 'monstro-imagem', src: url, alt: m.nome, loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
    mestre ? h('div', { class: 'barra' }, arquivo,
      botao(url ? 'Trocar imagem' : 'Enviar imagem', () => arquivo.click(), { class: 'pequeno', icone: 'camera' }),
      botao('Colar link', colar, { class: 'pequeno', icone: 'link' }),
      url && estado.campanha.imagensMonstros?.[m.nome] ? botao('', () => acao('monstro.imagem', { nome: m.nome, link: '' }), { class: 'pequeno perigo', icone: 'x', title: 'Tirar a imagem' }) : null) : null,
  ];
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

export const TIPOS = {
  arma: 'Arma', municao: 'Munição', defesa: 'Proteção', vestimenta: 'Vestimenta', joia: 'Acessório', cibernetico: 'Cibernético', ferramenta: 'Ferramenta',
  boticario: 'Boticário', alimento: 'Alimentação', materia: 'Matéria-prima', energia: 'Fonte de energia', transporte: 'Transporte', armadilha: 'Armadilha', geral: 'Diversos',
};
const POR_PAGINA = 60;

// Catálogo de itens. Com "compra", mostra o botão de comprar para o personagem escolhido.
export function lojaView({ titulo: tituloLoja = 'Loja', tipos = null } = {}) {
  const c = estado.campanha;
  const sis = estado.sistema;
  const mestre = c.papel === 'mestre';
  const q = busca('loja');
  const tipoSel = estado.sel.lojaTipo || '';
  const raridadeSel = estado.sel.lojaRaridade || '';
  // Jogadores: só Mundano, Comum e Incomum, mais o que o mestre liberou.
  const todos = sis.itens.filter(i => (mestre || itemVisivel(i, c)) && (!tipos || tipos.includes(i.tipo)) && (!tipoSel || i.tipo === tipoSel) && (!raridadeSel || i.raridade === raridadeSel)
    && (!q || i.nome.toLowerCase().includes(q) || (i.descricao || '').toLowerCase().includes(q)));
  // O catálogo tem mais de mil itens: mostra uma página por vez.
  const limite = estado.sel.lojaLimite || POR_PAGINA;
  const itens = todos.slice(0, limite);
  const raridades = [...new Set(sis.itens.filter(i => mestre || itemVisivel(i, c)).map(i => i.raridade).filter(Boolean))];
  const liberado = i => (c.itensLiberados || []).includes(i.id);
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
      tipos ? null : selecao([{ valor: '', rotulo: 'Todos os tipos' }, ...Object.entries(TIPOS).filter(([v]) => sis.itens.some(i => i.tipo === v)).map(([v, r]) => ({ valor: v, rotulo: r }))], tipoSel,
        v => { estado.sel.lojaTipo = v; estado.sel.lojaLimite = null; render(); }, { 'aria-label': 'Tipo de item' }),
      raridades.length ? selecao([{ valor: '', rotulo: 'Toda raridade' }, ...raridades], raridadeSel, v => { estado.sel.lojaRaridade = v; estado.sel.lojaLimite = null; render(); }, { 'aria-label': 'Raridade' }) : null,
      h('label', { class: 'busca' }, icone('search'), filtroBusca('loja', 'Buscar item…'))),
    compradores.length ? h('div', { class: 'barra' },
      h('span', {}, icone('user'), mestre ? ' Comprar/dar para:' : ' Comprar para:'),
      selecao(compradores.map(p => ({ valor: p.id, rotulo: p.nome })), compradorId, v => { estado.sel.comprador = v; render(); }),
      comprador ? h('span', { class: 'selo moeda' }, icone('coins'), `${comprador.dinheiro ?? 0}`) : null) : null,
    mestre && !tipos ? catalogoMestre() : null,
    mestre ? h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: !!c.itensRarosVisiveis, onchange: e => acao('campanha.atualizar', { itensRarosVisiveis: e.target.checked }) }),
      'Jogadores veem todos os itens (sem isso, só Mundanos, Comuns, Incomuns e os que você liberar)') : null,
    h('p', { class: 'dica' }, `${todos.length} ${todos.length === 1 ? 'item' : 'itens'}${todos.length > itens.length ? ` (mostrando ${itens.length})` : ''}.`),
    itens.length ? tabela(['Item', 'Tipo', 'Slot', 'Preço', 'Venda', 'Durab.', 'Peso', 'Dano/IP', 'Bônus', ''], itens.map(i => [
      h('span', { class: 'item-nome', title: [i.descricao, i.aparencia, i.efeitos, i.observacoes, i.requisitos ? `Requisitos: ${i.requisitos}` : ''].filter(Boolean).join(' · ') },
        icone(ICONE_TIPO[i.tipo] || 'tag'), i.nome, i.raridade ? h('small', { class: 'selo' }, i.raridade) : null, seloRevisao(i.revisao)),
      TIPOS[i.tipo] || i.tipo, [slotNome(i.slot), i.ocupa > 1 ? ` (${i.ocupa})` : ''],
      h('span', { class: 'moeda' }, icone('coins'), i.preco), i.venda, i.durabilidade, i.peso,
      [i.dano ? `${i.dano}${i.tipoDano ? ` ${i.tipoDano}` : ''}` : i.danoTexto, i.defesa ? `IP ${i.defesa}` : null].filter(Boolean).join(' · ') || '—',
      Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—',
      [
        podeComprar ? botao('Comprar', async () => {
          await acao('item.comprar', { id: comprador.id, itemId: i.id });
          aviso(`${i.nome} comprado para ${comprador.nome}.`);
        }, { class: 'pequeno primario', icone: 'coins' }) : null,
        mestre && !itemAberto(i) ? botao(liberado(i) ? 'Esconder' : 'Liberar', () => acao('item.liberar', { itemId: i.id, liberar: !liberado(i) }),
          { class: `pequeno ${liberado(i) ? 'perigo' : ''}`, icone: liberado(i) ? 'eye-off' : 'eye', title: liberado(i) ? `Esconder ${i.nome} dos jogadores` : `Mostrar ${i.nome} aos jogadores` }) : null,
        mestre && comprador ? botao('Dar', async () => {
          await acao('item.adicionar', { id: comprador.id, itemId: i.id });
          aviso(`${i.nome} entregue a ${comprador.nome}.`);
        }, { class: 'pequeno', icone: 'gem' }) : null,
      ],
    ])) : vazio('Nenhum item encontrado.', 'search'),
    todos.length > itens.length ? botao(`Mostrar mais ${Math.min(POR_PAGINA, todos.length - itens.length)}`, () => { estado.sel.lojaLimite = limite + POR_PAGINA; render(); }, { icone: 'chevron-down' }) : null);
}

// Catálogo de itens editável por planilha (só o mestre): baixar, enviar de volta ou voltar ao padrão.
function catalogoMestre() {
  const info = estado.sel.catalogoInfo;
  if (!info && !estado.sel.catalogoPedido) {
    estado.sel.catalogoPedido = true;
    get('/api/itens/origem').then(r => { estado.sel.catalogoInfo = r; render(); }).catch(() => {});
  }
  const arquivo = h('input', { type: 'file', accept: '.xlsx', 'aria-label': 'Planilha de itens (.xlsx)' });
  const modo = h('select', { 'aria-label': 'Como usar a planilha' },
    h('option', { value: 'atualizar' }, 'Atualizar: troca os itens da planilha e mantém os outros'),
    h('option', { value: 'substituir' }, 'Substituir: o catálogo fica só com os itens da planilha'));
  const atualizarInfo = () => { estado.sel.catalogoInfo = null; estado.sel.catalogoPedido = false; };
  return h('details', { class: 'bloco', open: !!estado.sel.catalogoAberto, ontoggle: e => { estado.sel.catalogoAberto = e.target.open; } },
    h('summary', {}, icone('file-spreadsheet'), ' Catálogo de itens (planilha)'),
    h('p', { class: 'dica' }, info
      ? `${info.total} itens · ${info.origem === 'mestre' ? `enviado por você${info.arquivo ? ` (${info.arquivo})` : ''}` : 'catálogo padrão do app (planilhas do autor)'}${info.atualizadoEm ? ` · ${formatarData(info.atualizadoEm)}` : ''}.`
      : 'Carregando…'),
    h('p', { class: 'dica' }, 'Use a mesma planilha de itens (colunas "num ctrl", "Item", "Preço"…). As colunas "App: …" são opcionais e corrigem o que o app deduz (tipo, slot, IP, capacidade de munição…). Vale para todas as campanhas deste PC; itens que os personagens já têm não mudam.'),
    h('div', { class: 'barra' },
      botao('Baixar planilha atual', () => baixarArquivo('/api/itens.xlsx', 'itens-ilhas-das-ruinas.xlsx'), { icone: 'download' }),
      arquivo, modo,
      botao('Enviar planilha', async () => {
        if (!arquivo.files[0]) throw new Error('Escolha a planilha .xlsx.');
        const form = new FormData();
        form.append('arquivo', arquivo.files[0]);
        form.append('modo', modo.value);
        const r = await enviarArquivo('/api/itens', form);
        atualizarInfo();
        aviso(`${r.recebidos} itens lidos da planilha; catálogo com ${r.total} itens.`);
      }, { class: 'primario', icone: 'upload' }),
      info?.origem === 'mestre' ? botao('Voltar ao catálogo padrão', async () => {
        if (!(await confirmar('Apagar o catálogo enviado e voltar ao catálogo padrão do app?'))) return;
        await enviarArquivo('/api/itens/padrao', new FormData());
        atualizarInfo();
      }, { class: 'perigo', icone: 'refresh-cw' }) : null));
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
