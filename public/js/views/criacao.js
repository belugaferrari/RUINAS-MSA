import { h, botao, aviso, vazio, confirmar, icone, titulo, tabela } from '../ui.js';
import { estado, render, mudar } from '../estado.js';
import { acao } from '../api.js';
import { novaFicha, pontosCampanha, pontosGastos } from '/shared/regras.js';
import { ICONE_TIPO } from './ficha.js';

const PASSOS = ['Pontos e nível', 'Identidade', 'Classe', 'Vantagens', 'Atributos', 'Perícias', 'Itens', 'Humanidade e Sanidade', 'Background', 'Revisão'];
const ICONES_PASSOS = ['trending-up', 'user', 'shield', 'sparkles', 'zap', 'target', 'backpack', 'brain', 'scroll', 'check'];

const chaveRascunho = () => `msa.criacao.${estado.campanha.id}.${estado.usuario.id}`;

function salvarRascunho() {
  try { localStorage.setItem(chaveRascunho(), JSON.stringify(estado.criacao)); } catch { /* sem armazenamento */ }
}

export function iniciarCriacao() {
  let rascunho = null;
  try { rascunho = JSON.parse(localStorage.getItem(chaveRascunho()) || 'null'); } catch { /* ignore */ }
  const c = estado.campanha;
  const maximo = pontosCampanha(c, estado.sistema);
  estado.criacao = rascunho || {
    passo: 0,
    ficha: novaFicha(estado.sistema, c),
    pontos: { ...maximo },
  };
  render();
}

export function cancelarCriacao() {
  try { localStorage.removeItem(chaveRascunho()); } catch { /* ignore */ }
  mudar({ criacao: null });
}

function alterar(fn) {
  fn(estado.criacao.ficha);
  salvarRascunho();
  render();
}

function input(chave, props = {}) {
  const f = estado.criacao.ficha;
  return h('input', { ...props, 'data-key': `cr:${chave}`, value: f[chave] ?? '', oninput: e => { f[chave] = e.target.value; salvarRascunho(); } });
}

function contador(rotulo, gasto, total) {
  const resta = total - gasto;
  return h('div', { class: `contador ${resta < 0 ? 'perigo' : resta === 0 ? 'ok' : ''}` }, `${rotulo}: ${gasto} de ${total} pontos · restam ${resta}`);
}

function passador(valor, min, max, aoMudar) {
  return h('span', { class: 'passador' },
    h('button', { type: 'button', 'aria-label': 'Diminuir', disabled: valor <= min, onclick: () => aoMudar(valor - 1) }, icone('minus')),
    h('strong', {}, valor),
    h('button', { type: 'button', 'aria-label': 'Aumentar', disabled: valor >= max, onclick: () => aoMudar(valor + 1) }, icone('plus')));
}

// ---------- passos ----------

function passoPontos() {
  const c = estado.campanha;
  const cr = estado.criacao;
  const maximo = pontosCampanha(c, estado.sistema);
  const fixo = c.padraoMSA;
  return h('div', { class: 'form' },
    h('p', {}, fixo
      ? 'O mestre escolheu o início padrão MSA: os pontos já estão definidos.'
      : 'O mestre definiu os pontos máximos. Você pode usar até esses valores.'),
    c.nivel === 'Variavel'
      ? h('label', {}, 'Nível inicial do personagem (1 a 20)',
        h('input', { type: 'number', min: 1, max: 20, value: cr.ficha.nivel, onchange: e => alterar(f => { f.nivel = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); }) }))
      : h('p', {}, h('strong', {}, `Nível: ${c.nivel}`), ' (definido pelo mestre)'),
    h('div', { class: 'grade3' }, ['atributos', 'vantagens', 'pericias'].map(k => h('label', {}, `${k[0].toUpperCase()}${k.slice(1)} (máx. ${maximo[k]})`,
      h('input', {
        type: 'number', min: 0, max: maximo[k], value: cr.pontos[k], disabled: fixo,
        onchange: e => { cr.pontos[k] = Math.max(0, Math.min(maximo[k], parseInt(e.target.value, 10) || 0)); salvarRascunho(); render(); },
      })))));
}

