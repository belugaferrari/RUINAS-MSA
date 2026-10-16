// Ícones dos efeitos que o personagem está sofrendo (Sangramento, Dor, Aturdido…), com os turnos que faltam.
// Quando um personagem-jogador recebe um efeito novo, o ícone faz uma animação própria do efeito.
import { h, icone, pedirTexto, aviso } from '../ui.js';
import { estado, render } from '../estado.js';
import { acao } from '../api.js';
import { efeitosVisiveis } from '/shared/efeitos.js';

const DURACAO_ANIMACAO = 2600;
const chegaram = new Map(); // "personagem:efeito" → quando chegou
let anterior = null; // personagem → { efeito: qtd }
let campanhaVista = null;

// Chamada a cada estado novo da campanha: descobre os efeitos que acabaram de chegar nos personagens-jogador.
export function observarEfeitos(c) {
  if (!c || !estado.sistema?.condicoes) return;
  const agora = {};
  for (const p of c.personagens || []) {
    if (p.tipo !== 'pj') continue;
    agora[p.id] = Object.fromEntries(efeitosVisiveis(p, estado.sistema).map(e => [e.id, e.qtd]));
  }
  if (campanhaVista === c.id && anterior) {
    for (const [pid, efs] of Object.entries(agora)) {
      for (const [id, qtd] of Object.entries(efs)) {
        if (qtd <= (anterior[pid]?.[id] || 0)) continue;
        chegaram.set(`${pid}:${id}`, Date.now());
        // Redesenha no fim para o ícone voltar ao normal.
        setTimeout(render, DURACAO_ANIMACAO + 50);
      }
    }
  }
  campanhaVista = c.id;
  anterior = agora;
}

// Linha de ícones. "mestre" deixa clicar para mudar os turnos que faltam.
export function efeitosIcones(p, { mestre = false, grande = false } = {}) {
  const lista = estado.sistema?.condicoes ? efeitosVisiveis(p, estado.sistema) : [];
  if (!lista.length) return null;
  return h('div', { class: `efeitos-icones ${grande ? 'grande' : ''}`, 'aria-label': `Efeitos em ${p.nome}` },
    lista.map(e => iconeEfeito(p, e, mestre)));
}

function iconeEfeito(p, e, mestre) {
  const chegou = chegaram.get(`${p.id}:${e.id}`);
  const passou = chegou ? Date.now() - chegou : Infinity;
  if (chegou && passou > DURACAO_ANIMACAO) chegaram.delete(`${p.id}:${e.id}`);
  const animando = passou < DURACAO_ANIMACAO;
  const turnos = e.turnos != null
    ? (e.sangra ? `próxima perda de PV em ${e.turnos} turno(s) · ${e.sangra.perdidos}/${e.sangra.maximo} PV perdidos` : `faltam ${e.turnos} turno(s)`)
    : 'até alguém tirar';
  const titulo = `${e.nome}${e.qtd > 1 ? ` ×${e.qtd}` : ''} — ${e.efeitos || ''} (${turnos})${mestre ? ' · clique para mudar os turnos' : ''}`;
  const conteudo = [
    h('span', { class: 'efeito-desenho', 'aria-hidden': 'true' }, icone(e.icone)),
    e.turnos != null ? h('span', { class: 'efeito-turnos', 'aria-hidden': 'true' }, String(e.turnos)) : null,
    e.qtd > 1 ? h('span', { class: 'efeito-qtd', 'aria-hidden': 'true' }, `×${e.qtd}`) : null,
  ];
  const props = {
    class: `efeito-icone ef-${e.id} grupo-${(e.grupo || '').toLowerCase().replace(/\s+/g, '-')} ${animando ? 'chegou' : ''}`,
    title: titulo, 'aria-label': titulo,
    // A animação continua de onde estava mesmo se a tela for redesenhada no meio.
    style: animando ? { animationDelay: `-${passou}ms` } : null,
  };
  if (!mestre) return h('span', { ...props, role: 'img' }, ...conteudo);
  return h('button', {
    ...props, type: 'button',
    onclick: async ev => {
      ev.stopPropagation();
      const v = await pedirTexto(`${e.nome} em ${p.nome}`, 'Turnos que faltam (0 tira o efeito)', String(e.turnos ?? ''));
      if (v == null) return;
      await acao('efeito.turnos', { id: p.id, efeito: e.id, turnos: v });
      aviso(parseInt(v, 10) > 0 ? `${e.nome}: ${parseInt(v, 10)} turno(s).` : `${e.nome} tirado.`);
    },
  }, ...conteudo);
}

// Marcadores de texto livre (que não são condições do livro), para mostrar como etiqueta ao lado dos ícones.
export function marcadoresLivres(p) {
  const conds = estado.sistema?.condicoes || [];
  return (p.marcadores || []).filter(m => !conds.some(c => String(m).toLowerCase().startsWith(c.nome.toLowerCase())));
}
