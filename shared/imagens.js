// Divisões das imagens da campanha (aba Imagens do mestre). Imagens antigas com categoria livre caem na divisão
// de nome parecido ("Mapa" → Mapas, "Geral" → Outros); categorias desconhecidas viram uma divisão própria.
export const CATEGORIAS_IMAGEM = [
  { id: 'Mapas', icone: 'map', dica: 'Aparecem primeiro na escolha do mapa' },
  { id: 'Cenas', icone: 'clapperboard', dica: 'Momentos da história, ilustrações' },
  { id: 'Locais', icone: 'castle', dica: 'Refúgios, ruínas, construções' },
  { id: 'Personagens', icone: 'users', dica: 'Personagens-jogador' },
  { id: 'NPCs', icone: 'ghost', dica: 'Pessoas que os jogadores encontram' },
  { id: 'Monstros', icone: 'skull', dica: 'Bestas e criaturas' },
  { id: 'Itens', icone: 'backpack', dica: 'Armas, objetos, artefatos' },
  { id: 'Documentos e pistas', icone: 'scroll', dica: 'Cartas, mapas do tesouro, anotações' },
  { id: 'Outros', icone: 'image', dica: '' },
];
const sem = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const SINONIMOS = { mapa: 'Mapas', cena: 'Cenas', local: 'Locais', lugar: 'Locais', lugares: 'Locais', personagem: 'Personagens', pj: 'Personagens', pjs: 'Personagens',
  npc: 'NPCs', monstro: 'Monstros', criatura: 'Monstros', criaturas: 'Monstros', item: 'Itens', documento: 'Documentos e pistas', documentos: 'Documentos e pistas', pista: 'Documentos e pistas', pistas: 'Documentos e pistas', geral: 'Outros', outro: 'Outros' };
export function categoriaDaImagem(img) {
  const k = sem(img?.categoria);
  if (!k) return 'Outros';
  const exata = CATEGORIAS_IMAGEM.find(c => sem(c.id) === k);
  if (exata) return exata.id;
  return SINONIMOS[k] || String(img.categoria).trim();
}

// Link de imagem colado pelo mestre (planilha de monstros): o link de compartilhar do Google Drive vira o endereço
// da imagem (a imagem fica no Drive do mestre; o app só mostra). Precisa estar como "Qualquer pessoa com o link".
// Outros endereços http(s) passam como estão; qualquer outra coisa é ignorada.
export function imagemDeLink(link) {
  const t = String(link || '').trim();
  if (!/^https?:\/\//i.test(t)) return null;
  const id = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{10,})/i.exec(t)?.[1]
    || /docs\.google\.com\/uc\?(?:export=\w+&)?id=([\w-]{10,})/i.exec(t)?.[1];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : t;
}