function passoIdentidade() {
  return h('div', { class: 'form' },
    h('label', {}, 'Nome do personagem *', input('nome', { required: true })),
    h('div', { class: 'grade3' }, h('label', {}, 'Idade', input('idade')), h('label', {}, 'Peso', input('peso')), h('label', {}, 'Tamanho', input('altura'))),
    h('label', {}, 'Instinto', input('instinto')),
    h('label', {}, 'Outras características (aparência, manias, origem…)',
      h('textarea', { rows: 4, 'data-key': 'cr:caracteristicas', value: estado.criacao.ficha.caracteristicas, oninput: e => { estado.criacao.ficha.caracteristicas = e.target.value; salvarRascunho(); } })),
    h('p', { class: 'dica' }, 'A foto do personagem é enviada depois, na própria ficha.'));
}

function passoClasse() {
  const f = estado.criacao.ficha;
  const classe = estado.sistema.classes.find(c => c.nome === f.classe);
  return h('div', {},
    h('div', { class: 'cartoes' }, estado.sistema.classes.map(c => h('button', {
      type: 'button', class: `cartao escolha ${f.classe === c.nome ? 'escolhido' : ''}`,
      onclick: () => alterar(x => { x.classe = c.nome; x.escolhasClasse = {}; }),
    }, titulo(c.nome, f.classe === c.nome ? 'check' : 'wand-sparkles'), h('p', {}, c.descricao)))),
    classe?.escolhas?.length ? h('div', { class: 'bloco' },
      titulo(`Escolhas próprias de ${classe.nome}`, 'sparkles'),
      classe.escolhas.map(e => {
        const atuais = f.escolhasClasse[e.id] || [];
        return h('fieldset', {}, h('legend', {}, `${e.rotulo} — escolha ${e.quantidade} (${atuais.length}/${e.quantidade})`),
          e.opcoes.map(o => h('label', { class: 'linha' },
            h('input', {
              type: 'checkbox', checked: atuais.includes(o), disabled: !atuais.includes(o) && atuais.length >= e.quantidade,
              onchange: ev => alterar(x => { x.escolhasClasse[e.id] = ev.target.checked ? [...atuais, o] : atuais.filter(y => y !== o); }),
            }), o)));
      })) : null);
}

function passoVantagens() {
  const f = estado.criacao.ficha;
  const gasto = pontosGastos(f, estado.sistema).vantagens;
  const total = estado.criacao.pontos.vantagens;
  return h('div', {},
    contador('Vantagens', gasto, total),
    h('div', { class: 'cartoes' }, estado.sistema.vantagens.map(v => {
      const tem = f.vantagens.includes(v.nome);
      return h('label', { class: `cartao escolha ${tem ? 'escolhido' : ''}` },
        h('div', { class: 'linha' },
          h('input', {
            type: 'checkbox', checked: tem, disabled: !tem && gasto + v.custo > total,
            onchange: e => alterar(x => { x.vantagens = e.target.checked ? [...x.vantagens, v.nome] : x.vantagens.filter(y => y !== v.nome); }),
          }),
          h('strong', {}, v.nome), h('span', { class: 'selo' }, `custo ${v.custo}`)),
        h('p', {}, v.descricao));
    })));
}

function passoValores(chave, lista) {
  const f = estado.criacao.ficha;
  const gastos = pontosGastos(f, estado.sistema);
  const total = estado.criacao.pontos[chave];
  const resta = total - gastos[chave];
  return h('div', {},
    contador(chave === 'atributos' ? 'Atributos' : 'Perícias', gastos[chave], total),
    h('div', { class: 'valores' }, lista.map(item => {
      const v = f[chave][item.nome] ?? 0;
      const min = item.min ?? 0;
      return h('div', { class: 'valor-linha' },
        h('span', {}, item.nome, item.atributo ? h('small', {}, ` (${item.atributo})`) : null),
        passador(v, min, Math.min(item.max ?? 99, v + resta), n => alterar(x => { x[chave][item.nome] = n; })));
    })));
}

