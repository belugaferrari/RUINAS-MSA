// Efeitos com tempo (Sangramento, Dor, Aturdido…): os marcadores dizem QUAIS efeitos o personagem tem;
// p.efeitos guarda os contadores de turno de cada um, por id da condição.
// A contagem anda no fim do turno de quem sofre o efeito (controle de turno do Campo de Batalha).
import { rolarDado, condicoesAtivas } from './regras.js';

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
    novo[c.id] = c.sangra
      ? { qtd: c.qtd, turnos: rolar(c.sangra.intervalo, rng), perdidos: 0 }
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
      if (p.pv) p.pv.atual -= pv;
      t.perdidos = (t.perdidos || 0) + pv;
      if (t.perdidos >= (c.sangra.maximo ?? 6)) {
        tirarCondicao(p, c);
        notas.push(`${c.nome}: perdeu ${pv} PV${p.pv ? ` (${p.pv.atual}/${p.pv.max})` : ''} e o sangramento parou`);
      } else {
        t.turnos = rolar(c.sangra.intervalo, rng);
        notas.push(`${c.nome}: perdeu ${pv} PV${p.pv ? ` (${p.pv.atual}/${p.pv.max})` : ''}; próxima perda em ${t.turnos} turno(s)`);
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
    p.pv.atual -= c.pvPorAcao;
    notas.push(`${c.nome}: ${p.nome} perde ${c.pvPorAcao} PV ao agir (${p.pv.atual}/${p.pv.max})`);
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
    p.pv.atual -= dano;
    notas.push(`Esmagado: perdeu ${dano} PV (${p.pv.atual}/${p.pv.max})`);
  }
  if (d.cargaNivel === 'supercarregado' && !esmagado) {
    p.turnosSupercarregado = (p.turnosSupercarregado || 0) + 1;
    const extra = 5 * (p.turnosSupercarregado - 1);
    notas.push(`Supercarregado: teste de FOR muito difícil${extra ? ` (mais ${extra}% difícil)` : ''}. Se falhar, solta o peso que puder e fica Exausto; sem poder soltar, fica Esmagado`);
  } else if (p.turnosSupercarregado) delete p.turnosSupercarregado;
  return notas;
}

// Descanso (planilha de regras gerais; o livro não traz números):
// · PV: longo completo recupera 1d4 × nível; curto, 1 PV. Nunca passa do máximo (que já desconta PV persistentes/permanentes).
// · Sanidade: longo +2, curto +1.
// · Termina o que dura "até o próximo descanso" (Dor, Trauma profundo).
// · Longo: devolve os usos das capacidades dos atributos.
export function descansar(p, sistema, tipo, pvMax, rng = Math.random) {
  const notas = [];
  const longo = tipo === 'longo';
  if (p.pv) {
    const ganho = longo ? rolarDado(`${Math.max(1, p.nivel || 1)}d4`, rng).total : 1;
    const antes = p.pv.atual;
    p.pv.atual = Math.min(pvMax ?? p.pv.max, p.pv.atual + ganho);
    if (p.pv.atual > antes) notas.push(`+${p.pv.atual - antes} PV (${p.pv.atual}/${p.pv.max})`);
  }
  if (p.sanidade) {
    const antes = p.sanidade.atual;
    p.sanidade.atual = Math.min(p.sanidade.max, p.sanidade.atual + (longo ? 2 : 1));
    if (p.sanidade.atual > antes) notas.push(`+${p.sanidade.atual - antes} Sanidade`);
  }
  for (const c of condicoesAtivas(p, sistema).filter(x => x.terminaNoDescanso)) {
    tirarCondicao(p, c);
    if (p.efeitos) delete p.efeitos[c.id];
    notas.push(`${c.nome} terminou`);
  }
  if (longo && p.capacidadesUsadas && Object.keys(p.capacidadesUsadas).length) {
    p.capacidadesUsadas = {};
    notas.push('capacidades recarregadas');
  }
  if (longo && (p.sanidade?.temporario || p.humanidade?.temporario)) notas.push('falta o teste de Consciência (dano temporário)');
  return notas;
}
