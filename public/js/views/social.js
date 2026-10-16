// Sala Social (esboço do autor), em três colunas:
// o seu lado (você em cima: humor aparente, humor real e R.MNP) · Manipulações (botões) · o outro lado (alvos).
// Cada personagem mostra o humor que se vê e a afinidade (como o seu personagem vê aquele, no mapa de relacionamento).
import { h, botao, selecao, aviso, icone, titulo, confirmar, vazio } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados } from '/shared/regras.js';
import { resistenciaManipulacao } from '/shared/combate.js';
import { controladoNaSala, nomeControlado } from './batalha.js';
import { humorCartao, nomeHumor, nomeSub, reboteTexto, alvoDe, marcarAlvo } from './combate.js';
import { efeitosIcones } from './efeitos.js';

export function painelSocial(participantes, mestre) {
  const sis = estado.sistema;
  const { meus, p, chave } = controladoNaSala('social', participantes, mestre);
  if (!p) return null;
  const alvo = alvoDe(p, 'social', participantes);
  const meuLado = participantes.filter(x => x.id !== p.id && x.tipo === p.tipo);
  const outroLado = participantes.filter(x => x.id !== p.id && x.tipo !== p.tipo);
  return h('div', { class: 'social-tres' },
    h('section', { class: 'bloco social-lado' },
      h('div', { class: 'social-eu' },
        h('div', { class: 'barra' }, icone('user'), nomeControlado(meus, p, chave), h('span', { class: 'espaco' }),
          sis.modulos?.social ? h('span', { class: 'rmnp', title: 'Resistência à Manipulação: Manipulação + 50 + modificadores' }, h('small', {}, 'R.MNP'), h('strong', {}, resistenciaManipulacao(p, sis))) : null),
        humorCartao(p, true, mestre),
        efeitosIcones(p, { mestre })),
      meuLado.length ? h('ul', { class: 'social-lista' }, meuLado.map(x => miniCartao(p, x, alvo))) : null),
    h('section', { class: 'bloco social-manip' }, titulo('Manipulações', 'drama'), manipulacoes(p, personagemPorId(alvo), mestre)),
    h('section', { class: 'bloco social-lado outro' },
      outroLado.length ? h('ul', { class: 'social-lista' }, outroLado.map(x => miniCartao(p, x, alvo))) : vazio('Ninguém do outro lado.', 'users'),
      outrosModificadores(mestre)));
}

// Personagem da sala visto pelo seu: humor que aparece e afinidade. Clicar escolhe como alvo.
function miniCartao(eu, x, alvo) {
  const meu = x.donoId === estado.usuario.id || estado.campanha.papel === 'mestre';
  const afinidade = estado.campanha.relacoes?.[eu.id]?.[x.id]?.tipo || 'Neutro';
  const esp = { Aliado: 'a', Amigável: 'a', Rival: 'c', Inimigo: 'c' }[afinidade] || 'b';
  const humor = meu ? (x.humorAparente || x.humor) : x.humor;
  return h('li', {},
    h('button', {
      type: 'button', class: `mini-cartao ${x.id === alvo ? 'alvo' : ''}`, 'aria-pressed': x.id === alvo,
      title: x.id === alvo ? `${x.nome} é o alvo` : `Escolher ${x.nome} como alvo`, onclick: () => marcarAlvo('social', x.id),
    },
      h('span', { class: 'avatar' }, x.foto ? h('img', { src: x.foto, alt: '' }) : x.nome.slice(0, 1)),
      h('span', { class: 'mini-nome' }, h('strong', {}, x.nome), h('small', {}, icone('smile'), ` ${nomeHumor(humor)}`)),
      h('span', { class: `afinidade esp-${esp}`, title: 'Afinidade (mapa de relacionamento)' }, h('small', {}, 'Afin.'), afinidade),
      x.id === alvo ? icone('crosshair') : null));
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
    const r = await acao('social.manipular', { autor: p.id, alvo: b.id, sub, humor, mod: mestre ? estado.sel.manipular?.mod : 0 });
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
      h('div', { class: 'barra' }, regra.causa.map(id => botao(id === 'ler' ? 'Ler o humor real' : nomeHumor(id), () => manipular(id),
        { class: 'pequeno primario', icone: 'drama', disabled: !b, title: `${p.nome} usa ${nomeSub(sub)} em ${b?.nome || 'o alvo'}` })))),
    h('p', { class: 'dica' }, `Se falhar (rebote): ${reboteTexto(regra)}.`),
    b ? botao('Agredir', async () => {
      const custo = sis.social?.agressao?.dano || '1d6';
      if (!(await confirmar(`${p.nome} parte para a agressão contra ${b.nome}? Atacar um humano no meio do diálogo custa ${custo} de Humanidade. Os dois vão para o Campo de Batalha.`))) return;
      const r = await acao('social.agredir', { atacante: p.id, alvo: b.id });
      aviso(r.texto || `${p.nome} e ${b.nome} foram para o Campo de Batalha.`, 'erro');
    }, { class: 'pequeno perigo', icone: 'swords', title: `${p.nome} parte para a agressão` }) : null,
  ];
}

// "Outros modificadores": por enquanto só o bônus livre do mestre (vantagens, situações e bônus aguardam as regras).
function outrosModificadores(mestre) {
  const sel = estado.sel.manipular ||= {};
  return h('div', { class: 'outros-mods' },
    titulo('Outros modificadores', 'sliders-horizontal', 'h4'),
    mestre ? h('label', { class: 'linha' }, 'Bônus livre %', h('input', { type: 'number', class: 'curto', step: 5, value: sel.mod || 0, onchange: e => { sel.mod = e.target.value; } }))
      : h('p', { class: 'dica' }, 'Bônus livre: só o mestre aplica.'),
    h('p', { class: 'dica' }, 'Vantagens, situações e bônus: aguardando as regras.'));
}
