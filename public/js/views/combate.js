// Campo de Batalha: controle de turno (qualquer sistema) e combate automático; Sala Social: Roda do Humor.
// O ataque automático e a Roda do Humor só ligam nos sistemas com esses módulos (hoje, o MSS).
import { h, botao, selecao, aviso, icone, titulo } from '../ui.js';
import { estado, personagemPorId, render } from '../estado.js';
import { acao } from '../api.js';
import { derivados } from '/shared/regras.js';
import { armasDisponiveis, opcoesDefesa, defesaDoAlvo, ipDe, resistenciaManipulacao } from '/shared/combate.js';

const meuOuMestre = (p, mestre) => mestre || p.donoId === estado.usuario.id;
const opcoesPersonagens = lista => lista.map(p => ({ valor: p.id, rotulo: p.nome }));
const caixa = (sel, chave, rotulo) => h('label', { class: 'linha' },
  h('input', { type: 'checkbox', checked: !!sel[chave], onchange: e => { sel[chave] = e.target.checked; } }), rotulo);

// ---------- Campo de Batalha ----------

export function combateView(participantes, mestre) {
  const sis = estado.sistema;
  const auto = !!sis.modulos?.combate;
  const cb = estado.campanha.salas.batalha.combate;
  return h('div', { class: 'bloco combate' },
    titulo(`Turnos${auto ? ` e combate (${sis.nome})` : ''}`, 'swords'),
    cb ? ordemView(cb, mestre) : h('div', { class: 'barra' },
      h('p', { class: 'dica' }, `Iniciativa = AGI + 1d10${auto ? ' (Corajoso, Amedrontado e Enojado rolam com vantagem)' : ''}. A ordem vai do maior para o menor.`),
      mestre ? botao('Iniciar combate', () => acao('combate.iniciar'), { class: 'primario', icone: 'play', disabled: participantes.length < 2 }) : null),
    cb ? painelVez(cb, mestre) : null,
    auto ? pendentesView(mestre) : null,
    auto ? ataqueView(participantes, mestre, cb)
      : h('p', { class: 'dica' }, icone('info'), ` No ${sis.nome} o ataque ainda é resolvido com os testes da sala e os PV à mão; o ataque automático liga quando a campanha está no MSS.`),
    mestre ? xpDaSala(participantes) : null);
}

// Quem está na vez: atalhos para o dono (ou o mestre) agir sem procurar na tela.
function painelVez(cb, mestre) {
  const p = personagemPorId(cb.ordem[cb.vez]?.id);
  if (!p) return null;
  const meu = p.donoId === estado.usuario.id;
  if (!meu && !mestre) return h('p', { class: 'vez-de' }, icone('hourglass'), ` Vez de ${p.nome}.`);
  const armas = (p.itens || []).filter(i => i.equipado && i.capacidade);
  return h('div', { class: `painel-vez ${meu ? 'minha' : ''}` },
    h('strong', {}, icone('zap'), meu ? ` Sua vez: ${p.nome}` : ` Vez de ${p.nome}`),
    p.pv ? h('span', { class: 'selo' }, icone('heart'), `${p.pv.atual}/${p.pv.max}`) : null,
    armas.map(i => h('span', { class: 'municao' },
      h('span', { class: `selo ${(i.carregada || 0) <= 0 ? 'perigo' : ''}` }, `${i.nome}: ${i.carregada || 0}/${i.capacidade}`),
      botao('', () => acao('item.municao', { id: p.id, uid: i.uid, delta: -1 }), { class: 'pequeno', icone: 'minus', title: `Gastar 1 bala de ${i.nome}`, disabled: (i.carregada || 0) <= 0 }),
      botao('Recarregar', () => acao('item.recarregar', { id: p.id, uid: i.uid }), { class: 'pequeno', icone: 'refresh-cw', disabled: (i.carregada || 0) >= i.capacidade }))),
    h('span', { class: 'espaco' }),
    botao('Rolar teste', () => { estado.sel['rolar-batalha'] = { ...(estado.sel['rolar-batalha'] || { dif: '1', valor: 50 }), quem: p.id, acao: '' }; render();
      document.querySelector('[aria-label="O que testar"]')?.focus(); }, { class: 'pequeno', icone: 'dices' }),
    botao('Passar a vez', () => acao('combate.proximo'), { class: 'pequeno primario', icone: 'skip-forward' }));
}

