import { h, abas, botao, campo, selecao, aviso, confirmar, pedirTexto, janela, vazio } from '../ui.js';
import { estado, mudar, render, personagemPorId } from '../estado.js';
import { acao, emitir, enviarArquivo } from '../api.js';
import { topo, carregarSaguao } from './saguao.js';
import { fichaView } from './ficha.js';
import { salaView } from './salas.js';
import { livroView, monstrosView, classesView, lojaView, markdown } from './livros.js';
import { mapaRelacoesView } from './relacoes.js';

const ABAS = [
  ['jogadores', 'Jogadores'], ['npcs', 'NPCs'], ['imagens', 'Imagens'], ['social', 'Sala Social'], ['batalha', 'Campo de Batalha'],
  ['resumo', 'Resumo'], ['regras', 'Livro de Regras'], ['monstros', 'Livro dos Monstros'], ['mestre', 'Livro do Mestre'],
  ['loja', 'Loja'], ['classes', 'Classes'], ['lore', 'Lore'], ['campanha', 'Campanha'],
];

export function telaMestre() {
  const c = estado.campanha;
  const aba = estado.aba || 'jogadores';
  return h('div', {},
    topo(
      botao('← Campanhas', async () => {
        await emitir('campanha:sair');
        mudar({ tela: 'saguao', campanha: null });
        carregarSaguao();
      }, { class: 'pequeno' }),
      h('strong', {}, c.nome),
      h('label', { class: 'linha interruptor' },
        h('input', { type: 'checkbox', checked: c.aberta, onchange: e => acao('campanha.atualizar', { aberta: e.target.checked }).catch(err => aviso(err.message, 'erro')) }),
        c.aberta ? 'Aberta' : 'Fechada')),
    abas(ABAS, aba, id => mudar({ aba: id })),
    h('main', { class: 'conteudo' }, conteudoAba(aba)));
}

function conteudoAba(aba) {
  switch (aba) {
    case 'jogadores': return abaJogadores();
    case 'npcs': return abaNpcs();
    case 'imagens': return abaImagens();
    case 'social': return salaView('social');
    case 'batalha': return salaView('batalha');
    case 'resumo': return abaResumo();
    case 'regras': return livroView('regras', 'Livro de Regras');
    case 'monstros': return monstrosView();
    case 'mestre': return livroView('mestre', 'Livro do Mestre');
    case 'loja': return lojaView();
    case 'classes': return classesView();
    case 'lore': return abaLore();
    case 'campanha': return abaCampanha();
    default: return vazio('Aba desconhecida.');
  }
}

// Lista lateral + ficha aberta.
function listaComFicha(titulo, itens, acoesTopo, agrupar) {
  const selId = estado.sel.personagem;
  const sel = selId && itens.some(p => p.id === selId) ? personagemPorId(selId) : null;
  const item = p => h('li', {},
    h('button', { type: 'button', class: p.id === selId ? 'ativa' : '', onclick: () => { estado.sel.personagem = p.id; render(); } },
      p.foto ? h('img', { class: 'mini-foto', src: p.foto, alt: '' }) : null,
      h('span', {}, p.nome),
      h('small', {}, p.tipo === 'pj' ? (p.dono ? ` · ${p.dono}` : ' · livre') : ` · PV ${p.pv?.atual}/${p.pv?.max}`)));
  return h('div', { class: 'dividido' },
    h('aside', { class: 'lateral', 'data-rolagem': 'lateral' },
      h('h3', {}, titulo), acoesTopo,
      agrupar ? agrupar(item) : (itens.length ? h('ul', { class: 'lista-nomes' }, itens.map(item)) : vazio('Nenhum ainda.'))),
    h('section', {}, sel ? fichaView(sel, { mestre: true }) : h('p', { class: 'dica' }, 'Escolha um personagem na lista para ver e editar a ficha em tempo real.')));
}

