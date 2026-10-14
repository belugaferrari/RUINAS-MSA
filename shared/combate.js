// Combate e regras sociais automatizadas (Livro MSS). Só valem quando o sistema da campanha liga
// "modulos.combate" / "modulos.social". Escolhas provisórias estão em conteudo/sistemas/PENDENCIAS.md.
import { rolarDado, derivados } from './regras.js';

const d100 = rng => 1 + Math.floor(rng() * 100);

// Vantagem e desvantagem se anulam. Com vantagem rola 2d100 e fica com o maior; com desvantagem, o menor.
export function modoRolagem(vantagem, desvantagem) {
  if (vantagem && !desvantagem) return 'vantagem';
  if (desvantagem && !vantagem) return 'desvantagem';
  return null;
}

export function rolarDP(modo, rng = Math.random) {
  const a = d100(rng);
  if (!modo) return { dp: a, dados: [a] };
  const b = d100(rng);
  return { dp: modo === 'vantagem' ? Math.max(a, b) : Math.min(a, b), dados: [a, b] };
}

// Teste contra um valor fixo (ND ou ação passiva), com críticos do D-MIL.
export function testeContra(acao, nd, sistema, { modo = null, rng = Math.random } = {}) {
  const t = sistema.teste;
  const { dp, dados } = rolarDP(modo, rng);
  const ds = 1 + Math.floor(rng() * 10);
  const total = acao + dp;
  const critico = dp >= t.criticoAcerto ? 'acerto' : dp <= t.criticoErro ? 'erro' : null;
  const sucesso = critico === 'acerto' ? true : critico === 'erro' ? false : total >= nd;
  return { dp, dados, ds, acao, total, nd, sucesso, critico, modo };
}

export const humorDe = (p, sistema) => (sistema.social?.humores || []).find(h => h.id === (p?.humor || 'neutro')) || null;

// Bônus geral de testes pelo humor (Apático, Confiante…). Só no sistema com módulo social.
export const modHumorTestes = (p, sistema) => (sistema.modulos?.social ? humorDe(p, sistema)?.testes || 0 : 0);

// ---------- Combate ----------

const tem = (p, nome) => (p?.marcadores || []).some(m => String(m).toLowerCase().startsWith(nome.toLowerCase()));

// Armas que o personagem pode usar agora: as equipadas, mais o ataque desarmado.
export function armasDisponiveis(p, sistema) {
  const cfg = sistema.combate;
  const armas = (p.itens || []).filter(i => i.equipado && i.tipo === 'arma' && i.dano).map(i => ({
    uid: i.uid, nome: i.nome, dano: i.dano, pericia: i.pericia || null, tipoDano: i.tipoDano || 'Físico',
    efeitoDano: i.efeitoDano ?? cfg.efeitoPadrao, alcance: i.alcance || (i.pericia?.startsWith('armas-de-fogo') ? 'distancia' : 'corpo'),
  }));
  return [{ uid: 'desarmado', efeitoDano: cfg.efeitoPadrao, ...cfg.desarmado }, ...armas];
}

// Defesa passiva provisória: a melhor defesa que o alvo pode usar + 50.
// Esquiva vale sempre; Defesa desarmada só contra ataque desarmado; Defesa armada (subperícia da arma branca empunhada) só contra corpo a corpo.
export function defesaDoAlvo(alvo, arma, sistema, { cobertura = false } = {}) {
  const cfg = sistema.combate;
  const d = derivados(alvo, sistema);
  const opcoes = [{ nome: 'Esquiva', valor: d.subpericias['briga.esquiva'] ?? 0 }];
  if (arma.uid === 'desarmado') opcoes.push({ nome: 'Defesa desarmada', valor: d.subpericias['briga.defesa-desarmada'] ?? 0 });
  if (arma.alcance === 'corpo') {
    for (const a of armasDisponiveis(alvo, sistema)) {
      if (a.uid === 'desarmado' || !a.pericia?.startsWith('arma-branca.') || cfg.semDefesaArmada.includes(a.pericia)) continue;
      opcoes.push({ nome: `Defesa armada (${a.nome})`, valor: d.subpericias[a.pericia] ?? 0 });
    }
  }
  const melhor = opcoes.reduce((m, o) => (o.valor > m.valor ? o : m));
  const partes = [{ nome: melhor.nome, valor: melhor.valor }, { nome: 'passiva', valor: cfg.defesaPassiva }];
  const caidoDistancia = arma.alcance === 'distancia' && tem(alvo, 'Caído');
  if (arma.alcance === 'distancia' && (cobertura || caidoDistancia)) partes.push({ nome: 'cobertura parcial', valor: cfg.coberturaParcial });
  const humor = sistema.modulos?.social ? humorDe(alvo, sistema) : null;
  if (humor?.defesa) partes.push({ nome: humor.nome, valor: humor.defesa });
  return { total: partes.reduce((s, x) => s + x.valor, 0), partes };
}