// O mestre dá XP de uma vez a todos os personagens-jogador da sala.
export function xpDaSala(participantes) {
  const pjs = participantes.filter(p => p.tipo === 'pj');
  if (!pjs.length) return null;
  const qtd = h('input', { type: 'number', class: 'curto', value: 100, 'aria-label': 'XP para cada PJ' });
  const motivo = h('input', { class: 'curto', placeholder: 'motivo (opcional)', 'aria-label': 'Motivo do XP' });
  return h('div', { class: 'barra xp-sala' },
    icone('sparkles'), h('span', {}, `XP para os ${pjs.length} PJs da sala:`), qtd, motivo,
    botao('Dar XP', async () => {
      await acao('xp.dar', { ids: pjs.map(p => p.id), qtd: qtd.value, motivo: motivo.value });
      aviso(`+${qtd.value} XP para ${pjs.map(p => p.nome).join(', ')}`);
    }, { class: 'pequeno', icone: 'sparkles' }));
}

// Ataques declarados esperando a defesa. Quem controla o alvo (ou o mestre) escolhe; os valores só aparecem para quem escolhe.
function pendentesView(mestre) {
  const sis = estado.sistema;
  const lista = estado.campanha.salas.batalha.pendentes || [];
  if (!lista.length) return null;
  return h('div', { class: 'pendentes' },
    titulo('Aguardando defesa', 'shield'),
    lista.map(pd => {
      const a = personagemPorId(pd.atacante);
      const b = personagemPorId(pd.alvo);
      const escolhe = b && b.atributos && meuOuMestre(b, mestre);
      const podeCancelar = mestre || a?.donoId === estado.usuario.id;
      let botoes = [];
      if (escolhe) {
        const arma = { uid: pd.opcoes.armaUid || 'desarmado', alcance: pd.alcance };
        botoes = opcoesDefesa(b, arma, sis, { area: pd.area }).map(o => {
          const total = defesaDoAlvo(b, arma, sis, { escolha: o.id, cobertura: pd.opcoes.cobertura, area: pd.area }).total;
          return botao(`${o.nome} (${total})`, () => acao('combate.defender', { id: pd.id, defesa: o.id }).then(r => aviso(`${r.autor} ${r.rotulo}: ${r.texto}`, r.sucesso ? 'erro' : 'ok')),
            { class: o.id === 'nenhuma' ? 'pequeno' : 'pequeno primario', icone: o.id === 'nenhuma' ? 'x' : 'shield', title: o.nota || `Defender com ${o.nome}` });
        });
      }
      return h('div', { class: 'pendente' },
        h('div', {}, h('strong', {}, a?.nome || '?'), ` ataca `, h('strong', {}, b?.nome || '?'), ` com ${pd.arma}${pd.area ? ' (ataque em área)' : ''}${pd.alcance === 'distancia' ? ' (a distância)' : ''}`),
        escolhe ? h('div', { class: 'barra' }, h('span', { class: 'dica' }, 'Defender com:'), botoes)
          : h('p', { class: 'dica' }, `Aguardando ${b?.nome || 'o alvo'} escolher a defesa…`),
        podeCancelar ? botao('Cancelar ataque', () => acao('combate.cancelar', { id: pd.id }), { class: 'pequeno perigo', icone: 'square-x' }) : null);
    }));
}

function ordemView(cb, mestre) {
  const atual = personagemPorId(cb.ordem[cb.vez]?.id);
  const podePassar = mestre || atual?.donoId === estado.usuario.id;
  return h('div', {},
    h('div', { class: 'barra' },
      h('span', { class: 'selo cheio' }, `Rodada ${cb.rodada}`),
      h('strong', {}, atual ? `Vez de ${atual.nome}` : ''),
      h('span', { class: 'espaco' }),
      podePassar ? botao('Próximo turno', () => acao('combate.proximo'), { class: 'primario', icone: 'skip-forward' }) : null,
      mestre ? botao('Encerrar', () => acao('combate.encerrar'), { class: 'perigo', icone: 'square-x' }) : null),
    h('ol', { class: 'ordem-iniciativa' }, cb.ordem.map((o, i) => {
      const p = personagemPorId(o.id);
      return h('li', { class: i === cb.vez ? 'vez' : '' },
        h('span', { class: 'ini' }, o.ini), ' ', p?.nome || '?',
        mestre ? botao('', () => acao('combate.ordenar', { id: o.id, direcao: -1 }), { class: 'pequeno', icone: 'chevron-up', disabled: i === 0, title: `Adiantar ${p?.nome}` }) : null,
        mestre ? botao('', () => acao('combate.ordenar', { id: o.id, direcao: 1 }), { class: 'pequeno', icone: 'chevron-down', disabled: i === cb.ordem.length - 1, title: `Atrasar ${p?.nome}` }) : null);
    })));
}

