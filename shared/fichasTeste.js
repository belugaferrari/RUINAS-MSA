// Fichas de teste: um personagem de nível alto para cada classe/especialização, montado com as regras de pontos,
// e um relatório do que pode dar problema nas habilidades (ganho sem texto, vantagem que o app não entende…).
import { novaFicha, pontosDoNivel, pontosPericiaTotal, pontosVantagemExtra, atributoMax, limitePericia, custoPericiaBase,
  vantagensDisponiveis, problemasFicha, ganhosDeClasse, listaHabilidades, efeitosHabilidade, derivados, ipDoItem } from './regras.js';

export function fichaDeTeste(sistema, classe, esp, nivel = 6, campanha = null) {
  const f = novaFicha(sistema, campanha);
  Object.assign(f, {
    nome: `Teste · ${classe.nome}${esp ? ` (${esp.nome})` : ''}`, nivel, classe: classe.id, especializacao: esp?.id || '',
    profissao: sistema.profissoes?.[0]?.id || '', genero: 'masculino', atracao: ['feminino'], instinto: sistema.instintos?.[0]?.nome || '',
    background: 'Ficha gerada pelo app para testar as habilidades da classe.',
  });
  // Atributos: o orçamento do nível dividido por igual, sem passar do máximo.
  const siglas = sistema.atributos.map(a => a.sigla);
  const pts = pontosDoNivel(nivel, sistema, campanha, f);
  const max = atributoMax(nivel, sistema);
  let resto = pts.atributos;
  f.atributos = Object.fromEntries(siglas.map(s => [s, 0]));
  while (resto > 0) {
    let deu = false;
    for (const s of siglas) if (resto > 0 && f.atributos[s] < max) { f.atributos[s]++; resto--; deu = true; }
    if (!deu) break;
  }
  // Um defeito leve (obrigatório).
  const leve = sistema.defeitos?.find(d => d.tipo === 'leve');
  f.defeitos = leve ? [leve.id] : [];
  // Vantagens: primeiro as da classe, depois as gerais, até acabar o orçamento.
  let pv = pontosDoNivel(nivel, sistema, campanha, f).vantagens + pontosVantagemExtra(f, sistema);
  const doClasse = vantagensDisponiveis(f, sistema).sort((a, b) => (a.origem === 'Geral') - (b.origem === 'Geral'));
  f.vantagens = [];
  for (const v of doClasse) {
    const custo = v.custo ?? 1;
    if (custo <= pv) { f.vantagens.push(v.id); pv -= custo; }
    if (pv <= 0) break;
  }
  // Perícias: metade do limite na base de várias perícias e o resto nas primeiras subperícias.
  const lim = limitePericia(nivel, sistema);
  let pp = pontosPericiaTotal(f, sistema, campanha);
  f.pericias = {};
  f.subpericias = {};
  for (const p of sistema.pericias) {
    const custo = custoPericiaBase(p, sistema);
    const n = Math.min(Math.floor(lim / 2), Math.floor(pp / custo));
    if (n <= 0) break;
    f.pericias[p.id] = n;
    pp -= n * custo;
  }
  for (const p of sistema.pericias) {
    const sub = p.subpericias[0];
    if (!sub || pp <= 0) continue;
    const n = Math.min(lim - (f.pericias[p.id] || 0), pp);
    if (n > 0) { f.subpericias[sub.id] = n; pp -= n; }
  }
  const d = derivados(f, sistema);
  f.pv = { max: d.pvMax, atual: d.pvMax };
  f.sanidade = { max: d.sanidadeMax, atual: d.sanidadeMax };
  f.humanidade = { max: d.humanidadeMax, atual: d.humanidadeLimite };
  return f;
}

// Relatório de uma ficha de teste: problemas de pontos e o que pode dar problema nas habilidades.
export function relatorioFicha(f, sistema, campanha = null) {
  const avisos = [];
  for (const x of problemasFicha(f, sistema, campanha)) avisos.push(`Pontos: ${x}`);
  const ganhos = ganhosDeClasse(f, sistema);
  for (const g of ganhos) {
    if (/vantagem extra|^\+\d|atributo/i.test(g.nome)) continue;
    if (!g.descricao) avisos.push(`Nível ${g.nivel}: "${g.nome}" não tem texto no livro (o app não acha a descrição).`);
  }
  const habs = listaHabilidades(f, sistema);
  const lembretes = habs.filter(x => !efeitosHabilidade(f, sistema, x).notas.length).map(x => x.nome);
  return { avisos, ganhos: ganhos.map(g => `${g.nivel}: ${g.nome}`), lembretes, comEfeito: habs.length - lembretes.length, total: habs.length };
}

export function fichasDeTeste(sistema, nivel = 6, campanha = null) {
  return (sistema.classes || []).flatMap(c => (c.especializacoes?.length ? [c.especializacoes[0]] : [null]).map(e => fichaDeTeste(sistema, c, e, nivel, campanha)));
}

