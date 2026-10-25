// Objetos do mapa (autor, 25/10): o que cada um faz nas regras — cobertura (livro: parcial = −30% no ataque a
// distância; total = não pode ser alvejado), se bloqueia a passagem, se é terreno difícil, se bloqueia a visão
// (Esconder-se: fora da visão do inimigo) e se pode ser movido. Cada objeto ocupa l × a quadrados.
import { ladoNoMapa } from './monstros.js';

export const TIPOS_OBJETO = [
  // Cenário
  { id: 'parede', nome: 'Parede', icone: 'brick-wall', grupo: 'Cenário', cobertura: 'total', bloqueia: true, visao: true, movel: false, pintar: true },
  { id: 'pilar', nome: 'Pilar', icone: 'landmark', grupo: 'Cenário', cobertura: 'total', bloqueia: true, visao: true, movel: false },
  { id: 'arvore', nome: 'Árvore', icone: 'tree-pine', grupo: 'Cenário', cobertura: 'total', bloqueia: true, visao: true, movel: false },
  { id: 'veiculo', nome: 'Veículo', icone: 'car', grupo: 'Cenário', cobertura: 'total', bloqueia: true, visao: true, movel: true, l: 2, a: 4 },
  { id: 'mesa', nome: 'Mesa', icone: 'table', grupo: 'Cenário', cobertura: 'parcial', dificil: true, movel: true, l: 2, a: 1 },
  { id: 'caixote', nome: 'Caixote', icone: 'package', grupo: 'Cenário', cobertura: 'parcial', dificil: true, movel: true },
  { id: 'barril', nome: 'Barril', icone: 'cylinder', grupo: 'Cenário', cobertura: 'parcial', dificil: true, movel: true },
  { id: 'cadeira', nome: 'Cadeira', icone: 'armchair', grupo: 'Cenário', dificil: true, movel: true },
  { id: 'arbusto', nome: 'Arbusto / mato alto', icone: 'sprout', grupo: 'Cenário', dificil: true, visao: true, movel: false, pintar: true },
  { id: 'agua', nome: 'Água rasa', icone: 'waves', grupo: 'Cenário', dificil: true, movel: false, pintar: true },
  { id: 'entulho', nome: 'Entulho', icone: 'mountain', grupo: 'Cenário', dificil: true, movel: false, pintar: true },
  // Marcadores (como antes)
  { id: 'cobertura', nome: 'Cobertura (genérica)', icone: 'shield', grupo: 'Marcadores', cobertura: 'parcial', movel: true },
  { id: 'porta', nome: 'Porta (fechada)', icone: 'door-closed', grupo: 'Marcadores', cobertura: 'total', bloqueia: true, visao: true, movel: false },
  { id: 'armadilha', nome: 'Armadilha', icone: 'triangle-alert', grupo: 'Marcadores' },
  { id: 'perigo', nome: 'Perigo', icone: 'flame', grupo: 'Marcadores' },
  { id: 'bau', nome: 'Baú', icone: 'package', grupo: 'Marcadores', movel: true },
  { id: 'objeto', nome: 'Objeto', icone: 'box', grupo: 'Marcadores', movel: true },
];
export const tipoObjeto = id => TIPOS_OBJETO.find(t => t.id === id) || TIPOS_OBJETO.find(t => t.id === 'objeto');
// Regras do objeto: as do tipo, com o que o mestre mudou nele (ex.: porta aberta = sem cobertura).
export const regrasObjeto = o => ({ ...tipoObjeto(o.tipo), ...(o.regras || {}) });
export const tamanhoObjeto = o => ({ l: Math.max(1, o.l || tipoObjeto(o.tipo).l || 1), a: Math.max(1, o.a || tipoObjeto(o.tipo).a || 1) });

// Quadrados ocupados por cada objeto: "col:lin" → [objetos].
export function mapaDeObjetos(objetos) {
  const m = new Map();
  for (const o of objetos || []) {
    const { l, a } = tamanhoObjeto(o);
    for (let i = 0; i < l; i++) for (let j = 0; j < a; j++) { const k = `${o.col + i}:${o.lin + j}`; (m.get(k) || m.set(k, []).get(k)).push(o); }
  }
  return m;
}

