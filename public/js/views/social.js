// Sala Social: em cima, a barra do personagem que você controla (avatar, R.MNP, humor real e aparente só com ícones,
// vantagens e habilidades de manipulação); embaixo, a mesa social: duas colunas com quem está na sala e as Manipulações.
// Toda manipulação é oculta: só o mestre vê quem testou, a intenção e o resultado.
import { h, botao, aviso, icone, titulo, confirmar, vazio, janela } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados, listaHabilidades, efeitosHabilidade, podeSeduzir } from '/shared/regras.js';
import { resistenciaManipulacao } from '/shared/combate.js';
import { controladoNaSala, nomeControlado } from './batalha.js';
import { humorCartao, nomeHumor, nomeSub, reboteTexto, alvoDe, marcarAlvo, iconeHumor, humores } from './combate.js';
import { efeitosIcones } from './efeitos.js';
import { mostrarTesteFeito } from './animacao.js';

export function painelSocial(participantes, mestre) {
  const { meus, p, chave } = controladoNaSala('social', participantes, mestre);
  if (!p) return mestre ? barraMestre(participantes) : null;
  const alvo = alvoDe(p, 'social', participantes);
  // Sem lados nem ordem: só duas colunas de até 10 para caber na tela.
  const outros = participantes.filter(x => x.id !== p.id);
  const esquerda = outros.slice(0, 10);
  const direita = outros.slice(10);
  return h('div', { class: 'social-painel' },
    barraPersonagem(p, meus, chave, mestre, participantes),
    h('div', { class: 'social-tres' },
      h('section', { class: 'bloco social-lado' }, titulo('Mesa social', 'users', 'h3'),
        esquerda.length ? h('ul', { class: 'social-lista' }, esquerda.map(x => miniCartao(p, x, alvo))) : vazio('Ninguém mais na sala.', 'users')),
      h('section', { class: 'bloco social-manip' }, titulo('Manipulações', 'drama'), manipulacoes(p, personagemPorId(alvo), mestre)),
      h('section', { class: 'bloco social-lado outro' },
        direita.length ? h('ul', { class: 'social-lista' }, direita.map(x => miniCartao(p, x, alvo))) : null,
        // Bônus livre e de situação: só o mestre aplica (as vantagens de manipulação já estão na barra de cima).
        mestre ? outrosModificadores(p, mestre) : null)));
}

// Mestre sem personagem controlado na sala: só os botões gerais.
function barraMestre(participantes) {
  return participantes.length ? h('div', { class: 'social-barra bloco' }, botaoEmpatiaNatural()) : null;
}

function botaoEmpatiaNatural() {
  return botao('Empatia natural', async () => {
    const r = await acao('social.empatiaNatural', {});
    janela('Empatia natural (oculta)', h('div', {},
      h('p', { class: 'dica' }, `${r.mudaram} personagem(ns) mudaram de humor. Os jogadores não são avisados (não sabem se foi manipulação ou empatia natural).`),
      h('ul', { class: 'lista-descanso' }, r.linhas.map(l => h('li', {}, l)))), [['OK', () => true]]);
  }, { class: 'pequeno', icone: 'waves', title: 'Teste oculto para todos os humanos da sala: cada um influencia os outros com o humor que mostra (CAR% + 1d100 contra o R.MNP de cada um)' });
}

