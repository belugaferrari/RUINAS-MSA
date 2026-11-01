// Extensão de mapa feita com IA (autor, 01/11): a IA devolve um plano (piso, terrenos, caminhos, objetos na grade) e o
// app desenha a imagem (SVG) e cria os objetos de regra (paredes, árvores, água…) — a fog e a cobertura já funcionam.
import { TIPOS_IA, tipoObjeto } from './objetosMapa.js';

export const PISOS = {
  grama: { base: '#6f8a45', pontos: ['#62793c', '#7d9a50', '#859356'] },
  mato: { base: '#3d5a2c', pontos: ['#344f25', '#4a6a34', '#2f4421'] },
  terra: { base: '#8a7350', pontos: ['#7c6646', '#97805a', '#6f5c40'] },
  areia: { base: '#d9c08a', pontos: ['#cdb47e', '#e3cc98', '#c4aa74'] },
  pedra: { base: '#7b7a70', pontos: ['#6d6c63', '#8a897e', '#66655c'] },
  neve: { base: '#e6eef2', pontos: ['#d5e1e8', '#f2f7f9', '#c9d6de'] },
  lama: { base: '#5a4a35', pontos: ['#4e402e', '#66553e', '#463a2a'] },
  piso: { base: '#7a6a58', pontos: ['#6e5f4f', '#857463', '#64574a'] },
  asfalto: { base: '#4a4a4c', pontos: ['#404042', '#555558', '#3a3a3c'] },
  agua: { base: '#3f7fa6', pontos: ['#3a7698', '#4a8bb2', '#336a8a'] },
  caverna: { base: '#3a332c', pontos: ['#322b25', '#453d34', '#2b2520'] },
};
const CAMINHOS = { terra: '#a8916a', pedra: '#9a9480', asfalto: '#3a3a3a', trilha: '#8c7a55', rio: '#3f7fa6', madeira: '#7a5a38' };
export const Q_PX = 64;

const num = (v, min, max, pad) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : pad; };

// Confere o plano da IA contra a grade (colunas × linhas) e joga fora o que não faz sentido.
export function planoValido(plano, colunas, linhas) {
  const p = plano && typeof plano === 'object' ? plano : {};
  const piso = PISOS[p.piso] ? p.piso : 'grama';
  const caixa = c => (Array.isArray(c) && c.length === 4 ? [num(c[0], 0, colunas - 1, 0), num(c[1], 0, linhas - 1, 0), num(c[2], 0, colunas - 1, 0), num(c[3], 0, linhas - 1, 0)] : null);
  const terrenos = (Array.isArray(p.terrenos) ? p.terrenos : []).slice(0, 40).map(t => ({ tipo: PISOS[t?.tipo] ? t.tipo : null, caixa: caixa(t?.caixa) }))
    .filter(t => t.tipo && t.caixa).map(t => ({ tipo: t.tipo, caixa: [Math.min(t.caixa[0], t.caixa[2]), Math.min(t.caixa[1], t.caixa[3]), Math.max(t.caixa[0], t.caixa[2]), Math.max(t.caixa[1], t.caixa[3])] }));
  const caminhos = (Array.isArray(p.caminhos) ? p.caminhos : []).slice(0, 12).map(c => ({
    tipo: CAMINHOS[c?.tipo] ? c.tipo : 'terra', largura: num(c?.largura, 1, 4, 2),
    pontos: (Array.isArray(c?.pontos) ? c.pontos : []).slice(0, 30).filter(pt => Array.isArray(pt) && pt.length === 2)
      .map(pt => [Math.max(-1, Math.min(colunas + 1, Number(pt[0]) || 0)), Math.max(-1, Math.min(linhas + 1, Number(pt[1]) || 0))]),
  })).filter(c => c.pontos.length >= 2);
  const objetos = (Array.isArray(p.objetos) ? p.objetos : []).slice(0, 200).filter(o => TIPOS_IA.includes(o?.tipo)).map(o => {
    const t = tipoObjeto(o.tipo);
    const col = num(o.col, 0, colunas - 1, 0), lin = num(o.lin, 0, linhas - 1, 0);
    return { tipo: o.tipo, nome: String(o.nome || t.nome).slice(0, 60), col, lin, l: Math.min(20, num(o.l, 1, colunas - col, t.l || 1)), a: Math.min(20, num(o.a, 1, linhas - lin, t.a || 1)) };
  });
  // Água dos terrenos e do rio também vira objeto de regra (terreno difícil).
  for (const t of terrenos.filter(x => x.tipo === 'agua')) {
    const [c0, l0, c1, l1] = t.caixa;
    for (let c = c0; c <= c1; c += 20) for (let l = l0; l <= l1; l += 20) objetos.push({ tipo: 'agua', nome: 'Água', col: c, lin: l, l: Math.min(20, c1 - c + 1), a: Math.min(20, l1 - l + 1) });
  }
  for (const r of caminhos.filter(x => x.tipo === 'rio')) {
    const vistos = new Set();
    for (let i = 1; i < r.pontos.length; i++) {
      const [x0, y0] = r.pontos[i - 1], [x1, y1] = r.pontos[i];
      const passos = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let n = 0; n <= passos; n++) {
        const x = Math.floor(x0 + ((x1 - x0) * n) / passos), y = Math.floor(y0 + ((y1 - y0) * n) / passos);
        for (let d = 0; d < r.largura; d++) {
          const k = `${x}:${y + d}`;
          if (x < 0 || y + d < 0 || x >= colunas || y + d >= linhas || vistos.has(k)) continue;
          vistos.add(k);
          objetos.push({ tipo: 'agua', nome: 'Rio', col: x, lin: y + d, l: 1, a: 1 });
        }
      }
    }
  }
  return { nome: String(p.nome || '').slice(0, 60), descricao: String(p.descricao || '').slice(0, 600), piso, terrenos, caminhos, objetos: objetos.slice(0, 400) };
}