// Kit das fichas de teste (autor, 24/10; 3000 créditos desde 25/10): até 3000 créditos em itens do catálogo, já para equipar: duas armas com a cara
// da classe (a principal e uma do outro tipo), armadura, capacete e consumíveis. Só itens comuns que a ficha pode usar
// (requisitos de nível e atributo).
const media = dano => { const m = /^(\d*)d(\d+)([+-]\d+)?/i.exec(String(dano || '').replace(/\s+/g, '')); return m ? (Number(m[1] || 1) * (Number(m[2]) + 1)) / 2 + Number(m[3] || 0) : 0; };
const COMUNS = ['Comum', 'Incomum', 'Mundano'];
const TEMAS = {
  cacador: ['armas-de-fogo.cano-longo', 'arma-branca.lanca'], ciborgue: ['armas-de-fogo.rifle-de-assalto', 'arma-branca.martelo'],
  encantado: ['armas-de-fogo.pistolas', 'arma-branca.laminas-curtas'], inventor: ['armas-de-fogo.pistolas', 'arma-branca.improvisada'],
  mutante: ['arma-branca.machado', 'armas-de-fogo.projeteis'], perito: ['armas-de-fogo.pistolas', 'arma-branca.bastao'],
  soldado: ['armas-de-fogo.rifle-de-assalto', 'arma-branca.laminas-curtas'], sortudo: ['armas-de-fogo.pistolas', 'arma-branca.laminas-curtas'],
  transmorfo: ['arma-branca.laminas-curtas', 'armas-de-fogo.projeteis'], treinador: ['arma-branca.chicote', 'armas-de-fogo.projeteis'],
};
const semAc = t => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const ORCAMENTO_KIT_TESTE = 3000;
export function kitDeTeste(sistema, ficha, orcamento = ORCAMENTO_KIT_TESTE) {
  const d = derivados(ficha, sistema);
  const atende = i => [...String(i.requisitos || '').matchAll(/([A-ZÇ]{2,5}|N[íi]vel)\s*(\d+)/gi)].every(([, k, v]) =>
    /n[íi]vel/i.test(k) ? (ficha.nivel || 1) >= Number(v) : (d.atributos?.[k.toUpperCase()] ?? 99) >= Number(v));
  // Com orçamento maior (3000), armas e proteção podem ser raras; o resto continua comum.
  const raridades = orcamento >= 2500 ? [...COMUNS, 'Raro'] : COMUNS;
  const itens = (sistema.itens || []).filter(i => i.preco > 0 && atende(i) && (COMUNS.includes(i.raridade) || (raridades.includes(i.raridade) && ['arma', 'defesa', 'vestimenta'].includes(i.tipo))));
  let resto = orcamento;
  const kit = [];
  const pegar = i => { if (i && i.preco <= resto) { kit.push(i); resto -= i.preco; return i; } return null; };
  const melhor = (lista, nota) => lista.sort((a, b) => nota(b) - nota(a) || a.preco - b.preco)[0];
  const classe = (sistema.classes || []).find(c => c.id === ficha.classe);
  const tema = TEMAS[semAc(classe?.nome)] || ['arma-branca.laminas-curtas', 'armas-de-fogo.pistolas'];
  const armas = itens.filter(i => i.tipo === 'arma' && i.slot === 'maos' && i.dano && /^(arma-branca|armas-de-fogo)\./.test(i.pericia || ''));
  const daPericia = (per, max, ocupa = 2) => melhor(armas.filter(i => i.pericia === per && i.preco <= max && (i.ocupa ?? 1) <= ocupa), i => media(i.dano))
    || melhor(armas.filter(i => i.pericia?.split('.')[0] === per.split('.')[0] && i.preco <= max && (i.ocupa ?? 1) <= ocupa), i => media(i.dano));
  // Proporções do orçamento: arma principal até ~40%, a segunda até ~25%, a proteção com o que sobrar.
  const principal = pegar(daPericia(tema[0], orcamento * 0.4, 1) || daPericia(tema[0], orcamento * 0.4));
  if ((principal?.ocupa ?? 1) < 2) pegar(daPericia(tema[1], Math.min(orcamento * 0.25, resto - orcamento * 0.3), 1));
  // Armadura e capacete: o maior IP que couber.
  const ip = i => { const r = ipDoItem(i); return r.geral + Object.values(r.tipos).reduce((s, v) => s + v, 0) / 2; };
  const protecao = slot => itens.filter(i => i.slot === slot && ['defesa', 'vestimenta'].includes(i.tipo) && /\bIP\b/.test(i.efeitos || ''));
  pegar(melhor(protecao('corpo').filter(i => i.preco <= resto - 150), ip));
  pegar(melhor(protecao('cabeca').filter(i => i.preco <= Math.min(orcamento * 0.2, resto - 100)), ip));
  // Consumíveis: curativos, kit médico e comida, enquanto houver dinheiro.
  for (const re of [/bandagem|atadura/i, /kit de primeiros socorros|kit m[ée]dico/i, /^ra[çc][ãa]o (?!canina)|enlatad|carne seca/i, /bandagem|atadura/i]) {
    pegar(itens.filter(i => re.test(i.nome) && ['boticario', 'alimento', 'ferramenta'].includes(i.tipo) && i.preco <= resto).sort((a, b) => b.preco - a.preco)[0]);
  }
  // Equipamento de exploração com o que sobrar (um de cada): luz, corda, mochila, cantil, faca utilitária…
  const ruim = /suj[ao]|[úu]mid[ao]|quebrad|sem corda|vencid|enferruj|podre|furad/i;
  for (const re of [/^lanterna|^tocha|^lampi/i, /^corda/i, /^mochila/i, /^cantil|filtro de [áa]gua/i, /^canivete|multiferramenta|^kit de ferramentas/i, /^isqueiro|^f[óo]sforo|pederneira/i, /^saco de dormir|^barraca/i, /^b[úu]ssola/i]) {
    pegar(itens.filter(i => re.test(i.nome) && !ruim.test(i.nome) && !kit.includes(i) && !['arma', 'municao'].includes(i.tipo) && i.preco <= resto).sort((a, b) => b.preco - a.preco)[0]);
  }
  return kit;
}

