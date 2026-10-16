// Campo de Batalha: controle de turno (qualquer sistema) e combate automático; Sala Social: Roda do Humor.
// O ataque automático e a Roda do Humor só ligam nos sistemas com esses módulos (hoje, o MSS).
import { h, botao, selecao, aviso, icone, titulo, confirmar, pedirTexto } from '../ui.js';
import { estado, personagemPorId, render } from '../estado.js';
import { acao } from '../api.js';
import { derivados } from '/shared/regras.js';
import { armasDisponiveis, opcoesDefesa, defesaDoAlvo, ipDe, resistenciaManipulacao } from '/shared/combate.js';
import { prepararTeste } from './dados.js';

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
      h('p', { class: 'dica' }, `Com dois ou mais no campo, o combate começa sozinho: iniciativa = AGI + 1d10${auto ? ' (Corajoso, Amedrontado e Enojado rolam com vantagem)' : ''}, do maior para o menor.`),
      mestre ? botao('Iniciar combate', () => acao('combate.iniciar'), { class: 'primario', icone: 'play', disabled: participantes.length < 2 }) : null),
    cb ? painelVez(cb, mestre) : null,
    auto ? pendentesView(mestre) : null,
    mestre ? xpDaSala(participantes) : null);
}

// Quem está na vez: atalhos para o dono (ou o mestre) agir sem procurar na tela.
export function painelVez(cb, mestre) {
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
    botao('Rolar teste', () => prepararTeste(p.id, ''), { class: 'pequeno', icone: 'dices' }),
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
export function pendentesView(mestre) {
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

export function ordemView(cb, mestre) {
  const atual = personagemPorId(cb.ordem[cb.vez]?.id);
  const podePassar = mestre || atual?.donoId === estado.usuario.id;
  return h('div', {},
    h('div', { class: 'barra' },
      h('span', { class: 'selo cheio' }, `Rodada ${cb.rodada} · Turno ${cb.turno || 1}`),
      h('strong', {}, atual ? `Vez de ${atual.nome}` : ''),
      h('span', { class: 'espaco' }),
      podePassar ? botao('Próximo turno', () => acao('combate.proximo'), { class: 'primario', icone: 'skip-forward' }) : null,
      mestre ? botao('Encerrar', () => acao('combate.encerrar'), { class: 'perigo', icone: 'square-x' }) : null),
    // A ordem aparece na barra de avatares; aqui fica só para o mestre mexer (subir, descer, mudar a iniciativa).
    !mestre ? null : h('ol', { class: 'ordem-iniciativa' }, cb.ordem.map((o, i) => {
      const p = personagemPorId(o.id);
      return h('li', { class: i === cb.vez ? 'vez' : '' },
        mestre ? h('button', { type: 'button', class: 'ini', title: `Mudar a iniciativa de ${p?.nome}`, 'aria-label': `Iniciativa de ${p?.nome}: ${o.ini}. Mudar`,
          onclick: async () => { const v = await pedirTexto(`Iniciativa de ${p?.nome}`, 'Novo valor', String(o.ini)); if (v != null) acao('combate.iniciativa', { id: o.id, ini: v }); } }, o.ini)
          : h('span', { class: 'ini' }, o.ini), ' ', p?.nome || '?',
        mestre ? botao('', () => acao('combate.ordenar', { id: o.id, direcao: -1 }), { class: 'pequeno', icone: 'chevron-up', disabled: i === 0, title: `Adiantar ${p?.nome}` }) : null,
        mestre ? botao('', () => acao('combate.ordenar', { id: o.id, direcao: 1 }), { class: 'pequeno', icone: 'chevron-down', disabled: i === cb.ordem.length - 1, title: `Atrasar ${p?.nome}` }) : null);
    })));
}

// ---------- Sala Social ----------

export const humores = () => estado.sistema.social?.humores || [];
// Texto do rebote por espectro (A Aliado/Amigável, B Desconhecido, C Rival/Inimigo).
export const reboteTexto = regra => Object.entries(regra.falha || {}).map(([k, l]) => `${k}: ${l.length ? l.map(id => nomeHumorLer(id)).join(' ou ') : 'sem efeito'}`).join(' · ');
const nomeHumorLer = id => (id === 'ler' ? 'ler o humor real' : nomeHumor(id));
export const nomeHumor = id => humores().find(x => x.id === (id || 'neutro'))?.nome || 'Neutro';

// Selo do humor no cartão do participante; quem controla o personagem pode trocar.
// Humor no cartão. Quem controla vê e muda as duas camadas: o humor real (dá os efeitos) e a máscara (o que a sala vê).
// Os outros veem só o humor aparente.
export function humorCartao(p, controla, mestre) {
  if (!estado.sistema.modulos?.social) return null;
  const real = p.humor || 'neutro';
  if (!controla) return h('div', { class: 'humor' }, h('span', { class: 'selo' }, icone('smile'), nomeHumor(real)));
  const hReal = humores().find(x => x.id === real);
  const permitidos = humores().filter(x => mestre || x.escolha || x.id === real);
  const mudarReal = async v => {
    if (!mestre && p.humorImposto && v !== real && !(await confirmar(`${nomeHumor(real)} foi imposto. Agir contra ele (dissonância) custa ${estado.sistema.social?.dissonancia?.dano || '1d6'} de Sanidade. Mudar mesmo assim?`))) return render();
    acao('humor.definir', { id: p.id, humor: v }).catch(e => aviso(e.message, 'erro'));
  };
  const rebote = p.humorOpcoes || [];
  return h('div', { class: 'humor' },
    rebote.length ? h('div', { class: 'rebote' }, h('strong', {}, icone('circle-alert'), ' Rebote: escolha o humor de ', p.nome, ' '),
      rebote.map(id => botao(nomeHumor(id), () => acao('humor.definir', { id: p.id, humor: id }), { class: 'pequeno primario', title: `${p.nome} fica ${nomeHumor(id)}` }))) : null,
    h('label', { class: 'linha' }, icone('smile'), h('small', {}, 'Humor real'),
      selecao(permitidos.map(x => ({ valor: x.id, rotulo: x.nome })), real, mudarReal, { 'aria-label': `Humor real de ${p.nome}` })),
    h('label', { class: 'linha' }, icone('drama'), h('small', {}, 'Humor aparente'),
      selecao([{ valor: '', rotulo: 'sem máscara' }, ...humores().filter(x => x.id !== real).map(x => ({ valor: x.id, rotulo: x.nome }))], p.humorAparente || '',
        v => acao('humor.definir', { id: p.id, humor: v || null, camada: 'aparente' }).catch(e => aviso(e.message, 'erro')), { 'aria-label': `Máscara (humor aparente) de ${p.nome}` })),
    p.humorImposto ? h('span', { class: 'selo perigo', title: 'Mudar o humor real agora causa dano de Sanidade (dissonância)' }, 'imposto') : null,
    p.humorAparente ? h('small', { class: 'dica' }, ` A sala vê ${nomeHumor(p.humorAparente)}.`) : null,
    hReal && hReal.id !== 'neutro' ? h('small', { class: 'dica' }, ` ${hReal.efeitos}`) : null);
}

export function rodaDoHumor() {
  const sis = estado.sistema;
  if (!sis.modulos?.social) {
    return h('p', { class: 'dica' }, icone('info'), ` As regras sociais automáticas ainda não existem no ${sis.nome}: use os testes abaixo. A Roda do Humor liga sozinha quando a campanha está no MSS.`);
  }
  return h('details', { class: 'bloco', open: !!estado.sel.rodaAberta, ontoggle: e => { estado.sel.rodaAberta = e.target.open; } },
    h('summary', {}, icone('drama'), 'Roda do Humor'),
    h('ul', { class: 'dica lista-humores' },
      h('li', {}, 'Cada um escolhe Neutro, Amigável, Indisposto ou Apático. Os demais humores vêm de manipulação ou do mestre.'),
      h('li', {}, h('strong', {}, 'Máscara: '), 'o humor real (oculto) dá os efeitos; a máscara é o que a sala vê. Empatia → "ler o humor real" revela a máscara só para quem testou.'),
      h('li', {}, h('strong', {}, 'Rebote: '), 'falhar na manipulação joga o alvo num humor reativo, conforme o relacionamento (A Aliado/Amigável · B Desconhecido · C Rival/Inimigo, pelo mapa de relacionamento).'),
      h('li', {}, h('strong', {}, 'Dissonância: '), `agir contra um humor imposto custa ${sis.social.dissonancia?.dano || '1d6'} de Sanidade.`),
      h('li', {}, h('strong', {}, 'Agressão súbita: '), `atacar um humano no meio do diálogo custa ${sis.social.agressao?.dano || '1d6'} de Humanidade.`)),
    h('ul', { class: 'lista-humores' }, humores().map(x => {
      const causas = Object.entries(sis.social.manipulacoes).filter(([, r]) => r.causa.includes(x.id)).map(([id]) => nomeSub(id));
      return h('li', {}, h('strong', {}, x.nome), ` — ${x.efeitos}`, causas.length ? h('small', {}, ` Causado por: ${causas.join(', ')}.`) : null);
    })));
}

export function nomeSub(id) {
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
  return h('details', { class: 'bloco', open: !!estado.sel.manipAberta, ontoggle: e => { estado.sel.manipAberta = e.target.open; } },
    h('summary', {}, icone('drama'), 'Manipulação detalhada (ou use o botão "Manipular" no cartão de cada personagem)'),
    h('div', { class: 'barra' },
      selecao(opcoesPersonagens(meus), sel.autor, v => { sel.autor = v; render(); }, { 'aria-label': 'Quem manipula' }),
      h('span', {}, '→'),
      alvos.length ? selecao(opcoesPersonagens(alvos), sel.alvo, v => { sel.alvo = v; render(); }, { 'aria-label': 'Alvo da manipulação' }) : h('em', {}, 'sem alvos'),
      selecao(Object.keys(regras).map(id => ({ valor: id, rotulo: `${nomeSub(id)} (${d.subpericias[id] ?? 0}%)` })), sel.sub, v => { sel.sub = v; render(); }, { 'aria-label': 'Subperícia' }),
      selecao(regra.causa.map(id => ({ valor: id, rotulo: id === 'ler' ? 'ler o humor real' : `para ${nomeHumor(id)}` })), sel.humor, v => { sel.humor = v; }, { 'aria-label': 'Humor desejado' }),
      mestre ? h('label', { class: 'linha' }, 'Mod. %', h('input', { type: 'number', class: 'curto', value: sel.mod || 0, onchange: e => { sel.mod = e.target.value; } })) : null,
      botao('Manipular', async () => {
        if (!sel.alvo) throw new Error('Escolha o alvo.');
        const r = await acao('social.manipular', { autor: sel.autor, alvo: sel.alvo, sub: sel.sub, humor: sel.humor, mod: sel.mod });
        aviso(r.revelado || `${r.autor}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
      }, { class: 'primario', icone: 'drama', disabled: !alvos.length })),
    h('p', { class: 'dica' }, `Teste contra a Resistência à Manipulação do alvo (perícia Manipulação + 50 + modificadores)${rmnp != null ? ` — R.MNP de ${b.nome}: ${rmnp}` : ''}.`,
      ` Se falhar: ${reboteTexto(regra)}.`));
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

// ---------- Ações no cartão de cada personagem ----------
// Cada personagem que você controla tem, no próprio cartão, quem ele ataca/manipula e o botão da ação.
// Clicar no cartão de outro personagem marca esse personagem como alvo de todos os seus.

export const alvoMarcado = sala => estado.sel[`alvo:${sala}`] || null;

export function marcarAlvo(sala, id) {
  estado.sel[`alvo:${sala}`] = alvoMarcado(sala) === id ? null : id;
  // O clique vale para todos os cartões: apaga as escolhas feitas em cada um.
  for (const k of Object.keys(estado.sel)) if (k.startsWith(`alvoDe:${sala}:`)) delete estado.sel[k];
  render();
}

export function alvoDe(p, sala, participantes) {
  const outros = participantes.filter(x => x.id !== p.id);
  const valido = id => id && outros.some(x => x.id === id);
  const proprio = estado.sel[`alvoDe:${sala}:${p.id}`];
  if (valido(proprio)) return proprio;
  const marcado = alvoMarcado(sala);
  if (valido(marcado)) return marcado;
  // Sem alvo marcado: o primeiro que não é do mesmo lado (PJ × NPC), senão o primeiro da sala.
  return (outros.find(x => x.tipo !== p.tipo) || outros[0])?.id || '';
}

// Opções do formulário "Opções do ataque" (surpresa, localizado…) valem para os botões dos cartões.
export function opcoesGerais(p, mestre) {
  const sel = estado.sel.ataque || {};
  const op = { localizado: sel.localizado, surpresa: sel.surpresa, elevado: sel.elevado, cobertura: sel.cobertura, area: sel.area, duasArmas: sel.duasArmas || null };
  if (p.tipo === 'pj') op.sacrificio = sel.sacrificio;
  if (mestre) Object.assign(op, { vantagem: sel.vantagem, desvantagem: sel.desvantagem, mod: sel.mod, danoLivre: sel.danoLivre || null });
  return op;
}

export function acoesCartaoBatalha(p, participantes, mestre) {
  const sis = estado.sistema;
  if (!sis.modulos?.combate || !meuOuMestre(p, mestre) || !p.atributos) return null;
  const outros = participantes.filter(x => x.id !== p.id);
  if (!outros.length) return null;
  const alvo = alvoDe(p, 'batalha', participantes);
  const armas = armasDisponiveis(p, sis);
  const chaveArma = `armaDe:${p.id}`;
  if (!armas.some(x => x.uid === estado.sel[chaveArma])) estado.sel[chaveArma] = (armas.find(x => x.uid !== 'desarmado') || armas[0]).uid;
  const item = (p.itens || []).find(i => i.uid === estado.sel[chaveArma]);
  return h('div', { class: 'acao-cartao' },
    icone('crosshair'),
    selecao(opcoesPersonagens(outros), alvo, v => { estado.sel[`alvoDe:batalha:${p.id}`] = v; render(); }, { 'aria-label': `Alvo de ${p.nome}` }),
    selecao(armas.map(x => {
      const it = (p.itens || []).find(i => i.uid === x.uid);
      return { valor: x.uid, rotulo: `${x.nome} (${x.dano}${it?.capacidade ? ` · ${it.carregada || 0}/${it.capacidade}` : ''})` };
    }), estado.sel[chaveArma], v => { estado.sel[chaveArma] = v; render(); }, { 'aria-label': `Arma de ${p.nome}` }),
    botao('Atacar', async () => {
      const r = await acao('combate.atacar', { atacante: p.id, alvo, opcoes: { ...opcoesGerais(p, mestre), armaUid: estado.sel[chaveArma] } });
      if (estado.sel.ataque) estado.sel.ataque.sacrificio = false;
      if (r.tipo === 'ataque') aviso(`${r.autor} ${r.rotulo}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
      else aviso(`${p.nome} ataca: aguardando a defesa.`);
    }, { class: 'pequeno primario', icone: 'swords', title: `${p.nome} ataca`, disabled: item?.capacidade && (item.carregada || 0) <= 0 }));
}

export function acoesCartaoSocial(p, participantes, mestre) {
  const sis = estado.sistema;
  if (!sis.modulos?.social || !meuOuMestre(p, mestre) || !p.atributos) return null;
  const outros = participantes.filter(x => x.id !== p.id);
  if (!outros.length) return null;
  const alvo = alvoDe(p, 'social', participantes);
  const regras = sis.social.manipulacoes;
  const d = derivados(p, sis);
  const chaveSub = `subDe:${p.id}`;
  if (!regras[estado.sel[chaveSub]]) estado.sel[chaveSub] = 'manipulacao.labia';
  const regra = regras[estado.sel[chaveSub]];
  const chaveHumor = `humorDe:${p.id}`;
  if (!regra.causa.includes(estado.sel[chaveHumor])) estado.sel[chaveHumor] = regra.causa[0];
  return h('div', { class: 'acao-cartao' },
    icone('drama'),
    selecao(opcoesPersonagens(outros), alvo, v => { estado.sel[`alvoDe:social:${p.id}`] = v; render(); }, { 'aria-label': `Alvo de ${p.nome}` }),
    selecao(Object.keys(regras).map(id => ({ valor: id, rotulo: `${nomeSub(id)} ${d.subpericias[id] ?? 0}%` })), estado.sel[chaveSub], v => { estado.sel[chaveSub] = v; render(); }, { 'aria-label': `Subperícia de ${p.nome}` }),
    selecao(regra.causa.map(id => ({ valor: id, rotulo: id === 'ler' ? '→ ler o humor real' : `→ ${nomeHumor(id)}` })), estado.sel[chaveHumor], v => { estado.sel[chaveHumor] = v; }, { 'aria-label': `Humor que ${p.nome} quer causar` }),
    botao('Manipular', async () => {
      const r = await acao('social.manipular', { autor: p.id, alvo, sub: estado.sel[chaveSub], humor: estado.sel[chaveHumor], mod: mestre ? estado.sel.manipular?.mod : 0 });
      aviso(r.revelado || `${r.autor}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
    }, { class: 'pequeno primario', icone: 'drama', title: `${p.nome} manipula` }),
    // Da conversa para a briga: leva os dois ao Campo de Batalha; atacar um humano no meio do diálogo custa Humanidade.
    botao('Agredir', async () => {
      const b = personagemPorId(alvo);
      const custo = estado.sistema.social?.agressao?.dano || '1d6';
      if (!(await confirmar(`${p.nome} parte para a agressão contra ${b?.nome}? Atacar um humano no meio do diálogo custa ${custo} de Humanidade. Os dois vão para o Campo de Batalha.`))) return;
      const r = await acao('social.agredir', { atacante: p.id, alvo });
      aviso(r.texto || `${p.nome} e ${b?.nome} foram para o Campo de Batalha.`, 'erro');
    }, { class: 'pequeno perigo', icone: 'swords', title: `${p.nome} parte para a agressão` }));
}
