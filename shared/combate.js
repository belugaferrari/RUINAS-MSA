// Combate e regras sociais automatizadas (Livro MSS). Só valem quando o sistema da campanha liga
// "modulos.combate" / "modulos.social". Escolhas provisórias estão em conteudo/sistemas/PENDENCIAS.md.
import { ladoNoMapa } from './monstros.js';
import { rolarDado, derivados, ipContraDano, listaHabilidades, vantagemPorHabilidade, tipoCriatura, subirPassos, temHabilidade, regraDaHabilidade, danoDasHabilidades, efeitosHabilidade, modoHabilidade, perderPv, chaveHabilidade } from './regras.js';

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
  // Com vantagem/desvantagem o DS também rola duas vezes: o maior na vantagem, o menor na desvantagem.
  const dsDados = [1 + Math.floor(rng() * 10)];
  if (modo) dsDados.push(1 + Math.floor(rng() * 10));
  const ds = modo === 'desvantagem' ? Math.min(...dsDados) : Math.max(...dsDados);
  const total = acao + dp;
  const critico = dp >= t.criticoAcerto ? 'acerto' : dp <= t.criticoErro ? 'erro' : null;
  const sucesso = critico === 'acerto' ? true : critico === 'erro' ? false : total >= nd;
  return { dp, dados, ds, dsDados, acao, total, nd, sucesso, critico, modo };
}

export const humorDe = (p, sistema) => (sistema.social?.humores || []).find(h => h.id === (p?.humor || 'neutro')) || null;

// Vantagem/desvantagem do humor num teste (Atraído: Percepção em desvantagem; Amedrontado: Percepção em vantagem;
// Enojado: testes mentais em desvantagem; Corajoso: Inteligência em desvantagem). Vale para o teste do atributo e para
// as perícias/subperícias baseadas nele. acaoRef: "atr:PER", "per:sentidos" ou "sub:sentidos.visao".
export function modoHumorTeste(p, sistema, acaoRef) {
  const h = sistema.modulos?.social ? humorDe(p, sistema) : null;
  if (!h || !acaoRef) return { vantagem: false, desvantagem: false, humor: h?.nome };
  const [tipo, id] = String(acaoRef).split(':');
  const per = tipo === 'per' ? (sistema.pericias || []).find(x => x.id === id) : tipo === 'sub' ? (sistema.pericias || []).find(x => x.id === id.split('.')[0]) : null;
  const atributo = tipo === 'atr' ? id : per?.atributo;
  return { vantagem: !!atributo && (h.vantagemTestes || []).includes(atributo), desvantagem: !!atributo && (h.desvantagemTestes || []).includes(atributo), humor: h.nome };
}

// Bônus geral de testes pelo humor (Apático, Confiante…). Só no sistema com módulo social.
export const modHumorTestes = (p, sistema) => (sistema.modulos?.social ? humorDe(p, sistema)?.testes || 0 : 0);

// ---------- Combate ----------

const tem = (p, nome) => (p?.marcadores || []).some(m => String(m).toLowerCase().startsWith(nome.toLowerCase()));

// Armas que o personagem pode usar agora: as equipadas, mais o ataque desarmado.
// Melhorias da arma (Afiada 2, Aperfeiçoada 1…): sobem passos na progressão de dano. As feitas por uma habilidade
// (Ataque afiado) só valem para quem afiou ("dono"); as do próprio item valem para todos.
export function passosDeMelhoria(item, p) {
  return (item.melhorias || []).filter(m => !m.dono || m.dono === p?.id).reduce((s, m) => s + (m.passos ?? m.nivel ?? 0), 0);
}
export const danoDaArma = (item, p) => subirPassos(item.dano, passosDeMelhoria(item, p));

