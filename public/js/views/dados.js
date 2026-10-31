import { abrirDescanso } from './descanso.js';
import { h, botao, selecao, aviso, icone, titulo, formatarData } from '../ui.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { derivados, ndPorNivel, subpericiasDe, valorConcentracao } from '/shared/regras.js';
import { linhaRolagem } from './ficha.js';

// Painel de dados da lateral direita, sempre à mão durante a sessão.
const CHAVE = 'msa.dadosAberto';

export function dadosAberto() {
  if (estado.sel.dadosAberto === undefined) {
    let salvo = null;
    try { salvo = localStorage.getItem(CHAVE); } catch { /* sem armazenamento */ }
    estado.sel.dadosAberto = salvo == null ? !matchMedia('(max-width: 860px)').matches : salvo === '1';
  }
  return estado.sel.dadosAberto;
}

function alternar(aberto) {
  estado.sel.dadosAberto = aberto;
  try { localStorage.setItem(CHAVE, aberto ? '1' : '0'); } catch { /* ignore */ }
  render();
}

const cfg = () => (estado.sel.dados ||= { quem: '', acao: '', dif: 'Normal', ndLivre: 70, passiva: 40, nivelNd: 1, mod: 0, intuicao: false, metade: false, qtd: 1, faces: 20, somar: 0, onde: '', secao: 'teste' });

export function botaoDados() {
  return h('button', { type: 'button', class: 'botao-dados', 'aria-label': 'Abrir rolador de dados', title: 'Rolador de dados', onclick: () => alternar(true) }, icone('dices'));
}

// Recolhida: no computador vira uma tira fina na direita (clique para abrir); no celular, o botão redondo.
function dadosRecolhidos() {
  return [
    h('aside', { class: 'dados-trilho', 'aria-label': 'Rolador de dados recolhido' },
      h('button', { type: 'button', title: 'Abrir o rolador de dados', 'aria-label': 'Abrir o rolador de dados', onclick: () => alternar(true) },
        icone('chevron-left'), icone('dices'), h('span', {}, 'Dados'))),
    botaoDados(),
  ];
}

export function painelDados() {
  if (!dadosAberto()) return dadosRecolhidos();
  const c = estado.campanha;
  const sis = estado.sistema;
  const mestre = c.papel === 'mestre';
  const s = cfg();
  const candidatos = mestre ? c.personagens.filter(p => p.atributos) : meusPersonagens();
  if (!mestre && !s.quem && candidatos.length) s.quem = estado.sel.personagem || candidatos[0].id;
  const p = s.quem && personagemPorId(s.quem);
  const d = p?.atributos ? derivados(p, sis) : null;
  const secoes = [['teste', 'Teste', 'dices'], ['rapidos', 'Rápidos', 'zap'], ['sanidade', 'Sanidade', 'brain'], ['livres', 'Livres', 'target']];
  if (sis.regras.rolagemAtributos && (mestre || !p || p.nivel <= 1)) secoes.push(['atributos', 'Atributos', 'sparkles']);
  if (!secoes.some(([id]) => id === s.secao)) s.secao = 'teste';

  return h('aside', { class: 'painel-dados', 'aria-label': 'Rolador de dados' },
    h('div', { class: 'painel-dados-topo' },
      titulo('Dados', 'dices', 'h3'),
      h('span', { class: 'espaco' }),
      botao('', () => alternar(false), { class: 'x', icone: 'chevron-right', title: 'Recolher rolador', 'aria-label': 'Recolher rolador' })),
    // O jogador com um só personagem rola com ele direto; só escolhe quem rola quem tem mais de um (ou o mestre).
    !mestre && candidatos.length <= 1
      ? (p ? h('p', { class: 'quem-rola' }, icone('user'), h('strong', {}, ` ${p.nome}`)) : null)
      : h('label', {}, 'Quem rola',
        selecao([...(mestre ? [{ valor: '', rotulo: 'Mestre (sem ficha)' }] : []), ...candidatos.map(x => ({ valor: x.id, rotulo: x.nome }))], s.quem,
          v => { s.quem = v; s.acao = ''; render(); }, { 'aria-label': 'Quem rola' })),
    h('nav', { class: 'secoes-dados' }, secoes.map(([id, rot, ic]) => h('button', {
      type: 'button', class: s.secao === id ? 'ativa' : '', 'aria-pressed': s.secao === id, onclick: () => { s.secao = id; render(); },
    }, icone(ic), h('span', {}, rot)))),
    h('div', { class: 'corpo-dados' }, {
      teste: () => secaoTeste(p, d, mestre),
      rapidos: () => secaoRapidos(p, d),
      sanidade: () => secaoSanidade(p),
      livres: () => secaoLivres(p),
      atributos: () => secaoAtributos(p),
    }[s.secao]?.() || null),
    h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: 'Registrar em: geral' }, { valor: 'social', rotulo: 'Registrar em: Sala Social' }, { valor: 'batalha', rotulo: 'Registrar em: Campo de Batalha' }],
        s.onde, v => { s.onde = v; }, { 'aria-label': 'Onde registrar' }),
      mestre ? h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: !!s.secreta, onchange: e => { s.secreta = e.target.checked; } }), 'secreta') : null),
    historico());
}