function sorteador(semente) {
  let s = semente >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

// Desenha o plano (SVG, 64 px por quadrado).
export function svgDoPlano(plano, colunas, linhas, semente = 7) {
  const Q = Q_PX;
  const rnd = sorteador(semente);
  const W = colunas * Q, H = linhas * Q;
  const el = [];
  const fundo = (tipo, x, y, w, h, opacidade = 1, arredondar = true) => {
    const f = PISOS[tipo];
    el.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${arredondar ? Math.min(w, h) * 0.18 : 0}" fill="${f.base}" opacity="${opacidade}"/>`);
    for (let i = 0; i < (w * h) / (Q * Q) * 3; i++) el.push(`<circle cx="${(x + rnd() * w).toFixed(1)}" cy="${(y + rnd() * h).toFixed(1)}" r="${(2 + rnd() * 9).toFixed(1)}" fill="${f.pontos[Math.floor(rnd() * f.pontos.length)]}" opacity="${(0.55 * opacidade).toFixed(2)}"/>`);
  };
  fundo(plano.piso, 0, 0, W, H, 1, false);
  for (const t of plano.terrenos) {
    const [c0, l0, c1, l1] = t.caixa;
    fundo(t.tipo, c0 * Q, l0 * Q, (c1 - c0 + 1) * Q, (l1 - l0 + 1) * Q, 0.92);
  }
  for (const c of plano.caminhos) {
    const pts = c.pontos.map(([x, y]) => `${((x + 0.5) * Q).toFixed(0)},${((y + 0.5) * Q).toFixed(0)}`).join(' ');
    el.push(`<polyline points="${pts}" fill="none" stroke="${CAMINHOS[c.tipo]}" stroke-width="${c.largura * Q}" stroke-linecap="round" stroke-linejoin="round" opacity="${c.tipo === 'rio' ? 0.9 : 0.85}"/>`);
    if (c.tipo === 'rio') el.push(`<polyline points="${pts}" fill="none" stroke="#bfe3f5" stroke-width="3" stroke-dasharray="14 22" opacity="0.6"/>`);
  }
  for (const o of plano.objetos) {
    const x = o.col * Q, y = o.lin * Q, w = (o.l || 1) * Q, h = (o.a || 1) * Q;
    const cx = x + w / 2, cy = y + h / 2;
    if (o.tipo === 'parede') el.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${plano.piso === 'caverna' ? '#1c1814' : '#4a3b2c'}" stroke="#00000088" stroke-width="3"/>`);
    else if (o.tipo === 'pilar') el.push(`<circle cx="${cx}" cy="${cy}" r="${Q * 0.4}" fill="#8d8a80" stroke="#3d3b36" stroke-width="4"/>`);
    else if (o.tipo === 'arvore') el.push(`<circle cx="${cx + 4}" cy="${cy + 6}" r="${Q * 0.48}" fill="#00000040"/><circle cx="${cx}" cy="${cy}" r="${Q * 0.46}" fill="#2c4a1e"/><circle cx="${cx - 8}" cy="${cy - 8}" r="${Q * 0.28}" fill="#3e6a2a"/>`);
    else if (o.tipo === 'arbusto') { for (let i = 0; i < (o.l || 1) * (o.a || 1) * 5; i++) el.push(`<circle cx="${(x + rnd() * w).toFixed(1)}" cy="${(y + rnd() * h).toFixed(1)}" r="${(8 + rnd() * 10).toFixed(1)}" fill="#5c8a3a" opacity="0.85"/>`); }
    else if (o.tipo === 'agua') { if (o.nome !== 'Rio') el.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3f7fa6" opacity="0.85"/>`); }
    else if (o.tipo === 'entulho') { for (let i = 0; i < (o.l || 1) * (o.a || 1) * 3; i++) { const px = x + 8 + rnd() * (w - 16), py = y + 8 + rnd() * (h - 16), r = 6 + rnd() * 10; el.push(`<polygon points="${px - r},${py} ${px},${py - r} ${px + r},${py + r / 2}" fill="#6b5a48" stroke="#3a3028" stroke-width="2"/>`); } }
    else if (o.tipo === 'veiculo') el.push(`<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="14" fill="#5a5f66" stroke="#2a2d31" stroke-width="4"/>`);
    else if (o.tipo === 'caixote') el.push(`<rect x="${x + 8}" y="${y + 10}" width="${w - 16}" height="${h - 20}" fill="#9a7444" stroke="#4a3418" stroke-width="4"/>`);
    else if (o.tipo === 'barril') el.push(`<circle cx="${cx}" cy="${cy}" r="${Q * 0.32}" fill="#7c5430" stroke="#3a2614" stroke-width="4"/>`);
    else if (o.tipo === 'mesa' || o.tipo === 'cadeira') el.push(`<rect x="${x + 6}" y="${y + 12}" width="${w - 12}" height="${h - 24}" fill="#8a6a40" stroke="#4a3418" stroke-width="3"/>`);
    else if (o.tipo === 'porta') el.push(`<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" fill="#6a4a28" stroke="#c9a24a" stroke-width="3"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${el.join('\n')}\n</svg>\n`;
}

const NOME_LADO = { norte: 'norte', sul: 'sul', leste: 'leste', oeste: 'oeste' };
const BORDA = { leste: 'esquerda (oeste)', oeste: 'direita (leste)', norte: 'de baixo (sul)', sul: 'de cima (norte)' };
// Pedido para a IA: ela vê a imagem do mapa atual e devolve o plano da extensão.
export function pedidoExtensao({ lado, diretrizes, colunasAtual, linhasAtual, colunas, linhas }) {
  return [
    `A imagem é o mapa atual de um RPG pós-apocalíptico visto de cima, com ${colunasAtual} colunas × ${linhasAtual} linhas de quadrados (1 quadrado = 1,5 m).`,
    `Crie a EXTENSÃO que continua esse mapa para o ${NOME_LADO[lado]}: um mapa novo de ${colunas} colunas × ${linhas} linhas (col 0..${colunas - 1}, lin 0..${linhas - 1}; 0,0 = canto de cima à esquerda).`,
    `A borda ${BORDA[lado]} do mapa novo encosta na borda ${NOME_LADO[lado]} do mapa atual: estradas, rios, muros e o tipo de chão que chegam nessa borda do mapa atual devem continuar do mesmo ponto (mesma linha, se for leste/oeste; mesma coluna, se for norte/sul).`,
    `Diretrizes do mestre para o cenário: ${String(diretrizes || 'continue o cenário de forma coerente').slice(0, 1500)}`,
    'Devolva só JSON: {"nome": "nome curto do lugar", "descricao": "2 a 4 frases para o mestre ler", "piso": um de [grama, mato, terra, areia, pedra, neve, lama, piso, asfalto, agua, caverna],',
    ' "terrenos": [{"tipo": um dos pisos, "caixa": [col0, lin0, col1, lin1]}], "caminhos": [{"tipo": um de [terra, pedra, asfalto, trilha, rio, madeira], "largura": 1 a 4, "pontos": [[col, lin], ...]}],',
    ` "objetos": [{"tipo": um de [${TIPOS_IA.join(', ')}], "nome": "nome curto", "col": n, "lin": n, "l": largura em quadrados, "a": altura em quadrados}]}`,
    'Paredes: trechos retos e finos (l ou a = 1). Deixe espaço livre para os personagens andarem. No máximo 120 objetos.',
  ].join('\n');
}
export const ESQUEMA_EXTENSAO = {
  type: 'object', additionalProperties: false, required: ['nome', 'descricao', 'piso', 'terrenos', 'caminhos', 'objetos'],
  properties: {
    nome: { type: 'string' }, descricao: { type: 'string' }, piso: { type: 'string', enum: Object.keys(PISOS) },
    terrenos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'caixa'], properties: { tipo: { type: 'string', enum: Object.keys(PISOS) }, caixa: { type: 'array', items: { type: 'number' } } } } },
    caminhos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'largura', 'pontos'], properties: { tipo: { type: 'string', enum: Object.keys(CAMINHOS) }, largura: { type: 'number' }, pontos: { type: 'array', items: { type: 'array', items: { type: 'number' } } } } } },
    objetos: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'nome', 'col', 'lin', 'l', 'a'], properties: { tipo: { type: 'string', enum: TIPOS_IA }, nome: { type: 'string' }, col: { type: 'number' }, lin: { type: 'number' }, l: { type: 'number' }, a: { type: 'number' } } } },
  },
};
// Pedido para gerar a IMAGEM (Gemini): continuar a pintura no mesmo estilo.
export function pedidoImagemExtensao({ lado, diretrizes }) {
  return `Esta é a imagem de um mapa de RPG visto de cima (top-down, para grade de batalha). Pinte um mapa NOVO, do mesmo tamanho e no mesmo estilo, `
    + `que continue este para o ${NOME_LADO[lado]}: a borda ${BORDA[lado]} da imagem nova deve encaixar perfeitamente na borda ${NOME_LADO[lado]} desta (estradas, rios, chão e muros continuam). `
    + `Sem grade, sem texto, sem bordas, vista de cima. Cenário: ${String(diretrizes || 'continue de forma coerente').slice(0, 1500)}`;
}
