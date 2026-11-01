// Clima no mapa (autor, 01/11): efeito indicativo por cima da vista — chuva, tempestade, neve, vento, névoa, calor,
// cinzas. Não altera a imagem do mapa. Uma tela (canvas) só, reaproveitada entre as atualizações, com a animação
// rodando enquanto o mapa estiver na página. Com "reduzir movimento" no sistema, o desenho fica parado.
import { h } from '../ui.js';

export const EFEITOS_CLIMA = [
  { id: '', nome: 'Sem efeito' },
  { id: 'chuva', nome: 'Chuva' },
  { id: 'tempestade', nome: 'Tempestade (chuva forte e raios)' },
  { id: 'neve', nome: 'Neve' },
  { id: 'vento', nome: 'Vento' },
  { id: 'nevoa', nome: 'Névoa' },
  { id: 'calor', nome: 'Calor intenso' },
  { id: 'cinzas', nome: 'Cinzas / areia' },
];
// Sugestão a partir do clima do dia (aba Tempo).
export function sugestaoDoClima(clima) {
  const n = String(clima?.nome || '').toLowerCase();
  if (n.includes('tormenta')) return 'tempestade';
  if (n.includes('frio')) return 'neve';
  if (n.includes('calor')) return 'calor';
  return '';
}

let tela = null, ctx = null, cfg = null, particulas = [], quadro = 0, laco = null, ultimoRaio = 0;
const reduzir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function novaParticula(w, hh, inicio) {
  return { x: Math.random() * w, y: inicio ? Math.random() * hh : -10, v: 0.6 + Math.random() * 0.8, t: Math.random() * 1000, r: Math.random() };
}
function preparar(w, hh) {
  const n = { chuva: 140, tempestade: 260, neve: 120, vento: 40, cinzas: 110, nevoa: 6, calor: 0 }[cfg.efeito] || 0;
  particulas = Array.from({ length: Math.round(n * (cfg.intensidade || 2) / 2) }, () => novaParticula(w, hh, true));
}
function desenhar() {
  if (!tela?.isConnected || !cfg?.efeito || !ctx) { laco = null; return; }
  const w = tela.clientWidth, hh = tela.clientHeight;
  if (!w || !hh) { laco = requestAnimationFrame(desenhar); return; }
  if (tela.width !== w || tela.height !== hh) { tela.width = w; tela.height = hh; preparar(w, hh); }
  quadro++;
  const ang = ((cfg.vento ?? 180) * Math.PI) / 180; // para onde o vento sopra (0 = norte, 90 = leste…)
  const vx = Math.sin(ang), vy = -Math.cos(ang);
  const k = cfg.intensidade || 2;
  ctx.clearRect(0, 0, w, hh);
  const e = cfg.efeito;
  if (e === 'chuva' || e === 'tempestade') {
    ctx.strokeStyle = e === 'tempestade' ? 'rgba(200,215,240,.55)' : 'rgba(190,210,235,.45)';
    ctx.lineWidth = e === 'tempestade' ? 1.6 : 1.2;
    ctx.beginPath();
    for (const p of particulas) {
      const vel = (e === 'tempestade' ? 16 : 11) * p.v;
      const dx = vx * 4 * k, dy = vel;
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + dx, p.y + dy * 1.2);
      p.x += dx; p.y += dy;
      if (p.y > hh || p.x < -20 || p.x > w + 20) Object.assign(p, novaParticula(w, hh, false), { x: Math.random() * (w + 200) - 100 });
    }
    ctx.stroke();
    if (e === 'tempestade') {
      if (!reduzir() && Math.random() < 0.004 * k && quadro - ultimoRaio > 90) ultimoRaio = quadro;
      const f = quadro - ultimoRaio;
      if (ultimoRaio && f < 10) { ctx.fillStyle = `rgba(230,240,255,${(10 - f) / 25})`; ctx.fillRect(0, 0, w, hh); }
      ctx.fillStyle = 'rgba(10,15,30,.18)'; ctx.fillRect(0, 0, w, hh);
    }
  } else if (e === 'neve' || e === 'cinzas') {
    ctx.fillStyle = e === 'neve' ? 'rgba(255,255,255,.85)' : 'rgba(120,105,90,.75)';
    for (const p of particulas) {
      const raio = (e === 'neve' ? 1.5 : 1.1) + p.r * 2.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, raio, 0, Math.PI * 2); ctx.fill();
      p.t += 0.03;
      p.x += vx * 1.2 * k + Math.sin(p.t) * 0.6; p.y += (e === 'neve' ? 1.1 : 0.7) * p.v + Math.max(0, vy) * k;
      if (p.y > hh + 5 || p.x < -10 || p.x > w + 10) Object.assign(p, novaParticula(w, hh, false), { x: Math.random() * (w + 200) - 100 });
    }
    if (e === 'cinzas') { ctx.fillStyle = 'rgba(120,90,60,.12)'; ctx.fillRect(0, 0, w, hh); }
  } else if (e === 'vento') {
    ctx.strokeStyle = 'rgba(235,235,225,.35)'; ctx.lineWidth = 1.5;
    for (const p of particulas) {
      const len = 40 + p.r * 60;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + vx * len / 2 + vy * 8, p.y + vy * len / 2 - vx * 8, p.x + vx * len, p.y + vy * len);
      ctx.stroke();
      p.x += vx * 6 * p.v * k; p.y += vy * 6 * p.v * k;
      if (p.x < -100 || p.x > w + 100 || p.y < -100 || p.y > hh + 100) Object.assign(p, { x: vx > 0 ? -50 : vx < 0 ? w + 50 : Math.random() * w, y: vy > 0 ? -50 : vy < 0 ? hh + 50 : Math.random() * hh });
      if (Math.abs(vx) > 0.3 && (p.y < -100 || p.y > hh + 100 || Math.random() < 0.002)) p.y = Math.random() * hh;
      if (Math.abs(vy) > 0.3 && Math.random() < 0.002) p.x = Math.random() * w;
    }
  } else if (e === 'nevoa') {
    for (const p of particulas) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, w * 0.35);
      g.addColorStop(0, `rgba(210,215,220,${0.10 * k})`); g.addColorStop(1, 'rgba(210,215,220,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
      p.x += vx * 0.4 * k; p.y += vy * 0.4 * k;
      if (p.x < -w * 0.3) p.x = w * 1.3; if (p.x > w * 1.3) p.x = -w * 0.3; if (p.y < -hh * 0.3) p.y = hh * 1.3; if (p.y > hh * 1.3) p.y = -hh * 0.3;
    }
  } else if (e === 'calor') {
    const a = 0.08 + 0.04 * k + Math.sin(quadro / 40) * 0.02;
    ctx.fillStyle = `rgba(255,140,40,${a})`; ctx.fillRect(0, 0, w, hh);
  }
  laco = reduzir() ? null : requestAnimationFrame(desenhar);
}

// Camada de clima do mapa (o mesmo canvas entre as atualizações; a animação não recomeça).
export function camadaClima(mapa) {
  const c = mapa?.clima;
  if (!c?.efeito) { cfg = null; return null; }
  const mudou = !cfg || cfg.efeito !== c.efeito || cfg.intensidade !== c.intensidade;
  cfg = { ...c };
  if (!tela) { tela = h('canvas', { class: 'mapa-clima', 'aria-hidden': 'true' }); ctx = tela.getContext('2d'); }
  if (mudou && tela.width) preparar(tela.width, tela.height);
  if (!laco) laco = requestAnimationFrame(desenhar);
  return tela;
}
