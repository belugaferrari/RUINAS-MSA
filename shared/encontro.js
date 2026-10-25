// Gerador de encontro por faixa de ND (autor, 25/10): sorteia criaturas (ou um estágio delas) dentro da faixa, varia
// atributos e perícias em até 10%, sorteia o PV atual entre 50% e 100% e escreve o cenário — com IA (server/ia.js) ou,
// sem IA, com o comportamento/habitat da planilha e tabelas sorteadas.
import { monstroNoEstagio, textoND } from './monstros.js';
import { limitePericia } from './regras.js';

const sorteio = (lista, rng) => lista[Math.floor(rng() * lista.length)];

// Cada criatura entra com o ND dela; com estágios, cada estágio é uma opção (com o ND do estágio).
export function opcoesNaFaixa(monstros, ndMin, ndMax) {
  const lista = [];
  for (const m of monstros) {
    const estagios = m.estagios?.length ? m.estagios.map(e => e.numero) : [null];
    for (const n of estagios) {
      const v = monstroNoEstagio(m, n);
      const nd = v.dificuldade ?? 1;
      if (nd >= ndMin && nd <= ndMax) lista.push({ nome: m.nome, estagio: n, nomeEstagio: v.nomeEstagio || null, nd });
    }
  }
  return lista;
}

// Variação de até ±10% (arredondada; atributo pelo menos 1). Perícias continuam dentro do limite do nível.
export function variar(v, sistema, rng = Math.random, faixa = 0.1) {
  const mexe = x => Math.round(x * (1 + (rng() * 2 - 1) * faixa));
  const atributos = Object.fromEntries(Object.entries(v.atributos || {}).map(([k, x]) => [k, Math.max(1, mexe(x))]));
  const lim = limitePericia(v.nivel || 1, sistema);
  const pericias = Object.fromEntries(Object.entries(v.pericias || {}).map(([k, x]) => [k, Math.max(0, Math.min(lim, mexe(x)))]));
  const subDe = Object.fromEntries((sistema.pericias || []).flatMap(p => p.subpericias.map(s => [s.id, p.id])));
  const subpericias = Object.fromEntries(Object.entries(v.subpericias || {}).map(([k, x]) => [k, Math.max(0, Math.min(lim - (pericias[subDe[k]] || 0), mexe(x)))]));
  return { atributos, pericias, subpericias };
}
export const pvAtual = (max, rng = Math.random) => Math.max(1, Math.round(max * (0.5 + rng() * 0.5)));

export function sortearEncontro(monstros, { ndMin = 0, ndMax = 99, quantidade = 1, mesma = true } = {}, sistema, rng = Math.random) {
  const opcoes = opcoesNaFaixa(monstros, ndMin, ndMax);
  if (!opcoes.length) throw new Error(`Nenhuma criatura com ND entre ${textoND(ndMin)} e ${textoND(ndMax)}.`);
  const n = Math.max(1, Math.min(12, parseInt(quantidade, 10) || 1));
  const primeira = sorteio(opcoes, rng);
  return Array.from({ length: n }, (_, i) => {
    const o = mesma || i === 0 ? primeira : sorteio(opcoes, rng);
    const m = monstros.find(x => x.nome === o.nome);
    const v = monstroNoEstagio(m, o.estagio);
    return { ...o, variacao: variar(v, sistema, rng), fracaoPv: 0.5 + rng() * 0.5 };
  });
}

