// Campo de Combate (esboço do autor): no alto, o painel do personagem que você controla, em três quadros —
// Personagem (PV, SAN, HUM, mãos, defesas, IP, efeitos) · Habilidades e vantagens (ativar/desativar) · Ataques.
// Embaixo ficam o turno, os participantes (o campo) e o registro.
import { h, botao, selecao, aviso, icone, titulo, vazio, pedirTexto } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados, listaHabilidades, efeitosHabilidade, GRUPOS_IP } from '/shared/regras.js';
import { armasDisponiveis, ipDe, opcoesDefesa, defesaDoAlvo } from '/shared/combate.js';
import { trilhaCompacta, escolherCondicao, cargaView } from './ficha.js';
import { painelSlot, naMao, maoHabil } from './boneco.js';
import { efeitosIcones } from './efeitos.js';
import { prepararTeste } from './dados.js';
import { distanciaNoMapa } from './mapa.js';
import { alvoDe, opcoesGerais, marcarAlvo } from './combate.js';

const meuOuMestre = (p, mestre) => mestre || p.donoId === estado.usuario.id;

// Personagem que você está controlando nesta sala. O mestre acompanha quem está na vez.
export function controladoNaSala(nome, participantes, mestre) {
  const meus = participantes.filter(p => meuOuMestre(p, mestre) && p.atributos);
  const chave = `eu:${nome}`;
  const cb = nome === 'batalha' ? estado.campanha.salas.batalha.combate : null;
  const daVez = cb && meus.find(p => p.id === cb.ordem[cb.vez]?.id);
  const vezAgora = cb ? `${cb.rodada}:${cb.vez}` : null;
  if (daVez && estado.sel[`${chave}:vez`] !== vezAgora) estado.sel[chave] = daVez.id;
  estado.sel[`${chave}:vez`] = vezAgora;
  // Ataque novo esperando a defesa de um dos seus: o painel vai para ele.
  if (nome === 'batalha') {
    const pend = (estado.campanha.salas.batalha.pendentes || []).find(x => meus.some(p => p.id === x.alvo));
    if (pend && estado.sel[`${chave}:pend`] !== pend.id) estado.sel[chave] = pend.alvo;
    estado.sel[`${chave}:pend`] = pend?.id || null;
  }
  if (!meus.some(p => p.id === estado.sel[chave])) estado.sel[chave] = (daVez || meus.find(p => p.tipo === 'pj') || meus[0])?.id || null;
  return { meus, p: meus.find(x => x.id === estado.sel[chave]) || null, chave };
}

// Nome do personagem; com mais de um sob seu controle, vira uma escolha.
export function nomeControlado(meus, p, chave) {
  if (meus.length < 2) return h('h3', { class: 'nome-controlado' }, p.nome);
  return selecao(meus.map(x => ({ valor: x.id, rotulo: x.nome })), p.id, v => { estado.sel[chave] = v; render(); },
    { 'aria-label': 'Personagem que você controla', class: 'nome-controlado' });
}

export function painelBatalha(participantes, mestre) {
  const { meus, p, chave } = controladoNaSala('batalha', participantes, mestre);
  if (!p) return null;
  return h('div', { class: 'batalha-topo' },
    h('section', { class: 'bloco bat-personagem', 'data-pid': p.id }, quadroPersonagem(p, meus, chave, mestre, participantes)),
    h('section', { class: 'bloco bat-habilidades' }, titulo('Habilidades, características e vantagens', 'sparkles'), quadroHabilidades(p, mestre)),
    h('section', { class: 'bloco bat-ataques' }, titulo('Ataques', 'swords'), quadroAtaques(p, participantes, mestre)));
}

// ---------- Personagem ----------

