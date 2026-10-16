import { h, botao, aviso, vazio, confirmar, icone, titulo, tabela, passador, seloRevisao, escolhaComOutra, selecao } from '../ui.js';
import { TIPOS } from './livros.js';
import { estado, render, mudar } from '../estado.js';
import { acao } from '../api.js';
import { novaFicha, pontosDoNivel, pontosGastos, pontosPericiaTotal, pontosVantagemExtra, derivados, problemasFicha, custoPericiaBase, vantagensDisponiveis, acharVantagem } from '/shared/regras.js';
import { ICONE_TIPO, descInstinto } from './ficha.js';
import { painelPericias } from './pericias.js';

const PASSOS = [
  ['Nível e raça', 'trending-up'], ['Identidade', 'user'], ['Atributos', 'zap'], ['Profissão', 'backpack'], ['Perícias', 'target'],
  ['Classe', 'shield'], ['Vantagens e defeitos', 'sparkles'], ['Itens', 'coins'], ['Sanidade e Humanidade', 'brain'], ['Background', 'scroll'], ['Revisão', 'check'],
];

const chaveRascunho = () => `msa.criacao.v2.${estado.campanha.id}.${estado.usuario.id}`;

function salvarRascunho() {
  try { localStorage.setItem(chaveRascunho(), JSON.stringify(estado.criacao)); } catch { /* sem armazenamento */ }
}

export function iniciarCriacao() {
  let rascunho = null;
  try { rascunho = JSON.parse(localStorage.getItem(chaveRascunho()) || 'null'); } catch { /* ignore */ }
  estado.criacao = rascunho || { passo: 0, ficha: novaFicha(estado.sistema, estado.campanha) };
  render();
}

export function cancelarCriacao() {
  try { localStorage.removeItem(chaveRascunho()); } catch { /* ignore */ }
  mudar({ criacao: null });
}

function alterar(fn) {
  fn(estado.criacao.ficha);
  salvarRascunho();
  render();
}

function input(chave, props = {}) {
  const f = estado.criacao.ficha;
  return h('input', { ...props, 'data-key': `cr:${chave}`, value: f[chave] ?? '', oninput: e => { f[chave] = e.target.value; salvarRascunho(); } });
}

function contador(rotulo, gasto, total) {
  const resta = total - gasto;
  return h('div', { class: `contador ${resta < 0 ? 'perigo' : resta === 0 ? 'ok' : ''}`, role: 'status' }, `${rotulo}: ${gasto} de ${total} · restam ${resta}`);
}

const cartaoEscolha = (escolhido, aoClicar, ...conteudo) =>
  h('button', { type: 'button', class: `cartao escolha ${escolhido ? 'escolhido' : ''}`, 'aria-pressed': escolhido, onclick: aoClicar }, ...conteudo);

// ---------- passos ----------

function passoNivel() {
  const c = estado.campanha;
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const pts = pontosDoNivel(f.nivel, sis, c, f);
  const raca = sis.raca;
  return h('div', { class: 'form' },
    c.nivel === 'Variavel'
      ? h('label', {}, 'Nível inicial do personagem (1 a 20)',
        h('input', { type: 'number', min: 1, max: 20, value: f.nivel, onchange: e => alterar(x => { x.nivel = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); }) }))
      : h('p', {}, h('strong', {}, `Nível: ${c.nivel}`), ' (definido pelo mestre)'),
    h('p', {}, c.padraoMSA ? `Início padrão do ${estado.sistema.nome}: ` : 'Pontos definidos pelo mestre: ',
      `${pts.atributos} pontos de atributo, ${pts.vantagens} pontos de vantagem e `,
      pts.pericias ? `${pts.pericias} pontos de perícia.` : 'pontos de perícia pela fórmula 70 + 5×INT + 20×nível.'),
    f.nivel > 1 ? h('p', { class: 'dica' }, `Já inclui a Tabela de Progressão: +2 de atributo por nível e +1 vantagem nos níveis pares.`) : null,
    h('div', { class: 'cartao' },
      titulo(`Raça: ${raca.nome}`, 'user'),
      h('p', {}, `Tamanho ${raca.tamanho} · Deslocamento ${raca.deslocamento}`),
      h('p', {}, `+1 no MOD de: ${Object.keys(raca.modificadores).join(', ')}`),
      h('p', {}, h('strong', {}, `Habilidade única — ${raca.habilidadeUnica.nome}: `), raca.habilidadeUnica.descricao, seloRevisao(raca.habilidadeUnica.revisao)),
      h('p', { class: 'dica' }, 'O mestre pode liberar outras raças no futuro.')));
}

