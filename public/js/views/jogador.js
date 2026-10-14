import { h, abas, botao, selecao, aviso, confirmar, vazio, formatarData, icone, titulo } from '../ui.js';
import { estado, mudar, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao, emitir } from '../api.js';
import { topo, carregarSaguao } from './saguao.js';
import { fichaView, equipamento } from './ficha.js';
import { salaView } from './salas.js';
import { livroView, lojaView, markdown } from './livros.js';
import { redesSociaisView } from './relacoes.js';
import { criacaoView, iniciarCriacao } from './criacao.js';

const ABAS = [
  ['ficha', 'Ficha', 'user'], ['lore', 'Lore', 'scroll'], ['redes', 'Redes Sociais', 'network'], ['itens', 'Itens', 'backpack'],
  ['armas', 'Armas e Armadilhas', 'axe'], ['social', 'Sala Social', 'drama'], ['batalha', 'Campo de Batalha', 'swords'],
  ['evoluir', 'Evoluir', 'trending-up'], ['regras', 'Livro de Regras', 'book-open'], ['loja', 'Loja', 'store'],
];

const imagensDispensadas = new Set();

export function telaJogador() {
  const c = estado.campanha;
  const meus = meusPersonagens();
  const atual = meus.find(p => p.id === estado.sel.personagem);
  const voltar = botao('Campanhas', async () => {
    await emitir('campanha:sair');
    mudar({ tela: 'saguao', campanha: null, criacao: null });
    carregarSaguao();
  }, { class: 'pequeno compacto', icone: 'arrow-left', title: 'Voltar às campanhas', 'aria-label': 'Voltar às campanhas' });
  const nomeCampanha = h('strong', { class: 'nome-campanha' }, c.nome);

  if (estado.criacao) return h('div', {}, topo(voltar, nomeCampanha), h('main', { class: 'conteudo estreito' }, criacaoView()));
  if (!atual) return h('div', {}, topo(voltar, nomeCampanha), h('main', { class: 'conteudo estreito' }, escolherPersonagem(meus)), imagensMostradas());

  const aba = estado.aba || 'ficha';
  return h('div', {},
    topo(voltar, nomeCampanha,
      meus.length > 1
        ? selecao(meus.map(p => ({ valor: p.id, rotulo: p.nome })), atual.id, v => { estado.sel.personagem = v; render(); }, { 'aria-label': 'Personagem' })
        : h('span', { class: 'personagem-atual' }, atual.foto ? h('img', { class: 'mini-foto', src: atual.foto, alt: '' }) : icone('user'), atual.nome),
      botao('Trocar personagem', () => { estado.sel.personagem = null; render(); }, { class: 'pequeno compacto', icone: 'users', title: 'Trocar personagem', 'aria-label': 'Trocar personagem' })),
    abas(ABAS, aba, id => mudar({ aba: id })),
    h('main', { class: 'conteudo' }, conteudoAba(aba, atual)),
    imagensMostradas());
}

function escolherPersonagem(meus) {
  const livres = estado.campanha.personagens.filter(p => p.tipo === 'pj' && !p.donoId);
  return h('div', {},
    titulo('Escolha seu personagem', 'users', 'h2'),
    meus.length ? h('div', { class: 'cartoes' }, meus.map(p => h('button', { type: 'button', class: 'cartao escolha', onclick: () => mudar({ sel: { ...estado.sel, personagem: p.id }, aba: 'ficha' }) },
      p.foto ? h('img', { class: 'retrato', src: p.foto, alt: '' }) : h('div', { class: 'retrato vazio-retrato' }, icone('user')),
      h('h3', {}, p.nome), h('p', { class: 'meta' }, `${p.classe} · Nível ${p.nivel}`)))) : vazio('Você ainda não tem personagens nesta campanha.', 'user'),
    livres.length ? h('div', {},
      titulo('Personagens criados pelo mestre (livres)', 'crown'),
      h('div', { class: 'cartoes' }, livres.map(p => h('div', { class: 'cartao' },
        h('h3', {}, p.nome), h('p', { class: 'meta' }, `${p.classe || 'Sem classe'} · Nível ${p.nivel}`),
        botao('Assumir este personagem', async () => {
          await acao('personagem.assumir', { id: p.id });
          mudar({ sel: { ...estado.sel, personagem: p.id }, aba: 'ficha' });
        }, { class: 'primario', icone: 'user-plus' }))))) : null,
    h('div', { class: 'barra' }, botao('Criar novo personagem', iniciarCriacao, { class: 'primario', icone: 'feather' })));
}

