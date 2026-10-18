// Arte do boneco do equipamento: uma figura masculina e uma feminina (escolhida pelo gênero da ficha),
// em pé sobre um pedestal de runas, com luz vindo da esquerda. Cada parte do corpo tem a sua camada
// (capacete, armadura, roupa, capa, colar e o que está em cada mão), que só aparece quando a parte está ocupada.
// As formas do corpo e das peças são desenhadas pela metade (lado esquerdo) e espelhadas, para ficarem simétricas.

// Espelha um caminho SVG (só comandos absolutos M L C Q Z) no eixo x = 100.
function espelhar(d) {
  let par = 0;
  return d.replace(/[MLCQZ]|-?\d*\.?\d+/g, t => {
    if (/[MLCQZ]/.test(t)) { par = 0; return t; }
    const v = par++ % 2 === 0 ? +(200 - parseFloat(t)).toFixed(2) : t;
    return String(v);
  });
}
// As duas metades de uma forma; "atrib" vai em cada metade.
const par = (d, atrib = '') => `<path d="${d}" ${atrib}/><path d="${espelhar(d)}" ${atrib}/>`;
// Contorno sem a costura do meio: primeiro as metades com traço grosso, depois o preenchimento por cima.
const solido = (d, preench, traco, larg = 2.4) =>
  `<g fill="${preench}" stroke="${traco}" stroke-width="${larg}" stroke-linejoin="round">${par(d)}</g><g fill="${preench}">${par(d)}</g>`;
const linhas = (d, cor, larg, op = 1) => `<g fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round" opacity="${op}">${par(d)}</g>`;

const DEFS = `<defs>
  <linearGradient id="bnPele" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="160" y2="0"><stop offset="0" stop-color="#f6dcb8"/><stop offset=".42" stop-color="#dcae80"/><stop offset=".78" stop-color="#b07b4c"/><stop offset="1" stop-color="#7d4f2c"/></linearGradient>
  <radialGradient id="bnVolume" gradientUnits="userSpaceOnUse" cx="88" cy="110" r="120"><stop offset="0" stop-color="#fff3df" stop-opacity=".35"/><stop offset=".5" stop-color="#fff3df" stop-opacity="0"/><stop offset="1" stop-color="#2a1608" stop-opacity=".45"/></radialGradient>
  <linearGradient id="bnLinho" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="140" y2="0"><stop offset="0" stop-color="#efe6d2"/><stop offset=".6" stop-color="#c9bb9c"/><stop offset="1" stop-color="#8d7f63"/></linearGradient>
  <linearGradient id="bnAco" gradientUnits="userSpaceOnUse" x1="50" y1="40" x2="150" y2="160"><stop offset="0" stop-color="#fbfcff"/><stop offset=".3" stop-color="#c3cad6"/><stop offset=".62" stop-color="#7d8696"/><stop offset="1" stop-color="#3d4350"/></linearGradient>
  <linearGradient id="bnAcoV" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5f7fb"/><stop offset=".5" stop-color="#a4adbb"/><stop offset="1" stop-color="#4a515e"/></linearGradient>
  <linearGradient id="bnOuro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#e0b04a"/><stop offset="1" stop-color="#83571a"/></linearGradient>
  <linearGradient id="bnOuroU" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="150" y2="0"><stop offset="0" stop-color="#fff0b5"/><stop offset=".5" stop-color="#d9a640"/><stop offset="1" stop-color="#7a5015"/></linearGradient>
  <linearGradient id="bnCouro" gradientUnits="userSpaceOnUse" x1="60" y1="0" x2="140" y2="0"><stop offset="0" stop-color="#9a6a3e"/><stop offset=".55" stop-color="#6b4424"/><stop offset="1" stop-color="#3b2312"/></linearGradient>
  <linearGradient id="bnTecido" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="150" y2="0"><stop offset="0" stop-color="#4f7aa6"/><stop offset=".55" stop-color="#2d4c70"/><stop offset="1" stop-color="#172a40"/></linearGradient>
  <linearGradient id="bnCalca" gradientUnits="userSpaceOnUse" x1="70" y1="0" x2="130" y2="0"><stop offset="0" stop-color="#5a4a3c"/><stop offset=".6" stop-color="#3a2f26"/><stop offset="1" stop-color="#211a14"/></linearGradient>
  <linearGradient id="bnCapa" gradientUnits="userSpaceOnUse" x1="30" y1="60" x2="170" y2="270"><stop offset="0" stop-color="#b23a2c"/><stop offset=".55" stop-color="#7a1f17"/><stop offset="1" stop-color="#3d0c08"/></linearGradient>
  <linearGradient id="bnCapaDentro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a0b07"/><stop offset="1" stop-color="#1c0503"/></linearGradient>
  <linearGradient id="bnLamina" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#d6dde7"/><stop offset=".52" stop-color="#9aa5b5"/><stop offset="1" stop-color="#5d6676"/></linearGradient>
  <linearGradient id="bnMadeira" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a32"/><stop offset="1" stop-color="#3f2410"/></linearGradient>
  <linearGradient id="bnCabeloM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4a2e"/><stop offset=".6" stop-color="#3b2614"/><stop offset="1" stop-color="#1e130a"/></linearGradient>
  <linearGradient id="bnCabeloF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a0522d"/><stop offset=".55" stop-color="#6a2c14"/><stop offset="1" stop-color="#341307"/></linearGradient>
  <radialGradient id="bnBrilho" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff8d6"/><stop offset=".4" stop-color="#ffd96a" stop-opacity=".7"/><stop offset="1" stop-color="#d4a640" stop-opacity="0"/></radialGradient>
  <radialGradient id="bnJoia" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d8fbff"/><stop offset=".4" stop-color="#3fc1d6"/><stop offset="1" stop-color="#0d4f63"/></radialGradient>
  <radialGradient id="bnPedestal" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#5a4c3c"/><stop offset="1" stop-color="#1d1712"/></radialGradient>
  <radialGradient id="bnAura" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".28"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
</defs>`;

