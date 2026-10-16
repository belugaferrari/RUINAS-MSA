// Campo de Combate (esboço do autor): no alto, o painel do personagem que você controla, em três quadros —
// Personagem (PV, SAN, HUM, mãos, defesas, IP, efeitos) · Habilidades e vantagens (ativar/desativar) · Ataques.
// Embaixo ficam o turno, os participantes (o campo) e o registro.
import { h, botao, selecao, aviso, icone, titulo, vazio } from '../ui.js';
import { estado, render, personagemPorId } from '../estado.js';
import { acao } from '../api.js';
import { derivados, acharVantagem, ganhosDeClasse } from '/shared/regras.js';
import { armasDisponiveis, ipDe } from '/shared/combate.js';
import { trilhaCompacta, escolherCondicao } from './ficha.js';
import { painelSlot } from './boneco.js';
import { efeitosIcones } from './efeitos.js';
import { prepararTeste } from './dados.js';
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
    h('section', { class: 'bloco bat-personagem' }, quadroPersonagem(p, meus, chave, mestre)),
    h('section', { class: 'bloco bat-habilidades' }, titulo('Habilidades, características e vantagens', 'sparkles'), quadroHabilidades(p)),
    h('section', { class: 'bloco bat-ataques' }, titulo('Ataques', 'swords'), quadroAtaques(p, participantes, mestre)));
}

// ---------- Personagem ----------

function quadroPersonagem(p, meus, chave, mestre) {
  const sis = estado.sistema;
  const d = derivados(p, sis);
  const sub = id => d.subpericias[id] ?? 0;
  const base = sis.combate?.defesaPassiva ?? sis.teste.passiva?.soma ?? 50;
  const maos = (p.itens || []).filter(i => i.equipado && i.slot === 'maos');
  const duas = maos.find(i => (i.ocupa ?? 1) >= 2);
  const naMao = n => (duas ? duas : maos[n]);
  const abertoMao = estado.sel[`boneco:${p.id}`];
  const brancaEmpunhada = maos.filter(i => i.pericia?.startsWith('arma-branca.') && !(sis.combate?.semDefesaArmada || []).includes(i.pericia))
    .sort((a, b) => sub(b.pericia) - sub(a.pericia))[0];
  const mao = (n, rotulo) => {
    const it = naMao(n);
    const id = `maos:${n}`;
    return h('div', { class: 'mao' },
      h('small', {}, rotulo), h('span', { class: 'mao-item', title: it?.nome || 'vazia' }, it?.nome || '—'),
      botao(abertoMao === id ? 'Fechar' : 'Equipar', () => { estado.sel[`boneco:${p.id}`] = abertoMao === id ? null : id; render(); },
        { class: 'pequeno', icone: 'shirt', title: `${rotulo}: equipar ou trocar`, 'aria-expanded': abertoMao === id }));
  };
  const defesa = (rot, valor, titulo) => h('div', { class: 'defesa', title: titulo }, h('small', {}, rot), h('strong', {}, valor == null ? '—' : valor));
  return [
    h('div', { class: 'barra' }, icone('user'), nomeControlado(meus, p, chave)),
    trilhaCompacta(p, 'pv', 'PV', 'heart'),
    p.sanidade ? trilhaCompacta(p, 'sanidade', 'SAN', 'brain') : null,
    p.humanidade ? trilhaCompacta(p, 'humanidade', 'HUM', 'hand-heart') : null,
    h('div', { class: 'maos' }, mao(1, 'Mão esq.'), mao(0, 'Mão dir.')),
    abertoMao?.startsWith('maos') ? painelSlot(p, abertoMao, mestre) : null,
    h('h4', {}, icone('shield'), ' Defesas'),
    h('div', { class: 'defesas' },
      defesa('Esquiva', sub('briga.esquiva') + base, 'Esquiva + 50: contra Briga e Armas Brancas'),
      defesa('Armada', brancaEmpunhada ? sub(brancaEmpunhada.pericia) + base : null, brancaEmpunhada ? `Defesa armada com ${brancaEmpunhada.nome}` : 'Empunhe uma arma branca para defender com ela'),
      defesa('Evasão', sub('briga.evasao') + base, 'Evasão + 50: só contra ataque em área'),
      defesa('Desarmada', sub('briga.defesa-desarmada') + base, 'Defesa desarmada + 50: só contra Briga'),
      defesa('IP', sis.modulos?.combate ? ipDe(p, sis) : d.defesa, 'Índice de Proteção: sai do dano recebido')),
    h('h4', {}, icone('activity'), ' Efeitos'),
    h('div', { class: 'barra' }, efeitosIcones(p, { mestre }) || h('small', { class: 'dica' }, 'Nenhum.'),
      botao('Marcador', () => escolherCondicao(p), { class: 'pequeno', icone: 'tag', title: 'Escolher uma condição' })),
  ];
}

