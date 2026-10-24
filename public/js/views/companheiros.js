// Aba Companheiros: familiares, animais, montarias, autômatos, invenções e implantes do personagem.
// Cada um é um personagem do jogador ligado ao personagem dele: entra no Campo de Batalha (o dono controla) e no mapa
// (o mestre põe). Pode nascer de uma criatura do Livro dos Monstros ou em branco; o mestre ajusta a ficha (aba NPCs › Companheiros).
import { h, botao, selecao, aviso, confirmar, vazio, icone, titulo, janela } from '../ui.js';
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
        x.pv ? h('div', { class: 'barra-pv', title: `PV ${x.pv.atual}/${x.pv.max}` }, h('i', { style: { width: `${Math.max(0, Math.min(100, (100 * x.pv.atual) / (x.pv.max || 1)))}%` } })) : null,
        x.pv ? h('p', { class: 'meta icones-meta' }, h('span', {}, icone('heart'), `${x.pv.atual}/${x.pv.max}`)) : null,
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