async function enviar(dados, resumo) {
  const s = cfg();
  const r = await acao('rolar', { ...dados, id: s.quem || null, sala: s.onde || null, secreta: !!s.secreta });
  s.ultimo = r;
  aviso(resumo(r), r.sucesso === false ? 'erro' : 'ok');
  render();
  return r;
}

const textoResultado = r => `${r.rotulo}: ${r.total}${r.nd != null ? (r.sucesso ? ' — SUCESSO' : ' — FALHA') : ''}${r.critico ? ` (crítico de ${r.critico})` : ''}${r.ds ? ` · DS ${r.ds}` : ''}`;

function secaoTeste(p, d, mestre) {
  const sis = estado.sistema;
  const s = cfg();
  const nivel = p?.nivel || s.nivelNd;
  const porNivel = ndPorNivel(nivel, sis);
  const opcoesDif = [
    ...sis.teste.dificuldades.map(x => ({ valor: x.nome, rotulo: `${x.nome} · ND ${x.nd}${x.metade ? ' (metade da ação)' : ''}` })),
    ...porNivel.map(x => ({ valor: `nivel:${x.nome}`, rotulo: `${x.nome} do nível ${nivel} · ND ${x.nd}` })),
    { valor: 'passiva', rotulo: 'Contra ação passiva (oponente + 50)' },
    { valor: 'livre', rotulo: 'ND livre…' },
    { valor: 'sem', rotulo: 'Especial (só o número)' },
  ];
  const conc = d ? valorConcentracao(p, sis) : null;
  const opcoesAcao = d ? [{ valor: '', rotulo: 'O que testar…' },
    ...sis.atributos.map(a => ({ valor: `atr:${a.sigla}`, rotulo: `${a.nome}% (${d.percentual[a.sigla]})` })),
    { valor: 'conc', rotulo: `Concentração (${conc.valor}) · ND ${conc.nd}` },
    ...sis.pericias.flatMap(x => [{ valor: `per:${x.id}`, rotulo: `${x.nome} (${d.pericias[x.id]})` },
      ...subpericiasDe(x, p, sis).map(sub => ({ valor: `sub:${sub.id}`, rotulo: `· ${x.nome} › ${sub.nome} (${d.subpericias[sub.id]})` }))])] : null;

  const nd = () => {
    if (s.dif === 'sem') return null;
    if (s.dif === 'livre') return s.ndLivre;
    if (s.dif === 'passiva') return s.passiva + (sis.teste.passiva?.soma ?? 50);
    if (s.dif.startsWith('nivel:')) return porNivel.find(x => `nivel:${x.nome}` === s.dif)?.nd;
    return sis.teste.dificuldades.find(x => x.nome === s.dif)?.nd;
  };
  const numero = (rot, chave, props = {}) => h('label', { class: 'linha' }, rot,
    h('input', { type: 'number', class: 'curto', value: s[chave], ...props, onchange: e => { s[chave] = Number(e.target.value) || 0; render(); } }));

  const sigla = nome => nome.split(/\s+/).map(w => w[0].toUpperCase()).join('');
  const outras = opcoesDif.filter(o => o.valor !== 'sem' && !sis.teste.dificuldades.some(x => x.nome === o.valor));
  const jogar = botao('Jogar D-MIL', async () => {
    const dif = sis.teste.dificuldades.find(x => x.nome === s.dif);
    if (opcoesAcao && !s.acao) throw new Error('Escolha o que testar.');
    const mod = s.mod + (s.intuicao ? (sis.teste.intuicao?.mod ?? -20) : 0);
    await enviar({ acaoRef: opcoesAcao ? s.acao : null, acao: opcoesAcao ? null : (s.acaoLivre ?? 40), rotulo: opcoesAcao ? null : 'Teste', mod, nd: nd(), metade: !!dif?.metade, modo: s.modo || null, intuicao: !!s.intuicao,
      ...(p ? { itemUid: s.itemUid || null, luz: s.luz || null, ajudante: s.ajudante || null, ajuda: s.ajuda || 'auxilio' } : {}) }, textoResultado);
  }, { class: 'primario jogar', icone: 'dices' });
  // Ordem do esboço do autor: dificuldade (F N D MD), Jogar, perícia e outros modificadores.
  return h('div', { class: 'form' },
    h('div', { class: 'bolinhas-dif', role: 'group', 'aria-label': 'Dificuldade' },
      sis.teste.dificuldades.map(x => h('button', {
        type: 'button', class: `bolinha ${s.dif === x.nome ? 'ativa' : ''}`, 'aria-pressed': s.dif === x.nome,
        title: `${x.nome} · ND ${x.nd}${x.metade ? ' (metade da ação)' : ''}`, 'aria-label': `${x.nome}, ND ${x.nd}`,
        onclick: () => { s.dif = x.nome; render(); },
      }, sigla(x.nome))),
      // E = dificuldade Especial: o mestre decide; o app mostra só o número, sem dizer se passou.
      h('button', { type: 'button', class: `bolinha ${s.dif === 'sem' ? 'ativa' : ''}`, 'aria-pressed': s.dif === 'sem',
        title: 'Especial: só o resultado numérico (o mestre diz se passou)', 'aria-label': 'Especial, só o número', onclick: () => { s.dif = 'sem'; render(); } }, 'E')),
    h('p', { class: 'meta nd-escolhido' }, `${opcoesDif.find(o => o.valor === s.dif)?.rotulo || s.dif}`),
    jogar,
    opcoesAcao ? h('label', {}, 'Perícia ou atributo', selecao(opcoesAcao, s.acao, v => { s.acao = v; }, { 'aria-label': 'O que testar' }))
      : numero('Ação %', 'acaoLivre', { value: s.acaoLivre ?? 40 }),
    h('details', { class: 'outros-mods', open: !!s.outrosAbertos || !sis.teste.dificuldades.some(x => x.nome === s.dif), ontoggle: e => { s.outrosAbertos = e.target.open; } },
      h('summary', {}, 'Outros modificadores'),
      selecao([{ valor: '', rotulo: 'Outra dificuldade…' }, ...outras], outras.some(o => o.valor === s.dif) ? s.dif : '', v => { if (v) { s.dif = v; render(); } }, { 'aria-label': 'Outra dificuldade' }),
      s.dif === 'livre' ? numero('ND', 'ndLivre') : null,
      s.dif === 'passiva' ? numero('Ação do oponente %', 'passiva') : null,
      !p && s.dif.startsWith('nivel:') ? numero('Nível', 'nivelNd', { min: 1, max: 20 }) : null,
      h('div', { class: 'barra' },
        numero('Mod.', 'mod', { step: 5 }),
        h('label', { class: 'linha', title: sis.teste.intuicao?.descricao }, h('input', { type: 'checkbox', checked: s.intuicao, onchange: e => { s.intuicao = e.target.checked; } }), `Intuição (${sis.teste.intuicao?.mod ?? -20}%)`)),
      // Vantagem: rola 2d100 e fica com o maior; desvantagem, com o menor. Habilidade ligada que dá vantagem nesse teste entra sozinha.
      selecao([{ valor: '', rotulo: 'Rolagem normal' }, { valor: 'vantagem', rotulo: 'Com vantagem (2d100, o maior)' }, { valor: 'desvantagem', rotulo: 'Com desvantagem (2d100, o menor)' }],
        s.modo || '', v => { s.modo = v || null; }, { 'aria-label': 'Vantagem ou desvantagem' }),
      p ? opcoesDoLivro(p, mestre) : null),
    h('p', { class: 'dica' }, sis.teste.descricao),
    ultimo());
}

