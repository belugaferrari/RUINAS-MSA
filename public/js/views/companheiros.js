// Aba Companheiros: familiares, animais, montarias, autômatos, invenções e implantes do personagem.
// Cada um é um personagem do jogador ligado ao personagem dele: entra no Campo de Batalha (o dono controla) e no mapa
// (o mestre põe). Pode nascer de uma criatura do Livro dos Monstros ou em branco; o mestre ajusta a ficha (aba NPCs › Companheiros).
import { h, botao, selecao, aviso, confirmar, vazio, icone, titulo, janela, barraPv, numeroPv } from '../ui.js';
import { estado, render } from '../estado.js';
import { acao } from '../api.js';
import { efeitosIcones } from './efeitos.js';
import { fichaView } from './ficha.js';

const TIPOS = [
  ['familiar', 'Familiar'], ['animal', 'Animal'], ['montaria', 'Montaria'], ['automato', 'Autômato / drone'],
  ['invencao', 'Invenção'], ['implante', 'Implante'], ['outro', 'Outro'],
];
const nomeTipo = id => TIPOS.find(t => t[0] === id)?.[1] || 'Companheiro';

export function companheirosView(p) {
  const c = estado.campanha;
  const mestre = c.papel === 'mestre';
  const lista = c.personagens.filter(x => x.companheiroDe === p.id);
  const batalha = c.salas.batalha.participantes;
  return h('div', { class: 'companheiros' },
    h('div', { class: 'barra' }, titulo(`Companheiros de ${p.nome}`, 'paw-print', 'h2')),
    h('p', { class: 'dica' }, 'Familiares, animais, montarias, autômatos, invenções e implantes que agem por conta própria. Você os controla no Campo de Batalha; o mestre os põe no mapa e ajusta a ficha.'),
    lista.length ? h('div', { class: 'cartoes' }, lista.map(x => {
      const naBatalha = batalha.includes(x.id);
      return h('div', { class: 'cartao companheiro' },
        h('div', { class: 'barra' },
          h('span', { class: 'avatar rosto', 'data-pid': x.id }, x.foto ? h('img', { src: x.foto, alt: '' }) : x.nome.slice(0, 1)),
          h('div', {}, h('strong', {}, x.nome), h('div', { class: 'meta' }, nomeTipo(x.companheiroTipo)))),
        x.pv ? barraPv(x) : null,
        x.pv ? h('p', { class: 'meta icones-meta' }, h('span', {}, icone('heart'), numeroPv(x))) : null,
        efeitosIcones(x, { mestre }),
        h('div', { class: 'barra' },
          botao('Ficha', () => janela(`Ficha de ${x.nome}`, fichaView(x), [['Fechar', () => true]]), { class: 'pequeno', icone: 'user' }),
          botao(naBatalha ? 'Sair do Campo de Batalha' : 'Entrar no Campo de Batalha', () => acao(naBatalha ? 'sala.remover' : 'sala.adicionar', { sala: 'batalha', id: x.id }).catch(e => aviso(e.message, 'erro')),
            { class: `pequeno ${naBatalha ? '' : 'primario'}`, icone: 'swords' }),
          botao('', async () => { if (await confirmar(`Remover ${x.nome}?`)) await acao('companheiro.remover', { id: x.id }); }, { class: 'pequeno perigo', icone: 'trash-2', title: `Remover ${x.nome}` })));
    })) : vazio('Nenhum companheiro ainda.', 'paw-print'),
    novoCompanheiro(p));
}

// Criar: nome, tipo e, se quiser, uma criatura do Livro dos Monstros como base (atributos, ataques, habilidades).
function novoCompanheiro(p) {
  const sis = estado.sistema;
  const f = (estado.sel.novoCompanheiro ||= { nome: '', tipo: 'animal', monstro: '' });
  const nome = h('input', { value: f.nome, placeholder: 'Nome (ex.: Fumaça)', 'aria-label': 'Nome do companheiro', oninput: e => { f.nome = e.target.value; } });
  const monstros = [...(sis.monstros || [])].sort((a, b) => a.nome.localeCompare(b.nome));
  return h('section', { class: 'bloco' },
    titulo('Novo companheiro', 'plus', 'h3'),
    h('div', { class: 'barra' },
      nome,
      selecao(TIPOS.map(([valor, rotulo]) => ({ valor, rotulo })), f.tipo, v => { f.tipo = v; }, { 'aria-label': 'Tipo de companheiro' }),
      selecao([{ valor: '', rotulo: 'Ficha em branco' }, ...monstros.map(m => ({ valor: m.nome, rotulo: `Base: ${m.nome}` }))], f.monstro, v => { f.monstro = v; }, { 'aria-label': 'Criatura do Livro dos Monstros como base' }),
      botao('Criar', async () => {
        if (!f.nome.trim() && !f.monstro) throw new Error('Dê um nome ou escolha uma criatura como base.');
        await acao('companheiro.criar', { de: p.id, nome: f.nome.trim(), tipo: f.tipo, monstro: f.monstro || null });
        estado.sel.novoCompanheiro = null;
        aviso('Companheiro criado.');
        render();
      }, { class: 'primario', icone: 'paw-print' })),
    h('p', { class: 'dica' }, 'Com uma criatura como base, o companheiro já vem com atributos, ataques e habilidades dela. As regras de cada classe (Treinador, Ciborgue, Inventor…) para companheiros entram depois.'));
}

// Mestre (autor, 29/10): todos os companheiros da campanha, por dono, e a aba de companheiros de qualquer personagem.
export function companheirosMestreView() {
  const c = estado.campanha;
  const donos = c.personagens.filter(p => !p.companheiroDe && (p.tipo === 'pj' || c.personagens.some(x => x.companheiroDe === p.id)));
  if (!donos.length) return vazio('Nenhum personagem de jogador ainda.', 'paw-print');
  const chave = 'compMestre';
  if (!donos.some(p => p.id === estado.sel[chave])) estado.sel[chave] = (donos.find(p => c.personagens.some(x => x.companheiroDe === p.id)) || donos[0]).id;
  const todos = c.personagens.filter(x => x.companheiroDe);
  return h('div', { class: 'companheiros-mestre' },
    h('div', { class: 'barra' }, titulo('Companheiros da campanha', 'paw-print', 'h2'), h('span', { class: 'selo' }, `${todos.length}`)),
    todos.length ? h('ul', { class: 'lista-companheiros-mestre' }, donos.filter(p => todos.some(x => x.companheiroDe === p.id)).map(p => h('li', {},
      h('strong', {}, p.nome), ': ',
      todos.filter(x => x.companheiroDe === p.id).map((x, i) => [i ? ', ' : '', h('button', { type: 'button', class: 'link', onclick: () => { estado.sel[chave] = p.id; render(); } }, `${x.nome} (${nomeTipo(x.companheiroTipo)})`)])))) : h('p', { class: 'dica' }, 'Nenhum companheiro ainda.'),
    h('label', { class: 'linha' }, 'Personagem', selecao(donos.map(p => ({ valor: p.id, rotulo: `${p.nome}${p.tipo === 'npc' ? ' (NPC)' : ''}` })), estado.sel[chave], v => { estado.sel[chave] = v; render(); }, { 'aria-label': 'Dono dos companheiros' })),
    companheirosView(c.personagens.find(p => p.id === estado.sel[chave])));
}