export function armasDisponiveis(p, sistema) {
  const cfg = sistema.combate || {};
  // Arma quebrada (durabilidade 0) não ataca até ser reparada.
  const armas = (p.itens || []).filter(i => i.equipado && i.tipo === 'arma' && i.dano && !(i.durabilidade != null && (i.durabilidadeAtual ?? i.durabilidade) <= 0)).map(i => ({
    uid: i.uid, nome: i.nome, dano: danoDaArma(i, p), acerto: i.acerto ?? null, pericia: i.pericia || null, tipoDano: i.tipoDano || 'Físico',
    efeitoDano: i.efeitoDano ?? cfg.chancePorTipo?.[i.tipoDano] ?? cfg.efeitoPadrao, penetracao: i.penetracao || 0, alcance: i.alcance || (i.pericia?.startsWith('armas-de-fogo') ? 'distancia' : 'corpo'),
    // Cadência: quantos disparos (balas e danos) por ataque — da arma ou da subperícia (ex.: Rifle de Assalto 2).
    cadencia: Math.max(1, i.cadencia ?? cfg.cadencia?.[i.pericia] ?? 1),
  }));
  const natural = armaNaturalDe(p, sistema);
  return [{ uid: 'desarmado', efeitoDano: cfg.efeitoPadrao, ...cfg.desarmado }, ...(natural ? [natural] : []), ...armas];
}

