// Sala Social (esboço do autor), em três colunas:
// o seu lado (você em cima: humor aparente, humor real e R.MNP) · Manipulações (botões) · o outro lado (alvos).
// Cada personagem mostra o humor que se vê e a afinidade (como o seu personagem vê aquele, no mapa de relacionamento).
import { h, botao, aviso, icone, titulo, confirmar, vazio, janela } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados, listaHabilidades, efeitosHabilidade, podeSeduzir } from '/shared/regras.js';
import { resistenciaManipulacao } from '/shared/combate.js';
import { controladoNaSala, nomeControlado } from './batalha.js';
import { humorCartao, nomeHumor, nomeSub, reboteTexto, alvoDe, marcarAlvo } from './combate.js';
import { efeitosIcones } from './efeitos.js';

export function painelSocial(participantes, mestre) {
  const sis = estado.sistema;
  const { meus, p, chave } = controladoNaSala('social', participantes, mestre);
  if (!p) return null;
  const alvo = alvoDe(p, 'social', participantes);
  // Sem lados nem ordem: só duas colunas de até 10 (você em cima da primeira) para caber na tela.
  const outros = participantes.filter(x => x.id !== p.id);
  const esquerda = outros.slice(0, 9);
  const direita = outros.slice(9);
  return h('div', { class: 'social-tres' },
    h('section', { class: 'bloco social-lado' },
      h('div', { class: 'social-eu' },
        h('div', { class: 'barra' }, icone('user'), nomeControlado(meus, p, chave), h('span', { class: 'espaco' }),
          sis.modulos?.social ? h('span', { class: 'rmnp', title: 'Resistência à Manipulação: Manipulação + 50 + modificadores' }, h('small', {}, 'R.MNP'), h('strong', {}, resistenciaManipulacao(p, sis))) : null),
        humorCartao(p, true, mestre),
        efeitosIcones(p, { mestre })),
      esquerda.length ? h('ul', { class: 'social-lista' }, esquerda.map(x => miniCartao(p, x, alvo))) : null),
    h('section', { class: 'bloco social-manip' }, titulo('Manipulações', 'drama'), manipulacoes(p, personagemPorId(alvo), mestre)),
    h('section', { class: 'bloco social-lado outro' },
      direita.length ? h('ul', { class: 'social-lista' }, direita.map(x => miniCartao(p, x, alvo)))
        : outros.length ? null : vazio('Ninguém mais na sala.', 'users'),
      outrosModificadores(p, mestre)));
}

