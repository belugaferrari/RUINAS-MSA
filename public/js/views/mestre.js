import { h, abas, botao, campo, selecao, aviso, confirmar, pedirTexto, janela, vazio, icone, titulo } from '../ui.js';
import { efeitosIcones, marcadoresLivres } from './efeitos.js';
import { estado, mudar, render, personagemPorId } from '../estado.js';
import { acao, emitir, enviarArquivo, get, post } from '../api.js';
import { topo, carregarSaguao, listaSistemas } from './saguao.js';
import { fichaView } from './ficha.js';
import { salaView } from './salas.js';
import { livroView, monstrosView, lojaView, markdown, referenciaView } from './livros.js';
import { mapaRelacoesView } from './relacoes.js';
import { painelDados, dadosAberto } from './dados.js';
import { confrontoView } from './confronto.js';
import { criacaoView, iniciarCriacao } from './criacao.js';
import { versaoApp } from './versao.js';
import { mapaView } from './mapa.js';

const ABAS = [
  ['jogadores', 'Jogadores', 'users'], ['npcs', 'NPCs', 'ghost'], ['imagens', 'Imagens', 'image'], ['social', 'Sala Social', 'drama'],
  ['batalha', 'Campo de Batalha', 'swords'], ['mapa', 'Mapa', 'map'], ['confronto', 'Confronto', 'scale'], ['resumo', 'Resumo', 'heart-pulse'], ['regras', 'Livro de Regras', 'book-open'],
  ['monstros', 'Livro dos Monstros', 'skull'], ['mestre', 'Livro do Mestre', 'library'], ['loja', 'Loja', 'store'],
  ['classes', 'Classes', 'shield'], ['lore', 'Lore', 'scroll'], ['campanha', 'Campanha', 'notebook-pen'],
];

export function telaMestre() {
  const c = estado.campanha;
  const aba = estado.aba || 'jogadores';
  return h('div', {},
    topo(
      botao('Campanhas', async () => {
        await emitir('campanha:sair');
        mudar({ tela: 'saguao', campanha: null });
        carregarSaguao();
      }, { class: 'pequeno compacto', icone: 'arrow-left', title: 'Voltar às campanhas', 'aria-label': 'Voltar às campanhas' }),
      h('strong', { class: 'nome-campanha' }, c.nome),
      h('label', { class: 'linha interruptor' },
        h('input', { type: 'checkbox', checked: c.aberta, onchange: e => acao('campanha.atualizar', { aberta: e.target.checked }).catch(err => aviso(err.message, 'erro')) }),
        icone(c.aberta ? 'lock-open' : 'lock'), h('span', {}, c.aberta ? 'Aberta' : 'Fechada'))),
    abas(ABAS, aba, id => mudar({ aba: id })),
    h('div', { class: `area-campanha ${dadosAberto() ? 'com-dados' : 'dados-recolhidos'}` },
      h('main', { class: 'conteudo' }, estado.criacao ? criacaoView() : conteudoAba(aba)),
      painelDados()));
}

function conteudoAba(aba) {
  switch (aba) {
    case 'jogadores': return abaJogadores();
    case 'npcs': return abaNpcs();
    case 'imagens': return abaImagens();
    case 'social': return salaView('social');
    case 'batalha': return salaView('batalha');
    case 'mapa': return mapaView();
    case 'confronto': return confrontoView();
    case 'resumo': return abaResumo();
    case 'regras': return livroView(estado.sistema.livro || 'regras-msa', `Livro de Regras · ${estado.sistema.nome}`);
    case 'monstros': return monstrosView();
    case 'mestre': return livroView('mestre', 'Livro do Mestre');
    case 'loja': return lojaView();
    case 'classes': return referenciaView('classes', false);
    case 'lore': return abaLore();
    case 'campanha': return abaCampanha();
    default: return vazio('Aba desconhecida.');
  }
}

