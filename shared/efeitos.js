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
      id: c.id, nome: c.nome, icone: c.icone || 'circle-alert', grupo: c.grupo, qtd: c.qtd, efeitos: c.efeitos,
      turnos: t ? t.turnos : null, sangra: c.sangra ? { perdidos: t?.perdidos || 0, maximo: c.sangra.maximo ?? 6 } : null,
    };
  });
}