function quadroPersonagem(p, meus, chave, mestre, participantes) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  const sub = id => d.subpericias[id] ?? 0;
  const base = sis.combate?.defesaPassiva ?? sis.teste.passiva?.soma ?? 50;
  const distBase = sis.combate?.distancia?.base ?? 50;
  const porNivel = sis.combate?.distancia?.porNivel ?? 5;
  const nivel = p.nivel || 1;
  const maos = (p.itens || []).filter(i => i.equipado && i.slot === 'maos');
  const abertoMao = estado.sel[`boneco:${p.id}`];
  const brancaEmpunhada = maos.filter(i => i.pericia?.startsWith('arma-branca.') && !(sis.combate?.semDefesaArmada || []).includes(i.pericia))
    .sort((a, b) => sub(b.pericia) - sub(a.pericia))[0];
  const mao = (n, rotulo) => {
    const it = naMao(p, n);
    const id = `maos:${n}`;
    const habil = maoHabil(p) === n;
    return h('div', { class: `mao ${habil ? 'habil' : ''}` },
      h('small', {}, rotulo, habil ? h('span', { class: 'selo ok' }, 'hábil') : null),
      h('span', { class: 'mao-item', title: it?.nome || 'vazia' }, it ? [icone(it.tipo === 'arma' ? 'sword' : 'hand'), ` ${it.nome}`, (it.ocupa ?? 1) >= 2 ? h('small', {}, ' (2 mãos)') : null] : '—'),
      botao(abertoMao === id ? 'Fechar' : 'Equipar', () => { estado.sel[`boneco:${p.id}`] = abertoMao === id ? null : id; render(); },
        { class: 'pequeno', icone: 'shirt', title: `${rotulo}: equipar ou trocar`, 'aria-expanded': abertoMao === id }));
  };
  // Ataque esperando a defesa deste personagem: as defesas viram botões — clicar numa delas é defender.
  const pend = sis.modulos?.combate ? (estado.campanha.salas.batalha.pendentes || []).find(x => x.alvo === p.id) : null;
  const armaPend = pend ? { uid: pend.opcoes.armaUid || 'desarmado', alcance: pend.alcance } : null;
  const opcoes = pend ? opcoesDefesa(p, armaPend, sis, { area: pend.area }) : [];
  const defender = async id => {
    const r = await acao('combate.defender', { id: pend.id, defesa: id });
    aviso(`${r.autor} ${r.rotulo}: ${r.texto}`, r.sucesso ? 'erro' : 'ok');
  };
  const defesa = (rot, valor, titulo, idDefesa = null) => {
    const op = pend && idDefesa ? opcoes.find(o => (idDefesa === 'armada' ? o.id.startsWith('armada:') : o.id === idDefesa)) : null;
    if (op) {
      const total = defesaDoAlvo(p, armaPend, sis, { escolha: op.id, cobertura: pend.opcoes.cobertura, area: pend.area }).total;
      return h('button', { type: 'button', class: 'defesa escolher', title: op.nota || `Defender com ${op.nome}`, onclick: () => defender(op.id) },
        h('small', {}, rot), h('strong', {}, total));
    }
    return h('div', { class: `defesa ${pend && idDefesa ? 'indisponivel' : ''}`, title: pend && idDefesa ? 'Não vale contra este ataque' : titulo }, h('small', {}, rot), h('strong', {}, valor == null ? '—' : valor));
  };
  const atacante = pend ? personagemPorId(pend.atacante) : null;
  return [
    h('div', { class: 'barra' }, icone('user'), nomeControlado(meus, p, chave)),
    humorCombate(p),
    trilhaCompacta(p, 'pv', 'PV', 'heart'),
    p.sanidade ? trilhaCompacta(p, 'sanidade', 'SAN', 'brain') : null,
    p.humanidade ? trilhaCompacta(p, 'humanidade', 'HUM', 'hand-heart') : null,
    h('div', { class: 'maos' }, mao(1, 'Mão esq.'), mao(0, 'Mão dir.')),
    abertoMao?.startsWith('maos') ? painelSlot(p, abertoMao, mestre) : null,
    h('h4', {}, icone('shield'), ' Defesas'),
    pend ? h('div', { class: 'aviso-defesa', role: 'alert' }, icone('circle-alert'),
      ` ${atacante?.nome || 'Alguém'} ataca ${p.nome} com ${pend.arma}${pend.alcance === 'distancia' ? ' (a distância)' : ''}. Clique na defesa:`) : null,
    h('div', { class: `defesas ${pend ? 'escolhendo' : ''}` },
      defesa('Esquiva', sub('briga.esquiva') + base, 'Esquiva + 50: contra Briga e Armas Brancas', 'esquiva'),
      defesa('Armada', brancaEmpunhada ? sub(brancaEmpunhada.pericia) + base : null, brancaEmpunhada ? `Defesa armada com ${brancaEmpunhada.nome}` : 'Empunhe uma arma branca para defender com ela', 'armada'),
      defesa('Evasão', sub('briga.evasao') + base, 'Evasão + 50: só contra ataque em área', 'evasao'),
      defesa('Desarmada', sub('briga.defesa-desarmada') + base, 'Defesa desarmada + 50: só contra Briga', 'defesa-desarmada'),
      // Contra tiro não há defesa: a dificuldade é 50 + 5 × nível. Pego de surpresa: só a base (50) no físico, só nível × 5 no tiro.
      defesa('À dist.', distBase + porNivel * nivel, `Ataques a distância contra ${p.nome}: ${distBase} + ${porNivel} × nível ${nivel}`),
      defesa('Surpresa', [String(base), h('small', { class: 'sub-def' }, ` / ${porNivel * nivel}`)], `Pego de surpresa: ${base} contra ataque físico (só a base da Esquiva) e ${porNivel * nivel} contra tiro (só nível × ${porNivel})`),
      pend ? h('button', { type: 'button', class: 'defesa escolher sem', title: 'Não defender (ex.: pego de surpresa, ou tiro)', onclick: () => defender('nenhuma') },
        h('small', {}, opcoes.length === 1 ? 'Tiro' : 'Sem defesa'), h('strong', {}, icone('x'))) : null),
    resumoAcao(p, maos, participantes),
    h('h4', {}, icone('shield-alert'), ' IP (proteção)'),
    ipView(d.ip),
    cargaView(d),
    h('h4', {}, icone('activity'), ' Efeitos'),
    h('div', { class: 'barra' }, efeitosIcones(p, { mestre }) || h('small', { class: 'dica' }, 'Nenhum.'),
      botao('Marcador', () => escolherCondicao(p), { class: 'pequeno', icone: 'tag', title: 'Escolher uma condição' })),
  ];
}