// Personagem da sala como o seu o enxerga: o humor que ele interpreta (o aparente)
// e a afinidade (como o SEU personagem vê o outro — escolha do jogador, aqui ou nas Redes Sociais).
// Clicar no cartão escolhe o alvo; clicar na afinidade muda a afinidade.
function miniCartao(eu, x, alvo) {
  const sis = estado.sistema;
  const afinidade = estado.campanha.relacoes?.[eu.id]?.[x.id]?.tipo || 'Neutro';
  const esp = { Aliado: 'a', Amigável: 'a', Rival: 'c', Inimigo: 'c' }[afinidade] || 'b';
  const visto = x.donoId === estado.usuario.id || estado.campanha.papel === 'mestre' ? (x.humorAparente || x.humor) : x.humor;
  const ler = async () => {
    const r = await acao('social.manipular', { autor: eu.id, alvo: x.id, sub: 'manipulacao.empatia', humor: 'ler' });
    aviso(r.revelado || `${r.autor}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
  };
  return h('li', { class: `mini-linha ${x.id === alvo ? 'alvo' : ''}` },
    h('button', {
      type: 'button', class: `mini-cartao ${x.id === alvo ? 'alvo' : ''} ${x.semPv || (x.pv && x.pv.atual <= 0) ? 'sem-pv' : ''}`, 'aria-pressed': x.id === alvo,
      title: x.id === alvo ? `${x.nome} é o alvo` : `Escolher ${x.nome} como alvo`, onclick: () => marcarAlvo('social', x.id),
    },
      h('span', { class: 'avatar rosto', 'data-pid': x.id }, x.foto ? h('img', { src: x.foto, alt: '' }) : x.nome.slice(0, 1)),
      h('span', { class: 'mini-nome' }, h('strong', {}, x.nome),
        // Sempre o humor interpretado (a máscara, se houver). O que a Empatia revela fica só no aviso e no registro de quem leu.
        h('small', { title: 'Humor como o seu personagem interpreta (pode ser uma máscara)' }, icone('smile'), ` ${nomeHumor(visto)}`)),
      x.id === alvo ? icone('crosshair') : null),
    h('div', { class: 'mini-acoes' },
      h('button', { type: 'button', class: `afinidade esp-${esp}`, title: `Como ${eu.nome} vê ${x.nome}. Clique para mudar`, 'aria-label': `Afinidade de ${eu.nome} com ${x.nome}: ${afinidade}. Mudar`,
        onclick: () => escolherAfinidade(eu, x, afinidade) }, h('small', {}, 'Afin.'), afinidade),
      sis.modulos?.social ? botao('', ler, { class: 'pequeno', icone: 'eye', title: `Ler o humor real de ${x.nome} (Empatia)`, 'aria-label': `Ler o humor real de ${x.nome} com Empatia` }) : null));
}

function escolherAfinidade(eu, x, atual) {
  let fechar = () => {};
  const definir = async tipo => { await acao('relacao.definir', { de: eu.id, para: x.id, tipo }); fechar(); };
  fechar = janela(`Como ${eu.nome} vê ${x.nome}?`, h('div', { class: 'barra' },
    estado.sistema.relacoes.map(t => botao(t, () => definir(t), { class: `pequeno ${t === atual ? 'primario' : ''}`, 'aria-pressed': t === atual }))),
    [['Fechar', () => true]]);
}

function manipulacoes(p, b, mestre) {
  const sis = estado.sistema;
  if (!sis.modulos?.social) return h('p', { class: 'dica' }, `As manipulações automáticas ainda não existem no ${sis.nome}.`);
  const regras = sis.social.manipulacoes;
  const d = derivados(p, sis);
  const chaveSub = `subDe:${p.id}`;
  if (!regras[estado.sel[chaveSub]]) estado.sel[chaveSub] = 'manipulacao.labia';
  const sub = estado.sel[chaveSub];
  const regra = regras[sub];
  const manipular = async humor => {
    if (!b) throw new Error('Escolha o alvo (clique num personagem).');
    const sel = estado.sel.manipular || {};
    const r = await acao('social.manipular', { autor: p.id, alvo: b.id, sub, humor, mod: mestre ? (parseInt(sel.mod, 10) || 0) + (parseInt(sel.situacaoMod, 10) || 0) : 0 });
    aviso(r.revelado || `${r.autor}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
  };
  return [
    h('p', { class: 'alvo-manip' }, icone('crosshair'), b ? [' Alvo: ', h('strong', {}, b.nome)] : ' Clique num personagem para escolher o alvo.'),
    h('div', { class: 'grade-manip' }, Object.keys(regras).map(id => h('button', {
      type: 'button', class: `manip ${id === sub ? 'ativa' : ''}`, 'aria-pressed': id === sub, title: `Rebote se falhar — ${reboteTexto(regras[id])}`,
      onclick: () => { estado.sel[chaveSub] = id; render(); },
    }, h('strong', {}, nomeSub(id)), h('small', {}, `${d.subpericias[id] ?? 0}%`)))),
    h('div', { class: 'causar' },
      h('small', {}, `${nomeSub(sub)}: o que causar em ${b?.nome || 'o alvo'}?`),
      // Sedução: só em quem se atrai pelo gênero de quem seduz.
      sub === 'manipulacao.seducao' && b && !podeSeduzir(p, b).ok ? h('p', { class: 'alerta' }, icone('heart-crack'), ` ${podeSeduzir(p, b).motivo}`) : null,
      h('div', { class: 'barra' }, regra.causa.map(id => botao(id === 'ler' ? 'Ler o humor real' : nomeHumor(id), () => manipular(id),
        { class: 'pequeno primario', icone: 'drama', disabled: !b || (sub === 'manipulacao.seducao' && !podeSeduzir(p, b).ok), title: `${p.nome} usa ${nomeSub(sub)} em ${b?.nome || 'o alvo'}` })))),
    h('p', { class: 'dica' }, `Se falhar (rebote): ${reboteTexto(regra)}.`),
    b ? botao('Agredir', async () => {
      const custo = sis.social?.agressao?.dano || '1d6';
      if (!(await confirmar(`${p.nome} parte para a agressão contra ${b.nome}? Atacar um humano no meio do diálogo custa ${custo} de Humanidade. Os dois vão para o Campo de Batalha.`))) return;
      const r = await acao('social.agredir', { atacante: p.id, alvo: b.id });
      aviso(r.texto || `${p.nome} e ${b.nome} foram para o Campo de Batalha.`, 'erro');
    }, { class: 'pequeno perigo', icone: 'swords', title: `${p.nome} parte para a agressão` }) : null,
  ];
}

// "Outros modificadores": sempre há o bônus livre do mestre (bônus interpretativo) e o de situação;
// as vantagens e habilidades ativas que mexem em Manipulação já entram sozinhas no valor da perícia.
function outrosModificadores(p, mestre) {
  const sis = estado.sistema;
  const sel = estado.sel.manipular ||= {};
  const ativas = new Set(p.ativas || []);
  const daManipulacao = listaHabilidades(p, sis).filter(x => ativas.has(x.id)).map(x => ({ x, ef: efeitosHabilidade(p, sis, x) }))
    .filter(({ ef }) => ef.testes || ef.pericias.manipulacao || Object.keys(ef.subpericias).some(k => k.startsWith('manipulacao.')));
  const numero = (chave, rotulo) => h('label', { class: 'linha' }, rotulo,
    h('input', { type: 'number', class: 'curto', step: 5, value: sel[chave] || 0, 'aria-label': rotulo, onchange: e => { sel[chave] = e.target.value; render(); } }));
  const total = (parseInt(sel.mod, 10) || 0) + (parseInt(sel.situacaoMod, 10) || 0);
  return h('div', { class: 'outros-mods' },
    titulo('Outros modificadores', 'sliders-horizontal', 'h4'),
    h('p', { class: 'mods-linha' }, h('strong', {}, 'Vantagens e habilidades: '),
      daManipulacao.length ? daManipulacao.map(({ x, ef }) => h('span', { class: 'selo ok', title: ef.notas.join(' · ') }, x.nome)) : h('small', { class: 'dica' }, 'nenhuma ativa que mexa em Manipulação'),
      daManipulacao.length ? h('small', { class: 'dica' }, ' (já somadas na %)') : null),
    mestre
      ? [numero('mod', 'Bônus livre do mestre %'),
        h('div', { class: 'barra' }, h('input', { class: 'curto', placeholder: 'Situação (ex.: está bêbado)', value: sel.situacao || '', 'aria-label': 'Situação', onchange: e => { sel.situacao = e.target.value; } }), numero('situacaoMod', 'Situação %')),
        total ? h('p', { class: 'meta' }, `Próxima manipulação: ${total > 0 ? '+' : ''}${total}%${sel.situacao ? ` (${sel.situacao})` : ''}.`) : null]
      : h('p', { class: 'dica' }, 'Bônus livre e de situação: o mestre aplica na hora, conforme a interpretação.'));
}