// Pedestal de pedra com um anel de runas (aceso de leve).
const PEDESTAL = `<ellipse cx="100" cy="150" rx="92" ry="150" fill="url(#bnAura)"/>
  <ellipse cx="100" cy="293" rx="70" ry="11" fill="#120d09"/>
  <ellipse cx="100" cy="288" rx="70" ry="11" fill="url(#bnPedestal)" stroke="#6b5940" stroke-width="1.2"/>
  <ellipse cx="100" cy="288" rx="56" ry="7.5" fill="none" stroke="#d9b45a" stroke-width="1" stroke-dasharray="2 3 6 3" opacity=".75"/>
  <ellipse cx="100" cy="288" rx="44" ry="5.5" fill="none" stroke="#d9b45a" stroke-width=".6" opacity=".4"/>
  <ellipse cx="100" cy="287" rx="30" ry="4" fill="rgba(0,0,0,.45)"/>`;

// ---------- Corpos (metade esquerda; o resto é espelhado) ----------
const CORPO = {
  masculino: {
    cabeca: 'M100 14 C89 14 83 21 83 31 C83 39 85 44 89 48 C92 51 96 52.5 100 52.5 Z',
    corpo: 'M100 44 L91 44 C91 51 90 55 88 58.5 C80 62 70 62 63 65 C55 68 52 76 52 86 C50 98 49 110 48 122 C47 134 44 150 42 166 C41 171 39 175 37 179 C34 185 33 193 36 198 C39 202 44 200 45 194 C46 188 46 182 47 176 C50 160 54 142 56 128 C58 118 60 108 62 98 L66 94 C66 112 72 126 75 140 C74 150 72 158 72 166 C72 190 74 210 76 226 C77 236 76 246 78 258 C79 266 80 271 80 275 C76 279 71 283 73 287 L95 287 C96 282 94 278 93 274 C94 260 96 248 95 234 C95 226 96 222 96 218 C97 200 99 182 99 170 L100 168 Z',
    // Definição: clavícula, peitoral, abdômen, cotovelo, joelho, panturrilha.
    tracos: 'M90 63 C84 64 76 65 68 68 M100 76 C92 82 80 84 70 80 M70 80 C72 90 80 98 100 96 M86 104 C90 106 96 106 100 105 M88 116 C92 118 96 118 100 117 M89 128 C93 130 97 130 100 129 M76 124 C79 134 84 146 92 154 M52 120 C55 122 56 126 55 130 M80 216 C84 220 90 221 94 218 M80 236 C82 246 82 254 80 262',
    sombra: 'M100 96 C88 99 76 96 69 82 C69 92 72 100 76 104 C84 102 94 101 100 101 Z',
    roupaIntima: 'M100 150 L74 147 C73 155 72 160 72 166 C76 172 86 178 98 182 L100 182 Z',
    mao: [38, 189], // onde fica a mão direita (à esquerda da tela)
  },
  feminino: {
    cabeca: 'M100 17 C90.5 17 85.5 23 85.5 32 C85.5 40 87.5 45 91 48.5 C94 51.5 97 52.5 100 52.5 Z',
    corpo: 'M100 44 L92.5 44 C92.5 51 91.5 55 89.5 58.5 C83 62 76 63 70 66 C63 69 60 75 60 84 C58 96 57 108 56 120 C54 134 50 150 47 166 C46 171 44 175 42 179 C39 185 38 192 41 197 C44 201 48 199 49 193 C50 187 51 181 52 176 C56 160 60 142 62 128 C64 118 66 108 68 98 L70 95 C68 108 76 122 80 134 C78 144 71 154 70 166 C70 190 74 210 77 226 C78 236 77 246 79 258 C80 266 81 271 81 275 C77 279 73 283 75 287 L95 287 C96 282 94.5 278 93.5 274 C94.5 260 96 248 95.5 234 C95.5 226 96 222 96.5 218 C97 200 99 184 99 174 L100 172 Z',
    tracos: 'M91 63 C86 64 80 65 74 68 M73 86 C74 98 84 106 99 101 M90 120 C94 122 97 122 100 121 M79 136 C80 146 84 154 90 160 M56 118 C59 120 60 124 59 128 M81 216 C85 220 90 221 94 218 M81 236 C83 246 83 254 81 262',
    sombra: 'M99 101 C86 106 75 99 73 88 C72 96 74 104 78 108 C86 108 94 106 99 105 Z',
    roupaIntima: 'M100 152 L77 150 C74 156 71 161 70 167 C75 173 86 179 98 183 L100 183 Z',
    busto: 'M100 80 L80 79 C74 82 72 90 74 96 C78 104 90 106 99 100 L100 100 Z',
    mao: [42.5, 188],
  },
};

