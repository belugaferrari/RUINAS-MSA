// Combate e regras sociais automatizadas (Livro MSS). Só valem quando o sistema da campanha liga
// "modulos.combate" / "modulos.social". Escolhas provisórias estão em conteudo/sistemas/PENDENCIAS.md.
import { rolarDado, derivados, ipContraDano } from './regras.js';

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
  // Arma quebrada (durabilidade 0) não ataca até ser reparada.
  const armas = (p.itens || []).filter(i => i.equipado && i.tipo === 'arma' && i.dano && !(i.durabilidade != null && (i.durabilidadeAtual ?? i.durabilidade) <= 0)).map(i => ({
    uid: i.uid, nome: i.nome, dano: i.dano, pericia: i.pericia || null, tipoDano: i.tipoDano || 'Físico',
    efeitoDano: i.efeitoDano ?? cfg.chancePorTipo?.[i.tipoDano] ?? cfg.efeitoPadrao, penetracao: i.penetracao || 0, alcance: i.alcance || (i.pericia?.startsWith('armas-de-fogo') ? 'distancia' : 'corpo'),
    // Cadência: quantos disparos (balas e danos) por ataque — da arma ou da subperícia (ex.: Rifle de Assalto 2).
    cadencia: Math.max(1, i.cadencia ?? cfg.cadencia?.[i.pericia] ?? 1),
  }));
  return [{ uid: 'desarmado', efeitoDano: cfg.efeitoPadrao, ...cfg.desarmado }, ...armas];
}

// Defesas que o alvo pode escolher contra este ataque (quem escolhe é o defensor):
// Esquiva contra Briga e Armas Brancas (acertado por arma, recebe +2 de dano); Defesa desarmada só contra Briga;
// Defesa armada (perícia da arma branca empunhada) contra corpo a corpo; Evasão só contra ataque em área.
// Contra tiro (a distância, fora de área) não há defesa. "Sem defesa" sempre existe (ex.: pego de surpresa).
export function opcoesDefesa(alvo, arma, sistema, { area = false } = {}) {
  const cfg = sistema.combate;
  const d = derivados(alvo, sistema);
  const sub = id => d.subpericias[id] ?? 0;
  const opcoes = [];
  if (area) {
    opcoes.push({ id: 'evasao', nome: 'Evasão', valor: sub('briga.evasao'), nota: 'exige deslocamento de 3 m ou mais' });
  } else if (arma.alcance === 'corpo') {
    opcoes.push({ id: 'esquiva', nome: 'Esquiva', valor: sub('briga.esquiva'),
      nota: arma.uid === 'desarmado' ? 'se não for acertado, pode se deslocar até 1,5 m' : 'se não for acertado, pode se deslocar até 1,5 m; se for acertado, +2 de dano' });
    if (arma.uid === 'desarmado') opcoes.push({ id: 'defesa-desarmada', nome: 'Defesa desarmada', valor: sub('briga.defesa-desarmada') });
    for (const a of armasDisponiveis(alvo, sistema)) {
      if (a.uid === 'desarmado' || !a.pericia?.startsWith('arma-branca.') || cfg.semDefesaArmada.includes(a.pericia)) continue;
      opcoes.push({ id: `armada:${a.uid}`, nome: `Defesa armada (${a.nome})`, valor: sub(a.pericia) });
    }
  }
  const tiro = arma.alcance === 'distancia' && !area;
  opcoes.push({ id: 'nenhuma', nome: tiro ? 'Sem defesa (tiro)' : 'Sem defesa', valor: 0 });
  return opcoes;
}

