import { h, botao, selecao, aviso, vazio, icone, titulo, tabela, abas, seloRevisao, confirmar, formatarData, pedirTexto } from '../ui.js';
import { ICONE_TIPO } from './ficha.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao, get, post, enviarArquivo, baixarArquivo } from '../api.js';
import { itemVisivel, itemAberto } from '/shared/regras.js';
import { imagemDeLink } from '/shared/imagens.js';
import { buscarMonstros, monstroNoEstagio, textoDeslocamentos, textoND, periciasAcimaDoLimite } from '/shared/monstros.js';
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

// Busca sem diferença de acento nem maiúscula ("enojado" acha "Enojado", "pericia" acha "Perícia").
const sa = t => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const busca = chave => sa(estado.sel[`busca:${chave}`] || '').trim();

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
  const titulos = [...corpo.querySelectorAll('h1, h2, h3')];
  titulos.forEach((t, i) => { t.id = `${nome}-${i}`; });
  // Busca: lista cada trecho (parágrafo, item, linha de tabela, título) que tem o termo, com a seção onde está;
  // o termo fica destacado no texto e um clique leva ao trecho.
  const resultados = q.length >= 2 ? buscarNoLivro(corpo, q, nome) : [];
  // No celular o índice começa recolhido para o texto aparecer logo.
  const chaveIndice = `indice:${nome}`;
  if (!(chaveIndice in estado.sel)) estado.sel[chaveIndice] = !matchMedia('(max-width: 860px)').matches;
  return h('div', { class: 'livro' },
    h('aside', { class: 'indice' },
      titulo(nomeLivro, nome === 'mestre' ? 'library' : 'book-open'),
      h('label', { class: 'busca' }, icone('search'), filtroBusca(nome, 'Buscar no livro…')),
      h('details', { open: estado.sel[chaveIndice], ontoggle: e => { estado.sel[chaveIndice] = e.target.open; } },
        h('summary', {}, icone('bookmark'), 'Índice'),
        h('ul', {}, titulos.map(t => h('li', { class: t.tagName.toLowerCase() },
        h('a', { href: `#${t.id}`, onclick: e => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }); } }, t.textContent)))))),
    h('div', { class: 'livro-conteudo' },
      q.length >= 2 ? resultadosBusca(resultados, estado.sel[`busca:${nome}`]) : null,
      corpo));
}

// Acha o termo (sem acento) em cada bloco do livro, marca no texto e devolve [{ id, secao, trecho }].
function buscarNoLivro(corpo, q, nome) {
  const blocos = [...corpo.querySelectorAll('p, li, tr, h1, h2, h3, h4, h5, h6, blockquote, dt, dd')]
    .filter(el => !el.querySelector('p, li, tr') && sa(el.textContent).includes(q));
  const saida = [];
  let secao = '';
  const todos = [...corpo.querySelectorAll('h1, h2, h3, h4, p, li, tr, blockquote, dt, dd')];
  const secaoDe = new Map();
  for (const el of todos) { if (/^H[1-4]$/.test(el.tagName)) secao = el.textContent.trim(); secaoDe.set(el, secao); }
  blocos.forEach((el, i) => {
    el.id ||= `${nome}-r${i}`;
    el.classList.add('achado');
    const texto = el.textContent.replace(/\s+/g, ' ').trim();
    const pos = sa(texto).indexOf(q);
    const ini = Math.max(0, pos - 50);
    saida.push({ id: el.id, secao: /^H[1-6]$/.test(el.tagName) ? 'Título' : secaoDe.get(el) || '', trecho: `${ini ? '…' : ''}${texto.slice(ini, pos + q.length + 90)}${pos + q.length + 90 < texto.length ? '…' : ''}`, pos: pos - ini + (ini ? 1 : 0) });
    marcar(el, q);
  });
  return saida;
}

