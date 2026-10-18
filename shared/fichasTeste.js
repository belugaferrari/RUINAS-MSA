// Fichas de teste: um personagem de nível alto para cada classe/especialização, montado com as regras de pontos,
// e um relatório do que pode dar problema nas habilidades (ganho sem texto, vantagem que o app não entende…).
import { novaFicha, pontosDoNivel, pontosPericiaTotal, pontosVantagemExtra, atributoMax, limitePericia, custoPericiaBase,
  vantagensDisponiveis, problemasFicha, ganhosDeClasse, listaHabilidades, efeitosHabilidade, derivados } from './regras.js';

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