// Valor de defesa contra o qual o atacante rola (só o ataque rola): defesa escolhida + 50.
// Contra tiro (a distância, fora de área) a dificuldade é 50 + 5 × nível do alvo. Cobertura parcial +30 só contra ataques a distância.
// Defesa surpresa (alvo pego de surpresa, não escolhe defesa): só a base da Esquiva (50) contra ataque físico,
// e só nível × 5 contra ataque a distância.
export function defesaDoAlvo(alvo, arma, sistema, { escolha = 'nenhuma', cobertura = false, area = false, surpresa = false } = {}) {
  const cfg = sistema.combate;
  const opcoes = opcoesDefesa(alvo, arma, sistema, { area });
  const esc = surpresa ? { id: 'nenhuma', nome: 'Surpresa' } : opcoes.find(o => o.id === escolha);
  if (!esc) throw new Error('Essa defesa não vale contra este ataque.');
  const tiro = arma.alcance === 'distancia' && !area;
  const nivel = { nome: `nível ${alvo.nivel || 1} × ${cfg.distancia.porNivel}`, valor: cfg.distancia.porNivel * (alvo.nivel || 1) };
  const partes = surpresa
    ? (tiro ? [nivel] : [{ nome: 'base da Esquiva', valor: cfg.defesaPassiva }])
    : tiro
      ? [{ nome: 'base', valor: cfg.distancia.base }, nivel]
      : [{ nome: esc.nome, valor: esc.valor }, { nome: 'base', valor: cfg.defesaPassiva }];
  const caidoDistancia = arma.alcance === 'distancia' && tem(alvo, 'Caído');
  if (arma.alcance === 'distancia' && (cobertura || caidoDistancia)) partes.push({ nome: 'cobertura parcial', valor: cfg.coberturaParcial });
  const humor = sistema.modulos?.social ? humorDe(alvo, sistema) : null;
  if (humor?.defesa) partes.push({ nome: humor.nome, valor: humor.defesa });
  return { id: esc.id, nome: esc.nome, nota: esc.nota || null, total: partes.reduce((s, x) => s + x.valor, 0), partes };
}

// IP (Índice de Proteção) do alvo: itens equipados + habilidades (campo ipExtra da ficha). Subtrai do dano recebido.
export function ipDe(p, sistema) {
  return derivados(p, sistema).ip.geral;
}

// IP do alvo contra este dano (tipo e alcance da arma).
export function ipContra(p, sistema, tipoDano, distancia = false) {
  return ipContraDano(derivados(p, sistema).ip, tipoDano, distancia);
}

// Valor do D6 de vida atual (os 5 primeiros PV ficam à parte; dali para cima conta-se em D6).
export function d6Atual(pv) {
  if (pv <= 5) return 0;
  return ((pv - 6) % 6) + 1;
}