// Envolve as ocorrências do termo em <mark>, sem diferença de acento (compara letra a letra já normalizada).
function marcar(el, q) {
  const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nos = [];
  while (andar.nextNode()) nos.push(andar.currentNode);
  for (const no of nos) {
    const t = no.nodeValue;
    const norm = [...t].map(ch => sa(ch));
    const plano = norm.join('');
    let idx = plano.indexOf(q);
    if (idx < 0) continue;
    // Converte a posição no texto normalizado para a posição no texto original.
    const mapa = [];
    norm.forEach((n, k) => { for (let j = 0; j < Math.max(1, n.length); j++) mapa.push(k); });
    const frag = document.createDocumentFragment();
    let ultimo = 0;
    while (idx >= 0) {
      const a = mapa[idx], b = (mapa[idx + q.length - 1] ?? t.length - 1) + 1;
      frag.append(t.slice(ultimo, a), h('mark', {}, t.slice(a, b)));
      ultimo = b;
      idx = plano.indexOf(q, idx + q.length);
    }
    frag.append(t.slice(ultimo));
    no.replaceWith(frag);
  }
}

function resultadosBusca(lista, termo) {
  const ir = id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('piscar'); void el.offsetWidth; el.classList.add('piscar');
  };
  const mostra = lista.slice(0, 80);
  return h('section', { class: 'resultados-busca bloco' },
    h('p', {}, icone('search'), h('strong', {}, ` ${lista.length} resultado${lista.length === 1 ? '' : 's'}`), ` para “${termo.trim()}”`,
      lista.length > mostra.length ? h('small', { class: 'dica' }, ` (mostrando os ${mostra.length} primeiros)`) : null),
    lista.length ? h('ol', {}, mostra.map(r => h('li', {},
      h('button', { type: 'button', class: 'resultado', onclick: () => ir(r.id) },
        r.secao ? h('small', { class: 'secao' }, r.secao) : null,
        h('span', {}, r.trecho))))) : h('p', { class: 'dica' }, 'Nada encontrado. Tente uma palavra mais curta (ex.: "enoj", "subperícia", "durabil").'));
}

// Livro dos Monstros: lista resumida (miniatura, nome, ND, PV, afinidades) que abre a ficha completa; busca por palavra
// aproximada ("moloto" acha Moolotos). Monstros com estágios mostram cada estágio (o que muda nele).
export function monstrosView() {
  const mestre = estado.campanha.papel === 'mestre';
  const sis = estado.sistema;
  const termo = estado.sel['busca:monstros'] || '';
  const [filtro, lista] = filtroTipos('livro', buscarMonstros(sis.monstros, termo));
  return h('div', {},
    h('div', { class: 'barra' }, titulo('Livro dos Monstros', 'skull', 'h2'), h('span', { class: 'espaco' }), h('label', { class: 'busca' }, icone('search'), filtroBusca('monstros', 'Buscar criatura (nome, raça, afinidade, lugar)…'))),
    mestre ? planilhaMonstrosMestre() : null,
    // Atalho: o gerador fica no Campo de Batalha (o encontro entra direto lá e no mapa).
    mestre ? h('div', { class: 'barra' }, botao('Gerador de encontro aleatório', () => { estado.aba = 'batalha'; estado.sel.encontroNDAberto = true; render(); },
      { class: 'pequeno primario', icone: 'dices', title: 'Abre o gerador no Campo de Batalha: faixa de ND, variação de 10%, PV de 50% a 100% e cenário' })) : null,
    mestre ? lembretesLivro(sis) : null,
    filtro,
    h('p', { class: 'dica' }, `${lista.length} de ${sis.monstros.length} criatura${sis.monstros.length === 1 ? '' : 's'}${termo.trim() ? ` para “${termo.trim()}”` : ''}. Clique numa linha para abrir a ficha.`),
    lista.length ? h('ul', { class: 'lista-monstros' }, lista.map(m => linhaMonstro(m, mestre))) : vazio('Nenhuma criatura encontrada. Tente uma palavra mais curta.', 'search'));
}