function conteudoAba(aba, p) {
  const c = estado.campanha;
  switch (aba) {
    case 'ficha': return fichaView(p);
    case 'lore': return h('div', { class: 'estreito' },
      titulo('Lore', 'scroll', 'h2'), markdown(c.lore.background || '_O mestre ainda não escreveu o background._'),
      titulo('Sessões', 'bookmark', 'h2'),
      c.lore.sessoes.length ? [...c.lore.sessoes].reverse().map(s => h('article', { class: 'sessao' }, h('h3', {}, `${s.titulo} — ${s.data}`), markdown(s.texto))) : vazio('Nenhuma sessão registrada ainda.', 'bookmark'));
    case 'redes': return redesSociaisView(p);
    case 'itens': return h('div', {}, h('div', { class: 'barra' }, titulo(`Itens de ${p.nome}`, 'backpack', 'h2'), h('span', { class: 'selo moeda' }, icone('coins'), p.dinheiro ?? 0)), equipamento(p, false));
    case 'armas': return h('div', {},
      titulo('Armas e armadilhas', 'axe', 'h2'),
      equipamento(p, false, i => ['arma', 'armadilha', 'defesa'].includes(i.tipo)),
      lojaView({ titulo: 'Catálogo de armas, defesas e armadilhas', tipos: ['arma', 'armadilha', 'defesa'] }));
    case 'social': return salaView('social');
    case 'batalha': return salaView('batalha');
    case 'evoluir': return evoluirView(p);
    case 'regras': return livroView('regras', 'Livro de Regras');
    case 'loja': return lojaView();
    default: return vazio('Aba desconhecida.');
  }
}

// O mestre controla quais imagens aparecem aqui (aba Imagens dele).
function imagensMostradas() {
  const lista = (estado.campanha.imagens || []).filter(i => !imagensDispensadas.has(i.id));
  if (!lista.length) return null;
  return h('div', { class: 'vitrine' },
    h('div', { class: 'vitrine-topo' }, h('strong', {}, icone('image'), ' O mestre está mostrando'),
      botao('', () => { lista.forEach(i => imagensDispensadas.add(i.id)); render(); }, { class: 'x', icone: 'x', title: 'Fechar imagens' })),
    lista.map(i => h('figure', {}, h('a', { href: i.url, target: '_blank' }, h('img', { src: i.url, alt: i.titulo })), h('figcaption', {}, i.titulo))));
}

// ---------- Evoluir ----------

const CAMPOS_EVOLUCAO = ['nivel', 'classe', 'escolhasClasse', 'atributos', 'pericias', 'vantagens', 'pv', 'sanidade', 'humanidade'];