function rosto(g) {
  const f = g === 'feminino';
  const y = f ? 33.5 : 32.5;
  const olho = (x, lado) => `<path d="M${x - 3.6} ${y} C${x - 2} ${y - 2.2} ${x + 2} ${y - 2.2} ${x + 3.6} ${y} C${x + 2} ${y + 1.4} ${x - 2} ${y + 1.4} ${x - 3.6} ${y} Z" fill="#fbf4ea" stroke="#3a2412" stroke-width=".7"/>
    <circle cx="${x + lado * .3}" cy="${y - .1}" r="1.45" fill="${f ? '#3c6e4a' : '#4a3520'}"/><circle cx="${x + lado * .3}" cy="${y - .1}" r=".65" fill="#120a04"/><circle cx="${x - .3}" cy="${y - .7}" r=".4" fill="#fff"/>
    ${f ? `<path d="M${x - 3.8} ${y - .3} C${x - 2} ${y - 2.6} ${x + 2} ${y - 2.6} ${x + 3.9} ${y - .6}" fill="none" stroke="#1d0f05" stroke-width="1"/>` : ''}`;
  const sobr = f ? `M88.5 ${y - 4.4} C91 ${y - 6} 95 ${y - 5.8} 97.3 ${y - 4.6}` : `M87.5 ${y - 4} C90.5 ${y - 5.6} 94.5 ${y - 5.6} 97.5 ${y - 4.2}`;
  return `<g class="rosto">
    ${olho(93, 1)}${olho(107, -1)}
    ${linhas(sobr, f ? '#4a1e0c' : '#2a1a0c', f ? 1.1 : 1.6)}
    <path d="M99.5 ${y + 1} C99 ${y + 5} 98 ${y + 7} 97 ${y + 8.6} C98.6 ${y + 9.6} 101 ${y + 9.6} 102.6 ${y + 8.8}" fill="none" stroke="#7a4a26" stroke-width=".9" stroke-linecap="round" opacity=".8"/>
    ${f
    ? `<path d="M95.2 ${y + 13.2} C97.5 ${y + 12.2} 102.5 ${y + 12.2} 104.8 ${y + 13.2} C102.5 ${y + 15.8} 97.5 ${y + 15.8} 95.2 ${y + 13.2} Z" fill="#b5524a"/><path d="M95.2 ${y + 13.2} C97.5 ${y + 14} 102.5 ${y + 14} 104.8 ${y + 13.2}" fill="none" stroke="#6e2420" stroke-width=".6"/>
       <ellipse cx="89.5" cy="${y + 8}" rx="3" ry="1.8" fill="#e58a7a" opacity=".3"/><ellipse cx="110.5" cy="${y + 8}" rx="3" ry="1.8" fill="#c06a5a" opacity=".3"/>`
    : `<path d="M95 ${y + 13.4} C97.5 ${y + 14.6} 102.5 ${y + 14.6} 105 ${y + 13.4}" fill="none" stroke="#6a3a22" stroke-width="1.2" stroke-linecap="round"/>
       <path d="M88 ${y + 9} C90 ${y + 17} 95 ${y + 19.5} 100 ${y + 19.5} C105 ${y + 19.5} 110 ${y + 17} 112 ${y + 9}" fill="none" stroke="#3b2614" stroke-width="2.2" opacity=".28"/>`}
  </g>`;
}

