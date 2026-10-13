import { h, aviso } from './ui.js';
import { estado, definirRender, mudar } from './estado.js';
import { sessao, get, conectar, emitir } from './api.js';
import { telaLogin } from './views/login.js';
import { telaSaguao, carregarSaguao } from './views/saguao.js';
import { telaMestre } from './views/mestre.js';
import { telaJogador } from './views/jogador.js';

const raiz = document.getElementById('app');

function desenhar() {
  // Preserva foco, cursor e rolagem entre redesenhos (as atualizações em tempo real redesenham a tela).
  const ativo = document.activeElement;
  const chave = ativo?.dataset?.key;
  const cursor = chave && 'selectionStart' in ativo ? [ativo.selectionStart, ativo.selectionEnd] : null;
  const rolagens = [...raiz.querySelectorAll('[data-rolagem]')].map(el => [el.dataset.rolagem, el.scrollTop]);
  const rolagemJanela = window.scrollY;

  raiz.replaceChildren(tela());

  for (const [id, top] of rolagens) {
    const el = raiz.querySelector(`[data-rolagem="${id}"]`);
    if (el) el.scrollTop = top;
  }
  window.scrollTo(0, rolagemJanela);
  if (chave) {
    const el = raiz.querySelector(`[data-key="${CSS.escape(chave)}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      if (cursor) try { el.setSelectionRange(...cursor); } catch { /* inputs numéricos */ }
    }
  }
}

function tela() {
  switch (estado.tela) {
    case 'login': return telaLogin();
    case 'saguao': return telaSaguao();
    case 'campanha': return estado.area === 'mestre' ? telaMestre() : telaJogador();
    default: return h('div', { class: 'centro' }, h('p', {}, 'Carregando…'));
  }
}

definirRender(desenhar);

export function iniciarSessao(s) {
  estado.usuario = s.user;
  conectar(s.token, {
    connect: async () => {
      estado.conectado = true;
      // Reconexão: volta para a campanha em que estava.
      if (estado.tela === 'campanha' && estado.campanha) {
        try {
          estado.campanha = await emitir('campanha:entrar', { id: estado.campanha.id, area: estado.area });
        } catch (e) {
          aviso(e.message, 'erro');
          estado.tela = 'saguao';
          estado.campanha = null;
          carregarSaguao();
        }
      }
      desenhar();
    },
    disconnect: () => mudar({ conectado: false }),
    connect_error: e => {
      if (e.message === 'nao-autenticado') sairDaConta();
    },
    estado: c => {
      if (estado.campanha?.id === c.id) mudar({ campanha: c });
    },
    expulso: msg => {
      aviso(msg, 'erro');
      mudar({ tela: 'saguao', campanha: null });
      carregarSaguao();
    },
  });
}

export function sairDaConta() {
  sessao.limpar();
  location.reload();
}

async function iniciar() {
  try {
    estado.sistema = await get('/api/sistema');
  } catch (e) {
    raiz.replaceChildren(h('div', { class: 'centro' }, h('p', {}, `Não foi possível carregar o sistema: ${e.message}`)));
    return;
  }
  const s = sessao.obter();
  if (s) {
    try {
      await get('/api/eu');
      iniciarSessao(s);
      mudar({ tela: 'saguao' });
      return;
    } catch {
      sessao.limpar();
    }
  }
  mudar({ tela: 'login' });
}

iniciar();