// Filtro por tipo de criatura (Monstros, Animais, Bestas…): botões com a contagem de cada tipo; devolve [botões, lista filtrada].
export function filtroTipos(chave, lista) {
  const sis = estado.sistema;
  const tipoDe = m => m.tipoCriatura || 'monstro';
  const contagem = new Map();
  for (const m of lista) contagem.set(tipoDe(m), (contagem.get(tipoDe(m)) || 0) + 1);
  const ordem = (sis.tiposCriatura || []).map(t => t.id);
  const tipos = [...contagem.keys()].sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99));
  const nome = id => (sis.tiposCriatura || []).find(t => t.id === id)?.nome || id;
  const sel = estado.sel[`tipoCriatura:${chave}`] || '';
  const filtrada = sel ? lista.filter(m => tipoDe(m) === sel) : lista;
  const chip = (id, rotulo, n) => botao(`${rotulo} (${n})`, () => { estado.sel[`tipoCriatura:${chave}`] = id; render(); },
    { class: `pequeno ${sel === id ? 'primario' : ''}`, 'aria-pressed': sel === id });
  return [tipos.length > 1 || sel ? h('div', { class: 'barra filtro-tipos', role: 'group', 'aria-label': 'Tipo de criatura' },
    chip('', 'Todos', lista.length), tipos.map(t => chip(t, nome(t), contagem.get(t)))) : null, filtrada];
}