const CABELO = {
  masculino: {
    atras: '',
    frente: `<path d="M83.2 33 C80.5 18 89 9.5 101 9.5 C113 9.5 121 17.5 117.2 33 C116.6 27 115 23 112 21 C106 23.5 98 23 92 20.5 C89 23 86 26 85 33.5 Z" fill="url(#bnCabeloM)" stroke="#170d05" stroke-width="1"/>
      <path d="M92 20.5 C96 15 104 13.5 112 21 M88 25 C90 18 96 13 104 12.5" fill="none" stroke="#8a6440" stroke-width=".9" opacity=".7"/>
      <path d="M83.6 33 L85 41 L86.4 33.5 Z M116.6 33 L115.2 41 L113.8 33.5 Z" fill="#2c1c0e"/>`,
  },
  feminino: {
    // Cabelo longo: a parte de trás cai pelas costas até o meio das costas.
    atras: `<path d="M86 24 C78 40 77 62 72 86 C70 100 74 112 80 118 C86 110 88 96 90 86 C94 80 106 80 110 86 C112 96 114 110 120 118 C126 112 130 100 128 86 C123 62 122 40 114 24 Z" fill="url(#bnCabeloF)" stroke="#220b03" stroke-width="1.2"/>`,
    frente: `<path d="M85 37 C81 20 90 12 100.5 12 C111 12 120 20 115.5 37 C114 30 111 25 107 22.5 C103 27 95 29 89 28 C87 30.5 86 33.5 85.6 37 Z" fill="url(#bnCabeloF)" stroke="#220b03" stroke-width="1"/>
      <path d="M85.6 36 C84 46 84 56 80 66 C86 62 88 52 88 42 Z M115 36 C116.5 46 116.5 56 120 66 C114 62 112 52 112 42 Z" fill="url(#bnCabeloF)" stroke="#220b03" stroke-width=".8"/>
      <path d="M89 27 C95 22 101 17 107 22.5 M92 17 C98 14 106 15 112 21 M86.5 34 C86 44 85 54 82.5 62" fill="none" stroke="#d4874f" stroke-width=".9" opacity=".6"/>`,
  },
};

function corpoNu(g) {
  const c = CORPO[g];
  const pele = d => solido(d, 'url(#bnPele)', '#4a2c16');
  return `${CABELO[g].atras}
  <g class="corpo-base">
    ${pele(c.corpo)}
    <g fill="url(#bnVolume)">${par(c.corpo)}</g>
    <g fill="#5a3418" opacity=".22">${par(c.sombra)}</g>
    ${linhas(c.tracos, '#6a3d1c', 1, .55)}
    ${g === 'feminino' ? `<g fill="url(#bnLinho)" stroke="#6b5d42" stroke-width="1">${par(c.busto)}</g><g fill="url(#bnLinho)">${par(c.busto)}</g>${linhas('M74 88 C82 92 92 92 100 90', '#8d7f63', .8, .7)}` : ''}
    <g fill="url(#bnLinho)" stroke="#6b5d42" stroke-width="1.1">${par(c.roupaIntima)}</g><g fill="url(#bnLinho)">${par(c.roupaIntima)}</g>
    ${linhas(g === 'feminino' ? 'M77 150 C86 153 94 154 100 154' : 'M74 147 C84 150 94 151 100 151', '#8d7f63', 1.2, .8)}
    ${pele(c.cabeca)}
    <g fill="url(#bnVolume)">${par(c.cabeca)}</g>
    ${par(g === 'feminino' ? 'M86 31 C84 30 83.5 34 85.5 37' : 'M83.6 30 C81.4 29 81 34 83.4 37', 'fill="url(#bnPele)" stroke="#4a2c16" stroke-width="1"')}
    ${rosto(g)}
    ${CABELO[g].frente}
  </g>`;
}

