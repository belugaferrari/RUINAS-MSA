// Campo de Combate (esboço do autor): no alto, o painel do personagem que você controla, em três quadros —
// Personagem (PV, SAN, HUM, mãos, defesas, IP, efeitos) · Habilidades e vantagens (ativar/desativar) · Ataques.
// Embaixo ficam o turno, os participantes (o campo) e o registro.
import { h, botao, selecao, aviso, icone, titulo, vazio, pedirTexto, confirmar } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados, listaHabilidades, efeitosHabilidade, modoHabilidade, temHabilidade, tipoCriatura, chaveHabilidade, GRUPOS_IP, acoesDaHabilidade, nomeAcao, dadosDaHabilidade, ehAtaqueEspecial, TIPOS_ACAO } from '/shared/regras.js';
import { armasDisponiveis, ipDe, opcoesDefesa, defesaDoAlvo, danoDaArma, recursoDe } from '/shared/combate.js';
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
  // Personagem e Ataques lado a lado; as Habilidades embaixo, na largura toda (sem rolagem por dentro).
  return h('div', { class: 'batalha-topo' },
    h('section', { class: 'bloco bat-personagem', 'data-pid': p.id }, quadroPersonagem(p, meus, chave, mestre, participantes)),
    h('section', { class: 'bloco bat-ataques' }, titulo('Ataques', 'swords'), quadroAtaques(p, participantes, mestre)),
    h('section', { class: 'bloco bat-habilidades' }, titulo('Habilidades', 'sparkles'), quadroHabilidades(p, mestre)));
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
    (p.humorAparente || 'neutro') !== (p.humor || 'neutro') ? h('small', {}, ` (a sala vê ${nome(p.humorAparente || 'neutro')})`) : null,
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
  const lapis = x => mestre ? botao('', () => ajustar(x), { class: 'pequeno', icone: 'pencil', title: `Ajustar o que ${x.nome} faz no app` }) : null;
  const cabeca = x => h('details', {}, h('summary', {}, h('strong', {}, x.nome), x.vezes > 1 ? h('small', { class: 'selo' }, `×${x.vezes}`) : null, h('small', {}, ` ${x.tipo}`), seloAcao(p, x)), h('p', { class: 'bloco-texto' }, x.descricao));
  // Grupos: automáticas (o app aplica sozinho), as de ligar no combate (botão) e as que são só regra para lembrar.
  const automaticas = [], comNumero = [], lembretes = [], deAtivar = [];
  for (const x of lista) {
    const modo = modoHabilidade(p, sis, x);
    (modo === 'sempre' ? automaticas : modo === 'lembrete' ? lembretes : modo === 'ativar' ? deAtivar : comNumero).push(x);
  }
  const recursos = lista.filter(x => x.regra?.recurso).map(x => recursoDe(p, sis, x.regra.recurso.id)).filter(Boolean);
  return [
    recursos.length || p.pvTemp || p.essencia ? h('div', { class: 'hab-recursos barra' },
      recursos.map(r => h('span', { class: 'recurso' }, icone('zap'), h('strong', {}, ` ${r.nome}: ${r.restantes}/${r.max}`),
        botao('Usar como bateria', () => acao('habilidade.recurso', { id: p.id, recurso: r.id }).then(x => aviso(x.texto)), { class: 'pequeno', disabled: !r.restantes }),
        // Núcleo: com coração humano, cada carga causa 1d6 de dano. O mestre marca quando o coração for artificial.
        r.id === 'nucleo' ? h('label', { class: 'linha', title: 'Com coração humano, cada carga usada causa 1d6 de dano' },
          h('input', { type: 'checkbox', checked: !!p.coracaoArtificial, disabled: !mestre, onchange: e => acao('personagem.atualizar', { id: p.id, patch: { coracaoArtificial: e.target.checked } }) }), 'coração artificial') : null)),
      p.pvTemp ? h('span', { class: 'selo ok' }, icone('heart'), ` ${p.pvTemp} PV temporários`) : null,
      p.essencia ? h('span', { class: 'selo ok' }, `Essência: ${p.essencia.sigla} ${p.essencia.valor} (de ${p.essencia.de})`) : null) : null,
    deAtivar.length ? h('div', { class: 'hab-grupo' },
      h('h4', {}, icone('flame'), ' Ativar (custo, usos ou duração)'),
      h('ul', { class: 'lista-habilidades' }, deAtivar.map(x => botaoAtivar(p, x, lapis)))) : null,
    automaticas.length ? h('div', { class: 'hab-grupo automaticas' },
      h('h4', {}, icone('badge-check'), ' Automáticas (o app aplica sozinho)'),
      h('ul', { class: 'lista-habilidades' }, automaticas.map(x => h('li', { class: 'ativa' },
        h('div', { class: 'hab-texto' }, cabeca(x),
          h('small', { class: 'hab-efeito' }, icone('zap'), ` ${efeitosHabilidade(p, sis, x).notas.join(' · ') || x.regra?.texto || ''}`)),
        mestre ? h('div', { class: 'hab-botoes' }, lapis(x)) : null)))) : null,
    comNumero.length ? h('div', { class: 'hab-grupo' },
      h('h4', {}, icone('zap'), ' Ligar no combate'),
      h('ul', { class: 'lista-habilidades' }, comNumero.map(x => {
        const on = ativas.has(x.id);
        const ef = efeitosHabilidade(p, sis, x);
        return h('li', { class: on ? 'ativa' : '' },
          h('div', { class: 'hab-texto' }, cabeca(x),
            h('small', { class: 'hab-efeito' }, icone('zap'), ` ${ef.notas.join(' · ') || x.regra?.texto || ''}`, p.ajustesHabilidades?.[x.id] ? h('span', { class: 'selo' }, 'ajustado') : null)),
          h('div', { class: 'hab-botoes' },
            botao(on ? 'Ligada' : 'Desligada', () => alternar(x.id), { class: `pequeno ${on ? 'primario' : ''}`, 'aria-pressed': on, title: `${on ? 'Desligar' : 'Ligar'} ${x.nome}` }),
            lapis(x)));
      }))) : null,
    lembretes.length ? h('div', { class: 'hab-grupo lembretes' },
      h('h4', {}, icone('book-open'), ' Sempre valem / lembretes'),
      h('ul', { class: 'lista-habilidades' }, lembretes.map(x => h('li', {},
        h('div', { class: 'hab-texto' }, cabeca(x), h('small', { class: 'hab-resumo' }, primeiraFrase(x.descricao))),
        mestre ? h('div', { class: 'hab-botoes' }, lapis(x)) : null)))) : null,
  ];
}

