// Mapas ligados e visão (autor, 01/11).
// - Mundo: o mapa ativo nas coordenadas de sempre (0,0 = canto de cima à esquerda) e os vizinhos colados nas bordas
//   (leste à direita, oeste à esquerda, norte em cima, sul embaixo). Um peão que passa da borda entra no vizinho.
// - Fog absoluta: o que nenhum personagem jogador viu ainda fica preto.
// - Fog pessoal: cada personagem enxerga um cone (90°, ou o campo de visão dele) para onde está olhando, até o alcance
//   da visão; o resto do que já foi visto fica escurecido (o que ele lembra/intui).
import { ladoNoMapa } from './monstros.js';
import { regrasObjeto, tamanhoObjeto } from './objetosMapa.js';

export const DIRECOES = [
  { g: 0, nome: 'Norte', seta: '↑' }, { g: 45, nome: 'Nordeste', seta: '↗' }, { g: 90, nome: 'Leste', seta: '→' }, { g: 135, nome: 'Sudeste', seta: '↘' },
  { g: 180, nome: 'Sul', seta: '↓' }, { g: 225, nome: 'Sudoeste', seta: '↙' }, { g: 270, nome: 'Oeste', seta: '←' }, { g: 315, nome: 'Noroeste', seta: '↖' },
];
export const LADOS = ['norte', 'sul', 'leste', 'oeste'];
export const OPOSTO = { norte: 'sul', sul: 'norte', leste: 'oeste', oeste: 'leste' };
export const CAMPO_VISAO_PADRAO = 90;
export const ALCANCE_VISAO_PADRAO = 16; // quadrados (24 m)

// Linhas da grade: a proporção (altura/largura) da imagem vem da tela do mestre; sem ela, 2/3.
export const linhasDoMapa = m => Math.max(1, Math.ceil((m?.grade?.colunas || 20) * (m?.grade?.proporcao || 2 / 3)));
export const colunasDoMapa = m => Math.max(1, m?.grade?.colunas || 20);

// Direção de um movimento (de → para) em graus (0 = norte, sentido horário), arredondada para uma das 8.
export function direcaoDoMovimento(de, para) {
  const dx = para.col - de.col, dy = para.lin - de.lin;
  if (!dx && !dy) return null;
  return (Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) / 45) * 45) % 360;
}

// Partes do mundo: o mapa ativo (dc = dl = 0) e os vizinhos diretos, cada um com o deslocamento em quadrados.
export function partesDoMundo(ativo, mapaPorId) {
  const partes = [{ mapa: ativo, dc: 0, dl: 0, lado: null }];
  for (const lado of LADOS) {
    const v = ativo?.vizinhos?.[lado] && mapaPorId(ativo.vizinhos[lado]);
    if (!v || v === ativo) continue;
    const dc = lado === 'leste' ? colunasDoMapa(ativo) : lado === 'oeste' ? -colunasDoMapa(v) : 0;
    const dl = lado === 'sul' ? linhasDoMapa(ativo) : lado === 'norte' ? -linhasDoMapa(v) : 0;
    partes.push({ mapa: v, dc, dl, lado });
  }
  return partes;
}
// Qual parte tem o quadrado (col, lin) do mundo.
export function parteNoQuadrado(partes, col, lin) {
  return partes.find(p => col >= p.dc && col < p.dc + colunasDoMapa(p.mapa) && lin >= p.dl && lin < p.dl + linhasDoMapa(p.mapa)) || null;
}

// Objetos que cortam a visão, por quadrado do mundo.
function bloqueiosDaVisao(partes) {
  const s = new Set();
  for (const p of partes) for (const o of p.mapa.objetos || []) {
    if (!regrasObjeto(o).visao) continue;
    const { l, a } = tamanhoObjeto(o);
    for (let i = 0; i < l; i++) for (let j = 0; j < a; j++) s.add(`${o.col + p.dc + i}:${o.lin + p.dl + j}`);
  }
  return s;
}

const difAngulo = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