// ---------- Peças de equipamento ----------
// Capa (atrás do corpo), com a gola e os broches na frente.
function capa(g) {
  const o = g === 'feminino' ? 4 : 0;
  const atras = `M100 56 L${88 + o} 58 C${76 + o} 61 ${62 + o} 63 ${56 + o} 72 C${48 + o} 110 ${40 + o} 180 ${32 + o} 262 C${48 + o} 272 ${74} 276 100 273 Z`;
  return `<g class="camada camada-costas">
    <g fill="url(#bnCapaDentro)" stroke="#1c0503" stroke-width="1.6">${par(`M100 60 L${70 + o} 66 C${56 + o} 110 ${48 + o} 180 ${40 + o} 258 L100 262 Z`)}</g>
    ${solido(atras, 'url(#bnCapa)', '#2a0805', 1.8)}
    ${linhas(`M${62 + o} 96 C${56 + o} 150 ${50 + o} 210 ${46 + o} 266 M${74 + o} 110 C${70 + o} 170 ${66 + o} 230 ${66 + o} 272 M86 124 C85 180 86 240 88 274`, '#3d0c08', 1.3, .7)}
    ${linhas(`M${60 + o} 100 C${54 + o} 156 ${48 + o} 214 ${44 + o} 264`, '#e0705f', .8, .35)}
  </g>`;
}
function capaFrente(g) {
  const o = g === 'feminino' ? 4 : 0;
  return `<g class="camada camada-costas">
    ${solido(`M100 57 L${88 + o} 58.5 C${78 + o} 61 ${66 + o} 62 ${58 + o} 68 C${62 + o} 74 ${72 + o} 74 ${80 + o} 70 C${86 + o} 66 ${94} 64 100 64 Z`, 'url(#bnCapa)', '#2a0805', 1.4)}
    ${[0, 1].map(n => `<circle cx="${n ? 200 - 81 - o : 81 + o}" cy="67" r="5" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width="1"/><circle cx="${n ? 200 - 81 - o : 81 + o}" cy="67" r="2" fill="#8e1f17"/>`).join('')}
  </g>`;
}

// Roupa (vestimenta): túnica com cinto, calça e botas.
function vestimenta(g) {
  const f = g === 'feminino';
  const calca = f
    ? 'M100 140 L80 136 C78 146 71 154 70 166 C70 190 74 210 77 226 C78 236 77 246 79 258 L94 258 C94.5 248 96 240 95.5 234 C95.5 226 96 222 96.5 218 C97 200 99 184 99 174 L100 172 Z'
    : 'M100 140 L75 140 C74 150 72 158 72 166 C72 190 74 210 76 226 C77 236 76 246 78 258 L93 258 C94 248 96 240 95 234 C95 226 96 222 96 218 C97 200 99 182 99 170 L100 168 Z';
  const tunica = f
    ? 'M100 58 L90 59 C84 62 77 63 70 66 C63 69 59 75 59 84 C58 92 57 100 56 110 L65 112 C66 104 67 100 69 96 C68 108 75 121 79 134 C76 146 70 156 66 178 C76 186 90 188 100 187 Z'
    : 'M100 57 L88 59 C80 62 70 62 62 65 C54 68 51 76 51 86 C50 94 49 102 48 112 L58 114 C59 106 61 100 64 96 C65 110 70 124 74 140 C72 152 70 164 68 180 C80 186 92 188 100 187 Z';
  const bota = f
    ? 'M79 246 C78 256 80 266 81 274 C77 279 72 283 74 288.5 L95.5 288.5 C96.5 282 95 276 94 272 C95 262 96 254 96 246 Z'
    : 'M77 246 C76 256 78 266 79 274 C75 279 70 283 72 288.5 L95.5 288.5 C96.5 282 95 276 94 272 C95 262 96 254 96 246 Z';
  const cintoY = f ? 134 : 140;
  return `<g class="camada camada-vestimenta">
    ${solido(calca, 'url(#bnCalca)', '#120c08', 1.6)}
    ${linhas(f ? 'M80 168 C82 190 84 206 86 222' : 'M78 168 C80 190 82 206 84 222', '#000', 1, .35)}
    ${solido(tunica, 'url(#bnTecido)', '#0c1826', 1.8)}
    ${linhas(f ? 'M90 59 C92 68 96 76 100 80 M70 140 C74 156 80 170 84 184 M58 108 L65 110' : 'M88 59 C91 68 95 76 100 80 M72 146 C74 160 78 172 82 184 M49 108 L58 110', '#d9b45a', 1.2, .9)}
    ${linhas(f ? 'M75 100 C80 112 86 120 92 126 M60 84 C62 92 63 100 64 106' : 'M70 100 C76 114 82 124 90 132 M52 86 C54 94 55 102 55 108', '#0c1826', 1, .5)}
    <path d="M100 80 L100 187" stroke="#0c1826" stroke-width="1.2"/>
    ${solido(`M100 ${cintoY - 4} L${f ? 79 : 74} ${cintoY - 5} L${f ? 79.5 : 74.5} ${cintoY + 4} L100 ${cintoY + 5} Z`, 'url(#bnCouro)', '#1e1208', 1.2)}
    <rect x="94" y="${cintoY - 5}" width="12" height="11" rx="2" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width="1"/><rect x="97" y="${cintoY - 2.5}" width="6" height="6" rx="1" fill="none" stroke="#5a3a0c" stroke-width="1"/>
    <path d="M${f ? 82 : 78} ${cintoY + 4} l-3 16 l8 0 l1 -15 Z" fill="url(#bnCouro)" stroke="#1e1208" stroke-width="1"/>
    ${solido(bota, 'url(#bnCouro)', '#1e1208', 1.6)}
    ${linhas(f ? 'M79 250 C86 252 92 252 96 250 M80 262 C86 264 92 264 95 262' : 'M77 250 C84 252 90 252 96 250 M78 262 C84 264 90 264 95 262', '#c49a62', 1, .6)}
  </g>`;
}