// Opções do livro para o teste: item usado (durabilidade e auras de Perícias equipadas), luz (penumbra/escuro)
// e ajuda de outro personagem (ação com auxílio ou ação conjunta).
function opcoesDoLivro(p, mestre) {
  const s = cfg();
  const c = estado.campanha;
  const itens = (p.itens || []).filter(i => !i.sucata);
  if (s.itemUid && !itens.some(i => i.uid === s.itemUid)) s.itemUid = '';
  const outros = c.personagens.filter(x => x.id !== p.id && x.atributos && (mestre || x.tipo === 'pj'));
  return h('div', { class: 'form' },
    selecao([{ valor: '', rotulo: 'Sem item (DS contra a dezena da ação)' }, ...itens.map(i => ({ valor: i.uid, rotulo: `Com ${i.nome}${i.durabilidade != null ? ` (${i.durabilidadeAtual ?? i.durabilidade}/${i.durabilidade})` : ''}${i.aura ? ` · ${i.aura.nome}` : ''}` }))],
      s.itemUid || '', v => { s.itemUid = v; }, { 'aria-label': 'Item usado no teste', title: 'Falhou: DS maior que a durabilidade tira 1. Sem item: DS maior que a dezena da ação danifica uma roupa (movimento) ou deixa Confuso (mental).' }),
    selecao([{ valor: '', rotulo: 'Luz normal' }, { valor: 'penumbra', rotulo: 'Penumbra (Percepção em desvantagem)' }, { valor: 'escuro', rotulo: 'Escuro total (Cego; Percepção em desvantagem)' }],
      s.luz || '', v => { s.luz = v; }, { 'aria-label': 'Luz' }),
    outros.length ? h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: 'Sem ajuda' }, ...outros.map(x => ({ valor: x.id, rotulo: `Ajuda de ${x.nome}` }))], s.ajudante || '', v => { s.ajudante = v; render(); }, { 'aria-label': 'Quem ajuda' }),
      s.ajudante ? selecao([{ valor: 'auxilio', rotulo: 'Auxílio (10% a mais → vantagem)' }, { valor: 'conjunta', rotulo: 'Conjunta (o maior joga, com vantagem)' }], s.ajuda || 'auxilio', v => { s.ajuda = v; }, { 'aria-label': 'Tipo de ajuda' }) : null) : null);
}

