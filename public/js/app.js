import { h, aviso } from './ui.js';
import { estado, definirRender, mudar, carregarSistema, sincronizarSistema, recarregarSistema } from './estado.js';
import { observarRolagens } from './views/animacao.js';
import { telaSuporte } from './views/suporte.js';
import { observarEfeitos } from './views/efeitos.js';
import { observarDescanso } from './views/descanso.js';
import { observarFx, aplicarFx } from './views/fx.js';
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
  const rolagensX = [...raiz.querySelectorAll('[data-rolagem-x]')].map(el => [el.dataset.rolagemX, el.scrollLeft]);
  const rolagemJanela = window.scrollY;

  raiz.replaceChildren(tela());
  aplicarFx(raiz);

  for (const [id, top] of rolagens) {
    const el = raiz.querySelector(`[data-rolagem="${id}"]`);
    if (el) el.scrollTop = top;
  }
  for (const [id, left] of rolagensX) {
    const el = raiz.querySelector(`[data-rolagem-x="${id}"]`);
    if (el) el.scrollLeft = left;
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
    case 'campanha': return estado.area === 'mestre' ? telaMestre() : estado.area === 'suporte' ? telaSuporte() : telaJogador();
    default: return h('div', { class: 'centro' }, h('p', {}, 'Carregando…'));
  }
}

definirRender(desenhar);

let reiniciando = false;

export function iniciarSessao(s) {
  estado.usuario = s.user;
  conectar(s.token, {
    connect: async () => {
      // Voltou depois do "Atualizar agora": recarrega a página para pegar a versão nova.
      if (reiniciando) { location.reload(); return; }
      estado.conectado = true;
      // Reconexão: volta para a campanha em que estava.
      if (estado.tela === 'campanha' && estado.campanha) {
        try {
          estado.campanha = await emitir('campanha:entrar', { id: estado.campanha.id, area: estado.area });
          observarRolagens(estado.campanha);
          await sincronizarSistema(estado.campanha);
          observarEfeitos(estado.campanha);
          observarDescanso(estado.campanha);
          observarFx(estado.campanha);
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
    estado: async c => {
      if (estado.campanha?.id !== c.id) return;
      const anterior = estado.sistema?.id;
      if (await sincronizarSistema(c) && anterior) aviso(`Agora a campanha usa o ${estado.sistema.nome} (${estado.sistema.nomeCompleto}).`);
      const vezAntes = vezDe(estado.campanha);
      observarEfeitos(c);
      observarDescanso(c);
      observarFx(c);
      if (estado.campanha?.id === c.id) mudar({ campanha: c });
      observarRolagens(c);
      // Avisa o jogador quando chega a vez de um personagem dele no Campo de Batalha.
      const vez = vezDe(c);
      const p = vez && c.personagens.find(x => x.id === vez.id);
      if (vez && vez.chave !== vezAntes?.chave && p?.donoId === estado.usuario?.id && c.papel !== 'mestre') aviso(`Sua vez: ${p.nome} (rodada ${vez.rodada}).`);
    },
    'app:reiniciando': () => {
      reiniciando = true;
      aviso('O app está sendo atualizado. A página recarrega sozinha em alguns segundos.');
    },
    'sistema:atualizado': () => recarregarSistema().then(() => aviso('O catálogo (itens ou monstros) foi atualizado.')),
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
    estado.sistema = await carregarSistema('msa');
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

function vezDe(c) {
  const cb = c?.salas?.batalha?.combate;
  const id = cb?.ordem?.[cb.vez]?.id;
  return id ? { id, rodada: cb.rodada, chave: `${cb.rodada}:${cb.vez}:${id}` } : null;
}