// Armadura (corpo): peitoral de aço com gola, ombreiras em placas e saiote.
function armadura(g) {
  const f = g === 'feminino';
  const peito = f
    ? 'M100 57 L89.5 58.5 C84 62 78 65 72 69 C70 79 70 88 71 96 C70 108 76 121 80 134 C80 142 78 150 78 156 C86 159 94 160 100 160 Z'
    : 'M100 57 L88 58.5 C82 62 74 65 67 69 C65 79 65 88 66 96 C67 112 72 126 75 140 C76 146 76 150 76 155 C86 159 94 160 100 160 Z';
  const ombro = f
    ? 'M56 92 C54 76 62 64 76 63 C82 63.5 86 66 88 70 C76 70 64 78 56 92 Z'
    : 'M47 94 C45 76 55 62 72 61 C79 61.5 84 65 86 70 C72 70 58 78 47 94 Z';
  const ombro2 = f ? 'M58 82 C62 74 70 69 80 68' : 'M50 84 C55 74 64 68 76 67';
  const saia = f
    ? ['M100 156 L78 153 C76 158 74 164 73 170 C82 174 92 175 100 175 Z', 'M100 170 L73 166 C72 172 71 178 71 184 C80 188 92 189 100 189 Z']
    : ['M100 155 L76 152 C75 158 73 163 72 169 C82 173 92 174 100 174 Z', 'M100 169 L72 165 C71 171 70 177 70 183 C80 187 92 188 100 188 Z'];
  return `<g class="camada camada-corpo">
    ${saia.reverse().map(d => solido(d, 'url(#bnAco)', '#22262e', 1.4)).join('')}
    ${linhas(f ? 'M75 168 C84 171 92 172 100 172 M73 182 C82 185 92 186 100 186' : 'M74 167 C84 170 92 171 100 171 M72 181 C82 184 92 185 100 185', '#e0b04a', 1, .9)}
    ${solido(peito, 'url(#bnAco)', '#22262e', 2)}
    ${f ? linhas('M72 90 C78 104 90 108 100 102', '#3d4350', 1.4, .8) + linhas('M75 86 C80 96 88 100 96 98', '#ffffff', 1.2, .45)
    : linhas('M68 96 C78 104 92 106 100 102', '#3d4350', 1.4, .8) + linhas('M72 84 C78 92 88 96 98 95', '#ffffff', 1.2, .45)}
    ${linhas(f ? 'M80 128 C88 131 94 132 100 132 M79 144 C88 147 94 148 100 148' : 'M74 126 C84 130 92 131 100 131 M76 142 C86 146 93 147 100 147', '#3d4350', 1.2, .7)}
    <path d="M100 62 L100 158" stroke="#2c313a" stroke-width="1.4"/><path d="M98.6 64 L98.6 156" stroke="#fff" stroke-width=".8" opacity=".45"/>
    ${linhas(peito.replace(/ Z$/, ''), '#e0b04a', 1.2, .85)}
    ${solido(`M100 54 L${f ? 90.5 : 89} 55 C${f ? 89 : 87} 59 ${f ? 86 : 84} 62 ${f ? 82 : 80} 64 C88 67 95 68 100 68 Z`, 'url(#bnAcoV)', '#22262e', 1.4)}
    ${solido(ombro, 'url(#bnAcoV)', '#22262e', 1.6)}
    ${linhas(ombro2, '#22262e', 1.2, .8)}${linhas(ombro2, '#e0b04a', .8, .8)}
    ${[[f ? 66 : 59, 74], [f ? 76 : 70, 69]].flatMap(([x, y]) => [x, 200 - x].map(cx => `<circle cx="${cx}" cy="${y}" r="1.5" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width=".5"/>`)).join('')}
  </g>`;
}

