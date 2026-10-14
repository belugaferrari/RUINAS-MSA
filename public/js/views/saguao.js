import { h, botao, aviso, janela, confirmar, vazio, icone } from '../ui.js';
import { estado, mudar, render } from '../estado.js';
import { emitir } from '../api.js';
import { sairDaConta } from '../app.js';

export async function carregarSaguao() {
  if (!estado.area) return;
  try {
    estado.saguao = await emitir('saguao', estado.area);
  } catch (e) {
    aviso(e.message, 'erro');
  }
  render();
}

export async function abrirCampanha(id) {
  const c = await emitir('campanha:entrar', { id, area: estado.area });
  mudar({ tela: 'campanha', campanha: c, aba: null, sel: {} });
}

export function topo(...extra) {
  return h('header', { class: 'topo' },
    h('strong', { class: 'logo', title: 'Ilhas das Ruínas MSA' }, icone('anchor'), h('span', {}, 'Ilhas das Ruínas')),
    ...extra,
    h('span', { class: 'espaco' }),
    estado.conectado ? null : h('span', { class: 'selo perigo', role: 'status' }, icone('wifi-off'), 'Reconectando…'),
    h('span', { class: 'usuario', title: estado.usuario?.name }, icone('user'), h('span', {}, estado.usuario?.name)),
    botao('Sair', sairDaConta, { class: 'pequeno compacto', icone: 'log-out', title: 'Sair da conta', 'aria-label': 'Sair da conta' }));
}

export function telaSaguao() {
  if (!estado.area) {
    return h('div', {},
      topo(),
      h('div', { class: 'centro' },
        h('h2', {}, `Olá, ${estado.usuario.name}! Como você vai jogar hoje?`),
        h('div', { class: 'escolha-area' },
          h('button', { class: 'cartao grande', onclick: () => { estado.area = 'mestre'; carregarSaguao(); } }, icone('scroll', 'grande'), h('strong', {}, 'Área do Mestre'), h('small', {}, 'Criar e conduzir campanhas')),
          h('button', { class: 'cartao grande', onclick: () => { estado.area = 'jogador'; carregarSaguao(); } }, icone('sword', 'grande'), h('strong', {}, 'Área do Jogador'), h('small', {}, 'Entrar com seu personagem')))));
  }

  const mestre = estado.area === 'mestre';
  const lista = estado.saguao;
  return h('div', {},
    topo(botao(mestre ? 'Área do Mestre' : 'Área do Jogador', () => mudar({ area: null, saguao: [] }), { class: 'pequeno', icone: 'arrow-left', title: 'Trocar de área' })),
    h('main', { class: 'conteudo estreito' },
      h('div', { class: 'barra' },
        h('h2', { class: 'com-icone' }, icone(mestre ? 'castle' : 'compass'), mestre ? 'Suas campanhas' : 'Campanhas'),
        h('span', { class: 'espaco' }),
        botao('Atualizar', carregarSaguao, { icone: 'refresh-cw' }),
        mestre ? botao('Nova campanha', novaCampanha, { class: 'primario', icone: 'plus' }) : null),
      mestre ? null : h('p', { class: 'dica' }, 'Aparecem aqui as campanhas abertas pelos mestres e as que você já participa. Campanhas fechadas não podem ser acessadas.'),
      lista.length ? h('div', { class: 'lista-campanhas' }, lista.map(c => cartaoCampanha(c, mestre)))
        : vazio(mestre ? 'Nenhuma campanha ainda. Crie a primeira!' : 'Nenhuma campanha aberta no momento.', 'map')));
}