function passoItens() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  return h('div', {},
    h('p', { class: 'contador' }, icone('coins'), h('strong', {}, ` Dinheiro disponível: ${f.dinheiro}`)),
    titulo('Itens escolhidos', 'backpack'),
    f.itens.length ? h('ul', { class: 'lista-inline' }, f.itens.map((i, idx) => h('li', {}, `${i.nome} (${i.preco}) `,
      h('button', { type: 'button', class: 'x so-icone', 'aria-label': `Devolver ${i.nome}`, title: `Devolver ${i.nome}`, onclick: () => alterar(x => { x.itens.splice(idx, 1); x.dinheiro += i.preco; }) }, icone('x'))))) : vazio('Nenhum item ainda.', 'backpack'),
    titulo('Catálogo', 'store'),
    tabela(['Item', 'Tipo', 'Preço', 'Dano/Def.', 'Bônus', ''], sis.itens.map(i => [
      h('span', { class: 'item-nome' }, icone(ICONE_TIPO[i.tipo] || 'tag'), i.nome), i.tipo, h('span', { class: 'moeda' }, icone('coins'), i.preco),
      [i.dano, i.defesa ? `Def ${i.defesa}` : null].filter(Boolean).join(' · ') || '—',
      Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—',
      h('button', {
        type: 'button', class: 'pequeno', disabled: f.dinheiro < i.preco,
        onclick: () => alterar(x => { x.itens.push({ ...structuredClone(i), itemId: i.id, equipado: false, durabilidadeAtual: i.durabilidade }); x.dinheiro -= i.preco; }),
      }, icone('plus'), 'Escolher'),
    ])),
    h('p', { class: 'dica' }, 'Você poderá equipar os itens na ficha depois de criada.'));
}

function passoMental() {
  const f = estado.criacao.ficha;
  const linha = (chave, rotulo) => h('label', {}, rotulo,
    h('input', { type: 'number', min: 0, value: f[chave].max, onchange: e => alterar(x => { const n = Math.max(0, parseInt(e.target.value, 10) || 0); x[chave] = { max: n, atual: n }; }) }));
  return h('div', { class: 'form' },
    h('p', { class: 'dica' }, 'Valores iniciais provisórios (vêm de conteudo/sistema.json). Quando as regras de Humanidade e Sanidade chegarem, este passo passa a calcular sozinho.'),
    h('div', { class: 'grade2' }, linha('humanidade', 'Humanidade'), linha('sanidade', 'Sanidade')));
}

function passoBackground() {
  const f = estado.criacao.ficha;
  return h('div', { class: 'form' },
    h('label', {}, 'História do personagem',
      h('textarea', { rows: 12, 'data-key': 'cr:background', value: f.background, oninput: e => { f.background = e.target.value; salvarRascunho(); } })));
}

function problemas() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const g = pontosGastos(f, sis);
  const p = estado.criacao.pontos;
  const lista = [];
  if (!f.nome.trim()) lista.push('Falta o nome do personagem.');
  for (const k of ['atributos', 'vantagens', 'pericias']) if (g[k] > p[k]) lista.push(`Pontos de ${k} acima do permitido (${g[k]}/${p[k]}).`);
  const classe = sis.classes.find(c => c.nome === f.classe);
  for (const e of classe?.escolhas || []) if ((f.escolhasClasse[e.id] || []).length !== e.quantidade) lista.push(`Classe: escolha ${e.quantidade} em "${e.rotulo}".`);
  return lista;
}