// Lista lateral + ficha aberta.
function listaComFicha(nomeLista, itens, acoesTopo, agrupar, iconeLista = 'users') {
  const selId = estado.sel.personagem;
  const sel = selId && itens.some(p => p.id === selId) ? personagemPorId(selId) : null;
  const item = p => h('li', {},
    h('button', { type: 'button', class: p.id === selId ? 'ativa' : '', onclick: () => { estado.sel.personagem = p.id; render(); } },
      p.foto ? h('img', { class: 'mini-foto', src: p.foto, alt: '' }) : null,
      h('span', {}, p.nome),
      h('small', {}, p.tipo === 'pj' ? (p.dono ? ` · ${p.dono}` : ' · livre') : ` · PV ${p.pv?.atual}/${p.pv?.max}`)));
  return h('div', { class: `dividido ${sel ? 'com-sel' : ''}` },
    h('aside', { class: 'lateral', 'data-rolagem': 'lateral' },
      titulo(nomeLista, iconeLista), acoesTopo,
      agrupar ? agrupar(item) : (itens.length ? h('ul', { class: 'lista-nomes' }, itens.map(item)) : vazio('Nenhum ainda.'))),
    h('section', {},
      sel ? botao('Voltar à lista', () => { estado.sel.personagem = null; render(); }, { class: 'voltar-lista', icone: 'arrow-left' }) : null,
      sel ? fichaView(sel, { mestre: true }) : h('p', { class: 'dica so-desktop' }, icone('info'), 'Escolha um personagem na lista para ver e editar a ficha em tempo real.')));
}

function abaJogadores() {
  const c = estado.campanha;
  const pjs = c.personagens.filter(p => p.tipo === 'pj');
  return h('div', {},
    h('div', { class: 'bloco' },
      titulo(`Jogadores na campanha (${c.jogadores.length}/${c.maxJogadores})`, 'users'),
      c.jogadores.length ? h('ul', { class: 'lista-inline' }, c.jogadores.map((id, i) => h('li', {}, c.jogadoresNomes[i],
        botao('', async () => { if (await confirmar(`Remover ${c.jogadoresNomes[i]} da campanha?`)) await acao('jogador.remover', { userId: id }); },
          { class: 'x', icone: 'user-round-x', title: `Remover ${c.jogadoresNomes[i]}` })))) : vazio(c.aberta ? 'Ninguém entrou ainda.' : 'Abra a campanha para os jogadores poderem entrar.')),
    listaComFicha('Personagens-jogador', pjs,
      // O assistente é o mesmo do jogador, com as mesmas travas de pontos (conferidas no servidor).
      [botao('Criar com o assistente', iniciarCriacao, { class: 'primario pequeno', icone: 'feather' }),
      botao('Ficha em branco', async () => {
        const nome = await pedirTexto('Novo personagem-jogador', 'Nome (um jogador poderá assumir depois)');
        if (!nome) return;
        const { id } = await acao('personagem.criar', { tipo: 'pj', ficha: { nome } });
        estado.sel.personagem = id;
        render();
      }, { class: 'pequeno', icone: 'user-plus', title: 'Cria só com o nome; os pontos continuam travados pelo nível' })]));
}

