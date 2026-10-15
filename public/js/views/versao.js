// Versão do app e o botão "Atualizar agora" (baixa do GitHub, reinicia e recarrega a página de todos).
// Aparece na lista de campanhas do Mestre e na aba Campanha.
import { h, botao, icone, titulo, confirmar } from '../ui.js';
import { estado, render } from '../estado.js';
import { get, post } from '../api.js';

export function versaoApp() {
  const v = estado.sel.versaoApp;
  const verificar = async () => {
    estado.sel.versaoApp = { ...(v || {}), verificando: true };
    render();
    try { estado.sel.versaoApp = await get('/api/versao?verificar=1'); } catch (e) { estado.sel.versaoApp = { aviso: e.message }; }
    render();
  };
  return h('section', { class: 'bloco' },
    titulo('Versão do app', 'refresh-cw'),
    v?.atual ? h('p', { class: 'meta' }, `Versão em uso: ${v.atual.slice(0, 7)}`) : null,
    v?.verificando ? h('p', { class: 'dica' }, 'Procurando no GitHub…')
      : v?.haNova ? h('p', { class: 'alerta' }, icone('sparkles'), ' Há uma versão nova do app.')
        : v?.nova ? h('p', { class: 'dica' }, icone('check'), ' O app está na versão mais nova.') : null,
    v?.aviso ? h('p', { class: 'dica' }, v.aviso) : null,
    h('div', { class: 'barra' },
      botao('Procurar atualização', verificar, { icone: 'search' }),
      v?.haNova ? botao('Atualizar agora', async () => {
        if (!v.podeReiniciar) throw new Error('Feche a janela preta e abra o iniciar-windows.bat de novo para atualizar.');
        if (!(await confirmar('Baixar a versão nova e reiniciar o app? Todos ficam alguns segundos desconectados e a página recarrega sozinha.'))) return;
        await post('/api/atualizar', {});
      }, { class: 'primario', icone: 'download' }) : null),
    h('p', { class: 'dica' }, 'O app também se atualiza sozinho toda vez que o iniciar-windows.bat é aberto.'));
}