// Estágio mostrado de início: o 1º (a planilha do autor descreve cada estágio por inteiro); "Base" continua na lista.
export const estagioInicial = m => m.estagios?.[0]?.numero ?? null;
// Lembretes do autor (25/10): rever perícias de todos os seres e os NDs (inclusive menores que 1). Some quando ele dispensa.
function lembretesLivro(sis) {
  let dispensado = false;
  try { dispensado = localStorage.getItem('lembrete:livro-monstros:25-10') === 'ok'; } catch { /* sem armazenamento */ }
  if (dispensado) return null;
  const acima = sis.monstros.filter(m => periciasAcimaDoLimite(m, sis).length);
  return h('div', { class: 'bloco aviso-revisar lembrete' },
    h('strong', {}, icone('triangle-alert'), ' Lembretes de revisão'),
    h('ul', {},
      h('li', {}, `Rever as perícias de todos os seres. ${acima.length} passam do limite (base + subperícia ≤ 5 + 5 × nível) — marcados com "revisar"${acima.length ? `: ${acima.slice(0, 8).map(m => m.nome.replace(/\s*\(.*$/, '')).join(', ')}${acima.length > 8 ? '…' : ''}` : ''}.`),
      h('li', {}, 'Rever os NDs, inclusive valores menores que 1 (0,5 = 1/2; 0,25 = 1/4) para criaturas fracas.')),
    botao('Já revisei', () => { try { localStorage.setItem('lembrete:livro-monstros:25-10', 'ok'); } catch { /* ok */ } render(); }, { class: 'pequeno', icone: 'check' }));
}

export const urlImagemMonstro = (m, estagio = null) => (estagio != null ? imagemDeLink(estagio.imagem) : null) || estado.campanha.imagensMonstros?.[m.nome] || imagemDeLink(m.imagem)
  || imagemDeLink(m.estagios?.find(e => e.imagem)?.imagem) || null;
export function miniaturaMonstro(m, estagio = null) {
  const url = urlImagemMonstro(m, estagio);
  // Imagem que não abre (link do Drive sem "Qualquer pessoa com o link"): fica o ícone.
  return h('span', { class: 'mini-monstro', 'aria-hidden': 'true' }, url ? h('img', { src: url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => e.target.replaceWith(icone('skull')) }) : icone('skull'));
}
export const resumoAfinidades = m => (m.afinidades || []).map((a, i) => h('span', { class: `etiqueta afinidade ${i ? '' : 'principal'}`, title: i ? 'Afinidade elementar' : 'Afinidade principal: recebe metade do dano desse elemento' }, a));

function linhaMonstro(m, mestre) {
  const chave = `monstroAberto:${m.nome}`;
  const aberto = !!estado.sel[chave];
  return h('li', { class: `monstro-linha ${aberto ? 'aberta' : ''}` },
    h('button', { type: 'button', class: 'monstro-resumo', 'aria-expanded': aberto, onclick: () => { estado.sel[chave] = !aberto; render(); } },
      miniaturaMonstro(m, m.estagios?.[0] || null),
      h('span', { class: 'monstro-nome' }, h('strong', {}, m.nome), m.raca && m.raca !== m.nome ? h('small', {}, ` ${m.raca}`) : null),
      h('span', { class: 'selo', title: 'Nível de dificuldade (encontros)' }, `ND ${textoND(m.dificuldade)}`),
      h('span', { class: 'selo', title: 'Pontos de vida' }, icone('heart'), ` ${m.pv ?? 'calc.'}`),
      h('span', { class: 'afinidades' }, resumoAfinidades(m)),
      m.estagios?.length ? h('span', { class: 'selo ok', title: 'Este monstro tem estágios' }, `${m.estagios.length} estágio${m.estagios.length > 1 ? 's' : ''}`) : null,
      mestre && periciasAcimaDoLimite(m, estado.sistema).length ? h('span', { class: 'selo perigo', title: 'Perícia acima do limite do nível: abra para ver' }, icone('triangle-alert'), ' revisar') : null,
      icone(aberto ? 'chevron-up' : 'chevron-down')),
    aberto ? fichaMonstro(m, mestre) : null);
}

function fichaMonstro(base, mestre) {
  const sis = estado.sistema;
  const chaveEst = `monstroEstagio:${base.nome}`;
  const numEst = chaveEst in estado.sel ? estado.sel[chaveEst] : estagioInicial(base);
  const m = monstroNoEstagio(base, numEst);
  const est = (base.estagios || []).find(e => e.numero === numEst) || null;
  const tipoNome = id => (sis.tiposCriatura || []).find(t => t.id === id)?.nome || null;
  const subNome = id => sis.pericias.flatMap(p => p.subpericias.map(x => [x.id, x.nome])).find(x => x[0] === id)?.[1] || id;
  const [img, botoesImg] = imagemMonstro(base, mestre, est);
  const atr = m.atributos ? Object.entries(m.atributos).map(([k, v]) => `${k} ${v}`).join(' · ') : '';
  const extras = [
    m.resistencias?.length ? `Resiste: ${m.resistencias.join(', ')}` : null,
    m.imunidades?.length ? `Imune: ${m.imunidades.join(', ')}` : null,
    m.vulnerabilidades?.length ? `Vulnerável: ${m.vulnerabilidades.join(', ')}` : null,
  ].filter(Boolean);
  const qtd = estado.sel[`monstroQtd:${base.nome}`] || 1;
  return h('div', { class: 'cartao monstro ficha-monstro' },
    base.estagios?.length ? h('div', { class: 'barra estagios', role: 'group', 'aria-label': 'Estágios' }, h('small', {}, 'Estágio:'),
      [{ numero: null, nome: 'Base' }, ...base.estagios].map(e => botao(e.numero == null ? 'Base' : `${e.numero}${e.nome ? ` · ${e.nome}` : ''}`,
        () => { estado.sel[chaveEst] = e.numero; render(); }, { class: `pequeno ${numEst === e.numero ? 'primario' : ''}`, 'aria-pressed': numEst === e.numero }))) : null,
    img,
    h('p', { class: 'meta' }, [tipoNome(m.tipoCriatura), m.tamanho, m.nivel ? `nível ${m.nivel}` : null, m.nomeEstagio].filter(Boolean).join(' · ')),
    est?.descricao ? h('p', { class: 'dica' }, icone('trending-up'), ` ${est.descricao}`) : null,
    // Mestre: perícias acima do limite (base + subperícia ≤ 5 + 5 × nível da criatura ou do estágio).
    mestre && periciasAcimaDoLimite(base, sis).length ? h('details', { class: 'aviso-revisar' },
      h('summary', {}, icone('triangle-alert'), ` Revisar perícias (${periciasAcimaDoLimite(base, sis).length})`),
      h('ul', {}, periciasAcimaDoLimite(base, sis).map(a => h('li', {}, a)))) : null,
    h('p', { class: 'meta icones-meta' },
      h('span', { title: 'Nível de dificuldade' }, icone('flame'), `ND ${textoND(m.dificuldade)}`),
      h('span', { title: 'Pontos de vida' }, icone('heart'), `PV ${m.pv ?? 'calc.'}`),
      h('span', { title: 'IP geral' }, icone('shield'), `IP ${m.ipGeral ?? m.defesa ?? 0}`),
      h('span', { title: `IP contra perfuração (base 5 + ½ ND = ${m.ipPerfuranteBase}${m.ipTipos.Perfuração > m.ipPerfuranteBase ? `, +${m.ipTipos.Perfuração - m.ipPerfuranteBase} da planilha` : ''})` }, icone('shield'), `Perfuração +${m.ipTipos.Perfuração}`),
      m.xp ? h('span', { title: 'XP' }, icone('sparkles'), `${m.xp} XP`) : null),
    h('p', { class: 'meta', title: 'Sem outro tipo descrito, só anda em terreno padrão' }, icone('footprints'), ` ${textoDeslocamentos(m.deslocamentos) || 'Andar —'}`,
      m.outrosDeslocamentos ? h('small', {}, ` (${m.outrosDeslocamentos})`) : null),
    atr ? h('p', { class: 'meta' }, atr) : null,
    m.ataques.length ? h('ul', { class: 'lista-ataques-monstro' }, m.ataques.map(a => h('li', {}, icone('sword'), ' ', h('strong', {}, a.nome),
      a.dano ? ` ${a.dano}${a.tipoDano ? ` ${a.tipoDano}` : ''}${a.alcance === 'distancia' ? ` · ${a.alcanceM ? `${a.alcanceM} m` : 'distância'}` : ''}${a.acerto != null ? ` · ${a.acerto}%` : a.pericia ? ` · ${subNome(a.pericia)}` : ''}` : '',
      a.estagios ? h('small', { class: 'selo' }, `estágio ${a.estagios.join(', ')}`) : null))) : null,
    m.afinidades?.length ? h('p', { class: 'meta', title: 'Recebe metade do dano do elemento principal' }, icone('flame'), ` Afinidade elementar: ${m.afinidades[0]} (principal, metade do dano)${m.afinidades[1] ? `, ${m.afinidades[1]}` : ''}`) : null,
    m.habilidades?.length ? h('ul', { class: 'lista-ataques-monstro' }, m.habilidades.map(x => h('li', { title: x.descricao || '' }, icone('sparkles'), ' ', h('strong', {}, x.nome), x.unica ? ' (única)' : '',
      x.estagios ? h('small', { class: 'selo' }, `estágio ${x.estagios.join(', ')}`) : null, x.descricao ? h('small', {}, ` — ${x.descricao}`) : null))) : null,
    extras.length ? h('p', { class: 'meta' }, extras.join(' · ')) : null,
    m.sentidos ? h('p', { class: 'meta' }, icone('eye'), ` ${m.sentidos}`) : null,
    m.comportamento ? h('details', {}, h('summary', {}, 'Comportamento'), h('p', {}, m.comportamento)) : null,
    m.habitat ? h('p', { class: 'meta' }, icone('map'), ` ${m.habitat}`) : null,
    m.descricao ? h('p', {}, m.descricao) : null,
    botoesImg,
    mestre ? h('div', { class: 'barra' },
      h('label', { class: 'linha' }, 'Quantos', h('input', { type: 'number', min: 1, max: 20, class: 'curto', value: qtd, onchange: e => { estado.sel[`monstroQtd:${base.nome}`] = Math.max(1, parseInt(e.target.value, 10) || 1); } })),
      botao(`Colocar no Campo de Batalha${est ? ` (estágio ${est.numero})` : ''}`, async () => {
        await acao('monstro.adicionar', { nome: base.nome, estagio: numEst, quantidade: estado.sel[`monstroQtd:${base.nome}`] || 1 });
        aviso(`${base.nome} entrou no Campo de Batalha.`);
      }, { class: 'pequeno primario', icone: 'swords' })) : null);
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
  const googleLink = h('input', { type: 'url', class: 'largo', placeholder: 'Link da planilha no Google (docs.google.com/spreadsheets/…)', value: estado.sel.monstrosGoogle ?? info?.googleSheets ?? '',
    'aria-label': 'Link da planilha no Google', oninput: e => { estado.sel.monstrosGoogle = e.target.value; } });
  return h('details', { class: 'bloco', open: !!estado.sel.monstrosAberto, ontoggle: e => { estado.sel.monstrosAberto = e.target.open; } },
    h('summary', {}, icone('file-spreadsheet'), ' Livro dos Monstros (planilha)'),
    h('p', { class: 'dica' }, info ? `${info.total} criaturas · ${info.origem === 'mestre' ? `enviado por você${info.arquivo ? ` (${info.arquivo})` : ''}${info.atualizadoEm ? ` · ${formatarData(info.atualizadoEm)}` : ''}` : 'Livro dos Monstros do autor (vem com as atualizações do app)'}.` : 'Carregando…'),
    h('p', { class: 'dica' }, 'Baixe a planilha, preencha as abas Monstros, Ataques, Habilidades e Estágios (instruções dentro dela) e envie de volta. Vale para todas as campanhas deste PC; monstros que já estão em campo não mudam.'),
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
      info?.origem === 'mestre' ? botao('Voltar ao livro do autor', async () => {
        if (!(await confirmar('Apagar o Livro dos Monstros enviado e voltar ao livro do autor?'))) return;
        await enviarArquivo('/api/monstros/padrao', new FormData());
        recarregar();
      }, { class: 'perigo', icone: 'refresh-cw' }) : null),
    // Planilha no Google: compartilhada como "Qualquer pessoa com o link" (Leitor), o app puxa direto dela.
    h('div', { class: 'barra' },
      googleLink,
      botao('Puxar do Google Planilhas', async () => {
        const r = await post('/api/monstros/google', { link: googleLink.value, modo: modo.value });
        recarregar();
        aviso(`${r.recebidos} monstros lidos do Google; o livro tem ${r.total}.${r.avisos?.length ? ` Atenção: ${r.avisos.join(' ')}` : ''}`, r.avisos?.length ? 'erro' : 'ok');
      }, { class: 'primario', icone: 'refresh-cw', title: 'A planilha precisa estar em Compartilhar > "Qualquer pessoa com o link" (Leitor)' })),
    h('p', { class: 'dica' }, info?.googleSheets
      ? 'Ligado à planilha do Google: o app puxa sozinho ao abrir e a cada 30 minutos. "Puxar do Google Planilhas" atualiza na hora. Enviar um arquivo .xlsx desliga a atualização automática.'
      : 'No Google Planilhas: Compartilhar > Acesso geral > "Qualquer pessoa com o link" (Leitor). Depois de puxar uma vez, o app passa a atualizar sozinho (ao abrir e a cada 30 minutos).'));
}