function evoluirView(p) {
  const sis = estado.sistema;
  if (estado.sel.evolucao?.id !== p.id) {
    estado.sel.evolucao = { id: p.id, ficha: structuredClone(Object.fromEntries(CAMPOS_EVOLUCAO.map(k => [k, p[k]]))), xpGasto: 0 };
  }
  const ev = estado.sel.evolucao;
  const f = ev.ficha;
  const mudou = k => JSON.stringify(f[k]) !== JSON.stringify(p[k]);
  const passo = (obj, k, min, max) => h('span', { class: 'passador' },
    h('button', { type: 'button', 'aria-label': 'Diminuir', disabled: obj[k] <= min, onclick: () => { obj[k] -= 1; render(); } }, icone('minus')),
    h('strong', {}, obj[k]),
    h('button', { type: 'button', 'aria-label': 'Aumentar', disabled: obj[k] >= max, onclick: () => { obj[k] += 1; render(); } }, icone('plus')));
  const linhaValor = (chave, item) => h('div', { class: `valor-linha ${f[chave][item.nome] !== p[chave][item.nome] ? 'marcado' : ''}` },
    h('span', {}, item.nome), h('small', {}, `atual ${p[chave][item.nome]}`), passo(f[chave], item.nome, p[chave][item.nome], item.max ?? 99));

  return h('div', {},
    h('div', { class: 'barra' },
      titulo(`Evoluir ${p.nome}`, 'trending-up', 'h2'),
      h('span', { class: 'selo ok' }, icone('sparkles'), `XP disponível: ${p.xp || 0}`),
      h('span', { class: 'espaco' }),
      botao('Desfazer mudanças', () => { estado.sel.evolucao = null; render(); }, { icone: 'refresh-cw' })),
    h('p', { class: 'dica' }, 'Os custos de XP ainda não estão automatizados: informe quanto XP esta evolução gasta. Ao confirmar, uma cópia da ficha antiga é guardada como backup.'),
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco' }, titulo('Nível e classe', 'crown'),
        h('div', { class: 'valor-linha' }, h('span', {}, 'Nível'), h('small', {}, `atual ${p.nivel}`), passo(f, 'nivel', p.nivel, 20)),
        h('label', {}, 'Classe', selecao(sis.classes.map(c => c.nome), f.classe, v => { f.classe = v; render(); })),
        h('h4', {}, 'Máximos'),
        ['pv', 'sanidade', 'humanidade'].map(k => h('div', { class: 'valor-linha' }, h('span', {}, k === 'pv' ? 'PV' : k), h('small', {}, `atual ${p[k].max}`),
          h('span', { class: 'passador' },
            h('button', { type: 'button', 'aria-label': 'Diminuir', disabled: f[k].max <= p[k].max, onclick: () => { f[k] = { ...f[k], max: f[k].max - 1 }; render(); } }, icone('minus')),
            h('strong', {}, f[k].max),
            h('button', { type: 'button', 'aria-label': 'Aumentar', onclick: () => { f[k] = { ...f[k], max: f[k].max + 1 }; render(); } }, icone('plus')))))),
      h('section', { class: 'bloco' }, titulo('Atributos', 'zap'), h('div', { class: 'valores' }, sis.atributos.map(a => linhaValor('atributos', a)))),
      h('section', { class: 'bloco' }, titulo('Perícias', 'target'), h('div', { class: 'valores' }, sis.pericias.map(x => linhaValor('pericias', x)))),
      h('section', { class: 'bloco' }, titulo('Vantagens', 'sparkles'),
        sis.vantagens.map(v => h('label', { class: 'linha' },
          h('input', { type: 'checkbox', checked: f.vantagens.includes(v.nome), disabled: p.vantagens.includes(v.nome), onchange: e => { f.vantagens = e.target.checked ? [...f.vantagens, v.nome] : f.vantagens.filter(x => x !== v.nome); render(); } }),
          `${v.nome} (custo ${v.custo})`)))),
    h('div', { class: 'barra' },
      h('label', { class: 'linha' }, 'XP gasto nesta evolução',
        h('input', { type: 'number', min: 0, max: p.xp || 0, value: ev.xpGasto, class: 'curto', onchange: e => { ev.xpGasto = parseInt(e.target.value, 10) || 0; } })),
      botao('Confirmar evolução', async () => {
        const patch = Object.fromEntries(CAMPOS_EVOLUCAO.filter(mudou).map(k => [k, f[k]]));
        if (!Object.keys(patch).length) throw new Error('Nada foi alterado.');
        if (!(await confirmar(`Confirmar evolução gastando ${ev.xpGasto} XP? Um backup da ficha atual será salvo.`))) return;
        // Ao subir o máximo, o atual acompanha o ganho.
        for (const k of ['pv', 'sanidade', 'humanidade']) if (patch[k]) patch[k] = { ...patch[k], atual: p[k].atual + (patch[k].max - p[k].max) };
        await acao('personagem.evoluir', { id: p.id, patch, xpGasto: ev.xpGasto });
        estado.sel.evolucao = null;
        aviso('Evolução salva!');
      }, { class: 'primario', icone: 'check' })),
    titulo('Histórico de backups', 'save'),
    (p.backups || []).length ? h('ul', {}, [...p.backups].reverse().map(b => h('li', {}, `${formatarData(b.em)} — nível ${b.ficha.nivel}, classe ${b.ficha.classe}`))) : vazio('Nenhuma evolução ainda.', 'save'));
}
