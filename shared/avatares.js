// Avatares prontos (cerca de 100), no clima do jogo: retratos em silhueta, com luz de borda,
// olhos acesos e detalhes que brilham (implantes, mutações, runas…), um tema de cor por grupo.
// Cobre origens e profissões (humanos), as 10 classes com as especializações, e NPCs/criaturas.
// O servidor desenha cada um em /avatares/<id>.svg; escolher um avatar só grava esse endereço em p.foto.

// ---------- Temas (fundo, luz de borda, olhos, partículas) ----------
const TEMAS = {
  ermos: { fundo: '#5a3a1e', borda: '#e3a15c', olhos: '#f2e6d0', part: '#e3a15c', tipo: 'poeira' },
  cidade: { fundo: '#1f3550', borda: '#9cc4ec', olhos: '#e6f0fa', part: '#9cc4ec', tipo: 'chuva' },
  aguas: { fundo: '#134a4d', borda: '#7fd6d0', olhos: '#e0faf7', part: '#7fd6d0', tipo: 'bolhas' },
  cacador: { fundo: '#4f1f14', borda: '#e0744a', olhos: '#ffd9b0', part: '#ff8a4a', tipo: 'brasas' },
  ciborgue: { fundo: '#0f3a48', borda: '#4fe0ff', olhos: '#4fe0ff', part: '#4fe0ff', tipo: 'faiscas' },
  encantado: { fundo: '#35204f', borda: '#c39bff', olhos: '#d9c2ff', part: '#c39bff', tipo: 'brilhos' },
  inventor: { fundo: '#4a3412', borda: '#f0b25a', olhos: '#ffe2a8', part: '#ffb84d', tipo: 'faiscas' },
  mutante: { fundo: '#24400f', borda: '#a8ff5a', olhos: '#c8ff6a', part: '#a8ff5a', tipo: 'esporos' },
  perito: { fundo: '#1b3f33', borda: '#9fe8c4', olhos: '#e6fff3', part: '#9fe8c4', tipo: 'brilhos' },
  soldado: { fundo: '#33361c', borda: '#c9c27a', olhos: '#eeeacc', part: '#c9c27a', tipo: 'fumaca' },
  sortudo: { fundo: '#4a3a0c', borda: '#ffd56a', olhos: '#fff0b8', part: '#ffd56a', tipo: 'brilhos' },
  transmorfo: { fundo: '#4a2410', borda: '#ffa04a', olhos: '#ffb347', part: '#ffa04a', tipo: 'lua' },
  treinador: { fundo: '#1c3d20', borda: '#8fe09a', olhos: '#e6ffe8', part: '#8fe09a', tipo: 'folhas' },
  criatura: { fundo: '#4a0f12', borda: '#ff5a4a', olhos: '#ff3b30', part: '#ff5a4a', tipo: 'brasas' },
  morto: { fundo: '#2c3324', borda: '#b8c79a', olhos: '#f2f7e0', part: '#b8c79a', tipo: 'esporos' },
};

export const GRUPOS_AVATAR = [
  ['humanos', 'Humanos'], ['cacador', 'Caçador'], ['ciborgue', 'Ciborgue'], ['encantado', 'Encantado'], ['inventor', 'Inventor'],
  ['mutante', 'Mutante'], ['perito', 'Perito'], ['soldado', 'Soldado'], ['sortudo', 'Sortudo'], ['transmorfo', 'Transmorfo'],
  ['treinador', 'Treinador'], ['criaturas', 'NPCs e criaturas'],
];