// Arma natural (garras e presas do Transmorfo desperto; com Garras Retráteis, mesmo sem despertar): ataque especial com o
// mesmo dado e a mesma perícia do desarmado, mas com dano de perfuração e os bônus (+1 do Despertar, +1 por Corpo
// monstruoso, +1 das Garras Retráteis). Monstros têm as armas naturais da planilha como itens.
export function armaNaturalDe(p, sistema) {
  const cfg = sistema.combate || {};
  if (!cfg.desarmado) return null;
  const habs = listaHabilidades(p, sistema);
  const desperto = habs.find(x => x.regra?.armaNatural && p.habAtivas?.[x.id]);
  const retrateis = habs.find(x => chaveHabilidade(x.nome) === 'garras retrateis');
  if (!desperto && !retrateis) return null;
  const corpo = habs.find(x => chaveHabilidade(x.nome) === 'corpo monstruoso')?.vezes || 0;
  const bonusNatural = [];
  if (desperto) bonusNatural.push({ nome: desperto.nome, fixo: desperto.regra.armaNatural + corpo });
  if (retrateis) bonusNatural.push({ nome: retrateis.nome, fixo: 1 });
  return {
    ...cfg.desarmado, uid: 'natural', nome: 'Garras e presas (arma natural)', tipoDano: 'Perfuração', natural: true,
    efeitoDano: cfg.chancePorTipo?.['Perfuração'] ?? cfg.efeitoPadrao, bonusNatural,
  };
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
export function defesaDoAlvo(alvo, arma, sistema, { escolha = 'nenhuma', area = false, surpresa = false, atacante = null } = {}) {
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
  // Caído conta como cobertura parcial contra tiro. A cobertura parcial marcada no ataque entra como −30% no acerto.
  if (caidoDistancia) partes.push({ nome: 'caído (cobertura parcial)', valor: cfg.coberturaParcial });
  const humor = sistema.modulos?.social ? humorDe(alvo, sistema) : null;
  if (humor?.defesa) partes.push({ nome: humor.nome, valor: humor.defesa });
  // Habilidades do alvo que somam defesa (algumas só contra certos tipos de criatura, ex.: Mente cibernética contra drones).
  const tipoAtacante = atacante ? tipoCriatura(atacante) : null;
  const extra = derivados(alvo, sistema).habilidades.defesas.filter(d => !d.contra || (tipoAtacante && d.contra.includes(tipoAtacante))).reduce((t, d) => t + d.valor, 0);
  if (extra) partes.push({ nome: 'habilidades', valor: extra });
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
// op: { armaUid, danoLivre, localizado, maos: { nome, valor } (posto pelo servidor), sacrificio, surpresa, elevado, cobertura, mira, area, vantagem, desvantagem, mod }
// defesa: id escolhido pelo defensor (ver opcoesDefesa).
export function resolverAtaque(atacante, alvo, sistema, op = {}, defesaId = 'nenhuma', rng = Math.random) {
  const cfg = sistema.combate;
  let arma = armasDisponiveis(atacante, sistema).find(a => a.uid === (op.armaUid || 'desarmado'));
  if (!arma) throw new Error('Arma não equipada.');
  if (op.danoLivre) {
    rolarDado(op.danoLivre); // valida a expressão
    arma = { ...arma, nome: `${arma.nome} (dano ${op.danoLivre})`, dano: op.danoLivre };
  }
  // Máquina Implacável na Investida: dano +1 passo e +1 por quadrado avançado (só corpo a corpo).
  const investida = op.investida != null && op.investida !== false && arma.alcance === 'corpo' && temHabilidade(atacante, sistema, 'Maquina Implacavel')
    ? Math.max(0, parseInt(op.investida, 10) || 0) : null;
  if (investida != null) arma = { ...arma, dano: subirPassos(arma.dano, 1) };
  const da = derivados(atacante, sistema);
  const pericia = arma.pericia || 'briga.ataque-desarmado';
  const mods = [];
  const add = (nome, valor) => valor && mods.push({ nome, valor });
  add('localizado', op.localizado ? cfg.localizado.mod : 0);
  if (op.maos) add(op.maos.nome, op.maos.valor || 0);
  // Sacrifício: só humanos (autor, 25/10).
  if (tipoCriatura(atacante) !== 'humanoide') delete op.sacrificio;
  add('Sacrifício', op.sacrificio ? cfg.sacrificio.mod : 0);
  // Alvo com cobertura parcial: −30% no ataque a distância (livro). Mira (gasta a ação de movimento): +30%.
  add(`cobertura parcial do alvo${op.coberturaDoMapa ? ` (${op.coberturaDoMapa})` : ''}`, op.cobertura && arma.alcance === 'distancia' ? -(cfg.coberturaParcial ?? 30) : 0);
  add('Mira', op.mira ? cfg.mira ?? 30 : 0);
  add('humor', modHumorTestes(atacante, sistema));
  add('modificador', Math.max(-100, Math.min(100, parseInt(op.mod, 10) || 0)));
  // Ataque especial usado agora (habilidade que não está ligada): o % de acerto dela entra só neste ataque.
  const especial = op.especial ? listaHabilidades(atacante, sistema).find(x => x.id === op.especial) : null;
  if (especial && !(atacante.ativas || []).includes(especial.id) && modoHabilidade(atacante, sistema, especial) !== 'sempre') {
    const ef = efeitosHabilidade(atacante, sistema, especial);
    add(especial.nome, (ef.pericias[pericia.split('.')[0]] || 0) + (ef.subpericias[pericia] || 0) + (ef.testes || 0));
  }
  const bonusHab = danoDasHabilidades(atacante, sistema, arma, op.especial || null);
  // Ataque natural de monstro pode ter o acerto fixo da planilha; o normal é o valor da subperícia, como no personagem.
  const acao = (arma.acerto ?? da.subpericias[pericia] ?? 0) + mods.reduce((s, m) => s + m.valor, 0);

  const hA = sistema.modulos?.social ? humorDe(atacante, sistema) : null;
  const motivosV = [], motivosD = [];
  if (op.vantagem) motivosV.push('mestre');
  if (op.surpresa) motivosV.push('ataque surpresa');
  if (op.elevado) motivosV.push('terreno elevado');
  if (arma.alcance === 'corpo' && tem(alvo, 'Caído')) motivosV.push('alvo caído');
  if (tem(alvo, 'Aturdido') || tem(alvo, 'Imobilizado')) motivosV.push('alvo aturdido/imobilizado');
  if (hA?.vantagemAtaque) motivosV.push(hA.nome);
  if (vantagemPorHabilidade(atacante, sistema, ['ataque', pericia], [alvo])) motivosV.push('habilidade');
  if (op.desvantagem) motivosD.push('mestre');
  if (tem(atacante, 'Caído')) motivosD.push('atacante caído');
  if (tem(atacante, 'Aturdido')) motivosD.push('atacante aturdido');
  if (hA?.desvantagemAtaque) motivosD.push(hA.nome);
  const modo = modoRolagem(motivosV.length > 0, motivosD.length > 0);

  const defesa = defesaDoAlvo(alvo, arma, sistema, { escolha: defesaId, area: !!op.area, surpresa: !!op.surpresa, atacante });
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
      // Habilidades que somam dano, cada uma com o seu nome (para a conta): as ligadas e automáticas — só as que valem
      // para este tipo de ataque (ex.: "ataques desarmados") — e o ataque especial usado agora, uma vez.
      for (const b of arma.bonusNatural || []) doDisparo.push({ nome: b.nome, total: b.fixo });
      for (const parte of bonusHab.partes) {
        if (parte.expr) rolar(parte.nome, parte.expr);
        else doDisparo.push({ nome: parte.nome, total: parte.fixo });
      }
      if (op.cargaNucleo) rolar('Carga do Núcleo (elétrico)', '2d6');
      if (investida) doDisparo.push({ nome: `Investida (${investida} quadrado${investida > 1 ? 's' : ''})`, total: investida });
    }
    const bruto = doDisparo.reduce((s, p) => s + p.total, 0);
    r.disparos.push({ bruto, dano: Math.max(cfg.danoMinimo, bruto - r.ip) });
    partes.push(...doDisparo);
  }
  r.danoPartes = partes;
  r.danoBruto = partes.reduce((s, p) => s + p.total, 0);
  r.dano = r.disparos.reduce((s, x) => s + x.dano, 0);
  if (!teste.sucesso) { r.dano = Math.floor(r.dano / 2); r.metadeEvasao = true; }
  // Imunidade (dano zero), resistência (metade) e vulnerabilidade (dobro) ao tipo de dano (monstros da planilha).
  const tipoD = String(arma.tipoDano || '').toLowerCase();
  const tem2 = lista => (lista || []).some(x => String(x).toLowerCase() === tipoD);
  // Afinidade principal (1ª afinidade elementar do monstro): recebe metade do dano dos tipos ligados a ela (base.json).
  const afinidade = (sistema.afinidadesElementais || []).find(x => x.nome.toLowerCase() === String(alvo.afinidades?.[0] || '').toLowerCase());
  const danosDaAfinidade = (afinidade ? afinidade.danos : alvo.afinidades?.[0] ? [alvo.afinidades[0]] : []).map(x => String(x).toLowerCase());
  if (tipoD && tem2(alvo.imunidades)) { r.dano = 0; r.imune = arma.tipoDano; }
  else if (tipoD && (tem2(alvo.resistencias) || danosDaAfinidade.includes(tipoD))) { r.dano = Math.floor(r.dano / 2); r.resistencia = arma.tipoDano; r.porAfinidade = !tem2(alvo.resistencias) ? alvo.afinidades[0] : null; }
  else if (tipoD && tem2(alvo.vulnerabilidades)) { r.dano *= 2; r.vulnerabilidade = arma.tipoDano; }
  if (tem(alvo, 'Queimadura')) { r.dano += 1; r.queimadura = true; }
  const efeito = cfg.efeitosPorTipo[arma.tipoDano];
  // Margem do efeito de dano: a da arma mais a das habilidades (ex.: Ataque Desarmado Treinado +1 na Dor).
  if (efeito && teste.sucesso && teste.ds <= (arma.efeitoDano || 0) + bonusHab.margem) r.efeito = efeito;
  r.especial = especial?.nome || null;
  return r;
}