// Joias: corrente de ouro com um pingente de pedra azul.
const JOIA = `<g class="camada camada-joia">
  <path d="M90 57 C91 66 95 72 100 74 C105 72 109 66 110 57" fill="none" stroke="#5a3a0c" stroke-width="2.6"/>
  <path d="M90 57 C91 66 95 72 100 74 C105 72 109 66 110 57" fill="none" stroke="url(#bnOuro)" stroke-width="1.6" stroke-dasharray="2 1"/>
  <circle cx="100" cy="80" r="11" fill="url(#bnBrilho)"/>
  <path d="M100 73 L105.5 79 L100 87.5 L94.5 79 Z" fill="url(#bnJoia)" stroke="url(#bnOuro)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M97.5 77 L100 74.5 L101.5 76.5" fill="none" stroke="#fff" stroke-width=".8" opacity=".9"/>
</g>`;

// Capacete: elmo de aço com faixa dourada, protetor de nariz e penacho vermelho.
function capacete(g) {
  const f = g === 'feminino';
  // O elmo é desenhado para a cabeça masculina; na feminina, um pouco menor.
  const aj = f ? 'transform="translate(100 34) scale(.9 .94) translate(-100 -33)"' : '';
  return `<g class="camada camada-cabeca"><g ${aj}>
    <path d="M100 4 C96 -6 108 -10 112 -2 C118 8 124 22 128 42 C122 34 116 24 110 16 Z" fill="#a8261c" stroke="#4a0d08" stroke-width="1.2"/>
    <path d="M104 0 C112 6 118 20 124 36" fill="none" stroke="#e46a54" stroke-width=".9" opacity=".7"/>
    ${solido('M100 8.5 C87 8.5 79.5 17 79.5 30 C79.5 38 80.5 44 82.5 50 L88.5 50 C88 44 87.5 38 88.5 32 C92 30.5 95 30 98.2 30 L98.2 41 L100 42 Z', 'url(#bnAcoV)', '#22262e', 2)}
    ${linhas('M82.5 49 C82 42 82 36 83 31', '#ffffff', 1, .35)}
    ${linhas('M80 27 C88 25.5 94 25 100 25', '#22262e', 4.2, 1)}${linhas('M80 27 C88 25.5 94 25 100 25', 'url(#bnOuroU)', 2.6, 1)}
    ${linhas('M100 9 L100 24', '#22262e', 1.2, .9)}
    ${linhas('M84 16 C88 12 93 10.5 98 10.5', '#ffffff', 1.4, .55)}
    <rect x="96.6" y="8" width="6.8" height="3.6" rx="1.4" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width=".8"/>
  </g></g>`;
}

// ---------- O que vai nas mãos (desenhado com o punho no ponto 0,0) ----------
const ESPADA = `<path d="M-3.4 -6 L-3.4 -70 L0 -80 L3.4 -70 L3.4 -6 Z" fill="url(#bnLamina)" stroke="#2c313a" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M0 -10 L0 -70" stroke="#7d8696" stroke-width="1"/>
  <path d="M-12 -7 C-8 -4 8 -4 12 -7 L12 -3 C8 -1 -8 -1 -12 -3 Z" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width="1"/>
  <rect x="-2.6" y="-3" width="5.2" height="12" rx="1.4" fill="#3b2312" stroke="#1a0e06" stroke-width=".8"/>
  <path d="M-2.6 0 L2.6 -1.4 M-2.6 3 L2.6 1.6 M-2.6 6 L2.6 4.6" stroke="#8a5a32" stroke-width=".8"/>
  <circle cx="0" cy="11" r="3.2" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width=".9"/>`;
