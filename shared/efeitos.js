// Efeitos com tempo (Sangramento, Dor, Aturdido…): os marcadores dizem QUAIS efeitos o personagem tem;
// p.efeitos guarda os contadores de turno de cada um, por id da condição.
// A contagem anda no fim do turno de quem sofre o efeito (controle de turno do Campo de Batalha).
import { rolarDado, condicoesAtivas, testeDMil, perderPv, textoPv, mutacaoDaTabela } from './regras.js';

// Sorteia uma mutação da tabela (d100) e põe no personagem. Devolve a mutação (ou null sem tabela).
export function sortearMutacao(p, sistema, tipo = 'temporaria', rng = Math.random, n = null) {
  const m = mutacaoDaTabela(sistema, n ?? 1 + Math.floor(rng() * 100));
  if (!m) return null;
  (p.mutacoes ||= []).push({ id: `${Date.now().toString(36)}${Math.floor(rng() * 1e6).toString(36)}`, n: m.n, tipo });
  return m;
}
import { regrasNecessidades, testeVantagem } from './tempo.js';

const semAcento = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const rolar = (v, rng) => (typeof v === 'number' ? v : rolarDado(String(v), rng).total);

function doMarcador(m, sistema) {
  const s = semAcento(m);
  return (sistema.condicoes || []).find(x => s === semAcento(x.nome) || s.startsWith(semAcento(x.nome)));
}

const temporizada = c => c && (c.duracao != null || c.sangra);

// Cria os contadores dos efeitos novos e apaga os de efeitos que saíram. Chamar sempre que os marcadores mudarem.
// "reiniciar" (ids) recomeça a contagem de um efeito que já existia (ex.: novo dano de Corte no Sangramento).
export function sincronizarEfeitos(p, sistema, { reiniciar = [], rng = Math.random } = {}) {
  // Contador posto à mão pelo mestre vale até para efeito sem duração no livro (Paralisado, Caído…).
  const antes = p.efeitos || {};
  const ativas = condicoesAtivas(p, sistema).filter(c => temporizada(c) || antes[c.id]);
  const novo = {};
  for (const c of ativas) {
    const t = antes[c.id];
    if (t && (!reiniciar.includes(c.id) || !temporizada(c))) {
      // Efeito que acumula (Dor) ganhou mais um marcador: a duração volta a correr.
      if (c.duracao != null && c.acumula && c.qtd > (t.qtd || 1)) novo[c.id] = { ...t, qtd: c.qtd, turnos: Math.max(t.turnos, rolar(c.duracao, rng)) };
      else novo[c.id] = { ...t, qtd: c.qtd };
      continue;
    }
    // Sangramento: a contagem começa em 1 (perde 1 PV no 1º turno do afetado); depois, a cada 1d4 turnos (autor, 22/10).
    novo[c.id] = c.sangra
      ? { qtd: c.qtd, turnos: c.sangra.primeiro ?? rolar(c.sangra.intervalo, rng), perdidos: 0 }
      : { qtd: c.qtd, turnos: rolar(c.duracao, rng) };
  }
  if (Object.keys(novo).length) p.efeitos = novo;
  else delete p.efeitos;
}

function tirarCondicao(p, c) {
  p.marcadores = (p.marcadores || []).filter(m => doMarcador(m, { condicoes: [c] }) == null);
}

// Fim do turno de quem tem efeitos: desconta um turno de cada um. Devolve as notas para o registro.
export function passarTurnoEfeitos(p, sistema, rng = Math.random) {
  if (!p.efeitos) return [];
  sincronizarEfeitos(p, sistema, { rng });
  const notas = [];
  for (const [id, t] of Object.entries(p.efeitos || {})) {
    const c = (sistema.condicoes || []).find(x => x.id === id);
    if (!c) continue;
    t.turnos -= 1;
    if (t.turnos > 0) continue;
    if (c.sangra) {
      // Sangramento: perde PV quando a contagem chega a 0 e sorteia o próximo intervalo, até o limite.
      const pv = c.sangra.pv ?? 1;
      if (p.pv) perderPv(p, pv);
      t.perdidos = (t.perdidos || 0) + pv;
      if (t.perdidos >= (c.sangra.maximo ?? 6)) {
        tirarCondicao(p, c);
        notas.push(`${c.nome}: perdeu ${pv} PV${p.pv ? ` (${textoPv(p)})` : ''} e o sangramento parou`);
      } else {
        t.turnos = rolar(c.sangra.intervalo, rng);
        notas.push(`${c.nome}: perdeu ${pv} PV${p.pv ? ` (${textoPv(p)})` : ''}; próxima perda em ${t.turnos} turno(s)`);
      }
    } else {
      tirarCondicao(p, c);
      notas.push(`${c.nome} terminou`);
    }
  }
  sincronizarEfeitos(p, sistema, { rng });
  return notas;
}