function passoIdentidade() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const idade = parseInt(f.idade, 10);
  const avisoIdade = idade < 15 ? 'Abaixo de 15 anos: −1 em todos os atributos (abaixo de 10: −3).' : idade >= 60 ? 'A partir de 60 anos: −1 em todos os atributos (mais −1 a cada 10 anos).' : null;
  return h('div', { class: 'form' },
    h('label', {}, 'Nome do personagem *', input('nome', { required: true })),
    h('div', { class: 'grade3' }, h('label', {}, 'Idade', input('idade', { type: 'number', min: 5 })), h('label', {}, 'Peso', input('peso')), h('label', {}, 'Tamanho', input('altura'))),
    avisoIdade ? h('p', { class: 'alerta' }, icone('circle-alert'), ` ${avisoIdade} (aplicar manualmente por enquanto)`) : null,
    h('div', { class: 'barra', role: 'group', 'aria-label': 'Mão hábil' }, h('strong', {}, icone('hand'), ' Mão hábil:'),
      [['direita', 'Destro (mão direita)'], ['esquerda', 'Canhoto (mão esquerda)']].map(([v, rot]) => botao(rot, () => alterar(x => { x.maoHabil = v; }),
        { class: `pequeno ${(f.maoHabil || 'direita') === v ? 'primario' : ''}`, 'aria-pressed': (f.maoHabil || 'direita') === v }))),
    h('p', { class: 'dica' }, 'Com uma arma em cada mão, a da mão hábil ataca com −20% e a da outra mão com −40%.'),
    titulo('De onde você veio?', 'compass', 'h4'),
    h('div', { class: 'cartoes' }, sis.origens.map(o => cartaoEscolha(f.origem === o.nome, () => alterar(x => { x.origem = o.nome; }), h('strong', {}, o.nome), h('p', {}, o.descricao)))),
    h('label', {}, 'Família (quem te criou?)', h('textarea', { rows: 2, 'data-key': 'cr:familia', value: f.familia, oninput: e => { f.familia = e.target.value; salvarRascunho(); } })),
    h('label', {}, 'O que te motiva?', escolhaComOutra('cr:motivacao', sis.motivacoes, f.motivacao, v => alterar(x => { x.motivacao = v; }),
      { rotuloOutra: 'Outra…', placeholder: 'Qual a motivação?', props: { 'aria-label': 'Motivação' }, redesenhar: render })),
    h('label', {}, 'Instinto', escolhaComOutra('cr:instinto', (sis.instintos || []).map(x => x.nome), f.instinto, v => alterar(x => { x.instinto = v; }),
      { rotuloOutra: 'Outro…', placeholder: 'Qual o instinto?', props: { 'aria-label': 'Instinto' }, redesenhar: render })),
    descInstinto(f.instinto),
    h('p', { class: 'dica' }, 'O instinto é o inconsciente do personagem: guia o mestre quando ele perde o controle.'),
    h('label', {}, 'Aparência e jeito de agir',
      h('textarea', { rows: 3, 'data-key': 'cr:caracteristicas', value: f.caracteristicas, oninput: e => { f.caracteristicas = e.target.value; salvarRascunho(); } })),
    h('p', { class: 'dica' }, 'A foto do personagem é enviada depois, na própria ficha.'));
}

