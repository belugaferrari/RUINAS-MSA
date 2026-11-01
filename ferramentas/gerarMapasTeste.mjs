// Gera as imagens dos mapas de teste (public/img/mapas-teste/*.svg) a partir de shared/mapasTeste.js.
// Uso: node ferramentas/gerarMapasTeste.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPAS_TESTE, PASSAGENS_TESTE } from '../shared/mapasTeste.js';

const Q = 64; // pixels por quadrado
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'public/img/mapas-teste');

// Sorteio com semente (o desenho sai sempre igual).
function sorteador(semente) {
  let s = semente >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const FUNDOS = {
  vila: { base: '#7a8a4a', pontos: ['#6c7c40', '#8a9a55', '#94875a'], caminho: '#a8916a' },
  floresta: { base: '#3d5a2c', pontos: ['#344f25', '#4a6a34', '#2f4421'] },
  praia: { base: '#d9c08a', pontos: ['#cdb47e', '#e3cc98', '#c4aa74'] },
  ruinas: { base: '#7b7a70', pontos: ['#6d6c63', '#8a897e', '#6a7a4a'] },
  caverna: { base: '#3a332c', pontos: ['#322b25', '#453d34', '#2b2520'] },
  continente: { base: '#1d4a66', pontos: ['#1a4560', '#22547a', '#18405a'] },
};

function svgDoMapa(m, n) {
  const rnd = sorteador(n * 7919 + 13);
  const W = m.colunas * Q, H = m.linhas * Q;
  const f = FUNDOS[m.fundo];
  const el = [];
  el.push(`<rect width="${W}" height="${H}" fill="${f.base}"/>`);
  for (let i = 0; i < m.colunas * m.linhas * 3; i++) {
    el.push(`<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${(2 + rnd() * 9).toFixed(1)}" fill="${f.pontos[Math.floor(rnd() * f.pontos.length)]}" opacity="0.55"/>`);
  }
  // Caminhos: a vila tem estradas ligando as quatro bordas (continuam nos vizinhos).
  if (m.fundo === 'vila') {
    el.push(`<rect x="0" y="${7 * Q}" width="${W}" height="${2 * Q}" fill="${f.caminho}" opacity="0.85"/>`);
    el.push(`<rect x="${11 * Q}" y="0" width="${2 * Q}" height="${H}" fill="${f.caminho}" opacity="0.85"/>`);
  }
  if (m.fundo === 'floresta') el.push(`<rect x="${12 * Q}" y="${7 * Q}" width="${W - 12 * Q}" height="${2 * Q}" fill="#7c6a48" opacity="0.6"/>`);
  if (m.fundo === 'praia') el.push(`<rect x="0" y="${7 * Q}" width="${8 * Q}" height="${2 * Q}" fill="#b89f6c" opacity="0.7"/>`);
  // Continente: ilhas de contorno irregular, com o nome de cada uma.
  for (const ilha of m.ilhas || []) {
    const pts = [];
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2, rr = ilha.r * Q * (0.75 + rnd() * 0.45);
      pts.push(`${(ilha.x * Q + Math.cos(ang) * rr).toFixed(0)},${(ilha.y * Q + Math.sin(ang) * rr * 0.8).toFixed(0)}`);
    }
    el.push(`<polygon points="${pts.join(' ')}" fill="#d8c48c" stroke="#efe2b0" stroke-width="10" opacity="0.95"/>`);
    el.push(`<polygon points="${pts.join(' ')}" fill="#6f8a45" transform="translate(${ilha.x * Q * 0.12} ${ilha.y * Q * 0.12}) scale(0.88)" opacity="0.9"/>`);
    el.push(`<text x="${ilha.x * Q}" y="${ilha.y * Q}" font-family="Georgia, serif" font-size="${Q * 1.1}" fill="#2a1d0e" text-anchor="middle" stroke="#f5ecd0" stroke-width="6" paint-order="stroke">${ilha.nome}</text>`);
  }
  if (m.fundo === 'ruinas') el.push(`<rect x="${11 * Q}" y="${8 * Q}" width="${2 * Q}" height="${H - 8 * Q}" fill="#9a9480" opacity="0.6"/>`);
  for (const o of m.objetos) {
    const x = o.col * Q, y = o.lin * Q, w = (o.l || 1) * Q, h = (o.a || 1) * Q;
    const cx = x + w / 2, cy = y + h / 2;
    if (o.tipo === 'parede') {
      const cor = m.fundo === 'caverna' ? '#1c1814' : m.fundo === 'ruinas' ? '#55524a' : '#4a3b2c';
      el.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cor}" stroke="#00000088" stroke-width="3"/>`);
    } else if (o.tipo === 'arvore') {
      el.push(`<circle cx="${cx + 4}" cy="${cy + 6}" r="${Q * 0.48}" fill="#00000040"/>`);
      el.push(`<circle cx="${cx}" cy="${cy}" r="${Q * 0.46}" fill="#2c4a1e"/><circle cx="${cx - 8}" cy="${cy - 8}" r="${Q * 0.28}" fill="#3e6a2a"/>`);
    } else if (o.tipo === 'arbusto') {
      for (let i = 0; i < (o.l || 1) * (o.a || 1) * 5; i++) el.push(`<circle cx="${(x + rnd() * w).toFixed(1)}" cy="${(y + rnd() * h).toFixed(1)}" r="${(8 + rnd() * 10).toFixed(1)}" fill="#5c8a3a" opacity="0.85"/>`);
    } else if (o.tipo === 'agua') {
      el.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3f7fa6" opacity="0.85"/>`);
      for (let i = 0; i < (o.l || 1) * (o.a || 1) * 2; i++) el.push(`<path d="M${(x + rnd() * (w - 30)).toFixed(0)} ${(y + 10 + rnd() * (h - 20)).toFixed(0)} q8 -6 16 0 t16 0" stroke="#bfe3f5" stroke-width="2" fill="none" opacity="0.7"/>`);
    } else if (o.tipo === 'entulho') {
      for (let i = 0; i < (o.l || 1) * (o.a || 1) * 3; i++) {
        const px = x + 8 + rnd() * (w - 16), py = y + 8 + rnd() * (h - 16), r = 6 + rnd() * 10;
        el.push(`<polygon points="${px - r},${py} ${px},${py - r} ${px + r},${py + r / 2}" fill="#6b5a48" stroke="#3a3028" stroke-width="2"/>`);
      }
    } else if (o.tipo === 'pilar') {
      el.push(`<circle cx="${cx}" cy="${cy}" r="${Q * 0.4}" fill="#8d8a80" stroke="#3d3b36" stroke-width="4"/>`);
    } else if (o.tipo === 'veiculo') {
      el.push(`<path d="M${x + 6} ${y + 18} Q${cx} ${y - 10} ${x + w - 6} ${y + 18} L${x + w - 8} ${y + h - 8} L${x + 8} ${y + h - 8} Z" fill="#7a5532" stroke="#3a2614" stroke-width="4"/>`);
    } else if (o.tipo === 'caixote' || o.tipo === 'bau') {
      el.push(`<rect x="${x + 8}" y="${y + 10}" width="${w - 16}" height="${h - 20}" fill="${o.tipo === 'bau' ? '#8a5a20' : '#9a7444'}" stroke="#4a3418" stroke-width="4"/>`);
      el.push(`<line x1="${x + 8}" y1="${cy}" x2="${x + w - 8}" y2="${cy}" stroke="#4a3418" stroke-width="3"/>`);
    } else if (o.tipo === 'barril') {
      el.push(`<circle cx="${cx}" cy="${cy}" r="${Q * 0.32}" fill="#7c5430" stroke="#3a2614" stroke-width="4"/>`);
    } else if (o.tipo === 'mesa') {
      el.push(`<rect x="${x + 4}" y="${y + 12}" width="${w - 8}" height="${h - 24}" fill="#8a6a40" stroke="#4a3418" stroke-width="3"/>`);
    }
  }
  for (const p of PASSAGENS_TESTE[m.chave] || []) {
    const x = p.col * Q, y = p.lin * Q;
    el.push(`<rect x="${x + 4}" y="${y + 4}" width="${Q - 8}" height="${Q - 8}" fill="#1a1612" stroke="#c9a24a" stroke-width="3"/>`);
    for (let i = 1; i < 5; i++) el.push(`<line x1="${x + 8}" y1="${y + 8 + i * 10}" x2="${x + Q - 8}" y2="${y + 8 + i * 10}" stroke="#c9a24a" stroke-width="3"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${el.join('\n')}\n</svg>\n`;
}

fs.mkdirSync(DESTINO, { recursive: true });
MAPAS_TESTE.forEach((m, i) => {
  const arq = path.join(DESTINO, path.basename(m.url));
  fs.writeFileSync(arq, svgDoMapa(m, i));
  console.log(arq);
});
