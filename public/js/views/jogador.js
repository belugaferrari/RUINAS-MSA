import { h, abas, botao, selecao, aviso, confirmar, vazio, formatarData, icone, titulo, passador } from '../ui.js';
import { derivados, ganhosDeClasse, pontosGastos, pontosPericiaTotal } from '/shared/regras.js';
import { painelPericias } from './pericias.js';
import { estado, mudar, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao, emitir } from '../api.js';
import { topo, carregarSaguao } from './saguao.js';
import { fichaView, equipamento, nomeClasse } from './ficha.js';
import { salaView } from './salas.js';
import { lojaView, markdown, referenciaView } from './livros.js';
import { redesSociaisView } from './relacoes.js';
import { criacaoView, iniciarCriacao } from './criacao.js';
import { painelDados, dadosAberto } from './dados.js';
import { confrontoView } from './confronto.js';

const ABAS = [
  ['ficha', 'Ficha', 'user'], ['lore', 'Lore', 'scroll'], ['redes', 'Redes Sociais', 'network'], ['itens', 'Itens', 'backpack'],
  ['armas', 'Armas e Armadilhas', 'axe'], ['social', 'Sala Social', 'drama'], ['batalha', 'Campo de Batalha', 'swords'], ['confronto', 'Confronto', 'scale'],
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
    h('div', { class: `area-campanha ${dadosAberto() ? 'com-dados' : ''}` },
      h('main', { class: 'conteudo' }, conteudoAba(aba, atual)),
      painelDados()),
    imagensMostradas());
}