// Valor do D6 de vida atual (os 5 primeiros PV ficam à parte; dali para cima conta-se em D6).
export function d6Atual(pv) {
  if (pv <= 5) return 0;
  return ((pv - 6) % 6) + 1;
}

// Resolve um ataque completo: acerto × defesa, dano − IP, efeito pelo DS. Não altera nada: devolve o que aplicar.
// op: { armaUid, danoLivre, localizado, duasArmas: 'principal'|'inabil', sacrificio, surpresa, elevado, cobertura, vantagem, desvantagem, mod }
export function resolverAtaque(atacante, alvo, sistema, op = {}, rng = Math.random) {
  const cfg = sistema.combate;
  let arma = armasDisponiveis(atacante, sistema).find(a => a.uid === (op.armaUid || 'desarmado'));
  if (!arma) throw new Error('Arma não equipada.');
  if (op.danoLivre) {
    rolarDado(op.danoLivre); // valida a expressão
    arma = { ...arma, nome: `${arma.nome} (dano ${op.danoLivre})`, dano: op.danoLivre };
  }
  const da = derivados(atacante, sistema);
  const pericia = arma.pericia || 'briga.ataque-desarmado';
  const mods = [];
  const add = (nome, valor) => valor && mods.push({ nome, valor });
  add('localizado', op.localizado ? cfg.localizado.mod : 0);
  if (op.duasArmas) add(op.duasArmas === 'inabil' ? 'mão inábil' : 'duas armas', cfg.duasArmas[op.duasArmas] || 0);
  add('Sacrifício', op.sacrificio ? cfg.sacrificio.mod : 0);
  add('humor', modHumorTestes(atacante, sistema));
  add('modificador', Math.max(-100, Math.min(100, parseInt(op.mod, 10) || 0)));
  const acao = (da.subpericias[pericia] ?? 0) + mods.reduce((s, m) => s + m.valor, 0);

  const hA = sistema.modulos?.social ? humorDe(atacante, sistema) : null;
  const motivosV = [], motivosD = [];
  if (op.vantagem) motivosV.push('mestre');
  if (op.surpresa) motivosV.push('ataque surpresa');
  if (op.elevado) motivosV.push('terreno elevado');
  if (arma.alcance === 'corpo' && tem(alvo, 'Caído')) motivosV.push('alvo caído');
  if (tem(alvo, 'Aturdido') || tem(alvo, 'Imobilizado')) motivosV.push('alvo aturdido/imobilizado');
  if (hA?.vantagemAtaque) motivosV.push(hA.nome);
  if (op.desvantagem) motivosD.push('mestre');
  if (tem(atacante, 'Caído')) motivosD.push('atacante caído');
  if (tem(atacante, 'Aturdido')) motivosD.push('atacante aturdido');
  if (hA?.desvantagemAtaque) motivosD.push(hA.nome);
  const modo = modoRolagem(motivosV.length > 0, motivosD.length > 0);

  const defesa = defesaDoAlvo(alvo, arma, sistema, { cobertura: !!op.cobertura });
  const teste = testeContra(acao, defesa.total, sistema, { modo, rng });
  const r = {
    arma: arma.nome, pericia, acao, mods, defesa, ...teste, motivosVantagem: motivosV, motivosDesvantagem: motivosD,
    dano: 0, danoBruto: 0, danoPartes: [], ip: 0, efeito: null, perdaSacrificio: 0, naoLetal: arma.tipoDano === 'Não letal',
  };
  // Sacrifício: perde o D6 atual de vida mesmo errando (abandona a razão no ataque).
  if (op.sacrificio) r.perdaSacrificio = d6Atual(atacante.pv?.atual ?? 0);
  if (!teste.sucesso) return r;

  const partes = [];
  const rolar = (nome, expr) => { const x = rolarDado(expr, rng); partes.push({ nome, expr, dados: x.dados, total: x.total }); };
  rolar(arma.nome, arma.dano);
  if (teste.critico === 'acerto') {
    const m = /d(\d+)/i.exec(arma.dano);
    if (m) rolar('crítico', `1d${m[1]}`);
  }
  if (op.localizado) rolar('localizado', cfg.localizado.dano);
  if (arma.alcance === 'corpo' && da.mod.FOR) partes.push({ nome: 'MOD FOR', total: da.mod.FOR });
  if (r.perdaSacrificio) partes.push({ nome: 'Sacrifício', total: r.perdaSacrificio });
  r.danoPartes = partes;
  r.danoBruto = partes.reduce((s, p) => s + p.total, 0);
  r.ip = cfg.ignoramIP.includes(arma.tipoDano) ? 0 : derivados(alvo, sistema).defesa;
  r.dano = Math.max(cfg.danoMinimo, r.danoBruto - r.ip);
  if (tem(alvo, 'Queimadura')) { r.dano += 1; r.queimadura = true; }
  const efeito = cfg.efeitosPorTipo[arma.tipoDano];
  if (efeito && teste.ds <= arma.efeitoDano) r.efeito = efeito;
  return r;
}