// Imunidades por habilidade (Alma de ciborgue: Dor).
export const imuneA = (p, sistema, efeito) => (p.imunidades || []).some(x => String(x).toLowerCase() === String(efeito).toLowerCase())
  || (!!sistema && derivados(p, sistema).habilidades.imune.some(x => String(x).toLowerCase() === String(efeito).toLowerCase()));

// Usos de habilidade com recarga (p.usos[chave] = quantos já usou). O descanso longo zera os de "descanso-longo".
export function usosRestantes(p, sistema, nome) {
  const regra = regraDaHabilidade(nome, sistema);
  if (!regra?.usos) return Infinity;
  return Math.max(0, regra.usos.max - (p.usos?.[nome] || 0));
}
export function gastarUso(p, nome) {
  (p.usos ||= {})[nome] = (p.usos[nome] || 0) + 1;
}

// Recursos de habilidade (Cargas do Núcleo = 3 + MOD CONS): p.recursos[id] = quantas já gastou.
export function recursoDe(p, sistema, id) {
  const hab = listaHabilidades(p, sistema).find(x => x.regra?.recurso?.id === id);
  if (!hab) return null;
  const r = hab.regra.recurso;
  const d = derivados(p, sistema);
  const max = Math.max(0, String(r.max).split('+').reduce((s, parte) => {
    const m = /MOD\s*(\w+)/i.exec(parte);
    return s + (m ? d.mod[m[1].toUpperCase()] || 0 : parseInt(parte, 10) || 0);
  }, 0));
  return { ...r, max, restantes: Math.max(0, max - (p.recursos?.[id] || 0)), habilidade: hab.nome };
}
export function gastarRecurso(p, sistema, id, qtd = 1) {
  const r = recursoDe(p, sistema, id);
  if (!r) throw new Error('Sem essa habilidade.');
  if (r.restantes < qtd) throw new Error(`${r.nome}: só restam ${r.restantes}.`);
  (p.recursos ||= {})[id] = (p.recursos[id] || 0) + qtd;
  return r;
}

