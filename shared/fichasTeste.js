// Fichas de teste: um personagem de nível alto para cada classe/especialização, montado com as regras de pontos,
// e um relatório do que pode dar problema nas habilidades (ganho sem texto, vantagem que o app não entende…).
import { novaFicha, pontosDoNivel, pontosPericiaTotal, pontosVantagemExtra, atributoMax, limitePericia, custoPericiaBase,
  vantagensDisponiveis, problemasFicha, ganhosDeClasse, listaHabilidades, efeitosHabilidade, derivados, ipDoItem } from './regras.js';
import { AVATARES } from './avatares.js';

// Fichas de teste (autor, 28/10): uma por especialização de cada classe, cada uma com atributos, perícias, profissão,
// vantagens, gênero, nome e avatar próprios — distribuídos pelo tema da classe e pelo texto da especialização.
const PESOS_CLASSE = {
  cacador: { AGI: 3, PER: 3, DES: 2, CONS: 2, FOR: 2, WILL: 1, INT: 1, CAR: 1 },
  ciborgue: { FOR: 3, CONS: 3, INT: 2, DES: 2, AGI: 1, PER: 1, WILL: 1, CAR: 1 },
  encantado: { CAR: 3, WILL: 2, PER: 2, INT: 2, AGI: 1, DES: 1, CONS: 1, FOR: 1 },
  inventor: { INT: 3, DES: 3, PER: 2, WILL: 1, CONS: 1, AGI: 1, FOR: 1, CAR: 1 },
  mutante: { CONS: 3, FOR: 3, WILL: 2, AGI: 1, PER: 1, DES: 1, INT: 1, CAR: 1 },
  perito: { INT: 3, DES: 2, PER: 2, WILL: 2, CAR: 1, CONS: 1, AGI: 1, FOR: 1 },
  soldado: { FOR: 2, CONS: 2, AGI: 2, DES: 2, PER: 2, WILL: 1, INT: 1, CAR: 1 },
  sortudo: { AGI: 2, CAR: 2, PER: 2, DES: 2, WILL: 2, INT: 1, CONS: 1, FOR: 1 },
  transmorfo: { FOR: 3, AGI: 3, CONS: 2, PER: 2, WILL: 1, DES: 1, INT: 1, CAR: 1 },
  treinador: { CAR: 2, PER: 2, WILL: 2, AGI: 2, INT: 2, CONS: 1, FOR: 1, DES: 1 },
};
const NOMES_ATR = { FOR: /\bfor(ca)?\b/g, CONS: /\bcons(tituicao)?\b/g, AGI: /\bagi(lidade)?\b/g, DES: /\bdes(treza)?\b/g, INT: /\bint(eligencia)?\b/g, PER: /\bper(cepcao)?\b/g, CAR: /\bcar(isma)?\b/g, WILL: /\bwill\b|\bvontade\b/g };
const NOMES_TESTE = {
  masculino: ['Kael Ferro', 'Bruno Sal', 'Dimas Rocha', 'Iago Brasa', 'Teo Corvo', 'Ravi Lodo', 'Caio Névoa', 'Otto Ferrugem', 'Davi Maré', 'Lino Cardo', 'Ícaro Pó', 'Joel Sucata', 'Rui Tormenta', 'Vasco Âncora', 'Nilo Cinza', 'Gael Breu', 'Heitor Lume', 'Breno Vento', 'Saulo Coral', 'Enzo Faísca'],
  feminino: ['Lia Maré', 'Zara Névoa', 'Helga Breu', 'Nara Lume', 'Iara Coral', 'Tess Ferrugem', 'Maya Brasa', 'Olga Vento', 'Rita Sal', 'Yara Corvo', 'Bia Lodo', 'Cora Faísca', 'Elis Cinza', 'Luna Rocha', 'Dora Âncora', 'Ada Tormenta', 'Mel Cardo', 'Íris Pó', 'Vera Sucata', 'Lara Ferro'],
};
// Gerador com semente: a mesma especialização sai sempre igual, e cada uma sai diferente.
function sorteador(semente) {
  let x = 0;
  for (const ch of String(semente)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}
const embaralhar = (lista, rnd) => lista.map(v => [rnd(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
const textoEsp = (classe, esp) => semAc([esp?.descricao, ...(esp?.habilidades || []).map(h => `${h.nome} ${h.descricao}`)].join(' '));

// Subperícias citadas no texto da especialização ("Manipulação[Lábia]", "Briga [Deslocar/Derrubar]").
export function subpericiasDaEspecializacao(sistema, classe, esp) {
  const t = textoEsp(classe, esp);
  const achadas = [];
  for (const p of sistema.pericias) {
    for (const m of t.matchAll(new RegExp(`${semAc(p.nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\[([^\\]]+)\\]`, 'g'))) {
      for (const parte of m[1].split(/[\/,]| ou /)) {
        const sub = p.subpericias.find(sp => semAc(sp.nome) === parte.trim() || semAc(sp.nome).startsWith(parte.trim().slice(0, 6)));
        if (sub && !achadas.includes(sub.id)) achadas.push(sub.id);
      }
    }
  }
  // Depois, as subperícias citadas pelo nome no texto ("rastrear", "intimidação", "furtividade"…).
  for (const p of sistema.pericias) for (const sp of p.subpericias) {
    const n = semAc(sp.nome);
    if (n.length >= 6 && !['ataque desarmado', 'investida', 'escudo'].includes(n) && t.includes(n.slice(0, Math.max(6, n.length - 2))) && !achadas.includes(sp.id)) achadas.push(sp.id);
  }
  return achadas.slice(0, 6);
}

export function fichaDeTeste(sistema, classe, esp, nivel = 6, campanha = null, { indice = 0, usados = {} } = {}) {
  const f = novaFicha(sistema, campanha);
  const rnd = sorteador(`${classe.id}/${esp?.id || ''}`);
  const chaveClasse = semAc(classe.nome);
  const genero = indice % 2 === 0 ? 'masculino' : 'feminino';
  // Nome sem "Teste": um nome da lista que ainda não saiu nesta leva.
  const nomes = NOMES_TESTE[genero].filter(n => !(usados.nomes ||= new Set()).has(n));
  const nome = nomes[Math.floor(rnd() * nomes.length)] || `${classe.nome} ${indice + 1}`;
  usados.nomes.add(nome);
  // Avatar da especialização (Armadilheiro, Galante…), do gênero da ficha quando houver.
  const doGrupo = AVATARES.filter(a => a.grupo === chaveClasse);
  const pal = semAc(esp?.nome || '').replace(/[()]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const daEsp = doGrupo.filter(a => pal.some(w => semAc(a.nome).includes(w.slice(0, 6)) || semAc(a.id).includes(w.slice(0, 6))));
  const avatar = [...daEsp.filter(a => a.genero === genero), ...daEsp, ...doGrupo.filter(a => a.genero === genero), ...doGrupo][0];
  const subsEsp = subpericiasDaEspecializacao(sistema, classe, esp);
  const temaPer = [...subsEsp, ...(PERICIAS_CLASSE[chaveClasse] || [])];
  // Profissão: a que mais combina com as perícias da classe e da especialização, variando entre as fichas.
  const usadasProf = usados.profissoes ||= {};
  const profissao = [...(sistema.profissoes || [])].map(p => ({ p, nota: (p.subpericias || []).filter(id => temaPer.includes(id)).length * 2 - (usadasProf[p.id] || 0) + rnd() }))
    .sort((a, b) => b.nota - a.nota)[0]?.p;
  if (profissao) usadasProf[profissao.id] = (usadasProf[profissao.id] || 0) + 1;
  const instintos = sistema.instintos || [];
  Object.assign(f, {
    nome, nivel, classe: classe.id, especializacao: esp?.id || '', fichaTeste: true,
    profissao: profissao?.id || '', genero, atracao: [genero === 'masculino' ? 'feminino' : 'masculino'],
    instinto: instintos.length ? instintos[Math.floor(rnd() * instintos.length)].nome : '',
    foto: avatar?.url || '', avatar: avatar?.id || '',
    background: `${classe.nome}${esp ? ` — ${esp.nome}` : ''}. Ficha de teste gerada pelo app (atributos, perícias e vantagens pelo tema da especialização).`,
  });
  // Atributos: o orçamento do nível pelos pesos da classe, mais os atributos que a especialização cita, com um pouco de sorte.
  const siglas = sistema.atributos.map(a => a.sigla);
  const pts = pontosDoNivel(nivel, sistema, campanha, f);
  const max = atributoMax(nivel, sistema);
  const t = textoEsp(classe, esp);
  const pesos = Object.fromEntries(siglas.map(sg => [sg, (PESOS_CLASSE[chaveClasse]?.[sg] ?? 1) + Math.min(2, (t.match(NOMES_ATR[sg]) || []).length * 0.5) + rnd() * 0.8]));
  const piso = Math.min(8, Math.floor(pts.atributos / siglas.length) - 2);
  f.atributos = Object.fromEntries(siglas.map(sg => [sg, piso]));
  let resto = pts.atributos - piso * siglas.length;
  while (resto > 0) {
    const sg = siglas.filter(x => f.atributos[x] < max).sort((a, b) => pesos[b] / (f.atributos[b] + 1) - pesos[a] / (f.atributos[a] + 1))[0];
    if (!sg) break;
    f.atributos[sg]++;
    resto--;
  }
  // Um defeito leve (obrigatório), sorteado.
  const leves = (sistema.defeitos || []).filter(d => d.tipo === 'leve');
  f.defeitos = leves.length ? [leves[Math.floor(rnd() * leves.length)].id] : [];
  // Vantagens: as da classe que citam perícias do tema primeiro, depois as outras (ordem sorteada), até acabar o orçamento.
  let pv = pontosDoNivel(nivel, sistema, campanha, f).vantagens + pontosVantagemExtra(f, sistema);
  const nomesTema = temaPer.map(id => semAc(sistema.pericias.flatMap(p => p.subpericias).find(x => x.id === id)?.nome || '')).filter(Boolean);
  const nota = v => (v.origem === 'Geral' ? 0 : 2) + (nomesTema.some(n => semAc(v.descricao).includes(n)) ? 2 : 0) + rnd();
  f.vantagens = [];
  for (const v of embaralhar(vantagensDisponiveis(f, sistema), rnd).sort((a, b) => nota(b) - nota(a))) {
    const custo = v.custo ?? 1;
    if (custo <= pv) { f.vantagens.push(v.id); pv -= custo; }
    if (pv <= 0) break;
  }
  f.pericias = {};
  f.subpericias = {};
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

// Uma ficha por especialização de cada classe (3 por classe).
export function fichasDeTeste(sistema, nivel = 6, campanha = null) {
  const usados = {};
  let indice = 0;
  return (sistema.classes || []).flatMap(c => (c.especializacoes?.length ? c.especializacoes : [null]).map(e => fichaDeTeste(sistema, c, e, nivel, campanha, { indice: indice++, usados })));
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
  // Raridade sem ligar para acento/maiúscula; item sem preço na planilha conta como 0. Se o catálogo do mestre não tiver
  // raridade nem preço (ou nada passar no filtro), o kit usa o catálogo todo — melhor que a ficha ficar sem itens (autor, 27/10).
  const comuns = COMUNS.map(semAc);
  const raridades = orcamento >= 2500 ? [...comuns, 'raro'] : comuns;
  const custo = i => Math.max(0, Number(i.preco) || 0);
  const filtrados = (sistema.itens || []).map(i => ({ ...i, preco: custo(i) })).filter(i => atende(i) && (comuns.includes(semAc(i.raridade)) || (raridades.includes(semAc(i.raridade)) && ['arma', 'defesa', 'vestimenta'].includes(i.tipo))));
  const temArma = l => l.some(i => i.tipo === 'arma' && i.slot === 'maos' && i.dano);
  const itens = temArma(filtrados) ? filtrados : (sistema.itens || []).map(i => ({ ...i, preco: custo(i) }));
  let resto = orcamento;
  const kit = [];
  const pegar = i => { if (i && i.preco <= resto) { kit.push(i); resto -= i.preco; return i; } return null; };
  const melhor = (lista, nota) => lista.sort((a, b) => nota(b) - nota(a) || a.preco - b.preco)[0];
  const classe = (sistema.classes || []).find(c => c.id === ficha.classe);
  const temaClasse = TEMAS[semAc(classe?.nome)] || ['arma-branca.laminas-curtas', 'armas-de-fogo.pistolas'];
  // A especialização que cita uma arma (Armas de Fogo [Pistolas]…) usa ela como principal.
  const armaEsp = classe ? subpericiasDaEspecializacao(sistema, classe, classe.especializacoes?.find(e => e.id === ficha.especializacao)).find(id => /^(arma-branca|armas-de-fogo)\./.test(id)) : null;
  const tema = armaEsp ? [armaEsp, temaClasse.find(t => t.split('.')[0] !== armaEsp.split('.')[0]) || temaClasse[1]] : temaClasse;
  const armas = itens.filter(i => i.tipo === 'arma' && i.slot === 'maos' && i.dano && /^(arma-branca|armas-de-fogo)\./.test(i.pericia || ''));
  // Entre as 3 melhores armas da perícia, uma sorteada pela especialização (fichas da mesma classe não saem iguais).
  const rndArma = sorteador(`${ficha.especializacao || ficha.nome}:armas`);
  const umaDasMelhores = (lista, nota) => { const ord = lista.sort((a, b) => nota(b) - nota(a) || a.preco - b.preco); return ord[Math.floor(rndArma() * Math.min(3, ord.length))]; };
  const daPericia = (per, max, ocupa = 2) => umaDasMelhores(armas.filter(i => i.pericia === per && i.preco <= max && (i.ocupa ?? 1) <= ocupa), i => media(i.dano))
    || umaDasMelhores(armas.filter(i => i.pericia?.split('.')[0] === per.split('.')[0] && i.preco <= max && (i.ocupa ?? 1) <= ocupa), i => media(i.dano));
  // Proporções do orçamento: arma principal até ~40%, a segunda até ~25%, a proteção com o que sobrar.
  const principal = pegar(daPericia(tema[0], orcamento * 0.4, 1) || daPericia(tema[0], orcamento * 0.4));
  if ((principal?.ocupa ?? 1) < 2) pegar(daPericia(tema[1], Math.min(orcamento * 0.25, resto - orcamento * 0.3), 1));
  // Armadura e capacete: o maior IP que couber.
  const ip = i => { const r = ipDoItem(i); return r.geral + Object.values(r.tipos).reduce((s, v) => s + v, 0) / 2; };
  // Proteção sem ônus (nada de máscara que tira 30% de Percepção).
  const semOnus = i => !Object.values(i.bonus || {}).some(v => v < 0);
  const protecao = slot => itens.filter(i => i.slot === slot && ['defesa', 'vestimenta'].includes(i.tipo) && /\bIP\b/.test(i.efeitos || '') && semOnus(i));
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
  // Especialização: as subperícias que o texto dela cita vêm antes das da classe (cada especialização sai diferente).
  const esp = classe?.especializacoes?.find(e => e.id === ficha.especializacao);
  const daEsp = classe ? subpericiasDaEspecializacao(sistema, classe, esp) : [];
  const daProf = (sistema.profissoes || []).find(x => x.id === ficha.profissao)?.subpericias || [];
  const lista = [...armas.map(id => [id, 1]), ['briga.esquiva', 1], ...daEsp.map((id, i) => [id, i < 2 ? 1 : 0.75]),
    ...embaralhar(PERICIAS_CLASSE[semAc(classe?.nome)] || [], sorteador(ficha.especializacao || ficha.nome)).map((id, i) => [id, i < 2 ? 0.9 : i < 4 ? 0.7 : 0.5]), ...daProf.map(id => [id, 0.5]), ['briga.evasao', 0.5], ['sentidos.audicao', 0.5]];
  const subpericias = {};
  for (const [id, parte] of lista) {
    if (!subsValidas.has(id) || id in subpericias || pontos <= 0) continue;
    const v = Math.min(Math.round(L * parte), pontos);
    subpericias[id] = v;
    pontos -= v;
  }
  return { pericias: {}, subpericias };
}
