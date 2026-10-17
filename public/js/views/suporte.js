// Visão do Suporte: uma conta (ou o próprio mestre em outro aparelho) que apresenta coisas aos jogadores
// sem mexer na tela do mestre. Só tem o Mapa (mexe nos peões) e as Imagens liberadas pelo mestre (mostra/esconde).
import { h, abas, botao, icone, titulo, vazio, janela } from '../ui.js';
import { estado, mudar } from '../estado.js';
import { acao, emitir } from '../api.js';
import { topo, carregarSaguao } from './saguao.js';
import { mapaView } from './mapa.js';

const ABAS = [['mapa', 'Mapa', 'map'], ['imagens', 'Imagens', 'image']];

export function telaSuporte() {
  const c = estado.campanha;
  const aba = ABAS.some(([id]) => id === estado.aba) ? estado.aba : 'mapa';
  return h('div', {},
    topo(
      botao('Campanhas', async () => {
        await emitir('campanha:sair');
        mudar({ tela: 'saguao', campanha: null });
        carregarSaguao();
      }, { class: 'pequeno compacto', icone: 'arrow-left', title: 'Voltar às campanhas', 'aria-label': 'Voltar às campanhas' }),
      h('strong', { class: 'nome-campanha' }, c.nome),
      h('span', { class: 'selo' }, icone('presentation'), 'Suporte')),
    abas(ABAS, aba, id => mudar({ aba: id })),
    h('main', { class: 'conteudo' }, aba === 'mapa' ? mapaView() : imagensSuporte()));
}

function imagensSuporte() {
  const lista = estado.campanha.imagens || [];
  return h('div', {},
    titulo('Imagens liberadas pelo mestre', 'image', 'h2'),
    h('p', { class: 'dica' }, 'Mostre ou esconda estas imagens na tela dos jogadores.'),
    lista.length ? h('div', { class: 'galeria' }, lista.map(i => h('figure', { class: i.mostrando ? 'mostrando' : '' },
      i.tipo === 'video' ? h('video', { src: i.url, muted: true, loop: true, playsinline: true, class: 'miniatura-video' })
        : h('img', { src: i.url, alt: i.titulo, onclick: () => janela(i.titulo, h('img', { src: i.url, class: 'img-cheia', alt: i.titulo })) }),
      h('figcaption', {}, h('strong', {}, i.titulo), h('small', {}, i.categoria)),
      h('div', { class: 'acoes' },
        botao(i.mostrando ? 'Esconder dos jogadores' : 'Mostrar aos jogadores', () => acao('imagem.mostrar', { id: i.id, mostrando: !i.mostrando }),
          { class: i.mostrando ? 'pequeno' : 'pequeno primario', icone: i.mostrando ? 'eye-off' : 'eye' })))))
      : vazio('O mestre ainda não liberou imagens para o Suporte.', 'image'));
}