function cartaoCampanha(c, mestre) {
  return h('div', { class: 'cartao campanha' },
    h('div', { class: 'campanha-icone' }, icone('ship')),
    h('div', { class: 'campanha-info' },
      h('h3', {}, c.nome),
      h('p', { class: 'meta icones-meta' },
        h('span', {}, icone('crown'), c.mestre),
        h('span', {}, icone('trending-up'), `Nível ${c.nivel === 'Variavel' ? 'variável' : c.nivel}`),
        h('span', {}, icone('users'), `${c.jogadores}/${c.maxJogadores}`),
        h('span', {}, icone('sparkles'), c.padraoMSA ? 'Padrão MSA' : 'Pontos próprios')),
      h('span', { class: `selo ${c.aberta ? 'ok' : 'perigo'}` }, icone(c.aberta ? 'lock-open' : 'lock'), c.aberta ? 'Aberta' : 'Fechada'),
      !mestre && c.participando ? h('span', { class: 'selo' }, icone('check'), 'Você participa') : null),
    h('div', { class: 'acoes' },
      mestre ? botao(c.aberta ? 'Fechar' : 'Abrir', async () => {
        await emitir('campanha:abrir', { id: c.id, aberta: !c.aberta });
        carregarSaguao();
      }, { icone: c.aberta ? 'door-closed' : 'door-open' }) : null,
      mestre ? botao('Apagar', async () => {
        if (!(await confirmar(`Apagar a campanha "${c.nome}" e todas as fichas? Isso não pode ser desfeito.`))) return;
        await emitir('campanha:apagar', c.id);
        carregarSaguao();
      }, { class: 'perigo', icone: 'trash-2' }) : null,
      botao(mestre ? 'Jogar' : (c.participando ? 'Continuar' : 'Entrar'), () => abrirCampanha(c.id), { class: 'primario', icone: mestre ? 'dices' : 'door-open', disabled: !mestre && !c.aberta })));
}

function novaCampanha() {
  const nome = h('input', { required: true, placeholder: 'Ex.: A Maré Negra' });
  const max = h('input', { type: 'number', min: 1, max: 9, value: 4 });
  const nivelVar = h('input', { type: 'checkbox' });
  const nivel = h('input', { type: 'number', min: 1, max: 20, value: 1 });
  const padrao = h('input', { type: 'checkbox', checked: true });
  const pts = { atributos: h('input', { type: 'number', min: 0, value: 20 }), vantagens: h('input', { type: 'number', min: 0, value: 5 }), pericias: h('input', { type: 'number', min: 0, value: 15 }) };
  const blocoPts = h('fieldset', { hidden: true }, h('legend', {}, 'Pontos para a criação de personagem'),
    h('div', { class: 'grade3' }, h('label', {}, 'Atributos', pts.atributos), h('label', {}, 'Vantagens', pts.vantagens), h('label', {}, 'Perícias', pts.pericias)));
  nivelVar.onchange = () => { nivel.disabled = nivelVar.checked; };
  padrao.onchange = () => { blocoPts.hidden = padrao.checked; };

  janela('Nova campanha', h('div', { class: 'form' },
    h('label', {}, 'Nome da campanha', nome),
    h('label', {}, 'Quantidade máxima de jogadores (até 9)', max),
    h('div', { class: 'grade2' },
      h('label', {}, 'Nível inicial (1 a 20)', nivel),
      h('label', { class: 'linha' }, nivelVar, 'Nível variável')),
    h('label', { class: 'linha' }, padrao, 'Usar início padrão MSA'),
    blocoPts),
  [['Cancelar', () => {}], ['Criar campanha', async () => {
    try {
      await emitir('campanha:criar', {
        nome: nome.value, maxJogadores: max.value, nivel: nivelVar.checked ? 'Variavel' : nivel.value, padraoMSA: padrao.checked,
        pontos: { atributos: pts.atributos.value, vantagens: pts.vantagens.value, pericias: pts.pericias.value },
      });
    } catch (e) {
      aviso(e.message, 'erro');
      return false;
    }
    aviso('Campanha criada! Ela começa fechada — abra quando quiser receber os jogadores.');
    carregarSaguao();
  }, 'primario']]);
}
