import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './db.js';
import { ICONES } from '../public/js/icones.js';

const PASTA = path.join(RAIZ, 'node_modules', 'lucide-static', 'icons');

// Junta só os ícones usados pelo app em um único sprite SVG (funciona sem internet).
export function montarSprite() {
  const simbolos = ICONES.map(nome => {
    const svg = fs.readFileSync(path.join(PASTA, `${nome}.svg`), 'utf8');
    const corpo = svg.replace(/<!--.*?-->/s, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
    return `<symbol id="${nome}" viewBox="0 0 24 24">${corpo}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${simbolos.join('')}</svg>`;
}