// ---------- Lista ----------
// [id, nome, grupo, tema, corpo (m, f, g = grande, n = magro), peças…]
const L = [
  // Humanos: origens e profissões
  ['ermos-andarilho', 'Andarilho dos Ermos', 'humanos', 'ermos', 'm', 'chapeu', 'lenco', 'barba', 'cachecol'],
  ['ermos-andarilha', 'Andarilha dos Ermos', 'humanos', 'ermos', 'f', 'longo', 'lenco', 'cachecol'],
  ['ermos-coletor', 'Coletor de sucata', 'humanos', 'ermos', 'm', 'oculosTesta', 'curto', 'barba', 'alcas'],
  ['ermos-coletora', 'Coletora de sucata', 'humanos', 'ermos', 'f', 'rabo', 'oculosTesta', 'alcas'],
  ['ermos-sobrevivente', 'Sobrevivente', 'humanos', 'ermos', 'm', 'espetado', 'cicatriz', 'barbaCurta'],
  ['ermos-sobrevivente-f', 'Sobrevivente', 'humanos', 'ermos', 'f', 'trancas', 'cicatriz'],
  ['cidade-crio', 'Cria das cidades', 'humanos', 'cidade', 'm', 'raspado', 'gola'],
  ['cidade-cria', 'Cria das cidades', 'humanos', 'cidade', 'f', 'coque', 'gola'],
  ['cidade-zelador', 'Zelador do Refúgio', 'humanos', 'cidade', 'm', 'boina', 'cavanhaque', 'gola'],
  ['cidade-zeladora', 'Zeladora do Refúgio', 'humanos', 'cidade', 'f', 'volumoso', 'gola'],
  ['cidade-protetor', 'Protetor', 'humanos', 'cidade', 'g', 'capaceteMilitar', 'barbaCurta', 'ombreiras'],
  ['cidade-protetora', 'Protetora', 'humanos', 'cidade', 'f', 'capaceteMilitar', 'rabo', 'ombreiras'],
  ['aguas-pescador', 'Nômade das Águas', 'humanos', 'aguas', 'm', 'bandana', 'barba', 'cachecol'],
  ['aguas-pescadora', 'Nômade das Águas', 'humanos', 'aguas', 'f', 'trancas', 'bandana'],
  ['aguas-batedor', 'Batedor', 'humanos', 'aguas', 'n', 'capuz', 'lenco', 'arco'],
  ['aguas-batedora', 'Batedora', 'humanos', 'aguas', 'f', 'capuz', 'arco'],
  ['ermos-velho', 'Velho dos Ermos', 'humanos', 'ermos', 'n', 'capuz', 'barbaLonga'],
  ['ermos-velha', 'Velha curandeira', 'humanos', 'ermos', 'f', 'capuz', 'longo', 'frascos'],
  // Caçador
  ['cacador-armadilheiro', 'Armadilheiro', 'cacador', 'cacador', 'm', 'capuz', 'lenco', 'arco', 'pelagem'],
  ['cacadora-armadilheira', 'Armadilheira', 'cacador', 'cacador', 'f', 'rabo', 'pintura', 'arco', 'pelagem'],
  ['cacador-exterminador', 'Exterminador de Bestas', 'cacador', 'cacador', 'g', 'careca', 'cicatriz', 'barba', 'machado', 'pelagem'],
  ['cacadora-exterminadora', 'Exterminadora de Bestas', 'cacador', 'cacador', 'f', 'raspado', 'cicatriz', 'machado'],
  ['cacador-bastiao', 'Bastião', 'cacador', 'cacador', 'g', 'elmo', 'ombreiras', 'espada'],
  ['cacadora-bastiao', 'Bastiã', 'cacador', 'cacador', 'g', 'elmo', 'pelagem', 'machado'],
  ['cacador-presas', 'Colar de presas', 'cacador', 'cacador', 'm', 'moicano', 'pintura', 'colarPresas'],
  ['cacadora-presas', 'Caçadora tribal', 'cacador', 'cacador', 'f', 'trancas', 'pintura', 'colarPresas'],
  // Ciborgue
  ['ciborgue-engrenagem', 'Coração de Engrenagem', 'ciborgue', 'ciborgue', 'g', 'careca', 'placa', 'nucleo', 'bracoMecanico'],
  ['ciborgue-engrenagem-f', 'Coração de Engrenagem', 'ciborgue', 'ciborgue', 'f', 'raspado', 'placa', 'nucleo'],
  ['ciborgue-transcendente', 'Transcendente', 'ciborgue', 'ciborgue', 'n', 'careca', 'meioRosto', 'visor', 'dados'],
  ['ciborgue-transcendente-f', 'Transcendente', 'ciborgue', 'ciborgue', 'f', 'coque', 'meioRosto', 'dados'],
  ['ciborgue-zord', 'Zord', 'ciborgue', 'ciborgue', 'g', 'piloto', 'ombreiras', 'nucleo'],
  ['ciborgue-zord-f', 'Zord', 'ciborgue', 'ciborgue', 'f', 'piloto', 'ombreiras'],
  ['ciborgue-olho', 'Olho de vidro', 'ciborgue', 'ciborgue', 'm', 'curto', 'olhoCiber', 'barbaCurta', 'antena'],
  ['ciborgue-respirador', 'Respirador', 'ciborgue', 'ciborgue', 'f', 'longo', 'respirador', 'olhoCiber'],
  // Encantado
  ['encantado-diplomata', 'Diplomata', 'encantado', 'encantado', 'm', 'curto', 'diadema', 'gola', 'cavanhaque'],
  ['encantada-diplomata', 'Diplomata', 'encantado', 'encantado', 'f', 'coque', 'diadema', 'gola'],
  ['encantado-sussurrante', 'Sussurrante', 'encantado', 'encantado', 'n', 'capuz', 'sussurro', 'runas'],
  ['encantada-sussurrante', 'Sussurrante', 'encantado', 'encantado', 'f', 'capuz', 'longo', 'sussurro', 'runas'],
  ['encantado-galante', 'Galante', 'encantado', 'encantado', 'm', 'chapeuPluma', 'cavanhaque', 'gola'],
  ['encantada-galante', 'Galante', 'encantado', 'encantado', 'f', 'volumoso', 'chapeuPluma', 'gola'],
  ['encantado-mascara', 'Máscara de baile', 'encantado', 'encantado', 'f', 'longo', 'mascaraBaile', 'runas'],
  // Inventor
  ['inventor-armeiro', 'Armeiro', 'inventor', 'inventor', 'm', 'oculosTesta', 'espetado', 'barba', 'rifle'],
  ['inventora-armeira', 'Armeira', 'inventor', 'inventor', 'f', 'oculos', 'rabo', 'rifle'],
  ['inventor-carrier', 'Carrier Crafter', 'inventor', 'inventor', 'g', 'bandana', 'barba', 'engrenagens', 'alcas'],
  ['inventora-carrier', 'Carrier Crafter', 'inventor', 'inventor', 'f', 'coque', 'oculosTesta', 'engrenagens'],
  ['inventor-engenheiro', 'Engenheiro das Ruínas', 'inventor', 'inventor', 'm', 'capaceteObra', 'barbaCurta', 'alcas'],
  ['inventora-engenheira', 'Engenheira das Ruínas', 'inventor', 'inventor', 'f', 'capaceteObra', 'trancas'],
  ['inventor-soldador', 'Soldador', 'inventor', 'inventor', 'm', 'oculos', 'careca', 'faiscasMao'],
  // Mutante
  ['mutante-adaptado', 'Adaptado', 'mutante', 'mutante', 'm', 'careca', 'guelras', 'escamas'],
  ['mutante-adaptada', 'Adaptada', 'mutante', 'mutante', 'f', 'raspado', 'guelras', 'escamas'],
  ['mutante-aberrante', 'Aberrante', 'mutante', 'mutante', 'g', 'careca', 'tumor', 'espinhos', 'terceiroOlho'],
  ['mutante-aberrante-f', 'Aberrante', 'mutante', 'mutante', 'f', 'longo', 'tumor', 'veias'],
  ['mutante-radiante', 'Radiante (a Praga)', 'mutante', 'mutante', 'n', 'careca', 'radiacao', 'veias'],
  ['mutante-radiante-f', 'Radiante (a Praga)', 'mutante', 'mutante', 'f', 'capuz', 'radiacao', 'veias'],
  ['mutante-chifres', 'Mutante de chifres', 'mutante', 'mutante', 'm', 'chifres', 'curto', 'veias'],
  ['mutante-olhos', 'Muitos olhos', 'mutante', 'mutante', 'n', 'capuz', 'olhosExtras'],
  // Perito
  ['perito-socorrista', 'Socorrista', 'perito', 'perito', 'm', 'curto', 'cruz', 'alcas'],
  ['perita-socorrista', 'Socorrista', 'perito', 'perito', 'f', 'rabo', 'cruz', 'mascaraMedica'],
  ['perito-alquimista', 'Alquimista', 'perito', 'perito', 'm', 'oculos', 'barbaLonga', 'frascos'],
  ['perita-alquimista', 'Alquimista', 'perito', 'perito', 'f', 'coque', 'oculosTesta', 'frascos'],
  ['perito-hacker', 'Hacker', 'perito', 'perito', 'n', 'capuz', 'visor', 'codigo'],
  ['perita-hacker', 'Hacker', 'perito', 'perito', 'f', 'raspado', 'olhoCiber', 'codigo'],
  ['perito-artista', 'Artista', 'perito', 'perito', 'm', 'ondulado', 'mascaraBaile', 'cachecol'],
  ['perita-artista', 'Artista', 'perito', 'perito', 'f', 'volumoso', 'pintura', 'cachecol'],
  // Soldado
  ['soldado-comandante', 'Comandante', 'soldado', 'soldado', 'g', 'boina', 'barbaCurta', 'dragonas', 'medalhas'],
  ['soldada-comandante', 'Comandante', 'soldado', 'soldado', 'f', 'boina', 'coque', 'dragonas', 'medalhas'],
  ['soldado-blackops', 'Operações Especiais', 'soldado', 'soldado', 'm', 'capaceteMilitar', 'visaoNoturna', 'balaclava', 'rifle'],
  ['soldada-blackops', 'Operações Especiais', 'soldado', 'soldado', 'f', 'capaceteMilitar', 'visaoNoturna', 'balaclava'],
  ['soldado-guerrilheiro', 'Guerrilheiro', 'soldado', 'soldado', 'm', 'bandana', 'barba', 'cartucheira', 'rifle'],
  ['soldada-guerrilheira', 'Guerrilheira', 'soldado', 'soldado', 'f', 'trancas', 'bandana', 'cartucheira'],
  ['soldado-gas', 'Máscara de gás', 'soldado', 'soldado', 'm', 'capaceteMilitar', 'mascaraGas', 'ombreiras'],
  // Sortudo
  ['sortudo-fortuna', 'Filho da Fortuna', 'sortudo', 'sortudo', 'm', 'chapeu', 'cavanhaque', 'moeda'],
  ['sortuda-fortuna', 'Filha da Fortuna', 'sortudo', 'sortudo', 'f', 'longo', 'moeda', 'cachecol'],
  ['sortudo-universal', 'Universal', 'sortudo', 'sortudo', 'n', 'ondulado', 'estrelas'],
  ['sortuda-universal', 'Universal', 'sortudo', 'sortudo', 'f', 'rabo', 'estrelas', 'gola'],
  ['sortudo-iluminado', 'Iluminado', 'sortudo', 'sortudo', 'm', 'careca', 'aureola', 'gola'],
  ['sortuda-iluminada', 'Iluminada', 'sortudo', 'sortudo', 'f', 'capuz', 'aureola'],
  ['sortudo-dados', 'Jogador de dados', 'sortudo', 'sortudo', 'm', 'chapeu', 'barbaCurta', 'estrelas', 'moeda'],
  // Transmorfo
  ['transmorfo-licantropo', 'Licantropo', 'transmorfo', 'transmorfo', 'g', 'lobo', 'pelagem'],
  ['transmorfa-licantropa', 'Licantropa', 'transmorfo', 'transmorfo', 'f', 'orelhasLobo', 'longo', 'garras'],
  ['transmorfo-meio', 'Meio-desperto', 'transmorfo', 'transmorfo', 'm', 'orelhasLobo', 'espetado', 'barba', 'pelagem'],
  ['transmorfo-magno', 'Magno', 'transmorfo', 'transmorfo', 'g', 'urso', 'pelagem'],
  ['transmorfa-magna', 'Magna', 'transmorfo', 'transmorfo', 'f', 'orelhasFelinas', 'volumoso', 'garras'],
  ['transmorfo-mimico', 'Mímico', 'transmorfo', 'transmorfo', 'n', 'curto', 'mimico'],
  ['transmorfa-mimica', 'Mímica', 'transmorfo', 'transmorfo', 'f', 'longo', 'mimico'],
  ['transmorfo-reptil', 'Escamado', 'transmorfo', 'transmorfo', 'm', 'careca', 'escamas', 'olhosReptil'],
  // Treinador
  ['treinador-alfa', 'Líder Alfa', 'treinador', 'treinador', 'm', 'curto', 'barba', 'pelagem', 'loboAo'],
  ['treinadora-alfa', 'Líder Alfa', 'treinador', 'treinador', 'f', 'trancas', 'pelagem', 'loboAo'],
  ['treinador-alma', 'Irmão de Alma', 'treinador', 'treinador', 'n', 'capuz', 'ave'],
  ['treinadora-alma', 'Irmã de Alma', 'treinador', 'treinador', 'f', 'rabo', 'ave'],
  ['treinador-ancestral', 'Espírito Ancestral', 'treinador', 'treinador', 'm', 'longo', 'pintura', 'espirito'],
  ['treinadora-ancestral', 'Espírito Ancestral', 'treinador', 'treinador', 'f', 'trancas', 'pintura', 'espirito'],
  // NPCs e criaturas
  ['npc-saqueador', 'Saqueador', 'criaturas', 'criatura', 'g', 'moicano', 'mascaraEspinhos', 'espinhosOmbro'],
  ['npc-saqueadora', 'Saqueadora', 'criaturas', 'criatura', 'f', 'raspado', 'pintura', 'espinhosOmbro'],
  ['npc-bandido', 'Bandido', 'criaturas', 'criatura', 'm', 'chapeu', 'lenco', 'rifle'],
  ['npc-mercador', 'Mercador', 'criaturas', 'ermos', 'g', 'chapeu', 'barba', 'alcas', 'moeda'],
  ['npc-sacerdote', 'Sacerdote do culto', 'criaturas', 'encantado', 'n', 'capuz', 'simbolo'],
  ['npc-patrulheiro', 'Patrulheiro do Refúgio', 'criaturas', 'cidade', 'm', 'elmoVisor', 'ombreiras'],
  ['npc-zumbi', 'Morto-vivo', 'criaturas', 'morto', 'n', 'ralo', 'zumbi'],
  ['npc-infectado', 'Infectado', 'criaturas', 'mutante', 'm', 'careca', 'pustulas', 'veias'],
  ['npc-abominacao', 'Abominação', 'criaturas', 'criatura', 'g', 'abominacao'],
  ['npc-fera', 'Fera dos Ermos', 'criaturas', 'criatura', 'g', 'fera'],
  ['npc-vampiro', 'Sanguessuga', 'criaturas', 'criatura', 'n', 'penteado', 'golaAlta', 'presas'],
  ['npc-espectro', 'Espectro', 'criaturas', 'encantado', 'n', 'capuz', 'espectro'],
];