const ESCUDO = `<g transform="translate(0 -8)">
  <path d="M-23 -26 L23 -26 C23 4 16 20 0 32 C-16 20 -23 4 -23 -26 Z" fill="url(#bnOuro)" stroke="#3d2a08" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M-19.5 -22.5 L19.5 -22.5 C19.5 3 13.5 17 0 27.5 C-13.5 17 -19.5 3 -19.5 -22.5 Z" fill="#7a1f17"/>
  <path d="M-19.5 -22.5 L0 -22.5 L0 27.5 C-13.5 17 -19.5 3 -19.5 -22.5 Z" fill="#a8302a"/>
  <path d="M0 -15 L4 -6 L13 -6 L6 0 L9 9 L0 4 L-9 9 L-6 0 L-13 -6 L-4 -6 Z" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width=".8" stroke-linejoin="round"/>
  <path d="M-17 -20 C-12 -21 -6 -21 -2 -21" stroke="#fff" stroke-width="1.2" opacity=".5" fill="none" stroke-linecap="round"/>
</g>`;
const LANTERNA = `<g transform="translate(0 4)">
  <circle cx="0" cy="16" r="16" fill="url(#bnBrilho)"/>
  <path d="M-3 -2 C-3 -7 3 -7 3 -2" fill="none" stroke="#2c313a" stroke-width="1.4"/>
  <path d="M-7 4 L7 4 L5 0 L-5 0 Z" fill="url(#bnOuro)" stroke="#3d2a08" stroke-width=".9"/>
  <rect x="-6" y="4" width="12" height="16" rx="1.5" fill="#ffe08a" opacity=".85" stroke="#3d2a08" stroke-width="1"/>
  <path d="M0 9 C2 12 2 15 0 17 C-2 15 -2 12 0 9 Z" fill="#ff9a2e"/>
  <path d="M-2 4 L-2 20 M2 4 L2 20" stroke="#3d2a08" stroke-width=".8"/>
  <path d="M-7 20 L7 20 L6 24 L-6 24 Z" fill="url(#bnOuro)" stroke="#3d2a08" stroke-width=".9"/>
</g>`;
const MONTANTE = `<path d="M-4.5 -14 L-4.5 -118 L0 -132 L4.5 -118 L4.5 -14 Z" fill="url(#bnLamina)" stroke="#2c313a" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M0 -18 L0 -116" stroke="#7d8696" stroke-width="1.2"/>
  <path d="M-17 -15 C-12 -10 12 -10 17 -15 L18 -9 C12 -5 -12 -5 -18 -9 Z" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width="1"/>
  <rect x="-3" y="-8" width="6" height="26" rx="1.6" fill="#3b2312" stroke="#1a0e06" stroke-width=".8"/>
  <path d="M-3 -4 L3 -6 M-3 1 L3 -1 M-3 6 L3 4 M-3 11 L3 9" stroke="#8a5a32" stroke-width=".8"/>
  <path d="M0 18 L4 23 L0 28 L-4 23 Z" fill="url(#bnOuro)" stroke="#5a3a0c" stroke-width=".9"/>`;

function maos(g) {
  const [x, y] = CORPO[g].mao;
  const em = (n, arte, giro = 0) => `<g transform="translate(${n ? 200 - x : x} ${y}) rotate(${n ? -giro : giro})">${arte}</g>`;
  const dedos = n => `<g transform="translate(${n ? 200 - x : x} ${y})"><path d="M${n ? 3 : -3} -4 C${n ? 6 : -6} -1 ${n ? 6 : -6} 4 ${n ? 3 : -3} 6" fill="url(#bnPele)" stroke="#4a2c16" stroke-width="1"/></g>`;
  return [0, 1].map(n => `
  <g class="camada camada-m${n}-arma">${em(n, ESPADA, 200)}${dedos(n)}</g>
  <g class="camada camada-m${n}-escudo">${em(n, ESCUDO, 0)}</g>
  <g class="camada camada-m${n}-item">${em(n, LANTERNA, 0)}</g>`).join('') + `
  <g class="camada camada-duas">${em(0, MONTANTE, -10)}${dedos(0)}</g>`;
}

const cache = {};
export function desenhoBoneco(genero) {
  const g = genero === 'feminino' ? 'feminino' : 'masculino';
  return (cache[g] ||= `<svg viewBox="0 -12 200 312" aria-hidden="true" class="silhueta ${g}">
  ${DEFS}
  ${PEDESTAL}
  ${capa(g)}
  ${corpoNu(g)}
  ${vestimenta(g)}
  ${armadura(g)}
  ${capaFrente(g)}
  ${JOIA}
  ${capacete(g)}
  ${maos(g)}
</svg>`);
}