function escolherPersonagem(meus) {
  const livres = estado.campanha.personagens.filter(p => p.tipo === 'pj' && !p.donoId);
  return h('div', {},
    titulo('Escolha seu personagem', 'users', 'h2'),
    meus.length ? h('div', { class: 'cartoes' }, meus.map(p => h('button', { type: 'button', class: 'cartao escolha', onclick: () => mudar({ sel: { ...estado.sel, personagem: p.id }, aba: 'ficha' }) },
      p.foto ? h('img', { class: 'retrato', src: p.foto, alt: '' }) : h('div', { class: 'retrato vazio-retrato' }, icone('user')),
      h('h3', {}, p.nome), h('p', { class: 'meta' }, `${nomeClasse(p)} · Nível ${p.nivel}`)))) : vazio('Você ainda não tem personagens nesta campanha.', 'user'),
    livres.length ? h('div', {},
      titulo('Personagens criados pelo mestre (livres)', 'crown'),
      h('div', { class: 'cartoes' }, livres.map(p => h('div', { class: 'cartao' },
        h('h3', {}, p.nome), h('p', { class: 'meta' }, `${nomeClasse(p)} · Nível ${p.nivel}`),
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
    case 'confronto': return confrontoView();
    case 'evoluir': return evoluirView(p);
    case 'regras': return referenciaView('livro', true);
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

const CAMPOS_EVOLUCAO = ['nivel', 'classe', 'especializacao', 'atributos', 'pericias', 'subpericias', 'vantagens', 'defeitos', 'pv', 'sanidade', 'humanidade'];

function evoluirView(p) {
  const sis = estado.sistema;
  if (estado.sel.evolucao?.id !== p.id) {
    estado.sel.evolucao = { id: p.id, ficha: structuredClone(Object.fromEntries(CAMPOS_EVOLUCAO.map(k => [k, p[k] ?? (k === 'pericias' || k === 'subpericias' || k === 'atributos' ? {} : k === 'vantagens' || k === 'defeitos' ? [] : '')]))), xpGasto: 0 };
  }
  const ev = estado.sel.evolucao;
  const f = ev.ficha;
  const d = derivados(f, sis);
  const mudou = k => JSON.stringify(f[k]) !== JSON.stringify(p[k]);
  const ppTotal = pontosPericiaTotal(f, sis);
  const ppGasto = pontosGastos(f, sis).pericias;
  const muda = fn => { fn(f); render(); };
  const classe = sis.classes.find(c => c.id === f.classe);
  const novosGanhos = ganhosDeClasse(f, sis).filter(g => g.nivel > p.nivel);

  return h('div', { class: 'evoluir' },
    h('div', { class: 'barra' },
      titulo(`Evoluir ${p.nome}`, 'trending-up', 'h2'),
      h('span', { class: 'selo ok' }, icone('sparkles'), `XP disponível: ${p.xp || 0}`),
      h('span', { class: 'espaco' }),
      botao('Desfazer mudanças', () => { estado.sel.evolucao = null; render(); }, { icone: 'refresh-cw' })),
    h('p', { class: 'dica' }, 'Custos de XP e pontos de atributo por nível ainda não estão no livro: informe o XP gasto e combine com o mestre. Ao confirmar, a ficha antiga vira backup.'),
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco' }, titulo('Nível, classe e especialização', 'crown'),
        h('div', { class: 'valor-linha' }, h('span', {}, 'Nível'), h('small', {}, `atual ${p.nivel}`), passador(f.nivel, p.nivel, 20, v => muda(x => { x.nivel = v; }), 'nível')),
        d.temClasse ? h('label', {}, 'Classe', p.classe
          ? h('strong', {}, sis.classes.find(c => c.id === p.classe)?.nome)
          : selecao([{ valor: '', rotulo: '— escolher —' }, ...sis.classes.map(c => ({ valor: c.id, rotulo: c.nome }))], f.classe, v => muda(x => { x.classe = v; x.especializacao = ''; }))) : h('p', { class: 'dica' }, `Classe no nível ${sis.regras.nivelClasse}.`),
        classe && d.temEspecializacao ? h('label', {}, 'Especialização', p.especializacao
          ? h('strong', {}, classe.especializacoes.find(e => e.id === p.especializacao)?.nome)
          : selecao([{ valor: '', rotulo: '— escolher —' }, ...classe.especializacoes.map(e => ({ valor: e.id, rotulo: e.nome }))], f.especializacao, v => muda(x => { x.especializacao = v; }))) : null,
        novosGanhos.length ? h('div', {}, titulo('Você ganha', 'sparkles', 'h4'),
          h('ul', { class: 'ganhos' }, novosGanhos.map(g => h('li', { title: g.descricao }, h('span', { class: 'selo' }, `nv ${g.nivel}`), ' ', g.nome)))) : null,
        h('p', { class: 'meta' }, `PV máx. ${p.pv.max} → ${d.pvMax} · Sanidade máx. ${p.sanidade.max} → ${d.sanidadeMax} · Humanidade máx. ${p.humanidade?.max ?? '—'} → ${d.humanidadeMax}`)),
      h('section', { class: 'bloco' }, titulo(`Atributos (máx. ${d.atributoMax} no nível ${f.nivel})`, 'zap'),
        h('div', { class: 'valores' }, sis.atributos.map(a => h('div', { class: `valor-linha ${f.atributos[a.sigla] !== p.atributos[a.sigla] ? 'marcado' : ''}` },
          h('span', {}, h('strong', {}, a.sigla), ' ', a.nome), h('small', {}, `atual ${p.atributos[a.sigla]}`),
          passador(f.atributos[a.sigla], p.atributos[a.sigla], d.atributoMax, v => muda(x => { x.atributos[a.sigla] = v; }), a.nome))))),
      h('section', { class: 'bloco largo' }, titulo('Perícias', 'target'),
        h('div', { class: `contador ${ppGasto > ppTotal ? 'perigo' : ''}` }, `Pontos de perícia: ${ppGasto} de ${ppTotal} (fórmula do nível ${f.nivel}) · limite ${d.limitePericia}`),
        painelPericias(f, {
          d, chave: `evoluir:${p.id}`,
          editar: {
            limite: d.limitePericia,
            maxRestante: () => ppTotal - pontosGastos(f, sis).pericias,
            minBase: id => p.pericias?.[id] ?? 0,
            minSub: id => p.subpericias?.[id] ?? 0,
            base: (id, v) => muda(x => { x.pericias = { ...x.pericias, [id]: v }; }),
            sub: (id, v) => muda(x => { x.subpericias = { ...x.subpericias, [id]: v }; }),
          },
        })),
      h('section', { class: 'bloco largo' }, titulo('Novas vantagens', 'sparkles'),
        h('p', { class: 'dica' }, 'Nos níveis marcados como "Vantagem Extra" na tabela da classe você ganha uma vantagem.'),
        selecao([{ valor: '', rotulo: '+ adicionar vantagem' }, ...sis.vantagens.filter(v => !f.vantagens.includes(v.id)).map(v => ({ valor: v.id, rotulo: v.nome + (v.requisito ? ` [${v.requisito}]` : '') }))], '',
          v => v && muda(x => { x.vantagens = [...x.vantagens, v]; })),
        h('ul', { class: 'lista-inline' }, f.vantagens.filter(id => !p.vantagens.includes(id)).map(id => h('li', {}, sis.vantagens.find(v => v.id === id)?.nome,
          h('button', { type: 'button', class: 'x so-icone', 'aria-label': 'Remover', onclick: () => muda(x => { x.vantagens = x.vantagens.filter(y => y !== id); }) }, icone('x'))))))),
    h('div', { class: 'barra' },
      h('label', { class: 'linha' }, 'XP gasto nesta evolução',
        h('input', { type: 'number', min: 0, max: p.xp || 0, value: ev.xpGasto, class: 'curto', onchange: e => { ev.xpGasto = parseInt(e.target.value, 10) || 0; } })),
      botao('Confirmar evolução', async () => {
        if (ppGasto > ppTotal) throw new Error('Pontos de perícia acima do total.');
        // PV e Sanidade máximos seguem as fórmulas; o atual acompanha o ganho.
        for (const [k, novo] of [['pv', d.pvMax], ['sanidade', d.sanidadeMax], ['humanidade', d.humanidadeMax]]) f[k] = { max: novo, atual: p[k].atual + (novo - p[k].max) };
        const patch = Object.fromEntries(CAMPOS_EVOLUCAO.filter(mudou).map(k => [k, f[k]]));
        if (!Object.keys(patch).length) throw new Error('Nada foi alterado.');
        if (!(await confirmar(`Confirmar evolução gastando ${ev.xpGasto} XP? Um backup da ficha atual será salvo.`))) return;
        await acao('personagem.evoluir', { id: p.id, patch, xpGasto: ev.xpGasto });
        estado.sel.evolucao = null;
        aviso('Evolução salva!');
      }, { class: 'primario', icone: 'check' })),
    titulo('Histórico de backups', 'save'),
    (p.backups || []).length ? h('ul', {}, [...p.backups].reverse().map(b => h('li', {}, `${formatarData(b.em)} — nível ${b.ficha.nivel}`))) : vazio('Nenhuma evolução ainda.', 'save'));
}