// Resolve um ataque completo: acerto × defesa, dano − IP, efeito pelo DS. Não altera nada: devolve o que aplicar.
// op: { armaUid, danoLivre, localizado, duasArmas: 'principal'|'inabil', sacrificio, surpresa, elevado, cobertura, area, vantagem, desvantagem, mod }
// defesa: id escolhido pelo defensor (ver opcoesDefesa).
export function resolverAtaque(atacante, alvo, sistema, op = {}, defesaId = 'nenhuma', rng = Math.random) {
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

  const defesa = defesaDoAlvo(alvo, arma, sistema, { escolha: defesaId, cobertura: !!op.cobertura, area: !!op.area, surpresa: !!op.surpresa });
  const teste = testeContra(acao, defesa.total, sistema, { modo, rng });
  const r = {
    arma: arma.nome, pericia, acao, mods, defesa, ...teste, motivosVantagem: motivosV, motivosDesvantagem: motivosD,
    dano: 0, danoBruto: 0, danoPartes: [], ip: 0, efeito: null, perdaSacrificio: 0, naoLetal: arma.tipoDano === 'Não letal',
  };
  // Sacrifício: perde o D6 atual de vida mesmo errando (abandona a razão no ataque).
  if (op.sacrificio) r.perdaSacrificio = d6Atual(atacante.pv?.atual ?? 0);
  // Ataque em área: quem passa na Evasão recebe só metade do dano.
  if (!teste.sucesso && !(op.area && defesa.id === 'evasao')) return r;

  // Penetração ignora até N pontos de IP do alvo.
  r.ip = cfg.ignoramIP.includes(arma.tipoDano) ? 0 : Math.max(0, ipContra(alvo, sistema, arma.tipoDano, arma.alcance === 'distancia') - (arma.penetracao || 0));
  // Cada disparo (cadência) é um dano separado, cada um descontando o IP. Crítico, localizado e bônus entram no primeiro.
  const disparos = Math.max(1, Math.min(arma.cadencia || 1, op.disparos || arma.cadencia || 1));
  const partes = [];
  r.disparos = [];
  for (let n = 0; n < disparos; n++) {
    const doDisparo = [];
    const rolar = (nome, expr) => { const x = rolarDado(expr, rng); doDisparo.push({ nome, expr, dados: x.dados, total: x.total }); };
    rolar(disparos > 1 ? `${arma.nome} (${n + 1}º)` : arma.nome, arma.dano);
    if (n === 0) {
      if (teste.critico === 'acerto') {
        const m = /d(\d+)/i.exec(arma.dano);
        if (m) rolar('crítico', `1d${m[1]}`);
      }
      if (op.localizado) rolar('localizado', cfg.localizado.dano);
      if (teste.sucesso && defesa.id === 'esquiva' && arma.uid !== 'desarmado') doDisparo.push({ nome: 'esquiva contra arma', total: cfg.esquivaArmada });
      if (arma.alcance === 'corpo' && da.mod.FOR) doDisparo.push({ nome: 'MOD FOR', total: da.mod.FOR });
      if (r.perdaSacrificio) doDisparo.push({ nome: 'Sacrifício', total: r.perdaSacrificio });
      // Habilidades e vantagens ativas que somam dano.
      if (da.habilidades?.danoFixo) doDisparo.push({ nome: 'habilidades', total: da.habilidades.danoFixo });
      for (const expr of da.habilidades?.danoDados || []) rolar('habilidades', expr);
    }
    const bruto = doDisparo.reduce((s, p) => s + p.total, 0);
    r.disparos.push({ bruto, dano: Math.max(cfg.danoMinimo, bruto - r.ip) });
    partes.push(...doDisparo);
  }
  r.danoPartes = partes;
  r.danoBruto = partes.reduce((s, p) => s + p.total, 0);
  r.dano = r.disparos.reduce((s, x) => s + x.dano, 0);
  if (!teste.sucesso) { r.dano = Math.floor(r.dano / 2); r.metadeEvasao = true; }
  if (tem(alvo, 'Queimadura')) { r.dano += 1; r.queimadura = true; }
  const efeito = cfg.efeitosPorTipo[arma.tipoDano];
  if (efeito && teste.sucesso && teste.ds <= arma.efeitoDano) r.efeito = efeito;
  return r;
}