function secaoRapidos(p) {
  return h('div', { class: 'form' },
    h('div', { class: 'grade-botoes' },
      p ? botao('Iniciativa', () => enviar({ tipo: 'iniciativa' }, r => `Iniciativa: ${r.total}`), { icone: 'zap', title: 'AGI + 1d10' }) : null,
      botao('d100 (DP)', () => enviar({ dado: '1d100', rotulo: 'Dado principal (d100)' }, r => `d100: ${r.total}`), { icone: 'dices' }),
      botao('d10 (DS)', () => enviar({ dado: '1d10', rotulo: 'Dado de suporte (d10)' }, r => `DS: ${r.total}`), { icone: 'dices' }),
      botao('1d6 (Sacrifício)', () => enviar({ dado: '1d6', rotulo: 'Sacrifício — dano puro' }, r => `Sacrifício: ${r.total} de dano`), { icone: 'heart' })),
    h('p', { class: 'dica' }, 'Iniciativa = AGI + 1d10. DS: compare com a durabilidade do item (falha) ou com o efeito de dano / dezena da ação.'),
    // Descanso: do personagem escolhido; sem personagem (o mestre), do grupo todo.
    titulo('Descanso e necessidades', 'bed', 'h4'),
    h('div', { class: 'grade-botoes' },
      botao(p ? 'Descanso curto' : 'Descanso curto (grupo)', () => acao('descanso.fazer', { tipo: 'curto', ...(p ? { ids: [p.id] } : {}) }).then(r => aviso(r.linhas.join(' · '))).catch(e => aviso(e.message, 'erro')),
        { icone: 'coffee', title: 'Refeição (meia ração) + 1 hora: 1 PV' }),
      botao(p ? 'Descanso longo…' : 'Descanso longo (grupo)…', () => abrirDescanso(p ? { ids: [p.id], quem: p.nome } : {}), { icone: 'bed', title: 'Confirma Conforto, Abrigo e Ergonomia; também tem o descanso interrompido' }),
      p ? botao('Comer', () => acao('necessidade.comer', { id: p.id }).then(() => aviso(`${p.nome} comeu.`)), { icone: 'utensils', title: 'Zera as horas sem comer e tira a Fome' }) : null,
      p ? botao('Beber', () => acao('necessidade.beber', { id: p.id }).then(() => aviso(`${p.nome} bebeu.`)), { icone: 'cup-soda', title: 'A Sede acaba na hora' }) : null),
    p ? testesComuns(p) : null,
    ultimo());
}

