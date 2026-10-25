// Ataque em área no mapa (livro: raio, cone e linha; Evasão = metade do dano). Medidas em metros; 1 quadrado = 1,5 m.
// · Círculo: quadrados com o centro a até "raio" do centro escolhido.
// · Cone: sai de quem ataca na direção escolhida; a largura cresce metade do avanço para cada lado (o cone de 4,5 m
//   do livro pega até 7 quadrados: 1 + 3 + 3).
// · Linha: sai de quem ataca, 1 quadrado de largura.
import { ladoNoMapa } from './monstros.js';

export const FORMAS_AREA = [
  { id: 'circulo', nome: 'Círculo (raio)' },
  { id: 'cone', nome: 'Cone' },
  { id: 'linha', nome: 'Linha' },
];
const Q = 1.5;
const EPS = 1e-6;

// origem: { col, lin, lado } (peão de quem ataca); ponto: { x, y } em quadrados (fração), onde o ponteiro está.
export function quadradosDaArea({ forma, metros, origem, ponto, colunas = 60, linhas = 60 }) {
  const alcance = Math.max(0, Number(metros) || 0) / Q;
  const fora = new Set();
  if (!alcance || !ponto) return fora;
  const lado = origem?.lado || 1;
  const centroOrigem = origem ? { x: origem.col + lado / 2, y: origem.lin + lado / 2 } : null;
  const dentroDaOrigem = (col, lin) => origem && col >= origem.col && col < origem.col + lado && lin >= origem.lin && lin < origem.lin + lado;
  if (forma === 'circulo') {
    const cx = Math.floor(ponto.x) + 0.5, cy = Math.floor(ponto.y) + 0.5;
    const r = Math.ceil(alcance);
    for (let col = Math.floor(cx - r); col <= cx + r; col++) for (let lin = Math.floor(cy - r); lin <= cy + r; lin++) {
      if (col < 0 || lin < 0 || col >= colunas || lin >= linhas) continue;
      if (Math.hypot(col + 0.5 - cx, lin + 0.5 - cy) <= alcance + EPS) fora.add(`${col}:${lin}`);
    }
    return fora;
  }
  if (!centroOrigem) return fora;
  // Cone e linha: direção da origem até o ponto; o avanço conta a partir da borda do peão (criatura grande).
  let dx = ponto.x - centroOrigem.x, dy = ponto.y - centroOrigem.y;
  const n = Math.hypot(dx, dy);
  if (n < EPS) return fora;
  dx /= n; dy /= n;
  const borda = lado / 2 - 0.5;
  const r = Math.ceil(alcance + lado);
  for (let col = Math.floor(centroOrigem.x - r); col <= centroOrigem.x + r; col++) for (let lin = Math.floor(centroOrigem.y - r); lin <= centroOrigem.y + r; lin++) {
    if (col < 0 || lin < 0 || col >= colunas || lin >= linhas || dentroDaOrigem(col, lin)) continue;
    const vx = col + 0.5 - centroOrigem.x, vy = lin + 0.5 - centroOrigem.y;
    const avanco = vx * dx + vy * dy - borda;
    const lateral = Math.abs(vx * dy - vy * dx);
    if (avanco <= EPS || avanco > alcance + EPS) continue;
    if (forma === 'cone' ? lateral <= avanco / 2 + EPS : lateral <= lado / 2 + EPS) fora.add(`${col}:${lin}`);
  }
  return fora;
}

// Quem a área pega: qualquer quadrado do peão (criatura grande ocupa 2×2, 3×3) dentro da área.
export function atingidosPelaArea(quadrados, pecas, personagens, ignorar = []) {
  const ids = [];
  for (const [id, x] of Object.entries(pecas || {})) {
    if (ignorar.includes(id)) continue;
    const l = ladoNoMapa((personagens || []).find(p => p.id === id));
    let dentro = false;
    for (let i = 0; i < l && !dentro; i++) for (let j = 0; j < l && !dentro; j++) if (quadrados.has(`${x.col + i}:${x.lin + j}`)) dentro = true;
    if (dentro) ids.push(id);
  }
  return ids;
}

// Área escrita no texto do ataque/item ("raio de 3m", "cone de 4,5 m", "em linha 9m").
export function areaDoTexto(texto) {
  const t = String(texto || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const m = /(raio|cone|linha)[^0-9]{0,25}(\d+(?:[.,]\d+)?)\s*m\b/.exec(t);
  if (!m) return null;
  return { forma: m[1] === 'raio' ? 'circulo' : m[1], metros: Number(m[2].replace(',', '.')) };
}