// Aplica o resultado no alvo: PV, desmaio, morte e marcador do efeito de dano.
export function aplicarAtaque(atacante, alvo, r) {
  const marcar = m => { if (!(alvo.marcadores ||= []).includes(m)) alvo.marcadores.push(m); };
  if (r.perdaSacrificio) atacante.pv.atual -= r.perdaSacrificio;
  if (!r.sucesso) return [];
  const notas = [];
  const antes = alvo.pv.atual;
  alvo.pv.atual -= r.dano;
  if (r.efeito) { marcar(r.efeito); notas.push(r.efeito); }
  if (antes < 0 && !r.naoLetal) { marcar('Morto'); notas.push('morto (dano com PV negativo)'); }
  else if (alvo.pv.atual <= 0 && antes > 0) { marcar('Desmaiado'); notas.push(r.naoLetal ? 'desmaiado (não letal)' : 'desmaiado'); }
  return notas;
}

// Sobrevida: no turno de quem está abaixo de 0 PV (e não estabilizado), perde 1 PV; morre ao passar do limite da CONS.
export function sobrevida(p, sistema) {
  if (!p.pv || p.pv.atual >= 0 || tem(p, 'Morto') || tem(p, 'Estabilizado')) return null;
  p.pv.atual -= 1;
  const cons = derivados(p, sistema).atributos.CONS ?? 10;
  if (p.pv.atual <= -cons) {
    (p.marcadores ||= []).push('Morto');
    return `${p.nome} perdeu 1 PV (sobrevida) e morreu.`;
  }
  return `${p.nome} perdeu 1 PV (sobrevida): ${p.pv.atual}. Estabilize com Medicina [Primeiros Socorros] ND ${50 + 10 * -p.pv.atual}.`;
}

// Iniciativa = AGI + 1d10, com vantagem pelo humor (Corajoso, Amedrontado, Enojado).
export function rolarIniciativa(p, sistema, rng = Math.random) {
  const agi = derivados(p, sistema).iniciativa;
  const h = sistema.modulos?.social ? humorDe(p, sistema) : null;
  const a = 1 + Math.floor(rng() * 10);
  const dados = [a];
  if (h?.vantagemIniciativa) dados.push(1 + Math.floor(rng() * 10));
  return { total: agi + Math.max(...dados), agi, dados, vantagem: !!h?.vantagemIniciativa };
}

// ---------- Social ----------

// Resistência à Manipulação (provisória): WILL% + 50 + ajustes do humor.
export function resistenciaManipulacao(p, sistema) {
  const d = derivados(p, sistema);
  const base = d.percentual[sistema.social?.resistenciaBase || 'WILL'] ?? 0;
  const h = humorDe(p, sistema);
  return base + (sistema.teste.passiva?.soma ?? 50) + (h?.rmnp || 0);
}

// Teste de manipulação: subperícia de Manipulação contra a R.MNP do alvo. Sucesso muda o humor do alvo.
export function resolverManipulacao(autor, alvo, sub, humorDesejado, sistema, { mod = 0, rng = Math.random } = {}) {
  const regra = sistema.social.manipulacoes[sub];
  if (!regra) throw new Error('Escolha uma subperícia de Manipulação.');
  if (!regra.causa.includes(humorDesejado)) throw new Error('Essa subperícia não causa esse humor.');
  const hA = humorDe(autor, sistema);
  const hB = humorDe(alvo, sistema);
  if (hA?.semManipular) throw new Error(`${autor.nome} está ${hA.nome} e não pode manipular.`);
  const d = derivados(autor, sistema);
  const mods = [];
  const add = (nome, valor) => valor && mods.push({ nome, valor });
  add(`${hA?.nome} (autor)`, hA?.manipulacao || 0);
  add(`${hB?.nome} (alvo)`, hB?.manipulacao || 0);
  add('humor', hA?.testes || 0);
  add('modificador', Math.max(-100, Math.min(100, parseInt(mod, 10) || 0)));
  const acao = (d.subpericias[sub] ?? 0) + mods.reduce((s, m) => s + m.valor, 0);
  const modo = hA?.vantagemManipulacao ? 'vantagem' : null;
  const nd = resistenciaManipulacao(alvo, sistema);
  const teste = testeContra(acao, nd, sistema, { modo, rng });
  return { ...teste, mods, sub, humorDesejado, opcoesFalha: teste.sucesso ? [] : regra.falha };
}