function passoRevisao() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const g = pontosGastos(f, sis);
  const p = estado.criacao.pontos;
  const erros = problemas();
  const sobra = ['atributos', 'vantagens', 'pericias'].filter(k => g[k] < p[k]).map(k => `${k}: ${p[k] - g[k]}`);
  return h('div', {},
    erros.length ? h('div', { class: 'alerta perigo' }, h('strong', {}, 'Antes de criar:'), h('ul', {}, erros.map(e => h('li', {}, e)))) : null,
    sobra.length ? h('div', { class: 'alerta' }, `Ainda sobram pontos — ${sobra.join(', ')}. Você pode criar assim mesmo.`) : null,
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco' }, titulo(f.nome || '(sem nome)', 'user'),
        h('p', {}, `Nível ${f.nivel} · ${f.classe}`), h('p', {}, `Idade ${f.idade || '—'} · Peso ${f.peso || '—'} · Tamanho ${f.altura || '—'}`), h('p', {}, `Instinto: ${f.instinto || '—'}`),
        h('p', {}, `Humanidade ${f.humanidade.max} · Sanidade ${f.sanidade.max} · PV ${f.pv.max}`)),
      h('section', { class: 'bloco' }, titulo('Atributos', 'zap'), h('ul', {}, sis.atributos.map(a => h('li', {}, `${a.nome}: ${f.atributos[a.nome]}`)))),
      h('section', { class: 'bloco' }, titulo('Perícias', 'target'), h('ul', {}, sis.pericias.filter(x => f.pericias[x.nome]).map(x => h('li', {}, `${x.nome}: ${f.pericias[x.nome]}`)))),
      h('section', { class: 'bloco' }, titulo('Vantagens e itens', 'sparkles'), h('p', {}, f.vantagens.join(', ') || 'Nenhuma vantagem'), h('p', {}, f.itens.map(i => i.nome).join(', ') || 'Nenhum item'), h('p', {}, `Dinheiro restante: ${f.dinheiro}`))));
}

const VIEWS = [passoPontos, passoIdentidade, passoClasse, passoVantagens, () => passoValores('atributos', estado.sistema.atributos), () => passoValores('pericias', estado.sistema.pericias), passoItens, passoMental, passoBackground, passoRevisao];

export function criacaoView() {
  const cr = estado.criacao;
  const ir = n => { cr.passo = n; salvarRascunho(); render(); window.scrollTo(0, 0); };
  const ultimo = cr.passo === PASSOS.length - 1;
  return h('div', { class: 'criacao' },
    h('div', { class: 'barra' },
      titulo('Criar personagem', 'feather', 'h2'), h('span', { class: 'espaco' }),
      botao('Cancelar', async () => { if (await confirmar('Descartar esta ficha em criação?')) cancelarCriacao(); }, { class: 'perigo', icone: 'x' })),
    h('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': PASSOS.length, 'aria-valuenow': cr.passo + 1, 'aria-label': 'Progresso da criação' },
      h('i', { style: { width: `${(100 * (cr.passo + 1)) / PASSOS.length}%` } })),
    h('ol', { class: 'passos', 'data-rolagem-x': 'passos' }, PASSOS.map((p, i) => h('li', { class: i === cr.passo ? 'atual' : i < cr.passo ? 'feito' : '' },
      h('button', { type: 'button', 'aria-current': i === cr.passo ? 'step' : null, onclick: () => ir(i) }, icone(i < cr.passo ? 'check' : ICONES_PASSOS[i]), `${i + 1}. ${p}`)))),
    h('section', { class: 'bloco passo' }, titulo(`Passo ${cr.passo + 1} de ${PASSOS.length} · ${PASSOS[cr.passo]}`, ICONES_PASSOS[cr.passo]), VIEWS[cr.passo]()),
    h('div', { class: 'barra navegacao-passos' },
      cr.passo > 0 ? h('button', { type: 'button', onclick: () => ir(cr.passo - 1) }, icone('arrow-left'), 'Voltar') : null,
      h('span', { class: 'espaco' }),
      ultimo
        ? botao('Criar personagem', async () => {
          const erros = problemas();
          if (erros.length) throw new Error(erros[0]);
          const { id } = await acao('personagem.criar', { tipo: 'pj', ficha: cr.ficha });
          try { localStorage.removeItem(chaveRascunho()); } catch { /* ignore */ }
          aviso('Personagem criado! Agora você pode enviar a foto na ficha.');
          mudar({ criacao: null, aba: 'ficha', sel: { ...estado.sel, personagem: id } });
        }, { class: 'primario', icone: 'check' })
        : h('button', { type: 'button', class: 'primario', onclick: () => ir(cr.passo + 1) }, 'Avançar', icone('arrow-left', 'gira'))));
}