function abaNpcs() {
  const sub = estado.sel.npcSub || 'fichas';
  return h('div', {},
    abas([['fichas', 'Fichas por grupo', 'ghost'], ['mapa', 'Mapa de relacionamento', 'network']], sub, id => { estado.sel.npcSub = id; render(); }),
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
    botao('Novo grupo', async () => {
      const nome = await pedirTexto('Novo grupo', 'Nome do grupo (ex.: Piratas, Vila do Farol)');
      if (nome) await acao('grupo.criar', { nome });
    }, { class: 'primario pequeno', icone: 'plus' }),
    h('a', { class: 'botao pequeno', href: `/api/modelo-npcs.xlsx?sistema=${c.sistema || 'msa'}`, download: 'modelo_npcs.xlsx' }, icone('download'), 'Planilha modelo (Excel)'),
    botao('Importar Excel', () => arquivo.click(), { class: 'pequeno', icone: 'file-spreadsheet' }), arquivo);

  const agrupar = item => h('div', {}, c.grupos.map(g => {
    const doGrupo = npcs.filter(p => p.grupoId === g.id);
    const aberto = estado.sel[`grupo:${g.id}`] !== false;
    return h('div', { class: 'grupo' },
      h('div', { class: 'grupo-topo' },
        h('button', { type: 'button', class: 'link grupo-nome', 'aria-expanded': aberto, onclick: () => { estado.sel[`grupo:${g.id}`] = !aberto; render(); } },
          icone(aberto ? 'chevron-down' : 'chevron-up'), `${g.nome} (${doGrupo.length})`),
        h('span', { class: 'espaco' }),
        botao('', novoNpc(g.id), { class: 'x', icone: 'plus', title: `Novo NPC em ${g.nome}` }),
        g.id === 'encontros' ? null : botao('', async () => {
          const n = await pedirTexto('Renomear grupo', 'Nome', g.nome);
          if (n) await acao('grupo.renomear', { id: g.id, nome: n });
        }, { class: 'x', icone: 'pencil', title: `Renomear ${g.nome}` }),
        g.id === 'encontros' ? null : botao('', () => acao('grupo.remover', { id: g.id }), { class: 'x', icone: 'trash-2', title: `Apagar grupo ${g.nome}` })),
      aberto ? (doGrupo.length ? h('ul', { class: 'lista-nomes' }, doGrupo.map(item)) : h('p', { class: 'dica' }, 'Vazio.')) : null);
  }));

  return h('div', {},
    listaComFicha('NPCs', npcs, acoesTopo, agrupar, 'ghost'),
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
  const campoTitulo = h('input', { placeholder: 'Título (ex.: Mapa da Ilha Norte)' });
  const categoria = h('input', { placeholder: 'Categoria (Personagens, Mapas…)', list: 'categorias-img' });
  const arquivo = h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm' });
  const categorias = [...new Set(c.imagens.map(i => i.categoria))];
  const filtro = estado.sel.imgCat || '';
  const lista = c.imagens.filter(i => !filtro || i.categoria === filtro);
  return h('div', {},
    h('div', { class: 'bloco' },
      titulo('Enviar imagem, GIF ou vídeo', 'upload'),
      h('p', { class: 'dica' }, 'Imagens até 10 MB; vídeos MP4/WEBM até 60 MB (para mapas animados, aba Mapa).'),
      h('div', { class: 'barra' }, campoTitulo, categoria, h('datalist', { id: 'categorias-img' }, categorias.map(k => h('option', { value: k }))), arquivo,
        botao('Enviar', async () => {
          if (!arquivo.files[0]) throw new Error('Escolha um arquivo.');
          const form = new FormData();
          form.append('arquivo', arquivo.files[0]);
          form.append('titulo', campoTitulo.value);
          form.append('categoria', categoria.value || 'Geral');
          await enviarArquivo(`/api/campanhas/${c.id}/imagens`, form);
          aviso('Imagem enviada.');
        }, { class: 'primario', icone: 'upload' }))),
    h('div', { class: 'barra' }, h('span', {}, 'Categoria:'),
      selecao([{ valor: '', rotulo: 'Todas' }, ...categorias], filtro, v => { estado.sel.imgCat = v; render(); }),
      c.imagens.some(i => i.mostrando) ? botao('Parar de mostrar todas', () => Promise.all(c.imagens.filter(i => i.mostrando).map(i => acao('imagem.mostrar', { id: i.id, mostrando: false }))), { icone: 'eye-off' }) : null),
    lista.length ? h('div', { class: 'galeria' }, lista.map(i => h('figure', { class: i.mostrando ? 'mostrando' : '' },
      i.tipo === 'video' ? h('video', { src: i.url, muted: true, loop: true, playsinline: true, controls: true, class: 'miniatura-video' })
        : h('img', { src: i.url, alt: i.titulo, onclick: () => janela(i.titulo, h('img', { src: i.url, class: 'img-cheia', alt: i.titulo })) }),
      h('figcaption', {}, h('strong', {}, i.titulo), h('small', {}, i.categoria)),
      h('label', { class: 'linha', title: 'O Suporte pode mostrar e esconder esta imagem para os jogadores' },
        h('input', { type: 'checkbox', checked: !!i.suporte, onchange: e => acao('imagem.suporte', { id: i.id, liberada: e.target.checked }) }), 'Liberar para o Suporte'),
      h('div', { class: 'acoes' },
        botao(i.mostrando ? 'Ocultar dos jogadores' : 'Mostrar aos jogadores', () => acao('imagem.mostrar', { id: i.id, mostrando: !i.mostrando }), { class: i.mostrando ? 'pequeno' : 'pequeno primario', icone: i.mostrando ? 'eye-off' : 'eye' }),
        botao('', async () => { if (await confirmar(`Apagar "${i.titulo}"?`)) await acao('imagem.remover', { id: i.id }); }, { class: 'pequeno perigo', icone: 'trash-2', title: `Apagar ${i.titulo}` }))))) : vazio('Nenhuma imagem.', 'image'));
}

function abaResumo() {
  const c = estado.campanha;
  const pjs = c.personagens.filter(p => p.tipo === 'pj');
  const t = x => (x ? `${x.atual}/${x.max}` : '—');
  return h('div', { class: 'dividido largo-dir' },
    h('section', { class: 'bloco' }, titulo('Anotações do mestre', 'notebook-pen'),
      campo('resumo', c.anotacoesResumo, v => acao('campanha.atualizar', { anotacoesResumo: v }), { multilinha: true, rows: 22, placeholder: 'Ganchos, segredos, o que aconteceu…' })),
    h('section', { class: 'bloco' }, titulo('Personagens-jogador', 'users'),
      pjs.length ? h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, ['Personagem', 'Jogador', 'PV', 'Sanidade', 'Humanidade', 'Marcadores', 'XP'].map(x => h('th', {}, x)))),
        h('tbody', {}, pjs.map(p => h('tr', {},
          h('td', {}, h('button', { type: 'button', class: 'link', onclick: () => mudar({ aba: 'jogadores', sel: { ...estado.sel, personagem: p.id } }) }, p.nome)),
          h('td', {}, p.dono || '—'),
          h('td', { class: p.pv?.atual <= 0 ? 'perigo' : '' }, t(p.pv)), h('td', {}, t(p.sanidade)), h('td', {}, t(p.humanidade)),
          h('td', {}, efeitosIcones(p, { mestre: true }), marcadoresLivres(p).map(m => h('span', { class: 'etiqueta' }, m))),
          h('td', {}, p.xp || 0))))) : vazio('Nenhum personagem-jogador ainda.')));
}

