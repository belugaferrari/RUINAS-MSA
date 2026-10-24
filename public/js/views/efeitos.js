// Ícones dos efeitos que o personagem está sofrendo (Sangramento, Dor, Aturdido…), com os turnos que faltam.
// Quando um personagem-jogador recebe um efeito novo, o ícone faz uma animação própria do efeito.
import { h, icone, aviso, janela } from '../ui.js';
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
  const habs = Object.entries(p.habAtivas || {});
  if (!lista.length && !habs.length) return null;
  return h('div', { class: `efeitos-icones ${grande ? 'grande' : ''}`, 'aria-label': `Efeitos em ${p.nome}` },
    habs.map(([id, a]) => iconeHabilidade(p, id, a)),
    lista.map(e => iconeEfeito(p, e, mestre)));
}

// Habilidade ativa (Despertar, Aceleração sináptica…): chama dourada com os turnos que faltam. O mestre pode encerrar.
function iconeHabilidade(p, id, a) {
  const dur = a.turnos ? `faltam ${a.turnos} turno(s)` : a.combate ? 'até o fim do combate' : a.descanso ? 'até o próximo descanso' : 'até o mestre encerrar';
  const titulo = `${a.nome} ativa — ${dur}`;
  return h('button', {
    type: 'button', class: 'efeito-icone hab-ativa', title: titulo, 'aria-label': `${titulo}. Clique para ler`,
    onclick: ev => {
      ev.stopPropagation();
      const mestre = estado.campanha?.papel === 'mestre';
      janela(`${a.nome} — ${p.nome}`, h('p', {}, icone('flame'), ` Ativa ${dur}. Enquanto durar, não pode ser ativada de novo.`),
        mestre ? [['Encerrar agora', () => acao('habilidade.encerrar', { id: p.id, hab: id }).then(() => aviso(`${a.nome} encerrada.`)), 'perigo'], ['Fechar', () => true]] : [['Fechar', () => true]]);
    },
  }, h('span', { class: 'efeito-desenho', 'aria-hidden': 'true' }, icone('flame')),
  a.turnos ? h('span', { class: 'efeito-turnos', 'aria-hidden': 'true' }, String(a.turnos)) : null);
}

function iconeEfeito(p, e, mestre) {
  const chegou = chegaram.get(`${p.id}:${e.id}`);
  const passou = chegou ? Date.now() - chegou : Infinity;
  if (chegou && passou > DURACAO_ANIMACAO) chegaram.delete(`${p.id}:${e.id}`);
  const animando = passou < DURACAO_ANIMACAO;
  const turnos = e.turnos != null
    ? (e.sangra ? `próxima perda de PV em ${e.turnos} turno(s) · ${e.sangra.perdidos}/${e.sangra.maximo} PV perdidos` : `faltam ${e.turnos} turno(s)`)
    : 'até alguém tirar';
  const suspenso = p.emCombate && e.grupo === 'Necessidades';
  const titulo = `${e.nome}${e.qtd > 1 ? ` ×${e.qtd}` : ''} — ${e.efeitos || ''} (${turnos})${suspenso ? ' — suspenso durante o combate' : ''}`;
  const conteudo = [
    h('span', { class: 'efeito-desenho', 'aria-hidden': 'true' }, icone(e.icone)),
    e.turnos != null ? h('span', { class: 'efeito-turnos', 'aria-hidden': 'true' }, String(e.turnos)) : null,
    e.qtd > 1 ? h('span', { class: 'efeito-qtd', 'aria-hidden': 'true' }, `×${e.qtd}`) : null,
  ];
  const props = {
    class: `efeito-icone ef-${e.id} grupo-${(e.grupo || '').toLowerCase().replace(/\s+/g, '-')} ${animando ? 'chegou' : ''} ${suspenso ? 'suspenso' : ''}`,
    title: titulo, 'aria-label': `${titulo}. Clique para ler`,
    // A animação continua de onde estava mesmo se a tela for redesenhada no meio; cada efeito tem a sua cor.
    style: { ...(e.cor ? { '--cor-ef': e.cor } : {}), ...(animando ? { animationDelay: `-${passou}ms` } : {}) },
    onclick: ev => { ev.stopPropagation(); lerEfeito(p, e, mestre, turnos); },
  };
  return h('button', { ...props, type: 'button' }, ...conteudo);
}

// Janela com o desenho grande, o que o efeito faz e quanto falta. Só o MESTRE muda os turnos ou cancela o efeito (autor, 22/10).
function lerEfeito(p, e, _mestre, turnos) {
  const mestre = estado.campanha?.papel === 'mestre';
  const campoTurnos = h('input', { type: 'number', min: 0, max: 99, class: 'curto', value: e.turnos ?? '', 'aria-label': 'Turnos que faltam' });
  const salvar = async n => {
    await acao('efeito.turnos', { id: p.id, efeito: e.id, turnos: n });
    aviso(n > 0 ? `${e.nome}: ${n} turno(s).` : `${e.nome} tirado de ${p.nome}.`);
  };
  janela(`${e.nome}${e.qtd > 1 ? ` ×${e.qtd}` : ''} — ${p.nome}`,
    h('div', { class: 'efeito-leitura' },
      h('span', { class: `efeito-icone enorme ef-${e.id}`, style: e.cor ? { '--cor-ef': e.cor } : null, 'aria-hidden': 'true' }, h('span', { class: 'efeito-desenho' }, icone(e.icone))),
      h('div', {},
        h('p', {}, e.efeitos || 'Sem descrição.'),
        h('p', { class: 'meta' }, icone('hourglass'), ` ${turnos[0].toUpperCase()}${turnos.slice(1)}.`),
        h('p', { class: 'dica' }, `Grupo: ${e.grupo}.`),
        mestre ? h('label', { class: 'linha' }, 'Turnos que faltam (0 tira o efeito)', campoTurnos) : null)),
    mestre ? [['Cancelar o efeito', () => salvar(0), 'perigo'], ['Salvar turnos', () => salvar(Math.max(0, parseInt(campoTurnos.value, 10) || 0)), 'primario']] : [['Fechar', () => true]]);
  // Nos efeitos animados, mostra o movimento de novo na janela.
  document.querySelector('.efeito-leitura .efeito-icone')?.classList.add('chegou');
}

// Marcadores de texto livre (que não são condições do livro), para mostrar como etiqueta ao lado dos ícones.
export function marcadoresLivres(p) {
  const conds = estado.sistema?.condicoes || [];
  return (p.marcadores || []).filter(m => !conds.some(c => String(m).toLowerCase().startsWith(c.nome.toLowerCase())));
}