function ataqueView(participantes, mestre, cb) {
  const sis = estado.sistema;
  const meus = participantes.filter(p => meuOuMestre(p, mestre) && p.atributos);
  if (!meus.length) return null;
  const sel = estado.sel.ataque ||= { atacante: '', alvo: '', arma: 'desarmado', duasArmas: '' };
  const daVez = cb && meus.find(p => p.id === cb.ordem[cb.vez]?.id);
  if (!meus.some(p => p.id === sel.atacante)) sel.atacante = (daVez || meus[0]).id;
  const a = personagemPorId(sel.atacante);
  const alvos = participantes.filter(p => p.id !== a.id);
  if (!alvos.some(p => p.id === sel.alvo)) sel.alvo = alvos[0]?.id || '';
  const armas = armasDisponiveis(a, sis);
  if (!armas.some(x => x.uid === sel.arma)) sel.arma = 'desarmado';
  const arma = armas.find(x => x.uid === sel.arma);
  const d = derivados(a, sis);
  const b = personagemPorId(sel.alvo);
  // Só o mestre vê as defesas e o IP do alvo (revelam as perícias dele).
  const tiro = arma.alcance === 'distancia' && !sel.area;
  const defesas = mestre && b?.atributos
    ? (tiro ? [`dificuldade do tiro ${defesaDoAlvo(b, arma, sis, { cobertura: sel.cobertura }).total}`]
      : opcoesDefesa(b, arma, sis, { area: sel.area }).filter(o => o.id !== 'nenhuma')
        .map(o => `${o.nome} ${defesaDoAlvo(b, arma, sis, { escolha: o.id, cobertura: sel.cobertura, area: sel.area }).total}`))
    : null;
  const pericia = arma.pericia || 'briga.ataque-desarmado';
  return h('details', { class: 'ataque', open: estado.sel.ataqueAberto ?? true, ontoggle: e => { estado.sel.ataqueAberto = e.target.open; } },
    h('summary', {}, icone('crosshair'), 'Atacar'),
    h('div', { class: 'barra' },
      selecao(opcoesPersonagens(meus), sel.atacante, v => { sel.atacante = v; render(); }, { 'aria-label': 'Atacante' }),
      h('span', {}, '→'),
      alvos.length ? selecao(opcoesPersonagens(alvos), sel.alvo, v => { sel.alvo = v; render(); }, { 'aria-label': 'Alvo' }) : h('em', {}, 'sem alvos'),
      selecao(armas.map(x => ({ valor: x.uid, rotulo: `${x.nome} (${x.dano}${x.alcance === 'distancia' ? ', distância' : ''})` })), sel.arma, v => { sel.arma = v; render(); }, { 'aria-label': 'Arma' })),
    h('p', { class: 'dica' }, `Ataque: ${pericia.split('.').pop().replace(/-/g, ' ')} ${d.subpericias[pericia] ?? 0}%`,
      arma.alcance === 'corpo' && d.mod.FOR ? ` · dano + MOD FOR ${d.mod.FOR}` : '',
      ` · efeito ${arma.tipoDano} se DS ≤ ${arma.efeitoDano}`,
      tiro ? ' · tiro: sem defesa, dificuldade 50 + 5 × nível do alvo' : ' · o alvo escolhe a defesa',
      defesas ? ` (${defesas.length ? defesas.join(', ') : 'sem defesa possível'} · IP ${ipDe(b, sis)})` : ''),
    h('div', { class: 'barra opcoes-ataque' },
      caixa(sel, 'localizado', 'Localizado (−30%, +1d6)'),
      caixa(sel, 'surpresa', 'Surpresa'),
      caixa(sel, 'elevado', 'Terreno elevado'),
      h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: !!sel.area, onchange: e => { sel.area = e.target.checked; render(); } }), 'Ataque em área'),
      arma.alcance === 'distancia' ? caixa(sel, 'cobertura', 'Alvo em cobertura (+30)') : null,
      a.tipo === 'pj' ? caixa(sel, 'sacrificio', 'Sacrifício (+10%, D6 de vida no dano)') : null,
      selecao([{ valor: '', rotulo: 'Uma arma' }, { valor: 'principal', rotulo: 'Duas armas: mão principal (−20%)' }, { valor: 'inabil', rotulo: 'Duas armas: mão inábil (−40%)' }],
        sel.duasArmas, v => { sel.duasArmas = v; }, { 'aria-label': 'Duas armas' })),
    mestre ? h('div', { class: 'barra opcoes-ataque' },
      caixa(sel, 'vantagem', 'Vantagem'), caixa(sel, 'desvantagem', 'Desvantagem'),
      h('label', { class: 'linha' }, 'Mod. %', h('input', { type: 'number', class: 'curto', value: sel.mod || 0, onchange: e => { sel.mod = e.target.value; } })),
      h('label', { class: 'linha' }, 'Dano livre', h('input', { class: 'curto', placeholder: 'ex.: 1d6+1', value: sel.danoLivre || '', onchange: e => { sel.danoLivre = e.target.value.trim(); } }))) : null,
    botao('Atacar', async () => {
      if (!sel.alvo) throw new Error('Escolha o alvo.');
      const r = await acao('combate.atacar', {
        atacante: sel.atacante, alvo: sel.alvo,
        opcoes: { armaUid: sel.arma, localizado: sel.localizado, surpresa: sel.surpresa, elevado: sel.elevado, cobertura: sel.cobertura, area: sel.area, sacrificio: sel.sacrificio,
          duasArmas: sel.duasArmas || null, vantagem: sel.vantagem, desvantagem: sel.desvantagem, mod: sel.mod, danoLivre: sel.danoLivre || null },
      });
      sel.sacrificio = false;
      if (r.tipo === 'ataque') aviso(`${r.autor} ${r.rotulo}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
      else aviso('Ataque declarado: aguardando a defesa do alvo.');
    }, { class: 'primario', icone: 'swords', disabled: !alvos.length }));
}

// ---------- Sala Social ----------

const humores = () => estado.sistema.social?.humores || [];
const nomeHumor = id => humores().find(x => x.id === (id || 'neutro'))?.nome || 'Neutro';

// Selo do humor no cartão do participante; quem controla o personagem pode trocar.
export function humorCartao(p, controla, mestre) {
  if (!estado.sistema.modulos?.social) return null;
  const atual = p.humor || 'neutro';
  const h0 = humores().find(x => x.id === atual);
  const permitidos = humores().filter(x => mestre || x.escolha || x.id === atual || (p.humorOpcoes || []).includes(x.id));
  return h('div', { class: 'humor' },
    controla
      ? h('label', { class: 'linha' }, icone('smile'), selecao(permitidos.map(x => ({ valor: x.id, rotulo: (p.humorOpcoes || []).includes(x.id) ? `${x.nome} (pode escolher)` : x.nome })), atual,
        v => acao('humor.definir', { id: p.id, humor: v }).catch(e => aviso(e.message, 'erro')), { 'aria-label': `Humor de ${p.nome}` }))
      : h('span', { class: 'selo' }, icone('smile'), nomeHumor(atual)),
    h0 && h0.id !== 'neutro' ? h('small', { class: 'dica' }, ` ${h0.efeitos}`) : null);
}

export function rodaDoHumor() {
  const sis = estado.sistema;
  if (!sis.modulos?.social) {
    return h('p', { class: 'dica' }, icone('info'), ` As regras sociais automáticas ainda não existem no ${sis.nome}: use os testes abaixo. A Roda do Humor liga sozinha quando a campanha está no MSS.`);
  }
  return h('details', { class: 'bloco', open: !!estado.sel.rodaAberta, ontoggle: e => { estado.sel.rodaAberta = e.target.open; } },
    h('summary', {}, icone('drama'), 'Roda do Humor'),
    h('p', { class: 'dica' }, 'Antes de interagir com quem não é aliado, cada um escolhe Amigável, Indisposto ou Neutro. Resistir a um humor imposto deixa o personagem Apático (−1D6 de Humanidade). Os demais humores vêm de manipulação ou do mestre.'),
    h('ul', { class: 'lista-humores' }, humores().map(x => {
      const causas = Object.entries(sis.social.manipulacoes).filter(([, r]) => r.causa.includes(x.id)).map(([id]) => nomeSub(id));
      return h('li', {}, h('strong', {}, x.nome), ` — ${x.efeitos}`, causas.length ? h('small', {}, ` Causado por: ${causas.join(', ')}.`) : null);
    })));
}

function nomeSub(id) {
  const per = estado.sistema.pericias.find(x => x.id === 'manipulacao');
  return per?.subpericias.find(s => s.id === id)?.nome || id;
}

export function manipulacaoView(participantes, mestre) {
  const sis = estado.sistema;
  if (!sis.modulos?.social) return null;
  const meus = participantes.filter(p => meuOuMestre(p, mestre) && p.atributos);
  if (!meus.length) return null;
  const sel = estado.sel.manipular ||= { autor: '', alvo: '', sub: 'manipulacao.labia', humor: '' };
  if (!meus.some(p => p.id === sel.autor)) sel.autor = meus[0].id;
  const a = personagemPorId(sel.autor);
  const alvos = participantes.filter(p => p.id !== a.id);
  if (!alvos.some(p => p.id === sel.alvo)) sel.alvo = alvos[0]?.id || '';
  const regras = sis.social.manipulacoes;
  const regra = regras[sel.sub];
  if (!regra.causa.includes(sel.humor)) sel.humor = regra.causa[0];
  const d = derivados(a, sis);
  const b = personagemPorId(sel.alvo);
  const rmnp = mestre && b?.atributos ? resistenciaManipulacao(b, sis) : null;
  return h('div', { class: 'bloco' },
    titulo('Manipulação', 'drama'),
    h('div', { class: 'barra' },
      selecao(opcoesPersonagens(meus), sel.autor, v => { sel.autor = v; render(); }, { 'aria-label': 'Quem manipula' }),
      h('span', {}, '→'),
      alvos.length ? selecao(opcoesPersonagens(alvos), sel.alvo, v => { sel.alvo = v; render(); }, { 'aria-label': 'Alvo da manipulação' }) : h('em', {}, 'sem alvos'),
      selecao(Object.keys(regras).map(id => ({ valor: id, rotulo: `${nomeSub(id)} (${d.subpericias[id] ?? 0}%)` })), sel.sub, v => { sel.sub = v; render(); }, { 'aria-label': 'Subperícia' }),
      selecao(regra.causa.map(id => ({ valor: id, rotulo: `para ${nomeHumor(id)}` })), sel.humor, v => { sel.humor = v; }, { 'aria-label': 'Humor desejado' }),
      mestre ? h('label', { class: 'linha' }, 'Mod. %', h('input', { type: 'number', class: 'curto', value: sel.mod || 0, onchange: e => { sel.mod = e.target.value; } })) : null,
      botao('Manipular', async () => {
        if (!sel.alvo) throw new Error('Escolha o alvo.');
        const r = await acao('social.manipular', { autor: sel.autor, alvo: sel.alvo, sub: sel.sub, humor: sel.humor, mod: sel.mod });
        aviso(`${r.autor}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
      }, { class: 'primario', icone: 'drama', disabled: !alvos.length })),
    h('p', { class: 'dica' }, `Teste contra a Resistência à Manipulação do alvo (perícia Manipulação + 50 + modificadores)${rmnp != null ? ` — R.MNP de ${b.nome}: ${rmnp}` : ''}.`,
      regra.falha.length ? ` Se falhar, o alvo pode escolher ficar ${regra.falha.map(nomeHumor).join(' ou ')}.` : ''));
}

// Campos que só o mestre ajusta no cartão do participante: IP de habilidades (batalha) e modificador de R.MNP (social).
export function ajustesMestre(p, nome) {
  const sis = estado.sistema;
  const ligado = nome === 'batalha' ? sis.modulos?.combate : sis.modulos?.social;
  if (!ligado || !p.atributos) return null;
  const chave = nome === 'batalha' ? 'ipExtra' : 'rmnpExtra';
  const total = nome === 'batalha' ? `IP total ${ipDe(p, sis)}` : `R.MNP ${resistenciaManipulacao(p, sis)}`;
  return h('label', { class: 'linha ajuste' }, nome === 'batalha' ? 'IP de habilidades' : 'Mod. R.MNP',
    h('input', { type: 'number', class: 'curto', value: p[chave] || 0, 'aria-label': `${nome === 'batalha' ? 'IP de habilidades' : 'Modificador de R.MNP'} de ${p.nome}`,
      onchange: e => acao('combate.ip', { id: p.id, [chave]: e.target.value }) }),
    h('small', {}, total));
}
