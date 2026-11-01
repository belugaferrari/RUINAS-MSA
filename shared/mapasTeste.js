// Mapas de teste (autor, 01/11: "coloque no sistema uns 5 mapas para teste"). A imagem de cada um é gerada a partir
// destes mesmos objetos (ferramentas/gerarMapasTeste.mjs), então paredes e árvores do desenho batem com as regras.
// Ligações: Floresta (oeste) — Vila — Praia (leste); Ruínas ao norte da Vila; Caverna pela escada das Ruínas.

const parede = (col, lin, l = 1, a = 1, nome = 'Parede') => ({ tipo: 'parede', nome, col, lin, l, a });
// Casa: contorno de parede com uma porta (vão) no lado escolhido.
function casa(col, lin, l, a, porta = 'sul') {
  const meioC = col + Math.floor(l / 2), meioL = lin + Math.floor(a / 2);
  const ps = [];
  if (porta === 'norte') { ps.push(parede(col, lin, meioC - col, 1), parede(meioC + 1, lin, col + l - meioC - 1, 1)); } else ps.push(parede(col, lin, l, 1));
  if (porta === 'sul') { ps.push(parede(col, lin + a - 1, meioC - col, 1), parede(meioC + 1, lin + a - 1, col + l - meioC - 1, 1)); } else ps.push(parede(col, lin + a - 1, l, 1));
  if (porta === 'oeste') { ps.push(parede(col, lin + 1, 1, meioL - lin - 1), parede(col, meioL + 1, 1, lin + a - meioL - 2)); } else ps.push(parede(col, lin + 1, 1, a - 2));
  if (porta === 'leste') { ps.push(parede(col + l - 1, lin + 1, 1, meioL - lin - 1), parede(col + l - 1, meioL + 1, 1, lin + a - meioL - 2)); } else ps.push(parede(col + l - 1, lin + 1, 1, a - 2));
  return ps.filter(p => p.l > 0 && p.a > 0);
}
const arvores = lista => lista.map(([col, lin]) => ({ tipo: 'arvore', nome: 'Árvore', col, lin }));
const pintado = (tipo, nome, lista) => lista.map(([col, lin, l = 1, a = 1]) => ({ tipo, nome, col, lin, l, a }));