// Ação principal (ataque) de quem tem Ferida aberta: perde o PV indicado na condição.
export function efeitosAoAgir(p, sistema) {
  const notas = [];
  for (const c of condicoesAtivas(p, sistema)) {
    if (!c.pvPorAcao || !p.pv) continue;
    perderPv(p, c.pvPorAcao);
    notas.push(`${c.nome}: ${p.nome} perde ${c.pvPorAcao} PV ao agir (${textoPv(p)})`);
  }
  return notas;
}

// Lista para mostrar: condições ativas com ícone, quantas vezes e os turnos que faltam.
export function efeitosVisiveis(p, sistema) {
  return condicoesAtivas(p, sistema).map(c => {
    const t = p.efeitos?.[c.id];
    return {
      id: c.id, nome: c.nome, icone: c.icone || 'circle-alert', cor: c.cor || null, grupo: c.grupo, qtd: c.qtd, efeitos: c.efeitos,
      turnos: t ? t.turnos : null, sangra: c.sangra ? { perdidos: t?.perdidos || 0, maximo: c.sangra.maximo ?? 6 } : null,
    };
  });
}

// Restrição de movimento (para o círculo no peão do mapa): "preso" = deslocamento 0 (Paralisado, Enraizado,
// Imobilizado, Desmaiado); "restrito" = anda menos ou mal (membros inferiores, Caído, Exausto, Desorientado, Vertigem)
// ou carga acima do normal (só para quem enxerga os itens do personagem).
export function restricaoMovimento(p, sistema, derivadosFicha = null) {
  const motivos = [];
  let nivel = null;
  for (const e of condicoesAtivas(p, sistema)) {
    if (!e.movimento) continue;
    motivos.push(e.nome);
    if (e.movimento === 'preso') nivel = 'preso';
    else nivel ||= 'restrito';
  }
  const carga = derivadosFicha?.cargaNivel;
  if (carga && carga !== 'normal') {
    motivos.push(carga === 'supercarregado' ? 'Supercarregado' : 'Sobrecarregado');
    nivel ||= 'restrito';
  }
  return { nivel, motivos };
}

// Fim do turno e a carga (planilha de regras gerais):
// · Esmagado: perde 1 PV a cada 20 kg acima do levantamento (mínimo 1);
// · Supercarregado: lembra o teste de FOR muito difícil, 5% mais difícil a cada turno seguido.
//   Falhou: solta o peso que puder (e fica Exausto) ou, sem poder soltar, fica Esmagado (o mestre marca).
export function cargaNoTurno(p, d) {
  const notas = [];
  const esmagado = (d.condicoes || []).some(c => c.esmagado);
  if (esmagado && p.pv) {
    const dano = Math.max(1, Math.floor((d.carga - d.cargaLevantamento) / 20));
    perderPv(p, dano);
    notas.push(`Esmagado: perdeu ${dano} PV (${textoPv(p)})`);
  }
  if (d.cargaNivel === 'supercarregado' && !esmagado) {
    p.turnosSupercarregado = (p.turnosSupercarregado || 0) + 1;
    const extra = 5 * (p.turnosSupercarregado - 1);
    notas.push(`Supercarregado: teste de FOR muito difícil${extra ? ` (mais ${extra}% difícil)` : ''}. Se falhar, solta o peso que puder e fica Exausto; sem poder soltar, fica Esmagado`);
  } else if (p.turnosSupercarregado) delete p.turnosSupercarregado;
  return notas;
}

