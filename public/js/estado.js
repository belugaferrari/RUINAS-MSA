// Estado global da tela. Qualquer view altera e chama render().
export const estado = {
  tela: 'carregando', // login | saguao | campanha
  usuario: null,
  area: null, // mestre | jogador
  sistema: null,
  saguao: [],
  campanha: null,
  aba: null,
  sel: {}, // seleções locais (personagem aberto, grupo, etc.)
  conectado: false,
};

let fnRender = () => {};
export function definirRender(fn) {
  fnRender = fn;
}

export function render() {
  fnRender();
}

export function mudar(parcial) {
  Object.assign(estado, parcial);
  render();
}

export const personagemPorId = id => estado.campanha?.personagens.find(p => p.id === id);
export const meusPersonagens = () => (estado.campanha?.personagens || []).filter(p => p.donoId === estado.usuario?.id);

// Regras do sistema (MSA ou MSS) já carregadas, por id.
const sistemas = new Map();
export async function carregarSistema(id = 'msa') {
  if (!sistemas.has(id)) {
    const r = await fetch(`/api/sistema?id=${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error('Não foi possível carregar as regras do sistema.');
    sistemas.set(id, await r.json());
  }
  return sistemas.get(id);
}

// Deixa estado.sistema igual ao sistema da campanha (usado ao entrar e quando o mestre troca).
export async function sincronizarSistema(campanha) {
  const id = campanha?.sistema || 'msa';
  if (estado.sistema?.id === id) return false;
  estado.sistema = await carregarSistema(id);
  return true;
}