// Quanto tempo a habilidade gasta (do texto do livro, da regra própria ou do lápis do mestre: "ação: bônus").
export function seloAcao(p, x) {
  const acoes = acoesDaHabilidade(p, estado.sistema, x);
  if (!acoes.length) return null;
  return h('span', { class: `selo acao acao-${acoes[0]}`, title: acoes.length > 1 ? `Também citado: ${acoes.slice(1).map(nomeAcao).join(', ')}` : 'Quanto tempo do turno a habilidade gasta' }, nomeAcao(acoes[0]));
}

// Habilidade de ativar: mostra custo/usos/duração; ativa (ou desativa). Essência monstruosa pede o monstro abatido.
function botaoAtivar(p, x, lapis) {
  const sis = estado.sistema;
  const r = x.regra;
  const ativa = p.habAtivas?.[x.id];
  const usados = p.usos?.[chaveHabilidade(x.nome)] || 0;
  const info = [
    r.acao ? `ação ${r.acao}` : null,
    r.custo?.recurso ? `${r.custo.qtd || 1} carga(s)` : null,
    r.custo?.hum ? `−${r.custo.hum} HUM` : null,
    r.usos ? `${Math.max(0, r.usos.max - usados)}/${r.usos.max} por descanso longo` : null,
    r.duracao?.turnos ? `${r.duracao.turnos} turnos` : r.duracao === 'combate' ? 'até o fim do combate' : null,
    r.requerItem ? `precisa de ${r.requerItem.replace('|', ' ou ')}` : null,
  ].filter(Boolean).join(' · ');
  let escolha = null;
  if (r.especial === 'essencia' && !ativa) {
    const abatidos = (estado.campanha.salas.batalha.participantes || []).map(personagemPorId).filter(m => m && m.id !== p.id && tipoCriatura(m) !== 'humanoide'
      && (m.semPv || (m.pv && m.pv.atual <= 0) || (m.marcadores || []).some(k => ['Morto', 'Desmaiado'].includes(k))));
    const chave = `essencia:${p.id}`;
    if (!abatidos.some(m => m.id === estado.sel[chave])) estado.sel[chave] = abatidos[0]?.id || '';
    escolha = abatidos.length ? selecao(abatidos.map(m => ({ valor: m.id, rotulo: m.nome })), estado.sel[chave], v => { estado.sel[chave] = v; }, { 'aria-label': 'Monstro abatido' })
      : h('small', { class: 'dica' }, 'Nenhum monstro abatido no campo.');
  }
  const ef = efeitosHabilidade(p, sis, x).notas.join(' · ');
  return h('li', { class: ativa ? 'ativa' : '' },
    h('div', { class: 'hab-texto' },
      h('details', {}, h('summary', {}, h('strong', {}, x.nome), h('small', {}, ` ${x.tipo}`), seloAcao(p, x)), h('p', { class: 'bloco-texto' }, x.descricao)),
      h('small', { class: 'hab-efeito' }, icone('zap'), ` ${ef || r.texto || ''}`),
      h('small', { class: 'dica' }, ativa?.turnos ? `ativa: falta${ativa.turnos > 1 ? 'm' : ''} ${ativa.turnos} turno${ativa.turnos > 1 ? 's' : ''}` : ativa ? 'ativa' : info),
      escolha),
    h('div', { class: 'hab-botoes' },
      botao(ativa ? 'Desativar' : 'Ativar', async () => {
        if (!ativa && info && !(await confirmar(`Ativar ${x.nome}? ${info}.`))) return;
        const res = await acao('habilidade.ativar', { id: p.id, hab: x.id, alvo: estado.sel[`essencia:${p.id}`] || null });
        aviso(res.desativou ? `${x.nome} desativada.` : `${x.nome}: ${res.texto}`);
        if (res.excesso) aviso(`Atenção: ${res.excesso}.`, 'erro');
      }, { class: `pequeno ${ativa ? '' : 'primario'}`, icone: 'flame', disabled: !ativa && ((r.usos && usados >= r.usos.max) || (r.especial === 'essencia' && !estado.sel[`essencia:${p.id}`])) }),
      lapis(x)));
}