const pegada = (x, lado) => { const s = new Set(); for (let i = 0; i < lado; i++) for (let j = 0; j < lado; j++) s.add(`${x.col + i}:${x.lin + j}`); return s; };

// Objetos no caminho entre dois peões: anda pela reta entre os centros (passos de 1/8 de quadrado) e junta os objetos
// dos quadrados por onde passa — sem contar os quadrados dos próprios peões.
export function objetosEntre(pecaA, ladoA, pecaB, ladoB, objetos, mapa = mapaDeObjetos(objetos)) {
  const ax = pecaA.col + ladoA / 2, ay = pecaA.lin + ladoA / 2, bx = pecaB.col + ladoB / 2, by = pecaB.lin + ladoB / 2;
  const fora = new Set([...pegada(pecaA, ladoA), ...pegada(pecaB, ladoB)]);
  const achados = new Set();
  const passos = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 8));
  for (let i = 1; i < passos; i++) {
    const x = ax + ((bx - ax) * i) / passos, y = ay + ((by - ay) * i) / passos;
    const k = `${Math.floor(x)}:${Math.floor(y)}`;
    if (fora.has(k)) continue;
    for (const o of mapa.get(k) || []) achados.add(o);
  }
  return [...achados];
}

// Cobertura do alvo pelo mapa: a maior entre os objetos no caminho ('total' > 'parcial' > null).
export function coberturaPeloMapa(c, idAtacante, idAlvo) {
  const pa = c.mapa?.pecas?.[idAtacante], pb = c.mapa?.pecas?.[idAlvo];
  if (!pa || !pb) return null;
  const lado = id => ladoNoMapa((c.personagens || []).find(p => p.id === id));
  const no = objetosEntre(pa, lado(idAtacante), pb, lado(idAlvo), c.mapa.objetos || []).map(o => ({ o, r: regrasObjeto(o) })).filter(x => x.r.cobertura);
  const total = no.find(x => x.r.cobertura === 'total');
  if (total) return { nivel: 'total', objeto: total.o.nome || total.r.nome };
  const parcial = no.find(x => x.r.cobertura === 'parcial');
  return parcial ? { nivel: 'parcial', objeto: parcial.o.nome || parcial.r.nome } : null;
}

// A vê B? Só objetos que bloqueiam a visão (parede, árvore, veículo, mato alto…) cortam a linha.
export function enxerga(c, idA, idB) {
  const pa = c.mapa?.pecas?.[idA], pb = c.mapa?.pecas?.[idB];
  if (!pa || !pb) return true;
  const lado = id => ladoNoMapa((c.personagens || []).find(p => p.id === id));
  return !objetosEntre(pa, lado(idA), pb, lado(idB), c.mapa.objetos || []).some(o => regrasObjeto(o).visao);
}

// NPCs fora da visão de todos os PJs que estão no mapa (para o mestre lembrar do Esconder-se / modo fantasma).
export function foraDaVisaoDosPJs(c) {
  const pecas = c.mapa?.pecas || {};
  const tipo = id => (c.personagens || []).find(p => p.id === id)?.tipo;
  const pjs = Object.keys(pecas).filter(id => tipo(id) === 'pj');
  if (!pjs.length) return [];
  return Object.keys(pecas).filter(id => tipo(id) === 'npc' && pjs.every(pj => !enxerga(c, pj, id)));
}

// Quadrados que um peão (col, lin, lado) ocuparia e que estão bloqueados por objeto (parede, árvore…).
export function bloqueadoPorObjeto(objetos, col, lin, lado = 1) {
  const m = mapaDeObjetos(objetos);
  for (const k of pegada({ col, lin }, lado)) {
    const o = (m.get(k) || []).find(x => regrasObjeto(x).bloqueia);
    if (o) return o;
  }
  return null;
}