// Perícias das fichas de teste (autor, 25/10): as armas equipadas do kit, a Esquiva e as perícias do tema da classe,
// dentro do limite (5 + 5 × nível) e dos pontos de perícia da ficha. Subperícia custa 1 ponto por ponto e perícia
// base custa 3 (6 nas de combate), então os pontos vão quase todos nas subperícias.
const PERICIAS_CLASSE = {
  cacador: ['armadilhas.armar', 'sobrevivencia.rastreio', 'sentidos.visao', 'espionagem.furtividade', 'armadilhas.encontrar', 'sobrevivencia.esfolamento'],
  ciborgue: ['computacao.interface-neural', 'sentidos.visao', 'engenharia.mecanica', 'esportes.corrida', 'computacao.operacional', 'briga.ataque-desarmado'],
  encantado: ['manipulacao.labia', 'manipulacao.empatia', 'manipulacao.lideranca', 'institucional.politica', 'manipulacao.etiqueta', 'sentidos.visao'],
  inventor: ['engenharia.mecanica', 'engenharia.eletrica', 'computacao.programacao', 'avaliacao-de-objetos.identificacao', 'engenharia.quimica', 'sentidos.visao'],
  mutante: ['briga.ataque-desarmado', 'sobrevivencia.ambiental', 'esportes.corrida', 'sentidos.olfato', 'manipulacao.intimidacao', 'esportes.escalada'],
  perito: ['medicina.primeiros-socorros', 'medicina.cirurgica', 'medicina.farmaceutica', 'sentidos.visao', 'medicina.genetica', 'manipulacao.empatia'],
  soldado: ['manipulacao.lideranca', 'engenharia.militar', 'sentidos.visao', 'esportes.corrida', 'briga.ataque-desarmado', 'medicina.primeiros-socorros'],
  sortudo: ['jogos.sorte', 'jogos.dados', 'avaliacao-de-objetos.negociacao', 'espionagem.furtar', 'manipulacao.labia', 'sentidos.visao'],
  transmorfo: ['briga.ataque-desarmado', 'sentidos.olfato', 'esportes.corrida', 'sobrevivencia.rastreio', 'manipulacao.intimidacao', 'esportes.salto'],
  treinador: ['trato-de-animais.treinamento-adestrar', 'trato-de-animais.doma', 'trato-de-animais.zoologia', 'manipulacao.lideranca', 'trato-de-animais.montaria', 'sentidos.visao'],
};
export function periciasDeTeste(sistema, ficha, campanha = null) {
  const subsValidas = new Set(sistema.pericias.flatMap(p => p.subpericias.map(s => s.id)));
  const L = limitePericia(ficha.nivel, sistema);
  let pontos = pontosPericiaTotal(ficha, sistema, campanha);
  const classe = (sistema.classes || []).find(c => c.id === ficha.classe);
  const armas = [...new Set((ficha.itens || []).filter(i => i.equipado && i.tipo === 'arma' && i.pericia).map(i => i.pericia))];
  // [subperícia, parte do limite]: armas e Esquiva no limite; tema da classe: 2 no limite, 2 em 75%, o resto em 50%.
  const lista = [...armas.map(id => [id, 1]), ['briga.esquiva', 1],
    ...(PERICIAS_CLASSE[semAc(classe?.nome)] || []).map((id, i) => [id, i < 2 ? 1 : i < 4 ? 0.75 : 0.5]), ['briga.evasao', 0.5], ['sentidos.audicao', 0.5]];
  const subpericias = {};
  for (const [id, parte] of lista) {
    if (!subsValidas.has(id) || id in subpericias || pontos <= 0) continue;
    const v = Math.min(Math.round(L * parte), pontos);
    subpericias[id] = v;
    pontos -= v;
  }
  return { pericias: {}, subpericias };
}