function passoAtributos() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const total = pontosDoNivel(f.nivel, sis, estado.campanha, f).atributos;
  const gasto = pontosGastos(f, sis).atributos;
  const d = derivados(f, sis);
  return h('div', {},
    contador('Pontos de atributo', gasto, total),
    h('p', { class: 'dica' }, `Mínimo ${sis.regras.atributoMin}, máximo ${d.atributoMax} neste nível. Média humana: 10. A cada 6 pontos o atributo dobra.`),
    tabela(['Atributo', 'Valor', '%', 'Bônus per.', 'MOD'], sis.atributos.map(a => [
      h('span', { title: a.descricao }, h('strong', {}, a.sigla), ' ', h('small', {}, a.nome)),
      passador(f.atributos[a.sigla], sis.regras.atributoMin, Math.min(d.atributoMax, f.atributos[a.sigla] + (total - gasto)), v => alterar(x => { x.atributos[a.sigla] = v; }), a.nome),
      `${d.percentual[a.sigla]}%`, `+${d.bonusPericial[a.sigla]}`, d.mod[a.sigla] >= 0 ? `+${d.mod[a.sigla]}` : d.mod[a.sigla],
    ]), 'tabela-atributos compacta'));
}

function passoProfissao() {
  const f = estado.criacao.ficha;
  return h('div', {},
    h('p', { class: 'dica' }, 'O que você fazia para sobreviver antes de virar aventureiro. Os bônus da profissão não contam no limite de perícia.'),
    h('div', { class: 'cartoes' }, estado.sistema.profissoes.map(p => cartaoEscolha(f.profissao === p.id, () => alterar(x => { x.profissao = p.id; }),
      titulo(p.nome, f.profissao === p.id ? 'check' : 'backpack'), h('p', {}, p.descricao),
      h('p', {}, h('strong', {}, 'Vantagem: '), p.vantagem),
      h('p', { class: 'meta' }, `+${p.bonus}% em: ${p.subpericiasLivro.join('; ')}`)))));
}

function passoPericias() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const total = pontosPericiaTotal(f, sis, estado.campanha);
  const gasto = pontosGastos(f, sis).pericias;
  const d = derivados(f, sis);
  return h('div', {},
    contador('Pontos de perícia (PP)', gasto, total),
    h('p', { class: 'dica' },
      `Perícia base: ${custoPericiaBase({}, sis)} PP por ponto e melhora todas as subperícias (combate: ${custoPericiaBase({ combate: true }, sis)} PP). Subperícia: 1 PP por ponto. `,
      `Limite neste nível: ${d.limitePericia} pontos somando base + subperícia. O bônus do atributo e da profissão entram por cima.`),
    painelPericias(f, {
      d, chave: 'criacao',
      editar: {
        limite: d.limitePericia,
        maxRestante: () => total - pontosGastos(estado.criacao.ficha, sis).pericias,
        base: (id, v) => alterar(x => { x.pericias[id] = v; if (!v) delete x.pericias[id]; }),
        sub: (id, v) => alterar(x => { x.subpericias[id] = v; if (!v) delete x.subpericias[id]; }),
      },
    }));
}

function passoClasse() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const d = derivados(f, sis);
  if (!d.temClasse) {
    return h('div', {},
      h('p', {}, icone('info'), ` Personagens recebem a classe no nível ${sis.regras.nivelClasse}. Seu personagem começa no nível ${f.nivel} — pule este passo.`),
      h('p', { class: 'dica' }, 'Dá para conhecer as classes na aba Classes. Na regra evolutiva, as Marcas do Destino vão empurrando o personagem para uma delas.'));
  }
  const classe = sis.classes.find(c => c.id === f.classe);
  return h('div', {},
    h('p', { class: 'alerta' }, icone('circle-alert'), ' Depois de escolhida, a classe principal não pode ser trocada.'),
    h('div', { class: 'cartoes' }, sis.classes.map(c => cartaoEscolha(f.classe === c.id, () => alterar(x => { x.classe = c.id; x.especializacao = ''; }),
      titulo(c.nome, f.classe === c.id ? 'check' : 'wand-sparkles'), h('p', {}, c.descricao.slice(0, 220) + (c.descricao.length > 220 ? '…' : ''))))),
    classe && d.temEspecializacao ? h('div', { class: 'bloco' },
      titulo(`Especialização de ${classe.nome} (nível ${sis.regras.nivelEspecializacao})`, 'sparkles'),
      h('div', { class: 'cartoes' }, classe.especializacoes.map(e => cartaoEscolha(f.especializacao === e.id, () => alterar(x => { x.especializacao = e.id; }),
        h('strong', {}, e.nome), h('p', {}, e.descricao.slice(0, 200)))))) : null);
}