function abaLore() {
  const c = estado.campanha;
  const editando = estado.sel.sessaoEditando;
  return h('div', { class: 'dividido largo-dir' },
    h('section', { class: 'bloco' },
      titulo('Background da história', 'scroll'),
      h('p', { class: 'dica' }, 'Os jogadores leem este texto na aba Lore. Aceita formatação Markdown (# título, **negrito**, listas).'),
      campo('lore', c.lore.background, v => acao('lore.atualizar', { background: v }), { multilinha: true, rows: 18 })),
    h('section', { class: 'bloco' },
      h('div', { class: 'barra' }, titulo('Resumo das sessões', 'bookmark'), h('span', { class: 'espaco' }),
        botao('Nova sessão', () => acao('lore.sessao.salvar', { titulo: `Sessão ${c.lore.sessoes.length + 1}`, data: new Date().toLocaleDateString('pt-BR'), texto: '' }), { class: 'primario pequeno', icone: 'plus' })),
      c.lore.sessoes.length ? [...c.lore.sessoes].reverse().map(s => h('article', { class: 'sessao' },
        editando === s.id
          ? h('div', { class: 'form' },
            h('div', { class: 'grade2' },
              h('label', {}, 'Título', campo(`sess:${s.id}:t`, s.titulo, v => acao('lore.sessao.salvar', { ...s, titulo: v }))),
              h('label', {}, 'Data', campo(`sess:${s.id}:d`, s.data, v => acao('lore.sessao.salvar', { ...s, data: v })))),
            campo(`sess:${s.id}:x`, s.texto, v => acao('lore.sessao.salvar', { ...s, texto: v }), { multilinha: true, rows: 8 }),
            h('div', { class: 'barra' }, botao('Concluir', () => { estado.sel.sessaoEditando = null; render(); }, { icone: 'check' }),
              botao('Apagar', async () => { if (await confirmar(`Apagar "${s.titulo}"?`)) await acao('lore.sessao.remover', { id: s.id }); }, { class: 'perigo', icone: 'trash-2' })))
          : h('div', {}, h('div', { class: 'barra' }, h('h4', {}, `${s.titulo} — ${s.data}`), h('span', { class: 'espaco' }),
            botao('Editar', () => { estado.sel.sessaoEditando = s.id; render(); }, { class: 'pequeno', icone: 'pencil' })), markdown(s.texto)))) : vazio('Nenhuma sessão registrada.', 'bookmark')));
}