function abaJogadores() {
  const c = estado.campanha;
  const pjs = c.personagens.filter(p => p.tipo === 'pj');
  return h('div', {},
    h('div', { class: 'bloco' },
      h('h3', {}, `Jogadores na campanha (${c.jogadores.length}/${c.maxJogadores})`),
      c.jogadores.length ? h('ul', { class: 'lista-inline' }, c.jogadores.map((id, i) => h('li', {}, c.jogadoresNomes[i],
        h('button', {
          class: 'x', title: 'Remover jogador',
          onclick: async () => { if (await confirmar(`Remover ${c.jogadoresNomes[i]} da campanha?`)) acao('jogador.remover', { userId: id }); },
        }, '×')))) : vazio(c.aberta ? 'Ninguém entrou ainda.' : 'Abra a campanha para os jogadores poderem entrar.')),
    listaComFicha('Personagens-jogador', pjs,
      botao('+ Criar personagem-jogador', async () => {
        const nome = await pedirTexto('Novo personagem-jogador', 'Nome (um jogador poderá assumir depois)');
        if (!nome) return;
        const { id } = await acao('personagem.criar', { tipo: 'pj', ficha: { nome } });
        estado.sel.personagem = id;
        render();
      }, { class: 'primario pequeno' })));
}

function abaNpcs() {
  const sub = estado.sel.npcSub || 'fichas';
  return h('div', {},
    abas([['fichas', 'Fichas por grupo'], ['mapa', 'Mapa de relacionamento']], sub, id => { estado.sel.npcSub = id; render(); }),
    sub === 'mapa' ? mapaRelacoesView() : abaNpcFichas());
}

function abaNpcFichas() {
  const c = estado.campanha;
  const npcs = c.personagens.filter(p => p.tipo === 'npc');
  const arquivo = h('input', {
    type: 'file', accept: '.xlsx', hidden: true,
    onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      const form = new FormData();
      form.append('arquivo', f);
      try {
        const r = await enviarArquivo(`/api/campanhas/${c.id}/importar-npcs`, form);
        aviso(`${r.importados} NPC(s) importado(s).`);
      } catch (err) {
        aviso(err.message, 'erro');
      }
      e.target.value = '';
    },
  });

  const novoNpc = grupoId => async () => {
    const nome = await pedirTexto('Novo NPC', 'Nome do NPC');
    if (!nome) return;
    const { id } = await acao('personagem.criar', { tipo: 'npc', grupoId, ficha: { nome } });
    estado.sel.personagem = id;
    render();
  };

  const acoesTopo = h('div', { class: 'pilha' },
    botao('+ Novo grupo', async () => {
      const nome = await pedirTexto('Novo grupo', 'Nome do grupo (ex.: Piratas, Vila do Farol)');
      if (nome) await acao('grupo.criar', { nome });
    }, { class: 'primario pequeno' }),
    h('a', { class: 'botao pequeno', href: '/api/modelo-npcs.xlsx', download: 'modelo_npcs.xlsx' }, '⬇ Planilha modelo (Excel)'),
    h('button', { type: 'button', class: 'pequeno', onclick: () => arquivo.click() }, '⬆ Importar Excel'), arquivo);

  const agrupar = item => h('div', {}, c.grupos.map(g => {
    const doGrupo = npcs.filter(p => p.grupoId === g.id);
    const aberto = estado.sel[`grupo:${g.id}`] !== false;
    return h('div', { class: 'grupo' },
      h('div', { class: 'grupo-topo' },
        h('button', { type: 'button', class: 'link', onclick: () => { estado.sel[`grupo:${g.id}`] = !aberto; render(); } }, `${aberto ? '▾' : '▸'} ${g.nome} (${doGrupo.length})`),
        h('span', { class: 'espaco' }),
        h('button', { type: 'button', class: 'x', title: 'Novo NPC neste grupo', onclick: novoNpc(g.id) }, '+'),
        g.id === 'encontros' ? null : h('button', {
          type: 'button', class: 'x', title: 'Renomear',
          onclick: async () => { const n = await pedirTexto('Renomear grupo', 'Nome', g.nome); if (n) acao('grupo.renomear', { id: g.id, nome: n }); },
        }, '✎'),
        g.id === 'encontros' ? null : h('button', { type: 'button', class: 'x', title: 'Apagar grupo', onclick: () => acao('grupo.remover', { id: g.id }).catch(e => aviso(e.message, 'erro')) }, '×')),
      aberto ? (doGrupo.length ? h('ul', { class: 'lista-nomes' }, doGrupo.map(item)) : h('p', { class: 'dica' }, 'Vazio.')) : null);
  }));

  return h('div', {},
    listaComFicha('NPCs', npcs, acoesTopo, agrupar),
    estado.sel.personagem && personagemPorId(estado.sel.personagem)?.tipo === 'npc' ? moverGrupo(personagemPorId(estado.sel.personagem)) : null);
}

