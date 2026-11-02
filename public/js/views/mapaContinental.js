// Mapa continental / mapa do mundo (autor, 01/11): grande, sem combate; fog inicial que se abre em volta dos peões
// dos PJs conforme o mestre move o grupo ("geolocalização"); zoom e arrastar; pins com comentários — cada pin só
// para quem pôs e para o mestre.
import { h, botao, aviso, icone, janela, pedirTexto, confirmar } from '../ui.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { panDoMapa } from './mapaMundo.js';
import { colunasDoMapa, linhasDoMapa } from '/shared/visao.js';

// Leva a vista até o quadrado (col, lin): o centro da área visível.
function centralizar(mapa, col, lin) {
  const rol = document.querySelector('.mapa-rolagem');
  const q = rol?.querySelector('.mapa-quadro');
  if (!rol || !q) return;
  const cel = q.offsetWidth / (mapa.grade?.colunas || 20);
  const pan = panDoMapa(mapa);
  pan.x = rol.clientWidth / 2 - (col + (mapa.grade?.ox || 0) + 0.5) * cel;
  pan.y = rol.clientHeight / 2 - (lin + (mapa.grade?.oy || 0) + 0.5) * cel;
  render();
}

export function barraMundo(vendo, mapa, mestre) {
  const c = estado.campanha;
  const meus = new Set(meusPersonagens().map(p => p.id));
  const meuPeao = vendo && Object.entries(mapa.pecas || {}).find(([id]) => (mestre ? personagemPorId(id)?.tipo === 'pj' : meus.has(id)));
  const zoom = estado.sel.mapaZoom || 1;
  const fora = mestre && vendo ? c.personagens.filter(p => p.tipo === 'pj' && !mapa.pecas?.[p.id]) : [];
  return h('div', { class: 'barra mapa-mundo-barra' },
    c.continental && !c.continental.ativo
      ? botao(vendo ? 'Voltar ao mapa' : `Mapa do mundo: ${c.continental.nome}`, () => { estado.sel.mapaMundo = !vendo; estado.sel.mapaPin = false; render(); },
        { class: `pequeno ${vendo ? '' : 'primario'}`, icone: vendo ? 'arrow-left' : 'globe', title: 'O mapa continental: onde o grupo está e o que já foi explorado' })
      : h('strong', {}, icone('globe'), ` ${mapa.nome} (mapa do mundo)`),
    vendo ? [
      meuPeao ? botao('Onde estou', () => centralizar(mapa, meuPeao[1].col, meuPeao[1].lin), { class: 'pequeno', icone: 'locate', title: 'Centraliza a vista no seu personagem' }) : null,
      botao(estado.sel.mapaPin ? 'Clique no mapa para pôr o pin (cancelar)' : 'Pôr pin', () => { estado.sel.mapaPin = !estado.sel.mapaPin; render(); },
        { class: `pequeno ${estado.sel.mapaPin ? 'primario' : ''}`, icone: 'map-pin', title: 'Um comentário seu no mapa (só você e o mestre veem)' }),
      fora.length ? botao(`Pôr ${fora.length} PJ(s) no mapa do mundo`, async () => {
        const meio = { col: Math.floor(colunasDoMapa(mapa) / 2), lin: Math.floor(linhasDoMapa(mapa) / 2) };
        for (const [i, p] of fora.entries()) await acao('mapa.mover', { id: p.id, col: meio.col + i, lin: meio.lin, mapaId: mapa.id }).catch(e => aviso(e.message, 'erro'));
        aviso('PJs no centro do mapa do mundo: arraste o grupo para onde ele está.');
      }, { class: 'pequeno', icone: 'users' }) : null,
      h('small', { class: 'dica' }, mestre ? 'Arraste os peões dos PJs: a fog se abre em volta deles. Para pintar a fog ou pôr objetos, abra este mapa como ativo.' : 'Arraste o fundo para andar pelo mapa. A região se revela conforme o grupo avança.'),
    ] : null);
}

// Pin: um alfinete no ponto; clicar mostra o comentário (o dono e o mestre editam ou apagam).
export function pinEl(pin, mestre) {
  const meu = pin.dono === estado.usuario?.id;
  return h('button', {
    type: 'button', class: `pin-mapa ${meu ? 'meu' : ''}`, style: { '--px': pin.x, '--py': pin.y, ...(pin.cor ? { '--cor-pin': pin.cor } : {}) },
    title: `${pin.autor}: ${pin.texto}`, 'aria-label': `Pin de ${pin.autor}: ${pin.texto}`,
    onclick: e => {
      e.stopPropagation();
      const podeEditar = meu || mestre;
      janela(`Pin de ${pin.autor}`, h('p', {}, pin.texto), [
        ...(podeEditar ? [['Editar', async () => { const t = await pedirTexto('Editar pin', 'Comentário', pin.texto); if (t) await acao('mapa.pinEditar', { id: pin.id, texto: t }); }],
          ['Apagar', async () => { if (await confirmar('Apagar este pin?')) await acao('mapa.pinEditar', { id: pin.id, remover: true }); }, 'perigo']] : []),
        ['Fechar', () => true]]);
    },
  }, icone('map-pin'));
}