// Troca do sistema de regras no meio da campanha (as fichas continuam; os cálculos passam a seguir o novo sistema).
function seletorSistema(c) {
  const lista = estado.sel.listaSistemas;
  if (!lista) listaSistemas().then(l => { estado.sel.listaSistemas = l; render(); }).catch(() => {});
  return h('div', { class: 'cartao-mini' },
    titulo('Sistema de regras', 'book', 'h4'),
    h('div', { class: 'cartoes sistemas' }, (lista || []).map(x => h('button', {
      type: 'button', class: `cartao escolha ${x.id === c.sistema ? 'escolhido' : ''}`, 'aria-pressed': x.id === c.sistema,
      onclick: async () => {
        if (x.id === c.sistema) return;
        const ok = await confirmar(`Trocar a campanha para o ${x.nome} (${x.nomeCompleto})? As fichas continuam como estão; atributos, perícias e cálculos passam a seguir o ${x.nome}. Os jogadores veem a troca na hora.`);
        if (ok) await acao('campanha.atualizar', { sistema: x.id });
      },
    }, h('strong', {}, `${x.nome} · ${x.nomeCompleto}`), h('p', {}, x.descricao)))));
}

// Contas que podem entrar como Suporte (a do mestre sempre pode, em outro aparelho).
function suportesView() {
  const c = estado.campanha;
  const nome = h('input', { placeholder: 'Nome da conta', 'aria-label': 'Nome da conta do Suporte' });
  return h('section', { class: 'bloco' },
    titulo('Suporte', 'presentation'),
    h('p', { class: 'dica' }, 'O Suporte abre só o Mapa (mexe nos peões) e as imagens que você liberar, para apresentar aos jogadores sem usar a sua tela. A sua própria conta pode entrar como Suporte em outro aparelho; outras contas, só as listadas aqui.'),
    (c.suportesNomes || []).length ? h('ul', { class: 'lista-inline' }, c.suportesNomes.map(x => h('li', {}, x.nome || '(conta apagada)',
      botao('', () => acao('suporte.remover', { userId: x.id }), { class: 'x', icone: 'x', title: `Tirar ${x.nome} do Suporte` })))) : null,
    h('div', { class: 'barra' }, nome, botao('Liberar Suporte', async () => {
      if (!nome.value.trim()) throw new Error('Digite o nome da conta.');
      await acao('suporte.adicionar', { nome: nome.value });
      aviso(`${nome.value.trim()} pode entrar como Suporte.`);
    }, { class: 'pequeno primario', icone: 'user-plus' })));
}