// Imagem do monstro: arquivo enviado pelo mestre ou link (Google Drive compartilhado ou endereço na internet).
function imagemMonstro(m, mestre, estagio = null) {
  const url = urlImagemMonstro(m, estagio);
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
    url ? h('img', { class: 'monstro-imagem', src: url, alt: m.nome, loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: e => e.target.replaceWith(h('p', { class: 'dica' }, icone('image'), ' A imagem não abriu. No Google Drive, compartilhe o arquivo como "Qualquer pessoa com o link".')) }) : null,
    mestre ? h('div', { class: 'barra' }, arquivo,
      botao(url ? 'Trocar imagem' : 'Enviar imagem', () => arquivo.click(), { class: 'pequeno', icone: 'camera' }),
      botao('Colar link', colar, { class: 'pequeno', icone: 'link' }),
      url && estado.campanha.imagensMonstros?.[m.nome] ? botao('', () => acao('monstro.imagem', { nome: m.nome, link: '' }), { class: 'pequeno perigo', icone: 'x', title: 'Tirar a imagem' }) : null) : null,
  ];
}

export function classesView() {
  const sis = estado.sistema;
  const q = busca('classes');
  const lista = sis.classes.filter(c => !q || sa(JSON.stringify(c)).includes(q));
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
  const f = l => l.filter(x => !q || sa(`${x.nome} ${x.descricao}`).includes(q));
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
  const lista = sis.pericias.filter(p => !q || sa(JSON.stringify(p)).includes(q));
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
    && (!q || sa(i.nome).includes(q) || sa(i.descricao).includes(q)));
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
