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