// Começo da descrição, para lembrar do que se trata sem abrir o texto todo.
function primeiraFrase(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  const f = t.split(/(?<=[.!?])\s/)[0];
  return f.length > 160 ? `${f.slice(0, 157).trimEnd()}…` : f;
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
    if (estado.sel.ataque) Object.assign(estado.sel.ataque, { sacrificio: false, cargaNucleo: false, investida: null });
    if (r.excesso) aviso(`Atenção: ${r.excesso}.`, 'erro');
    if (r.tipo === 'barrado') aviso(r.texto, 'erro');
    else if (r.tipo === 'ataque') aviso(`${r.autor} ${r.rotulo}: ${r.texto}`, r.sucesso ? 'ok' : 'erro');
    else aviso(`${p.nome} ataca ${b?.nome}: aguardando a defesa.`);
  };
  const dado = (rotulo, fn, props = {}) => botao('', fn, { class: 'pequeno dado-linha', icone: 'dices', title: rotulo, 'aria-label': rotulo, ...props });
  // Arma equipada: ataca (MSS) ou prepara o teste da perícia dela (MSA).
  // Habilidades que melhoram a arma (Ataque afiado, Aperfeiçoamento do soldado): botão "Afiar" na arma que serve.
  const melhoradoras = listaHabilidades(p, sis).filter(x => x.regra?.melhoria);
  const linhaArma = it => {
    const ref = `sub:${it.pericia || 'briga.ataque-desarmado'}`;
    const semBala = it.capacidade && (it.carregada || 0) <= 0;
    const minhas = (it.melhorias || []).filter(m => !m.dono || m.dono === p.id);
    const podeMelhorar = melhoradoras.filter(x => String(it.pericia || '').startsWith(x.regra.melhoria.armas)
      && !minhas.some(m => m.id === x.regra.melhoria.id && m.nivel >= (x.vezes || 1)));
    return h('li', { class: 'ataque-linha arma' },
      h('span', { class: 'ataque-nome' }, it.nome, h('small', {}, ` ${danoDaArma(it, p) || ''}${it.pericia ? ` · ${pct(it.pericia)}` : ''}`),
        minhas.map(m => h('span', { class: 'selo ok', title: `+${m.nivel} passo(s) na progressão de dano` }, `${m.nome} ${m.nivel}`))),
      podeMelhorar.map(x => botao(x.regra.melhoria.id === 'afiada' ? 'Afiar' : 'Aperfeiçoar', async () => {
        if (!(await confirmar(`${p.nome} passa ${x.regra.melhoria.horas || 2} h treinando com ${it.nome}. Ela fica ${x.regra.melhoria.nome} ${x.vezes || 1} (só para ${p.nome}).`))) return;
        const r = await acao('item.melhorar', { id: p.id, uid: it.uid, habilidade: x.nome });
        aviso(`${it.nome}: ${r.nome} ${r.nivel}`);
      }, { class: 'pequeno', icone: 'hammer', title: `${x.nome}: ${x.regra.texto}` })),
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
    acoesDoTurno(p),
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
      ataquesEspeciais(p),
      auto && temHabilidade(p, sis, 'Dano ao sistema') ? h('li', { class: 'ataque-grupo' }, h('div', { class: 'ataque-cabeca' }, h('strong', {}, 'Emissor Neural')),
        h('ul', {}, h('li', { class: 'ataque-linha' },
          h('span', { class: 'ataque-nome' }, 'Dano ao sistema', h('small', {}, ` 2d6 + MOD INT elétrico · ${pct('computacao.operacional')}${b ? ` · ${['drone', 'automato', 'maquina'].includes(tipoCriatura(b)) ? 'Normal' : 'Difícil (item)'}` : ''}`)),
          dado(`${p.nome}: Dano ao sistema em ${b?.nome || 'o alvo'}`, async () => {
            if (!alvo) throw new Error('Escolha o alvo.');
            const r = await acao('habilidade.danoSistema', { id: p.id, alvo });
            aviso(r.texto, r.sucesso ? 'ok' : 'erro');
          }, { disabled: !alvo })))) : null,
      outrasArmas.length ? h('li', { class: 'ataque-grupo' }, h('div', { class: 'ataque-cabeca' }, h('strong', {}, 'Outras')), h('ul', {}, outrasArmas.map(linhaArma))) : null),
    auto ? opcoesAtaque(p, mestre) : null,
  ];
}

