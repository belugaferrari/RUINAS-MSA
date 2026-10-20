// d10 em 3D (trapezoedro pentagonal de verdade, com as 10 faces em forma de pipa), feito com CSS 3D:
// cada face é um SVG posicionado no espaço; a luz é recalculada a cada quadro conforme o dado gira, e ele para
// com a face sorteada virada para quem olha. DP = dois d10 marfim (dezena "00"–"90" e unidade "0"–"9"); DS = d10 vermelho.

const R = 38; // raio do anel (px)
const Y0 = 6; // altura dos anéis
// Pontos do dado (y para baixo, z para quem olha, como no CSS). O ápice é calculado para as faces ficarem planas.
const ang = k => (2 * Math.PI * k) / 5;
const U = k => [R * Math.cos(ang(k)), -Y0, R * Math.sin(ang(k))];
const L = k => [R * Math.cos(ang(k) + Math.PI / 5), Y0, R * Math.sin(ang(k) + Math.PI / 5)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => mul(a, 1 / Math.hypot(...a));
// Ápice: o plano de U0, L0, U1 tem de passar por (0, -H, 0).
const H = (() => {
  const n = cross(sub(L(0), U(0)), sub(U(1), U(0)));
  return -(-Y0 + (n[0] * U(0)[0] + n[2] * U(0)[2]) / n[1]);
})();
const TOPO = [0, -H, 0];
const BAIXO = [0, H, 0];

// 10 faces: 5 de cima (ápice de cima) e 5 de baixo. Números como num d10 de verdade (opostos somam 9).
const FACES = [];
for (let k = 0; k < 5; k++) FACES.push({ pts: [TOPO, U(k), L(k), U(k + 1)], valor: [0, 2, 4, 6, 8][k] });
for (let k = 0; k < 5; k++) FACES.push({ pts: [BAIXO, L(k), U(k + 1), L(k + 1)], valor: [7, 5, 3, 1, 9][k] });
for (const f of FACES) {
  const [p0, p1, p2, p3] = f.pts;
  const centro = mul(add(add(p0, p1), add(p2, p3)), 0.25);
  let n = norm(cross(sub(p1, p0), sub(p3, p0)));
  if (dot(n, centro) < 0) n = mul(n, -1);
  const e1 = norm(sub(p2, p0)); // do ápice para a ponta oposta (o "pé" do número)
  const e2 = cross(n, e1);
  const loc = f.pts.map(p => [dot(sub(p, p0), e1), dot(sub(p, p0), e2)]);
  const minX = Math.min(...loc.map(q => q[0]));
  const minY = Math.min(...loc.map(q => q[1]));
  Object.assign(f, {
    n, e1, e2, centro,
    w: Math.max(...loc.map(q => q[0])) - minX, h: Math.max(...loc.map(q => q[1])) - minY,
    poli: loc.map(([x, y]) => `${(x - minX).toFixed(2)},${(y - minY).toFixed(2)}`).join(' '),
    origem: add(add(p0, mul(e1, minX)), mul(e2, minY)),
    // Onde fica o número: um pouco abaixo do centro da pipa, no rumo da ponta larga.
    nx: dot(sub(add(mul(centro, 0.82), mul(p2, 0.18)), p0), e1) - minX, ny: dot(sub(centro, p0), e2) - minY,
  });
}

// Matrizes 3×3 (linhas) e conversão para matrix3d do CSS (colunas).
const mat = (a, b, c) => [a, b, c];
const multM = (A, B) => A.map(l => [0, 1, 2].map(j => l[0] * B[0][j] + l[1] * B[1][j] + l[2] * B[2][j]));
const aplica = (M, v) => M.map(l => dot(l, v));
const transp = M => [0, 1, 2].map(j => M.map(l => l[j]));
function rotEixo(eixo, a) {
  const [x, y, z] = norm(eixo);
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}
const css3d = (M, t = [0, 0, 0]) => `matrix3d(${M[0][0]},${M[1][0]},${M[2][0]},0,${M[0][1]},${M[1][1]},${M[2][1]},0,${M[0][2]},${M[1][2]},${M[2][2]},0,${t[0]},${t[1]},${t[2]},1)`;

// Orientação final: a face sorteada de frente para quem olha, número em pé, com uma leve inclinação (vê-se o topo).
function orientacaoDaFace(f) {
  const alvo = transp(mat([0, 1, 0], [-1, 0, 0], [0, 0, 1])); // e1 → baixo da tela, e2 → esquerda, n → quem olha
  const deFace = mat(f.e1, f.e2, f.n); // linhas: leva coordenadas do mundo para a base da face
  const inclina = rotEixo([1, 0, 0], -0.32);
  return multM(inclina, multM(alvo, deFace));
}

const LUZ = norm([-0.35, -0.45, 0.9]);
const CORES = {
  dp: { base: [240, 233, 216], num: '#2a2318', borda: 'rgba(90,72,40,.55)' },
  ds: { base: [200, 40, 30], num: '#fff4ea', borda: 'rgba(40,0,0,.6)' },
};

// Cria um d10. tipo: 'dp' | 'ds'; dezena: mostra "00"–"90" nas faces (o dado das dezenas do DP).
export function criarD10(tipo, { dezena = false } = {}) {
  const cor = CORES[tipo] || CORES.dp;
  const raiz = document.createElement('div');
  raiz.className = `dado3d ${tipo}`;
  raiz.setAttribute('aria-hidden', 'true');
  const cena = document.createElement('div');
  cena.className = 'dado3d-cena';
  const sombra = document.createElement('div');
  sombra.className = 'dado3d-sombra';
  const corpo = document.createElement('div');
  corpo.className = 'dado3d-corpo';
  const faces = FACES.map(f => {
    const el = document.createElement('div');
    el.className = 'dado3d-face';
    el.style.width = `${f.w}px`;
    el.style.height = `${f.h}px`;
    el.style.transform = css3d(transp(mat(f.e1, f.e2, f.n)), f.origem);
    const rotulo = dezena ? `${f.valor}0`.padStart(2, '0') : String(f.valor);
    const sublinha = !dezena && (f.valor === 6 || f.valor === 9);
    el.innerHTML = `<svg width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}"><polygon points="${f.poli}" fill="currentColor" stroke="${cor.borda}" stroke-width="1.3" stroke-linejoin="round"/></svg>`
      + `<b style="left:${f.nx}px;top:${f.ny}px;color:${cor.num}${sublinha ? ';text-decoration:underline' : ''}">${rotulo}</b>`;
    corpo.append(el);
    return el;
  });
  cena.append(corpo);
  raiz.append(sombra, cena);

  let M = orientacaoDaFace(FACES[0]);
  const desenhar = (Mx, desloc = [0, 0, 0]) => {
    corpo.style.transform = css3d(Mx, desloc);
    FACES.forEach((f, i) => {
      const n = aplica(Mx, f.n);
      const difusa = Math.max(0, dot(n, LUZ));
      const brilho = Math.pow(Math.max(0, dot(n, norm(add(LUZ, [0, 0, 1])))), 24);
      const k = 0.42 + 0.68 * difusa;
      const c = cor.base.map(x => Math.round(Math.min(255, x * k + 255 * 0.55 * brilho)));
      faces[i].style.color = `rgb(${c.join(',')})`;
    });
  };
  desenhar(M);

  return {
    el: raiz,
    // Mostra o valor sem rolar.
    mostrar(valor) { M = orientacaoDaFace(faceDe(valor, dezena)); desenhar(M); raiz.classList.add('parado'); },
    // Rola e para no valor (0–9; ou 0–90 no das dezenas). Devolve uma promessa que resolve quando parar.
    rolar(valor, { duracao = 1200, atraso = 0 } = {}) {
      const final = orientacaoDaFace(faceDe(valor, dezena));
      const eixo = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() * 0.3]);
      const giro = (3 + Math.random() * 2) * Math.PI;
      raiz.classList.remove('parado');
      return new Promise(fim => {
        const inicio = performance.now() + atraso;
        const quadro = agora => {
          const t = Math.min(1, Math.max(0, (agora - inicio) / duracao));
          const e = 1 - Math.pow(1 - t, 3); // desacelera
          // Quica: cai de cima, bate duas vezes e assenta.
          const pulo = t < 0.45 ? -70 * (1 - t / 0.45) ** 2 : t < 0.7 ? -14 * Math.sin(((t - 0.45) / 0.25) * Math.PI) : -3 * Math.sin(((t - 0.7) / 0.3) * Math.PI) * (1 - t);
          desenhar(multM(rotEixo(eixo, giro * (1 - e)), final), [0, pulo, 0]);
          sombra.style.transform = `scale(${1 + pulo / 140})`;
          sombra.style.opacity = String(0.55 + pulo / 200);
          if (t < 1) requestAnimationFrame(quadro);
          else { raiz.classList.add('parado'); fim(); }
        };
        requestAnimationFrame(quadro);
      });
    },
  };
}

function faceDe(valor, dezena) {
  const v = dezena ? Math.round(valor / 10) % 10 : valor % 10;
  return FACES.find(f => f.valor === v) || FACES[0];
}