export const MAPAS_TESTE = [
  {
    chave: 'vila', nome: 'Teste — Vila', url: '/img/mapas-teste/vila.svg', colunas: 24, linhas: 16, fundo: 'vila',
    objetos: [
      ...casa(2, 2, 6, 5, 'sul'), ...casa(15, 2, 7, 5, 'oeste'), ...casa(3, 10, 5, 4, 'norte'), ...casa(16, 10, 6, 4, 'norte'),
      { tipo: 'pilar', nome: 'Poço', col: 11, lin: 7 },
      { tipo: 'barril', nome: 'Barril', col: 9, lin: 4 }, { tipo: 'caixote', nome: 'Caixote', col: 13, lin: 11 },
      { tipo: 'mesa', nome: 'Banca da feira', col: 10, lin: 12, l: 2, a: 1 },
      ...arvores([[0, 8], [23, 8], [12, 0]]),
    ],
  },
  {
    chave: 'floresta', nome: 'Teste — Floresta', url: '/img/mapas-teste/floresta.svg', colunas: 20, linhas: 16, fundo: 'floresta',
    objetos: [
      ...arvores([[2, 1], [5, 3], [9, 1], [13, 2], [16, 4], [3, 7], [7, 6], [11, 8], [15, 7], [18, 10], [2, 12], [6, 11], [9, 13], [13, 12], [17, 14], [1, 4], [12, 5], [8, 10], [4, 14], [16, 1]]),
      ...pintado('arbusto', 'Mato alto', [[5, 8, 2, 2], [14, 10, 2, 1], [10, 3, 1, 2], [1, 9, 2, 1], [17, 6, 1, 2]]),
      ...pintado('agua', 'Riacho', [[0, 15, 6, 1], [6, 14, 1, 2]]),
    ],
  },
  {
    chave: 'praia', nome: 'Teste — Praia', url: '/img/mapas-teste/praia.svg', colunas: 20, linhas: 16, fundo: 'praia',
    objetos: [
      ...pintado('agua', 'Mar raso', [[14, 0, 6, 16]]),
      { tipo: 'veiculo', nome: 'Barco encalhado', col: 11, lin: 6, l: 2, a: 4 },
      ...pintado('entulho', 'Pedras', [[4, 11, 2, 1], [7, 12, 1, 2], [2, 13, 2, 1]]),
      ...casa(2, 1, 5, 4, 'sul'),
      { tipo: 'caixote', nome: 'Caixas do cais', col: 9, lin: 2 }, { tipo: 'barril', nome: 'Barril', col: 10, lin: 2 },
    ],
  },
  {
    chave: 'ruinas', nome: 'Teste — Ruínas', url: '/img/mapas-teste/ruinas.svg', colunas: 24, linhas: 14, fundo: 'ruinas',
    objetos: [
      parede(3, 2, 7, 1, 'Muro caído'), parede(3, 3, 1, 5, 'Muro caído'), parede(14, 2, 6, 1, 'Muro caído'), parede(19, 3, 1, 4, 'Muro caído'),
      parede(6, 9, 1, 4, 'Muro caído'), parede(16, 10, 5, 1, 'Muro caído'),
      ...[[9, 6], [14, 6], [9, 9], [14, 9]].map(([col, lin]) => ({ tipo: 'pilar', nome: 'Coluna antiga', col, lin })),
      ...pintado('entulho', 'Escombros', [[11, 9, 2, 2], [4, 10, 2, 1], [20, 8, 2, 2], [1, 5, 1, 2]]),
      ...arvores([[1, 1], [22, 12]]),
    ],
  },
  {
    chave: 'caverna', nome: 'Teste — Caverna', url: '/img/mapas-teste/caverna.svg', colunas: 18, linhas: 14, fundo: 'caverna',
    objetos: [
      parede(0, 0, 18, 1, 'Rocha'), parede(0, 13, 18, 1, 'Rocha'), parede(0, 1, 1, 12, 'Rocha'), parede(17, 1, 1, 12, 'Rocha'),
      parede(1, 1, 4, 6, 'Rocha'), parede(5, 1, 2, 3, 'Rocha'), parede(9, 4, 2, 5, 'Rocha'), parede(13, 1, 4, 3, 'Rocha'),
      parede(13, 8, 4, 2, 'Rocha'), parede(5, 10, 3, 3, 'Rocha'), parede(11, 11, 3, 2, 'Rocha'),
      ...pintado('agua', 'Poça', [[14, 5, 2, 2]]),
      ...pintado('entulho', 'Estalagmites', [[7, 6, 1, 1], [3, 8, 1, 1], [15, 11, 1, 1]]),
      { tipo: 'bau', nome: 'Baú antigo', col: 15, lin: 4 },
    ],
  },
  // Mapa do mundo (continental): arquipélago grande, sem grade e sem combate; a fog se abre em volta dos PJs.
  {
    chave: 'continente', nome: 'Teste — Ilhas das Ruínas (mundo)', url: '/img/mapas-teste/continente.svg', colunas: 60, linhas: 40, fundo: 'continente', continental: true,
    objetos: [],
    ilhas: [
      { nome: 'Ilha da Vila', x: 14, y: 12, r: 8 }, { nome: 'Ruínas do Norte', x: 30, y: 7, r: 6 }, { nome: 'Maré Morta', x: 44, y: 18, r: 9 },
      { nome: 'Recife das Cinzas', x: 20, y: 30, r: 7 }, { nome: 'Bunker Afundado', x: 50, y: 33, r: 5 }, { nome: 'Farol Partido', x: 34, y: 25, r: 3 },
    ],
  },
];
// Onde ficam as passagens (desenhadas como escadas na imagem).
export const PASSAGENS_TESTE = { ruinas: [{ col: 12, lin: 4 }], caverna: [{ col: 2, lin: 9 }] };
