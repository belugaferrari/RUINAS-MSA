import { h, botao, selecao, aviso, icone, titulo, formatarData } from '../ui.js';
import { estado, render, personagemPorId, meusPersonagens } from '../estado.js';
import { acao } from '../api.js';
import { derivados, ndPorNivel } from '/shared/regras.js';
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
    h('label', {}, 'Quem rola',
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
    { valor: 'sem', rotulo: 'Sem ND (só o total)' },
  ];
  const opcoesAcao = d ? [{ valor: '', rotulo: 'O que testar…' },
    ...sis.atributos.map(a => ({ valor: `atr:${a.sigla}`, rotulo: `${a.nome}% (${d.percentual[a.sigla]})` })),
    ...sis.pericias.flatMap(x => [{ valor: `per:${x.id}`, rotulo: `${x.nome} (${d.pericias[x.id]})` },
      ...x.subpericias.map(sub => ({ valor: `sub:${sub.id}`, rotulo: `· ${x.nome} › ${sub.nome} (${d.subpericias[sub.id]})` }))])] : null;

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
  const outras = opcoesDif.filter(o => !sis.teste.dificuldades.some(x => x.nome === o.valor));
  const jogar = botao('Jogar D-MIL', async () => {
    const dif = sis.teste.dificuldades.find(x => x.nome === s.dif);
    if (opcoesAcao && !s.acao) throw new Error('Escolha o que testar.');
    const mod = s.mod + (s.intuicao ? (sis.teste.intuicao?.mod ?? -20) : 0);
    await enviar({ acaoRef: opcoesAcao ? s.acao : null, acao: opcoesAcao ? null : (s.acaoLivre ?? 40), rotulo: opcoesAcao ? null : 'Teste', mod, nd: nd(), metade: !!dif?.metade }, textoResultado);
  }, { class: 'primario jogar', icone: 'dices' });
  // Ordem do esboço do autor: dificuldade (F N D MD), Jogar, perícia e outros modificadores.
  return h('div', { class: 'form' },
    h('div', { class: 'bolinhas-dif', role: 'group', 'aria-label': 'Dificuldade' },
      sis.teste.dificuldades.map(x => h('button', {
        type: 'button', class: `bolinha ${s.dif === x.nome ? 'ativa' : ''}`, 'aria-pressed': s.dif === x.nome,
        title: `${x.nome} · ND ${x.nd}${x.metade ? ' (metade da ação)' : ''}`, 'aria-label': `${x.nome}, ND ${x.nd}`,
        onclick: () => { s.dif = x.nome; render(); },
      }, sigla(x.nome)))),
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
        h('label', { class: 'linha', title: sis.teste.intuicao?.descricao }, h('input', { type: 'checkbox', checked: s.intuicao, onchange: e => { s.intuicao = e.target.checked; } }), `Intuição (${sis.teste.intuicao?.mod ?? -20}%)`))),
    h('p', { class: 'dica' }, sis.teste.descricao),
    ultimo());
}

function secaoRapidos(p) {
  return h('div', { class: 'form' },
    h('div', { class: 'grade-botoes' },
      p ? botao('Iniciativa', () => enviar({ tipo: 'iniciativa' }, r => `Iniciativa: ${r.total}`), { icone: 'zap', title: 'AGI + 1d10' }) : null,
      botao('d100 (DP)', () => enviar({ dado: '1d100', rotulo: 'Dado principal (d100)' }, r => `d100: ${r.total}`), { icone: 'dices' }),
      botao('d10 (DS)', () => enviar({ dado: '1d10', rotulo: 'Dado de suporte (d10)' }, r => `DS: ${r.total}`), { icone: 'dices' }),
      botao('1d6 (Sacrifício)', () => enviar({ dado: '1d6', rotulo: 'Sacrifício — dano puro' }, r => `Sacrifício: ${r.total} de dano`), { icone: 'heart' })),
    h('p', { class: 'dica' }, 'Iniciativa = AGI + 1d10. DS: compare com a durabilidade do item (falha) ou com o efeito de dano / dezena da ação.'),
    ultimo());
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
  const linha = (x, sinal) => botao(`${x.nome} (${x.dado})`, async () => {
    const r = await enviar({ dado: x.dado, rotulo: `${sinal < 0 ? 'Perda' : 'Recuperação'} de Sanidade — ${x.nome}` }, rr => `${rr.rotulo}: ${rr.total}`);
    s.sanPendente = { r, sinal };
    render();
  }, { class: 'pequeno', icone: sinal < 0 ? 'minus' : 'plus' });
  const pend = s.sanPendente;
  return h('div', { class: 'form' },
    p ? h('p', { class: 'meta' }, icone('brain'), ` ${p.nome}: Sanidade ${p.sanidade?.atual ?? '—'} / ${p.sanidade?.max ?? '—'}`) : h('p', { class: 'dica' }, 'Escolha um personagem para aplicar o resultado na ficha.'),
    h('strong', {}, 'Perda'), h('div', { class: 'grade-botoes' }, sis.sanidade.perdas.map(x => linha(x, -1))),
    h('strong', {}, 'Recuperação'), h('div', { class: 'grade-botoes' }, sis.sanidade.recuperacoes.map(x => linha(x, 1))),
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
  return r ? h('div', { class: 'cartao-mini ultimo-resultado' }, linhaRolagem(r)) : null;
}

function historico() {
  const c = estado.campanha;
  const todas = [...(c.log || []), ...Object.values(c.salas || {}).flatMap(s => s.log || [])].filter(e => !e.texto).sort((a, b) => b.em - a.em).slice(0, 15);
  return h('details', { class: 'historico-dados', open: estado.sel.histAberto !== false, ontoggle: e => { estado.sel.histAberto = e.target.open; } },
    h('summary', {}, icone('scroll'), ' Últimas rolagens'),
    todas.length ? h('ol', { class: 'log' }, todas.map(e => h('li', {}, h('small', {}, formatarData(e.em)), ' ', linhaRolagem(e)))) : h('p', { class: 'dica' }, 'Nenhuma rolagem ainda.'));
}

// Botões de dado da ficha: abrem o rolador lateral já com o personagem e a ação escolhidos.
// O jogador só confere a dificuldade e rola.
export function prepararTeste(personagemId, acaoRef) {
  const s = cfg();
  Object.assign(s, { quem: personagemId, acao: acaoRef, secao: 'teste' });
  estado.sel.dadosAberto = true;
  render();
  setTimeout(() => {
    const b = [...document.querySelectorAll('.painel-dados button')].find(x => /Jogar D-MIL/.test(x.textContent));
    b?.focus();
    b?.scrollIntoView({ block: 'nearest' });
  }, 0);
}