function moverGrupo(p) {
  const grupos = estado.campanha.grupos;
  return h('div', { class: 'barra' }, h('span', {}, `Grupo de ${p.nome}:`),
    selecao(grupos.map(g => ({ valor: g.id, rotulo: g.nome })), p.grupoId, v => acao('personagem.atualizar', { id: p.id, patch: { grupoId: v } })),
    h('label', { class: 'linha' }, 'Dificuldade (encontros)',
      campo(`${p.id}:dificuldade`, p.dificuldade ?? '', v => acao('personagem.atualizar', { id: p.id, patch: { dificuldade: v } }), { tipo: 'number', class: 'num' })));
}

function abaImagens() {
  const c = estado.campanha;
  const titulo = h('input', { placeholder: 'Título (ex.: Mapa da Ilha Norte)' });
  const categoria = h('input', { placeholder: 'Categoria (Personagens, Mapas…)', list: 'categorias-img' });
  const arquivo = h('input', { type: 'file', accept: 'image/*' });
  const categorias = [...new Set(c.imagens.map(i => i.categoria))];
  const filtro = estado.sel.imgCat || '';
  const lista = c.imagens.filter(i => !filtro || i.categoria === filtro);
  return h('div', {},
    h('div', { class: 'bloco' },
      h('h3', {}, 'Enviar imagem'),
      h('div', { class: 'barra' }, titulo, categoria, h('datalist', { id: 'categorias-img' }, categorias.map(k => h('option', { value: k }))), arquivo,
        botao('Enviar', async () => {
          if (!arquivo.files[0]) throw new Error('Escolha um arquivo.');
          const form = new FormData();
          form.append('arquivo', arquivo.files[0]);
          form.append('titulo', titulo.value);
          form.append('categoria', categoria.value || 'Geral');
          await enviarArquivo(`/api/campanhas/${c.id}/imagens`, form);
          aviso('Imagem enviada.');
        }, { class: 'primario' }))),
    h('div', { class: 'barra' }, h('span', {}, 'Categoria:'),
      selecao([{ valor: '', rotulo: 'Todas' }, ...categorias], filtro, v => { estado.sel.imgCat = v; render(); }),
      c.imagens.some(i => i.mostrando) ? botao('Parar de mostrar todas', () => Promise.all(c.imagens.filter(i => i.mostrando).map(i => acao('imagem.mostrar', { id: i.id, mostrando: false })))) : null),
    lista.length ? h('div', { class: 'galeria' }, lista.map(i => h('figure', { class: i.mostrando ? 'mostrando' : '' },
      h('img', { src: i.url, alt: i.titulo, onclick: () => janela(i.titulo, h('img', { src: i.url, class: 'img-cheia', alt: i.titulo })) }),
      h('figcaption', {}, h('strong', {}, i.titulo), h('small', {}, i.categoria)),
      h('div', { class: 'acoes' },
        botao(i.mostrando ? 'Ocultar dos jogadores' : 'Mostrar aos jogadores', () => acao('imagem.mostrar', { id: i.id, mostrando: !i.mostrando }), { class: i.mostrando ? 'pequeno' : 'pequeno primario' }),
        botao('×', async () => { if (await confirmar(`Apagar "${i.titulo}"?`)) await acao('imagem.remover', { id: i.id }); }, { class: 'pequeno perigo' }))))) : vazio('Nenhuma imagem.'));
}

function abaResumo() {
  const c = estado.campanha;
  const pjs = c.personagens.filter(p => p.tipo === 'pj');
  const t = x => (x ? `${x.atual}/${x.max}` : '—');
  return h('div', { class: 'dividido largo-dir' },
    h('section', { class: 'bloco' }, h('h3', {}, 'Anotações do mestre'),
      campo('resumo', c.anotacoesResumo, v => acao('campanha.atualizar', { anotacoesResumo: v }), { multilinha: true, rows: 22, placeholder: 'Ganchos, segredos, o que aconteceu…' })),
    h('section', { class: 'bloco' }, h('h3', {}, 'Personagens-jogador'),
      pjs.length ? h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, ['Personagem', 'Jogador', 'PV', 'Sanidade', 'Humanidade', 'Marcadores', 'XP'].map(x => h('th', {}, x)))),
        h('tbody', {}, pjs.map(p => h('tr', {},
          h('td', {}, h('button', { type: 'button', class: 'link', onclick: () => mudar({ aba: 'jogadores', sel: { ...estado.sel, personagem: p.id } }) }, p.nome)),
          h('td', {}, p.dono || '—'),
          h('td', { class: p.pv?.atual <= 0 ? 'perigo' : '' }, t(p.pv)), h('td', {}, t(p.sanidade)), h('td', {}, t(p.humanidade)),
          h('td', {}, (p.marcadores || []).map(m => h('span', { class: 'etiqueta' }, m))),
          h('td', {}, p.xp || 0))))) : vazio('Nenhum personagem-jogador ainda.')));
}