// "Raça" para habilidades como Quebra-Hordas: o campo Raça da ficha (autor, 21/10). Sem raça preenchida, não combina com ninguém.
export const racaDe = p => String(p?.raca || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() || null;
// Distância no mapa em metros (diagonal conta 1 quadrado de 1,5 m); null se algum não tem peão. Criatura grande ocupa
// vários quadrados (2×2, 3×3): conta do quadrado dela mais perto do outro.
export function distanciaPecas(c, idA, idB) {
  const a = c.mapa?.pecas?.[idA], b = c.mapa?.pecas?.[idB];
  if (!a || !b) return null;
  const pa = (c.personagens || []).find(x => x.id === idA), pb = (c.personagens || []).find(x => x.id === idB);
  const la = ladoNoMapa(pa), lb = ladoNoMapa(pb);
  const vao = (x, lx, y, ly) => Math.max(0, y - (x + lx - 1), x - (y + ly - 1));
  return Math.max(vao(a.col, la, b.col, lb), vao(a.lin, la, b.lin, lb)) * 1.5;
}

// Aplica o resultado no alvo: PV, desmaio, morte e marcador do efeito de dano.
export function aplicarAtaque(atacante, alvo, r, sistema = null) {
  const marcar = m => { if (!(alvo.marcadores ||= []).includes(m)) alvo.marcadores.push(m); };
  if (r.perdaSacrificio) atacante.pv.atual -= r.perdaSacrificio;
  if (!r.sucesso && !r.dano) return [];
  const notas = [];
  const antes = alvo.pv.atual;
  // PV temporários são os últimos a sair (ver perderPv).
  const tempAntes = alvo.pvTemp || 0;
  const abs = perderPv(alvo, r.dano);
  if (abs) notas.push(`${abs} nos PV temporários`);
  // Juggernaut: a 1ª vez (por descanso longo) que o PV ficaria abaixo de 0 no combate, fica com 1 PV.
  if (sistema && alvo.pv.atual < 0 && antes >= 0 && temHabilidade(alvo, sistema, 'Juggernaut') && usosRestantes(alvo, sistema, 'juggernaut') > 0) {
    alvo.pv.atual = 1;
    gastarUso(alvo, 'juggernaut');
    notas.push('Juggernaut: ficou com 1 PV');
    if (r.efeito && !imuneA(alvo, sistema, r.efeito)) { marcar(r.efeito); notas.push(r.efeito); }
    return notas;
  }
  if (r.efeito && imuneA(alvo, sistema, r.efeito)) notas.push(`imune a ${r.efeito}`);
  else if (r.efeito) { marcar(r.efeito); notas.push(r.efeito); }
  if (antes < 0 && !r.naoLetal) { marcar('Morto'); notas.push('morto (dano com PV negativo)'); }
  else if (alvo.pv.atual <= 0 && !(alvo.pvTemp > 0) && antes + tempAntes > 0) { marcar('Desmaiado'); notas.push(r.naoLetal ? 'desmaiado (não letal)' : 'desmaiado'); }
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
// Habilidades também dão vantagem (Mente cibernética, se houver drone ou autômato entre os oponentes).
export function rolarIniciativa(p, sistema, rng = Math.random, oponentes = null) {
  const agi = derivados(p, sistema).iniciativa;
  const h = sistema.modulos?.social ? humorDe(p, sistema) : null;
  const vant = !!h?.vantagemIniciativa || vantagemPorHabilidade(p, sistema, 'iniciativa', oponentes);
  const desv = !!h?.desvantagemIniciativa;
  const a = 1 + Math.floor(rng() * 10);
  const dados = [a];
  // Vantagem fica com o maior dos dois d10; desvantagem (Sereno), com o menor. As duas juntas se anulam.
  if (vant !== desv) dados.push(1 + Math.floor(rng() * 10));
  const d10 = desv && !vant ? Math.min(...dados) : Math.max(...dados);
  return { total: agi + d10, agi, dados, vantagem: vant && !desv, desvantagem: desv && !vant };
}

// ---------- Social ----------

// Resistência à Manipulação (R.MNP) = perícia base Manipulação + 50 + modificadores (humor e o campo rmnpExtra da ficha).
// Usa o valor final da perícia base (pontos + bônus pericial de CAR + itens), então cresce com o personagem.
export function resistenciaManipulacao(p, sistema) {
  const d = derivados(p, sistema);
  const base = d.pericias[sistema.social?.resistenciaBase || 'manipulacao'] ?? 0;
  const h = humorDe(p, sistema);
  return base + (sistema.teste.passiva?.soma ?? 50) + (h?.rmnp || 0) + (parseInt(p.rmnpExtra, 10) || 0) + (d.habilidades?.rmnp || 0);
}

// Espectro do relacionamento (como o alvo vê quem manipula): A Aliado/Amigável, B Desconhecido, C Rival/Inimigo.
export function espectroDe(relacao, sistema) {
  const esp = sistema.social?.espectros || {};
  for (const [k, v] of Object.entries(esp)) if (relacao && v.relacoes.includes(relacao)) return k;
  return 'B';
}

// Humor que o alvo mostra para a sala (o aparente). O padrão é Neutro, e ele pode ser igual ao real: assim, quando o
// humor real muda, ninguém vê a mudança (autor, 22/10).
export const humorAparente = p => p?.humorAparente || 'neutro';

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
  // Intuir humor (ler) não tem rebote.
  if (!teste.sucesso && humorDesejado !== 'ler') {
    const opcoes = ((Array.isArray(regra.falha) ? regra.falha : regra.falha?.[espectro]) || []).filter(x => x !== 'neutro' || regra.falha?.[espectro]?.length > 1);
    // Uma opção: vai direto. Duas: o alvo escolhe entre elas.
    if (opcoes.length === 1) rebote = opcoes[0];
    else opcoesRebote = opcoes;
  }
  return { ...teste, mods, sub, humorDesejado, espectro, rebote, opcoesRebote, ler: humorDesejado === 'ler' };
}

// Humores que o próprio jogador pode escolher: Amigável, Neutro e Indisposto (os "escolha" da Roda do Humor).
// Habilidades podem liberar mais: Irreverente (Galante, nível 15) escolhe qualquer humor, a qualquer momento.
const semAc = x => String(x || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function liberdadeDeHumor(p, sistema) {
  const todos = sistema.social?.humores || [];
  const irreverente = p?.atributos && listaHabilidades(p, sistema).some(x => semAc(x.nome) === 'irreverente');
  return {
    humores: irreverente ? todos : todos.filter(h => h.escolha),
    // Dentro da Sala Social o humor só muda por manipulação ou empatia natural (salvo habilidade).
    naSala: !!irreverente,
    fonte: irreverente ? 'Irreverente' : null,
  };
}

// ---------- Empatia natural (regra do aplicativo, autor 20/10) ----------
// Tendência de quem interage socialmente a ficar com o mesmo humor. Cada humano EMITE o seu humor aparente (a máscara,
// se houver) com uma influência = CAR% + 1d100 + bônus gerais de Manipulação (−20 se o aparente for diferente do real).
// Cada influência é testada contra o R.MNP de cada outro humano, ajustado: aliado/amigo −10, rival/inimigo +10
// (como o receptor vê o emissor); humor do mesmo espectro que o do receptor −10, do espectro inverso +10.
// O receptor conta os sucessos POR ESPECTRO (positivo × negativo):
// · vence o espectro em que ele já está → vai direto para o humor vencedor (o que teve mais sucessos; empate: maior influência);
// · vence o espectro oposto → vai para Neutro (o passo seguinte, numa próxima rodada, leva ao humor vencedor);
// · está Neutro → vai para o humor vencedor. Empate entre espectros ou nenhum sucesso → fica como está.
// Neutro e Apático não emitem; Apático (desligado da empatia humana) não é afetado. Criaturas ficam de fora.
export function espectroDoHumor(humor, sistema) {
  const cfg = sistema.social?.empatiaNatural || {};
  if ((cfg.positivos || []).includes(humor)) return 'positivo';
  if ((cfg.negativos || []).includes(humor)) return 'negativo';
  return humor === 'apatico' ? 'apatico' : 'neutro';
}

// Bônus gerais de Manipulação: tudo o que soma na perícia base Manipulação além dos pontos e do bônus de atributo
// (itens, habilidades ativas, condições) e o bônus geral do humor.
export function bonusGeralManipulacao(p, sistema) {
  const d = derivados(p, sistema);
  const per = (sistema.pericias || []).find(x => x.id === 'manipulacao');
  const geral = per ? (d.pericias.manipulacao ?? 0) - (p.pericias?.manipulacao ?? 0) - (d.bonusPericial[per.atributo] ?? 0) : 0;
  return geral + modHumorTestes(p, sistema);
}

export function empatiaNatural(participantes, sistema, { relacoes = {}, rng = Math.random } = {}) {
  const cfg = sistema.social?.empatiaNatural || {};
  const humanos = participantes.filter(p => !p.criatura && !(p.marcadores || []).includes('Morto'));
  if (humanos.length < 2) throw new Error('A empatia natural precisa de pelo menos dois humanos na Sala Social.');
  // 1) Influência de cada emissor (um teste só por emissor, usado contra todos).
  const emissores = humanos.map(p => {
    const real = p.humor || 'neutro';
    const aparente = humorAparente(p);
    const espectro = espectroDoHumor(aparente, sistema);
    const d = derivados(p, sistema);
    const dp = 1 + Math.floor(rng() * 100);
    const mascara = aparente !== real ? (cfg.mascara ?? -20) : 0;
    const bonus = bonusGeralManipulacao(p, sistema);
    return { p, humor: aparente, espectro, car: d.percentual.CAR ?? 0, dp, bonus, mascara, total: (d.percentual.CAR ?? 0) + dp + bonus + mascara, emite: espectro === 'positivo' || espectro === 'negativo' };
  });
  // 2) Cada receptor contra cada emissor.
  const resultados = [];
  for (const r of humanos) {
    const atual = r.humor || 'neutro';
    const meuEsp = espectroDoHumor(atual, sistema);
    const rmnp = resistenciaManipulacao(r, sistema);
    const testes = [];
    for (const e of emissores) {
      if (e.p.id === r.id || !e.emite) continue;
      let nd = rmnp;
      const rel = espectroDe(relacoes[r.id]?.[e.p.id]?.tipo, sistema);
      if (rel === 'A') nd += cfg.aliado ?? -10;
      if (rel === 'C') nd += cfg.rival ?? 10;
      if (meuEsp === 'positivo' || meuEsp === 'negativo') nd += e.espectro === meuEsp ? (cfg.mesmoEspectro ?? -10) : (cfg.espectroInverso ?? 10);
      testes.push({ de: e.p.id, nome: e.p.nome, humor: e.humor, espectro: e.espectro, total: e.total, nd, sucesso: e.total >= nd });
    }
    let novo = atual;
    let motivo = 'resistiu';
    if (meuEsp === 'apatico') motivo = 'apático: desligado da empatia';
    else {
      const ok = testes.filter(t => t.sucesso);
      const pos = ok.filter(t => t.espectro === 'positivo');
      const neg = ok.filter(t => t.espectro === 'negativo');
      if (ok.length && pos.length !== neg.length) {
        const vence = pos.length > neg.length ? 'positivo' : 'negativo';
        const lista = vence === 'positivo' ? pos : neg;
        // Humor vencedor: o que teve mais sucessos; empate, a maior influência.
        const porHumor = new Map();
        for (const t of lista) {
          const x = porHumor.get(t.humor) || { n: 0, max: 0 };
          porHumor.set(t.humor, { n: x.n + 1, max: Math.max(x.max, t.total) });
        }
        const vencedor = [...porHumor.entries()].sort((a, b) => b[1].n - a[1].n || b[1].max - a[1].max)[0][0];
        if (meuEsp === vence || meuEsp === 'neutro') { novo = vencedor; motivo = `${pos.length} positivo(s) × ${neg.length} negativo(s)`; }
        else { novo = 'neutro'; motivo = `${pos.length} positivo(s) × ${neg.length} negativo(s): passa pelo Neutro`; }
      } else if (ok.length) motivo = `empate entre os espectros (${pos.length} × ${neg.length})`;
    }
    resultados.push({ p: r, de: atual, para: novo, mudou: novo !== atual, motivo, rmnp, testes });
  }
  // 3) Aplica igual a uma manipulação (humor imposto), para o jogador não distinguir uma da outra.
  for (const x of resultados) {
    if (!x.mudou) continue;
    x.p.humor = x.para;
    x.p.humorOpcoes = [];
    x.p.humorImposto = x.para !== 'neutro';
  }
  return { emissores, resultados };
}