// Descanso (livro, "Descansos, regeneração e outras regras"):
// · Curto (refeição de meia ração + 1 hora): 1 PV.
// · Longo (6 h de sono, ou 8 h em até duas partes): 1d4 PV por nível e 1d6 de Sanidade. Interrompido (sem voltar
//   a dormir): 1d2 PV por nível e 1 de Sanidade (autor). Sem Conforto (roupas), Abrigo (frio/chuva) ou Ergonomia
//   (acolchoado): −1 PV por dado lançado para cada critério que faltar, com mínimo geral de 1 PV.
//   Itens de proteção equipados tiram o Conforto. Testes dos marcadores: vulnerabilidade (doença) e genéticos (mutação);
//   depois todos os marcadores são zerados. As capacidades dos atributos voltam.
// cond: { confortavel, abrigado, ergonomico, interrompido }; percentualCONS: CONS% para os testes dos marcadores.
export function descansar(p, sistema, tipo, pvMax, cond = {}, percentualCONS = 0, rng = Math.random) {
  const notas = [];
  const longo = tipo === 'longo';
  // "conta": os dados da recuperação, para todos verem (autor, 27/10).
  const ganharPv = (n, conta = '') => {
    if (!p.pv || n <= 0) return;
    const antes = p.pv.atual;
    p.pv.atual = Math.min(pvMax ?? p.pv.max, p.pv.atual + n);
    notas.push(p.pv.atual > antes ? `+${p.pv.atual - antes} PV${conta ? ` — ${conta}` : ''} (${textoPv(p)})` : `PV já no máximo${conta ? ` (${conta})` : ''}`);
  };
  // Vantagens e defeitos: Absorver Nutrientes / Metabolismo Acelerado (curto 2 PV, +1 por dado), Regeneração Lenta (metade),
  // Soldado de Campanha (sem ônus de Conforto/Ergonomia; vantagem contra doença), Insônia e Insônia pós-traumática.
  const m = regrasNecessidades(p, sistema);
  const metade = n => (m.regenMetade ? Math.floor(n / 2) : n);
  const sono = () => { const c = (sistema.condicoes || []).find(x => x.id === 'sono'); if (c) (p.marcadores ||= []).push(c.nome); };
  if (!longo) {
    ganharPv(metade(m.curtoPv), `descanso curto: ${m.curtoPv} PV fixo`);
    if (m.regenMetade) notas.push('Regeneração Lenta: metade');
    return notas;
  }
  if (m.insoniaPos && !cond.interrompido) {
    const d10 = rolarDado('1d10', rng).total;
    if (d10 < 5) {
      ganharPv(metade(m.curtoPv));
      sono();
      notas.push(`Insônia pós-traumática (1d10 = ${d10}): o descanso conta só como curto e fica com Sono`);
      return notas;
    }
    notas.push(`Insônia pós-traumática (1d10 = ${d10}): dormiu`);
  }
  let reduzir = 1;
  if (m.insonia && !cond.interrompido) {
    const t = testeDMil(cond.CAR ?? 0, 100, sistema, { rng });
    if (!t.sucesso) { reduzir = 2; sono(); }
    notas.push(`Insônia: CAR% ${t.total} × ND 100 — ${t.sucesso ? 'dormiu bem' : 'metade da regeneração e fica com Sono'}`);
  }
  // PV: 1d4 por nível, −1 por dado para cada critério que faltar (mínimo geral 1).
  const protecao = (p.itens || []).some(i => i.equipado && i.tipo === 'defesa' && i.slot !== 'maos');
  const confortavel = cond.confortavel !== false && !protecao;
  const faltam = [!confortavel && !m.semOnusConfortoErgo && (protecao && cond.confortavel !== false ? 'Conforto (dormiu com proteção)' : 'Conforto'), cond.abrigado === false && 'Abrigo', cond.ergonomico === false && !m.semOnusConfortoErgo && 'Ergonomia'].filter(Boolean);
  if (m.semOnusConfortoErgo && (!confortavel || cond.ergonomico === false)) notas.push('Soldado de Campanha: sem ônus de Conforto/Ergonomia');
  const nivel = Math.max(1, p.nivel || 1);
  // Interrompido (autor): d2 por nível em vez de d4, e só 1 de Sanidade.
  const dados = nivel;
  const dado = cond.interrompido ? 'd2' : 'd4';
  const r = rolarDado(`${dados}${dado}`, rng);
  const pv = Math.floor(metade(Math.max(1, r.total + (m.pvPorDado - faltam.length) * dados)) / reduzir);
  const ajuste = (m.pvPorDado - faltam.length) * dados;
  ganharPv(Math.max(pv, 1), `${dados}${dado} [${r.dados.join(', ')}] = ${r.total}${ajuste ? ` ${ajuste > 0 ? '+' : '−'} ${Math.abs(ajuste)}` : ''}${m.regenMetade ? ' ÷ 2' : ''}${reduzir > 1 ? ' ÷ 2 (Insônia)' : ''}`);
  if (faltam.length) notas.push(`sem ${faltam.join(', ')}: −${faltam.length * dados} PV (${dados}${dado} = ${r.total})`);
  if (m.pvPorDado) notas.push(`Metabolismo Acelerado: +${m.pvPorDado * dados} PV`);
  if (m.regenMetade) notas.push('Regeneração Lenta: metade');
  if (cond.interrompido) notas.push(`descanso interrompido: ${dados}d2 de PV e 1 de Sanidade`);
  // Sanidade: 1d6 (interrompido: 1).
  if (p.sanidade) {
    const d6 = cond.interrompido ? null : rolarDado('1d6', rng).total;
    const ganho = cond.interrompido ? 1 : Math.max(reduzir === 2 ? 0 : 1, Math.floor(d6 / reduzir));
    const antes = p.sanidade.atual;
    p.sanidade.atual = Math.min(p.sanidade.max, p.sanidade.atual + ganho);
    const contaSan = cond.interrompido ? 'interrompido: 1 fixo' : `1d6 [${d6}]${reduzir > 1 ? ' ÷ 2' : ''}`;
    notas.push(p.sanidade.atual > antes ? `+${p.sanidade.atual - antes} Sanidade — ${contaSan} (${p.sanidade.atual}/${p.sanidade.max})` : `Sanidade já no máximo (${contaSan})`);
  }
  // Testes dos marcadores (CONS%) e depois zera os marcadores.
  const ativas = condicoesAtivas(p, sistema);
  const qtd = id => ativas.find(c => c.id === id)?.qtd || 0;
  const vul = qtd('vulnerabilidade');
  const gen = qtd('genetico');
  const doente = qtd('doenca') > 0;
  const doenca = (sistema.condicoes || []).find(c => c.id === 'doenca');
  // A conta inteira do teste (d100 + CONS% contra o ND), para o jogador ver.
  const teste = (nd, vant = false) => { const t = testeVantagem(percentualCONS, nd, sistema, vant, rng); return { ...t, txt: `teste de CONS%: d100 ${t.dp} + ${t.acao} = ${t.total} contra ND ${nd}${t.vantagem ? ' (com vantagem)' : ''}${t.critico ? ` — ${t.critico === 'acerto' ? 'acerto' : 'erro'} crítico` : ''}` }; };
  if (vul) {
    // Já doente: ND 70 + 10 × marcadores (livro, Doença). Saudável: ND 40 + 10 × marcadores (autor, provisório).
    const t = teste((doente ? 70 : 40) + 10 * vul, m.vantagemDoenca);
    if (!t.sucesso && doenca) p.marcadores.push(doenca.nome);
    notas.push(`${vul} marcador(es) de vulnerabilidade: ${t.txt} — ${t.sucesso ? 'resistiu' : doente ? 'a Doença se agravou' : 'ficou Doente'}`);
  } else if (doente) {
    const t = teste(70, m.vantagemDoenca);
    if (t.sucesso && doenca) tirarCondicao(p, doenca);
    notas.push(`Doença sem novos marcadores: ${t.txt} — ${t.sucesso ? 'curou-se' : 'continua doente'}`);
  }
  if (gen) {
    const t = teste(50 + 5 * gen);
    let txt = 'resistiu';
    if (!t.sucesso) {
      // Falhou: sorteia a mutação temporária na tabela (d100). Marcas do Destino: 5 mutações temporárias selam o Mutante.
      const mut = sortearMutacao(p, sistema, 'temporaria', rng);
      p.mutacoesSofridas = (p.mutacoesSofridas || 0) + 1;
      txt = mut ? `sofre uma MUTAÇÃO TEMPORÁRIA: ${mut.n}. ${mut.nome}` : 'sofre uma MUTAÇÃO TEMPORÁRIA (o mestre escolhe)';
      if (p.mutacoesSofridas === 5) txt += ' — 5ª mutação temporária: Marcas do Destino (pode se tornar Mutante)';
    }
    notas.push(`${gen} marcador(es) genético(s): ${t.txt} — ${txt}`);
  }
  for (const id of ['vulnerabilidade', 'genetico']) {
    const c = (sistema.condicoes || []).find(x => x.id === id);
    if (c && qtd(id)) tirarCondicao(p, c);
  }
  if (vul || gen) notas.push('marcadores zerados');
  if (p.capacidadesUsadas && Object.keys(p.capacidadesUsadas).length) {
    p.capacidadesUsadas = {};
    notas.push('capacidades recarregadas');
  }
  if (p.sanidade?.temporario || p.humanidade?.temporario) notas.push('falta o teste de Consciência (dano temporário)');
  return notas;
}