function passoVantagens() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const base = pontosDoNivel(f.nivel, sis, estado.campanha, f).vantagens;
  const extra = pontosVantagemExtra(f, sis);
  const gasto = pontosGastos(f, sis).vantagens;
  const total = base + extra;
  const busca = (estado.sel.buscaVant || '').toLowerCase();
  const filtra = l => l.filter(x => !busca || x.nome.toLowerCase().includes(busca) || x.descricao.toLowerCase().includes(busca));
  const alternar = (campo, id, marcar) => alterar(x => { x[campo] = marcar ? [...x[campo], id] : x[campo].filter(y => y !== id); });
  // Escolhida a classe (nível 3+), as vantagens dela entram na lista.
  const deClasse = vantagensDisponiveis(f, sis).filter(v => v.origem !== 'Geral');
  const linha = (x, campo, desabilitar) => {
    const tem = f[campo].includes(x.id);
    return h('label', { class: `cartao escolha ${tem ? 'escolhido' : ''}` },
      h('div', { class: 'linha' },
        h('input', { type: 'checkbox', checked: tem, disabled: !tem && desabilitar, onchange: e => alternar(campo, x.id, e.target.checked) }),
        h('strong', {}, x.nome), x.requisito ? h('small', {}, ` [${x.requisito}]`) : null,
        x.tipo ? h('span', { class: `selo ${x.tipo === 'normal' ? 'perigo' : ''}` }, x.tipo === 'normal' ? 'normal (+1 ponto)' : 'leve') : null, seloRevisao(x.revisao)),
      h('p', {}, x.descricao));
  };
  return h('div', {},
    contador('Pontos de vantagem', gasto, total),
    h('p', { class: 'dica' }, `Você tem ${base} pontos. Escolha ao menos ${sis.regras.defeitosMinimos} defeito: um defeito normal dá +1 ponto (máximo +${sis.regras.maxPontosPorDefeitos}). Pré-requisitos [entre colchetes] ainda são conferidos pelo mestre.`),
    h('label', { class: 'busca' }, icone('search'), h('input', { type: 'search', placeholder: 'Buscar…', 'data-key': 'cr:buscaVant', value: estado.sel.buscaVant || '', oninput: e => { estado.sel.buscaVant = e.target.value; render(); } })),
    titulo(`Defeitos (${f.defeitos.length} escolhido${f.defeitos.length === 1 ? '' : 's'})`, 'skull', 'h4'),
    h('div', { class: 'cartoes' }, filtra(sis.defeitos).map(x => linha(x, 'defeitos', false))),
    titulo('Vantagens gerais', 'sparkles', 'h4'),
    h('div', { class: 'cartoes' }, filtra(sis.vantagens).map(x => linha(x, 'vantagens', gasto + (x.custo ?? 1) > total))),
    deClasse.length ? titulo(`Vantagens da classe ${deClasse[0].origem}`, 'shield', 'h4') : null,
    deClasse.length ? h('div', { class: 'cartoes' }, filtra(deClasse).map(x => linha(x, 'vantagens', gasto + (x.custo ?? 1) > total))) : null);
}