// Testes comuns de exploração e sobrevivência: um clique rola a subperícia com a dificuldade escolhida em "Teste".
const TESTES_COMUNS = [
  ['arte.culinaria', 'Cozinhar', 'utensils'],
  ['sobrevivencia.sobrevivencia-basica', 'Acampar (abrigo e fogueira)', 'tent'],
  ['sobrevivencia.esfolamento', 'Esfolar', 'beef'],
  ['sobrevivencia.rastreio', 'Rastrear', 'footprints'],
  ['sobrevivencia.navegacao', 'Navegar', 'compass'],
  ['armadilhas.pescaria', 'Pescar', 'fish'],
  ['extracao.cultivo', 'Cultivar', 'sprout'],
  ['medicina.primeiros-socorros', 'Primeiros socorros', 'heart-pulse'],
  ['arte.costura', 'Costurar', 'scissors'],
];
// Reparo (livro, cap. 5): a perícia depende do item; o app sugere pelo tipo.
const PERICIAS_REPARO = [
  ['engenharia.mecanica', 'Engenharia › Mecânica (armas brancas, veículos, mecânicos)'],
  ['engenharia.militar', 'Engenharia › Militar (armas de fogo, blindagens)'],
  ['engenharia.eletrica', 'Engenharia › Elétrica (baterias, geradores, fiação)'],
  ['engenharia.civil', 'Engenharia › Civil (abrigos, estruturas)'],
  ['engenharia.nuclear', 'Engenharia › Nuclear (rádios, baterias avançadas)'],
  ['computacao.manutencao', 'Computação › Manutenção (computadores e eletrônicos)'],
];
function testesComuns(p) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  const existe = id => sis.pericias.some(x => x.subpericias.some(s => s.id === id));
  const s = cfg();
  const dif = sis.teste.dificuldades.find(x => x.nome === s.dif) || sis.teste.dificuldades.find(x => x.nome === 'Normal');
  // Itens que precisam de reparo: perderam durabilidade, ainda dá para reparar e não viraram sucata.
  const gastos = (p.itens || []).filter(i => typeof i.durabilidade === 'number' && (i.durabilidadeAtual ?? i.durabilidade) < i.durabilidade && !i.sucata);
  const chaveItem = `reparo:item:${p.id}`;
  const chaveSub = `reparo:sub:${p.id}`;
  if (!gastos.some(i => i.uid === estado.sel[chaveItem])) estado.sel[chaveItem] = gastos[0]?.uid || '';
  const item = gastos.find(i => i.uid === estado.sel[chaveItem]);
  const sugerida = !item ? 'engenharia.mecanica' : item.pericia?.startsWith('armas-de-fogo') || /colete|blind|armadura/i.test(item.nome) ? 'engenharia.militar'
    : /bateria|gerador|el[eé]tric|lanterna|r[aá]dio/i.test(item.nome) ? 'engenharia.eletrica' : /computador|tablet|chip|implante|cibern/i.test(item.nome) ? 'computacao.manutencao' : 'engenharia.mecanica';
  if (!estado.sel[chaveSub] || estado.sel[`${chaveSub}:item`] !== item?.uid) { estado.sel[chaveSub] = sugerida; estado.sel[`${chaveSub}:item`] = item?.uid; }
  return [
    titulo('Testes comuns', 'list-checks', 'h4'),
    h('p', { class: 'dica' }, `Rolam com a dificuldade escolhida em "Teste" (${dif?.nome || 'Normal'}).`),
    h('div', { class: 'grade-botoes' }, TESTES_COMUNS.filter(([id]) => existe(id)).map(([id, nome, ic]) =>
      botao(`${nome} ${d.subpericias[id] ?? 0}%`, () => prepararTeste(p.id, `sub:${id}`), { icone: ic, title: `Teste de ${nome}` }))),
    h('div', { class: 'reparo-rapido' },
      h('strong', {}, icone('hammer'), ' Reparar item'),
      gastos.length ? [
        // ND do reparo = 60 + 10 × pontos de durabilidade perdidos.
        selecao(gastos.map(i => ({ valor: i.uid, rotulo: `${i.nome} (${i.durabilidadeAtual ?? i.durabilidade}/${i.durabilidade} · ND ${60 + 10 * (i.durabilidade - (i.durabilidadeAtual ?? i.durabilidade))})${!i.reparavel ? ' — já reparado neste desgaste' : ''}` })), estado.sel[chaveItem], v => { estado.sel[chaveItem] = v; render(); }, { 'aria-label': 'Item para reparar' }),
        selecao(PERICIAS_REPARO.filter(([id]) => existe(id)).map(([id, nome]) => ({ valor: id, rotulo: `${nome} ${d.subpericias[id] ?? 0}%` })), estado.sel[chaveSub], v => { estado.sel[chaveSub] = v; }, { 'aria-label': 'Perícia do reparo' }),
        botao('Reparar', async () => {
          const r = await acao('item.repararTeste', { id: p.id, uid: estado.sel[chaveItem], sub: estado.sel[chaveSub] });
          aviso(`${r.rotulo}: ${r.total} × ${r.nd} — ${r.texto}`, r.sucesso ? 'ok' : 'erro');
        }, { class: 'primario', icone: 'hammer', disabled: !item?.reparavel, title: 'Sucesso: +1 de durabilidade (só 1 por desgaste). Erro crítico ou 3 falhas seguidas: vira sucata.' }),
      ] : h('small', { class: 'dica' }, 'Nenhum item precisando de reparo.')),
  ];
}