// Economia do turno do personagem: o que já gastou (principal, movimento, bônus; reação por rodada). Clicar marca ou
// desmarca (ex.: andou, sacou a arma). O ataque gasta a principal sozinho. O app só avisa quando passa do limite.
function acoesDoTurno(p) {
  const cb = estado.campanha.salas.batalha.combate;
  if (!cb) return null;
  const g = cb.gasto?.[p.id] || {};
  const usado = k => k === 'reacao' ? (g.reacaoRodada === cb.rodada ? g.reacao || 0 : 0) : g[k] || 0;
  const daVez = cb.ordem[cb.vez]?.id === p.id;
  const chip = (k, ic, rot, dica) => {
    const u = usado(k) > 0;
    return h('button', { type: 'button', class: `acao-chip ${u ? 'usada' : ''}`, 'aria-pressed': u, title: `${dica}${u ? ' — já usada (clique para desmarcar)' : ' — clique para marcar como usada'}`,
      onclick: () => acao('combate.acao', { id: p.id, tipo: k, desfazer: u, rotulo: u ? null : `${p.nome}: ${rot}` }).then(r => r.excesso && aviso(`Atenção: ${r.excesso}.`, 'erro')) },
      icone(u ? 'check' : ic), ` ${rot}`);
  };
  return h('div', { class: 'acoes-turno' },
    h('small', { class: 'dica' }, daVez ? 'Seu turno — ações:' : 'Fora do turno — só reação:'),
    chip('principal', 'swords', 'Principal', 'Ação principal: atacar, correr, manobra, esconder-se'),
    chip('movimento', 'footprints', 'Movimento', 'Ação de movimento: deslocar-se (pode dividir antes e depois da principal)'),
    chip('bonus', 'zap', 'Bônus', 'Ação bônus: só com habilidade ou item que permita (ex.: sacar)'),
    chip('reacao', 'shield', 'Reação', 'Reação: fora do seu turno, 1 por rodada (ex.: ataque de oportunidade)'));
}