// Linha "Personagem | Arma | Distância" do esboço: quem age, o que empunha e a distância até o alvo (em branco por enquanto).
function resumoAcao(p, maos, participantes) {
  const arma = maos.find(i => i.tipo === 'arma');
  const alvo = participantes ? personagemPorId(alvoDe(p, 'batalha', participantes)) : null;
  // Distância vem do Mapa: quadrados entre os dois peões (diagonal conta 1) × 1,5 m.
  const dist = alvo ? distanciaNoMapa(estado.campanha, p.id, alvo.id) : null;
  return h('div', { class: 'resumo-acao', 'aria-label': 'Personagem, arma empunhada e distância' },
    h('span', {}, icone('user'), ` ${p.nome}`),
    h('span', {}, icone('sword'), ` ${arma ? arma.nome : 'desarmado'}`),
    h('span', { title: alvo ? `Distância até ${alvo.nome} no mapa (1 quadrado = 1,5 m)` : 'Escolha um alvo' }, icone('ruler'),
      dist != null ? ` ${String(dist).replace('.', ',')} m${alvo ? ` até ${alvo.nome}` : ''}` : ' —'));
}

// IP geral e o de cada tipo de dano, em bolinhas (o geral vale contra tudo; o do tipo, só contra aquele dano).
const SIGLA_IP = { 'Corte': 'COR', 'Perfuração': 'PER', 'Concussão': 'CON', 'Elétrico': 'ELÉ', 'Calor': 'CAL', 'Frio': 'FRI', 'Energia': 'ENE', 'Radiação': 'RAD',
  'Vibração': 'VIB', 'Onda de Choque': 'OND', 'Ácido': 'ÁCI', 'Venenoso': 'VEN', 'Psíquico': 'PSI', 'Impacto': 'IMP', 'Físico': 'FÍS', 'A distância': 'DIS', 'Elemental': 'ELM', 'Químico': 'QUÍ' };