// Aplica o resultado no alvo: PV, desmaio, morte e marcador do efeito de dano.
export function aplicarAtaque(atacante, alvo, r) {
  const marcar = m => { if (!(alvo.marcadores ||= []).includes(m)) alvo.marcadores.push(m); };
  if (r.perdaSacrificio) atacante.pv.atual -= r.perdaSacrificio;
  if (!r.sucesso && !r.dano) return [];
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

// Iniciativa = AGI + 1d10, com vantagem pelo humor (Corajoso, Amedrontado, Enojado) ou desvantagem (Sereno).
export function rolarIniciativa(p, sistema, rng = Math.random) {
  const agi = derivados(p, sistema).iniciativa;
  const h = sistema.modulos?.social ? humorDe(p, sistema) : null;
  const a = 1 + Math.floor(rng() * 10);
  const dados = [a];
  // Vantagem fica com o maior dos dois d10; desvantagem (Sereno), com o menor.
  const dois = h?.vantagemIniciativa || h?.desvantagemIniciativa;
  if (dois) dados.push(1 + Math.floor(rng() * 10));
  const d10 = h?.desvantagemIniciativa && !h?.vantagemIniciativa ? Math.min(...dados) : Math.max(...dados);
  return { total: agi + d10, agi, dados, vantagem: !!h?.vantagemIniciativa, desvantagem: !!h?.desvantagemIniciativa };
}

// ---------- Social ----------

// Resistência à Manipulação (R.MNP) = perícia base Manipulação + 50 + modificadores (humor e o campo rmnpExtra da ficha).
// Usa o valor final da perícia base (pontos + bônus pericial de CAR + itens), então cresce com o personagem.
export function resistenciaManipulacao(p, sistema) {
  const d = derivados(p, sistema);
  const base = d.pericias[sistema.social?.resistenciaBase || 'manipulacao'] ?? 0;
  const h = humorDe(p, sistema);
  return base + (sistema.teste.passiva?.soma ?? 50) + (h?.rmnp || 0) + (parseInt(p.rmnpExtra, 10) || 0);
}

// Espectro do relacionamento (como o alvo vê quem manipula): A Aliado/Amigável, B Desconhecido, C Rival/Inimigo.
export function espectroDe(relacao, sistema) {
  const esp = sistema.social?.espectros || {};
  for (const [k, v] of Object.entries(esp)) if (relacao && v.relacoes.includes(relacao)) return k;
  return 'B';
}

// Humor que o alvo mostra para a sala (a máscara), ou o real quando não há máscara.
export const humorAparente = p => p?.humorAparente || p?.humor || 'neutro';

// Teste de manipulação: subperícia de Manipulação contra a R.MNP do alvo.
// Sucesso: o alvo fica com o humor desejado ("ler", na Empatia, revela o humor real a quem testou).
// Falha (rebote): o alvo vai para um humor reativo, conforme o espectro do relacionamento.
export function resolverManipulacao(autor, alvo, sub, humorDesejado, sistema, { mod = 0, rng = Math.random, espectro = 'B' } = {}) {
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
  let rebote = null;
  let opcoesRebote = [];
  if (!teste.sucesso) {
    const opcoes = ((Array.isArray(regra.falha) ? regra.falha : regra.falha?.[espectro]) || []).filter(x => x !== 'neutro' || regra.falha?.[espectro]?.length > 1);
    // Uma opção: vai direto. Duas: o alvo escolhe entre elas.
    if (opcoes.length === 1) rebote = opcoes[0];
    else opcoesRebote = opcoes;
  }
  return { ...teste, mods, sub, humorDesejado, espectro, rebote, opcoesRebote, ler: humorDesejado === 'ler' };
}

// ---------- Empatia natural ----------
// O mestre lança um teste oculto para todos os humanos da Sala Social e o grupo converge, sem testes de quem é
// contagiado, para o humor que um dos participantes mostra (o aparente, ou o real sem máscara).
// FÓRMULA PROVISÓRIA (o autor vai mandar a regra): cada humano rola CAR% (D-MIL) e conduz quem tirar o maior total
// (empate: maior CAR). Para trocar a regra, basta mudar formulaEmpatiaNatural — o resto da mecânica já usa o resultado.
export function formulaEmpatiaNatural(humanos, sistema, rng = Math.random) {
  const testes = humanos.map(p => {
    const d = derivados(p, sistema);
    const dp = 1 + Math.floor(rng() * 100);
    return { id: p.id, nome: p.nome, car: d.atributos.CAR ?? 0, acao: d.percentual.CAR ?? 0, dp, total: (d.percentual.CAR ?? 0) + dp };
  });
  const ordenados = [...testes].sort((a, b) => b.total - a.total || b.car - a.car);
  return { condutor: ordenados[0]?.id || null, testes };
}

export function empatiaNatural(participantes, sistema, rng = Math.random) {
  const humanos = participantes.filter(p => !p.criatura && !(p.marcadores || []).includes('Morto'));
  if (humanos.length < 2) throw new Error('A empatia natural precisa de pelo menos dois humanos na Sala Social.');
  const { condutor, testes } = formulaEmpatiaNatural(humanos, sistema, rng);
  const lider = humanos.find(p => p.id === condutor);
  const humor = lider.humorAparente || lider.humor || 'neutro';
  const mudancas = [];
  for (const p of humanos) {
    if (p.id === lider.id || (p.humor || 'neutro') === humor) continue;
    mudancas.push({ id: p.id, nome: p.nome, de: p.humor || 'neutro', para: humor });
    p.humor = humor;
    p.humorOpcoes = [];
    // Contágio natural: não é imposto (mudar depois não causa dissonância). A máscara igual ao novo humor some.
    p.humorImposto = false;
    if (p.humorAparente === humor) p.humorAparente = null;
  }
  return { condutor: lider, humor, testes, mudancas };
}