// ---------- Cenário sem IA ----------
const ATIVIDADES = [
  'está se alimentando de uma carcaça e não percebeu ninguém ainda',
  'dorme num abrigo improvisado; um barulho pode acordá-la',
  'patrulha o território, parando de tempos em tempos para farejar o ar',
  'está à espreita, imóvel, esperando uma presa passar',
  'bebe água num ponto baixo do terreno, de costas para o grupo',
  'marca território, arranhando e esfregando o corpo nas estruturas em volta',
  'disputa restos com outras criaturas menores, irritada e barulhenta',
  'acabou de caçar e arrasta a presa para longe',
];
const SINAIS = [
  'Pegadas frescas e marcas de arrasto levam até lá.',
  'Um cheiro forte de carne e umidade chega antes de qualquer som.',
  'O silêncio dos animais em volta denuncia que algo grande está por perto.',
  'Restos de ossos e penas espalhados indicam um ponto de caça.',
  'Um som ritmado (respiração ou passos pesados) ecoa entre as ruínas.',
];
const HORA = h => (h < 5 ? 'Madrugada' : h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite');

export function cenarioSemIA(criaturas, monstros, contexto = {}, rng = Math.random) {
  const c0 = criaturas[0];
  const m = monstros.find(x => x.nome === c0.nome);
  const v = monstroNoEstagio(m, c0.estagio);
  const nome = c0.nome.replace(/\s*\(.*$/, '');
  const quantos = criaturas.length > 1 ? (criaturas.every(x => x.nome === c0.nome) ? `${criaturas.length} ${nome}` : `${criaturas.length} criaturas (${[...new Set(criaturas.map(x => x.nome.replace(/\s*\(.*$/, '')))].join(', ')})`) : nome;
  const ferido = criaturas.some(x => x.fracaoPv < 0.7);
  const partes = [];
  const quando = [contexto.hora != null ? HORA(contexto.hora % 24) : null, contexto.clima || null].filter(Boolean).join(', ');
  partes.push(`${quando ? `${quando}. ` : ''}${v.habitat ? `Em ${v.habitat.charAt(0).toLowerCase()}${v.habitat.slice(1).replace(/\.$/, '')}` : 'Entre as ruínas'}, o grupo encontra ${quantos}${c0.nomeEstagio ? ` (${c0.nomeEstagio})` : ''}.`);
  // "O bando" (masculino, singular) quando são vários: "acordá-lo".
  partes.push(`${criaturas.length > 1 ? 'O bando' : 'A criatura'} ${sorteio(ATIVIDADES, rng).replace('-la', criaturas.length > 1 ? '-lo' : '-la')}.`);
  if (v.comportamento) partes.push(`Comportamento: ${v.comportamento}`);
  if (v.descricaoEstagio) partes.push(v.descricaoEstagio.endsWith('.') ? v.descricaoEstagio : `${v.descricaoEstagio}.`);
  if (ferido) partes.push('Há sinais de uma luta recente: ferimentos abertos e sangue no chão.');
  partes.push(sorteio(SINAIS, rng));
  return partes.join(' ');
}

// Pedido para a IA: só o que o livro diz do monstro e o momento da campanha. Ela escreve, não inventa números.
export const SISTEMA_IA = 'Você é o narrador de uma mesa de RPG pós-apocalíptico chamada "Ilhas das Ruínas": ilhas devastadas, ruínas de cidades, mutações e criaturas estranhas. Escreva em português do Brasil, em segunda ou terceira pessoa, para o mestre ler para os jogadores.';
export function pedidoIA(criaturas, monstros, contexto = {}) {
  const fichas = [...new Map(criaturas.map(c => [`${c.nome}|${c.estagio}`, c])).values()].map(c => {
    const v = monstroNoEstagio(monstros.find(x => x.nome === c.nome), c.estagio);
    const qtd = criaturas.filter(x => x.nome === c.nome && x.estagio === c.estagio).length;
    return [`- ${qtd}× ${c.nome}${c.nomeEstagio ? ` — ${c.nomeEstagio}` : ''} (${v.tamanho || 'tamanho ?'}, ${v.tipoCriatura || 'monstro'})`,
      v.descricao ? `  Descrição: ${v.descricao}` : '', v.descricaoEstagio ? `  Neste estágio: ${v.descricaoEstagio}` : '',
      v.comportamento ? `  Comportamento: ${v.comportamento}` : '', v.habitat ? `  Onde vive: ${v.habitat}` : '', v.sentidos ? `  Sentidos: ${v.sentidos}` : ''].filter(Boolean).join('\n');
  }).join('\n');
  const feridos = criaturas.filter(c => c.fracaoPv < 0.7).length;
  return [
    'Descreva um encontro aleatório com:', fichas,
    feridos ? `${feridos} delas está(ão) ferida(s) (com pouca vida), o que deve aparecer na cena.` : '',
    contexto.hora != null ? `Momento: ${HORA(contexto.hora % 24).toLowerCase()}.` : '', contexto.clima ? `Clima: ${contexto.clima}.` : '',
    contexto.extra ? `Contexto dado pelo mestre: ${contexto.extra}` : '',
    'Escreva 1 ou 2 parágrafos curtos (até 150 palavras no total): o cenário (o lugar, a luz, os sons, o cheiro) e o que a(s) criatura(s) está(ão) fazendo agora, com um ou dois sinais que os jogadores percebem antes de vê-las.',
    'Use o comportamento e o habitat do livro. Não invente números, regras, nomes de personagens dos jogadores nem o resultado do encontro. Sem títulos nem listas.',
  ].filter(Boolean).join('\n');
}