// ---------- Habilidades ----------
// Ativar/desativar fica anotado na ficha (lembrete na mesa). Os bônus de cada uma ainda não entram sozinhos nas contas.

function quadroHabilidades(p) {
  const sis = estado.sistema;
  const ativas = new Set(p.ativas || []);
  const lista = [
    ...(p.vantagens || []).map(id => acharVantagem(id, sis)).filter(Boolean).map(v => ({ id: `v:${v.id}`, nome: v.nome, descricao: v.descricao, tipo: v.origem === 'Geral' ? 'Vantagem' : `Classe · ${v.origem}` })),
    ...ganhosDeClasse(p, sis).filter(g => g.descricao).map(g => ({ id: `c:${g.nome}`, nome: g.nome, descricao: g.descricao, tipo: `Nível ${g.nivel}` })),
    sis.raca?.habilidadeUnica ? { id: 'raca', nome: sis.raca.habilidadeUnica.nome, descricao: sis.raca.habilidadeUnica.descricao, tipo: sis.raca.nome } : null,
  ].filter(Boolean);
  if (!lista.length) return vazio('Nenhuma habilidade ou vantagem.', 'sparkles');
  const alternar = id => acao('personagem.atualizar', { id: p.id, patch: { ativas: ativas.has(id) ? [...ativas].filter(x => x !== id) : [...ativas, id] } });
  return h('ul', { class: 'lista-habilidades' }, lista.map(x => {
    const on = ativas.has(x.id);
    return h('li', { class: on ? 'ativa' : '' },
      h('details', {}, h('summary', {}, h('strong', {}, x.nome), h('small', {}, ` ${x.tipo}`)), h('p', { class: 'bloco-texto' }, x.descricao)),
      botao(on ? 'Ativo' : 'Desativado', () => alternar(x.id), { class: `pequeno ${on ? 'primario' : ''}`, 'aria-pressed': on, title: `${on ? 'Desativar' : 'Ativar'} ${x.nome}` }));
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
      selecao([{ valor: '', rotulo: 'Uma arma' }, { valor: 'principal', rotulo: 'Duas armas: principal (−20%)' }, { valor: 'inabil', rotulo: 'Duas armas: inábil (−40%)' }],
        sel.duasArmas || '', v => { sel.duasArmas = v; }, { 'aria-label': 'Duas armas' }),
      mestre ? caixa('vantagem', 'Vantagem') : null,
      mestre ? caixa('desvantagem', 'Desvantagem') : null,
      mestre ? h('label', { class: 'linha' }, 'Mod. %', h('input', { type: 'number', class: 'curto', value: sel.mod || 0, onchange: e => { sel.mod = e.target.value; } })) : null,
      mestre ? h('label', { class: 'linha' }, 'Dano livre', h('input', { class: 'curto', placeholder: '1d6+1', value: sel.danoLivre || '', onchange: e => { sel.danoLivre = e.target.value.trim(); } })) : null));
}