// Gênero do avatar (para o filtro): corpo feminino, ou um dos femininos de corpo grande; criaturas sem gênero.
const generoAvatar = (id, grupo, corpo) => (corpo === 'f' || id === 'cacadora-bastiao' ? 'feminino' : grupo === 'criaturas' ? 'outro' : 'masculino');
export const AVATARES = L.map(([id, nome, grupo, tema, corpo, ...pecas]) => ({ id, nome, grupo, tema, corpo, pecas, genero: generoAvatar(id, grupo, corpo), url: `/avatares/${id}.svg` }));
export const avatarPorId = id => AVATARES.find(a => a.id === id);

// ---------- Desenho ----------
// Gerador pseudoaleatório com semente (o mesmo avatar sai sempre igual).
function rng(semente) {
  let s = 0;
  for (const ch of semente) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
// Espelha um caminho (comandos absolutos M L C Q Z) no eixo x = 64.
function esp(d) {
  let i = 0;
  return d.replace(/[MLCQZ]|-?\d*\.?\d+/g, t => (/[MLCQZ]/.test(t) ? ((i = 0), t) : i++ % 2 === 0 ? String(+(128 - parseFloat(t)).toFixed(2)) : t));
}
const par = d => `<path d="${d}"/><path d="${esp(d)}"/>`;

const CABECA = {
  m: 'M64 30 C74 30 81 37.5 81 48 C81 56 78 63 73 67.5 C70 70 67 71.5 64 71.5 C61 71.5 58 70 55 67.5 C50 63 47 56 47 48 C47 37.5 54 30 64 30 Z',
  f: 'M64 31 C73.5 31 80 38 80 48 C80 56 77 62.5 72.5 66.5 C69.5 69.5 66.8 70.8 64 70.8 C61.2 70.8 58.5 69.5 55.5 66.5 C51 62.5 48 56 48 48 C48 38 54.5 31 64 31 Z',
};
const PESCOCO = { m: 'M56.5 62 L71.5 62 L73.5 82 L54.5 82 Z', f: 'M57.5 62 L70.5 62 L71.5 82 L56.5 82 Z' };
const OMBROS = {
  m: 'M8 128 C10 105 23 95 42 91 C50 89 55 85 57 79 L71 79 C73 85 78 89 86 91 C105 95 118 105 120 128 Z',
  f: 'M17 128 C19 108 30 98 46 94 C52 92 56 88 58 80 L70 80 C72 88 76 92 82 94 C98 98 109 108 111 128 Z',
  g: 'M0 128 C2 100 16 88 39 84 C49 82 55 78 57 74 L71 74 C73 78 79 82 89 84 C112 88 126 100 128 128 Z',
  n: 'M16 128 C18 108 28 98 44 94 C51 92 56 87 58 80 L70 80 C72 87 77 92 84 94 C100 98 110 108 112 128 Z',
};

// Peças: "s" = silhueta (escura, com luz de borda), "l" = luz (brilha por cima), "atras" = desenhada atrás do corpo.
// Algumas também escondem partes do rosto (semRosto, sombra = rosto no escuro, so olhos).
function pecas(nome, t, r) {
  const c = t.borda;
  const brilho = (d, cor = c, larg = 1.4, op = 1) => `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}" filter="url(#g)"/>`;
  const ponto = (x, y, rr, cor = c, op = 1) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${cor}" opacity="${op}" filter="url(#g)"/>`;
  switch (nome) {
    // Cabelos
    case 'curto': return { s: '<path d="M46.5 50 C44 36 52 27 64 27 C76 27 84 36 81.5 50 C80 43 77 39 72 37.5 C66 40 58 40 52.5 36.5 C49.5 40 47.5 44 46.5 50 Z"/>' };
    case 'espetado': return { s: '<path d="M46 51 C43 41 46 33 50 30 L48 22 L55 27 L56 18 L62 26 L66 17 L69 26 L75 20 L75 28 L82 25 L79 33 C83 38 83 45 82 51 C80 43 76 39 70 38 C64 40 56 40 51 37.5 C48.5 41 47 45 46 51 Z"/>' };
    case 'raspado': return { s: '<path d="M47 47 C46 32 56 25.5 66 26.5 C79 27.5 84 38 81 51 C77 40 69 36 58 38 C53.5 40 49.5 43 47 47 Z"/><path d="M64 29 C77 32 82 44 79 58 C75 48 70 42 61 40 Z"/>' };
    case 'coque': return { s: '<path d="M47 49 C45 36 53 28 64 28 C75 28 83 36 81 49 C79 42 75 38.5 70 37.5 C65 39.5 58 39.5 53 37 C50 40 48 44 47 49 Z"/><circle cx="64" cy="23" r="8"/>' };
    case 'rabo': return { s: '<path d="M47 49 C45 36 53 28 64 28 C75 28 83 36 81 49 C79 42 75 38.5 70 37.5 C65 39.5 58 39.5 53 37 C50 40 48 44 47 49 Z"/><path d="M77 36 C90 38 95 54 92 76 C90 86 85 92 82 90 C88 74 86 56 77 46 Z"/>' };
    case 'longo': return { s: '<path d="M47.5 47 C45 33 53.5 26.5 64 26.5 C75 26.5 83 33 80.5 47 C82.5 62 85 78 90 96 C84 100 77 98 73.5 93 C76.5 80 77.5 66 76.5 53 C73 45 68.5 41 64 40 C59.5 41 55 45 51.5 53 C50.5 66 51.5 80 54.5 93 C51 98 44 100 38 96 C43 78 45.5 62 47.5 47 Z"/>' };
    case 'trancas': return { s: `<path d="M47 49 C45 36 53 28 64 28 C75 28 83 36 81 49 C79 42 75 38.5 70 37.5 C65 39.5 58 39.5 53 37 C50 40 48 44 47 49 Z"/>${[0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="${49 - i * .6}" cy="${54 + i * 7}" rx="3.6" ry="4.4"/><ellipse cx="${79 + i * .6}" cy="${54 + i * 7}" rx="3.6" ry="4.4"/>`).join('')}` };
    case 'volumoso': return { s: '<path d="M44 63 C35 57 35 45 41.5 38.5 C39.5 28 49 20 58 22 C62.5 15.5 74 16.5 76.5 23.5 C85 23.5 91 31.5 87.5 40 C93 46 93 57 85.5 63 C84 56 81.5 50 80 46 C76 40 70 38 64 38.5 C58 38 52 40 48.5 46 C47 50 45.5 56 44 63 Z"/>' };
    case 'ondulado': return { s: '<path d="M45.5 52 C41 40 47 28 58 26 C66 22 78 25 82 33 C87 38 86 47 82.5 54 C81 46 78 41 73 39 C69 42 64 41 60 38.5 C56 42 51 43 49 47 C47.5 49 46.5 50.5 45.5 52 Z"/>' };
    case 'moicano': return { s: '<path d="M59 34 C58.5 24 61 16 64 11 C67 16 69.5 24 69 34 Z"/>' };
    case 'penteado': return { s: '<path d="M47 47 C45 33 54 27 64 27 C74 27 83 33 81 47 C78 40 72 36.5 64 41 C56 36.5 50 40 47 47 Z"/>' };
    case 'ralo': return { s: '<path d="M50 40 L48 33 L53 36 L55 29 L58 35 M70 34 L73 28 L74 35 L79 31 L78 39" fill="none" stroke="#000" stroke-width="2"/>' };
    case 'careca': return { l: `<path d="M53 37 C57 33 62 32 66 32.5" fill="none" stroke="${c}" stroke-width="1.2" opacity=".35"/>` };
    // Barbas
    case 'barba': return { s: '<path d="M49 53 C48.5 67 55 77.5 64 78.5 C73 77.5 79.5 67 79 53 C77 61 72 64 64 64.5 C56 64 51 61 49 53 Z"/>' };
    case 'barbaCurta': return { s: '<path d="M50 56 C50 66 56 73 64 73.5 C72 73 78 66 78 56 C76 62 71 65 64 65.5 C57 65 52 62 50 56 Z"/>' };
    case 'barbaLonga': return { s: '<path d="M49 54 C47 72 54 92 64 98 C74 92 81 72 79 54 C77 62 72 65 64 65.5 C56 65 51 62 49 54 Z"/>' };
    case 'cavanhaque': return { s: '<path d="M59.5 64 C59 71 61.5 75 64 76 C66.5 75 69 71 68.5 64 Z"/>' };
    // Cobertas de cabeça
    case 'capuz': return { atras: '<path d="M38 74 C36 46 45 21 64 19 C83 21 92 46 90 74 C89 88 83 96 78 100 L50 100 C45 96 39 88 38 74 Z"/>', s: '<path d="M38 74 C36 46 45 21 64 19 C83 21 92 46 90 74 C89 86 84 94 79 99 L74 81 C79 72 80.5 60 79 48 C77 38 71 33.5 64 33.5 C57 33.5 51 38 49 48 C47.5 60 49 72 54 81 L49 99 C44 94 39 86 38 74 Z"/>', sombra: true };
    case 'chapeu': return { s: '<path d="M49 40 C49 27 55 20 64 20 C73 20 79 27 79 40 Z"/><path d="M27 42 C38 34.5 90 34.5 101 42 C92 46.5 36 46.5 27 42 Z"/>', sombra: true, l: `<path d="M50 37 C58 35 70 35 78 37" stroke="${c}" stroke-width="1" fill="none" opacity=".4"/>` };
    case 'chapeuPluma': return { s: '<path d="M49 40 C49 28 55 21 64 21 C73 21 79 28 79 40 Z"/><path d="M29 42 C40 35 88 35 99 42 C90 46 38 46 29 42 Z"/><path d="M76 30 C86 20 98 14 108 14 C100 18 92 24 82 34 Z"/>', l: brilho('M80 31 C88 23 96 18 105 15', c, 1, .7) };
    case 'boina': return { s: '<path d="M46.5 43 C45 32 56 26 69 27.5 C82 29 87 35 84.5 41.5 C78 39 61 39 46.5 43 Z"/>', l: ponto(54, 36, 1.6, c, .9) };
    case 'bandana': return { s: '<path d="M47 43 C55 39 73 39 81 43 L81 48 C73 44 55 44 47 48 Z"/><path d="M80 44 L92 50 L87 52 Z M80 46 L89 57 L84 57.5 Z"/>', l: brilho('M48 45 C56 41.5 72 41.5 80 45', c, .9, .45) };
    case 'capaceteMilitar': return { s: '<path d="M44 51 C42 34 51.5 24 64 24 C76.5 24 86 34 84 51 L88 53 L40 53 Z"/>', l: brilho('M47 47 C50 33 58 27 66 27', c, 1, .45) };
    case 'capaceteObra': return { s: '<path d="M46 47 C46 33 54 25 64 25 C74 25 82 33 82 47 Z"/><path d="M40 48 C52 44 76 44 88 48 L88 51 L40 51 Z"/><rect x="60" y="22" width="8" height="25" rx="2"/>', l: `${ponto(64, 31, 4, '#fff6d0', .95)}${ponto(64, 31, 9, c, .35)}` };
    case 'elmo': return { s: '<path d="M44 56 C43 35 51.5 25 64 25 C76.5 25 85 35 84 56 C84 65 79 73 72.5 75 L55.5 75 C49 73 44 65 44 56 Z"/><path d="M62 25 C62 15 66 10 70 7 C69 14 68 19 67 25 Z"/>', semRosto: true, l: brilho('M51 50 L77 50', c, 1.8) };
    case 'elmoVisor': return { s: '<path d="M44 56 C43 35 51.5 25 64 25 C76.5 25 85 35 84 56 C84 65 79 73 72.5 75 L55.5 75 C49 73 44 65 44 56 Z"/>', semRosto: true, l: `<path d="M48 45 C56 42.5 72 42.5 80 45 L79 53 C71 51 57 51 49 53 Z" fill="${c}" opacity=".55" filter="url(#g)"/>${brilho('M50 47 L78 47', '#fff', .8, .8)}` };
    case 'piloto': return { s: '<path d="M42 58 C40 34 50 22 64 22 C78 22 88 34 86 58 C86 68 80 76 72 78 L56 78 C48 76 42 68 42 58 Z"/><path d="M84 40 L92 34 L93 50 L85 52 Z"/>', semRosto: true, l: `<path d="M47 44 C56 40 72 40 81 44 C81 51 78 56 64 57 C50 56 47 51 47 44 Z" fill="${c}" opacity=".5" filter="url(#g)"/>${brilho('M51 45 C58 42.5 66 42 72 42.5', '#fff', 1, .8)}` };
    case 'diadema': return { l: `${brilho('M48 41 C56 37 72 37 80 41', '#ffe6a0', 1.2, .9)}${ponto(64, 37.5, 2, '#fff')}` };
    case 'aureola': return { atras: '', l: `<ellipse cx="64" cy="26" rx="20" ry="5" fill="none" stroke="#fff3b0" stroke-width="2.2" filter="url(#g)"/><ellipse cx="64" cy="26" rx="20" ry="5" fill="none" stroke="#ffd56a" stroke-width="5" opacity=".35" filter="url(#g2)"/>` };
    case 'chifres': return { s: par('M53 36 C46 31 41 21 43 9 C47 18 52 24 59 31 Z') };
    case 'orelhasLobo': return { s: par('M51 38 L44 15 L59 31 Z') };
    case 'orelhasFelinas': return { s: par('M51 37 L47 21 L59 31 Z') };
    case 'antena': return { s: '<path d="M77 36 L87 13 L88.5 13.6 L79 37 Z"/>', l: `${ponto(88, 12, 2.4, c)}${ponto(88, 12, 6, c, .35)}` };
    // Rosto
    case 'lenco': return { s: '<path d="M48.5 55 C56 52.5 72 52.5 79.5 55 C80.5 66 74 77 64 79 C54 77 47.5 66 48.5 55 Z"/><path d="M60 77 L64 90 L68 77 Z"/>', semBoca: true };
    case 'balaclava': return { s: '<path d="M47 52 C47 47 81 47 81 52 L81 60 C80 70 73 78 64 79 C55 78 48 70 47 60 Z"/>', semBoca: true };
    case 'mascaraGas': return { s: '<path d="M51 51 C51 45 77 45 77 51 L77 62 C77 70 71 75 64 75 C57 75 51 70 51 62 Z"/><circle cx="53" cy="69" r="6.5"/><circle cx="75" cy="69" r="6.5"/><circle cx="64" cy="74" r="5"/>', semRosto: true, l: `${ponto(58, 51, 3.8, c, .75)}${ponto(70, 51, 3.8, c, .75)}${brilho('M50 69 L56 69 M72 69 L78 69', c, .8, .5)}` };
    case 'respirador': return { s: '<path d="M54 60 C56 56 72 56 74 60 L73 68 C70 72 58 72 55 68 Z"/><path d="M73 66 C84 70 90 80 92 96 L88 96 C86 82 81 74 72 70 Z"/>', semBoca: true, l: brilho('M58 64 L70 64', c, 1, .7) };
    case 'mascaraMedica': return { s: '<path d="M52 57 C56 54 72 54 76 57 L75 66 C71 71 57 71 53 66 Z"/>', semBoca: true, l: brilho('M54 59 L74 59', '#fff', .6, .5) };
    case 'mascaraBaile': return { l: `<path d="M47 47 C52 43 58 44 62 48 L64 50 L66 48 C70 44 76 43 81 47 C80 54 74 57 68 54 L64 52 L60 54 C54 57 48 54 47 47 Z" fill="${c}" opacity=".75" filter="url(#g)"/><path d="M80 46 C86 38 90 30 89 22" stroke="${c}" stroke-width="1.5" fill="none" filter="url(#g)"/>` };
    case 'mascaraEspinhos': return { s: '<path d="M49 52 C49 46 79 46 79 52 L78 66 C76 73 70 77 64 77 C58 77 52 73 50 66 Z"/><path d="M52 70 L46 80 L56 74 Z M76 70 L82 80 L72 74 Z M60 76 L58 86 L64 77 L70 86 L68 76 Z"/>', semBoca: true, l: `${ponto(58, 52, 2, c)}${ponto(70, 52, 2, c)}` };
    case 'oculos': return { s: '<rect x="45" y="47" width="38" height="4" rx="2"/>', l: `${ponto(57.5, 50, 4.6, c, .85)}${ponto(70.5, 50, 4.6, c, .85)}<circle cx="57.5" cy="50" r="5.4" fill="none" stroke="#000" stroke-width="2"/><circle cx="70.5" cy="50" r="5.4" fill="none" stroke="#000" stroke-width="2"/>${ponto(56, 48.5, 1.1, '#fff')}${ponto(69, 48.5, 1.1, '#fff')}`, semOlhos: true };
    case 'oculosTesta': return { s: '<rect x="45" y="37" width="38" height="4" rx="2"/><circle cx="57.5" cy="37.5" r="5.6"/><circle cx="70.5" cy="37.5" r="5.6"/>', l: `${ponto(57.5, 37.5, 3.6, c, .5)}${ponto(70.5, 37.5, 3.6, c, .5)}` };
    case 'visaoNoturna': return { s: '<rect x="55" y="38" width="7" height="14" rx="2"/><rect x="66" y="38" width="7" height="14" rx="2"/>', l: `${ponto(58.5, 52, 3, '#7dff6a')}${ponto(69.5, 52, 3, '#7dff6a')}${ponto(64, 53, 10, '#7dff6a', .25)}`, semOlhos: true };
    case 'visor': return { l: `<path d="M47 46.5 C56 44.5 72 44.5 81 46.5 L80.5 53 C72 51.5 56 51.5 47.5 53 Z" fill="${c}" opacity=".7" filter="url(#g)"/>${brilho('M49 48.5 L79 48.5', '#fff', .7, .8)}`, semOlhos: true };
    case 'olhoCiber': return { l: `<circle cx="70" cy="50" r="4" fill="none" stroke="${t.olhos === c ? c : '#ff4a4a'}" stroke-width="1.2" filter="url(#g)"/>${ponto(70, 50, 1.6, '#fff')}${brilho('M74 50 L81 50 L84 46', c, .9, .8)}` };
    case 'meioRosto': return { l: `${brilho('M64 31 L64 70', c, .8, .6)}${brilho('M66 38 L74 38 L77 42 M66 58 L72 58 L76 63 M68 66 L66 71', c, .9, .9)}<path d="M64 31 C74 31 81 38 81 48 C81 56 78 63 73 67.5 C70 70 67 71.5 64 71.5 Z" fill="${c}" opacity=".12"/>`, olhoD: '#ff4a4a' };
    case 'placa': return { l: `${brilho('M70 33 C77 35 81 41 81 48 L75 50 L74 41 Z', c, 1, .9)}${ponto(76, 44, 1.4, c)}` };
    case 'cicatriz': return { l: `<path d="M71 40 L75 52 L73 60" fill="none" stroke="${c}" stroke-width="1.1" opacity=".55"/>` };
    case 'pintura': return { l: `${brilho('M50 54 L57 56 M50 58 L57 60 M78 54 L71 56 M78 58 L71 60', c, 1.2, .7)}${brilho('M64 34 L64 44', c, 1.4, .6)}` };
    case 'sussurro': return { l: `${brilho('M58 66 C52 72 50 80 54 88 C58 94 56 100 50 104', c, 1.1, .7)}${brilho('M70 66 C76 70 80 78 78 86', c, 1, .5)}${ponto(54, 88, 1.4, c)}` };
    case 'terceiroOlho': return { l: `<ellipse cx="64" cy="40" rx="3.2" ry="2" fill="${c}" filter="url(#g)"/>${ponto(64, 40, 1, '#000')}` };
    case 'olhosExtras': return { l: [[56, 42], [72, 42], [64, 37], [52, 56], [76, 56]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.3" fill="${c}" filter="url(#g)"/>`).join('') };
    case 'olhosReptil': return { olhoRept: true };
    case 'guelras': return { l: brilho('M54 72 L52 78 M57 73 L55 80 M74 72 L76 78 M71 73 L73 80', c, 1, .8) };
    case 'escamas': return { l: [[52, 60], [55, 64], [50, 65], [76, 60], [73, 64], [78, 65], [48, 98], [53, 101], [80, 98], [75, 101]].map(([x, y]) => `<path d="M${x - 2} ${y} Q${x} ${y + 2.6} ${x + 2} ${y}" fill="none" stroke="${c}" stroke-width=".9" opacity=".7"/>`).join('') };
    case 'veias': return { l: brilho('M53 60 L55 66 L52 71 M76 58 L73 64 L75 70 M40 104 L48 100 L50 108 L58 112 M90 102 L84 108 L88 116', c, .9, .8) };
    case 'radiacao': return { atras: `<circle cx="64" cy="54" r="36" fill="${c}" opacity=".18" filter="url(#g2)"/>`, l: `${ponto(64, 108, 6, c, .9)}<path d="M64 102 L61 106 L67 106 Z M58.6 111 L62.5 109.5 L60 105 Z M69.4 111 L65.5 109.5 L68 105 Z" fill="#000" opacity=".7"/>` };
    case 'pustulas': return { l: [[54, 62, 1.8], [75, 58, 1.4], [72, 66, 2], [44, 104, 2.4], [86, 100, 2], [92, 112, 1.6], [36, 112, 1.6]].map(([x, y, rr]) => ponto(x, y, rr, c, .9)).join('') };
    case 'tumor': return { s: '<circle cx="80" cy="40" r="9"/><circle cx="96" cy="96" r="17"/><circle cx="104" cy="84" r="9"/>' };
    case 'mimico': return { l: `${brilho('M64 28 C62 40 66 52 62 64 C61 68 64 72 64 74', c, 1.2, .9)}<path d="M64 30 C54 30 47 37.5 47 48 C47 56 50 63 55 67.5 C58 70 61 71.5 64 71.5 Z" fill="${c}" opacity=".16"/>`, olhoE: '#ffffff' };
    case 'zumbi': return { s: '<path d="M58 70 L60 80 L64 76 L68 81 L70 70 Z"/>', l: brilho('M52 58 L56 62 M74 40 L78 46 L76 50', c, .8, .5), olhoMorto: true };
    case 'presas': return { l: `<path d="M60 64 L61 68 L62 64 M66 64 L67 68 L68 64" fill="#fff" stroke="#fff" stroke-width=".6"/>`, olhoE: '#ff2a2a', olhoD: '#ff2a2a' };
    case 'lobo': return { cabeca: 'M64 28 C76 28 85 36 85 48 C85 55 82 59 78 62 L73 76 C71 81 57 81 55 76 L50 62 C46 59 43 55 43 48 C43 36 52 28 64 28 Z', s: `${par('M50 36 L42 12 L60 30 Z')}<path d="M40 82 L44 72 L48 82 L52 74 L56 84 L64 78 L72 84 L76 74 L80 82 L84 72 L88 82 Z"/>`, l: `<path d="M53 49 L60 51 L54 52 Z M75 49 L68 51 L74 52 Z" fill="${c}" filter="url(#g)"/>${brilho('M61 70 L64 73 L67 70', c, .8, .6)}`, semRosto: true };
    case 'urso': return { cabeca: 'M64 28 C78 28 87 37 87 50 C87 60 82 68 76 72 C72 75 68 76 64 76 C60 76 56 75 52 72 C46 68 41 60 41 50 C41 37 50 28 64 28 Z', s: '<circle cx="46" cy="32" r="7"/><circle cx="82" cy="32" r="7"/>', l: `${ponto(56, 48, 1.8, c)}${ponto(72, 48, 1.8, c)}<ellipse cx="64" cy="62" rx="6" ry="4" fill="${c}" opacity=".18"/>`, semRosto: true };
    case 'fera': return { cabeca: 'M64 26 C80 26 90 36 90 50 C90 58 86 62 82 64 L76 80 C72 86 56 86 52 80 L46 64 C42 62 38 58 38 50 C38 36 48 26 64 26 Z', s: `${par('M48 34 C40 26 36 16 38 6 C44 14 50 20 58 28 Z')}`, l: `<path d="M50 48 L59 51 L51 53 Z M78 48 L69 51 L77 53 Z" fill="${c}" filter="url(#g)"/><path d="M56 74 L58 80 L60 74 M68 74 L70 80 L72 74" fill="#fff" stroke="#fff" stroke-width=".6" opacity=".9"/>`, semRosto: true };
    case 'abominacao': return { cabeca: 'M64 22 C82 22 92 34 90 52 C96 60 92 72 82 76 C76 82 52 82 46 76 C34 74 30 60 38 52 C36 34 46 22 64 22 Z', s: '<circle cx="40" cy="42" r="10"/><circle cx="90" cy="38" r="8"/><path d="M30 96 C20 86 14 72 18 60 C22 70 28 80 38 88 Z"/>', l: [[52, 44, 2.6], [70, 40, 2], [78, 52, 3], [58, 56, 1.8], [44, 56, 1.6], [66, 64, 1.4], [40, 42, 1.4], [90, 38, 1.4]].map(([x, y, rr]) => `<ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rr * .6}" fill="${c}" filter="url(#g)"/>`).join(''), semRosto: true };
    case 'espectro': return { l: `<path d="M38 128 C40 100 44 80 50 70 C54 76 74 76 78 70 C84 80 88 100 90 128" fill="${c}" opacity=".12" filter="url(#g2)"/>`, olhoE: '#d9c2ff', olhoD: '#d9c2ff', semCorpo: true };
    // Ombros, costas e mãos
    case 'cachecol': return { s: '<path d="M51 77 C57 84 71 84 77 77 L82 90 C71 97 57 97 46 90 Z"/><path d="M70 90 L77 116 L68 117 L64 92 Z"/>', l: brilho('M48 89 C58 94 70 94 80 89', c, .9, .45) };
    case 'gola': return { s: par('M42 96 C44 84 50 78 55 75 L56 92 Z'), l: brilho('M44 95 C46 86 50 80 55 77', c, .9, .5) };
    case 'golaAlta': return { s: par('M38 98 C36 80 40 64 48 52 L56 86 Z'), l: brilho('M40 96 C38 80 42 66 48 55', '#ff4a4a', 1, .7) };
    case 'ombreiras': return { s: par('M17 106 C22 94 35 90 48 93 C46 101 34 107 19 112 Z'), l: brilho('M21 104 C26 96 36 93 46 94', c, 1, .6) };
    case 'dragonas': return { s: par('M22 102 C28 96 38 93 48 94 L46 100 C38 101 30 104 24 107 Z'), l: `${brilho('M24 104 L46 98', '#ffe6a0', 1.4, .9)}${brilho('M28 108 L28 114 M33 106 L33 113 M38 104 L38 111', '#ffe6a0', 1, .7)}` };
    case 'medalhas': return { l: `${ponto(40, 112, 2.4, '#ffd56a')}${ponto(46, 113, 2.4, '#e05a4a')}${ponto(52, 114, 2.4, '#7fb0ff')}${brilho('M38 106 L54 108', '#ffd56a', 1.4, .7)}` };
    case 'pelagem': return { s: `<path d="M14 112 L18 98 L24 106 L28 92 L34 102 L40 90 L45 100 L52 88 L58 96 L64 86 L70 96 L76 88 L83 100 L88 90 L94 102 L100 92 L104 106 L110 98 L114 112 Z"/>`, l: brilho('M24 104 L28 94 L34 101 L40 92', c, .8, .45) };
    case 'espinhos': return { s: par('M28 104 L16 78 L38 98 Z M40 94 L36 72 L48 92 Z') };
    case 'espinhosOmbro': return { s: par('M20 106 L8 92 L30 100 Z M32 98 L24 82 L40 95 Z'), l: brilho('M10 93 L28 100', c, .9, .6) };
    case 'alcas': return { s: '<path d="M44 92 L52 128 L58 128 L50 90 Z M84 92 L76 128 L70 128 L78 90 Z"/>', l: `${ponto(50, 112, 1.6, c, .7)}${ponto(78, 112, 1.6, c, .7)}` };
    case 'cartucheira': return { s: '<path d="M38 96 L94 128 L84 128 L36 102 Z"/>', l: [0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${44 + i * 6.4}" y="${99 + i * 3.6}" width="2.2" height="5" rx="1" fill="#ffd56a" opacity=".85" transform="rotate(30 ${45 + i * 6.4} ${101 + i * 3.6})"/>`).join('') };
    case 'colarPresas': return { l: `${brilho('M50 84 C56 92 72 92 78 84', c, 1, .6)}${[0, 1, 2, 3, 4].map(i => `<path d="M${54 + i * 5} ${88 + (i === 2 ? 2 : i % 2)} l1.4 6 l1.4 -6 Z" fill="#f5ecd8" opacity=".9"/>`).join('')}` };
    case 'frascos': return { s: '<path d="M38 96 L92 128 L82 128 L36 102 Z"/>', l: [['#7dff6a', 46, 101], ['#ff6ad5', 56, 107], ['#6ad5ff', 66, 113], ['#ffd56a', 76, 119]].map(([cor, x, y]) => `<rect x="${x}" y="${y - 6}" width="5" height="8" rx="2" fill="${cor}" filter="url(#g)" opacity=".9"/>`).join('') };
    case 'cruz': return { l: `<path d="M30 104 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 Z" fill="#ff4a4a" filter="url(#g)"/>` };
    case 'codigo': return { atras: Array.from({ length: 9 }, (_, i) => `<text x="${8 + i * 13}" y="${20 + (i * 37) % 60}" font-family="monospace" font-size="7" fill="${c}" opacity="${0.18 + (i % 3) * 0.1}" writing-mode="tb">${['10110', '01101', '1001', '0111', '11010', '0010', '10011', '0110', '1101'][i]}</text>`).join('') };
    case 'nucleo': return { l: `${ponto(64, 108, 5, c)}${ponto(64, 108, 12, c, .35)}<circle cx="64" cy="108" r="7.5" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 2"/>` };
    case 'bracoMecanico': return { s: '<path d="M88 92 C102 92 114 100 118 118 L112 128 L96 128 Z"/>', l: `${brilho('M96 100 L108 110 M100 116 L112 120', c, 1, .8)}${ponto(98, 98, 2, c)}${ponto(110, 112, 2, c)}` };
    case 'dados': return { atras: Array.from({ length: 14 }, (_, i) => `<rect x="${(i * 29) % 120 + 4}" y="${(i * 47) % 70 + 6}" width="${2 + (i % 3)}" height="${2 + (i % 3)}" fill="${c}" opacity="${0.25 + (i % 4) * 0.12}"/>`).join('') };
    case 'rifle': return { atras: '<path d="M96 128 L101 50 L105 50 L103 128 Z"/><rect x="99" y="40" width="7" height="12" rx="1"/><rect x="96" y="64" width="14" height="5" rx="1"/>', l: brilho('M102 52 L100 120', c, .7, .4) };
    case 'espada': return { atras: '<path d="M36 94 L28 64 L31.5 63 L39 93 Z"/><path d="M23 68 L40 63.5 L41 67 L24 71.5 Z"/><circle cx="27" cy="59" r="3.4"/>', l: brilho('M25 69 L39 65', c, .8, .6) };
    case 'machado': return { atras: '<path d="M92 128 L99 54 L102.5 54 L96 128 Z"/><path d="M97 50 C110 44 118 56 115 70 C109 66 102 66 97 66 Z"/>', l: brilho('M103 48 C110 48 115 56 114 66', c, 1, .6) };
    case 'arco': return { atras: '<path d="M26 52 C12 78 14 106 30 126 L33.5 124 C19 104 18 80 30 54 Z"/>', l: brilho('M28 54 L32 124', c, .5, .5) };
    case 'engrenagens': return { atras: engrenagem(100, 92, 17, 10) + engrenagem(30, 98, 11, 8), l: `${ponto(100, 92, 3, c, .8)}` };
    case 'faiscasMao': return { l: `${ponto(100, 112, 3, '#fff')}${ponto(100, 112, 10, c, .4)}${brilho('M100 112 L110 104 M100 112 L112 114 M100 112 L106 122 M100 112 L94 102', '#fff2c0', .8, .9)}` };
    case 'moeda': return { l: `<circle cx="98" cy="104" r="7" fill="#ffd56a" filter="url(#g)"/><circle cx="98" cy="104" r="4.6" fill="none" stroke="#7a5418" stroke-width="1"/>${ponto(98, 104, 14, '#ffd56a', .25)}` };
    case 'estrelas': return { l: Array.from({ length: 7 }, (_, i) => { const x = 14 + ((i * 41) % 100); const y = 12 + ((i * 29) % 50); return `<path d="M${x} ${y - 3} L${x + .8} ${y - .8} L${x + 3} ${y} L${x + .8} ${y + .8} L${x} ${y + 3} L${x - .8} ${y + .8} L${x - 3} ${y} L${x - .8} ${y - .8} Z" fill="#fff6c8" filter="url(#g)"/>`; }).join('') };
    case 'runas': return { l: [[22, 30, 'ᚱ'], [104, 36, 'ᛟ'], [18, 70, 'ᛉ'], [108, 72, 'ᚦ']].map(([x, y, ch]) => `<text x="${x}" y="${y}" font-size="11" fill="${c}" opacity=".7" filter="url(#g)" text-anchor="middle">${ch}</text>`).join('') };
    case 'simbolo': return { l: `<circle cx="64" cy="108" r="7" fill="none" stroke="${c}" stroke-width="1.4" filter="url(#g)"/><path d="M64 100 L64 116 M57 104 L71 112 M71 104 L57 112" stroke="${c}" stroke-width="1" filter="url(#g)"/>` };
    case 'garras': return { s: '<path d="M96 128 C96 116 100 108 106 106 C110 106 112 110 110 116 L104 128 Z"/>', l: brilho('M104 106 L108 98 M108 108 L113 101 M110 112 L116 106', '#fff', 1, .8) };
    case 'ave': return { s: '<path d="M84 94 C85 84 93 79 100 82 L107 80 L102.5 85.5 C104 93 98 99 90 99.5 L80 106 Z"/><path d="M90 98 C96 104 100 112 98 120 C94 112 88 106 84 104 Z"/>', l: ponto(100, 85, 1.2, c) };
    case 'loboAo': return { s: '<path d="M92 128 C90 112 94 101 100 97 L101 84 L108 94 L114 92 L118 84 L120 98 C126 103 128 112 128 128 Z"/>', l: `<path d="M104 104 L109 106 L104 107 Z M120 104 L115 106 L120 107 Z" fill="${c}" filter="url(#g)"/>` };
    case 'espirito': return { atras: `<g opacity=".55" filter="url(#g)" fill="none" stroke="${c}" stroke-width="1.3"><path d="M64 34 C56 22 50 16 40 12 M48 18 L44 8 M52 24 L42 22 M64 34 C72 22 78 16 88 12 M80 18 L84 8 M76 24 L86 22"/><path d="M40 60 C30 70 26 84 30 100 M88 60 C98 70 102 84 98 100" opacity=".6"/></g>` };
    default: return {};
  }
}

function engrenagem(cx, cy, r, dentes) {
  const pts = [];
  for (let i = 0; i < dentes * 2; i++) {
    const a1 = (i / (dentes * 2)) * Math.PI * 2;
    const a2 = ((i + 1) / (dentes * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * .8 : r;
    pts.push(`${(cx + Math.cos(a1) * rr).toFixed(1)} ${(cy + Math.sin(a1) * rr).toFixed(1)}`, `${(cx + Math.cos(a2) * rr).toFixed(1)} ${(cy + Math.sin(a2) * rr).toFixed(1)}`);
  }
  return `<path d="M${pts.join(' L')} Z M${cx + r * .35} ${cy} A${r * .35} ${r * .35} 0 1 0 ${cx - r * .35} ${cy} A${r * .35} ${r * .35} 0 1 0 ${cx + r * .35} ${cy} Z" fill-rule="evenodd"/>`;
}

function particulas(t, r) {
  const lista = [];
  for (let i = 0; i < 16; i++) {
    const x = (r() * 128).toFixed(1);
    const y = (r() * 110).toFixed(1);
    const op = (0.15 + r() * 0.45).toFixed(2);
    if (t.tipo === 'chuva') lista.push(`<path d="M${x} ${y} l-2 7" stroke="${t.part}" stroke-width=".7" opacity="${op}"/>`);
    else if (t.tipo === 'bolhas' || t.tipo === 'esporos') lista.push(`<circle cx="${x}" cy="${y}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="none" stroke="${t.part}" stroke-width=".6" opacity="${op}"/>`);
    else if (t.tipo === 'fumaca') { if (i < 5) lista.push(`<ellipse cx="${x}" cy="${y}" rx="${(10 + r() * 16).toFixed(0)}" ry="${(4 + r() * 5).toFixed(0)}" fill="${t.part}" opacity="${(op / 5).toFixed(2)}"/>`); }
    else if (t.tipo === 'folhas') lista.push(`<ellipse cx="${x}" cy="${y}" rx="1.8" ry=".8" fill="${t.part}" opacity="${op}" transform="rotate(${(r() * 180).toFixed(0)} ${x} ${y})"/>`);
    else lista.push(`<circle cx="${x}" cy="${y}" r="${(0.4 + r() * 1).toFixed(1)}" fill="${t.part}" opacity="${op}"/>`);
  }
  if (t.tipo === 'lua') lista.unshift(`<circle cx="98" cy="26" r="13" fill="#ffe2b0" opacity=".55" filter="url(#g)"/><circle cx="104" cy="22" r="11" fill="${t.fundo}" opacity=".5"/>`);
  return lista.join('');
}

const cache = new Map();
export function svgAvatar(a) {
  if (cache.has(a.id)) return cache.get(a.id);
  const t = TEMAS[a.tema] || TEMAS.ermos;
  const r = rng(a.id);
  const corpo = a.corpo;
  const cab = corpo === 'f' ? 'f' : 'm';
  const ps = a.pecas.map(n => pecas(n, t, r));
  const algum = k => ps.find(p => p[k]);
  const cabeca = algum('cabeca')?.cabeca || CABECA[cab];
  const semCorpo = !!algum('semCorpo');
  const sil = [
    semCorpo ? '' : `<path d="${OMBROS[corpo] || OMBROS.m}"/>`,
    semCorpo ? '' : `<path d="${PESCOCO[cab]}"/>`,
    `<path d="${cabeca}"/>`,
    ...ps.map(p => p.s || ''),
  ].join('');
  const atras = ps.map(p => p.atras || '').join('');
  // Rosto: planos de luz sutis (testa, nariz, maçã do rosto), olhos e boca — escondidos por máscaras e elmos.
  const semRosto = !!algum('semRosto');
  const sombra = !!algum('sombra');
  const corOlho = lado => (lado === 'e' ? algum('olhoE')?.olhoE : algum('olhoD')?.olhoD) || t.olhos;
  const humano = ['ermos', 'cidade', 'aguas', 'cacador', 'perito', 'soldado', 'inventor', 'sortudo', 'treinador'].includes(a.tema) && !algum('olhoE') && !algum('olhoD');
  const olho = (x, lado) => {
    if (algum('olhoMorto')) return `<ellipse cx="${x}" cy="50.5" rx="2.4" ry="1.5" fill="#f2f7e0" opacity=".9"/>`;
    if (algum('olhoRept')) return `<ellipse cx="${x}" cy="50" rx="2.8" ry="1.6" fill="${t.olhos}" filter="url(#g)"/><ellipse cx="${x}" cy="50" rx=".5" ry="1.5" fill="#000"/>`;
    const cor = corOlho(lado);
    return humano && !sombra
      ? `<ellipse cx="${x}" cy="50.5" rx="2.3" ry="1.25" fill="${cor}" opacity=".75"/><circle cx="${x + .3}" cy="50.4" r=".8" fill="#000"/>`
      : `<ellipse cx="${x}" cy="50.5" rx="2.4" ry="1.2" fill="${cor}" filter="url(#g)"/><ellipse cx="${x}" cy="50.5" rx="1.2" ry=".6" fill="#fff"/>`;
  };
  const rosto = semRosto || semCorpo ? (semCorpo ? `${olho(58, 'e')}${olho(70, 'd')}` : '') : `
    <path d="M50 45 C54 42.5 60 43 62.5 45.5 M65.5 45.5 C68 43 74 42.5 78 45" fill="none" stroke="#000" stroke-width="1.6" opacity=".7"/>
    <path d="M51 46.5 C53 44.8 56 44.6 58 45.6" fill="none" stroke="${t.borda}" stroke-width=".6" opacity="${sombra ? 0 : .35}"/>
    <path d="M63 50 C62.4 54 61.6 57 60.6 59.2 C62 60 63.6 60.1 65 59.6" fill="none" stroke="${t.borda}" stroke-width=".8" opacity="${sombra ? .1 : .35}"/>
    <path d="M52 57 C53.5 60 55.5 62 57 63" fill="none" stroke="${t.borda}" stroke-width=".7" opacity="${sombra ? 0 : .22}"/>
    ${algum('semOlhos') ? '' : olho(57.5, 'e') + olho(70.5, 'd')}
    ${algum('semBoca') ? '' : `<path d="M59.5 65 C62 66 66 66 68.5 65" fill="none" stroke="#000" stroke-width="1.1" opacity=".75"/>`}`;
  const luz = ps.map(p => p.l || '').join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="72%"><stop offset="0" stop-color="${t.fundo}"/><stop offset=".55" stop-color="${mistura(t.fundo, '#000000', .55)}"/><stop offset="1" stop-color="#050506"/></radialGradient>
  <linearGradient id="pele" gradientUnits="userSpaceOnUse" x1="30" y1="20" x2="100" y2="110"><stop offset="0" stop-color="${mistura(t.fundo, '#2c2f35', .55)}"/><stop offset=".45" stop-color="#121418"/><stop offset="1" stop-color="#060708"/></linearGradient>
  <radialGradient id="halo" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="${t.borda}" stop-opacity=".28"/><stop offset="1" stop-color="${t.borda}" stop-opacity="0"/></radialGradient>
  <filter id="g" filterUnits="userSpaceOnUse" x="-10" y="-10" width="148" height="148"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="g2" filterUnits="userSpaceOnUse" x="-10" y="-10" width="148" height="148"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="borda" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".7"/></filter>
</defs>
<rect width="128" height="128" fill="url(#bg)"/>
<ellipse cx="64" cy="58" rx="46" ry="50" fill="url(#halo)"/>
${particulas(t, r)}
<g transform="translate(64 70) scale(1.12) translate(-64 -66)">
<g fill="${t.borda}" filter="url(#borda)" transform="translate(-1.4 -1)" opacity=".8">${atras}</g>
<g fill="#0a0b0e">${atras}</g>
<g fill="${t.borda}" filter="url(#borda)" transform="translate(-1.6 -1)" opacity=".95">${sil}</g>
<g fill="url(#pele)">${sil}</g>
<g fill="none" stroke="${t.borda}" stroke-width=".7" stroke-opacity=".3">${ps.map(p => p.s || '').join('')}</g>
<g fill="#000" opacity=".55">${sombra ? `<path d="${CABECA[cab]}"/>` : ''}</g>
${rosto}
${luz}
</g>
<rect width="128" height="128" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="6"/>
</svg>`;
  cache.set(a.id, svg);
  return svg;
}

function mistura(a, b, f) {
  const n = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('')}`;
}