// Itens raros ou mais não podem ser comprados com os créditos iniciais.
const RARIDADES_FORA = ['raro', 'lendario', 'unico', 'ilegal'];
const semAcento = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function passoItens() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const iniciais = sis.itens.filter(i => !RARIDADES_FORA.includes(semAcento(i.raridade)));
  const tipoSel = estado.sel.crTipo || '';
  const q = semAcento(estado.sel.crBusca).trim();
  const lista = iniciais.filter(i => (!tipoSel || i.tipo === tipoSel) && (!q || semAcento(i.nome).includes(q)) && (!estado.sel.crCabe || i.preco <= f.dinheiro));
  const mostrados = lista.slice(0, estado.sel.crLimite || 50);
  return h('div', {},
    h('p', { class: 'contador' }, icone('coins'), h('strong', {}, ` ${f.dinheiro} ${sis.moeda} disponíveis`)),
    h('p', { class: 'alerta' }, icone('circle-alert'), ' Os itens vêm das planilhas do autor e ainda estão em revisão. Na criação não entram itens raros, lendários, únicos ou ilegais.'),
    titulo('Itens escolhidos', 'backpack'),
    f.itens.length ? h('ul', { class: 'lista-inline' }, f.itens.map((i, idx) => h('li', {}, `${i.nome} (${i.preco}) `,
      h('button', { type: 'button', class: 'x so-icone', 'aria-label': `Devolver ${i.nome}`, title: `Devolver ${i.nome}`, onclick: () => alterar(x => { x.itens.splice(idx, 1); x.dinheiro += i.preco; }) }, icone('x'))))) : vazio('Nenhum item ainda.', 'backpack'),
    titulo('Catálogo', 'store'),
    h('div', { class: 'barra' },
      selecao([{ valor: '', rotulo: 'Todos os tipos' }, ...Object.entries(TIPOS).filter(([v]) => iniciais.some(i => i.tipo === v)).map(([v, r]) => ({ valor: v, rotulo: r }))], tipoSel,
        v => { estado.sel.crTipo = v; estado.sel.crLimite = null; render(); }, { 'aria-label': 'Tipo de item' }),
      h('label', { class: 'busca' }, icone('search'), h('input', { type: 'search', placeholder: 'Buscar item…', 'data-key': 'cr:buscaItem', value: estado.sel.crBusca || '',
        oninput: e => { estado.sel.crBusca = e.target.value; estado.sel.crLimite = null; render(); } })),
      h('label', { class: 'linha' }, h('input', { type: 'checkbox', checked: !!estado.sel.crCabe, onchange: e => { estado.sel.crCabe = e.target.checked; render(); } }), 'Só o que cabe no dinheiro')),
    h('p', { class: 'dica' }, `${lista.length} itens${lista.length > mostrados.length ? ` (mostrando ${mostrados.length})` : ''}.`),
    tabela(['Item', 'Tipo', 'Preço', 'Dano/IP', 'Bônus', ''], mostrados.map(i => [
      h('span', { class: 'item-nome', title: [i.descricao, i.efeitos].filter(Boolean).join(' · ') }, icone(ICONE_TIPO[i.tipo] || 'tag'), i.nome),
      TIPOS[i.tipo] || i.tipo, h('span', { class: 'moeda' }, icone('coins'), i.preco),
      [i.dano || i.danoTexto, i.defesa ? `IP ${i.defesa}` : null].filter(Boolean).join(' · ') || '—',
      Object.entries(i.bonus || {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ') || '—',
      h('button', {
        type: 'button', class: 'pequeno', disabled: f.dinheiro < i.preco,
        onclick: () => alterar(x => { x.itens.push({ ...structuredClone(i), itemId: i.id, equipado: false, durabilidadeAtual: i.durabilidade }); x.dinheiro -= i.preco; }),
      }, icone('plus'), 'Escolher'),
    ])),
    lista.length > mostrados.length ? h('button', { type: 'button', onclick: () => { estado.sel.crLimite = mostrados.length + 50; render(); } }, icone('chevron-down'), 'Mostrar mais') : null);
}

function passoMental() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const d = derivados(f, sis);
  return h('div', { class: 'form' },
    h('div', { class: 'cartao' }, titulo(`Sanidade: ${d.sanidadeMax}`, 'brain'), h('p', {}, `Calculada por ${sis.regras.formulas.sanidade} (INT ${f.atributos.INT} + WILL ${f.atributos.WILL} + 10).`),
      h('p', { class: 'dica' }, sis.sanidade.estados.map(e => `${e.nome} abaixo de ${e.abaixoDe}`).join(' · '))),
    h('div', { class: 'cartao' }, titulo(`PV: ${d.pvMax}`, 'heart'), h('p', {}, sis.regras.formulas.pv), seloRevisao(true, 'fórmula em revisão')),
    humanidadeInicial(f, d));
}

