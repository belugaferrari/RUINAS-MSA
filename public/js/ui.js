// Mini-biblioteca de interface: cria elementos, campos com rascunho, avisos e janelas.

export function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  const tardios = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'selected') tardios[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  anexar(el, filhos);
  Object.assign(el, tardios);
  return el;
}

function anexar(el, filhos) {
  for (const f of filhos) {
    if (f == null || f === false) continue;
    if (Array.isArray(f)) anexar(el, f);
    else el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

// Rascunhos: o que a pessoa está digitando sobrevive às atualizações em tempo real vindas de outros jogadores.
const rascunhos = new Map();

export function campo(chave, valor, salvar, opts = {}) {
  const { tipo = 'text', multilinha = false, ...resto } = opts;
  const atual = rascunhos.has(chave) ? rascunhos.get(chave) : (valor ?? '');
  const el = multilinha
    ? h('textarea', { ...resto, 'data-key': chave, value: atual })
    : h('input', { ...resto, type: tipo, 'data-key': chave, value: atual });
  el.addEventListener('input', () => rascunhos.set(chave, el.value));
  el.addEventListener('change', async () => {
    const v = tipo === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
    try {
      await salvar(v);
    } catch (e) {
      aviso(e.message, 'erro');
    } finally {
      rascunhos.delete(chave);
    }
  });
  return el;
}

export function selecao(opcoes, valor, aoMudar, props = {}) {
  return h('select', { ...props, value: valor ?? '', onchange: e => aoMudar(e.target.value) },
    opcoes.map(o => (typeof o === 'string' ? h('option', { value: o }, o) : h('option', { value: o.valor, disabled: o.desabilitado }, o.rotulo))));
}

export function botao(rotulo, aoClicar, props = {}) {
  return h('button', {
    type: 'button', ...props,
    onclick: async e => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        await aoClicar(e);
      } catch (err) {
        aviso(err.message, 'erro');
      } finally {
        b.disabled = false;
      }
    },
  }, rotulo);
}

export function aviso(texto, tipo = 'ok') {
  const caixa = document.getElementById('avisos');
  const el = h('div', { class: `aviso ${tipo}` }, texto);
  caixa.append(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 6000 : 3500);
}

export function janela(titulo, conteudo, acoes = []) {
  const raiz = document.getElementById('janela');
  const fechar = () => raiz.replaceChildren();
  raiz.replaceChildren(h('div', { class: 'fundo', onclick: e => e.target === e.currentTarget && fechar() },
    h('div', { class: 'janela' },
      h('header', {}, h('h3', {}, titulo), h('button', { class: 'fechar', onclick: fechar, 'aria-label': 'Fechar' }, '×')),
      h('div', { class: 'corpo' }, conteudo),
      acoes.length ? h('footer', {}, acoes.map(([rot, fn, cls]) => botao(rot, async () => { if ((await fn()) !== false) fechar(); }, { class: cls }))) : null)));
  raiz.querySelector('input, select, textarea')?.focus();
  return fechar;
}

export function confirmar(pergunta) {
  return new Promise(ok => {
    janela('Confirmar', h('p', {}, pergunta), [['Cancelar', () => ok(false)], ['Confirmar', () => ok(true), 'perigo']]);
  });
}

export function pedirTexto(titulo, rotulo, inicial = '') {
  return new Promise(ok => {
    const inp = h('input', { value: inicial, onkeydown: e => e.key === 'Enter' && document.querySelector('.janela footer button:last-child')?.click() });
    janela(titulo, h('label', {}, rotulo, inp), [['Cancelar', () => ok(null)], ['OK', () => ok(inp.value.trim() || null), 'primario']]);
  });
}

export function abas(lista, atual, aoTrocar) {
  return h('nav', { class: 'abas' }, lista.map(([id, rotulo]) =>
    h('button', { type: 'button', class: id === atual ? 'ativa' : '', onclick: () => aoTrocar(id) }, rotulo)));
}

export function vazio(texto) {
  return h('p', { class: 'vazio' }, texto);
}

export function formatarData(ms) {
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