// Ataques especiais e habilidades que gastam ação (de todas as classes): o tempo que gastam, "Usar" (marca a ação do
// turno e anota) e os dados de dano citados no texto.
function ataquesEspeciais(p) {
  const sis = estado.sistema;
  const lista = listaHabilidades(p, sis).map(x => ({ x, acoes: acoesDaHabilidade(p, sis, x) }))
    .filter(({ x, acoes }) => acoes.length || ehAtaqueEspecial(x))
    .sort((a, b) => Number(ehAtaqueEspecial(b.x)) - Number(ehAtaqueEspecial(a.x)));
  if (!lista.length) return null;
  const chave = 'abreGrupo:especiais';
  return h('li', { class: 'ataque-grupo' },
    h('div', { class: 'ataque-cabeca' }, h('strong', {}, 'Ataques especiais e ações de habilidades')),
    h('details', { open: estado.sel[chave] ?? true, ontoggle: e => { estado.sel[chave] = e.target.open; } },
      h('summary', {}, `${lista.length} habilidade${lista.length > 1 ? 's' : ''}`),
      h('ul', {}, lista.map(({ x, acoes }) => h('li', { class: 'ataque-linha especial' },
        h('span', { class: 'ataque-nome', title: x.descricao }, ehAtaqueEspecial(x) ? icone('swords') : icone('sparkles'), ` ${x.nome} `,
          acoes.length ? h('small', { class: `selo acao acao-${acoes[0]}` }, nomeAcao(acoes[0])) : h('small', { class: 'selo', title: 'O livro não diz quanto tempo gasta: o mestre define (lápis: "ação: bônus")' }, 'ação ?')),
        dadosDaHabilidade(x).map(d => botao(d, () => acao('rolar', { id: p.id, dado: d, rotulo: `${x.nome} (${d})`, sala: 'batalha' }).then(r => aviso(`${x.nome}: ${r.total} [${r.dados.join(', ')}]`)),
          { class: 'pequeno', icone: 'dices', title: `Rolar ${d} (${x.nome})` })),
        botao('Usar', () => acao('combate.acao', { id: p.id, tipo: acoes[0] || 'livre', rotulo: `${p.nome} usa ${x.nome}` })
          .then(r => { aviso(`${x.nome}: ${nomeAcao(acoes[0] || 'livre')} anotada.`); if (r.excesso) aviso(`Atenção: ${r.excesso}.`, 'erro'); }),
        { class: 'pequeno primario', icone: 'zap', title: `Anota o uso e gasta a ${nomeAcao(acoes[0] || 'livre').toLowerCase()}`, disabled: !estado.campanha.salas.batalha.combate }))))));
}

// Opções que valem para o próximo ataque (surpresa, localizado…); as do mestre mudam a rolagem.
function opcoesAtaque(p, mestre) {
  const sel = estado.sel.ataque ||= {};
  const nucleo = recursoDe(p, estado.sistema, 'nucleo');
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
      // Núcleo energético: +2d6 elétrico neste ataque (gasta 1 carga). Máquina Implacável: Investida com dano maior.
      nucleo && nucleo.restantes > 0 ? caixa('cargaNucleo', `Carga do Núcleo (+2d6 elétrico · restam ${nucleo.restantes})`) : null,
      temHabilidade(p, estado.sistema, 'Maquina Implacavel') ? h('label', { class: 'linha', title: 'Máquina Implacável: dano +1 passo e +1 por quadrado avançado' },
        h('input', { type: 'checkbox', checked: sel.investida != null, onchange: e => { sel.investida = e.target.checked ? 1 : null; render(); } }), 'Investida',
        sel.investida != null ? h('input', { type: 'number', class: 'curto', min: 0, value: sel.investida, 'aria-label': 'Quadrados avançados', onchange: e => { sel.investida = Math.max(0, parseInt(e.target.value, 10) || 0); } }) : null,
        sel.investida != null ? h('small', {}, ' quadrados') : null) : null,
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
  return h('aside', { class: 'ordem-lateral ordem-faixa', 'aria-label': 'Ordem dos turnos' },
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