function secaoSanidade(p) {
  const sis = estado.sistema;
  const s = cfg();
  const aplicar = async (r, sinal) => {
    if (!p) return;
    const san = p.sanidade || { max: 0, atual: 0 };
    const atual = Math.max(0, Math.min(san.max, san.atual + sinal * r.total));
    await acao('personagem.atualizar', { id: p.id, patch: { sanidade: { ...san, atual } } });
    aviso(`${p.nome}: Sanidade ${san.atual} → ${atual}`);
  };
  // Recuperação: o app confere "uma vez por dia" e, em Jogar/Produzir artes, rola o teste Normal da perícia
  // (a subperícia escolhida em "Teste", se for dessa perícia).
  const recuperar = x => botao(`${x.nome} (${x.dado})`, async () => {
    const r = await acao('sanidade.recuperar', { id: p.id, forma: x.id, acaoRef: s.acao || null });
    aviso(r.linhas.join(' · '), r.recuperou ? 'ok' : 'erro');
  }, { class: 'pequeno', icone: 'plus' });
  const linha = (x, sinal) => botao(`${x.nome} (${x.dado})`, async () => {
    const r = await enviar({ dado: x.dado, rotulo: `${sinal < 0 ? 'Perda' : 'Recuperação'} de Sanidade — ${x.nome}` }, rr => `${rr.rotulo}: ${rr.total}`);
    s.sanPendente = { r, sinal };
    render();
  }, { class: 'pequeno', icone: sinal < 0 ? 'minus' : 'plus' });
  const pend = s.sanPendente;
  return h('div', { class: 'form' },
    p ? h('p', { class: 'meta' }, icone('brain'), ` ${p.nome}: Sanidade ${p.sanidade?.atual ?? '—'} / ${p.sanidade?.max ?? '—'}`) : h('p', { class: 'dica' }, 'Escolha um personagem para aplicar o resultado na ficha.'),
    h('strong', {}, 'Perda'), h('div', { class: 'grade-botoes' }, sis.sanidade.perdas.map(x => linha(x, -1))),
    h('strong', {}, 'Recuperação'), h('div', { class: 'grade-botoes' }, sis.sanidade.recuperacoes.map(x => (p && x.id ? recuperar(x) : linha(x, 1)))),
    h('p', { class: 'dica' }, sis.sanidade.notaRecuperacao),
    pend && p ? h('div', { class: 'cartao-mini' }, `${pend.r.rotulo}: ${pend.r.total}`,
      botao(`Aplicar ${pend.sinal < 0 ? '−' : '+'}${pend.r.total} em ${p.nome}`, async () => { await aplicar(pend.r, pend.sinal); s.sanPendente = null; render(); }, { class: 'pequeno primario', icone: 'check' })) : null);
}