function ipView(ip) {
  const tipos = Object.entries(ip.tipos).filter(([, v]) => v > 0);
  const bola = (sigla, valor, titulo, classe = '') => h('span', { class: `bola-ip ${classe}`, title: titulo, 'aria-label': titulo }, h('strong', {}, valor), h('small', {}, sigla));
  return h('div', { class: 'ips' },
    bola('GERAL', ip.geral, `IP geral ${ip.geral}: vale contra qualquer dano`, 'geral'),
    tipos.map(([t, v]) => bola(SIGLA_IP[t] || t.slice(0, 3).toUpperCase(), v, `IP ${t} ${v}: só contra dano de ${t}${GRUPOS_IP[t] ? ` (${GRUPOS_IP[t].join(', ')})` : ''}`)),
    tipos.length ? null : h('small', { class: 'dica' }, 'Nenhum IP por tipo de dano.'));
}

// Humor do personagem (o real, que dá os efeitos; e o aparente, se houver máscara).
function humorCombate(p) {
  const humores = estado.sistema.social?.humores;
  if (!humores) return null;
  const nome = id => humores.find(x => x.id === (id || 'neutro'))?.nome || 'Neutro';
  const real = humores.find(x => x.id === (p.humor || 'neutro'));
  return h('p', { class: 'humor-combate', title: real?.efeitos || '' }, icone('smile'), ` Humor: `, h('strong', {}, nome(p.humor)),
    p.humorAparente ? h('small', {}, ` (a sala vê ${nome(p.humorAparente)})`) : null,
    real && real.id !== 'neutro' && real.efeitos ? h('small', { class: 'dica' }, ` — ${real.efeitos}`) : null);
}

// ---------- Habilidades ----------
// Ativar/desativar fica anotado na ficha (lembrete na mesa). Os bônus de cada uma ainda não entram sozinhos nas contas.

function quadroHabilidades(p, mestre) {
  const sis = estado.sistema;
  const ativas = new Set(p.ativas || []);
  const lista = listaHabilidades(p, sis);
  if (!lista.length) return vazio('Nenhuma habilidade ou vantagem.', 'sparkles');
  const alternar = id => acao('personagem.atualizar', { id: p.id, patch: { ativas: ativas.has(id) ? [...ativas].filter(x => x !== id) : [...ativas, id] } });
  // O mestre corrige o que o app entendeu (mesmo formato: "Furtividade +10%; +1 IP Corte; dano +1; +1d6 de dano").
  const ajustar = async x => {
    const atual = p.ajustesHabilidades?.[x.id] ?? efeitosHabilidade(p, sis, x).notas.join('; ');
    const v = await pedirTexto(`O que "${x.nome}" faz no app`, 'Efeitos separados por ; (vazio volta ao texto do livro)', atual);
    if (v == null) return;
    const ajustes = { ...(p.ajustesHabilidades || {}) };
    if (v.trim() && v.trim() !== efeitosHabilidade(p, sis, x).notas.join('; ')) ajustes[x.id] = v.trim(); else delete ajustes[x.id];
    await acao('personagem.atualizar', { id: p.id, patch: { ajustesHabilidades: ajustes } });
  };
  return h('ul', { class: 'lista-habilidades' }, lista.map(x => {
    const on = ativas.has(x.id);
    const ef = efeitosHabilidade(p, sis, x);
    return h('li', { class: on ? 'ativa' : '' },
      h('div', { class: 'hab-texto' },
        h('details', {}, h('summary', {}, h('strong', {}, x.nome), h('small', {}, ` ${x.tipo}`)), h('p', { class: 'bloco-texto' }, x.descricao)),
        h('small', { class: `hab-efeito ${ef.notas.length ? '' : 'so-lembrete'}` }, ef.notas.length ? [icone('zap'), ` ${ef.notas.join(' · ')}`] : 'Só lembrete (sem número para o app somar)',
          p.ajustesHabilidades?.[x.id] ? h('span', { class: 'selo' }, 'ajustado') : null)),
      h('div', { class: 'hab-botoes' },
        botao(on ? 'Ativo' : 'Desativado', () => alternar(x.id), { class: `pequeno ${on ? 'primario' : ''}`, 'aria-pressed': on, title: `${on ? 'Desativar' : 'Ativar'} ${x.nome}` }),
        mestre ? botao('', () => ajustar(x), { class: 'pequeno', icone: 'pencil', title: `Ajustar o que ${x.nome} faz no app` }) : null));
  }));
}

