// Galeria de avatares prontos: filtros por grupo (Humanos, cada classe, NPCs e criaturas) e por gênero.
// Escolher um avatar só grava o endereço da imagem na ficha (p.foto); "Enviar foto" continua valendo.
import { h, botao, icone, janela, pedirTexto, aviso } from '../ui.js';
import { imagemDeLink } from '/shared/imagens.js';
import { AVATARES, GRUPOS_AVATAR } from '/shared/avatares.js';

export function escolherAvatar({ titulo = 'Escolher avatar', atual = '', genero = '', aoEscolher, enviarFoto = null }) {
  const filtro = { grupo: 'todos', genero: genero === 'feminino' || genero === 'masculino' ? genero : 'todos' };
  const grade = h('div', { class: 'avatar-grade', role: 'listbox', 'aria-label': 'Avatares' });
  const chips = h('div', { class: 'avatar-filtros' });
  let fechar = () => {};
  const desenhar = () => {
    chips.replaceChildren(
      h('div', { class: 'barra', role: 'group', 'aria-label': 'Grupo' },
        [['todos', 'Todos'], ...GRUPOS_AVATAR].map(([id, nome]) => botao(nome, () => { filtro.grupo = id; desenhar(); },
          { class: `pequeno ${filtro.grupo === id ? 'primario' : ''}`, 'aria-pressed': filtro.grupo === id }))),
      h('div', { class: 'barra', role: 'group', 'aria-label': 'Gênero do avatar' },
        [['todos', 'Todos'], ['masculino', 'Masculinos'], ['feminino', 'Femininos']].map(([id, nome]) => botao(nome, () => { filtro.genero = id; desenhar(); },
          { class: `pequeno ${filtro.genero === id ? 'primario' : ''}`, 'aria-pressed': filtro.genero === id }))));
    const lista = AVATARES.filter(a => (filtro.grupo === 'todos' || a.grupo === filtro.grupo)
      && (filtro.genero === 'todos' || a.genero === filtro.genero || a.genero === 'outro'));
    grade.replaceChildren(...lista.map(a => h('button', {
      type: 'button', class: `avatar-opcao ${a.url === atual ? 'atual' : ''}`, role: 'option', 'aria-selected': a.url === atual, title: a.nome,
      onclick: async () => { await aoEscolher(a.url, a); fechar(); },
    }, h('img', { src: a.url, alt: '', loading: 'lazy', width: 96, height: 96 }), h('small', {}, a.nome))));
  };
  desenhar();
  fechar = janela(titulo, h('div', { class: 'avatar-galeria' },
    enviarFoto ? h('div', { class: 'barra' }, botao('Enviar foto do aparelho', () => { fechar(); enviarFoto(); }, { class: 'pequeno', icone: 'camera' }),
      // Link do Google Drive (compartilhado com "qualquer pessoa com o link") ou de uma imagem na internet: o app só mostra.
      botao('Colar link (Drive ou internet)', async () => {
        const link = await pedirTexto('Link da imagem', 'Cole o link do Google Drive (Qualquer pessoa com o link) ou o endereço da imagem', '');
        if (link == null) return;
        const url = imagemDeLink(link);
        if (!url) return aviso('Link inválido: cole um endereço que comece com https://', 'erro');
        await aoEscolher(url);
        fechar();
      }, { class: 'pequeno', icone: 'link' }),
      atual ? botao('Tirar a imagem', async () => { await aoEscolher(''); fechar(); }, { class: 'pequeno perigo', icone: 'x' }) : null) : null,
    chips, grade), [['Fechar', () => true]]);
}