function secaoLivres() {
  const s = cfg();
  const expr = () => `${s.qtd}d${s.faces}${s.somar ? (s.somar > 0 ? `+${s.somar}` : s.somar) : ''}`;
  return h('div', { class: 'form' },
    h('div', { class: 'grade-botoes dados-faces' }, [4, 6, 8, 10, 12, 20, 100].map(f => h('button', {
      type: 'button', class: s.faces === f ? 'ativa' : '', 'aria-pressed': s.faces === f, onclick: () => { s.faces = f; render(); },
    }, `d${f}`))),
    h('div', { class: 'barra' },
      h('label', { class: 'linha' }, 'Qtd.', h('input', { type: 'number', class: 'curto', min: 1, max: 100, value: s.qtd, onchange: e => { s.qtd = Math.max(1, Math.min(100, Number(e.target.value) || 1)); render(); } })),
      h('label', { class: 'linha' }, 'Somar', h('input', { type: 'number', class: 'curto', value: s.somar, onchange: e => { s.somar = Number(e.target.value) || 0; render(); } }))),
    botao(`Rolar ${expr()}`, () => enviar({ dado: expr(), rotulo: expr() }, r => `${r.rotulo}: ${r.total} [${r.dados.join(', ')}]`), { class: 'primario', icone: 'dices' }),
    ultimo());
}

function secaoAtributos() {
  const sis = estado.sistema;
  const ra = sis.regras.rolagemAtributos;
  return h('div', { class: 'form' },
    h('p', { class: 'dica' }, ra.descricao),
    h('p', { class: 'alerta' }, icone('circle-alert'), ' Depois de escolher entre pontos fixos e dados, não dá para trocar. Combine com o mestre.'),
    botao('Rolar os 8 atributos', () => enviar({ tipo: 'atributos' }, r => `Atributos: ${r.valores.map(v => v.total).join(', ')} (soma ${r.total})`), { class: 'primario', icone: 'sparkles' }),
    ultimo());
}

function ultimo() {
  const r = cfg().ultimo;
  if (!r) return null;
  // Teste com item bem-sucedido e DS bom: o dono escolhe a aura (Perícias equipadas).
  const aura = r.aura && r.personagemId ? h('div', { class: 'barra' }, h('small', {}, `Aura para ${r.aura.item}:`),
    r.aura.opcoes.map(o => botao(o.nome, async () => {
      const x = await acao('item.aura', { id: r.personagemId, uid: r.aura.uid, aura: o.id });
      aviso(x.texto); cfg().ultimo = { ...r, aura: null }; render();
    }, { class: 'pequeno', title: o.texto }))) : null;
  return h('div', { class: 'cartao-mini ultimo-resultado' }, linhaRolagem(r), aura);
}

function historico() {
  const c = estado.campanha;
  const todas = [...(c.log || []), ...Object.values(c.salas || {}).flatMap(s => s.log || [])].filter(e => !e.texto || e.tipo === 'dmil').sort((a, b) => b.em - a.em).slice(0, 15);
  return h('details', { class: 'historico-dados', open: estado.sel.histAberto !== false, ontoggle: e => { estado.sel.histAberto = e.target.open; } },
    h('summary', {}, icone('scroll'), ' Últimas rolagens'),
    todas.length ? h('ol', { class: 'log' }, todas.map(e => h('li', {}, h('small', {}, formatarData(e.em)), ' ', linhaRolagem(e)))) : h('p', { class: 'dica' }, 'Nenhuma rolagem ainda.'));
}

// Botões de dado da ficha e do combate: rolam o teste na hora (com a dificuldade escolhida no rolador, Normal por padrão)
// e abrem o rolador com o resultado. Sem perícia escolhida (ex.: "Rolar teste"), só abre o rolador.
export async function prepararTeste(personagemId, acaoRef) {
  const s = cfg();
  Object.assign(s, { quem: personagemId, acao: acaoRef, secao: 'teste' });
  estado.sel.dadosAberto = true;
  render();
  if (!acaoRef) return;
  const sis = estado.sistema;
  const dif = s.dif === 'sem' ? null : sis.teste.dificuldades.find(x => x.nome === s.dif) || sis.teste.dificuldades.find(x => x.nome === 'Normal');
  const nd = dif ? dif.nd : null;
  await enviar({ acaoRef, mod: s.mod || 0, nd, metade: !!dif?.metade, modo: s.modo || null }, textoResultado);
}