// Humanidade vai de 1 a 100. O jogador escolhe o valor inicial entre 51 e o limite 50 + 2×CAR + 2×PER.
function humanidadeInicial(f, d) {
  const sis = estado.sistema;
  const atual = Math.max(d.humanidadeMinInicial, Math.min(d.humanidadeLimite, f.humanidade?.atual ?? d.humanidadeLimite));
  if (f.humanidade?.atual !== atual) f.humanidade = { max: d.humanidadeMax, atual };
  return h('div', { class: 'cartao' }, titulo(`Humanidade: ${atual} — ${d.estagioHumanidade?.nome || ''}`, 'hand-heart'),
    h('p', {}, `Vai de 1 a 100. Você escolhe o valor inicial entre ${d.humanidadeMinInicial} e ${d.humanidadeLimite} (50 + 2×CAR ${f.atributos.CAR} + 2×PER ${f.atributos.PER}). Abaixo de 1, você perde o controle do personagem.`),
    h('div', { class: 'valor-linha' }, h('span', {}, 'Humanidade inicial'),
      passador(atual, d.humanidadeMinInicial, d.humanidadeLimite, v => alterar(x => { x.humanidade = { max: d.humanidadeMax, atual: v }; }), 'Humanidade inicial')),
    h('input', { type: 'range', min: d.humanidadeMinInicial, max: d.humanidadeLimite, value: atual, 'aria-label': 'Humanidade inicial (deslizar)',
      onchange: e => alterar(x => { x.humanidade = { max: d.humanidadeMax, atual: parseInt(e.target.value, 10) }; }) }),
    h('p', {}, d.estagioHumanidade?.descricao || ''),
    h('p', { class: 'dica' }, sis.humanidade.notaEfeitos || ''));
}

function passoBackground() {
  const f = estado.criacao.ficha;
  return h('div', { class: 'form' },
    h('p', { class: 'dica' }, 'Amores, ódios, arrependimentos, inimigos, acidentes e defeitos. Se os outros personagens já têm história, amarre uma na outra.'),
    h('label', {}, 'História do personagem',
      h('textarea', { rows: 12, 'data-key': 'cr:background', value: f.background, oninput: e => { f.background = e.target.value; salvarRascunho(); } })));
}

function passoRevisao() {
  const f = estado.criacao.ficha;
  const sis = estado.sistema;
  const d = derivados(f, sis);
  const erros = problemasFicha(f, sis, estado.campanha);
  const g = pontosGastos(f, sis);
  const sobras = [
    ['atributo', pontosDoNivel(f.nivel, sis, estado.campanha, f).atributos - g.atributos],
    ['perícia', pontosPericiaTotal(f, sis, estado.campanha) - g.pericias],
    ['vantagem', pontosDoNivel(f.nivel, sis, estado.campanha, f).vantagens + pontosVantagemExtra(f, sis) - g.vantagens],
  ].filter(([, v]) => v > 0);
  const nome = (lista, id) => lista.find(x => x.id === id)?.nome;
  const treinadas = sis.pericias.flatMap(p => p.subpericias.filter(s => (f.pericias[p.id] || 0) + (f.subpericias[s.id] || 0) > 0).map(s => `${s.nome} ${d.subpericias[s.id]}%`));
  return h('div', {},
    erros.length ? h('div', { class: 'alerta perigo' }, h('strong', {}, 'Antes de criar:'), h('ul', {}, erros.map(e => h('li', {}, e)))) : null,
    sobras.length ? h('div', { class: 'alerta' }, `Ainda sobram pontos — ${sobras.map(([n, v]) => `${v} de ${n}`).join(', ')}. Você pode criar assim mesmo.`) : null,
    h('div', { class: 'ficha-grade' },
      h('section', { class: 'bloco' }, titulo(f.nome || '(sem nome)', 'user'),
        h('p', {}, `Nível ${f.nivel} · ${nome(sis.profissoes, f.profissao) || 'sem profissão'}${f.classe ? ` · ${nome(sis.classes, f.classe)}` : ''}`),
        h('p', {}, `${f.origem || 'Origem não definida'} · ${f.motivacao || 'Motivação não definida'}`),
        h('p', {}, `PV ${d.pvMax} · Sanidade ${d.sanidadeMax} · Humanidade ${f.humanidade?.atual ?? d.humanidadeLimite} · Iniciativa AGI ${d.iniciativa} + 1d10`),
        f.instinto ? h('p', {}, `Instinto: ${f.instinto}`) : null),
      h('section', { class: 'bloco' }, titulo('Atributos', 'zap'), h('p', {}, sis.atributos.map(a => `${a.sigla} ${f.atributos[a.sigla]}`).join(' · '))),
      h('section', { class: 'bloco' }, titulo('Perícias treinadas', 'target'), h('p', {}, treinadas.join(' · ') || 'Nenhuma')),
      h('section', { class: 'bloco' }, titulo('Vantagens, defeitos e itens', 'sparkles'),
        h('p', {}, h('strong', {}, 'Vantagens: '), f.vantagens.map(id => acharVantagem(id, sis)?.nome || id).join(', ') || '—'),
        h('p', {}, h('strong', {}, 'Defeitos: '), f.defeitos.map(id => nome(sis.defeitos, id)).join(', ') || '—'),
        h('p', {}, h('strong', {}, 'Itens: '), f.itens.map(i => i.nome).join(', ') || '—', ` · ${f.dinheiro} ${sis.moeda}`))));
}