// Barra superior: avatar, nome, R.MNP, humor real e aparente (só ícones; o título explica), vantagens de manipulação.
function barraPersonagem(p, meus, chave, mestre, participantes) {
  const sis = estado.sistema;
  const real = p.humor || 'neutro';
  const aparente = p.humorAparente || 'neutro';
  const efeitosReal = humores().find(x => x.id === real)?.efeitos || '';
  const abrirHumor = () => janela(`Humor de ${p.nome}`, h('div', { class: 'humor-janela' },
    h('p', { class: 'dica' }, 'Humor real: o que você sente (dá os bônus e ônus). Humor aparente: a máscara que a sala vê.'),
    humorCartao(p, true, mestre)), [['Fechar', () => true]]);
  const icHumor = (id, titulo, classe) => h('button', { type: 'button', class: `humor-icone ${classe}`, title: titulo, 'aria-label': titulo, onclick: abrirHumor },
    icone(iconeHumor(id)), h('span', {}, nomeHumor(id)));
  const daManipulacao = listaHabilidades(p, sis).filter(x => /manipula|l[aá]bia|sedu[cç]|intimida|lideran|empatia|etiqueta|interrogat|tortura|impressionar|r\.?\s?mnp/i.test(`${x.nome} ${x.descricao}`));
  const ativas = new Set(p.ativas || []);
  const meu = p.donoId === estado.usuario.id;
  return h('div', { class: 'social-barra bloco' },
    h('span', { class: 'avatar rosto', 'data-pid': p.id }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
    nomeControlado(meus, p, chave),
    sis.modulos?.social ? h('span', { class: 'rmnp', title: 'R.MNP — Resistência à Manipulação: Manipulação + 50 + modificadores. É a dificuldade para manipular você.' },
      h('small', {}, 'R.MNP'), h('strong', {}, resistenciaManipulacao(p, sis))) : null,
    sis.modulos?.social ? h('span', { class: 'humores-barra' },
      icHumor(real, `Humor real: ${nomeHumor(real)}${efeitosReal ? ` — ${efeitosReal}` : ''}${p.humorImposto ? ' (imposto: mudar custa Sanidade)' : ''}. Clique para mudar.`, `real ${p.humorImposto ? 'imposto' : ''}`),
      h('span', { class: `mascara ${aparente !== real ? 'com' : ''}`, title: `Humor aparente (o que a sala vê): ${nomeHumor(aparente)}${aparente === real ? ' — igual ao real' : ''}` },
        h('button', { type: 'button', class: 'humor-icone aparente', onclick: abrirHumor, 'aria-label': `Humor aparente: ${nomeHumor(aparente)}` },
          icone('drama'), icone(iconeHumor(aparente)), h('span', {}, nomeHumor(aparente))))) : null,
    efeitosIcones(p, { mestre }),
    daManipulacao.length ? h('span', { class: 'vant-manip' }, daManipulacao.map(x => h('span', {
      class: `selo ${ativas.has(x.id) ? 'ok' : ''}`, title: `${x.nome}${ativas.has(x.id) ? ' (ativa)' : ''}: ${x.descricao}`,
    }, x.nome))) : null,
    h('span', { class: 'espaco' }),
    mestre ? botaoEmpatiaNatural() : null,
    mestre || meu ? botao('', () => acao('sala.remover', { sala: 'social', id: p.id }), { class: 'pequeno', icone: 'log-out', title: `${p.nome} sai da sala` }) : null);
}

// Personagem da sala como o seu o enxerga: o humor que ele interpreta (o aparente)
// e a afinidade (como o SEU personagem vê o outro — escolha do jogador, aqui ou nas Redes Sociais).
// Clicar no cartão escolhe o alvo; clicar na afinidade muda a afinidade.
function miniCartao(eu, x, alvo) {
  const sis = estado.sistema;
  const afinidade = estado.campanha.relacoes?.[eu.id]?.[x.id]?.tipo || 'Neutro';
  const esp = { Aliado: 'a', Amigável: 'a', Rival: 'c', Inimigo: 'c' }[afinidade] || 'b';
  const mestre = estado.campanha.papel === 'mestre';
  const visto = x.donoId === estado.usuario.id || mestre ? (x.humorAparente || 'neutro') : x.humor;
  const real = x.humor || 'neutro';
  return h('li', { class: `mini-linha ${x.id === alvo ? 'alvo' : ''}` },
    h('button', {
      type: 'button', class: `mini-cartao ${x.id === alvo ? 'alvo' : ''} ${x.semPv || (x.pv && x.pv.atual <= 0) ? 'sem-pv' : ''}`, 'aria-pressed': x.id === alvo,
      title: x.id === alvo ? `${x.nome} é o alvo` : `Escolher ${x.nome} como alvo`, onclick: () => marcarAlvo('social', x.id),
    },
      h('span', { class: 'avatar rosto', 'data-pid': x.id }, x.foto ? h('img', { src: x.foto, alt: '' }) : x.nome.slice(0, 1)),
      h('span', { class: 'mini-nome' }, h('strong', {}, x.nome),
        // Sempre o humor interpretado (a máscara, se houver). O que a Empatia revela fica só no aviso e no registro de quem leu.
        // O mestre vê os dois: o humor real e, se houver máscara, o aparente.
        mestre
          ? h('small', { class: 'humores-mestre' },
            h('span', { title: 'Humor real' }, icone(iconeHumor(real)), ` ${nomeHumor(real)}`),
            h('span', { class: 'aparente', title: 'Humor aparente (o que a sala vê)' }, icone('drama'), ` ${nomeHumor(x.humorAparente || 'neutro')}`))
          : h('small', { title: 'Humor como o seu personagem interpreta (pode ser uma máscara)' }, icone(iconeHumor(visto)), ` ${nomeHumor(visto)}`)),
      x.id === alvo ? icone('crosshair') : null),
    h('div', { class: 'mini-acoes' },
      h('button', { type: 'button', class: `afinidade esp-${esp}`, title: `Como ${eu.nome} vê ${x.nome}. Clique para mudar`, 'aria-label': `Afinidade de ${eu.nome} com ${x.nome}: ${afinidade}. Mudar`,
        onclick: () => escolherAfinidade(eu, x, afinidade) }, h('small', {}, 'Afin.'), afinidade)));
}

function escolherAfinidade(eu, x, atual) {
  let fechar = () => {};
  // Depois do 1º teste na Sala Social, só o mestre muda a afinidade.
  if (estado.campanha.papel !== 'mestre' && (estado.campanha.salas.social.testaram || []).includes(eu.id)) {
    return aviso('As afinidades só podem ser ajustadas antes do primeiro teste na Sala Social. Peça ao mestre.', 'erro');
  }
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
  // "Intuir humor" (Empatia, oculto): o personagem não sabe se acertou; o mestre vê e interpreta na mesa.
  const INTUIR = 'intuir';
  if (!regras[estado.sel[chaveSub]] && estado.sel[chaveSub] !== INTUIR) estado.sel[chaveSub] = 'manipulacao.labia';
  const intuir = estado.sel[chaveSub] === INTUIR;
  const sub = intuir ? 'manipulacao.empatia' : estado.sel[chaveSub];
  const regra = regras[sub];
  const manipular = async humor => {
    if (!b) throw new Error('Escolha o alvo (clique num personagem).');
    const sel = estado.sel.manipular || {};
    const r = await acao('social.manipular', { autor: p.id, alvo: b.id, sub, humor, mod: mestre ? (parseInt(sel.mod, 10) || 0) + (parseInt(sel.situacaoMod, 10) || 0) : 0 });
    // Teste oculto: o jogador não sabe se funcionou (o mestre vê o resultado no registro).
    const nome = humor === 'ler' ? 'Intuir humor' : nomeSub(sub);
    // Intuir humor: o que o personagem percebe (o aparente se falhou, o real se passou — escrito igual).
    // Os outros testes são ocultos: só uma arte dizendo que o teste foi feito.
    if (r.percebido) aviso(r.percebido);
    else if (r.oculto) aviso(`${nome} em ${b.nome}: feito em segredo. Só o mestre vê o resultado.`);
    else aviso(r.revelado || `${r.autor}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
    if (r.oculto) mostrarTesteFeito(humor === 'ler' ? 'eye' : 'drama', r.rotulo);
  };
  const d100 = (id) => d.subpericias[id] ?? 0;
  return [
    h('p', { class: 'alvo-manip' }, icone('crosshair'), b ? [' Alvo: ', h('strong', {}, b.nome)] : ' Clique num personagem para escolher o alvo.'),
    h('div', { class: 'grade-manip' },
      Object.keys(regras).map(id => h('button', {
        type: 'button', class: `manip ${!intuir && id === sub ? 'ativa' : ''}`, 'aria-pressed': !intuir && id === sub, title: `Rebote se falhar — ${reboteTexto(regras[id])}`,
        onclick: () => { estado.sel[chaveSub] = id; render(); },
      }, h('strong', {}, nomeSub(id)), h('small', {}, `${d100(id)}%`))),
      h('button', {
        type: 'button', class: `manip intuir ${intuir ? 'ativa' : ''}`, 'aria-pressed': intuir, title: 'Intuir o humor real de alguém (Empatia). Você recebe o que percebeu: se falhar, o humor aparente; se passar, o real — sem saber qual.',
        onclick: () => { estado.sel[chaveSub] = INTUIR; render(); },
      }, h('strong', {}, 'Intuir humor'), h('small', {}, `Empatia ${d100('manipulacao.empatia')}%`))),
    intuir
      ? h('div', { class: 'causar' },
        h('small', {}, `Intuir o humor real de ${b?.nome || 'o alvo'} (Empatia). Você recebe o que percebeu, sem saber se acertou.`),
        h('div', { class: 'barra' }, botao(`Intuir o humor de ${b?.nome || 'o alvo'}`, () => manipular('ler'),
          { class: 'pequeno primario', icone: 'eye', disabled: !b, title: 'Você recebe o que o seu personagem percebeu' })))
      : h('div', { class: 'causar' },
        h('small', {}, `${nomeSub(sub)}: o que causar em ${b?.nome || 'o alvo'}?`),
        // Sedução: só em quem se atrai pelo gênero de quem seduz.
        sub === 'manipulacao.seducao' && b && !podeSeduzir(p, b).ok ? h('p', { class: 'alerta' }, icone('heart-crack'), ` ${podeSeduzir(p, b).motivo}`) : null,
        h('div', { class: 'barra' }, regra.causa.filter(id => id !== 'ler').map(id => botao(nomeHumor(id), () => manipular(id),
          { class: 'pequeno primario', icone: 'drama', disabled: !b || (sub === 'manipulacao.seducao' && !podeSeduzir(p, b).ok), title: `${p.nome} usa ${nomeSub(sub)} em ${b?.nome || 'o alvo'}` })))),
    // Intuir humor não tem rebote (autor, 22/10).
    intuir ? null : h('p', { class: 'dica' }, `Se falhar (rebote): ${reboteTexto(regra)}.`),
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