// Fichas de teste: um PJ livre por classe (nível escolhido) e o relatório do que pode dar problema nas habilidades.
function fichasTesteView() {
  const nivel = h('input', { type: 'number', min: 3, max: 20, value: 6, class: 'curto', 'aria-label': 'Nível das fichas de teste' });
  return h('section', { class: 'bloco' },
    titulo('Fichas de teste', 'flask-conical'),
    h('p', { class: 'dica' }, 'Cria um personagem-jogador livre de cada classe (com especialização, vantagens e perícias) para testar as habilidades. Eles aparecem em Jogadores e podem ser apagados depois.'),
    h('div', { class: 'barra' }, h('label', { class: 'linha' }, 'Nível', nivel),
      botao('Criar fichas de teste', async () => {
        const r = await acao('teste.fichas', { nivel: nivel.value });
        janela('Fichas de teste criadas', h('ul', { class: 'lista-regras' }, r.relatorio.map(x => h('li', {},
          h('strong', {}, x.nome), h('small', {}, ` — ${x.total} habilidades/vantagens, ${x.comEfeito} com bônus que o app soma, ${x.lembretes} só lembrete`),
          x.avisos.length ? h('ul', {}, x.avisos.map(a => h('li', { class: 'perigo' }, a))) : h('small', { class: 'bloco-texto' }, 'Sem problemas encontrados.')))));
      }, { class: 'primario', icone: 'users' })));
}

function abaCampanha() {
  const c = estado.campanha;
  return h('div', { class: 'dividido largo-dir' },
    suportesView(),
    fichasTesteView(),
    h('section', { class: 'bloco' },
      titulo('Configurações', 'settings'),
      h('div', { class: 'form' },
        h('label', {}, 'Nome', campo('c:nome', c.nome, v => acao('campanha.atualizar', { nome: v }))),
        h('label', {}, 'Máximo de jogadores (até 9)', campo('c:max', c.maxJogadores, v => acao('campanha.atualizar', { maxJogadores: v }), { tipo: 'number', min: 1, max: 9 })),
        seletorSistema(c),
        h('p', {}, `Nível inicial: ${c.nivel === 'Variavel' ? 'Variável' : c.nivel}`),
        h('p', {}, c.padraoMSA ? 'Início padrão do livro' : `Pontos: atributos ${c.pontos.atributos}, vantagens ${c.pontos.vantagens}, perícias ${c.pontos.pericias}`),
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: c.aberta, onchange: e => acao('campanha.atualizar', { aberta: e.target.checked }) }), 'Campanha aberta para jogadores'),
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: c.lojaAberta, onchange: e => acao('campanha.atualizar', { lojaAberta: e.target.checked }) }), 'Loja liberada'),
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: !!c.edicaoLivre, onchange: e => acao('campanha.atualizar', { edicaoLivre: e.target.checked }) }),
          'Edição livre das fichas de jogador'),
        h('p', { class: 'dica' }, 'Edição livre desligada (padrão): ao editar fichas de jogador, o mestre segue os mesmos limites de pontos da criação e só sobe o nível com o XP necessário. Ligue só para corrigir fichas.'),
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: c.dadosNaTela !== false, onchange: e => acao('campanha.atualizar', { dadosNaTela: e.target.checked }) }),
          'Mostrar as rolagens (D-MIL) na tela de todos'))),
    versaoApp(),
    h('section', { class: 'bloco' },
      titulo('Anotações da campanha', 'notebook-pen'),
      h('p', { class: 'dica' }, 'Só você vê este texto.'),
      campo('c:notas', c.anotacoes, v => acao('campanha.atualizar', { anotacoes: v }), { multilinha: true, rows: 22 })));
}