const VIEWS = [passoNivel, passoIdentidade, passoAtributos, passoProfissao, passoPericias, passoClasse, passoVantagens, passoItens, passoMental, passoBackground, passoRevisao];

export function criacaoView() {
  const cr = estado.criacao;
  const ir = n => { cr.passo = n; salvarRascunho(); render(); window.scrollTo(0, 0); };
  const ultimo = cr.passo === PASSOS.length - 1;
  return h('div', { class: 'criacao' },
    h('div', { class: 'barra' },
      titulo('Criar personagem', 'feather', 'h2'), h('span', { class: 'espaco' }),
      botao('Cancelar', async () => { if (await confirmar('Descartar esta ficha em criação?')) cancelarCriacao(); }, { class: 'perigo', icone: 'x' })),
    h('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': PASSOS.length, 'aria-valuenow': cr.passo + 1, 'aria-label': 'Progresso da criação' },
      h('i', { style: { width: `${(100 * (cr.passo + 1)) / PASSOS.length}%` } })),
    h('ol', { class: 'passos', 'data-rolagem-x': 'passos' }, PASSOS.map(([p, ic], i) => h('li', { class: i === cr.passo ? 'atual' : i < cr.passo ? 'feito' : '' },
      h('button', { type: 'button', 'aria-current': i === cr.passo ? 'step' : null, onclick: () => ir(i) }, icone(i < cr.passo ? 'check' : ic), `${i + 1}. ${p}`)))),
    h('section', { class: 'bloco passo' }, titulo(`Passo ${cr.passo + 1} de ${PASSOS.length} · ${PASSOS[cr.passo][0]}`, PASSOS[cr.passo][1]), VIEWS[cr.passo]()),
    h('div', { class: 'barra navegacao-passos' },
      cr.passo > 0 ? h('button', { type: 'button', onclick: () => ir(cr.passo - 1) }, icone('arrow-left'), 'Voltar') : null,
      h('span', { class: 'espaco' }),
      ultimo
        ? botao('Criar personagem', async () => {
          const erros = problemasFicha(cr.ficha, estado.sistema, estado.campanha);
          if (erros.length) throw new Error(erros[0]);
          const { id } = await acao('personagem.criar', { tipo: 'pj', ficha: cr.ficha, validar: true });
          try { localStorage.removeItem(chaveRascunho()); } catch { /* ignore */ }
          aviso('Personagem criado! Agora você pode enviar a foto na ficha.');
          mudar({ criacao: null, aba: estado.campanha.papel === 'mestre' ? 'jogadores' : 'ficha', sel: { ...estado.sel, personagem: id } });
        }, { class: 'primario', icone: 'check' })
        : h('button', { type: 'button', class: 'primario', onclick: () => ir(cr.passo + 1) }, 'Avançar', icone('arrow-left', 'gira'))));
}