function abaLore() {
  const c = estado.campanha;
  const editando = estado.sel.sessaoEditando;
  return h('div', { class: 'dividido largo-dir' },
    h('section', { class: 'bloco' },
      h('h3', {}, 'Background da história'),
      h('p', { class: 'dica' }, 'Os jogadores leem este texto na aba Lore. Aceita formatação Markdown (# título, **negrito**, listas).'),
      campo('lore', c.lore.background, v => acao('lore.atualizar', { background: v }), { multilinha: true, rows: 18 })),
    h('section', { class: 'bloco' },
      h('div', { class: 'barra' }, h('h3', {}, 'Resumo das sessões'), h('span', { class: 'espaco' }),
        botao('+ Nova sessão', () => acao('lore.sessao.salvar', { titulo: `Sessão ${c.lore.sessoes.length + 1}`, data: new Date().toLocaleDateString('pt-BR'), texto: '' }), { class: 'primario pequeno' })),
      c.lore.sessoes.length ? [...c.lore.sessoes].reverse().map(s => h('article', { class: 'sessao' },
        editando === s.id
          ? h('div', { class: 'form' },
            h('div', { class: 'grade2' },
              h('label', {}, 'Título', campo(`sess:${s.id}:t`, s.titulo, v => acao('lore.sessao.salvar', { ...s, titulo: v }))),
              h('label', {}, 'Data', campo(`sess:${s.id}:d`, s.data, v => acao('lore.sessao.salvar', { ...s, data: v })))),
            campo(`sess:${s.id}:x`, s.texto, v => acao('lore.sessao.salvar', { ...s, texto: v }), { multilinha: true, rows: 8 }),
            h('div', { class: 'barra' }, botao('Concluir', () => { estado.sel.sessaoEditando = null; render(); }),
              botao('Apagar', async () => { if (await confirmar(`Apagar "${s.titulo}"?`)) await acao('lore.sessao.remover', { id: s.id }); }, { class: 'perigo' })))
          : h('div', {}, h('div', { class: 'barra' }, h('h4', {}, `${s.titulo} — ${s.data}`), h('span', { class: 'espaco' }),
            botao('Editar', () => { estado.sel.sessaoEditando = s.id; render(); }, { class: 'pequeno' })), markdown(s.texto)))) : vazio('Nenhuma sessão registrada.')));
}

function abaCampanha() {
  const c = estado.campanha;
  return h('div', { class: 'dividido largo-dir' },
    h('section', { class: 'bloco' },
      h('h3', {}, 'Configurações'),
      h('div', { class: 'form' },
        h('label', {}, 'Nome', campo('c:nome', c.nome, v => acao('campanha.atualizar', { nome: v }))),
        h('label', {}, 'Máximo de jogadores (até 9)', campo('c:max', c.maxJogadores, v => acao('campanha.atualizar', { maxJogadores: v }), { tipo: 'number', min: 1, max: 9 })),
        h('p', {}, `Nível inicial: ${c.nivel === 'Variavel' ? 'Variável' : c.nivel}`),
        h('p', {}, c.padraoMSA ? 'Início padrão MSA' : `Pontos: atributos ${c.pontos.atributos}, vantagens ${c.pontos.vantagens}, perícias ${c.pontos.pericias}`),
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: c.aberta, onchange: e => acao('campanha.atualizar', { aberta: e.target.checked }) }), 'Campanha aberta para jogadores'),
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: c.lojaAberta, onchange: e => acao('campanha.atualizar', { lojaAberta: e.target.checked }) }), 'Loja liberada'))),
    h('section', { class: 'bloco' },
      h('h3', {}, 'Anotações da campanha'),
      h('p', { class: 'dica' }, 'Só você vê este texto.'),
      campo('c:notas', c.anotacoes, v => acao('campanha.atualizar', { anotacoes: v }), { multilinha: true, rows: 22 })));
}