// ---------- Ataques ----------
// Cada linha tem o seu dado. No MSS o dado da arma faz o ataque automático contra o alvo; as manobras e
// especialidades (e tudo no MSA, cujo combate é outro) preparam o teste no rolador da direita.

function quadroAtaques(p, participantes, mestre) {
  const sis = estado.sistema;
  const auto = !!sis.modulos?.combate;
  const d = derivados(p, sis);
  const outros = participantes.filter(x => x.id !== p.id);
  const alvo = outros.length ? alvoDe(p, 'batalha', participantes) : '';
  const b = personagemPorId(alvo);
  const pct = id => `${d.subpericias[id] ?? 0}%`;
  const armas = (p.itens || []).filter(i => i.equipado && i.tipo === 'arma');
  const automaticas = auto ? armasDisponiveis(p, sis) : [];
  const testar = ref => prepararTeste(p.id, ref);
  const atacar = async uid => {
    if (!alvo) throw new Error('Escolha o alvo (clique no cartão dele no campo).');
    const r = await acao('combate.atacar', { atacante: p.id, alvo, opcoes: { ...opcoesGerais(p, mestre), armaUid: uid } });
    if (estado.sel.ataque) estado.sel.ataque.sacrificio = false;
    if (r.tipo === 'ataque') aviso(`${r.autor} ${r.rotulo}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
    else aviso(`${p.nome} ataca ${b?.nome}: aguardando a defesa.`);
  };
  const dado = (rotulo, fn, props = {}) => botao('', fn, { class: 'pequeno dado-linha', icone: 'dices', title: rotulo, 'aria-label': rotulo, ...props });
  // Arma equipada: ataca (MSS) ou prepara o teste da perícia dela (MSA).
  const linhaArma = it => {
    const ref = `sub:${it.pericia || 'briga.ataque-desarmado'}`;
    const semBala = it.capacidade && (it.carregada || 0) <= 0;
    return h('li', { class: 'ataque-linha arma' },
      h('span', { class: 'ataque-nome' }, it.nome, h('small', {}, ` ${it.dano || ''}${it.pericia ? ` · ${pct(it.pericia)}` : ''}`)),
      it.capacidade ? h('span', { class: `selo ${semBala ? 'perigo' : ''}` }, `${it.carregada || 0}/${it.capacidade}`) : null,
      it.capacidade ? botao('', () => acao('item.recarregar', { id: p.id, uid: it.uid }), { class: 'pequeno', icone: 'refresh-cw', title: `Recarregar ${it.nome}`, disabled: (it.carregada || 0) >= it.capacidade }) : null,
      auto && automaticas.some(a => a.uid === it.uid)
        ? dado(`${p.nome} ataca ${b?.nome || 'o alvo'} com ${it.nome}`, () => atacar(it.uid), { disabled: semBala || !alvo })
        : dado(`Testar ${it.nome}`, () => testar(ref)));
  };
  const linhaSub = (id, nome) => h('li', { class: 'ataque-linha' },
    h('span', { class: 'ataque-nome' }, nome, h('small', {}, ` ${pct(id)}`)), dado(`Testar ${nome}`, () => testar(`sub:${id}`)));
  const subs = per => sis.pericias.find(x => x.id === per)?.subpericias || [];
  const grupo = (titulo, per, filtro, extras = null) => {
    const minhas = armas.filter(filtro);
    const chave = `abreGrupo:${per}`;
    return h('li', { class: 'ataque-grupo' },
      h('div', { class: 'ataque-cabeca' }, h('strong', {}, titulo), minhas.length ? null : h('small', { class: 'dica' }, ' (não equipada)')),
      minhas.length ? h('ul', {}, minhas.map(linhaArma)) : null,
      extras,
      h('details', { open: !!estado.sel[chave], ontoggle: e => { estado.sel[chave] = e.target.open; } },
        h('summary', {}, 'Especialidades'),
        h('ul', {}, subs(per).map(s => linhaSub(s.id, s.nome)))));
  };
  const MANOBRAS = ['briga.desarmar', 'briga.agarrar-imobilizar', 'briga.deslocar', 'briga.investida'];
  const outrasArmas = armas.filter(i => !/^(arma-branca|armas-de-fogo)\./.test(i.pericia || ''));
  return [
    h('div', { class: 'barra alvo-ataque' }, icone('crosshair'), h('small', {}, 'Alvo'),
      outros.length ? selecao(outros.map(x => ({ valor: x.id, rotulo: x.nome })), alvo, v => marcarAlvo('batalha', v), { 'aria-label': `Alvo de ${p.nome}` }) : h('em', {}, 'ninguém no campo')),
    auto ? null : h('p', { class: 'dica' }, icone('info'), ` No ${sis.nome} o dado prepara o teste no rolador; o dano e o PV vão à mão.`),
    h('ul', { class: 'lista-ataques' },
      h('li', { class: 'ataque-grupo' },
        h('div', { class: 'ataque-linha' },
          h('strong', { class: 'ataque-nome' }, 'Desarmado', h('small', {}, ` ${pct('briga.ataque-desarmado')}`)),
          auto ? dado(`${p.nome} ataca ${b?.nome || 'o alvo'} desarmado`, () => atacar('desarmado'), { disabled: !alvo }) : dado('Testar ataque desarmado', () => testar('sub:briga.ataque-desarmado'))),
        h('details', { open: !!estado.sel.abreManobras, ontoggle: e => { estado.sel.abreManobras = e.target.open; } },
          h('summary', {}, 'Manobras'),
          h('ul', {}, MANOBRAS.map(id => subs('briga').find(s => s.id === id)).filter(Boolean).map(s => linhaSub(s.id, s.nome))))),
      grupo('Armas brancas', 'arma-branca', i => i.pericia?.startsWith('arma-branca.')),
      grupo('Armas de fogo', 'armas-de-fogo', i => i.pericia?.startsWith('armas-de-fogo.')),
      outrasArmas.length ? h('li', { class: 'ataque-grupo' }, h('div', { class: 'ataque-cabeca' }, h('strong', {}, 'Outras')), h('ul', {}, outrasArmas.map(linhaArma))) : null),
    auto ? opcoesAtaque(p, mestre) : null,
  ];
}

// Opções que valem para o próximo ataque (surpresa, localizado…); as do mestre mudam a rolagem.
function opcoesAtaque(p, mestre) {
  const sel = estado.sel.ataque ||= {};
  const caixa = (chave, rotulo, redesenha = false) => h('label', { class: 'linha' },
    h('input', { type: 'checkbox', checked: !!sel[chave], onchange: e => { sel[chave] = e.target.checked; if (redesenha) render(); } }), rotulo);
  return h('details', { class: 'opcoes-ataque', open: !!estado.sel.ataqueAberto, ontoggle: e => { estado.sel.ataqueAberto = e.target.open; } },
    h('summary', {}, icone('settings'), ' Opções do ataque'),
    h('div', { class: 'grade-opcoes' },
      caixa('localizado', 'Localizado (−30%, +1d6)'),
      caixa('surpresa', 'Surpresa'),
      caixa('elevado', 'Terreno elevado'),
      caixa('area', 'Ataque em área', true),
      caixa('cobertura', 'Alvo em cobertura (+30, tiro)'),
      p.tipo === 'pj' ? caixa('sacrificio', 'Sacrifício (+10%, D6 de vida)') : null,
      mestre ? caixa('vantagem', 'Vantagem') : null,
      mestre ? caixa('desvantagem', 'Desvantagem') : null,
      mestre ? h('label', { class: 'linha' }, 'Mod. %', h('input', { type: 'number', class: 'curto', value: sel.mod || 0, onchange: e => { sel.mod = e.target.value; } })) : null,
      mestre ? h('label', { class: 'linha' }, 'Dano livre', h('input', { class: 'curto', placeholder: '1d6+1', value: sel.danoLivre || '', onchange: e => { sel.danoLivre = e.target.value.trim(); } })) : null));
}

// ---------- Barra da esquerda: avatares na ordem da iniciativa ----------
// Mostra quem age agora e quem vem depois. Clicar escolhe o alvo da próxima ação
// (no seu próprio personagem, passa a controlá-lo). Com 0 PV ou menos, o avatar fica avermelhado.
export function ordemLateral(participantes, mestre) {
  const cb = estado.campanha.salas.batalha.combate;
  const porId = Object.fromEntries(participantes.map(p => [p.id, p]));
  const lista = cb ? cb.ordem.map(o => ({ p: porId[o.id], ini: o.ini })).filter(x => x.p) : participantes.map(p => ({ p, ini: null }));
  if (!lista.length) return null;
  const { meus, p: eu, chave } = controladoNaSala('batalha', participantes, mestre);
  const alvo = eu ? alvoDe(eu, 'batalha', participantes) : null;
  const vez = cb ? cb.vez : -1;
  const proximo = cb && lista.length > 1 ? (vez + 1) % lista.length : -1;
  return h('aside', { class: 'ordem-lateral', 'aria-label': 'Ordem dos turnos' },
    cb ? h('div', { class: 'ordem-topo' }, h('strong', {}, `Rodada ${cb.rodada}`), h('small', {}, `Turno ${cb.turno || 1}`)) : h('div', { class: 'ordem-topo' }, h('small', {}, 'Sem combate')),
    h('ol', {}, lista.map(({ p, ini }, i) => {
      const meu = meus.some(x => x.id === p.id);
      const semPv = p.semPv || (p.pv && p.pv.atual <= 0);
      const ehAlvo = p.id === alvo;
      const rotulo = `${p.nome}${ini != null ? `, iniciativa ${ini}` : ''}${i === vez ? ', agindo agora' : i === proximo ? ', próximo' : ''}${ehAlvo ? ', alvo' : ''}${semPv ? ', sem PV' : ''}`;
      return h('li', { class: `${i === vez ? 'vez' : ''} ${i === proximo ? 'proximo' : ''}` },
        h('button', {
          type: 'button', 'data-pid': p.id, class: `avatar-ordem ${p.tipo} ${ehAlvo ? 'alvo' : ''} ${semPv ? 'sem-pv' : ''} ${eu?.id === p.id ? 'eu' : ''}`,
          title: meu ? `Controlar ${p.nome}` : `Escolher ${p.nome} como alvo`, 'aria-label': rotulo,
          onclick: () => {
            if (meu && eu?.id !== p.id) { estado.sel[chave] = p.id; render(); return; }
            if (!meu) marcarAlvo('batalha', p.id);
          },
        },
          h('span', { class: 'rosto' }, p.foto ? h('img', { src: p.foto, alt: '' }) : p.nome.slice(0, 1)),
          ini != null ? h('span', { class: 'ini' }, ini) : null,
          ehAlvo ? h('span', { class: 'mira' }, icone('crosshair')) : null),
        h('small', { class: 'nome-ordem' }, i === vez ? 'agora' : i === proximo ? 'próximo' : p.nome));
    })));
}