// Quadrados do mundo que um peão enxerga. direcao null (ou campo 360) = em volta toda. O próprio quadrado e os
// vizinhos encostados sempre contam (ele sente o que está colado nele). A parede que corta a visão é vista.
export function quadradosVisiveis(partes, peca, lado = 1, { alcance = ALCANCE_VISAO_PADRAO, campo = 360, direcao = null } = {}, bloqueios = bloqueiosDaVisao(partes)) {
  const cx = peca.col + lado / 2, cy = peca.lin + lado / 2;
  const fora = new Set();
  for (let i = 0; i < lado; i++) for (let j = 0; j < lado; j++) fora.add(`${peca.col + i}:${peca.lin + j}`);
  const vistos = new Set();
  const r = alcance + lado / 2;
  for (let col = Math.floor(cx - r) - 1; col <= Math.ceil(cx + r); col++) {
    for (let lin = Math.floor(cy - r) - 1; lin <= Math.ceil(cy + r); lin++) {
      if (!parteNoQuadrado(partes, col, lin)) continue;
      const dx = col + 0.5 - cx, dy = lin + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      const k = `${col}:${lin}`;
      if (d <= lado / 2 + 1) { vistos.add(k); continue; }
      if (d > r + 0.5) continue;
      if (direcao != null && campo < 360 && difAngulo((Math.atan2(dx, -dy) * 180) / Math.PI, direcao) > campo / 2 + 0.01) continue;
      // Anda pela reta (passos de 1/4 de quadrado); um quadrado que corta a visão no meio do caminho esconde o resto.
      const passos = Math.ceil(d * 4);
      let livre = true;
      for (let n = 1; n < passos && livre; n++) {
        const q = `${Math.floor(cx + (dx * n) / passos)}:${Math.floor(cy + (dy * n) / passos)}`;
        if (q !== k && !fora.has(q) && bloqueios.has(q)) livre = false;
      }
      if (livre) vistos.add(k);
    }
  }
  return vistos;
}

// O que cada personagem jogador no mundo enxerga agora. fogPessoal: o cone para onde olha; sem ela, em volta toda.
// Devolve { [id]: Set de "col:lin" do mundo }.
export function visaoDosPJs(partes, personagens, { fogPessoal = false, alcance = ALCANCE_VISAO_PADRAO } = {}) {
  const bloqueios = bloqueiosDaVisao(partes);
  const fora = {};
  for (const parte of partes) {
    for (const [id, x] of Object.entries(parte.mapa.pecas || {})) {
      const p = personagens.find(y => y.id === id);
      if (!p || p.tipo !== 'pj' || (p.pv && p.pv.atual <= 0)) continue;
      const peca = { col: x.col + parte.dc, lin: x.lin + parte.dl };
      fora[id] = quadradosVisiveis(partes, peca, ladoNoMapa(p), {
        alcance: p.alcanceVisao || alcance,
        campo: fogPessoal ? p.campoVisao || CAMPO_VISAO_PADRAO : 360,
        direcao: fogPessoal ? (x.olhar ?? null) : null,
      }, bloqueios);
    }
  }
  return fora;
}

// Do mundo para o mapa de cada parte: { idDoMapa: ["col:lin" local, ...] }.
export function porMapa(partes, quadrados) {
  const fora = {};
  for (const k of quadrados) {
    const [col, lin] = k.split(':').map(Number);
    const p = parteNoQuadrado(partes, col, lin);
    if (p) (fora[p.mapa.id] ||= []).push(`${col - p.dc}:${lin - p.dl}`);
  }
  return fora;
}

// O peão (col, lin, lado) está em algum quadrado do conjunto?
export function pecaNoConjunto(conj, x, lado = 1) {
  for (let i = 0; i < lado; i++) for (let j = 0; j < lado; j++) if (conj.has(`${x.col + i}:${x.lin + j}`)) return true;
  return false;
}
// O objeto encosta em algum quadrado do conjunto?
export function objetoNoConjunto(conj, o) {
  const { l, a } = tamanhoObjeto(o);
  for (let i = 0; i < l; i++) for (let j = 0; j < a; j++) if (conj.has(`${o.col + i}:${o.lin + j}`)) return true;
  return false;
}

// ---------- Custo do movimento (livro, Movimentação) ----------
// Cada quadrado custa 1,5 m; caído, 4,5 m. Terreno acidentado (objeto "terreno difícil") custa o dobro — o natural
// (mato, água, entulho) não pesa para quem ignora terreno natural (Explorador dos Ermos, Tropa de elite). Atravessar um
// aliado: +1,5 m (o quadrado de chegada não conta). Anda pela reta do trecho, um quadrado por passo (diagonal = 1).
const NATURAIS = new Set(['arbusto', 'agua', 'entulho']);
export function custoDoTrecho(mapa, de, para, { caido = false, ignoraNatural = false, aliados = new Set() } = {}) {
  const dificeis = new Map();
  for (const o of mapa?.objetos || []) {
    const r = regrasObjeto(o);
    if (!r.dificil) continue;
    const { l, a } = tamanhoObjeto(o);
    for (let i = 0; i < l; i++) for (let j = 0; j < a; j++) dificeis.set(`${o.col + i}:${o.lin + j}`, NATURAIS.has(o.tipo));
  }
  const passos = Math.max(Math.abs(para.col - de.col), Math.abs(para.lin - de.lin));
  let metros = 0;
  for (let n = 1; n <= passos; n++) {
    const col = Math.round(de.col + ((para.col - de.col) * n) / passos), lin = Math.round(de.lin + ((para.lin - de.lin) * n) / passos);
    const k = `${col}:${lin}`;
    let m = caido ? 4.5 : 1.5;
    if (dificeis.has(k) && !(ignoraNatural && dificeis.get(k))) m *= 2;
    if (n < passos && aliados.has(k)) m += 1.5;
    metros += m;
  }
  return metros;
}
